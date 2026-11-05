// Moss with a body: thousands of tiny shoots standing on every mossy surface
// near the camera. A pool of instances is re-scattered as the player moves,
// over the carved wall faces, the floor, the cushions, boulders and logs,
// wherever the same slow field that drives the shader says moss grows.
// Each shoot is a small crossed card with a drawn shoot on it: dark at the
// base, bright and a little translucent at the tip, swaying in the wind. The
// species' growth form shapes it: haircap stands tall, stiff and narrow on a
// straight stem; carpet lies down flat and glossy as a pinnate frond; stringy
// is lanky and leans; cushion is short and dense; hanging only ever hangs, from
// walls and undersides, never from the floor.
//
// Placement is seeded per face, cell and prop, so a surface always grows the
// same shoots: walking only adds and removes them at the edge of the radius,
// where they are shrunk to nothing. The rebuild runs a few milliseconds per
// frame into a second buffer and is swapped in when complete.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { canvasTexture, dispFast } from './geometry.js?v=d4fe5800';
import { mulberry32 } from './maze.js?v=28138280';
import { GLSL_SWAY, wind } from './wind.js?v=25d38805';

const rnd = (a, b) => a + Math.random() * (b - a);
const REACH_RIM = 1.2;   // metres over which a shoot shrinks to nothing at the lobe's edge

// what each growth form does to a shoot: its height (of the base height), width, lean, brightness (glossy carpets
// catch more light), and which drawings in the atlas it uses
const FORM_SHOOT = {
  feather: { height: 1.0, width: 1.0, lean: 0.5, bright: 1.0, var0: 0, nvar: 4 },
  cushion: { height: 0.8, width: 1.0, lean: 0.4, bright: 0.95, var0: 0, nvar: 4 },
  haircap: { height: 1.9, width: 0.72, lean: 0.14, bright: 0.9, var0: 4, nvar: 2 },
  carpet: { height: 0.65, width: 1.25, lean: 0.7, bright: 1.12, var0: 6, nvar: 2 },
  stringy: { height: 1.35, width: 0.9, lean: 0.9, bright: 1.0, var0: 0, nvar: 4 },
  hanging: { height: 1.6, width: 0.9, lean: 0.35, bright: 0.92, var0: 0, nvar: 4 },
};

// eight shoot variants side by side: four feather shoots (a stem with paired leaflets, tapering to a bright
// tip), two haircap shoots (straight, stiff, short leaves standing off at a steep angle, a star at the top)
// and two carpet fronds (pinnate, the branches spread wide and flat, glossy)
export function shootAtlas() {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let v = 0; v < 8; v++) {
      const x0 = v * 64 + 32;
      const kind = v < 4 ? 'feather' : v < 6 ? 'haircap' : 'carpet';
      const lean = kind === 'haircap' ? rnd(-2, 2) : rnd(-6, 6), bend = kind === 'haircap' ? rnd(-2, 2) : rnd(-8, 8);
      const steps = 14;
      const pts = [];
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        pts.push([x0 + lean * t + bend * t * t, h - 2 - t * (h - 8)]);
      }
      // leaflets first (behind the stem)
      for (let s = 1; s < steps; s++) {
        const t = s / steps, [px, py] = pts[s];
        const n = kind === 'haircap' ? 3 : 2;
        for (let k = 0; k < n; k++) {
          let len, ang, lw;
          if (kind === 'haircap') { len = rnd(7, 11) * (1 - t * 0.3); ang = rnd(0.95, 1.25); lw = rnd(1.6, 2.4); }        // short, stiff, steep
          else if (kind === 'carpet') { len = (1 - t * 0.35) * rnd(18, 30); ang = rnd(0.15, 0.45); lw = rnd(2.6, 3.8); }   // long, flat, spreading
          else { len = (1 - t * 0.5) * rnd(14, 24); ang = rnd(0.45, 0.95); lw = rnd(2.4, 3.6); }
          const g = Math.round(85 + 115 * t), r = Math.round(g * (kind === 'carpet' ? 0.55 + 0.35 * t : 0.45 + 0.35 * t)), b = Math.round(g * (kind === 'haircap' ? 0.36 : 0.3));
          ctx.strokeStyle = `rgb(${r},${g},${b})`; ctx.lineWidth = lw;
          const yy = py + k * (kind === 'haircap' ? 2.5 : 4);
          for (const side of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(px, yy);
            if (kind === 'haircap') ctx.lineTo(px + side * len * Math.cos(ang), yy - len * Math.sin(ang));
            else ctx.quadraticCurveTo(px + side * len * 0.55, yy - len * 0.45, px + side * len * Math.cos(ang), yy - len * Math.sin(ang));
            ctx.stroke();
          }
        }
      }
      // stem: a haircap's is dark red-brown and wiry, a carpet's pale and thin
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        let r, g, b;
        if (kind === 'haircap') { g = Math.round(55 + 70 * t); r = Math.round(g * 1.1); b = Math.round(g * 0.4); }
        else { g = Math.round(70 + 120 * t); r = Math.round(g * (0.5 + 0.3 * t)); b = Math.round(g * 0.3); }
        ctx.strokeStyle = `rgb(${r},${g},${b})`; ctx.lineWidth = kind === 'haircap' ? 2.2 * (1 - t) + 1.4 : kind === 'carpet' ? 2.0 * (1 - t) + 1.0 : 3.2 * (1 - t) + 1.2;
        ctx.beginPath(); ctx.moveTo(pts[s][0], pts[s][1]); ctx.lineTo(pts[s + 1][0], pts[s + 1][1]); ctx.stroke();
      }
      // the tip: a bright bud, or a haircap's star of leaves
      if (kind === 'haircap') {
        ctx.strokeStyle = 'rgb(120,160,80)'; ctx.lineWidth = 1.8;
        for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.42; ctx.beginPath(); ctx.moveTo(pts[steps][0], pts[steps][1] + 2); ctx.lineTo(pts[steps][0] + Math.cos(a) * 9, pts[steps][1] + 2 + Math.sin(a) * 9); ctx.stroke(); }
      } else {
        ctx.fillStyle = kind === 'carpet' ? 'rgb(190,215,110)' : 'rgb(205,220,120)'; ctx.beginPath(); ctx.arc(pts[steps][0], pts[steps][1] + 2, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }, true, true);
}

// two crossed quads, base at the origin, one unit tall, half a unit wide
function shootGeometry() {
  const pos = [], uv = [], nor = [], idx = [];
  let base = 0;
  for (const [ax, az] of [[1, 0], [0, 1]]) {
    const pts = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]];
    for (const [s, y] of pts) { pos.push(s * ax, y, s * az); uv.push(s + 0.5, y); nor.push(-az, 0, ax); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3); base += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

export class Shoots {
  constructor(scene, quality) {
    this.scene = scene; this.q = quality;
    this.max = quality.high ? 48000 : 16000;
    this.budget = this.max;
    // the scattered region is a lobe around the player: `back` metres behind, `reach` metres down the view
    // direction (REACH_RIM in the shader turns the far rim into a shrink band, so nothing pops at its edge)
    this.fullBack = quality.high ? 3.5 : 2.6;
    this.fullReach = quality.high ? 9.5 : 8.5;
    this.back = this.fullBack; this.reach = this.fullReach;
    this.radius = this.fullReach;   // the far limit, for anything that only wants one number
    this.atlas = shootAtlas();
    const mat = this.mat = new THREE.MeshStandardMaterial({ map: this.atlas, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, color: 0xffffff, emissive: 0x1a2810, emissiveIntensity: 0.5 });
    const u = { uWind: { value: wind.vec }, uWindTime: { value: 0 }, uPlayer: { value: new THREE.Vector3() }, uView: { value: new THREE.Vector2(0, -1) }, uReach: { value: new THREE.Vector2(this.back, this.reach) } };
    mat.userData.windUniforms = u;
    this.uniforms = u;
    mat.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${GLSL_SWAY}\nattribute float ivar; attribute float iborn; uniform vec3 uPlayer; uniform vec2 uView; uniform vec2 uReach; varying float vTip;`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n vMapUv.x = (vMapUv.x + ivar) * 0.125; vTip = uv.y;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            // the shoot grows from nothing over the first moments after it is scattered, and shrinks to nothing
            // over the last REACH_RIM metres of the lobe, measured from where the player stands now (so walking
            // and turning move the rim smoothly; the rebuild only adds shoots beyond it, which then grow in).
            // far shoots are a little taller: at eight metres a two-centimetre shoot is a pixel, a clump is moss
            vec3 ip = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            vec2 dv = ip.xz - uPlayer.xz;
            float dd = length(dv);
            float cs = dd > 0.001 ? dot(dv, uView) / dd : 1.0;
            float t = clamp((cs + 0.35) / 0.95, 0.0, 1.0); t = t * t * (3.0 - 2.0 * t);
            float rd = uReach.x + (uReach.y - uReach.x) * t;
            float rim = clamp((rd - dd) / ${REACH_RIM.toFixed(2)}, 0.0, 1.0);
            float grow = smoothstep(0.0, 1.0, (uWindTime - iborn) / 0.7);
            transformed *= grow * rim * (1.0 + 0.09 * max(0.0, dd - 2.5));
            vec3 wp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
            vec3 d = sway(wp, uv.y, 0.06);
            transformed += inverse(mat3(modelMatrix) * mat3(instanceMatrix)) * d;
          }`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vTip;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          // dark at the base, lighter and a little yellowed at the tip; held close to the carpet's own colour, so
          // a patch reads as moss with depth and not as bright specks scattered over it
          diffuseColor.rgb *= mix(vec3(0.36, 0.42, 0.29), vec3(0.92, 0.96, 0.76), pow(clamp(vTip, 0.0, 1.0), 0.8));   // interpolation dips a hair below 0 at the base: pow of that is NaN, a black blob after the depth of field`);
    };
    mat.customProgramCacheKey = () => 'moss-shoots';

    // two pools: one on screen, one being filled
    this.geo = shootGeometry();
    this.pools = [this.makePool(), this.makePool()];
    this.front = 0;
    this.pools[1].mesh.visible = false;
    this.world = null; this.last = new THREE.Vector3(1e9, 0, 1e9); this.lastYaw = 1e9; this.job = null;
    this.now = 0; this.view = new THREE.Vector2(0, -1);
    this.born = new Map(); this.used = null;   // when each face / cell / prop first entered the lobe, for the grow-in
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._n = new THREE.Vector3();
    this._e = new THREE.Euler(); this._up = new THREE.Vector3(0, 1, 0);
  }

  makePool() {
    const geo = this.geo.clone();
    const ivar = new THREE.InstancedBufferAttribute(new Float32Array(this.max), 1);
    ivar.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('ivar', ivar);
    const iborn = new THREE.InstancedBufferAttribute(new Float32Array(this.max), 1);
    iborn.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iborn', iborn);
    const mesh = new THREE.InstancedMesh(geo, this.mat, this.max);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false;
    this.scene.add(mesh);
    return { mesh, ivar, iborn };
  }

  // the governor's budget, q 0..1: the shoot count drops first (it is the cost); the lobe keeps its full reach
  // down to the fourth step and only then draws in, so moss stays visible down the corridor as long as it can
  setQuality(q) {
    this.budget = Math.round(this.max * (0.12 + 0.88 * q));
    const rq = q >= 0.375 ? 1 : 0.6 + 0.4 * q / 0.375;
    this.back = this.fullBack * rq; this.reach = this.fullReach * rq; this.radius = this.reach;
    this.uniforms.uReach.value.set(this.back - REACH_RIM * 0.5, this.reach - REACH_RIM * 0.5);
    this.last.set(1e9, 0, 1e9);
  }

  setWorld(w) {
    this.world = w; this.last.set(1e9, 0, 1e9); this.lastYaw = 1e9; this.job = null; this.born.clear();
    for (const p of this.pools) { p.mesh.count = 0; p.mesh.instanceMatrix.needsUpdate = true; }
  }

  // the lobe's reach in the direction (dx, dz) at distance d, in the view `v`: `back` behind, `reach` ahead
  reachAt(dx, dz, d, v = this.view) {
    const cs = d > 1e-3 ? (dx * v.x + dz * v.y) / d : 1;
    let t = Math.max(0, Math.min(1, (cs + 0.35) / 0.95)); t = t * t * (3 - 2 * t);
    return this.back + (this.reach - this.back) * t;
  }

  update(playerPos, yaw = 0) {
    if (!this.world) return;
    const u = this.uniforms;
    u.uPlayer.value.copy(playerPos); u.uView.value.set(-Math.sin(yaw), -Math.cos(yaw));
    // rebuild after a step, or a turn of the head (the lobe follows the view; the shader hides the join)
    let dyaw = Math.abs(yaw - this.lastYaw) % (Math.PI * 2); if (dyaw > Math.PI) dyaw = Math.PI * 2 - dyaw;
    if (!this.job && (playerPos.distanceTo(this.last) > 0.9 || dyaw > 0.4)) {
      this.last.copy(playerPos); this.lastYaw = yaw;
      this.view.copy(u.uView.value);
      this.job = this.scatter(playerPos.clone(), this.pools[1 - this.front]);
    }
    if (this.job) {
      // a few milliseconds a frame, then swap the finished pool in
      const t0 = performance.now();
      let r;
      do { r = this.job.next(); } while (!r.done && performance.now() - t0 < 2.5);
      if (r.done) {
        const back = this.pools[1 - this.front];
        back.mesh.count = r.value;
        back.mesh.instanceMatrix.needsUpdate = true; back.mesh.instanceColor.needsUpdate = true; back.ivar.needsUpdate = true; back.iborn.needsUpdate = true;
        back.mesh.visible = true; this.pools[this.front].mesh.visible = false;
        this.front = 1 - this.front;
        this.job = null;
        // whatever left the lobe grows in afresh when it comes back
        if (this.used) { for (const k of this.born.keys()) if (!this.used.has(k)) this.born.delete(k); this.used = null; }
      }
    }
  }

  // how much moss grows at this point, by the same rule as the shader's mask (its fine terms averaged); (nx, nz)
  // is a wall face's outward normal, for its sunny side
  mossAt(x, y, z, up, cover, nx = 0, nz = 0) {
    const low = this.world.lowField(x, y, z);
    let n = low * 0.42 + 0.2 + 0.15 + 0.24 * Math.max(0, 1 - y / 1.1) + 0.12 * up;
    const side = 1 - up;
    if (side > 0) {
      const a = Math.sin(x * 5.3 + 1.9 * Math.sin(z * 1.7 + y * 0.8) + 2.3 * Math.sin(x * 1.3));
      const b = Math.sin(z * 4.7 + 2.1 * Math.sin(x * 1.5 - y * 0.7) + 2.0 * Math.sin(z * 1.1 + 1.0));
      const ss = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
      n -= side * (0.18 * ss(0.35, 0.9, Math.max(a, b)) + 0.09 * ss(1.1, 2.3, y));
      const sun = this.world.sunDir;
      if (sun) n -= 0.08 * side * Math.max(0, Math.min(1, (nx * sun.x + nz * sun.z) / Math.max(Math.hypot(nx, nz) * Math.hypot(sun.x, sun.z), 0.05)));
    }
    const lo = 0.73 - cover * 0.42;
    const t = Math.max(0, Math.min(1, (n - lo) / 0.13));
    return t * t * (3 - 2 * t);
  }

  // every shoot draws the same number of random values, so a surface's sequence stays aligned whatever is skipped.
  // `sp` is the species {color, form}: the form sets the shoot's height, stiffness, lean, width and drawing
  place(pool, i, x, y, z, nx, ny, nz, sp, h, rng, born = 0) {
    pool.iborn.setX(i, born);
    const q = this._q, n = this._n.set(nx, ny, nz).normalize();
    let form = sp.form || 'feather';
    // a hanging species cannot hang from the floor: there it gives way to the next species along
    if (form === 'hanging') { if (n.y > 0.35) { sp = this.world.species[(sp.index + 1) % this.world.species.length]; form = sp.form; } else { n.set(n.x * 0.35, -1, n.z * 0.35).normalize(); } }
    const F = FORM_SHOOT[form] || FORM_SHOOT.feather;
    q.setFromUnitVectors(this._up, n);
    this._q2.setFromAxisAngle(n, rng() * Math.PI * 2); q.premultiply(this._q2);
    // the lean: stiff kinds barely lean; carpets lie right down; the rest lean a little, loosely
    const r1 = rng() - 0.5, r2 = rng() - 0.5;
    this._e.set(r1 * F.lean, 0, r2 * F.lean); this._q2.setFromEuler(this._e); q.multiply(this._q2);
    this._p.set(x, y, z);
    // never a scale of nothing: the shader inverts the instance matrix, and a determinant that underflows
    // comes back as NaN (a black blob after the depth of field); a shoot a millimetre and a half tall is nothing to the eye
    const hh = Math.max(h, 0.0015) * F.height;
    this._s.set(hh * F.width * (0.9 + rng() * 0.5), hh, hh * F.width * (0.9 + rng() * 0.5));
    pool.mesh.setMatrixAt(i, this._m.compose(this._p, q, this._s));
    const v = (0.6 + rng() * 0.6) * F.bright;   // shoots in one patch differ: some in shade, some old and dull
    const color = sp.color;
    pool.mesh.instanceColor.setXYZ(i, color.r * v, color.g * v, color.b * v);
    pool.ivar.setX(i, F.var0 + Math.floor(rng() * F.nvar));
  }
  static skip(rng) { for (let k = 0; k < 7; k++) rng(); }

  // the generator: yields now and then so a frame never stalls; returns the count
  *scatter(pp, pool) {
    const W = this.world, max = this.budget;
    const { c, H, cover, coverFloor, species, faces, openCells, sources, floorY } = W;
    const colors = species;
    let i = 0, work = 0;
    // the lobe: how far the scatter reaches toward (x, z); the shader shrinks the last REACH_RIM metres of it
    const reach = (x, z) => { const dx = x - pp.x, dz = z - pp.z; return this.reachAt(dx, dz, Math.hypot(dx, dz)); };
    // shoots per square metre fall away with distance as the inverse square would, floored: far moss is a
    // scatter of taller shoots (the shader stretches them), near moss a dense sward
    const falloff = d => d < 1.0 ? 1.4 : d < 1.8 ? 1 : Math.max(0.035, Math.pow(1.8 / d, 1.7));
    const dens = this.q.high ? 2600 : 800;      // shoots per square metre of mossy surface, up close
    const h0 = 0.018, h1 = 0.034;
    const wallMax = Math.round(max * 0.55), floorMax = Math.round(max * 0.8);
    // when a face, cell or prop first came into the lobe: its shoots grow in from that moment
    const used = this.used = new Set(), born = this.born, now = this.now + 0.25;
    const bornOf = key => { used.add(key); let b = born.get(key); if (b === undefined) { b = now; born.set(key, b); } return b; };

    // wall faces in the lobe, the nearest for their reach first (down the corridor before behind your back)
    const near = [];
    for (let f = 0; f < faces.length; f++) {
      const d = Math.hypot(faces[f].cx - pp.x, faces[f].cz - pp.z), r = reach(faces[f].cx, faces[f].cz);
      if (d < r + c) near.push([d, faces[f], f, d / r]);
    }
    near.sort((a, b) => a[3] - b[3]);
    for (const [d, f, fi] of near) {
      if (i >= wallMax) break;
      const rng = mulberry32(fi * 7919 + 13), b = bornOf('f' + fi);
      const n = Math.round(c * H * dens * falloff(d) * 0.55);
      for (let k = 0; k < n && i < wallMax; k++) {
        const a0 = f.a0 || 0, a1 = f.a1 ?? 1, top = Math.min(H - 0.2, (f.top ?? H) - 0.05);
        const along = a0 + rng() * (a1 - a0), hy = rng() * (top - 0.02) + 0.02, r1 = rng(), hh = h0 + rng() * (h1 - h0), ci = Math.floor(rng() * colors.length);
        let x = f.ox + f.ux * along, z = f.oz + f.uz * along;
        const dd = dispFast(x, hy, z, H); x += dd[0]; z += dd[2];
        const dp = Math.hypot(x - pp.x, z - pp.z);
        const m = dp > reach(x, z) ? 0 : this.mossAt(x, hy, z, 0, cover, f.nx, f.nz);
        if (m < 0.5 || r1 > (m - 0.45) * 1.8) { Shoots.skip(rng); continue; }
        this.place(pool, i++, x + f.nx * 0.01, hy + dd[1] * 0.3, z + f.nz * 0.01, f.nx, 0.15, f.nz, colors[ci], hh, rng, b);
        if ((i & 255) === 0) yield;
      }
      if (++work % 4 === 0) yield;
    }
    // the floor: the cells in the lobe, nearest for their reach first, so the budget goes where you look
    const cells = [];
    for (let ci0 = 0; ci0 < openCells.length; ci0++) {
      const [gx, gz] = openCells[ci0];
      const cx = (gx + 0.5) * c, cz = (gz + 0.5) * c;
      const d = Math.hypot(cx - pp.x, cz - pp.z), r = reach(cx, cz);
      if (d < r + c * 0.75) cells.push([d, ci0, d / r]);
    }
    cells.sort((a, b) => a[2] - b[2]);
    // each open cell reaches out over the ground toward any wall beside it: the carved banks stand back from the
    // grid, and moss that stopped on the grid line left a bare strip and a ruled edge down both sides of the path
    const footDist = W.footDist, isOpen = W.isOpen;
    const ext = (gx, gz) => footDist ? [isOpen(gx - 1, gz) ? 0 : 0.5, isOpen(gx + 1, gz) ? 0 : 0.5, isOpen(gx, gz - 1) ? 0 : 0.5, isOpen(gx, gz + 1) ? 0 : 0.5] : [0, 0, 0, 0];
    // the budget is shared out over every cell in the lobe instead of running out at a cell boundary (that cut the
    // moss off in a straight line across the path)
    let demand = 0;
    for (const [d, ci0] of cells) { const [gx, gz] = openCells[ci0], e = ext(gx, gz); demand += c * c * (1 + e[0] + e[1]) * (1 + e[2] + e[3]) * dens * falloff(d) * 0.7 * 0.45; }
    const share = Math.min(1, floorMax / Math.max(1, demand));
    for (const [d, ci0] of cells) {
      if (i >= floorMax) break;
      const [gx, gz] = openCells[ci0], e = ext(gx, gz);
      const rng = mulberry32(ci0 * 104729 + 7), b = bornOf('c' + ci0);
      const wx = 1 + e[0] + e[1], wz = 1 + e[2] + e[3];
      const n = Math.round(c * c * wx * wz * dens * falloff(d) * 0.7 * share);
      for (let k = 0; k < n && i < floorMax; k++) {
        const x = (gx - e[0] + rng() * wx) * c, z = (gz - e[2] + rng() * wz) * c, r1 = rng(), hh = h0 + rng() * (h1 - h0), ci = Math.floor(rng() * colors.length);
        const dp = Math.hypot(x - pp.x, z - pp.z);
        const fd = footDist ? footDist(x, z) : 1;
        // under a bank, or out over a neighbouring open cell (which grows its own): nothing
        const ox = Math.floor(x / c), oz = Math.floor(z / c);
        if (fd < 0.02 || ((ox !== gx || oz !== gz) && isOpen(ox, oz))) { Shoots.skip(rng); continue; }
        const m = dp > reach(x, z) ? 0 : this.mossAt(x, 0, z, 1, coverFloor ?? Math.min(0.95, cover + 0.2));
        // a path is trodden: the moss is thickest in the shelter at the foot of the banks and thins toward the
        // middle, where it holds on in patches (the slow field) rather than as an even sward
        const shelter = footDist ? 1 - Math.max(0, Math.min(1, (fd - 0.2) / 0.7)) : 1;
        const keep = Math.max(0, Math.min(1, (m - 0.45) * 1.8)) * (0.22 + 0.78 * shelter * shelter);
        if (r1 > keep) { Shoots.skip(rng); continue; }
        const y = floorY ? floorY(x, z) : 0;
        this.place(pool, i++, x, y, z, 0, 1, 0, colors[ci], hh, rng, b);
        if ((i & 255) === 0) yield;
      }
      if (++work % 4 === 0) yield;
    }
    // cushions, boulders and logs: points on their surfaces, transformed by each instance
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), nrm = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    for (let si = 0; si < sources.length; si++) {
      const src = sources[si];
      if (i >= max) break;
      const arr = src.mesh.instanceMatrix.array;
      for (let k = 0; k < src.mesh.count && i < max; k++) {
        const x = arr[k * 16 + 12], z = arr[k * 16 + 14];
        const d = Math.hypot(x - pp.x, z - pp.z);
        if (d > reach(x, z)) continue;
        const rng = mulberry32(si * 15485863 + k * 331 + 1), b = bornOf('p' + si + ':' + k);
        m4.fromArray(arr, k * 16); m4.decompose(pos, q, sc);
        const area = src.kind === 'log' ? 2 * Math.PI * sc.x * sc.y * 0.5 : 2 * Math.PI * sc.x * sc.z;
        if (src.kind === 'scan') {
          // surface samples of the scan, in its own space; keep the ones that face up
          const smp = src.samples, ns = smp.length / 6;
          const n = Math.min(ns, Math.round(ns * src.cover * falloff(d)));
          for (let j = 0; j < n && i < max; j++) {
            const k2 = Math.floor(rng() * ns), r1 = rng(), hh = h0 + rng() * (h1 - h0), ci = Math.floor(rng() * colors.length);
            p.set(smp[k2 * 6], smp[k2 * 6 + 1], smp[k2 * 6 + 2]); nrm.set(smp[k2 * 6 + 3], smp[k2 * 6 + 4], smp[k2 * 6 + 5]);
            p.applyMatrix4(m4); nrm.applyQuaternion(q).normalize();
            const dp = Math.hypot(p.x - pp.x, p.z - pp.z);
            if (nrm.y < 0.15 || r1 > 0.25 + 0.75 * nrm.y || dp > reach(p.x, p.z)) { Shoots.skip(rng); continue; }
            this.place(pool, i++, p.x, p.y, p.z, nrm.x, nrm.y, nrm.z, colors[ci], hh, rng, b);
          }
          if (++work % 8 === 0) yield;
          continue;
        }
        const n = Math.round(area * dens * src.cover * falloff(d));
        for (let j = 0; j < n && i < max; j++) {
          const a1 = rng(), a2 = rng(), r1 = rng(), hh = h0 + rng() * (h1 - h0), ci = Math.floor(rng() * colors.length);
          if (src.kind === 'log') {
            const a = (a1 - 0.5) * 2.2, t = a2 - 0.5;
            p.set(Math.sin(a) * 0.98, t, Math.cos(a) * 0.98); nrm.set(Math.sin(a), 0, Math.cos(a));
          } else {
            const u = a1 * 2 - 1, th = a2 * Math.PI * 2, r = Math.sqrt(1 - u * u);
            p.set(r * Math.cos(th), u, r * Math.sin(th)); nrm.copy(p);
          }
          p.applyMatrix4(m4); nrm.applyQuaternion(q).normalize();
          const dp = Math.hypot(p.x - pp.x, p.z - pp.z);
          if (nrm.y < -0.1 || r1 > 0.4 + 0.6 * Math.max(0, nrm.y) || dp > reach(p.x, p.z)) { Shoots.skip(rng); continue; }
          this.place(pool, i++, p.x, p.y, p.z, nrm.x, nrm.y, nrm.z, colors[ci], hh * (src.kind === 'cushion' ? 1.15 : 1), rng, b);
          if ((i & 255) === 0) yield;
        }
        if (++work % 8 === 0) yield;
      }
    }
    return i;
  }

  tick(t) { this.now = t; this.mat.userData.windUniforms.uWindTime.value = t; }
}
