// The frame-time governor. No preset can know the device, so this measures
// the frame interval as the game runs, learns what the display can show
// (60 Hz, 120 Hz, a throttled 30), and steps the expensive things down or up
// until the frame time holds that rate: render resolution, how many shoots
// stand near the camera, how many fuzz layers are drawn, how often the shadow
// map refreshes, how much rain falls. Hysteresis keeps it from oscillating.
export class Governor {
  constructor(apply, levels = 8) {
    this.apply = apply;          // (q: 0..1) => void
    this.levels = levels;
    this.level = levels;         // start at the top; the first second decides
    this.refresh = 16.7;         // learned display interval, ms
    this.samples = [];
    this.hot = 0; this.cold = 0;
    this.hold = 0;               // frames to ignore after a change or a level build
    this.enabled = true;
  }

  // call after anything that stalls on purpose (a maze build, a tab switch)
  settle(frames = 45) { this.hold = frames; this.samples.length = 0; this.hot = 0; this.cold = 0; }

  tick(dtMs) {
    if (!this.enabled) return;
    if (this.hold > 0) { this.hold--; return; }
    if (dtMs > 250) return;      // a tab switch, not a frame
    this.samples.push(dtMs);
    if (this.samples.length < 30) return;   // half a second at 60 Hz, two at 15: a weak device drops fast

    const s = [...this.samples].sort((a, b) => a - b);
    this.samples.length = 0;
    // the display rate: the fast frames tell us what is possible
    const fast = s[Math.floor(s.length * 0.1)];
    for (const r of [8.33, 11.1, 16.7, 20, 33.3]) if (fast < r * 1.15) { this.refresh = r; break; }
    const p75 = s[Math.floor(s.length * 0.75)], p95 = s[Math.floor(s.length * 0.95)];
    const target = this.refresh;

    if (p75 > target * 1.12 || p95 > target * 1.6) {
      // too slow: step down at once
      this.hot++; this.cold = 0;
      if (this.level > 0) { this.level--; this.apply(this.level / this.levels); this.hold = 15; }
    } else if (p95 < target * 1.08) {
      // comfortably fast for a while: try one step up
      this.cold++; this.hot = 0;
      if (this.cold >= 6 && this.level < this.levels) { this.level++; this.apply(this.level / this.levels); this.hold = 30; this.cold = 0; }
    } else {
      this.cold = 0;
    }
  }
}
