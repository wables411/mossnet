// The journal: a Book and Quill, the way Minecraft's Java Edition has one.
// An open book, text typed straight onto the page (word-wrapped at the page's
// width, a blinking cursor), page arrows at the bottom corners, up to 100
// pages, Sign and Done under the book. Signing asks for a title and turns it
// into a Written Book, read-only, with a title page; the journal then holds
// the signed book and a fresh Book and Quill. The book, its arrows and the
// buttons are drawn here in code (no textures of Mojang's); the pixel font is
// Monocraft (SIL OFL, see fonts/). Everything is kept in localStorage.
//
// The book has to be found first: `found` is false until the pickup in maze 1
// is walked over, and the whole UI stays hidden until then.
const KEY = 'moss-maze-book-v1';
export const COLS = 19;         // characters across a page (114 px at 6 px a glyph)
export const LINES = 14;        // lines down a page (128 px at 9 px a line)
export const MAX_CHARS = 1024;  // the game's per-page limit
export const MAX_PAGES = 100;
export const TITLE_MAX = 16;

// --- the page layout, in the book's own pixels (the book is 146 x 180)
const BOOK_W = 146, BOOK_H = 180, TEXT_X = 20, TEXT_Y = 30, TEXT_W = 114, LINE_H = 9;

// word wrap the way the game does it: break at the last space on the line (the space is swallowed),
// or mid-word when a word is longer than a line; a newline always breaks. Returns [{start, end}].
export function wrapText(text, cols = COLS) {
  const lines = [];
  let lineStart = 0, lineLen = 0, lastSpace = -1;
  const n = text.length;
  for (let i = 0; i <= n; i++) {
    const ch = i < n ? text[i] : '\n';
    if (ch === '\n') { lines.push({ start: lineStart, end: i, hard: false }); lineStart = i + 1; lineLen = 0; lastSpace = -1; continue; }
    if (lineLen === cols) {
      if (ch === ' ') { lines.push({ start: lineStart, end: i, hard: false }); lineStart = i + 1; lineLen = 0; lastSpace = -1; continue; }
      if (lastSpace >= 0) { lines.push({ start: lineStart, end: lastSpace, hard: false }); lineStart = lastSpace + 1; lineLen = i - lineStart; lastSpace = -1; }
      else { lines.push({ start: lineStart, end: i, hard: true }); lineStart = i; lineLen = 0; }
    }
    if (ch === ' ') lastSpace = i;
    lineLen++;
  }
  return lines;
}
export function fits(text) { return text.length <= MAX_CHARS && wrapText(text).length <= LINES; }

// where a caret at character index `c` sits: line and column
function caretPos(lines, c) {
  let best = lines[0], bi = 0;
  for (let i = 0; i < lines.length; i++) { const l = lines[i]; if (c >= l.start && c <= l.end) { best = l; bi = i; } }
  return { line: bi, col: c - best.start };
}

const clean = s => String(s || '').replace(/\r\n?/g, '\n').replace(/[^\S\n ]|[\u0000-\u0008\u000b-\u001f\u007f]/g, m => (m === '\t' ? ' ' : ''));

function fresh() { return { found: false, quill: { pages: [''], page: 0 }, signed: [], view: null }; }
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return Object.assign(fresh(), s, { quill: Object.assign({ pages: [''], page: 0 }, s.quill || {}) }); }
  catch { return fresh(); }
}

// --- the pixel art: the open book, drawn once at 1 px = 1 book pixel and scaled with image-rendering: pixelated
function drawBook(cv) {
  cv.width = BOOK_W; cv.height = BOOK_H;
  const g = cv.getContext('2d');
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  // a hash for the parchment's grain, the same every time
  const h2 = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };
  // the leather cover, rounded by leaving the corner pixels out
  rect(1, 0, BOOK_W - 2, BOOK_H, '#2a1810'); rect(0, 1, BOOK_W, BOOK_H - 2, '#2a1810');
  rect(2, 1, BOOK_W - 4, BOOK_H - 2, '#8f4a37'); rect(1, 2, BOOK_W - 2, BOOK_H - 4, '#8f4a37');
  rect(2, 1, BOOK_W - 4, 1, '#a65b45'); rect(1, 2, 1, BOOK_H - 4, '#a65b45');            // light catches the top and left
  rect(2, BOOK_H - 2, BOOK_W - 4, 1, '#6b3323'); rect(BOOK_W - 2, 2, 1, BOOK_H - 4, '#6b3323');
  for (let y = 1; y < BOOK_H - 1; y++) for (let x = 1; x < BOOK_W - 1; x++) if (h2(x, y) < 0.08 && (x < 5 || x > BOOK_W - 6 || y < 5 || y > BOOK_H - 6)) px(x, y, h2(x + 7, y) < 0.5 ? '#9a543f' : '#7f4130');
  // the pages: a block of parchment, with the stacked page edges showing on the right and bottom
  const P = { x: 5, y: 4, w: BOOK_W - 10, h: BOOK_H - 9 };
  rect(P.x, P.y, P.w, P.h, '#d9c9a5');
  rect(P.x, P.y, P.w - 1, P.h - 1, '#e6d8b5');
  rect(P.x, P.y, P.w - 2, P.h - 2, '#eee2c2');
  rect(P.x, P.y, P.w - 3, P.h - 3, '#f3e9cd');
  for (let y = P.y; y < P.y + P.h - 3; y++) for (let x = P.x; x < P.x + P.w - 3; x++) {
    const r = h2(x, y);
    if (r < 0.018) px(x, y, '#ecdfc0'); else if (r > 0.975) px(x, y, '#f7eed6');
  }
  // the gutter: the left edge of the page is bound with red thread, a loop every nine pixels
  rect(P.x, P.y, 11, P.h - 3, '#ead9b3');
  rect(P.x + 10, P.y, 1, P.h - 3, '#e0cfa8');
  for (let y = P.y + 6; y < P.y + P.h - 8; y += 11) {
    const c = '#c0392b', d = '#8e2a1f';
    px(P.x + 4, y, c); px(P.x + 3, y + 1, c); px(P.x + 3, y + 2, c); px(P.x + 3, y + 3, c); px(P.x + 4, y + 4, c);
    px(P.x + 5, y, d); px(P.x + 5, y + 4, d);
    px(P.x + 2, y + 2, '#d9c9a5');
  }
  // the book's own edge inside the gutter, and a dog-ear's shadow at the bottom right
  rect(P.x, P.y, 1, P.h - 3, '#cdb98f');
  for (let i = 0; i < 6; i++) { px(P.x + P.w - 4 - i, P.y + P.h - 4, '#e0cfa8'); px(P.x + P.w - 4, P.y + P.h - 4 - i, '#e0cfa8'); }
}
// a page-turn arrow, 23 x 13, pointing right; the left one is the same mirrored by CSS
function drawArrow(cv, lit) {
  cv.width = 23; cv.height = 13;
  const g = cv.getContext('2d');
  const body = lit ? '#f0e4b8' : '#6e5a35', edge = lit ? '#9c8450' : '#2e2414', shine = lit ? '#fff8dc' : '#8a7446';
  const rows = [
    '..............XX.......',
    '..............XXX......',
    '..............XXXX.....',
    '..XXXXXXXXXXXXXXXXX....',
    '..XXXXXXXXXXXXXXXXXX...',
    '..XXXXXXXXXXXXXXXXXXX..',
    '..XXXXXXXXXXXXXXXXXXXX.',
    '..XXXXXXXXXXXXXXXXXXX..',
    '..XXXXXXXXXXXXXXXXXX...',
    '..XXXXXXXXXXXXXXXXX....',
    '..............XXXX.....',
    '..............XXX......',
    '..............XX.......',
  ];
  const at = (x, y) => y >= 0 && y < 13 && x >= 0 && x < 23 && rows[y][x] === 'X';
  for (let y = 0; y < 13; y++) for (let x = 0; x < 23; x++) {
    if (!at(x, y)) continue;
    const inner = at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1);
    g.fillStyle = !inner ? edge : (y === 4 || (y === 3 && x < 14)) ? shine : body;
    g.fillRect(x, y, 1, 1);
  }
}
// a closed book, 16 x 16, for the touch button
export function drawBookIcon(cv) {
  cv.width = 16; cv.height = 16;
  const g = cv.getContext('2d');
  const rows = [
    '................',
    '....aaaaaaaaaa..',
    '...abbbbbbbbbba.',
    '...abbbbbbbbbba.',
    '...abbbbbbbbbba.',
    '...abbbbbbbbbba.',
    '...abbbbbbbbbba.',
    '...abbbbbbbbbba.',
    '...abbbbbbbbbba.',
    '...abbbbbbbbbba.',
    '...abbbbbbbbbba.',
    '...abbbbbbbbbba.',
    '...acccccccccca.',
    '...acccccccccca.',
    '....aaaaaaaaaa..',
    '................',
  ];
  const col = { a: '#2a1810', b: '#8f4a37', c: '#f3e9cd' };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = rows[y][x]; if (col[k]) { g.fillStyle = col[k]; g.fillRect(x, y, 1, 1); } }
  g.fillStyle = '#a65b45'; g.fillRect(5, 2, 1, 10);
  g.fillStyle = '#e8dcb8'; g.fillRect(6, 4, 7, 1); g.fillRect(6, 6, 7, 1);
}

export class Book {
  // $: querySelector; opts: { author(): string, sound: { page(), sign(), open(), close() }, onClose(from) }
  constructor($, opts = {}) {
    this.$ = $; this.opts = opts;
    this.state = load();
    this.view = this.state.view || { kind: 'quill', page: 0 };
    this.from = null; this.isOpen = false;
    this.onClose = opts.onClose || null;
    this.lastValue = ''; this.lastSel = 0;
    drawBook($('#bq-book-art'));
    drawArrow($('#bq-prev-art'), false); drawArrow($('#bq-prev-lit'), true);
    drawArrow($('#bq-next-art'), false); drawArrow($('#bq-next-lit'), true);
    const ta = this.ta = $('#bq-input');
    ta.addEventListener('input', () => this.typed());
    ta.addEventListener('keydown', e => { if (e.key === 'Tab') e.preventDefault(); });
    for (const ev of ['keyup', 'click', 'select', 'focus', 'blur']) ta.addEventListener(ev, () => this.renderCaret());
    // on phones the page says where to tap until it has been tapped (the keyboard only comes up for a tap)
    this.coarse = matchMedia('(pointer: coarse)').matches;
    ta.addEventListener('focus', () => this.renderHint()); ta.addEventListener('blur', () => this.renderHint());
    document.addEventListener('selectionchange', () => { if (this.isOpen && document.activeElement === ta) this.renderCaret(); });
    const ti = this.ti = $('#bq-title');
    ti.addEventListener('input', () => { ti.value = clean(ti.value).replace(/\n/g, '').slice(0, TITLE_MAX); this.renderSign(); });
    ti.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.signAndClose(); } });
    $('#bq-prev').addEventListener('click', () => this.turn(-1));
    $('#bq-next').addEventListener('click', () => this.turn(1));
    $('#bq-signbtn').addEventListener('click', () => this.beginSign());
    $('#bq-done').addEventListener('click', () => this.close());
    $('#bq-close').addEventListener('click', () => this.close());
    $('#bq-cancel').addEventListener('click', () => this.cancelSign());
    $('#bq-signclose').addEventListener('click', () => this.signAndClose());
    // Escape backs out of signing, else closes the book (wherever the focus is: the page, a button, nowhere)
    window.addEventListener('keydown', e => { if (this.isOpen && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.view.kind === 'sign' ? this.cancelSign() : this.close(); } }, true);
    const refit = () => { if (this.isOpen) this.fit(); };
    addEventListener('resize', refit);
    if (window.visualViewport) { visualViewport.addEventListener('resize', refit); visualViewport.addEventListener('scroll', refit); }
  }

  get found() { return !!this.state.found; }
  save() { this.state.view = this.view; try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* storage blocked */ } }
  // the pickup was walked over: from now on the book is in the journal
  find() { if (this.state.found) return false; this.state.found = true; this.save(); return true; }

  // --- the scale: quarter steps of the book's pixel, as large as the screen allows, never under 1 : 1
  fit() {
    const vv = window.visualViewport;
    const vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight;
    const root = this.$('#book'), bq = this.$('#bq');
    root.style.height = vh + 'px'; root.style.top = (vv ? vv.offsetTop : 0) + 'px';
    let s = Math.max(1, Math.min(3, Math.floor(Math.min((vw - 16) / 200, (vh - 16) / (BOOK_H + 44)) * 4) / 4));
    root.style.setProperty('--s', s);
    // the shelf of signed books takes what it takes: step down until all of it is on the screen
    while (s > 1 && bq.offsetHeight > vh - 16) { s -= 0.25; root.style.setProperty('--s', s); }
  }

  // --- open and close
  open(from = 'playing') {
    if (!this.state.found) return false;
    this.from = from; this.isOpen = true;
    document.body.classList.add('book');
    this.fit();
    if (this.view.kind === 'sign') this.view = { kind: 'quill', page: this.state.quill.page };
    if (this.view.kind === 'read' && !this.state.signed[this.view.book]) this.view = { kind: 'quill', page: 0 };
    this.show();
    // the page takes the keyboard (after the key that opened the book has gone by); on phones a tap on the page does
    if (this.view.kind === 'quill' && !matchMedia('(pointer: coarse)').matches) setTimeout(() => this.focusPage(), 0);
    if (this.opts.sound && this.opts.sound.open) this.opts.sound.open();
    return true;
  }
  close() {
    if (!this.isOpen) return;
    if (this.view.kind === 'sign') this.view = { kind: 'quill', page: this.state.quill.page };
    this.trimPages();
    this.isOpen = false;
    this.ta.blur(); this.ti.blur();
    document.body.classList.remove('book');
    this.save();
    if (this.opts.sound && this.opts.sound.close) this.opts.sound.close();
    if (this.onClose) this.onClose(this.from);
  }
  // empty pages at the end go, as in the game; the first page always stays
  trimPages() {
    const q = this.state.quill;
    while (q.pages.length > 1 && q.pages[q.pages.length - 1] === '') q.pages.pop();
    q.page = Math.min(q.page, q.pages.length - 1);
  }

  // --- what is shown
  current() {
    if (this.view.kind === 'read') { const b = this.state.signed[this.view.book]; return { pages: b.pages, page: this.view.page, book: b }; }
    return { pages: this.state.quill.pages, page: this.state.quill.page, book: null };
  }
  show() {
    const $ = this.$, kind = this.view.kind;
    const root = $('#bq'); root.dataset.kind = kind;
    this.renderShelf();
    if (kind === 'sign') { this.renderSign(); setTimeout(() => this.ti.focus(), 0); return; }
    const { pages, page, book } = this.current();
    const cover = kind === 'read' && page < 0;
    root.classList.toggle('cover', cover);
    $('#bq-pageno').textContent = cover ? '' : `Page ${page + 1} of ${pages.length}`;
    $('#bq-prev').style.visibility = (kind === 'read' ? page > -1 : page > 0) ? 'visible' : 'hidden';
    $('#bq-next').style.visibility = (kind === 'read' ? page < pages.length - 1 : (page < pages.length - 1 || pages.length < MAX_PAGES)) ? 'visible' : 'hidden';
    if (cover) {
      $('#bq-cover-title').textContent = book.title;
      $('#bq-cover-by').textContent = `by ${book.author}`;
      $('#bq-text').textContent = '';
    } else {
      const text = pages[page];
      if (kind === 'quill') { this.ta.value = text; this.lastValue = text; this.ta.setSelectionRange(text.length, text.length); this.lastSel = text.length; }
      this.renderText(text);
    }
    this.renderCaret(); this.renderHint();
    this.fit();
  }
  renderHint() {
    const show = this.coarse && this.isOpen && this.view.kind === 'quill' && !this.ta.value && document.activeElement !== this.ta;
    this.$('#bq').classList.toggle('hint', show);
  }
  renderText(text) {
    const lines = wrapText(text);
    this.$('#bq-text').textContent = lines.map(l => text.slice(l.start, l.end)).join('\n');
  }
  renderCaret() {
    const c = this.$('#bq-cursor');
    if (this.view.kind !== 'quill' || !this.isOpen) { c.style.display = 'none'; return; }
    const text = this.ta.value, sel = this.ta.selectionEnd ?? text.length;
    const lines = wrapText(text), p = caretPos(lines, sel);
    c.style.display = 'block';
    c.classList.toggle('end', sel >= text.length);
    c.style.setProperty('--col', p.col); c.style.setProperty('--line', p.line);
  }
  renderShelf() {
    const $ = this.$, shelf = $('#bq-shelf');
    shelf.innerHTML = '';
    if (!this.state.signed.length) { shelf.style.display = 'none'; return; }
    shelf.style.display = 'flex';
    const mk = (label, active, go) => { const b = document.createElement('button'); b.className = 'mc small' + (active ? ' active' : ''); b.type = 'button'; b.textContent = label; b.addEventListener('click', go); shelf.appendChild(b); };
    mk('Book and Quill', this.view.kind !== 'read', () => { this.view = { kind: 'quill', page: this.state.quill.page }; this.show(); this.focusPage(); });
    this.state.signed.forEach((b, i) => mk(b.title, this.view.kind === 'read' && this.view.book === i, () => { this.view = { kind: 'read', book: i, page: -1 }; this.show(); }));
  }
  focusPage() { if (this.view.kind === 'quill') { this.ta.focus({ preventScroll: true }); this.renderCaret(); } }

  // --- typing: the page refuses what would not fit, as the game does
  typed() {
    const ta = this.ta;
    let v = clean(ta.value);
    if (!fits(v)) {
      // what was put in (typed or pasted) is cut down to as much of it as fits, from the front
      const last = this.lastValue;
      let a = 0; while (a < last.length && a < v.length && last[a] === v[a]) a++;
      let b = 0; while (b < last.length - a && b < v.length - a && last[last.length - 1 - b] === v[v.length - 1 - b]) b++;
      const ins = v.slice(a, v.length - b), head = last.slice(0, a), tail = last.slice(last.length - b);
      let lo = 0, hi = ins.length;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (fits(head + ins.slice(0, mid) + tail)) lo = mid; else hi = mid - 1; }
      v = head + ins.slice(0, lo) + tail;
      ta.value = v; ta.setSelectionRange(a + lo, a + lo);
    }
    if (v !== ta.value) { const s = ta.selectionEnd; ta.value = v; ta.setSelectionRange(Math.min(s, v.length), Math.min(s, v.length)); }
    this.lastValue = v; this.lastSel = ta.selectionEnd;
    this.state.quill.pages[this.state.quill.page] = v;
    this.save();
    this.renderText(ta.value); this.renderCaret(); this.renderHint();
  }

  // --- the pages
  turn(dir) {
    if (this.view.kind === 'sign') return;
    if (this.view.kind === 'read') {
      const b = this.state.signed[this.view.book];
      const p = Math.max(-1, Math.min(b.pages.length - 1, this.view.page + dir));
      if (p === this.view.page) return;
      this.view.page = p;
    } else {
      const q = this.state.quill;
      let p = q.page + dir;
      if (p < 0) return;
      if (p > q.pages.length - 1) { if (q.pages.length >= MAX_PAGES) return; q.pages.push(''); }
      q.page = p; this.view.page = p;
    }
    this.save();
    if (this.opts.sound && this.opts.sound.page) this.opts.sound.page();
    this.show();
    if (this.view.kind === 'quill' && document.activeElement !== this.ta && !matchMedia('(pointer: coarse)').matches) this.focusPage();
  }

  // --- signing
  beginSign() {
    if (this.view.kind !== 'quill') return;
    this.trimPages();
    this.ta.blur();
    this.view = { kind: 'sign', page: this.state.quill.page };
    this.ti.value = '';
    this.show();
  }
  cancelSign() { this.view = { kind: 'quill', page: this.state.quill.page }; this.show(); this.focusPage(); }
  renderSign() {
    const $ = this.$, title = this.ti.value;
    $('#bq-sign-title').textContent = title;
    $('#bq-sign-by').textContent = `by ${this.author()}`;
    $('#bq-signclose').disabled = title.trim().length === 0;
  }
  author() { const a = this.opts.author ? this.opts.author() : ''; return (a && String(a).trim()) || 'wanderer'; }
  signAndClose() {
    const title = this.ti.value.trim();
    if (!title) return;
    const q = this.state.quill;
    this.trimPages();
    this.state.signed.push({ title, author: this.author(), pages: q.pages.slice(), date: new Date().toISOString().slice(0, 10) });
    this.state.quill = { pages: [''], page: 0 };
    this.view = { kind: 'read', book: this.state.signed.length - 1, page: -1 };
    this.save();
    if (this.opts.sound && this.opts.sound.sign) this.opts.sound.sign();
    this.close();
  }
}
