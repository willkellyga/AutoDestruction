// Cottage, shop and fuel station. Fronts face low z; the town turns each lot to face its street. L is the detail level:
// 0 plain shell, 1 weathered walls with set-back windows and trim, 2 signs and street dressing, 3 insides.
import { M, set, put, clr, box, fill, hole, walls, begin, ctx } from './world.js';
import { face, faces4, win, door, gableRoof, text, textW, tree, lampPost, bench, bin, hydrant, mailbox, planter, hedge, fence, car, table, chair, bed, sofa, shelf, ceilingLight, plant, stairs, flat } from './kit.js';

export function cottage(lx, lz, L, o = {}) {
  const x0 = lx + 6, x1 = lx + 33, z0 = lz + 12, z1 = lz + 33, wall = o.wall || M.PL_Y, roof = o.roof || M.ROOF_R, eave = 22;
  const shut = o.shutters || M.ROOF_G, doorM = o.door || M.DOOR_R, wpA = o.paper || M.WP_A;
  begin('Timber cottage', 'house');
  walls(x0, 0, z0, x1, eave - 1, z1, wall);
  box(x0 + 1, 10, z0 + 1, x1 - 1, 10, z1 - 1, M.FLOOR); box(x0 + 1, eave - 1, z0 + 1, x1 - 1, eave - 1, z1 - 1, M.FLOOR);
  const [Ff, Fr, Fb, Fl] = faces4(x0, z0, x1, z1);
  if (L >= 1) {
    for (const F of [Ff, Fr, Fb, Fl]) { F.box(0, 0, F.W - 1, 1, 0, 0, M.STONE); F.box(0, 2, 0, eave - 1, 0, 0, M.TRIM); F.box(F.W - 1, 2, F.W - 1, eave - 1, 0, 0, M.TRIM); F.box(0, 10, F.W - 1, 10, 0, 0, M.TRIM); }
    Ff.band(eave - 1, eave - 1, 1, M.TRIM); Fb.band(eave - 1, eave - 1, 1, M.TRIM);
  }
  const sh = { shutters: shut, flowers: true }, up = { shutters: shut };
  win(Ff, 3, 3, 5, 5, sh); win(Ff, 10, 3, 5, 5, sh); door(Ff, 18, 4, 8, doorM, { light: true });
  win(Ff, 3, 14, 5, 5, up); win(Ff, 11, 14, 5, 5, up); win(Ff, 20, 14, 5, 5, up);
  for (const F of [Fr, Fl]) { win(F, 3, 3, 5, 5); win(F, 13, 3, 5, 5); win(F, 3, 14, 5, 5); win(F, 13, 14, 5, 5); }
  win(Fb, 3, 3, 5, 5); win(Fb, 20, 3, 5, 5); win(Fb, 3, 14, 5, 5); win(Fb, 20, 14, 5, 5); door(Fb, 12, 3, 8, M.DOOR_G, { step: false });
  gableRoof(x0, z0, x1, z1, eave, 'x', roof, wall, 2, L >= 1 ? M.ROOF_D : 0);
  win(Fr, 9, 25, 4, 3, { bars: false }); win(Fl, 9, 25, 4, 3, { bars: false });
  box(x0 + 5, eave, z0 + 9, x0 + 7, 41, z0 + 11, M.BRICK);
  if (L >= 1) { walls(x0 + 4, 42, z0 + 8, x0 + 8, 42, z0 + 12, M.STONE); box(x0 + 6, 43, z0 + 10, x0 + 6, 44, z0 + 10, M.ROOF_R); }
  if (L >= 2) {
    // porch and a dormer
    const dx = x1 - 23;
    box(dx, 0, z0 - 4, dx + 9, 0, z0 - 1, M.WOOD);
    for (const px of [dx, dx + 9]) box(px, 1, z0 - 4, px, 9, z0 - 4, M.TRIM);
    box(dx - 1, 10, z0 - 5, dx + 10, 10, z0 - 1, roof); box(dx, 11, z0 - 3, dx + 9, 11, z0 - 1, roof);
    set(dx + 1, 9, z0 - 4, M.LIT);
    const ex = x0 + 4;
    walls(ex, 26, z0 + 2, ex + 6, 30, z0 + 8, wall);
    gableRoof(ex, z0 + 2, ex + 6, z0 + 9, 31, 'z', roof, wall, 1);
    win(face('f', ex, z0 + 2, ex + 6, z0 + 8), 2, 27, 3, 3, { bars: false });
  }
  if (L >= 3) {
    box(x0 + 1, 0, z0 + 1, x1 - 1, 0, z1 - 1, M.FLOOR);
    const px = x0 + 15;
    for (let z = z0 + 1; z <= z1 - 1; z++) for (let y = 1; y <= 9; y++) { if (z >= z0 + 5 && z <= z0 + 8 && y < 8) continue; put(px, y, z, wpA); }
    sofa(x0 + 3, 1, z1 - 4, M.FURN_A); table(x0 + 4, 1, z0 + 5); chair(x0 + 5, 1, z0 + 9); plant(x0 + 2, 1, z0 + 2);
    box(x1 - 3, 1, z0 + 2, x1 - 2, 4, z0 + 10, M.FURN_C); set(x1 - 3, 5, z0 + 4, M.METAL); shelf(px + 1, 1, z1 - 9, 7, true, 6);
    table(px + 4, 1, z0 + 12, 5, 4); chair(px + 5, 1, z0 + 9, -1); chair(px + 5, 1, z0 + 17, 1);
    ceilingLight(x0 + 7, 9, z0 + 10); ceilingLight(x1 - 7, 9, z0 + 10);
    stairs(px + 1, 1, z0 + 2, 3, 10);
    for (let z = z0 + 1; z <= z1 - 1; z++) for (let y = 11; y <= 20; y++) { if (z >= z1 - 9 && z <= z1 - 6 && y < 19) continue; put(px, y, z, M.WP_C); }
    bed(x0 + 3, 11, z1 - 11); bed(x1 - 7, 11, z1 - 11, M.FURN_B); shelf(x0 + 2, 11, z0 + 2, 6, false, 7); plant(x1 - 2, 11, z0 + 14);
    ceilingLight(x0 + 7, 20, z0 + 12); ceilingLight(x1 - 7, 20, z0 + 12);
  }
  if (L >= 2) {
    fence(lx + 1, lx + 38, lz + 2, x1 - 22, x1 - 17);
    mailbox(x1 - 15, lz + 3);
    hedge(lx + 36, lz + 6, lx + 38, lz + 36, 4);
    planter(x0 + 1, z0 - 4, 9);
  } else hedge(lx + 1, lz + 2, x1 - 23, lz + 3, 3);
  tree(lx + 3, lz + 6, 13, 6);
}

export function shop(lx, lz, L, o = {}) {
  const x0 = lx + 4, x1 = lx + 35, z0 = lz + 8, z1 = lz + 35, wall = o.wall || M.BRICK, top = 25;
  const name = o.name || 'GROCER', awn = o.awn || M.AWN_R, doorM = o.door || M.DOOR_G;
  begin(o.title || 'Corner shop', 'shop');
  walls(x0, 0, z0, x1, top, z1, wall);
  box(x0 + 1, 13, z0 + 1, x1 - 1, 13, z1 - 1, M.FLOOR); box(x0, top, z0, x1, top, z1, M.SLAB);
  walls(x0, top + 1, z0, x1, top + 3, z1, wall);
  const [Ff, Fr, Fb, Fl] = faces4(x0, z0, x1, z1), cope = L >= 1 ? M.TRIM : wall;
  // stepped front parapet
  Ff.box(6, top + 4, 25, top + 6, 0, 0, wall); Ff.box(11, top + 7, 20, top + 8, 0, 0, wall);
  Ff.box(0, top + 4, 5, top + 4, 0, 0, cope); Ff.box(26, top + 4, 31, top + 4, 0, 0, cope); Ff.box(6, top + 7, 10, top + 7, 0, 0, cope); Ff.box(21, top + 7, 25, top + 7, 0, 0, cope); Ff.box(11, top + 9, 20, top + 9, 0, 0, cope);
  if (L >= 1) {
    for (const F of [Ff, Fr, Fb, Fl]) {
      F.box(0, 0, F.W - 1, 1, 0, 0, M.STONE);
      for (let y = 2; y < top; y += 4) for (const u of [0, 1, F.W - 2, F.W - 1]) F.box(u, y, u, y + 1, 0, 0, M.TRIM);
      F.band(13, 13, 1, M.TRIM); F.band(top, top, 1, M.TRIM);
    }
    for (const F of [Fr, Fb, Fl]) F.box(0, top + 4, F.W - 1, top + 4, 0, 0, M.TRIM);
  }
  // shopfront
  Ff.box(1, 0, 30, 2, 0, 0, L >= 1 ? M.DARK : wall);
  win(Ff, 2, 3, 11, 8, { frame: M.DARK, sill: false }); win(Ff, 20, 3, 10, 8, { frame: M.DARK, sill: false });
  door(Ff, 14, 4, 10, doorM, { glass: true, frame: M.DARK });
  for (const u of [3, 13, 24]) win(Ff, u, 17, 5, 6, { lintel: L >= 1 ? M.STONE : 0 });
  for (const F of [Fr, Fl]) { win(F, 5, 4, 5, 6); win(F, 17, 4, 5, 6); win(F, 5, 17, 5, 6); win(F, 17, 17, 5, 6); }
  door(Fb, 4, 4, 9, M.DOOR_B, { step: false }); win(Fb, 14, 17, 5, 6); win(Fb, 24, 4, 4, 5);
  if (L < 2) Ff.box(3, 12, 28, 14, 0, 0, M.SIGN);
  else {
    Ff.box(2, 11, 29, 16, 1, 1, M.DARK); text(Ff, name, (32 - textW(name)) >> 1, 11, 2, o.ink || M.LIT_W);
    // striped awning, sloping out and down
    for (let u = 1; u <= 30; u++) {
      if (u >= 13 && u <= 18) continue;
      const m = ((u >> 1) & 1) ? awn : M.AWN_W;
      for (let d = 1; d <= 6; d++) { const y = 10 - ((d - 1) >> 1); Ff.p(u, y, d, m); if (d > 1 && (d & 1)) Ff.p(u, y + 1, d, m); }
      Ff.p(u, 7, 6, m);
    }
    for (let y = 0; y <= top; y++) Fl.p(1, y, 1, M.METAL);
    Ff.box(15, 28, 16, 29, 1, 1, M.LIT_Y);
  }
  // roof clutter
  box(x1 - 9, top + 1, z0 + 8, x1 - 4, top + 4, z0 + 11, M.METAL);
  if (L >= 1) {
    box(x1 - 8, top + 5, z0 + 9, x1 - 5, top + 5, z0 + 10, M.DARK);
    box(x0 + 6, top, z0 + 12, x0 + 10, top, z0 + 16, M.GLASS); walls(x0 + 5, top + 1, z0 + 11, x0 + 11, top + 1, z0 + 17, M.TRIM);
    box(x0 + 8, top + 1, z1 - 6, x0 + 8, top + 7, z1 - 6, M.DARK); set(x0 + 8, top + 8, z1 - 6, M.METAL);
  }
  if (L >= 3) {
    for (let x = x0 + 1; x <= x1 - 1; x++) for (let z = z0 + 1; z <= z1 - 1; z++) set(x, 0, z, (((x >> 1) + (z >> 1)) & 1) ? M.TRIM : M.DARK);
    shelf(x0 + 1, 1, z0 + 12, 13, true, 8); shelf(x1 - 1, 1, z0 + 12, 13, true, 8);
    for (const sx of [x0 + 9, x0 + 16, x0 + 23]) { shelf(sx, 1, z0 + 11, 9, true, 5); shelf(sx + 1, 1, z0 + 11, 9, true, 5); }
    box(x0 + 5, 1, z0 + 4, x0 + 11, 3, z0 + 5, M.WOOD); box(x0 + 6, 4, z0 + 4, x0 + 7, 5, z0 + 5, M.FURN_C); set(x0 + 10, 4, z0 + 4, M.LEAF2);
    for (const cx of [x0 + 8, x0 + 16, x0 + 24]) for (const cz of [z0 + 6, z0 + 18]) ceilingLight(cx, 12, cz);
    stairs(x1 - 4, 1, z1 - 15, 3, 13);
    flat(x0, z0, x1, z1 - 2, 14, 12, o.paper || M.WP_B, 0);
  }
  if (L >= 2) {
    begin('Produce stall', 'prop', false);
    box(x0 + 2, 0, lz + 4, x0 + 9, 2, lz + 6, M.WOOD);
    for (let x = x0 + 2; x <= x0 + 9; x++) for (let z = lz + 4; z <= lz + 6; z++) set(x, 3, z, [M.AWN_R, M.SIGN, M.LEAF2, M.FLOWER_Y][((x >> 1) + z) & 3]);
    bench(x1 - 9, lz + 4); bin(x1 - 13, lz + 5); hydrant(lx + 2, lz + 1); lampPost(lx + 38, lz + 2);
    if (o.car !== 0) car(lx + 9, lz - 15, o.car || M.CAR_A);
  }
}

export function fuel(lx, lz, L) {
  const b = begin('Fuel station', 'fuel'); b.explosive = 13;
  const x0 = lx + 3, x1 = lx + 36, z0 = lz + 2, z1 = lz + 21;
  for (const px of [lx + 7, lx + 31]) for (const pz of [lz + 5, lz + 17]) { box(px, 0, pz, px + 1, 17, pz + 1, M.METAL); if (L >= 1) box(px - 1, 0, pz - 1, px + 2, 2, pz + 2, M.STONE); }
  box(x0, 18, z0, x1, 18, z1, M.TRIM);
  walls(x0, 19, z0, x1, 25, z1, M.AWN_R);
  box(x0 + 1, 22, z0 + 1, x1 - 1, 22, z1 - 1, M.METAL);
  const Ff = face('f', x0, z0, x1, z1), Fr = face('r', x0, z0, x1, z1), Fb = face('b', x0, z0, x1, z1), Fl = face('l', x0, z0, x1, z1);
  if (L >= 1) for (const F of [Ff, Fr, Fb, Fl]) { F.box(0, 19, F.W - 1, 19, 0, 0, M.TRIM); F.box(0, 25, F.W - 1, 25, 0, 0, M.TRIM); }
  if (L >= 2) {
    text(Ff, 'FUEL', (34 - textW('FUEL')) >> 1, 20, 0, M.LIT_W); text(Fb, 'FUEL', (34 - textW('FUEL')) >> 1, 20, 0, M.LIT_W);
    for (const cx of [x0 + 6, x0 + 16, x0 + 26]) for (const cz of [z0 + 4, z0 + 14]) box(cx, 18, cz, cx + 1, 18, cz + 1, M.LIT);
  }
  for (const px of [lx + 13, lx + 24]) {
    box(px - 1, 0, lz + 7, px + 2, 0, lz + 15, M.STONE);
    for (const pz of [lz + 8, lz + 13]) {
      box(px, 1, pz, px + 1, 6, pz + 1, M.FUEL); box(px, 7, pz, px + 1, 7, pz + 1, M.TRIM);
      if (L >= 1) { set(px, 5, pz - 1, M.LIT_W); set(px + 1, 5, pz - 1, M.LIT_W); box(px - 1, 2, pz, px - 1, 5, pz, M.DARK); set(px - 1, 2, pz + 1, M.METAL); box(px, 4, pz, px + 1, 4, pz + 1, M.DARK); }
    }
  }
  // kiosk
  const kx0 = lx + 8, kx1 = lx + 31, kz0 = lz + 26, kz1 = lz + 37;
  begin('Fuel kiosk', 'shop');
  walls(kx0, 0, kz0, kx1, 12, kz1, M.TRIM);
  box(kx0 - 1, 13, kz0 - 1, kx1 + 1, 13, kz1 + 1, M.ROOF_D); walls(kx0 - 1, 14, kz0 - 1, kx1 + 1, 14, kz1 + 1, M.AWN_R);
  const K4 = faces4(kx0, kz0, kx1, kz1);
  if (L >= 1) for (const F of K4) { F.box(0, 0, F.W - 1, 1, 0, 0, M.CAR_B); F.box(0, 11, F.W - 1, 12, 0, 0, M.CAR_B); }
  win(K4[0], 2, 3, 7, 7, { frame: M.DARK, sill: false }); door(K4[0], 11, 4, 9, M.DARK, { glass: true, frame: M.DARK }); win(K4[0], 17, 3, 5, 7, { frame: M.DARK, sill: false });
  win(K4[1], 3, 4, 5, 5, { frame: M.DARK }); win(K4[3], 3, 4, 5, 5, { frame: M.DARK }); door(K4[2], 4, 3, 8, M.DARK, { step: false });
  if (L >= 2) {
    box(kx0 + 1, 15, kz0, kx1 - 1, 21, kz0, M.DARK); box(kx0 + 3, 15, kz0 + 1, kx0 + 3, 18, kz0 + 2, M.METAL); box(kx1 - 3, 15, kz0 + 1, kx1 - 3, 18, kz0 + 2, M.METAL);
    text(K4[0], 'SNACKS', (24 - textW('SNACKS')) >> 1, 16, 1, M.LIT_Y);
    box(kx1 - 4, 14, kz1 - 5, kx1 - 1, 16, kz1 - 2, M.METAL);
  }
  if (L >= 3) {
    box(kx0 + 1, 0, kz0 + 1, kx1 - 1, 0, kz1 - 1, M.FURN_C);
    shelf(kx0 + 1, 1, kz0 + 3, 7, true, 7); shelf(kx1 - 1, 1, kz0 + 3, 7, true, 7); shelf(kx0 + 6, 1, kz1 - 1, 12, false, 7);
    box(kx0 + 8, 1, kz0 + 5, kx0 + 14, 3, kz0 + 6, M.WOOD); set(kx0 + 9, 4, kz0 + 5, M.FURN_C);
    ceilingLight(kx0 + 6, 12, kz0 + 5); ceilingLight(kx1 - 7, 12, kz0 + 5);
  }
  if (L >= 2) {
    begin('Price sign', 'prop', true);
    box(lx + 5, 0, lz - 2, lx + 6, 13, lz - 2, M.METAL); box(lx, 14, lz - 2, lx + 12, 26, lz - 2, M.SIGN);
    const Fs = face('f', lx, lz - 2, lx + 12, lz - 2);
    text(Fs, '159', 1, 20, 1, M.LIT_W); text(Fs, '172', 1, 14, 1, M.LIT_W);
    const p = begin('Propane cage', 'prop', false); p.explosive = 9;
    walls(lx + 33, 0, lz + 27, lx + 38, 0, lz + 32, M.METAL);
    for (const cx of [lx + 33, lx + 38]) for (const cz of [lz + 27, lz + 32]) box(cx, 1, cz, cx, 6, cz, M.METAL);
    walls(lx + 33, 7, lz + 27, lx + 38, 7, lz + 32, M.METAL); walls(lx + 33, 4, lz + 27, lx + 38, 4, lz + 32, M.METAL);
    for (const cx of [lx + 34, lx + 36]) for (const cz of [lz + 28, lz + 30]) { box(cx, 0, cz, cx + 1, 3, cz + 1, M.FUEL); set(cx, 4, cz, M.BRASS); }
    begin('Tyre stack', 'prop', false); box(lx + 2, 0, lz + 30, lx + 4, 5, lz + 32, M.TYRE); box(lx + 3, 0, lz + 31, lx + 3, 5, lz + 31, M.DARK);
    car(lx + 11, lz + 16, M.CAR_C);
    lampPost(lx + 1, lz + 22, 22);
  }
}
