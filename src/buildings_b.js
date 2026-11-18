// Apartment block, water tower, church and office tower.
import { M, set, put, clr, box, fill, hole, walls, begin, ctx } from './world.js';
import { face, faces4, win, door, gableRoof, spire, disc, text, textW, tree, lampPost, bench, bin, bollards, planter, hedge, gravestone, car, table, chair, sofa, shelf, desk, ceilingLight, plant, stairs, flat } from './kit.js';

export function apartment(lx, lz, L, o = {}) {
  const x0 = lx + 3, x1 = lx + 36, z0 = lz + 8, z1 = lz + 35, wall = o.wall || M.REND_C, n = o.floors || 5, top = n * 12 - 1;   // o.floors: 3 to 7 storeys
  begin(o.title || 'Apartment block', 'apartment');
  walls(x0, 0, z0, x1, top, z1, wall);
  for (let s = 0; s < n - 1; s++) box(x0 + 1, s * 12 + 11, z0 + 1, x1 - 1, s * 12 + 11, z1 - 1, M.CONC);
  box(x0, top, z0, x1, top, z1, M.SLAB);
  walls(x0, top + 1, z0, x1, top + 3, z1, wall);
  const [Ff, Fr, Fb, Fl] = faces4(x0, z0, x1, z1);
  if (L >= 1) for (const F of [Ff, Fr, Fb, Fl]) {
    F.box(0, 0, F.W - 1, 10, 0, 0, M.STONE);
    F.box(0, 12, 0, top - 1, 0, 0, M.TRIM); F.box(F.W - 1, 12, F.W - 1, top - 1, 0, 0, M.TRIM);
    F.band(11, 11, 1, M.TRIM); F.band(top, top, 1, M.TRIM); F.box(0, top + 3, F.W - 1, top + 3, 0, 0, M.TRIM); F.band(top + 3, top + 3, 1, M.TRIM);
  }
  const cols = [3, 11, 19, 27];
  for (let s = 1; s <= n - 1; s++) {
    const yb = s * 12;
    cols.forEach((u, c) => {
      const balc = L >= 1 && ((c === 1 && (s & 1)) || (c === 2 && !(s & 1)));
      if (!balc) { win(Ff, u, yb + 3, 5, 6); return; }
      win(Ff, u, yb + 1, 5, 8, { sill: false });
      Ff.box(u - 2, yb - 1, u + 6, yb - 1, 1, 3, M.SLAB);
      for (let uu = u - 2; uu <= u + 6; uu++) { Ff.p(uu, yb + 3, 3, M.METAL); if (!((uu - u) & 1)) Ff.box(uu, yb, uu, yb + 2, 3, 3, M.METAL); }
      for (const uu of [u - 2, u + 6]) { Ff.box(uu, yb + 3, uu, yb + 3, 1, 2, M.METAL); Ff.box(uu, yb, uu, yb + 2, 1, 1, M.METAL); }
      if (L >= 2) { Ff.p(u - 1, yb, 2, M.ROOF_R); Ff.p(u - 1, yb + 1, 2, (s & 1) ? M.FLOWER_R : M.LEAF2); }
    });
    for (const u of cols) win(Fb, u, yb + 3, 5, 6);
  }
  win(Ff, 3, 3, 7, 6); win(Ff, 24, 3, 7, 6); door(Ff, 14, 5, 9, o.door || M.DOOR_B, { glass: true });
  win(Fb, 3, 3, 5, 6); win(Fb, 27, 3, 5, 6); door(Fb, 15, 4, 9, M.DARK, { step: false });
  for (const F of [Fr, Fl]) for (let s = 0; s < n; s++) for (const u of [4, 12, 20]) win(F, u, s * 12 + 3, 4, 6);
  if (L >= 2) {
    for (let u = 12; u <= 20; u++) for (let d = 1; d <= 4; d++) Ff.p(u, 10, d, ((u >> 1) & 1) ? (o.awn || M.AWN_R) : M.AWN_W);
    Ff.p(12, 7, 1, M.LIT); Ff.p(20, 7, 1, M.LIT);
    // fire escape down the right side
    for (let s = 1; s <= n - 1; s++) {
      const y = s * 12 - 1;
      Fr.box(7, y, 21, y, 1, 3, M.METAL); Fr.box(7, y + 4, 21, y + 4, 3, 3, M.METAL);
      for (let u = 7; u <= 21; u += 2) Fr.box(u, y + 1, u, y + 3, 3, 3, M.METAL);
      for (const u of [7, 21]) Fr.box(u, y + 4, u, y + 4, 1, 2, M.METAL);
      Fr.box((s & 1) ? 9 : 19, s === 1 ? 5 : y - 11, (s & 1) ? 9 : 19, y - 1, 2, 2, M.DARK);
    }
    for (let y = 0; y <= top; y++) Fl.p(2, y, 1, M.METAL);
  }
  // roof
  const hx = x1 - 12, hz = z1 - 12;
  walls(hx, top + 1, hz, hx + 8, top + 9, hz + 8, M.BRICK2); box(hx - 1, top + 10, hz - 1, hx + 9, top + 10, hz + 9, M.SLAB);
  hole(hx + 3, top + 1, hz, hx + 5, top + 7, hz); box(hx + 3, top + 1, hz, hx + 5, top + 7, hz, M.DARK);
  const tx = x0 + 10, tz = z0 + 10;
  if (L < 1) box(tx - 3, top + 1, tz - 3, tx + 2, top + 7, tz + 2, M.TANK);
  else {
    for (const sx of [-3, 2]) for (const sz of [-3, 2]) box(tx + sx, top + 1, tz + sz, tx + sx, top + 5, tz + sz, M.METAL);
    disc(tx, tz, top + 6, 4, M.TANK); for (let y = top + 7; y <= top + 13; y++) disc(tx, tz, y, 4, y === top + 10 ? M.METAL : M.WOOD, 3);
    disc(tx, tz, top + 14, 4, M.ROOF_D); disc(tx, tz, top + 15, 2, M.ROOF_D);
    box(x0 + 20, top + 1, z0 + 5, x0 + 24, top + 3, z0 + 8, M.METAL); box(x0 + 21, top + 4, z0 + 6, x0 + 23, top + 4, z0 + 7, M.DARK);
  }
  if (L >= 2) { box(x0 + 5, top + 1, z1 - 6, x0 + 5, top + 14, z1 - 6, M.DARK); box(x0 + 3, top + 12, z1 - 6, x0 + 7, top + 12, z1 - 6, M.DARK); box(x0 + 4, top + 9, z1 - 6, x0 + 6, top + 9, z1 - 6, M.DARK); }
  if (L >= 3) {
    box(x0 + 1, 0, z0 + 1, x1 - 1, 0, z1 - 1, M.FLOOR);
    for (let s = 0; s < n; s++) {
      if (s < n - 1) stairs(x1 - 4, s ? s * 12 : 1, z0 + 2, 3, s ? 12 : 11);
      flat(x0, z0, x1 - 5, z1, s ? s * 12 : 1, s ? 12 : 11, [M.WP_A, M.WP_B, M.WP_C][s % 3], s);
    }
  }
  if (L >= 2) { lampPost(lx + 1, lz + 3); bench(lx + 6, lz + 3); bin(lx + 16, lz + 4); planter(lx + 26, lz + 4, 9); tree(lx + 34, lz - 2, 12, 5); if (o.car !== 0) car(lx + 4, lz - 15, o.car || M.CAR_B); }
}

export function watertower(lx, lz, L) {
  const cx = lx + 20, cz = lz + 22, tb = 48, R = 11;
  begin('Water tower', 'watertower');
  for (const sx of [-8, 6]) for (const sz of [-8, 6]) { box(cx + sx, 0, cz + sz, cx + sx + 1, tb - 1, cz + sz + 1, M.METAL); if (L >= 1) box(cx + sx - 1, 0, cz + sz - 1, cx + sx + 2, 1, cz + sz + 2, M.CONC); }
  for (const y of [12, 24, 36, 47]) for (const o of [-8, 7]) { box(cx - 8, y, cz + o, cx + 7, y, cz + o, M.METAL); box(cx + o, y, cz - 8, cx + o, y, cz + 7, M.METAL); }
  if (L >= 1) {
    // cross bracing, stepped so every voxel touches the next
    for (let bay = 0; bay < 4; bay++) for (let k = 0; k < 11; k++) {
      const y = bay * 12 + 1 + k, t = (bay & 1) ? 10 - k : k;
      for (const o of [-8, 7]) { box(cx - 6 + t, y, cz + o, cx - 5 + t, y, cz + o, M.METAL); box(cx + o, y, cz + 5 - t - 1, cx + o, y, cz + 5 - t, M.METAL); }
    }
    box(cx - 1, 0, cz - 1, cx, tb - 1, cz, M.TANK);
    disc(cx, cz, tb - 1, 14, M.METAL, 10.5);
    disc(cx, cz, tb + 2, 14, M.METAL, 13);
    for (let x = -14; x < 14; x++) for (let z = -14; z < 14; z++) { const d2 = (x + 0.5) * (x + 0.5) + (z + 0.5) * (z + 0.5); if (d2 <= 196 && d2 >= 169 && ((x * 3 + z * 5) % 4 === 0)) box(cx + x, tb, cz + z, cx + x, tb + 1, cz + z, M.METAL); }
  }
  disc(cx, cz, tb, R, M.TANK);
  for (let y = tb + 1; y <= tb + 18; y++) disc(cx, cz, y, R, L >= 1 && (y === tb + 3 || y === tb + 16) ? M.AWN_R : L >= 2 && (y === tb + 6 || y === tb + 14) ? M.TRIM : M.TANK, R - 1);
  disc(cx, cz, tb + 19, R, M.TANK);
  [10, 8, 6, 4, 2].forEach((r, i) => { if (L >= 1 || i % 2 === 0) disc(cx, cz, tb + 20 + (L >= 1 ? i : i / 2), r, M.ROOF_R); });
  const ty = tb + (L >= 1 ? 25 : 23);
  box(cx, ty, cz, cx, ty + 3, cz, M.METAL);
  if (L >= 2) {
    set(cx, ty + 4, cz, M.LIT_R);
    // the town's name painted round the tank, read from the street
    const str = 'CRUMBLE', n = textW(str), paint = [];
    text({ p(u, y) { paint.push([u, y]); } }, str, 0, tb + 8, 0, 0);
    for (const [u, y] of paint) { const a = (u - n / 2 + 0.5) / (R - 0.5); set(Math.floor(cx - Math.sin(a) * (R - 0.5)), y, Math.floor(cz - Math.cos(a) * (R - 0.5)), M.TRIM); }
    box(cx + 8, 0, cz + 6, cx + 8, tb + 2, cz + 6, M.DARK);
    hedge(lx + 2, lz + 2, lx + 37, lz + 3, 3); lampPost(lx + 37, lz + 6);
    begin('Valve house', 'prop', false); walls(lx + 3, 0, lz + 30, lx + 9, 6, lz + 36, M.BRICK); box(lx + 2, 7, lz + 29, lx + 10, 7, lz + 37, M.ROOF_D); box(lx + 5, 0, lz + 30, lx + 7, 4, lz + 30, M.DOOR_G);
  }
  if (L >= 3) { begin('Water', 'prop', false); for (let y = tb + 1; y <= tb + 15; y++) disc(cx, cz, y, 9, M.WATER); }
}

export function church(lx, lz, L) {
  const x0 = lx + 10, x1 = lx + 29, z0 = lz + 10, z1 = lz + 37, tx0 = lx + 14, tx1 = lx + 25, tz0 = lz + 4, tz1 = lz + 15, wh = 20, th = 52;
  begin('Church', 'church');
  walls(x0, 0, z0, x1, wh - 1, z1, M.STONE);
  gableRoof(x0, z0, x1, z1, wh, 'z', M.ROOF_S, M.STONE, 1, L >= 1 ? M.ROOF_D : 0);
  walls(tx0, 0, tz0, tx1, th, tz1, M.STONE);
  hole(tx0 + 3, 0, z0, tx1 - 3, 12, z0);
  box(tx0 + 1, 20, tz0 + 1, tx1 - 1, 20, tz1 - 1, M.WOOD); box(tx0 + 1, 38, tz0 + 1, tx1 - 1, 38, tz1 - 1, M.WOOD); box(tx0, th, tz0, tx1, th, tz1, M.STONE);
  const [Ff, Fr, Fb, Fl] = faces4(x0, z0, x1, z1), T4 = faces4(tx0, tz0, tx1, tz1), stain = [M.STAIN_R, M.STAIN_B, M.STAIN_Y];
  for (const T of T4) {
    for (let y = 40; y <= 46; y++) for (let u = 4; u <= 7; u++) T.c(u, y, 0);
    T.c(5, 47, 0); T.c(6, 47, 0);
    if (L >= 2) for (const y of [41, 43, 45]) T.box(4, y, 7, y, 0, 0, M.DARK);
    if (L >= 1) { for (let u = 0; u < 12; u++) if (!((u >> 1) & 1)) T.box(u, th + 1, u, th + 2, 0, 0, M.STONE); T.band(38, 38, 1, M.STONE); T.band(20, 20, 1, M.STONE); }
    else T.box(0, th + 1, 11, th + 1, 0, 0, M.STONE);
  }
  const sp = spire(tx0 + 1, tz0 + 1, tx1 - 1, tz1 - 1, th + 1, M.ROOF_S, 4), cm = L >= 1 ? M.BRASS : M.METAL;
  box(tx0 + 5, sp, tz0 + 5, tx0 + 6, sp + 8, tz0 + 6, cm); box(tx0 + 3, sp + 5, tz0 + 5, tx0 + 8, sp + 6, tz0 + 6, cm);
  // west front: door, rose window, clock
  const T = T4[0];
  door(T, 3, 6, 10, M.DOOR_R, { frame: M.STONE });
  if (L >= 1) { T.box(2, 11, 9, 11, 1, 1, M.TRIM); T.box(3, 12, 8, 12, 1, 1, M.TRIM); T.box(2, 0, 2, 10, 1, 1, M.TRIM); T.box(9, 0, 9, 10, 1, 1, M.TRIM); }
  for (let du = -4; du < 4; du++) for (let dy = -4; dy < 4; dy++) {
    const r2 = (du + 0.5) * (du + 0.5) + (dy + 0.5) * (dy + 0.5);
    if (r2 <= 9) T.p(6 + du, 27 + dy, 0, L >= 1 ? stain[(du < 0 ? 0 : 1) + (dy < 0 ? 1 : 0)] : M.GLASS);
    else if (r2 <= 17 && L >= 1) T.p(6 + du, 27 + dy, 0, M.TRIM);
  }
  if (L >= 1) { T.box(5, 23, 6, 30, 0, 0, M.TRIM); T.box(2, 26, 9, 27, 0, 0, M.TRIM); T.box(5, 26, 6, 27, 0, 0, M.STAIN_Y); }
  if (L >= 2) {
    for (let du = -3; du < 3; du++) for (let dy = -3; dy < 3; dy++) if ((du + 0.5) * (du + 0.5) + (dy + 0.5) * (dy + 0.5) <= 9) T.p(6 + du, 35 + dy, 0, M.TRIM);
    T.p(5, 35, 0, M.DARK); T.p(5, 36, 0, M.DARK); T.p(6, 34, 0, M.DARK); T.p(7, 34, 0, M.DARK);
  }
  // lancet windows down the nave, buttresses between them
  const lancet = (F, u, y, w, h, i) => {
    const g = L >= 1 ? stain[i % 3] : M.GLASS;
    win(F, u, y, w, h, { glass: g, bars: false });
    for (let k = 1; k < w - 1; k++) { if (L >= 1) { F.c(u + k, y + h, 0); F.p(u + k, y + h + 1, 0, M.TRIM); } else F.p(u + k, y + h, 0, g); }
  };
  [9, 15, 21].forEach((u, i) => { lancet(Fl, u, 6, 3, 9, i); lancet(Fr, 25 - u, 6, 3, 9, i + 1); });
  lancet(Fb, 7, 6, 6, 10, 2);
  if (L >= 1) {
    for (const u of [7, 13, 19, 25]) { Fl.box(u, 0, u, 12, 1, 2, M.STONE); Fl.box(u, 13, u, 16, 1, 1, M.STONE); Fr.box(27 - u, 0, 27 - u, 12, 1, 2, M.STONE); Fr.box(27 - u, 13, 27 - u, 16, 1, 1, M.STONE); }
    for (const F of [Fr, Fb, Fl]) F.band(0, 1, 1, M.STONE);
    for (const T2 of T4) T2.band(0, 1, 1, M.STONE);
  }
  if (L >= 3) {
    box(x0 + 1, 0, z0 + 1, x1 - 1, 0, z1 - 1, M.SLAB); box(tx0 + 1, 0, tz0 + 1, tx1 - 1, 0, z0, M.SLAB);
    for (let z = z0 + 8; z <= z1 - 9; z += 4) for (const [xa, xb] of [[x0 + 2, x0 + 7], [x1 - 7, x1 - 2]]) { fill(xa, 1, z, xb, 4, z, M.WOOD); fill(xa, 1, z + 1, xb, 2, z + 1, M.WOOD); }
    fill(x0 + 7, 1, z1 - 5, x1 - 7, 3, z1 - 4, M.TRIM); set(x0 + 7, 4, z1 - 5, M.LIT); set(x1 - 7, 4, z1 - 5, M.LIT); box(x0 + 9, 4, z1 - 4, x0 + 10, 7, z1 - 4, M.BRASS); box(x0 + 8, 6, z1 - 4, x0 + 11, 6, z1 - 4, M.BRASS);
    fill(x0 + 2, 1, z1 - 8, x0 + 4, 5, z1 - 6, M.WOOD);
    for (let z = z0 + 8; z <= z1 - 3; z += 7) { fill(x0 + 1, 19, z, x1 - 1, 19, z, M.WOOD); fill(x0 + 9, 18, z, x0 + 10, 18, z, M.LIT); }
    fill(tx0 + 1, 45, tz0 + 5, tx1 - 1, 45, tz0 + 6, M.WOOD); fill(tx0 + 4, 41, tz0 + 4, tx0 + 7, 44, tz0 + 7, M.BRASS);
  }
  if (L >= 2) {
    for (const [gx, gz] of [[lx + 2, lz + 14], [lx + 5, lz + 20], [lx + 2, lz + 26], [lx + 5, lz + 32], [lx + 33, lz + 20], [lx + 35, lz + 29]]) gravestone(gx, gz);
    begin('Churchyard wall', 'prop', false);
    for (const [xa, xb] of [[lx + 1, lx + 12], [lx + 27, lx + 38]]) { box(xa, 0, lz + 1, xb, 2, lz + 1, M.STONE); box(xa, 3, lz + 1, xa, 4, lz + 1, M.STONE); box(xb, 3, lz + 1, xb, 4, lz + 1, M.STONE); }
    tree(lx + 34, lz + 9, 14, 6); lampPost(lx + 8, lz + 4);
  }
}

// o.floors (5 to 9), o.name (the sign on the roof), o.glass and o.span (the glazing and the panel under each window)
export function tower(lx, lz, L, o = {}) {
  const x0 = lx + 4, x1 = lx + 35, z0 = lz + 7, z1 = lz + 38, st = o.floors || 9, g = 14, top = g + (st - 1) * 12 - 1;
  const glass = o.glass || M.GLASS, span = o.span || M.SPANDREL, name = o.name || 'BANK';
  begin(o.title || 'Office tower', 'tower');
  const base = (s) => (s === 0 ? 0 : g + (s - 1) * 12), F4 = faces4(x0, z0, x1, z1), Ff = F4[0];
  const frame = L >= 1 ? M.STEEL : M.CONC;
  for (const F of F4) {
    for (let s = 0; s < st; s++) {
      const yb = base(s), hh = s === 0 ? g : 12;
      for (let u = 0; u < 32; u++) {
        const col = u < 2 || u > 29 || u === 10 || u === 11 || u === 20 || u === 21;
        for (let r = 0; r < hh; r++) F.p(u, yb + r, 0, col ? M.STEEL : r === hh - 1 ? frame : (s > 0 && r < 3) ? (L >= 1 ? span : M.CONC) : u % 5 === 0 ? (L >= 1 ? M.STEEL : M.DARK) : glass);
      }
    }
    if (L >= 1) for (const u of [5, 10, 15, 20, 25]) F.box(u, g, u, top, 1, 1, M.STEEL);
  }
  for (let s = 0; s < st; s++) box(x0 + 1, base(s) + (s ? 11 : g - 1), z0 + 1, x1 - 1, base(s) + (s ? 11 : g - 1), z1 - 1, M.CONC);
  box(x0, top, z0, x1, top, z1, M.SLAB);
  walls(x0 + 12, 0, z0 + 12, x0 + 19, top, z0 + 19, M.CONC);
  for (let s = 0; s < st; s++) hole(x0 + 15, base(s) + (s ? 0 : 1), z0 + 12, x0 + 16, base(s) + 7, z0 + 12);
  door(Ff, 13, 6, 10, M.DARK, { glass: true, frame: M.STEEL });
  walls(x0, top + 1, z0, x1, top + 4, z1, frame);
  walls(x0 + 9, top + 1, z0 + 11, x0 + 22, top + 6, z0 + 24, L >= 1 ? span : M.CONC); box(x0 + 9, top + 7, z0 + 11, x0 + 22, top + 7, z0 + 24, M.METAL);
  box(x0 + 16, top + 8, z0 + 17, x0 + 16, L >= 1 ? top + 15 : top + 12, z0 + 17, M.DARK);
  if (L >= 1) {
    Ff.box(11, 11, 20, 11, 1, 5, M.METAL);
    set(x0 + 16, top + 16, z0 + 17, M.LIT_R);
    for (const fx of [x0 + 11, x0 + 18]) { box(fx, top + 8, z0 + 20, fx + 2, top + 8, z0 + 22, M.DARK); set(fx + 1, top + 9, z0 + 21, M.METAL); }
    for (const F of F4) F.box(0, top + 4, 31, top + 4, 0, 0, M.TRIM);
  }
  if (L >= 2) {
    Ff.box(12, 10, 19, 10, 5, 5, M.LIT_W);
    box(x0 + 1, top + 1, z0 + 1, x1 - 1, top + 16, z0 + 1, M.DARK);
    for (const sx of [x0 + 4, x0 + 15, x1 - 4]) { box(sx, top + 1, z0 + 2, sx, top + 10, z0 + 2, M.METAL); box(sx, top + 1, z0 + 3, sx, top + 5, z0 + 4, M.METAL); }
    text(face('f', x0, z0 + 1, x1, z0 + 1), name, (32 - textW(name, 2)) >> 1, top + 6, 1, o.ink || M.LIT_Y, 2);
  }
  if (L >= 3) {
    for (let x = x0 + 1; x <= x1 - 1; x++) for (let z = z0 + 1; z <= z1 - 1; z++) put(x, 0, z, (((x >> 2) + (z >> 2)) & 1) ? M.TRIM : M.SLAB);
    fill(x0 + 5, 1, z0 + 7, x0 + 10, 3, z0 + 8, M.WOOD); fill(x0 + 5, 4, z0 + 7, x0 + 6, 5, z0 + 7, M.FURN_C);
    sofa(x1 - 11, 1, z0 + 5, M.FURN_A); plant(x1 - 2, 1, z0 + 2); plant(x0 + 2, 1, z0 + 2); plant(x1 - 2, 1, z1 - 2);
    for (const cx of [x0 + 6, x0 + 16, x0 + 25]) for (const cz of [z0 + 5, z0 + 26]) ceilingLight(cx, g - 2, cz);
    for (let s = 1; s < st; s++) {
      const yb = base(s);
      for (let x = x0 + 3; x <= x1 - 8; x += 9) for (let z = z0 + 3; z <= z1 - 9; z += 8) { if (x > x0 + 5 && x < x0 + 21 && z > z0 + 4 && z < z0 + 21) continue; desk(x, yb, z); }
      for (const cx of [x0 + 5, x0 + 26]) for (const cz of [z0 + 5, z0 + 16, z0 + 26]) ceilingLight(cx, yb + 10, cz);
      ceilingLight(x0 + 15, yb + 10, z0 + 5); ceilingLight(x0 + 15, yb + 10, z0 + 26);
      plant(x0 + 2 + (s & 1) * 27, yb, z1 - 2);
    }
  }
  if (L >= 2) { planter(lx + 5, lz + 2, 9); planter(lx + 26, lz + 2, 9); bollards(lx + 10, lz - 3, 6, 4); lampPost(lx + 38, lz + 1); bench(lx + 1, lz - 5); car(lx + 20, lz - 15, M.CAR_C); }
}
