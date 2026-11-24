// Five Crossings: New York's second race (Will, 2026-11-24: "drive through a tunnel or building, drive under a bridge").
// Four laps with the guns on (modes/race.js), on the same New York as Manhattan Circuit (./manhattan.js), but the lap
// crosses the East River twice and has something to drive through, under or over on every stretch. The plan, with a
// sketch and the games and circuits the ideas come from: the "New York race v2: Five Crossings" doc in the project.
//
// The lap, from the line in Times Square heading east under the start gantry: the billboard canyon, a fast right onto
// the river avenue and down it (the River Drive tunnel), left onto the Brooklyn Bridge and across the river through the
// arches of both its granite towers, left into Brooklyn and north up the waterfront street under the El, left again
// back across the river over the Queensboro truss bridge, west the whole width of the island along its one street that
// crosses the park (through the Grand Hall on the east side, then the park's sunken transverse under its footbridges),
// left down the west side over the ramp jump, and a tight left at the shortcut building back into Times Square. About
// 2,000 voxels a lap.
//
// Built like Manhattan Circuit: the course's middle line is a loop of straight runs and rounded corners (COURSE), some
// lots are left out of the plan to widen it, concrete walls shut the cross streets and the bridges the lap doesn't
// take, and the room each side is measured from what stands (circuit.js). The set pieces are in ../setpieces.js.
import { WX, WZ, M, place, ctx, setSeed, bodies, vehicles, put, set, box, begin, STREET_X, STREET_Z } from '../../../src/world.js';
import { face, text, textW } from '../../../src/kit.js';
import { generateTown, LOTS } from '../../../src/town.js';
import { groundCanvas, GK } from '../../../src/ground.js';
import { pickSpot } from './common.js';
import { makeTrack, streetLoop, racingLine } from './racetrack.js';
import { removeBody, small, countFrom, wall, dress, gantry, stand, reach, measure, gatesFor, gridFor, paintCourse, grassOf, surfaceAt, radarCourse } from './circuit.js';

// The middle of each run: the street through Times Square (z), the river avenue (x, half way from the lots to the
// railing on the shore), the Brooklyn Bridge (z), the Brooklyn waterfront street once the row of lots on its river side
// is left out (x), the street across the island and the park (z), and the west side avenue once the row on its far side
// is left out (x)
const TIMES = 738, RIVER = 742, BRIDGE = 860, BKLYN = 927, CROSS = 494, WEST = 239;
const LINE_X = 520;   // the start line, just east of Times Square (the grid stands in it)
const GANTRY_Y = 27;  // as Manhattan Circuit's: the chase camera looks under the beam
// the course: each corner [x, z, radius of the curve round it]
const COURSE = [
  [LINE_X, TIMES, 0],
  [RIVER, TIMES, 30],     // right, onto the river avenue
  [RIVER, BRIDGE, 24],    // left, onto the Brooklyn Bridge
  [BKLYN, BRIDGE, 40],    // left, up Brooklyn
  [BKLYN, CROSS, 40],     // left, back over the Queensboro truss
  [WEST, CROSS, 40],      // left, down the west side
  [WEST, TIMES, 30],      // left, round the shortcut building into Times Square
];
const CAP = 46, CAP_BEND = 56;      // the most room counted each side of the middle line: on a straight, and in a bend
const MARGIN = 6.5;                 // how far inside the room the racing line keeps a car's middle
const GATES = 24;                   // checkpoint gates round the lap (about one every 85 voxels)
// The lots left unbuilt, by column and row of New York's plan (src/nyc.js: PX, PZ): Brooklyn's river-side row along the
// waterfront street, and the far row of the west side avenue. Times Square, the bridges and the street across the
// park keep their own width.
const GONE = new Set([
  ...[7, 8, 9, 10, 11, 12].map((r) => '15,' + r),            // Brooklyn, between the waterfront street and the river
  ...[7, 8, 9, 10].map((r) => '4,' + r),                     // the west side, across the avenue from the park
  '9,6', '9,7',                                              // where the Grand Hall stands across the street
  '5,10',                                                    // where the shortcut building stands
]);
// The walls: [x0, z0, x1, z1, kind ('c' concrete blocks, 't' tyres), dressing]. The dressing faces the course from
// `side` ('f' low z, 'b' high z, 'l' low x, 'r' high x): a sponsor's name, or chevrons ('<' or '>').
const WALLS = [
  // Times Square's cross avenues, north and south
  [416, 718, 456, 719, 'c', ['b', 'GRIT COLA']], [416, 757, 456, 758, 'c', ['f', 'ZAPP OIL']],
  [590, 718, 630, 719, 'c', ['b', 'DENT KINGS']], [590, 757, 630, 758, 'c', ['f', 'HOT SPARK']],
  // the end of Times Square's street at the river: the Manhattan Bridge is not on the lap
  [767, 719, 769, 757, 'c', ['l', '>']],
  // the river avenue: the street it meets at the bridge, west, and the avenue on south of it
  [716, 842, 717, 878, 'c', ['r', 'BOLTZ TYRES']], [718, 881, 770, 882, 'c', ['f', '<']],
  // Brooklyn: the bridges that land on the waterfront street, the streets on east, the avenue on north and south
  [877, 598, 879, 634, 'c', ['r', 'SCRAP CITY']], [877, 720, 879, 756, 'c', ['r', 'RUST RACING']],
  [972, 476, 973, 512, 'c', ['l', '<']], [972, 598, 973, 634, 'c', ['l', 'ZAPP OIL']], [972, 720, 973, 756, 'c', ['l', 'GRIT COLA']], [972, 842, 973, 878, 'c', ['l', '<']],
  [930, 474, 972, 475, 'c', ['b', 'HOT SPARK']], [930, 880, 972, 881, 'c', ['f', 'DENT KINGS']],
  // the street across the island: the avenues it crosses, north and south
  [718, 474, 770, 475, 'c', ['b', 'BOLTZ TYRES']], [718, 513, 770, 514, 'c', ['f', 'SCRAP CITY']],
  [590, 474, 630, 475, 'c', ['b', 'RUST RACING']], [590, 513, 630, 514, 'c', ['f', 'GRIT COLA']],
  [418, 474, 456, 475, 'c', ['b', 'ZAPP OIL']], [418, 513, 456, 514, 'c', ['f', 'DENT KINGS']],
  // the west side: the street on west of the corner, the avenue on north, the cross street, the avenue on south and
  // Times Square's street on west
  [193, 476, 194, 512, 'c', ['r', '<']], [195, 474, 282, 475, 'c', ['b', 'HOT SPARK']],
  [193, 598, 194, 634, 'c', ['r', 'BOLTZ TYRES']], [284, 598, 285, 634, 'c', ['l', 'SCRAP CITY']],
  [195, 757, 282, 758, 'c', ['f', 'RUST RACING']], [193, 720, 194, 756, 'c', ['r', '<']],
];
// temporary stands: [x, z, length, rows, the way the crowd looks, seat colour, sponsor]
const STANDS = [
  [934, 884, 36, 4, 'n', 'CAR_A', 'GRIT COLA'],    // Brooklyn, outside the turn off the bridge, in the avenue's mouth
  [934, 472, 36, 4, 's', 'CAR_B', 'ZAPP OIL'],     // Brooklyn, outside the turn back onto the river
  [200, 472, 36, 4, 's', 'SIGN', 'DENT KINGS'],    // outside the turn down the west side
];

// ---- the set pieces (the plan's numbers in brackets) -----------------------------------------------------------------
// [4] the El: a row of columns along the Brooklyn waterfront street on its river side (voxels, so cars hit them and
// the drivers' room is measured to them), the deck and the train over them (hazards.js 'el', meshes, above the chase
// camera). The row stands off the course's middle line, clear of both corners: on the line, every driver's room shrank
// to nothing at each column and the whole field piled into the first one. The lane between the columns and the river
// railing is still open to anyone who wants to thread it.
const EL = { x: 903, z0: 548, z1: 788, every: 30, y: 32 };
// [7] the park transverse: stone walls either side of the street across the park, and two stone footbridges over it
const PARK_X = [283, 417], FOOT_X = [318, 378];
// [8] the ramp jump on the west side: the ramp, and the trench dug across the avenue past it
const JUMP = { x0: 197, x1: 281, z0: 584, z1: 598, dig: 26 };
// [6] the Grand Hall: a terminal building standing across the street on the east side, the street running through its
// hall from the east doors to the west. Its ceiling is far above the chase camera (which rides 23 to 28 up), and its
// doors are 31 high in the middle, so the camera follows the car in under the arch rather than being caught on it.
const HALL = { x0: 503, x1: 543, z0: 442, z1: 546, door: 31, roof: 50 };
// [2] the River Drive tunnel: a deck on the river avenue, from the lots on its west side out to the river, carried on a
// colonnade along the shore and with apartment blocks on it; its underside 31 up for the same reason
const TUNNEL = { x0: 718, x1: 771, z0: 772, z1: 832, y: 31 };
// [9] the shortcut building: an old block in scaffolding on the inside of the last corner, thin walls a car goes through
const SHORT = { x0: 284, x1: 322, z0: 681, z1: 719, h: 22 };
// the chase camera looks through these (main.js stepCamera: it neither closes in nor climbs for them)
const see = () => { bodies[bodies.length - 1].see = true; };

// ---- the course's shape: plain geometry, worked out once ------------------------------------------------------------
let CO = null;
function course() {
  if (!CO) CO = { T: makeTrack({ pts: streetLoop(COURSE), halfW: CAP, smooth: false, WX, WZ, reach: CAP_BEND + 10 }) };
  return CO;
}
// ---- the rest, once the city and the course are built: the room each side, the racing line, gates and grid ----
let TR = null;
function full() {
  if (TR) return TR;
  const { T } = course();
  measure(T, CAP, CAP_BEND);   // the room each side (T.WL, T.WR), out to what stands in the city
  const { N, WL, WR } = T;
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
// buildings, walls and stands as its edges (so the park's trees behind its wall stay). The railings along the river
// stay too: they keep cars out of it.
function clearCourse() {
  const { T } = course(), F = T.field, room = [new Float32Array(T.N), new Float32Array(T.N)];
  for (let i = 0; i < T.N; i++) { room[0][i] = reach(T, i, 0, CAP_BEND + 6, true); room[1][i] = reach(T, i, 1, CAP_BEND + 6, true); }
  for (const b of bodies) {
    if (!small(b) || b.x1 < 0 || b.name === 'Harbor rail') continue;
    let hit = false;
    for (let z = b.z0; z <= b.z1 && !hit; z++) for (let x = b.x0; x <= b.x1; x++) {
      const c = z * WX + x, i = F.near[c]; if (i < 0) continue;
      const l = F.lat[c]; if (l >= 0 ? l <= room[0][i] + 2 : -l <= room[1][i] + 2) { hit = true; break; }
    }
    if (hit) removeBody(b);
  }
}
// the set pieces that are voxels, laid after the course is cleared (clearCourse takes street furniture out of the way,
// and the footbridges count as that)
function setPieces() {
  // the El's columns: steel, three across, from the street to the deck, a body each
  for (let z = EL.z0; z <= EL.z1; z += EL.every) {
    begin('El column', 'barrier', false);
    for (let y = 0; y < EL.y; y++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) put(EL.x + dx, y, z + dz, y < 2 ? M.CONC : (y & 3) === 0 ? M.METAL : M.STEEL);
  }
  // the transverse's walls: granite, five high with a coping, a body every 32
  for (const z of [CROSS - 19, CROSS + 19]) for (let x0 = PARK_X[0]; x0 <= PARK_X[1]; x0 += 32) {
    begin('Park wall', 'barrier', false);
    for (let x = x0; x <= Math.min(PARK_X[1], x0 + 31); x++) for (let y = 0; y < 6; y++) put(x, y, z, y === 5 ? M.TRIM : ((x >> 1) + y) % 5 === 0 ? M.STONE : M.GRANITE);
  }
  // the footbridges: a stone arch eight thick from wall to wall, its underside 10 up in the middle and down to the
  // walls' top at each end, with a parapet each side. Props: the chase camera looks past them, and a car can't reach them.
  for (const xc of FOOT_X) {
    begin('Park footbridge', 'prop', false);
    for (let z = CROSS - 19; z <= CROSS + 19; z++) {
      const u = (z - CROSS) / 19, under = Math.round(10 - 4 * u * u);
      for (let x = xc - 4; x <= xc + 4; x++) {
        const edge = x === xc - 4 || x === xc + 4;
        for (let y = under; y <= 12 + (edge ? 2 : 0); y++) put(x, y, z, y === under ? M.STONE : edge && y > 12 ? M.TRIM : M.GRANITE);
      }
    }
  }
  grandHall(); tunnel(); shortcut();
}
// [6] The Grand Hall: granite walls, a tall arched window down each side, a vaulted roof, a row of columns either side of
// the road inside, a clock over the east doors with the hall's name under it, and a tower on top.
function grandHall() {
  const { x0, x1, z0, z1, door, roof } = HALL, zc = CROSS, half = 17;
  const arch = (z) => { const u = (z - zc) / half; return Math.abs(u) > 1 ? -1 : Math.round(door - 6 * u * u); };   // the doorway's top at z
  begin('Grand Hall', 'landmark'); see();
  for (let y = 0; y <= roof; y++) {
    // the end walls, with the doorways
    for (const x of [x0, x1]) for (let z = z0; z <= z1; z++) { const top = arch(z); if (y <= top) continue; set(x, y, z, y % 8 === 7 ? M.TRIM : M.GRANITE); }
    // the side walls, each with three tall windows
    for (const z of [z0, z1]) for (let x = x0; x <= x1; x++) { const win = y >= 8 && y <= roof - 8 && ((x - x0) % 13 > 3) && ((x - x0) % 13 < 11); set(x, y, z, win ? M.GLASS : y % 8 === 7 ? M.TRIM : M.GRANITE); }
  }
  // the roof: a shallow vault over the whole hall, lit along its crown
  for (let z = z0; z <= z1; z++) { const u = (z - (z0 + z1) / 2) / ((z1 - z0) / 2), y = Math.round(roof + 6 * (1 - u * u)); for (let x = x0; x <= x1; x++) { set(x, y, z, Math.abs(z - (z0 + z1) / 2) < 2 ? M.LIT_W : M.ROOF_D); set(x, y - 1, z, M.SLAB); } }
  // the columns inside, either side of the road
  for (const z of [zc - half - 3, zc + half + 2]) for (let x = x0 + 5; x <= x1 - 5; x += 8) box(x, 0, z, x + 1, roof - 1, z + 1, (x & 1) ? M.MARBLE : M.MARBLE);
  // the tower on top
  begin('Grand Hall tower', 'landmark'); see();
  const tx0 = (x0 + x1 >> 1) - 9, tx1 = tx0 + 18, tz0 = zc - 9, tz1 = zc + 9;
  for (let y = roof + 7; y <= roof + 44; y++) for (let x = tx0; x <= tx1; x++) for (let z = tz0; z <= tz1; z++) {
    if (x > tx0 && x < tx1 && z > tz0 && z < tz1) continue;
    const win = (y - roof) % 6 > 2 && (x + z) % 4 !== 0; set(x, y, z, win ? M.GLASS : M.LIME);
  }
  for (let k = 0; k <= 9; k++) box(tx0 + k, roof + 45 + k, tz0 + k, tx1 - k, roof + 45 + k, tz1 - k, M.COPPER2);
  // the clock over the east doors, facing the drivers coming in, and the name under it
  begin('Grand Hall clock', 'sign', false); see();
  const cy = door + 11, F = face('r', x1, z0, x1, z1);
  for (let dz = -7; dz <= 7; dz++) for (let dy = -7; dy <= 7; dy++) { const r = Math.hypot(dz, dy); if (r <= 7.4) set(x1 + 1, cy + dy, zc + dz, r > 6.2 ? M.BRASS : M.TRIM); }
  for (let k = 0; k <= 5; k++) set(x1 + 2, cy + k, zc, M.DARK);         // the minute hand, at twelve
  for (let k = 0; k <= 3; k++) set(x1 + 2, cy, zc - k, M.DARK);         // the hour hand, at three (as the drivers see it)
  const name = 'GRAND HALL'; text(F, name, (F.W - textW(name)) >> 1, door + 1, 1, M.LIT_Y);
}
// [2] The River Drive tunnel: a slab over the river avenue on a colonnade along the shore, the lots' own buildings for
// its west wall, lamps along its underside, and a row of apartment blocks standing on it.
function tunnel() {
  const { x0, x1, z0, z1, y } = TUNNEL;
  begin('River Drive deck', 'landmark'); see();
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { set(x, y, z, M.CONC); set(x, y + 1, z, M.CONC); set(x, y + 2, z, x === x1 || z === z0 || z === z1 ? M.TRIM : M.SLAB); }
  for (let z = z0; z <= z1; z += 6) for (let x = x0 + 4; x < x1; x += 12) set(x, y - 1, z, M.LIT_Y);   // the lamps
  // the colonnade along the shore and the deck's ends: square columns every eight
  for (let z = z0; z <= z1; z += 8) box(x1 - 2, 0, z, x1, y - 1, z + 1, M.CONC);
  // the apartment blocks on top: three, brick, with rows of windows, some lit
  for (const [a, b, h, m] of [[z0, z0 + 18, 34, M.BRICK], [z0 + 21, z0 + 39, 42, M.BROWNST], [z0 + 42, z1, 30, M.BRICK2]]) {
    begin('River Drive apartments', 'building'); see();
    for (let yy = y + 3; yy <= y + 3 + h; yy++) for (let z = a; z <= b; z++) for (let x = x0 + 2; x <= x1 - 2; x++) {
      const edge = x === x0 + 2 || x === x1 - 2 || z === a || z === b; if (!edge && yy < y + 3 + h) continue;
      const row = (yy - y - 3) % 5, col = (x + z) % 4, win = edge && row >= 2 && row <= 3 && col !== 0 && yy < y + 3 + h;
      set(x, yy, z, yy === y + 3 + h ? M.ROOF_D : win ? ((x * 7 + z * 3 + yy) % 5 === 0 ? M.LIT_Y : M.GLASS) : m);
    }
  }
}
// [9] The shortcut building: an old four-storey block, its walls a single brick thick (a car goes through them at
// speed), with scaffolding up the two faces on the course. Built as an ordinary building, so it breaks like one, and
// after the first car through it there is a hole for the rest.
function shortcut() {
  const { x0, x1, z0, z1, h } = SHORT;
  begin('Old block', 'building');
  for (let y = 0; y <= h; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const edge = x === x0 || x === x1 || z === z0 || z === z1, floor = y % 6 === 5;
    if (!edge && !floor && y !== h) continue;
    const win = edge && !floor && y % 6 >= 2 && (x + z) % 5 > 1;
    set(x, y, z, y === h ? M.ROOF_D : floor && !edge ? M.FLOOR : win ? M.GLASS : y < 1 ? M.STAIN_R : M.BRICK);
  }
  // the scaffolding: poles and boards up the west and south faces, and a sign
  begin('Scaffolding', 'prop', false);
  for (let y = 0; y <= h + 2; y++) {
    for (let z = z0; z <= z1; z += 6) set(x0 - 3, y, z, M.IRON);
    for (let x = x0; x <= x1; x += 6) set(x, y, z1 + 3, M.IRON);
    if (y % 6 === 5) { for (let z = z0; z <= z1; z++) { set(x0 - 2, y, z, M.WOOD); set(x0 - 3, y, z, M.WOOD); } for (let x = x0; x <= x1; x++) { set(x, y, z1 + 2, M.WOOD); set(x, y, z1 + 3, M.WOOD); } }
  }
  const F = face('b', x0, z1 + 3, x1, z1 + 3), w = 'SHORTCUT?';
  for (let u = ((F.W - textW(w)) >> 1) - 2; u < ((F.W + textW(w)) >> 1) + 2; u++) for (let yy = 12; yy <= 18; yy++) F.p(u, yy, 1, M.SIGN);
  text(F, w, (F.W - textW(w)) >> 1, 13, 2, M.LIT_Y);
}
function build() {
  // the lots along the course are left out of the plan before the city is built (each keeps its own seed, so the rest
  // come out as they always do)
  LOTS.forEach((L, i) => { if (L.sid === undefined) L.sid = i; });
  for (let i = LOTS.length - 1; i >= 0; i--) if (GONE.has(LOTS[i].c + ',' + LOTS[i].r)) LOTS.splice(i, 1);
  generateTown();
  const keep = vehicles.filter((v) => v.kind !== 'car' && v.kind !== 'bus' && v.kind !== 'school');
  vehicles.length = 0; vehicles.push(...keep);
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1; setSeed(5115);
  const first = bodies.length;
  for (const [x0, z0, x1, z1, kind, dressing] of WALLS) { wall(x0, z0, x1, z1, kind); if (dressing) dress(x0, z0, x1, z1, dressing); }
  for (const [x, z, len, rows, look, seat, sponsor] of STANDS) stand(x, z, len, rows, look, M[seat], sponsor);
  clearCourse();
  setPieces();
  // the gantry spans the course at the line, edge to edge, its feet just inside the kerbs
  const T = course().T, wl = Math.min(CAP, reach(T, 0, 0, CAP_BEND + 6)), wr = Math.min(CAP, reach(T, 0, 1, CAP_BEND + 6));
  gantry(LINE_X, Math.round(TIMES - wl) + 2, Math.round(TIMES + wr) - 2, ['FIVE CROSSINGS', 'NEW YORK GP'], -1, GANTRY_Y);
  countFrom(first);
}

// ---- the painted ground: New York's, with the course laid over it ----------------------------------------------
// The course's asphalt is laid without fleck, worn as a working street is (circuit.js), and all the paved ground is
// marked hard in the paint's alpha (grassOf): the floor gives it a fine grain of its own, evens out New York's own
// fleck on the streets round about, and keeps the rubber the cars lay (ground.js, dirt.js: groundDetail below).
let grassy = null;   // the grass, a voxel at a time (for surface())
// New York's ground is painted at four pixels a voxel (4096 square). Phones get it at half that, which keeps about
// 110 MB off them (the picture on the page and its copy on the graphics chip); two pixels a voxel is still finer than
// the speckle and the course's lines. The same test for a phone as main.js's.
const PHONE = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
function paint() {
  const { T, grid, line } = full(), cv = groundCanvas(), g = cv.getContext('2d');
  paintCourse(g, T, grid, 62, line);
  // [8] the trench past the ramp: dug earth, steel plates along each edge
  g.fillStyle = '#4a3c30'; g.fillRect(JUMP.x0 * GK, JUMP.z1 * GK, (JUMP.x1 - JUMP.x0) * GK, JUMP.dig * GK);
  g.fillStyle = 'rgba(30,22,16,0.6)'; for (let k = 0; k < 40; k++) g.fillRect((JUMP.x0 + ((k * 37) % (JUMP.x1 - JUMP.x0))) * GK, (JUMP.z1 + 3 + ((k * 11) % (JUMP.dig - 6))) * GK, 5 * GK, 2 * GK);
  g.fillStyle = '#7a7f86'; for (const z of [JUMP.z1, JUMP.z1 + JUMP.dig - 2]) g.fillRect(JUMP.x0 * GK, z * GK, (JUMP.x1 - JUMP.x0) * GK, 2 * GK);
  grassy = grassOf(cv, true, T);
  if (!PHONE) return cv;
  const half = document.createElement('canvas'); half.width = cv.width >> 1; half.height = cv.height >> 1;
  const h = half.getContext('2d'); h.imageSmoothingQuality = 'high'; h.drawImage(cv, 0, 0, half.width, half.height);
  cv.width = cv.height = 1;   // let the full-size picture go now rather than when it is collected
  return half;
}

// The radar shows the part of the city the course is in (RADAR_BOX), not the whole map, so the course is big enough
// to read; the course is drawn once onto a canvas of its own.
const RADAR_BOX = [170, 420, 1010, 940];
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
  id: 'crossings', name: 'Five Crossings', mode: 'race', laps: 4, hidden: true,
  blurb: 'Four laps across New York and back: a tunnel, two bridges, under the El, through a hall and the park. Guns on.',
  loading: ['Closing the streets', 'Building New York and opening the bridges'],
  outer: 0x4e8fa6,   // the water round the city
  // raced at the end of the day, the sun low in the south-east (looks/dusk.js)
  look: { kind: 'dusk' },
  // The city past the edge of the map (../backdrops/harbor.js): more boroughs, the far banks, two bridges reaching off
  // it, traffic on the far roads and the news helicopter over the race. x east, z south, in voxels.
  backdrop: {
    kind: 'harbor', seed: 7311,
    world: [0, 0, WX, WZ],
    view: { x: 590, z: 680 },                // the middle of the course
    course: [193, 474, 973, 882],            // the box the course runs in: heights are set by how far from it a tower is
    reach: 2300,                             // and nothing stands further than this from any corner of it
    water: 0x4e8fa6,                         // the map's own painted water
    // the streets past the edge: the map's own, then on at their spacing [first, every] north and south of the Harlem
    // River, east and west of the map
    streets: { x: STREET_X, w: 36, zN: [150, 122], zS: [860, 122], xE: [952, 174], xW: [262, 174] },
    // the shores: the Harlem River (on east across the edge), the Bronx's on the Hudson, the far bank of the Hudson,
    // Brooklyn's (the East River's far side, then sloping out to the Narrows, then its south shore on the sea), the
    // island across the harbor (south of z and west of x) and the sound the Harlem River runs out into east of the map
    // (east of x, between z0 and z1), at the end of the view down the start straight
    shores: { harlem: [214, 262], bronx: -34, jersey: -240, brooklyn: { x: 880, slope: 0.19, south: 1540, fall: 0.45 }, island: { z: 1470, x: 560 }, sound: { x: 1320, z0: 140, z1: 540 } },
    // where the towers stand taller (k), and the landmark in each (kit.js's towerKit)
    downtowns: [
      { x: -560, z: 880, r: 520, k: 1.55, mark: 1 },    // across the Hudson, facing the tip
      { x: 1230, z: 700, r: 380, k: 1.4, mark: 3 },     // Brooklyn, across the East River
      { x: 1250, z: -380, r: 420, k: 1.2 },             // up beyond the Bronx
      { x: 1900, z: 400, r: 500, k: 1.3, mark: 5 },     // out in Queens
    ],
    // the bridges: a to b along the deck (y high, w wide); the suspension bridge's towers and the stayed one's pylon
    // are distances along it from a
    bridges: [
      { kind: 'suspension', a: [430, 1525], b: [1110, 1525], towers: [175, 505], w: 46, y: 52, h: 150 },   // the Narrows, down the river drive
      { kind: 'stayed', a: [1720, 40], b: [1720, 700], pylon: 332, w: 40, y: 44, h: 190 },               // the sound, down the start straight
    ],
    // an elevated road across the far end of the view north up the park
    expressways: [{ a: [10, -340], b: [2080, -340], w: 70, y: 46 }],
    port: { x0: -150, x1: 420, z: 1505, cranes: 6, stacks: 40 },   // cranes and containers on the island's shore
    ships: [{ x: 380, z: 1180, len: 150, yaw: 0.3, hull: 0x3a2a26 }, { x: -110, z: 640, len: 120, yaw: 1.45, hull: 0x26313a }],
    // traffic out along the streets that leave the map (east, north) this far, and along the far bank (z from, to)
    traffic: { east: [150, 372, 494, 616, 738, 860, 982], north: STREET_X, length: 900, bank: [-700, 1400] },
    skyline: [0.4, 0.75, 1.0, 0.85, 0.8, 0.75, 0.95, 0.6, 0.4],   // the far skyline's height round from the south, by east
    heli: { ahead: 290, y: 86, size: 1.5, sway: 18 },              // the news helicopter: how far ahead, how high (it climbs over towers)
  },
  // on a phone or tablet, the city is drawn in full a little less far out than on the other maps (quality.js): the
  // start looks down the whole of Times Square's canyon of signs, and the lap crosses the island twice
  lodK: 0.55,
  // where the chase camera has a roof over it, and must stay under it (main.js stepCamera)
  roofs: [{ x0: HALL.x0, z0: HALL.z0, x1: HALL.x1, z1: HALL.z1, y: HALL.roof - 1 }, { x0: TUNNEL.x0, z0: TUNNEL.z0, x1: TUNNEL.x1, z1: TUNNEL.z1, y: TUNNEL.y }],
  // the set pieces that move or aren't voxels (hazards.js)
  hazards: [
    { kind: 'el', x: EL.x, z0: 300, z1: 1010, y: EL.y, every: 16 },
    { kind: 'ramp', x0: JUMP.x0, z0: JUMP.z0, x1: JUMP.x1, z1: JUMP.z1, yaw: 0 },
    { kind: 'covered', x0: HALL.x0, z0: HALL.z0, x1: HALL.x1, z1: HALL.z1, dim: 0.62 },
    { kind: 'covered', x0: TUNNEL.x0, z0: TUNNEL.z0, x1: TUNNEL.x1, z1: TUNNEL.z1, dim: 0.5 },
  ],
  build,
  ground: paint,
  get spawn() { return full().grid[4]; },   // the player starts fifth
  // a rival coming in (only if a mode asks the map): at a checkpoint far from the player, facing the way round
  spawnPoint(player, taken) {
    const { T, gates } = full();
    return pickSpot(gates.map((i) => ({ x: T.X[i], z: T.Z[i], yaw: Math.atan2(T.TX[i], T.TZ[i]) })), player, taken);
  },
  // the way on round the course from wherever the car is (the race mode's drivers have their own; this is for others)
  waypoint(c, tx, tz, out) {
    const { T } = full(), p = T.project(c.x, c.z, c._rw ?? -1), j = T.at(p.i + Math.round(36 / T.STEP));
    c._rw = p.i; out.x = T.X[j]; out.z = T.Z[j]; return out;
  },
  radar,
  radarBox: RADAR_BOX,
  // the paved ground's grain, New York's fleck evened out, and the rubber laid over the race (ground.js, dirt.js); the
  // rubber weathers slowly, so it builds up along the racing line over the four laps
  groundDetail: { hard: true, deFleck: true, fade: 20 },
  rutBox: [RADAR_BOX[0] - 30, RADAR_BOX[1] - 30, RADAR_BOX[2] + 30, RADAR_BOX[3] + 10],
  // what the ground is at (x, z): 0 on the course and the paving, 0.7 on the park's grass (see vehicle.js)
  surface(x, z) { return grassy && TR ? surfaceAt(TR.T, grassy, x, z) : 0; },
  // the course, for the race mode
  get track() { return full(); },
};
