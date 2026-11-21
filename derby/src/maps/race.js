// Bowtie Raceway: a figure-of-eight circuit that fills the map, raced three laps with the guns on (modes/race.js).
// The lap starts on the long straight down the east side under the start gantry, brakes into a right-hander at the
// bottom, sweeps up the diagonal to the crossover in the middle of the map, climbs to a hairpin at the top left,
// snakes down the west side through a chicane, swings round the bottom left and back up the other diagonal to cross
// the first one at grade, then sweeps round the top right onto the straight. The two halves of the track meet nearly
// square at the crossover, flat out both ways.
//
// The shape is a loop of control points (PTS) made into a road by racetrack.js; everything else is worked out from
// it: the barriers (concrete walls, with tyre walls round the outside of the corners, all 'barrier' bodies that cars
// bounce off), the gravel traps and grass (slow, see surface()), the paint, the radar and what the race mode needs
// (the racing line, the checkpoint gates, the starting grid). Round the outside: the main grandstand, a pit lane with
// its garages and race control, stands at the crossover, light towers, sponsor boards, marshal posts and trees.
import { WX, WZ, M, set, box, walls, begin, place, ctx, setSeed, rnd, ri } from '../../../src/world.js';
import { face, text, textW, tree, lampPost, bench, bin } from '../../../src/kit.js';
import { canvasFor, finish, pickSpot } from './common.js';
import { makeTrack, findCrossings, racingLine } from './racetrack.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const HALF = 22, PIT_HALF = 8;   // half the width of the track and of the pit lane
// the centre line, from the start line (heading south down the east side) round the lap
const PTS = [[449, 195], [449, 250], [449, 300], [437, 352], [409, 364], [392, 360], [379, 351], [305, 288], [279, 241], [250, 208], [221, 175], [190, 148], [156, 118], [146, 92], [136, 60], [112, 40], [86, 40], [66, 60], [62, 100], [62, 150], [66, 172], [102, 192], [102, 210], [66, 230], [58, 252], [52, 300], [63, 352], [91, 364], [108, 360], [121, 351], [177, 272], [221, 241], [250, 208], [279, 175], [305, 129], [379, 65], [392, 56], [409, 52], [437, 64], [449, 92], [449, 140]];
// the pit lane: off the inside of the straight after the last corner, back on before the first
const PIT = [[441, 108], [426, 124], [411, 142], [410, 160], [410, 240], [413, 258], [428, 276], [443, 292]];
const GAR = { x0: 374, x1: 401, z0: 150, z1: 249, bays: 5 };   // the garages, facing the pit lane
const PADDOCK = [338, 116, 402, 284];
const ROUGH = [0, 0.7, 1];   // how much each kind of ground holds a car back: road, grass, gravel

// ---- the circuit, worked out once (only for this map: the other maps never pay for it) -----------------------------
let TR = null;
function track() {
  if (TR) return TR;
  const T = makeTrack({ pts: PTS, halfW: HALF, WX, WZ, reach: 70 });
  const P = makeTrack({ pts: PIT, halfW: PIT_HALF, WX, WZ, reach: 16, closed: false });
  const line = racingLine(T, { margin: 7 });
  const cross = findCrossings(T);
  const { N, X, Z, TX, TZ, K, STEP, L } = T;
  // how much room each side of the track gets before its barrier: a little on the inside of a bend, more on a
  // straight, and a gravel trap on the outside of a corner (less where the map's edge is close)
  const Ks = new Float32Array(N);
  for (let i = 0; i < N; i++) { let s = 0; for (let k = -12; k <= 12; k++) s += K[T.at(i + k)]; Ks[i] = s / 25; }
  const db = [new Float32Array(N), new Float32Array(N)], trap = [new Uint8Array(N), new Uint8Array(N)];   // [left, right]
  for (let i = 0; i < N; i++) for (const sd of [0, 1]) {
    const side = sd ? -1 : 1, k = Ks[i], inside = Math.abs(k) > 1 / 400 && Math.sign(k) === side;
    const run = inside ? 6 : 8 + clamp((Math.abs(k) - 1 / 300) * 900, 0, 14);
    const nx = side * TZ[i], nz = -side * TX[i];
    const room = Math.min(nx > 1e-3 ? (WX - X[i]) / nx : nx < -1e-3 ? X[i] / -nx : 1e9, nz > 1e-3 ? (WZ - Z[i]) / nz : nz < -1e-3 ? Z[i] / -nz : 1e9);
    db[sd][i] = Math.min(HALF + run, room - 7); trap[sd][i] = !inside && run > 12 ? 1 : 0;
  }
  // every voxel of the map: what the ground is (0 road, 1 grass, 2 gravel) and what wall stands there
  // (1 concrete, 2 tyres, 3 the pit lane's walls)
  const surf = new Uint8Array(WX * WZ).fill(1), wall = new Uint8Array(WX * WZ), F = T.field, PF = P.field;
  const garage = (x, z) => x >= GAR.x0 - 2 && x < 410 && z >= GAR.z0 && z <= GAR.z1;
  for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++) {
    const c = z * WX + x, d = F.dist[c], i = F.near[c], dp = PF.dist[c];
    if (i >= 0) {
      const sd = F.lat[c] >= 0 ? 0 : 1, b = db[sd][i], thick = trap[sd][i] ? 3 : 2;
      if (d >= b && d < b + thick && dp > PIT_HALF + 2.5) wall[c] = trap[sd][i] ? 2 : 1;
      else if (d < b && trap[sd][i]) surf[c] = 2;
      if (d < HALF + 2) surf[c] = 0;
      if (d >= b + 3 && x >= PADDOCK[0] && x <= PADDOCK[2] && z >= PADDOCK[1] && z <= PADDOCK[3]) surf[c] = 0;
    }
    if (dp < PIT_HALF + 1) surf[c] = 0;
    if (dp >= PIT_HALF + 0.5 && dp < PIT_HALF + 2.5 && d > HALF + 3 && !garage(x, z)) wall[c] = 3;
  }
  // the checkpoint gates: evenly round the lap, but not in the crossover (a car put back there would be in the way)
  const G = 14, gateS = [], crossS = cross.flatMap(([a, b]) => [a * STEP, b * STEP]);
  const wrapS = (d) => d - Math.round(d / L) * L;
  for (let k = 0; k < G; k++) {
    let s = k * L / G;
    for (const cs of crossS) { const dd = wrapS(s - cs); if (Math.abs(dd) < 70) s = cs + (dd < 0 ? -70 : 70); }
    gateS.push(((s % L) + L) % L);
  }
  const gates = gateS.map((s) => Math.round(s / STEP) % N);
  // the starting grid behind the line, two by two and staggered, pole on the inside of the first corner (the right)
  const grid = [];
  for (let k = 0; k < 6; k++) {
    const col = k & 1, back = 16 + (k >> 1) * 30 + col * 15, lat = col ? 10 : -10, i = Math.round((L - back) / STEP) % N;
    grid.push({ x: X[i] + TZ[i] * lat, z: Z[i] - TX[i] * lat, yaw: Math.atan2(TX[i], TZ[i]) });
  }
  // the start gantry spans the track and the pit lane at the line
  const gantry = { x0: Math.round(X[0]) - 31, x1: Math.round(X[0]) + 32, z: Math.round(Z[0]), y: 19 };
  TR = { T, P, line, cross, db, trap, surf, wall, gates, gateS, grid, gantry, HALF, PIT_HALF, garage: GAR };
  return TR;
}

// ---- building ----------------------------------------------------------------------------------------------------
const SKIN = [M.REND_C, M.WP_A, M.FLOOR, M.TRUNK, M.MUD];
const SHIRT = [M.CAR_A, M.CAR_B, M.TRIM, M.AWN_G, M.SIGN, M.DARK, M.FURN_B, M.PL_Y, M.LIT_Y, M.PL_P, M.AWN_B];
// the ground the scenery has taken so far (x0, z0, x1, z1), so that nothing else goes there
let taken = [];
const take = (x0, z0, x1, z1) => { taken.push([x0, z0, x1, z1]); };
// is the ground under this box clear of the track, its run-off, its walls, the pit lane and the scenery so far?
function clear(x0, z0, x1, z1, pad = 3) {
  const { T, P, db, wall } = track();
  for (const [a, b, c, d] of taken) if (x1 + pad >= a && x0 - pad <= c && z1 + pad >= b && z0 - pad <= d) return false;
  for (let z = Math.max(0, z0 - pad); z <= Math.min(WZ - 1, z1 + pad); z++) for (let x = Math.max(0, x0 - pad); x <= Math.min(WX - 1, x1 + pad); x++) {
    const c = z * WX + x, i = T.field.near[c];
    if (wall[c] || P.field.dist[c] < PIT_HALF + 3) return false;
    if (i >= 0 && T.field.dist[c] < db[T.field.lat[c] >= 0 ? 0 : 1][i] + 2) return false;
  }
  return x0 >= 3 && z0 >= 3 && x1 < WX - 3 && z1 < WZ - 3;
}

// The barriers: the wall cells, a body for each 32-voxel square of the map (so a rocket's hit only has a small body to
// work over). Concrete walls are four voxels high with a red and white cap; tyre walls are three deep, banded.
function barriers() {
  const { wall, T, P } = track(), TILE = 32, F = T.field;
  for (let tz = 0; tz < WZ; tz += TILE) for (let tx = 0; tx < WX; tx += TILE) for (const kind of [1, 2, 3]) {
    let open = false;
    for (let z = tz; z < Math.min(WZ, tz + TILE); z++) for (let x = tx; x < Math.min(WX, tx + TILE); x++) {
      const c = z * WX + x; if (wall[c] !== kind) continue;
      if (!open) { open = true; begin(kind === 2 ? 'Tyre wall' : kind === 3 ? 'Pit wall' : 'Barrier', 'barrier', false); }
      const along = kind === 3 ? (P.field.near[c] * P.STEP) : (F.near[c] * T.STEP);
      if (kind === 2) {
        const band = [M.TRIM, M.CAR_A, M.TRIM, M.CAR_B][Math.floor(along / 3) & 3];
        for (let y = 0; y < 4; y++) set(x, y, z, y === 2 ? band : M.TYRE);
      } else {
        for (let y = 0; y < 4; y++) set(x, y, z, M.CONC);
        set(x, 4, z, Math.floor(along / 8) & 1 ? M.CAR_A : M.TRIM);
      }
    }
  }
}

// The start gantry: two steel towers and a beam over the track and the pit lane at the line, the circuit's name on it
// both ways, and the box the start lights hang from (the race mode lights them).
function gantry() {
  const { x0, x1, z, y } = track().gantry;
  begin('Start gantry', 'gantry', true);
  for (const px of [x0, x1]) {
    for (let yy = 0; yy < y; yy++) for (const [a, b] of [[0, 0], [2, 0], [0, 3], [2, 3]]) set(px + a, yy, z - 1 + b, M.STEEL);
    for (let yy = 0; yy < y; yy += 4) { box(px, yy, z - 1, px + 2, yy, z - 1, M.METAL); box(px, yy, z + 2, px + 2, yy, z + 2, M.METAL); box(px, yy, z - 1, px, yy, z + 2, M.METAL); box(px + 2, yy, z - 1, px + 2, yy, z + 2, M.METAL); }
    box(px - 1, 0, z - 2, px + 3, 0, z + 3, M.CONC);
  }
  walls(x0, y, z - 1, x1 + 2, y + 6, z + 2, M.DARK);
  box(x0, y, z - 1, x1 + 2, y, z + 2, M.DARK); box(x0, y + 6, z - 1, x1 + 2, y + 6, z + 2, M.TRIM);
  const name = 'BOWTIE RACEWAY', w = textW(name);
  for (const s of ['f', 'b']) { const F = face(s, x0, z - 1, x1 + 2, z + 2); text(F, name, ((F.W - w) >> 1), y + 1, 0, M.LIT_W); }
  // the lights' box, over the middle of the track
  const cx = Math.round(track().T.X[0]);
  box(cx - 13, y - 4, z - 1, cx + 13, y - 1, z, M.DARK);
}

// A grandstand: rows of seats stepping up away from the track, spectators on most of them, a parapet at the front, a
// back wall and a roof over the back rows with a sponsor on its edge. (ax, az) is the front corner; the stand runs `len`
// along the track, and `look` is the way the crowd faces: 'w', 'e', 'n' or 's'. A body for each 30 along.
function stand(ax, az, len, rows, look, seat, sponsor) {
  const at = (u, v) => (look === 'w' ? [ax + v, az + u] : look === 'e' ? [ax - v, az + u] : look === 'n' ? [ax + u, az + v] : [ax + u, az - v]);
  const S = (u, y, v, m) => { const [x, z] = at(u, v); set(x, y, z, m); };
  const back = 2 * rows + 2, top = 3 + 2 * rows + 8;
  { const [x0, z0] = at(0, 0), [x1, z1] = at(len - 1, back + 1); take(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)); }
  for (let u0 = 0; u0 < len; u0 += 30) {
    begin('Grandstand', 'stand', true);
    for (let u = u0; u < Math.min(len, u0 + 30); u++) {
      for (let y = 0; y < 4; y++) { S(u, y, 0, M.CONC); S(u, y, 1, M.CONC); }
      S(u, 4, 0, M.TRIM); S(u, 4, 1, M.TRIM);
      const rib = u % 10 === 0 || u === len - 1;
      for (let r = 0; r < rows; r++) {
        const h = 3 + 2 * r, v = 2 + 2 * r;
        S(u, h - 1, v, M.CONC); S(u, h - 1, v + 1, M.CONC); S(u, h, v + 1, (u + r) % 9 === 0 ? M.SLAB : seat);
        if (rib) for (let y = 0; y < h - 1; y++) { S(u, y, v, M.CONC); S(u, y, v + 1, M.CONC); }
        // a spectator in front of most seats
        if ((u + r) % 9 !== 0 && rnd() < 0.62) { S(u, h, v, SHIRT[ri(0, SHIRT.length - 1)]); S(u, h + 1, v, SKIN[ri(0, SKIN.length - 1)]); }
      }
      for (let y = 0; y <= top; y++) S(u, y, back + 1, y === top ? M.TRIM : M.CONC);
      for (let v = back - 9; v <= back + 1; v++) S(u, top, v, M.ROOF_S);
      for (let y = top - 3; y < top; y++) S(u, y, back - 9, M.TRIM);
    }
  }
  // the sponsor along the roof's edge, facing the track
  if (sponsor) {
    begin('Stand sign', 'sign', false);
    const w = textW(sponsor), u = Math.max(1, (len - w) >> 1), v = back - 9;
    const [x0, z0] = at(0, v), [x1, z1] = at(len - 1, v);
    const F = face(look === 'w' ? 'l' : look === 'e' ? 'r' : look === 'n' ? 'f' : 'b', Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1));
    F.box(u - 2, top - 9, u + w + 1, top - 3, 1, 1, M.DARK);
    text(F, sponsor, u, top - 8, 1, M.LIT_Y);
  }
}

// The pits: a row of garages opening onto the pit lane, race control at the north end, and the paddock behind
const TEAMS = [['RUST', M.CAR_A], ['ZAP', M.SIGN], ['GRIT', M.CAR_B], ['BOLT', M.AWN_G], ['DENT', M.LIT_Y]];
function pits() {
  const g = GAR, bay = Math.floor((g.z1 - g.z0 + 1) / g.bays), H = 15;
  for (let k = 0; k < g.bays; k++) {
    const z0 = g.z0 + k * bay, z1 = z0 + bay - 1, [name, col] = TEAMS[k % TEAMS.length];
    begin('Garage', 'garage', true);
    walls(g.x0, 0, z0, g.x1, H, z1, M.CONC);
    box(g.x0, H, z0, g.x1, H, z1, M.ROOF_S);
    const F = face('r', g.x0, z0, g.x1, z1);
    // the door onto the pit lane: some open, some shut
    const open = k % 2 === 0;
    for (let u = 3; u < F.W - 3; u++) for (let y = 0; y < 10; y++) { if (open) F.c(u, y, 0); else F.p(u, y, 0, y % 2 ? M.METAL : M.STEEL); }
    if (open) {
      for (let z = z0 + 1; z < z1; z++) for (let y = 0; y < 2; y++) set(g.x0 + 1, y + 4, z, M.DARK);   // a bench along the back
      box(g.x0 + 2, 0, z0 + 2, g.x0 + 4, 4, z0 + 5, col); box(g.x0 + 2, 0, z1 - 5, g.x0 + 4, 4, z1 - 2, col);   // tool chests
      for (let y = 0; y < 8; y += 2) box(g.x0 + 1, y, z0 + 8, g.x0 + 3, y + 1, z0 + 10, M.TYRE);   // tyres racked up
    }
    // the team's colours and name over the door
    F.box(0, 11, F.W - 1, H, 1, 1, col);
    const w = textW(name); if (w <= F.W) text(F, name, (F.W - w) >> 1, 11, 1, M.TRIM);
  }
  // race control: a tower with a glass top looking down the straight
  const rx0 = 380, rx1 = 400, rz0 = 128, rz1 = 146, top = 34;
  begin('Race control', 'tower', true);
  walls(rx0, 0, rz0, rx1, top - 10, rz1, M.REND_C);
  for (const y of [9, 18]) box(rx0 + 1, y, rz0 + 1, rx1 - 1, y, rz1 - 1, M.SLAB);
  walls(rx0 - 1, top - 9, rz0 - 1, rx1 + 1, top - 2, rz1 + 1, M.GLASS);
  for (const [a, b] of [[rx0 - 1, rz0 - 1], [rx1 + 1, rz0 - 1], [rx0 - 1, rz1 + 1], [rx1 + 1, rz1 + 1]]) box(a, top - 9, b, a, top - 2, b, M.DARK);
  box(rx0 - 2, top - 10, rz0 - 2, rx1 + 2, top - 10, rz1 + 2, M.TRIM); box(rx0 - 2, top - 1, rz0 - 2, rx1 + 2, top - 1, rz1 + 2, M.TRIM);
  box(rx0 + 8, top, rz0 + 8, rx0 + 9, top + 12, rz0 + 9, M.DARK); set(rx0 + 8, top + 13, rz0 + 8, M.LIT_R);
  const Fr = face('r', rx0, rz0, rx1, rz1);
  for (const y of [3, 12]) for (let u = 2; u < Fr.W - 2; u += 5) Fr.box(u, y, u + 2, y + 3, 0, 0, M.GLASS);
  text(Fr, 'RACE', (Fr.W - textW('RACE')) >> 1, 18, 1, M.CAR_A);
  // the paddock: the teams' trucks, a hospitality awning, lamps, and fuel drums that go up if they're hit
  for (let k = 0; k < 4; k++) {
    const tz = 156 + k * 24, tx = 352;
    if (!clear(tx - 4, tz, tx + 4, tz + 18, 1)) continue;
    begin('Team truck', 'shed', false);
    box(tx - 4, 1, tz, tx + 4, 10, tz + 14, TEAMS[k][1]); box(tx - 4, 1, tz + 15, tx + 4, 8, tz + 19, M.TRIM);
    box(tx - 3, 5, tz + 19, tx + 3, 7, tz + 19, M.GLASS);
    for (const zz of [tz + 2, tz + 10, tz + 16]) { box(tx - 5, 0, zz, tx - 5, 1, zz + 1, M.TYRE); box(tx + 5, 0, zz, tx + 5, 1, zz + 1, M.TYRE); }
    const F = face('r', tx - 4, tz, tx + 4, tz + 14), w = textW(TEAMS[k][0]);
    if (w <= 15) text(F, TEAMS[k][0], (F.W - w) >> 1, 4, 1, M.TRIM);
  }
  if (clear(340, 250, 368, 266, 1)) {
    begin('Hospitality', 'shed', false);
    for (const [a, b] of [[340, 250], [368, 250], [340, 266], [368, 266]]) box(a, 0, b, a, 9, b, M.TRIM);
    for (let x = 339; x <= 369; x++) for (let z = 249; z <= 267; z++) set(x, 10, z, ((x >> 2) & 1) ? M.AWN_R : M.AWN_W);
  }
  for (const [x, z] of [[370, 120], [370, 280], [344, 140]]) if (clear(x - 1, z - 5, x + 1, z + 1, 0)) lampPost(x, z, 22);
  for (const [x, z] of [[GAR.x0 - 6, 168], [GAR.x0 - 6, 212], [404, 262]]) {
    if (!clear(x, z, x + 4, z + 4, 0) && !(x > 400)) continue;
    const p = begin('Fuel drums', 'prop', false); p.explosive = 7;
    for (const [a, b] of [[0, 0], [2, 0], [0, 2], [2, 2]]) box(x + a, 0, z + b, x + a + 1, 2, z + b + 1, (a + b) & 2 ? M.FUEL : M.CAR_B);
  }
}

// light towers: a steel mast with a bank of lamps on top, turned to the track
function lightTower(x, z, toward) {
  take(x - 2, z - 2, x + 3, z + 3);
  begin('Light tower', 'tower', true);
  box(x - 2, 0, z - 2, x + 2, 1, z + 2, M.CONC);
  for (let y = 2; y < 56; y++) { set(x, y, z, M.STEEL); set(x + 1, y, z, M.STEEL); set(x, y, z + 1, M.STEEL); set(x + 1, y, z + 1, M.STEEL); }
  const [dx, dz] = toward, along = Math.abs(dx) > Math.abs(dz);
  for (let a = -5; a <= 5; a++) for (let y = 56; y <= 62; y++) {
    const px = along ? x + Math.sign(dx) : x + a, pz = along ? z + a : z + Math.sign(dz);
    const edge = a === -5 || a === 5 || y === 56 || y === 62;
    set(px, y, pz, edge ? M.DARK : M.STEEL);
    if (!edge) set(px + (along ? Math.sign(dx) : 0), y, pz + (along ? 0 : Math.sign(dz)), (a + y) & 1 ? M.LIT_W : M.LIT_Y);
  }
}

// a sponsor board on two legs (or standing on a wall), its face to one side ('f' faces low z, 'b' high z, 'l' low x,
// 'r' high x)
function board(x0, z0, x1, z1, side, words, bg, fg, onWall = false) {
  take(x0, z0, x1, z1);
  begin('Sponsor board', 'sign', false);
  const legs = onWall ? [] : side === 'f' || side === 'b' ? [[x0, z0], [x1, z0]] : [[x0, z0], [x0, z1]];
  for (const [a, b] of legs) box(a, 0, b, a, 4, b, M.DARK);
  box(x0, 5, z0, x1, 13, z1, bg);
  const F = face(side, x0, z0, x1, z1), w = textW(words);
  if (w <= F.W - 2) text(F, words, (F.W - w) >> 1, 7, 0, fg);
}

// a marshal's hut by the barrier, with a flag on a pole
function marshal(x, z) {
  if (!clear(x, z, x + 6, z + 6, 0)) return;
  take(x - 1, z - 1, x + 12, z + 7);
  begin('Marshal post', 'hut', false);
  walls(x, 0, z, x + 6, 7, z + 6, M.TRIM); box(x - 1, 8, z - 1, x + 7, 8, z + 7, M.ROOF_R);
  for (const F of [face('f', x, z, x + 6, z + 6), face('b', x, z, x + 6, z + 6)]) F.box(1, 4, 5, 6, 0, 0, M.GLASS);
  box(x + 8, 0, z + 3, x + 8, 13, z + 3, M.DARK); box(x + 9, 10, z + 3, x + 12, 13, z + 3, M.LIT_Y);
}

function scenery() {
  const { T } = track();
  taken = [[205, 366, 300, 398]];   // the circuit's name, mown into the grass (paint)
  // the main grandstand along the outside of the straight, a stand each side of the crossover looking down on it
  stand(485, 112, 180, 10, 'w', M.CAR_B, 'GRIT COLA');
  if (clear(210, 98, 265, 117, 0)) stand(210, 117, 56, 8, 's', M.CAR_A, 'ZAPP OIL');
  if (clear(205, 292, 260, 311, 0)) stand(205, 292, 56, 8, 'n', M.SIGN, 'BOLTZ TYRES');
  // light towers round the circuit, each turned to the nearest track
  for (const [x, z] of [[340, 96], [365, 300], [150, 210], [160, 300], [250, 60], [250, 360], [24, 24], [24, 392], [496, 20], [496, 396], [300, 210], [200, 30]]) {
    if (!clear(x - 3, z - 3, x + 4, z + 4, 2)) continue;
    const p = T.project(x, z), dx = T.X[p.i] - x, dz = T.Z[p.i] - z;
    lightTower(x, z, Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)]);
  }
  // sponsor boards on the pit wall, facing the straight, and along the outside of the west side
  const brand = [['DENT KINGS', M.DARK, M.LIT_Y], ['SCRAP CITY', M.CAR_A, M.TRIM], ['HOT SPARK', M.LIT_Y, M.DARK], ['GRIT COLA', M.CAR_A, M.TRIM], ['BOLTZ TYRES', M.DARK, M.TRIM]];
  [160, 222].forEach((z, k) => { const [w, bg, fg] = brand[k]; board(418, z, 419, z + 44, 'r', w, bg, fg, true); });
  [80, 270, 320].forEach((z, k) => { const [w, bg, fg] = brand[k + 2]; if (clear(14, z, 16, z + 44, 0)) board(14, z, 16, z + 44, 'r', w, bg, fg); });
  // marshal posts at the corners
  for (const [x, z] of [[470, 380], [30, 380], [24, 140], [182, 64], [470, 30], [120, 160], [330, 380]]) marshal(x, z);
  // trees in the infields and round the edges, keeping clear of the track and each other
  const trees = [];
  for (let n = 0; n < 900 && trees.length < 46; n++) {
    const x = ri(8, WX - 10), z = ri(8, WZ - 10);
    if (x > PADDOCK[0] - 6 && x < PADDOCK[2] + 6 && z > PADDOCK[1] - 6 && z < PADDOCK[3] + 6) continue;
    if (trees.some(([a, b]) => Math.hypot(a - x, b - z) < 16) || !clear(x - 6, z - 6, x + 7, z + 7, 1)) continue;
    trees.push([x, z]); take(x - 4, z - 4, x + 4, z + 4); tree(x, z, ri(10, 15), ri(5, 7));
  }
  // benches and bins behind the stands, cones at the pit lane's mouths
  for (let z = 120; z < 290; z += 34) { if (clear(509, z, 511, z + 2, 0)) bin(509, z); }
  for (const [x, z] of [[226, 82], [262, 82], [226, 332], [262, 332]]) { if (clear(x, z, x + 8, z + 3, 0)) bench(x, z); }
  for (let k = 0; k < 8; k++) { const x = 343 + (k % 4) * 5, z = 118 + (k >> 2) * 150; if (!clear(x, z, x, z, 0)) continue; begin('Cone', 'prop', false); set(x, 0, z, M.SIGN); set(x, 1, z, M.TRIM); set(x, 2, z, M.SIGN); }
}

// ---- the painted ground ------------------------------------------------------------------------------------------
function strokePath(g, xs, zs, GK, closed) {
  g.beginPath(); g.moveTo(xs[0] * GK, zs[0] * GK);
  for (let i = 1; i < xs.length; i++) g.lineTo(xs[i] * GK, zs[i] * GK);
  if (closed) g.closePath();
}
function paint() {
  const { T, P, line, surf, cross, grid, gates, garage } = track();
  const c = canvasFor('#6f9e58', 91), { g, GK } = c;
  // the ground under everything, a voxel at a time: mown grass in stripes, gravel, the paddock's concrete
  const small = document.createElement('canvas'); small.width = WX; small.height = WZ;
  const sg = small.getContext('2d'), img = sg.createImageData(WX, WZ), D = img.data;
  const hash = (x, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++) {
    const k = z * WX + x, s = surf[k], n = hash(x, z), j = (n - 0.5) * 0.12;
    let r, gg, b;
    if (s === 1) { const stripe = ((x + z) >> 4) & 1; r = stripe ? 104 : 116; gg = stripe ? 156 : 168; b = stripe ? 84 : 92; if (n > 0.92) { r += 22; gg += 16; } }
    else if (s === 2) { r = 196; gg = 176; b = 138; if (n > 0.8) { r -= 40; gg -= 40; b -= 36; } else if (n < 0.1) { r += 20; gg += 18; b += 16; } }
    else { r = 172; gg = 168; b = 158; if (n > 0.9) { r -= 26; gg -= 26; b -= 24; } }
    D[k * 4] = r * (1 + j); D[k * 4 + 1] = gg * (1 + j); D[k * 4 + 2] = b * (1 + j); D[k * 4 + 3] = 255;
  }
  sg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = false; g.drawImage(small, 0, 0, WX * GK, WZ * GK);
  // the circuit's name mown into the infield
  g.save(); g.translate(252 * GK, 391 * GK); g.rotate(-0.03); g.font = `900 ${20 * GK}px system-ui, sans-serif`; g.textAlign = 'center';
  g.fillStyle = 'rgba(240,244,226,0.32)'; g.fillText('BOWTIE', 0, 0); g.restore();
  g.lineJoin = 'round'; g.lineCap = 'round';
  // the pit lane and the track: asphalt, flecked a voxel at a time
  strokePath(g, P.X, P.Z, GK, false); g.lineWidth = 2 * PIT_HALF * GK; g.strokeStyle = '#53575f'; g.stroke();
  strokePath(g, T.X, T.Z, GK, true); g.lineWidth = 2 * HALF * GK; g.strokeStyle = '#4a4e57'; g.stroke();
  for (let n = 0; n < 60000; n++) {
    const x = Math.floor(c.r() * WX), z = Math.floor(c.r() * WZ), k = z * WX + x;
    if (T.field.dist[k] > HALF - 0.5 && P.field.dist[k] > PIT_HALF - 0.5) continue;
    g.fillStyle = c.r() < 0.5 ? 'rgba(28,30,36,0.28)' : 'rgba(120,124,132,0.16)'; c.rect(x, z, x + 1, z + 1);
  }
  // rubber laid down along the racing line
  const lx = [], lz = []; for (let i = 0; i < T.N; i++) { lx.push(line.px[i]); lz.push(line.pz[i]); }
  strokePath(g, lx, lz, GK, true); g.lineWidth = 8 * GK; g.strokeStyle = 'rgba(22,22,26,0.16)'; g.stroke();
  // white lines down both edges, and red and white kerbs where the track bends
  const off = (i, lat) => [T.X[i] + T.TZ[i] * lat, T.Z[i] - T.TX[i] * lat];
  const kerb = (i) => Math.abs(T.K[i]) > 1 / 120;
  for (const side of [1, -1]) {
    g.beginPath(); let on = false;
    for (let i = 0; i <= T.N; i++) {
      const k = i % T.N; if (kerb(k)) { on = false; continue; }
      const [x, z] = off(k, side * (HALF - 1.2)); if (!on) { g.moveTo(x * GK, z * GK); on = true; } else g.lineTo(x * GK, z * GK);
    }
    g.lineWidth = 0.7 * GK; g.strokeStyle = '#e9e6dc'; g.stroke();
    for (let i = 0; i < T.N; i++) {
      if (!kerb(i) && !kerb((i + 3) % T.N) && !kerb((i - 3 + T.N) % T.N)) continue;
      const j = (i + 1) % T.N, [ax, az] = off(i, side * (HALF - 2.6)), [bx, bz] = off(i, side * (HALF + 1.6)), [cx, cz] = off(j, side * (HALF + 1.6)), [dx, dz] = off(j, side * (HALF - 2.6));
      g.fillStyle = Math.floor(i / 3) & 1 ? '#d33b2f' : '#f1ede4';
      g.beginPath(); g.moveTo(ax * GK, az * GK); g.lineTo(bx * GK, bz * GK); g.lineTo(cx * GK, cz * GK); g.lineTo(dx * GK, dz * GK); g.closePath(); g.fill();
    }
  }
  // the crossover: a yellow hatched box where the two halves of the lap meet
  for (const [a, b] of cross) {
    const ox = (T.X[a] + T.X[b]) / 2, oz = (T.Z[a] + T.Z[b]) / 2, na = [T.TZ[a], -T.TX[a]], nb = [T.TZ[b], -T.TX[b]];
    const det = na[0] * nb[1] - na[1] * nb[0], corner = (sa, sb) => [ox + (sa * HALF * nb[1] - sb * HALF * na[1]) / det, oz + (sb * HALF * na[0] - sa * HALF * nb[0]) / det];
    const q = [corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1)];
    g.save(); g.beginPath(); q.forEach(([x, z], k) => (k ? g.lineTo(x * GK, z * GK) : g.moveTo(x * GK, z * GK))); g.closePath(); g.clip();
    g.strokeStyle = 'rgba(236,196,52,0.85)'; g.lineWidth = 1.1 * GK;
    for (let t = -80; t <= 80; t += 5) { g.beginPath(); g.moveTo((ox + t - 60) * GK, (oz - 60) * GK); g.lineTo((ox + t + 60) * GK, (oz + 60) * GK); g.moveTo((ox + t + 60) * GK, (oz - 60) * GK); g.lineTo((ox + t - 60) * GK, (oz + 60) * GK); g.stroke(); }
    g.lineWidth = 2.4 * GK; g.beginPath(); q.forEach(([x, z], k) => (k ? g.lineTo(x * GK, z * GK) : g.moveTo(x * GK, z * GK))); g.closePath(); g.stroke();
    g.restore();
  }
  // the chequered line across the track and the pit lane at the start
  {
    const i = 0, tx = T.TX[i], tz = T.TZ[i], nx = tz, nz = -tx;
    for (let a = -HALF - 40; a < HALF; a += 2) for (let r = 0; r < 2; r++) {
      const x = T.X[i] + nx * a + tx * (r * 2 - 2), z = T.Z[i] + nz * a + tz * (r * 2 - 2);
      if (T.field.dist[Math.floor(z) * WX + Math.floor(x)] > HALF && P.field.dist[Math.floor(z) * WX + Math.floor(x)] > PIT_HALF) continue;
      g.fillStyle = ((a >> 1) + r) & 1 ? '#1d1f24' : '#f3f0e8';
      g.beginPath(); g.moveTo(x * GK, z * GK); g.lineTo((x + nx * 2) * GK, (z + nz * 2) * GK); g.lineTo((x + nx * 2 + tx * 2) * GK, (z + nz * 2 + tz * 2) * GK); g.lineTo((x + tx * 2) * GK, (z + tz * 2) * GK); g.closePath(); g.fill();
    }
  }
  // the grid: a white bracket in front of each slot
  g.strokeStyle = '#ecE8dc'; g.lineWidth = 0.8 * GK; g.lineCap = 'butt';
  for (const s of grid) {
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), nx = fz, nz = -fx, cx = s.x + fx * 13, cz = s.z + fz * 13;
    g.beginPath();
    g.moveTo((cx - nx * 7 - fx * 5) * GK, (cz - nz * 7 - fz * 5) * GK); g.lineTo((cx - nx * 7) * GK, (cz - nz * 7) * GK);
    g.lineTo((cx + nx * 7) * GK, (cz + nz * 7) * GK); g.lineTo((cx + nx * 7 - fx * 5) * GK, (cz + nz * 7 - fz * 5) * GK); g.stroke();
  }
  // the pit lane: a box painted in front of each garage, and the line to keep to on the way in and out
  g.fillStyle = 'rgba(236,196,52,0.7)';
  const bay = Math.floor((garage.z1 - garage.z0 + 1) / garage.bays);
  for (let k = 0; k < garage.bays; k++) { const z0 = garage.z0 + k * bay + 3, z1 = z0 + bay - 6; c.rect(garage.x1 + 1, z0, garage.x1 + 13, z0 + 0.6); c.rect(garage.x1 + 1, z1, garage.x1 + 13, z1 + 0.6); c.rect(garage.x1 + 12.4, z0, garage.x1 + 13, z1 + 0.6); }
  g.setLineDash([3 * GK, 3 * GK]); strokePath(g, P.X.map((x, i) => x + P.TZ[i] * (PIT_HALF - 1)), P.Z.map((z, i) => z - P.TX[i] * (PIT_HALF - 1)), GK, false);
  g.lineWidth = 0.6 * GK; g.strokeStyle = '#ecE8dc'; g.stroke(); g.setLineDash([]);
  void gates;
  return c.cv;
}

// the track on the radar, drawn once to a canvas the size of the radar's map
let radarCv = null, radarKey = '';
function radar(R, s, ox, oy, w, h) {
  const key = [s, ox, oy, w, h].join();
  if (!radarCv || key !== radarKey) {
    radarKey = key; radarCv = radarCv || document.createElement('canvas'); radarCv.width = Math.ceil(ox * 2 + w); radarCv.height = Math.ceil(oy * 2 + h);
    const g = radarCv.getContext('2d'), { T, P } = track();
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); P.X.forEach((x, i) => (i ? g.lineTo(ox + x * s, oy + P.Z[i] * s) : g.moveTo(ox + x * s, oy + P.Z[i] * s)));
    g.lineWidth = 2 * PIT_HALF * s; g.strokeStyle = 'rgba(255,255,255,0.14)'; g.stroke();
    g.beginPath(); T.X.forEach((x, i) => (i ? g.lineTo(ox + x * s, oy + T.Z[i] * s) : g.moveTo(ox + x * s, oy + T.Z[i] * s))); g.closePath();
    g.lineWidth = 2 * HALF * s; g.strokeStyle = 'rgba(255,255,255,0.3)'; g.stroke();
    // the start line
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.beginPath();
    g.moveTo(ox + (T.X[0] - T.TZ[0] * HALF) * s, oy + (T.Z[0] + T.TX[0] * HALF) * s); g.lineTo(ox + (T.X[0] + T.TZ[0] * HALF) * s, oy + (T.Z[0] - T.TX[0] * HALF) * s); g.stroke();
  }
  R.drawImage(radarCv, 0, 0);
}

export default {
  id: 'race', name: 'Bowtie Raceway', mode: 'race',
  blurb: 'A figure-of-eight circuit whose two halves cross flat out in the middle. Three laps, guns on: finish first, and wreck whoever gets in front.',
  loading: ['Building the raceway', 'Laying the track, the barriers and the stands'],
  outer: 0x6c9a56,
  build() {
    setSeed(4242); place(0, 0, -1); ctx.L = 3; ctx.lot = -1;
    barriers(); gantry(); pits(); scenery();
    finish();
  },
  ground: paint,
  get spawn() { return track().grid[4]; },   // the player starts fifth
  // a rival coming in (only if a mode asks the map): at a checkpoint far from the player, facing the way round
  spawnPoint(player, taken) {
    const { T, gates } = track();
    return pickSpot(gates.map((i) => ({ x: T.X[i], z: T.Z[i], yaw: Math.atan2(T.TX[i], T.TZ[i]) })), player, taken);
  },
  // the way on round the track from wherever the car is (the race mode's drivers have their own; this is for others)
  waypoint(c, tx, tz, out) {
    const { T } = track(), p = T.project(c.x, c.z, c._rw ?? -1), j = T.at(p.i + Math.round(36 / T.STEP));
    c._rw = p.i; out.x = T.X[j]; out.z = T.Z[j]; return out;
  },
  radar,
  // what the ground is at (x, z): 0 on the road and the paddock, 0.7 on grass, 1 in a gravel trap (see vehicle.js)
  surface(x, z) {
    if (!TR) return 0;
    const ix = Math.floor(x), iz = Math.floor(z);
    if (ix < 0 || iz < 0 || ix >= WX || iz >= WZ) return ROUGH[1];
    return ROUGH[TR.surf[iz * WX + ix]];
  },
  // the circuit itself, for the race mode
  get track() { return track(); },
};
