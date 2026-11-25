// The height of the road, for a map whose course climbs and dips (maps/empire.js): hills, a cut down into a tunnel,
// bridges and a flyover. Pictures of the map, a number a voxel:
//   gnd    the ground: 0, more on a hill, less in a cut
//   deck   a road in the air (a bridge, a flyover, a causeway): its height where one stands, nothing elsewhere
//   rails  the sides of a deck or a cut: from how low to how high a car is stopped by them
// floor(x, z, y) is the road under something at height y: the deck if it is on it or over it, else the ground. So a
// car under a flyover and a car on it each get their own road. Both are read smoothly between voxels, so a car on a
// slope rises and falls evenly.
// rail(x, z, y) is whether a deck's parapet or a cut's wall stands at (x, z) for something at height y (vehicle.js
// treats it as a wall). A car under a flyover is not stopped by the flyover's parapets, far over its head.
import { WX, WZ } from '../../../src/world.js';

export function makeHeights() {
  const gnd = new Float32Array(WX * WZ), deck = new Float32Array(WX * WZ).fill(NaN);
  const railLo = new Float32Array(WX * WZ), railHi = new Float32Array(WX * WZ).fill(NaN);
  const ON = 6;     // how far under a deck's top a thing still counts as on it (more than a ramp climbs in a car's length)
  // one of the pictures at (x, z), smoothly between the middles of the voxels round it
  const read = (A, x, z) => {
    const fx = Math.min(WX - 1.001, Math.max(0, x - 0.5)), fz = Math.min(WZ - 1.001, Math.max(0, z - 0.5));
    const x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0, c = z0 * WX + x0;
    const a = A[c], b = A[c + 1], d = A[c + WX], e = A[c + WX + 1];
    if (a !== a || b !== b || d !== d || e !== e) return A[Math.round(fz) * WX + Math.round(fx)];   // at a deck's edge: the nearest voxel's
    return (a * (1 - tx) + b * tx) * (1 - tz) + (d * (1 - tx) + e * tx) * tz;
  };
  const floor = (x, z, y = 0) => { const d = read(deck, x, z); return d === d && y >= d - ON ? d : read(gnd, x, z); };
  const rail = (x, z, y = 0) => {
    const ix = Math.floor(x), iz = Math.floor(z); if (ix < 0 || iz < 0 || ix >= WX || iz >= WZ) return false;
    const c = iz * WX + ix, hi = railHi[c];
    return hi === hi && y <= hi && y >= railLo[c];
  };
  // Lay a stretch of a course into the pictures: samples i0 to i1 of track T (wrapping), `half(i)` voxels each side of
  // its middle line at height H[i].
  //   kind 'hill'   the ground, its sides running down to nothing over `fade` past a shoulder `flat` wide
  //   kind 'cut'    the ground, hard-edged, with a wall each side up to `top` (above the ground round it)
  //   kind 'deck'   a road in the air, with a parapet each side
  function lay(T, H, i0, i1, half, { kind = 'hill', fade = 30, flat = 8, top = 4, thick = 2.6 } = {}) {
    const A = kind === 'deck' ? deck : gnd, { N, X, Z, TX, TZ, STEP } = T, n = ((i1 - i0) % N + N) % N;
    const out = kind === 'hill' ? flat + fade : thick;
    for (let k = 0; k < n; k++) {
      const i = (i0 + k) % N, j = (i + 1) % N, w = half(i);
      for (let a = 0; a < STEP; a += 0.5) {
        const t = a / STEP, h = H[i] + (H[j] - H[i]) * t, cx = X[i] + (X[j] - X[i]) * t, cz = Z[i] + (Z[j] - Z[i]) * t;
        for (let l = -(w + out) + 0.25; l <= w + out; l += 0.5) {   // (the middles of half voxels: as many each side)
          const x = Math.floor(cx + TZ[i] * l), z = Math.floor(cz - TX[i] * l);
          if (x < 0 || z < 0 || x >= WX || z >= WZ) continue;
          const c = z * WX + x, past = Math.abs(l) - w;
          if (past <= 0) {
            A[c] = h;
            // (a deck over a cut: the cut's wall stays a wall to what is down in it, and stops short of the deck)
            if (kind === 'deck' && railHi[c] === railHi[c] && railLo[c] < h - ON - 3) railHi[c] = Math.min(railHi[c], h - ON); else railHi[c] = NaN;
            continue;
          }
          if (kind === 'hill') {
            const f = past <= flat ? 1 : 1 - (past - flat) / fade, v = h * f * f * (3 - 2 * f);
            if (Math.abs(v) > Math.abs(A[c])) A[c] = v;
          } else if (!(kind === 'deck' ? deck[c] === deck[c] : gnd[c] < -0.01)) {   // (never across the road itself)
            railLo[c] = h - 3; railHi[c] = kind === 'deck' ? h + 4 : top;
          }
        }
      }
    }
  }
  return { gnd, deck, floor, rail, lay, read };
}
