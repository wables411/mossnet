// Radbro's hands, seen as he sees them: his own two arms (cut from his model by build/radbro_arms.py) held up in
// front of the camera the way a first-person game shows them, with what he is holding: the hand torch, a cigarette,
// the handheld. The four things are Meshy models (build/meshy_hands.mjs). Nothing here is a canned clip: each arm
// is solved every frame from where the hand should be (shoulder fixed, elbow found, wrist turned to the grip),
// the fingers are curled joint by joint, and the hand follows the walk and lags the turn of the head a little.
//
// The hands live in a scene of their own, drawn over the world into the same picture before the camera pass, so
// they never poke through a wall and they get the same exposure, grain and grade as everything else. They mark
// themselves in the picture's alpha, which is how the camera pass knows to keep them sharp (post.js).
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { buildMQ01 } from './mq01.js?v=40c16947';
import { wind } from './wind.js?v=40c16947';
import { Razor } from './razor.js?v=40c16947';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
// The hands are a VIEWMODEL, built the way Counter-Strike builds its own, not a body seen from its eyes:
//  - a lens of their own, narrower than the world's (CS: viewmodel_fov 60 across a 4:3 picture, which is 47 up and down),
//    so they are drawn large and without the stretch a wide lens puts on a thing held close;
//  - arms sized for the picture, not for the character: Radbro's own hand is 12 cm long, a doll's, so the arms and
//    everything they hold are drawn VM times their size (his hand comes to 18 cm, a grown hand);
//  - shoulders put where the forearm runs up into the picture from its lower corner, not where a body would have them;
//  - the whole thing moved as one piece (this.rig): it trails the turn of the head, bobs with the walk, breathes.
export const VM = 1, VIEW_FOV = 47;
// the shoulders' middle, in the camera's space: low, and behind the eye, so the upper arms stay out of the picture
export const SHOULDERS = [0, -0.28, 0.1];

// Where a hand is and how it is turned, written for the RIGHT hand in the camera's own space (x right, y up, the
// view down -z, metres); the left hand uses the same poses mirrored. fwd: the way the knuckles point from the
// wrist. palm: the way the palm faces. curl: thumb across, thumb bend, then index, middle, ring, little finger.
export const POSES = {
  down:    { pos: [0.34, -0.7, -0.2], fwd: [-0.1, 0.5, -0.85], palm: [-1, 0, 0.1], curl: [0.5, 0.4, 0.6, 0.65, 0.7, 0.75], k: [0.75, 1, 0.6] },
  // the anglehead torch, held as one is: its body upright in a closed fist, thumb side up, the thumb wrapped over
  // the fingers, the head standing clear above the fist with its lens facing the way he looks
  torch:   { pos: [0.17, -0.17, -0.42], fwd: [-0.05, 0.05, -1], palm: [-0.93, 0, 0.36], curl: [1.0, 0.85, 1.25, 1.3, 1.34, 1.36], k: [1, 1.2, 0.85] },   // a fist round its body, the thumb laid over the fingers
  // a cigarette between the first two fingers, the hand resting low
  cig:     { pos: [0.23, -0.17, -0.44], fwd: [-0.42, 0.42, -0.8], palm: [-0.35, -0.82, -0.25], curl: [0.55, 0.45, 0.42, 0.5, 0.78, 0.9], k: [0.75, 1, 0.6] },   // a hand at ease, the back of it up, the cigarette between the first two fingers
  // and at the mouth
  cigMouth: { pos: [0.1, -0.15, -0.22], fwd: [-0.85, 0.4, -0.2], palm: [0.1, 0, 1], curl: [0.9, 0.5, 0.4, 0.5, 0.85, 0.95] },
  // the lighter, brought up in front of the mouth: upright in the fist, the thumb on its wheel, its flame at the
  // end of the cigarette the other hand is holding there
  lighter: { pos: [0.08, -0.2, -0.3], fwd: [-0.55, 0.15, -0.82], palm: [-0.85, 0, 0.5], curl: [0.35, 0.75, 1.0, 1.0, 1.05, 1.1], k: [0.6, 1, 1] },
  // the handheld, cradled low with the screen tipped up to the eye
  device:  { pos: [0.24, -0.26, -0.48], fwd: [-0.12, 0.9, -0.42], palm: [-0.15, 0.42, 0.9], curl: [0.6, 0.3, 0.2, 0.2, 0.2, 0.25] },
  // and brought right up to the face to read and type
  deviceUp: { pos: [-0.012, -0.15, -0.215], fwd: [0, 0.985, -0.17], palm: [0, 0.17, 0.985], curl: [0.6, 0.3, 0.2, 0.2, 0.2, 0.25] },
};

// where each thing sits in the hand: at [along the knuckles, out of the palm, to the thumb's side] in metres, and
// which way its own x and y axes go, in the same terms. gap: measured from between the first two fingers instead
// how strongly the place's light falls on the hands, and how the viewmodel moves (see Hands.update); both on MM to be tuned
export const LIGHT = { fill: 0.34, sun: 0.22, key: 0.95, keySun: 0.45, rim: 0.5 };
export const MOTION = { follow: 5, max: 0.3, turn: 0.5, shift: 0.05, roll: 0.22, side: 0.011, up: 0.006, lower: 0.012, back: 0.012, tilt: 0.012, shove: 0.012, pitch: 1.2, breath: 0.0022 };
export const HOLD = {
  // A handle is held in the POWER GRIP: lying aslant across the palm from the root of the forefinger to the heel of
  // the hand below the little finger, against the crease the fingers fold on, the fingers wrapped round it and the
  // thumb laid over them.
  torch: { at: [0.098, 0.032, 0.012], x: [1, 0, -0.12], y: [0.12, 0, 1], grasp: true },
  // (the torch's own x is the way its lens faces, its y is up its body)
  lighter: { at: [0.07, 0.017, 0.034], x: [1, 0, 0], y: [0, 0, 1], grasp: true },   // upright in the fist, the thumb on its wheel
  cig: { gap: true, at: [0.017, -0.019, 0.002], x: [0.75, -0.65, 0.1], y: [0.65, 0.75, 0] },   // between the first two fingers, leaning the way they point, its lit end out past the back of the hand
  // the handheld lies on the fingers and the heel of the hand, face out, the fingertips hooked round its far edge and
  // the thumb on its near one
  device: { at: [0.118, 0.024, 0.0], x: [0, 0, -1], y: [1, 0, 0], fixed: { joints: [[-0.16, -0.06, 0.0], [-0.16, -0.06, 0.0], [-0.15, -0.05, 0.0], [-0.13, -0.04, 0.02]], thumb: [0.62, 0.2, 0.32, 0.38] } },   // held as a Game Boy is in one hand: its foot in the palm, the fingers flat up its back and hidden by it, the thumb come round onto the buttons
  // the razor, in the fist like a knife: its handle down through the fist and out past the little finger, its pin
  // just above the forefinger, the blade's edge toward the knuckles (it swings in the plane the fingers point in)
  // (it is hung by the middle of its handle, which is where the fingers have it and what it turns about in a flip)
  razor: { at: [0.096, 0.018, -0.02], x: [-0.12, 0, -1], y: [-1, 0, 0.12], grasp: 'handle' },
};

export class Arm {
  // unit: how many times life size this skeleton is drawn (what it holds is drawn the same)
  constructor(model, side, unit = 1) {
    this.side = side; this.sg = side === 'Right' ? 1 : -1;
    const bone = n => { let b = null; model.traverse(o => { if (!b && o.isBone && o.name.replace(/^mixamorig:?/, '') === n) b = o; }); return b; };
    const B = n => bone(side + n);
    this.upper = B('Arm'); this.fore = B('ForeArm'); this.hand = B('Hand');
    const wp = o => o.getWorldPosition(new THREE.Vector3()), wq = o => o.getWorldQuaternion(new THREE.Quaternion());
    this.S = wp(this.upper);
    const E = wp(this.fore), W = wp(this.hand);
    this.L1 = E.distanceTo(this.S); this.L2 = W.distanceTo(E);
    this.restU = wq(this.upper); this.restF = wq(this.fore); this.restH = wq(this.hand);
    this.parentQ = wq(this.upper.parent);
    this.dirU = E.clone().sub(this.S).normalize(); this.dirF = W.clone().sub(E).normalize();
    this.axisF = this.fore.children.find(c => c === this.hand).position.clone().normalize();   // the forearm's own long axis
    // the hand's own frame, from its bones: knuckles from the wrist, the thumb's side, the palm's face
    const idx = B('HandIndex1'), mid = B('HandMiddle1'), pnk = B('HandPinky1');
    const f0 = mid.position.clone().normalize();
    const t0 = idx.position.clone().sub(pnk.position); t0.addScaledVector(f0, -t0.dot(f0)).normalize();
    const n0 = f0.clone().cross(t0).multiplyScalar(-this.sg);
    this.local = new THREE.Matrix4().makeBasis(f0, t0, n0);
    this.free = unit !== 1 || !bone('Spine');     // a viewmodel's arm: no body behind it (see update)
    this.localT = this.local.clone().transpose();
    // the fingers: every joint's rest turn, and the axis it bends about (in its own space)
    const handQ = this.restH, bendW = f0.clone().cross(n0).applyQuaternion(handQ), fW = f0.clone().applyQuaternion(handQ), nW = n0.clone().applyQuaternion(handQ);
    const toLocal = (b, axisW) => axisW.clone().applyQuaternion(wq(b).invert()).normalize();
    this.fingers = FINGERS.map(name => [1, 2, 3].map(i => { const b = B('Hand' + name + i); return { b, rest: b.quaternion.clone(), axis: toLocal(b, bendW) }; }));
    // an open hand's fingers are spread; closing, they come together. How far each first joint is turned from the
    // middle finger's line, about the palm's own normal, is taken back out as the finger curls.
    { const dir = fi => wp(this.fingers[fi][1].b).sub(wp(this.fingers[fi][0].b)).normalize(), dm = dir(1);
      this.fingers.forEach((j, fi) => { const d = dir(fi); j[0].spread = Math.atan2(dm.clone().cross(d).dot(nW), dm.dot(d)); j[0].nAxis = toLocal(j[0].b, nW); }); }
    const th = [1, 2, 3].map(i => B('HandThumb' + i));
    const tdW = wp(th[1]).sub(wp(th[0])).normalize();
    const tW = t0.clone().applyQuaternion(handQ);
    const oppSign = fW.clone().cross(tW).dot(nW) > 0 ? 1 : -1;
    this.thumb = th.map((b, i) => ({ b, rest: b.quaternion.clone(), opp: toLocal(b, fW.clone().multiplyScalar(oppSign)), bend: toLocal(b, tdW.clone().cross(nW).normalize()), i }));
    // what the hand holds rides here: x along the knuckles, y out of the palm, z to the thumb's side (the little
    // finger's on the left hand), in metres
    this.holder = new THREE.Object3D();
    this.holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f0, n0, f0.clone().cross(n0)));
    this.holder.scale.setScalar(unit / this.hand.getWorldScale(new THREE.Vector3()).x);   // so that what is held is measured in metres (times the viewmodel's size)
    this.hand.add(this.holder);
    // where the cigarette goes: between the first two fingers, at their middle joints
    this.hand.updateMatrixWorld(true);
    const gap = wp(B('HandIndex2')).add(wp(B('HandMiddle2'))).multiplyScalar(0.5);
    this.gap = this.holder.worldToLocal(gap);
    this.cur = null;
    this._q = new THREE.Quaternion(); this._m = new THREE.Matrix4(); this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._c = new THREE.Vector3();
  }

  // for a skeleton that is walking about (his shadow's): where the shoulder is now and how its parent is turned,
  // in the frame the arm was measured in at rest. root: the thing that carries the skeleton through the world
  live(root, rootInv) {
    this.S = root.worldToLocal(this.upper.getWorldPosition(this.S));
    this.parentQ.copy(rootInv).multiply(this.upper.parent.getWorldQuaternion(this._q));
  }

  // a pose written for the right hand, as this hand's target: { pos, quat, curl }
  target(p, xs) {
    const m = this.sg, pos = new THREE.Vector3(p.pos[0] * m * xs, p.pos[1], p.pos[2]);
    const f = new THREE.Vector3(p.fwd[0] * m, p.fwd[1], p.fwd[2]).normalize();
    const n = new THREE.Vector3(p.palm[0] * m, p.palm[1], p.palm[2]); n.addScaledVector(f, -n.dot(f)).normalize();
    const t = f.clone().cross(n).multiplyScalar(this.sg);
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f, t, n).multiply(this.localT));
    return { pos, quat, curl: p.curl.slice(), k: p.k || [1, 1.15, 0.8] };
  }

  // ease toward a target, then solve the arm to it
  update(tgt, k, add) {
    const tk = tgt.k || [1, 1.15, 0.8];
    if (!this.cur) this.cur = { pos: tgt.pos.clone(), quat: tgt.quat.clone(), curl: tgt.curl.slice(), k: tk.slice() };
    const c = this.cur;
    c.pos.lerp(tgt.pos, k); c.quat.slerp(tgt.quat, k);
    for (let i = 0; i < 6; i++) c.curl[i] += (tgt.curl[i] - c.curl[i]) * k;
    for (let i = 0; i < 3; i++) c.k[i] += (tk[i] - c.k[i]) * k;
    // every joint's own angle: from a grip found on the thing itself (tgt.joints, tgt.thumb; see grasp) or, with
    // nothing held, from the pose's one curl a finger
    if (!c.j) { c.j = [0, 1, 2, 3].map(() => [0, 0, 0]); c.th = [0, 0, 0, 0]; }
    const gl = tgt.loose || [1, 1, 1, 1], g = (gl[0] + gl[1] + gl[2] + gl[3]) / 4;
    for (let fi = 0; fi < 4; fi++) for (let i = 0; i < 3; i++) { const want = tgt.joints ? tgt.joints[fi][i] * gl[fi] : tgt.curl[2 + fi] * tk[i]; c.j[fi][i] += (want - c.j[fi][i]) * k; }
    { const wt = tgt.thumb ? tgt.thumb.map(v => v * (0.5 + 0.5 * g)) : [tgt.curl[0], tgt.curl[1] * 0.35, tgt.curl[1] * 0.8, tgt.curl[1] * 0.8]; for (let i = 0; i < 4; i++) c.th[i] += (wt[i] - c.th[i]) * k; }
    const T = this._a.copy(c.pos).add(add);
    // shoulder to wrist: the elbow sits on the circle both bones allow, swung down and out
    const d3 = this._b.copy(T).sub(this.S); let d = d3.length();
    if (this.free) return this.solveFree(T, c);
    const reach = (this.L1 + this.L2) * 0.995;
    if (d > reach) { d3.multiplyScalar(reach / d); d = reach; T.copy(this.S).add(d3); }
    const dir = d3.clone().multiplyScalar(1 / d);
    const a = (this.L1 * this.L1 - this.L2 * this.L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, this.L1 * this.L1 - a * a));
    const pole = this._c.set(0.55 * this.sg, -1, 0.35); pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const E = this.S.clone().addScaledVector(dir, a).addScaledVector(pole, h);
    const qU = new THREE.Quaternion().setFromUnitVectors(this.dirU, E.clone().sub(this.S).normalize()).multiply(this.restU);
    const qF = new THREE.Quaternion().setFromUnitVectors(this.dirF, T.clone().sub(E).normalize()).multiply(this.restF);
    // the forearm takes up most of the wrist's roll, as a forearm does (or the sleeve wrings like a rag)
    const rel = qF.clone().invert().multiply(c.quat), ax = this.axisF, dot = rel.x * ax.x + rel.y * ax.y + rel.z * ax.z;
    const tw = new THREE.Quaternion(ax.x * dot, ax.y * dot, ax.z * dot, rel.w).normalize();
    qF.multiply(new THREE.Quaternion().slerp(tw, 0.7));
    this.upper.quaternion.copy(this.parentQ).invert().multiply(qU);
    this.fore.quaternion.copy(qU).invert().multiply(qF);
    this.hand.quaternion.copy(qF).invert().multiply(c.quat);
    this.curlFingers(c);
  }

  // A viewmodel's arm has no body to hang from, and must never show a broken wrist. So the forearm is not found
  // from a shoulder: it is laid BEHIND THE HAND, along the way the knuckles point, leaned toward the lower outside
  // corner of the picture it has to come in from, and never more than WRIST away from the hand's own line. The
  // upper arm (unseen, unskinned) is then simply put behind the elbow.
  solveFree(T, c) {
    const sg = this.sg, WRIST = 0.42;
    const fw = this._fw || (this._fw = new THREE.Vector3()); fw.set(1, 0, 0).applyMatrix4(this._m.makeRotationFromQuaternion(c.quat).multiply(this.local)).normalize();
    const dir = this._b.set(T.x - 0.34 * sg, T.y + 0.46, T.z - 0.02).normalize().multiplyScalar(0.45).addScaledVector(fw, 0.55).normalize();
    const ang = Math.acos(Math.max(-1, Math.min(1, dir.dot(fw))));
    if (ang > WRIST) dir.lerp(fw, 1 - WRIST / ang).normalize();
    const E = this._c.copy(T).addScaledVector(dir, -this.L2);
    const up = (this._up || (this._up = new THREE.Vector3())).set(0.1 * sg, -0.3, 1).normalize();
    const S = (this._s2 || (this._s2 = new THREE.Vector3())).copy(E).addScaledVector(up, this.L1);
    this.upper.parent.updateWorldMatrix(true, false);
    this.upper.position.copy(this.upper.parent.worldToLocal(S.clone()));
    const qU = new THREE.Quaternion().setFromUnitVectors(this.dirU, up.clone().negate()).multiply(this.restU);
    const qF = new THREE.Quaternion().setFromUnitVectors(this.dirF, dir).multiply(this.restF);
    const rel = qF.clone().invert().multiply(c.quat), ax = this.axisF, dot = rel.x * ax.x + rel.y * ax.y + rel.z * ax.z;
    const tw = new THREE.Quaternion(ax.x * dot, ax.y * dot, ax.z * dot, rel.w).normalize();
    qF.multiply(new THREE.Quaternion().slerp(tw, 0.75));
    this.upper.quaternion.copy(this.parentQ).invert().multiply(qU);
    this.fore.quaternion.copy(qU).invert().multiply(qF);
    this.hand.quaternion.copy(qF).invert().multiply(c.quat);
    this.curlFingers(c);
  }
  curlFingers(c) {
    this.fingers.forEach((joints, fi) => joints.forEach((j, i) => {
      j.b.quaternion.copy(j.rest);
      // (the model's fingers are modelled spread wide; a hand at ease holds them together)
      if (i === 0 && j.spread) j.b.quaternion.multiply(this._q.setFromAxisAngle(j.nAxis, -j.spread * (0.82 + 0.18 * Math.min(1, c.j[fi][0] / 0.6))));
      j.b.quaternion.multiply(this._q.setFromAxisAngle(j.axis, c.j[fi][i]));
    }));
    for (const j of this.thumb) {
      j.b.quaternion.copy(j.rest);
      if (j.i === 0) j.b.quaternion.multiply(this._q.setFromAxisAngle(j.opp, c.th[0]));
      j.b.quaternion.multiply(this._q.setFromAxisAngle(j.bend, c.th[j.i + 1]));
    }
  }

  // HOW A HAND TAKES HOLD OF A THING. A hand does not go to a remembered shape: it closes until it meets what it
  // is holding. So the grip is found on the thing itself, the way a hand finds it. Each finger in turn: the
  // knuckle bends until the first bone of the finger lies on the thing, then the middle joint until the second
  // does, then the last joint until the fingertip does; no joint past what a real one allows (knuckle 85, middle
  // joint 105, last joint 65 degrees). The thumb is brought across the palm until it meets the thing, then bent
  // onto it. A finger that finds nothing to close on rests half curled, as an idle finger does.
  //   pts: the thing's surface, as points in the world (Float32Array xyz), with the thing already in the hand
  // Returns { joints: [4 fingers][3 angles], thumb: [across, bend, bend, bend] }.
  grasp(pts) {
    // (a finger is soft: its bone may come to within PRESS of its own thickness of the thing before it is stopped)
    const R = [0.0092, 0.0095, 0.009, 0.008], RT = 0.0108, PRESS = 0.6;
    const LIM = [1.48, 1.83, 1.13], RATIO = [0.8, 1, 0.62], STEPS = 60, n = pts.length / 3;
    const P = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], v = new THREE.Vector3();
    const hand = this.hand;
    hand.updateWorldMatrix(true, true);
    const hw = hand.getWorldPosition(new THREE.Vector3()), near = [];
    for (let i = 0; i < n; i++) { const x = pts[i * 3] - hw.x, y = pts[i * 3 + 1] - hw.y, z = pts[i * 3 + 2] - hw.z; if (x * x + y * y + z * z < 0.26 * 0.26) near.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); }
    const m = near.length / 3;
    const touch = (a, b, r, from = 0.35) => {          // does the bone from a to b reach the thing (its root end, by the joint, does not count)
      const rr = r * PRESS * r * PRESS;
      for (let sI = 0; sI <= 4; sI++) {
        v.copy(a).lerp(b, from + (1 - from) * sI / 4);
        for (let i = 0; i < m; i++) { const x = near[i * 3] - v.x, y = near[i * 3 + 1] - v.y, z = near[i * 3 + 2] - v.z; if (x * x + y * y + z * z < rr) return true; }
      }
      return false;
    };
    const out = { joints: [], thumb: [0, 0, 0, 0] };
    const state = { j: [0, 1, 2, 3].map(() => [0, 0, 0]), th: [0, 0, 0, 0] };
    const pose = () => { this.curlFingers(state); hand.updateWorldMatrix(false, true); };
    const bones = joints => { for (let i = 0; i < 3; i++) joints[i].b.getWorldPosition(P[i]); P[3].copy(P[2]).add(v.copy(P[2]).sub(P[1]).multiplyScalar(0.82)); };
    // The fingers close together, every joint at once in the proportion a closing hand keeps. When a bone of a
    // finger meets the thing, the joints behind that bone stop; the ones beyond it go on closing round it.
    this.fingers.forEach((joints, fi) => {
      const a = state.j[fi], r = R[fi], stop = [false, false, false]; let met = false;
      for (let st = 1; st <= STEPS; st++) {
        const prev = a.slice();
        for (let i = 0; i < 3; i++) if (!stop[i]) a[i] = Math.min(LIM[i], LIM[i] * RATIO[i] / 0.8 * st / STEPS);
        pose(); bones(joints);
        let hit = -1;
        for (let b = 0; b < 3; b++) if (!stop[b] && touch(P[b], P[b + 1], r)) { hit = b; break; }
        if (hit >= 0) { met = true; for (let i = 0; i <= hit; i++) { if (!stop[i]) a[i] = prev[i]; stop[i] = true; } }
        if (stop[2]) break;
      }
      if (!met) { a[0] = 0.5; a[1] = 0.7; a[2] = 0.4; }                   // nothing there for it: at rest
      out.joints.push(a.slice());
    });
    // Fingers close as a hand, not one by one: none is left standing open beside the others (a little finger that
    // found nothing under it still folds with its neighbours).
    { const med = i => { const v2 = out.joints.map(f => f[i]).sort((x, y) => x - y); return (v2[1] + v2[2]) / 2; };
      for (let i = 0; i < 3; i++) { const mI = med(i); out.joints.forEach(f => { f[i] = Math.max(f[i], mI * 0.88); }); } }
    out.joints.forEach((f, fi) => { state.j[fi] = f.slice(); });
    // The thumb comes across the palm to stand against the fingers, then bends onto the thing.
    { const T = this.thumb.map(j => j.b), tp = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
      const tb = () => { for (let i = 0; i < 3; i++) T[i].getWorldPosition(tp[i]); tp[3].copy(tp[2]).add(v.copy(tp[2]).sub(tp[1]).multiplyScalar(0.9)); };
      const th = state.th, OPP = 1.0, tl = [0.5, 0.95, 1.15]; let met = false;
      for (let st = 1; st <= STEPS && !met; st++) {
        const prev = th.slice();
        th[0] = OPP * Math.min(1, st / (STEPS * 0.5));
        const k = Math.max(0, (st - STEPS * 0.3) / (STEPS * 0.7));
        th[1] = tl[0] * k; th[2] = tl[1] * k; th[3] = tl[2] * k;
        pose(); tb();
        if (st > STEPS * 0.55 && touch(tp[2], tp[3], RT, 0.5)) { met = true; for (let i = 0; i < 4; i++) th[i] = prev[i]; }   // (its last bone: the ball of the thumb lies against a held thing from the start)
      }
      if (!met) { th[0] = 0.95; th[1] = 0.3; th[2] = 0.5; th[3] = 0.55; }      // round it and onto the fingers
      out.thumb = th.slice();
    }
    if (this.cur) this.curlFingers(this.cur);            // the hand back as it was
    return out;
  }

  // put a thing in the hand. at: [along the knuckles, out of the palm, to the thumb's side]; x and y: which way the
  // thing's own x and y axes go, in the same terms
  hold(obj, at, x, y) {
    const cv = a => new THREE.Vector3(a[0], a[1], a[2] * this.sg);
    const X = cv(x).normalize(), Y = cv(y); Y.addScaledVector(X, -Y.dot(X)).normalize();
    obj.position.copy(cv(at));
    obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, X.clone().cross(Y)));
    this.holder.add(obj);
  }
}

// --- the cigarette and its pack are Meshy's shapes with their surfaces painted here, from the owner's pictures:
// a long white cigarette with a speckled cork filter and a gold band, and the pale green WINNSBORO FEINT pack. The paint is laid on by where each point of the shape
// is (along the cigarette and round it; the pack face by face), since Meshy's own unwrapping is not ours to draw on.
function cigTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d');
  const paper = g.createLinearGradient(0, 0, 0, 64); paper.addColorStop(0, '#ffffff'); paper.addColorStop(1, '#e4e2dc');
  g.fillStyle = paper; g.fillRect(0, 0, 512, 64);
  g.fillStyle = 'rgba(150,150,145,0.16)'; for (let x = 160; x < 512; x += 7) g.fillRect(x, 0, 1, 64);
  const cork = g.createLinearGradient(0, 0, 0, 64); cork.addColorStop(0, '#f0a64a'); cork.addColorStop(1, '#d68a2e');
  g.fillStyle = cork; g.fillRect(0, 0, 152, 64);
  for (let i = 0; i < 150; i++) { g.fillStyle = `rgba(255,${200 + Math.random() * 40 | 0},${130 + Math.random() * 50 | 0},${0.5 + Math.random() * 0.4})`; g.fillRect(Math.random() * 148, Math.random() * 64, 1 + Math.random() * 3, 1 + Math.random() * 2); }
  g.fillStyle = '#c9a23e'; g.fillRect(152, 0, 4, 64); g.fillStyle = '#f3e3a0'; g.fillRect(153, 0, 1, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function packTexture() {
  // the owner's pack: pale green, WINNSBORO FEINT in a blue serif, a garden trowel, "garden bold", a blue stamp over
  // a red tear line at the top, and the white boxed notice across the foot
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  const GREEN = '#cfe5c6', INK = '#4b6190';
  g.fillStyle = '#bdd6b4'; g.fillRect(0, 0, 512, 512);
  // the face (left half)
  const face = g.createLinearGradient(0, 0, 256, 0); face.addColorStop(0, '#c6ddbd'); face.addColorStop(0.5, GREEN); face.addColorStop(1, '#c9e0c0');
  g.fillStyle = face; g.fillRect(0, 0, 256, 512);
  g.fillStyle = '#c2332e'; g.fillRect(0, 62, 256, 2);                                        // the tear line
  g.fillStyle = '#3f67a8'; g.fillRect(118, 14, 78, 58); g.fillStyle = '#6f93c9'; g.fillRect(124, 20, 66, 46);   // the stamp
  g.strokeStyle = '#dfe9f6'; g.lineWidth = 1.5; g.strokeRect(128, 24, 58, 38); g.fillStyle = '#dfe9f6'; for (let i = 0; i < 4; i++) g.fillRect(134, 31 + i * 7, 46 - (i % 2) * 12, 2);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
  g.font = '30px Georgia, "Times New Roman", serif'; g.fillText('WINNSBORO', 128, 168); g.fillText('FEINT', 128, 204);
  // the trowel: a pale blade, a brown handle, a ferrule between
  g.save(); g.translate(128, 284); g.rotate(0.16);
  g.fillStyle = '#a9aeb0'; g.beginPath(); g.moveTo(0, -46); g.quadraticCurveTo(15, -30, 12, -6); g.lineTo(-12, -6); g.quadraticCurveTo(-15, -30, 0, -46); g.fill();
  g.fillStyle = '#8d9294'; g.fillRect(-2, -6, 4, 12);
  g.fillStyle = '#8a4b2c'; g.beginPath(); g.moveTo(-5, 6); g.lineTo(5, 6); g.lineTo(4, 44); g.quadraticCurveTo(0, 49, -4, 44); g.closePath(); g.fill();
  g.restore();
  g.fillStyle = INK; g.font = 'bold 15px Georgia, "Times New Roman", serif'; g.fillText('garden bold', 128, 372);
  // the notice: black rule, white ground, heavy black words
  g.fillStyle = '#111'; g.fillRect(56, 396, 200, 112); g.fillStyle = '#fff'; g.fillRect(61, 401, 190, 102);
  g.fillStyle = '#111'; g.font = 'bold 19px Arial, Helvetica, sans-serif';
  ['Frail pyramids adrift', 'in void purple suns', 'imperious static god', 'governs rainclouds'].forEach((l, i) => g.fillText(l, 156, 417 + i * 23, 182));
  // the little boxed mark at the foot
  g.fillStyle = '#111'; g.fillRect(10, 440, 36, 60); g.fillStyle = '#fff'; g.fillRect(13, 443, 30, 54); g.strokeStyle = '#111'; g.lineWidth = 1.5; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(20 + i * 8, 471, 3, 0, 6.3); g.stroke(); }
  // the side (next quarter): the same green in shade, the notice's end wrapping round
  g.fillStyle = '#b4cfab'; g.fillRect(256, 0, 128, 512);
  g.fillStyle = '#c2332e'; g.fillRect(256, 62, 128, 2);
  g.fillStyle = '#111'; g.fillRect(256, 396, 128, 112); g.fillStyle = '#f2f2f2'; g.fillRect(256, 401, 123, 102);
  // the top (upper right): foil under the stamp
  const foil = g.createLinearGradient(384, 0, 512, 256); foil.addColorStop(0, '#d9dcdc'); foil.addColorStop(0.5, '#f6f7f7'); foil.addColorStop(1, '#b9bdbe');
  g.fillStyle = foil; g.fillRect(384, 0, 128, 256);
  g.strokeStyle = 'rgba(120,125,128,0.6)'; g.lineWidth = 1; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(384 + Math.random() * 128, 0); g.lineTo(384 + Math.random() * 128, 256); g.stroke(); }
  g.fillStyle = '#3f67a8'; g.fillRect(442, 60, 40, 140); g.fillStyle = '#6f93c9'; g.fillRect(446, 66, 32, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// lay a painted skin on a shape by where its points are. uvOf(place in the shape's box 0..1, face normal) -> [u, v]
function repaint(root, tex, uvOf, rough) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root), span = box.getSize(new THREE.Vector3()), inv = new THREE.Matrix4();
  root.traverse(m => {
    if (!m.isMesh) return;
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    geo.applyMatrix4(m.matrixWorld);
    // drawn where it was, but measured in the root's own space from now on
    m.matrixAutoUpdate = false; m.matrix.copy(inv.copy(m.parent.matrixWorld).invert()); m.matrixWorldNeedsUpdate = true;
    geo.computeVertexNormals();
    const p = geo.attributes.position, uv = new Float32Array(p.count * 2), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      n.copy(b).sub(a).cross(q.copy(c).sub(a)).normalize();
      [a, b, c].forEach((v, k) => { const [u, w] = uvOf(q.copy(v).sub(box.min).divide(span), n); uv[(i + k) * 2] = u; uv[(i + k) * 2 + 1] = w; });
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    m.geometry = geo;
    m.material = new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: 0 });
  });
}
const cigUV = r => [r.x, Math.abs(Math.atan2(r.z - 0.5, r.y - 0.5)) / Math.PI];
const packUV = (r, n) => {
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  if (az >= ax && az >= ay) return [0.5 * (n.z > 0 ? r.x : 1 - r.x), r.y];
  if (ax >= ay) return [0.5 + 0.25 * r.z, r.y];
  return n.y > 0 ? [0.75 + 0.25 * r.x, 0.5 + 0.5 * r.z] : [0.6, 0.02];
};

// a lighter's flame: a teardrop, blue at the wick, white-yellow in the body, orange at the tip
function flameTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  const body = g.createLinearGradient(0, 128, 0, 0);
  body.addColorStop(0, 'rgba(60,110,255,0.9)'); body.addColorStop(0.16, 'rgba(255,240,190,1)'); body.addColorStop(0.55, 'rgba(255,205,90,1)'); body.addColorStop(0.9, 'rgba(255,120,30,0.7)'); body.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = body; g.beginPath(); g.moveTo(32, 126); g.bezierCurveTo(4, 110, 10, 60, 32, 2); g.bezierCurveTo(54, 60, 60, 110, 32, 126); g.fill();
  const core = g.createRadialGradient(32, 96, 0, 32, 96, 22); core.addColorStop(0, 'rgba(255,255,255,0.9)'); core.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = core; g.fillRect(0, 60, 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// a soft round puff, for smoke
function puffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.4, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// smoke as soft sprites that swell, drift and thin out: a pool, in whichever scene it is given
class Smoke {
  constructor(scene, n, tex) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.age = new Float32Array(n).fill(9); this.life = new Float32Array(n).fill(1); this.size = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aAge', new THREE.BufferAttribute(new Float32Array(n), 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { map: { value: tex }, uColor: { value: new THREE.Color(0.8, 0.8, 0.8) }, uScale: { value: 600 }, uOpacity: { value: 0.3 } },
      vertexShader: /* glsl */`attribute float aAge, aSize; varying float vA; uniform float uScale;
        void main(){ vA = aAge; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aAge >= 1.0 ? 0.0 : uScale * aSize * (0.35 + 1.6 * sqrt(aAge)) / max(0.05, -mv.z); }`,
      fragmentShader: /* glsl */`uniform sampler2D map; uniform vec3 uColor; uniform float uOpacity; varying float vA;
        void main(){ float a = texture2D(map, gl_PointCoord).a * uOpacity * smoothstep(0.0, 0.12, vA) * (1.0 - vA) * (1.0 - vA); if (a < 0.003) discard; gl_FragColor = vec4(uColor, a); }`,
    });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false;
    scene.add(this.points);
  }
  emit(p, v, life, size) {
    const i = this.i; this.i = (i + 1) % this.n;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3); this.age[i] = 0; this.life[i] = life; this.size[i] = size;
  }
  // turb: how much each puff is jostled about as it goes (a breath breaks up; a spark does not)
  update(dt, rise, drag, turb = 0) {
    const a = this.points.geometry.attributes.aAge.array; let live = false;
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= 1) { a[i] = 1; continue; }
      live = true;
      this.age[i] = Math.min(1, this.age[i] + dt / this.life[i]); a[i] = this.age[i];
      const k = Math.exp(-dt * drag), j = i * 3;
      this.vel[j] *= k; this.vel[j + 1] = this.vel[j + 1] * k + rise * dt; this.vel[j + 2] *= k;
      if (turb) { this.vel[j] += (Math.random() - 0.5) * turb * dt; this.vel[j + 1] += (Math.random() - 0.5) * turb * dt; this.vel[j + 2] += (Math.random() - 0.5) * turb * dt; }
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
    }
    this.points.visible = live;
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.aAge.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  }
}

// The thread of smoke off a cigarette, as it is always drawn: one thin unbroken line climbing from the ember,
// straight for a hand's breadth, then wavering, then curling wide and thinning away to nothing. It is a ribbon
// through the air of the place itself, so it trails behind when he walks or turns his hand, a millimetre or two
// wide at the ember and a few centimetres where it fades. Each point of it remembers when it left the ember; the
// wave that bends the line travels up it from there.
class Wisp {
  constructor(scene, n = 84) {
    this.n = n; this.pts = []; this.acc = 0; this.T = 0; this.life = 3.6;
    this.pos = new Float32Array(n * 6); this.aT = new Float32Array(n * 2);
    const side = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < n; i++) { side[i * 2] = -1; side[i * 2 + 1] = 1; if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('aT', new THREE.BufferAttribute(this.aT, 1)); geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1)); geo.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uColor: { value: new THREE.Color(0.85, 0.88, 0.95) }, uOpacity: { value: 0.32 } },
      vertexShader: /* glsl */`attribute float aT, aSide; varying float vT, vS; void main(){ vT = aT; vS = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`uniform vec3 uColor; uniform float uOpacity; varying float vT, vS;
        void main(){ float a = uOpacity * pow(max(0.0, 1.0 - vS * vS), 1.6) * smoothstep(0.0, 0.04, vT) * pow(clamp(1.0 - vT, 0.0, 1.0), 2.2); if (a < 0.004) discard; gl_FragColor = vec4(uColor, a); }`,
    });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.visible = false;
    scene.add(this.mesh);
    this._c = new THREE.Vector3(); this._p = new THREE.Vector3(); this._tan = new THREE.Vector3(); this._side = new THREE.Vector3();
  }
  // where a point of the line is now: risen from where it left the ember, and bent by the wave
  at(i, out) {
    const q = this.pts[i], a = q.age, k = a / this.life, amp = 0.0015 + 0.085 * Math.pow(k, 1.5), ph = q.s * 1.7;
    return out.set(q.x + amp * (Math.sin(a * 2.6 + ph) + 0.35 * Math.sin(a * 5.9 + ph * 1.7)), q.y, q.z + amp * (Math.cos(a * 2.1 + ph * 1.3) + 0.3 * Math.sin(a * 4.7 + ph)));
  }
  // from: the ember's place in the world while it smokes, or null (the line then drifts off and fades)
  update(dt, from, camPos) {
    this.T += dt;
    for (const q of this.pts) { q.age += dt; q.y += (0.085 + 0.07 * q.age) * dt; q.x += wind.vec.x * 0.12 * q.age * dt; q.z += wind.vec.z * 0.12 * q.age * dt; }
    while (this.pts.length && this.pts[this.pts.length - 1].age > this.life) this.pts.pop();
    // smoke has no corners: where the hand moved sharply the line it left is eased out, each point drawn toward
    // the middle of its neighbours, a little every frame (twice over, so a kink is gone in a few frames)
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < this.pts.length - 1; i++) {
      const a = this.pts[i - 1], q = this.pts[i], b = this.pts[i + 1], k = Math.min(0.45, 14 * dt);
      q.x += ((a.x + b.x) / 2 - q.x) * k; q.z += ((a.z + b.z) / 2 - q.z) * k; q.y += ((a.y + b.y) / 2 - q.y) * k * 0.5;
    }
    if (from) {
      this.acc += dt;
      if (!this.pts.length || this.acc > 0.03) { this.acc = 0; this.pts.unshift({ x: from.x, y: from.y, z: from.z, age: 0, s: this.T }); if (this.pts.length > this.n) this.pts.pop(); }
      else { const q = this.pts[0]; q.x = from.x; q.y = from.y; q.z = from.z; q.age = 0; }   // the line's foot stays on the ember
    }
    const m = this.pts.length; this.mesh.visible = m > 2;
    if (m < 3) return;
    for (let i = 0; i < this.n; i++) {
      const j = Math.min(i, m - 1), q = this.pts[j];
      this.at(j, this._c);
      this.at(Math.min(j + 1, m - 1), this._p); this._tan.copy(this._p); this.at(Math.max(j - 1, 0), this._p); this._tan.sub(this._p);
      this._side.copy(this._c).sub(camPos).cross(this._tan); const l = this._side.length(); if (l > 1e-6) this._side.multiplyScalar(1 / l); else this._side.set(1, 0, 0);
      const k = q.age / this.life, w = 0.0009 + 0.02 * Math.pow(k, 1.15);
      this.pos.set([this._c.x - this._side.x * w, this._c.y - this._side.y * w, this._c.z - this._side.z * w, this._c.x + this._side.x * w, this._c.y + this._side.y * w, this._c.z + this._side.z * w], i * 6);
      this.aT[i * 2] = this.aT[i * 2 + 1] = i < m ? k : 1;
    }
    const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.aT.needsUpdate = true;
  }
}

export class Hands {
  // world: the game's own scene (the breathed-out smoke hangs in the air there, not on the lens)
  constructor(world, camera) {
    this.world = world; this.camera = camera;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(VIEW_FOV, camera.aspect, 0.01, 6);
    this.setSize(camera.aspect);
    // a key light of the viewmodel's own, from above and over the left shoulder, that throws shadows: finger on
    // palm, the thing held on the hand. It is what gives a first-person hand its shape whatever the weather is.
    this.key = new THREE.DirectionalLight(0xffffff, 1); this.key.position.set(-0.55, 1.25, 0.75); this.key.target.position.set(0.05, -0.2, -0.45);
    this.key.castShadow = true; this.key.shadow.mapSize.set(1024, 1024); this.key.shadow.bias = -0.0006; this.key.shadow.normalBias = 0.006;
    { const c = this.key.shadow.camera; c.left = -0.75; c.right = 0.75; c.top = 0.75; c.bottom = -0.75; c.near = 0.2; c.far = 3.5; c.updateProjectionMatrix(); }
    this.scene.add(this.key); this.scene.add(this.key.target);
    this.rim = new THREE.DirectionalLight(0xffffff, 0.3); this.rim.position.set(0.5, 0.5, -1); this.scene.add(this.rim);   // the sky behind, on their edges
    this.rig = new THREE.Group(); this.scene.add(this.rig);
    this.trail = new THREE.Vector2(); this.lastStride = 0; this.push = 0;
    this.knife = new Razor(); this._qz = new THREE.Quaternion(); this._z = new THREE.Vector3(0, 0, 1);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1); this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.lamp = new THREE.PointLight(0xfff0d2, 0, 1.2, 1.5); this.lamp.position.set(0.06, 0.0, -0.18); this.scene.add(this.lamp);   // the torch's spill on the hand that holds it
    this.glow = new THREE.PointLight(0xff7a30, 0, 0.5, 2); this.scene.add(this.glow);                                              // the ember
    this.screenGlow = new THREE.PointLight(0x9fe8ff, 0, 0.6, 2); this.scene.add(this.screenGlow);
    this.ready = false; this.visible = false;
    this.right = null; this.left = null;         // what each hand holds: null | 'torch' | 'cig' | 'device'
    this.deviceUp = false;
    this.cig = { phase: 'rest', t: 0, next: 5, drags: 0, burn: 0, ash: 0.002 };
    this.onSound = null;                         // (name) => a hand sound: 'lid' 'lidShut' 'draw' 'firstDraw' 'exhale' 'ash'
    this.onStub = null;                          // () => the cigarette is finished
    this.amount = { Right: 0, Left: 0 };         // 0 down and away, 1 up
    this.lastYaw = 0; this.lastPitch = 0; this.lag = new THREE.Vector2();
    this.tex = puffTexture();
    this.wisp = new Wisp(world);
    this.sparks = new Smoke(this.scene, 16, this.tex); this.sparks.mat.uniforms.uOpacity.value = 1; this.sparks.mat.uniforms.uColor.value.setRGB(1.6, 0.7, 0.18);
    this.breath = new Smoke(world, 140, this.tex); this.breath.mat.uniforms.uOpacity.value = 0.1;
    this.props = {};
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this._add = new THREE.Vector3();
    this.load();
  }

  async load() {
    const loader = new GLTFLoader(), get = f => new Promise((res, rej) => loader.load('models/hands/' + f + '.glb', res, undefined, rej));
    let arms, torch, cigarette, pack, lighter, razor;
    try { [arms, torch, cigarette, pack, lighter, razor] = await Promise.all(['arms_fp', 'torch', 'cigarette', 'pack', 'lighter', 'razor'].map(get)); }
    catch (e) { console.warn('the hands did not load', e); return; }
    const model = arms.scene;
    // mark every surface of the hands in the picture's alpha, so the camera pass keeps them in focus
    const mark = o => o.traverse(m => {
      if (!m.isMesh) return;
      m.frustumCulled = false; m.material = m.material.clone(); m.castShadow = true; m.receiveShadow = true;
      m.material.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.a = 0.0;'); };
      m.material.customProgramCacheKey = () => 'held';
    });
    mark(model);
    // his size, and turned to face the way the camera looks; his shoulders a little below and behind the eye
    const bone = n => { let b = null; model.traverse(o => { if (!b && o.isBone && o.name.replace(/^mixamorig:?/, '') === n) b = o; }); return b; };
    const P = o => o.getWorldPosition(new THREE.Vector3());
    const inner = new THREE.Group(); inner.add(model); this.rig.add(inner);
    // gloves and cloth are matt: Meshy's own gloss map makes them read as wet rubber, so the surface keeps its
    // colour and its relief (the normal map) and takes one plain roughness
    model.traverse(m => { if (m.isMesh && m.material) { m.material.metalnessMap = null; m.material.roughnessMap = null; m.material.metalness = 0; m.material.roughness = 0.78; if (m.material.normalScale) m.material.normalScale.set(1.3, 1.3); m.material.needsUpdate = true; } });
    model.updateMatrixWorld(true);
    // (build/fp_arm.py writes the arms in metres, a grown hand's size, facing the way the camera looks)
    const s = 1;
    inner.scale.setScalar(s * VM);
    inner.updateMatrixWorld(true);
    inner.updateMatrixWorld(true);
    const mid = P(bone('LeftArm')).add(P(bone('RightArm'))).multiplyScalar(0.5);
    inner.position.set(SHOULDERS[0] - mid.x, SHOULDERS[1] - mid.y, SHOULDERS[2] - mid.z);
    inner.updateMatrixWorld(true);
    this.arms = { Right: new Arm(model, 'Right', VM), Left: new Arm(model, 'Left', VM) };

    // the things, each brought to its true size (Meshy's come about two units long)
    const size = (g, len, axis, held = true) => { const o = g.scene; const box = new THREE.Box3().setFromObject(o); const c = box.getCenter(new THREE.Vector3()), d = box.getSize(new THREE.Vector3()); o.position.sub(c); const w = new THREE.Group(); w.add(o); w.scale.setScalar(len / d[axis]); const out = new THREE.Group(); out.add(w); if (held) mark(out); return out; };
    const P_ = this.props;
    // a French Army anglehead torch (Meshy, from the surplus shop's photograph: build/meshy_torch.mjs), at a size his
    // small hands can close round. Which way its lens faces is read off the shape (the head overhangs that side)
    // and it is turned so that is its +x
    { let sx = 0; torch.scene.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(torch.scene), v = new THREE.Vector3();
      torch.scene.traverse(m => { if (!m.isMesh) return; const q = m.geometry.attributes.position; for (let i = 0; i < q.count; i++) { v.fromBufferAttribute(q, i).applyMatrix4(m.matrixWorld); if (v.y > bb.min.y + (bb.max.y - bb.min.y) * 0.72) sx += v.x - (bb.min.x + bb.max.x) / 2; } });
      P_.torch = size(torch, 0.2, 'y'); if (sx < 0) P_.torch.children[0].rotation.y = Math.PI;
      // army olive, and never quite lost in the dark: Meshy's came out near black
      P_.torch.traverse(m => { if (m.isMesh && m.material.emissive) { m.material.color.setRGB(1.5, 1.6, 1.2); m.material.emissive.setHex(0x161c0e); m.material.emissiveIntensity = 1; } }); }
    this.lens = new THREE.Mesh(new THREE.CircleGeometry(0.0105, 20), new THREE.MeshBasicMaterial({ color: 0xfff1cf }));
    this.lens.rotation.y = Math.PI / 2; this.lens.position.set(0.0296, 0.044, 0); P_.torch.add(this.lens); mark(this.lens);
    // the handheld is the MQ-01 off the site's front page (mq01.js), not a Meshy model
    const mq = buildMQ01(); P_.device = mq.group; this.screen = mq.screen; mark(P_.device);
    repaint(cigarette.scene, cigTexture(), cigUV, 0.85);
    P_.cig = size(cigarette, 0.084, 'x'); P_.cig.children[0].scale.multiply(new THREE.Vector3(1, 0.75, 0.75));   // a real cigarette's slimness: 84 mm by 8
    // it burns: the paper past the ember is not drawn, and the ember and its ash sit where the burning has got to
    this.burn = { value: 0.039 };
    const cb = new THREE.Box3().setFromObject(cigarette.scene), along = { value: new THREE.Vector2(cb.getCenter(new THREE.Vector3()).x, 0.084 / (cb.max.x - cb.min.x)) };
    P_.cig.traverse(m => {
      if (!m.isMesh) return;
      m.material.onBeforeCompile = sh => {
        sh.uniforms.uBurn = this.burn; sh.uniforms.uAlong = along;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vAlong; uniform vec2 uAlong;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vAlong = (position.x - uAlong.x) * uAlong.y;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAlong; uniform float uBurn;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (vAlong > uBurn) discard;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.a = 0.0;');
      };
      m.material.customProgramCacheKey = () => 'held-cig';
    });
    repaint(pack.scene, packTexture(), packUV, 0.55);
    this.pack = size(pack, 0.086, 'y', false);          // lies in the maze until it is found (whimsy.js)
    this.pack.children[0].scale.multiply(new THREE.Vector3(1.5, 1, 0.82));   // Meshy's is too narrow for a pack of twenty
    // the ember, and the ash beyond it
    this.tip = new THREE.Group(); P_.cig.add(this.tip);
    this.ember = new THREE.Mesh(new THREE.CylinderGeometry(0.0041, 0.0041, 0.0024, 12), new THREE.MeshBasicMaterial({ color: 0xff5a1e }));
    this.ember.rotation.z = Math.PI / 2; this.tip.add(this.ember);
    const ashGeo = new THREE.CylinderGeometry(0.0033, 0.004, 0.006, 9, 3);
    { const q = ashGeo.attributes.position; for (let i = 0; i < q.count; i++) q.setXYZ(i, q.getX(i) * (0.82 + Math.random() * 0.3), q.getY(i), q.getZ(i) * (0.82 + Math.random() * 0.3)); ashGeo.computeVertexNormals(); }
    this.ash = new THREE.Mesh(ashGeo, new THREE.MeshStandardMaterial({ color: 0x8d8a86, roughness: 1 }));
    this.ash.rotation.z = -Math.PI / 2; this.ash.position.x = 0.004; this.tip.add(this.ash);
    mark(this.tip);
    // the ember's bloom: a soft orange glow that swells when he draws
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0xff7a2a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
    this.halo.scale.setScalar(0.012); this.tip.add(this.halo);
    // the ash that drops when he taps it off
    this.ashBit = new THREE.Mesh(ashGeo, this.ash.material); this.ashBit.visible = false; this.ashVel = new THREE.Vector3(); this.scene.add(this.ashBit); mark(this.ashBit);
    // the lighter (Meshy): a flip-top, its lid open. One lies beside the pack in the maze; one is his, in the hand,
    // with a flame that is there only while he is lighting up
    P_.lighter = size(lighter, 0.07, 'y', false);   // lid and all; the case itself is about 4.5 cm
    this.lighterWorld = P_.lighter.clone(true);
    mark(P_.lighter);
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flame.center.set(0.5, 0.06); this.flame.position.set(-0.002, 0.016, 0); this.flame.visible = false; P_.lighter.add(this.flame);
    this.flameLight = new THREE.PointLight(0xffb45a, 0, 0.7, 1.6); this.scene.add(this.flameLight);
    // the razor (Meshy, split at its pin by build/fp_razor.py): already its true size, the pin at its centre, the
    // handle along +x, the blade open along -x and folding about z
    mark(razor.scene);
    razor.scene.traverse(m => { if (m.isMesh) { m.material.metalness = Math.min(m.material.metalness, 0.55); m.material.envMapIntensity = 1.1; } });
    razor.scene.scale.setScalar(1.2); razor.scene.position.x = -0.072;   // the handle's middle at the centre                         // (a barber's razor is a small thing; a little over life size reads better in the hand)
    P_.razor = new THREE.Group(); P_.razor.add(razor.scene);
    this.blade = razor.scene.getObjectByName('blade');
    for (const k in P_) P_[k].visible = false;
    this.ready = true;
    this.attach();
  }

  setScreen(texture) { this.screenTex = texture; if (this.screen) { this.screen.material.map = texture; this.screen.material.needsUpdate = true; } }

  // which hand holds what: the torch in the right; the handheld in the left; a cigarette in whichever is free
  attach() {
    if (!this.ready) return;
    if (this.screenTex && !this.screen.material.map) this.setScreen(this.screenTex);
    const A = this.arms, P_ = this.props;
    for (const k in P_) { P_[k].visible = false; P_[k].removeFromParent(); }
    for (const side of ['Right', 'Left']) {
      const what = this.shown(side), arm = A[side];
      if (what) { const h = HOLD[what], at = h.gap ? [arm.gap.x + h.at[0], arm.gap.y + h.at[1], arm.gap.z * arm.sg + h.at[2]] : h.at; arm.hold(P_[what], at, h.x, h.y); }
      if (what) P_[what === 'cig' ? 'cig' : what].visible = true;
    }
    this.razorBase = P_.razor && P_.razor.parent ? P_.razor.quaternion.clone() : null;
    // the grip on each thing held, found on the thing itself (Arm.grasp), once for each hand and thing
    this.grips = this.grips || {}; this.grip = { Right: null, Left: null };
    for (const side of ['Right', 'Left']) {
      const what = this.shown(side), h = what && HOLD[what]; if (!h) continue;
      if (h.fixed) { this.grip[side] = h.fixed; continue; }
      if (!h.grasp) continue;
      const key = side + what;
      if (!this.grips[key]) {
        if (what === 'razor' && this.blade) this.blade.rotation.z = 0;
        this.scene.updateMatrixWorld(true);
        const pts = [], v = new THREE.Vector3();
        P_[what].traverse(m => {
          if (!m.isMesh || (typeof h.grasp === 'string' && m.name !== h.grasp && !(m.parent && m.parent.name === h.grasp))) return;
          const q = m.geometry.attributes.position, step = Math.max(1, Math.floor(q.count / 6000));
          for (let i = 0; i < q.count; i += step) { v.fromBufferAttribute(q, i).applyMatrix4(m.matrixWorld); pts.push(v.x, v.y, v.z); }
        });
        this.grips[key] = pts.length ? A[side].grasp(new Float32Array(pts)) : null;
      }
      this.grip[side] = this.grips[key];
    }
  }
  holding(what) { return this.right === what || this.left === what; }
  // what a hand shows: what it holds, or for a moment the lighter, while the other hand's cigarette is lit
  shown(side) { const L = this.lightUp; return L && L.swap && L.side === side ? 'lighter' : side === 'Right' ? this.right : this.left; }
  // take a thing out or put it away; false when there is no hand for it
  set(what, on) {
    if (what === 'razor') {
      // the razor is the right hand's; putting it away takes a moment (update() lets go of it when the move is done)
      if (on) { if (this.right === 'cig' && !this.left) this.left = 'cig'; else if (this.right === 'cig') this.stub(true); this.right = 'razor'; }
      this.knife.set(on);
    }
    else if (what === 'torch') { if (on && this.right === 'cig' && !this.left) this.left = 'cig'; else if (on && this.right === 'cig') this.stub(true); this.right = on ? 'torch' : this.right === 'torch' ? null : this.right; }
    else if (what === 'device') { if (on && this.left === 'cig' && !this.right) this.right = 'cig'; else if (on && this.left === 'cig') this.stub(true); this.left = on ? 'device' : this.left === 'device' ? null : this.left; if (!on) this.deviceUp = false; }
    else if (what === 'cig') {
      if (!on) { if (this.right === 'cig') this.right = null; if (this.left === 'cig') this.left = null; this.lightUp = null; }
      else if (!this.holding('cig')) { if (!this.right) this.right = 'cig'; else if (!this.left) this.left = 'cig'; else return false; this.cig = { phase: 'light', t: 0, next: 5, drags: 0, burn: 0, ash: 0.002, lit: 0 }; if (this.burn) this.burn.value = 0.039;
        // every cigarette starts unlit: the other hand finds the lighter (putting down what it had, for the moment)
        const other = this.right === 'cig' ? 'Left' : 'Right';
        this.lightUp = { t: 0, side: other, had: !!(other === 'Right' ? this.right : this.left), swap: false }; }
    }
    this.attach();
    return true;
  }
  stub(silent) { this.set('cig', false); if (!silent && this.onStub) this.onStub(); }

  // a phone held upright has a narrow picture: the hands' own view opens up there, so a hand is not half the screen
  // wide and does not sit under the left thumb
  setSize(aspect) {
    this.cam.aspect = aspect;
    this.wide = aspect < 1 ? Math.min(1.5, 1 / Math.sqrt(aspect)) : 1;
    this.cam.fov = 2 * Math.atan(Math.tan(VIEW_FOV * Math.PI / 360) * this.wide) * 180 / Math.PI;
    this.cam.updateProjectionMatrix();
  }

  // the light on the hands is the light of the place: the sky's fill, the sun from where it stands, the torch's spill
  light(hemi, sun, night, torchLevel) {
    this.hemi.color.copy(hemi.color); this.hemi.groundColor.copy(hemi.groundColor); this.hemi.intensity = hemi.intensity * LIGHT.fill;
    this.sun.color.copy(sun.color); this.sun.intensity = sun.intensity * LIGHT.sun;
    // the key takes its strength and colour from the place: the sky's, warmed by whatever sun there is
    this.key.color.copy(hemi.color).lerp(sun.color, 0.4); this.key.intensity = hemi.intensity * LIGHT.key + sun.intensity * LIGHT.keySun;
    this.rim.color.copy(hemi.color); this.rim.intensity = hemi.intensity * LIGHT.rim;
    this._v.copy(sun.position).sub(sun.target.position).normalize().transformDirection(this.camera.matrixWorldInverse);
    this.sun.position.copy(this._v); this.sun.target.position.set(0, 0, 0);
    this.lamp.intensity = 0.1 * torchLevel;
    if (this.lens) { this.lens.material.color.setRGB(0.12 + 2.2 * torchLevel, 0.12 + 2.0 * torchLevel, 0.1 + 1.6 * torchLevel); }
  }

  // the torch in his hand, in the world: where its lens is and which way it faces. Returns how far it is up (0..1).
  // The hands are drawn with a narrower lens than the world is, so the place is moved out to where the world's
  // camera sees the lens at the same spot on the screen: the beam then leaves the torch you see.
  torchRay(pos, dir) {
    if (!this.ready || this.shown('Right') !== 'torch' || !this.lens) return 0;
    this.scene.updateMatrixWorld(true);
    this.lens.getWorldPosition(pos);
    const k = Math.tan(this.camera.fov * Math.PI / 360) / Math.tan(this.cam.fov * Math.PI / 360);
    pos.x *= k; pos.y *= k;
    dir.set(1, 0, 0).transformDirection(this.props.torch.matrixWorld);
    pos.applyMatrix4(this.camera.matrixWorld); dir.transformDirection(this.camera.matrixWorld);
    return this.amount.Right;
  }

  // one frame. show: are the hands to be seen at all (walking about, not lying down or in a menu)
  update(dt, player, show, fogColor, ambient) {
    if (!this.ready) return;
    const A = this.arms, xs = Math.max(0.42, Math.min(1, this.cam.aspect * this.wide / 1.55));
    // the head's turning, for the lag; the walk, for the bob
    let dy = player.yaw - this.lastYaw; const dp = player.pitch - this.lastPitch; this.lastYaw = player.yaw; this.lastPitch = player.pitch;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const ph = (player.stepPhase || 0) * Math.PI * 2, st = player.stride || 0, tm = performance.now() / 1000;
    // The viewmodel moves as ONE piece, as Source's does (CalcViewModelLag, AddViewModelBob):
    //  - it trails the view: how far the head has turned ahead of it is kept, and caught up at 5 a second (faster
    //    the further behind it is), and it is turned and shifted back by that much;
    //  - looking down brings it in toward the eye and up, looking up lets it drop away (Source: 0.035, 0.03 and 0.02
    //    of an inch a degree);
    //  - the walk lowers it, swings it side to side once a stride and up and down once a step, and rolls it a little;
    //  - starting and stopping push it back and forward; breathing lifts it, about fifteen breaths a minute.
    if (dt > 0) {
      const M = MOTION, tr = this.trail;
      tr.x += dy; tr.y += dp;
      const far = Math.hypot(tr.x, tr.y), fol = 1 - Math.exp(-dt * M.follow * (1 + far * 3));
      tr.x -= tr.x * fol; tr.y -= tr.y * fol;
      tr.x = Math.max(-M.max, Math.min(M.max, tr.x)); tr.y = Math.max(-M.max, Math.min(M.max, tr.y));
      const still = this.deviceUp && this.holding('device') ? 0.22 : 1;                // held up to be read, it is held still
      const dst = (st - this.lastStride) / dt; this.lastStride = st;
      this.push += (Math.max(-1, Math.min(1, dst * 0.25)) - this.push) * (1 - Math.exp(-dt * 6));
      const pd = -(player.pitch || 0) * 180 / Math.PI, inch = 0.0254 * M.pitch;       // degrees looked down
      const br = Math.sin(tm * 1.57), g = this.rig;
      g.position.set(
        (tr.x * M.shift + Math.sin(ph) * M.side * st - pd * 0.03 * inch) * still,
        (-tr.y * M.shift + Math.sin(ph * 2 + 0.5) * M.up * st - M.lower * st + pd * 0.02 * inch + br * M.breath) * still,
        (M.back * st + this.push * M.shove + pd * 0.035 * inch) * still);
      g.rotation.set(
        (-tr.y * M.turn + Math.sin(tm * 1.57 + 0.9) * M.breath * 1.6 - this.push * 0.012) * still,
        (-tr.x * M.turn) * still,
        (tr.x * M.roll + Math.sin(ph) * M.tilt * st) * still);
    }
    this.visible = false;
    const knifePose = this.knife.update(dt);
    if (this.right === 'razor' && !this.knife.out && this.knife.state === 'away') { this.right = null; this.attach(); }
    let cigPose = POSES.cig, drawing = 0;
    if (this.holding('cig') && dt > 0) drawing = this.smoke(dt, player);
    if (this.cig.phase === 'up' || this.cig.phase === 'draw') cigPose = POSES.cigMouth;
    const smoking = this.holding('cig');
    // Lighting up: the free hand goes down for the lighter (putting away what it held), comes up with it in front of
    // the mouth as the cigarette comes up too; the wheel is struck, sparks, the flame stands; he draws and the end
    // catches; the flame goes out, the lighter goes back, the hand takes up what it had; the first smoke is breathed out
    const L = this.lightUp;
    if (L && smoking && dt > 0) {
      L.t += dt;
      const t0 = L.had ? 0.45 : 0;                       // the hand had something to put down first
      if (!L.swap && !L.done && L.t >= t0) { L.swap = true; this.attach(); }
      const T = L.t - t0;                                // the lighter is in the hand from T = 0
      if (T > 0.3 && T < 2.5) cigPose = POSES.cigMouth;
      const lit = T > 1.05 && T < 2.2;
      if (T > 0.6 && !L.opened) { L.opened = true; if (this.onSound) this.onSound('lid'); }
      if (T > 0.95 && T < 1.08 && !L.struck) { L.struck = true; if (this.onStrike) this.onStrike(); }
      if (T > 1.4 && !L.drew) { L.drew = true; if (this.onSound) this.onSound('firstDraw'); }
      if (T > 2.25 && !L.shut) { L.shut = true; if (this.onSound) this.onSound('lidShut'); }
      if (T > 0.95 && T < 1.12) { this.flame.getWorldPosition(this._v); this.sparks.emit(this._v, this._w.set((Math.random() - 0.5) * 0.15, 0.03 + Math.random() * 0.1, (Math.random() - 0.5) * 0.1), 0.25 + Math.random() * 0.25, 0.0016); }
      this.flame.visible = lit;
      if (lit) { const fl = 0.85 + 0.15 * Math.sin(tm * 31) * Math.sin(tm * 13); this.flame.scale.set(0.011 * (0.9 + 0.1 * fl), 0.03 * fl * Math.min(1, (T - 1.05) / 0.08), 1); this.flame.getWorldPosition(this.flameLight.position); this.flameLight.position.y += 0.012; }
      this.flameLight.intensity = lit ? 0.04 * (0.85 + 0.15 * Math.sin(tm * 29)) : 0;
      this.cig.lit = Math.max(this.cig.lit || 0, Math.min(1, (T - 1.45) / 0.5));       // the end catching
      drawing = Math.max(0, Math.sin(Math.min(1, Math.max(0, (T - 1.4) / 0.9)) * Math.PI)) * 0.9;
      if (L.swap && T > 2.75) { L.swap = false; L.done = true; this.attach(); }
      if (T > (L.had ? 3.0 : 2.9)) { this.lightUp = null; this.cig.lit = 1; this.cig.phase = 'out'; this.cig.t = 0; if (this.onSound) this.onSound('exhale'); }
    } else if (!L) { if (this.flame) this.flame.visible = false; if (this.flameLight) this.flameLight.intensity = 0; if (smoking && this.cig.lit === undefined) this.cig.lit = 1; }
    for (const side of ['Right', 'Left']) {
      const arm = A[side], what = this.shown(side);
      const want = show && what ? 1 : 0;
      this.amount[side] += (want - this.amount[side]) * (1 - Math.exp(-dt * (want ? 7 : 9)));
      const am = this.amount[side];
      if (am > 0.01) this.visible = true;
      let pose = what === 'razor' ? knifePose : what === 'torch' ? POSES.torch : what === 'cig' ? cigPose : what === 'device' ? (this.deviceUp ? POSES.deviceUp : POSES.device) : what === 'lighter' ? POSES.lighter : POSES.down;
      let steer = false;
      if (L && L.side === side) { const T = L.t - (L.had ? 0.45 : 0); if (T < 0 || T > 2.35) pose = POSES.down; else steer = T > 0.35; }   // down for the lighter, and down again to put it back
      const tgt = arm.target(pose, xs);
      // the fingers are where the thing itself put them; a pose may ease them (a flip) by its own first curl
      { const gr = this.grip && this.grip[side]; if (gr && what !== 'cig') { tgt.joints = gr.joints; tgt.thumb = gr.thumb; if (what === 'razor') tgt.loose = [pose.curl[2] / 1.3, pose.curl[3] / 1.34, pose.curl[4] / 1.36, pose.curl[5] / 1.36].map(x => Math.min(1, x)); } }
      // on an upright phone the picture is narrow: the handheld is held far enough off that its whole width is in it
      if (what === 'device' && this.deviceUp && this.cam.aspect < 1) { const need = 0.074 / (Math.tan(this.cam.fov * Math.PI / 360) * this.cam.aspect * 0.88); if (-tgt.pos.z < need) { const k = need / -tgt.pos.z; tgt.pos.multiplyScalar(k); } }
      if (what === 'device' && this.deviceUp && this.cam.aspect < 1) tgt.pos.y += 0.075 * (1 - this.cam.aspect);   // a phone held upright: the handheld a little higher, its screen in the middle of the tall picture
      // and at rest it is held nearer by as much as the view opened up, so its screen stays big enough to read
      if (what === 'device' && !this.deviceUp && this.wide > 1) { tgt.pos.multiplyScalar(1 / this.wide); tgt.pos.y += 0.05; }
      // a phone's buttons stand in a column up the right edge: the handheld is held clear of them
      if (what === 'device' && this.rightInset) tgt.pos.x -= this.rightInset * -tgt.pos.z * Math.tan(this.cam.fov * Math.PI / 360) * this.cam.aspect;
      // coming up from below and going back down
      if (am < 0.999 && what !== 'razor') { const d = arm.target(POSES.down, xs); tgt.pos.lerp(d.pos, 1 - ease(am)); tgt.quat.slerp(d.quat, 1 - ease(am)); }
      const still = what === 'device' && this.deviceUp ? 0.25 : 1, sg = arm.sg;
      this._add.set(
        // (each hand has only its own small unsteadiness; the walk and the turn move the whole viewmodel, above)
        Math.sin(tm * 0.9 + sg) * 0.0016 * still + Math.sin(ph + (sg > 0 ? 0 : 1.2)) * 0.0015 * st * still,
        Math.sin(tm * 1.3 + sg * 2) * 0.002 * still - (1 - Math.min(1, am * 1.2)) * 0.03,
        Math.sin(tm * 0.7 + sg * 3) * 0.0012 * still);
      if (what === 'cig' && this.cig.phase === 'tap' && this.cig.t < 0.44) this._add.y -= 0.011 * Math.max(0, Math.sin(this.cig.t / 0.22 * Math.PI * 2));
      // the flame is brought to the cigarette's end, wherever the other hand has it: the lighter hand is nudged each
      // frame by how far its flame still is from just under that end
      if (steer) { L.fix = L.fix || new THREE.Vector3(); tgt.pos.add(L.fix); }
      arm.update(tgt, 1 - Math.exp(-dt * (what === 'razor' ? 60 : what === 'cig' ? (this.cig.phase === 'tap' ? 22 : 5) : 9)), this._add);
      // the razor's blade on its pin, and the razor turned in the fingers
      if (what === 'razor' && this.blade && this.razorBase) {
        this.blade.rotation.z = (180 - this.knife.blade) * Math.PI / 180;
        this.props.razor.quaternion.copy(this.razorBase).multiply(this._qz.setFromAxisAngle(this._z, this.knife.spin * Math.PI / 180));
      }
      if (steer && dt > 0) { this.scene.updateMatrixWorld(true); this.tip.getWorldPosition(this._v); this.flame.getWorldPosition(this._w); L.fix.addScaledVector(this._v.sub(this._w).add(new THREE.Vector3(0, -0.014 * VM, -0.004 * VM)), 0.2); L.fix.clampLength(0, 0.12 * VM); }
    }
    // the ember and its ash, the way a drawn cigarette burns: the ember a dull red point that breathes and flickers,
    // flaring to bright orange with a bloom round it on the draw; the paper burning back all the while, faster on the
    // draw; the ash growing grey and long behind the ember until it is tapped off or falls of itself
    if (this.ember) {
      const c = this.cig;
      this.burn.value += (0.039 - 0.042 * Math.min(1, c.burn || 0) - this.burn.value) * Math.min(1, dt * 6); this.tip.position.x = this.burn.value;
      const al = c.ash || 0.002;
      this.ash.scale.y = Math.max(0.2, al / 0.006); this.ash.position.x = 0.0012 + al / 2; this.ash.rotation.z = -Math.PI / 2 - Math.min(0.3, al * 16);
      const flick = Math.sin(tm * 9.1) * Math.sin(tm * 3.7) * 0.5 + Math.sin(tm * 23) * 0.2;
      const litK = smoking ? (c.lit ?? 1) : 0;
      const e = (0.32 + 0.12 * flick + 2.4 * drawing) * litK;
      this.ember.material.color.setRGB(1.0 * (0.5 + e), 0.3 * (0.2 + e), 0.08 * e);
      this.halo.visible = litK > 0.02; this.ember.visible = litK > 0.02; this.ash.visible = litK > 0.5; this.halo.scale.setScalar(0.011 + 0.006 * flick + 0.03 * drawing); this.halo.material.opacity = 0.35 + 0.5 * Math.min(1, drawing * 1.4);
      this.ember.updateWorldMatrix(true, false); this.ember.getWorldPosition(this.glow.position);
      this.glow.intensity = (0.012 + 0.1 * drawing) * litK;
      this.screenGlow.intensity = this.left === 'device' ? 0.02 : 0;
      if (this.left === 'device') this.props.device.getWorldPosition(this.screenGlow.position).add(this._v.set(0, 0.02, 0.06));
      // the tapped-off ash, falling: slowly, turning, as a flake does
      if (this.ashBit.visible) {
        this.ashFall += dt; this.ashVel.y -= 1.6 * dt; this.ashVel.x += Math.sin(this.ashFall * 11) * 0.25 * dt;
        this.ashBit.position.addScaledVector(this.ashVel, dt); this.ashBit.rotation.x += dt * 5; this.ashBit.rotation.z += dt * 3.1;
        if (this.ashFall > 1.4) this.ashBit.visible = false;
      }
      // the line of smoke, from the ember's place in the world (not while he draws on it: then it goes the other way)
      let from = null;
      if (smoking && litK >= 1 && c.phase !== 'draw' && this.amount.Right + this.amount.Left > 0.85) { this.ember.getWorldPosition(this._w); from = this.worldOf(this._w); }
      if (dt > 0) this.wisp.update(dt, from, this.camera.position);
    }
    const col = this.breath.mat.uniforms.uColor.value.copy(fogColor).lerp(this._c || (this._c = new THREE.Color(1, 1, 1)), 0.5).multiplyScalar(0.25 + 0.75 * ambient);
    this.wisp.mat.uniforms.uColor.value.copy(col).multiplyScalar(1.15);
    this.sparks.update(dt, 0.02, 1.2); this.breath.update(dt, 0.025, 0.8, 1.6);
    const hgt = this.scene.userData.h || 800; this.sparks.mat.uniforms.uScale.value = hgt * 0.9; this.breath.mat.uniforms.uScale.value = hgt * 0.75;
  }

  // a place in the hands' own picture, as a place in the world that shows at the same spot on the screen
  worldOf(v) {
    const k = Math.tan(this.camera.fov * Math.PI / 360) / Math.tan(this.cam.fov * Math.PI / 360);
    v.x *= k; v.y *= k;
    return v.applyMatrix4(this.camera.matrixWorld);
  }
  // the ash lets go: what had gathered behind the ember falls away
  dropAsh() {
    const c = this.cig; if ((c.ash || 0) < 0.004) return;
    this.ash.updateWorldMatrix(true, false); this.ash.getWorldPosition(this.ashBit.position); this.ash.getWorldQuaternion(this.ashBit.quaternion);
    this.ashBit.scale.set(1, Math.max(0.3, c.ash / 0.006), 1); this.ashBit.visible = true; this.ashFall = 0;
    this.ashVel.set((Math.random() - 0.5) * 0.05, -0.02, (Math.random() - 0.5) * 0.03);
    c.ash = 0.0015;
  }

  // The smoking itself, paced as it is drawn: a long rest with the line of smoke climbing; the hand up, unhurried;
  // the draw, the ember flaring and a spark or two lifting off it; the hand away; a held breath; the long breath
  // out, a stream that goes forward and up and billows; the ash tapped off; rest again. Returns how hard he is
  // drawing (0..1)
  smoke(dt, player) {
    const c = this.cig;
    if (c.phase === 'light') return 0;                    // being lit: update() runs that
    c.t += dt;
    let drawing = 0;
    const before = c.burn;
    c.burn += dt / 190;                                   // it smoulders away on its own
    if (c.phase === 'rest') {
      if (c.ash > 0.015) this.dropAsh();                  // left too long, the ash falls of itself
      if (c.burn >= 1) { this.stub(); return 0; }
      if (c.t > c.next) { c.phase = 'up'; c.t = 0; }
    }
    else if (c.phase === 'up' && c.t > 0.95) { c.phase = 'draw'; c.t = 0; if (this.onSound) this.onSound('draw'); }
    else if (c.phase === 'draw') {
      drawing = Math.pow(Math.sin(Math.min(1, c.t / 2.0) * Math.PI), 0.7);
      c.burn += dt / 2.0 * 0.075;
      c.sp = (c.sp || 0) + dt;
      if (c.sp > 0.28 && drawing > 0.4) {
        c.sp = 0; this.ember.getWorldPosition(this._v);
        this.sparks.emit(this._v, this._w.set((Math.random() - 0.5) * 0.08, 0.05 + Math.random() * 0.07, (Math.random() - 0.5) * 0.05), 0.5 + Math.random() * 0.4, 0.0022);
      }
      if (c.t > 2.0) { c.phase = 'away'; c.t = 0; }
    }
    else if (c.phase === 'away' && c.t > 1.0) { c.phase = 'hold'; c.t = 0; }
    else if (c.phase === 'hold' && c.t > 0.55) { c.phase = 'out'; c.t = 0; if (this.onSound) this.onSound('exhale'); }
    else if (c.phase === 'out') {
      // breathed out in one long stream, forward and a little up, into the air of the place, where it billows and hangs
      c.e = (c.e || 0) + dt;
      const k = Math.pow(Math.sin(Math.min(1, c.t / 2.8) * Math.PI), 0.6);
      if (c.e > 0.028) {
        c.e = 0;
        const cam = this.camera, f = this._v.set(0, 0, -1).applyQuaternion(cam.quaternion), u = this._w.set(0, 1, 0).applyQuaternion(cam.quaternion);
        const p = new THREE.Vector3().copy(cam.position).addScaledVector(f, 0.2).addScaledVector(u, -0.085);
        const sp = (0.3 + 1.3 * Math.random() * Math.random()) * (0.35 + 0.65 * k);   // some of it shoots ahead, most hangs back: a stream, not a ball
        const v = new THREE.Vector3().copy(f).addScaledVector(u, 0.16).multiplyScalar(sp); v.x += (Math.random() - 0.5) * 0.22; v.y += (Math.random() - 0.5) * 0.16; v.z += (Math.random() - 0.5) * 0.22;
        v.x += player.vel.x * 0.6; v.z += player.vel.z * 0.6;
        this.breath.emit(p, v, 3.4 + Math.random() * 3.0, 0.06 + 0.1 * Math.random());
      }
      if (c.t > 2.8) { c.phase = 'tap'; c.t = 0; c.tapped = false; }
    }
    else if (c.phase === 'tap') {
      if (!c.tapped && c.t > 0.1) { c.tapped = true; this.dropAsh(); if (this.onSound) this.onSound('ash'); }
      if (c.t > 0.7) { c.phase = 'rest'; c.t = 0; c.next = 6 + Math.random() * 5; c.drags++; }
    }
    c.ash += (c.burn - before) * 0.042 * 0.9;             // what burns becomes ash behind the ember
    return drawing;
  }
}
