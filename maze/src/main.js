// Lost in the Moss (the 3D moss maze): boot, the level flow, the landing page and the HUD.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { generateMaze, mulberry32, difficulty } from './maze.js?v=ecf6f975';
import { Player, EYE } from './player.js?v=ecf6f975';
import { Canopy, Body } from './shadow.js?v=ecf6f975';
import { World } from './world.js?v=ecf6f975';
import { makeSky } from './sky.js?v=ecf6f975';
import { Post } from './post.js?v=ecf6f975';
import { Particles } from './particles.js?v=ecf6f975';
import { Ambience } from './audio.js?v=ecf6f975';
import { records, fmtTime } from './score.js?v=ecf6f975';
import { Textures, makeStrandTexture } from './materials.js?v=ecf6f975';
import { locationFor, rollWeather, neededTextures, LOCATIONS } from './locations.js?v=ecf6f975';
import { wind } from './wind.js?v=ecf6f975';
import { Shoots } from './shoots.js?v=ecf6f975';
import { Governor } from './governor.js?v=ecf6f975';
import { Models } from './models.js?v=ecf6f975';
import { updateWhimsy } from './whimsy.js?v=ecf6f975';
import { Book, drawBookIcon } from './book.js?v=ecf6f975';
import { Finds, FINDS, FIND_ORDER } from './finds.js?v=ecf6f975';
import { Satchel } from './satchel.js?v=ecf6f975';
import { Flashlight, TORCH_ANGLE } from './torch.js?v=ecf6f975';
import { Hands, POSES, HOLD, LIGHT, MOTION } from './hands.js?v=ecf6f975';
import { Handheld, remiliaToken } from './handheld.js?v=ecf6f975';
import { mountReport } from '../report.js?v=4934f950';
import { Beetles, SurfaceGrid, beetleOf, beetlePic, beetleGirl, RARITY } from './beetles.js?v=ecf6f975';
import { Cloud } from './cloud.js?v=ecf6f975';
import { Gallery, galleryWallets, galleryList, galleryRoom, seedOf, shortWallet, GALLERY_MAX } from './gallery.js?v=ecf6f975';

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
const wakes = params.get('wake') !== '0';   // ?wake=0: straight into the maze, without the waking-up
const tiltShift = params.get('tilt') !== '0';   // ?tilt=0: the camera without its tilt-shift, to compare
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
if (!tiltShift) { post.mat.uniforms.uTilt.value = 0; post.tiltBase = 0; }
const player = new Player(camera, canvas);
const particles = new Particles(scene, quality);
// the hand torch: a camera-held spotlight after dark, once it has been found; it lights the rain and spores too
const torch = new Flashlight(scene, camera);
particles.setTorch(torch.uniforms);
const torchDirV = new THREE.Vector3(), torchPosV = new THREE.Vector3(), torchSrc = { pos: new THREE.Vector3(), dir: new THREE.Vector3(), w: 0 };
// Radbro's own hands in front of the camera, and what they hold: the torch, a cigarette, the handheld (hands.js)
const hands = new Hands(scene, camera);
hands.scene.userData.h = innerHeight;
// the handheld's screen is RemiliaNET's global chat (handheld.js); ?chat=demo: a made-up feed, to try the device
const handheld = new Handheld({ demo: params.get('chat') === 'demo', input: $('#chat-in') });
hands.setScreen(handheld.texture);
const shoots = new Shoots(scene, quality);
const models = new Models(quality);

const ambience = new Ambience();

// the photo sets load per place: the ones this place needs before it builds, the next place's in the background
const textures = new Textures(new THREE.TextureLoader(), 'tex');
const strand = makeStrandTexture();
const world = new World(scene, textures, strand, quality, FOG, SUN);
// the governor: measured frame time decides how much detail this device gets
let shadowEvery = 1, shadowFrame = 0;
const probePixel = new Uint8Array(4);
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
const settings = Object.assign({ sens: 1, controls: true, bob: 1, asmr: true }, (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; } })());
function applySettings() {
  player.sens = settings.sens; player.bobAmount = settings.bob;
  if (settings.look === undefined) settings.look = !!settings.controls;   // an older save hid both with the one switch
  document.body.classList.toggle('controls', !!settings.controls);
  document.body.classList.toggle('lookui', !!settings.look);
  $('#set-sens').value = settings.sens; $('#set-sens-out').textContent = settings.sens.toFixed(1);
  $('#set-bob').value = settings.bob; $('#set-bob-out').textContent = settings.bob.toFixed(1);
  $('#set-controls').checked = !!settings.controls; $('#set-look').checked = !!settings.look;
  $('#set-asmr').checked = settings.asmr !== false; ambience.setAsmr(settings.asmr !== false);
  $('#set-clean').checked = !!settings.clean; document.body.classList.toggle('nohud', !!settings.clean);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage blocked */ }
}
$('#set-sens').addEventListener('input', e => { settings.sens = +e.target.value; applySettings(); });
$('#set-bob').addEventListener('input', e => { settings.bob = +e.target.value; applySettings(); });
$('#set-controls').addEventListener('change', e => { settings.controls = e.target.checked; applySettings(); });
$('#set-look').addEventListener('change', e => { settings.look = e.target.checked; applySettings(); });
$('#set-asmr').addEventListener('change', e => { settings.asmr = e.target.checked; applySettings(); });
$('#set-clean').addEventListener('change', e => { settings.clean = e.target.checked; applySettings(); });
$('#settings-open').addEventListener('click', () => setMode('settings'));
$('#settings-done').addEventListener('click', () => setMode('paused'));
// the dev notes: the board of comments, suggestions, requests and ideas (notes.js, the same board as on its own page),
// laid over the start screen or the pause screen, which is still there underneath when it closes.
// From here a note can carry what the camera sees: the frame is drawn again and read off the canvas in the same breath
let board = null;
function cameraShot(type = 'image/jpeg') {
  post.render(scene, camera, performance.now() / 1000, hands.visible ? hands : null);
  return new Promise(done => canvas.toBlob(done, type, 0.85));
}
// P: the picture as the camera has it this instant (the scene and the hands, none of the display over it), copied
// to the clipboard as an image, with the game left running: no menu comes up, nothing is paused
function snap() {
  const shot = cameraShot('image/png');
  // it is seen and heard to have been taken, clean screen or not: a blink of the picture and the shutter
  const fl = $('#shutter'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); ambience.shutter();
  // where the browser will not give up its clipboard, the picture is saved as a file instead
  const keep = () => shot.then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `lost-in-the-moss-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast('picture saved to your downloads'); });
  if (!navigator.clipboard || !window.ClipboardItem) { keep(); return; }
  navigator.clipboard.write([new ClipboardItem({ 'image/png': shot })]).then(() => { ambience.pickup(); toast('picture copied'); }, keep);
}
function showNotes(on) {
  document.body.classList.toggle('notes', on);
  if (!on) return;
  if (board) board.refresh(); else board = mountReport($('.report-box'), { capture: () => cameraShot('image/jpeg'), onClose: () => showNotes(false) });
}
$('#notes-open').addEventListener('click', () => showNotes(true));
$('#notes-open-paused').addEventListener('click', () => showNotes(true));

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
  if (hands.knife.out) { hands.knife.ask('slash'); return; }        // with the razor out a click is a cut
  const hit = focusHit(nx, ny);
  const bug = beetles.tap(focusRay.ray);
  focusLock.dist = hit !== null ? hit.distance : player.focusDistance(12, nx, ny);
  const frame = !bug && state.gallery ? gallery.tap(focusRay, hit ? hit.distance : 99) : null;
  if (bug) caughtBug(bug); else if (frame) showPicture(frame); else if (hit) { tapped(hit); touched(hit, nx, sx, sy); }
  focusLock.until = performance.now() / 1000 + 9;
  post.rack = 1;                       // the lens racks over: a moment's blur, then the tapped thing comes up sharp
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
  sound: { open: () => ambience.satchelSound(true), close: () => ambience.satchelSound(false), use: () => ambience.cloth(true), tab: () => ambience.pageTurn() },
  // what is in his hands now; choosing one puts it away
  held: () => [
    hands.holding('device') && { kind: 'device', name: 'Handheld', where: 'left hand', verb: 'Put away' },
    hands.holding('torch') && { kind: 'torch', name: 'Hand torch', where: 'right hand, lit', verb: 'Switch off' },
    hands.holding('cig') && { kind: 'cigs', name: 'Cigarette', where: 'lit', verb: 'Put out' },
    hands.knife.out && { kind: 'razor', name: 'Barber\'s razor', where: 'right hand, open', verb: 'Put away' },
  ].filter(Boolean),
  stats: () => {
    const r = records.get(), fast = r.fastest && r.fastest[state.level];
    return [
      ['This walk'], ['Maze', state.level], ['Place', state.loc ? state.loc.name : '-'], ['Time in this maze', fmtTime(state.mazeTime)], ['Time since you came in', fmtTime(state.runTime)],
      ['Finds this walk', `${[...finds.seen].length}`], ['Finds on all walks', `${new Set([...Object.keys(finds.ever), ...finds.seen]).size}`], ['Bugs in the book', `${beetles.book.count()}/${beetles.book.total()}`], ['Things carried', `${satchel.count()}`],
      ['Saved'], [cloud.status.text || 'on this device', ''],
      ['All walks'], ['Walks begun', r.runs || 0], ['Deepest maze reached', r.bestMazes || 0], ['Longest time inside', fmtTime(r.bestTime || 0)], [`Fastest out of maze ${state.level}`, fast ? fmtTime(fast) : '-'],
    ];
  },
  // one small true thing hidden in each place, and the Radbros grown into the walls: red until found, green after
  finds: () => {
    const places = FIND_ORDER.map(id => { const L = LOCATIONS.find(l => l.id === id), got = finds.wasFound(id); return { id, found: got, name: got ? FINDS[id].title : (L ? L.name : id) }; });
    const bros = [...new Set([...Object.keys(finds.ever), ...finds.seen])].filter(id => String(id).startsWith('radbro')).map(id => ({ id, found: true, name: `Radbro, maze ${String(id).split(':')[1]}` }));
    return [...places, ...bros];
  },
  onFind: id => { satchel.close(); finds.show(id, 'from the satchel'); },
  bugs: () => beetles.book.list(),
  onBug: id => { satchel.close(); showBug(id, 'from the bug book'); },
  options: () => [
    { label: 'Sound', value: ambience.muted ? 'Off' : 'On', run: () => { ambience.setMuted(!ambience.muted); $('#mute').textContent = ambience.muted ? 'sound off' : 'sound on'; } },
    { label: '3D sound', value: settings.asmr !== false ? 'On' : 'Off', run: () => { settings.asmr = settings.asmr === false; applySettings(); } },
    { label: 'Clean screen', value: settings.clean ? 'On' : 'Off', run: () => { settings.clean = !settings.clean; applySettings(); } },
    { label: 'Journal', value: 'Open', run: () => { if (!book.found) { satchel.say('You have not found the book yet.'); return; } const f = satchel.from; satchel.close(true); openBook(f, true); } },
    { label: 'All settings', value: 'Open', run: () => { satchel.close(true); setMode('settings'); } },
    { label: 'Report a bug or an idea', value: 'Open', run: () => { satchel.close(true); showNotes(true); } },
  ],
  verb: it => (it.kind === 'razor' ? (hands.knife.out ? 'Put away' : 'Draw') : it.kind === 'torch' ? (state.torchOn ? 'Switch off' : 'Switch on') : it.kind === 'written' ? 'Read' : it.kind === 'cigs' || it.kind === 'lighter' ? (hands.holding('cig') ? 'Put out' : it.kind === 'lighter' ? 'Light one' : 'Smoke') : it.kind === 'device' ? (!hands.holding('device') ? 'Take out' : 'Put away') : 'Write in'),
  onClose: from => returnTo(from),
  onUse: (it, i, from) => {
    if (it.kind === 'book') { satchel.close(true); book.view = { kind: 'quill', page: book.state.quill.page }; openBook(from, true); }
    else if (it.kind === 'written') { satchel.close(true); book.view = { kind: 'read', book: it.book, page: -1 }; openBook(from, true); }
    else if (it.kind === 'torch') { toggleTorch(); if (satchel.isOpen) satchel.drawPage(); }
    else if (it.kind === 'cigs' || it.kind === 'lighter') { toggleSmoke(); satchel.close(); }
    else if (it.kind === 'device') { toggleDevice(); satchel.close(); }
    else if (it.kind === 'razor') { toggleRazor(); satchel.close(); }
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
function toggleTorch() { if (!torch.on && hands.knife.out) toggleRazor(); if (!torch.usable) { toast(torch.owned ? 'too bright for the torch' : 'no torch'); return; } torch.toggle(); state.torchOn = torch.on; ambience.torchClick(torch.on); toast(torch.on ? 'torch on' : 'torch off'); }
// the razor: R draws it and puts it away; a click cuts, the right button is the heavy cut, G looks it over. It is
// the right hand's, as the torch is, so the one puts the other away.
function toggleRazor() {
  if (!satchel.has('razor')) { toast('no razor'); return; }
  const on = !hands.knife.out;
  if (on && torch.on) toggleTorch();
  hands.set('razor', on);
}
player.onAlt = () => { if (state.mode === 'playing' && hands.knife.out) hands.knife.ask('heavy'); };
addEventListener('contextmenu', e => { if (state.mode === 'playing') e.preventDefault(); });
// what a cut meets: whatever is within arm's reach straight ahead answers as a touch does
hands.knife.onEvent = (name, move) => {
  if (name === 'cloth') { ambience.cloth(); return; }
  if (name !== 'hit') { ambience.razor(name); return; }
  const hit = focusHit(0, -0.05);
  if (hit && hit.distance < (move === 'heavy' ? 1.5 : 1.25)) { tapped(hit); touched(hit, 0, innerWidth / 2, innerHeight / 2); state.flash = Math.max(state.flash || 0, 0); }
};
// (For testing the hands the razor was in the satchel from the start, 2026-11-18. Taken out for the live game
// 2026-11-19: nothing in the mazes gives one yet, so it is only in satchels that already hold it.)
// the handheld is his from the start
if (!satchel.has('device')) satchel.add({ kind: 'device' });
// (For testing, cigarettes and a lighter were given from the start, 2026-11-16. Taken out for the live game
// 2026-11-19: they are found on a stump from maze 3 on.)
function toggleDevice() {
  const on = !hands.holding('device');
  hands.set('device', on); handheld.show(on);
  hands.deviceUp = hands.holding('device');   // taken out is held up to be read: there is no half-way
  ambience.deviceOut(on);
}
handheld.onType = on => { hands.deviceUp = hands.holding('device'); if (on) player.keys.clear(); };
handheld.onTab = dir => { handheld.nextPage(dir); ambience.pageTurn(); };
handheld.onSay = () => ambience.sendChime();
handheld.onEmpty = () => { if (coarse && hands.holding('device')) toggleDevice(); };   // on a phone an empty message puts it away
// a cigarette out of the pack and lit, or the one in hand put out
function toggleSmoke() {
  if (hands.holding('cig')) { hands.set('cig', false); ambience.cloth(); toast('put out'); return; }
  const i = satchel.slots.findIndex(s => s && s.kind === 'cigs');
  if (i < 0) { toast('nothing to smoke'); return; }
  if (!satchel.has('lighter')) { toast('nothing to light it with'); return; }
  if (!hands.set('cig', true)) { toast('hands full'); return; }
  ambience.cloth();
  const it = satchel.slots[i]; it.n = (it.n ?? 20) - 1;
  if (it.n <= 0) { satchel.remove(i); toast('the last one'); } else { satchel.save(); satchel.render(); toast(`${it.n} left in the pack`); }
}
hands.onStub = () => toast('smoked down to the filter');
// the phone's buttons for what the keys do: each shows only when it has something to do
const acts = { razor: $('#act-razor'), heavy: $('#act-heavy'), inspect: $('#act-inspect'), torch: $('#act-torch'), smoke: $('#act-smoke'), device: $('#act-device'), page: $('#act-page'), write: $('#act-write'), snap: $('#act-snap') };
acts.torch.addEventListener('click', () => { if (state.mode === 'playing') toggleTorch(); });
acts.smoke.addEventListener('click', () => { if (state.mode === 'playing') toggleSmoke(); });
acts.device.addEventListener('click', () => { if (state.mode === 'playing') toggleDevice(); });
acts.page.addEventListener('click', () => { if (state.mode === 'playing' && hands.holding('device')) { handheld.nextPage(); hands.deviceUp = true; ambience.pageTurn(); } });
acts.write.addEventListener('click', () => { if (state.mode === 'playing' && hands.holding('device')) handheld.type(true); });
acts.snap.addEventListener('click', () => snap());
acts.razor.addEventListener('click', () => { if (state.mode === 'playing') toggleRazor(); });
acts.heavy.addEventListener('click', () => { if (state.mode === 'playing') hands.knife.ask('heavy'); });
acts.inspect.addEventListener('click', () => { if (state.mode === 'playing') hands.knife.ask('inspect'); });
function showActs() {
  acts.razor.classList.toggle('on', satchel.has('razor')); acts.razor.classList.toggle('lit', hands.knife.out);
  const out = hands.holding('device');
  acts.heavy.classList.toggle('on', hands.knife.out && !out); acts.inspect.classList.toggle('on', hands.knife.out && !out);   // not while the handheld is up: its own buttons need the room
  acts.torch.classList.toggle('on', torch.usable); acts.torch.classList.toggle('lit', torch.lit);
  acts.smoke.classList.toggle('on', satchel.has('cigs') && satchel.has('lighter') || hands.holding('cig')); acts.smoke.classList.toggle('lit', hands.holding('cig'));
  acts.device.classList.toggle('on', true); acts.device.classList.toggle('lit', out);
  acts.page.classList.toggle('on', out); acts.write.classList.toggle('on', out && handheld.page === 'chat');
  acts.snap.classList.toggle('on', true);
}
hands.onStrike = () => ambience.lighter();
hands.onSound = name => {
  if (name === 'lid') ambience.lighterOpen(); else if (name === 'lidShut') ambience.lighterClose();
  else if (name === 'firstDraw') ambience.crackle(0.9, 0.8); else if (name === 'draw') ambience.crackle(2.0, 1);
  else if (name === 'exhale') ambience.exhale(2.8); else if (name === 'ash') ambience.ashTap();
};
handheld.onKey = () => ambience.keyBlip();
// walking up to a pack of cigarettes picks it up
function checkCigs() {
  const t = world.whimsy && world.whimsy.cigs;
  if (!t || satchel.has('cigs')) return;
  if (Math.hypot(player.pos.x - t.pos.x, player.pos.z - t.pos.z) > (t.reach || 0.6)) return;
  if (satchel.add({ kind: 'cigs', n: 20 }) < 0) return;
  if (!satchel.has('lighter')) satchel.add({ kind: 'lighter' });   // the lighter lies with the pack
  world.group.remove(t.group); world.whimsy.cigs = null;
  ambience.pickup();
  toast(coarse ? 'Cigarettes and a lighter' : 'Cigarettes and a lighter · C to smoke');
}
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
// --- the bugs of Beetleboy (beetles.js)
// the solid things only: walls, floor, banks. No leaves or hanging moss (cut-out cards), no fuzz layers, nothing instanced or walking
function solidMeshes() {
  const out = [];
  world.group.traverse(o => { const m = o.material; if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.visible && m && !Array.isArray(m) && !m.transparent && !(m.alphaTest > 0) && !(m.customProgramCacheKey && String(m.customProgramCacheKey()).startsWith('moss-fuzz')) && o.geometry && o.geometry.attributes.position && o.geometry.attributes.position.count > 600) { o.updateWorldMatrix(true, false); out.push(o); } });
  return out;
}
// is something else (a moss cushion, a fern, a boulder) between the eye and that spot? One ray against everything the grid does not hold, about a millisecond
const bugRay = new THREE.Raycaster();
function bugBlocked(eye, point) {
  if (!world._bugOthers) { const solid = new Set(solidMeshes()); const o = world._bugOthers = []; world.group.traverse(m => { if ((m.isMesh || m.isInstancedMesh) && m.visible && !solid.has(m) && !m.isSkinnedMesh && !(m.material && m.material.customProgramCacheKey && String(m.material.customProgramCacheKey()).startsWith('moss-fuzz'))) o.push(m); }); }
  const d = point.clone().sub(eye), L = d.length();
  bugRay.set(eye, d.normalize()); bugRay.far = L - 0.03;
  return bugRay.intersectObjects(world._bugOthers, false).length > 0;
}
// the depth of the picture just drawn, at a handful of spots, read back in one go: so a beetle can sit on what is seen
const bugProbe = (() => {
  const N = 40, rtp = new THREE.WebGLRenderTarget(N, 1, { depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const uvs = Array.from({ length: N }, () => new THREE.Vector2(-1, -1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { tDepth: { value: null }, uUv: { value: uvs } }, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tDepth; uniform vec2 uUv[${N}];
      void main() {
        int i = int(gl_FragCoord.x); vec2 uv = uUv[0];
        for (int k = 0; k < ${N}; k++) { if (k == i) uv = uUv[k]; }
        float d = clamp(texture2D(tDepth, uv).x, 0.0, 0.99999994);
        vec4 e = fract(d * vec4(1.0, 255.0, 65025.0, 16581375.0)); e -= e.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
        gl_FragColor = e;
      }`,
  });
  const sc = new THREE.Scene(), cm = new THREE.Camera(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; sc.add(quad);
  const px = new Uint8Array(N * 4), out = new Float32Array(N);
  return {
    N,
    read(uv) {
      const n = Math.min(N, uv.length >> 1);
      for (let i = 0; i < N; i++) uvs[i].set(i < n ? uv[i * 2] : -1, i < n ? uv[i * 2 + 1] : -1);
      mat.uniforms.tDepth.value = post.rt.depthTexture;
      const was = renderer.getRenderTarget();
      renderer.setRenderTarget(rtp); renderer.render(sc, cm); renderer.readRenderTargetPixels(rtp, 0, 0, N, 1, px); renderer.setRenderTarget(was);
      for (let i = 0; i < n; i++) out[i] = px[i * 4] / 255 + px[i * 4 + 1] / 65025 + px[i * 4 + 2] / 16581375 + px[i * 4 + 3] / 4228250625;
      return out;
    },
  };
})();
const beetles = new Beetles({ scene, camera, meshes: solidMeshes, blocked: bugBlocked, probe: bugProbe, max: quality.high ? 5 : 3, water: (x, z) => waterDepthAt(x, z), puff: (x, y, z, nx, ny, nz, n) => particles.puff(x, y, z, nx, ny, nz, n) });
// hold a bug's page up: its picture, its name, what the wiki says of it
const bugImgs = {}, girlImgs = {};
function showBug(id, sub) {
  const sp = beetleOf(id); if (!sp) return;
  const R = RARITY[sp.rarity];
  const img = bugImgs[id] || (bugImgs[id] = Object.assign(new Image(), { src: beetlePic(id) }));
  // her portrait beside it, where the wiki has one: she stands at the left, the beetle at her feet to the right
  const gsrc = beetleGirl(id), girl = gsrc ? (girlImgs[id] || (girlImgs[id] = Object.assign(new Image(), { src: gsrc }))) : null;
  finds.card({
    title: sp.name, sub: sub || `${R.name} · bug book ${beetles.book.count()}/${beetles.book.total()}`, note: sp.desc, latin: sp.latin, color: R.color, h: girl ? 212 : 160,
    draw: (ctx, w, h) => {
      const ok = im => im && im.complete && im.naturalWidth;
      const put = () => {
        ctx.clearRect(0, 0, w, h);
        if (ok(girl)) {
          const gh = h - 4, gw = gh * girl.naturalWidth / girl.naturalHeight;
          ctx.drawImage(girl, 2, 2, gw, gh);
          if (ok(img)) { const s = Math.min(w - gw - 8, 84); ctx.drawImage(img, w - s - 1, h - s - 4, s, s); }
        } else if (ok(img)) { const s = Math.min(w, h) - 14; ctx.drawImage(img, (w - s) / 2, (h - s) / 2, s, s); }
      };
      put();
      for (const im of [img, girl]) if (im && !ok(im)) im.addEventListener('load', put, { once: true });
    },
  });
}
function caughtBug(sp) {
  const first = beetles.book.add(sp.id);
  ambience.pickup();
  cloud.touch();
  if (first) showBug(sp.id); else toast(`${sp.name.toLowerCase()} · already in the bug book`);
}
function caption(m) { $('#hud-moss').textContent = `${m.name.toLowerCase()} · ${(m.common || m.form).toLowerCase()}`; state.speciesT = -6; }
function foundFind(f) {
  if (!f || finds.isFound(f.id)) return;
  if (finds.found(f.id, state.level, state.loc.name)) ambience.call('wren');
}
// Anything within arm's reach answers a tap with its own small sound, from where it was touched (asmr.js touch):
// moss gives, stone knocks, bark is hollow, water plips. What it is, is read from what was hit: the still water and
// the ground by the place's own ground, a bank by the moss or bare rock at that spot, brick in the tunnels, wood
// for a wall of logs, bark for a trunk or anything else standing.
// Is it moss there? Asked of the picture itself: the frame is drawn once more without the hands and the colour
// under the finger is read. Green is moss (or a leaf); anything else is the bare thing.
function looksGreen(sx, sy) {
  try {
    renderer.setRenderTarget(null);
    post.render(scene, camera, performance.now() / 1000, null);
    const gl = renderer.getContext(), r = renderer.domElement.getBoundingClientRect();
    const x = Math.round((sx - r.left) / r.width * gl.drawingBufferWidth), y = Math.round((1 - (sy - r.top) / r.height) * gl.drawingBufferHeight);
    const px = new Uint8Array(4 * 49); gl.readPixels(Math.max(0, x - 3), Math.max(0, y - 3), 7, 7, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let R = 0, G = 0, B = 0; for (let i = 0; i < px.length; i += 4) { R += px[i]; G += px[i + 1]; B += px[i + 2]; }
    return G > R * 1.3 && G > B * 1.55;   // (measured: moss is about 1.4-1.6 and 1.7-2.1, the rock under this green light 1.2 and 1.3)
  } catch { return false; }
}
function touched(hit, nx = 0, sx = innerWidth / 2, sy = innerHeight / 2) {
  if (hit.distance > 2.6) return;   // (the ground at the walker's own feet is 1.7 m from the eye)
  const w = world, pt = hit.point, mat = hit.object.material;
  const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
  const green = looksGreen(sx, sy), up = n.y > 0.75;
  let kind;
  if (w.cushions && hit.object === w.cushions.mesh) kind = 'moss';
  else if (up && waterDepthAt(pt.x, pt.z) > 0) kind = 'water';
  else if (mat && (mat.alphaTest > 0 || mat.transparent)) kind = 'leaf';                       // a fern, a plant, hanging moss: a card with a cut-out
  else if (up) kind = green ? 'moss' : ({ wet: 'mud', dry: 'leaf', rock: 'stone', mud: 'mud' }[state.loc.ground] || 'mud');
  else if (w.wallGeos && w.wallGeos.includes(hit.object.geometry)) kind = green ? 'moss' : state.loc.ceiling === 'tunnel' ? 'brick' : 'stone';
  else kind = green ? 'moss' : state.loc.wall && state.loc.wall.kind === 'logs' ? 'wood' : 'bark';
  ambience.touch(kind, nx * 34, hit.distance);
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
  // a hidden Radbro, found and tapped: his drawing is held up and kept, as the place's find is
  (w.faceMarks || []).forEach((m, k) => {
    if (hit.distance < 4.5 && Math.hypot(hit.point.x - m.pos[0], hit.point.y - m.pos[1], hit.point.z - m.pos[2]) < m.size * 1.15 && finds.found(`radbro:${state.level}:${k}`, state.level, state.loc.name)) ambience.call('wren');
  });
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
  beetles.clear(); world._bugOthers = null;
  const G = state.gallery;      // (null in the maze)
  const loc = state.loc = G ? G.loc : locationFor(level);
  const d = state.diff = difficulty(level, 0, loc);
  if (G) { d.curtains = 0; d.zones = 1; }      // nothing hung across a room whose walls are for looking at
  const rng = mulberry32(G ? G.seed : ((forcedSeed ? parseInt(forcedSeed, 10) : Date.now()) ^ (level * 2654435761)) >>> 0);
  state.maze = G ? galleryRoom(G.items.length, d.cell) : generateMaze(d.rooms, d.rooms, rng, { braid: d.braid, zones: d.zones, straight: d.straight, room: d.room, gap: d.gap });
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
  const wantBook = !G && level === 1 && !book.found, wantTorch = !G && level === 2 && !satchel.has('torch');
  const wantCigs = !G && level >= 3 && !satchel.has('cigs') && !!hands.pack;
  const [scans, pedestal] = await Promise.all([models.loadAll(modelsFor(loc)), wantBook || wantTorch || wantCigs ? models.load('tree_stump_01') : null, textures.ensure(neededTextures(loc))]);
  world.build(state.maze, state.diff, rng, loc, weather, scans, { wantBook, wantTorch, wantCigs, cigPack: hands.pack, cigLighter: hands.lighterWorld, pedestal });
  beetles.clear(); world._bugOthers = null;      // (again: nothing from the old place's walls)
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
  // the pictures, each set against the moss that is really there (the walls' triangles, sorted once, answer the rays)
  if (G) {
    const walls = new SurfaceGrid(solidMeshes()); walls.work(1e9);
    G.hung = gallery.hang(G.items, { maze: state.maze, cell: state.diff.cell, floorY: (x, z) => world.floorY(x, z), cast: (o, dir, far) => walls.cast(o, dir, far) });
  } else gallery.clear();
  player.obstacles = world.obstacles;
  shoots.setWorld(world.shootWorld);
  world.setFuzzQuality(state.qualityLevel ?? 1);
  governor.settle(60);
  particles.wallHeight = state.diff.wallHeight;
  particles.setRain(weather.rain * (0.4 + 0.6 * (state.qualityLevel ?? 1)));
  particles.setSnow(weather.snow);
  // light and air of the place
  scene.fog.color.copy(FOG); sky.setPalette(FOG, loc.sky ? loc.sky.zenith : 0x2a352a, loc.sky ? loc.sky.canopy : 1, weather.night, weather.dusk, weather.sun); sky.setFogAmount(Math.min(0.9, weather.fog * 0.8 + weather.rain * 0.25 + weather.snow * 0.5));
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
  $('#hud-level').textContent = G ? 'GALLERY' : `MAZE ${String(level).padStart(2, '0')}`;
  $('#hud-hint').textContent = G ? `${G.hung.hung} picture${G.hung.hung === 1 ? '' : 's'} \u00b7 ${G.owners.map(shortWallet).join(' \u00b7 ')}` : 'find the way out';
  $('#quit').textContent = G ? 'leave the gallery' : 'leave the maze';
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
  $('#enter').disabled = false; $('#gallery-open').disabled = false;
  showRecords();
  setMode('landing');
  applySettings();
})();
// --- account saves (cloud.js): the same account the site's Moss Quest saves to
const cloud = new Cloud({
  onApply: () => { satchel.reload(); book.reload(); satchel.sync(book); beetles.book.reload(); finds.reload(); showRecords(); },
  onStatus: (text, kind) => { for (const el of document.querySelectorAll('.save-line')) { el.textContent = text; el.dataset.kind = kind; } },
  onDoors: () => showDoors(),
});
cloud.start();
function showRecords() {
  const r = records.get();
  $('#who').textContent = doors.handle ? `@${doors.handle}` : (playerName() || '');
  $('#records').textContent = (r.bestMazes ? `deepest maze ${r.bestMazes} \u00b7 longest time inside ${fmtTime(r.bestTime)}` : 'no walks yet') + ` \u00b7 bugs ${beetles.book.count()}/${beetles.book.total()}`;
}
// --- the gallery (gallery.js): the visitor's own pictures on the walls of one closed room
const gallery = new Gallery({ scene, renderer, high: quality.high });
const GALLERY_PLACES = ['yakushima', 'aokigahara', 'williamson', 'wistmans', 'puzzlewood'];      // the places with walls a picture can hang on
function showPicture(f) {
  finds.card({
    title: f.label, sub: f.item.moss ? 'moss' : 'remilia', note: f.failed ? 'its picture could not be fetched from where it is kept.' : '', color: '',
    draw: (ctx, w, h) => { if (!f.thumb) return; const k = Math.min(w / f.thumb.width, h / f.thumb.height), dw = f.thumb.width * k, dh = f.thumb.height * k; ctx.drawImage(f.thumb, (w - dw) / 2, (h - dh) / 2, dw, dh); },
  });
}
const menuSay = t => { $('#load').textContent = t; };
// --- the two doors. Play is for a RemiliaNET sign-in; the gallery is for a connected wallet. Both are made on the
// site's front page (the only address RemiliaNET sends a sign-in back to, and where the wallet connector lives): the
// visitor is sent there with a note to come straight back (script.js: "maze-after"). A copy run on this machine
// (the launcher, a test server) has no front page to go to, so there the doors stand open; ?gate=1 closes them to try.
const gated = params.get('gate') === '1' || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const doors = { rn: !gated, handle: '' };
const toFrontPage = ask => { try { sessionStorage.setItem('maze-after', '1'); } catch { /* private mode */ } location.href = `/?${ask}`; };
async function showDoors() {
  const token = await remiliaToken().catch(() => null);
  doors.rn = !gated || !!token;
  try { doors.handle = token ? (sessionStorage.getItem('remilia-handle') || (cloud.tokens.find(t => t.handle) || {}).handle || '') : ''; } catch { doors.handle = ''; }
  $('#enter').textContent = doors.rn ? 'play' : 'play \u00b7 sign in with RemiliaNET';
  const w = galleryWallets(params, !gated);
  $('#gallery-open').textContent = w.length ? `gallery \u00b7 ${w.map(shortWallet).join(' \u00b7 ')}` : 'gallery \u00b7 connect a wallet';
  showRecords();
}
addEventListener('pageshow', showDoors); addEventListener('focus', showDoors);
async function enterGallery() {
  if (state.busy) return;
  const owners = galleryWallets(params, !gated);
  if (!owners.length) { if (gated) { menuSay('to the front page to connect a wallet'); toFrontPage('connect=wallet'); } else menuSay('no wallet \u00b7 this copy has no connector: add ?wallet=0x\u2026 to the address'); return; }
  state.busy = true; $('#enter').disabled = $('#gallery-open').disabled = true;
  try {
    menuSay(`reading the chains for ${owners.map(shortWallet).join(' and ')}`);
    const items = await galleryList(owners, !!settings.galleryMoss, pending => menuSay(`reading the chains \u00b7 ${pending.length} collection${pending.length === 1 ? '' : 's'} to go`));
    if (!items.length) { menuSay(`nothing to hang \u00b7 ${owners.map(shortWallet).join(' and ')} holds none of these collections`); return; }
    menuSay(`hanging ${Math.min(items.length, GALLERY_MAX)} picture${items.length === 1 ? '' : 's'}`);
    const seed = seedOf(owners), place = GALLERY_PLACES[seed % GALLERY_PLACES.length];
    state.gallery = { owners, items, seed, loc: LOCATIONS.find(l => l.id === place) || locationFor(1) };
    ambience.start(); ambience.resume();
    await newLevel(1);
    menuSay(''); state.runTime = 0;
    begin();
    if (items.unread && items.unread.length) toast(`could not read ${items.unread.join(', ')} just now · try again later`);
  } catch (err) { console.error(err); state.gallery = null; menuSay(String((err && err.message) || 'the gallery could not be opened')); }
  finally { state.busy = false; $('#enter').disabled = $('#gallery-open').disabled = false; }
}
$('#gallery-open').addEventListener('click', enterGallery);
function showMossSwitch() { $('#gallery-moss').textContent = `moss nfts in the gallery \u00b7 ${settings.galleryMoss ? 'on' : 'off'}`; }
$('#gallery-moss').addEventListener('click', () => { settings.galleryMoss = !settings.galleryMoss; applySettings(); showMossSwitch(); });
showMossSwitch(); showDoors();
// the menu is worked like the handheld's: up and down move the cursor, enter presses the row (a mouse or a thumb can too)
{
  const rows = [...document.querySelectorAll('#menu .row')];
  let cur = 0, ac = null;
  // a soft note from one five-note scale for each move, as RemiliaNET's own screens do
  const blip = n => {
    if (ambience.muted) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(), f = 392 * Math.pow(2, [0, 2, 4, 7, 9, 12][n % 6] / 12);
      o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.05, ac.currentTime + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.16);
      o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.18);
    } catch { /* no sound here */ }
  };
  const put = (i, quiet) => { cur = (i + rows.length) % rows.length; rows.forEach((r, k) => r.classList.toggle('on', k === cur)); if (!quiet) blip(cur); };
  rows.forEach((r, i) => { r.addEventListener('pointerenter', () => { if (i !== cur) put(i); }); r.addEventListener('click', () => blip(5)); });
  put(0, true);
  addEventListener('keydown', e => {
    if (state.mode !== 'landing' || document.body.classList.contains('notes') || (e.target && e.target.closest && e.target.closest('input, textarea'))) return;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { put(cur + 1); e.preventDefault(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { put(cur - 1); e.preventDefault(); }
    else if (e.code === 'Enter' || e.code === 'Space') { if (!rows[cur].disabled) rows[cur].click(); e.preventDefault(); }
  });
}
$('#enter').addEventListener('click', () => {
  if (state.busy) return;
  if (!doors.rn) { menuSay('to RemiliaNET to sign in'); toFrontPage('signin=remilia'); return; }
  ambience.start(); ambience.resume();
  records.runStarted();
  state.runTime = 0;
  const go = wakes ? wakeUp : begin;
  if (state.mode !== 'landing') newLevel(1).then(go); else go();
});
$('#resume').addEventListener('click', begin);
$('#quit').addEventListener('click', async () => {
  // out of the gallery: straight back to the start screen, with the first place behind it again
  if (state.gallery) { state.gallery = null; setMode('loading'); menuSay('leaving the gallery'); await newLevel(1); menuSay(''); showRecords(); setMode('landing'); return; }
  records.runEnded(state.runTime); showRecords();
  // leaving: lie down in the moss and look up through the canopy for a few seconds, then the first place again
  setMode('leaving'); state.lieT = 0;
  await new Promise(r => setTimeout(r, 5600));
  if (state.mode !== 'leaving') return;
  await newLevel(1); player.lie = 0; setMode('landing');
});
function begin() {
  // whatever was last clicked in a menu lets go of the keyboard
  if (document.activeElement && document.activeElement !== document.body && !handheld.typing) document.activeElement.blur();
  setMode('playing');
  if (!coarse) player.requestLock();
}
// How a run starts: you come round lying in the moss, on your back, the canopy swimming overhead. A few slow blinks,
// the picture clears, you get up, look about you, and only then are your legs your own. While that happens the
// game finds the level of detail this machine can hold (see Governor.calibrate), so the walk itself starts smooth.
const WAKE = 7.5;   // seconds
const lids = document.createElement('div');
lids.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;opacity:0;display:none;z-index:3';
document.body.appendChild(lids);
const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
// the eyelids: shut, a crack, shut, half, a blink, open (time in seconds, how dark)
const LIDS = [[0, 1], [0.6, 1], [1.3, 0.4], [1.6, 1], [1.9, 1], [2.7, 0.15], [2.95, 0.85], [3.2, 0.1], [4.0, 0]];
function lidsAt(t) {
  for (let i = 1; i < LIDS.length; i++) if (t < LIDS[i][0]) { const [t0, a] = LIDS[i - 1], [t1, b] = LIDS[i]; return a + (b - a) * ease((t - t0) / (t1 - t0)); }
  return 0;
}
function wakeUp() {
  state.wakeT = 0; state.wakeYaw = player.yaw; player.pitch = 0; player.lie = 1;
  lids.style.display = 'block'; lids.style.opacity = 1;
  governor.beginCalibrate();
  setMode('waking');
  if (!coarse) player.requestLock();
}
function waking(dt) {
  const T = (state.wakeT += dt);
  const rise = ease((T - 2.9) / 2.7);               // getting up
  const daze = 1 - ease((T - 5.2) / (WAKE - 5.2));  // the head's wandering, gone by the end
  player.lie = 1 - rise;
  player.yaw = state.wakeYaw + (Math.sin(T * 0.95) * 0.5 + Math.sin(T * 2.3) * 0.1) * daze * ease(T / 2);
  player.pitch = (Math.sin(T * 1.3 + 1) * 0.1 - 0.12 * rise) * daze;
  lids.style.opacity = lidsAt(T);
  state.wakeBlur = 0.011 * (1 - ease((T - 1.5) / 3.5));
  if (T >= WAKE) {
    player.lie = 0; player.yaw = state.wakeYaw; player.pitch = 0; state.wakeBlur = 0;
    lids.style.display = 'none';
    governor.endCalibrate();
    setMode('playing');
    if (!coarse && !player.locked) player.requestLock();
  }
}
// Escape always lets the mouse go (the browser's rule). While a message is being written that only stops the
// writing: the game does not pause, and a click on the picture takes the mouse back.
player.onLockChange = locked => {
  if (locked || state.mode !== 'playing' || coarse) return;
  if (handheld.typing) { handheld.type(false); toast('click to look around again'); return; }
  setMode('paused');
};
renderer.domElement.addEventListener('mousedown', () => { if (state.mode === 'playing' && !coarse && !player.locked && !handheld.typing) player.requestLock(); });
// the mouse wheel scrolls the handheld's page while it is out
window.addEventListener('wheel', e => { if (state.mode === 'playing' && hands.holding('device') && e.deltaY) handheld.scrollBy(e.deltaY < 0 ? 2 : -2); }, { passive: true });
$('#pause').addEventListener('click', () => { if (state.mode === 'playing') setMode('paused'); });
window.addEventListener('keydown', e => {
  // nothing here while typing in the book
  if (e.target && (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && !['checkbox', 'range', 'button'].includes(e.target.type)))) return;   // (a settings box or slider left in focus must not swallow the keys)
  // nor while the dev notes are up: escape puts them away
  if (document.body.classList.contains('notes')) { if (e.code === 'Escape') showNotes(false); return; }
  if (e.code === 'KeyJ') { if (state.mode === 'book') book.close(); else openBook(); }
  if (e.code === 'KeyI') { if (state.mode === 'satchel') satchel.close(); else openSatchel(); }
  if (e.code === 'KeyP' && !e.repeat && (state.mode === 'playing' || state.mode === 'paused' || state.mode === 'found')) { e.preventDefault(); snap(); }
  if (e.code === 'KeyF' && state.mode === 'playing' && torch.owned) toggleTorch();
  if (e.code === 'KeyT' && state.mode === 'playing') toggleDevice();
  if (e.code === 'KeyC' && state.mode === 'playing') toggleSmoke();
  if (e.code === 'KeyR' && !e.repeat && state.mode === 'playing') toggleRazor();
  if (e.code === 'KeyG' && !e.repeat && state.mode === 'playing') hands.knife.ask('inspect');
  if (e.code === 'Enter' && state.mode === 'playing' && hands.holding('device')) { e.preventDefault(); handheld.type(true); }
  if (state.mode === 'playing' && hands.holding('device')) {
    // with the handheld out the arrows are its own: left and right turn the page (tab too), up and down scroll. W A S D still walk
    // (and for a keyboard with no arrows: Q and E turn the page, the mouse wheel scrolls)
    const turn = e.code === 'Tab' ? (e.shiftKey ? -1 : 1) : e.code === 'ArrowRight' || e.code === 'KeyE' ? 1 : e.code === 'ArrowLeft' || e.code === 'KeyQ' ? -1 : 0;
    if (turn) { e.preventDefault(); player.keys.delete(e.code); handheld.nextPage(turn); ambience.pageTurn(); }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { e.preventDefault(); player.keys.delete(e.code); handheld.scrollBy(e.code === 'ArrowUp' ? 2 : -2); }
  }
  if (state.mode === 'book' || state.mode === 'satchel') return;   // the other keys mean nothing with a panel open, wherever the focus went
  if (e.code === 'KeyH') { settings.clean = !settings.clean; applySettings(); }   // the clean screen: the same switch as in settings, and it is remembered
  if (e.code === 'KeyM') { ambience.setMuted(!ambience.muted); $('#mute').textContent = ambience.muted ? 'sound off' : 'sound on'; }
});
$('#mute').addEventListener('click', () => { ambience.setMuted(!ambience.muted); $('#mute').textContent = ambience.muted ? 'sound off' : 'sound on'; });
// how deep the water is under the player: the still level over the ground, or the stream's channel
function waterDepthAt(x, z) {
  if (!world.group) return 0;
  if (world.waterLevel !== null) { const d = world.waterLevel - world.floorY(x, z); if (d > 0.01) return d; }
  if (world.stream) { const q = world.stream.dist(x, z); if (q && q.d < q.hw + 0.1) return Math.max(0.02, world.stream.depth * (1 + 0.7 * q.pool) - 0.05); }
  return 0;
}
player.stepTrigger = brisk => {
  const depth = waterDepthAt(player.pos.x, player.pos.z);
  ambience.step(brisk, depth > 0 ? 'water' : state.loc.ground, depth);
  // where ferns and leafy plants grow, one brushes the leg now and then
  const green = state.loc.props ? Math.min(1, (state.loc.props.ferns || 0) + (state.loc.props.plants || 0)) : 0;
  if (depth <= 0 && Math.random() < 0.09 * green) ambience.brushPast();
};
addEventListener('pagehide', () => { if (state.runTime > 5 && !state.gallery) records.runEnded(state.runTime); });

// --- resize
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  post.setSize(innerWidth, innerHeight);
  hands.setSize(camera.aspect); hands.scene.userData.h = innerHeight;
  hands.rightInset = coarse && camera.aspect < 1 ? 104 / innerWidth : 0;   // the phone's column of buttons, upright
}
hands.rightInset = coarse && camera.aspect < 1 ? 104 / innerWidth : 0;
addEventListener('resize', resize);

// --- the exit found
function foundExit() {
  setMode('found');
  records.mazeFound(state.level, state.mazeTime); cloud.touch();
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

  if (state.mode === 'waking') waking(dt);
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
  body.update(player, ground, dt, hands, camera);

  wind.update(dt);
  shoots.tick(now); shoots.update(player.pos, player.yaw);
  sky.update(now, camera);
  world.update(now);
  whimsyHooks.mazeTime = state.mazeTime;
  updateWhimsy(world.whimsy, dt, player, now, whimsyHooks);
  beetles.update(dt, now, player, playing && player.lie < 0.02);
  if (playing && (shadowFrame & 7) === 0) checkFind();
  if (playing) { checkBook(); checkTorch(); checkCigs(); }
  if (coarse && (shadowFrame & 15) === 0) showActs();
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
  // the hands: the torch is in the right one whenever it is lit; the rest is the player's doing
  if (hands.right !== 'razor' && torch.lit !== hands.holding('torch')) hands.set('torch', torch.lit);
  camera.updateMatrixWorld();
  hands.light(hemi, sun, state.night || 0, torch.level);
  hands.update(dt, player, (playing || state.mode === 'found' || state.mode === 'paused' || state.mode === 'settings') && player.lie < 0.02, scene.fog.color, Math.min(1, 0.25 + hemi.intensity * 0.6));
  handheld.tick(dt);
  // the light is the torch's own: out of its lens, the way it points (the eye's own way while the hand is coming up)
  torchSrc.w = hands.torchRay(torchSrc.pos, torchSrc.dir);
  torch.update(dt, player, player.stepPhase, player.stride, torchSrc);
  post.setTorch(torch.uniforms.uTorchOn.value, torch.inScene ? torch.viewDir(torchDirV) : torchDirV, Math.cos(TORCH_ANGLE), camera, scene.fog.density, torchPosV.copy(torch.light.position).applyMatrix4(camera.matrixWorldInverse));
  // the water you hear: the stream by distance, or the still water of the place when you are standing in it
  let streamDist = world.waterLevel !== null ? (world.inWater(player.pos.x, player.pos.z) ? 0 : 1.6) : Infinity;
  if (world.stream) { const nr = world.stream.near(player.pos.x, player.pos.z); streamDist = nr.d; ambience.streamAz = Math.atan2(nr.x - player.pos.x, -(nr.z - player.pos.z)); }
  ambience.listen(player.yaw, Math.min(1, Math.hypot(player.vel.x, player.vel.z) / player.walk));
  ambience.update(dt, state.diff ? Math.min(1, (state.diff.fog - 0.07) / 0.1) : 0, streamDist, waterDepthAt(player.pos.x, player.pos.z), Math.min(1, Math.hypot(player.vel.x, player.vel.z) / player.walk));

  // autofocus on what is ahead; on the landing page keep it close and dreamy
  post.autofocus(state.mode === 'landing' ? 1.4 : state.mode === 'leaving' ? 0.6 + 6 * (state.lieT || 0) : focusTarget(now), dt || 0.016);
  const racking = post.focusPull(state.mode === 'playing' && focusLock.until > now, dt || 0.016);
  post.mat.uniforms.uBlur.value = racking + (state.mode === 'waking' ? (state.wakeBlur || 0) : state.mode === 'landing' ? 0.004 : state.mode === 'paused' || state.mode === 'book' || state.mode === 'satchel' ? 0.006 : 0);
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
  post.render(scene, camera, now, hands.visible ? hands : null);
  beetles.rendered();
  // now and then the governor asks what a frame really costs: reading one pixel back waits for the GPU to finish
  // while waking, every frame is timed, once the blur has cleared enough for the cost to be the true one
  if (state.mode === 'waking' && state.wakeT > 4.6) { renderer.getContext().readPixels(0, 0, 1, 1, 6408, 5121, probePixel); governor.calibrate(performance.now() - now * 1000); }
  if (governor.probe) { governor.probe = false; renderer.getContext().readPixels(0, 0, 1, 1, 6408, 5121, probePixel); governor.work = performance.now() - now * 1000; }
}
frame();

// debug handle
window.MM = { frame, state, player, world, scene, renderer, newLevel, setMode, post, quality, particles, sun, hemi, shoots, governor, textures, models, book, finds, ambience, tapped, foundFind, openBook, satchel, openSatchel, torch, toggleTorch, canopy, body, hands, handheld, toggleSmoke, toggleDevice, toggleRazor, POSES, HOLD, LIGHT, MOTION, snap, cameraShot, cloud, gallery, enterGallery, beetles, showBug, caughtBug };
