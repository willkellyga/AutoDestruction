// Trees for a map's parks (maps/empire.js, maps/capital.js).
// Will, 2026-11-24: "taller, modeled with more branches and more lifelike"; then of Washington: "trees are low poly
// compared to what we see". So a tree is grown a voxel at a time, whatever draws it, and nothing near the camera is
// ever shown in bigger cubes than the road and the cars beside it:
//   plantTree(x, z, seed, k, kind)   a voxel tree, in the world: beside the road, where a rocket can take its leaves off
//   makeGrove(api, spots)            the same trees as drawn models, for the lawns behind and the woods past the map's
//                                    edge, which nothing reaches. spots: [x, z, size, turn, kind]. A model has three
//                                    cuts: a voxel to a cube near the camera, two a little way off, four far away;
//                                    each frame every tree in the picture is put in the cut its distance asks for.
// kind 0 is an elm (a tall trunk that forks high into boughs that climb and arch over, a vase of a tree); kind 1 a
// cherry in blossom (low, wide, pink). The boughs fork again, and each carries its own masses of leaf: darker
// underneath and inside, lighter on top and toward the sun, ragged at the edge, with the wood showing between.
import * as THREE from 'three';
import { M, set, put, begin, MAT_R, MAT_G, MAT_B } from '../../../src/world.js';

const hash = (x, y, z, s) => { let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + Math.imul(s, 97)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

// A tree as a box of cells: v 0 empty, 1 wood, 2 leaf; tone 0 (deep shade) to 1 (in the sun) for the leaves. The
// middle of the trunk is the corner (O + 1, O + 1) of the cells; O is a multiple of four and the box's sides of eight,
// so the trunk falls in one cube of the coarser cuts and does not come out fat.
function grow(seed, k, kind) {
  let s = (seed * 2654435761) | 0; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const cherry = kind === 1;
  const th = Math.round((cherry ? 8 + r() * 3 : 15 + r() * 6) * k);
  const O = Math.ceil(((cherry ? 15 : 13) * k + 8) / 4) * 4, N = O * 2 + 8, NY = Math.ceil((th + (cherry ? 12 : 15) * k + 10) / 8) * 8, C0 = O + 1;
  const v = new Uint8Array(N * NY * N), tone = new Float32Array(N * NY * N);
  const wood = (X, Y, Z) => { if (X >= 0 && Z >= 0 && Y >= 0 && X < N && Z < N && Y < NY) v[(Y * N + Z) * N + X] = 1; };
  const ball = (x, y, z, rad) => {
    wood(Math.floor(x), Math.floor(y), Math.floor(z));
    const R = Math.ceil(rad), r2 = rad * rad;
    for (let Y = Math.floor(y) - R; Y <= y + R; Y++) for (let Z = Math.floor(z) - R; Z <= z + R; Z++) for (let X = Math.floor(x) - R; X <= x + R; X++) if ((X + 0.5 - x) ** 2 + (Y + 0.5 - y) ** 2 + (Z + 0.5 - z) ** 2 <= r2) wood(X, Y, Z);
  };
  // the trunk: round, wider at the root, thinner toward the fork
  for (let y = 0; y <= th; y++) {
    const rad = 0.9 + 0.45 * k - (0.25 + 0.2 * k) * y / th, R = Math.ceil(rad) + 1;
    // (at the foot a root or two runs out, a voxel each, never a ring of them: Will, 2026-11-24, of a flared foot two
    // voxels high, "it looks like pedestals")
    for (let dz = -R; dz < R; dz++) for (let dx = -R; dx < R; dx++) { const d = (dx + 0.5) ** 2 + (dz + 0.5) ** 2; if (d <= rad * rad || (y === 0 && d <= (rad + 0.9) ** 2 && hash(dx, 1, dz, seed) < 0.3)) wood(C0 + dx, y, C0 + dz); }
  }
  // the boughs: each leaves the trunk at its own height and heading, climbs, bends over and forks twice
  const blobs = [], size = () => (3.3 + r() * 1.5) * (0.9 + 0.12 * k);
  const limb = (x, y, z, a, e, len, rad, de, depth) => {
    const steps = Math.ceil(len * 2), f1 = Math.round(steps * 0.5), f2 = Math.round(steps * 0.78), side = r() < 0.5 ? 1 : -1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, R = Math.max(0.55, rad * (1 - 0.6 * t)), ee = e + de * t, c = Math.cos(ee) * 0.5;
      ball(x, y, z, R);
      x += Math.cos(a) * c; z += Math.sin(a) * c; y += Math.sin(ee) * 0.5; a += (r() - 0.5) * 0.1;
      if (depth < 1 && (i === f1 || i === f2)) limb(x, y, z, a + (i === f1 ? side : -side) * (0.6 + r() * 0.5), ee + 0.15, len * (0.42 + r() * 0.16), R * 0.8, de * 0.5, depth + 1);
      if (depth === 0 && i === Math.round(steps * 0.66)) blobs.push([x, y + 1, z, size() * 0.85]);
    }
    blobs.push([x, y + 0.5, z, size()]);
  };
  const n = Math.round(4.5 + k * 1.6 + r()), a0 = r() * 6.28;
  for (let b = 0; b < n; b++) {
    const u = b / (n - 1), a = a0 + b * 2.399 + (r() - 0.5) * 0.5;
    if (cherry) limb(C0, th * (0.6 + 0.4 * u), C0, a, 0.85 + 0.2 * u, (8 + r() * 4) * k * (1 - 0.15 * u), (0.65 + 0.3 * k) * (1 - 0.2 * u), -(0.5 + r() * 0.25), 0);
    else limb(C0, th * (0.6 + 0.4 * u), C0, a, 1.02 + 0.22 * u, (8 + r() * 4) * k * (1 - 0.2 * u), (0.6 + 0.3 * k) * (1 - 0.2 * u), -(0.7 + r() * 0.3), 0);
  }
  // and the top of it
  if (cherry) blobs.push([C0 + (r() - 0.5) * 3, th + 7 * k, C0 + (r() - 0.5) * 3, size()]);
  else { limb(C0, th, C0, a0, 1.35, 5.5 * k, 0.5 + 0.25 * k, -0.2, 1); blobs.push([C0 + (r() - 0.5) * 5 * k, th + 7 * k, C0 + (r() - 0.5) * 5 * k, size() * 1.1]); }
  // the leaves: a flattened ball about each of those places
  const flat = cherry ? 0.7 : 0.76, SX = 0.5, SZ = 0.86;   // (toward the sun, near enough for any of the looks)
  for (const [bx, by, bz, br] of blobs) {
    const R = Math.ceil(br);
    for (let Y = Math.floor(by) - R; Y <= by + R; Y++) for (let Z = Math.floor(bz) - R; Z <= bz + R; Z++) for (let X = Math.floor(bx) - R; X <= bx + R; X++) {
      if (X < 0 || Z < 0 || Y < 1 || X >= N || Z >= N || Y >= NY) continue;
      const dx = X + 0.5 - bx, dy = (Y + 0.5 - by) / flat, dz = Z + 0.5 - bz, d = Math.sqrt(dx * dx + dy * dy + dz * dz) / br;
      const fine = hash(X, Y, Z, seed), coarse = hash(X >> 1, Y >> 1, Z >> 1, seed + 5);
      if (d > 1 - 0.3 * fine - 0.16 * coarse) continue;
      const c = (Y * N + Z) * N + X; if (v[c] === 1) continue;
      const t = 0.5 + 0.38 * dy / br + 0.11 * (dx * SX + dz * SZ) / br + (fine - 0.5) * 0.22 + (coarse - 0.5) * 0.2;
      v[c] = 2; if (t > tone[c]) tone[c] = Math.min(1, Math.max(0.02, t));
    }
  }
  // what stands under other leaves is in their shade
  for (let Z = 0; Z < N; Z++) for (let X = 0; X < N; X++) { let over = 0; for (let Y = NY - 1; Y >= 0; Y--) { const c = (Y * N + Z) * N + X; if (v[c] === 2) { tone[c] *= 1 - Math.min(0.32, over * 0.028); over++; } } }
  return { N, NY, v, tone, O: C0 };
}
// the same tree, eight of its cells to one (leaves where there are mostly leaves; a cell with only a twig in it is
// left out)
function coarser(T, twigs = true) {
  const N = T.N / 2, NY = T.NY / 2, v = new Uint8Array(N * NY * N), tone = new Float32Array(N * NY * N);
  for (let y = 0; y < NY; y++) for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    let leaf = 0, wood = 0, t = 0;
    for (let k = 0; k < 8; k++) { const c = ((y * 2 + (k >> 2)) * T.N + z * 2 + ((k >> 1) & 1)) * T.N + x * 2 + (k & 1); if (T.v[c] === 2) { leaf++; t += T.tone[c]; } else if (T.v[c] === 1) wood++; }
    const c = (y * N + z) * N + x;
    if (leaf >= 3) { v[c] = 2; tone[c] = t / leaf; } else if (wood >= 2 && twigs) v[c] = 1;
  }
  return { N, NY, v, tone, O: T.O / 2 };
}

const MATS = (kind = 0) => (kind === 1 ? [M.TRUNK, M.SAKURA, M.SAKURA, M.SAKURA2] : [M.TRUNK, M.HEDGE, M.LEAF, M.LEAF2]);

export function plantTree(x, z, seed, k = 1, kind = 0) {
  const mats = MATS(kind), T = grow(seed, k, kind), { N, NY, v, tone } = T, O = T.O - 1;
  begin('Tree', 'tree', false);
  for (let Y = 0; Y < NY; Y++) for (let Z = 0; Z < N; Z++) for (let X = 0; X < N; X++) {
    const c = (Y * N + Z) * N + X, m = v[c]; if (!m) continue;
    if (m === 1) set(x + X - O, Y, z + Z - O, mats[0]); else put(x + X - O, Y, z + Z - O, mats[tone[c] < 0.38 ? 1 : tone[c] < 0.7 ? 2 : 3]);
  }
}

// ---- the drawn ones --------------------------------------------------------------------------------------------------
// a cell's colour: the leaves run from a deep shade through the leaf's own green (or pink) to a light one
const RGB = (id, k = 1, kg = k, kb = k) => [MAT_R[id] * k, MAT_G[id] * kg, MAT_B[id] * kb];
const RAMPS = () => [[RGB(M.HEDGE, 0.74), RGB(M.LEAF), RGB(M.LEAF2, 1.05)], [RGB(M.SAKURA, 0.74, 0.6, 0.72), RGB(M.SAKURA), RGB(M.SAKURA2, 1.03)]];
// one cut of a tree as a mesh, in cubes C voxels across: only the faces that show, each with the grain laid over it
function mesh(T, C, kind, ramp, seed) {
  const { N, NY, v, tone } = T, O = T.O, wood = RGB(M.TRUNK, 0.8);
  const at = (x, y, z) => (x < 0 || z < 0 || y < 0 || x >= N || z >= N || y >= NY ? 0 : v[(y * N + z) * N + x]);
  const pos = [], col = [], nor = [], uv = [], idx = [];
  const F = [[1, 0, 0, [1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1]], [-1, 0, 0, [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0]], [0, 1, 0, [0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0]], [0, -1, 0, [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1]], [0, 0, 1, [1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 0, 1]], [0, 0, -1, [0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0]]];
  for (let y = 0; y < NY; y++) for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const m = at(x, y, z); if (!m) continue;
    let c = wood;
    if (m === 2) { const t = tone[(y * N + z) * N + x], a = t < 0.5 ? ramp[0] : ramp[1], b = t < 0.5 ? ramp[1] : ramp[2], f = t < 0.5 ? t * 2 : t * 2 - 1; c = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }
    const j = (0.93 + 0.14 * hash(x, y, z, seed + C)) * 1.12;   // (1.12: the grain takes a little of the light off)
    for (const [nx, ny, nz, q] of F) {
      if (at(x + nx, y + ny, z + nz)) continue;
      const b = pos.length / 3;
      for (let k = 0; k < 12; k += 3) {
        const X = (x + q[k]) * C, Y = (y + q[k + 1]) * C, Z = (z + q[k + 2]) * C;
        pos.push(X - O * C, Y, Z - O * C); col.push(c[0] * j, c[1] * j, c[2] * j); nor.push(nx, ny, nz);
        uv.push((nx ? Z : X) / 16, (ny ? Z : Y) / 16);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
// the grain: flecks of light and shade half a voxel across, as leaves have and bark has (it is laid over every face;
// far off it runs together into an even tone)
function grain() {
  const S = 32, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), img = g.createImageData(S, S); let s = 9241;
  for (let i = 0; i < S * S; i++) { s = (s * 1664525 + 1013904223) | 0; const r = ((s >>> 8) & 0xffff) / 65536, n = r < 0.14 ? 168 + r * 200 : r > 0.9 ? 255 : 212 + r * 40; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = n; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = THREE.NoColorSpace; return t;
}

// The trees come in a few sizes (a model is grown at the nearest of them, so its cubes stay a voxel across up close)
// and two shapes of each. spots: [x, z, size, turn, kind, how high its foot stands (0)]. `near` and `mid`: how far off the fine and the middling
// cut are shown; past `far` a tree is left out.
const SIZES = [0.8, 1.05, 1.4, 1.9], LAST = 1.4;
export function makeGrove(api, spots, { near = 90, mid = 260, far = 700, end = 2300, most = [40, 160] } = {}) {
  if (!spots.length) return { tris: 0 };
  const { scene, camera } = api;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: grain() }), ramps = RAMPS();
  const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const n = spots.length, X = new Float32Array(n), Z = new Float32Array(n), MX = new Float32Array(n * 16), TINT = new Float32Array(n * 3), VAR = new Uint8Array(n), vars = [], byKey = new Map();
  spots.forEach(([x, z, size, turn, kind = 0, y = 0], i) => {
    let b = 0; for (let k = 1; k < SIZES.length; k++) if (Math.abs(Math.log(size / SIZES[k])) < Math.abs(Math.log(size / SIZES[b]))) b = k;
    const shape = hash(Math.round(x), 3, Math.round(z), 11) < 0.5 ? 0 : 1, key = kind * 100 + b * 10 + shape;
    if (!byKey.has(key)) { byKey.set(key, vars.length); vars.push({ kind, b, shape, n: 0 }); }
    VAR[i] = byKey.get(key); vars[VAR[i]].n++;
    X[i] = x; Z[i] = z;
    q.setFromAxisAngle(UP, turn); M4.compose(p.set(x, y, z), q, sc.setScalar(size / SIZES[b])); M4.toArray(MX, i * 16);
    const t = 0.9 + 0.2 * hash(Math.round(x), 7, Math.round(z), 3), w = (hash(Math.round(x), 9, Math.round(z), 5) - 0.5) * 0.1;
    TINT[i * 3] = t * (1 + w); TINT[i * 3 + 1] = t; TINT[i * 3 + 2] = t * (1 - w);
  });
  // a variant's meshes: its own fine and middling cut; the far cut is one shape for both of a size, and the last
  // (eight voxels to a cube, leaves only, on a stick of a trunk) one for every size of a kind: the difference
  // cannot be seen from there
  const far0 = new Map(), last0 = new Map();
  const make = (g, cap) => {
    const m = new THREE.InstancedMesh(g, mat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0; m.visible = false; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; m.name = 'grove'; scene.add(m);
    return m;
  };
  for (const V of vars) {
    const seed = 31 + V.b * 17 + V.shape * 101 + V.kind * 7, T0 = grow(seed, SIZES[V.b], V.kind), T1 = coarser(T0), fk = V.kind * 10 + V.b;
    if (!far0.has(fk)) far0.set(fk, make(mesh(coarser(T1), 4, V.kind, ramps[V.kind], seed), vars.reduce((a, o) => a + (o.kind === V.kind && o.b === V.b ? o.n : 0), 0)));
    if (!last0.has(V.kind)) {
      const T = grow(57 + V.kind, LAST, V.kind), g = mesh(coarser(coarser(coarser(T), false), false), 8, V.kind, ramps[V.kind], seed), w = RGB(M.TRUNK, 0.8), h = (V.kind ? 8 : 20) * LAST;
      const stick = new THREE.BoxGeometry(3, h, 3).translate(0, h / 2, 0).toNonIndexed(), np = stick.attributes.position.count;
      stick.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(np * 3).map((_, i) => w[i % 3]), 3)); stick.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(np * 2), 2));
      const idx = [...g.index.array]; for (let i = 0; i < np; i++) idx.push(g.attributes.position.count + i);
      const G = new THREE.BufferGeometry();
      for (const k of ['position', 'color', 'normal', 'uv']) G.setAttribute(k, new THREE.Float32BufferAttribute([...g.attributes[k].array, ...stick.attributes[k].array], k === 'uv' ? 2 : 3));
      G.setIndex(idx);
      last0.set(V.kind, make(G, vars.reduce((a, o) => a + (o.kind === V.kind ? o.n : 0), 0)));
    }
    V.lods = [make(mesh(T0, 1, V.kind, ramps[V.kind], seed), Math.min(V.n, most[0])), make(mesh(T1, 2, V.kind, ramps[V.kind], seed), Math.min(V.n, most[1])), far0.get(fk), last0.get(V.kind)];
    V.k = SIZES[V.b] / LAST;
  }
  const all = [...new Set(vars.flatMap((V) => V.lods))];
  // every tree in the picture, into the cut its distance asks for
  const last = { x: 1e9, y: 0, z: 0, fx: 0, fz: 0 }, near2 = near * near, mid2 = mid * mid, far2 = far * far, end2 = end * end;
  const place = (cam) => {
    const e = cam.matrixWorld.elements, px = e[12], pz = e[14]; let fx = -e[8], fz = -e[10]; const fl = Math.hypot(fx, fz), level = fl > 0.45;
    if (level) { fx /= fl; fz /= fl; }
    if (Math.abs(px - last.x) + Math.abs(pz - last.z) < 1.5 && Math.abs(e[13] - last.y) < 3 && fx * last.fx + fz * last.fz > 0.9997) return;
    last.x = px; last.y = e[13]; last.z = pz; last.fx = fx; last.fz = fz;
    const tan = Math.tan(Math.min(1.45, Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect) + 0.16));
    for (const m of all) m.count = 0;
    for (let i = 0; i < n; i++) {
      const dx = X[i] - px, dz = Z[i] - pz, d2 = dx * dx + dz * dz; if (d2 > end2) continue;
      if (level && d2 > 1600) { const along = dx * fx + dz * fz; if (along < -40 || Math.abs(dx * fz - dz * fx) > (along + 40) * tan + 30) continue; }
      const V = vars[VAR[i]], L = V.lods; let l = d2 < near2 ? 0 : d2 < mid2 ? 1 : d2 < far2 ? 2 : 3;
      while (l < 3 && L[l].count >= L[l].instanceMatrix.count) l++;
      const m = L[l], k = m.count++, a = m.instanceMatrix.array, c = m.instanceColor.array, o = i * 16, f = l === 3 ? V.k : 1;
      for (let j = 0; j < 12; j++) a[k * 16 + j] = MX[o + j] * f;
      for (let j = 12; j < 16; j++) a[k * 16 + j] = MX[o + j];
      c[k * 3] = TINT[i * 3]; c[k * 3 + 1] = TINT[i * 3 + 1]; c[k * 3 + 2] = TINT[i * 3 + 2];
    }
    for (const m of all) { m.visible = m.count > 0; if (m.visible) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; } }
  };
  const before = scene.onBeforeRender;
  scene.onBeforeRender = function (r, s, cam, rt) { before.call(this, r, s, cam, rt); if (cam === camera) place(cam); };
  return { place, meshes: all, spots, tris: () => all.reduce((a, m) => a + m.geometry.index.count / 3 * m.count, 0) };
}
