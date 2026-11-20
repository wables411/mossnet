// Lost in the Moss (the 3D moss maze). OPEN since 2026-11-19: no word is asked for, and anyone may leave a note on
// the board (it limits how many per address). What follows describes the word door it had as a beta, which still
// works if the environment says MAZE_GATE = "word"; MAZE_GATE = "remilia" is the other door, further down.
//
// (As a beta it sat behind a word.)
//
// Every request under /maze/ comes through here before any file is served.
// Without the cookie, a page load gets the door (a small form) and the
// game's own files get a plain 401, so nothing of the maze loads until the
// word has been given. The right word sets a cookie for thirty days.
//
// The dev notes are open to anyone: the page (/maze/notes), its script, and
// the fonts folder the notes and the door are set in. The board behind the
// page (notes-api/) is passed straight on with data.tester saying whether
// the cookie was held: anyone may read it, only a tester may add to it.
//
// This repo is public, so neither the word nor the cookie's value is in it:
// the cookie holds a key derived from the word, and LOCK is the hash of that
// key. Reading this file does not open the door; knowing the word does.
// To change the word: LOCK = sha256(sha256('moss-maze-beta:' + word)), hex.
//
// The game is also given its own content policy here, in place of the site's:
// its scanned models are unpacked by WebAssembly and their pictures are read
// back from blob: addresses, neither of which the site's policy allows. It is
// otherwise tighter than the site's: nothing is fetched from anywhere else.
//
// The other door (MAZE_GATE = "remilia", for when the maze leaves beta and sits in the games tab): no word at
// all, and the only way in is a RemiliaNET sign-in. The door page finds the sign-in this browser tab already
// holds from the home page (or sends the visitor there to make one), shows it once to POST /maze/enter, which
// asks RemiliaNET who that is and answers with a cookie signed with the site's own secret (SAVE_SECRET), good for
// a week. Nothing of RemiliaNET's is kept: the cookie says only the handle and when it lapses.
//
// Cloudflare Pages Function: middleware for /maze/*

const SITE_LOCK = 'ad5ff21ea92f7fb7acbb11e9880df8db67f96a480f52549a3e274f602833e773';
const COOKIE = 'maze_beta';
const MAX_AGE = 60 * 60 * 24 * 30;
const POLICY = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://static.cloudflareinsights.com; worker-src 'self' blob:; connect-src 'self' blob: data: https://www.remilia.net https://cloudflareinsights.com; img-src 'self' data: blob:; media-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'";

// what the site serves for /maze/, under the maze's own content policy
async function served(next) {
  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set('Content-Security-Policy', POLICY);
  return out;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const keyOf = word => sha256('moss-maze-beta:' + word.trim().toLowerCase());

const OPEN = /^\/maze\/(?:notes(?:\.html|\.js|-page\.js|\/)?|fonts\/[A-Za-z0-9._-]+)$/;
const BOARD = /^\/maze\/notes-api\//;

// --- the RemiliaNET door
const REMILIA_ME = 'https://www.remilia.net/api/v1/me';
const RN_COOKIE = 'maze_rn', RN_AGE = 60 * 60 * 24 * 7;
const HANDLE = /^[a-z0-9_.-]{1,64}$/;
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
// the handle a signed cookie carries, or null when there is none, it has lapsed, or it is not ours
async function signedIn(request, secret) {
  if (!secret) return null;
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)maze_rn=([a-z0-9_.-]{1,64})\|(\d{10,13})\|([0-9a-f]{64})(?:;|$)/);
  if (!m || Number(m[2]) < Date.now()) return null;
  const want = await hmac(secret, `maze:${m[1]}|${m[2]}`);
  let diff = 0; for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ m[3].charCodeAt(i);
  return diff === 0 ? m[1] : null;
}

const cookieFor = key => `${COOKIE}=${key}; Path=/maze; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;

export async function onRequest({ request, next, data, env }) {
  const LOCK = (env && env.MAZE_LOCK) || SITE_LOCK;   // MAZE_LOCK: a word of its own for local testing
  const path = new URL(request.url).pathname;
  const held = (request.headers.get('cookie') || '').match(/(?:^|;\s*)maze_beta=([0-9a-f]{64})(?:;|$)/);
  const json = (body, status, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
  const sameOrigin = () => { const origin = request.headers.get('origin'); return !origin || origin === new URL(request.url).origin; };

  // ---- the RemiliaNET door: the sign-in is the only key
  if (env && env.MAZE_GATE === 'remilia') {
    const handle = await signedIn(request, env.SAVE_SECRET);
    if (path === '/maze/enter' && request.method === 'POST') {
      if (!sameOrigin()) return json({ error: 'not from here' }, 403);
      if (!env.SAVE_SECRET) return json({ error: 'the door has no key of its own yet' }, 500);
      const body = await request.json().catch(() => ({}));
      if (typeof body.access_token !== 'string' || !body.access_token) return json({ error: 'a RemiliaNET sign-in, please' }, 400);
      const who = await fetch(REMILIA_ME, { headers: { authorization: `Bearer ${body.access_token}`, accept: 'application/json' } });
      if (who.status === 401 || who.status === 403) return json({ error: 'RemiliaNET did not accept that sign-in' }, 401);
      if (!who.ok) return json({ error: `RemiliaNET answered ${who.status}` }, 502);
      const me = await who.json().catch(() => ({}));
      const name = String((me.user && me.user.username) || me.username || '').toLowerCase();
      if (!HANDLE.test(name)) return json({ error: 'RemiliaNET did not say who that is' }, 502);
      const until = Date.now() + RN_AGE * 1000;
      return json({ ok: true, handle: name }, 200, { 'set-cookie': `${RN_COOKIE}=${name}|${until}|${await hmac(env.SAVE_SECRET, `maze:${name}|${until}`)}; Path=/maze; Max-Age=${RN_AGE}; HttpOnly; Secure; SameSite=Lax` });
    }
    if (path === '/maze/notes-api/word') return json({ error: 'the maze opens with a RemiliaNET sign-in now' }, 403);
    if (BOARD.test(path)) { data.tester = !!handle; data.handle = handle; return next(); }
    if (handle) return served(next);
    if ((request.method === 'GET' || request.method === 'HEAD') && OPEN.test(path)) return served(next);
    const dest = request.headers.get('sec-fetch-dest');
    const page = dest ? dest === 'document' : (request.headers.get('accept') || '').includes('text/html');
    if (!page || request.method !== 'GET') return new Response('the maze is closed', { status: 401, headers: { 'cache-control': 'no-store' } });
    return remiliaDoor();
  }

  // ---- no door (the default): everything is served, under the maze's own content policy, and the board takes notes
  if (!(env && env.MAZE_GATE === 'word')) {
    if (path === '/maze/notes-api/word') return json({ ok: true }, 200);
    if (BOARD.test(path)) { data.tester = true; return next(); }
    return served(next);
  }

  const tester = !!held && await sha256(held[1]) === LOCK;

  // the word can be given on the board itself, so that leaving a note never means going to find the door
  if (path === '/maze/notes-api/word' && request.method === 'POST') {
    const say = (body, status, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return say({ error: 'not from here' }, 403);
    const body = await request.json().catch(() => ({}));
    const key = await keyOf(String(body.word || '').slice(0, 200));
    if (await sha256(key) !== LOCK) return say({ error: 'that is not the word' }, 403);
    return say({ ok: true }, 200, { 'set-cookie': cookieFor(key) });
  }
  if (BOARD.test(path)) { data.tester = tester; return next(); }
  if (tester) return served(next);
  if ((request.method === 'GET' || request.method === 'HEAD') && OPEN.test(path)) return served(next);

  if (request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const key = await keyOf(String((form && form.get('word')) || '').slice(0, 200));
    if (await sha256(key) !== LOCK) return door(true);
    return new Response(null, {
      status: 303,
      headers: {
        location: '/maze/',
        'set-cookie': cookieFor(key),
        'cache-control': 'no-store'
      }
    });
  }

  // only a page load is shown the door; scripts, textures and models are simply refused
  const dest = request.headers.get('sec-fetch-dest');
  const page = dest ? dest === 'document' : (request.headers.get('accept') || '').includes('text/html');
  if (!page) return new Response('the maze is closed', { status: 401, headers: { 'cache-control': 'no-store' } });
  return door(false);
}

function remiliaDoor() {
  return new Response(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Lost in the Moss</title>
<link rel="icon" href="data:,">
<style>
  @font-face { font-family: "Freckle Face"; src: url("/maze/fonts/FreckleFace-Regular.woff2") format("woff2"); font-display: swap; }
  @font-face { font-family: "IM Fell English"; src: url("/maze/fonts/IMFellEnglish-Regular.woff2") format("woff2"); font-display: swap; }
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #10140f; color: #e9eee4; font-family: "IM Fell English", Georgia, "Times New Roman", serif; }
  body { display: flex; align-items: center; justify-content: center; padding: 16px; text-align: center;
    background: radial-gradient(120% 90% at 30% 0%, #26341c 0%, transparent 60%), radial-gradient(90% 80% at 85% 100%, #1c2a17 0%, transparent 65%), #10140f; }
  form { width: 100%; max-width: 420px; padding: 36px 32px; background: rgba(8, 12, 8, 0.42); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; }
  h1 { font-family: "Freckle Face", "IM Fell English", Georgia, serif; font-weight: 400; letter-spacing: 0.03em; font-size: clamp(32px, 9vw, 44px); line-height: 1.1; margin: 0 0 8px; }
  p { margin: 0 0 22px; font-size: 16px; color: #aab3a4; line-height: 1.6; }
  p.wrong { margin: 14px 0 0; color: #e0a48f; }
  p.notes { margin: 22px 0 0; }
  a { color: #d7dfd0; text-underline-offset: 3px; }
  a:hover { color: #fff; }
  input { width: 100%; padding: 13px 14px; font: inherit; font-size: 17px; letter-spacing: 0.08em; text-align: center; color: #e9eee4; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.3); border-radius: 3px; }
  input:focus { outline: 2px solid #c9d6b8; outline-offset: 2px; }
  button { margin-top: 12px; width: 100%; font: inherit; font-family: "Freckle Face", "IM Fell English", Georgia, serif; cursor: pointer; border: 1px solid rgba(255,255,255,0.35); background: rgba(236, 244, 226, 0.92); color: #15200f; padding: 13px 26px; font-size: 18px; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 3px; }
  button:hover { background: #fff; }
</style>
</head>
<body>
<form id="door" onsubmit="return false">
  <h1>Lost in the Moss</h1>
  <p id="say">it opens to anyone signed in to RemiliaNET</p>
  <button type="button" id="go">sign in with RemiliaNET</button>
  <p class="notes">the <a href="/maze/notes">dev notes</a> are open for anyone to read</p>
</form>
<script>
// The sign-in this tab already holds from the home page opens the door; without one, the home page makes it and
// sends the visitor back here (it looks for the "maze-after" note left below).
(async () => {
  const say = t => { document.getElementById('say').textContent = t; };
  const get = k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } };
  const set = (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} };
  document.getElementById('go').addEventListener('click', () => { set('maze-after', '1'); location.href = '/?signin=remilia'; });
  let token = get('remilia-access');
  if (token && Date.now() > Number(get('remilia-expires') || 0) - 15000) {
    token = null;
    const refresh = get('remilia-refresh');
    if (refresh) try {
      const r = await fetch('https://www.remilia.net/oidc/realms/remilia/protocol/openid-connect/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: 'tpa-mossquest' }) });
      if (r.ok) { const p = await r.json(); set('remilia-access', p.access_token); set('remilia-refresh', p.refresh_token || ''); set('remilia-expires', String(Date.now() + (p.expires_in || 300) * 1000)); token = p.access_token; }
    } catch (_) {}
  }
  if (!token) return;
  say('opening...');
  try {
    const r = await fetch('/maze/enter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: token }) });
    if (r.ok) { location.reload(); return; }
    const p = await r.json().catch(() => ({}));
    say(p.error || 'the door would not open');
  } catch (_) { say('the door could not be reached'); }
})();
</script>
</body>
</html>`, { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

function door(wrong) {
  return new Response(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Lost in the Moss</title>
<link rel="icon" href="data:,">
<style>
  @font-face { font-family: "Freckle Face"; src: url("/maze/fonts/FreckleFace-Regular.woff2") format("woff2"); font-display: swap; }
  @font-face { font-family: "IM Fell English"; src: url("/maze/fonts/IMFellEnglish-Regular.woff2") format("woff2"); font-display: swap; }
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #10140f; color: #e9eee4; font-family: "IM Fell English", Georgia, "Times New Roman", serif; }
  body { display: flex; align-items: center; justify-content: center; padding: 16px; text-align: center;
    background: radial-gradient(120% 90% at 30% 0%, #26341c 0%, transparent 60%), radial-gradient(90% 80% at 85% 100%, #1c2a17 0%, transparent 65%), #10140f; }
  form { width: 100%; max-width: 420px; padding: 36px 32px; background: rgba(8, 12, 8, 0.42); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; }
  h1 { font-family: "Freckle Face", "IM Fell English", Georgia, serif; font-weight: 400; letter-spacing: 0.03em; font-size: clamp(32px, 9vw, 44px); line-height: 1.1; margin: 0 0 8px; }
  p { margin: 0 0 22px; font-size: 16px; color: #aab3a4; line-height: 1.6; }
  p.wrong { margin: 14px 0 0; color: #e0a48f; }
  p.notes { margin: 22px 0 0; }
  a { color: #d7dfd0; text-underline-offset: 3px; }
  a:hover { color: #fff; }
  input { width: 100%; padding: 13px 14px; font: inherit; font-size: 17px; letter-spacing: 0.08em; text-align: center; color: #e9eee4; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.3); border-radius: 3px; }
  input:focus { outline: 2px solid #c9d6b8; outline-offset: 2px; }
  button { margin-top: 12px; width: 100%; font: inherit; font-family: "Freckle Face", "IM Fell English", Georgia, serif; cursor: pointer; border: 1px solid rgba(255,255,255,0.35); background: rgba(236, 244, 226, 0.92); color: #15200f; padding: 13px 26px; font-size: 18px; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 3px; }
  button:hover { background: #fff; }
</style>
</head>
<body>
<form method="post" action="/maze/" autocomplete="off">
  <h1>Lost in the Moss</h1>
  <p>beta demo · it opens to those who know the word</p>
  <input type="password" name="word" aria-label="password" placeholder="password" autofocus required>
  <button type="submit">open</button>
  ${wrong ? '<p class="wrong">that is not the word</p>' : ''}
  <p class="notes">the <a href="/maze/notes">dev notes</a> are open for anyone to read</p>
</form>
</body>
</html>`, { status: wrong ? 403 : 401, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
