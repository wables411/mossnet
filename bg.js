// =====================================================================
// Always-moving background.
// One still image is pushed through a halftone screen: three rotated dot
// grids (one per colour channel) whose spacing breathes and whose grid is
// bent by a slow noise field, so the picture never sits still even though
// the source is a single photo. The mouse (or a finger) nudges the image
// for a little parallax, and switching pictures crossfades in half a second.
// Plain WebGL, no library. Falls back to a slow CSS drift without WebGL.
//
// To add backgrounds: drop an image in assets/backgrounds/ and add a line
// to BACKGROUNDS. Landscape photos around 1600-2000px wide work best.
// =====================================================================

export const BACKGROUNDS = [
  { name: 'MossNet #1', src: 'assets/backgrounds/mossnet-1.webp' },
  { name: 'MossNet #20', src: 'assets/backgrounds/mossnet-20.webp' },
  { name: 'MossNet #30', src: 'assets/backgrounds/mossnet-30.webp' },
  { name: 'MossNet #40', src: 'assets/backgrounds/mossnet-40.webp' },
  { name: 'MossNet #50', src: 'assets/backgrounds/mossnet-50.webp' },
  { name: 'MossNet #60', src: 'assets/backgrounds/mossnet-60.webp' },
  { name: 'MossNet #70', src: 'assets/backgrounds/mossnet-70.webp' },
  { name: 'MossNet #80', src: 'assets/backgrounds/mossnet-80.webp' },
  { name: 'MossNet #90', src: 'assets/backgrounds/mossnet-90.webp' },
  { name: 'MossNet #100', src: 'assets/backgrounds/mossnet-100.webp' }
];

const STORAGE_KEY = 'mossquest-background';

// Same knobs remilia.net exposes; tuned a touch softer for a photo background
const LOOK = {
  textureScale: 1.15,
  radius: 1.3,
  patternScale: 2.0,
  brightness: 1.15,
  blending: 0.6,
  noiseIntensity: 0.04,
  rotateR: 0.26,
  rotateG: 0.61,
  rotateB: 1.05
};

const VERT = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform sampler2D tDiffuse;
uniform sampler2D tNext;
uniform float transition;
uniform float time;
uniform vec2 textureOffset;
uniform vec2 coverScale;
uniform float textureScale;
uniform vec2 resolution;
uniform float radius;
uniform float rotateR;
uniform float rotateG;
uniform float rotateB;
uniform float patternScale;
uniform float brightness;
uniform float noiseIntensity;
uniform float blending;
varying vec2 vUv;

float fastRand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float fastNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(fastRand(i), fastRand(i + vec2(1.0, 0.0)), f.x),
    mix(fastRand(i + vec2(0.0, 1.0)), fastRand(i + vec2(1.0, 1.0)), f.x),
    f.y);
}

vec2 rotateCoord(vec2 coord, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return vec2(coord.x * c - coord.y * s, coord.x * s + coord.y * c);
}

float dotScreen(vec2 coord, float angle, float spacing, float intensity) {
  vec2 deformed = coord + vec2(fastNoise(coord * 1.5 + time * 0.08)) * 0.06;
  vec2 scaled = rotateCoord(deformed, angle) * spacing * patternScale;
  vec2 grid = mod(scaled, 2.0) - 1.0;
  float pulse = 1.0 + sin(time * 0.4) * 0.04;
  float size = 0.48 * pulse;
  return step(length(grid), size * (1.0 + intensity));
}

void main() {
  vec2 uv = (vUv - 0.5) * coverScale / textureScale + 0.5 + textureOffset;
  vec4 a = texture2D(tDiffuse, uv);
  vec4 b = texture2D(tNext, uv);
  vec3 color = mix(a, b, transition).rgb * brightness;

  vec2 coord = vUv * resolution * 0.02;
  vec3 pattern = vec3(
    dotScreen(coord, rotateR, 50.0 / radius, color.r),
    dotScreen(coord, rotateG, 50.0 / radius, color.g),
    dotScreen(coord, rotateB, 50.0 / radius, color.b));
  vec3 finalColor = mix(color, pattern, blending);

  if (noiseIntensity > 0.001) {
    float n = fastNoise(vUv * 800.0 + time * 0.8);
    finalColor = mix(finalColor, vec3(n), noiseIntensity * 0.8);
  }
  gl_FragColor = vec4(finalColor, 1.0);
}`;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

function readSavedIndex() {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(n) && n >= 0 && n < BACKGROUNDS.length ? n : 0;
  } catch (_) { return 0; }
}

export function createBackground(canvas) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = readSavedIndex();
  const listeners = new Set();

  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
  if (!gl) return createCssFallback(canvas, index, listeners);

  // ---- program ----
  const compile = (type, src) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    console.warn('Background shader failed, using CSS fallback:', error);
    return createCssFallback(canvas, index, listeners);
  }
  gl.useProgram(program);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  ['tDiffuse', 'tNext', 'transition', 'time', 'textureOffset', 'coverScale', 'textureScale', 'resolution',
    'radius', 'rotateR', 'rotateG', 'rotateB', 'patternScale', 'brightness', 'noiseIntensity', 'blending']
    .forEach(name => { u[name] = gl.getUniformLocation(program, name); });
  gl.uniform1i(u.tDiffuse, 0);
  gl.uniform1i(u.tNext, 1);
  Object.entries(LOOK).forEach(([k, v]) => gl.uniform1f(u[k], v));

  // ---- textures ----
  const makeTexture = (img) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return { tex, aspect: img.width / img.height };
  };

  let current = null;
  let next = null;
  let transitionStart = 0;
  let loadToken = 0;

  const bind = (unit, entry) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, entry ? entry.tex : null);
  };

  // ---- sizing ----
  let width = 1;
  let height = 1;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.max(1, Math.floor(canvas.clientWidth));
    height = Math.max(1, Math.floor(canvas.clientHeight));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.resolution, width, height); // CSS pixels keep the dot size the same on retina
    updateCover();
  };
  const updateCover = () => {
    const entry = current || next;
    if (!entry) return;
    const canvasAspect = width / height;
    const sx = canvasAspect > entry.aspect ? 1 : canvasAspect / entry.aspect;
    const sy = canvasAspect > entry.aspect ? entry.aspect / canvasAspect : 1;
    gl.uniform2f(u.coverScale, sx, sy);
  };
  window.addEventListener('resize', resize);

  // ---- parallax ----
  let targetX = 0, targetY = 0, offsetX = 0, offsetY = 0;
  const nudge = (x, y) => {
    targetX = (x / window.innerWidth - 0.5) * 0.04;
    targetY = (0.5 - y / window.innerHeight) * 0.04;
  };
  window.addEventListener('mousemove', e => nudge(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchmove', e => { if (e.touches[0]) nudge(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

  // ---- render loop ----
  let time = 0;
  let last = 0;
  let running = true;
  const frame = (now) => {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < 16.6) return;
    last = now;
    if (!reduceMotion) time += 0.01;
    offsetX += (targetX - offsetX) * 0.05;
    offsetY += (targetY - offsetY) * 0.05;
    gl.uniform1f(u.time, time);
    gl.uniform2f(u.textureOffset, offsetX, offsetY);
    if (next) {
      const t = Math.min((now - transitionStart) / 500, 1);
      gl.uniform1f(u.transition, t);
      if (t >= 1) {
        if (current) gl.deleteTexture(current.tex);
        current = next;
        next = null;
        bind(0, current);
        bind(1, null);
        gl.uniform1f(u.transition, 0);
        updateCover();
      }
    }
    if (current || next) gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) requestAnimationFrame(frame);
  });

  const show = async (i) => {
    index = ((i % BACKGROUNDS.length) + BACKGROUNDS.length) % BACKGROUNDS.length;
    try { localStorage.setItem(STORAGE_KEY, String(index)); } catch (_) { /* storage */ }
    const token = ++loadToken;
    let img;
    try { img = await loadImage(BACKGROUNDS[index].src); } catch (error) { console.warn(error); return; }
    if (token !== loadToken) return;
    const entry = makeTexture(img);
    if (!current) {
      current = entry;
      bind(0, current);
      updateCover();
    } else {
      if (next) gl.deleteTexture(next.tex);
      next = entry;
      bind(1, next);
      transitionStart = performance.now();
    }
    listeners.forEach(fn => fn(BACKGROUNDS[index], index));
  };

  resize();
  requestAnimationFrame(frame);
  show(index);

  return {
    get index() { return index; },
    get name() { return BACKGROUNDS[index].name; },
    next() { return show(index + 1); },
    set: show,
    onChange(fn) { listeners.add(fn); }
  };
}

// No WebGL: the picture drifts slowly with CSS instead
function createCssFallback(canvas, startIndex, listeners) {
  let index = startIndex;
  canvas.classList.add('bg-fallback');
  const apply = () => {
    canvas.style.backgroundImage = `url(${BACKGROUNDS[index].src})`;
    try { localStorage.setItem(STORAGE_KEY, String(index)); } catch (_) { /* storage */ }
    listeners.forEach(fn => fn(BACKGROUNDS[index], index));
  };
  apply();
  return {
    get index() { return index; },
    get name() { return BACKGROUNDS[index].name; },
    next() { index = (index + 1) % BACKGROUNDS.length; apply(); },
    set(i) { index = ((i % BACKGROUNDS.length) + BACKGROUNDS.length) % BACKGROUNDS.length; apply(); },
    onChange(fn) { listeners.add(fn); }
  };
}
