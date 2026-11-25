// Hammerdown's traps, modelled in the fair's kit (cubes of half a voxel: fairstalls.js makeKit), so they stand beside the
// show's things (arenakit.js) at the same level of detail (Will, 2026-11-24: "double up the detail on the traps").
// hazards.js runs the traps and hangs these on what moves: each function gives one part's geometry about its own
// middle, in voxels, to be put on a mesh with trapMat(). The lamps that flash and the glows stay hazards.js's own.
import * as THREE from 'three';
import { makeKit } from './fairstalls.js';

const STEEL = 0x8e969c, STEEL_D = 0x5c6268, DARK = 0x24262c, BLACK = 0x141518, YELLOW = 0xe8b830, RED = 0xc8302a, WHITE = 0xe8e4da, CHROME = 0xc3ccd6, COPPER = 0xb86a32;
const TAU = Math.PI * 2;
let mat = null;
export const trapMat = () => mat || (mat = new THREE.MeshLambertMaterial({ vertexColors: true }));
const kit = () => makeKit(0, 0, 0, true);
const done = (K) => { const g = K.geos(); g.lit.dispose(); return g.paint; };
const slice = (n, a, b) => (dx, dz) => ((((Math.atan2(dz, dx) / TAU + 1) * n) | 0) & 1 ? a : b);   // n slices round a middle, in two colours

// a round slab lying flat, between radii r0 and r1: rows of cubes; col a colour or (dx, dz) => colour
function round(K, cx, y, cz, r0, r1, h, col) {
  const R = Math.ceil(r1);
  for (let dz = -R; dz < R; dz++) {
    let x0 = 0, c0 = null;
    for (let dx = -R; dx <= R; dx++) {
      const r = Math.hypot(dx + 0.5, dz + 0.5), c = dx < R && r < r1 && r >= r0 ? (typeof col === 'function' ? col(dx + 0.5, dz + 0.5) : col) : null;
      if (c === c0) continue;
      if (c0 !== null) K.b(cx + x0, y, cz + dz, dx - x0, h, 1, c0);
      x0 = dx; c0 = c;
    }
  }
}
// a drum lying along x, from x, w long, its middle at (cy, cz)
function drumX(K, x, cy, cz, r, w, col) {
  for (let dy = -Math.ceil(r); dy < Math.ceil(r); dy++) { const q = r * r - (dy + 0.5) * (dy + 0.5); if (q <= 0) continue; const half = Math.round(Math.sqrt(q)); if (half > 0) K.b(x, cy + dy, cz - half, w, 1, 2 * half, col); }
}

// ---- the sweeper ------------------------------------------------------------------------------------------------------
// the hub the blades hang from, under the frame's top (TOP voxels up): a striped drum between two flanges, bolted
export function sweeperHub(TOP) {
  const K = kit(), y = (TOP - 6) * 2;
  round(K, 0, y, 0, 0, 17, 2, STEEL_D); round(K, 0, y + 2, 0, 0, 16, 8, slice(16, YELLOW, BLACK)); round(K, 0, y + 10, 0, 0, 17, 2, STEEL_D);
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; K.b(Math.cos(a) * 15.4 - 0.6, y - 0.5, Math.sin(a) * 15.4 - 0.6, 1.2, 0.5, 1.2, CHROME); }
  round(K, 0, y - 3, 0, 0, 7, 3, DARK); round(K, 0, y - 5, 0, 0, 4, 2, STEEL); round(K, 0, y + 12, 0, 0, 8, 3, DARK);
  return done(K);
}
// one arm, along +x (it turns toward +z): the beam out from the hub, three hangers down from it, and the blade low over
// the floor from R0 to R1: a striped plate with a steel rail above, a toothed edge below and spikes on its leading face
export function sweeperArm(R0, R1, TOP) {
  const K = kit(), x0 = 12, x1 = R1 * 2, yb = (TOP - 6) * 2, yt = (TOP - 4) * 2, len = (R1 - R0) * 2, b0 = R0 * 2;
  for (const y of [yb, yt - 1]) for (const z of [-2.2, 1.2]) K.b(x0, y, z, x1 - x0, 1, 1, STEEL_D);
  for (let x = x0; x <= x1 - 1; x += 6) { for (const z of [-2.1, 1.3]) K.b(x, yb + 1, z, 0.8, yt - yb - 2, 0.8, STEEL); K.b(x, yt - 1, -2.2, 1, 1, 4.4, STEEL); K.b(x, yb, -2.2, 1, 1, 4.4, STEEL); }
  for (const r of [R0 + 1, (R0 + R1) / 2, R1 - 1]) {
    const x = r * 2;
    K.b(x - 1.2, 12, -1.2, 2.4, yb - 12, 2.4, STEEL_D); K.b(x - 2.2, 12, -2.2, 4.4, 1.4, 4.4, DARK); K.b(x - 2, yb - 1.4, -2.4, 4, 1.4, 4.8, DARK);
    for (let y = 20; y < yb - 4; y += 8) K.b(x - 1.6, y, -1.6, 3.2, 1, 3.2, STEEL);
  }
  K.b(b0, 10, -1.8, len, 2, 3.6, STEEL_D); K.stripes(b0, 4, -1.9, len, 6, 3.8, Math.round(len / 4), YELLOW, BLACK); K.b(b0, 2, -1.6, len, 2, 3.2, STEEL);
  for (let x = b0; x < b0 + len - 0.5; x += 2) K.b(x, 1, -1.2, 1, 1, 2.4, CHROME);                                                   // the teeth along its foot
  for (let x = b0 + 3; x < b0 + len - 2; x += 6) { K.b(x, 10.6, 1.8, 0.8, 0.8, 0.3, CHROME); K.b(x, 10.6, -2.1, 0.8, 0.8, 0.3, CHROME); }   // bolts
  for (let x = b0 + 4; x < b0 + len - 3; x += 8) { K.b(x, 5.6, 1.9, 1.4, 1.4, 1, STEEL); K.b(x + 0.3, 5.9, 2.9, 0.8, 0.8, 0.8, CHROME); }      // spikes
  K.b(b0 - 1, 2, -2.2, 1, 10, 4.4, DARK); K.b(b0 + len, 4, -2.4, 2, 8, 4.8, DARK);
  return done(K);
}
// the saw at a blade's tip: a toothed disc standing along the blade (it spins about z)
export function sawGeo() {
  const K = kit(), face = slice(8, STEEL, CHROME);
  K.discXY(0, 0, -0.8, 7, 1.6, (dx, dy) => { const r = Math.hypot(dx, dy); return r < 1.8 ? RED : r < 3.6 ? DARK : face(dx, dy); });
  for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; K.b(Math.cos(a) * 7.6 - 0.8, Math.sin(a) * 7.6 - 0.8, -0.6, 1.6, 1.6, 1.2, CHROME); }
  return done(K);
}

// ---- the hammer -------------------------------------------------------------------------------------------------------
// what swings, hung from (0, 0, 0) and swinging along z: the arm (two plates and a web, stiffened), a striped collar and
// the yoke, and the head: a drum lying the way it swings, a bullseye on each striking face, studded collars, stripes
export function hammerSwing(L, HR, HL) {
  const K = kit(), r = Math.round(HR * 2), yh = -L * 2, end = yh + r, hl = HL * 2;
  for (const x of [-1.8, 1.2]) K.b(x, end, -1.8, 0.6, -end, 3.6, STEEL_D);
  K.b(-1.2, end, -0.5, 2.4, -end, 1, DARK);
  for (let y = -6; y > end + 12; y -= 6) K.b(-2.1, y, -2.1, 4.2, 0.8, 4.2, STEEL);
  K.b(-2.4, end + 8, -2.4, 4.8, 7, 4.8, YELLOW); for (let i = 0; i < 3; i++) K.b(-2.5, end + 9 + i * 2.2, -2.5, 5, 1, 5, BLACK);
  for (const [w, y] of [[14, 0], [10, 3], [7, 6]]) K.b(-w / 2, end + y - 1, -1.4, w, 3, 2.8, STEEL_D);
  for (const x of [-6, 5]) K.b(x, end - 1, -2, 1, 2, 4, CHROME);
  const face = (dx, dy) => { const q = Math.hypot(dx, dy); return q < 2.5 ? RED : q < 4.5 ? WHITE : q < 6.5 ? RED : STEEL; };
  K.discXY(0, yh, -hl, r - 1, 2, face); K.discXY(0, yh, hl - 2, r - 1, 2, face);
  K.discXY(0, yh, -hl + 2, r + 0.5, 3, DARK); K.discXY(0, yh, hl - 5, r + 0.5, 3, DARK);
  K.discXY(0, yh, -hl + 5, r, hl - 7.5, YELLOW); K.discXY(0, yh, -2.5, r, 5, BLACK); K.discXY(0, yh, 2.5, r, hl - 7.5, YELLOW);
  for (const z of [-hl + 2.6, hl - 4.4]) for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; K.b(Math.cos(a) * (r + 0.7) - 0.7, yh + Math.sin(a) * (r + 0.7) - 0.7, z, 1.4, 1.4, 1.8, CHROME); }
  return done(K);
}
// the axle it swings on, across the swing (along x), in its two bearings
export function hammerAxle() {
  const K = kit();
  drumX(K, -11, 0, 0, 2.6, 22, STEEL_D); drumX(K, -12, 0, 0, 3.6, 1.2, DARK); drumX(K, 10.8, 0, 0, 3.6, 1.2, DARK);
  for (const x of [-9.4, 6.4]) { K.b(x, -3.6, -3.6, 3, 7.2, 7.2, DARK); K.b(x - 0.2, 3.6, -1, 3.4, 1, 2, YELLOW); }
  return done(K);
}

// ---- the press --------------------------------------------------------------------------------------------------------
// the slab, w by d voxels and T thick, about its middle: steel plates above and below a band of stripes, studs under it
// to crush with, ribs across its top and a socket for each rod (sockets: [dx, dz] voxels from its middle)
export function pressSlab(w, T, d, sockets = []) {
  const K = kit(), X = w, Y = T, Z = d;   // (half sizes, in cubes)
  K.b(-X, -Y, -Z, 2 * X, 3, 2 * Z, STEEL_D); K.b(-X, Y - 3, -Z, 2 * X, 3, 2 * Z, STEEL_D); K.b(-X + 0.6, -Y + 3, -Z + 0.6, 2 * X - 1.2, 2 * Y - 6, 2 * Z - 1.2, DARK);
  const n = Math.round(X / 2), m = Math.round(Z / 2), s = 2 * Z / m;
  K.stripes(-X, -Y + 3, -Z, 2 * X, 2 * Y - 6, 0.6, n, YELLOW, BLACK); K.stripes(-X, -Y + 3, Z - 0.6, 2 * X, 2 * Y - 6, 0.6, n, BLACK, YELLOW);
  for (let i = 0; i < m; i++) for (const x of [-X, X - 0.6]) K.b(x, -Y + 3, -Z + i * s, 0.6, 2 * Y - 6, s, i & 1 ? BLACK : YELLOW);
  for (let x = -X + 4; x < X - 3; x += 8) { for (const z of [-Z - 0.25, Z - 0.05]) { K.b(x, Y - 2, z, 1, 1, 0.3, CHROME); K.b(x + 4, -Y + 1, z, 1, 1, 0.3, CHROME); } }
  for (let x = -X + 5; x < X - 4; x += 10) for (let z = -Z + 5; z < Z - 4; z += 10) K.b(x - 1.5, -Y - 1.4, z - 1.5, 3, 1.4, 3, STEEL);   // the studs
  K.b(-X, -Y - 0.5, -Z, 2 * X, 0.5, 1.2, RED); K.b(-X, -Y - 0.5, Z - 1.2, 2 * X, 0.5, 1.2, RED); K.b(-X, -Y - 0.5, -Z, 1.2, 0.5, 2 * Z, RED); K.b(X - 1.2, -Y - 0.5, -Z, 1.2, 0.5, 2 * Z, RED);
  for (let z = -Z + 6; z < Z - 5; z += 12) K.b(-X + 2, Y, z, 2 * X - 4, 2, 1.6, STEEL);                                                // the ribs
  for (const x of [-X + 2, X - 3.6]) K.b(x, Y, -Z + 2, 1.6, 2, 2 * Z - 4, STEEL);
  for (const [dx, dz] of sockets) { round(K, dx * 2, Y, dz * 2, 0, 6.5, 1.4, STEEL_D); round(K, dx * 2, Y + 1.4, dz * 2, 0, 5, 2.6, DARK); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; K.b(dx * 2 + Math.cos(a) * 5.4 - 0.5, Y + 1.4, dz * 2 + Math.sin(a) * 5.4 - 0.5, 1, 0.5, 1, CHROME); } }
  return done(K);
}
// a rod, one voxel long about its middle (hazards.js stretches it)
export function pressRod() { const K = kit(); round(K, 0, -1, 0, 0, 2.8, 2, CHROME); return done(K); }

// ---- the magnet -------------------------------------------------------------------------------------------------------
// about its middle: a red and white rim round a steel body, the pole and its windings showing underneath, a copper coil
// and the cap on top, and the shackle the cable holds it by
export function magnetBody() {
  const K = kit();
  round(K, 0, -3.6, 0, 12.5, 16, 7.2, slice(12, WHITE, RED));
  round(K, 0, -3.4, 0, 0, 12.5, 1, (dx, dz) => { const r = Math.hypot(dx, dz); return r < 4 ? STEEL : r < 9.5 ? COPPER : STEEL_D; });
  round(K, 0, -2.4, 0, 0, 12.5, 5.6, STEEL_D);
  round(K, 0, 3.2, 0, 9, 12, 1.8, COPPER); round(K, 0, 3.2, 0, 0, 8, 2.6, DARK); round(K, 0, 5.8, 0, 0, 5.5, 2.2, STEEL_D);
  for (const x of [-1.8, 1.2]) K.b(x, 8, -2, 0.6, 4, 4, STEEL); K.b(-2.4, 10, -0.6, 4.8, 1.2, 1.2, CHROME);
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * TAU; K.b(Math.cos(a) * 14.2 - 0.7, 3.6, Math.sin(a) * 14.2 - 0.7, 1.4, 0.6, 1.4, CHROME); }
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4, c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 4; i++) K.b(c * (4 + i * 2) - 0.5, 5.4 - i * 0.5, s * (4 + i * 2) - 0.5, 1, 1, 1, DARK); }   // the leads down to the coil
  return done(K);
}

// ---- a flame jet ------------------------------------------------------------------------------------------------------
// a burner on the wall, pointing along +x, its mouth 3.6 voxels up at x 0.6 (the wall's face is a voxel behind): a
// striped plate on the wall, the barrel and its lip, a gas bottle either side piped to it, a valve wheel
export function jetNozzle() {
  const K = kit();
  for (let i = 0; i < 8; i++) K.b(-2, 1, -8 + i * 2, 0.6, 12.4, 2, i & 1 ? BLACK : YELLOW);
  K.b(-2.1, 0.4, -8.2, 0.8, 0.6, 16.4, STEEL_D); K.b(-2.1, 13.4, -8.2, 0.8, 0.6, 16.4, STEEL_D);
  K.b(-1.4, 4.6, -3.2, 2.6, 5.2, 6.4, DARK);
  K.b(1.2, 9.2, -3.4, 1.4, 0.8, 6.8, STEEL); K.b(1.2, 4.4, -3.4, 1.4, 0.8, 6.8, STEEL); K.b(1.2, 5.2, -3.4, 1.4, 4, 0.8, STEEL); K.b(1.2, 5.2, 2.6, 1.4, 4, 0.8, STEEL);
  for (const z of [-6.4, 6.4]) {
    round(K, 0, 0, z, 0, 1.8, 8.4, RED); round(K, 0, 8.4, z, 0, 1.1, 1, STEEL); K.b(-0.4, 5, z - 1.9, 0.8, 1, 3.8, WHITE);
    K.b(-0.3, 9.4, z - 0.3, 0.6, 1.8, 0.6, STEEL); K.b(-0.3, 10.6, Math.min(z, 0), 0.6, 0.6, Math.abs(z), STEEL);
  }
  K.b(-0.3, 9.8, -0.3, 0.6, 1.4, 0.6, STEEL); round(K, 0, 11.2, 0, 0, 1.6, 0.5, RED);
  return done(K);
}
