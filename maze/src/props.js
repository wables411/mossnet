// Everything that fills a location: what is overhead (tree canopy, cave rock,
// brick vaults, rock bridges), trunks rising out of the walls, walls made of
// stacked nurse logs or a palisade of standing trunks (cypress knees, Spanish
// moss), fallen logs, boulders, roots, mushrooms, ferns and undergrowth, a
// stream cut into the floor, a still water level.
// Each builder takes the build context from World and adds to ctx.group.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { MeshBuilder, disp, withAO, hangClumpGeometry, lumpGeometry, fernTexture, plantTexture, tuftTexture, leafTexture, mushroomTexture, spanishMossTexture } from './geometry.js?v=d4fe5800';
import { fbm3, noise3 } from './noise.js?v=a407dfed';
import { GLSL_COMMON, makeMossMaterial } from './materials.js?v=af31d97a';
import { makeCardMaterial } from './wind.js?v=25d38805';
import { MATERIAL_SPECS } from './world.js?v=f2a7f2b3';

// the material a prop borrows from its place's kit
const kitSpec = (loc, key, fallback) => MATERIAL_SPECS[(loc.kit && loc.kit[key]) || fallback] || MATERIAL_SPECS[fallback];

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();

function instanced(geo, mat, n) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
  m.count = n; m.castShadow = true; m.receiveShadow = true;
  return m;
}

// two quads at right angles, standing on the origin, 1 x 1
export function crossCardGeometry() {
  const pos = [], uv = [], nor = [];
  const quad = (ax, az) => {
    const pts = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]];
    const tri = [0, 1, 2, 0, 2, 3];
    for (const i of tri) { const [s, y] = pts[i]; pos.push(s * ax, y, s * az); uv.push(s + 0.5, y); nor.push(-az, 0, ax); }
  };
  quad(1, 0); quad(0, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// ---------------------------------------------------------------- overhead

export function buildCanopy(ctx) {
  const { loc, rng, c, H, maze, group, world } = ctx;
  if (loc.ceiling === 'tunnel' || loc.ceiling === 'cave' || loc.canopy <= 0) return;
  const tex = world.texCache.leaf || (world.texCache.leaf = leafTexture());
  const mat = makeCardMaterial({ map: tex, color: 0xd8e2c6, mode: 'leaf', stiffness: 0.25, emissive: 0x24301a, emissiveIntensity: 0.9 });
  world.materials.push(mat);
  const pad = 3 * c;
  const x0 = -pad, z0 = -pad, L = maze.W * c + 2 * pad, Lz = maze.H * c + 2 * pad;
  const step = 3.2;
  const places = [];
  const ch = loc.canopyHeight || 9;
  // a high filler layer: the far canopy of trees beyond the ones we build
  for (let z = z0; z < z0 + Lz; z += step) for (let x = x0; x < x0 + L; x += step) {
    if (rng() > loc.canopy * 0.6) continue;
    const px = x + rng() * step, pz = z + rng() * step;
    places.push([px, pz, ch + rng() * 4 + ctx.floorY(px, pz), 4 + rng() * 4, false]);
  }
  // leaves at the tips of every branch the trees grew
  for (const b of ctx.branchTips) for (let k = 0; k < 2 + Math.floor(rng() * 2); k++) places.push([b[0] + (rng() - 0.5) * 1.0, b[2] + (rng() - 0.5) * 1.0, b[1] + (rng() - 0.3) * 0.6, 1.3 + rng() * 1.4, true]);
  const cluster = leafClusterGeometry();
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);   // the far filler lies flat: it is only ever seen from below
  const nTip = places.length - Math.max(0, places.length - ctx.branchTips.length * 3);
  // the far filler casts nothing (the leaf layers in shadow.js stand for it); the clusters on the branch tips do, as leaves
  const far = instanced(flat, mat, places.length);
  far.receiveShadow = false; far.castShadow = false;
  const near = instanced(cluster, mat, places.length);
  near.receiveShadow = false;
  let nf = 0, nn = 0;
  places.forEach(([x, z, y, s, tip]) => {
    E.set((rng() - 0.5) * 0.5, rng() * Math.PI * 2, (rng() - 0.5) * 0.5); Q.setFromEuler(E);
    P.set(x, y, z); S.set(s, tip ? s * 0.6 : 1, s * (0.7 + rng() * 0.5));
    if (tip) near.setMatrixAt(nn++, M4.compose(P, Q, S)); else far.setMatrixAt(nf++, M4.compose(P, Q, S));
  });
  far.count = nf; near.count = nn;
  if (nf) group.add(far);
  if (nn) group.add(near);
}

// three cards through one point: a horizontal one and two upright, so a cluster has volume from any angle
function leafClusterGeometry() {
  // three cards tilted 35 degrees off flat, turned a third of a circle apart: never edge-on from below, never a cross
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2 + 0.6); g.rotateY(k * Math.PI * 2 / 3); g.translate(0, (k - 1) * 0.12, 0);
    parts.push(g);
  }
  const pos = [], uv = [], nor = [], idx = []; let base = 0;
  for (const g of parts) {
    const p = g.attributes.position, u = g.attributes.uv, n = g.attributes.normal, ix = g.index;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(u.getX(i), u.getY(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    base += p.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  return geo;
}

// where the trunk's axis is at height y (object space, before instance scale): it leans as it rises
const trunkAxis = y => { const t = y / 12; return [Math.sin(t * 2.1) * 0.25 * t, Math.cos(t * 1.7) * 0.2 * t]; };
const trunkRadius = y => (0.42 + (0.22 - 0.42) * (y / 12)) * (1 + 1.2 * Math.pow(Math.max(0, 1 - y / 1.4), 2));

export function buildTrees(ctx) {
  const { loc, rng, c, H, group, world, diff, wallCells } = ctx;
  if (!loc.trees) return;
  const spots = wallCells.filter(() => rng() < loc.trees * 0.11);
  if (!spots.length) return;
  const geo = new THREE.CylinderGeometry(0.22, 0.42, 12, 11, 8);
  {
    // flare the base and lean the trunk
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + 6;
      const flare = 1 + 1.2 * Math.pow(Math.max(0, 1 - y / 1.4), 2);
      const w = (noise3(p.getX(i) * 3, y * 0.5, p.getZ(i) * 3) - 0.5) * 0.12;
      const [ax, az] = trunkAxis(y);
      p.setX(i, p.getX(i) * flare * (1 + w) + ax); p.setZ(i, p.getZ(i) * flare * (1 + w) + az);
    }
    geo.computeVertexNormals();
    withAO(geo, (x, y) => Math.min(1, (y + 6) / 1.2));
  }
  const mats = world.matPair({ ...kitSpec(loc, 'bark', 'wood'), scale: 0.8, mossScale: 0.9, baseTint: 0x5e4f3c, mossTint: 0xe8f2d8 }, { ...diff, mossCover: 0.32, fuzz: 0.5 }, 1, world.q.high ? 4 : 2, loc.moss, 0, false, true);
  const mesh = instanced(geo, mats.solid, spots.length);
  const trees = [];
  spots.forEach(([x, y], i) => {
    const s = 0.8 + rng() * 0.9;
    E.set((rng() - 0.5) * 0.08, rng() * Math.PI * 2, (rng() - 0.5) * 0.08); Q.setFromEuler(E);
    const px = (x + 0.5) * c + (rng() - 0.5) * c * 0.3, pz = (y + 0.5) * c + (rng() - 0.5) * c * 0.3;
    P.set(px, 6 - 0.3 + ctx.floorY(px, pz), pz); S.set(s, 1, s);
    mesh.setMatrixAt(i, M4.compose(P, Q, S));
    trees.push([px, pz, s]);
  });
  group.add(mesh);

  // branches: cylinders leaving the trunk between 4 and 10 m, rising outward; their tips get the leaves
  const bGeo = new THREE.CylinderGeometry(0.035, 0.16, 1, 7, 1, true); bGeo.translate(0, 0.5, 0);
  withAO(bGeo, () => 0.9);
  const branches = [];
  for (const [px, pz, s] of trees) {
    const n = 4 + Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) {
      const yaw = rng() * Math.PI * 2, y0 = 3.8 + rng() * 6, len = 1.8 + rng() * 2.6, pitch = 0.35 + rng() * 0.6;
      // the trunk's axis at this height, scaled like the instance; the branch starts well inside the bark
      const [ax, az] = trunkAxis(y0 + 0.3);
      const r = trunkRadius(y0 + 0.3) * s;
      const cx = px + ax * s, cz = pz + az * s;
      const bx = cx + Math.cos(yaw) * r * 0.35, bz = cz + Math.sin(yaw) * r * 0.35;
      branches.push([bx, y0, bz, yaw, pitch, len + r * 0.65, s]);
      const tx = bx + Math.cos(yaw) * Math.cos(pitch) * (len + r * 0.65), ty = y0 + Math.sin(pitch) * (len + r * 0.65), tz = bz + Math.sin(yaw) * Math.cos(pitch) * (len + r * 0.65);
      ctx.branchTips.push([tx, ty, tz, yaw]);
      // a second-order fork part way along, starting inside the first branch
      if (rng() < 0.7) {
        const f = 0.45 + rng() * 0.3, yaw2 = yaw + (rng() - 0.5) * 1.6, len2 = len * (0.4 + rng() * 0.4), pitch2 = pitch + 0.15 + rng() * 0.3;
        const fx = bx + Math.cos(yaw) * Math.cos(pitch) * (len + r * 0.65) * f, fy = y0 + Math.sin(pitch) * (len + r * 0.65) * f, fz = bz + Math.sin(yaw) * Math.cos(pitch) * (len + r * 0.65) * f;
        branches.push([fx, fy, fz, yaw2, pitch2, len2, s * 0.6]);
        ctx.branchTips.push([fx + Math.cos(yaw2) * Math.cos(pitch2) * len2, fy + Math.sin(pitch2) * len2, fz + Math.sin(yaw2) * Math.cos(pitch2) * len2, yaw2]);
      }
    }
  }
  if (branches.length) {
    const bm = instanced(bGeo, mats.solid, branches.length);
    const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
    branches.forEach(([bx, by, bz, yaw, pitch, len, s], i) => {
      dir.set(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch));
      Q.setFromUnitVectors(up, dir);
      P.set(bx, by, bz); S.set(s, len, s);
      bm.setMatrixAt(i, M4.compose(P, Q, S));
    });
    group.add(bm);
  }
}

// moss hanging from the boughs: the location's pendant species, swaying
export function buildBoughMoss(ctx) {
  const { loc, rng, group, world } = ctx;
  const pend = loc.mosses.filter(m => m.form === 'hanging');
  if (!pend.length || !ctx.branchTips.length || !loc.hanging) return;
  const tex = world.curtainTex;
  const tint = new THREE.Color(pend[Math.floor(rng() * pend.length)].color).multiplyScalar(0.85);
  const mat = makeCardMaterial({ map: tex, color: tint.getHex(), mode: 'hang', stiffness: 0.5, alphaTest: 0.35, emissive: 0x1c2614, emissiveIntensity: 0.7 });
  world.materials.push(mat);
  const geo = hangClumpGeometry();
  const items = [];
  for (const [tx, ty, tz, yaw] of ctx.branchTips) {
    const n = rng() < loc.hanging ? 1 + Math.floor(rng() * 3) : 0;
    for (let k = 0; k < n; k++) items.push([tx + (rng() - 0.5) * 1.5, ty - 0.1 - rng() * 0.3, tz + (rng() - 0.5) * 1.5, yaw + rng() * Math.PI, 0.5 + rng() * 0.9, 0.6 + rng() * 1.6]);
  }
  if (!items.length) return;
  const mesh = instanced(geo, mat, items.length);
  items.forEach(([x, y, z, yaw, w, h], i) => {
    E.set(0, yaw, 0); Q.setFromEuler(E); P.set(x, y, z); S.set(w, h, w);
    mesh.setMatrixAt(i, M4.compose(P, Q, S));
  });
  group.add(mesh);
}

// rock overhead for the cells `caveAt` says are covered: a cave, or the bridges and cave mouths of a scowle
export function buildCaveCeiling(ctx) {
  const { c, H, group, world, diff, loc, openCells, caveAt } = ctx;
  const b = new MeshBuilder(() => 1);
  const n = Math.max(3, Math.round(c / 0.3));
  const m = 0.6; // reach into the walls so no carved edge can open a gap
  for (const [x, y] of openCells) {
    if (!caveAt(x, y)) continue;
    b.grid([x * c - m, H - 0.3, y * c - m], [c + 2 * m, 0, 0], [0, 0, c + 2 * m], n + 2, n + 2, 'ceil', (px, py, pz) => {
      const bump = fbm3(px * 0.7 + 11, 2, pz * 0.7 + 11, 2) * 0.5 + fbm3(px * 2.4, 5, pz * 2.4, 2) * 0.25;
      return [0, -bump * 0.7 + ctx.floorY(px, pz), 0];
    });
  }
  if (b.empty()) return;
  const mats = world.matPair({ ...kitSpec(loc, 'ceiling', (loc.kit && loc.kit.rock) || 'rock'), mossScale: 0.7 }, { ...diff, mossCover: 0.22 }, world.q.high ? 6 : 3, 2, loc.moss);
  const mesh = new THREE.Mesh(b.build(), mats.solid);
  mesh.receiveShadow = true; mesh.castShadow = true;
  group.add(mesh);
}

// brick barrel vaults over corridors, domes at junctions
export function buildVaults(ctx) {
  const { c, H, group, world, diff, loc, openCells, distToWall } = ctx;
  const b = new MeshBuilder(() => 1);
  const n = Math.max(4, Math.round(c / 0.25));
  const rise = Math.min(1.1, c * 0.45);
  const m = 0.6; // reach into the walls so the vault meets them below any carved top
  for (const [x, y] of openCells) {
    b.grid([x * c - m, H - 0.5, y * c - m], [c + 2 * m, 0, 0], [0, 0, c + 2 * m], n + 2, n + 2, 'vault', (px, py, pz) => {
      // distance to the nearest wall anywhere, so the profile is continuous across cells: 0 at the wall, 1 a half-corridor in
      const d = Math.max(0, Math.min(1, distToWall(px, pz) / (c / 2)));
      const prof = Math.sqrt(d * (2 - d));
      const sag = (fbm3(px * 1.3, 1, pz * 1.3, 2) - 0.5) * 0.08;
      return [0, 0.38 + rise * prof + sag + ctx.floorY(px, pz), 0];
    });
  }
  if (b.empty()) return;
  const mats = world.matPair(kitSpec(loc, 'vault', 'brick'), { ...diff, mossCover: 0.42 }, world.q.high ? 6 : 3, world.q.high ? 4 : 2, loc.moss);
  const mesh = new THREE.Mesh(b.build(), mats.solid);
  mesh.receiveShadow = true; mesh.castShadow = true;
  group.add(mesh);
  const fuzz = new THREE.InstancedMesh(mesh.geometry, mats.fuzz, world.q.high ? 4 : 2);
  for (let i = 0; i < fuzz.count; i++) fuzz.setMatrixAt(i, new THREE.Matrix4());
  fuzz.receiveShadow = true; fuzz.userData.layers = fuzz.count; world.fuzzMeshes.push(fuzz); group.add(fuzz);
}

// ---------------------------------------------------------------- on the ground

// spots along the walls: [x, y, dx, dy] = open cell and the direction of a wall beside it
export function wallSpots(ctx) {
  const { openCells, wallAt, maze } = ctx;
  const out = [];
  for (const [x, y] of openCells) {
    if (Math.abs(x - maze.start.x) + Math.abs(y - maze.start.y) < 2) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (wallAt(x + dx, y + dy)) out.push([x, y, dx, dy]);
  }
  return out;
}
// a point beside that wall: `off` metres from the wall face, `along` 0..1 along the cell
function besideWall(ctx, spot, off, along) {
  const [x, y, dx, dy] = spot, c = ctx.c;
  const px = (x + 0.5) * c + dx * (c / 2 - off) + (dy ? (along - 0.5) * c * 0.9 : 0);
  const pz = (y + 0.5) * c + dy * (c / 2 - off) + (dx ? (along - 0.5) * c * 0.9 : 0);
  return [px, pz];
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// the real surface under a point: the highest hit on a placed scan (logs, stumps) by a ray straight down,
// else the floor. Returns [y, nx, ny, nz] or null when `onlyProps` and nothing was hit.
const RAY = new THREE.Raycaster(), RAY_O = new THREE.Vector3(), RAY_D = new THREE.Vector3(0, -1, 0), NM = new THREE.Matrix3();
export function surfaceAt(ctx, x, z, onlyProps = false) {
  let best = null;
  for (const s of ctx.surfaces || []) {
    const bb = s.bounds;
    if (x < bb.min.x || x > bb.max.x || z < bb.min.z || z > bb.max.z) continue;
    RAY_O.set(x, bb.max.y + 1, z); RAY.set(RAY_O, RAY_D); RAY.far = bb.max.y - bb.min.y + 2;
    const hits = RAY.intersectObject(s.mesh, false);
    if (!hits.length) continue;
    const h = hits[0];
    if (!best || h.point.y > best.y) {
      const n = h.face.normal.clone().applyMatrix3(NM.getNormalMatrix(s.mesh.matrixWorld)).normalize();
      if (n.y < 0) n.negate();
      best = { y: h.point.y, n };
    }
  }
  if (best) return [best.y, best.n.x, best.n.y, best.n.z];
  if (onlyProps) return null;
  return [ctx.floorY ? ctx.floorY(x, z) : 0, 0, 1, 0];
}
// register a placed scan instance for surfaceAt
function addSurface(ctx, piece, matrix) {
  const mesh = new THREE.Mesh(piece.geometry, piece.material);
  mesh.matrixAutoUpdate = false; mesh.matrixWorld.copy(matrix);
  const bounds = piece.geometry.boundingBox.clone().applyMatrix4(matrix);
  (ctx.surfaces = ctx.surfaces || []).push({ mesh, bounds });
}
// a slight lean with the surface it stands on, then the yaw
function standOn(q, nx, ny, nz, yaw, lean = 0.6) {
  const up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3(nx, ny, nz).normalize();
  const tilt = new THREE.Quaternion().setFromUnitVectors(up, n);
  q.identity().slerp(tilt, lean);
  const spin = new THREE.Quaternion().setFromAxisAngle(up, yaw);
  return q.multiply(spin);
}

export function buildLogs(ctx) {
  const { loc, rng, c, group, world, diff, obstacles } = ctx;
  const dens = loc.props.logs; if (!dens) return;
  const spots = wallSpots(ctx);
  const n = Math.min(160, Math.round(spots.length * 0.12 * dens));
  if (!n) return;
  const geo = logGeometry();
  const sets = [loc.moss, [loc.moss[1], loc.moss[0]]];
  const meshes = sets.map(ms => instanced(geo, world.matPair({ ...kitSpec(loc, 'bark', 'wood'), scale: 1.0, mossScale: 1.1, baseTint: 0x4f4232, mossTint: 0xffffff }, { ...diff, mossCover: 0.36, fuzz: 1 }, 1, world.q.high ? 6 : 3, ms, 0, false, true).solid, n));
  const counts = [0, 0];
  const placed = [];
  for (let i = 0; i < n; i++) {
    const spot = pick(rng, spots);
    const r = 0.14 + Math.pow(rng(), 1.6) * 0.3, len = 1.2 + rng() * 2.4;
    const [px, pz] = besideWall(ctx, spot, r + 0.1 + rng() * 0.15, 0.5);
    const [, , dx, dy] = spot;
    // along the wall, tilted a little
    const yaw = dx ? 0 : Math.PI / 2;   // cylinder axis is y; rotate to lie along z (dx wall) or x (dy wall)
    placed.push({ px, pz, r, len, yaw, set: i % 2 });
  }
  placed.forEach(({ px, pz, r, len, yaw, set }) => {
    // collision along the axis, only if the corridor stays walkable
    const dirx = yaw === 0 ? 0 : 1, dirz = yaw === 0 ? 1 : 0;
    const circles = [];
    for (let t = -len / 2 + r; t <= len / 2 - r; t += Math.max(r, 0.25)) circles.push([px + dirx * t, pz + dirz * t, r * 0.9]);
    if (!ctx.pass.place(circles)) return;
    E.set(Math.PI / 2 + (rng() - 0.5) * 0.12, yaw + (rng() - 0.5) * 0.25, 0, 'YXZ'); Q.setFromEuler(E);
    P.set(px, r * 0.78 + ctx.floorY(px, pz), pz); S.set(r, len, r);
    meshes[set].setMatrixAt(counts[set]++, M4.compose(P, Q, S));
    ctx.logTops.push({ x: px, z: pz, y: r * 1.55 + ctx.floorY(px, pz), dirx, dirz, half: len / 2 - r, r });
  });
  meshes.forEach((m, i) => { m.count = counts[i]; if (counts[i]) { group.add(m); world.shootSources.push({ mesh: m, kind: 'log', cover: 0.5 }); } });
}

export function buildBoulders(ctx) {
  const { loc, rng, c, group, world, diff, obstacles, openCells, wallAt, maze } = ctx;
  const dens = loc.props.boulders; if (!dens) return;
  // corners: open cells with walls on two perpendicular sides
  const corners = [];
  for (const [x, y] of openCells) {
    if (Math.abs(x - maze.start.x) + Math.abs(y - maze.start.y) < 2) continue;
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (wallAt(x + dx, y) && wallAt(x, y + dy)) corners.push([x, y, dx, dy]);
  }
  const spots = wallSpots(ctx);
  const n = Math.min(220, Math.round((corners.length * 0.4 + spots.length * 0.05) * dens));
  if (!n) return;
  const geo = withAO(lumpGeometry(5.1, 0.75, 0.7, 26), (x, y) => Math.min(1, Math.max(0, y + 0.7)));
  const mats = world.matPair({ ...kitSpec(loc, 'rock', 'stone'), mossScale: 0.7 }, { ...diff, mossCover: 0.66, fuzz: 1 }, 1, world.q.high ? 6 : 3, loc.moss, 0, true);
  const mesh = instanced(geo, mats.solid, n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    let px, pz, r;
    if (corners.length && rng() < 0.6) {
      const [x, y, dx, dy] = pick(rng, corners);
      r = 0.35 + Math.pow(rng(), 1.4) * 0.75;
      px = (x + 0.5) * c + dx * (c / 2 - r * 0.55); pz = (y + 0.5) * c + dy * (c / 2 - r * 0.55);
    } else {
      r = 0.25 + Math.pow(rng(), 1.6) * 0.55;
      [px, pz] = besideWall(ctx, pick(rng, spots), r * 0.5, rng());
    }
    if (!ctx.pass.place([[px, pz, r * 0.8]])) continue;
    E.set((rng() - 0.5) * 0.5, rng() * Math.PI * 2, (rng() - 0.5) * 0.5); Q.setFromEuler(E);
    P.set(px, r * 0.35 + ctx.floorY(px, pz), pz); S.set(r * (0.8 + rng() * 0.5), r, r * (0.8 + rng() * 0.5));
    mesh.setMatrixAt(k++, M4.compose(P, Q, S));
  }
  mesh.count = k;
  group.add(mesh);
  world.shootSources.push({ mesh, kind: 'lump', cover: 0.6 });
}

export function buildMushrooms(ctx) {
  const { loc, rng, group, world } = ctx;
  const dens = loc.props.mushrooms; if (!dens) return;
  const spots = wallSpots(ctx);
  const clusters = Math.min(160, Math.round((spots.length * 0.05 + ctx.logTops.length * 0.8) * dens));
  if (!clusters) return;
  // profile: a thin stem, a flat gill ring, a cap with a turned-down margin and a slight boss on top
  // (v along the profile matches the texture: stem 0..0.55, gills 0.55..0.65, cap 0.65..1)
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(0.07, 0), new THREE.Vector2(0.06, 0.5), new THREE.Vector2(0.07, 0.86),
    new THREE.Vector2(0.44, 0.84), new THREE.Vector2(0.5, 0.9), new THREE.Vector2(0.42, 1.0), new THREE.Vector2(0.24, 1.08), new THREE.Vector2(0.06, 1.13), new THREE.Vector2(0, 1.14)];
  const geo = new THREE.LatheGeometry(pts, 14);
  const tex = world.texCache.mushroom || (world.texCache.mushroom = mushroomTexture());
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, color: 0xffffff });
  world.materials.push(mat);
  const palette = [0xa08868, 0xb89a72, 0x8c7050, 0xc9b48c, 0x7a5a3c, 0xd8cfb6, 0xb07a40, 0x9a8f7a];
  const total = clusters * 8;
  const mesh = instanced(geo, mat, total);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);
  const col = new THREE.Color();
  let k = 0;
  for (let i = 0; i < clusters; i++) {
    const n = 3 + Math.floor(rng() * 6);
    const base = col.setHex(pick(rng, palette));
    let cx, cz, surf = null;
    if (ctx.logTops.length && rng() < 0.45) {
      // on a log: a point over its length, a little off its centre line, dropped onto the scanned surface;
      // only where that surface faces up enough to hold a mushroom
      const onLog = pick(rng, ctx.logTops);
      for (let tries = 0; tries < 4 && !surf; tries++) {
        const t = (rng() - 0.5) * 2 * onLog.half, side = (rng() - 0.5) * onLog.r * 0.9;
        cx = onLog.x + onLog.dirx * t - onLog.dirz * side; cz = onLog.z + onLog.dirz * t + onLog.dirx * side;
        const hit = onLog.scan ? surfaceAt(ctx, cx, cz, true) : [onLog.y, 0, 1, 0];
        if (hit && hit[2] > 0.55) surf = hit;
      }
      if (!surf) continue;
    } else {
      [cx, cz] = besideWall(ctx, pick(rng, spots), 0.12 + rng() * 0.3, rng());
      if (ctx.pass.inside(cx, cz, 0.08)) continue;    // not inside a rock or log
      surf = surfaceAt(ctx, cx, cz);
    }
    const [cy, snx, sny, snz] = surf;
    for (let j = 0; j < n && k < total; j++) {
      const s = 0.02 + Math.pow(rng(), 2.2) * 0.09;
      // the cluster spreads in the surface's own plane, so every stem stays rooted
      const ox = (rng() - 0.5) * 0.12, oz = (rng() - 0.5) * 0.12;
      const oy = -(snx * ox + snz * oz) / Math.max(0.3, sny);
      P.set(cx + ox, cy + oy - 0.004 * s / 0.05, cz + oz);
      standOn(Q, snx, sny, snz, rng() * Math.PI * 2, 0.7);
      E.set((rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.3); Q.multiply(new THREE.Quaternion().setFromEuler(E));
      S.set(s * (0.85 + rng() * 0.3), s * (0.9 + rng() * 0.6), s * (0.85 + rng() * 0.3));
      mesh.setMatrixAt(k, M4.compose(P, Q, S));
      const v = 0.8 + rng() * 0.4;
      mesh.instanceColor.setXYZ(k, base.r * v, base.g * v, base.b * v);
      k++;
    }
  }
  mesh.count = k;
  group.add(mesh);
}

export function buildPlants(ctx) {
  const { loc, rng, c, group, world, openCells, maze } = ctx;
  const spots = wallSpots(ctx);
  const geo = crossCardGeometry();
  const kinds = [
    { key: 'ferns', tex: () => fernTexture(), size: [0.45, 1.1], color: 0xaab89a, lift: 0, off: [0.2, 0.55] },
    { key: 'plants', tex: () => plantTexture(), size: [0.35, 0.8], color: 0xb4bea4, lift: 0, off: [0.15, 0.5] },
    { key: 'grass', tex: () => tuftTexture(), size: [0.25, 0.6], color: 0x8f9c6e, lift: 0, off: [0.1, 0.9], anywhere: true },
  ];
  for (const kind of kinds) {
    const dens = loc.props[kind.key]; if (!dens) continue;
    const n = Math.min(500, Math.round(spots.length * 0.22 * dens));
    if (!n) continue;
    const tex = world.texCache[kind.key] || (world.texCache[kind.key] = kind.tex());
    const mat = makeCardMaterial({ map: tex, color: kind.color, mode: 'up', stiffness: kind.key === 'grass' ? 0.4 : 0.25 });
    world.materials.push(mat);
    const mesh = instanced(geo, mat, n);
    for (let i = 0; i < n; i++) {
      let px, pz;
      if (kind.anywhere && rng() < 0.5) {
        const [x, y] = pick(rng, openCells);
        if (Math.abs(x - maze.start.x) + Math.abs(y - maze.start.y) < 2) { px = -99; pz = -99; }
        else { px = (x + rng()) * c; pz = (y + rng()) * c; }
      } else {
        [px, pz] = besideWall(ctx, pick(rng, spots), kind.off[0] + rng() * (kind.off[1] - kind.off[0]), rng());
      }
      const s = kind.size[0] + rng() * (kind.size[1] - kind.size[0]);
      if (px > 0 && ctx.pass.inside(px, pz, 0.1)) { px = -99; pz = -99; }    // not growing out of a rock
      E.set((rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3); Q.setFromEuler(E);
      P.set(px, ctx.floorY(px, pz) - 0.02, pz); S.set(s * (1 + rng() * 0.4), s, s * (1 + rng() * 0.4));
      mesh.setMatrixAt(i, M4.compose(P, Q, S));
    }
    group.add(mesh);
  }
}

// ---------------------------------------------------------------- water

export function waterMaterial(fogColor, sunDir, deep = 0x0f150d) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: Object.assign({
      uTime: { value: 0 }, uDeep: { value: new THREE.Color(deep) }, uSky: { value: fogColor.clone().multiplyScalar(0.3) },
      uSunDir: { value: sunDir.clone().normalize() },
    }, THREE.UniformsUtils.clone(THREE.UniformsLib.fog)),
    vertexShader: /* glsl */`
      #include <fog_pars_vertex>
      varying vec3 vW;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uDeep, uSky, uSunDir; varying vec3 vW;
      ${GLSL_COMMON}
      void main(){
        vec2 p = vW.xz;
        float n1 = vnoise(vec3(p * 5.0 + vec2(uTime * 0.7, uTime * 0.25), 0.0));
        float n2 = vnoise(vec3(p * 11.0 - vec2(uTime * 0.4, uTime * 1.0), 3.0));
        vec3 N = normalize(vec3((n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.12, 1.0, (n2 - 0.5) * 0.35 + (n1 - 0.5) * 0.12));
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 R = reflect(-V, N);
        vec3 refl = mix(uDeep * 1.6, uSky, clamp(R.y * 0.9 + 0.35, 0.0, 1.0));
        float spec = min(0.2, pow(max(dot(R, uSunDir), 0.0), 40.0) * 0.3);
        vec3 col = mix(uDeep, refl, 0.2 + 0.7 * fres) + spec + 0.03 * smoothstep(0.62, 0.8, n2);
        gl_FragColor = vec4(col, 0.55 + 0.4 * fres);
        #include <fog_fragment>
      }`,
  });
  return mat;
}

export function buildStream(ctx) {
  const { stream, c, maze, group, world, rng, diff, loc } = ctx;
  if (!stream) return;
  const pad = 4 * c;
  const L = maze.W * c + 2 * pad;
  const geo = new THREE.PlaneGeometry(L, stream.w + 1.0, Math.round(L / 0.5), 2); geo.rotateX(-Math.PI / 2);
  const mat = waterMaterial(world.fogColor, world.sunDir);
  world.materials.push(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(maze.W * c / 2, -0.05, stream.z);
  mesh.renderOrder = 2;
  group.add(mesh);
  world.waters.push(mat);
  // stepping stones in the channel
  const geoS = withAO(lumpGeometry(3.3, 0.55, 0.4, 12), () => 0.85);
  const row = Math.floor(stream.z / c);
  const cellsInRow = ctx.openCells.filter(([x, y]) => y === row);
  const n = cellsInRow.length * 3;
  if (n) {
    const mats = world.matPair({ ...kitSpec(loc, 'rock', 'stone'), scale: 0.6, mossScale: 0.8 }, { ...diff, mossCover: 0.35 }, 1, 2, loc.moss, 0, true);
    const mesh = instanced(geoS, mats.solid, n);
    let k = 0;
    for (const [x] of cellsInRow) for (let j = 0; j < 3; j++) {
      const r = 0.12 + rng() * 0.16;
      P.set((x + 0.15 + rng() * 0.7) * c, -0.1 + r * 0.3, stream.z + (rng() - 0.5) * stream.w * 0.8);
      E.set((rng() - 0.5) * 0.4, rng() * Math.PI * 2, (rng() - 0.5) * 0.4); Q.setFromEuler(E); S.set(r, r, r);
      mesh.setMatrixAt(k++, M4.compose(P, Q, S));
    }
    group.add(mesh);
  }
}


// ---------------------------------------------------------------- moss with a body

// cushions and hummocks of moss sitting on the walls and the floor edges, each a
// blob half-sunk into the surface, with its own fuzz shells and a per-instance
// tint from the location's species. The growth form shapes it: a haircap stand
// is tall and narrow, a carpet lies flat and wide, a cushion is a full dome.
// A share of them carry sporophytes (capsules on stalks), more after dark.
// Flat carpet patches also grow on the shaded side of the scanned trees' feet.
export function buildCushions(ctx) {
  const { loc, rng, c, H, group, world, diff, cells, open, openCells } = ctx;
  const spec = loc.mosses.filter(m => m.form === 'cushion' || m.form === 'haircap' || m.form === 'feather' || m.form === 'carpet');
  if (!spec.length) return;
  const geo = withAO(lumpGeometry(9.0, 0.55, 0.6, 18), (x, y) => Math.min(1, Math.max(0.3, y + 0.8)));
  const items = [];
  const push = (x, y, z, nx, ny, nz, r, form = null) => items.push([x, y, z, nx, ny, nz, r, form]);
  // moss on the scanned trees: flat patches low on the trunk, on the side away from the sun
  for (const t of ctx.trunkPatches || []) push(t[0], t[1], t[2], t[3], t[4], t[5], 0.05 + rng() * 0.11, 'carpet');
  // on wall faces: cluster where the slow mask field is high
  const faces = [];
  if (ctx.kind === 'carved') for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (open(x + dx, y + dy)) faces.push([x, y, dx, dy]);
  const budget = Math.min(1400, Math.round(faces.length * 2.2));
  for (let i = 0; i < budget; i++) {
    const [x, y, dx, dy] = faces[Math.floor(rng() * faces.length)];
    const fi = ctx.faceInfo ? ctx.faceInfo(x, y, dx, dy) : { a0: 0, a1: 1, top: H };
    const along = fi.a0 + 0.04 + rng() * Math.max(0.05, fi.a1 - fi.a0 - 0.08), hy = 0.15 + rng() * Math.max(0.3, fi.top - 0.45);
    let px = (x + 0.5) * c + dx * c / 2 + (dy ? (along - 0.5) * c : 0);
    let pz = (y + 0.5) * c + dy * c / 2 + (dx ? (along - 0.5) * c : 0);
    const low = fbm3(px * 0.55, hy * 0.55, pz * 0.55, 3) * 0.42 + fbm3(px * 2.3 + 7, hy * 2.3, pz * 2.3 + 7, 2) * 0.22 + 0.14 * Math.max(0, 1 - hy / 1.4);
    if (low < 0.55 - diff.mossCover * 0.3) continue;
    const d = disp(px, hy, pz, H); px += d[0]; pz += d[2];
    const r = 0.07 + Math.pow(rng(), 1.8) * 0.26;
    push(px + dx * r * 0.25, hy + ctx.floorY(px, pz), pz + dy * r * 0.25, dx, 0, dy, r);
  }
  // on the floor near walls, and on wall tops
  for (const [x, y] of openCells) {
    if (rng() < 0.5) continue;
    const px = (x + rng()) * c, pz = (y + rng()) * c;
    if (ctx.distToWall(px, pz) > 0.7) continue;
    const r = 0.08 + Math.pow(rng(), 1.5) * 0.3;
    if (ctx.pass.inside(px, pz, -r * 0.3)) continue;    // not through a log or rock
    push(px, ctx.floorY(px, pz), pz, 0, 1, 0, r);
  }
  if (ctx.kind === 'carved') for (const [x, y] of cells) {
    if (rng() < 0.6 || !(open(x + 1, y) || open(x - 1, y) || open(x, y + 1) || open(x, y - 1))) continue;
    const ins = Math.min(0.45, ((ctx.round || 0) + 0.05) / c);
    let px = (x + ins + rng() * (1 - 2 * ins)) * c, pz = (y + ins + rng() * (1 - 2 * ins)) * c;
    const d = disp(px, H, pz, H);
    const r = 0.1 + Math.pow(rng(), 1.5) * 0.3;
    push(px + d[0], H + d[1] - 0.02 + ctx.floorY(px, pz), pz + d[2], 0, 1, 0, r);
  }
  if (!items.length) return;
  const mats = world.matPair({ ...MATERIAL_SPECS[loc.floor], scale: 0.6, mossScale: 0.9, baseTint: 0x6f6450, mossTint: 0xffffff }, { ...diff, mossCover: 0.98, fuzz: 1.9 }, 1, world.q.high ? 5 : 3, loc.moss, 0, true);
  const solid = instanced(geo, mats.solid, items.length);
  solid.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(items.length * 3), 3);
  const col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3();
  const speciesOf = [];
  const night = world.night || 0;
  const sporos = [];   // [matrix of the cushion, count]
  items.forEach(([x, y, z, nx, ny, nz, r, wantForm], i) => {
    nrm.set(nx, ny, nz); Q.setFromUnitVectors(up, nrm);
    const spin = new THREE.Quaternion().setFromAxisAngle(up, rng() * Math.PI * 2); Q.multiply(spin);
    // the species first, since its form shapes the body: a haircap stand only on ground that faces up
    let sp = wantForm ? (spec.find(m => m.form === wantForm) || spec[0]) : spec[Math.floor(rng() * spec.length)];
    if (sp.form === 'haircap' && ny < 0.5) sp = spec.find(m => m.form !== 'haircap') || sp;
    const f = sp.form;
    const wx = 0.8 + rng() * 0.6, wz = 0.8 + rng() * 0.6;
    if (f === 'haircap') S.set(r * 0.8 * wx, r * 1.7, r * 0.8 * wz);
    else if (f === 'carpet') S.set(r * 1.3 * wx, r * 0.55, r * 1.3 * wz);
    else if (f === 'feather') S.set(r * 1.1 * wx, r * 0.7, r * 1.1 * wz);
    else S.set(r * wx, r, r * wz);
    P.set(x, y, z);
    solid.setMatrixAt(i, M4.compose(P, Q, S));
    speciesOf.push(sp);
    // sporophytes: nearly every haircap stand, a third of the cushions, a few feather and carpet mats; more under the moon
    const share = (f === 'haircap' ? 0.85 : f === 'cushion' ? 0.35 : 0.12) * (1 + 0.7 * night);
    if (rng() < share && ny > 0.2) sporos.push([M4.clone(), Math.round((f === 'haircap' ? 14 : 6) + rng() * (f === 'haircap' ? 30 : 14) * Math.min(1, r / 0.2)), f]);
    col.setHex(sp.color); const v = 0.85 + rng() * 0.4;
    // the shader already tints by species field; the instance colour nudges each cushion toward its own species
    solid.instanceColor.setXYZ(i, 0.7 + col.r * v * 0.6, 0.7 + col.g * v * 0.6, 0.7 + col.b * v * 0.6);
  });
  group.add(solid);
  world.shootSources.push({ mesh: solid, kind: 'cushion', cover: 1.0 });
  world.cushions = { mesh: solid, species: speciesOf };
  buildSporophytes(ctx, sporos);
  // fuzz: one instanced copy per shell layer, each telling the shader which layer it is. Two layers (one on
  // phones): with thousands of cushions each layer is another full copy of them all, and five cost millions of
  // triangles for a pile that two give nearly as well
  const layers = world.q.high ? 2 : 1;
  for (let k = 0; k < layers; k++) {
    const fm = makeMossMaterial({ ...mats.opts, fuzz: true, shells: layers, shellIndex: k });
    const mesh = new THREE.InstancedMesh(geo, fm, items.length);
    mesh.instanceMatrix = solid.instanceMatrix; mesh.instanceColor = solid.instanceColor;
    mesh.receiveShadow = true; mesh.castShadow = false;
    world.materials.push(fm);
    group.add(mesh);
  }
}


// sporophytes: a wiry stalk with a capsule nodding at the top, in stands on the cushions. One instanced mesh;
// each stands on its cushion's upper surface (the unit sphere scaled by the instance), the foot sunk in a little
function buildSporophytes(ctx, sporos) {
  const { rng, group, world } = ctx;
  if (!sporos.length) return;
  const cap = world.q.high ? 5000 : 1800;
  const stalk = new THREE.CylinderGeometry(0.03, 0.045, 1, 4, 1); stalk.translate(0, 0.5, 0);
  const capsule = new THREE.SphereGeometry(0.095, 6, 4); capsule.scale(1, 1.7, 1); capsule.rotateX(0.6); capsule.translate(0, 1.06, 0.04);
  const geo = mergeColoured([{ geo: stalk, color: 0x9a4e2c }, { geo: capsule, color: 0x8a6a3c }]);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, color: 0xffffff });
  world.materials.push(mat);
  let total = 0; for (const s of sporos) total += s[1];
  const n = Math.min(cap, total);
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  mesh.castShadow = false; mesh.receiveShadow = true;
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), nrm = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tilt = new THREE.Quaternion(), e = new THREE.Euler();
  let k = 0;
  const keep = n / total;
  for (const [cm, count, form] of sporos) {
    for (let j = 0; j < count && k < n; j++) {
      if (rng() > keep) continue;
      // a point on the upper half of the unit sphere, pushed in a little so the foot is inside the moss
      const u = 0.35 + rng() * 0.65, th = rng() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
      // the lump's own surface: the same noise lumpGeometry(9.0, 0.55, 0.6) pushed the sphere by
      const dx = rr * Math.cos(th), dy = u, dz = rr * Math.sin(th);
      const w = (1 - 0.3 + 0.6 * fbm3(dx * 2.2 + 9.0, dy * 2.2, dz * 2.2 + 9.0, 3)) * 0.96;
      p.set(dx * w, dy * w * 0.55, dz * w); nrm.set(dx, dy, dz).normalize();
      p.applyMatrix4(cm); nrm.transformDirection(cm);
      q.setFromUnitVectors(up, nrm);
      e.set((rng() - 0.5) * 0.5, rng() * Math.PI * 2, (rng() - 0.5) * 0.5); tilt.setFromEuler(e); q.multiply(tilt);
      const h = (form === 'haircap' ? 0.05 : 0.024) + rng() * (form === 'haircap' ? 0.035 : 0.018);
      s.set(h, h, h);
      mesh.setMatrixAt(k, m.compose(p, q, s));
      // young capsules are green, ripe ones brown to red
      const ripe = rng();
      mesh.instanceColor.setXYZ(k, 0.75 + 0.45 * ripe, 0.85 - 0.25 * ripe, 0.55 - 0.1 * ripe);
      k++;
    }
  }
  mesh.count = k;
  group.add(mesh);
  world.sporophytes = mesh;
}
// merge geometries with a flat colour per part, carried in a vertex colour attribute
function mergeColoured(parts) {
  const pos = [], nor = [], col = [], idx = []; let base = 0;
  for (const { geo, color } of parts) {
    const p = geo.attributes.position, n = geo.attributes.normal, c = new THREE.Color(color);
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
    for (let i = 0; i < geo.index.count; i++) idx.push(geo.index.getX(i) + base);
    base += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------- a fallen trunk

// unit log along y (scaled by [radius, length, radius]): the girth swells and
// narrows along it, it bows a little, bark ridges run along it, one end is a
// jagged break and the other a flared root end, and a few branch stubs stand off it
function logGeometry() {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 18, 28, false);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);   // y in -0.5..0.5
    const t = y + 0.5;
    const ang = Math.atan2(z, x);
    const r0 = Math.hypot(x, z);
    if (r0 < 1e-5) { p.setXYZ(i, x, y + (t > 0.5 ? 0.02 : -0.02), z); continue; }
    // girth along the length, bark ridges around it, a flare at the root end, a taper at the break
    let r = 1 + 0.18 * (fbm3(t * 4.0 + 3, 0, 0, 2) - 0.5) + 0.05 * Math.sin(ang * 9 + t * 7) + 0.04 * (noise3(ang * 3, t * 30, 1) - 0.5);
    r *= 1 + 0.45 * Math.pow(Math.max(0, 1 - t * 4), 2);
    r *= 1 - 0.12 * Math.pow(Math.max(0, t - 0.8) * 5, 2);
    // the cap at the far end breaks off jagged: pull cap vertices along the axis by the angle
    let yy = y;
    const cap = Math.abs(Math.abs(y) - 0.5) < 1e-5;
    if (cap && y > 0) yy += (noise3(Math.cos(ang) * 2 + 5, Math.sin(ang) * 2, 1) - 0.5) * 0.08 - 0.02 * r0;
    // a gentle bow
    const bow = Math.sin(t * Math.PI) * 0.08;
    p.setXYZ(i, Math.cos(ang) * r0 * r + bow, yy, Math.sin(ang) * r0 * r);
  }
  geo.computeVertexNormals();
  withAO(geo, (x, y, z) => 0.75 + 0.25 * Math.min(1, Math.max(0, (x + 1) / 2)));
  // branch stubs: short cones merged in
  const stubs = [];
  for (let k = 0; k < 4; k++) {
    const t = 0.15 + k * 0.2, ang = k * 2.1 + 0.6;
    const c = new THREE.CylinderGeometry(0.12, 0.3, 0.9, 7, 1);
    c.translate(0, 0.45, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(ang), 0.35, Math.sin(ang)).normalize());
    c.applyQuaternion(q);
    c.translate(0, t - 0.5, 0);
    withAO(c, () => 0.8);
    stubs.push(c);
  }
  return mergeGeometries([geo, ...stubs]);
}

// a nurse log for the Hoh walls: unit cylinder along y, laid on its side by the instance. Old
// Sitka spruce and hemlock trunks: the girth swells and narrows, bark plates and furrows run
// along it, lumps where branches were, a slump that leaves it wider than tall (local -z is
// up once it is laid down), both ends broken ragged, and a few branch stubs off the upper half
function nurseLogGeometry() {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 20, 10, false);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = y + 0.5, ang = Math.atan2(z, x), r0 = Math.hypot(x, z);
    const cap = Math.abs(Math.abs(y) - 0.5) < 1e-5;
    if (r0 < 1e-5) { p.setXYZ(i, x, y + (y > 0 ? -0.05 : 0.05), z); continue; }         // the core has rotted back
    let r = 1 + 0.14 * (fbm3(t * 3.2 + 2, ang * 0.5, 0, 2) - 0.5);                       // girth along the length
    r += 0.05 * (noise3(ang * 2.4 + 4, t * 7, 0.5) - 0.5) + 0.028 * Math.sin(ang * 11 + 2 * Math.sin(t * 6));   // plates and furrows
    r += 0.5 * Math.max(0, fbm3(ang * 1.1 + t * 4, t * 2.6 + 1, 3, 2) - 0.6);             // a lump where a branch was, a burl
    r -= 0.25 * Math.max(0, fbm3(ang * 0.9 + 7, t * 3.1 + 5, 6, 2) - 0.66);               // a rotten hollow
    const sx = 1.06, sz = 0.92;                                                             // the slump
    // the ends break ragged: the whole end ring (torso and cap alike) moves along the axis by the angle, so they stay joined
    // (the offset is along the axis, which the instance stretches by the length, so it stays small: splinters, not steps)
    const yy = cap ? y + Math.sign(y) * ((noise3(Math.cos(ang) * 4 + 5 * y, Math.sin(ang) * 4, 1) - 0.5) * 0.05 + (noise3(Math.cos(ang) * 9, Math.sin(ang) * 9 + 3 * y, 2) - 0.5) * 0.03 - 0.02 * r0) : y;
    p.setXYZ(i, Math.cos(ang) * r0 * r * sx + Math.sin(t * Math.PI) * 0.04, yy, Math.sin(ang) * r0 * r * sz);
  }
  geo.computeVertexNormals();
  withAO(geo, (x, y, z) => 0.6 + 0.4 * Math.min(1, Math.max(0, (1 - z) / 2)));
  const stubs = [];
  for (let k = 0; k < 3; k++) {
    const t = 0.2 + k * 0.3 + (k === 1 ? 0.04 : 0), ang = Math.PI + 0.95 + k * 0.63;      // the upper half, since -z is up; none reaches far into the corridor
    const c = new THREE.CylinderGeometry(0.11, 0.26, 0.55 + k * 0.1, 8, 1);
    c.translate(0, 0.3, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(ang), 0.12 * (k - 1), Math.sin(ang)).normalize());
    c.applyQuaternion(q);
    c.translate(0, t - 0.5, 0);
    withAO(c, () => 0.85);
    stubs.push(c);
  }
  return mergeGeometries([geo, ...stubs]);
}

function mergeGeometries(list) {
  const pos = [], nor = [], ao = [], uv = [], idx = []; let base = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, a = g.attributes.ao, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); ao.push(a ? a.getX(i) : 1); uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
    else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('ao', new THREE.Float32BufferAttribute(ao, 1));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}


// ---------------------------------------------------------------- photoscanned props

// Places the scans a location loaded: logs along walls (their long axis along
// the wall), stumps, boulders and mossy rocks in corners and at wall bases,
// stones and moss clumps scattered low, ferns and shrubs at the bases, trees
// rising out of the wall cells. Each scan piece becomes one InstancedMesh with
// the scan's own material; its upper surfaces become ground for the shoots.
export function buildScans(ctx) {
  const { loc, rng, c, H, group, world, obstacles, scans, maze, openCells, wallAt, open, diff } = ctx;
  if (!scans || !scans.length) return;
  const spots = wallSpots(ctx);
  const corners = [];
  for (const [x, y] of openCells) {
    if (Math.abs(x - maze.start.x) + Math.abs(y - maze.start.y) < 2) continue;
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (wallAt(x + dx, y) && wallAt(x, y + dy)) corners.push([x, y, dx, dy]);
  }
  const wallCells = ctx.wallCells;
  const byKind = {};
  for (const m of scans) { if (!m.pieces.length) continue; (byKind[m.spec.kind] = byKind[m.spec.kind] || []).push(m); }
  const q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const budget = world.q.high ? 1 : 0.6;

  // one InstancedMesh per piece; instances gathered first
  const placeAll = (model, pieceIndex, list, opts = {}) => {
    const piece = model.pieces[pieceIndex];
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(opts.geometry || piece.geometry, opts.material || piece.material, list.length);
    list.forEach(([x, y, z, yaw, s, tiltX, tiltZ], i) => {
      e.set(tiltX || 0, yaw, tiltZ || 0, 'YXZ'); q.setFromEuler(e); pos.set(x, y, z); scl.set(s, s, s);
      mesh.setMatrixAt(i, m4.compose(pos, q, scl));
    });
    mesh.castShadow = opts.cast !== false; mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    group.add(mesh);
    if (model.spec.mossTop > 0) world.shootSources.push({ mesh, kind: 'scan', samples: piece.samples, cover: model.spec.mossTop });
    return mesh;
  };
  const span = (bb, axis) => bb.max[axis] - bb.min[axis];

  // logs: along the walls, long axis (the scan's x) parallel to the wall
  for (const model of byKind.log || []) {
    const piece = model.pieces[0], bb = piece.geometry.boundingBox;
    const n = Math.min(60, Math.round(spots.length * 0.045 * loc.props.logs * budget));
    const list = [];
    for (let i = 0; i < n; i++) {
      const spot = pick(rng, spots), [, , dx, dy] = spot;
      const s = model.spec.scale[0] + rng() * (model.spec.scale[1] - model.spec.scale[0]);
      const r = span(bb, 'z') * s / 2, len = span(bb, 'x') * s;
      if (len > c * 1.6 || r > c * 0.3) continue;
      const [px, pz] = besideWall(ctx, spot, r + 0.12 + rng() * 0.2, 0.5);
      const yaw = (dx ? Math.PI / 2 : 0) + (rng() - 0.5) * 0.2 + (rng() < 0.5 ? Math.PI : 0);
      const ax = Math.cos(yaw), az = -Math.sin(yaw);
      const circles = [];
      for (let t = -len / 2 + r; t <= len / 2 - r; t += Math.max(r, 0.3)) circles.push([px + ax * t, pz + az * t, r * 0.9]);
      if (!ctx.pass.place(circles)) continue;    // it would block the way
      const py = -bb.min.y * s * 0.6 + ctx.floorY(px, pz);
      list.push([px, py, pz, yaw, s]);
      e.set(0, yaw, 0, 'YXZ'); q.setFromEuler(e); pos.set(px, py, pz); scl.set(s, s, s);
      addSurface(ctx, piece, m4.compose(pos, q, scl));
      ctx.logTops.push({ x: px, z: pz, y: bb.max.y * s * 0.95, dirx: ax, dirz: az, half: len / 2 - r, r, scan: true });
    }
    placeAll(model, 0, list);
  }
  // stumps and root clusters: in corners, upright
  for (const model of byKind.stump || []) {
    const piece = model.pieces[0], bb = piece.geometry.boundingBox;
    const n = Math.min(24, Math.round(corners.length * 0.12 * budget));
    const list = [];
    for (let i = 0; i < n && corners.length; i++) {
      const [x, y, dx, dy] = corners.splice(Math.floor(rng() * corners.length), 1)[0];
      const s = model.spec.scale[0] + rng() * (model.spec.scale[1] - model.spec.scale[0]);
      const r = Math.max(span(bb, 'x'), span(bb, 'z')) * s / 2;
      if (r > c * 0.4) continue;
      const px = (x + 0.5) * c + dx * (c / 2 - r * 0.7), pz = (y + 0.5) * c + dy * (c / 2 - r * 0.7);
      if (!ctx.pass.place([[px, pz, Math.min(r * 0.75, c * 0.3)]])) continue;
      const py = -bb.min.y * s * 0.5 + ctx.floorY(px, pz), yaw = rng() * Math.PI * 2;
      list.push([px, py, pz, yaw, s]);
      e.set(0, yaw, 0, 'YXZ'); q.setFromEuler(e); pos.set(px, py, pz); scl.set(s, s, s);
      addSurface(ctx, piece, m4.compose(pos, q, scl));
    }
    model.pieces.forEach((p, pi) => placeAll(model, pi, list));   // a stump may be bark and a broken top
  }
  // the small scanned rocks (the moss-set chips, the pebble) keep the scan's shape but wear this place's rock under
  // its moss, projected in world space like the walls: their own photos are small and smooth (an orange river
  // pebble, chips of brown stone), and blown up to slabs on the moss they looked like nothing that grows there
  const rockMats = (byKind.stone || byKind.mossrocks || byKind.boulder) ? world.matPair({ ...kitSpec(loc, 'rock', 'stone'), mossScale: 0.75 }, { ...diff, mossCover: 0.42, fuzz: 0.8 }, 1, 2, loc.moss, 0, true) : null;   // rock showing, moss mostly on top
  // with a contact shadow toward the part sunk in the ground
  const rockGeo = (piece, bb) => withAO(piece.geometry.clone(), (x, y) => 0.45 + 0.55 * Math.min(1, Math.max(0, (y - bb.min.y) / Math.max(1e-6, span(bb, 'y')))));
  // boulders and mossy rock pieces: corners and wall bases
  for (const model of [...(byKind.boulder || []), ...(byKind.mossrocks || [])]) {
    const dens = loc.props.boulders * budget;
    model.pieces.forEach((piece, pi) => {
      const bb = piece.geometry.boundingBox;
      const n = Math.min(40, Math.round((corners.length * 0.1 + spots.length * 0.015) * dens / model.pieces.length * (model.spec.kind === 'boulder' ? 1 : 2.5)));
      const list = [];
      for (let i = 0; i < n; i++) {
        const s = model.spec.scale[0] + rng() * (model.spec.scale[1] - model.spec.scale[0]);
        const r = Math.max(span(bb, 'x'), span(bb, 'z')) * s / 2;
        if (r > c * 0.36) continue;   // never something that fills the corridor
        let px, pz;
        if (corners.length && rng() < 0.5) { const [x, y, dx, dy] = corners.splice(Math.floor(rng() * corners.length), 1)[0]; px = (x + 0.5) * c + dx * (c / 2 - r * 0.6); pz = (y + 0.5) * c + dy * (c / 2 - r * 0.6); }
        else { [px, pz] = besideWall(ctx, pick(rng, spots), r * 0.45, rng()); }
        if (!ctx.pass.place([[px, pz, r * 0.8]])) continue;
        const cx = (bb.min.x + bb.max.x) / 2 * s, cz = (bb.min.z + bb.max.z) / 2 * s;
        const yaw = rng() * Math.PI * 2, py = -bb.min.y * s * 0.65 + ctx.floorY(px, pz);
        list.push([px - cx, py, pz - cz, yaw, s]);
        // its top is a surface things can root on (the seedling among the finds)
        if (model.spec.kind === 'boulder') { e.set(0, yaw, 0, 'YXZ'); q.setFromEuler(e); pos.set(px - cx, py, pz - cz); scl.set(s, s, s); addSurface(ctx, piece, m4.compose(pos, q, scl)); }
      }
      placeAll(model, pi, list, { geometry: rockGeo(piece, bb), material: rockMats.solid });   // boulders too: the scan's photo is an orange sandstone
    });
  }
  // stones (dressed as the rocks above) and moss clumps: low, no collision
  for (const model of [...(byKind.stone || []), ...(byKind.mossclump || [])]) {
    model.pieces.forEach((piece, pi) => {
      const bb = piece.geometry.boundingBox;
      const stoneGeo = model.spec.kind === 'stone' && !model.spec.own ? rockGeo(piece, bb) : null;
      const n = Math.min(120, Math.round(spots.length * (model.spec.kind === 'stone' ? 0.08 : 0.12) * budget / model.pieces.length));
      const list = [];
      for (let i = 0; i < n; i++) {
        const s = model.spec.scale[0] + rng() * (model.spec.scale[1] - model.spec.scale[0]);
        let [px, pz] = besideWall(ctx, pick(rng, spots), 0.1 + rng() * 0.5, rng());
        let py;
        if (model.spec.kind === 'mossclump' && ctx.logTops.length && rng() < 0.3) {
          const L = pick(rng, ctx.logTops); const t = (rng() - 0.5) * 2 * L.half;
          px = L.x + L.dirx * t; pz = L.z + L.dirz * t;
          const hit = L.scan ? surfaceAt(ctx, px, pz, true) : [L.y, 0, 1, 0];
          if (!hit || hit[2] < 0.6) continue;
          py = hit[0] - bb.min.y * s * 0.3 - 0.03;
        } else {
          if (ctx.pass.inside(px, pz, 0.05)) continue;
          py = -bb.min.y * s * 0.7 + ctx.floorY(px, pz);
        }
        const cx = (bb.min.x + bb.max.x) / 2 * s, cz = (bb.min.z + bb.max.z) / 2 * s;
        list.push([px - cx, py, pz - cz, rng() * Math.PI * 2, s]);
      }
      // a stone from an original set keeps its own rock (it was drawn for the place); a scan wears the place's
      placeAll(model, pi, list, model.spec.own ? { cast: true } : stoneGeo ? { cast: true, geometry: stoneGeo, material: rockMats.solid } : { cast: false });
    });
  }
  // roots: laid against the foot of a wall, half into it, draped over the carving (Yakushima's cedar roots over granite)
  for (const model of byKind.roots || []) {
    const dens = (loc.props.roots || 0) * budget;
    if (!dens) continue;
    model.pieces.forEach((piece, pi) => {
      const bb = piece.geometry.boundingBox;
      const n = Math.min(9, Math.round(spots.length * 0.03 * dens / model.pieces.length));
      const list = [];
      for (let i = 0; i < n; i++) {
        const s = model.spec.scale[0] + rng() * (model.spec.scale[1] - model.spec.scale[0]);
        const spot = pick(rng, spots), [, , dx, dy] = spot;
        const r = Math.min(span(bb, 'x'), span(bb, 'z')) * s / 2;
        // its centre on the wall face line, so half the roots are in the rock and the rest reach onto the floor
        const [px, pz] = besideWall(ctx, spot, -r * 0.35, rng());
        const reach = Math.max(span(bb, 'x'), span(bb, 'z')) * s / 2 - r * 0.35;
        if (reach > 0.12 && !ctx.pass.place([[px + dx * -0.0, pz + dy * -0.0, Math.min(reach * 0.5, c * 0.25)]])) continue;
        const cx = (bb.min.x + bb.max.x) / 2 * s, cz = (bb.min.z + bb.max.z) / 2 * s;
        list.push([px - cx, -bb.min.y * s * 0.85 + ctx.floorY(px, pz) - 0.05, pz - cz, rng() * Math.PI * 2, s]);
      }
      placeAll(model, pi, list);
    });
  }
  // ferns and shrubs: each piece is a plant, at the wall bases
  for (const model of byKind.plant || []) {
    const dens = (model.spec.fern || model.id === 'fern_02' ? loc.props.ferns : loc.props.plants) * budget;
    model.pieces.forEach((piece, pi) => {
      const bb = piece.geometry.boundingBox;
      const n = Math.min(80, Math.round(spots.length * 0.07 * dens / model.pieces.length));
      const list = [];
      for (let i = 0; i < n; i++) {
        const s = model.spec.scale[0] + rng() * (model.spec.scale[1] - model.spec.scale[0]);
        const [px, pz] = besideWall(ctx, pick(rng, spots), 0.25 + rng() * 0.45, rng());
        if (ctx.pass.inside(px, pz, 0.1)) continue;
        const cx = (bb.min.x + bb.max.x) / 2 * s, cz = (bb.min.z + bb.max.z) / 2 * s;
        list.push([px - cx, ctx.floorY(px, pz) - 0.02, pz - cz, rng() * Math.PI * 2, s]);
      }
      placeAll(model, pi, list, { cast: false });
    });
  }
  // trees: rising out of the wall cells; pendant moss hangs from their branches
  const pend = loc.mosses.filter(m => m.form === 'hanging');
  const hangKinds = pend.length && loc.hanging ? world.hangTex.slice(0, 3).map((tex, k) => makeCardMaterial({ map: tex, color: k === 1 ? 0xd8dcc0 : new THREE.Color(pend[0].color).multiplyScalar(0.9).getHex(), mode: 'hang', stiffness: 0.55, alphaTest: 0.4, emissive: 0x141c10, emissiveIntensity: 0.5 })) : [];
  world.materials.push(...hangKinds);
  const hangs = hangKinds.map(() => []);
  const treeCells = new Set();
  for (const model of byKind.tree || []) {
    // trees stand in wall tiles that have wall on at least two sides, so their root spread is mostly inside the bank
    const cells = wallCells.filter(([x, y]) => { let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (wallAt(x + dx, y + dy)) n++; return n >= 2 && !treeCells.has(x + ',' + y) && rng() < loc.trees * 0.09 * budget * (model.spec.share ?? 1); });
    for (const [x, y] of cells) treeCells.add(x + ',' + y);   // one trunk to a tile
    const lists = model.pieces.map(() => []);
    // the branch piece is the one with the widest spread high up; its samples give hang points
    let branchPiece = null, bestSpread = 0;
    for (const piece of model.pieces) { const bb = piece.geometry.boundingBox; const sp = (bb.max.x - bb.min.x) * (bb.max.z - bb.min.z); if (bb.max.y > 1.5 && sp > bestSpread && !piece.material.alphaTest) { bestSpread = sp; branchPiece = piece; } }
    // the trunk's lower surface, for the moss that grows on its shaded side: vertices of the wood pieces below head height
    const lowVerts = [];
    for (const piece of model.pieces) {
      if (piece.material.alphaTest) continue;
      const pa = piece.geometry.attributes.position, na = piece.geometry.attributes.normal;
      const stride = Math.max(1, Math.floor(pa.count / 1200));
      for (let i = 0; i < pa.count; i += stride) { const y = pa.getY(i); if (y > 0.05 && y * model.spec.scale[1] < 2.0 && Math.abs(na.getY(i)) < 0.5) lowVerts.push([pa.getX(i), y, pa.getZ(i), na.getX(i), na.getY(i), na.getZ(i)]); }
    }
    const sun = world.sunDir;
    for (const [x, y] of cells) {
      const s = model.spec.scale[0] + rng() * (model.spec.scale[1] - model.spec.scale[0]);
      const px = (x + 0.5) * c + (rng() - 0.5) * c * 0.3, pz = (y + 0.5) * c + (rng() - 0.5) * c * 0.3;
      const yaw = rng() * Math.PI * 2;
      // the foot sunk below the lowest ground around it, so the root flare rises out of the floor and never hangs over it
      let low = ctx.floorY(px, pz);
      for (let a = 0; a < 8; a++) low = Math.min(low, ctx.floorY(px + Math.cos(a * 0.785) * c * 0.9, pz + Math.sin(a * 0.785) * c * 0.9));
      const base = low - 0.3;
      lists.forEach(l => l.push([px, base, pz, yaw, s]));
      // moss patches on the shaded side of the foot, where the bark faces away from the sun and sits within reach of the ground damp
      if (lowVerts.length) {
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        let put = 0;
        for (let t = 0; t < 40 && put < 7; t++) {
          const v = lowVerts[Math.floor(rng() * lowVerts.length)];
          const wy = v[1] * s + base; if (wy < ctx.floorY(px, pz) + 0.05 || wy > ctx.floorY(px, pz) + 1.7) continue;
          const nx = v[3] * cy + v[5] * sy, nz = -v[3] * sy + v[5] * cy;
          if (nx * sun.x + nz * sun.z > -0.15) continue;   // the sunny side stays bare
          const wx = px + (v[0] * cy + v[2] * sy) * s, wz = pz + (-v[0] * sy + v[2] * cy) * s;
          if (!wallAt(Math.floor(wx / c), Math.floor(wz / c)) && ctx.pass.inside(wx, wz, 0)) continue;
          (ctx.trunkPatches = ctx.trunkPatches || []).push([wx - nx * 0.02, wy, wz - nz * 0.02, nx, v[4], nz]);
          put++;
        }
      }
      if (branchPiece && hangKinds.length) {
        const smp = branchPiece.samples, ns = smp.length / 6;
        const n = Math.round(loc.hanging * 10 * (model.spec.hang ?? 1));   // a maple carries far more than a conifer
        // only from the underside of a bough, out from the trunk: a sample on the trunk's side (or the top of a branch)
        // left a strip with nothing above it, floating against the bark
        for (let k = 0, tries = 0; k < n && tries < n * 12; tries++) {
          const j = Math.floor(rng() * ns);
          const ly = smp[j * 6 + 1];
          if (ly * s < H + 0.8) continue;
          const lx = smp[j * 6], lz = smp[j * 6 + 2], ny = smp[j * 6 + 4];
          if (ny > -0.35 || Math.hypot(lx, lz) * s < 0.45) continue;
          const wx = px + (lx * Math.cos(yaw) + lz * Math.sin(yaw)) * s, wz = pz + (-lx * Math.sin(yaw) + lz * Math.cos(yaw)) * s;
          // edge-on to the trunk, so it hangs along the bough rather than out past it, and no wider than a bough's moss
          const along = Math.atan2(wx - px, wz - pz);
          hangs[Math.floor(rng() * hangKinds.length)].push([wx, ly * s + base + 0.02, wz, along + Math.PI / 2 + (rng() - 0.5) * 0.4, 0.14 + rng() * 0.22, 0.4 + rng() * 1.2]);
          k++;
        }
      }
    }
    model.pieces.forEach((piece, pi) => placeAll(model, pi, lists[pi]));
  }
  hangs.forEach((list, k) => {
    if (!list.length) return;
    const geo = hangClumpGeometry();
    const mesh = new THREE.InstancedMesh(geo, hangKinds[k], list.length);
    list.forEach(([x, y, z, yaw, w, h], i) => { e.set(0, yaw, 0); q.setFromEuler(e); pos.set(x, y, z); scl.set(w, h, w); mesh.setMatrixAt(i, m4.compose(pos, q, scl)); });
    mesh.receiveShadow = true; group.add(mesh);
  });
}


// ---------------------------------------------------------------- walls that are not carved rock

// a plain trunk along y, 1 unit tall and 1 unit across before scaling: a slight bow, bark bumps,
// `flare` widens the foot (a buttressed cypress at 1.6, a smooth laurel at 0.5)
function trunkGeometry(flare, height = 12, rs = 10, hs = 10) {
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, rs, hs, true);
  // pack the rings toward the foot so the flare has vertices to be a curve
  { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.5; p.setY(i, Math.pow(y, 2.2) - 0.5); } }
  geo.translate(0, 0.5, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ang = Math.atan2(z, x), r0 = Math.hypot(x, z);
    if (r0 < 1e-5) continue;
    const t = y;
    const flute = Math.min(1, flare) * 0.5;   // a big flare is a fluted buttress; a small one just swells
    const footZone = 1.5 / height;   // the flare's height as a share of the trunk
    const foot = 1 + flare * Math.pow(Math.max(0, 1 - t / footZone), 1.6) * (1 - flute * 0.5 + flute * Math.pow(Math.sin(ang * 2.5 + 1) * 0.5 + 0.5, 2));
    const taper = 1 - 0.35 * t;
    const bump = 1 + 0.06 * (noise3(Math.cos(ang) * 3 + 7, t * 40, Math.sin(ang) * 3) - 0.5);
    p.setXYZ(i, Math.cos(ang) * r0 * foot * taper * bump + Math.sin(t * 2.2) * 0.04, y, Math.sin(ang) * r0 * foot * taper * bump);
  }
  geo.computeVertexNormals();
  withAO(geo, (x, y) => Math.min(1, 0.45 + y * 4));
  return geo;
}

// Hoh: the walls are nurse logs, fallen giants stacked two or three high along every wall tile,
// their long axis along the wall, ends staggered across tiles, draped in moss by the material
export function buildLogWalls(ctx) {
  const { loc, rng, c, H, group, world, diff, cells, open, exposed, wallAt, floorY } = ctx;
  const spec = MATERIAL_SPECS[(loc.wall.logs && loc.wall.logs.material) || 'barkmoss'] || MATERIAL_SPECS.wood;
  const mats = world.matPair({ ...spec, scale: 0.9, mossScale: 1.0, baseTint: 0xbfae92, drape: 1 }, { ...diff, mossCover: Math.min(0.9, diff.mossCover + 0.15), fuzz: 1 }, 1, world.q.high ? 5 : 3, loc.moss, 0, false, true);
  const geo = nurseLogGeometry();
  const items = [];
  for (const [x, y] of cells) {
    if (!exposed(x, y)) continue;
    // the run this tile is part of: faces exposed to the north or south mean logs along x
    const alongX = open(x, y - 1) || open(x, y + 1) || !(open(x - 1, y) || open(x + 1, y));
    const cx = (x + 0.5) * c, cz = (y + 0.5) * c;
    let top = floorY(cx, cz) - 0.08;
    let k = 0;
    while (top < floorY(cx, cz) + H - 0.25 && k < 4) {
      const r = (k === 0 ? 0.47 : 0.3 + rng() * 0.12) * c * (0.92 + rng() * 0.08);
      const len = c * (1.0 + rng() * 0.4), shift = (rng() - 0.5) * c * 0.35;
      const off = (rng() - 0.5) * (c - 2 * r) * 0.8;   // where in the tile's width this log lies
      const px = alongX ? cx + shift : cx + off, pz = alongX ? cz + off : cz + shift;
      // the upper logs lie a little askew, as fallen trunks do; each is rolled a little and half of them end-for-end
      const yaw = (alongX ? Math.PI / 2 : 0) + (rng() - 0.5) * (k ? 0.2 : 0.1) + (rng() < 0.5 ? Math.PI : 0);
      items.push([px, top + r * 0.92, pz, yaw, r, len, (rng() - 0.5) * 0.06, false, (rng() - 0.5) * 0.7, 0.95 + rng() * 0.1]);
      top += r * 1.7;
      k++;
    }
    if (k) items[items.length - 1][7] = true;
  }
  if (!items.length) return;
  const mesh = instanced(geo, mats.solid, items.length);
  const qRoll = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
  items.forEach(([px, py, pz, yaw, r, len, tilt, topmost, roll, squash], i) => {
    // lay it down (x), turn it along the wall (y), and roll it about its own axis first so each log shows a different side
    E.set(Math.PI / 2 + tilt, yaw, 0, 'YXZ'); Q.setFromEuler(E);
    qRoll.setFromAxisAngle(yAxis, roll || 0); Q.multiply(qRoll);
    P.set(px, py, pz); S.set(r, len, r * (squash || 1));
    mesh.setMatrixAt(i, M4.compose(P, Q, S));
    // the top of the stack is a surface in the open (mushrooms, the slug); the bottom log's back is one where the stack leaves it bare
    // the cylinder's axis after the X-then-Y rotation runs along (sin yaw, 0, cos yaw)
    if (topmost || r > c * 0.4) ctx.logTops.push({ x: px, z: pz, y: py + r * (squash || 1) * 0.9, dirx: Math.sin(yaw), dirz: Math.cos(yaw), half: len / 2 - r * 0.5, r, top: !!topmost });
    // the log's side toward the corridor, at a height you can see: for what climbs the bark (the slug, the snails)
    if (py > 0.7 && py < 1.7) {
      const gx = Math.floor(px / c), gz = Math.floor(pz / c), alongX = Math.abs(Math.sin(yaw)) > 0.7;
      for (const [dx, dy] of alongX ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]) if (open(gx + dx, gz + dy)) (ctx.logSides = ctx.logSides || []).push({ x: px + dx * (r * 1.1 + 0.01), y: py, z: pz + dy * (r * 1.1 + 0.01), nx: dx, nz: dy, ax: Math.sin(yaw), az: Math.cos(yaw), half: len / 2 - r * 0.6 });
    }
  });
  group.add(mesh);
  world.shootSources.push({ mesh, kind: 'log', cover: 0.7 });
  // fuzz on the logs: a few shells
  const layers = world.q.high ? 4 : 2;
  for (let k = 0; k < layers; k++) {
    const fm = makeMossMaterial({ ...mats.opts, fuzz: true, shells: layers, shellIndex: k });
    const f = new THREE.InstancedMesh(geo, fm, items.length);
    f.instanceMatrix = mesh.instanceMatrix; f.receiveShadow = true; f.castShadow = false;
    world.materials.push(fm); group.add(f);
  }
}

// Fanal and Congaree: no built walls; the wall tiles carry a palisade of standing trunks on a low
// bank, packed so there is no way between them. Where a trunk reaches past its tile into the
// corridor it goes through the guard and gets collision. Cypress adds knees in clusters at the
// trunk feet and Spanish moss hanging from every branch height.
export function buildTrunkWalls(ctx) {
  const { loc, rng, c, H, group, world, diff, cells, exposed, open, wallAt, floorY, maze } = ctx;
  const T = loc.wall.trunk;
  const spec = MATERIAL_SPECS[T.material] || MATERIAL_SPECS.wood;
  const mats = world.matPair({ ...spec, scale: 0.9, mossScale: 1.0, baseTint: T.tint || spec.baseTint }, { ...diff, mossCover: 0.3, fuzz: 0.6 }, 1, world.q.high ? 3 : 2, loc.moss, 0, false, true);
  const geo = trunkGeometry(T.flare || 0.6, T.height || 12);
  const items = [], circles = [];
  const per = T.per || 3, [r0, r1] = T.radius || [0.25, 0.4];
  // the palisade's budget: the grid grows with the level, the trunk count does not
  const seenTiles = cells.filter(([x, y]) => exposed(x, y) || [[1, 1], [1, -1], [-1, 1], [-1, -1]].some(([dx, dy]) => open(x + dx, y + dy))).length;
  const perHere = Math.max(2, Math.min(per, Math.floor(2600 / Math.max(1, seenTiles))));
  const protectedSet = new Set((maze.protect || []).map(([x, y]) => `${x},${y}`));
  for (const [x, y] of cells) {
    // interior wall tiles (no open neighbour, none diagonal) are never seen: skip them
    let seen = exposed(x, y);
    if (!seen) for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (open(x + dx, y + dy)) seen = true;
    if (!seen) continue;
    const n = perHere + (rng() < 0.3 && perHere < 4 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const r = r0 + rng() * (r1 - r0);
      // a grid of n spots across the tile with jitter, so the palisade has no gaps you could see through
      const u = n <= 2 ? (k + 0.5) / n : ((k % 2) + 0.5) / 2, v = n <= 2 ? 0.5 : (Math.floor(k / 2) % 2 + 0.5) / 2;
      let px = (x + u) * c + (rng() - 0.5) * c * 0.35, pz = (y + v) * c + (rng() - 0.5) * c * 0.35;
      // a trunk that reaches past its tile: only where the way stays open; otherwise pulled back inside
      const over = Math.max(0, r - Math.min(px - x * c, (x + 1) * c - px, pz - y * c, (y + 1) * c - pz));
      if (over > 0.02) {
        let nearOpen = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (open(x + dx, y + dy) && !protectedSet.has(`${x + dx},${y + dy}`)) nearOpen = true;
        if (nearOpen && ctx.pass.place([[px, pz, r * 0.85]])) { /* accepted: the guard recorded the circle */ }
        else {
          px = Math.min((x + 1) * c - r, Math.max(x * c + r, px)); pz = Math.min((y + 1) * c - r, Math.max(y * c + r, pz));
        }
      }
      const h = (T.height || 12) * (0.8 + rng() * 0.4);
      const lean = (T.lean || 0.05);
      let low = floorY(px, pz);
      const reach = r * (1 + (T.flare || 0.6)) * 1.1;
      for (let a = 0; a < 8; a++) low = Math.min(low, floorY(px + Math.cos(a * 0.785) * reach, pz + Math.sin(a * 0.785) * reach));
      items.push([px, low - 0.12, pz, rng() * Math.PI * 2, r * 2, h, (rng() - 0.5) * lean, (rng() - 0.5) * lean]);
    }
  }
  if (!items.length) return;
  const mesh = instanced(geo, mats.solid, items.length);
  items.forEach(([px, py, pz, yaw, d, h, tx, tz], i) => {
    E.set(tx, yaw, tz, 'YXZ'); Q.setFromEuler(E);
    P.set(px, py, pz); S.set(d, h, d);
    mesh.setMatrixAt(i, M4.compose(P, Q, S));
  });
  group.add(mesh);
  world.shootSources.push({ mesh, kind: 'lump', cover: 0.25 });

  // cypress knees: woody cones in clusters around the trunk feet, some stepping into the open where the way allows
  if (T.knees) {
    const kg = lumpGeometry(4.2, 1.0, 0.5, 10);
    { const p = kg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const t = (y + 1) / 2; const w = 0.45 + 0.55 * (1 - t); p.setX(i, p.getX(i) * w); p.setZ(i, p.getZ(i) * w); p.setY(i, t * 1.1 - 0.1); } kg.computeVertexNormals(); }
    withAO(kg, (x, y) => Math.min(1, 0.5 + y * 0.6));
    const knees = [];
    for (const [px, , pz, , d] of items) {
      if (knees.length > 1400 || rng() > T.knees * 0.45) continue;
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const a = rng() * Math.PI * 2, dist = d * 0.5 + 0.2 + rng() * 0.6, r = 0.06 + rng() * 0.09, h = 0.18 + Math.pow(rng(), 1.5) * 0.6;
        const kx = px + Math.cos(a) * dist, kz = pz + Math.sin(a) * dist;
        const gx = Math.floor(kx / c), gz = Math.floor(kz / c);
        if (!wallAt(gx, gz) && !ctx.pass.place([[kx, kz, r]])) continue;
        knees.push([kx, floorY(kx, kz) - 0.02, kz, r, h]);
      }
    }
    if (knees.length) {
      const km = instanced(kg, mats.solid, knees.length);
      knees.forEach(([kx, ky, kz, r, h], i) => { E.set((rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3); Q.setFromEuler(E); P.set(kx, ky, kz); S.set(r, h, r); km.setMatrixAt(i, M4.compose(P, Q, S)); });
      group.add(km);
      world.shootSources.push({ mesh: km, kind: 'lump', cover: 0.4 });
    }
  }

  // Spanish moss (Tillandsia: a bromeliad, not a moss): pale festoons from the trunks' branch heights, long and loose
  if (T.spanish) {
    const tex = world.texCache.spanish || (world.texCache.spanish = spanishMossTexture());
    const mat = makeCardMaterial({ map: tex, color: 0xc4ccbc, mode: 'hang', stiffness: 0.7, alphaTest: 0.4, emissive: 0x1a1e1a, emissiveIntensity: 0.35 });
    world.materials.push(mat);
    const list = [];
    for (const [px, py, pz, , d, h] of items) {
      if (list.length > 2800) break;
      const n = Math.round(T.spanish * (0.6 + rng() * 1.8));
      for (let k = 0; k < n; k++) {
        const a = rng() * Math.PI * 2, out = d * 0.5 + 0.2 + rng() * 0.9, top = py + 2.6 + rng() * Math.min(h - 3, 6);
        list.push([px + Math.cos(a) * out, top, pz + Math.sin(a) * out, rng() * Math.PI, 0.18 + rng() * 0.35, 1.0 + rng() * 2.6]);
      }
    }
    const geo2 = hangClumpGeometry(8);
    const sm = new THREE.InstancedMesh(geo2, mat, list.length);
    list.forEach(([x, y, z, yaw, w, hh], i) => { E.set(0, yaw, 0); Q.setFromEuler(E); P.set(x, y, z); S.set(w, hh, w); sm.setMatrixAt(i, M4.compose(P, Q, S)); });
    sm.castShadow = true; sm.receiveShadow = true;
    group.add(sm);
  }
  // the place's own pendant mosses, from the lower trunks
  const pend = loc.mosses.filter(m => m.form === 'hanging' && !m.notMoss);
  if (pend.length && loc.hanging) {
    const mat = makeCardMaterial({ map: world.hangTex[0], color: new THREE.Color(pend[0].color).multiplyScalar(0.9).getHex(), mode: 'hang', stiffness: 0.5, alphaTest: 0.4, emissive: 0x141c10, emissiveIntensity: 0.5 });
    world.materials.push(mat);
    const list = [];
    for (const [px, py, pz, , d] of items) {
      if (rng() > loc.hanging * 0.5) continue;
      const a = rng() * Math.PI * 2, out = d * 0.5 + 0.05;
      list.push([px + Math.cos(a) * out, py + 1.4 + rng() * 1.6, pz + Math.sin(a) * out, a + Math.PI / 2, 0.25 + rng() * 0.4, 0.4 + rng() * 1.0]);
    }
    if (list.length) {
      const geo3 = hangClumpGeometry();
      const hm = new THREE.InstancedMesh(geo3, mat, list.length);
      list.forEach(([x, y, z, yaw, w, hh], i) => { E.set(0, yaw, 0); Q.setFromEuler(E); P.set(x, y, z); S.set(w, hh, w); hm.setMatrixAt(i, M4.compose(P, Q, S)); });
      hm.receiveShadow = true; group.add(hm);
    }
  }
}

// a still water level over the whole maze: it shows wherever the ground dips below it
// (the blackwater channels of a swamp, the standing water on a tunnel floor)
export function buildWater(ctx) {
  const { loc, c, maze, group, world } = ctx;
  if (!loc.water) return;
  const pad = 4 * c, L = maze.W * c + 2 * pad, Lz = maze.H * c + 2 * pad;
  const geo = new THREE.PlaneGeometry(L, Lz, 1, 1); geo.rotateX(-Math.PI / 2);
  const mat = waterMaterial(world.fogColor, world.sunDir, loc.water.color);
  world.materials.push(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(maze.W * c / 2, loc.water.level, maze.H * c / 2);
  mesh.renderOrder = 2;
  group.add(mesh);
  world.waters.push(mat);
}
