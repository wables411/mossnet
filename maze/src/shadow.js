// Real shadows from the sun: two things the camera never sees but the sun's
// shadow map does.
//
// The canopy overhead: two leaf layers, the crowns high up and the understory
// lower down, drawn as cut-out masks on big planes that follow the player in
// whole tiles (so the flecks stay put on the ground) and sway a few
// centimetres in the wind (so they shimmer). Their shadow falls on whatever
// is there, walls, logs, the player's own shadow, at the true angle of the
// sun; it replaces the dapple the materials used to paint on.
//
// The walker: Radbro (Game Radbro, his own model and clips), skinned and walking in step
// with the camera. Only his shadow is in the picture, the way a hiker filming
// sees theirs on the moss ahead.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { wind } from './wind.js?v=5d2fdc80';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { Arm, HOLD } from './hands.js?v=5d2fdc80';

const TILE = 10;           // metres one mask tile spans on the ground
const SPAN = 6;            // tiles across a plane: 60 m, wider than the shadow camera's 32 m and its slant
const PX = 512;            // mask resolution: 2 cm a pixel

// drawn but writes nothing: visible to the shadow pass only
// (three.js copies the map and alphaTest from this material onto the shadow pass's own, so a cut-out mask goes here)
const unseen = (map = null) => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide, map, alphaTest: map ? 0.5 : 0 });
// and costs nothing in the picture: the camera's pass draws an empty range (onBeforeRender runs there only,
// the shadow pass has its own hook), so a plane over the whole sky is never rasterised for the screen
function shadowOnly(mesh) {
  mesh.onBeforeRender = () => mesh.geometry.setDrawRange(0, 0);
  mesh.onAfterRender = () => mesh.geometry.setDrawRange(0, Infinity);
  return mesh;
}

// ------------------------------------------------------------------ canopy

function rand(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// a tileable leaf mask: opaque leaves in clusters along twigs, clear gaps between, until `cover` of it is leaf
// big: understory leaves (alder, salmonberry, vine maple) rather than the fine high crowns
export function leafMask(cover, big, seed) {
  const c = document.createElement('canvas'); c.width = c.height = PX;
  const ctx = c.getContext('2d', { willReadFrequently: true });   // read back to measure the cover as it grows
  const r = rand(seed);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
  const wrap = (f, x, y, m) => {   // draw at every tile copy the shape reaches into
    for (const ox of [0, -PX, PX]) for (const oy of [0, -PX, PX]) {
      if (x + ox < -m || x + ox > PX + m || y + oy < -m || y + oy > PX + m) continue;
      f(x + ox, y + oy);
    }
  };
  const covered = () => {
    const d = ctx.getImageData(0, 0, PX, PX).data; let n = 0;
    for (let i = 3; i < d.length; i += 64) if (d[i] > 127) n++;
    return n / (d.length / 64);
  };
  const leafR = big ? [5, 11] : [2.2, 4.5];
  for (let pass = 0; pass < 60 && covered() < cover; pass++) {
    for (let k = 0; k < 14; k++) {
      // a twig: a slightly bent line with leaves either side of it, crowded toward the tip
      const x0 = r() * PX, y0 = r() * PX, len = (big ? 40 : 25) + r() * (big ? 90 : 60), a0 = r() * Math.PI * 2, bend = (r() - 0.5) * 0.9;
      const n = Math.round(len / (big ? 6 : 3));
      wrap((x, y) => {
        ctx.lineWidth = big ? 1.6 : 0.9;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let i = 1; i <= n; i++) { const t = i / n, a = a0 + bend * t; ctx.lineTo(x + Math.cos(a) * len * t, y + Math.sin(a) * len * t); }
        ctx.stroke();
      }, x0, y0, len + 20);
      for (let i = 0; i < n * (big ? 1.4 : 2.6); i++) {
        const t = Math.pow(r(), 0.6), a = a0 + bend * t;
        const side = (r() - 0.5) * (big ? 26 : 16) * (0.4 + t);
        const lx = x0 + Math.cos(a) * len * t - Math.sin(a) * side, ly = y0 + Math.sin(a) * len * t + Math.cos(a) * side;
        const rx = leafR[0] + r() * (leafR[1] - leafR[0]), ry = rx * (0.38 + r() * 0.25), rot = a + (r() - 0.5) * 2.2;
        wrap((x, y) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); }, lx, ly, rx + 1);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.repeat.set(SPAN, SPAN);
  return tex;
}

export class Canopy {
  constructor(scene) {
    this.scene = scene; this.layers = []; this.cache = new Map(); this.active = false;
  }
  mask(cover, big) {
    const key = `${big ? 'u' : 'c'}${Math.round(cover * 20)}`;
    if (!this.cache.has(key)) this.cache.set(key, leafMask(Math.round(cover * 20) / 20, big, big ? 7 : 3));
    return this.cache.get(key);
  }
  // what is overhead in this place: the crowns at the canopy's height, the understory a few metres up
  setPlace(loc) {
    for (const l of this.layers) { this.scene.remove(l.mesh); l.mesh.geometry.dispose(); l.mesh.material.dispose(); }
    this.layers = [];
    const open = loc.ceiling === 'tunnel' || loc.ceiling === 'cave';
    const crown = open ? 0 : Math.min(0.9, (loc.canopy || 0) * 0.85);
    const under = open ? 0 : Math.min(0.4, 0.12 + 0.3 * (loc.trees || 0) * (loc.canopy > 0.1 ? 1 : 0.4));
    this.active = !open;
    if (!this.active) return;
    const ch = loc.canopyHeight || 9;
    const add = (cover, big, height, sway) => {
      if (cover < 0.04) return;
      const tex = this.mask(cover, big);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(TILE * SPAN, TILE * SPAN).rotateX(-Math.PI / 2), unseen(tex));
      mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
      shadowOnly(mesh);
      this.scene.add(mesh);
      this.layers.push({ mesh, height, sway, phase: this.layers.length * 2.1 });
    };
    add(crown, false, ch + 2, 0.06);
    add(under, true, Math.min(ch * 0.5, 5), 0.1);
  }
  // follow the player in whole tiles, shifted toward the sun so the plane's shadow lands round them
  update(player, ground, sunDir, t) {
    const w = wind.strength * 0.6 + wind.gust;
    for (const l of this.layers) {
      const k = l.height / Math.max(sunDir.y, 0.2);
      const cx = Math.round((player.pos.x + sunDir.x * k) / TILE) * TILE, cz = Math.round((player.pos.z + sunDir.z * k) / TILE) * TILE;
      // the leaves move: a slow lean with the gusts and a quick flutter, a few centimetres either way
      const s = Math.sin(t * (1.1 + w) + l.phase) * 0.7 + Math.sin(t * 3.3 + l.phase * 1.7) * 0.3;
      const amp = l.sway * (0.25 + 1.6 * w);
      l.mesh.position.set(cx + wind.dir.x * s * amp, ground + l.height, cz + wind.dir.z * s * amp);
    }
  }
}

// ------------------------------------------------------------------ the walker

// Game Radbro (radbro.fun/assets: Radbro's own model and clips), cut down to bare skinned geometry by
// build/radbro_shadow.py. Standing, he plays his idle; walking, his gait clip, one loop of it per stride of
// the walk's step phase so his feet keep time with the camera's bob; the two blend with how much he walks.
export class Body {
  // eye: the camera's height over the ground; he is scaled so the top of his head is a little above it
  constructor(scene, eye) {
    this.root = new THREE.Group(); this.root.visible = false;
    this.ready = false;
    scene.add(this.root);
    new GLTFLoader().load('models/walker/radbro.glb', g => this.setup(g, eye), undefined, e => console.warn('walker did not load', e));
  }
  setup(gltf, eye) {
    const model = gltf.scene, mat = unseen();
    model.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; shadowOnly(o); } });
    const inner = new THREE.Group(); inner.add(model); this.root.add(inner);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const s = (eye + 0.12) / Math.max(1e-6, box.max.y - box.min.y);
    model.scale.multiplyScalar(s); model.position.y -= box.min.y * s;
    model.updateMatrixWorld(true);
    // which way he faces: from the middle of his feet to the middle of his toes, turned onto the camera's
    const bone = n => { let b = null; model.traverse(o => { if (!b && o.isBone && o.name.replace(/^mixamorig:?/, '') === n) b = o; }); return b; };
    const P = o => o.getWorldPosition(new THREE.Vector3());
    const F = P(bone('LeftToeBase')).add(P(bone('RightToeBase'))).sub(P(bone('LeftFoot'))).sub(P(bone('RightFoot')));
    inner.rotation.y = Math.PI - Math.atan2(F.x, F.z);
    const clip = n => gltf.animations.find(a => a.name === n);
    this.mixer = new THREE.AnimationMixer(model);
    this.idle = this.mixer.clipAction(clip('Artist_Idle')); this.idle.play();
    this.walk = this.mixer.clipAction(clip('Artist_Run')); this.walk.play(); this.walk.paused = true;
    this.walkLen = this.walk.getClip().duration;
    this.headZ = 0.06;   // how far his eyes sit in front of the middle of his head
    // his arms, to be put where the hands the player sees are (hands.js), and plain stand-ins for what they hold:
    // the shadow on the moss shows the raised arm, the torch, the handheld, the cigarette
    this.root.updateMatrixWorld(true);
    this.arms = { Right: new Arm(model, 'Right'), Left: new Arm(model, 'Left') };
    const stand = geo => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.frustumCulled = false; m.visible = false; return shadowOnly(m); };
    const rod = (r, len) => { const g = new THREE.CylinderGeometry(r, r, len, 8); g.rotateZ(Math.PI / 2); return g; };
    this.held = {};
    for (const side of ['Right', 'Left']) {
      const arm = this.arms[side], set = this.held[side] = { torch: stand(new THREE.CylinderGeometry(0.016, 0.016, 0.135, 8)), cig: stand(rod(0.004, 0.084)), device: stand(new THREE.BoxGeometry(0.082, 0.124, 0.016)) };
      for (const k in set) { const h = HOLD[k], at = h.gap ? [arm.gap.x + h.at[0], arm.gap.y + h.at[1], arm.gap.z * arm.sg + h.at[2]] : h.at; arm.hold(set[k], at, h.x, h.y); }
    }
    this._inv = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._zero = new THREE.Vector3();
    this.ready = true;
  }
  // his arms brought to where the hands in the picture are, as far as each hand is up
  follow(hands, camera) {
    const r = this.root; r.updateMatrixWorld(true);
    const inv = this._inv.copy(r.quaternion).invert();
    for (const side of ['Right', 'Left']) {
      const arm = this.arms[side], am = hands.amount[side], cur = hands.arms[side].cur, what = side === 'Right' ? hands.right : hands.left;
      for (const k in this.held[side]) this.held[side][k].visible = k === what && am > 0.5;
      if (!cur || am < 0.03) continue;
      const w = am * am * (3 - 2 * am);
      const aU = arm.upper.quaternion.clone(), aF = arm.fore.quaternion.clone(), aH = arm.hand.quaternion.clone();
      arm.live(r, inv);
      const pos = r.worldToLocal(this._p.copy(cur.pos).applyMatrix4(camera.matrixWorld));
      const quat = inv.clone().multiply(camera.quaternion).multiply(cur.quat);
      arm.update({ pos, quat, curl: cur.curl, k: cur.k }, 1, this._zero);
      arm.upper.quaternion.copy(aU.slerp(arm.upper.quaternion, w)); arm.fore.quaternion.copy(aF.slerp(arm.fore.quaternion, w)); arm.hand.quaternion.copy(aH.slerp(arm.hand.quaternion, w));
    }
  }
  update(player, ground, dt = 0, hands = null, camera = null) {
    const r = this.root;
    r.visible = this.ready && player.lie < 0.02;
    if (!r.visible) return;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    r.position.set(player.pos.x - fx * this.headZ, ground, player.pos.z - fz * this.headZ);
    r.rotation.y = player.yaw;
    const k = Math.min(1, player.stride * 1.3);
    this.walk.time = (((player.stepPhase % 1) + 1) % 1) * this.walkLen;
    this.walk.setEffectiveWeight(k); this.idle.setEffectiveWeight(1 - k);
    this.mixer.update(dt);
    if (hands && hands.ready && camera) this.follow(hands, camera);
  }
}
