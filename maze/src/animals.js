// The animal of the place, glimpsed: a real 3D animal (a Meshy model, rigged and given its gait by
// build/rig_quadruped.py, see README), lit, shadowed and fogged with the scene, standing far off in the open,
// never nearer than eight metres. It notices you (you come within ten metres, or hold your look on it, or it
// simply decides to go) and bolts along the corridors away from you, galloping or trotting, until it is out of
// sight, with the sound of its going. One animal a level, two sightings at most.
//
// The animal knows the way out. It only ever stands on a shortest way from where you are to the exit, and when it
// goes it runs on along that way. Where you saw it, and where it went, is the right way.
//
// The run clip is in place: its playback rate is set from the ground covered, one loop per stride, so the
// hooves keep pace with the floor. Standing, it idles side-on to you (a profile is how an animal is seen
// first), then turns as it goes.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { MeshoptDecoder } from '../lib/meshopt_decoder.module.js';

// per place: the model, its height in metres (the whole animal, ears or antlers included), how fast it goes (m/s),
// how far one loop of its run clip carries it (m), the sound of its going, and how long it stands before it goes
// of its own accord
export const ANIMALS = {
  yakushima: { model: 'sika.glb', name: 'sika deer', height: 1.3, speed: 6.5, stride: 3.2, sound: 'hooves', bark: 'deer', hold: [4, 9] },
  aokigahara: { model: 'sika.glb', name: 'sika deer', height: 1.35, speed: 6.5, stride: 3.2, sound: 'hooves', bark: 'deer', hold: [5, 10] },
  hoh: { model: 'elk.glb', name: 'bull elk', height: 2.5, speed: 6, stride: 3.8, sound: 'hooves', hold: [5, 12] },
  williamson: { model: 'fox.glb', name: 'red fox', height: 0.55, speed: 5.5, stride: 1.5, sound: 'pads', hold: [3, 7] },
  wistmans: { model: 'pony.glb', name: 'moor pony', height: 1.35, speed: 4.5, stride: 2.4, sound: 'hooves', hold: [6, 14] },
  fanal: { model: 'cow.glb', name: 'cow', height: 1.55, speed: 3.2, stride: 2.0, sound: 'hooves', heavy: true, hold: [8, 16] },
  puzzlewood: { model: 'boar.glb', name: 'wild boar', height: 0.95, speed: 5.5, stride: 1.5, sound: 'brush', hold: [3, 8] },
  congaree: { model: 'whitetail.glb', name: 'white-tailed deer', height: 1.45, speed: 7, stride: 3.4, sound: 'hooves', hold: [4, 9] },
};

const NEAR = 8;          // never shown nearer than this (metres)
const NOTICE = 10.5;     // it bolts when you come this close
const SPAWN = [11.5, 20];  // where it appears, from you
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);

export function buildAnimal(ctx) {
  const { loc, c, group, floorY, openCells, maze, open } = ctx;
  const spec = ANIMALS[loc.id]; if (!spec) return null;
  const inGrid = (gx, gz) => gx >= 0 && gz >= 0 && gx < maze.W && gz < maze.H;
  const isOpen = (gx, gz) => inGrid(gx, gz) && open(gx, gz);
  // a clear line through open tiles from a to b
  const los = (ax, az, bx, bz) => {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.25);
    for (let i = 1; i < n; i++) { const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (!isOpen(Math.floor(x / c), Math.floor(z / c))) return false; }
    return true;
  };
  // steps over open tiles from one tile to every tile it can reach
  const flood = (sx, sz) => {
    const d = new Int32Array(maze.W * maze.H).fill(-1);
    if (!isOpen(sx, sz)) return d;
    const q = [sx, sz]; d[sz * maze.W + sx] = 0;
    for (let i = 0; i < q.length; i += 2) {
      const x = q[i], z = q[i + 1], v = d[z * maze.W + x];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (!isOpen(nx, nz) || d[nz * maze.W + nx] >= 0) continue;
        d[nz * maze.W + nx] = v + 1; q.push(nx, nz);
      }
    }
    return d;
  };
  const a = {
    flood, toExit: flood(maze.exit.x, maze.exit.y), W: maze.W,
    spec, los, isOpen, c, floorY, openCells, maze, ready: false,
    phase: 'hidden', t: 0, shown: 0, next: 10 + Math.random() * 8, hold: 0, look: 0,
    pos: new THREE.Vector3(), path: [], step: 0, dir: new THREE.Vector3(), yaw: 0,
  };
  a.root = new THREE.Group(); a.root.visible = false; group.add(a.root);
  loader.load('models/animals/' + spec.model, g => {
    const model = g.scene;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { o.material.envMapIntensity = 0.5; o.material.roughness = Math.max(0.75, o.material.roughness ?? 1); } } });
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const s = spec.height / Math.max(1e-6, box.max.y - box.min.y);
    model.scale.multiplyScalar(s); model.position.y -= box.min.y * s;
    a.root.add(model);
    a.mixer = new THREE.AnimationMixer(model);
    const act = n => { const clip = g.animations.find(x => x.name === n); return clip ? a.mixer.clipAction(clip) : null; };
    a.idle = act('idle'); a.run = act('run');
    a.ready = true;
  }, undefined, e => console.warn('animal did not load', spec.model, e));
  return a;
}

// one clip at a time, faded over a fifth of a second
function play(a, action, rate = 1) {
  if (!action) return;
  action.timeScale = rate;
  if (a.current === action) return;
  action.reset().play();
  if (a.current) a.current.crossFadeTo(action, 0.2, false);
  a.current = action;
}

function turn(from, to, k) {
  let d = to - from; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, k);
}

// per frame; player has pos, yaw, camera; hooks.animalBolt(spec, pos) plays the sound; hooks.mazeTime is the time in this maze
export function updateAnimal(a, dt, player, now, hooks) {
  if (!a || !a.ready) return;
  const { spec, c } = a, pp = player.pos;
  const gone = () => { a.root.visible = false; a.phase = 'hidden'; a.next = hooks.mazeTime + 40 + Math.random() * 30; a.mixer.stopAllAction(); a.current = null; };
  if (a.phase === 'hidden') {
    if (a.shown >= 2 || hooks.mazeTime < a.next) return;
    a.next = hooks.mazeTime + 2;   // try again in a couple of seconds if nothing fits
    // a spot far off along your line of sight, in open ground, with a clear line to you, and on a shortest way from
    // you to the exit: as far from you as it is nearer the way out, step for step
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    const cands = [];
    const px = Math.floor(pp.x / c), pz = Math.floor(pp.z / c);
    if (!a.isOpen(px, pz)) return;
    const mine = a.toExit[pz * a.W + px]; if (mine < 0) return;
    const fromMe = a.flood(px, pz);
    for (const [gx, gz] of a.openCells) {
      const x = (gx + 0.5) * c, z = (gz + 0.5) * c, dx = x - pp.x, dz = z - pp.z, d = Math.hypot(dx, dz);
      if (d < SPAWN[0] || d > SPAWN[1]) continue;
      const i = gz * a.W + gx;
      if (a.toExit[i] < 0 || fromMe[i] < 0 || fromMe[i] + a.toExit[i] !== mine) continue;
      if ((dx * fx + dz * fz) / d < 0.75) continue;
      if (Math.abs(gx - a.maze.exit.x) + Math.abs(gz - a.maze.exit.y) < 3) continue;
      cands.push([gx, gz, x, z, d]);
    }
    for (let k = 0; k < cands.length && k < 24; k++) {
      const [gx, gz, x, z] = cands[Math.floor(Math.random() * cands.length)];
      if (!a.los(pp.x, pp.z, x, z)) continue;
      const ox = (Math.random() - 0.5) * c * 0.4, oz = (Math.random() - 0.5) * c * 0.4;
      a.pos.set(x + ox, a.floorY(x + ox, z + oz), z + oz);
      a.cell = [gx, gz];
      // side-on to you, either way round
      a.yaw = Math.atan2(pp.x - a.pos.x, pp.z - a.pos.z) + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      a.root.visible = true; play(a, a.idle);
      a.phase = 'standing'; a.t = 0; a.shown++; a.look = 0;
      a.hold = spec.hold[0] + Math.random() * (spec.hold[1] - spec.hold[0]);
      break;
    }
  } else if (a.phase === 'standing') {
    a.t += dt;
    const dx = a.pos.x - pp.x, dz = a.pos.z - pp.z, d = Math.hypot(dx, dz);
    // it watches you: a hard look at it from inside twelve metres is noticed within a few seconds
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    const toward = (dx * fx + dz * fz) / Math.max(0.01, d);
    a.look = toward > 0.985 && d < 12.5 ? a.look + dt : Math.max(0, a.look - dt);
    if (d < NEAR || (a.t > 1.2 && (d < NOTICE || a.look > 3 || a.t > a.hold))) bolt(a, pp, hooks);
  } else if (a.phase === 'bolting') {
    a.t += dt;
    const target = a.path[a.step];
    if (!target) { gone(); return; }
    const vx = target[0] - a.pos.x, vz = target[1] - a.pos.z, d = Math.hypot(vx, vz);
    const sp = spec.speed * Math.min(1, 0.45 + a.t * 1.8);   // the first strides are the slow ones
    const adv = sp * dt;
    if (d < adv) { a.pos.x = target[0]; a.pos.z = target[1]; a.step++; }
    else { a.dir.set(vx / d, 0, vz / d); a.pos.addScaledVector(a.dir, adv); }
    a.pos.y = a.floorY(a.pos.x, a.pos.z);
    a.yaw = turn(a.yaw, Math.atan2(a.dir.x, a.dir.z), dt * 7);
    if (a.run) play(a, a.run, sp / spec.stride * a.run.getClip().duration);
    // gone once it is out of your sight, or far enough into the fog
    if (a.t > 0.6 && (!a.los(pp.x, pp.z, a.pos.x, a.pos.z) || a.pos.distanceTo(pp) > 24)) gone();
  }
  if (a.root.visible) { a.root.position.copy(a.pos); a.root.rotation.y = a.yaw; a.mixer.update(dt); }
}

// it goes the way out: from where it stands, each step one nearer the exit, on until it is round a corner and gone
function bolt(a, pp, hooks) {
  const { c } = a;
  const cells = [];
  let cur = a.cell, v = a.toExit[cur[1] * a.W + cur[0]];
  while (v > 0 && cells.length < 60) {
    let next = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur[0] + dx, nz = cur[1] + dz;
      if (a.isOpen(nx, nz) && a.toExit[nz * a.W + nx] === v - 1) { next = [nx, nz]; break; }
    }
    if (!next) break;
    cells.push(next); cur = next; v--;
  }
  a.path = cells.map(([gx, gz]) => [(gx + 0.5) * c + (Math.random() - 0.5) * c * 0.3, (gz + 0.5) * c + (Math.random() - 0.5) * c * 0.3]);
  a.step = 0; a.t = 0;
  if (!a.path.length) { a.root.visible = false; a.phase = 'hidden'; a.next = hooks.mazeTime + 30; return; }
  a.phase = 'bolting';
  a.dir.set(a.path[0][0] - a.pos.x, 0, a.path[0][1] - a.pos.z).normalize();
  if (hooks.animalBolt) hooks.animalBolt(a.spec, a.pos);
}
