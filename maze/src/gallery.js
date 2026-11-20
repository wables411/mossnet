// The gallery: the same world as the maze, but one closed room with no way out, and on its moss walls hang the
// pictures the visitor owns: their Remilia NFTs, and their moss NFTs too if they ask for them. Whose gallery it is
// comes from the wallet connected on mossmossmoss.quest; which tokens that wallet holds, and the pictures, come from
// the site (functions/maze/nft), which reads the chains. The place, the weather and the hour are drawn from the
// wallet's address, so each wallet has a gallery of its own and finds it the same on every visit.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { OPEN, WALL } from './maze.js?v=40c16947';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
// pictures to a wall tile: two where the tiles are wide, one where they are narrow, so a picture is never small
const perTile = cell => (cell >= 2.3 ? 2 : 1);
export const GALLERY_MAX = 112;

// the wallets this browser has connected or signed with on the site (script.js keeps the first; the save session
// names the one that signed), or ?wallet=0x.. to look at any wallet's gallery
export function galleryWallets(params, anyWallet) {
  const out = [];
  const add = a => { a = String(a || '').toLowerCase(); if (ADDRESS.test(a) && !out.includes(a)) out.push(a); };
  if (anyWallet) for (const a of String((params && params.get('wallet')) || '').split(',')) add(a);
  if (out.length) return out;
  try { for (const a of JSON.parse(localStorage.getItem('moss-wallets') || '[]')) add(a); } catch { /* none kept */ }
  try { add((JSON.parse(localStorage.getItem('moss-save-token') || 'null') || {}).address); } catch { /* none kept */ }
  return out.slice(0, 4);
}
export const shortWallet = a => `${a.slice(0, 6)}…${a.slice(-4)}`;

// what hangs there: asked of the site until it has read every collection (it reads a few per call)
export async function galleryList(owners, moss, onWait) {
  const at = new URL(`../nft/list?owner=${owners.join(',')}${moss ? '&moss=1' : ''}`, import.meta.url);
  for (let tries = 0; tries < 10; tries++) {
    const res = await fetch(at, { cache: 'no-store' });
    let data = null; try { data = await res.json(); } catch { /* not the site: a plain file server answers with a page */ }
    if (!data || !Array.isArray(data.items)) throw new Error((data && data.error) || 'the gallery needs the site: open it at mossmossmoss.quest/maze');
    if (!data.pending || !data.pending.length) { data.items.unread = data.unread || []; return data.items; }
    if (onWait) onWait(data.pending);
    await new Promise(r => setTimeout(r, 900));
  }
  throw new Error('the chains are slow to answer · try again in a minute');
}

// a number from an address: the same wallet, the same gallery
export function seedOf(owners) { let h = 2166136261; for (const ch of owners.join('+')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// one closed room, big enough for the pictures: the maze's own shape of data, with no exit cut in it
export function galleryRoom(count, cell) {
  const R = Math.max(3, Math.min(29, Math.ceil(Math.min(count, GALLERY_MAX) / (4 * perTile(cell))) + 1));
  const W = R + 2, H = R + 2, grid = new Uint8Array(W * H).fill(WALL);
  for (let y = 1; y <= R; y++) for (let x = 1; x <= R; x++) grid[y * W + x] = OPEN;
  const mid = 1 + Math.floor(R / 2), start = { x: mid, y: mid };
  return {
    W, H, grid, zone: new Uint8Array(W * H), start, sealed: true,
    exitRoom: { x: R, y: mid }, exit: { x: R + 1, y: mid, dir: [1, 0] },      // named, never opened: that tile stays wall
    protect: [[mid, mid]], path: [[mid, mid], [mid, mid - 1]], solutionLength: 1, zones: 1, room: R, gap: 1,
  };
}

const _n = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3();

export class Gallery {
  constructor({ scene, renderer, high }) {
    this.scene = scene; this.renderer = renderer; this.px = high ? 512 : 320;
    this.group = new THREE.Group(); this.group.name = 'gallery'; scene.add(this.group);
    this.frames = []; this.pictures = []; this.token = 0;
    this.wood = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.82, metalness: 0 });
    this.board = new THREE.BoxGeometry(1, 1, 1);
    this.plane = new THREE.PlaneGeometry(1, 1);
  }
  clear() {
    this.token++;
    for (const f of this.frames) { f.pic.material.map && f.pic.material.map.dispose(); f.pic.material.dispose(); f.tag.material.map.dispose(); f.tag.material.dispose(); this.group.remove(f.group); }
    this.frames.length = 0; this.pictures.length = 0;
  }
  // a card of paper with the token's name, shown until (or instead of) its picture
  paper(lines, w = 256, h = 256, small = false) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#e9e4d2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b2b30'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const size = small ? Math.floor(h * 0.42) : Math.floor(h * 0.09);
    g.font = `${size}px "IM Fell English", Georgia, serif`;
    lines.forEach((t, i) => g.fillText(t, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.35, w - 12));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  // Hang them. o: { maze, cell, floorY(x, z), cast(origin, dir, far) -> { distance } | null }
  // Each picture is set against the moss that is really there: rays are sent at the wall where its corners and its
  // middle will be, and it is hung just proud of the nearest thing they meet, upright and square to the room.
  hang(items, o) {
    this.clear();
    const { maze, cell: c } = o, R = maze.room, token = this.token, PER_TILE = perTile(c);
    const slots = [];
    const side = (nx, nz, fx, fz, ax, az) => { for (let i = 0; i < R * PER_TILE; i++) { const t = (i + 0.5) / PER_TILE; slots.push({ x: fx + ax * t * c, z: fz + az * t * c, nx, nz }); } };
    // round the room: north wall, east, south, west (the wall's face is the tile edge; the normal points into the room)
    side(0, 1, c, c, 1, 0); side(-1, 0, (R + 1) * c, c, 0, 1); side(0, -1, (R + 1) * c, (R + 1) * c, -1, 0); side(1, 0, c, (R + 1) * c, 0, -1);
    const list = items.slice(0, Math.min(GALLERY_MAX, slots.length));
    // spread them evenly round the room when there are fewer pictures than places
    list.forEach((it, i) => {
      const s = slots[Math.floor((i + 0.5) * slots.length / list.length)];
      const W = Math.min(1.0, c / PER_TILE - 0.3), y = o.floorY(s.x + s.nx, s.z + s.nz) + 1.52;
      // where is the wall, really? the nearest thing met by five rays from a stride inside the room
      let near = Infinity; const tx = -s.nz, tz = s.nx;
      for (const [u, v] of [[0, 0], [-0.42, 0.42], [0.42, 0.42], [-0.42, -0.42], [0.42, -0.42]]) {
        _p.set(s.x + s.nx * 1.5 + tx * u * W, y + v * W, s.z + s.nz * 1.5 + tz * u * W);
        const h = o.cast(_p, _d.set(-s.nx, 0, -s.nz), 2.4);
        if (h && h.distance < near) near = h.distance;
      }
      if (near === Infinity) near = 1.5;      // (nothing met: the tile's own edge)
      const out = 1.5 - near + 0.1;      // from the tile's edge, in or out, to just proud of the moss
      const g = new THREE.Group();
      g.position.set(s.x + s.nx * out, y, s.z + s.nz * out); g.rotation.y = Math.atan2(s.nx, s.nz);
      const back = new THREE.Mesh(this.board, this.wood); back.scale.set(W + 0.07, W + 0.07, 0.05); back.castShadow = true; back.receiveShadow = true;
      const label = `${it.set} #${it.id}`;
      const pic = new THREE.Mesh(this.plane, new THREE.MeshStandardMaterial({ map: this.paper([it.set, `#${it.id}`]), roughness: 0.62, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.16 }));
      pic.material.emissiveMap = pic.material.map; pic.scale.set(W, W, 1); pic.position.z = 0.027; pic.receiveShadow = true;
      const tag = new THREE.Mesh(this.plane, new THREE.MeshStandardMaterial({ map: this.paper([label], 512, 64, true), roughness: 0.8 }));
      tag.scale.set(0.5, 0.0625, 1); tag.position.set(0, -(W / 2 + 0.1), 0.012);
      g.add(back, pic, tag); this.group.add(g);
      const f = { group: g, back, pic, tag, item: it, label, W };
      pic.userData.frame = f; this.frames.push(f); this.pictures.push(pic);
    });
    this.load(token);
    return { hung: list.length, left: items.length - list.length };
  }
  // the pictures, four at a time, each drawn down to a size the card can hold a hundred of
  async load(token) {
    const queue = [...this.frames];
    const one = async () => {
      for (;;) {
        const f = queue.shift(); if (!f || token !== this.token) return;
        try {
          // (onload, not decode(): decode() can wait for ever in a page that is not being painted)
          const img = new Image();
          await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = f.item.img.startsWith('/') ? f.item.img : new URL('../' + f.item.img, import.meta.url).href; });
          if (token !== this.token) return;
          const k = Math.min(1, this.px / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
          const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
          const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
          const m = f.pic.material; m.map.dispose(); m.map = t; m.emissiveMap = t; m.needsUpdate = true;
          // the frame takes the picture's shape, no taller than it is wide by more than a quarter
          const a = w / h, pw = a >= 1 ? f.W : f.W * Math.max(0.75, a), ph = a >= 1 ? f.W / Math.min(1.34, a) : f.W;
          f.pic.scale.set(pw, ph, 1); f.back.scale.set(pw + 0.07, ph + 0.07, 0.05); f.tag.position.y = -(ph / 2 + 0.1);
          f.loaded = true; f.thumb = c;
        } catch { f.failed = true; }
      }
    };
    await Promise.all([one(), one(), one(), one()]);
  }
  // a click along this ray: the picture it lands on, if it is nearer than `wallDist`
  tap(raycaster, wallDist = 99) {
    if (!this.pictures.length) return null;
    const hit = raycaster.intersectObjects(this.pictures, false)[0];
    return hit && hit.distance < Math.min(9, wallDist + 0.6) ? hit.object.userData.frame : null;
  }
}
