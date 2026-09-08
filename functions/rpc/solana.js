// Same-origin proxy for Solana JSON-RPC.
//
// Hashstanza is a Metaplex Core collection, so its assets are enumerated
// with getProgramAccounts over the Core program. That call is heavy: a
// keyed provider on a small plan can refuse it outright on compute cost,
// while Solana's public RPC serves it but rate-limits hard. So we try each
// upstream in turn and keep the first real answer, then let the edge cache
// it for a minute.
//
// Failures come back as a JSON-RPC error with HTTP 200, because Cloudflare
// replaces a 5xx body from a Function with its own page, which would hide
// the reason from both the browser and anyone debugging.
//
// Cloudflare Pages Function: POST /rpc/solana

const PUBLIC_RPC = 'https://api.mainnet-beta.solana.com';
const TIMEOUT_MS = 20000;

export async function onRequestPost({ request, env }) {
  const body = await request.text();
  if (body.length > 200_000) return rpcError('request too large', 413);

  const upstreams = [env.SOLANA_RPC_URL, PUBLIC_RPC].filter(Boolean);
  const problems = [];

  for (const url of upstreams) {
    try {
      const upstream = await fetch(url, {
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
      const host = hostOf(url);
      if (!upstream.ok) { problems.push(`${host}: HTTP ${upstream.status}`); continue; }

      let payload;
      try { payload = JSON.parse(text); } catch { problems.push(`${host}: malformed JSON`); continue; }
      // a JSON-RPC error (rate limit, method refused) means try the next upstream
      const err = Array.isArray(payload) ? payload.find(p => p?.error)?.error : payload?.error;
      if (err) { problems.push(`${host}: ${err.message || err.code}`); continue; }

      return new Response(text, {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' }
      });
    } catch (error) {
      problems.push(`${hostOf(url)}: ${String(error?.message || error)}`);
    }
  }
  return rpcError(problems.join(' | ') || 'no upstream configured');
}

export function onRequestGet({ env }) {
  return json({
    error: 'POST JSON-RPC only',
    upstreams: [env.SOLANA_RPC_URL, PUBLIC_RPC].filter(Boolean).map(hostOf)
  }, 405);
}

export function onRequest() {
  return json({ error: 'POST JSON-RPC only' }, 405);
}

function hostOf(url) {
  try { return new URL(url).host; } catch (_) { return 'unparseable'; }
}

// HTTP 200 so the body survives; the JSON-RPC envelope carries the failure
function rpcError(message, status = 200) {
  return json({ jsonrpc: '2.0', id: null, error: { code: -32000, message } }, status);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
