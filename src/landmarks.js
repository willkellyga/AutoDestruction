// Landmarks and more kinds of building: the Sky Needle, the stadium (a lot four times the usual size), a factory with a
// smokestack, a cinema and a terrace of row houses. All our own designs. Drawn like the other kits: round a local origin
// with the front toward low z, and turned to face the street by place().
import { M, set, put, box, hole, walls, begin } from './world.js';
import { face, faces4, win, door, gableRoof, disc, text, textW, tree, lampPost, bench, bin, bollards, planter, car, ceilingLight, table, chair, sofa, bed } from './kit.js';

// ---- the Sky Needle: an observation tower on four legs that pinch to a waist and flare out under a saucer ------------
export function needle(lx, lz, L, o = {}) {
  // o.scale stretches the height (the saucer keeps its size): 1 is 127 voxels to the tip, 1.7 is 214
  const cx = lx + 20, cz = lz + 20, K = o.scale || 1, SAUCER = Math.round(94 * K), WAIST = Math.round(60 * K), TIP = Math.round(126 * K);
  begin(o.title || 'Sky Needle', 'landmark');
  // how far each leg stands from the middle at height y
  const legR = (y) => (y <= WAIST ? Math.round(4 + 10 * Math.pow(1 - y / WAIST, 1.5)) : Math.round(4 + 4 * Math.pow((y - WAIST) / (SAUCER - WAIST), 1.3)));
  for (let y = 0; y < SAUCER; y++) {
    const r = legR(y);
    for (const px of [cx - 1 - r, cx + r - 1]) for (const pz of [cz - 1 - r, cz + r - 1]) box(px, y, pz, px + 1, y, pz + 1, M.TRIM);
  }
  // the lift shaft up the middle, lit in a strip
  walls(cx - 2, 0, cz - 2, cx + 1, SAUCER, cz + 1, M.STEEL);
  for (let y = 9; y < SAUCER - 4; y++) { set(cx - 1, y, cz - 2, y % 6 < 4 ? M.GLASS : M.STEEL); set(cx, y, cz - 2, y % 6 < 4 ? M.LIT_W : M.STEEL); }
  // rings and struts that tie the legs to the shaft
  for (const y of K === 1 ? [18, 40, WAIST, 78] : [Math.round(18 * K), Math.round(40 * K), WAIST, Math.round(78 * K), Math.round(30 * K - 9), Math.round(69 * K)]) {
    const r = legR(y), h = y === WAIST ? 1 : 0;
    walls(cx - 1 - r, y, cz - 1 - r, cx + r, y + h, cz + r, M.TRIM);
    box(cx - 1 - r, y, cz - 1, cx + r, y, cz, M.TRIM); box(cx - 1, y, cz - 1 - r, cx, y, cz + r, M.TRIM);
  }
  disc(cx, cz, WAIST + 2, 8, M.TRIM, 6);
  // the saucer: a dish that widens to the deck, a ring of glass, and a roof that steps in to the mast
  [6, 8, 10, 12].forEach((r, i) => disc(cx, cz, SAUCER - 4 + i, r, M.TRIM));
  disc(cx, cz, SAUCER, 14, M.SLAB);
  disc(cx, cz, SAUCER + 1, 14, M.TRIM, 13);
  for (let y = SAUCER + 2; y <= SAUCER + 4; y++) disc(cx, cz, y, 14, M.GLASS, 13);
  walls(cx - 2, SAUCER + 1, cz - 2, cx + 1, SAUCER + 4, cz + 1, M.STEEL);
  disc(cx, cz, SAUCER + 5, 15, M.TRIM);
  [[13, M.ROOF_G], [10, M.ROOF_G], [7, M.ROOF_G], [4, M.TRIM]].forEach(([r, m], i) => disc(cx, cz, SAUCER + 6 + i, r, m));
  for (let a = 0; a < 16; a++) { const x = Math.round(Math.cos(a * 0.3927) * 11.5 - 0.5), z = Math.round(Math.sin(a * 0.3927) * 11.5 - 0.5); set(cx + x, SAUCER - 1, cz + z, M.LIT_W); }
  if (L >= 3) { for (const [dx, dz] of [[-9, -1], [7, -1], [-1, -9], [-1, 7]]) { table(cx + dx, SAUCER + 1, cz + dz, 3, 3); } for (const [dx, dz] of [[-6, -6], [5, 5], [-6, 5], [5, -6]]) ceilingLight(cx + dx, SAUCER + 4, cz + dz); }
  box(cx - 1, SAUCER + 10, cz - 1, cx, SAUCER + 19, cz, M.METAL);
  box(cx - 1, SAUCER + 20, cz - 1, cx - 1, TIP - 1, cz - 1, M.DARK); set(cx - 1, TIP, cz - 1, M.LIT_R);
  // a glass pavilion round the foot of the shaft
  walls(cx - 6, 0, cz - 6, cx + 5, 6, cz + 5, M.GLASS);
  for (const px of [cx - 6, cx + 5]) for (const pz of [cz - 6, cz + 5]) box(px, 0, pz, px, 6, pz, M.STEEL);
  box(cx - 7, 7, cz - 7, cx + 6, 7, cz + 6, M.TRIM); hole(cx - 1, 0, cz - 6, cx, 5, cz - 6);
  if (L >= 2) {
    planter(lx + 2, lz + 1, 9); planter(lx + 29, lz + 1, 9); bench(lx + 12, lz + 2); bench(lx + 21, lz + 2); bin(lx + 19, lz + 5);
    lampPost(lx + 1, lz + 37, 18); lampPost(lx + 38, lz + 37, 18); tree(lx + 19, lz + 36, 9, 4);
    bollards(lx + 8, lz - 2, 7, 4);
  }
}

// ---- the stadium: an oval bowl of stepped stands inside a wall of arches, a ring of roof, floodlights and a scoreboard ----
// It fills a lot 86 voxels square (two lots and the gap between them, each way). The pitch is painted on the ground.
export const STADIUM = { S: 86, A: 41, B: 37, IN: 0.56 };
export function stadium(lx, lz, L, o = {}) {
  const { S, A, B, IN } = STADIUM, cx = lx + S / 2, cz = lz + S / 2, TOP = 30, TAU = Math.PI * 2;
  begin(o.title || 'Stadium', 'stadium');
  const seats = o.seats || [M.CAR_A, M.TRIM, M.CAR_B, M.TRIM];
  for (let dz = -B - 1; dz <= B; dz++) for (let dx = -A - 1; dx <= A; dx++) {
    const ux = (dx + 0.5) / A, uz = (dz + 0.5) / B, rho = Math.hypot(ux, uz);
    if (rho < IN || rho > 1) continue;
    const x = cx + dx, z = cz + dz, turn = (Math.atan2(uz, ux) + Math.PI) / TAU;
    const tunnel = Math.abs(dz + 0.5) < 3 || Math.abs(dx + 0.5) < 3;      // a way in at each end and each side
    const openEnd = ux > 0.5 && Math.abs(uz) < 0.3;                        // the roof stops short at the scoreboard end
    if (rho > 0.955) {
      // the outer wall: white piers with two tiers of arches between them, a band every storey and a rim in the home colour
      const k = (turn * 28 + 0.5) % 1, arch = tunnel || k < 0.5, edge = !tunnel && (k < 0.08 || k > 0.42);
      for (let y = 0; y <= TOP + 3; y++) {
        if (arch && (y < (tunnel ? 10 : 8 - (edge ? 2 : 0)) || (y > 12 && y < 21 - (edge ? 2 : 0)))) continue;
        set(x, y, z, y > TOP ? seats[0] : y === 11 || y === 22 || y === TOP ? M.TRIM : arch ? M.REND_C : M.TRIM);
      }
    } else {
      const h = 3 + Math.floor((rho - IN) / (0.955 - IN) * (TOP - 4) / 2) * 2;   // rows of seats, two voxels a row
      if (!(tunnel && h < 11)) {
        const aisle = (turn * 16 + 0.04) % 1 < 0.08;
        set(x, h, z, aisle ? M.SLAB : seats[Math.floor(turn * 16) & 3]); set(x, h - 1, z, M.CONC); set(x, h - 2, z, M.CONC);
        if ((turn * 28) % 1 < 0.1 && !tunnel) for (let y = 0; y < h - 2; y++) set(x, y, z, M.CONC);   // the ribs that carry the stands
        else if (h === 3) { set(x, 0, z, M.CONC); set(x, 1, z, M.CONC); }                            // the front rows sit on the ground
      }
    }
    if (rho > 0.87 && !openEnd) set(x, TOP + 4, z, rho < 0.9 ? seats[0] : M.TRIM);                   // a narrow ring of roof over the back rows
  }
  // the scoreboard, on two posts at one end, facing down the pitch
  begin('Scoreboard', 'prop', true);
  const bx = cx + A - 5;
  for (const pz of [cz - 12, cz + 11]) box(bx, 0, pz, bx + 1, TOP + 8, pz + 1, M.STEEL);
  box(bx, TOP + 9, cz - 14, bx + 1, TOP + 22, cz + 13, M.DARK);
  if (L >= 2) { const F = face('l', bx, cz - 14, bx, cz + 13); text(F, o.home || 'HOME 3', 2, TOP + 16, 1, M.LIT_Y); text(F, o.away || 'AWAY 0', 2, TOP + 10, 1, M.LIT_W); }
  // goals
  for (const s of [-1, 1]) { begin('Goal', 'prop', false); const gx = cx + s * 18 - (s < 0 ? 1 : 0); for (const gz of [cz - 4, cz + 3]) box(gx, 0, gz, gx, 5, gz, M.TRIM); box(gx, 5, cz - 4, gx, 5, cz + 3, M.TRIM); box(gx + s, 4, cz - 4, gx + s * 2, 4, cz + 3, M.TRIM); }
  // floodlights in the four corners, turned in toward the pitch
  for (const sx of [0, 1]) for (const sz of [0, 1]) {
    begin('Floodlight', 'prop', true);
    const px = lx + (sx ? S - 5 : 3), pz = lz + (sz ? S - 5 : 3), dz = sz ? -1 : 1;
    box(px, 0, pz, px + 1, 50, pz + 1, M.STEEL); box(px - 1, 0, pz - 1, px + 2, 1, pz + 2, M.STONE);
    box(px - 4, 51, pz, px + 5, 58, pz + 1, M.DARK);
    for (let y = 52; y <= 57; y += 2) for (let x = px - 3; x <= px + 4; x += 2) { set(x, y, pz + (dz > 0 ? 2 : -1), M.LIT_W); set(x + 1, y, pz + (dz > 0 ? 2 : -1), M.LIT_W); }
  }
  if (L >= 2) {
    begin('Ticket booth', 'prop', true); walls(lx + 12, 0, lz + 1, lx + 19, 7, lz + 6, M.CAR_A); box(lx + 11, 8, lz, lx + 20, 8, lz + 7, M.TRIM); box(lx + 14, 3, lz + 1, lx + 17, 5, lz + 1, M.GLASS);
    bin(lx + 22, lz + 2); bin(lx + S - 24, lz + 2); bench(lx + 26, lz + 1); bench(lx + S - 34, lz + 1);
    for (const a of [9, S - 11]) for (const b of [22, S - 24]) lampPost(lx + a, lz + (b < 40 ? 1 : S - 2), 18);
  }
}

// ---- a factory: a brick shed under a saw-tooth roof with north lights, a roller door, and a banded smokestack ----------
export function factory(lx, lz, L, o = {}) {
  const x0 = lx + 3, x1 = lx + 36, z0 = lz + 11, z1 = lz + 36, wall = o.wall || M.BRICK, eave = 19, name = o.name || 'WORKS';
  begin(o.title || 'Factory', 'factory');
  walls(x0, 0, z0, x1, eave, z1, wall);
  for (let x = x0; x <= x1; x++) {
    const k = (x - x0) % 11, h = eave + 8 - Math.floor(k * 8 / 10);        // each tooth drops from its glass face to the next
    for (let z = z0; z <= z1; z++) {
      set(x, h, z, M.ROOF_D);
      if (k === 0) for (let y = eave + 1; y < h; y++) set(x, y, z, z === z0 || z === z1 ? wall : (z - z0) % 5 === 0 ? M.STEEL : M.GLASS);
    }
    for (let y = eave + 1; y < h; y++) { set(x, y, z0, wall); set(x, y, z1, wall); }
  }
  const [Ff, Fr, Fb, Fl] = faces4(x0, z0, x1, z1);
  if (L >= 1) for (const F of [Ff, Fr, Fb, Fl]) { F.box(0, 0, F.W - 1, 1, 0, 0, M.STONE); F.band(eave, eave, 1, M.TRIM); }
  // roller door, a side door and a strip of high windows
  for (let u = 4; u <= 14; u++) for (let y = 0; y <= 12; y++) Ff.p(u, y, 0, y === 12 || u === 4 || u === 14 ? M.STEEL : y % 2 ? M.METAL : M.STEEL);
  door(Ff, 26, 4, 9, o.door || M.DOOR_G, { light: true });
  for (const F of [Fr, Fl]) for (const u of [3, 10, 17]) win(F, u, 9, 4, 7, { frame: M.DARK });
  for (const u of [4, 12, 20, 28]) win(Fb, u, 9, 4, 7, { frame: M.DARK });
  if (L >= 2) { Ff.box(15, 12, 33, 18, 1, 1, M.DARK); text(Ff, name, 15 + ((19 - textW(name)) >> 1), 13, 2, M.LIT_Y); for (let y = 0; y <= eave; y++) Fl.p(2, y, 1, M.METAL); }
  else for (const u of [18, 24, 30]) win(Ff, u, 12, 3, 5, { frame: M.DARK, sill: false });
  if (L >= 3) {
    for (let x = x0 + 1; x <= x1 - 1; x++) for (let z = z0 + 1; z <= z1 - 1; z++) set(x, 0, z, (((x >> 2) + (z >> 2)) & 1) ? M.SLAB : M.CONC);
    // machines, a conveyor and stacked crates
    for (const [mx, mz] of [[x0 + 20, z0 + 5], [x0 + 20, z0 + 15], [x0 + 28, z0 + 10]]) { box(mx, 1, mz, mx + 4, 5, mz + 4, M.STEEL); box(mx + 1, 6, mz + 1, mx + 3, 8, mz + 3, M.METAL); set(mx, 4, mz, M.LIT_R); set(mx + 4, 4, mz, M.LIT_B); box(mx + 2, 9, mz + 2, mx + 2, 13, mz + 2, M.DARK); }
    box(x0 + 3, 3, z0 + 16, x0 + 16, 3, z0 + 18, M.DARK); for (const px of [x0 + 3, x0 + 9, x0 + 16]) box(px, 1, z0 + 16, px, 2, z0 + 18, M.METAL);
    for (const [bx, bz, h] of [[x0 + 3, z0 + 22, 6], [x0 + 6, z0 + 22, 3], [x0 + 3, z0 + 19, 3], [x1 - 5, z1 - 4, 6], [x1 - 8, z1 - 4, 3]]) box(bx, 1, bz, bx + 2, h, bz + 2, M.WOOD);
    for (const cx of [x0 + 6, x0 + 17, x0 + 28]) for (const cz of [z0 + 6, z0 + 19]) ceilingLight(cx, eave - 1, cz);
  }
  // the smokestack, out in the yard
  begin('Smokestack', 'chimney', true);
  const sx = lx + 6, sz = lz + 5, H = 70;
  for (let y = 0; y <= H; y++) { const r = y < 6 ? 4 : 3, top = y > H - 14; disc(sx, sz, y, r, y === H ? M.DARK : top ? (((H - y) / 4) & 1 ? M.TRIM : M.CAR_A) : (y % 12 === 11 ? M.STEEL : M.BRICK2), y < 2 ? -1 : r - 1); }
  for (let y = 2; y < H; y += 2) set(sx + 3, y, sz - 1, M.DARK);
  if (L >= 2) {
    begin('Pallets', 'prop', false); box(lx + 30, 0, lz + 3, lx + 35, 0, lz + 7, M.WOOD); box(lx + 30, 1, lz + 3, lx + 32, 3, lz + 5, M.WOOD); box(lx + 33, 1, lz + 5, lx + 35, 2, lz + 7, M.CAR_B);
    begin('Skip', 'prop', false); walls(lx + 13, 0, lz + 2, lx + 21, 4, lz + 6, M.CAR_C); box(lx + 14, 0, lz + 3, lx + 20, 2, lz + 5, M.DARK);
    lampPost(lx + 38, lz + 1, 18); bin(lx + 24, lz + 8);
    if (o.car !== 0) car(lx + 20, lz - 15, o.car || M.CAR_B);
  }
}

// ---- a cinema: a tall plain box with a stepped front, a lit marquee and a row of posters ------------------------------
export function cinema(lx, lz, L, o = {}) {
  const x0 = lx + 4, x1 = lx + 35, z0 = lz + 8, z1 = lz + 36, wall = o.wall || M.REND_C, top = 31, name = o.name || 'ROXY', ink = o.ink || M.LIT_R;
  begin(o.title || 'Cinema', 'cinema');
  walls(x0, 0, z0, x1, top, z1, wall); box(x0, top, z0, x1, top, z1, M.SLAB);
  walls(x0, top + 1, z0, x1, top + 2, z1, wall);
  const [Ff, Fr, Fb, Fl] = faces4(x0, z0, x1, z1), trim = o.trim || M.AWN_R;
  // the stepped front with a fin up the middle
  Ff.box(5, top + 3, 26, top + 5, 0, 0, wall); Ff.box(10, top + 6, 21, top + 8, 0, 0, wall); Ff.box(14, top + 9, 17, top + 14, 0, 1, trim);
  if (L >= 1) {
    for (const F of [Ff, Fr, Fb, Fl]) { F.box(0, 0, F.W - 1, 1, 0, 0, M.DARK); F.band(top, top, 1, M.TRIM); }
    for (const u of [0, 1, 30, 31]) Ff.box(u, 2, u, top + 2, 1, 1, trim);
    Ff.box(5, top + 6, 9, top + 6, 0, 0, M.TRIM); Ff.box(22, top + 6, 26, top + 6, 0, 0, M.TRIM); Ff.box(10, top + 9, 13, top + 9, 0, 0, M.TRIM); Ff.box(18, top + 9, 21, top + 9, 0, 0, M.TRIM);
  }
  // doors and posters
  door(Ff, 9, 5, 9, M.DARK, { glass: true, frame: M.BRASS }); door(Ff, 18, 5, 9, M.DARK, { glass: true, frame: M.BRASS });
  [[3, M.SIGN, M.CAR_B], [25, M.AWN_G, M.FLOWER_Y]].forEach(([u, a, b]) => { Ff.box(u - 1, 2, u + 4, 9, 0, 0, M.DARK); Ff.box(u, 3, u + 3, 8, 0, 0, a); Ff.box(u + 1, 4, u + 2, 6, 0, 0, b); });
  door(Fb, 4, 4, 9, M.DARK, { step: false }); door(Fb, 24, 4, 9, M.DARK, { step: false });
  if (L >= 2) {
    // the marquee: a canopy edged with bulbs, and the name on a dark board above it
    Ff.box(3, 11, 28, 12, 1, 7, M.TRIM); for (let u = 3; u <= 28; u++) { Ff.p(u, 11, 8, (u & 1) ? M.LIT_Y : M.DARK); Ff.p(u, 12, 8, trim); }
    for (let d = 1; d <= 7; d++) { Ff.p(2, 11, d, (d & 1) ? M.LIT_Y : M.DARK); Ff.p(29, 11, d, (d & 1) ? M.LIT_Y : M.DARK); }
    Ff.box(4, 14, 27, 26, 1, 1, M.DARK); text(Ff, name, (32 - textW(name, 2)) >> 1, 15, 2, ink, 2);
    for (let u = 4; u <= 27; u += 2) { Ff.p(u, 14, 2, M.LIT_Y); Ff.p(u + 1, 26, 2, M.LIT_Y); }
    for (let y = top + 9; y <= top + 14; y += 2) Ff.p(15, y, 2, M.LIT_Y);
    for (let y = 0; y <= top; y++) Fl.p(2, y, 1, M.METAL);
  }
  box(x1 - 10, top + 1, z1 - 9, x1 - 4, top + 4, z1 - 4, M.METAL);
  if (L >= 3) {
    // the lobby floor, then the hall: raked rows of seats facing a lit screen
    for (let x = x0 + 1; x <= x1 - 1; x++) for (let z = z0 + 1; z <= z1 - 1; z++) set(x, 0, z, z < z0 + 6 ? ((((x >> 1) + (z >> 1)) & 1) ? M.TRIM : M.AWN_R) : M.DARK);
    box(x0 + 1, 1, z0 + 6, x1 - 1, 10, z0 + 6, wall); hole(x0 + 14, 1, z0 + 6, x0 + 17, 8, z0 + 6);
    box(x0 + 3, 1, z0 + 2, x0 + 8, 3, z0 + 3, M.WOOD); set(x0 + 4, 4, z0 + 2, M.SIGN); set(x0 + 6, 4, z0 + 2, M.AWN_R);
    for (let r = 0; r < 6; r++) { const z = z0 + 9 + r * 3; for (let x = x0 + 3; x <= x1 - 3; x++) { if (x === x0 + 15 || x === x0 + 16) continue; put(x, 1, z, M.FURN_A); put(x, 1, z - 1, M.FURN_A); put(x, 2, z - 1, M.FURN_A); put(x, 3, z - 1, M.FURN_A); } }
    box(x0 + 4, 6, z1 - 1, x1 - 4, 22, z1 - 1, M.LIT_W); box(x0 + 3, 5, z1 - 1, x1 - 3, 5, z1 - 1, M.DARK);
    for (const cx of [x0 + 6, x0 + 25]) ceilingLight(cx, 9, z0 + 3);
  }
  if (L >= 2) { bollards(lx + 6, lz - 2, 8, 4); lampPost(lx + 1, lz + 2); lampPost(lx + 38, lz + 2); bin(lx + 3, lz + 5); if (o.car !== 0) car(lx + 12, lz - 15, o.car || M.CAR_A); }
}

// ---- row houses: three narrow two-storey houses in a terrace under one roof, each its own colour ------------------------
export function rowhouse(lx, lz, L, o = {}) {
  const x0 = lx + 2, x1 = lx + 37, z0 = lz + 11, z1 = lz + 33, eave = 25;
  const cols = o.walls || [M.BRICK, M.REND_T, M.BRICK2], doors = o.doors || [M.DOOR_G, M.DOOR_R, M.DOOR_B], roof = o.roof || M.ROOF_S;
  begin(o.title || 'Row houses', 'house');
  for (let i = 0; i < 3; i++) {
    const a = x0 + i * 12, b = a + 11, wall = cols[i];
    walls(a, 0, z0, b, eave, z1, wall);
    box(a + 1, 12, z0 + 1, b - 1, 12, z1 - 1, M.FLOOR);
    const F = face('f', a, z0, b, z1), Fb = face('b', a, z0, b, z1);
    if (L >= 1) { F.box(0, 0, 11, 1, 0, 0, M.STONE); F.box(0, eave, 11, eave, 1, 1, M.TRIM); F.box(0, 13, 11, 13, 0, 0, M.TRIM); }
    door(F, 7, 3, 9, doors[i], { light: true }); win(F, 2, 3, 3, 6, { flowers: i !== 1, lintel: L >= 1 ? M.STONE : 0 });
    win(F, 2, 16, 3, 6, { shutters: i === 1 ? M.DOOR_B : 0 }); win(F, 7, 16, 3, 6, { shutters: i === 1 ? M.DOOR_B : 0 });
    door(Fb, 2, 3, 8, M.DARK, { step: false }); win(Fb, 7, 3, 3, 5); win(Fb, 2, 16, 3, 5); win(Fb, 7, 16, 3, 5);
    if (L >= 2) { F.box(6, 0, 10, 1, 1, 4, M.STONE); F.box(6, 0, 10, 0, 5, 6, M.STONE); F.p(6, 9, 1, M.LIT); for (let y = 2; y <= 4; y++) { F.p(5, y, 4, M.METAL); F.p(11, y, 4, M.METAL); } }
    if (L >= 3) {
      box(a + 1, 0, z0 + 1, b - 1, 0, z1 - 1, M.FLOOR);
      const wp = [M.WP_A, M.WP_B, M.WP_C][i];
      for (let y = 1; y <= eave - 1; y++) if (y !== 12) { for (let z = z0 + 1; z <= z1 - 1; z++) { put(a + 1, y, z, wp); put(b - 1, y, z, wp); } }
      sofa(a + 2, 1, z0 + 9, i === 1 ? M.FURN_A : M.FURN_B); table(a + 3, 1, z1 - 7, 5, 3); chair(a + 4, 1, z1 - 9, 1);
      bed(a + 3, 13, z0 + 8, i === 1 ? M.FURN_B : M.FURN_A); ceilingLight(a + 5, 11, z0 + 10); ceilingLight(a + 5, eave - 1, z0 + 10);
    }
  }
  gableRoof(x0, z0, x1, z1, eave + 1, 'x', roof, M.BRICK, 1, M.DARK);
  for (let i = 0; i < 3; i++) { const cxm = x0 + i * 12 + 9; box(cxm, eave + 2, z0 + 6, cxm + 2, eave + 13, z0 + 8, M.BRICK); box(cxm, eave + 14, z0 + 6, cxm + 2, eave + 14, z0 + 8, M.DARK);  }
  if (L >= 2) {
    begin('Railings', 'prop', false);
    for (let x = lx + 1; x <= lx + 38; x++) { const k = (x - x0 + 12) % 12; if (x >= x0 && x <= x1 && k >= 1 && k <= 5) continue; set(x, 3, lz + 4, M.DARK); if ((x & 1) === 0) box(x, 0, lz + 4, x, 2, lz + 4, M.DARK); }
    bin(lx + 10, lz + 7); bin(lx + 22, lz + 7); bin(lx + 34, lz + 7); tree(lx + 5, lz + 1, 9, 4); lampPost(lx + 38, lz + 1);
    if (o.car !== 0) car(lx + 14, lz - 15, o.car || M.CAR_C);
  }
}
