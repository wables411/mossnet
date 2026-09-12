// Cloud saves for Moss Quest, keyed by wallet address.
//
// The browser keeps playing from localStorage no matter what happens here; this is a
// backup that lets one player pick the same game up on another device. Nothing here is
// required for the game to run, so every failure answers with a reason and the client
// shrugs and carries on.
//
//   POST /save/challenge  {address}              -> {message, expires}
//   POST /save/session    {address, signature}   -> {token, address, expires}
//   GET  /save            Bearer token           -> {save, updated} | 404
//   PUT  /save            Bearer token + body    -> {ok, updated}
//   DELETE /save          Bearer token           -> {ok}
//
// The challenge is a one-shot nonce: signing it proves the wallet without ever handing
// the site a key, and the token it buys is a plain HMAC that this Worker can check on
// its own. Needs a KV namespace bound as SAVES and a random string in SAVE_SECRET.

import { recoverPersonalSigner } from '../_lib/ethverify.js';

const NONCE_TTL = 300;                    // five minutes to sign
const TOKEN_DAYS = 60;
const MAX_BYTES = 256 * 1024;             // a full 1000-species save is ~40KB
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = new TextEncoder();

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

// constant time: a token check should not leak where it stopped matching
function same(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function mintToken(secret, address, days = TOKEN_DAYS) {
  const expires = Date.now() + days * 86400000;
  const payload = `${address.toLowerCase()}.${expires}`;
  return { token: `${payload}.${await hmac(secret, payload)}`, expires };
}

async function readToken(secret, request) {
  const auth = request.headers.get('authorization') || '';
  // sendBeacon cannot set a header, so a page closing mid-game passes the token in the query
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : (new URL(request.url).searchParams.get('t') || '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [address, expires, mac] = parts;
  if (!ADDRESS.test(address) || !/^\d+$/.test(expires)) return null;
  if (Number(expires) < Date.now()) return null;
  return same(mac, await hmac(secret, `${address}.${expires}`)) ? address : null;
}

const setup = (env) => {
  if (!env.SAVES) return 'cloud saves are not configured on this deployment (no KV binding)';
  if (!env.SAVE_SECRET) return 'cloud saves are not configured on this deployment (no secret)';
  return null;
};

export async function onRequest({ request, env, params }) {
  const missing = setup(env);
  if (missing) return json({ error: missing }, 503);

  const route = Array.isArray(params.route) ? params.route.join('/') : (params.route || '');
  const method = request.method.toUpperCase();

  try {
    if (method === 'POST' && route === 'challenge') {
      const { address } = await request.json();
      if (!ADDRESS.test(address || '')) return json({ error: 'that is not an address' }, 400);
      const nonce = b64url(crypto.getRandomValues(new Uint8Array(18)));
      const message = [
        'Moss Quest',
        '',
        'Sign in to back up your MossDex. This costs nothing and moves nothing.',
        '',
        `Wallet: ${address.toLowerCase()}`,
        `Nonce: ${nonce}`
      ].join('\n');
      await env.SAVES.put(`nonce:${address.toLowerCase()}`, message, { expirationTtl: NONCE_TTL });
      return json({ message, expires: Date.now() + NONCE_TTL * 1000 });
    }

    if (method === 'POST' && route === 'session') {
      const { address, signature } = await request.json();
      if (!ADDRESS.test(address || '') || typeof signature !== 'string') return json({ error: 'address and signature, please' }, 400);
      const key = `nonce:${address.toLowerCase()}`;
      const message = await env.SAVES.get(key);
      if (!message) return json({ error: 'that challenge has expired, ask for another' }, 400);
      const signer = recoverPersonalSigner(message, signature);
      if (!signer || signer.toLowerCase() !== address.toLowerCase()) return json({ error: 'that signature is not from that wallet' }, 401);
      await env.SAVES.delete(key);                             // one nonce, one session
      const { token, expires } = await mintToken(env.SAVE_SECRET, address);
      return json({ token, address: address.toLowerCase(), expires });
    }

    // POST is the same write as PUT: it is what sendBeacon can send as a tab closes
    if (route === '' && (method === 'GET' || method === 'PUT' || method === 'POST' || method === 'DELETE')) {
      const address = await readToken(env.SAVE_SECRET, request);
      if (!address) return json({ error: 'sign in again' }, 401);
      const key = `save:${address}`;

      if (method === 'GET') {
        const record = await env.SAVES.get(key, 'json');
        return record ? json(record) : json({ error: 'nothing saved yet' }, 404);
      }
      if (method === 'DELETE') {
        await env.SAVES.delete(key);
        return json({ ok: true });
      }
      const body = await request.text();
      if (body.length > MAX_BYTES) return json({ error: 'that save is too big' }, 413);
      let save;
      try { save = JSON.parse(body); } catch { return json({ error: 'that is not JSON' }, 400); }
      if (!save || typeof save !== 'object' || Array.isArray(save)) return json({ error: 'a save is an object' }, 400);
      const record = { save, updated: Date.now() };
      await env.SAVES.put(key, JSON.stringify(record));
      return json({ ok: true, updated: record.updated });
    }

    return json({ error: 'no such route' }, 404);
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
}
