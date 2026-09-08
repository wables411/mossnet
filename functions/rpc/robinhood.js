// Same-origin proxy for Robinhood Chain JSON-RPC.
//
// Robinhood's public RPC intermittently answers with two
// Access-Control-Allow-Origin headers ("*, *"), which browsers reject
// outright, so the gallery could not read the chain. Going through the
// site's own origin means no CORS check happens at all.
//
// Cloudflare Pages Function: POST /rpc/robinhood

const UPSTREAM = 'https://rpc.mainnet.chain.robinhood.com';

export async function onRequestPost({ request }) {
  const body = await request.text();
  if (body.length > 200_000) return json({ error: 'request too large' }, 413);

  let attempt = 0;
  let lastStatus = 502;
  while (attempt < 2) {
    try {
      const upstream = await fetch(UPSTREAM, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body
      });
      if (upstream.ok) {
        return new Response(upstream.body, {
          status: 200,
          headers: {
            'content-type': 'application/json',
            // the chain's answer for a given block does not change
            'cache-control': 'public, max-age=15'
          }
        });
      }
      lastStatus = upstream.status;
    } catch (_) {
      lastStatus = 502;
    }
    attempt += 1;
    if (attempt < 2) await new Promise(r => setTimeout(r, 400));
  }
  return json({ error: `upstream RPC unavailable (${lastStatus})` }, 502);
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
