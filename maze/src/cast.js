// The cast: characters from radbro.gg (credits in README), one to a place, met in the maze. A rigged,
// lit, shadow-casting model with its own clips (cut down for the maze by build/maze_cast.mjs). It stands
// about in the open, idling; come within ten metres or so where it can see you and it greets you once
// (the Grey waves, Radcat hops), then walks off along the corridors, jogging if you are close, until it is
// round a corner and gone; a while later it is somewhere else ahead of you. Clips are in place, so the
// walk's playback rate is set from the ground covered, and the feet do not slide.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { MeshoptDecoder } from '../lib/meshopt_decoder.module.js';

// per place: the model, its height in metres, the greeting clip, walk and jog speeds (m/s), and how far one
// loop of each clip carries it (m), from the clips themselves
export const CAST = {
  williamson: { file: 'schizo-grey.glb', name: 'Schizo Grey', height: 1.55, greet: 'wave', walk: [1.2, 1.15], jog: [2.8, 1.5] },
  wistmans: { file: 'radcat.glb', name: 'Radcat', height: 1.05, greet: 'hop', walk: [1.0, 0.62], jog: [2.6, 0.95] },
};

const GREET = 10.5;   // it notices you from here, in the open
const CLOSE = 5;      // nearer than this it jogs
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);

export function buildCast(ctx) {
  const spec = CAST[ctx.loc.id]; if (!spec) return null;
  const { c, group, floorY, openCells, maze, open } = ctx;
  const isOpen = (gx, gz) => gx >= 0 && gz >= 0 && gx < maze.W && gz < maze.H && open(gx, gz);
  const los = (ax, az, bx, bz) => {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.25);
    for (let i = 1; i < n; i++) { const t = i / n; if (!isOpen(Math.floor((ax + (bx - ax) * t) / c), Math.floor((az + (bz - az) * t) / c))) return false; }
    return true;
  };
  const a = { spec, c, floorY, openCells, isOpen, los, maze, ready: false, phase: 'hidden', next: 0, pos: new THREE.Vector3(), yaw: 0, path: [], step: 0, cell: null };
  a.root = new THREE.Group(); a.root.visible = false; group.add(a.root);
  // fetched per build (the browser keeps the file): the maze disposes a place's geometry when it leaves
  loader.load('models/cast/' + spec.file, g => {
    const model = g.scene;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) o.material.envMapIntensity = 0.6; } });
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const s = spec.height / Math.max(1e-6, box.max.y - box.min.y);
    model.scale.multiplyScalar(s); model.position.y -= box.min.y * s;
    a.root.add(model);
    a.mixer = new THREE.AnimationMixer(model);
    const act = n => { const clip = g.animations.find(x => x.name === n); return clip ? a.mixer.clipAction(clip) : null; };
    a.idle = act('idle'); a.walk = act('walk'); a.jog = act('jog'); a.greet = act(spec.greet);
    if (a.greet) { a.greet.setLoop(THREE.LoopOnce, 1); a.greet.clampWhenFinished = true; }
    a.mixer.addEventListener('finished', e => { if (e.action === a.greet && a.phase === 'greeting') a.phase = 'leaving-start'; });
    a.ready = true;
  }, undefined, e => console.warn('cast did not load', spec.file, e));
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

// a place to stand: open, 12-24 m from you, not where you can already see it (it is found, not spawned in view)
function place(a, pp, first) {
  const { c } = a, cands = [];
  for (const [gx, gz] of a.openCells) {
    const x = (gx + 0.5) * c, z = (gz + 0.5) * c, d = Math.hypot(x - pp.x, z - pp.z);
    if (d < (first ? 10 : 12) || d > 24) continue;
    if (Math.abs(gx - a.maze.exit.x) + Math.abs(gz - a.maze.exit.y) < 3) continue;
    if (!first && a.los(pp.x, pp.z, x, z)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => a.isOpen(gx + dx, gz + dz)).length < 2) continue;   // never a dead end: it must have a way on
    cands.push([gx, gz, x, z]);
  }
  if (!cands.length) return false;
  const [gx, gz, x, z] = cands[Math.floor(Math.random() * cands.length)];
  a.cell = [gx, gz]; a.pos.set(x, a.floorY(x, z), z);
  // facing down its longest open line, as if on its way somewhere
  let best = 0, bestLen = -1;
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz], i) => { let n = 0; while (n < 6 && a.isOpen(gx + dx * (n + 1), gz + dz * (n + 1))) n++; if (n > bestLen) { bestLen = n; best = i; } });
  a.yaw = [Math.PI / 2, -Math.PI / 2, 0, Math.PI][best];
  a.phase = 'idling'; a.greeted = false; a.root.visible = true; play(a, a.idle);
  return true;
}

// away along the open tiles, each step further from you where it can, until it is round a corner
function leave(a, pp) {
  const { c } = a, key = (x, z) => x + ',' + z;
  const cell = [Math.floor(a.pos.x / c), Math.floor(a.pos.z / c)];
  const dist = (gx, gz) => Math.hypot((gx + 0.5) * c - pp.x, (gz + 0.5) * c - pp.z);
  const from = new Map([[key(...cell), { prev: null, depth: 0 }]]), queue = [cell];
  let best = null, bestScore = -Infinity;
  while (queue.length) {
    const cur = queue.shift(), depth = from.get(key(...cur)).depth, d = dist(...cur);
    if (depth >= 3) { const score = d + (a.los(pp.x, pp.z, (cur[0] + 0.5) * c, (cur[1] + 0.5) * c) ? 0 : 8) - depth * 0.25; if (score > bestScore) { bestScore = score; best = cur; } }
    if (depth >= 12) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur[0] + dx, nz = cur[1] + dz, k = key(nx, nz);
      if (from.has(k) || !a.isOpen(nx, nz) || (dist(nx, nz) < d - 0.2 && dist(nx, nz) < 3)) continue;
      from.set(k, { prev: cur, depth: depth + 1 }); queue.push([nx, nz]);
    }
  }
  const cells = [];
  for (let cur = best; cur && from.get(key(...cur)).prev; cur = from.get(key(...cur)).prev) cells.push(cur);
  a.path = cells.reverse().map(([gx, gz]) => [(gx + 0.5) * c, (gz + 0.5) * c]); a.step = 0;
  a.phase = a.path.length ? 'leaving' : 'idling';
}

export function updateCast(a, dt, player, hooks) {
  if (!a || !a.ready) return;
  const pp = player.pos;
  if (a.phase === 'hidden') {
    if (hooks.mazeTime >= a.next && !place(a, pp, a.next === 0)) a.next = hooks.mazeTime + 3;
  } else {
    const dx = pp.x - a.pos.x, dz = pp.z - a.pos.z, d = Math.hypot(dx, dz);
    const sees = d < GREET && a.los(a.pos.x, a.pos.z, pp.x, pp.z);
    if (a.phase === 'idling' && sees && !a.greeted) {
      a.phase = 'greeting'; a.greeted = true; a.face = Math.atan2(dx, dz);
      if (a.greet && d > CLOSE) play(a, a.greet); else a.phase = 'leaving-start';
    }
    // greeted already and no way past you yet: it waits, watching you, and tries again
    if (a.phase === 'idling' && a.greeted) { a.yaw = turn(a.yaw, Math.atan2(dx, dz), dt * 3); a.retry = (a.retry || 0) + dt; if (a.retry > 1.5) { a.retry = 0; a.phase = 'leaving-start'; } }
    if (a.phase === 'greeting' && a.face !== undefined) a.yaw = turn(a.yaw, a.face, dt * 4);
    if (a.phase === 'leaving-start') { leave(a, pp); if (a.phase === 'idling') play(a, a.idle); }
    if (a.phase === 'leaving') {
      const target = a.path[a.step];
      if (!target) {
        // round the corner and out of sight: gone, and somewhere else later; still in view: on again
        if (!a.los(pp.x, pp.z, a.pos.x, a.pos.z) && d > 6) { a.phase = 'hidden'; a.root.visible = false; a.next = hooks.mazeTime + 35 + Math.random() * 30; a.current = null; a.mixer.stopAllAction(); return; }
        leave(a, pp); if (a.phase !== 'leaving') { play(a, a.idle); }
      } else {
        const [speed, loop] = d < CLOSE ? a.spec.jog : a.spec.walk;
        const tx = target[0] - a.pos.x, tz = target[1] - a.pos.z, td = Math.hypot(tx, tz), adv = speed * dt;
        if (td <= adv) { a.pos.x = target[0]; a.pos.z = target[1]; a.step++; }
        else { a.pos.x += tx / td * adv; a.pos.z += tz / td * adv; }
        a.yaw = turn(a.yaw, Math.atan2(tx, tz), dt * 6);
        a.pos.y = a.floorY(a.pos.x, a.pos.z);
        const clip = d < CLOSE ? a.jog : a.walk;
        play(a, clip, clip ? speed / loop * clip.getClip().duration : 1);
      }
    }
  }
  a.root.position.copy(a.pos); a.root.rotation.y = a.yaw;
  a.mixer.update(dt);
}

function turn(from, to, k) {
  let d = to - from; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, k);
}
