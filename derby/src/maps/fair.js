// Dead Man's Fair: a county fair the dead have overrun, at twilight with the lights still on, for the last-car-standing
// round (modes/survival.js). A painted board fence with a gate in each side. The midway runs east to west through the
// middle and the avenue north to south, and where they cross the carousel turns (a mesh on a voxel plinth), with the
// traffic going round it. A quarter each:
//   north-west  the Ferris wheel on its stand, turning (a mesh, ../fairrides.js), the fairground organ playing by it
//               (heard as you come near). It stays there (Will, 2026-11-24: shot loose early, it was
//               gone for the rest of the round); the rolling is still in fairrides.js. The game stalls in a horseshoe,
//               and the octopus.
//   north-east  the big top: a striped tent nobody can drive into. The chair swing and the drop tower.
//   south-west  the pirate ship, swinging (it runs down what is under it at the bottom of its swing), the food court
//               (trucks and stalls round a yard of picnic tables), and the generator truck that runs the lights.
//   south-east  the rollercoaster: track high overhead on steel legs a car can knock out, and its train going round.
// The rides that move are ../fairmoves.js. A few stalls stand at either end of the midway, and neon arches span the
// ways in (all meshes at twice the town's detail: ../fairstalls.js. A car goes straight through a stall and it flies
// apart). Outside the fence: a strip mall to the north and a small suburb to the east (../fairtown.js).
// Strings of coloured bulbs hang between the lamp posts and run along the top of the fence (the look's glows,
// ../looks/fair.js), and eight floodlight towers stand outside the fence, as Camp Deadfall's do.
// The lights: the generator is failing. Every so often a quarter of the fair flickers and goes dark (its bulbs, its
// neon, its two floodlights), and the dead in the dark are bolder (faster: hordeBoost, read by zombies.js). Driving
// over the switch by the generator truck brings them all back.
// Like Camp Deadfall it is kept open for driving through a horde of hundreds, with a ring road inside the fence, and
// nothing has a way in for a car.
import { WX, WZ, M, begin, set, box, ctx, place, setSeed } from '../../../src/world.js';
import { disc } from '../../../src/kit.js';
import { canvasFor, finish, makeGridNav, pickSpot, gridRadar } from './common.js';
import { dropSpots } from '../drops.js';
import { makeRides, WHEEL } from '../fairrides.js';
import { makeStalls, stallPools } from '../fairstalls.js';
import { makeMoves } from '../fairmoves.js';
import { fairTown } from '../fairtown.js';
import { bytes } from '../sfxfiles.js';
import organClip from '../../assets/sfx/fair_organ.mp3';

const TAU = Math.PI * 2;
// ---- the plan (town voxels; x east, z south) ------------------------------------------------------------------------
const W0 = 3, W1 = 6, E0 = WX - 7, E1 = WX - 4, N0 = 3, N1 = 6, S0 = WZ - 7, S1 = WZ - 4;   // the fence, four thick
const GATE = 22;                       // half the width of a gate
const GX = 256, GZ = 208;              // the gates' middles: north and south on x = GX, west and east on z = GZ
const MID = [184, 232];                // the midway, z from and to
const AVE = [234, 278];                // the avenue, x from and to
const RING = 40;                       // the ring road: this far in from the fence's outside
const FERRIS = { x: 96, z: 74 };       // the Ferris wheel's hub
const TENT = { x: 384, z: 138, r: 32 };
const CAROUSEL = { x: GX, z: GZ, r: 17 };   // at the crossing: the way round it is a roundabout
const GEN = { x0: 44, x1: 62, z0: 254, z1: 264 };       // the generator truck
const COASTER = { x: 392, z: 318, hx: 72, hz: 48, r: 30 };
const SWITCH = { x: 82, z: 259 };      // the lights' switch, by the generator

// the lamp posts the bulbs hang between: along both sides of the midway and of the avenue, clear of the crossing
const POSTS = [];
for (const z of [MID[0] - 3, MID[1] + 3]) for (let x = 48; x <= WX - 48; x += 32) if (x < AVE[0] - 8 || x > AVE[1] + 8) POSTS.push([x, z, 'x']);
for (const x of [AVE[0] - 3, AVE[1] + 3]) for (let z = 50; z <= WZ - 50; z += 32) if (z < MID[0] - 8 || z > MID[1] + 8) POSTS.push([x, z, 'z']);
// which quarter of the fair a place is in: 0 north-west, 1 north-east, 2 south-west, 3 south-east
const quarter = (x, z) => (x < GX ? 0 : 1) + (z < GZ ? 0 : 2);
const QUARTERS = ['north-west', 'north-east', 'south-west', 'south-east'];
// the bulbs: six a span between posts next to each other on a line, sagging; [x, y, z, colour, quarter]
const BULBS = [];
{
  let k = 0;
  for (let i = 0; i < POSTS.length; i++) for (let j = 0; j < POSTS.length; j++) {
    const a = POSTS[i], b = POSTS[j]; if (a[2] !== b[2]) continue;
    const along = a[2] === 'x' ? b[0] - a[0] : b[1] - a[1], across = a[2] === 'x' ? b[1] - a[1] : b[0] - a[0];
    if (across !== 0 || along !== 32) continue;
    for (let t = 1; t <= 6; t++) { const f = t / 7, x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; BULBS.push([x + 0.5, 15.5 - 3.2 * Math.sin(f * Math.PI), z + 0.5, k++ % 5, quarter(x, z), i, j]); }
  }
}
// and a string along the top of the fence, all the way round, broken at the gates
{
  let k = 0;
  const run = (x0, z0, x1, z1) => { const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 7); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; BULBS.push([x, 11.2 + (i & 1) * 0.8, z, k++ % 5, quarter(x, z)]); } };
  for (const z of [N1 + 1, S0 - 1]) { run(W1 + 4, z, GX - GATE - 8, z); run(GX + GATE + 8, z, E0 - 4, z); }
  for (const x of [W1 + 1, E0 - 1]) { run(x, N1 + 4, x, GZ - GATE - 8); run(x, GZ + GATE + 8, x, S0 - 4); }
}
// the floodlight towers outside the fence (as Camp Deadfall's: looks/storm.js draws them): two a side, 32 out, each a
// bank of lamps 80 up aimed well in. Each is on the circuit of the quarter it stands by, and goes out with it.
const FLOODS = [];
for (const f of [0.25, 0.75]) FLOODS.push({ x: WX * f, z: -32, nx: 0, nz: 1 }, { x: WX * f, z: WZ + 32, nx: 0, nz: -1 }, { x: -32, z: WZ * f, nx: 1, nz: 0 }, { x: WX + 32, z: WZ * f, nx: -1, nz: 0 });
for (const b of FLOODS) { b.y = 80; b.aim = [b.x + b.nx * 190 + (WX / 2 - b.x) * 0.15 * Math.abs(b.nz), b.z + b.nz * 190 + (WZ / 2 - b.z) * 0.15 * Math.abs(b.nx)]; b.quarter = quarter(Math.max(1, Math.min(WX - 1, b.x)), Math.max(1, Math.min(WZ - 1, b.z))); }
// the lights' state, shared with the look (which draws it), the stalls and the radar: whether each quarter has power
// (on), how bright it is just now (lit: 1 on, 0 out, anything between while it flickers), and rev, which goes up
// whenever something that throws light is smashed
const POWER = { on: [1, 1, 1, 1], lit: [1, 1, 1, 1], rev: 0 };
const LIGHTS = { first: 50, every: 24, after: 45, boost: 1.35, flicker: 2.6 };   // seconds to the first quarter going out, between quarters, after a reset; how much faster the dead are in the dark; how long a quarter flickers before it goes

// ---- the stalls, the trucks and the signs (../fairstalls.js: meshes at twice the detail) ---------------------------------
// The games in a horseshoe in the north-west, open to the midway; a few more at either end of the midway, their fronts
// to it. The food court in the south-west: trucks and stalls round a yard of tables. More food on the east arm. An arch
// over each way in. And what stands still of each ride (../fairmoves.js has what moves).
const NORTH = MID[0] - 11, SOUTH = MID[1] + 8, F = Math.PI, E = Math.PI / 2;
const stall = (kind, x, z, yaw, name, neon, frame, a, more = {}) => ({ kind, x, z, yaw, name, neon, frame, a, ...more });
const C = { red: 0xc8342c, blue: 0x2f6fc0, green: 0x3c9a52, yellow: 0xe8b830, teal: 0x1f9c98, pink: 0xe86aa8, purple: 0x7a4ac0, orange: 0xe2752a, navy: 0x243a6a, white: 0xeee8da };
const SHIP = stall('shipframe', 96, 322, 0, 'PIRATE SHIP', 'red', 'yellow', C.navy, { b: C.yellow });
const SWING = stall('swingbase', 318, 84, 0, '', 'pink', 'pink', C.blue);
const DROP = stall('droptower', 442, 70, 0, 'FREE FALL', 'cyan', 'red', C.purple);
const OCTO = stall('octobase', 190, 66, 0, '', 'green', 'green', C.teal);
const STALLS = [
  // the games' horseshoe
  stall('booth', 154, 112, 0, 'RING TOSS', 'yellow', 'red', C.red, { game: 'ring' }),
  stall('booth', 172, 112, 0, 'BALLOON POP', 'pink', 'cyan', C.blue, { game: 'balloon', seed: 2 }),
  stall('booth', 190, 112, 0, 'KNOCK EM DOWN', 'green', 'yellow', C.green, { game: 'cans', seed: 4 }),
  stall('booth', 140, 136, E, 'DUCK POND', 'cyan', 'yellow', C.teal, { game: 'duck', seed: 1 }),
  stall('booth', 204, 136, -E, 'DEAD EYE', 'red', 'white', C.purple, { game: 'deadeye', seed: 3 }),
  stall('striker', 172, 134, 0.3, '', 'red', 'red', C.red),
  // either end of the midway
  stall('booth', 64, NORTH, 0, 'HOOPS', 'orange', 'blue', C.orange, { game: 'hoops', seed: 5 }),
  stall('booth', 96, NORTH, 0, 'SPIN TO WIN', 'purple', 'yellow', C.yellow, { game: 'spin', seed: 6 }),
  stall('booth', 64, SOUTH, F, 'DUCK POND', 'cyan', 'yellow', C.blue, { game: 'duck', seed: 5 }),
  stall('booth', 96, SOUTH, F, 'BALLOON POP', 'pink', 'cyan', C.pink, { game: 'balloon', seed: 6 }),
  stall('booth', 432, NORTH, 0, 'DEAD EYE', 'red', 'white', C.green, { game: 'deadeye' }),
  stall('booth', 464, NORTH, 0, 'RING TOSS', 'yellow', 'red', C.teal, { game: 'ring', seed: 2 }),
  stall('kiosk', 320, SOUTH, F, 'FRIED OREOS', 'pink', 'white', C.navy, { food: 'oreo' }),
  stall('kiosk', 352, SOUTH, F, 'CORN DOGS', 'yellow', 'red', C.red, { food: 'corndog' }),
  stall('kiosk', 384, SOUTH, F, 'POPCORN', 'orange', 'white', C.red, { food: 'popcorn' }),
  // the food court
  stall('truck', 166, 268, 0, 'TACOS', 'green', 'orange', C.teal, { top: 'taco', c: C.orange }),
  stall('truck', 218, 300, -E, 'ICE CREAM', 'pink', 'cyan', C.white, { top: 'cone', b: C.pink, c: C.pink }),
  stall('truck', 186, 338, F, 'BURGERS', 'yellow', 'red', C.red, { top: 'burger', c: C.yellow }),
  stall('kiosk', 146, 296, E, 'LEMONADE', 'green', 'yellow', C.yellow, { food: 'lemonade', b2: C.green }),
  stall('kiosk', 146, 318, E, 'COTTON CANDY', 'cyan', 'pink', C.pink, { food: 'cotton', b: 0xcfeaf6 }),
  stall('table', 176, 292, 0.2, '', 'warm', 'warm', C.red), stall('table', 196, 298, 1.1, '', 'warm', 'warm', C.blue),
  stall('table', 184, 312, -0.3, '', 'warm', 'warm', C.yellow), stall('table', 168, 316, 0.8, '', 'warm', 'warm', C.green), stall('table', 200, 320, 0.1, '', 'warm', 'warm', C.orange),
  // the rides
  SHIP, SWING, DROP, OCTO,
  stall('arch', 40, GZ, E, 'GAMES', 'yellow', 'pink', C.red, { span: 116 }),
  stall('arch', 478, GZ, E, 'EATS', 'pink', 'cyan', C.blue, { span: 116 }),
  stall('arch', GX, 44, 0, 'RIDES', 'cyan', 'yellow', C.purple, { span: 108 }),
  stall('arch', GX, 372, 0, 'MIDWAY', 'orange', 'green', C.red, { span: 108 }),
  stall('pylon', 130, 98, 0.3, 'BIG WHEEL', 'yellow', 'red', 0),
  stall('pylon', 150, 164, -0.4, 'PRIZES', 'pink', 'cyan', 0),
  stall('pylon', 356, 176, 0.2, 'FREAK SHOW', 'green', 'purple', 0),
  stall('pylon', 198, 254, F + 0.3, 'FOOD COURT', 'cyan', 'white', 0),
  stall('pylon', 296, 292, 2.6, 'THE COMET', 'purple', 'yellow', 0),
  stall('striker', 300, 174, 0.5, '', 'yellow', 'yellow', C.blue),
  stall('tickets', 66, 96, 0, 'TICKETS', 'yellow', 'red', C.blue),
  stall('genset', (GEN.x0 + GEN.x1) / 2, (GEN.z0 + GEN.z1) / 2, 0, '', 'yellow', 'yellow', 0),
  stall('board', TENT.x + 0.5, TENT.z + TENT.r + 2.2, 0, 'BIG TOP', 'yellow', 'red', 0, { w: 52, h: 13, y: 35, legs: true }),
  stall('board', GX, S0 - 0.5, F, "DEAD MAN'S FAIR", 'red', 'yellow', 0, { w: 98, h: 15, y: 53 }),
];
// the lamp posts are the same kind of thing (so a car can knock one down): LAMPS[i] stands at POSTS[i]
const LAMPS = POSTS.map(([x, z]) => stall('lamp', x + 0.5, z + 0.5, 0, '', 'warm', 'warm', 0));
STALLS.push(...LAMPS);
// and what stands outside the fence (scenery: ../fairtown.js)
STALLS.push(...fairTown(WX, WZ, GX, GZ));
const POOLS = stallPools(STALLS, quarter);

// the six places to line up for the round, the player's first, far apart and facing into the fair
const STARTS = [
  { x: 70, z: 208, yaw: Math.PI / 2 }, { x: 442, z: 208, yaw: -Math.PI / 2 }, { x: 256, z: 60, yaw: 0 },
  { x: 256, z: 356, yaw: Math.PI }, { x: 310, z: 150, yaw: -2.2 }, { x: 124, z: 282, yaw: Math.PI / 2 },
];
const SPOTS = [...STARTS, { x: 24, z: 24 }, { x: WX - 24, z: 24 }, { x: 24, z: WZ - 24 }, { x: WX - 24, z: WZ - 24 }, { x: 160, z: 208 }, { x: 352, z: 208 }, { x: 256, z: 150 }, { x: 256, z: 270 }];
// where the supply drops come down (../drops.js): open ground, spread over the fair
const DROPS = dropSpots([[214, 208], [172, 172], [352, 60], [190, 362], [300, 252], [460, 208], [60, 196], [256, 110], [256, 320], [404, 72]]);
// the lights' switch (pickups.js 'switch': driven over, it does what its `on` says, which the lights fill in when they
// are made: setup, below)
const SW_LIGHTS = { kind: 'switch', x: SWITCH.x, z: SWITCH.z, hold: true, name: 'Lights on', sub: 'The generator is running again' };

// ---- the route grid: the voxels, the stalls that still stand, and the wheel while it is on its stand ------------------------------------------------
let rides = null, stalls = null, moves = null, organ = null;
const nav = makeGridNav({ also: (x, z) => (!!rides && rides.blocks(x, z)) || (!!stalls && stalls.blocks(x, z)) });
const radarGrid = gridRadar(nav);

// ---- the fence and the gates --------------------------------------------------------------------------------------------
// One straight stretch of fence, in boards with a painted band of red and white and a dark cap, cut into bodies of 32
// so a hole in it stays a hole. Cars bounce off it ('barrier'); rockets can still break it.
function fenceRun(xa, za, xb, zb) {
  const alongX = xb - xa > zb - za, len = alongX ? xb - xa + 1 : zb - za + 1, thick = alongX ? zb - za : xb - xa;
  for (let s = 0; s < len; s += 32) {
    begin('Fair fence', 'barrier', false);
    for (let t = s; t < Math.min(len, s + 32); t++) for (let w = 0; w <= thick; w++) for (let y = 0; y <= 9; y++) {
      const x = alongX ? xa + t : xa + w, z = alongX ? za + w : za + t;
      set(x, y, z, y === 9 ? M.DARK : t % 8 === 0 ? M.TRUNK : y >= 5 && y <= 7 ? (((t / 8) | 0) & 1 ? M.AWN_R : M.TRIM) : M.WOOD);
    }
  }
}
// a gate post: striped like a barber's pole, a lit ball on top
function post(x0, z0, x1, z1) {
  begin('Gate post', 'barrier', false);
  for (let y = 0; y <= 15; y++) box(x0, y, z0, x1, y, z1, ((y / 3) | 0) & 1 ? M.AWN_R : M.TRIM);
  box(x0, 16, z0, x1, 16, z1, M.DARK); box(x0 + 1, 17, z0 + 1, x1 - 1, 19, z1 - 1, M.LIT_Y);
}

// ---- the big top ------------------------------------------------------------------------------------------------------
// A round tent in red and white stripes: a wall, a cone of a roof, a king pole with a pennant, and a row of lamps
// round the eaves. In eight bodies (so a rocket takes a bite out of it, not the lot). Cars bounce off it.
function bigTop({ x: cx, z: cz, r }) {
  const WALL = 12, RISE = 0.78, TOP = WALL + Math.floor(r * RISE);
  for (let o = 0; o < 8; o++) {
    begin('Big top', 'barrier', true);
    for (let dx = -r - 1; dx <= r + 1; dx++) for (let dz = -r - 1; dz <= r + 1; dz++) {
      const d = Math.hypot(dx + 0.5, dz + 0.5); if (d > r + 0.5) continue;
      const a = (Math.atan2(dz + 0.5, dx + 0.5) + TAU) % TAU; if (Math.floor(a / (TAU / 8)) !== o) continue;
      const stripe = Math.floor(a / (TAU / 32)) & 1, door = Math.abs(a - Math.PI / 2) < 0.16;   // the way in, on the south side: dark, no way through
      if (d > r - 2) for (let y = 0; y <= WALL; y++) set(cx + dx, y, cz + dz, door && y < 10 ? M.DARK : y === WALL ? M.SIGN : stripe ? M.AWN_R : M.TRIM);
      // the roof: at each height a ring, each a little further in than the one below
      const y0 = WALL + 1 + Math.floor((r - d - 2.4) * RISE), y1 = WALL + 1 + Math.floor((r - d) * RISE);
      for (let y = Math.max(WALL + 1, y0); y <= Math.min(TOP, y1); y++) set(cx + dx, y, cz + dz, stripe ? M.AWN_R : M.TRIM);
    }
  }
  begin('King pole', 'prop', false);
  box(cx, TOP, cz, cx, TOP + 10, cz, M.DARK);
  for (let a = 1; a <= 7; a++) for (let y = TOP + 6; y <= TOP + 9; y++) if (a <= 7 - Math.abs(y - TOP - 7.5) * 2) set(cx + a, y, cz, M.SIGN);
  // lamps round the eaves
  begin('Tent lamps', 'prop', false);
  for (let k = 0; k < 32; k++) { const a = k / 32 * TAU; set(Math.round(cx + Math.cos(a) * (r + 0.6) - 0.5), WALL + 1, Math.round(cz + Math.sin(a) * (r + 0.6) - 0.5), k & 1 ? M.LIT_Y : M.LIT_R); }
}

// ---- the Ferris wheel's stand, and the carousel's plinth (the rides themselves are meshes: ../fairrides.js) -----------
// two steel A-frames, one each side of the wheel, up to its hub; cars bounce off the legs
function wheelStand({ x: cx, z: cz }) {
  const H = WHEEL.hub, SPREAD = 17;
  for (const dz of [-WHEEL.thick - 3, WHEEL.thick + 2]) {
    begin('Wheel stand', 'barrier', true);
    for (let y = 0; y <= H; y++) { const off = Math.round(SPREAD * (1 - y / H)); for (const s of [-1, 1]) box(cx + s * off - (s < 0 ? 1 : 0), y, cz + dz, cx + s * off + (s > 0 ? 1 : 0), y, cz + dz + 1, y % 6 < 3 ? M.STEEL : M.TRIM); }
    box(cx - SPREAD - 3, 0, cz + dz - 1, cx + SPREAD + 3, 0, cz + dz + 2, M.CONC);
    box(cx - 2, H - 1, cz + dz, cx + 2, H + 2, cz + dz + 1, M.DARK); set(cx, H + 3, cz + dz, M.LIT_R);
  }
}
function carouselPlinth({ x: cx, z: cz, r }) {
  begin('Carousel', 'barrier', false);
  for (let y = 0; y <= 2; y++) disc(cx, cz, y, r, y === 2 ? M.WOOD : M.AWN_R, y === 2 ? -1 : r - 2);
  for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; set(Math.round(cx + Math.cos(a) * (r - 0.6) - 0.5), 3, Math.round(cz + Math.sin(a) * (r - 0.6) - 0.5), k & 1 ? M.LIT_Y : M.LIT_B); }
}

// ---- the rollercoaster ----------------------------------------------------------------------------------------------
// A loop of track high overhead (never lower than 34: the chase camera passes under it) on steel legs. Knock a leg out
// and the track over it comes down.
function coasterAt(t) {
  const { x, z, hx, hz, r } = COASTER, sx = 2 * (hx - r), sz = 2 * (hz - r), arc = Math.PI / 2 * r, L = 2 * sx + 2 * sz + 4 * arc;
  let d = (((t % 1) + 1) % 1) * L, px, pz;
  const corner = (cx, cz, a0) => { const a = a0 + d / r; px = cx + Math.cos(a) * r; pz = cz + Math.sin(a) * r; };
  if (d < sx) { px = x - hx + r + d; pz = z - hz; }
  else if ((d -= sx) < arc) corner(x + hx - r, z - hz + r, -Math.PI / 2);
  else if ((d -= arc) < sz) { px = x + hx; pz = z - hz + r + d; }
  else if ((d -= sz) < arc) corner(x + hx - r, z + hz - r, 0);
  else if ((d -= arc) < sx) { px = x + hx - r - d; pz = z + hz; }
  else if ((d -= sx) < arc) corner(x - hx + r, z + hz - r, Math.PI / 2);
  else if ((d -= arc) < sz) { px = x - hx; pz = z + hz - r - d; }
  else { d -= sz; corner(x - hx + r, z - hz + r, Math.PI); }
  return [px, 44 + 9 * Math.sin(t * TAU * 3) + 5 * Math.sin(t * TAU * 5 + 1), pz, L];
}
function coaster() {
  const L = coasterAt(0)[3], LEGS = 22, n = Math.ceil(L / 0.5);
  for (let k = 0; k < LEGS; k++) {
    const [x, y, z] = coasterAt((k + 0.5) / LEGS), ix = Math.round(x), iz = Math.round(z), top = Math.floor(y) - 1;
    begin('Coaster leg', 'tower', true);
    box(ix, 0, iz, ix + 1, top, iz + 1, M.STEEL); box(ix - 1, 0, iz - 1, ix + 2, 0, iz + 2, M.CONC);
    for (let yy = 8; yy < top; yy += 8) box(ix, yy, iz, ix + 1, yy, iz + 1, M.AWN_R);
    // the track this leg carries: half a span either side of it
    begin('Coaster track', 'tower', true);
    for (let i = Math.floor(k / LEGS * n); i <= Math.ceil((k + 1) / LEGS * n); i++) {
      const [ax, ay, az] = coasterAt(i / n), [bx, , bz] = coasterAt((i + 1) / n), dl = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / dl, nz = (bx - ax) / dl, yy = Math.floor(ay);
      for (let w = -2; w <= 2; w++) { const px = Math.round(ax + nx * w), pz = Math.round(az + nz * w); set(px, yy, pz, M.WOOD); if (Math.abs(w) === 2) set(px, yy + 1, pz, M.AWN_R); }
      set(Math.round(ax), yy - 1, Math.round(az), M.STEEL);
    }
  }
  // the station: a platform with a striped roof, on the west straight
  begin('Coaster station', 'prop', false);
  const sx = COASTER.x - COASTER.hx - 16, sz = COASTER.z;
  box(sx, 0, sz - 10, sx + 9, 1, sz + 10, M.WOOD);
  for (const z of [sz - 10, sz + 10]) for (const x of [sx, sx + 9]) box(x, 2, z, x, 9, z, M.DARK);
  for (let z = sz - 11; z <= sz + 11; z++) box(sx - 1, 10, z, sx + 10, 10, z, ((z / 3) | 0) & 1 ? M.AWN_B : M.TRIM);
}

// ---- the generator and the small things ---------------------------------------------------------------------
function hayBale(x, z, alongX) { begin('Hay bale', 'prop', false); if (alongX) box(x, 0, z, x + 4, 2, z + 2, M.OCHRE); else box(x, 0, z, x + 2, 2, z + 4, M.OCHRE); }
// ---- the build ------------------------------------------------------------------------------------------------------
function build() {
  setSeed(1313); place(0, 0, -1); ctx.lot = -1; ctx.L = 3;
  // the fence, broken by the four gates
  fenceRun(W0, N0, GX - GATE - 1, N1); fenceRun(GX + GATE, N0, E1, N1);
  fenceRun(W0, S0, GX - GATE - 1, S1); fenceRun(GX + GATE, S0, E1, S1);
  fenceRun(W0, N1 + 1, W1, GZ - GATE - 1); fenceRun(W0, GZ + GATE, W1, S0 - 1);
  fenceRun(E0, N1 + 1, E1, GZ - GATE - 1); fenceRun(E0, GZ + GATE, E1, S0 - 1);
  post(GX - GATE - 5, N0, GX - GATE - 1, N1 + 1); post(GX + GATE, N0, GX + GATE + 4, N1 + 1);
  post(GX - GATE - 5, S0 - 1, GX - GATE - 1, S1); post(GX + GATE, S0 - 1, GX + GATE + 4, S1);
  post(W0, GZ - GATE - 5, W1 + 1, GZ - GATE - 1); post(W0, GZ + GATE, W1 + 1, GZ + GATE + 4);
  post(E0 - 1, GZ - GATE - 5, E1, GZ - GATE - 1); post(E0 - 1, GZ + GATE, E1, GZ + GATE + 4);
  // the arch over the main gate, high enough to drive under
  begin('Fair arch', 'sign', true);
  for (const x of [GX - GATE - 4, GX + GATE + 3]) box(x, 20, S0 - 1, x + 1, 30, S0, M.AWN_R);
  box(GX - GATE - 4, 20, S0 - 1, GX + GATE + 4, 21, S0, M.AWN_R); box(GX - GATE - 4, 31, S0 - 1, GX + GATE + 4, 31, S0, M.AWN_R);   // (its name is neon: STALLS)

  wheelStand(FERRIS);
  bigTop(TENT);
  carouselPlinth(CAROUSEL);
  coaster();
  for (const [x, z, a] of [[150, 92, 1], [158, 92, 1], [296, 122, 0], [60, 354, 0], [90, 286, 1], [336, 160, 0], [420, 250, 1], [118, 152, 0], [226, 330, 0], [130, 344, 1]]) hayBale(x, z, a);
  finish();
}

// ---- the painted ground -----------------------------------------------------------------------------------------------
// Trampled straw and packed dirt (browns and straw, not greens: the dead are green, and should stand out on it), the
// midway and the avenue worn darker, sawdust round the tent, the carousel and the games, the food court's boards, and
// the paths trodden to the rides.
function ground() {
  const c = canvasFor('#9a8a5e', 1313), { g, rect, mottle } = c, GK = c.GK;
  const circle = (x, z, r) => { g.beginPath(); g.arc(x * GK, z * GK, r * GK, 0, TAU); };
  const STRAW = [[124, 108, 70, 0.4], [182, 166, 112, 0.36], [198, 184, 130, 0.34], [104, 94, 62, 0.36]];
  for (const [cell, kk] of [[24, 0.8], [7, 0.85], [2.5, 0.9], [1.25, 0.7]]) mottle(0, 0, WX, WZ, cell, STRAW.map(([r, gg, b, a]) => [r, gg, b, a * kk]));
  // patches of worn grass, dull and dry
  for (let i = 0; i < 16; i++) { const x = c.r() * WX, z = c.r() * WZ, w = 24 + c.r() * 60, d = 16 + c.r() * 40; g.fillStyle = 'rgba(122,128,78,0.22)'; rect(x, z, x + w, z + d); mottle(x, z, x + w, z + d, 2, [[110, 118, 70, 0.3], [160, 150, 96, 0.3]]); }
  // the ring road, the midway and the avenue: packed dirt
  const dirt = (x0, z0, x1, z1, col = '#857252') => { g.fillStyle = col; rect(x0, z0, x1, z1); for (const cell of [6, 2]) mottle(x0, z0, x1, z1, cell, [[66, 54, 38, 0.36], [168, 148, 108, 0.32]]); };
  dirt(W1, N1, WX - 7, RING); dirt(W1, WZ - RING, WX - 7, S0); dirt(W1, N1, RING, S0); dirt(WX - RING, N1, E0, S0);
  dirt(W1, MID[0], E0, MID[1], '#7c6a4c'); dirt(AVE[0], N1, AVE[1], S0, '#7c6a4c');
  // sawdust round the tent, round the carousel at the crossing, and in the games' horseshoe
  g.fillStyle = 'rgba(214,190,130,0.5)'; circle(TENT.x, TENT.z, TENT.r + 9); g.fill(); circle(CAROUSEL.x, CAROUSEL.z, CAROUSEL.r + 12); g.fill();
  rect(132, 104, 212, 150);
  mottle(TENT.x - 44, TENT.z - 44, TENT.x + 44, TENT.z + 44, 1.5, [[230, 210, 150, 0.2], [150, 126, 84, 0.2]]);
  mottle(132, 104, 212, 150, 1.5, [[230, 210, 150, 0.2], [150, 126, 84, 0.2]]);
  // the food court's yard: laid with boards, worn
  g.fillStyle = '#8c7a5c'; rect(152, 276, 212, 332);
  g.fillStyle = 'rgba(52,42,30,0.28)'; for (let z = 276; z < 332; z += 4) rect(152, z, 212, z + 0.4);
  mottle(152, 276, 212, 332, 2, [[66, 54, 38, 0.3], [178, 158, 118, 0.26]]);
  // worn ground under the rides, and the paths trodden to them from the midway and the avenue
  g.fillStyle = 'rgba(70,58,42,0.42)';
  for (const [x, z, r] of [[OCTO.x, OCTO.z, 19], [SWING.x, SWING.z, 22], [DROP.x, DROP.z, 12], [FERRIS.x, FERRIS.z + 2, 24]]) { circle(x, z, r); g.fill(); }
  const path = (x0, z0, x1, z1, w = 7) => { g.strokeStyle = 'rgba(112,94,66,0.7)'; g.lineWidth = w * GK; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0 * GK, z0 * GK); g.lineTo(x1 * GK, z1 * GK); g.stroke(); };
  path(AVE[0], 70, OCTO.x + 16, OCTO.z); path(OCTO.x - 18, OCTO.z + 2, FERRIS.x + 30, FERRIS.z + 8); path(172, MID[0], 172, 152, 10);
  path(AVE[1], 84, SWING.x - 20, SWING.z); path(SWING.x + 22, SWING.z - 4, DROP.x - 12, DROP.z); path(DROP.x, DROP.z + 12, 452, MID[0], 6);
  path(182, MID[1], 182, 274, 10); path(152, 306, SHIP.x + 22, SHIP.z, 8); path(SHIP.x, SHIP.z - 16, 84, 264, 6); path(AVE[1], 292, COASTER.x - COASTER.hx - 8, COASTER.z, 8);
  // ruts down the midway and round the ring road
  g.fillStyle = 'rgba(58,48,34,0.3)';
  for (const z of [GZ - 12, GZ - 5, GZ + 5, GZ + 12]) rect(W1, z - 0.6, E0, z + 0.6);
  for (const o of [16, 28]) { rect(o, o, WX - o, o + 1.2); rect(o, WZ - o - 1.2, WX - o, WZ - o); rect(o, o, o + 1.2, WZ - o); rect(WX - o - 1.2, o, WX - o, WZ - o); }
  // what a fair leaves: spilt popcorn, tickets, and what the dead left
  for (let i = 0; i < 260; i++) { const x = 20 + c.r() * (WX - 40), z = 20 + c.r() * (WZ - 40), r = 0.3 + c.r() * 0.5; g.fillStyle = c.r() < 0.5 ? 'rgba(244,236,196,0.6)' : c.r() < 0.5 ? 'rgba(206,60,50,0.5)' : 'rgba(70,110,190,0.5)'; g.fillRect(x * GK, z * GK, r * GK, r * GK); }
  for (let i = 0; i < 26; i++) {
    const x = 20 + c.r() * (WX - 40), z = 20 + c.r() * (WZ - 40), r = 2 + c.r() * 5;
    g.fillStyle = i % 3 === 0 ? 'rgba(96,24,18,0.34)' : 'rgba(40,32,24,0.26)';
    g.beginPath(); g.ellipse(x * GK, z * GK, r * GK, r * (0.5 + c.r() * 0.5) * GK, c.r() * 3, 0, 6.3); g.fill();
  }
  return c.cv;
}

// ---- where the horde comes from (modes/survival.js) ---------------------------------------------------------------------
const GATES = [
  { out: { x: GX, z: -34 }, entry: { x: GX, z: 26 } }, { out: { x: GX, z: WZ + 34 }, entry: { x: GX, z: WZ - 26 } },
  { out: { x: -34, z: GZ }, entry: { x: 26, z: GZ } }, { out: { x: WX + 34, z: GZ }, entry: { x: WX - 26, z: GZ } },
];
// a place on top of the fence away from the gates, and the way in from it
function wallSpot() {
  const side = Math.floor(Math.random() * 4), along = side < 2 ? WX : WZ, mid = side < 2 ? GX : GZ;
  let t;
  do { t = 30 + Math.random() * (along - 60); } while (Math.abs(t - mid) < GATE + 14);
  return side === 0 ? { x: t, z: N1 + 1.5, in: { x: 0, z: 1 } } : side === 1 ? { x: t, z: S0 - 1.5, in: { x: 0, z: -1 } } : side === 2 ? { x: W1 + 1.5, z: t, in: { x: 1, z: 0 } } : { x: E0 - 1.5, z: t, in: { x: -1, z: 0 } };
}
// the horde breaks through: a hole blown in each side of the fence, each a new way in
function breach(G) {
  const holes = [[150, N0 + 2, 0, -1], [370, S1 - 2, 0, 1], [W0 + 2, 320, -1, 0], [E1 - 2, 300, 1, 0]], out = [];
  for (const [x, z, dx, dz] of holes) {
    G.explode(x, 4, z, 9, 0.5, { maxDebris: 160, fire: false });
    out.push({ out: { x: x + dx * 34, z: z + dz * 34 }, entry: { x: x - dx * 26, z: z - dz * 26 } });
  }
  return out;
}

// ---- the fairground organ --------------------------------------------------------------------------------------------
// It plays by the big wheel, and is heard as you come near it (Will, 2026-11-24): full by the wheel, gone by the far side
// of the fair. On the wheel's circuit: when that quarter's lights fail it winds down with them.
// The tune is a band organ waltz of our own (assets/sfx/CREDITS.md), sixteen bars that come round; the file has half a
// second either side of the loop.
const ORGAN = { vol: 0.9, near: 110, far: 210, loop: [0.5, 16.7935] };   // how loud by the wheel; how far off it starts to fade for good, and where it is gone; the loop in the file, seconds
const organSound = (ctx) => bytes(organClip).then((u8) => ctx.decodeAudioData(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)));
function stepOrgan(api) {
  if (!organ) { if (!api.sfx.make('fair_organ', organSound)) return; organ = api.sfx.loop('fair_organ', 0.5, ORGAN.loop); }
  const cam = api.camera.position, d = Math.hypot(cam.x - FERRIS.x, cam.z - FERRIS.z), lit = POWER.lit[quarter(FERRIS.x, FERRIS.z)];
  const fade = Math.max(0, Math.min(1, (ORGAN.far - d) / (ORGAN.far - ORGAN.near)));
  organ.set(ORGAN.vol * fade * (0.1 + 0.9 * lit), 0.7 + 0.3 * lit, FERRIS.x, FERRIS.z);
}

// ---- the lights -------------------------------------------------------------------------------------------------------
// Run from the round's own clock (so every device online agrees): a quarter goes at LIGHTS.first, then one more
// every LIGHTS.every, in an order that is the same on every device, until someone drives over the switch. A quarter
// doesn't just go: it flickers for a couple of seconds first (which is the warning), then it is out.
let lightsApi = null, lightT = 0, lightN = 0, lightsRound = false;
const ORDER = [2, 1, 0, 3, 1, 3, 0, 2];
const flick = [0, 0, 0, 0];            // seconds of flickering a quarter has left before it goes out (or, coming back on, before it holds)
function lightsOn(c) {
  for (let q = 0; q < 4; q++) { if (!POWER.on[q]) flick[q] = -0.7; POWER.on[q] = 1; }
  lightT = LIGHTS.after; SW_LIGHTS.raise = false;
  if (lightsApi && c) { lightsApi.sfx.play('ui_go', 0.8, SWITCH.x, SWITCH.z); lightsApi.sound('zap', 0.6, SWITCH.x, 4, SWITCH.z); }
}
// how bright a flickering light is, t seconds in of T: mostly on with dropouts at first, mostly out with flashes at the end
function flickerAt(t, T) {
  const f = t / T, n = Math.floor(t * 17), h = Math.sin(n * 91.7 + Math.floor(t * 5) * 13.3) * 43758.5453, r = h - Math.floor(h);
  return r > f * f * 0.9 + 0.12 ? 1 - 0.25 * f : 0.08;
}
function stepLights(dt) {
  const G = lightsApi; if (!G) return;
  const m = G.mode, running = !!m && m.phase === 'run';
  if (!running) { if (lightsRound && m && m.phase === 'count') { lightsRound = false; lightsOn(null); flick.fill(0); lightT = LIGHTS.first; } }
  else {
    if (!lightsRound) { lightsRound = true; lightT = Math.max(1, LIGHTS.first - (m.clock || 0)); }
    if ((lightT -= dt) <= 0) {
      lightT = LIGHTS.every;
      let q = -1; for (let i = 0; i < ORDER.length && q < 0; i++) { const o = ORDER[(lightN + i) % ORDER.length]; if (POWER.on[o] && flick[o] <= 0) q = o; }
      lightN++;
      if (q >= 0) { flick[q] = LIGHTS.flicker; G.sound('zap', 0.5); }
    }
  }
  for (let q = 0; q < 4; q++) {
    if (flick[q] > 0) {
      // going: flickering, then out
      const was = POWER.lit[q];
      flick[q] -= dt; POWER.lit[q] = flickerAt(LIGHTS.flicker - flick[q], LIGHTS.flicker);
      if (POWER.lit[q] < 0.5 && was >= 0.5 && Math.random() < 0.5) G.sound('zap', 0.25);
      if (flick[q] <= 0) {
        flick[q] = 0; POWER.on[q] = 0; POWER.lit[q] = 0; SW_LIGHTS.raise = true;
        G.banner('Lights out', `The ${QUARTERS[q]} is dark. Hit the switch by the generator`);
        G.sfx.play('ui_tab', 0.9); G.sound('alarm', 0.5);
      }
    } else if (flick[q] < 0) {
      // coming back: a stutter, then on
      flick[q] = Math.min(0, flick[q] + dt); POWER.lit[q] = flick[q] < 0 ? flickerAt(-flick[q], 0.7) : 1;
    } else POWER.lit[q] += (POWER.on[q] - POWER.lit[q]) * Math.min(1, dt * 6);
  }
}

export default {
  id: 'fair', name: "Dead Man's Fair", mode: 'survival',
  blurb: 'A county fair overrun by the dead, with the lights failing. No fighting the other cars: outlast them all.',
  story: 'The dead have the run of the fair, and there are more every minute. When the lights flicker, get to the switch by the generator: the dead are faster in the dark.',
  loading: ['Opening the fair', 'Stringing up the lights'],
  outer: 0x7f7450,
  // twilight, with the fair's lights on (looks/fair.js): the bulbs, the posts' and the stalls' pools of light, the
  // floodlight towers outside the fence, and which quarters are lit
  look: {
    kind: 'fair', middle: [GX, GZ], bulbs: BULBS, posts: LAMPS.map((o) => ({ x: o.x, z: o.z, quarter: quarter(o.x, o.z), lamp: o })), pools: POOLS, power: POWER, box: [W1 + 1, N1 + 1, E0, S0],
    banks: FLOODS, ring: { x: (W1 + 1 + E0) / 2, z: (N1 + 1 + S0) / 2, hx: (E0 - W1 - 1) / 2, hz: (S0 - N1 - 1) / 2, r: 2 },
  },
  // The country past the fence (../backdrops/wilds.js): fields and woods, the road in, a farm, the town on the horizon.
  backdrop: {
    kind: 'wilds', seed: 7373,
    world: [0, 0, WX, WZ],
    view: { x: WX / 2, z: WZ / 2 },
    sand: 0x9a8a5e,
    clear: 110,
    far: 1950,
    hills: { flat: 190, base: 20, amp: 200 },
    road: [[GX, WZ - 2], [GX, 580], [290, 780], [380, 1010], [470, 1290], [560, 1560], [640, 1790]], roadW: 40,
    tracks: [[[GX, 2], [GX, -170], [200, -430], [90, -760]], [[2, GZ], [-190, 200], [-470, 260]], [[WX - 2, GZ], [760, 208], [1040, 150]]],
    wrecks: { from: 120, to: 900, checkpoint: 0 },
    town: { x: 700, z: 1950, r: 250 },
    farm: { x: -520, z: 330 },
    mast: { x: 1080, z: -420, h: 110 },
    pines: { count: 3600, mobile: 2000 },
    smoke: 5,
    wind: [-0.18, -0.08],
  },
  build, ground,
  pickups: [...DROPS, SW_LIGHTS],
  drops: DROPS,
  // the rides (meshes: the wheel and the carousel) and the stalls, made once the game's parts are there
  hazards: [{ kind: 'custom', make(api) {
    lightsApi = api;
    rides = makeRides(api, { wheel: { ...FERRIS, to: WX + 300, fixed: true }, carousel: CAROUSEL });
    for (const p of POOLS) p.on = 1;
    for (const o of STALLS) o.dead = false;
    stalls = makeStalls(api, STALLS, POWER, quarter, [WX, WZ]);
    moves = makeMoves(api, { ship: SHIP, swing: SWING, drop: DROP, octo: OCTO, coaster: { x: COASTER.x, z: COASTER.z, at: coasterAt } }, stalls.mats, quarter);
    SW_LIGHTS.on = (c) => lightsOn(c);
    SW_LIGHTS.raise = false;
    return { step(dt, live) {
      rides.step(dt, live); stalls.step(dt); moves.step(dt, live); stepLights(dt);
      rides.power(POWER.lit[quarter(FERRIS.x, FERRIS.z)], Math.max(...POWER.lit));   // (the carousel, at the crossing, runs while any quarter does)
      stepOrgan(api);
    } };
  } }],
  groundDetail: { soft: 'dirt', hard: false, wet: 0 },
  rutBox: [W1, N1, E0, S0],
  spawn: STARTS[0], starts: STARTS, gates: GATES, wallSpot, breach,
  // the dead in a quarter whose lights are out are bolder (zombies.js)
  hordeBoost: (x, z) => (POWER.on[quarter(x, z)] ? 1 : LIGHTS.boost),
  waypoint: (c, tx, tz, out) => nav.waypoint(c, tx, tz, out),
  spawnPoint: (player, taken) => pickSpot(SPOTS, player, taken),
  step: (dt) => nav.step(dt),
  // the midway and the avenue, the dark quarters, whatever stands, and the wheel
  radar(R, s, ox, oy, w, h) {
    R.fillStyle = 'rgba(255,255,255,0.13)';
    R.fillRect(ox + W1 * s, oy + MID[0] * s, (E0 - W1) * s, (MID[1] - MID[0]) * s);
    R.fillRect(ox + AVE[0] * s, oy + N1 * s, (AVE[1] - AVE[0]) * s, (S0 - N1) * s);
    R.fillStyle = 'rgba(0,0,0,0.38)';
    for (let q = 0; q < 4; q++) if (!POWER.on[q]) R.fillRect(ox + (q & 1 ? GX : 0) * s, oy + (q & 2 ? GZ : 0) * s, (q & 1 ? WX - GX : GX) * s, (q & 2 ? WZ - GZ : GZ) * s);
    radarGrid(R, s, ox, oy, w, h);
    if (rides) rides.radar(R, s, ox, oy);
    if (moves) moves.radar(R, s, ox, oy);
  },
  nav,
  rides: () => rides && rides.wheel, stalls: () => stalls, moves: () => moves, organ: () => organ, power: POWER,   // (for the tests)
};
