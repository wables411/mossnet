import { createBackground } from './bg.js?v=bbedd670';

// ===================== moss quest — the handheld =====================
// Everything on the site happens on the device screen. The d-pad, A and B
// buttons, keyboard and mouse all drive one focus cursor per view.

const lcd = document.getElementById('lcd');
const APPKIT_BUNDLE = 'appkit.bundle.js?v=9c168907';
const lcdStatus = document.getElementById('lcd-status');
const views = {
  help: document.getElementById('view-help'),
  remilia: document.getElementById('view-remilia'),
  title: document.getElementById('view-title'),
  home: document.getElementById('view-home'),
  gallery: document.getElementById('view-gallery'),
  item: document.getElementById('view-item'),
  info: document.getElementById('view-info'),
  video: document.getElementById('view-video'),
  chart: document.getElementById('view-chart'),
  moss: document.getElementById('view-moss'),
  quest: document.getElementById('view-quest')
};
const galleryGrid = document.getElementById('gallery-grid');
const galleryMsg = document.getElementById('gallery-msg');
const galleryConnect = document.getElementById('gallery-connect');
const galleryConnectBtn = document.getElementById('gallery-connect-btn');
const itemImage = document.getElementById('item-image');
const itemName = document.getElementById('item-name');
const itemLinks = document.getElementById('item-links');
const itemCount = document.getElementById('item-count');
const itemStage = document.getElementById('item-stage');
const itemGreen = document.getElementById('item-green');
const infoTitle = document.getElementById('info-title');
const infoDesc = document.getElementById('info-desc');
const infoFields = document.getElementById('info-fields');
const beetleVideo = document.getElementById('beetle-video');
const chartFrame = document.getElementById('chart-frame');
const soundToggle = document.getElementById('btn-y');
const guts = document.querySelector('.guts');
const ETHERSCAN = 'https://etherscan.io';

const CHAINS = {
  ethereum: { name: 'Ethereum mainnet', rpcs: ['https://ethereum-rpc.publicnode.com', 'https://1rpc.io/eth'] },
  // Robinhood's public RPC is rate-limited but allows browser CORS and JSON-RPC batches
  // Robinhood's public RPC sometimes sends two Access-Control-Allow-Origin
  // headers, which browsers refuse; /rpc/robinhood is our own same-origin
  // proxy to it (functions/rpc/robinhood.js). Direct is kept as a fallback.
  // Only our own origin: the chain's public RPC sometimes sends a duplicate
  // Access-Control-Allow-Origin header that browsers reject outright, so
  // falling back to it here could never succeed. /rpc/robinhood does that
  // fallback server-side instead (functions/rpc/robinhood.js).
  robinhood: { name: 'Robinhood Chain', rpcs: ['/rpc/robinhood'] },
  solana: { name: 'Solana', rpcs: ['/rpc/solana'], solana: true }
};

// Each collection: on-chain address + chain, local thumbs/large copies, and where its links go.
// Moss:Net's metadata is bundled (assets/mossnet-meta.json) because Scatter's tokenURI has no CORS.
const COLLECTIONS = {
  sancigawa: {
    key: 'sancigawa',
    name: 'sancigawa',
    plural: 'sancigawa paintings',
    address: '0x2E557707df4a8b07457D69fA91EFc62DeB50CB59',
    chain: CHAINS.robinhood,
    description: '100 paintings of 100 memories of adventures with friends. some adventures on the way to moss, some with moss, some with friends we made along the way. created with the help of @stationthisbot and cigbot.meme. 30% of painting proceeds dedicated to the moss preservation foundation. rip pappachaga.',
    firstTokenId: 1,
    thumbnails: 'assets/sancigawa-thumbs/{id}.webp',
    large: 'assets/sancigawa-large/{id}.webp',
    metadataFile: 'assets/sancigawa-meta.json',
    site: 'https://www.scatter.art/c/sancigawa-rh',
    promo: 'https://x.com/mossmossmoss420/status/2097558778811908138?s=20',
    links: (token) => [
      ['Scatter', 'https://www.scatter.art/c/sancigawa-rh', 'sancigawa on scatter.art'],
      ['Explorer', `https://robinhoodchain.blockscout.com/token/0x2E557707df4a8b07457D69fA91EFc62DeB50CB59/instance/${token.tokenId}`, 'token on Robinhood Chain explorer'],
      ['Original', token.image, 'full-size original, 1500px']
    ]
  },
  mossnet: {
    key: 'mossnet',
    name: 'Moss:Net',
    plural: 'Moss:Net entries',
    address: '0x15f499841Df89F34529Ca41eB30271cAdDEee573',
    chain: CHAINS.robinhood,
    description: 'MossNet: Comprehensive Field Research Journal Entries by MossHunter420 of Winnsboro Feint Garden Bold division. Artifacts collected during the great Moss Expedition of May 2024.',
    firstTokenId: 1,
    thumbnails: 'assets/mossnet-thumbs/{id}.webp',
    large: 'assets/mossnet-large/{id}.webp',
    metadataFile: 'assets/mossnet-meta.json',
    site: 'https://www.scatter.art/c/moss-net',
    promo: 'https://x.com/CigNetHR/status/1810410454411534584?s=20',
    links: (token) => [
      ['Scatter', 'https://www.scatter.art/c/moss-net', 'Moss:Net on scatter.art'],
      ['Explorer', `https://robinhoodchain.blockscout.com/token/0x15f499841Df89F34529Ca41eB30271cAdDEee573/instance/${token.tokenId}`, 'token on Robinhood Chain explorer'],
      ['Original', token.image, 'full-size original, 1500px']
    ]
  },
  hashstanza: {
    key: 'hashstanza',
    name: 'Hashstanza',
    plural: 'Hashstanzas',
    // Metaplex Core collection: assets are found through the collection's
    // transaction history, then read straight from their accounts.
    address: '3i1CahhvX9tZTJFJxt3v4sA718FdXPvoreq2v1q4csUD',
    chain: CHAINS.solana,
    description: 'a collection of poems written with love by twinstar, compiled and presented by mossmossmoss420.',
    site: 'https://www.vvv.so/hashstanza',
    promo: 'https://x.com/mossmossmoss420/status/2005739979251802376?s=20',
    links: (token) => [
      ['Mint', 'https://www.vvv.so/hashstanza', 'mint a Hashstanza on vvv.so'],
      ['Solscan', `https://solscan.io/token/${token.assetId}`, 'this poem on Solscan'],
      ['Original', token.image, 'full-size original']
    ]
  },
  kudzuwrettes: {
    key: 'kudzuwrettes',
    name: 'Kudzuwrettes',
    plural: 'Kudzuwrettes',
    address: '0xbb14b3142bf04014c99c478b44581cd0fc1d5747',
    chain: CHAINS.ethereum,
    description: 'Kudzuwrettes, a small set of beautiful Kudzu swallowed cigawrette packs with lines from poet Little Tank’s last book, “Spirit of Network Earth”. From the team that brought you Guacawrettes and Mossawrettes.',
    firstTokenId: 1,
    // The metadata CID on this contract has no reachable IPFS provider left,
    // so the pictures come from the copies OpenSea took at mint time.
    metadataFile: 'assets/kudzuwrettes-meta.json',
    site: 'https://opensea.io/collection/kudzuwrettes',
    promo: 'https://x.com/constance_trebi/status/1780688470307938347?s=20',
    links: (token) => [
      ['OpenSea', `https://opensea.io/assets/ethereum/0xbb14b3142bf04014c99c478b44581cd0fc1d5747/${token.tokenId}`, 'listing on OpenSea'],
      ['Etherscan', `${ETHERSCAN}/nft/0xbb14b3142bf04014c99c478b44581cd0fc1d5747/${token.tokenId}`, 'token on Etherscan'],
      ['Original', token.image, 'full-size original']
    ]
  },
  mossawrettes: {
    key: 'mossawrettes',
    name: 'Mossawrettes',
    plural: 'Mossawrettes',
    address: '0x71f7bedf8572b75e446766906079dcf05a386737',
    chain: CHAINS.ethereum,
    description: 'recent studies indicate that micro exposure to moss can increase endorphin levels in the brain. 25+ cigawrettes that are simply lost in the moss.',
    firstTokenId: 1,
    // 480px thumbs for the grid, 1400px for the item screen; originals stay on IPFS as a link
    thumbnails: 'assets/mossawrettes-thumbs/{id}.webp',
    large: 'assets/mossawrettes-large/{id}.webp',
    site: 'https://www.scatter.art/c/mossawrettes',
    promo: 'https://x.com/vate_4hl/status/1781034745083662772?s=20',
    links: (token) => [
      ['OpenSea', `https://opensea.io/assets/ethereum/0x71f7bedf8572b75e446766906079dcf05a386737/${token.tokenId}`, 'listing on OpenSea'],
      ['Etherscan', `${ETHERSCAN}/nft/0x71f7bedf8572b75e446766906079dcf05a386737/${token.tokenId}`, 'token on Etherscan'],
      ['IPFS', token.image ? ipfsToHttp(token.image, IPFS_GATEWAYS.length - 1) : null, 'full-size original, 9-12MB']
    ]
  }
};
let collection = COLLECTIONS.sancigawa;

// Read-only Ethereum mainnet RPCs, tried in order (all allow browser CORS + JSON-RPC batches)
const ETH_BATCH_SIZE = 50;

// IPFS gateways, tried in order (ipfs.io / dweb.link now rate-limit, cloudflare-ipfs is gone)
const IPFS_GATEWAYS = [
  'https://ipfs.filebase.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/'
];
const IPFS_FETCH_TIMEOUT_MS = 12000;

// ERC-721 function selectors
const ERC721 = {
  totalSupply: '0x18160ddd',
  ownerOf: '0x6352211e',
  tokenURI: '0xc87b56dd'
};


// Pinata's gateway resizes on request, which turns a 22MB original into a
// few tens of kilobytes. Only it understands these parameters, so leave any
// other host's URL alone.
function sized(url, width) {
  if (!url) return url;
  if (/\.mypinata\.cloud\//.test(url)) {
    return `${url}${url.includes('?') ? '&' : '?'}img-width=${width}&img-format=webp`;
  }
  // OpenSea serves a resized copy from i2c; raw2 is the untouched original
  if (/raw2\.seadn\.io\//.test(url)) return `${url.replace('raw2.seadn.io', 'i2c.seadn.io')}?w=${width}`;
  return url;
}

function ipfsToHttp(uri, gatewayIndex = 0) {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) {
    const path = uri.replace('ipfs://', '').replace(/^ipfs\//, '');
    return IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length] + path;
  }
  return uri;
}

// Token metadata is immutable, so cache it in localStorage across visits
async function fetchTokenMetadata(uri) {
  const cacheKey = `nft-metadata:${uri}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (_) { /* storage unavailable */ }

  const attempts = uri.startsWith('ipfs://') ? IPFS_GATEWAYS.length : 1;
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(ipfsToHttp(uri, i), { signal: AbortSignal.timeout(IPFS_FETCH_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const metadata = await response.json();
      try { localStorage.setItem(cacheKey, JSON.stringify(metadata)); } catch (_) { /* quota */ }
      return metadata;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Metadata fetch failed');
}

function encodeUint(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

function decodeUint(hex) {
  return hex && hex !== '0x' ? Number(BigInt(hex)) : 0;
}

function decodeAddress(hex) {
  return hex && hex.length >= 66 ? '0x' + hex.slice(-40) : null;
}

function decodeString(hex) {
  if (!hex || hex.length < 130) return '';
  const data = hex.slice(2);
  const offset = parseInt(data.slice(0, 64), 16) * 2;
  const length = parseInt(data.slice(offset, offset + 64), 16) * 2;
  const bytes = data.slice(offset + 64, offset + 64 + length).match(/.{2}/g) || [];
  return new TextDecoder().decode(new Uint8Array(bytes.map(b => parseInt(b, 16))));
}

// Batched eth_call with RPC fallback. Returns result hex per call, or null where the call reverted.
async function ethCallBatch(address, calls, rpcs = CHAINS.ethereum.rpcs) {
  const results = new Array(calls.length).fill(null);
  for (let offset = 0; offset < calls.length; offset += ETH_BATCH_SIZE) {
    const chunk = calls.slice(offset, offset + ETH_BATCH_SIZE);
    const body = chunk.map((data, i) => ({
      jsonrpc: '2.0',
      id: offset + i,
      method: 'eth_call',
      params: [{ to: address, data }, 'latest']
    }));
    let done = false;
    let lastError;
    // two passes: public RPCs (Robinhood's especially) rate-limit, so a short wait often clears it
    for (const rpc of [...rpcs, ...rpcs]) {
      if (done) break;
      try {
        const response = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!Array.isArray(payload)) throw new Error(payload?.error?.message || 'Unexpected RPC response');
        payload.forEach(item => {
          if (typeof item.id === 'number' && item.result) results[item.id] = item.result;
        });
        done = true;
        break;
      } catch (error) {
        console.warn(`RPC ${rpc} failed:`, error);
        lastError = error;
        await new Promise(r => setTimeout(r, 700));
      }
    }
    if (!done) throw lastError || new Error('every RPC refused the request');
  }
  return results;
}

// Reads totalSupply, then ownerOf + tokenURI for every token id, all in one batched request
async function fetchErc721Tokens(collection) {
  const [supplyHex] = await ethCallBatch(collection.address, [ERC721.totalSupply], collection.chain.rpcs);
  const totalSupply = decodeUint(supplyHex);
  if (!totalSupply) throw new Error('Could not read the collection supply');

  const first = collection.firstTokenId ?? 1;
  const ids = Array.from({ length: totalSupply }, (_, i) => first + i);
  // a collection that ships its metadata needs no tokenURI call, which halves the reads
  const needsUri = !collection.metadataFile;
  const calls = [];
  ids.forEach(id => {
    calls.push(ERC721.ownerOf + encodeUint(id));
    if (needsUri) calls.push(ERC721.tokenURI + encodeUint(id));
  });
  const results = await ethCallBatch(collection.address, calls, collection.chain.rpcs);

  const tokens = [];
  const stride = needsUri ? 2 : 1;
  ids.forEach((id, i) => {
    const owner = decodeAddress(results[i * stride]);
    if (!owner) return; // burned or nonexistent id
    tokens.push({
      tokenId: id,
      owner,
      tokenUri: needsUri ? decodeString(results[i * stride + 1]) : null,
      name: `${collection.name} #${id}`,
      description: '',
      image: null,
      thumbnail: collection.thumbnails ? collection.thumbnails.replace('{id}', id) : null,
      large: collection.large ? collection.large.replace('{id}', id) : null,
      metadata: null
    });
  });
  return tokens;
}

// ---------- Metaplex Core (Solana) ----------
// AssetV1 layout: key(1) owner(32) updateAuthority[enum(1)+pubkey(32)] name uri
const CORE_PROGRAM = 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d';
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function toBase58(bytes) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = '';
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  return '1'.repeat(zeros) + out;
}

async function solanaRpc(collection, method, params) {
  const [result] = await solanaBatch(collection, [{ method, params }]);
  if (result?.error) throw new Error(result.error.message || 'RPC error');
  return result?.result;
}

// one HTTP request carries many JSON-RPC calls
async function solanaBatch(collection, calls) {
  const response = await fetch(collection.chain.rpcs[0], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(calls.map((c, i) => ({ jsonrpc: '2.0', id: i, method: c.method, params: c.params })))
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error(payload?.error?.message || 'unexpected RPC answer');
  const byId = new Map(payload.map(p => [p.id, p]));
  return calls.map((_, i) => byId.get(i));
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// Core assets cannot be listed cheaply: getProgramAccounts scans the whole
// program, which a small plan refuses on cost and the public RPC throttles.
// The collection's own transaction history is an indexed lookup, and every
// mint transaction names the asset it created, so we read the history and
// then load those accounts directly.
async function discoverCoreAssets(collection) {
  const signatures = await solanaRpc(collection, 'getSignaturesForAddress', [collection.address, { limit: 1000 }]);
  const sigs = (signatures || []).filter(s => !s.err).map(s => s.signature);
  if (!sigs.length) return [];

  const candidates = new Set();
  for (const group of chunk(sigs, 25)) {
    const results = await solanaBatch(collection, group.map(signature => ({
      method: 'getTransaction',
      params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
    })));
    results.forEach(entry => {
      const tx = entry?.result;
      if (!tx) return;
      const logs = tx.meta?.logMessages || [];
      if (!logs.some(l => l.includes('Instruction: Create'))) return; // only mints
      (tx.transaction?.message?.accountKeys || []).forEach(key => {
        const address = typeof key === 'string' ? key : key.pubkey;
        const isNewAccount = typeof key === 'object' && key.signer && key.writable;
        if (isNewAccount && address !== collection.address) candidates.add(address);
      });
    });
  }
  return [...candidates];
}

async function fetchCoreTokens(collection) {
  const candidates = await discoverCoreAssets(collection);
  if (!candidates.length) return [];

  const readString = (bytes, offset) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const len = view.getUint32(offset, true);
    return [new TextDecoder().decode(bytes.subarray(offset + 4, offset + 4 + len)), offset + 4 + len];
  };

  const tokens = [];
  for (const group of chunk(candidates, 100)) {
    const accounts = await solanaRpc(collection, 'getMultipleAccounts', [group, { encoding: 'base64' }]);
    (accounts?.value || []).forEach((account, i) => {
      if (!account || account.owner !== CORE_PROGRAM) return;
      const bytes = Uint8Array.from(atob(account.data[0]), c => c.charCodeAt(0));
      if (bytes[0] !== 1 || bytes[33] !== 2) return;                       // AssetV1 held by a collection
      if (toBase58(bytes.subarray(34, 66)) !== collection.address) return; // and by this one
      const [name, afterName] = readString(bytes, 66);
      const [uri] = readString(bytes, afterName);
      const tail = uri.replace(/\/$/, '').split('/').pop();
      tokens.push({
        tokenId: /^\d+$/.test(tail) ? Number(tail) : group[i].slice(0, 4),
        assetId: group[i],
        owner: toBase58(bytes.subarray(1, 33)),
        tokenUri: uri,
        name,
        description: '',
        image: null,
        thumbnail: null,
        large: null,
        metadata: null
      });
    });
  }
  tokens.sort((a, b) => (typeof a.tokenId === 'number' && typeof b.tokenId === 'number' ? a.tokenId - b.tokenId : 0));
  return tokens;
}

// Bundled metadata (one JSON for the whole collection) applied in one go
const bundledMetadata = {};
async function applyBundledMetadata(collection, tokens, onUpdate) {
  if (!bundledMetadata[collection.key]) {
    const response = await fetch(collection.metadataFile);
    if (!response.ok) throw new Error(`metadata bundle HTTP ${response.status}`);
    bundledMetadata[collection.key] = await response.json();
  }
  const all = bundledMetadata[collection.key];
  tokens.forEach(token => {
    const m = all[String(token.tokenId)];
    if (!m) return;
    token.metadata = m;
    token.name = String(m.name).replace(/(\S)#(\d)/, '$1 #$2');
    token.description = m.description || '';
    token.image = m.image || null;
    onUpdate?.(token);
  });
}

// Fills in name/image from each token's metadata, a few at a time, calling onUpdate per token
async function hydrateTokenMetadata(tokens, onUpdate) {
  const queue = tokens.slice();
  const worker = async () => {
    while (queue.length) {
      const token = queue.shift();
      if (!token.tokenUri) continue;
      try {
        const metadata = await fetchTokenMetadata(token.tokenUri);
        token.metadata = metadata;
        if (metadata.name) {
          const label = String(metadata.name).replace(/(\S)#(\d)/, '$1 #$2');
          // every Hashstanza is called "hashstanza"; keep them apart by number
          token.name = /#/.test(label) ? label : `${label} #${token.tokenId}`;
        }
        if (metadata.image) token.image = metadata.image;
        if (metadata.description) token.description = metadata.description;
        onUpdate?.(token);
      } catch (error) {
        console.warn(`Metadata unavailable for token ${token.tokenId}:`, error);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
}


// Generative UI blips on a pentatonic scale. No audio files; each token id maps to its own note.
const sound = {
  ctx: null,
  scale: [0, 2, 4, 7, 9],
  enabled: (() => { try { return localStorage.getItem('nft-sound') !== 'off'; } catch (_) { return true; } })(),
  armed: false, // set by press() and by clicks on the LCD; cleared by any blip, so a silent action still gets a key click
  note(degree, octave = 0) {
    return 220 * Math.pow(2, octave + this.scale[((degree % 5) + 5) % 5] / 12);
  },
  play(freq, { duration = 0.18, gain = 0.05, delay = 0, type = 'triangle' } = {}) {
    this.armed = false;
    if (!this.enabled) return;
    if (!delay) leds.flash('audio');
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(gain, t + 0.008);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(amp).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    } catch (_) { /* no audio */ }
  },
  hover(id = 0) { this.play(this.note(id, 1 + (id % 2)), { gain: 0.02, duration: 0.1 }); },
  open(id = 0) {
    this.play(this.note(id, 1), { gain: 0.05 });
    this.play(this.note(id + 2, 2), { gain: 0.035, delay: 0.07 });
  },
  tick() { this.play(this.note(4, 1), { gain: 0.035, duration: 0.09 }); },
  key() { this.play(this.note(2, 0), { gain: 0.03, duration: 0.06, type: 'square' }); }, // a plain click for presses that do nothing else
  close() {
    this.play(this.note(2, 1), { gain: 0.035, duration: 0.12 });
    this.play(this.note(0, 0), { gain: 0.03, delay: 0.08, duration: 0.18 });
  },
  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem('nft-sound', this.enabled ? 'on' : 'off'); } catch (_) { /* storage */ }
    this.render();
    if (this.enabled) this.tick();
  },
  render() {
    soundToggle.setAttribute('aria-pressed', String(this.enabled));
  }
};

// iPhones keep Web Audio silent under the ring/silent switch until a media element has played,
// so the first touch plays a 60ms silent wav through <audio> and the blips follow the switch no more
const unmute = document.getElementById('unmute');
function unlockAudio() {
  unmute.play().catch(() => {});
  ['touchend', 'click', 'keydown'].forEach(ev => document.removeEventListener(ev, unlockAudio, true));
}
['touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, true));


// ---------- board LEDs: each one answers to one real event ----------
const leds = {
  el: Object.fromEntries(['net', 'mem', 'wallet', 'audio', 'bg'].map(k => [k, document.getElementById(`led-${k}`)])),
  set(name, state) { // state: 'off' | 'on' | 'blink'
    const el = this.el[name];
    if (!el) return;
    el.classList.remove('on', 'blink', 'flash');
    if (state !== 'off') el.classList.add(state);
  },
  flash(name) {
    const el = this.el[name];
    if (!el || el.classList.contains('on') || el.classList.contains('blink')) return;
    el.classList.remove('flash');
    void el.offsetWidth; // restart the animation
    el.classList.add('flash');
  },
  // a button press: the board brightens for a moment and the LEDs ripple across it
  pulse() {
    guts.classList.remove('pulse');
    void guts.offsetWidth;
    guts.classList.add('pulse');
    ['mem', 'net', 'audio', 'wallet', 'bg'].forEach((name, i) => setTimeout(() => this.flash(name), i * 40));
  }
};

// ---------- focus cursor ----------
let activeView = 'title';
const focusIndex = { title: 0, home: 0, gallery: 0, item: 0, info: 0, help: 0, remilia: 0, moss: 0, quest: 0 };
let lastView = 'title';

function shortAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
}

function setNote(text) {
  lcdStatus.textContent = text || views[activeView].dataset.note || '';
}

function focusables() {
  return [...views[activeView].querySelectorAll('.focusable')].filter(el => el.offsetParent !== null);
}

function setFocus(index, { scroll = true } = {}) {
  const els = focusables();
  if (!els.length) { setNote(''); return; }
  index = ((index % els.length) + els.length) % els.length;
  document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
  const el = els[index];
  el.classList.add('focused');
  focusIndex[activeView] = index;
  if (scroll) el.scrollIntoView({ block: 'nearest' });
  setNote(el.dataset.note);
}

function focusedElement() {
  return focusables()[focusIndex[activeView]] || null;
}

// up/down step by a row inside the tile grid, by one item elsewhere
function move(dir) {
  const els = focusables();
  if (!els.length) return;
  const i = Math.min(focusIndex[activeView] || 0, els.length - 1);
  const current = els[i];
  const grid = current.closest('.grid');
  let next = i;
  if (grid && (dir === 'up' || dir === 'down')) {
    const tiles = [...grid.children];
    const cols = tiles.filter(t => t.offsetTop === tiles[0].offsetTop).length || 1;
    const first = els.indexOf(tiles[0]);
    const last = els.indexOf(tiles[tiles.length - 1]);
    if (dir === 'up') next = i - cols >= first ? i - cols : first - 1;
    else next = i + cols <= last ? i + cols : (i === last ? last + 1 : last);
  } else {
    next = (dir === 'up' || dir === 'left') ? i - 1 : i + 1;
  }
  if (next < 0 || next >= els.length) return; // no wrap: the cursor stops at the ends
  sound.tick();
  setFocus(next);
}

function showView(name, { focus = 0, scroll = true } = {}) {
  if (activeView === 'video') beetleVideo.pause();
  if (activeView === 'item' && name !== 'item') views.item.classList.remove('showcase');
  lastView = activeView;
  Object.values(views).forEach(v => v.classList.add('hidden'));
  views[name].classList.remove('hidden');
  activeView = name;
  lcd.scrollTop = 0;
  if (name === 'video') {
    beetleVideo.currentTime = 0;
    beetleVideo.play().catch(() => {});
  }
  if (name === 'chart' && !chartFrame.src && chartFrame.dataset.src) chartFrame.src = chartFrame.dataset.src;
  if (name === 'moss') requestAnimationFrame(() => { growMoss(); syncMossZooms(); });
  else window.mossGarden?.stop();
  if (name === 'quest') startQuest();
  else window.mossQuest?.stop();
  setFocus(focus == null ? focusIndex[name] || 0 : focus, { scroll });
}

// ---------- Moss Quest ----------
// The game paints its pixel art (the map, the lab, the jar) on a canvas at the top of the LCD and renders the
// rest of itself as the LCD's own HTML: menus, lists, tabs, photos. So the handheld's focus cursor, notes and
// blips work on it like on every other screen. quest.js and its species data load the first time it is opened.
const QUEST_SRC = 'quest.js?v=7a1357fa';
const questCanvas = document.getElementById('quest-canvas');
const questUi = document.getElementById('quest-ui');
let questLoading = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.appendChild(el);
  });
}

// signed in on RemiliaNET: play as yourself, saves keyed by your handle. Otherwise a guest save on this device.
let questNotice = null;
async function questUser() {
  questNotice = null;
  const token = REMILIA.clientId ? await remiliaAccessToken() : null;
  if (!token) return null;
  try {
    const me = await remiliaApi('/me');
    const u = me.user || me;
    return { handle: u.username || 'remilia', displayName: u.displayName || u.username || 'remilia', pfpUrl: u.pfpUrl || null, id: u.username || u.id || 'remilia', guest: false };
  } catch (error) {
    questNotice = `RemiliaNET did not answer (${error.message}). playing as a guest for now.`;
    return null;
  }
}

async function startQuest() {
  setNote('loading the MossDex...');
  try {
    if (!window.mossQuest) { questLoading = questLoading || loadScript(QUEST_SRC); await questLoading; }
    const user = await questUser();
    if (activeView !== 'quest') return; // left before it loaded
    leds.set('mem', 'on');
    window.mossQuest.start(questCanvas, {
      dataUrl: 'assets/quest/mossdex.json',
      imgBase: 'assets/quest/',
      ui: questUi,
      user,
      notice: questNotice,
      muted: !sound.enabled,
      dev: ['127.0.0.1', 'localhost'].includes(location.hostname),
      onStatus: (text) => { if (activeView === 'quest' && !focusedElement()?.dataset.note) setNote(text); },
      // null: the same screen was redrawn, keep the cursor where it is
      onRender: (focus) => { if (activeView === 'quest') setFocus(focus == null ? (focusIndex.quest || 0) : focus, { scroll: false }); }
    });
  } catch (error) {
    setNote(`Moss Quest could not start: ${error.message}`);
  }
}

function leaveQuest() { window.mossQuest?.stop(); leds.set('mem', 'off'); toHome(); }
// the game takes the buttons it asks for (walking, dialogue, hints); the rest move and activate the LCD cursor
const questButton = (button) => () => {
  const q = window.mossQuest;
  if (!q) return;
  if (q.handles(button)) { q.press(button); sound.armed = false; return; }
  if (button === 'a') { if (focusables().length) activate(); else { q.press('a'); sound.armed = false; } return; }
  // up/down step the cursor; when there is nothing further to step to, they scroll the screen instead
  const before = focusIndex.quest;
  if (focusables().length) move(button);
  if ((button === 'up' || button === 'down') && (focusIndex.quest === before || !focusables().length)) {
    const step = questUi.clientHeight * 0.6;
    const was = questUi.scrollTop;
    questUi.scrollTop = was + (button === 'down' ? step : -step);
    if (questUi.scrollTop !== was) sound.tick();
  }
};

// holding a d-pad key walks; the click that follows still counts as one press
document.querySelectorAll('#dpad button[data-dir]').forEach((btn) => {
  const dir = btn.dataset.dir;
  btn.addEventListener('pointerdown', () => { if (activeView === 'quest') window.mossQuest?.hold(dir, true); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => btn.addEventListener(ev, () => window.mossQuest?.hold(dir, false)));
});

// ---------- moss garden ----------
// the $MOSS chart grown as a block world: surface height is price, volume decides
// how far moss has taken the stone, a falling stretch dries it back to cobble
const mossCanvas = document.getElementById('moss-canvas');

function growMoss(force = false) {
  if (!window.mossGarden || !mossCanvas) return;
  // signed in: your own clock. Everyone else shares UTC.
  window.mossGarden.start(mossCanvas, { force, local: Boolean(store.get('remilia-access')) });
}

// The window buttons under the chart, and L/R, are the same control: year down to one
// minute, the blocks growing as the window shortens
const mossZoomButtons = document.querySelectorAll('[data-zoom]');

function syncMossZooms() {
  if (!window.mossGarden) return;
  const active = window.mossGarden.zoomIndex();
  mossZoomButtons.forEach(el => el.classList.toggle('on', Number(el.dataset.zoom) === active));
}

function zoomMossChart(target, relative = false) {
  if (!window.mossGarden) return;
  sound.tick();
  const key = relative ? window.mossGarden.setZoom(target) : window.mossGarden.setZoomTo(target);
  syncMossZooms();
  setNote(`${key} · A or L/R: window`);
}

mossZoomButtons.forEach(el => el.addEventListener('click', () => zoomMossChart(Number(el.dataset.zoom))));

let mossResize;
window.addEventListener('resize', () => {
  if (activeView !== 'moss') return;
  clearTimeout(mossResize);
  mossResize = setTimeout(() => growMoss(true), 200);
});

// ---------- wallet ----------
let connectedAddress = null;

function getConnectedAddress() {
  return connectedAddress;
}

// AppKit reports the account, whether it came from a browser extension, a phone
// over WalletConnect, or a session it restored on its own
function onWalletAccount(next) {
  connectedAddress = next || null;
  renderWallet();
  if (activeView === 'gallery') openGallery(galleryMode);
}

const walletPill = document.getElementById('btn-wallet');
const walletLabel = document.getElementById('wallet-label');

function renderWallet() {
  const address = getConnectedAddress();
  walletPill.classList.toggle('on', Boolean(address));
  walletLabel.textContent = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'CONNECT';
  leds.set('wallet', address ? 'on' : 'off');
}

// the site forgets the address, and AppKit ends its own session too
async function disconnectWallet() {
  try { await window.mossWallet?.disconnect(); } catch (_) { /* already gone */ }
  connectedAddress = null;
  renderWallet();
  setNote('wallet disconnected');
  if (activeView === 'gallery') openGallery(galleryMode);
}

// AppKit is 4.4MB — forty times the rest of the site — so it is fetched the first
// time somebody presses CONNECT, never on first paint. It ships as npm packages
// with no CDN build, so it is bundled into assets/appkit.bundle.js by
// `npm run build:wallet` and served from here, which keeps script-src at 'self'.
let walletLoading = null;

function loadWallet() {
  if (window.mossWallet) return Promise.resolve(window.mossWallet);
  if (walletLoading) return walletLoading;
  setNote('loading wallets...');
  leds.set('net', 'blink');
  walletLoading = import(`./assets/${APPKIT_BUNDLE}`)
    .then(() => {
      leds.set('net', 'off');
      window.mossWallet.onAccount(onWalletAccount);
      onWalletAccount(window.mossWallet.address());       // a restored session is already connected
      return window.mossWallet;
    })
    .catch(error => {
      leds.set('net', 'off');
      walletLoading = null;
      setNote('could not load the wallet connector');
      console.error('AppKit failed to load:', error);
      throw error;
    });
  return walletLoading;
}

// One button for every wallet: AppKit's own dialog lists browser extensions, shows
// a QR for desktop, and deep links into the wallet apps on a phone.
async function connectWallet() {
  try {
    const wallet = await loadWallet();
    await wallet.open();
    return true;
  } catch (_) {
    return false;
  }
}


// ---------- gallery ----------
let galleryMode = 'all';
let galleryTokens = [];
const galleryCache = {};
let galleryRequest = 0;
const galleryTitle = document.getElementById('gallery-title');
const galleryPromo = document.getElementById('gallery-promo');

function isOwnedBy(token, walletAddress) {
  if (!walletAddress) return false;
  // base58 is case-sensitive; hex addresses are not
  if (collection.chain.solana) return token.owner === walletAddress;
  return token.owner.toLowerCase() === walletAddress.toLowerCase();
}

function showGalleryMessage(text) {
  galleryMsg.textContent = text;
  galleryMsg.classList.toggle('hidden', !text);
}

function setGalleryTabs(mode, counts) {
  views.gallery.querySelectorAll('.tab').forEach(tab => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('active', active);
    const base = tab.dataset.mode === 'all' ? 'ALL' : 'YOURS';
    const n = counts ? counts[tab.dataset.mode] : null;
    tab.textContent = n == null ? base : `${base} ${n}`;
  });
}

function buildTile(token, walletAddress) {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'tile focusable';
  tile.dataset.tokenId = token.tokenId;
  tile.dataset.note = `${token.name} · ${isOwnedBy(token, walletAddress) ? 'yours' : shortAddress(token.owner)}`;
  if (isOwnedBy(token, walletAddress)) tile.classList.add('mine');
  const img = document.createElement('img');
  img.src = token.thumbnail || (token.image ? sized(ipfsToHttp(token.image), 400) : 'assets/placeholder.png');
  img.alt = token.name;
  img.loading = 'lazy';
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = token.tokenId;
  tile.append(img, num);
  tile.addEventListener('click', () => openItem(token));
  return tile;
}

let visibleTokens = [];
let itemIndex = -1;

function renderGallery() {
  const walletAddress = getConnectedAddress();
  const mine = galleryTokens.filter(t => isOwnedBy(t, walletAddress));
  const visible = galleryMode === 'mine' ? mine : galleryTokens;
  visibleTokens = visible;
  setGalleryTabs(galleryMode, { all: galleryTokens.length, mine: walletAddress ? mine.length : null });
  galleryGrid.innerHTML = '';
  galleryConnect.classList.add('hidden');
  if (galleryMode === 'mine' && !walletAddress) {
    showGalleryMessage('Connect a wallet to see which ones are yours.');
    galleryConnect.classList.remove('hidden');
    galleryConnectBtn.classList.remove('hidden');
    return;
  }
  if (!visible.length) {
    showGalleryMessage(galleryMode === 'mine' ? `No ${collection.plural} in ${shortAddress(walletAddress)}. Yet.` : 'Nothing found.');
    return;
  }
  const holders = new Set(galleryTokens.map(t => t.owner.toLowerCase())).size;
  showGalleryMessage(galleryMode === 'mine'
    ? `${mine.length} of ${galleryTokens.length} in ${shortAddress(walletAddress)}`
    : `${galleryTokens.length} items · ${holders} holders`);
  visible.forEach(token => galleryGrid.appendChild(buildTile(token, walletAddress)));
}

function updateTile(token) {
  const tile = galleryGrid.querySelector(`.tile[data-token-id="${token.tokenId}"]`);
  if (!tile) return;
  const walletAddress = getConnectedAddress();
  tile.dataset.note = `${token.name} · ${isOwnedBy(token, walletAddress) ? 'yours' : shortAddress(token.owner)}`;
  const img = tile.querySelector('img');
  img.alt = token.name;
  // metadata may have arrived after the tile was built
  if (!token.thumbnail && token.image) img.src = sized(ipfsToHttp(token.image), 400);
  if (tile.classList.contains('focused')) setNote(tile.dataset.note);
}

async function openGallery(mode = galleryMode, key = collection.key) {
  if (key !== collection.key) { galleryCache[collection.key] = galleryTokens; collection = COLLECTIONS[key]; galleryTokens = galleryCache[key] || []; focusIndex.gallery = 0; }
  galleryMode = mode;
  const request = ++galleryRequest;
  galleryTitle.textContent = collection.name.toUpperCase();
  galleryTitle.href = collection.site;
  galleryTitle.dataset.note = `${collection.name} on scatter.art`;
  views.gallery.querySelector('.tab[data-mode="all"]').dataset.note = `every ${collection.name} token, read from ${collection.chain.name}`;
  galleryPromo.classList.toggle('hidden', !collection.promo);
  if (collection.promo) {
    galleryPromo.href = collection.promo;
    galleryPromo.dataset.note = `the ${collection.name} promo, on X`;
  }
  showView('gallery', { focus: null });
  setGalleryTabs(mode, null);
  galleryConnect.classList.add('hidden');
  galleryGrid.innerHTML = '';

  if (!galleryTokens.length) {
    showGalleryMessage(`Reading ${collection.chain.name}...`);
    setFocus(0, { scroll: false });
    leds.set('net', 'blink');
    try {
      const tokens = collection.chain.solana
        ? await fetchCoreTokens(collection)
        : await fetchErc721Tokens(collection);
      if (request !== galleryRequest) return;
      galleryTokens = tokens;
      const hydrate = collection.metadataFile
        ? applyBundledMetadata(collection, tokens, updateTile)
        : hydrateTokenMetadata(tokens, updateTile);
      hydrate.then(() => leds.set('net', 'off')).catch(err => { console.warn(err); leds.set('net', 'off'); });
    } catch (error) {
      leds.set('net', 'off');
      if (request !== galleryRequest) return;
      console.error('Gallery failed:', error);
      showGalleryMessage(`Could not reach ${collection.chain.name}. A: try again.`);
      galleryTitle.focus?.();
      return;
    }
  }
  renderGallery();
  // land on the first tile (or the connect button / a tab when there is nothing to show)
  const els = focusables();
  const firstTile = els.findIndex(el => el.classList.contains('tile'));
  const connectBtn = els.findIndex(el => el.closest('#gallery-connect'));
  setFocus(firstTile >= 0 ? firstTile : (connectBtn >= 0 ? connectBtn : 0), { scroll: false });
}

// ---------- single item ----------
function linkItem(label, href, note) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.className = 'menu-item focusable';
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = label;
  a.dataset.note = note;
  li.appendChild(a);
  return li;
}

let itemLoadTimer = 0;
function openItem(token) {
  const walletAddress = getConnectedAddress();
  const mine = isOwnedBy(token, walletAddress);
  currentToken = token;
  itemIndex = visibleTokens.indexOf(token);
  fillInfo(token);
  applyGreen();
  clearTimeout(itemLoadTimer);
  itemStage.classList.remove('loading');
  itemImage.onload = itemImage.onerror = () => { clearTimeout(itemLoadTimer); itemStage.classList.remove('loading'); };
  itemImage.src = token.large || token.thumbnail || (token.image ? sized(ipfsToHttp(token.image), 1024) : 'assets/placeholder.png');
  // only show the bar when the picture actually keeps us waiting
  if (!itemImage.complete) itemLoadTimer = setTimeout(() => { if (!itemImage.complete) itemStage.classList.add('loading'); }, 120);
  itemImage.alt = token.name;
  itemName.textContent = token.name;
  itemCount.textContent = itemIndex >= 0 ? `${itemIndex + 1} / ${visibleTokens.length}` : '';
  itemLinks.innerHTML = '';
  collection.links(token).forEach(([label, href, note]) => { if (href) itemLinks.appendChild(linkItem(label, href, note)); });
  const dmg = document.createElement('li');
  const dmgBtn = document.createElement('button');
  dmgBtn.type = 'button';
  dmgBtn.className = 'menu-item focusable';
  dmgBtn.textContent = 'DMG';
  dmgBtn.dataset.note = 'DMG palette: the picture in the four Game Boy shades';
  dmgBtn.setAttribute('aria-pressed', String(greenMode));
  dmgBtn.addEventListener('click', toggleGreen);
  dmg.appendChild(dmgBtn);
  itemLinks.appendChild(dmg);
  const back = document.createElement('li');
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'menu-item focusable';
  backBtn.textContent = 'BACK';
  backBtn.dataset.note = 'back to the gallery';
  backBtn.addEventListener('click', () => press('b'));
  back.appendChild(backBtn);
  itemLinks.appendChild(back);
  if (activeView !== 'item') showView('item', { focus: 0, scroll: false });
  else setFocus(0, { scroll: false });
  itemCount.textContent = `${itemCount.textContent}${mine ? ' · yours' : ''}`;
  setNote(views.item.classList.contains('showcase') ? 'A or B: leave showcase' : views.item.dataset.note);
}

// ---------- item modes ----------
let currentToken = null;
let greenMode = false;
const greenCache = new Map();

function setShowcase(on) {
  views.item.classList.toggle('showcase', on);
  setNote(on ? 'A or B: leave showcase' : views.item.dataset.note);
}

// the details page fills the screen; X or B returns to the picture
function openInfo() {
  if (!currentToken) return;
  sound.tick();
  fillInfo(currentToken);
  showView('info');
}
function closeInfo() {
  sound.close();
  showView('item', { focus: 0, scroll: false });
}

// 4-shade Game Boy rendering of the picture: Floyd-Steinberg dithered to the LCD palette
const DMG = [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]];
function renderGreen(token) {
  const cacheKey = `${collection.key}/${token.tokenId}`;
  if (greenCache.has(cacheKey)) return Promise.resolve(greenCache.get(cacheKey));
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = 160, h = Math.round(160 * img.height / img.width);
      const work = document.createElement('canvas');
      work.width = w; work.height = h;
      const ctx = work.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const px = data.data;
      const lum = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) lum[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const old = lum[i];
          const q = Math.round(Math.min(1, Math.max(0, old)) * 3) / 3;
          const err = old - q;
          lum[i] = q;
          if (x + 1 < w) lum[i + 1] += err * 7 / 16;
          if (y + 1 < h) {
            if (x > 0) lum[i + w - 1] += err * 3 / 16;
            lum[i + w] += err * 5 / 16;
            if (x + 1 < w) lum[i + w + 1] += err * 1 / 16;
          }
          const c = DMG[Math.round(q * 3)];
          px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 255;
        }
      }
      ctx.putImageData(data, 0, 0);
      greenCache.set(cacheKey, work);
      resolve(work);
    };
    img.onerror = () => resolve(null);
    img.crossOrigin = 'anonymous';
    img.src = token.large || token.thumbnail || (token.image ? sized(ipfsToHttp(token.image), 1024) : '');
  });
}

async function applyGreen() {
  if (!currentToken) return;
  if (!greenMode) {
    itemGreen.classList.add('hidden');
    itemImage.classList.remove('hidden');
    return;
  }
  const token = currentToken;
  const work = await renderGreen(token);
  if (!work || token !== currentToken || !greenMode) return;
  itemGreen.width = work.width; itemGreen.height = work.height;
  itemGreen.getContext('2d').drawImage(work, 0, 0);
  itemGreen.classList.remove('hidden');
  itemImage.classList.add('hidden');
}

function toggleGreen() {
  greenMode = !greenMode;
  sound.tick();
  applyGreen();
  itemLinks.querySelectorAll('[aria-pressed]').forEach(b => b.setAttribute('aria-pressed', String(greenMode)));
  setNote(greenMode ? 'DMG palette on · Y or DMG: colour' : 'DMG palette off · Y or DMG: four Game Boy shades');
}

function fillInfo(token) {
  const walletAddress = getConnectedAddress();
  infoTitle.textContent = token.name;
  infoDesc.textContent = token.description || collection.description;
  infoFields.innerHTML = '';
  const meta = token.metadata || {};
  const traits = Array.isArray(meta.attributes) && meta.attributes.length
    ? meta.attributes.map(a => `${a.trait_type || a.name || 'trait'}: ${a.value}`).join(' · ')
    : 'none';
  const rows = [
    ['token', `#${token.tokenId} of ${galleryTokens.length}`],
    ['owner', `${token.owner}${isOwnedBy(token, walletAddress) ? ' (you)' : ''}`],
    ['traits', traits],
    [collection.chain.solana ? 'collection' : 'contract', collection.address],
    ['asset', collection.chain.solana ? token.assetId : ''],
    ['chain', collection.chain.solana ? 'Solana · Metaplex Core' : `${collection.chain.name} · ERC-721`],
    ['metadata', token.tokenUri || 'unknown'],
    ['image', token.image || 'unknown'],
    ['external', meta.external_url || '']
  ].filter(([, v]) => v);
  rows.forEach(([k, v]) => {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    infoFields.append(dt, dd);
  });
}

// shoulder buttons: previous / next Mossawrette while looking at one, otherwise cursor left / right
function stepItem(direction) {
  if ((activeView !== 'item' && activeView !== 'info') || itemIndex < 0 || !visibleTokens.length) return false;
  const next = (itemIndex + direction + visibleTokens.length) % visibleTokens.length;
  const onInfo = activeView === 'info';
  sound.tick();
  openItem(visibleTokens[next]);
  if (onInfo) { fillInfo(currentToken); showView('info'); }
  return true;
}

// L and R flip between the gallery's ALL and YOURS lists
function flipGallery() {
  sound.tick();
  openGallery(galleryMode === 'all' ? 'mine' : 'all');
}


// ---------- background picker ----------
const background = createBackground(document.getElementById('bg-canvas'));
const bgItem = document.getElementById('bg-item');
background.onChange((bg) => { bgItem.textContent = `BACKGROUND: ${bg.name}`; leds.flash('bg'); });
bgItem.textContent = `BACKGROUND: ${background.name}`;
bgItem.addEventListener('click', () => background.next());

// a light tap on real buttons, where the browser allows it
function haptic() {
  try { if (navigator.vibrate) navigator.vibrate(8); } catch (_) { /* unsupported */ }
}
document.querySelectorAll('.device button:not(.focusable)').forEach(btn => btn.addEventListener('pointerdown', haptic, { passive: true }));

// ---------- RemiliaNET ----------
// Authorization Code + PKCE against their Keycloak realm. A public client, so
// there is no secret: the code verifier never leaves this browser and the
// token exchange is a plain browser POST (their token endpoint sends CORS
// headers for a registered origin).
//
// To switch this on: register the application at remilia.net/developer with
// client type "Login", list this site's URL as a redirect URI verbatim, and
// put the client id below. The id is not a secret.
const REMILIA = {
  clientId: 'tpa-mossquest',                      // from the developer portal; not a secret
  authorize: 'https://www.remilia.net/oidc/realms/remilia/protocol/openid-connect/auth',
  token: 'https://www.remilia.net/oidc/realms/remilia/protocol/openid-connect/token',
  logout: 'https://www.remilia.net/oidc/realms/remilia/protocol/openid-connect/logout',
  api: 'https://www.remilia.net/api/v1',
  // must be a subset of what the application was granted at registration
  scopes: 'openid remilia:beetle.read remilia:stats.read',
  redirect: `${location.origin}/`,
  // the public profile endpoint needs no token at all
  handle: 'moss'
};

const remiliaMsg = document.getElementById('remilia-msg');
const remiliaActions = document.getElementById('remilia-actions');
const remiliaFields = document.getElementById('remilia-fields');
const remiliaPfp = document.getElementById('remilia-pfp');
const remiliaName = document.getElementById('remilia-name');
const remiliaHandle = document.getElementById('remilia-handle');
const remiliaBio = document.getElementById('remilia-bio');

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) { /* private mode */ } },
  drop(k) { try { sessionStorage.removeItem(k); } catch (_) { /* private mode */ } }
};

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(bytes) {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(digest);
}

async function remiliaSignIn() {
  if (!REMILIA.clientId) { setNote('RemiliaNET application not registered yet'); return; }
  const verifier = randomString(32);
  const state = randomString(16);
  store.set('remilia-verifier', verifier);
  store.set('remilia-state', state);
  const params = new URLSearchParams({
    client_id: REMILIA.clientId,
    response_type: 'code',
    redirect_uri: REMILIA.redirect,
    scope: REMILIA.scopes,
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256'
  });
  location.href = `${REMILIA.authorize}?${params}`;
}

async function remiliaToken(body) {
  const response = await fetch(REMILIA.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: REMILIA.clientId, ...body })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description || payload.error || `HTTP ${response.status}`);
  store.set('remilia-access', payload.access_token);
  store.set('remilia-refresh', payload.refresh_token || '');
  store.set('remilia-expires', String(Date.now() + (payload.expires_in || 300) * 1000));
  return payload;
}

// the authorization server sends the visitor back here with ?code=&state=
async function remiliaHandleReturn() {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code) return false;
  const expected = store.get('remilia-state');
  const verifier = store.get('remilia-verifier');
  history.replaceState({}, '', url.pathname); // do not leave the code in the address bar
  store.drop('remilia-state');
  store.drop('remilia-verifier');
  if (!expected || state !== expected || !verifier) { setNote('sign-in did not match this browser'); return false; }
  try {
    await remiliaToken({ grant_type: 'authorization_code', code, redirect_uri: REMILIA.redirect, code_verifier: verifier });
    return true;
  } catch (error) {
    console.warn('RemiliaNET sign-in failed:', error);
    return false;
  }
}

async function remiliaAccessToken() {
  const token = store.get('remilia-access');
  const expires = Number(store.get('remilia-expires') || 0);
  if (token && Date.now() < expires - 15000) return token;
  const refresh = store.get('remilia-refresh');
  if (!refresh) return null;
  try {
    const payload = await remiliaToken({ grant_type: 'refresh_token', refresh_token: refresh });
    return payload.access_token;
  } catch (_) {
    remiliaSignOut(false);
    return null;
  }
}

async function remiliaApi(path) {
  const token = await remiliaAccessToken();
  if (!token) throw new Error('not signed in');
  const response = await fetch(`${REMILIA.api}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function remiliaSignOut(redirect = true) {
  ['remilia-access', 'remilia-refresh', 'remilia-expires'].forEach(store.drop);
  if (redirect) showRemilia();
}

function remiliaRow(label, value) {
  const dt = document.createElement('dt'); dt.textContent = label;
  const dd = document.createElement('dd'); dd.textContent = value;
  remiliaFields.append(dt, dd);
}

function remiliaButton(label, note, onClick) {
  const li = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'menu-item focusable';
  button.textContent = label;
  button.dataset.note = note;
  button.addEventListener('click', onClick);
  li.appendChild(button);
  remiliaActions.appendChild(li);
}

// A public profile: no token, no client id, open CORS.
async function remiliaProfile(handle) {
  const response = await fetch(`${REMILIA.api}/users/${encodeURIComponent(handle)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  return payload.user || payload;
}

function remiliaCard(user) {
  remiliaPfp.src = user.pfpUrl || '';
  remiliaPfp.alt = user.displayName ? `${user.displayName}'s picture` : '';
  remiliaPfp.classList.toggle('hidden', !user.pfpUrl);
  remiliaName.textContent = user.displayName || user.username || '';
  remiliaHandle.textContent = [user.username && `@${user.username}`, user.location].filter(Boolean).join(' · ');
  remiliaBio.textContent = user.bio || '';

  const counts = [
    ['beetles', user.beetles],
    ['pokes', user.pokes],
    ['friends', user.friendCount],
    ['social credit', user.socialCredit],
    ['page views', user.pageViews]
  ].filter(([, v]) => v != null);
  counts.forEach(([k, v]) => remiliaRow(k, Number(v).toLocaleString()));

  const badges = user.achievementsDisplayed || user.allAchievements || [];
  badges.slice(0, 6).forEach(a => remiliaRow('badge', a.title));
}

async function showRemilia() {
  showView('remilia', { focus: 0 });
  remiliaActions.innerHTML = '';
  remiliaFields.innerHTML = '';
  remiliaMsg.textContent = 'Reading RemiliaNET...';

  const token = REMILIA.clientId ? await remiliaAccessToken() : null;

  if (token) {
    // signed in: the visitor's own account
    try {
      const me = await remiliaApi('/me');
      const user = me.user || me;
      remiliaMsg.textContent = `signed in as ${user.username || 'you'}`;
      remiliaCard(user);
    } catch (error) {
      remiliaMsg.textContent = `Could not read your profile: ${error.message}`;
    }
    // the Beetle needs remilia:beetle.read; without it the call answers 403
    try {
      const beetle = await remiliaApi('/me/beetle');
      if (beetle.level != null) remiliaRow('beetle level', beetle.level);
      if (beetle.xp != null) remiliaRow('beetle xp', beetle.xp);
    } catch (_) { /* scope not granted, or no beetle yet */ }
    remiliaButton('SIGN OUT', 'forget this session on this device', () => remiliaSignOut());
    setFocus(0, { scroll: false });
    return;
  }

  // signed out: show the site's own profile, which needs no token
  try {
    const user = await remiliaProfile(REMILIA.handle);
    remiliaMsg.textContent = '';
    remiliaCard(user);
  } catch (error) {
    remiliaMsg.textContent = `Could not reach RemiliaNET: ${error.message}`;
  }
  remiliaButton('VIEW ON REMILIA.NET', 'open this profile on remilia.net', () => window.open(`https://www.remilia.net/~${REMILIA.handle}`, '_blank', 'noopener'));
  if (REMILIA.clientId) remiliaButton('SIGN IN', 'see your own profile and Beetle here', remiliaSignIn);
  setFocus(0, { scroll: false });
}

// ---------- wiring: every input goes through press(), and the screen that is open decides what it means ----------
document.querySelectorAll('[data-action="gallery"]').forEach(el => el.addEventListener('click', () => openGallery('all', el.dataset.collection || collection.key)));
document.querySelectorAll('[data-action="chart"]').forEach(el => el.addEventListener('click', () => showView('chart')));
document.querySelectorAll('[data-action="garden"]').forEach(el => el.addEventListener('click', () => showView('moss', { focus: null })));
document.querySelectorAll('[data-action="quest"]').forEach(el => el.addEventListener('click', () => showView('quest', { focus: null })));
document.querySelectorAll('[data-action="remilia"]').forEach(el => el.addEventListener('click', showRemilia));
galleryConnectBtn.addEventListener('click', async () => {
  if (await connectWallet()) openGallery('mine');
});
views.gallery.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  if (galleryMode !== tab.dataset.mode) openGallery(tab.dataset.mode);
}));
document.querySelectorAll('[data-expands]').forEach(item => {
  const subs = document.querySelectorAll(`.${item.dataset.expands}`);
  const baseNote = item.dataset.note.replace(/ · A: (open|close)$/, '');
  item.addEventListener('click', () => {
    const open = item.getAttribute('aria-expanded') === 'true';
    item.setAttribute('aria-expanded', String(!open));
    subs.forEach(li => li.classList.toggle('hidden', open));
    item.dataset.note = `${baseNote} · A: ${open ? 'open' : 'close'}`;
    const els = focusables();
    setFocus(els.indexOf(open ? item : els[els.indexOf(item) + 1]));
  });
});
itemStage.addEventListener('click', () => { sound.tick(); setShowcase(!views.item.classList.contains('showcase')); });

function toTitle() { if (activeView !== 'title') { sound.close(); showView('title'); } }
function toHome() { sound.close(); showView('home', { focus: null }); }
function toggleSound() { sound.toggle(); setNote(sound.enabled ? 'sound on' : 'sound off'); }
function activate() {
  const el = focusedElement();
  if (!el) return;
  el.click(); // the LCD click handler below plays the blip
}
function scrollLcd(dir) {
  const step = lcd.clientHeight * 0.6;
  const before = lcd.scrollTop;
  lcd.scrollTop = before + (dir === 'down' ? step : -step);
  if (lcd.scrollTop !== before) sound.tick();
}

// the beetle plays between the title and the menu; any button skips it
function startFromTitle() { sound.open(18); showView('video'); }
function skipIntro() { beetleVideo.pause(); showView('home', { focus: 0 }); }
beetleVideo.addEventListener('ended', () => { if (activeView === 'video') skipIntro(); });
views.video.addEventListener('click', () => press('any'));
views.title.addEventListener('click', () => press('tap'));

let helpReturn = 'title';
function openHelp() { helpReturn = activeView; sound.tick(); showView('help', { focus: 0, scroll: false }); }
function closeHelp() { sound.close(); showView(helpReturn === 'help' ? 'title' : helpReturn, { focus: null }); }

function itemA() {
  if (views.item.classList.contains('showcase')) { sound.tick(); setShowcase(false); return; }
  activate();
}
function itemB() {
  if (views.item.classList.contains('showcase')) { setShowcase(false); return; }
  sound.close();
  showView('gallery', { focus: null });
  const tile = itemIndex >= 0 ? galleryGrid.querySelector(`.tile[data-token-id="${visibleTokens[itemIndex]?.tokenId}"]`) : null;
  if (tile) { const i = focusables().indexOf(tile); if (i >= 0) setFocus(i); }
}

// L and R on the menu step through the backgrounds
function stepBackground(direction) { sound.tick(); background.set(background.index + direction); }

// One meaning per button, on every screen:
//   d-pad move · A ok · B back · X info · Y sound · L/R prev/next · START menu · SELECT this key
const dirs = { up: () => move('up'), down: () => move('down'), left: () => move('left'), right: () => move('right') };
const always = { y: toggleSound, start: toHome, select: openHelp };
const ACTIONS = {
  title:   { a: startFromTitle, tap: startFromTitle, start: startFromTitle, y: toggleSound, select: openHelp },
  video:   { any: skipIntro },
  home:    { ...dirs, ...always, a: activate, b: toTitle, l: () => stepBackground(-1), r: () => stepBackground(1), start: null },
  gallery: { ...dirs, ...always, a: activate, b: toHome, l: flipGallery, r: flipGallery },
  item:    { ...dirs, ...always, a: itemA, b: itemB, x: openInfo, y: toggleGreen, l: () => stepItem(-1), r: () => stepItem(1) },
  info:    { ...always, up: () => scrollLcd('up'), down: () => scrollLcd('down'), b: closeInfo, x: closeInfo, y: toggleGreen, l: () => stepItem(-1), r: () => stepItem(1) },
  chart:   { ...always, b: toHome },
  moss:    { ...dirs, ...always, a: activate, b: toHome, l: () => zoomMossChart(-1, true), r: () => zoomMossChart(1, true) },
  quest:   { up: questButton('up'), down: questButton('down'), left: questButton('left'), right: questButton('right'),
             a: questButton('a'), b: questButton('b'), x: questButton('j'), l: questButton('left'), r: questButton('right'),
             y: () => { toggleSound(); window.mossQuest?.setMuted(!sound.enabled); }, start: leaveQuest, select: openHelp },
  help:    { ...dirs, ...always, a: activate, b: closeHelp, select: closeHelp },
  remilia: { ...dirs, ...always, a: activate, b: toHome }
};

// every press lights the board and makes a sound: the action's own blip if it has one, otherwise a plain key click
function press(button) {
  leds.pulse();
  sound.armed = true;
  const map = ACTIONS[activeView] || {};
  const fn = map.any || map[button];
  if (fn) fn();
  if (sound.armed) sound.key();
}

document.getElementById('dpad').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-dir]');
  if (btn) press(btn.dataset.dir);
});
[['btn-a', 'a'], ['btn-b', 'b'], ['btn-x', 'x'], ['btn-y', 'y'], ['btn-l', 'l'], ['btn-r', 'r'], ['btn-start', 'start'], ['btn-select', 'select']]
  .forEach(([id, button]) => document.getElementById(id).addEventListener('click', () => press(button)));
walletPill.addEventListener('click', async () => {
  leds.pulse();
  sound.tick();
  if (getConnectedAddress()) { disconnectWallet(); return; }
  if (await connectWallet()) setNote(`connected ${walletLabel.textContent}`);
});

// mouse hover moves the cursor too, so the status line always describes what is under the pointer
lcd.addEventListener('mouseover', (e) => {
  const el = e.target.closest('.focusable');
  if (!el) return;
  const i = focusables().indexOf(el);
  if (i >= 0 && i !== focusIndex[activeView]) setFocus(i, { scroll: false });
});
// anything focusable on the LCD blips when clicked or tapped, unless its own handler already made a sound
lcd.addEventListener('click', () => { sound.armed = true; }, true);
lcd.addEventListener('click', (e) => {
  const el = e.target.closest('.focusable');
  if (el && sound.armed) sound.open(Number(el.dataset.tokenId) || focusables().indexOf(el));
});

const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'a', ' ': 'a', z: 'a', Z: 'a', Escape: 'b', Backspace: 'b',
  x: 'x', X: 'x', y: 'y', Y: 'y', q: 'l', Q: 'l', e: 'r', E: 'r', s: 'start', S: 'start', c: 'select', C: 'select'
};
const HELD_DIRS = new Set(['up', 'down', 'left', 'right']);
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest('.device') && !e.target.closest('.lcd') && (e.key === 'Enter' || e.key === ' ')) return; // physical buttons handle their own Enter
  const button = KEYS[e.key];
  if (!button) return;
  e.preventDefault();
  // on the game's map a held arrow keeps walking; the key repeat only nudges menus
  if (activeView === 'quest' && HELD_DIRS.has(button) && window.mossQuest?.pad()) { if (!e.repeat) { press(button); window.mossQuest.hold(button, true); } return; }
  press(button);
});
document.addEventListener('keyup', (e) => {
  const button = KEYS[e.key];
  if (button && HELD_DIRS.has(button)) window.mossQuest?.hold(button, false);
});

renderWallet();
sound.render();
setFocus(0, { scroll: false });
