// The razor in the hand: how a vintage Chinese barber's razor is drawn, carried, played with and swung, done the
// way Counter-Strike does its butterfly knife. Nothing here is physics: each move is a short piece of hand-keyed
// animation, exactly as a viewmodel's are, and the hand, its fingers and the blade are simply put where the
// keys say for this instant.
//
// A key says where the right hand is in the camera's own space and what the razor is doing in it:
//   t   seconds from the start of the move
//   p   the wrist [x right, y up, z toward the eye], metres
//   f   which way the knuckles point from the wrist          n   which way the palm faces
//   c   curls: thumb across, thumb bend, index, middle, ring, little finger (0 open .. 1.2 shut)
//   th  the blade's angle from shut, degrees: 0 folded into the handle, 180 open straight, 270 the barber's hold
//   sp  the whole razor turned in the fingers about its pin, degrees (the flips)
//   e   how this key is arrived at: 'io' eased both ends (default), 'in' accelerating, 'out' decelerating,
//       'snap' fast then settling past and back (a flick), 'lin'
// A move can also name things that happen at a time (ev): the sounds and the moment a swing lands.

const G = [0.95, 0.85, 1.3, 1.34, 1.36, 1.36];          // the grip: a fist round a slim handle
const LOOSE = [0.8, 0.6, 1.15, 1.2, 1.25, 1.3];          // fingers eased for a flip
const PINCH = [1.1, 1.0, 1.35, 0.8, 0.55, 0.45];         // thumb and forefinger holding, the rest lifted

// held ready: low on the right, the fist thumb-side up, the blade standing up and a little forward
const READY = { p: [0.15, -0.155, -0.37], f: [-0.4, 0.28, -0.87], n: [-0.7, 0.12, 0.7], c: G, th: 180, sp: 0 };
const AWAY = { p: [0.34, -0.62, -0.2], f: [-0.1, 0.5, -0.85], n: [-1, 0, 0.1], c: G, th: 0, sp: 0 };
const K = (t, o = {}, from = READY) => ({ ...from, ...o, t });

export const MOVES = {
  // out of the pocket shut, up into view, and the blade thrown open with a turn of the wrist; it rocks once on its pin
  draw: {
    keys: [
      K(0, {}, AWAY),
      K(0.22, { p: [0.2, -0.24, -0.4], f: [-0.25, 0.55, -0.8], n: [-0.8, 0.2, 0.55], th: 0, c: G }, READY),
      K(0.34, { p: [0.18, -0.15, -0.43], f: [-0.5, 0.35, -0.8], n: [-0.7, -0.35, 0.62], th: 8, c: LOOSE, e: 'in' }),
      K(0.47, { p: [0.16, -0.16, -0.45], f: [-0.1, 0.1, -1], n: [-0.99, 0.1, 0.1], th: 205, c: LOOSE, e: 'out' }),
      K(0.58, { th: 172, e: 'io' }),
      K(0.7, { th: 180 }),
    ],
    ev: [[0.05, 'cloth'], [0.36, 'flick'], [0.49, 'lock']],
  },
  // shut with a flick and dropped away
  holster: {
    keys: [
      K(0),
      K(0.12, { f: [-0.4, 0.3, -0.85], n: [-0.8, -0.2, 0.55], c: LOOSE, th: 150, e: 'in' }),
      K(0.26, { p: [0.18, -0.2, -0.42], f: [-0.2, 0.4, -0.9], n: [-0.9, 0.1, 0.4], th: 0, c: G, e: 'out' }),
      K(0.5, {}, AWAY),
    ],
    ev: [[0.1, 'flick'], [0.25, 'shut'], [0.3, 'cloth']],
  },
  // the quick cut: wound back to the right, drawn flat across to the left, brought back
  slash: {
    keys: [
      K(0),
      K(0.07, { p: [0.27, -0.03, -0.38], f: [0.25, 0.4, -0.88], n: [-0.55, -0.72, 0.42], e: 'out' }),
      K(0.16, { p: [0.0, -0.08, -0.47], f: [-0.7, 0.05, -0.71], n: [-0.3, -0.88, 0.37], e: 'in' }),
      K(0.24, { p: [-0.17, -0.13, -0.42], f: [-0.9, -0.12, -0.42], n: [-0.2, -0.92, 0.33], e: 'out' }),
      K(0.44, { p: [0.1, -0.15, -0.39], f: [-0.4, 0.2, -0.9], n: [-0.8, -0.1, 0.59] }),
      K(0.56),
    ],
    ev: [[0.07, 'swing'], [0.15, 'hit']],
  },
  // and the one that follows it back the other way
  backslash: {
    keys: [
      K(0),
      K(0.08, { p: [-0.12, -0.08, -0.4], f: [-0.85, 0.25, -0.46], n: [-0.3, 0.8, 0.52], e: 'out' }),
      K(0.17, { p: [0.14, -0.07, -0.47], f: [0.05, 0.2, -0.98], n: [-0.6, 0.72, 0.35], e: 'in' }),
      K(0.25, { p: [0.29, -0.1, -0.4], f: [0.4, 0.15, -0.9], n: [-0.6, 0.68, 0.42], e: 'out' }),
      K(0.46, { p: [0.17, -0.15, -0.38], f: [-0.3, 0.26, -0.92], n: [-0.78, 0.15, 0.6] }),
      K(0.58),
    ],
    ev: [[0.08, 'swing'], [0.16, 'hit']],
  },
  // the heavy one: drawn right back by the shoulder, the blade turned edge on, and driven through
  heavy: {
    keys: [
      K(0),
      K(0.2, { p: [0.27, -0.02, -0.3], f: [0.1, 0.6, -0.8], n: [-0.75, -0.25, 0.6], e: 'out' }),
      K(0.3, { p: [0.28, -0.01, -0.29], f: [0.1, 0.62, -0.78], n: [-0.75, -0.25, 0.6] }),
      K(0.4, { p: [0.03, -0.06, -0.48], f: [-0.45, -0.1, -0.89], n: [-0.5, -0.72, 0.48], e: 'in' }),
      K(0.5, { p: [-0.1, -0.13, -0.45], f: [-0.75, -0.3, -0.59], n: [-0.35, -0.8, 0.49], e: 'out' }),
      K(0.82, { p: [0.12, -0.15, -0.39], f: [-0.4, 0.2, -0.9], n: [-0.8, -0.1, 0.59] }),
      K(1.0),
    ],
    ev: [[0.3, 'swingHeavy'], [0.39, 'hit']],
  },
  // looking it over, the way a butterfly knife is played with: brought up and turned flat to the eye, flicked
  // shut, rolled once round in the fingers, thrown open past straight into the barber's hold, turned over to
  // show its other face, and back to the hand
  inspect: {
    keys: [
      K(0),
      K(0.35, { p: [0.09, -0.11, -0.4], f: [-0.3, 0.75, -0.6], n: [-0.3, 0.3, 0.9], th: 180 }),
      K(0.7, { p: [0.08, -0.1, -0.39], f: [-0.32, 0.78, -0.55], n: [-0.25, 0.3, 0.92], th: 180 }),
      K(0.84, { p: [0.09, -0.12, -0.4], f: [-0.2, 0.7, -0.68], n: [-0.5, 0.2, 0.84], th: 40, c: LOOSE, e: 'in' }),
      K(0.94, { th: 0, c: PINCH, e: 'out', p: [0.09, -0.12, -0.4], f: [-0.2, 0.7, -0.68], n: [-0.5, 0.2, 0.84] }),
      K(1.32, { th: 0, sp: 360, c: PINCH, e: 'io', p: [0.1, -0.1, -0.41], f: [-0.1, 0.72, -0.68], n: [-0.6, 0.25, 0.76] }),
      K(1.45, { th: 0, sp: 360, c: G, p: [0.1, -0.11, -0.41], f: [-0.1, 0.72, -0.68], n: [-0.6, 0.25, 0.76] }),
      K(1.56, { th: 30, sp: 360, c: LOOSE, e: 'in', p: [0.11, -0.13, -0.42], f: [-0.35, 0.5, -0.8], n: [-0.6, -0.1, 0.8] }),
      K(1.7, { th: 285, sp: 360, c: LOOSE, e: 'out', p: [0.1, -0.1, -0.42], f: [0, 0.6, -0.8], n: [-0.8, 0.2, 0.56] }),
      K(1.82, { th: 262, sp: 360, c: G, p: [0.1, -0.1, -0.42], f: [0, 0.6, -0.8], n: [-0.8, 0.2, 0.56] }),
      K(1.95, { th: 270, sp: 360, c: G, p: [0.1, -0.1, -0.42], f: [0, 0.6, -0.8], n: [-0.8, 0.2, 0.56] }),
      K(2.5, { th: 270, sp: 360, p: [0.07, -0.09, -0.38], f: [0.1, 0.8, -0.6], n: [-0.2, -0.25, -0.95] }),
      K(3.0, { th: 270, sp: 360, p: [0.07, -0.09, -0.38], f: [0.12, 0.8, -0.58], n: [-0.15, -0.25, -0.96] }),
      K(3.3, { th: 215, sp: 360, c: LOOSE, e: 'in', p: [0.12, -0.14, -0.42], f: [-0.2, 0.5, -0.85], n: [-0.85, 0, 0.5] }),
      K(3.42, { th: 180, sp: 360, c: G, e: 'out' }),
      K(3.7, { sp: 360 }),
    ],
    ev: [[0.02, 'cloth'], [0.84, 'flick'], [0.94, 'shut'], [1.0, 'roll'], [1.57, 'flick'], [1.71, 'lock'], [3.3, 'flick'], [3.42, 'lock']],
  },
};

const ease = { lin: x => x, io: x => x * x * (3 - 2 * x), in: x => x * x, out: x => 1 - (1 - x) * (1 - x), snap: x => 1 - Math.pow(1 - x, 3) };
const mix = (a, b, k) => a + (b - a) * k;
const mixv = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

export class Razor {
  constructor() {
    this.state = 'away';          // away | draw | ready | holster | slash | backslash | heavy | inspect
    this.t = 0; this.out = false;
    this.pose = { pos: AWAY.p.slice(), fwd: AWAY.f.slice(), palm: AWAY.n.slice(), curl: AWAY.c.slice(), k: [1.0, 1.15, 0.6] };
    this.blade = 0; this.spin = 0;
    this.onEvent = null;          // (name) => a sound, or 'hit' when a swing lands
    this.next = null; this.fired = 0; this.lastSlash = 0;
  }
  get busy() { return this.state !== 'ready' && this.state !== 'away'; }
  play(name) { this.state = name; this.t = 0; this.fired = 0; }
  // out or away
  set(on) {
    if (on === this.out) return;
    this.out = on;
    if (on) this.play('draw'); else if (this.state === 'ready') this.play('holster'); else this.next = 'holster';
  }
  // what the hand asks for: 'slash' (the quick cut; a second straight after comes back the other way), 'heavy', 'inspect'
  ask(what) {
    if (!this.out || this.state === 'draw' || this.state === 'holster') return false;
    if (what === 'slash') {
      const m = MOVES[this.state];
      if (this.state === 'slash' || this.state === 'backslash') { if (this.t < 0.2) return false; this.play(this.state === 'slash' ? 'backslash' : 'slash'); return true; }
      if (this.state === 'heavy' && m && this.t < 0.55) return false;
      this.play(performance.now() - this.lastSlash < 900 && this.lastKind === 'slash' ? 'backslash' : 'slash'); this.lastKind = this.state; this.lastSlash = performance.now();
      return true;
    }
    if (what === 'heavy') { if (this.state === 'heavy' || ((this.state === 'slash' || this.state === 'backslash') && this.t < 0.22)) return false; this.play('heavy'); return true; }
    if (what === 'inspect') { if (this.state !== 'ready') return false; this.play('inspect'); return true; }
    return false;
  }
  sample(move, t) {
    const ks = move.keys;
    let i = 0; while (i < ks.length - 2 && t >= ks[i + 1].t) i++;
    const a = ks[i], b = ks[Math.min(ks.length - 1, i + 1)];
    const x = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 1;
    const k = (ease[b.e] || ease.io)(x);
    return { p: mixv(a.p, b.p, k), f: mixv(a.f, b.f, k), n: mixv(a.n, b.n, k), c: mixv(a.c, b.c, k), th: mix(a.th, b.th, k), sp: mix(a.sp, b.sp, k) };
  }
  update(dt) {
    let s;
    if (this.state === 'away') s = { ...AWAY };
    else if (this.state === 'ready') {
      s = { ...READY };
      if (this.next) { this.play(this.next); this.next = null; }
    } else {
      const m = MOVES[this.state];
      this.t += dt;
      while (this.fired < m.ev.length && m.ev[this.fired][0] <= this.t) { if (this.onEvent) this.onEvent(m.ev[this.fired][1], this.state); this.fired++; }
      s = this.sample(m, this.t);
      if (this.t >= m.keys[m.keys.length - 1].t) { this.state = this.state === 'holster' ? 'away' : 'ready'; this.t = 0; }
    }
    const P = this.pose;
    P.pos = s.p; P.fwd = s.f; P.palm = s.n; P.curl = s.c;
    this.blade = s.th; this.spin = s.sp % 360;
    return P;
  }
}
