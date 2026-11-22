// Hammerdown Arena: a demolition derby pit dressed as a television show, for the free-for-all (modes/brawl.js). It
// stands on the big world (1024 by 1024: see ../flags.js) so the floor can be twice what it was, 672 by 440.
//   - The middle is the pit: a wide bowl of churned mud with nothing in it, for ramming. Over it hangs the scoreboard,
//     on cables from the four floodlight towers, with the clock and the leaders on all four faces (hazards.js).
//   - The ring round it is the derby's: concrete barriers along the straights (sponsor boards on them), walls of tyres
//     round two corners with wrecked cars stacked three high behind them, and red and white concrete round the other
//     two. (No catch fence on top: the chase camera of a car pinned to the wall sits behind the barrier, and a fence's
//     thin rails slip between the points main.js tests for walls, so it would look through bars.)
//   - The set pieces are round the edge, so the pit stays open: the sweeper in the north-west corner (three blades
//     turning low over the floor under the big screen, the Hammerdown strike in its still eye, scrap among its blades);
//     a hammer swinging out from the wall at the middle of each long side, from a gantry reaching out over the floor,
//     with a repair kit under it; flame jets round the north-east and south-west corners, firing in turns, with an
//     overcharge in each; the press at the west end, fed by a conveyor belt either side along the wall (a repair kit
//     under it), with the announcer's booth above; the magnet at the east end, hung from a crane over the fuel depot,
//     that drags cars in among the barrels round its nitro; and the boneyard in the south-east corner, loose wrecks and
//     tyres to hide among, barrels, a nitro and an overcharge.
//   - Boost strips on the long sides launch a car from the wall into the pit.
//   - Every so often the announcer calls an event ("Hammer time!", "Fire in the hole!", "Spin cycle!"): for fifteen
//     seconds one set of hazards goes wild, and the strike drops in the eye.
//   - Grandstands along both long sides, the booth and the depot at the ends, the floodlights in the corners.
// derby/docs/arena.md has the research behind the set pieces and how each is used. Rivals find their way with the route
// grid (which shuts over each hazard while it is dangerous), keep clear of the hazards as they drive (hazards.js), and go
// for the pickups when hurt (pickups.js, ai.js); in the free-for-all a far target is gone after by way of the pit.
import { WX, WZ, M, set, box, walls, begin, ctx } from '../../../src/world.js';
import { face, text, textW, disc } from '../../../src/kit.js';
import { makeGridNav, canvasFor, finish, pickSpot, gridRadar, lineClear, GK } from './common.js';
import { PICKUPS } from '../pickups.js';

const TAU = Math.PI * 2;
// Most of it is laid out twice: as drawn, and turned half way round the middle, so each long side has the same room.
// (The ends and two of the corners differ: that is what tells you where you are.)
const CX = 512, CZ = 512;
const turn = (x, z) => [WX - 1 - x, WZ - 1 - z];   // a voxel turned half way round the middle
// The ring's inside edge (x 176..848, z 292..732), and the mud of the pit painted in the middle: rounded rectangles.
const WALL = { hx: 336, hz: 220, r: 100 }, PIT = { hx: 238, hz: 126, r: 112 };
const IN = WALL.hx - WALL.r, IZ = WALL.hz - WALL.r;   // the corners' arcs are round (CX +-IN, CZ +-IZ)
// signed distance from a point to a rounded rectangle round the middle (less than 0 inside)
function edge(x, z, S) {
  const qx = Math.abs(x - CX) - (S.hx - S.r), qz = Math.abs(z - CZ) - (S.hz - S.r);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - S.r;
}
// a little seeded random, so the crowd, the wrecks and the paint come out the same every time
let seed = 1234567;
const rand = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 8) & 0xffff) / 65536; };
const pick = (a) => a[Math.floor(rand() * a.length)];

// ---- the live parts: where the pickups and hazards are (run by pickups.js and hazards.js) -----------------------
// the sweeper's middle, in the north-west corner (far enough out of it that its frame's legs leave a lane all round)
const SX = 306, SZ = 422;
// Pickups sit where it is risky to go: the strike in the sweeper's eye, scrap among its blades, repair kits under the
// hammers and the press, nitro under the magnet, in the boneyard and on the north and south sides, overcharge among the
// flames and the wrecks: all round the edge, so the fights move about the floor.
const SUPER = { kind: 'super', x: SX, z: SZ };
const PICKUP_SPOTS = [
  SUPER,
  { kind: 'repair', x: 512, z: 322 }, { kind: 'repair', x: 511, z: 701 }, { kind: 'repair', x: 196, z: 512 },
  { kind: 'nitro', x: 800, z: 512 }, { kind: 'nitro', x: 771, z: 663 }, { kind: 'nitro', x: 452, z: 324 }, { kind: 'nitro', x: 571, z: 699 },
  { kind: 'ammo', x: 795, z: 345 }, { kind: 'ammo', x: 228, z: 678 }, { kind: 'ammo', x: 806, z: 628 },
  { kind: 'scrap', x: SX + 30, z: SZ, rivals: false }, { kind: 'scrap', x: SX - 30, z: SZ, rivals: false },   // (bait for you alone)
];
// the sweeper: three blades from 14 out to 46, a turn every twelve seconds (twice as fast in a spin cycle)
const SWEEP = { kind: 'sweeper', x: SX, z: SZ, n: 3, r0: 14, r1: 46, spin: TAU / 12, top: 40, wild: 'spin' };
// a hammer at the middle of each long side, swinging out from the wall across the first sixty voxels of floor, the
// two out of step
const HAMMERS = [
  { kind: 'hammer', x: 512, z: 322, y: 32, len: 26.5, axis: 'z', lane: 30, wild: 'hammer', offset: 4 },
  { kind: 'hammer', x: 511, z: 701, y: 32, len: 26.5, axis: 'z', lane: 30, wild: 'hammer', offset: 6 },
];
// four flame jets round each of two corners, pointing in at the corner's middle, the north-east's and then the
// south-west's, each corner's four one after another
const CORNERS = [[CX + IN, CZ - IZ, -Math.PI / 2, 0], [CX - IN, CZ + IZ, Math.PI / 2, 1]];
const JETS = { kind: 'jets', len: 30, wild: 'fire', jets: CORNERS.flatMap(([x, z, a0, group]) => [1, 2, 3, 4].map((i) => {
  const a = a0 + i * Math.PI / 10;
  return { x: x + Math.cos(a) * (WALL.r - 1), z: z + Math.sin(a) * (WALL.r - 1), a: a + Math.PI, group, step: i - 1 };
})) };
// the magnet over the fuel depot, hung from the crane behind the east wall
const MAGNET = { kind: 'magnet', x: 800, z: 512, r: 48, y: 36, top: 54, wild: 'spin' };
// the press's pad runs from the west wall (the side a car under it is never pushed out of) to the floor
const PRESS = { kind: 'press', x0: 176, z0: 494, x1: 216, z1: 530, top: 46, rods: [[196, 502], [196, 522]], shut: ['x0'], wild: 'hammer' };
// and a belt either side of it along the wall, both running into it
const BELTS = [
  { kind: 'conveyor', x0: 176, z0: 438, x1: 216, z1: 492, yaw: 0, speed: 18 },
  { kind: 'conveyor', x0: 176, z0: 532, x1: 216, z1: 586, yaw: Math.PI, speed: 18 },
];
const BARRELS = { kind: 'barrels', spots: [
  // the fuel depot: a cluster either side, two pairs guarding the nitro, and one at each end of the tanker
  { x: 765, z: 451 }, { x: 770, z: 453 }, { x: 766, z: 457 },
  { x: 765, z: 573 }, { x: 770, z: 571 }, { x: 766, z: 567 },
  { x: 797, z: 498 }, { x: 803, z: 496 }, { x: 797, z: 526 }, { x: 803, z: 528 },
  { x: 741, z: 482 }, { x: 741, z: 542 },
  // drums among the boneyard's wrecks
  { x: 752, z: 676 }, { x: 757, z: 680 }, { x: 812, z: 664 }, { x: 790, z: 704 },
] };
// boost strips from the wall out into the pit, two on each long side
const BOOSTS = [
  { kind: 'boost', x0: 373, z0: 298, x1: 387, z1: 368, yaw: 0 }, { kind: 'boost', x0: 637, z0: 298, x1: 651, z1: 368, yaw: 0 },
  { kind: 'boost', x0: 636, z0: 655, x1: 650, z1: 725, yaw: Math.PI }, { kind: 'boost', x0: 372, z0: 655, x1: 386, z1: 725, yaw: Math.PI },
];
// the announcer's events, in turn; each drops the strike in the eye if it is not there already
const SHOW = { kind: 'show', first: 35, every: 45, time: 15, events: [
  { tag: 'hammer', name: 'HAMMER TIME!', sub: 'Nonstop hammers. A strike drops in the eye' },
  { tag: 'fire', name: 'FIRE IN THE HOLE!', sub: 'Every flame jet lit. A strike drops in the eye' },
  { tag: 'spin', name: 'SPIN CYCLE!', sub: 'Fast blades, live magnet. A strike drops in the eye' },
], onEvent: () => { if (!SUPER.up) SUPER.t = Math.min(SUPER.t ?? 1, 1); } };
// the floodlight towers, outside the four corners (x, z of a tower's corner: it is six across), and the scoreboard hung
// from their tops over the middle of the pit
const TOWERS = [[CX - IN - 106, CZ - IZ - 106], [CX + IN + 100, CZ - IZ - 106], [CX + IN + 100, CZ + IZ + 100], [CX - IN - 106, CZ + IZ + 100]];
const TOWER_Y = 122;
const BOARD = { kind: 'scoreboard', x: CX, z: CZ, y: 74, w: 46, h: 24, anchors: TOWERS.map(([x, z]) => [x + 2.5, TOWER_Y, z + 2.5]) };
// the four legs of the sweeper's frame: steel, so nothing may bury a car in one
const LEGS = [[-50, -50], [48, -50], [-50, 48], [48, 48]];
// Where cars come in (the free-for-all takes the one furthest from everyone: modes/brawl.js): round the edge of the pit
// and a few in it, each facing the middle, clear of the hazards.
const SPOTS = [
  [420, 345], [610, 345], [700, 350], [603, 678], [413, 678], [323, 673], [250, 590], [773, 433], [770, 595],
  [420, 440], [604, 440], [420, 584], [604, 584], [512, 400], [512, 624], [330, 512], [694, 512],
].map(([x, z]) => ({ x, z, yaw: Math.atan2(CX - x, CZ - z) }));

// ---- building ----------------------------------------------------------------------------------------------------
// The colours of the two sides: blue on the north, red on the south.
const SIDE = [{ seat: M.CAR_B, led: M.LIT_B }, { seat: M.CAR_A, led: M.LIT_R }];
const PAINTS = [M.CAR_A, M.CAR_B, M.TAXI, M.CAR_C, M.REND_T, M.REND_P, M.DOOR_G, M.SIGN];
// what the ring is at a point of it: tyres round the north-west and south-east corners, red and white concrete round
// the other two, and concrete barriers with boards along the straights
function section(x, z) {
  const ox = Math.abs(x - CX) - IN, oz = Math.abs(z - CZ) - IZ;
  if (ox > 0 && oz > 0) return (x < CX) === (z < CZ) ? 'tyre' : 'corner';
  return 'straight';
}

// The ring: tiles of it, so a hit only has to check its own piece. A car bounces off it however fast it goes, and the
// bounds hazard holds cars in where rockets blow it open.
//   - the concrete: a barrier eight high with a cap, red and white blocks round the flame corners, a strip of lights
//     in the side's colour on the long straights
//   - the tyres: stacks of them, five tyres high, the top one painted, two deep, with the wrecks piled up behind
const BOARDS = ['KRANKO OIL', 'BOLTZ', 'GRIT TYRES', 'FIZZBANG', 'LUGNUT', 'AMPED', 'CH 6 LIVE', 'MEGAWATT', 'DENTS R US', 'SCRAPCO'];
function ring() {
  const T = 32, R = WALL.r;
  for (let tx = 128; tx < 896; tx += T) for (let tz = 256; tz < 768; tz += T) {
    let any = false;
    for (let x = tx; x < tx + T; x++) for (let z = tz; z < tz + T; z++) {
      const e = edge(x + 0.5, z + 0.5, WALL); if (e < 0 || e >= 6) continue;
      const sec = section(x + 0.5, z + 0.5);
      if (sec !== 'tyre' && e >= 4) continue;
      if (!any) { begin('Arena wall', 'barrier', false); any = true; }
      const ox = Math.abs(x + 0.5 - CX) - IN, oz = Math.abs(z + 0.5 - CZ) - IZ;
      const arc = sec === 'straight' ? (oz > 0 ? x : z) : Math.floor(Math.atan2(oz, ox) * (R + 1.5));
      if (sec === 'tyre') {
        // a tyre is a ring six across in the plane along and across the wall, two rows of them, a hole in each
        const u = ((arc % 6) + 6) % 6 + 0.5 - 3, v = (e % 3) - 1.5, r = Math.hypot(u, v * 1.6);
        if (r > 3.1 || r < 1) continue;
        const n = Math.floor(arc / 6) + Math.floor(e / 3) * 7, top = [M.TRIM, M.CAR_A, M.TAXI, M.TRIM, M.CAR_B][((n % 5) + 5) % 5];
        for (let y = 0; y <= 9; y++) set(x, y, z, y === 9 ? top : y % 2 ? M.TYRE : M.DARK);
        continue;
      }
      if (e >= 3) { for (let y = 0; y <= 3; y++) set(x, y, z, M.CONC); continue; }   // the barrier's foot, behind
      for (let y = 0; y <= 7; y++) set(x, y, z, M.CONC);
      if (e < 1 && sec === 'corner') for (let y = 1; y <= 6; y++) set(x, y, z, (arc >> 2) & 1 ? M.TRIM : M.CAR_A);
      const a = Math.atan2(z + 0.5 - CZ, x + 0.5 - CX), side = Math.sin(a) < 0 ? 0 : 1, long = sec === 'straight' && oz > 0;
      set(x, 8, z, e < 1 && long ? (x & 1 ? SIDE[side].led : M.DARK) : M.TRIM);
    }
  }
  // sponsor boards on the inside face of the four straights
  const board = (F, u0, len, i) => {
    const bg = [M.DARK, M.TRIM, M.SIGN, M.CAR_B, M.DARK, M.CAR_A][i % 6], fg = bg === M.TRIM || bg === M.SIGN ? M.DARK : [M.LIT_Y, M.LIT_W][i & 1];
    F.box(u0, 1, u0 + len - 1, 7, 0, 0, bg);
    const s = BOARDS[i % BOARDS.length]; text(F, s, u0 + ((len - textW(s)) >> 1), 2, 0, fg);
  };
  const x0 = CX - IN, x1 = CX + IN - 1, z0 = CZ - IZ, z1 = CZ + IZ - 1;
  const straights = [['b', x0, CZ - WALL.hz - 2, x1, CZ - WALL.hz - 1], ['f', x0, CZ + WALL.hz, x1, CZ + WALL.hz + 1], ['r', CX - WALL.hx - 2, z0, CX - WALL.hx - 1, z1], ['l', CX + WALL.hx, z0, CX + WALL.hx + 1, z1]];
  straights.forEach(([side, a, b, c, d], si) => {
    const F = face(side, a, b, c, d), n = Math.floor(F.W / 46);
    for (let i = 0; i < n; i++) {
      const u = i * 46 + ((F.W - n * 46) >> 1) + 3;
      if (side === 'r' && z1 - u >= 430 && z1 - u - 39 <= 594) continue;   // (none behind the press and its belts: the west face reads from z1 down)
      begin('Sponsor board', 'barrier', false); board(F, u, 40, i + si * 3);
    }
  });
  // the wrecks piled up behind the tyre walls, three high
  for (const [acx, acz, a0] of [[CX - IN, CZ - IZ, Math.PI], [CX + IN, CZ + IZ, 0]]) {
    for (let layer = 0; layer < 3; layer++) {
      const Rr = R + 11 + layer * 1.5, step = 19 / Rr, n = Math.floor(Math.PI / 2 / step);
      for (let i = 0; i < n - (layer & 1); i++) {
        if (layer === 2 && rand() < 0.45) continue;
        const th = a0 + (i + (layer & 1 ? 1 : 0.5)) * step;
        const hx = acx + Math.cos(th) * Rr, hz = acz + Math.sin(th) * Rr;
        hulk(hx, hz, Math.atan2(-Math.sin(th), Math.cos(th)) + (rand() - 0.5) * 0.25, layer * 5, 'barrier');
      }
    }
  }
}

// A wrecked car: a squashed body on its chassis, rust and soot through the paint, the glass gone, the roof stoved in.
// (cx, cz) its middle, a its heading, y0 the height it sits at (on another one, in a stack).
function hulk(cx, cz, a, y0, kind) {
  begin('Wreck', kind, false);
  const s = Math.sin(a), c = Math.cos(a), paint = pick(PAINTS), L = 7.5 + rand() * 2, W = 4.2, cab = L * (0.35 + rand() * 0.15);
  const crush = rand() < 0.5 ? 1 : 0, burnt = rand() < 0.25, R = Math.ceil(L + 2);
  for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) for (let z = Math.floor(cz - R); z <= Math.ceil(cz + R); z++) {
    const dx = x + 0.5 - cx, dz = z + 0.5 - cz, u = dx * s + dz * c, v = dx * c - dz * s, au = Math.abs(u), av = Math.abs(v);
    if (au > L || av > W) continue;
    const wheel = au > L - 4 && au < L - 1 && av > W - 1.4;
    const skin = () => (burnt && rand() < 0.6 ? M.CHAR : rand() < 0.28 ? pick([M.REBAR, M.IRON, M.BROWNST]) : paint);
    set(x, y0, z, wheel ? M.TYRE : M.DARK);                                   // the chassis, on what is left of its wheels
    for (let y = 1; y <= 2; y++) set(x, y0 + y, z, au > L - 1 ? (y === 1 ? M.STEEL : skin()) : skin());   // the body, bumpers low
    if (au < cab + 1.5 && av < W - 0.5 && !crush) set(x, y0 + 3, z, au > cab || av > W - 1.5 ? M.DARK : skin());   // the cabin, its windows out
    if (au < cab && av < W - 1 && rand() > 0.1) set(x, y0 + 3 + (crush ? 0 : 1), z, skin());   // the roof, dented
  }
}

// A grandstand along the north side (or the south, turned round): fourteen rows of seats stepping back and up from the
// ring, a crowd, a back wall with boards on top, and walls at the ends. Cut into sections so a rocket only makes one
// section check itself.
const STAND = [292, 731];
function stand(s) {
  const P = (x, z) => (s ? turn(x, z) : [x, z]);
  const S = (x, y, z, m) => { const [a, b] = P(x, z); set(a, y, b, m); };
  const shirts = [M.CAR_A, M.CAR_B, M.CAR_C, M.TAXI, M.TRIM, M.DARK, M.SIGN, M.REND_T, M.REND_P, M.REND_Y], heads = [M.REND_C, M.MUD, M.OCHRE, M.BROWNST, M.REND_P];
  const ROWS = 14, Z0 = 285, rowY = (k) => 9 + 2 * k, back = Z0 - 3 * ROWS;
  for (let x0 = STAND[0]; x0 <= STAND[1]; x0 += 32) {
    begin('Grandstand', 'stand', false);
    for (let x = x0; x < Math.min(STAND[1] + 1, x0 + 32); x++) {
      const team = s ? SIDE[1].seat : SIDE[0].seat, sect = ((x - STAND[0]) / 16 | 0) & 1, end = x === STAND[0] || x === STAND[1];
      for (let k = 0; k < ROWS; k++) {
        const zf = Z0 - 3 * k, y = rowY(k);
        if (end) { for (let z = zf - 2; z <= zf; z++) for (let yy = 0; yy <= y + 2; yy++) S(x, yy, z, M.CONC); continue; }
        // the riser under the front of the row, the seats, and the slab under them
        for (let yy = k ? rowY(k - 1) : 0; yy < y; yy++) S(x, yy, zf, M.CONC);
        for (let z = zf - 2; z <= zf; z++) { S(x, y, z, z === zf ? M.CONC : (x % 23 === 0 ? M.SLAB : sect ? team : M.TRIM)); S(x, y - 1, z, M.CONC); }
        // the crowd: a shirt and a head on most seats, and now and then a flag in the side's colour
        if (x % 23 && rand() < 0.62) { S(x, y + 1, zf - 1, pick(shirts)); S(x, y + 2, zf - 1, pick(heads)); }
        else if (x % 23 && rand() < 0.02) { for (let yy = y + 1; yy <= y + 5; yy++) S(x, yy, zf - 1, M.DARK); S(x + 1, y + 5, zf - 1, team); S(x + 2, y + 5, zf - 1, team); S(x + 1, y + 4, zf - 1, team); S(x + 2, y + 4, zf - 1, M.TRIM); }
      }
      for (let y = 0; y <= rowY(ROWS - 1) + 6; y++) S(x, y, back, y === rowY(ROWS - 1) + 6 ? M.TRIM : M.CONC);
    }
  }
  // boards on top of the back wall: the show in the middle, a sponsor either side
  const top = rowY(ROWS - 1) + 7, mid = (STAND[0] + STAND[1]) >> 1;
  const boards = [[mid - 90, mid + 89, 'HAMMERDOWN', 3, M.LIT_Y], [STAND[0] + 12, STAND[0] + 132, s ? 'GRIT TYRES' : 'KRANKO OIL', 2, M.LIT_W], [STAND[1] - 132, STAND[1] - 12, s ? 'MEGAWATT' : 'FIZZBANG', 2, M.LIT_W]];
  for (const [a, b, str, sc, col] of boards) {
    begin('Sign', 'sign', false);
    const h = sc * 5 + 6, [ax, az] = P(a, back - 1), [bx, bz] = P(b, back);
    box(Math.min(ax, bx), top, Math.min(az, bz), Math.max(ax, bx), top + h, Math.max(az, bz), M.DARK);
    const F = s ? face('f', Math.min(ax, bx), Math.min(az, bz) + 1, Math.max(ax, bx), Math.min(az, bz) + 2) : face('b', a, back - 2, b, back - 1);
    text(F, str, ((b - a + 1) - textW(str, sc)) >> 1, top + 3, 1, col, sc);
    for (let u = 0; u <= b - a; u += 4) F.p(u, top + h, 1, col === M.LIT_Y ? M.LIT_R : M.LIT_B);   // a row of bulbs along the top
  }
}

// The gantry at the middle of each long side: a lattice tower in the front of the stand with an arm reaching out over
// the floor (a stay from the tower's top holds its end up), the hammer hung under it, boards along both sides of the arm
// and cameras on top. Nothing of it stands on the floor.
function gantry(s) {
  const P = (x, z) => (s ? turn(x, z) : [x, z]);
  const B = (x0, y0, z0, x1, y1, z1, m) => { const [a, b] = P(x0, z0), [c, d] = P(x1, z1); box(Math.min(a, c), y0, Math.min(b, d), Math.max(a, c), y1, Math.max(b, d), m); };
  const S = (x, y, z, m) => { const [a, b] = P(x, z); set(a, y, b, m); };
  begin('Gantry', 'gantry', true);
  const x0 = 506, x1 = 517, za = 276, zb = 285, tip = 366, TOP = 74;
  for (const [x, z] of [[x0, za], [x1, za], [x0, zb], [x1, zb]]) B(x, 0, z, x, TOP, z, M.STEEL);
  for (let y = 6; y <= TOP; y += 8) { B(x0, y, za, x1, y, za, M.STEEL); B(x0, y, zb, x1, y, zb, M.STEEL); B(x0, y, za, x0, y, zb, M.STEEL); B(x1, y, za, x1, y, zb, M.STEEL); }
  for (let y = 0; y < TOP; y++) { const u = y % 16 < 8 ? y % 8 : 8 - (y % 8); S(x0 + 1 + u, y, za, M.STEEL); S(x0 + 1 + u, y, zb, M.STEEL); }   // zig-zag bracing
  B(x0, TOP + 1, za, x1, TOP + 2, zb, M.TAXI);
  // the arm: chords, posts and a deck, out to the tip
  for (const x of [x0, x1]) { B(x, 34, za, x, 34, tip, M.STEEL); B(x, 41, za, x, 41, tip, M.STEEL); for (let z = za; z <= tip; z += 6) B(x, 34, z, x, 41, z, M.STEEL); }
  B(x0, 41, za, x1, 41, tip, M.METAL);
  for (let z = 300; z <= tip - 4; z += 8) { B(x0, 34, z, x1, 34, z + 1, M.STEEL); B(511, 33, z, 512, 33, z + 1, M.LIT_W); }   // lamps under it
  for (const x of [x0, x1]) B(x, 31, 320, x, 33, 323, M.STEEL);   // the hangers for the hammer's axle (hazards.js swings the hammer)
  // the stays, from the top of the tower down to the arm's end
  for (let k = 0; k <= 96; k++) { const t = k / 96, z = Math.round(zb + (tip - zb) * t), y = Math.round(TOP - (TOP - 42) * t); for (const x of [x0 + 1, x1 - 1]) { S(x, y, z, M.STEEL); S(x, y + 1, z, M.STEEL); } }
  begin('Sign', 'sign', true);
  for (const x of [x0 - 1, x1 + 1]) B(x, 34, 296, x, 40, 356, M.DARK);
  // the boards' faces look west and east along the floor under the arm
  const str = s ? 'HAMMER TIME' : 'HAMMERDOWN LIVE', [pa, pb] = s ? [turn(0, 356)[1], turn(0, 296)[1]] : [296, 356];
  const [wx, ex] = s ? [turn(x1 + 1, 0)[0], turn(x0 - 1, 0)[0]] : [x0 - 1, x1 + 1];
  for (const F of [face('l', wx, pa, wx, pb), face('r', ex, pa, ex, pb)]) text(F, str, (61 - textW(str)) >> 1, 35, 1, s ? M.LIT_R : M.LIT_Y);
  begin('Camera', 'prop', true);   // the cameras on top, with their red tally lights
  for (const z of [318, 350]) { B(509, 42, z, 513, 45, z + 5, M.DARK); B(508, 43, z + 1, 508, 44, z + 2, M.STEEL); B(511, 46, z + 2, 511, 46, z + 2, M.LIT_R); }
}

// The sweeper's frame, in its corner: a steel frame on four legs round the blades, carrying the big screen (the show's
// name on all four sides) and the trophy on top, with the sweeper's column coming down from the screen to the drum. The
// drum and its blades are meshes (hazards.js turns them); the floor under them is open, so nothing there can trap a car.
function sweeperFrame() {
  for (const [a, b] of LEGS) { begin('Frame leg', 'barrier', true); box(SX + a, 0, SZ + b, SX + a + 2, 62, SZ + b + 2, M.STEEL); for (let y = 4; y <= 10; y++) for (const [u, v] of [[0, 0], [2, 0], [0, 2], [2, 2]]) set(SX + a + u, y, SZ + b + v, (y >> 1) & 1 ? M.TAXI : M.DARK); }
  begin('Frame', 'gantry', true);
  box(SX - 50, 60, SZ - 50, SX + 50, 62, SZ - 48, M.STEEL); box(SX - 50, 60, SZ + 48, SX + 50, 62, SZ + 50, M.STEEL);
  box(SX - 50, 60, SZ - 50, SX - 48, 62, SZ + 50, M.STEEL); box(SX + 48, 60, SZ - 50, SX + 50, 62, SZ + 50, M.STEEL);
  box(SX - 50, 61, SZ - 1, SX + 50, 63, SZ, M.STEEL); box(SX - 1, 61, SZ - 50, SX, 63, SZ + 50, M.STEEL);   // the cross the screen sits on
  for (let y = 41; y <= 63; y++) disc(SX, SZ, y, y < 44 ? 4 : 2.6, y < 44 ? M.DARK : M.STEEL);   // the sweeper's column
  begin('Big screen', 'sign', true);
  const x0 = SX - 22, x1 = SX + 21, z0 = SZ - 22, z1 = SZ + 21;
  walls(x0, 64, z0, x1, 81, z1, M.DARK); box(x0, 64, z0, x1, 64, z1, M.DARK); box(x0, 81, z0, x1, 81, z1, M.STEEL);
  for (let x = x0; x <= x1; x += 3) { set(x, 82, z0, M.LIT_W); set(x, 82, z1, M.LIT_W); }
  for (let z = z0; z <= z1; z += 3) { set(x0, 82, z, M.LIT_W); set(x1, 82, z, M.LIT_W); }
  faces4(x0, z0, x1, z1).forEach((F, i) => {
    text(F, 'HAMMERDOWN', (44 - textW('HAMMERDOWN')) >> 1, 76, 0, M.LIT_Y);
    F.box(3, 75, 40, 75, 0, 0, M.LIT_B);
    const sub = i & 1 ? 'CH 6' : 'LIVE'; text(F, sub, (44 - textW(sub, 2)) >> 1, 65, 0, i & 1 ? M.LIT_B : M.LIT_R, 2);
  });
  // the trophy, on top of the screen
  begin('Trophy', 'statue', false);
  const Y = 74;
  for (let y = 8; y <= 11; y++) disc(SX, SZ, y + Y, 10 - (y - 8), M.CHROME, y === 11 ? -1 : 8 - (y - 8));
  for (let y = 12; y <= 21; y++) disc(SX, SZ, y + Y, y < 20 ? 3 : 5, M.BRASS);
  for (let y = 22; y <= 38; y++) { const r = 6 + Math.min(5, (y - 22) * 0.55); disc(SX, SZ, y + Y, r, M.BRASS, y === 22 ? -1 : r - 1.5); }
  for (const s of [-1, 1]) for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI, x = SX + s * (11 + Math.round(Math.sin(a) * 4)) - (s < 0 ? 1 : 0), y = Y + 25 + Math.round(-Math.cos(a) * 5 + 5); set(x, y, SZ, M.BRASS); set(x, y, SZ - 1, M.BRASS); }
}
const faces4 = (x0, z0, x1, z1) => ['f', 'r', 'b', 'l'].map((s) => face(s, x0, z0, x1, z1));

// The west end: the press's column behind the wall, its arm reaching out over the pad, and above it the announcer's
// booth, a long block with a gallery of windows looking down the pit, the show's name lit up on its roof and dishes
// beside it.
function westEnd() {
  begin('Press', 'barrier', false);
  walls(150, 0, 488, 172, 52, 536, M.STEEL); box(150, 52, 488, 172, 52, 536, M.STEEL);
  box(151, 0, 489, 171, 13, 535, M.STEEL);
  for (let z = 488; z <= 536; z++) for (let y = 10; y <= 16; y++) set(172, y, z, ((z + y) >> 2) & 1 ? M.TAXI : M.DARK);   // hazard stripes over the wall
  // the arm: two deep beams out over the pad, tied at the end and over the slab
  for (const z of [488, 533]) box(150, 40, z, 222, 49, z + 3, M.STEEL);
  box(219, 44, 488, 222, 49, 536, M.STEEL); box(194, 46, 492, 197, 49, 532, M.STEEL);
  for (let x = 150; x <= 222; x++) for (const z of [488, 536]) set(x, 44, z, M.TAXI);
  begin('Sign', 'sign', false);
  { const F = face('r', 150, 488, 172, 536); F.box(4, 22, 44, 36, 1, 1, M.DARK); text(F, 'THE', (49 - textW('THE')) >> 1, 30, 2, M.LIT_W); text(F, 'PRESS', (49 - textW('PRESS')) >> 1, 24, 2, M.LIT_Y); }
  // the booth
  for (const [z0, z1] of [[440, 487], [488, 536], [537, 584]]) {
    begin('Booth', 'building', true);
    walls(96, 0, z0, 146, 62, z1, M.CONC); box(96, 63, z0, 146, 63, z1, M.ROOF_D); box(97, 50, z0, 145, 50, z1, M.CONC);
    const F = face('r', 96, z0, 146, z1);
    F.box(1, 52, F.W - 2, 60, 0, 0, M.GLASS);
    for (let u = 0; u < F.W; u += 8) F.box(u, 52, u, 60, 0, 0, M.DARK);
    F.box(0, 61, F.W - 1, 61, 0, 1, M.TRIM); F.box(0, 51, F.W - 1, 51, 0, 1, M.TRIM);
  }
  begin('Sign', 'sign', false);
  { box(140, 64, 452, 140, 81, 572, M.DARK); const F = face('r', 96, 452, 140, 572), str = 'HAMMERDOWN'; text(F, str, (121 - textW(str, 3)) >> 1, 66, 1, M.LIT_Y, 3); for (let u = 0; u < 121; u += 4) F.p(u, 82, 0, M.LIT_R); }
  for (const z of [452, 572]) {   // the broadcast dishes
    begin('Dish', 'prop', true);
    box(110, 64, z, 111, 69, z + 1, M.STEEL);
    for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) if (a * a + b * b <= 18) set(112 + Math.round(b * 0.3), 72 + a, z + b, M.TRIM);
  }
}

// The east end: the fuel depot's two tanks behind the wall with its name on them, the magnet's crane between them, and
// the tanker parked out on the floor in front of it.
function eastEnd() {
  for (const z of [454, 570]) {
    begin('Fuel tank', 'tank', true);
    for (let y = 0; y <= 30; y++) disc(872, z, y, 10, y % 10 === 9 ? M.CAR_A : M.TRIM, y === 0 || y === 30 ? -1 : 9);
    for (let k = 1; k <= 3; k++) disc(872, z, 30 + k, 10 - k * 2.5, M.TRIM);
    begin('Sign', 'sign', false);
    box(864, 31, z - 12, 864, 38, z + 11, M.DARK);
    const F = face('l', 864, z - 12, 864, z + 11), str = z < CZ ? 'KRANKO' : 'FUEL';
    text(F, str, (24 - textW(str)) >> 1, 32, 1, z < CZ ? M.LIT_Y : M.LIT_W);
  }
  crane();
  begin('Tanker', 'wall', false);
  box(736, 2, 488, 747, 12, 499, M.CAR_B); box(737, 8, 488, 746, 11, 488, M.GLASS); box(735, 0, 490, 748, 2, 497, M.DARK);
  for (let z = 501; z <= 535; z++) for (let y = 0; y <= 13; y++) for (let x = 735; x <= 748; x++) {
    const dy = y - 7.5, dx = x + 0.5 - 741.5, r = Math.hypot(dx, dy);
    if (y >= 3 && r <= 6) set(x, y, z, r < 5 ? M.DARK : Math.abs(dy) < 1 ? M.CAR_A : M.CHROME);   // full, so it is no garage when it is shot open
  }
  for (const z of [492, 506, 514, 526, 532]) for (const x of [735, 748]) box(x, 0, z, x, 3, z + 3, M.TYRE);
  box(741, 14, 507, 742, 20, 532, M.DARK);   // a board along the top of the tank
  for (const F of [face('l', 741, 507, 741, 532), face('r', 742, 507, 742, 532)]) text(F, 'KRANKO', (26 - textW('KRANKO')) >> 1, 15, 1, M.LIT_Y);
}

// The magnet's crane: a yellow lattice tower behind the east wall with its cab on top, a jib reaching out over the fuel
// depot (the magnet hangs from its trolley: hazards.js moves it), a concrete counterweight at the back, and the magnet's
// board hung under the jib.
function crane() {
  begin('Crane', 'tower', true);
  const x0 = 857, x1 = 865, z0 = 508, z1 = 516;
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box(x, 0, z, x, 60, z, M.TAXI);
  for (let y = 6; y <= 60; y += 6) walls(x0, y, z0, x1, y, z1, M.TAXI);
  for (let y = 0; y < 60; y++) { const u = y % 12 < 6 ? y % 6 : 6 - (y % 6); set(x0 + 1 + u, y, z0, M.TAXI); set(x0 + 1 + u, y, z1, M.TAXI); set(x0, y, z0 + 1 + u, M.TAXI); set(x1, y, z0 + 1 + u, M.TAXI); }   // zig-zag bracing
  // the jib: two lattice sides along x, tied across top and bottom
  for (const z of [509, 515]) { box(784, 56, z, 884, 56, z, M.TAXI); box(788, 61, z, 880, 61, z, M.TAXI); for (let x = 784; x <= 882; x += 6) { box(x, 56, z, x, 61, z, M.TAXI); set(x + 3, 58, z, M.TAXI); set(x + 3, 59, z, M.TAXI); } }
  for (let x = 784; x <= 882; x += 6) { box(x, 56, 509, x, 56, 515, M.TAXI); box(x, 61, 509, x, 61, 515, M.TAXI); }
  box(796, 54, 509, 804, 55, 515, M.DARK);   // the trolley the magnet hangs from
  // the cab, looking down the jib
  walls(x0, 62, z0, x1, 68, z1, M.CAR_A); box(x0, 69, z0, x1, 69, z1, M.ROOF_D);
  box(x0, 64, z0 + 2, x0, 66, z1 - 2, M.GLASS);
  begin('Counterweight', 'prop', true);
  box(869, 46, 507, 877, 55, 517, M.CONC); for (let x = 869; x <= 877; x++) for (let y = 47; y <= 54; y += 3) { set(x, y, 507, M.CAR_A); set(x, y, 517, M.CAR_A); }
  begin('Sign', 'sign', false);
  box(812, 46, 512, 846, 54, 512, M.DARK);
  for (const F of [face('f', 812, 512, 846, 512), face('b', 812, 512, 846, 512)]) text(F, 'MAGNET', (35 - textW('MAGNET')) >> 1, 47, 1, M.LIT_B);
}

// The boneyard, in the south-east corner: loose wrecks (some on top of each other) and stacks of tyres to hide among,
// all of them things a fast car smashes through.
function boneyard() {
  for (const [x, z, a, two] of [[792, 652, 0.7, true], [745, 690, 1.2, false], [812, 596, 0.1, true], [716, 650, -0.5, false]]) {
    hulk(x, z, a, 0, 'wall'); if (two) hulk(x + 1, z - 1, a + 0.3, 5, 'wall');
  }
  const stack = (x, z, top) => {
    begin('Tyre stack', 'wall', false);
    for (let y = 0; y <= 10; y++) for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
      const corner = (a === 0 || a === 5) && (b === 0 || b === 5), hole = a >= 2 && a <= 3 && b >= 2 && b <= 3;
      if (hole || (corner && y % 2)) continue;
      set(x + a, y, z + b, y === 10 ? top : M.TYRE);
    }
  };
  [[778, 618], [784, 618], [772, 690], [772, 696], [800, 676]].forEach(([x, z], i) => stack(x, z, i & 1 ? M.CAR_A : M.TRIM));
}

// Floodlights outside the four corners: tall steel towers with a bank of lamps turned in toward the middle. The
// scoreboard's cables run from their tops.
function floodlights() {
  for (const [px, pz] of TOWERS) {
    begin('Floodlight', 'tower', true);
    for (const [a, b] of [[0, 0], [5, 0], [0, 5], [5, 5]]) box(px + a, 0, pz + b, px + a, TOWER_Y - 10, pz + b, M.STEEL);
    for (let y = 8; y <= TOWER_Y - 14; y += 9) walls(px, y, pz, px + 5, y, pz + 5, M.STEEL);
    const hx = px + 2, hz = pz + 2, fx = Math.sign(CX - hx), fz = Math.sign(CZ - hz);
    box(hx - 7, TOWER_Y - 9, hz - 7, hx + 8, TOWER_Y, hz + 8, M.DARK);
    // the lamps, on the two faces that look at the arena
    for (let y = TOWER_Y - 8; y <= TOWER_Y - 1; y += 2) for (let u = -6; u <= 7; u += 2) {
      set(fx > 0 ? hx + 9 : hx - 8, y, hz + u, M.LIT_W); set(hx + u, y, fz > 0 ? hz + 9 : hz - 8, M.LIT_W);
    }
    // the crew's deck under the lamps, with a rail round it
    box(hx - 9, TOWER_Y - 10, hz - 9, hx + 10, TOWER_Y - 10, hz + 10, M.STEEL);
    walls(hx - 9, TOWER_Y - 9, hz - 9, hx + 10, TOWER_Y - 9, hz + 10, M.TAXI);
  }
  // the searchlights out past the stands, for the show by night (looks/night.js sweeps their beams): a drum on a
  // trailer, its lens looking up
  for (const [x, z] of SEARCH) {
    begin('Searchlight', 'prop', true);
    box(x - 4, 0, z - 3, x + 4, 2, z + 3, M.DARK); box(x - 3, 0, z - 4, x - 1, 1, z + 4, M.TYRE); box(x + 1, 0, z - 4, x + 3, 1, z + 4, M.TYRE);
    for (let y = 3; y <= 7; y++) disc(x, z, y, 3, y === 7 ? M.LIT_W : M.STEEL, y === 7 ? -1 : 2);
  }
}
// By night (looks/night.js), the lamps on each tower's two faces are the banks that light the pit: where a bank's face
// is, which way it looks, and the spot on the floor it is aimed at. A tower lights its own quarter of the pit, one bank
// along the arena and one across it, so the four towers' pools overlap in the middle.
const BANKS = TOWERS.flatMap(([px, pz]) => {
  const hx = px + 2, hz = pz + 2, fx = Math.sign(CX - hx), fz = Math.sign(CZ - hz), y = TOWER_Y - 4.5;
  const mx = hx + (CX - hx) * 0.5, mz = hz + (CZ - hz) * 0.5;
  return [
    { x: fx > 0 ? hx + 10 : hx - 8, y, z: hz + 0.5, nx: fx, nz: 0, w: 13, h: 7, aim: [mx + fx * 70, mz] },
    { x: hx + 0.5, y, z: fz > 0 ? hz + 10 : hz - 8, nx: 0, nz: fz, w: 13, h: 7, aim: [mx, mz + fz * 45] },
  ];
});
// where the searchlights stand: on the concrete apron round the stadium (the city's, `backdrop` below), between each
// grandstand's back and the drive, and off each end
const SEARCH = [[330, 232], [694, 232], [694, 791], [330, 791], [86, 512], [920, 512]];
// Where cameras flash in the crowd: eight hundred seats, half in each stand, at the height of a head (stand() fills most seats)
function crowdSpots() {
  let s = 99991; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const out = [];
  for (let n = 0; n < 800; n++) {
    let x = STAND[0] + 1 + Math.floor(r() * (STAND[1] - STAND[0] - 1)); if (x % 23 === 0) x++;
    const k = Math.floor(r() * 14), z = 285 - 3 * k - 1 + 0.5, y = 9 + 2 * k + 2.5;
    if (n & 1) out.push(WX - x - 0.5, y, WZ - z); else out.push(x + 0.5, y, z);
  }
  return out;
}

// ---- the painted floor -------------------------------------------------------------------------------------------
function roundRect(g, S, inset = 0) {
  const x0 = CX - S.hx + inset, x1 = CX + S.hx - inset, z0 = CZ - S.hz + inset, z1 = CZ + S.hz - inset, r = Math.max(1, S.r - inset);
  g.beginPath(); g.moveTo(x0 + r, z0); g.lineTo(x1 - r, z0); g.arc(x1 - r, z0 + r, r, -Math.PI / 2, 0); g.lineTo(x1, z1 - r); g.arc(x1 - r, z1 - r, r, 0, Math.PI / 2);
  g.lineTo(x0 + r, z1); g.arc(x0 + r, z1 - r, r, Math.PI / 2, Math.PI); g.lineTo(x0, z0 + r); g.arc(x0 + r, z0 + r, r, Math.PI, Math.PI * 1.5); g.closePath();
}
const stripes = (g, x, z, w, h, n, alongX) => { for (let k = 0; k * n < (alongX ? w : h); k++) { g.fillStyle = k & 1 ? '#1c1c1e' : '#e2b02a'; if (alongX) g.fillRect(x + k * n, z, Math.min(n, w - k * n), h); else g.fillRect(x, z + k * n, w, Math.min(n, h - k * n)); } };
function paint() {
  const c = canvasFor('#6e6b64', 91), g = c.g;
  const V = () => g.setTransform(GK, 0, 0, GK, 0, 0), I = () => g.setTransform(1, 0, 0, 1, 0, 0);
  c.speckle(0, 0, WX, WZ, 90000, ['rgba(40,38,34,0.25)', 'rgba(200,196,186,0.2)']);
  // the floor: packed dirt, speckled, darker in a band along the foot of the ring
  g.save(); V(); roundRect(g, WALL); g.fillStyle = '#8a7152'; g.fill(); g.clip(); I();
  c.speckle(176, 292, 848, 732, 260000, ['rgba(60,46,32,0.35)', 'rgba(170,146,112,0.3)', 'rgba(104,86,62,0.4)']);
  V();
  for (let k = 0; k < 6; k++) { g.strokeStyle = `rgba(30,24,18,${0.08 + k * 0.03})`; g.lineWidth = 2; roundRect(g, WALL, 11 - k * 2); g.stroke(); }
  // the pit: churned mud, fading in from the dirt at its edge, with wet patches, puddles and ruts
  for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(78,58,40,0.16)'; roundRect(g, PIT, -14 + k * 3); g.fill(); }
  g.fillStyle = '#5c4532'; roundRect(g, PIT, 10); g.fill();
  g.save(); roundRect(g, PIT, -10); g.clip(); I();
  c.speckle(264, 376, 760, 648, 140000, ['rgba(40,28,18,0.4)', 'rgba(120,96,70,0.3)', 'rgba(70,52,36,0.45)']);
  V();
  for (let i = 0; i < 60; i++) {   // wet patches
    const x = CX + (rand() - 0.5) * 2 * (PIT.hx - 20), z = CZ + (rand() - 0.5) * 2 * (PIT.hz - 16);
    g.fillStyle = `rgba(36,26,18,${0.12 + rand() * 0.2})`; g.beginPath(); g.ellipse(x, z, 8 + rand() * 26, 5 + rand() * 14, rand() * 3, 0, TAU); g.fill();
  }
  for (let i = 0; i < 18; i++) {   // puddles, with the sky in them
    const x = CX + (rand() - 0.5) * 2 * (PIT.hx - 40), z = CZ + (rand() - 0.5) * 2 * (PIT.hz - 30), rx = 4 + rand() * 9, rz = 2.5 + rand() * 5, a = rand() * 3;
    g.fillStyle = 'rgba(96,104,108,0.6)'; g.beginPath(); g.ellipse(x, z, rx, rz, a, 0, TAU); g.fill();
    g.fillStyle = 'rgba(170,184,194,0.35)'; g.beginPath(); g.ellipse(x - rx * 0.2, z - rz * 0.2, rx * 0.55, rz * 0.4, a, 0, TAU); g.fill();
  }
  g.lineCap = 'round';
  for (let i = 0; i < 140; i++) {   // ruts: tyre tracks round and round the pit, and across it
    g.strokeStyle = `rgba(22,16,12,${0.1 + rand() * 0.18})`; g.lineWidth = 1 + rand() * 1.8;
    g.beginPath();
    if (i % 3) { const a = rand() * TAU, k = 0.25 + rand() * 0.75; g.ellipse(CX + (rand() - 0.5) * 80, CZ + (rand() - 0.5) * 50, PIT.hx * k, PIT.hz * k, (rand() - 0.5) * 0.5, a, a + 0.5 + rand() * 1.4); }
    else { const x = CX + (rand() - 0.5) * 400, z = CZ + (rand() - 0.5) * 200; g.arc(x, z, 30 + rand() * 120, rand() * TAU, rand() * TAU); }
    g.stroke();
  }
  g.restore();
  // the show's name, painted across the pit both ways
  g.font = 'bold 26px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const s of [0, 1]) { g.save(); g.translate(CX, CZ); g.rotate(s * Math.PI); g.fillStyle = 'rgba(232,228,218,0.17)'; g.fillText('HAMMERDOWN', 0, -52); g.restore(); }
  g.restore(); V();
  // the sweeper's deck: a white ring, a yellow and black band, and the steel deck with the blades' track worn into it
  // and the eye a red and white target
  g.fillStyle = '#e8e4da'; g.beginPath(); g.arc(SX, SZ, 57, 0, TAU); g.fill();
  g.fillStyle = '#8a7152'; g.beginPath(); g.arc(SX, SZ, 55.5, 0, TAU); g.fill();
  for (let k = 0; k < 60; k++) { g.fillStyle = k & 1 ? '#1c1c1e' : '#e2b02a'; g.beginPath(); g.arc(SX, SZ, 55, k / 60 * TAU, (k + 1) / 60 * TAU); g.arc(SX, SZ, 51, (k + 1) / 60 * TAU, k / 60 * TAU, true); g.fill(); }
  g.fillStyle = '#3a3d42'; g.beginPath(); g.arc(SX, SZ, 51, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(20,20,22,0.55)'; g.lineWidth = 0.4;
  for (let r = 16; r < 50; r += 6) { g.beginPath(); g.arc(SX, SZ, r, 0, TAU); g.stroke(); }
  for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; g.beginPath(); g.moveTo(SX + Math.cos(a) * 15, SZ + Math.sin(a) * 15); g.lineTo(SX + Math.cos(a) * 50, SZ + Math.sin(a) * 50); g.stroke(); }
  g.strokeStyle = 'rgba(200,200,205,0.18)'; g.lineWidth = 2.5; g.beginPath(); g.arc(SX, SZ, 46, 0, TAU); g.stroke();   // where the saws run
  [[13.5, '#e8e4da'], [11.5, '#c23b2e'], [8.5, '#e8e4da'], [5.5, '#c23b2e'], [2.5, '#e2b02a']].forEach(([r, col]) => { g.fillStyle = col; g.beginPath(); g.arc(SX, SZ, r, 0, TAU); g.fill(); });
  // the press's bay: steel deck plate from the wall out past the belts, the pad in a yellow and black border, the words
  g.fillStyle = '#6c7177'; g.fillRect(176, 430, 50, 164);
  g.fillStyle = 'rgba(200,206,212,0.35)'; for (let x = 177; x < 226; x += 3) for (let z = 431; z < 594; z += 3) g.fillRect(x + ((z / 3) & 1), z, 1, 0.6);
  g.save(); g.beginPath(); g.rect(176, 490, 44, 44); g.rect(176, 494, 40, 36); g.clip('evenodd');
  for (let i = -50; i < 50; i += 4) { g.fillStyle = (i / 4) & 1 ? '#1c1c1e' : '#e2b02a'; g.beginPath(); g.moveTo(176 + i, 490); g.lineTo(180 + i, 490); g.lineTo(224 + i, 534); g.lineTo(220 + i, 534); g.fill(); }
  g.restore();
  g.fillStyle = '#3e4146'; g.fillRect(176, 494, 40, 36);
  g.save(); g.translate(196, 512); g.rotate(Math.PI / 2); g.font = 'bold 7px "Arial Black", Impact, sans-serif'; g.fillStyle = '#e2b02a'; g.fillText('CRUSH', 0, -9); g.fillText('ZONE', 0, 10); g.restore();
  for (const b of BELTS) stripes(g, b.x1, b.z0, 2, b.z1 - b.z0, 4, false);   // the belts' rails
  // the hammer zones: a dark red band out from the wall under each gantry, edged in stripes, with HAMMER on it
  for (const H of HAMMERS) {
    const z0 = H.z - H.lane, z1 = H.z + H.lane;
    g.fillStyle = 'rgba(120,24,18,0.55)'; g.fillRect(H.x - 10, z0, 20, z1 - z0);
    for (const x of [H.x - 12, H.x + 10]) stripes(g, x, z0, 2, z1 - z0, 3, false);
    g.save(); g.translate(H.x, H.z); g.rotate(Math.PI / 2); g.font = 'bold 8px "Arial Black", Impact, sans-serif'; g.fillStyle = 'rgba(232,228,218,0.7)'; g.fillText('HAMMER', 0, 0); g.restore();
  }
  // the flame jets: soot fanning out from each across the floor, and a hazard bar on the floor at the wall under it
  for (const j of JETS.jets) {
    const dx = Math.cos(j.a), dz = Math.sin(j.a), px = -dz, pz = dx, L = JETS.len * 1.15;
    const gr = g.createLinearGradient(j.x, j.z, j.x + dx * L, j.z + dz * L); gr.addColorStop(0, 'rgba(18,14,12,0.65)'); gr.addColorStop(1, 'rgba(18,14,12,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(j.x + px * 2, j.z + pz * 2); g.lineTo(j.x + dx * L + px * 9, j.z + dz * L + pz * 9); g.lineTo(j.x + dx * L - px * 9, j.z + dz * L - pz * 9); g.lineTo(j.x - px * 2, j.z - pz * 2); g.fill();
    g.strokeStyle = '#e2b02a'; g.lineWidth = 1.6; g.setLineDash([1.5, 1.5]); g.beginPath(); g.moveTo(j.x + dx * 1.5 + px * 5, j.z + dz * 1.5 + pz * 5); g.lineTo(j.x + dx * 1.5 - px * 5, j.z + dz * 1.5 - pz * 5); g.stroke(); g.setLineDash([]);
  }
  // the magnet's reach: a dashed blue ring with arrows pointing in, and its name
  g.strokeStyle = 'rgba(80,160,255,0.75)'; g.lineWidth = 1.2; g.setLineDash([4, 3]); g.beginPath(); g.arc(MAGNET.x, MAGNET.z, MAGNET.r, 0, TAU); g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(80,160,255,0.55)';
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, co = Math.cos(a), sn = Math.sin(a), r = MAGNET.r - 4; g.beginPath(); g.moveTo(MAGNET.x + co * (r - 5), MAGNET.z + sn * (r - 5)); g.lineTo(MAGNET.x + co * r - sn * 2.5, MAGNET.z + sn * r + co * 2.5); g.lineTo(MAGNET.x + co * r + sn * 2.5, MAGNET.z + sn * r - co * 2.5); g.fill(); }
  g.strokeStyle = 'rgba(80,160,255,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.arc(MAGNET.x, MAGNET.z, 9, 0, TAU); g.stroke();
  g.save(); g.translate(MAGNET.x - 22, MAGNET.z); g.rotate(-Math.PI / 2); g.font = 'bold 7px "Arial Black", Impact, sans-serif'; g.fillStyle = 'rgba(120,190,255,0.7)'; g.fillText('MAGNET', 0, 0); g.restore();
  // oil on the depot's floor and the boneyard's, and a red and white ring round each barrel's spot
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(14,12,10,${0.12 + rand() * 0.2})`; g.beginPath(); g.ellipse(752 + rand() * 90, 430 + rand() * 300, 4 + rand() * 10, 3 + rand() * 7, rand() * 3, 0, TAU); g.fill(); }
  for (const p of BARRELS.spots) { g.strokeStyle = '#c23b2e'; g.lineWidth = 0.8; g.setLineDash([1.5, 1.5]); g.beginPath(); g.arc(p.x, p.z, 3.4, 0, TAU); g.stroke(); g.setLineDash([]); }
  // the boost strips: blue, with chevrons pointing the way they push (into the pit)
  for (const b of BOOSTS) {
    g.fillStyle = '#1d3f6e'; g.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    const dir = Math.cos(b.yaw) > 0 ? 1 : -1, mx = (b.x0 + b.x1) / 2, hw = (b.x1 - b.x0) / 2 - 1.5;
    g.strokeStyle = '#5fc8ff'; g.lineWidth = 2;
    for (let z = b.z0 + 6; z < b.z1 - 4; z += 9) { g.beginPath(); g.moveTo(mx - hw, z - dir * 4); g.lineTo(mx, z + dir * 2); g.lineTo(mx + hw, z - dir * 4); g.stroke(); }
  }
  // a ring under each pickup, in its colour, so you can see where one comes back
  for (const p of PICKUP_SPOTS) { const k = PICKUPS[p.kind]; g.strokeStyle = k.css; g.lineWidth = 1.1; g.beginPath(); g.arc(p.x, p.z, 6, 0, TAU); g.stroke(); g.globalAlpha = 0.25; g.fillStyle = k.css; g.fill(); g.globalAlpha = 1; }
  I();
  if (!PHONE) return c.cv;
  // Phones get the floor at half the pixels (two a voxel, still finer than the speckle), as New York's: about 50 MB less
  const half = document.createElement('canvas'); half.width = c.cv.width >> 1; half.height = c.cv.height >> 1;
  const h = half.getContext('2d'); h.imageSmoothingQuality = 'high'; h.drawImage(c.cv, 0, 0, half.width, half.height);
  c.cv.width = c.cv.height = 1;
  return half;
}
// the same test for a phone as main.js's
const PHONE = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

// ---- the map -------------------------------------------------------------------------------------------------------
// Routes: a line to a waypoint must be clear by six voxels either side (a car is up to five and a bit from its middle
// to its side). Everything past the ring is shut for good (the world goes on past it). The route grid shuts its cells
// over each hazard while it is dangerous (the sweeper's reach always, a jet while it is lit or lighting, the magnet
// while it hums or pulls, the press's pad while it comes down), so rivals are routed round them; and the line from a
// car to its next waypoint must not cut across one either, as the route grid's own line test only sees voxels. (A
// rival chasing a car in plain sight drives straight at it, and keeps clear of the hazards itself, by hazards.js's
// steerClear.)
const nav = makeGridNav({ cell: 4, maxNodes: 16000, side: 6 });
const NC = nav.NX * nav.NZ, cellX = (i) => (i % nav.NX + 0.5) * nav.cell, cellZ = (i) => (Math.floor(i / nav.NX) + 0.5) * nav.cell;
const dyn = new Uint8Array(NC), dynWas = new Uint8Array(NC), out = new Uint8Array(NC);
for (let i = 0; i < NC; i++) out[i] = edge(cellX(i), cellZ(i), WALL) > -2 ? 1 : 0;
let zones = null;
// the open cells under each hazard (worked out once the route grid has first looked at the voxels)
function makeZones() {
  const where = (f) => { const o = []; for (let i = 0; i < NC; i++) if (!nav.blocked[i] && f(cellX(i), cellZ(i))) o.push(i); return o; };
  const L = JETS.len * 1.3;   // as far as a jet reaches when it is wild
  zones = {
    sweep: where((x, z) => Math.hypot(x - SX, z - SZ) < SWEEP.r1 + 11),   // (the saws at the blades' tips reach a car's end a little past r1)
    magnet: where((x, z) => Math.hypot(x - MAGNET.x, z - MAGNET.z) < 30),
    press: where((x, z) => x > PRESS.x0 - 3 && x < PRESS.x1 + 3 && z > PRESS.z0 - 3 && z < PRESS.z1 + 3),
    jets: JETS.jets.map((j) => where((x, z) => {
      const px = x - j.x, pz = z - j.z, al = px * Math.cos(j.a) + pz * Math.sin(j.a), off = Math.abs(px * Math.sin(j.a) - pz * Math.cos(j.a));
      return al > -4 && al < L + 3 && off < 1.6 + 4.4 * Math.min(1, Math.max(0, al / JETS.len)) + 5;
    })),
  };
}
// the radar draws the route grid inside the ring, but not the hazards' stand-in walls (it draws the hazards themselves)
const shown = new Uint8Array(NC), gridR = gridRadar({ NX: nav.NX, NZ: nav.NZ, blocked: shown });
let shownT = 0;
function routeStep(dt) {
  nav.step(dt);
  if (!zones) makeZones();
  dynWas.set(dyn); dyn.fill(0);
  const mark = (list) => { for (const i of list) dyn[i] = 1; };
  mark(zones.sweep);
  if (MAGNET.on) mark(zones.magnet);
  if (PRESS.danger) mark(zones.press);
  JETS.jets.forEach((j, k) => { if (j.on) mark(zones.jets[k]); });
  for (let i = 0; i < NC; i++) { if (dyn[i] || out[i]) nav.blocked[i] = 1; else if (dynWas[i]) nav.blocked[i] = 0; }
  if ((shownT -= dt) <= 0) { shownT = 1; shown.set(nav.blocked); for (let i = 0; i < NC; i++) if (dyn[i] || out[i]) shown[i] = 0; }
}
// is the straight line between two points clear of the hazards' shut cells?
function hazardFree(x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2);
  for (let k = 1; k <= n; k++) { const f = k / n; if (dyn[nav.cellOf(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f)]) return false; }
  return true;
}
// A car in a shut cell (among the blades, in a flame, under the magnet) has nowhere for a route to start from: it
// makes for the nearest open cell first (leaning toward its target), and a little past it.
function nearestOpen(c, tx, tz, o) {
  const ci = nav.cellOf(c.x, c.z), cx = ci % nav.NX, cz = Math.floor(ci / nav.NX);
  let best = -1, bd = 1e9;
  for (let r = 1; r <= 18 && best < 0; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= nav.NX || z >= nav.NZ) continue;
    const i = z * nav.NX + x; if (nav.blocked[i]) continue;
    const d = Math.hypot(dx, dz) * nav.cell + 0.3 * Math.hypot(cellX(i) - tx, cellZ(i) - tz);
    if (d < bd) { bd = d; best = i; }
  }
  if (best < 0) { o.x = tx; o.z = tz; return o; }
  const x = cellX(best), z = cellZ(best), dx = x - c.x, dz = z - c.z, l = Math.hypot(dx, dz) || 1;
  o.x = x + dx / l * 6; o.z = z + dz / l * 6; return o;
}
function waypoint(c, tx, tz, o) {
  if (!zones) return nav.waypoint(c, tx, tz, o);
  if (dyn[nav.cellOf(c.x, c.z)]) return nearestOpen(c, tx, tz, o);
  nav.waypoint(c, tx, tz, o);
  if (hazardFree(c.x, c.z, o.x, o.z)) return o;
  // the line cuts across a hazard: find the route again if it runs through one (it was found before that one lit up),
  // then take the furthest point along it that the car can reach without crossing one
  const st = c._nav;
  if (st && st.path && st.path.some((n) => dyn[n])) { st.next = 0; nav.waypoint(c, tx, tz, o); }
  const P = st && st.path; if (!P) return o;
  // (the furthest with a car's width clear either side as well, as the route grid picks them; failing that, the
  // furthest clear of the hazards, for the car to feel its way along; failing that, the next cell)
  let far = -1, near = -1;
  for (let i = 0; i < P.length - 1; i++) {
    const x = cellX(P[i]), z = cellZ(P[i]);
    if (Math.hypot(x - c.x, z - c.z) > 80 || !hazardFree(c.x, c.z, x, z)) continue;
    if (near < 0) near = i;
    if (lineClear(c.x, c.z, x, z, 3, 6)) { far = i; break; }
  }
  const n = P[far >= 0 ? far : near >= 0 ? near : Math.max(0, P.length - 2)]; o.x = cellX(n); o.z = cellZ(n);
  return o;
}
export default {
  id: 'arena', name: 'Hammerdown Arena', mode: 'brawl',
  blurb: 'A demolition derby pit on television: a big mud bowl for ramming, ringed by tyre walls, concrete and stacked wrecks, with the traps round the edge: a sweeper, two hammers, flame jets, a press, a magnet and a strike in the eye.',
  loading: ['Building the pit', 'Setting the sweeper, the hammers and the magnet'],
  outer: 0x6e6b64,
  // The world past the stadium, at night (backdrop.js): the parking lot round it, the avenues out east and west, an
  // elevated road round the lot, the city beyond and the show's blimp. All of it is to look at; nothing of it is solid.
  //   - The ground stops under the ring wall (the hole is the wall's line, a little out).
  //   - The apron is concrete round everything build() puts outside the ring (the booth reaches out to x 96, the stands'
  //     backs to z 243 and 780, the fuel tanks and the crane's jib to x 884), with margin; the drive goes round it, and
  //     the lot's first aisle meets the drive (backdrop.js has the lot's rows).
  //   - The towers stand out to `city` from the middle: with the camera anywhere in the pit, their far sides are still
  //     inside its far edge (2400).
  backdrop: {
    x: CX, z: CZ,
    hole: { hx: WALL.hx + 2.5, hz: WALL.hz + 2.5, r: WALL.r + 2.5 },
    apron: { hx: 436, hz: 290, r: 40 }, drive: 36,
    lot: { hx: 840, hz: 720, r: 340 },
    avenueEnd: 1640,
    highway: { hx: 1060, hz: 920, r: 440, w: 90, y: 56 },
    city: 1930,
    blimp: { name: 'HAMMERDOWN', sub: 'CH 6 LIVE', x: CX, z: CZ, rx: 940, rz: 800, y: 190, len: 200, speed: 55, a0: 2.2 },
  },
  build() {
    ctx.L = 2; seed = 1234567;
    ring(); stand(0); stand(1); gantry(0); gantry(1); sweeperFrame(); westEnd(); eastEnd(); boneyard(); floodlights();
    finish();
  },
  ground: () => { seed = 7654321; return paint(); },
  spawn: { x: 560, z: 668, yaw: Math.atan2(CX - 560, CZ - 668) },
  spots: SPOTS,      // (modes/brawl.js picks among them itself)
  pit: { x: CX, z: CZ },   // where the fighting is (ai.js)
  waypoint,
  spawnPoint: (player, taken) => pickSpot(SPOTS, player, taken),
  step: routeStep,
  pickups: PICKUP_SPOTS,
  // the show runs at night (looks/night.js): the floodlights' banks of lamps, the ring (the light falls off toward its
  // walls), the searchlights outside and the crowd's cameras
  look: { kind: 'night', banks: BANKS, ring: { x: CX, z: CZ, ...WALL }, searchlights: SEARCH, crowd: crowdSpots() },
  // the set pieces first (they move cars about), then the bounds (which hold cars inside the ring's line even where
  // rockets have blown it open) and the keepouts (nothing can shove a car into the steel of the frame's legs, which it
  // could not dig out of)
  hazards: [SWEEP, ...HAMMERS, JETS, MAGNET, PRESS, ...BELTS, BARRELS, ...BOOSTS, SHOW, BOARD,
    { kind: 'bounds', x: CX, z: CZ, ...WALL },
    ...LEGS.map(([a, b]) => ({ kind: 'keepout', x: SX + a + 1.5, z: SZ + b + 1.5, r: 1.9 }))],
  // the radar shows the ring and what is in it
  radarBox: [CX - WALL.hx - 12, CZ - WALL.hz - 12, CX + WALL.hx + 12, CZ + WALL.hz + 12],
  // the radar: the ring and the pit, what stands (from the route grid), then each set piece as it is now, the barrels
  // and the pickups that are up, and while the show has an event on, a frame round it all with the event's name and the
  // seconds left
  radar(R, s, ox, oy, w, h) {
    const X = (x) => ox + x * s, Y = (z) => oy + z * s, T = performance.now() / 1000, blink = (T * 8 | 0) & 1;
    R.save(); R.translate(ox, oy); R.scale(s, s);
    R.fillStyle = 'rgba(120,96,70,0.35)'; roundRect(R, WALL); R.fill();
    R.fillStyle = 'rgba(80,60,42,0.45)'; roundRect(R, PIT, 6); R.fill();
    R.lineWidth = 2 / s; R.strokeStyle = 'rgba(255,255,255,0.7)'; roundRect(R, WALL, -1.5); R.stroke();
    R.restore();
    gridR(R, s, ox, oy, w, h);
    // the sweeper: its reach, and its blades
    R.strokeStyle = 'rgba(255,90,60,0.4)'; R.lineWidth = 1; R.beginPath(); R.arc(X(SX), Y(SZ), SWEEP.r1 * s, 0, TAU); R.stroke();
    R.strokeStyle = 'rgba(255,70,50,0.95)'; R.lineWidth = 2;
    for (let k = 0; k < SWEEP.n; k++) { const a = (SWEEP.angle || 0) + k * TAU / SWEEP.n; R.beginPath(); R.moveTo(X(SX + Math.cos(a) * SWEEP.r0), Y(SZ + Math.sin(a) * SWEEP.r0)); R.lineTo(X(SX + Math.cos(a) * SWEEP.r1), Y(SZ + Math.sin(a) * SWEEP.r1)); R.stroke(); }
    // the hammers: the lane each crosses, and its head (red swinging low, blinking as it is about to go)
    for (const H of HAMMERS) {
      R.strokeStyle = 'rgba(255,200,60,0.35)'; R.lineWidth = 1; R.beginPath(); R.moveTo(X(H.x), Y(H.z - H.lane)); R.lineTo(X(H.x), Y(H.z + H.lane)); R.stroke();
      if (!H.head) continue;
      R.fillStyle = H.low ? 'rgba(255,60,40,1)' : H.warn && blink ? 'rgba(255,240,90,1)' : 'rgba(255,190,60,0.8)';
      R.beginPath(); R.arc(X(H.head.x), Y(H.head.z), H.low ? 3 : 2.2, 0, TAU); R.fill();
    }
    // the flame jets: a line along each one that is lit (thin while it is lighting)
    R.lineCap = 'round';
    for (const j of JETS.jets) {
      if (!j.on) continue;
      R.strokeStyle = j.hot ? 'rgba(255,130,30,0.95)' : 'rgba(255,170,60,0.55)'; R.lineWidth = j.hot ? 3 : 1.5;
      R.beginPath(); R.moveTo(X(j.x), Y(j.z)); R.lineTo(X(j.x + Math.cos(j.a) * (j.len || JETS.len)), Y(j.z + Math.sin(j.a) * (j.len || JETS.len))); R.stroke();
    }
    R.lineCap = 'butt';
    // the magnet's reach: dashed at rest, solid as it hums up, filled while it pulls
    R.setLineDash(MAGNET.on ? [] : [2, 2]); R.strokeStyle = MAGNET.on ? (MAGNET.pull || blink ? 'rgba(90,170,255,1)' : 'rgba(90,170,255,0.5)') : 'rgba(90,170,255,0.35)'; R.lineWidth = MAGNET.on ? 1.5 : 1;
    R.beginPath(); R.arc(X(MAGNET.x), Y(MAGNET.z), MAGNET.r * s, 0, TAU); R.stroke(); R.setLineDash([]);
    if (MAGNET.pull) { R.fillStyle = 'rgba(90,170,255,0.28)'; R.fill(); }
    // the belts, and the press's pad (red while it is down, orange as it is about to come down)
    R.fillStyle = 'rgba(190,196,204,0.3)'; for (const b of BELTS) R.fillRect(X(b.x0), Y(b.z0), (b.x1 - b.x0) * s, (b.z1 - b.z0) * s);
    R.fillStyle = PRESS.low ? 'rgba(255,60,40,0.8)' : PRESS.danger ? 'rgba(255,140,40,0.7)' : 'rgba(255,200,40,0.45)';
    R.fillRect(X(PRESS.x0), Y(PRESS.z0), (PRESS.x1 - PRESS.x0) * s, (PRESS.z1 - PRESS.z0) * s);
    R.fillStyle = 'rgba(255,80,60,0.85)';
    for (const b of BARRELS.spots) if (b.up !== false) R.fillRect(X(b.x) - 0.8, Y(b.z) - 0.8, 1.6, 1.6);
    for (const p of PICKUP_SPOTS) {
      if (!p.up) continue;
      const big = p.kind === 'super';
      R.fillStyle = PICKUPS[p.kind].css; R.beginPath(); R.arc(X(p.x), Y(p.z), big ? (blink ? 4 : 3.2) : 2.2, 0, TAU); R.fill();
    }
    if (SHOW.event) {
      R.strokeStyle = blink ? 'rgba(255,60,40,0.95)' : 'rgba(255,200,60,0.95)'; R.lineWidth = 3; R.strokeRect(1.5, 1.5, 147, 147);
      R.font = 'bold 10px sans-serif'; R.textAlign = 'center'; R.textBaseline = 'alphabetic'; R.fillStyle = '#fff';
      R.fillText(`${SHOW.name} ${Math.ceil(SHOW.left)}`, 75, 14); R.textAlign = 'start';
    }
  },
  nav,
};
