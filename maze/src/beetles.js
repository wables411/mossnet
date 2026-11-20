// The bugs of Beetleboy, loose in the maze: each one is its own top-down picture (beetle.wiki, public CC0) laid flat on
// whatever it walks on. They crawl over walls, moss and floor, dig into the moss and come up again a little way off,
// and fly when you come too close. A click on one writes it into the Bug Book (the satchel's own tab), kept in
// localStorage across mazes and visits.
import * as THREE from '../lib/three.module.js?v=88cddb5c';

// the wiki's rarities and their colours; `w` is how often one turns up
export const RARITY = {
  tin: { name: 'Tin', color: '#4fc45a', w: 40 },
  bronze: { name: 'Bronze', color: '#e0b83a', w: 24 },
  mithril: { name: 'Mithril', color: '#3fd0d0', w: 9 },
  adamantine: { name: 'Adamantine', color: '#e052c8', w: 3.5 },
  diamond: { name: 'Diamond', color: '#9fd8ff', w: 1.2 },
};
// name, description, Latin name and rarity as the wiki gives them. size: the picture's edge in metres (legs and feelers
// included; larger than life so it can be seen from a step away). air: how it leaves ('fly' buzzes off, 'flutter' has
// slow wings, 'none' can only run and dig). pic: false until its picture is in textures/beetles/.
export const BEETLES = [
  { id: 'green', name: 'Green Beetle', desc: 'Tansy beetle', latin: 'Chrysolina graminis', rarity: 'tin', size: 0.075, air: 'fly' },
  { id: 'cucumber', name: 'Striped Cucumber Beetle', desc: 'Striped cucumber beetle', latin: 'Acalymma vittatum', rarity: 'bronze', size: 0.07, air: 'fly' },
  { id: 'ladybug', name: 'Ladybug', desc: 'Common ladybug', latin: 'Coccinella septempunctata', rarity: 'bronze', size: 0.065, air: 'fly' },
  { id: 'purple', name: 'Purple Beetle', desc: 'Violet leaf beetle', latin: 'Chrysolina sturmi', rarity: 'bronze', size: 0.075, air: 'fly' },
  { id: 'blue_longicorn', name: 'Black-Spotted Blue Longicorn', desc: 'Black-spotted blue longicorn', latin: 'Rosalia batesi', rarity: 'mithril', size: 0.12, air: 'fly' },
  { id: 'bumblebee', name: 'Bumblebee', desc: 'Buff-tailed bumblebee', latin: 'Bombus terrestris', rarity: 'mithril', size: 0.075, air: 'flutter', beat: 38 },
  { id: 'christmas', name: 'Christmas Beetle', desc: 'Spotted flower beetle', latin: 'Stephanorrhina guttata', rarity: 'mithril', size: 0.095, air: 'fly' },
  { id: 'giraffe_weevil', name: 'Giraffe Weevil', desc: 'Giraffe weevil', latin: 'Trachelophorus giraffa', rarity: 'mithril', size: 0.095, air: 'fly' },
  { id: 'golden_tiger', name: 'Golden-Spotted Tiger Beetle', desc: 'Golden-spotted tiger beetle', latin: 'Cicindela aurulenta', rarity: 'mithril', size: 0.085, air: 'fly', quick: 2.4 },
  { id: 'imperial_tortoise', name: 'Imperial Tortoise Beetle', desc: 'Imperial tortoise beetle', latin: 'Stolas imperialis', rarity: 'mithril', size: 0.085, air: 'fly', quick: 0.6 },
  { id: 'monarch', name: 'Monarch', desc: 'Monarch', latin: 'Danaus plexippus', rarity: 'mithril', size: 0.14, air: 'flutter', beat: 9 },
  { id: 'pillbug', name: 'Pillbug', desc: 'Beautiful pill woodlouse', latin: 'Armadillidium pulchellum', rarity: 'mithril', size: 0.065, air: 'none' },
  { id: 'pond', name: 'Pond Beetle', desc: 'Lesser silver water beetle', latin: 'Hydrochara caraboides', rarity: 'mithril', size: 0.085, air: 'fly' },
  { id: 'skull', name: 'Skull Bug', desc: 'Death head bug', latin: 'Eucorysses grandis', rarity: 'mithril', size: 0.09, air: 'fly' },
  { id: 'bombardier', name: 'Bombardier Beetle', desc: 'Bombardier beetle', latin: 'Brachinus explodens', rarity: 'adamantine', size: 0.085, air: 'fly', quick: 1.6 },
  { id: 'death_feigning', name: 'Blue Death Feigning Beetle', desc: 'Blue death-feigning beetle', latin: 'Asbolus verrucosus', rarity: 'adamantine', size: 0.085, air: 'none' },
  { id: 'goliath', name: 'Goliath Beetle', desc: 'Goliath beetle', latin: 'Goliathus goliatus', rarity: 'adamantine', size: 0.16, air: 'fly', quick: 0.7 },
  { id: 'harlequin', name: 'Harlequin Beetle', desc: 'Harlequin beetle', latin: 'Acrocinus longimanus', rarity: 'adamantine', size: 0.16, air: 'fly' },
  { id: 'pondhawk', name: 'Eastern Pondhawk', desc: 'Eastern pondhawk', latin: 'Erythemis simplicicollis', rarity: 'adamantine', size: 0.13, air: 'flutter', beat: 30 },
  { id: 'sabertooth_longhorn', name: 'Sabertooth Longhorn Beetle', desc: 'Sabertooth longhorn beetle', latin: 'Macrodontia cervicornis', rarity: 'adamantine', size: 0.18, air: 'fly', quick: 0.7 },
  { id: 'stag', name: 'Stag Beetle', desc: 'Japanese great stag beetle', latin: 'Dorcus hopei binodulosus', rarity: 'adamantine', size: 0.14, air: 'fly', quick: 0.7 },
  { id: 'sunset_moth', name: 'Sunset Moth', desc: 'Madagascan sunset moth', latin: 'Chrysiridia rhipheus', rarity: 'adamantine', size: 0.14, air: 'flutter', beat: 11 },
  { id: 'gold', name: 'Golden Scarab', desc: 'Jewel scarab', latin: 'Chrysina resplendens', rarity: 'diamond', size: 0.095, air: 'fly' },
  { id: 'mars_rhino', name: 'Mars Rhino Beetle', desc: 'Mars rhino beetle', latin: 'Megasoma mars', rarity: 'diamond', size: 0.17, air: 'fly', quick: 0.6 },
  { id: 'whipscorpion', name: 'Tailless Whipscorpion', desc: 'Tailless whipscorpion', latin: 'Heterophrynus longicornis', rarity: 'diamond', size: 0.17, air: 'none' },
  // the holiday ones: the wiki has their pictures and rarities, and no description or Latin name
  { id: 'widow', name: 'Black Widow', desc: 'Halloween', latin: '', rarity: 'diamond', size: 0.09, air: 'none', quick: 1.5 },
  { id: 'candycane_tiger', name: 'Candycane Tiger Moth', desc: 'Christmas', latin: '', rarity: 'diamond', size: 0.13, air: 'flutter', beat: 13 },
];
const BY_ID = Object.fromEntries(BEETLES.map(b => [b.id, b]));
export const beetleOf = id => BY_ID[id] || null;
// the beetlegirl each beetle has on the wiki (her portrait, 832x1216), shown beside the beetle on its Bug Book page.
// Only the ones whose picture is in textures/beetlegirls/ are listed; the rest show the beetle alone.
export const GIRLS = new Set([]);
export const beetleGirl = id => (GIRLS.has(id) ? new URL(`../textures/beetlegirls/${id}.webp`, import.meta.url).href : null);
export const beetlePic = id => new URL(`../textures/beetles/${id}.png`, import.meta.url).href;

// --- the Bug Book: which have been seen, and how many times
const KEY = 'moss-maze-bugs-v1';
export class BugBook {
  constructor() { this.reload(); }
  reload() { try { this.seen = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { this.seen = {}; } }
  has(id) { return !!this.seen[id]; }
  // true the first time
  add(id) { const first = !this.seen[id]; this.seen[id] = (this.seen[id] || 0) + 1; try { localStorage.setItem(KEY, JSON.stringify(this.seen)); } catch { /* storage blocked */ } return first; }
  count() { return BEETLES.filter(b => this.seen[b.id]).length; }
  total() { return BEETLES.filter(b => b.pic !== false || this.seen[b.id]).length; }
  list() {
    return BEETLES.filter(b => b.pic !== false || this.seen[b.id]).map(b => ({ id: b.id, name: b.name, found: !!this.seen[b.id], times: this.seen[b.id] || 0, rarity: RARITY[b.rarity].name, color: RARITY[b.rarity].color }));
  }
}

// --- what they stand on. Asking three.js for a ray against the whole wall (a hundred thousand triangles, one after
// another) takes about 30 ms, a stutter every time a beetle appears. So the walls' and floor's triangles are sorted
// once per maze into a grid of bins on the ground plan, a few milliseconds a frame until done, and a ray then looks
// only at the bins it passes through.
const CELL = 1.2;
export const SCALE = 1.7;      // every bug this much larger than its listed size: at life size they are a few pixels from two steps off
export class SurfaceGrid {
  constructor(meshes) {
    this.jobs = meshes.map(m => ({ m, i: 0, n: (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 | 0 }));
    const total = this.jobs.reduce((s, j) => s + j.n, 0);
    this.tri = new Float32Array(total * 9); this.count = 0; this.bins = new Map(); this.ready = total === 0; this.stamp = new Uint32Array(total); this.tick = 0;
    this.job = 0;
  }
  key(ix, iz) { return (ix + 4096) * 8192 + (iz + 4096); }
  // sort some more triangles in, for at most `ms`
  work(ms) {
    if (this.ready) return;
    const t0 = performance.now(), T = this.tri, a = new THREE.Vector3();
    while (this.job < this.jobs.length) {
      const j = this.jobs[this.job], g = j.m.geometry, pos = g.attributes.position, idx = g.index, mw = j.m.matrixWorld;
      for (; j.i < j.n; j.i++) {
        if ((j.i & 511) === 511 && performance.now() - t0 > ms) return;
        const o = this.count * 9;
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
        for (let k = 0; k < 3; k++) {
          const v = idx ? idx.getX(j.i * 3 + k) : j.i * 3 + k;
          a.fromBufferAttribute(pos, v).applyMatrix4(mw);
          T[o + k * 3] = a.x; T[o + k * 3 + 1] = a.y; T[o + k * 3 + 2] = a.z;
          if (a.x < x0) x0 = a.x; if (a.x > x1) x1 = a.x; if (a.z < z0) z0 = a.z; if (a.z > z1) z1 = a.z;
        }
        if (x1 - x0 > CELL * 10 || z1 - z0 > CELL * 10) continue;      // (the far hills: nothing walks there)
        for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
          const k = this.key(ix, iz); let b = this.bins.get(k); if (!b) this.bins.set(k, b = []); b.push(this.count);
        }
        this.count++;
      }
      this.job++;
    }
    this.ready = true; this.jobs = null;
  }
  // the nearest triangle along the ray within `far`: { point, normal (turned to face the ray), distance } or null
  cast(origin, dir, far) {
    if (!this.ready) return null;
    const T = this.tri, ox = origin.x, oy = origin.y, oz = origin.z, dx = dir.x, dy = dir.y, dz = dir.z;
    let best = far, bn = null;
    const tick = ++this.tick, steps = Math.max(1, Math.ceil(far / (CELL * 0.4)));
    let lk = -1;
    for (let s = 0; s <= steps; s++) {
      const d = far * s / steps, k = this.key(Math.floor((ox + dx * d) / CELL), Math.floor((oz + dz * d) / CELL));
      if (k === lk) continue; lk = k;
      const bin = this.bins.get(k); if (!bin) continue;
      for (let q = 0; q < bin.length; q++) {
        const i = bin[q]; if (this.stamp[i] === tick) continue; this.stamp[i] = tick;
        const o = i * 9, ax = T[o], ay = T[o + 1], az = T[o + 2];
        const e1x = T[o + 3] - ax, e1y = T[o + 4] - ay, e1z = T[o + 5] - az, e2x = T[o + 6] - ax, e2y = T[o + 7] - ay, e2z = T[o + 8] - az;
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz; if (det > -1e-10 && det < 1e-10) continue;
        const inv = 1 / det, tx = ox - ax, ty = oy - ay, tz = oz - az;
        const u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv; if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > 1e-4 && t < best) { best = t; bn = [e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x]; }
      }
    }
    if (!bn) return null;
    const n = new THREE.Vector3(bn[0], bn[1], bn[2]).normalize(); if (n.dot(dir) > 0) n.negate();
    return { point: new THREE.Vector3(ox + dx * best, oy + dy * best, oz + dz * best), normal: n, distance: best };
  }
}

const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _v = new THREE.Vector3(), _o = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const rand = (a, b) => a + Math.random() * (b - a);
// any unit vector square to n
function tangentOf(n, out) { out.set(-n.z, 0, n.x); if (out.lengthSq() < 1e-4) out.set(1, 0, 0); return out.normalize(); }

export class Beetles {
  // o: { scene, camera, meshes() -> the solid meshes of this maze (walls, floor), puff(x,y,z,nx,ny,nz,n), water(x,z) -> depth, max }
  constructor(o) {
    this.o = o; this.book = new BugBook();
    this.group = new THREE.Group(); this.group.name = 'beetles'; o.scene.add(this.group);
    this.geo = new THREE.PlaneGeometry(1, 1, 8, 8);      // a grid, not one square: the sides of the picture, where the legs are, are moved to step
    this.base = this.geo.attributes.position.array.slice();
    this.mats = {}; this.live = []; this.cool = 3; this.max = o.max || 5;
    this.loader = new THREE.TextureLoader();
    const total = BEETLES.filter(b => b.pic !== false).reduce((s, b) => s + RARITY[b.rarity].w, 0);
    this.pickSpecies = () => { let r = Math.random() * total; for (const b of BEETLES) { if (b.pic === false) continue; r -= RARITY[b.rarity].w; if (r <= 0) return b; } return BEETLES[0]; };
  }
  matsOf(sp) {
    if (this.mats[sp.id]) return this.mats[sp.id];
    const tex = this.loader.load(beetlePic(sp.id)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    // neither writes depth: the beetle finds the surface it stands on by reading the picture's depth (seat(), below) and must
    // not find itself there. So both are blended and drawn in order after the world: the shadow, then the body.
    const body = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.3, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.38, metalness: 0, envMapIntensity: 0.7 });
    const shade = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide });
    return (this.mats[sp.id] = { body, shade, tex });
  }
  clear() { for (const b of this.live) this.drop(b); this.live.length = 0; this.cool = 3; this.grid = null; }
  cast(origin, dir, far) { return this.grid ? this.grid.cast(origin, dir, far) : null; }
  drop(b) { this.group.remove(b.mesh); this.group.remove(b.shade); b.geo.dispose(); }
  // The walk. A beetle's body goes forward steadily; its legs step three at a time: front and back of one side with the
  // middle of the other, then the other three. The picture is seen from above with the legs out to the sides, so the
  // strips of it beside the body are slid forward and back along the heading: front and back of a side one way, the
  // middle the other, the two sides opposite. The body's strip down the middle does not move.
  legs(b) {
    const p = b.geo.attributes.position, a = p.array, B = this.base, s = Math.sin(b.gait) * 0.055;
    for (let i = 0; i < a.length; i += 3) {
      const x = B[i], y = B[i + 1], ax = Math.abs(x);
      let w = (ax - 0.2) / 0.16; w = w < 0 ? 0 : w > 1 ? 1 : w; w = w * w * (3 - 2 * w);
      a[i + 1] = y + s * w * (x > 0 ? 1 : -1) * Math.cos(Math.PI * 2 * (y + 0.5));
    }
    p.needsUpdate = true;
  }

  // put one on a surface found by a ray from the eye: mostly ahead and to the sides, a wall or the floor
  spawn(player, force = null) {
    const cam = this.o.camera, eye = cam.getWorldPosition(_o).clone();
    const yaw = player.yaw + rand(-1.25, 1.25), floor = Math.random() < 0.3;
    const pitch = floor ? -rand(0.3, 0.8) : rand(-0.45, 0.2);
    const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const hit = this.cast(eye, dir, 7);
    if (!hit || hit.distance < 1.1 || hit.normal.y < -0.3) return null;
    if (hit.normal.y > 0.6 && this.o.water && this.o.water(hit.point.x, hit.point.z) > 0) return null;
    for (const b of this.live) if (b.pos.distanceToSquared(hit.point) < 0.09) return null;
    if (this.o.blocked && this.o.blocked(eye, hit.point)) return null;      // under a cushion or behind a fern: nobody would see it
    const sp = force || this.pickSpecies(), m = this.matsOf(sp);
    const geo = this.geo.clone();
    const mesh = new THREE.Mesh(geo, m.body); mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.renderOrder = 3;
    const shade = new THREE.Mesh(geo, m.shade); shade.matrixAutoUpdate = false; shade.frustumCulled = false; shade.renderOrder = 2;
    const n = hit.normal.clone().normalize(), t = tangentOf(n, new THREE.Vector3());
    t.applyAxisAngle(n, rand(0, Math.PI * 2));
    const b = {
      sp, mesh, shade, geo, gait: rand(0, 6.28), pos: hit.point.clone(), n, t, size: sp.size * SCALE * rand(0.9, 1.1),
      state: 'emerge', time: 0, until: 0.8, speed: 0.085 * (sp.quick || 1) * rand(0.8, 1.25), rise: 0, riseT: 0, turn: 0, turnT: 0, refit: rand(0, 0.4), fix: new THREE.Vector3(),
      phase: rand(0, 6.28), k: 0, vel: new THREE.Vector3(), air: new THREE.Vector3(), caught: false,
    };
    this.group.add(shade); this.group.add(mesh); this.live.push(b);
    this.dust(b, 5);
    return b;
  }
  dust(b, n) { if (this.o.puff) this.o.puff(b.pos.x, b.pos.y, b.pos.z, b.n.x, b.n.y, b.n.z, n); }
  go(b, state, until) { b.state = state; b.time = 0; b.until = until; }
  // leave: into the air if it can, into the moss if it cannot
  flee(b, eye) {
    if (b.sp.air === 'none') { this.go(b, 'dig', 0.55); b.gone = true; return; }
    _v.copy(b.pos).sub(eye); _v.y = 0; if (_v.lengthSq() < 1e-4) _v.set(b.n.x, 0, b.n.z); _v.normalize();
    b.vel.copy(b.n).multiplyScalar(0.55).addScaledVector(UP, 0.5).addScaledVector(_v, 0.35);
    b.air.copy(b.pos).addScaledVector(b.n, b.rise + 0.02);
    this.go(b, 'fly', 2.6);
  }

  // a click along this ray: the nearest one it passes close to, not behind what the ray hit. Returns the species or null.
  // (Generous: there is no crosshair, so anything within about four degrees of the click counts, the one nearest the
  // line of the click first. Only a wall in between hides one: a leaf, a strand of moss or a raindrop in front does not.)
  tap(ray) {
    let best = null, bd = 1e9;
    for (const b of this.live) {
      if (b.state === 'under' || (b.state !== 'fly' && b.k < 0.35)) continue;
      const p = b.state === 'fly' ? b.air : _y.copy(b.pos).addScaledVector(b.n, b.rise);
      _v.copy(p).sub(ray.origin); const along = _v.dot(ray.direction);
      if (along < 0.15 || along > 7) continue;
      const off = Math.sqrt(Math.max(0, _v.lengthSq() - along * along)), score = off / along;
      if (off > Math.max(b.size * 1.1, along * 0.075) || score >= bd) continue;
      if (b.state !== 'fly') { const L = _v.length(), h = this.cast(ray.origin, _z.copy(_v).divideScalar(L), L); if (h && h.distance < L - 0.25) continue; }
      bd = score; best = b;
    }
    if (!best) return null;
    best.caught = true; best.startle = 0.9;      // it holds still a moment, as if it knows, then goes
    return best.sp;
  }

  update(dt, now, player, playing) {
    if (!this.live.length && !playing) return;
    const cam = this.o.camera, eye = cam.getWorldPosition(_o);
    if (playing) {
      if (!this.grid) this.grid = new SurfaceGrid(this.o.meshes());
      this.grid.work(3);
      this.cool -= dt;
      if (this.grid.ready && this.cool <= 0 && this.live.length < this.max) { this.cool = this.spawn(player) ? rand(1.5, 4.5) : 0.4; }      // (a ray that found nowhere to put one tries again soon)
    }
    this.seatT = (this.seatT || 0) - dt;
    if (this.seatT <= 0) { this.seatT = 0.2; this.seat(); }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const b = this.live[i]; b.time += dt;
      const far = b.pos.distanceTo(eye);
      if (far > 15 || (b.state === 'fly' && b.time > b.until) || (b.gone && b.state === 'under')) { this.drop(b); this.live.splice(i, 1); continue; }
      b.rise += (b.riseT - b.rise) * Math.min(1, dt * 8);
      const on = b.rise + 0.004;      // just proud of the surface that is drawn there
      let lift = on, k = 1, wig = 0, flat = 1;
      if (b.startle !== undefined) { b.startle -= dt; if (b.startle <= 0) { b.startle = undefined; if (b.state !== 'fly' && b.state !== 'under') this.flee(b, eye); } }
      if (b.state === 'emerge') {
        k = Math.min(1, b.time / b.until); k = k * k * (3 - 2 * k); lift = on - 0.02 * (1 - k); wig = Math.sin(now * 30 + b.phase) * 0.12 * (1 - k);
        if (b.time >= b.until) this.go(b, 'walk', rand(1.5, 4));
      } else if (b.state === 'pause') {
        if (b.time >= b.until) {
          const r = Math.random();
          if (r < 0.2 && b.sp.air !== 'flutter') this.go(b, 'dig', 0.9);      // (nothing with wings like those digs)
          else if (r < (b.sp.air === 'flutter' ? 0.42 : b.sp.air === 'fly' ? 0.27 : 0.2) && b.startle === undefined) this.flee(b, eye);
          else { this.go(b, 'walk', rand(2, 5.5)); b.turn = rand(-0.9, 0.9); }
        }
      } else if (b.state === 'walk') {
        b.turnT -= dt; if (b.turnT <= 0) { b.turn = rand(-1.1, 1.1); b.turnT = rand(0.3, 1.0); }
        b.t.applyAxisAngle(b.n, b.turn * dt);
        b.pos.addScaledVector(b.t, b.speed * dt);
        b.gait += b.speed * dt / b.size * 40; this.legs(b);      // the legs keep time with the ground covered: no rocking of the body
        b.refit -= dt;
        if (b.refit <= 0) {
          b.refit = 0.45;
          // feel for the surface just ahead: follow it if it is there, turn back if it is not
          _v.copy(b.pos).addScaledVector(b.n, 0.14).addScaledVector(b.t, b.size * 0.5);
          const h = this.cast(_v, _z.copy(b.n).negate(), 0.34);
          if (h && h.normal.y > -0.3 && h.normal.dot(b.n) > 0.5) {
            b.fix.copy(h.point).addScaledVector(b.t, -b.size * 0.5).sub(b.pos); const off = b.fix.dot(b.n); b.fix.copy(b.n).multiplyScalar(off);   // only the part toward or away from the surface
            b.n.lerp(h.normal, 0.6).normalize(); b.t.addScaledVector(b.n, -b.t.dot(b.n)).normalize();
          } else { b.t.negate(); b.pos.addScaledVector(b.t, b.size * 0.3); b.fix.set(0, 0, 0); }
        }
        if (b.time >= b.until) this.go(b, 'pause', rand(0.3, 1.5));
      } else if (b.state === 'dig') {
        const u = Math.min(1, b.time / b.until); k = 1 - u * u; lift = on - 0.03 * u; wig = Math.sin(now * 34 + b.phase) * 0.16 * u;
        if (b.time >= b.until) { this.dust(b, 6); this.go(b, 'under', rand(2.5, 7)); }
      } else if (b.state === 'under') {
        k = 0;
        if (b.time >= b.until) {
          // up again a hand's width away, if there is surface there
          tangentOf(b.n, _x).applyAxisAngle(b.n, rand(0, 6.28));
          _v.copy(b.pos).addScaledVector(b.n, 0.16).addScaledVector(_x, rand(0.08, 0.3));
          const h = this.cast(_v, _z.copy(b.n).negate(), 0.4);
          if (h && h.normal.y > -0.3) { b.pos.copy(h.point); b.n.copy(h.normal).normalize(); b.t.addScaledVector(b.n, -b.t.dot(b.n)); if (b.t.lengthSq() < 1e-3) tangentOf(b.n, b.t); b.t.normalize(); }
          b.fix.set(0, 0, 0); this.dust(b, 5); this.go(b, 'emerge', 0.8);
        }
      }
      // a step's worth of the correction toward the surface each frame, so it never jumps
      if (b.fix.lengthSq() > 1e-8) { const s = Math.min(1, dt * 6); b.pos.addScaledVector(b.fix, s); b.fix.multiplyScalar(1 - s); }
      // too close, and it goes (a caught one waits out its moment first)
      if (playing && b.startle === undefined && (b.state === 'pause' || b.state === 'walk') && far < 0.8) this.flee(b, eye);
      b.k = k;

      if (b.state === 'fly') {
        // up and away, weaving; the picture turns to face the eye and its wings beat
        const u = b.time / b.until;
        b.vel.addScaledVector(UP, 0.9 * dt); b.vel.x += Math.sin(now * 5.1 + b.phase) * 1.4 * dt; b.vel.z += Math.cos(now * 4.3 + b.phase) * 1.4 * dt;
        b.air.addScaledVector(b.vel, dt * (0.6 + 1.6 * u));
        const beat = b.sp.beat || 46, wing = b.sp.air === 'flutter' ? 0.22 + 0.78 * Math.abs(Math.sin(now * beat + b.phase)) : 0.72 + 0.28 * Math.sin(now * beat + b.phase);
        const s = b.size * (1 - 0.5 * u * u);
        _z.copy(eye).sub(b.air).normalize();                       // facing the eye
        _y.copy(b.vel).addScaledVector(_z, -b.vel.dot(_z)); if (_y.lengthSq() < 1e-5) _y.copy(UP); _y.normalize();   // head toward where it is going
        _x.crossVectors(_y, _z).normalize();
        _m.makeBasis(_x.multiplyScalar(s * wing), _y.multiplyScalar(s), _z); _m.setPosition(b.air);
        b.mesh.matrix.copy(_m); b.mesh.matrixWorldNeedsUpdate = true;
        // its shadow stays where it was, fading as it climbs
        b.shade.visible = u < 0.25; b.shade.material.opacity = 0.32;
        if (b.shade.visible) { const f = 1 - u / 0.25; this.lay(b.shade, b, b.size * (1 + u * 2) * f, b.rise + 0.002, 0, 1); }
        continue;
      }
      b.mesh.visible = k > 0.02; b.shade.visible = k > 0.3;
      if (!b.mesh.visible) continue;
      if (b.sp.air === 'flutter' && b.sp.beat < 20) flat = 0.5 + 0.5 * Math.abs(Math.sin(now * 1.3 + b.phase));      // a butterfly at rest opens and closes its wings
      this.lay(b.mesh, b, b.size * k, lift, wig, flat);
      if (b.shade.visible) this.lay(b.shade, b, b.size * k * 1.04, lift - 0.002, wig, flat, 0.003);
    }
  }
  // main.js calls this straight after the picture is drawn: the depth it now holds was made with this camera
  rendered() { const c = this.o.camera; (this.pvp || (this.pvp = new THREE.Matrix4())).multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse); (this.ipvp || (this.ipvp = new THREE.Matrix4())).copy(this.pvp).invert(); }
  // Seat every beetle on what is DRAWN where it stands. The walls' own shape is not what you see: the moss stands a few
  // centimetres proud of it in layers, so a beetle laid on the shape is buried in moss here and seems to hover there.
  // The picture's depth says where the seen surface is. Five spots under each beetle are read from it in one go; the
  // nearest of them (the top of the moss, not a gap between its blades) is how far the beetle is lifted off the shape.
  seat() {
    const P = this.o.probe; if (!P || !this.pvp) return;
    const list = [], uv = [], pts = [];
    for (const b of this.live) {
      if (b.state === 'fly' || b.state === 'under' || list.length * 5 + 5 > P.N) continue;
      _x.crossVectors(b.t, b.n);
      const r = b.size * 0.2;
      for (let q = 0; q < 5; q++) {
        const p = new THREE.Vector3().copy(b.pos);
        if (q === 1) p.addScaledVector(b.t, r); else if (q === 2) p.addScaledVector(b.t, -r); else if (q === 3) p.addScaledVector(_x, r); else if (q === 4) p.addScaledVector(_x, -r);
        pts.push(p); _v.copy(p).applyMatrix4(this.pvp);
        uv.push(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5);
      }
      list.push(b);
    }
    if (!list.length) return;
    const d = P.read(uv);
    for (let i = 0; i < list.length; i++) {
      const b = list[i]; let best = null;
      for (let q = 0; q < 5; q++) {
        const j = i * 5 + q, u = uv[j * 2], v = uv[j * 2 + 1];
        if (u < 0.01 || u > 0.99 || v < 0.01 || v > 0.99 || d[j] >= 0.9999999) continue;
        _v.set(u * 2 - 1, v * 2 - 1, d[j] * 2 - 1).applyMatrix4(this.ipvp);      // the seen point on that line of sight
        const rise = _v.sub(pts[j]).dot(b.n);
        if (rise > -0.04 && rise < 0.13&& (best === null || rise > best)) best = rise;      // (further out than that is something in front of it: a hand, a fern)
      }
      if (best !== null) b.riseT = best;
    }
  }
  // lay a picture flat on the beetle's surface: head along its heading, `lift` off the surface, turned by `wig` about the normal
  lay(mesh, b, size, lift, wig, flat, slip = 0) {
    _y.copy(b.t); if (wig) _y.applyAxisAngle(b.n, wig);
    _x.crossVectors(_y, b.n).normalize();
    _v.copy(b.pos).addScaledVector(b.n, lift);
    if (slip) _v.addScaledVector(_x, slip).addScaledVector(_y, -slip);      // the shadow falls a little to one side
    _m.makeBasis(_x.multiplyScalar(size * flat), _y.multiplyScalar(size), _z.copy(b.n)); _m.setPosition(_v);
    mesh.matrix.copy(_m); mesh.matrixWorldNeedsUpdate = true;
  }
}
