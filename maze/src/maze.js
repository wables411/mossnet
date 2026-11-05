// Maze generation and the difficulty curve.
//
// Two grids. The room grid is (2w+1) x (2h+1): cells with both coordinates
// odd are rooms, everything else starts as wall. A recursive backtracker
// carves the rooms into a perfect maze (one route between any two rooms,
// long winding corridors, many dead ends), biased toward going straight by
// the place's `straight`, then `braid` opens a share of the dead ends into
// loops. The exit is the boundary room farthest from the start.
//
// The tile grid is what gets built and walked. The place's layout says how
// a room grid becomes tiles: each room is `room` x `room` tiles, every wall
// between rooms is one tile thick, and a passage through a wall is `gap`
// tiles wide, so a place can be wide hollows joined by narrow gaps, an open
// field of low walls, or plain corridors.

export const OPEN = 0, WALL = 1, EXIT = 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT_LAYOUT = { room: 1, gap: 1, tile: 2.4, tileMin: 1.45, straight: 0.45, braid: 0.35, height: 2.7, heightMax: 3.6 };

// Progressive difficulty on top of the place's layout. `level` is 1-based,
// `minutesInMaze` keeps creeping the fog up the longer the player stays in
// the same maze.
export function difficulty(level, minutesInMaze = 0, loc = null) {
  const n = Math.max(1, level);
  const t = n - 1;
  const L = { ...DEFAULT_LAYOUT, ...((loc && loc.layout) || {}) };
  // the tile grid is kept near the size it has always been (about 49 tiles across at most)
  const cap = Math.floor(48 / (L.room + 1));
  const rooms = Math.min(cap, 6 + 2 * t);                 // rooms across
  const cell = Math.max(L.tileMin, L.tile - 0.07 * t);    // tile width, metres
  const stay = Math.min(1, Math.max(0, minutesInMaze - 1) / 3); // after 1 min, over 3 min
  return {
    level: n,
    rooms,
    cell,
    room: L.room, gap: L.gap, straight: L.straight,
    wallHeight: Math.min(L.heightMax, L.height + 0.08 * t),
    braid: Math.max(0, L.braid - 0.05 * t),                // share of dead ends turned into loops
    zones: Math.max(1, 5 - Math.floor(t / 2)),            // distinct materials = landmarks
    mossCover: Math.min(0.92, 0.5 + 0.045 * t),           // how much of the base material moss hides
    fog: (0.048 + 0.007 * t) * (1 + 0.35 * stay),         // exp2 fog density
    curtains: Math.min(40, Math.floor(t * 2.5)),          // hanging moss that blocks sightlines
    shafts: Math.max(0, 6 - t),                           // light shafts = landmarks
    fuzz: Math.min(1, 0.55 + 0.06 * t),                   // moss shell thickness
  };
}

// the room maze, then the tile grid it becomes
export function generateMaze(roomsW, roomsH, rng, opts = {}) {
  const rooms = roomMaze(roomsW, roomsH, rng, opts);
  return expandLayout(rooms, rng, opts);
}

function roomMaze(roomsW, roomsH, rng, opts) {
  const braid = opts.braid ?? 0;
  const straight = opts.straight ?? 0.45;
  const W = roomsW * 2 + 1, H = roomsH * 2 + 1;
  const grid = new Uint8Array(W * H).fill(WALL);
  const idx = (x, y) => y * W + x;
  const inside = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;

  // --- carve: iterative backtracker over room cells
  const sx = 1 + 2 * Math.floor(rng() * roomsW);
  const sy = 1 + 2 * Math.floor(rng() * roomsH);
  const stack = [[sx, sy]];
  grid[idx(sx, sy)] = OPEN;
  const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts2 = [];
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (inside(nx, ny) && grid[idx(nx, ny)] === WALL) opts2.push([nx, ny, dx, dy]);
    }
    if (!opts2.length) { stack.pop(); continue; }
    // bias toward continuing straight: longer corridors, fewer tiny turns
    let pick;
    if (stack.length > 1 && rng() < straight) {
      const [px, py] = stack[stack.length - 2];
      pick = opts2.find(o => o[2] === x - px && o[3] === y - py);
    }
    if (!pick) pick = opts2[Math.floor(rng() * opts2.length)];
    const [nx, ny, dx, dy] = pick;
    grid[idx(x + dx / 2, y + dy / 2)] = OPEN;
    grid[idx(nx, ny)] = OPEN;
    stack.push([nx, ny]);
  }

  // --- braid: open some dead ends into loops
  if (braid > 0) {
    const deadEnds = [];
    for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) {
      let open = 0;
      for (const [dx, dy] of dirs) if (grid[idx(x + dx / 2, y + dy / 2)] === OPEN) open++;
      if (open === 1) deadEnds.push([x, y]);
    }
    for (const [x, y] of deadEnds) {
      if (rng() >= braid) continue;
      const walls = [];
      for (const [dx, dy] of dirs) {
        const wx = x + dx / 2, wy = y + dy / 2, nx = x + dx, ny = y + dy;
        if (inside(nx, ny) && grid[idx(wx, wy)] === WALL) walls.push([wx, wy]);
      }
      if (walls.length) { const [wx, wy] = walls[Math.floor(rng() * walls.length)]; grid[idx(wx, wy)] = OPEN; }
    }
  }

  // --- start: a room on one side; exit: the boundary room farthest from it
  const start = { x: 1 + 2 * Math.floor(rng() * Math.min(2, roomsW)), y: 1 + 2 * Math.floor(rng() * roomsH) };
  const dist = bfs(grid, W, H, start.x, start.y);
  let best = -1, exitRoom = null;
  for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) {
    const onEdge = x === 1 || y === 1 || x === W - 2 || y === H - 2;
    if (!onEdge || (x === start.x && y === start.y)) continue;
    const d = dist[idx(x, y)];
    if (d > best) { best = d; exitRoom = { x, y }; }
  }
  // the outer wall next to the exit room (prefer the far side)
  const cand = [];
  if (exitRoom.x === W - 2) cand.push({ x: W - 1, y: exitRoom.y, dir: [1, 0] });
  if (exitRoom.x === 1) cand.push({ x: 0, y: exitRoom.y, dir: [-1, 0] });
  if (exitRoom.y === H - 2) cand.push({ x: exitRoom.x, y: H - 1, dir: [0, 1] });
  if (exitRoom.y === 1) cand.push({ x: exitRoom.x, y: 0, dir: [0, -1] });
  const exit = cand.sort((a, b) => (Math.abs(b.x - start.x) + Math.abs(b.y - start.y)) - (Math.abs(a.x - start.x) + Math.abs(a.y - start.y)))[0];
  return { W, H, grid, start, exitRoom, exit, roomsW, roomsH };
}

// room grid -> tile grid
function expandLayout(rm, rng, opts) {
  const R = Math.max(1, Math.round(opts.room ?? 1)), P = Math.max(1, Math.min(R, Math.round(opts.gap ?? 1)));
  const zonesN = opts.zones ?? 4;
  // tile coordinate of a room-grid coordinate: rooms (odd) span R tiles, walls (even) one tile
  const t0 = v => { const k = (v - 1) / 2; return v % 2 === 1 ? 1 + k * (R + 1) : (v / 2) * (R + 1); };
  const span = v => (v % 2 === 1 ? R : 1);
  const W = t0(rm.W - 1) + 1, H = t0(rm.H - 1) + 1;
  const grid = new Uint8Array(W * H).fill(WALL);
  const idx = (x, y) => y * W + x;
  const fill = (x, y, w, h, v) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) grid[idx(i, j)] = v; };
  for (let y = 0; y < rm.H; y++) for (let x = 0; x < rm.W; x++) {
    if (rm.grid[y * rm.W + x] !== OPEN) continue;
    const tx = t0(x), ty = t0(y), sx = span(x), sy = span(y);
    if (x % 2 === 1 && y % 2 === 1) { fill(tx, ty, sx, sy, OPEN); continue; }
    // a passage: `gap` tiles wide across the wall, placed somewhere along it
    const off = Math.floor(rng() * (R - P + 1));
    if (y % 2 === 0) fill(tx + off, ty, P, 1, OPEN); else fill(tx, ty + off, 1, P, OPEN);
  }
  // start and exit rooms: their centre tiles; the exit is the boundary tile beside the exit room
  const centre = v => t0(v) + Math.floor(R / 2);
  const start = { x: centre(rm.start.x), y: centre(rm.start.y) };
  const exitRoom = { x: centre(rm.exitRoom.x), y: centre(rm.exitRoom.y) };
  const [edx, edy] = rm.exit.dir;
  const exit = { x: edx ? (edx > 0 ? W - 1 : 0) : exitRoom.x, y: edy ? (edy > 0 ? H - 1 : 0) : exitRoom.y, dir: [edx, edy] };
  grid[idx(exit.x, exit.y)] = EXIT;
  // the whole start room and exit room stay clear of props
  const protect = [];
  for (const [rx, ry] of [[rm.start.x, rm.start.y], [rm.exitRoom.x, rm.exitRoom.y]]) for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) protect.push([t0(rx) + i, t0(ry) + j]);
  protect.push([exit.x, exit.y]);

  // --- zones: multi-source flood fill over the tile graph
  const zone = new Uint8Array(W * H).fill(255);
  const seeds = [];
  for (let i = 0; i < zonesN; i++) seeds.push([centre(1 + 2 * Math.floor(rng() * rm.roomsW)), centre(1 + 2 * Math.floor(rng() * rm.roomsH))]);
  const q = [];
  seeds.forEach(([x, y], i) => { if (zone[idx(x, y)] === 255) { zone[idx(x, y)] = i; q.push([x, y]); } });
  let qi = 0;
  while (qi < q.length) {
    const [x, y] = q[qi++];
    const z = zone[idx(x, y)];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const i = idx(nx, ny);
      if (zone[i] !== 255) continue;
      zone[i] = z;
      if (grid[i] !== WALL) q.push([nx, ny]); // walls take the zone but do not spread it
    }
  }
  for (let i = 0; i < zone.length; i++) if (zone[i] === 255) zone[i] = 0;

  // --- solution path for the facing at the start and the stats
  const path = [];
  {
    const d2 = bfs(grid, W, H, exit.x, exit.y);
    let cx = start.x, cy = start.y;
    path.push([cx, cy]);
    let guard = W * H;
    while ((cx !== exit.x || cy !== exit.y) && guard-- > 0) {
      let bx = cx, by = cy, bd = d2[idx(cx, cy)];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (grid[idx(nx, ny)] === WALL) continue;
        if (d2[idx(nx, ny)] < bd) { bd = d2[idx(nx, ny)]; bx = nx; by = ny; }
      }
      if (bx === cx && by === cy) break;
      cx = bx; cy = by; path.push([cx, cy]);
    }
  }

  return { W, H, grid, zone, start, exit, exitRoom, protect, path, solutionLength: path.length, zones: zonesN, room: R, gap: P };
}

function bfs(grid, W, H, sx, sy) {
  const dist = new Int32Array(W * H).fill(-1);
  const q = [[sx, sy]];
  dist[sy * W + sx] = 0;
  let qi = 0;
  while (qi < q.length) {
    const [x, y] = q[qi++];
    const d = dist[y * W + x];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const i = ny * W + nx;
      if (grid[i] === WALL || dist[i] >= 0) continue;
      dist[i] = d + 1;
      q.push([nx, ny]);
    }
  }
  return dist;
}
