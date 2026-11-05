// The dev notes of Lost in the Moss: a board anyone can read, that anyone
// testing the game can add to, and that only the owner can change.
//
//   GET  /maze/notes-api/list          anyone      -> {notes, tester, owner}
//   GET  /maze/notes-api/shot/<id>     anyone      -> the picture
//   POST /maze/notes-api/post          a tester    form: kind, name, text, shot (up to three pictures) -> {note}
//   POST /maze/notes-api/owner         {key}       -> the owner's cookie
//   POST /maze/notes-api/leave                     -> puts it down again
//   POST /maze/notes-api/edit          the owner   {id, kind, text} -> {note}
//   POST /maze/notes-api/delete        the owner   {id} -> {ok}
//
// A tester is anyone holding the maze's cookie, which the gate one folder up
// checks and passes down as data.tester. A posted note cannot be changed or
// taken down by whoever posted it, nor by any other tester: there is no route
// for it without the owner's cookie.
//
// The owner's key is not in this file (the repo is public): the cookie holds
// a key derived from it, and OWNER_LOCK is the hash of that. It is a long
// random key, not a word, because a hash this public can be guessed at
// offline. To change it: OWNER_LOCK = sha256(sha256('moss-maze-owner:' + key)),
// hex, here or as MAZE_OWNER_LOCK in the Pages settings, which wins.
//
// Kept in the same KV namespace as the cloud saves (SAVES), under mazenotes:
//   mazenotes:n:<id>        one note, as JSON
//   mazenotes:s:<id>.<n>    one picture, its type in the key's metadata
//   mazenotes:all           every note in one read, rebuilt on every change
//   mazenotes:r:<who>       how many notes one address has posted lately

const OWNER_LOCK = '7e3a1d0761397edb85fbf64ab98cb390c4aab2bfce952c3403abdcda31edb506';
const OWNER_COOKIE = 'maze_owner';
const OWNER_AGE = 60 * 60 * 24 * 30;

const KINDS = ['comment', 'suggestion', 'request', 'idea'];
const MAX_TEXT = 2000;
const MAX_NAME = 40;
const MAX_SHOTS = 3;
const MAX_SHOT_BYTES = 2 * 1024 * 1024;
const MAX_NOTES = 1000;
const RATE = { posts: 12, seconds: 600 };   // per address

const P = 'mazenotes:';
const ID = /^[0-9a-z]{13}$/;
const SHOT = /^([0-9a-z]{13})\.([0-2])$/;

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }
});

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const ownerKey = key => sha256('moss-maze-owner:' + key.trim());

async function isOwner(request, env) {
  const held = (request.headers.get('cookie') || '').match(/(?:^|;\s*)maze_owner=([0-9a-f]{64})(?:;|$)/);
  return !!held && await sha256(held[1]) === (env.MAZE_OWNER_LOCK || OWNER_LOCK);
}

// what a picture is, read from its first bytes and not from what the upload says it is
function pictureType(b) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

// plain text only: no control characters but the line break, no runs of blank lines
const clean = (s, max) => String(s || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

async function listKeys(kv, prefix) {
  const names = []; let cursor;
  do {
    const page = await kv.list({ prefix, cursor });
    for (const k of page.keys) names.push(k.name);
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return names;
}

// Every note in one value, so that reading the board is one read. A list of keys can lag a
// minute behind a write, so the last copy is kept too: what was there and is not known to be
// gone stays, and what is known to be gone (the last few hundred taken down) stays out.
async function rebuild(kv, { put, gone } = {}) {
  const last = await kv.get(P + 'all', 'json') || { notes: [], gone: [] };
  const out = new Set(last.gone || []); if (gone) out.add(gone);
  const notes = new Map();
  for (const n of last.notes || []) notes.set(n.id, n);
  const names = await listKeys(kv, P + 'n:');
  for (let i = 0; i < names.length; i += 40) {
    const got = await Promise.all(names.slice(i, i + 40).map(k => kv.get(k, 'json')));
    for (const n of got) if (n && n.id) notes.set(n.id, n);
  }
  if (put) notes.set(put.id, put);
  for (const id of out) notes.delete(id);
  const all = { notes: [...notes.values()].sort((a, b) => (a.id < b.id ? 1 : -1)), gone: [...out].slice(-300) };
  await kv.put(P + 'all', JSON.stringify(all));
  return all;
}

export async function onRequest({ request, env, params, data }) {
  const kv = env.SAVES;
  if (!kv) return json({ error: 'the notes are not set up on this deployment (no KV binding)' }, 503);
  const route = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
  const method = request.method.toUpperCase();
  const tester = !!(data && data.tester);

  try {
    if (method === 'GET' && route === 'list') {
      const all = await kv.get(P + 'all', 'json') || { notes: [] };
      return json({ notes: all.notes || [], tester, owner: await isOwner(request, env) });
    }

    if (method === 'GET' && route.startsWith('shot/')) {
      const id = route.slice(5);
      if (!SHOT.test(id)) return json({ error: 'no such picture' }, 404);
      const { value, metadata } = await kv.getWithMetadata(P + 's:' + id, 'arrayBuffer');
      if (!value) return json({ error: 'no such picture' }, 404);
      return new Response(value, { headers: {
        'content-type': (metadata && metadata.type) || 'application/octet-stream',
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'",
        'content-disposition': 'inline'
      } });
    }

    if (method !== 'POST') return json({ error: 'no such route' }, 404);
    // a form on another site cannot post here in a visitor's name
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'not from here' }, 403);

    if (route === 'post') {
      if (!tester) return json({ error: 'open the maze with the word first, then leave your note' }, 401);
      if (Number(request.headers.get('content-length') || 0) > MAX_SHOTS * MAX_SHOT_BYTES + 64 * 1024) return json({ error: 'that is too much to send at once' }, 413);

      const who = P + 'r:' + (await sha256('who:' + (request.headers.get('cf-connecting-ip') || 'local'))).slice(0, 24);
      const sofar = Number(await kv.get(who)) || 0;
      if (sofar >= RATE.posts) return json({ error: 'that is a lot of notes at once: try again in a few minutes' }, 429);

      const form = await request.formData().catch(() => null);
      if (!form) return json({ error: 'the note did not arrive whole' }, 400);
      const kind = KINDS.includes(form.get('kind')) ? form.get('kind') : 'comment';
      const name = clean(form.get('name'), MAX_NAME).replace(/\n/g, ' ') || 'a walker';
      const text = clean(form.get('text'), MAX_TEXT);
      const files = form.getAll('shot').filter(f => f && typeof f === 'object' && f.size > 0);
      if (!text && !files.length) return json({ error: 'write something, or add a screenshot' }, 400);
      if (files.length > MAX_SHOTS) return json({ error: `up to ${MAX_SHOTS} screenshots in one note` }, 400);

      const shots = [];
      for (const f of files) {
        if (f.size > MAX_SHOT_BYTES) return json({ error: 'a screenshot is too large (2 MB at most)' }, 413);
        const bytes = new Uint8Array(await f.arrayBuffer());
        const type = pictureType(bytes);
        if (!type) return json({ error: 'screenshots have to be JPEG, PNG or WebP pictures' }, 415);
        shots.push({ bytes, type });
      }

      const all = await kv.get(P + 'all', 'json') || { notes: [] };
      if ((all.notes || []).length >= MAX_NOTES) return json({ error: 'the board is full' }, 507);

      const at = Date.now();
      const id = at.toString(36).padStart(9, '0') + [...crypto.getRandomValues(new Uint8Array(4))].map(b => (b % 36).toString(36)).join('');
      const note = { id, at, kind, name, text, shots: shots.map((s, i) => `${id}.${i}`) };
      await Promise.all(shots.map((s, i) => kv.put(P + 's:' + note.shots[i], s.bytes, { metadata: { type: s.type } })));
      await kv.put(P + 'n:' + id, JSON.stringify(note));
      await kv.put(who, String(sofar + 1), { expirationTtl: RATE.seconds });
      await rebuild(kv, { put: note });
      return json({ note });
    }

    if (route === 'owner') {
      const body = await request.json().catch(() => ({}));
      const key = await ownerKey(String(body.key || '').slice(0, 200));
      if (await sha256(key) !== (env.MAZE_OWNER_LOCK || OWNER_LOCK)) return json({ error: 'that is not the key' }, 403);
      return json({ ok: true }, 200, { 'set-cookie': `${OWNER_COOKIE}=${key}; Path=/maze; Max-Age=${OWNER_AGE}; HttpOnly; Secure; SameSite=Strict` });
    }
    if (route === 'leave') {
      return json({ ok: true }, 200, { 'set-cookie': `${OWNER_COOKIE}=; Path=/maze; Max-Age=0; HttpOnly; Secure; SameSite=Strict` });
    }

    // everything past here is the owner's alone
    if (route !== 'edit' && route !== 'delete') return json({ error: 'no such route' }, 404);
    if (!await isOwner(request, env)) return json({ error: 'only the owner can change a note' }, 403);
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || '');
    if (!ID.test(id)) return json({ error: 'no such note' }, 404);
    const note = await kv.get(P + 'n:' + id, 'json');
    if (!note) return json({ error: 'no such note' }, 404);

    if (route === 'edit') {
      const text = clean(body.text, MAX_TEXT);
      if (!text && !(note.shots || []).length) return json({ error: 'a note needs some words, or a screenshot' }, 400);
      note.text = text;
      if (KINDS.includes(body.kind)) note.kind = body.kind;
      note.edited = Date.now();
      await kv.put(P + 'n:' + id, JSON.stringify(note));
      await rebuild(kv, { put: note });
      return json({ note });
    }

    await Promise.all([kv.delete(P + 'n:' + id), ...(note.shots || []).map(s => kv.delete(P + 's:' + s))]);
    await rebuild(kv, { gone: id });
    return json({ ok: true });
  } catch (e) {
    return json({ error: 'the notes could not be reached just now' }, 500);
  }
}
