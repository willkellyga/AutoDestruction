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
import * as THREE from 'three';
import { WX, WZ, M, place, ctx, setSeed, put, begin, LOC, ri, rnd, vehicles } from '../../../src/world.js';
import { lampPost } from '../../../src/kit.js';
import { brownstone } from '../../../src/nyc_kit.js';
import { rowhouse } from '../../../src/landmarks.js';
import { haussmann } from '../../../src/paris_kit.js';
import { shop } from '../../../src/buildings_a.js';
import { fedblock, dcoffice, temple, dcgrove } from '../../../src/dc_kit.js';
import { WHITEHOUSE, CAPITOL, LINCOLN, JEFFERSON, CASTLE, PENTAGON, whitehouse, capitol, lincoln, jefferson, castle, pentagon, wmonument } from '../../../src/dc_landmarks.js';
import { grabModel, statueMesh } from './statue.js';
import { pentagonMesh, underPentagon } from './pentagon.js';
import { makeDcBlocks } from './dcblocks.js';
import { makeCrowd, makePetals } from './cityblocks.js';
import { makeGrove } from './trees.js';
import { makeWater } from './water.js';
import { SPRING } from '../looks/spring.js';
import { potomacLand, potomacCity } from '../backdrops/potomac.js';
import { canvasFor, finish, pickSpot, GK } from './common.js';
import { makeTrack, streetLoop, racingLine } from './racetrack.js';
import { gantry, gatesFor, gridFor, paintCourse, grassOf, surfaceAt, radarCourse } from './circuit.js';
import { makeHeights } from './heights.js';
import { makeRoads } from './roads.js';
import { dressBridges } from './bridges.js';
import { makeStation } from './station.js';

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
const KNOLL = { x: 540, z: 580, r: 104, h: 10, flat: 22, base: 9 };                   // the Monument's
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
    if (p.open) { q.open = [ks(p.open[0]), ks(p.open[1])]; const a = T.at(i0 + q.open[0]), b = T.at(i0 + q.open[1]); q.openZ = [Math.min(Z[a], Z[b]), Math.max(Z[a], Z[b])]; }
    return q;
  });
  // the Monument's knoll, and the pool's floor
  // (flat on top as far out as the ring of flags round the Monument stands, FLAT, so their poles reach the ground:
  // Will, 2026-11-24, "floating flags")
  const knoll = (x, z) => KNOLL.h * ramp(Math.min(1, (KNOLL.r - Math.hypot(x - KNOLL.x, z - KNOLL.z)) / (KNOLL.r - KNOLL.flat)));
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
// The great boards (maps/cityblocks.js; the pictures are maps/dcart.js FILMS), where a long straight looks at them: the
// Grand Prix's past the end of the start straight, the Space Museum's at the far end of Constitution Avenue, and the Cherry
// Blossom Festival's over the road itself (`over`: on legs either side of it) on the way up the Tidal Basin. The last
// two are the smaller size (`great`): a full one beside the Monument was more than the Mall's view could take.
const HEROES = [{ x: 770, z: 172, s: 3, film: 0, y: 30 }, { x: 212, z: 444, s: 1, film: 2, y: 26, great: true }, { x: 660, z: 850, s: 2, film: 1, y: 38, over: true, great: true }];
const CLOCK = { value: 0 };
let PLAN = null;
function plan() {
  if (PLAN) return PLAN;
  const { T, leg } = course(), { N, X, Z, WL, WR } = T, lots = [];
  let s = 20261125; const R = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  for (const h of HEROES) {   // (their own ground, and the ground in front of them: nothing stands between a board and the road)
    if (h.over) { for (const o of [-29, 29]) take(h.x + o - 7, h.z - 9, h.x + o + 7, h.z + 7); continue; }
    const hw = h.great ? 52 : 76, w = h.s === 0 || h.s === 2 ? [hw, 8] : [8, hw], o = h.open ?? 44, f = [[0, -o], [o, 0], [0, o], [-o, 0]][h.s];
    take(h.x - w[0] + Math.min(0, f[0]), h.z - w[1] + Math.min(0, f[1]), h.x + w[0] + Math.max(0, f[0]), h.z + w[1] + Math.max(0, f[1]));
  }
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
    const h = low ? (Math.min(w, d) < 32 ? 24 + r * 16 : 28 + r * 28) : 60 + r * 48;   // (the houses of Georgetown and the Hill: three to seven floors)
    const style = dd === 'G' ? (q < 0.6 ? 'brick' : q < 0.85 ? 'brown' : 'tan') : dd === 'H' ? (q < 0.5 ? 'brick' : q < 0.75 ? 'lime' : 'tan') : dd === 'F' ? (q < 0.6 ? 'marble' : q < 0.9 ? 'lime' : 'tan') : (q < 0.3 ? 'lime' : q < 0.5 ? 'marble' : q < 0.72 ? 'tan' : q < 0.88 ? 'glass' : 'brick');
    boxes.push({ x0, z0, w, d, h, style, seed: 1 + boxes.length, plain: dd === 'F' || (dd !== 'G' && dd !== 'H' && q < 0.5) });   // (the ministries and offices have no shops along the street)
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
  for (const B of boxes) aim(B);
  return (PLAN = { lots, boxes });
}
// how near the course a block is, and the way to it (its banners and its porch are on the side that faces the road)
function aim(B) {
  const { N, X, Z } = course().T, cx = B.x0 + B.w / 2, cz = B.z0 + B.d / 2; let bd = 1e18, bi = 0;
  for (let i = 0; i < N; i += 3) { const d = (X[i] - cx) ** 2 + (Z[i] - cz) ** 2; if (d < bd) { bd = d; bi = i; } }
  B.near = Math.max(0, Math.sqrt(bd) - (B.w + B.d) / 4); B.toward = [X[bi] - cx, Z[bi] - cz]; return B;
}
// The people out to watch (maps/cityblocks.js makeCrowd): along the Avenue and round the Capitol, down the Mall, under
// the cherries, along Constitution Avenue, in Georgetown and round Dupont Circle: [x, z, yaw, colour, the ground there]
let CROWD = null;
function crowd() {
  if (CROWD) return CROWD;
  const { T, leg, on } = course(), { N, X, Z, TX, TZ } = T, { road, cut } = masks(), gnd = heights().gnd, L = [];
  const SHARE = { 26: 0.9, 0: 0.9, 1: 0.6, 2: 0.4, 5: 0.3, 6: 0.6, 7: 0.4, 8: 0.4, 9: 0.4, 10: 0.3, 12: 0.2, 14: 0.5, 15: 0.5, 16: 0.4, 17: 0.5, 21: 0.3, 22: 0.4, 23: 0.5, 24: 0.5, 25: 0.7 };
  let s = 1791; const R = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const clear = (x, z) => { const c = Math.floor(z) * WX + Math.floor(x); return x > 4 && z > 4 && x < WX - 4 && z < WZ - 4 && land(x, z) && !inPool(x, z) && !road[c] && !cut[c]; };
  for (let i = 0; i < N && L.length < 900; i++) {
    if (on[i] || !(leg[i] in SHARE)) continue;
    for (const sd of [1, -1]) {
      const knot = Math.sin(i * 0.11 + sd * 1.3) + Math.sin(i * 0.037 + sd) > -0.3;
      if (!knot || R() > SHARE[leg[i]]) continue;
      const o = (sd > 0 ? T.WL[i] : T.WR[i]) + 4.4 + R() * 1.6, x = X[i] + TZ[i] * sd * o, z = Z[i] - TX[i] * sd * o;
      if (!clear(x, z) || !clear(x + 3, z) || !clear(x - 3, z) || !clear(x, z + 3) || !clear(x, z - 3)) continue;
      L.push([x, z, Math.atan2(-TZ[i] * sd, TX[i] * sd) + (R() - 0.5) * 0.8, Math.floor(R() * 8), gnd[Math.floor(z) * WX + Math.floor(x)] || 0]);
    }
  }
  return (CROWD = L);
}
// Kites over the Mall (the festival flies them there every spring): a diamond in two colours with a tail of bows, on
// a string from the lawn. Each is a group with its foot where the string is held; it leans and swings about that.
const KITES = [[330, 528, 0], [392, 636, 1], [468, 520, 2], [612, 532, 3], [668, 628, 0], [716, 536, 2], [300, 620, 3], [560, 512, 1]];
const KITE_INKS = [[[0.85, 0.15, 0.17], [0.95, 0.7, 0.12]], [[0.16, 0.4, 0.85], [0.96, 0.95, 0.9]], [[0.95, 0.45, 0.65], [0.96, 0.95, 0.9]], [[0.2, 0.62, 0.36], [0.95, 0.85, 0.2]]];
function makeKites(scene) {
  const all = KITES.map(([x, z, k], n) => {
    const pos = [], col = [], idx = [], [A, B] = KITE_INKS[k], len = 78 + (n * 37) % 44;
    const tri = (P, c) => { const i = pos.length / 3; pos.push(...P); for (let q = 0; q < P.length / 3; q++) col.push(...c); for (let q = 2; q < P.length / 3; q++) idx.push(i, i + q - 1, i + q); };
    tri([0, len + 7, 0, 5, len, 0, 0, len - 9, 0], A); tri([0, len + 7, 0, 0, len - 9, 0, -5, len, 0], B);
    for (let q = 0; q < 5; q++) { const y = len - 11 - q * 2.6, dx = Math.sin(q * 1.4) * 1.2; tri([dx - 1.3, y + 0.8, 0, dx + 1.3, y - 0.8, 0, dx + 1.3, y + 0.8, 0, dx - 1.3, y - 0.8, 0], q % 2 ? A : B); }
    tri([-0.12, 0, 0, 0.12, 0, 0, 0.12, len - 2, 0, -0.12, len - 2, 0], [0.92, 0.92, 0.9]); tri([0, 0, -0.12, 0, 0, 0.12, 0, len - 2, 0.12, 0, len - 2, -0.12], [0.92, 0.92, 0.9]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, KITE_MAT || (KITE_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))); m.name = 'kites'; m.position.set(x, heights().gnd[z * WX + x] || 0, z); m.rotation.order = 'YXZ'; m.rotation.y = 0.9 + n * 0.21; m.frustumCulled = false; scene.add(m);
    return { m, n };
  });
  return { step() { const t = CLOCK.value; for (const { m, n } of all) { m.rotation.x = 0.42 + Math.sin(t * 0.5 + n * 1.7) * 0.1 + Math.sin(t * 1.3 + n) * 0.03; m.rotation.z = Math.sin(t * 0.37 + n * 2.3) * 0.22; } } };
}
let KITE_MAT = null;
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
// What stands beside and over the course in stone, as a drawn model (nothing to drive into: it is all outside the
// barriers or well over the road): the high bridge that carries a street over Rock Creek's valley, on two piers either
// side of the road, and the pylons at the ends of the Memorial Bridge, with their gilded tops, and the posts along it.
// Each: [x0, y0, z0, x1, y1, z1, colour].
const GRANITE = [0.7, 0.66, 0.58], GRANITE2 = [0.6, 0.56, 0.49], GILT = [0.95, 0.7, 0.2];
let STONES = null;
function stones() {
  if (STONES) return STONES;
  const L = [], Z0 = 205, Z1 = 221, Y = 44;
  L.push([164, Y, Z0, 304, Y + 6, Z1, GRANITE], [164, Y + 6, Z0, 304, Y + 8.5, Z0 + 1.4, GRANITE], [164, Y + 6, Z1 - 1.4, 304, Y + 8.5, Z1, GRANITE]);
  L.push([164, 0, Z0, 178, Y, Z1, GRANITE2], [290, 0, Z0, 304, Y, Z1, GRANITE2], [204, 0, Z0 + 1, 213, Y, Z1 - 1, GRANITE2], [267, 0, Z0 + 1, 276, Y, Z1 - 1, GRANITE2]);
  // the arches, in steps: each span's soffit follows an arc from pier to pier, a little under the deck at its crown
  for (const [a, b] of [[178, 204], [213, 267], [276, 290]]) {
    const w = b - a, rise = Math.min(w * 0.42, 18), n = w > 40 ? 7 : 4, soffit = (t) => Y - 2.5 - rise * (1 - Math.sqrt(Math.max(0, 1 - (1 - 2 * t / w) ** 2)));
    for (let k = 0; k < n; k++) { const t0 = w / 2 * (k / n) ** 1.5, t1 = w / 2 * ((k + 1) / n) ** 1.5, y = soffit((t0 + t1) / 2); L.push([a + t0, y, Z0 + 1, a + t1, Y, Z1 - 1, GRANITE2], [b - t1, y, Z0 + 1, b - t0, Y, Z1 - 1, GRANITE2]); }
  }
  for (let x = 172; x < 300; x += 32) for (const z of [Z0 + 0.7, Z1 - 0.7]) L.push([x - 0.5, Y + 8.5, z - 0.5, x + 0.5, Y + 19, z + 0.5, [0.12, 0.13, 0.15]], [x - 1.2, Y + 19, z - 1.2, x + 1.2, Y + 21, z + 1.2, [0.9, 0.9, 0.85]]);
  // the Memorial Bridge
  { const { T, W, parts } = course(), p = parts.find((q) => q.name === 'Memorial Bridge');
    for (const k of [0, p.n]) { const i = T.at(p.i0 + k); for (const sd of [1, -1]) { const x = T.X[i] + T.TZ[i] * sd * (W[i] + 8), z = T.Z[i] - T.TX[i] * sd * (W[i] + 8); L.push([x - 4, 0, z - 4, x + 4, 24, z + 4, GRANITE], [x - 5, 24, z - 5, x + 5, 26, z + 5, GRANITE2], [x - 2.5, 26, z - 2.5, x + 2.5, 33, z + 2.5, GILT]); } }
    for (let k = 14; k < p.n - 8; k += 16) { const i = T.at(p.i0 + k); for (const sd of [1, -1]) { const x = T.X[i] + T.TZ[i] * sd * (W[i] + 2.2), z = T.Z[i] - T.TX[i] * sd * (W[i] + 2.2), y = p.H[i]; L.push([x - 1.2, y - 2, z - 1.2, x + 1.2, y + 6.5, z + 1.2, GRANITE], [x - 0.9, y + 6.5, z - 0.9, x + 0.9, y + 8.3, z + 0.9, [0.95, 0.93, 0.85]]); } }
  }
  return (STONES = L);
}
function stoneMesh() {
  const pos = [], col = [], nor = [], idx = [];
  const quad = (P, n, c) => { const i = pos.length / 3; pos.push(...P); for (let k = 0; k < 4; k++) { nor.push(...n); col.push(...c); } idx.push(i, i + 1, i + 2, i, i + 2, i + 3); };
  for (const [x0, y0, z0, x1, y1, z1, c] of stones()) {
    quad([x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], [0, 0, -1], c); quad([x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1], c);
    quad([x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0], c); quad([x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [1, 0, 0], c);
    quad([x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0], [0, 1, 0], c); if (y0 > 0) quad([x0, y0, z1, x0, y0, z0, x1, y0, z0, x1, y0, z1], [0, -1, 0], c.map((v) => v * 0.6));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; m.updateMatrix(); m.name = 'stonework';
  return m;
}

// The trees. Elms in rows down both sides of the Mall, cherries in blossom round the Tidal Basin and down the point,
// woods along Rock Creek and over Virginia, and trees about the parks and the great buildings' grounds. All of them
// are drawn models (maps/trees.js: GROVE on the map, FAR in the woods past its edge, from the backdrop's own shores),
// a voxel to a cube close to the camera. The Monument's knoll and the middle of the Mall are kept clear.
const GROVE = [], FAR = [], MODELS = [];
function trees() {
  let s = 7717; const R = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const { used } = masks(), near = (x, z, r) => { for (let a = 0; a < 8; a++) { const X = Math.round(x + Math.cos(a * 0.785) * r), Z = Math.round(z + Math.sin(a * 0.785) * r); if (X >= 0 && Z >= 0 && X < WX && Z < WZ && used[Z * WX + X]) return true; } return false; };
  for (const [x0, y0, z0, x1, , z1] of stones()) if (y0 === 0) take(Math.floor(x0) - 7, Math.floor(z0) - 7, Math.ceil(x1) + 7, Math.ceil(z1) + 7);   // (no tree up through the bridge)
  take(164, 198, 304, 228);
  let n = 0;
  const tree = (x, z, size, kind = 0) => {
    x = Math.round(x); z = Math.round(z);
    if (!free(x - 11, z - 11, x + 11, z + 11, true) || Math.hypot(x - KNOLL.x, z - KNOLL.z) < KNOLL.r + 8 || inPool(x, z)) return;
    take(x - 5, z - 5, x + 5, z + 5); n++;
    GROVE.push([x + 0.5, z + 0.5, size * 1.08, R() * 6.28, kind]);
  };
  // where the great buildings' own trees stood (they are left out of the models: statue.js), one of ours, to the
  // model's scale
  for (const m of MODELS) for (const [lx, lz, cherry] of m.vol.trees) {
    const a = (lx - m.vol.S / 2) * m.k, b = (lz - m.vol.S / 2) * m.k, c = Math.cos(m.turn), sn = Math.sin(m.turn), x = Math.round(m.x + a * c + b * sn), z = Math.round(m.z - a * sn + b * c);
    if (x < 12 || z < 12 || x >= WX - 12 || z >= WZ - 12 || near(x, z, 9)) continue;
    take(x - 5, z - 5, x + 5, z + 5); n++;
    GROVE.push([x + 0.5, z + 0.5, cherry ? 0.9 + R() * 0.2 : 0.6 * m.k + R() * 0.15, R() * 6.28, cherry]);
  }
  // the Mall's elms: two rows a side, from the Capitol's lawn to the Lincoln Memorial
  for (let x = 282; x < 762; x += 26) for (const z of [536, 624, 510, 650]) tree(x + (R() - 0.5) * 3, z + (R() - 0.5) * 3, 1.2 + R() * 0.2);
  // the cherries: two rings round the Tidal Basin
  for (const [out, step] of [[13, 19], [34, 25]]) { const rx = BASIN.rx + out, rz = BASIN.rz + out, m = Math.round(Math.PI * (rx + rz) / step); for (let k = 0; k < m; k++) { const a = (k + R() * 0.3) / m * Math.PI * 2; tree(BASIN.x + Math.cos(a) * rx, BASIN.z + Math.sin(a) * rz, (out < 20 ? 1.45 : 1.25) + R() * 0.3, 1); } }
  // and everywhere else that is green
  for (let gz = 20; gz < WZ - 16; gz += 30) for (let gx = 20; gx < WX - 16; gx += 30) {
    const x = gx + (R() - 0.5) * 18, z = gz + (R() - 0.5) * 18, r = R(), k = R();
    if (!inPark(x, z)) continue;
    const creek = x >= 166 && x < 318 && z >= 98 && z < 300, mall = z > 474 && z < 690 && x > 270 && x < 765;
    if (mall && z > 500 && z < 660) continue;
    const nearBasin = Math.hypot(x - BASIN.x, (z - BASIN.z) * 1.3) < 190 || (z > 860 && x > 430 && x < 740);
    if (r > (creek ? 0.95 : virginia(x, z) ? 0.75 : leafy(x, z) ? 0.6 : 0.45)) continue;
    tree(x, z, nearBasin ? 1.1 + k * 0.4 : 1 + k * 0.35, nearBasin && k < 0.75 ? 1 : 0);
  }
  // past the map's edge: woods over Virginia and the far bank, along Rock Creek going north, and blossom down the point
  const { lands } = potomacLand(BACKDROP);
  for (let gz = -1300; gz < 2400; gz += 54) for (let gx = -1500; gx < 2400; gx += 54) {
    const x = gx + (R() - 0.5) * 34, z = gz + (R() - 0.5) * 34, r = R(), k = R();
    if (x > -8 && z > -8 && x < WX + 8 && z < WZ + 8) continue;
    if (Math.hypot(Math.max(100 - x, 0, x - 1000), Math.max(40 - z, 0, z - 1000)) > 1250) continue;
    if (BACKDROP.keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr) || BACKDROP.towers.some((t) => Math.hypot(x - t.x, z - t.z) < t.r * 0.8)) continue;
    const l = lands(x, z), wild = Math.max(l[2], l[3]) > 16, point = l[1] > 12, creek = l[0] > 16 && BACKDROP.green(x, z);
    if (!(wild && r < 0.62) && !(point && r < 0.7) && !(creek && r < 0.9)) continue;
    FAR.push([x, z, point ? (k < 0.7 ? 0.85 + k * 0.3 : 1.2 + k * 0.3) : 1.3 + k * 0.6, k * 6.28, point && k < 0.7 ? 1 : 0]);
  }
}
function build() {
  // the great buildings first, on a bare corner of the map: built, copied, and taken out again
  for (const [name, make, S, NY, f, k, x0, z0, turn] of BIG) MODELS.push({ name, vol: grabModel(make, S, NY, 16, 16, f, 2), k, x: x0 + S * k / 2, z: z0 + S * k / 2, turn: turn || 0 });
  // (the Pentagon's own walls are drawn by maps/pentagon.js: the engine's are taken out of its model, and kept only
  // for the shadow painted on the ground; the flag and the court's pavilion stay)
  { const v = MODELS.find((m) => m.name === 'Pentagon').vol, { S, NY, m } = v; v.full = m.slice(); for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) if (underPentagon(x, z)) for (let y = 0; y < NY; y++) m[(y * S + z) * S + x] = 0; }
  plan();
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1; setSeed(5115);
  barriers();
  landmarks();
  rows();
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1;
  // a lamp now and then along the streets, outside the barriers
  { const { T, on } = course(); setSeed(3003);
    for (let i = 0; i < T.N; i += 40) { if (on[i] || inPark(T.X[i], T.Z[i])) continue; for (const sd of [1, -1]) { const w = (sd > 0 ? T.WL[i] : T.WR[i]) + 4.5, x = Math.round(T.X[i] + T.TZ[i] * sd * w), z = Math.round(T.Z[i] - T.TX[i] * sd * w); if (x > 12 && z > 12 && x < WX - 12 && z < WZ - 12 && land(x, z) && !masks().road[z * WX + x]) lampPost(x, z, 22); } } }
  trees();
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
  const { T, grid, line } = full(), { on, leg, H } = course(), FOOT = 3, C = canvasFor(WATER, 4412), { cv, g } = C;
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
  // (but under the foot of each slope the ground's road carries on, FOOT up: where the deck's road starts a hair over
  // it the grass showed through in a strip across the road. Will, 2026-11-24)
  for (let i = 0; i < T.N; i++) if (on[i] && Math.abs(H[i]) > FOOT) { WLp[i] = -1.4; WRp[i] = -1.4; }
  paintCourse(g, { ...T, WL: WLp, WR: WRp }, grid, 62, line);
  // The pool's road is its floor, under the water.
  const P = (k, l) => [(T.X[k] + T.TZ[k] * l) * GK, (T.Z[k] - T.TX[k] * l) * GK];
  const band = (i, l0, l1, m0, m1, col) => { const j = T.at(i + 1); g.fillStyle = col; g.beginPath(); g.moveTo(...P(i, l0)); g.lineTo(...P(i, l1)); g.lineTo(...P(j, m1)); g.lineTo(...P(j, m0)); g.closePath(); g.fill(); };
  for (let i = 0; i < T.N; i++) { const j = T.at(i + 1); if (inPool(T.X[i], T.Z[i]) && inPool(T.X[j], T.Z[j])) band(i, -T.WR[i], T.WL[i], -T.WR[j], T.WL[j], 'rgba(63,111,128,0.9)'); }
  // The Mall's road is dirt and gravel, and reads as that: its own ground from edge to edge with nothing of the
  // asphalt showing through (Will, 2026-11-24: "The dirt should read more like dirt sections"), darker and damper
  // along the edges, two ruts where the wheels run, stones and clods all over, and at each end a spill of it carried
  // out onto the asphalt, thinning.
  {
    let s = 4242; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
    const dirt = (i) => leg[i] >= 6 && leg[i] <= 9, SPILL = 9, off = line.off;
    const share = new Float32Array(T.N);   // 1 on the dirt, falling away over SPILL samples past each end
    for (let i = 0; i < T.N; i++) { if (dirt(i)) { share[i] = 1; continue; } for (let k = 1; k <= SPILL; k++) if (dirt(T.at(i + k)) || dirt(T.at(i - k))) { share[i] = (1 - k / (SPILL + 1)) ** 1.5; break; } }
    for (let i = 0; i < T.N; i++) {
      const a = share[i], j = T.at(i + 1); if (!a) continue;
      band(i, -T.WR[i], T.WL[i], -T.WR[j], T.WL[j], `rgba(196,172,128,${(a === 1 ? 1 : a * 0.8).toFixed(3)})`);
      if (a < 1) continue;
      for (const sd of [1, -1]) { const w = sd > 0 ? T.WL : T.WR; band(i, sd * (w[i] - 5), sd * w[i], sd * (w[j] - 5), sd * w[j], 'rgba(142,116,78,0.3)'); band(i, sd * (w[i] - 2), sd * w[i], sd * (w[j] - 2), sd * w[j], 'rgba(120,98,64,0.3)'); }
      band(i, off[i] - 5, off[i] + 5, off[j] - 5, off[j] + 5, 'rgba(150,124,84,0.22)');
      for (const sd of [-2.6, 2.6]) band(i, off[i] + sd - 1.1, off[i] + sd + 1.1, off[j] + sd - 1.1, off[j] + sd + 1.1, 'rgba(112,90,58,0.34)');
    }
    const COL = ['rgba(104,84,56,0.5)', 'rgba(232,216,180,0.55)', 'rgba(150,128,92,0.45)', 'rgba(84,70,50,0.4)'];
    for (let i = 0; i < T.N; i++) {
      const a = share[i]; if (!a) continue;
      for (let n = 0; n < 46 * a * a; n++) {
        const l = -T.WR[i] + r() * (T.WL[i] + T.WR[i]), t = r() * T.STEP, [x, z] = P(i, l), big = r() < 0.12, d = (big ? 1 : 0.5) * GK;
        g.fillStyle = COL[(r() * COL.length) | 0]; g.fillRect(Math.floor((x + T.TX[i] * t * GK) / d) * d, Math.floor((z + T.TZ[i] * t * GK) / d) * d, d, d);
      }
    }
  }
  // The shadows of what casts none of its own (the drawn trees, the cheap city and the great buildings, none of them
  // in the sun's shadow pass): painted, all at once so that where they cross they are no darker, the way the spring
  // sun throws them (north and a little west, about four fifths as long as the thing is tall).
  {
    const sx = -SPRING.sun.x / SPRING.sun.y, sz = -SPRING.sun.z / SPRING.sun.y;
    g.beginPath();
    const quad = (x0, z0, x1, z1, hw) => { const l = Math.hypot(x1 - x0, z1 - z0) || 1, px = -(z1 - z0) / l * hw, pz = (x1 - x0) / l * hw, ex = (x1 - x0) / l * hw, ez = (z1 - z0) / l * hw; g.moveTo((x0 - ex + px) * GK, (z0 - ez + pz) * GK); g.lineTo((x1 + ex + px) * GK, (z1 + ez + pz) * GK); g.lineTo((x1 + ex - px) * GK, (z1 + ez - pz) * GK); g.lineTo((x0 - ex - px) * GK, (z0 - ez - pz) * GK); g.closePath(); };
    for (const [x, z, size, , kind] of GROVE) { const h = (kind ? 13 : 30) * size, r = (kind ? 14 : 12) * size; g.moveTo((x + sx * h + r) * GK, (z + sz * h) * GK); g.ellipse((x + sx * h) * GK, (z + sz * h) * GK, r * GK, r * 0.8 * GK, 0, 0, Math.PI * 2); quad(x, z, x + sx * h, z + sz * h, 1.2); }
    for (const b of plan().boxes) { const h = Math.max(2, Math.round(b.h / 12)) * 12, dx = sx * h, dz = sz * h; for (const [ax, az, bx, bz] of [[b.x0, b.z0, b.x0 + b.w, b.z0], [b.x0, b.z0, b.x0, b.z0 + b.d], [b.x0 + b.w, b.z0 + b.d, b.x0 + b.w, b.z0], [b.x0 + b.w, b.z0 + b.d, b.x0, b.z0 + b.d]]) { g.moveTo(ax * GK, az * GK); g.lineTo(bx * GK, bz * GK); g.lineTo((bx + dx) * GK, (bz + dz) * GK); g.lineTo((ax + dx) * GK, (az + dz) * GK); g.closePath(); } g.rect((b.x0 + dx) * GK, (b.z0 + dz) * GK, b.w * GK, b.d * GK); }
    for (const [x0, y0, z0, x1, y1, z1] of stones()) { const dx = sx * y1, dz = sz * y1; if (y0 > 0) { if (y1 - y0 > 3 && x1 - x0 > 3) g.rect((x0 + dx) * GK, (z0 + dz) * GK, (x1 - x0) * GK, (z1 - z0) * GK); } else if (x1 - x0 > 3) quad((x0 + x1) / 2, (z0 + z1) / 2, (x0 + x1) / 2 + dx, (z0 + z1) / 2 + dz, (x1 - x0 + z1 - z0) / 4); }
    for (const m of MODELS) {
      const { S, NY } = m.vol, v = m.vol.full || m.vol.m, c = Math.cos(m.turn), sn = Math.sin(m.turn), y0 = m.name === 'Monument' ? KNOLL.base : 0;
      for (let z = 0; z < S; z += 2) for (let x = 0; x < S; x += 2) {
        let top = 0; for (let y = NY - 1; y > 0; y--) if (v[(y * S + z) * S + x]) { top = y + 1; break; }
        if (top < 3) continue;
        const lx = (x + 1 - S / 2) * m.k, lz = (z + 1 - S / 2) * m.k, wx = m.x + lx * c + lz * sn, wz = m.z - lx * sn + lz * c, h = top * m.k + y0;
        quad(wx, wz, wx + sx * h, wz + sz * h, m.k * 1.3);
      }
    }
    g.fillStyle = 'rgba(18,30,52,0.34)'; g.fill('nonzero');
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

const MALL_DIRT = [0.27, 0.2, 0.11];   // the Mall's dirt as light (its paint is rgb 196, 172, 128, a little darker in the lump)
const P = (name) => course().parts.find((p) => p.name === name);
let ROOFS = null;
// Washington past the map's edge (backdrops/potomac.js): where the shores leave the map (the numbers are the map's own
// shores at its edges), the downtown north of the White House, the towers across the river and down it, the cathedral,
// the bridge at Georgetown, the Pentagon's ground (kept clear: half of it stands past the edge), and Rock Creek's woods
const BACKDROP = {
  kind: 'potomac', seed: 1791,
  world: [0, 0, WX, WZ], view: { x: 512, z: 512 }, course: [100, 40, 1000, 1000], reach: 2200,
  water: 0x4d8fa8, lawn: 0x74a65e, pave: 0xcfc9b9,
  shores: { west: BANK[0][0], va: [613, 0.13], south: [336.5, 465.4, 742.8], east: [953, 0.3], far: [1130, 0.3, 700] },
  downtown: { x: 560, z: -260, r: 520, k: 1.35 },
  towers: [{ x: -340, z: 300, r: 230, n: 16, h: 300 }, { x: 140, z: 1440, r: 200, n: 12, h: 190 }],
  cathedral: [340, -640],
  bridges: [{ a: [BANK[0][0] + 4, 190], b: [-58, 190], y: 30, w: 34, span: 44 }],
  keep: [[62, 1000, 250]],
  green: (x, z) => x > 150 && x < 330 && z < 0 && z > -760,
  boats: [{ x: 30, z: 330, len: 46, yaw: 1.5 }, { x: 400, z: 1170, len: 60, yaw: 1.25 }, { x: 880, z: 1004, len: 40, yaw: 0.15 }],
  hills: [0.5, 0.8, 0.9, 0.9, 1, 1, 1.15, 0.9, 0.5],
  heli: { ahead: 290, y: 96, size: 1.5, sway: 18 },
};
export default {
  id: 'capital', name: 'Capital Circuit', mode: 'race', laps: 3, hidden: true,
  blurb: 'Three laps of Washington: down the Avenue to the Capitol, the freeway, the Mall, through the Reflecting Pool, two bridges, the Metro, Georgetown and Dupont Circle. Guns on.',
  loading: ['Closing the Avenue', 'Building Washington, filling the pool and digging the Metro'],
  outer: 0x8fae78,
  look: { kind: 'spring' },
  backdrop: BACKDROP,
  lodK: 0.34,   // (the Avenue has the city close on both sides for a long way: a little less of it in full than Empire City)
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
      { kind: 'custom', make: (api) => { for (const m of MODELS) { const g = statueMesh(m.vol, m.k, { glow: [1.5, 1.4, 1.1], greedy: true }); g.position.set(m.x, m.name === 'Monument' ? KNOLL.base : 0, m.z); g.rotation.y = m.turn; g.name = m.name; api.scene.add(g); if (m.name === 'Pentagon') { const p = pentagonMesh(); p.position.set(m.x, 0, m.z); p.rotation.y = m.turn; p.name = 'Pentagon walls'; api.scene.add(p); } } } },
      { kind: 'custom', make: (api) => { dressBridges(api.scene, course().T, [{ part: P('14th Street Bridge'), kind: 'truss' }]); api.scene.add(stoneMesh()); } },
      { kind: 'custom', make: (api) => { const p = P('Metro'), T = course().T, i = T.at(p.i0 + p.open[0]); makeStation(api.scene, { x: T.X[i], w: course().W[i], z0: p.openZ[0], z1: p.openZ[1], y0: p.h, y1: p.roofY, name: 'SMITHSONIAN', style: 'vault' }); } },
      { kind: 'el', x: COURSE[14][0] - 18 - 10.5, z0: P('Metro').openZ[0] - 56, z1: P('Metro').openZ[1] + 56, ground: true, y: P('Metro').h, every: 7, speed: 64, see: 130, model: 'commuter', paint: 'blue' },
      { kind: 'custom', make: (api) => { api.MAP.blocks = makeDcBlocks(api.scene, [...plan().boxes, ...potomacCity(BACKDROP).near.map(aim)], CLOCK, HEROES); return { step(dt) { CLOCK.value += dt; } }; } },
      { kind: 'custom', make: (api) => makeCrowd(api.scene, crowd(), CLOCK, { glow: null, key: 'dc' }) },
      { kind: 'custom', make: (api) => makeKites(api.scene) },
      { kind: 'custom', make: (api) => makePetals(api, [430, 690, 720, 1000], CLOCK, { n: 460, px: 0.55 }) },
      { kind: 'custom', make: (api) => { api.MAP.grove = makeGrove(api, [...GROVE, ...FAR]); } },
      { kind: 'custom', make: (api) => { const far = potomacLand(BACKDROP).land, inMap = (x, z) => x >= 0 && z >= 0 && x < WX && z < WZ; return makeWater(api.scene, { x0: -1024, z0: -1024, span: 3072, sun: SPRING.sun, sky: 0xbcd6ee, glint: 0xffffff, isWater: (x, z) => (inMap(x, z) ? !land(x, z) || inPool(x, z) : far(x, z) < 0), pools: [[POOL.x0, POOL.z0, POOL.x1, POOL.z1, 0.55]] }); } },
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
  // the Reflecting Pool: its water holds a car back a little, and comes up off the wheels (dirt.js)
  wetAt: (x, z) => (inPool(x, z) ? 1 : 0),
  // the Mall's road is dirt and gravel (paint(), legs 6 to 9): the wheels throw it up (dirt.js), and lay no rubber
  dirtAt(x, z) {
    if (!TR) return null;
    const ix = Math.floor(x), iz = Math.floor(z); if (ix < 0 || iz < 0 || ix >= WX || iz >= WZ) return null;
    const T = TR.T, c = iz * WX + ix, i = T.field.near[c]; if (i < 0) return null;
    const l = T.field.lat[c], g = course().leg[i];
    return g >= 6 && g <= 9 && l < T.WL[i] && l > -T.WR[i] ? MALL_DIRT : null;
  },
  surface(x, z) { if (!grassy || !TR) return 0; if (inPool(x, z)) return 0.3; const c = clamp(Math.floor(z), 0, WZ - 1) * WX + clamp(Math.floor(x), 0, WX - 1), d = heights().deck[c]; return d === d || masks().cut[c] ? 0 : surfaceAt(TR.T, grassy, x, z); },
  get track() { return full(); },
};
