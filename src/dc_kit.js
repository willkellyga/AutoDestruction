// Washington buildings and lots: the pale federal office blocks with their piers and tiled roofs, downtown's stone and
// glass office buildings (all much of a height), a grove of elms, and a small temple-fronted public building.
// Our own designs. Drawn like the other kits: round a local origin with the front toward low z, turned by place().
import { M, set, put, box, hole, walls, begin, rnd, ri } from './world.js';
import { face, faces4, win, door, text, textW, tree, lampPost, bench, bin, car, desk, shelf, chair, ceilingLight } from './kit.js';
import { dome } from './cairo_kit.js';

// ---- shared pieces --------------------------------------------------------------------------------------------------
// The flag on a pole: red and white stripes, a blue corner. It flies toward high x.
export function usflag(x, y0, z, h, pole = M.METAL) {
  box(x, y0, z, x, y0 + h, z, pole);
  for (let r = 0; r < 5; r++) for (let c = 1; c <= 7; c++) set(x + c, y0 + h - r, z, c <= 3 && r < 3 ? M.DOOR_B : r & 1 ? M.AWN_W : M.AWN_R);
}
export function flagpole(x, z, h = 16) { begin('Flag', 'prop', false); box(x - 1, 0, z - 1, x + 1, 0, z + 1, M.GRANITE); usflag(x, 0, z, h); }
// A low triangle of stone over a porch: x0..x1 wide, z0..z1 deep, from height y, one course up for every `run` in.
export function pediment(x0, x1, y, z0, z1, m, run = 2) {
  let k = 0;
  for (; x0 + k * run <= x1 - k * run; k++) box(x0 + k * run, y + k, z0, x1 - k * run, y + k, z1, m);
  return y + k - 1;
}
// A round-headed opening cut through a wall face: u..u+w-1 wide, h tall to the crown.
export function arch(F, u, w, h, y0 = 0, d0 = 0, d1 = 0, fan = 0) {
  const half = w / 2;
  for (let y = y0; y < y0 + h; y++) for (let uu = u; uu < u + w; uu++) {
    const k = y - (y0 + h - half), off = uu - u - half + 0.5;
    if (k > 0 && off * off + k * k > half * half) continue;
    if (fan && k > 0) { F.box(uu, y, uu, y, d1, d1, fan); continue; }   // a glazed fanlight in the round head
    for (let d = d0; d >= d1; d--) F.c(uu, y, d);
  }
}
// An American elm, the tree of the Mall: a stout trunk with a flared foot, four limbs that lean outward as they climb
// (the vase shape), and a wide, domed crown made of a broad middle and four or five lobes, flat underneath so the limbs
// show, darker below and lighter on top. `th` is the clear trunk, `R` the crown's reach. Every leaf touches its
// neighbour inward (the edge is roughened by less than one voxel's step), so nothing hangs loose.
export function elm(x, z, th = 9, R = 8) {
  begin('Elm tree', 'tree', false);
  const T = M.TRUNK, top = th + Math.round(R * 0.6), rv = Math.max(4.5, R * 0.8);
  box(x, 0, z, x + 1, th, z + 1, T); box(x, th + 1, z, x, top + 1, z, T);
  for (const [a, b] of [[-1, 0], [-1, 1], [2, 0], [2, 1], [0, -1], [1, -1], [0, 2], [1, 2]]) box(x + a, 0, z + b, x + a, rnd() < 0.5 ? 1 : 0, z + b, T);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    let a = sx < 0 ? x : x + 1, b = sz < 0 ? z : z + 1;
    for (let y = th - 1; y <= top; y++) {
      if (y > th - 1 && (y - th) % 2 === 0) { if (rnd() < 0.5) a += sx; else b += sz; set(a, y - 1, b, T); }
      set(a, y, b, T);
    }
  }
  const dark = rnd() < 0.5, lobes = [[0, 0, 0, R, rv]], n = ri(4, 5), a0 = rnd() * 6.28;
  for (let i = 0; i < n; i++) { const an = a0 + i * 6.28 / n + (rnd() - 0.5) * 0.6, d = R * (0.42 + rnd() * 0.16), r = R * (0.56 + rnd() * 0.14); lobes.push([Math.round(d * Math.cos(an)), ri(-1, 2), Math.round(d * Math.sin(an)), r, r * 0.82]); }
  lobes.push([ri(-2, 2), Math.round(rv * 0.5), ri(-2, 2), R * 0.55, R * 0.5]);
  for (const [bx, by, bz, rh, rw] of lobes) {
    const H = Math.ceil(rh), V = Math.ceil(rw), floor = -Math.round(rw * 0.5);
    for (let dy = floor; dy <= V; dy++) for (let dz = -H; dz <= H; dz++) for (let dx = -H; dx <= H; dx++) {
      if ((dx * dx + dz * dz) / (rh * rh) + dy * dy / (rw * rw) > 1 - rnd() * 0.11) continue;
      const k = (by + dy) / rv + (rnd() - 0.5) * 0.7;   // how high in the crown: sunlit on top, shaded underneath
      put(x + bx + dx, top + by + dy, z + bz + dz, k > 0.45 ? M.LEAF2 : k < -0.25 ? M.HEDGE : dark ? (rnd() < 0.25 ? M.HEDGE : M.LEAF) : (rnd() < 0.3 ? M.LEAF2 : M.LEAF));
    }
  }
}
// A rider on a horse, in bronze, on a stone block. It looks toward low z.
export function rider(x, z, title = 'Statue') {
  begin(title, 'monument');
  box(x - 2, 0, z - 4, x + 2, 4, z + 4, M.GRANITE); box(x - 3, 0, z - 5, x + 3, 0, z + 5, M.LIME2);
  const B = M.IRON;
  for (const [a, b] of [[-1, -3], [1, -3], [-1, 3], [1, 3]]) box(x + a, 5, z + b, x + a, 7, z + b, B);
  box(x - 1, 8, z - 3, x + 1, 10, z + 3, B); box(x, 11, z - 4, x, 12, z - 3, B); box(x, 12, z - 5, x, 13, z - 5, B); set(x, 9, z + 4, B); set(x, 8, z + 4, B);
  box(x, 11, z - 1, x, 14, z, B); set(x, 15, z, B); set(x - 1, 13, z - 1, B); set(x + 1, 13, z - 1, B); box(x + 1, 14, z - 1, x + 1, 16, z - 1, M.BRASS);
}

// ---- a federal office block: a rusticated ground floor, then piers the height of the building with a window to every
// storey between them, a cornice, and a low tiled roof behind a parapet. o.porch gives it four columns and a pediment
// over the door; o.flag flies one from the roof. ---------------------------------------------------------------------
export function fedblock(lx, lz, L, o = {}) {
  const x0 = lx + 2, x1 = lx + 37, z0 = lz + 7, z1 = lz + 36, W = o.wall || M.LIME, n = o.floors || 4, FH = 11, top = n * FH - 1, R = o.roof || M.ROOF_R, T = W === M.MARBLE ? M.LIME : M.TRIM;
  begin(o.title || 'Federal building', 'apartment');
  walls(x0, 0, z0, x1, top, z1, W);
  for (let s = 1; s < n; s++) box(x0 + 1, s * FH - 1, z0 + 1, x1 - 1, s * FH - 1, z1 - 1, M.CONC);
  box(x0, top, z0, x1, top, z1, M.SLAB);
  const F4 = faces4(x0, z0, x1, z1), Ff = F4[0];
  for (const F of F4) {
    if (L >= 1) for (let y = 2; y < FH - 1; y += 3) F.box(0, y, F.W - 1, y, 0, 0, W === M.GRANITE ? M.LIME2 : M.GRANITE);
    for (let u = 2; u + 3 < F.W; u += 6) for (let s = 0; s < n; s++) {
      if (F === Ff && s === 0 && u > 12 && u < 22) continue;   // the door
      win(F, u, s * FH + (s ? 2 : 3), 3, s ? 6 : 5, { frame: s ? T : 0, sill: s > 0, bars: false });
    }
    if (L >= 1) {
      for (let u = 0; u < F.W; u += 6) F.box(u, FH, u, top - 1, 1, 1, W);
      F.box(F.W - 1, FH, F.W - 1, top - 1, 1, 1, W);
      F.band(FH - 1, FH - 1, 1, T); F.band(top, top, 1, T); F.band(top - 1, top - 1, 1, W);
    }
  }
  walls(x0, top + 1, z0, x1, top + 2, z1, W);
  // the roof: tiled courses stepping in, closed by a flat top
  for (let k = 0; k < 4; k++) { const a = 2 + 2 * k; for (let t = 0; t < 3; t++) walls(x0 + a + t, top + 1 + k, z0 + a + t, x1 - a - t, top + 1 + k, z1 - a - t, R); }
  box(x0 + 10, top + 4, z0 + 10, x1 - 10, top + 4, z1 - 10, R);
  door(Ff, 16, 4, 9, M.DARK, { glass: true, frame: M.BRASS });
  if (o.porch) {
    const H = Math.min(top - 8, 2 * FH + 8);
    Ff.box(9, 0, 26, 1, 1, 7, M.GRANITE); Ff.box(11, 0, 24, 0, 8, 9, M.GRANITE);
    for (const u of [10, 14, 20, 24]) Ff.box(u, 2, u + 1, H, 5, 6, T);
    Ff.box(9, H + 1, 26, H + 3, 1, 7, T);
    for (let k = 0; k < 5; k++) Ff.box(9 + 2 * k, H + 4 + k, 26 - 2 * k, H + 4 + k, 1, 7, k ? W : T);
  }
  if (o.flag) usflag(x0 + 17, top + 5, z0 + 14, 12);
  if (L >= 3) {
    box(x0 + 1, 0, z0 + 1, x1 - 1, 0, z1 - 1, M.FLOOR);
    for (let s = 0; s < n; s++) { const y = s ? s * FH : 1; desk(x0 + 4, y, z0 + 5); desk(x0 + 24, y, z0 + 5); desk(x0 + 14, y, z0 + 18); shelf(x0 + 3, y, z1 - 3, 12, false); ceilingLight(x0 + 10, y + FH - 2 - (s ? 0 : 1), z0 + 10); ceilingLight(x0 + 24, y + FH - 2 - (s ? 0 : 1), z0 + 20); }
  }
  if (L >= 2) { lampPost(lx + 1, lz + 3); tree(lx + 35, lz - 2, 12, 4); if (!o.porch) { bench(lx + 6, lz + 3); bin(lx + 30, lz + 4); } if (o.car) car(lx + 6, lz - 15, o.car); }
}

// ---- a downtown office building: stone piers and floor bands with glass between, shops under an awning at street
// level with the building's name over the door, and a flat roof with its plant. Six to eight storeys: the city's
// height rule keeps them all much the same. -------------------------------------------------------------------------
export function dcoffice(lx, lz, L, o = {}) {
  const x0 = lx + 3, x1 = lx + 36, z0 = lz + 7, z1 = lz + 36, W = o.wall || M.LIME, n = o.floors || 7, G = 13, FH = 11, top = G + (n - 1) * FH - 1, glass = o.glass || M.GLASS, name = o.name || 'UNION';
  begin(o.title || 'Office building', 'tower');
  const F4 = faces4(x0, z0, x1, z1), Ff = F4[0], base = (s) => (s ? G + (s - 1) * FH : 0);
  for (const F of F4) for (let s = 0; s < n; s++) {
    const yb = base(s), hh = s ? FH : G;
    for (let u = 0; u < F.W; u++) {
      const pier = u % 5 === 0 || u === F.W - 1;
      for (let r = 0; r < hh; r++) F.p(u, yb + r, 0, pier || r >= hh - 2 || r < 2 ? W : glass);
    }
  }
  for (let s = 0; s < n; s++) box(x0 + 1, base(s) + (s ? FH : G) - 1, z0 + 1, x1 - 1, base(s) + (s ? FH : G) - 1, z1 - 1, M.CONC);
  box(x0, top, z0, x1, top, z1, M.SLAB);
  // four columns inside carry the floors
  for (const [a, b] of [[11, 10], [22, 10], [11, 20], [22, 20]]) box(x0 + a, 0, z0 + b, x0 + a, top - 1, z0 + b, M.TRIM);
  walls(x0, top + 1, z0, x1, top + 3, z1, W);
  if (L >= 1) {
    for (const F of F4) { F.band(top + 3, top + 3, 1, M.TRIM); F.band(G - 1, G - 1, 1, M.TRIM); for (let u = 0; u < F.W; u += 5) F.box(u, G, u, top, 1, 1, W); F.box(F.W - 1, G, F.W - 1, top, 1, 1, W); }
    Ff.box(2, G - 8, 31, G - 2, 1, 1, M.DARK); text(Ff, name, (34 - textW(name)) >> 1, G - 7, 2, o.ink || M.LIT_W);
    for (let u = 3; u <= 30; u++) if (u < 13 || u > 20) for (let d = 1; d <= 3; d++) Ff.p(u, G - 9, d, ((u >> 1) & 1) ? (o.awn || M.AWN_B) : M.AWN_W);
  }
  door(Ff, 14, 6, 9, M.DARK, { glass: true, frame: M.STEEL });
  // roof plant
  walls(x0 + 20, top + 1, z0 + 16, x0 + 29, top + 6, z0 + 25, M.CONC); box(x0 + 20, top + 7, z0 + 16, x0 + 29, top + 7, z0 + 25, M.METAL);
  box(x0 + 6, top + 1, z0 + 6, x0 + 11, top + 3, z0 + 10, M.METAL); box(x0 + 7, top + 4, z0 + 7, x0 + 10, top + 4, z0 + 9, M.DARK);
  if (L >= 3) {
    box(x0 + 1, 0, z0 + 1, x1 - 1, 0, z1 - 1, M.FLOOR);
    for (let s = 1; s < n; s++) { const y = base(s); desk(x0 + 4, y, z0 + 4); desk(x0 + 14, y, z0 + 4); desk(x0 + 25, y, z0 + 14); chair(x0 + 5, y, z0 + 22); ceilingLight(x0 + 16, y + FH - 2, z0 + 14); }
  }
  if (L >= 2) { lampPost(lx + 1, lz + 3); tree(lx + 36, lz - 2, 11, 4); bin(lx + 9, lz + 4); if (o.car) car(lx + 6, lz - 15, o.car); }
}

// ---- a grove: the elms of the Mall and the public gardens. o.v 1 is a square with a statue in the middle. -------------
export function dcgrove(lx, lz, L, o = {}) {
  if (o.v === 1) {
    for (const [a, b] of [[5, 5], [34, 5], [5, 34], [34, 34]]) elm(lx + a, lz + b, ri(8, 10), 6);
    rider(lx + 20, lz + 20, 'Square statue');
    bench(lx + 12, lz + 30); bench(lx + 24, lz + 30); lampPost(lx + 3, lz + 19, 18); lampPost(lx + 36, lz + 20, 18);
    begin('Flower bed', 'prop', false);
    for (const b of [10, 28]) for (let a = 14; a <= 25; a++) { set(lx + a, 0, lz + b, M.DIRT); set(lx + a, 1, lz + b, a & 1 ? M.FLOWER_R : M.FLOWER_Y); }
    return;
  }
  for (let i = 0, got = []; i < 80 && got.length < 5; i++) {
    const a = ri(6, 33), b = ri(6, 33);
    if (got.some((p) => Math.hypot(p[0] - a, p[1] - b) < 14) || (a >= 13 && a <= 25 && b >= 16 && b <= 23)) continue;   // not through the bench
    got.push([a, b]); elm(lx + a, lz + b, ri(8, 11), ri(6, 8));
  }
  bench(lx + 16, lz + 19); if (rnd() < 0.5) lampPost(lx + 20, lz + 2, 18);
}

// ---- a temple-fronted public building: broad steps, six columns under a pediment and a marble hall behind them.
// o.dome crowns it with a copper dome and a torch (the library); otherwise the roof is a long gable (the court). -------
export function temple(lx, lz, L, o = {}) {
  const W = o.wall || M.MARBLE, X = (a) => lx + a, Z = (b) => lz + b, T = M.TRIM, top = 27;
  begin(o.title || 'Court house', 'landmark');
  walls(X(4), 0, Z(15), X(35), top, Z(37), W); box(X(4), top, Z(15), X(35), top, Z(37), M.SLAB); box(X(5), 4, Z(16), X(34), 4, Z(36), M.FLOOR);
  // the podium and the steps up to it
  box(X(3), 0, Z(9), X(36), 3, Z(14), W);
  for (let k = 1; k <= 3; k++) box(X(8), 0, Z(9 - 2 * k), X(31), 3 - k, Z(10 - 2 * k), W);
  for (const a of [5, 33]) box(X(a), 0, Z(4), X(a + 1), 5, Z(8), W);
  // the columns, the beam over them and the pediment
  for (let i = 0; i < 6; i++) box(X(4 + i * 6), 4, Z(10), X(5 + i * 6), 23, Z(11), T);
  box(X(3), 24, Z(9), X(36), top, Z(14), W);
  const pt = pediment(X(3), X(36), top + 1, Z(9), Z(15), W, 2);
  if (L >= 1) { box(X(3), top, Z(8), X(36), top, Z(8), T); for (let a = 9; a <= 30; a += 3) set(X(a), top + 2, Z(8), M.LIME2); set(X(19), top + 5, Z(8), M.BRASS); set(X(20), top + 5, Z(8), M.BRASS); }
  const Ff = face('f', X(4), Z(15), X(35), Z(37));
  door(Ff, 13, 6, 16, M.BRASS, { frame: T, step: false });
  for (const F of faces4(X(4), Z(15), X(35), Z(37))) if (F !== Ff) for (let u = 3; u + 2 < F.W; u += 5) { win(F, u, 8, 2, 7, { frame: T }); if (L >= 1) F.box(u - 1, 17, u + 2, 17, 1, 1, T); }
  if (o.dome) {
    walls(X(11), top + 1, Z(18), X(28), top + 5, Z(35), W); box(X(11), top + 6, Z(18), X(28), top + 6, Z(35), M.SLAB);
    const dt = dome(X(20), Z(27), top + 7, 8, o.dome, { sq: 0.9 });
    box(X(19), dt, Z(26), X(21), dt + 2, Z(28), W); box(X(20), dt + 3, Z(27), X(20), dt + 4, Z(27), M.BRASS); set(X(20), dt + 5, Z(27), M.LIT_Y);
    if (L >= 3) for (const a of [6, 12, 24, 30]) shelf(X(a), 5, Z(22), 12, true, 9);
  } else {
    // a low gable the length of the hall, behind the pediment
    for (let k = 0; 5 + 2 * k <= 34 - 2 * k; k++) { box(X(5 + 2 * k), top + 1 + k, Z(16), X(34 - 2 * k), top + 1 + k, Z(36), k ? M.ZINC : W); }
    if (L >= 3) { box(X(10), 5, Z(31), X(29), 6, Z(33), M.TRUNK); for (let i = 0; i < 9; i++) box(X(11 + i * 2), 5, Z(35), X(11 + i * 2), 8, Z(35), M.DARK); }
  }
  if (L >= 2) { lampPost(X(1), Z(2), 18); lampPost(X(38), Z(3), 18); flagpole(X(2), Z(12), 18); }
  return pt;
}
