// The report box: where someone testing the game says what broke or what they wish for. Two sides, Bug Report and
// Suggestions, each with what to write, a big page to write it on, and room for three pictures. It takes the place of
// the dev notes board on the game's start and pause screens (owner, 2026-11-18). What is sent goes to the same place
// the board kept its notes (notes-api/), and can still be read by anyone on notes.html.
//
//   mountReport(element, { capture, onClose })  ->  { refresh }
//   capture, if given, returns a picture of what the camera sees

import { el, call, send, shrink } from './notes.js?v=7b0328a0';

const MAX_TEXT = 5000, MAX_SHOTS = 3;
const NAME_KEY = 'moss-maze-notes-name';
const SIDES = {
  bug: {
    tab: 'Bug Report', kind: 'bug', lead: 'Please describe:', marks: ['1', '2', '3'],
    points: ['Your issue', 'How you encountered it', 'What should be happening instead'],
    hint: 'Start typing...', strip: 'PLEASE ATTACH UP TO 3 SCREENSHOTS OF THE ISSUE!!', submit: 'Submit Issue', sent: 'Sent. Thank you for the report.',
  },
  idea: {
    tab: 'Suggestions', kind: 'suggestion', lead: 'Share your ideas:', marks: ['A', 'B', 'C'],
    points: ['Feature requests', 'Improvements', 'Creative ideas'],
    hint: 'Tell us your ideas...', strip: 'OPTIONAL: ATTACH IMAGES TO ILLUSTRATE YOUR SUGGESTION!!', submit: 'Submit Suggestion', sent: 'Sent. Thank you for the idea.',
  },
};

const CSS = `
.rp { --ink: #1c1c22; --quiet: #777a86; --blue: #5d62b5; --edge: #b9b9c2; width: min(440px, 100%); max-height: 100%; display: flex; flex-direction: column; text-align: left; color: var(--ink); background-color: #e9e9ec; background-image: radial-gradient(#cfcfd6 1px, transparent 1.4px); background-size: 22px 22px; border: 1px solid #f7f7f9; border-radius: 6px; box-shadow: 0 0 0 1px #8d8d98, 0 14px 40px rgba(0,0,0,0.55); font-family: "Monocraft", ui-monospace, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.45; text-shadow: none; overflow: hidden; }
.rp * { box-sizing: border-box; }
.rp button { font: inherit; letter-spacing: 0; text-transform: none; text-shadow: none; margin: 0; cursor: pointer; transform: none; transition: background 0.15s, color 0.15s; }
.rp button:hover:not(:disabled) { transform: none; }
.rp button:disabled { opacity: 0.5; cursor: default; }
.rp button:focus-visible, .rp textarea:focus-visible, .rp input:focus-visible, .rp a:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.rp-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 12px; background: #dcdce1; border-bottom: 1px solid var(--edge); font-size: 14px; }
.rp-head h2 { margin: 0; font: inherit; color: var(--ink); letter-spacing: 0; text-transform: none; }
.rp-close { padding: 3px 10px; font-size: 11px; color: #44444c; background: #f1f1f4; border: 1px solid #9a9aa5; border-radius: 4px; box-shadow: inset 0 -2px 0 #d0d0d7; }
.rp-close:hover:not(:disabled) { background: #fff; color: #000; }
.rp-body { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 20px 14px; display: flex; flex-direction: column; gap: 12px; }
.rp-sides { display: grid; grid-template-columns: 1fr 1fr; padding: 2px; background: #cfcfd6; border: 1px solid #a4a4ae; border-radius: 6px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.18); }
.rp-sides button { padding: 6px 8px; font-size: 12px; color: var(--quiet); background: transparent; border: 0; border-radius: 4px; }
.rp-sides button:hover:not(:disabled) { color: var(--ink); background: transparent; }
.rp-sides button[aria-pressed=true] { color: var(--ink); background: #fbfbfc; box-shadow: 0 1px 2px rgba(0,0,0,0.25); }
.rp-lead { margin: 0; font-size: 14px; }
.rp-points { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.rp-points li { display: flex; align-items: center; gap: 9px; }
.rp-points b { flex: none; width: 17px; height: 17px; display: grid; place-items: center; border-radius: 50%; font-size: 9px; font-weight: normal; color: #fff; background: var(--blue); }
.rp-idea .rp-points b { background: #8b8b93; }
.rp-page { position: relative; }
.rp textarea { display: block; width: 100%; min-height: 128px; resize: vertical; padding: 12px 14px 30px; font: inherit; color: var(--ink); background: #f1f1f3; border: 1px solid #a4a4ae; border-radius: 4px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.12); }
.rp ::placeholder { color: #9a9ca6; }
.rp-count { position: absolute; right: 9px; bottom: 8px; padding: 1px 8px; font-size: 10px; color: #55565f; background: #d3d3d9; border: 1px solid #a4a4ae; border-radius: 999px; pointer-events: none; }
.rp-count.rp-full { color: #a3261c; border-color: #a3261c; }
.rp-strip { overflow: hidden; white-space: nowrap; padding: 7px 0; font-size: 11px; color: var(--ink); background: #f4f4f6; border: 1px solid #a4a4ae; border-radius: 4px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.12); }
.rp-strip span { display: inline-block; white-space: pre; animation: rp-run 22s linear infinite; }
@keyframes rp-run { to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .rp-strip { white-space: normal; padding: 7px 10px; } .rp-strip span { padding-left: 0; animation: none; } }
.rp-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.rp-tile { position: relative; aspect-ratio: 4 / 3; padding: 0; color: #a1a1ab; font-size: 34px; line-height: 1; background: #dedee3; border: 1px solid #a4a4ae; border-radius: 6px; box-shadow: inset 0 -3px 0 #c6c6ce, 0 1px 0 #fff; overflow: hidden; }
.rp-tile:hover:not(:disabled) { background: #e8e8ec; color: var(--blue); }
.rp-tile img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.rp-tile i { position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; display: grid; place-items: center; font: 12px/1 Georgia, serif; font-style: normal; color: #fff; background: rgba(20,20,26,0.75); border-radius: 50%; }
.rp-extra { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.rp-extra input { flex: 1; min-width: 150px; padding: 6px 9px; font: inherit; font-size: 12px; color: var(--ink); background: #f1f1f3; border: 1px solid #a4a4ae; border-radius: 4px; }
.rp-small { padding: 5px 10px; font-size: 11px; color: #33343c; background: #f1f1f4; border: 1px solid #9a9aa5; border-radius: 4px; box-shadow: inset 0 -2px 0 #d0d0d7; }
.rp-small:hover:not(:disabled) { background: #fff; }
.rp-status { min-height: 18px; margin: 0; font-size: 12px; color: #3d6b35; }
.rp-status.rp-bad { color: #a3261c; }
.rp-quiet { margin: 0; font-size: 11px; color: var(--quiet); }
.rp-quiet a { color: var(--blue); text-underline-offset: 3px; }
.rp-submit { flex: none; width: 100%; padding: 13px 12px; font-size: 16px; color: #fff; background: linear-gradient(#6a6fc4, #4a4f9f); border: 0; border-top: 1px solid #3c407f; }
.rp-submit:hover:not(:disabled) { background: linear-gradient(#787dd4, #565bb0); }
.rp-word { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 20px; background: #dcdce1; border-top: 1px solid var(--edge); }
.rp-word input { flex: 1; min-width: 150px; padding: 8px 10px; font: inherit; color: var(--ink); background: #f7f7f9; border: 1px solid #a4a4ae; border-radius: 4px; }
.rp-word button { padding: 8px 14px; color: #fff; background: var(--blue); border: 0; border-radius: 4px; }
.rp-word p { flex-basis: 100%; }
.rp-word[hidden] { display: none; }
@media (pointer: coarse) {
  .rp-close, .rp-small, .rp-sides button, .rp-word button { min-height: 42px; }
  .rp-extra input, .rp-word input { min-height: 42px; }
  .rp textarea, .rp-extra input, .rp-word input { font-size: 16px; }
}
`;

export function mountReport(root, opts = {}) {
  if (!document.getElementById('rp-style')) document.head.append(el('style', { id: 'rp-style' }, CSS));
  const state = { side: 'bug', shots: [], tester: false, loaded: false, down: false, busy: false };

  let name = ''; try { name = localStorage.getItem(NAME_KEY) || ''; } catch { /* storage blocked */ }
  const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', multiple: true, hidden: true, onchange: e => { attach([...e.target.files]); e.target.value = ''; } });
  const title = el('h2', {}, 'Bug Report / Suggestions');
  const sides = el('div', { class: 'rp-sides', role: 'group', 'aria-label': 'what you are sending' },
    Object.entries(SIDES).map(([k, s]) => el('button', { type: 'button', 'data-side': k, onclick: () => { state.side = k; say(''); draw(); } }, s.tab)));
  const lead = el('p', { class: 'rp-lead' }), points = el('ul', { class: 'rp-points' });
  const text = el('textarea', { maxlength: MAX_TEXT, 'aria-label': 'what you want to say', oninput: () => drawCount() });
  const count = el('span', { class: 'rp-count' });
  const strip = el('span', {});
  const tiles = el('div', { class: 'rp-tiles' });
  const who = el('input', { type: 'text', maxlength: 40, placeholder: 'your name, if you like', 'aria-label': 'your name', value: name, autocomplete: 'nickname' });
  const status = el('p', { class: 'rp-status', role: 'status' });
  const submit = el('button', { type: 'submit', class: 'rp-submit' });
  const word = el('input', { type: 'password', 'aria-label': 'the password', placeholder: 'the password', autocomplete: 'off' });
  const wordBox = el('div', { class: 'rp-word', hidden: true },
    el('p', { class: 'rp-quiet' }, 'To send it, give the password the maze opens with.'), word,
    el('button', { type: 'button', onclick: unlock }, 'unlock'));
  word.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); unlock(); } });

  const box = el('form', { class: 'rp', novalidate: true, onsubmit: post, onpaste: e => { const pics = [...(e.clipboardData ? e.clipboardData.files : [])].filter(f => f.type.startsWith('image/')); if (pics.length) { e.preventDefault(); attach(pics); } } },
    el('div', { class: 'rp-head' }, title, opts.onClose && el('button', { type: 'button', class: 'rp-close', onclick: () => opts.onClose() }, 'CLOSE')),
    el('div', { class: 'rp-body' },
      sides,
      el('div', {}, lead, points),
      el('div', { class: 'rp-page' }, text, count),
      el('div', { class: 'rp-strip', 'aria-hidden': 'true' }, strip),
      tiles,
      el('div', { class: 'rp-extra' }, who, opts.capture && el('button', { type: 'button', class: 'rp-small', onclick: async () => { try { attach([await opts.capture()]); } catch { say('the camera gave no picture', true); } } }, 'add the game view')),
      status,
      el('p', { class: 'rp-quiet' }, 'Anyone can read what is sent: ', el('a', { href: new URL('notes.html', import.meta.url).href, target: '_blank', rel: 'noopener' }, 'see what others have said'), '.'),
      file),
    wordBox, submit);
  root.replaceChildren(box);

  function say(msg, bad) { status.textContent = msg || ''; status.classList.toggle('rp-bad', !!bad); }
  function drawCount() { const n = text.value.length; count.textContent = `${n}/${MAX_TEXT}`; count.classList.toggle('rp-full', n >= MAX_TEXT); }
  function drawTiles() {
    tiles.replaceChildren(...Array.from({ length: MAX_SHOTS }, (_, i) => {
      const s = state.shots[i];
      return s
        ? el('button', { type: 'button', class: 'rp-tile', 'aria-label': `take picture ${i + 1} off`, onclick: () => { URL.revokeObjectURL(s.url); state.shots.splice(i, 1); drawTiles(); } }, el('img', { src: s.url, alt: '' }), el('i', {}, '×'))
        : el('button', { type: 'button', class: 'rp-tile', 'aria-label': 'add a picture', onclick: () => file.click() }, '+');
    }));
  }
  async function attach(blobs) {
    for (const b of blobs) {
      if (!b) continue;
      if (state.shots.length >= MAX_SHOTS) { say(`up to ${MAX_SHOTS} pictures`, true); break; }
      const small = await shrink(b);
      state.shots.push({ blob: small, url: URL.createObjectURL(small) });
    }
    drawTiles();
  }
  function draw() {
    const s = SIDES[state.side];
    box.classList.toggle('rp-idea', state.side === 'idea');
    sides.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.side === state.side)));
    lead.textContent = s.lead;
    points.replaceChildren(...s.points.map((p, i) => el('li', {}, el('b', {}, s.marks[i]), p)));
    text.placeholder = s.hint; strip.textContent = (s.strip + '        ').repeat(4);   // two halves the same, so the loop has no seam
    submit.textContent = state.busy ? 'Sending...' : s.submit;
    const locked = state.loaded && !state.down && !state.tester;
    wordBox.hidden = !locked;
    submit.disabled = state.busy || !state.loaded || state.down || locked;
    drawCount();
  }
  async function unlock() {
    if (!word.value) { word.focus(); return; }
    try { await send('word', { word: word.value }); word.value = ''; say(''); await refresh(); }
    catch (err) { say(err.message, true); word.select(); }
  }
  async function post(e) {
    e.preventDefault();
    if (state.busy || submit.disabled) return;
    const body = text.value.trim(), s = SIDES[state.side];
    if (!body && !state.shots.length) { say('Write something first, or add a picture.', true); text.focus(); return; }
    const form = new FormData();
    form.set('kind', s.kind); form.set('name', who.value); form.set('text', body);
    state.shots.forEach((x, i) => form.append('shot', x.blob, `shot${i}.jpg`));
    state.busy = true; draw(); say('');
    try {
      await call('post', { method: 'POST', body: form });
      try { localStorage.setItem(NAME_KEY, who.value.trim()); } catch { /* storage blocked */ }
      state.shots.forEach(x => URL.revokeObjectURL(x.url)); state.shots = [];
      text.value = ''; drawTiles(); say(s.sent);
    } catch (err) { say(err.message, true); }
    state.busy = false; draw();
  }
  async function refresh() {
    try { const got = await call('list'); state.tester = !!got.tester; state.down = false; }
    catch { state.down = true; say('The report box cannot be reached from here right now. Try again in a moment.', true); }
    state.loaded = true; draw();
  }
  drawTiles(); draw(); refresh();
  return { refresh };
}
