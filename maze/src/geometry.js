// Shared geometry helpers: a vertex-merging quad-grid builder, the world-space
// displacement field for walls, and canvas textures drawn in code.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { fbm3 } from './noise.js?v=a407dfed';

// The carve: a displacement field, continuous in world space so neighbouring
// faces agree. It is set per place before a build (`setCarve`), and every
// reader of it (the wall mesh, the player's collision, the prop guard, the
// shoots, the cushions) sees the same field. `amp` scales the carving, `max`
// caps it so a corridor can never pinch shut, `lump` adds rounded boulders
// that bulge at mid height, `heave` scales how much the tops rise and fall,
// and `flat` turns it off for walls that are not carved rock at all (stacked
// logs, palisades of trunks).
const CARVE_DEFAULT = { amp: 1, max: 0.32, lump: 0, lumpScale: 1.1, heave: 1, flat: false };
export const CARVE = { ...CARVE_DEFAULT };
export function setCarve(p) { Object.assign(CARVE, CARVE_DEFAULT, p || {}); }

export function disp(x, y, z, h) {
  if (CARVE.flat) return [0, 0, 0];
  const lx = fbm3(x * 0.33, y * 0.33, z * 0.33, 2) - 0.5;
  const lz = fbm3(x * 0.33 + 50, y * 0.33, z * 0.33 + 50, 2) - 0.5;
  const mx = fbm3(x * 0.9 + 21, y * 0.9, z * 0.9 + 21, 2) - 0.5;
  const mz = fbm3(x * 0.9 + 77, y * 0.9, z * 0.9 + 77, 2) - 0.5;
  const sx = fbm3(x * 2.2, y * 2.2, z * 2.2, 2) - 0.5;
  const sz = fbm3(x * 2.2 + 9, y * 2.2, z * 2.2 + 9, 2) - 0.5;
  const t = Math.max(0, Math.min(1, (y + 0.15) / (h + 0.15)));
  const m = CARVE.max, cl = v => Math.max(-m, Math.min(m, v));
  let dx = (lx * 0.4 + mx * 0.3 + sx * 0.14) * CARVE.amp * (0.3 + 0.7 * t);
  let dz = (lz * 0.4 + mz * 0.3 + sz * 0.14) * CARVE.amp * (0.3 + 0.7 * t);
  if (CARVE.lump > 0) {
    // boulders: each bulges out at its middle and recedes at the top and the foot
    const k = CARVE.lumpScale, bell = 4 * t * (1 - t);
    dx += (fbm3(x * k + 3, y * k * 0.7, z * k + 3, 2) - 0.5) * CARVE.lump * (0.35 + 0.65 * bell);
    dz += (fbm3(x * k + 40, y * k * 0.7, z * k + 40, 2) - 0.5) * CARVE.lump * (0.35 + 0.65 * bell);
  }
  // the tops heave, continuously along the wall
  const dy = CARVE.heave * ((fbm3(x * 0.6 + 3, 0, z * 0.6 + 3, 2) - 0.5) * 0.7 * Math.pow(t, 3) + (fbm3(x * 2.5, 1, z * 2.5, 2) - 0.5) * 0.16 * Math.pow(t, 6));
  return [cl(dx), dy, cl(dz)];
}

// the same field without its fine terms: enough to keep shoots on the surface, a third of the cost
export function dispFast(x, y, z, h) {
  if (CARVE.flat) return [0, 0, 0];
  const lx = fbm3(x * 0.33, y * 0.33, z * 0.33, 2) - 0.5;
  const lz = fbm3(x * 0.33 + 50, y * 0.33, z * 0.33 + 50, 2) - 0.5;
  const mx = fbm3(x * 0.9 + 21, y * 0.9, z * 0.9 + 21, 2) - 0.5;
  const mz = fbm3(x * 0.9 + 77, y * 0.9, z * 0.9 + 77, 2) - 0.5;
  const t = Math.max(0, Math.min(1, (y + 0.15) / (h + 0.15)));
  const m = CARVE.max, cl = v => Math.max(-m, Math.min(m, v));
  let dx = (lx * 0.4 + mx * 0.3) * CARVE.amp * (0.3 + 0.7 * t);
  let dz = (lz * 0.4 + mz * 0.3) * CARVE.amp * (0.3 + 0.7 * t);
  if (CARVE.lump > 0) {
    const k = CARVE.lumpScale, bell = 4 * t * (1 - t);
    dx += (fbm3(x * k + 3, y * k * 0.7, z * k + 3, 2) - 0.5) * CARVE.lump * (0.35 + 0.65 * bell);
    dz += (fbm3(x * k + 40, y * k * 0.7, z * k + 40, 2) - 0.5) * CARVE.lump * (0.35 + 0.65 * bell);
  }
  return [cl(dx), 0, cl(dz)];
}

const TAG_AXIS = { nx: [-1, 0, 0], px: [1, 0, 0], nz: [0, 0, -1], pz: [0, 0, 1], top: [0, 1, 0], floor: [0, 1, 0], ceil: [0, -1, 0], vault: [0, -1, 0] };

export class MeshBuilder {
  constructor(aoFn, seamFn) { this.pos = []; this.idx = []; this.ao = []; this.axis = []; this.seam = []; this.map = new Map(); this.aoFn = aoFn || (() => 1); this.seamFn = seamFn || (() => [0, 0]); }
  vertex(x, y, z, tag) {
    const key = `${Math.round(x * 500)},${Math.round(y * 500)},${Math.round(z * 500)},${tag}`;
    let i = this.map.get(key);
    if (i === undefined) {
      i = this.pos.length / 3; this.pos.push(x, y, z); this.ao.push(this.aoFn(x, y, z)); const sm = this.seamFn(x, y, z); this.seam.push(sm[0], sm[1]);
      const a = TAG_AXIS[tag] || [0, 1, 0]; this.axis.push(a[0], a[1], a[2]);
      this.map.set(key, i);
    }
    return i;
  }
  // quad grid: origin o, axis u (segs nu), axis v (segs nv); winding so the normal is u x v
  grid(o, u, v, nu, nv, tag, displace) {
    const ids = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const fu = i / nu, fv = j / nv;
      let x = o[0] + u[0] * fu + v[0] * fv, y = o[1] + u[1] * fu + v[1] * fv, z = o[2] + u[2] * fu + v[2] * fv;
      if (displace) { const d = displace(x, y, z, fu, fv); x += d[0]; y += d[1]; z += d[2]; }
      ids.push(this.vertex(x, y, z, tag));
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = ids[j * (nu + 1) + i], b = ids[j * (nu + 1) + i + 1], c = ids[(j + 1) * (nu + 1) + i], d = ids[(j + 1) * (nu + 1) + i + 1];
      this.idx.push(a, b, c, b, d, c);
    }
  }
  // a patch of nu x nv quads whose vertices come from pos(i, j) -> [x, y, z]; keep(i, j) may drop a quad.
  // Winding as grid: the normal is (i direction) x (j direction)
  patch(nu, nv, tag, pos, keep) {
    const ids = new Int32Array((nu + 1) * (nv + 1)).fill(-1);
    const id = (i, j) => { const k = j * (nu + 1) + i; if (ids[k] < 0) { const p = pos(i, j); ids[k] = this.vertex(p[0], p[1], p[2], tag); } return ids[k]; };
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      if (keep && !keep(i, j)) continue;
      const a = id(i, j), b = id(i + 1, j), c = id(i, j + 1), d = id(i + 1, j + 1);
      this.idx.push(a, b, c, b, d, c);
    }
  }
  empty() { return this.idx.length === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('ao', new THREE.Float32BufferAttribute(this.ao, 1));
    g.setAttribute('axis', new THREE.Float32BufferAttribute(this.axis, 3));
    g.setAttribute('seam', new THREE.Float32BufferAttribute(this.seam, 2));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    // vertices are kept apart per face tag so each face keeps its own projection, but the lighting must not
    // see that: average the normals of every vertex that shares a position, so a rounded top flows into its side
    {
      const n = g.attributes.normal.array, pos = this.pos, groups = new Map();
      for (let i = 0; i < pos.length / 3; i++) {
        const k = `${Math.round(pos[i * 3] * 500)},${Math.round(pos[i * 3 + 1] * 500)},${Math.round(pos[i * 3 + 2] * 500)}`;
        let gl = groups.get(k); if (!gl) { gl = []; groups.set(k, gl); } gl.push(i);
      }
      for (const gl of groups.values()) {
        if (gl.length < 2) continue;
        let x = 0, y = 0, z = 0;
        for (const i of gl) { x += n[i * 3]; y += n[i * 3 + 1]; z += n[i * 3 + 2]; }
        const l = Math.hypot(x, y, z) || 1;
        for (const i of gl) { n[i * 3] = x / l; n[i * 3 + 1] = y / l; n[i * 3 + 2] = z / l; }
      }
      g.attributes.normal.needsUpdate = true;
    }
    g.computeBoundingSphere();
    return g;
  }
}

export function canvasTexture(w, h, draw, srgb = true, cutout = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  if (cutout) fillTransparent(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// a cutout texture's transparent pixels are black, and bilinear filtering drags that black
// into every edge; give them the average drawn colour and a hair of alpha instead
function fillTransparent(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  if (!n) return;
  r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 2; }
    else if (d[i + 3] < 200) { const k = d[i + 3] / 200; d[i] = Math.round(d[i] * k + r * (1 - k)); d[i + 1] = Math.round(d[i + 1] * k + g * (1 - k)); d[i + 2] = Math.round(d[i + 2] * k + b * (1 - k)); }
  }
  ctx.putImageData(img, 0, 0);
}

// a smooth, irregular lump: an indexed sphere (shared vertices, so normals are smooth) pushed by noise
export function lumpGeometry(seed, flatten = 0.55, rough = 0.6, detail = 20) {
  const geo = new THREE.SphereGeometry(1, detail, Math.round(detail * 0.7));
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const w = 1 - rough * 0.5 + rough * fbm3(x * 2.2 + seed, y * 2.2, z * 2.2 + seed, 3);
    p.setXYZ(i, x * w, y * w * flatten, z * w);
  }
  geo.computeVertexNormals();
  return geo;
}

// the slow moss-layout field: a tileable noise image the shader samples and the CPU reads the same way
export function makeLowField(size = 256) {
  const data = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // tileable: blend four offset samples
    const u = x / size, v = y / size;
    const s = (fx, fy) => fbm3(fx * 6, 0.5, fy * 6, 3);
    const a = s(u, v), b = s(u - 1, v), c = s(u, v - 1), d = s(u - 1, v - 1);
    const wx = u * u * (3 - 2 * u), wy = v * v * (3 - 2 * v);
    data[y * size + x] = (a * (1 - wx) + b * wx) * (1 - wy) + (c * (1 - wx) + d * wx) * wy;
  }
  const bytes = new Uint8Array(size * size);
  let lo = 1, hi = 0; for (const v of data) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < data.length; i++) bytes[i] = Math.round((data[i] - lo) / (hi - lo) * 255);
  const tex = new THREE.DataTexture(bytes, size, size, THREE.RedFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  // the same lookup the shader does: uv = (x*0.09 + y*0.05, z*0.09 + y*0.07), bilinear, repeat
  const sample = (x, y, z) => {
    let u = (x * 0.09 + y * 0.05) % 1, v = (z * 0.09 + y * 0.07) % 1; if (u < 0) u += 1; if (v < 0) v += 1;
    const fx = u * size - 0.5, fy = v * size - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const g = (i, j) => bytes[(((j % size) + size) % size) * size + (((i % size) + size) % size)] / 255;
    return (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
  };
  return { tex, sample };
}

// hanging moss with body: a loose tuft of cards instead of one flat strip, so it reads as a hanging mass from
// every side and never as a green stick edge-on. Four cards fanned round the hang point at uneven angles, each a
// little off the centre, tapering to a ragged point, drifting out and curling as they fall, one longer than the
// rest. Hung from its top (y 0) down to y -1 in a unit box, uv v 1 at the top like the plane it replaces (the wind
// sways it by v), so an instance scales it by (width, length, width).
export function hangClumpGeometry(segs = 6) {
  const cards = [
    { a: 0.0, off: 0.06, len: 1.0, w: 1.0, lean: 0.05 },
    { a: 1.05, off: 0.12, len: 0.82, w: 0.8, lean: 0.12 },
    { a: 2.2, off: 0.1, len: 0.9, w: 0.85, lean: -0.09 },
    { a: 2.9, off: 0.16, len: 0.68, w: 0.7, lean: 0.15 },
  ];
  const pos = [], uv = [], idx = [];
  for (const k of cards) {
    const ca = Math.cos(k.a), sa = Math.sin(k.a);
    const ox = -sa * k.off, oz = ca * k.off;   // off the centre, sideways to the card
    const base = pos.length / 3;
    for (let j = 0; j <= segs; j++) {
      const t = j / segs, y = -t * k.len;
      // gathered at the top where it hangs from (a rounded shoulder, never a cut edge), full a little below, then
      // narrowing to a point
      const half = 0.5 * k.w * (0.35 + 0.65 * Math.sin(Math.min(1, t / 0.22) * Math.PI / 2)) * (1 - 0.55 * t);
      const out = k.lean * t * t;                        // drifts out from the bundle as it falls
      const bow = 0.12 * Math.sin(t * Math.PI) * k.w;    // the middle of the card bellies out
      for (const u of [0, 0.5, 1]) {
        const s = (u - 0.5) * 2 * half, b = out + bow * (1 - Math.abs(u - 0.5) * 2);
        pos.push(ox + ca * s - sa * b, y + (u === 0.5 ? 0 : 0.03 * (1 - t)), oz + sa * s + ca * b);
        uv.push(u, 1 - t * k.len);
      }
    }
    for (let j = 0; j < segs; j++) for (let c = 0; c < 2; c++) { const a = base + j * 3 + c; idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function withAO(geo, fn) {
  const p = geo.attributes.position; const a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) a[i] = fn(p.getX(i), p.getY(i), p.getZ(i));
  geo.setAttribute('ao', new THREE.BufferAttribute(a, 1));
  return geo;
}

// --- textures drawn in code -------------------------------------------------

const rnd = (a, b) => a + Math.random() * (b - a);

// moss strands hanging down (curtains)
export function curtainTexture() {
  return canvasTexture(256, 512, (ctx, w, h) => {
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * w, len = h * rnd(0.35, 1), wd = rnd(1, 3.5);
      const g = ctx.createLinearGradient(0, 0, 0, len);
      const c = rnd(60, 110), c2 = rnd(90, 150);
      g.addColorStop(0, `rgba(${c},${c2},${c * 0.55},1)`); g.addColorStop(1, `rgba(${c * 0.8},${c2 * 0.9},${c * 0.4},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x, 0);
      let px = x; for (let y = 0; y < len; y += 24) { px += rnd(-5, 5); ctx.lineTo(px, y); } ctx.stroke();
    }
  }, true, true);
}

// beard lichen / thread moss: many fine pale threads, forked, wispy
export function beardTexture() {
  return canvasTexture(256, 512, (ctx, w, h) => {
    const gauss = () => (Math.random() + Math.random() + Math.random()) / 3;
    for (let i = 0; i < 380; i++) {
      // threads cluster toward the middle and start at ragged heights, so the silhouette is a clump
      const x = w * (0.5 + (gauss() - 0.5) * 1.3), y0 = h * rnd(0, 0.22) * (0.3 + Math.abs(x / w - 0.5) * 2), len = h * rnd(0.15, 0.9) * (1.1 - Math.abs(x / w - 0.5) * 1.2), wd = rnd(0.5, 1.4);
      if (x < 0 || x > w || len < 10) continue;
      const c = rnd(120, 165), c2 = rnd(135, 175), b = rnd(80, 120);
      const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
      g.addColorStop(0, `rgba(${c},${c2},${b},0.6)`); g.addColorStop(0.3, `rgba(${c},${c2},${b},1)`); g.addColorStop(1, `rgba(${c},${c2},${b},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x, y0);
      let px = x; for (let y = y0; y < y0 + len; y += 14) { px += rnd(-4, 4); ctx.lineTo(px, y); if (Math.random() < 0.12) { ctx.moveTo(px, y); ctx.lineTo(px + rnd(-12, 12), y + rnd(10, 30)); ctx.moveTo(px, y); } } ctx.stroke();
    }
  }, true, true);
}

// a thick drape of pendant moss: dense ragged sheets, tips frayed
export function drapeTexture() {
  return canvasTexture(256, 512, (ctx, w, h) => {
    // a few clumps hanging from ragged starts, open between them
    const gauss = () => (Math.random() + Math.random() + Math.random()) / 3;
    const clumps = []; for (let k = 0; k < 3; k++) clumps.push([w * rnd(0.2, 0.8), h * rnd(0, 0.18), w * rnd(0.08, 0.2)]);
    for (let i = 0; i < 520; i++) {
      const [cx, cy, cr] = clumps[i % clumps.length];
      const x = cx + (gauss() - 0.5) * cr * 2.6, y0 = cy + rnd(0, h * 0.1), len = h * rnd(0.15, 0.75) * (1.15 - Math.abs(x - cx) / cr * 0.5), wd = rnd(2, 4.5);
      if (x < 0 || x > w || len < 10) continue;
      const c = rnd(55, 95), c2 = rnd(85, 135), b = rnd(30, 55);
      const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
      g.addColorStop(0, `rgba(${c},${c2},${b},0.7)`); g.addColorStop(0.2, `rgba(${c},${c2},${b},1)`); g.addColorStop(0.75, `rgba(${c * 0.85},${c2 * 0.9},${b * 0.8},1)`); g.addColorStop(1, `rgba(${c * 0.8},${c2 * 0.85},${b * 0.8},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x, y0);
      let px = x; for (let y = y0; y < y0 + len; y += 20) { px += rnd(-6, 6); ctx.lineTo(px, y); } ctx.stroke();
    }
    // frayed tips and little leaflets, on the strands only
    for (let i = 0; i < 500; i++) {
      const [cx, cy, cr] = clumps[i % clumps.length];
      const x = cx + (gauss() - 0.5) * cr * 2.4, y = cy + Math.random() * h * 0.7;
      ctx.fillStyle = `rgba(${rnd(90, 150)},${rnd(130, 185)},${rnd(45, 80)},${rnd(0.5, 1)})`;
      ctx.beginPath(); ctx.ellipse(x, y, rnd(1.5, 3.5), rnd(0.8, 1.8), Math.random() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
  }, true, true);
}

// a vine: a few thin stems with leaves along them
export function vineTexture() {
  return canvasTexture(256, 512, (ctx, w, h) => {
    for (let i = 0; i < 7; i++) {
      const x = rnd(20, w - 20), len = h * rnd(0.5, 1);
      ctx.strokeStyle = `rgb(${rnd(70, 100)},${rnd(80, 110)},${rnd(40, 60)})`; ctx.lineWidth = rnd(1.5, 3);
      ctx.beginPath(); ctx.moveTo(x, 0);
      let px = x; const pts = [];
      for (let y = 0; y < len; y += 12) { px += rnd(-5, 5); ctx.lineTo(px, y); pts.push([px, y]); } ctx.stroke();
      for (const [lx, ly] of pts) {
        if (Math.random() > 0.35) continue;
        const g = Math.round(rnd(95, 150)), r = Math.round(g * rnd(0.45, 0.6)), b = Math.round(g * rnd(0.3, 0.45));
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(rnd(-1.2, 1.2) + (Math.random() < 0.5 ? Math.PI : 0));
        const lw = rnd(7, 13), lh = rnd(12, 22);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(lw, lh * 0.3, lw * 0.8, lh, 0, lh); ctx.bezierCurveTo(-lw * 0.8, lh, -lw, lh * 0.3, 0, 0); ctx.fill();
        ctx.restore();
      }
    }
  }, true, true);
}

// Spanish moss: pale silver-grey festoons of fine curling threads, loose, hanging in long swags
export function spanishMossTexture() {
  return canvasTexture(256, 512, (ctx, w, h) => {
    const gauss = () => (Math.random() + Math.random() + Math.random()) / 3;
    for (let i = 0; i < 150; i++) {
      const x = w * (0.5 + (gauss() - 0.5) * 1.1), y0 = h * rnd(0, 0.12), len = h * rnd(0.3, 1.0) * (1.05 - Math.abs(x / w - 0.5) * 0.9), wd = rnd(0.5, 1.1);
      if (x < 0 || x > w || len < 10) continue;
      const c = rnd(118, 150), g = c + rnd(2, 14), b = rnd(98, 122);
      const gr = ctx.createLinearGradient(0, y0, 0, y0 + len);
      gr.addColorStop(0, `rgba(${c},${g},${b},0.5)`); gr.addColorStop(0.25, `rgba(${c},${g},${b},1)`); gr.addColorStop(1, `rgba(${c * 0.9},${g * 0.9},${b * 0.85},0)`);
      ctx.strokeStyle = gr; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x, y0);
      let px = x; const curl = rnd(4, 9), ph = rnd(0, 6);
      for (let y = y0; y < y0 + len; y += 8) { px += rnd(-3, 3) + Math.sin(y * 0.09 + ph) * 0.9; ctx.lineTo(px + Math.sin(y * 0.3 + ph) * curl * 0.3, y); if (Math.random() < 0.08) { ctx.moveTo(px, y); ctx.lineTo(px + rnd(-10, 10), y + rnd(8, 24)); ctx.moveTo(px, y); } }
      ctx.stroke();
    }
  }, true, true);
}

// upright moss / grass tuft
export function tuftTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    for (let i = 0; i < 230; i++) {
      const x = Math.random() * w, len = h * rnd(0.3, 1), wd = rnd(1, 3);
      const g = ctx.createLinearGradient(0, h, 0, h - len);
      const c = rnd(70, 130), c2 = rnd(95, 165);
      g.addColorStop(0, `rgba(${c * 0.6},${c2 * 0.7},${c * 0.35},1)`); g.addColorStop(0.7, `rgba(${c},${c2},${c * 0.5},1)`); g.addColorStop(1, `rgba(${c * 1.1},${c2 * 1.05},${c * 0.5},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x, h);
      let px = x; const lean = rnd(-0.25, 0.25);
      for (let y = h; y > h - len; y -= 10) { px += rnd(-2.5, 2.5) + lean * 3; ctx.lineTo(px, y); } ctx.stroke();
    }
  }, true, true);
}

// crest tufts: four tufts side by side in one atlas, each a clump of blades rising from a scattered
// ragged root zone (nothing straight-edged at the bottom: the lowest roots thin out and the card's
// foot is transparent), drawn in a light neutral so the wall's own moss tint colours them
export const TUFT_VARIANTS = 4;
export function tuftAtlas() {
  const cw = 256, ch = 256;
  return canvasTexture(cw * TUFT_VARIANTS, ch, (ctx, w, h) => {
    const gauss = () => (Math.random() + Math.random() + Math.random()) / 3;
    for (let v = 0; v < TUFT_VARIANTS; v++) {
      const ox = v * cw, cx = cw * (0.5 + rnd(-0.06, 0.06)), spread = cw * rnd(0.15, 0.24), nBlades = 170 + Math.floor(Math.random() * 110);
      const full = rnd(0.5, 0.85);   // how tall this clump grows, as a share of the cell
      for (let i = 0; i < nBlades; i++) {
        const x = cx + (gauss() - 0.5) * 2 * spread * 1.6;
        if (x < 6 || x > cw - 6) continue;
        const off = Math.abs(x - cx) / spread;             // 0 at the heart of the clump
        const root = ch - 2 - Math.pow(Math.random(), 1.6) * ch * 0.16 * (0.6 + 0.4 * off);   // roots scattered up from the foot, the edge ones higher
        const len = ch * full * rnd(0.3, 1.0) * Math.max(0.15, 1 - off * 0.45);
        if (len < 12) continue;
        const L = rnd(118, 196);
        const g = ctx.createLinearGradient(0, root, 0, root - len);
        g.addColorStop(0, `rgba(${L * 0.45},${L * 0.52},${L * 0.3},1)`);
        g.addColorStop(0.35, `rgba(${L * 0.86},${L},${L * 0.6},1)`);
        g.addColorStop(1, `rgba(${L * 0.95},${L * 1.08},${L * 0.62},0)`);
        ctx.strokeStyle = g; ctx.lineWidth = rnd(0.9, 2.6) * (1 - 0.3 * off); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ox + x, root);
        let px = x; const lean = (x - cx) / spread * 1.6 + rnd(-0.5, 0.5), curl = rnd(-0.03, 0.03);
        let dx = lean * 0.35;
        for (let y = root; y > root - len; y -= 8) { dx += curl + rnd(-0.12, 0.12); px += dx; ctx.lineTo(ox + px, y); }
        ctx.stroke();
      }
      // the foot fades out over the last few pixels so the card never shows a straight base
      const d = ctx.getImageData(ox, 0, cw, ch), a = d.data, fade = Math.round(ch * 0.07);
      for (let y = ch - fade; y < ch; y++) { const k = (ch - y) / fade; for (let x = 0; x < cw; x++) a[(y * cw + x) * 4 + 3] *= k * k; }
      ctx.putImageData(d, ox, 0);
    }
  }, true, true);
}

// a fern: three to five fronds fanning up from the base, leaflets either side
export function fernTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const fronds = 4 + Math.floor(Math.random() * 2);
    for (let f = 0; f < fronds; f++) {
      const ang = -Math.PI / 2 + (f / (fronds - 1) - 0.5) * 1.5 + rnd(-0.1, 0.1);
      const len = h * rnd(0.6, 0.95);
      const bx = w / 2 + rnd(-6, 6), by = h - 2;
      const steps = 26;
      const col = `rgb(${Math.round(rnd(40, 70))},${Math.round(rnd(95, 135))},${Math.round(rnd(30, 55))})`;
      ctx.strokeStyle = col; ctx.fillStyle = col;
      // stem: a gentle arc
      let px = bx, py = by, pa = ang;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        pa += 0.012 * (f - (fronds - 1) / 2) * -1; // outer fronds droop outward
        const nx = px + Math.cos(pa) * (len / steps), ny = py + Math.sin(pa) * (len / steps);
        ctx.lineWidth = 2.2 * (1 - t) + 0.4; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
        // leaflets
        if (t > 0.12) {
          const ll = (1 - Math.abs(t - 0.5) * 1.4) * 22 + 3;
          for (const side of [-1, 1]) {
            const la = pa + side * 1.15;
            ctx.lineWidth = 2.4 * (1 - t) + 0.8;
            ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx + Math.cos(la) * ll, ny + Math.sin(la) * ll); ctx.stroke();
          }
        }
        px = nx; py = ny;
      }
    }
  }, true, true);
}

// broad-leaved undergrowth: a few big rounded leaves on stems
export function plantTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + rnd(-1.1, 1.1), len = h * rnd(0.3, 0.7);
      const bx = w / 2 + rnd(-10, 10), by = h - 2;
      const tx = bx + Math.cos(ang) * len, ty = by + Math.sin(ang) * len;
      const g = Math.round(rnd(80, 130)), r = Math.round(g * rnd(0.35, 0.6)), b = Math.round(g * rnd(0.25, 0.45));
      ctx.strokeStyle = `rgb(${r * 0.8},${g * 0.8},${b * 0.8})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo((bx + tx) / 2 + rnd(-10, 10), (by + ty) / 2, tx, ty); ctx.stroke();
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang + Math.PI / 2);
      const lw = rnd(18, 34), lh = rnd(30, 60);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(lw, -lh * 0.3, lw * 0.8, -lh, 0, -lh); ctx.bezierCurveTo(-lw * 0.8, -lh, -lw, -lh * 0.3, 0, 0); ctx.fill();
      ctx.strokeStyle = `rgba(0,0,0,0.25)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -lh * 0.9); ctx.stroke();
      ctx.restore();
    }
  }, true, true);
}

// a cluster of canopy leaves seen from below: dark blobs with holes
export function leafTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // a few clumps per card, leaves small, gaps between them
    const clumps = [];
    for (let k = 0; k < 7; k++) clumps.push([w * rnd(0.2, 0.8), h * rnd(0.2, 0.8), w * rnd(0.12, 0.26)]);
    for (let i = 0; i < 1600; i++) {
      const [cx, cy, cr] = clumps[i % clumps.length];
      const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.7) * cr;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      const s = rnd(2.5, 6);
      const g = Math.round(rnd(70, 125)), rr = Math.round(g * rnd(0.55, 0.8)), b = Math.round(g * rnd(0.3, 0.5));
      ctx.fillStyle = `rgb(${rr},${g},${b})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.random() * Math.PI);
      ctx.beginPath(); ctx.ellipse(0, 0, s, s * rnd(0.45, 0.7), 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }, true, true);
}

// rain streak
export function streakTexture() {
  return canvasTexture(16, 64, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(w / 2 - 1, 0, 2, h);
  });
}

// a mushroom, unwrapped along its profile: stem at the bottom of the image, gills, then the cap to the top
export function mushroomTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    // stem: pale, fibrous
    const g0 = ctx.createLinearGradient(0, h, 0, h * 0.45);
    g0.addColorStop(0, 'rgb(150,135,105)'); g0.addColorStop(1, 'rgb(205,190,160)');
    ctx.fillStyle = g0; ctx.fillRect(0, h * 0.45, w, h * 0.55);
    for (let i = 0; i < 160; i++) { ctx.strokeStyle = `rgba(90,75,55,${rnd(0.1, 0.35)})`; ctx.lineWidth = rnd(0.6, 1.6); const x = Math.random() * w; ctx.beginPath(); ctx.moveTo(x, h * rnd(0.45, 0.95)); ctx.lineTo(x + rnd(-3, 3), h); ctx.stroke(); }
    // gills: dark radial lines on a cream ground
    ctx.fillStyle = 'rgb(120,95,70)'; ctx.fillRect(0, h * 0.35, w, h * 0.1);
    for (let i = 0; i < 110; i++) { ctx.strokeStyle = `rgba(40,25,15,${rnd(0.5, 0.9)})`; ctx.lineWidth = rnd(0.8, 1.6); const x = (i + Math.random() * 0.6) * (w / 110); ctx.beginPath(); ctx.moveTo(x, h * 0.35); ctx.lineTo(x, h * 0.45); ctx.stroke(); }
    // cap: darker centre, radial fibres, speckles, a pale margin
    const g1 = ctx.createLinearGradient(0, 0, 0, h * 0.35);
    g1.addColorStop(0, 'rgb(95,60,35)'); g1.addColorStop(0.55, 'rgb(150,105,60)'); g1.addColorStop(1, 'rgb(190,160,115)');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, w, h * 0.35);
    for (let i = 0; i < 220; i++) { ctx.strokeStyle = `rgba(60,35,20,${rnd(0.08, 0.3)})`; ctx.lineWidth = rnd(0.6, 1.8); const x = Math.random() * w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + rnd(-4, 4), h * rnd(0.2, 0.35)); ctx.stroke(); }
    for (let i = 0; i < 120; i++) { ctx.fillStyle = `rgba(230,215,185,${rnd(0.15, 0.45)})`; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h * 0.33, rnd(0.8, 2.4), 0, Math.PI * 2); ctx.fill(); }
  });
}

export function shaftTexture() {
  return canvasTexture(64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,245,220,0.9)'); g.addColorStop(0.7, 'rgba(255,245,220,0.25)'); g.addColorStop(1, 'rgba(255,245,220,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const r = ctx.createLinearGradient(0, 0, w, 0);
    r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.3, 'rgba(0,0,0,0)'); r.addColorStop(0.7, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = r; ctx.fillRect(0, 0, w, h);
  });
}

export function glowTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,248,225,1)'); g.addColorStop(0.35, 'rgba(255,244,210,0.55)'); g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
}
