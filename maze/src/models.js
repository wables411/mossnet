// Photoscanned props (Poly Haven, CC0), and the original sets grown in build/gen_*, brought in as compressed GLBs, two
// texture tiers (hi 1K, lo 512). A location asks for the set it uses; each
// model is fetched once, its node transforms baked into the geometry, and
// the pieces handed back as {geometry, material, bounds, samples} ready for
// instancing. `samples` are surface points for the moss shoots to stand on.
import * as THREE from '../lib/three.module.js?v=88cddb5c';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { MeshoptDecoder } from '../lib/meshopt_decoder.module.js';

export const MODELS = {
  // what each scan is, and how it is used: kind picks the placement rule, scale is applied on top of the scan's real size
  dead_tree_trunk:    { kind: 'log', scale: [0.9, 1.3], mossTop: 0.7 },
  dead_tree_trunk_02: { kind: 'log', scale: [0.7, 1.1], mossTop: 0.7 },
  tree_stump_01:      { kind: 'stump', scale: [0.8, 1.2], mossTop: 0.8 },
  tree_stump_02:      { kind: 'stump', scale: [0.8, 1.2], mossTop: 0.8 },
  root_cluster_01:    { kind: 'stump', scale: [0.45, 0.7], mossTop: 0.5 },
  boulder_01:         { kind: 'boulder', scale: [0.45, 0.9], mossTop: 0.7 },
  rock_07:            { kind: 'stone', scale: [1.5, 3.5], mossTop: 0.5 },
  rock_09:            { kind: 'stone', scale: [2.5, 5], mossTop: 0.4 },
  stone_01:           { kind: 'stone', scale: [1.5, 3], mossTop: 0.4 },
  rock_moss_set_01:   { kind: 'mossrocks', scale: [0.3, 0.55], mossTop: 0.3 },
  rock_moss_set_02:   { kind: 'mossrocks', scale: [0.3, 0.55], mossTop: 0.3 },
  fern_02:            { kind: 'plant', scale: [0.5, 0.9], mossTop: 0 },
  shrub_02:           { kind: 'plant', scale: [0.35, 0.6], mossTop: 0 },
  moss_01:            { kind: 'mossclump', scale: [1.5, 3], mossTop: 0 },
  island_tree_02:     { kind: 'tree', scale: [2.2, 3.2], mossTop: 0.3 },
  tree_small_02:      { kind: 'tree', scale: [1.8, 2.6], mossTop: 0.3 },
  pine_tree_01:       { kind: 'tree', scale: [1.0, 1.4], mossTop: 0.2 },    // a tall conifer: stands in for cedar and hemlock
  fir_tree_01:        { kind: 'tree', scale: [1.0, 1.4], mossTop: 0.2 },    // a fir: stands in for Sitka spruce
  pine_roots:         { kind: 'roots', scale: [0.8, 1.3], mossTop: 0.5 },   // roots over rock, laid against the wall foot
  root_cluster_02:    { kind: 'stump', scale: [0.4, 0.7], mossTop: 0.5 },
  // the Hoh's original set (build/gen_hoh): built at true size from build/field/hoh.md, so scale only varies it.
  // share: how many of the place's tree cells this species takes (the scans each took a full share)
  hoh_sitka_spruce:    { kind: 'tree', scale: [0.85, 1.15], mossTop: 0.25, share: 0.75 },
  hoh_western_hemlock: { kind: 'tree', scale: [0.85, 1.15], mossTop: 0.25, share: 0.7 },
  hoh_bigleaf_maple:   { kind: 'tree', scale: [0.85, 1.15], mossTop: 0.5, share: 0.45, hang: 4 },
  hoh_sword_fern:      { kind: 'plant', scale: [0.8, 1.15], mossTop: 0, fern: true },
  hoh_oregon_oxalis:   { kind: 'plant', scale: [0.8, 1.3], mossTop: 0 },
  hoh_spruce_snag:     { kind: 'stump', scale: [0.85, 1.1], mossTop: 0.6 },
  hoh_river_cobbles:   { kind: 'stone', scale: [0.8, 1.6], mossTop: 0.45, own: true },   // keeps its own greywacke and argillite
};

export class Models {
  constructor(quality) {
    this.tier = quality.high ? 'hi' : 'lo';
    this.loader = new GLTFLoader();
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.cache = new Map();     // id -> Promise<{pieces}>
  }

  load(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const p = new Promise((resolve, reject) => {
      this.loader.load(`models/${this.tier}/${id}.glb`, gltf => resolve(this.prepare(id, gltf)), undefined, reject);
    }).catch(err => { console.warn('model failed', id, err); this.cache.delete(id); return { pieces: [], bounds: new THREE.Box3() }; });
    this.cache.set(id, p);
    return p;
  }

  loadAll(ids) { return Promise.all(ids.map(id => this.load(id))); }

  prepare(id, gltf) {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);
    const pieces = [];
    const bounds = new THREE.Box3();
    scene.traverse(o => {
      if (!o.isMesh) return;
      const geo = o.geometry.clone();
      // quantized attributes are normalized integers; bake the node transform into floats so nothing clamps
      for (const name of ['position', 'normal', 'uv']) {
        const a = geo.attributes[name]; if (!a || a.array instanceof Float32Array) continue;
        const n = a.itemSize, f = new Float32Array(a.count * n);
        for (let i = 0; i < a.count; i++) { f[i * n] = a.getX(i); if (n > 1) f[i * n + 1] = a.getY(i); if (n > 2) f[i * n + 2] = a.getZ(i); }
        geo.setAttribute(name, new THREE.BufferAttribute(f, n));
      }
      geo.applyMatrix4(o.matrixWorld);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      geo.computeBoundingBox();
      bounds.union(geo.boundingBox);
      const mat = o.material;
      mat.side = THREE.DoubleSide;
      if (mat.alphaTest > 0 || mat.transparent) { mat.transparent = false; mat.alphaTest = Math.max(mat.alphaTest, 0.5); mat.depthWrite = true; }
      mat.envMapIntensity = 0.35;
      if (mat.map) mat.map.anisotropy = 4;
      pieces.push({ geometry: geo, material: mat, samples: sampleSurface(geo, 400) });
    });
    return { id, pieces, bounds, spec: MODELS[id] };
  }
}

// a spread of surface points with normals, for the shoots: random vertices of the scan (they are dense)
function sampleSurface(geo, n) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const count = pos.count;
  const out = new Float32Array(n * 6);
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < n; i++) {
    const v = Math.floor(rnd() * count);
    out[i * 6] = pos.getX(v); out[i * 6 + 1] = pos.getY(v); out[i * 6 + 2] = pos.getZ(v);
    out[i * 6 + 3] = nor ? nor.getX(v) : 0; out[i * 6 + 4] = nor ? nor.getY(v) : 1; out[i * 6 + 5] = nor ? nor.getZ(v) : 0;
  }
  return out;
}
