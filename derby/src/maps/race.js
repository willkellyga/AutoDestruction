// Crumbletown Circuit: a street race through Crumbletown, three laps with the guns on (modes/race.js). The town is
// built exactly as the town map builds it (maps/town.js: generateTown, with the parked cars and buses taken out); then
// the course is marked out on its streets and the streets it doesn't use are shut off.
//
// The lap, from the line on the north street heading west under the start gantry, past the downtown towers and the
// stadium: a fast kink between concrete blocks, a square left into the west street, its own kink, left again into the
// south street, then right down the middle street to a hairpin at the bottom of the town that comes back up through a
// car park. East along the south street past the fuel yard, left up the east street, right onto the middle street and
// straight into a second hairpin, round the end of a wall and through the corner car park, then right and up the east
// street to the north street and the line. About 1,320 voxels, eight square corners and two hairpins.
//
// The course's centre line is a loop of straight runs and rounded corners (COURSE, made into a track by racetrack.js).
// How much room there is either side of it is measured from what stands in the town once the course is built (so the
// racing line uses a crossing's width and keeps off the lamp posts), and the race mode reads that with the rest:
// the racing line, the checkpoint gates and the grid. Concrete blocks shut the side streets, with sponsor boards and
// chevrons on them; tyre walls round the hairpins; temporary stands with crowds at the corners. Buildings stay as
// they are: smash through one if you like, but the gates still have to come in order.
import { WX, WY, WZ, M, set, put, box, walls, begin, place, ctx, setSeed, rnd, ri, solid, idx, ownerAt, voxAt, setCell, bodies, vehicles, STREET_X, STREET_Z, CARRY } from '../../../src/world.js';
import { generateTown } from '../../../src/town.js';
import { groundCanvas, GK } from '../../../src/ground.js';
import { face, text, textW } from '../../../src/kit.js';
import { pickSpot } from './common.js';
import { makeTrack, streetLoop, racingLine } from './racetrack.js';

const [X1, X2, X3] = STREET_X, [Z1, Z2, Z3] = STREET_Z;   // the town's streets: 80, 254, 428 across and 80, 202, 324 down
const LINE_X = 296;   // the start line, on the north street
// the course: each corner [x, z, radius of the curve round it]. Two corners a diameter apart make a hairpin.
const COURSE = [
  [LINE_X, Z1, 0],
  [X1, Z1, 14], [X1, Z3, 14], [X2, Z3, 14],
  [X2, Z3 + 72.5, 20.5], [X2 + 41, Z3 + 72.5, 20.5],   // the hairpin below the town, back up through the car park
  [X2 + 41, Z3, 14], [X3, Z3, 14], [X3, Z2, 14],
  [X3 + 36, Z2, 16], [X3 + 36, Z2 - 32, 16],           // the hairpin round the end of the wall, through the car park
  [X3, Z2 - 32, 14], [X3, Z1, 14],
];
const APEX = [[X2 + 20.5, Z3 + 72.5], [X3 + 36, Z2 - 16]];   // the far end of each hairpin
const CARPARKS = [[446, 144, 486, 184], [275, 342, 315, 382]];   // the two car parks the course runs through
const HALF = 15;      // the usual room each side on a street (the lamp posts stand at 15)
const MARGIN = 6.5;   // how far inside the room the racing line keeps a car's middle

// The walls: [x0, z0, x1, z1, kind ('c' concrete blocks, 't' tyres), dressing]. The dressing faces the course from
// `side` ('f' low z, 'b' high z, 'l' low x, 'r' high x): a sponsor's name, or chevrons ('<' or '>', the way the
// corner goes as the drivers see it).
const WALLS = [
  // north-west corner: shut the north street west and the west street north
  [57, 61, 59, 99, 'c', ['r', '<']], [61, 57, 100, 59, 'c', ['b', 'SCRAP CITY']],
  // the north street straight across the middle street
  [232, 57, 276, 59, 'c', ['b', 'GRIT COLA']], [232, 101, 276, 103, 'c', ['f', 'BOLTZ TYRES']],
  // north-east corner
  [406, 57, 447, 59, 'c', ['b', '<']], [449, 61, 451, 99, 'c', ['l', 'HOT SPARK']],
  // the west street straight across the middle street
  [57, 183, 59, 221, 'c', ['r', 'DENT KINGS']], [101, 183, 103, 221, 'c', ['l', 'ZAPP OIL']],
  // east street and middle street: the middle street west shut, and the wall the second hairpin goes round
  [405, 183, 407, 221, 'c', ['r', 'RUST RACING']], [408, 185, 445, 187, 'c', ['b', '>']],
  // south-west corner
  [57, 305, 59, 343, 'c', ['r', 'GRIT COLA']], [61, 345, 100, 347, 'c', ['f', '<']],
  // the middle street and the south street: shut north, and the wall between the hairpin's two halves
  [232, 301, 276, 303, 'c', ['b', 'SCRAP CITY']], [273, 304, 275, 372, 'c', ['l', '>']],
  // south-east corner
  [449, 305, 451, 343, 'c', ['l', '<']], [406, 345, 447, 347, 'c', ['f', 'BOLTZ TYRES']],
  // the outside of the second hairpin
  [487, 140, 489, 224, 't', ['l', '<']],
  // the kinks: blocks out from alternate kerbs, a little way into the road on the north street (where the pack comes
  // off the grid still two by two) and further on the west street
  [176, 62, 183, 70, 'c'], [136, 90, 143, 98, 'c'], [87, 246, 98, 253, 'c'], [62, 286, 73, 293, 'c'],
];
// temporary stands: [x, z, length, rows, the way the crowd looks, seat colour, sponsor]
const STANDS = [
  [64, 54, 34, 4, 's', 'CAR_B', 'DENT KINGS'], [236, 54, 36, 5, 's', 'CAR_A', 'GRIT COLA'], [455, 64, 32, 4, 'w', 'SIGN', 'ZAPP OIL'],
  [64, 351, 34, 4, 'n', 'AWN_G', 'HOT SPARK'], [410, 351, 34, 4, 'n', 'CAR_A', 'SCRAP CITY'], [494, 150, 50, 3, 'w', 'CAR_B', 'BOLTZ TYRES'],
  [232, 386, 26, 3, 'e', 'SIGN', ''],
];
const SKIN = [M.REND_C, M.WP_A, M.FLOOR, M.TRUNK, M.MUD];
const SHIRT = [M.CAR_A, M.CAR_B, M.TRIM, M.AWN_G, M.SIGN, M.DARK, M.FURN_B, M.PL_Y, M.LIT_Y, M.PL_P, M.AWN_B];

// ---- the course's shape: plain geometry, worked out once ------------------------------------------------------------
let CO = null;
function course() {
  if (!CO) CO = { T: makeTrack({ pts: streetLoop(COURSE), halfW: HALF, smooth: false, WX, WZ, reach: 30 }) };
  return CO;
}

// ---- the rest, once the town and the course are built: the room each side, the racing line, gates and grid -----
let TR = null;
function full() {
  if (TR) return TR;
  const { T } = course(), { N, X, Z, TX, TZ, K, L, STEP } = T;
  // the room to the left and right of each sample: out to the first thing standing at car height (a lamp post too),
  // or the map's edge, a little less on the straights than at the corners, where the crossings are wide
  const blocked = (x, z) => {
    if (x < 8 || z < 8 || x > WX - 8 || z > WZ - 8) return true;
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) { const ix = Math.floor(x + dx), iz = Math.floor(z + dz); if (solid(ix, 2, iz) || solid(ix, 4, iz)) return true; }
    return false;
  };
  const raw = [new Float32Array(N), new Float32Array(N)];
  for (let i = 0; i < N; i++) for (const sd of [0, 1]) {
    const nx = (sd ? -1 : 1) * TZ[i], nz = (sd ? 1 : -1) * TX[i];
    let d = 1; while (d < 26 && !blocked(X[i] + nx * d, Z[i] + nz * d)) d++;
    raw[sd][i] = d - 1;
  }
  const bendy = new Uint8Array(N);
  for (let i = 0; i < N; i++) for (let k = -12; k <= 12; k++) if (Math.abs(K[T.at(i + k)]) > 1 / 60) { bendy[i] = 1; break; }
  const WL = new Float32Array(N), WR = new Float32Array(N);
  for (let i = 0; i < N; i++) for (const [sd, W] of [[0, WL], [1, WR]]) {
    let m = 1e9; for (let k = -4; k <= 4; k++) m = Math.min(m, raw[sd][T.at(i + k)]);
    W[i] = Math.min(m, bendy[i] ? 22 : HALF);
  }
  T.WL = WL; T.WR = WR;
  const lo = new Float32Array(N), hi = new Float32Array(N);
  for (let i = 0; i < N; i++) { lo[i] = -WR[i] + MARGIN; hi[i] = WL[i] - MARGIN; if (lo[i] > hi[i]) lo[i] = hi[i] = (lo[i] + hi[i]) / 2; }
  const line = racingLine(T, { margin: MARGIN, lo, hi });
  // the checkpoint gates, evenly round the lap from the line, but with one at the far end of each hairpin (the nearest
  // gate moves there), so that blasting through the wall down a hairpin's middle doesn't save the trip round it
  const G = 14, gateS = [], gates = [];
  for (let k = 0; k < G; k++) gateS.push(k * L / G);
  for (const [x, z] of APEX) {
    let bi = 0, bd = 1e9; for (let i = 0; i < N; i++) { const d = Math.hypot(X[i] - x, Z[i] - z); if (d < bd) { bd = d; bi = i; } }
    const s = bi * STEP; let k = 1; for (let j = 2; j < G; j++) if (Math.abs(gateS[j] - s) < Math.abs(gateS[k] - s)) k = j;
    gateS[k] = s;
  }
  for (const s of gateS) gates.push(Math.round(s / STEP) % N);
  // the grid behind the line, two by two and staggered, pole on the inside of the first corner (a left)
  const grid = [];
  for (let k = 0; k < 6; k++) {
    const col = k & 1, back = 16 + (k >> 1) * 30 + col * 15, lat = col ? -7 : 7, i = Math.round((L - back) / STEP) % N;
    grid.push({ x: X[i] + TZ[i] * lat, z: Z[i] - TX[i] * lat, yaw: Math.atan2(TX[i], TZ[i]) });
  }
  const gantry = { x: LINE_X, z: Z1, y: 19 };
  const lights = { x: LINE_X + 3.3, y: gantry.y - 2.4, z: Z1, yaw: Math.PI / 2, lx: 0, lz: 1 };   // in front of the lights' box, facing the grid
  TR = { T, P: null, line, gates, gateS, grid, gantry, lights, HALF, PIT_HALF: 0 };
  return TR;
}

// ---- building ----------------------------------------------------------------------------------------------------
// Take a body out of the town (a lamp post or a tree in the way of the course): its voxels go and it counts as gone.
function removeBody(b) {
  for (let y = 0; y <= b.y1; y++) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) {
    const i = idx(x, y, z); if (voxAt(i) && ownerAt(i) === b.id) setCell(i, 0, 0);
  }
  b.count = 0; b.init = 0; b.layers.fill(0); b.carry.fill(0); if (b.layers0) b.layers0.fill(0); if (b.dAbove) b.dAbove.fill(0); b.dead = true;
}
const small = (b) => b && !b.dead && (b.kind === 'prop' || b.kind === 'tree');
// the street furniture and trees standing on the course (and in the car parks it runs through) come out
function clearCourse() {
  const { T } = course(), F = T.field;
  for (const b of bodies) {
    if (!small(b) || b.x1 < 0) continue;
    let d = 1e9;
    for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) { const c = z * WX + x; if (F.near[c] >= 0) d = Math.min(d, F.dist[c]); }
    const inPark = CARPARKS.some(([a, c, e, f]) => b.x0 >= a - 1 && b.x1 <= e + 1 && b.z0 >= c - 1 && b.z1 <= f + 1);
    if (d < 13.5 || (b.kind === 'tree' && d < 22) || inPark) removeBody(b);
  }
}
// and anything small where a wall or a stand is going
function clearRect(x0, z0, x1, z1) {
  for (const b of bodies) if (small(b) && b.x1 >= x0 - 1 && b.x0 <= x1 + 1 && b.z1 >= z0 - 1 && b.z0 <= z1 + 1) removeBody(b);
}
// generateTown() has counted every body's voxels already (finalize in world.js): count the ones added after it the same way
function countFrom(first) {
  for (let id = first; id < bodies.length; id++) {
    const b = bodies[id];
    if (b.x1 >= 0) for (let y = 0; y <= b.y1; y++) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) {
      const i = idx(x, y, z), m = voxAt(i);
      if (m && ownerAt(i) === id) { b.count++; b.layers[y]++; b.carry[y] += CARRY[m]; }
    }
    b.init = b.count; b.layers0 = b.layers.slice(); b.dCarry = b.carry.slice(); b.dAbove = new Float64Array(WY);
    for (let y = WY - 2; y >= 0; y--) b.dAbove[y] = b.dAbove[y + 1] + b.layers[y + 1];
  }
}

// A wall along a box of cells, a body for each 32 voxels of its length (so a rocket only has a small body to work
// over): concrete blocks four high with a red and white top, or tyres stacked four high with a coloured band.
function wall(x0, z0, x1, z1, kind) {
  const alongX = x1 - x0 >= z1 - z0, a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1, w0 = alongX ? z0 : x0, w1 = alongX ? z1 : x1;
  for (let a = a0; a <= a1; a += 32) {
    begin(kind === 't' ? 'Tyre wall' : 'Barrier', 'barrier', false);
    for (let t = a; t <= Math.min(a1, a + 31); t++) for (let w = w0; w <= w1; w++) {
      const x = alongX ? t : w, z = alongX ? w : t;
      if (kind === 't') for (let y = 0; y < 4; y++) put(x, y, z, y === 2 ? [M.TRIM, M.CAR_A, M.TRIM, M.CAR_B][Math.floor(t / 3) & 3] : M.TYRE);
      else { for (let y = 0; y < 4; y++) put(x, y, z, M.CONC); put(x, 4, z, Math.floor(t / 6) & 1 ? M.CAR_A : M.TRIM); }
    }
  }
}
// a board standing on a wall, on its side facing the course: a sponsor's name, or chevrons
function dress(x0, z0, x1, z1, [side, what]) {
  const alongX = side === 'f' || side === 'b', len = alongX ? x1 - x0 + 1 : z1 - z0 + 1, w = Math.min(len - 6, what.length > 1 ? textW(what) + 6 : 26);
  if (w < 8) return;
  const c = alongX ? (x0 + x1) >> 1 : (z0 + z1) >> 1, a0 = c - (w >> 1), a1 = a0 + w - 1;
  // the board stands on the course's edge of the wall, two voxels thick: the face, and a plain back behind it
  const bx0 = alongX ? a0 : side === 'l' ? x0 : x1, bx1 = alongX ? a1 : bx0, bz0 = alongX ? (side === 'f' ? z0 : z1) : a0, bz1 = alongX ? bz0 : a1;
  const [kx, kz] = { l: [1, 0], r: [-1, 0], f: [0, 1], b: [0, -1] }[side], chev = what === '<' || what === '>';
  begin(chev ? 'Chevron board' : 'Sponsor board', 'sign', false);
  for (let y = 5; y <= 12; y++) for (let z = bz0; z <= bz1; z++) for (let x = bx0; x <= bx1; x++) {
    set(x, y, z, chev ? M.DARK : y === 5 || y === 12 ? M.TRIM : M.CAR_B); set(x + kx, y, z + kz, M.DARK);
  }
  const F = face(side, bx0, bz0, bx1, bz1);
  if (chev) {
    for (let u0 = 2; u0 + 5 < F.W - 1; u0 += 6) for (let t = 0; t <= 3; t++) for (const dy of [t, -t]) for (const k of [0, 1]) {
      const u = what === '<' ? u0 + t + k : u0 + 3 - t + k; F.p(u, 8 + dy, 0, M.LIT_Y);
    }
  } else text(F, what, (F.W - textW(what)) >> 1, 6, 0, M.LIT_Y);
}
// the tyre wall round the outside of the first hairpin, below the town
function hairpinTyres() {
  const [x, z, r] = COURSE[4], cx = x + r, cz = z - r;   // the middle of its curve
  begin('Tyre wall', 'barrier', false);
  for (let wz = Math.floor(cz) + 7; wz < WZ - 2; wz++) for (let wx = Math.floor(cx - 40); wx <= Math.ceil(cx + 40); wx++) {
    const d = Math.hypot(wx + 0.5 - cx, wz + 0.5 - cz);
    if (d < 35 || d >= 38) continue;
    for (let y = 0; y < 4; y++) put(wx, y, wz, y === 2 ? [M.TRIM, M.CAR_A, M.TRIM, M.CAR_B][Math.floor((wx + wz) / 3) & 3] : M.TYRE);
  }
}
// The start gantry over the north street at the line: two steel towers on the pavements, a beam with the race's name
// on both faces, and the box the race mode hangs its start lights in front of.
function gantry() {
  const x0 = LINE_X - 1, x1 = LINE_X + 2, z0 = Z1 - 19, z1 = Z1 + 19, y = 19;
  clearRect(x0 - 2, z0, x1 + 2, z1);
  begin('Start gantry', 'gantry', true);
  for (const tz of [z0 + 1, z1 - 3]) {
    for (let yy = 0; yy < y; yy++) for (const [a, b] of [[0, 0], [3, 0], [0, 2], [3, 2]]) set(x0 + a, yy, tz + b, M.STEEL);
    for (let yy = 0; yy < y; yy += 4) { box(x0, yy, tz, x1, yy, tz, M.METAL); box(x0, yy, tz + 2, x1, yy, tz + 2, M.METAL); }
    box(x0 - 1, 0, tz - 1, x1 + 1, 0, tz + 3, M.CONC);
  }
  walls(x0, y, z0, x1, y + 6, z1, M.DARK); box(x0, y + 6, z0, x1, y + 6, z1, M.TRIM);
  const name = 'GRAND PRIX';
  for (const s of ['l', 'r']) { const F = face(s, x0, z0, x1, z1); text(F, name, (F.W - textW(name)) >> 1, y + 1, 0, M.LIT_W); }
  box(x1 - 1, y - 4, Z1 - 13, x1, y - 1, Z1 + 13, M.DARK);
}
// A temporary stand: a steel frame with rows of seats stepping up away from the course, a crowd on most of them, a
// rail along the front and a sponsor's board along the back. (ax, az) is the front corner; it runs `len` along and
// `look` is the way the crowd faces ('w', 'e', 'n' or 's').
function stand(ax, az, len, rows, look, seat, sponsor) {
  const at = (u, v) => (look === 'w' ? [ax + v, az + u] : look === 'e' ? [ax - v, az + u] : look === 'n' ? [ax + u, az + v] : [ax + u, az - v]);
  const S = (u, y, v, m) => { const [x, z] = at(u, v); set(x, y, z, m); };
  const back = 2 * rows + 2, top = 2 * rows + 5;
  { const [xa, za] = at(0, 0), [xb, zb] = at(len - 1, back + 1); clearRect(Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)); }
  for (let u0 = 0; u0 < len; u0 += 30) {
    begin('Stand', 'stand', true);
    for (let u = u0; u < Math.min(len, u0 + 30); u++) {
      const post = u % 6 === 0 || u === len - 1;
      S(u, 3, 0, M.TRIM); if (post) for (let y = 0; y < 3; y++) S(u, y, 0, M.METAL);
      for (let r = 0; r < rows; r++) {
        const h = 2 + 2 * r, v = 2 + 2 * r;
        S(u, h - 1, v, M.METAL); S(u, h - 1, v + 1, M.METAL); S(u, h, v + 1, (u + r) % 9 === 0 ? M.SLAB : seat);
        if (post) for (let y = 0; y < h - 1; y++) S(u, y, v + 1, M.METAL);
        if ((u + r) % 9 !== 0 && rnd() < 0.62) { S(u, h, v, SHIRT[ri(0, SHIRT.length - 1)]); S(u, h + 1, v, SKIN[ri(0, SKIN.length - 1)]); }
      }
      for (let y = post ? 0 : top - 1; y <= top; y++) S(u, y, back + 1, y === top ? M.TRIM : M.METAL);
    }
  }
  if (sponsor && textW(sponsor) + 4 <= len) {
    begin('Stand sign', 'sign', false);
    const w = textW(sponsor), u = (len - w) >> 1;
    for (let uu = u - 2; uu < u + w + 2; uu++) for (let y = top + 1; y <= top + 7; y++) S(uu, y, back + 1, M.DARK);
    const [xa, za] = at(0, back + 1), [xb, zb] = at(len - 1, back + 1);
    const F = face(look === 'w' ? 'l' : look === 'e' ? 'r' : look === 'n' ? 'f' : 'b', Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb));
    text(F, sponsor, (F.W - w) >> 1, top + 2, 1, M.LIT_Y);
  }
}

function build() {
  generateTown();
  const keep = vehicles.filter((v) => v.kind !== 'car' && v.kind !== 'bus' && v.kind !== 'school');
  vehicles.length = 0; vehicles.push(...keep);
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1; setSeed(5151);
  clearCourse();
  const first = bodies.length;
  for (const [x0, z0, x1, z1, kind, dressing] of WALLS) { clearRect(x0, z0, x1, z1); wall(x0, z0, x1, z1, kind); if (dressing) dress(x0, z0, x1, z1, dressing); }
  hairpinTyres();
  gantry();
  for (const [x, z, len, rows, look, seat, sponsor] of STANDS) stand(x, z, len, rows, look, M[seat], sponsor);
  countFrom(first);
}

// ---- the painted ground: the town's, with the course marked on it ----------------------------------------------
let grassy = null;   // the town's grass, a voxel at a time (for surface())
function paint() {
  const { T, grid } = full(), { N, X, Z, TX, TZ, K, WL, WR } = T, cv = groundCanvas(), g = cv.getContext('2d');
  const P = (a, l, i) => [(X[i] + TX[i] * a + TZ[i] * l) * GK, (Z[i] + TZ[i] * a - TX[i] * l) * GK];   // along and across the course at sample i, on the canvas
  const quad = (i, j, l0, l1, col) => {
    const a = P(0, l0, i), b = P(0, l1, i), c = P(0, l1, j), d = P(0, l0, j);
    g.fillStyle = col; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); g.fill();
  };
  g.lineJoin = 'round'; g.lineCap = 'round';
  // the first hairpin runs over the grass below the town: a road laid for the race, with a kerb each side
  const low = []; for (let i = 0; i < N; i++) if (Z[i] > 370 && X[i] > X2 - 30 && X[i] < X2 + 70) low.push(i);
  for (const [w, col] of [[2 * 12 + 1.2, '#eee8da'], [24, '#474b54']]) {
    g.beginPath(); low.forEach((i, k) => (k ? g.lineTo(X[i] * GK, Z[i] * GK) : g.moveTo(X[i] * GK, Z[i] * GK)));
    g.lineWidth = w * GK; g.strokeStyle = col; g.stroke();
  }
  let s = 31; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  for (let n = 0; n < 2400; n++) {
    const i = low[(r() * low.length) | 0], [x, z] = P(0, (r() - 0.5) * 22, i);
    g.fillStyle = r() < 0.5 ? 'rgba(30,32,38,0.24)' : 'rgba(110,114,124,0.15)'; g.fillRect(Math.floor(x / GK) * GK, Math.floor(z / GK) * GK, GK, GK);
  }
  // kerbs, red and white, on the inside of every corner
  for (let i = 0; i < N; i++) {
    if (Math.abs(K[i]) < 1 / 30) continue;
    const side = K[i] > 0 ? 1 : -1, l = side * (Math.min(side > 0 ? WL[i] : WR[i], 11.5) - 0.5), j = T.at(i + 1);
    quad(i, j, l, l - side * 2.4, (i >> 1) & 1 ? '#d8d2c4' : '#c8352c');
  }
  // the start line: a band of chequers across the street, and the grid's boxes behind it
  for (let a = 0; a < 4; a += 2) for (let l = -12; l < 12; l += 2) {
    const [x, z] = P(-a, l, 0); g.fillStyle = ((a + l) >> 1) & 1 ? '#f4f2ea' : '#1c1d21'; g.fillRect(Math.round(x / GK - 1) * GK, Math.round(z / GK - 1) * GK, 2 * GK, 2 * GK);
  }
  g.strokeStyle = 'rgba(244,242,234,0.9)'; g.lineWidth = 0.7 * GK;
  for (const sl of grid) {
    const fx = Math.sin(sl.yaw), fz = Math.cos(sl.yaw), lx = Math.cos(sl.yaw), lz = -Math.sin(sl.yaw), q = (a, l) => [(sl.x + fx * a + lx * l) * GK, (sl.z + fz * a + lz * l) * GK];
    g.beginPath(); g.moveTo(...q(4, -6)); g.lineTo(...q(15, -6)); g.lineTo(...q(15, 6)); g.lineTo(...q(4, 6)); g.stroke();
  }
  // an arrow on the road before each square corner, the way it goes
  g.fillStyle = 'rgba(244,242,234,0.85)'; g.strokeStyle = 'rgba(244,242,234,0.85)'; g.lineWidth = 1.6 * GK;
  for (let i = 0; i < N; i++) {
    const j = T.at(i + 1); if (Math.abs(K[i]) >= 1 / 40 || Math.abs(K[j]) < 1 / 40) continue;   // where a bend starts
    const back = T.at(i - Math.round(34 / T.STEP)), side = K[j] > 0 ? 1 : -1;
    if (Math.abs(K[back]) > 1 / 60) continue;
    g.beginPath(); g.moveTo(...P(-8, 0, back)); g.lineTo(...P(4, 0, back)); g.lineTo(...P(4, side * 5, back)); g.stroke();
    g.beginPath(); g.moveTo(...P(4 + 3, side * 5, back)); g.lineTo(...P(4 - 3, side * 5, back)); g.lineTo(...P(4, side * 9, back)); g.closePath(); g.fill();
  }
  // the grass, read back a voxel at a time
  const sm = document.createElement('canvas'); sm.width = WX; sm.height = WZ;
  const sg = sm.getContext('2d'); sg.drawImage(cv, 0, 0, WX, WZ);
  const D = sg.getImageData(0, 0, WX, WZ).data; grassy = new Uint8Array(WX * WZ);
  for (let c = 0; c < WX * WZ; c++) grassy[c] = D[c * 4 + 1] > D[c * 4] + 12 && D[c * 4 + 1] > D[c * 4 + 2] + 12 ? 1 : 0;
  return cv;
}

// the town and the course on the radar, drawn once
let radarCv = null, radarKey = '';
function radar(R, s, ox, oy, w, h) {
  const key = [s, ox, oy, w, h].join();
  if (!radarCv || key !== radarKey) {
    radarKey = key; radarCv = radarCv || document.createElement('canvas'); radarCv.width = Math.ceil(ox * 2 + w); radarCv.height = Math.ceil(oy * 2 + h);
    const g = radarCv.getContext('2d'), { T } = full();
    g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 24 * s; g.beginPath();
    for (const x of STREET_X) { g.moveTo(ox + x * s, oy); g.lineTo(ox + x * s, oy + h); }
    for (const z of STREET_Z) { g.moveTo(ox, oy + z * s); g.lineTo(ox + w, oy + z * s); }
    g.stroke();
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); T.X.forEach((x, i) => (i ? g.lineTo(ox + x * s, oy + T.Z[i] * s) : g.moveTo(ox + x * s, oy + T.Z[i] * s))); g.closePath();
    g.lineWidth = 22 * s; g.strokeStyle = 'rgba(255,255,255,0.36)'; g.stroke();
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.beginPath();
    g.moveTo(ox + (T.X[0] - T.TZ[0] * 13) * s, oy + (T.Z[0] + T.TX[0] * 13) * s); g.lineTo(ox + (T.X[0] + T.TZ[0] * 13) * s, oy + (T.Z[0] - T.TX[0] * 13) * s); g.stroke();
  }
  R.drawImage(radarCv, 0, 0);
}

export default {
  id: 'race', name: 'Crumbletown Circuit', mode: 'race',
  blurb: 'Three laps round Crumbletown\'s streets: long straights, square corners, two hairpins. Guns on.',
  loading: ['Closing the streets', 'Building the town and lining the course'],
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
  surface(x, z) {
    if (!grassy || !TR) return 0;
    const ix = Math.floor(x), iz = Math.floor(z);
    if (ix < 0 || iz < 0 || ix >= WX || iz >= WZ) return 0.7;
    const c = iz * WX + ix, { T } = TR, i = T.field.near[c];
    if (i >= 0) { const l = T.field.lat[c]; if (l < T.WL[i] + 2 && l > -T.WR[i] - 2) return 0; }
    return grassy[c] ? 0.7 : 0;
  },
  // the course, for the race mode
  get track() { return full(); },
};
