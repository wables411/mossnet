// The finds: one hidden small true thing per place. When the player comes
// upon it (walks up and looks at it, or taps it) a drawing of it is held up for
// a few seconds. The drawings are a child's, in wax crayon (owner, 2026-11-18:
// "as if drawn by child"). A hidden Radbro head, once found and tapped, is kept
// the same way. (The journal the player writes in is src/book.js.)

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
// a hidden Radbro (world.js faceMarks): its id is 'radbro:<maze>:<which>', so each one is found once
export const RADBRO = { kind: 'radbro', title: 'radbro, engraved in stone, date unknown', note: "Radbro is the ultimate example of the individual shaped by the signifier. Radbro is a man seen only in mirror images; lost in a hall of mirrors he is a reflection of a reflection of a reflection. You start with Milady – the wholesome all Japanese online cutie, you reflect her to create Pixelady – the same thing but slightly less. You invert Milady to create Remilio – Milady turned boyish and libertarian – then you reflect the inversion in the reflection: you create a being who can only exist in reference to others. Radbro is the true nowhere man, without the other characters he reflects, inverts and parodies he has no reason to exist. Radbro's identity only comes from what and who he isn't – without a wider frame of reference he is nothing. He is not his own man. In a world where our identities are shaped by our warped relationships to brands and commerce we are all Radbro." };
const findOf = id => FINDS[id] || (String(id).startsWith('radbro') ? RADBRO : null);
export const FIND_ORDER = ['yakushima', 'aokigahara', 'hoh', 'williamson', 'wistmans', 'fanal', 'puzzlewood', 'congaree'];

// --- the crayons. The drawings are a child's: a few big shapes, wax crayon pressed hard, coloured in back and
// forth and over the lines, a sun in the corner, and the name of the thing written underneath in their own letters.
const rnd = (a, b) => a + Math.random() * (b - a);
const C = { black: '#2b2a2e', brown: '#8a4f24', tan: '#b9813f', green: '#3f9a3a', dkgreen: '#2c6e33', grey: '#8d8f95', dkgrey: '#5f6168', yellow: '#f2c31b', orange: '#ee7d1c', red: '#d6412b', blue: '#3b78d8', sky: '#6fb7ea', skin: '#f0c08a', night: '#2d3550' };

// a hand that is not steady: the line is walked in short steps and wanders as it goes
function wob(pts, amp = 1.7) {
  const out = [], p1 = rnd(0, 6), p2 = rnd(0, 6), p3 = rnd(0, 6), p4 = rnd(0, 6);
  let k = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4));
    for (let j = 0; j < n; j++, k++) {
      const t = j / n;
      out.push([x0 + (x1 - x0) * t + amp * (Math.sin(k * 0.41 + p1) + 0.6 * Math.sin(k * 0.13 + p2)), y0 + (y1 - y0) * t + amp * (Math.sin(k * 0.37 + p3) + 0.6 * Math.sin(k * 0.11 + p4))]);
    }
  }
  const l = pts[pts.length - 1]; out.push([l[0] + rnd(-amp, amp), l[1] + rnd(-amp, amp)]);
  return out;
}
// one crayon line: wax, so it is several thin streaks side by side with gaps where the paper shows
function crayon(ctx, pts, color, w = 4, { close = false, amp = 1.7, a = 0.62 } = {}) {
  // a closed shape drawn by a child does not meet itself: it overshoots or stops short
  const path = wob(close ? [...pts, [pts[0][0] + rnd(-4, 4), pts[0][1] + rnd(-4, 4)]] : pts, amp);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color;
  const streaks = Math.max(3, Math.round(w * 1.2));
  for (let s = 0; s < streaks; s++) {
    const ox = rnd(-w, w) * 0.38, oy = rnd(-w, w) * 0.38;
    ctx.globalAlpha = a * rnd(0.6, 1); ctx.lineWidth = w * rnd(0.3, 0.5);
    ctx.beginPath(); let pen = false;
    for (const [x, y] of path) {
      if (Math.random() < 0.035) { pen = false; continue; }      // the wax skips
      if (pen) ctx.lineTo(x + ox, y + oy); else { ctx.moveTo(x + ox, y + oy); pen = true; }
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// coloured in: one long back-and-forth across the shape, not staying inside it
function colour(ctx, poly, color, { gap = 5, ang = rnd(-0.5, 0.5), w = 3.4, over = 4, a = 0.5 } = {}) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const R = poly.map(([x, y]) => [x * ca + y * sa, -x * sa + y * ca]);
  const ys = R.map(p => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys), zig = [];
  let flip = false;
  for (let y = y0 + gap * 0.5; y < y1; y += gap * rnd(0.7, 1.35)) {
    const xs = [];
    for (let i = 0; i < R.length; i++) { const [ax, ay] = R[i], [bx, by] = R[(i + 1) % R.length]; if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + (bx - ax) * (y - ay) / (by - ay)); }
    if (xs.length < 2) continue;
    const l = Math.min(...xs) - rnd(-2, over), r = Math.max(...xs) + rnd(-2, over);
    const ends = flip ? [r, l] : [l, r]; flip = !flip;
    for (const x of ends) zig.push([x * ca - y * sa, x * sa + y * ca]);
  }
  if (zig.length > 1) crayon(ctx, zig, color, w, { amp: 0.9, a });
}
const blob = (cx, cy, rx, ry, n = 11, lump = 0.14) => { const out = [], ph = rnd(0, 6); for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2, k = 1 + lump * Math.sin(t * 3 + ph) + rnd(-lump, lump) * 0.5; out.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]); } return out; };
const bow = (x0, y0, cx, cy, x1, y1, n = 9) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]); } return out; };
const zigzag = (x0, x1, y, h = 8, step = 7) => { const out = []; let up = false; for (let x = x0; x <= x1; x += step * rnd(0.7, 1.3)) { out.push([x, y - (up ? h * rnd(0.6, 1.2) : 0)]); up = !up; } return out; };
function dot(ctx, x, y, r, color) { colour(ctx, blob(x, y, r, r, 8, 0.1), color, { gap: Math.max(1.6, r * 0.5), w: Math.max(1.6, r * 0.8), over: 1, a: 0.8 }); }
// the sun every child puts in the corner
function sun(ctx, x, y, r = 13) {
  colour(ctx, blob(x, y, r, r, 10, 0.08), C.yellow, { gap: 4, w: 3.5, a: 0.6 });
  crayon(ctx, blob(x, y, r, r, 10, 0.08), C.orange, 2.6, { close: true, amp: 1 });
  for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2 + rnd(-0.15, 0.15), a = r + 4, b = r + rnd(9, 16); crayon(ctx, [[x + Math.cos(t) * a, y + Math.sin(t) * a], [x + Math.cos(t) * b, y + Math.sin(t) * b]], C.yellow, 2.8, { amp: 0.8 }); }
}
// the name of it, in their own letters: sizes all over the place, a line that climbs, now and then one written backwards
function letters(ctx, text, x, y, color = C.black, size = 17) {
  ctx.save(); ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
  let cx = x, cy = y; const climb = rnd(-0.12, 0.05);
  for (const ch of text) {
    const s = size * rnd(0.82, 1.22);
    ctx.font = `bold ${s}px "Comic Sans MS", "Chalkboard SE", "Marker Felt", "Segoe Print", cursive`;
    const w = ctx.measureText(ch).width;
    if (ch !== ' ') {
      ctx.save(); ctx.translate(cx + w / 2, cy + rnd(-2, 2)); ctx.rotate(rnd(-0.2, 0.2));
      if ('NSRZ'.includes(ch) && Math.random() < 0.3) ctx.scale(-1, 1);
      for (let p = 0; p < 3; p++) { ctx.globalAlpha = 0.5; ctx.fillText(ch, -w / 2 + rnd(-0.7, 0.7), rnd(-0.7, 0.7)); }
      ctx.restore();
    }
    cx += w * rnd(0.95, 1.2) + (ch === ' ' ? 2 : 0); cy += climb * w;
  }
  ctx.restore();
}
function grass(ctx, x0, x1, y, h = 9) { crayon(ctx, zigzag(x0, x1, y, h, 6), C.green, 3.2, { amp: 0.8 }); }

// --- the nine drawings, each on a 220 x 160 page
const SKETCHES = {
  seedling(ctx) {
    sun(ctx, 190, 28);
    const rock = [[38, 150], [30, 116], [56, 94], [102, 86], [150, 92], [182, 114], [180, 150]];
    colour(ctx, rock, C.grey, { gap: 6, ang: 0.3 }); crayon(ctx, rock, C.dkgrey, 4, { close: true });
    crayon(ctx, zigzag(54, 152, 92, 9, 7), C.green, 4, { amp: 0.8 });
    crayon(ctx, [[104, 90], [106, 42]], C.brown, 5);
    for (const [y, w] of [[72, 24], [56, 19], [41, 14]]) { const tri = [[106 - w, y], [106 + w, y], [106, y - 22]]; colour(ctx, tri, C.green, { gap: 4, ang: 0.1, w: 3 }); crayon(ctx, tri, C.dkgreen, 3, { close: true, amp: 1.2 }); }
    letters(ctx, 'baby tree', 10, 30, C.dkgreen, 16);
  },
  rootarch(ctx) {
    const r1 = [[14, 146], [20, 104], [58, 92], [92, 104], [94, 146]], r2 = [[128, 146], [130, 106], [164, 94], [200, 106], [206, 146]];
    for (const r of [r1, r2]) { colour(ctx, r, C.grey, { gap: 6 }); crayon(ctx, r, C.dkgrey, 4, { close: true }); }
    crayon(ctx, bow(74, 104, 110, 22, 148, 104, 12), C.brown, 7);
    crayon(ctx, bow(86, 106, 110, 46, 136, 106, 10), C.tan, 4);
    crayon(ctx, zigzag(24, 88, 98, 8, 7), C.green, 3.6, { amp: 0.8 }); crayon(ctx, zigzag(134, 196, 100, 8, 7), C.green, 3.6, { amp: 0.8 });
    grass(ctx, 6, 214, 152, 7);
    letters(ctx, 'root bridge', 54, 28, C.brown, 16);
  },
  slug(ctx) {
    const log = [[8, 120], [212, 116], [212, 152], [8, 152]];
    colour(ctx, log, C.brown, { gap: 6, ang: 0.05 }); crayon(ctx, log, C.brown, 4, { close: true });
    const body = [[44, 106], [48, 84], [84, 72], [130, 72], [168, 84], [184, 108], [150, 114], [84, 114]];
    colour(ctx, body, C.yellow, { gap: 4.5, ang: 0.15, a: 0.62 }); crayon(ctx, body, C.orange, 4, { close: true });
    for (let i = 0; i < 7; i++) dot(ctx, rnd(80, 168), rnd(82, 106), rnd(2.5, 4.5), C.black);
    crayon(ctx, [[52, 88], [40, 60]], C.orange, 3.2); crayon(ctx, [[64, 82], [60, 54]], C.orange, 3.2);
    dot(ctx, 40, 58, 3.2, C.black); dot(ctx, 60, 52, 3.2, C.black);
    crayon(ctx, bow(50, 100, 58, 108, 68, 100, 5), C.red, 2.6, { amp: 0.6 });
    letters(ctx, 'SLUG !!', 98, 44, C.orange, 20);
  },
  masonmark(ctx) {
    for (let r = 0; r < 4; r++) {
      const y = 26 + r * 30;
      for (let k = 0; k < 4; k++) {
        const x = 8 + k * 54 + (r % 2 ? 22 : 0), brick = [[x, y], [Math.min(214, x + 50), y + rnd(-2, 2)], [Math.min(214, x + 50), y + 26], [x, y + 26 + rnd(-2, 2)]];
        if (x > 206) continue;
        if ((r + k) % 2 === 0) colour(ctx, brick, C.red, { gap: 6, ang: 0.05, a: 0.38 });
        crayon(ctx, brick, C.red, 3, { close: true, amp: 1.2 });
      }
    }
    crayon(ctx, [[84, 62], [94, 80], [104, 64], [114, 80], [124, 62]], C.black, 5, { amp: 1 });
    crayon(ctx, [[104, 64], [104, 84]], C.black, 4.5, { amp: 1 });
    letters(ctx, 'old wall', 68, 152, C.black, 16);
  },
  feather(ctx) {
    grass(ctx, 6, 214, 152, 10);
    const vane = [[52, 128], [70, 92], [112, 58], [160, 36], [192, 30], [176, 56], [140, 92], [96, 122]];
    colour(ctx, vane, C.night, { gap: 4, ang: -0.9, a: 0.6 }); colour(ctx, vane, C.blue, { gap: 11, ang: -0.9, a: 0.4, w: 3 });
    crayon(ctx, vane, C.black, 3.6, { close: true });
    crayon(ctx, [[30, 142], [194, 30]], C.black, 4.4, { amp: 1.2 });
    letters(ctx, 'ravens fether', 12, 28, C.night, 15);
  },
  cowbell(ctx) {
    grass(ctx, 6, 214, 152, 12);
    const bell = [[84, 58], [136, 58], [154, 126], [66, 126]];
    colour(ctx, bell, C.yellow, { gap: 5, ang: 1.3, a: 0.6 }); colour(ctx, bell, C.orange, { gap: 13, ang: 1.3, a: 0.35 });
    crayon(ctx, bell, C.brown, 4.4, { close: true });
    crayon(ctx, bow(96, 58, 110, 30, 124, 58, 8), C.brown, 4.4);
    crayon(ctx, [[110, 100], [112, 134]], C.black, 3.4); dot(ctx, 112, 138, 5, C.black);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) crayon(ctx, [[110 + s * (58 + i * 2), 76 + i * 16], [110 + s * (76 + i * 3), 70 + i * 18]], C.red, 3, { amp: 0.7 });
    letters(ctx, 'ding ding', 14, 30, C.red, 17);
  },
  ironpin(ctx) {
    const wall = [[6, 22], [214, 22], [214, 142], [6, 142]];
    colour(ctx, wall, C.grey, { gap: 9, ang: 0.08, a: 0.3, w: 4 });
    const ring = blob(110, 96, 30, 30, 14, 0.06);
    crayon(ctx, ring, C.orange, 7, { close: true, amp: 1.2 }); crayon(ctx, ring, C.brown, 3, { close: true, amp: 1.4 });
    crayon(ctx, [[110, 66], [110, 42]], C.black, 5.5, { amp: 0.8 }); dot(ctx, 110, 38, 6, C.black);
    for (let i = 0; i < 4; i++) { const x = 92 + i * 12; crayon(ctx, [[x, 128], [x + rnd(-3, 3), rnd(136, 150)]], C.orange, 2.6, { amp: 0.8 }); }
    crayon(ctx, zigzag(8, 60, 150, 9, 6), C.green, 3.4, { amp: 0.8 }); crayon(ctx, zigzag(160, 212, 150, 9, 6), C.green, 3.4, { amp: 0.8 });
    letters(ctx, 'iron ring', 122, 60, C.brown, 15);
  },
  kneechair(ctx) {
    for (const y of [140, 152]) crayon(ctx, zigzag(6, 214, y, 5, 13), C.blue, 3.4, { amp: 1 });
    const back = [[60, 106], [56, 44], [86, 42], [86, 106]], seat = [[56, 104], [152, 104], [152, 124], [56, 124]], foot = [[74, 124], [70, 148], [140, 148], [136, 124]];
    for (const p of [back, seat, foot]) { colour(ctx, p, C.tan, { gap: 5, a: 0.55 }); crayon(ctx, p, C.brown, 4, { close: true }); }
    // somebody sitting in it
    crayon(ctx, blob(118, 58, 10, 10, 9, 0.08), C.black, 2.8, { close: true, amp: 0.9 });
    crayon(ctx, [[118, 68], [118, 100]], C.black, 2.8); crayon(ctx, [[118, 100], [144, 102], [146, 124]], C.black, 2.8); crayon(ctx, [[106, 80], [132, 80]], C.black, 2.8);
    dot(ctx, 114, 56, 1.5, C.black); dot(ctx, 122, 56, 1.5, C.black); crayon(ctx, bow(113, 61, 118, 65, 123, 61, 4), C.red, 2, { amp: 0.4 });
    crayon(ctx, bow(170, 138, 178, 108, 186, 138, 6), C.brown, 4); crayon(ctx, bow(192, 140, 198, 120, 204, 140, 6), C.brown, 4);
    letters(ctx, 'tree chair', 96, 30, C.brown, 16);
  },
  radbro(ctx) {
    const face = [[62, 96], [66, 74], [84, 60], [100, 74], [112, 60], [150, 68], [162, 98], [152, 128], [112, 142], [78, 134]];
    colour(ctx, face, C.skin, { gap: 5, ang: 0.2, a: 0.6 });
    const hair = [[52, 104], [42, 62], [58, 30], [100, 14], [148, 20], [176, 48], [180, 100], [162, 104], [152, 68], [114, 58], [100, 76], [84, 58], [66, 76], [62, 104]];
    colour(ctx, hair, C.brown, { gap: 4.5, ang: 0.5, a: 0.62 }); crayon(ctx, hair, C.brown, 4.4, { close: true });
    crayon(ctx, face, C.black, 3, { close: true, amp: 1.3 });
    for (const [ex, tilt] of [[88, 1], [136, -1]]) {
      const eye = [[ex - 16, 98 - tilt * 3], [ex - 8, 84 - tilt * 2], [ex + 10, 84 + tilt * 2], [ex + 16, 98 + tilt * 3], [ex + 8, 114], [ex - 10, 112]];
      colour(ctx, eye, C.tan, { gap: 4, a: 0.6, w: 3 }); crayon(ctx, eye, C.black, 3.6, { close: true, amp: 1 });
      dot(ctx, ex + 1, 100, 6, C.black);
    }
    crayon(ctx, [[70, 76], [104, 86]], C.black, 5, { amp: 1 }); crayon(ctx, [[156, 72], [122, 84]], C.black, 5, { amp: 1 });
    crayon(ctx, [[102, 128], [124, 127]], C.black, 3.4, { amp: 0.6 });
    crayon(ctx, zigzag(6, 56, 150, 12, 6), C.green, 3.6, { amp: 0.8 }); crayon(ctx, zigzag(166, 214, 150, 12, 6), C.green, 3.6, { amp: 0.8 });
    letters(ctx, 'RADBRO', 8, 26, C.dkgreen, 18);
  },
};

// the player came upon this place's find: hold the sketch up for a moment (once per visit to a place)
export class Finds {
  // seen: this walk through this place (the card is held up once a visit). ever: everything found on any walk, kept on
  // the device and with the account (cloud.js), which is what the satchel lists.
  constructor($) { this.$ = $; this.seen = new Set(); this.reload(); }
  reload() { try { this.ever = JSON.parse(localStorage.getItem('moss-maze-finds-v1') || '{}') || {}; } catch { this.ever = {}; } }
  reset() { this.seen.clear(); }
  isFound(id) { return this.seen.has(id); }
  wasFound(id) { return !!this.ever[id] || this.seen.has(id); }
  found(id, level, placeName) {
    const F = findOf(id);
    if (this.seen.has(id) || !F) return false;
    this.seen.add(id);
    if (!this.ever[id]) { this.ever[id] = level || 1; try { localStorage.setItem('moss-maze-finds-v1', JSON.stringify(this.ever)); } catch { /* storage blocked */ } }
    const toast = this.$('#find');
    toast.querySelector('.find-title').textContent = F.title;
    toast.querySelector('.find-sub').textContent = `${placeName.toLowerCase()} · maze ${level}`; toast.querySelector('.find-sub').style.color = '';
    this.note(toast, F);
    this.draw(toast.querySelector('canvas'), id);
    toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
    return true;
  }
  // any card at all: { title, sub, note, latin, color, draw(ctx, w, h) } (the Bug Book's pages)
  card(o) {
    const toast = this.$('#find');
    toast.querySelector('.find-title').textContent = o.title || '';
    const sub = toast.querySelector('.find-sub'); sub.textContent = o.sub || ''; sub.style.color = o.color || '';
    this.note(toast, { note: o.note || '' });
    if (o.latin) { const e = document.createElement('em'); e.textContent = o.latin; const n = toast.querySelector('.find-note'); if (n.textContent) n.appendChild(document.createElement('br')); n.appendChild(e); }
    const canvas = toast.querySelector('canvas'), w = 220, h = o.h || 160, dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    if (o.draw) o.draw(ctx, w, h);
    toast.style.animationDuration = '7s';
    toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
  }
  // hold a found one's drawing up again (the satchel's Finds tab)
  show(id, sub = '') {
    const F = findOf(id); if (!F) return;
    const toast = this.$('#find');
    toast.querySelector('.find-title').textContent = F.title;
    toast.querySelector('.find-sub').textContent = sub; toast.querySelector('.find-sub').style.color = '';
    this.note(toast, F);
    this.draw(toast.querySelector('canvas'), id);
    toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
  }
  // what is written under the drawing; a long one gets a wide card and stays up long enough to read
  note(toast, F) {
    const text = F.note || '';
    toast.querySelector('.find-note').textContent = text;
    toast.classList.toggle('long', text.length > 320);
    toast.style.animationDuration = Math.min(50, 6 + text.length / 20).toFixed(1) + 's';
  }
  draw(canvas, id) {
    const w = 220, h = 160, dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const F = findOf(id);
    if (F && SKETCHES[F.kind]) SKETCHES[F.kind](ctx);
  }
}
