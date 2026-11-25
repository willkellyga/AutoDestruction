// Hammerdown's show floor (maps/arena.js lists where each stands): what a monster truck show brings into the pit, at the
// fair's level of detail (cubes of half a voxel, fairstalls.js's kit; Will, 2026-11-24: "a Monster Truck style arena
// and ring with crushed cars, jumps and other things").
//   to drive over   crushed cars in rows and crushed buses in a gap. These are the floor there (arenadirt.js's decks
//                   are as high as their roofs), so they have no foot and nothing wrecks them.
//   to mark a jump  the striped band along a kicker's lip, marker posts with a lamp at a ledge's corners, a truss over
//                   a lane with its name in lights, the flame cannons beside a lip (arenamoves.js fires them)
//   to scatter      cones: a car goes through them
// `lift` (voxels) is how far up a thing stands, when it stands on the dirt.
import { KINDS, N } from './fairstalls.js';

const TYRE = 0x1a1a1c, BLACK = 0x121316, DARK = 0x24262c, STEEL = 0x8e969c, STEEL_D = 0x6a7178, WHITE = 0xeee8da, GLASS = 0x1c242c,
  YELLOW = 0xe8b830, BUS = 0xe6a81e, BUS_D = 0xc28a14, RED = 0xc8342c, RED_D = 0x7a2420, ORANGE = 0xe8742a, STRAW = 0xcfae5a, STRAW_D = 0xa8883e, TREAD = 0x4a3a2a,
  CHROME = 0xb8c0c6, RUST = 0x8a4a2a;
// the crushed cars' paint, and a darker shade of any colour
const CARS = [0xc8342c, 0x2a6fc0, 0xe8b830, 0x3a9a58, 0xe8742a, 0x8a4ac0, 0xd8d4c8, 0x2aa6a6, 0x5a5e66, 0xd04a8a];
const shade = (hex, k) => (Math.round(((hex >> 16) & 255) * k) << 16) | (Math.round(((hex >> 8) & 255) * k) << 8) | Math.round((hex & 255) * k);
const Y = (o) => (o.lift || 0) * 2;
const SHARD = 0x9fb4bc;
// a little seeded random, so a model's dents are its own and the same every time
const rng = (seed) => { let s = (Math.round(seed * 1000) | 0) || 1; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; }; };

// a wheel standing along x (its faces to the front and back of the model): middle (cx, cy), from z, d thick
function wheel(K, cx, cy, z, r, d, rim = STEEL_D) { K.discXY(cx, cy, z, r, d, TYRE); K.b(cx - r * 0.4, cy - r * 0.4, z - 0.15, r * 0.8, r * 0.8, d + 0.3, rim); }

// ---- to drive over ----------------------------------------------------------------------------------------------------
// A car a monster truck has been over: 22 long (its length along x) and 9.5 wide, its bonnet and boot at 4.1 up and the
// roof pressed down on the doors at 5.25 (as the lane's deck has them), on four flat tyres, two bands of tyre tread
// across it where the wheels went. v: 0 saloon, 1 estate, 2 with a stripe down it; c: its paint.
function crushed(K, o) {
  const C = CARS[(o.c || 0) % CARS.length], D = shade(C, 0.72), L = shade(C, 1.12) & 0xffffff, v = o.v || 0;
  for (const x of [-14, 14]) { wheel(K, x, 2.4, -10.4, 2.6, 1.8); wheel(K, x, 2.4, 8.6, 2.6, 1.8); }
  K.b(-22, 1, -9.5, 44, 7.2, 19, C); K.b(-22, 1, -9.6, 44, 1.2, 19.2, D);
  for (const x of [-22.7, 21.5]) K.b(x, 2, -9, 1.2, 1.8, 18, CHROME);
  // the nose (+x): grille, the lamps' sockets; the tail: lamps, the plate
  K.b(22, 4.2, -5.5, 0.3, 2.6, 11, BLACK); for (const z of [-8.6, 6.2]) { K.b(22, 4.6, z, 0.35, 2, 2.4, GLASS); K.b(-22.3, 4.8, z, 0.3, 1.5, 2.6, RED_D); }
  K.b(-22.35, 3.6, -2, 0.3, 1.6, 4, WHITE);
  // the bonnet and the boot: seams, a buckled panel each
  K.b(12.2, 8.2, -9.5, 0.4, 0.15, 19, D); K.b(-12.4, 8.2, -9.5, 0.4, 0.15, 19, D); K.b(14, 8.2, -6, 6, 0.5, 9, L); K.b(-20, 8.2, -3, 5, 0.4, 8, D);
  // the cabin, flat: what is left of the glass as a dark slit all round, the roof on top of it, its pillars splayed
  const x0 = v === 1 ? -20 : -12, len = 13 - x0;
  K.b(x0, 8.2, -9, len, 1, 18, BLACK); K.b(x0 - 0.4, 9.2, -9.4, len + 0.8, 1.3, 18.8, C); K.b(x0 + 2, 10.5, -6.5, len - 5, 0.25, 6, D); K.b(x0 + len * 0.45, 10.5, 1, len * 0.4, 0.2, 6.4, L);
  for (const x of [x0, x0 + len * 0.5, 12.2]) { K.b(x, 8.2, -9.5, 0.8, 1, 0.6, C); K.b(x, 8.2, 8.9, 0.8, 1, 0.6, C); }
  // the doors: a seam, a handle, and a number in a white patch on the one that shows
  for (const z of [-9.62, 9.5]) { K.b(-1, 2.2, z, 0.3, 6, 0.12, D); K.b(2, 6, z, 2, 0.5, 0.14, CHROME); K.b(-9, 3, z, 6, 4.2, 0.12, WHITE); K.b(-7.4, 3.8, z - 0.02, 0.9, 2.6, 0.16, BLACK); K.b(-5.6, 3.8, z - 0.02, 0.9, 2.6, 0.16, BLACK); }
  if (v === 2) { K.b(-22, 8.22, -1.5, 44, 0.1, 3, WHITE); K.b(x0 - 0.4, 10.52, -1.5, len + 0.8, 0.1, 3, WHITE); }
  if ((o.c || 0) % 3 === 1) { K.b(-18, 4, 9.52, 5, 3, 0.1, RUST); K.b(6, 2, -9.62, 7, 2.4, 0.1, RUST); }
  // dents and rust: dark hollows and bright creases in the roof and the lids, flakes of rust, splinters of glass
  const R = rng(o.x * 7.3 + o.z * 3.1 + (o.c || 0));
  for (let i = 0; i < 5; i++) { const x = x0 + 1 + R() * (len - 6), z = -8 + R() * 13, w = 2 + R() * 4, d = 1.5 + R() * 3; K.b(x, 10.5, z, w, 0.08 + R() * 0.1, d, R() < 0.6 ? D : shade(C, 0.55)); if (R() < 0.6) K.b(x + w, 10.5, z, 0.3, 0.3, d, L); }
  for (let i = 0; i < 6; i++) { const front = R() < 0.5, x = front ? 13.5 + R() * 6 : -21 + R() * (x0 + 19), z = -8.5 + R() * 14; K.b(x, 8.2, z, 1 + R() * 2.4, 0.1 + R() * 0.12, 1 + R() * 2.4, R() < 0.5 ? RUST : shade(C, 0.6)); }
  for (let i = 0; i < 7; i++) { const side = R() < 0.5 ? -9.7 : 9.3, x = x0 + R() * len; K.b(x, 8.3 + R() * 0.5, side + (R() - 0.5) * 0.6, 0.5 + R() * 0.6, 0.3, 0.4, SHARD); }
  for (const z of [-9.72, 9.56]) for (const x of [-14, 14]) K.b(x - 3.4, 4.6, z, 6.8, 1.2, 0.16, BLACK);   // the wheel arches
  if (R() < 0.5) K.b(21.6, 0.6, -9, 1.2, 1.4, 12, CHROME);                                              // a bumper hanging
  // where the truck's wheels went over: two bands of dirt across it
  for (const x of [-17, 7]) { K.b(x, 8.24, -9.5, 6, 0.12, 19, TREAD); if (x + 6 > x0 && x < 13) K.b(Math.max(x, x0 - 0.4), 10.54, -9.4, Math.min(x + 6, 13.4) - Math.max(x, x0 - 0.4), 0.12, 18.8, TREAD); }
}
// A school bus, the same: 30 long and 9.5 wide, its roof down at 7 the whole way along (as the gap's deck has it).
function bus(K, o) {
  for (const x of [-19, 20]) { wheel(K, x, 3, -10.3, 3.2, 1.8); wheel(K, x, 3, 8.5, 3.2, 1.8); }
  K.b(-30, 2, -9.5, 60, 6, 19, BUS); K.b(-30, 2, -9.6, 60, 1, 19.2, BLACK);
  for (const z of [-9.65, 9.5]) { K.b(-30, 4.4, z, 60, 0.7, 0.15, BLACK); K.b(-30, 6.6, z, 60, 0.5, 0.15, BLACK); }
  // the windows, pressed to a slit, a pillar between each; the roof and its ribs
  K.b(-29.6, 8, -9.2, 59.2, 2.4, 18.4, BLACK);
  for (let x = -29; x < 24; x += 6) { K.b(x, 8, -9.5, 1.2, 2.4, 0.5, BUS); K.b(x, 8, 9, 1.2, 2.4, 0.5, BUS); }
  K.b(-30.3, 10.4, -9.7, 60.6, 3.6, 19.4, BUS); for (let x = -27; x < 30; x += 6) K.b(x, 14, -9.5, 0.7, 0.2, 19, BUS_D);
  K.b(-30.3, 10.4, -9.8, 60.6, 0.8, 19.6, BUS_D);
  // the front (+x): what is left of the windscreen, the grille, the lamps, a black bumper; the back: the door, lamps
  K.b(30, 8, -8.6, 0.4, 2.4, 17.2, GLASS); K.b(30.3, 3.4, -5, 0.3, 3.4, 10, BLACK); for (const z of [-8.6, 6.4]) K.b(30.3, 4.2, z, 0.3, 2.2, 2.2, WHITE);
  K.b(30.3, 1.6, -9.8, 1.2, 1.8, 19.6, BLACK); K.b(-31.3, 1.6, -9.8, 1.2, 1.8, 19.6, BLACK);
  K.b(-30.4, 2.6, -3.4, 0.3, 5.2, 6.8, BUS_D); for (const z of [-8.8, 6.6]) { K.b(-30.5, 5, z, 0.3, 1.6, 2.2, RED_D); K.l(-30.5, 11.4, z, 0.3, 1.2, 2.2, N.red, -0.3 - (o.c || 0) * 0.13, 0.45); }
  // the roof's hatches, its dents, splinters of glass along the windows, the stop sign folded out, the tread across it
  const R = rng(o.z * 5.7 + (o.c || 0));
  for (const x of [-12, 8]) { K.b(x, 14, -3, 5, 0.5, 6, BUS_D); K.b(x + 0.6, 14.5, -2.4, 3.8, 0.12, 4.8, 0xf0c040); }
  for (let i = 0; i < 9; i++) { const x = -28 + R() * 52, z = -8.5 + R() * 13, w = 2 + R() * 5, d = 2 + R() * 3.5; K.b(x, 14, z, w, 0.1 + R() * 0.12, d, R() < 0.55 ? BUS_D : 0xa87410); if (R() < 0.5) K.b(x, 14, z + d, w, 0.34, 0.3, 0xf4c648); }
  for (let i = 0; i < 12; i++) { const side = R() < 0.5 ? -9.7 : 9.3; K.b(-28 + R() * 56, 8.2 + R() * 1.6, side + (R() - 0.5) * 0.5, 0.5 + R() * 0.8, 0.4, 0.4, SHARD); }
  for (let i = 0; i < 4; i++) K.b(-26 + R() * 50, 2.4 + R() * 3, R() < 0.5 ? -9.62 : 9.5, 2 + R() * 4, 1 + R() * 1.6, 0.12, RUST);
  K.b(12, 5, 9.6, 3, 3, 0.3, RED); K.b(12.8, 6.2, 9.8, 1.4, 0.6, 0.12, WHITE);
  for (const x of [-22, 16]) K.b(x, 14.24, -9.7, 7, 0.12, 19.4, TREAD);
}

// ---- to mark a jump -----------------------------------------------------------------------------------------------------
// the band along a kicker's lip: yellow and black, `w` voxels wide, its top at `lift`; a red lamp at each end
function lip(K, o) {
  const w = o.w, y = Y(o) - 3;
  K.stripes(-w, y, -0.2, 2 * w, 3, 0.8, Math.max(2, Math.round(w / 2)), YELLOW, BLACK); K.b(-w, y + 3, -0.6, 2 * w, 0.4, 1.4, STEEL_D);
  for (const x of [-w - 0.4, w - 0.8]) { K.b(x, y + 3.4, -0.6, 1.2, 2.4, 1.2, DARK); K.l(x, y + 5.8, -0.6, 1.2, 1.2, 1.2, N.red, -0.5, 1.2); }
}
// a marker post at a ledge's corner: red and white, a lamp on top (o.neon)
function marker(K, o) {
  const y = Y(o);
  for (let i = 0; i < 5; i++) K.b(-0.6, y + i * 2, -0.6, 1.2, 2, 1.2, i & 1 ? WHITE : RED);
  K.l(-0.8, y + 10, -0.8, 1.6, 1.6, 1.6, N[o.neon || 'yellow'], o.ph ?? -0.4, 1.3);
}
// a truss over a lane, its name in lights both ways: `span` voxels between its towers' middles, the beam 34 up
function truss(K, o) {
  const s = o.span, H = 68, tower = (x) => {
    for (const [a, b] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) K.b(x + a, 0, b, 1, H + 8, 1, STEEL_D);
    for (let y = 4; y < H + 8; y += 8) { K.b(x - 2, y, -2, 4, 0.8, 0.8, STEEL); K.b(x - 2, y, 1.2, 4, 0.8, 0.8, STEEL); K.b(x - 2, y + 4, -2, 0.8, 0.8, 4, STEEL); K.b(x + 1.2, y + 4, -2, 0.8, 0.8, 4, STEEL); }
    K.b(x - 3.5, 0, -3.5, 7, 1.2, 7, DARK); K.l(x - 1, H + 8, -1, 2, 1.6, 2, N.red, -0.2);
  };
  tower(-s); tower(s);
  for (const y of [H, H + 7]) for (const z of [-2, 1]) K.b(-s, y, z, 2 * s, 1, 1, STEEL_D);
  for (let x = -s + 3; x < s - 3; x += 7) { K.b(x, H + 1, -2, 0.8, 6, 0.8, STEEL); K.b(x + 3.5, H + 1, 1.2, 0.8, 6, 0.8, STEEL); K.b(x, H + 7, -2, 0.8, 0.8, 4, STEEL); }
  K.sign(o.name || 'HAMMERDOWN', 0, H - 7.5, 0.5, Math.min(2 * s - 10, (o.name || 'HAMMERDOWN').length * 9 + 14), 12, o.neon || 'yellow', o.frame || 'red', 1, 6);
  for (let x = -s + 6, i = 0; x < s - 5; x += 9, i++) for (const z of [-3.2, 2]) K.l(x, H - 1.6, z, 2.4, 1.4, 1.2, N.white, 0, 1.1);
}
// a flame cannon: a steel box in warning stripes, two barrels pointing up, a pilot light (arenamoves.js fires it)
function pyro(K, o) {
  const y = Y(o);
  K.b(-2.5, y, -2, 5, 3, 4, DARK); K.stripes(-2.5, y + 2, -2.1, 5, 1, 4.2, 5, YELLOW, BLACK);
  for (const x of [-1.6, 0.6]) { K.b(x, y + 3, -0.5, 1, 4, 1, STEEL_D); K.b(x - 0.2, y + 6.4, -0.7, 1.4, 0.8, 1.4, STEEL); }
  K.l(-0.3, y + 3, 1.2, 0.6, 0.8, 0.6, N.orange, -0.8, 1.2);
}

// ---- to scatter ---------------------------------------------------------------------------------------------------------
// three cones in a row
function cones(K) {
  for (const x of [-5, 0, 5]) { K.b(x - 1.4, 0, -1.4, 2.8, 0.4, 2.8, BLACK); K.b(x - 1, 0.4, -1, 2, 1.4, 2, ORANGE); K.b(x - 0.7, 1.8, -0.7, 1.4, 0.9, 1.4, WHITE); K.b(x - 0.5, 2.7, -0.5, 1, 1.2, 1, ORANGE); K.b(x - 0.25, 3.9, -0.25, 0.5, 0.8, 0.5, ORANGE); }
}
// what is left of a smashed one here: bent sheet, a tyre, splinters
export function wreckage(K) {
  K.b(-5, 0, -3, 9, 0.8, 6, DARK); K.b(-3, 0.8, -2, 5, 0.8, 3.4, STEEL_D); K.b(1, 0.4, 1.4, 4, 1.2, 2.4, TYRE); K.b(-6, 0.2, 2, 3, 0.9, 2.2, TYRE);
  K.b(-1, 1.4, -3.4, 3.6, 0.4, 1.2, YELLOW); K.b(3, 0.6, -3.6, 2.2, 1, 1.6, STRAW_D); K.b(-4, 0.9, -0.4, 1.6, 1.4, 1.4, STEEL);
}

Object.assign(KINDS, {
  crushed: { make: crushed, foot: null, top: 5.3, hp: 0, pool: null }, bus: { make: bus, foot: null, top: 7, hp: 0, pool: null },
  lip: { make: lip, foot: null, top: 0, hp: 0, pool: null }, marker: { make: marker, foot: null, top: 0, hp: 0, pool: null },
  truss: { make: truss, foot: (o) => [[-o.span / 2 - 1.2, -1.2, -o.span / 2 + 1.2, 1.2], [o.span / 2 - 1.2, -1.2, o.span / 2 + 1.2, 1.2]], top: 40, hp: 0, pool: null },
  pyro: { make: pyro, foot: null, top: 0, hp: 0, pool: null },
  cones: { make: cones, foot: [[-3.2, -0.8, 3.2, 0.8]], top: 2.4, hp: 5, heap: 0.15, pool: null },
});
