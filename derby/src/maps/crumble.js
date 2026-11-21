// Crumbletown Circuit: a street race through Crumbletown, four laps with the guns on (modes/race.js). It is off the
// start card since the race moved to New York (maps/manhattan.js), and loads with ?map=crumble. The town is
// built exactly as the town map builds it (maps/town.js: generateTown, with the parked cars and buses taken out); then
// it is opened up for the race: the lots round the edge of the town move back from their streets (BACK), three lots
// are taken out (GONE), and the street furniture on the course goes, so the course is about twice a street's width
// all the way round, with the town's buildings still lining it, set back.
//
// The lap, from the line on the north street heading west under the start gantry: a long straight past the downtown
// towers and the stadium, a fast sweep left across the corner where the grocer's stood, down the west street to a
// square left at the bottom, the long south street past the car parks and the fuel yard, a hairpin round the end of a
// wall where the fuel station stood, a quick right onto the east street, and a fast sweep left across the old hotel's
// corner back onto the north street. About 1,250 voxels.
//
// The course's middle line is a loop of straight runs and rounded corners (COURSE, made into a track by
// racetrack.js). How much room there is either side of it is measured from what stands in the town once it is built
// (so the racing line uses all of it and keeps off what is left), and the race mode reads that with the rest: the
// racing line, the checkpoint gates and the grid. Concrete blocks and temporary stands shut the side streets; tyres
// round the outside of the hairpin; nothing else is put in the way. Buildings stay as they are: smash through one if
// you like, but the gates still have to come in order.
import { WX, WY, WZ, M, place, ctx, setSeed, idx, ownerAt, voxAt, setCell, bodies, vehicles, lots, STREET_X, STREET_Z, CARRY } from '../../../src/world.js';
import { generateTown } from '../../../src/town.js';
import { groundCanvas, GK } from '../../../src/ground.js';
import { pickSpot } from './common.js';
import { makeTrack, streetLoop, racingLine } from './racetrack.js';
import { removeBody, small, clearRect, countFrom, wall, dress, gantry, stand, reach, measure, gatesFor, gridFor, paintCourse, grassOf, surfaceAt, radarCourse } from './circuit.js';

const NZ = 72, WC = 72, SZ = 333, EC = 435;   // the course's middle line down the north, west, south and east streets
const LINE_X = 300;   // the start line, on the north street
// the course: each corner [x, z, radius of the curve round it]. Two corners a diameter apart make a hairpin.
const COURSE = [
  [LINE_X, NZ, 0],
  [WC, NZ, 62],                          // the sweep across the grocer's corner
  [WC, SZ, 26],                          // the square left at the bottom of the west street
  [481, SZ, 24], [481, SZ - 48, 24],     // the hairpin at the fuel yard
  [EC, SZ - 48, 22],                     // the quick right onto the east street
  [EC, NZ, 62],                          // the sweep across the hotel's corner
];
const APEX = [[481, SZ - 24]];   // the far end of the hairpin (a gate goes there)
const CAP = 30, CAP_BEND = 34;      // the most room counted each side of the middle line: on a straight, and in a bend
const MARGIN = 6.5;                 // how far inside the room the racing line keeps a car's middle
// the lots, by where they stand in the town's plan (src/town.js): the ones round the edge move back this far from their
// streets, out over the grass at the town's edge; these three go
const BACK = 18;
const GONE = [[101, 98], [367, 98], [446, 266]];   // the grocer's and the hotel (the sweeps cross their corners), the fuel station (the hairpin)

// The walls: [x0, z0, x1, z1, kind ('c' concrete blocks, 't' tyres), dressing]. The dressing faces the course from
// `side` ('f' low z, 'b' high z, 'l' low x, 'r' high x): a sponsor's name, or chevrons ('<' or '>', the way the
// corner goes as the drivers see it).
const WALLS = [
  // the middle street shut where it meets the course, north of the north street's line and both sides of the south
  // street's (the other mouths have stands across them)
  [234, 104, 274, 106, 'c', ['f', 'BOLTZ TYRES']], [234, 299, 274, 301, 'c', ['b', 'ZAPP OIL']],
  // the cross street shut both sides of the town
  [104, 184, 106, 220, 'c', ['l', 'RUST RACING']], [401, 184, 403, 220, 'c', ['r', 'DENT KINGS']],
  // the wall the hairpin goes round, with tyres on its nose
  [405, 307, 429, 311, 'c', ['b', 'GRIT COLA']], [430, 307, 449, 311, 'c', ['f', 'HOT SPARK']], [450, 306, 455, 312, 't'],
  // the outside of the hairpin, at the edge of the map
  [502, 262, 504, 358, 't', ['l', '<']],
];
// temporary stands: [x, z, length, rows, the way the crowd looks, seat colour, sponsor]. Most stand across the mouths
// of the side streets that run out from the course to the edge of the map.
const STANDS = [
  [236, 39, 36, 4, 's', 'CAR_A', 'GRIT COLA'],                                           // by the start
  [62, 39, 34, 4, 's', 'CAR_B', 'DENT KINGS'], [39, 62, 34, 4, 'e', 'SIGN', 'ZAPP OIL'],      // outside the first sweep
  [39, 186, 32, 4, 'e', 'CAR_B', 'BOLTZ TYRES'],                                          // the west street
  [36, 308, 34, 4, 'e', 'CAR_A', 'DENT KINGS'], [62, 368, 34, 4, 'n', 'AWN_G', 'SCRAP CITY'], // round the square left
  [236, 367, 36, 4, 'n', 'CAR_B', 'HOT SPARK'],                                          // the south street
  [411, 368, 34, 4, 'n', 'SIGN', 'BOLTZ TYRES'],                                          // braking for the hairpin
  [469, 186, 32, 4, 'w', 'SIGN', 'GRIT COLA'],                                            // the east street
  [469, 62, 34, 4, 'w', 'CAR_A', 'SCRAP CITY'], [411, 39, 34, 4, 's', 'AWN_G', 'HOT SPARK'],  // outside the last sweep
];

// ---- the course's shape: plain geometry, worked out once ------------------------------------------------------------
let CO = null;
function course() {
  if (!CO) CO = { T: makeTrack({ pts: streetLoop(COURSE), halfW: CAP, smooth: false, WX, WZ, reach: CAP_BEND + 10 }) };
  return CO;
}
// ---- the rest, once the town and the course are built: the room each side, the racing line, gates and grid -----
let TR = null;
function full() {
  if (TR) return TR;
  const { T } = course();
  measure(T, CAP, CAP_BEND);   // the room each side (T.WL, T.WR), out to what stands in the town
  const { N, WL, WR } = T;
  const lo = new Float32Array(N), hi = new Float32Array(N);
  for (let i = 0; i < N; i++) { lo[i] = -WR[i] + MARGIN; hi[i] = WL[i] - MARGIN; if (lo[i] > hi[i]) lo[i] = hi[i] = (lo[i] + hi[i]) / 2; }
  const line = racingLine(T, { margin: MARGIN, lo, hi });
  // the checkpoint gates, evenly round the lap from the line, but with one at the far end of the hairpin, so that
  // blasting through the wall down the hairpin's middle doesn't save the trip round it
  const { gates, gateS } = gatesFor(T, 14, APEX);
  // the grid behind the line, pole on the inside of the first corner (a left)
  const grid = gridFor(T, 1), mid = (WL[0] - WR[0]) / 2;
  const gantry = { x: LINE_X, z: NZ + mid, y: 19 };
  const lights = { x: LINE_X + 3.3, y: gantry.y - 2.4, z: NZ + mid, yaw: Math.PI / 2, lx: 0, lz: 1 };   // in front of the lights' box, facing the grid
  TR = { T, P: null, line, gates, gateS, grid, gantry, lights, HALF: CAP, PIT_HALF: 0 };
  return TR;
}

// ---- building ----------------------------------------------------------------------------------------------------
const lotAt = (x, z) => lots.find((l) => l.x === x && l.z === z);
// A lot round the town's edge moves back from its street, everything that was built on it: each body's voxels go
// (dx, dz) further out, over the grass, and whatever small stood there (the edge's trees) comes out first.
const MOVED = [];   // [x, z, dx, dz] of each lot that moved, for the painted ground
function moveLot(l, dx, dz) {
  const mine = bodies.filter((b) => b && !b.dead && b.lot === l.id && b.x1 >= 0);
  if (!mine.length) return;
  clearRect(Math.min(...mine.map((b) => b.x0)) + dx, Math.min(...mine.map((b) => b.z0)) + dz, Math.max(...mine.map((b) => b.x1)) + dx, Math.max(...mine.map((b) => b.z1)) + dz);
  const vox = [];
  for (const b of mine) for (let y = 0; y <= b.y1; y++) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) {
    const i = idx(x, y, z), m = voxAt(i); if (m && ownerAt(i) === b.id) { vox.push(x + dx, y, z + dz, m, b.id); setCell(i, 0, 0); }
  }
  for (let k = 0; k < vox.length; k += 5) {
    const x = vox[k], y = vox[k + 1], z = vox[k + 2], m = vox[k + 3], id = vox[k + 4];
    if (x >= 1 && z >= 1 && x < WX - 1 && z < WZ - 1) { setCell(idx(x, y, z), m, id); continue; }
    const b = bodies[id]; b.count--; b.init--; b.layers[y]--; b.layers0[y]--; b.carry[y] -= CARRY[m]; b.dCarry[y] -= CARRY[m];   // off the map's edge
  }
  for (const b of mine) { b.x0 += dx; b.x1 += dx; b.z0 += dz; b.z1 += dz; if (b.dAbove) for (let y = WY - 2; y >= 0; y--) b.dAbove[y] = b.dAbove[y + 1] + b.layers[y + 1]; }
  MOVED.push([l.x, l.z, dx, dz]); l.x += dx; l.z += dz;
}
// the street furniture, trees, fences and hedges on the course come out, out to the most room it can have
function clearCourse() {
  const { T } = course(), F = T.field;
  for (const b of bodies) {
    if (!small(b) || b.x1 < 0) continue;
    let d = 1e9;
    for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) { const c = z * WX + x; if (F.near[c] >= 0) d = Math.min(d, F.dist[c]); }
    if (d < CAP_BEND + 2) removeBody(b);
  }
}
function build() {
  generateTown();
  const keep = vehicles.filter((v) => v.kind !== 'car' && v.kind !== 'bus' && v.kind !== 'school');
  vehicles.length = 0; vehicles.push(...keep);
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1; setSeed(5151);
  // open the town up: three lots go, the ones round the edge move back
  for (const [x, z] of GONE) { const l = lotAt(x, z); for (const b of bodies) if (b && !b.dead && b.lot === l.id) removeBody(b); }
  for (const l of lots.slice()) {
    if (GONE.some(([x, z]) => l.x === x && l.z === z)) continue;
    const dx = l.x === 22 ? -BACK : l.x === 446 ? BACK : 0, dz = l.z === 22 ? -BACK : l.z === 342 ? BACK : 0;
    if (dx || dz) moveLot(l, dx, dz);
  }
  clearCourse();
  const first = bodies.length;
  for (const [x0, z0, x1, z1, kind, dressing] of WALLS) { clearRect(x0, z0, x1, z1); wall(x0, z0, x1, z1, kind); if (dressing) dress(x0, z0, x1, z1, dressing); }
  // the gantry spans the course at the line, edge to edge
  const T = course().T, wl = Math.min(CAP, reach(T, 0, 0, CAP_BEND + 6)), wr = Math.min(CAP, reach(T, 0, 1, CAP_BEND + 6));
  gantry(LINE_X, Math.round(NZ - wr) + 2, Math.round(NZ + wl) - 2, ['CRUMBLETOWN GRAND PRIX', 'GRAND PRIX']);   // its feet just inside the kerbs, clear of the buildings
  for (const [x, z, len, rows, look, seat, sponsor] of STANDS) stand(x, z, len, rows, look, M[seat], sponsor);
  countFrom(first);
}

// ---- the painted ground: the town's, opened up, with the course laid over it ----------------------------------
let grassy = null;   // the grass, a voxel at a time (for surface())
function paint() {
  const { T, grid } = full(), cv = groundCanvas(), g = cv.getContext('2d');
  let s = 31; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const rect = (xa, za, xb, zb) => g.fillRect(xa * GK, za * GK, (xb - xa) * GK, (zb - za) * GK);
  const speckle = (xa, za, xb, zb, n, cols) => { for (let k = 0; k < n; k++) { g.fillStyle = cols[(r() * cols.length) | 0]; const x = Math.floor(xa + r() * (xb - xa)), z = Math.floor(za + r() * (zb - za)); rect(x, z, x + 1, z + 1); } };
  // the lots that moved take their painted ground with them; where they stood is paving, and the lots that went are grass
  const lifted = MOVED.map(([x, z]) => {
    const c = document.createElement('canvas'); c.width = c.height = 40 * GK;
    c.getContext('2d').drawImage(cv, x * GK, z * GK, 40 * GK, 40 * GK, 0, 0, 40 * GK, 40 * GK);
    return c;
  });
  for (const [x, z] of MOVED) { g.fillStyle = '#c8c1b1'; rect(x, z, x + 40, z + 40); speckle(x, z, x + 40, z + 40, 500, ['rgba(255,250,235,0.22)', 'rgba(90,84,72,0.18)']); }
  for (const [x, z] of GONE) { g.fillStyle = '#79aa62'; rect(x, z, x + 40, z + 40); speckle(x, z, x + 40, z + 40, 900, ['rgba(92,146,74,0.5)', 'rgba(146,192,108,0.45)', 'rgba(110,160,84,0.5)']); }
  MOVED.forEach(([x, z, dx, dz], k) => g.drawImage(lifted[k], (x + dx) * GK, (z + dz) * GK));
  paintCourse(g, T, grid);   // the course over it all (circuit.js)
  grassy = grassOf(cv);
  return cv;
}

// the town and the course on the radar, drawn once
let radarCv = null, radarKey = '';
function radar(R, s, ox, oy, w, h) {
  const key = [s, ox, oy, w, h].join();
  if (!radarCv || key !== radarKey) {
    radarKey = key; radarCv = radarCv || document.createElement('canvas'); radarCv.width = Math.ceil(ox * 2 + w); radarCv.height = Math.ceil(oy * 2 + h);
    radarCourse(radarCv, full().T, s, ox, oy, STREET_X, STREET_Z, w, h);
  }
  R.drawImage(radarCv, 0, 0);
}

export default {
  id: 'crumble', name: 'Crumbletown Circuit', mode: 'race', laps: 4, hidden: true,   // the widened lap is quick (15 to 19 s), so four laps make a race of about a minute and a half
  blurb: 'Four laps round Crumbletown, opened up for the race: long straights, fast sweeps, a hairpin. Guns on.',
  loading: ['Closing the streets', 'Building the town and opening up the course'],
  outer: 0x7fb069,
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
  // what the ground is at (x, z): 0 on the course and the paving, 0.7 on the grass (see vehicle.js)
  surface(x, z) { return grassy && TR ? surfaceAt(TR.T, grassy, x, z) : 0; },
  // the course, for the race mode
  get track() { return full(); },
};
