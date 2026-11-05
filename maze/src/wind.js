// The wind: one shared state every swaying thing reads, and the card material
// (ferns, grass, undergrowth, hanging moss, leaves) that bends in it.
import * as THREE from '../lib/three.module.js?v=88cddb5c';

export const wind = {
  dir: new THREE.Vector3(1, 0, 0.3).normalize(),
  strength: 0.2,      // the weather's base
  gust: 0,            // 0..1, rises and falls
  time: 0,
  vec: new THREE.Vector3(),   // dir * (strength + gust), what shaders read
  update(dt) {
    this.time += dt;
    const t = this.time;
    const g = Math.max(0, Math.sin(t * 0.21) * 0.5 + Math.sin(t * 0.53 + 1.7) * 0.3 + Math.sin(t * 1.31 + 0.4) * 0.2);
    this.gust = g * this.strength;
    this.vec.copy(this.dir).multiplyScalar(this.strength * 0.6 + this.gust);
  },
};

export const GLSL_SWAY = /* glsl */`
  uniform vec3 uWind; uniform float uWindTime;
  // bend a point by the wind: f is how free it is (0 rooted, 1 free), p its world position
  vec3 sway(vec3 p, float f, float stiffness) {
    float w = length(uWind);
    float phase = p.x * 0.9 + p.z * 0.7;
    float s = sin(uWindTime * (1.6 + 1.4 * w) + phase) * 0.6 + sin(uWindTime * 3.7 + phase * 2.3) * 0.25 + sin(uWindTime * 7.1 + phase * 4.1) * 0.15;
    vec3 d = uWind * (0.5 + 0.5 * s) + vec3(0.0, -0.3, 0.0) * w * s;
    return d * f * f * stiffness;
  }
`;

/**
 * A MeshStandardMaterial with a map that bends in the wind.
 * mode: 'up' rooted at the bottom (uv.y = 0), 'hang' rooted at the top, 'leaf' a horizontal card that bobs.
 */
export function makeCardMaterial({ map, color = 0xffffff, mode = 'up', stiffness = 0.35, alphaTest = 0.5, emissive = 0x000000, emissiveIntensity = 0, roughness = 0.9 }) {
  const mat = new THREE.MeshStandardMaterial({ map, alphaTest, side: THREE.DoubleSide, roughness, color, emissive, emissiveIntensity });
  const u = { uWind: { value: wind.vec }, uWindTime: { value: 0 } };
  mat.userData.windUniforms = u;
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_SWAY}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 wp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
            mat3 inv = mat3(1.0);
          #else
            vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #endif
          float f = ${mode === 'hang' ? '(1.0 - uv.y)' : mode === 'leaf' ? '1.0' : 'uv.y'};
          vec3 d = sway(wp, f, ${stiffness.toFixed(3)});
          ${mode === 'leaf' ? 'd = vec3(d.x * 0.4, d.y * 0.6 + d.x * 0.2, d.z * 0.4);' : ''}
          // back into object space (instances may be rotated and scaled)
          #ifdef USE_INSTANCING
            transformed += (inverse(mat3(modelMatrix) * mat3(instanceMatrix))) * d;
          #else
            transformed += inverse(mat3(modelMatrix)) * d;
          #endif
        }`);
    // mipmapping averages a cutout's thin leaves and strands away; scale alpha back up with the mip level
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 ts = vec2(textureSize(map, 0));
          vec2 dx = dFdx(vMapUv * ts), dy = dFdy(vMapUv * ts);
          float lod = 0.5 * log2(max(dot(dx, dx), dot(dy, dy)));
          diffuseColor.a *= 1.0 + max(0.0, lod) * 0.6;
        }`);
  };
  mat.customProgramCacheKey = () => `card-${mode}-${stiffness}`;
  return mat;
}

// the depth material a cutout card casts its shadow with: the blades, not the card's rectangle
export function cardDepthMaterial(map, alphaTest = 0.5) {
  return new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest, side: THREE.DoubleSide });
}

export function tickWindMaterials(materials, t) {
  for (const m of materials) if (m.userData.windUniforms) m.userData.windUniforms.uWindTime.value = t;
}
