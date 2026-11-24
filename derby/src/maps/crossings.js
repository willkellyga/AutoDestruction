// Empire Loop: New York's second race (Will, 2026-11-24: first "drive through a tunnel or building, drive under a
// bridge", then after a first go round "50% wider", "at least 50% longer", "the subway, statue of liberty", "wider spots
// ... so that you can fight and shoot, then it goes back down to a smaller street", "an alley", "go bigger").
// Three laps with the guns on (modes/race.js), on the same New York as Manhattan Circuit (./manhattan.js), round the
// whole island this time. The sketch Will was shown: /mnt/project-files/race-v2/empire-loop-sketch.png (project files).
//
// The lap, from the line in Times Square heading east under the start gantry: out of the plaza (wide) and down the
// narrower street of signs, a right onto the river avenue and through the River Drive tunnel, left over the Brooklyn
// Bridge through the arches of its granite towers, left again and north the length of Brooklyn under the El (with a
// jump over a dig), left over the Uptown Bridge and straight through the Grand Hall, right up the avenue over the Harlem
// River into the Bronx, left past the ballpark, left again back over the river and down the west side of the park
// (wide: the park's edge is open lawn), right along the street to the Hudson, left down the Hudson drive through the
// subway station with a train coming in beside you, out over the water on a causeway round the Statue of Liberty's
// island (wide), along the Battery's harbor, and a hard left up a narrow alley into Times Square. About 3,300 voxels.
//
// Built like Manhattan Circuit: the course's middle line is a loop of straight runs and rounded corners (COURSE), lots
// are left out of the plan to make room, concrete walls shut the side streets, and the room each side is measured from
// what stands (circuit.js), then held to how wide each part is meant to be (WIDTH). Where a street was too narrow, its
// row of lots on one side is left out and built again set back from the street (FRONT), as shallower New York blocks:
// tenements with fire escapes and water tanks, brownstones with stoops.
import { WX, WZ, M, place, ctx, setSeed, bodies, vehicles, put, set, box, begin, LOC, STREET_X, STREET_Z } from '../../../src/world.js';
import { face, text, textW, lampPost } from '../../../src/kit.js';
import { generateTown, LOTS } from '../../../src/town.js';
import { groundCanvas, GK } from '../../../src/ground.js';
import { PX, PZ, wet, LIB } from '../../../src/nyc.js';
import { tenement, brownstone } from '../../../src/nyc_kit.js';
import { pickSpot } from './common.js';
import { makeTrack, streetLoop, racingLine } from './racetrack.js';
import { removeBody, small, countFrom, wall, dress, gantry, stand, reach, measure, gatesFor, gridFor, paintCourse, grassOf, surfaceAt, radarCourse } from './circuit.js';

// The middle of each run (the streets' own middles unless said)
const TIMES = 738, RIVER = 742, BRIDGE = 860, BKLYN = 927, UPTOWN = 372, BRONX = 150, WEST = 262, HUDSON_ST = 616;
const AVE = 610;                     // the avenue up to the Bronx
const HUDSON = 125;                  // the Hudson drive, once the row of lots along the shore is left out
const LIB_N = 890, LIB_E = 200;      // the causeway: along the north of Liberty's island, then down its east side
const HARBOR = 962;                  // along the Battery, once the row of lots on the water is left out
const ALLEY = 348;                   // up the alley (a row of lots left out, two narrow blocks built either side)
const LINE_X = 520;                  // the start line, in Times Square (the grid stands in the plaza)
const GANTRY_Y = 27;                 // as Manhattan Circuit's: the chase camera looks under the beam
// the course: each corner [x, z, radius of the curve round it]
const COURSE = [
  [LINE_X, TIMES, 0],
  [RIVER, TIMES, 30],      // right, onto the river avenue
  [RIVER, BRIDGE, 24],     // left, onto the Brooklyn Bridge
  [BKLYN, BRIDGE, 40],     // left, up Brooklyn
  [BKLYN, UPTOWN, 40],     // left, over the Uptown Bridge and through the Grand Hall
  [AVE, UPTOWN, 34],       // right, up to the Bronx
  [AVE, BRONX, 34],        // left, past the ballpark
  [WEST, BRONX, 34],       // left, down the west side of the park
  [WEST, HUDSON_ST, 34],   // right, to the Hudson
  [HUDSON, HUDSON_ST, 30], // left, down the Hudson drive
  [HUDSON, LIB_N, 34],     // left, onto the causeway
  [LIB_E, LIB_N, 34],      // right, round the island
  [LIB_E, HARBOR, 30],     // left, along the Battery
  [ALLEY, HARBOR, 24],     // left, up the alley
  [ALLEY, TIMES, 30],      // right, into Times Square
];
const CAP = 30, BEND = 10;          // the most room each side of the middle line on an ordinary street, and the more in a bend
// the wide parts, where there is room to fight: [x0, z0, x1, z1, room each side]
const WIDTH = [
  [318, 664, 556, 762, 60],         // Times Square's plaza
  [196, 384, 330, 604, 55],         // the west side of the park, its lawn open to the avenue
  [88, 862, 246, 1004, 36],         // the causeway round Liberty's island
];
const MARGIN = 6.5;                 // how far inside the room the racing line keeps a car's middle
const GATES = 40;                   // checkpoint gates round the lap (about one every 85 voxels)
// The lots left out of the plan, by column and row of New York's plan (src/nyc.js: PX, PZ)
const GONE = new Set([
  ...[4, 5, 6, 7, 8, 9, 10, 11, 12].map((r) => '15,' + r),   // Brooklyn, between the waterfront street and the river
  '12,4', '12,5',                                            // where the Grand Hall stands across the street
  '11,4', '10,2', '5,2',                                     // inside three corners
  '4,5', '4,6', '4,7', '4,8',                                // across the avenue from the park
  '2,9', '2,10', '2,11', '2,12',                             // the Hudson drive's shore row
  '6,10', '7,10', '8,10', '9,10',                            // Times Square's plaza
  '6,11', '6,12', '6,13', '6,14',                            // the alley, and its end on the harbor
  '5,14', '7,14',                                            // the Battery's row on the harbor
]);
// Rows set back from the street: [column, row, facing (0 north, 1 east, 2 south, 3 west), kit, options]. Each is left
// out of the plan and built again 10 back, so the street in front is about 16 wider (52 instead of 36).
const T_ = (o) => ['tenement', { floors: 5, tank: 1, ...o }], B_ = (o) => ['brownstone', o];
const FRONT = [
  [10, 10, 2, ...T_({ name: 'PIZZA', awn: M.AWN_G, wall: M.BRICK })], [11, 10, 2, ...B_({ floors: [4, 4, 3] })], [12, 10, 2, ...T_({ name: 'DELI', loft: true, wall: M.BRICK2, floors: 6 })],
  [3, 9, 0, ...T_({ name: 'BODEGA', awn: M.AWN_B })], [4, 9, 0, ...B_({ walls: [M.BRICK, M.BROWNST, M.BRICK2] })],
  [6, 2, 0, ...T_({ name: 'HOTDOGS', wall: M.BRICK2 })], [7, 2, 0, ...B_({})], [8, 2, 0, ...T_({ name: 'TIRES', awn: M.AWN_B, floors: 4 })], [9, 2, 0, ...T_({ name: 'DINER', loft: true, floors: 6 })],
  [11, 2, 3, ...T_({ name: 'LAUNDRY', awn: M.AWN_G })], [11, 3, 3, ...B_({ floors: [3, 4, 4] })],
];
FRONT.forEach(([c, r]) => GONE.add(c + ',' + r));
// The walls: [x0, z0, x1, z1, kind ('c' concrete blocks, 't' tyres), dressing]. The dressing faces the course from
// `side` ('f' low z, 'b' high z, 'l' low x, 'r' high x): a sponsor's name, or chevrons ('<' or '>', the way the course
// turns as the drivers see it).
const WALLS = [
  // Times Square: the avenue north of the plaza and south of it, the avenue on east, and the street on west of the corner
  [416, 666, 456, 667, 'c', ['b', 'GRIT COLA']], [416, 757, 456, 758, 'c', ['f', 'ZAPP OIL']],
  [590, 702, 630, 703, 'c', ['b', 'DENT KINGS']], [590, 757, 630, 758, 'c', ['f', 'HOT SPARK']],
  [300, 720, 301, 756, 'c', ['r', 'RUST RACING']],
  // the end of Times Square's street at the river (the Manhattan Bridge is not on the lap), and the river avenue north
  [767, 719, 769, 757, 'c', ['l', '>']], [718, 700, 770, 701, 'c', ['b', 'SCRAP CITY']],
  // the river avenue: the street it meets at the bridge, west, and the avenue on south of it
  [716, 842, 717, 878, 'c', ['r', 'BOLTZ TYRES']], [718, 881, 770, 882, 'c', ['f', '<']],
  // Brooklyn: the bridges that land on the waterfront street, the streets on east, the avenue on south and north
  [877, 476, 879, 512, 'c', ['r', 'ZAPP OIL']], [877, 598, 879, 634, 'c', ['r', 'SCRAP CITY']], [877, 720, 879, 756, 'c', ['r', 'RUST RACING']],
  [972, 476, 973, 512, 'c', ['l', 'DENT KINGS']], [972, 598, 973, 634, 'c', ['l', 'ZAPP OIL']], [972, 720, 973, 756, 'c', ['l', 'GRIT COLA']], [972, 842, 973, 878, 'c', ['l', '<']],
  [930, 880, 972, 881, 'c', ['f', 'DENT KINGS']], [886, 310, 972, 311, 'c', ['b', '<']], [972, 354, 973, 390, 'c', ['l', 'HOT SPARK']],
  // the street over the Uptown Bridge: the river avenue north and south, and past the corner up to the Bronx
  [718, 335, 770, 336, 'c', ['b', 'BOLTZ TYRES']], [718, 392, 770, 393, 'c', ['f', 'GRIT COLA']],
  [586, 354, 587, 390, 'c', ['r', '>']], [590, 392, 630, 393, 'c', ['f', 'RUST RACING']],
  // the Bronx: the avenue on north of the corner, the street on east, the avenue across, the street on west and the
  // avenue north of the second corner
  [590, 129, 630, 130, 'c', ['b', '<']], [633, 132, 634, 168, 'c', ['l', 'DENT KINGS']],
  [416, 129, 456, 130, 'c', ['b', 'ZAPP OIL']], [416, 185, 456, 186, 'c', ['f', 'SCRAP CITY']],
  [239, 132, 240, 168, 'c', ['r', '<']], [242, 129, 282, 130, 'c', ['b', 'HOT SPARK']],
  // down the west side: the streets across, west and east (into the park), the corner to the Hudson
  [239, 354, 240, 390, 'c', ['r', 'BOLTZ TYRES']], [284, 354, 285, 390, 'c', ['l', 'GRIT COLA']],
  [192, 476, 193, 512, 'c', ['r', 'RUST RACING']],
  [284, 598, 285, 634, 'c', ['l', 'DENT KINGS']], [242, 652, 282, 653, 'c', ['f', '>']],
  // the Hudson drive: the street at the Battery on east
  [156, 842, 157, 878, 'c', ['l', 'HOT SPARK']],
  // the Battery: the avenue down to the harbor (shut off the causeway), and past the alley's mouth
  [242, 881, 282, 882, 'c', ['b', 'SCRAP CITY']], [380, 918, 381, 985, 'c', ['l', '<']],
];
// temporary stands: [x, z, length, rows, the way the crowd looks, seat colour, sponsor]
const STANDS = [
  [934, 884, 36, 4, 'n', 'CAR_A', 'GRIT COLA'],    // Brooklyn, outside the turn off the bridge, in the avenue's mouth
  [496, 676, 40, 3, 's', 'CAR_B', 'ZAPP OIL'],     // Times Square, along the back of the plaza
];

// ---- the set pieces -----------------------------------------------------------------------------------------------
// The El: a row of steel columns along the Brooklyn waterfront street on its river side (voxels, so cars hit them),
// the deck and the train over them (hazards.js 'el'). Off the middle line and clear of both corners.
const EL = { x: 903, z0: 440, z1: 800, every: 30, y: 32 };
// The jump in Brooklyn: a steel ramp across the street (north-bound) and the dig past it, under the El
const JUMP = { x0: 918, x1: 968, z0: 672, z1: 686, dig: 26 };
// The Grand Hall: a terminal building standing across the street just off the Uptown Bridge, the street running
// through its hall from the east doors to the west. Its ceiling is far above the chase camera (which rides 23 to 28
// up), and its doors are 31 high in the middle, so the camera follows the car in under the arch.
const HALL = { x0: 677, x1: 716, z0: 322, z1: 422, door: 31, roof: 50 };
// The River Drive tunnel: a deck on the river avenue, from the lots on its west side out to the river, carried on a
// colonnade along the shore and with apartment blocks on it; its underside 31 up for the same reason
const TUNNEL = { x0: 718, x1: 771, z0: 772, z1: 832, y: 31 };
// The subway station on the Hudson drive: a roof over the drive and the track beside it, the platform's edge between
// them (a low wall cars can't cross), steel columns along it, the tiled wall on the city's side, and a tunnel mouth at
// each end the train comes and goes through
const SUB = { x0: 92, x1: 156, z0: 666, z1: 806, y: 31, track: 103, edge: 111, lead: 30 };
// The alley: a row of lots left out between Times Square and the harbor, and a narrow block of walk-ups built along
// each side, 25 apart, with fire escapes, washing hung across and the bins out
const AL = { w0: 323, w1: 335, e0: 361, e1: 373, z0: 758, ze: 772, z1: 914 };
// Times Square: big screens over the back of the plaza, on legs
const SCREENS = [[332, 384, 'AUTO DESTRUCTION'], [400, 452, 'GRIT COLA'], [470, 540, 'NEW YORK GP']];
// steam out of the street now and then: [x, z]
const STEAM = [[ALLEY, 800], [ALLEY, 872], [660, TIMES - 6], [520, BRONX + 4], [200, HUDSON_ST + 6], [WEST + 8, 450], [BKLYN + 14, 560]];
// the chase camera looks through these (main.js stepCamera: it neither closes in nor climbs for them)
const see = () => { bodies[bodies.length - 1].see = true; };

// ---- the course's shape: plain geometry, worked out once ------------------------------------------------------------
const capMost = Math.max(CAP, ...WIDTH.map((w) => w[4]));
let CO = null;
function course() {
  if (!CO) CO = { T: makeTrack({ pts: streetLoop(COURSE), halfW: capMost, smooth: false, WX, WZ, reach: capMost + BEND + 10 }) };
  return CO;
}
// how much room each side the course is meant to have at each sample: CAP, or a wide part's, eased in and out over 50
let CAPS = null;
function caps() {
  if (CAPS) return CAPS;
  const { T } = course(), { N, X, Z, STEP } = T, raw = new Float32Array(N), out = new Float32Array(N), R = Math.round(50 / STEP);
  for (let i = 0; i < N; i++) { raw[i] = CAP; for (const [x0, z0, x1, z1, w] of WIDTH) if (X[i] >= x0 && X[i] <= x1 && Z[i] >= z0 && Z[i] <= z1) raw[i] = Math.max(raw[i], w); }
  for (let i = 0; i < N; i++) { let m = raw[i]; for (let k = -R; k <= R; k++) m = Math.min(m, raw[T.at(i + k)] + Math.abs(k) * STEP * 0.6); out[i] = m; }
  return (CAPS = out);
}
// ---- the rest, once the city and the course are built: the room each side, the racing line, gates and grid ----
let TR = null;
function full() {
  if (TR) return TR;
  const { T } = course(), cap = caps();
  measure(T, capMost, capMost + BEND);   // the room each side (T.WL, T.WR), out to what stands in the city
  const { N, K, WL, WR } = T;
  // then held to how wide each part is meant to be (a little more in the bends)
  for (let i = 0; i < N; i++) {
    let bendy = 0; for (let k = -12; k <= 12; k++) if (Math.abs(K[T.at(i + k)]) > 1 / 90) { bendy = 1; break; }
    const m = cap[i] + (bendy ? BEND : 0); WL[i] = Math.min(WL[i], m); WR[i] = Math.min(WR[i], m);
  }
  const lo = new Float32Array(N), hi = new Float32Array(N);
  for (let i = 0; i < N; i++) { lo[i] = -WR[i] + MARGIN; hi[i] = WL[i] - MARGIN; if (lo[i] > hi[i]) lo[i] = hi[i] = (lo[i] + hi[i]) / 2; }
  const line = racingLine(T, { margin: MARGIN, lo, hi });
  const { gates, gateS } = gatesFor(T, GATES);
  // the grid behind the line, pole on the inside of the first corner (a right)
  const grid = gridFor(T, -1), mid = (WL[0] - WR[0]) / 2;
  const gantry = { x: LINE_X, z: TIMES - mid, y: GANTRY_Y };
  const lights = { x: LINE_X - 1.3, y: gantry.y - 2.4, z: TIMES - mid, yaw: Math.PI / 2, lx: 0, lz: 1 };   // in front of the lights' box, facing the grid
  TR = { T, P: null, line, gates, gateS, grid, gantry, lights, HALF: CAP, PIT_HALF: 0 };
  return TR;
}

// ---- building ----------------------------------------------------------------------------------------------------
// The street furniture and trees on the course come out: whatever is inside the room the course has, counting only
// buildings, walls and stands as its edges (so the park's trees past its lawn stay). The railings along the river
// stay too (they keep cars out of it), and the Harlem River bridges' sides, which are the course's edges there.
function clearCourse() {
  const { T } = course(), F = T.field, cap = caps(), room = [new Float32Array(T.N), new Float32Array(T.N)];
  for (let i = 0; i < T.N; i++) { room[0][i] = reach(T, i, 0, cap[i] + BEND + 6, true); room[1][i] = reach(T, i, 1, cap[i] + BEND + 6, true); }
  for (const b of bodies) {
    if (!small(b) || b.x1 < 0 || b.name === 'Harbor rail' || b.name === 'Harlem River bridge') continue;
    let hit = false;
    for (let z = b.z0; z <= b.z1 && !hit; z++) for (let x = b.x0; x <= b.x1; x++) {
      const c = z * WX + x, i = F.near[c]; if (i < 0) continue;
      const l = F.lat[c]; if (l >= 0 ? l <= room[0][i] + 2 : -l <= room[1][i] + 2) { hit = true; break; }
    }
    if (hit) removeBody(b);
  }
}
// A row set back from its street: the lot's kit drawn 10 further from the street than its lot puts it
function frontage(c, r, f, kit, o, seed) {
  setSeed(seed); ctx.lot = -1;
  const x = PX[c], z = PZ[r];
  place(f === 1 ? x - 10 : f === 3 ? x + 10 : x, f === 0 ? z + 10 : f === 2 ? z - 10 : z, f);
  (kit === 'tenement' ? tenement : brownstone)(LOC, LOC, 3, o);
  place(0, 0, -1);
}
// The causeway's edges out over the water: a granite quay wall at car height a little past the room each side, with
// a lamp now and then. The harbor railings there come out first (the causeway crosses the shore).
function causeway() {
  const [x0, z0, x1, z1] = WIDTH[2];
  for (const b of bodies) if (b && b.name === 'Harbor rail' && !b.dead && b.x1 >= x0 && b.x0 <= x1 && b.z1 >= z0 && b.z0 <= z1) removeBody(b);
  const { T } = course(), cap = caps();
  begin('Causeway quay', 'barrier', false);
  const lamps = [];
  for (let i = 0; i < T.N; i++) {
    if (T.X[i] < x0 || T.X[i] > x1 || T.Z[i] < z0 || T.Z[i] > z1) continue;
    for (const sg of [1, -1]) for (let d = 0; d < 3; d++) {
      const l = sg * (cap[i] + 2 + d), x = Math.round(T.X[i] + T.TZ[i] * l), z = Math.round(T.Z[i] - T.TX[i] * l);
      if (!wet(x, z) || Math.hypot(x - LIB.x, z - LIB.z) < LIB.r + 2) continue;
      for (let y = 0; y < 4; y++) set(x, y, z, y === 3 ? M.TRIM : M.GRANITE);
      if (d === 1 && i % 24 === 0) lamps.push([x, z]);
    }
  }
  for (const [x, z] of lamps) { begin('Causeway lamp', 'prop', false); lampPost(x, z, 16); }
}
// the set pieces that are voxels, laid after the course is cleared (clearCourse takes street furniture out of the way)
function setPieces() {
  // the El's columns: steel, three across, from the street to the deck, a body each
  for (let z = EL.z0; z <= EL.z1; z += EL.every) {
    begin('El column', 'barrier', false);
    for (let y = 0; y < EL.y; y++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) put(EL.x + dx, y, z + dz, y < 2 ? M.CONC : (y & 3) === 0 ? M.METAL : M.STEEL);
  }
  grandHall(); tunnel(); station(); alley(); plaza();
}
// The Grand Hall: granite walls, a tall arched window down each side, a vaulted roof, a row of columns either side of
// the road inside, a clock over the east doors with the hall's name under it, and a tower on top.
function grandHall() {
  const { x0, x1, z0, z1, door, roof } = HALL, zc = UPTOWN, half = 17;
  const arch = (z) => { const u = (z - zc) / half; return Math.abs(u) > 1 ? -1 : Math.round(door - 6 * u * u); };   // the doorway's top at z
  begin('Grand Hall', 'landmark'); see();
  for (let y = 0; y <= roof; y++) {
    for (const x of [x0, x1]) for (let z = z0; z <= z1; z++) { const top = arch(z); if (y <= top) continue; set(x, y, z, y % 8 === 7 ? M.TRIM : M.GRANITE); }
    for (const z of [z0, z1]) for (let x = x0; x <= x1; x++) { const win = y >= 8 && y <= roof - 8 && ((x - x0) % 13 > 3) && ((x - x0) % 13 < 11); set(x, y, z, win ? M.GLASS : y % 8 === 7 ? M.TRIM : M.GRANITE); }
  }
  for (let z = z0; z <= z1; z++) { const u = (z - (z0 + z1) / 2) / ((z1 - z0) / 2), y = Math.round(roof + 6 * (1 - u * u)); for (let x = x0; x <= x1; x++) { set(x, y, z, Math.abs(z - (z0 + z1) / 2) < 2 ? M.LIT_W : M.ROOF_D); set(x, y - 1, z, M.SLAB); } }
  for (const z of [zc - half - 3, zc + half + 2]) for (let x = x0 + 5; x <= x1 - 5; x += 8) box(x, 0, z, x + 1, roof - 1, z + 1, M.MARBLE);
  begin('Grand Hall tower', 'landmark'); see();
  const tx0 = (x0 + x1 >> 1) - 9, tx1 = tx0 + 18, tz0 = zc - 9, tz1 = zc + 9;
  for (let y = roof + 7; y <= roof + 44; y++) for (let x = tx0; x <= tx1; x++) for (let z = tz0; z <= tz1; z++) {
    if (x > tx0 && x < tx1 && z > tz0 && z < tz1) continue;
    const win = (y - roof) % 6 > 2 && (x + z) % 4 !== 0; set(x, y, z, win ? M.GLASS : M.LIME);
  }
  for (let k = 0; k <= 9; k++) box(tx0 + k, roof + 45 + k, tz0 + k, tx1 - k, roof + 45 + k, tz1 - k, M.COPPER2);
  begin('Grand Hall clock', 'sign', false); see();
  const cy = door + 11, F = face('r', x1, z0, x1, z1);
  for (let dz = -7; dz <= 7; dz++) for (let dy = -7; dy <= 7; dy++) { const r = Math.hypot(dz, dy); if (r <= 7.4) set(x1 + 1, cy + dy, zc + dz, r > 6.2 ? M.BRASS : M.TRIM); }
  for (let k = 0; k <= 5; k++) set(x1 + 2, cy + k, zc, M.DARK);
  for (let k = 0; k <= 3; k++) set(x1 + 2, cy, zc - k, M.DARK);
  const name = 'GRAND HALL'; text(F, name, (F.W - textW(name)) >> 1, door + 1, 1, M.LIT_Y);
}
// The River Drive tunnel: a slab over the river avenue on a colonnade along the shore, the lots' own buildings for
// its west wall, lamps along its underside, and a row of apartment blocks standing on it.
function tunnel() {
  const { x0, x1, z0, z1, y } = TUNNEL;
  begin('River Drive deck', 'landmark'); see();
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { set(x, y, z, M.CONC); set(x, y + 1, z, M.CONC); set(x, y + 2, z, x === x1 || z === z0 || z === z1 ? M.TRIM : M.SLAB); }
  for (let z = z0; z <= z1; z += 6) for (let x = x0 + 4; x < x1; x += 12) set(x, y - 1, z, M.LIT_Y);
  for (let z = z0; z <= z1; z += 8) box(x1 - 2, 0, z, x1, y - 1, z + 1, M.CONC);
  for (const [a, b, h, m] of [[z0, z0 + 18, 34, M.BRICK], [z0 + 21, z0 + 39, 42, M.BROWNST], [z0 + 42, z1, 30, M.BRICK2]]) {
    begin('River Drive apartments', 'building'); see();
    for (let yy = y + 3; yy <= y + 3 + h; yy++) for (let z = a; z <= b; z++) for (let x = x0 + 2; x <= x1 - 2; x++) {
      const edge = x === x0 + 2 || x === x1 - 2 || z === a || z === b; if (!edge && yy < y + 3 + h) continue;
      const row = (yy - y - 3) % 5, col = (x + z) % 4, win = edge && row >= 2 && row <= 3 && col !== 0 && yy < y + 3 + h;
      set(x, yy, z, yy === y + 3 + h ? M.ROOF_D : win ? ((x * 7 + z * 3 + yy) % 5 === 0 ? M.LIT_Y : M.GLASS) : m);
    }
  }
}
// The subway station on the Hudson drive
function station() {
  const { x0, x1, z0, z1, y, track, edge } = SUB;
  // the roof: a concrete slab over the drive and the track, lit strips under it
  begin('Station roof', 'landmark'); see();
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { set(x, y, z, M.CONC); set(x, y + 1, z, z === z0 || z === z1 || x === x0 || x === x1 ? M.TRIM : M.SLAB); }
  for (let z = z0 + 4; z <= z1 - 4; z += 8) for (let x = edge + 6; x < x1 - 2; x += 14) box(x, y - 1, z, x + 5, y - 1, z, M.LIT_W);
  // the platform's edge: a low concrete wall, yellow along its top, and a steel column on it every 13
  // (it runs on north of the roof to a fence across the track, so the drive narrows before the station, not at it)
  begin('Platform edge', 'barrier', false); see();
  for (let z = z0 - SUB.lead; z <= z1; z++) for (let x = edge - 1; x <= edge + 1; x++) for (let yy = 0; yy <= 2; yy++) set(x, yy, z, yy === 2 ? M.STAIN_Y : M.CONC);
  for (let z = z0 + 6; z <= z1 - 6; z += 13) box(edge - 1, 3, z - 1, edge + 1, y - 1, z + 1, (z & 1) ? M.STEEL : M.STEEL);
  // the wall on the river side of the track, and the tiled wall on the city's side: white tile, a band of green with a
  // brass line, and the station's name in the band every so often
  begin('Station wall', 'barrier', false); see();
  for (let z = z0; z <= z1; z++) for (let yy = 0; yy < y; yy++) set(x0, yy, z, yy % 6 === 5 ? M.TRIM : M.CONC);
  begin('Station tiles', 'barrier', false); see();
  const F = face('l', x1, z0, x1, z1);
  for (let z = z0; z <= z1; z++) for (let yy = 0; yy < y; yy++) { set(x1, yy, z, yy >= 9 && yy <= 15 ? M.DOOR_G : yy === 8 || yy === 16 ? M.BRASS : ((z + yy) & 1) ? M.TRIM : M.MARBLE); set(x1 + 1, yy, z, M.CONC); }
  for (let u = 8; u + textW('HUDSON ST') < F.W - 4; u += 52) text(F, 'HUDSON ST', u, 10, 0, M.TRIM);
  // the tunnel mouths at each end, over the track: a brick wall from the river wall to the platform with a dark arch
  for (const z of [z0, z1]) {
    begin('Tunnel mouth', 'barrier', false);
    for (let x = x0; x <= edge - 2; x++) for (let yy = 0; yy < y; yy++) {
      const u = (x - track) / 6.5, top = Math.abs(u) < 1 ? Math.round(12 - 3 * u * u) : -1;
      if (yy <= top) { set(x, yy, z + (z === z0 ? 1 : -1), M.DARK); continue; }
      set(x, yy, z, yy % 5 === 4 ? M.TRIM : M.BRICK);
    }
  }
  begin('Track fence', 'barrier', false); see();
  for (let x = x0; x <= edge - 2; x++) for (let yy = 0; yy <= 4; yy++) set(x, yy, z0 - SUB.lead, yy === 4 || !(x % 3) ? M.DARK : M.IRON);
  // a sign over each end of the drive, for the drivers coming in: SUBWAY on a green board
  begin('Station sign', 'sign', false); see();
  const Fs = face('f', edge + 2, z0, x1 - 1, z0), w = 'SUBWAY';
  for (let u = 0; u < Fs.W; u++) for (let yy = y - 6; yy < y; yy++) Fs.p(u, yy, 0, M.DOOR_G);
  text(Fs, w, (Fs.W - textW(w)) >> 1, y - 5, 1, M.TRIM);
}
// The alley: two narrow blocks of walk-ups, each in a few buildings of their own height and brick, with fire escapes
// down the alley side, the bins out, and washing hung across between them
function alley() {
  const { w0, w1, e0, e1, z0, ze, z1 } = AL;
  const block = (xa, xb, za, zb, side, seed) => {
    let z = za, k = seed;
    while (z < zb) {
      const len = Math.min(zb - z, 26 + (k * 7) % 12), h = 30 + (k * 13) % 18, m = [M.BRICK, M.BRICK2, M.BROWNST, M.BRICK][k % 4];
      begin('Alley walk-up', 'barrier', false);
      for (let yy = 0; yy <= h; yy++) for (let zz = z; zz < z + len; zz++) for (let x = xa; x <= xb; x++) {
        const out = x === xa || x === xb || zz === z || zz === z + len - 1; if (!out && yy < h) continue;
        const inner = side === 'r' ? x === xb : x === xa, win = inner && yy > 4 && yy % 8 >= 3 && yy % 8 <= 5 && (zz - z) % 6 >= 2 && (zz - z) % 6 <= 3 && yy < h - 2;
        set(x, yy, zz, yy === h ? M.ROOF_D : win ? (((zz + yy) * 5) % 7 === 0 ? M.LIT_Y : M.GLASS) : yy === h - 1 ? M.TRIM : m);
      }
      // the fire escape: a landing every floor from the second up, rails, and a ladder between them
      const xo = side === 'r' ? xb + 1 : xa - 1, dx = side === 'r' ? 1 : -1, ea = z + 3, eb = z + Math.min(len - 4, 14);
      for (let yy = 11; yy < h - 4; yy += 8) {
        for (let zz = ea; zz <= eb; zz++) { set(xo, yy, zz, M.DARK); set(xo + dx, yy, zz, M.DARK); set(xo + dx * 2, yy, zz, M.DARK); set(xo + dx * 2, yy + 3, zz, M.DARK); if ((zz & 1) === 0) for (let r = 1; r <= 2; r++) set(xo + dx * 2, yy + r, zz, M.DARK); }
        for (let r = 1; r < 8; r++) set(xo + dx, yy + r, ea + 1 + (r >> 1), M.DARK);
      }
      z += len; k++;
    }
  };
  block(w0, w1, z0, z1, 'r', 1);
  block(e0, e1, ze, z1, 'l', 4);
  // the bins, against the walls (props: a car sends them flying)
  for (const [x, z] of [[w1 + 1, 812], [e0 - 4, 866]]) { begin('Dumpster', 'prop', false); box(x, 0, z, x + 3, 4, z + 7, M.DOOR_G); box(x, 5, z, x + 3, 5, z + 7, M.DARK); }
  // the washing: lines across the alley high over the cars and the camera, with sheets and shirts on them
  begin('Washing lines', 'prop', false); see();
  for (const z of [790, 826, 858, 896]) for (let x = w1 + 1; x < e0; x++) {
    set(x, 40, z, M.DARK);
    if ((x * 3 + z) % 5 < 3 && x > w1 + 2 && x < e0 - 2) { const m = [M.AWN_W, M.AWN_R, M.AWN_B, M.PL_Y][(x + z) % 4]; for (let d = 1; d <= 3 + (x & 1); d++) set(x, 40 - d, z, m); }
  }
  // a red sign over a bar door halfway along
  begin('Bar sign', 'sign', false); see();
  const F = face('r', w0, 838, w1, 852);
  for (let u = 0; u < F.W; u++) for (let yy = 14; yy <= 20; yy++) F.p(u, yy, 2, M.DARK);
  text(F, 'BAR', (F.W - textW('BAR')) >> 1, 15, 3, M.LIT_R);
}
// Times Square's plaza: big screens on legs over the back of it, and the steps down to the subway either side
function plaza() {
  for (const [a, b, word] of SCREENS) {
    begin('Times screen legs', 'barrier', false);
    for (const x of [a + 3, b - 3]) box(x - 1, 0, 670, x + 1, 30, 672, M.STEEL);
    begin('Times screen', 'sign', false); see();
    const F = face('b', a, 671, b, 671);
    for (let u = 0; u < F.W; u++) for (let yy = 31; yy <= 50; yy++) { F.p(u, yy, 0, u === 0 || u === F.W - 1 || yy === 31 || yy === 50 ? M.DARK : (u + yy) % 9 === 0 ? M.LIT_B : M.LIT_P); F.p(u, yy, -1, M.DARK); }
    text(F, word.length * 6 > F.W - 4 ? word.split(' ')[0] : word, Math.max(2, (F.W - textW(word.length * 6 > F.W - 4 ? word.split(' ')[0] : word)) >> 1), 38, 1, M.LIT_W);
  }
  // the subway's steps: green railings round a stair going down, and a lamp on a post each side
  for (const [x, z] of [[392, 674], [556, 676]]) {
    begin('Subway entrance', 'prop', false);
    for (let k = 0; k < 10; k++) { set(x + k, 3, z, M.DOOR_G); set(x + k, 3, z + 4, M.DOOR_G); if (!(k % 3)) { box(x + k, 0, z, x + k, 2, z, M.DOOR_G); box(x + k, 0, z + 4, x + k, 2, z + 4, M.DOOR_G); } }
    for (let d = 0; d <= 4; d++) set(x, 3, z + d, M.DOOR_G);
    for (const dz of [0, 4]) { box(x + 10, 0, z + dz, x + 10, 7, z + dz, M.DOOR_G); set(x + 10, 8, z + dz, M.LIT_G); }
  }
}
function build() {
  // the lots along the course are left out of the plan before the city is built (each keeps its own seed, so the rest
  // come out as they always do)
  LOTS.forEach((L, i) => { if (L.sid === undefined) L.sid = i; });
  for (let i = LOTS.length - 1; i >= 0; i--) if (GONE.has(LOTS[i].c + ',' + LOTS[i].r)) LOTS.splice(i, 1);
  generateTown();
  // (and the jetty, tug and barge in the bay, where the causeway goes)
  const [bx0, bz0, bx1, bz1] = WIDTH[2], inBay = (v) => v.x > bx0 - 20 && v.x < bx1 + 10 && v.z > bz0 && v.z < bz1;
  const keep = vehicles.filter((v) => v.kind !== 'car' && v.kind !== 'bus' && v.kind !== 'school' && !inBay(v));
  vehicles.length = 0; vehicles.push(...keep);
  // the rows set back from their streets
  FRONT.forEach(([c, r, f, kit, o], i) => frontage(c, r, f, kit, o, 7700 + i * 31));
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1; setSeed(5115);
  const first = bodies.length;
  for (const [x0, z0, x1, z1, kind, dressing] of WALLS) { wall(x0, z0, x1, z1, kind); if (dressing) dress(x0, z0, x1, z1, dressing); }
  for (const [x, z, len, rows, look, seat, sponsor] of STANDS) stand(x, z, len, rows, look, M[seat], sponsor);
  causeway();
  clearCourse();
  setPieces();
  // the gantry spans the course at the line, edge to edge, its feet just inside the kerbs
  const T = course().T, c0 = caps()[0], wl = Math.min(c0, reach(T, 0, 0, c0 + 6)), wr = Math.min(c0, reach(T, 0, 1, c0 + 6));
  gantry(LINE_X, Math.round(TIMES - wl) + 2, Math.round(TIMES + wr) - 2, ['EMPIRE LOOP', 'NEW YORK GP'], -1, GANTRY_Y);
  countFrom(first);
}

// ---- the painted ground: New York's, with the course laid over it ----------------------------------------------
let grassy = null;   // the grass, a voxel at a time (for surface())
// New York's ground is painted at four pixels a voxel (4096 square). Phones get it at half that (main.js's test).
const PHONE = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
function paint() {
  const { T, grid, line } = full(), cv = groundCanvas(), g = cv.getContext('2d');
  // the causeway's paving, under the course, out to its quay walls
  g.fillStyle = '#8f8a80';
  const cap = caps(), [x0, z0, x1, z1] = WIDTH[2];
  for (let i = 0; i < T.N; i += 2) {
    if (T.X[i] < x0 || T.X[i] > x1 || T.Z[i] < z0 || T.Z[i] > z1) continue;
    const r = cap[i] + 5; g.beginPath(); g.arc(T.X[i] * GK, T.Z[i] * GK, r * GK, 0, Math.PI * 2); g.fill();
  }
  paintCourse(g, T, grid, 62, line);
  // the jump's dig: dug earth, steel plates along each edge
  g.fillStyle = '#4a3c30'; g.fillRect(JUMP.x0 * GK, (JUMP.z0 - JUMP.dig) * GK, (JUMP.x1 - JUMP.x0) * GK, JUMP.dig * GK);
  g.fillStyle = 'rgba(30,22,16,0.6)'; for (let k = 0; k < 40; k++) g.fillRect((JUMP.x0 + ((k * 37) % (JUMP.x1 - JUMP.x0))) * GK, (JUMP.z0 - JUMP.dig + 3 + ((k * 11) % (JUMP.dig - 6))) * GK, 5 * GK, 2 * GK);
  g.fillStyle = '#7a7f86'; for (const z of [JUMP.z0 - 2, JUMP.z0 - JUMP.dig]) g.fillRect(JUMP.x0 * GK, z * GK, (JUMP.x1 - JUMP.x0) * GK, 2 * GK);
  // the subway's track bed: gravel between the river wall and the platform
  g.fillStyle = '#3c3a38'; g.fillRect((SUB.x0 + 1) * GK, (SUB.z0 - SUB.lead) * GK, (SUB.edge - 2 - SUB.x0) * GK, (SUB.z1 - SUB.z0 + SUB.lead) * GK);
  grassy = grassOf(cv, true, T);
  if (!PHONE) return cv;
  const half = document.createElement('canvas'); half.width = cv.width >> 1; half.height = cv.height >> 1;
  const h = half.getContext('2d'); h.imageSmoothingQuality = 'high'; h.drawImage(cv, 0, 0, half.width, half.height);
  cv.width = cv.height = 1;   // let the full-size picture go now rather than when it is collected
  return half;
}

// The radar shows the whole island (the course goes round all of it), drawn once onto a canvas of its own.
const RADAR_BOX = [60, 100, 1010, 1010];
let radarCv = null, radarKey = '';
function radar(R, s, ox, oy, w, h) {
  const key = [s, ox, oy, w, h].join();
  if (!radarCv || key !== radarKey) {
    radarKey = key; radarCv = radarCv || document.createElement('canvas'); radarCv.width = R.canvas.width; radarCv.height = R.canvas.height;
    radarCourse(radarCv, full().T, s, ox, oy, STREET_X, STREET_Z, w, h);
  }
  R.drawImage(radarCv, 0, 0);
}

export default {
  id: 'crossings', name: 'Empire Loop', mode: 'race', laps: 3, hidden: true,
  blurb: 'Three laps round all of New York: the tunnel, the bridges, under the El, the Bronx, the subway, round Liberty and up the alley. Guns on.',
  loading: ['Closing the streets', 'Building New York and opening the bridges'],
  outer: 0x4e8fa6,   // the water round the city
  // raced at the end of the day, the sun low in the south-east (looks/dusk.js)
  look: { kind: 'dusk' },
  // The city past the edge of the map (../backdrops/harbor.js), as Manhattan Circuit's
  backdrop: {
    kind: 'harbor', seed: 7311,
    world: [0, 0, WX, WZ],
    view: { x: 540, z: 560 },                // the middle of the course
    course: [92, 129, 973, 1004],            // the box the course runs in: heights are set by how far from it a tower is
    reach: 2300,
    water: 0x4e8fa6,
    streets: { x: STREET_X, w: 36, zN: [150, 122], zS: [860, 122], xE: [952, 174], xW: [262, 174] },
    shores: { harlem: [214, 262], bronx: -34, jersey: -240, brooklyn: { x: 880, slope: 0.19, south: 1540, fall: 0.45 }, island: { z: 1470, x: 560 }, sound: { x: 1320, z0: 140, z1: 540 } },
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
    ships: [{ x: 380, z: 1180, len: 150, yaw: 0.3, hull: 0x3a2a26 }, { x: -110, z: 640, len: 120, yaw: 1.45, hull: 0x26313a }],
    traffic: { east: [150, 372, 494, 616, 738, 860, 982], north: STREET_X, length: 900, bank: [-700, 1400] },
    skyline: [0.4, 0.75, 1.0, 0.85, 0.8, 0.75, 0.95, 0.6, 0.4],
    heli: { ahead: 290, y: 86, size: 1.5, sway: 18 },
  },
  // on a phone or tablet, the city is drawn in full a little less far out than on the other maps (quality.js)
  lodK: 0.4,
  // where the chase camera has a roof over it, and must stay under it (main.js stepCamera)
  roofs: [
    { x0: HALL.x0, z0: HALL.z0, x1: HALL.x1, z1: HALL.z1, y: HALL.roof - 1 },
    { x0: TUNNEL.x0, z0: TUNNEL.z0, x1: TUNNEL.x1, z1: TUNNEL.z1, y: TUNNEL.y },
    { x0: SUB.x0, z0: SUB.z0, x1: SUB.x1, z1: SUB.z1, y: SUB.y },
  ],
  // the set pieces that move or aren't voxels (hazards.js)
  hazards: [
    { kind: 'el', x: EL.x, z0: 300, z1: 1010, y: EL.y, every: 16 },
    { kind: 'el', ground: true, x: SUB.track, z0: SUB.z0 + 2, z1: SUB.z1 - 2, every: 12 },
    { kind: 'ramp', x0: JUMP.x0, z0: JUMP.z0, x1: JUMP.x1, z1: JUMP.z1, yaw: Math.PI },
    { kind: 'steam', pts: STEAM },
    { kind: 'covered', x0: HALL.x0, z0: HALL.z0, x1: HALL.x1, z1: HALL.z1, dim: 0.62 },
    { kind: 'covered', x0: TUNNEL.x0, z0: TUNNEL.z0, x1: TUNNEL.x1, z1: TUNNEL.z1, dim: 0.5 },
    { kind: 'covered', x0: SUB.x0, z0: SUB.z0, x1: SUB.x1, z1: SUB.z1, dim: 0.55 },
  ],
  build,
  ground: paint,
  get spawn() { return full().grid[4]; },   // the player starts fifth
  spawnPoint(player, taken) {
    const { T, gates } = full();
    return pickSpot(gates.map((i) => ({ x: T.X[i], z: T.Z[i], yaw: Math.atan2(T.TX[i], T.TZ[i]) })), player, taken);
  },
  waypoint(c, tx, tz, out) {
    const { T } = full(), p = T.project(c.x, c.z, c._rw ?? -1), j = T.at(p.i + Math.round(36 / T.STEP));
    c._rw = p.i; out.x = T.X[j]; out.z = T.Z[j]; return out;
  },
  radar,
  radarBox: RADAR_BOX,
  groundDetail: { hard: true, deFleck: true, fade: 20 },
  rutBox: [RADAR_BOX[0] - 30, RADAR_BOX[1] - 30, RADAR_BOX[2] + 10, RADAR_BOX[3] + 10],
  surface(x, z) { return grassy && TR ? surfaceAt(TR.T, grassy, x, z) : 0; },
  get track() { return full(); },
};
