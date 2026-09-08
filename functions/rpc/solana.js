// Same-origin proxy for Solana JSON-RPC.
//
// The browser talks only to this endpoint, so no CORS check happens and no
// provider key is ever exposed. Set SOLANA_RPC_URL in the Cloudflare
// Pages project (Settings -> Environment variables) to a keyed provider
// such as Alchemy; without it we fall back to the chain's public RPC,
// which rate-limits and sometimes sends a duplicate CORS header.
//
// Cloudflare Pages Function: POST /rpc/solana

const PUBLIC_RPC = 'https://api.mainnet-beta.solana.com';
const ATTEMPTS = 2;
const TIMEOUT_MS = 12000; // getProgramAccounts is slow

export async function onRequestPost({ request, env }) {
  const upstreamUrl = env.SOLANA_RPC_URL || PUBLIC_RPC;
  const body = await request.text();
  if (body.length > 200_000) return json({ error: 'request too large' }, 413);

  let lastError = 'no response';
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 300));
    try {
      const upstream = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (compatible; mossquest/1.0; +https://mossmossmoss.quest)',
          accept: 'application/json'
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      // read it fully here: a drop mid-body is then ours to retry, not a broken stream
      const text = await upstream.text();
      if (!upstream.ok) { lastError = `upstream ${upstream.status}`; continue; }
      try { JSON.parse(text); } catch { lastError = 'upstream sent malformed JSON'; continue; }
      return new Response(text, {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' }
      });
    } catch (error) {
      lastError = String(error?.message || error);
    }
  }
  return json({ error: `Robinhood RPC unavailable: ${lastError}` }, 502);
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
}

// GET reports which upstream is configured (host only, never the key), so a
// misconfigured environment is obvious without guesswork
export function onRequestGet({ env }) {
  const url = env.SOLANA_RPC_URL || PUBLIC_RPC;
  let host = 'unparseable';
  try { host = new URL(url).host; } catch (_) { /* leave as is */ }
  return json({ error: 'POST JSON-RPC only', upstreamHost: host, keyed: Boolean(env.SOLANA_RPC_URL) }, 405);
}

export function onRequest() {
  return json({ error: 'POST JSON-RPC only' }, 405);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
