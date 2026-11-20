// The handheld: the MQ-01 from the site's front page (mq01.js), its screen showing RemiliaNET's global chat. The
// screen is a canvas drawn as the site draws its LCD (pale green, dark green type, Jersey 10, the status line at
// the foot; hands.js lays it over the device's screen); the chat is the real one, read
// and written through RemiliaNET's API with the sign-in the site already holds for this browser tab.
//
// What it needs to work: the player signed in to RemiliaNET on mossmossmoss.quest in this tab, and the site's
// RemiliaNET application granted the chat permissions (remilia:chat.read, remilia:chat.write). Without either it
// says so on the screen and does nothing else. ?chat=demo fills it with a made-up feed kept in memory, to try the
// device itself without any of that.
import * as THREE from '../lib/three.module.js?v=88cddb5c';

const API = 'https://www.remilia.net/api/v1';
const TOKEN = 'https://www.remilia.net/oidc/realms/remilia/protocol/openid-connect/token';
const CLIENT = 'tpa-mossquest';
const W = 344, H = 316;   // the MQ-01's screen, four pixels to its unit (mq01.js)
const store = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } } };

// the screen's pages, in the order TAB goes through them
const PAGES = ['chat', 'profile', 'beetle', 'cheese'];
const TITLE = { chat: 'GLOBAL CHAT', profile: 'PROFILE', beetle: 'BEETLE', cheese: 'MOSS QUEST' };
// what the pages show with ?chat=demo, so the device can be tried with no sign-in
const DEMO_PAGES = {
  profile: [['', '@moss'], ['name', 'moss'], ['friends', '128'], ['achievements', '31'], ['cult tier', '3'], ['remilia nfts', '12'], ['', ''], ['', 'demo: not a real profile']],
  beetle: [['level', '14'], ['xp', '9,420'], ['cards held', '7'], ['', ''], ['', 'demo: not a real beetle']],
};
const DEMO = [['moss', 'gm from the maze'], ['schizo_grey', 'which way is out'], ['radcat', 'left. always left'], ['moss', 'demo feed: not the real chat']];

// the site's RemiliaNET sign-in held by this browser tab, renewed if it has run out; null when there is none
export async function remiliaToken() {
  const t = store.get('remilia-access'); if (!t) return null;
  if (Date.now() < Number(store.get('remilia-expires') || 0) - 15000) return t;
  const r = store.get('remilia-refresh'); if (!r) return null;
  try {
    const res = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: r, client_id: CLIENT }) });
    if (!res.ok) {
      // invalid_grant: the sign-in is over, forget it. Anything else is a passing fault: keep the sign-in and try again later
      const e = await res.json().catch(() => null);
      if (e && e.error === 'invalid_grant') ['remilia-access', 'remilia-refresh', 'remilia-expires'].forEach(k => store.set(k, ''));
      return null;
    }
    const p = await res.json();
    store.set('remilia-access', p.access_token); if (p.refresh_token) store.set('remilia-refresh', p.refresh_token); store.set('remilia-expires', String(Date.now() + (p.expires_in || 300) * 1000));
    return p.access_token;
  } catch { return null; }
}

export class Handheld {
  constructor({ demo = false, input, onSay } = {}) {
    this.demo = demo; this.input = input; this.onSay = onSay;
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.magFilter = THREE.LinearFilter; this.texture.minFilter = THREE.LinearFilter; this.texture.generateMipmaps = false;
    this.messages = demo ? DEMO.map(([who, text], i) => ({ id: i, who, text })) : [];
    this.status = demo ? '' : 'connecting';
    this.page = 'chat'; this.rows = {}; this.loading = {}; this.scroll = 0;
    this.out = false; this.typing = false; this.timer = 0; this.blink = 0; this.note = ''; this.noteT = 0; this.sending = false;
    if (input) {
      input.addEventListener('input', () => { this.draw(); if (this.onKey) this.onKey(); });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); this.send(); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.type(false); }
        else if (e.key === 'Tab') { e.preventDefault(); this.type(false); if (this.onTab) this.onTab(e.shiftKey ? -1 : 1); }   // tab leaves the writing and turns the page
      });
      input.addEventListener('blur', () => { if (this.typing) this.type(false, true); });
    }
    if (document.fonts && document.fonts.load) document.fonts.ready.then(() => this.draw(), () => {}); setTimeout(() => this.draw(), 1500);
    this.draw();
  }

  // taken out / put away
  show(on) {
    this.out = on;
    if (on) { this.timer = 0; if (this.page === 'chat') this.refresh(); else this.loadPage(this.page); } else this.type(false);
    this.draw();
  }
  // TAB: the next page. Each page is read when it is turned to, and again each time it comes round
  nextPage(dir = 1) {
    if (this.typing) this.type(false);
    this.page = PAGES[(PAGES.indexOf(this.page) + (dir < 0 ? -1 : 1) + PAGES.length) % PAGES.length]; this.scroll = 0;
    if (this.page === 'chat') this.refresh(); else this.loadPage(this.page);
    this.draw();
    return this.page;
  }
  async api(path) {
    const t = await this.token(); if (!t) return { status: 'signedout' };
    try {
      const res = await fetch(API + path, { credentials: 'omit', headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' } });
      if (res.status === 401) return { status: 'signedout' };
      if (res.status === 403) return { status: 'noscope' };
      if (!res.ok) return { status: 'down' };
      return { data: await res.json() };
    } catch { return { status: 'down' }; }
  }
  // a page's rows: [label, value] pairs, or one line of why there are none
  async loadPage(page) {
    if (this.loading[page]) return;
    const num = v => Number(v).toLocaleString();
    if (page === 'cheese') {
      // Moss Quest's own save, kept by the site in this browser: the cheese, the beetles caught, the mosses collected
      let sv = null; const handle = store.get('remilia-handle');
      for (const k of [handle && 'mossquest.save.' + handle, 'mossquest.save.guest', 'mossquest.save']) { if (!k || sv) continue; try { sv = JSON.parse(localStorage.getItem(k) || 'null'); } catch { /* not a save */ } }
      this.rows.cheese = sv ? [['', sv.name ? String(sv.name) : handle ? '@' + handle : 'guest'], ['cheese', num(sv.cheese || 0)], ['beetles caught', num(Object.values(sv.beetles || {}).reduce((a, b) => a + (Number(b) || 0), 0))], ['kinds of beetle', num(Object.keys(sv.beetles || {}).length)], ['mosses collected', num(Object.keys(sv.collected || {}).length)], ['mosses seen', num(Object.keys(sv.seen || {}).length)], ['steps', num(sv.steps || 0)]]
        : [['', 'no Moss Quest save in this browser yet.'], ['', ''], ['', 'play Moss Quest on the home page and it shows here.']];
      this.draw(); return;
    }
    if (this.demo) { this.rows[page] = DEMO_PAGES[page]; this.draw(); return; }
    this.loading[page] = true; if (!this.rows[page]) this.rows[page] = [['', 'reading...']]; this.draw();
    const why = st => [['', st === 'signedout' ? 'not signed in.' : st === 'noscope' ? 'no permission for this yet.' : 'no signal.'], ['', ''], ['', st === 'signedout' ? 'sign in to RemiliaNET at mossmossmoss.quest in this tab, then come back to the maze.' : '']];
    try {
      if (page === 'profile') {
        const me = await this.api('/me');
        if (me.status) { this.rows.profile = why(me.status); return; }
        const u = me.data.user || me.data, rows = [['', '@' + (u.username || '?')]];
        if (u.displayName) rows.push(['name', String(u.displayName)]);
        if (u.location) rows.push(['where', String(u.location)]);
        if (u.friendCount != null) rows.push(['friends', num(u.friendCount)]);
        if (u.achievementsCount != null) rows.push(['achievements', num(u.achievementsCount)]);
        const st = await this.api('/me/stats');
        if (st.data) {
          // what /me/stats holds today: stats.profiles (pokes, page views), and a score per part of RemiliaNET. No wallet or NFT counts
          const d = st.data.data || st.data, pr = (d.stats && d.stats.profiles) || {};
          if (pr.pokes_received != null) rows.push(['pokes received', num(pr.pokes_received)]);
          if (pr.total_page_views != null) rows.push(['page views', num(pr.total_page_views)]);
          Object.entries(d.aggregate_scores || {}).filter(([, v]) => typeof v === 'number' && v > 0).slice(0, 4).forEach(([k, v]) => rows.push([k.replace(/_/g, ' ') + ' score', num(v)]));
        }
        if (u.bio) rows.push(['', ''], ['', String(u.bio)]);
        this.rows.profile = rows;
      } else if (page === 'beetle') {
        const b = await this.api('/me/beetle');
        if (b.status) { this.rows.beetle = b.status === 'noscope' ? [['', 'no beetle yet, or no permission to see it.']] : why(b.status); return; }
        const d = b.data.data || b.data, rows = [];
        if (d.level != null) rows.push(['level', String(d.level)]);
        if (d.xp != null) rows.push(['xp', num(d.xp)]);
        if (d.beetle_count != null) rows.push(['beetles', num(d.beetle_count)]);
        if (d.inventory && d.inventory.cheese != null) rows.push(['cheese', num(d.inventory.cheese)]);
        if (d.cheeseShields) rows.push(['cheese shields', num(d.cheeseShields)]);
        if (d.inventory) rows.push(['trophies', num(Object.keys(d.inventory).filter(k => k.startsWith('trophy_') && d.inventory[k] > 0).length)]);
        const wait = d.cooldowns && d.cooldowns.catchBeetle;                     // milliseconds until the next catch; absent when ready
        rows.push(['next catch', wait > 0 ? Math.ceil(wait / 60000) + ' min' : 'ready']);
        const c = await this.api('/me/beetle/cards');
        if (c.data) { const cd = c.data.data || c.data, list = Array.isArray(cd) ? cd : cd.cards || cd.items || Object.values(cd || {}); if (Array.isArray(list)) rows.push(['cards held', num(list.length)]); }
        this.rows.beetle = rows.length ? rows : [['', 'no beetle yet.']];
      }
    } finally { this.loading[page] = false; this.draw(); }
  }

  // up and down the page: lines back through the chat, rows down a list
  scrollBy(n) { this.scroll = Math.max(0, this.scroll + n); this.draw(); }

  // start or stop writing a message
  type(on, blurred) {
    if (on && this.page !== 'chat') return;               // there is only something to write on the chat page
    if (on === this.typing) return;
    this.typing = on;
    if (this.input) { if (on) { this.input.value = ''; this.input.focus({ preventScroll: true }); } else if (!blurred) this.input.blur(); }
    this.draw();
    if (this.onType) this.onType(on);
  }

  async token() { return remiliaToken(); }
  read(m) {
    const a = m.author || m.user || m.sender || {};
    return { id: m.id, who: String(a.handle || a.username || a.display_name || a.displayName || m.handle || m.username || '?'), text: String(m.text ?? m.content ?? m.body ?? '') };
  }
  async refresh() {
    if (this.demo || this.busy) return;
    this.busy = true;
    try {
      const t = await this.token();
      if (!t) { this.status = 'signedout'; return; }
      const res = await fetch(`${API}/global-chat/messages?limit=20`, { credentials: 'omit', headers: { Authorization: `Bearer ${t}` } });
      if (res.status === 401) { this.status = 'signedout'; return; }
      if (res.status === 403) { this.status = (await this.why(res)) === 'insufficient_scope' ? 'noscope' : 'barred'; return; }
      if (!res.ok) { this.status = 'down'; return; }
      // the reply is { data: { messages: [...], has_more, next_cursor } }, oldest first
      const p = await res.json(), d = (p && p.data) || p || {}, list = Array.isArray(d) ? d : Array.isArray(d.messages) ? d.messages : [];
      this.messages = list.map(m => this.read(m)).filter(m => m.text);
      this.status = '';
    } catch { this.status = 'down'; }
    finally { this.busy = false; this.draw(); }
  }
  async send() {
    const text = (this.input ? this.input.value : '').trim();
    if (this.sending) return;
    if (!text) { this.type(false); if (this.onEmpty) this.onEmpty(); return; }   // enter on an empty line: done writing
    if (this.demo) { this.messages.push({ id: Date.now(), who: 'you', text }); this.input.value = ''; this.draw(); if (this.onSay) this.onSay(); return; }
    this.sending = true; this.draw();
    try {
      const t = await this.token();
      if (!t) { this.status = 'signedout'; return; }
      if (new TextEncoder().encode(text).length > 8192) { this.say('too long'); return; }
      const res = await fetch(`${API}/global-chat/messages`, { method: 'POST', credentials: 'omit', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (res.status === 201 || res.ok) {
        const p = await res.json().catch(() => null), m = p && (p.data || p);
        if (m && (m.text || m.content)) this.messages.push(this.read(m));
        this.input.value = ''; if (this.onSay) this.onSay();
      } else if (res.status === 429) this.say('too fast: one every 2 seconds');
      else if (res.status === 403) this.say((await this.why(res)) === 'insufficient_scope' ? 'this app may not post yet' : 'this account may not post');
      else if (res.status === 400 || res.status === 413) this.say('too long');
      else if (res.status === 401) this.status = 'signedout';
      else this.say('not sent');
    } catch { this.say('not sent'); }
    finally { this.sending = false; this.draw(); }
  }
  say(note) { this.note = note; this.noteT = 2.5; }
  // RemiliaNET's own word for why it said no: insufficient_scope (the app lacks the permission), forbidden (the account is muted or barred)
  async why(res) { try { const p = await res.clone().json(); return (p && p.error && p.error.code) || ''; } catch { return ''; } }

  tick(dt) {
    if (!this.out) return;
    this.timer += dt; if (this.timer > 8) { this.timer = 0; if (this.page === 'chat') this.refresh(); }
    if (this.noteT > 0) { this.noteT -= dt; if (this.noteT <= 0) { this.note = ''; this.draw(); } }
    const b = Math.floor(performance.now() / 450) % 2; if (b !== this.blink) { this.blink = b; if (this.typing) this.draw(); }
  }

  wrap(text, width) {
    const g = this.g, out = []; let line = '';
    for (const word of text.replace(/\s+/g, ' ').split(' ')) {
      let w = word;
      while (g.measureText(w).width > width) { let n = w.length; while (n > 1 && g.measureText(w.slice(0, n)).width > width) n--; if (line) { out.push(line); line = ''; } out.push(w.slice(0, n)); w = w.slice(n); }
      const t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > width) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }

  draw() {
    const g = this.g, DARK = '#1b3320', MID = '#587f3e', FACE = '"Jersey 10", "Courier New", monospace';
    g.fillStyle = '#c6d19c'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'top'; g.textAlign = 'left';
    const pad = 12, lh = 21, foot = 24, top = 30;
    // the heading, as the site's screens have one
    g.font = `15px ${FACE}`; g.fillStyle = MID; g.fillText('REMILIANET  \u00b7  ' + TITLE[this.page], pad, 9);
    // which page of how many: a row of pips at the right
    PAGES.forEach((pg, i) => { g.fillStyle = pg === this.page ? DARK : MID; g.fillRect(W - pad - (PAGES.length - i) * 9, 12, pg === this.page ? 6 : 4, pg === this.page ? 6 : 4); });
    g.fillStyle = MID; g.fillRect(pad, 25, W - pad * 2, 1);
    g.font = `21px ${FACE}`;
    const room = H - foot - top - 4, lines = [];
    const say = (text, dim) => this.wrap(text, W - pad * 2).forEach(l => lines.push([l, dim]));
    if (this.page !== 'chat') {
      // a page of rows: the label in the lighter green, its value at the right
      const all = this.rows[this.page] || [['', 'reading...']];
      this.scroll = Math.min(this.scroll, Math.max(0, all.length - 3));
      const rows = all.slice(this.scroll);
      let y = top + 2;
      for (const [label, value] of rows) {
        if (!label) { for (const l of this.wrap(String(value), W - pad * 2)) { g.fillStyle = DARK; g.fillText(l, pad, y); y += lh; } if (!value) y += 4; continue; }
        g.fillStyle = MID; g.fillText(label, pad, y);
        g.fillStyle = DARK; g.textAlign = 'right'; g.fillText(String(value), W - pad, y); g.textAlign = 'left';
        y += lh + 2;
        if (y > H - foot - lh) break;
      }
    }
    else if (this.status === 'connecting') say('connecting...', true);
    else if (this.status === 'signedout') { say('not signed in.'); say(''); say('sign in to RemiliaNET at mossmossmoss.quest in this tab, then come back to the maze.', true); }
    else if (this.status === 'barred') { say('chat is closed to this account.'); say(''); say('RemiliaNET says this account may not read global chat.', true); }
    else if (this.status === 'noscope') { say('no chat permission.'); say(''); say('this app has not been granted RemiliaNET chat yet.', true); }
    else if (this.status === 'down') say('no signal. trying again.', true);
    else for (const m of this.messages) { const ls = this.wrap(`${m.who}: ${m.text}`, W - pad * 2); ls.forEach((l, i) => lines.push([l, false, i === 0 ? m.who.length + 1 : 0])); }
    const per = Math.floor(room / lh);
    if (this.page === 'chat') this.scroll = Math.min(this.scroll, Math.max(0, lines.length - per));
    const end = this.page === 'chat' ? lines.length - this.scroll : lines.length;
    const show = lines.slice(Math.max(0, end - per), end);
    if (this.page === 'chat' && this.scroll > 0) { g.fillStyle = MID; g.fillRect(W - 6, H - foot - 14, 3, 10); }   // there is more below
    show.forEach(([l, dim, who], i) => {
      const y = top + i * lh;
      g.fillStyle = dim ? MID : DARK; g.fillText(l, pad, y);
      if (who) { g.fillStyle = MID; g.fillText(l.slice(0, who), pad, y); }
    });
    // the status line at the foot: what you are writing, or what the keys do
    g.fillStyle = DARK; g.fillRect(0, H - foot, W, 2);
    g.font = `15px ${FACE}`; g.fillStyle = DARK;
    const draft = this.input ? this.input.value : '', coarse = matchMedia('(pointer: coarse)').matches;
    let line;
    if (this.note) line = this.note;
    else if (this.sending) line = 'sending...';
    else if (this.typing && !draft) line = '> ' + (this.blink ? '_' : ' ') + (coarse ? '   send it empty to stop' : '   ENTER on an empty line: stop');
    else if (this.typing) { let t = '> ' + draft; while (g.measureText(t + '_').width > W - pad * 2 && t.length > 3) t = '> ' + t.slice(3); line = t + (this.blink ? '_' : ''); }
    else {
      // what can be done from here, said in the hands that will do it
      const canWrite = this.page === 'chat' && (!this.status || this.status === 'down');
      if (coarse) line = canWrite ? 'buttons: write  \u00b7  page  \u00b7  handheld' : 'buttons: page  \u00b7  handheld puts it away';
      else line = canWrite ? 'ENTER: write  \u00b7  Q E: page  \u00b7  T: away' : 'Q E: page  \u00b7  WHEEL: scroll  \u00b7  T: away';
    }
    g.fillText(line, pad, H - foot + 6);
    // the LCD's grid of pixels
    g.fillStyle = 'rgba(0,0,0,0.07)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    g.fillStyle = 'rgba(0,0,0,0.045)'; for (let x = 0; x < W; x += 3) g.fillRect(x, 0, 1, H);
    this.texture.needsUpdate = true;
  }
}
