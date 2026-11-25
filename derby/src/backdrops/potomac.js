// Washington past the edge of its map, for the race (maps/capital.js lays it out): the city and its rivers carry on to
// the horizon. The city goes on north and east of the map, low and pale under its height limit, with the cathedral on
// its hill to the north-west; the Potomac comes down from the north-west between Georgetown and the towers across it,
// a bridge over it there, and runs out wide to the south; Virginia is the far bank, woods and low houses with a
// second cluster of towers down the river; the Anacostia runs off east, with the low hills of its far bank past it.
// The news helicopter hangs over the course ahead of the player.
//   - Everything is at the course's scale (a street out here is as wide as the course: Will, 2026-11-24, on small
//     roads beside the track, "it ruins the perspective"): blocks of 132 with streets of 40 between.
//   - Land and water are worked out in the ground's shader from the shores below, each a straight run from where the
//     map's own shore meets its edge, with a wobble that starts past the edge, so the two meet without a seam.
//   - Nothing stands further from any corner of the course than `reach`.
import { F, V3, DEG, lin, clamp, POLE, OFFICE, HOMES } from './kit.js';
import { flatGround } from './arena.js';
import * as THREE from 'three';

// The shores past the map. S: { west (the city's bank on the Potomac, north of the map), va: [z, slope] (where
// Virginia's shore leaves the west edge, and how it runs north-west from there), south: [vaX, penL, penR, z, tip]
// (the shores on the south edge: Virginia's, and the two sides of the point between the rivers, and how far it goes),
// east: [z, slope] (the Anacostia's near bank on the east edge), far: [z, slope, x] (its far bank) }.
// How far a point is into the land (less than 0 in the water), as [city, point, Virginia, far bank]: the same in JS
// and in GLSL.
export function potomacLand(L) {
  const W = L.world, S = L.shores;
  const N1 = (t) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f), h = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }; return h(i) + (h(i + 1) - h(i)) * u; };
  const wob = (t) => 26 * (N1(t * 0.005) - 0.5) + 9 * (N1(t * 0.019 + 7) - 0.5);
  const lands = (x, z) => {
    const k = clamp(Math.max(W[0] - x, x - W[2], W[1] - z, z - W[3]) / 140, 0, 1);
    const vaX = z < S.va[0] ? W[0] + (z - S.va[0]) * S.va[1] : z < W[3] ? W[0] + (z - S.va[0]) * (S.south[0] - W[0]) / (W[3] - S.va[0]) : S.south[0] - (z - W[3]) * 0.15;
    const dz = z - W[3], penL = S.south[1] + dz * 0.6, penR = S.south[2] - dz * 0.7;
    const ana = S.east[0] - Math.max(0, x - W[2]) * S.east[1];
    const farZ = S.far[0] + (x < W[2] ? (W[2] - x) * 0.45 : -(x - W[2]) * S.far[1]), farX = S.far[2] + (z - 1240) * 0.1;
    return [
      Math.min(x - S.west - wob(z + 700) * k, ana + wob(x + 300) * k * 0.6 - z),
      Math.min(x - penL, penR - x, z - W[3] + 14) + wob(x + z) * k * 0.3,
      vaX + wob(z) * k - x,
      Math.min(z - farZ - wob(x + 1900) * k, x - farX - wob(z + 2600) * k),
    ];
  };
  const land = (x, z) => Math.max(...lands(x, z));
  const glsl = `
float bdN1(float t) { float i = floor(t), f = t - i, u = f * f * (3.0 - 2.0 * f); return mix(fract(sin(i * 127.1 + 311.7) * 43758.5453), fract(sin((i + 1.0) * 127.1 + 311.7) * 43758.5453), u); }
float bdWob(float t) { return 26.0 * (bdN1(t * 0.005) - 0.5) + 9.0 * (bdN1(t * 0.019 + 7.0) - 0.5); }
vec4 bdLands(vec2 p) {
  float x = p.x, z = p.y;
  float k = clamp(max(max(${F(W[0])} - x, x - ${F(W[2])}), max(${F(W[1])} - z, z - ${F(W[3])})) / 140.0, 0.0, 1.0);
  float vaX = z < ${F(S.va[0])} ? ${F(W[0])} + (z - ${F(S.va[0])}) * ${F(S.va[1])} : z < ${F(W[3])} ? ${F(W[0])} + (z - ${F(S.va[0])}) * ${F((S.south[0] - W[0]) / (W[3] - S.va[0]))} : ${F(S.south[0])} - (z - ${F(W[3])}) * 0.15;
  float dz = z - ${F(W[3])}, penL = ${F(S.south[1])} + dz * 0.6, penR = ${F(S.south[2])} - dz * 0.7;
  float ana = ${F(S.east[0])} - max(0.0, x - ${F(W[2])}) * ${F(S.east[1])};
  float farZ = ${F(S.far[0])} + (x < ${F(W[2])} ? (${F(W[2])} - x) * 0.45 : -(x - ${F(W[2])}) * ${F(S.far[1])}), farX = ${F(S.far[2])} + (z - 1240.0) * 0.1;
  return vec4(
    min(x - ${F(S.west)} - bdWob(z + 700.0) * k, ana + bdWob(x + 300.0) * k * 0.6 - z),
    min(min(x - penL, penR - x), z - ${F(W[3])} + 14.0) + bdWob(x + z) * k * 0.3,
    vaX + bdWob(z) * k - x,
    min(z - farZ - bdWob(x + 1900.0) * k, x - farX - bdWob(z + 2600.0) * k));
}
`;
  return { lands, land, glsl };
}

const GRID = 132, STREET = 20;   // a block and the street's half width
const STONE = [0xd9d2c0, 0xcbc1ab, 0xe2ddd0, 0xb9b1a2, 0xc7b79a, 0xa9a59c].map(lin), BRICK = [0x9c5b48, 0x8a4f40, 0xb07a5c].map(lin);

export function potomac(kit) {
  const { L, rand, pick, add, blink, tower } = kit;
  const W = L.world, REACH = L.reach;
  const [cx0, cz0, cx1, cz1] = L.course;
  const near = (x, z) => Math.hypot(Math.max(cx0 - x, 0, x - cx1), Math.max(cz0 - z, 0, z - cz1));
  const far = (x, z) => Math.max(Math.hypot(x - cx0, z - cz0), Math.hypot(x - cx1, z - cz0), Math.hypot(x - cx0, z - cz1), Math.hypot(x - cx1, z - cz1));
  const { lands, land, glsl } = potomacLand(L);
  const inMap = (x, z, m = 0) => x > W[0] - m && x < W[2] + m && z > W[1] - m && z < W[3] + m;
  const clearOf = (x, z, r) => (L.keep || []).every(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) > kr + r);

  const LAYOUT = `
const vec3 BD_WATER = ${V3(lin(L.water))};
const vec3 BD_LAWN = ${V3(lin(L.lawn))};
const vec3 BD_PAVE = ${V3(lin(L.pave))};
${glsl}
// how far a point is from the middle of its block (the streets run between the blocks)
float bdBlock(vec2 p) { vec2 c = abs(mod(p, ${F(GRID)}) - ${F(GRID / 2)}); return max(c.x, c.y); }
vec3 bdPlainLight(vec3 w) { return vec3(0.0); }
`;

  // ---- the ground: a plane out past the camera's reach, with the map cut out of it --------------------------------
  let geo;
  {
    const R = 3400, mx = (W[0] + W[2]) / 2, mz = (W[1] + W[3]) / 2, hx = (W[2] - W[0]) / 2 - 1, hz = (W[3] - W[1]) / 2 - 1;
    const shape = new THREE.Shape([new THREE.Vector2(-R, -R), new THREE.Vector2(R, -R), new THREE.Vector2(R, R), new THREE.Vector2(-R, R)]);
    shape.holes.push(new THREE.Path([new THREE.Vector2(-hx, -hz), new THREE.Vector2(-hx, hz), new THREE.Vector2(hx, hz), new THREE.Vector2(hx, -hz)]));
    geo = flatGround(shape, mx, mz);
  }

  // ---- the city: every block north and east of the map that is on its land ------------------------------------------
  // Low, under the height limit: 50 to 100, a little more downtown (north of the White House). A block is one building,
  // two or four, in stone, some in brick; one in ten is a square of grass and trees (L.green(x, z) says where the woods
  // are, and capital.js plants them).
  const DOWN = L.downtown;
  let blocks = 0;
  for (let gz = Math.floor(-2300 / GRID) * GRID; gz < 3300; gz += GRID) for (let gx = Math.floor(-2300 / GRID) * GRID; gx < 3300; gx += GRID) {
    const x0 = gx + STREET + 6, x1 = gx + GRID - STREET - 6, z0 = gz + STREET + 6, z1 = gz + GRID - STREET - 6, mx = gx + GRID / 2, mz = gz + GRID / 2;
    if (inMap(mx, mz, GRID / 2 - 8) || far(mx, mz) > REACH) continue;
    const ls = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => lands(x, z));
    const city = ls.every((l) => l[0] > 12), other = !city && ls.every((l) => Math.max(l[2], l[3]) > 16);
    if (!city && !other) continue;
    if (L.green(mx, mz) || !clearOf(mx, mz, GRID * 0.7)) continue;
    const dn = near(mx, mz), w = x1 - x0, d = z1 - z0;
    if (other) {
      // Virginia and the far bank: houses in rows on some of the blocks, the rest left to the woods
      if (rand() < 0.55) continue;
      for (let a = x0 + 10; a < x1 - 8; a += 30) for (const s of [-1, 1]) { if (rand() < 0.3) continue; add(2, a, 0, mz + s * d / 4, 20 + rand() * 6, 16 + rand() * 14, d / 2 - 14, 0, 1, pick(rand() < 0.5 ? HOMES : BRICK), 0.15); }
      continue;
    }
    blocks++;
    const up = 1 + (DOWN.k - 1) * clamp(1 - Math.hypot(mx - DOWN.x, mz - DOWN.z) / DOWN.r, 0, 1);
    const H = () => (52 + rand() * 44) * up, col = () => (rand() < 0.2 ? pick(BRICK) : pick(STONE));
    const one = (x, z, bw, bd, h) => { add(0, x, 0, z, bw, h, bd, 0, rand() < 0.55 ? 1 : 0, col(), 0.2); if (rand() < 0.5) add(1, x + (rand() - 0.5) * bw * 0.3, h, z + (rand() - 0.5) * bd * 0.3, bw * 0.3, 6 + rand() * 6, bd * 0.3, 0, 2, lin(0x8f8c84)); };
    const r = rand();
    if (dn > 1000 || r < 0.4) one(mx, mz, w * (0.82 + rand() * 0.14), d * (0.82 + rand() * 0.14), H());
    else if (r < 0.75) { const ax = rand() < 0.5; for (const s of [-1, 1]) one(ax ? mx + s * w / 4 : mx, ax ? mz : mz + s * d / 4, (ax ? w / 2 : w) * 0.88, (ax ? d : d / 2) * 0.88, H()); }
    else for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { if (rand() < 0.12) continue; one(mx + sx * w / 4, mz + sz * d / 4, w / 2 * 0.84, d / 2 * 0.84, H() * 0.85); }
  }

  // ---- the towers across the river (no height limit there), and the ones down it ------------------------------------
  for (const T of L.towers) {
    for (let k = 0; k < T.n; k++) {
      const a = rand() * 6.283, rr = T.r * Math.sqrt(rand()), x = T.x + Math.cos(a) * rr * 0.7, z = T.z + Math.sin(a) * rr;
      if (lands(x + 30, z)[2] < 24 && lands(x, z - 30)[3] < 24) continue;
      tower(x, z, 44 + rand() * 30, 44 + rand() * 30, T.h * (0.5 + 0.5 * rand()) * (1 - 0.4 * rr / T.r), true);
    }
  }

  // ---- the cathedral on its hill: a long nave, two west towers and a taller one over the crossing ---------------------
  {
    const [x, z] = L.cathedral, c = lin(0xcfc8b6), k = 1.6;
    add(0, x, 0, z, 150 * k, 46 * k, 34 * k, 0, 1, c, 0.1); add(0, x + 10 * k, 0, z, 30 * k, 46 * k, 84 * k, 0, 1, c, 0.1);
    add(1, x, 46 * k, z, 146 * k, 10 * k, 14 * k, 0, 2, lin(0x7d8a86));
    for (const s of [-1, 1]) { add(0, x - 66 * k, 0, z + s * 13 * k, 18 * k, 86 * k, 18 * k, 0, 1, c, 0.05); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(1, x - 66 * k + a * 7 * k, 86 * k, z + s * 13 * k + b * 7 * k, 3 * k, 12 * k, 3 * k, 0, 2, c); }
    add(0, x + 10 * k, 0, z, 26 * k, 112 * k, 26 * k, 0, 1, c, 0.05); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(1, x + 10 * k + a * 11 * k, 112 * k, z + b * 11 * k, 4 * k, 16 * k, 4 * k, 0, 2, c);
  }

  // ---- the bridges past the edge: a deck on arches from bank to bank ------------------------------------------------
  for (const B of L.bridges) {
    const [ax, az] = B.a, [bx, bz] = B.b, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, yaw = Math.atan2(-uz, ux), c = lin(B.col || 0xc9c2b0);
    add(0, (ax + bx) / 2, B.y - 5, (az + bz) / 2, len + 60, 5, B.w, yaw, 2, c);
    for (const e of [-1, 1]) add(1, (ax + bx) / 2 - uz * e * (B.w / 2 - 1), B.y, (az + bz) / 2 + ux * e * (B.w / 2 - 1), len + 60, 2.5, 1.6, yaw, 2, c);
    const n = Math.max(2, Math.round(len / B.span));
    for (let k = 0; k <= n; k++) { const s = len * k / n; add(0, ax + ux * s, 0, az + uz * s, 12, B.y - 5, B.w - 4, yaw, 2, c); if (k < n) add(0, ax + ux * (s + len / n / 2), B.y - 11, az + uz * (s + len / n / 2), len / n - 12, 6, B.w - 6, yaw, 2, c.map((v) => v * 0.8)); }
    for (let s = 20; s < len; s += 50) for (const e of [-1, 1]) add(3, ax + ux * s - uz * e * (B.w / 2 - 2), B.y, az + uz * s + ux * e * (B.w / 2 - 2), 1, 12, 1, 0, 2, POLE);
  }

  // ---- boats on the river -------------------------------------------------------------------------------------------
  for (const S of L.boats || []) {
    const yaw = S.yaw, cx = Math.cos(yaw), sz = -Math.sin(yaw);
    add(2, S.x, 0, S.z, S.len, 5, S.len * 0.24, yaw, 2, lin(0xe8e6e0));
    add(2, S.x - cx * S.len * 0.08, 5, S.z - sz * S.len * 0.08, S.len * 0.6, 5, S.len * 0.2, yaw, 1, lin(0xf2f0ea), 0.3);
    add(3, S.x - cx * S.len * 0.1, 10, S.z - sz * S.len * 0.1, S.len * 0.34, 4, S.len * 0.16, yaw, 2, lin(0x3c5f8a));
  }

  return {
    layout: LAYOUT,
    defs: '#define BD_SHARE (0.25 + 0.75 * smoothstep(0.15, 0.9, bdNight))\n#define BD_BRIGHT min(1.0, bdNight * 1.8)\n',
    ground: { geo, fn: groundFn(W), main: GROUND_MAIN, glow: 'vec3(0.0)', cap: 1.0, keep: 0.5 },
    nearD: 900,
    craft: { heli: L.heli },
    skyline: { R: 2340, top: 380, rep: 1, body: [0.8, 0.45], paint: (w, h, r) => paintHills(w, h, r, L.hills) },
    counts: { blocks },
  };
}

// The ground's paint: the water (the map's own blue, darker along the shores), a stone edge along the shore, the city
// in blocks (paving, with a square of grass here and there) and broad streets between them, and everywhere else
// grass and the darker floor of the woods.
const groundFn = (W) => `
vec3 bdGround(vec2 p, vec2 fw, out vec3 light) {
  float big = bdN(p * 0.006), mid = bdN(p * 0.045 + 7.0);
  float grain = bdDetail > 0.5 ? mix(bdH(floor(p * 1.5)), 0.5, clamp(max(fw.x, fw.y) * 1.2 - 0.4, 0.0, 1.0)) : 0.5;
  vec4 L = bdLands(p); float d = max(max(L.x, L.y), max(L.z, L.w));
  light = vec3(0.0);
  if (d < 0.0) {
    float streak = bdN(vec2(p.x * 0.35, p.y * 2.2)) * bdN(vec2(p.x * 0.07 + 3.0, p.y * 0.6));
    vec3 col = BD_WATER * (0.94 + 0.16 * mix(streak, 0.25, clamp(max(fw.x, fw.y) * 2.0 - 0.5, 0.0, 1.0)) - 0.06 * big);
    return mix(col, col * 0.7, smoothstep(-6.0, -2.5, d));
  }
  if (d < 4.0) return vec3(0.45, 0.43, 0.39) * (0.85 + 0.2 * grain);
  vec3 green = mix(BD_LAWN * (0.8 + 0.4 * mid), BD_LAWN * vec3(0.5, 0.62, 0.5), smoothstep(0.42, 0.58, big)) * (0.9 + 0.2 * grain);
  if (L.x < 14.0 || L.x < d - 0.01) return green;
  // (the first of the city past the map's edge is paving, not a street: no road runs along beside the course)
  float edge = max(max(${F(W[0])} - p.x, p.x - ${F(W[2])}), max(${F(W[1])} - p.y, p.y - ${F(W[3])}));
  float e = edge < 44.0 ? 0.0 : bdBlock(p);
  if (e > ${F(GRID / 2 - STREET)}) return vec3(0.2, 0.2, 0.21) * (0.85 + 0.2 * big) * (0.9 + 0.2 * grain);
  if (e > ${F(GRID / 2 - STREET - 6)}) return BD_PAVE * (0.82 + 0.2 * grain);
  float park = bdH(floor(p / ${F(GRID)}) + 3.7);
  return park < 0.12 ? green : BD_PAVE * (0.7 + 0.25 * mid) * (0.9 + 0.2 * grain);
}
`;
const GROUND_MAIN = `
vec2 bdP = vBdW.xz; vec2 bdFw = max(fwidth(bdP), vec2(1e-3));
vec3 bdLight; vec3 bdAlb = bdGround(bdP, bdFw, bdLight);
`;

// The skyline: no towers, but wooded hills all the way round, a far ridge and a nearer, darker one with the tops of
// its trees along it. `hills` (0 to 1 of the way round, from due south by east) says how high they stand.
function paintHills(W, H, rand, hills) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, TAU = Math.PI * 2;
  const put = (x, y, r) => { if (y < 0 || y >= H) return; const i = (x + (H - 1 - y) * W) * 4; d[i] = r; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 255; };
  const scale = (u) => { const n = hills.length - 1, t = u * n, i = Math.min(n - 1, Math.floor(t)), f = t - i, s = f * f * (3 - 2 * f); return hills[i] + (hills[i + 1] - hills[i]) * s; };
  for (const [shade, base, amp, rough] of [[235, 13, 9, 0], [170, 6, 6, 2]]) {
    const ph = rand() * 6;
    for (let x = 0; x < W; x++) {
      const u = x / W * TAU, k = scale(x / W);
      const h = Math.round((base + amp * (0.5 + 0.3 * Math.sin(u * 3 + ph) + 0.14 * Math.sin(u * 7 + ph * 2) + 0.06 * Math.sin(u * 19 + ph * 3))) * k + rand() * rough);
      for (let y = 0; y < h; y++) put(x, y, shade);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
