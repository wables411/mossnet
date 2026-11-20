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
// the tab strip, left to right. Every tab opens a page of its own.
export const TABS = ['hands', 'bag', 'stats', 'finds', 'bugs', 'options'];
const TAB_NAME = { hands: 'In hand', bag: 'Inventory', stats: 'Stats', finds: 'Finds', bugs: 'Bug book', options: 'Options' };
const TAB_W = Math.floor((PANEL_W - 6) / TABS.length);
const PAGE = { x: PAD, y: HEAD + TITLE + PAD, w: PANEL_W - PAD * 2, h: PANEL_H - HEAD - TITLE - PAD * 2 };
function drawPanel(cv, tab = 'bag') {
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
  const tabs = TABS.length, tw = TAB_W;
  for (let t = 0; t < tabs; t++) {
    const x = 3 + t * tw, lit = TABS[t] === tab;
    rect(x, 4, tw - 2, HEAD - 8, lit ? '#6a2b22' : '#241d17');
    rect(x, 4, tw - 2, 1, lit ? '#9a4a3a' : '#3b3028'); rect(x, 4, 1, HEAD - 8, lit ? '#9a4a3a' : '#3b3028');
    rect(x, HEAD - 5, tw - 2, 1, lit ? '#3d1710' : '#120e0b'); rect(x + tw - 3, 4, 1, HEAD - 8, lit ? '#3d1710' : '#120e0b');
    const cx = x + Math.floor(tw / 2) - 1, cy = HEAD / 2;
    const dim = lit ? '#d9c6a2' : '#6f6052';
    const gap = lit ? '#6a2b22' : '#241d17';
    // the tab glyphs: an open hand (what he holds), the bag, three bars (stats), a written scroll (finds), a spanner (options)
    if (t === 0) { rect(cx - 4, cy - 1, 9, 7, dim); for (let f = 0; f < 4; f++) rect(cx - 4 + f * 2, cy - 6 + (f === 0 || f === 3 ? 1 : 0), 1, 6, dim); rect(cx + 5, cy, 2, 2, dim); rect(cx + 6, cy - 2, 1, 2, dim); rect(cx - 3, cy + 6, 7, 1, dim); }
    if (t === 1) drawBagGlyph(g, cx - 6, cy - 7, 13, 14, dim, gap);
    if (t === 2) { rect(cx - 6, cy + 1, 3, 5, dim); rect(cx - 1, cy - 3, 3, 9, dim); rect(cx + 4, cy - 7, 3, 13, dim); rect(cx - 7, cy + 6, 15, 1, dim); }
    if (t === 3) { rect(cx - 5, cy - 6, 10, 12, dim); rect(cx - 4, cy - 4, 8, 1, gap); rect(cx - 4, cy - 1, 8, 1, gap); rect(cx - 4, cy + 2, 5, 1, gap); }
    if (TABS[t] === 'bugs') { rect(cx - 3, cy - 3, 7, 10, dim); rect(cx - 2, cy - 6, 5, 3, dim); rect(cx, cy - 3, 1, 10, gap); for (const yy of [-2, 1, 4]) { rect(cx - 6, cy + yy, 3, 1, dim); rect(cx + 4, cy + yy, 3, 1, dim); } rect(cx - 3, cy - 8, 1, 2, dim); rect(cx + 3, cy - 8, 1, 2, dim); }
    if (TABS[t] === 'options') { for (let k = 0; k < 9; k++) rect(cx - 5 + k, cy + 4 - k, 3, 2, dim); rect(cx + 2, cy - 7, 5, 5, dim); rect(cx + 4, cy - 7, 2, 3, gap); rect(cx - 6, cy + 4, 4, 3, dim); }
  }
  // the outer border: a dark edge with the lit line inside it
  rect(0, 0, PANEL_W, 1, '#15110d'); rect(0, PANEL_H - 1, PANEL_W, 1, '#15110d'); rect(0, 0, 1, PANEL_H, '#15110d'); rect(PANEL_W - 1, 0, 1, PANEL_H, '#15110d');
  rect(1, HEAD + 1, PANEL_W - 2, 1, '#6b5b49'); rect(1, HEAD + 1, 1, PANEL_H - HEAD - 2, '#6b5b49');
  rect(1, PANEL_H - 2, PANEL_W - 2, 1, '#2a221b'); rect(PANEL_W - 2, HEAD + 1, 1, PANEL_H - HEAD - 2, '#2a221b');
  // any tab but the bag: one page, sunk the way a slot is
  if (tab !== 'bag') {
    const { x, y, w, h } = PAGE;
    rect(x, y, w, h, '#3b3127');
    for (let yy = y + 1; yy < y + h - 1; yy++) for (let xx = x + 1; xx < x + w - 1; xx++) if (h2(xx + 31, yy + 17) < 0.06) px(xx, yy, '#43382d');
    rect(x, y, w, 1, '#221c16'); rect(x, y, 1, h, '#221c16'); rect(x + 1, y + 1, w - 2, 1, '#2e261f'); rect(x + 1, y + 1, 1, h - 2, '#2e261f');
    rect(x, y + h - 1, w, 1, '#6b5b49'); rect(x + w - 1, y, 1, h, '#6b5b49');
    return;
  }
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
// the pack: pale green, the blue stamp over a red line, the name, the white notice at the foot
function cigsIcon(g) {
  const r = rectOn(g);
  r(8, 5, 16, 23, '#4d6046'); r(9, 6, 14, 21, '#cfe5c6');
  r(9, 10, 14, 1, '#c2332e'); r(16, 6, 5, 6, '#3f67a8');
  r(11, 14, 10, 1, '#4b6190'); r(13, 16, 6, 1, '#4b6190'); r(15, 18, 2, 4, '#8a4b2c');
  r(12, 23, 12, 5, '#111'); r(13, 24, 10, 3, '#fff');
}
// the handheld: an aqua shell, the lit screen, the keys
function deviceIcon(g) {
  const r = rectOn(g);
  r(9, 4, 14, 25, '#0c4d55'); r(10, 5, 12, 23, '#35c8d4'); r(10, 5, 12, 1, '#8eeaf0');
  r(11, 7, 10, 9, '#0b2b2e'); r(12, 8, 8, 7, '#b9f1e6'); r(13, 10, 5, 1, '#0b2b2e'); r(13, 12, 3, 1, '#0b2b2e');
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) r(12 + x * 3, 18 + y * 3, 2, 2, '#f3fbfb');
  r(21, 2, 1, 3, '#0c4d55');
}
// a flip-top lighter, its lid back, a flame
function lighterIcon(g) {
  const r = rectOn(g);
  r(10, 13, 12, 15, '#3c4046'); r(11, 14, 10, 13, '#aab0b8'); r(11, 14, 10, 1, '#dfe4ea'); r(11, 20, 10, 1, '#7c828a');
  r(22, 8, 6, 9, '#3c4046'); r(23, 9, 4, 7, '#9aa0a8');                                  // the lid, flipped
  r(13, 10, 6, 4, '#3c4046'); r(14, 11, 4, 3, '#6d7279');                                // the chimney
  r(15, 4, 2, 7, '#ffb347'); r(15, 6, 2, 4, '#fff1b8'); r(14, 7, 1, 3, '#ff8a2a'); r(17, 7, 1, 3, '#ff8a2a');
}
// a straight razor, open: dark wood handle with two brass pins, the square grey blade
function razorIcon(g) {
  lineOn(g, 6, 26, 17, 15, '#1c120b', 6); lineOn(g, 7, 25, 16, 16, '#5a3a22', 4); lineOn(g, 8, 23, 15, 17, '#7a5232', 1);
  g.fillStyle = '#d8b24a'; g.fillRect(15, 15, 2, 2); g.fillRect(7, 24, 2, 2);
  lineOn(g, 17, 15, 20, 12, '#3b4046', 3);
  lineOn(g, 20, 12, 27, 5, '#22262b', 8); lineOn(g, 20, 12, 27, 5, '#aab2ba', 6); lineOn(g, 21, 9, 26, 4, '#e6ecf1', 2); lineOn(g, 23, 14, 28, 9, '#7f8891', 1);
}
const ICONS = {
  razor: () => iconCanvas(razorIcon),
  lighter: () => iconCanvas(lighterIcon),
  cigs: () => iconCanvas(cigsIcon),
  device: () => iconCanvas(deviceIcon),
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
  book: { name: 'Book and Quill', examine: 'A journal with blank pages, and a quill to write in it.' },
  written: { name: (it, book) => { const b = book.state.signed[it.book]; return b ? b.title : 'Written Book'; }, examine: 'A book you wrote and signed. It can be read but not changed.' },
  torch: { name: 'Hand torch', examine: 'An army torch with its head set at an angle. It only helps after dark.' },
  cigs: { name: 'Cigarettes', examine: it => `A soft pack, pale green. ${it.n ?? 20} left.` },
  device: { name: 'Handheld', examine: 'An MQ-01. It reaches RemiliaNET from in here, somehow.' },
  lighter: { name: 'Lighter', examine: 'A flip-top lighter. It came with the pack.' },
  razor: { name: 'Barber\'s razor', examine: 'An old Chinese barber\'s razor. Rosewood, brass pins, a maker\'s stamp worn nearly flat.' },
};

function fresh() { return { slots: new Array(SLOTS).fill(null) }; }
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); const out = Object.assign(fresh(), s); out.slots = (out.slots || []).slice(0, SLOTS); while (out.slots.length < SLOTS) out.slots.push(null); return out; }
  catch { return fresh(); }
}

export class Satchel {
  // $: querySelector. opts:
  //   book, sound: { open(), close(), use(), tab() }, onClose(from), onUse(item, slot, from), verb(item)
  //   held()    -> [{ kind, name, where, verb }]          what is in his hands now (the In hand tab)
  //   stats()   -> [[label, value]]                       (the Stats tab)
  //   finds()   -> [{ id, name, found }]                  (the Finds tab: red until found, green after)
  //   onFind(id)                                          a found one was chosen
  //   options() -> [{ label, value, run() }]              (the Options tab)
  constructor($, opts = {}) {
    this.$ = $; this.opts = opts;
    this.state = load();
    this.from = null; this.isOpen = false; this.selected = -1; this.named = -1; this.tab = 'bag';
    this.coarse = matchMedia('(pointer: coarse)').matches;
    this.bg = $('#sat-bg');
    drawPanel(this.bg, this.tab);
    drawBagIcon($('#bag-btn-art'));
    const grid = this.grid = $('#sat-slots');
    grid.dataset.tab = this.tab;
    const make = (tag, cls, parent = grid) => { const e = document.createElement(tag); if (tag === 'button') e.type = 'button'; e.className = cls; parent.appendChild(e); return e; };
    // the tabs: five real buttons lying over the painted strip
    this.tabButtons = TABS.map((t, k) => {
      const b = make('button', 'tab');
      b.style.left = 3 + k * TAB_W + 'px'; b.style.top = '4px'; b.style.width = TAB_W - 2 + 'px'; b.style.height = HEAD - 8 + 'px';
      b.setAttribute('aria-label', TAB_NAME[t]); b.title = TAB_NAME[t];
      b.addEventListener('click', e => { e.preventDefault(); this.setTab(t); });
      return b;
    });
    // the slots
    this.cells = [];
    for (let i = 0; i < SLOTS; i++) {
      const b = make('button', 'slot'); b.dataset.i = i;
      b.style.left = slotX(i) + 'px'; b.style.top = slotY(i) + 'px';
      b.addEventListener('pointerenter', () => { if (!this.coarse && !this.drag) this.name(i); });
      b.addEventListener('pointerleave', () => { if (!this.coarse && this.named === i && !this.menuOpen) this.name(-1); });
      b.addEventListener('click', e => { e.preventDefault(); if (this.swallow) { this.swallow = false; return; } this.tap(i); });
      b.addEventListener('contextmenu', e => { e.preventDefault(); this.openMenu(i, e.clientX, e.clientY); });
      b.addEventListener('pointerdown', e => this.press(i, e));
      this.cells.push(b);
    }
    // a page for the other tabs, the right-click menu, and a line of text across the foot (what Examine says)
    this.page = make('div', 'page');
    this.page.style.left = PAGE.x + 3 + 'px'; this.page.style.top = PAGE.y + 3 + 'px'; this.page.style.width = PAGE.w - 6 + 'px'; this.page.style.height = PAGE.h - 6 + 'px';
    this.menu = make('div', 'menu');
    this.said = make('div', 'said');
    this.ghost = null; this.drag = null; this.swallow = false; this.menuOpen = false; this.holdT = 0; this.saidT = 0;
    addEventListener('pointermove', e => this.move(e));
    addEventListener('pointerup', e => this.release(e));
    addEventListener('pointercancel', () => this.dropDrag());
    addEventListener('pointerdown', e => { if (this.menuOpen && !this.menu.contains(e.target)) this.closeMenu(); }, true);
    $('#sat-close').addEventListener('click', () => this.close());
    window.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (this.menuOpen) this.closeMenu(); else this.close(); }
      else if (e.key >= '1' && e.key <= String(TABS.length)) { e.preventDefault(); e.stopPropagation(); this.setTab(TABS[+e.key - 1]); }
    }, true);
    const refit = () => { if (this.isOpen) this.fit(); };
    addEventListener('resize', refit);
    if (window.visualViewport) visualViewport.addEventListener('resize', refit);
    this.render();
  }

  save() { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* storage blocked */ } dispatchEvent(new Event('moss-maze-kept')); }
  reload() { this.state = load(); this.render(); }      // the account's copy was just put on this device (cloud.js)
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
    let k = Math.max(0.75, Math.min(2, Math.floor(Math.min((vw - 16) / PANEL_W, (vh - 16) / PANEL_H) * 4) / 4));
    // a phone on its side is too short for the whole satchel at a size a thumb can use: there it keeps its size
    // and the screen scrolls down it instead
    const tall = this.coarse && k < 1.25 && (vw - 16) / PANEL_W >= 1.25;
    if (tall) k = 1.25;
    root.classList.toggle('tall', tall);
    root.style.setProperty('--k', k); this.k = k;
  }

  open(from = 'playing') {
    this.from = from; this.isOpen = true; this.selected = -1;
    document.body.classList.add('satchel');
    this.fit(); this.setTab('bag', true); this.name(-1); this.say('');
    if (this.opts.sound && this.opts.sound.open) this.opts.sound.open();
  }
  close(silent = false) {
    if (!this.isOpen) return;
    this.isOpen = false; this.selected = -1; this.closeMenu(); this.dropDrag();
    document.body.classList.remove('satchel');
    if (!silent && this.opts.sound && this.opts.sound.close) this.opts.sound.close();
    if (!silent && this.opts.onClose) this.opts.onClose(this.from);
  }

  // --- the tabs
  setTab(tab, quiet = false) {
    if (!TABS.includes(tab)) return;
    const changed = tab !== this.tab;
    this.tab = tab; this.closeMenu(); this.dropDrag(); this.selected = -1;
    drawPanel(this.bg, tab);
    this.grid.dataset.tab = tab;
    this.tabButtons.forEach((b, k) => b.setAttribute('aria-pressed', String(TABS[k] === tab)));
    this.name(-1); this.say('');
    this.render(); this.drawPage();
    if (changed && !quiet && this.opts.sound && this.opts.sound.tab) this.opts.sound.tab();
  }
  title(count = '') {
    const t = this.$('#sat-title'), c = this.$('#sat-count');
    if (t.firstChild && t.firstChild.nodeType === 3) t.firstChild.textContent = TAB_NAME[this.tab] + ' ';
    c.textContent = count;
  }
  // the page of a tab that is not the bag: rows of text, some of them buttons
  drawPage() {
    const p = this.page, o = this.opts, tab = this.tab;
    p.innerHTML = ''; p.scrollTop = 0;
    if (tab === 'bag') { this.title(`${this.count()}/${SLOTS}`); return; }
    const row = (cls, left, right, run) => {
      const r = document.createElement(run ? 'button' : 'div'); if (run) r.type = 'button';
      r.className = 'row ' + cls;
      const a = document.createElement('span'); a.className = 'l'; a.textContent = left; r.appendChild(a);
      if (right !== undefined && right !== null) { const b = document.createElement('span'); b.className = 'r'; b.textContent = right; r.appendChild(b); }
      if (run) r.addEventListener('click', e => { e.preventDefault(); if (o.sound && o.sound.use) o.sound.use(); run(); if (this.isOpen && this.tab === tab) this.drawPage(); });
      p.appendChild(r); return r;
    };
    if (tab === 'hands') {
      const held = (o.held ? o.held() : []) || [];
      this.title(held.length ? `${held.length}` : '');
      if (!held.length) { row('dim', 'Both hands are empty.'); row('dim', ''); row('dim', 'Take something out of the bag and it shows here.'); return; }
      held.forEach(h => {
        const r = row('held', h.name, h.verb || 'Put away', () => { if (o.onUse) o.onUse({ kind: h.kind }, -1, this.from); });
        if (ICONS[h.kind]) { const cv = ICONS[h.kind](); cv.className = 'icon'; r.prepend(cv); }
        const w = document.createElement('span'); w.className = 'w'; w.textContent = h.where || ''; r.querySelector('.l').appendChild(w);
      });
    } else if (tab === 'stats') {
      this.title('');
      ((o.stats ? o.stats() : []) || []).forEach(([l, v]) => (v === undefined ? row('head', l) : row('stat', l, String(v))));
    } else if (tab === 'finds') {
      const list = (o.finds ? o.finds() : []) || [];
      this.title(`${list.filter(f => f.found).length}/${list.length}`);
      list.forEach(f => row(f.found ? 'found' : 'missing', f.name, null, f.found && o.onFind ? () => o.onFind(f.id) : null));
      if (list.some(f => f.found)) { row('dim', ''); row('dim', 'Choose a green one to see its drawing.'); }
    } else if (tab === 'bugs') {
      // every bug there is to find: its name in its rarity's colour once clicked, a blank until then
      const list = (o.bugs ? o.bugs() : []) || [];
      this.title(`${list.filter(f => f.found).length}/${list.length}`);
      if (!list.some(f => f.found)) { row('dim', 'No bugs yet.'); row('dim', ''); row('dim', 'They walk on the walls and the moss.'); row('dim', 'Click one and it is written in here.'); row('dim', ''); }
      list.forEach(f => { const r = row(f.found ? 'bug' : 'dim', f.found ? f.name : '? ? ?', f.found ? f.rarity : null, f.found && o.onBug ? () => o.onBug(f.id) : null); if (f.found) { r.style.color = f.color; const rr = r.querySelector('.r'); if (rr) rr.style.color = f.color; } });
    } else if (tab === 'options') {
      this.title('');
      ((o.options ? o.options() : []) || []).forEach(x => row('opt', x.label, x.value, x.run));
    }
  }

  // --- the slots
  render() {
    for (let i = 0; i < SLOTS; i++) {
      const it = this.state.slots[i], cell = this.cells[i];
      cell.classList.toggle('held', !!it); cell.classList.toggle('selected', i === this.selected);
      const want = it ? it.kind : '', extra = it ? `${it.book ?? ''}|${it.n ?? ''}` : '';
      if (cell.dataset.kind === want && cell.dataset.extra === extra) continue;
      cell.dataset.kind = want; cell.dataset.extra = extra;
      cell.innerHTML = '';
      if (it && ICONS[it.kind]) {
        const cv = ICONS[it.kind](); cv.className = 'icon'; cell.appendChild(cv); cell.setAttribute('aria-label', this.itemName(it));
        if (it.kind === 'cigs') { const n = document.createElement('span'); n.className = 'n'; n.textContent = String(it.n ?? 20); cell.appendChild(n); }   // how many are left, in the corner, the old way
      } else cell.removeAttribute('aria-label');
    }
    if (this.tab === 'bag') this.title(`${this.count()}/${SLOTS}`);
  }
  verbOf(it) { return this.opts.verb ? this.opts.verb(it) : 'Use'; }
  name(i) {
    this.named = i;
    const it = i >= 0 ? this.state.slots[i] : null;
    const el = this.$('#sat-name');
    if (!it || this.tab !== 'bag') { el.textContent = ''; el.classList.remove('show'); return; }
    el.innerHTML = '';
    const verb = document.createElement('span'); verb.className = 'verb'; verb.textContent = this.verbOf(it);
    el.appendChild(verb); el.appendChild(document.createTextNode(' ' + this.itemName(it)));
    el.classList.add('show');
  }
  // a line of text across the foot of the panel, gone after a few seconds
  say(text) {
    clearTimeout(this.saidT);
    this.said.textContent = text || ''; this.said.classList.toggle('show', !!text);
    if (text) this.saidT = setTimeout(() => this.said.classList.remove('show'), 5000);
  }
  // a tap: on a phone the first tap names the item and a second on the same slot uses it; with a mouse the hover
  // has named it already, so the click uses it
  tap(i) {
    if (this.menuOpen) { this.closeMenu(); return; }
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
  examine(i) {
    const it = this.state.slots[i]; if (!it) return;
    const d = ITEMS[it.kind] || {}, text = typeof d.examine === 'function' ? d.examine(it, this.opts.book) : d.examine;
    this.say(text || 'Nothing remarkable.');
  }

  // --- the menu: a right click, or a finger held still on a slot. The item's own action, Examine, Cancel.
  toPanel(cx, cy) { const r = this.grid.getBoundingClientRect(), k = r.width / PANEL_W || 1; return { x: (cx - r.left) / k, y: (cy - r.top) / k }; }
  openMenu(i, cx, cy) {
    const it = this.state.slots[i]; if (!it) return;
    this.dropDrag(); this.name(i);
    const m = this.menu, nm = this.itemName(it);
    m.innerHTML = '';
    const head = document.createElement('div'); head.className = 'head'; head.textContent = 'Choose Option'; m.appendChild(head);
    const line = (verb, name, run) => {
      const b = document.createElement('button'); b.type = 'button';
      const v = document.createElement('span'); v.className = 'verb'; v.textContent = verb; b.appendChild(v);
      if (name) b.appendChild(document.createTextNode(' ' + name));
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); this.closeMenu(); run && run(); });
      m.appendChild(b);
    };
    line(this.verbOf(it), nm, () => this.use(i));
    line('Examine', nm, () => this.examine(i));
    line('Cancel', '', null);
    m.classList.add('show'); this.menuOpen = true;
    const p = this.toPanel(cx, cy), w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.round(Math.max(2, Math.min(PANEL_W - w - 2, p.x - w / 2))) + 'px';
    m.style.top = Math.round(Math.max(2, Math.min(PANEL_H - h - 2, p.y - 6))) + 'px';
  }
  closeMenu() { if (!this.menuOpen) return; this.menuOpen = false; this.menu.classList.remove('show'); }

  // --- moving things about: press on a held slot and drag it onto another; the two change places
  press(i, e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (!this.state.slots[i] || this.menuOpen) return;
    this.drag = { i, x: e.clientX, y: e.clientY, on: false, touch: e.pointerType === 'touch', id: e.pointerId };
    clearTimeout(this.holdT);
    if (this.drag.touch) this.holdT = setTimeout(() => { if (this.drag && !this.drag.on) { const d = this.drag; this.drag = null; this.swallow = true; this.openMenu(d.i, d.x, d.y); } }, 480);
  }
  move(e) {
    const d = this.drag; if (!d || e.pointerId !== d.id) return;
    if (!d.on) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < (d.touch ? 10 : 6)) return;
      d.on = true; clearTimeout(this.holdT);
      const src = this.cells[d.i].querySelector('canvas');
      const gh = this.ghost = document.createElement('canvas'); gh.width = ICON; gh.height = ICON; gh.className = 'sat-ghost';
      if (src) gh.getContext('2d').drawImage(src, 0, 0);
      const k = this.k || 1.5; gh.style.width = gh.style.height = ICON * k + 'px';
      document.body.appendChild(gh);
      this.cells[d.i].classList.add('lifting'); this.name(-1);
    }
    const k = this.k || 1.5;
    this.ghost.style.left = e.clientX - ICON * k / 2 + 'px'; this.ghost.style.top = e.clientY - ICON * k / 2 + 'px';
    const over = this.slotAt(e.clientX, e.clientY);
    this.cells.forEach((c, j) => c.classList.toggle('over', j === over && j !== d.i));
  }
  slotAt(cx, cy) {
    const p = this.toPanel(cx, cy);
    for (let j = 0; j < SLOTS; j++) { const x = slotX(j), y = slotY(j); if (p.x >= x && p.x < x + SLOT && p.y >= y && p.y < y + SLOT) return j; }
    return -1;
  }
  release(e) {
    const d = this.drag; if (!d || e.pointerId !== d.id) return;
    clearTimeout(this.holdT);
    if (!d.on) { this.drag = null; return; }
    const to = this.slotAt(e.clientX, e.clientY);
    this.dropDrag();
    this.swallow = true; setTimeout(() => { this.swallow = false; }, 0);     // the click that follows a drag is not a use
    if (to >= 0 && to !== d.i) {
      const s = this.state.slots; [s[d.i], s[to]] = [s[to], s[d.i]];
      this.save(); this.render();
      if (this.opts.sound && this.opts.sound.use) this.opts.sound.use();
    }
  }
  dropDrag() {
    clearTimeout(this.holdT);
    if (this.ghost) { this.ghost.remove(); this.ghost = null; }
    this.cells.forEach(c => c.classList.remove('lifting', 'over'));
    this.drag = null;
  }
}
