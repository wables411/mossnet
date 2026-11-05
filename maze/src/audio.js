// Ambience true to the location: field recordings where they exist, synthesis where they do not.
// A wind bed, leaf gusts, rain when it rains, drips through a reverb that
// is long in tunnels and short under trees (with their echo there), a stream
// that gets louder as you near it and still water that laps as you wade it,
// footsteps for wet earth, dry earth, stone, mud and water in several
// variants each (never the same one twice running, deeper water louder), the
// animals that live in that place (never the same call twice running), and a
// gentle limiter on the master so stacked calls and splashes never clip.

// field recordings (CC0 / public domain, see README): beds that loop, and calls
const CLIPS = {
  stream: 'audio/stream.mp3', trickle: 'audio/trickle.mp3', rain: 'audio/rain.mp3',
  raven: ['audio/raven1.mp3', 'audio/raven2.mp3'], elk: ['audio/elk.mp3'], frog: ['audio/frog1.mp3', 'audio/frog2.mp3'],
  pigeon: ['audio/pigeon.mp3'], chaffinch: ['audio/chaffinch.mp3'], sheep: ['audio/sheep1.mp3', 'audio/sheep2.mp3'],
};

export class Ambience {
  constructor() { this.ctx = null; this.master = null; this.started = false; this.muted = false; this.profile = null; this.ground = 'wet'; this.clips = new Map(); this.beds = {}; }

  // fetch and decode one recording, once
  clip(url) {
    if (this.clips.has(url)) return this.clips.get(url);
    const p = fetch(url).then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b)).catch(() => null);
    this.clips.set(url, p);
    return p;
  }
  // a looping bed through a gain, started silent
  async bed(name, url, dest) {
    const buf = await this.clip(url);
    if (!buf || this.beds[name]) return;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = 0;
    src.connect(g).connect(dest); src.start(0, Math.random() * buf.duration);
    this.beds[name] = g;
  }

  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.started = true;
    const master = this.master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.7;
    const mf = this.masterFilter = ctx.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 20000;
    // a gentle limiter: a soft knee well below full scale, a fast grab and a slow let-go, so a splash on top of
    // an owl on top of the stream rounds off instead of clipping
    const lim = this.limiter = ctx.createDynamicsCompressor();
    lim.threshold.value = -12; lim.knee.value = 14; lim.ratio.value = 7; lim.attack.value = 0.004; lim.release.value = 0.28;
    master.connect(mf).connect(lim).connect(ctx.destination);

    // two reverbs: a short one for the open woods, a long one for stone rooms
    const makeIR = (sec, tail) => {
      const len = Math.floor(ctx.sampleRate * sec);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, tail) * 0.5;
      }
      return ir;
    };
    this.verbShort = ctx.createConvolver(); this.verbShort.buffer = makeIR(1.4, 2.8);
    this.verbLong = ctx.createConvolver(); this.verbLong.buffer = makeIR(3.6, 2.0);
    // the drips of a stone room go to the long reverb on their own send, however the rest of the place is mixed
    this.dripVerbSend = ctx.createGain(); this.dripVerbSend.gain.value = 0; this.dripVerbSend.connect(this.verbLong);
    this.verbIn = ctx.createGain();
    this.verbShortGain = ctx.createGain(); this.verbLongGain = ctx.createGain();
    this.verbIn.connect(this.verbShort).connect(this.verbShortGain).connect(master);
    this.verbIn.connect(this.verbLong).connect(this.verbLongGain).connect(master);
    this.verbShortGain.gain.value = 0.35; this.verbLongGain.gain.value = 0;
    this.verb = this.verbIn;

    // noise buffer (shared)
    const nlen = ctx.sampleRate * 12;
    const nb = this.noise = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < nlen; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913;
      nd[i] = (b0 + b1 + b2 + w * 0.1848) * 0.08;
    }
    const loopNoise = (rate = 1) => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.playbackRate.value = rate; s.start(); return s; };

    // wind bed
    const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 240; wlp.Q.value = 0.6;
    const wg = ctx.createGain(); wg.gain.value = 0.0;
    loopNoise(1).connect(wlp).connect(wg).connect(master);
    this.windGain = wg; this.windFilter = wlp;

    // leaf rustle layer (highpassed, gated by gusts)
    const lbp = ctx.createBiquadFilter(); lbp.type = 'bandpass'; lbp.frequency.value = 2600; lbp.Q.value = 0.5;
    const lg = ctx.createGain(); lg.gain.value = 0.0;
    loopNoise(1.3).connect(lbp).connect(lg).connect(master);
    this.leafGain = lg;

    // rain: a steady hiss on leaves plus a lower patter
    const rbp = ctx.createBiquadFilter(); rbp.type = 'bandpass'; rbp.frequency.value = 3200; rbp.Q.value = 0.35;
    const rg = ctx.createGain(); rg.gain.value = 0;
    loopNoise(1.7).connect(rbp).connect(rg).connect(master);
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 900;
    const rg2 = ctx.createGain(); rg2.gain.value = 0;
    loopNoise(0.8).connect(rlp).connect(rg2).connect(master);
    this.rainGain = rg; this.rainGain2 = rg2;

    // stream: a faint broadband trickle underneath, and the water itself as bubbles and gurgles (scheduled in update)
    const shp = ctx.createBiquadFilter(); shp.type = 'highpass'; shp.frequency.value = 1800;
    const sg = ctx.createGain(); sg.gain.value = 0;
    loopNoise(1.3).connect(shp).connect(sg); sg.connect(master);
    const spn = this.streamPan = ctx.createStereoPanner(); spn.connect(master); spn.connect(this.verbIn);
    this.streamGain = sg; this.streamLevel = 0; this.streamPanValue = 0;

    this.t = 0; this.nextGust = 3; this.nextDrip = 2; this.nextAnimal = 8; this.lastAnimal = null; this.lastStep = {}; this.wade = { depth: 0, moving: 0 };
    // the recorded beds: stream and trickle (positional, by distance), rain
    const streamBus = ctx.createGain(); streamBus.gain.value = 1; streamBus.connect(master); streamBus.connect(this.verbIn);
    this.bed('stream', CLIPS.stream, streamBus); this.bed('trickle', CLIPS.trickle, streamBus); this.bed('rain', CLIPS.rain, master);
    if (this.profile) this.applyProfile();
  }

  setProfile(sound, ground, weather) {
    const night = weather ? weather.night || 0 : 0;
    // who calls: the day list by day, the night list after dark, and at dusk both (the day birds' last songs, the first frogs)
    const animals = night > 0.8 ? (sound.night || sound.animals) : night > 0 ? [...(sound.animals || []), ...(sound.night || []), ...(sound.night || [])] : sound.animals;
    this.profile = { ...sound, animals, night, rain: weather ? weather.rain : 0, wind: Math.min(1, sound.wind * 0.4 + (weather ? weather.wind : 0.2) * 0.9), snow: weather ? weather.snow : 0 };
    this.ground = ground;
    if (this.started) this.applyProfile();
  }
  applyProfile() {
    const now = this.ctx.currentTime, p = this.profile;
    this.verbShortGain.gain.setTargetAtTime(0.25 * (1 - p.reverb * 0.5), now, 0.5);
    this.verbLongGain.gain.setTargetAtTime(0.3 * p.reverb, now, 0.5);
    if (this.dripVerbSend) this.dripVerbSend.gain.setTargetAtTime(0.9 * Math.max(0, p.reverb - 0.3), now, 0.5);
    this.lastAnimal = null;
    this.rainGain.gain.setTargetAtTime(0.012 * p.rain, now, 1.5);
    this.rainGain2.gain.setTargetAtTime(0.02 * p.rain, now, 1.5);
    if (this.beds.rain) this.beds.rain.gain.setTargetAtTime(0.5 * p.rain, now, 2);
    this.nextAnimal = this.t + 4 + Math.random() * 8;
    // snow muffles the place
    if (this.masterFilter) this.masterFilter.frequency.setTargetAtTime(p.snow > 0 ? 4500 - 2500 * p.snow : 20000, now, 1);
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.1); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  // streamDist: metres to the stream, or Infinity; wadeDepth: how deep the still water is under the player (0 on land);
  // moving: 0..1 how fast they are going through it
  update(dt, fogAmount = 0, streamDist = Infinity, wadeDepth = 0, moving = 0) {
    if (!this.started || !this.profile) return;
    const ctx = this.ctx, now = ctx.currentTime, p = this.profile;
    this.t += dt;
    this.wade.depth = wadeDepth; this.wade.moving = moving;
    const swell = 0.35 + 0.25 * Math.sin(this.t * 0.11) + 0.15 * Math.sin(this.t * 0.37 + 1);
    this.windGain.gain.setTargetAtTime(swell * p.wind * 0.7 * (1 - 0.4 * fogAmount), now, 0.5);
    this.windFilter.frequency.setTargetAtTime(180 + 120 * swell, now, 0.5);
    if (p.wind > 0.1 && this.t > this.nextGust) {
      this.nextGust = this.t + 6 + Math.random() * 12 / Math.max(0.3, p.wind);
      const g = this.leafGain.gain;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime((0.05 + Math.random() * 0.04) * p.wind, now + 1.5 + Math.random());
      g.linearRampToValueAtTime(0.0, now + 4 + Math.random() * 2);
    }
    if (this.t > this.nextDrip) { this.nextDrip = this.t + (1.5 + Math.random() * 6) / Math.max(0.2, p.drips); this.drip(); }
    // rain is drops, not hiss: many tiny ticks per second on leaves and stone
    if (p.rain > 0) {
      const perSec = 6 + 30 * p.rain;
      let k = perSec * dt; while (k > 0) { if (Math.random() < k) this.raindrop(); k -= 1; }
    }
    if (this.t > this.nextAnimal) { this.nextAnimal = this.t + (8 + Math.random() * 22) * (1 + 2 * p.snow + p.rain) * (1 - 0.35 * (p.night || 0)); this.animal(); }
    // the stream: by distance, and a step up when you are in the channel itself (the water is round your ankles)
    const inStream = streamDist < 0.6;
    const level = p.stream ? p.stream / (1 + (streamDist * streamDist) / 6) * (inStream ? 1.25 : 1) : 0;
    this.streamLevel = level;
    this.streamGain.gain.setTargetAtTime(level * 0.015, now, 0.3);
    // the recording: the full stream close by, the trickle variant further off; still water laps as you wade, by depth and pace
    const wading = Math.min(1, wadeDepth / 0.12) * (0.25 + 0.75 * moving);
    if (this.beds.stream) this.beds.stream.gain.setTargetAtTime(Math.min(1, level * 1.3) * 0.75, now, 0.4);
    if (this.beds.trickle) this.beds.trickle.gain.setTargetAtTime(Math.max(Math.min(1, level * 0.6) * 0.35, wading * 0.4), now, 0.6);
    if (wading > 0.05 && moving > 0.2) { let k = (2 + 10 * wading) * dt; while (k > 0) { if (Math.random() < k) this.bubble(0.5 + wading); k -= 1; } }
    // keep the recording's drips when the rain bed is absent; a few bubbles close to the water, as garnish
    if (this.beds.rain) { if (this.beds.rain.gain.value > 0.01 && p.rain === 0) this.beds.rain.gain.setTargetAtTime(0, now, 1); }
    if (level > 0.5 && !this.beds.stream) {
      const perSec = 6 + 30 * level;
      let k = perSec * dt; while (k > 0) { if (Math.random() < k) this.bubble(level); k -= 1; }
    }
  }

  // --- one-shots

  tone(type, f0, f1, t0, dur, gain, dest, slide = 'exp') {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) { if (slide === 'exp') o.frequency.exponentialRampToValueAtTime(f1, t0 + dur); else o.frequency.linearRampToValueAtTime(f1, t0 + dur); }
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.01, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    o.connect(g).connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
    return g;
  }
  far(pan = null) {
    // distant: lowpassed, panned, more reverb
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800 + Math.random() * 1500;
    const p = ctx.createStereoPanner(); p.pan.value = pan ?? (Math.random() * 1.6 - 0.8);
    lp.connect(p); p.connect(this.master); p.connect(this.verbIn);
    return lp;
  }

  bubble(level) {
    const ctx = this.ctx, now = ctx.currentTime;
    const f = 220 + Math.pow(Math.random(), 2) * 1400;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f, now); o.frequency.exponentialRampToValueAtTime(f * (1.25 + Math.random() * 0.4), now + 0.04 + Math.random() * 0.05);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime((0.012 + Math.random() * 0.03) * Math.min(1, level * 1.5), now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0004, now + 0.07 + Math.random() * 0.12);
    const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 1.2 - 0.6;
    o.connect(g).connect(p); p.connect(this.master); if (Math.random() < 0.3) p.connect(this.verbIn);
    o.start(now); o.stop(now + 0.25);
  }
  gurgle(level) {
    const ctx = this.ctx, now = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.6 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(300 + Math.random() * 500, now); f.frequency.exponentialRampToValueAtTime(150 + Math.random() * 200, now + 0.2); f.Q.value = 2.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.08 * Math.min(1, level * 1.5), now + 0.03); g.gain.exponentialRampToValueAtTime(0.0005, now + 0.2 + Math.random() * 0.25);
    const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 1.0 - 0.5;
    s.connect(f).connect(g).connect(p).connect(this.master); s.start(now, Math.random() * 10); s.stop(now + 0.6);
  }

  raindrop() {
    const ctx = this.ctx, now = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 1.5 + Math.random() * 1.5;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 4000; f.Q.value = 3 + Math.random() * 4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.05, now + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, now + 0.02 + Math.random() * 0.04);
    const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 1.8 - 0.9;
    s.connect(f).connect(g).connect(p).connect(this.master); s.start(now, Math.random() * 3); s.stop(now + 0.1);
  }

  drip(echo = true) {
    const ctx = this.ctx, now = ctx.currentTime;
    const f = 1400 + Math.random() * 2200;
    const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 1.6 - 0.8;
    p.connect(this.verbIn); p.connect(this.master);
    if (this.dripVerbSend) p.connect(this.dripVerbSend);
    const g = 0.05 + Math.random() * 0.05;
    this.tone('sine', f * 1.4, f, now, 0.14 + Math.random() * 0.1, g, p);
    // a tiny splash under the note where the floor is wet stone or standing water
    if (this.profile && (this.profile.reverb > 0.5 || this.wade.depth > 0)) {
      const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 2 + Math.random();
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3000 + Math.random() * 2000; bp.Q.value = 2;
      const sg = ctx.createGain(); sg.gain.setValueAtTime(0, now + 0.01); sg.gain.linearRampToValueAtTime(g * 0.5, now + 0.014); sg.gain.exponentialRampToValueAtTime(0.0005, now + 0.05);
      s.connect(bp).connect(sg).connect(p); s.start(now + 0.01, Math.random() * 3); s.stop(now + 0.1);
    }
    // in a stone room the drip comes back off the far wall, once or twice, quieter and further off
    if (echo && this.profile && this.profile.reverb > 0.6) {
      const n = 1 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 1; i <= n; i++) {
        const t0 = now + i * (0.22 + Math.random() * 0.2);
        const pe = ctx.createStereoPanner(); pe.pan.value = -p.pan.value * 0.6; pe.connect(this.verbLong); pe.connect(this.master);
        this.tone('sine', f * 1.3, f * 0.98, t0, 0.12, g * 0.22 / i, pe);
      }
    }
  }

  animal() {
    const list = this.profile.animals; if (!list || !list.length) return;
    // never the same animal twice running, where the place has more than one
    const choices = list.filter(n => n !== this.lastAnimal);
    const name = (choices.length ? choices : list)[Math.floor(Math.random() * (choices.length ? choices : list).length)];
    this.lastAnimal = name;
    const rec = CLIPS[name];
    if (rec) { this.playCall(rec[Math.floor(Math.random() * rec.length)]); return; }
    const fn = this.calls[name]; if (fn) fn.call(this);
  }
  // a recorded call, somewhere off in the trees: panned, softened with distance, a little reverb
  async playCall(url) {
    const buf = await this.clip(url); if (!buf || !this.started) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const dist = 0.3 + Math.random() * 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000 - 4200 * dist;
    const g = ctx.createGain(); g.gain.value = 0.35 * (1 - dist * 0.7);
    const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 1.6 - 0.8;
    src.connect(lp).connect(g).connect(p); p.connect(this.master); p.connect(this.verbIn);
    src.start(now);
  }

  get calls() {
    const ctx = this.ctx;
    return {
      // Japanese bush warbler: a long rising note then "kekyo"
      warbler() {
        const now = ctx.currentTime, d = this.far();
        this.tone('sine', 2400, 2900, now, 0.55, 0.012, d, 'lin');
        this.tone('sine', 3400, 2600, now + 0.65, 0.09, 0.014, d);
        this.tone('sine', 3000, 3600, now + 0.76, 0.1, 0.014, d);
        this.tone('sine', 2900, 2500, now + 0.88, 0.14, 0.012, d);
      },
      // wren: a fast loud trill
      wren() {
        const now = ctx.currentTime, d = this.far();
        const n = 8 + Math.floor(Math.random() * 8), base = 4200 + Math.random() * 1200;
        for (let i = 0; i < n; i++) this.tone('sine', base * (1 + (i % 2) * 0.12), base * 0.9, now + i * 0.055, 0.045, 0.012, d);
        for (let i = 0; i < 5; i++) this.tone('sine', 5200 - i * 300, 4200 - i * 300, now + n * 0.055 + i * 0.09, 0.07, 0.011, d);
      },
      // chaffinch: a descending run and a flourish
      chaffinch() {
        const now = ctx.currentTime, d = this.far();
        for (let i = 0; i < 7; i++) this.tone('sine', 4200 - i * 250, 3900 - i * 250, now + i * 0.08, 0.06, 0.012, d);
        this.tone('sine', 2600, 3800, now + 0.62, 0.12, 0.014, d);
        this.tone('sine', 3800, 2400, now + 0.76, 0.16, 0.014, d);
      },
      // crow: two or three caws, rough
      crow() {
        const now = ctx.currentTime, d = this.far();
        const n = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
          const t0 = now + i * 0.45;
          this.tone('sawtooth', 720, 560, t0, 0.22, 0.006, d);
          this.tone('square', 360, 280, t0, 0.22, 0.004, d);
        }
      },
      // raven: deeper, croaking pulses
      raven() {
        const now = ctx.currentTime, d = this.far(); d.frequency.value = 1800;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const t0 = now + i * 0.55;
          for (let k = 0; k < 7; k++) this.tone('sawtooth', 240 + Math.random() * 40, 200, t0 + k * 0.03, 0.028, 0.007, d);
        }
      },
      // owl: two soft hoots
      owl() {
        const now = ctx.currentTime, d = this.far(); d.frequency.value = 900;
        this.tone('sine', 400, 380, now, 0.4, 0.02, d);
        this.tone('sine', 380, 360, now + 0.5, 0.6, 0.018, d);
      },
      // pigeon: cooing pulses
      pigeon() {
        const now = ctx.currentTime, d = this.far(); d.frequency.value = 1200;
        for (let i = 0; i < 5; i++) this.tone('sine', 390 + (i === 1 ? 60 : 0), 370, now + i * 0.22, i === 1 ? 0.35 : 0.16, 0.012, d);
      },
      // deer: a single sharp bark
      deer() {
        const now = ctx.currentTime, d = this.far(); d.frequency.value = 2200;
        const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 1.2;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 950; f.Q.value = 2.5;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.25, now + 0.015); g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        s.connect(f).connect(g).connect(d); s.start(now, Math.random() * 3); s.stop(now + 0.3);
      },
      // elk: a far bugle rising over a second
      elk() {
        const now = ctx.currentTime, d = this.far(); d.frequency.value = 2400;
        this.tone('sawtooth', 700, 2100, now, 1.3, 0.004, d);
        this.tone('sine', 700, 2100, now, 1.3, 0.008, d);
        this.tone('sine', 2100, 1500, now + 1.3, 0.4, 0.006, d);
      },
      // frog: a pulsed croak
      frog() {
        const now = ctx.currentTime, d = this.far(); d.frequency.value = 1500;
        const n = 6 + Math.floor(Math.random() * 6);
        for (let i = 0; i < n; i++) this.tone('square', 420 + Math.random() * 60, 380, now + i * 0.045, 0.03, 0.006, d);
      },
      // sheep: a bleat with vibrato, far off
      sheep() {
        const now = ctx.currentTime, d = this.far(); d.frequency.value = 1600;
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 520 + Math.random() * 120;
        const v = ctx.createOscillator(); v.frequency.value = 24; const vg = ctx.createGain(); vg.gain.value = 30; v.connect(vg).connect(o.frequency);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.007, now + 0.08); g.gain.linearRampToValueAtTime(0.0, now + 0.7);
        o.connect(g).connect(d); o.start(now); v.start(now); o.stop(now + 0.8); v.stop(now + 0.8);
      },
      // cowbell: two inharmonic partials, far off
      cowbell() {
        const now = ctx.currentTime, d = this.far(); d.frequency.value = 3000;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const t0 = now + i * (0.3 + Math.random() * 0.4);
          this.tone('square', 1180, 1180, t0, 0.5, 0.004, d);
          this.tone('square', 1760, 1760, t0, 0.35, 0.003, d);
        }
      },
      // barred owl: "who cooks for you, who cooks for you-all": eight hoots, the last one falling away
      barredowl() {
        const now = ctx.currentTime, d = this.far(); d.frequency.value = 1100;
        const pat = [[0, 0.22, 520], [0.3, 0.2, 560], [0.58, 0.2, 540], [0.86, 0.42, 500], [1.5, 0.22, 520], [1.8, 0.2, 560], [2.08, 0.2, 540], [2.36, 0.75, 480]];
        pat.forEach(([t0, dur, f], i) => {
          this.tone('sine', f, i === pat.length - 1 ? f * 0.72 : f * 0.96, now + t0, dur, 0.022, d);
          this.tone('triangle', f * 2.01, f * 1.9, now + t0, dur * 0.8, 0.005, d);
        });
      },
      // cicadas: a shrill pulsing buzz, somewhere high up, rising and falling over a few seconds
      cicada() {
        const now = ctx.currentTime, d = this.far(); d.frequency.value = 7000;
        const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 2.4; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4300 + Math.random() * 1200; f.Q.value = 9;
        const am = ctx.createOscillator(); am.type = 'square'; am.frequency.value = 55 + Math.random() * 40;
        const amg = ctx.createGain(); amg.gain.value = 0.5; const dc = ctx.createConstantSource(); dc.offset.value = 0.5;
        const ring = ctx.createGain(); ring.gain.value = 0; am.connect(amg).connect(ring.gain); dc.connect(ring.gain);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, now);
        const len = 3 + Math.random() * 4;
        g.gain.linearRampToValueAtTime(0.03, now + len * 0.35); g.gain.linearRampToValueAtTime(0.03, now + len * 0.7); g.gain.linearRampToValueAtTime(0, now + len);
        s.connect(f).connect(ring).connect(g).connect(d);
        s.start(now, Math.random() * 5); am.start(now); dc.start(now); s.stop(now + len + 0.1); am.stop(now + len + 0.1); dc.stop(now + len + 0.1);
      },
      // pileated woodpecker: a loud rising-falling laugh, then drumming on a trunk
      woodpecker() {
        const now = ctx.currentTime, d = this.far(); d.frequency.value = 2600;
        for (let i = 0; i < 7; i++) this.tone('sawtooth', 900 + Math.sin(i * 0.8) * 150, 820, now + i * 0.11, 0.07, 0.006, d);
        const n = 10 + Math.floor(Math.random() * 6), t0 = now + 1.4;
        for (let i = 0; i < n; i++) {
          const t = t0 + i * (0.06 + i * 0.004);
          const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.9;
          const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 2;
          const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
          s.connect(f).connect(g).connect(d); s.start(t, Math.random() * 3); s.stop(t + 0.1);
        }
      },
      // crickets: a soft, fast, slightly irregular chirp train, high and far off, for the warm nights
      cricket() {
        const now = ctx.currentTime, d = this.far(); d.frequency.value = 6500;
        const f = 3900 + Math.random() * 900, n = 5 + Math.floor(Math.random() * 7), gap = 0.11 + Math.random() * 0.05;
        for (let i = 0; i < n; i++) {
          const t0 = now + i * gap + (Math.random() - 0.5) * 0.01;
          for (let k = 0; k < 3; k++) this.tone('sine', f, f * 0.985, t0 + k * 0.018, 0.012, 0.008, d, 'lin');
        }
      },
      // a run of drips with their echo, for the tunnels
      drip() { this.drip(); setTimeout(() => this.drip(false), 180 + Math.random() * 300); if (Math.random() < 0.5) setTimeout(() => this.drip(false), 700 + Math.random() * 500); },
    };
  }

  // footsteps: ground is 'wet' | 'dry' | 'rock' | 'mud' | 'water'; depth is the water under the foot in metres.
  // Each ground has several variants (a flat tread, a scuff, a crunch or a suck or a gravel skitter); the same
  // variant never plays twice running, and every burst is jittered in pitch and level besides.
  step(brisk = 0, ground = this.ground, depth = 0) {
    if (!this.started) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const lvl = 0.85 + Math.random() * 0.3;   // the whole step a little louder or softer
    const burst = (rate, type, f0, f1, q, t0, dur, gain, dest = this.master) => {
      const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t0); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur); f.Q.value = q;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain * lvl, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      s.connect(f).connect(g).connect(dest); s.start(t0, Math.random() * 3); s.stop(t0 + dur + 0.1);
      return g;
    };
    const r = Math.random;
    const last = this.lastStep[ground] ?? -1;
    const nVar = 3;
    let v = Math.floor(r() * nVar); if (v === last) v = (v + 1 + Math.floor(r() * (nVar - 1))) % nVar;
    this.lastStep[ground] = v;
    // a tread for everything but water: the heel's thud
    const thud = (f0, dur, gain) => burst(0.5 + r() * 0.3, 'lowpass', f0 + r() * 150, 120, 0.7, now, dur, gain + 0.3 * brisk);
    switch (ground) {
      case 'dry':
        thud(480, 0.11, 0.42);
        if (v === 0) { burst(1.8 + r(), 'highpass', 1800 + r() * 800, 1800, 0.5, now + 0.005, 0.07 + r() * 0.04, 0.09); burst(2.2 + r(), 'highpass', 3000, 3000, 0.5, now + 0.04, 0.05, 0.05); }   // the crunch of leaf litter
        else if (v === 1) { for (let i = 0; i < 4; i++) burst(2 + r(), 'highpass', 2200 + r() * 1500, 2000, 0.8, now + 0.01 + i * 0.022, 0.025, 0.05); }   // twigs and dry leaves breaking
        else { burst(1.2 + r(), 'bandpass', 1200 + r() * 600, 700, 1.0, now + 0.03, 0.14, 0.05); }   // a scuff
        break;
      case 'rock':
        thud(380, 0.09, 0.33);
        if (v === 0) { burst(2.5 + r(), 'bandpass', 2600 + r() * 2000, 2200, 2.5, now, 0.03, 0.14); burst(1.5, 'bandpass', 900, 700, 1.5, now + 0.012, 0.05, 0.05); }   // the click of a boot on stone
        else if (v === 1) { for (let i = 0; i < 5 + Math.floor(r() * 4); i++) burst(2 + r() * 1.5, 'bandpass', 2000 + r() * 2500, 1800, 3, now + 0.02 + i * (0.018 + r() * 0.02), 0.03, 0.07); }   // gravel skittering
        else { burst(1.8 + r(), 'bandpass', 1500 + r() * 800, 900, 1.2, now + 0.01, 0.12, 0.06); }   // a grit scrape
        break;
      case 'mud':
        thud(300, 0.16, 0.48);
        if (v === 0) { burst(1.2 + r() * 0.8, 'bandpass', 900 + r() * 600, 400, 1.2, now + 0.02, 0.16 + r() * 0.08, 0.12); burst(1.6 + r(), 'bandpass', 2200 + r() * 1200, 1800, 1.0, now + 0.1, 0.08, 0.05); }   // the slow suck
        else if (v === 1) { burst(0.9 + r() * 0.5, 'bandpass', 500 + r() * 300, 1400, 1.4, now + 0.04, 0.2 + r() * 0.1, 0.11); burst(2 + r(), 'bandpass', 2600 + r() * 1200, 2000, 1.5, now + 0.2, 0.05, 0.05); }   // a boot pulled out, rising, and the release
        else { burst(1.0 + r() * 0.6, 'bandpass', 700 + r() * 400, 500, 1.0, now + 0.02, 0.1, 0.08); for (let i = 0; i < 3; i++) this.bubble(0.5); }   // a squelch with bubbles
        break;
      case 'water': {
        // the splash grows with depth: a flick at the surface, a wade ankle-deep, a slosh at the shin
        const d = Math.min(1, depth / 0.16), big = 0.6 + 1.2 * d;
        burst(1.4 + r(), 'bandpass', (1400 - 600 * d) + r() * 900, 700 - 300 * d, 0.8, now, 0.18 + 0.12 * d + r() * 0.08, (0.2 + 0.2 * brisk) * big);
        burst(0.5 + r() * 0.3, 'lowpass', 400, 120, 0.7, now, 0.1 + 0.1 * d, 0.22 * big);
        if (v === 0 || d > 0.5) this.tone('sine', 2200 + r() * 1500, 1600, now + 0.05 + r() * 0.05, 0.08, 0.03 * big, this.verbIn);
        if (v === 1) for (let i = 0; i < 2 + Math.round(4 * d); i++) setTimeout(() => this.bubble(0.6 + d), 40 + i * 50 + r() * 60);   // droplets falling back
        if (v === 2 || d > 0.6) burst(0.8 + r() * 0.4, 'bandpass', 500 + r() * 300, 900, 1.2, now + 0.1, 0.25 + 0.2 * d, 0.07 * big);   // the slosh after
        break;
      }
      default: // wet earth and moss
        thud(420, 0.13 + r() * 0.05, 0.48);
        if (v === 0) burst(1.6 + r(), 'bandpass', 1800 + r() * 1500, 1500, 1.2, now + 0.01, 0.09 + r() * 0.06, 0.06 + r() * 0.05);   // the soft give of the moss
        else if (v === 1) { burst(1.0 + r() * 0.5, 'bandpass', 700 + r() * 400, 400, 1.2, now + 0.03, 0.14, 0.07); burst(2 + r(), 'highpass', 2800, 2600, 0.6, now + 0.06, 0.04, 0.03); }   // a wet press and a small tick
        else burst(1.3 + r(), 'bandpass', 1300 + r() * 800, 2200, 1.0, now + 0.02, 0.11, 0.06);   // a squeak of wet moss
    }
  }

  // --- the small things: a frog leaving the path (a leaf-litter flick, a plop if it lands in water), spores puffed off a cushion
  frogHop(inWater = false) {
    if (!this.started) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 1.6 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = inWater ? 900 + Math.random() * 500 : 2400 + Math.random() * 1500; f.Q.value = 1.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(inWater ? 0.12 : 0.05, now + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, now + (inWater ? 0.16 : 0.06));
    const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 0.8 - 0.4;
    s.connect(f).connect(g).connect(p); p.connect(this.master); p.connect(this.verbIn); s.start(now, Math.random() * 3); s.stop(now + 0.3);
    if (inWater) this.tone('sine', 900 + Math.random() * 400, 300, now + 0.02, 0.12, 0.03, p);
  }
  puff() {
    if (!this.started) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 1.1;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, now); f.frequency.exponentialRampToValueAtTime(400, now + 0.25);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.06, now + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, now + 0.3);
    s.connect(f).connect(g).connect(this.master); s.start(now, Math.random() * 3); s.stop(now + 0.4);
  }
  call(name) { const fn = this.calls[name]; if (this.started && fn) fn.call(this); }
  // the book: picked up off the floor (two quick rising pops, the way an item is taken), a page turned (a short
  // dry swish of paper), signed (the pops again, lower), opened and closed (the soft thump of the covers)
  pickup() {
    if (!this.started) return;
    const ctx = this.ctx, now = ctx.currentTime;
    this.tone('square', 520, 1040, now, 0.07, 0.05, this.master);
    this.tone('square', 700, 1400, now + 0.08, 0.08, 0.05, this.master);
  }
  pageTurn() {
    if (!this.started) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 1.6;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.7; f.frequency.setValueAtTime(2600, now); f.frequency.exponentialRampToValueAtTime(900, now + 0.16);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.05, now + 0.03); g.gain.exponentialRampToValueAtTime(0.0005, now + 0.2);
    s.connect(f).connect(g).connect(this.master); s.start(now, Math.random() * 3); s.stop(now + 0.25);
  }
  bookSign() {
    if (!this.started) return;
    const ctx = this.ctx, now = ctx.currentTime;
    this.tone('square', 440, 660, now, 0.08, 0.045, this.master);
    this.tone('square', 660, 880, now + 0.1, 0.1, 0.045, this.master);
  }
  bookThump(open = true) {
    if (!this.started) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.5;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(open ? 700 : 420, now); f.frequency.exponentialRampToValueAtTime(140, now + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.07, now + 0.012); g.gain.exponentialRampToValueAtTime(0.0005, now + 0.16);
    s.connect(f).connect(g).connect(this.master); s.start(now, Math.random() * 3); s.stop(now + 0.2);
  }

  // an animal bolting, from a side and a distance: a run of hoof-falls (or the soft pads of a fox) that quicken
  // and fade as it goes, and the brush it crashes through
  bolt(kind = 'hooves', pan = 0, dist = 12, heavy = false) {
    if (!this.started) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const far = Math.max(0, Math.min(1, (dist - 8) / 14));
    const out = this.far(pan); out.frequency.value = 2600 - 1400 * far;
    const level = (1 - far * 0.6) * (this.profile && this.profile.snow ? 0.6 : 1);
    const falls = kind === 'pads' ? 10 : heavy ? 8 : 12;
    let t = now + 0.05;
    for (let i = 0; i < falls; i++) {
      const k = i / falls, gap = (heavy ? 0.34 : kind === 'pads' ? 0.16 : 0.2) * (1.15 - 0.3 * k);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
      const amp = (kind === 'pads' ? 0.05 : heavy ? 0.16 : 0.12) * level * (1 - k * 0.8) * (0.8 + Math.random() * 0.4);
      g.gain.linearRampToValueAtTime(amp, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, t + (kind === 'pads' ? 0.05 : 0.09));
      const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.35 + Math.random() * 0.2;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'pads' ? 600 : heavy ? 220 : 320;
      s.connect(lp).connect(g).connect(out); s.start(t, Math.random() * 8); s.stop(t + 0.2);
      if (kind !== 'pads') { const th = this.tone('sine', heavy ? 70 : 95, heavy ? 45 : 60, t, 0.08, amp * 0.5, out); }
      t += gap + Math.random() * 0.03;
    }
    // the brush: leaves and twigs, a swell and a tail
    const br = ctx.createBufferSource(); br.buffer = this.noise; br.playbackRate.value = 1.8 + Math.random();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 1200; bp.Q.value = 0.8;
    const bg = ctx.createGain(); bg.gain.setValueAtTime(0, now);
    bg.gain.linearRampToValueAtTime((kind === 'brush' ? 0.09 : 0.05) * level, now + 0.25); bg.gain.linearRampToValueAtTime(0.03 * level, now + 1.0); bg.gain.exponentialRampToValueAtTime(0.0005, now + 2.2 + far);
    br.connect(bp).connect(bg).connect(out); br.start(now, Math.random() * 6); br.stop(now + 3.5);
  }

  exitChime() {
    if (!this.started) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const g = this.leafGain.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.22, now + 1.2); g.linearRampToValueAtTime(0.0, now + 5);
    this.animal(); setTimeout(() => this.animal(), 900);
  }
}
