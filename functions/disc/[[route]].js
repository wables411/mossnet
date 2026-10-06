// Moss Quest VII, disc 1: served only to a wallet that holds a Moss:Net, a sancigawa or a Mossawrette.
//
// The public bundle (quest.js) carries the engine; the disc is this Function's to hand out. A
// static file could be fetched by anyone who read the page source, so the disc never is one: it
// is bundled into this Worker from functions/_lib/disc1_src.js (written by the game repo's
// export_site.py) and only leaves with a pass cookie that a holder's wallet earned.
//
//   POST   /disc/session   Bearer <save session token, wallet door>  -> {ok, address, holdings, expires} + Set-Cookie mq_disc
//   GET    /disc/status    cookie                                     -> {ok, address, expires} | 401
//   GET    /disc/1.js      cookie                                     -> the disc, as an ES module | 403
//   DELETE /disc/session   cookie                                     -> clears the pass
//
// The save token already proves the wallet (the player signed a nonce for /save); this only has
// to ask the chains what that wallet holds. Holdings are remembered for ten minutes in KV so a
// retry does not hit the RPCs again. Needs SAVES and SAVE_SECRET like /save; ROBINHOOD_RPC_URL and
// ETH_RPC_URL are optional keyed providers.

import { mintToken, readToken, bearer, cookie } from '../_lib/session.js';
import DISC1 from '../_lib/disc1_src.js';

const PASS_MS = 24 * 3600 * 1000;
const HOLD_TTL = 600;
const COOKIE = 'mq_disc';
const COLLECTIONS = [
  { id: 'mossnet',      name: 'Moss:Net',     chain: 'robinhood', address: '0x15f499841Df89F34529Ca41eB30271cAdDEee573' },
  { id: 'sancigawa',    name: 'sancigawa',    chain: 'robinhood', address: '0x2E557707df4a8b07457D69fA91EFc62DeB50CB59' },
  { id: 'mossawrettes', name: 'Mossawrettes', chain: 'ethereum',  address: '0x71f7bedf8572b75e446766906079dcf05a386737' }
];
const RPC = {
  robinhood: (env) => [env.ROBINHOOD_RPC_URL, 'https://rpc.mainnet.chain.robinhood.com'].filter(Boolean),
  ethereum:  (env) => [env.ETH_RPC_URL, 'https://ethereum-rpc.publicnode.com', 'https://cloudflare-eth.com', 'https://1rpc.io/eth'].filter(Boolean)
};
const UA = 'Mozilla/5.0 (compatible; mossquest/1.0; +https://mossmossmoss.quest)';

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra }
});
const passCookie = (token, maxAge) => `${COOKIE}=${encodeURIComponent(token)}; Path=/disc; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;

// balanceOf(address) on an ERC-721, through the first RPC that answers
async function balance(env, chain, contract, address) {
  const data = '0x70a08231' + address.toLowerCase().replace('0x', '').padStart(64, '0');
  let last = 'no rpc';
  for (const url of RPC[chain](env)) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': UA },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: contract, data }, 'latest'] }),
        signal: AbortSignal.timeout(6000)
      });
      const text = await r.text();
      if (!r.ok) { last = `${url} answered ${r.status}`; continue; }
      let body;
      try { body = JSON.parse(text); } catch { last = `${url} sent something other than JSON`; continue; }
      if (body.error) { last = `${url}: ${body.error.message || 'rpc error'}`; continue; }
      if (typeof body.result !== 'string' || !/^0x[0-9a-fA-F]*$/.test(body.result)) { last = `${url}: odd result`; continue; }
      return Number(BigInt(body.result || '0x0'));
    } catch (e) { last = `${url}: ${e && e.message || e}`; }
  }
  throw new Error(last);
}

async function holdings(env, address) {
  const key = `disc:hold:${address}`;
  const cached = await env.SAVES.get(key, 'json');
  if (cached) return cached;
  const out = {};
  const errors = [];
  await Promise.all(COLLECTIONS.map(async (c) => {
    try { out[c.id] = await balance(env, c.chain, c.address, address); }
    catch (e) { out[c.id] = null; errors.push(`${c.name}: ${e.message}`); }
  }));
  const any = Object.values(out).some(n => n > 0);
  // a count we could not get is not a zero: only remember a complete answer, or a yes
  if (any || !errors.length) await env.SAVES.put(key, JSON.stringify(out), { expirationTtl: HOLD_TTL });
  if (!any && errors.length) throw new Error('could not reach the chain: ' + errors.join('; '));
  return out;
}

const setup = (env) => {
  if (!env.SAVES) return 'the disc is not configured on this deployment (no KV binding)';
  if (!env.SAVE_SECRET) return 'the disc is not configured on this deployment (no secret)';
  return null;
};

export async function onRequest({ request, env, params }) {
  const missing = setup(env);
  if (missing) return json({ error: missing }, 503);
  const route = Array.isArray(params.route) ? params.route.join('/') : (params.route || '');
  const method = request.method.toUpperCase();

  try {
    if (method === 'POST' && route === 'session') {
      const ident = await readToken(env.SAVE_SECRET, bearer(request));
      if (!ident) return json({ error: 'sign in with a wallet first' }, 401);
      if (!ident.startsWith('0x')) return json({ error: 'the disc needs a wallet: the RemiliaNET door cannot show what you hold' }, 403);
      const held = await holdings(env, ident);
      const names = COLLECTIONS.filter(c => held[c.id] > 0).map(c => c.name);
      if (!names.length) return json({ error: 'that wallet holds no Moss:Net, sancigawa or Mossawrette', holdings: held }, 403);
      const { token, expires } = await mintToken(env.SAVE_SECRET, ident, PASS_MS, 'disc1');
      return json({ ok: true, address: ident, holdings: held, collections: names, expires }, 200, { 'set-cookie': passCookie(token, PASS_MS / 1000) });
    }

    if (method === 'DELETE' && route === 'session') {
      return json({ ok: true }, 200, { 'set-cookie': passCookie('', 0) });
    }

    const pass = await readToken(env.SAVE_SECRET, cookie(request, COOKIE), 'disc1');

    if (method === 'GET' && route === 'status') {
      if (!pass) return json({ error: 'no pass' }, 401);
      return json({ ok: true, address: pass });
    }

    if (method === 'GET' && route === '1.js') {
      if (!pass) return new Response('// no pass: the disc is for holders. POST /disc/session with a wallet session first.\n', {
        status: 403, headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' } });
      return new Response(DISC1, { status: 200, headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' } });
    }

    return json({ error: 'no such route' }, 404);
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
}
