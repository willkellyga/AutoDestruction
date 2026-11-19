// Lots for the bigger map's districts: a car park (a cluster of cars that set each other off), a fuel depot (tanks that
// blow up in a chain) and a plaza with a clock tower (the open square in the middle of town). Drawn like the other kits:
// round a local origin, front toward low z, and turned to face the street by place().
import { M, set, box, walls, begin, rnd, ri } from './world.js';
import { disc, tree, lampPost, bench, bin, planter, car, text, textW, face } from './kit.js';

const PAINT = [M.CAR_A, M.CAR_B, M.CAR_C];

// A car park: four rows of two bays, most of them taken, a pay booth by the entrance and lamps down the middle.
// The ground paints the asphalt and the bay lines (ground.js).
export function carpark(lx, lz, L, o = {}) {
  const full = o.full || 0.8;
  for (const b of [4, 13, 22, 31]) for (const a of [2, 21]) if (rnd() < full) car(lx + a + ri(0, 1), lz + b, PAINT[ri(0, 2)]).bay = true;   // a marked bay: the shorter car fits it
  begin('Pay booth', 'prop', true);
  walls(lx + 34, 0, lz + 0, lx + 38, 6, lz + 3, M.TRIM); box(lx + 34, 3, lz + 0, lx + 38, 4, lz + 0, M.GLASS);
  box(lx + 33, 7, lz - 1, lx + 39, 7, lz + 4, M.ROOF_D); set(lx + 36, 8, lz + 1, M.LIT_Y);
  begin('Barrier', 'prop', false); box(lx + 32, 0, lz + 1, lx + 32, 3, lz + 1, M.CAR_A); box(lx + 21, 3, lz + 1, lx + 31, 3, lz + 1, M.TRIM);
  for (let x = lx + 22; x <= lx + 30; x += 3) set(x, 3, lz + 1, M.CAR_A);
  lampPost(lx + 19, lz + 12, 18); lampPost(lx + 19, lz + 30, 18);
  bin(lx + 1, lz + 1);
}

// One storage tank: a ringed steel drum with a red fuel band, a domed cap and a ladder. Biting the band sets it off.
function tank(cx, cz, r, h, name) {
  const b = begin(name, 'fuel'); b.explosive = 12;
  disc(cx, cz, 0, r + 1, M.STONE);
  for (let y = 1; y <= h; y++) disc(cx, cz, y, r, y === h - 3 || y === h - 4 ? M.FUEL : (y % 5 === 0 ? M.METAL : M.TANK), r - 1);
  disc(cx, cz, h + 1, r, M.TRIM); disc(cx, cz, h + 2, r - 2, M.TANK); disc(cx, cz, h + 3, r - 4, M.TANK);
  set(cx, h + 4, cz, M.LIT_R);
  for (let y = 1; y <= h + 1; y++) { set(cx + r + 1, y, cz - 1, M.DARK); set(cx + r + 1, y, cz + 1, M.DARK); if (y % 2 === 0) set(cx + r + 1, y, cz, M.DARK); }
}

// A fuel depot: two big tanks behind a wire fence, a pump house at the front and a pipe run between them.
export function depot(lx, lz, L, o = {}) {
  const r = o.r || 8, h = o.h || 17;
  tank(lx + 11, lz + 26, r, h, 'Fuel tank');
  tank(lx + 29, lz + 26, r, h + (o.tall ? 6 : -2), 'Fuel tank');
  begin('Pipe run', 'prop', false);
  box(lx + 11, 4, lz + 15, lx + 29, 5, lz + 15, M.METAL);
  for (const x of [lx + 11, lx + 29]) box(x, 4, lz + 16, x, 5, lz + 17, M.METAL);
  for (const x of [lx + 14, lx + 20, lx + 26]) box(x, 0, lz + 15, x, 3, lz + 15, M.DARK);
  begin('Pump house', 'shop');
  walls(lx + 2, 0, lz + 3, lx + 13, 9, lz + 11, M.BRICK2);
  box(lx + 1, 10, lz + 2, lx + 14, 10, lz + 12, M.ROOF_D);
  const F = face('f', lx + 2, lz + 3, lx + 13, lz + 11);
  F.box(4, 0, 7, 7, 0, 0, M.DOOR_G); F.box(9, 4, 10, 6, 0, 0, M.GLASS); F.box(1, 4, 2, 6, 0, 0, M.GLASS);
  begin('Depot sign', 'prop', true);
  box(lx + 16, 0, lz + 1, lx + 16, 7, lz + 1, M.METAL); box(lx + 31, 0, lz + 1, lx + 31, 7, lz + 1, M.METAL);
  box(lx + 16, 8, lz + 1, lx + 31, 14, lz + 1, M.SIGN);
  text(face('f', lx + 16, lz + 1, lx + 31, lz + 1), 'FUEL', (16 - textW('FUEL')) >> 1, 9, 1, M.DARK);
  begin('Wire fence', 'prop', false);
  for (let a = 0; a <= 39; a++) for (const bz of [39]) { set(lx + a, 0, lz + bz, M.METAL); if (a % 4 === 0) box(lx + a, 1, lz + bz, lx + a, 5, lz + bz, M.METAL); else set(lx + a, 5, lz + bz, M.METAL); }
  for (let bz = 14; bz < 39; bz++) for (const a of [0, 39]) { set(lx + a, 0, lz + bz, M.METAL); if (bz % 4 === 0) box(lx + a, 1, lz + bz, lx + a, 5, lz + bz, M.METAL); else set(lx + a, 5, lz + bz, M.METAL); }
  const p = begin('Drum stack', 'prop', false); p.explosive = 7;
  for (const [a, bz] of [[34, 4], [36, 4], [34, 6], [36, 6], [35, 5]]) box(lx + a, bz === 5 ? 3 : 0, lz + bz, lx + a + 1, bz === 5 ? 5 : 2, lz + bz + 1, bz === 5 ? M.FUEL : M.CAR_B);
}

// A plaza: the open square at the middle of town. A clock tower on a stepped plinth, planters, benches, lamps and four trees.
export function plaza(lx, lz, L, o = {}) {
  const cx = lx + 20, cz = lz + 20;
  begin(o.title || 'Clock tower', 'monument');
  box(cx - 6, 0, cz - 6, cx + 5, 0, cz + 5, M.STONE); box(cx - 5, 1, cz - 5, cx + 4, 1, cz + 4, M.STONE); box(cx - 4, 2, cz - 4, cx + 3, 2, cz + 3, M.TRIM);
  walls(cx - 3, 3, cz - 3, cx + 2, 28, cz + 2, M.BRICK);
  for (const y of [10, 20]) box(cx - 4, y, cz - 4, cx + 3, y, cz + 3, M.TRIM);
  box(cx - 4, 29, cz - 4, cx + 3, 29, cz + 3, M.TRIM);
  // a clock on each face
  for (const s of ['f', 'b', 'l', 'r']) {
    const F = face(s, cx - 3, cz - 3, cx + 2, cz + 2);
    F.box(1, 23, 4, 26, 1, 1, M.LIT_W); F.p(2, 25, 2, M.DARK); F.p(2, 24, 2, M.DARK); F.p(3, 24, 2, M.DARK);
    F.box(2, 12, 3, 17, 0, 0, M.GLASS);
  }
  walls(cx - 3, 30, cz - 3, cx + 2, 33, cz + 2, M.TRIM); box(cx - 2, 34, cz - 2, cx + 1, 34, cz + 1, M.ROOF_G);
  box(cx - 1, 35, cz - 1, cx, 37, cz, M.ROOF_G); box(cx - 1, 38, cz - 1, cx, 39, cz, M.BRASS);
  for (const [a, b] of [[4, 4], [33, 4], [4, 33], [33, 33]]) tree(lx + a, lz + b, 11, 5);
  planter(lx + 13, lz + 6, 6); planter(lx + 22, lz + 6, 6); planter(lx + 13, lz + 32, 6); planter(lx + 22, lz + 32, 6);
  bench(lx + 6, lz + 18); bench(lx + 27, lz + 18); bin(lx + 10, lz + 12); bin(lx + 30, lz + 28);
  lampPost(lx + 11, lz + 2, 18); lampPost(lx + 29, lz + 2, 18);
}
