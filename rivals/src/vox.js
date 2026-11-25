// Shared voxel sculpting kit for the rival kaiju: the same method as the player kaiju (kaiju/src/model.js).
// Each body part is a block of cubes sampled from blended shapes, hung on its own bone, and meshed with baked corner shading.
// Design units are the town's quarter-metre voxels; a monster is sampled RES times finer (eighth-metre cubes).
// Rival sculpts are written in the model's rest space (feet on y = 0, facing +Z), with every bone's rest rotation zero, so a part's
// fill just adds its bone's rest position back on (see `assemble`).
import * as THREE from 'three';

export const RES = 2;
export const GLOW = 1 << 24; // flag on a colour: this voxel belongs to the glowing mesh

export function hash(i, j, k, s = 0) { let h = (i * 374761393 + j * 668265263 + k * 2147483647 + s * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export const frac = (v) => v - Math.floor(v);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export function tone(hex, m) { return (Math.min(255, ((hex >> 16) & 255) * m) << 16) | (Math.min(255, ((hex >> 8) & 255) * m) << 8) | Math.min(255, (hex & 255) * m); }
export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export const smax = (a, b, k) => -smin(-a, -b, k);
export function sdE(x, y, z, cx, cy, cz, rx, ry, rz) {
  const a = (x - cx) / rx, b = (y - cy) / ry, c = (z - cz) / rz, k0 = Math.sqrt(a * a + b * b + c * c);
  if (k0 < 1e-6) return -Math.min(rx, ry, rz);
  const a2 = a / rx, b2 = b / ry, c2 = c / rz; return k0 * (k0 - 1) / Math.sqrt(a2 * a2 + b2 * b2 + c2 * c2);
}
export const T = { cap: 0 }; // how far along the capsule the last tested point sat, 0 to 1
export function cap(x, y, z, ax, ay, az, bx, by, bz, ra, rb) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz;
  let t = ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; T.cap = t;
  const px = ax + dx * t - x, py = ay + dy * t - y, pz = az + dz * t - z;
  return Math.sqrt(px * px + py * py + pz * pz) - (ra + (rb - ra) * t);
}
// A 3D cell pattern. After a call, W.e is small near the line between two cells and W.id is a random number for the cell.
export const W = { e: 0, id: 0 };
export function cells(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); let f1 = 99, f2 = 99, id = 0;
  for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const cx = ix + di, cy = iy + dj, cz = iz + dk;
    const px = cx + hash(cx, cy, cz, seed) - x, py = cy + hash(cx, cy, cz, seed + 1) - y, pz = cz + hash(cx, cy, cz, seed + 2) - z, d = px * px + py * py + pz * pz;
    if (d < f1) { f2 = f1; f1 = d; id = hash(cx, cy, cz, seed + 3); } else if (d < f2) f2 = d;
  }
  W.e = Math.sqrt(f2) - Math.sqrt(f1); W.id = id;
}
// A voxel-sized random number, for mottling a colour.
export const grain = (x, y, z, s) => hash(Math.floor(x * RES), Math.floor(y * RES), Math.floor(z * RES), s);

// ---- voxelise one part and turn its exposed faces into meshes (skin, glow) with baked corner shading ----
const AXES = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
// def.faces(x, y, z, axis, sign, size), if given, says which faces of a voxel to draw (a wall seen from one side only).
export function buildPart(def) {
  const [x0, y0, z0, x1, y1, z1] = def.box, nx = Math.round((x1 - x0) * RES), ny = Math.round((y1 - y0) * RES), nz = Math.round((z1 - z0) * RES), h = 1 / RES;
  const col = new Int32Array(nx * ny * nz).fill(-1);
  const at = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) ? -1 : col[(k * ny + j) * nx + i];
  let count = 0, edge = false;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = def.fill(x0 + (i + 0.5) * h, y0 + (j + 0.5) * h, z0 + (k + 0.5) * h); col[(k * ny + j) * nx + i] = c;
    if (c >= 0) { count++; if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) edge = true; }
  }
  const out = [{ p: [], n: [], c: [], ix: [] }, { p: [], n: [], c: [], ix: [] }], tmp = new THREE.Color(), cell = [0, 0, 0], q = [0, 0, 0];
  const solid = (c, a, da, u, du, v, dv) => { q[0] = c[0]; q[1] = c[1]; q[2] = c[2]; q[a] += da; q[u] += du; q[v] += dv; return at(q[0], q[1], q[2]) >= 0 ? 1 : 0; };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = at(i, j, k); if (c < 0) continue;
    cell[0] = i; cell[1] = j; cell[2] = k;
    const g = out[c & GLOW ? 1 : 0];
    tmp.setHex(c & 0xffffff).multiplyScalar(0.95 + 0.1 * hash(i, j, k, def.seed + 77));
    for (const [a, u, v] of AXES) for (const s of [1, -1]) {
      if (solid(cell, a, s, u, 0, v, 0)) continue;
      if (def.faces && !def.faces(x0 + (i + 0.5) * h, y0 + (j + 0.5) * h, z0 + (k + 0.5) * h, a, s, h)) continue;   // (a part may keep only some faces: one-sided)
      const base = g.p.length / 3, ao = [];
      const corners = s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
      for (const [cu, cv] of corners) {
        const pos = [i, j, k]; pos[a] += s > 0 ? 1 : 0; pos[u] += cu; pos[v] += cv; g.p.push(x0 + pos[0] * h, y0 + pos[1] * h, z0 + pos[2] * h);
        const nrm = [0, 0, 0]; nrm[a] = s; g.n.push(nrm[0], nrm[1], nrm[2]);
        const du = cu ? 1 : -1, dv = cv ? 1 : -1, s1 = solid(cell, a, s, u, du, v, 0), s2 = solid(cell, a, s, u, 0, v, dv), cr = solid(cell, a, s, u, du, v, dv);
        const o = s1 && s2 ? 0 : 3 - s1 - s2 - cr; ao.push(o);
        const sh = 0.6 + 0.4 * o / 3; g.c.push(tmp.r * sh, tmp.g * sh, tmp.b * sh);
      }
      if (ao[0] + ao[2] >= ao[1] + ao[3]) g.ix.push(base, base + 1, base + 2, base, base + 2, base + 3); else g.ix.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    }
  }
  return { count, edge, solid: globalThis.__keepGrids ? { col, nx, ny, nz, x0, y0, z0 } : null, geos: out.map((g) => {
    if (!g.ix.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('normal', new THREE.Int8BufferAttribute(g.n, 3));   // axis normals are -1, 0 or 1: a byte each (memory, phones)
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3)); geo.setIndex(g.ix); return geo;
  }) };
}

// ---- assemble a creature: one bone per part ----
// A part: { name, parent, pivot (in the parent's space), box and fill }. With `world: true` the box and fill are written in the model's
// rest space and shifted onto the bone here; otherwise they are in the bone's own space (used for legs, sculpted hanging straight down).
export function assemble(def) {
  const skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: def.rough ?? 0.85, metalness: 0 });
  const glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, emissive: new THREE.Color(def.glow), emissiveIntensity: def.glowBase ?? 0.6 });
  const root = new THREE.Group(); root.name = def.name;
  const bones = {}, rest = {}, org = {}, clipped = []; let voxels = 0, tris = 0;
  for (const p of def.parts) {
    const po = p.parent ? org[p.parent] : [0, 0, 0], o = [po[0] + p.pivot[0], po[1] + p.pivot[1], po[2] + p.pivot[2]]; org[p.name] = o;
    const b = new THREE.Group(); b.name = p.name; b.position.fromArray(p.pivot); rest[p.name] = { pos: p.pivot.slice() };
    if (p.box) {
      const local = p.world ? { seed: p.seed || 1, box: [p.box[0] - o[0], p.box[1] - o[1], p.box[2] - o[2], p.box[3] - o[0], p.box[4] - o[1], p.box[5] - o[2]], fill: (x, y, z) => p.fill(x + o[0], y + o[1], z + o[2]) } : p;
      const built = buildPart(local); voxels += built.count; if (built.edge) clipped.push(p.name);
      built.geos.forEach((geo, gi) => { if (!geo) return; const m = new THREE.Mesh(geo, gi ? glowMat : skinMat); m.name = p.name + (gi ? '_glow' : '_skin'); m.castShadow = true; m.receiveShadow = true; b.add(m); tris += geo.index.count / 3; });
    }
    (p.parent ? bones[p.parent] : root).add(b); bones[p.name] = b;
  }
  return { name: def.name, root, bones, rest, org, skinMat, glowMat, def, stats: { voxels, tris, parts: def.parts.length, clipped } };
}

// Split one continuous sculpt over a chain of bones along z: each bone takes the slab from its pivot back to the next one (or forward),
// plus a ball round its own pivot so that bent joints stay closed.
export function slab(fill, z0, z1, ball) {
  return (x, y, z) => {
    if (z < z0 || z >= z1) { if (!ball) return -1; const dx = x - ball[0], dy = y - ball[1], dz = z - ball[2]; if (dx * dx + dy * dy + dz * dz > ball[3] * ball[3]) return -1; }
    return fill(x, y, z);
  };
}
