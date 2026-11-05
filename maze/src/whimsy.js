// Small true things: a snail creeping along a wall now and then, its trail
// glinting behind it; frogs at the water's edge that hop off the path when you
// come close and settle once you have passed; the animal of the place (a
// 3D model, see animals.js) far off in the fog, gone when it notices you; and the one hidden
// find of every place for the field drawings (a cedar seedling on a nurse log,
// a mason's mark on a brick, a cypress knee shaped like a chair). Everything
// here is a single instanced mesh or two, placed through the walkability guard,
// standing on world.floorY, and animated for a few instances a frame at most.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { canvasTexture, lumpGeometry, withAO, disp } from './geometry.js?v=d4fe5800';
import { WALL } from './maze.js?v=28138280';
import { noise3 } from './noise.js?v=a407dfed';
import { makeCardMaterial } from './wind.js?v=25d38805';
import { surfaceAt } from './props.js?v=a5e3aefe';
import { FINDS } from './finds.js?v=dce826cd';
import { buildAnimal, updateAnimal } from './animals.js?v=dd7eb467';
import { buildCast, updateCast } from './cast.js?v=0e9c169b';

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// merge geometries, carrying uv, normal and a per-vertex colour for each part
function merge(parts) {
  const pos = [], nor = [], uv = [], col = [], idx = []; let base = 0;
  for (const { geo, color, uvOff = [0, 0], uvScale = [1, 1] } of parts) {
    const p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv;
    const c = new THREE.Color(color);
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i));
      uv.push(uvOff[0] + (u ? u.getX(i) : 0) * uvScale[0], uvOff[1] + (u ? u.getY(i) : 0) * uvScale[1]);
      col.push(c.r, c.g, c.b);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) idx.push(geo.index.getX(i) + base);
    else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------- the snail

// a coiled shell: a tube along a logarithmic spiral, the whorls overlapping, a slight cone. Its uv.y runs 0.5..1 of the atlas
function shellGeometry() {
  const turns = 2.7, nu = 84, nv = 10, b = 0.17;
  const umax = turns * Math.PI * 2;
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    const u = i / nu * umax, e = Math.exp(b * (u - umax));
    const R = 0.5 * e, r = 0.33 * e + 0.004, h = -0.42 * e + 0.42;
    const n1 = [Math.cos(u), Math.sin(u), 0], n2 = [0, 0, 1];
    for (let j = 0; j <= nv; j++) {
      const v = j / nv * Math.PI * 2, cv = Math.cos(v), sv = Math.sin(v);
      const nx = cv * n1[0] + sv * n2[0], ny = cv * n1[1] + sv * n2[1], nz = cv * n1[2] + sv * n2[2];
      pos.push(R * n1[0] + r * nx, R * n1[1] + r * ny, h + r * nz); nor.push(nx, ny, nz);
      uv.push(u / umax * 7, 0.5 + 0.5 * (j / nv));
    }
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, bq = a + nv + 1;
    idx.push(a, bq, a + 1, bq, bq + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// the body: a foot along +x, a head rising at the front, two tentacles with eyes at their tips. Its uv.y runs 0..0.5
function snailGeometry() {
  const foot = new THREE.SphereGeometry(0.5, 16, 10);
  { const p = foot.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const t = (x + 0.5); const w = 0.5 + 0.5 * Math.sin(t * Math.PI) * 0.9 + 0.1; p.setXYZ(i, x * 2.2 + 0.15, Math.max(y, -0.05) * 0.42 * w + (x > 0.2 ? (x - 0.2) * 0.45 : 0), z * 0.55 * w); } foot.computeVertexNormals(); }
  const parts = [{ geo: foot, color: 0xb9a98c, uvScale: [1, 0.5] }];
  for (const side of [-1, 1]) {
    const t = new THREE.CylinderGeometry(0.02, 0.045, 0.5, 6, 1);
    t.translate(0, 0.25, 0); t.rotateZ(-0.9); t.rotateY(side * 0.5); t.translate(1.0, 0.38, side * 0.09);
    parts.push({ geo: t, color: 0xaa9a7c, uvScale: [1, 0.5] });
    const eye = new THREE.SphereGeometry(0.045, 6, 5); eye.translate(1.0 + Math.cos(0.9) * 0.5 * Math.cos(0.5), 0.38 + Math.sin(0.9) * 0.5, side * (0.09 + Math.sin(0.5) * 0.5 * 0.5));
    parts.push({ geo: eye, color: 0x3a3028, uvScale: [1, 0.5] });
  }
  const shell = shellGeometry();
  shell.rotateX(Math.PI / 2 - 0.35); shell.rotateY(-0.5); shell.scale(0.85, 0.85, 0.85); shell.translate(-0.05, 0.42, 0);
  parts.push({ geo: shell, color: 0xffffff });
  const g = merge(parts);
  withAO(g, () => 1);
  return g;
}
// the atlas: a mottled grey-olive skin in the lower half, brown growth bands over a horn ground in the upper half
function snailTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(150,140,118)'; ctx.fillRect(0, h / 2, w, h / 2);
    for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(${rnd(60, 110)},${rnd(60, 100)},${rnd(45, 80)},${rnd(0.15, 0.5)})`; ctx.beginPath(); ctx.arc(Math.random() * w, h / 2 + Math.random() * h / 2, rnd(1, 4), 0, Math.PI * 2); ctx.fill(); }
    const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgb(150,108,62)'); g.addColorStop(1, 'rgb(196,160,110)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h / 2);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(${rnd(60, 90)},${rnd(35, 55)},${rnd(20, 35)},${rnd(0.5, 0.85)})`; const y = rnd(0.08, 0.42) * h; ctx.fillRect(0, y, w, rnd(3, 9)); }
    for (let i = 0; i < 70; i++) { ctx.strokeStyle = `rgba(80,55,30,${rnd(0.1, 0.35)})`; ctx.lineWidth = rnd(0.5, 1.5); const x = Math.random() * w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + rnd(-2, 2), h / 2); ctx.stroke(); }
  });
}

// ---------------------------------------------------------------- the frog

function frogGeometry() {
  const body = new THREE.SphereGeometry(0.5, 14, 10);
  { const p = body.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x * 0.95, (y > 0 ? y * 0.62 : y * 0.3) + 0.15, z * 1.25 + (y > 0.2 ? 0.1 : 0)); } body.computeVertexNormals(); }
  const parts = [{ geo: body, color: 0x75683c }];
  for (const side of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.16, 8, 6); eye.translate(side * 0.27, 0.5, 0.42);
    parts.push({ geo: eye, color: 0x8c7a3c });
    const leg = new THREE.SphereGeometry(0.3, 8, 6); leg.scale(0.55, 0.4, 0.95); leg.translate(side * 0.52, 0.08, -0.25);
    parts.push({ geo: leg, color: 0x5e5632 });
    const foot = new THREE.SphereGeometry(0.2, 6, 5); foot.scale(0.5, 0.25, 1.1); foot.translate(side * 0.58, 0.0, 0.28);
    parts.push({ geo: foot, color: 0x4a5430 });
  }
  const g = merge(parts); withAO(g, (x, y) => Math.min(1, 0.5 + y)); return g;
}
function frogTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(205,205,205)'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(${rnd(40, 90)},${rnd(50, 80)},${rnd(30, 50)},${rnd(0.2, 0.6)})`; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, rnd(1.5, 5), 0, Math.PI * 2); ctx.fill(); }
  });
}

// ---------------------------------------------------------------- the finds

// one small built thing per place, where its drawing says it is; returns {mesh, pos, radius} or null
function buildFind(ctx, kit) {
  const { loc, rng, c, H, group, world, floorY, openCells, maze } = ctx;
  const find = FINDS[loc.id]; if (!find) return null;
  const spots = ctx.spots;
  const far = ([x, y]) => Math.abs(x - maze.start.x) + Math.abs(y - maze.start.y) > 4;
  let mesh = null, pos = null, radius = 0.5, normal = null;
  const tryWall = () => { for (let t = 0; t < 40; t++) { const sp = pick(rng, spots); if (far(sp)) return sp; } return null; };
  const wallPoint = (sp, off, along, hy) => {
    const [x, y, dx, dy] = sp;
    let px = (x + 0.5) * c + dx * (c / 2 - off) + (dy ? (along - 0.5) * c * 0.8 : 0);
    let pz = (y + 0.5) * c + dy * (c / 2 - off) + (dx ? (along - 0.5) * c * 0.8 : 0);
    const d = disp(px, hy, pz, H); px += d[0]; pz += d[2];
    return [px, pz, dx, dy];
  };
  switch (find.kind) {
    case 'seedling': {
      // a cedar seedling rooted on an old root or a fallen trunk: three crossed cards with a drawn sprig, on the scanned surface
      const sx0 = (maze.start.x + 0.5) * c, sz0 = (maze.start.y + 0.5) * c;
      let L = null;
      const surfs = (ctx.surfaces || []).filter(sf => Math.hypot((sf.bounds.min.x + sf.bounds.max.x) / 2 - sx0, (sf.bounds.min.z + sf.bounds.max.z) / 2 - sz0) > 5 * c);
      for (let t = 0; t < 12 && surfs.length && !L; t++) {
        const sf = pick(rng, surfs), bb = sf.bounds;
        const x = bb.min.x + (0.3 + rng() * 0.4) * (bb.max.x - bb.min.x), z = bb.min.z + (0.3 + rng() * 0.4) * (bb.max.z - bb.min.z);
        const hit = surfaceAt(ctx, x, z, true);
        if (hit && hit[2] > 0.6 && hit[0] - floorY(x, z) > 0.12) L = { x, z, y: hit[0], dirx: 1, dirz: 0, half: 0 };
      }
      if (!L) { const logs = ctx.logTops.filter(l => Math.hypot(l.x - sx0, l.z - sz0) > 5 * c); if (logs.length) L = pick(rng, logs); }
      if (!L) return null;
      const tex = canvasTexture(128, 128, (cx, w, h) => {
        cx.clearRect(0, 0, w, h); cx.strokeStyle = 'rgb(110,78,50)'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(64, 126); cx.lineTo(62, 50); cx.stroke();
        for (let i = 0; i < 40; i++) { const y = 50 + Math.random() * 70, s = Math.random() < 0.5 ? -1 : 1, l = rnd(10, 24); cx.strokeStyle = `rgb(${rnd(60, 90)},${rnd(110, 150)},${rnd(50, 80)})`; cx.lineWidth = rnd(1.5, 2.5); cx.beginPath(); cx.moveTo(63, y); cx.lineTo(63 + s * l, y - l * 0.6); cx.stroke(); }
        for (let i = 0; i < 12; i++) { const a = rnd(-0.5, 0.5), l = rnd(12, 22); cx.strokeStyle = 'rgb(90,140,70)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(62, 50); cx.lineTo(62 + Math.sin(a) * l, 50 - Math.cos(a) * l); cx.stroke(); }
      }, true, true);
      const mat = makeCardMaterial({ map: tex, color: 0xffffff, mode: 'up', stiffness: 0.3, alphaTest: 0.45 });
      world.materials.push(mat);
      const g = new THREE.BufferGeometry();
      const p = [], u = [], n = [];
      for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3, ax = Math.cos(a), az = Math.sin(a); for (const [s, y] of [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 0], [0.5, 1], [-0.5, 1]]) { p.push(s * ax, y, s * az); u.push(s + 0.5, y); n.push(-az, 0, ax); } }
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
      const t = (rng() - 0.5) * L.half;
      const x = L.x + L.dirx * t, z = L.z + L.dirz * t;
      mesh = new THREE.Mesh(g, mat); mesh.position.set(x, L.y - 0.02, z); mesh.scale.set(0.34, 0.42, 0.34); mesh.rotation.y = rng() * 6;
      pos = mesh.position.clone(); radius = 0.5; break;
    }
    case 'rootarch': {
      // a hemlock root looped out of the lava and back in, like a handle, at the foot of a wall
      const sp = tryWall(); if (!sp) return null;
      const [px, pz, dx, dy] = wallPoint(sp, 0.22, rng(), 0.1);
      const y0 = floorY(px, pz);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.22, -0.06, 0), new THREE.Vector3(-0.14, 0.12, 0.02), new THREE.Vector3(0, 0.2, 0.04), new THREE.Vector3(0.14, 0.12, 0.02), new THREE.Vector3(0.22, -0.06, 0)]);
      const g = new THREE.TubeGeometry(curve, 16, 0.035, 8, false);
      withAO(g, () => 0.9);
      mesh = new THREE.Mesh(g, kit.bark); mesh.position.set(px, y0, pz); mesh.rotation.y = dx ? Math.PI / 2 : 0;
      pos = mesh.position.clone(); radius = 0.5; break;
    }
    case 'slug': {
      // a banana slug on a nurse log: a stretched yellow lump with a darker mantle, climbing the corridor side of a log
      // at eye height where the walls are stacked logs, else on a log top
      const g = lumpGeometry(2.2, 0.5, 0.25, 14); g.scale(1.7, 0.45, 0.5);
      { const p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) * 0.15); g.computeVertexNormals(); }
      const tex = canvasTexture(64, 64, (cx, w, h) => { cx.fillStyle = 'rgb(214,178,58)'; cx.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { cx.fillStyle = `rgba(60,45,20,${rnd(0.3, 0.7)})`; cx.beginPath(); cx.arc(Math.random() * w, Math.random() * h, rnd(1, 3), 0, 6.3); cx.fill(); } });
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, color: 0xffffff }); world.materials.push(mat);
      const farEnough = (x, z) => Math.hypot(x - (maze.start.x + 0.5) * c, z - (maze.start.y + 0.5) * c) > 5 * c;
      const sides = (ctx.logSides || []).filter(l => farEnough(l.x, l.z));
      if (sides.length) {
        const L = pick(rng, sides), t = (rng() - 0.5) * L.half;
        mesh = new THREE.Mesh(g, mat); mesh.position.set(L.x + L.ax * t, L.y, L.z + L.az * t); mesh.scale.set(0.09, 0.09, 0.09);
        // flat against the bark, head up: the lump's up becomes the log's outward normal, its length runs up the log
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(L.nx, 0, L.nz));
        mesh.rotateY(Math.PI / 2 + 0.3);
        pos = mesh.position.clone(); radius = 0.5; normal = [L.nx, L.nz]; break;
      }
      const logs = ctx.logTops.filter(l => farEnough(l.x, l.z));
      if (!logs.length) return null;
      const L = pick(rng, logs);
      const t = (rng() - 0.5) * L.half;
      mesh = new THREE.Mesh(g, mat); mesh.position.set(L.x + L.dirx * t, L.y - 0.01, L.z + L.dirz * t); mesh.scale.set(0.09, 0.09, 0.09); mesh.rotation.y = Math.atan2(L.dirz, L.dirx) + 0.4;
      pos = mesh.position.clone(); radius = 0.45; break;
    }
    case 'masonmark': {
      // a mason's mark cut into one brick, at shoulder height
      const sp = tryWall(); if (!sp) return null;
      const [px, pz, dx, dy] = wallPoint(sp, -0.004, 0.3 + rng() * 0.4, 1.35);
      // the groove: a dark shadow edge above, the pale cut brick inside, so it reads on bare brick and through the moss alike
      const tex = canvasTexture(128, 128, (cx, w, h) => {
        cx.clearRect(0, 0, w, h); cx.lineCap = 'square'; cx.lineJoin = 'miter';
        const pts = [[30, 96], [52, 30], [64, 70], [76, 30], [98, 96]];
        const draw = () => { cx.beginPath(); cx.moveTo(...pts[0]); for (const p of pts.slice(1)) cx.lineTo(...p); cx.stroke(); cx.beginPath(); cx.moveTo(64, 70); cx.lineTo(64, 112); cx.stroke(); };
        cx.strokeStyle = 'rgba(20,14,10,0.95)'; cx.lineWidth = 9; draw();
        cx.save(); cx.translate(1.5, 3); cx.strokeStyle = 'rgba(214,186,150,0.95)'; cx.lineWidth = 4.5; draw(); cx.restore();
      }, true, true);
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); world.materials.push(mat);
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), mat);
      mesh.position.set(px - dx * 0.006, 1.35 + floorY(px, pz), pz - dy * 0.006);
      mesh.rotation.y = dx ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : (dy > 0 ? 0 : Math.PI);
      mesh.rotation.y += Math.PI;   // the plane faces +z; the wall's normal points into the corridor
      pos = mesh.position.clone(); radius = 0.55; normal = [-dx, -dy]; break;
    }
    case 'feather': {
      // a raven's feather caught in the moss at a boulder's foot
      const sp = tryWall(); if (!sp) return null;
      const [px, pz] = wallPoint(sp, 0.3 + rng() * 0.2, rng(), 0.05);
      const tex = canvasTexture(128, 256, (cx, w, h) => {
        cx.clearRect(0, 0, w, h);
        cx.fillStyle = 'rgb(28,26,30)'; cx.beginPath(); cx.moveTo(64, 10); cx.quadraticCurveTo(100, 90, 72, 240); cx.quadraticCurveTo(60, 250, 50, 240); cx.quadraticCurveTo(28, 110, 64, 10); cx.fill();
        cx.strokeStyle = 'rgba(90,90,100,0.6)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(64, 14); cx.lineTo(62, 246); cx.stroke();
        for (let y = 40; y < 230; y += 6) { cx.strokeStyle = `rgba(70,70,80,${rnd(0.2, 0.5)})`; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(63, y); cx.lineTo(63 + rnd(16, 30), y - 10); cx.moveTo(63, y); cx.lineTo(63 - rnd(14, 26), y - 8); cx.stroke(); }
      }, true, true);
      const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 }); world.materials.push(mat);
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.2), mat);
      mesh.position.set(px, floorY(px, pz) + 0.035, pz); mesh.rotation.set(-Math.PI / 2 + 0.25, 0, rng() * 6, 'YXZ');
      pos = mesh.position.clone(); radius = 0.5; break;
    }
    case 'cowbell': {
      // a cowbell dropped in the grass, its strap rotted
      const sp = tryWall(); if (!sp) return null;
      const [px, pz] = wallPoint(sp, 0.35 + rng() * 0.2, rng(), 0.05);
      const prof = [new THREE.Vector2(0, 0), new THREE.Vector2(0.4, 0), new THREE.Vector2(0.5, 0.55), new THREE.Vector2(0.42, 0.95), new THREE.Vector2(0.1, 1.0), new THREE.Vector2(0.1, 1.15), new THREE.Vector2(0.18, 1.18), new THREE.Vector2(0.18, 1.0), new THREE.Vector2(0, 1.0)];
      const g = new THREE.LatheGeometry(prof, 12); g.scale(0.07, 0.07, 0.055); withAO(g, () => 0.9);
      const mat = new THREE.MeshStandardMaterial({ color: 0x7a5a33, metalness: 0.7, roughness: 0.45 }); world.materials.push(mat);
      mesh = new THREE.Mesh(g, mat); mesh.position.set(px, floorY(px, pz) + 0.03, pz); mesh.rotation.set(Math.PI / 2 - 0.3, rng() * 6, 0.4);
      pos = mesh.position.clone(); radius = 0.5; break;
    }
    case 'ironpin': {
      // an iron ring on a pin, left in the rock by the miners, rusted
      const sp = tryWall(); if (!sp) return null;
      const [px, pz, dx, dy] = wallPoint(sp, 0.02, 0.3 + rng() * 0.4, 1.0);
      const ring = new THREE.TorusGeometry(0.045, 0.009, 7, 18); ring.rotateY(Math.PI / 2);
      const pin = new THREE.CylinderGeometry(0.012, 0.014, 0.12, 8); pin.rotateX(Math.PI / 2); pin.translate(0, 0, -0.05);
      const g = merge([{ geo: ring, color: 0x6a3f28 }, { geo: pin, color: 0x5a3a2a }]); withAO(g, () => 0.9);
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.75 }); world.materials.push(mat);
      mesh = new THREE.Mesh(g, mat); mesh.position.set(px + dx * 0.01, 1.0 + floorY(px, pz), pz + dy * 0.01);
      mesh.lookAt(px + dx, 1.0 + floorY(px, pz), pz + dy); mesh.rotateY(Math.PI);
      pos = mesh.position.clone(); radius = 0.55; break;
    }
    case 'kneechair': {
      // a cypress knee grown into a chair: a seat and a back, bark over both, at a trunk's foot
      const spot = (() => { for (let t = 0; t < 60; t++) { const [x, y] = pick(rng, openCells); if (!far([x, y])) continue; const px = (x + rng()) * c, pz = (y + rng()) * c; if (ctx.distToWall(px, pz) < 0.5 && !ctx.pass.inside(px, pz, 0.1) && ctx.pass.place([[px, pz, 0.22]])) return [px, pz]; } return null; })();
      if (!spot) return null;
      const [px, pz] = spot;
      const seat = lumpGeometry(7.7, 0.6, 0.3, 14); seat.scale(0.22, 0.2, 0.2); seat.translate(0, 0.22, 0);
      const back = lumpGeometry(3.1, 1.0, 0.3, 12); back.scale(0.1, 0.34, 0.2); back.translate(-0.13, 0.5, 0);
      const leg = lumpGeometry(5.5, 1.0, 0.3, 10); leg.scale(0.16, 0.25, 0.16); leg.translate(0, 0.08, 0);
      const g = merge([{ geo: seat, color: 0xffffff }, { geo: back, color: 0xffffff }, { geo: leg, color: 0xffffff }]); withAO(g, (x, y) => Math.min(1, 0.4 + y * 1.5));
      mesh = new THREE.Mesh(g, kit.bark); mesh.position.set(px, floorY(px, pz) - 0.02, pz); mesh.rotation.y = rng() * 6;
      pos = mesh.position.clone(); radius = 0.6; break;
    }
    default: return null;
  }
  if (!mesh) return null;
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  return { id: loc.id, mesh, pos, radius, normal, find };
}

// ---------------------------------------------------------------- the book and quill

// In maze 1 only, until it has been found: beside the solution path within the first quarter of the walk, at the
// end of the longest straight run of corridor that leads there, so it stands in plain view as you come down the
// corridor. It hugs the wall on one side of the path (or stands a tile off it in a room) and goes through the
// walkability guard with the pedestal's footprint `r`, so it never narrows the way. Returns [x, z] or null.
function bookSpot(maze, rng, pass, c, wallAt, r) {
  const { path } = maze;
  const last = Math.min(path.length - 2, Math.max(2, Math.floor(path.length / 4)));
  const cands = [];
  for (let i = 1; i <= last; i++) {
    const dx = path[i][0] - path[i - 1][0], dy = path[i][1] - path[i - 1][1];
    let run = 1;
    for (let j = i - 1; j > 0 && path[j][0] - path[j - 1][0] === dx && path[j][1] - path[j - 1][1] === dy; j--) run++;
    cands.push({ i, run, dx, dy, k: rng() });
  }
  cands.sort((a, b) => b.run - a.run || a.k - b.k);
  const foot = Math.min(r * 0.75, c * 0.3);
  for (const cd of cands) {
    const [tx, ty] = path[cd.i];
    const sides = rng() < 0.5 ? [[-cd.dy, cd.dx], [cd.dy, -cd.dx]] : [[cd.dy, -cd.dx], [-cd.dy, cd.dx]];
    // the wall side first: tucked against it, as the stumps of the place are; an open side: a tile over, off the walked line
    sides.sort((a, b) => (wallAt(tx + b[0], ty + b[1]) ? 1 : 0) - (wallAt(tx + a[0], ty + a[1]) ? 1 : 0));
    for (const [sx, sy] of sides) {
      const offs = wallAt(tx + sx, ty + sy) ? [c / 2 - r * 0.7, c / 2 - r * 0.95] : [c * 0.55, c * 0.4];
      for (const off of offs) {
        const px = (tx + 0.5) * c + sx * off + cd.dx * (rng() - 0.5) * c * 0.3, pz = (ty + 0.5) * c + sy * off + cd.dy * (rng() - 0.5) * c * 0.3;
        if (pass.place([[px, pz, foot]])) return [px, pz];
      }
    }
  }
  return null;
}

// the pedestal the book waits on: the scanned stump when the place has it, else a flat mossy rock of the place's
// own stone. Stands on the floor at [px, pz]; returns {mesh, top(x, z) -> [y, nx, ny, nz]} with its highest surface
function buildPedestal(ctx, kit, px, pz, r, s) {
  const { world, floorY, rng } = ctx;
  const piece = ctx.pedestal && ctx.pedestal.pieces && ctx.pedestal.pieces[0];
  let mesh;
  if (piece) {
    const bb = piece.geometry.boundingBox;
    mesh = new THREE.InstancedMesh(piece.geometry, piece.material, 1);
    const yaw = rng() * Math.PI * 2;
    mesh.setMatrixAt(0, new THREE.Matrix4().compose(new THREE.Vector3(px, -bb.min.y * s * 0.5 + floorY(px, pz), pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(s, s, s)));
    world.shootSources.push({ mesh, kind: 'scan', samples: piece.samples, cover: 0.45 });
  } else {
    const geo = withAO(lumpGeometry(11.3, 0.3, 0.55, 22), (x, y) => Math.min(1, Math.max(0, y + 0.7)));
    mesh = new THREE.InstancedMesh(geo, kit.stone, 1);
    mesh.setMatrixAt(0, new THREE.Matrix4().compose(new THREE.Vector3(px, r * 0.3 + floorY(px, pz), pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng() * Math.PI * 2, 0)), new THREE.Vector3(r * 1.1, r * 0.45, r * 0.9)));
    world.shootSources.push({ mesh, kind: 'lump', cover: 0.5 });
  }
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(0, -1, 0);
  const top = (x, z) => {
    o.set(x, floorY(x, z) + 4, z); ray.set(o, d); ray.far = 5;
    const hits = ray.intersectObject(mesh, false);
    if (!hits.length) return null;
    const h = hits[0];
    const n = h.face ? h.face.normal.clone().transformDirection(mesh.matrixWorld) : new THREE.Vector3(0, 1, 0);
    if (n.y < 0) n.negate();
    return [h.point.y, n.x, n.y, n.z];
  };
  return { mesh, top };
}

// where a pickup waits: the spot beside the way, the pedestal on it, and the point on the pedestal's top the item
// lies at. When no pedestal fits anywhere along the first quarter, the item lies on the floor beside the way.
// Returns {bx, bz, hit: [y, nx, ny, nz], r} or null
function placeOnPedestal(ctx, kit) {
  const { maze, rng, c, group, floorY, pass, wallAt } = ctx;
  const piece = ctx.pedestal && ctx.pedestal.pieces && ctx.pedestal.pieces[0];
  // the stump scaled so its cut top stands about knee high and it fits beside a corridor; the rock the same size
  const s = piece ? Math.min(0.78, c * 0.36 / (Math.max(piece.geometry.boundingBox.max.x - piece.geometry.boundingBox.min.x, piece.geometry.boundingBox.max.z - piece.geometry.boundingBox.min.z) / 2)) : 1;
  const r = piece ? Math.max(piece.geometry.boundingBox.max.x - piece.geometry.boundingBox.min.x, piece.geometry.boundingBox.max.z - piece.geometry.boundingBox.min.z) * s / 2 : Math.min(0.42, c * 0.3);
  let spot = bookSpot(maze, rng, pass, c, wallAt, r);
  if (!spot) { spot = bookSpot(maze, rng, pass, c, wallAt, 0.14); if (!spot) return null; return { bx: spot[0], bz: spot[1], hit: [floorY(spot[0], spot[1]), 0, 1, 0], r: 0.14 }; }
  const [px, pz] = spot;
  const ped = buildPedestal(ctx, kit, px, pz, r, s);
  group.add(ped.mesh);
  // the item sits on the highest flat of the pedestal near its middle
  let bx = px, bz = pz, hit = null;
  for (let t = 0; t < 12; t++) {
    const x = px + (rng() - 0.5) * r * 0.5, z = pz + (rng() - 0.5) * r * 0.5;
    const h = ped.top(x, z);
    if (h && (!hit || (h[2] > hit[2] + 0.05) || (h[2] > 0.85 && h[0] > hit[0]))) { hit = h; bx = x; bz = z; }
  }
  if (!hit) hit = [floorY(px, pz), 0, 1, 0];
  return { bx, bz, hit, r };
}

// a small closed book, leather over a block of pages, with a quill laid across it
function bookModel(world, rng) {
  const leather = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = 'rgb(66,34,22)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${rnd(40, 125)|0},${rnd(22, 62)|0},${rnd(12, 40)|0},${rnd(0.15, 0.5)})`; g.fillRect(Math.random() * w, Math.random() * h, rnd(1, 3), rnd(1, 3)); }
    for (let i = 0; i < 320; i++) { g.strokeStyle = `rgba(30,16,10,${rnd(0.1, 0.35)})`; g.lineWidth = 1; const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-8, 8), y + rnd(-3, 3)); g.stroke(); }
    const e = g.createLinearGradient(0, 0, w, 0); e.addColorStop(0, 'rgba(160,110,75,0.4)'); e.addColorStop(0.1, 'rgba(0,0,0,0)'); e.addColorStop(0.9, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(160,110,75,0.35)'); g.fillStyle = e; g.fillRect(0, 0, w, h);
    const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(160,110,75,0.3)'); v.addColorStop(0.08, 'rgba(0,0,0,0)'); v.addColorStop(0.92, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(160,110,75,0.3)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
  const pages = canvasTexture(128, 32, (g, w, h) => {
    g.fillStyle = 'rgb(226,212,178)'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) { g.fillStyle = `rgba(${rnd(120, 170)|0},${rnd(100, 140)|0},${rnd(70, 100)|0},${rnd(0.15, 0.5)})`; g.fillRect(0, y + 0.2, w, 0.6); }
    for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(90,70,40,${rnd(0.05, 0.2)})`; g.fillRect(Math.random() * w, Math.random() * h, rnd(1, 4), 1); }
  });
  const feather = canvasTexture(64, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgb(236,232,222)'; g.beginPath(); g.moveTo(32, 6); g.quadraticCurveTo(58, 80, 40, 200); g.lineTo(34, 236); g.lineTo(28, 236); g.lineTo(24, 200); g.quadraticCurveTo(8, 90, 32, 6); g.fill();
    for (let y = 30; y < 196; y += 4) { g.strokeStyle = `rgba(150,145,135,${rnd(0.25, 0.55)})`; g.lineWidth = 1; g.beginPath(); g.moveTo(32, y); g.lineTo(32 + rnd(12, 22), y - 8); g.moveTo(32, y); g.lineTo(32 - rnd(10, 20), y - 7); g.stroke(); }
    g.strokeStyle = 'rgb(200,190,170)'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 10); g.lineTo(31, 250); g.stroke();
    g.strokeStyle = 'rgb(60,40,20)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(31, 236); g.lineTo(31, 254); g.stroke();
  }, true, true);
  const matL = new THREE.MeshStandardMaterial({ map: leather, roughness: 0.6, metalness: 0 });
  const matP = new THREE.MeshStandardMaterial({ map: pages, roughness: 0.92 });
  const matF = new THREE.MeshStandardMaterial({ map: feather, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7 });
  world.materials.push(matL, matP, matF);
  const grp = new THREE.Group();
  // 16 by 22 cm, 3.5 cm thick: two leather covers that overhang the page block a hair, the spine on -x
  const cover = new THREE.BoxGeometry(0.19, 0.006, 0.26);
  const top = new THREE.Mesh(cover, matL); top.position.y = 0.032; grp.add(top);
  const bottom = new THREE.Mesh(cover, matL); bottom.position.y = 0.003; grp.add(bottom);
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.248), [matP, matL, matP, matP, matP, matP]); block.position.set(0.003, 0.0175, 0); grp.add(block);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.035, 0.26), matL); spine.position.set(-0.094, 0.0175, 0); grp.add(spine);
  // the quill laid across the cover, tip toward the spine, standing a little off it
  const quill = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.21), matF);
  quill.position.set(0.03, 0.09, 0.0); quill.rotation.set(-0.75, 0.9, 0.15, 'YXZ'); grp.add(quill);
  grp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return grp;
}

// a hand torch lying on its side: a rubber-black body with a grip ring, a steel head, the lens glowing a little after
// dark (it was left switched on), a red switch
function torchModel(world, rng) {
  const night = Math.max(world.weather.night || 0, 0.6 * (world.weather.dusk || 0));
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.6, metalness: 0.05 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x5a5e68, roughness: 0.35, metalness: 0.8 });
  const lens = new THREE.MeshStandardMaterial({ color: 0xfff3c8, roughness: 0.2, emissive: 0xffe2a0, emissiveIntensity: 0.25 + 2.2 * night });
  const red = new THREE.MeshStandardMaterial({ color: 0xa8281f, roughness: 0.5 });
  world.materials.push(rubber, steel, lens, red);
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.16, 14), rubber); grp.add(body);
  for (const y of [-0.05, -0.02, 0.01]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0025, 6, 16), rubber); ring.rotation.x = Math.PI / 2; ring.position.y = y; grp.add(ring); }
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.021, 0.045, 14), steel); head.position.y = 0.1; grp.add(head);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.004, 14), lens); glass.position.y = 0.1225; grp.add(glass);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.012, 14), steel); cap.position.y = -0.085; grp.add(cap);
  const sw = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.006), red); sw.position.set(0, 0.04, 0.019); grp.add(sw);
  // on its side, the head a little raised on the grip rings, pointing off along the way
  const lie = new THREE.Group(); lie.add(grp);
  grp.rotation.set(Math.PI / 2 - 0.06, 0, 0.2); grp.position.y = 0.021;
  lie.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return lie;
}

// a pickup on its pedestal beside the way, leaning with the pedestal's top; a warm light and a soft halo over it
// after dark so it reads from the corridor as something worth walking to. Returns {group, pos, update, reach} or null
function buildPickup(ctx, kit, model) {
  const { rng, group, world, floorY } = ctx;
  const at = placeOnPedestal(ctx, kit); if (!at) return null;
  const { bx, bz, hit, r } = at, y0 = hit[0];
  const grp = model(world, rng);
  // laid on the cut top, leaning with it
  grp.position.set(bx, y0 + 0.004, bz);
  grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(hit[1], hit[2], hit[3]).normalize());
  grp.rotateY(rng() * Math.PI * 2);
  // the light over it and the halo: faint by day, a soft lamp after dark
  const night = Math.max(world.weather.night || 0, 0.6 * (world.weather.dusk || 0));
  const lk = 0.2 + 0.8 * night;
  const light = new THREE.PointLight(0xfff0d4, 1.6 * lk, 1.8 + 1.6 * night, 1.7); light.position.set(0, 0.5, 0); grp.add(light);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: world.glowTex, color: 0xffe9b8, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  halo.position.set(0, 0.12, 0); halo.scale.set(0.42, 0.42, 1); grp.add(halo);
  group.add(grp);
  const pos = new THREE.Vector3(bx, floorY(bx, bz), bz);
  const update = now => { const k = 0.5 + 0.5 * Math.sin(now * 1.7); halo.material.opacity = (0.08 + 0.08 * k) * (0.5 + 0.5 * night); light.intensity = (1.3 + 0.6 * k) * lk; };
  // walking up to the pedestal is as close as the player can come: the pickup reaches that far
  return { group: grp, pos, update, reach: r + 0.55 };
}

// ---------------------------------------------------------------- the builder

export function buildWhimsy(ctx, kit) {
  const { loc, rng, c, H, group, world, floorY, openCells, maze } = ctx;
  const out = { snails: null, frogs: null, animal: null, cast: null, find: null, book: null, torch: null, update: null };
  const spots = ctx.spots;

  // --- snails: a few on the carved walls at eye height, or on the nurse logs, each creeping along a trail
  if (ctx.kind === 'carved' || ctx.kind === 'logs') {
    const n = 3 + Math.floor(rng() * 3);
    const items = [];
    for (let i = 0; i < n * 4 && items.length < n; i++) {
      if (ctx.kind === 'carved') {
        const f = pick(rng, world.shootFaces); if (!f) break;
        const a0 = f.a0 || 0.05, a1 = f.a1 ?? 0.95, top = Math.min(H - 0.3, (f.top ?? H) - 0.2);
        if (top < 0.8) continue;
        const along = a0 + 0.15 + rng() * Math.max(0.05, a1 - a0 - 0.3), hy = 0.75 + rng() * Math.max(0.2, top - 0.9);
        let x = f.ox + f.ux * along, z = f.oz + f.uz * along;
        const d = disp(x, hy, z, H); x += d[0]; z += d[2];
        const dir = rng() < 0.5 ? 1 : -1;
        const ul = Math.hypot(f.ux, f.uz) || 1;
        items.push({ x: x + f.nx * 0.004, y: hy + floorY(x, z), z: z + f.nz * 0.004, nx: f.nx, ny: 0, nz: f.nz, tx: f.ux / ul * dir, ty: 0, tz: f.uz / ul * dir, dist: 0, len: 0.14 + rng() * 0.16, speed: 0.004 + rng() * 0.005 });
      } else if (ctx.logSides && ctx.logSides.length) {
        // on the corridor side of a log at eye height, creeping along the bark
        const L = pick(rng, ctx.logSides);
        const t = (rng() - 0.5) * L.half, dir = rng() < 0.5 ? 1 : -1;
        items.push({ x: L.x + L.ax * t + L.nx * 0.004, y: L.y + (rng() - 0.5) * 0.1, z: L.z + L.az * t + L.nz * 0.004, nx: L.nx, ny: 0, nz: L.nz, tx: L.ax * dir, ty: 0, tz: L.az * dir, dist: 0, len: 0.12 + rng() * 0.14, speed: 0.004 + rng() * 0.004 });
      } else {
        const L = pick(rng, ctx.logTops); if (!L) break;
        const t = (rng() - 0.5) * L.half;
        items.push({ x: L.x + L.dirx * t, y: L.y - 0.005, z: L.z + L.dirz * t, nx: 0, ny: 1, nz: 0, tx: L.dirx, ty: 0, tz: L.dirz, dist: 0, len: 0.12 + rng() * 0.12, speed: 0.004 + rng() * 0.004 });
      }
    }
    if (items.length) {
      const tex = world.texCache.snail || (world.texCache.snail = snailTexture());
      const geo = world.geoCache.snail || (world.geoCache.snail = snailGeometry());
      const mat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.45, envMapIntensity: 0.6 });
      world.materials.push(mat);
      const mesh = new THREE.InstancedMesh(geo, mat, items.length); mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false;
      // the trail: a thin glossy smear behind each snail, growing as it goes; soft-edged, fading where it started
      const ttex = world.texCache.trail || (world.texCache.trail = canvasTexture(64, 16, (cx, w, h) => {
        cx.clearRect(0, 0, w, h);
        for (let x = 0; x < w; x++) { const a = Math.min(1, x / (w * 0.35)) * 0.9; for (let y = 0; y < h; y++) { const e = 1 - Math.pow(Math.abs(y - h / 2) / (h / 2), 2.2); cx.fillStyle = `rgba(255,255,255,${(a * e * (0.6 + 0.4 * Math.random())).toFixed(3)})`; cx.fillRect(x, y, 1, 1); } }
      }, false));
      const tmat = new THREE.MeshStandardMaterial({ color: 0xdfe8e2, alphaMap: ttex, transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0, depthWrite: false, envMapIntensity: 1.8, polygonOffset: true, polygonOffsetFactor: -3 });
      world.materials.push(tmat);
      const tgeo = new THREE.PlaneGeometry(1, 1); tgeo.translate(0.5, 0, 0);   // from the origin along +x
      const trail = new THREE.InstancedMesh(tgeo, tmat, items.length); trail.frustumCulled = false; trail.receiveShadow = false;
      group.add(mesh); group.add(trail);
      out.snails = { items, mesh, trail, size: 0.034 };
    }
  }

  // --- frogs: at the water's edge where the place has frogs, at the wall feet otherwise
  if ((loc.sound.animals || []).includes('frog')) {
    const n = 8 + Math.floor(rng() * 6);
    const items = [];
    const prot = new Set((maze.protect || []).map(([x, y]) => `${x},${y}`));
    for (let t = 0; t < n * 30 && items.length < n; t++) {
      const [gx, gz] = pick(rng, openCells);
      if (prot.has(`${gx},${gz}`) || Math.abs(gx - maze.start.x) + Math.abs(gz - maze.start.y) < 3) continue;
      const px = (gx + 0.1 + rng() * 0.8) * c, pz = (gz + 0.1 + rng() * 0.8) * c;
      if (ctx.pass.inside(px, pz, 0.06)) continue;
      const wet = world.inWater(px + 0.3, pz) || world.inWater(px - 0.3, pz) || world.inWater(px, pz + 0.3) || world.inWater(px, pz - 0.3);
      if (world.inWater(px, pz) || (!wet && rng() < 0.7)) continue;
      items.push({ x: px, y: floorY(px, pz) + 0.014, z: pz, yaw: rng() * Math.PI * 2, s: 0.085 + rng() * 0.045, hop: null, hops: 0, cool: 0 });
    }
    if (items.length) {
      const tex = world.texCache.frog || (world.texCache.frog = frogTexture());
      const geo = world.geoCache.frog || (world.geoCache.frog = frogGeometry());
      const mat = new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.55 });
      world.materials.push(mat);
      const mesh = new THREE.InstancedMesh(geo, mat, items.length); mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false;
      group.add(mesh);
      out.frogs = { items, mesh, isOpen: ctx.open, c, pass: ctx.pass, distToWall: ctx.distToWall, floorY, inWater: (x, z) => world.inWater(x, z) };
    }
  }

  // --- the animal of the place: a real animal far off, gone when it notices you
  out.animal = buildAnimal(ctx, world);
  // --- a character from radbro.gg, in the places that have one (cast.js)
  out.cast = buildCast(ctx);

  // --- the hidden find of this place
  out.find = buildFind(ctx, kit);
  // --- the book and quill, in the first maze until it is found
  if (ctx.wantBook) out.book = buildPickup(ctx, kit, bookModel);
  // --- the hand torch, in the second maze until it is found
  if (ctx.wantTorch) out.torch = buildPickup(ctx, kit, torchModel);

  return out;
}

// ---------------------------------------------------------------- per frame

const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4();

export function updateWhimsy(w, dt, player, now, hooks = {}) {
  if (!w) return;
  if (w.book) w.book.update(now);
  if (w.torch) w.torch.update(now);
  // snails creep; their trails lengthen behind them
  if (w.snails) {
    const { items, mesh, trail, size } = w.snails;
    for (let i = 0; i < items.length; i++) {
      const s = items[i];
      s.dist = Math.min(s.len, s.dist + s.speed * dt);
      const x = s.x + s.tx * s.dist, y = s.y + s.ty * s.dist, z = s.z + s.tz * s.dist;
      _n.set(s.nx, s.ny, s.nz); _t.set(s.tx, s.ty, s.tz); _b.crossVectors(_n, _t);
      // the body's +x is its direction of travel, +y its up; a slow stretch and pull of the foot as it goes
      const stretch = 1 + 0.06 * Math.sin(now * 1.3 + i);
      _m.makeBasis(_t.clone().multiplyScalar(size * stretch), _n.clone().multiplyScalar(size), _b.multiplyScalar(size)); _m.setPosition(x, y, z);
      mesh.setMatrixAt(i, _m);
      // the trail: from the start to just under the snail, a shade off the surface
      _m.makeBasis(_t.clone().multiplyScalar(Math.max(0.001, s.dist - size * 0.4)), _n.clone().multiplyScalar(0.009), _b.normalize().multiplyScalar(0.009)); _m.setPosition(s.x + s.nx * 0.003, s.y + s.ny * 0.003, s.z + s.nz * 0.003);
      trail.setMatrixAt(i, _m);
    }
    mesh.instanceMatrix.needsUpdate = true; trail.instanceMatrix.needsUpdate = true;
  }
  // frogs: when you come close one hops away from you (off the path, toward the wall or the water) and then sits
  if (w.frogs) {
    const { items, mesh, isOpen, c, pass, distToWall, floorY, inWater } = w.frogs;
    const pp = player.pos;
    for (let i = 0; i < items.length; i++) {
      const f = items[i];
      let x = f.x, y = f.y, z = f.z, squat = 1;
      if (f.hop) {
        f.hop.t += dt / 0.42;
        const k = Math.min(1, f.hop.t);
        x = f.hop.x0 + (f.hop.x1 - f.hop.x0) * k; z = f.hop.z0 + (f.hop.z1 - f.hop.z0) * k;
        y = f.hop.y0 + (f.hop.y1 - f.hop.y0) * k + Math.sin(k * Math.PI) * 0.14;
        squat = 1 + 0.25 * Math.sin(k * Math.PI);
        if (k >= 1) { f.x = f.hop.x1; f.y = f.hop.y1; f.z = f.hop.z1; f.hop = null; f.cool = 0.6 + Math.random() * 0.8; if (hooks.frogLand) hooks.frogLand(x, z); }
      } else {
        f.cool -= dt;
        const dx = f.x - pp.x, dz = f.z - pp.z, d = Math.hypot(dx, dz);
        if (d > 4) f.hops = 0;
        if (d < 1.35 && f.cool <= 0 && f.hops < 2) {
          // away from the player, turned toward whichever side keeps it in the open; it settles by a wall or in the water
          const base = Math.atan2(dz, dx);
          let best = null;
          for (let k = 0; k < 7; k++) {
            const a = base + (k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.55), L = 0.35 + Math.random() * 0.3;
            const nx = f.x + Math.cos(a) * L, nz = f.z + Math.sin(a) * L;
            if (!isOpen(Math.floor(nx / c), Math.floor(nz / c)) || distToWall(nx, nz) < 0.08 || pass.inside(nx, nz, 0.04)) continue;
            const score = (inWater(nx, nz) ? 1 : 0) + (distToWall(nx, nz) < 0.35 ? 0.6 : 0) + Math.random() * 0.3;
            if (!best || score > best.score) best = { nx, nz, a, score };
          }
          if (best) {
            f.hop = { t: 0, x0: f.x, z0: f.z, y0: f.y, x1: best.nx, z1: best.nz, y1: floorY(best.nx, best.nz) + (inWater(best.nx, best.nz) ? 0.01 : 0) };
            f.yaw = -best.a + Math.PI / 2; f.hops++;
            if (hooks.frogHop) hooks.frogHop(f.x, f.z);
          } else { f.cool = 1; }
        }
      }
      E.set(0, f.yaw, 0); Q.setFromEuler(E); P.set(x, y, z); S.set(f.s, f.s * (1 / squat), f.s);
      mesh.setMatrixAt(i, M4.compose(P, Q, S));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  updateAnimal(w.animal, dt, player, now, hooks);
  updateCast(w.cast, dt, player, hooks);
}
