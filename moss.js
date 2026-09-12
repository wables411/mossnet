// The moss chart: the $MOSS chart grown as a Minecraft world.
//
// Columns run left to right in time. Surface height is price; volume decides how far
// moss has taken the stone (moss block → mossy cobblestone → bare cobble); a falling
// stretch dries the surface back to cobble and coarse dirt. Deterministic from the
// candles, so it is the same world for every visitor.
//
// The sky runs on real time, not Minecraft's 20-minute day: sunrise at 06:00, noon
// overhead, sunset at 18:00, stars after dark. UTC for everyone by default; your own
// clock once you are signed in.
//
// Every texture here is drawn in code. Mojang's own PNGs are theirs, so these are
// rebuilt from the real blocks' palettes and structure rather than shipped.
(function () {
  'use strict';

  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const hash2 = (x, y, seed) => { let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0; h = (h ^ (h >> 13)) * 1274126177 >>> 0; return (h ^ (h >> 16)) >>> 0; };
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const mix = (a, b, t) => a + (b - a) * t;
  const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  const css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

  // ---------- blocks ----------
  // 16x16, the way Minecraft draws them: flat palettes, no gradients, no anti-aliasing
  const T = 16;
  const PAL = {
    // cobblestone sits around #7a7a7a in game; these are the stone tones either side of it
    cobble: [[124, 124, 124], [137, 137, 137], [112, 112, 112], [147, 147, 147], [103, 103, 103]],
    cobbleLit: [158, 158, 158], cobbleDark: [92, 92, 92],
    grout: [[74, 74, 74], [62, 62, 62]],
    moss: [[88, 112, 45], [100, 128, 52], [74, 98, 37], [112, 142, 60], [62, 85, 31]],
    grass: [[95, 159, 53], [110, 175, 62], [82, 140, 44], [124, 186, 72]],
    dirt: [[134, 96, 67], [118, 82, 55], [155, 116, 83], [99, 68, 44], [172, 132, 97], [84, 57, 37]],
    coarse: [[124, 90, 63], [107, 76, 52], [143, 107, 77], [92, 64, 43], [77, 54, 36]],
    stone: [[128, 128, 128], [112, 112, 112], [146, 146, 146], [99, 99, 99], [161, 161, 161]],
    deepslate: [[84, 84, 89], [68, 68, 73], [101, 101, 107], [54, 54, 59], [116, 116, 122]],
    bedrock: [[85, 85, 85], [59, 59, 59], [108, 108, 108], [42, 42, 42], [130, 130, 130]],
    // the rock that actually generates underground: no cobblestone, which only comes from
    // dungeons and ruins, and tuff either side of the deepslate line where 1.17 put it
    tuff: [[108, 109, 102], [99, 100, 94], [117, 118, 110], [91, 92, 86]],
    andesite: [[136, 136, 136], [126, 126, 126], [145, 145, 145], [118, 118, 118]],
    granite: [[149, 103, 85], [136, 93, 77], [160, 114, 95], [126, 86, 71]],
    diorite: [[188, 188, 188], [205, 205, 205], [173, 173, 173], [215, 215, 215]],
    lava: [[212, 90, 18], [242, 164, 35], [255, 221, 85], [176, 62, 12], [255, 190, 60]]
  };

  // ore colours, straight off the vanilla blocks. Sulfur is not a Minecraft block —
  // redstone is the nearest thing to it.
  const ORES = {
    coal:     { c: [[25, 25, 25], [55, 55, 55]], deep: false },
    copper:   { c: [[224, 127, 86], [196, 109, 71]], deep: false },
    iron:     { c: [[216, 175, 147], [188, 141, 105]], deep: false },
    lapis:    { c: [[29, 71, 165], [42, 94, 196]], deep: true },
    gold:     { c: [[252, 238, 75], [219, 192, 42]], deep: true },
    redstone: { c: [[255, 0, 0], [196, 0, 0]], deep: true },
    diamond:  { c: [[74, 237, 217], [93, 236, 211]], deep: true },
    emerald:  { c: [[23, 221, 98], [67, 224, 122]], deep: true }
  };

  const px = (ctx, x, y, c) => { ctx.fillStyle = css(c); ctx.fillRect(x, y, 1, 1); };

  function tile(draw, seed) {
    const c = document.createElement('canvas');
    c.width = T; c.height = T;
    draw(c.getContext('2d'), rng(seed));
    return c;
  }

  // Cobblestone is a bed of rounded stones with a dark grout network between them:
  // flat mid-grey fills, a lit cap and a dark skirt on each stone, nothing else.
  function cobble(ctx, r, mossy) {
    const n = 5 + Math.floor(r() * 3), pts = [];
    for (let i = 0; i < n; i++) pts.push({ x: r() * T, y: r() * T, tone: Math.floor(r() * PAL.cobble.length) });
    // moss does not take whole stones: it comes in over the grout and creeps across
    // the faces in patches, so mask it on an 8x8 grid grown outwards
    const mask = new Uint8Array(64);
    if (mossy > 0) {
      for (let i = 0; i < 64; i++) mask[i] = r() < mossy ? 1 : 0;
      const grown = mask.slice();
      for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
        if (mask[gy * 8 + gx]) continue;
        let near = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = ((gy + dy + 8) % 8) * 8 + ((gx + dx + 8) % 8); near += mask[j]; }
        if (near >= 2 && r() < 0.6) grown[gy * 8 + gx] = 1;
      }
      grown.forEach((v, i) => mask[i] = v);
    }
    const wrap = (a, b) => { let d = Math.abs(a - b); return d > T / 2 ? T - d : d; };
    const near = (x, y) => {
      let b1 = 1e9, b2 = 1e9, hit = 0;
      for (let i = 0; i < n; i++) {
        const dx = wrap(x, pts[i].x), dy = wrap(y, pts[i].y), d = Math.sqrt(dx * dx + dy * dy);
        if (d < b1) { b2 = b1; b1 = d; hit = i; } else if (d < b2) b2 = d;
      }
      return { hit, edge: b2 - b1, d: b1 };
    };
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const { hit, edge } = near(x + 0.5, y + 0.5);
      const p = pts[hit];
      const green = mossy > 0 && (mask[(y >> 1) * 8 + (x >> 1)] || (edge < 0.8 && mask[(y >> 1) * 8 + ((x >> 1) + 1) % 8]));
      if (edge < 0.8) {                                             // grout, which moss takes first
        px(ctx, x, y, green ? PAL.moss[4] : PAL.grout[hash2(x, y, 17) % 2]);
        continue;
      }
      let c = green ? PAL.moss[p.tone % 3] : PAL.cobble[p.tone];
      if (edge < 1.7) {                                             // the rim of the stone: lit above, dark below
        const above = near(x + 0.5, y - 0.6).d > near(x + 0.5, y + 0.6).d;
        c = above ? (green ? PAL.moss[3] : PAL.cobbleLit) : (green ? PAL.moss[4] : PAL.cobbleDark);
      } else if ((hash2(x, y, hit * 977) % 100) < 5) {              // a little pitting, sparingly
        c = green ? PAL.moss[hash2(x, y, 5) % 5] : PAL.cobble[hash2(x, y, 7) % PAL.cobble.length];
      }
      px(ctx, x, y, c);
    }
  }

  // Dirt and moss are flat noise over a small palette, but the tones clump in twos and
  // threes rather than scattering evenly — the same way Mojang's do
  // a tone shifted off its own colour, so crevices and highlights widen the value range
  // wherever they fall and do not depend on how a palette happens to be ordered
  function clumpTone(c, k) {
    const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
    return [f(c[0]), f(c[1]), f(c[2])];
  }

  // A Minecraft block is not static: it is grains of rock or soil with dark crevices where
  // they meet and a few faces catching the light. Scatter seeds, give every pixel the tone of
  // its nearest one, darken the seam between cells, lift a few grains, then sprinkle grit.
  // Distances wrap, so a tile still sits against a copy of itself without a seam.
  function noiseTile(ctx, r, pal, weights) {
    const pick = k => { let i = 0, acc = 0; for (; i < weights.length - 1; i++) { acc += weights[i]; if (k < acc) break; } return i; };
    const n = 7 + Math.floor(r() * 5);
    const sx = [], sy = [], st = [];
    for (let i = 0; i < n; i++) { sx.push(r() * T); sy.push(r() * T); st.push(pal[pick(r())]); }
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let best = 1e9, second = 1e9, bi = 0;
      for (let i = 0; i < n; i++) {
        let dx = Math.abs(x + 0.5 - sx[i]); if (dx > T / 2) dx = T - dx;
        let dy = Math.abs(y + 0.5 - sy[i]); if (dy > T / 2) dy = T - dy;
        const d = dx * dx + dy * dy;
        if (d < best) { second = best; best = d; bi = i; } else if (d < second) second = d;
      }
      const seam = Math.sqrt(second) - Math.sqrt(best);
      let c = st[bi];
      if (seam < 0.7) c = clumpTone(c, 0.72);                        // the crevice between two grains
      else if (r() < 0.20) c = pal[pick(r())];                       // grit within the grain
      else if (r() < 0.10) c = clumpTone(c, 1.14);                   // a face catching the light
      px(ctx, x, y, c);
    }
    for (let i = 0; i < 4; i++) {                                    // a few bright grains on top
      const x = Math.floor(r() * T), y = Math.floor(r() * T);
      px(ctx, x, y, clumpTone(pal[0], 1.26));
      if (r() < 0.45) px(ctx, (x + 1) % T, y, clumpTone(pal[0], 1.18));
    }
    for (let i = 0; i < 3; i++) {                                    // and a few pits
      const x = Math.floor(r() * T), y = Math.floor(r() * T);
      px(ctx, x, y, clumpTone(pal[0], 0.66));
    }
  }

  function streaked(ctx, r, pal) {                                   // deepslate runs in vertical seams
    for (let x = 0; x < T; x++) {
      let c = pal[Math.floor(r() * pal.length)];
      for (let y = 0; y < T; y++) {
        if (r() < 0.24) c = pal[Math.floor(r() * pal.length)];
        px(ctx, x, y, r() < 0.10 ? clumpTone(c, 1.16) : c);
      }
    }
    for (let i = 0; i < 5; i++) {                                    // the dark seams between the seams
      const x = Math.floor(r() * T), y0 = Math.floor(r() * T), h = 3 + Math.floor(r() * 7);
      for (let k = 0; k < h; k++) px(ctx, x, (y0 + k) % T, clumpTone(pal[0], 0.70));
    }
  }

  function grassSide(ctx, r, moss) {
    noiseTile(ctx, r, PAL.dirt, [0.40, 0.26, 0.20, 0.08, 0.06]);
    const pal = moss ? PAL.moss : PAL.grass;
    // the overhang is ragged and runs a little further down in places, the way the real
    // grass block does, with a dark line under it where it meets the soil
    let h = 3 + Math.floor(r() * 2);
    for (let x = 0; x < T; x++) {
      h = Math.max(2, Math.min(7, h + (r() < 0.42 ? (r() < 0.5 ? 1 : -1) : 0)));
      for (let y = 0; y < h; y++) {
        const c = pal[Math.floor(r() * pal.length)];
        px(ctx, x, y, y === 0 && r() < 0.3 ? clumpTone(c, 1.15) : c);
      }
      px(ctx, x, h, clumpTone(pal[Math.floor(r() * pal.length)], 0.74));
      if (r() < 0.3) px(ctx, x, h + 1, clumpTone(pal[Math.floor(r() * pal.length)], 0.8));
    }
  }

  // Bedrock is the one block with no pattern at all: big irregular blotches
  function bedrock(ctx, r) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(ctx, x, y, PAL.bedrock[Math.floor(r() * PAL.bedrock.length)]);
    for (let i = 0; i < 26; i++) {
      const w = 1 + Math.floor(r() * 4), h = 1 + Math.floor(r() * 4);
      ctx.fillStyle = css(PAL.bedrock[Math.floor(r() * PAL.bedrock.length)]);
      ctx.fillRect(Math.floor(r() * T), Math.floor(r() * T), w, h);
    }
  }

  function lava(ctx, r) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const k = r();
      px(ctx, x, y, PAL.lava[k < 0.42 ? 0 : k < 0.72 ? 1 : k < 0.86 ? 3 : k < 0.95 ? 4 : 2]);
    }
    for (let i = 0; i < 8; i++) {                                     // the bright cells on the surface
      ctx.fillStyle = css(PAL.lava[2]);
      ctx.fillRect(Math.floor(r() * T), Math.floor(r() * T), 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 2));
    }
  }

  // An ore is its host rock with a handful of coloured blobs cut into it
  function ore(ctx, r, host, colours) {
    streaked(ctx, r, host);
    const n = 4 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const x = 1 + Math.floor(r() * (T - 4)), y = 1 + Math.floor(r() * (T - 4));
      const w = 2 + Math.floor(r() * 2), h = 2 + Math.floor(r() * 2);
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
        if (r() < 0.18) continue;
        px(ctx, x + dx, y + dy, colours[r() < 0.6 ? 0 : 1]);
      }
    }
  }

  // one flat colour per block, got by letting the browser scale its texture down to a single
  // pixel. Used only under the cubes, where a seam would otherwise show the sky
  const AVG = {};
  function avgOf(name) {
    if (AVG[name]) return AVG[name];
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.drawImage(SETS[name][0], 0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    return (AVG[name] = `rgb(${d[0]},${d[1]},${d[2]})`);
  }

  // Minecraft's lava scrolls rather than flickering: one tall field of molten noise with the
  // colour smeared downwards into flow lines, sampled at a moving offset. Sixteen frames, and the
  // field is laid down twice end to end so a slice never runs off the bottom.
  const LAVA_FRAMES = 16;
  let LAVA = null;
  function buildLava(seed) {
    const h = T * 2;
    const field = document.createElement('canvas');
    field.width = T; field.height = h;
    const fg = field.getContext('2d'), r = rng(seed + 1717);
    let carry = new Array(T).fill(0);
    for (let y = 0; y < h; y++) for (let x = 0; x < T; x++) {
      if (y === 0 || r() < 0.34) carry[x] = r() < 0.42 ? 0 : r() < 0.72 ? 1 : r() < 0.86 ? 3 : r() < 0.95 ? 4 : 2;
      px(fg, x, y, PAL.lava[carry[x]]);
    }
    for (let i = 0; i < 10; i++) {                                   // the bright cells riding on top
      const x = Math.floor(r() * T), y = Math.floor(r() * h);
      fg.fillStyle = css(PAL.lava[2]);
      fg.fillRect(x, y, 1 + Math.floor(r() * 3), 1 + Math.floor(r() * 2));
    }
    const strip = document.createElement('canvas');
    strip.width = T; strip.height = h * 2;
    const sg = strip.getContext('2d');
    sg.imageSmoothingEnabled = false;
    sg.drawImage(field, 0, 0); sg.drawImage(field, 0, h);
    LAVA = [];
    for (let f = 0; f < LAVA_FRAMES; f++) {
      const c = document.createElement('canvas');
      c.width = c.height = T;
      const cg = c.getContext('2d');
      cg.imageSmoothingEnabled = false;
      cg.drawImage(strip, 0, Math.round(f * h / LAVA_FRAMES), T, T, 0, 0, T, T);
      LAVA.push(c);
    }
  }
  function lavaFrame(t) { return LAVA ? LAVA[Math.floor(t / 190) % LAVA_FRAMES] : null; }

  // Moss creeping over rock: thin tendrils that wander across the face and leave the block
  // showing between them, the way moss and glow lichen spread in a lush cave.
  const VEIN_VARIANTS = 5;
  let VEINS = null;
  function buildVeins(seed) {
    VEINS = [];
    for (let v = 0; v < VEIN_VARIANTS; v++) {
      const c = document.createElement('canvas');
      c.width = c.height = T;
      const g = c.getContext('2d'), r = rng(seed + 5171 + v * 331);
      const runs = 2 + Math.floor(r() * 3);
      for (let i = 0; i < runs; i++) {
        let x = Math.floor(r() * T), y = Math.floor(r() * T);
        const len = 7 + Math.floor(r() * 15);
        for (let k = 0; k < len; k++) {
          const wrap = (v2) => ((v2 % T) + T) % T;
          px(g, wrap(x), wrap(y), PAL.moss[Math.floor(r() * PAL.moss.length)]);
          if (r() < 0.42) px(g, wrap(x + 1), wrap(y), clumpTone(PAL.moss[0], 0.66));
          if (r() < 0.22) px(g, wrap(x), wrap(y + 1), clumpTone(PAL.moss[0], 1.12));
          if (r() < 0.62) x += r() < 0.5 ? 1 : -1;
          if (r() < 0.52) y += r() < 0.5 ? 1 : -1;
        }
      }
      VEINS.push(c);
    }
  }

  const VARIANTS = 4;
  const SETS = {};
  function buildTiles(seed) {
    const make = (name, fn) => { SETS[name] = []; for (let v = 0; v < VARIANTS; v++) SETS[name].push(tile(fn, seed + v * 7919 + name.length * 131 + name.charCodeAt(0) * 37)); };
    make('cobble', (c, r) => cobble(c, r, 0));
    make('mossy', (c, r) => cobble(c, r, 0.42));
    make('moss', (c, r) => noiseTile(c, r, PAL.moss, [0.34, 0.24, 0.20, 0.12, 0.10]));
    make('dirt', (c, r) => noiseTile(c, r, PAL.dirt, [0.40, 0.26, 0.20, 0.14]));
    make('coarse', (c, r) => noiseTile(c, r, PAL.coarse, [0.26, 0.24, 0.18, 0.18, 0.14]));
    make('stone', (c, r) => noiseTile(c, r, PAL.stone, [0.34, 0.26, 0.20, 0.12, 0.08]));
    make('deepslate', (c, r) => streaked(c, r, PAL.deepslate));
    make('tuff', (c, r) => noiseTile(c, r, PAL.tuff, [0.30, 0.28, 0.24, 0.18]));
    make('andesite', (c, r) => noiseTile(c, r, PAL.andesite, [0.30, 0.28, 0.24, 0.18]));
    make('granite', (c, r) => noiseTile(c, r, PAL.granite, [0.32, 0.26, 0.24, 0.18]));
    make('diorite', (c, r) => noiseTile(c, r, PAL.diorite, [0.30, 0.26, 0.24, 0.20]));
    make('grass', (c, r) => grassSide(c, r, false));
    make('grasstop', (c, r) => noiseTile(c, r, PAL.grass, [0.34, 0.30, 0.20, 0.16]));
    make('mosstop', (c, r) => noiseTile(c, r, PAL.moss, [0.30, 0.26, 0.20, 0.14, 0.10]));
    make('mossgrass', (c, r) => grassSide(c, r, true));
    make('bedrock', bedrock);
    make('lava', lava);
    for (const [name, o] of Object.entries(ORES)) {
      make(`${name}`, (c, r) => ore(c, r, PAL.stone, o.c));
      make(`${name}_deep`, (c, r) => ore(c, r, PAL.deepslate, o.c));
    }
  }

  // where each ore turns up, and how often, roughly following vanilla's bands
  // The 1.21 distribution, written as depth from the surface (0) to bedrock (1) -- the surface
  // standing in for y=64 and bedrock for y=-64, so the halfway mark is y=0 and the deepslate line.
  const ORE_RULES = [
    { name: 'coal', from: 0.00, to: 0.45, chance: 34 },        // y=0 and up, thickest near the surface
    { name: 'copper', from: 0.02, to: 0.60, chance: 22 },      // peaks at y=48
    { name: 'iron', from: 0.10, to: 0.95, chance: 30 },        // two peaks, y=16 and the mountains
    { name: 'lapis', from: 0.40, to: 0.70, chance: 12 },       // peaks at y=0, right on the line
    { name: 'gold', from: 0.50, to: 0.92, chance: 16 },        // peaks at y=-16
    { name: 'redstone', from: 0.62, to: 1.00, chance: 22 },    // below y=-32, heaviest at the bottom
    { name: 'diamond', from: 0.70, to: 1.00, chance: 14 },     // y=16 down, peaks at y=-59
    { name: 'emerald', from: 0.05, to: 0.45, chance: 2 }       // mountains only, and never much
  ];

  // ores come in small clusters, so decide on a 2x2 cell rather than per block
  function oreAt(x, y, depth, seed) {
    const cell = hash2(x >> 1, y >> 1, seed + 613);
    let roll = cell % 1000;
    for (const o of ORE_RULES) {
      if (depth < o.from || depth > o.to) continue;
      if (roll < o.chance) return o.name;
      roll -= o.chance;
    }
    return null;
  }

  // ---------- the world ----------
  // Daily volume, in dollars, that leaves a column completely mossed over. Calibrated to this
  // pool rather than to a guess: its busiest day on record is $173 and its median day $49, so a
  // reference of 2500 meant the moss thresholds were never reached and every column came out bare.
  const VREF = 150;

  function build(candles, cols, rows) {
    // price on a log scale, the way a chart is read — otherwise one spike flattens
    // the whole world into a floor
    const closes = candles.map(c => Math.log(Math.max(1e-12, c[4])));
    const lo = Math.min(...closes), hi = Math.max(...closes), range = hi - lo || 1;
    const vols = candles.map(c => c[5]), vMax = Math.max(...vols) || 1;
    const per = candles.length / cols;
    // candles may be daily, hourly or ten-minute; the reference is a daily rate, so
    // scale each candle's volume up to what it would be over a whole day
    const stride = candles.length > 1 ? Math.max(60, candles[1][0] - candles[0][0]) : 86400;
    const perDay = 86400 / stride;
    const surf = new Int32Array(cols), vol = new Float32Array(cols), dry = new Float32Array(cols), chg = new Float32Array(cols);
    for (let x = 0; x < cols; x++) {
      const i0 = Math.floor(x * per), i1 = Math.max(i0 + 1, Math.floor((x + 1) * per));
      let close = closes[Math.min(closes.length - 1, i0)], v = 0, red = 0, n = 0, low = 1e9;
      const open = Math.log(Math.max(1e-12, candles[Math.min(candles.length - 1, i0)][1]));
      for (let i = i0; i < i1 && i < candles.length; i++) { close = closes[i]; low = Math.min(low, closes[i]); v += vols[i]; red += candles[i][4] < candles[i][1] ? 1 : 0; n++; }
      chg[x] = close - open;                                      // the column's whole move, in logs
      // a heavy sell should land as one cliff, not a gentle slope: take the low
      if (chg[x] < -0.10) close = close * 0.35 + low * 0.65;
      const ground = Math.min(Math.round(rows * 0.42), Math.max(1, rows - 7));   // sky above, world below; zoomed right in, the sky gives way so the price still has rows to move in
      // the lowest column still stands at least two blocks above bedrock, whatever the zoom
      surf[x] = Math.min(rows - 4, Math.round(rows - 1 - (0.06 + 0.90 * ((close - lo) / range)) * (rows - 1 - ground)));
      // volume is measured against a fixed reference, not against the world's own
      // maximum: a dead market really is bare stone, a busy one really is buried
      const daily = (v / Math.max(1, n)) * perDay;
      vol[x] = clamp01(Math.sqrt(daily / VREF));
      dry[x] = n ? red / n : 0;
    }
    const spread = new Float32Array(cols);
    for (let x = 0; x < cols; x++) {                                 // moss creeps sideways from the wet columns
      let a = 0, w = 0;
      // a column with as many red candles as green is normal weather; only a
      // sustained decline actually dries the moss back
      for (let k = -3; k <= 3; k++) { const j = x + k; if (j < 0 || j >= cols) continue; const g = 1 / (1 + Math.abs(k)); a += vol[j] * (1 - clamp01((dry[j] - 0.45) * 1.8) * 0.7) * g; w += g; }
      spread[x] = a / w;
    }
    return { surf, vol, dry, spread, chg };
  }

  // Terrain is drawn once onto its own canvas with the sky left transparent, so the
  // sky and the light level can move without rebuilding the world
  // what sits on top of each block when its upper face shows
  const TOPS = { tuff: 'tuff', andesite: 'andesite', granite: 'granite', diorite: 'diorite', grass: 'grasstop', mossgrass: 'mosstop', dirt: 'dirt', coarse: 'coarse', moss: 'mosstop', mossy: 'mossy', cobble: 'cobble', stone: 'stone', deepslate: 'deepslate' };
  const FACE_TOP = -0.16, FACE_SIDE = 0.30;                          // Minecraft's fixed face lighting: top brightest, side darkest

  // Terrain is drawn once onto its own canvas with the sky left transparent, so the
  // sky and the light level can move without rebuilding the world
  function drawTerrain(cols, rows, bs, candles, seed) {
    const sh = Math.max(2, Math.round(bs * 0.42));                   // how far a top face reaches up and to the right
    const c = document.createElement('canvas');
    c.width = cols * bs + sh; c.height = rows * bs;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const { surf, dry, spread, chg } = build(candles, cols, rows);

    // 1. decide the world: a name and a shade per cell, or nothing
    const grid = new Array(cols * rows).fill(null);
    const at = (x, y) => (x < 0 || x >= cols || y < 0 || y >= rows) ? null : grid[y * cols + x];
    const set = (x, y, name, shade) => { if (x >= 0 && x < cols && y >= 0 && y < rows) grid[y * cols + x] = name ? { name, shade: shade || 0 } : null; };

    // The column, bottom up: lava, bedrock, deepslate, stone, cobblestone, then the
    // soil cap — dirt with grass or moss on it. Price decides where the surface sits,
    // so a long sell-off walks the world down towards the lava.
    const rLava = rows - 1, rBed = rows - 2;
    const rDeep = Math.max(2, rBed - Math.round(rows * 0.20));

    // How tall each column's moss stack wants to be, worked out before anything is placed, so
    // the surface can be pushed down far enough for the biggest one to fit on screen. A tall
    // candle running off the top is the one thing the frame must not do.
    const want = new Int32Array(cols);
    for (let x = 0; x < cols; x++) {
      const wet0 = clamp01(spread[x] * 1.15 + 0.05 - clamp01((dry[x] - 0.5) * 2) * 0.25);
      const burn0 = clamp01((Math.max(0, -chg[x]) - 0.10) / 0.30);
      const life0 = clamp01(wet0 * 0.75 + (1 - dry[x]) * 0.45 - 0.18) * (1 - burn0 * 0.95);
      const boom0 = clamp01((Math.max(0, chg[x]) - 0.10) / 0.30);
      want[x] = Math.round(boom0 * 6) + (life0 > 0.55 ? 1 : 0);
    }
    let drop = 0;
    for (let x = 0; x < cols; x++) drop = Math.max(drop, want[x] + 1 - surf[x]);
    if (drop > 0) for (let x = 0; x < cols; x++) surf[x] = Math.min(rBed - 2, surf[x] + drop);

    for (let x = 0; x < cols; x++) {
      const top = surf[x];
      const wet = clamp01(spread[x] * 1.15 + 0.05 - clamp01((dry[x] - 0.5) * 2) * 0.25);
      const green = 1 - dry[x];
      const move = chg[x];
      const burn = clamp01((Math.max(0, -move) - 0.10) / 0.30);
      const boom = clamp01((Math.max(0, move) - 0.10) / 0.30);
      const flat = clamp01(1 - Math.abs(move) / 0.025);
      const life = clamp01(wet * 0.75 + green * 0.45 - 0.18) * (1 - burn * 0.95);
      const cap = burn > 0.12 ? 0 : life > 0.5 ? 3 : 2;

      // Depth as a fraction of this column's own reach from the surface to bedrock, so the
      // strata hold their proportions whether the world is seven rows tall or twenty-three.
      // Absolute block counts were the bug: soil ate the whole column and the stone band,
      // ores and all, came out zero rows deep at the closer zooms.
      const span = Math.max(1, rBed - top);
      // moss, grass, mossy cobble and dirt own the top two thirds of the column; stone, tuff
      // and deepslate keep their order but are compressed into what is left
      const soil = Math.max(1, Math.round(span * 0.42));
      for (let y = top; y < rows; y++) {
        const depth = y - top;
        const f = Math.min(1, depth / span);                      // 0 at the surface, 1 at bedrock
        const deep = f >= 0.82;                                   // deepslate only down at the bottom
        let name, shade = Math.min(0.26, depth * 0.020);
        if (y >= rLava) { name = 'lava'; shade = 0; }
        else if (y >= rBed) { name = 'bedrock'; shade = 0.10; }
        else if (depth === 0) {
          name = burn > 0.55 ? 'deepslate'
               : burn > 0.12 ? 'stone'
               : flat > 0.5 && life > 0.14 ? 'mossy'
               : life > 0.52 ? 'moss' : life > 0.30 ? 'mossgrass' : life > 0.16 ? 'grass'
               : dry[x] > 0.6 ? 'coarse' : 'cobble';
          shade = burn > 0.12 ? 0.06 : -0.04;
        } else if (burn > 0.12 && depth <= 2 + Math.round(burn * 4)) {
          name = burn > 0.55 && depth > 2 ? 'deepslate' : 'stone';
        } else if (life > 0.34 && depth <= Math.max(1, Math.round(span * (life > 0.66 ? 0.38 : 0.22)))) {
          name = 'moss'; shade = depth === 1 ? -0.02 : shade;
        } else if (depth <= soil) {
          name = dry[x] > 0.66 ? 'coarse' : 'dirt';
          if (depth === 1) shade = -0.02;
        } else {
          const o = oreAt(x, y, f, seed);
          if (o) name = deep ? `${o}_deep` : o;
          else if (f > 0.72 && f < 0.82) name = 'tuff';           // the band above the deepslate
          else if (deep) name = 'deepslate';
          else {
            // mossy cobble is the common rock up near the soil; stone with speckled blobs below
            const blob = hash2(x >> 1, y >> 1, seed + 777) % 100;
            name = (hash2(x, y, 11) % 100) < 34 + life * 46 && f < 0.66 ? 'mossy'
                 : blob < 7 ? 'andesite' : blob < 12 ? 'granite' : blob < 16 ? 'diorite' : 'stone';
          }
        }
        set(x, y, name, shade);
        // moss creeps over the rock nearest the soil, thinning out with depth
        if (VEINS && depth > 0 && f < 0.60 && (name === 'stone' || name === 'mossy' || name === 'cobble'
            || name === 'tuff' || name === 'andesite' || name === 'granite' || name === 'diorite')) {
          if ((hash2(x, y, seed + 909) % 100) < 16 + life * 52 * (1 - f / 0.6)) {
            const cc = at(x, y);
            if (cc) cc.vein = 1 + (hash2(x, y, seed + 313) % VEIN_VARIANTS);
          }
        }
      }

      // A big buy stacks moss up above the line; small moves add or knock out single blocks
      const stack = Math.round(boom * 6) + (life > 0.55 && (hash2(x, top, 3) % 100) < 46 ? 1 : 0);
      for (let k = 1; k <= stack && top - k > 0; k++) {
        if (k > 1 && (hash2(x, top - k, 6) % 100) > 92 - k * 4) break;
        set(x, top - k, (hash2(x, top - k, 4) % 5) ? 'moss' : 'mossy', -0.04);
      }
      const nudge = hash2(x, top, 55) % 100;
      if (boom < 0.05 && move > 0.008 && nudge < move * 900 && top > 1) set(x, top - 1, 'moss', -0.04);
      // a sell knocks the top block off the column, whatever is up there, rather than deleting
      // the surface out from under moss that is standing on it and leaving it in mid-air
      if (burn < 0.05 && move < -0.008 && nudge < -move * 700 && top < rBed - 2) {
        let ty = top;
        while (ty > 0 && at(x, ty - 1)) ty--;
        set(x, ty, null);                                            // never a column's last block
      }
    }

    // the world has an inside: everything from a column's surface downwards is filled with
    // cave dark before a single cube is drawn. The cubes cover it, so it shows only where the
    // ground has a gap -- a punched hole, a notch left by a sell -- and a gap in the ground
    // should read as depth. Above the surface nothing is filled, so open air between two moss
    // stacks still shows the sky, which up there is what it is.
    for (let x = 0; x < cols; x++) {
      let y0 = rows;
      for (let y = 0; y < rows; y++) if (at(x, y)) { y0 = y; break; }     // the real skyline, stacks included
      const top = Math.max(0, Math.min(y0, surf[x]));
      const Y0 = top * bs;
      const g = ctx.createLinearGradient(0, Y0, 0, rows * bs);
      g.addColorStop(0, '#14161d');
      g.addColorStop(0.35, '#0b0d13');
      g.addColorStop(1, '#06070b');
      ctx.fillStyle = g;
      ctx.fillRect(x * bs, Y0, bs + (x === cols - 1 ? sh : 0), rows * bs - Y0);
    }

    // 2. render it as cubes. Left to right, top to bottom: the front face, then the top
    // face if the cell above is open, then the right face if the next column is open there.
    const tileOf = (name, x, y) => SETS[name][hash2(x, y, seed) % VARIANTS];
    const tint = (shade, x, y, w, h) => {
      if (shade > 0) { ctx.fillStyle = `rgba(0,0,0,${shade.toFixed(3)})`; ctx.fillRect(x, y, w, h); }
      else if (shade < 0) { ctx.fillStyle = `rgba(255,255,235,${(-shade).toFixed(3)})`; ctx.fillRect(x, y, w, h); }
    };
    // Every sheared face is clipped, and canvas clips anti-alias, so each one kept a half
    // transparent pixel along its diagonal and the sky came through the joins. Lay an opaque
    // silhouette of the whole cube down first -- front, top and right as one hexagon, a pixel
    // proud all round -- so those seams land on the block's own colour instead of on the night.
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const cell = at(x, y);
      if (!cell) continue;
      const X = x * bs, Y = y * bs, e = 1;
      ctx.fillStyle = avgOf(cell.name);
      ctx.beginPath();
      ctx.moveTo(X - e, Y + bs + e);
      ctx.lineTo(X - e, Y - e);
      ctx.lineTo(X + sh, Y - sh - e);
      ctx.lineTo(X + bs + sh + e, Y - sh - e);
      ctx.lineTo(X + bs + sh + e, Y + bs - sh);
      ctx.lineTo(X + bs + e, Y + bs + e);
      ctx.closePath();
      ctx.fill();
    }

    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const cell = at(x, y);
      if (!cell) continue;
      const X = x * bs, Y = y * bs;
      ctx.drawImage(tileOf(cell.name, x, y), X, Y, bs, bs);
      if (cell.vein) ctx.drawImage(VEINS[cell.vein - 1], X, Y, bs, bs);
      tint(cell.shade, X, Y, bs, bs);
      if (cell.name === 'lava') continue;
      if (!at(x, y - 1) && y > 0) {                                  // the top face: sheared up and to the right
        const topName = TOPS[cell.name] || (cell.name.endsWith('_deep') ? 'deepslate' : cell.name.includes('_') ? 'stone' : cell.name);
        ctx.save();
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + bs, Y); ctx.lineTo(X + bs + sh, Y - sh); ctx.lineTo(X + sh, Y - sh); ctx.closePath(); ctx.clip();
        ctx.setTransform(1, 0, -1, 1, X + sh, Y - sh);              // local (u,v) -> (X + sh + u - v, Y - sh + v)
        ctx.drawImage(tileOf(SETS[topName] ? topName : cell.name, x, y + 977), 0, 0, bs, sh);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        tint(FACE_TOP + cell.shade * 0.5, X, Y - sh, bs + sh, sh);
        ctx.restore();
      }
      if (!at(x + 1, y) && cell.name !== 'bedrock') {              // the right face: sheared, in shadow
        ctx.save();
        ctx.beginPath(); ctx.moveTo(X + bs, Y); ctx.lineTo(X + bs + sh, Y - sh); ctx.lineTo(X + bs + sh, Y + bs - sh); ctx.lineTo(X + bs, Y + bs); ctx.closePath(); ctx.clip();
        ctx.setTransform(1, -1, 0, 1, X + bs, Y);                   // local (u,v) -> (X + bs + u, Y - u + v)
        ctx.drawImage(tileOf(cell.name, x + 331, y), 0, 0, sh, bs);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        tint(FACE_SIDE + cell.shade * 0.5, X + bs, Y - sh, sh, bs + sh);
        ctx.restore();
      }
    }
    // lava throws light on the rock above it
    const glow = ctx.createLinearGradient(0, (rLava - 3) * bs, 0, rows * bs);
    glow.addColorStop(0, 'rgba(255,140,20,0)');
    glow.addColorStop(1, 'rgba(255,150,30,0.42)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = glow; ctx.fillRect(0, (rLava - 3) * bs, c.width, rows * bs);
    ctx.globalCompositeOperation = 'source-over';

    const lavaCells = [];
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const cc = at(x, y);
      if (cc && cc.name === 'lava') lavaCells.push([x * bs, y * bs]);
    }
    return { canvas: c, surf, lavaCells, lavaY: (rows - 1) * bs };
  }

  // ---------- sky ----------
  const SKY = {
    dayTop: [120, 167, 255], dayHorizon: [193, 222, 255],
    nightTop: [4, 6, 16], nightHorizon: [12, 18, 40],
    duskTop: [58, 44, 96], duskHorizon: [255, 148, 62],
    sun: [255, 250, 232], sunGlow: [255, 226, 150],
    moon: [232, 236, 239]
  };

  // real time, not Minecraft's twenty-minute day
  function hoursNow(local) {
    const d = new Date();
    return local
      ? d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600
      : d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  }

  // 0 at sunrise, 1 at noon, 0 at sunset, negative through the night
  const sunAltitude = h => Math.sin((h - 6) / 12 * Math.PI);

  function skyState(h) {
    const alt = sunAltitude(h);
    const day = clamp01(alt * 3.2 + 0.12);
    const dusk = clamp01(1 - Math.abs(alt) * 5);                     // the band either side of the horizon
    let top = mixc(SKY.nightTop, SKY.dayTop, day);
    let horizon = mixc(SKY.nightHorizon, SKY.dayHorizon, day);
    top = mixc(top, SKY.duskTop, dusk * 0.75);
    horizon = mixc(horizon, SKY.duskHorizon, dusk * 0.9);
    return { alt, day, dusk, top, horizon, light: 0.26 + 0.74 * day, stars: clamp01(-alt * 4 + 0.15) };
  }

  function drawSky(ctx, W, H, groundY, bs, s, h, seed, t) {
    const g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, css(s.top));
    g.addColorStop(0.68, css(mixc(s.top, s.horizon, 0.55)));
    g.addColorStop(1, css(s.horizon));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, groundY);

    if (s.stars > 0.01) {                                            // stars are small flat quads in Minecraft too
      const r = rng(seed + 4242);
      for (let i = 0; i < 220; i++) {
        const x = Math.floor(r() * W), y = Math.floor(r() * groundY * 0.92);
        const tw = 0.55 + 0.45 * Math.sin(t * 0.0011 + i);
        const sz = r() < 0.16 ? 2 : 1;
        ctx.fillStyle = `rgba(255,255,255,${(s.stars * tw * 0.9).toFixed(3)})`;
        ctx.fillRect(x, y, sz * Math.max(1, bs / 16), sz * Math.max(1, bs / 16));
      }
    }

    // the sun and the moon are flat squares on an arc, the way Minecraft draws them:
    // 06:00 east, noon overhead, 18:00 west. No halo — only the sky warms near them.
    const place = (frac, alt, size) => [W * (0.06 + 0.88 * frac), groundY - alt * (groundY - size * 1.6)];
    const size = bs * 3;                                             // three blocks square, like the real one
    const snap = (v) => Math.round(v / bs) * bs;                     // and sitting on the block grid
    if (s.alt > -0.10) {
      const [x, y] = place((h - 6) / 12, s.alt, size);
      if (s.dusk > 0.02) {                                           // low sun bleeds into the sky around it
        const rg = ctx.createRadialGradient(x, y, size * 0.5, x, y, size * 5);
        rg.addColorStop(0, `rgba(${SKY.sunGlow[0]},${SKY.sunGlow[1]},${SKY.sunGlow[2]},${(s.dusk * 0.34).toFixed(3)})`);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg; ctx.fillRect(x - size * 5, y - size * 5, size * 10, size * 10);
      }
      ctx.fillStyle = css(SKY.sun);
      ctx.fillRect(snap(x - size / 2), snap(y - size / 2), size, size);
    }
    const mh = (h + 12) % 24, malt = sunAltitude(mh);
    if (malt > -0.10) {
      const w = size;
      const [mx, my] = place((mh - 6) / 12, malt, size);
      const x0 = snap(mx - w / 2), y0 = snap(my - w / 2);
      ctx.fillStyle = css(SKY.moon);
      ctx.fillRect(x0, y0, w, w);
      const q = Math.max(1, Math.round(bs / 3));                     // craters
      const mr = rng(seed + 31);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(150,158,168,0.55)';
        ctx.fillRect(x0 + Math.floor(mr() * (w - q * 2)), y0 + Math.floor(mr() * (w - q * 2)), q * (1 + Math.round(mr())), q);
      }
      const { lit, waxing } = moonPhase();                           // the real phase, not a random one
      const cut = snap(w * (1 - lit));
      if (cut > 0) {
        ctx.fillStyle = css(mixc(s.top, [8, 10, 18], 0.35));
        ctx.fillRect(waxing ? x0 : x0 + w - cut, y0, cut, w);
      }
    }

    // Minecraft's clouds: one flat layer of white slabs, drifting at a walking pace
    const cloudY = groundY * 0.34, ch = Math.max(3, bs * 0.75);
    const drift = (t * 0.014) % (W + 400);
    const r2 = rng(seed + 777);
    const tint = mixc([255, 255, 255], mixc(s.horizon, s.top, 0.3), 1 - s.day * 0.9);
    for (let i = 0; i < 26; i++) {
      const w = (2 + Math.floor(r2() * 7)) * bs;
      const x0 = r2() * (W + 400) - 200, y0 = cloudY + (r2() - 0.5) * groundY * 0.22;
      let x = x0 + drift; if (x > W + 200) x -= W + 400;
      ctx.fillStyle = `rgba(${tint[0] | 0},${tint[1] | 0},${tint[2] | 0},${(0.78 - 0.18 * r2()).toFixed(2)})`;
      ctx.fillRect(Math.round(x), Math.round(y0), Math.round(w), Math.round(ch));
      ctx.fillStyle = `rgba(0,0,0,0.10)`;
      ctx.fillRect(Math.round(x), Math.round(y0 + ch - Math.max(1, ch * 0.25)), Math.round(w), Math.max(1, ch * 0.25));
      if (r2() < 0.55) {                                             // a second slab, offset, the way cloud shapes step
        const w2 = (1 + Math.floor(r2() * 4)) * bs;
        ctx.fillStyle = `rgba(${tint[0] | 0},${tint[1] | 0},${tint[2] | 0},0.72)`;
        ctx.fillRect(Math.round(x + bs), Math.round(y0 - ch), Math.round(w2), Math.round(ch));
      }
    }
  }

  // the real lunar phase: how much of the disc is lit, and which limb
  function moonPhase() {
    const synodic = 29.530588853, known = Date.UTC(2000, 0, 6, 18, 14);
    const days = (Date.now() - known) / 86400000;
    const p = (((days % synodic) + synodic) % synodic) / synodic;    // 0 new, 0.5 full
    return { lit: Math.max(0.34, 1 - Math.abs(p - 0.5) * 2), waxing: p < 0.5 };
  }

  // ---------- render ----------
  const scratch = document.createElement('canvas');
  let loop = 0, running = null, poll = 0;

  function build3(canvas, opts) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(200, Math.round(canvas.clientWidth * dpr));
    const H = Math.max(140, Math.round(canvas.clientHeight * dpr));
    const across = opts.cols || level().cols;                        // zoomed in: fewer, bigger blocks
    const bs = Math.max(6, Math.round(W / across));
    const cols = Math.ceil(W / bs), rows = Math.ceil(H / bs);
    const seed = opts.seed || 20260908;
    if (!SETS.cobble) { buildTiles(seed); buildLava(seed); buildVeins(seed); }
    canvas.width = cols * bs; canvas.height = rows * bs;
    const candles = currentCandles(opts);
    const t = drawTerrain(cols, rows, bs, candles, seed);
    canvas.__world = { ...t, cols, rows, bs, W: canvas.width, H: canvas.height, seed, sig: signature(candles), count: candles.length,
      first: candles.length ? candles[0][0] : 0, last: candles.length ? candles[candles.length - 1][0] : 0 };
    return canvas.__world;
  }

  function paint(canvas, h, local, t) {
    const world = canvas.__world;
    if (!world) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const s = skyState(h);

    drawSky(ctx, world.W, world.H, world.H, world.bs, s, h, world.seed, t);

    // the world, at the light level the sky is giving it
    if (scratch.width !== world.W || scratch.height !== world.H) { scratch.width = world.W; scratch.height = world.H; }
    const sctx = scratch.getContext('2d');
    sctx.clearRect(0, 0, world.W, world.H);
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(world.canvas, 0, 0);
    sctx.globalCompositeOperation = 'source-atop';
    sctx.fillStyle = `rgba(10,14,34,${((1 - s.light) * 0.72).toFixed(3)})`;
    sctx.fillRect(0, 0, world.W, world.H);
    if (s.dusk > 0.05) { sctx.fillStyle = `rgba(255,142,64,${(s.dusk * 0.16).toFixed(3)})`; sctx.fillRect(0, 0, world.W, world.H); }
    sctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(scratch, 0, 0);

    // lava is drawn after the light, at full brightness, and moves on its own clock
    const lf = lavaFrame(t || 0);
    if (lf && world.lavaCells) for (const [lx, ly] of world.lavaCells) ctx.drawImage(lf, lx, ly, world.bs, world.bs);

    // lava does not care what time it is
    if (world.lavaY) {
      const glow = ctx.createLinearGradient(0, world.lavaY - world.bs * 3.5, 0, world.H);
      glow.addColorStop(0, 'rgba(255,120,10,0)');
      glow.addColorStop(1, `rgba(255,150,30,${(0.20 + 0.34 * (1 - s.light)).toFixed(3)})`);
      ctx.fillStyle = glow; ctx.fillRect(0, world.lavaY - world.bs * 3.5, world.W, world.H);
    }

    // the clock the sky is running on, and where the ground came from
    const fs = Math.max(9, Math.min(15, Math.round(world.bs * 0.62))), pad = Math.round(fs * 0.7);
    ctx.font = `${fs}px ui-monospace, "SF Mono", Menlo, monospace`;
    ctx.textBaseline = 'top';
    const clock = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(h % 1 * 60)).padStart(2, '0')} ${local ? 'LOCAL' : 'UTC'}`;
    const state = feeds.get(feedUrl(level()));
    // the span the blocks actually cover, which is not the span the button asks for:
    // the pool trades in bursts and the feed only returns periods that traded
    const feed = `$MOSS · ${level().key} · ${world.count} CANDLES${spanLabel(world)}${state && state.error ? ' · CACHED' : ''}`;
    const chip = (text, x0) => {
      const w = ctx.measureText(text).width + pad * 1.6;
      ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(x0, pad, w, fs * 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.fillText(text, x0 + pad * 0.8, pad * 1.25);
      return w;
    };
    const used = chip(clock, pad);
    chip(feed, pad + used + pad * 0.6);
  }

  // "44H", "6D" - the real distance between the oldest and newest candle on screen
  function spanLabel(world) {
    const span = world.last > world.first ? world.last - world.first : 0;
    if (!span) return '';
    const mins = Math.round(span / 60);
    if (mins < 90) return ` · ${mins}M`;
    if (mins < 2880) return ` · ${Math.round(mins / 60)}H`;
    return ` · ${Math.round(mins / 1440)}D`;
  }

  function start(canvas, opts = {}) {
    const key = `${canvas.clientWidth}x${canvas.clientHeight}:${zoom}:${opts.seed || 20260908}`;
    if (opts.force || canvas.dataset.key !== key || !canvas.__world) { canvas.dataset.key = key; build3(canvas, opts); }
    stop();
    const local = Boolean(opts.local);
    running = canvas;
    const tick = now => {
      if (running !== canvas) return;
      paint(canvas, opts.hour === undefined ? hoursNow(local) : opts.hour, local, now);
      loop = requestAnimationFrame(tick);
    };
    loop = requestAnimationFrame(tick);

    // Keep the world honest: re-read the feed on a timer and rebuild only when the
    // candles have actually changed, so a new hour of trading grows the world by a
    // column instead of redrawing it from scratch every minute.
    const refresh = async () => {
      if (running !== canvas || document.hidden) return;
      const l = level();
      try {
        const candles = await fetchCandles(l);
        if (l === level() && signature(candles) !== canvas.__world?.sig) build3(canvas, opts);
      } catch (error) {
        const url = feedUrl(l);
        feeds.set(url, { candles: feeds.get(url)?.candles || remembered(url) || [], error: String(error?.message || error) });
      }
    };
    refresh();
    poll = setInterval(refresh, POLL_MS);
    canvas.__refresh = refresh;
  }

  function stop() {
    if (loop) cancelAnimationFrame(loop);
    if (poll) clearInterval(poll);
    loop = 0; poll = 0; running = null;
  }

  // year → month → day → hour → one minute, the blocks getting bigger as the window
  // gets shorter
  function setZoom(delta) { return setZoomTo(zoom + delta); }

  function setZoomTo(index) {
    const next = Math.max(0, Math.min(ZOOM.length - 1, index));
    if (next === zoom) return level().key;
    zoom = next;
    rebuildRunning();
    if (running && running.__refresh) running.__refresh();           // pull this level's candles
    return level().key;
  }

  function rebuildRunning() {
    if (!running) return;
    running.dataset.key = '';
    build3(running, {});
  }

  // one frame at a fixed hour, for stills
  function still(canvas, opts = {}) {
    build3(canvas, opts);
    paint(canvas, opts.hour === undefined ? hoursNow(Boolean(opts.local)) : opts.hour, Boolean(opts.local), opts.t || 0);
  }

  // ---------- data ----------
  // Candles come from /price/moss, a same-origin Pages Function that fetches the pool's
  // OHLCV and caches it at the edge — one upstream call per TTL serves every visitor, so
  // the provider is not hammered and everyone's world is grown from the same numbers.
  // How far back you are looking, and how close. Zooming in shortens the window and
  // makes the blocks bigger: an hour of trading gets the same screen a year does.
  const ZOOM = [
    { key: 'YEAR', tf: 'day', limit: 365, cols: 30 },
    { key: 'MONTH', tf: 'day', limit: 30, cols: 22 },
    { key: 'DAY', tf: 'hour', limit: 24, cols: 16 },
    { key: 'HOUR', tf: 'minute', limit: 60, cols: 12 },
    { key: '12 MIN', tf: 'minute', limit: 12, cols: 8 }
  ];
  const STRIDE = { day: 86400, hour: 3600, minute: 60 };
  let zoom = 0;

  const CACHE_KEY = 'moss-chart-candles';
  const POLL_MS = 60000;

  const feeds = new Map();                                           // one entry per zoom level
  const level = () => ZOOM[zoom];
  const feedUrl = l => `/price/moss?tf=${l.tf}&limit=${l.limit}`;

  function signature(candles) {
    if (!candles || !candles.length) return 'none';
    const last = candles[candles.length - 1];
    return `${candles.length}:${last[0]}:${last[4]}:${last[5]}`;
  }

  function remember(key, candles) {
    try { localStorage.setItem(`${CACHE_KEY}:${key}`, JSON.stringify({ at: Date.now(), candles })); } catch (_) { /* quota, private mode */ }
  }
  function remembered(key) {
    try {
      const v = JSON.parse(localStorage.getItem(`${CACHE_KEY}:${key}`) || 'null');
      return v && Array.isArray(v.candles) && v.candles.length ? v.candles : null;
    } catch (_) { return null; }
  }

  async function fetchCandles(l) {
    const key = feedUrl(l);
    const response = await fetch(key, { headers: { accept: 'application/json' } });
    const payload = await response.json();                           // the function answers 200 even on failure
    if (payload.error) throw new Error(payload.error);
    const candles = Array.isArray(payload.candles) ? payload.candles : [];
    // the far zooms want the tail, not the whole history
    const trimmed = l.limit && candles.length > l.limit ? candles.slice(-l.limit) : candles;
    // `stale` means the upstream was throttling and the edge answered from its last
    // good copy — real candles, just not fresh, so say so rather than pretend
    feeds.set(key, { candles: trimmed, error: payload.stale ? 'stale' : null, source: payload.source, at: Date.now() });
    if (trimmed.length) remember(key, trimmed);
    return trimmed;
  }

  // the daily candles $MOSS printed before the feed was wired, kept as a last resort
  const REAL = [
    [1783900800, 1.6e-06, 1.9e-06, 1.55e-06, 1.81539462462477e-06, 161.48],
    [1788652800, 2.5e-06, 2.557e-06, 2.49e-06, 2.55707767274212e-06, 0.22],
    [1788739200, 2.55e-06, 2.556e-06, 2.494e-06, 2.49485074786645e-06, 13.17]
  ];
  function currentCandles(opts) {
    if (opts && opts.candles) return opts.candles;
    const l = level();
    const cached = feeds.get(feedUrl(l))?.candles || remembered(feedUrl(l));
    return cached && cached.length ? cached : REAL;
  }

  window.mossGarden = {
    start, stop, still, setZoom, setZoomTo,
    levels: () => ZOOM.map(l => l.key),
    zoomIndex: () => zoom,
    zoom: () => level().key,
    status: () => ({ zoom: level().key, candles: (feeds.get(feedUrl(level()))?.candles || []).length, error: feeds.get(feedUrl(level()))?.error || null }),
    REAL
  };
})();
