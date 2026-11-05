// First-person walking: pointer-lock mouse look with a little lag, WASD /
// arrows, a virtual stick and drag-look on touch, grid collision, and the
// handheld-camera feel (step bob, breathing, low-frequency sway, autofocus).
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { WALL } from './maze.js?v=28138280';
import { noise3 } from './noise.js?v=a407dfed';
import { disp } from './geometry.js?v=d4fe5800';

export const EYE = 1.62;

export class Player {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;          // where the player wants to look
    this.cyaw = 0; this.cpitch = 0;        // where the camera actually is (lags a bit)
    this.keys = new Set();
    this.radius = 0.34;
    this.sens = 1; this.bobAmount = 1;
    this.onTap = null;             // (ndcX, ndcY, screenX, screenY)
    this.walk = 1.45; this.brisk = 2.35;
    this.stepPhase = 0; this.stepTrigger = null;
    this.stride = 0;                       // 0..1 how much we are walking
    this.time = 0;
    this.locked = false;
    this.enabled = false;
    this.touch = { move: new THREE.Vector2(), look: new THREE.Vector2(), stickId: null, lookId: null, stickOrigin: new THREE.Vector2(), lookLast: new THREE.Vector2() };
    this.maze = null; this.cell = 1;
    this.obstacles = [];
    this.floorY = null;           // (x, z) => ground height, set by the world: the player walks on it
    this.lie = 0;                 // 0..1: lying down in the moss, looking up (the way out of the maze)
    this.bind();
  }

  setMaze(maze, cell, wallHeight) {
    this.maze = maze; this.cell = cell; this.H = wallHeight || 2.8;
    this.pos.set(maze.start.x * cell + cell / 2, EYE, maze.start.y * cell + cell / 2);
    this.vel.set(0, 0, 0);
    // face along the first open direction
    const nx = maze.path[1] ? maze.path[1][0] - maze.start.x : 1;
    const nz = maze.path[1] ? maze.path[1][1] - maze.start.y : 0;
    this.yaw = this.cyaw = Math.atan2(-nx, -nz);
    this.pitch = this.cpitch = 0;
  }

  bind() {
    const d = this.dom;
    window.addEventListener('keydown', e => {
      if (!this.enabled) return;
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === d;
      if (!this.locked) this.keys.clear();
      this.onLockChange && this.onLockChange(this.locked);
    });
    document.addEventListener('mousemove', e => {
      if (!this.locked || !this.enabled) return;
      const s = 0.0021 * this.sens;
      this.yaw -= e.movementX * s;
      this.pitch -= e.movementY * s;
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    });
    d.addEventListener('mousedown', e => {
      if (!this.enabled || !this.locked || e.button !== 0) return;
      if (this.onTap) this.onTap(0, 0, window.innerWidth / 2, window.innerHeight / 2);
    });
    // touch: left half = stick, right half = look; a short still touch on the right is a tap
    const t = this.touch;
    d.addEventListener('touchstart', e => {
      if (!this.enabled) return;
      for (const touch of e.changedTouches) {
        const half = touch.clientX < window.innerWidth / 2;
        if (half && t.stickId === null) { t.stickId = touch.identifier; t.stickOrigin.set(touch.clientX, touch.clientY); t.move.set(0, 0); }
        else if (!half && t.lookId === null) { t.lookId = touch.identifier; t.lookLast.set(touch.clientX, touch.clientY); t.lookStart = { x: touch.clientX, y: touch.clientY, t: performance.now(), moved: 0 }; }
      }
      e.preventDefault();
    }, { passive: false });
    d.addEventListener('touchmove', e => {
      if (!this.enabled) return;
      for (const touch of e.changedTouches) {
        if (touch.identifier === t.stickId) {
          const dx = touch.clientX - t.stickOrigin.x, dy = touch.clientY - t.stickOrigin.y;
          const r = 60;
          t.move.set(Math.max(-1, Math.min(1, dx / r)), Math.max(-1, Math.min(1, dy / r)));
        } else if (touch.identifier === t.lookId) {
          const s = 0.0045 * this.sens;
          if (t.lookStart) t.lookStart.moved += Math.abs(touch.clientX - t.lookLast.x) + Math.abs(touch.clientY - t.lookLast.y);
          this.yaw -= (touch.clientX - t.lookLast.x) * s;
          this.pitch -= (touch.clientY - t.lookLast.y) * s;
          this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
          t.lookLast.set(touch.clientX, touch.clientY);
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === t.stickId) { t.stickId = null; t.move.set(0, 0); }
        if (touch.identifier === t.lookId) {
          t.lookId = null;
          const st = t.lookStart;
          if (st && performance.now() - st.t < 300 && st.moved < 12 && this.onTap) {
            this.onTap((touch.clientX / window.innerWidth) * 2 - 1, -(touch.clientY / window.innerHeight) * 2 + 1, touch.clientX, touch.clientY);
          }
          t.lookStart = null;
        }
      }
    };
    d.addEventListener('touchend', end); d.addEventListener('touchcancel', end);
  }

  requestLock() {
    try { const p = this.dom.requestPointerLock && this.dom.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* no pointer lock here: keys still work */ }
  }

  // --- grid collision: slide a circle against wall cells
  blocked(x, z) {
    const m = this.maze; if (!m) return false;
    const c = this.cell;
    const minX = Math.floor((x - this.radius) / c), maxX = Math.floor((x + this.radius) / c);
    const minZ = Math.floor((z - this.radius) / c), maxZ = Math.floor((z + this.radius) / c);
    for (let gz = minZ; gz <= maxZ; gz++) for (let gx = minX; gx <= maxX; gx++) {
      if (gx < 0 || gz < 0 || gx >= m.W || gz >= m.H) {
        if (!(gx === m.exit.x && gz === m.exit.y)) { if (this.circleHitsCell(x, z, gx, gz)) return true; }
        continue;
      }
      if (m.grid[gz * m.W + gx] === WALL && this.circleHitsCell(x, z, gx, gz)) return true;
    }
    // props with a footprint: logs and boulders
    for (const [ox, oz, r] of this.obstacles) {
      const rr = r + this.radius * 0.8;
      const dx = x - ox, dz = z - oz;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
  }
  circleHitsCell(x, z, gx, gz) {
    const c = this.cell;
    let cx = Math.max(gx * c, Math.min(x, gx * c + c));
    let cz = Math.max(gz * c, Math.min(z, gz * c + c));
    // the wall face is carved by the same field as the geometry: move the contact point with it
    const d = disp(cx, 1.1, cz, this.H);
    cx += d[0]; cz += d[2];
    const dx = x - cx, dz = z - cz;
    return dx * dx + dz * dz < this.radius * this.radius;
  }

  update(dt) {
    this.time += dt;
    const k = this.keys, t = this.touch;
    let fwd = 0, side = 0, brisk = false;
    if (this.enabled) {
      if (k.has('KeyW') || k.has('ArrowUp')) fwd += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) fwd -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) side += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) side -= 1;
      brisk = k.has('ShiftLeft') || k.has('ShiftRight');
      fwd -= t.move.y; side += t.move.x;
    }
    const len = Math.hypot(fwd, side);
    if (len > 1) { fwd /= len; side /= len; }
    const want = Math.min(1, len);
    const speed = brisk ? this.brisk : this.walk;

    // desired horizontal velocity in world space
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const dirX = -sy * fwd + cy * side;
    const dirZ = -cy * fwd - sy * side;
    const tx = dirX * speed, tz = dirZ * speed;
    const accel = want > 0 ? 7.5 : 11;
    const a = 1 - Math.exp(-accel * dt);
    this.vel.x += (tx - this.vel.x) * a;
    this.vel.z += (tz - this.vel.z) * a;

    // move with per-axis sliding
    let nx = this.pos.x + this.vel.x * dt;
    if (this.blocked(nx, this.pos.z)) { nx = this.pos.x; this.vel.x *= 0.2; }
    let nz = this.pos.z + this.vel.z * dt;
    if (this.blocked(nx, nz)) { nz = this.pos.z; this.vel.z *= 0.2; }
    this.pos.x = nx; this.pos.z = nz;
    if (this.floorY) this.pos.y = EYE + this.floorY(nx, nz);

    // gait
    const sp = Math.hypot(this.vel.x, this.vel.z);
    const moving = sp / this.walk;
    this.stride += (Math.min(1, moving) - this.stride) * (1 - Math.exp(-6 * dt));
    const stepHz = 1.75 + 0.35 * Math.min(1, sp / this.brisk);
    const prev = this.stepPhase;
    this.stepPhase += dt * stepHz * Math.min(1.1, moving);
    if (Math.floor(this.stepPhase * 2) !== Math.floor(prev * 2) && this.stride > 0.25 && this.stepTrigger) this.stepTrigger(sp / this.brisk);

    // camera: lagging look, bob, breath, handheld sway
    const lag = 1 - Math.exp(-16 * dt);
    this.cyaw += (this.yaw - this.cyaw) * lag;
    this.cpitch += (this.pitch - this.cpitch) * lag;
    const ph = this.stepPhase * Math.PI * 2;
    const bA = this.bobAmount;
    const bobY = Math.sin(ph * 2) * 0.022 * this.stride * bA;
    const bobX = Math.sin(ph) * 0.012 * this.stride * bA;
    const roll = Math.sin(ph) * 0.006 * this.stride * bA;
    const breath = Math.sin(this.time * 0.9) * 0.004 * bA;
    const T = this.time * 0.35;
    const swayY = (noise3(T, 1.3, 7.7) - 0.5) * 0.012 + (noise3(T * 3.1, 5.1, 2.2) - 0.5) * 0.004 * (0.3 + this.stride);
    const swayP = (noise3(3.3, T, 1.1) - 0.5) * 0.010 + (noise3(2.2, T * 3.1, 8.8) - 0.5) * 0.004 * (0.3 + this.stride);
    const swayR = (noise3(9.1, 4.4, T) - 0.5) * 0.008;
    const swayYb = swayY * bA, swayPb = swayP * bA, swayRb = swayR * bA;

    const cam = this.camera;
    const lie = this.lie, el = lie * lie * (3 - 2 * lie);
    cam.position.set(this.pos.x, this.pos.y + bobY + breath * (1 + 2 * el) - (EYE - 0.16) * el, this.pos.z);
    // lateral bob in camera space
    cam.position.x += Math.cos(this.cyaw) * bobX;
    cam.position.z -= Math.sin(this.cyaw) * bobX;
    cam.rotation.set(0, 0, 0);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.cyaw + swayYb;
    // lying down: the head goes back until the camera looks straight up through the canopy, a little rolled
    cam.rotation.x = this.cpitch * (1 - el) + 1.42 * el + swayPb;
    cam.rotation.z = roll + swayRb + 0.22 * el;
  }

  // distance to the nearest thing along a ray: the view centre by default, or a screen point (ndc)
  focusDistance(maxD = 12, ndcX = 0, ndcY = 0) {
    const m = this.maze; if (!m) return 3;
    const dir = (ndcX === 0 && ndcY === 0)
      ? new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation)
      : new THREE.Vector3(ndcX, ndcY, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    const o = this.camera.position;
    const c = this.cell;
    // march in small steps against the walls, the floor, the carved surface and the props
    for (let d = 0.15; d < maxD; d += 0.1) {
      const x = o.x + dir.x * d, y = o.y + dir.y * d, z = o.z + dir.z * d;
      if (y < (this.floorY ? this.floorY(x, z) : 0) + 0.02) return d;
      const gx = Math.floor(x / c), gz = Math.floor(z / c);
      if (gx < 0 || gz < 0 || gx >= m.W || gz >= m.H) return d;
      if (m.grid[gz * m.W + gx] === WALL) {
        // the face is carved inward up to a third of a metre: step back to where the carving starts
        const dd = disp(x, Math.min(y, this.H), z, this.H);
        const inside = Math.hypot(dd[0], dd[2]);
        return Math.max(0.15, d - inside * 0.5);
      }
      for (const [ox, oz, r] of this.obstacles) { if (y < r * 1.6 && (x - ox) * (x - ox) + (z - oz) * (z - oz) < r * r) return d; }
    }
    return maxD;
  }

  cellOf() {
    const c = this.cell;
    return { x: Math.floor(this.pos.x / c), y: Math.floor(this.pos.z / c) };
  }
}
