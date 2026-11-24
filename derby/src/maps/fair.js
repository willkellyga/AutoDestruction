// Dead Man's Fair: a county fair the dead have overrun, at twilight with the lights still on, for the last-car-standing
// round (modes/survival.js). A painted board fence with a gate in each side. The midway runs east to west through the
// middle and the avenue north to south, and they cross in the open. Round them, a quarter each:
//   north-west  the Ferris wheel on its stand (a mesh, ../fairrides.js). Let loose (shoot it off its stand, or drive
//               over the release beside it) it rolls east down its own alley, flattening the dead and any car in its
//               way, through the east fence and off into the dark.
//   north-east  the big top: a striped tent nobody can drive into.
//   south-west  the carousel, still turning (a mesh on a voxel plinth), and the generator truck that runs the lights.
//   south-east  the rollercoaster: track high overhead on steel legs a car can knock out.
// Game booths with striped awnings line the midway (props: a car goes straight through them), and strings of coloured
// bulbs hang between the lamp posts (the look's glows, ../looks/fair.js).
// The lights: the generator is failing. Every so often a quarter of the fair goes dark, and the dead in the dark are
// bolder (faster: hordeBoost, read by zombies.js). Driving over the switch by the generator truck brings them all back.
// Like Camp Deadfall it is kept open for driving through a horde of hundreds, with a ring road inside the fence, and
// nothing has a way in for a car.
import { WX, WZ, M, begin, set, box, ctx, place, setSeed } from '../../../src/world.js';
import { face, text, textW, disc } from '../../../src/kit.js';
import { canvasFor, finish, makeGridNav, pickSpot, gridRadar } from './common.js';
import { dropSpots } from '../drops.js';
import { makeRides, WHEEL } from '../fairrides.js';

const TAU = Math.PI * 2;
// ---- the plan (town voxels; x east, z south) ------------------------------------------------------------------------
const W0 = 3, W1 = 6, E0 = WX - 7, E1 = WX - 4, N0 = 3, N1 = 6, S0 = WZ - 7, S1 = WZ - 4;   // the fence, four thick
const GATE = 22;                       // half the width of a gate
const GX = 256, GZ = 208;              // the gates' middles: north and south on x = GX, west and east on z = GZ
const MID = [184, 232];                // the midway, z from and to
const AVE = [234, 278];                // the avenue, x from and to
const RING = 40;                       // the ring road: this far in from the fence's outside
const FERRIS = { x: 96, z: 74 };       // the Ferris wheel's hub; its alley runs east from it along z
const TENT = { x: 384, z: 138, r: 32 };
const CAROUSEL = { x: 132, z: 318, r: 17 };
const GEN = { x0: 44, x1: 62, z0: 254, z1: 264 };       // the generator truck
const COASTER = { x: 392, z: 318, hx: 72, hz: 48, r: 30 };
const SWITCH = { x: 82, z: 259 };      // the lights' switch, by the generator
const RELEASE = { x: 60, z: 112 };     // the wheel's release, by its stand

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
    for (let t = 1; t <= 6; t++) { const f = t / 7, x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; BULBS.push([x + 0.5, 15.5 - 3.2 * Math.sin(f * Math.PI), z + 0.5, k++ % 5, quarter(x, z)]); }
  }
}
// the lights' state, shared with the look (which draws it) and the radar: how bright each quarter is (1 on, 0 out)
const POWER = { on: [1, 1, 1, 1], lit: [1, 1, 1, 1] };
const LIGHTS = { first: 50, every: 24, after: 45, boost: 1.35 };   // seconds to the first quarter going out, between quarters, after a reset; how much faster the dead are in the dark

// the six places to line up for the round, the player's first, far apart and facing into the fair
const STARTS = [
  { x: 70, z: 208, yaw: Math.PI / 2 }, { x: 442, z: 208, yaw: -Math.PI / 2 }, { x: 256, z: 60, yaw: 0 },
  { x: 256, z: 356, yaw: Math.PI }, { x: 310, z: 150, yaw: -2.2 }, { x: 200, z: 286, yaw: Math.PI / 2 },
];
const SPOTS = [...STARTS, { x: 24, z: 24 }, { x: WX - 24, z: 24 }, { x: 24, z: WZ - 24 }, { x: WX - 24, z: WZ - 24 }, { x: 160, z: 208 }, { x: 352, z: 208 }, { x: 256, z: 150 }, { x: 256, z: 270 }];
// where the supply drops come down (../drops.js): open ground, spread over the fair
const DROPS = dropSpots([[256, 208], [150, 150], [330, 76], [190, 360], [300, 250], [460, 208], [60, 190], [256, 110], [256, 320], [440, 80]]);
// the two switches (pickups.js 'switch': driven over, it does what its `on` says). The map's rides and lights fill in
// what they do when they are made (setup, below).
const SW_LIGHTS = { kind: 'switch', x: SWITCH.x, z: SWITCH.z, hold: true, name: 'Lights on', sub: 'The generator is running again' };
const SW_WHEEL = { kind: 'switch', x: RELEASE.x, z: RELEASE.z, hold: true, up0: true, rivals: false, name: 'Wheel released', sub: 'Stay out of its way' };

// ---- the route grid: the voxels, and the wheel while it is on its stand ------------------------------------------------
let rides = null;
const nav = makeGridNav({ also: (x, z) => !!rides && rides.blocks(x, z) });
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
  // the board over the way in
  begin('Tent sign', 'sign', true);
  box(cx - 14, 14, cz + r + 1, cx + 14, 21, cz + r + 1, M.DARK);
  const F = face('b', cx - 14, cz + r + 1, cx + 14, cz + r + 1), name = 'BIG TOP';
  text(F, name, (F.W - textW(name)) >> 1, 15, 1, M.LIT_Y);
  for (const x of [cx - 14, cx + 14]) box(x, 0, cz + r + 1, x, 13, cz + r + 1, M.DARK);
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
  // the ticket hut
  begin('Ticket hut', 'prop', false);
  box(cx - 34, 0, cz + 18, cx - 26, 7, cz + 24, M.AWN_B); box(cx - 35, 8, cz + 17, cx - 25, 8, cz + 25, M.TRIM); box(cx - 32, 3, cz + 24, cx - 28, 5, cz + 24, M.LIT_Y);
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

// ---- booths, the generator and the small things ---------------------------------------------------------------------
// a game booth: a counter under a striped awning, open toward the midway (dir 1: its front is toward +z, -1: -z).
// A prop: a car goes through it.
const AWN = () => [M.AWN_R, M.AWN_B, M.AWN_G, M.SIGN];
function booth(x, z, dir, k) {
  begin('Game booth', 'prop', false);
  const w = 13, d = 7, back = dir > 0 ? z : z + d, front = dir > 0 ? z + d : z, col = AWN()[k % 4];
  box(x, 0, back, x + w, 7, back, M.WOOD); box(x, 0, Math.min(back, front), x, 7, Math.max(back, front), M.WOOD); box(x + w, 0, Math.min(back, front), x + w, 7, Math.max(back, front), M.WOOD);
  box(x, 0, front, x + w, 2, front, col); box(x, 3, front, x + w, 3, front, M.TRIM);
  for (let a = 0; a <= w; a++) box(x + a, 8, Math.min(back, front) - 1, x + a, 8, Math.max(back, front) + 1, ((a / 2) | 0) & 1 ? col : M.TRIM);
  for (let a = 2; a < w; a += 3) set(x + a, 6, back + dir, [M.LIT_Y, M.LIT_R, M.LIT_B][(a + k) % 3]);   // the prizes on the back wall
}
function generator({ x0, x1, z0, z1 }) {
  begin('Generator truck', 'barrier', true);
  box(x0, 2, z0, x1, 11, z1, M.CAR_C); box(x0, 12, z0, x1, 12, z1, M.DARK);
  for (let y = 4; y <= 9; y += 2) box(x0 + 2, y, z1, x1 - 6, y, z1, M.DARK);            // the louvres
  box(x1 - 4, 5, z1, x1 - 2, 8, z1, M.LIT_Y);                                           // its panel
  for (const x of [x0 + 2, x1 - 3]) for (const z of [z0, z1 - 1]) box(x, 0, z, x + 1, 1, z + 1, M.TYRE);
  box(x0 + 3, 13, z0 + 3, x0 + 4, 18, z0 + 4, M.STEEL); set(x0 + 3, 19, z0 + 3, M.CHAR);   // the exhaust stack
}
function hayBale(x, z, alongX) { begin('Hay bale', 'prop', false); if (alongX) box(x, 0, z, x + 4, 2, z + 2, M.OCHRE); else box(x, 0, z, x + 2, 2, z + 4, M.OCHRE); }
function lampPost(x, z) {
  begin('Lamp post', 'prop', false);
  box(x, 0, z, x, 15, z, M.DARK); set(x, 16, z, M.LIT_Y);
}
// the high striker: ring the bell
function striker(x, z) {
  begin('High striker', 'prop', false);
  box(x, 0, z, x + 2, 1, z + 2, M.AWN_R);
  for (let y = 2; y <= 26; y++) { set(x + 1, y, z + 1, ((y / 4) | 0) & 1 ? M.AWN_R : M.TRIM); }
  disc(x + 1, z + 1, 27, 2, M.BRASS); set(x + 1, 28, z + 1, M.LIT_Y);
}

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
  box(GX - GATE - 4, 22, S0 - 1, GX + GATE + 4, 30, S0 - 1, M.DARK);
  const sign = face('f', GX - GATE - 4, S0 - 1, GX + GATE + 4, S0 - 1), name = 'DEAD MANS FAIR';
  text(sign, name, ((sign.W - textW(name)) >> 1), 24, 1, M.LIT_Y);
  for (let x = GX - GATE - 3; x <= GX + GATE + 3; x += 3) set(x, 31, S0 - 1, (x / 3) & 1 ? M.LIT_R : M.LIT_Y);

  wheelStand(FERRIS);
  bigTop(TENT);
  carouselPlinth(CAROUSEL);
  generator(GEN);
  coaster();
  // the booths along the midway, their fronts to it
  let k = 0;
  for (const x of [56, 88, 120, 152, 184, 300, 428, 460]) booth(x, MID[0] - 18, 1, k++);
  for (const x of [72, 104, 168, 296, 328, 360]) booth(x, MID[1] + 11, -1, k++);
  striker(214, MID[0] - 16); striker(296, MID[1] + 44);
  for (const [x, z, a] of [[150, 96, 1], [158, 96, 1], [300, 100, 0], [210, 250, 1], [216, 254, 0], [300, 296, 1], [60, 350, 0], [226, 120, 0], [90, 286, 1], [176, 150, 1], [330, 164, 0]]) hayBale(x, z, a);
  for (const [x, z] of POSTS) lampPost(x, z);
  // the crossing, the midway and the wheel's alley are left open
  finish();
}

// ---- the painted ground -----------------------------------------------------------------------------------------------
// Trampled straw and packed dirt (browns and straw, not greens: the dead are green, and should stand out on it), the
// midway and the avenue worn darker, sawdust round the tent and the rides, a chalked show ring at the crossing, and the
// wheel's alley, where the grass never grew back.
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
  // the wheel's alley: a long worn strip east from the wheel, with chalk warnings along its edges
  dirt(FERRIS.x - 34, FERRIS.z - 9, E0, FERRIS.z + 9, '#74634a');
  g.fillStyle = 'rgba(236,226,200,0.55)';
  for (let x = FERRIS.x + 40; x < E0 - 8; x += 14) { rect(x, FERRIS.z - 10.2, x + 7, FERRIS.z - 9.4); rect(x, FERRIS.z + 9.4, x + 7, FERRIS.z + 10.2); }
  // sawdust round the tent, the carousel and under the coaster's station
  g.fillStyle = 'rgba(214,190,130,0.5)'; circle(TENT.x, TENT.z, TENT.r + 9); g.fill(); circle(CAROUSEL.x, CAROUSEL.z, CAROUSEL.r + 8); g.fill();
  mottle(TENT.x - 44, TENT.z - 44, TENT.x + 44, TENT.z + 44, 1.5, [[230, 210, 150, 0.2], [150, 126, 84, 0.2]]);
  // the show ring chalked at the crossing: two rings and a star
  g.strokeStyle = 'rgba(240,232,210,0.6)'; g.lineWidth = 0.9 * GK; circle(GX, GZ, 30); g.stroke(); g.lineWidth = 0.5 * GK; circle(GX, GZ, 24); g.stroke();
  g.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * TAU * 2 / 5, x = GX + Math.cos(a) * 20, z = GZ + Math.sin(a) * 20; if (i) g.lineTo(x * GK, z * GK); else g.moveTo(x * GK, z * GK); } g.stroke();
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

// ---- the lights -------------------------------------------------------------------------------------------------------
// Run from the round's own clock (so every device online agrees): a quarter goes out at LIGHTS.first, then one more
// every LIGHTS.every, in an order that is the same on every device, until someone drives over the switch.
let lightsApi = null, lightT = 0, lightN = 0, lightsRound = false;
const ORDER = [2, 1, 0, 3, 1, 3, 0, 2];
function lightsOn(c) {
  for (let q = 0; q < 4; q++) POWER.on[q] = 1;
  lightT = LIGHTS.after; SW_LIGHTS.raise = false;
  if (lightsApi && c) lightsApi.sfx.play('ui_go', 0.8, SWITCH.x, SWITCH.z);
}
function stepLights(dt) {
  const G = lightsApi; if (!G) return;
  const m = G.mode, running = !!m && m.phase === 'run';
  if (!running) { if (lightsRound && m && m.phase === 'count') { lightsRound = false; lightsOn(null); lightT = LIGHTS.first; } }
  else {
    if (!lightsRound) { lightsRound = true; lightT = Math.max(1, LIGHTS.first - (m.clock || 0)); }
    if ((lightT -= dt) <= 0) {
      lightT = LIGHTS.every;
      let q = -1; for (let i = 0; i < ORDER.length && q < 0; i++) { const o = ORDER[(lightN + i) % ORDER.length]; if (POWER.on[o]) q = o; }
      lightN++;
      if (q >= 0) {
        POWER.on[q] = 0; SW_LIGHTS.raise = true;
        G.banner('Lights out', `The ${QUARTERS[q]} is dark. Hit the switch by the generator`);
        G.sfx.play('ui_tab', 0.9); G.sound('alarm', 0.5);
      }
    }
  }
  for (let q = 0; q < 4; q++) POWER.lit[q] += (POWER.on[q] - POWER.lit[q]) * Math.min(1, dt * 2.5);
}

export default {
  id: 'fair', name: "Dead Man's Fair", mode: 'survival',
  blurb: 'A county fair overrun by the dead, with the lights failing. No fighting the other cars: outlast them all.',
  story: 'The dead have the run of the fair, and there are more every minute. Keep the lights on, and let the big wheel loose when they bunch up.',
  loading: ['Opening the fair', 'Stringing up the lights'],
  outer: 0x7f7450,
  // twilight, with the fair's lights on (looks/fair.js): the bulbs, the posts' pools of light, and which quarters are lit
  look: { kind: 'fair', middle: [GX, GZ], bulbs: BULBS, posts: POSTS.map(([x, z]) => [x + 0.5, z + 0.5, quarter(x, z)]), power: POWER, box: [W1 + 1, N1 + 1, E0, S0] },
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
  pickups: [...DROPS, SW_LIGHTS, SW_WHEEL],
  drops: DROPS,
  // the rides (meshes: the wheel and the carousel), made once the game's parts are there
  hazards: [{ kind: 'custom', make(api) {
    lightsApi = api;
    rides = makeRides(api, { wheel: { ...FERRIS, to: WX + 300 }, carousel: CAROUSEL });
    SW_WHEEL.on = (c) => rides.release(c);
    SW_LIGHTS.on = (c) => lightsOn(c);
    SW_LIGHTS.raise = false;
    return { step(dt, live) { rides.step(dt, live); stepLights(dt); SW_WHEEL.gone = rides.loose; } };
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
  },
  nav,
  rides: () => rides && rides.wheel,   // (for the tests)
};
