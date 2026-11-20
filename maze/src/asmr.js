// The close sound of the place: what an ear a hand's width from the moss would hear. It is laid over audio.js's
// beds (wind, rain, stream, the animals) and is all made here, in the browser, from the one shared noise buffer and
// a few oscillators: no recordings. Six things:
//   1. sound that sits in space: point sounds go through the head-shaped (HRTF) panner and the listener turns with
//      the walker's head, so a drip stays where it fell when you turn to it. On headphones this is the whole effect.
//   2. the hands: the lighter's lid, wheel and flame, the paper burning on the draw, the breath out, the ash
//      tapped off, the torch's switch, the handheld's shell and keys, the satchel's leather and buckle.
//   3. touch: a tap on moss, stone, brick, bark, wood, leaf litter, mud or water answers with that thing's own
//      small sound, from where it was touched, and a short buzz on a phone. Each thing has its one sound and no
//      tune is laid over it (owner, 2026-11-18): a different surface is a different sound, the same surface the same.
//   4. footsteps in two parts, heel then toe, left foot then right, and the brush of a fern going by.
//   5. stillness: stand a few seconds and the near, quiet things come up (a bead of water, the moss settling, a
//      wing going by) while the wind draws back.
//   6. one scale: the drips and every interface tone are tuned to one pentatonic scale per place (as RemiliaNET
//      tunes its own interface sounds), so chance sounds fall into something near melody and never clash.
// And comfort: nothing here has a sudden edge (every sound has an attack), the master has a hard ceiling after its
// soft limiter (audio.js), and the whole close layer is one setting (settings: "close sound").

const PENT = [0, 2, 4, 7, 9];
const ROOTS = [196.0, 220.0, 246.94, 261.63, 293.66];   // G A B C D: one per place, chosen by the place's own sounds
const rnd = (a, b) => a + Math.random() * (b - a);

export function installAsmr(Ambience) {
  const P = Ambience.prototype;
  P.asmr = true; P.lyaw = 0; P.speed = 0; P.stillT = 0; P.close = 0; P.root = 220; P.foot = 1; P.touchRun = 0; P.touchAt = 0; P.keyDeg = 0; P.nextNear = 3; P.nextBreath = 6;

  P.setAsmr = function (on) { this.asmr = !!on; };

  // called once from start(): the near bus (dry: what is close has no room on it) with a little air added
  P.asmrStart = function () {
    const ctx = this.ctx;
    const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 5200; shelf.gain.value = 3;
    this.near = ctx.createGain(); this.near.gain.value = 1.5;
    this.near.connect(shelf).connect(this.master);
    const L = ctx.listener;
    if (L.positionX) { L.positionX.value = 0; L.positionY.value = 0; L.positionZ.value = 0; } else if (L.setPosition) L.setPosition(0, 0, 0);
  };
  // the scale of the place
  P.asmrProfile = function (sound) {
    let h = 0; for (const ch of JSON.stringify([sound.animals, sound.night, sound.reverb, sound.drips, sound.stream])) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    this.root = ROOTS[h % ROOTS.length];
  };
  // a degree of the place's scale, in hertz: 0 is the root, 5 the octave above, and so on
  P.note = function (deg, oct = 0) {
    const d = Math.round(deg), o = Math.floor(d / 5), i = ((d % 5) + 5) % 5;
    return this.root * Math.pow(2, (PENT[i] + 12 * (o + oct)) / 12);
  };
  // the nearest note of the scale to a pitch
  P.tune = function (f) {
    let best = f, bd = 1e9;
    for (let d = -10; d < 30; d++) { const n = this.note(d); const e = Math.abs(Math.log2(n / f)); if (e < bd) { bd = e; best = n; } }
    return best;
  };

  // which way the walker's head faces and how fast they go (0..1), every frame
  P.listen = function (yaw, speed) {
    this.lyaw = yaw; this.speed = speed;
    if (!this.started) return;
    const L = this.ctx.listener, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    if (L.forwardX) { const t = this.ctx.currentTime; L.forwardX.setTargetAtTime(fx, t, 0.02); L.forwardY.setTargetAtTime(0, t, 0.02); L.forwardZ.setTargetAtTime(fz, t, 0.02); L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else if (L.setOrientation) L.setOrientation(fx, 0, fz, 0, 1, 0);
  };

  // A point in the place to play something from. az is the bearing in the world (radians, 0 = the world's -Z), el
  // the height angle, dist metres. What comes back is a node to connect sources to. With the close sound off (or
  // no HRTF) it is the plain left-right pan it always was.
  P.spot = function (az, dist = 3, el = 0, o = {}) {
    const ctx = this.ctx, dry = o.near ? this.near : this.master;
    const inp = ctx.createGain(); inp.gain.value = o.gain ?? 1;
    const rel = az + this.lyaw;                                   // the bearing from the nose (forward is az = -yaw)
    inp.panValue = Math.sin(rel) * Math.cos(el);
    let out;
    if (this.asmr && ctx.createPanner) {
      const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1; p.rolloffFactor = 0;
      const x = Math.sin(az) * Math.cos(el) * dist, y = Math.sin(el) * dist, z = -Math.cos(az) * Math.cos(el) * dist;
      if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
      out = p;
    } else { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, inp.panValue)); out = p; }
    // far things are duller and quieter, and more of them is the room
    const far = Math.max(0, Math.min(1, (dist - 1) / 12));
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 16000 - 11000 * far;
    const lvl = ctx.createGain(); lvl.gain.value = o.flat ? 1 : 1 / (1 + far * 1.4);
    inp.connect(lp).connect(lvl).connect(out); out.connect(dry);
    if (!o.near && o.verb !== 0) { const send = ctx.createGain(); send.gain.value = (o.verb ?? 1) * (0.5 + 0.8 * far); out.connect(send).connect(this.verbIn); }
    inp.out = out;
    return inp;
  };
  // somewhere round the head: a bearing from the nose in degrees (right is +), a height angle, a distance
  P.by = function (relDeg, elDeg, dist, o = {}) { return this.spot(-this.lyaw + relDeg * Math.PI / 180, dist, elDeg * Math.PI / 180, { near: true, flat: true, ...o }); };
  P.hand = function (left) { return this.by(left ? -38 : 38, -32, 0.42); };
  P.mouth = function () { return this.by(0, -18, 0.14); };

  // one shaped piece of the noise: the brick everything here is built from
  P.nz = function (dest, t0, dur, gain, type, f0, f1 = f0, q = 1, rate = 1, attack = 0.006) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rate * rnd(0.94, 1.06);
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + Math.min(attack, dur * 0.4)); g.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
    s.connect(f).connect(g).connect(dest); s.start(t0, Math.random() * 10); s.stop(t0 + dur + 0.05);
    return g;
  };
  // a breath: slow in, slow out, no edge anywhere
  P.air = function (dest, t0, dur, gain, f0, f1, q = 0.6) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rnd(0.9, 1.1);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); f.frequency.linearRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + dur * 0.35); g.gain.linearRampToValueAtTime(gain * 0.7, t0 + dur * 0.7); g.gain.linearRampToValueAtTime(0, t0 + dur);
    s.connect(f).connect(g).connect(dest); s.start(t0, Math.random() * 8); s.stop(t0 + dur + 0.05);
  };
  P.buzz = function (pattern) { if (this.asmr && !this.muted && navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* not allowed */ } } };

  // ---- the hands

  // the lighter: its lid thumbed open (a click and the ring of thin metal)
  P.lighterOpen = function () {
    if (!this.started) return; const now = this.ctx.currentTime, d = this.hand();
    this.nz(d, now, 0.014, 0.07, 'highpass', 4200, 4200, 0.7, 2.2, 0.002);
    this.tone('sine', 2390, 2370, now + 0.004, 0.16, 0.022, d); this.tone('sine', 3870, 3850, now + 0.004, 0.11, 0.014, d); this.tone('sine', 5610, 5600, now + 0.004, 0.06, 0.008, d);
  };
  // struck: the wheel's rasp in three grits, the spark, the flame taking with a soft thump, and its small hiss after
  P.lighter = function () {
    if (!this.started) return; const now = this.ctx.currentTime, d = this.hand();
    for (let i = 0; i < 3; i++) this.nz(d, now + i * 0.017, 0.026, 0.06 - i * 0.012, 'bandpass', rnd(4200, 6200), 3600, 1.2, 1.9, 0.003);
    this.nz(d, now + 0.05, 0.008, 0.05, 'highpass', 7000, 7000, 0.7, 2.6, 0.001);
    this.nz(d, now + 0.07, 0.24, 0.05, 'lowpass', 420, 130, 0.7, 0.6, 0.02);
    this.tone('sine', 150, 72, now + 0.07, 0.16, 0.04, d);
    this.air(d, now + 0.12, 1.05, 0.011, 1500, 2100, 0.4);
  };
  P.lighterClose = function () {
    if (!this.started) return; const now = this.ctx.currentTime, d = this.hand();
    this.nz(d, now, 0.03, 0.08, 'lowpass', 900, 300, 0.8, 0.9, 0.002);
    this.tone('sine', 3120, 3090, now + 0.002, 0.07, 0.016, d);
  };
  // the draw: the paper and leaf burning back, a run of tiny dry ticks that thickens and thins with the pull, and
  // the breath going in under it
  P.crackle = function (dur = 2, level = 1) {
    if (!this.started) return; const now = this.ctx.currentTime, d = this.by(6, -16, 0.2);
    for (let t = 0.08; t < dur; t += rnd(0.018, 0.075)) {
      const k = Math.pow(Math.sin(Math.min(1, t / dur) * Math.PI), 0.7);
      if (Math.random() > 0.35 + 0.6 * k) continue;
      this.nz(d, now + t, rnd(0.004, 0.013), rnd(0.025, 0.09) * k * level, 'highpass', rnd(4500, 9000), 4000, 0.8, rnd(1.8, 3), 0.001);
    }
    this.air(this.mouth(), now + 0.05, dur * 0.95, 0.03 * level, 800, 1500, 0.7);
  };
  // the breath out, long: through the lips, forward
  P.exhale = function (dur = 2.8) {
    if (!this.started) return; const now = this.ctx.currentTime, d = this.by(0, -12, 0.22);
    this.air(d, now, dur, 0.05, 900, 620, 0.55);
    this.air(d, now + 0.05, dur * 0.8, 0.016, 3600, 2800, 0.5);
  };
  // the ash tapped off: the finger on the paper, twice, and the ash letting go
  P.ashTap = function () {
    if (!this.started) return; const now = this.ctx.currentTime, d = this.hand();
    for (const t of [0, 0.095]) { this.nz(d, now + t, 0.016, 0.028, 'bandpass', rnd(1500, 2100), 1200, 2.2, 1.6, 0.002); this.nz(d, now + t + 0.004, 0.03, 0.01, 'highpass', 5000, 5000, 0.7, 2.4, 0.003); }
  };
  // the torch's switch: a sprung click, and on the way on the second, softer one as it seats
  P.torchClick = function (on) {
    if (!this.started) return; const now = this.ctx.currentTime, d = this.hand();
    this.nz(d, now, 0.012, 0.13, 'bandpass', 2700, 2400, 3, 2.0, 0.0015);
    this.nz(d, now + 0.002, 0.035, 0.05, 'lowpass', 600, 220, 0.8, 0.8, 0.003);
    if (on) this.nz(d, now + 0.045, 0.01, 0.04, 'bandpass', 3300, 3000, 3, 2.2, 0.0015);
    this.buzz(6);
  };
  // a picture taken (P): the leaf shutter of a small camera, two soft clicks
  P.shutter = function () {
    if (!this.started) return; const now = this.ctx.currentTime, d = this.by(0, -8, 0.3);
    this.nz(d, now, 0.012, 0.09, 'bandpass', 3400, 2600, 2.5, 2.2, 0.0015);
    this.nz(d, now + 0.055, 0.016, 0.07, 'bandpass', 2300, 1700, 2.5, 1.8, 0.0015);
    this.nz(d, now + 0.002, 0.05, 0.03, 'lowpass', 500, 200, 0.8, 0.8, 0.003);
  };
  // something taken out of the coat or put back: cloth
  // the razor: its blade thrown round on the pin (a slide of steel and a thin ring), stopping open (a click and the
  // ring again, lower), snapped shut into the wood (a clack), rolled in the fingers (small ticks), and cutting air
  P.razor = function (name) {
    if (!this.started) return; const now = this.ctx.currentTime, d = this.hand();
    if (name === 'flick') { this.nz(d, now, 0.09, 0.05, 'bandpass', 5200, 8200, 1.4, 1.6, 0.01); this.tone('sine', 4100, 4400, now, 0.08, 0.008, d); }
    else if (name === 'lock') { this.nz(d, now, 0.012, 0.09, 'highpass', 3800, 3800, 0.7, 2.2, 0.001); this.tone('sine', 2860, 2840, now + 0.003, 0.22, 0.02, d); this.tone('sine', 5730, 5700, now + 0.003, 0.13, 0.011, d); this.tone('sine', 7900, 7880, now + 0.003, 0.07, 0.005, d); }
    else if (name === 'shut') { this.nz(d, now, 0.035, 0.1, 'bandpass', 1500, 700, 1.1, 1, 0.002); this.nz(d, now, 0.01, 0.05, 'highpass', 5000, 5000, 0.7, 2, 0.001); this.tone('sine', 620, 410, now, 0.06, 0.03, d); }
    else if (name === 'roll') { for (let i = 0; i < 5; i++) this.nz(d, now + i * 0.07 + rnd(0, 0.015), 0.02, 0.022, 'bandpass', rnd(2600, 4200), 2400, 2, 1.6, 0.003); }
    else if (name === 'swing' || name === 'swingHeavy') {
      const h = name === 'swingHeavy', dur = h ? 0.26 : 0.17, sw = this.by(h ? 10 : 25, -20, 0.5);
      this.nz(sw, now, dur, h ? 0.11 : 0.085, 'bandpass', h ? 420 : 700, h ? 2400 : 3600, 0.9, 1.2, dur * 0.35);
      this.nz(sw, now + dur * 0.25, dur * 0.6, 0.03, 'highpass', 5200, 7400, 0.7, 1.8, dur * 0.2);
    }
  };
  P.cloth = function (left) {
    if (!this.started) return; const now = this.ctx.currentTime, d = this.hand(left);
    this.nz(d, now, 0.2, 0.065, 'bandpass', 2300, 1300, 0.5, 1.2, 0.05);
    this.nz(d, now + 0.11, 0.14, 0.04, 'bandpass', 3200, 2200, 0.6, 1.5, 0.04);
  };
  // the handheld: its plastic shell in the hand, and when it comes out the two notes of its screen waking
  P.deviceOut = function (out) {
    if (!this.started) return; const now = this.ctx.currentTime, d = this.hand(true);
    this.nz(d, now, 0.05, 0.05, 'lowpass', 520, 200, 0.9, 0.7, 0.004);
    this.nz(d, now + 0.03, 0.12, 0.02, 'bandpass', 1700, 1100, 0.7, 1.3, 0.03);
    if (out) { this.tone('sine', this.note(5), this.note(5), now + 0.16, 0.12, 0.022, d); this.tone('sine', this.note(7), this.note(7), now + 0.27, 0.2, 0.022, d); }
    else this.tone('sine', this.note(7), this.note(5), now + 0.05, 0.14, 0.016, d);
  };
  // a key of it pressed: the dome's tick and one note of the scale, wandering a step at a time so a typed line is a tune
  P.keyBlip = function () {
    if (!this.started) return; const now = this.ctx.currentTime, d = this.by(-14, -30, 0.3);
    this.keyDeg = Math.max(3, Math.min(13, this.keyDeg + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
    this.nz(d, now, 0.01, 0.03, 'bandpass', 3200, 2600, 2.5, 2.2, 0.0015);
    this.tone('sine', this.note(this.keyDeg), this.note(this.keyDeg), now + 0.003, 0.09, 0.02, d);
    this.buzz(4);
  };
  // a message sent: three notes up
  P.sendChime = function () {
    if (!this.started) return; const now = this.ctx.currentTime, d = this.by(-14, -30, 0.3);
    [5, 7, 9].forEach((n, i) => this.tone('sine', this.note(n), this.note(n), now + i * 0.085, 0.16, 0.024, d));
  };
  // the satchel: the creak of its leather and the buckle's two small rings; shut, the flap falling to
  P.satchelSound = function (open = true) {
    if (!this.started) return; const now = this.ctx.currentTime, d = this.by(-30, -50, 0.5);
    if (open) {
      this.nz(d, now, 0.34, 0.09, 'bandpass', 330, 610, 5, 0.5, 0.05);
      this.nz(d, now + 0.16, 0.2, 0.06, 'bandpass', 520, 380, 6, 0.45, 0.04);
      this.tone('sine', 2840, 2820, now + 0.3, 0.09, 0.014, d); this.tone('sine', 4210, 4200, now + 0.34, 0.06, 0.01, d);
      this.nz(d, now + 0.3, 0.01, 0.03, 'highpass', 5000, 5000, 0.7, 2.4, 0.002);
    } else {
      this.nz(d, now, 0.09, 0.07, 'lowpass', 480, 150, 0.8, 0.55, 0.008);
      this.nz(d, now + 0.02, 0.16, 0.02, 'bandpass', 420, 300, 5, 0.5, 0.04);
      this.tone('sine', 2840, 2820, now + 0.07, 0.06, 0.01, d);
    }
  };

  // ---- touch: what the thing under the finger sounds like, from where it was touched (relDeg from the nose, dist metres)
  P.touch = function (kind, relDeg = 0, dist = 1) {
    if (!this.started) return;
    const now = this.ctx.currentTime, d = this.by(relDeg, -12, Math.max(0.3, Math.min(2, dist)), { near: dist < 1.2 });
    const r = Math.random;
    switch (kind) {
      case 'stone': case 'brick': {
        const dry = kind === 'brick' ? 1.25 : 1;
        this.tone('sine', 190 * dry, 120 * dry, now, 0.055, 0.03, d);                                   // the knuckle
        this.nz(d, now, 0.013, 0.05, 'bandpass', (2600 + r() * 900) * dry, 2200 * dry, 4, 2.2, 0.0015);  // its click
        this.nz(d, now + 0.02, 0.09, 0.024, 'bandpass', 1700 * dry, 1000, 1.2, 1.6, 0.02);              // grit under the finger
        this.buzz(9); break;
      }
      case 'bark': case 'wood': {
        const lo = kind === 'wood' ? 0.72 : 1;
        this.tone('sine', 330 * lo, 210 * lo, now, 0.075, 0.026, d);                                     // hollow: the wood answers
        this.tone('sine', 705 * lo, 640 * lo, now, 0.04, 0.01, d);
        this.nz(d, now, 0.05, 0.04, 'bandpass', 900 * lo, 700 * lo, 5, 1.2, 0.002);
        this.nz(d, now + 0.025, 0.11, 0.035, 'bandpass', 2400, 1500, 1.0, 1.7, 0.02);                   // the rasp of the bark
        this.buzz(12); break;
      }
      case 'water':
        this.tone('sine', 620 + r() * 200, 1500 + r() * 400, now, 0.06, 0.045, d);                      // the plip
        this.nz(d, now + 0.005, 0.07, 0.03, 'bandpass', 2400, 1400, 1.5, 1.6, 0.004);
        setTimeout(() => this.bubble(0.6), 70 + r() * 60);
        this.buzz([4, 40, 4]); break;
      case 'leaf':
        for (let i = 0; i < 4; i++) this.nz(d, now + i * rnd(0.022, 0.045), rnd(0.02, 0.05), rnd(0.02, 0.045), 'highpass', rnd(2800, 4500), 2600, 0.7, rnd(1.8, 2.6), 0.003);
        this.buzz(5); break;
      case 'mud':
        this.nz(d, now, 0.12, 0.06, 'lowpass', 380, 130, 0.8, 0.55, 0.012);
        this.nz(d, now + 0.03, 0.18, 0.05, 'bandpass', 520, 1200, 1.4, 0.9, 0.03);                      // the suck as the finger comes away
        setTimeout(() => this.bubble(0.4), 120);
        this.buzz([10, 30, 6]); break;
      default:                                                                                         // moss
        this.nz(d, now, 0.1, 0.055, 'lowpass', 300, 120, 0.7, 0.55, 0.014);                             // it gives: no knock at all
        this.nz(d, now + 0.015, 0.14, 0.03, 'bandpass', 1500 + r() * 400, 720, 1.2, 1.1, 0.03);         // the wet in it
        for (let i = 0; i < 3; i++) this.nz(d, now + 0.03 + i * rnd(0.02, 0.04), 0.008, rnd(0.006, 0.016), 'highpass', rnd(5000, 8000), 5000, 0.8, 2.6, 0.001);   // the stems
        this.buzz([5, 25, 5]);
    }
  };

  // a fern or a leaf going by the leg
  P.brushPast = function () {
    if (!this.started || !this.asmr) return; const now = this.ctx.currentTime, d = this.by(Math.random() < 0.5 ? -65 : 65, -45, 0.6);
    this.nz(d, now, 0.32, 0.07, 'bandpass', 2700, 1500, 0.6, 1.5, 0.08);
    for (let i = 0; i < 2; i++) this.nz(d, now + 0.06 + i * rnd(0.05, 0.1), 0.04, 0.045, 'highpass', rnd(3200, 5200), 3000, 0.7, 2.2, 0.004);
  };

  // ---- stillness: called every frame from update()
  P.asmrUpdate = function (dt) {
    this.stillT = this.speed < 0.06 ? this.stillT + dt : 0;
    const want = this.asmr ? Math.max(0, Math.min(1, (this.stillT - 2.5) / 4.5)) : 0;
    this.close += (want - this.close) * Math.min(1, dt * (want > this.close ? 0.5 : 3.5));
    const now = this.ctx.currentTime;
    if (this.near) this.near.gain.setTargetAtTime(1.5 + 0.9 * this.close, now, 0.4);
    if (this.close < 0.3) { this.nextNear = this.t + 1.5; return; }
    if (this.t > this.nextNear) {
      this.nextNear = this.t + rnd(1.1, 3.4) / this.close;
      const k = Math.random(), lvl = 0.4 + 0.6 * this.close;
      if (k < 0.4) {
        // a bead of water letting go of a leaf, close by: the place's scale, soft
        const d = this.spot(Math.random() * Math.PI * 2, rnd(0.4, 1.3), rnd(-0.5, 0.6), { near: true, flat: true });
        const f = this.note(10 + Math.floor(Math.random() * 8));
        this.tone('sine', f * 1.35, f, now, rnd(0.1, 0.18), 0.022 * lvl, d);
        this.nz(d, now + 0.012, 0.03, 0.008 * lvl, 'bandpass', 3600, 3000, 2, 2.2, 0.003);
      } else if (k < 0.75) {
        // the moss settling: two or three dry ticks, low down
        const d = this.spot(Math.random() * Math.PI * 2, rnd(0.5, 1.5), rnd(-0.9, -0.3), { near: true, flat: true });
        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) this.nz(d, now + i * rnd(0.05, 0.16), rnd(0.006, 0.014), rnd(0.008, 0.02) * lvl, 'highpass', rnd(3800, 7000), 3600, 0.8, rnd(2, 3), 0.001);
      } else {
        // a wing going by the ear: it crosses from one side to the other
        const ctx = this.ctx, a0 = Math.random() * Math.PI * 2, dur = rnd(0.5, 0.9);
        const d = this.spot(a0, 0.5, 0.15, { near: true, flat: true });
        if (d.out.positionX) { const a1 = a0 + (Math.random() < 0.5 ? -1 : 1) * rnd(1.2, 2.4); d.out.positionX.linearRampToValueAtTime(Math.sin(a1) * 0.5, now + dur); d.out.positionZ.linearRampToValueAtTime(-Math.cos(a1) * 0.5, now + dur); }
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(rnd(170, 230), now); o.frequency.linearRampToValueAtTime(rnd(150, 250), now + dur);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.012 * lvl, now + dur * 0.4); g.gain.linearRampToValueAtTime(0, now + dur);
        o.connect(bp).connect(g).connect(d); o.start(now); o.stop(now + dur + 0.05);
      }
    }
    // and the walker's own breath, only when everything else has gone quiet
    if (this.close > 0.7 && this.t > this.nextBreath) {
      this.nextBreath = this.t + rnd(4.2, 5.4);
      const m = this.mouth();
      this.air(m, now, 1.5, 0.006, 700, 1100, 0.6);
      this.air(m, now + 1.9, 1.9, 0.007, 900, 600, 0.6);
    }
  };
}
