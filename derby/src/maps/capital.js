// Capital Circuit: Washington's race (Will, 2026-11-24, after Empire City: "this feels good as a baseline. Can we do
// washington DC as our next track?"; then "Build as drawn, spring day"). The plan Will was shown:
// /mnt/project-files/race-dc/capital-circuit-plan.png.
//
// Nothing here is Monster Mayhem's Washington but its buildings: the land, the water and every street are laid out for
// the race, and the landmarks (src/dc_landmarks.js) stand where the lap wants them. Three laps with the guns on, about
// 5,300 voxels a lap. From the line on Pennsylvania Avenue, in front of the White House, heading east:
//   down the Avenue's diagonal to the Capitol, round its north side and its east front, up onto the Southeast Freeway
//   (a flyover along the Anacostia, two long bends in the air), down across the Capitol's west front, left along the
//   middle of the Mall, a swing round the Washington Monument on its knoll, through the Reflecting Pool (wheels in the
//   water) straight at the Lincoln Memorial, half left over the Memorial Bridge into Virginia, the parkway past the
//   Pentagon, back over the 14th Street Bridge, past the Jefferson Memorial and up the Tidal Basin under the cherry
//   trees, down into the Metro (a vaulted station, under the Mall), up in the Federal Triangle, left along E Street
//   between the White House's lawn and the Ellipse, Constitution Avenue, up into Georgetown (a walled street climbing
//   over the roofs), down into Rock Creek's woods under a high bridge, round Dupont Circle, and Connecticut Avenue's
//   diagonal back to the line.
//
// Built the way Empire City is (maps/empire.js): the road's height is maps/heights.js's, the decks and the cut are
// maps/roads.js's, and the course is shut in the whole way round, so only what stands beside it is voxels: the
// barriers, the rows of buildings that face it, the landmarks and the first row of trees. The rest of the city is
// boxes with a drawn front (maps/blocks.js), the trees behind are models (maps/trees.js) and the water moves under
// one flat sheet (maps/water.js).
import { WX, WZ, M, place, ctx, setSeed, put, begin, LOC, ri, rnd, vehicles } from '../../../src/world.js';
import { lampPost } from '../../../src/kit.js';
import { brownstone } from '../../../src/nyc_kit.js';
import { rowhouse } from '../../../src/landmarks.js';
import { haussmann } from '../../../src/paris_kit.js';
import { shop } from '../../../src/buildings_a.js';
import { fedblock, dcoffice, temple, dcgrove } from '../../../src/dc_kit.js';
import { WHITEHOUSE, CAPITOL, LINCOLN, JEFFERSON, CASTLE, PENTAGON, whitehouse, capitol, lincoln, jefferson, castle, pentagon, wmonument } from '../../../src/dc_landmarks.js';
import { grabModel, statueMesh } from './statue.js';
import { makeBlocks } from './blocks.js';
import { plantTree, makeGrove } from './trees.js';
import { makeWater } from './water.js';
import { DUSK } from '../looks/dusk.js';
import { canvasFor, finish, pickSpot, GK } from './common.js';
import { makeTrack, streetLoop, racingLine } from './racetrack.js';
import { gantry, gatesFor, gridFor, paintCourse, grassOf, surfaceAt, radarCourse } from './circuit.js';
import { makeHeights } from './heights.js';
import { makeRoads } from './roads.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ramp = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const hump = (d, a, b, c, e) => (d <= a || d >= e ? 0 : d < b ? ramp((d - a) / (b - a)) : d <= c ? 1 : ramp((e - d) / (e - c)));

// ---- the land ------------------------------------------------------------------------------------------------------
// North is low z. The Potomac comes down the west edge past Georgetown, swings south-east between the Lincoln Memorial
// and Virginia and leaves by the bottom; the Anacostia shows in the south-east corner. Each shore is a line of points
// [x, z] going south (the Anacostia's going east).
const BANK = [[62, -10], [62, 470], [74, 540], [90, 630], [217, 679], [330, 812], [420, 900], [455, 988], [470, 1040]];   // Washington's shore: the city is east of it
const VA = [[-10, 600], [50, 680], [167, 772], [262, 850], [330, 915], [340, 988], [335, 1040]];                         // Virginia's: it is west of this
const ANA = [[735, 1040], [770, 968], [1040, 952]];                                                                       // the Anacostia's: water south of it
const BASIN = { x: 556, z: 792, rx: 76, rz: 42 };                  // the Tidal Basin
const POOL = { x0: 312, z0: 552, x1: 424, z1: 608, dip: 1 };       // the Reflecting Pool: the road runs through it, a voxel down
const KNOLL = { x: 540, z: 580, r: 104, h: 10 };                   // the Monument's
const xAt = (P, z) => { if (z <= P[0][1]) return P[0][0]; for (let i = 1; i < P.length; i++) if (z <= P[i][1]) { const a = P[i - 1], b = P[i]; return a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]); } return P[P.length - 1][0]; };
const anaZ = (x) => (x < ANA[0][0] ? 1e9 : x < ANA[1][0] ? ANA[0][1] + (x - ANA[0][0]) * (ANA[1][1] - ANA[0][1]) / (ANA[1][0] - ANA[0][0]) : ANA[1][1] + (x - ANA[1][0]) * (ANA[2][1] - ANA[1][1]) / (ANA[2][0] - ANA[1][0]));
const virginia = (x, z) => z >= VA[0][1] && x < xAt(VA, z);
const inBasin = (x, z) => ((x - BASIN.x) / BASIN.rx) ** 2 + ((z - BASIN.z) / BASIN.rz) ** 2 < 1;
const inPool = (x, z) => x >= POOL.x0 && x < POOL.x1 && z >= POOL.z0 && z < POOL.z1;
// The great buildings. The engine builds them small (a lot of 86 or 132, for a game seen from high up), and beside this
// road they looked like models of themselves; so, as Liberty is in Empire City, each is built once by the engine's own
// kit, copied out of the world and drawn as a model at one and a half or two times the size. Nothing reaches them: the
// course is shut in. [name, builder, the engine's lot, how tall to copy, facing (0 north, 1 east, 2 south, 3 west),
// times bigger, the corner of its ground here (x, z), turned (radians, the Pentagon)]
const BIG = [
  ['White House', whitehouse, WHITEHOUSE.S, 60, 0, 2, 454, 236],          // its north front on the start straight
  ['Capitol', capitol, CAPITOL.S, 118, 3, 1.5, 774, 481],                 // the west front, toward the Mall
  ['Lincoln', lincoln, LINCOLN.S, 54, 1, 1.5, 97, 510],                   // looking up the Reflecting Pool
  ['Jefferson', jefferson, JEFFERSON.S, 54, 0, 1.5, 492, 829],            // across the Tidal Basin
  ['Monument', wmonument, 40, 174, 0, 2, 500, 540],
  ['Pentagon', pentagon, PENTAGON.S, 30, 0, 2, -70, 868, -0.46],          // half of it past the map's edge
];
// and the one that stands as the engine builds it: [name, x, z, size, facing, builder, options]
const FIXED = [
  ['Castle', 548, 665, CASTLE.S, 0, castle],
];
const inLot = (x, z) => FIXED.some((f) => x >= f[1] && x < f[1] + f[3] && z >= f[2] && z < f[2] + f[3]) || BIG.some((b) => x >= b[6] && x < b[6] + b[2] * b[5] && z >= b[7] && z < b[7] + b[2] * b[5]);
const land = (x, z) => virginia(x, z) || (x >= xAt(BANK, z) && z < anaZ(x) && (!inBasin(x, z) || inLot(x, z)));
// where the ground is green and the barriers stone: Virginia, everything south of Constitution Avenue (the Mall, the
// parks round the basin and the pool), and Rock Creek
const leafy = (x, z) => virginia(x, z) || (z > 474 && x < 765) || (x > 166 && x < 318 && z > 98 && z < 300);
// where nothing is built but the landmarks: those, the Capitol's grounds, the President's (Lafayette Square and the
// lawns), and the garden in the middle of Dupont Circle
const inPark = (x, z) => leafy(x, z) || (x >= 765 && x <= 980 && z >= 420 && z <= 690) || (x >= 440 && x <= 640 && z >= 118 && z <= 420) || (x > 366 && x < 414 && z > 90 && z < 176);

// ---- the course ----------------------------------------------------------------------------------------------------
// each corner [x, z, radius of the curve round it]; a leg is the run from one corner to the next, numbered by its first
const LINE_X = 600, LINE_Z = 200, GANTRY_Y = 27;
const COURSE = [
  [LINE_X, LINE_Z, 0],   //  0  the line, on Pennsylvania Avenue in front of the White House: east
  [665, 200, 60],        //  1  half right, down the Avenue to the Capitol
  [855, 390, 60],        //  2  half left, round the Capitol: its north side
  [998, 390, 50],        //  3  right, the east front, then up onto the freeway
  [998, 915, 50],        //  4  right, the Southeast Freeway along the Anacostia
  [740, 915, 50],        //  5  right, down off it and across the Capitol's west front
  [740, 580, 45],        //  6  left, down the middle of the Mall
  [630, 580, 50],        //  7  half left, round the Monument's knoll
  [575, 635, 50],        //  8  half right
  [505, 635, 50],        //  9  half right
  [450, 580, 50],        // 10  half left, through the Reflecting Pool at the Lincoln Memorial
  [270, 580, 60],        // 11  left, over the Memorial Bridge
  [130, 840, 45],        // 12  left, the parkway past the Pentagon
  [275, 988, 45],        // 13  half left, the 14th Street Bridge
  [660, 988, 55],        // 14  left, past the Jefferson Memorial, up the Tidal Basin under the cherry trees, down into the Metro
  [660, 444, 45],        // 15  left, Constitution Avenue, past the White House's south lawn
  [260, 444, 45],        // 16  right
  [260, 330, 40],        // 17  left, into Georgetown
  [140, 330, 35],        // 18  right, up the hill
  [140, 72, 35],         // 19  right, along the heights
  [240, 72, 35],         // 20  right, down into Rock Creek
  [240, 250, 35],        // 21  left, along the creek, under the high bridge
  [340, 250, 35],        // 22  left, up to Dupont Circle
  [340, 62, 44],         // 23  right, round it
  [440, 62, 44],         // 24  right
  [440, 150, 40],        // 25  half left, down Connecticut Avenue
  [490, 200, 40],        // 26  half left, onto the line
];
const NL = COURSE.length;
// how much room each side of the middle line (the barriers stand just past it)
function widthAt(leg, x, z) {
  switch (leg) {
    case 26: case 0: case 1: return 30;                // the Avenue, and the grid on it
    case 2: return 26;
    case 3: return 22;                                 // the east front, and the freeway
    case 4: return 24;
    case 5: return z > 800 ? 24 : 28;
    case 6: return 32;                                 // the Mall
    case 7: case 8: case 9: return 26;                 // round the Monument
    case 10: return x < POOL.x1 + 14 && x > POOL.x0 - 4 ? 22 : 28;   // the pool
    case 11: return 22;                                // the Memorial Bridge
    case 12: return 28;                                // the parkway
    case 13: return 24;                                // the 14th Street Bridge
    case 14: return z > 796 ? 22 : z > 496 ? 18 : 24;  // the cherry trees, the Metro, the Federal Triangle
    case 15: return 30;                                // Constitution Avenue
    case 16: return 26;
    case 17: return 22;
    case 18: case 19: return 20;                       // Georgetown
    case 20: return 22;
    case 21: return 24;                                // Rock Creek
    case 22: return 26;
    case 23: case 24: case 25: return 28;              // Dupont Circle, Connecticut Avenue
    default: return 26;
  }
}
const W_MOST = 40;
// The parts off the flat ground. A deck is a road in the air and a cut one below the ground; it runs from one place on
// the course to another, each [leg, how far along that leg from its first corner], so it can go round corners. `h` is
// how high (or deep) and `up` the length of the slope at each end. A deck no higher than `solid` stands on a wall (a
// ramp, a terrace); higher, it is open underneath on `piers`. A cut's `roof` and `open` (a station) are places too.
const PARTS = [
  { name: 'Freeway', kind: 'deck', from: [3, 250], to: [5, 110], h: 16, up: 76, piers: 44, solid: 6 },
  { name: 'Memorial Bridge', kind: 'deck', from: [11, 78], to: [11, 252], h: 9, up: 46, solid: 99 },
  { name: '14th Street Bridge', kind: 'deck', from: [13, 20], to: [13, 210], h: 14, up: 62, piers: 40, solid: 6 },
  { name: 'Metro', kind: 'cut', from: [14, 198], to: [14, 488], h: -16, up: 72, roof: [[14, 273], [14, 443]], roofY: -1.5, open: [[14, 290], [14, 406]] },   // (no slope steeper than a long car can take: vehicle.js STEP_UP)
  { name: 'Georgetown', kind: 'deck', from: [18, 40], to: [20, 130], h: 14, up: 70, solid: 99 },
];
const OVER = { from: [6, 52], to: [6, 108] };   // where the Mall's road goes over the Metro: a road at the ground's height, over the cut
const MARGIN = 6.5;                 // how far inside the room the racing line keeps a car's middle
const GATES = 64;                   // checkpoint gates round the lap

// ---- the course's shape: plain numbers, worked out once ------------------------------------------------------------
let CO = null;
function course() {
  if (CO) return CO;
  const T = makeTrack({ pts: streetLoop(COURSE), halfW: W_MOST, smooth: false, WX, WZ, reach: W_MOST + 14 });
  const { N, X, Z, TX, TZ, K, STEP } = T;
  // which leg each sample is on (the nearest that runs its way), and how far along it
  const leg = new Int16Array(N), far = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let bd = 1e9;
    for (let k = 0; k < NL; k++) {
      const a = COURSE[k], b = COURSE[(k + 1) % NL], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      if ((TX[i] * dx + TZ[i] * dz) / l < 0.7) continue;
      const u = ((X[i] - a[0]) * dx + (Z[i] - a[1]) * dz) / (l * l), t = clamp(u, 0, 1), d = Math.hypot(X[i] - a[0] - dx * t, Z[i] - a[1] - dz * t);
      if (d < bd) { bd = d; leg[i] = k; far[i] = u * l; }
    }
  }
  const find = ([k, t]) => { let bi = 0, bd = 1e9; for (let i = 0; i < N; i++) if (leg[i] === k && Math.abs(far[i] - t) < bd) { bd = Math.abs(far[i] - t); bi = i; } return bi; };
  // the room each side, eased from one width to the next (a voxel of width every two along)
  const raw = new Float32Array(N), W = new Float32Array(N), R = Math.round(60 / STEP);
  for (let i = 0; i < N; i++) raw[i] = widthAt(leg[i], X[i], Z[i]);
  for (let i = 0; i < N; i++) { let m = raw[i]; for (let k = -R; k <= R; k++) m = Math.min(m, raw[T.at(i + k)] + Math.abs(k) * STEP * 0.5); W[i] = m; }
  // on the inside of a bend, no further than short of the middle of the curve
  const WL = W.slice(), WR = W.slice();
  for (let i = 0; i < N; i++) {
    let k = 0; for (let j = -3; j <= 3; j++) { const v = K[T.at(i + j)]; if (Math.abs(v) > Math.abs(k)) k = v; }
    if (Math.abs(k) > 1 / 200) { const A = k > 0 ? WL : WR; A[i] = Math.min(A[i], 1 / Math.abs(k) - 4); }
  }
  T.WL = WL; T.WR = WR;
  // the heights: H at each sample, and what it is on (0 the ground, 1 a deck, 2 a cut)
  const H = new Float32Array(N), on = new Uint8Array(N), hilly = new Uint8Array(N);
  const span = (from, to) => { const i0 = find(from), n = ((find(to) - i0) % N + N) % N; return { i0, n }; };
  const parts = PARTS.map((p) => {
    const { i0, n } = span(p.from, p.to), D = n * STEP;
    for (let k = 0; k <= n; k++) { const i = T.at(i0 + k); H[i] = p.h * hump(k * STEP, 0, p.up, D - p.up, D); on[i] = p.kind === 'deck' ? 1 : 2; }
    const q = { ...p, i0, n, H, half: (i) => W[i] }, ks = (pl) => ((find(pl) - i0) % N + N) % N;
    if (p.roof) {
      q.roof = [ks(p.roof[0]), ks(p.roof[1])];
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (let k = q.roof[0]; k <= q.roof[1]; k++) { const i = T.at(i0 + k); x0 = Math.min(x0, X[i] - W[i]); x1 = Math.max(x1, X[i] + W[i]); z0 = Math.min(z0, Z[i]); z1 = Math.max(z1, Z[i]); }
      q.roofBox = [x0, z0, x1, z1];   // (the Metro runs along z)
    }
    if (p.open) { q.open = [ks(p.open[0]), ks(p.open[1])]; const a = T.at(i0 + q.open[0]), b = T.at(i0 + q.open[1]); q.openZ = [Math.max(Z[a], Z[b]), Math.min(Z[a], Z[b])]; }
    return q;
  });
  // the Monument's knoll, and the pool's floor
  const knoll = (x, z) => KNOLL.h * ramp(1 - Math.hypot(x - KNOLL.x, z - KNOLL.z) / KNOLL.r);
  for (let i = 0; i < N; i++) {
    if (on[i]) continue;
    const k = knoll(X[i], Z[i]); if (k > 0.02) { H[i] = k; hilly[i] = 1; }
    if (X[i] > POOL.x0 + 1 && X[i] < POOL.x1 - 1 && Z[i] > POOL.z0 && Z[i] < POOL.z1) H[i] = -POOL.dip;
  }
  let h0 = -1, h1 = -1; for (let i = 0; i < N; i++) if (hilly[i]) { if (h0 < 0) h0 = i; h1 = i; }
  return (CO = { T, leg, far, W, H, on, hilly, parts, knoll, hill: { i0: h0, n: h1 - h0 }, over: span(OVER.from, OVER.to), find });
}
// how high the road is, anywhere (heights.js)
let HT = null;
function heights() {
  if (HT) return HT;
  const { T, W, H, parts, knoll, hill, over } = course(), hm = makeHeights();
  for (let z = Math.floor(KNOLL.z - KNOLL.r); z <= KNOLL.z + KNOLL.r; z++) for (let x = Math.floor(KNOLL.x - KNOLL.r); x <= KNOLL.x + KNOLL.r; x++) hm.gnd[z * WX + x] = knoll(x + 0.5, z + 0.5);
  hm.lay(T, H, hill.i0, hill.i0 + hill.n, (i) => W[i] + 3, { kind: 'hill', flat: 2, fade: 14 });   // the road round it, cut level into its side
  for (let z = POOL.z0; z < POOL.z1; z++) for (let x = POOL.x0; x < POOL.x1; x++) hm.gnd[z * WX + x] = -POOL.dip;
  for (const p of parts) hm.lay(T, H, p.i0, p.i0 + p.n, (i) => W[i], { kind: p.kind, top: 4 });
  hm.lay(T, new Float32Array(T.N), over.i0, over.i0 + over.n, (i) => W[i], { kind: 'deck' });       // (after the cut it crosses)
  return (HT = hm);
}
// what is taken, a voxel at a time: `road` the course on the ground (not the decks over it or the cut under it), `used`
// the whole course and a little either side (nothing is built there), `cut` the cut's own floor
let MK = null;
function masks() {
  if (MK) return MK;
  const { T, on } = course(), { N, X, Z, TX, TZ, STEP, WL, WR } = T, road = new Uint8Array(WX * WZ), used = new Uint8Array(WX * WZ), cut = new Uint8Array(WX * WZ);
  for (let i = 0; i < N; i++) {
    const j = T.at(i + 1);
    for (let a = 0; a < STEP; a += 0.5) {
      const t = a / STEP, cx = X[i] + (X[j] - X[i]) * t, cz = Z[i] + (Z[j] - Z[i]) * t;
      for (let l = -(WR[i] + 5); l <= WL[i] + 5; l += 0.5) {
        const x = Math.floor(cx + TZ[i] * l), z = Math.floor(cz - TX[i] * l); if (x < 0 || z < 0 || x >= WX || z >= WZ) continue;
        used[z * WX + x] = 1;
        if (l >= -WR[i] && l <= WL[i]) { if (!on[i]) road[z * WX + x] = 1; else if (on[i] === 2) cut[z * WX + x] = 1; }
      }
    }
  }
  return (MK = { road, used, cut, taken: new Uint8Array(WX * WZ) });
}
// whether a box of ground is free to build on: land, off the course, and nothing planned there yet
function free(x0, z0, x1, z1, park = false) {
  const { used, taken } = masks();
  if (x0 < 10 || z0 < 10 || x1 > WX - 10 || z1 > WZ - 10) return false;
  for (let z = z0; z <= z1; z += 2) for (let x = x0; x <= x1; x += 2) { if (used[z * WX + x] || taken[z * WX + x] || !land(x, z) || (!park && inPark(x, z))) return false; }
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) if (used[z * WX + x] || taken[z * WX + x] || !land(x, z) || !land(x + (x === x0 ? -3 : 3), z + (z === z0 ? -3 : 3))) return false;
  return true;
}
const take = (x0, z0, x1, z1) => { const { taken } = masks(); for (let z = Math.max(0, z0); z <= Math.min(WZ - 1, z1); z++) taken.fill(1, z * WX + Math.max(0, x0), z * WX + Math.min(WX - 1, x1) + 1); };

// ---- the rest, for the race: the racing line, gates and grid --------------------------------------------------------
let TR = null;
function full() {
  if (TR) return TR;
  const { T, H } = course(), { N, WL, WR } = T;
  const lo = new Float32Array(N), hi = new Float32Array(N);
  for (let i = 0; i < N; i++) { lo[i] = -WR[i] + MARGIN; hi[i] = WL[i] - MARGIN; if (lo[i] > hi[i]) lo[i] = hi[i] = (lo[i] + hi[i]) / 2; }
  const line = racingLine(T, { margin: MARGIN, lo, hi });
  const { gates, gateS } = gatesFor(T, GATES);
  const grid = gridFor(T, -1);   // pole on the right: the first corner, onto the Avenue's diagonal, goes right
  const g = { x: LINE_X, z: LINE_Z, y: GANTRY_Y };
  const lights = { x: LINE_X - 1.3, y: g.y - 2.4, z: LINE_Z, yaw: Math.PI / 2, lx: 0, lz: 1 };   // in front of the lights' box, facing the grid
  return (TR = { T, P: null, line, gates, gateS, grid, gantry: g, lights, HALF: 27, PIT_HALF: 0, H });
}

// ---- what stands beside the course -----------------------------------------------------------------------------------
// The barriers: a wall along each edge of the course wherever it runs on the ground, a body every 64 voxels of it.
// Concrete blocks with a red and white top on the streets; in the parks, on the Mall and in Virginia a low wall of
// pale stone. On the knoll they stand as high as it does.
function barriers() {
  const { T, H, on } = course(), { N, X, Z, TX, TZ, WL, WR } = T, { road } = masks();
  for (let i0 = 0; i0 < N; i0 += 32) {
    let open = false;
    for (let i = i0; i < Math.min(N, i0 + 32); i++) {
      if (on[i]) continue;
      if (!open) { begin('Barrier', 'barrier', false); open = true; }
      const j = T.at(i + 1), park = leafy(X[i], Z[i]), top = Math.round(H[i]) + (park ? 3 : 4), cap = park ? M.MARBLE : Math.floor(i / 3) & 1 ? M.CAR_A : M.TRIM, m = park ? M.GRANITE : M.CONC;
      for (const sd of [1, -1]) for (let a = 0; a < 1; a += 0.25) {
        const cx = X[i] + (X[j] - X[i]) * a, cz = Z[i] + (Z[j] - Z[i]) * a, nx = TZ[i] + (TZ[j] - TZ[i]) * a, nz = -(TX[i] + (TX[j] - TX[i]) * a);
        const w = sd > 0 ? WL[i] + (WL[j] - WL[i]) * a : WR[i] + (WR[j] - WR[i]) * a;
        for (const d of [1.2, 1.9, 2.6]) {
          const x = Math.floor(cx + nx * sd * (w + d)), z = Math.floor(cz + nz * sd * (w + d));
          if (x < 2 || z < 2 || x >= WX - 2 || z >= WZ - 2 || road[z * WX + x]) continue;
          for (let y = 0; y < top; y++) put(x, y, z, m);
          put(x, top, z, cap);
        }
      }
    }
  }
}
// The rows of buildings that face the course: along each straight run, each side, a lot every 44 where there is land
// for one and no park (and down the two diagonal avenues, a staircase of them). What each is depends on the part of
// town. Worked out once (the plan), for the voxels and for the cheap city behind them, which keeps off these lots.
const SHOPS = [['BOOKS', 'Bookshop'], ['DELI', 'Deli'], ['CAFE', 'Coffee shop'], ['PIZZA', 'Pizza place'], ['MAPS', 'Map shop'], ['BAGEL', 'Bagel shop'], ['FLAGS', 'Flag shop'], ['DINER', 'Diner'], ['HATS', 'Hat shop'], ['BIKES', 'Bike shop'], ['PIES', 'Pie shop']];
const STREET = [['CAFE', 'Cafe block', 1], ['POST', 'Post block', 0], ['HOTEL', 'Hotel block', 1], ['BANK', 'Bank block', 0], ['NEWS', 'News block', 0], ['GRILL', 'Grill block', 1], ['LAW', 'Law block', 0], ['INN', 'Inn block', 1]];
const OFFICES = ['LOBBY', 'UNION', 'EAGLE', 'STAR', 'PRESS', 'ATLAS', 'CEDAR', 'METRO', 'OAK', 'BELL', 'CROWN', 'DELTA', 'NORTH', 'POTOMAC', 'RIVER', 'ELM'];
const BUREAUS = ['Bureau of Maps', 'Bureau of Weights', 'Bureau of Stamps', 'Patent office', 'Records office', 'Bureau of Rivers', 'Mint office', 'Bureau of Roads', 'Weather bureau', 'Bureau of Parks', 'Bureau of Lights', 'Census office', 'Bureau of Bridges', 'Archives annex', 'Bureau of Clocks', 'Post office department'];
// the parts of town: G Georgetown, D Dupont Circle and the embassies, F the federal offices (the Triangle, Constitution
// Avenue, round the White House), K downtown, H Capitol Hill, S the south-east
function district(x, z) {
  if (x < 222 && z < 474) return 'G';
  if (x - z > 465 && z < 390) return 'K';
  if (z < 190) return x < 520 ? 'D' : 'K';
  if (x > 765) return z > 690 ? 'S' : 'H';
  return 'F';
}
function kitFor(d, R) {
  const p = (a) => a[Math.floor(R() * a.length)], n = (a, b) => a + Math.floor(R() * (b - a + 1)), r = R(), plain = { inside: false, car: 0 };
  const bricks = [M.BRICK, M.BRICK, M.BRICK2, M.BROWNST, M.REND_P], painted = [M.REND_Y, M.REND_T, M.REND_C, M.PL_B, M.PL_Y, M.PL_G, M.PL_P, M.PL_W], stones = [M.LIME, M.LIME2, M.MARBLE, M.GRANITE, M.LIME];
  const doors = [M.DOOR_R, M.DOOR_B, M.DOOR_G, M.DARK], awns = [M.AWN_R, M.AWN_G, M.AWN_B, M.AWN_W], inks = [M.LIT_W, M.LIT_Y, M.LIT_R, M.LIT_B], roofs = [M.ROOF_S, M.ROOF_D, M.ROOF_R, M.ROOF_G];
  const fed = (o = {}) => ['fedblock', { title: p(BUREAUS), wall: p([M.LIME, M.LIME, M.MARBLE, M.LIME2]), roof: p([M.ROOF_R, M.ROOF_R, M.ROOF_R, M.ZINC, M.ROOF_G]), floors: n(4, 5), porch: R() < 0.45 ? 1 : 0, flag: R() < 0.6 ? 1 : 0, ...o }];
  const office = () => { const name = p(OFFICES); return ['dcoffice', { ...plain, name, title: name[0] + name.slice(1).toLowerCase() + ' building', floors: n(6, 8), wall: p([M.LIME, M.LIME2, M.CONC, M.GRANITE, M.REND_C, M.BRICK2]), glass: p([M.GLASS, M.GLASS, M.GLASS_G, M.GLASS_Z]), ink: p(inks), awn: p(awns) }]; };
  const brown = () => ['brownstone', { ...plain, walls: [p(bricks), p(bricks), p(bricks)], doors: [p(doors), p(doors), p(doors)], floors: [n(3, 4), n(3, 4), n(3, 4)], trim: p([M.TRIM, M.STONE, M.LIME2]) }];
  const row = () => ['rowhouse', { walls: [p(bricks), p(painted), p(R() < 0.5 ? bricks : painted)], doors: [p(doors), p(doors), p(doors)], roof: p(roofs) }];
  const store = () => { const [name, title] = p(SHOPS); return ['shop', { ...plain, name, title, wall: p([...bricks, ...painted]), awn: p(awns), door: p(doors), ink: p(inks) }]; };
  const grand = (lo, hi) => { const [name, title, terrace] = p(STREET); return ['haussmann', { ...plain, floors: n(lo, hi), name, title, terrace, wall: p(stones), front: p([M.DOOR_G, M.TRUNK, M.DOOR_B, M.DARK]), awn: p(awns), door: p(doors), roof: p([M.ZINC, M.ROOF_D, M.ROOF_G]) }]; };
  const court = () => (R() < 0.5 ? ['temple', { title: 'Supreme Court', wall: M.MARBLE }] : ['temple', { title: 'Library of Congress', wall: M.GRANITE, dome: M.ROOF_G }]);
  switch (d) {
    case 'G': return r < 0.42 ? row() : r < 0.8 ? brown() : store();
    case 'D': return r < 0.5 ? grand(5, 6) : r < 0.8 ? office() : brown();
    case 'F': return r < 0.84 ? fed() : r < 0.92 ? court() : office();
    case 'H': return r < 0.3 ? brown() : r < 0.5 ? row() : r < 0.72 ? fed() : r < 0.86 ? court() : office();
    case 'S': return r < 0.55 ? office() : r < 0.8 ? fed() : grand(5, 6);
    default: return r < 0.62 ? office() : r < 0.84 ? grand(5, 6) : fed();
  }
}
const KITS = { fedblock, dcoffice, temple, dcgrove, brownstone, rowhouse, haussmann, shop };
let PLAN = null;
function plan() {
  if (PLAN) return PLAN;
  const { T, leg } = course(), { N, X, Z, WL, WR } = T, lots = [];
  let s = 20261125; const R = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  for (const f of FIXED) take(f[1] - 3, f[2] - 3, f[1] + f[3] + 2, f[2] + f[3] + 2);
  for (const b of BIG) take(b[6] - 3, b[7] - 3, Math.ceil(b[6] + b[2] * b[5]) + 2, Math.ceil(b[7] + b[2] * b[5]) + 2);
  const lot = (x0, z0, f, kit, o) => { take(x0 - 2, z0 - 2, x0 + 41, z0 + 41); const [k, opt] = kit ? [kit, o] : kitFor(district(x0 + 20, z0 + 20), R); lots.push({ x: x0, z: z0, f, kit: k, o: opt, seed: 4000 + lots.length * 37 }); };
  // Lafayette Square, across the Avenue from the White House: elms round a rider
  lot(520, 124, 2, 'dcgrove', { v: 1 });
  for (let k = 0; k < NL; k++) {
    const a = COURSE[k], b = COURSE[(k + 1) % NL], c = COURSE[(k + 2) % NL], p = COURSE[(k - 1 + NL) % NL];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, mine = []; for (let i = 0; i < N; i++) if (leg[i] === k) mine.push(i);
    const trim = (q, m, e) => { const vx = m[0] - q[0], vz = m[1] - q[1], wx = e[0] - m[0], wz = e[1] - m[1], t = Math.atan2(vx * wz - vz * wx, vx * wx + vz * wz); return (m[2] || 0) * Math.tan(Math.abs(t) / 2); };
    const s0 = trim(p, a, b) + 4, s1 = len - trim(a, b, c) - 4;
    // the most room the course has from t0 to t1 along this leg, on one side
    const room = (t0, t1, sd) => { let w = 0; for (const i of mine) { const t = (X[i] - a[0]) * ux + (Z[i] - a[1]) * uz; if (t >= t0 - 3 && t <= t1 + 3) w = Math.max(w, sd > 0 ? WL[i] : WR[i]); } return w; };
    if (Math.abs(ux) > 0.01 && Math.abs(uz) > 0.01) {
      // a diagonal: lots square to the map, corner on to the avenue, stepping along it
      if (Math.abs(Math.abs(ux) - Math.abs(uz)) > 0.05) continue;   // (only the two avenues at 45 degrees)
      const stepT = 44 * Math.SQRT2, n = Math.floor((s1 - s0) / stepT); if (n < 1) continue;
      const start = s0 + (s1 - s0 - n * stepT) / 2 + stepT / 2;
      for (let j = 0; j < n; j++) for (const sd of [1, -1]) {
        const t = start + j * stepT, w = room(t - 30, t + 30, sd); if (!w) continue;
        const nx = uz * sd, nz = -ux * sd, px = a[0] + ux * t + nx * (w + 8), pz = a[1] + uz * t + nz * (w + 8);   // the lot's near corner
        const x0 = Math.round(nx > 0 ? px : px - 39), z0 = Math.round(nz > 0 ? pz : pz - 39);
        if (!free(x0, z0, x0 + 39, z0 + 39)) continue;
        lot(x0, z0, nz > 0 ? 0 : 2);   // (its front to the north or south, whichever is the avenue's side)
      }
      continue;
    }
    const dx = Math.round(ux), dz = Math.round(uz), n = Math.floor((s1 - s0 + 4) / 44); if (n < 1) continue;
    const start = s0 + (s1 - s0 - (n * 44 - 4)) / 2;
    for (let j = 0; j < n; j++) for (const sd of [1, -1]) {
      const t0 = start + j * 44, t1 = t0 + 39, w = room(t0, t1, sd); if (!w) continue;
      const nx = dz * sd, nz = -dx * sd, o0 = w + 7, o1 = o0 + 39;   // out to the lot's near and far edges
      const xs = [a[0] + dx * t0 + nx * o0, a[0] + dx * t1 + nx * o1], zs = [a[1] + dz * t0 + nz * o0, a[1] + dz * t1 + nz * o1];
      const x0 = Math.round(Math.min(...xs)), z0 = Math.round(Math.min(...zs));
      if (!free(x0, z0, x0 + 39, z0 + 39)) continue;
      lot(x0, z0, nz > 0 ? 0 : nx < 0 ? 1 : nz < 0 ? 2 : 3);   // its front to the course (the course is the other way from the way out)
    }
  }
  // the city off the course: between a grid of streets (every 104, as the ground is painted), every block filled with
  // buildings wherever there is land that nothing else has taken. Washington keeps a lid on its height: nothing here
  // stands much over a dozen storeys.
  const boxes = [], open = (x0, z0, w, d) => free(x0 - 2, z0 - 2, x0 + w + 2, z0 + d + 2);
  const add = (x0, z0, w, d) => {
    take(x0 - 2, z0 - 2, x0 + w + 2, z0 + d + 2);
    const dd = district(x0 + w / 2, z0 + d / 2), r = R(), q = R(), low = dd === 'G' || dd === 'H';
    const h = low ? 36 + r * 36 : 60 + r * 48;
    const style = dd === 'G' ? (q < 0.6 ? 'brick' : q < 0.85 ? 'brown' : 'tan') : dd === 'H' ? (q < 0.5 ? 'brick' : q < 0.75 ? 'lime' : 'tan') : dd === 'F' ? (q < 0.8 ? 'lime' : 'tan') : (q < 0.45 ? 'lime' : q < 0.7 ? 'tan' : q < 0.88 ? 'glass' : 'brick');
    boxes.push({ x0, z0, w, d, h, style, seed: 1 + boxes.length });
  };
  for (let bz = 17; bz < WZ - 40; bz += 104) for (let bx = 17; bx < WX - 40; bx += 104) {
    const k = R();
    if (k < 0.16 && open(bx, bz, 80, 80)) { add(bx, bz, 80, 80); continue; }
    if (k < 0.4) { const ns = R() < 0.5; let got = 0; for (const o of [0, 46]) { const [x, z, w, d] = ns ? [bx + o, bz, 40, 80] : [bx, bz + o, 80, 40]; if (open(x, z, w, d)) { add(x, z, w, d); got++; } } if (got === 2) continue; }
    for (const [qx, qz] of [[0, 0], [46, 0], [0, 46], [46, 46]]) {
      if (open(bx + qx, bz + qz, 40, 40)) { add(bx + qx, bz + qz, 40, 40); continue; }
      for (const sz of [32, 24, 16]) for (let oz = 0; oz + sz <= 40; oz += 8) for (let ox = 0; ox + sz <= 40; ox += 8) if (open(bx + qx + ox, bz + qz + oz, sz, sz)) add(bx + qx + ox, bz + qz + oz, sz, sz);
    }
  }
  return (PLAN = { lots, boxes });
}
function rows() {
  for (const L of plan().lots) {
    setSeed(L.seed); ctx.lot = -1; ctx.L = 3;
    place(L.x, L.z, L.f);
    KITS[L.kit](LOC, LOC, 3, L.o);
    place(0, 0, -1);
  }
}
function landmarks() {
  for (const [, x, z, S, f, make, o] of FIXED) {
    setSeed(1800 + x); ctx.lot = -1; ctx.L = 3;
    place(x, z, f, S); make(LOC, LOC, 3, o || {}); place(0, 0, -1);
  }
}
const GROVE = [], MODELS = [];
function build() {
  // the great buildings first, on a bare corner of the map: built, copied, and taken out again
  for (const [name, make, S, NY, f, k, x0, z0, turn] of BIG) MODELS.push({ name, vol: grabModel(make, S, NY, 16, 16, f, 2), k, x: x0 + S * k / 2, z: z0 + S * k / 2, turn: turn || 0 });
  plan();
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1; setSeed(5115);
  barriers();
  landmarks();
  rows();
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1;
  // a lamp now and then along the streets, outside the barriers
  { const { T, on } = course(); setSeed(3003);
    for (let i = 0; i < T.N; i += 40) { if (on[i] || inPark(T.X[i], T.Z[i])) continue; for (const sd of [1, -1]) { const w = (sd > 0 ? T.WL[i] : T.WR[i]) + 4.5, x = Math.round(T.X[i] + T.TZ[i] * sd * w), z = Math.round(T.Z[i] - T.TX[i] * sd * w); if (x > 12 && z > 12 && x < WX - 12 && z < WZ - 12 && land(x, z) && !masks().road[z * WX + x]) lampPost(x, z, 22); } } }
  vehicles.length = 0;   // nothing parked along the road
  gantry(LINE_X, LINE_Z - 33, LINE_Z + 33, ['CAPITAL CIRCUIT', 'WASHINGTON GP'], -1, GANTRY_Y);
  finish();
}

// ---- the floor: a grid with the knoll's heights and the pool's, and a hole where the cut is open to the sky -----------
function floorMesh() {
  const hm = heights(), { parts } = course(), { cut } = masks(), G = 8, nx = WX / G, nz = WZ / G, V = (nx + 1) * (nz + 1);
  const position = new Float32Array(V * 3), uv = new Float32Array(V * 2), normal = new Float32Array(V * 3), index = [];
  const hAt = (x, z) => { const c = clamp(Math.floor(z), 1, WZ - 2) * WX + clamp(Math.floor(x), 1, WX - 2); return cut[c] ? 0 : hm.gnd[c]; };
  const roofs = parts.filter((p) => p.roofBox).map((p) => p.roofBox), roofed = (x, z) => roofs.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3]);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const v = j * (nx + 1) + i, x = i * G, z = j * G;
    position[v * 3] = x; position[v * 3 + 1] = hAt(x, z); position[v * 3 + 2] = z; uv[v * 2] = x / WX; uv[v * 2 + 1] = 1 - z / WZ;
    const sx = (hAt(x + 4, z) - hAt(x - 4, z)) / 8, sz = (hAt(x, z + 4) - hAt(x, z - 4)) / 8, l = Math.hypot(sx, 1, sz);
    normal[v * 3] = -sx / l; normal[v * 3 + 1] = 1 / l; normal[v * 3 + 2] = -sz / l;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const cx = i * G + G / 2, cz = j * G + G / 2;
    if (cut[cz * WX + cx] && !roofed(cx, cz)) continue;   // the cut, open to the sky
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  return { position, uv, normal, index: new Uint16Array(index) };
}

// ---- the painted ground -------------------------------------------------------------------------------------------
let grassy = null;
const PHONE = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const WATER = '#4d8fa8', LAWN = '#74a65e', PAVE = '#cfc9b9', GRAVEL = '#d9c9a2';
function paint() {
  const { T, grid, line } = full(), { on, leg } = course(), C = canvasFor(WATER, 4412), { cv, g } = C;
  const poly = (pts) => { g.moveTo(pts[0][0] * GK, pts[0][1] * GK); for (const p of pts.slice(1)) g.lineTo(p[0] * GK, p[1] * GK); g.closePath(); };
  const oval = (x, z, rx, rz) => { g.moveTo((x + rx) * GK, z * GK); g.ellipse(x * GK, z * GK, rx * GK, rz * GK, 0, 0, Math.PI * 2); };
  const landPath = () => {
    g.beginPath();
    poly([...BANK, ...ANA, [WX + 40, -40], [BANK[0][0], -40]]);
    poly([...VA, [-40, WZ + 40], [-40, VA[0][1]]]);
  };
  // the shallows and the quay round every shore, then the land
  g.lineJoin = 'round';
  landPath(); g.strokeStyle = 'rgba(120,176,190,0.55)'; g.lineWidth = 14 * GK; g.stroke();
  landPath(); g.strokeStyle = '#6f6a60'; g.lineWidth = 4 * GK; g.stroke();
  landPath(); g.fillStyle = PAVE; g.fill();
  g.save(); landPath(); g.clip();
  C.speckle(0, 0, WX, WZ, 90000, ['rgba(255,250,235,0.16)', 'rgba(60,56,50,0.13)']);
  // the city off the course stands on pavement: slabs, a joint every eight (no streets are painted beside the course:
  // Will, 2026-11-24, of New York's, "our road and cars are much bigger than those roads, so it ruins the perspective.
  // It would look better if those were side walks")
  g.fillStyle = 'rgba(70,66,58,0.14)';
  for (let v = 0; v < WX; v += 8) { C.rect(v - 0.15, 0, v + 0.15, WZ); C.rect(0, v - 0.15, WX, v + 0.15); }
  // the parks: grass over everything that is one (a voxel at a time would be slow: in cells of four)
  g.fillStyle = LAWN;
  for (let z = 0; z < WZ; z += 4) { let x0 = -1; for (let x = 0; x <= WX; x += 4) { const p = x < WX && inPark(x + 2, z + 2); if (p && x0 < 0) x0 = x; if (!p && x0 >= 0) { C.rect(x0, z, x, z + 4); x0 = -1; } } }
  for (const [x0, z0, x1, z1, n] of [[0, 600, 360, WZ, 60000], [62, 474, 765, WZ, 90000], [765, 420, 980, 690, 18000], [440, 118, 640, 420, 22000], [166, 90, 414, 300, 14000]]) C.speckle(x0, z0, x1, z1, n, ['rgba(92,146,74,0.5)', 'rgba(146,192,108,0.45)', 'rgba(170,190,110,0.25)']);
  // the Mall: two gravel walks the length of it, and the paved ring round the Monument
  g.fillStyle = GRAVEL; C.rect(440, 522, 765, 530); C.rect(440, 630, 765, 638);
  g.beginPath(); oval(KNOLL.x, KNOLL.z, 30, 30); g.fill();
  // the Tidal Basin, and the Reflecting Pool in its stone rim
  g.beginPath(); oval(BASIN.x, BASIN.z, BASIN.rx + 2.5, BASIN.rz + 2.5); g.fillStyle = '#b9b3a3'; g.fill();
  g.beginPath(); oval(BASIN.x, BASIN.z, BASIN.rx, BASIN.rz); g.fillStyle = WATER; g.fill();
  g.fillStyle = '#c9c3b3'; C.rect(POOL.x0 - 5, POOL.z0 - 5, POOL.x1 + 5, POOL.z1 + 5);
  g.fillStyle = '#3f6f80'; C.rect(POOL.x0, POOL.z0, POOL.x1, POOL.z1);
  // the landmarks' own ground: pale paving under the buildings
  g.fillStyle = '#d6d1c2'; for (const f of FIXED) C.rect(f[1], f[2], f[1] + f[3], f[2] + f[3]);
  for (const b of BIG) if (b[0] === 'Capitol' || b[0] === 'Lincoln' || b[0] === 'Jefferson') C.rect(b[6], b[7], b[6] + b[2] * b[5], b[7] + b[2] * b[5]);
  g.restore();
  // the course, on the ground only: the decks and the cut have their own road (roads.js), so they get no room here
  const WLp = T.WL.slice(), WRp = T.WR.slice();
  for (let i = 0; i < T.N; i++) if (on[i]) { WLp[i] = -1.4; WRp[i] = -1.4; }
  paintCourse(g, { ...T, WL: WLp, WR: WRp }, grid, 62, line);
  // the Mall's road is gravel, and the pool's is its floor, under the water
  for (let i = 0; i < T.N; i++) {
    const j = T.at(i + 1), pool = inPool(T.X[i], T.Z[i]) && inPool(T.X[j], T.Z[j]); if (!pool && !(leg[i] >= 6 && leg[i] <= 9)) continue;
    const P = (k, l) => [(T.X[k] + T.TZ[k] * l) * GK, (T.Z[k] - T.TX[k] * l) * GK];
    g.fillStyle = pool ? 'rgba(63,111,128,0.9)' : 'rgba(217,201,162,0.6)'; g.beginPath(); g.moveTo(...P(i, -T.WR[i])); g.lineTo(...P(i, T.WL[i])); g.lineTo(...P(j, T.WL[j])); g.lineTo(...P(j, -T.WR[j])); g.closePath(); g.fill();
  }
  grassy = grassOf(cv, true, T);
  if (!PHONE) return cv;
  const half = document.createElement('canvas'); half.width = cv.width >> 1; half.height = cv.height >> 1;
  const h = half.getContext('2d'); h.imageSmoothingQuality = 'high'; h.drawImage(cv, 0, 0, half.width, half.height);
  cv.width = cv.height = 1;
  return half;
}

const RADAR_BOX = [30, 0, 1024, 1024];
let radarCv = null, radarKey = '';
function radar(R, s, ox, oy, w, h) {
  const key = [s, ox, oy, w, h].join();
  if (!radarCv || key !== radarKey) {
    radarKey = key; radarCv = radarCv || document.createElement('canvas'); radarCv.width = R.canvas.width; radarCv.height = R.canvas.height;
    radarCourse(radarCv, full().T, s, ox, oy, [], [], w, h);
  }
  R.drawImage(radarCv, 0, 0);
}

const P = (name) => course().parts.find((p) => p.name === name);
let ROOFS = null;
export default {
  id: 'capital', name: 'Capital Circuit', mode: 'race', laps: 3, hidden: true,
  blurb: 'Three laps of Washington: down the Avenue to the Capitol, the freeway, the Mall, through the Reflecting Pool, two bridges, the Metro, Georgetown and Dupont Circle. Guns on.',
  loading: ['Closing the Avenue', 'Building Washington, filling the pool and digging the Metro'],
  outer: 0x8fae78,
  look: { kind: 'dusk' },
  lodK: 0.4,
  // the road's height (vehicle.js, main.js's camera), the sides of the decks and the cut, and the floor that is drawn
  floor: (x, z, y) => heights().floor(x, z, y),
  rail: (x, z, y) => heights().rail(x, z, y),
  floorMesh,
  // where the chase camera has a roof over it and stays under it (main.js stepCamera): the Metro (from a little before
  // each mouth, so the camera is down in time)
  get roofs() {
    if (!ROOFS) { const s = P('Metro').roofBox; ROOFS = [{ x0: s[0], z0: s[1] - 44, x1: s[2], z1: s[3] + 44, y: -1.5 }]; }
    return ROOFS;
  },
  get hazards() {
    const { road } = masks();
    const near = (x, z) => { for (let dz = -5; dz <= 5; dz += 5) for (let dx = -5; dx <= 5; dx += 5) if (road[Math.floor(z + dz) * WX + Math.floor(x + dx)]) return true; return false; };
    const s = P('Metro').roofBox;
    return [
      { kind: 'custom', make: (api) => { makeRoads(api.scene, course().T, course().parts.map((p) => ({ ...p, skip: near }))); } },
      { kind: 'custom', make: (api) => { for (const m of MODELS) { const g = statueMesh(m.vol, m.k, { glow: [1.5, 1.4, 1.1], greedy: true }); g.position.set(m.x, m.name === 'Monument' ? KNOLL.h : 0, m.z); g.rotation.y = m.turn; g.name = m.name; api.scene.add(g); console.log('INFO model', m.name, g.userData.tris); } } },
      { kind: 'custom', make: (api) => { makeBlocks(api.scene, plan().boxes); } },
      { kind: 'custom', make: (api) => { makeGrove(api.scene, GROVE); } },
      { kind: 'custom', make: (api) => makeWater(api.scene, { x0: 0, z0: 0, span: 1024, sun: DUSK.sun, isWater: (x, z) => !land(x, z) || inPool(x, z), pools: [[POOL.x0, POOL.z0, POOL.x1, POOL.z1, 0.55]] }) },
      { kind: 'covered', x0: s[0], z0: s[1], x1: s[2], z1: s[3], dim: 0.5 },
    ];
  },
  build,
  ground: paint,
  get spawn() { return full().grid[4]; },   // the player starts fifth
  spawnPoint(player, taken) {
    const { T, gates } = full();
    const at = pickSpot(gates.map((i) => ({ x: T.X[i], z: T.Z[i], yaw: Math.atan2(T.TX[i], T.TZ[i]) })), player, taken), H = course().H;
    return { ...at, y: H[T.project(at.x, at.z).i] };   // (the road's height there)
  },
  waypoint(c, tx, tz, out) {
    const { T } = full(), p = T.project(c.x, c.z, c._rw ?? -1), j = T.at(p.i + Math.round(36 / T.STEP));
    c._rw = p.i; out.x = T.X[j]; out.z = T.Z[j]; return out;
  },
  radar,
  radarBox: RADAR_BOX,
  groundDetail: { hard: true, deFleck: true, fade: 20 },
  rutBox: [0, 0, WX, WZ],
  // (the grass is the painted ground's: a deck over it, or the cut under it, is road)
  surface(x, z) { if (!grassy || !TR) return 0; const c = clamp(Math.floor(z), 0, WZ - 1) * WX + clamp(Math.floor(x), 0, WX - 1), d = heights().deck[c]; return d === d || masks().cut[c] ? 0 : surfaceAt(TR.T, grassy, x, z); },
  get track() { return full(); },
};
