// The finds: one hidden small true thing per place. When the player comes
// upon it (walks up and looks at it, or taps it) a pencil sketch of it is held
// up for a few seconds. The sketches are drawn in code with a jittered
// graphite stroke, loose, the way a field drawing is made standing up in the
// rain. (The journal the player writes in is src/book.js.)

export const FINDS = {
  yakushima: { kind: 'seedling', title: 'a cedar seedling on a boulder', note: 'rooted in the moss on top of a granite boulder, two hands high, with nothing under it but rock. the thousand-year cedars all began like this; their roots went down over the stone to find the ground.' },
  aokigahara: { kind: 'rootarch', title: 'a root looped out of the lava', note: 'the soil is a few centimetres deep over the lava, so the hemlocks hold on with roots that run over the rock and under it again. this one makes a handle.' },
  hoh: { kind: 'slug', title: 'a banana slug on a nurse log', note: 'a hand long, yellow, with black blotches. it eats the leaves off the floor and leaves the moss. the rainforest is cleaned by slugs.' },
  williamson: { kind: 'masonmark', title: "a mason's mark cut into a brick", note: 'every bricklayer had his own mark so the foreman could count what he had laid. this one was cut two hundred years ago, at arm height, by a man who was paid by the brick.' },
  wistmans: { kind: 'feather', title: "a raven's feather in the moss", note: 'black with a blue cast when it turns. the ravens nest on the tor above the wood and come down to the oaks to argue.' },
  fanal: { kind: 'cowbell', title: 'a cowbell dropped in the grass', note: 'the cattle graze between the laurels all summer; this one lost its bell. you can hear the others in the fog long before you see them.' },
  puzzlewood: { kind: 'ironpin', title: 'an iron pin left in the rock', note: 'the scowles were mined for iron ore from before the romans. the miners left pins and rings in the rock for their ropes and lamps, and the moss grew over all but this one.' },
  congaree: { kind: 'kneechair', title: 'a cypress knee shaped like a chair', note: 'the knees come up from the roots all round an old cypress. nobody knows for certain what they are for. this one has a seat and a back, and somebody has sat in it.' },
};
export const FIND_ORDER = ['yakushima', 'aokigahara', 'hoh', 'williamson', 'wistmans', 'fanal', 'puzzlewood', 'congaree'];

// --- the pencil
const rnd = (a, b) => a + Math.random() * (b - a);
function pencil(ctx, pts, { w = 1.3, a = 0.75, passes = 2, jit = 1.4, close = false } = {}) {
  for (let p = 0; p < passes; p++) {
    ctx.strokeStyle = `rgba(44,44,50,${a * (p ? 0.45 : 1)})`; ctx.lineWidth = w * (p ? 0.75 : 1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => { const jx = x + rnd(-jit, jit), jy = y + rnd(-jit, jit); if (i) ctx.lineTo(jx, jy); else ctx.moveTo(jx, jy); });
    if (close) ctx.closePath();
    ctx.stroke();
  }
}
// points along an ellipse arc
const arc = (cx, cy, rx, ry, a0, a1, n = 24, rot = 0) => { const out = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; const x = Math.cos(a) * rx, y = Math.sin(a) * ry; out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); } return out; };
// points along a quadratic curve
const curve = (x0, y0, cx, cy, x1, y1, n = 16) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]); } return out; };
const line = (x0, y0, x1, y1) => [[x0, y0], [x1, y1]];
// hatching inside a polygon
function hatch(ctx, poly, angle, spacing = 5, a = 0.35, w = 0.9) {
  ctx.save(); ctx.beginPath(); poly.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip();
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const R = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + 4;
  const dx = Math.cos(angle), dy = Math.sin(angle), px = -dy, py = dx;
  for (let s = -R; s <= R; s += spacing * rnd(0.8, 1.2)) {
    pencil(ctx, [[cx + px * s - dx * R, cy + py * s - dy * R], [cx + px * s + dx * R, cy + py * s + dy * R]], { w, a, passes: 1, jit: 0.8 });
  }
  ctx.restore();
}
// moss: a scribble of tiny arcs along a baseline
function mossLine(ctx, x0, x1, y, h = 6, a = 0.5) {
  for (let x = x0; x < x1; x += rnd(3, 6)) pencil(ctx, arc(x, y, rnd(2, 4), rnd(h * 0.6, h), Math.PI, Math.PI * 2, 6), { w: 0.9, a, passes: 1, jit: 0.6 });
}

// --- the eight drawings, each on a 220 x 160 page
const SKETCHES = {
  seedling(ctx) {
    // the log: two long edges, an end ring, bark lines, moss on top
    pencil(ctx, curve(14, 92, 110, 80, 206, 96), { w: 1.6 });
    pencil(ctx, curve(14, 128, 110, 136, 206, 130), { w: 1.6 });
    pencil(ctx, arc(206, 113, 7, 17, -Math.PI / 2, Math.PI / 2, 12), { w: 1.4 });
    pencil(ctx, arc(206, 113, 3, 8, 0, Math.PI * 2, 10), { w: 0.9, a: 0.5 });
    for (let i = 0; i < 9; i++) { const x = 24 + i * 20; pencil(ctx, curve(x, 100 + rnd(-3, 3), x + 10, 112, x + 2, 124 + rnd(-3, 3), 6), { w: 0.9, a: 0.4, passes: 1 }); }
    hatch(ctx, [[14, 118], [206, 122], [206, 130], [14, 128]], 0.2, 4, 0.3);
    mossLine(ctx, 18, 200, 92, 6);
    // the seedling: a stem, needles in whorls, a few roots into the moss
    pencil(ctx, curve(104, 90, 102, 60, 108, 28), { w: 1.5 });
    for (let i = 0; i < 14; i++) { const t = i / 14, y = 86 - t * 52, x = 104 + Math.sin(t * 3) * 2; const s = i % 2 ? -1 : 1, l = 8 + (1 - t) * 9; pencil(ctx, line(x, y, x + s * l, y - l * 0.55), { w: 1.1, a: 0.7, passes: 1 }); pencil(ctx, line(x, y, x - s * l * 0.7, y - l * 0.4), { w: 1.0, a: 0.55, passes: 1 }); }
    for (let i = 0; i < 7; i++) { const a = -1.2 + i * 0.4, l = rnd(8, 13); pencil(ctx, line(108, 28, 108 + Math.sin(a) * l, 28 - Math.cos(a) * l), { w: 1.1, passes: 1 }); }
    pencil(ctx, curve(104, 90, 96, 96, 90, 100, 5), { w: 1, a: 0.5, passes: 1 }); pencil(ctx, curve(104, 90, 112, 95, 116, 101, 5), { w: 1, a: 0.5, passes: 1 });
  },
  rootarch(ctx) {
    // two blocks of lava, the root arching from one to the other
    const b1 = [[18, 142], [26, 100], [60, 88], [92, 98], [96, 142]], b2 = [[126, 142], [130, 104], [162, 92], [198, 102], [204, 142]];
    pencil(ctx, b1, { w: 1.5, close: true }); pencil(ctx, b2, { w: 1.5, close: true });
    hatch(ctx, b1, 0.9, 5, 0.3); hatch(ctx, b2, 1.1, 5, 0.3);
    pencil(ctx, [[40, 110], [52, 122], [48, 136]], { w: 0.9, a: 0.5, passes: 1 }); pencil(ctx, [[150, 112], [168, 118], [160, 138]], { w: 0.9, a: 0.5, passes: 1 });
    pencil(ctx, line(8, 142, 212, 142), { w: 1.2, a: 0.5 });
    pencil(ctx, curve(78, 96, 110, 46, 142, 100, 20), { w: 2.2 });
    pencil(ctx, curve(86, 100, 110, 58, 136, 104, 20), { w: 1.6, a: 0.6 });
    for (let i = 1; i < 9; i++) { const t = i / 9; const p = curve(78, 96, 110, 46, 142, 100, 9)[i], q = curve(86, 100, 110, 58, 136, 104, 9)[i]; pencil(ctx, line(p[0], p[1], q[0], q[1]), { w: 0.8, a: 0.4, passes: 1 }); }
    mossLine(ctx, 28, 90, 92, 5); mossLine(ctx, 134, 196, 96, 5);
  },
  slug(ctx) {
    pencil(ctx, curve(10, 118, 110, 130, 210, 116), { w: 1.6 });
    hatch(ctx, [[10, 118], [210, 116], [210, 150], [10, 150]], 0.15, 5, 0.25);
    const body = [...curve(44, 108, 60, 72, 110, 76, 10), ...curve(110, 76, 150, 78, 176, 100, 10), ...curve(176, 100, 150, 112, 110, 112, 8), ...curve(110, 112, 70, 114, 44, 108, 8)];
    pencil(ctx, body, { w: 1.6, close: true });
    pencil(ctx, curve(80, 84, 110, 80, 134, 90, 10), { w: 1.0, a: 0.6 });   // the mantle
    pencil(ctx, curve(96, 80, 104, 92, 112, 84, 6), { w: 0.8, a: 0.5, passes: 1 });   // the breathing hole
    for (let i = 0; i < 9; i++) { const x = rnd(60, 168), y = rnd(84, 106); pencil(ctx, arc(x, y, rnd(2, 4), rnd(1.5, 3), 0, Math.PI * 2, 8), { w: 0.9, a: 0.7, passes: 1, jit: 0.5 }); hatch(ctx, arc(x, y, rnd(2, 4), rnd(1.5, 3), 0, Math.PI * 2, 8), 0.5, 1.5, 0.5, 0.7); }
    pencil(ctx, curve(44, 108, 36, 90, 30, 80, 5), { w: 1.0 }); pencil(ctx, curve(46, 106, 44, 92, 42, 84, 5), { w: 1.0 });
    pencil(ctx, arc(30, 79, 1.5, 1.5, 0, 6.3, 6), { w: 1, passes: 1 }); pencil(ctx, arc(42, 83, 1.5, 1.5, 0, 6.3, 6), { w: 1, passes: 1 });
    mossLine(ctx, 12, 40, 116, 5); mossLine(ctx, 182, 206, 115, 5);
  },
  masonmark(ctx) {
    // courses of brick, one with the mark
    for (let r = 0; r < 4; r++) { const y = 22 + r * 32; pencil(ctx, line(6, y, 214, y), { w: 1.2, a: 0.55 }); for (let k = (r % 2 ? 0 : 1); k < 5; k++) pencil(ctx, line(6 + k * 52 + (r % 2 ? 26 : 0), y, 6 + k * 52 + (r % 2 ? 26 : 0), y + 32), { w: 1.1, a: 0.5, passes: 1 }); }
    pencil(ctx, line(6, 150, 214, 150), { w: 1.2, a: 0.55 });
    for (let i = 0; i < 40; i++) { const x = rnd(8, 212), y = rnd(24, 148); pencil(ctx, line(x, y, x + rnd(-4, 4), y + rnd(-2, 2)), { w: 0.7, a: 0.25, passes: 1 }); }
    // the mark on the brick at 58..110 x 86..118: a W with a tail, cut deep
    const m = [[64, 112], [74, 90], [84, 106], [94, 90], [104, 112]];
    pencil(ctx, m, { w: 2.6, a: 0.9 }); pencil(ctx, m.map(([x, y]) => [x + 2, y + 2]), { w: 1.2, a: 0.35, passes: 1 });
    pencil(ctx, line(84, 106, 84, 120), { w: 2.4, a: 0.9 });
    pencil(ctx, arc(84, 104, 30, 20, 0, Math.PI * 2, 20), { w: 0.8, a: 0.25, passes: 1, jit: 2 });   // the eye's circle round it
  },
  feather(ctx) {
    const shaft = curve(30, 134, 110, 90, 196, 36, 24);
    const left = [], right = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24, [x, y] = shaft[i]; const wv = Math.sin(t * Math.PI) * 22 * (1 - t * 0.3) + (t > 0.15 ? 4 : 0); left.push([x - wv * 0.5, y - wv * 0.85]); right.push([x + wv * 0.5, y + wv * 0.85]); }
    const vane = [...left.slice(3), ...right.slice(3).reverse()];
    pencil(ctx, vane, { w: 1.2, a: 0.6, close: true, jit: 1.8 });
    hatch(ctx, vane, -0.55, 3.5, 0.45, 0.9);
    pencil(ctx, shaft, { w: 2.0, a: 0.85 });
    for (let i = 4; i < 24; i += 1) { const [x, y] = shaft[i]; pencil(ctx, line(x, y, left[i][0], left[i][1]), { w: 0.7, a: 0.3, passes: 1 }); pencil(ctx, line(x, y, right[i][0], right[i][1]), { w: 0.7, a: 0.3, passes: 1 }); }
    mossLine(ctx, 14, 206, 146, 7, 0.45); mossLine(ctx, 30, 190, 140, 5, 0.35);
  },
  cowbell(ctx) {
    const bell = [[82, 60], [138, 60], [150, 122], ...arc(110, 122, 40, 14, 0, Math.PI, 12), [70, 122]];
    pencil(ctx, bell, { w: 1.6, close: true });
    hatch(ctx, [[82, 60], [138, 60], [150, 122], [70, 122]], 1.2, 6, 0.28);
    pencil(ctx, arc(110, 52, 14, 10, Math.PI, Math.PI * 2, 12), { w: 1.6 });   // the loop
    pencil(ctx, line(96, 52, 96, 60), { w: 1.4, passes: 1 }); pencil(ctx, line(124, 52, 124, 60), { w: 1.4, passes: 1 });
    pencil(ctx, line(110, 100, 112, 132), { w: 1.3, a: 0.6 }); pencil(ctx, arc(112, 134, 5, 5, 0, 6.3, 8), { w: 1.2, a: 0.7 });   // the clapper
    pencil(ctx, curve(96, 48, 70, 30, 40, 24, 8), { w: 1.1, a: 0.5 }); pencil(ctx, curve(124, 48, 120, 28, 90, 20, 8), { w: 1.1, a: 0.5 });   // the rotted strap
    for (let i = 0; i < 40; i++) { const x = rnd(8, 212), h = rnd(10, 36); pencil(ctx, curve(x, 150, x + rnd(-6, 6), 150 - h * 0.6, x + rnd(-12, 12), 150 - h, 5), { w: 0.9, a: 0.5, passes: 1 }); }
  },
  ironpin(ctx) {
    // the rock face with its bedding, the ring and the pin
    for (let i = 0; i < 6; i++) pencil(ctx, curve(6, 30 + i * 22 + rnd(-3, 3), 110, 34 + i * 22 + rnd(-6, 6), 214, 28 + i * 22 + rnd(-3, 3), 12), { w: 1.0, a: 0.35, passes: 1, jit: 1.8 });
    pencil(ctx, arc(110, 92, 30, 30, 0, Math.PI * 2, 28), { w: 2.4, a: 0.9 });
    pencil(ctx, arc(110, 92, 23, 23, 0, Math.PI * 2, 28), { w: 1.6, a: 0.8 });
    hatch(ctx, [...arc(110, 92, 30, 30, 0, Math.PI * 2, 28)], 0.8, 3, 0.3, 0.8);
    pencil(ctx, line(110, 62, 110, 44), { w: 3, a: 0.9 }); pencil(ctx, arc(110, 42, 6, 4, 0, Math.PI * 2, 10), { w: 1.4 });
    for (let i = 0; i < 10; i++) { const a = rnd(0, 6.3); pencil(ctx, line(110 + Math.cos(a) * 33, 92 + Math.sin(a) * 33, 110 + Math.cos(a) * rnd(38, 48), 92 + Math.sin(a) * rnd(38, 48)), { w: 0.8, a: 0.35, passes: 1 }); }   // rust stains
    mossLine(ctx, 10, 70, 150, 6); mossLine(ctx, 150, 210, 150, 6);
  },
  kneechair(ctx) {
    const seat = [...arc(104, 112, 46, 16, Math.PI, Math.PI * 2, 14), ...arc(104, 112, 46, 10, 0, Math.PI, 14)];
    pencil(ctx, seat, { w: 1.6, close: true });
    const back = [[62, 100], [58, 50], ...arc(68, 44, 12, 10, Math.PI, Math.PI * 2, 8), [84, 54], [80, 98]];
    pencil(ctx, back, { w: 1.6, close: true });
    hatch(ctx, back, 1.5, 4, 0.3); hatch(ctx, seat, 0.1, 5, 0.22);
    const foot = [[76, 122], [70, 148], [140, 150], [134, 122]];
    pencil(ctx, foot, { w: 1.4, close: true }); hatch(ctx, foot, 1.5, 4, 0.3);
    for (let i = 0; i < 8; i++) { const x = 64 + i * 10; pencil(ctx, curve(x, 56 + rnd(-4, 4), x + 2, 80, x - 2, 98, 6), { w: 0.8, a: 0.4, passes: 1 }); }   // the grain
    pencil(ctx, curve(6, 144, 110, 150, 214, 146, 14), { w: 1.0, a: 0.5 }); pencil(ctx, curve(20, 152, 110, 156, 200, 152, 14), { w: 0.8, a: 0.3, passes: 1 });   // the water
    pencil(ctx, arc(160, 128, 10, 14, Math.PI, Math.PI * 2, 8), { w: 1.2, a: 0.6 }); pencil(ctx, arc(178, 136, 6, 10, Math.PI, Math.PI * 2, 8), { w: 1.1, a: 0.5 });   // more knees
  },
};

// the player came upon this place's find: hold the sketch up for a moment (once per visit to a place)
export class Finds {
  constructor($) { this.$ = $; this.seen = new Set(); }
  reset() { this.seen.clear(); }
  isFound(id) { return this.seen.has(id); }
  found(id, level, placeName) {
    if (this.seen.has(id) || !FINDS[id]) return false;
    this.seen.add(id);
    const toast = this.$('#find');
    toast.querySelector('.find-title').textContent = FINDS[id].title;
    toast.querySelector('.find-sub').textContent = `${placeName.toLowerCase()} · maze ${level}`;
    this.draw(toast.querySelector('canvas'), id);
    toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
    return true;
  }
  draw(canvas, id) {
    const w = 220, h = 160, dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (SKETCHES[FINDS[id].kind]) SKETCHES[FINDS[id].kind](ctx);
  }
}
