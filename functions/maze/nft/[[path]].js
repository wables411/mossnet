// The gallery's eyes: which pictures hang in a visitor's gallery in Lost in the Moss, and the pictures themselves.
//
//   GET /maze/nft/list?owner=0x..[,0x..][&moss=1]  -> { items: [{ c, set, id, img }], pending: [set keys], owners }
//   GET /maze/nft/img?c=<set>&id=<token id>        -> the token's picture (raster only), cached hard
//
// Ownership is read from the chains themselves, with no indexer and no key: balanceOf says which sets a wallet
// holds anything in; Milady Maker lists a wallet's tokens itself; the others do not, so each of those sets has its
// owners read once (ownerOf for every token, 400 to a call through Multicall3) and kept for an hour. A Pages
// Function may make about fifty requests of its own, so at most one set is read per call: a list that is not
// whole yet says which sets are `pending`, and the game asks again.
//
// The pictures come through here so the game's content policy can stay closed (nothing fetched from anywhere but
// this site) and so they can be drawn into the 3D scene, which a picture from another site without permission
// headers cannot be. This is not an open relay: only a known set and a token number are taken, and the address the
// picture lives at is read from that token's own metadata.
//
// Needs the SAVES KV (shared with the saves and the notes board). Cloudflare Pages Function, behind /maze/'s door.

const ETH_RPCS = ['https://ethereum-rpc.publicnode.com', 'https://1rpc.io/eth'];
const RH_RPC = 'https://rpc.mainnet.chain.robinhood.com';
const MULTICALL = '0xcA11bde05977b3631167028862bE2a173976CA11';
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const IPFS = ['https://gateway.pinata.cloud/ipfs/', 'https://ipfs.io/ipfs/'];      // tried in turn: gateways come and go, and some refuse some content

// Remilia's own collections and the ones grown around them (each checked on chain: name() and ownerOf answer)
const SETS = {
  milady: { name: 'Milady Maker', chain: 'eth', addr: '0x5Af0D9827E0c53E4799BB226655A1de152A425a5', enumerable: true },
  remilio: { name: 'Redacted Remilio Babies', chain: 'eth', addr: '0xD3D9ddd0CF0A5F0BFB8f7fcEAe075DF687eAEBaB', hi: 10000 },
  radbro: { name: 'Radbro Webring', chain: 'eth', addr: '0xE83C9F09B0992e4a34fAf125ed4FEdD3407c4a23', hi: 4399 },
  schizo: { name: 'SchizoPosters', chain: 'eth', addr: '0xBfE47D6D4090940D1c7a0066B63d23875E3e2Ac5', hi: 5599 },
  pixelady: { name: 'Pixelady Maker', chain: 'eth', addr: '0x8Fc0D90f2C45a5e7f94904075c952e0943CFCCfd', hi: 10000 },
  bonkler: { name: 'Bonkler', chain: 'eth', addr: '0xABFaE8A54e6817F57F9De7796044E9a60e61ad67', hi: 399 },
  yayo: { name: 'YAYO', chain: 'eth', addr: '0x09f66a094a0070EBDdeFA192a33fa5d75b59D46b', hi: 2799 },
  // the site's own: shown only when the visitor asks for their moss too. Their pictures are files on this site.
  mossnet: { name: 'Moss:Net', chain: 'rh', moss: true, addr: '0x15f499841Df89F34529Ca41eB30271cAdDEee573', lo: 1, hi: 100, local: '/assets/mossnet-large/{id}.webp' },
  sancigawa: { name: 'sancigawa', chain: 'rh', moss: true, addr: '0x2E557707df4a8b07457D69fA91EFc62DeB50CB59', lo: 1, hi: 100, local: '/assets/sancigawa-large/{id}.webp' },
  mossawrettes: { name: 'Mossawrettes', chain: 'eth', moss: true, small: true, addr: '0x71f7bedf8572b75e446766906079dcf05a386737', lo: 0, hi: 30, local: '/assets/mossawrettes-large/{id}.webp' },
  kudzuwrettes: { name: 'Kudzuwrettes', chain: 'eth', moss: true, small: true, addr: '0xbb14b3142bf04014c99c478b44581cd0fc1d5747', lo: 0, hi: 30, metaFile: '/assets/kudzuwrettes-meta.json' },
};

const json = (body, status = 200, cache = 'no-store') => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': cache } });
const pad = (h, n = 64) => String(h).replace(/^0x/, '').padStart(n, '0');
const SEL = { ownerOf: '6352211e', balanceOf: '70a08231', tokenOfOwnerByIndex: '2f745c59', tokenURI: 'c87b56dd', aggregate3: '82ad56cb' };

async function rpc(chain, body) {
  const urls = chain === 'rh' ? [RH_RPC] : ETH_RPCS;
  let last = 'no answer';
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'Mozilla/5.0 (compatible; mossquest/1.0)' }, body: JSON.stringify(body), signal: AbortSignal.timeout(9000) });
      if (!res.ok) { last = `upstream ${res.status}`; continue; }
      const out = await res.json();
      if (Array.isArray(body) ? Array.isArray(out) : out && !out.error) return out;
      last = 'upstream refused';
    } catch (e) { last = String(e && e.message || e); }
  }
  throw new Error(last);
}
const call = (to, data, id = 0) => ({ jsonrpc: '2.0', id, method: 'eth_call', params: [{ to, data: '0x' + data }, 'latest'] });
// many calls in one request; answers back in the order asked, null where one failed
async function batch(chain, calls) {
  if (!calls.length) return [];
  const out = await rpc(chain, calls.map((c, i) => ({ ...c, id: i })));
  const res = new Array(calls.length).fill(null);
  for (const x of out) if (x && !x.error && typeof x.result === 'string' && x.result.length > 2) res[x.id] = x.result;
  return res;
}
const asAddress = hex => (hex && hex.length >= 66 ? '0x' + hex.slice(26, 66).toLowerCase() : null);
const asNumber = hex => { try { return Number(BigInt(hex)); } catch { return 0; } };
function asString(hex) {
  try {
    const b = hex.slice(2), len = parseInt(b.slice(64, 128), 16), bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = parseInt(b.slice(128 + i * 2, 130 + i * 2), 16);
    return new TextDecoder().decode(bytes);
  } catch { return ''; }
}

// Multicall3.aggregate3 of ownerOf(id) for a run of ids: one eth_call, an owner (or null) per id
function ownersCall(target, ids) {
  let head = '', tail = '', off = ids.length * 32;
  for (const id of ids) {
    head += pad(off.toString(16));
    const el = pad(target) + pad('1') + pad('60') + pad('24') + (SEL.ownerOf + pad(id.toString(16))).padEnd(128, '0');
    tail += el; off += el.length / 2;
  }
  return SEL.aggregate3 + pad('20') + pad(ids.length.toString(16)) + head + tail;
}
function ownersRead(hex, n) {
  const b = hex.slice(2), out = [], start = 128;
  for (let i = 0; i < n; i++) {
    const off = parseInt(b.slice(128 + i * 64, 192 + i * 64), 16) * 2 + start;
    const ok = parseInt(b.slice(off, off + 64), 16) === 1, d = parseInt(b.slice(off + 64, off + 128), 16) * 2 + off, len = parseInt(b.slice(d, d + 64), 16);
    out.push(ok && len >= 32 ? '0x' + b.slice(d + 64 + 24, d + 128).toLowerCase() : null);
  }
  return out;
}

// every owner of a set that cannot list a wallet's tokens itself: { owner: [ids] }, kept an hour
async function ownersOf(env, key, allowBuild) {
  const S = SETS[key], kv = `nftowners:v1:${key}`;
  const kept = await env.SAVES.get(kv, 'json');
  if (kept) return { map: kept, fresh: false };
  if (!allowBuild) return null;
  const lo = S.lo || 0, hi = S.hi, map = {};
  if (S.chain === 'rh' || S.small) {
    // few enough to ask for one by one in a single request
    const ids = []; for (let id = lo; id <= hi; id++) ids.push(id);
    const res = await batch(S.chain, ids.map(id => call(S.addr, SEL.ownerOf + pad(id.toString(16)))));
    res.forEach((r, i) => { const o = asAddress(r); if (o) (map[o] = map[o] || []).push(ids[i]); });
  } else {
    const CH = 400, jobs = [];
    for (let s = lo; s <= hi; s += CH) { const ids = []; for (let id = s; id <= Math.min(hi, s + CH - 1); id++) ids.push(id); jobs.push(ids); }
    // six at a time: quick, and gentle on a free RPC
    for (let i = 0; i < jobs.length; i += 6) {
      const part = await Promise.all(jobs.slice(i, i + 6).map(async ids => { const r = await rpc('eth', call(MULTICALL, ownersCall(S.addr, ids))); return ownersRead(r.result, ids.length); }));
      part.forEach((owners, k) => owners.forEach((o, j) => { if (o) (map[o] = map[o] || []).push(jobs[i + k][j]); }));
    }
  }
  await env.SAVES.put(kv, JSON.stringify(map), { expirationTtl: 3600 });
  return { map, fresh: true };
}

async function list(env, url) {
  const owners = [...new Set((url.searchParams.get('owner') || '').split(',').map(s => s.trim().toLowerCase()).filter(s => ADDRESS.test(s)))].slice(0, 4);
  if (!owners.length) return json({ error: 'an address, please' }, 400);
  const moss = url.searchParams.get('moss') === '1';
  const ck = `nftlist:v1:${owners.join('+')}:${moss ? 1 : 0}`;
  const kept = await env.SAVES.get(ck, 'json');
  if (kept) return json(kept);

  const keys = Object.keys(SETS).filter(k => moss || !SETS[k].moss);
  const items = [], pending = [], unread = [];      // unread: sets whose chain did not answer (said, not hidden)
  // requests left for reading whole sets this call (a Function may make about fifty)
  let budget = 38;
  const cost = k => (SETS[k].chain === 'rh' || SETS[k].small ? 1 : Math.ceil(((SETS[k].hi || 0) - (SETS[k].lo || 0) + 1) / 400));
  for (const owner of owners) {
    // what does this wallet hold anything in? (one request per chain)
    const held = {};
    for (const chain of ['eth', 'rh']) {
      const ks = keys.filter(k => SETS[k].chain === chain); if (!ks.length) continue;
      const res = await batch(chain, ks.map(k => call(SETS[k].addr, SEL.balanceOf + pad(owner)))).catch(() => null);
      if (!res) { for (const k of ks) if (!unread.includes(SETS[k].name)) unread.push(SETS[k].name); continue; }
      ks.forEach((k, i) => { held[k] = res[i] ? asNumber(res[i]) : 0; });
    }
    for (const k of keys) {
      if (!held[k]) continue;
      const S = SETS[k];
      let ids = [];
      if (S.enumerable) {
        const n = Math.min(held[k], 300);
        const res = await batch('eth', Array.from({ length: n }, (_, i) => call(S.addr, SEL.tokenOfOwnerByIndex + pad(owner) + pad(i.toString(16)))));
        ids = res.filter(Boolean).map(asNumber);
      } else {
        const got = await ownersOf(env, k, budget >= cost(k)).catch(() => null);
        if (!got) { if (!pending.includes(k)) pending.push(k); continue; }
        if (got.fresh) budget -= cost(k);      // read from the chain this call: what does not fit waits for the next call
        ids = got.map[owner] || [];
      }
      for (const id of ids.sort((a, b) => a - b)) if (!items.some(x => x.c === k && x.id === id)) items.push({ c: k, set: S.name, id, moss: !!S.moss, img: S.local ? S.local.replace('{id}', id) : `nft/img?c=${k}&id=${id}` });
    }
  }
  const body = { owners, items, pending, unread };
  if (!pending.length && !unread.length) await env.SAVES.put(ck, JSON.stringify(body), { expirationTtl: 600 });
  return json(body);
}

// the web addresses a metadata address may be fetched from: itself if it is https, each gateway in turn if it is ipfs
const web = u => { u = String(u || ''); if (u.startsWith('ipfs://')) return IPFS.map(g => g + u.slice(7).replace(/^ipfs\//, '')); return /^https:\/\//.test(u) ? [u] : []; };
async function get(u, accept, ms) {
  let last = null;
  for (const at of web(u)) { try { const res = await fetch(at, { headers: { accept, 'user-agent': 'Mozilla/5.0 (compatible; mossquest/1.0)' }, signal: AbortSignal.timeout(ms) }); if (res.ok) return res; last = res; } catch { /* the next one */ } }
  return last;
}

async function picture(env, url, request, ctx) {
  const k = url.searchParams.get('c'), id = url.searchParams.get('id');
  const S = SETS[k];
  if (!S || !/^\d{1,6}$/.test(id || '') || S.local) return json({ error: 'no such picture' }, 404);
  const cache = caches.default, ckey = new Request(new URL(`/maze/nft/img?c=${k}&id=${id}`, url).toString());
  const hit = await cache.match(ckey);
  if (hit) return hit;

  // where the picture lives: the token's own metadata says
  const mk = `nftmeta:v1:${k}:${id}`;
  let meta = await env.SAVES.get(mk, 'json');
  if (!meta) {
    let image = '', name = '';
    if (S.metaFile) {
      const all = await (await env.ASSETS.fetch(new URL(S.metaFile, url))).json().catch(() => null);
      const m = all && (all[id] || (Array.isArray(all) ? all.find(x => String(x.tokenId ?? x.id) === id) : null));
      if (m) { image = m.image || m.image_url || ''; name = m.name || ''; }
    } else {
      const r = await rpc(S.chain, call(S.addr, SEL.tokenURI + pad(Number(id).toString(16))));
      const uri = asString(r.result);
      let m = null;
      if (uri.startsWith('data:application/json')) { const c = uri.slice(uri.indexOf(',') + 1); m = JSON.parse(uri.includes(';base64') ? atob(c) : decodeURIComponent(c)); }
      else { const res = await get(uri, 'application/json', 8000); if (res && res.ok) m = await res.json().catch(() => null); }
      if (m) { image = m.image || m.image_url || ''; name = m.name || ''; }
    }
    if (!web(image).length) return json({ error: 'that token has no picture this can show' }, 404);
    meta = { image, name };
    await env.SAVES.put(mk, JSON.stringify(meta), { expirationTtl: 60 * 60 * 24 * 30 });
  }
  const res = await get(meta.image, 'image/*', 15000);
  const type = ((res && res.headers.get('content-type')) || '').split(';')[0].trim().toLowerCase();
  if (!res || !res.ok || !/^image\/(png|jpeg|gif|webp|avif)$/.test(type)) return json({ error: 'the picture could not be fetched' }, 502);
  if (Number(res.headers.get('content-length') || 0) > 16 * 1024 * 1024) return json({ error: 'that picture is too large' }, 413);
  const out = new Response(res.body, { status: 200, headers: { 'content-type': type, 'cache-control': 'public, max-age=2592000, immutable', 'x-content-type-options': 'nosniff', 'x-nft-name': encodeURIComponent(meta.name || '').slice(0, 200) } });
  ctx.waitUntil(cache.put(ckey, out.clone()));
  return out;
}

export async function onRequestGet(ctx) {
  const { request, env, params } = ctx;
  if (!env.SAVES) return json({ error: 'the gallery is not set up on this deployment (no KV binding)' }, 503);
  const route = Array.isArray(params.path) ? params.path.join('/') : (params.path || '');
  const url = new URL(request.url);
  try {
    if (route === 'list') return await list(env, url);
    if (route === 'img') return await picture(env, url, request, ctx);
    return json({ error: 'no such route' }, 404);
  } catch (e) { return json({ error: String(e && e.message || e) }, 502); }
}
