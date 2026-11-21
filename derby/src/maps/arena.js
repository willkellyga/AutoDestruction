// Hammerdown Arena: a ground built for car combat and dressed as a television show, laid out the way the vehicle combat
// games lay out theirs, with a set piece in every part of it (derby/docs/arena.md has the research and how each idea is
// used here).
//   - A wide loop runs round inside the wall, with big round corners and boost strips on the two long straights, so a car
//     never has to stop and turn on the spot. Nothing on the map is a dead end.
//   - The middle is the sweeper: three blades turning low over the floor under the big screen, with the Hammerdown
//     strike (the super weapon) in the still eye at its heart, and scrap out among the blades.
//   - Each straight has a hammer hung from its gantry, latched up at one side of the lane, that blinks, lets go and
//     swings across; a repair kit sits right under it.
//   - Flame jets in the walls of the four corners, firing in turns along the corner, two opposite corners at a time.
//   - The west lane's press, fed by two conveyor belts on its inside line (and a repair kit under it); the east lane's
//     magnet, hung from a crane over the fuel depot, that drags every car in reach into the barrels round the nitro.
//   - Every so often the announcer calls an event ("Hammer time!", "Fire in the hole!", "Spin cycle!"): for fifteen
//     seconds one set of hazards goes wild, and the strike drops in the eye.
//   - Cover between the loop and the middle breaks the line of fire: concrete walls that only rockets wear down, and tyre
//     walls and stacked containers that a fast car smashes through.
//   - Stands, floodlights, gantries and sponsor boards (all made-up names) all round, and the floor is painted to match.
// Waves of rivals; they find their way with the route grid (which shuts over each hazard while it is dangerous), keep
// clear of the hazards as they drive (hazards.js), and go for the pickups when hurt (pickups.js, ai.js). The hazards and
// the pickups are run by hazards.js and pickups.js from the lists below.
import { WX, WZ, M, set, box, walls, begin, ctx } from '../../../src/world.js';
import { face, text, textW, disc } from '../../../src/kit.js';
import { makeGridNav, canvasFor, finish, pickSpot, gridRadar, lineClear, GK } from './common.js';
import { PICKUPS } from '../pickups.js';

const TAU = Math.PI * 2;
// Everything is laid out round the middle, and most of it twice: as drawn, and turned half way round it, so each side
// of the arena has the same room and the same cover. (The ends differ: that is what tells you where you are.)
const CX = 256, CZ = 208;
const turn = (x, z) => [WX - 1 - x, WZ - 1 - z];   // a voxel turned half way round the middle
// The wall's inside edge (x 30..482, z 46..370) and the loop's inside line (x 108..404, z 106..310): rounded rectangles.
const WALL = { hx: 226, hz: 162, r: 72 }, IN = { hx: 148, hz: 102, r: 24 };
// signed distance from a point to a rounded rectangle round the middle (less than 0 inside)
function edge(x, z, S) {
  const qx = Math.abs(x - CX) - (S.hx - S.r), qz = Math.abs(z - CZ) - (S.hz - S.r);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - S.r;
}
// a little seeded random, so the crowd and the paint come out the same every time
let seed = 1234567;
const rand = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 8) & 0xffff) / 65536; };
const pick = (a) => a[Math.floor(rand() * a.length)];

// ---- the live parts: where the pickups and hazards are (run by pickups.js and hazards.js) -----------------------
// Pickups sit where it is risky to go: the strike in the sweeper's eye, scrap among its blades, repair kits under the
// hammers and the press, nitro under the magnet (among the barrels), and overcharge and more nitro in the cover.
const SUPER = { kind: 'super', x: CX, z: CZ };
const PICKUP_SPOTS = [
  SUPER,
  { kind: 'repair', x: 256, z: 76 }, { kind: 'repair', x: 256, z: 340 }, { kind: 'repair', x: 88, z: 208 },
  { kind: 'nitro', x: 440, z: 208 }, { kind: 'nitro', x: 334, z: 160 }, { kind: 'nitro', x: 178, z: 256 },
  { kind: 'ammo', x: 172, z: 158 }, { kind: 'ammo', x: 340, z: 258 },
  { kind: 'scrap', x: CX + 30, z: CZ, rivals: false }, { kind: 'scrap', x: CX - 30, z: CZ, rivals: false },   // (bait for you alone)
];
// the sweeper: three blades from 14 out to 46 round the middle, a turn every twelve seconds (twice as fast in a spin cycle)
const SWEEP = { kind: 'sweeper', x: CX, z: CZ, n: 3, r0: 14, r1: 46, spin: TAU / 12, top: 40, wild: 'spin' };
// a hammer under each gantry, swinging across its straight (along z), the two out of step
const HAMMERS = [
  { kind: 'hammer', x: 256, z: 76, y: 32, len: 26.5, axis: 'z', lane: 30, wild: 'hammer', offset: 4 },
  { kind: 'hammer', x: 256, z: 340, y: 32, len: 26.5, axis: 'z', lane: 30, wild: 'hammer', offset: 6 },
];
// three flame jets round each corner of the wall, pointing in at the corner's middle: the north-east and south-west
// corners fire together, then the other two, each corner's three in the order the traffic goes round it
const CORNERS = [[410, 118, -Math.PI / 2, 0], [410, 298, 0, 1], [102, 298, Math.PI / 2, 0], [102, 118, Math.PI, 1]];
const JETS = { kind: 'jets', len: 26, wild: 'fire', jets: CORNERS.flatMap(([x, z, a0, group]) => [1, 2, 3].map((i) => {
  const a = a0 + i * Math.PI / 8;
  return { x: x + Math.cos(a) * (WALL.r - 1), z: z + Math.sin(a) * (WALL.r - 1), a: a + Math.PI, group, step: i - 1 };
})) };
// the magnet over the fuel depot, hung from the crane behind the east wall
const MAGNET = { kind: 'magnet', x: 440, z: 208, r: 48, y: 36, top: 54, wild: 'spin' };
// the press's pad runs right up to its column, so a car held out of it is never squeezed into the column
const PRESS = { kind: 'press', x0: 70, z0: 190, x1: 109, z1: 226, top: 46, rods: [[88, 198], [88, 218]], shut: ['x1'], wild: 'hammer' };   // rods up into the arm's tie
// and a belt either side of it on the inside line, both running into it
const BELTS = [
  { kind: 'conveyor', x0: 70, z0: 138, x1: 109, z1: 188, yaw: 0, speed: 18 },
  { kind: 'conveyor', x0: 70, z0: 228, x1: 109, z1: 278, yaw: Math.PI, speed: 18 },
];
const BARRELS = { kind: 'barrels', spots: [
  // the fuel depot: two clusters on the inside line of the east lane, and two pairs guarding the nitro
  { x: 405, z: 147 }, { x: 410, z: 149 }, { x: 406, z: 153 },
  { x: 405, z: 269 }, { x: 410, z: 267 }, { x: 406, z: 263 },
  { x: 437, z: 194 }, { x: 443, z: 192 }, { x: 437, z: 222 }, { x: 443, z: 224 },
  // at the tanker's two ends
  { x: 385, z: 181 }, { x: 385, z: 235 },
] };
const BOOSTS = [
  { kind: 'boost', x0: 290, z0: 52, x1: 370, z1: 66, yaw: Math.PI / 2 },     // the north straight, heading east
  { kind: 'boost', x0: 142, z0: 350, x1: 222, z1: 364, yaw: -Math.PI / 2 },  // the south straight, heading west
];
// the announcer's events, in turn; each drops the strike in the eye if it is not there already
const SHOW = { kind: 'show', first: 35, every: 45, time: 15, events: [
  { tag: 'hammer', name: 'HAMMER TIME!', sub: 'Nonstop hammers. A strike drops in the eye' },
  { tag: 'fire', name: 'FIRE IN THE HOLE!', sub: 'Every flame jet lit. A strike drops in the eye' },
  { tag: 'spin', name: 'SPIN CYCLE!', sub: 'Fast blades, live magnet. A strike drops in the eye' },
], onEvent: () => { if (!SUPER.up) SUPER.t = Math.min(SUPER.t ?? 1, 1); } };
// the four legs of the screen's frame (round the sweeper): steel, so nothing may bury a car in one
const LEGS = [[-50, -50], [48, -50], [-50, 48], [48, 48]];
// Where rivals (and the player, after a wreck) come in: spread evenly round the loop, each facing along it (clockwise),
// clear of the hammers and the corners' flames, so nobody starts nose to a wall or in someone's sights.
const SPOTS = [
  ...[140, 196, 312].map((x) => ({ x, z: 76, yaw: Math.PI / 2 })),
  ...[150, 266].map((z) => ({ x: 444, z, yaw: 0 })),
  ...[372, 316, 200].map((x) => ({ x, z: 340, yaw: -Math.PI / 2 })),
  ...[266, 150].map((z) => ({ x: 62, z, yaw: Math.PI })),
  { x: 82, z: 98, yaw: Math.PI * 0.75 }, { x: 430, z: 98, yaw: Math.PI * 0.25 }, { x: 430, z: 318, yaw: -Math.PI * 0.25 }, { x: 82, z: 318, yaw: -Math.PI * 0.75 },
];

// ---- building ----------------------------------------------------------------------------------------------------
// The colours of the two sides: blue on the north, red on the south.
const SIDE = [{ seat: M.CAR_B, led: M.LIT_B }, { seat: M.CAR_A, led: M.LIT_R }];

// The arena wall: concrete with a cap, a catch fence of posts and rails on top, sponsor boards along the straights and
// red and white blocks round the corners. A car bounces off it however fast it goes. It is cut into tiles so a hit on it
// only has to check its own piece.
const BOARDS = ['KRANKO OIL', 'BOLTZ', 'GRIT TYRES', 'FIZZBANG', 'LUGNUT', 'AMPED', 'CH 6 LIVE', 'MEGAWATT'];
function arenaWall() {
  const T = 32;
  for (let tx = 0; tx < WX; tx += T) for (let tz = 0; tz < WZ; tz += T) {
    let any = false;
    for (let x = tx; x < tx + T; x++) for (let z = tz; z < tz + T; z++) {
      const e = edge(x + 0.5, z + 0.5, WALL); if (e < 0 || e >= 3) continue;
      if (!any) { begin('Arena wall', 'barrier', false); any = true; }
      const ox = Math.abs(x + 0.5 - CX) - (WALL.hx - WALL.r), oz = Math.abs(z + 0.5 - CZ) - (WALL.hz - WALL.r), curve = ox > 0 && oz > 0;
      const a = Math.atan2(z + 0.5 - CZ, x + 0.5 - CX), arc = curve ? Math.floor(Math.atan2(oz, ox) * (WALL.r + 1.5)) : (oz > 0 ? x : z);
      for (let y = 0; y <= 9; y++) set(x, y, z, M.CONC);
      if (e < 1 && curve) for (let y = 2; y <= 8; y++) set(x, y, z, (arc >> 2) & 1 ? M.TRIM : M.CAR_A);
      // the cap, with a strip of lights along the straights in the side's colour
      const side = Math.sin(a) < 0 ? 0 : 1;
      set(x, 10, z, e < 1 && !curve && oz > 0 ? (x & 1 ? SIDE[side].led : M.DARK) : M.TRIM);
      if (e >= 1 && e < 2) {   // the catch fence along the middle of the wall
        set(x, 16, z, M.STEEL); set(x, 24, z, M.STEEL);
        if (((arc % 6) + 6) % 6 === 0) for (let y = 11; y <= 23; y++) set(x, y, z, M.STEEL);
      }
    }
  }
  // sponsor boards on the inside face of the four straights
  const board = (F, u0, len, i) => {
    const bg = [M.DARK, M.TRIM, M.SIGN, M.CAR_B, M.DARK, M.CAR_A][i % 6], fg = bg === M.TRIM || bg === M.SIGN ? M.DARK : [M.LIT_Y, M.LIT_W][i & 1];
    F.box(u0, 2, u0 + len - 1, 8, 0, 0, bg);
    const s = BOARDS[i % BOARDS.length]; text(F, s, u0 + ((len - textW(s)) >> 1), 3, 0, fg);
  };
  const straights = [['b', 102, 44, 409, 45], ['f', 102, 370, 409, 371], ['r', 28, 118, 29, 297], ['l', 482, 118, 483, 297]];
  straights.forEach(([side, x0, z0, x1, z1], si) => {
    const F = face(side, x0, z0, x1, z1), n = Math.floor(F.W / 44);
    for (let i = 0; i < n; i++) { begin('Sponsor board', 'barrier', false); board(F, i * 44 + 2, 40, i + si * 3); }
  });
}

// A grandstand along the north side (or the south, turned round): twelve rows of seats stepping back and up from the
// wall, a crowd, a back wall, and boards on top. Cut into sections so a rocket only makes one section check itself.
function stand(s) {
  const P = (x, z) => (s ? turn(x, z) : [x, z]);
  const S = (x, y, z, m) => { const [a, b] = P(x, z); set(a, y, b, m); };
  const shirts = [M.CAR_A, M.CAR_B, M.CAR_C, M.TAXI, M.TRIM, M.DARK, M.SIGN, M.REND_T, M.REND_P, M.COPPER], heads = [M.REND_C, M.MUD, M.OCHRE, M.BROWNST, M.REND_P];
  const rowY = (k) => 11 + 2 * k;
  for (let x0 = 6; x0 <= 505; x0 += 32) {
    begin('Grandstand', 'stand', false);
    for (let x = x0; x < Math.min(506, x0 + 32); x++) {
      const team = s ? SIDE[1].seat : SIDE[0].seat, sect = ((x - 6) / 16 | 0) & 1;
      for (let k = 0; k < 12; k++) {
        const zf = 42 - 3 * k, y = rowY(k);
        // the riser under the front of the row, the seats, and the slab under them
        for (let yy = k ? rowY(k - 1) : 0; yy < y; yy++) S(x, yy, zf, M.CONC);
        for (let z = zf - 2; z <= zf; z++) { S(x, y, z, z === zf ? M.CONC : (x % 23 === 0 ? M.SLAB : sect ? team : M.TRIM)); S(x, y - 1, z, M.CONC); }
        // the crowd: a shirt and a head on most seats, and now and then a flag in the side's colour
        if (x % 23 && rand() < 0.62) { S(x, y + 1, zf - 1, pick(shirts)); S(x, y + 2, zf - 1, pick(heads)); }
        else if (x % 23 && rand() < 0.02) { for (let yy = y + 1; yy <= y + 5; yy++) S(x, yy, zf - 1, M.DARK); S(x + 1, y + 5, zf - 1, team); S(x + 2, y + 5, zf - 1, team); S(x + 1, y + 4, zf - 1, team); S(x + 2, y + 4, zf - 1, M.TRIM); }
      }
      for (let y = 0; y <= rowY(11) + 6; y++) S(x, y, 6, y === rowY(11) + 6 ? M.TRIM : M.CONC);
    }
  }
  // boards on top of the back wall: the show in the middle, two sponsors either side
  const boards = [[176, 335, 'HAMMERDOWN', 3, M.LIT_Y], [36, 166, s ? 'GRIT TYRES' : 'KRANKO OIL', 2, M.LIT_W], [345, 475, s ? 'MEGAWATT' : 'FIZZBANG', 2, M.LIT_W]];
  for (const [a, b, str, sc, col] of boards) {
    begin('Sign', 'sign', false);
    const h = sc * 5 + 6, y0 = rowY(11) + 7;
    const [ax, az] = P(a, 5), [bx, bz] = P(b, 6);
    box(Math.min(ax, bx), y0, Math.min(az, bz), Math.max(ax, bx), y0 + h, Math.max(az, bz), M.DARK);
    const F = s ? face('f', Math.min(ax, bx), 410, Math.max(ax, bx), 411) : face('b', a, 4, b, 5);
    text(F, str, ((b - a + 1) - textW(str, sc)) >> 1, y0 + 3, 1, col, sc);
    for (let u = 0; u <= b - a; u += 4) F.p(u, y0 + h, 1, col === M.LIT_Y ? M.LIT_R : M.LIT_B);   // a row of bulbs along the top
  }
}

// The west end: race control, a long block behind the wall with a strip of windows looking down the arena, its name
// lit up, and dishes on the roof. The east end: the fuel depot's two tanks, and between them the magnet's crane.
function ends() {
  for (const [z0, z1] of [[120, 178], [179, 237], [238, 296]]) {
    begin('Race control', 'building', true);
    walls(3, 0, z0, 26, 26, z1, M.CONC);
    box(3, 27, z0, 26, 27, z1, M.ROOF_D);
    const F = face('r', 3, z0, 26, z1);
    F.box(1, 14, F.W - 2, 20, 0, 0, M.GLASS);
    for (let u = 0; u < F.W; u += 8) F.box(u, 14, u, 20, 0, 0, M.DARK);
    F.box(0, 21, F.W - 1, 21, 0, 1, M.TRIM); F.box(0, 13, F.W - 1, 13, 0, 1, M.TRIM);
  }
  begin('Sign', 'sign', false);
  { box(26, 28, 140, 26, 41, 276, M.DARK); const F = face('r', 3, 120, 26, 296); text(F, 'RACE CONTROL', (177 - textW('RACE CONTROL', 2)) >> 1, 30, 1, M.LIT_W, 2); }
  for (const z of [150, 266]) {   // the broadcast dishes
    begin('Dish', 'prop', true);
    box(12, 28, z, 13, 33, z + 1, M.STEEL);
    for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) if (a * a + b * b <= 18) set(10 + Math.round(b * 0.3), 36 + a, z + b, M.TRIM);
  }
  // the fuel tanks, with the depot's name on them
  for (const z of [150, 266]) {
    begin('Fuel tank', 'tank', true);
    for (let y = 0; y <= 30; y++) disc(498, z, y, 10, y % 10 === 9 ? M.CAR_A : M.TRIM, y === 0 || y === 30 ? -1 : 9);
    for (let k = 1; k <= 3; k++) disc(498, z, 30 + k, 10 - k * 2.5, M.TRIM);
    begin('Sign', 'sign', false);
    box(490, 31, z - 12, 490, 38, z + 11, M.DARK);
    const F = face('l', 490, z - 12, 490, z + 11), str = z < 208 ? 'KRANKO' : 'FUEL';
    text(F, str, (24 - textW(str)) >> 1, 32, 1, z < 208 ? M.LIT_Y : M.LIT_W);
  }
  crane();
}

// The magnet's crane: a yellow lattice tower behind the east wall with its cab on top, a jib reaching out over the
// fuel depot (the magnet hangs from its trolley: hazards.js moves it), a concrete counterweight at the back, and the
// magnet's board hung under the jib, read from up and down the lane.
function crane() {
  begin('Crane', 'tower', true);
  const x0 = 491, x1 = 499, z0 = 204, z1 = 212;
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box(x, 0, z, x, 60, z, M.TAXI);
  for (let y = 6; y <= 60; y += 6) walls(x0, y, z0, x1, y, z1, M.TAXI);
  for (let y = 0; y < 60; y++) { const u = y % 12 < 6 ? y % 6 : 6 - (y % 6); set(x0 + 1 + u, y, z0, M.TAXI); set(x0 + 1 + u, y, z1, M.TAXI); set(x0, y, z0 + 1 + u, M.TAXI); set(x1, y, z0 + 1 + u, M.TAXI); }   // zig-zag bracing
  // the jib: two lattice sides along x, tied across top and bottom
  for (const z of [205, 211]) { box(424, 56, z, 512, 56, z, M.TAXI); box(428, 61, z, 508, 61, z, M.TAXI); for (let x = 424; x <= 510; x += 6) { box(x, 56, z, x, 61, z, M.TAXI); set(x + 3, 58, z, M.TAXI); set(x + 3, 59, z, M.TAXI); } }
  for (let x = 424; x <= 510; x += 6) { box(x, 56, 205, x, 56, 211, M.TAXI); box(x, 61, 205, x, 61, 211, M.TAXI); }
  box(436, 54, 205, 444, 55, 211, M.DARK);   // the trolley the magnet hangs from
  // the cab, looking down the jib
  walls(x0, 62, z0, x1, 68, z1, M.CAR_A); box(x0, 69, z0, x1, 69, z1, M.ROOF_D);
  box(x0, 64, z0 + 2, x0, 66, z1 - 2, M.GLASS);
  begin('Counterweight', 'prop', true);
  box(503, 46, 203, 511, 55, 213, M.CONC); for (let x = 503; x <= 511; x++) for (let y = 47; y <= 54; y += 3) { set(x, y, 203, M.CAR_A); set(x, y, 213, M.CAR_A); }
  begin('Sign', 'sign', false);
  box(452, 46, 208, 486, 54, 208, M.DARK);
  for (const F of [face('f', 452, 208, 486, 208), face('b', 452, 208, 486, 208)]) text(F, 'MAGNET', (35 - textW('MAGNET')) >> 1, 47, 1, M.LIT_B);
}

// Floodlights in the four corners, outside the wall: steel towers with a bank of lamps turned in toward the middle.
function floodlights() {
  for (const [px, pz] of [[37, 53], [469, 53], [37, 357], [469, 357]]) {
    begin('Floodlight', 'tower', true);
    for (const [a, b] of [[0, 0], [5, 0], [0, 5], [5, 5]]) box(px + a, 0, pz + b, px + a, 86, pz + b, M.STEEL);
    for (let y = 8; y <= 80; y += 9) walls(px, y, pz, px + 5, y, pz + 5, M.STEEL);
    const hx = px + 2, hz = pz + 2, fx = Math.sign(CX - hx), fz = Math.sign(CZ - hz);
    box(hx - 7, 87, hz - 7, hx + 8, 96, hz + 8, M.DARK);
    // the lamps, on the two faces that look at the arena
    for (let y = 88; y <= 95; y += 2) for (let u = -6; u <= 7; u += 2) {
      set(fx > 0 ? hx + 9 : hx - 8, y, hz + u, M.LIT_W); set(hx + u, y, fz > 0 ? hz + 9 : hz - 8, M.LIT_W);
    }
  }
}

// The gantries over the two long straights, on a pillar in the stand and one on the infield wall: the television gantry
// on the north (cameras, and the show's name both ways) and the start gantry on the south (the start lights). Each has
// a hammer hung under the middle of its span.
function gantry(s) {
  const P = (x, z) => (s ? turn(x, z) : [x, z]);
  const B = (x0, y0, z0, x1, y1, z1, m) => { const [a, b] = P(x0, z0), [c, d] = P(x1, z1); box(Math.min(a, c), y0, Math.min(b, d), Math.max(a, c), y1, Math.max(b, d), m); };
  begin('Gantry', 'gantry', true);
  B(252, 0, 36, 259, 41, 41, M.STEEL); B(252, 0, 116, 259, 41, 123, M.STEEL);
  // the truss: chords, posts, and the boards along both sides over the lane
  for (const x of [250, 261]) { B(x, 34, 36, x, 34, 123, M.STEEL); B(x, 41, 36, x, 41, 123, M.STEEL); for (let z = 36; z <= 123; z += 6) B(x, 34, z, x, 41, z, M.STEEL); }
  B(250, 41, 36, 261, 41, 123, M.METAL);
  for (let z = 40; z <= 120; z += 8) { B(250, 34, z, 261, 34, z + 1, M.STEEL); B(255, 33, z, 256, 33, z + 1, M.LIT_W); }   // lamps under it
  for (const x of [250, 261]) B(x, 31, 74, x, 33, 77, M.STEEL);   // the hangers for the hammer's axle (hazards.js swings the hammer)
  begin('Sign', 'sign', true);
  for (const x of [249, 262]) B(x, 34, 46, x, 40, 106, M.DARK);
  // the boards' outer faces look west and east (x 249 and 262 either way round), over the lane
  const str = s ? 'START' : 'HAMMERDOWN LIVE', za = s ? 309 : 46, zb = s ? 369 : 106;
  for (const F of [face('l', 249, za, 249, zb), face('r', 262, za, 262, zb)]) text(F, str, (61 - textW(str)) >> 1, 35, 1, s ? M.LIT_W : M.LIT_Y);
  if (s) {   // the start lights, up on top of the span (the hammer hangs under it), facing both ways
    begin('Start lights', 'sign', true);
    for (let i = 0; i < 5; i++) { const z = 66 + i * 5, col = i < 3 ? M.LIT_R : i === 3 ? M.LIT_Y : M.LIT_G; B(250, 42, z, 261, 47, z + 3, M.DARK); B(249, 43, z + 1, 249, 45, z + 2, col); B(262, 43, z + 1, 262, 45, z + 2, col); }
  } else {   // the cameras on top, with their red tally lights
    begin('Camera', 'prop', true);
    for (const z of [60, 92]) { B(254, 42, z, 257, 45, z + 5, M.DARK); B(253, 43, z + 1, 253, 44, z + 2, M.STEEL); B(256, 46, z + 2, 256, 46, z + 2, M.LIT_R); }
  }
}

// The middle: a steel frame on four legs round the sweeper, carrying the big screen (the show's name on all four
// sides) and the trophy on top of it, with the sweeper's column coming down from the screen to the drum. The drum and
// its blades are meshes (hazards.js turns them); the floor under them is open, so nothing there can trap a car.
function centre() {
  for (const [a, b] of LEGS) { begin('Frame leg', 'barrier', true); box(CX + a, 0, CZ + b, CX + a + 2, 62, CZ + b + 2, M.STEEL); for (let y = 4; y <= 10; y++) for (const [u, v] of [[0, 0], [2, 0], [0, 2], [2, 2]]) set(CX + a + u, y, CZ + b + v, (y >> 1) & 1 ? M.TAXI : M.DARK); }
  begin('Frame', 'gantry', true);
  box(CX - 50, 60, CZ - 50, CX + 50, 62, CZ - 48, M.STEEL); box(CX - 50, 60, CZ + 48, CX + 50, 62, CZ + 50, M.STEEL);
  box(CX - 50, 60, CZ - 50, CX - 48, 62, CZ + 50, M.STEEL); box(CX + 48, 60, CZ - 50, CX + 50, 62, CZ + 50, M.STEEL);
  box(CX - 50, 61, CZ - 1, CX + 50, 63, CZ, M.STEEL); box(CX - 1, 61, CZ - 50, CX, 63, CZ + 50, M.STEEL);   // the cross the screen sits on
  for (let y = 41; y <= 63; y++) disc(CX, CZ, y, y < 44 ? 4 : 2.6, y < 44 ? M.DARK : M.STEEL);   // the sweeper's column
  begin('Big screen', 'sign', true);
  const x0 = CX - 22, x1 = CX + 21, z0 = CZ - 22, z1 = CZ + 21;
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
  for (let y = 8; y <= 11; y++) disc(CX, CZ, y + Y, 10 - (y - 8), M.CHROME, y === 11 ? -1 : 8 - (y - 8));
  for (let y = 12; y <= 21; y++) disc(CX, CZ, y + Y, y < 20 ? 3 : 5, M.BRASS);
  for (let y = 22; y <= 38; y++) { const r = 6 + Math.min(5, (y - 22) * 0.55); disc(CX, CZ, y + Y, r, M.BRASS, y === 22 ? -1 : r - 1.5); }
  for (const s of [-1, 1]) for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI, x = CX + s * (11 + Math.round(Math.sin(a) * 4)) - (s < 0 ? 1 : 0), y = Y + 25 + Math.round(-Math.cos(a) * 5 + 5); set(x, y, CZ, M.BRASS); set(x, y, CZ - 1, M.BRASS); }
}
const faces4 = (x0, z0, x1, z1) => ['f', 'r', 'b', 'l'].map((s) => face(s, x0, z0, x1, z1));

// Cover between the loop and the middle, the same on both sides turned round.
//   - a concrete wall across each straight's view of the middle (a 'barrier': only rockets wear it down)
//   - a tyre yard: an L of tyre stacks, the overcharge in its corner, open to the middle
//   - two containers in an L (and a short one stacked on top), a nitro in its corner
// Tyres and containers are 'wall' bodies: a car going fast enough smashes through them.
function cover(s) {
  const P = (x, z) => (s ? turn(x, z) : [x, z]);
  const B = (x0, y0, z0, x1, y1, z1, m) => { const [a, b] = P(x0, z0), [c, d] = P(x1, z1); box(Math.min(a, c), y0, Math.min(b, d), Math.max(a, c), y1, Math.max(b, d), m); };
  const S = (x, y, z, m) => { const [a, b] = P(x, z); set(a, y, b, m); };
  // the concrete wall, jersey-shaped, with red and white blocks and a steel cap
  begin('Barrier', 'barrier', false);
  B(232, 0, 117, 279, 3, 122, M.CONC); B(232, 4, 118, 279, 12, 121, M.CONC); B(232, 13, 119, 279, 13, 120, M.STEEL);
  for (let x = 232; x <= 279; x++) for (let y = 5; y <= 9; y++) { const m = ((x - 232) / 6 | 0) & 1 ? M.TRIM : M.CAR_A; S(x, y, 118, m); S(x, y, 121, m); }
  // the tyre yard
  const stack = (x, z, top) => {
    begin('Tyre stack', 'wall', false);
    for (let y = 0; y <= 10; y++) for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
      const corner = (a === 0 || a === 5) && (b === 0 || b === 5), hole = a >= 2 && a <= 3 && b >= 2 && b <= 3;
      if (hole || (corner && y % 2)) continue;
      S(x + a, y, z + b, y === 10 ? top : M.TYRE);
    }
  };
  [152, 158, 164, 170, 176].forEach((x, i) => stack(x, 136, i & 1 ? M.CAR_A : M.TRIM));
  [142, 148, 154, 160].forEach((z, i) => stack(152, z, i & 1 ? M.TRIM : M.CAR_A));
  // the containers: steel boxes with posts, door bars at the ends and a dark rim, packed full on the ground (a hollow
  // one, smashed open, is a box a car can drive into and not turn round in)
  const container = (x0, y0, z0, x1, y1, z1, m) => {
    begin('Container', 'wall', false);
    const [a, b] = P(x0, z0), [c, d] = P(x1, z1), X0 = Math.min(a, c), X1 = Math.max(a, c), Z0 = Math.min(b, d), Z1 = Math.max(b, d);
    walls(X0, y0, Z0, X1, y1, Z1, m); box(X0, y1, Z0, X1, y1, Z1, m);
    if (!y0) box(X0 + 1, 0, Z0 + 1, X1 - 1, y1 - 1, Z1 - 1, M.DARK);
    const long = X1 - X0 > Z1 - Z0;
    for (let u = 0; u <= (long ? X1 - X0 : Z1 - Z0); u += 6) for (let y = y0; y <= y1; y++) {
      if (long) { set(X0 + u, y, Z0, M.DARK); set(X0 + u, y, Z1, M.DARK); } else { set(X0, y, Z0 + u, M.DARK); set(X1, y, Z0 + u, M.DARK); }
    }
    for (let y = y0; y <= y1; y++) for (let k = 2; k <= 7; k += 5) { if (long) { set(X0, y, Z0 + k, M.STEEL); set(X1, y, Z0 + k, M.STEEL); } else { set(X0 + k, y, Z0, M.STEEL); set(X0 + k, y, Z1, M.STEEL); } }
    walls(X0, y1, Z0, X1, y1, Z1, M.DARK);
  };
  container(310, 0, 134, 358, 10, 143, M.CAR_B);
  container(318, 11, 134, 341, 21, 143, M.TAXI);
  container(349, 0, 144, 358, 10, 192, M.CAR_A);
}

// The west lane's press: a steel column on the infield edge with an arm reaching out over the inside line, and pipes
// from race control. The slab itself is not voxels: hazards.js moves it. The east side's tanker is parked opposite.
function press() {
  begin('Press', 'barrier', false);
  walls(110, 0, 184, 121, 52, 231, M.STEEL); box(110, 52, 184, 121, 52, 231, M.STEEL);
  box(111, 0, 185, 120, 13, 230, M.STEEL);   // solid up to roof height, so a hole in its side is a dent and not a garage
  for (let z = 184; z <= 231; z++) for (let y = 2; y <= 8; y++) set(110, y, z, ((z + y) >> 2) & 1 ? M.TAXI : M.DARK);   // hazard stripes
  for (let z = 184; z <= 231; z++) for (let y = 2; y <= 8; y++) set(121, y, z, ((z + y) >> 2) & 1 ? M.TAXI : M.DARK);
  for (const z of [184, 231]) for (let x = 110; x <= 121; x++) for (let y = 2; y <= 8; y++) set(x, y, z, ((x + y) >> 2) & 1 ? M.TAXI : M.DARK);
  // the arm: two deep beams out over the lane, tied at the end and over the slab
  for (const z of [184, 228]) box(64, 40, z, 121, 49, z + 3, M.STEEL);
  box(64, 44, 184, 67, 49, 231, M.STEEL); box(86, 46, 188, 89, 49, 227, M.STEEL);
  for (let x = 64; x <= 121; x++) for (const z of [184, 231]) set(x, 44, z, M.TAXI);
  begin('Sign', 'sign', false);
  { const F = face('l', 110, 184, 110, 231); F.box(6, 32, 41, 46, 1, 1, M.DARK); text(F, 'THE', (48 - textW('THE')) >> 1, 40, 2, M.LIT_W); text(F, 'PRESS', (48 - textW('PRESS')) >> 1, 34, 2, M.LIT_Y); }
  begin('Pipes', 'prop', true);   // from race control's roof over the wall to the arm
  for (const z of [196, 220]) { box(24, 28, z, 25, 46, z + 1, M.CAR_A); box(26, 45, z, 64, 46, z + 1, M.CAR_A); }
  // the tanker, opposite on the east side: a cab and a tank on wheels, in the fuel depot's colours
  begin('Tanker', 'wall', false);
  box(391, 2, 184, 400, 12, 195, M.CAR_B); box(392, 8, 184, 399, 11, 184, M.GLASS); box(390, 0, 186, 401, 2, 193, M.DARK);
  for (let z = 197; z <= 231; z++) for (let y = 0; y <= 13; y++) for (let x = 390; x <= 401; x++) {
    const dy = y - 7.5, dx = x + 0.5 - 395.5, r = Math.hypot(dx, dy);
    if (y >= 3 && r <= 6) set(x, y, z, r < 5 ? M.DARK : Math.abs(dy) < 1 ? M.CAR_A : M.CHROME);   // full, like the containers
  }
  for (const z of [188, 202, 210, 222, 228]) for (const x of [390, 401]) box(x, 0, z, x, 3, z + 3, M.TYRE);
  box(395, 14, 203, 396, 20, 228, M.DARK);   // a board along the top of the tank
  for (const F of [face('l', 395, 203, 395, 228), face('r', 396, 203, 396, 228)]) text(F, 'KRANKO', (26 - textW('KRANKO')) >> 1, 15, 1, M.LIT_Y);
}

// ---- the painted floor -------------------------------------------------------------------------------------------
function roundRect(g, S, inset = 0) {
  const x0 = CX - S.hx + inset, x1 = CX + S.hx - inset, z0 = CZ - S.hz + inset, z1 = CZ + S.hz - inset, r = Math.max(1, S.r - inset);
  g.beginPath(); g.moveTo(x0 + r, z0); g.lineTo(x1 - r, z0); g.arc(x1 - r, z0 + r, r, -Math.PI / 2, 0); g.lineTo(x1, z1 - r); g.arc(x1 - r, z1 - r, r, 0, Math.PI / 2);
  g.lineTo(x0 + r, z1); g.arc(x0 + r, z1 - r, r, Math.PI / 2, Math.PI); g.lineTo(x0, z0 + r); g.arc(x0 + r, z0 + r, r, Math.PI, Math.PI * 1.5); g.closePath();
}
function paint() {
  const c = canvasFor('#6e6b64', 91), g = c.g;
  const V = () => g.setTransform(GK, 0, 0, GK, 0, 0), I = () => g.setTransform(1, 0, 0, 1, 0, 0);
  c.speckle(0, 0, WX, WZ, 30000, ['rgba(40,38,34,0.25)', 'rgba(200,196,186,0.2)']);
  // the loop: asphalt, speckled, with a white line round the outside
  g.save(); V(); roundRect(g, WALL); g.fillStyle = '#45484d'; g.fill(); g.clip(); I();
  c.speckle(30, 46, 482, 370, 110000, ['rgba(20,22,26,0.4)', 'rgba(120,124,130,0.35)', 'rgba(90,92,96,0.4)']);
  V(); g.strokeStyle = '#e8e4da'; g.lineWidth = 1.2; roundRect(g, WALL, 4); g.stroke();
  // tyre marks round the corners and along the straights
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const a = rand() * TAU, k = 0.55 + rand() * 0.35;
    g.strokeStyle = `rgba(16,16,18,${0.12 + rand() * 0.18})`; g.lineWidth = 1 + rand() * 1.5;
    g.beginPath(); g.ellipse(CX + (rand() - 0.5) * 60, CZ + (rand() - 0.5) * 40, WALL.hx * k + 20, WALL.hz * k + 10, 0, a, a + 0.4 + rand() * 0.9); g.stroke();
  }
  g.restore();
  // the infield: packed dirt inside the loop's inside line, with a dashed line and red and white kerbs round its corners
  g.save(); V(); roundRect(g, IN); g.fillStyle = '#7b6448'; g.fill(); g.clip(); I();
  c.speckle(108, 106, 404, 310, 60000, ['rgba(60,46,32,0.35)', 'rgba(160,136,104,0.3)', 'rgba(96,80,60,0.4)']);
  V();
  for (let i = 0; i < 40; i++) { const x = 120 + rand() * 272, z = 118 + rand() * 180; g.strokeStyle = `rgba(40,30,20,${0.1 + rand() * 0.15})`; g.lineWidth = 2 + rand() * 2; g.beginPath(); g.arc(x, z, 20 + rand() * 60, rand() * TAU, rand() * TAU); g.stroke(); }
  g.restore(); V();
  g.lineWidth = 3; g.strokeStyle = '#e8e4da'; roundRect(g, IN, -1.5); g.stroke();
  g.setLineDash([5, 5]); g.strokeStyle = '#c23b2e'; roundRect(g, IN, -1.5); g.stroke(); g.setLineDash([]);
  // the middle: a white ring, a yellow and black band, and the sweeper's steel deck, with the blades' track worn into
  // it and the eye a red and white target
  g.fillStyle = '#e8e4da'; g.beginPath(); g.arc(CX, CZ, 57, 0, TAU); g.fill();
  g.fillStyle = '#7b6448'; g.beginPath(); g.arc(CX, CZ, 55.5, 0, TAU); g.fill();
  for (let k = 0; k < 60; k++) { g.fillStyle = k & 1 ? '#1c1c1e' : '#e2b02a'; g.beginPath(); g.arc(CX, CZ, 55, k / 60 * TAU, (k + 1) / 60 * TAU); g.arc(CX, CZ, 51, (k + 1) / 60 * TAU, k / 60 * TAU, true); g.fill(); }
  g.fillStyle = '#3a3d42'; g.beginPath(); g.arc(CX, CZ, 51, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(20,20,22,0.55)'; g.lineWidth = 0.4;
  for (let r = 16; r < 50; r += 6) { g.beginPath(); g.arc(CX, CZ, r, 0, TAU); g.stroke(); }
  for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; g.beginPath(); g.moveTo(CX + Math.cos(a) * 15, CZ + Math.sin(a) * 15); g.lineTo(CX + Math.cos(a) * 50, CZ + Math.sin(a) * 50); g.stroke(); }
  g.strokeStyle = 'rgba(200,200,205,0.18)'; g.lineWidth = 2.5; g.beginPath(); g.arc(CX, CZ, 46, 0, TAU); g.stroke();   // where the saws run
  [[13.5, '#e8e4da'], [11.5, '#c23b2e'], [8.5, '#e8e4da'], [5.5, '#c23b2e'], [2.5, '#e2b02a']].forEach(([r, col]) => { g.fillStyle = col; g.beginPath(); g.arc(CX, CZ, r, 0, TAU); g.fill(); });
  // the show's name, painted across the infield on both sides of the middle
  g.font = 'bold 16px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const s of [0, 1]) {
    g.save(); g.translate(CX, CZ); g.rotate(s * Math.PI); g.fillStyle = 'rgba(232,228,218,0.55)'; g.fillText('HAMMERDOWN', 0, -64); g.restore();
  }
  // the press's pad: steel deck plate, a yellow and black border, and the words on it
  g.fillStyle = '#6c7177'; g.fillRect(30, 170, 92, 76);
  g.fillStyle = 'rgba(200,206,212,0.35)'; for (let x = 31; x < 122; x += 3) for (let z = 171; z < 246; z += 3) g.fillRect(x + ((z / 3) & 1), z, 1, 0.6);
  g.save(); g.beginPath(); g.rect(66, 186, 44, 44); g.rect(70, 190, 36, 36); g.clip('evenodd');
  for (let i = -50; i < 50; i += 4) { g.fillStyle = (i / 4) & 1 ? '#1c1c1e' : '#e2b02a'; g.beginPath(); g.moveTo(66 + i, 186); g.lineTo(70 + i, 186); g.lineTo(114 + i, 230); g.lineTo(110 + i, 230); g.fill(); }
  g.restore();
  g.fillStyle = '#3e4146'; g.fillRect(70, 190, 36, 36);
  g.save(); g.translate(88, 208); g.rotate(-Math.PI / 2); g.font = 'bold 7px "Arial Black", Impact, sans-serif'; g.fillStyle = '#e2b02a'; g.fillText('CRUSH', 0, -9); g.fillText('ZONE', 0, 10); g.restore();
  // the belts' rails, yellow and black, either side of each belt
  for (const b of BELTS) for (const x of [b.x0 - 2, b.x1]) for (let z = b.z0; z < b.z1; z += 4) { g.fillStyle = ((z - b.z0) / 4) & 1 ? '#1c1c1e' : '#e2b02a'; g.fillRect(x, z, 2, 4); }
  // the hammer zones: a dark red band across each straight under its gantry, edged in stripes, with HAMMER on it
  for (const H of HAMMERS) {
    const z0 = H.z - H.lane, z1 = H.z + H.lane;
    g.fillStyle = 'rgba(120,24,18,0.55)'; g.fillRect(H.x - 10, z0, 20, z1 - z0);
    for (const x of [H.x - 12, H.x + 10]) for (let z = z0; z < z1; z += 3) { g.fillStyle = ((z - z0) / 3) & 1 ? '#1c1c1e' : '#e2b02a'; g.fillRect(x, z, 2, 3); }
    g.save(); g.translate(H.x, H.z); g.rotate(Math.PI / 2); g.font = 'bold 8px "Arial Black", Impact, sans-serif'; g.fillStyle = 'rgba(232,228,218,0.7)'; g.fillText('HAMMER', 0, 0); g.restore();
  }
  // the flame jets: soot fanning out from each across the floor, and a hazard bar on the floor at the wall under it
  for (const j of JETS.jets) {
    const dx = Math.cos(j.a), dz = Math.sin(j.a), px = -dz, pz = dx, L = JETS.len * 1.15;
    const gr = g.createLinearGradient(j.x, j.z, j.x + dx * L, j.z + dz * L); gr.addColorStop(0, 'rgba(18,14,12,0.6)'); gr.addColorStop(1, 'rgba(18,14,12,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(j.x + px * 2, j.z + pz * 2); g.lineTo(j.x + dx * L + px * 8, j.z + dz * L + pz * 8); g.lineTo(j.x + dx * L - px * 8, j.z + dz * L - pz * 8); g.lineTo(j.x - px * 2, j.z - pz * 2); g.fill();
    g.strokeStyle = '#e2b02a'; g.lineWidth = 1.6; g.setLineDash([1.5, 1.5]); g.beginPath(); g.moveTo(j.x + dx * 1.5 + px * 5, j.z + dz * 1.5 + pz * 5); g.lineTo(j.x + dx * 1.5 - px * 5, j.z + dz * 1.5 - pz * 5); g.stroke(); g.setLineDash([]);
  }
  // the magnet's reach: a dashed blue ring with arrows pointing in, and its name
  g.strokeStyle = 'rgba(80,160,255,0.75)'; g.lineWidth = 1.2; g.setLineDash([4, 3]); g.beginPath(); g.arc(MAGNET.x, MAGNET.z, MAGNET.r, 0, TAU); g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(80,160,255,0.55)';
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, c = Math.cos(a), sn = Math.sin(a), r = MAGNET.r - 4; g.beginPath(); g.moveTo(MAGNET.x + c * (r - 5), MAGNET.z + sn * (r - 5)); g.lineTo(MAGNET.x + c * r - sn * 2.5, MAGNET.z + sn * r + c * 2.5); g.lineTo(MAGNET.x + c * r + sn * 2.5, MAGNET.z + sn * r - c * 2.5); g.fill(); }
  g.strokeStyle = 'rgba(80,160,255,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.arc(MAGNET.x, MAGNET.z, 9, 0, TAU); g.stroke();
  g.save(); g.translate(MAGNET.x + 22, MAGNET.z); g.rotate(Math.PI / 2); g.font = 'bold 7px "Arial Black", Impact, sans-serif'; g.fillStyle = 'rgba(120,190,255,0.7)'; g.fillText('MAGNET', 0, 0); g.restore();
  // the fuel depot: oil stains, and a red and white ring round each barrel's spot
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(14,12,10,${0.12 + rand() * 0.2})`; g.beginPath(); g.ellipse(400 + rand() * 70, 130 + rand() * 156, 4 + rand() * 10, 3 + rand() * 7, rand() * 3, 0, TAU); g.fill(); }
  for (const p of BARRELS.spots) { g.strokeStyle = '#c23b2e'; g.lineWidth = 0.8; g.setLineDash([1.5, 1.5]); g.beginPath(); g.arc(p.x, p.z, 3.4, 0, TAU); g.stroke(); g.setLineDash([]); }
  // the boost strips: blue, with chevrons pointing the way they push
  for (const b of BOOSTS) {
    g.fillStyle = '#1d3f6e'; g.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    const dir = Math.sin(b.yaw) > 0 ? 1 : -1, mz = (b.z0 + b.z1) / 2, hh = (b.z1 - b.z0) / 2 - 1.5;
    g.strokeStyle = '#5fc8ff'; g.lineWidth = 2;
    for (let x = b.x0 + 6; x < b.x1 - 4; x += 9) { g.beginPath(); g.moveTo(x - dir * 4, mz - hh); g.lineTo(x + dir * 2, mz); g.lineTo(x - dir * 4, mz + hh); g.stroke(); }
  }
  // the start line just past the start gantry: a chequered band across the south straight
  for (let z = 312; z < 369; z += 3) for (let i = 0; i < 3; i++) { g.fillStyle = ((z / 3 | 0) + i) & 1 ? '#111' : '#eee'; g.fillRect(274 + i * 4, z, 4, 3); }
  // a ring under each pickup, in its colour, so you can see where one comes back
  for (const p of PICKUP_SPOTS) { const k = PICKUPS[p.kind]; g.strokeStyle = k.css; g.lineWidth = 1.1; g.beginPath(); g.arc(p.x, p.z, 6, 0, TAU); g.stroke(); g.globalAlpha = 0.25; g.fillStyle = k.css; g.fill(); g.globalAlpha = 1; }
  I();
  return c.cv;
}

// ---- the map -------------------------------------------------------------------------------------------------------
// Routes: a line to a waypoint must be clear by six voxels either side (a car is up to five and a bit from its middle
// to its side). The route grid shuts its cells over each hazard while it is dangerous (the sweeper's reach always, a
// jet while it is lit or lighting, the magnet while it hums or pulls, the press's pad while it comes down), so rivals
// are routed round them; and the line from a car to its next waypoint must not cut across one either, as the route
// grid's own line test only sees voxels. (A rival chasing you in plain sight drives straight at you, and keeps clear
// of the hazards itself, by hazards.js's steerClear.)
const nav = makeGridNav({ cell: 4, maxNodes: 9000, side: 6 });
const NC = nav.NX * nav.NZ, cellX = (i) => (i % nav.NX + 0.5) * nav.cell, cellZ = (i) => (Math.floor(i / nav.NX) + 0.5) * nav.cell;
const dyn = new Uint8Array(NC), dynWas = new Uint8Array(NC);
let zones = null;
// the open cells under each hazard (worked out once the route grid has first looked at the voxels)
function makeZones() {
  const where = (f) => { const out = []; for (let i = 0; i < NC; i++) if (!nav.blocked[i] && f(cellX(i), cellZ(i))) out.push(i); return out; };
  const L = JETS.len * 1.3;   // as far as a jet reaches when it is wild
  zones = {
    sweep: where((x, z) => Math.hypot(x - CX, z - CZ) < SWEEP.r1 + 11),   // (the saws at the blades' tips reach a car's end a little past r1)
    magnet: where((x, z) => Math.hypot(x - MAGNET.x, z - MAGNET.z) < 30),
    press: where((x, z) => x > PRESS.x0 - 3 && x < PRESS.x1 + 3 && z > PRESS.z0 - 3 && z < PRESS.z1 + 3),
    jets: JETS.jets.map((j) => where((x, z) => {
      const px = x - j.x, pz = z - j.z, al = px * Math.cos(j.a) + pz * Math.sin(j.a), off = Math.abs(px * Math.sin(j.a) - pz * Math.cos(j.a));
      return al > -4 && al < L + 3 && off < 1.6 + 4.4 * Math.min(1, Math.max(0, al / JETS.len)) + 5;
    })),
  };
}
// the radar draws the route grid, but not the hazards' stand-in walls (it draws the hazards themselves)
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
  for (let i = 0; i < NC; i++) { if (dyn[i]) nav.blocked[i] = 1; else if (dynWas[i]) nav.blocked[i] = 0; }
  if ((shownT -= dt) <= 0) { shownT = 1; shown.set(nav.blocked); for (let i = 0; i < NC; i++) if (dyn[i]) shown[i] = 0; }
}
// is the straight line between two points clear of the hazards' shut cells?
function hazardFree(x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2);
  for (let k = 1; k <= n; k++) { const f = k / n; if (dyn[nav.cellOf(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f)]) return false; }
  return true;
}
// A car in a shut cell (among the blades, in a flame, under the magnet) has nowhere for a route to start from: it
// makes for the nearest open cell first (leaning toward its target), and a little past it.
function nearestOpen(c, tx, tz, out) {
  const ci = nav.cellOf(c.x, c.z), cx = ci % nav.NX, cz = Math.floor(ci / nav.NX);
  let best = -1, bd = 1e9;
  for (let r = 1; r <= 18 && best < 0; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= nav.NX || z >= nav.NZ) continue;
    const i = z * nav.NX + x; if (nav.blocked[i]) continue;
    const d = Math.hypot(dx, dz) * nav.cell + 0.3 * Math.hypot(cellX(i) - tx, cellZ(i) - tz);
    if (d < bd) { bd = d; best = i; }
  }
  if (best < 0) { out.x = tx; out.z = tz; return out; }
  const x = cellX(best), z = cellZ(best), dx = x - c.x, dz = z - c.z, l = Math.hypot(dx, dz) || 1;
  out.x = x + dx / l * 6; out.z = z + dz / l * 6; return out;
}
function waypoint(c, tx, tz, out) {
  if (!zones) return nav.waypoint(c, tx, tz, out);
  if (dyn[nav.cellOf(c.x, c.z)]) return nearestOpen(c, tx, tz, out);
  nav.waypoint(c, tx, tz, out);
  if (hazardFree(c.x, c.z, out.x, out.z)) return out;
  // the line cuts across a hazard: find the route again if it runs through one (it was found before that one lit up),
  // then take the furthest point along it that the car can reach without crossing one
  const st = c._nav;
  if (st && st.path && st.path.some((n) => dyn[n])) { st.next = 0; nav.waypoint(c, tx, tz, out); }
  const P = st && st.path; if (!P) return out;
  // (the furthest with a car's width clear either side as well, as the route grid picks them; failing that, the
  // furthest clear of the hazards, for the car to feel its way along; failing that, the next cell)
  let pick = -1, near = -1;
  for (let i = 0; i < P.length - 1; i++) {
    const x = cellX(P[i]), z = cellZ(P[i]);
    if (Math.hypot(x - c.x, z - c.z) > 80 || !hazardFree(c.x, c.z, x, z)) continue;
    if (near < 0) near = i;
    if (lineClear(c.x, c.z, x, z, 3, 6)) { pick = i; break; }
  }
  const n = P[pick >= 0 ? pick : near >= 0 ? near : Math.max(0, P.length - 2)]; out.x = cellX(n); out.z = cellZ(n);
  return out;
}
export default {
  id: 'arena', name: 'Hammerdown Arena', mode: 'waves',
  blurb: 'A televised car combat arena: a sweeper under the big screen, hammers on the gantries, flame jets in the corners, a press, a magnet, and a strike in the eye.',
  loading: ['Building the arena', 'Setting the sweeper, the hammers and the magnet'],
  outer: 0x6e6b64,
  build() {
    ctx.L = 2; seed = 1234567;
    arenaWall(); stand(0); stand(1); ends(); floodlights(); gantry(0); gantry(1); centre(); cover(0); cover(1); press();
    finish();
  },
  ground: () => { seed = 7654321; return paint(); },
  spawn: { x: 300, z: 340, yaw: -Math.PI / 2 },
  waypoint,
  spawnPoint: (player, taken) => pickSpot(SPOTS, player, taken),
  step: routeStep,
  pickups: PICKUP_SPOTS,
  // the set pieces first (they move cars about), then the bounds (which hold cars inside the wall's line even where
  // rockets have blown it open) and the keepouts (nothing can shove a car into the steel of the frame's legs or the
  // press's column, which it could not dig out of)
  hazards: [SWEEP, ...HAMMERS, JETS, MAGNET, PRESS, ...BELTS, BARRELS, ...BOOSTS, SHOW,
    { kind: 'bounds', x: CX, z: CZ, ...WALL },
    ...LEGS.map(([a, b]) => ({ kind: 'keepout', x: CX + a + 1.5, z: CZ + b + 1.5, r: 1.9 })),
    { kind: 'keepout', x0: 110, z0: 184, x1: 122, z1: 232 }],
  // the radar: what stands (from the route grid), then each set piece as it is now, the barrels and the pickups that
  // are up, and while the show has an event on, a frame round it all with the event's name and the seconds left
  radar(R, s, ox, oy, w, h) {
    gridR(R, s, ox, oy, w, h);
    const X = (x) => ox + x * s, Y = (z) => oy + z * s, T = performance.now() / 1000, blink = (T * 8 | 0) & 1;
    // the sweeper: its reach, and its blades
    R.strokeStyle = 'rgba(255,90,60,0.4)'; R.lineWidth = 1; R.beginPath(); R.arc(X(CX), Y(CZ), SWEEP.r1 * s, 0, TAU); R.stroke();
    R.strokeStyle = 'rgba(255,70,50,0.95)'; R.lineWidth = 2;
    for (let k = 0; k < SWEEP.n; k++) { const a = (SWEEP.angle || 0) + k * TAU / SWEEP.n; R.beginPath(); R.moveTo(X(CX + Math.cos(a) * SWEEP.r0), Y(CZ + Math.sin(a) * SWEEP.r0)); R.lineTo(X(CX + Math.cos(a) * SWEEP.r1), Y(CZ + Math.sin(a) * SWEEP.r1)); R.stroke(); }
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
      R.strokeStyle = blink ? 'rgba(255,60,40,0.95)' : 'rgba(255,200,60,0.95)'; R.lineWidth = 3; R.strokeRect(ox + 1.5, oy + 1.5, w - 3, h - 3);
      R.font = 'bold 10px sans-serif'; R.textAlign = 'center'; R.textBaseline = 'alphabetic'; R.fillStyle = '#fff';
      R.fillText(`${SHOW.name} ${Math.ceil(SHOW.left)}`, ox + w / 2, oy + 14); R.textAlign = 'start';
    }
  },
  nav,
};
