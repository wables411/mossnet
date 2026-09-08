// Same-origin proxy for Robinhood Chain JSON-RPC.
//
// Two problems with talking to the chain's public RPC from the browser:
//   1. It intermittently answers with two Access-Control-Allow-Origin
//      headers ("*, *"), which browsers reject outright.
//   2. It intermittently drops the connection, more often for shared
//      egress like Cloudflare's.
// Going through the site's own origin removes the CORS check entirely, and
// buffering the upstream answer (rather than streaming it) means a dropped
// connection is a caught error we can retry instead of a broken response.
//
// Cloudflare Pages Function: POST /rpc/robinhood

const UPSTREAM = 'https://rpc.mainnet.chain.robinhood.com';
const ATTEMPTS = 2;
const BACKOFF_MS = [300];
const TIMEOUT_MS = 6000;

export async function onRequestPost({ request }) {
  const body = await request.text();
  if (body.length > 200_000) return json({ error: 'request too large' }, 413);

  let lastError = 'no response';
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, BACKOFF_MS[attempt - 1] ?? 600));
    try {
      const upstream = await fetch(UPSTREAM, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // the upstream is unhappy with the default Workers user agent
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
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=15' }
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

export function onRequest() {
  return json({ error: 'POST JSON-RPC only' }, 405);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
