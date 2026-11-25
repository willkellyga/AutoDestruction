// Camp Deadfall's own things (maps/base.js lists them), at the fair's level of detail (Will, 2026-11-24: "a similar
// pass to the army base"): modelled in cubes of half a voxel with the fair's kit (fairstalls.js), so they are meshes,
// not voxels, drawn in the same few draws, and wrecked the same way (a player's shots, blasts and rams).
//   landmarks   headquarters, the barracks huts, the control tower, the guard towers, the water tower, the fuel tanks,
//               the radio mast and the flag
//   vehicles    jeeps, cargo trucks (canvas, ambulance, fuel), an armoured carrier, a missile launcher
//   the camp    tents (ridge, hospital, command, mess), quarantine tunnels, sandbag walls and gun nests, crates, fuel
//               drums, barriers, tank traps, sign boards, guard huts, lamp posts, light towers, the siren's pole
//   and         the stands of what moves (basemoves.js): the radar and the sentry guns; and the runway's lights
// What is lit (windows, lamps, signs, the runway) is the kit's unlit material.
import { KINDS, N } from './fairstalls.js';

// ---- colours --------------------------------------------------------------------------------------------------------
const OLIVE = 0x5f6a3a, OLIVE_D = 0x475030, OLIVE_L = 0x748046, KHAKI = 0x8f8a5c, BAG = 0xb39d6c, BAG_D = 0x917e55,
  CONC = 0xb9b9ae, CONC_D = 0x8e8e86, WALL = 0xcdd0c0, WALL_D = 0xa7ab9c, STEEL = 0x8e969c, STEEL_D = 0x6a7178, DARK = 0x24262c,
  TYRE = 0x1a1a1c, BLACK = 0x121316, CANVAS = 0x6e7449, CANVAS_L = 0x858b5c, CANVAS_D = 0x565b38, WOOD = 0x8a6238, WOOD_L = 0xb08a54,
  WOOD_D = 0x5c4630, RED = 0xc8342c, WHITE = 0xeee8da, YELLOW = 0xe8b830, GLASS = 0x2c3b48, RUST = 0x8a4a2a, PVC = 0xdfe3df,
  FELT = 0x3a3d40, GREEN_D = 0x2f4a34;
const WARM = N.warm, COLD = [0.7, 1.3, 2.2], SICK = [0.5, 2.2, 0.9];

// ---- parts ----------------------------------------------------------------------------------------------------------
// a wall of sandbags: n bags long from `a` along x (or along z with alongZ, when `a` is where it starts in z and `c` its
// x), `rows` high, d cubes thick; each bag 4 by 1.5, the rows staggered
function bags(K, a, y, c, n, rows, alongZ = false, d = 3) {
  for (let r = 0; r < rows; r++) for (let i = 0; i < n + (r & 1); i++) {
    const s0 = Math.max(a, a + i * 4 - (r & 1) * 2), s1 = Math.min(a + n * 4, a + i * 4 - (r & 1) * 2 + 3.8); if (s1 - s0 < 0.6) continue;
    const col = (i * 7 + r * 3) % 5 < 2 ? BAG_D : BAG;
    if (alongZ) K.b(c, y + r * 1.5, s0, d, 1.4, s1 - s0, col); else K.b(s0, y + r * 1.5, c, s1 - s0, 1.4, d, col);
  }
}
// a wheel standing along x (its faces to the front and back of the model): middle (cx, cy), from z, d thick
function wheel(K, cx, cy, z, r, d) { K.discXY(cx, cy, z, r, d, TYRE); K.b(cx - r * 0.35, cy - r * 0.35, z - 0.15, r * 0.7, r * 0.7, d + 0.3, STEEL_D); }
// a window on a wall that faces front (dir 1, the wall's face at z) or back (dir -1): w by h at (x, y); lit: its glow
// (N's rgb) or nothing for dark glass
function win(K, x, y, z, w, h, dir, lit = null, k = 0.6, ph = 0) {
  const f = (o, t) => (dir > 0 ? z + o : z - o - t);
  K.b(x - 0.6, y - 0.6, f(0, 0.4), w + 1.2, h + 1.2, 0.4, DARK);
  if (lit) K.l(x, y, f(0.4, 0.2), w, h, 0.2, lit, ph, k); else K.b(x, y, f(0.4, 0.2), w, h, 0.2, GLASS);
  K.b(x + w / 2 - 0.25, y, f(0.6, 0.15), 0.5, h, 0.15, DARK); K.b(x, y + h * 0.55, f(0.6, 0.15), w, 0.5, 0.15, DARK);
}
// the same on a wall that faces right (dir 1, its face at x) or left (dir -1): the pane runs from z, w along z
function winX(K, x, y, z, w, h, dir, lit = null, k = 0.6, ph = 0) {
  const f = (o, t) => (dir > 0 ? x + o : x - o - t);
  K.b(f(0, 0.4), y - 0.6, z - 0.6, 0.4, h + 1.2, w + 1.2, DARK);
  if (lit) K.l(f(0.4, 0.2), y, z, 0.2, h, w, lit, ph, k); else K.b(f(0.4, 0.2), y, z, 0.2, h, w, GLASS);
  K.b(f(0.6, 0.15), y, z + w / 2 - 0.25, 0.15, h, 0.5, DARK); K.b(f(0.6, 0.15), y + h * 0.55, z, 0.15, 0.5, w, DARK);
}
// which windows are lit: the same every time, by where they are
const pick = (i, j) => { const h = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return h - Math.floor(h); };
const glow = (i, j) => { const p = pick(i, j); return p < 0.5 ? [WARM, 0.62, 0] : p < 0.62 ? [COLD, 0.5, 0] : p < 0.68 ? [WARM, 0.6, -0.3 - p] : [null, 0, 0]; };
// a wooden crate, s across, with its battens
function crate(K, x, y, z, s, h = s, col = WOOD_L) {
  K.b(x, y, z, s, h, s, col);
  for (const yy of [y + 0.6, y + h - 1.4]) K.b(x - 0.15, yy, z - 0.15, s + 0.3, 0.8, s + 0.3, WOOD);
  K.b(x - 0.15, y, z - 0.15, 0.8, h, 0.8, WOOD); K.b(x + s - 0.65, y, z + s - 0.65, 0.8, h, 0.8, WOOD); K.b(x + s - 0.65, y, z - 0.15, 0.8, h, 0.8, WOOD); K.b(x - 0.15, y, z + s - 0.65, 0.8, h, 0.8, WOOD);
}
// an oil drum standing: middle (cx, cz), from y
function barrel(K, cx, y, cz, col = OLIVE) { K.discXZ(cx, y, cz, 2, 6, col); K.discXZ(cx, y + 1.6, cz, 2.2, 0.5, DARK); K.discXZ(cx, y + 4, cz, 2.2, 0.5, DARK); K.discXZ(cx, y + 6, cz, 1.6, 0.2, DARK); }
// a white star, flat on top of something (a bonnet, a roof)
function star(K, cx, y, cz, s = 1) { K.b(cx - 1.5 * s, y, cz - 0.5 * s, 3 * s, 0.12, s, WHITE); K.b(cx - 0.5 * s, y, cz - 1.5 * s, s, 0.12, 3 * s, WHITE); }
// a machine gun on a tripod, pointing front
function tripodGun(K, x, y, z) {
  K.b(x - 0.4, y, z - 0.4, 0.8, 5, 0.8, DARK); K.b(x - 2.5, y, z - 2.5, 0.6, 2.5, 0.6, DARK); K.b(x + 1.9, y, z - 2.5, 0.6, 2.5, 0.6, DARK); K.b(x - 0.3, y, z + 2, 0.6, 2.5, 0.6, DARK);
  K.b(x - 0.6, y + 5, z - 3, 1.2, 1.4, 6, STEEL_D); K.b(x - 0.3, y + 5.4, z + 3, 0.6, 0.6, 6, DARK); K.b(x + 0.7, y + 4.2, z - 2, 2.2, 2, 2.6, OLIVE_D);
}

// ---- headquarters: two floors of rendered concrete, 80 by 40 voxels, its door and sign to the front ------------------------
function hq(K) {
  const W = 80, D = 40, H = 44;
  K.b(-W, 0, -D, 2 * W, 2, 2 * D, CONC_D);
  K.b(-W + 1, 2, -D + 1, 2 * W - 2, H - 2, 2 * D - 2, WALL);
  K.b(-W + 0.5, 2, -D + 0.5, 2 * W - 1, 5, 2 * D - 1, OLIVE_D);
  K.b(-W + 0.5, 22, -D + 0.5, 2 * W - 1, 1.6, 2 * D - 1, OLIVE_D);
  K.b(-W, H, -D, 2 * W, 2, 2 * D, CONC_D);
  for (const [x, z, w, d] of [[-W, -D, 2 * W, 1.5], [-W, D - 1.5, 2 * W, 1.5], [-W, -D, 1.5, 2 * D], [W - 1.5, -D, 1.5, 2 * D]]) K.b(x, H + 2, z, w, 2.6, d, WALL_D);
  K.b(-W + 1.5, H + 2, -D + 1.5, 2 * W - 3, 0.4, 2 * D - 3, FELT);
  // piers between the bays, and the windows in them (the middle of the front is the door and the sign)
  const bay = 17.4, x0 = -W + 1;
  for (let i = 0; i <= 9; i++) for (const z of [-D + 0.2, D - 1.2]) K.b(Math.min(W - 3, x0 + i * bay), 2, z, 2, H - 2, 1, CONC);
  for (let i = 0; i < 9; i++) for (let f = 0; f < 2; f++) {
    const x = x0 + 2 + i * bay + (bay - 2 - 9) / 2, y = f ? 28 : 9;
    if (!(f === 0 && i === 4) && !(f === 1 && i >= 3 && i <= 5)) { const [g, k, ph] = glow(i, f); win(K, x, y, D - 1, 9, 10, 1, g, k, ph); }
    { const [g, k, ph] = glow(i + 20, f); win(K, x, y, -D + 1, 9, 10, -1, g, k, ph); }
  }
  for (let j = 0; j < 3; j++) for (let f = 0; f < 2; f++) for (const s of [-1, 1]) { const [g, k, ph] = glow(j + 40 + s, f); winX(K, s * (W - 1), f ? 28 : 9, -27 + j * 22, 9, 10, s, g, k, ph); }
  // the door, its steps and its canopy, and sandbags either side
  K.b(-13, 0, D, 26, 1.4, 9, CONC); K.b(-11, 1.4, D, 22, 1.2, 6, CONC);
  K.b(-7, 2.6, D - 1, 14, 15, 0.6, DARK); K.l(-6, 4, D - 0.4, 5.4, 12, 0.2, WARM, 0, 0.7); K.l(0.6, 4, D - 0.4, 5.4, 12, 0.2, WARM, 0, 0.7);
  K.b(-15, 19, D - 1, 30, 1.6, 13, CONC_D); K.b(-15, 20.6, D - 1, 30, 0.6, 13, OLIVE_D);
  for (const x of [-14, 12.5]) K.b(x, 2.6, D + 9.5, 1.5, 16.4, 1.5, OLIVE_D);
  K.l(-3, 18.2, D + 4, 6, 0.8, 3, N.white, 0, 0.9);
  bags(K, -40, 0, D + 3, 6, 4); bags(K, 16, 0, D + 3, 6, 4);
  K.sign('HEADQUARTERS', 0.3, 33, D + 0.4, 46, 8, 'yellow', 'white');
  // the back: a door under a lamp, pipes, a skip
  K.b(-50, 2, -D + 0.4, 8, 14, 0.6, GREEN_D); K.l(-48, 17, -D - 0.6, 4, 1.2, 1.4, N.white, 0, 0.8);
  for (const x of [-70, 20, 66]) K.b(x, 2, -D + 0.2, 1, H, 0.8, STEEL_D);
  K.b(28, 0, -D - 9, 16, 8, 8, GREEN_D); K.b(28, 8, -D - 9, 16, 0.6, 8, DARK);
  // on the roof: plant, the stair's housing, aerials, a dish, lamps at the corners, a red light
  const R = H + 2.4;
  K.b(-62, R, -26, 18, 7, 12, STEEL); K.b(-60, R + 7, -24, 6, 0.6, 8, DARK); K.b(-52, R + 7, -24, 6, 0.6, 8, DARK);
  K.b(-38, R, -28, 10, 5, 8, STEEL_D); K.b(-44, R, -10, 30, 2, 2, STEEL);
  K.b(30, R, -30, 22, 12, 16, WALL); K.b(29, R + 12, -31, 24, 1.2, 18, CONC_D); K.b(36, R, -14.4, 6, 9, 0.5, GREEN_D); K.l(37.5, R + 9.6, -14, 3, 1, 1, N.white, 0, 0.7);
  for (const [x, z, h] of [[60, 20, 30], [64, 14, 22], [56, 26, 18]]) { K.b(x, R, z, 0.7, h, 0.7, DARK); K.b(x - 0.6, R, z - 0.6, 1.9, 1.5, 1.9, STEEL_D); }
  K.b(-8, R, 6, 2, 8, 2, STEEL_D); K.discXY(-7, R + 12, 9, 7, 1, WHITE); K.discXY(-7, R + 12, 9.9, 5, 0.3, STEEL); K.b(-7.4, R + 11.6, 10, 0.8, 0.8, 6, DARK); K.b(-8, R + 11, 15.6, 2, 2, 1.4, DARK);
  for (const [x, z] of [[-W + 2, D - 2.5], [W - 5, D - 2.5], [-W + 2, -D + 1], [W - 5, -D + 1]]) K.l(x, H + 4.6, z, 3, 1.6, 1.5, N.white, 0, 0.9);
  K.b(74, R, -34, 1, 10, 1, DARK); K.l(73.5, R + 10, -34.5, 2, 2, 2, N.red, -0.4);
}

// ---- a barracks hut: half a cylinder of ribbed tin, its length along x, 72 voxels by 22 ---------------------------------
function hut(K, o) {
  const L = 72, R = 22, half = (y, r = R) => Math.sqrt(Math.max(0, r * r - y * y));
  K.b(-L - 1, 0, -R - 1, 2 * L + 2, 0.8, 2 * R + 2, CONC_D);
  for (let y = 0; y < R; y++) { const w = half(y + 0.5); K.b(-L, y + 0.8, -w, 2 * L, 1, 2 * w, y % 6 === 5 ? OLIVE_L : OLIVE); }
  for (let x = -L; x <= L - 1; x += 12) for (let y = 0; y < R + 1; y += 2) { const w = half(y + 1, R + 0.7); if (w > 0.5) K.b(x, y + 0.8, -w, 1.2, 2, 2 * w, OLIVE_D); }
  // dormer windows down both sides, stove pipes on top
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
    const x = -L + 9 + i * 24, [g, k, ph] = glow(i + (o.x | 0), s);
    K.b(x, 6, s > 0 ? 16 : -21, 9, 9, 5, OLIVE_D); K.b(x - 0.6, 15, s > 0 ? 15.4 : -21.6, 10.2, 0.8, 6.2, DARK);
    if (g) K.l(x + 1.2, 7.6, s > 0 ? 21 : -21.2, 6.6, 5.6, 0.2, g, ph, k); else K.b(x + 1.2, 7.6, s > 0 ? 21 : -21.2, 6.6, 5.6, 0.2, GLASS);
    K.b(x + 4.2, 7.6, s > 0 ? 21.2 : -21.4, 0.5, 5.6, 0.2, DARK);
  }
  for (const x of [-40, 30]) { K.b(x, R, -1, 2, 7, 2, DARK); K.b(x - 0.6, R + 7, -1.6, 3.2, 0.8, 3.2, DARK); }
  // the ends: boarded, a door under a porch and a lamp, a window either side
  for (const s of [-1, 1]) {
    const x = s > 0 ? L - 1 : -L;
    for (let y = 0; y < R - 1; y++) { const w = half(y + 0.5) - 1.2; if (w > 0.4) K.b(s > 0 ? x + 0.6 : x - 0.2, y + 0.8, -w, 0.6, 1, 2 * w, y % 4 === 3 ? WOOD_L : WHITE); }
    const fx = s > 0 ? L + 0.2 : -L - 0.2;
    K.b(s > 0 ? fx : fx - 0.4, 0.8, -4, 0.4, 13, 8, GREEN_D); winX(K, fx, 9, -2, 4, 3, s, WARM, 0.6);
    for (const z of [-14, 8]) winX(K, fx, 7, z, 6, 5, s, ...glow(z + (o.x | 0), s));
    K.b(s > 0 ? fx : fx - 4, 14.6, -6, 4, 0.8, 12, OLIVE_D); K.l(s > 0 ? fx + 0.4 : fx - 1.6, 13.4, -1, 1.2, 1, 2, N.white, 0, 0.9);
    K.b(s > 0 ? fx : fx - 3, 0, -5, 3, 0.8, 10, CONC);
  }
  K.sign(o.name || 'BARRACKS', 0, 20, 24.5, 30, 6, 'yellow', 'white'); for (const x of [-13, 12]) K.b(x, 0, 23, 1, 17.2, 1, STEEL_D);
}

// ---- a guard tower: four timber legs, a sandbagged floor, a roof, a searchlight (the look's beam comes from it) ------------
function gtower(K) {
  for (const sx of [-13, 11]) for (const sz of [-13, 11]) K.b(sx, 0, sz, 2, 36, 2, WOOD);
  for (const y of [18, 33]) for (const [x, z, w, d] of [[-13, -13, 26, 1.4], [-13, 11.6, 26, 1.4], [-13, -13, 1.4, 26], [11.6, -13, 1.4, 26]]) K.b(x, y, z, w, 1.6, d, WOOD_D);
  for (let k = 0; k < 11; k++) { const a = -11 + k * 2, y = 19.6 + k * 1.25; K.b(a, y, -12.8, 2, 1.25, 1, WOOD_D); K.b(-a - 2, y, 11.8, 2, 1.25, 1, WOOD_D); K.b(-12.8, y, a, 1, 1.25, 2, WOOD_D); K.b(11.8, y, -a - 2, 1, 1.25, 2, WOOD_D); }
  K.b(-16, 36, -16, 32, 1.6, 32, WOOD_L);
  for (const z of [-16, 13]) bags(K, -16, 37.6, z, 8, 3); for (const x of [-16, 13]) bags(K, -12, 37.6, x, 6, 3, true);
  for (const sx of [-15.4, 13.8]) for (const sz of [-15.4, 13.8]) K.b(sx, 37.6, sz, 1.6, 14.4, 1.6, WOOD);
  K.b(-18, 52, -18, 36, 1.4, 36, CANVAS_D); K.b(-14, 53.4, -14, 28, 1.4, 28, OLIVE_D); K.b(-9, 54.8, -9, 18, 1.2, 18, OLIVE_D); K.b(-4, 56, -4, 8, 1, 8, OLIVE);
  K.b(-2, 37.6, -2, 4, 6, 4, DARK); K.b(-3, 43.6, -3, 6, 5, 6, STEEL_D); for (const [x, z, w, d] of [[-2.2, 3, 4.4, 0.3], [-2.2, -3.3, 4.4, 0.3], [3, -2.2, 0.3, 4.4], [-3.3, -2.2, 0.3, 4.4]]) K.l(x, 44.4, z, w, 3.4, d, N.white, 0, 1.1);
  for (let y = 1.5; y < 36; y += 3) K.b(13.2, y, -11.5, 0.6, 0.6, 4, WOOD_D); K.b(13, 0, -12.2, 0.7, 36, 0.7, WOOD_D); K.b(13, 0, -7.8, 0.7, 36, 0.7, WOOD_D);
  K.l(-15.6, 50, -0.6, 0.6, 1.2, 1.2, N.red, -0.2); K.l(15, 50, -0.6, 0.6, 1.2, 1.2, N.red, -0.7);
}

// ---- the water tower: legs wide enough apart to drive between, braced above a car's roof ----------------------------------
function wtower(K) {
  for (const sx of [-21, 18]) for (const sz of [-21, 18]) { K.b(sx, 0, sz, 3, 62, 3, STEEL_D); K.b(sx - 1, 0, sz - 1, 5, 1.2, 5, CONC); }
  for (const y of [34, 58]) for (const [x, z, w, d] of [[-21, -21, 42, 1.6], [-21, 19.4, 42, 1.6], [-21, -21, 1.6, 42], [19.4, -21, 1.6, 42]]) K.b(x, y, z, w, 2, d, STEEL);
  for (let k = 0; k < 13; k++) { const a = -19 + k * 3, y = 36 + k * 1.7; K.b(a, y, -20.6, 3, 1.7, 0.9, STEEL); K.b(-a - 3, y, 19.7, 3, 1.7, 0.9, STEEL); K.b(-20.6, y, -a - 3, 0.9, 1.7, 3, STEEL); K.b(19.7, y, a, 0.9, 1.7, 3, STEEL); }
  K.b(-1.5, 0, -1.5, 3, 62, 3, STEEL); K.b(-3, 0, -3, 6, 3, 6, STEEL_D); K.b(-2.6, 3, 3, 1.4, 1.4, 5, RED);
  K.discXZ(0, 60, 0, 22, 2, STEEL_D); K.discXZ(0, 62, 0, 20, 11, OLIVE); K.discXZ(0, 73, 0, 20, 4, WHITE); K.discXZ(0, 77, 0, 20, 11, OLIVE);
  for (const y of [62, 68, 82, 87.4]) K.discXZ(0, y, 0, 21, 0.7, OLIVE_D);
  [[19, 2], [16, 2], [12, 2], [8, 1.6], [4, 1.4]].reduce((y, [r, h]) => { K.discXZ(0, y, 0, r, h, OLIVE_D); return y + h; }, 88);
  K.b(-0.5, 97, -0.5, 1, 4, 1, DARK); K.l(-1, 101, -1, 2, 2, 2, N.red, -0.5);
  for (let y = 1.5; y < 88; y += 3) K.b(21.6, y, -1.5, 0.6, 0.6, 3, DARK); K.b(21.4, 0, -1.9, 0.7, 88, 0.7, DARK); K.b(21.4, 0, 1.2, 0.7, 88, 0.7, DARK);
}

// ---- a fuel tank: a hooped drum 18 voxels across with a red band, a domed cap, a ladder, its pipes and a warning --------------
function ftank(K) {
  K.discXZ(0, 0, 0, 20, 1.6, CONC);
  K.discXZ(0, 1.6, 0, 18, 34, OLIVE);
  for (const y of [1.6, 9, 17, 34.4]) K.discXZ(0, y, 0, 19, 0.9, OLIVE_D);
  K.discXZ(0, 24, 0, 18.6, 5, RED); K.discXZ(0, 35.3, 0, 17, 1.4, STEEL_D);
  [[15, 1.6], [11, 1.4], [6, 1.2]].reduce((y, [r, h]) => { K.discXZ(0, y, 0, r, h, OLIVE); return y + h; }, 36.7);
  K.b(-1, 40.9, -1, 2, 3, 2, STEEL_D); K.l(-1, 43.9, -1, 2, 1.6, 2, N.red, -0.6);
  for (let y = 2; y < 37; y += 2.6) K.b(-20.2, y, -1.5, 0.7, 0.6, 3, DARK); K.b(-20.4, 0, -2, 0.8, 38, 0.8, DARK); K.b(-20.4, 0, 1.4, 0.8, 38, 0.8, DARK);
  K.b(8, 2.6, 17, 3, 3, 9, STEEL); K.b(-12, 2.6, 23, 23, 3, 3, STEEL); K.b(6.6, 2, 21.6, 5.8, 4.2, 5.8, STEEL_D); K.b(8.4, 6.2, 23.4, 2.2, 2.6, 2.2, STEEL_D); K.b(7, 8.8, 22, 5, 0.6, 5, RED);
  K.b(-12.6, 0, 22.4, 4.2, 6.6, 4.2, STEEL_D);
  K.sign('FLAMMABLE', -2, 15, 19.6, 22, 5.4, 'red', 'yellow', 0.6);
}

// ---- the radio mast: a lattice 72 voxels tall, banded red and white, dishes on it and red lights -------------------------
function mast(K) {
  K.b(-7, 0, -7, 14, 1.6, 14, CONC);
  const H = 144, seg = 12;
  for (let y = 1.6, i = 0; y < H; y += seg, i++) {
    const w = 5 - 3.2 * (y / H), col = (i >> 1) & 1 ? WHITE : RED, h = Math.min(seg, H - y);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.b(a * w - 0.5, y, b * w - 0.5, 1, h, 1, col);
    K.b(-w - 0.4, y + h - 0.8, -w - 0.4, 2 * w + 0.8, 0.8, 0.8, col); K.b(-w - 0.4, y + h - 0.8, w - 0.4, 2 * w + 0.8, 0.8, 0.8, col); K.b(-w - 0.4, y + h - 0.8, -w, 0.8, 0.8, 2 * w, col); K.b(w - 0.4, y + h - 0.8, -w, 0.8, 0.8, 2 * w, col);
    // a brace across each face, stepped
    for (let k = 0; k < 4; k++) { const t = (k + 0.5) / 4, a = (i & 1 ? 1 - t : t) * 2 * w - w, yy = y + k * (h / 4); K.b(a - 0.4, yy, -w - 0.3, 0.8, h / 4, 0.6, col); K.b(-a - 0.4, yy, w - 0.3, 0.8, h / 4, 0.6, col); K.b(-w - 0.3, yy, -a - 0.4, 0.6, h / 4, 0.8, col); K.b(w - 0.3, yy, a - 0.4, 0.6, h / 4, 0.8, col); }
  }
  K.b(-0.4, H, -0.4, 0.8, 10, 0.8, DARK); K.l(-1, H + 1, -1, 2, 2, 2, N.red, -0.3);
  for (const [y, s] of [[62, 1], [92, -1], [118, 1]]) { K.discXY(s * 5, y, s > 0 ? 3 : -4, 3.4, 1, WHITE); K.b(s * 5 - 0.5, y - 0.5, -3, 1, 1, 6, STEEL_D); }
  for (const y of [48, 96]) for (const s of [-1, 1]) K.l(s * 4 - 0.6, y, s * 4 - 0.6, 1.2, 1.4, 1.2, N.red, -0.3 - y * 0.01);
}

// ---- the flag: a tall pole, the camp's flag out in the wind (olive, a white bar, a gold disc) ------------------------------
function flag(K) {
  K.b(-3, 0, -3, 6, 1.4, 6, CONC); K.b(-2, 1.4, -2, 4, 1.2, 4, CONC_D); K.b(-0.6, 2.6, -0.6, 1.2, 80, 1.2, WHITE); K.b(-1, 82.6, -1, 2, 2, 2, YELLOW);
  for (let a = 0; a < 22; a++) {
    const z = Math.sin(a * 0.55) * (0.4 + a * 0.07), x = 0.6 + a;
    for (const [y, h, col] of [[66, 6, 0x3c8a4c], [72, 2, WHITE], [74, 6, 0x3c8a4c]]) K.b(x, y - a * 0.08, z, 1, h, 0.5, col);
    if (a >= 8 && a <= 13) { const hh = a === 8 || a === 13 ? 2 : 4; K.b(x, 73 - hh / 2 - a * 0.08, z - 0.08, 1, hh, 0.66, YELLOW); }
  }
  K.l(-4, 1.4, 3, 2, 1.4, 1.6, N.white, 0, 0.9);
}

// ---- the control tower: a concrete shaft, a glass cab that leans out, a walkway round it, a turning light on the roof ----
function ctower(K) {
  K.b(-12, 0, -12, 24, 2, 24, CONC_D);
  K.b(-10, 2, -10, 20, 66, 20, WALL);
  for (const [x, z] of [[-10.6, -10.6], [8.6, -10.6], [-10.6, 8.6], [8.6, 8.6]]) K.b(x, 2, z, 2, 66, 2, CONC);
  for (const y of [22, 44]) K.b(-10.4, y, -10.4, 20.8, 1.4, 20.8, OLIVE_D);
  for (let f = 0; f < 3; f++) { const y = 9 + f * 22; win(K, -3, y, 10, 6, 8, 1, ...glow(f, 1)); win(K, -3, y, -10, 6, 8, -1, ...glow(f, 2)); winX(K, 10, y, -3, 6, 8, 1, ...glow(f, 3)); winX(K, -10, y, -3, 6, 8, -1, ...glow(f, 4)); }
  K.b(4, 2, 10, 5, 11, 0.5, GREEN_D); K.l(5, 13.6, 10.4, 3, 1, 1, N.white, 0, 0.8);
  K.sign('TOWER', -3, 60, 10.6, 14, 5, 'white', 'green', 0.5);
  // the walkway and its rail, the cab, the roof
  K.b(-17, 68, -17, 34, 1.6, 34, CONC_D);
  for (const [x, z, w, d] of [[-17, -17, 34, 0.5], [-17, 16.5, 34, 0.5], [-17, -17, 0.5, 34], [16.5, -17, 0.5, 34]]) { K.b(x, 73, z, w, 0.6, d, YELLOW); }
  for (let a = -17; a <= 16; a += 5.5) for (const e of [-17, 16.5]) { K.b(a, 69.6, e, 0.5, 3.6, 0.5, YELLOW); K.b(e, 69.6, a, 0.5, 3.6, 0.5, YELLOW); }
  K.b(-11, 69.6, -11, 22, 4, 22, WALL_D);
  for (let i = 0; i < 4; i++) { const g = 11 + i * 0.7, y = 73.6 + i * 2.6; K.l(-g, y, -g, 2 * g, 2.6, 2 * g, [0.5, 1.5, 1.4], 0, 0.42); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.b(a * g - 0.5, y, b * g - 0.5, 1, 2.6, 1, DARK); for (const e of [-1, 1]) { K.b(-0.4, y, e * g - 0.3, 0.8, 2.6, 0.6, DARK); K.b(e * g - 0.3, y, -0.4, 0.6, 2.6, 0.8, DARK); } }
  K.b(-16, 84, -16, 32, 2, 32, CONC_D); K.b(-13, 86, -13, 26, 1, 26, FELT);
  K.b(-2, 87, -2, 4, 4, 4, STEEL_D);
  [[2, 0, 0.02, N.green], [-2.8, 0, 0.52, N.white], [-0.4, 2, 0.27, N.green], [-0.4, -2.8, 0.77, N.white]].forEach(([x, z, ph, rgb]) => K.l(x, 91, z, 0.8, 2, 0.8, rgb, ph, 1.2));
  for (const [x, z, h] of [[10, 10, 22], [-11, 9, 14], [9, -11, 30]]) K.b(x, 87, z, 0.6, h, 0.6, DARK);
  K.l(8.6, 117, -11.4, 1.4, 1.4, 1.4, N.red, -0.9);
}

// ---- vehicles (their length along x, the front to +x) -----------------------------------------------------------------------
function jeep(K, o) {
  K.b(-13, 3, -6, 26, 2, 12, DARK);
  K.b(-13, 5, -6.5, 8, 5, 13, OLIVE); K.b(-5, 5, -6.5, 9, 3.2, 1.2, OLIVE); K.b(-5, 5, 5.3, 9, 3.2, 1.2, OLIVE); K.b(-5, 5, -5.5, 9, 0.6, 11, OLIVE_D);
  for (const z of [-4.6, 0.6]) { K.b(-4, 5.6, z, 4, 1.6, 4, CANVAS_D); K.b(-5, 7.2, z, 1.2, 3.6, 4, CANVAS_D); }
  K.b(4, 5, -5.5, 9, 4, 11, OLIVE); K.b(13, 5.4, -4.5, 0.5, 3.2, 9, OLIVE_D); for (let z = -3.6; z < 4; z += 1.4) K.b(13.4, 5.8, z, 0.2, 2.4, 0.6, BLACK);
  K.l(13.2, 6.4, -5.4, 0.5, 1.6, 1.4, WARM, 0, 0.9); K.l(13.2, 6.4, 4, 0.5, 1.6, 1.4, WARM, 0, 0.9);
  K.b(13.5, 3.4, -6.6, 1, 1.4, 13.2, DARK); K.b(5, 4.6, -7.2, 8, 1, 1.8, OLIVE); K.b(5, 4.6, 5.4, 8, 1, 1.8, OLIVE);
  K.b(3.4, 9, -6, 0.6, 5.2, 12, OLIVE_D); K.b(3.3, 9.7, -5.2, 0.8, 3.8, 10.4, GLASS);
  for (const x of [8.5, -8.5]) { wheel(K, x, 3, -7.6, 3, 2); wheel(K, x, 3, 5.6, 3, 2); }
  K.b(-14.8, 5.6, -3, 1.8, 6, 6, TYRE); K.b(-14.9, 7.6, -1, 0.3, 2, 2, STEEL_D); K.b(-13.9, 5, 3.6, 1, 4.4, 2.6, OLIVE_D);
  star(K, 8.5, 9, 0, 1.2); K.b(-12, 10, 5, 0.4, 13, 0.4, DARK);
  K.l(-13.3, 6, -6, 0.4, 1, 1.2, N.red, 0, 0.5); K.l(-13.3, 6, 4.8, 0.4, 1, 1.2, N.red, 0, 0.5);
  if (o.gun) { K.b(-9, 10, -0.5, 1, 5, 1, DARK); K.b(-13, 15, -0.6, 10, 1.3, 1.2, STEEL_D); K.b(-3, 15.3, -0.3, 5, 0.6, 0.6, DARK); K.b(-10, 13.4, 0.8, 2.6, 2, 2.4, OLIVE_D); }
}
function cargo(K, o) {
  const v = o.v || 'canvas';
  K.b(-27, 5, -7, 54, 2, 14, DARK);
  for (const x of [18, -10, -19]) { wheel(K, x, 4, -9.6, 4, 3); wheel(K, x, 4, 6.6, 4, 3); }
  // the cab and the bonnet
  K.b(8, 7, -9, 10, 12, 18, OLIVE); K.b(7.6, 19, -9.4, 10.8, 1, 18.8, CANVAS_D);
  K.b(17.6, 13, -8, 0.6, 5, 16, GLASS); K.b(17.7, 13, -0.4, 0.6, 5, 0.8, OLIVE_D); K.b(10, 13, 8.7, 6, 5, 0.5, GLASS); K.b(10, 13, -9.2, 6, 5, 0.5, GLASS);
  K.b(11, 8.4, 9.02, 3.4, 3.4, 0.12, WHITE); K.b(11, 8.4, -9.14, 3.4, 3.4, 0.12, WHITE);
  K.b(18, 7, -7, 8, 7, 14, OLIVE); K.b(26, 7.6, -6, 0.5, 6, 12, OLIVE_D); for (let z = -5; z < 5.4; z += 1.6) K.b(26.4, 8, z, 0.2, 5, 0.7, BLACK);
  K.b(17, 5.4, -9.4, 10, 3.4, 2.6, OLIVE); K.b(17, 5.4, 6.8, 10, 3.4, 2.6, OLIVE);
  K.l(26.4, 9, -9, 0.5, 2, 2, WARM, 0, 0.9); K.l(26.4, 9, 7, 0.5, 2, 2, WARM, 0, 0.9); K.b(26.6, 4.4, -9.4, 1.4, 2, 18.8, DARK);
  star(K, 22, 14, 0, 1.4);
  // the bed
  K.b(-27, 7, -9, 34, 1.5, 18, OLIVE_D);
  K.l(-27.3, 8.6, -8.6, 0.4, 1.2, 1.6, N.red, 0, 0.5); K.l(-27.3, 8.6, 7, 0.4, 1.2, 1.6, N.red, 0, 0.5);
  if (v === 'fuel') {
    [[8.5, 1.5, 4.5], [10, 2, 6.2], [12, 4, 7], [16, 2, 6.2], [18, 1.5, 4.5]].forEach(([y, h, w]) => K.b(-26, y, -w, 32, h, 2 * w, OLIVE_L));
    for (const x of [-24, -11, 2]) K.b(x, 8.4, -7.3, 1.2, 11.2, 14.6, STEEL_D);
    K.b(-20, 11.6, -7.2, 7, 3.4, 14.4, RED); K.b(-9, 19.5, -2, 5, 1, 4, STEEL_D);
    K.sign('FLAMMABLE', -2.5, 13.4, 7.3, 15, 3.6, 'red', 'yellow', 0.3);
    K.b(-27.6, 8.5, -5, 1.6, 4, 4, STEEL_D); K.b(-28, 9.5, 1, 2, 2, 5, DARK);
  } else if (v === 'med') {
    K.b(-26, 8.5, -9, 32, 13, 18, PVC); K.b(-26.2, 21.5, -8, 32.4, 0.8, 16, WHITE);
    for (const z of [9.02, -9.14]) { K.b(-12, 12, z, 2.4, 7, 0.12, RED); K.b(-14.3, 14.3, z, 7, 2.4, 0.12, RED); }
    K.b(-11.2, 22.3, -3.5, 2.4, 0.12, 7, RED); K.b(-13.5, 22.3, -1.2, 7, 0.12, 2.4, RED);
    K.b(-26.3, 9.4, -7, 0.4, 11, 14, WALL_D); K.b(-26.5, 9.4, -0.2, 0.3, 11, 0.4, DARK);
    K.l(9, 20, -3, 2, 1.2, 2, N.red, -0.2); K.l(9, 20, 1, 2, 1.2, 2, N.blue, -0.7);
  } else {
    K.b(-27, 8.5, -9, 34, 4, 1, OLIVE); K.b(-27, 8.5, 8, 34, 4, 1, OLIVE); K.b(-27, 8.5, -9, 1, 4, 18, OLIVE);
    K.b(-26, 12.5, -9, 32, 7, 18, CANVAS); K.b(-26, 19.5, -7.5, 32, 1.5, 15, CANVAS); K.b(-26, 21, -5, 32, 1, 10, CANVAS_L);
    for (const x of [-25, -17, -9, -1, 5]) { K.b(x, 12.5, -9.2, 0.8, 7.2, 18.4, CANVAS_D); K.b(x, 19.6, -7.7, 0.8, 1.5, 15.4, CANVAS_D); }
    K.b(-26.3, 12.5, -7, 0.5, 7, 14, BLACK);
  }
}
function apc(K) {
  for (const z of [-11, 7]) { K.b(-21, 0, z, 42, 6, 4, TYRE); K.b(-22, 1.5, z, 44, 3, 4, TYRE); }
  for (let i = 0; i < 5; i++) { K.discXY(-16 + i * 8, 2.8, -11.3, 2.4, 0.3, STEEL_D); K.discXY(-16 + i * 8, 2.8, 11, 2.4, 0.3, STEEL_D); }
  K.b(-22, 4, -7.5, 44, 3, 15, OLIVE_D);
  K.b(-20, 6, -11, 38, 9, 22, OLIVE); K.b(18, 6, -11, 2.5, 7, 22, OLIVE); K.b(20.5, 6, -11, 1.5, 4.5, 22, OLIVE); K.b(18, 13, -11, 1.2, 1.2, 22, OLIVE_D);
  K.b(-20, 15, -11, 36, 0.6, 22, OLIVE_D); K.b(21.6, 3, -10, 0.8, 5.5, 20, OLIVE_L);
  K.b(-14, 15.6, -8, 9, 0.5, 7, OLIVE); K.b(-14, 15.6, 1, 9, 0.5, 7, OLIVE); K.b(6, 15.6, 3, 7, 0.6, 6, OLIVE);
  K.b(2, 15.6, -5, 7, 3, 7, OLIVE_D); K.b(3, 18.6, -4, 5, 0.6, 5, DARK); K.b(8, 17, -2.2, 9, 1.2, 1.2, DARK); K.b(4, 17.4, -6.4, 2.6, 2.2, 1.4, OLIVE_D);
  K.l(21.5, 9.4, -9.6, 0.5, 1.8, 2, WARM, 0, 0.9); K.l(21.5, 9.4, 7.6, 0.5, 1.8, 2, WARM, 0, 0.9);
  K.b(-20.4, 6.6, -7, 0.4, 7.4, 14, OLIVE_D); K.b(-20.6, 8, -1, 0.3, 1.4, 2, DARK);
  K.l(-20.5, 12, -10, 0.4, 1, 1.4, N.red, 0, 0.5); K.l(-20.5, 12, 8.6, 0.4, 1, 1.4, N.red, 0, 0.5);
  star(K, -3, 15.6, 6.4, 1.3); K.b(-17, 15.6, 8.6, 0.5, 18, 0.5, DARK);
  K.b(-8, 9, 11.02, 5, 3, 0.12, WHITE); K.b(-8, 9, -11.14, 5, 3, 0.12, WHITE);
}
// a missile launcher on its trailer: four missiles on a raised rail (it goes up with them)
function sam(K) {
  K.b(-13, 2, -7, 26, 3, 14, OLIVE_D); for (const x of [-9, 7]) { wheel(K, x, 2.5, -8.4, 2.5, 1.6); wheel(K, x, 2.5, 6.8, 2.5, 1.6); }
  for (const [x, z] of [[-13.6, -8.6], [12, -8.6], [-13.6, 7], [12, 7]]) K.b(x, 0, z, 1.6, 5, 1.6, STEEL_D);
  K.discXZ(-2, 5, 0, 6, 1.6, STEEL_D); K.b(-5, 6.6, -3, 6, 7, 6, OLIVE);
  for (let j = 0; j < 5; j++) K.b(-11 + j * 4.6, 9 + j * 2.1, -6.5, 4.8, 1.6, 13, OLIVE_D);
  for (const z of [-5.6, -2.3, 1, 4.3]) {
    for (let j = 0; j < 6; j++) K.b(-13 + j * 4.2, 10.4 + j * 1.9 + (z > -1 ? 0 : 0), z, 4.4, 1.9, 1.9, WHITE);
    K.b(12.2, 21.3, z, 2, 1.9, 1.9, RED); K.b(-13.4, 9.4, z + 0.6, 2.4, 4, 0.6, OLIVE_L);
  }
  K.b(6, 5, -1.5, 2, 10, 3, STEEL_D); K.b(-12.6, 5, -6, 4, 3.4, 4, OLIVE); K.l(-12.9, 6.6, -5, 0.4, 0.8, 0.8, N.green, -0.3);
}

// ---- lamps ------------------------------------------------------------------------------------------------------------
// a light tower on its trailer: a generator, a mast, four lamps aimed to the front
function ltower(K) {
  K.b(-6, 2.4, -4, 12, 5, 8, YELLOW); K.b(-6.2, 7.4, -4.2, 12.4, 0.6, 8.4, DARK); K.b(-4, 3.4, 4, 5, 3, 0.2, DARK);
  wheel(K, 0, 2.2, -5.4, 2.2, 1.4); wheel(K, 0, 2.2, 4, 2.2, 1.4); K.b(6, 3, -0.6, 6, 1, 1.2, DARK); K.b(11, 0, -0.5, 1, 3.4, 1, DARK);
  for (const [x, z] of [[-8, -6], [7, -6], [-8, 5.2], [7, 5.2]]) K.b(x, 0, z, 1, 3, 1, STEEL_D);
  K.b(-0.7, 8, -0.7, 1.4, 34, 1.4, STEEL); K.b(-1, 8, -1, 2, 10, 2, STEEL_D);
  K.b(-6, 40, -0.6, 12, 1.2, 1.2, STEEL_D);
  for (const x of [-6, -2.9, 0.9, 4]) { K.b(x, 37.4, -1.2, 2.1, 3.6, 2.2, DARK); K.l(x + 0.2, 37.7, 1, 1.7, 3, 0.3, N.white, 0, 1.25); }
}
// a lamp post: steel, an arm out to the front, the lamp under its end
function slamp(K) {
  K.b(-1, 0, -1, 2, 1.6, 2, CONC_D); K.b(-0.45, 1.6, -0.45, 0.9, 31, 0.9, GREEN_D); K.b(-0.4, 32, -0.4, 0.8, 0.8, 7, GREEN_D);
  K.b(-1.2, 31.4, 4.6, 2.4, 1, 3.4, DARK); K.l(-1, 30.9, 4.8, 2, 0.5, 3, WARM, 0, 1.2);
}
// the siren: a steel pole, four horns, a red lamp turning on top, its box at the foot
function siren(K) {
  K.b(-3, 0, -3, 6, 1.4, 6, CONC); K.b(-0.8, 1.4, -0.8, 1.6, 52, 1.6, STEEL); K.b(1, 2, -1.6, 3, 7, 3.2, OLIVE_D); K.l(4, 6.6, -0.6, 0.3, 1, 1.2, N.red, -0.2);
  K.b(-3, 50, -3, 6, 1, 6, STEEL_D);
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let j = 0; j < 3; j++) {
    const s = 2 + j * 1.2, o = 1.5 + j * 2.2, w = 2.2;
    K.b(ax ? (ax > 0 ? o : -o - w) : -s / 2, 54 - s / 2, az ? (az > 0 ? o : -o - w) : -s / 2, ax ? w : s, s, az ? w : s, j === 2 ? STEEL : STEEL_D);
  }
  K.b(-1, 51, -1, 2, 6, 2, STEEL_D);
  [[1, 0, 0.02], [-2, 0, 0.52], [-0.5, 1.5, 0.27], [-0.5, -2.5, 0.77]].forEach(([x, z, ph]) => K.l(x, 57.4, z, 1, 1.6, 1, N.red, ph, 1.2)); K.b(-1, 57, -1, 2, 2.4, 2, DARK);
}

// ---- the camp ---------------------------------------------------------------------------------------------------------
// a ridge tent, its door to the front: v 'ridge' (olive), 'med' (white, a red cross, a flag), 'cmd' (camouflaged, an
// aerial, a map table under an awning)
function tent(K, o) {
  const v = o.v || 'ridge', body = v === 'med' ? PVC : CANVAS, lite = v === 'med' ? WHITE : CANVAS_L, dark = v === 'med' ? 0xb9beb8 : CANVAS_D;
  K.b(-12, 0, -16, 24, 5, 32, dark);
  for (let i = 0; i < 10; i++) K.b(-12 + i * 1.2, 5 + i, -16, 24 - i * 2.4, 1, 32, i === 9 ? lite : body);
  for (const z of [-16.2, -5.4, 5.4, 15.4]) for (let i = 0; i < 10; i++) K.b(-12.2 + i * 1.2, 5 + i, z, 24.4 - i * 2.4, 1.1, 0.8, dark);
  K.b(-4, 0, 15.7, 8, 10, 0.6, BLACK); K.b(-6.4, 0, 16, 2.6, 10, 0.5, lite); K.b(3.8, 0, 16, 2.6, 10, 0.5, lite);
  K.l(-1, 6.4, 16, 2, 2.2, 0.5, WARM, -0.2 - (o.x % 7) * 0.1, 0.9); K.b(-0.4, 0, 16.6, 0.8, 16, 0.8, WOOD); K.b(-0.4, 0, -17.2, 0.8, 16, 0.8, WOOD);
  for (const s of [-1, 1]) for (const z of [-14, 0, 14]) { K.b(s * 15 - 0.3, 0, z, 0.6, 1.4, 0.6, WOOD_D); K.b(s > 0 ? 12 : -15, 1, z + 0.1, 3, 0.3, 0.3, WOOD_L); }
  if (v === 'med') {
    K.discXY(0, 12.4, 16.3, 2.6, 0.3, WHITE); K.b(-0.5, 10.6, 16.6, 1, 3.6, 0.2, RED); K.b(-1.8, 11.9, 16.6, 3.6, 1, 0.2, RED);
    for (const s of [-1, 1]) { K.b(s * 5.5 - 1, 9.6, -3, 2, 0.14, 6, RED); K.b(s * 5.5 - 2.6, 9.6, -1, 5.2, 0.14, 2, RED); }
    K.b(8, 0, 18, 3, 1.6, 9, PVC); K.b(-13, 0, 19, 9, 1.6, 3, PVC); K.b(12.4, 1.6, 20, 2.2, 0.3, 4, 0x7a1d18);
    K.b(-10, 0, 17, 0.6, 22, 0.6, STEEL); K.b(-9.4, 16, 17, 6, 5.6, 0.3, WHITE); K.b(-7, 16.8, 16.9, 1.2, 4, 0.5, RED); K.b(-8.4, 18.2, 16.9, 4, 1.2, 0.5, RED);
  } else if (v === 'cmd') {
    for (let i = 0; i < 26; i++) { const a = pick(i, 3), b = pick(i, 9), lay = Math.floor(a * 9); K.b(-12 + lay * 1.2 + (b > 0.5 ? 0 : 24 - lay * 2.4 - 4), 6.02 + lay, -15 + b * 26, 4, 0.2, 3 + a * 4, [OLIVE_D, KHAKI, GREEN_D][i % 3]); }
    K.b(11, 0, -12, 0.6, 40, 0.6, DARK); K.b(11, 34, -12, 5, 2, 0.3, RED);
    K.b(-10, 10.4, 16, 20, 0.6, 10, CANVAS_D); K.b(-9.6, 0, 25, 0.6, 10.4, 0.6, WOOD); K.b(9, 0, 25, 0.6, 10.4, 0.6, WOOD);
    K.b(4, 0, 19, 7, 4.4, 5, WOOD_D); K.b(3.6, 4.4, 18.6, 7.8, 0.5, 5.8, WOOD_L); K.l(4.6, 4.9, 19.4, 4, 0.2, 3, COLD, 0, 0.6); K.b(9, 4.9, 19, 1.4, 2.6, 2, OLIVE_D); K.l(9.2, 6, 21, 1, 0.8, 0.2, N.green, -0.4);
  } else { K.b(7, 0, 18, 3, 3, 6, OLIVE_D); K.b(-11, 0, 18, 5, 2.4, 3, WOOD_L); }
}
// the mess: a canopy on poles, tables and benches under it, the field stove, lamps hung from the ridge
function mess(K) {
  for (const x of [-23, 0, 22]) for (const z of [-13, 12]) K.b(x, 0, z, 1, 14, 1, WOOD);
  for (let i = 0; i < 4; i++) K.b(-25 + i * 0.6, 14 + i * 1.2, -15 + i * 3.4, 50 - i * 1.2, 1.2, 30 - i * 6.8, i === 3 ? CANVAS_L : CANVAS);
  for (let x = -25; x < 25; x += 5) { K.b(x, 12.2, 14.4, 2.6, 1.8, 0.4, CANVAS_D); K.b(x + 2.4, 12.2, -15, 2.6, 1.8, 0.4, CANVAS_D); }
  for (const z of [-8, 3]) { K.b(-20, 4.4, z, 26, 0.7, 5, WOOD_L); for (const x of [-19, 4]) K.b(x, 0, z + 0.6, 1, 4.4, 3.8, WOOD); K.b(-20, 2.4, z - 2.4, 26, 0.6, 1.8, WOOD); K.b(-20, 2.4, z + 5.6, 26, 0.6, 1.8, WOOD); }
  for (const [x, z, c] of [[-16, -7, STEEL], [-8, -6, WHITE], [2, 4.4, STEEL], [-14, 5, WHITE], [-3, -7.4, RED]]) K.b(x, 5.1, z, 1.6, 1.2, 1.6, c);
  K.b(11, 0, -9, 10, 6, 6, STEEL_D); K.b(11.4, 6, -8.6, 4, 2.4, 3.6, STEEL); K.b(16.4, 6, -8.4, 3.4, 3.4, 3.4, DARK); K.b(19.4, 6, -7, 1.2, 16, 1.2, DARK); K.l(12, 1.6, -3.1, 4, 2.6, 0.3, N.orange, -0.5, 0.9);
  for (const x of [-14, -2, 10]) { K.b(x, 15.6, -0.3, 0.3, 2.4, 0.3, DARK); K.l(x - 0.7, 13.4, -1, 1.7, 1.6, 1.7, WARM, -0.1 - x * 0.02, 1); }
  barrel(K, 20, 0, 6, STEEL_D); crate(K, 12, 0, 6, 5);
}
// a quarantine tunnel: white sheeting on yellow hoops, lit from inside, its airlock to the front; what came out of it
function qtent(K, o) {
  const R = 10, L = 20, half = (y, r = R) => Math.sqrt(Math.max(0, r * r - y * y));
  for (let y = 0; y < R; y++) { const w = half(y + 0.5); K.b(-w, y, -L, 2 * w, 1, 2 * L, PVC); }
  for (let z = -L; z <= L - 1; z += 7.8) for (let y = 0; y < R + 1; y++) { const w = half(y + 0.5, R + 0.6); if (w > 0.4) K.b(-w, y, z, 2 * w, 1, 1, YELLOW); }
  for (const s of [-1, 1]) for (const z of [-16.4, -8.6, -0.8, 7]) K.l(s > 0 ? 8.5 : -8.9, 3.2, z, 0.4, 3, 5.6, SICK, -0.3 - z * 0.02, 0.42);
  for (let y = 0; y < R - 1; y++) { const w = half(y + 0.5) - 0.8; K.b(-w, y, L - 0.2, 2 * w, 1, 0.5, 0xc9cec9); K.b(-w, y, -L - 0.3, 2 * w, 1, 0.5, 0xc9cec9); }
  K.b(-4, 0, L, 8, 9.4, 3, YELLOW); K.b(-3.2, 0, L + 2.8, 6.4, 8.4, 0.4, BLACK); K.l(-2.2, 1, L + 3, 4.4, 6.6, 0.2, SICK, -0.5, 0.3);
  for (let i = 0; i < 5; i++) K.b(-4 + i * 1.6, 9.4, L + 2.6, 0.8, 1, 0.5, i & 1 ? YELLOW : BLACK);
  K.sign(o.name || 'QUARANTINE', 0, 14.4, L + 1.6, 22, 5, 'red', 'yellow', 0.5); for (const x of [-9, 8.2]) K.b(x, 0, L + 0.9, 0.8, 12, 0.8, YELLOW);
  // the trefoil on its board, three shapes laid out under sheets, a drum of waste
  K.b(11.6, 0, L - 1, 0.6, 8, 0.6, STEEL_D); K.discXY(12, 10, L - 0.8, 3.2, 0.4, YELLOW); for (const [x, y] of [[-1.6, 0.6], [1, 0.6], [-0.3, -1.8]]) K.b(12 + x, 10 + y, L - 0.3, 1.2, 1.2, 0.2, BLACK);
  for (const [x, z] of [[12, -14], [16, -13], [12.6, -2]]) { K.b(x, 0, z, 3, 1.5, 9, PVC); K.b(x + 0.4, 1.5, z + 1, 2.2, 0.5, 2.2, PVC); }
  barrel(K, 14, 0, 12, YELLOW); K.b(12.6, 2.2, 14.1, 2.8, 2, 0.2, BLACK);
}
// crates: v 0 timber crates, 1 ammunition on a pallet, 2 a heap under a tarpaulin
function crates(K, o) {
  const v = o.v || 0;
  if (v === 0) { crate(K, -9, 0, -5, 8); crate(K, 0, 0, -4, 8); crate(K, -5, 8, -4, 7, 6, WOOD); crate(K, 8.6, 0, -1, 5, 5, OLIVE_L); K.b(-7, 0, 4, 9, 1, 1.4, WOOD_D); }
  else if (v === 1) {
    K.b(-9, 0, -5, 18, 1, 10, WOOD_D); for (const z of [-4, 2]) K.b(-9, 1, z, 18, 0.6, 2, WOOD);
    for (let l = 0; l < 3; l++) for (let i = 0; i < 2 - (l === 2); i++) for (let j = 0; j < 2; j++) { const x = -8.4 + i * 8.6 + (l === 2 ? 4 : 0), z = -4.6 + j * 4.8, y = 1.6 + l * 3.2; K.b(x, y, z, 8, 3, 4.4, l & 1 ? OLIVE : OLIVE_D); K.b(x + 1, y + 1, z - 0.06, 6, 0.8, 4.52, YELLOW); K.b(x + 3.4, y + 2.2, z - 0.1, 1.2, 0.8, 0.2, DARK); }
  } else {
    K.b(-10, 0, -6, 20, 4, 12, CANVAS_D); K.b(-8, 4, -5, 14, 3, 9, CANVAS); K.b(-6, 7, -4, 8, 2, 6, CANVAS); K.b(4, 4, -3, 5, 2, 7, CANVAS_L);
    for (const x of [-7, 0, 6]) K.b(x, 0, -6.2, 0.4, 4.2, 12.4, WOOD_L); crate(K, 10.4, 0, -2, 5, 5, OLIVE_L); barrel(K, -12.4, 0, 3);
  }
}
// fuel drums on a pallet (they go up)
function drums(K) { K.b(-7, 0, -5, 14, 1, 10, WOOD_D); barrel(K, -3.6, 1, -2.2, OLIVE); barrel(K, 1.6, 1, -2.4, RED); barrel(K, -3.4, 1, 2.6, OLIVE_D); barrel(K, 1.8, 1, 2.4, OLIVE); K.b(5.4, 1, -1, 1.6, 4.4, 2.6, RED); }
// a sandbag wall, o.n bags long (two voxels each)
function bagwall(K, o) { const n = o.n || 7; bags(K, -n * 2, 0, -1.5, n, 4); }
// a gun nest: sandbags on three sides, a machine gun on its tripod, ammunition
function nest(K) {
  bags(K, -12, 0, 6, 6, 4); bags(K, -6, 0, -12, 4, 4, true); bags(K, -6, 0, 9, 4, 4, true);
  tripodGun(K, 0, 0, 2); K.b(-7, 0, -4, 4, 2.6, 3, OLIVE_D); K.b(-6.6, 1, -4.06, 3.2, 0.6, 0.1, YELLOW); K.b(4, 0, -5, 3, 2, 2, OLIVE);
}
// three concrete barriers in a row, striped
function jersey(K) {
  for (let i = 0; i < 3; i++) { const x = -22 + i * 15; K.b(x, 0, -2.2, 14, 2, 4.4, CONC); K.b(x, 2, -1.4, 14, 2.6, 2.8, CONC); K.b(x, 4.6, -0.9, 14, 2, 1.8, CONC_D); K.stripes(x, 4.9, -0.96, 14, 1.2, 1.92, 7, YELLOW, BLACK); }
}
// tank traps: three steel hedgehogs
function hedgehog(K) {
  for (const [x, z] of [[-8, 0], [0, -1], [8, 1]]) { K.b(x - 4, 3, z - 0.6, 8, 1.2, 1.2, RUST); K.b(x - 0.6, 3.2, z - 4, 1.2, 1.2, 8, STEEL_D); K.b(x - 0.6, 0, z - 0.6, 1.2, 8, 1.2, RUST); K.b(x - 1, 2.8, z - 1, 2, 1.8, 2, STEEL_D); }
}
// a sign board on two posts (o.name; o.neon and o.frame its colours)
const postW = (o) => Math.max(16, (o.name || '').length * 2.5 + 6);
function post(K, o) { const w = postW(o); for (const x of [-w / 2 + 1, w / 2 - 2]) K.b(x, 0, -0.5, 1, 18.4, 1, STEEL_D); K.sign(o.name || 'KEEP OUT', 0, 15.4, 0.6, w, 6, o.neon || 'yellow', o.frame || 'white'); }
// a guard hut at a gate: its window lit, STOP on the roof, a striped pole, sandbags
function guardhut(K) {
  K.b(-6, 0, -6, 12, 1, 12, CONC_D); K.b(-5.6, 1, -5.6, 11.2, 14, 11.2, OLIVE); K.b(-5.8, 1, -5.8, 11.6, 3, 11.6, OLIVE_D);
  win(K, -3.5, 7, 5.6, 7, 5, 1, WARM, 0.75); winX(K, 5.6, 7, -3, 5, 5, 1, WARM, 0.7); winX(K, -5.6, 7, -3, 5, 5, -1, null);
  K.b(-2, 1, -5.9, 4.4, 11, 0.4, GREEN_D);
  K.b(-7.5, 15, -7.5, 15, 1, 15, DARK); K.b(-6, 16, -6, 12, 1, 12, OLIVE_D); K.b(-3.5, 17, -3.5, 7, 0.8, 7, OLIVE_D);
  K.sign('STOP', 0, 20.4, 0.4, 12, 5, 'red', 'white', 0.5); K.b(-0.5, 17.8, -0.4, 1, 0.6, 0.8, DARK);
  K.b(7, 0, 4, 2, 7, 2, STEEL_D); K.stripes(8, 5.4, 4.6, 16, 1, 1, 8, RED, WHITE); K.b(5, 5, 4.4, 2, 2, 1.4, DARK);
  bags(K, -18, 0, 4, 3, 3);
}
// the stand of a radar set: a cabin on a trailer, its lamps, the post its dish turns on (basemoves.js)
function radar(K) {
  K.b(-13, 2, -6.5, 26, 2, 13, DARK); for (const x of [-8, 8]) { wheel(K, x, 2.6, -8, 2.6, 1.6); wheel(K, x, 2.6, 6.4, 2.6, 1.6); }
  for (const [x, z] of [[-13.6, -8], [12, -8], [-13.6, 6.4], [12, 6.4]]) K.b(x, 0, z, 1.6, 4, 1.6, STEEL_D);
  K.b(-13, 4, -6.5, 15, 11, 13, OLIVE); K.b(-13.4, 15, -6.9, 15.8, 0.8, 13.8, OLIVE_D); K.b(-8, 4, 6.5, 5, 9, 0.4, OLIVE_D);
  win(K, -1.6, 9, 6.5, 2.6, 2.6, 1, COLD, 0.6); for (let i = 0; i < 4; i++) K.l(-12 + i * 1.4, 12.6, 6.5, 0.8, 0.8, 0.3, i & 1 ? N.green : N.red, -0.2 - i * 0.2);
  for (let z = -5; z < 5; z += 1.6) K.b(-13.3, 6, z, 0.3, 6, 0.8, BLACK);
  K.b(4, 4, -4, 8, 3, 8, OLIVE_D); K.b(6.6, 7, -1.4, 2.8, 13, 2.8, STEEL_D); K.b(5.6, 19, -2.4, 4.8, 1.4, 4.8, STEEL);
}
// the stand of a sentry gun: a ring of sandbags, a steel post, its ammunition, its lamp (basemoves.js puts the gun on it)
function sentry(K) {
  bags(K, -8, 0, -8, 4, 2); bags(K, -8, 0, 5, 4, 2); bags(K, -5, 0, -8, 2, 2, true); bags(K, -5, 0, 5, 2, 2, true);
  K.b(-2.4, 0, -2.4, 4.8, 1.4, 4.8, STEEL_D); K.b(-1.2, 1.4, -1.2, 2.4, 6.6, 2.4, STEEL_D); K.b(-1.8, 8, -1.8, 3.6, 0.8, 3.6, STEEL);
  K.b(2.4, 0, -3.6, 2.6, 3, 4, OLIVE_D); K.b(2.36, 1.2, -3.2, 0.1, 0.7, 3.2, YELLOW);
}
// the runway's lights (nothing to hit): o.lamps, each [x, z, colour, its turn in the chase] in cubes from the middle
function rwlights(K, o) { for (const [x, z, c, ph] of o.lamps) { K.b(x - 0.5, 0, z - 0.5, 1, 0.5, 1, DARK); K.l(x - 0.6, 0.5, z - 0.6, 1.2, 0.7, 1.2, N[c], ph, c === 'white' ? 1.1 : 1); } }

// what is left of one of them: a heap of scrap (one model, shared)
export function scrap(K) {
  const R = (() => { let s = 4242; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; }; })();
  for (let i = 0; i < 18; i++) {
    const w = 3 + R() * 9, d = 2 + R() * 5, long = R() < 0.5, x = -13 + R() * (26 - (long ? w : d)), z = -7 + R() * (14 - (long ? d : w));
    K.b(x, 0, z, long ? w : d, 0.6 + R() * 1.8, long ? d : w, [OLIVE_D, OLIVE, STEEL_D, BAG_D, DARK, CONC_D][i % 6]);
  }
  K.b(-9, 0, -6, 8, 2.8, 1, STEEL_D); K.b(4, 0, 2, 1, 3.6, 6, OLIVE); K.b(-2, 0, -1, 4, 1.6, 4, TYRE);
}

// ---- the kinds (fairstalls.js's table: what stands on the ground in voxels, how tall, how much it takes) --------------------
Object.assign(KINDS, {
  hq: { make: hq, foot: [[-40.5, -20.5, 40.5, 20.5], [-7, 20.5, 7, 25]], top: 24, hp: 1100, tough: true, heap: 3.2, pool: [0, 30, 20] },
  hut: { make: hut, foot: [[-36.5, -11.3, 36.5, 11.3]], top: 11.6, hp: 520, tough: true, heap: 2.6, pool: null },
  gtower: { make: gtower, foot: [[-6.6, -6.6, -5.4, -5.4], [5.4, -6.6, 6.6, -5.4], [-6.6, 5.4, -5.4, 6.6], [5.4, 5.4, 6.6, 6.6]], shot: [[-8, -8, 8, 8, 18, 28]], top: 28, hp: 260, tough: true, heap: 1.1, pool: null },
  wtower: { make: wtower, foot: [[-10.6, -10.6, -9, -9], [9, -10.6, 10.6, -9], [-10.6, 9, -9, 10.6], [9, 9, 10.6, 10.6], [-1.5, -1.5, 1.5, 1.5]], shot: [[-10, -10, 10, 10, 30, 48]], top: 48, hp: 380, tough: true, heap: 1.6, pool: null },
  ftank: { make: ftank, foot: [[-9.4, -4.2, 9.4, 4.2], [-4.2, -9.4, 4.2, 9.4], [-7.2, -7.2, 7.2, 7.2]], top: 21, hp: 260, tough: true, boom: 13, chain: 40, heap: 1.5, pool: null },
  mast: { make: mast, foot: [[-3, -3, 3, 3]], shot: [[-2.6, -2.6, 2.6, 2.6, 0, 72]], top: 72, hp: 240, tough: true, heap: 0.7, pool: null },
  flag: { make: flag, foot: [[-1.2, -1.2, 1.2, 1.2]], top: 42, hp: 60, heap: 0.2, pool: [0, 3, 8] },
  ctower: { make: ctower, foot: [[-5.6, -5.6, 5.6, 5.6]], shot: [[-8.5, -8.5, 8.5, 8.5, 34, 44]], top: 44, hp: 560, tough: true, heap: 1.4, pool: [0, 8, 10] },
  jeep: { make: jeep, foot: [[-7.4, -3.8, 7.4, 3.8]], top: 7.5, hp: 140, tough: true, boom: true, heap: 0.7, pool: null },
  cargo: { make: cargo, foot: [[-13.8, -4.9, 13.8, 4.9]], top: 11, hp: 220, tough: true, boom: true, heap: 1.2, pool: null },
  tanker: { make: (K, o) => cargo(K, { ...o, v: 'fuel' }), foot: [[-13.8, -4.9, 13.8, 4.9]], top: 11, hp: 180, tough: true, boom: 10, chain: 22, heap: 1.2, pool: null },
  apc: { make: apc, foot: [[-11.2, -5.7, 11.2, 5.7]], top: 9.6, hp: 420, tough: true, heap: 1.1, pool: null },
  sam: { make: sam, foot: [[-7, -4.4, 7, 4.4]], top: 12, hp: 220, tough: true, boom: 9, heap: 0.9, pool: null },
  ltower: { make: ltower, foot: [[-3.2, -2.2, 3.2, 2.2]], top: 21, hp: 45, heap: 0.35, pool: [0, 11, 17] },
  slamp: { make: slamp, foot: [[-0.6, -0.6, 0.6, 0.6]], top: 17, hp: 25, heap: 0.14, pool: [0, 4, 13] },
  siren: { make: siren, foot: [[-1.4, -1.4, 1.4, 1.4]], shot: [[-3.4, -3.4, 3.4, 3.4, 24, 30]], top: 30, hp: 160, tough: true, heap: 0.4, pool: null },
  tent: { make: tent, foot: [[-6.2, -8.2, 6.2, 8.4]], top: 8, hp: 60, heap: 0.9, pool: [0, 11, 7] },
  mess: { make: mess, foot: [[-12.4, -7.4, 12.4, 7.4]], top: 9.6, hp: 70, heap: 1.3, pool: [0, 0, 13] },
  qtent: { make: qtent, foot: [[-5.4, -10.2, 5.4, 11.6]], top: 6, hp: 70, heap: 1, pool: [0, 0, 14] },
  crates: { make: crates, foot: [[-5, -3, 5.6, 3]], top: 7, hp: 40, heap: 0.55, pool: null },
  drums: { make: drums, foot: [[-3.6, -2.6, 3.6, 2.6]], top: 4, hp: 25, boom: 7, heap: 0.4, pool: null },
  bagwall: { make: bagwall, foot: (o) => [[-(o.n || 7), -0.9, o.n || 7, 0.9]], top: 3, hp: 60, heap: 0.5, pool: null },
  nest: { make: nest, foot: [[-6.2, -6.2, 6.2, 4.6]], top: 4.4, hp: 80, heap: 0.7, pool: null },
  jersey: { make: jersey, foot: [[-11.2, -1.2, 11.2, 1.2]], top: 3.4, hp: 70, heap: 0.5, pool: null },
  hedgehog: { make: hedgehog, foot: [[-6.2, -2.2, 6.2, 2.4]], top: 4, hp: 50, heap: 0.4, pool: null },
  post: { make: post, foot: (o) => [[-postW(o) / 4, -0.5, postW(o) / 4, 0.5]], top: 9.4, hp: 30, heap: 0.25, pool: [0, 3, 7] },
  guardhut: { make: guardhut, foot: [[-3.2, -3.2, 3.2, 3.2]], top: 10, hp: 70, heap: 0.6, pool: [0, 7, 9] },
  radar: { make: radar, foot: [[-6.8, -4, 6.8, 4]], shot: [[-1, -6, 9, 6, 8, 19]], top: 10.4, hp: 240, tough: true, heap: 0.9, pool: null },
  sentry: { make: sentry, foot: [[-4.2, -4.2, 4.2, 4.2]], top: 7, hp: 240, tough: true, heap: 0.6, pool: null },
  rwlights: { make: rwlights, foot: null, top: 0, hp: 0, pool: null },
});
