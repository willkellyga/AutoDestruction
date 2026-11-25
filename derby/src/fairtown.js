// What stands outside Dead Man's Fair's fence (maps/fair.js), past the floodlights and short of the woods:
//   north  a strip mall: two long rows of shops either side of the road out, each shop with its own front, its lit
//          window and its neon name, a supermarket at one end and a picture house at the other, and the car park in
//          front with its lamps and the cars nobody came back for. The plaza's sign stands by the road.
//   east   a small country suburb: one street of clapboard houses with pitched roofs, porches, lit windows here and
//          there, picket fences, trees and pickups, the telephone poles down one side, a white church at the south end
//          and the water tower behind.
// Scenery only: nothing here is driven round or shot at. Built with the stalls' kit (../fairstalls.js) as more of the
// stalls' kinds, so it is in the stalls' one mesh of paint; its lights are not on the fair's circuits (`always`).
import { KINDS, N, CHASE } from './fairstalls.js';

const WHITE = 0xeee8da, DARK = 0x24262c, STEEL = 0x8e969c, BROWN = 0x6a4326, PLANK = 0x5c4630, TYRE = 0x1a1a1c, GLASS = 0x2c3a48,
  ASPH = 0x2c2e34, LINE = 0xb4b2a2, WALK = 0x8a8a84, LAWN = 0x6c7a46, LEAF = 0x3a5a34, LEAF2 = 0x486a3a, BRICK = 0x8a4a3a, CREAM = 0xf4ead0;
const rng = (seed) => { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const CARS = [0xb8342c, 0x2f5fa0, 0xd8d4c8, 0x3a3c42, 0x8a8e94, 0x3c7a52, 0xc8a030, 0x6a3a2a];
// a parked car, its nose toward +z (or, `across`, toward +x): 7 cubes wide, 14 long
function parked(K, x, z, col, across = false, truck = false) {
  const B = (a, y, b, w, h, d, c) => (across ? K.b(x + b, y, z + a, d, h, w, c) : K.b(x + a, y, z + b, w, h, d, c));
  B(0, 1, 0, 7, 2.8, 14, col);
  if (truck) { B(0.4, 3.8, 7, 6.2, 2.6, 4.5, GLASS); B(0.2, 6.4, 7, 6.6, 0.4, 4.5, col); B(0.5, 3.8, 0.4, 0.5, 1, 6.4, col); B(6, 3.8, 0.4, 0.5, 1, 6.4, col); }
  else { B(0.4, 3.8, 3, 6.2, 2.4, 7.5, GLASS); B(0.2, 6.2, 3.6, 6.6, 0.4, 6.2, col); }
  for (const a of [-0.3, 6.5]) for (const b of [1.6, 9.6]) B(a, 0, b, 0.8, 2.2, 2.8, TYRE);
}

// ---- the mall: one row of shops, its front along x facing +z, its middle at the kerb -------------------------------------
// o.shops: [name, width and height in voxels, the sign's colour and its tube's, the wall's colour, what kind of front]
function mall(K, o) {
  const R = rng(o.seed || 7), total = o.shops.reduce((s, sh) => s + sh[1], 0) * 2, DEEP = 56;
  let x0 = -total / 2;
  // the car park, the kerb and the walk under the canopy
  K.b(-total / 2 - 12, 0, 10, total + 24, 0.3, 52, ASPH); K.b(-total / 2 - 4, 0, 0, total + 8, 0.7, 10, WALK);
  for (let x = -total / 2 + 4; x < total / 2 - 4; x += 9) { K.b(x, 0.3, 12, 0.5, 0.1, 15, LINE); K.b(x, 0.3, 40, 0.5, 0.1, 15, LINE); }
  for (let x = -total / 2 + 8; x < total / 2 - 10; x += 9) {
    const r = R();
    if (r < 0.2) parked(K, x + 1.2, 12.5, CARS[(R() * CARS.length) | 0], false, R() < 0.3);
    else if (r > 0.86) parked(K, x + 1.2, 40.5, CARS[(R() * CARS.length) | 0], false, R() < 0.3);
  }
  parked(K, total * 0.12, 30, 0x3a3c42, true); parked(K, -total * 0.3, 29, 0xb8342c, true, true);
  for (let x = -total / 2 + 30; x < total / 2 - 10; x += 64) {
    K.b(x - 1.5, 0, 30.5, 3, 2, 3, WALK); K.b(x - 0.5, 2, 31.5, 1, 32, 1, DARK); K.b(x - 5, 33.2, 31.5, 10, 0.8, 1, DARK);
    K.l(x - 5, 32.4, 31, 3.4, 0.8, 2, N.warm); K.l(x + 1.6, 32.4, 31, 3.4, 0.8, 2, N.warm);
  }
  for (const [name, wv, hv, neon, frame, wall, front] of o.shops) {
    const w = wv * 2, h = hv * 2, cx = x0 + w / 2, open = R() < 0.62 || front;
    K.b(x0, 0, -DEEP, w, h, DEEP, wall);
    K.b(x0 - 0.3, h, -DEEP - 0.3, w + 0.6, 1.6, DEEP + 0.6, DARK);
    K.b(x0 + w * 0.3, h + 1.6, -DEEP * 0.6, 7, 3.4, 6, STEEL);
    // the window and the door
    K.l(x0 + 2.5, 2, 0.05, w - 5, 9.5, 0.2, N.warm, 0, open ? 0.3 : 0.05);
    for (let x = x0 + 2.5; x <= x0 + w - 2.5; x += Math.max(6, (w - 5) / Math.round((w - 5) / 8))) K.b(x - 0.3, 2, 0.2, 0.6, 9.5, 0.25, DARK);
    K.b(x0 + 2, 0.7, 0.1, w - 4, 1.4, 0.4, DARK); K.b(cx - 2.4, 0.7, 0.25, 4.8, 9.6, 0.25, DARK); K.l(cx - 1.8, 1.2, 0.5, 3.6, 8.4, 0.1, N.warm, 0, open ? 0.42 : 0.04);
    if (front === 'cinema') {
      // the picture house: a marquee out over the walk, bulbs chasing round it, a tall fin with lamps up it
      K.b(x0 + 8, 13, 0, w - 16, 9, 12, DARK);
      K.l(x0 + 9, 14, 12.05, w - 18, 7, 0.2, N.white, 0, 0.34);
      for (let i = 0; i < 3; i++) K.b(x0 + 12 + i * 3, 15 + i * 1.6, 12.3, w - 30 - i * 9, 0.9, 0.1, DARK);
      K.bulbs(x0 + 8.5, x0 + w - 9, 22.2, 11.2, 2.5); K.bulbs(x0 + 8.5, x0 + w - 9, 12, 11.2, 2.5);
      K.b(cx - 3, 22, -3, 6, h - 2, 3, 0x8a2a2a);
      for (let i = 0; i < 9; i++) K.l(cx - 1.2, 24 + i * 2.2, 0.05, 2.4, 1.4, 0.3, N[CHASE[i % 5]], 0.05 + i / 9 * 0.9);
      K.sign(name, cx, h + 7, 0.6, Math.min(w - 20, 64), 9, neon, frame, 1.2, 5);
      K.b(cx - 16, h, -0.6, 2, 3, 1.2, DARK); K.b(cx + 14, h, -0.6, 2, 3, 1.2, DARK);
    } else {
      // the canopy over the walk on its posts, and the name on the wall above it
      K.b(x0, 12.5, 0, w, 1.6, 9, front === 'big' ? 0xa83a30 : (R() < 0.5 ? 0x4a5a6a : 0x6a3e34));
      K.b(x0 + 0.6, 0.7, 8, 1, 11.8, 1, STEEL);
      const sh = Math.min(front === 'big' ? 12 : 8, h - 17), sw = Math.min(w - 6, name.length * (front === 'big' ? 7 : 5.4) + 10);
      K.sign(name, cx, 14.6 + (h - 14.6) / 2, 0.6, sw, sh, neon, frame, 0.6, 5);
      if (front === 'big') { K.b(x0 + 6, h + 1.6, -4, w - 12, 5, 3, wall); K.bulbs(x0 + 7, x0 + w - 7, h + 6.8, -3, 4); }
    }
    x0 += w;
  }
  K.b(total / 2 - 0.4, 0.7, 8, 1, 11.8, 1, STEEL);
}
KINDS.mall = { make: mall, foot: null, top: 0, hp: 0, pool: null };

// the plaza's sign by the road: two posts, the name, and the shops' panels under it
function plaza(K, o) {
  for (const sx of [-17, 15]) K.b(sx, 0, -1, 2, 62, 2, DARK);
  K.sign(o.name, 0, 56, 1, 40, 10, o.neon, o.frame, 2, 6);
  K.bulbs(-19, 19, 61.4, -0.5, 3, false, 1.2);
  const P = ['red', 'cyan', 'yellow', 'green', 'pink'];
  for (let i = 0; i < 5; i++) { K.b(-15, 22 + i * 5.4, -0.5, 30, 4.4, 1, 0x3a3c44); K.l(-14, 22.6 + i * 5.4, 0.5, 28, 3.2, 0.1, N[P[i]], 0, 0.3); K.l(-14, 22.6 + i * 5.4, -0.6, 28, 3.2, 0.1, N[P[i]], 0, 0.3); K.b(-9 + (i * 3 % 5), 23.6 + i * 5.4, 0.6, 16 - (i * 2 % 5), 1.2, 0.1, DARK); }
}
KINDS.plaza = { make: plaza, foot: null, top: 0, hp: 0, pool: null };

// ---- a house, its front (door and porch) facing +z -----------------------------------------------------------------------
const WALLS = [0xe8e2d0, 0xb8c8d4, 0xa8b89a, 0xd8c8a0, 0xc8b8b0, 0x9aa8b4, 0xd4d4d0, 0xb89a80], ROOFS = [0x3a3c42, 0x5a4034, 0x6a3a34, 0x44504a], DOORS = [0x8a2a2a, 0x2a4a6a, 0x3a5a3a, 0x5c4630];
function house(K, o) {
  const R = rng(o.seed), w = 26 + ((R() * 6) | 0) * 2, d = 18 + ((R() * 4) | 0) * 2, two = R() < 0.5, H = two ? 24 : 13;
  const wall = WALLS[(R() * WALLS.length) | 0], roof = ROOFS[(R() * ROOFS.length) | 0], trim = WHITE, home = R() < 0.6;   // (home: someone has the lights on)
  K.b(-w / 2 - 12, 0, -d / 2 - 12, w + 24, 0.3, d + 30, LAWN);
  K.b(-w / 2 - 0.3, 0, -d / 2 - 0.3, w + 0.6, 1.6, d + 0.6, 0x6e6e68);
  K.b(-w / 2, 1.6, -d / 2, w, H - 1.6, d, wall);
  for (let y = 4; y < H; y += 2.5) { K.b(-w / 2 - 0.05, y, -d / 2 - 0.05, w + 0.1, 0.25, d + 0.1, 0xffffff & (wall - 0x101010)); }
  // the roof, its ridge along x: slabs stepping in from the front and the back, the gable ends filled in the wall's colour
  const n = Math.ceil((d + 4) / 4);
  for (let i = 0; i < n; i++) { K.b(-w / 2 - 2, H + i * 2, -d / 2 - 2 + i * 2, w + 4, 2, Math.max(1, d + 4 - i * 4), roof); if (i < n - 1) K.b(-w / 2, H + i * 2, -d / 2 + i * 2 + 1, w, 2, Math.max(0.5, d - i * 4 - 2), wall); }
  K.b(w / 4, H + 2, -3, 3.4, n * 2 + 2, 3.4, BRICK);
  // windows: each lit or not as the house is; frames and shutters
  const win = (x, y, front, lit) => {
    const z = front ? d / 2 : -d / 2 - 0.3;
    K.b(x - 0.5, y - 0.5, z, 5, 5.6, 0.3, trim); K.l(x, y, front ? z + 0.3 : z - 0.1, 4, 4.6, 0.1, N.warm, 0, lit ? 0.62 : 0.05);
    K.b(x + 1.8, y, front ? z + 0.4 : z - 0.2, 0.4, 4.6, 0.1, trim);
    K.b(x - 1.6, y - 0.3, z, 1, 5.2, 0.3, roof); K.b(x + 4.6, y - 0.3, z, 1, 5.2, 0.3, roof);
  };
  const side = (z, y, right, lit) => { const x = right ? w / 2 : -w / 2 - 0.3; K.b(x, y - 0.5, z - 0.5, 0.3, 5.6, 5, trim); K.l(right ? x + 0.3 : x - 0.1, y, z, 0.1, 4.6, 4, N.warm, 0, lit ? 0.62 : 0.05); };
  for (let s = 0; s < (two ? 2 : 1); s++) {
    const y = 4.5 + s * 11;
    for (const x of [-w / 2 + 4, w / 2 - 8]) { win(x, y, true, home && R() < 0.6); win(x, y, false, home && R() < 0.6); }
    if (w > 32 && s) { win(-2, y, true, home && R() < 0.5); win(-2, y, false, home && R() < 0.5); }
    side(-2, y, true, home && R() < 0.5); side(-2, y, false, home && R() < 0.5);
  }
  // the door, the porch and its light
  K.b(-2.2, 1.6, d / 2, 4.4, 8, 0.3, trim); K.b(-1.7, 1.6, d / 2 + 0.2, 3.4, 7.4, 0.2, DOORS[(R() * DOORS.length) | 0]);
  K.b(-8, 0, d / 2, 16, 1.6, 6, PLANK); K.b(-3, 0, d / 2 + 6, 6, 0.8, 2, PLANK);
  for (const x of [-8, 7]) K.b(x, 1.6, d / 2 + 5, 1, 8.4, 1, trim);
  K.b(-9, 10, d / 2, 18, 1, 7, roof);
  K.l(2.8, 8, d / 2 + 0.3, 0.9, 0.9, 0.9, N.warm, 0, home ? 1 : 0.5);
  // a garage on the side of some, and what is in the drive
  const gar = R() < 0.55, drive = gar || R() < 0.4, gx = w / 2;
  if (gar) { K.b(gx, 0, -d / 2 + 2, 15, 10, d - 3, wall); K.b(gx - 0.2, 10, -d / 2 + 1.6, 15.6, 1, d - 2.2, roof); K.b(gx + 2, 0, d / 2 - 1, 11, 8, 0.3, 0xd8d4c8); for (let i = 1; i < 4; i++) K.b(gx + 2, i * 2, d / 2 - 0.9, 11, 0.2, 0.25, 0xa8a49a); }
  if (drive) { K.b(gx + 2, 0.3, d / 2 - 1, 11, 0.1, 19, 0x767670); if (R() < 0.6) parked(K, gx + 4, d / 2 + 2, CARS[(R() * CARS.length) | 0], false, R() < 0.5); }
  // the picket fence along the front, with a gap for the path and the drive
  const fz = d / 2 + 17.4;
  for (let x = -w / 2 - 12; x < w / 2 + 12; x += 2) { if (Math.abs(x + 0.5) < 3.5 || (drive && x > gx + 1 && x < gx + 13)) continue; K.b(x, 0.3, fz, 1.2, 3.2, 0.4, WHITE); }
  K.b(-w / 2 - 12, 2, fz + 0.1, w / 2 + 8.5, 0.5, 0.3, WHITE);
  K.b(-1, 0.3, d / 2 + 8, 2.4, 0.1, 10, 0x8a8a84);
  K.b(5, 0.3, fz - 2, 0.6, 3.6, 0.6, BROWN); K.b(4.5, 3.9, fz - 3, 1.6, 1.4, 2.6, [0x8a8e94, 0xb8342c, 0x2f5fa0][(R() * 3) | 0]);   // the mailbox
  // a tree in the yard
  if (R() < 0.75) {
    const tx = -w / 2 - 5 + R() * 4, tz = (R() < 0.5 ? d / 2 + 7 : -d / 2 - 7), big = 1 + R() * 0.5;
    K.b(tx - 1, 0, tz - 1, 2, 11 * big, 2, BROWN);
    K.b(tx - 6 * big, 10 * big, tz - 6 * big, 12 * big, 6 * big, 12 * big, LEAF); K.b(tx - 4.5 * big, 16 * big, tz - 4.5 * big, 9 * big, 5 * big, 9 * big, LEAF2); K.b(tx - 2.5 * big, 21 * big, tz - 2.5 * big, 5 * big, 3 * big, 5 * big, LEAF);
  }
}
KINDS.house = { make: house, foot: null, top: 0, hp: 0, pool: null };

// the street: o.len voxels long along z, lamps down one side and telephone poles down the other
function street(K, o) {
  const L = o.len * 2;
  K.b(-9, 0, -L / 2, 18, 0.3, L, ASPH); K.b(-12, 0, -L / 2, 3, 0.6, L, WALK); K.b(9, 0, -L / 2, 3, 0.6, L, WALK);
  for (let z = -L / 2 + 6; z < L / 2 - 8; z += 16) K.b(-0.3, 0.3, z, 0.6, 0.1, 7, 0xc8a83a);
  for (let z = -L / 2 + 40, i = 0; z < L / 2 - 20; z += 96, i++) {
    K.b(-11, 0, z, 1, 30, 1, DARK); K.b(-11, 30, z, 6, 0.8, 1, DARK); K.l(-7.6, 29.2, z - 0.4, 2.6, 0.8, 1.8, N.warm, (i * 7) % 5 === 3 ? -0.9 : 0);
  }
  for (let z = -L / 2 + 14; z < L / 2; z += 76) { K.b(10.5, 0, z, 1.2, 38, 1.2, BROWN); K.b(7, 34, z + 0.2, 8, 0.9, 0.9, BROWN); K.b(8, 30.5, z + 0.2, 6, 0.8, 0.8, BROWN); }
  parked(K, -8.6, -L * 0.2, 0x3a3c42); parked(K, 1.8, L * 0.31, 0xb8342c, false, true); parked(K, -8.6, L * 0.12, 0xd8d4c8);
}
KINDS.street = { make: street, foot: null, top: 0, hp: 0, pool: null };

// the water tower: four legs, the tank, the town's name on it and a red lamp on top
function waterTower(K, o) {
  const H = 84;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let y = 0; y < H; y += 4) { const off = 12 + 7 * (1 - y / H); K.b(sx * off - 1, y, sz * off - 1, 2, 4, 2, STEEL); }
  for (const y of [22, 50]) { const off = 12 + 7 * (1 - y / H); K.b(-off, y, -off - 0.5, 2 * off, 1, 1, STEEL); K.b(-off, y, off - 0.5, 2 * off, 1, 1, STEEL); K.b(-off - 0.5, y, -off, 1, 1, 2 * off, STEEL); K.b(off - 0.5, y, -off, 1, 1, 2 * off, STEEL); }
  K.b(-1.5, 0, -1.5, 3, H, 3, 0x70787e);
  K.discXZ(0, H - 2, 0, 20, 1.5, DARK);
  K.discXZ(0, H, 0, 15, 3, 0xc8d0d2); K.discXZ(0, H + 3, 0, 18, 20, 0xd8dedf); K.discXZ(0, H + 23, 0, 15, 3, 0xc8d0d2); K.discXZ(0, H + 26, 0, 10, 3, 0x9aa4a8); K.discXZ(0, H + 29, 0, 4, 2, 0x9aa4a8);
  K.sign(o.name, 0, H + 13, 18.6, 30, 8, o.neon, o.frame, 0.6, 6);
  K.l(-1, H + 31, -1, 2, 2, 2, N.red, -0.9);
}
KINDS.watertower = { make: waterTower, foot: null, top: 0, hp: 0, pool: null };

// the church: white boards, a pitched roof along its length (the model's z), lit windows down its sides, and the
// steeple over the door at the front (+z)
function church(K, o) {
  const w = 26, d = 46, H = 22, roof = 0x3a3c42;
  K.b(-w / 2 - 14, 0, -d / 2 - 10, w + 28, 0.3, d + 40, LAWN);
  K.b(-w / 2, 0, -d / 2, w, H, d, WHITE);
  const n = Math.ceil((w + 4) / 4);
  for (let i = 0; i < n; i++) { K.b(-w / 2 - 2 + i * 2, H + i * 2.4, -d / 2 - 2, Math.max(1, w + 4 - i * 4), 2.4, d + 4, roof); if (i < n - 1) K.b(-w / 2 + i * 2 + 1, H + i * 2.4, -d / 2, Math.max(0.5, w - i * 4 - 2), 2.4, d, WHITE); }
  const G = ['yellow', 'red', 'blue', 'green', 'purple'];
  for (let i = 0; i < 4; i++) for (const sx of [-w / 2 - 0.2, w / 2 + 0.1]) { const z = -d / 2 + 6 + i * 10; K.l(sx, 6, z, 0.1, 9, 4, N[G[i % 5]], 0, 0.3); K.l(sx, 15, z + 1, 0.1, 2, 2, N[G[(i + 2) % 5]], 0, 0.3); }
  // the steeple
  K.b(-6, 0, d / 2 - 2, 12, 46, 12, WHITE); K.b(-7, 46, d / 2 - 3, 14, 1.6, 14, roof);
  K.b(-2.5, 0, d / 2 + 10, 5, 10, 0.3, BROWN); K.l(-2, 14, d / 2 + 10.05, 4, 6, 0.1, N.warm, 0, 0.5);
  for (const f of [[-4.5, d / 2 + 10.05, 3, 0.1], [1.5, d / 2 + 10.05, 3, 0.1]]) K.b(f[0], 36, f[1], f[2], 7, f[3], DARK);   // the belfry's louvres
  for (let i = 0; i < 7; i++) K.b(-6 + i, 47.6 + i * 4, d / 2 - 2 + i, 12 - i * 2, 4, 12 - i * 2, roof);
  K.b(-0.4, 75, d / 2 + 3.6, 0.8, 7, 0.8, CREAM); K.b(-2, 79, d / 2 + 3.6, 4, 0.8, 0.8, CREAM);
  K.b(-10, 1.2, d / 2 + 14, 1, 7, 1, DARK); K.b(-14, 6, d / 2 + 14.2, 9, 5, 0.6, WHITE); K.l(-13.5, 6.5, d / 2 + 14.85, 8, 4, 0.1, N.warm, 0, 0.3);   // the board out front
}
KINDS.church = { make: church, foot: null, top: 0, hp: 0, pool: null };

// Everything outside the fence, as entries for the stalls' list: for a fair WX by WZ, its road out north on x = GX and
// its track east on z = GZ
export function fairTown(WX, WZ, GX, GZ) {
  const E = Math.PI / 2, out = [], always = true;
  const SHOPS_W = [['MEGA MART', 44, 19, 'red', 'white', 0xd8d2c4, 'big'], ['PIZZA', 16, 13, 'orange', 'green', 0xb8523a], ['VIDEO', 16, 13, 'cyan', 'pink', 0x3a5a8a], ['NAILS', 14, 12, 'pink', 'white', 0xd9b8c8],
    ['LIQUOR', 18, 14, 'green', 'yellow', 0x7a6a52], ['DONUTS', 16, 13, 'pink', 'yellow', 0xe2c89a], ['PAWN', 14, 12, 'yellow', 'red', 0x8a8478], ['LAUNDRY', 18, 13, 'blue', 'white', 0x9ab0b8]];
  const SHOPS_E = [['ARCADE', 20, 14, 'purple', 'cyan', 0x4a3a6a], ['DINER', 22, 13, 'red', 'cyan', 0xc8ccd0], ['PHARMACY', 20, 13, 'green', 'white', 0xd8d2c4], ['TATTOO', 14, 12, 'red', 'purple', 0x3a3c42],
    ['GUNS', 16, 13, 'orange', 'white', 0x7a6a52], ['BINGO', 16, 12, 'yellow', 'blue', 0x9a6a5a], ['CINEMA', 48, 20, 'yellow', 'red', 0xb8a890, 'cinema']];
  const half = (list) => list.reduce((s, sh) => s + sh[1], 0) / 2;
  out.push({ kind: 'mall', x: GX - 26 - half(SHOPS_W), z: -64, yaw: 0, shops: SHOPS_W, seed: 11, always });
  out.push({ kind: 'mall', x: GX + 26 + half(SHOPS_E), z: -64, yaw: 0, shops: SHOPS_E, seed: 23, always });
  out.push({ kind: 'plaza', x: GX - 17, z: -40, yaw: 0, name: 'FAIRVIEW PLAZA', neon: 'white', frame: 'red', always });
  // the suburb: the street north to south, a row of houses either side of it facing it, the church, the water tower
  const SX = WX + 82;
  out.push({ kind: 'street', x: SX, z: WZ / 2, yaw: 0, len: WZ - 16, always });
  let seed = 100;
  for (let z = 30; z < WZ - 10; z += 36) {
    if (Math.abs(z - GZ) < 30) continue;
    out.push({ kind: 'house', x: SX - 25, z, yaw: E, seed: seed++, always });
    if (z < WZ - 50) out.push({ kind: 'house', x: SX + 25, z: z + 6, yaw: -E, seed: seed++, always });
  }
  out.push({ kind: 'church', x: SX + 30, z: WZ - 22, yaw: -E, always });
  out.push({ kind: 'watertower', x: SX + 62, z: GZ - 66, yaw: -E, name: 'PINE HOLLOW', neon: 'white', frame: 'red', always });
  return out;
}
