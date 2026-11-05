// The dev notes board: comments, suggestions, requests and ideas from the people testing the game, with their screenshots.
// Anyone can read it. Anyone who has opened the maze with the word can add to it. Only the owner can change a note or
// take one down. One board, shown in two places: its own page (notes.html, open to anyone) and the game's start and
// pause screens. The notes themselves are kept by the site (notes-api/, beside this file).
//
//   mountNotes(element, { capture })  ->  { refresh }
//   capture, if given, returns a picture of what the camera sees (the game passes it; the page has no camera)

const API = new URL('notes-api/', import.meta.url);
const DOOR = new URL('./', import.meta.url);
const KINDS = ['comment', 'suggestion', 'request', 'idea'];
const MAX_SHOTS = 3;
const NAME_KEY = 'moss-maze-notes-name';

const CSS = `
.nb { text-align: left; color: #d7dfd0; font-size: 16px; line-height: 1.5; }
.nb * { box-sizing: border-box; }
.nb button { font-family: "Freckle Face", "IM Fell English", Georgia, serif; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; margin: 0; padding: 8px 14px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.3); background: transparent; color: #d7dfd0; transition: background 0.2s, color 0.2s; transform: none; }
.nb button:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: #fff; transform: none; }
.nb button:disabled { opacity: 0.45; cursor: default; }
.nb button:focus-visible, .nb input:focus-visible, .nb textarea:focus-visible, .nb a:focus-visible { outline: 2px solid #c9d6b8; outline-offset: 2px; }
.nb button.nb-main { background: rgba(236, 244, 226, 0.92); color: #15200f; border-color: rgba(255,255,255,0.35); }
.nb button.nb-main:hover:not(:disabled) { background: #fff; color: #15200f; }
.nb button.nb-warn { border-color: #e0a48f; color: #e0a48f; }
.nb button.nb-link { border: 0; padding: 0; font: inherit; font-size: 13px; letter-spacing: 0; text-transform: none; color: #8f9a8a; text-decoration: underline; text-underline-offset: 3px; background: none; }
.nb button.nb-link:hover:not(:disabled) { background: none; color: #d7dfd0; }
.nb a { color: #d7dfd0; text-underline-offset: 3px; }
.nb input[type=text], .nb input[type=password], .nb textarea { width: 100%; font: inherit; font-size: 16px; color: #e9eee4; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.25); border-radius: 3px; padding: 9px 11px; }
.nb textarea { min-height: 96px; resize: vertical; display: block; }
.nb ::placeholder { color: #7f8a7a; }
.nb-form { display: flex; flex-direction: column; gap: 10px; padding: 14px 0 18px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.nb-kinds, .nb-filter, .nb-row, .nb-attach, .nb-own { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.nb-kinds label { cursor: pointer; }
.nb-kinds input { position: absolute; opacity: 0; pointer-events: none; }
.nb-kinds span, .nb-filter button { display: inline-block; padding: 5px 12px; border: 1px solid rgba(255,255,255,0.22); border-radius: 999px; font-family: inherit; font-size: 14px; letter-spacing: 0; text-transform: none; color: #aab3a4; background: transparent; }
.nb-kinds input:checked + span, .nb-filter button[aria-pressed=true] { background: rgba(236, 244, 226, 0.92); color: #15200f; border-color: transparent; }
.nb-kinds input:focus-visible + span { outline: 2px solid #c9d6b8; outline-offset: 2px; }
.nb-filter button:hover:not(:disabled) { color: #fff; }
.nb-filter button[aria-pressed=true]:hover { background: #fff; color: #15200f; }
.nb-quiet { font-size: 14px; color: #8f9a8a; }
.nb-status { font-size: 14px; color: #aab3a4; }
.nb-status.nb-bad { color: #e0a48f; }
.nb-thumbs { display: flex; flex-wrap: wrap; gap: 8px; }
.nb-thumbs:empty { display: none; }
.nb-thumb { position: relative; }
.nb-thumb img { display: block; height: 72px; width: auto; max-width: 140px; object-fit: cover; border-radius: 3px; border: 1px solid rgba(255,255,255,0.2); }
.nb-thumb button { position: absolute; top: -7px; right: -7px; width: 22px; height: 22px; padding: 0; border-radius: 50%; background: #10140f; font: 13px/1 Georgia, serif; letter-spacing: 0; }
.nb-filter { padding: 14px 0 2px; }
.nb-note { padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
.nb-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; font-size: 14px; color: #8f9a8a; }
.nb-kind { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; }
.nb-kind::before { content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px; background: currentColor; }
.nb-k-comment { color: #aab3a4; } .nb-k-suggestion { color: #b5cf8f; } .nb-k-request { color: #e0c08f; } .nb-k-idea { color: #a9c6d6; }
.nb-who { color: #d7dfd0; }
.nb-body { margin: 6px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.nb-shots { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.nb-shots img { display: block; height: 120px; width: auto; max-width: 100%; object-fit: cover; border-radius: 3px; border: 1px solid rgba(255,255,255,0.15); }
.nb-shots a:hover img { border-color: rgba(255,255,255,0.5); }
.nb-own { margin-top: 10px; }
.nb-own button { font-size: 12px; padding: 5px 10px; }
.nb-edit { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.nb-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding-top: 16px; font-size: 13px; color: #8f9a8a; }
.nb-foot input { width: auto; flex: 1; min-width: 150px; }
`;

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid);
  return e;
}

const day = at => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toLowerCase();

async function call(route, init) {
  let res, body = {};
  try { res = await fetch(new URL(route, API), { credentials: 'same-origin', ...init }); body = await res.json(); }
  catch { throw new Error('the notes could not be reached'); }
  if (!res.ok) throw new Error(body.error || 'the notes could not be reached');
  return body;
}
const send = (route, data) => call(route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data || {}) });

// a phone's photo or a full-screen grab is far bigger than a note needs: bring it down to 1600 across, as a JPEG
async function shrink(blob) {
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    if (k === 1 && blob.size <= 500 * 1024 && /^image\/(jpeg|png|webp)$/.test(blob.type)) return blob;
    const c = el('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(done => c.toBlob(done, 'image/jpeg', 0.82)) || blob;
  } catch { return blob; }
}

export function mountNotes(root, opts = {}) {
  if (!document.getElementById('nb-style')) document.head.append(el('style', { id: 'nb-style' }, CSS));
  const state = { notes: [], tester: false, owner: false, loaded: false, filter: 'all', shots: [], editing: null, asking: null, keyOpen: false };
  const formBox = el('div'), filterBox = el('div', { class: 'nb-filter' }), listBox = el('div'), footBox = el('div', { class: 'nb-foot' });
  root.replaceChildren(el('div', { class: 'nb' }, formBox, filterBox, listBox, footBox));

  // --- leaving a note
  let form = null, status = null, thumbs = null, count = null;
  function say(text, bad) { if (status) { status.textContent = text; status.classList.toggle('nb-bad', !!bad); } }
  function drawShots() {
    if (!thumbs) return;
    thumbs.replaceChildren(...state.shots.map((s, i) => el('div', { class: 'nb-thumb' },
      el('img', { src: s.url, alt: 'screenshot ' + (i + 1) }),
      el('button', { type: 'button', 'aria-label': 'take screenshot ' + (i + 1) + ' off', onclick: () => { URL.revokeObjectURL(s.url); state.shots.splice(i, 1); drawShots(); } }, '×'))));
    count.textContent = state.shots.length ? `${state.shots.length} of ${MAX_SHOTS}` : `up to ${MAX_SHOTS}, or paste one in`;
  }
  async function attach(blobs) {
    for (const b of blobs) {
      if (!b) continue;
      if (state.shots.length >= MAX_SHOTS) { say(`up to ${MAX_SHOTS} screenshots in one note`, true); break; }
      const small = await shrink(b);
      state.shots.push({ blob: small, url: URL.createObjectURL(small) });
    }
    drawShots();
  }
  function drawForm() {
    if (!state.loaded) { formBox.replaceChildren(); form = null; return; }
    if (!state.tester) {
      form = null;
      formBox.replaceChildren(el('p', { class: 'nb-quiet' }, 'Anyone can read these. To leave a note of your own, ', el('a', { href: DOOR.href }, 'open the maze'), ' with the word first.'));
      return;
    }
    if (form) return;   // already there: keep whatever is half written
    let name = ''; try { name = localStorage.getItem(NAME_KEY) || ''; } catch { /* storage blocked */ }
    const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', multiple: true, hidden: true, onchange: e => { attach([...e.target.files]); e.target.value = ''; } });
    status = el('span', { class: 'nb-status', role: 'status' });
    thumbs = el('div', { class: 'nb-thumbs' });
    count = el('span', { class: 'nb-quiet' });
    form = el('form', { class: 'nb-form', onsubmit: post, onpaste: e => { const pics = [...(e.clipboardData ? e.clipboardData.files : [])].filter(f => f.type.startsWith('image/')); if (pics.length) { e.preventDefault(); attach(pics); } } },
      el('div', { class: 'nb-kinds', role: 'radiogroup', 'aria-label': 'what kind of note' }, KINDS.map((k, i) => el('label', {}, el('input', { type: 'radio', name: 'kind', value: k, checked: i === 0 }), el('span', {}, k)))),
      el('textarea', { name: 'text', maxlength: 2000, placeholder: 'what did you see, want, or think of?', 'aria-label': 'your note' }),
      el('input', { type: 'text', name: 'name', maxlength: 40, placeholder: 'your name, if you like', 'aria-label': 'your name', value: name, autocomplete: 'nickname' }),
      el('div', { class: 'nb-attach' },
        el('button', { type: 'button', onclick: () => file.click() }, 'add a screenshot'),
        opts.capture && el('button', { type: 'button', onclick: async () => attach([await opts.capture()]) }, 'add what the camera sees'),
        count, file),
      thumbs,
      el('div', { class: 'nb-row' }, el('button', { type: 'submit', class: 'nb-main' }, 'leave the note'), status));
    formBox.replaceChildren(form);
    drawShots();
  }
  async function post(e) {
    e.preventDefault();
    const text = form.elements.text.value.trim();
    if (!text && !state.shots.length) { say('write something, or add a screenshot', true); return; }
    const body = new FormData();
    body.set('kind', form.elements.kind.value); body.set('name', form.elements.name.value); body.set('text', text);
    state.shots.forEach((s, i) => body.append('shot', s.blob, `shot${i}.jpg`));
    const button = form.querySelector('.nb-main'); button.disabled = true; say('leaving it');
    try {
      const { note } = await call('post', { method: 'POST', body });
      try { localStorage.setItem(NAME_KEY, form.elements.name.value.trim()); } catch { /* storage blocked */ }
      state.notes = [note, ...state.notes.filter(n => n.id !== note.id)];
      state.shots.forEach(s => URL.revokeObjectURL(s.url)); state.shots = [];
      form.elements.text.value = ''; drawShots(); state.filter = 'all'; drawList();
      say('left. thank you');
    } catch (err) { say(err.message, true); }
    button.disabled = false;
  }

  // --- reading them
  function drawList() {
    const counts = Object.fromEntries(KINDS.map(k => [k, state.notes.filter(n => n.kind === k).length]));
    filterBox.replaceChildren(...(state.notes.length ? ['all', ...KINDS.filter(k => counts[k])] : []).map(k =>
      el('button', { type: 'button', 'aria-pressed': String(state.filter === k), onclick: () => { state.filter = k; drawList(); } }, k === 'all' ? `all ${state.notes.length}` : `${k} ${counts[k]}`)));
    const shown = state.notes.filter(n => state.filter === 'all' || n.kind === state.filter);
    if (!state.loaded) { listBox.replaceChildren(el('p', { class: 'nb-quiet' }, 'opening the notes')); return; }
    if (!shown.length) { listBox.replaceChildren(el('p', { class: 'nb-quiet' }, state.error || 'no notes yet.')); return; }
    listBox.replaceChildren(...shown.map(drawNote));
  }
  function drawNote(n) {
    const head = el('div', { class: 'nb-head' },
      el('span', { class: 'nb-kind nb-k-' + n.kind }, n.kind), el('span', { class: 'nb-who' }, n.name), el('time', { datetime: new Date(n.at).toISOString() }, day(n.at)),
      n.edited && el('span', {}, 'edited by the owner'));
    const shots = (n.shots || []).length ? el('div', { class: 'nb-shots' }, n.shots.map((s, i) => {
      const src = new URL('shot/' + s, API).href;
      return el('a', { href: src, target: '_blank', rel: 'noopener' }, el('img', { src, loading: 'lazy', alt: `screenshot ${i + 1} from ${n.name}` }));
    })) : null;
    if (state.owner && state.editing === n.id) {
      const text = el('textarea', { maxlength: 2000, 'aria-label': 'the note' }); text.value = n.text;
      const kinds = el('div', { class: 'nb-kinds' }, KINDS.map(k => el('label', {}, el('input', { type: 'radio', name: 'edit-kind-' + n.id, value: k, checked: k === n.kind }), el('span', {}, k))));
      const msg = el('span', { class: 'nb-status nb-bad' });
      const save = async () => {
        try {
          const { note } = await send('edit', { id: n.id, text: text.value, kind: kinds.querySelector('input:checked').value });
          state.notes = state.notes.map(x => x.id === note.id ? note : x); state.editing = null; drawList();
        } catch (err) { msg.textContent = err.message; }
      };
      return el('article', { class: 'nb-note' }, head, el('div', { class: 'nb-edit' }, kinds, text,
        el('div', { class: 'nb-row' }, el('button', { type: 'button', class: 'nb-main', onclick: save }, 'save'), el('button', { type: 'button', onclick: () => { state.editing = null; drawList(); } }, 'cancel'), msg)), shots);
    }
    const own = state.owner && el('div', { class: 'nb-own' }, state.asking === n.id
      ? [el('button', { type: 'button', class: 'nb-warn', onclick: async () => {
          try { await send('delete', { id: n.id }); state.notes = state.notes.filter(x => x.id !== n.id); } catch (err) { state.error = err.message; }
          state.asking = null; drawList();
        } }, 'yes, delete it'), el('button', { type: 'button', onclick: () => { state.asking = null; drawList(); } }, 'keep it')]
      : [el('button', { type: 'button', onclick: () => { state.editing = n.id; state.asking = null; drawList(); } }, 'edit'), el('button', { type: 'button', onclick: () => { state.asking = n.id; drawList(); } }, 'delete')]);
    return el('article', { class: 'nb-note' }, head, n.text && el('p', { class: 'nb-body' }, n.text), shots, own);
  }

  // --- the owner's key
  function drawFoot() {
    if (!state.loaded) { footBox.replaceChildren(); return; }
    if (state.owner) {
      footBox.replaceChildren('you are here as the owner: you can edit and delete.', el('button', { type: 'button', class: 'nb-link', onclick: async () => { try { await send('leave'); } catch { /* still signed out below */ } state.editing = state.asking = null; refresh(); } }, 'put the key down'));
      return;
    }
    if (!state.keyOpen) { footBox.replaceChildren(el('button', { type: 'button', class: 'nb-link', onclick: () => { state.keyOpen = true; drawFoot(); footBox.querySelector('input').focus(); } }, 'owner')); return; }
    const key = el('input', { type: 'password', 'aria-label': "the owner's key", placeholder: "the owner's key", autocomplete: 'current-password' });
    const msg = el('span', { class: 'nb-status nb-bad' });
    footBox.replaceChildren(el('form', { class: 'nb-row', style: 'flex:1', onsubmit: async e => {
      e.preventDefault();
      try { await send('owner', { key: key.value }); state.keyOpen = false; refresh(); } catch (err) { msg.textContent = err.message; }
    } }, key, el('button', { type: 'submit' }, 'unlock'), el('button', { type: 'button', class: 'nb-link', onclick: () => { state.keyOpen = false; drawFoot(); } }, 'never mind'), msg));
  }

  async function refresh() {
    try {
      const got = await call('list');
      state.notes = got.notes || []; state.tester = !!got.tester; state.owner = !!got.owner; state.error = '';
    } catch (err) { state.error = err.message; }
    state.loaded = true;
    drawForm(); drawList(); drawFoot();
  }
  drawList(); refresh();
  return { refresh };
}
