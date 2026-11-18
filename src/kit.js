// The parts buildings are made of: wall faces, windows set back behind frames, doors, pitched roofs, voxel lettering,
// furniture and street props. Everything is drawn at a quarter metre a voxel, and the detail steps up with ctx.L.
import { M, set, put, clr, get, box, fill, walls, begin, rnd, ri, ctx } from './world.js';

// A wall face of the rectangle x0..x1, z0..z1. u runs left to right as seen from outside, d is how far a voxel stands out.
export function face(side, x0, z0, x1, z1) {
  const W = (side === 'f' || side === 'b') ? x1 - x0 + 1 : z1 - z0 + 1;
  const X = side === 'f' ? (u) => x1 - u : side === 'b' ? (u) => x0 + u : side === 'l' ? (u, d) => x0 - d : (u, d) => x1 + d;
  const Z = side === 'f' ? (u, d) => z0 - d : side === 'b' ? (u, d) => z1 + d : side === 'l' ? (u) => z0 + u : (u) => z1 - u;
  const F = {
    W, side,
    p(u, y, d, m) { set(X(u, d), y, Z(u, d), m); },
    q(u, y, d, m) { put(X(u, d), y, Z(u, d), m); },
    c(u, y, d) { clr(X(u, d), y, Z(u, d)); },
    g(u, y, d) { return get(X(u, d), y, Z(u, d)); },
    box(u0, y0, u1, y1, d0, d1, m) { for (let y = y0; y <= y1; y++) for (let u = u0; u <= u1; u++) for (let d = d0; d <= d1; d++) F.p(u, y, d, m); },
    band(y0, y1, d, m) { for (let y = y0; y <= y1; y++) for (let u = -d; u <= W - 1 + d; u++) F.p(u, y, d, m); },
  };
  return F;
}
export const faces4 = (x0, z0, x1, z1) => ['f', 'r', 'b', 'l'].map((s) => face(s, x0, z0, x1, z1));

// A window opening u..u+w-1 by y..y+h-1. Level 0 is flush glass. From level 1 the glass sits one voxel back behind a
// frame, overlapping the wall all round so it stays attached, with a sill and glazing bars standing proud of it.
export function win(F, u, y, w, h, o = {}) {
  const gl = o.glass || M.GLASS, fr = o.frame === undefined ? M.TRIM : o.frame;
  if (ctx.L < 1) { F.box(u, y, u + w - 1, y + h - 1, 0, 0, gl); return; }
  for (let yy = y; yy < y + h; yy++) for (let uu = u; uu < u + w; uu++) F.c(uu, yy, 0);
  for (let yy = y - 1; yy <= y + h; yy++) for (let uu = u - 1; uu <= u + w; uu++) F.q(uu, yy, -1, gl);
  if (fr) {
    for (let uu = u - 1; uu <= u + w; uu++) { F.p(uu, y - 1, 0, fr); F.p(uu, y + h, 0, fr); }
    for (let yy = y; yy < y + h; yy++) { F.p(u - 1, yy, 0, fr); F.p(u + w, yy, 0, fr); }
  }
  const bar = o.bar || fr || M.TRIM;
  if (o.bars !== false) {
    if (w >= 5) for (let yy = y; yy < y + h; yy++) F.p(u + (w >> 1), yy, 0, bar);
    if (h >= 6) for (let uu = u; uu < u + w; uu++) F.p(uu, y + Math.round(h * 0.62), 0, bar);
  }
  if (o.sill !== false) F.box(u - 1, y - 1, u + w, y - 1, 1, 1, o.sillM || fr || M.TRIM);
  if (o.lintel) F.box(u - 1, y + h, u + w, y + h, 1, 1, o.lintel);
  if (o.shutters) { F.box(u - 2, y, u - 2, y + h - 1, 1, 1, o.shutters); F.box(u + w + 1, y, u + w + 1, y + h - 1, 1, 1, o.shutters); }
  if (o.flowers && ctx.L >= 2) {
    F.box(u - 1, y - 2, u + w, y - 2, 1, 2, M.WOOD);
    for (let uu = u - 1; uu <= u + w; uu++) F.p(uu, y - 1, 2, [M.FLOWER_R, M.LEAF2, M.FLOWER_Y, M.LEAF][(uu + y) & 3]);
  }
}

// A door at ground level, set back in a frame, with an optional glass light, a handle and a step.
export function door(F, u, w, h, m, o = {}) {
  if (ctx.L < 1) { F.box(u, 0, u + w - 1, h - 1, 0, 0, m); return; }
  const fr = o.frame || M.TRIM;
  for (let yy = 0; yy < h; yy++) for (let uu = u; uu < u + w; uu++) F.c(uu, yy, 0);
  F.box(u - 1, 0, u + w, h, -1, -1, m);
  for (let yy = 0; yy <= h; yy++) { F.p(u - 1, yy, 0, fr); F.p(u + w, yy, 0, fr); }
  for (let uu = u; uu < u + w; uu++) F.p(uu, h, 0, fr);
  if (o.light) F.box(u + 1, h - 4, u + w - 2, h - 2, -1, -1, M.GLASS);
  if (o.glass) F.box(u, 2, u + w - 1, h - 2, -1, -1, M.GLASS);
  F.p(u + w - 1, (h >> 1) - 1, 0, M.BRASS);
  if (o.step !== false) F.box(u - 1, 0, u + w, 0, 1, 2, M.STONE);
}

// A pitched roof from eave height y. axis 'x' means the ridge runs along x. Two voxels deep so every course touches
// the next face to face. The gable ends are filled with wallM.
export function gableRoof(x0, z0, x1, z1, y, axis, m, wallM, over = 1, ridgeM = 0) {
  const alongX = axis === 'x', c0 = alongX ? z0 : x0, c1 = alongX ? z1 : x1, l0 = alongX ? x0 : z0, l1 = alongX ? x1 : z1;
  const at = (l, yy, c, mm) => (alongX ? set(l, yy, c, mm) : set(c, yy, l, mm));
  let top = y;
  for (let t = -over; ; t++) {
    const a = c0 + t, b = c1 - t, h = t + over;
    if (a > b) break;
    const last = b - a <= 1;
    for (let l = l0 - over; l <= l1 + over; l++) {
      at(l, y + h, a, last && ridgeM ? ridgeM : m); at(l, y + h, b, last && ridgeM ? ridgeM : m);
      if (h > 0) { at(l, y + h - 1, a, m); at(l, y + h - 1, b, m); }
    }
    if (t >= 0 && wallM) for (let yy = y; yy <= y + h - 2; yy++) { at(l0, yy, a, wallM); at(l0, yy, b, wallM); at(l1, yy, a, wallM); at(l1, yy, b, wallM); }
    top = y + h;
  }
  return top;
}
// A stepped pyramid of hollow rings, for spires and tower caps.
export function spire(x0, z0, x1, z1, y, m, rise = 3) {
  let k = 0;
  for (; x0 + k <= x1 - k && z0 + k <= z1 - k; k++) {
    walls(x0 + k, y + k * rise, z0 + k, x1 - k, y + k * rise + rise - 1, z1 - k, m);
    box(x0 + k, y + k * rise + rise - 1, z0 + k, x1 - k, y + k * rise + rise - 1, z1 - k, m);
  }
  return y + k * rise;
}
export function disc(cx, cz, y, r, m, rin = -1) {
  for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
    const d2 = (x + 0.5) * (x + 0.5) + (z + 0.5) * (z + 0.5);
    if (d2 <= r * r && (rin < 0 || d2 >= rin * rin)) set(cx + x, y, cz + z, m);
  }
}

// ---- lettering: a 3 by 5 voxel alphabet -----------------------------------
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '111101101101101', O: '111101101101111', P: '110101110100100', Q: '111101101111001', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
};
export const textW = (str, s = 1) => (str.length * 4 - 1) * s;
export function text(F, str, u, y, d, m, s = 1) {
  for (let ci = 0; ci < str.length; ci++) {
    const g = FONT[str[ci]]; if (!g) continue;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r * 3 + c] === '1')
      for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) F.p(u + (ci * 4 + c) * s + sx, y + (4 - r) * s + sy, d, m);
  }
}

// ---- street props (each one its own body, so it falls on its own) -----------
export function tree(x, z, th = 12, r = 6) {
  begin('Tree', 'tree', false);
  box(x, 0, z, x + 1, th + r, z + 1, M.TRUNK);
  set(x - 1, 0, z, M.TRUNK); set(x + 2, 0, z + 1, M.TRUNK); set(x, 0, z + 2, M.TRUNK);
  const lm = rnd() < 0.5 ? M.LEAF : M.LEAF2, lo = lm === M.LEAF ? M.LEAF2 : M.LEAF;
  const blobs = [[0, th + r, 0, r], [ri(-3, 3), th + r - 2, ri(-3, 3), r - 1], [ri(-3, 3), th + r + 2, ri(-3, 3), r - 2]];
  for (const [bx, by, bz, br] of blobs) for (let dy = -br; dy <= br; dy++) for (let dz = -br; dz <= br; dz++) for (let dx = -br; dx <= br; dx++) {
    if (dx * dx + dy * dy * 1.5 + dz * dz <= br * br - rnd() * br * 1.6) put(x + bx + dx, by + dy, z + bz + dz, rnd() < 0.22 ? lo : lm);
  }
}
export function lampPost(x, z, h = 20) {
  begin('Street lamp', 'prop', false);
  box(x, 0, z, x, h, z, M.DARK); set(x + 1, 0, z, M.DARK); set(x - 1, 0, z, M.DARK); set(x, 0, z + 1, M.DARK); set(x, 0, z - 1, M.DARK);
  box(x, h, z - 4, x, h, z - 1, M.DARK); box(x - 1, h - 1, z - 5, x + 1, h - 1, z - 3, M.LIT); box(x - 1, h, z - 5, x + 1, h, z - 3, M.DARK);
}
export function bench(x, z) {
  begin('Bench', 'prop', false);
  for (const lx of [x, x + 7]) { box(lx, 0, z, lx, 1, z, M.DARK); box(lx, 0, z + 2, lx, 4, z + 2, M.DARK); }
  box(x, 2, z, x + 7, 2, z + 1, M.WOOD); box(x, 2, z + 2, x + 7, 2, z + 2, M.DARK); box(x, 4, z + 2, x + 7, 5, z + 2, M.WOOD);
}
export function bin(x, z) { begin('Bin', 'prop', false); box(x, 0, z, x + 1, 3, z + 1, M.DOOR_G); box(x, 4, z, x + 1, 4, z + 1, M.DARK); }
export function bollards(x, z, n, step = 4) {
  for (let i = 0; i < n; i++) { begin('Bollard', 'prop', false); box(x + i * step, 0, z, x + i * step, 2, z, M.DARK); set(x + i * step, 3, z, M.LIT_W); }
}
export function hydrant(x, z) { begin('Hydrant', 'prop', false); box(x, 0, z, x, 2, z, M.CAR_A); set(x, 3, z, M.BRASS); set(x + 1, 2, z, M.CAR_A); set(x - 1, 2, z, M.CAR_A); }
export function mailbox(x, z) { begin('Mailbox', 'prop', false); box(x, 0, z, x, 3, z, M.DARK); box(x - 1, 4, z, x + 1, 5, z + 1, M.CAR_B); set(x, 6, z, M.CAR_B); }
export function planter(x, z, w) {
  begin('Planter', 'prop', false);
  walls(x, 0, z, x + w - 1, 1, z + 2, M.STONE); box(x + 1, 0, z + 1, x + w - 2, 1, z + 1, M.WOOD);
  for (let i = 0; i < w; i++) { set(x + i, 2, z + 1, M.HEDGE); if (i & 1) set(x + i, 3, z + 1, (i & 2) ? M.FLOWER_R : M.FLOWER_Y); else if (i % 3 === 0) set(x + i, 3, z + 1, M.HEDGE); }
}
export function hedge(x0, z0, x1, z1, h = 3) { begin('Hedge', 'prop', false); for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) box(x, 0, z, x, h - (rnd() < 0.2 ? 1 : 0), z, rnd() < 0.2 ? M.LEAF : M.HEDGE); }
export function fence(x0, x1, z, gap0 = -1, gap1 = -1) {
  begin('Picket fence', 'prop', false);
  for (let x = x0; x <= x1; x++) { if (x >= gap0 && x <= gap1) continue; if (x & 1) { set(x, 1, z, M.TRIM); set(x, 3, z, M.TRIM); } else box(x, 0, z, x, 4, z, M.TRIM); }
}
export function gravestone(x, z) { begin('Gravestone', 'prop', false); box(x, 0, z, x + 2, 3, z, M.STONE); set(x + 1, 4, z, M.STONE); }
// A small hatchback, nose toward low x. It goes up if it is wrecked.
export function car(x, z, paint) {
  const b = begin('Parked car', 'prop', false); b.explosive = 5;
  for (const wx of [x + 2, x + 11]) for (const wz of [z, z + 6]) box(wx, 0, wz, wx + 2, 1, wz, M.TYRE);
  box(x, 1, z + 1, x + 15, 1, z + 5, M.DARK);
  walls(x, 2, z, x + 15, 3, z + 6, paint); box(x + 1, 3, z + 1, x + 4, 3, z + 5, paint); box(x + 13, 3, z + 1, x + 14, 3, z + 5, paint);
  box(x + 1, 2, z + 1, x + 14, 2, z + 5, M.DARK);
  walls(x + 5, 4, z, x + 12, 5, z + 6, M.GLASS);
  for (const [cx, cz] of [[x + 5, z], [x + 5, z + 6], [x + 12, z], [x + 12, z + 6], [x + 9, z], [x + 9, z + 6]]) box(cx, 4, cz, cx, 5, cz, paint);
  box(x + 5, 6, z, x + 12, 6, z + 6, paint);
  box(x + 7, 2, z + 2, x + 8, 3, z + 4, M.FURN_B); box(x + 10, 2, z + 2, x + 11, 3, z + 4, M.FURN_B); set(x + 7, 2, z + 3, M.FUEL);
  set(x, 3, z + 1, M.LIT_W); set(x, 3, z + 5, M.LIT_W); set(x + 15, 3, z + 1, M.LIT_R); set(x + 15, 3, z + 5, M.LIT_R);
  box(x, 2, z + 2, x, 2, z + 4, M.METAL);
}

// ---- insides (level 3) -----------------------------------------------------
const FREE = (x, y, z) => !get(x, y, z);
const P = (xa, ya, za, xb, yb, zb, m) => fill(xa, ya, za, xb, yb, zb, m);
export function table(x, y, z, w = 5, d = 3) { for (const [lx, lz] of [[x, z], [x + w - 1, z], [x, z + d - 1], [x + w - 1, z + d - 1]]) P(lx, y, lz, lx, y + 1, lz, M.WOOD); P(x, y + 2, z, x + w - 1, y + 2, z + d - 1, M.WOOD); }
export function chair(x, y, z, back = 1) { P(x, y, z, x + 1, y + 1, z + 1, M.FURN_B); P(x, y + 2, z + (back > 0 ? 1 : 0), x + 1, y + 3, z + (back > 0 ? 1 : 0), M.FURN_B); }
export function bed(x, y, z, m = M.FURN_A) { P(x, y, z, x + 4, y, z + 8, M.WOOD); P(x, y + 1, z, x + 4, y + 1, z + 6, m); P(x, y + 1, z + 7, x + 4, y + 1, z + 8, M.FURN_C); P(x, y + 1, z + 9, x + 4, y + 3, z + 9, M.WOOD); }
export function sofa(x, y, z, m = M.FURN_B) { P(x, y, z, x + 7, y + 1, z + 2, m); P(x, y + 2, z + 2, x + 7, y + 3, z + 2, m); P(x, y + 2, z, x, y + 2, z + 1, m); P(x + 7, y + 2, z, x + 7, y + 2, z + 1, m); }
// shelves of coloured goods along x (zdir 0) or along z (zdir 1)
export function shelf(x, y, z, len, alongZ, hgt = 7) {
  const goods = [M.FURN_A, M.SIGN, M.FURN_B, M.FURN_C, M.LEAF2, M.AWN_R, M.CAR_B, M.FLOWER_Y];
  for (let i = 0; i < len; i++) for (let h = 0; h < hgt; h++) {
    const px = alongZ ? x : x + i, pz = alongZ ? z + i : z;
    if (FREE(px, y + h, pz)) set(px, y + h, pz, (h % 3 === 0 || i === 0 || i === len - 1) ? M.WOOD : goods[(i * 3 + h * 5 + ((i * 7) >> 2)) % 8]);
  }
}
export function desk(x, y, z) { table(x, y, z, 5, 3); P(x + 2, y + 3, z + 1, x + 3, y + 4, z + 1, M.DARK); P(x + 2, y + 3, z + 1, x + 2, y + 3, z + 1, M.DARK); chair(x + 1, y, z + 4, 1); }
export function ceilingLight(x, y, z) { P(x, y, z, x + 1, y, z + 1, M.LIT); }
export function plant(x, y, z) { P(x, y, z, x, y + 1, z, M.ROOF_R); P(x, y + 2, z, x, y + 4, z, M.LEAF2); P(x - 1, y + 3, z, x + 1, y + 3, z, M.LEAF); P(x, y + 3, z - 1, x, y + 3, z + 1, M.LEAF); }
// a straight stair climbing along +z from (x, y, z), w wide, rising h, with the floor above cut open over it
export function stairs(x, y, z, w, h) {
  for (let k = 2; k < h + 3; k++) for (let xx = x; xx < x + w; xx++) clr(xx, y + h - 1, z + k);
  for (let k = 0; k < h; k++) { P(x, y + k, z + k, x + w - 1, y + k, z + k, M.WOOD); if (k > 0) P(x, y + k - 1, z + k, x + w - 1, y + k - 1, z + k, M.WOOD); }
}
// One home on one floor: two rooms either side of a partition, with a bed, a sofa, a table and lights under the slab.
export function flat(x0, z0, x1, z1, y, hh, wp, v = 0) {
  const px = ((x0 + x1) >> 1) + (v & 1 ? 2 : -2), top = y + hh - 2;
  for (let z = z0 + 1; z <= z1 - 1; z++) for (let yy = y; yy <= top; yy++) { if (z >= z0 + 5 && z <= z0 + 8 && yy < y + 8) continue; put(px, yy, z, wp); }
  if (v & 1) { bed(x0 + 2, y, z1 - 11); sofa(x1 - 10, y, z1 - 4); table(x1 - 9, y, z0 + 4); chair(x1 - 8, y, z0 + 8); }
  else { bed(x1 - 6, y, z1 - 11, M.FURN_B); sofa(x0 + 3, y, z1 - 4, M.FURN_A); table(x0 + 4, y, z0 + 4); chair(x0 + 5, y, z0 + 8); }
  shelf(px + (v & 1 ? 1 : -1), y, z1 - 8, 6, true, 6);
  plant(v & 1 ? x1 - 2 : x0 + 2, y, z0 + 2);
  ceilingLight(((x0 + px) >> 1), top, (z0 + z1) >> 1); ceilingLight(((x1 + px) >> 1), top, (z0 + z1) >> 1);
}
