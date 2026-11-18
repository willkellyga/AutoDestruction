// Cairo buildings and lots: flat-roofed blocks of flats (plastered, or bare red brick in a concrete frame with the
// columns left sticking up for the next floor), old houses with wooden bay windows over striped stone, a bazaar, a
// small mosque, palm gardens, a riverside hotel, a villa, a mud-brick village and the pieces of the desert.
// Our own designs. Drawn like the other kits: round a local origin with the front toward low z, turned by place().
import { M, set, put, get, box, hole, walls, begin, rnd, ri } from './world.js';
import { face, faces4, win, door, text, textW, lampPost, bench, bin, car } from './kit.js';

// ---- shared pieces --------------------------------------------------------------------------------------------------
// A line of voxels through the points, stepping one axis at a time so each voxel touches the last face to face.
export function chain(pts, m) {
  let [x, y, z] = pts[0]; set(x, y, z, m);
  for (let i = 1; i < pts.length; i++) {
    const [a, b, c] = pts[i];
    while (x !== a || y !== b || z !== c) {
      const dx = Math.abs(a - x), dy = Math.abs(b - y), dz = Math.abs(c - z);
      if (dy && dy >= dx && dy >= dz) y += Math.sign(b - y); else if (dx && dx >= dz) x += Math.sign(a - x); else z += Math.sign(c - z);
      set(x, y, z, m);
    }
  }
}
// The same line through empty space only: it stops at the first voxel that is already there (a frond against a wall).
function frond(pts, m) {
  let [x, y, z] = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const [a, b, c] = pts[i];
    while (x !== a || y !== b || z !== c) {
      const dx = Math.abs(a - x), dy = Math.abs(b - y), dz = Math.abs(c - z);
      if (dy && dy >= dx && dy >= dz) y += Math.sign(b - y); else if (dx && dx >= dz) x += Math.sign(a - x); else z += Math.sign(c - z);
      if (get(x, y, z)) return;
      set(x, y, z, m);
    }
  }
}
// A date palm: a ringed trunk and eight fronds that arch out and droop.
export function palm(x, z, h = 20) {
  for (let y = 4; y <= h + 2; y++) if (get(x, y, z)) return;   // no room here: something already stands in the way
  begin('Palm tree', 'tree', false);
  box(x, 0, z, x, h, z, M.TRUNK);
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) set(x + a, 0, z + b, M.TRUNK);
  for (let y = 2; y < h; y += 3) set(x, y, z, M.WOOD);
  const lm = rnd() < 0.5 ? M.LEAF : M.LEAF2, lo = lm === M.LEAF ? M.LEAF2 : M.LEAF;
  set(x, h + 1, z, lm); set(x, h + 2, z, lm);
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) frond([[x, h + 1, z], [x + a * 2, h + 2, z + b * 2], [x + a * 5, h + 2, z + b * 5], [x + a * 7, h, z + b * 7], [x + a * 8, h - 3, z + b * 8]], lm);
  for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) frond([[x, h + 2, z], [x + a, h + 3, z + b], [x + a * 3, h + 3, z + b * 3], [x + a * 5, h + 1, z + b * 5], [x + a * 5, h - 1, z + b * 5]], lo);
  for (const a of [1, -1]) { put(x + a, h, z, M.TRUNK); if (get(x + a, h, z)) put(x + a, h - 1, z, M.SIGN); }
}
// A filled circle or a ring round a whole voxel, so domes, drums and towers share a centre.
export function rdisc(cx, cz, y, R, m, rin = -1) {
  const a = (R + 0.3) * (R + 0.3), b = rin < 0 ? -1 : (rin + 0.3) * (rin + 0.3);
  for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) { const d = dx * dx + dz * dz; if (d <= a && d > b) set(cx + dx, y, cz + dz, m); }
}
// A dome: a shell two voxels thick. `sq` over 1 makes it taller than a half ball; `rib` gives it ribs of a second material.
export function dome(cx, cz, y0, R, m, o = {}) {
  const sq = o.sq || 1, t = o.t || 1.8, top = Math.floor((R + 0.3) * sq);
  for (let dy = 0; dy <= top; dy++) for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
    const d = Math.sqrt(dx * dx + dz * dz + (dy / sq) * (dy / sq));
    if (d <= R + 0.3 && d > R + 0.3 - t) set(cx + dx, y0 + dy, cz + dz, o.rib && (Math.round(Math.atan2(dz, dx) * o.n / Math.PI) & 1) ? o.rib : m);
  }
  return y0 + top;
}
// A slim round tower with a balcony or two and a pointed cap: the pencil minaret of an Ottoman mosque.
export function pencil(cx, cz, y0, H, m, capM = M.ZINC) {
  for (let y = y0; y <= y0 + H; y++) rdisc(cx, cz, y, 2, m);
  for (const f of [0.55, 0.8]) { const y = y0 + Math.round(H * f); rdisc(cx, cz, y, 4, m); rdisc(cx, cz, y + 1, 4, M.TRIM, 3); rdisc(cx, cz, y - 1, 3, m); }
  for (let k = 0; k < 12; k++) rdisc(cx, cz, y0 + H + 1 + k, k < 5 ? 2 : k < 9 ? 1 : 0, capM);
  set(cx, y0 + H + 13, cz, M.BRASS); set(cx, y0 + H + 14, cz, M.BRASS);
  return y0 + H + 14;
}
// A tiered tower: square, then eight-sided, then a little open pavilion under a bulb.
export function tiered(cx, cz, y0, H, m, m2) {
  const a = Math.round(H * 0.45), b = Math.round(H * 0.78);
  for (let y = y0; y <= y0 + a; y++) { walls(cx - 3, y, cz - 3, cx + 3, y, cz + 3, (y - y0) % 4 < 2 ? m : m2); if ((y - y0) % 8 === 0) box(cx - 2, y, cz - 2, cx + 2, y, cz + 2, m); }
  box(cx - 4, y0 + a, cz - 4, cx + 4, y0 + a, cz + 4, M.TRIM); walls(cx - 4, y0 + a + 1, cz - 4, cx + 4, y0 + a + 1, cz + 4, m);
  for (let y = y0 + a + 1; y <= y0 + b; y++) rdisc(cx, cz, y, 2, (y - y0) % 4 < 2 ? m : m2);
  rdisc(cx, cz, y0 + b, 4, M.TRIM); rdisc(cx, cz, y0 + b + 1, 4, m, 3);
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) box(cx + dx, y0 + b + 1, cz + dz, cx + dx, y0 + H, cz + dz, m);
  box(cx, y0 + b + 1, cz, cx, y0 + H, cz, m);
  rdisc(cx, cz, y0 + H, 3, M.TRIM);
  for (let k = 0; k < 5; k++) rdisc(cx, cz, y0 + H + 1 + k, [2, 2, 2, 1, 0][k], m2);
  set(cx, y0 + H + 6, cz, M.BRASS);
  return y0 + H + 6;
}
// A doorway or window with a pointed head cut through a wall face: u..u+w-1 wide, h tall to the point.
export function pointed(F, u, w, h, o = {}) {
  const half = w / 2, rise = Math.max(2, Math.round(w * 0.7));
  for (let y = o.y0 || 0; y < (o.y0 || 0) + h; y++) for (let uu = u; uu < u + w; uu++) {
    const k = y - ((o.y0 || 0) + h - rise), off = Math.abs(uu - u - half + 0.5);
    if (k > 0 && off > half * (1 - (k / rise) * (k / rise)) + 0.01) continue;
    F.c(uu, y, 0);
  }
  if (o.fill) for (let y = Math.max(0, (o.y0 || 0) - 1); y <= (o.y0 || 0) + h; y++) for (let uu = u - 1; uu <= u + w; uu++) F.q(uu, y, -1, o.fill);
}
// A camel, standing, nose toward low x, with a blanket over its hump.
export function camel(x, z, cloth = M.AWN_R) {
  begin('Camel', 'prop', false);
  const C = M.OCHRE;
  for (const a of [2, 9]) for (const b of [0, 3]) box(x + a, 0, z + b, x + a, 5, z + b, C);
  box(x + 1, 6, z, x + 10, 9, z + 3, C); box(x + 4, 10, z + 1, x + 7, 11, z + 2, M.SAND2);
  box(x + 3, 9, z, x + 8, 10, z + 3, cloth); box(x + 3, 7, z - 1, x + 8, 8, z - 1, cloth); box(x + 3, 7, z + 4, x + 8, 8, z + 4, cloth);
  box(x, 8, z + 1, x + 1, 13, z + 2, C); box(x - 3, 12, z + 1, x - 1, 13, z + 2, C); set(x - 3, 13, z + 1, M.DARK); set(x, 14, z + 1, C); set(x, 14, z + 2, C);
  box(x + 11, 6, z + 1, x + 11, 8, z + 1, C);
}
// A ridge tent of striped cloth on poles, open at both ends. It runs along x.
export function tent(x0, z0, len, half, m, m2) {
  begin('Tent', 'prop', false);
  const zc = z0 + half;
  for (const x of [x0, x0 + len - 1]) box(x, 0, zc, x, half + 2, zc, M.TRUNK);
  for (let x = x0; x < x0 + len; x++) for (let d = 0; d <= half; d++) {
    const y = half + 2 - d, c = (x - x0) % 6 < 3 ? m : m2;
    for (const z of [zc - d, zc + d]) { set(x, y, z, c); if (d) set(x, y + 1, z, c); if (d === half) box(x, 0, z, x, y, z, c); }
  }
  box(x0, half + 3, zc, x0 + len - 1, half + 3, zc, m);
}
// A water tank on legs.
function roofTank(x, y, z, m) { for (const [a, b] of [[0, 0], [3, 0], [0, 3], [3, 3]]) box(x + a, y, z + b, x + a, y + 2, z + b, M.METAL); box(x, y + 3, z, x + 3, y + 7, z + 3, m); box(x, y + 8, z, x + 3, y + 8, z + 3, M.DARK); }
// A satellite dish: a white plate on a short post.
function dish(x, y, z, turn) { box(x, y, z, x, y + 2, z, M.DARK); if (turn) box(x, y + 2, z - 1, x, y + 4, z + 1, M.TRIM); else box(x - 1, y + 2, z, x + 1, y + 4, z, M.TRIM); }
// A pigeon loft: a painted wooden hut on stilts, which is what the roofs of Cairo keep.
function loft(x, y, z, m) {
  for (const [a, b] of [[0, 0], [4, 0], [0, 4], [4, 4]]) box(x + a, y, z + b, x + a, y + 6, z + b, M.WOOD);
  box(x, y + 3, z, x + 4, y + 3, z, M.WOOD); box(x, y + 3, z + 4, x + 4, y + 3, z + 4, M.WOOD);
  box(x - 1, y + 7, z - 1, x + 5, y + 7, z + 5, M.WOOD);
  for (let yy = y + 8; yy <= y + 12; yy++) walls(x, yy, z, x + 4, yy, z + 4, yy & 1 ? m : M.PL_W);
  box(x - 1, y + 13, z - 1, x + 5, y + 13, z + 5, M.WOOD); set(x + 2, y + 10, z, M.DARK); set(x + 2, y + 14, z + 2, M.TRIM);
}

// ---- flats: two or three flat-roofed blocks to a lot, a shop under each -----------------------------------------------
// o.n (2 or 3), o.floors, o.walls, o.raw (bare brick in a concrete frame), o.shut (shutter colours), o.signs
// ([word, board, letters]), o.roofs (0 tank, 1 dishes, 2 pigeon loft, 3 the columns for a floor not yet built), o.awn
export function baladi(lx, lz, L, o = {}) {
  const n = o.n || 3, W = n === 2 ? 19 : 13, pitch = n === 2 ? 20 : 13;
  const floors = o.floors || [5, 7, 4], wallsM = o.walls || [M.MUD, M.OCHRE, M.LIME2], raw = o.raw || [0, 0, 0], shut = o.shut || [M.DOOR_G, M.DOOR_B, M.WOOD];
  const signs = o.signs || [['TEA', M.DOOR_G, M.LIT_W], ['FIG', M.CAR_A, M.LIT_Y], ['OUD', M.DARK, M.LIT_W]], roofs = o.roofs || [0, 1, 2], awn = o.awn || [M.AWN_R, M.AWN_G, M.AWN_B];
  for (let i = 0; i < n; i++) {
    const x0 = lx + i * pitch, x1 = x0 + W - 1, z0 = lz + 5 + (i === 1 ? 1 : 0), z1 = lz + 35, nf = floors[i], bare = raw[i], wall = bare ? M.BRICK : wallsM[i];
    const G = 13, FH = 10, top = G + (nf - 1) * FH - 1, frame = bare ? M.CONC : M.TRIM, sh = shut[i], sg = signs[i];
    begin(o.titles ? o.titles[i] : bare ? 'Brick flats' : 'Flats', 'apartment');
    walls(x0, 0, z0, x1, top, z1, wall);
    for (let s = 0; s < nf - 1; s++) box(x0 + 1, G - 1 + s * FH, z0 + 1, x1 - 1, G - 1 + s * FH, z1 - 1, M.CONC);
    box(x0, top, z0, x1, top, z1, M.SLAB);
    const [Ff, Fr, Fb, Fl] = faces4(x0, z0, x1, z1), base = (s) => G + (s - 1) * FH;
    if (bare) {
      // the concrete frame shows: a column at each corner and between the bays, a slab edge at every floor
      for (const F of [Ff, Fb]) { for (let u = 0; u < W; u += 6) F.box(u, 0, u, top, 0, 0, M.CONC); for (let s = 0; s < nf; s++) F.box(0, G - 1 + s * FH, W - 1, G - 1 + s * FH, 0, 0, M.CONC); }
      for (const F of [Fl, Fr]) { for (let s = 0; s < nf; s++) F.box(0, G - 1 + s * FH, F.W - 1, G - 1 + s * FH, 0, 0, M.CONC); for (const u of [10, 20]) F.box(u, 0, u, top, 0, 0, M.CONC); }
    } else if (L >= 1) Ff.box(0, 0, W - 1, 1, 0, 0, M.STONE);
    // the shop: a door to the flats, a window or a roll shutter, an awning and a sign board
    door(Ff, 1, 3, 7, sh, { frame, step: false });
    if ((i + nf) % 3 === 0) { for (let y = 1; y <= 7; y++) Ff.box(6, y, W - 3, y, 0, 0, y & 1 ? M.METAL : M.STEEL); }
    else win(Ff, 6, 2, W - 8, 5, { frame: M.DARK, sill: false, bars: false });
    if (L >= 1) {
      for (let u = 5; u <= W - 1; u++) Ff.box(u, 8, u, 8, 1, 3, (u >> 1) & 1 ? awn[i] : M.AWN_W);
      Ff.box(0, 9, W - 1, 15, 1, 1, sg[1]);
      const word = sg[0].slice(0, n === 2 ? 4 : 3); text(Ff, word, (W - textW(word)) >> 1, 10, 2, sg[2]);
    }
    // the floors above: shuttered windows, some of them shut against the sun; a balcony with washing on every other floor
    for (let s = 1; s < nf; s++) {
      const yb = base(s), us = n === 2 ? [2, 8, 14] : [2, 8], bal = L >= 1 && (s + i) % 2 === 1;
      us.forEach((u, k) => {
        const closed = (u + s * 3 + i * 5 + k) % 4 === 0;
        win(Ff, u, yb + 4, 3, 5, { glass: closed ? sh : M.GLASS, frame, bars: false, sill: !bal });
        if (L >= 1 && !closed && !bal && (s + k + i) % 3 === 0) Ff.box(u, yb + 1, u + 1, yb + 2, 1, 1, M.METAL);
      });
      if (bal) {
        Ff.box(1, yb, W - 2, yb, 1, 2, M.SLAB);
        Ff.box(1, yb + 1, W - 2, yb + 3, 2, 2, bare ? M.CONC : wall); Ff.box(1, yb + 1, 1, yb + 3, 1, 1, bare ? M.CONC : wall); Ff.box(W - 2, yb + 1, W - 2, yb + 3, 1, 1, bare ? M.CONC : wall);
        if (L >= 2) for (let u = 3; u <= W - 4; u += 2) if ((u * 3 + s * 7 + i) % 5 < 3) Ff.box(u, yb + 1, u, yb + 2, 3, 3, [M.AWN_W, M.AWN_B, M.FURN_A, M.FLOWER_Y, M.AWN_G][(u + s + i) % 5]);
      }
      win(Fb, 2, yb + 4, 3, 5, { frame, bars: false }); win(Fb, W - 5, yb + 4, 3, 5, { frame, bars: false });
      if (i === 0) win(Fl, 14, yb + 4, 3, 4, { frame, bars: false, sill: false });
      if (i === n - 1) win(Fr, 14, yb + 4, 3, 4, { frame, bars: false, sill: false });
    }
    door(Fb, W - 5, 3, 7, sh, { frame, step: false });
    if (L >= 2) Fb.box(W >> 1, 0, W >> 1, top, 1, 1, M.METAL);
    // the roof: a parapet, the stair head, and whatever this roof keeps
    if (!bare) walls(x0, top + 1, z0, x1, top + 2, z1, wall); else { box(x0, top + 1, z0, x1, top + 2, z0, M.BRICK); box(x0, top + 1, z0, x0, top + 2, z1, M.BRICK); }
    walls(x0 + 1, top + 1, z1 - 7, x0 + 5, top + 6, z1 - 2, wall); box(x0 + 1, top + 7, z1 - 7, x0 + 5, top + 7, z1 - 2, M.DARK);
    if (L >= 1) {
      const r = roofs[i];
      if (r === 3 || bare) {
        for (let u = 0; u < W; u += 6) for (const z of [z0, z0 + 10, z0 + 20]) { box(x0 + u, top + 1, z, x0 + u, top + 5 + ((u + z) % 3), z, M.CONC); box(x0 + u, top + 6 + ((u + z) % 3), z, x0 + u, top + 7 + ((u + z) % 3), z, M.REBAR); }
        if (r === 3) box(x0 + 6, top + 1, z0, x0 + 12, top + 4, z0, M.BRICK);
      }
      if (r === 0) roofTank(x0 + W - 6, top + 1, z0 + 4, (i + nf) & 1 ? M.TANK : M.TRIM);
      else if (r === 1) { dish(x0 + 3, top + 1, z0 + 4, 0); dish(x0 + W - 4, top + 1, z0 + 9, 1); dish(x0 + 7, top + 1, z0 + 14, 0); }
      else if (r === 2) loft(x0 + W - 7, top + 1, z0 + 3, [M.PL_B, M.PL_G, M.PL_Y, M.PL_P][(i + nf) & 3]);
      if (r !== 2 && L >= 2) dish(x0 + 2, top + 1, z0 + 18, 1);
    }
  }
  if (L >= 2) { if (o.lamp !== 0) lampPost(lx + 1, lz + 2); if (o.palm) palm(lx + 36, lz - 1, ri(14, 18)); if (o.car) car(lx + 6, lz - 15, o.car); }
}

// ---- old houses: three to a lot, striped stone below, plaster above, a wooden bay window over the door ----------------
// o.floors, o.walls, o.wood, o.doors, o.roofs (0 plain, 1 a wind catcher, 2 a shaded terrace)
export function oldhouse(lx, lz, L, o = {}) {
  const floors = o.floors || [3, 2, 3], wallsM = o.walls || [M.MUD, M.LIME2, M.OCHRE], roofs = o.roofs || [1, 0, 2], cloth = o.cloth || [M.AWN_R, M.AWN_B, M.AWN_G];
  for (let i = 0; i < 3; i++) {
    const x0 = lx + i * 13, x1 = x0 + 12, z0 = lz + 5 + (i & 1), z1 = lz + 34 - (i === 2 ? 2 : 0), nf = floors[i], wall = wallsM[i], G = 12, FH = 11, top = G + (nf - 1) * FH - 1, wd = o.wood ? o.wood[i] : M.TRUNK;
    begin(o.titles ? o.titles[i] : 'Old house', 'cottage');
    walls(x0, 0, z0, x1, top, z1, wall);
    for (let s = 0; s < nf - 1; s++) box(x0 + 1, G - 1 + s * FH, z0 + 1, x1 - 1, G - 1 + s * FH, z1 - 1, M.FLOOR);
    box(x0, top, z0, x1, top, z1, M.SLAB);
    const Ff = face('f', x0, z0, x1, z1), Fb = face('b', x0, z0, x1, z1);
    // the ground floor is stone in two colours, course by course, with a pointed door
    for (let y = 0; y < G - 1; y++) Ff.box(0, y, 12, y, 0, 0, (y >> 1) & 1 ? M.REND_P : M.LIME);
    pointed(Ff, 2, 4, 9, { fill: o.doors ? o.doors[i] : M.WOOD }); Ff.p(5, 4, -1, M.BRASS);
    win(Ff, 8, 4, 3, 4, { glass: wd, frame: M.LIME, bars: false, sill: false });
    if (L >= 1) Ff.band(G - 1, G - 1, 1, M.LIME);
    // above: a bay window of turned wood that stands out over the street, on brackets
    for (let s = 1; s < nf; s++) {
      const yb = G + (s - 1) * FH, u0 = s & 1 ? 2 : 6;
      if (L >= 1) {
        Ff.box(u0, yb + 1, u0 + 4, yb + 1, 1, 2, wd); Ff.p(u0, yb, 1, wd); Ff.p(u0 + 4, yb, 1, wd);
        for (let y = yb + 2; y <= yb + 7; y++) for (let u = u0; u <= u0 + 4; u++) { Ff.p(u, y, 2, (u + y) & 1 ? wd : M.WOOD); if (u === u0 || u === u0 + 4) Ff.p(u, y, 1, wd); }
        Ff.box(u0, yb + 8, u0 + 4, yb + 8, 1, 2, wd); Ff.box(u0 + 1, yb + 2, u0 + 3, yb + 7, 0, 0, M.DARK);
      } else Ff.box(u0, yb + 2, u0 + 4, yb + 7, 0, 0, wd);
      win(Ff, s & 1 ? 9 : 1, yb + 4, 2, 4, { glass: wd, frame: wall, bars: false, sill: false });
      win(Fb, 2, yb + 3, 3, 5, { frame: wall, bars: false }); win(Fb, 8, yb + 3, 3, 5, { glass: wd, frame: wall, bars: false });
    }
    door(Fb, 5, 3, 7, M.WOOD, { frame: wall, step: false });
    // the roof: a parapet cut into steps, and a wind catcher or a shaded terrace
    walls(x0, top + 1, z0, x1, top + 2, z1, wall);
    if (L >= 1) { for (let u = 0; u <= 12; u += 2) { Ff.p(u, top + 3, 0, wall); Fb.p(u, top + 3, 0, wall); } }
    if (L >= 1 && roofs[i] === 1) { for (let k = 0; k < 6; k++) box(x0 + 3, top + 1, z1 - 8 + k, x0 + 8, top + 7 - k, z1 - 8 + k, k === 0 || k === 5 ? wd : M.WOOD); hole(x0 + 4, top + 2, z1 - 8, x0 + 7, top + 5, z1 - 8); }
    else if (L >= 1 && roofs[i] === 2) {
      for (const [a, b] of [[2, 3], [10, 3], [2, 12], [10, 12]]) box(x0 + a, top + 1, z0 + b, x0 + a, top + 8, z0 + b, M.WOOD);
      for (let a = 2; a <= 10; a++) box(x0 + a, top + 9, z0 + 3, x0 + a, top + 9, z0 + 12, a % 4 < 2 ? cloth[i] : M.AWN_W);
    }
  }
  if (L >= 2) { if (o.palm) palm(lx + 36, lz + 37, ri(14, 18)); if (o.jars) { begin('Water jars', 'prop', false); for (const a of [16, 18, 20]) { box(lx + a, 0, lz + 3, lx + a, 2, lz + 3, M.ROOF_R); } } }
}

// ---- the bazaar: an arcade of stone shops with a row of cloth-roofed stalls on the pavement in front -------------------
// o.cloth (stall colours), o.goods, o.name
const GOODS = [M.FLOWER_Y, M.SIGN, M.FLOWER_R, M.LEAF2, M.OCHRE, M.BRASS, M.FURN_B, M.TRIM];
export function souk(lx, lz, L, o = {}) {
  const x0 = lx + 1, x1 = lx + 38, z0 = lz + 17, z1 = lz + 35, H = 14, cloth = o.cloth || [M.AWN_R, M.AWN_B, M.AWN_G, M.SIGN];
  begin(o.title || 'Bazaar', 'shop');
  walls(x0, 0, z0, x1, H, z1, M.LIME2); box(x0, H, z0, x1, H, z1, M.SLAB);
  const Ff = face('f', x0, z0, x1, z1), Fb = face('b', x0, z0, x1, z1);
  for (let y = 0; y <= H; y++) Ff.box(0, y, 37, y, 0, 0, (y >> 1) & 1 ? M.REND_P : M.LIME);
  // five pointed arches, each a shop hung with goods
  for (let k = 0; k < 5; k++) {
    const u = 2 + k * 7;
    pointed(Ff, u, 6, 11);
    box(x1 - u - 5, 0, z0 + 3, x1 - u, 3, z0 + 4, M.WOOD);
    for (let a = 0; a < 6; a++) set(x1 - u - a, 4, z0 + 3 + (a & 1), GOODS[(k * 3 + a) % 8]);
    if (L >= 1) { Ff.p(u + 2, 11, 1, M.DARK); Ff.p(u + 2, 10, 1, [M.LIT_Y, M.LIT_R, M.LIT_B, M.LIT_G, M.LIT_P][k]); Ff.p(u + 3, 11, 1, M.DARK); Ff.p(u + 3, 10, 1, M.BRASS); }
    if (k < 4) box(x1 - u - 6, 0, z0 + 1, x1 - u - 6, H - 1, z1 - 1, M.LIME2);
  }
  if (L >= 1) { const name = (o.name || 'SOUK').slice(0, 6); Ff.box(8, H + 1, 29, H + 7, 0, 0, M.DOOR_G); text(Ff, name, (38 - textW(name)) >> 1, H + 2, 1, M.LIT_Y); Ff.band(H, H, 1, M.LIME); }
  walls(x0, H + 1, z0, x1, H + 2, z1, M.LIME2);
  for (let u = 4; u < 36; u += 8) win(Fb, u, 5, 3, 5, { frame: M.LIME, bars: false });
  door(Fb, 18, 3, 8, M.WOOD, { frame: M.LIME, step: false });
  // two little domes on the roof
  for (const a of [10, 28]) { rdisc(lx + a, lz + 26, H + 1, 5, M.LIME2, 3); rdisc(lx + a, lz + 26, H + 2, 5, M.LIME2, 3); dome(lx + a, lz + 26, H + 3, 5, o.domeM || M.LIME); }
  // the stalls: four posts, a striped cloth roof that slopes to the street, a counter heaped with goods
  for (let k = 0; k < 4; k++) {
    const a = lx + 1 + k * 10, c = cloth[k % cloth.length];
    begin('Market stall', 'prop', false);
    for (const [p, q, h] of [[0, 4, 7], [7, 4, 7], [0, 12, 9], [7, 12, 9]]) box(a + p, 0, lz + q, a + p, h, lz + q, M.WOOD);
    for (let q = 3; q <= 13; q++) { const y = 8 + Math.round((q - 4) / 4); for (let p = -1; p <= 8; p++) { set(a + p, y, lz + q, (p + 1) % 4 < 2 ? c : M.AWN_W); set(a + p, y + 1, lz + q, (p + 1) % 4 < 2 ? c : M.AWN_W); } }
    box(a + 1, 0, lz + 6, a + 6, 2, lz + 8, M.WOOD);
    for (let p = 1; p <= 6; p++) { const g = GOODS[(k * 5 + p * 3 + (o.goods | 0)) % 8]; set(a + p, 3, lz + 6, g); set(a + p, 3, lz + 7, g); if (p & 1) set(a + p, 4, lz + 7, g); }
    if (k % 2 === 0) { box(a + 2, 0, lz + 10, a + 2, 6, lz + 10, M.WOOD); box(a + 2, 2, lz + 11, a + 4, 6, lz + 11, [M.AWN_R, M.CAR_B, M.DOOR_G, M.FURN_A][k]); box(a + 3, 3, lz + 11, a + 3, 5, lz + 11, M.FLOWER_Y); }
  }
  if (L >= 2) { lampPost(lx + 38, lz + 2, 16); }
}

// ---- a small mosque: a striped prayer hall under a dome, a tower at one corner, a walled court -------------------------
// o.domeM, o.stripe, o.tower (0 tiered, 1 pencil), o.title
export function mosque(lx, lz, L, o = {}) {
  const st = o.stripe || M.OCHRE, x0 = lx + 4, x1 = lx + 30, z0 = lz + 13, z1 = lz + 36, H = 22, cx = lx + 17, cz = lz + 25;
  begin(o.title || 'Old mosque', 'landmark');
  for (let y = 0; y <= H; y++) walls(x0, y, z0, x1, y, z1, (y >> 1) & 1 ? st : M.LIME);
  box(x0, H, z0, x1, H, z1, M.SLAB);
  for (let x = x0 + 1; x < x1; x++) for (const z of [z0, z1]) if ((x - x0) % 3 !== 0) set(x, H + 1, z, M.LIME);
  for (let z = z0 + 1; z < z1; z++) for (const x of [x0, x1]) if ((z - z0) % 3 !== 0) set(x, H + 1, z, M.LIME);
  const Ff = face('f', x0, z0, x1, z1), Fl = face('l', x0, z0, x1, z1), Fr = face('r', x0, z0, x1, z1), Fb = face('b', x0, z0, x1, z1);
  pointed(Ff, 10, 7, 15, { fill: M.TRUNK }); for (let y = 0; y <= 15; y++) { Ff.p(8, y, 1, M.LIME); Ff.p(18, y, 1, M.LIME); } Ff.box(8, 16, 18, 17, 1, 1, st);
  for (const F of [Ff, Fl, Fr, Fb]) for (let u = 3; u + 3 < F.W; u += 6) { if (F === Ff && u > 6 && u < 20) continue; pointed(F, u, 3, 8, { y0: 9, fill: M.STAIN_B }); }
  // the drum and the dome
  for (let y = H + 1; y <= H + 5; y++) rdisc(cx, cz, y, 9, y === H + 5 ? M.TRIM : M.LIME, 7);
  if (L >= 1) for (const [dx, dz] of [[9, 0], [-9, 0], [0, 9], [0, -9], [6, 6], [-6, 6], [6, -6], [-6, -6]]) { set(cx + dx, H + 3, cz + dz, M.STAIN_Y); }
  const top = dome(cx, cz, H + 6, 9, o.domeM || M.LIME2, { sq: 1.15, rib: o.rib, n: 8 });
  box(cx, top + 1, cz, cx, top + 3, cz, M.BRASS);
  // the tower stands at the front corner
  if (o.tower === 1) { box(lx + 30, 0, lz + 7, lx + 36, 12, lz + 13, M.LIME); pencil(lx + 33, lz + 10, 13, 44, M.LIME); }
  else tiered(lx + 34, lz + 10, 0, 50, M.LIME, st);
  // the court: a low wall, a gate, a fountain for washing
  begin('Mosque court', 'wall', false);
  for (let x = lx + 2; x <= lx + 29; x++) if (x < lx + 14 || x > lx + 20) box(x, 0, lz + 3, x, x % 4 === 0 ? 6 : 5, lz + 3, M.LIME);
  for (let z = lz + 3; z <= lz + 12; z++) box(lx + 2, 0, z, lx + 2, 5, z, M.LIME);
  begin('Fountain', 'prop', false);
  rdisc(lx + 9, lz + 8, 0, 3, M.STONE); rdisc(lx + 9, lz + 8, 1, 3, M.STONE, 2); rdisc(lx + 9, lz + 8, 1, 2, M.WATER); box(lx + 9, 1, lz + 8, lx + 9, 3, lz + 8, M.BRASS);
  if (L >= 2) palm(lx + 24, lz + 8, 16);
}

// ---- gardens: palms round a fountain, an oasis pool, a field under crops, a date grove ---------------------------------
// o.v: 0 garden, 1 oasis, 2 field, 3 grove
export function palms(lx, lz, L, o = {}) {
  const v = o.v | 0;
  if (v === 2) {
    begin('Crops', 'prop', false);
    for (let b = 3; b <= 36; b += 3) for (let a = 2; a <= 37; a++) if ((a * 7 + b * 3) % 11 !== 0 && !(a < 10 && b > 30) && !(a > 30 && b < 10) && !(a > 22 && b > 22)) box(lx + a, 0, lz + b, lx + a, (a + b) % 5 === 0 ? 2 : 1, lz + b, b % 6 === 0 ? M.LEAF2 : M.LEAF);
    // a water wheel turned by a beam
    begin('Water wheel', 'prop', false);
    const cx = lx + 30, cz = lz + 30;
    box(cx - 4, 0, cz, cx - 4, 7, cz, M.WOOD); box(cx + 4, 0, cz, cx + 4, 7, cz, M.WOOD); box(cx - 4, 7, cz, cx + 4, 7, cz, M.WOOD);
    chain(Array.from({ length: 17 }, (_, k) => [cx, 7 + Math.round(5 * Math.sin(k * Math.PI / 8)), cz + Math.round(5 * Math.cos(k * Math.PI / 8))]), M.TRUNK);
    for (let d = -5; d <= 5; d++) { set(cx, 7 + d, cz, M.TRUNK); set(cx, 7, cz + d, M.TRUNK); }
    for (let y = 0; y <= 2; y++) set(cx, y, cz, M.TRUNK);
    palm(lx + 6, lz + 34, 20); palm(lx + 34, lz + 6, 17);
    return;
  }
  const pond = v === 1, spots = [];
  for (let i = 0; i < 80 && spots.length < (v === 3 ? 9 : pond ? 6 : 5); i++) {
    const a = v === 3 ? 6 + (spots.length % 3) * 14 : ri(4, 35), b = v === 3 ? 6 + Math.floor(spots.length / 3) * 14 : ri(4, 35);
    if (v !== 3 && ((Math.abs(a - 20) < (pond ? 13 : 9) && Math.abs(b - 20) < (pond ? 10 : 9)) || spots.some((p) => Math.abs(p[0] - a) < 10 && Math.abs(p[1] - b) < 10))) continue;
    spots.push([a, b, ri(15, 24)]);
  }
  if (pond) {
    begin('Oasis pool', 'prop', false);
    for (let a = -11; a <= 11; a++) for (let b = -8; b <= 8; b++) { const d = a * a / 121 + b * b / 64; if (d <= 1) set(lx + 20 + a, 0, lz + 20 + b, d > 0.78 ? M.SAND2 : M.WATER); }
    begin('Reeds', 'prop', false);
    for (const [a, b] of [[9, 14], [10, 15], [31, 24], [30, 26], [12, 26], [28, 13]]) box(lx + a, 0, lz + b, lx + a, 3 + ((a + b) & 1), lz + b, M.LEAF2);
    begin('Rocks', 'prop', false); box(lx + 5, 0, lz + 22, lx + 7, 2, lz + 24, M.SAND2); box(lx + 6, 3, lz + 23, lx + 6, 3, lz + 23, M.SAND2); box(lx + 33, 0, lz + 17, lx + 34, 1, lz + 18, M.SAND2);
  } else if (v === 0) {
    begin('Fountain', 'prop', false);
    rdisc(lx + 20, lz + 20, 0, 6, M.LIME); rdisc(lx + 20, lz + 20, 1, 6, M.LIME, 5); rdisc(lx + 20, lz + 20, 1, 5, M.WATER); box(lx + 20, 1, lz + 20, lx + 20, 5, lz + 20, M.LIME); rdisc(lx + 20, lz + 20, 6, 2, M.LIME); set(lx + 20, 7, lz + 20, M.WATER);
    begin('Flower beds', 'prop', false);
    for (const [a, b] of [[4, 4], [30, 4], [4, 33], [30, 33]]) for (let p = 0; p < 6; p++) { box(lx + a + p, 0, lz + b, lx + a + p, 1, lz + b + 2, M.HEDGE); set(lx + a + p, 2, lz + b + 1, p & 1 ? M.FLOWER_R : M.FLOWER_Y); }
    bench(lx + 16, lz + 31); bench(lx + 16, lz + 7);
  }
  for (const [a, b, h] of spots) palm(lx + a, lz + b, h);
}

// ---- a riverside hotel: a round tower ringed with balconies under a turning restaurant, or a tall slab ----------------
// o.floors, o.name, o.round, o.wall, o.glass
export function nilehotel(lx, lz, L, o = {}) {
  const n = o.floors || 12, FH = 8, G = 14, top = G + n * FH, name = (o.name || 'NILE').slice(0, 5), wall = o.wall || M.LIME, glass = o.glass || M.GLASS_Z;
  begin(o.title || 'Hotel', 'tower');
  // the podium: a glass lobby under a canopy
  walls(lx + 3, 0, lz + 5, lx + 36, G - 1, lz + 36, wall); box(lx + 3, G - 1, lz + 5, lx + 36, G - 1, lz + 36, M.SLAB);
  const Pf = face('f', lx + 3, lz + 5, lx + 36, lz + 36);
  for (let u = 2; u <= 31; u++) if (u % 6 !== 1) Pf.box(u, 1, u, 9, 0, 0, glass);
  door(Pf, 14, 6, 10, M.DARK, { glass: true, frame: M.BRASS, step: false });
  if (L >= 1) { Pf.box(10, 11, 23, 11, 1, 5, M.TRIM); Pf.box(10, 0, 10, 10, 5, 5, M.BRASS); Pf.box(23, 0, 23, 10, 5, 5, M.BRASS); }
  if (o.round) {
    const cx = lx + 20, cz = lz + 21, R = 13;
    for (let y = G; y <= top; y++) {
      const fl = (y - G) % FH === 0;
      if (fl) { rdisc(cx, cz, y, R + (L >= 1 ? 2 : 0), M.SLAB); if (L >= 1) rdisc(cx, cz, y + 1, R + 2, M.TRIM, R + 1); }
      else for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) { const d = dx * dx + dz * dz; if (d <= (R + 0.3) * (R + 0.3) && d > (R - 0.7) * (R - 0.7)) set(cx + dx, y, cz + dz, (Math.round(Math.atan2(dz, dx) * 12 / Math.PI) % 3 === 0) ? wall : (dx * 3 + dz * 5 + y) % 17 === 0 ? M.LIT : glass); }
    }
    for (let y = G; y <= top + 4; y++) rdisc(cx, cz, y, 4, M.TRIM, 2);   // the lift core
    // the restaurant: a wider drum of glass under a flat cap
    rdisc(cx, cz, top + 1, R + 3, M.SLAB);
    for (let y = top + 2; y <= top + 7; y++) rdisc(cx, cz, y, R + 3, y === top + 2 ? wall : glass, R + 2);
    rdisc(cx, cz, top + 8, R + 4, M.TRIM); rdisc(cx, cz, top + 9, R + 1, wall);
    if (L >= 1) { const F = face('f', cx - 10, cz - 2, cx + 10, cz - 2); box(cx - 10, top + 10, cz - 2, cx + 10, top + 10, cz - 2, M.DARK); for (const a of [-9, 0, 9]) box(cx + a, top + 10, cz - 2, cx + a, top + 17, cz - 2, M.STEEL); box(cx - 10, top + 11, cz - 2, cx + 10, top + 17, cz - 2, M.DARK); text(F, name, (21 - textW(name)) >> 1, top + 12, 1, o.ink || M.LIT_Y); }
    box(cx, top + 9, cz, cx, top + 26, cz, M.STEEL); set(cx, top + 27, cz, M.LIT_R);
  } else {
    const x0 = lx + 4, x1 = lx + 35, z0 = lz + 10, z1 = lz + 30;
    walls(x0, G, z0, x1, top, z1, wall);
    for (let s = 1; s <= n; s++) box(x0 + 1, G + s * FH - 1, z0 + 1, x1 - 1, G + s * FH - 1, z1 - 1, M.CONC);
    box(x0, top, z0, x1, top, z1, M.SLAB);
    box(x0 + 13, G, z0 + 8, x0 + 18, top + 6, z0 + 13, M.TRIM);   // the lift core, up through the roof
    const [Ff, Fr, Fb, Fl] = faces4(x0, z0, x1, z1);
    for (let s = 0; s < n; s++) {
      const yb = G + s * FH;
      for (const F of [Ff, Fb]) {
        for (let u = 1; u <= 30; u++) if (u % 5 !== 0) for (let y = yb + 1; y <= yb + 5; y++) F.p(u, y, 0, (u * 5 + y * 3 + s * 7) % 23 === 0 ? M.LIT : glass);
        if (L >= 1) { F.box(0, yb, 31, yb, 1, 2, M.SLAB); for (let u = 0; u <= 31; u++) { F.p(u, yb + 2, 2, M.TRIM); if (u % 5 === 0) { F.p(u, yb + 1, 2, M.TRIM); F.box(u, yb + 1, u, yb + 6, 1, 1, wall); } } }
      }
      for (const F of [Fl, Fr]) for (let y = yb + 2; y <= yb + 5; y++) F.box(9, y, 11, y, 0, 0, glass);
    }
    walls(x0, top + 1, z0, x1, top + 2, z1, wall);
    if (L >= 1) { for (const a of [x0 + 3, x1 - 3, (x0 + x1) >> 1]) box(a, top + 1, z0 + 1, a, top + 10, z0 + 1, M.STEEL); box(x0 + 2, top + 4, z0 + 1, x1 - 2, top + 10, z0 + 1, M.DARK); text(face('f', x0 + 2, z0 + 1, x1 - 2, z0 + 1), name, (28 - textW(name)) >> 1, top + 5, 1, o.ink || M.LIT_Y); }
  }
  if (L >= 2) { palm(lx + 2, lz + 1, 18); palm(lx + 37, lz + 1, 20); if (o.car) car(lx + 6, lz - 15, o.car); }
}

// ---- a villa in its garden: two floors behind an arcade, a low red roof, palms ----------------------------------------
export function villa(lx, lz, L, o = {}) {
  const x0 = lx + 7, x1 = lx + 32, z0 = lz + 12, z1 = lz + 31, wall = o.wall || M.REND_C, H = 22;
  begin(o.title || 'Villa', 'cottage');
  walls(x0, 0, z0, x1, H, z1, wall); box(x0 + 1, 10, z0 + 1, x1 - 1, 10, z1 - 1, M.FLOOR); box(x0, H, z0, x1, H, z1, M.SLAB);
  const [Ff, Fr, Fb, Fl] = faces4(x0, z0, x1, z1);
  // the arcade: four arches on columns, a balcony over them
  box(x0, 10, z0 - 5, x1, 10, z0 - 1, M.SLAB);
  for (let k = 0; k <= 4; k++) { const x = x0 + Math.round(k * 25 / 4); box(x, 0, z0 - 5, x, 9, z0 - 5, M.TRIM); if (k < 4) { set(x + 1, 9, z0 - 5, M.TRIM); set(x + Math.round(25 / 4) - 1, 9, z0 - 5, M.TRIM); } }
  for (let x = x0; x <= x1; x++) { set(x, 13, z0 - 5, M.TRIM); if ((x - x0) % 2 === 0) box(x, 11, z0 - 5, x, 12, z0 - 5, M.TRIM); }
  door(Ff, 11, 4, 8, o.door || M.DOOR_G, { light: true, step: false });
  for (const u of [3, 19]) win(Ff, u, 3, 4, 5, { shutters: L >= 1 ? o.door || M.DOOR_G : 0 });
  for (const u of [3, 11, 19]) pointed(Ff, u, 4, 8, { y0: 12, fill: M.GLASS });
  for (const F of [Fl, Fr, Fb]) for (let u = 3; u + 4 < F.W; u += 7) { win(F, u, 3, 3, 5); win(F, u, 13, 3, 5); }
  // a low hipped roof of red tile behind a white parapet
  walls(x0, H + 1, z0, x1, H + 1, z1, M.TRIM);
  for (let k = 1; k <= 4; k++) for (const j of [2 * k - 1, 2 * k, 2 * k + 1]) walls(x0 + j, H + k, z0 + j, x1 - j, H + k, z1 - j, M.ROOF_R);
  begin('Garden wall', 'wall', false);
  for (let x = lx + 1; x <= lx + 38; x++) if (x < lx + 17 || x > lx + 22) box(x, 0, lz + 2, x, x % 6 === 1 ? 5 : 3, lz + 2, wall);
  if (L >= 2) { palm(lx + 4, lz + 7, 20); palm(lx + 35, lz + 8, 17); palm(lx + 36, lz + 35, 22); begin('Flower beds', 'prop', false); for (let p = 0; p < 8; p++) { box(lx + 8 + p, 0, lz + 4, lx + 8 + p, 1, lz + 5, M.HEDGE); set(lx + 8 + p, 2, lz + 4, p & 1 ? M.FLOWER_R : M.FLOWER_Y); box(lx + 24 + p, 0, lz + 4, lx + 24 + p, 1, lz + 5, M.HEDGE); set(lx + 24 + p, 2, lz + 4, p & 1 ? M.FLOWER_Y : M.FLOWER_R); } }
}

// ---- a mud-brick village: small flat-roofed houses, one under a dome, a pigeon tower, palms ----------------------------
export function village(lx, lz, L, o = {}) {
  const v = o.v | 0, SPOTS = [[2, 4, 13, 11, 8], [20, 3, 15, 12, 10], [3, 22, 12, 13, 7], [22, 23, 11, 12, 9]];
  SPOTS.forEach(([a, b, w, d, h], i) => {
    if (i === 3 && v % 2 === 0) return;
    const x0 = lx + a, z0 = lz + b, x1 = x0 + w - 1, z1 = z0 + d - 1, wall = [M.MUD, M.OCHRE, M.SAND2, M.MUD][(i + v) & 3];
    begin('Village house', 'cottage');
    walls(x0, 0, z0, x1, h, z1, wall); box(x0, h, z0, x1, h, z1, wall); walls(x0, h + 1, z0, x1, h + 1, z1, wall);
    const Ff = face('f', x0, z0, x1, z1), Fr = face('r', x0, z0, x1, z1);
    door(Ff, 2, 3, 6, [M.DOOR_B, M.DOOR_G, M.WOOD, M.DOOR_R][(i + v) & 3], { frame: wall, step: false });
    win(Ff, w - 5, 3, 2, 3, { glass: M.DARK, frame: wall, bars: false, sill: false }); win(Fr, 3, 3, 2, 3, { glass: M.DARK, frame: wall, bars: false, sill: false });
    if (L >= 1) for (let x = x0 + 1; x < x1; x += 3) { set(x, h - 1, z0 - 1, M.TRUNK); }   // the ends of the roof beams
    if (i === (v & 1)) { const cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1; rdisc(cx, cz, h + 1, 4, wall, 2); dome(cx, cz, h + 2, 4, M.TRIM); }
    else if (L >= 1 && i === 1) { box(x0 + 2, h + 1, z0 + 2, x0 + 4, h + 2, z0 + 4, M.ROOF_R); set(x0 + 8, h + 2, z0 + 3, M.FLOWER_Y); box(x0 + 7, h + 1, z0 + 2, x0 + 9, h + 1, z0 + 4, M.PL_Y); }
  });
  if (v % 2 === 0) {
    // the pigeon tower: a tall cone of mud, dotted with holes and perches
    const cx = lx + 28, cz = lz + 29;
    begin('Pigeon tower', 'monument');
    for (let y = 0; y <= 26; y++) { const R = y < 6 ? 5 : y < 14 ? 4 : y < 21 ? 3 : 2; rdisc(cx, cz, y, R, M.MUD, y % 9 === 5 ? -1 : R - 2); }
    rdisc(cx, cz, 27, 1, M.TRIM); set(cx, 28, cz, M.TRIM);
    if (L >= 1) for (let y = 8; y <= 24; y += 4) { const R = y < 14 ? 4 : y < 21 ? 3 : 2; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { set(cx + dx * (R + 1), y, cz + dz * (R + 1), M.TRUNK); set(cx + dx * R, y + 1, cz + dz * R, M.DARK); } }
  }
  if (L >= 2) { palm(lx + 17, lz + 18, 21); palm(lx + 36, lz + 18, 17); if (v === 1) { camel(lx + 24, lz + 28); } begin('Haystack', 'prop', false); box(lx + 16, 0, lz + 30, lx + 19, 2, lz + 33, M.PL_Y); box(lx + 17, 3, lz + 31, lx + 18, 3, lz + 32, M.PL_Y); }
}

// ---- the desert: a field of old flat tombs, a visitors' camp with camels, a dig -----------------------------------------
export function mastabas(lx, lz, L, o = {}) {
  const v = o.v | 0;
  for (let k = 0; k < 6; k++) {
    const a = 2 + (k % 3) * 13 + ((k + v) % 2), b = 4 + Math.floor(k / 3) * 18 + ((k * 3 + v) % 4), w = 9 + ((k + v) % 3), d = 12 + ((k * 2 + v) % 3), h = 4 + ((k + v) % 3);
    if ((k + v) % 5 === 4) continue;
    begin('Old tomb', 'monument');
    box(lx + a, 0, lz + b, lx + a + w, 1, lz + b + d, M.SAND2); box(lx + a + 1, 2, lz + b + 1, lx + a + w - 1, h, lz + b + d - 1, (k + v) & 1 ? M.SAND : M.SAND2);
    hole(lx + a + 2, 2, lz + b + 2, lx + a + w - 2, h - 1, lz + b + d - 2);
    hole(lx + a + 3, 2, lz + b + 1, lx + a + 4, 4, lz + b + 1); if ((k + v) % 3 === 0) hole(lx + a + w - 3, h - 1, lz + b + 1, lx + a + w - 1, h, lz + b + 4);
  }
}
export function camp(lx, lz, L, o = {}) {
  const v = o.v | 0;
  tent(lx + 3, lz + 20, 16, 5, M.AWN_W, M.AWN_R); tent(lx + 22, lz + 22, 14, 4, M.AWN_W, v ? M.AWN_G : M.AWN_B);
  camel(lx + 8, lz + 6, M.AWN_R); camel(lx + 24, lz + 10, M.AWN_B); if (v) camel(lx + 14, lz + 34, M.AWN_G);
  begin('Souvenir stall', 'prop', false);
  for (const [a, b] of [[30, 3], [37, 3], [30, 8], [37, 8]]) box(lx + a, 0, lz + b, lx + a, 7, lz + b, M.WOOD);
  for (let a = 29; a <= 38; a++) box(lx + a, 8, lz + 2, lx + a, 8, lz + 9, a % 4 < 2 ? M.SIGN : M.AWN_W);
  box(lx + 31, 0, lz + 5, lx + 36, 2, lz + 6, M.WOOD); for (let a = 31; a <= 36; a++) set(lx + a, 3, lz + 5, [M.BRASS, M.SAND, M.CAR_B, M.SAND2][a & 3]);
  begin('Camp fire', 'prop', false); box(lx + 19, 0, lz + 16, lx + 20, 0, lz + 17, M.STONE); set(lx + 19, 1, lz + 16, M.LIT_R); set(lx + 20, 1, lz + 17, M.LIT_Y);
  if (L >= 2) { palm(lx + 2, lz + 3, 19); if (!v) car(lx + 2, lz + 33, M.CAR_C); }
}
export function dig(lx, lz, L, o = {}) {
  // a head of stone, half out of the sand, inside a square of pegs and string
  begin('Buried statue', 'monument');
  box(lx + 14, 0, lz + 13, lx + 24, 4, lz + 22, M.SAND2); box(lx + 15, 5, lz + 14, lx + 23, 11, lz + 21, M.SAND);
  box(lx + 13, 3, lz + 12, lx + 14, 12, lz + 23, M.SAND2); box(lx + 24, 3, lz + 12, lx + 25, 12, lz + 23, M.SAND2); box(lx + 15, 12, lz + 13, lx + 23, 13, lz + 22, M.SAND2);
  for (const a of [17, 21]) set(lx + a, 9, lz + 13, M.DARK); box(lx + 19, 6, lz + 13, lx + 19, 8, lz + 13, M.SAND2); box(lx + 17, 5, lz + 13, lx + 21, 5, lz + 13, M.OCHRE); box(lx + 18, 1, lz + 12, lx + 20, 4, lz + 12, M.SAND);
  begin('Dig pegs', 'prop', false);
  for (let t = 8; t <= 30; t++) for (const [a, b] of [[t, 8], [t, 28], [8, t - 0], [30, t - 0]]) { if (b > 28) continue; const corner = (a === 8 || a === 30) && (b === 8 || b === 28); box(lx + a, t % 4 === 0 || corner ? 0 : 1, lz + b, lx + a, corner ? 3 : 1, lz + b, corner ? M.CAR_A : M.TRIM); }
  tent(lx + 3, lz + 30, 12, 4, M.AWN_W, M.AWN_W);
  begin('Crates', 'prop', false); box(lx + 32, 0, lz + 30, lx + 35, 2, lz + 33, M.WOOD); box(lx + 33, 3, lz + 31, lx + 35, 5, lz + 33, M.WOOD); box(lx + 27, 0, lz + 33, lx + 29, 2, lz + 35, M.WOOD);
  begin('Ladder', 'prop', false); for (let y = 0; y <= 12; y++) { set(lx + 26, y, lz + 16, M.WOOD); set(lx + 26, y, lz + 19, M.WOOD); if (y % 3 === 1) box(lx + 26, y, lz + 17, lx + 26, y, lz + 18, M.WOOD); }
  if (L >= 2) { car(lx + 12, lz, M.CAR_C); palm(lx + 36, lz + 5, 18); }
}
// A square in the city: an obelisk on a stepped base, four small sphinxes and palms.
export function obelisk(lx, lz, L, o = {}) {
  const cx = lx + 20, cz = lz + 20;
  begin(o.title || 'Obelisk', 'monument');
  box(cx - 5, 0, cz - 5, cx + 5, 1, cz + 5, M.LIME); box(cx - 4, 2, cz - 4, cx + 4, 3, cz + 4, M.LIME); box(cx - 3, 4, cz - 3, cx + 3, 9, cz + 3, M.LIME2);
  for (let y = 10; y <= 52; y++) { const r = y < 26 ? 2 : 1; box(cx - r, y, cz - r, cx + r, y, cz + r, M.REND_P); if (y % 6 === 1 && r === 2) for (const d of [-2, 2]) { set(cx + d, y, cz, M.OCHRE); set(cx, y, cz + d, M.OCHRE); } }
  box(cx, 53, cz, cx, 55, cz, M.BRASS); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) set(cx + a, 53, cz + b, M.BRASS);
  for (const [a, b] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) {
    begin('Small sphinx', 'prop', false);
    box(cx + a - 1, 0, cz + b - 3, cx + a + 1, 1, cz + b + 3, M.LIME); box(cx + a - 1, 2, cz + b - 2, cx + a + 1, 3, cz + b + 3, M.SAND2); box(cx + a - 1, 4, cz + b - 3, cx + a + 1, 6, cz + b - 2, M.SAND2); set(cx + a, 2, cz + b - 3, M.SAND2);
  }
  if (L >= 2) { for (const [a, b] of [[4, 20], [35, 20], [20, 4], [20, 35]]) palm(lx + a, lz + b, ri(18, 22)); lampPost(lx + 3, lz + 3, 18); lampPost(lx + 36, lz + 36, 18); bench(lx + 8, lz + 8); bench(lx + 24, lz + 30); }
}
