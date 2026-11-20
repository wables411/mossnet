// The MQ-01: the handheld from the front page of mossmossmoss.quest, as a thing Radbro can hold. The site draws it
// in CSS; this draws the same face onto a canvas from the same numbers (every measure below is the site's own,
// in its unit u = one hundredth of the device's width; see mossnet/styles.css), with the site's own pictures of
// the board behind the plastic and the grime on it, and the site's own typeface. The face is laid on a slab of the
// same see-through blue plastic, the shoulder buttons stand up from its top edge, and the screen is a separate lit
// panel that handheld.js draws.
import * as THREE from '../lib/three.module.js?v=88cddb5c';

const U = 8;                      // canvas pixels to one u
const W = 100 * U, H = Math.round(100 * U * 100 / 66);
const HU = H / U;                 // the device's height in u (about 151.5)
// the screen's place on the face, in u from the top left (the bezel is 4% in, 3.5% down, 92% by 58.5%; the screen
// sits 6u under the bezel's top edge and 3.5u over its bottom edge, 86u wide)
const BEZ = { x: 4, y: 0.035 * HU, w: 92, h: 0.585 * HU };
export const SCREEN = { x: 7, y: BEZ.y + 6, w: 86, h: BEZ.h - 9.5 };
export const SIZE = { w: 0.082, h: 0.082 * 100 / 66, d: 0.016 };   // metres: a little wider than a hand

const img = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// a CSS linear-gradient(angle, stops) across a box
function lin(g, x, y, w, h, deg, stops) {
  const a = (deg - 90) * Math.PI / 180, cx = x + w / 2, cy = y + h / 2, L = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
  const gr = g.createLinearGradient(cx - Math.cos(a) * L / 2, cy - Math.sin(a) * L / 2, cx + Math.cos(a) * L / 2, cy + Math.sin(a) * L / 2);
  for (const [t, c] of stops) gr.addColorStop(t, c);
  return gr;
}
function spaced(g, text, x, y, em) {   // letter-spacing, centred on x
  const sp = em * parseFloat(g.font), ws = [...text].map(c => g.measureText(c).width), total = ws.reduce((a, b) => a + b, 0) + sp * (text.length - 1);
  let px = x - total / 2; const al = g.textAlign; g.textAlign = 'left';
  [...text].forEach((c, i) => { g.fillText(c, px, y); px += ws[i] + sp; });
  g.textAlign = al;
}

function drawFace(g, guts, grime) {
  const u = U, KEY = '#e4e7e0', KEYD = '#b9bdb4';
  g.clearRect(0, 0, W, H);
  g.save(); rr(g, 0, 0, W, H, 4 * u); g.clip();
  // what is behind the plastic: the dark of the case, the board
  g.fillStyle = '#0d2b30'; g.fillRect(0, 0, W, H);
  if (guts) {
    const bx = 2 * u, by = 2 * u, bw = W - 4 * u, bh = H - 4 * u, s = Math.max(bw / guts.width, bh / guts.height), dw = guts.width * s, dh = guts.height * s;
    g.save(); g.beginPath(); g.rect(bx, by, bw, bh); g.clip(); g.filter = 'saturate(0.95) brightness(0.92)';
    g.drawImage(guts, bx + (bw - dw) / 2, by + (bh - dh) / 2, dw, dh); g.restore(); g.filter = 'none';
  }
  // the board's status lights, dark
  for (const [x, y] of [[31, 90], [63, 88.5], [71, 110], [24, 117.5], [84, 124]]) { g.fillStyle = '#2a2f2c'; g.beginPath(); g.arc((x + 0.7) * u, (y + 0.7) * u, 0.7 * u, 0, 6.3); g.fill(); }
  // the plastic over it: Bondi blue, lighter at the top left, the gloss, the rim
  g.fillStyle = 'rgba(36,168,192,0.2)'; g.fillRect(0, 0, W, H);
  g.fillStyle = lin(g, 0, 0, W, H, 160, [[0, 'rgba(140,230,245,0.3)'], [0.5, 'rgba(30,160,185,0.3)'], [1, 'rgba(8,90,110,0.38)']]); g.fillRect(0, 0, W, H);
  g.fillStyle = lin(g, 0, 0, W, H, 115, [[0, 'rgba(255,255,255,0.38)'], [0.2, 'rgba(255,255,255,0.1)'], [0.38, 'rgba(255,255,255,0)'], [0.68, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.14)']]); g.fillRect(0, 0, W, H);
  g.fillStyle = lin(g, 0, 0, W, H, 180, [[0, 'rgba(255,255,255,0.18)'], [0.12, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, W, H);
  // the deepening toward the edges
  for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(6,70,90,${0.45 * (1 - i / 14) * 0.22})`; g.lineWidth = (7 - i * 0.5) * u * 2; rr(g, 0, 0, W, H, 4 * u); g.stroke(); }
  g.restore();

  // screws
  for (const [x, y] of [[2.6, 2.6], [100 - 5.2, 2.6], [2.6, HU - 5.2], [100 - 5.2, HU - 5.2]]) {
    const cx = (x + 1.3) * u, cy = (y + 1.3) * u, r = 1.3 * u;
    g.fillStyle = 'rgba(0,40,50,0.45)'; g.beginPath(); g.arc(cx, cy, r + 0.25 * u, 0, 6.3); g.fill();
    const rg = g.createRadialGradient(cx - 0.3 * r, cy - 0.3 * r, 0, cx, cy, r * 1.3); rg.addColorStop(0, '#f2f4f0'); rg.addColorStop(0.7, '#a9aeab'); rg.addColorStop(1, '#7d8280');
    g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill();
    g.fillStyle = '#6b7070'; g.fillRect(cx - r, cy - 0.16 * r, 2 * r, 0.32 * r); g.fillRect(cx - 0.16 * r, cy - r, 0.32 * r, 2 * r);
  }

  // the bezel: black glass, its label and light
  const bx = BEZ.x * u, by = BEZ.y * u, bw = BEZ.w * u, bh = BEZ.h * u;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 1.4 * u; g.shadowOffsetY = 0.6 * u; g.fillStyle = '#0f1211'; rr(g, bx, by, bw, bh, 2 * u); g.fill(); g.restore();
  g.strokeStyle = '#2a2f2e'; g.lineWidth = 0.25 * u; rr(g, bx + 0.12 * u, by + 0.12 * u, bw - 0.25 * u, bh - 0.25 * u, 2 * u); g.stroke();
  g.fillStyle = '#52ff7a'; g.shadowColor = '#52ff7a'; g.shadowBlur = u; g.beginPath(); g.arc(bx + 5.2 * u, by + 3.25 * u, 0.7 * u, 0, 6.3); g.fill(); g.shadowBlur = 0;
  g.font = `${2.7 * u}px "Jersey 10", "Courier New", monospace`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#9aa3a6';
  { let px = bx + 7.3 * u; for (const c of 'MOSS QUEST') { g.fillText(c, px, by + 3.3 * u); px += g.measureText(c).width + 0.2 * 2.7 * u; } }
  // the screen's frame and its unlit ground (the lit panel lies over this)
  const sx = SCREEN.x * u, sy = SCREEN.y * u, sw = SCREEN.w * u, sh = SCREEN.h * u;
  g.fillStyle = '#050706'; g.fillRect(sx, sy, sw, sh); g.fillStyle = '#c6d19c'; g.fillRect(sx + 0.35 * u, sy + 0.35 * u, sw - 0.7 * u, sh - 0.7 * u);
  g.save(); rr(g, bx, by, bw, bh, 2 * u); g.clip(); g.fillStyle = lin(g, bx, by, bw, bh, 120, [[0, 'rgba(255,255,255,0.16)'], [0.35, 'rgba(255,255,255,0.03)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(bx, by, bw, bh); g.restore();

  // a key: the light plastic with its lit top-left edge and its foot of shadow
  const key = (x, y, w, h, r) => {
    g.fillStyle = '#8d928a'; rr(g, x, y + 0.4 * u, w, h, r); g.fill();
    g.fillStyle = lin(g, x, y, w, h, 160, [[0, KEY], [1, KEYD]]); rr(g, x, y, w, h, r); g.fill();
  };
  // the d-pad: 22u square, 6% in, 64.5% down; arms 32% wide and 36% long
  { const d = 22 * u, x = 6 * u, y = 0.645 * H, a = 0.34 * d, b = 0.32 * d, c = 0.36 * d, r = 0.8 * u;
    key(x + a, y, b, c, r); key(x + a, y + d - c, b, c, r); key(x, y + a, c, b, r); key(x + d - c, y + a, c, b, r);
    g.fillStyle = lin(g, x, y, d, d, 160, [[0, KEY], [1, KEYD]]); g.fillRect(x + a - 1, y + a - 1, b + 2, b + 2);
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.3 * u; g.beginPath(); g.moveTo(x + a + 0.15 * u, y + c); g.lineTo(x + a + 0.15 * u, y + 0.15 * u + r * 0.3); g.lineTo(x + a + b - r * 0.3, y + 0.15 * u); g.stroke(); g.beginPath(); g.moveTo(x + 0.15 * u, y + a + b); g.lineTo(x + 0.15 * u, y + a + 0.15 * u); g.lineTo(x + c, y + a + 0.15 * u); g.stroke();
  }
  // X Y A B: 8.6u rounds in a 26u square, 5% in from the right, 63% down
  { const box = 26 * u, x0 = W - 5 * u - box, y0 = 0.63 * H, d = 8.6 * u, r = d / 2;
    g.font = `${3.6 * u}px "Jersey 10", "Courier New", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [cx, cy, l] of [[x0 + box / 2, y0 + r, 'X'], [x0 + r, y0 + box / 2, 'Y'], [x0 + box - r, y0 + box / 2, 'A'], [x0 + box / 2, y0 + box - r, 'B']]) {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(cx, cy + 0.9 * u, r, 0, 6.3); g.fill();
      g.fillStyle = '#8d928a'; g.beginPath(); g.arc(cx, cy + 0.5 * u, r, 0, 6.3); g.fill();
      const rg = g.createRadialGradient(cx - 0.3 * r, cy - 0.4 * r, 0, cx - 0.3 * r, cy - 0.4 * r, r * 1.5); rg.addColorStop(0, '#f5f7f2'); rg.addColorStop(0.55, KEY); rg.addColorStop(1, KEYD);
      g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill();
      g.fillStyle = '#3a3f38'; g.fillText(l, cx, cy + 0.2 * u);
    }
  }
  // the middle: the speaker's holes, SELECT and START, CONNECT
  { const cx = W / 2; let y = 0.65 * H;
    g.fillStyle = 'rgba(10,40,50,0.85)'; for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(cx + (i - 3.5) * 1.9 * u, y + (j + 0.35) * 1.9 * u, 0.55 * u, 0, 6.3); g.fill(); }
    y += 7 * u + 2.2 * u;
    const pill = (x, yy, w) => { g.fillStyle = '#8d928a'; rr(g, x, yy + 0.4 * u, w, 3 * u, 1.5 * u); g.fill(); g.fillStyle = lin(g, x, yy, w, 3 * u, 180, [[0, '#f2f4ef'], [1, KEYD]]); rr(g, x, yy, w, 3 * u, 1.5 * u); g.fill(); };
    const label = (t, x, yy) => { g.font = `${2.4 * u}px "Jersey 10", "Courier New", monospace`; g.textBaseline = 'top'; g.shadowColor = 'rgba(0,40,50,0.6)'; g.shadowBlur = 0.4 * u; g.shadowOffsetY = 0.2 * u; g.fillStyle = 'rgba(255,255,255,0.75)'; spaced(g, t, x, yy, 0.14); g.shadowBlur = 0; g.shadowOffsetY = 0; };
    pill(cx - 1.5 * u - 9 * u, y, 9 * u); pill(cx + 1.5 * u, y, 9 * u);
    label('SELECT', cx - 6 * u, y + 3.7 * u); label('START', cx + 6 * u, y + 3.7 * u);
    y += 3 * u + 0.7 * u + 2.9 * u + 2.2 * u;
    pill(cx - 7 * u, y, 14 * u); label('CONNECT', cx, y + 3.7 * u);
  }
  // the two sticks
  for (const x of [10, 100 - 10 - 13]) {
    const d = 13 * u, cx = x * u + d / 2, cy = 0.855 * H + d / 2, r = d / 2;
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(cx, cy + 0.8 * u, r + 0.3 * u, 0, 6.3); g.fill();
    g.fillStyle = '#2b2e2c'; g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill();
    g.fillStyle = '#1d201e'; g.beginPath(); g.arc(cx, cy - 0.05 * r, r * 0.63, 0, 6.3); g.fill();
    g.fillStyle = '#4a4e4b'; g.beginPath(); g.arc(cx, cy - 0.1 * r, r * 0.35, 0, 6.3); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.5 * u; g.beginPath(); g.arc(cx, cy, r - 0.25 * u, 0, 6.3); g.stroke();
  }
  // its name
  g.font = `${2.4 * u}px "Jersey 10", "Courier New", monospace`; g.textBaseline = 'top'; g.textAlign = 'center'; g.shadowColor = 'rgba(0,40,50,0.6)'; g.shadowBlur = 0.4 * u; g.fillStyle = 'rgba(255,255,255,0.7)';
  spaced(g, 'MOSS QUEST · MQ-01', W / 2, 0.954 * H, 0.22); g.shadowBlur = 0;
  // the rim of the plastic, and the grime settled on it
  g.strokeStyle = 'rgba(200,245,255,0.55)'; g.lineWidth = 0.35 * u; rr(g, 0.18 * u, 0.18 * u, W - 0.36 * u, H - 0.36 * u, 4 * u); g.stroke();
  if (grime) { g.save(); rr(g, 0, 0, W, H, 4 * u); g.clip(); g.globalAlpha = 0.35; g.globalCompositeOperation = 'multiply'; const t = 30 * u; for (let y = 0; y < H; y += t) for (let x = 0; x < W; x += t) g.drawImage(grime, x, y, t, t); g.restore(); }
}

// the device: { group, screen }. group is centred, upright (y up), its face to +z, in metres
export function buildMQ01() {
  const { w, h, d } = SIZE, group = new THREE.Group();
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d'), tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  let guts = null, grime = null;
  const paint = () => { drawFace(g, guts, grime); tex.needsUpdate = true; };
  paint();
  Promise.all([img('models/hands/guts.webp'), img('models/hands/grime.webp')]).then(([a, b]) => { guts = a; grime = b; paint(); });
  try { const f = new FontFace('Jersey 10', 'url(fonts/Jersey10-Regular.woff2)'); f.load().then(ff => { document.fonts.add(ff); paint(); }, () => {}); } catch { /* an old browser: the fallback face */ }
  // the slab of blue plastic, its corners rounded as the face's are
  const r = 0.04 * w, shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2); shape.lineTo(w / 2 - r, -h / 2); shape.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0); shape.lineTo(w / 2, h / 2 - r); shape.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2);
  shape.lineTo(-w / 2 + r, h / 2); shape.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI); shape.lineTo(-w / 2, -h / 2 + r); shape.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5);
  const bev = 0.0018, slabGeo = new THREE.ExtrudeGeometry(shape, { depth: d - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 3, curveSegments: 8 });
  slabGeo.translate(0, 0, -(d - bev * 2) / 2);
  group.add(new THREE.Mesh(slabGeo, new THREE.MeshStandardMaterial({ color: 0x1c7f93, roughness: 0.28, metalness: 0.05 })));
  // the face, a hair proud of the slab; its rounded corners are the picture's own
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.35, metalness: 0 }));
  face.position.z = d / 2 + 0.0002; group.add(face);
  // the shoulder buttons: 22u wide, 7u in from each side, standing 1.8u over the top edge
  const keyMat = new THREE.MeshStandardMaterial({ color: 0xdfe2db, roughness: 0.5 });
  for (const side of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.22 * w, 0.042 * w, d * 0.5), keyMat);
    b.position.set(side * (w / 2 - 0.07 * w - 0.11 * w), h / 2 - 0.003 * w, -d * 0.12); group.add(b);
  }
  // the screen: lit, a hair proud of the face; dimmed, since the camera pass brightens it back to the site's LCD green
  const screen = new THREE.Mesh(new THREE.PlaneGeometry((SCREEN.w - 0.7) / 100 * w, (SCREEN.h - 0.7) / 100 * w), new THREE.MeshBasicMaterial({ color: 0x9a9a9a, toneMapped: false }));
  screen.position.set((SCREEN.x + SCREEN.w / 2 - 50) / 100 * w, h / 2 - (SCREEN.y + SCREEN.h / 2) / 100 * w, d / 2 + 0.0004);
  group.add(screen);
  return { group, screen };
}
