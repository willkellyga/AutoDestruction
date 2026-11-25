// Shaped dirt for an arena (maps/arena.js): ramps, tables, kickers and rollers a car drives up and flies off, and the
// decks that stand on the floor and are driven over (rows of crushed cars, buses in a gap). A map lists the pieces;
// this gives it the height of the floor anywhere (MAP.floor: vehicle.js rides it, and with MAP.ledges a car goes off
// a drop instead of stopping at it), the floor's mesh with the dirt shaped (MAP.floorMesh: ground.js draws it), and
// where it is too steep to drive (the rivals' route grid).
//
// Every piece is square to the map. A piece: { x0, x1, z0, z1, h } is a flat top `h` up, and what falls away from each
// of its four sides is `w`, `e`, `n`, `s`: a number is a ramp that long (to the floor); 0 is a lip, straight down; left
// out, it is the heap's own side, `skirt` voxels wide (too steep to drive up).
//   kind 'deck'    a top with straight sides that is not dirt (crushed cars, buses): not drawn here, its models are the
//                  map's; `roof(u, v)` can put bumps on it (u, v: 0 to 1 across it)
//   kind 'rollers' `humps` of them `h` high in a row along `axis`, between the ends
import { WX, WZ } from '../../src/world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SKIRT = 5, STEEP = 3.2;   // (a car climbs a step of a few voxels: the lips at the ends of the decks are not walls to it)

export function makeDirt(pieces) {
  for (const p of pieces) {
    p.skirt = p.skirt ?? (p.kind === 'deck' ? 0 : SKIRT);
    for (const k of ['w', 'e', 'n', 's']) if (p[k] === undefined) p[k] = p.skirt;
    p.bx0 = p.x0 - p.w; p.bx1 = p.x1 + p.e; p.bz0 = p.z0 - p.n; p.bz1 = p.z1 + p.s;
  }
  // one piece's height at a point
  function high(p, x, z) {
    if (x <= p.bx0 || x >= p.bx1 || z <= p.bz0 || z >= p.bz1) return 0;
    const fx = x < p.x0 ? (p.x0 - x) / p.w : x > p.x1 ? (x - p.x1) / p.e : 0, fz = z < p.z0 ? (p.z0 - z) / p.n : z > p.z1 ? (z - p.z1) / p.s : 0;
    let h = p.h * (1 - fx) * (1 - fz);
    if (p.kind === 'rollers') { const t = p.axis === 'x' ? (x - p.x0) / (p.x1 - p.x0) : (z - p.z0) / (p.z1 - p.z0); h *= t <= 0 || t >= 1 ? 0 : 0.5 - 0.5 * Math.cos(t * p.humps * Math.PI * 2); }
    else if (p.roof && fx === 0 && fz === 0) h += p.roof((x - p.x0) / (p.x1 - p.x0), (z - p.z0) / (p.z1 - p.z0));
    return h;
  }
  const at = (x, z, drawn) => { let h = 0; for (const p of pieces) { if (drawn && p.kind === 'deck') continue; const v = high(p, x, z); if (v > h) h = v; } return h; };
  const floor = (x, z) => at(x, z, false);
  // too steep to drive up or along: the heaps' sides, the lips, the sides of the decks
  const steep = (x, z) => { const h = floor(x, z); return Math.abs(floor(x + 3, z) - h) > STEEP || Math.abs(floor(x - 3, z) - h) > STEEP || Math.abs(floor(x, z + 3) - h) > STEEP || Math.abs(floor(x, z - 3) - h) > STEEP; };

  // ---- the mesh: a grid whose lines run where the dirt's creases are, so every ramp and lip is drawn as it is ridden ----
  function mesh() {
    const lines = (a0, a1, b0, b1, w0, w1, world) => {
      const L = [0, world];
      const crease = (v, lip) => { if (lip) L.push(v - 0.12, v + 0.12); else L.push(v); };
      for (const p of pieces) {
        if (p.kind === 'deck') continue;
        crease(p[a0], p[w0] === 0); crease(p[a1], p[w1] === 0);
        if (p[w0] > 0) L.push(p[a0] - p[w0]); if (p[w1] > 0) L.push(p[a1] + p[w1]);
        if (p.kind === 'rollers' && (p.axis === 'x') === (a0 === 'x0')) for (let k = 1; k < p.humps * 10; k++) L.push(p[a0] + (p[a1] - p[a0]) * k / (p.humps * 10));
      }
      L.sort((a, b) => a - b);
      const out = [];
      for (const v of L) {
        if (out.length && v - out[out.length - 1] < 0.05) continue;
        // no gap wider than 10 where the dirt is (the light falls on it more evenly), nor than 64 anywhere
        if (out.length) { const from = out[out.length - 1], gap = v - from, max = from >= b0 && v <= b1 ? 10 : 64, n = Math.ceil(gap / max); for (let k = 1; k < n; k++) out.push(from + gap * k / n); }
        out.push(v);
      }
      return out;
    };
    let bx0 = WX, bx1 = 0, bz0 = WZ, bz1 = 0;
    for (const p of pieces) { bx0 = Math.min(bx0, p.bx0); bx1 = Math.max(bx1, p.bx1); bz0 = Math.min(bz0, p.bz0); bz1 = Math.max(bz1, p.bz1); }
    const X = lines('x0', 'x1', bx0 - 1, bx1 + 1, 'w', 'e', WX), Z = lines('z0', 'z1', bz0 - 1, bz1 + 1, 'n', 's', WZ), nx = X.length, nz = Z.length, V = nx * nz;
    const position = new Float32Array(V * 3), uv = new Float32Array(V * 2), normal = new Float32Array(V * 3), index = new Uint32Array((nx - 1) * (nz - 1) * 6);
    const H = (x, z) => at(x, z, true), E = 0.4;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const v = j * nx + i, x = X[i], z = Z[j];
      position[v * 3] = x; position[v * 3 + 1] = H(x, z); position[v * 3 + 2] = z; uv[v * 2] = x / WX; uv[v * 2 + 1] = 1 - z / WZ;
      const sx = clamp((H(x + E, z) - H(x - E, z)) / (2 * E), -2.5, 2.5), sz = clamp((H(x, z + E) - H(x, z - E)) / (2 * E), -2.5, 2.5), l = Math.hypot(sx, 1, sz);
      normal[v * 3] = -sx / l; normal[v * 3 + 1] = 1 / l; normal[v * 3 + 2] = -sz / l;
    }
    let n = 0;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; index[n++] = a; index[n++] = c; index[n++] = b; index[n++] = b; index[n++] = c; index[n++] = d; }
    return { position, uv, normal, index };
  }
  return { pieces, floor, steep, mesh, high };
}
