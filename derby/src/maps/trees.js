// Trees for a map's parks (maps/empire.js; Will, 2026-11-24: "taller, modeled with more branches and more lifelike").
// One shape, drawn two ways:
//   plantTree(x, z, seed)        a voxel tree, in the world: beside the road, where a rocket can take its leaves off
//   makeGrove(scene, spots)      the same trees as drawn models, a few shapes drawn many times over: for the lawns
//                                behind, which nothing reaches. spots: [x, z, size, turn, kind]
// Either can be a tree in blossom (kind 1: maps/capital.js's cherries round the Tidal Basin): the same tree, lower and
// wider, in pink.
// A tree: a trunk that flares at the root and thins toward the top, four or five boughs that leave it at different
// heights and climb outward, a mass of leaves at the end of each and a crown over the top. The leaves are darker
// underneath and inside, lighter on top, with a ragged edge.
import * as THREE from 'three';
import { M, set, put, begin, MAT_R, MAT_G, MAT_B } from '../../../src/world.js';

// what a tree is made of: out(x, y, z, kind) for every voxel, kind 0 wood, 1 dark leaf, 2 leaf, 3 light leaf
function shape(seed, k, out) {
  let s = (seed * 2654435761) | 0; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const th = Math.round((20 + r() * 9) * k), blobs = [];
  // (the leaves' tone goes in patches a few voxels across, not voxel by voxel: it reads as masses of leaf, and the
  // world's mesher can lay one face over a patch)
  const patch = (x, y, z) => { let n = ((x >> 1) * 374761393 + (y >> 1) * 668265263 + (z >> 1) * 1274126177 + seed * 97) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  for (let y = 0; y <= th; y++) { out(0, y, 0, 0); out(1, y, 0, 0); out(0, y, 1, 0); out(1, y, 1, 0); if (y < th * 0.45) { out(-1, y, 0, 0); out(0, y, -1, 0); if (y < 3 * k) { out(2, y, 1, 0); out(1, y, 2, 0); out(-1, y, 1, 0); out(0, y, 2, 0); } } }
  const n = 4 + (r() < 0.5 ? 1 : 0), a0 = r() * 6.28;
  for (let b = 0; b < n; b++) {
    const a = a0 + b * 6.28 / n + (r() - 0.5) * 0.7, y0 = th * (0.5 + 0.38 * b / (n - 1)) + (r() - 0.5) * 2, len = (6 + r() * 5) * k * (1 - 0.3 * b / n), rise = 0.45 + r() * 0.4;
    for (let t = 1; t <= len; t++) { const x = Math.round(0.5 + Math.cos(a) * t), z = Math.round(0.5 + Math.sin(a) * t), y = Math.round(y0 + t * rise); out(x, y, z, 0); if (t < len * 0.5) out(x, y - 1, z, 0); }
    blobs.push([0.5 + Math.cos(a) * len, y0 + len * rise + 1, 0.5 + Math.sin(a) * len, (4 + r() * 1.8) * k]);
  }
  blobs.push([0.5, th + 3 * k, 0.5, (5.6 + r() * 1.6) * k], [0.5 + (r() - 0.5) * 6 * k, th + 1, 0.5 + (r() - 0.5) * 6 * k, (4 + r()) * k]);
  for (const [bx, by, bz, br] of blobs) {
    const R = Math.ceil(br);
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = dx * dx + dy * dy * 1.7 + dz * dz; if (d > br * br - r() * br * 1.7) continue;
      const X = Math.round(bx) + dx, Y = Math.round(by) + dy, Z = Math.round(bz) + dz, t = dy / br + (patch(X, Y, Z) - 0.5) * 0.7;
      out(X, Y, Z, t < -0.3 ? 1 : t > 0.35 ? 3 : 2);
    }
  }
}
const MATS = (kind = 0) => (kind === 1 ? [M.TRUNK, M.SAKURA, M.SAKURA, M.SAKURA2] : [M.TRUNK, M.HEDGE, M.LEAF, M.LEAF2]);

export function plantTree(x, z, seed, k = 1, kind = 0) {
  const mats = MATS(kind);
  begin('Tree', 'tree', false);
  shape(seed, k, (dx, dy, dz, kind) => { if (dy < 0) return; if (kind === 0) set(x + dx, dy, z + dz, mats[0]); else put(x + dx, dy, z + dz, mats[kind]); });
}

// one shape as a drawn model, in cubes two voxels across (it stands far off; four across for the ones past the map's
// edge): only the faces that show
function model(seed, kind = 0, C = 2) {
  const mats = MATS(kind), N2 = 28, NY2 = 44, v2 = new Uint8Array(N2 * NY2 * N2);
  shape(seed, 0.5, (dx, dy, dz, k) => { const x = dx + N2 / 2, z = dz + N2 / 2; if (x < 0 || z < 0 || dy < 0 || x >= N2 || z >= N2 || dy >= NY2) return; const c = (dy * N2 + z) * N2 + x; if (k === 0 || !v2[c]) v2[c] = k + 1; });
  let N = N2, NY = NY2, v = v2;
  if (C > 2) {
    // a coarse one: the same tree, eight of its cubes to one (what most of them are; a cube with only a twig in it is left out)
    N = N2 / 2; NY = NY2 / 2; v = new Uint8Array(N * NY * N);
    const n = [0, 0, 0, 0, 0];
    for (let y = 0; y < NY; y++) for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      n.fill(0); for (let k = 0; k < 8; k++) n[v2[((y * 2 + (k >> 2)) * N2 + z * 2 + ((k >> 1) & 1)) * N2 + x * 2 + (k & 1)]]++;
      const leaf = n[2] + n[3] + n[4];
      if (leaf >= 3) v[(y * N + z) * N + x] = n[3] >= n[2] && n[3] >= n[4] ? 3 : n[4] > n[2] ? 4 : 2; else if (n[1] >= 2 && leaf < 2) v[(y * N + z) * N + x] = 1;
    }
  }
  const h = N / 2;
  const at = (x, y, z) => (x < 0 || z < 0 || y < 0 || x >= N || z >= N || y >= NY ? 0 : v[(y * N + z) * N + x]);
  const pos = [], col = [], nor = [], idx = [];
  const F = [[1, 0, 0, [1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1]], [-1, 0, 0, [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0]], [0, 1, 0, [0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0]], [0, -1, 0, [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1]], [0, 0, 1, [1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 0, 1]], [0, 0, -1, [0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0]]];
  for (let y = 0; y < NY; y++) for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const m = at(x, y, z); if (!m) continue;
    const id = mats[m - 1], j = (0.9 + 0.2 * (((x * 73 + y * 151 + z * 37) % 17) / 17)) * (m === 1 ? 0.5 : 1);   // (the bark darker: it stands in its own crown's shade, which a model does not cast)
    for (const [nx, ny, nz, q] of F) {
      if (at(x + nx, y + ny, z + nz)) continue;
      const b = pos.length / 3;
      for (let k = 0; k < 12; k += 3) { pos.push((x + q[k] - h) * C, (y + q[k + 1]) * C, (z + q[k + 2] - h) * C); col.push(MAT_R[id] * j, MAT_G[id] * j, MAT_B[id] * j); nor.push(nx, ny, nz); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}

// spots: [x, z, size, turn, kind]; they are drawn in clumps (`clump` across), each left out when it is out of the
// picture. `cube`: how many voxels across a cube of the model is (2, or 4 for trees that are only ever seen from afar).
export function makeGrove(scene, spots, kinds = 3, { clump: CLUMP = 192, cube = 2 } = {}) {
  if (!spots.length) return { tris: 0 };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true }), M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const geos = new Map(), by = new Map();
  const geo = (k, kind) => { const id = k + kind * 100; if (!geos.has(id)) geos.set(id, model(31 + k * 17, kind, cube)); return geos.get(id); };
  spots.forEach((s, i) => { const key = Math.floor(s[0] / CLUMP) + ',' + Math.floor(s[1] / CLUMP) + ',' + (i % kinds) + ',' + (s[4] || 0); if (!by.has(key)) by.set(key, []); by.get(key).push(s); });
  let tris = 0;
  for (const [key, mine] of by) {
    const ks = key.split(','), g = geo(+ks[2], +ks[3]), mesh = new THREE.InstancedMesh(g, mat, mine.length);
    mine.forEach(([x, z, size, turn], i) => { q.setFromAxisAngle(UP, turn); M4.compose(p.set(x, 0, z), q, sc.setScalar(size)); mesh.setMatrixAt(i, M4); });
    mesh.computeBoundingSphere();
    mesh.castShadow = false; mesh.receiveShadow = false; mesh.name = 'grove'; scene.add(mesh); tris += g.index.count / 3 * mine.length;
  }
  return { tris };
}
