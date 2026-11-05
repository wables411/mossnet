// Small value-noise / fbm for geometry displacement and placement on the CPU.
// (The shaders carry their own GLSL copy.)

function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = t => t * t * (3 - 2 * t);

export function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
  const l = (a, b, t) => a + (b - a) * t;
  const c000 = hash3(ix, iy, iz), c100 = hash3(ix + 1, iy, iz);
  const c010 = hash3(ix, iy + 1, iz), c110 = hash3(ix + 1, iy + 1, iz);
  const c001 = hash3(ix, iy, iz + 1), c101 = hash3(ix + 1, iy, iz + 1);
  const c011 = hash3(ix, iy + 1, iz + 1), c111 = hash3(ix + 1, iy + 1, iz + 1);
  return l(
    l(l(c000, c100, fx), l(c010, c110, fx), fy),
    l(l(c001, c101, fx), l(c011, c111, fx), fy),
    fz
  );
}

export function fbm3(x, y, z, oct = 3) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x * f + 17.1 * i, y * f + 3.7 * i, z * f + 9.3 * i);
    n += a; a *= 0.5; f *= 2.1;
  }
  return s / n; // 0..1
}
