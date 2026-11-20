// Washington's set pieces: the White House and the Ellipse, the Lincoln Memorial, the Washington Monument, the war
// memorial at the end of the Reflecting Pool, the Jefferson Memorial, the Capitol, the Pentagon, the Castle, the three
// museums of the Mall and Union Station.
// Our own voxel designs. These are public buildings and monuments and keep their names.
// Each is drawn round a local origin with its front toward low z, and turned by place().
import { M, set, put, box, hole, walls, begin, rnd, ri, vehicle } from './world.js';
import { face, faces4, win, door, gableRoof, spire, tree, lampPost, bench, car, desk, sofa, ceilingLight } from './kit.js';
import { rdisc, dome, chain } from './cairo_kit.js';
import { sakura } from './tokyo_kit.js';
import { usflag, flagpole, pediment, arch, elm } from './dc_kit.js';

const hsh = (a, b, c) => ((Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) >>> 0) % 100;
export const WHITEHOUSE = { S: 86 }, ELLIPSE = { S: 86 }, LINCOLN = { S: 86 }, JEFFERSON = { S: 86 }, CAPITOL = { S: 132 }, PENTAGON = { S: 132 }, CASTLE = { S: 86 }, MUSEUM = { S: 86 }, UNION = { S: 86 };

// a round stone basin with a jet in the middle
function basin(cx, cz, title, R = 5) {
  begin(title, 'prop', false);
  rdisc(cx, cz, 0, R, M.MARBLE); rdisc(cx, cz, 1, R, M.MARBLE, R - 1); rdisc(cx, cz, 1, R - 1, M.WATER);
  box(cx, 1, cz, cx, 5, cz, M.MARBLE); rdisc(cx, cz, 6, 2, M.MARBLE); rdisc(cx, cz, 7, 1, M.WATER); set(cx, 8, cz, M.WATER);
}
// a hall: walls to `top`, floors, a roof slab and a parapet
function shell(X, Z, a0, b0, a1, b1, top, W, floors = []) {
  walls(X(a0), 0, Z(b0), X(a1), top, Z(b1), W);
  for (const y of floors) box(X(a0 + 1), y, Z(b0 + 1), X(a1 - 1), y, Z(b1 - 1), M.CONC);
  box(X(a0), top, Z(b0), X(a1), top, Z(b1), M.SLAB); walls(X(a0), top + 1, Z(b0), X(a1), top + 2, Z(b1), W);
}
// a porch on the front of a wall at b = bw: a podium y high with steps, n columns, a beam and a pediment. Returns its top.
function porch(X, Z, a0, a1, bw, n, y, H, W, T, deep = 7) {
  box(X(a0), 0, Z(bw - deep), X(a1), y - 1, Z(bw - 1), W);
  for (let k = 1; k * 2 <= y; k++) box(X(a0 + 3), 0, Z(bw - deep - 2 * k), X(a1 - 3), y - 1 - 2 * k, Z(bw - deep - 2 * k + 1), W);
  const step = (a1 - a0 - 1) / (n - 1);
  for (let i = 0; i < n; i++) { const a = a0 + Math.round(i * step); box(X(a), y, Z(bw - deep + 1), X(a + 1), H, Z(bw - deep + 2), T); }
  box(X(a0), H + 1, Z(bw - deep), X(a1), H + 4, Z(bw - 1), W);
  return pediment(X(a0), X(a1), H + 5, Z(bw - deep), Z(bw), W, 2);
}

// ---- the White House: a white house of two storeys over a ground floor, eleven windows wide, with a porch of tall
// columns under a pediment to the north and a round bow with its own columns to the south; low wings either side, a
// railing round the lawn and a fountain before the door --------------------------------------------------------------
export function whitehouse(lx, lz, L, o = {}) {
  const X = (a) => lx + a, Z = (b) => lz + b, W = M.MARBLE, T = M.TRIM, A0 = 14, A1 = 71, B0 = 36, B1 = 61, top = 30;
  begin('The White House', 'landmark');
  walls(X(A0), 0, Z(B0), X(A1), top, Z(B1), W);
  for (const y of [8, 19]) box(X(A0 + 1), y, Z(B0 + 1), X(A1 - 1), y, Z(B1 - 1), M.FLOOR);
  box(X(A0), top + 1, Z(B0), X(A1), top + 1, Z(B1), M.SLAB);
  const F4 = faces4(X(A0), Z(B0), X(A1), Z(B1)), Fn = F4[0], Fs = F4[2];
  for (const F of F4) {
    for (let u = 3; u + 3 < F.W; u += 5) {
      if (F === Fs && u > 15 && u < 40) continue;   // the bow
      if (!(F === Fn && u > 24 && u < 32)) win(F, u, 2, 3, 4, { frame: 0, sill: false, bars: false });
      win(F, u, 11, 3, 6, { frame: T, lintel: L >= 1 ? T : 0 }); win(F, u, 22, 3, 5, { frame: T });
    }
    if (L >= 1) { F.band(9, 9, 1, T); F.band(top, top, 1, T); }
    for (let u = 0; u < F.W; u++) { F.p(u, top + 2, 0, T); if (u % 2 === 0) F.p(u, top + 3, 0, T); }
  }
  door(Fn, 27, 4, 8, M.DARK, { glass: true, frame: T, step: false });
  // the north porch
  box(X(30), 0, Z(24), X(55), 0, Z(35), M.GRANITE);
  for (const a of [32, 38, 46, 52]) box(X(a), 1, Z(26), X(a + 1), 28, Z(27), T);
  for (const a of [32, 52]) box(X(a), 1, Z(31), X(a + 1), 28, Z(32), T);
  box(X(31), 29, Z(25), X(54), 31, Z(35), W); pediment(X(31), X(54), 32, Z(25), Z(35), W, 2);
  box(X(42), 26, Z(30), X(43), 28, Z(30), M.LIT);
  // the south bow: a half-round of wall, a balcony on a low base, six columns and a ring of roof
  const ca = 42.5, cb = B1;
  for (let a = 28; a <= 57; a++) for (let b = B1 + 1; b <= B1 + 15; b++) {
    const r2 = (a - ca) * (a - ca) + (b - cb) * (b - cb), sec = Math.floor(Math.atan2(b - cb, a - ca) / (Math.PI / 9));
    if (r2 >= 196) continue;
    if (r2 >= 81 && r2 < 121) for (let y = 0; y <= top; y++) set(X(a), y, Z(b), (sec & 1) && ((y >= 11 && y <= 16) || (y >= 22 && y <= 26) || (y >= 2 && y <= 5)) ? M.GLASS : W);
    if (r2 >= 150) for (let y = 0; y <= 7; y++) set(X(a), y, Z(b), W);
    if (r2 >= 121) set(X(a), 8, Z(b), M.SLAB); else if (r2 < 81) { set(X(a), 8, Z(b), M.FLOOR); set(X(a), 19, Z(b), M.FLOOR); }
    set(X(a), top + 1, Z(b), M.SLAB);
    if (r2 >= 160) set(X(a), top + 2, Z(b), T);
  }
  for (let i = 0; i < 6; i++) { const an = (i + 0.5) * Math.PI / 6, a = Math.round(ca + 12.6 * Math.cos(an) - 0.5), b = Math.round(cb + 12.6 * Math.sin(an)); box(X(a), 9, Z(b), X(a), top, Z(b), T); }
  hole(X(41), 9, Z(B1), X(44), 16, Z(B1)); hole(X(41), 0, Z(B1), X(44), 6, Z(B1));
  // the low wings
  for (const [a0, a1] of [[2, 13], [72, 83]]) {
    walls(X(a0), 0, Z(44), X(a1), 8, Z(53), W); box(X(a0), 9, Z(44), X(a1), 9, Z(53), M.SLAB);
    for (const F of [face('f', X(a0), Z(44), X(a1), Z(53)), face('b', X(a0), Z(44), X(a1), Z(53))]) for (let u = 1; u + 1 < 12; u += 3) F.box(u, 2, u + 1, 6, 0, 0, M.GLASS);
    for (let a = a0; a <= a1; a += 2) { set(X(a), 10, Z(44), T); set(X(a), 10, Z(53), T); }
  }
  // the top floor behind the balustrade, the chimneys and the flag
  walls(X(A0 + 7), top + 2, Z(B0 + 6), X(A1 - 7), top + 6, Z(B1 - 6), W); box(X(A0 + 7), top + 7, Z(B0 + 6), X(A1 - 7), top + 7, Z(B1 - 6), M.SLAB);
  for (let a = A0 + 10; a < A1 - 9; a += 5) { box(X(a), top + 3, Z(B0 + 6), X(a + 1), top + 5, Z(B0 + 6), M.DARK); box(X(a), top + 3, Z(B1 - 6), X(a + 1), top + 5, Z(B1 - 6), M.DARK); }
  for (const a of [A0 + 10, A0 + 22, A1 - 23, A1 - 11]) box(X(a), top + 8, Z(48), X(a + 1), top + 11, Z(49), W);
  usflag(X(42), top + 8, Z(46), 13);
  if (L >= 3) {
    box(X(A0 + 1), 0, Z(B0 + 1), X(A1 - 1), 0, Z(B1 - 1), M.FLOOR);
    for (let b = B0 + 1; b < B1; b++) for (const a of [41, 42, 43, 44]) put(X(a), 9, Z(b), M.FURN_A);
    desk(X(40), 9, Z(64)); sofa(X(36), 9, Z(55)); sofa(X(20), 9, Z(40)); sofa(X(58), 9, Z(40)); desk(X(20), 20, Z(42)); desk(X(60), 20, Z(42));
    for (const a of [24, 42, 60]) { ceilingLight(X(a), 18, Z(48)); ceilingLight(X(a), 7, Z(48)); ceilingLight(X(a), top, Z(48)); }
  }
  // the grounds
  basin(X(42), Z(13), 'North fountain', 6);
  begin('White House railing', 'wall', false);
  const post = (a, b, t) => { if (t % 2 === 0) box(X(a), 0, Z(b), X(a), 4, Z(b), M.DARK); else set(X(a), 3, Z(b), M.DARK); };
  for (let a = 0; a <= 85; a++) if (a < 37 || a > 48) post(a, 1, a);
  for (let b = 2; b <= 84; b++) { post(0, b, b); post(85, b, b); }
  for (const a of [35, 49]) { begin('Gate post', 'prop', false); box(X(a), 0, Z(0), X(a + 1), 6, Z(1), M.MARBLE); box(X(a), 7, Z(0), X(a + 1), 8, Z(1), M.LIT); }
  if (L >= 2) {
    for (const [a, b] of [[8, 12], [77, 12], [22, 26], [63, 26], [7, 32], [78, 32], [8, 66], [77, 66], [20, 78], [65, 78]]) elm(X(a), Z(b), ri(8, 10), ri(6, 7));
    begin('Flower bed', 'prop', false);
    for (const a0 of [26, 50]) for (let a = a0; a < a0 + 10; a++) for (const b of [10, 11, 15, 16]) { set(X(a), 0, Z(b), M.DIRT); set(X(a), 1, Z(b), (a + b) & 1 ? M.FLOWER_R : M.TRIM); }
    lampPost(X(28), Z(22), 16); lampPost(X(57), Z(22), 16);
  }
}

// ---- the Ellipse: the round lawn south of the White House, ringed with elms, with the big decorated fir and a fountain -
export function ellipse(lx, lz, L, o = {}) {
  const X = (a) => lx + a, Z = (b) => lz + b;
  for (let i = 0; i < 14; i++) { const an = (i + 0.5) * Math.PI / 7; elm(X(Math.round(43 + 39 * Math.cos(an))), Z(Math.round(46 + 37 * Math.sin(an))), ri(8, 10), ri(6, 7)); }
  begin('National tree', 'tree', false);
  const cx = X(43), cz = Z(22);
  box(cx, 0, cz, cx + 1, 4, cz + 1, M.TRUNK);
  for (let y = 4; y <= 31; y++) {
    const R = Math.max(0.8, (32 - y) * 8 / 28);
    for (let dx = -8; dx <= 9; dx++) for (let dz = -8; dz <= 9; dz++) {
      const d = Math.hypot(dx - 0.5, dz - 0.5); if (d > R) continue;
      const h = hsh(dx + 40, y, dz + 40), skin = d > R - 1.6;
      set(cx + dx, y, cz + dz, skin && h < 9 ? (h & 1 ? M.LIT_Y : M.LIT_R) : skin && h < 13 ? M.LIT_B : h < 45 ? M.HEDGE : M.LEAF);
    }
  }
  box(cx, 32, cz, cx + 1, 33, cz + 1, M.LIT_Y);
  basin(X(43), Z(64), 'Ellipse fountain', 6);
  if (L >= 2) { bench(X(30), Z(60)); bench(X(52), Z(60)); lampPost(X(20), Z(44), 18); lampPost(X(66), Z(44), 18); }
}

// ---- the Lincoln Memorial: a marble temple on three terraces, a row of columns all the way round under a deep beam, a
// plain block above, and inside, facing out through the open front, the seated statue ---------------------------------
export function lincoln(lx, lz, L, o = {}) {
  const X = (a) => lx + a, Z = (b) => lz + b, W = M.MARBLE, T = M.TRIM;
  begin('Lincoln Memorial', 'landmark');
  // the terraces: a rim of stone under the edge of each, and a floor across the top one
  [[6, 21, 79, 73], [9, 24, 76, 70], [12, 27, 73, 67]].forEach(([a0, b0, a1, b1], k) => { for (let y = 0; y <= 2 * k + 1; y++) for (let t = 0; t < 5; t++) walls(X(a0 + t), y, Z(b0 + t), X(a1 - t), y, Z(b1 - t), W); });
  box(X(12), 5, Z(27), X(73), 5, Z(67), W);
  for (let k = 0; k < 6; k++) box(X(28), 0, Z(19 - 2 * k), X(57), 5 - k, Z(20 - 2 * k), W);
  for (const a of [26, 58]) box(X(a), 0, Z(9), X(a + 1), 6, Z(20), W);
  // the colonnade
  for (let i = 0; i < 12; i++) for (const b of [29, 64]) box(X(14 + 5 * i), 6, Z(b), X(15 + 5 * i), 31, Z(b + 1), T);
  for (let j = 1; j < 7; j++) for (const a of [14, 69]) box(X(a), 6, Z(29 + 5 * j), X(a + 1), 31, Z(30 + 5 * j), T);
  // the hall, open at the front
  walls(X(19), 6, Z(34), X(66), 31, Z(60), W); hole(X(37), 6, Z(34), X(48), 25, Z(34));
  // the beam, the roof of the colonnade and the block above
  box(X(13), 32, Z(28), X(72), 32, Z(66), W);
  for (const t of [0, 1]) walls(X(13 + t), 33, Z(28 + t), X(72 - t), 35, Z(66 - t), W);
  box(X(13), 36, Z(28), X(72), 36, Z(66), W);
  walls(X(18), 33, Z(33), X(67), 46, Z(61), W); box(X(18), 47, Z(33), X(67), 47, Z(61), M.SLAB);
  if (L >= 1) {
    for (const F of faces4(X(13), Z(28), X(72), Z(66))) { F.band(36, 36, 1, T); for (let u = 2; u < F.W; u += 5) F.box(u, 34, u + 1, 34, 0, 0, M.LIME2); }
    for (const F of faces4(X(18), Z(33), X(67), Z(61))) { F.band(46, 46, 1, T); for (let u = 3; u + 1 < F.W; u += 5) F.box(u, 41, u + 1, 43, 0, 0, M.LIME2); }
  }
  for (const [a, b] of [[30, 46], [55, 46], [42, 40]]) box(X(a), 31, Z(b), X(a + 1), 31, Z(b + 1), M.LIT_Y);
  // the statue: he sits in his chair, hands on its arms, looking out over the pool
  hole(X(39), 5, Z(49), X(46), 5, Z(57));
  begin('Lincoln statue', 'monument');
  box(X(39), 0, Z(49), X(46), 8, Z(57), M.GRANITE);
  box(X(40), 9, Z(53), X(45), 13, Z(56), T); box(X(40), 14, Z(56), X(45), 20, Z(56), T);
  for (const a of [39, 46]) box(X(a), 9, Z(50), X(a), 15, Z(56), T);
  for (const a of [41, 44]) box(X(a), 9, Z(50), X(a), 13, Z(52), T);
  box(X(41), 14, Z(54), X(44), 19, Z(55), T); box(X(42), 20, Z(54), X(43), 22, Z(55), T);
  for (const a of [40, 45]) box(X(a), 14, Z(51), X(a), 15, Z(55), T);
  if (L >= 2) { flagpole(X(8), Z(12), 18); flagpole(X(76), Z(12), 18); lampPost(X(22), Z(14), 16); lampPost(X(63), Z(14), 16); }
}

// ---- the Washington Monument: a hollow marble needle, the stone a shade paler above the first third, a pointed cap
// with a light on it, and a ring of flags round its foot --------------------------------------------------------------
export function wmonument(lx, lz, L, o = {}) {
  const X = (a) => lx + a, Z = (b) => lz + b, H = 150;
  begin('Washington Monument', 'landmark');
  for (let y = 0; y < H; y++) { const i = Math.floor(y / 50), m = y < 52 ? M.MARBLE : M.TRIM; walls(X(12 + i), y, Z(12 + i), X(27 - i), y, Z(27 - i), m); walls(X(13 + i), y, Z(13 + i), X(26 - i), y, Z(26 - i), m); }
  for (const y of [49, 99, 146]) box(X(14), y, Z(14), X(25), y, Z(25), M.CONC);
  let y = H;
  for (let k = 0; k < 6; k++) for (let r = 0; r < 3; r++, y++) { walls(X(14 + k), y, Z(14 + k), X(25 - k), y, Z(25 - k), M.TRIM); if (k < 5) walls(X(15 + k), y, Z(15 + k), X(24 - k), y, Z(24 - k), M.TRIM); }
  box(X(19), y, Z(19), X(20), y, Z(20), M.CHROME); box(X(19), y - 4, Z(18), X(20), y - 4, Z(18), M.LIT_R); box(X(19), y - 4, Z(21), X(20), y - 4, Z(21), M.LIT_R);
  for (const F of faces4(X(14), Z(14), X(25), Z(25))) for (const u of [3, 7]) F.box(u, H + 2, u + 1, H + 3, 0, 0, M.DARK);
  hole(X(18), 0, Z(12), X(21), 6, Z(13)); box(X(18), 7, Z(12), X(21), 7, Z(12), M.LIME2);
  if (L >= 1) for (let i = 0; i < 12; i++) { const an = (i + 0.5) * Math.PI / 6; flagpole(X(Math.round(19.5 + 17.5 * Math.cos(an))), Z(Math.round(19.5 + 17.5 * Math.sin(an))), 13); }
}

// ---- the war memorial at the end of the Reflecting Pool: an oval of granite pillars round a fountain, with a small
// open pavilion at either end -----------------------------------------------------------------------------------------
export function ww2(lx, lz, L, o = {}) {
  const X = (a) => lx + a, Z = (b) => lz + b, cx = X(20), cz = Z(20);
  begin('Memorial fountain', 'prop', false);
  rdisc(cx, cz, 0, 10, M.MARBLE); rdisc(cx, cz, 1, 10, M.GRANITE, 9); rdisc(cx, cz, 1, 9, M.WATER);
  for (const [a, b, h] of [[0, 0, 7], [-4, 0, 4], [4, 0, 4], [0, -4, 4], [0, 4, 4]]) box(cx + a, 2, cz + b, cx + a, h, cz + b, M.WATER);
  for (let i = 0; i < 20; i++) {
    const an = (i + 0.5) * Math.PI / 10, c = Math.cos(an), s = Math.sin(an);
    if (Math.abs(s) < 0.3 || Math.abs(c) < 0.25) continue;   // open toward the pool and the monument, and where the pavilions stand
    const a = Math.round(20 + 17 * c), b = Math.round(20 + 17 * s);
    begin('Memorial pillar', 'monument'); box(X(a), 0, Z(b), X(a + 1), 9, Z(b + 1), M.GRANITE); box(X(a), 10, Z(b), X(a + 1), 10, Z(b + 1), M.MARBLE); set(X(a + (c < 0 ? 2 : -1)), 7, Z(b), M.BRASS);
  }
  for (const a0 of [1, 33]) {
    begin('Memorial pavilion', 'monument');
    for (const a of [a0, a0 + 4]) for (const b of [16, 22]) box(X(a), 0, Z(b), X(a + 1), 13, Z(b + 1), M.GRANITE);
    box(X(a0), 14, Z(16), X(a0 + 5), 15, Z(23), M.MARBLE); box(X(a0 + 1), 16, Z(17), X(a0 + 4), 16, Z(22), M.MARBLE);
    box(X(a0 + 2), 12, Z(19), X(a0 + 3), 13, Z(20), M.BRASS);
  }
}

// ---- the Jefferson Memorial: a round hall under a low dome, columns all the way round it, a porch with a pediment
// toward the water and a bronze figure standing inside -----------------------------------------------------------------
export function jefferson(lx, lz, L, o = {}) {
  const X = (a) => lx + a, Z = (b) => lz + b, W = M.MARBLE, T = M.TRIM, cx = X(43), cz = Z(48);
  begin('Jefferson Memorial', 'landmark');
  for (let y = 0; y <= 1; y++) rdisc(cx, cz, y, 33, W, 26);
  for (let y = 0; y <= 3; y++) rdisc(cx, cz, y, 30, W, 23);
  for (let y = 0; y <= 4; y++) rdisc(cx, cz, y, 27, W, 20);
  rdisc(cx, cz, 5, 27, W);
  // the porch: a block of steps, six columns and two behind, the beam and the pediment
  box(X(28), 0, Z(10), X(58), 5, Z(24), W); box(X(31), 0, Z(7), X(55), 3, Z(9), W); box(X(31), 0, Z(4), X(55), 1, Z(6), W);
  for (let i = 0; i < 6; i++) box(X(30 + 5 * i), 6, Z(12), X(31 + 5 * i), 27, Z(13), T);
  for (const a of [30, 55]) box(X(a), 6, Z(18), X(a + 1), 27, Z(19), T);
  box(X(29), 28, Z(11), X(57), 31, Z(25), W); pediment(X(29), X(57), 32, Z(11), Z(25), W, 2);
  // the ring of columns, the wall inside it with four doorways, the beam
  for (let i = 0; i < 24; i++) { const an = (i + 0.5) * Math.PI / 12, x = Math.round(cx + 24 * Math.cos(an) - 0.5), z = Math.round(cz + 24 * Math.sin(an) - 0.5); box(x, 6, z, x + 1, 27, z + 1, T); }
  for (let y = 6; y <= 27; y++) rdisc(cx, cz, y, 19, W, 17);
  hole(cx - 3, 6, cz - 20, cx + 3, 21, cz - 16); hole(cx - 3, 6, cz + 16, cx + 3, 21, cz + 20); hole(cx - 20, 6, cz - 3, cx - 16, 21, cz + 3); hole(cx + 16, 6, cz - 3, cx + 20, 21, cz + 3);
  rdisc(cx, cz, 28, 26, W, 16);
  for (let y = 29; y <= 31; y++) rdisc(cx, cz, y, 26, y === 31 ? T : W, 24);
  for (let y = 29; y <= 33; y++) rdisc(cx, cz, y, 21, W, 18);
  const dt = dome(cx, cz, 34, 20, W, { sq: 0.62, t: 2.6 }); rdisc(cx, cz, dt + 1, 2, T);
  for (const [a, b] of [[-16, 5], [16, 5], [5, 16]]) box(cx + a, 23, cz + b, cx + a, 24, cz + b, M.LIT_Y);
  // the figure
  hole(cx - 2, 5, cz - 2, cx + 2, 5, cz + 2);
  begin('Jefferson statue', 'monument');
  box(cx - 2, 0, cz - 2, cx + 2, 9, cz + 2, M.GRANITE);
  box(cx - 1, 10, cz, cx + 1, 21, cz + 1, M.IRON); box(cx - 2, 16, cz, cx - 2, 20, cz, M.IRON); box(cx + 2, 16, cz, cx + 2, 20, cz, M.IRON); box(cx, 22, cz, cx, 24, cz + 1, M.IRON); box(cx - 1, 10, cz + 2, cx + 1, 17, cz + 2, M.IRON);
  if (L >= 2) { for (const [a, b] of [[6, 8], [80, 8], [5, 44], [81, 44], [8, 80], [78, 80], [16, 20], [70, 20]]) sakura(X(a), Z(b), ri(7, 9), ri(5, 6)); lampPost(X(24), Z(3), 16); lampPost(X(61), Z(3), 16); }
}

// ---- the Capitol: a long white building on a terrace, a wing at each end, porches of columns under pediments on both
// fronts, a great flight of steps, and over the middle the dome: a ring of columns, a drum of windows, the ribbed dome
// and the lantern with the bronze figure on top. The middle and each wing are bodies of their own. ---------------------
export function capitol(lx, lz, L, o = {}) {
  const X = (a) => lx + a, Z = (b) => lz + b, W = M.MARBLE, T = M.TRIM, G = M.LIME2, TOP = 38;
  const block = (a0, b0, a1, b1, skip = () => false) => {
    for (let y = 0; y <= TOP + 1; y++) walls(X(a0), y, Z(b0), X(a1), y, Z(b1), y < 8 ? G : W);
    for (const y of [7, 17, 27]) box(X(a0 + 1), y, Z(b0 + 1), X(a1 - 1), y, Z(b1 - 1), M.CONC);
    box(X(a0), TOP, Z(b0), X(a1), TOP, Z(b1), M.SLAB);
    for (const F of faces4(X(a0), Z(b0), X(a1), Z(b1))) {
      for (let u = 0; u < F.W; u += 2) F.p(u, TOP + 2, 0, T);
      if (skip(F)) continue;
      for (let u = 3; u + 2 < F.W; u += 5) { F.box(u, 3, u + 1, 5, 0, 0, M.DARK); for (let s = 0; s < 3; s++) win(F, u, 10 + 10 * s, 2, 6, { frame: T, bars: false }); }
      if (L >= 1) { for (let u = 1; u < F.W; u += 5) F.box(u, 8, u, TOP - 2, 1, 1, T); F.box(0, TOP - 1, F.W - 1, TOP - 1, 1, 1, T); F.box(0, 7, F.W - 1, 7, 1, 1, T); }
    }
  };
  // a porch on the west (s = -1) or east (s = 1) front of a wall at b = bw
  const front = (a0, n, bw, s, deep) => {
    const a1 = a0 + (n - 1) * 5 + 3, B = (d) => Z(bw + s * d), lo = (d0, d1) => [Math.min(B(d0), B(d1)), Math.max(B(d0), B(d1))];
    let [za, zb] = lo(1, deep); box(X(a0), 0, za, X(a1), 7, zb, G);
    [za, zb] = lo(deep - 2, deep - 1); for (let i = 0; i < n; i++) box(X(a0 + 1 + 5 * i), 8, za, X(a0 + 2 + 5 * i), 35, zb, T);
    [za, zb] = lo(1, deep); box(X(a0), 36, za, X(a1), TOP + 1, zb, W);
    [za, zb] = lo(0, deep); pediment(X(a0), X(a1), TOP + 2, za, zb, W, 2);
  };
  // the wings, each joined to the middle by a lower link
  for (const [a0, la] of [[4, 38], [94, 86]]) {
    begin('The Capitol', 'landmark');
    block(la, 58, la + 7, 89, (F) => F.side === 'l' || F.side === 'r'); block(a0, 50, a0 + 33, 97, (F) => F.side === (a0 < 50 ? 'r' : 'l'));
    front(a0 + 2, 6, 50, -1, 5); front(a0 + 2, 6, 97, 1, 5);
    usflag(X(a0 + 16), TOP + 1, Z(74), 13);
  }
  // the middle, with the dome
  begin('The Capitol', 'landmark');
  block(46, 48, 85, 99, (F) => F.side === 'l' || F.side === 'r'); front(46, 8, 48, -1, 6); front(46, 8, 99, 1, 6);
  for (let k = 0; k < 8; k++) { box(X(52), 0, Z(40 - 2 * k), X(79), 7 - k, Z(41 - 2 * k), W); box(X(54), 0, Z(106 + 2 * k), X(77), 7 - k, Z(107 + 2 * k), W); }
  const cx = X(66), cz = Z(74);
  walls(X(51), TOP + 1, Z(59), X(81), 45, Z(89), W); box(X(51), 45, Z(59), X(81), 45, Z(89), M.SLAB);
  rdisc(cx, cz, 46, 17, W, 10);
  for (let i = 0; i < 24; i++) { const an = (i + 0.5) * Math.PI / 12, x = cx + Math.round(15.6 * Math.cos(an)), z = cz + Math.round(15.6 * Math.sin(an)); box(x, 47, z, x, 61, z, T); }
  for (let y = 46; y <= 63; y++) for (let dx = -13; dx <= 13; dx++) for (let dz = -13; dz <= 13; dz++) {
    const d = dx * dx + dz * dz; if (d > 13.3 * 13.3 || d <= 11.3 * 11.3) continue;
    set(cx + dx, y, cz + dz, y >= 50 && y <= 58 && (Math.round(Math.atan2(dz, dx) * 12 / Math.PI) & 1) === 0 ? M.GLASS : W);
  }
  rdisc(cx, cz, 62, 17, W, 10); rdisc(cx, cz, 63, 17, T, 10);
  for (let y = 64; y <= 65; y++) rdisc(cx, cz, y, 14, T, 13);
  for (let y = 64; y <= 73; y++) for (let dx = -12; dx <= 12; dx++) for (let dz = -12; dz <= 12; dz++) {
    const d = dx * dx + dz * dz; if (d > 12.3 * 12.3 || d <= 10.3 * 10.3) continue;
    set(cx + dx, y, cz + dz, y >= 67 && y <= 71 && (Math.round(Math.atan2(dz, dx) * 10 / Math.PI) & 1) === 0 ? M.LIT_W : W);
  }
  const dt = dome(cx, cz, 74, 12, W, { sq: 1.3, rib: T, n: 16 });
  rdisc(cx, cz, dt + 1, 4, W);
  for (const [a, b] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, 2], [2, -2], [-2, -2]]) box(cx + a, dt + 2, cz + b, cx + a, dt + 8, cz + b, T);
  box(cx, dt + 2, cz, cx, dt + 6, cz, M.LIT_Y);
  rdisc(cx, cz, dt + 9, 4, W); const lt = dome(cx, cz, dt + 10, 3, W);
  box(cx - 1, lt + 1, cz - 1, cx + 1, lt + 2, cz + 1, T); box(cx, lt + 3, cz, cx, lt + 8, cz, M.IRON); set(cx, lt + 9, cz, M.BRASS);   // a robed figure on a round base: no arms, so it cannot read as a cross
  if (L >= 3) for (const [a, b] of [[-6, 0], [6, 0], [0, 6]]) put(cx + a, 37, cz + b, M.LIT_Y);
  // the terrace in front of the wings
  begin('Capitol terrace', 'wall', false);
  for (const [a0, a1] of [[2, 51], [80, 129]]) { box(X(a0), 0, Z(36), X(a1), 2, Z(43), G); for (let a = a0; a <= a1; a += 2) set(X(a), 3, Z(36), T); }
  if (L >= 2) {
    for (const a of [8, 30, 100, 122]) { lampPost(X(a), Z(30), 18); elm(X(a + 1), Z(12), ri(9, 11), ri(7, 8)); elm(X(a + 1), Z(122), ri(9, 11), ri(7, 8)); }
    for (const a of [44, 87]) { lampPost(X(a), Z(22), 18); lampPost(X(a), Z(118), 18); }
    flagpole(X(48), Z(8), 18); flagpole(X(83), Z(8), 18);
  }
}

// ---- the Pentagon: five rings of offices, one inside the next, joined by ten corridors, round a five-sided court.
// Low and very wide. Each of its five sides is a body of its own. ------------------------------------------------------
export function pentagon(lx, lz, L, o = {}) {
  const S = PENTAGON.S, X = (a) => lx + a, Z = (b) => lz + b, C = 65.5, HT = 23, W = M.LIME2;
  const N = [0, 1, 2, 3, 4].map((k) => { const an = (-90 + 72 * k) * Math.PI / 180; return [Math.cos(an), Math.sin(an)]; });
  const RINGS = [[16, 24], [29, 37], [42, 51]];
  // which side a spot belongs to, how far out it is, and how far along the side
  const at = (a, b) => { let k = 0, pd = -1e9; N.forEach(([c, s], i) => { const d = (a - C) * c + (b - C) * s; if (d > pd) { pd = d; k = i; } }); return [k, pd, -(a - C) * N[k][1] + (b - C) * N[k][0]]; };
  const inside = (a, b) => { if (a < 0 || b < 0 || a >= S || b >= S) return false; const [, pd, t] = at(a, b); return RINGS.some(([lo, hi]) => pd >= lo && pd < hi) || (pd >= 16 && pd < 51 && (Math.abs(t) < 2.5 || Math.abs(t) > pd * 0.7265 - 2.5)); };
  for (let k = 0; k < 5; k++) {
    begin('The Pentagon', 'landmark');
    for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) {
      if (!inside(a, b) || at(a, b)[0] !== k) continue;
      const wall = !inside(a - 1, b) || !inside(a + 1, b) || !inside(a, b - 1) || !inside(a, b + 1), t = Math.round(at(a, b)[2]);
      if (wall) for (let y = 0; y <= HT + 1; y++) set(X(a), y, Z(b), y % 8 >= 3 && y % 8 <= 5 && y < HT && (((t % 4) + 4) % 4) < 2 ? M.GLASS : y === HT + 1 || y % 8 === 7 ? M.LIME : W);
      else { set(X(a), 7, Z(b), M.CONC); set(X(a), 15, Z(b), M.CONC); set(X(a), HT, Z(b), M.ROOF_S); if (L >= 3) set(X(a), 0, Z(b), M.FLOOR); }
    }
  }
  // the court: a small pavilion and trees
  begin('Court pavilion', 'prop', true);
  const cx = X(65), cz = Z(65);
  for (const [a, b] of [[-2, -2], [3, -2], [-2, 3], [3, 3]]) box(cx + a, 0, cz + b, cx + a, 6, cz + b, M.TRIM);
  box(cx - 3, 7, cz - 3, cx + 4, 7, cz + 4, M.ROOF_G); box(cx - 1, 8, cz - 1, cx + 2, 8, cz + 2, M.ROOF_G);
  if (L >= 2) for (let i = 0; i < 5; i++) { const an = (-90 + 36 + 72 * i) * Math.PI / 180; tree(X(Math.round(65 + 10 * Math.cos(an))), Z(Math.round(65 + 10 * Math.sin(an))), 9, 4); }
  // the car parks in the corners, and the flag at the door
  flagpole(X(60), Z(8), 20);
  const PAINT = [M.CAR_A, M.CAR_B, M.CAR_C, M.DARK];
  for (let i = 0; i < 6; i++) { if (i === 2 || i === 3) continue; car(X(6 + 20 * i), Z(2), PAINT[i & 3]); }
  for (const [a, b] of [[2, 100], [2, 110], [2, 120], [20, 122], [112, 100], [112, 110], [112, 120], [94, 122]]) car(X(a), Z(b), PAINT[(a + b) & 3]);
}

// ---- the Castle: the old museum of red sandstone, a long hall between two wings, with a clutch of towers no two alike --
export function castle(lx, lz, L, o = {}) {
  const X = (a) => lx + a, Z = (b) => lz + b, W = M.BRICK, T = M.BROWNST, R = M.ROOF_S;
  begin('The Castle', 'landmark');
  const hall = (a0, b0, a1, b1, h, skip = () => false) => {
    walls(X(a0), 0, Z(b0), X(a1), h, Z(b1), W); box(X(a0 + 1), 12, Z(b0 + 1), X(a1 - 1), 12, Z(b1 - 1), M.FLOOR);
    gableRoof(X(a0), Z(b0), X(a1), Z(b1), h + 1, 'x', R, W, 1);
    for (const F of [face('f', X(a0), Z(b0), X(a1), Z(b1)), face('b', X(a0), Z(b0), X(a1), Z(b1))]) {
      for (let u = 3; u + 2 < F.W; u += 5) { if (skip(F, u)) continue; win(F, u, 3, 2, 6, { frame: T, bars: false }); if (h > 20) win(F, u, 15, 2, 7, { frame: T, bars: false }); }
      if (L >= 1) { F.band(h, h, 1, T); for (let u = 0; u < F.W; u += 2) F.p(u, h + 1, 1, T); F.box(0, 0, F.W - 1, 1, 0, 0, T); }
    }
  };
  hall(24, 48, 61, 72, 26, (F, u) => F.side === 'f' ? u >= 8 && u <= 29 : u >= 13 && u <= 25);
  hall(4, 52, 23, 70, 17); hall(62, 50, 81, 72, 19);
  // a tower: square, banded, with slit windows, battlements, and for some a pointed roof
  const twr = (a0, b0, w, h, roof) => {
    const a1 = a0 + w - 1, b1 = b0 + w - 1;
    for (let y = 0; y <= h; y++) walls(X(a0), y, Z(b0), X(a1), y, Z(b1), y % 10 === 9 ? T : W);
    box(X(a0), h, Z(b0), X(a1), h, Z(b1), T);
    for (const F of faces4(X(a0), Z(b0), X(a1), Z(b1))) { const u = (w >> 1) - 1; F.box(u, h - 9, u + 1, h - 4, 0, 0, M.DARK); if (h > 34) F.box(u, 14, u + 1, 19, 0, 0, M.DARK); for (let q = 0; q < w; q += 2) F.p(q, h + 1, 0, T); }
    return roof ? spire(X(a0), Z(b0), X(a1), Z(b1), h + 1, R, 3) : h + 1;
  };
  const tt = twr(44, 40, 8, 56, true); twr(33, 41, 7, 40, false); twr(37, 73, 10, 38, false); twr(1, 56, 5, 30, true); twr(78, 44, 6, 36, true);
  // the door between the two front towers, under a pointed porch
  box(X(40), 0, Z(44), X(43), 12, Z(47), W); hole(X(41), 0, Z(44), X(42), 8, Z(48)); box(X(40), 13, Z(44), X(43), 13, Z(47), T);
  usflag(X(47), tt, Z(43), 10);
  // the garden: beds of flowers, and the merry-go-round
  if (L >= 1) {
    begin('Flower bed', 'prop', false);
    for (const [a0, b0] of [[10, 12], [10, 26], [26, 12], [26, 26]]) for (let a = a0; a < a0 + 12; a++) for (let b = b0; b < b0 + 9; b++) { const e = a === a0 || a === a0 + 11 || b === b0 || b === b0 + 8; set(X(a), 0, Z(b), e ? M.HEDGE : M.DIRT); set(X(a), 1, Z(b), e ? M.HEDGE : (a + b) % 3 === 0 ? M.FLOWER_Y : (a + b) % 3 === 1 ? M.FLOWER_R : M.LEAF2); }
  }
  begin('Merry-go-round', 'monument');
  const mx = X(68), mz = Z(20);
  rdisc(mx, mz, 0, 8, M.WOOD); box(mx, 1, mz, mx, 12, mz, M.BRASS);
  for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4, x = mx + Math.round(6 * Math.cos(an)), z = mz + Math.round(6 * Math.sin(an)); box(x, 1, z, x, 8, z, M.BRASS); box(x, 3, z, x, 4, z, [M.TRIM, M.CAR_A, M.SIGN, M.CAR_B][i & 3]); }
  for (let k = 0; k < 4; k++) for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) { const d = Math.hypot(dx, dz); if (d <= 8.3 - k * 2.2 && (k === 3 || d > 8.3 - (k + 1) * 2.2 - 1.5)) set(mx + dx, 9 + k, mz + dz, (Math.round(Math.atan2(dz, dx) * 4 / Math.PI) & 1) ? M.AWN_R : M.AWN_W); }
  set(mx, 13, mz, M.BRASS);
  if (L >= 2) { elm(X(6), Z(6), 9, 6); elm(X(50), Z(8), 9, 6); elm(X(80), Z(36), 9, 6); bench(X(44), Z(26)); bench(X(56), Z(30)); lampPost(X(40), Z(4), 16); lampPost(X(22), Z(40), 16); }
}

// ---- the museums of the Mall: each a long hall at the back of its lot with a lawn in front. o.v: 'natural' has a porch
// and a green dome over a rotunda (with an elephant in it, and old bones in the next room); 'gallery' is a windowless
// marble hall with a porch, a low dome and pictures inside; 'space' is four marble blocks with glass between them and
// rockets standing outside. ------------------------------------------------------------------------------------------
function rocket(x, z, h, title) {
  begin(title, 'monument');
  for (let y = 0; y <= h; y++) rdisc(x, z, y, 2, y % 9 === 7 ? M.CAR_A : y === h ? M.DARK : M.TRIM);
  rdisc(x, z, h + 1, 1, M.TRIM); rdisc(x, z, h + 2, 1, M.TRIM); box(x, h + 3, z, x, h + 5, z, M.CAR_A);
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { box(x + a * 3, 0, z + b * 3, x + a * 3, 4, z + b * 3, M.DARK); box(x + a * 4, 0, z + b * 4, x + a * 4, 2, z + b * 4, M.DARK); }
}
export function dcmuseum(lx, lz, L, o = {}) {
  const X = (a) => lx + a, Z = (b) => lz + b, T = M.TRIM, v = o.v || 'natural';
  begin(o.title || 'Museum', 'landmark');
  if (v === 'space') {
    const W = M.MARBLE;
    for (let i = 0; i < 4; i++) { const a0 = 4 + 21 * i; shell(X, Z, a0, 40, a0 + 14, 78, 30, W, [15]); if (L >= 1) for (const F of faces4(X(a0), Z(40), X(a0 + 14), Z(78))) F.band(30, 30, 1, T); }
    for (let i = 0; i < 3; i++) {
      const a0 = 19 + 21 * i;
      for (const b of [45, 73]) for (let a = a0; a <= a0 + 5; a++) for (let y = 0; y <= 25; y++) set(X(a), y, Z(b), (a - a0) % 3 === 2 || y % 9 === 8 ? M.STEEL : M.GLASS_Z);
      box(X(a0), 26, Z(45), X(a0 + 5), 26, Z(73), M.SLAB); box(X(a0), 13, Z(46), X(a0 + 5), 13, Z(72), M.CONC);
      if (i === 1) { hole(X(a0 + 1), 0, Z(45), X(a0 + 4), 8, Z(45)); }
    }
    // inside the middle bay, a lander on its legs; outside, the rockets
    begin('Moon lander', 'monument');
    for (const [a, b] of [[40, 56], [45, 56], [40, 61], [45, 61]]) box(X(a), 0, Z(b), X(a), 3, Z(b), M.METAL);
    box(X(40), 4, Z(56), X(45), 7, Z(61), M.BRASS); box(X(41), 8, Z(57), X(44), 10, Z(60), M.METAL); box(X(42), 11, Z(58), X(42), 13, Z(58), M.DARK); box(X(41), 14, Z(58), X(43), 14, Z(58), M.TRIM);
    rocket(X(26), Z(20), 34, 'Moon rocket'); rocket(X(58), Z(16), 24, 'Rocket'); rocket(X(66), Z(26), 16, 'Rocket');
    if (L >= 2) { elm(X(6), Z(8), 9, 6); elm(X(80), Z(8), 9, 6); bench(X(40), Z(30)); lampPost(X(14), Z(30), 16); lampPost(X(72), Z(34), 16); }
    return;
  }
  const W = v === 'gallery' ? M.MARBLE : M.LIME, top = v === 'gallery' ? 30 : 33, b0 = 40, cx = X(42), cz = Z(59);
  shell(X, Z, 4, b0, 81, 78, top, W, v === 'gallery' ? [] : [11, 22]);
  for (const F of faces4(X(4), Z(b0), X(81), Z(78))) {
    if (v === 'gallery') { for (let u = 3; u + 3 < F.W; u += 6) F.box(u, 6, u + 2, 24, 0, 0, M.LIME); }
    else for (let u = 3; u + 2 < F.W; u += 5) { if (F.side === 'f' && u > 22 && u < 54) continue; for (let s = 0; s < 3; s++) win(F, u, 3 + 11 * s, 2, 6, { frame: T, bars: false }); }
    if (L >= 1) { F.band(top, top, 1, T); F.band(top - 3, top - 3, 0, M.LIME2); }
  }
  porch(X, Z, 27, 58, b0, 6, 6, top - 5, W, T);
  hole(X(40), 6, Z(b0), X(45), 16, Z(b0)); box(X(39), 0, Z(b0 + 1), X(46), 5, Z(b0 + 4), W);
  if (v === 'gallery') {
    walls(X(29), top + 1, Z(46), X(55), top + 5, Z(72), W); box(X(29), top + 6, Z(46), X(55), top + 6, Z(72), M.SLAB);
    const dt = dome(cx, cz, top + 7, 11, W, { sq: 0.5, t: 3.4 }); rdisc(cx, cz, dt + 1, 2, M.GLASS);
    for (const a0 of [9, 62]) box(X(a0), top, Z(50), X(a0 + 14), top, Z(68), M.GLASS);
    // the pictures, along the back wall and the ends
    const INK = [M.FURN_A, M.FURN_B, M.WP_B, M.SIGN, M.DOOR_G, M.LIT_P, M.CAR_B, M.WP_C];
    for (let a = 8, i = 0; a < 76; a += 7, i++) { box(X(a), 4, Z(77), X(a + 4), 9, Z(77), M.BRASS); box(X(a + 1), 5, Z(77), X(a + 3), 8, Z(77), INK[i & 7]); }
    for (let b = 46, i = 0; b < 72; b += 7, i++) for (const a of [5, 80]) { box(X(a), 4, Z(b), X(a), 9, Z(b + 4), M.BRASS); box(X(a), 5, Z(b + 1), X(a), 8, Z(b + 3), INK[(i + a) & 7]); }
    begin('Marble statue', 'monument'); box(cx - 1, 0, cz - 1, cx + 1, 3, cz + 1, M.GRANITE); box(cx, 4, cz, cx, 10, cz, T); set(cx - 1, 8, cz, T); set(cx + 1, 9, cz, T); set(cx, 11, cz, T);
  } else {
    for (let y = top + 1; y <= top + 8; y++) rdisc(cx, cz, y, 11, W, 9);
    const dt = dome(cx, cz, top + 9, 11, M.ROOF_G, { sq: 0.85 }); box(cx, dt + 1, cz, cx, dt + 3, cz, M.BRASS);
    hole(cx - 8, 11, cz - 8, cx + 8, 11, cz + 8); hole(cx - 8, 22, cz - 8, cx + 8, 22, cz + 8); hole(cx - 7, top, cz - 7, cx + 7, top, cz + 7);
    begin('Museum elephant', 'monument');
    rdisc(cx, cz, 0, 6, M.TRUNK); rdisc(cx, cz, 1, 5, M.WOOD);
    for (const [a, b] of [[-2, -3], [2, -3], [-2, 3], [2, 3]]) box(cx + a, 2, cz + b, cx + a, 4, cz + b, M.STONE);
    box(cx - 2, 5, cz - 3, cx + 2, 8, cz + 3, M.STONE); box(cx - 1, 6, cz - 6, cx + 1, 9, cz - 4, M.STONE); box(cx, 2, cz - 7, cx, 6, cz - 7, M.STONE);
    set(cx - 1, 5, cz - 7, T); set(cx + 1, 5, cz - 7, T); box(cx - 3, 6, cz - 3, cx - 3, 8, cz - 2, M.STONE); box(cx + 3, 6, cz - 3, cx + 3, 8, cz - 2, M.STONE); set(cx, 5, cz + 4, M.STONE);
    begin('Dinosaur bones', 'monument');
    box(X(57), 0, Z(56), X(77), 0, Z(60), M.TRUNK);
    for (const a of [64, 69]) for (const b of [57, 59]) { box(X(a), 1, Z(b), X(a), 6, Z(b), T); set(X(a), 6, Z(58), T); }
    box(X(62), 6, Z(58), X(72), 6, Z(58), T);
    for (const a of [66, 67, 71]) for (const b of [57, 59]) { box(X(a), 3, Z(b), X(a), 6, Z(b), T); }
    chain([[X(72), 6, Z(58)], [X(76), 2, Z(58)], [X(77), 1, Z(58)]], T); chain([[X(62), 6, Z(58)], [X(59), 9, Z(58)]], T);
    box(X(57), 9, Z(57), X(59), 10, Z(59), T); set(X(57), 8, Z(58), T);
  }
  if (L >= 2) { elm(X(8), Z(10), 9, 6); elm(X(78), Z(10), 9, 6); elm(X(14), Z(26), 9, 6); elm(X(72), Z(26), 9, 6); bench(X(22), Z(12)); bench(X(60), Z(12)); lampPost(X(34), Z(6), 16); lampPost(X(52), Z(6), 16); }
}

// ---- Union Station: a white front with three great arches in the middle and an arcade each side, the vaulted hall
// behind it, and behind that the platforms with trains standing at them ------------------------------------------------
export function unionstation(lx, lz, L, o = {}) {
  const X = (a) => lx + a, Z = (b) => lz + b, W = M.MARBLE, T = M.TRIM;
  begin('Union Station', 'landmark');
  // the middle pavilion
  walls(X(28), 0, Z(8), X(57), 34, Z(20), W); box(X(28), 35, Z(8), X(57), 35, Z(20), M.SLAB);
  const Fc = face('f', X(28), Z(8), X(57), Z(20));
  for (const u of [2, 11, 20]) arch(Fc, u, 8, 26, 0, 0, 0, M.GLASS);
  for (const [u0, u1] of [[0, 1], [10, 10], [19, 19], [28, 29]]) { Fc.box(u0, 0, u1, 27, 1, 2, T); Fc.box(u0, 28, u1, 28, 1, 2, W); Fc.box(u0, 29, u0, 32, 1, 1, M.LIME2); }
  if (L >= 1) { Fc.band(34, 34, 1, T); Fc.band(28, 28, 0, T); }
  // the arcades
  for (const [a0, a1] of [[4, 27], [58, 81]]) {
    walls(X(a0), 0, Z(12), X(a1), 22, Z(20), W); box(X(a0), 23, Z(12), X(a1), 23, Z(20), M.SLAB);
    const F = face('f', X(a0), Z(12), X(a1), Z(20)); for (const u of [1, 9, 17]) arch(F, u, 6, 16, 0, 0, 0, M.GLASS);
    if (L >= 1) F.band(22, 22, 1, T);
  }
  // the hall, under a barrel vault
  walls(X(16), 0, Z(20), X(69), 36, Z(38), W);
  for (const a of [31, 41, 51]) hole(X(a), 0, Z(20), X(a + 3), 9, Z(20));
  const vh = (b) => (b < 20 || b > 38 ? -1 : Math.round(Math.sqrt(Math.max(0, 90.25 - (b - 29) * (b - 29)))));
  for (let b = 20; b <= 38; b++) for (let a = 16; a <= 69; a++) {
    const end = a === 16 || a === 69, h = vh(b), lo = end ? 0 : Math.max(0, Math.min(vh(b - 1), vh(b + 1)));
    for (let y = lo; y <= h; y++) set(X(a), 37 + y, Z(b), end ? ((b - 29) * (b - 29) + y * y < 36 ? M.GLASS : W) : M.ZINC);
  }
  for (let a = 22; a < 66; a += 6) box(X(a), 4, Z(38), X(a + 1), 20, Z(38), M.GLASS);
  // the platforms: a canopy over each, and the trains (the models in civilian/src, stood by src/civilians.js)
  for (const a of [30, 56]) {
    begin('Platform canopy', 'prop', true);
    box(X(a - 3), 0, Z(40), X(a + 3), 0, Z(86), M.CONC);
    for (let b = 42; b <= 84; b += 7) box(X(a), 1, Z(b), X(a), 9, Z(b), M.METAL);
    box(X(a - 4), 10, Z(40), X(a + 4), 10, Z(86), M.ROOF_G);
  }
  [[17, 'blue'], [43, 'orange'], [69, 'yellow']].forEach(([a, paint]) => vehicle('commuter', X(a), Z(64), 0, -1, { opts: { type: 'cab', paint } }));
  if (L >= 2) { for (const a of [22, 42, 62]) flagpole(X(a), Z(3), 18); lampPost(X(10), Z(6), 16); lampPost(X(75), Z(6), 16); }
}
