// Lost in the Moss (the 3D moss maze) is a beta, and it sits behind a word.
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
// Cloudflare Pages Function: middleware for /maze/*

const LOCK = 'ad5ff21ea92f7fb7acbb11e9880df8db67f96a480f52549a3e274f602833e773';
const COOKIE = 'maze_beta';
const MAX_AGE = 60 * 60 * 24 * 30;
const POLICY = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' blob: data:; img-src 'self' data: blob:; media-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'";

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

export async function onRequest({ request, next, data }) {
  const path = new URL(request.url).pathname;
  const held = (request.headers.get('cookie') || '').match(/(?:^|;\s*)maze_beta=([0-9a-f]{64})(?:;|$)/);
  const tester = !!held && await sha256(held[1]) === LOCK;

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
        'set-cookie': `${COOKIE}=${key}; Path=/maze; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
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
