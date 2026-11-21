// Crumbletown Circuit: a street race through Crumbletown, three laps with the guns on (modes/race.js). The town is
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
import { WX, WY, WZ, M, set, put, box, walls, begin, place, ctx, setSeed, rnd, ri, solid, idx, ownerAt, voxAt, setCell, bodies, vehicles, lots, STREET_X, STREET_Z, CARRY } from '../../../src/world.js';
import { generateTown } from '../../../src/town.js';
import { groundCanvas, GK } from '../../../src/ground.js';
import { face, text, textW } from '../../../src/kit.js';
import { pickSpot } from './common.js';
import { makeTrack, streetLoop, racingLine } from './racetrack.js';

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
const SKIN = [M.REND_C, M.WP_A, M.FLOOR, M.TRUNK, M.MUD];
const SHIRT = [M.CAR_A, M.CAR_B, M.TRIM, M.AWN_G, M.SIGN, M.DARK, M.FURN_B, M.PL_Y, M.LIT_Y, M.PL_P, M.AWN_B];

// ---- the course's shape: plain geometry, worked out once ------------------------------------------------------------
let CO = null;
function course() {
  if (!CO) CO = { T: makeTrack({ pts: streetLoop(COURSE), halfW: CAP, smooth: false, WX, WZ, reach: CAP_BEND + 10 }) };
  return CO;
}
// whether something stands at car height at (x, z), or it is past where cars can go at the map's edge
function blocked(x, z) {
  if (x < 8 || z < 8 || x > WX - 8 || z > WZ - 8) return true;
  for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) { const ix = Math.floor(x + dx), iz = Math.floor(z + dz); if (solid(ix, 2, iz) || solid(ix, 4, iz)) return true; }
  return false;
}
// the room from sample i out to one side (0 left, 1 right) to the first thing standing at car height, or the map's edge
function reach(T, i, sd, max = CAP_BEND + 6) {
  const nx = (sd ? -1 : 1) * T.TZ[i], nz = (sd ? 1 : -1) * T.TX[i];
  let d = 1; while (d < max && !blocked(T.X[i] + nx * d, T.Z[i] + nz * d)) d++;
  return d - 1;
}

// ---- the rest, once the town and the course are built: the room each side, the racing line, gates and grid -----
let TR = null;
function full() {
  if (TR) return TR;
  const { T } = course(), { N, X, Z, TX, TZ, K, L, STEP } = T;
  // the room to the left and right of each sample, out to whatever stands there, up to CAP (CAP_BEND in a bend),
  // taken as the least over a few samples either side so that a lamp post or a doorstep counts for a car's length
  const raw = [new Float32Array(N), new Float32Array(N)];
  for (let i = 0; i < N; i++) { raw[0][i] = reach(T, i, 0); raw[1][i] = reach(T, i, 1); }
  const bendy = new Uint8Array(N);
  for (let i = 0; i < N; i++) for (let k = -12; k <= 12; k++) if (Math.abs(K[T.at(i + k)]) > 1 / 90) { bendy[i] = 1; break; }
  const WL = new Float32Array(N), WR = new Float32Array(N);
  for (let i = 0; i < N; i++) for (const [sd, W] of [[0, WL], [1, WR]]) {
    let m = 1e9; for (let k = -4; k <= 4; k++) m = Math.min(m, raw[sd][T.at(i + k)]);
    W[i] = Math.min(m, bendy[i] ? CAP_BEND : CAP);
  }
  // on the inside of a bend, no further than the middle of the curve (past it, across the course means nothing)
  for (let i = 0; i < N; i++) if (K[i]) { const W = K[i] > 0 ? WL : WR; W[i] = Math.min(W[i], 1 / Math.abs(K[i]) - 1); }
  T.WL = WL; T.WR = WR;
  const lo = new Float32Array(N), hi = new Float32Array(N);
  for (let i = 0; i < N; i++) { lo[i] = -WR[i] + MARGIN; hi[i] = WL[i] - MARGIN; if (lo[i] > hi[i]) lo[i] = hi[i] = (lo[i] + hi[i]) / 2; }
  const line = racingLine(T, { margin: MARGIN, lo, hi });
  // the checkpoint gates, evenly round the lap from the line, but with one at the far end of the hairpin (the nearest
  // gate moves there), so that blasting through the wall down the hairpin's middle doesn't save the trip round it
  const G = 14, gateS = [], gates = [];
  for (let k = 0; k < G; k++) gateS.push(k * L / G);
  for (const [x, z] of APEX) {
    let bi = 0, bd = 1e9; for (let i = 0; i < N; i++) { const d = Math.hypot(X[i] - x, Z[i] - z); if (d < bd) { bd = d; bi = i; } }
    const s = bi * STEP; let k = 1; for (let j = 2; j < G; j++) if (Math.abs(gateS[j] - s) < Math.abs(gateS[k] - s)) k = j;
    gateS[k] = s;
  }
  for (const s of gateS) gates.push(Math.round(s / STEP) % N);
  // the grid behind the line, two by two and staggered across the middle of the road, pole on the inside of the
  // first corner (a left)
  const grid = [], mid = (WL[0] - WR[0]) / 2;
  for (let k = 0; k < 6; k++) {
    const col = k & 1, back = 16 + (k >> 1) * 26 + col * 13, lat = mid + (col ? -10 : 10), i = Math.round((L - back) / STEP) % N;
    grid.push({ x: X[i] + TZ[i] * lat, z: Z[i] - TX[i] * lat, yaw: Math.atan2(TX[i], TZ[i]) });
  }
  const gantry = { x: LINE_X, z: NZ + mid, y: 19 };
  const lights = { x: LINE_X + 3.3, y: gantry.y - 2.4, z: NZ + mid, yaw: Math.PI / 2, lx: 0, lz: 1 };   // in front of the lights' box, facing the grid
  TR = { T, P: null, line, gates, gateS, grid, gantry, lights, HALF: CAP, PIT_HALF: 0 };
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
const lotAt = (x, z) => lots.find((l) => l.x === x && l.z === z);
// everything small in a box (street furniture, trees, fences, hedges) comes out
function clearRect(x0, z0, x1, z1) {
  for (const b of bodies) if (small(b) && b.x1 >= x0 - 1 && b.x0 <= x1 + 1 && b.z1 >= z0 - 1 && b.z0 <= z1 + 1) removeBody(b);
}
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
// The start gantry over the north street at the line, from one edge of the course to the other (z0 to z1): two steel
// towers, a beam with the race's name on both faces, and the box the race mode hangs its start lights in front of.
function gantry(z0, z1) {
  const x0 = LINE_X - 1, x1 = LINE_X + 2, y = 19, zc = (z0 + z1) >> 1;
  clearRect(x0 - 2, z0, x1 + 2, z1);
  begin('Start gantry', 'gantry', true);
  for (const tz of [z0, z1 - 2]) {
    for (let yy = 0; yy < y; yy++) for (const [a, b] of [[0, 0], [3, 0], [0, 2], [3, 2]]) set(x0 + a, yy, tz + b, M.STEEL);
    for (let yy = 0; yy < y; yy += 4) { box(x0, yy, tz, x1, yy, tz, M.METAL); box(x0, yy, tz + 2, x1, yy, tz + 2, M.METAL); }
    box(x0 - 1, 0, tz - 1, x1 + 1, 0, tz + 3, M.CONC);
  }
  walls(x0, y, z0, x1, y + 6, z1, M.DARK); box(x0, y + 6, z0, x1, y + 6, z1, M.TRIM);
  for (const s of ['l', 'r']) {
    const F = face(s, x0, z0, x1, z1);
    for (const [name, sc] of [['CRUMBLETOWN GRAND PRIX', 1], ['GRAND PRIX', 1]]) if (textW(name, sc) + 6 <= F.W) { text(F, name, (F.W - textW(name, sc)) >> 1, y + 1, 0, M.LIT_W, sc); break; }
  }
  box(x1 - 1, y - 4, zc - 13, x1, y - 1, zc + 13, M.DARK);
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
  const T = course().T, wl = Math.min(CAP, reach(T, 0, 0)), wr = Math.min(CAP, reach(T, 0, 1));
  gantry(Math.round(NZ - wr) + 2, Math.round(NZ + wl) - 2);   // its feet just inside the kerbs, clear of the buildings
  for (const [x, z, len, rows, look, seat, sponsor] of STANDS) stand(x, z, len, rows, look, M[seat], sponsor);
  countFrom(first);
}

// ---- the painted ground: the town's, opened up, with the course laid over it ----------------------------------
let grassy = null;   // the grass, a voxel at a time (for surface())
function paint() {
  const { T, grid } = full(), { N, X, Z, TX, TZ, K, WL, WR } = T, cv = groundCanvas(), g = cv.getContext('2d');
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
  // the course: asphalt over all its room, a pale kerb along each edge, red and white round the bends. The kerbs go
  // down first, just outside the edges, so that where the inside edge of a tight corner crosses the asphalt of the course
  // either side of it the asphalt covers it
  const P = (a, l, i) => [(X[i] + TX[i] * a + TZ[i] * l) * GK, (Z[i] + TZ[i] * a - TX[i] * l) * GK];   // along and across the course at sample i, on the canvas
  // a piece of the course from sample i to the next, from l0 to l1 across it at i and m0 to m1 at the next
  const quad = (i, l0, l1, m0, m1, col) => {
    const j = T.at(i + 1), a = P(-0.4, l0, i), b = P(-0.4, l1, i), c = P(0.4, m1, j), d = P(0.4, m0, j);
    g.fillStyle = col; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); g.fill();
  };
  const bend = (i) => Math.abs(K[i]) > 1 / 80;
  for (let i = 0; i < N; i++) { const j = T.at(i + 1); quad(i, -WR[i] - 1.4, WL[i] + 1.4, -WR[j] - 1.4, WL[j] + 1.4, '#eee8da'); }
  for (let i = 0; i < N; i++) if (bend(i)) {
    const j = T.at(i + 1), col = (i >> 1) & 1 ? '#d8d2c4' : '#c8352c';
    for (const [sd, w] of [[1, WL], [-1, WR]]) quad(i, sd * (w[i] - 0.2), sd * (w[i] + 2.4), sd * (w[j] - 0.2), sd * (w[j] + 2.4), col);
  }
  for (let i = 0; i < N; i++) { const j = T.at(i + 1); quad(i, -WR[i], WL[i], -WR[j], WL[j], '#474b54'); }
  for (let n = 0; n < N * 70; n++) {
    const i = (r() * N) | 0, [x, z] = P(r() * T.STEP, -WR[i] + r() * (WL[i] + WR[i]), i);
    g.fillStyle = r() < 0.5 ? 'rgba(30,32,38,0.24)' : 'rgba(110,114,124,0.15)'; g.fillRect(Math.floor(x / GK) * GK, Math.floor(z / GK) * GK, GK, GK);
  }
  // the start line: a band of chequers across the course, and the grid's boxes behind it
  for (let a = 0; a < 4; a += 2) for (let l = -Math.floor(WR[0]); l < WL[0] - 1; l += 2) {
    const [x, z] = P(-a, l, 0); g.fillStyle = ((a + l) >> 1) & 1 ? '#f4f2ea' : '#1c1d21'; g.fillRect(Math.round(x / GK - 1) * GK, Math.round(z / GK - 1) * GK, 2 * GK, 2 * GK);
  }
  g.strokeStyle = 'rgba(244,242,234,0.9)'; g.lineWidth = 0.7 * GK;
  for (const sl of grid) {
    const fx = Math.sin(sl.yaw), fz = Math.cos(sl.yaw), lx = Math.cos(sl.yaw), lz = -Math.sin(sl.yaw), q = (a, l) => [(sl.x + fx * a + lx * l) * GK, (sl.z + fz * a + lz * l) * GK];
    g.beginPath(); g.moveTo(...q(4, -6)); g.lineTo(...q(15, -6)); g.lineTo(...q(15, 6)); g.lineTo(...q(4, 6)); g.stroke();
  }
  // an arrow on the road before each corner, the way it goes
  g.fillStyle = 'rgba(244,242,234,0.85)'; g.strokeStyle = 'rgba(244,242,234,0.85)'; g.lineWidth = 1.6 * GK;
  for (let i = 0; i < N; i++) {
    const j = T.at(i + 1); if (Math.abs(K[i]) >= 1 / 70 || Math.abs(K[j]) < 1 / 70) continue;   // where a bend starts
    const back = T.at(i - Math.round(40 / T.STEP)), side = K[j] > 0 ? 1 : -1;
    if (Math.abs(K[back]) > 1 / 90) continue;
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
    const g = radarCv.getContext('2d'), { T } = full(), { N, X, Z, TX, TZ, WL, WR } = T;
    g.clearRect(0, 0, radarCv.width, radarCv.height);
    g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 24 * s; g.beginPath();
    for (const x of STREET_X) { g.moveTo(ox + x * s, oy); g.lineTo(ox + x * s, oy + h); }
    for (const z of STREET_Z) { g.moveTo(ox, oy + z * s); g.lineTo(ox + w, oy + z * s); }
    g.stroke();
    // the course as it is: its whole width, sample by sample
    const P = (a, l, i) => [ox + (X[i] + TX[i] * a + TZ[i] * l) * s, oy + (Z[i] + TZ[i] * a - TX[i] * l) * s];
    g.fillStyle = 'rgba(255,255,255,0.34)';
    for (let i = 0; i < N; i++) {
      const j = T.at(i + 1), a = P(-0.5, -WR[i], i), b = P(-0.5, WL[i], i), c = P(0.5, WL[j], j), d = P(0.5, -WR[j], j);
      g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); g.fill();
    }
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.moveTo(...P(0, -WR[0], 0)); g.lineTo(...P(0, WL[0], 0)); g.stroke();
  }
  R.drawImage(radarCv, 0, 0);
}

export default {
  id: 'race', name: 'Crumbletown Circuit', mode: 'race',
  blurb: 'Three laps round Crumbletown, opened up for the race: long straights, fast sweeps, a hairpin. Guns on.',
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
