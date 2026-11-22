// The country round Camp Deadfall, past its wall (maps/base.js lays it out): a strip of cleared ground the dead come in
// over, then pine forest on rolling hills, the road out of the south gate running down a valley with what was left on
// it (cars, a bus, army trucks, some burnt out and some still burning, a few with their hazard lights going), dirt tracks
// out of the other gates, a radio mast on a hill with its red lights, a farm burning to the east, and on the horizon to
// the south the town the road goes to, on fire: flames, an orange glow on the smoke over it, columns of smoke leaning
// on the wind.
//   - The ground is a mesh of rings out from the map's edge, flat where the horde comes in and rising into hills
//     further out, lower along the road's valley and round the town so the town shows from inside the wall.
//   - The pines are one instanced cone stack, nearest first so the lower quality steps keep the near forest.
//   - The fires' smoke and glow are one draw of cards: the glows facing the camera, the smoke columns turned to it about
//     the upright, their billows and the light of the fire under them worked out in the shader.
//   - The cleared strip outside the wall is kept clear and open, the same sand as the base, so the wall's line stands
//     out against the dark of the trees from inside.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { F, V3, TAU, lin, clamp, FIRE, MAST, HOMES, COMMON, FOG_PARS, fogKeep } from './kit.js';

const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function wilds(kit) {
  const { L, rand, pick, add, pt, pts, blink, U, NIGHT, mobile } = kit;
  const W = L.world, MX = (W[0] + W[2]) / 2, MZ = (W[1] + W[3]) / 2, HX = (W[2] - W[0]) / 2, HZ = (W[3] - W[1]) / 2;
  // how far a point is outside the map (less than 0 inside it)
  const edge = (x, z) => { const qx = Math.abs(x - MX) - HX, qz = Math.abs(z - MZ) - HZ; return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0); };
  const h2 = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vn = (x, z) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); return (h2(i, j) * (1 - u) + h2(i + 1, j) * u) * (1 - v) + (h2(i, j + 1) * (1 - u) + h2(i + 1, j + 1) * u) * v; };
  const fbm = (x, z) => 0.55 * vn(x, z) + 0.3 * vn(x * 2.1 + 5.3, z * 2.1 + 3.1) + 0.15 * vn(x * 4.3 + 9.7, z * 4.3 + 1.9);
  // the roads: the road south to the town, and the tracks out of the other gates (polylines of [x, z])
  const segD = (x, z, a, b) => { const bx = b[0] - a[0], bz = b[1] - a[1], t = clamp(((x - a[0]) * bx + (z - a[1]) * bz) / (bx * bx + bz * bz), 0, 1); return Math.hypot(x - a[0] - bx * t, z - a[1] - bz * t); };
  const polyD = (x, z, P) => { let d = 1e9; for (let i = 0; i + 1 < P.length; i++) d = Math.min(d, segD(x, z, P[i], P[i + 1])); return d; };
  const roadD = (x, z) => polyD(x, z, L.road), trackD = (x, z) => Math.min(...L.tracks.map((P) => polyD(x, z, P)));
  const T = L.town, HILL = L.hills;
  // the ground's height: nothing near the map, hills further out, lower down the road's valley and round the town
  const height = (x, z) => {
    const e = edge(x, z); if (e <= HILL.flat) return 0;
    let h = smooth(HILL.flat, HILL.flat + 650, e) * (HILL.base + HILL.amp * fbm(x * 0.0019 + 3.7, z * 0.0019 + 1.3) ** 1.7);
    h *= (0.16 + 0.84 * smooth(50, 420, roadD(x, z))) * (0.2 + 0.8 * smooth(T.r, T.r + 520, Math.hypot(x - T.x, z - T.z)));
    return h;
  };

  // ---- the ground: rings out from the map's edge -------------------------------------------------------------------
  // Each ring is the map's outline pushed out along rays from its middle (the four corners among the rays, so the first
  // ring is the map's edge exactly, a voxel inside it so the two overlap), the rings closer together near the map.
  let geo;
  {
    const NA = mobile ? 128 : 176, ang = [];
    for (let i = 0; i < NA; i++) ang.push(i / NA * TAU);
    for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) ang.push((Math.atan2(sz * HZ, sx * HX) + TAU) % TAU);
    ang.sort((a, b) => a - b);
    const RING = [0, 6, 16, 30, 50, 76, 108, 146, 190, 240, 300, 370, 450, 540, 640, 760, 900, 1060, 1240, 1440, 1660, 1900, 2160, 2450, 2800];
    const n = ang.length, pos = new Float32Array(n * RING.length * 3), idx = [];
    RING.forEach((s, k) => ang.forEach((a, i) => {
      const c = Math.cos(a), sn = Math.sin(a), r0 = Math.min((HX - 1) / Math.max(Math.abs(c), 1e-6), (HZ - 1) / Math.max(Math.abs(sn), 1e-6)), r = r0 + s;
      const x = MX + c * r, z = MZ + sn * r;
      pos.set([x, k === 0 ? 0.03 : height(x, z) + 0.03, z], (k * n + i) * 3);
    }));
    for (let k = 0; k + 1 < RING.length; k++) for (let i = 0; i < n; i++) {
      const a = k * n + i, b = k * n + (i + 1) % n, c = (k + 1) * n + (i + 1) % n, d = (k + 1) * n + i;
      idx.push(a, b, c, a, c, d);
    }
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
    geo.computeVertexNormals(); geo.computeBoundingSphere();
  }

  // ---- what was left on the roads ------------------------------------------------------------------------------
  // Along the road south from SKIP out of the gate: cars, vans, a bus and army trucks, nose to tail on the way out and
  // slewed across the shoulders, some burnt out (a few of those still burning), a few with their hazard lights going.
  const PAINT = [0xd8d8d4, 0x9a9da3, 0x5b5f66, 0x1c1d21, 0x22324f, 0x7a1f1c, 0x2c3b2e, 0x8c7a5a, 0x3b4a63].map(lin);
  const BURNT = lin(0x1d1a17), RUST = lin(0x3a2418), GLASS = lin(0x15181c), OLIVE = lin(0x485131), CONC = lin(0x8a8780);
  const fires = [];   // [x, y, z, size] of what is still burning: their light on the ground, flames and smoke
  const along = (P, s) => {
    for (let i = 0; i + 1 < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], l = Math.hypot(bx - ax, bz - az);
      if (s <= l || i === P.length - 2) { const t = Math.min(1, s / l); return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / l, (bz - az) / l]; }
      s -= l;
    }
  };
  const vehicle = (x, z, yaw, type, burnt, roll = 0) => {
    const y = height(x, z), body = burnt ? (rand() < 0.5 ? BURNT : RUST) : pick(PAINT), fx = Math.sin(yaw), fz = Math.cos(yaw);
    if (type === 'bus') { add(3, x, y + 0.6, z, 9, 10, 46, yaw, 2, burnt ? BURNT : lin(0xc9a227)); return 10; }
    if (type === 'truck') {
      add(3, x + fx * 13, y + 0.6, z + fz * 13, 9, 9, 9, yaw, 2, burnt ? BURNT : OLIVE);
      add(3, x - fx * 5, y + 0.6, z - fz * 5, 9.5, 11, 24, yaw, 2, burnt ? BURNT : lin(0x5f6a3a), 0, 0, roll); return 11;
    }
    const tall = type === 'van' ? 1.5 : 1, len = 16 + rand() * 3;
    add(3, x, y + 0.4, z, 7.2, 3.4 * tall, len, yaw, 2, body, 0, 0, roll);
    if (!roll) add(3, x - fx * 1.5, y + 0.4 + 3.4 * tall, z - fz * 1.5, 6.3, 2.2, len * (tall > 1 ? 0.8 : 0.52), yaw, 2, burnt ? BURNT : GLASS);
    return 4 * tall;
  };
  {
    const R = L.road, W8 = L.roadW / 2;
    let s = L.wrecks.from, k = 0;
    while (s < L.wrecks.to) {
      const [x, z, ux, uz] = along(R, s), dir = Math.atan2(ux, uz), side = rand() < 0.5 ? -1 : 1, off = W8 * (0.15 + rand() * 0.75) * side + (rand() < 0.2 ? side * (W8 + 6 + rand() * 10) : 0);
      const px = x + uz * off, pz = z - ux * off, slew = (rand() - 0.5) * (rand() < 0.3 ? 2.4 : 0.5);
      const r = rand(), type = r < 0.06 ? 'bus' : r < 0.2 ? 'truck' : r < 0.36 ? 'van' : 'car', burnt = rand() < 0.38;
      const over = !burnt && type === 'car' && rand() < 0.12 ? Math.PI / 2 * side : 0;
      const top = vehicle(px, pz, dir + slew + (rand() < 0.5 ? Math.PI : 0), type, burnt, over);
      if (burnt && fires.length < 6 && rand() < 0.45) fires.push([px, height(px, pz) + top, pz, type === 'bus' ? 16 : 10]);
      else if (!burnt && k % 5 === 2) for (const e of [-1, 1]) pt(pts.ave, px + Math.cos(dir) * 3.4 * e, height(px, pz) + 2.6, pz - Math.sin(dir) * 3.4 * e, 3.5, 7, [1, 0.55, 0.08], rand() * 0.2);
      s += 26 + rand() * 50 * (s / L.wrecks.to + 0.4); k++;
    }
    // a few on the tracks too
    for (const P of L.tracks) for (let q = 0; q < 3; q++) {
      const [x, z, ux, uz] = along(P, 140 + rand() * 360), off = (rand() - 0.5) * 20;
      vehicle(x + uz * off, z - ux * off, Math.atan2(ux, uz) + (rand() - 0.5) * 1.2, rand() < 0.3 ? 'truck' : 'car', rand() < 0.5);
    }
    // the checkpoint the army set up on the road and left: concrete blocks across half of it, a burnt truck
    const [cx, cz, ux, uz] = along(R, L.wrecks.checkpoint), yaw = Math.atan2(-uz, ux) + Math.PI / 2;
    for (let i = -3; i <= 0; i++) add(3, cx + uz * i * 10, 0, cz - ux * i * 10, 9, 4.2, 3.2, yaw + (rand() - 0.5) * 0.3, 2, CONC);
    vehicle(cx + uz * 16 + ux * 14, cz - ux * 16 + uz * 14, Math.atan2(ux, uz) + 0.4, 'truck', true);
  }

  // ---- the radio mast on its hill ----------------------------------------------------------------------------------
  {
    const M = L.mast, y = height(M.x, M.z);
    add(0, M.x, y, M.z, 4, M.h, 4, 0, 2, MAST);
    for (let k = 1; k < 6; k++) add(1, M.x, y + M.h * k / 6, M.z, 9, 1.2, 9, 0, 2, MAST);
    add(1, M.x + 16, y, M.z + 10, 16, 9, 12, 0.4, 2, CONC);
    for (const f of [1 / 3, 2 / 3]) blink(M.x, y + M.h * f, M.z);
    blink(M.x, y + M.h + 1.5, M.z);
  }

  // ---- the farm burning to the east ----------------------------------------------------------------------------------
  {
    const Fm = L.farm, y = height(Fm.x, Fm.z);
    add(0, Fm.x, y, Fm.z, 40, 26, 64, 0.3, 5, lin(0x6b3a2a), 0.9);
    add(0, Fm.x - 70, y, Fm.z + 30, 30, 20, 26, 0.3, 5, pick(HOMES), 0.8);
    add(0, Fm.x + 40, y, Fm.z - 50, 14, 60, 14, 0, 2, lin(0x8c8a84));
    fires.push([Fm.x, y + 28, Fm.z, 26], [Fm.x - 70, y + 22, Fm.z + 30, 16]);
  }

  // ---- the town on fire ----------------------------------------------------------------------------------------------
  // Blocks of houses on a grid round its middle, a church with a steeple, a water tower, grain silos and a few taller
  // blocks; the power is out, so its only light is the fire, which has most of it.
  const townFires = [];
  {
    const B = 62;
    for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
      const bx = T.x + i * B, bz = T.z + j * B, d = Math.hypot(i, j) * B;
      if (d > T.r || rand() < 0.15) continue;
      const y = height(bx, bz), burning = rand() < 0.42 * (1.2 - d / T.r);
      if (i === 0 && j === 0) {   // the church
        add(0, bx, y, bz, 22, 30, 46, 0, 1, lin(0x7a7268), 0.3); add(0, bx, y, bz - 30, 14, 58, 14, 0, 2, lin(0x7a7268));
        add(0, bx, y + 58, bz - 30, 8, 22, 8, Math.PI / 4, 2, lin(0x3a3632)); add(0, bx, y + 80, bz - 30, 3, 12, 3, Math.PI / 4, 2, lin(0x3a3632));
        continue;
      }
      if (i === 2 && j === -1) {   // the water tower
        for (const [a, b] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) add(0, bx + a, y, bz + b, 1.6, 40, 1.6, 0, 2, MAST);
        add(0, bx, y + 40, bz, 20, 14, 20, Math.PI / 8, 2, lin(0x8a8f8c)); continue;
      }
      if (i === -3 && j === 1) { for (const o of [-12, 12]) add(0, bx + o, y, bz, 18, 64, 18, 0, 2, lin(0xa09c92)); continue; }   // silos
      const tall = d < T.r * 0.45 && rand() < 0.3;
      for (const [a, b] of tall ? [[0, 0]] : [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (!tall && rand() < 0.2) continue;
        const w = tall ? 40 : 18 + rand() * 8, dd = tall ? 34 : 18 + rand() * 8, hh = tall ? 40 + rand() * 30 : 12 + rand() * 12;
        const hx = bx + a * B / 4, hz = bz + b * B / 4, on = burning && rand() < 0.7;
        add(0, hx, y, hz, w, hh, dd, (rand() - 0.5) * 0.2, on ? 5 : 1, pick(HOMES), on ? 0.7 + rand() * 0.3 : 0);
        if (on) townFires.push([hx, y + hh, hz, (tall ? 40 : 22) + rand() * 18]);
      }
    }
  }
  for (const [x, y, z, s] of [...fires, ...townFires]) {
    // flames: a big one and a couple of tongues round it
    pt(pts.lamp, x, y + s * 0.2, z, s, 6, FIRE, rand());
    for (let k = 0; k < 2; k++) pt(pts.lamp, x + (rand() - 0.5) * s * 0.6, y + s * (0.1 + rand() * 0.3), z + (rand() - 0.5) * s * 0.6, s * 0.55, 6, [1, 0.62, 0.18], rand());
  }

  // ---- the pines ------------------------------------------------------------------------------------------------------
  // Scattered over the hills from past the cleared strip, thinner in a few clearings, none on the roads or in the town,
  // and none further than FAR from the map's middle (so all of them are inside the camera's far edge).
  let pines;
  {
    const N = mobile ? L.pines.mobile : L.pines.count, list = [];
    for (let tries = 0; list.length < N && tries < N * 6; tries++) {
      const a = rand() * TAU, s = L.clear + 12 + Math.pow(rand(), 1.35) * (L.far - L.clear);
      const c = Math.cos(a), sn = Math.sin(a), r0 = Math.min(HX / Math.max(Math.abs(c), 1e-6), HZ / Math.max(Math.abs(sn), 1e-6));
      const x = MX + c * (r0 + s), z = MZ + sn * (r0 + s);
      if (edge(x, z) < L.clear + 6 || Math.hypot(x - MX, z - MZ) > L.far) continue;
      if (roadD(x, z) < L.roadW / 2 + 14 || trackD(x, z) < 18) continue;
      if (Math.hypot(x - T.x, z - T.z) < T.r + 60 || Math.hypot(x - L.farm.x, z - L.farm.z) < 130 || Math.hypot(x - L.mast.x, z - L.mast.z) < 40) continue;
      if (fbm(x * 0.004 + 11, z * 0.004 + 4) < 0.36) continue;   // a clearing
      const hgt = 24 + rand() * 26, far = smooth(400, 1400, edge(x, z));
      list.push({ x, z, y: height(x, z), h: hgt * (1 + 0.5 * far), w: hgt * (0.34 + rand() * 0.1) * (1 + 0.5 * far), d: Math.hypot(x - MX, z - MZ), c: rand() });
    }
    list.sort((p, q) => p.d - q.d);
    const cone = (r, h, y) => { const g = new THREE.ConeGeometry(r, h, 7, 1, true).translate(0, y + h / 2, 0); g.deleteAttribute('uv'); return g; };
    const g = mergeGeometries([cone(0.5, 0.6, 0.04), cone(0.36, 0.5, 0.36), cone(0.2, 0.36, 0.64)]);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    mat.customProgramCacheKey = () => 'bd-pines';
    mat.onBeforeCompile = (sh) => { fogKeep(sh, 0.9, 0); };
    pines = new THREE.InstancedMesh(g, mat, Math.max(1, list.length));
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    const GREENS = [0x1d2a1c, 0x223020, 0x1a2419, 0x26331f, 0x1f2b22].map((h) => new THREE.Color(h));
    list.forEach((p, i) => {
      Q.setFromAxisAngle(UP, p.c * TAU); P.set(p.x, p.y - 1, p.z); S.set(p.w * 2, p.h, p.w * 2); M.compose(P, Q, S); pines.setMatrixAt(i, M);
      col.copy(GREENS[Math.floor(p.c * GREENS.length)]).multiplyScalar(0.85 + p.c * 0.3); pines.setColorAt(i, col);
    });
    pines.count = list.length; pines.userData.all = list.length;
    pines.matrixAutoUpdate = false; pines.updateMatrix(); pines.frustumCulled = false; pines.renderOrder = 1;
  }

  // ---- the smoke and the glow over the fires ---------------------------------------------------------------------------
  const cards = [];   // [x, y, z, w, h, kind (0 smoke, 1 glow), seed, strength]
  cards.push([T.x, height(T.x, T.z) - 120, T.z, T.r * 4.2, 560, 1, 0.3, 1.0], [T.x + 90, height(T.x, T.z) - 40, T.z - 60, T.r * 2.2, 300, 1, 2.1, 0.9]);
  cards.push([L.farm.x, height(L.farm.x, L.farm.z) - 20, L.farm.z, 260, 150, 1, 4.4, 0.7]);
  for (const [x, y, z, s] of fires) cards.push([x, y + s * 0.4, z, s * 2.2, s * 14, 0, rand() * 50, 0.8]);
  const big = townFires.slice().sort((a, b) => b[3] - a[3]).slice(0, L.smoke);
  for (const [x, y, z, s] of big) cards.push([x, y, z, s * 3.2, 420 + rand() * 260, 0, rand() * 50, 1]);
  const smoke = makeSmoke(cards, { NIGHT, U, wind: L.wind });

  const LAYOUT = `
const vec4 BD_WORLD = vec4(${F(MX)}, ${F(MZ)}, ${F(HX)}, ${F(HZ)});
const int BD_RN = ${L.road.length};
const vec2 BD_ROAD[${L.road.length}] = vec2[${L.road.length}](${L.road.map(([x, z]) => `vec2(${F(x)}, ${F(z)})`).join(', ')});
${L.tracks.map((P, k) => `const vec2 BD_TRACK${k}[${P.length}] = vec2[${P.length}](${P.map(([x, z]) => `vec2(${F(x)}, ${F(z)})`).join(', ')});`).join('\n')}
const int BD_FN = ${Math.max(1, fires.length)};
const vec4 BD_FIRE[${Math.max(1, fires.length)}] = vec4[${Math.max(1, fires.length)}](${(fires.length ? fires : [[0, -999, 0, 1]]).map(([x, y, z, s]) => `vec4(${F(x)}, ${F(y)}, ${F(z)}, ${F(s)})`).join(', ')});
const vec3 BD_TOWN = vec3(${F(T.x)}, ${F(T.z)}, ${F(T.r)});
float bdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
float bdRoadD(vec2 p) { float d = 1e9; for (int i = 0; i < BD_RN - 1; i++) d = min(d, bdSeg(p, BD_ROAD[i], BD_ROAD[i + 1])); return d; }
float bdTrackD(vec2 p) {
  float d = 1e9;
${L.tracks.map((P, k) => `  for (int i = 0; i < ${P.length - 1}; i++) d = min(d, bdSeg(p, BD_TRACK${k}[i], BD_TRACK${k}[i + 1]));`).join('\n')}
  return d;
}
// the light of the fires close by on a point near the ground, flickering
vec3 bdFireLight(vec3 w) {
  vec3 l = vec3(0.0);
  for (int i = 0; i < BD_FN; i++) {
    vec3 d = w - BD_FIRE[i].xyz; float r = BD_FIRE[i].w * 2.6;
    l += exp(-dot(d, d) / (r * r)) * (0.75 + 0.25 * sin(bdTime * (8.0 + float(i)) + float(i) * 2.3) * sin(bdTime * 2.9 + float(i)));
  }
  return ${V3(FIRE)} * l * 2.2;
}
vec3 bdPlainLight(vec3 w) { return bdFireLight(w); }
`;

  return {
    layout: LAYOUT,
    defs: '#define BD_SHARE 1.0\n#define BD_BRIGHT bdNight\n',
    ground: { geo, fn: GROUND_FN(L), main: GROUND_MAIN, glow: 'bdAlb * bdLight * (0.3 + 0.7 * bdNight)', cap: 0.92, keep: 0.4 },
    nearD: 700,
    craft: null,
    skyline: { R: 2250, top: 260, rep: 1, paint: paintHills, body: [0.62, 0.3] },
    extra: { pines, smoke },
    counts: { pines: pines.count, wrecksBurning: fires.length, townFires: townFires.length, cards: cards.length },
    quality(q) { pines.count = Math.round(pines.userData.all * (q <= 3 ? 1 : q <= 5 ? 0.6 : 0.35)); },
  };
}

// The ground's paint: the cleared strip outside the wall in the base's own sand, going over to the forest floor (needles
// and moss, rock where it is steep); the road (cracked tarmac, a faded centre line, dirt shoulders), the dirt tracks,
// scorched ground and firelight round what is burning, and the town's streets lit by its fires.
const GROUND_FN = (L) => `
vec3 bdGround(vec2 p, vec2 fw, float up, float wy, out vec3 light) {
  float big = bdN(p * 0.011), mid = bdN(p * 0.07 + 7.0), fine = bdN(p * 0.45 + 3.0);
  float grain = bdDetail > 0.5 ? mix(bdH(floor(p * 1.5)), 0.5, clamp(max(fw.x, fw.y) * 1.2 - 0.4, 0.0, 1.0)) : 0.5;
  vec2 q = abs(p - BD_WORLD.xy) - BD_WORLD.zw; float e = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  vec3 sand = ${V3(lin(L.sand))} * (0.9 + 0.12 * mid + 0.08 * grain);
  vec3 floor0 = mix(vec3(0.032, 0.04, 0.024), vec3(0.055, 0.042, 0.028), smoothstep(0.35, 0.75, big)) * (0.75 + 0.4 * mid + 0.2 * fine) * (0.9 + 0.2 * grain);
  vec3 col = mix(sand, floor0, smoothstep(${F(L.clear - 30)}, ${F(L.clear + 40)}, e + (mid - 0.5) * 40.0));
  col = mix(col, vec3(0.11, 0.105, 0.1) * (0.8 + 0.4 * fine), smoothstep(0.86, 0.72, up));   // rock where it is steep
  light = vec3(0.0);
  float rd = bdRoadD(p), td = bdTrackD(p);
  if (td < 12.0) col = mix(col, ${V3(lin(0x8f7e5d))} * (0.7 + 0.3 * mid) * (0.85 + 0.3 * grain), smoothstep(12.0, 8.0, td));
  if (rd < ${F(L.roadW / 2 + 8)}) {
    vec3 tar = ${V3(lin(0x56585c))} * 0.72 * (0.82 + 0.3 * fine) * (0.88 + 0.24 * grain);
    tar *= 1.0 - 0.35 * smoothstep(0.62, 0.7, bdN(p * 0.9 + 21.0));   // cracks and patches
    vec3 shoulder = ${V3(lin(0x7d6e52))} * (0.75 + 0.3 * mid);
    vec3 r = mix(tar, shoulder, smoothstep(${F(L.roadW / 2 - 1)}, ${F(L.roadW / 2 + 2)}, rd));
    // the centre line, faded and gone in places (dashes along the road: the distance down it is not known here, so
    // the dashes come from a noise that runs along whichever way the road goes)
    float dash = step(0.5, fract((p.x + p.y) * 0.04)) * step(0.4, mid);
    r = mix(r, vec3(0.5, 0.4, 0.1), smoothstep(0.7, 0.3, rd) * dash * 0.7);
    col = mix(r, col, smoothstep(${F(L.roadW / 2 + 2)}, ${F(L.roadW / 2 + 8)}, rd));
  }
  // what is burning: scorched round it, and its light
  vec3 fl = bdFireLight(vec3(p.x, wy, p.y));
  col *= 1.0 - 0.6 * clamp(length(fl) * 0.5, 0.0, 1.0);
  light += fl;
  // the town: dark streets, and the glow of its fires over all of it
  float dt = length(p - BD_TOWN.xy);
  if (dt < BD_TOWN.z * 1.6) {
    col = mix(col, vec3(0.05, 0.048, 0.045) * (0.8 + 0.4 * fine), smoothstep(BD_TOWN.z * 1.2, BD_TOWN.z * 0.9, dt));
    light += ${V3(FIRE)} * 1.4 * exp(-pow(dt / BD_TOWN.z, 2.0) * 1.6) * (0.85 + 0.15 * sin(bdTime * 1.3));
  }
  return col;
}
`;
const GROUND_MAIN = `
vec2 bdP = vBdW.xz; vec2 bdFw = max(fwidth(bdP), vec2(1e-3));
vec3 bdLight; vec3 bdAlb = bdGround(bdP, bdFw, vBdUp, vBdW.y, bdLight);
`;

// The hills round the horizon: two ridges, the nearer darker and higher, both topped with pines, painted texel by texel
// for the skyline's shader (red the shade, alpha the outline). Whole waves round, so it wraps.
function paintHills(W, H, rand) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  for (const [shade, base, amp, tree, ph] of [[235, 16, 30, 6, 0.7], [150, 6, 22, 9, 2.9]]) {
    const top = new Float32Array(W);
    for (let x = 0; x < W; x++) { const u = x / W * TAU; top[x] = base + amp * (0.5 + 0.28 * Math.sin(u * 3 + ph) + 0.15 * Math.sin(u * 7 + ph * 2) + 0.07 * Math.sin(u * 19 + ph)); }
    // pines along the ridge: each a narrow triangle
    for (let x = 0; x < W;) {
      const w = 2 + Math.round(rand() * 2), th = tree * (0.5 + rand() * 0.6);
      for (let i = -w; i <= w; i++) { const k = ((x + i) % W + W) % W; top[k] = Math.max(top[k], top[x % W] + th * (1 - Math.abs(i) / (w + 0.5))); }
      x += 2 + Math.round(rand() * 4);
    }
    for (let x = 0; x < W; x++) for (let y = 0; y < Math.min(H, top[x]); y++) {
      const i = (x + (H - 1 - y) * W) * 4; d[i] = shade; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// The cards for the smoke and the glow (see the top of this file). Drawn after the lights' points, smoke over glow; the
// colour goes out premultiplied, so a glow (no cover) adds and smoke (cover) darkens what is behind it.
function makeSmoke(cards, { NIGHT, U, wind }) {
  const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index; g.setAttribute('position', quad.attributes.position);
  // glows first, so the smoke is drawn over them
  cards.sort((a, b) => b[5] - a[5]);
  const n = cards.length, aP = new Float32Array(n * 3), aS = new Float32Array(n * 4), aK = new Float32Array(n);
  cards.forEach((c, i) => { aP.set(c.slice(0, 3), i * 3); aS.set(c.slice(3, 7), i * 4); aK[i] = c[7]; });
  g.setAttribute('aP', new THREE.InstancedBufferAttribute(aP, 3)); g.setAttribute('aS', new THREE.InstancedBufferAttribute(aS, 4)); g.setAttribute('aK', new THREE.InstancedBufferAttribute(aK, 1));
  g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: U.time, uNight: NIGHT, uWind: { value: new THREE.Vector2(wind[0], wind[1]) } },
    vertexShader: SMOKE_VERT, fragmentShader: FOG_PARS + COMMON + SMOKE_FRAG,
    transparent: true, depthWrite: false, fog: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false; m.renderOrder = -0.5; m.matrixAutoUpdate = false; m.updateMatrix();
  return m;
}
const SMOKE_VERT = `
attribute vec3 aP; attribute vec4 aS; attribute float aK;
uniform vec2 uWind;
varying vec2 vUv; varying vec3 vK; varying float vDepth;
void main() {
  vUv = position.xy + vec2(0.5, 0.0);
  vK = vec3(aS.z, aS.w, aK);
  vec4 mv;
  if (aS.z > 0.5) {
    // a glow: a card facing the camera
    mv = viewMatrix * vec4(aP + vec3(0.0, aS.y * 0.5, 0.0), 1.0);
    mv.xy += vec2(position.x * aS.x, (position.y - 0.5) * aS.y);
  } else {
    // a column of smoke: turned to the camera about the upright, wider and further downwind the higher it goes
    // (side is the camera's right as it looks at the column, so the card's front is towards the camera and not culled)
    vec2 to = normalize(cameraPosition.xz - aP.xz + vec2(1e-3)), side = vec2(to.y, -to.x);
    float y = position.y;
    vec3 p = aP + vec3(side.x, 0.0, side.y) * position.x * aS.x * (0.35 + 1.1 * y) + vec3(uWind.x * y * y, y, uWind.y * y * y) * vec3(aS.y, aS.y, aS.y);
    mv = viewMatrix * vec4(p, 1.0);
  }
  gl_Position = projectionMatrix * mv;
  vDepth = -mv.z;
}
`;
const SMOKE_FRAG = `
uniform float uTime; uniform float uNight;
varying vec2 vUv; varying vec3 vK; varying float vDepth;
void main() {
  float f = 0.0;
#ifdef USE_FOG
  f = bdFogF(vDepth);
#endif
  vec4 o;
  if (vK.x > 0.5) {
    vec2 q = vUv * 2.0 - vec2(1.0, 1.0); float r = min(dot(q, q), 1.0);
    float fl = 0.82 + 0.18 * sin(uTime * 2.3 + vK.y) * sin(uTime * 1.1 + vK.y * 3.0);
    o = vec4(vec3(1.0, 0.34, 0.07) * exp(-r * 3.4) * (1.0 - r) * fl * vK.z * 0.55 * (0.3 + 0.7 * uNight) * (1.0 - 0.4 * f), 0.0);
  } else {
    float y = vUv.y, x = abs(vUv.x - 0.5) * 2.0, t = uTime;
    float n = bdN(vec2(vUv.x * 3.0 + vK.y, y * 5.0 - t * 0.2)) * 0.65 + bdN(vec2(vUv.x * 7.0 - vK.y, y * 12.0 - t * 0.42)) * 0.35;
    float a = smoothstep(1.0, 0.15, x + (n - 0.5) * 0.9) * smoothstep(0.0, 0.04, y) * smoothstep(1.0, 0.4, y) * (0.25 + 0.85 * n * n) * vK.z;
    // (linear colour: at night near black, so above the glow it is a shade off the sky and over the glow a dark column)
    vec3 c = mix(vec3(0.3, 0.29, 0.28), vec3(0.01, 0.0085, 0.0075), uNight);
    // lit from the fire under it: orange low down, going over to dark smoke higher up (which shows against the glow; lit
    // much further up, it reads as a searchlight's beam and not as smoke)
    c += vec3(1.0, 0.36, 0.08) * (0.5 * exp(-y * 7.0) + 0.012 * (1.0 - y)) * (0.8 + 0.2 * sin(t * 3.7 + vK.y)) * (1.2 - n * 0.6) * (0.4 + 0.6 * uNight);
#ifdef USE_FOG
    c = mix(c, fogColor, f * 0.35);
#endif
    a = min(a, 0.92) * (1.0 - 0.15 * f);
    o = vec4(c * a, a);
  }
  gl_FragColor = o;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
