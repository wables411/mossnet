// Spores drifting in the light, water drips falling off the wall tops, rain
// and snow where the weather has them, and after dark the fireflies of the
// places that have them, blinking over the water on their own clocks.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { streakTexture } from './geometry.js?v=d4fe5800';
import { wind } from './wind.js?v=25d38805';
import { torchPoints } from './torch.js?v=e09dfa0f';

function softDot(size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Particles {
  constructor(scene, quality) {
    this.scene = scene;
    const tex = softDot();
    this.nSpore = quality.high ? 700 : 250;
    this.range = 9;
    const sp = new Float32Array(this.nSpore * 3);
    this.sporeSeed = new Float32Array(this.nSpore * 3);
    for (let i = 0; i < this.nSpore; i++) {
      sp[i * 3] = (Math.random() - 0.5) * 2 * this.range; sp[i * 3 + 1] = Math.random() * 3.2; sp[i * 3 + 2] = (Math.random() - 0.5) * 2 * this.range;
      this.sporeSeed[i * 3] = Math.random() * 100; this.sporeSeed[i * 3 + 1] = Math.random() * 100; this.sporeSeed[i * 3 + 2] = 0.4 + Math.random() * 0.8;
    }
    this.sporeGeo = new THREE.BufferGeometry();
    this.sporeGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.spores = new THREE.Points(this.sporeGeo, new THREE.PointsMaterial({
      map: tex, size: 0.014, sizeAttenuation: true, transparent: true, opacity: 0.4, depthWrite: false, color: 0xfff6e0, fog: true,
    }));
    this.spores.frustumCulled = false;
    scene.add(this.spores);

    this.nDrip = quality.high ? 60 : 24;
    const dp = new Float32Array(this.nDrip * 3);
    this.dripV = new Float32Array(this.nDrip);
    this.dripGeo = new THREE.BufferGeometry();
    this.dripGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    this.drips = new THREE.Points(this.dripGeo, new THREE.PointsMaterial({
      map: tex, size: 0.016, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false, color: 0xe8f0ff, fog: true,
    }));
    this.drips.frustumCulled = false;
    scene.add(this.drips);

    // rain: streaks in a box around the player, drawn only as many as the weather needs
    this.nRain = quality.high ? 1800 : 600;
    const rp = new Float32Array(this.nRain * 3);
    for (let i = 0; i < this.nRain; i++) { rp[i * 3] = (Math.random() - 0.5) * 16; rp[i * 3 + 1] = Math.random() * 9; rp[i * 3 + 2] = (Math.random() - 0.5) * 16; }
    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.Points(this.rainGeo, new THREE.PointsMaterial({
      map: streakTexture(), size: 0.11, sizeAttenuation: true, transparent: true, opacity: 0.35, depthWrite: false, color: 0xdfe8ea, fog: true,
    }));
    this.rain.frustumCulled = false; this.rain.visible = false;
    scene.add(this.rain);
    this.rainAmount = 0;

    // snow: slow soft flakes
    this.nSnow = quality.high ? 1400 : 500;
    const sn = new Float32Array(this.nSnow * 3);
    for (let i = 0; i < this.nSnow; i++) { sn[i * 3] = (Math.random() - 0.5) * 16; sn[i * 3 + 1] = Math.random() * 9; sn[i * 3 + 2] = (Math.random() - 0.5) * 16; }
    this.snowGeo = new THREE.BufferGeometry();
    this.snowGeo.setAttribute('position', new THREE.BufferAttribute(sn, 3));
    this.snow = new THREE.Points(this.snowGeo, new THREE.PointsMaterial({
      map: tex, size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false, color: 0xf4f6f8, fog: true,
    }));
    this.snow.frustumCulled = false; this.snow.visible = false;
    scene.add(this.snow);
    this.snowAmount = 0;

    // fireflies: warm points that flash for half a second every few seconds, each on its own clock, low over the water
    this.nFly = quality.high ? 110 : 44;
    const fp = new Float32Array(this.nFly * 3), fc = new Float32Array(this.nFly * 3);
    this.flyGeo = new THREE.BufferGeometry();
    this.flyGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    this.flyGeo.setAttribute('color', new THREE.BufferAttribute(fc, 3));
    this.flyState = new Float32Array(this.nFly * 6);   // home x, y, z, period, phase, wander seed
    this.flies = new THREE.Points(this.flyGeo, new THREE.PointsMaterial({
      map: tex, size: 0.07, sizeAttenuation: true, transparent: true, opacity: 1, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending, fog: true,
    }));
    this.flies.frustumCulled = false; this.flies.visible = false;
    scene.add(this.flies);
    this.flyAmount = 0; this.flyWorld = null; this.flyReset = true;

    // a puff of spores off a tapped cushion: a small pool, each with a velocity and an age, carried off on the wind
    this.nPuff = 90;
    const pp = new Float32Array(this.nPuff * 3), pc = new Float32Array(this.nPuff * 3);
    this.puffGeo = new THREE.BufferGeometry();
    this.puffGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    this.puffGeo.setAttribute('color', new THREE.BufferAttribute(pc, 3));
    this.puffV = new Float32Array(this.nPuff * 3); this.puffAge = new Float32Array(this.nPuff).fill(99);
    this.puffs = new THREE.Points(this.puffGeo, new THREE.PointsMaterial({
      map: tex, size: 0.011, sizeAttenuation: true, transparent: true, opacity: 1, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending, fog: true,
    }));
    this.puffs.frustumCulled = false; this.puffs.visible = false;
    scene.add(this.puffs);
    this.puffNext = 0;

    this.wallHeight = 2.8;
    this.time = 0;
    this.center = new THREE.Vector3();
    for (let i = 0; i < this.nDrip; i++) this.resetDrip(i, true);
  }

  // spores off a cushion at (x, y, z) with surface normal n: a cloud that rises, spreads and drifts off
  puff(x, y, z, nx, ny, nz, n = 40) {
    const p = this.puffGeo.attributes.position.array, v = this.puffV;
    for (let k = 0; k < n; k++) {
      const i = this.puffNext; this.puffNext = (this.puffNext + 1) % this.nPuff;
      p[i * 3] = x + (Math.random() - 0.5) * 0.04; p[i * 3 + 1] = y + (Math.random() - 0.5) * 0.04; p[i * 3 + 2] = z + (Math.random() - 0.5) * 0.04;
      const sp = 0.15 + Math.random() * 0.4, a = Math.random() * Math.PI * 2, u = Math.random();
      v[i * 3] = nx * sp + Math.cos(a) * u * 0.32; v[i * 3 + 1] = ny * sp + 0.06 + Math.random() * 0.1; v[i * 3 + 2] = nz * sp + Math.sin(a) * u * 0.32;
      this.puffAge[i] = 0;
    }
    this.puffs.visible = true;
  }

  // how many fireflies (0..1 of the pool) and the world they live in (its open cells, floor and water)
  setFireflies(amount, world) {
    this.flyAmount = amount; this.flyWorld = world; this.flyReset = true;
    this.flies.visible = amount > 0;
    this.flyGeo.setDrawRange(0, Math.round(this.nFly * amount));
  }
  // a firefly's home: a point in the open, near the player, over or beside the water where the place has any
  spawnFly(i, center) {
    const W = this.flyWorld, sw = W.shootWorld, st = this.flyState;
    let x = center.x, z = center.z;
    for (let t = 0; t < 16; t++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 10;
      x = center.x + Math.cos(a) * r; z = center.z + Math.sin(a) * r;
      if (!sw.isOpen(Math.floor(x / sw.c), Math.floor(z / sw.c))) continue;
      if (W.inWater(x, z) || Math.random() < 0.3) break;
    }
    st[i * 6] = x; st[i * 6 + 1] = sw.floorY(x, z) + 0.2 + Math.random() * 1.1; st[i * 6 + 2] = z;
    st[i * 6 + 3] = 2.6 + Math.random() * 4.5; st[i * 6 + 4] = Math.random() * 10; st[i * 6 + 5] = Math.random() * 100;
  }

  // the hand torch's cone lights what drifts and falls through it
  setTorch(uniforms) {
    torchPoints(this.spores.material, uniforms, 9);
    torchPoints(this.rain.material, uniforms, 7);
    torchPoints(this.drips.material, uniforms, 5);
    torchPoints(this.snow.material, uniforms, 5);
  }
  setRain(a) { this.rainAmount = a; this.rain.visible = a > 0; this.rainGeo.setDrawRange(0, Math.round(this.nRain * a)); }
  setSnow(a) { this.snowAmount = a; this.snow.visible = a > 0; this.snowGeo.setDrawRange(0, Math.round(this.nSnow * a)); }

  resetDrip(i, first = false) {
    const p = this.dripGeo.attributes.position.array;
    const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 6;
    p[i * 3] = this.center.x + Math.cos(a) * r;
    p[i * 3 + 1] = first ? Math.random() * this.wallHeight : this.wallHeight + Math.random() * 0.5;
    p[i * 3 + 2] = this.center.z + Math.sin(a) * r;
    this.dripV[i] = 0;
  }

  update(dt, center) {
    this.time += dt;
    this.center.copy(center);
    const R = this.range;
    const p = this.sporeGeo.attributes.position.array;
    for (let i = 0; i < this.nSpore; i++) {
      const s0 = this.sporeSeed[i * 3], s1 = this.sporeSeed[i * 3 + 1], sp = this.sporeSeed[i * 3 + 2];
      const t = this.time * 0.25;
      p[i * 3] += (Math.sin(t + s0) * 0.5 + Math.cos(t * 1.7 + s1) * 0.2) * dt * sp * 0.35;
      p[i * 3 + 1] += (Math.sin(t * 1.3 + s1) * 0.12 - 0.03) * dt * sp;
      p[i * 3 + 2] += (Math.cos(t * 0.9 + s0) * 0.5 + Math.sin(t * 1.9 + s1) * 0.2) * dt * sp * 0.35;
      if (p[i * 3] < center.x - R) p[i * 3] += 2 * R; else if (p[i * 3] > center.x + R) p[i * 3] -= 2 * R;
      if (p[i * 3 + 2] < center.z - R) p[i * 3 + 2] += 2 * R; else if (p[i * 3 + 2] > center.z + R) p[i * 3 + 2] -= 2 * R;
      if (p[i * 3 + 1] < 0.05) p[i * 3 + 1] = 3.2; else if (p[i * 3 + 1] > 3.3) p[i * 3 + 1] = 0.1;
    }
    this.sporeGeo.attributes.position.needsUpdate = true;

    const d = this.dripGeo.attributes.position.array;
    const dripRate = 0.3 + this.rainAmount * 1.5;
    for (let i = 0; i < this.nDrip; i++) {
      this.dripV[i] += 9.8 * dt;
      d[i * 3 + 1] -= this.dripV[i] * dt;
      if (d[i * 3 + 1] < 0.02 || Math.hypot(d[i * 3] - center.x, d[i * 3 + 2] - center.z) > 9) {
        if (Math.random() < dripRate * dt * 10) this.resetDrip(i); else d[i * 3 + 1] = -1;
      }
    }
    this.dripGeo.attributes.position.needsUpdate = true;

    if (this.rainAmount > 0) {
      const r = this.rainGeo.attributes.position.array;
      const n = Math.round(this.nRain * this.rainAmount);
      const wv = wind.vec;
      for (let i = 0; i < n; i++) {
        r[i * 3 + 1] -= (8 + (i % 7) * 0.4) * dt;
        r[i * 3] += wv.x * 6 * dt; r[i * 3 + 2] += wv.z * 6 * dt;
        if (r[i * 3 + 1] < 0) { r[i * 3] = center.x + (Math.random() - 0.5) * 16; r[i * 3 + 1] = 7 + Math.random() * 3; r[i * 3 + 2] = center.z + (Math.random() - 0.5) * 16; }
        if (Math.abs(r[i * 3] - center.x) > 8) r[i * 3] = center.x + (Math.random() - 0.5) * 16;
        if (Math.abs(r[i * 3 + 2] - center.z) > 8) r[i * 3 + 2] = center.z + (Math.random() - 0.5) * 16;
      }
      this.rainGeo.attributes.position.needsUpdate = true;
    }

    if (this.puffs.visible) {
      const p = this.puffGeo.attributes.position.array, col = this.puffGeo.attributes.color.array, v = this.puffV, wv = wind.vec;
      let live = 0;
      for (let i = 0; i < this.nPuff; i++) {
        const age = this.puffAge[i] += dt;
        if (age > 5) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
        live++;
        // the first push dies away; the wind takes over; spores barely fall
        v[i * 3] = v[i * 3] * (1 - 2 * dt) + wv.x * 0.6 * dt; v[i * 3 + 1] = v[i * 3 + 1] * (1 - 2 * dt) - 0.012 * dt; v[i * 3 + 2] = v[i * 3 + 2] * (1 - 2 * dt) + wv.z * 0.6 * dt;
        p[i * 3] += v[i * 3] * dt + Math.sin(this.time * 3 + i) * 0.02 * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt + Math.cos(this.time * 2.5 + i * 0.7) * 0.02 * dt;
        const f = Math.min(1, age * 6) * (1 - age / 5);
        col[i * 3] = 0.6 * f; col[i * 3 + 1] = 0.56 * f; col[i * 3 + 2] = 0.38 * f;
      }
      this.puffGeo.attributes.position.needsUpdate = true; this.puffGeo.attributes.color.needsUpdate = true;
      if (!live) this.puffs.visible = false;
    }

    if (this.flyAmount > 0 && this.flyWorld && this.flyWorld.shootWorld) {
      const n = Math.round(this.nFly * this.flyAmount), f = this.flyGeo.attributes.position.array, col = this.flyGeo.attributes.color.array, st = this.flyState, t = this.time;
      if (this.flyReset) { for (let i = 0; i < n; i++) this.spawnFly(i, center); this.flyReset = false; }
      for (let i = 0; i < n; i++) {
        const hx = st[i * 6], hy = st[i * 6 + 1], hz = st[i * 6 + 2], P = st[i * 6 + 3], ph = st[i * 6 + 4], sd = st[i * 6 + 5];
        // a slow wander about the home point, a little lift while it flashes
        f[i * 3] = hx + Math.sin(t * 0.31 + sd) * 0.45 + Math.sin(t * 0.9 + sd * 1.7) * 0.12;
        f[i * 3 + 2] = hz + Math.cos(t * 0.27 + sd * 0.6) * 0.45 + Math.cos(t * 1.1 + sd) * 0.12;
        const frac = ((t + ph) % P) / P;
        const g = Math.exp(-Math.pow((frac - 0.12) / 0.045, 2));   // J-shaped: a quick rise and a slower fade
        const glow = Math.max(g, Math.exp(-Math.pow((frac - 0.17) / 0.09, 2)) * 0.5);
        f[i * 3 + 1] = hy + glow * 0.08 + Math.sin(t * 0.5 + sd) * 0.1;
        col[i * 3] = 1.0 * glow; col[i * 3 + 1] = 0.78 * glow; col[i * 3 + 2] = 0.22 * glow;
        if (Math.hypot(hx - center.x, hz - center.z) > 14) this.spawnFly(i, center);
      }
      this.flyGeo.attributes.position.needsUpdate = true; this.flyGeo.attributes.color.needsUpdate = true;
    }

    if (this.snowAmount > 0) {
      const s = this.snowGeo.attributes.position.array;
      const n = Math.round(this.nSnow * this.snowAmount);
      const wv = wind.vec, t = this.time;
      for (let i = 0; i < n; i++) {
        s[i * 3 + 1] -= (0.6 + (i % 5) * 0.12) * dt;
        s[i * 3] += (wv.x * 2.5 + Math.sin(t * 1.3 + i) * 0.25) * dt; s[i * 3 + 2] += (wv.z * 2.5 + Math.cos(t * 1.1 + i * 0.7) * 0.25) * dt;
        if (s[i * 3 + 1] < 0) { s[i * 3] = center.x + (Math.random() - 0.5) * 16; s[i * 3 + 1] = 6 + Math.random() * 3; s[i * 3 + 2] = center.z + (Math.random() - 0.5) * 16; }
        if (Math.abs(s[i * 3] - center.x) > 8) s[i * 3] = center.x + (Math.random() - 0.5) * 16;
        if (Math.abs(s[i * 3 + 2] - center.z) > 8) s[i * 3 + 2] = center.z + (Math.random() - 0.5) * 16;
      }
      this.snowGeo.attributes.position.needsUpdate = true;
    }
  }
}
