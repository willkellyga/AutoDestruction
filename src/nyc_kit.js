// New York buildings and lots: a row of brownstones with stoops, the tenement and the cast-iron loft with their fire
// escapes and roof tanks, the stepped-back stone tower, the sign-covered blocks of Times Square, and a piece of park.
// Our own designs. Drawn like the other kits: round a local origin with the front toward low z, turned by place().
import { M, set, put, box, hole, walls, begin, rnd, ri } from './world.js';
import { face, faces4, win, door, disc, spire, text, textW, tree, lampPost, bench, bin, hydrant, mailbox, planter, car, table, chair, bed, shelf, ceilingLight, stairs, flat } from './kit.js';

// A wooden water tank on steel legs, standing on a roof whose top is y - 1. Part of the building it stands on.
export function roofTank(cx, y, cz) {
  for (const [a, b] of [[-3, -3], [2, -3], [-3, 2], [2, 2]]) box(cx + a, y, cz + b, cx + a, y + 4, cz + b, M.STEEL);
  disc(cx, cz, y + 5, 4, M.STEEL);
  for (let h = 6; h <= 13; h++) { disc(cx, cz, y + h, 4, M.WOOD); if (h === 8 || h === 12) disc(cx, cz, y + h, 4, M.DARK, 3.2); }
  disc(cx, cz, y + 14, 4, M.ROOF_D); disc(cx, cz, y + 15, 3, M.ROOF_D); disc(cx, cz, y + 16, 2, M.ROOF_D); disc(cx, cz, y + 17, 1, M.ROOF_D);
}
// A fire escape on a front: a slatted landing at every floor from `from` up, a rail round it, a stair between landings
// and a drop ladder under the lowest. base(s) is the floor level of storey s.
function fireEscape(F, ua, ub, from, n, base) {
  for (let s = from; s < n; s++) {
    const y = base(s) - 1;
    F.box(ua, y, ub, y, 1, 3, M.DARK);
    for (let u = ua; u <= ub; u++) { F.p(u, y + 4, 3, M.DARK); if (((u - ua) & 1) === 0 || u === ub) F.box(u, y + 1, u, y + 3, 3, 3, M.DARK); }
    for (const u of [ua, ub]) { F.box(u, y + 4, u, y + 4, 1, 2, M.DARK); F.box(u, y + 1, u, y + 3, 1, 1, M.DARK); }
    if (s < n - 1) {
      const dir = s & 1 ? -1 : 1, us = dir > 0 ? ua + 2 : ub - 2;
      for (let k = 1, up = us; k <= 11; k++) { const u = us + dir * (k >> 1); F.p(u, y + k, 2, M.DARK); if (u !== up) F.p(up, y + k, 2, M.DARK); up = u; }
    }
  }
  F.box(ua + 1, 6, ua + 1, base(from) - 2, 3, 3, M.DARK);
}
// the usual bits on a pavement in front of a lot
function kerb(lx, lz, o, treeAt = 36) {
  lampPost(lx + 1, lz + 2); tree(lx + treeAt, lz - 2, 12, 4);
  if (rnd() < 0.5) hydrant(lx + 9, lz + 1); else mailbox(lx + 27, lz + 1);
  if (o.car) car(lx + 6, lz - 15, o.car);
}

// ---- a row of brownstones: three narrow houses side by side, each its own stone, with a stoop up to the parlour floor,
// tall windows, a bracketed cornice and a flat roof -------------------------------------------------------------------
// o.walls, o.doors and o.floors (3 or 4) are per house. o.jl and o.jr say a side stands against the next lot's row.
export function brownstone(lx, lz, L, o = {}) {
  const jl = !!o.jl, jr = !!o.jr, x0 = lx + (jl ? -3 : 1), x1 = lx + (jr ? 42 : 38), z0 = lz + 9, z1 = lz + 35, W = x1 - x0 + 1, B = 6;
  const wallsM = o.walls || [M.BROWNST, M.BRICK, M.BROWNST], doors = o.doors || [M.DOOR_G, M.DARK, M.DOOR_R], fl = o.floors || [4, 3, 4], trim = o.trim || M.DARK;
  begin(o.title || 'Brownstones', 'apartment');
  const w3 = Math.floor(W / 3);
  for (let i = 0; i < 3; i++) {
    const hx0 = x0 + i * w3, hx1 = i === 2 ? x1 : hx0 + w3 - 1, Wh = hx1 - hx0 + 1, wall = wallsM[i], n = fl[i], top = B + n * 12 - 1;
    walls(hx0, 0, z0, hx1, top, z1, wall);
    for (let s = 0; s < n; s++) box(hx0 + 1, B - 1 + s * 12, z0 + 1, hx1 - 1, B - 1 + s * 12, z1 - 1, s ? M.CONC : M.FLOOR);
    box(hx0, top, z0, hx1, top, z1, M.SLAB);
    const F = face('f', hx0, z0, hx1, z1), Fb = face('b', hx0, z0, hx1, z1), p = Math.floor((Wh - 6) / 2), bays = [2, 2 + p, 2 + 2 * p], db = i & 1 ? 2 : 0, ud = bays[db];
    const lint = wall === M.BROWNST ? M.BROWNST : M.TRIM;
    if (L >= 1) { F.box(0, 0, Wh - 1, 0, 0, 0, M.STONE); F.band(top, top, 1, trim); F.band(top - 1, top - 1, 1, trim); for (let u = 0; u < Wh; u += 2) F.p(u, top - 2, 1, trim); F.box(0, top, Wh - 1, top, 2, 2, trim); }
    // the stoop: steps up to the parlour door, with an iron rail down each side
    for (let d = 1; d <= B; d++) { F.box(ud - 1, 0, ud + 3, B - d, d, d, wall === M.BRICK || wall === M.BRICK2 ? M.STONE : wall); if (L >= 1) for (const u of [ud - 1, ud + 3]) F.p(u, B - d + 1, d, M.DARK); }
    for (let y = B; y <= B + 8; y++) for (let u = ud; u <= ud + 2; u++) F.c(u, y, 0);
    F.box(ud - 1, B - 1, ud + 3, B + 9, -1, -1, doors[i]); F.box(ud, B + 6, ud + 2, B + 8, -1, -1, M.GLASS);
    if (L >= 1) { for (let y = B; y <= B + 9; y++) { F.p(ud - 1, y, 0, lint); F.p(ud + 3, y, 0, lint); } F.box(ud - 1, B + 9, ud + 3, B + 9, 0, 0, lint); F.box(ud - 1, B + 10, ud + 3, B + 10, 1, 1, lint); F.p(ud, B + 4, 0, M.BRASS); }
    for (let k = 0; k < 3; k++) { if (k !== db) win(F, bays[k], B + 2, 2, 8, { frame: lint, lintel: L >= 1 ? lint : 0 }); }
    for (let s = 1; s < n; s++) for (const u of bays) win(F, u, B + s * 12 + 2, 2, 7, { frame: lint, lintel: L >= 1 ? lint : 0 });
    win(F, bays[db === 0 ? 2 : 0], 1, 2, 3, { frame: M.DARK, sill: false, bars: false });
    for (let s = 0; s < n; s++) for (const u of [2, Wh - 5]) win(Fb, u, B + s * 12 + 3, 2, 6);
    // the roof: a low wall along the front, a chimney on the party wall and a hatch
    box(hx0, top + 1, z0, hx1, top + 1, z0, wall);
    box(hx0 + 1, top + 1, z1 - 5, hx0 + 2, top + 5, z1 - 3, wall); set(hx0 + 1, top + 6, z1 - 4, M.ROOF_R); set(hx0 + 2, top + 6, z1 - 4, M.ROOF_R);
    if (L >= 1) { box(hx0 + 5, top + 1, z0 + 10, hx0 + 7, top + 2, z0 + 12, M.DARK); box(hx0 + 5, top + 1, z0 + 18, hx0 + 7, top + 1, z0 + 20, M.GLASS); }
    if (L >= 3 && o.inside) for (let s = 0; s < n; s++) {
      const y = B + s * 12;
      if (s & 1) { bed(hx0 + 2, y, z1 - 11, s & 2 ? M.FURN_A : M.FURN_B); table(hx0 + 2, y, z0 + 3, 4, 3); } else { table(hx0 + 3, y, z1 - 8, 5, 3); chair(hx0 + 4, y, z1 - 4, 1); shelf(hx1 - 1, y, z0 + 8, 6, true, 6); }
      ceilingLight(hx0 + (Wh >> 1), y + 10, z0 + 12);
    }
  }
  if (L >= 2) kerb(lx, lz, o, 19);
}

// ---- a tenement, or a cast-iron loft: a shop at the street, floors of windows over it, a fire escape zig-zagging down
// the front, a heavy cornice, and a water tank on the roof ---------------------------------------------------------
// o.floors 3 to 6. o.loft makes the windows tall and wide between slim columns. o.jl and o.jr as for the brownstones.
export function tenement(lx, lz, L, o = {}) {
  const jl = !!o.jl, jr = !!o.jr, x0 = lx + (jl ? -3 : 1), x1 = lx + (jr ? 42 : 38), z0 = lz + 6, z1 = lz + 35, n = o.floors || 5, G = 16, top = G + (n - 1) * 12 - 1;
  const wall = o.wall || M.BRICK, front = o.front || M.DOOR_G, awn = o.awn || M.AWN_R, name = o.name || 'DELI', trim = o.trim || M.DARK, loft = !!o.loft;
  begin(o.title || (loft ? 'Loft building' : 'Tenement'), 'apartment');
  walls(x0, 0, z0, x1, top, z1, wall);
  for (let s = 0; s < n - 1; s++) box(x0 + 1, G - 1 + s * 12, z0 + 1, x1 - 1, G - 1 + s * 12, z1 - 1, M.CONC);
  box(x0, top, z0, x1, top, z1, M.SLAB);
  const [Ff, Fr, Fb, Fl] = faces4(x0, z0, x1, z1), W = Ff.W, nb = Math.floor((W - 2) / 6), bays = Array.from({ length: nb }, (_, i) => ((W - nb * 6 + 2) >> 1) + i * 6);
  const base = (s) => G + (s - 1) * 12, lint = loft ? M.TRIM : wall === M.REND_C ? M.BROWNST : M.TRIM;
  if (L >= 1) { for (const F of [Ff, ...(jr ? [] : [Fr]), Fb, ...(jl ? [] : [Fl])]) F.box(0, 0, F.W - 1, 1, 0, 0, M.STONE); Ff.band(G - 1, G - 1, 1, M.TRIM); }
  for (let s = 1; s < n; s++) {
    const yb = base(s);
    for (const u of bays) { if (loft) win(Ff, u, yb + 1, 4, 9, { frame: lint, sill: false }); else win(Ff, u, yb + 3, 3, 7, { frame: lint, lintel: L >= 1 ? lint : 0 }); }
    if (loft && L >= 1) Ff.box(0, yb - 1, W - 1, yb - 1, 1, 1, M.TRIM);
    for (let u = 5; u + 3 <= W - 5; u += 7) win(Fb, u, yb + 3, 3, 6);
    for (const [F, j] of [[Fr, jr], [Fl, jl]]) if (!j) for (let u = 7; u + 3 <= F.W - 6; u += 9) win(F, u, yb + 3, 3, 6);
  }
  // ground floor: the street door at one end, the shop across the rest
  const sR = W - 2, ww = W >= 42 ? 11 : 9, w2 = sR - 1 - ww, du = ((10 + ww + w2) >> 1) - 1;
  door(Ff, 2, 4, 11, o.door || M.DOOR_B, { light: true });
  Ff.box(8, 0, sR, 1, 0, 0, front);
  win(Ff, 10, 2, ww, 7, { frame: front, sill: false }); win(Ff, w2, 2, ww, 7, { frame: front, sill: false });
  door(Ff, du, 3, 9, front, { glass: true, frame: front });
  Ff.box(8, 10, sR, 14, 0, 0, front);
  door(Fb, 6, 4, 9, M.DARK, { step: false }); win(Fb, 16, 3, 5, 6);
  if (L >= 2) {
    text(Ff, name.replace(' ', ''), 9 + ((sR - 9 - textW(name.replace(' ', ''))) >> 1), 10, 1, o.ink || M.LIT_W);
    for (let u = 9; u <= sR - 1; u++) { if (u >= du - 1 && u <= du + 3) continue; const m = ((u >> 1) & 1) ? awn : M.AWN_W; for (let d = 1; d <= 4; d++) { const y = 9 - ((d - 1) >> 1); Ff.p(u, y, d, m); if (d > 1 && (d & 1)) Ff.p(u, y + 1, d, m); } }
  }
  // the cornice, and the fire escape over the two bays next to the door's end
  if (L >= 1) {
    Ff.band(top, top, 1, trim); Ff.band(top - 1, top - 1, 1, trim); Ff.band(top, top, 2, trim); for (let u = 0; u < W; u += 2) Ff.p(u, top - 2, 1, trim);
    if (n >= 3) { const k = Math.min(nb - 2, 1 + (n & 1)); fireEscape(Ff, bays[k] - 1, bays[k + 1] + (loft ? 4 : 3), 2, n, base); }
  }
  // the roof: a parapet, the stair head, and the tank
  walls(x0, top + 1, z0, x1, top + 2, z1, wall);
  walls(x0 + 3, top + 1, z1 - 9, x0 + 9, top + 7, z1 - 3, wall); box(x0 + 3, top + 8, z1 - 9, x0 + 9, top + 8, z1 - 3, M.DARK); hole(x0 + 5, top + 1, z1 - 9, x0 + 6, top + 5, z1 - 9);
  if (o.tank) roofTank(x1 - 8, top + 1, z0 + 9);
  if (L >= 1) { box(x0 + 14, top + 1, z0 + 12, x0 + 16, top + 3, z0 + 14, M.METAL); box(x0 + 20, top + 1, z1 - 8, x0 + 23, top + 1, z1 - 5, M.GLASS); }
  if (L >= 3 && o.inside) {
    box(x0 + 1, 0, z0 + 1, x1 - 1, 0, z1 - 1, M.FLOOR);
    box(x0 + 9, 1, z0 + 12, x0 + 22, 3, z0 + 13, M.WOOD); box(x0 + 9, 4, z0 + 12, x0 + 22, 4, z0 + 13, M.TRIM);
    shelf(x0 + 9, 1, z1 - 2, 22, false, 9);
    for (const [a, b] of [[10, 3], [17, 3]]) { table(x1 - a - 3, 1, z0 + b, 3, 3); chair(x1 - a + 1, 1, z0 + b, 1); }
    for (const a of [8, 20, 30]) ceilingLight(x0 + a, G - 2, z0 + 8);
    box(x0 + 6, 1, z0 + 1, x0 + 6, G - 2, z1 - 1, M.WP_C); hole(x0 + 6, 1, z0 + 16, x0 + 6, 8, z0 + 19);
    for (let s = 0; s < n; s++) {
      const y = s ? base(s) : 1, hh = s ? 12 : G - 1;
      if (s < n - 1) stairs(x0 + 2, y, z0 + 3, 3, hh);
      if (s) flat(x0 + 5, z0, x1, z1, y, hh, [M.WP_A, M.WP_B, M.WP_C][s % 3], s);
    }
  }
  if (L >= 2) { kerb(lx, lz, o); bin(lx + 8, lz + 3); }
}

// ---- the stepped-back tower: stone piers with strips of window between them, stepping in twice on the way up as the
// old zoning law asked, under a crown ------------------------------------------------------------------------------
// o.floors 8 to 17. o.wall (the stone), o.span (the panel under each window), o.crown: 'pyramid', 'lantern', 'tank',
// 'mast' or 'twin' (two little towers, for the apartment houses by the park), o.cap (the crown's metal).
export function deco(lx, lz, L, o = {}) {
  const n = o.floors || 12, G = 16, wall = o.wall || M.LIME, span = o.span || M.DARK, capM = o.cap || M.ROOF_G;
  const yOf = (s) => (s === 0 ? 0 : G + (s - 1) * 12), f1 = Math.max(3, Math.round(n * 0.42)), f2 = Math.max(f1 + 2, Math.round(n * 0.76));
  begin(o.title || 'Office tower', 'tower');
  let T = null;
  for (const [sa, sb, inset] of [[0, f1, 0], [f1, f2, 4], [f2, n, 8]]) {
    const x0 = lx + 2 + inset, x1 = lx + 37 - inset, z0 = lz + 6 + inset, z1 = lz + 37 - inset, ya = yOf(sa), yb = yOf(sb) - 1;
    faces4(x0, z0, x1, z1).forEach((F, fi) => {
      for (let u = 0; u < F.W; u++) {
        const edge = Math.min(u, F.W - 1 - u), pier = edge < 3 || ((u - 3) & 3) >= 2;
        for (let y = ya; y <= yb; y++) {
          let m = wall;
          if (y < 2) m = M.STONE;
          else if (!pier) {
            if (y < G) m = y > G - 4 ? wall : M.GLASS;
            else { const s = 1 + Math.floor((y - G) / 12), r = (y - G) % 12; m = r < 3 ? span : r === 11 ? wall : ((s * 7 + (u >> 2) * 13 + fi * 5) % 13) === 0 ? M.LIT : M.GLASS; }
          }
          F.p(u, y, 0, m);
        }
      }
      if (L >= 1) { F.band(yb, yb, 1, M.TRIM); if (sa === 0) F.band(G - 1, G - 1, 1, M.TRIM); }
    });
    for (let s = sa; s < sb; s++) box(x0 + 1, yOf(s + 1) - 1, z0 + 1, x1 - 1, yOf(s + 1) - 1, z1 - 1, s === sb - 1 ? M.SLAB : M.CONC);
    walls(x0, yb + 1, z0, x1, yb + 2, z1, wall);
    if (L >= 1 && sb < n) for (const [a, b] of [[x0, z0], [x1 - 1, z0], [x0, z1 - 1], [x1 - 1, z1 - 1]]) box(a, yb + 3, b, a + 1, yb + 5, b + 1, M.TRIM);
    T = { x0, x1, z0, z1, y: yb + 1 };
  }
  // the crown, on the top tier's roof
  const cx = (T.x0 + T.x1 + 1) >> 1, cz = (T.z0 + T.z1 + 1) >> 1, y = T.y;
  if (o.crown === 'pyramid') { const t = spire(T.x0 + 2, T.z0 + 2, T.x1 - 2, T.z1 - 2, y, capM, 2); box(cx, t, cz, cx, t + 8, cz, M.DARK); set(cx, t + 9, cz, M.LIT_R); }
  else if (o.crown === 'lantern') { walls(T.x0 + 5, y, T.z0 + 4, T.x1 - 5, y + 9, T.z1 - 4, wall); for (let x = T.x0 + 6; x < T.x1 - 5; x += 2) { set(x, y + 4, T.z0 + 4, M.LIT); set(x, y + 5, T.z0 + 4, M.LIT); set(x, y + 4, T.z1 - 4, M.LIT); set(x, y + 5, T.z1 - 4, M.LIT); } const t = spire(T.x0 + 5, T.z0 + 4, T.x1 - 5, T.z1 - 4, y + 10, capM, 2); set(cx, t, cz, M.BRASS); }
  else if (o.crown === 'twin') { for (const a of [T.x0 + 1, T.x1 - 6]) { walls(a, y, cz - 3, a + 5, y + 13, cz + 2, wall); box(a + 1, y + 6, cz - 3, a + 4, y + 9, cz - 3, M.GLASS); const t = spire(a, cz - 3, a + 5, cz + 2, y + 14, capM, 2); set(a + 2, t, cz - 1, M.BRASS); } }
  else if (o.crown === 'mast') { walls(cx - 4, y, cz - 4, cx + 3, y + 5, cz + 3, M.DARK); box(cx - 4, y + 6, cz - 4, cx + 3, y + 6, cz + 3, M.METAL); box(cx - 1, y + 7, cz - 1, cx, y + 16, cz, M.STEEL); box(cx, y + 17, cz, cx, y + 26, cz, M.DARK); set(cx, y + 27, cz, M.LIT_R); }
  else { roofTank(cx - 3, y, cz); walls(T.x1 - 7, y, T.z1 - 7, T.x1 - 2, y + 6, T.z1 - 2, wall); box(T.x1 - 7, y + 7, T.z1 - 7, T.x1 - 2, y + 7, T.z1 - 2, M.DARK); }
  // the way in: bronze doors under a stone frame
  const Ff = face('f', lx + 2, lz + 6, lx + 37, lz + 37);
  door(Ff, 15, 6, 11, M.DARK, { glass: true, frame: M.BRASS });
  if (L >= 1) { Ff.box(12, 0, 13, 13, 1, 1, wall); Ff.box(22, 0, 23, 13, 1, 1, wall); Ff.box(12, 13, 23, 14, 1, 2, M.TRIM); }
  if (L >= 3) { box(lx + 3, 0, lz + 7, lx + 36, 0, lz + 36, M.SLAB); for (const a of [8, 18, 28]) for (const b of [12, 28]) ceilingLight(lx + a, G - 2, lz + b); }
  if (L >= 2) { planter(lx + 3, lz + 2, 8); planter(lx + 28, lz + 2, 8); lampPost(lx + 38, lz + 1); if (rnd() < 0.5) hydrant(lx + 1, lz + 2); if (o.car) car(lx + 20, lz - 15, o.car); }
}

// ---- a block of Times Square: a plain dark building whose street walls are covered in lit signs, under a sign on the roof --
// o.signs: a list of [word, background, letters]. o.sl / o.sr put signs down the left or right side too. o.ball stands
// a mast with the lit ball on the roof.
const SCREEN = [M.LIT_R, M.LIT_B, M.LIT_Y, M.LIT_G, M.LIT_P, M.LIT_W, M.DARK, M.CAR_B];
function sign(F, u0, y0, u1, y1, [word, bg, ink], screen) {
  for (let y = y0; y <= y1; y++) for (let u = u0; u <= u1; u++) {
    const rim = y === y0 || y === y1 || u === u0 || u === u1;
    F.p(u, y, 1, rim ? M.DARK : screen ? SCREEN[(((u - u0) >> 2) * 7 + ((y - y0) >> 2) * 3 + screen) % SCREEN.length] : bg);
  }
  if (screen) return;
  while (word.length > 1 && textW(word) > u1 - u0 - 1) word = word.slice(0, -1);
  const s = Math.max(1, Math.min(Math.floor((u1 - u0 - 1) / textW(word)), Math.floor((y1 - y0 - 2) / 5)));
  text(F, word, u0 + ((u1 - u0 + 1 - textW(word, s)) >> 1), y0 + ((y1 - y0 + 1 - 5 * s) >> 1), 2, ink, s);
}
export function billboard(lx, lz, L, o = {}) {
  const x0 = lx + 2, x1 = lx + 37, z0 = lz + 5, z1 = lz + 36, n = o.floors || 8, G = 16, top = G + (n - 1) * 12 - 1, signs = (o.signs || [['SHOW', M.DARK, M.LIT_Y]]).slice();
  const next = () => { const s = signs.shift(); signs.push(s); return s; };
  begin(o.title || 'Theater block', 'tower');
  const F4 = faces4(x0, z0, x1, z1), [Ff, Fr, Fb, Fl] = F4;
  F4.forEach((F, fi) => {
    for (let u = 0; u < F.W; u++) for (let y = 0; y <= top; y++) {
      const edge = Math.min(u, F.W - 1 - u), r = y < G ? -1 : (y - G) % 12;
      F.p(u, y, 0, y < 2 ? M.STONE : edge < 2 || (u & 3) < 1 || r === 11 || r < 2 ? (fi & 1 ? M.CONC : M.DARK) : y < G ? (y > G - 4 ? M.DARK : M.GLASS) : ((y * 3 + u * 5 + fi) % 17) === 0 ? M.LIT : M.GLASS);
    }
  });
  for (let s = 0; s < n; s++) box(x0 + 1, (s ? G + (s - 1) * 12 : 0) + (s ? 11 : G - 1), z0 + 1, x1 - 1, (s ? G + (s - 1) * 12 : 0) + (s ? 11 : G - 1), z1 - 1, M.CONC);
  box(x0, top, z0, x1, top, z1, M.SLAB);
  walls(x0 + 12, 0, z0 + 12, x0 + 19, top, z0 + 19, M.CONC);
  door(Ff, 15, 6, 10, M.DARK, { glass: true, frame: M.BRASS });
  // the signs: stacked up each street wall, some split in two, some of them screens of coloured light
  const cover = (F, k) => {
    let y = G + (F === Ff ? 5 : 1);
    while (y + 9 <= top) {
      const h = Math.min(top - y, [19, 13, 22, 15][k++ & 3]);
      if (h < 9) break;
      if (k % 3 === 0) { sign(F, 1, y, (F.W >> 1) - 1, y + h, next(), k); sign(F, (F.W >> 1) + 1, y, F.W - 2, y + h, next()); } else sign(F, 1, y, F.W - 2, y + h, next(), k % 5 === 0 ? k : 0);
      y += h + 2;
    }
  };
  if (L >= 1) { cover(Ff, 0); if (o.sl) cover(Fl, 1); if (o.sr) cover(Fr, 2); }
  // the marquee over the doors, edged with bulbs
  if (L >= 1) { Ff.box(6, 11, Ff.W - 7, 18, 1, 5, M.DARK); Ff.box(6, 12, Ff.W - 7, 17, 6, 6, M.TRIM); for (let u = 6; u <= Ff.W - 7; u++) { Ff.p(u, 11, 6, u & 1 ? M.LIT_Y : M.LIT_W); Ff.p(u, 18, 6, u & 1 ? M.LIT_W : M.LIT_Y); } const w = next()[0].slice(0, 5); text(Ff, w, (36 - textW(w)) >> 1, 12, 6, M.CAR_A); }
  // the roof: a sign in lights on a board, and on one block the mast with the ball
  walls(x0, top + 1, z0, x1, top + 2, z1, M.DARK);
  const w = next(), s = textW(w[0], 3) <= 32 ? 3 : textW(w[0], 2) <= 32 ? 2 : 1;
  box(x0 + 1, top + 1, z0 + 2, x1 - 1, top + 5 * s + 5, z0 + 2, M.DARK);
  for (const a of [x0 + 3, x0 + 18, x1 - 3]) for (let k = 0; k < 6; k++) box(a, top + 1, z0 + 3 + k, a, top + 5 * s + 3 - k * 2, z0 + 3 + k, M.STEEL);
  text(face('f', x0, z0 + 2, x1, z0 + 2), w[0], (36 - textW(w[0], s)) >> 1, top + 3, 1, w[2] === M.DARK ? M.LIT_Y : w[2], s);
  if (o.ball) {
    const cx = x0 + 18, cz = z0 + 20, t = top + 34;
    box(cx - 2, top + 1, cz - 2, cx + 2, top + 4, cz + 2, M.STEEL); box(cx, top + 5, cz, cx, t, cz, M.METAL);
    for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy + dz * dz <= 17) set(cx + dx, t + 4 + dy, cz + dz, ((dx + dy + dz) & 3) === 0 ? M.LIT_P : ((dx - dz) & 3) === 1 ? M.LIT_B : M.LIT_W);
  } else if (!o.notank) roofTank(x1 - 9, top + 1, z1 - 9);
  if (L >= 2) { lampPost(lx + 1, lz + 1); lampPost(lx + 38, lz + 1); if (o.car) car(lx + 12, lz - 15, o.car); }
}

// ---- a piece of park: trees, a rock or two, a lamp and benches. The grass, paths and water are painted on the ground ------
// o.v picks the piece: in the big park 4 is the terrace with the angel fountain and 7 is the lake (its middle is left clear);
// 20 and up are the Battery, with a flagpole.
export function meadow(lx, lz, L, o = {}) {
  const v = o.v || 0, lake = v === 7, clear = (a, b) => !(lake && a > 8 && a < 32 && b > 8 && b < 32);
  for (let i = 0, got = []; i < 60 && got.length < (lake ? 4 : v >= 20 ? 4 : 5); i++) {
    const a = ri(6, 32), b = ri(6, 32);
    if (!clear(a, b) || (v === 4 && Math.hypot(a - 20, b - 20) < 14) || got.some((p) => Math.abs(p[0] - a) < 14 && Math.abs(p[1] - b) < 14)) continue;
    got.push([a, b]); tree(lx + a, lz + b, ri(10, 15), ri(4, 5));
  }
  if (v === 4) {
    begin('Angel fountain', 'monument', false);
    disc(lx + 20, lz + 20, 0, 8, M.STONE); disc(lx + 20, lz + 20, 1, 8, M.STONE, 7); disc(lx + 20, lz + 20, 2, 8, M.TRIM, 7);
    box(lx + 19, 1, lz + 19, lx + 20, 9, lz + 20, M.STONE); disc(lx + 20, lz + 20, 10, 4, M.STONE); disc(lx + 20, lz + 20, 11, 4, M.TRIM, 3);
    box(lx + 19, 11, lz + 19, lx + 20, 17, lz + 20, M.ROOF_G); box(lx + 17, 15, lz + 19, lx + 22, 16, lz + 19, M.ROOF_G); box(lx + 19, 18, lz + 19, lx + 20, 19, lz + 20, M.ROOF_G);
    for (let x = -7; x < 7; x++) for (let z = -7; z < 7; z++) if ((x + 0.5) * (x + 0.5) + (z + 0.5) * (z + 0.5) < 44 && !(x >= -1 && x <= 0 && z >= -1 && z <= 0)) set(lx + 20 + x, 1, lz + 20 + z, M.WATER);
    bench(lx + 4, lz + 19); bench(lx + 29, lz + 19);
  } else if (v >= 20) {
    if (v === 21) { begin('Flagpole', 'prop', false); box(lx + 20, 0, lz + 30, lx + 20, 30, lz + 30, M.TRIM); box(lx + 21, 25, lz + 30, lx + 27, 29, lz + 30, M.CAR_A); box(lx + 21, 28, lz + 30, lx + 23, 29, lz + 30, M.CAR_B); set(lx + 20, 31, lz + 30, M.BRASS); }
    bench(lx + 6, lz + 32); bench(lx + 26, lz + 32);
  } else if (!lake && (v % 3) === 1) {
    begin('Rock', 'prop', false);
    const a = ri(10, 26), b = ri(10, 26);
    for (let dy = 0; dy < 4; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -5; dx <= 5; dx++) if (dx * dx * 0.7 + dz * dz + dy * dy * 3 <= 17) set(lx + a + dx, dy, lz + b + dz, rnd() < 0.3 ? M.CONC : M.STONE);
  }
  lampPost(lx + 3, lz + 20, 18); if (!lake) bench(lx + 14, lz + 6);
}
