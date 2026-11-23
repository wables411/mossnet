// Overcast forest sky: a dome whose horizon is the fog colour, darker and
// greener overhead with soft canopy blotches, a faint warm sun; and a tiny
// equirect of the same gradient turned into the environment map so wet
// moss reflects a believable sky. After dark the same dome goes deep blue,
// the sun becomes a small cold moon with a halo, a few stars show where the
// canopy opens, and at dusk the horizon toward the sun keeps a warm band.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { GLSL_COMMON } from './materials.js?v=5d2fdc80';
import { leafMask } from './shadow.js?v=5d2fdc80';

const NIGHT_ZENITH = new THREE.Color(0x060a16), DUSK_WARM = new THREE.Color(0xc98a58);
// the sky itself, behind the leaves: brighter than anything under the trees, so the camera blows it out the way a
// phone does when it is exposed for the forest floor. White under cloud, pale blue on a clear day.
const SKY_CLOUD = new THREE.Color(1.25, 1.3, 1.32), SKY_CLEAR = new THREE.Color(0.62, 0.86, 1.3);

export function makeSky(scene, renderer, fogColor, sunDir) {
  const geo = new THREE.SphereGeometry(90, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uHorizon: { value: fogColor.clone() },
      uZenith: { value: new THREE.Color(0x2a352a) },
      uCanopy: { value: 1 },
      uOpen: { value: SKY_CLOUD.clone() },
      uSunAmt: { value: 0.5 },
      tLeaf: { value: leafMask(0.55, false, 11) },
      uSun: { value: sunDir.clone().normalize() },
      uTime: { value: 0 },
      uFogAmount: { value: 0 },
      uNight: { value: 0 },
      uDusk: { value: 0 },
    },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir; uniform vec3 uHorizon, uZenith, uSun, uOpen; uniform float uTime, uFogAmount, uCanopy, uNight, uDusk, uSunAmt; uniform sampler2D tLeaf;
      ${GLSL_COMMON}
      void main(){
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0.0, 1.0);
        float s = max(dot(d, uSun), 0.0);
        float day = 1.0 - 0.85 * uNight;
        // the open sky: bright overhead, a few slow clouds on a clear day, hazing to the fog's colour low down
        vec2 p = d.xz / max(d.y, 0.04);
        vec3 col = uOpen;
        if (uSunAmt > 0.3 && uCanopy < 0.9) col = mix(col, vec3(1.45) * day, 0.45 * uSunAmt * smoothstep(0.5, 0.72, fbm(vec3(p * 0.35 + uTime * 0.004, 9.0))));
        col = mix(uHorizon, col, smoothstep(0.0, 0.34, up));
        // dusk: the sky toward the sun keeps a warm band low down, the rest goes cool
        col = mix(col, vec3(0.79, 0.54, 0.35) * mix(0.5, 1.2, s), uDusk * pow(1.0 - up, 4.0) * (0.35 + 0.65 * s) * 0.6);
        // the canopy: the same kind of leaf mask that casts the flecks on the ground, seen from below as two layers
        // (near boughs, far crowns), thick where the crowns mass and broken where they part. Leaves against the sky
        // are near black from underneath; the thin edges of a crown glow green where the sun comes through them.
        float can = fbm(vec3(p * 0.9, 1.0)) * 0.6 + fbm(vec3(p * 3.1, 4.0)) * 0.4;
        float mass = smoothstep(0.36, 0.6, can);
        float l1 = texture2D(tLeaf, p * 1.3).a, l2 = texture2D(tLeaf, p * 3.1 + 0.37).a;
        float through = (1.0 - l1 * 0.9) * (1.0 - l2) * (1.0 - 0.85 * mass);
        float leaves = smoothstep(0.85 - uCanopy, 1.05 - uCanopy, can) * (1.0 - through);
        vec3 leafCol = vec3(0.030, 0.046, 0.022) * day;
        leafCol += vec3(0.26, 0.38, 0.06) * (1.0 - mass) * (0.2 + 0.8 * s * s) * uSunAmt * day * 0.4;
        // far off the trees close into one hazed wall with a ragged top: looking level through a forest there is
        // more forest, not sky (and a flat sheet of leaves seen at a low angle would smear into streaks)
        float az = atan(d.z, d.x);
        float rag = fbm(vec3(cos(az) * 2.6, sin(az) * 2.6, 2.0));
        float edge = 0.2 + 0.3 * rag;
        // its top edge is leaf shapes, and it is trunks and shade below: dark, a little lighter with distance haze
        vec2 wuv = vec2(az * 1.4323945, up * 3.2);   // 9 repeats round the compass, so no seam
        float lw = texture2D(tLeaf, wuv).a;
        float wall = clamp(uCanopy * 1.4 - 0.2, 0.0, 1.0) * smoothstep(edge + 0.06, edge - 0.04, up + 0.14 * (lw - 0.5));
        leaves = max(leaves, wall);
        float trunks = fbm(vec3(az * 34.0, up * 2.0, 3.0));
        vec3 wallCol = mix(vec3(0.022, 0.034, 0.018) * (0.6 + 0.9 * trunks) * day, uHorizon, 0.16 + 0.2 * smoothstep(0.3, 0.0, up));
        leafCol = mix(leafCol, wallCol, wall * smoothstep(edge + 0.1, edge - 0.1, up));
        leafCol = mix(uHorizon * 0.55, leafCol, smoothstep(0.02, 0.22, up));
        col = mix(col, leafCol, leaves);
        // a few stars where the trees open, only after dark and only in clear air
        float openSky = (1.0 - leaves) * smoothstep(0.08, 0.3, up);
        vec2 sp = p * 60.0; vec2 sc = floor(sp);
        float star = step(0.9965, hash12(sc)) * smoothstep(0.35, 0.0, length(fract(sp) - 0.5 - (vec2(hash12(sc + 7.0), hash12(sc + 13.0)) - 0.5) * 0.5));
        col += vec3(0.8, 0.85, 1.0) * star * 0.45 * uNight * openSky * (1.0 - uFogAmount);
        // the sun: soft and warm through the leaves by day; after dark a small cold moon with a halo
        vec3 sunGlow = vec3(1.0, 0.92, 0.75) * (pow(s, 40.0) * 0.9 + pow(s, 6.0) * 0.15) * (1.0 - 0.7 * leaves) * (0.3 + 0.7 * uSunAmt);
        vec3 moon = vec3(0.86, 0.9, 1.0) * (smoothstep(0.99975, 0.99992, s) * 1.6 + pow(s, 400.0) * 0.5 + pow(s, 24.0) * 0.06);
        col += mix(sunGlow * mix(1.0, 1.6, uDusk) * mix(vec3(1.0), vec3(1.0, 0.7, 0.45), uDusk), moon * (1.0 - 0.7 * leaves), uNight);
        // in weather fog the whole sky closes in to the fog colour, so fogged things never glow against it
        col = mix(col, uHorizon, uFogAmount);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  mat.toneMapped = true;
  const dome = new THREE.Mesh(geo, mat);
  dome.frustumCulled = false;
  scene.add(dome);

  // environment: a 64x32 equirect gradient, prefiltered, rebuilt for each place's palette
  const pmrem = new THREE.PMREMGenerator(renderer);
  let env = null;
  function buildEnv(horizon, zenith, night = 0) {
    const w = 64, h = 32, data = new Float32Array(w * h * 4);
    const ground = new THREE.Color(0x1f1a12).multiplyScalar(1 - 0.8 * night);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = 1 - y / (h - 1); // 1 = top
      const c = new THREE.Color();
      if (v > 0.5) c.lerpColors(horizon, zenith, Math.pow((v - 0.5) * 2, 0.6));
      else c.lerpColors(ground, horizon, Math.pow(v * 2, 2.0));
      const i = (y * w + x) * 4;
      data[i] = c.r * 1.1; data[i + 1] = c.g * 1.1; data[i + 2] = c.b * 1.1; data[i + 3] = 1;
    }
    const eq = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
    eq.mapping = THREE.EquirectangularReflectionMapping; eq.colorSpace = THREE.LinearSRGBColorSpace; eq.needsUpdate = true;
    if (env) env.dispose();
    env = pmrem.fromEquirectangular(eq).texture;
    eq.dispose();
    scene.environment = env;
  }
  buildEnv(fogColor, new THREE.Color(0x2a352a));

  return {
    dome,
    setFogColor(c) { mat.uniforms.uHorizon.value.copy(c); },
    // the place's sky: what is overhead when the trees open (grey moor, white cloud, dark canopy), at the hour of the visit
    // (horizon is the fog colour the world already darkened for the hour; the zenith is darkened here)
    setPalette(horizon, zenithHex, canopy, night = 0, dusk = 0, sunAmt = 0.5) {
      const zen = new THREE.Color(zenithHex).lerp(NIGHT_ZENITH, night);
      if (dusk) zen.lerp(DUSK_WARM, 0.08);
      mat.uniforms.uHorizon.value.copy(horizon); mat.uniforms.uZenith.value.copy(zen); mat.uniforms.uCanopy.value = canopy;
      mat.uniforms.uNight.value = night; mat.uniforms.uDusk.value = dusk;
      // behind the leaves: under trees the place's zenith colour stood for the canopy, so the sky is its own colour
      // there; where the place is open (a moor, a ridge) its own grey stays, lifted, and clears a little in sun
      const clear = Math.max(0, sunAmt - 0.4) / 0.6;
      const open = canopy >= 0.5 ? SKY_CLOUD.clone().lerp(SKY_CLEAR, clear) : new THREE.Color(zenithHex).multiplyScalar(1.6).lerp(SKY_CLEAR, clear * 0.4);
      open.lerp(NIGHT_ZENITH, Math.min(1, night * 1.15));
      if (dusk) open.lerp(DUSK_WARM, 0.12);
      mat.uniforms.uOpen.value.copy(open); mat.uniforms.uSunAmt.value = sunAmt * (1 - night);
      buildEnv(horizon, zen, night);
    },
    setSun(dir) { mat.uniforms.uSun.value.copy(dir).normalize(); },
    setFogAmount(a) { mat.uniforms.uFogAmount.value = a; },
    update(t, cam) { mat.uniforms.uTime.value = t; dome.position.copy(cam.position); },
  };
}
