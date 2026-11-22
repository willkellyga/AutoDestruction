// Manhattan Circuit: a street race through Monster Mayhem's New York, four laps with the guns on (modes/race.js). The
// city is New York as the base game builds it (src/nyc.js and the rest, a world of its own: see ../flags.js), with the
// parked cars taken out and, along the course, one row of lots left unbuilt on one side of each street, so the course
// is the street and the lots beside it: about 85 across from building to building, the city's towers still lining it.
//
// The lap, from the line on the street along the top of the park, heading east under the start gantry: a long
// straight with Harlem on the left and the park on the right, a fast sweep right onto the East River drive, down the
// river past two bridges, right again into a short straight with the king tower and the silver spire on the left, a
// long U-turn left round the spire's block past the Times Square tower, back east under the king tower's south face, a
// tighter U-turn right along the river with the Brooklyn Bridge ahead, the long run west through the downtown towers
// with a kink where it crosses Times Square's avenue, a sweep right at the Battery, the long straight north beside the
// park and a fast sweep right back onto the top. About 2,250 voxels a lap.
//
// The course's middle line is a loop of straight runs and rounded corners (COURSE, made into a track by racetrack.js),
// down the middle of what is open once the lots beside it are left out. The room either side of it is measured from
// what stands there once the city is built (circuit.js), and the race mode reads that with the rest: the racing line,
// the checkpoint gates and the grid. Concrete blocks and temporary stands shut the cross streets and the bridges;
// nothing else is put in the way. Buildings stay as they are: smash through one if you like, but the gates still
// have to come in order.
import { WX, WZ, M, place, ctx, setSeed, bodies, vehicles, STREET_X, STREET_Z } from '../../../src/world.js';
import { generateTown, LOTS } from '../../../src/town.js';
import { groundCanvas } from '../../../src/ground.js';
import { pickSpot } from './common.js';
import { makeTrack, streetLoop, racingLine } from './racetrack.js';
import { removeBody, small, countFrom, wall, dress, gantry, stand, reach, measure, gatesFor, gridFor, paintCourse, grassOf, surfaceAt, radarCourse } from './circuit.js';

// The middle of each run, half way across what is open: the top (z), the river (x), past the king tower's north face
// (z), the U-turn round the spire's block (x), under the king tower's south face (z), the U-turn on the river (x), the
// bottom run (z, east and west of the kink) and the run up beside the park (x)
const TOP = 349, RIVER = 720, KING_N = 593, TIMES = 459, KING_S = 761, BOT_E = 883, BOT_W = 837, PARK_W = 239;
const LINE_X = 460;   // the start line, on the top run
// the start gantry's beam, high enough that the chase camera (up behind the car) looks under it rather than closing in
// as the car goes through
const GANTRY_Y = 27;
// the course: each corner [x, z, radius of the curve round it]. Two corners a diameter apart make a U-turn.
const COURSE = [
  [LINE_X, TOP, 0],
  [RIVER, TOP, 100],                                 // onto the river drive
  [RIVER, KING_N, 56],                               // off it, towards the towers
  [TIMES, KING_N, 84], [TIMES, KING_S, 84],          // the long U-turn round the spire's block
  [RIVER, KING_S, 61], [RIVER, BOT_E, 61],           // the U-turn on the river
  [520, BOT_E, 120], [390, BOT_W, 120],              // the kink across Times Square's avenue
  [PARK_W, BOT_W, 60],                               // the Battery
  [PARK_W, TOP, 100],                                // the top of the park
];
const CAP = 46, CAP_BEND = 60;      // the most room counted each side of the middle line: on a straight, and in a bend
const MARGIN = 6.5;                 // how far inside the room the racing line keeps a car's middle
const GATES = 26;                   // checkpoint gates round the lap (about one every 90 voxels)
// The lots left unbuilt, by column and row of New York's plan (src/nyc.js: PX, PZ): one row along each run, on the
// side away from the landmarks, so the king tower, the silver spire, the Times Square tower and the park all stand.
const GONE = new Set([
  ...[4, 5, 6, 7, 8, 9, 10, 11, 12].map((c) => c + ',4'),     // the Harlem row along the top
  ...[5, 6, 7, 8, 9, 10, 11, 12].map((r) => '4,' + r),       // the west side of the run up beside the park
  ...[5, 6, 7].map((r) => '12,' + r), '12,12',              // the river drive's side
  ...[8, 9, 10, 11, 12].map((c) => c + ',8'),               // north of the king tower
  '8,9', '8,10',                                            // inside the long U-turn
  ...[8, 9, 10, 11, 12].map((c) => c + ',11'),              // south of the king tower
  '5,12', '6,12', '7,12',                                   // the bottom run, west of the kink
  ...[8, 9, 10, 11, 12].map((c) => c + ',13'),              // the bottom run, east of it
]);
// The walls: [x0, z0, x1, z1, kind ('c' concrete blocks, 't' tyres), dressing]. The dressing faces the course from
// `side` ('f' low z, 'b' high z, 'l' low x, 'r' high x): a sponsor's name, or chevrons ('<' or '>', the way the
// corner goes as the drivers see it).
const WALLS = [
  // the park, kept out of it along the top and down the west side
  [281, 390, 417, 391, 'c', ['f', 'GRIT COLA']],
  [281, 392, 282, 475, 'c', ['l', 'DENT KINGS']], [281, 476, 282, 553, 'c', ['l', 'ZAPP OIL']], [281, 554, 282, 633, 'c', ['l', 'HOT SPARK']],
  // the bridges over the East River
  [767, 352, 769, 392, 'c', ['l', '>']], [767, 475, 769, 513, 'c', ['l', 'BOLTZ TYRES']], [767, 597, 769, 635, 'c', ['l', 'SCRAP CITY']],
  [767, 719, 769, 757, 'c', ['l', '>']], [767, 841, 769, 879, 'c', ['l', 'RUST RACING']],
  // the cross streets
  [669, 477, 670, 511, 'c', ['r', 'HOT SPARK']],                                         // off the river drive
  [590, 550, 630, 551, 'c', ['b', 'ZAPP OIL']], [590, 635, 630, 636, 'c', ['f', 'BOLTZ TYRES']],   // either side of the king tower's north run
  [416, 550, 456, 551, 'c', ['b', 'DENT KINGS']], [414, 552, 415, 597, 'c', ['r', '<']],             // the top of the long U-turn
  [590, 717, 630, 718, 'c', ['b', 'GRIT COLA']], [718, 717, 769, 718, 'c', ['b', 'RUST RACING']],   // under the king tower's south face
  [590, 803, 630, 804, 'c', ['f', 'HOT SPARK']], [590, 840, 630, 841, 'c', ['b', 'ZAPP OIL']],      // between that run and the bottom one
  [416, 797, 456, 798, 'c', ['b', 'SCRAP CITY']],                                        // Times Square's avenue, above the kink
  [193, 843, 194, 882, 'c', ['r', '>']],                                                 // the Battery corner
  [193, 599, 194, 633, 'c', ['r', 'GRIT COLA']], [283, 721, 284, 755, 'c', ['l', 'BOLTZ TYRES']],  // off the run up beside the park
];
// temporary stands: [x, z, length, rows, the way the crowd looks, seat colour, sponsor], across the mouths of the
// cross streets, most of them round the outside of the corners
const STANDS = [
  [418, 306, 36, 4, 's', 'CAR_A', 'GRIT COLA'], [418, 392, 36, 4, 'n', 'CAR_B', 'DENT KINGS'],     // either side of the line
  [592, 306, 36, 4, 's', 'SIGN', 'ZAPP OIL'], [592, 392, 36, 4, 'n', 'AWN_G', 'SCRAP CITY'],      // further down the top run
  [244, 306, 36, 4, 's', 'CAR_B', 'HOT SPARK'], [193, 356, 32, 4, 'e', 'CAR_A', 'BOLTZ TYRES'],   // round the top of the park
  [719, 306, 48, 4, 's', 'AWN_G', 'SCRAP CITY'],                                          // outside the turn onto the river
  [719, 637, 48, 4, 'n', 'CAR_A', 'BOLTZ TYRES'],                                         // outside the turn off it, by the king tower
  [413, 600, 32, 4, 'e', 'SIGN', 'RUST RACING'], [413, 721, 34, 4, 'e', 'CAR_B', 'GRIT COLA'],    // outside the long U-turn, by Times Square
  [719, 927, 48, 4, 'n', 'CAR_B', 'DENT KINGS'],                                          // the end of the river
  [592, 927, 36, 4, 'n', 'AWN_G', 'HOT SPARK'], [418, 927, 36, 4, 'n', 'CAR_A', 'ZAPP OIL'],      // the bottom run
  [244, 881, 36, 4, 'n', 'SIGN', 'GRIT COLA'],                                            // outside the Battery corner
  [193, 478, 32, 4, 'e', 'CAR_B', 'SCRAP CITY'], [193, 722, 32, 4, 'e', 'AWN_G', 'DENT KINGS'],  // the run up beside the park
];

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
  const gantry = { x: LINE_X, z: TOP - mid, y: GANTRY_Y };
  const lights = { x: LINE_X - 1.3, y: gantry.y - 2.4, z: TOP - mid, yaw: Math.PI / 2, lx: 0, lz: 1 };   // in front of the lights' box, facing the grid
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
function build() {
  // the lots along the course are left out of the plan before the city is built (each keeps its own seed, so the rest
  // come out as they always do)
  LOTS.forEach((L, i) => { if (L.sid === undefined) L.sid = i; });
  for (let i = LOTS.length - 1; i >= 0; i--) if (GONE.has(LOTS[i].c + ',' + LOTS[i].r)) LOTS.splice(i, 1);
  generateTown();
  const keep = vehicles.filter((v) => v.kind !== 'car' && v.kind !== 'bus' && v.kind !== 'school');
  vehicles.length = 0; vehicles.push(...keep);
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1; setSeed(6262);
  const first = bodies.length;
  for (const [x0, z0, x1, z1, kind, dressing] of WALLS) { wall(x0, z0, x1, z1, kind); if (dressing) dress(x0, z0, x1, z1, dressing); }
  for (const [x, z, len, rows, look, seat, sponsor] of STANDS) stand(x, z, len, rows, look, M[seat], sponsor);
  clearCourse();
  // the gantry spans the course at the line, edge to edge, its feet just inside the kerbs
  const T = course().T, wl = Math.min(CAP, reach(T, 0, 0, CAP_BEND + 6)), wr = Math.min(CAP, reach(T, 0, 1, CAP_BEND + 6));
  gantry(LINE_X, Math.round(TOP - wl) + 2, Math.round(TOP + wr) - 2, ['MANHATTAN GRAND PRIX', 'GRAND PRIX'], -1, GANTRY_Y);
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
  grassy = grassOf(cv, true, T);
  if (!PHONE) return cv;
  const half = document.createElement('canvas'); half.width = cv.width >> 1; half.height = cv.height >> 1;
  const h = half.getContext('2d'); h.imageSmoothingQuality = 'high'; h.drawImage(cv, 0, 0, half.width, half.height);
  cv.width = cv.height = 1;   // let the full-size picture go now rather than when it is collected
  return half;
}

// The radar shows the part of the city the course is in (RADAR_BOX), not the whole map, so the course is big enough
// to read; the course is drawn once onto a canvas of its own.
const RADAR_BOX = [170, 280, 800, 950];
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
  id: 'race', name: 'Manhattan Circuit', mode: 'race', laps: 4,
  blurb: 'Four laps through New York: river sweeps, two long U-turns round the towers, the downtown straight. Guns on.',
  loading: ['Closing the streets', 'Building New York and opening up the course'],
  outer: 0x4e8fa6,   // the water round the city
  // raced at the end of the day, the sun low in the south-east (looks/dusk.js)
  look: { kind: 'dusk' },
  // The city past the edge of the map (../backdrops/harbor.js): more boroughs, the far banks, two bridges reaching off
  // it, traffic on the far roads and the news helicopter over the race. x east, z south, in voxels.
  backdrop: {
    kind: 'harbor', seed: 7311,
    world: [0, 0, WX, WZ],
    view: { x: 480, z: 620 },                // the middle of the course
    course: [193, 306, 769, 927],            // the box the course runs in: heights are set by how far from it a tower is
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
