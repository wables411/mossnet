// Keeps the maze walkable while props are placed. A prop with a footprint
// (log, stump, boulder) is only accepted if, in the cells it touches and their
// neighbours, every walk that was possible before it is still possible after
// it: the free space is sampled on a fine grid with the player's own collision
// rule (carved walls, prop circles, player radius), labelled into connected
// pieces with and without the candidate, and the candidate is refused if it
// splits or swallows any piece. Nothing at all is allowed in the start cell,
// the exit room or the exit itself. Because every accepted prop preserves local
// connectivity, the exit stays reachable by construction; `check()` walks the
// whole maze the same way as a final proof.
import { WALL } from './maze.js?v=28138280';
import { disp } from './geometry.js?v=d4fe5800';

const STEP = 0.1;
// placement is tested with the player grown by this much, so every channel it accepts is at least twice
// this wide for the real player: wider than the sampling step, so no walk at STEP can miss it
const GROW = 0.1;

export class Passability {
  constructor(maze, cell, wallHeight, playerRadius = 0.34) {
    this.maze = maze; this.c = cell; this.H = wallHeight; this.r = playerRadius;
    this.obstacles = [];            // accepted circles [x, z, r]
    this.buckets = new Map();       // cell key -> circles touching that cell
    this.dispCache = new Map();     // wall contact points -> carved offset
    const p = new Set([`${maze.start.x},${maze.start.y}`, `${maze.exit.x},${maze.exit.y}`, `${maze.exitRoom.x},${maze.exitRoom.y}`]);
    for (const [x, y] of maze.protect || []) p.add(`${x},${y}`);
    this.protected = p;
    this.rejected = 0;
  }

  isWall(gx, gy) { const m = this.maze; return gx >= 0 && gy >= 0 && gx < m.W && gy < m.H && m.grid[gy * m.W + gx] === WALL; }
  isOpen(gx, gy) { const m = this.maze; return gx >= 0 && gy >= 0 && gx < m.W && gy < m.H && m.grid[gy * m.W + gx] !== WALL; }

  // the player's wall test: the contact point on the cell box, moved by the same carving field as the wall mesh
  wallBlocked(x, z, grow = 0) {
    const c = this.c, r = this.r + grow;
    const minX = Math.floor((x - r) / c), maxX = Math.floor((x + r) / c), minZ = Math.floor((z - r) / c), maxZ = Math.floor((z + r) / c);
    for (let gz = minZ; gz <= maxZ; gz++) for (let gx = minX; gx <= maxX; gx++) {
      const outside = !(gx >= 0 && gz >= 0 && gx < this.maze.W && gz < this.maze.H);
      if (!outside && !this.isWall(gx, gz)) continue;
      let cx = Math.max(gx * c, Math.min(x, gx * c + c)), cz = Math.max(gz * c, Math.min(z, gz * c + c));
      if (!outside) {
        const k = `${Math.round(cx * 20)},${Math.round(cz * 20)}`;
        let d = this.dispCache.get(k);
        if (!d) { d = disp(cx, 1.1, cz, this.H); this.dispCache.set(k, d); }
        cx += d[0]; cz += d[2];
      }
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < (r + 0.03) * (r + 0.03)) return true;
    }
    return false;
  }

  key(gx, gz) { return gx + ',' + gz; }
  cellsOf(circle) {
    const [x, z, r] = circle, c = this.c, out = [];
    for (let gz = Math.floor((z - r) / c); gz <= Math.floor((z + r) / c); gz++) for (let gx = Math.floor((x - r) / c); gx <= Math.floor((x + r) / c); gx++) out.push([gx, gz]);
    return out;
  }
  nearObstacles(gx, gz) {
    const out = [];
    for (let j = gz - 1; j <= gz + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) { const b = this.buckets.get(this.key(i, j)); if (b) for (const o of b) if (!out.includes(o)) out.push(o); }
    return out;
  }
  hitsCircles(x, z, list, grow = 0) {
    const rr0 = this.r * 0.8 + grow;
    for (const [ox, oz, r] of list) { const rr = r + rr0 + 0.02, dx = x - ox, dz = z - oz; if (dx * dx + dz * dz < rr * rr) return true; }
    return false;
  }

  // the test: may these circles be added? returns true and records them, or false
  place(circles) {
    if (!circles.length) return true;
    const c = this.c;
    // nothing in the start cell, the exit room or the exit
    for (const [x, z, r] of circles) for (const [gx, gz] of this.cellsOf([x, z, r + this.r])) if (this.protected.has(this.key(gx, gz))) { this.rejected++; return false; }
    // not through another prop: a footprint may not overlap one already placed
    for (const [x, z, r] of circles) for (const [ox, oz, orad] of this.nearObstacles(Math.floor(x / c), Math.floor(z / c))) {
      const dx = x - ox, dz = z - oz, lim = orad + r * 0.6;
      if (dx * dx + dz * dz < lim * lim) { this.rejected++; return false; }
    }
    // the region: open cells within one of any cell the circles touch
    const region = new Set();
    let minGx = 1e9, maxGx = -1e9, minGz = 1e9, maxGz = -1e9;
    for (const circle of circles) for (const [gx, gz] of this.cellsOf(circle)) for (let j = gz - 1; j <= gz + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) {
      if (!this.isOpen(i, j)) continue;
      region.add(this.key(i, j));
      minGx = Math.min(minGx, i); maxGx = Math.max(maxGx, i); minGz = Math.min(minGz, j); maxGz = Math.max(maxGz, j);
    }
    if (!region.size) { this.rejected++; return false; }
    // sample the region's free space, with and without the candidate
    const x0 = minGx * c, z0 = minGz * c, nx = Math.ceil((maxGx + 1 - minGx) * c / STEP) + 1, nz = Math.ceil((maxGz + 1 - minGz) * c / STEP) + 1;
    const free0 = new Uint8Array(nx * nz), free1 = new Uint8Array(nx * nz);
    let any = false;
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = x0 + ix * STEP, z = z0 + iz * STEP, gx = Math.floor(x / c), gz = Math.floor(z / c);
      if (!region.has(this.key(gx, gz))) continue;
      if (this.wallBlocked(x, z, GROW) || this.hitsCircles(x, z, this.nearObstacles(gx, gz), GROW)) continue;
      const i = iz * nx + ix;
      free0[i] = 1; any = true;
      free1[i] = this.hitsCircles(x, z, circles, GROW) ? 0 : 1;
    }
    if (!any) { this.rejected++; return false; }
    const label0 = label(free0, nx, nz), label1 = label(free1, nx, nz);
    // each piece of the space before must survive as exactly one piece after
    const after = new Map();
    for (let i = 0; i < nx * nz; i++) {
      if (!free0[i]) continue;
      const a = label0[i], b = free1[i] ? label1[i] : 0;
      if (!after.has(a)) after.set(a, b);
      else if (after.get(a) === 0) { if (b) after.set(a, b); }
      else if (b && after.get(a) !== b) { this.rejected++; return false; }
    }
    for (const b of after.values()) if (b === 0) { this.rejected++; return false; }   // a pocket swallowed whole
    this.add(circles);
    return true;
  }

  add(circles) {
    for (const circle of circles) {
      this.obstacles.push(circle);
      for (const [gx, gz] of this.cellsOf(circle)) { const k = this.key(gx, gz); if (!this.buckets.has(k)) this.buckets.set(k, []); this.buckets.get(k).push(circle); }
    }
  }

  // is a point inside any footprint (used to keep small things from being placed inside logs and rocks)
  inside(x, z, margin = 0) {
    for (const [ox, oz, r] of this.nearObstacles(Math.floor(x / this.c), Math.floor(z / this.c))) { const rr = r + margin, dx = x - ox, dz = z - oz; if (dx * dx + dz * dz < rr * rr) return true; }
    return false;
  }

  // the proof: walk the whole maze from the start the way the player would; true when the exit is reached
  check(step = STEP, detail = null) {
    const m = this.maze, c = this.c;
    const nx = Math.ceil(m.W * c / step) + 1, nz = Math.ceil(m.H * c / step) + 1;
    const seen = new Uint8Array(nx * nz);
    const sx = Math.round((m.start.x + 0.5) * c / step), sz = Math.round((m.start.y + 0.5) * c / step);
    const q = [sx, sz]; seen[sz * nx + sx] = 1; let qi = 0;
    while (qi < q.length) {
      const ix = q[qi++], iz = q[qi++];
      const gx = Math.floor(ix * step / c), gz = Math.floor(iz * step / c);
      if (gx === m.exit.x && gz === m.exit.y) return true;
      if (detail) detail.reached.add(this.key(gx, gz));
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const jx = ix + dx, jz = iz + dz; if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
        const i = jz * nx + jx; if (seen[i]) continue; seen[i] = 1;
        const x = jx * step, z = jz * step, cgx = Math.floor(x / c), cgz = Math.floor(z / c);
        if (!this.isOpen(cgx, cgz)) continue;
        if (this.wallBlocked(x, z) || this.hitsCircles(x, z, this.nearObstacles(cgx, cgz))) continue;
        q.push(jx, jz);
      }
    }
    return false;
  }
}

// connected pieces of a free-space grid, 4-connected; 0 = not free
function label(free, nx, nz) {
  const out = new Int32Array(nx * nz); let next = 0;
  const q = [];
  for (let s = 0; s < nx * nz; s++) {
    if (!free[s] || out[s]) continue;
    next++; out[s] = next; q.length = 0; q.push(s);
    while (q.length) {
      const i = q.pop(), ix = i % nx, iz = (i - ix) / nx;
      if (ix > 0 && free[i - 1] && !out[i - 1]) { out[i - 1] = next; q.push(i - 1); }
      if (ix < nx - 1 && free[i + 1] && !out[i + 1]) { out[i + 1] = next; q.push(i + 1); }
      if (iz > 0 && free[i - nx] && !out[i - nx]) { out[i - nx] = next; q.push(i - nx); }
      if (iz < nz - 1 && free[i + nx] && !out[i + nx]) { out[i + nx] = next; q.push(i + nx); }
    }
  }
  return out;
}
