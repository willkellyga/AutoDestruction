// Tokyo buildings and lots: a row of tiled town houses, the narrow sign-hung buildings that stand three to a lot, a
// small shrine behind its torii, a garden of cherry trees and a piece of the container port.
// Our own designs. Drawn like the other kits: round a local origin with the front toward low z, turned by place().
import { M, set, put, box, hole, walls, begin, rnd, ri } from './world.js';
import { face, faces4, win, door, disc, gableRoof, text, textW, tree, lampPost, bench, bin, car, shelf, table, chair, ceilingLight } from './kit.js';

// ---- shared pieces --------------------------------------------------------------------------------------------------
// A cherry tree in bloom: a short trunk and a wide, low crown.
export function sakura(x, z, th = 8, r = 6) {
  begin('Cherry tree', 'tree', false);
  box(x, 0, z, x + 1, th + r - 1, z + 1, M.TRUNK);
  set(x - 1, 0, z, M.TRUNK); set(x + 2, 0, z + 1, M.TRUNK); set(x, 0, z + 2, M.TRUNK);
  const blobs = [[0, th + r, 0, r], [ri(-3, 3), th + r - 2, ri(-3, 3), r - 1], [ri(-3, 3), th + r + 1, ri(-3, 3), r - 2], [ri(-4, 4), th + r - 2, ri(-4, 4), r - 2]];
  for (const [bx, by, bz, br] of blobs) for (let dy = -br; dy <= br; dy++) for (let dz = -br; dz <= br; dz++) for (let dx = -br; dx <= br; dx++) {
    if (dx * dx + dy * dy * 2.2 + dz * dz <= br * br - rnd() * br * 1.6) put(x + bx + dx, by + dy, z + bz + dz, rnd() < 0.3 ? M.SAKURA2 : M.SAKURA);
  }
}
// A tiled hip roof with deep eaves over the rectangle x0..x1, z0..z1, from eave height y: a slab that overhangs by
// `over` with its corners turned up, then rings that step in two voxels a course (each is three wide, so it rests on
// the one below), closed by a ridge. `steep` is how tall the upper courses are; `courses` stops the roof early, for a
// tier that has another storey standing on it. Returns the height of the top.
export function hipRoof(x0, z0, x1, z1, y, over, m, ridgeM = 0, steep = 1, courses = 0) {
  const a0 = x0 - over, b0 = z0 - over, a1 = x1 + over, b1 = z1 + over;
  box(a0, y, b0, a1, y, b1, m);
  for (const [cx, cz] of [[a0, b0], [a1, b0], [a0, b1], [a1, b1]]) { set(cx, y + 1, cz, m); set(cx, y + 2, cz, ridgeM || m); }
  let yy = y + 1;
  for (let k = 1; ; k++) {
    const xa = a0 + 2 * k, za = b0 + 2 * k, xb = a1 - 2 * k, zb = b1 - 2 * k;
    if (courses && k > courses) return yy;
    if (xb - xa < 5 || zb - za < 5) {
      box(xa, yy, za, xb, yy, zb, m);
      const rm = ridgeM || m;
      if (xb - xa >= zb - za) { const zm = (za + zb) >> 1; box(xa, yy + 1, zm, xb, yy + 1, zm, rm); set(xa, yy + 2, zm, rm); set(xb, yy + 2, zm, rm); }
      else { const xm = (xa + xb) >> 1; box(xm, yy + 1, za, xm, yy + 1, zb, rm); set(xm, yy + 2, za, rm); set(xm, yy + 2, zb, rm); }
      return yy + 2;
    }
    const h = k > 2 ? steep : 1;
    for (let t = 0; t < h; t++, yy++) { box(xa, yy, za, xb, yy, za + 2, m); box(xa, yy, zb - 2, xb, yy, zb, m); box(xa, yy, za, xa + 2, yy, zb, m); box(xb - 2, yy, za, xb, yy, zb, m); }
  }
}
// A stone lantern.
export function stoneLantern(x, z) {
  begin('Stone lantern', 'prop', false);
  box(x - 1, 0, z - 1, x + 1, 0, z + 1, M.STONE); box(x, 1, z, x, 4, z, M.STONE); box(x - 1, 5, z - 1, x + 1, 5, z + 1, M.STONE);
  box(x - 1, 6, z - 1, x + 1, 7, z + 1, M.LIT); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + a, 6, z + b, x + a, 7, z + b, M.STONE);
  box(x - 2, 8, z - 2, x + 2, 8, z + 2, M.STONE); box(x - 1, 9, z - 1, x + 1, 9, z + 1, M.STONE); set(x, 10, z, M.STONE);
}
// A drinks machine on the pavement.
export function vending(x, z, m) {
  begin('Vending machine', 'prop', false);
  box(x, 0, z, x + 3, 7, z + 1, m); box(x, 2, z, x + 3, 6, z, M.LIT_W); box(x, 0, z, x + 3, 1, z, M.DARK);
  for (let a = 0; a < 4; a++) set(x + a, 4, z, [M.CAR_A, M.SIGN, M.CAR_B, M.DOOR_G][a]);
}
// A concrete utility pole with its crossarms and a transformer, which is what a Tokyo side street has instead of trees.
export function pole(x, z) {
  begin('Utility pole', 'prop', false);
  box(x, 0, z, x, 30, z, M.CONC); set(x + 1, 0, z, M.CONC); set(x - 1, 0, z, M.CONC);
  box(x - 3, 27, z, x + 3, 27, z, M.DARK); box(x - 2, 23, z, x + 2, 23, z, M.DARK);
  for (const a of [-3, -1, 1, 3]) set(x + a, 28, z, M.TRIM);
  box(x + 1, 16, z, x + 2, 20, z + 1, M.METAL); box(x, 12, z - 3, x, 12, z - 1, M.DARK); box(x - 1, 11, z - 4, x + 1, 11, z - 3, M.LIT);
}
// the usual bits on a pavement in front of a lot
function curb(lx, lz, o) {
  if (o.pole) pole(lx + 1, lz + 2); else lampPost(lx + 1, lz + 2);
  if (o.vend) vending(lx + 22, lz + 3, o.vend);
  if (o.tree === 1) sakura(lx + 35, lz - 1, 7, 4); else if (o.tree === 2) tree(lx + 36, lz - 2, 12, 4);
  if (o.car) car(lx + 6, lz - 15, o.car);
}

// ---- a row of town houses: three narrow two-storey houses of timber and plaster, each with a lattice front, a shop
// curtain over its door, a tiled pent roof between the floors and a tiled gable roof with its eaves to the street -------
// o.walls, o.cloth are per house; o.tile is the roof.
export function machiya(lx, lz, L, o = {}) {
  const wallsM = o.walls || [M.PL_W, M.TRUNK, M.REND_C], cloth = o.cloth || [M.AWN_B, M.AWN_R, M.AWN_G], tile = o.tile || M.ROOF_S;
  for (let i = 0; i < 3; i++) {
    const x0 = lx + i * 13, x1 = x0 + 12, z0 = lz + 8 + (i === 1 ? 2 : 0), z1 = lz + 33, wall = wallsM[i], G = 11, top = 21 + (o.tall === i ? 9 : 0);
    begin('Town house', 'house');
    walls(x0, 0, z0, x1, top, z1, wall);
    for (const [a, b] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box(a, 0, b, a, top, b, M.TRUNK);
    box(x0 + 1, G - 1, z0 + 1, x1 - 1, G - 1, z1 - 1, M.FLOOR); if (top > 21) box(x0 + 1, 20, z0 + 1, x1 - 1, 20, z1 - 1, M.FLOOR);
    const Ff = face('f', x0, z0, x1, z1), Fb = face('b', x0, z0, x1, z1);
    if (L >= 1) Ff.box(0, 0, 12, 0, 0, 0, M.STONE);
    // the ground floor: a sliding door behind its curtain and a window of wooden lattice
    door(Ff, 2, 4, 8, M.TRUNK, { frame: M.TRUNK, step: false });
    win(Ff, 8, 3, 3, 5, { frame: M.TRUNK, bars: false, sill: false });
    if (L >= 1) {
      for (let y = 3; y <= 7; y++) Ff.p(9, y, 0, M.TRUNK);
      for (let u = 1; u <= 6; u++) { Ff.p(u, 9, 1, cloth[i]); if (u !== 3 && u !== 4) Ff.p(u, 8, 1, cloth[i]); else Ff.p(u, 8, 1, M.TRIM); }
      // the pent roof over the ground floor
      Ff.box(0, G, 12, G, 1, 3, tile); Ff.box(0, G + 1, 12, G + 1, 1, 2, tile); Ff.box(0, G + 2, 12, G + 2, 1, 1, tile);
    }
    // upstairs: two lattice windows
    for (let s = 0; s * 9 + 21 <= top; s++) { const yb = G + 4 + s * 9; win(Ff, 2, yb, 3, 4, { frame: M.TRUNK, sill: false }); win(Ff, 8, yb, 3, 4, { frame: M.TRUNK, sill: false }); if (L >= 1) Ff.box(1, yb - 1, 11, yb - 1, 1, 1, M.TRUNK); }
    door(Fb, 2, 3, 8, M.TRUNK, { frame: M.TRUNK, step: false }); win(Fb, 7, G + 3, 3, 4, { frame: M.TRUNK });
    gableRoof(x0, z0, x1, z1, top + 1, 'x', tile, wall, 1, M.ROOF_D);
    if (L >= 3 && o.inside && i === 1) { box(x0 + 1, 0, z0 + 1, x1 - 1, 0, z1 - 1, M.FLOOR); table(x0 + 4, 1, z0 + 8, 5, 3); chair(x0 + 5, 1, z0 + 12); shelf(x0 + 1, 1, z1 - 2, 9, false, 6); ceilingLight(x0 + 6, G - 2, z0 + 10); }
    // a potted pine by the door
    if (L >= 2 && i !== 1) { begin('Potted pine', 'prop', false); box(x0 + 10, 0, z0 - 3, x0 + 11, 1, z0 - 2, M.ROOF_R); box(x0 + 10, 2, z0 - 3, x0 + 10, 4, z0 - 3, M.TRUNK); box(x0 + 9, 5, z0 - 4, x0 + 11, 5, z0 - 2, M.LEAF); box(x0 + 10, 6, z0 - 3, x0 + 11, 6, z0 - 3, M.LEAF); }
  }
  if (L >= 2) curb(lx, lz, o);
}

// ---- three narrow buildings on one lot, each a different height and colour, hung with signs: the shop at street level,
// a floor of something else on every storey above, a sign board down the front and a neon blade beside it --------------
// o.floors [a, b, c] (4 to 9), o.walls, o.signs [[word, background, letters], ...], o.awn, o.roof (a three-letter word).
const GLASSES = [M.GLASS, M.GLASS_G, M.GLASS, M.GLASS_Z];
export function zakkyo(lx, lz, L, o = {}) {
  const floors = o.floors || [5, 8, 6], wallsM = o.walls || [M.REND_C, M.CONC, M.PL_B], signs = o.signs || [['RAMEN', M.LIT_R, M.LIT_W], ['SUSHI', M.DARK, M.LIT_Y], ['CAFE', M.LIT_W, M.CAR_A]];
  const tallest = floors.indexOf(Math.max(...floors));
  for (let i = 0; i < 3; i++) {
    const x0 = lx + i * 13, x1 = x0 + 12, z0 = lz + 5 + (i & 1), z1 = lz + 35, n = floors[i], wall = wallsM[i], G = 14, top = G + (n - 1) * 11 - 1, sg = signs[i], glass = GLASSES[(i + n) & 3];
    begin(o.titles ? o.titles[i] : 'Sign building', 'apartment');
    walls(x0, 0, z0, x1, top, z1, wall);
    for (let s = 0; s < n - 1; s++) box(x0 + 1, G - 1 + s * 11, z0 + 1, x1 - 1, G - 1 + s * 11, z1 - 1, M.CONC);
    box(x0, top, z0, x1, top, z1, M.SLAB);
    const Ff = face('f', x0, z0, x1, z1), Fb = face('b', x0, z0, x1, z1), base = (s) => G + (s - 1) * 11;
    // the shop at the bottom
    Ff.box(0, 0, 12, 1, 0, 0, M.STONE);
    door(Ff, 1, 4, 10, M.DARK, { glass: true, frame: M.DARK, step: false }); win(Ff, 7, 2, 4, 8, { frame: M.DARK, sill: false, bars: false });
    if (L >= 1) { Ff.box(0, 11, 12, 12, 1, 3, o.awn ? o.awn[i] : M.AWN_R); for (let u = 0; u <= 12; u += 2) Ff.p(u, 11, 3, M.AWN_W); }
    // each floor above: a band of window from wall to wall, some lit, over a coloured panel
    for (let s = 1; s < n; s++) {
      const yb = base(s);
      for (let u = 1; u <= 11; u++) { for (let y = yb + 3; y <= yb + 8; y++) Ff.p(u, y, 0, (u * 7 + y * 3 + s * 5 + i) % 13 === 0 ? M.LIT : u === 6 ? M.DARK : glass); Ff.p(u, yb + 2, 0, M.DARK); }
      if (L >= 1 && (s + i) % 3 === 1) Ff.box(1, yb, 11, yb + 1, 1, 1, [M.LIT_Y, M.LIT_B, M.LIT_P, M.LIT_G][(s + i * 2) & 3]);
      win(Fb, 2, yb + 3, 3, 5); win(Fb, 8, yb + 3, 3, 5);
      if (L >= 1) Fb.box(5, yb + 1, 6, yb + 2, 1, 2, M.METAL);
    }
    door(Fb, 5, 3, 8, M.DARK, { step: false });
    // the sign board: the word written down the front, top to bottom, in lights
    if (L >= 1 && n >= 3) {
      let word = sg[0]; while (word.length * 6 + 1 > top - G - 2) word = word.slice(0, -1);
      const h = word.length * 6 + 1, ya = top - 2 - h, u0 = 7;
      for (let y = ya; y <= ya + h; y++) for (let u = u0; u <= u0 + 4; u++) Ff.p(u, y, 1, u === u0 || u === u0 + 4 || y === ya || y === ya + h ? M.DARK : sg[1]);
      for (let c = 0; c < word.length; c++) text(Ff, word[c], u0 + 1, ya + h - 6 - c * 6, 2, sg[2]);
      // and a blade of neon standing out from the wall beside it
      const bl = [M.LIT_R, M.LIT_Y, M.LIT_B, M.LIT_P, M.LIT_G][(i * 2 + n) % 5];
      for (let y = G + 1; y <= top - 3; y++) { Ff.p(2, y, 1, M.DARK); Ff.p(2, y, 2, ((y >> 2) & 1) ? bl : M.LIT_W); Ff.p(2, y, 3, M.DARK); }
    }
    // the roof: a parapet, the lift head, air conditioners, and a sign in lights on the tallest
    walls(x0, top + 1, z0, x1, top + 2, z1, wall);
    walls(x0 + 2, top + 1, z1 - 8, x0 + 7, top + 6, z1 - 3, wall); box(x0 + 2, top + 7, z1 - 8, x0 + 7, top + 7, z1 - 3, M.DARK);
    if (L >= 1) { box(x0 + 9, top + 1, z1 - 7, x0 + 10, top + 2, z1 - 4, M.METAL); box(x0 + 3, top + 1, z0 + 10, x0 + 5, top + 2, z0 + 11, M.METAL); }
    if (i === tallest && L >= 1) {
      const w = (o.roof || 'TV').slice(0, 3);
      box(x0 + 1, top + 1, z0 + 2, x0 + 1, top + 4, z0 + 2, M.STEEL); box(x1 - 1, top + 1, z0 + 2, x1 - 1, top + 4, z0 + 2, M.STEEL);
      box(x0, top + 4, z0 + 2, x1, top + 12, z0 + 2, M.DARK);
      text(face('f', x0, z0 + 2, x1, z0 + 2), w, (13 - textW(w)) >> 1, top + 6, 1, sg[2] === M.DARK ? M.LIT_Y : sg[2]);
      for (const a of [x0 + 3, x1 - 3]) for (let k = 0; k < 4; k++) box(a, top + 1, z0 + 3 + k, a, top + 9 - k * 2, z0 + 3 + k, M.STEEL);
    } else if (L >= 1 && n >= 5 && (i + n) % 2 === 0) { for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x0 + 6 + a * 2, top + 1, z0 + 6 + b * 2, x0 + 6 + a * 2, top + 3, z0 + 6 + b * 2, M.STEEL); for (let y = top + 4; y <= top + 9; y++) disc(x0 + 6, z0 + 6, y, 3, y === top + 4 || y === top + 9 ? M.METAL : M.CHROME); }
    if (L >= 3 && o.inside && i === 1) { box(x0 + 1, 0, z0 + 1, x1 - 1, 0, z1 - 1, M.FLOOR); shelf(x0 + 1, 1, z0 + 8, 14, true, 8); table(x1 - 5, 1, z0 + 10, 3, 3); chair(x1 - 4, 1, z0 + 14); ceilingLight(x0 + 6, G - 2, z0 + 12); }
  }
  if (L >= 2) { curb(lx, lz, o); bin(lx + 30, lz + 3); }
}

// ---- a small shrine: a red torii on the street, a gravel path between stone lanterns, and a timber hall under a
// tiled roof, with cherry trees round it ------------------------------------------------------------------------------
export function torii(cx, z, h, w, m = M.VERMIL) {
  begin('Torii gate', 'monument');
  for (const a of [cx - w, cx + w - 1]) { box(a, 0, z, a + 1, h, z + 1, m); box(a - 1, 0, z - 1, a + 2, 1, z + 2, M.DARK); }
  box(cx - w - 2, h - 5, z, cx + w + 2, h - 4, z + 1, m);
  box(cx - w - 4, h + 1, z, cx + w + 4, h + 2, z + 1, m); box(cx - w - 5, h + 3, z - 1, cx + w + 5, h + 3, z + 2, M.DARK);
  for (const a of [cx - w - 5, cx - w - 4, cx + w + 4, cx + w + 5]) box(a, h + 4, z - 1, a, h + 4, z + 2, M.DARK);
  box(cx - 1, h - 3, z, cx, h, z + 1, m);
}
export function shrine(lx, lz, L, o = {}) {
  torii(lx + 20, lz + 4, 17, 6);
  begin(o.title || 'Shrine', 'church');
  const x0 = lx + 10, x1 = lx + 29, z0 = lz + 22, z1 = lz + 35;
  box(x0 - 2, 0, z0 - 2, x1 + 2, 1, z1 + 1, M.STONE); box(lx + 17, 0, z0 - 5, lx + 22, 0, z0 - 3, M.STONE);
  walls(x0, 2, z0, x1, 12, z1, M.PL_W);
  for (let x = x0; x <= x1; x += 4) { box(x, 2, z0, x, 12, z0, M.TRUNK); box(x, 2, z1, x, 12, z1, M.TRUNK); } box(x1, 2, z0, x1, 12, z0, M.TRUNK); box(x1, 2, z1, x1, 12, z1, M.TRUNK);
  for (let z = z0; z <= z1; z += 4) { box(x0, 2, z, x0, 12, z, M.TRUNK); box(x1, 2, z, x1, 12, z, M.TRUNK); }
  hole(lx + 18, 2, z0, lx + 21, 9, z0); box(lx + 17, 10, z0, lx + 22, 10, z0, M.VERMIL);
  box(lx + 18, 2, z0 - 3, lx + 21, 4, z0 - 2, M.TRUNK); box(lx + 18, 5, z0 - 3, lx + 21, 5, z0 - 2, M.DARK);
  hipRoof(x0, z0, x1, z1, 13, 3, o.tile || M.ROOF_G, M.BRASS, 2);
  if (L >= 2) { stoneLantern(lx + 13, lz + 13); stoneLantern(lx + 26, lz + 13); sakura(lx + 4, lz + 22, 8, 5); sakura(lx + 35, lz + 12, 8, 5); bench(lx + 30, lz + 37 - 12); }
}

// ---- a garden of cherry trees: o.v 1 is the pond with its red bridge (the water is painted on the ground) -----------
export function garden(lx, lz, L, o = {}) {
  const pond = o.v === 1;
  for (let i = 0, got = []; i < 60 && got.length < (pond ? 4 : 5); i++) {
    const a = ri(5, 33), b = ri(5, 33);
    if ((pond && Math.abs(a - 20) < 15 && Math.abs(b - 20) < 12) || got.some((p) => Math.abs(p[0] - a) < 13 && Math.abs(p[1] - b) < 13)) continue;
    got.push([a, b]);
    if (o.green && got.length % 2 === 0) tree(lx + a, lz + b, ri(10, 14), ri(4, 5)); else sakura(lx + a, lz + b, ri(7, 10), ri(5, 6));
  }
  if (pond) {
    begin('Garden bridge', 'monument');
    for (let a = 8; a <= 31; a++) {
      const y = Math.round(1 + 5 * Math.sin(Math.PI * (a - 8) / 23));
      box(lx + a, Math.max(0, y - 1), lz + 18, lx + a, y, lz + 22, M.VERMIL);
      for (const b of [18, 22]) { set(lx + a, y + 3, lz + b, M.VERMIL); set(lx + a, y + 2, lz + b, M.VERMIL); if (a % 3 === 2) box(lx + a, y + 1, lz + b, lx + a, y + 2, lz + b, M.VERMIL); }
      if (a === 8 || a === 31) for (const b of [18, 22]) { box(lx + a, 0, lz + b, lx + a, 5, lz + b, M.VERMIL); set(lx + a, 6, lz + b, M.BRASS); }
    }
    for (const a of [8, 16, 23, 31]) for (const b of [18, 22]) box(lx + a, 0, lz + b, lx + a, 3, lz + b, M.VERMIL);
  } else if (o.v === 2) torii(lx + 20, lz + 6, 30, 10, M.TRUNK);
  else if (o.v === 3) {
    begin('Loyal dog statue', 'monument');
    box(lx + 17, 0, lz + 5, lx + 23, 3, lz + 11, M.GRANITE); box(lx + 18, 4, lz + 6, lx + 22, 4, lz + 10, M.STONE);
    box(lx + 19, 5, lz + 6, lx + 21, 8, lz + 10, M.IRON); box(lx + 19, 9, lz + 6, lx + 21, 11, lz + 7, M.IRON); box(lx + 19, 9, lz + 5, lx + 21, 9, lz + 5, M.IRON);
    set(lx + 19, 12, lz + 7, M.IRON); set(lx + 21, 12, lz + 7, M.IRON); box(lx + 20, 5, lz + 11, lx + 20, 8, lz + 11, M.IRON); set(lx + 20, 9, lz + 11, M.IRON);
  }
  stoneLantern(lx + 4, lz + 36); if (!pond) bench(lx + 15, lz + 34);
  lampPost(lx + 37, lz + 3, 18);
}

// ---- a piece of the container port: stacks of boxes, and with o.crane a gantry crane standing at the water's edge
// (the lot's front) with its boom out over the ships --------------------------------------------------------------------
const BOXES = [M.CAR_A, M.CAR_B, M.DOOR_G, M.SIGN, M.TRIM, M.TANK, M.ROOF_R, M.TAXI];
export function port(lx, lz, L, o = {}) {
  const stack = (x, z, n, turn) => {
    begin('Containers', 'prop', true);
    for (let k = 0; k < n; k++) {
      const m = BOXES[ri(0, BOXES.length - 1)], y = k * 6, xa = turn ? x : x, xb = turn ? x + 5 : x + 14, za = z, zb = turn ? z + 14 : z + 5;
      walls(xa, y, za, xb, y + 5, zb, m); box(xa, y + 5, za, xb, y + 5, zb, m); box(xa, y, za, xb, y, zb, m);
      if (turn) { for (let a = xa + 1; a < xb; a += 2) { box(a, y + 1, za, a, y + 4, za, M.DARK); } } else for (let b = za + 1; b < zb; b += 2) box(xa, y + 1, b, xa, y + 4, b, M.DARK);
    }
  };
  const back = o.crane ? 24 : 4;
  for (let b = back; b + 5 <= 37; b += 7) for (let a = 2; a + 14 <= 38; a += 17) if (rnd() < 0.85) stack(lx + a, lz + b, ri(1, 3), false);
  if (o.crane) {
    begin('Gantry crane', 'monument');
    const band = (y) => ((y / 9) | 0) & 1 ? M.TWR_W : M.TWR_R, T = 46;
    for (const a of [6, 32]) for (const b of [3, 18]) { for (let y = 0; y <= T; y++) box(lx + a, y, lz + b, lx + a + 1, y, lz + b + 1, band(y)); box(lx + a - 1, 0, lz + b - 1, lx + a + 2, 1, lz + b + 2, M.DARK); }
    for (const a of [6, 32]) { box(lx + a, 22, lz + 3, lx + a + 1, 23, lz + 19, M.TWR_R); box(lx + a, T - 1, lz + 3, lx + a + 1, T, lz + 19, M.TWR_R); for (let k = 0; k <= 14; k++) { box(lx + a, 23 + Math.round(k * 1.4), lz + 4 + k, lx + a, 25 + Math.round(k * 1.4), lz + 4 + k, M.TWR_W); } }
    for (const b of [3, 18]) { box(lx + 6, T - 1, lz + b, lx + 33, T, lz + b + 1, M.TWR_R); box(lx + 6, 22, lz + b, lx + 33, 23, lz + b + 1, M.TWR_R); }
    // the boom: two girders out over the water, the machinery house, the cab and a box on the hook
    for (const a of [16, 23]) { box(lx + a, T + 1, lz - 24, lx + a, T + 3, lz + 26, M.TWR_R); for (let b = -24; b <= 26; b += 5) box(lx + a, T + 1, lz + b, lx + a, T + 6, lz + b, M.TWR_W); box(lx + a, T + 6, lz - 24, lx + a, T + 6, lz + 26, M.TWR_W); }
    box(lx + 6, T + 1, lz + 3, lx + 33, T + 1, lz + 4, M.TWR_R); box(lx + 6, T + 1, lz + 18, lx + 33, T + 1, lz + 19, M.TWR_R);
    for (let b = -24; b <= 26; b += 10) box(lx + 16, T + 3, lz + b, lx + 23, T + 3, lz + b, M.TWR_R);
    walls(lx + 14, T + 4, lz + 20, lx + 25, T + 11, lz + 30, M.TRIM); box(lx + 14, T + 11, lz + 20, lx + 25, T + 11, lz + 30, M.TWR_R); box(lx + 14, T + 4, lz + 20, lx + 25, T + 4, lz + 30, M.TRIM);
    walls(lx + 17, T - 4, lz - 8, lx + 22, T, lz - 4, M.GLASS); box(lx + 17, T, lz - 8, lx + 22, T, lz - 4, M.TWR_R); box(lx + 17, T - 4, lz - 8, lx + 22, T - 4, lz - 4, M.DARK); box(lx + 19, T, lz - 6, lx + 20, T + 3, lz - 5, M.DARK); box(lx + 16, T + 3, lz - 6, lx + 23, T + 3, lz - 5, M.TWR_R);
    box(lx + 19, 26, lz - 16, lx + 20, T + 3, lz - 16, M.DARK); box(lx + 16, T + 3, lz - 16, lx + 23, T + 3, lz - 16, M.TWR_R);
    box(lx + 13, 25, lz - 18, lx + 26, 25, lz - 14, M.DARK); walls(lx + 13, 20, lz - 18, lx + 26, 24, lz - 14, M.CAR_B); box(lx + 13, 20, lz - 18, lx + 26, 20, lz - 14, M.CAR_B);
    set(lx + 16, T + 7, lz - 24, M.LIT_R); set(lx + 23, T + 7, lz - 24, M.LIT_R);
  }
  if (L >= 2) lampPost(lx + 1, lz + 38, 18);
}
