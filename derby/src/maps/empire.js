// Empire City: New York's big race, on a map of its own (Will, 2026-11-24, after a go round the Empire Loop: "I feel like
// you're keeping the map size the same. I think we need to redraw the map, add more ups and downs, such as being able
// to go into a subway area", "go through central park, not drive past it", "go around the statue of liberty", "bridges a
// little longer", "the buildings overall can be larger". Then: "there are probably a lot of performance savings ...
// everything doesn't need to be destroyable"). The plan Will was shown: /mnt/project-files/race-v2/empire-city-plan.png.
//
// Nothing here is Monster Mayhem's New York: the land, the water and every street are laid out for the race. Three laps
// with the guns on (modes/race.js), about 5,700 voxels a lap. From the line in Times Square heading east:
//   out of the plaza and over the Queens Bridge (up and over the East River), left up Brooklyn's waterfront, right, and
//   right again down the avenue under the El, right over the Brooklyn Bridge, through the downtown canyon, out over the
//   harbor on a causeway and all the way round the Statue of Liberty, back over the neck to the West Side, down into the
//   subway (an open cut, a tunnel, and up again), right along Harlem's river, right into the park and through it over
//   its hills, out the top, right onto the River Drive flyover (up over the avenues, and over the start straight), down,
//   right through the alley and the garment district, and right twice into Times Square.
//
// The road goes up and down (maps/heights.js says how high it is anywhere; maps/roads.js draws the decks and the cut,
// which are not voxels). The course is shut in the whole way round: concrete barriers on the streets, a stone wall in
// the park, parapets on the decks, the cut's own walls. So only what stands beside the course is voxels (the barriers,
// the rows of buildings that face it, the first row of the park's trees, the statue): the rest of the city is drawn
// the cheap way, and nothing can hit it. Every block off the course is boxes with a drawn front on each side
// (maps/blocks.js), the trees behind the first row are models (maps/trees.js), and the rivers and the harbour move
// under one flat sheet (maps/water.js).
import { WX, WZ, M, place, ctx, setSeed, bodies, put, set, begin, LOC, ri, rnd, vehicles } from '../../../src/world.js';
import { lampPost } from '../../../src/kit.js';
import { tenement, brownstone, deco, billboard } from '../../../src/nyc_kit.js';
import { LIBERTY } from '../../../src/nyc_landmarks.js';
import { grabStatue, statueMesh } from './statue.js';
import { dressBridges } from './bridges.js';
import { makeStation } from './station.js';
import { makeScreens } from './screens.js';
import { makeBlocks } from './blocks.js';
import { plantTree, makeGrove } from './trees.js';
import { makeWater } from './water.js';
import { DUSK } from '../looks/dusk.js';
import { harborLand } from '../backdrops/harbor.js';
import { tower, church } from '../../../src/buildings_b.js';
import { shop } from '../../../src/buildings_a.js';
import { canvasFor, finish, pickSpot, GK } from './common.js';
import { makeTrack, streetLoop, racingLine } from './racetrack.js';
import { gantry, gatesFor, gridFor, paintCourse, grassOf, surfaceAt, radarCourse } from './circuit.js';
import { makeHeights } from './heights.js';
import { makeRoads } from './roads.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// ---- the land ------------------------------------------------------------------------------------------------------
// Manhattan down the middle with the Battery at its foot, the Hudson west of it and the East River east, Brooklyn and
// Queens across that, the Harlem River along the top, and Liberty's island in the harbor, joined to the West Side by a
// neck of land.
const SH = { W: 60, E: 645, N: 34, S: 735, BK: 795, BAT_X: 456, BAT_Z: 900, SH_X: 372, SH_Z: 792 };   // (SH_: the shoulder of land west of the Battery, behind the alley)
const ISLE = { x: 185, z: 895, half: 119, r: 56 };
const NECK = { x0: 174, x1: 236, z0: 728, z1: 784 };
const PARK = { x0: 236, z0: 106, x1: 542, z1: 420 };
const BATTERY = { x0: 458, z0: 742, x1: 566, z1: 898 };
const POND = { x: 352, z: 236, rx: 15, rz: 62 };
const rbox = (x, z, cx, cz, h, r) => { const dx = Math.max(Math.abs(x - cx) - (h - r), 0), dz = Math.max(Math.abs(z - cz) - (h - r), 0); return dx * dx + dz * dz <= r * r; };
const onIsle = (x, z) => rbox(x, z, ISLE.x, ISLE.z, ISLE.half, ISLE.r);
const land = (x, z) => (x >= SH.W && x <= SH.E && z >= SH.N && (z <= SH.S || (x >= SH.BAT_X && z <= SH.BAT_Z) || (x >= SH.SH_X && z <= SH.SH_Z))) || x >= SH.BK || onIsle(x, z) || (x >= NECK.x0 && x <= NECK.x1 && z >= NECK.z0 && z <= NECK.z1);
const inPark = (x, z) => x > PARK.x0 && x < PARK.x1 && z > PARK.z0 && z < PARK.z1;

// ---- the course ----------------------------------------------------------------------------------------------------
// each corner [x, z, radius of the curve round it]; a leg is the run from one corner to the next, numbered by its first
const LINE_X = 470, LINE_Z = 560, GANTRY_Y = 27;
const COURSE = [
  [LINE_X, LINE_Z, 0],   //  0  the line, in Times Square: east, and over the Queens Bridge
  [850, 560, 40],        //  1  left, up Brooklyn's waterfront
  [850, 200, 40],        //  2  right
  [968, 200, 40],        //  3  right, down the avenue under the El
  [968, 800, 40],        //  4  right, over the Brooklyn Bridge and into the canyon
  [560, 800, 60],        //  5  half left, down to the Battery
  [490, 870, 60],        //  6  half right, out on the causeway
  [277, 870, 30],        //  7  left, round the statue: south
  [277, 987, 60],        //  8  right: west
  [93, 987, 60],         //  9  right: north
  [93, 803, 60],         // 10  right: east
  [205, 803, 30],        // 11  left, over the neck
  [205, 705, 30],        // 12  left
  [112, 705, 30],        // 13  right, up the West Side and down into the subway
  [112, 70, 40],         // 14  right, along the Harlem River
  [290, 70, 44],         // 15  right, into the park
  [290, 365, 44],        // 16  left
  [410, 365, 40],        // 17  left
  [410, 205, 40],        // 18  right
  [510, 205, 40],        // 19  left, out of the park
  [510, 70, 40],         // 20  right
  [612, 70, 35],         // 21  right, down the River Drive and up over the flyover
  [612, 700, 40],        // 22  right, through the alley and the garment district
  [290, 700, 40],        // 23  right
  [290, 560, 40],        // 24  right, into Times Square
];
const NL = COURSE.length;
// how much room each side of the middle line (the barriers stand just past it)
function widthAt(leg, x, z) {
  switch (leg) {
    case 24: return 40;                                // the plaza, and the grid on it
    case 0: return x > 610 ? 22 : 27;                  // out of the plaza, then the Queens Bridge
    case 1: return 28;
    case 3: return 25;                                 // under the El
    case 4: return x > 610 ? 22 : 18;                  // the Brooklyn Bridge, then the canyon
    case 5: return 18;
    case 6: return 20;                                 // the causeway
    case 7: case 8: case 9: case 10: return 24;        // round the statue
    case 11: case 12: return 24;
    case 13: return z < 668 && z > 300 ? 16 : 24;      // the subway
    case 15: return 36;                                // the park
    case 16: case 17: return 32;
    case 18: case 19: return 28;
    case 21: return 22;                                // the River Drive
    case 22: return x < 548 && x > 392 ? 12 : 26;      // the alley
    default: return 27;
  }
}
const W_MOST = 40;
// The parts off the flat ground. A deck is a road in the air and a cut one below the ground; `a` to `b` is where it runs
// along its leg (x or z, whichever the leg runs along), `h` how high (or deep) and `up` the length of the slope at each
// end. A deck no higher than `solid` stands on a wall (a ramp, a causeway); higher, it is open underneath on `piers`.
const PARTS = [
  { name: 'Queens Bridge', kind: 'deck', leg: 0, a: 636, b: 800, h: 16, up: 76, piers: 44 },
  { name: 'Brooklyn Bridge', kind: 'deck', leg: 4, a: 800, b: 636, h: 16, up: 76, piers: 44 },
  { name: 'Causeway', kind: 'deck', leg: 6, a: 452, b: 296, h: 6, up: 44, solid: 99 },
  { name: 'Subway', kind: 'cut', leg: 13, a: 656, b: 312, h: -16, up: 72, roof: [576, 392], roofY: -1.5, open: [560, 408] },
  { name: 'River Drive', kind: 'deck', leg: 21, a: 250, b: 644, h: 16, up: 78, piers: 48, solid: 15.6 },
];
// the park's hills: [leg, the middle of it along the leg, how high, half its length]
const HILLS = [[15, 215, 9, 86], [17, 286, 7, 62]];
const MARGIN = 6.5;                 // how far inside the room the racing line keeps a car's middle
const GATES = 64;                   // checkpoint gates round the lap (about one every 90 voxels)
// the El: portal frames over the avenue in Brooklyn (voxels), the deck and the train over them (hazards.js 'el')
const EL = { x: 968, z0: 44, z1: 980, every: 40, y: 32 };   // (it runs on past both ends of the avenue, so the train is seen crossing ahead)

const ramp = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const hump = (d, a, b, c, e) => (d <= a || d >= e ? 0 : d < b ? ramp((d - a) / (b - a)) : d <= c ? 1 : ramp((e - d) / (e - c)));

// ---- the course's shape: plain numbers, worked out once ------------------------------------------------------------
let CO = null;
function course() {
  if (CO) return CO;
  const T = makeTrack({ pts: streetLoop(COURSE), halfW: W_MOST, smooth: false, WX, WZ, reach: W_MOST + 14 });
  const { N, X, Z, TX, TZ, K, STEP } = T;
  // which leg each sample is on: the nearest that runs its way
  const leg = new Int16Array(N);
  for (let i = 0; i < N; i++) {
    let bd = 1e9;
    for (let k = 0; k < NL; k++) {
      const a = COURSE[k], b = COURSE[(k + 1) % NL], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      if ((TX[i] * dx + TZ[i] * dz) / l < 0.7) continue;
      const t = clamp(((X[i] - a[0]) * dx + (Z[i] - a[1]) * dz) / (l * l), 0, 1), d = Math.hypot(X[i] - a[0] - dx * t, Z[i] - a[1] - dz * t);
      if (d < bd) { bd = d; leg[i] = k; }
    }
  }
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
  const along = (k) => (COURSE[k][1] === COURSE[(k + 1) % NL][1] ? X : Z);
  const parts = PARTS.map((p) => {
    const V = along(p.leg), lo = Math.min(p.a, p.b), hi = Math.max(p.a, p.b), D = hi - lo, idx = [];
    for (let i = 0; i < N; i++) if (leg[i] === p.leg && V[i] >= lo && V[i] <= hi) { idx.push(i); H[i] = p.h * hump(Math.abs(V[i] - p.a), 0, p.up, D - p.up, D); on[i] = p.kind === 'deck' ? 1 : 2; }
    const q = { ...p, i0: idx[0], n: idx.length - 1, H, half: (i) => W[i] };
    if (p.roof) { const r0 = Math.min(...p.roof), r1 = Math.max(...p.roof), ks = idx.map((i, k) => (V[i] >= r0 && V[i] <= r1 ? k : -1)).filter((k) => k >= 0); q.roof = [ks[0], ks[ks.length - 1]]; q.roofBox = V === Z ? [X[idx[0]] - W[idx[0]], r0, X[idx[0]] + W[idx[0]], r1] : [r0, Z[idx[0]] - W[idx[0]], r1, Z[idx[0]] + W[idx[0]]]; }
    if (p.open) { const r0 = Math.min(...p.open), r1 = Math.max(...p.open), ks = idx.map((i, k) => (V[i] >= r0 && V[i] <= r1 ? k : -1)).filter((k) => k >= 0); q.open = [ks[0], ks[ks.length - 1]]; q.openZ = [r0, r1]; }
    return q;
  });
  const hills = HILLS.map(([lg, mid, h, half]) => {
    const V = along(lg), idx = [];
    for (let i = 0; i < N; i++) if (leg[i] === lg && Math.abs(V[i] - mid) < half) { idx.push(i); H[i] = h * (0.5 + 0.5 * Math.cos(Math.PI * (V[i] - mid) / half)); hilly[i] = 1; }
    return { i0: idx[0], n: idx.length - 1 };
  });
  return (CO = { T, leg, W, H, on, hilly, parts, hills });
}
// how high the road is, anywhere (heights.js)
let HT = null;
function heights() {
  if (HT) return HT;
  const { T, W, H, parts, hills } = course(), hm = makeHeights();
  for (const h of hills) hm.lay(T, H, h.i0, h.i0 + h.n, (i) => W[i] + 3, { kind: 'hill', flat: 6, fade: 30 });
  for (const p of parts) hm.lay(T, H, p.i0, p.i0 + p.n, (i) => W[i], { kind: p.kind, top: 4 });
  return (HT = hm);
}
// what is taken, a voxel at a time: `road` the course on the ground (not the decks over it or the cut under it), `used`
// the whole course and a little either side (nothing is built there)
let MK = null;
function masks() {
  if (MK) return MK;
  const { T, on } = course(), { N, X, Z, TX, TZ, STEP, WL, WR } = T, road = new Uint8Array(WX * WZ), used = new Uint8Array(WX * WZ);
  for (let i = 0; i < N; i++) {
    const j = T.at(i + 1);
    for (let a = 0; a < STEP; a += 0.5) {
      const t = a / STEP, cx = X[i] + (X[j] - X[i]) * t, cz = Z[i] + (Z[j] - Z[i]) * t;
      for (let l = -(WR[i] + 5); l <= WL[i] + 5; l += 0.5) {
        const x = Math.floor(cx + TZ[i] * l), z = Math.floor(cz - TX[i] * l); if (x < 0 || z < 0 || x >= WX || z >= WZ) continue;
        used[z * WX + x] = 1; if (!on[i] && l >= -WR[i] && l <= WL[i]) road[z * WX + x] = 1;
      }
    }
  }
  // (and nothing is built under the El where it runs on past the avenue)
  for (let z = EL.z0 - 6; z <= EL.z1 + 6; z++) for (let x = EL.x - 33; x <= EL.x + 33; x++) used[z * WX + x] = 1;
  return (MK = { road, used, taken: new Uint8Array(WX * WZ) });
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
  const grid = gridFor(T, 1);   // pole on the left: the first corner, over the bridge, goes left
  const g = { x: LINE_X, z: LINE_Z, y: GANTRY_Y };
  const lights = { x: LINE_X - 1.3, y: g.y - 2.4, z: LINE_Z, yaw: Math.PI / 2, lx: 0, lz: 1 };   // in front of the lights' box, facing the grid
  return (TR = { T, P: null, line, gates, gateS, grid, gantry: g, lights, HALF: 27, PIT_HALF: 0, H });
}

// ---- what stands beside the course -----------------------------------------------------------------------------------
// The barriers: a wall along each edge of the course wherever it runs on the ground, a body every 64 voxels of it.
// Concrete blocks with a red and white top on the streets, a stone wall in the park. On a hill they stand as high as
// the hill does.
function barriers() {
  const { T, H, on } = course(), { N, X, Z, TX, TZ, STEP, WL, WR } = T, { road } = masks();
  for (let i0 = 0; i0 < N; i0 += 32) {
    let open = false;
    for (let i = i0; i < Math.min(N, i0 + 32); i++) {
      if (on[i]) continue;
      if (!open) { begin('Barrier', 'barrier', false); open = true; }
      const j = T.at(i + 1), park = inPark(X[i], Z[i]), top = Math.round(H[i]) + (park ? 3 : 4), cap = park ? M.TRIM : Math.floor(i / 3) & 1 ? M.CAR_A : M.TRIM, m = park ? M.GRANITE : M.CONC;
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
// for one. What each is depends on the part of town. Worked out once (the plan), for the voxels and for the cheap city
// behind them, which keeps off these lots.
const SIGNS = [['GRIT COLA', M.DARK, M.LIT_R], ['ZAPP OIL', M.DARK, M.LIT_Y], ['NEW YORK GP', M.DARK, M.LIT_W], ['BOLTZ', M.DARK, M.LIT_B], ['SCRAP CITY', M.DARK, M.LIT_G], ['HOT SPARK', M.DARK, M.LIT_P], ['DENT KINGS', M.DARK, M.LIT_Y]];
const SHOPS = [['DELI', 'Delicatessen'], ['PIZZA', 'Pizzeria'], ['BODEGA', 'Bodega'], ['DINER', 'Diner'], ['TIRES', 'Tire shop'], ['LAUNDRY', 'Laundromat'], ['HOTDOGS', 'Hot dog stand'], ['BAGELS', 'Bagel shop'], ['RECORDS', 'Record shop'], ['PAWN', 'Pawn shop']];
const BANKS = ['BANK', 'TRUST', 'APEX', 'UNION', 'CROWN', 'ATLAS', 'METRO', 'STAR'];
function district(x, z) {
  if (x >= SH.BK) return 'B';
  if (z > SH.S) return 'F';
  if (z < PARK.z0) return 'U';
  if (x < PARK.x0) return 'W';
  if (z >= 470 && z <= 650) return x > 300 && x < 500 ? 'T' : 'M';
  if (z > 650) return 'V';
  return 'E';
}
function kitFor(d, R) {
  const p = (a) => a[Math.floor(R() * a.length)], n = (a, b) => a + Math.floor(R() * (b - a + 1)), r = R(), plain = { inside: false, car: 0 };
  const bricks = [M.BRICK, M.BRICK2, M.BROWNST], awns = [M.AWN_R, M.AWN_G, M.AWN_B, M.AWN_W], doors = [M.DOOR_G, M.DOOR_R, M.DOOR_B, M.DARK];
  const tene = (lo, hi, loft) => { const [name, title] = p(SHOPS); return ['tenement', { ...plain, floors: n(lo, hi), name, title, wall: p(bricks), front: p(doors), awn: p(awns), tank: R() < 0.6, loft: loft ? 1 : 0 }]; };
  const brown = () => ['brownstone', { ...plain, walls: [p(bricks), p(bricks), p(bricks)], doors: [p(doors), p(doors), p(doors)], floors: [n(4, 5), n(4, 5), n(4, 5)] }];
  const apts = (lo, hi) => ['deco', { ...plain, floors: n(lo, hi), title: 'Apartment house', wall: p([M.BRICK2, M.LIME2, M.BRICK, M.REND_C]), span: M.DARK, crown: p(['tank', 'lantern', 'twin']), cap: p([M.ROOF_G, M.ROOF_D, M.COPPER]) }];
  const offices = (lo, hi) => (R() < 0.56
    ? ['deco', { ...plain, floors: n(lo, hi), wall: p([M.LIME, M.LIME2, M.REND_C]), span: p([M.DARK, M.SPANDREL]), crown: p(['pyramid', 'pyramid', 'lantern', 'tank', 'mast']), cap: p([M.ROOF_G, M.COPPER, M.ROOF_D, M.BRASS]) }]
    : ['tower', { ...plain, floors: n(lo, hi), name: p(BANKS), glass: p([M.GLASS, M.GLASS_G, M.GLASS_Z]), span: p([M.SPANDREL, M.SPAN_G, M.SPAN_Z]), ink: p([M.LIT_W, M.LIT_Y, M.LIT_B]) }]);
  switch (d) {
    case 'T': return r < 0.8 ? ['billboard', { ...plain, floors: n(9, 12), signs: [p(SIGNS), p(SIGNS), p(SIGNS), p(SIGNS), p(SIGNS)] }] : offices(15, 17);
    case 'M': case 'F': return offices(15, 17);
    case 'W': case 'E': return r < 0.65 ? apts(12, 16) : r < 0.9 ? tene(7, 9) : brown();
    case 'U': return r < 0.5 ? tene(6, 8) : r < 0.75 ? apts(9, 12) : r < 0.9 ? brown() : r < 0.95 ? ['church', null] : ['shop', { ...plain, name: p(SHOPS)[0], wall: p(bricks), awn: p(awns), door: p(doors) }];
    case 'V': return r < 0.5 ? tene(6, 9, true) : r < 0.75 ? tene(6, 8) : apts(10, 14);
    default: return r < 0.45 ? tene(6, 8, R() < 0.3) : r < 0.75 ? apts(9, 13) : r < 0.9 ? brown() : ['shop', { ...plain, name: p(SHOPS)[0], wall: p(bricks), awn: p(awns), door: p(doors) }];
  }
}
const KITS = { tenement, brownstone, deco, billboard, tower, church, shop };
let PLAN = null;
function plan() {
  if (PLAN) return PLAN;
  const { T, leg } = course(), { N, X, Z, WL, WR } = T, lots = [];
  let s = 20261124; const R = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  for (let k = 0; k < NL; k++) {
    const a = COURSE[k], b = COURSE[(k + 1) % NL], c = COURSE[(k + 2) % NL], p = COURSE[(k - 1 + NL) % NL];
    const dx = Math.sign(b[0] - a[0]), dz = Math.sign(b[1] - a[1]); if (dx && dz) continue;   // (the one slanted leg has no rows)
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const trim = (q, m, e) => { const ux = m[0] - q[0], uz = m[1] - q[1], vx = e[0] - m[0], vz = e[1] - m[1], t = Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz); return (m[2] || 0) * Math.tan(Math.abs(t) / 2); };
    const s0 = trim(p, a, b) + 4, s1 = len - trim(a, b, c) - 4, n = Math.floor((s1 - s0 + 4) / 44); if (n < 1) continue;
    const start = s0 + (s1 - s0 - (n * 44 - 4)) / 2, mine = []; for (let i = 0; i < N; i++) if (leg[i] === k) mine.push(i);
    for (let j = 0; j < n; j++) for (const sd of [1, -1]) {
      const t0 = start + j * 44, t1 = t0 + 39;
      // the most room the course has along this lot, on its side
      let w = 0; for (const i of mine) { const t = (X[i] - a[0]) * dx + (Z[i] - a[1]) * dz; if (t >= t0 - 3 && t <= t1 + 3) w = Math.max(w, sd > 0 ? WL[i] : WR[i]); }
      if (!w) continue;
      const nx = dz * sd, nz = -dx * sd, o0 = w + 7, o1 = o0 + 39;   // out to the lot's near and far edges
      const xs = [a[0] + dx * t0 + nx * o0, a[0] + dx * t1 + nx * o1], zs = [a[1] + dz * t0 + nz * o0, a[1] + dz * t1 + nz * o1];
      const x0 = Math.round(Math.min(...xs)), z0 = Math.round(Math.min(...zs)), x1 = x0 + 39, z1 = z0 + 39;
      if (!free(x0, z0, x1, z1) || onIsle(x0 + 20, z0 + 20)) continue;   // (nothing on the island but the statue)
      take(x0 - 2, z0 - 2, x1 + 2, z1 + 2);
      const f = nz > 0 ? 0 : nx < 0 ? 1 : nz < 0 ? 2 : 3;   // its front to the course (the course is the other way from the way out)
      const [kit, o] = kitFor(district(x0 + 20, z0 + 20), R);
      lots.push({ x: x0, z: z0, f, kit, o, seed: 4000 + lots.length * 37 });
    }
  }
  // the city off the course: between a grid of streets (every 104, as the ground is painted), every block filled with
  // buildings wherever there is land that nothing else has taken: one big one, two slabs or four, and smaller ones
  // fitted into what the course leaves of a block
  const boxes = [], open = (x0, z0, w, d) => free(x0 - 2, z0 - 2, x0 + w + 2, z0 + d + 2) && !onIsle(x0 + w / 2, z0 + d / 2) && !(x0 + w > BATTERY.x0 && x0 < BATTERY.x1 && z0 + d > BATTERY.z0 && z0 < BATTERY.z1);
  const add = (x0, z0, w, d) => {
    take(x0 - 2, z0 - 2, x0 + w + 2, z0 + d + 2);
    const dd = district(x0 + w / 2, z0 + d / 2), tall = dd === 'M' || dd === 'F' || dd === 'T', mid = dd === 'W' || dd === 'E' || dd === 'V', r = R(), small = Math.min(w, d);
    const h = Math.min(small < 24 ? 60 : small < 32 ? 110 : small < 40 ? 200 : 999, (tall ? 230 + r * 250 : mid ? 150 + r * 170 : 84 + r * 110) * (w * d >= 6000 ? 1.15 : 1));
    const q = R(), style = tall ? (q < 0.5 ? 'lime' : q < 0.8 ? 'glass' : 'tan') : mid ? (q < 0.4 ? 'brick' : q < 0.75 ? 'tan' : q < 0.9 ? 'lime' : 'brown') : (q < 0.45 ? 'brick' : q < 0.75 ? 'brown' : 'tan');
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
// Times Square's screens: a big one on the front of every building that faces the plaza, a blade sign hung out from it
// over the pavement, facing the cars as they come, and a stack of them head-on where the course turns in from the south
function screens() {
  const out = [];
  for (const L of plan().lots) {
    const cx = L.x + 20, cz = L.z + 20; if (district(cx, cz) !== 'T' || Math.abs(cz - LINE_Z) > 70) continue;
    const [nx, nz] = [[0, -1], [1, 0], [0, 1], [-1, 0]][L.f];
    out.push({ x: cx + nx * 16.5, y: 38, z: cz + nz * 16.5, nx, nz, w: 30, h: 30 });
    out.push({ x: cx + nx * 20 + 12, y: 31, z: cz + nz * 20, nx: -1, nz: 0, w: 8, h: 26 });   // (the cars come from the west)
  }
  for (let k = 0; k < 3; k++) out.push({ x: 290, y: 30 + k * 30, z: 498, nx: 0, nz: 1, w: 34, h: 28 });
  return out;
}
// steam from the street here and there, at the road's edge, where the course runs between buildings
function steamPts() {
  const { T, on, hilly, W } = course(), out = [];
  for (let i = 60, k = 0; i < T.N; i += 170, k++) {
    if (on[i] || hilly[i] || inPark(T.X[i], T.Z[i]) || onIsle(T.X[i], T.Z[i])) continue;
    const l = (k % 2 ? 1 : -1) * (W[i] - 5); out.push([T.X[i] + T.TZ[i] * l, T.Z[i] - T.TX[i] * l]);
  }
  return out;
}
function rows() {
  for (const L of plan().lots) {
    setSeed(L.seed); ctx.lot = -1; ctx.L = 3;
    place(L.x, L.z, L.f);
    if (L.kit === 'church') church(LOC, LOC, 3); else KITS[L.kit](LOC, LOC, 3, L.o);
    place(0, 0, -1);
  }
}
// The park: trees either side of the road through it, thick enough to feel like woods, clear of the road and the pond.
// And the island's.
function trees() {
  const { used, taken } = masks();
  setSeed(7711);
  // is the course within r of here?
  const by = (x, z, r) => { for (let dz = -r; dz <= r; dz += r / 2) for (let dx = -r; dx <= r; dx += r / 2) { const X = Math.round(x + dx), Z = Math.round(z + dz); if (X > 0 && Z > 0 && X < WX && Z < WZ && used[Z * WX + X]) return true; } return false; };
  // Beside the road they are voxel trees (maps/trees.js), the first row; behind them, where nothing reaches, the same
  // trees drawn as models (GROVE, made with the hazards), as far back as is seen from the road (`far`).
  const grow = (x0, z0, x1, z1, tries, ok, far = 64) => {
    const got = [];
    for (let t = 0; t < tries; t++) {
      const x = ri(x0, x1), z = ri(z0, z1), near = by(x, z, 22);
      if (!ok(x, z) || (!near && !by(x, z, far)) || got.some((g) => Math.abs(g[0] - x) < 13 && Math.abs(g[1] - z) < 13) || by(x, z, 8)) continue;
      got.push([x, z]);
      if (near) plantTree(x, z, 100 + got.length * 7 + x, 0.9 + rnd() * 0.25); else GROVE.push([x + 0.5, z + 0.5, 0.95 + rnd() * 0.4, rnd() * 6.28]);
    }
  };
  grow(PARK.x0 + 8, PARK.z0 + 8, PARK.x1 - 10, PARK.z1 - 10, 2600, (x, z) => ((x - POND.x) / (POND.rx + 8)) ** 2 + ((z - POND.z) / (POND.rz + 8)) ** 2 > 1);
  // the Battery: a little park where the road swings out to the causeway, the statue ahead over the trees
  grow(BATTERY.x0 + 7, BATTERY.z0 + 7, BATTERY.x1 - 8, BATTERY.z1 - 8, 500, (x, z) => [[0, 0], [-8, -8], [8, -8], [-8, 8], [8, 8]].every(([a, b]) => land(x + a, z + b) && !taken[(z + b) * WX + x + a]));
  grow(ISLE.x - ISLE.half, ISLE.z - ISLE.half, ISLE.x + ISLE.half, ISLE.z + ISLE.half, 400, (x, z) => rbox(x, z, ISLE.x, ISLE.z, ISLE.half - 9, ISLE.r) && Math.hypot(x - ISLE.x, z - ISLE.z) > 96);
}
// the El's frames: a steel column either side of the avenue and a girder across between them, under the deck
function elFrames() {
  const { road } = masks();
  for (let z = EL.z0 + 18; z <= EL.z1 - 16; z += EL.every) {
    if ([EL.x - 30, EL.x + 29].some((x) => road[z * WX + x] || road[(z + 1) * WX + x + 1] || !land(x, z))) continue;   // (no column in the road, where it turns in under the El)
    begin('El frame', 'barrier', false); bodies[bodies.length - 1].see = true;
    for (const x of [EL.x - 30, EL.x + 29]) for (let y = 0; y < EL.y; y++) for (let dz = 0; dz <= 1; dz++) for (let dx = 0; dx <= 1; dx++) put(x + dx, y, z + dz, y < 2 ? M.CONC : (y & 3) === 0 ? M.METAL : M.STEEL);
    for (let x = EL.x - 30; x <= EL.x + 30; x++) for (let dz = 0; dz <= 1; dz++) { set(x, EL.y - 2, z + dz, M.STEEL); set(x, EL.y - 1, z + dz, (x & 3) === 0 ? M.METAL : M.STEEL); }
  }
}
let STATUE = null, STATION = null;
const GROVE = [];
function build() {
  // the statue first, while her island is bare: the engine's own, copied out of the world to be drawn at twice the size
  STATUE = grabStatue(ISLE.x - LIBERTY.S / 2, ISLE.z - LIBERTY.S / 2, 1);   // (she looks east, at the cars coming over the causeway)
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1; setSeed(5115);
  barriers();
  rows();
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1;
  trees();
  elFrames();
  // a lamp now and then along the streets, outside the barriers
  { const { T, on } = course(); setSeed(3003);
    for (let i = 0; i < T.N; i += 40) { if (on[i] || inPark(T.X[i], T.Z[i])) continue; for (const sd of [1, -1]) { const w = (sd > 0 ? T.WL[i] : T.WR[i]) + 4.5, x = Math.round(T.X[i] + T.TZ[i] * sd * w), z = Math.round(T.Z[i] - T.TX[i] * sd * w); if (x > 12 && z > 12 && x < WX - 12 && z < WZ - 12 && land(x, z) && !masks().road[z * WX + x]) lampPost(x, z, 22); } } }
  // the gantry spans the plaza at the line
  vehicles.length = 0;   // nothing parked along the road (Will, 2026-11-24)
  gantry(LINE_X, LINE_Z - 39, LINE_Z + 39, ['EMPIRE CITY', 'NEW YORK GP'], -1, GANTRY_Y);
  finish();
}

// ---- the floor: a grid with the hills' heights, and a hole where the cut is open to the sky ----------------------------
function floorMesh() {
  const hm = heights(), { parts } = course(), G = 8, nx = WX / G, nz = WZ / G, V = (nx + 1) * (nz + 1);
  const position = new Float32Array(V * 3), uv = new Float32Array(V * 2), normal = new Float32Array(V * 3), index = [];
  const hAt = (x, z) => Math.max(0, hm.read(hm.gnd, clamp(x, 1, WX - 1), clamp(z, 1, WZ - 1)));
  const roofs = parts.filter((p) => p.roofBox).map((p) => p.roofBox), roofed = (x, z) => roofs.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3]);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const v = j * (nx + 1) + i, x = i * G, z = j * G;
    position[v * 3] = x; position[v * 3 + 1] = hAt(x, z); position[v * 3 + 2] = z; uv[v * 2] = x / WX; uv[v * 2 + 1] = 1 - z / WZ;
    const sx = (hAt(x + 4, z) - hAt(x - 4, z)) / 8, sz = (hAt(x, z + 4) - hAt(x, z - 4)) / 8, l = Math.hypot(sx, 1, sz);
    normal[v * 3] = -sx / l; normal[v * 3 + 1] = 1 / l; normal[v * 3 + 2] = -sz / l;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const cx = i * G + G / 2, cz = j * G + G / 2;
    if (hm.gnd[cz * WX + cx] < -0.01 && !roofed(cx, cz)) continue;   // the cut, open to the sky
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  return { position, uv, normal, index: new Uint16Array(index) };
}

// ---- the painted ground -------------------------------------------------------------------------------------------
let grassy = null;
const PHONE = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
function paint() {
  const { T, grid, line } = full(), { on } = course(), C = canvasFor('#4e8fa6', 4411), { cv, g } = C;
  const rr = (x0, z0, x1, z1, r) => { g.moveTo((x0 + r) * GK, z0 * GK); g.arcTo(x1 * GK, z0 * GK, x1 * GK, z1 * GK, r * GK); g.arcTo(x1 * GK, z1 * GK, x0 * GK, z1 * GK, r * GK); g.arcTo(x0 * GK, z1 * GK, x0 * GK, z0 * GK, r * GK); g.arcTo(x0 * GK, z0 * GK, x1 * GK, z0 * GK, r * GK); g.closePath(); };
  const landPath = () => {
    g.beginPath();
    rr(SH.W, SH.N, SH.E, SH.S, 14); rr(SH.BAT_X, SH.S - 30, SH.E, SH.BAT_Z, 22); rr(SH.SH_X, SH.S - 30, SH.E, SH.SH_Z, 12); rr(SH.BK, -40, WX + 40, WZ + 40, 1);
    rr(ISLE.x - ISLE.half, ISLE.z - ISLE.half, ISLE.x + ISLE.half, ISLE.z + ISLE.half, ISLE.r); rr(NECK.x0, NECK.z0, NECK.x1, NECK.z1, 2);
  };
  // the shallows and the quay round every shore, then the land: paving
  g.lineJoin = 'round';
  landPath(); g.strokeStyle = 'rgba(120,176,190,0.55)'; g.lineWidth = 14 * GK; g.stroke();
  landPath(); g.strokeStyle = '#6f6a60'; g.lineWidth = 5 * GK; g.stroke();
  landPath(); g.fillStyle = '#8b8984'; g.fill();   // (a mid grey: Will, 2026-11-24, of the pale stone it was, "too white, they need to be a darker grey")
  g.save(); landPath(); g.clip();
  C.speckle(0, 0, WX, WZ, 90000, ['rgba(235,232,224,0.12)', 'rgba(40,38,34,0.14)']);
  // The city off the course stands on pavement: slabs, a joint every eight, and the walks between the blocks (where
  // side streets were painted once) in a slightly lighter grey with a kerb line either side. No street is painted beside the
  // course (Will, 2026-11-24: "our road and cars are much bigger than those roads, so it ruins the perspective. It
  // would look better if those were side walks").
  g.fillStyle = 'rgba(40,38,34,0.2)';
  for (let v = 0; v < WX; v += 8) { C.rect(v - 0.15, 0, v + 0.15, WZ); C.rect(0, v - 0.15, WX, v + 0.15); }
  g.fillStyle = 'rgba(176,174,166,0.3)';
  for (let v = 8; v < WX; v += 104) { C.rect(v - 8, 0, v + 8, WZ); C.rect(0, v - 8, WX, v + 8); }
  g.fillStyle = 'rgba(46,44,40,0.4)';
  for (let v = 8; v < WX; v += 104) for (const e of [-8, 8]) { C.rect(v + e - 0.25, 0, v + e + 0.25, WZ); C.rect(0, v + e - 0.25, WX, v + e + 0.25); }
  // the park: grass, a pond, paths
  g.fillStyle = '#74a65e'; C.rect(PARK.x0, PARK.z0, PARK.x1, PARK.z1);
  C.speckle(PARK.x0, PARK.z0, PARK.x1, PARK.z1, 46000, ['rgba(92,146,74,0.5)', 'rgba(146,192,108,0.45)', 'rgba(170,190,110,0.25)']);
  g.strokeStyle = '#d8cfb6'; g.lineWidth = 2.4 * GK;
  for (const [x, z, rx, rz] of [[352, 236, 40, 96], [462, 300, 34, 80], [470, 150, 60, 26]]) { g.beginPath(); g.ellipse(x * GK, z * GK, rx * GK, rz * GK, 0, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = 'rgba(30,70,84,0.4)'; g.beginPath(); g.ellipse(POND.x * GK, POND.z * GK, (POND.rx + 1.6) * GK, (POND.rz + 1.6) * GK, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#5f9fae'; g.beginPath(); g.ellipse(POND.x * GK, POND.z * GK, POND.rx * GK, POND.rz * GK, 0, 0, Math.PI * 2); g.fill();
  // the island: lawn, and a paved ring round the statue's foot
  g.fillStyle = '#74a65e'; g.beginPath(); rr(ISLE.x - ISLE.half + 5, ISLE.z - ISLE.half + 5, ISLE.x + ISLE.half - 5, ISLE.z + ISLE.half - 5, ISLE.r - 4); g.fill();
  C.speckle(ISLE.x - ISLE.half, ISLE.z - ISLE.half, ISLE.x + ISLE.half, ISLE.z + ISLE.half, 14000, ['rgba(92,146,74,0.5)', 'rgba(146,192,108,0.45)']);
  g.fillStyle = '#d6cdb8'; g.beginPath(); g.arc(ISLE.x * GK, ISLE.z * GK, 70 * GK, 0, Math.PI * 2); g.fill();
  // the Battery's lawn
  g.fillStyle = '#74a65e'; g.beginPath(); rr(BATTERY.x0 + 3, BATTERY.z0 + 3, BATTERY.x1 - 3, BATTERY.z1 - 3, 16); g.fill();
  C.speckle(BATTERY.x0, BATTERY.z0, BATTERY.x1, BATTERY.z1, 9000, ['rgba(92,146,74,0.5)', 'rgba(146,192,108,0.45)']);
  // Times Square's plaza: pale paving round the grid
  g.fillStyle = '#a3a19a'; C.rect(300, LINE_Z - 52, LINE_X + 30, LINE_Z + 52);
  g.restore();
  // the course, on the ground only: the decks and the cut have their own road (roads.js), so they get no room here
  const WLp = T.WL.slice(), WRp = T.WR.slice();
  for (let i = 0; i < T.N; i++) if (on[i]) { WLp[i] = -1.4; WRp[i] = -1.4; }
  paintCourse(g, { ...T, WL: WLp, WR: WRp }, grid, 62, line);
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
  id: 'empire', name: 'Empire City', mode: 'race', laps: 3, hidden: true,
  blurb: 'Three laps of all New York: two bridges, under the El, round the Statue of Liberty, down into the subway, through the park and over the flyover. Guns on.',
  loading: ['Closing the streets', 'Building New York, raising the bridges and digging the subway'],
  outer: 0x4e8fa6,
  look: { kind: 'dusk' },
  backdrop: {
    kind: 'harbor', seed: 7311,
    world: [0, 0, WX, WZ],
    view: { x: 540, z: 540 },
    course: [60, 34, 1000, 1014],
    reach: 2300,
    water: 0x4e8fa6,
    streets: { x: [112, 216, 320, 424, 528], w: 36, zN: [-160, 122], zS: [1100, 122], xE: [1100, 174], xW: [-300, 174] },
    // the far shores: the Bronx north of the Harlem River, the far bank of the Hudson, Brooklyn and Queens on east and
    // south from the map's own, and the island across the harbor
    shores: { harlem: [-70, -24], bronx: -34, jersey: -240, brooklyn: { x: SH.BK, slope: 0.19, south: 1540, fall: 0.45 }, island: { z: 1470, x: 560 }, sound: { x: 1320, z0: 140, z1: 540 } },
    downtowns: [
      { x: -560, z: 880, r: 520, k: 1.55, mark: 1 },
      { x: 1230, z: 700, r: 380, k: 1.4, mark: 3 },
      { x: 1250, z: -380, r: 420, k: 1.2 },
      { x: 1900, z: 400, r: 500, k: 1.3, mark: 5 },
    ],
    bridges: [
      { kind: 'suspension', a: [430, 1525], b: [1110, 1525], towers: [175, 505], w: 46, y: 52, h: 150 },
      { kind: 'stayed', a: [1720, 40], b: [1720, 700], pylon: 332, w: 40, y: 44, h: 190 },
    ],
    expressways: [{ a: [10, -340], b: [2080, -340], w: 70, y: 46 }],
    port: { x0: -150, x1: 420, z: 1505, cranes: 6, stacks: 40 },
    ships: [{ x: 420, z: 1180, len: 150, yaw: 0.3, hull: 0x3a2a26 }, { x: -110, z: 520, len: 120, yaw: 1.45, hull: 0x26313a }],
    traffic: { east: [200, 560, 800], north: [112, 216, 320, 424, 528], length: 900, bank: [-700, 1400] },
    skyline: [0.4, 0.75, 1.0, 0.85, 0.8, 0.75, 0.95, 0.6, 0.4],
    heli: { ahead: 290, y: 96, size: 1.5, sway: 18 },
  },
  lodK: 0.4,
  // the road's height (vehicle.js, main.js's camera), the sides of the decks and the cut, and the floor that is drawn
  floor: (x, z, y) => heights().floor(x, z, y),
  rail: (x, z, y) => heights().rail(x, z, y),
  floorMesh,
  // where the chase camera has a roof over it and stays under it (main.js stepCamera): the tunnel, and the start
  // straight where the flyover crosses it (each from a little before, so the camera is down in time)
  get roofs() {
    if (!ROOFS) { const s = P('Subway').roofBox; ROOFS = [{ x0: s[0], z0: s[1] - 44, x1: s[2], z1: s[3] + 44, y: -1.5 }, { x0: 548, z0: LINE_Z - 30, x1: 676, z1: LINE_Z + 30, y: 13.5 }]; }
    return ROOFS;
  },
  // where the chase camera looks up: coming over the Brooklyn Bridge, and along the causeway, with the statue ahead
  vista(x, z) {
    const sm = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    if (z > 770 && z < 830 && x > 610 && x < 800) return sm((800 - x) / 40) * sm((x - 610) / 40);
    if (z > 790 && z < 900 && x > 290 && x < 560) return sm((560 - x) / 50) * sm((x - 290) / 60);
    return 0;
  },
  get hazards() {
    const s = P('Subway').roofBox, { road } = masks();
    const near = (x, z) => { for (let dz = -5; dz <= 5; dz += 5) for (let dx = -5; dx <= 5; dx += 5) if (road[Math.floor(z + dz) * WX + Math.floor(x + dx)]) return true; return false; };
    return [
      { kind: 'custom', make: (api) => { if (STATUE) { const m = statueMesh(STATUE, 2); m.position.set(ISLE.x, 0, ISLE.z); api.scene.add(m); } } },
      { kind: 'custom', make: (api) => { const { T, parts } = course(), by = (n) => parts.find((p) => p.name === n); dressBridges(api.scene, T, [{ part: by('Queens Bridge'), kind: 'truss' }, { part: by('Brooklyn Bridge'), kind: 'stone' }]); } },
      { kind: 'custom', make: (api) => { makeRoads(api.scene, course().T, course().parts.map((p) => ({ ...p, skip: near }))); } },
      { kind: 'custom', make: (api) => { const p = P('Subway'), i = p.i0 + p.open[0]; STATION = makeStation(api.scene, { x: course().T.X[i], w: course().W[i], z0: p.openZ[0], z1: p.openZ[1], y0: p.h, y1: p.roofY }); } },
      { kind: 'custom', make: (api) => { makeBlocks(api.scene, [...plan().boxes, { x0: 272, z0: 480, w: 40, d: 16, h: 132, style: 'glass', seed: 9 }]); } },
      { kind: 'custom', make: (api) => { api.MAP.grove = makeGrove(api, GROVE); } },
      { kind: 'custom', make: (api) => { const far = harborLand(api.MAP.backdrop).land, inMap = (x, z) => x >= 0 && z >= 0 && x < WX && z < WZ; return makeWater(api.scene, { x0: -1024, z0: -1024, span: 3072, sun: DUSK.sun, isWater: (x, z) => (inMap(x, z) ? !land(x, z) || ((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2 < 1 : far(x, z) < 0), pools: [[POND.x - POND.rx - 4, POND.z - POND.rz - 4, POND.x + POND.rx + 4, POND.z + POND.rz + 4, 1.06]] }); } },
      { kind: 'custom', make: (api) => makeScreens(api.scene, screens()) },
      { kind: 'steam', pts: steamPts() },
      { kind: 'el', x: 112 - 16 - 10.5, z0: P('Subway').openZ[0] - 56, z1: P('Subway').openZ[1] + 56, ground: true, y: P('Subway').h, every: 7, speed: 64, see: 130, model: 'commuter', paint: 'blue' },
      { kind: 'el', x: EL.x, z0: EL.z0, z1: EL.z1, y: EL.y, every: 10, speed: 80, model: 'commuter', paint: 'orange', sheds: true },
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
  surface(x, z) { return grassy && TR ? surfaceAt(TR.T, grassy, x, z) : 0; },
  get track() { return full(); },
};
