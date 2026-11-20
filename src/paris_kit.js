// Paris buildings and lots: the Haussmann apartment block, a lawn with rows of trees, and a small paved square.
// Our own designs. Drawn like the other kits: round a local origin with the front toward low z, turned by place().
import { M, set, put, box, hole, walls, begin, rnd, ri } from './world.js';
import { face, faces4, win, door, disc, text, textW, tree, lampPost, bench, bin, planter, car, table, chair, shelf, ceilingLight, stairs, flat } from './kit.js';

// ---- a Haussmann block: cut stone, a shop under an awning, tall windows, iron balconies on the second and top floors,
// a zinc mansard with dormers, and chimney stacks with rows of pots along the party walls ------------------------------
// o.floors: storeys below the roof, 3 to 6 (kept low so the monuments stand over the roofs). o.wall, o.front (the shopfront's paint), o.awn, o.name and o.title (the shop).
// Paris blocks are close-knit: o.jl, o.jr and o.jb say the left side, the right side or the back stands against the
// next building (paris.js works that out). A joined wall is pushed out to meet its neighbour (4 voxels at a side, 7 at
// the back), is left blank, and the roof runs up to it as a party wall instead of sloping away.
// PIERS: the spacing of the load-bearing piers inside a Haussmann block, 0 for none (see below)
export const PIERS = 9, PIER_M = M.STEEL;
export function haussmann(lx, lz, L, o = {}) {
  const jl = !!o.jl, jr = !!o.jr, jb = !!o.jb;
  const x0 = lx + (jl ? -3 : 1), x1 = lx + (jr ? 42 : 38), z0 = lz + 6, z1 = lz + (jb ? 42 : 35), n = o.floors || 6, G = 16, top = G + (n - 1) * 12 - 1;
  const wall = o.wall || M.LIME, front = o.front || M.DOOR_G, awn = o.awn || M.AWN_R, name = o.name || 'CAFE', roof = o.roof || M.ZINC;
  begin(o.title || 'Apartment block', 'apartment');
  walls(x0, 0, z0, x1, top, z1, wall);
  for (let s = 0; s < n - 1; s++) box(x0 + 1, G - 1 + s * 12, z0 + 1, x1 - 1, G - 1 + s * 12, z1 - 1, M.CONC);
  box(x0, top, z0, x1, top, z1, M.SLAB);
  // load-bearing piers inside, floor to roof (2026-11-20, Will chose "Toughen Paris's buildings"): Paris blocks fell
  // whole as soon as a monster bit along the street front, so most of the city came down after the bite rather than in
  // it. The piers carry each storey when the front is gone, so a bitten block stands longer and falls in smaller parts.
  if (PIERS) for (let px = x0 + 7; px <= x1 - 8; px += PIERS) for (const pz of [z0 + Math.round((z1 - z0) / 3), z0 + Math.round((z1 - z0) * 2 / 3)]) box(px, 0, pz, px + 1, top - 1, pz + 1, PIER_M);
  const [Ff, Fr, Fb, Fl] = faces4(x0, z0, x1, z1), W = Ff.W, nb = Math.floor((W - 2) / 6), bays = Array.from({ length: nb }, (_, i) => ((W - nb * 6 + 2) >> 1) + i * 6);
  const open = [Ff, ...(jr ? [] : [Fr]), ...(jb ? [] : [Fb]), ...(jl ? [] : [Fl])];   // the faces that are not against a neighbour
  if (L >= 1) for (const F of open) { F.box(0, 0, F.W - 1, 1, 0, 0, M.STONE); F.band(G - 1, G - 1, 1, M.TRIM); F.band(top, top, 1, M.TRIM); F.band(top - 1, top - 1, 1, wall); }
  if (L >= 1) Ff.band(top, top, 2, M.TRIM);
  // upper floors: six tall windows a floor, a balcony the width of the front on the second and the top floor
  for (let s = 1; s < n; s++) {
    const yb = G + (s - 1) * 12, long = L >= 1 && (s === 2 || s === n - 1);
    for (const u of bays) {
      win(Ff, u, yb + (long ? 1 : 2), 4, long ? 9 : 8, { sill: !long, lintel: L >= 1 && s === 2 ? M.TRIM : 0 });
      if (L >= 1 && !long) for (let uu = u - 1; uu <= u + 4; uu++) { Ff.p(uu, yb + 4, 1, M.DARK); if ((uu - u) % 3 === 0) Ff.p(uu, yb + 3, 1, M.DARK); }   // a guard rail, held by the frame at each end
    }
    if (long) {
      Ff.box(0, yb - 1, W - 1, yb - 1, 1, 2, M.SLAB);
      for (let u = 0; u < W; u++) { Ff.p(u, yb + 3, 2, M.DARK); if (!(u & 1)) Ff.box(u, yb, u, yb + 2, 2, 2, M.DARK); }
      for (const u of [0, W - 1]) { Ff.p(u, yb + 3, 1, M.DARK); Ff.box(u, yb, u, yb + 2, 1, 1, M.DARK); }
      if (L >= 2) for (const u of [5, 17, 29]) { Ff.p(u + 1, yb, 1, M.ROOF_R); Ff.p(u + 1, yb + 1, 1, (u + s) & 1 ? M.FLOWER_R : M.LEAF2); }
    } else if (L >= 1) Ff.box(0, yb - 1, W - 1, yb - 1, 1, 1, M.TRIM);
    if (!jb) for (let u = 6; u + 4 <= W - 5; u += 7) win(Fb, u, yb + 3, 4, 6);
    for (const F of [Fr, Fl]) if (open.includes(F)) for (let u = 6; u + 4 <= F.W - 5; u += 7) win(F, u, yb + 3, 4, 6);
  }
  // ground floor: the street door at one end, the shop across the rest
  const sR = W - 2, ww = W >= 42 ? 11 : 9, w2 = sR - 1 - ww, du = ((10 + ww + w2) >> 1) - 1;   // the shop's right end, its two windows and the door between
  door(Ff, 2, 4, 11, o.door || M.DOOR_B, { light: true });
  Ff.box(8, 0, sR, 1, 0, 0, front);
  win(Ff, 10, 2, ww, 7, { frame: front, sill: false }); win(Ff, w2, 2, ww, 7, { frame: front, sill: false });
  door(Ff, du, 3, 9, front, { glass: true, frame: front });
  Ff.box(8, 10, sR, 14, 0, 0, front);
  if (!jb) { door(Fb, 6, 4, 9, M.DARK, { step: false }); win(Fb, 16, 3, 5, 6); win(Fb, 28, 3, 5, 6); }
  if (L >= 2) {
    text(Ff, name, 9 + ((sR - 9 - textW(name)) >> 1), 10, 1, o.ink || M.BRASS);
    for (let u = 9; u <= sR - 1; u++) { if (u >= du - 1 && u <= du + 3) continue; const m = ((u >> 1) & 1) ? awn : M.AWN_W; for (let d = 1; d <= 5; d++) { const y = 9 - ((d - 1) >> 1); Ff.p(u, y, d, m); if (d > 1 && (d & 1)) Ff.p(u, y + 1, d, m); } Ff.p(u, 6, 5, m); }
    Ff.p(1, 9, 1, M.LIT); Ff.p(6, 9, 1, M.LIT);
    if (!jl) for (let y = 0; y <= top; y++) Fl.p(2, y, 1, M.METAL);
  }
  // the mansard: steep zinc, two voxels deep so each course stands on the one below, a dormer over every bay
  // a slate roof is capped in zinc, as the old ones are. Against a neighbour the roof stops at a party wall.
  const R = 6, cap = roof === M.ZINC ? roof : M.ZINC, L_ = (j) => (jl ? 0 : j), R_ = (j) => (jr ? 0 : j), B_ = (j) => (jb ? 0 : j);
  for (let k = 0; k < R; k++) for (const j of [k, k + 1]) walls(x0 + L_(j), top + 1 + 2 * k, z0 + j, x1 - R_(j), top + 2 + 2 * k, z1 - B_(j), k >= R - 2 ? cap : roof);
  box(x0 + L_(R), top + 2 * R + 1, z0 + R, x1 - R_(R), top + 2 * R + 1, z1 - B_(R), cap);
  for (let k = 0; k < R; k++) {
    const ya = top + 1 + 2 * k, yb = ya + 1;
    if (jl) box(x0, ya, z0 + k, x0, yb, z1 - B_(k), wall);
    if (jr) box(x1, ya, z0 + k, x1, yb, z1 - B_(k), wall);
    if (jb) box(x0 + L_(k), ya, z1, x1 - R_(k), yb, z1, wall);
  }
  if (L >= 1) {
    for (const u of bays) {
      Ff.box(u, top + 1, u + 3, top + 8, 0, 0, M.TRIM); Ff.box(u + 1, top + 3, u + 2, top + 7, 0, 0, M.GLASS);
      for (let d = 0; d <= 4; d++) { Ff.p(u, top + 9, -d, roof); Ff.p(u + 3, top + 9, -d, roof); Ff.q(u + 1, top + 9, -d, roof); Ff.q(u + 2, top + 9, -d, roof); }
      for (let y = top + 3; y <= top + 8; y++) for (let d = 1; d <= 3; d++) { Ff.q(u, y, -d, roof); Ff.q(u + 3, y, -d, roof); }
    }
    if (!jb) for (const u of [5, 17, 29]) { Fb.box(u, top + 1, u + 3, top + 7, 0, 0, M.TRIM); Fb.box(u + 1, top + 3, u + 2, top + 6, 0, 0, M.GLASS); }
  }
  // chimney stacks: a thin wall across the roof at each end and one between, capped and topped with clay pots
  const ct = top + 2 * R + 3;
  for (const cx of [x0 + 1, x0 + (W >> 1), x1 - 2]) {
    box(cx, top + 1, z0 + 8, cx + 1, ct, z1 - 8, wall); box(cx, ct + 1, z0 + 8, cx + 1, ct + 1, z1 - 8, M.TRIM);
    if (L >= 1) for (let z = z0 + 9; z <= z1 - 9; z += 2) { set(cx, ct + 2, z, M.ROOF_R); set(cx + 1, ct + 2, z + 1 <= z1 - 9 ? z + 1 : z, M.ROOF_R); }
  }
  if (L >= 3 && o.inside !== false) {
    box(x0 + 1, 0, z0 + 1, x1 - 1, 0, z1 - 1, M.FLOOR);
    // the shop: a counter, shelves along the back wall and a few tables
    box(x0 + 9, 1, z0 + 12, x0 + 22, 3, z0 + 13, M.WOOD); box(x0 + 9, 4, z0 + 12, x0 + 22, 4, z0 + 13, M.TRIM);
    shelf(x0 + 9, 1, z1 - 2, 22, false, 9);
    for (const [a, b] of [[10, 3], [17, 3], [25, 4]]) { table(x1 - a - 3, 1, z0 + b, 3, 3); chair(x1 - a + 1, 1, z0 + b, 1); }
    for (const a of [8, 20, 30]) ceilingLight(x0 + a, G - 2, z0 + 8);
    box(x0 + 6, 1, z0 + 1, x0 + 6, G - 2, z1 - 1, M.WP_C); hole(x0 + 6, 1, z0 + 16, x0 + 6, 8, z0 + 19);
    for (let s = 0; s < n; s++) {
      const y = s ? G + (s - 1) * 12 : 1, hh = s ? 12 : G - 1;
      if (s < n - 1) stairs(x0 + 2, y, z0 + 3, 3, hh);
      if (s) flat(x0 + 5, z0, x1, z1, y, hh, [M.WP_A, M.WP_B, M.WP_C][s % 3], s);
    }
  }
  if (L >= 2) {
    lampPost(lx + 1, lz + 2); tree(lx + 36, lz - 2, 13, 5);
    if (o.terrace) { begin('Cafe tables', 'prop', false); for (const a of [10, 17, 28]) { table(lx + a, 0, lz + 1, 3, 3); chair(lx + a - 3, 0, lz + 1, 1); chair(lx + a + 4, 0, lz + 2, 0); } }
    else { bin(lx + 8, lz + 3); planter(lx + 24, lz + 2, 9); }
    if (o.car) car(lx + 6, lz - 15, o.car);
  }
}

// ---- a lawn: the long grass of the esplanade and the Champ de Mars, with clipped trees down each side ------------------
// o.cannons puts a row of old cannons along the front. The grass and the gravel walks are painted on the ground.
export function lawn(lx, lz, L, o = {}) {
  for (const a of [3, 35]) for (let b = 4; b < 40; b += 11) tree(lx + a, lz + b, 10, 4);
  lampPost(lx + 8, lz + 1, 18); lampPost(lx + 31, lz + 38, 18);
  bench(lx + 7, lz + 19); bench(lx + 25, lz + 19);
  if (o.cannons) for (const a of [8, 16, 24, 32]) {
    begin('Cannon', 'prop', false);
    box(lx + a, 0, lz + 5, lx + a, 1, lz + 7, M.WOOD); box(lx + a + 2, 0, lz + 5, lx + a + 2, 1, lz + 7, M.WOOD); box(lx + a + 1, 1, lz + 5, lx + a + 1, 1, lz + 7, M.DARK);
    box(lx + a + 1, 2, lz + 2, lx + a + 1, 2, lz + 8, M.ROOF_G); set(lx + a + 1, 3, lz + 8, M.ROOF_G); set(lx + a + 1, 2, lz + 1, M.DARK);
  }
  if (o.beds) for (const [a, b] of [[12, 8], [12, 28]]) planter(lx + a, lz + b, 15);
}

// ---- a small paved square: plane trees, benches, a poster column and a news kiosk --------------------------------------
export function place(lx, lz, L, o = {}) {
  for (const [a, b] of [[5, 6], [33, 6], [5, 32], [33, 32]]) tree(lx + a, lz + b, 13, 5);
  // the poster column: a green drum under a little dome, pasted with posters
  begin('Poster column', 'prop', true);
  const px = lx + 12, pz = lz + 20;
  for (let y = 0; y <= 13; y++) disc(px, pz, y, 2, y < 2 || y > 11 ? M.DOOR_G : [M.AWN_W, M.SIGN, M.AWN_B, M.AWN_R][(y >> 2) & 3]);
  disc(px, pz, 14, 3, M.DOOR_G); disc(px, pz, 15, 2, M.DOOR_G); box(px - 1, 16, pz - 1, px, 17, pz, M.DOOR_G); set(px - 1, 18, pz - 1, M.BRASS);
  // the kiosk: a green cabin with an open counter and a striped canopy
  begin(o.title || 'News kiosk', 'shop');
  const kx = lx + 24, kz = lz + 16;
  walls(kx, 0, kz, kx + 7, 8, kz + 6, M.DOOR_G); hole(kx + 1, 3, kz, kx + 6, 6, kz);
  box(kx + 1, 2, kz - 1, kx + 6, 2, kz, M.WOOD); for (let x = kx + 1; x <= kx + 6; x++) set(x, 3, kz, [M.AWN_W, M.FLOWER_Y, M.CAR_B, M.AWN_R][x & 3]);
  box(kx - 1, 9, kz - 2, kx + 8, 9, kz + 7, M.DOOR_G); box(kx + 1, 10, kz, kx + 6, 10, kz + 5, M.DOOR_G); box(kx + 3, 11, kz + 2, kx + 4, 11, kz + 3, M.BRASS);
  for (let x = kx - 1; x <= kx + 8; x++) set(x, 8, kz - 2, x & 1 ? M.AWN_G : M.AWN_W);
  bench(lx + 8, lz + 33); bench(lx + 24, lz + 33); bin(lx + 20, lz + 28); lampPost(lx + 2, lz + 19, 18); lampPost(lx + 37, lz + 19, 18);
  if (o.fountain) {
    // a drinking fountain in green cast iron, four figures holding up a dome
    begin('Drinking fountain', 'prop', true);
    const fx = lx + 19, fz = lz + 8;
    box(fx - 1, 0, fz - 1, fx + 2, 1, fz + 2, M.DOOR_G); box(fx, 2, fz, fx + 1, 4, fz + 1, M.DOOR_G);
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) box(fx + a, 5, fz + b, fx + a, 7, fz + b, M.ROOF_G);
    box(fx - 1, 8, fz - 1, fx + 2, 8, fz + 2, M.DOOR_G); box(fx, 9, fz, fx + 1, 9, fz + 1, M.DOOR_G); set(fx, 10, fz, M.BRASS);
  }
}

// ---- a street market: six stalls under striped canopies, with crates of fruit, flowers and bread ------------------------
export function market(lx, lz, L, o = {}) {
  const goods = [[M.FLOWER_R, M.FLOWER_Y], [M.SIGN, M.LEAF2], [M.BRICK2, M.PL_Y], [M.AWN_G, M.FLOWER_R], [M.FLOWER_Y, M.SIGN], [M.LEAF2, M.CAR_A]];
  const awns = [M.AWN_R, M.AWN_B, M.AWN_G];
  let n = 0;
  for (const b of [5, 24]) for (const a of [2, 15, 28]) {
    const x = lx + a, z = lz + b, awn = awns[n % 3], [g0, g1] = goods[n++];
    begin('Market stall', 'prop', false);
    for (const [px, pz] of [[0, 0], [9, 0], [0, 7], [9, 7]]) box(x + px, 0, z + pz, x + px, 7, z + pz, M.TRIM);
    for (let i = 0; i <= 9; i++) for (let j = 0; j <= 7; j++) set(x + i, 8, z + j, (i >> 1) & 1 ? awn : M.AWN_W);
    for (let i = 0; i <= 9; i++) { set(x + i, 7, z - 1, (i >> 1) & 1 ? awn : M.AWN_W); set(x + i, 8, z - 1, (i >> 1) & 1 ? awn : M.AWN_W); }
    box(x + 1, 0, z + 2, x + 1, 2, z + 5, M.WOOD); box(x + 8, 0, z + 2, x + 8, 2, z + 5, M.WOOD); box(x + 1, 3, z + 2, x + 8, 3, z + 5, M.WOOD);
    for (let i = 1; i <= 8; i++) for (let j = 2; j <= 5; j++) set(x + i, 4, z + j, (i + j) & 1 ? g0 : g1);
    begin('Crates', 'prop', false);
    box(x + 2, 0, z + 9, x + 4, 1, z + 10, M.WOOD); box(x + 2, 2, z + 9, x + 4, 2, z + 10, g1); box(x + 6, 0, z + 9, x + 7, 2, z + 10, M.WOOD); set(x + 6, 3, z + 9, g0); set(x + 7, 3, z + 10, g0);
  }
  lampPost(lx + 1, lz + 19, 18); lampPost(lx + 38, lz + 19, 18); bin(lx + 13, lz + 20); bench(lx + 22, lz + 19);
  tree(lx + 13, lz + 37, 11, 4); tree(lx + 27, lz + 37, 11, 4);
}
