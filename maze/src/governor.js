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
    this.probe = false;          // set on one frame in each batch: the loop times that frame's real cost into `work`
    this.work = undefined;       // ms one frame really took to draw, start to finished on the GPU
    this.patience = 6;           // good batches in a row before trying a step up; grows when a step up did not hold
    this.sinceUp = 99;           // batches since the last step up
  }

  // call after anything that stalls on purpose (a maze build, a tab switch)
  settle(frames = 45) { this.hold = frames; this.samples.length = 0; this.hot = 0; this.cold = 0; }

  // The waking-up: before the player can move, the loop hands over what each frame really cost to draw, and the
  // detail comes down, quickly and in big steps, until a frame fits inside one tick of a 60 Hz screen with room to
  // spare. The stumbles of finding the level happen while the picture is still swimming, not once the walk begins.
  beginCalibrate() { this.cal = []; this.calHold = 6; }
  calibrate(workMs) {
    if (!this.enabled || !this.cal) return;
    if (this.calHold > 0) { this.calHold--; return; }
    if (workMs > 250) return;
    this.cal.push(workMs);
    if (this.cal.length < 10) return;
    const med = this.cal.sort((a, b) => a - b)[5];
    this.cal = [];
    const budget = 16.7 * 0.86;
    if (med > budget && this.level > 0) {
      this.level = Math.max(0, this.level - (med > budget * 1.35 ? 2 : 1));
      this.apply(this.level / this.levels); this.calHold = 5;
    }
  }
  // and once the walk begins it is slow to try more detail again
  endCalibrate() { if (!this.cal) return; this.cal = null; this.settle(30); this.patience = 40; this.sinceUp = 99; }

  tick(dtMs) {
    if (!this.enabled) return;
    if (this.hold > 0) { this.hold--; return; }
    if (dtMs > 250) return;      // a tab switch, not a frame
    this.samples.push(dtMs);
    this.probe = this.samples.length === 15;
    if (this.samples.length < 30) return;   // half a second at 60 Hz, two at 15: a weak device drops fast

    const s = [...this.samples].sort((a, b) => a - b);
    this.samples.length = 0;
    // the display rate: the fast frames tell us what is possible
    const fast = s[Math.floor(s.length * 0.1)];
    // Frames slower than 60 a second mean one of two things. Either the screen (or the browser) is only showing
    // 30 or 50, and then drawing a frame takes far less time than the wait between frames; or the picture is too
    // heavy for this machine at this size, and then drawing it IS the wait. Only the first is a rate to settle
    // for. The second used to be taken for one too, and a big window sat at 40 uneven frames a second for good.
    let rate = 0;
    for (const r of [8.33, 11.1, 16.7]) if (fast < r * 1.15) { rate = r; break; }
    if (!rate) rate = this.work !== undefined && this.work < fast * 0.6 ? (fast < 20 * 1.15 ? 20 : 33.3) : 16.7;
    this.refresh = rate;
    this.sinceUp++;
    const p75 = s[Math.floor(s.length * 0.75)], p95 = s[Math.floor(s.length * 0.95)];
    const target = this.refresh;

    if (p75 > target * 1.12 || p95 > target * 1.6) {
      // too slow: step down at once
      this.hot++; this.cold = 0;
      // a step up that had to be taken straight back: wait much longer before trying it again (each change of
      // size is a hitch of its own)
      if (this.sinceUp <= 3) this.patience = Math.min(120, this.patience * 3);
      if (this.level > 0) { this.level--; this.apply(this.level / this.levels); this.hold = 15; }
    } else if (p95 < target * 1.08) {
      // comfortably fast for a while: try one step up
      this.cold++; this.hot = 0;
      if (this.cold >= this.patience && this.level < this.levels) { this.level++; this.apply(this.level / this.levels); this.hold = 30; this.cold = 0; this.sinceUp = 0; }
    } else {
      this.cold = 0;
    }
  }
}
