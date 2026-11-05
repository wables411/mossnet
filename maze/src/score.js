// Local records in localStorage: longest run (mazes found in one go),
// most time survived, and the fastest time for each maze level.
const KEY = 'moss-maze-records-v1';

function load() {
  try { return Object.assign({ bestMazes: 0, bestTime: 0, fastest: {}, runs: 0 }, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch { return { bestMazes: 0, bestTime: 0, fastest: {}, runs: 0 }; }
}
function save(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* storage blocked: records just do not persist */ } }

export const records = {
  get() { return load(); },
  runStarted() { const r = load(); r.runs++; save(r); },
  mazeFound(level, seconds) {
    const r = load();
    if (!r.fastest[level] || seconds < r.fastest[level]) r.fastest[level] = Math.round(seconds * 10) / 10;
    if (level > r.bestMazes) r.bestMazes = level;
    save(r);
  },
  runEnded(totalSeconds) {
    const r = load();
    if (totalSeconds > r.bestTime) r.bestTime = Math.round(totalSeconds);
    save(r);
  },
};

export function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60), r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
