// Lost in the Moss (the 3D moss maze): boot, the level flow, the landing page and the HUD.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { generateMaze, mulberry32, difficulty } from './maze.js?v=28138280';
import { Player, EYE } from './player.js?v=fbe5280f';
import { Canopy, Body } from './shadow.js?v=f9951dc9';
import { World } from './world.js?v=f2a7f2b3';
import { makeSky } from './sky.js?v=c9a13e42';
import { Post } from './post.js?v=284b9647';
import { Particles } from './particles.js?v=033d1e45';
import { Ambience } from './audio.js?v=012655e1';
import { records, fmtTime } from './score.js?v=9714f03d';
import { Textures, makeStrandTexture } from './materials.js?v=af31d97a';
import { locationFor, rollWeather, neededTextures } from './locations.js?v=f0992831';
import { wind } from './wind.js?v=25d38805';
import { Shoots } from './shoots.js?v=9482407b';
import { Governor } from './governor.js?v=a0d23a30';
import { Models } from './models.js?v=44ef9e0f';
import { updateWhimsy } from './whimsy.js?v=279db07e';
import { Book, drawBookIcon } from './book.js?v=710aeb13';
import { Finds } from './finds.js?v=dce826cd';
import { Satchel } from './satchel.js?v=1f7ba5bb';
import { Flashlight, TORCH_ANGLE } from './torch.js?v=e09dfa0f';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const quality = { high: params.get('q') ? params.get('q') === 'high' : !(coarse || innerWidth < 900 || (navigator.hardwareConcurrency || 8) <= 4) };
const FOG = new THREE.Color(0x8b9083);
const SUN = new THREE.Vector3(0.35, 0.8, 0.45);
// where the light comes from by the hour: the sun high through the trees, the dusk sun low, the moon lower and colder
const SUN_DAY = new THREE.Vector3(0.35, 0.8, 0.45), SUN_DUSK = new THREE.Vector3(0.6, 0.3, 0.55), SUN_NIGHT = new THREE.Vector3(0.5, 0.42, 0.62);
const sunOffset = SUN.clone().normalize().multiplyScalar(30);
const forcedTime = params.get('t');   // ?t=night | dusk | day, for looking at a place at a given hour
const startLevel = Math.max(1, parseInt(params.get('level'), 10) || 1);   // ?level=N: start in maze N, for looking at a place
const forcedSun = params.get('sun');  // ?sun=0..1: overcast to full sun, for looking at a place in a given light
// ?gen=1: the places that have an original set (grown in build/gen_*, no scans) use it instead of the Poly Haven scans
const original = params.get('gen') === '1';
const forcedSeed = params.get('seed');   // ?seed=N: the same maze and weather every load, for comparing a change
const modelsFor = l => (original && l.genModels) || l.models || [];

const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
const basePixelRatio = Math.min(devicePixelRatio, quality.high ? 1.5 : 1.0);
renderer.setPixelRatio(basePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // the post pass tone maps
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(FOG.getHex(), 0.08);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 120);

// light: an overcast forest, sun low through the trees
const hemi = new THREE.HemisphereLight(0x9aa39a, 0x332a1c, 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d2, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(quality.high ? 2048 : 1024, quality.high ? 2048 : 1024);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
sun.shadow.camera.left = sun.shadow.camera.bottom = -16; sun.shadow.camera.right = sun.shadow.camera.top = 16;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.035; sun.shadow.radius = 3;
scene.add(sun); scene.add(sun.target);

// what only the sun sees: the leaves overhead and the walker herself (shadow.js)
const canopy = new Canopy(scene);
const body = new Body(scene, EYE);

const sky = makeSky(scene, renderer, FOG, SUN);
const post = new Post(renderer, quality);
const player = new Player(camera, canvas);
const particles = new Particles(scene, quality);
// the hand torch: a camera-held spotlight after dark, once it has been found; it lights the rain and spores too
const torch = new Flashlight(scene, camera);
particles.setTorch(torch.uniforms);
const torchDirV = new THREE.Vector3();
const shoots = new Shoots(scene, quality);
const models = new Models(quality);

const ambience = new Ambience();

// the photo sets load per place: the ones this place needs before it builds, the next place's in the background
const textures = new Textures(new THREE.TextureLoader(), 'tex');
const strand = makeStrandTexture();
const world = new World(scene, textures, strand, quality, FOG, SUN);
// the governor: measured frame time decides how much detail this device gets
let shadowEvery = 1, shadowFrame = 0;
const governor = new Governor(q => {
  const pr = basePixelRatio * (0.55 + 0.45 * q);
  if (Math.abs(renderer.getPixelRatio() - pr) > 0.01) { renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight); post.setSize(innerWidth, innerHeight); }
  shoots.setQuality(q);
  world.setFuzzQuality(q);
  shadowEvery = q > 0.6 ? 1 : q > 0.3 ? 2 : 4;
  particles.setRain(state.weather ? state.weather.rain * (0.4 + 0.6 * q) : 0);
  state.qualityLevel = q;
});
renderer.shadowMap.autoUpdate = false;


// --- state
// --- settings, kept in the browser
const SETTINGS_KEY = 'moss-maze-settings-v1';
const settings = Object.assign({ sens: 1, controls: true, bob: 1 }, (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; } })());
function applySettings() {
  player.sens = settings.sens; player.bobAmount = settings.bob;
  document.body.classList.toggle('controls', !!settings.controls);
  $('#set-sens').value = settings.sens; $('#set-sens-out').textContent = settings.sens.toFixed(1);
  $('#set-bob').value = settings.bob; $('#set-bob-out').textContent = settings.bob.toFixed(1);
  $('#set-controls').checked = !!settings.controls;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage blocked */ }
}
$('#set-sens').addEventListener('input', e => { settings.sens = +e.target.value; applySettings(); });
$('#set-bob').addEventListener('input', e => { settings.bob = +e.target.value; applySettings(); });
$('#set-controls').addEventListener('change', e => { settings.controls = e.target.checked; applySettings(); });
$('#settings-open').addEventListener('click', () => setMode('settings'));
$('#settings-done').addEventListener('click', () => setMode('paused'));
// the dev notes: a page laid over the start screen or the pause screen, which is still there underneath when it closes.
// The list itself is notes.html, a page anyone can read without the word; it is read in the first time it is asked for
let notesRead = false;
function showNotes(on) {
  document.body.classList.toggle('notes', on);
  if (!on) return;
  const body = $('.notes-body'); body.scrollTop = 0;
  if (notesRead) return;
  notesRead = true;
  fetch('notes.html').then(r => r.ok ? r.text() : Promise.reject(r.status)).then(html => {
    const list = new DOMParser().parseFromString(html, 'text/html').querySelector('.notes-body');
    if (!list) throw new Error('no list');
    body.innerHTML = list.innerHTML;
  }).catch(() => { notesRead = false; body.innerHTML = '<p>the notes did not open. They are on <a href="notes.html" target="_blank" rel="noopener">their own page</a> too.</p>'; });
}
$('#notes-open').addEventListener('click', () => showNotes(true));
$('#notes-open-paused').addEventListener('click', () => showNotes(true));
$('#notes-done').addEventListener('click', () => showNotes(false));

// --- tap or click to focus: the ray through that point says how far, the lock holds until you move on
const focusLock = { dist: 0, until: 0, pos: new THREE.Vector3(), yaw: 0 };
const reticle = $('#reticle');
const focusRay = new THREE.Raycaster();
focusRay.far = 14;
function focusHit(nx, ny) {
  // everything that is drawn, except the moss shoots and fuzz layers (too many, and they sit on surfaces that are hit anyway)
  focusRay.setFromCamera(new THREE.Vector2(nx, ny), camera);
  const targets = [];
  world.group.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && o.visible && !(o.material && o.material.customProgramCacheKey && String(o.material.customProgramCacheKey()).startsWith('moss-fuzz'))) targets.push(o); });
  const hits = focusRay.intersectObjects(targets, false);
  return hits.length ? hits[0] : null;
}
player.onTap = (nx, ny, sx, sy) => {
  if (state.mode !== 'playing') return;
  const hit = focusHit(nx, ny);
  focusLock.dist = hit !== null ? hit.distance : player.focusDistance(12, nx, ny);
  if (hit) tapped(hit);
  focusLock.until = performance.now() / 1000 + 6;
  focusLock.pos.copy(player.pos); focusLock.yaw = player.yaw;
  reticle.style.left = sx + 'px'; reticle.style.top = sy + 'px';
  reticle.classList.remove('show'); void reticle.offsetWidth; reticle.classList.add('show');
};
function focusTarget(now) {
  if (focusLock.until > now && player.pos.distanceTo(focusLock.pos) < 0.9 && Math.abs(player.yaw - focusLock.yaw) < 1.0) return focusLock.dist;
  focusLock.until = 0;
  return player.focusDistance();
}

const state = { mode: 'loading', level: 1, mazeTime: 0, runTime: 0, maze: null, diff: null, loc: null, flash: 0, hud: true, lastT: performance.now() / 1000 };
governor.apply(1);

// --- the small things: what a tap does, what the frogs and the bolting animal sound like, the finds, the journal
const finds = new Finds($);
// the journal: a Book and Quill, found on the floor of the first maze (J; the pause screen; a button on phones)
const book = new Book($, {
  author: playerName,
  sound: { page: () => ambience.pageTurn(), sign: () => ambience.bookSign(), open: () => ambience.bookThump(true), close: () => ambience.bookThump(false) },
  onClose: from => { satchel.sync(book); returnTo(from); },
});
// the satchel: what the player carries, in the old inventory's panel (I; the pause screen; the bag button on phones)
const satchel = new Satchel($, {
  book,
  sound: { open: () => ambience.bookThump(true), close: () => ambience.bookThump(false), use: () => ambience.pageTurn() },
  verb: it => (it.kind === 'torch' ? (state.torchOn ? 'Switch off' : 'Switch on') : it.kind === 'written' ? 'Read' : 'Write in'),
  onClose: from => returnTo(from),
  onUse: (it, i, from) => {
    if (it.kind === 'book') { satchel.close(true); book.view = { kind: 'quill', page: book.state.quill.page }; openBook(from, true); }
    else if (it.kind === 'written') { satchel.close(true); book.view = { kind: 'read', book: it.book, page: -1 }; openBook(from, true); }
    else if (it.kind === 'torch') toggleTorch();
  },
});
function returnTo(from) { if (from === 'landing') setMode('landing'); else if (from === 'paused') setMode('paused'); else begin(); }
function openSatchel(from) {
  if (state.mode === 'satchel') return;
  const f = from || (state.mode === 'paused' ? 'paused' : state.mode === 'landing' ? 'landing' : 'playing');
  if (!['playing', 'paused', 'landing'].includes(f)) return;
  setMode('satchel');
  if (player.locked) document.exitPointerLock();
  satchel.open(f);
}
$('#satchel-open-paused').addEventListener('click', () => openSatchel('paused'));
$('#bag-btn').addEventListener('click', () => openSatchel('playing'));
function toggleTorch() { if (!torch.usable) { toast(torch.owned ? 'too bright for the torch' : 'no torch'); return; } torch.toggle(); state.torchOn = torch.on; toast(torch.on ? 'torch on' : 'torch off'); }
function playerName() {
  try { const n = localStorage.getItem('moss-maze-name'); if (n) return n; } catch { /* storage blocked */ }
  try { const s = JSON.parse(localStorage.getItem('mossquest.save') || 'null'); if (s && s.name) return String(s.name); } catch { /* no game save */ }
  return '';
}
function openBook(from, fromSatchel = false) {
  if (!book.found || state.mode === 'book') return;
  const f = from || (state.mode === 'paused' ? 'paused' : state.mode === 'landing' ? 'landing' : 'playing');
  if (!['playing', 'paused', 'landing'].includes(f)) return;
  if (!fromSatchel && state.mode === 'satchel') return;
  setMode('book');
  if (player.locked) document.exitPointerLock();
  book.open(f);
}
document.body.classList.toggle('hasbook', book.found);
satchel.sync(book);
drawBookIcon($('#book-btn-art'));
$('#book-btn').addEventListener('click', () => openBook('playing'));
function toast(text) { const t = $('#toast'); t.textContent = text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
// walking over the book on the floor picks it up
// walking up to the torch on its stump in the second maze picks it up: it goes in the satchel, and after dark it is lit
function checkTorch() {
  const t = world.whimsy && world.whimsy.torch;
  if (!t || satchel.has('torch')) return;
  if (Math.hypot(player.pos.x - t.pos.x, player.pos.z - t.pos.z) > (t.reach || 0.6)) return;
  satchel.add({ kind: 'torch' });
  world.group.remove(t.group); world.whimsy.torch = null;
  torch.setLevel(true, state.night); state.torchOn = torch.on;
  ambience.pickup();
  toast('Hand torch');
}
function checkBook() {
  const b = world.whimsy && world.whimsy.book;
  if (!b || book.found) return;
  if (Math.hypot(player.pos.x - b.pos.x, player.pos.z - b.pos.z) > (b.reach || 0.6)) return;
  book.find();
  world.group.remove(b.group); world.whimsy.book = null;
  document.body.classList.add('hasbook');
  satchel.sync(book);
  ambience.pickup();
  toast('Book and Quill');
}
const whimsyHooks = {
  frogHop: (x, z) => { if (player.pos.distanceTo(new THREE.Vector3(x, player.pos.y, z)) < 6) ambience.frogHop(false); },
  frogLand: (x, z) => { if (world.inWater(x, z)) ambience.frogHop(true); },
  // the animal bolts: hooves or pads and the brush it goes through, from its side; a sika barks first now and then
  animalBolt: (spec, pos) => {
    const dx = pos.x - player.pos.x, dz = pos.z - player.pos.z;
    const pan = Math.max(-0.8, Math.min(0.8, -Math.sin(Math.atan2(dx, dz) - player.yaw))) ;
    const d = Math.hypot(dx, dz);
    if (spec.bark && Math.random() < 0.5) ambience.call(spec.bark);
    ambience.bolt(spec.sound, pan, d, spec.heavy);
  },
  mazeTime: 0,
};
function caption(m) { $('#hud-moss').textContent = `${m.name.toLowerCase()} · ${(m.common || m.form).toLowerCase()}`; state.speciesT = -6; }
function foundFind(f) {
  if (!f || finds.isFound(f.id)) return;
  if (finds.found(f.id, state.level, state.loc.name)) ambience.call('wren');
}
// a tap on a moss cushion puffs its spores and names it; a tap on the place's find holds its drawing up
function tapped(hit) {
  const w = world;
  if (w.cushions && hit.object === w.cushions.mesh && hit.instanceId !== undefined && hit.distance < 3.5) {
    const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    particles.puff(hit.point.x, hit.point.y, hit.point.z, n.x, n.y, n.z, 22 + Math.round(22 * (1 - hit.distance / 3.5)));
    ambience.puff();
    const sp = w.cushions.species[hit.instanceId];
    if (sp) caption(sp);
  }
  const f = w.whimsy && w.whimsy.find;
  if (f && hit.object === f.mesh && hit.distance < 4) foundFind(f);
}
// walking up to the find and looking at it finds it too
function checkFind() {
  const f = world.whimsy && world.whimsy.find;
  if (!f || finds.isFound(f.id)) return;
  const d = Math.hypot(player.pos.x - f.pos.x, player.pos.z - f.pos.z);
  if (d > f.radius + 1.0) return;
  const to = f.pos.clone().sub(camera.position).normalize();
  const fwd = new THREE.Vector3(0, 0, -1).applyEuler(camera.rotation);
  if (to.dot(fwd) > 0.9) foundFind(f);
}

async function newLevel(level) {
  state.level = level; state.mazeTime = 0;
  const loc = state.loc = locationFor(level);
  const d = state.diff = difficulty(level, 0, loc);
  const rng = mulberry32(((forcedSeed ? parseInt(forcedSeed, 10) : Date.now()) ^ (level * 2654435761)) >>> 0);
  state.maze = generateMaze(d.rooms, d.rooms, rng, { braid: d.braid, zones: d.zones, straight: d.straight, room: d.room, gap: d.gap });
  const weather = state.weather = rollWeather(loc, rng);
  if (forcedTime && ['day', 'dusk', 'night'].includes(forcedTime)) Object.assign(weather, { time: forcedTime, night: forcedTime === 'night' ? 1 : forcedTime === 'dusk' ? 0.55 : 0, dusk: forcedTime === 'dusk' ? 1 : 0 });
  if (forcedSun !== null && forcedSun !== '') {
    weather.sun = Math.max(0, Math.min(1, +forcedSun || 0));
    if (weather.sun > 0.9) Object.assign(weather, { rain: 0, snow: 0, fog: 0 });   // full sun is a dry, clear day
  }
  state.night = weather.night; state.dusk = weather.dusk;
  // the light's direction is baked into every material's dapple when it is built, so it is set before the build
  SUN.copy(weather.time === 'night' ? SUN_NIGHT : weather.time === 'dusk' ? SUN_DUSK : SUN_DAY).normalize();
  // by day the sun stands somewhere new each visit: a long-shadowed morning to near midday, from any side
  if (weather.time === 'day') { const az = rng() * Math.PI * 2, el = 0.62 + rng() * 0.4; SUN.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)); }
  sunOffset.copy(SUN).multiplyScalar(30);
  sky.setSun(SUN);
  wind.strength = weather.wind;
  wind.dir.set(Math.cos(level * 1.7), 0, Math.sin(level * 1.7)).normalize();
  const next = locationFor(level + 1);
  // the book waits on a stump in the first maze until it has been found; the stump scan comes with it
  const wantBook = level === 1 && !book.found, wantTorch = level === 2 && !satchel.has('torch');
  const [scans, pedestal] = await Promise.all([models.loadAll(modelsFor(loc)), wantBook || wantTorch ? models.load('tree_stump_01') : null, textures.ensure(neededTextures(loc))]);
  world.build(state.maze, state.diff, rng, loc, weather, scans, { wantBook, wantTorch, pedestal });
  // the leaves overhead cast the flecks now, so the materials stop painting them; under cloud the shadows go soft
  canopy.setPlace(loc);
  world.dapple = canopy.active ? 0 : 1;
  sun.shadow.radius = 1.2 + 2.6 * (1 - weather.sun);
  finds.reset();
  // the next place, in the background; sets no coming place uses are let go
  textures.retain([...neededTextures(loc), ...neededTextures(next)]);
  models.loadAll(modelsFor(next));
  textures.ensure(neededTextures(next)).catch(() => {});
  player.setMaze(state.maze, state.diff.cell, state.diff.wallHeight);
  player.floorY = world.floorY;
  player.obstacles = world.obstacles;
  shoots.setWorld(world.shootWorld);
  world.setFuzzQuality(state.qualityLevel ?? 1);
  governor.settle(60);
  particles.wallHeight = state.diff.wallHeight;
  particles.setRain(weather.rain * (0.4 + 0.6 * (state.qualityLevel ?? 1)));
  particles.setSnow(weather.snow);
  // light and air of the place
  scene.fog.color.copy(FOG); sky.setPalette(FOG, loc.sky ? loc.sky.zenith : 0x2a352a, loc.sky ? loc.sky.canopy : 1, weather.night, weather.dusk); sky.setFogAmount(Math.min(0.9, weather.fog * 0.8 + weather.rain * 0.25 + weather.snow * 0.5));
  // the moon is the sun, reused: cold and dim, with a dim blue hemisphere under it; dusk is the sun gone orange and low
  sun.color.setHex(loc.light.sun);
  if (weather.time === 'night') sun.color.lerp(new THREE.Color(0xaabdf0), 0.9);
  else if (weather.time === 'dusk') sun.color.lerp(new THREE.Color(0xffa460), 0.75);
  hemi.color.setHex(loc.light.sky).lerp(new THREE.Color(weather.time === 'dusk' ? 0x5a4e62 : 0x1c2740), weather.night * 0.9);
  hemi.groundColor.setHex(loc.light.ground).lerp(new THREE.Color(0x030303), weather.night * 0.85);
  post.setHour(weather.night, weather.dusk);
  // the torch is for dusk and night visits, on by default once it is owned
  torch.setLevel(satchel.has('torch'), weather.night); state.torchOn = torch.on;
  particles.setFireflies(weather.night > 0.4 && loc.fireflies ? loc.fireflies * (weather.night > 0.8 ? 1 : 0.5) : 0, world);
  ambience.setProfile(loc.sound, loc.ground, weather);
  $('#hud-level').textContent = `MAZE ${String(level).padStart(2, '0')}`;
  $('#hud-place').textContent = loc.name;
  $('#hud-place').title = loc.place;
  const wx = [weather.time !== 'day' ? weather.time : '', weather.snow ? 'snow' : weather.rain ? 'rain' : '', weather.fog ? 'fog' : '', weather.wind > 0.5 ? 'wind' : weather.wind > 0.2 ? 'breeze' : ''].filter(Boolean).join(' · ');
  $('#hud-weather').textContent = wx;
  state.speciesIdx = 0; state.speciesT = 0;
  $('#hud-moss').textContent = '';
}

function setMode(m) {
  state.mode = m;
  document.body.dataset.mode = m;
  player.enabled = m === 'playing';
}

// --- landing / pause UI
(async () => {
  let n = 0;
  textures.onProgress = () => { $('#load').textContent = `loading the first place ${++n}`; };
  $('#load').textContent = 'loading the first place';
  try { await newLevel(startLevel); } catch (err) { console.error(err); $('#load').textContent = 'the first place would not load'; return; }
  textures.onProgress = null;   // later places load quietly: the count is only for the first
  $('#load').textContent = '';
  $('#enter').disabled = false;
  showRecords();
  setMode('landing');
  applySettings();
})();
function showRecords() {
  const r = records.get();
  $('#records').textContent = r.bestMazes ? `longest run ${r.bestMazes} maze${r.bestMazes > 1 ? 's' : ''} · longest time inside ${fmtTime(r.bestTime)}` : 'no records yet';
}
$('#enter').addEventListener('click', () => {
  ambience.start(); ambience.resume();
  records.runStarted();
  state.runTime = 0;
  if (state.mode !== 'landing') newLevel(1).then(begin); else begin();
});
$('#resume').addEventListener('click', begin);
$('#quit').addEventListener('click', async () => {
  records.runEnded(state.runTime); showRecords();
  // leaving: lie down in the moss and look up through the canopy for a few seconds, then the first place again
  setMode('leaving'); state.lieT = 0;
  await new Promise(r => setTimeout(r, 5600));
  if (state.mode !== 'leaving') return;
  await newLevel(1); player.lie = 0; setMode('landing');
});
function begin() {
  setMode('playing');
  if (!coarse) player.requestLock();
}
player.onLockChange = locked => { if (!locked && state.mode === 'playing' && !coarse) setMode('paused'); };
$('#pause').addEventListener('click', () => { if (state.mode === 'playing') setMode('paused'); });
window.addEventListener('keydown', e => {
  // nothing here while typing in the book
  if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
  // nor while the dev notes are up: escape puts them away
  if (document.body.classList.contains('notes')) { if (e.code === 'Escape') showNotes(false); return; }
  if (e.code === 'KeyJ') { if (state.mode === 'book') book.close(); else openBook(); }
  if (e.code === 'KeyI') { if (state.mode === 'satchel') satchel.close(); else openSatchel(); }
  if (e.code === 'KeyF' && state.mode === 'playing' && torch.owned) toggleTorch();
  if (state.mode === 'book' || state.mode === 'satchel') return;   // the other keys mean nothing with a panel open, wherever the focus went
  if (e.code === 'KeyH') { state.hud = !state.hud; document.body.classList.toggle('nohud', !state.hud); }
  if (e.code === 'KeyM') { ambience.setMuted(!ambience.muted); $('#mute').textContent = ambience.muted ? 'sound off' : 'sound on'; }
});
$('#mute').addEventListener('click', () => { ambience.setMuted(!ambience.muted); $('#mute').textContent = ambience.muted ? 'sound off' : 'sound on'; });
// how deep the water is under the player: the still level over the ground, or the stream's channel
function waterDepthAt(x, z) {
  if (!world.group) return 0;
  if (world.waterLevel !== null) { const d = world.waterLevel - world.floorY(x, z); if (d > 0.01) return d; }
  if (world.stream && Math.abs(z - world.stream.z) < world.stream.w / 2 + 0.1) return Math.max(0.02, world.stream.depth - 0.05);
  return 0;
}
player.stepTrigger = brisk => {
  const depth = waterDepthAt(player.pos.x, player.pos.z);
  ambience.step(brisk, depth > 0 ? 'water' : state.loc.ground, depth);
};
addEventListener('pagehide', () => { if (state.runTime > 5) records.runEnded(state.runTime); });

// --- resize
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  post.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);

// --- the exit found
function foundExit() {
  setMode('found');
  records.mazeFound(state.level, state.mazeTime);
  ambience.exitChime();
  $('#found-text').textContent = `${state.loc.name.toLowerCase()} · maze ${state.level} · ${fmtTime(state.mazeTime)}`;
  state.flashTarget = 1;
  setTimeout(async () => {
    await newLevel(state.level + 1);
    state.flashTarget = 0;
    setTimeout(() => { if (state.mode === 'found') { setMode('playing'); if (!coarse && !player.locked) player.requestLock(); } }, 900);
  }, 1500);
}

// --- loop
let landingYaw = 0;
// ?tick=timer drives the loop from a timer instead of requestAnimationFrame: for testing in a hidden pane,
// where the browser never schedules an animation frame (it is slower and uneven; never for play)
const schedule = params.get('tick') === 'timer' ? f => setTimeout(f, 16) : f => requestAnimationFrame(f);
function frame() {
  schedule(frame);
  const now = performance.now() / 1000;
  const rawDt = now - state.lastT;
  let dt = Math.min(0.05, rawDt); state.lastT = now;
  if (state.mode === 'loading') return;
  if (state.mode === 'playing') governor.tick(rawDt * 1000);
  const playing = state.mode === 'playing';
  if (playing) { state.mazeTime += dt; state.runTime += dt; }
  if (state.mode === 'paused' || state.mode === 'settings' || state.mode === 'book' || state.mode === 'satchel') dt = 0;

  // difficulty creep while the player lingers
  if (state.diff) {
    const d = difficulty(state.level, state.mazeTime / 60, state.loc);
    scene.fog.density = d.fog;
    const stay = Math.min(1, Math.max(0, state.mazeTime / 60 - 1) / 3);
    const L = state.loc.light;
    // in sun the air clears a little, the sky's fill drops and the sun is several times it: hard flecks, deep shade
    const sk = state.weather && state.weather.sun !== undefined ? state.weather.sun : 0.5;
    scene.fog.density = d.fog * state.loc.fog.mul * (1 + 0.8 * (state.weather ? state.weather.fog : 0)) * (1 - 0.25 * sk);
    // after dark: a dim hemisphere and the moon at a fraction of the sun (never nothing: the dapple has to read)
    const n = state.night || 0;
    hemi.intensity = L.hemiI * (1 - 0.25 * stay) * (1 - 0.62 * n) * (1.2 - 0.42 * sk);
    sun.intensity = L.sunI * (1 - 0.3 * stay) * (1 - 0.78 * n) * (0.55 + 1.6 * sk);
  }

  if (state.mode === 'landing') {
    // the camera idles at the start, slowly looking around
    landingYaw += dt * 0.06;
    player.yaw = player.yaw + Math.sin(now * 0.15) * 0.0008;
    player.update(dt);
  } else {
    player.update(dt);
  }

  // sun follows the player; snap to shadow texels
  const ts = 32 / sun.shadow.mapSize.x;
  const px = Math.round(player.pos.x / ts) * ts, pz = Math.round(player.pos.z / ts) * ts;
  sun.position.set(px + sunOffset.x, sunOffset.y, pz + sunOffset.z);
  sun.target.position.set(px, 0, pz);
  const ground = world.floorY ? world.floorY(player.pos.x, player.pos.z) : 0;
  canopy.update(player, ground, SUN, now);
  body.update(player, ground, dt);

  wind.update(dt);
  shoots.tick(now); shoots.update(player.pos, player.yaw);
  sky.update(now, camera);
  world.update(now);
  whimsyHooks.mazeTime = state.mazeTime;
  updateWhimsy(world.whimsy, dt, player, now, whimsyHooks);
  if (playing && (shadowFrame & 7) === 0) checkFind();
  if (playing) { checkBook(); checkTorch(); }
  if (state.mode === 'leaving') { state.lieT = Math.min(1, (state.lieT || 0) + dt / 2.6); player.lie = state.lieT; }
  // the mosses of this place, one at a time, like a caption in the footage
  if (playing && state.loc.mosses) {
    state.speciesT += dt;
    if (state.speciesT > 9) {
      state.speciesT = 0; const m = state.loc.mosses[state.speciesIdx % state.loc.mosses.length]; state.speciesIdx++;
      $('#hud-moss').textContent = `${m.name.toLowerCase()} · ${(m.common || m.form).toLowerCase()}`;
    }
  }
  particles.update(dt, player.pos);
  torch.update(dt, player, player.stepPhase, player.stride);
  post.setTorch(torch.uniforms.uTorchOn.value, torch.inScene ? torch.viewDir(torchDirV) : torchDirV, Math.cos(TORCH_ANGLE), camera, scene.fog.density);
  // the water you hear: the stream by distance, or the still water of the place when you are standing in it
  const streamDist = world.stream ? Math.abs(player.pos.z - world.stream.z) : world.waterLevel !== null ? (world.inWater(player.pos.x, player.pos.z) ? 0 : 1.6) : Infinity;
  ambience.update(dt, state.diff ? Math.min(1, (state.diff.fog - 0.07) / 0.1) : 0, streamDist, waterDepthAt(player.pos.x, player.pos.z), Math.min(1, Math.hypot(player.vel.x, player.vel.z) / player.walk));

  // autofocus on what is ahead; on the landing page keep it close and dreamy
  post.autofocus(state.mode === 'landing' ? 1.4 : state.mode === 'leaving' ? 0.6 + 6 * (state.lieT || 0) : focusTarget(now), dt || 0.016);
  post.mat.uniforms.uBlur.value = state.mode === 'landing' ? 0.004 : state.mode === 'paused' || state.mode === 'book' || state.mode === 'satchel' ? 0.006 : 0;
  state.flash += ((state.flashTarget || 0) - state.flash) * (1 - Math.exp(-dt * 3));
  post.mat.uniforms.uFlash.value = state.flash;

  // the on-screen stick follows the thumb
  if (playing && settings.controls && coarse) {
    const t = player.touch;
    const knob = $('#stick-knob'), stick = $('#stick');
    if (t.stickId !== null) { stick.style.left = (t.stickOrigin.x - 60) + 'px'; stick.style.top = (t.stickOrigin.y - 60) + 'px'; stick.style.bottom = 'auto'; knob.style.transform = `translate(${t.move.x * 36}px, ${t.move.y * 36}px)`; }
    else { knob.style.transform = 'translate(0px, 0px)'; }
  }
  if (playing) {
    const c = player.cellOf();
    if (c.x === state.maze.exit.x && c.y === state.maze.exit.y) foundExit();
    $('#hud-time').textContent = fmtTime(state.mazeTime);
  }
  // the shadow map refreshes less often when the budget is tight; the sun barely moves between frames
  if (++shadowFrame % shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
  post.render(scene, camera, now);
}
frame();

// debug handle
window.MM = { frame, state, player, world, scene, renderer, newLevel, setMode, post, quality, particles, sun, hemi, shoots, governor, textures, models, book, finds, ambience, tapped, foundFind, openBook, satchel, openSatchel, torch, toggleTorch, canopy, body };
