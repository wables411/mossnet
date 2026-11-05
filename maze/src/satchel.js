// The satchel: what the player carries, laid out the way the inventory of
// the old RuneScape (2001-2004) was. A stone-brown panel with a dark border,
// a tab strip with the bag tab lit, a grid of 4 by 7 bevelled slots, 28 in
// all, with a pixel icon in each held slot. Hovering or tapping a slot names
// the item in the panel's own orange menu text; a click (or a second tap on
// the same slot) uses it: the Book and Quill and the signed books open the
// journal, the hand torch is switched. Everything here is drawn in code; the
// contents are kept in localStorage. The satchel starts empty.
const KEY = 'moss-maze-satchel-v1';
export const COLS = 4, ROWS = 7, SLOTS = COLS * ROWS;

// --- the panel in its own pixels (1 panel pixel = var(--k) css pixels)
const SLOT = 40, GAP = 2, PAD = 9, HEAD = 34, TITLE = 14;   // the tab strip, then the title line
export const PANEL_W = PAD * 2 + COLS * SLOT + (COLS - 1) * GAP;         // 184
export const PANEL_H = HEAD + TITLE + PAD * 2 + ROWS * SLOT + (ROWS - 1) * GAP;   // 360
const slotX = i => PAD + (i % COLS) * (SLOT + GAP), slotY = i => HEAD + TITLE + PAD + Math.floor(i / COLS) * (SLOT + GAP);

// a hash for the stone's grain, the same every time
const h2 = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };

// the panel: stone-brown ground with a mottled grain, a dark outer border with a lit inner line, the tab strip across
// the top and the lit bag tab in it, then the 28 slots each sunk with a bevel (dark above and left, light below and right)
function drawPanel(cv) {
  cv.width = PANEL_W; cv.height = PANEL_H;
  const g = cv.getContext('2d');
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const px = (x, y, c) => rect(x, y, 1, 1, c);
  // the stone ground
  rect(0, 0, PANEL_W, PANEL_H, '#4a3e32');
  for (let y = 0; y < PANEL_H; y++) for (let x = 0; x < PANEL_W; x++) {
    const r = h2(x, y), r2 = h2(x >> 2, y >> 2);
    if (r2 < 0.22) px(x, y, '#3f352a');
    if (r < 0.10) px(x, y, '#5a4c3d'); else if (r > 0.95) px(x, y, '#362d24');
  }
  // the tab strip: darker, with the bag tab lit in the old red-brown
  rect(0, 0, PANEL_W, HEAD, '#2d251d');
  for (let y = 0; y < HEAD; y++) for (let x = 0; x < PANEL_W; x++) if (h2(x + 9, y + 3) < 0.12) px(x, y, '#352c23');
  rect(0, HEAD - 1, PANEL_W, 1, '#1a1511');
  rect(0, HEAD, PANEL_W, 1, '#5e5041');
  const tabs = 5, tw = Math.floor((PANEL_W - 6) / tabs);
  for (let t = 0; t < tabs; t++) {
    const x = 3 + t * tw, lit = t === 1;
    rect(x, 4, tw - 2, HEAD - 8, lit ? '#6a2b22' : '#241d17');
    rect(x, 4, tw - 2, 1, lit ? '#9a4a3a' : '#3b3028'); rect(x, 4, 1, HEAD - 8, lit ? '#9a4a3a' : '#3b3028');
    rect(x, HEAD - 5, tw - 2, 1, lit ? '#3d1710' : '#120e0b'); rect(x + tw - 3, 4, 1, HEAD - 8, lit ? '#3d1710' : '#120e0b');
    const cx = x + Math.floor(tw / 2) - 1, cy = HEAD / 2;
    const dim = lit ? '#d9c6a2' : '#6f6052';
    // the tab glyphs: a small sword, the bag, a shield, a scroll, a boot: tokens of the strip, the bag the live one
    if (t === 0) { rect(cx - 1, cy - 7, 2, 11, dim); rect(cx - 4, cy + 1, 8, 1, dim); rect(cx - 1, cy + 4, 2, 2, lit ? '#ffe4a0' : '#4e4237'); }
    if (t === 1) drawBagGlyph(g, cx - 6, cy - 7, 13, 14, dim);
    if (t === 2) { rect(cx - 4, cy - 6, 8, 8, dim); rect(cx - 3, cy + 2, 6, 2, dim); rect(cx - 2, cy + 4, 4, 1, dim); rect(cx - 1, cy + 5, 2, 1, dim); }
    if (t === 3) { rect(cx - 5, cy - 6, 10, 12, dim); rect(cx - 4, cy - 4, 8, 1, '#2d251d'); rect(cx - 4, cy - 1, 8, 1, '#2d251d'); rect(cx - 4, cy + 2, 8, 1, '#2d251d'); }
    if (t === 4) { rect(cx - 3, cy - 6, 4, 8, dim); rect(cx - 3, cy + 2, 8, 4, dim); rect(cx - 3, cy + 5, 8, 1, '#2d251d'); }
  }
  // the outer border: a dark edge with the lit line inside it
  rect(0, 0, PANEL_W, 1, '#15110d'); rect(0, PANEL_H - 1, PANEL_W, 1, '#15110d'); rect(0, 0, 1, PANEL_H, '#15110d'); rect(PANEL_W - 1, 0, 1, PANEL_H, '#15110d');
  rect(1, HEAD + 1, PANEL_W - 2, 1, '#6b5b49'); rect(1, HEAD + 1, 1, PANEL_H - HEAD - 2, '#6b5b49');
  rect(1, PANEL_H - 2, PANEL_W - 2, 1, '#2a221b'); rect(PANEL_W - 2, HEAD + 1, 1, PANEL_H - HEAD - 2, '#2a221b');
  // the slots: sunk
  for (let i = 0; i < SLOTS; i++) {
    const x = slotX(i), y = slotY(i);
    rect(x, y, SLOT, SLOT, '#3b3127');
    for (let yy = y + 1; yy < y + SLOT - 1; yy++) for (let xx = x + 1; xx < x + SLOT - 1; xx++) if (h2(xx + 31, yy + 17) < 0.08) px(xx, yy, '#43382d');
    rect(x, y, SLOT, 1, '#221c16'); rect(x, y, 1, SLOT, '#221c16');
    rect(x + 1, y + 1, SLOT - 2, 1, '#2e261f'); rect(x + 1, y + 1, 1, SLOT - 2, '#2e261f');
    rect(x, y + SLOT - 1, SLOT, 1, '#6b5b49'); rect(x + SLOT - 1, y, 1, SLOT, '#6b5b49');
    rect(x + 1, y + SLOT - 2, SLOT - 2, 1, '#54483a'); rect(x + SLOT - 2, y + 1, 1, SLOT - 2, '#54483a');
  }
}
// a satchel seen from the front: the flap over the body, a buckle; drawn into w x h
function drawBagGlyph(g, x, y, w, h, c, flap = '#2d251d') {
  g.fillStyle = c;
  g.fillRect(x + 1, y + 4, w - 2, h - 5);
  g.fillRect(x, y + 5, w, h - 7);
  g.fillRect(x + 3, y + 1, w - 6, 3);                 // the strap's arch
  g.fillStyle = flap; g.fillRect(x + 4, y + 2, w - 8, 1);
  g.fillRect(x + 1, y + 8, w - 2, 1);                 // the flap's edge
  g.fillStyle = c; g.fillRect(x + Math.floor(w / 2) - 1, y + 7, 3, 3);   // the buckle
}
// the bag, 16 x 16, for the touch button
export function drawBagIcon(cv) {
  cv.width = 16; cv.height = 16;
  const g = cv.getContext('2d');
  g.fillStyle = '#2a1e14'; g.fillRect(1, 5, 14, 10); g.fillRect(2, 4, 12, 12); g.fillRect(5, 1, 6, 4);
  drawBagGlyph(g, 2, 2, 12, 12, '#a0763f', '#4a3217');
}

// --- the items, 32 x 32, each drawn once
const ICON = 32;
function iconCanvas(draw) { const cv = document.createElement('canvas'); cv.width = ICON; cv.height = ICON; draw(cv.getContext('2d')); return cv; }
const rectOn = g => (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
// a thick pixel line
function lineOn(g, x0, y0, x1, y1, c, w = 1) {
  g.fillStyle = c;
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); g.fillRect(x - Math.floor(w / 2), y - Math.floor(w / 2), w, w); }
}
// a closed book lying at a slant, seen from above-front: the cover, the page block showing at its right and foot
function bookIcon(g, cover, light, dark, band) {
  const r = rectOn(g);
  r(6, 6, 18, 22, dark);                 // the outline
  r(7, 7, 16, 20, cover);
  r(7, 7, 16, 1, light); r(7, 7, 1, 20, light);
  r(23, 9, 3, 19, dark); r(24, 10, 1, 17, '#f3e9cd'); r(25, 11, 1, 16, '#d9c9a5');   // the pages at the right
  r(8, 27, 17, 2, dark); r(9, 27, 15, 1, '#f3e9cd');                                // and at the foot
  r(9, 7, 2, 20, dark); r(10, 8, 1, 18, light);                                     // the spine's hinge
  if (band) { r(12, 12, 9, 2, band); r(12, 16, 7, 1, band); }
}
function quillOn(g) {
  lineOn(g, 10, 26, 25, 7, '#2b2320', 3);
  lineOn(g, 10, 26, 25, 7, '#efeae0', 1);
  for (let i = 0; i < 6; i++) lineOn(g, 14 + i * 2, 21 - i * 2.6, 18 + i * 2, 20 - i * 2.6, '#cfc8ba', 1);
  lineOn(g, 23, 9, 25, 7, '#f7f3ea', 2);
  lineOn(g, 10, 26, 12, 24, '#3a2a18', 2);     // the inked nib
}
const ICONS = {
  book: () => iconCanvas(g => { bookIcon(g, '#8f4a37', '#a65b45', '#2a1810'); quillOn(g); }),
  written: () => iconCanvas(g => { bookIcon(g, '#3f5f7c', '#5a7d9c', '#15202b', '#c9a24a'); }),
  torch: () => iconCanvas(g => {
    // a hand torch at a slant: the dark body, a lighter head ring, the lens lit, a red switch
    lineOn(g, 7, 25, 22, 10, '#15161a', 7);
    lineOn(g, 8, 24, 21, 11, '#3a3d44', 5);
    lineOn(g, 9, 22, 19, 12, '#575b63', 1);
    lineOn(g, 20, 12, 25, 7, '#15161a', 9);
    lineOn(g, 21, 11, 24, 8, '#6a6e78', 7);
    lineOn(g, 23, 9, 26, 6, '#f6e7a0', 5);
    lineOn(g, 24, 8, 26, 6, '#fff8d0', 3);
    g.fillStyle = '#b8322a'; g.fillRect(13, 14, 2, 2);
    g.fillStyle = '#15161a'; g.fillRect(5, 25, 4, 4); g.fillStyle = '#2b2d33'; g.fillRect(6, 26, 2, 2);   // the end cap
  }),
};

export const ITEMS = {
  book: { name: 'Book and Quill' },
  written: { name: (it, book) => { const b = book.state.signed[it.book]; return b ? b.title : 'Written Book'; } },
  torch: { name: 'Hand torch' },
};

function fresh() { return { slots: new Array(SLOTS).fill(null) }; }
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); const out = Object.assign(fresh(), s); out.slots = (out.slots || []).slice(0, SLOTS); while (out.slots.length < SLOTS) out.slots.push(null); return out; }
  catch { return fresh(); }
}

export class Satchel {
  // $: querySelector; opts: { book: Book, sound: { open(), close(), use() }, onClose(from), onUse(item) -> true when used }
  constructor($, opts = {}) {
    this.$ = $; this.opts = opts;
    this.state = load();
    this.from = null; this.isOpen = false; this.selected = -1; this.named = -1;
    this.coarse = matchMedia('(pointer: coarse)').matches;
    this.icons = {};
    drawPanel($('#sat-bg'));
    drawBagIcon($('#bag-btn-art'));
    const grid = this.grid = $('#sat-slots');
    this.cells = [];
    for (let i = 0; i < SLOTS; i++) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'slot'; b.dataset.i = i;
      b.style.left = slotX(i) + 'px'; b.style.top = slotY(i) + 'px';
      b.addEventListener('pointerenter', () => { if (!this.coarse) this.name(i); });
      b.addEventListener('pointerleave', () => { if (!this.coarse && this.named === i) this.name(-1); });
      b.addEventListener('click', e => { e.preventDefault(); this.tap(i); });
      grid.appendChild(b); this.cells.push(b);
    }
    $('#sat-close').addEventListener('click', () => this.close());
    window.addEventListener('keydown', e => { if (this.isOpen && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); } }, true);
    const refit = () => { if (this.isOpen) this.fit(); };
    addEventListener('resize', refit);
    if (window.visualViewport) visualViewport.addEventListener('resize', refit);
    this.render();
  }

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* storage blocked */ } }
  get slots() { return this.state.slots; }
  count() { return this.state.slots.filter(Boolean).length; }
  has(kind, book) { return this.state.slots.some(s => s && s.kind === kind && (book === undefined || s.book === book)); }
  // put an item in the first free slot; returns the slot index or -1 when the satchel is full
  add(item) {
    const i = this.state.slots.indexOf(null); if (i < 0) return -1;
    this.state.slots[i] = item; this.save(); this.render(); return i;
  }
  remove(i) { this.state.slots[i] = null; this.save(); this.render(); }
  // what the journal holds is what the satchel holds: the Book and Quill once found, every signed book
  sync(book) {
    let changed = false;
    if (book.found && !this.has('book')) { if (this.add({ kind: 'book' }) >= 0) changed = true; }
    book.state.signed.forEach((b, i) => { if (!this.has('written', i)) { if (this.add({ kind: 'written', book: i }) >= 0) changed = true; } });
    return changed;
  }
  itemName(it) { const d = ITEMS[it.kind]; if (!d) return '?'; return typeof d.name === 'function' ? d.name(it, this.opts.book) : d.name; }

  // --- the scale: quarter steps, as large as the screen allows down to three quarters
  fit() {
    const vv = window.visualViewport;
    const vw = (vv && vv.width) || innerWidth || document.documentElement.clientWidth, vh = (vv && vv.height) || innerHeight || document.documentElement.clientHeight;
    const root = this.$('#satchel');
    root.style.height = vh + 'px'; root.style.top = (vv ? vv.offsetTop : 0) + 'px';
    const k = Math.max(0.75, Math.min(2, Math.floor(Math.min((vw - 16) / PANEL_W, (vh - 16) / PANEL_H) * 4) / 4));
    root.style.setProperty('--k', k);
  }

  open(from = 'playing') {
    this.from = from; this.isOpen = true; this.selected = -1;
    document.body.classList.add('satchel');
    this.fit(); this.render(); this.name(-1);
    if (this.opts.sound && this.opts.sound.open) this.opts.sound.open();
  }
  close(silent = false) {
    if (!this.isOpen) return;
    this.isOpen = false; this.selected = -1;
    document.body.classList.remove('satchel');
    if (!silent && this.opts.sound && this.opts.sound.close) this.opts.sound.close();
    if (!silent && this.opts.onClose) this.opts.onClose(this.from);
  }

  // --- the slots
  render() {
    for (let i = 0; i < SLOTS; i++) {
      const it = this.state.slots[i], cell = this.cells[i];
      cell.classList.toggle('held', !!it); cell.classList.toggle('selected', i === this.selected);
      const want = it ? it.kind : '';
      if (cell.dataset.kind === want && (!it || cell.dataset.extra === String(it.book ?? ''))) continue;
      cell.dataset.kind = want; cell.dataset.extra = it ? String(it.book ?? '') : '';
      cell.innerHTML = '';
      if (it && ICONS[it.kind]) { const cv = ICONS[it.kind](); cv.className = 'icon'; cell.appendChild(cv); cell.setAttribute('aria-label', this.itemName(it)); }
      else cell.removeAttribute('aria-label');
    }
    this.$('#sat-count').textContent = `${this.count()}/${SLOTS}`;
  }
  name(i) {
    this.named = i;
    const it = i >= 0 ? this.state.slots[i] : null;
    const el = this.$('#sat-name');
    if (!it) { el.textContent = ''; el.classList.remove('show'); return; }
    el.innerHTML = '';
    const verb = document.createElement('span'); verb.className = 'verb'; verb.textContent = this.opts.verb ? this.opts.verb(it) : 'Use';
    el.appendChild(verb); el.appendChild(document.createTextNode(' ' + this.itemName(it)));
    el.classList.add('show');
  }
  // a tap: on a phone the first tap names the item and a second on the same slot uses it; with a mouse the hover
  // has named it already, so the click uses it
  tap(i) {
    const it = this.state.slots[i];
    if (!it) { this.selected = -1; this.name(-1); this.render(); return; }
    if (this.coarse && this.selected !== i) { this.selected = i; this.name(i); this.render(); return; }
    this.use(i);
  }
  use(i) {
    const it = this.state.slots[i]; if (!it) return;
    if (this.opts.sound && this.opts.sound.use) this.opts.sound.use();
    if (this.opts.onUse) this.opts.onUse(it, i, this.from);
    this.selected = -1; this.render(); this.name(this.coarse ? -1 : i);
  }
}
