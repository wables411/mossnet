// Builds a maze as a place: walls that are the place's own (a rock or earth
// bank carved by that place's field, stacked fallen trunks, or a palisade of
// standing trees on a low bank), a floor with the place's relief (hollows,
// a slope, flooded channels) and a still water level where it has one, what
// is overhead, the moss curtains and crest tufts, the props the location
// calls for, and the exit opening.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { WALL } from './maze.js?v=28138280';
import { noise3, fbm3 } from './noise.js?v=a407dfed';
import { makeMossMaterial } from './materials.js?v=af31d97a';
import { hangClumpGeometry, MeshBuilder, disp, setCarve, makeLowField, curtainTexture, beardTexture, drapeTexture, vineTexture, tuftAtlas, TUFT_VARIANTS, shaftTexture, glowTexture } from './geometry.js?v=d4fe5800';
import { buildCanopy, buildTrees, buildCaveCeiling, buildVaults, buildLogs, buildBoulders, buildMushrooms, buildPlants, buildStream, buildCushions, buildBoughMoss, buildScans, buildLogWalls, buildTrunkWalls, buildWater, wallSpots } from './props.js?v=a5e3aefe';
import { buildWhimsy } from './whimsy.js?v=279db07e';
import { mossTypes } from './locations.js?v=f0992831';
import { makeCardMaterial, cardDepthMaterial, wind } from './wind.js?v=25d38805';
import { Passability } from './passable.js?v=42f6f864';

// the photo sets: texture repeats per metre, a tint over the photo, a tint over the moss grown on it
export const MATERIAL_SPECS = {
  stone: { base: 'stone', scale: 0.55, mossScale: 0.75, baseTint: 0xb9b3a6, mossTint: 0xffffff },      // rough grey cliff (Williamson's sandstone)
  brick: { base: 'brick', scale: 0.5, mossScale: 0.8, baseTint: 0xc9c2b4, mossTint: 0xf2f7ea },        // hand-made brick
  wood: { base: 'wood', scale: 0.45, mossScale: 0.9, baseTint: 0x9d8d70, mossTint: 0xe8f2d8 },         // oak bark
  rock: { base: 'rock', scale: 0.5, mossScale: 0.7, baseTint: 0xf0f0f0, mossTint: 0xdff0d8 },          // black cave rock
  dirt: { base: 'dirt', scale: 0.6, mossScale: 0.85, baseTint: 0x8c8266, mossTint: 0xffffff },         // damp forest earth
  granite: { base: 'granite', scale: 0.42, mossScale: 0.75, baseTint: 0xd4d6d0, mossTint: 0xffffff },  // Yakushima: grey granite, moss in its pits
  lava: { base: 'lava', scale: 0.6, mossScale: 0.7, baseTint: 0xa8a29c, mossTint: 0xdff0d8 },          // Aokigahara: black broken lava
  lavafloor: { base: 'lavafloor', scale: 0.55, mossScale: 0.8, baseTint: 0xc4c4c4, mossTint: 0xf0f8e8 }, // Aokigahara floor: dark rock under a thin moss skin
  barkmoss: { base: 'barkmoss', scale: 0.9, mossScale: 0.9, baseTint: 0xd4d4c4, mossTint: 0xffffff },  // Hoh: mossy bark on the nurse logs
  forestfloor: { base: 'forestfloor', scale: 0.5, mossScale: 0.85, baseTint: 0xa89c86, mossTint: 0xffffff }, // Hoh floor: needles and litter
  wetstone: { base: 'wetstone', scale: 0.5, mossScale: 0.8, baseTint: 0xb4b4ac, mossTint: 0xf2f7ea },  // Williamson floor: wet flat stone
  clitter: { base: 'clitter', scale: 0.5, mossScale: 0.75, baseTint: 0xd4d6cc, mossTint: 0xffffff },   // Wistman's: pale granite under lichen
  moorgrass: { base: 'moorgrass', scale: 0.5, mossScale: 0.85, baseTint: 0xb8c49c, mossTint: 0xffffff }, // Wistman's floor: moor grass
  laurel: { base: 'laurel', scale: 0.9, mossScale: 0.9, baseTint: 0xb8bcb0, mossTint: 0xffffff },      // Fanal: grey-green laurel bark
  redsoil: { base: 'redsoil', scale: 0.55, mossScale: 0.85, baseTint: 0xc48a5a, mossTint: 0xffffff },  // Fanal floor: red volcanic soil
  limestone: { base: 'limestone', scale: 0.5, mossScale: 0.75, baseTint: 0xd4d4d0, mossTint: 0xffffff }, // Puzzlewood: layered limestone
  scowle: { base: 'scowle', scale: 0.5, mossScale: 0.8, baseTint: 0xbcc0bc, mossTint: 0xffffff },      // Puzzlewood floor: light grey rock
  cypress: { base: 'cypress', scale: 0.9, mossScale: 0.9, baseTint: 0xb09c86, mossTint: 0xffffff },    // Congaree: fibrous cypress bark
  mud: { base: 'mud', scale: 0.5, mossScale: 0.85, baseTint: 0x9a8a74, mossTint: 0xffffff },           // Congaree floor: dark mud
};

export class World {
  constructor(scene, textures, strand, quality, fogColor, sunDir) {
    this.scene = scene; this.tex = textures; this.strand = strand; this.q = quality;
    this.fogColor = fogColor; this.sunDir = sunDir;
    this.group = null; this.materials = []; this.texCache = {}; this.geoCache = {};
    this.curtainTex = curtainTexture(); this.hangTex = [drapeTexture(), beardTexture(), vineTexture()]; this.tuftTex = tuftAtlas(); this.shaftTex = shaftTexture(); this.glowTex = glowTexture();
    this.obstacles = []; this.stream = null; this.waters = []; this.waterLevel = null; this.types = null; this.weather = { rain: 0, snow: 0, fog: 0, wind: 0.2 };
    this.low = makeLowField();
    this.shootSources = []; this.shootFaces = []; this.fuzzMeshes = [];
    this.floorY = () => 0;
  }

  dispose() {
    if (!this.group) return;
    this.scene.remove(this.group);
    const geos = new Set();
    this.group.traverse(o => { if (o.geometry) geos.add(o.geometry); });
    for (const g of geos) g.dispose();
    for (const m of this.materials) m.dispose();
    this.group = null; this.materials = []; this.obstacles = []; this.stream = null; this.waters = []; this.waterLevel = null; this.shootSources = []; this.shootFaces = []; this.fuzzMeshes = []; this.whimsy = null; this.cushions = null; this.wallGeos = [];
  }

  // is this point under the place's water (a stream channel or the still level)
  inWater(x, z) {
    if (this.stream && Math.abs(z - this.stream.z) < this.stream.w / 2 + 0.1) return true;
    if (this.waterLevel !== null && this.floorY(x, z) < this.waterLevel - 0.01) return true;
    return false;
  }

  build(maze, diff, rng, loc, weather, scans = [], extras = {}) {
    this.dispose();
    this.weather = weather || this.weather;
    this.types = mossTypes(loc);
    this.fogColor.setHex(loc.fog.color);
    // the hour: after dark the air goes deep blue-grey; at dusk it keeps a little warmth
    const night = this.weather.night || 0, dusk = this.weather.dusk || 0;
    if (night) this.fogColor.lerp(new THREE.Color(0x0b1020), night * 0.86);
    if (dusk) this.fogColor.lerp(new THREE.Color(0x9a7458), 0.22);
    this.night = night;
    const g = this.group = new THREE.Group();
    const c = diff.cell, H = diff.wallHeight;
    const { W, grid, zone } = maze;
    this.mazeW = W; this.mazeH = maze.H;
    const wall = loc.wall || { kind: 'carved' };
    const coverW = diff.mossCover * ((loc.cover && loc.cover.wall) ?? 1), coverF = Math.min(0.95, diff.mossCover * ((loc.cover && loc.cover.floor) ?? 1) + 0.2);
    const kind = wall.kind || 'carved';
    // this place's carving, capped so a passage one tile wide can never pinch shut; stacked logs and trunk banks are not carved
    const carveMax = Math.max(0.04, Math.min(0.32, (c - 0.95) / 2));
    if (kind === 'logs') setCarve({ flat: true });
    else if (kind === 'trunks') setCarve({ amp: 0.6, heave: 0.5, ...(wall.carve || {}), max: Math.min(0.14, carveMax) });   // the bank's edge wobbles a little
    else setCarve({ ...(wall.carve || {}), max: Math.min(carveMax, (wall.carve && wall.carve.max) || carveMax) });
    const isOpen = (x, y) => x >= 0 && y >= 0 && x < W && y < maze.H && grid[y * W + x] !== WALL;

    // the exit continues as a short passage out of the maze
    const extraWalls = new Set();
    const [edx, edy] = maze.exit.dir;
    const perp = [edy, edx];
    for (let k = 0; k <= 3; k++) for (const s of [-1, 1]) extraWalls.add(`${maze.exit.x + edx * k + perp[0] * s},${maze.exit.y + edy * k + perp[1] * s}`);
    const exitOpen = new Set();
    for (let k = 1; k <= 3; k++) exitOpen.add(`${maze.exit.x + edx * k},${maze.exit.y + edy * k}`);
    const open = (x, y) => isOpen(x, y) || exitOpen.has(`${x},${y}`);
    const wallAt = (x, y) => extraWalls.has(`${x},${y}`) || (x >= 0 && y >= 0 && x < W && y < maze.H && grid[y * W + x] === WALL);
    const zoneAt = (x, y) => (x >= 0 && y >= 0 && x < W && y < maze.H) ? zone[y * W + x] % diff.zones : zone[maze.exitRoom.y * W + maze.exitRoom.x] % diff.zones;

    // a stream: one corridor row, cut into the floor, running the full width
    let stream = null;
    if (loc.stream) {
      const rows = [];
      for (let y = 1; y < maze.H - 1; y++) if (Math.abs(y - maze.start.y) > 2) rows.push(y);
      const row = rows[Math.floor(rng() * rows.length)];
      stream = { z: (row + 0.5) * c, w: Math.min(1.1, c * 0.42), depth: 0.16, row };
    }
    this.stream = stream;

    // --- the floor: the place's relief over a fine undulation
    // (floorY is the one height everything standing on the ground is placed with; the walls ride on it too)
    const relief = loc.relief || {};
    const floorY = (x, z) => {
      let dy = (fbm3(x * 0.8, 5, z * 0.8, 2) - 0.5) * 0.08 + (fbm3(x * 3, 7, z * 3, 2) - 0.5) * 0.025;
      if (relief.hollows) { const [amp, k] = relief.hollows; dy += (fbm3(x * k + 31, 2, z * k + 31, 3) - 0.5) * 2 * amp; }
      if (relief.slope) dy += relief.slope[0] * x + relief.slope[1] * z;
      if (relief.channels) {
        // shallow channels where the slow field dips, with soft banks
        const [amp, k] = relief.channels;
        const n = fbm3(x * k + 13, 4, z * k + 13, 3);
        const t = Math.max(0, Math.min(1, (0.56 - n) / 0.14));
        dy -= amp * t * t * (3 - 2 * t);
      }
      if (stream) {
        const d = Math.abs(z - stream.z) / (stream.w / 2 + 0.3);
        if (d < 1) dy -= stream.depth * Math.sqrt(1 - d * d) * (0.8 + 0.2 * noise3(x * 2, 1, z * 2));
      }
      return dy;
    };
    this.floorY = floorY;
    this.waterLevel = loc.water ? loc.water.level : null;

    // contact shadow: the base of a wall, and the floor where it meets a wall
    const wallAO = (x, y, z) => Math.min(1, Math.max(0, (y - floorY(x, z) + 0.1) / 0.55));
    const distToWall = (x, z) => {
      const gx = Math.floor(x / c), gz = Math.floor(z / c);
      let best = 9;
      for (let j = gz - 1; j <= gz + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) {
        if (!wallAt(i, j)) continue;
        const dx = Math.max(i * c - x, 0, x - (i + 1) * c), dz = Math.max(j * c - z, 0, z - (j + 1) * c);
        best = Math.min(best, Math.hypot(dx, dz));
      }
      return best;
    };
    const floorAO = (x, y, z) => Math.min(1, distToWall(x, z) / 0.5);

    // --- what is overhead where: rock bridges span some corridor runs and roof every dead end
    const caveSet = new Set();
    if (loc.ceiling === 'bridges') {
      const share = loc.bridges ?? 0.15;
      for (let y = 1; y < maze.H - 1; y++) for (let x = 1; x < W - 1; x++) {
        if (!open(x, y)) continue;
        let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (wallAt(x + dx, y + dy)) n++;
        const key = `${x},${y}`;
        if (n === 3) { caveSet.add(key); continue; }   // a dead end: a cave mouth
        const alongX = wallAt(x, y - 1) && wallAt(x, y + 1), alongZ = wallAt(x - 1, y) && wallAt(x + 1, y);
        if ((alongX || alongZ) && rng() < share && Math.abs(x - maze.start.x) + Math.abs(y - maze.start.y) > 2) {
          caveSet.add(key);
          if (rng() < 0.6) caveSet.add(alongX ? `${x + 1},${y}` : `${x},${y + 1}`);
        }
      }
    }
    const caveAt = (x, y) => loc.ceiling === 'cave' || caveSet.has(`${x},${y}`);

    // the wall cells and the open cells, with the exit passage
    const cells = [], openCells = [];
    for (let y = -1; y <= maze.H; y++) for (let x = -1; x <= W; x++) { if (wallAt(x, y)) cells.push([x, y]); else if (open(x, y)) openCells.push([x, y]); }
    const exposed = (x, y) => open(x, y - 1) || open(x, y + 1) || open(x - 1, y) || open(x + 1, y);
    const pomSteps = this.q.high ? 8 : 4;
    const shells = this.q.high ? 8 : 4;
    // the walls take half as many: every shell is another copy of the whole bank (near half a million triangles in a
    // late maze), and four give the pile on a standing face nearly as well as eight
    const wallShells = this.q.high ? 4 : 2;
    const cellH = () => H;

    // --- walls
    if (kind === 'carved' || kind === 'trunks') {
      // a carved bank, one builder per zone material (a trunk palisade stands on a low bank of the floor material)
      // where the material changes from one zone to the next: each zone cross-fades into its most frequent
      // neighbour (its partner) over the last metre, both sides meeting at the same mix; joins with any other
      // zone are blanketed with moss instead
      const bankH = kind === 'trunks' ? (wall.bank || 0.3) : H;
      const zoneMat = z => kind === 'trunks' ? loc.floor : loc.zones[z % loc.zones.length];
      const pairCount = new Map();
      for (let y = 0; y < maze.H; y++) for (let x = 0; x < W; x++) {
        if (!wallAt(x, y)) continue;
        const z0 = zoneAt(x, y);
        for (const [dx, dy] of [[1, 0], [0, 1]]) { if (wallAt(x + dx, y + dy)) { const z1 = zoneAt(x + dx, y + dy); if (z1 !== z0 && zoneMat(z1) !== zoneMat(z0)) { const k = `${z0}:${z1}`, k2 = `${z1}:${z0}`; pairCount.set(k, (pairCount.get(k) || 0) + 1); pairCount.set(k2, (pairCount.get(k2) || 0) + 1); } } }
      }
      const partner = {};
      for (const [k, n] of pairCount) { const [a, b] = k.split(':').map(Number); if (!(a in partner) || n > partner[a].n) partner[a] = { z: b, n }; }
      const seamAt = (x, y, z) => {
        const gx = Math.floor(x / c), gz = Math.floor(z / c);
        const z0 = wallAt(gx, gz) ? zoneAt(gx, gz) : -1;
        let bestPartner = 9, bestOther = 9;
        for (let j = gz - 1; j <= gz + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) {
          if (!wallAt(i, j) || (i === gx && j === gz)) continue;
          const zi = zoneAt(i, j);
          if (zi === z0 || zoneMat(zi) === zoneMat(z0)) continue;
          const dx = Math.max(i * c - x, 0, x - (i + 1) * c), dz = Math.max(j * c - z, 0, z - (j + 1) * c);
          const d = Math.hypot(dx, dz);
          if (partner[z0] && zi === partner[z0].z) bestPartner = Math.min(bestPartner, d); else bestOther = Math.min(bestOther, d);
        }
        // 0.5 at the join itself, fading to 0 a metre in
        return [Math.max(0, 1 - bestOther / 0.9), 0.5 * Math.max(0, 1 - bestPartner / 1.0)];
      };
      const builders = new Map();
      const bFor = z => { const m = zoneMat(z); if (!builders.has(m)) builders.set(m, { b: new MeshBuilder(wallAO, seamAt), z }); return builders.get(m).b; };
      const nSeg = Math.max(3, Math.round(c / 0.3));
      // rounding: the bank's convex edges (a wall's end, its top) are rounded over by this much, so a boulder
      // field is boulders and a bank is a bank, not a row of cut blocks. The collision keeps the unrounded
      // tile, which only ever stops the player a little short at a corner.
      const R = Math.min(kind === 'trunks' ? 0.12 : (wall.round ?? 0.25), c * 0.42, bankH * 0.6);
      // The surface is the tile region shrunk by R and swept back out by a sphere of R: vertical faces with
      // quarter-cylinder corners where a wall ends, a quarter-round over every top edge, a fillet where two
      // faces meet at an inner corner, and a flat cap over the shrunk top. It is built as one strip per
      // exposed edge (the face, then the round) and one cap per tile, all on the same grid lines, so every
      // neighbouring piece meets its neighbour vertex for vertex and the bank is watertight.
      const vSeg = Math.max(2, Math.round((bankH - R - (-0.3)) / 0.3)) + (this.q.high ? 3 : 1), nArc = this.q.high ? 5 : 3, nArc45 = 3;
      // the foot: no wall stands on the ground at a right angle; soil, needles and moss bank up against it, so the
      // face sweeps out into the floor in a concave curve this high, meeting the ground near level (and running on
      // under it, so the floor never shows a seam). The rows crowd toward the foot to keep the curve round.
      const COVE = Math.min(kind === 'trunks' ? bankH * 0.5 : 0.34, c * 0.2);
      const lines = [];
      for (let i = 0; i <= nSeg; i++) lines.push(i / nSeg * c);
      if (R > 0.01) for (const v of [R, c - R]) if (!lines.some(l => Math.abs(l - v) < 1e-6)) lines.push(v);
      lines.sort((a, b) => a - b);
      // what every face lost to the rounding: the share of its length at each end and its top, for whatever is placed on it
      const faceInfo = new Map();
      const infoFor = (x, y, dx, dy) => faceInfo.get(`${x},${y},${dx},${dy}`) || { a0: 0, a1: 1, top: H };
      this.faceInfo = infoFor; this.round = R;
      this.wallGeos = [];
      const SQ = Math.SQRT1_2;
      for (const [x, y] of cells) {
        const h = bankH;
        const b = bFor(zoneAt(x, y));
        const x0 = x * c, z0 = y * c, y0 = -0.3;
        // the carving, riding on the floor's relief so a wall on a slope keeps its height
        const D = (px, py, pz) => { const d = disp(px, py, pz, h); d[1] += floorY(px, pz); return d; };
        // what an edge's end meets: the next tile along is open (a convex corner, rounded in plan), or wall with the
        // diagonal open (the face runs on), or wall with the diagonal wall too (an inner corner, filleted)
        const endKind = (ax, ay, dx, dy) => open(x + ax, y + ay) ? 'convex' : open(x + ax + dx, y + ay + dy) ? 'straight' : 'concave';
        // one strip: S the start corner (local), u along the edge, nIn inward in plan; both ends by kind
        const strip = (S, u, nIn, tS, tE, tag) => {
          const cols = [];
          const nOut = [-nIn[0], -nIn[1]];
          // an inner corner: the strip fans out over the fillet square from the mitre to the corner, with a column
          // for every grid line the neighbour's cap has along the fillet's edge, so cap and fillet meet vertex for vertex
          const fillet = [];
          for (const l of lines) if (l > 1e-6 && l < R - 1e-6) fillet.push(l / R);
          if (tS === 'concave') for (const f of [1, ...fillet.slice().reverse()]) cols.push({ p: S, m: [nIn[0] - f * u[0], nIn[1] - f * u[1]] });
          if (tS === 'convex') {
            const C = [S[0] + R * (u[0] + nIn[0]), S[1] + R * (u[1] + nIn[1])];
            for (let k = nArc45; k >= 1; k--) { const f = k / nArc45 * Math.PI / 4, cs = Math.cos(f), sn = Math.sin(f); cols.push({ p: [C[0] + R * (cs * nOut[0] - sn * u[0]), C[1] + R * (cs * nOut[1] - sn * u[1])], m: [cs * nIn[0] + sn * u[0], cs * nIn[1] + sn * u[1]] }); }
          }
          const a0 = tS === 'convex' ? R : 0, a1 = tE === 'convex' ? c - R : c;
          for (const l of lines) if (l >= a0 - 1e-6 && l <= a1 + 1e-6) cols.push({ p: [S[0] + l * u[0], S[1] + l * u[1]], m: nIn });
          if (tE === 'convex') {
            const C = [S[0] + c * u[0] + R * (-u[0] + nIn[0]), S[1] + c * u[1] + R * (-u[1] + nIn[1])];
            for (let k = 1; k <= nArc45; k++) { const f = k / nArc45 * Math.PI / 4, cs = Math.cos(f), sn = Math.sin(f); cols.push({ p: [C[0] + R * (cs * nOut[0] + sn * u[0]), C[1] + R * (cs * nOut[1] + sn * u[1])], m: [cs * nIn[0] - sn * u[0], cs * nIn[1] - sn * u[1]] }); }
          }
          if (tE === 'concave') for (const f of [...fillet, 1]) cols.push({ p: [S[0] + c * u[0], S[1] + c * u[1]], m: [nIn[0] + f * u[0], nIn[1] + f * u[1]] });
          const nRows = vSeg + nArc;
          b.patch(cols.length - 1, nRows, tag, (i, j) => {
            const col = cols[i];
            let a = 0, yy;
            if (j <= vSeg) yy = y0 + (h - R - y0) * Math.pow(j / vSeg, 1.6);
            else { const th = (j - vSeg) / nArc * Math.PI / 2; a = R * (1 - Math.cos(th)); yy = h - R + R * Math.sin(th); }
            if (yy < COVE) { const t = Math.min(1, (COVE - yy) / COVE); a -= COVE * (1 - Math.sqrt(1 - t * t)) + Math.max(0, -yy) * 1.2; }
            const px = x0 + col.p[0] + col.m[0] * a, pz = z0 + col.p[1] + col.m[1] * a;
            const d = D(px, yy, pz);
            return [px + d[0], yy + d[1], pz + d[2]];
          });
        };
        const info = (dx, dy, startFree, endFree) => { const a = Math.min(0.45, R / c); const o = { a0: startFree ? a : 0, a1: endFree ? 1 - a : 1, top: h - R }; faceInfo.set(`${x},${y},${dx},${dy}`, o); return o; };
        // the along-direction of a face is +x for the north and south faces, +z for the east and west ones
        if (open(x, y - 1)) { const l = !open(x - 1, y), r = !open(x + 1, y); strip([c, 0], [-1, 0], [0, 1], endKind(1, 0, 0, -1), endKind(-1, 0, 0, -1), 'nz'); this.shootFaces.push({ ox: x0, oz: z0, ux: c, uz: 0, nx: 0, nz: -1, cx: x0 + c / 2, cz: z0, ...info(0, -1, !l, !r) }); }
        if (open(x, y + 1)) { const l = !open(x - 1, y), r = !open(x + 1, y); strip([0, c], [1, 0], [0, -1], endKind(-1, 0, 0, 1), endKind(1, 0, 0, 1), 'pz'); this.shootFaces.push({ ox: x0, oz: z0 + c, ux: c, uz: 0, nx: 0, nz: 1, cx: x0 + c / 2, cz: z0 + c, ...info(0, 1, !l, !r) }); }
        if (open(x - 1, y)) { const n = !open(x, y - 1), f = !open(x, y + 1); strip([0, 0], [0, 1], [1, 0], endKind(0, -1, -1, 0), endKind(0, 1, -1, 0), 'nx'); this.shootFaces.push({ ox: x0, oz: z0, ux: 0, uz: c, nx: -1, nz: 0, cx: x0, cz: z0 + c / 2, ...info(-1, 0, !n, !f) }); }
        if (open(x + 1, y)) { const n = !open(x, y - 1), f = !open(x, y + 1); strip([c, c], [0, -1], [-1, 0], endKind(0, 1, 1, 0), endKind(0, -1, 1, 0), 'px'); this.shootFaces.push({ ox: x0 + c, oz: z0, ux: 0, uz: c, nx: 1, nz: 0, cx: x0 + c, cz: z0 + c / 2, ...info(1, 0, !n, !f) }); }
        // the cap: the top inside the round, less the squares an inner corner's fillet takes (every tile, so a low
        // wall seen from above is closed everywhere)
        {
          const ex = [open(x - 1, y), open(x + 1, y), open(x, y - 1), open(x, y + 1)];   // -x +x -z +z
          const lo = [ex[0] ? R : 0, ex[2] ? R : 0], hi = [ex[1] ? c - R : c, ex[3] ? c - R : c];
          const concave = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([i, j]) => !open(x + i, y) && !open(x, y + j) && open(x + i, y + j));
          const inCap = (lx, lz) => {
            if (lx < lo[0] || lx > hi[0] || lz < lo[1] || lz > hi[1]) return false;
            const i = lx < R ? 0 : lx > c - R ? 1 : -1, j = lz < R ? 0 : lz > c - R ? 1 : -1;
            return !(i >= 0 && j >= 0 && concave[j * 2 + i]);
          };
          const n = lines.length - 1;
          b.patch(n, n, 'top', (i, j) => {   // i along z, j along x: the normal is up
            const px = x0 + lines[j], pz = z0 + lines[i];
            const d = D(px, h, pz);
            return [px + d[0], h + d[1], pz + d[2]];
          }, (i, j) => inCap((lines[j] + lines[j + 1]) / 2, (lines[i] + lines[i + 1]) / 2));
        }
      }
      for (const [m, { b, z }] of builders) {
        const geo = b.build();
        this.wallGeos.push(geo);
        const spec = MATERIAL_SPECS[m];
        const spec2 = partner[z] ? MATERIAL_SPECS[zoneMat(partner[z].z)] : spec;
        const cover = kind === 'trunks' ? coverF : coverW;
        const mats = this.matPair(spec, { ...diff, mossCover: cover }, pomSteps, wallShells, loc.moss, kind === 'trunks' ? loc.mud : 0, false, false, spec2);
        const mesh = new THREE.Mesh(geo, mats.solid);
        mesh.castShadow = true; mesh.receiveShadow = true;
        g.add(mesh);
        // a low bank needs few shells
        const sh = kind === 'trunks' ? Math.min(wallShells, 3) : wallShells;
        const fuzz = new THREE.InstancedMesh(geo, mats.fuzz, sh);
        for (let i = 0; i < sh; i++) fuzz.setMatrixAt(i, new THREE.Matrix4());
        fuzz.receiveShadow = true; fuzz.castShadow = false;
        fuzz.userData.layers = sh; this.fuzzMeshes.push(fuzz);
        g.add(fuzz);
      }
    }

    // --- where the banks really stand. The carving moves a wall's foot well off its grid square (back into it, or
    // out over the floor), so "how far to the wall" asked of the grid was wrong by up to half a metre: the floor's
    // contact shade went black over a strip of open ground beside every wall, and the floor moss stopped on the
    // grid line. The banks are rasterized from above once per build; the floor and the shoots ask this instead.
    // (about 0.1 s once per build on a desktop)
    // (log and trunk palisades have no bank geometry: on the first build wallGeos is not even set)
    this.foot = this.wallGeos && this.wallGeos.length ? footMap(this.wallGeos, floorY, W * c, maze.H * c, this.q.high ? 0.06 : 0.09) : null;
    const footDist = this.foot ? (x, z) => this.foot.dist(x, z) : distToWall;
    this.footDist = footDist;

    // --- floor: the location's ground with a moss carpet, uneven, cut by the stream
    {
      // moss creeps out from the foot of every wall over the first metre of ground (the shader breaks its edge up),
      // so the banked foot and the floor are one growth, not two materials meeting on a line; the ground right at
      // the foot is shaded, and the shade is gone a hand or two out
      const footAO = this.foot ? (x, y, z) => Math.min(1, 0.4 + 0.6 * footDist(x, z) / 0.35) : floorAO;
      const b = new MeshBuilder(footAO, (x, y, z) => [Math.max(0, Math.min(1, 1 - (footDist(x, z) - (this.foot ? 0.15 : 0.3)) / (this.foot ? 0.9 : 0.85))), 0]);
      const pad = 4 * c, x0 = -pad, z0 = -pad, L = W * c + 2 * pad, Lz = maze.H * c + 2 * pad;
      const step = this.q.high ? 0.3 : 0.4;   // fine enough for the contact shading under a stone to be round
      const n = Math.round(L / step), nz = Math.round(Lz / step);
      b.grid([x0, 0, z0], [0, 0, Lz], [L, 0, 0], nz, n, 'floor', (x, y, z) => [0, floorY(x, z), 0]);
      const geo = b.build();
      const mats = this.matPair(MATERIAL_SPECS[loc.floor], { ...diff, mossCover: coverF }, pomSteps, shells, loc.floorMoss, loc.mud);
      const mesh = new THREE.Mesh(geo, mats.solid); mesh.receiveShadow = true; g.add(mesh);
      this.floorGeo = geo;
      const fuzz = new THREE.InstancedMesh(geo, mats.fuzz, shells);
      for (let i = 0; i < shells; i++) fuzz.setMatrixAt(i, new THREE.Matrix4());
      fuzz.receiveShadow = true; fuzz.userData.layers = shells; this.fuzzMeshes.push(fuzz); g.add(fuzz);
    }

    // --- the build context for the props
    // every prop with a footprint goes through the guard; the maze's obstacles are the ones it accepted
    const pass = this.pass = new Passability(maze, c, H, 0.34);
    this.obstacles = pass.obstacles;
    if (kind !== 'carved') { this.faceInfo = () => ({ a0: 0, a1: 1, top: H }); this.round = 0; }
    const ctx = { maze, diff, loc, rng, c, H, W, group: g, world: this, open, wallAt, zoneAt, caveAt, exposed, cells, openCells, wallCells: cells, obstacles: this.obstacles, pass, floorY, stream, logTops: [], branchTips: [], distToWall, cellH, scans, kind, faceInfo: this.faceInfo, round: this.round, ...extras };
    const haveScans = scans.some(m => m.pieces.length);

    if (kind === 'logs') buildLogWalls(ctx);
    if (kind === 'trunks') buildTrunkWalls(ctx);
    if (loc.ceiling === 'tunnel') buildVaults(ctx);
    if (loc.ceiling === 'cave' || loc.ceiling === 'bridges') buildCaveCeiling(ctx);
    if (haveScans) {
      // the photoscans: trees, logs, stumps, rocks, roots, ferns, moss clumps; the far canopy cards still fill the sky
      buildScans(ctx);
      buildCanopy(ctx);
      buildMushrooms(ctx);
      buildPlants({ ...ctx, loc: { ...loc, props: { ...loc.props, ferns: 0, plants: 0 } } });
    } else {
      if (kind !== 'trunks') buildTrees(ctx);
      buildBoughMoss(ctx);
      buildCanopy(ctx);
      buildLogs(ctx);
      buildBoulders(ctx);
      buildMushrooms(ctx);
      buildPlants(ctx);
    }
    buildStream(ctx);
    buildWater(ctx);
    buildCushions(ctx);
    // the small true things: snails, frogs, the deer, the place's hidden find (through the guard like everything else)
    {
      const barkSpec = MATERIAL_SPECS[(loc.kit && loc.kit.bark) || 'wood'] || MATERIAL_SPECS.wood;
      const bark = this.matPair({ ...barkSpec, scale: 1.2, mossScale: 1.2, baseTint: 0x6a5a46 }, { ...diff, mossCover: 0.3, fuzz: 0.5 }, 1, 2, loc.moss, 0, true).solid;
      // the place's stone, for the rock the book waits on where there is no stump scan
      const stoneSpec = MATERIAL_SPECS[(loc.kit && loc.kit.rock) || 'stone'] || MATERIAL_SPECS.stone;
      const stone = (extras.wantBook || extras.wantTorch) && !(extras.pedestal && extras.pedestal.pieces.length) ? this.matPair({ ...stoneSpec, mossScale: 0.7 }, { ...diff, mossCover: 0.5, fuzz: 1 }, 1, 2, loc.moss, 0, true).solid : null;
      this.whimsy = buildWhimsy({ ...ctx, spots: wallSpots(ctx) }, { bark, stone });
    }
    if (new URLSearchParams(location.search).get('contact') !== '0') this.contactShade(g, floorY);   // ?contact=0: without, to compare
    // the proof, every level: the exit can be walked to past everything placed
    if (!pass.check()) console.error('Moss Maze: exit unreachable after props; this should be impossible');
    this.logTops = ctx.logTops; this.surfaces = ctx.surfaces || []; this.trunkPatches = ctx.trunkPatches || [];

    // --- crest tufts: clumps of grass and haircap along the tops of carved walls where there is sky above.
    // Each is a pair of crossed cards of a drawn tuft (four drawings, mirrored at random, each its own width and
    // height) rooted a few centimetres INSIDE the crest: on the quarter-round it leans out with the surface, behind
    // it it stands on the cap, and never on the rounded-away end of a wall. Its colour is the wall's own moss.
    if (kind === 'carved' && loc.ceiling !== 'tunnel') {
      const R = this.round, dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const species = loc.mosses.filter(m => !m.notMoss && m.form !== 'hanging');
      const lists = Array.from({ length: TUFT_VARIANTS }, () => []);
      const tint = new THREE.Color(), sp = new THREE.Color();
      for (const [x, y] of cells) {
        const h = cellH(x, y);
        const mossTint = MATERIAL_SPECS[loc.zones[zoneAt(x, y) % loc.zones.length]].mossTint;
        for (const [dx, dy] of dirs) {
          if (!open(x + dx, y + dy) || caveAt(x + dx, y + dy) || rng() < 0.4) continue;
          const fi = this.faceInfo(x, y, dx, dy);
          const n = 1 + Math.floor(rng() * 3);
          const f0 = fi.a0 + 0.1 + rng() * Math.max(0.05, fi.a1 - fi.a0 - 0.2);
          const d0 = R * 0.4 + rng() * (R * 0.6 + 0.22);
          const s0 = species[Math.floor(rng() * species.length)];
          for (let k = 0; k < n; k++) {
            const along = Math.max(fi.a0 + 0.06, Math.min(fi.a1 - 0.06, f0 + (rng() - 0.5) * 0.14));
            const inset = Math.max(R * 0.35, Math.min(c / 2 - 0.06, d0 + (rng() - 0.5) * 0.12));
            if (inset > c / 2 - 0.05) continue;
            const sOut = inset < R ? (R - inset) / R : 0, up = Math.sqrt(1 - sOut * sOut);
            let px = (x + 0.5) * c + dx * (c / 2 - inset) + (dy ? (along - 0.5) * c : 0);
            let pz = (y + 0.5) * c + dy * (c / 2 - inset) + (dx ? (along - 0.5) * c : 0);
            const crest = h - R + R * up;
            const dd = disp(px, crest, pz, h);
            px += dd[0]; pz += dd[2];
            const py = crest + dd[1] + floorY(px, pz);
            // the crest normal here, and the card sunk 3-4 cm along it
            const nx = dx * sOut, nz = dy * sOut, sink = 0.03 + rng() * 0.015;
            const w = (0.16 + rng() * 0.22) * (rng() < 0.5 ? -1 : 1), th = 0.05 + Math.pow(rng(), 1.6) * 0.22;
            tint.setHex(mossTint).multiply(sp.setHex(s0.color)).multiplyScalar(1.25 * (0.78 + rng() * 0.44));
            lists[Math.floor(rng() * TUFT_VARIANTS)].push([px - nx * sink, py - up * sink, pz - nz * sink, nx, up, nz, rng() * Math.PI, (rng() - 0.5) * 0.3, w, th, tint.r, tint.g, tint.b]);
          }
        }
      }
      const total = lists.reduce((n, l) => n + l.length, 0);
      if (total) {
        const mat = makeCardMaterial({ map: this.tuftTex, color: 0xffffff, mode: 'up', stiffness: 0.3, alphaTest: 0.45 });
        const depth = cardDepthMaterial(this.tuftTex, 0.45);
        this.materials.push(mat, depth);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), nrm = new THREE.Vector3(), upv = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
        lists.forEach((list, v) => {
          if (!list.length) return;
          // two crossed cards, this variant's column of the atlas
          const geo = new THREE.BufferGeometry();
          const u0 = v / TUFT_VARIANTS, u1 = (v + 1) / TUFT_VARIANTS;
          geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0, 0, 0, -0.5, 0, 0, 0.5, 0, 1, -0.5, 0, 1, 0.5], 3));
          geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0], 3));
          geo.setAttribute('uv', new THREE.Float32BufferAttribute([u0, 0, u1, 0, u0, 1, u1, 1, u0, 0, u1, 0, u0, 1, u1, 1], 2));
          geo.setIndex([0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6]);
          const mesh = new THREE.InstancedMesh(geo, mat, list.length);
          list.forEach(([x, y, z, nx, ny, nz, yaw, lean, w, th, r, g, b], i) => {
            nrm.set(nx, ny, nz).normalize();
            q.setFromUnitVectors(upv, nrm);
            q2.setFromAxisAngle(nrm, yaw); q.premultiply(q2);
            q2.setFromAxisAngle(new THREE.Vector3(1, 0, 0), lean); q.multiply(q2);
            pos.set(x, y, z); sc.set(w, th, Math.abs(w));
            mesh.setMatrixAt(i, m.compose(pos, q, sc));
            mesh.setColorAt(i, col.setRGB(r, g, b));
          });
          mesh.customDepthMaterial = depth;
          mesh.castShadow = true; mesh.receiveShadow = true;
          g.add(mesh);
        });
      }
    }

    // --- hanging moss, always from something: over the lip of a wall or log stack down its face, or from a cave or vault ceiling
    // (the scanned trees hang their own from their branches, in buildScans; a trunk palisade hangs its own from the trunks)
    const hangingSpecies = loc.mosses.filter(m => m.form === 'hanging' && !m.notMoss);
    const nHang = kind === 'trunks' ? 0 : diff.curtains + Math.round(loc.hanging * 14);
    if (nHang > 0) {
      const tintC = new THREE.Color(hangingSpecies[0] ? hangingSpecies[0].color : 0x8da85a).multiplyScalar(0.95);
      const kinds = this.hangTex.map((tex, k) => makeCardMaterial({ map: tex, color: k === 1 ? 0xd8dcc0 : k === 2 ? 0xc8d4b0 : tintC.getHex(), mode: 'hang', stiffness: k === 1 ? 0.6 : 0.4, alphaTest: 0.4, emissive: 0x141c10, emissiveIntensity: 0.5 }));
      this.materials.push(...kinds);
      const lists = kinds.map(() => []);
      const pickKind = () => Math.min(kinds.length - 1, Math.floor(Math.pow(rng(), 1.4) * kinds.length));
      // wall faces with sky or ceiling above them
      const faces = [];
      for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (open(x + dx, y + dy) && Math.abs(x - maze.start.x) + Math.abs(y - maze.start.y) >= 3) faces.push([x, y, dx, dy]);
      for (let i = 0; i < nHang && faces.length; i++) {
        const [x, y, dx, dy] = faces.splice(Math.floor(rng() * faces.length), 1)[0];
        const fi = this.faceInfo(x, y, dx, dy);
        // its top tucked over the lip: up the rounded edge, where the surface has drawn in by half the rounding, so the
        // strip lies on the stone from the top down instead of standing off the face with air behind it
        const R = this.round || 0;
        const h = Math.min(cellH(x, y), fi.top + R * 0.87), inset = R * 0.5;
        const n = 1 + Math.floor(rng() * 2);
        for (let k = 0; k < n; k++) {
          const w = 0.25 + rng() * 0.5, hgt = 0.4 + rng() * H * 0.5;
          const along = (fi.a0 + 0.08 + rng() * Math.max(0.05, fi.a1 - fi.a0 - 0.16) - 0.5) * c;
          // just off the face, its top at the lip of the wall, following the carving
          let px = (x + 0.5) * c + dx * (c / 2 - inset + 0.02) + (dy ? along : 0);
          let pz = (y + 0.5) * c + dy * (c / 2 - inset + 0.02) + (dx ? along : 0);
          if (kind === 'logs') {
            // a log stack ends where its top log ends, often well under the wall's height: hang from the upper front of
            // that log (none there, no strip)
            let best = null;
            for (const L of ctx.logTops) {
              if (!L.top) continue;
              const t = (px - L.x) * L.dirx + (pz - L.z) * L.dirz, lat = Math.abs((px - L.x) * L.dirz - (pz - L.z) * L.dirx);
              if (Math.abs(t) > L.half + L.r || lat > L.r + 0.4) continue;
              if (!best || L.y > best.L.y) best = { L, t };
            }
            if (!best) continue;
            const { L, t } = best, cx0 = L.x + L.dirx * t, cz0 = L.z + L.dirz * t;
            lists[pickKind()].push([cx0 + dx * L.r * 0.8, L.y - L.r * 0.45, cz0 + dy * L.r * 0.8, (dx ? Math.PI / 2 : 0) + (rng() - 0.5) * 0.3, w, Math.min(hgt, L.y - floorY(px, pz) - 0.1)]);
            continue;
          }
          const dd = disp(px, h, pz, h); px += dd[0]; pz += dd[2];
          lists[pickKind()].push([px, h + dd[1] - 0.04 + floorY(px, pz), pz, (dx ? Math.PI / 2 : 0) + (rng() - 0.5) * 0.3, w, hgt]);
        }
      }
      // from cave and vault ceilings: over the corridor, rooted in the rock above
      if (loc.ceiling === 'tunnel' || loc.ceiling === 'cave' || loc.ceiling === 'bridges') {
        const covered = openCells.filter(([x, y]) => loc.ceiling === 'tunnel' || caveAt(x, y));
        for (let i = 0; i < Math.round(nHang * 0.5) && covered.length; i++) {
          const [x, y] = covered.splice(Math.floor(rng() * covered.length), 1)[0];
          const n = 1 + Math.floor(rng() * 3);
          for (let k = 0; k < n; k++) {
            const w = 0.2 + rng() * 0.4, hgt = 0.3 + rng() * 0.9;
            const px = (x + 0.2 + rng() * 0.6) * c, pz = (y + 0.2 + rng() * 0.6) * c;
            const top = (loc.ceiling === 'tunnel' ? H - 0.5 + 0.38 + Math.min(1.1, c * 0.45) * 0.8 : H - 0.3 - 0.3) + floorY(px, pz);
            lists[pickKind()].push([px, top, pz, rng() * Math.PI, w, hgt]);
          }
        }
      }
      lists.forEach((list, k) => {
        if (!list.length) return;
        const geo = hangClumpGeometry();
        const mesh = new THREE.InstancedMesh(geo, kinds[k], list.length);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), e = new THREE.Euler();
        list.forEach(([x, y, z, yaw, w, hh], i) => { e.set(0, yaw, 0); q.setFromEuler(e); pos.set(x, y, z); s.set(w, hh, w); mesh.setMatrixAt(i, m.compose(pos, q, s)); });
        mesh.customDepthMaterial = cardDepthMaterial(this.hangTex[k], 0.4); this.materials.push(mesh.customDepthMaterial);
        mesh.castShadow = true; mesh.receiveShadow = true;
        g.add(mesh);
      });
    }

    // --- the exit: daylight through the opening
    {
      const ex = (maze.exit.x + edx * 2.5) * c + c / 2, ez = (maze.exit.y + edy * 2.5) * c + c / 2;
      // after dark the opening is the brightest thing there is, and pale: the sky beyond, not sunlight
      const light = new THREE.PointLight(new THREE.Color(0xfff1d6).lerp(new THREE.Color(0xdce6ff), night), (loc.ceiling === 'tunnel' ? 30 : 18) * (1 + 1.4 * night), c * (9 + 3 * night), 1.6);
      light.position.set(ex, Math.max(H, 1.8) * 0.9 + floorY(ex, ez), ez);
      g.add(light);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(0xffffff).lerp(new THREE.Color(0xc8d8ff), night), transparent: true, opacity: 0.55 + 0.25 * night, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      spr.scale.set(c * 4, c * 4, 1);
      const sx = (maze.exit.x + edx * 4) * c + c / 2, sz = (maze.exit.y + edy * 4) * c + c / 2;
      spr.position.set(sx, Math.max(H, 1.8) * 0.7 + floorY(sx, sz), sz);
      g.add(spr);
      this.materials.push(spr.material);
    }

    this.scene.add(g);
    this.shootWorld = {
      c, H, cover: coverW, coverFloor: coverF, faces: this.shootFaces, openCells, floorY, isOpen: open, footDist: this.foot ? footDist : null,
      species: loc.mosses.filter(m => !m.notMoss).map((m, index) => ({ color: new THREE.Color(m.color).multiplyScalar(1.0), form: m.form, index })),
      sources: this.shootSources, lowField: this.low.sample, sunDir: this.sunDir,
    };
    return g;
  }

  matPair(spec, diff, pomSteps, shells, mossSets, mud = 0, triplanar = false, meshUv = false, spec2 = null) {
    const t = this.tex;
    const common = {
      base: t.get(spec.base), mossA: t.get(mossSets[0]), mossB: t.get(mossSets[1]), strand: this.strand,
      cover: diff.mossCover, scale: spec.scale, mossScale: spec.mossScale,
      baseTint: spec.baseTint, mossTint: spec.mossTint, sunDir: this.sunDir,
      heightScale: this.q.high ? 0.014 : 0.008, fuzzHeight: 0.022 * diff.fuzz, mud, lowTex: this.low.tex,
      pomSteps, shells, types: this.types, wind: wind.vec, triplanar, meshUv, night: this.night || 0, drape: spec.drape || 0,
      base2: spec2 ? t.get(spec2.base) : t.get(spec.base), base2Tint: spec2 ? spec2.baseTint : spec.baseTint, scale2: spec2 ? spec2.scale : spec.scale,
    };
    const solid = makeMossMaterial(common);
    const fuzz = makeMossMaterial({ ...common, fuzz: true });
    this.materials.push(solid, fuzz);
    return { solid, fuzz, opts: common };
  }

  // the proof the bank is watertight: edges used by one triangle only, per wall mesh, excluding the bank's
  // buried foot (y near -0.3) and the uncovered outer perimeter; returns counts and a few sample positions
  openEdges() {
    const seen = new Map();
    const key = (p, i) => `${Math.round(p[i * 3] * 500)},${Math.round(p[i * 3 + 1] * 500)},${Math.round(p[i * 3 + 2] * 500)}`;
    for (const geo of this.wallGeos || []) {
      const pos = geo.attributes.position.array, idx = geo.index.array;
      for (let t = 0; t < idx.length; t += 3) {
        for (let e = 0; e < 3; e++) {
          const ka = key(pos, idx[t + e]), kb = key(pos, idx[t + (e + 1) % 3]);
          if (ka === kb) continue;
          const k = ka < kb ? ka + '|' + kb : kb + '|' + ka;
          seen.set(k, (seen.get(k) || 0) + 1);
        }
      }
    }
    let open = 0, foot = 0, rim = 0; const samples = [];
    const c = this.shootWorld ? this.shootWorld.c : 1, W = this.mazeW || 0, Hm = this.mazeH || 0;
    for (const [k, n] of seen) {
      if (n !== 1) continue;
      const [a, b] = k.split('|').map(s => s.split(',').map(Number).map(v => v / 500));
      const y = Math.max(a[1], b[1]), x = (a[0] + b[0]) / 2, z = (a[2] + b[2]) / 2;
      if (y < this.floorY(x, z) - 0.05) { foot++; continue; }
      if (x < 0.4 || z < 0.4 || x > W * c - 0.4 || z > Hm * c - 0.4) { rim++; continue; }   // the uncovered outer perimeter and the exit passage beyond it
      open++; if (samples.length < 12) samples.push([+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)]);
    }
    return { open, foot, rim, samples };
  }

  // contact shade: nothing that rests on the ground leaves the ground under and around it fully lit. Every
  // placed thing whose bounds reach down to the floor (rocks, stumps, logs, roots, cushions, the find) darkens
  // the floor's ambient occlusion round its footprint, deepest at its foot and fading over a hand or two,
  // wider for bigger things. Written into the floor's per-vertex AO once per build: costs nothing per frame.
  contactShade(g, floorY) {
    const geo = this.floorGeo; if (!geo) return;
    const skip = new Set([...(this.wallGeos || []), geo]);
    const fuzz = new Set(this.fuzzMeshes);
    const feet = [];
    const box = new THREE.Box3(), m = new THREE.Matrix4(), mw = new THREE.Matrix4();
    const take = () => {
      const r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
      if (r < 0.06 || r > 2.6) return;
      const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
      if (box.min.y > floorY(cx, cz) + 0.12) return;   // hanging, overhead, on a log: not on the ground
      feet.push([cx, cz, r, Math.min(1, (box.max.y - box.min.y) / Math.max(0.2, r))]);
    };
    g.updateMatrixWorld(true);
    g.traverse(o => {
      if (!(o.isMesh) || skip.has(o.geometry) || fuzz.has(o) || !o.visible || feet.length > 6000) return;
      if (o.material && (o.material.transparent || o.material.alphaTest > 0)) return;   // cards and leaves
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count && feet.length <= 6000; i++) { o.getMatrixAt(i, m); mw.multiplyMatrices(o.matrixWorld, m); box.copy(o.geometry.boundingBox).applyMatrix4(mw); take(); }
      } else { box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); take(); }
    });
    // a hash of the footprints by metre, for the floor's vertices to look up
    const cell = 1.5, hash = new Map();
    for (const f of feet) {
      const reach = f[2] + 0.25 + 0.6 * f[2];
      for (let j = Math.floor((f[1] - reach) / cell); j <= Math.floor((f[1] + reach) / cell); j++)
        for (let i = Math.floor((f[0] - reach) / cell); i <= Math.floor((f[0] + reach) / cell); i++) {
          const k = i + ',' + j; if (!hash.has(k)) hash.set(k, []); hash.get(k).push(f);
        }
    }
    const pos = geo.attributes.position, ao = geo.attributes.ao, seam = geo.attributes.seam;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), z = pos.getZ(v), list = hash.get(Math.floor(x / cell) + ',' + Math.floor(z / cell));
      if (!list) continue;
      let shade = 1, moss = 0;
      for (const [cx, cz, r, tall] of list) {
        const d = Math.hypot(x - cx, z - cz) - r * 0.8;   // the bounds are a box: its round foot sits a little inside
        const w = 0.2 + 0.55 * r, wm = 0.3 + 0.9 * r;
        if (d > wm) continue;
        // moss grows out from its foot over the ground (the shader breaks the edge up), so it stands grown in
        const tm = Math.max(0, Math.min(1, d / wm)); moss = Math.max(moss, 1 - tm * tm);
        if (d > w) continue;
        const t = Math.max(0, Math.min(1, d / w));
        shade *= 1 - (0.62 + 0.25 * tall) * (1 - t * t * (3 - 2 * t));
      }
      if (shade < 1) ao.setX(v, ao.getX(v) * shade);
      if (moss > seam.getX(v)) seam.setX(v, moss);
    }
    ao.needsUpdate = true; seam.needsUpdate = true;
    this.contactFeet = feet.length;
  }

  setFuzzQuality(q) {
    // draw only the lower layers when the budget drops; the shader keeps their spacing
    for (const f of this.fuzzMeshes) f.count = Math.max(2, Math.round(f.userData.layers * (0.3 + 0.7 * q)));
  }

  update(t) {
    for (const m of this.materials) {
      if (m.userData.uniforms) { m.userData.uniforms.uTime.value = t; m.userData.uniforms.uSnow.value = this.weather.snow; m.userData.uniforms.uDapple.value = this.dapple ?? 1; }
      if (m.userData.windUniforms) m.userData.windUniforms.uWindTime.value = t;
    }
    for (const w of this.waters) w.uniforms.uTime.value = t;
  }
}

// The banks seen from above: every wall triangle rasterized into a height grid (6 cm; 9 on phones), a cell is under a bank
// where the surface over it stands more than 10 cm above the ground, then a distance transform out from those
// cells. dist(x, z) is how far the ground there is from the foot of the nearest bank (0 under one).
function footMap(geos, floorY, Lx, Lz, res = 0.06) {
  const pad = 2, x0 = -pad, z0 = -pad;
  const nx = Math.ceil((Lx + 2 * pad) / res), nz = Math.ceil((Lz + 2 * pad) / res);
  const top = new Float32Array(nx * nz).fill(-1e9);
  for (const geo of geos) {
    const p = geo.attributes.position.array, idx = geo.index ? geo.index.array : null;
    const nt = idx ? idx.length / 3 : p.length / 9;
    for (let t = 0; t < nt; t++) {
      const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, cc = idx ? idx[t * 3 + 2] : t * 3 + 2;
      const ax = (p[a * 3] - x0) / res, ay = p[a * 3 + 1], az = (p[a * 3 + 2] - z0) / res;
      const bx = (p[b * 3] - x0) / res, by = p[b * 3 + 1], bz = (p[b * 3 + 2] - z0) / res;
      const cx = (p[cc * 3] - x0) / res, cy = p[cc * 3 + 1], cz = (p[cc * 3 + 2] - z0) / res;
      if (Math.max(ay, by, cy) < -0.15) continue;                         // the buried foot
      const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(den) < 1e-9) continue;                                  // edge-on from above
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), i1 = Math.min(nx - 1, Math.ceil(Math.max(ax, bx, cx)));
      const j0 = Math.max(0, Math.floor(Math.min(az, bz, cz))), j1 = Math.min(nz - 1, Math.ceil(Math.max(az, bz, cz)));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = i + 0.5, pz = j + 0.5;
        const w0 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den, w1 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den, w2 = 1 - w0 - w1;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const y = w0 * ay + w1 * by + w2 * cy, k = j * nx + i;
        if (y > top[k]) top[k] = y;
      }
    }
  }
  // the ground height on a coarse grid (floorY is a few noise octaves: 30 cm is fine enough to compare against)
  const gs = 0.3, gx = Math.ceil((Lx + 2 * pad) / gs) + 1, gz = Math.ceil((Lz + 2 * pad) / gs) + 1;
  const ground = new Float32Array(gx * gz);
  for (let j = 0; j < gz; j++) for (let i = 0; i < gx; i++) ground[j * gx + i] = floorY(x0 + i * gs, z0 + j * gs);
  const INF = 1e9, d = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (top[k] < -1e8) { d[k] = INF; continue; }
    const gi = Math.min(gx - 1, Math.round((i + 0.5) * res / gs)), gj = Math.min(gz - 1, Math.round((j + 0.5) * res / gs));
    d[k] = top[k] > ground[gj * gx + gi] + 0.1 ? 0 : INF;
  }
  // two-pass chamfer distance (in cells), then metres
  const D1 = 1, D2 = Math.SQRT2;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + D1);
    if (j > 0) { v = Math.min(v, d[k - nx] + D1); if (i > 0) v = Math.min(v, d[k - nx - 1] + D2); if (i < nx - 1) v = Math.min(v, d[k - nx + 1] + D2); }
    d[k] = v;
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i; let v = d[k];
    if (i < nx - 1) v = Math.min(v, d[k + 1] + D1);
    if (j < nz - 1) { v = Math.min(v, d[k + nx] + D1); if (i < nx - 1) v = Math.min(v, d[k + nx + 1] + D2); if (i > 0) v = Math.min(v, d[k + nx - 1] + D2); }
    d[k] = v;
  }
  for (let k = 0; k < d.length; k++) d[k] = Math.min(9, d[k] * res);
  return {
    res, nx, nz,
    dist(x, z) {
      const i = Math.floor((x - x0) / res), j = Math.floor((z - z0) / res);
      if (i < 0 || j < 0 || i >= nx || j >= nz) return 9;
      return d[j * nx + i];
    },
  };
}
