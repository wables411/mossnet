// One full-screen pass over an HDR render: depth of field driven by an
// autofocus that hunts for what is in the centre of frame, a camera-like
// sharpen, a mild grade, chromatic aberration at the edges, grain and a
// vignette, then ACES tone mapping. Everything that makes it feel filmed.
import * as THREE from '../lib/three.module.js?v=88cddb5c';

export class Post {
  constructor(renderer, quality) {
    this.renderer = renderer; this.q = quality;
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    this.rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, {
      type: THREE.HalfFloatType, samples: quality.high ? 4 : 0, depthBuffer: true,
    });
    this.rt.depthTexture = new THREE.DepthTexture(size.x * pr, size.y * pr, THREE.UnsignedIntType);
    this.rt.texture.minFilter = THREE.LinearFilter; this.rt.texture.magFilter = THREE.LinearFilter;

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.rt.texture },
        tDepth: { value: this.rt.depthTexture },
        uNear: { value: 0.05 }, uFar: { value: 200 },
        uFocus: { value: 2.5 }, uAperture: { value: 0.0045 }, uMaxBlur: { value: quality.high ? 0.009 : 0.005 },
        uRes: { value: new THREE.Vector2(size.x * pr, size.y * pr) },
        uTime: { value: 0 }, uFlash: { value: 0 }, uBlur: { value: 0 },
        uGrain: { value: 0.028 }, uVignette: { value: 0.32 },
        uExposure: { value: 1.45 }, uNight: { value: 0 },
        // the hand torch's beam through the fog: strength, its direction in view space, the cone's cosine, the view's tangents, the fog
        uTorch: { value: 0 }, uTorchDir: { value: new THREE.Vector3(0, 0, -1) }, uTorchCos: { value: 0.9 }, uTan: { value: new THREE.Vector2(1, 1) }, uFogDensity: { value: 0.08 },
      },
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`
        varying vec2 vUv;
        uniform sampler2D tDiffuse, tDepth;
        uniform float uNear, uFar, uFocus, uAperture, uMaxBlur, uTime, uFlash, uBlur, uGrain, uVignette, uExposure, uNight;
        uniform vec2 uRes;
        uniform float uTorch, uTorchCos, uFogDensity; uniform vec3 uTorchDir; uniform vec2 uTan;
        #define TAPS ${quality.high ? 16 : 8}
        float linDepth(vec2 uv) {
          float z = texture2D(tDepth, uv).x;
          float ndc = z * 2.0 - 1.0;
          return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
        }
        float coc(float d) { return clamp(abs(1.0 / max(d, 0.05) - 1.0 / uFocus) * uAperture * uFocus, 0.0, uMaxBlur); }
        float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        vec3 fetch(vec2 uv) { return texture2D(tDiffuse, uv).rgb; }
        vec3 dof(vec2 uv, float ca) {
          float d = linDepth(uv);
          float c = coc(d) + uBlur;
          vec2 asp = vec2(uRes.y / uRes.x, 1.0);
          vec3 sum = vec3(0.0); float wsum = 0.0;
          float rot = hash(uv * uRes) * 6.2831;
          for (int i = 0; i < TAPS; i++) {
            float fi = float(i) + 0.5;
            float r = sqrt(fi / float(TAPS));
            float a = fi * 2.399963 + rot;
            vec2 o = vec2(cos(a), sin(a)) * r * c * asp;
            vec2 suv = uv + o;
            // a sharp foreground tap should not bleed into a blurred background and vice versa
            float cs = coc(linDepth(suv)) + uBlur;
            float w = clamp(cs / max(c, 1e-5), 0.0, 1.0) * 0.8 + 0.2;
            vec3 s = vec3(fetch(suv + o * ca * 0.0 + vec2(ca, 0.0)).r, fetch(suv).g, fetch(suv - vec2(ca, 0.0)).b);
            sum += s * w; wsum += w;
          }
          return sum / max(wsum, 1e-4);
        }
        vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        void main() {
          vec2 uv = vUv;
          vec2 cen = uv - 0.5;
          float r2 = dot(cen, cen);
          float ca = r2 * 0.002;
          vec3 col = dof(uv, ca);
          // camera sharpening (unsharp mask), only where in focus
          float d = linDepth(uv); float c = coc(d);
          vec2 px = 1.0 / uRes;
          vec3 blur = (fetch(uv + vec2(px.x, 0.0)) + fetch(uv - vec2(px.x, 0.0)) + fetch(uv + vec2(0.0, px.y)) + fetch(uv - vec2(0.0, px.y))) * 0.25;
          col += (col - blur) * 0.5 * (1.0 - smoothstep(0.0, 0.004, c));
          // grade: lift the blacks a touch (haze in the lens), cool the shadows, keep greens honest
          float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(col, vec3(lum), -0.10 + 0.16 * uNight);   // the colour drains a little after dark
          col += vec3(0.010, 0.014, 0.016) * (1.0 + 0.5 * uNight);   // the lens haze reads bluer at night
          col *= mix(vec3(1.02, 1.0, 0.97), vec3(0.94, 0.98, 1.08), uNight);
          // the torch beam in the air: what the fog scatters back along this pixel's ray while it is inside the cone,
          // more the longer the ray runs through lit air (up to the thing it hits), soft at the cone's edge, brightest
          // along its axis, warm
          if (uTorch > 0.001) {
            vec3 rd = normalize(vec3((uv * 2.0 - 1.0) * uTan, -1.0));
            float cc = dot(rd, uTorchDir);
            float cone = smoothstep(uTorchCos - 0.06, uTorchCos + 0.12, cc) * (0.45 + 0.55 * smoothstep(uTorchCos + 0.04, 1.0, cc));
            float path = atan(min(d, 16.0) / 3.5) * 0.64;
            float air = clamp(uFogDensity * 6.0, 0.25, 1.0);
            col += vec3(1.0, 0.9, 0.72) * cone * path * air * uTorch * 0.22;
          }
          // the exit flash: the lens flooding with daylight
          col = mix(col, vec3(1.2, 1.15, 1.0), uFlash);
          // the camera's gain comes up after dark (and brings the grain with it)
          col = aces(col * uExposure);
          // vignette and grain after the curve
          col *= 1.0 - uVignette * smoothstep(0.15, 0.85, r2 * 2.2);
          float g = hash(uv * uRes + fract(uTime) * 1000.0) - 0.5;
          col += g * uGrain * (1.1 - lum);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    this.mat.toneMapped = false;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.focus = 2.5;
  }

  // the hour: more gain, more grain, a wider aperture and a heavier vignette after dark; dusk half way
  setHour(night = 0, dusk = 0) {
    const u = this.mat.uniforms;
    u.uNight.value = night;
    u.uExposure.value = 1.45 + 0.75 * night;
    u.uGrain.value = 0.028 + 0.034 * night;
    u.uAperture.value = 0.0045 + 0.0022 * night;
    u.uVignette.value = 0.32 + 0.1 * night + 0.03 * dusk;
  }

  setSize(w, h) {
    const pr = this.renderer.getPixelRatio();
    this.rt.setSize(w * pr, h * pr);
    this.mat.uniforms.uRes.value.set(w * pr, h * pr);
  }

  // the hand torch's beam, for the glow in the air: strength 0..1, its direction in view space, the cone's cosine
  setTorch(strength, dirView, cosAngle, camera, fogDensity) {
    const u = this.mat.uniforms;
    u.uTorch.value = strength;
    if (strength > 0) {
      u.uTorchDir.value.copy(dirView); u.uTorchCos.value = cosAngle; u.uFogDensity.value = fogDensity;
      const t = Math.tan(camera.fov * Math.PI / 360); u.uTan.value.set(t * camera.aspect, t);
    }
  }

  // autofocus: ease toward the target with a small lag, like a camera hunting
  autofocus(target, dt) {
    const k = 1 - Math.exp(-dt * 3.2);
    this.focus += (target - this.focus) * k;
    this.mat.uniforms.uFocus.value = Math.max(0.35, this.focus);
  }

  render(scene, camera, t) {
    const u = this.mat.uniforms;
    u.uTime.value = t; u.uNear.value = camera.near; u.uFar.value = camera.far;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.cam);
  }
}
