// The moss look. One MeshStandardMaterial per base material (stone, brick,
// cave rock, soil, bark), extended through onBeforeCompile:
//
//  * The photos are projected from world space. Walls, floors and ceilings
//    carry a per-face axis attribute, so a carved wall keeps one projection
//    across its whole face and never seams. Rounded things (logs, boulders,
//    cushions, trunks) blend three projections by the surface normal.
//  * Parallax occlusion mapping on the flat surfaces gives cushions and
//    crevices depth; it fades out at grazing angles so it never smears.
//  * A procedural coverage mask (slow noise, fine noise, crevices, closeness
//    to the ground, facing up) blends two moss photos over the base.
//  * The location's native species: a slow field picks which species grows
//    where; each brings its colour, texture scale, fuzz height, fuzz density
//    and gloss. Wetness glosses bare rock and mud, never the moss. Mud rings
//    and standing water on wet floors; snow on what faces up.
//  * Fuzz shells: the same geometry drawn again in layers pushed out along
//    the normal and alpha-tested through a strand noise where the moss is
//    thick, so silhouettes are soft and fibrous. The wind combs the loose kinds.
import * as THREE from '../lib/three.module.js?v=88cddb5c';

export const GLSL_COMMON = /* glsl */`
  float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { return (vnoise(p) * 0.5 + vnoise(p * 2.07 + 11.3) * 0.25 + vnoise(p * 4.3 + 5.1) * 0.125) / 0.875; }

  // projection frame for an axis-aligned plane with normal n (one component +-1): T x B = N
  void axisFrame(vec3 n, vec3 p, out vec2 uv, out vec3 T, out vec3 B) {
    if (abs(n.y) > 0.5)      { float s = sign(n.y); T = vec3(1,0,0); B = vec3(0,0,-s); uv = vec2(p.x, -s * p.z); }
    else if (abs(n.x) > 0.5) { float s = sign(n.x); T = vec3(0,0,-s); B = vec3(0,1,0); uv = vec2(-s * p.z, p.y); }
    else                     { float s = sign(n.z); T = vec3(s,0,0); B = vec3(0,1,0); uv = vec2(s * p.x, p.y); }
  }
  vec3 dominantAxis(vec3 n) {
    vec3 a = abs(n);
    if (a.y >= a.x && a.y >= a.z) return vec3(0.0, sign(n.y), 0.0);
    if (a.x >= a.z) return vec3(sign(n.x), 0.0, 0.0);
    return vec3(0.0, 0.0, sign(n.z));
  }

  // the lines water takes down a face: bands a hand or two wide, wandering a little as they fall, from two
  // crossed sets so a face along either axis gets them (src/shoots.js wallMoss computes the same, for the shoots)
  float runoff(vec3 p) {
    float a = sin(p.x * 5.3 + 1.9 * sin(p.z * 1.7 + p.y * 0.8) + 2.3 * sin(p.x * 1.3));
    float b = sin(p.z * 4.7 + 2.1 * sin(p.x * 1.5 - p.y * 0.7) + 2.0 * sin(p.z * 1.1 + 1.0));
    return smoothstep(0.35, 0.9, max(a, b));
  }
  // where moss grows: slow layout (from the vertex stage), fine edge, crevices, near the ground, on top. On a
  // standing face it is the damp that decides, as on a real bank: thickest at the foot and on anything level
  // enough to hold water and grit, thin up the open face and off the sunny side, bare under an overhang and
  // in the runoff lines between the mossy strips. Even the mossiest place keeps rock showing.
  float mossMask(vec3 p, float low, float baseH, float cover, vec3 nrm, vec3 sun) {
    float up = clamp(nrm.y, 0.0, 1.0), side = 1.0 - abs(nrm.y);
    float n = low * 0.42 + fbm(p * 2.3 + 7.0) * 0.22 + vnoise(p * 7.0 + 3.0) * 0.12 + vnoise(p * 15.0 + 8.0) * 0.06;
    n += 0.3 * (1.0 - baseH);
    n += 0.24 * clamp(1.0 - p.y / 1.1, 0.0, 1.0);
    n += 0.12 * up;
    n -= 0.22 * clamp(-nrm.y * 1.6, 0.0, 1.0);
    n -= side * (0.18 * runoff(p) + 0.09 * smoothstep(1.1, 2.3, p.y));
    n -= 0.08 * side * clamp(dot(nrm.xz, sun.xz) / max(length(nrm.xz) * length(sun.xz), 0.05), 0.0, 1.0);
    float lo = 0.73 - cover * 0.42;
    return smoothstep(lo, lo + 0.13, n);
  }
  // sunlight through leaves: a pattern projected along the sun, drifting as the canopy moves
  float dapple(vec3 wp, vec3 sunDir, float t) {
    vec3 g = wp - sunDir * (wp.y / max(sunDir.y, 0.2));
    vec2 q = g.xz * 0.5 + vec2(t * 0.025, t * 0.012);
    float n = fbm(vec3(q, 1.5)) * 0.65 + vnoise(vec3(q * 3.3, 4.0)) * 0.35;
    return 0.12 + 0.88 * smoothstep(0.40, 0.68, n);
  }
`;

// The photo sets, loaded as a place needs them and released when no place
// coming up uses them, so the eight places can carry twenty-odd sets without
// the GPU holding them all. A set is color.jpg, normal.jpg (OpenGL) and
// arh.jpg (ambient occlusion, roughness, height).
export class Textures {
  constructor(loader, base) { this.loader = loader; this.base = base; this.sets = new Map(); this.onProgress = null; }
  load(n) {
    const have = this.sets.get(n);
    if (have) return have.promise;
    const e = { name: n, ready: false };
    const mk = (file, srgb) => this.loader.loadAsync(`${this.base}/${n}/${file}`).then(t => {
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
      return t;
    });
    e.promise = Promise.all([mk('color.jpg', true), mk('normal.jpg'), mk('arh.jpg')]).then(([color, normal, arh]) => {
      e.color = color; e.normal = normal; e.arh = arh; e.ready = true;
      if (this.onProgress) this.onProgress(n);
      return e;
    });
    this.sets.set(n, e);
    return e.promise;
  }
  ensure(names) { return Promise.all([...new Set(names)].map(n => this.load(n))); }
  get(n) {
    const e = this.sets.get(n);
    if (!e || !e.ready) throw new Error(`texture set not loaded: ${n}`);
    return e;
  }
  // free every set not in `keep`
  retain(keep) {
    const k = new Set(keep);
    for (const [n, e] of this.sets) {
      if (k.has(n) || !e.ready) continue;
      e.color.dispose(); e.normal.dispose(); e.arh.dispose();
      this.sets.delete(n);
    }
  }
}

// strand noise for the fuzz shells: fine random dots with some clumping
export function makeStrandTexture(size = 256) {
  const data = new Uint8Array(size * size);
  for (let i = 0; i < size * size; i++) data[i] = Math.floor(Math.pow(Math.random(), 1.6) * 255);
  const t = new THREE.DataTexture(data, size, size, THREE.RedFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

function typeTints(types) {
  const out = [];
  for (let i = 0; i < 6; i++) { const t = types && types[i]; out.push(t ? new THREE.Color(t.color) : new THREE.Color(0x8faa4a)); }
  return out;
}
function typeParams(types) {
  const out = [];
  for (let i = 0; i < 6; i++) { const t = types && types[i]; out.push(t ? new THREE.Vector4(...t.params) : new THREE.Vector4(1, 0.6, 1, 0.9)); }
  return out;
}

/**
 * @param {object} o
 * @param {object} o.base   {color, normal, arh} of the underlying material
 * @param {object} o.mossA  {color, normal, arh}
 * @param {object} o.mossB  {color, normal, arh}
 * @param {THREE.Texture} o.strand
 * @param {number} o.cover   0..1 how much moss
 * @param {number} o.scale   texture repeats per metre (base)
 * @param {number} o.mossScale
 * @param {boolean} o.fuzz   build the shell variant
 * @param {boolean} o.triplanar  rounded geometry: blend three projections (no parallax)
 * @param {number} o.shells
 * @param {number} o.pomSteps
 * @param {Array} o.types   native species [{color, params:[scale, fuzzHeight, density, gloss]}]
 */
export function makeMossMaterial(o) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: 0.3,
    side: THREE.FrontSide,
  });
  const u = {
    tBaseColor: { value: o.base.color }, tBaseNormal: { value: o.base.normal }, tBaseARH: { value: o.base.arh },
    tBase2Color: { value: (o.base2 || o.base).color }, tBase2ARH: { value: (o.base2 || o.base).arh },
    uBase2Tint: { value: new THREE.Color(o.base2Tint || o.baseTint || 0xffffff) }, uScale2: { value: o.scale2 || o.scale || 0.6 },
    tMossAColor: { value: o.mossA.color }, tMossANormal: { value: o.mossA.normal }, tMossAARH: { value: o.mossA.arh },
    tMossBColor: { value: o.mossB.color }, tMossBARH: { value: o.mossB.arh },
    tStrand: { value: o.strand },
    uCover: { value: o.cover ?? 0.6 },
    uScale: { value: o.scale ?? 0.6 },
    uMossScale: { value: o.mossScale ?? 0.8 },
    uHeight: { value: o.heightScale ?? 0.035 },
    uFuzzHeight: { value: o.fuzzHeight ?? 0.05 },
    uTime: { value: 0 },
    uMossTint: { value: new THREE.Color(o.mossTint || 0xffffff) },
    uSunDir: { value: (o.sunDir || new THREE.Vector3(0.35, 0.8, 0.45)).clone().normalize() },
    uMud: { value: o.mud || 0 },
    uSnow: { value: 0 },
    uShellIndex: { value: o.shellIndex ?? -1 },
    uWind: { value: o.wind || new THREE.Vector3() },
    uTypeTint: { value: typeTints(o.types) },
    uTypeParam: { value: typeParams(o.types) },
    uTypes: { value: Math.max(1, Math.min(6, (o.types || []).length || 1)) },
    uBaseTint: { value: new THREE.Color(o.baseTint || 0xffffff) },
    tLow: { value: o.lowTex || null },
    uNight: { value: o.night || 0 },
    uDrape: { value: o.drape || 0 },
    uDapple: { value: 1 },        // 1: the painted sun-through-leaves pattern; 0: real leaf shadows fall instead (shadow.js)
  };
  mat.userData.uniforms = u;
  const fuzz = !!o.fuzz, tri = !!o.triplanar, meshUv = !!o.meshUv;
  const shells = o.shells || 8;
  const pomSteps = o.pomSteps || 8;

  mat.onBeforeCompile = function (shader) {
    Object.assign(shader.uniforms, this.userData.uniforms || u);
    shader.defines = shader.defines || {};
    if (fuzz) shader.defines.FUZZ = 1;
    if (tri) shader.defines.TRIPLANAR = 1; else if (meshUv) shader.defines.MESH_UV = 1; else shader.defines.FACE_AXIS = 1;
    shader.defines.SHELLS = shells.toFixed(1);
    shader.defines.POM_STEPS = pomSteps;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNormal; varying float vShell; varying float vAO; varying vec3 vAxis;
        varying vec4 vLow; varying vec2 vLow2; varying vec4 vTint; varying vec4 vParam; varying vec2 vMeshUv;
        attribute float ao;
        #ifdef FACE_AXIS
          attribute vec3 axis; attribute vec2 seam;
        #endif
        varying vec2 vSeam;
        uniform float uFuzzHeight, uTime, uShellIndex; uniform vec3 uSunDir, uWind;
        uniform vec3 uTypeTint[6]; uniform vec4 uTypeParam[6]; uniform int uTypes;
        uniform sampler2D tLow;
        ${GLSL_COMMON}
        // which native moss grows here: a slow field picks two neighbouring types and blends them
        void mossType(vec3 wp, out vec4 tint, out vec4 param) {
          float f = clamp((fbm(wp * 0.21 + 40.0) - 0.28) / 0.44, 0.0, 0.999) * float(uTypes);
          int i0 = int(floor(f)); int i1 = min(i0 + 1, uTypes - 1);
          float w = smoothstep(0.3, 0.7, fract(f));
          vec3 t0 = uTypeTint[0], t1 = uTypeTint[0]; vec4 p0 = uTypeParam[0], p1 = uTypeParam[0];
          for (int i = 0; i < 6; i++) { if (i == i0) { t0 = uTypeTint[i]; p0 = uTypeParam[i]; } if (i == i1) { t1 = uTypeTint[i]; p1 = uTypeParam[i]; } }
          tint = vec4(mix(t0, t1, w), 0.0); param = mix(p0, p1, w);
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vShell = 0.0;
        #ifdef USE_INSTANCING
          vec3 wp0 = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vec3 wn0 = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
          vec3 wp0 = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vec3 wn0 = normalize(mat3(modelMatrix) * objectNormal);
        #endif
        vSeam = vec2(0.0);
        #ifdef FACE_AXIS
          vAxis = axis; vSeam = seam;
        #elif defined(MESH_UV)
          // bark wraps the cylinder: u around it, v along it, both in metres, grain along the length
          #ifdef USE_INSTANCING
            mat3 imx = mat3(modelMatrix) * mat3(instanceMatrix);
          #else
            mat3 imx = mat3(modelMatrix);
          #endif
          vec3 sc = vec3(length(imx[0]), length(imx[1]), length(imx[2]));
          vMeshUv = vec2(uv.x * 6.2832 * sc.x, uv.y * sc.y);
          vAxis = normalize(imx * vec3(0.0, 1.0, 0.0));
        #else
          vAxis = wn0;
        #endif
        mossType(wp0, vTint, vParam);
        #ifdef FUZZ
          vShell = uShellIndex >= 0.0 ? (uShellIndex + 1.0) / SHELLS : (float(gl_InstanceID) + 1.0) / SHELLS;
          float fh = uFuzzHeight * vParam.y * (1.0 + 1.2 * clamp(wn0.y, 0.0, 1.0));
          vec3 off = wn0 * vShell * fh;
          // the wind combs the loose kinds, gently
          off += uWind * vShell * vShell * fh * 0.9 * (0.5 + 0.5 * sin(uTime * 2.3 + wp0.x * 0.8 + wp0.z * 0.6)) * smoothstep(1.0, 0.4, vParam.z);
          wp0 += off;
          #ifdef USE_INSTANCING
            transformed += inverse(mat3(modelMatrix) * mat3(instanceMatrix)) * off;
          #else
            transformed += inverse(mat3(modelMatrix)) * off;
          #endif
        #endif
        vWPos = wp0; vWNormal = wn0;
        vAO = ao;
        // slow fields, interpolated across the tessellation: moss layout, species, tint variation, wetness, dapple
        vLow = vec4(texture2D(tLow, vec2(vWPos.x * 0.09 + vWPos.y * 0.05, vWPos.z * 0.09 + vWPos.y * 0.07)).r, fbm(vWPos * 0.33 + 3.0), fbm(vWPos * 0.21 + 40.0), fbm(vWPos * 0.9 + 9.0));
        vLow2 = vec2(fbm(vWPos * 0.7 + 20.0), dapple(vWPos, uSunDir, uTime));`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNormal; varying float vShell; varying float vAO; varying vec3 vAxis;
        varying vec4 vLow; varying vec2 vLow2; varying vec4 vTint; varying vec4 vParam; varying vec2 vMeshUv; varying vec2 vSeam;
        uniform float uSnow, uNight, uDrape, uDapple;
        uniform sampler2D tBase2Color, tBase2ARH; uniform vec3 uBase2Tint; uniform float uScale2;
        uniform sampler2D tBaseColor, tBaseNormal, tBaseARH, tMossAColor, tMossANormal, tMossAARH, tMossBColor, tMossBARH, tStrand;
        uniform float uCover, uScale, uMossScale, uHeight, uTime, uFuzzHeight, uMud;
        uniform vec3 uMossTint, uBaseTint, uSunDir;
        ${GLSL_COMMON}
        vec3 mmAlbedo; float mmRough; float mmAO; vec3 mmNormalW; float mmPud = 0.0;

        float heightAt(vec2 uvB, vec2 uvM, float sp, float mask) {
          float hb = texture2D(tBaseARH, uvB).b;
          float hm = mix(texture2D(tMossAARH, uvM).b, texture2D(tMossBARH, uvM * 0.83).b, sp);
          return mix(hb, hm * 0.85 + 0.15 + 0.05 * mask, mask);
        }
        // one projection's worth of samples: base and moss colour, tangent-space normal, AO/rough/height
        void samplePlane(vec2 uvB, vec2 uvM, float sp, out vec3 bCol, out vec3 bN, out vec3 bARH, out vec3 mCol, out vec3 mN, out vec3 mARH) {
          bCol = texture2D(tBaseColor, uvB).rgb;
          bN = texture2D(tBaseNormal, uvB).rgb * 2.0 - 1.0;
          bARH = texture2D(tBaseARH, uvB).rgb;
          mCol = mix(texture2D(tMossAColor, uvM).rgb, texture2D(tMossBColor, uvM * 0.83).rgb, sp);
          mN = texture2D(tMossANormal, uvM).rgb * 2.0 - 1.0;
          mARH = mix(texture2D(tMossAARH, uvM).rgb, texture2D(tMossBARH, uvM * 0.83).rgb, sp);
        }`)
      .replace('#include <map_fragment>', `
        vec3 gN = normalize(vWNormal);
        vec3 V = normalize(cameraPosition - vWPos);
        float up = clamp(gN.y, 0.0, 1.0);
        float sp = smoothstep(0.45, 0.75, vLow.y) * 0.7;
        float mScaleT = uMossScale;   // a scale that varied across the surface stretched the photo into streaks

        vec3 bCol, bN, bARH, mCol, mN, mARH;
        vec3 baseNormalW, mossNormalW;
        float mask;
        vec2 uvM;   // for the strand noise

        #ifdef TRIPLANAR
          // rounded things: three projections blended by the normal, no seams anywhere
          vec3 w = pow(abs(gN), vec3(6.0)); w /= (w.x + w.y + w.z);
          vec3 ax[3]; ax[0] = vec3(sign(gN.x), 0.0, 0.0); ax[1] = vec3(0.0, sign(gN.y), 0.0); ax[2] = vec3(0.0, 0.0, sign(gN.z));
          float ws[3]; ws[0] = w.x; ws[1] = w.y; ws[2] = w.z;
          bCol = vec3(0.0); bARH = vec3(0.0); mCol = vec3(0.0); mARH = vec3(0.0);
          baseNormalW = vec3(0.0); mossNormalW = vec3(0.0);
          float hSum = 0.0; uvM = vec2(0.0);
          for (int i = 0; i < 3; i++) {
            if (ws[i] < 0.02) continue;
            vec2 uv0; vec3 T, B; axisFrame(ax[i], vWPos, uv0, T, B);
            vec3 c1, n1, a1, c2, n2, a2;
            samplePlane(uv0 * uScale, uv0 * mScaleT, sp, c1, n1, a1, c2, n2, a2);
            bCol += c1 * ws[i]; bARH += a1 * ws[i]; mCol += c2 * ws[i]; mARH += a2 * ws[i];
            baseNormalW += (T * n1.x + B * n1.y) * ws[i]; mossNormalW += (T * n2.x + B * n2.y) * ws[i];
            uvM += uv0 * mScaleT * ws[i];
          }
          mask = mossMask(vWPos, vLow.x, bARH.b, uCover, gN, uSunDir);
          baseNormalW = normalize(gN + baseNormalW * 1.2);
          mossNormalW = normalize(gN + mossNormalW * 1.6);
        #else
          vec2 uv0; vec3 T, B;
          #ifdef MESH_UV
            // the broken ends: a flat projection across the cut, not the bark wrapped radially
            float capness = smoothstep(0.6, 0.85, abs(dot(gN, vAxis)));
            vec3 t1 = normalize(cross(vAxis, abs(vAxis.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
            vec3 t2 = normalize(cross(vAxis, t1));
            if (capness > 0.5) {
              uv0 = vec2(dot(vWPos, t1), dot(vWPos, t2)) * mix(0.7, 2.4, uDrape);   // a rotten end is fine fibre, not planks
              T = normalize(t1 - gN * dot(t1, gN)); B = normalize(cross(gN, T));
            } else {
              uv0 = vMeshUv;
              vec3 bb = vAxis - gN * dot(vAxis, gN);
              B = length(bb) < 1e-3 ? normalize(cross(gN, abs(gN.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0))) : normalize(bb);
              T = normalize(cross(B, gN));
            }
          #else
            // flat faces: one projection per face, parallax into the height maps
            axisFrame(vAxis, vWPos, uv0, T, B);
            // the face is carved, so its real normal leans: carry that into the frame
            T = normalize(T - gN * dot(T, gN)); B = normalize(B - gN * dot(B, gN));
            // where the face rounds over (a wall's end, its top) the surface turns toward another axis, and the
            // neighbouring strip is projected along that one: blend toward it by how far the normal faces each
            // way, so both strips reach the same half-and-half mix where they meet and no seam is left. Flat
            // faces stay on their own projection (the weight is near zero there and the second fetch is skipped)
            vec3 restN = abs(gN) * (vec3(1.0) - abs(vAxis));
            vec3 axis2 = restN.x >= restN.y && restN.x >= restN.z ? vec3(sign(gN.x), 0.0, 0.0) : restN.y >= restN.z ? vec3(0.0, sign(gN.y), 0.0) : vec3(0.0, 0.0, sign(gN.z));
            float wA = pow(abs(dot(gN, vAxis)), 4.0), wS = pow(abs(dot(gN, axis2)), 4.0);
            float w2 = wS / max(wA + wS, 1e-4);
            if (w2 < 0.02) w2 = 0.0;
            vec2 uvS; vec3 T2, B2; axisFrame(axis2, vWPos, uvS, T2, B2);
            T2 = normalize(T2 - gN * dot(T2, gN)); B2 = normalize(B2 - gN * dot(B2, gN));
          #endif
          vec3 Vt = vec3(dot(V, T), dot(V, B), max(dot(V, gN), 0.08));
          vec2 uvB = uv0 * uScale; uvM = uv0 * mScaleT;
          // a join with the partner zone: cross-fade the two materials; the fade edge is broken up by noise so it is never a line
          float zb = clamp(vSeam.y * 2.0 * (0.75 + 0.5 * vnoise(vWPos * 3.0)), 0.0, 1.0) * 0.5;
          zb = smoothstep(0.0, 1.0, zb * 2.0) * 0.5;
          vec2 uvB2 = uv0 * uScale2;
          float baseH0 = mix(texture2D(tBaseARH, uvB).b, texture2D(tBase2ARH, uvB2).b, zb);
          #ifdef FACE_AXIS
            if (w2 > 0.0) baseH0 = mix(baseH0, texture2D(tBaseARH, uvS * uScale).b, w2);
          #endif
          mask = mossMask(vWPos, vLow.x, baseH0, uCover, gN, uSunDir);
          mask = max(mask, smoothstep(0.2, 0.9, vSeam.x * (0.7 + 0.5 * vnoise(vWPos * 4.0))));   // a join with any other zone is grown over
          #ifdef MESH_UV
            float mWrap = smoothstep(0.0, 1.0, mask * (0.45 + 0.9 * up) + 0.35 * up * smoothstep(0.3, 0.7, vLow.y));
            // a nurse log (uDrape): the moss lies as a blanket over the top and shoulders, hangs unevenly down the
            // sides, and leaves the underside and worn patches as bare, rotting bark with a definite edge
            // the mats and the bare strips run along the grain, so the noise that cuts them is stretched along the log
            float grain = vnoise(vec3(vMeshUv.x * 2.6, vMeshUv.y * 0.55, 2.0)) * 0.7 + vnoise(vec3(vMeshUv.x * 7.0, vMeshUv.y * 1.4, 5.0)) * 0.3;
            float drape = smoothstep(-0.7, 0.4, gN.y + 0.5 * (grain - 0.5) + 0.4 * (vnoise(vWPos * 3.5 + 11.0) - 0.5) + 0.2 * (vLow.w - 0.5));
            float mNurse = smoothstep(0.25, 0.6, mask * mix(0.1, 1.0, drape) + 0.35 * drape - 0.3 * (1.0 - drape) * vnoise(vWPos * 3.0));
            mask = mix(mWrap, mNurse, uDrape);
            mask *= 1.0 - 0.9 * capness;   // a cut end is bare wood
          #endif
          #if !defined(FUZZ) && !defined(MESH_UV)
          {
            float layerD = 1.0 / float(POM_STEPS);
            float graze = smoothstep(0.2, 0.65, Vt.z);
            vec2 dUV = -Vt.xy / max(Vt.z, 0.5) * uHeight * layerD * graze;
            #ifdef FACE_AXIS
              dUV *= clamp(1.0 - 2.0 * w2, 0.0, 1.0);
            #endif
            float cur = 0.0; vec2 off = vec2(0.0);
            float h = 1.0 - heightAt(uvB, uvM, sp, mask);
            float prevH = h, prevCur = 0.0;
            for (int i = 0; i < POM_STEPS; i++) {
              if (cur >= h) break;
              prevH = h; prevCur = cur;
              off += dUV; cur += layerD;
              h = 1.0 - heightAt(uvB + off, uvM + off * (mScaleT / uScale), sp, mask);
            }
            float a = (prevH - prevCur) / max((prevH - prevCur) - (h - cur), 1e-4);
            off = mix(off - dUV, off, clamp(a, 0.0, 1.0));
            uvB += off; uvM += off * (mScaleT / uScale);
          }
          #endif
          samplePlane(uvB, uvM, sp, bCol, bN, bARH, mCol, mN, mARH);
          #ifdef FACE_AXIS
            if (zb > 0.001) {
              vec2 uvB2p = uvB2 + (uvB - uv0 * uScale) * (uScale2 / uScale);
              bCol = mix(bCol * uBaseTint, texture2D(tBase2Color, uvB2p).rgb * uBase2Tint, zb) / max(uBaseTint, vec3(0.05));
              bARH = mix(bARH, texture2D(tBase2ARH, uvB2p).rgb, zb);
            }
          #endif
          #ifdef MESH_UV
            baseNormalW = normalize(T * bN.x * 2.2 + B * bN.y * 2.2 + gN * bN.z);
          #else
            baseNormalW = normalize(T * bN.x * 1.3 + B * bN.y * 1.3 + gN * bN.z);
          #endif
          mossNormalW = normalize(T * mN.x * 1.8 + B * mN.y * 1.8 + gN * mN.z);
          #ifdef FACE_AXIS
            if (w2 > 0.0) {
              vec3 c1, n1, a1, c2, n2, a2;
              samplePlane(uvS * uScale, uvS * mScaleT, sp, c1, n1, a1, c2, n2, a2);
              bCol = mix(bCol, c1, w2); bARH = mix(bARH, a1, w2); mCol = mix(mCol, c2, w2); mARH = mix(mARH, a2, w2);
              baseNormalW = normalize(mix(baseNormalW, normalize(T2 * n1.x * 1.3 + B2 * n1.y * 1.3 + gN * n1.z), w2));
              mossNormalW = normalize(mix(mossNormalW, normalize(T2 * n2.x * 1.8 + B2 * n2.y * 1.8 + gN * n2.z), w2));
              uvM = mix(uvM, uvS * mScaleT, step(0.5, w2));
            }
          #endif
        #endif

        #ifdef FUZZ
          // shells: keep only strands that reach this height, only where moss is thick; decide before any more work
          float strand = texture2D(tStrand, uvM * 6.0).r;
          float clump = vnoise(vWPos * 9.0);
          float facing = smoothstep(0.05, 0.45, abs(dot(gN, V)));
          // the pile is lumpy, a cushion here and a thin skin there, not one even pile like a clipped hedge
          float thick = smoothstep(0.45, 0.9, mask) * (0.65 + 0.35 * clump) * (1.0 + 0.35 * up) * (0.5 + 0.5 * vnoise(vWPos * 1.9 + 5.0)) * vParam.z * mix(0.35, 1.0, facing);
          if (strand * thick < vShell * 0.9 + 0.05) discard;
          // at grazing angles the layers would stack into lines: keep only the low ones there
          if (vShell > mix(0.3, 1.0, facing)) discard;
        #endif

        bCol *= uBaseTint;
        #ifdef MESH_UV
          // the cut is darker, wetter wood; a nurse log's broken end is red-brown rotten heartwood, and the bare bark under its moss is damp and brown
          bCol *= mix(vec3(1.0), mix(vec3(0.5), vec3(0.4, 0.25, 0.15) * (0.7 + 0.6 * vnoise(vWPos * 28.0)), uDrape), capness);
          bCol *= mix(vec3(1.0), vec3(0.74, 0.62, 0.47), uDrape * (1.0 - drape) * (1.0 - capness));
        #endif
        // the native species' colour: the photo carries the structure, the species its hue
        float mlum = dot(mCol, vec3(0.3, 0.59, 0.11));
        vec3 tint = vTint.rgb / max(dot(vTint.rgb, vec3(0.3, 0.59, 0.11)), 0.05);
        mCol = mix(mCol, mlum * tint * 1.05, 0.6) * uMossTint;
        // large-scale brightness variation breaks the tiling
        mCol *= 0.82 + 0.36 * vLow.w; bCol *= 0.8 + 0.4 * vLow.w;
        // moss thickness shades its own edges: darker where it thins out
        float edge = smoothstep(0.0, 0.35, mask) * (1.0 - smoothstep(0.35, 1.0, mask));
        mCol *= 1.0 - 0.25 * edge;

        mmAlbedo = mix(bCol, mCol, mask);
        mmNormalW = normalize(mix(baseNormalW, mossNormalW, mask));
        float rough = mix(bARH.g, mARH.g, mask);
        mmAO = mix(bARH.r, mARH.r, mask) * mix(0.5, 1.0, vAO);

        // wetness: pools low down and in crevices; it glosses bare rock and mud, never the moss
        float wet = clamp(vLow2.x * 0.9 + 0.35 * clamp(1.0 - vWPos.y / 0.9, 0.0, 1.0) + 0.25 * (1.0 - mARH.b) - 0.35, 0.0, 1.0);
        mmAlbedo *= 1.0 - 0.22 * wet;
        float bareWet = wet * (1.0 - mask);
        mmRough = clamp(mix(rough, rough * 0.45, bareWet) * mix(1.0, 0.95 * vParam.w, mask), 0.12, 1.0);
        mmRough = max(mmRough, mask * 0.62);
        // snow settles on what faces up
        if (uSnow > 0.0) {
          float sn = uSnow * smoothstep(0.25, 0.85, up) * (0.55 + 0.45 * vnoise(vWPos * 5.0)) * (0.7 + 0.3 * mask);
          mmAlbedo = mix(mmAlbedo, vec3(0.86, 0.88, 0.92), clamp(sn, 0.0, 1.0));
          mmRough = mix(mmRough, 0.75, clamp(sn, 0.0, 1.0));
          mmNormalW = normalize(mix(mmNormalW, gN, clamp(sn, 0.0, 1.0) * 0.6));
        }
        // mud and standing water where the ground is low and the location is wet
        if (uMud > 0.0 && up > 0.5) {
          float pudRaw = vLow.w * 0.55 + vLow2.x * 0.45 + uMud * 0.22 - 0.42 - vWPos.y * 2.0;
          float mudRing = smoothstep(0.0, 0.14, pudRaw);
          float pud = smoothstep(0.12, 0.2, pudRaw); mmPud = pud;
          mmAlbedo = mix(mmAlbedo, vec3(0.17, 0.13, 0.09) * (0.8 + 0.4 * vnoise(vWPos * 6.0)), mudRing * 0.85);
          mmRough = mix(mmRough, 0.35, mudRing);
          mmAlbedo = mix(mmAlbedo, vec3(0.07, 0.065, 0.05), pud);
          mmRough = mix(mmRough, 0.05, pud);
          mmNormalW = normalize(mix(mmNormalW, gN, pud * 0.9));
          #ifdef FUZZ
            if (mudRing > 0.3) discard;
          #endif
        }

        #ifdef FUZZ
          mmAlbedo *= mix(0.55, 1.05, vShell);   // lower strands sit in shade
          mmRough = clamp(mmRough + 0.2, 0.0, 1.0);
          mmAO = mix(0.6, 1.0, vShell) * mix(0.5, 1.0, vAO);   // and the contact shade under things, through the strands too
        #endif

        diffuseColor.rgb *= mmAlbedo;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mmRough;`)
      .replace('#include <normal_fragment_maps>', `normal = normalize((viewMatrix * vec4(mmNormalW, 0.0)).xyz);`)
      .replace('#include <aomap_fragment>', `
        // by day the dapple is sun through leaves; after dark the same pattern is moonlight, sharper-edged, the gaps darker
        // (the base is clamped: multisampling can extrapolate the varying below zero at a triangle's edge, and
        // pow of a negative is NaN, which mix() does not hide even at weight zero)
        float dap = mix(1.0, vLow2.y, uDapple);
        if (uNight > 0.0) dap = mix(dap, pow(max(dap, 0.0), 2.4) * 1.2 + 0.015, uNight);
        reflectedLight.indirectDiffuse *= mmAO;
        reflectedLight.indirectSpecular *= mmAO * (1.0 - 0.7 * mmPud);
        reflectedLight.directDiffuse *= mix(1.0, mmAO, 0.45) * mix(0.5, 1.0, vAO) * dap;   // a joint (a wall foot, under a stone) is out of the sun too
        reflectedLight.directSpecular *= mix(0.6, 1.0, vAO) * dap;`);
  };
  mat.customProgramCacheKey = () => `moss-${fuzz ? 'fuzz' : 'solid'}-${tri ? 'tri' : meshUv ? 'uv' : 'axis'}-${shells}-${pomSteps}`;
  return mat;
}
