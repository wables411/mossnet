import { createBackground } from './bg.js';

// ===================== moss quest — the handheld =====================
// Everything on the site happens on the device screen. The d-pad, A and B
// buttons, keyboard and mouse all drive one focus cursor per view.

const lcd = document.getElementById('lcd');
const lcdStatus = document.getElementById('lcd-status');
const views = {
  help: document.getElementById('view-help'),
  title: document.getElementById('view-title'),
  home: document.getElementById('view-home'),
  gallery: document.getElementById('view-gallery'),
  item: document.getElementById('view-item'),
  video: document.getElementById('view-video'),
  chart: document.getElementById('view-chart')
};
const galleryGrid = document.getElementById('gallery-grid');
const galleryMsg = document.getElementById('gallery-msg');
const galleryConnect = document.getElementById('gallery-connect');
const itemImage = document.getElementById('item-image');
const itemName = document.getElementById('item-name');
const itemLinks = document.getElementById('item-links');
const itemCount = document.getElementById('item-count');
const itemStage = document.getElementById('item-stage');
const itemGreen = document.getElementById('item-green');
const itemInfo = document.getElementById('item-info');
const infoTitle = document.getElementById('info-title');
const infoDesc = document.getElementById('info-desc');
const infoFields = document.getElementById('info-fields');
const beetleVideo = document.getElementById('beetle-video');
const chartFrame = document.getElementById('chart-frame');
const soundToggle = document.getElementById('btn-x');
const ETHERSCAN = 'https://etherscan.io';

const MOSSAWRETTES = {
  name: 'Mossawrettes',
  address: '0x71f7bedf8572b75e446766906079dcf05a386737',
  description: 'recent studies indicate that micro exposure to moss can increase endorphin levels in the brain. 25+ cigawrettes that are simply lost in the moss.',
  firstTokenId: 1,
  // 480px thumbs for the grid, 1400px for the item screen; originals stay on IPFS as a link
  thumbnails: 'assets/mossawrettes-thumbs/{id}.webp',
  large: 'assets/mossawrettes-large/{id}.webp'
};

// Read-only Ethereum mainnet RPCs, tried in order (all allow browser CORS + JSON-RPC batches)
const ETH_RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://1rpc.io/eth'
];
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
async function ethCallBatch(address, calls) {
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
    for (const rpc of ETH_RPCS) {
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
      }
    }
    if (!done) throw lastError || new Error('All Ethereum RPCs failed');
  }
  return results;
}

// Reads totalSupply, then ownerOf + tokenURI for every token id, all in one batched request
async function fetchErc721Tokens(collection) {
  const [supplyHex] = await ethCallBatch(collection.address, [ERC721.totalSupply]);
  const totalSupply = decodeUint(supplyHex);
  if (!totalSupply) throw new Error('Could not read the collection supply');

  const first = collection.firstTokenId ?? 1;
  const ids = Array.from({ length: totalSupply }, (_, i) => first + i);
  const calls = [];
  ids.forEach(id => {
    calls.push(ERC721.ownerOf + encodeUint(id));
    calls.push(ERC721.tokenURI + encodeUint(id));
  });
  const results = await ethCallBatch(collection.address, calls);

  const tokens = [];
  ids.forEach((id, i) => {
    const owner = decodeAddress(results[i * 2]);
    if (!owner) return; // burned or nonexistent id
    tokens.push({
      tokenId: id,
      owner,
      tokenUri: decodeString(results[i * 2 + 1]),
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
        if (metadata.name) token.name = String(metadata.name).replace(/(\S)#(\d)/, '$1 #$2');
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
  note(degree, octave = 0) {
    return 220 * Math.pow(2, octave + this.scale[((degree % 5) + 5) % 5] / 12);
  },
  play(freq, { duration = 0.18, gain = 0.05, delay = 0, type = 'triangle' } = {}) {
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
  }
};

// ---------- focus cursor ----------
let activeView = 'title';
const focusIndex = { title: 0, home: 0, gallery: 0, item: 0, help: 0 };
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
  // with the info card open, the d-pad scrolls the card instead of moving the cursor
  if (activeView === 'item' && !itemInfo.classList.contains('hidden')) {
    const step = itemInfo.clientHeight * 0.6;
    if (dir === 'up' || dir === 'down') {
      const before = itemInfo.scrollTop;
      itemInfo.scrollTop = before + (dir === 'down' ? step : -step);
      if (itemInfo.scrollTop !== before) sound.tick();
    }
    return;
  }
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
  if (activeView === 'item' && name !== 'item') { views.item.classList.remove('showcase'); itemInfo.classList.add('hidden'); }
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
  setFocus(focus == null ? focusIndex[name] || 0 : focus, { scroll });
}

// ---------- wallet ----------
let connectedAddress = null;

function getConnectedAddress() {
  return connectedAddress;
}

function handleAccountsChanged(accounts) {
  connectedAddress = accounts.length ? accounts[0] : null;
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

// the site forgets the address; the wallet extension itself keeps its own connection list
function disconnectWallet() {
  connectedAddress = null;
  window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
  renderWallet();
  setNote('wallet disconnected');
  if (activeView === 'gallery') openGallery(galleryMode);
}

async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    showGalleryMessage('No wallet found. Install MetaMask or another Ethereum wallet, then try again.');
    return false;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    connectedAddress = accounts[0] || null;
    window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
    window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    renderWallet();
    return Boolean(connectedAddress);
  } catch (error) {
    console.error('Connection failed:', error);
    showGalleryMessage(`Could not connect: ${error.message || 'request rejected'}`);
    return false;
  }
}

// ---------- gallery ----------
let galleryMode = 'all';
let galleryTokens = [];
let galleryRequest = 0;

function isOwnedBy(token, walletAddress) {
  return Boolean(walletAddress) && token.owner.toLowerCase() === walletAddress.toLowerCase();
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
  img.src = token.thumbnail || 'assets/placeholder.png';
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
    return;
  }
  if (!visible.length) {
    showGalleryMessage(galleryMode === 'mine' ? `No Mossawrettes in ${shortAddress(walletAddress)}. Yet.` : 'Nothing found.');
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
  tile.querySelector('img').alt = token.name;
  if (tile.classList.contains('focused')) setNote(tile.dataset.note);
}

async function openGallery(mode = galleryMode) {
  galleryMode = mode;
  const request = ++galleryRequest;
  showView('gallery', { focus: null });
  setGalleryTabs(mode, null);
  galleryConnect.classList.add('hidden');
  galleryGrid.innerHTML = '';

  if (!galleryTokens.length) {
    showGalleryMessage('Reading Ethereum mainnet...');
    setFocus(0, { scroll: false });
    leds.set('net', 'blink');
    try {
      const tokens = await fetchErc721Tokens(MOSSAWRETTES);
      if (request !== galleryRequest) return;
      galleryTokens = tokens;
      hydrateTokenMetadata(tokens, updateTile).then(() => leds.set('net', 'off'));
    } catch (error) {
      leds.set('net', 'off');
      if (request !== galleryRequest) return;
      console.error('Gallery failed:', error);
      showGalleryMessage(`Could not read the chain: ${error.message}`);
      return;
    }
  }
  renderGallery();
  // land on the first tile (or the connect button / a tab when there is nothing to show)
  const els = focusables();
  const firstTile = els.findIndex(el => el.classList.contains('tile'));
  const connectBtn = els.findIndex(el => el.dataset.action === 'connect');
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

function openItem(token) {
  const walletAddress = getConnectedAddress();
  const mine = isOwnedBy(token, walletAddress);
  currentToken = token;
  itemIndex = visibleTokens.indexOf(token);
  itemInfo.classList.add('hidden');
  fillInfo(token);
  applyGreen();
  itemImage.src = token.large || token.thumbnail || 'assets/placeholder.png';
  itemImage.alt = token.name;
  itemName.textContent = token.name;
  itemCount.textContent = itemIndex >= 0 ? `${itemIndex + 1} / ${visibleTokens.length}` : '';
  itemLinks.innerHTML = '';
  itemLinks.appendChild(linkItem('OpenSea', `https://opensea.io/assets/ethereum/${MOSSAWRETTES.address}/${token.tokenId}`, 'listing on OpenSea'));
  itemLinks.appendChild(linkItem('Etherscan', `${ETHERSCAN}/nft/${MOSSAWRETTES.address}/${token.tokenId}`, 'token on Etherscan'));
  if (token.image) itemLinks.appendChild(linkItem('IPFS', ipfsToHttp(token.image, IPFS_GATEWAYS.length - 1), 'full-size original, 9-12MB'));
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

function setInfo(on) {
  itemInfo.classList.toggle('hidden', !on);
  if (on) itemInfo.scrollTop = 0;
  setNote(on ? 'X or B: close info' : views.item.dataset.note);
}

// 4-shade Game Boy rendering of the picture: Floyd-Steinberg dithered to the LCD palette
const DMG = [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]];
function renderGreen(token) {
  if (greenCache.has(token.tokenId)) return Promise.resolve(greenCache.get(token.tokenId));
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
      greenCache.set(token.tokenId, work);
      resolve(work);
    };
    img.onerror = () => resolve(null);
    img.src = token.large || token.thumbnail;
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
  setNote(greenMode ? 'Y: colour · A: showcase · X: info · L/R: prev/next · B: back' : views.item.dataset.note);
}

function fillInfo(token) {
  const walletAddress = getConnectedAddress();
  infoTitle.textContent = token.name;
  infoDesc.textContent = token.description || MOSSAWRETTES.description;
  infoFields.innerHTML = '';
  const meta = token.metadata || {};
  const traits = Array.isArray(meta.attributes) && meta.attributes.length
    ? meta.attributes.map(a => `${a.trait_type || a.name || 'trait'}: ${a.value}`).join(' · ')
    : 'none';
  const rows = [
    ['token', `#${token.tokenId} of ${galleryTokens.length}`],
    ['owner', `${token.owner}${isOwnedBy(token, walletAddress) ? ' (you)' : ''}`],
    ['traits', traits],
    ['contract', MOSSAWRETTES.address],
    ['chain', 'Ethereum mainnet · ERC-721'],
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
  if (activeView !== 'item' || itemIndex < 0 || !visibleTokens.length) return false;
  const next = (itemIndex + direction + visibleTokens.length) % visibleTokens.length;
  sound.tick();
  openItem(visibleTokens[next]);
  return true;
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

// ---------- wiring: every input goes through press(), and the screen that is open decides what it means ----------
document.querySelectorAll('[data-action="gallery"]').forEach(el => el.addEventListener('click', () => openGallery('all')));
document.querySelectorAll('[data-action="chart"]').forEach(el => el.addEventListener('click', () => showView('chart')));
document.getElementById('gallery-connect-btn').addEventListener('click', async () => {
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
  sound.open(Number(el.dataset.tokenId) || focusIndex[activeView]);
  el.click();
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
function openHelp() { helpReturn = activeView; sound.tick(); showView('help'); }
function closeHelp() { sound.close(); showView(helpReturn === 'help' ? 'title' : helpReturn, { focus: null }); }

function itemA() {
  if (views.item.classList.contains('showcase')) { sound.tick(); setShowcase(false); return; }
  if (!itemInfo.classList.contains('hidden')) return;
  activate();
}
function itemB() {
  if (!itemInfo.classList.contains('hidden')) { setInfo(false); return; }
  if (views.item.classList.contains('showcase')) { setShowcase(false); return; }
  sound.close();
  showView('gallery', { focus: null });
  const tile = itemIndex >= 0 ? galleryGrid.querySelector(`.tile[data-token-id="${visibleTokens[itemIndex]?.tokenId}"]`) : null;
  if (tile) { const i = focusables().indexOf(tile); if (i >= 0) setFocus(i); }
}
function itemX() { sound.tick(); setInfo(itemInfo.classList.contains('hidden')); }

const dirs = { up: () => move('up'), down: () => move('down'), left: () => move('left'), right: () => move('right') };
const ACTIONS = {
  title:   { a: startFromTitle, tap: startFromTitle, select: openHelp, x: toggleSound },
  video:   { any: skipIntro },
  home:    { ...dirs, a: activate, b: toTitle, x: toggleSound, start: toTitle, select: openHelp },
  gallery: { ...dirs, a: activate, b: toHome, l: dirs.left, r: dirs.right, x: toggleSound, start: toTitle, select: openHelp },
  item:    { ...dirs, a: itemA, b: itemB, x: itemX, y: toggleGreen, l: () => stepItem(-1), r: () => stepItem(1), start: toTitle, select: openHelp },
  chart:   { b: toHome, x: toggleSound, start: toTitle, select: openHelp },
  help:    { up: () => scrollLcd('up'), down: () => scrollLcd('down'), b: closeHelp, select: closeHelp, start: toTitle }
};

function press(button) {
  const map = ACTIONS[activeView] || {};
  const fn = map.any || map[button];
  if (fn) fn();
}

document.getElementById('dpad').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-dir]');
  if (btn) press(btn.dataset.dir);
});
[['btn-a', 'a'], ['btn-b', 'b'], ['btn-x', 'x'], ['btn-y', 'y'], ['btn-l', 'l'], ['btn-r', 'r'], ['btn-start', 'start'], ['btn-select', 'select']]
  .forEach(([id, button]) => document.getElementById(id).addEventListener('click', () => press(button)));
walletPill.addEventListener('click', async () => {
  if (getConnectedAddress()) { disconnectWallet(); return; }
  if (await connectWallet()) setNote(`connected ${walletLabel.textContent}`);
});
// every physical press registers on the board
document.querySelectorAll('.device button:not(.focusable)').forEach(btn => btn.addEventListener('pointerdown', () => leds.flash('mem'), { passive: true }));

// mouse hover moves the cursor too, so the status line always describes what is under the pointer
lcd.addEventListener('mouseover', (e) => {
  const el = e.target.closest('.focusable');
  if (!el) return;
  const i = focusables().indexOf(el);
  if (i >= 0 && i !== focusIndex[activeView]) setFocus(i, { scroll: false });
});
// clicking a link or tile with the mouse should also make the blip
lcd.addEventListener('click', (e) => {
  const el = e.target.closest('.focusable');
  if (el && !el.classList.contains('tile') && !el.dataset.action) sound.open(focusIndex[activeView]);
});

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest('.device') && !e.target.closest('.lcd') && (e.key === 'Enter' || e.key === ' ')) return; // physical buttons handle their own Enter
  const keys = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Enter: 'a', ' ': 'a', z: 'a', Z: 'a', Escape: 'b', Backspace: 'b',
    x: 'x', X: 'x', y: 'y', Y: 'y', q: 'l', Q: 'l', e: 'r', E: 'r', s: 'start', S: 'start', c: 'select', C: 'select'
  };
  const button = keys[e.key];
  if (!button) return;
  e.preventDefault();
  press(button);
});

renderWallet();
sound.render();
setFocus(0, { scroll: false });
