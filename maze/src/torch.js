// The hand torch: a camera-held spotlight pointing where the player looks,
// the way a survival-horror handheld does. Warm white, a soft-edged cone,
// its light gone by about twelve metres; it lags a little behind the turn of
// the head and bobs faintly with the walk. One THREE.SpotLight without a
// shadow map (the wall shader is at the sampler limit, so a shadow map is
// not on the table on any tier); the rain, the spores and the fog are lit by
// the same cone through shared uniforms (particles.js, post.js). The light is
// only in the scene on dusk and night visits once the torch is owned: adding
// a light rebuilds every program, so it is done with the level build.
import * as THREE from '../lib/three.module.js?v=88cddb5c';

export const TORCH_ANGLE = 0.46;      // half-angle of the cone, radians (about 26 degrees)
export const TORCH_RANGE = 13;

export class Flashlight {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.light = new THREE.SpotLight(0xfff0d2, 0, TORCH_RANGE, TORCH_ANGLE, 0.6, 1.4);
    this.light.castShadow = false;
    this.target = new THREE.Object3D(); this.light.target = this.target;
    this.inScene = false;
    this.owned = false; this.night = 0; this.on = false;
    this.level = 0;                      // 0..1, the beam easing on and off
    this.dir = new THREE.Vector3(0, 0, -1); this.want = new THREE.Vector3();
    this.uniforms = {
      uTorchPos: { value: new THREE.Vector3() },
      uTorchDir: { value: new THREE.Vector3(0, 0, -1) },
      uTorchOn: { value: 0 },
      uTorchCos: { value: Math.cos(TORCH_ANGLE) },
      uTorchRange: { value: TORCH_RANGE },
    };
    this._r = new THREE.Vector3(); this._u = new THREE.Vector3(); this._f = new THREE.Vector3();
  }

  // is there a beam to be had this visit? (owned, and the hour is not day)
  get usable() { return this.owned && this.night > 0; }
  get lit() { return this.usable && this.on; }

  // at a level build: the light goes in or out of the scene with the hour and the ownership
  setLevel(owned, night) {
    this.owned = owned; this.night = night || 0;
    const want = this.usable;
    if (want && !this.inScene) { this.scene.add(this.light); this.scene.add(this.target); this.inScene = true; }
    if (!want && this.inScene) { this.scene.remove(this.light); this.scene.remove(this.target); this.inScene = false; }
    if (want) this.on = true;            // on by default after dark
    if (!want) { this.level = 0; this.light.intensity = 0; this.uniforms.uTorchOn.value = 0; }
  }
  toggle() { if (!this.usable) return false; this.on = !this.on; return this.on; }

  update(dt, player, stepPhase, stride) {
    if (!this.inScene) return;
    const cam = this.camera;
    const k = 1 - Math.exp(-dt * 6);
    this.level += ((this.lit ? 1 : 0) - this.level) * k;
    // the beam follows the view with a lag, like a hand bringing the torch round after the eyes
    this._f.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const lag = 1 - Math.exp(-dt * 9);
    this.dir.lerp(this._f, lag).normalize();
    // held low and to the right; a faint bob with the step on top of the camera's own
    this._r.set(1, 0, 0).applyQuaternion(cam.quaternion); this._u.set(0, 1, 0).applyQuaternion(cam.quaternion);
    const ph = (stepPhase || 0) * Math.PI * 2, s = stride || 0;
    const bobY = Math.sin(ph * 2 + 0.6) * 0.012 * s, bobX = Math.sin(ph + 0.3) * 0.008 * s;
    this.light.position.copy(cam.position).addScaledVector(this._r, 0.14 + bobX).addScaledVector(this._u, -0.12 + bobY);
    this.target.position.copy(this.light.position).addScaledVector(this.dir, 6).addScaledVector(this._u, bobY * 3).addScaledVector(this._r, bobX * 3);
    this.light.intensity = 20 * this.level;
    const u = this.uniforms;
    u.uTorchPos.value.copy(this.light.position);
    u.uTorchDir.value.copy(this.target.position).sub(this.light.position).normalize();
    u.uTorchOn.value = this.level;
  }

  // the beam's direction in view space, for the post pass's glow
  viewDir(out) { return out.copy(this.uniforms.uTorchDir.value).transformDirection(this.camera.matrixWorldInverse); }
}

// GLSL: how strongly the torch lights a world point (0 when off or out of the cone), shared by the particle materials
export const TORCH_GLSL = /* glsl */`
  uniform vec3 uTorchPos, uTorchDir; uniform float uTorchOn, uTorchCos, uTorchRange;
  float torchAt(vec3 p) {
    if (uTorchOn <= 0.001) return 0.0;
    vec3 v = p - uTorchPos; float d = length(v); v /= max(d, 1e-4);
    float c = dot(v, uTorchDir);
    float cone = smoothstep(uTorchCos - 0.05, uTorchCos + 0.09, c) * (0.6 + 0.4 * smoothstep(uTorchCos + 0.06, 1.0, c));
    float fall = 1.0 / (1.0 + pow(d / (uTorchRange * 0.35), 2.0)) * smoothstep(uTorchRange, uTorchRange * 0.5, d);
    return uTorchOn * cone * fall;
  }`;
// patch a PointsMaterial so its points brighten inside the beam (the points sit in world space already)
export function torchPoints(mat, uniforms, gain = 7.0) {
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTorchP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvTorchP = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTorchP;' + TORCH_GLSL)
      .replace('outgoingLight = diffuseColor.rgb;', `float tl = torchAt(vTorchP) * ${gain.toFixed(1)}; outgoingLight = diffuseColor.rgb * (1.0 + tl * vec3(1.0, 0.95, 0.85)); diffuseColor.a = min(1.0, diffuseColor.a * (1.0 + tl * 0.5));`);
  };
  mat.customProgramCacheKey = () => 'torch-points-' + gain;
  mat.needsUpdate = true;
}
