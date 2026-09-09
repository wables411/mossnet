// Same-origin OHLCV feed for $MOSS on Robinhood Chain.
//
// The browser only ever talks to this endpoint, so there is no CORS check and no
// third-party host in the CSP. More importantly the response is cached at the edge,
// so one upstream call serves every visitor for the length of the TTL: the provider
// sees a trickle instead of one request per person, and everybody's world is grown
// from the same candles.
//
// Set GECKO_API_KEY in the Pages project to use CoinGecko's keyed onchain API
// (GECKO_API_TIER=pro for a paid key; anything else uses the free demo tier).
// Without a key this falls back to the public GeckoTerminal endpoint, which
// rate-limits by IP — and Cloudflare's egress IPs are shared, so in production
// that endpoint returns 429 regularly. When every attempt fails, the last good
// payload is served from a long-lived cache entry rather than nothing.
//
// Cloudflare Pages Function: GET /price/moss?tf=hour&limit=300

const NETWORK = 'robinhood';
const POOL = '0x2dc2647127120911e3d356465a07ffd08c84f026';
const FREE = 'https://api.geckoterminal.com/api/v2';
const DEMO = 'https://api.coingecko.com/api/v3/onchain';
const PRO = 'https://pro-api.coingecko.com/api/v3/onchain';
const STALE_TTL = 86400;                                    // a day of last-known-good
const TIMEFRAMES = { minute: 'minute', hour: 'hour', day: 'day' };
const TTL = { minute: 45, hour: 120, day: 600 };
const ATTEMPTS = 2;
const TIMEOUT_MS = 12000;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const tf = TIMEFRAMES[url.searchParams.get('tf')] || 'hour';
  const limit = Math.min(1000, Math.max(10, Number(url.searchParams.get('limit')) || 300));
  const ttl = TTL[tf];

  // one origin fetch per TTL, shared by every visitor on this edge
  const cache = caches.default;
  const key = new Request(`${url.origin}/price/moss?tf=${tf}&limit=${limit}`, { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;

  const keyed = Boolean(env.GECKO_API_KEY);
  const pro = keyed && env.GECKO_API_TIER === 'pro';
  const base = keyed ? (pro ? PRO : DEMO) : FREE;
  const upstream = `${base}/networks/${NETWORK}/pools/${POOL}/ohlcv/${tf}?aggregate=1&limit=${limit}`;
  const staleKey = new Request(`${url.origin}/price/moss?stale=1&tf=${tf}&limit=${limit}`, { method: 'GET' });

  let lastError = 'no response';
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 1200));       // a 429 will not clear in a heartbeat
    try {
      const response = await fetch(upstream, {
        headers: {
          accept: 'application/json',
          'user-agent': 'Mozilla/5.0 (compatible; mossquest/1.0; +https://mossmossmoss.quest)',
          ...(keyed ? { [pro ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key']: env.GECKO_API_KEY } : {})
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cf: { cacheTtl: ttl, cacheEverything: true }
      });
      // read it fully here: a drop mid-body is then ours to retry, not a broken stream
      const text = await response.text();
      if (!response.ok) { lastError = `upstream ${response.status}`; continue; }
      let payload;
      try { payload = JSON.parse(text); } catch { lastError = 'upstream sent malformed JSON'; continue; }

      const rows = payload?.data?.attributes?.ohlcv_list;
      if (!Array.isArray(rows)) { lastError = 'upstream sent no ohlcv_list'; continue; }

      // GeckoTerminal returns newest first; the world is grown oldest to newest
      const candles = rows
        .map(r => r.map(Number))
        .filter(r => r.length >= 6 && r.every(Number.isFinite) && r[4] > 0)
        .sort((a, b) => a[0] - b[0]);

      const body = JSON.stringify({
        pool: POOL, network: NETWORK, timeframe: tf,
        source: keyed ? (pro ? 'coingecko-pro' : 'coingecko') : 'geckoterminal',
        fetched: Math.floor(Date.now() / 1000),
        candles
      });
      const out = new Response(body, {
        headers: {
          'content-type': 'application/json',
          'cache-control': `public, max-age=${ttl}, s-maxage=${ttl}`
        }
      });
      await cache.put(key, out.clone());
      // and keep a copy for a day, to answer with real candles when the upstream
      // is rate-limiting rather than handing the client an empty world
      if (candles.length) {
        await cache.put(staleKey, new Response(body, {
          headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${STALE_TTL}` }
        }));
      }
      return out;
    } catch (error) {
      lastError = String(error?.message || error);
    }
  }

  // Upstream is down or throttling. Serve the last good candles if we have them,
  // flagged as stale, so the world still stands.
  const stale = await cache.match(staleKey);
  if (stale) {
    const payload = await stale.json();
    return new Response(JSON.stringify({ ...payload, stale: true, staleReason: lastError }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' }
    });
  }
  // 200 with an error field on purpose: Cloudflare replaces 5xx bodies with its own
  // page, and the client needs to read the reason to decide what to fall back to
  return new Response(JSON.stringify({ error: lastError, candles: [], timeframe: tf, keyed }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

export function onRequest() {
  return new Response(JSON.stringify({ error: 'GET only' }), {
    status: 405, headers: { 'content-type': 'application/json' }
  });
}
