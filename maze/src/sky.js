// Overcast forest sky: a dome whose horizon is the fog colour, darker and
// greener overhead with soft canopy blotches, a faint warm sun; and a tiny
// equirect of the same gradient turned into the environment map so wet
// moss reflects a believable sky. After dark the same dome goes deep blue,
// the sun becomes a small cold moon with a halo, a few stars show where the
// canopy opens, and at dusk the horizon toward the sun keeps a warm band.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { GLSL_COMMON } from './materials.js?v=af31d97a';

const NIGHT_ZENITH = new THREE.Color(0x060a16), DUSK_WARM = new THREE.Color(0xc98a58);

export function makeSky(scene, renderer, fogColor, sunDir) {
  const geo = new THREE.SphereGeometry(90, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uHorizon: { value: fogColor.clone() },
      uZenith: { value: new THREE.Color(0x2a352a) },
      uCanopy: { value: 1 },
      uSun: { value: sunDir.clone().normalize() },
      uTime: { value: 0 },
      uFogAmount: { value: 0 },
      uNight: { value: 0 },
      uDusk: { value: 0 },
    },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir; uniform vec3 uHorizon, uZenith, uSun; uniform float uTime, uFogAmount, uCanopy, uNight, uDusk;
      ${GLSL_COMMON}
      void main(){
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(up, 0.55));
        float s = max(dot(d, uSun), 0.0);
        // dusk: the sky toward the sun keeps a warm band low down, the rest goes cool
        col = mix(col, vec3(0.79, 0.54, 0.35) * mix(0.5, 1.2, s), uDusk * pow(1.0 - up, 4.0) * (0.35 + 0.65 * s) * 0.6);
        // canopy: leafy blotches thicken overhead
        vec2 p = d.xz / max(d.y, 0.05);
        float can = fbm(vec3(p * 2.2, 1.0)) * 0.55 + fbm(vec3(p * 8.0, 4.0)) * 0.45;
        float leaves = smoothstep(0.42, 0.56, can);
        col = mix(col, vec3(0.09, 0.12, 0.07) * (1.0 - 0.8 * uNight), 0.85 * uCanopy * leaves * smoothstep(0.03, 0.3, up));
        // a few stars where the trees open, only after dark and only in clear air
        float openSky = (1.0 - uCanopy * smoothstep(0.3, 0.6, can)) * smoothstep(0.08, 0.3, up);
        vec2 sp = p * 60.0; vec2 sc = floor(sp);
        float star = step(0.9965, hash12(sc)) * smoothstep(0.35, 0.0, length(fract(sp) - 0.5 - (vec2(hash12(sc + 7.0), hash12(sc + 13.0)) - 0.5) * 0.5));
        col += vec3(0.8, 0.85, 1.0) * star * 0.45 * uNight * openSky * (1.0 - uFogAmount);
        // the sun: soft and warm through the leaves by day; after dark a small cold moon with a halo
        vec3 sunGlow = vec3(1.0, 0.92, 0.75) * (pow(s, 40.0) * 0.35 + pow(s, 6.0) * 0.08) * (1.0 - 0.6 * uCanopy * smoothstep(0.3, 0.8, can));
        vec3 moon = vec3(0.86, 0.9, 1.0) * (smoothstep(0.99975, 0.99992, s) * 1.6 + pow(s, 400.0) * 0.5 + pow(s, 24.0) * 0.06);
        col += mix(sunGlow * mix(1.0, 1.6, uDusk) * mix(vec3(1.0), vec3(1.0, 0.7, 0.45), uDusk), moon * (1.0 - 0.7 * uCanopy * smoothstep(0.3, 0.8, can)), uNight);
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
    setPalette(horizon, zenithHex, canopy, night = 0, dusk = 0) {
      const zen = new THREE.Color(zenithHex).lerp(NIGHT_ZENITH, night);
      if (dusk) zen.lerp(DUSK_WARM, 0.08);
      mat.uniforms.uHorizon.value.copy(horizon); mat.uniforms.uZenith.value.copy(zen); mat.uniforms.uCanopy.value = canopy;
      mat.uniforms.uNight.value = night; mat.uniforms.uDusk.value = dusk;
      buildEnv(horizon, zen, night);
    },
    setSun(dir) { mat.uniforms.uSun.value.copy(dir).normalize(); },
    setFogAmount(a) { mat.uniforms.uFogAmount.value = a; },
    update(t, cam) { mat.uniforms.uTime.value = t; dome.position.copy(cam.position); },
  };
}
