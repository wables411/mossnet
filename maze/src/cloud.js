// Account saves, the same way Moss Quest keeps its own: progress lives in this browser's localStorage and always
// will; when the player is signed in on mossmossmoss.quest (RemiliaNET, or a wallet that signed for saves there),
// a copy is kept on the site under that account, so the same walk opens on another device. The site's /save
// function holds it in a slot of its own (/save/maze) beside the Moss Quest save.
//
// What is kept: the records, the bug book, the finds, the satchel and the journal.
// How two copies become one (this device's and the account's):
//   - records, bugs, finds only ever grow: the larger or better of each is kept, nothing found is lost;
//   - the satchel and the page being written are whole things that change both ways (an item is used up, a line
//     is rubbed out), so the copy changed most recently wins. One exception: a device that has never been joined to
//     this account takes the account's copy, so signing in on a new device cannot overwrite what the account holds;
//   - signed books are added together.
// Nothing is sent up until the account's copy has been read and folded in. Every step may fail; the game never
// waits on any of it.
import { remiliaToken } from './handheld.js?v=40c16947';

const KEYS = { records: 'moss-maze-records-v1', bugs: 'moss-maze-bugs-v1', finds: 'moss-maze-finds-v1', satchel: 'moss-maze-satchel-v1', book: 'moss-maze-book-v1' };
const META = 'moss-maze-cloud-v1';
const DOORS = { wallet: 'moss-save-token', remilia: 'moss-save-token-remilia' };   // the site's own sessions for /save (script.js)

const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const hash = v => { const s = JSON.stringify(v ?? null); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h + ':' + s.length; };
const quillOf = b => (b && b.quill) || { pages: [''], page: 0 };
const emptyQuill = q => !q || !(q.pages || []).some(p => String(p || '').trim());
const emptySatchel = s => !s || !(s.slots || []).some(Boolean);

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`/save${path}`, { method, headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: `Bearer ${token}` } : {}), body: body === undefined ? undefined : JSON.stringify(body) });
  let data = {}; try { data = await res.json(); } catch { /* not ours: a plain file server answers with a page */ }
  return { status: res.status, ok: res.ok, data };
}

export class Cloud {
  // o: { onApply() -> the game reads its localStorage again, onStatus(text, kind) }
  constructor(o = {}) { this.o = o; this.tokens = []; this.ready = false; this.pushed = ''; this.status = { kind: 'off', text: '' }; }

  meta() { return Object.assign({ owners: [], satchel: { h: '', t: 0 }, quill: { h: '', t: 0 } }, read(META) || {}); }
  // when did the satchel and the written page last change on this device? Their text is compared with what it was
  // the last time anyone looked: different means changed since, and the change is dated now
  stamp() {
    const m = this.meta(), now = Date.now();
    const hs = hash(read(KEYS.satchel)), hq = hash(quillOf(read(KEYS.book)));
    if (hs !== m.satchel.h) m.satchel = { h: hs, t: emptySatchel(read(KEYS.satchel)) && !m.satchel.h ? 0 : now };
    if (hq !== m.quill.h) m.quill = { h: hq, t: emptyQuill(quillOf(read(KEYS.book))) && !m.quill.h ? 0 : now };
    write(META, m); return m;
  }
  local() {
    const m = this.stamp(), book = read(KEYS.book) || {};
    return {
      v: 1, records: read(KEYS.records) || {}, bugs: read(KEYS.bugs) || {}, finds: read(KEYS.finds) || {},
      satchel: { t: m.satchel.t, state: read(KEYS.satchel) },
      book: { found: !!book.found, signed: book.signed || [], quill: quillOf(book), t: m.quill.t },
    };
  }
  merge(a, b, adopt) {
    const out = { v: 1 };
    const ra = a.records || {}, rb = b.records || {}, fast = Object.assign({}, ra.fastest);
    for (const [k, v] of Object.entries(rb.fastest || {})) if (v > 0 && (!fast[k] || v < fast[k])) fast[k] = v;
    out.records = { bestMazes: Math.max(ra.bestMazes || 0, rb.bestMazes || 0), bestTime: Math.max(ra.bestTime || 0, rb.bestTime || 0), runs: Math.max(ra.runs || 0, rb.runs || 0), fastest: fast };
    out.bugs = Object.assign({}, a.bugs); for (const [k, v] of Object.entries(b.bugs || {})) out.bugs[k] = Math.max(out.bugs[k] || 0, +v || 0);
    out.finds = Object.assign({}, b.finds, a.finds);
    const sa = a.satchel || {}, sb = b.satchel || {};
    out.satchel = sb.state && ((adopt && !emptySatchel(sb.state)) || (sb.t || 0) > (sa.t || 0)) ? sb : sa;
    const ba = a.book || {}, bb = b.book || {};
    const signed = [...(ba.signed || [])], have = new Set(signed.map(x => JSON.stringify(x)));
    for (const x of bb.signed || []) if (!have.has(JSON.stringify(x))) signed.push(x);
    const theirs = bb.quill && ((adopt && !emptyQuill(bb.quill)) || (bb.t || 0) > (ba.t || 0));
    out.book = { found: !!(ba.found || bb.found), signed, quill: theirs ? bb.quill : (ba.quill || quillOf(null)), t: theirs ? (bb.t || 0) : (ba.t || 0) };
    return out;
  }
  // put a merged copy on this device, and say so to the game
  keep(s) {
    write(KEYS.records, s.records); write(KEYS.bugs, s.bugs); write(KEYS.finds, s.finds);
    if (s.satchel && s.satchel.state) write(KEYS.satchel, s.satchel.state);
    const book = read(KEYS.book) || {};
    write(KEYS.book, Object.assign(book, { found: s.book.found, signed: s.book.signed, quill: s.book.quill }));
    const m = this.meta();
    m.satchel = { h: hash(read(KEYS.satchel)), t: (s.satchel && s.satchel.t) || 0 }; m.quill = { h: hash(s.book.quill), t: s.book.t || 0 };
    write(META, m);
    if (this.o.onApply) this.o.onApply();
  }
  say(kind, text) { this.status = { kind, text }; if (this.o.onStatus) this.o.onStatus(text, kind); }

  live(kind) { const t = read(DOORS[kind]); return t && t.token && t.expires > Date.now() ? t : null; }
  // every door there is a key for; the RemiliaNET one is made here if this tab holds the site's sign-in
  async doors() {
    let rn = this.live('remilia');
    if (!rn) {
      const access = await remiliaToken().catch(() => null);
      if (access) { const r = await call('/remilia', { method: 'POST', body: { access_token: access } }); if (r.ok && r.data.token) { write(DOORS.remilia, r.data); rn = r.data; } }
    }
    return [this.live('wallet'), rn].filter(Boolean);
  }
  label(t) { return String(t.address).startsWith('rn:') ? '@' + (t.handle || t.address.slice(3)) : `${t.address.slice(0, 6)}…${t.address.slice(-4)}`; }

  // read the account's copy, fold it into this device's, write the result back
  async sync() {
    if (this.busy) return; this.busy = true;
    try {
      const tokens = await this.doors();
      if (!tokens.length) { this.ready = false; this.tokens = []; this.say('device', 'progress is kept on this device only'); return; }
      let merged = this.local(); const m = this.meta(), open = [];
      for (const t of tokens) {
        const got = await call('/maze', { token: t.token });
        if (got.status === 401) { try { localStorage.removeItem(DOORS[String(t.address).startsWith('rn:') ? 'remilia' : 'wallet']); } catch { /* storage blocked */ } continue; }
        if (got.status !== 200 && !(got.status === 404 && got.data && got.data.error === 'nothing saved yet')) { this.say('device', 'saves could not be reached · progress is kept on this device'); return; }
        if (got.status === 200 && got.data.save) merged = this.merge(merged, got.data.save, !m.owners.includes(t.address));
        open.push(t);
      }
      if (!open.length) { this.ready = false; this.say('device', 'that sign-in has lapsed · progress is kept on this device only'); return; }
      this.keep(merged); this.base = merged;
      const mm = this.meta(); for (const t of open) if (!mm.owners.includes(t.address)) mm.owners.push(t.address); write(META, mm);
      this.tokens = open; this.ready = true; if (this.o.onDoors) this.o.onDoors();
      await this.push(true);
    } catch { this.say('device', 'saves could not be reached · progress is kept on this device'); }
    finally { this.busy = false; }
  }
  // Is this device still joined to the account it read from? If its storage was emptied since (site data cleared,
  // another tab signed out), what it holds is no longer that account's walk, and sending it up would put an empty
  // device over a good save. Then nothing is sent until the next read.
  joined() { const o = this.meta().owners; return this.ready && this.tokens.length > 0 && this.tokens.every(t => o.includes(t.address)); }
  // what goes up: this device's copy, with everything that only grows folded in from what the account was last known
  // to hold, so no send can ever take a record, a bug or a find away
  snapshot() { const l = this.local(); return this.base ? this.merge(l, Object.assign({}, this.base, { satchel: { t: -1 }, book: Object.assign({}, this.base.book, { quill: null, t: -1 }) }), false) : l; }
  async push(force) {
    if (!this.joined()) return false;
    const snap = this.snapshot(), body = JSON.stringify(snap);
    if (!force && body === this.pushed) return true;
    let ok = true;
    for (const t of this.tokens) { const r = await call('/maze', { method: 'PUT', token: t.token, body: snap }).catch(() => ({ ok: false })); ok = ok && r.ok; }
    if (ok) { this.pushed = body; this.base = snap; this.say('saved', `progress saved to ${this.tokens.map(t => this.label(t)).join(' and ')}`); }
    else this.say('saved', 'the last save did not go through · it will be tried again');
    return ok;
  }
  // something worth keeping just happened: send it up in a moment
  touch() { clearTimeout(this.soon); this.soon = setTimeout(() => this.push(false), 2500); }

  start() {
    this.sync();
    addEventListener('moss-maze-kept', () => this.touch());      // the satchel or the journal was just written to this device
    setInterval(() => { if (!document.hidden) this.push(false); }, 45000);
    addEventListener('pagehide', () => {
      if (!this.joined()) return;
      const body = JSON.stringify(this.snapshot()); if (body === this.pushed) return;
      // a closing page cannot set a header, so the session rides in the address (the site's /save takes it either way)
      for (const t of this.tokens) if (navigator.sendBeacon) navigator.sendBeacon(`/save/maze?t=${encodeURIComponent(t.token)}`, new Blob([body], { type: 'application/json' }));
    });
  }
}
