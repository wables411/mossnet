// The site's session tokens, as /save mints them: `<ident>.<expires>.<hmac>` where ident is a
// lowercased wallet address or rn:<handle>, signed with SAVE_SECRET. /save keeps its own copy of
// this; /disc reads the same tokens through here, and mints its own with a prefix so one can
// never pass for the other.

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = new TextEncoder();
export const IDENT = /^(0x[0-9a-f]{40}|rn:[a-z0-9_.-]{1,64})$/;

export async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

// constant time: a token check should not leak where it stopped matching
export function same(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// `prefix` namespaces the token: '' is a /save session, 'disc1' a disc pass
export async function mintToken(secret, ident, ms, prefix = '') {
  const expires = Date.now() + ms;
  const payload = `${prefix ? prefix + '.' : ''}${ident.toLowerCase()}.${expires}`;
  return { token: `${payload}.${await hmac(secret, payload)}`, expires };
}

export async function readToken(secret, token, prefix = '') {
  const parts = String(token || '').trim().split('.');
  if (prefix) { if (parts.length !== 4 || parts[0] !== prefix) return null; parts.shift(); }
  if (parts.length !== 3) return null;
  const [ident, expires, mac] = parts;
  if (!IDENT.test(ident) || !/^\d+$/.test(expires)) return null;
  if (Number(expires) < Date.now()) return null;
  const payload = `${prefix ? prefix + '.' : ''}${ident}.${expires}`;
  return same(mac, await hmac(secret, payload)) ? ident : null;
}

export function bearer(request) {
  const auth = request.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

export function cookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}
