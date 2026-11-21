// Camp Deadfall: an army base the dead have overrun, for the last-car-standing round (modes/survival.js).
// A square of concrete wall with a gate in each side. A runway runs east to west through the middle and the main road
// north to south, and they cross in the open: that is the killing field. Round them, a quarter each: the hangar (a
// helicopter in for repair), headquarters with the radio mast, the parade square and the helipad, four quonset huts of
// barracks under a water tower, and the motor pool (tanks, jeeps and trucks behind a wire fence) beside the fuel farm.
// Guard towers stand at the corners and the gates, with sandbag nests, crates, barbed wire and fuel drums about.
// Everything can be knocked down; the fuel, the drums, the ammunition and the vehicles blow up. A ring road runs inside
// the wall, so there is always a way round.
//
// The horde comes in through the gates and over the wall (gates, wallSpot), and late in the round it blows holes in the
// wall (breach). The rivals find their way with the route-finder in common.js.
import * as THREE from 'three';
import { WX, WZ, M, K, MAT_R, MAT_G, MAT_B, SOFT, CARRY, TOUGH, KIND, SHAPE, FLAM, BURN, CHARP, begin, set, box, walls, ctx, place, rnd, setSeed } from '../../../src/world.js';
import { face, text, textW, disc } from '../../../src/kit.js';
import { PACK } from '../../../units/src/pack.js';
import { canvasFor, finish, makeGridNav, pickSpot, gridRadar } from './common.js';

const nav = makeGridNav();
const radarGrid = gridRadar(nav);

// ---- the plan (town voxels; x east, z south) ------------------------------------------------------------------------
const W0 = 3, W1 = 6, E0 = WX - 7, E1 = WX - 4, N0 = 3, N1 = 6, S0 = WZ - 7, S1 = WZ - 4;   // the wall, four thick
const GATE = 22;                       // half the width of a gate
const GX = 256, GZ = 208;              // the gates' middles: north and south on x = GX, west and east on z = GZ
const RUN = [178, 238];                // the runway, z from and to
const ROAD = [236, 276];               // the main road, x from and to
const RING = 40;                       // the ring road: this far in from the wall's outside
const HANGAR = { x0: 64, x1: 184, z0: 58, z1: 146 };
const HQ = { x0: 300, x1: 380, z0: 60, z1: 100 };
const PAD = { x: 430, z: 134, r: 26 };
const POOL = { x0: 290, x1: 410, z0: 250, z1: 366 };
const HUTS = [[56, 128, 265], [150, 222, 265], [56, 128, 327], [150, 222, 327]];
const TANKS = [[452, 272], [452, 306], [452, 340]];

// the six places to line up for the round, the player's first, far apart and facing into the base
const STARTS = [
  { x: 70, z: 208, yaw: Math.PI / 2 }, { x: 442, z: 208, yaw: -Math.PI / 2 }, { x: 256, z: 64, yaw: 0 },
  { x: 256, z: 352, yaw: Math.PI }, { x: 352, z: 156, yaw: -2.2 }, { x: 140, z: 296, yaw: Math.PI / 2 },
];
// where rivals could come in, if a mode asks for more (every start, and some open ground)
const SPOTS = [...STARTS, { x: 24, z: 24 }, { x: WX - 24, z: 24 }, { x: 24, z: WZ - 24 }, { x: WX - 24, z: WZ - 24 }, { x: 160, z: 208 }, { x: 352, z: 208 }, { x: 256, z: 150 }, { x: 256, z: 270 }];

// ---- the base's own materials: olive drab paint in two shades, and sandbag cloth in two -------------------------------
// The town's materials stop short of the table's end; these take the free places when this map is built (and only then,
// so another map's materials can use the same places).
const OLIVE = 93, OLIVE_D = 94, BAG = 95, BAG_D = 34;
function materials() {
  const c = new THREE.Color();
  const def = (id, name, hex, soft, carry, tough, kind, shape, flam = 0, burn = 0, charp = 0) => {
    M[name] = id; c.setHex(hex, THREE.SRGBColorSpace); MAT_R[id] = c.r; MAT_G[id] = c.g; MAT_B[id] = c.b;
    SOFT[id] = soft; CARRY[id] = carry; TOUGH[id] = tough; KIND[id] = kind; SHAPE[id] = shape; FLAM[id] = flam; BURN[id] = burn; CHARP[id] = charp;
  };
  def(OLIVE, 'OLIVE', 0x5f6a3a, 0.95, 1, 0.45, K.METAL, 6);
  def(OLIVE_D, 'OLIVE_D', 0x485131, 0.95, 1, 0.45, K.METAL, 6);
  def(BAG, 'BAG', 0xa69a6c, 1.0, 1, 0.5, K.CLOTH, 3, 0.2, 2, 0.2);
  def(BAG_D, 'BAG_D', 0x8b7f57, 1.0, 1, 0.5, K.CLOTH, 3, 0.2, 2, 0.2);
}
// camouflage blotches over a box, from a hash of the voxel
const hash = (x, y, z, s = 0) => { let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791) ^ Math.imul(s, 2654435761)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h & 0xffff) / 65536; };
const camo = (x, y, z) => (hash(x >> 2, y >> 1, z >> 2, 5) < 0.3 ? OLIVE_D : OLIVE);

// ---- the wall, the gates and the wire ---------------------------------------------------------------------------------
// One straight stretch of wall, xa..xb by za..zb, in concrete panels with darker joints, a painted band and a cap,
// cut into bodies of 32 so a hole in it stays a hole. Cars bounce off it ('barrier'); rockets can still break it.
function wallRun(xa, za, xb, zb) {
  const alongX = xb - xa > zb - za, len = alongX ? xb - xa + 1 : zb - za + 1, thick = alongX ? zb - za : xb - xa;
  for (let s = 0; s < len; s += 32) {
    begin('Perimeter wall', 'barrier', false);
    for (let t = s; t < Math.min(len, s + 32); t++) for (let w = 0; w <= thick; w++) for (let y = 0; y <= 9; y++) {
      const x = alongX ? xa + t : xa + w, z = alongX ? za + w : za + t;
      set(x, y, z, y === 9 ? M.SLAB : y === 0 || t % 8 === 0 ? M.STONE : y === 3 || y === 4 ? OLIVE_D : M.CONC);
    }
    // wire along the top: stakes every six, a strand between them and barbs hanging off it
    begin('Barbed wire', 'prop', false);
    for (let t = s; t < Math.min(len, s + 32); t++) {
      const m = (thick >> 1), x = alongX ? xa + t : xa + m, z = alongX ? za + m : za + t;
      if (t % 6 === 0) box(x, 10, z, x, 12, z, M.DARK);
      set(x, 12, z, M.DARK);
      if (t % 3 === 1) set(x, 11, z, M.DARK);
    }
  }
}
// a gate pillar: a concrete post with a lamp on top
function pillar(x0, z0, x1, z1) {
  begin('Gate pillar', 'barrier', false);
  box(x0, 0, z0, x1, 13, z1, M.CONC); box(x0, 14, z0, x1, 14, z1, M.SLAB);
  for (let y = 1; y < 13; y += 4) box(x0, y, z0, x1, y, z1, M.STONE);
  set((x0 + x1) >> 1, 15, (z0 + z1) >> 1, M.LIT_Y);
}
// a boom barrier across a gate: a striped pole along x from its post at x0 to x1, down (a prop: it goes at any speed)
function boom(x0, z, x1) {
  begin('Boom barrier', 'prop', false);
  box(x0, 0, z, x0, 4, z, M.DARK);
  const s = Math.sign(x1 - x0);
  for (let t = 1; t <= Math.abs(x1 - x0); t++) set(x0 + s * t, 4, z, ((t / 3) | 0) % 2 ? M.AWN_R : M.TRIM);
}
// barbed wire on the ground: a coil along a line on stakes, knee high (a prop: any car rolls it flat)
function concertina(x0, z0, x1, z1) {
  begin('Barbed wire', 'prop', false);
  const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len;
  for (let t = 0; t <= len; t += 0.5) {
    const a = t * 1.1, x = x0 + ux * t - uz * Math.cos(a) * 1.4, z = z0 + uz * t + ux * Math.cos(a) * 1.4;
    set(Math.round(x), Math.round(1.6 + Math.sin(a) * 1.5), Math.round(z), M.DARK);
    if (Math.round(t) % 8 === 0 && t === Math.round(t)) box(Math.round(x0 + ux * t), 0, Math.round(z0 + uz * t), Math.round(x0 + ux * t), 3, Math.round(z0 + uz * t), M.WOOD);
  }
}

// ---- sandbags, crates and drums -----------------------------------------------------------------------------------------
// a sandbag wall along a line, `h` high and two thick, the bags laid in courses with their joints staggered. Not a
// prop: a car needs some speed to burst through.
function sandbags(x0, z0, x1, z1, h = 4, name = 'Sandbags') {
  begin(name, 'sandbags', false);
  const len = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)), ux = (x1 - x0) / (len || 1), uz = (z1 - z0) / (len || 1);
  for (let t = 0; t <= len; t++) for (let w = 0; w < 2; w++) for (let y = 0; y < h; y++) {
    const x = Math.round(x0 + ux * t - uz * w), z = Math.round(z0 + uz * t + ux * w);
    set(x, y, z, (t + (y & 1) * 2) % 4 === 0 ? BAG_D : BAG);
  }
}
// a machine-gun nest: sandbags round three sides of a square, the open side away from `face` ('n', 's', 'e' or 'w'),
// with a gun on a tripod
function nest(cx, cz, open) {
  const r = 6;
  const sides = { n: [cx - r, cz - r, cx + r, cz - r], s: [cx - r, cz + r, cx + r, cz + r], w: [cx - r, cz - r, cx - r, cz + r], e: [cx + r, cz - r, cx + r, cz + r] };
  for (const k of Object.keys(sides)) if (k !== open) { const [a, b, c, d] = sides[k]; sandbags(a, b, c, d, 4, 'Sandbag nest'); }
  begin('Machine gun', 'prop', false);
  box(cx, 0, cz, cx, 4, cz, M.DARK); set(cx - 1, 0, cz - 1, M.DARK); set(cx + 1, 0, cz + 1, M.DARK);
  const dx = open === 'e' ? 1 : open === 'w' ? -1 : 0, dz = open === 's' ? 1 : open === 'n' ? -1 : 0;
  for (let t = -2; t <= 5; t++) set(cx + dx * t, 5, cz + dz * t, t > 2 ? M.STEEL : M.DARK);
  set(cx - dz, 4, cz + dx, OLIVE); set(cx - dz, 5, cz + dx, OLIVE);   // the ammunition box
}
// a wooden crate, w by d by h, its edges in darker boards
function crate(x, y, z, w, d, h) {
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) for (let k = 0; k < d; k++) {
    const e = (i === 0 || i === w - 1) + (j === 0 || j === h - 1) + (k === 0 || k === d - 1);
    set(x + i, y + j, z + k, e >= 2 ? M.TRUNK : M.WOOD);
  }
}
// a pile of crates, each its own prop
function crates(x, z, n = 4) {
  const L = [[0, 0, 0, 5, 5, 4], [5, 0, 0, 5, 5, 4], [0, 4, 0, 5, 5, 4], [0, 0, 5, 6, 4, 4], [6, 0, 6, 4, 4, 3], [2, 8, 1, 4, 4, 3]];
  for (let i = 0; i < Math.min(n, L.length); i++) { const [a, y, b, w, d, h] = L[i]; begin('Crate', 'prop', false); crate(x + a, y, z + b, w, d, h); }
}
// ammunition boxes: olive, stencilled, and they go up when they are hit
function ammo(x, z) {
  const b = begin('Ammunition', 'prop', false); b.explosive = 5;
  for (const [a, y, c] of [[0, 0, 0], [4, 0, 0], [0, 0, 3], [4, 0, 3], [2, 2, 1]]) {
    box(x + a, y, z + c, x + a + 3, y + 1, z + c + 2, OLIVE);
    set(x + a + 1, y + 1, z + c, M.TAXI); set(x + a + 2, y + 1, z + c, M.TAXI);
  }
  set(x + 3, 1, z + 2, M.FUEL);   // hidden inside: a blow that reaches it sets the lot off
}
// a cluster of fuel drums (red bands) that blow up
function drums(x, z, n = 5) {
  const b = begin('Fuel drums', 'prop', false); b.explosive = 6;
  const P = [[0, 0], [3, 0], [0, 3], [3, 3], [6, 1], [1, 6], [6, 5]];
  for (let i = 0; i < Math.min(n, P.length); i++) { const [a, c] = P[i]; for (let y = 0; y < 4; y++) box(x + a, y, z + c, x + a + 1, y, z + c + 1, y === 1 ? M.FUEL : i & 1 ? OLIVE : M.CAR_B); }
}
// a floodlight on a pole
function flood(x, z, dx, dz) {
  begin('Floodlight', 'prop', false);
  box(x, 0, z, x, 17, z, M.DARK); set(x + 1, 0, z, M.DARK); set(x - 1, 0, z, M.DARK); set(x, 0, z + 1, M.DARK); set(x, 0, z - 1, M.DARK);
  box(x - 1, 18, z - 1, x + 1, 18, z + 1, M.DARK); box(x + dx - 1, 17, z + dz - 1, x + dx + 1, 17, z + dz + 1, M.LIT_W);
}
// low concrete blocks, a car's length, for cover on the open ground
function blocks(x, z, alongX) {
  begin('Concrete barrier', 'block', false);
  for (let t = 0; t < 12; t++) for (let w = 0; w < 3; w++) for (let y = 0; y < 4; y++) {
    if (y === 3 && w !== 1) continue;
    set(alongX ? x + t : x + w, y, alongX ? z + w : z + t, t % 6 === 5 ? M.STONE : M.CONC);
  }
}

// ---- guard towers ---------------------------------------------------------------------------------------------------
// four legs (knock one out and it comes down), braces above a car's roof, a floor, a sandbag parapet, a roof and a
// searchlight
function tower(cx, cz, legM = M.WOOD) {
  begin('Guard tower', 'tower', true);
  const f = 18;
  for (const sx of [-6, 4]) for (const sz of [-6, 4]) box(cx + sx, 0, cz + sz, cx + sx + 1, f, cz + sz + 1, legM);
  for (const y of [9, 16]) { walls(cx - 6, y, cz - 6, cx + 5, y, cz + 5, legM); }
  // a cross brace on each side, stepped two at a time so every piece touches the next
  for (let k = 0; k < 6; k++) for (const [a, b] of [[-5 + k, -6], [3 - k, 5]]) { box(cx + a, 10 + k, cz + b, cx + a + 1, 10 + k, cz + b, legM); box(cx + b, 10 + k, cz + a, cx + b, 10 + k, cz + a + 1, legM); }
  box(cx - 7, f + 1, cz - 7, cx + 6, f + 1, cz + 6, M.WOOD);
  for (let y = f + 2; y <= f + 4; y++) for (let t = -7; t <= 6; t++) for (const e of [-7, 6]) { const m = (t + (y & 1) * 2) % 4 === 0 ? BAG_D : BAG; set(cx + t, y, cz + e, m); set(cx + e, y, cz + t, m); }
  for (const sx of [-7, 6]) for (const sz of [-7, 6]) box(cx + sx, f + 5, cz + sz, cx + sx, f + 8, cz + sz, M.WOOD);
  box(cx - 8, f + 9, cz - 8, cx + 7, f + 9, cz + 7, M.ROOF_D); box(cx - 6, f + 10, cz - 6, cx + 5, f + 10, cz + 5, OLIVE_D);
  box(cx - 1, f + 2, cz - 1, cx, f + 6, cz, M.DARK); set(cx, f + 7, cz, M.LIT_W); set(cx - 1, f + 7, cz, M.STEEL);   // the searchlight
  for (let y = 1; y < f; y += 2) set(cx + 6, y, cz - 5, M.WOOD);   // the ladder, up one leg
}
// the guard post at a gate: a little hut with windows all round and a flat roof
function booth(x0, z0) {
  begin('Guard post', 'booth', true);
  walls(x0, 0, z0, x0 + 8, 8, z0 + 8, OLIVE);
  for (const F of ['f', 'r', 'b', 'l'].map((s) => face(s, x0, z0, x0 + 8, z0 + 8))) { F.box(2, 4, 6, 6, 0, 0, M.GLASS); F.box(0, 0, F.W - 1, 0, 0, 0, M.CONC); }
  face('r', x0, z0, x0 + 8, z0 + 8).box(3, 0, 5, 3, 0, 0, M.DOOR_G);
  box(x0 - 1, 9, z0 - 1, x0 + 9, 9, z0 + 9, M.SLAB); set(x0 + 4, 10, z0 + 4, M.LIT_R);
}

// ---- the hangar: an arched roof over a long shed, doors at both ends so a car can drive straight through -------------
function hangar({ x0, x1, z0, z1 }) {
  const cx = (x0 + x1) / 2, a = (x1 - x0) / 2, eave = 8, rise = 28;
  const roofY = (x) => { const u = (x + 0.5 - cx) / a; return eave + Math.round(rise * Math.sqrt(Math.max(0, 1 - u * u))); };
  // the roof, in bays of 11 along its length, ribbed with steel; each column of the arch runs down to its outer
  // neighbour so the shell is whole
  for (let zs = z0; zs <= z1; zs += 11) {
    begin('Hangar roof', 'hangar', true);
    for (let z = zs; z < Math.min(z1 + 1, zs + 11); z++) for (let x = x0; x <= x1; x++) {
      const y1 = roofY(x), out = x < cx ? roofY(x - 1) : roofY(x + 1), y0 = x === x0 || x === x1 ? 0 : Math.min(y1, out + 1);
      for (let y = y0; y <= y1; y++) set(x, y, z, z === zs ? M.STEEL : (x & 1) ? OLIVE : OLIVE_D);
    }
  }
  // the gable ends: wall up to the arch, with the big door (south) and a smaller one (north), and the number
  for (const [z, half, high] of [[z0, 22, 18], [z1, 40, 24]]) {
    begin('Hangar end', 'hangar', true);
    for (let x = x0 + 1; x < x1; x++) for (let y = 0; y < roofY(x); y++) {
      const u = Math.abs(x + 0.5 - cx);
      if (u < half && y < high) continue;
      set(x, y, z, u < half + 1 && y === high ? M.STEEL : y < 2 ? M.CONC : (x % 6 === 0 ? OLIVE_D : OLIVE));
    }
    for (let x = Math.ceil(cx - half); x < cx + half; x++) set(x, high, z, M.STEEL);
    for (const s of [-1, 1]) box(Math.round(cx + s * half) - (s < 0 ? 1 : 0), 0, z, Math.round(cx + s * half) - (s < 0 ? 1 : 0), high, z, M.STEEL);
    const F = face(z === z0 ? 'f' : 'b', x0, z0, x1, z1), u0 = z === z0 ? Math.round(x1 - cx - textW('1', 2) / 2) : Math.round(cx - x0 - textW('1', 2) / 2);
    text(F, '1', u0, high + 2, 0, M.TRIM, 2);
  }
  // inside: the helicopter in for repair, a fuel cart, crates and a workbench along the walls
  stamp('heli', cx, (z0 + z1) / 2 + 2, 's', 2, heliPaint(OLIVE, OLIVE_D), 'Helicopter', 10);
  crates(x0 + 4, z0 + 6, 6); crates(x1 - 14, z0 + 6, 4); drums(x0 + 4, z1 - 16, 5); ammo(x1 - 12, z1 - 14);
  begin('Workbench', 'prop', false); box(x0 + 3, 0, z0 + 30, x0 + 6, 3, z0 + 50, M.WOOD); box(x0 + 3, 4, z0 + 32, x0 + 4, 5, z0 + 34, M.CAR_A); box(x0 + 3, 4, z0 + 40, x0 + 3, 6, z0 + 41, M.DARK);
}

// ---- the barracks: quonset huts, half a cylinder of ribbed metal on its side -----------------------------------------
function quonset(x0, x1, cz, r = 11) {
  const top = (dz) => Math.floor(Math.sqrt(Math.max(0, r * r - (dz + 0.5) * (dz + 0.5))));
  for (let xs = x0; xs <= x1; xs += 12) {
    begin('Barracks hut', 'hut', true);
    for (let x = xs; x < Math.min(x1 + 1, xs + 12); x++) for (let dz = -r; dz < r; dz++) {
      const y1 = top(dz), y0 = dz === -r || dz === r - 1 ? 0 : Math.min(y1, top(dz < 0 ? dz - 1 : dz + 1) + 1);
      for (let y = y0; y <= y1; y++) {
        const win = (x - x0) % 12 >= 5 && (x - x0) % 12 <= 6 && y >= 4 && y <= 5 && Math.abs(dz + 0.5) > r - 3;
        set(x, y, cz + dz, win ? M.GLASS : x & 1 ? OLIVE : OLIVE_D);
      }
    }
  }
  // the ends: boarded, with a door and two windows
  for (const x of [x0, x1]) {
    begin('Hut end', 'hut', true);
    for (let dz = -r + 1; dz < r - 1; dz++) for (let y = 0; y < top(dz); y++) {
      const door = Math.abs(dz + 0.5) < 2.5 && y < 7, win = Math.abs(Math.abs(dz + 0.5) - 6) < 1.6 && y >= 4 && y <= 6;
      set(x, y, cz + dz, door ? M.DOOR_G : win ? M.GLASS : y === 0 ? M.CONC : M.PL_W);
    }
    for (let dz = -3; dz <= 2; dz++) set(x + (x === x0 ? -1 : 1), 8, cz + dz, OLIVE_D);   // a little porch roof over the door
  }
}

// ---- headquarters, the radio mast and the flag ------------------------------------------------------------------------
function headquarters({ x0, x1, z0, z1 }) {
  begin('Headquarters', 'office', true);
  const top = 22;
  walls(x0, 0, z0, x1, top, z1, M.REND_C);
  box(x0 + 1, 11, z0 + 1, x1 - 1, 11, z1 - 1, M.SLAB); box(x0, top + 1, z0, x1, top + 1, z1, M.SLAB);
  const Fs = ['f', 'r', 'b', 'l'].map((s) => face(s, x0, z0, x1, z1));
  for (const F of Fs) {
    F.box(0, 0, F.W - 1, 2, 0, 0, OLIVE_D); F.band(top + 2, top + 3, 0, M.REND_C); F.band(11, 11, 1, OLIVE_D);
    for (let u = 4; u + 4 < F.W - 2; u += 9) for (const y of [4, 15]) F.box(u, y, u + 3, y + 4, 0, 0, M.GLASS);
  }
  // the front, on the parade square: a door under a canopy, and the sign
  const F = Fs[2], mid = (F.W >> 1);
  F.box(mid - 3, 0, mid + 3, 8, 0, 0, M.GLASS); F.box(mid - 3, 0, mid + 3, 0, 0, 0, M.DARK);
  F.box(mid - 6, 9, mid + 6, 9, 1, 5, M.SLAB); F.box(mid - 6, 0, mid - 6, 8, 5, 5, M.TRIM); F.box(mid + 6, 0, mid + 6, 8, 5, 5, M.TRIM);
  F.box(mid - 9, 17, mid + 8, 21, 1, 1, OLIVE_D); text(F, 'HQ', mid - (textW('HQ', 1) >> 1), 17, 2, M.LIT_Y, 1);
  // on the roof: plant, a satellite dish and aerials
  begin('Roof plant', 'prop', false);
  box(x0 + 8, top + 2, z0 + 8, x0 + 16, top + 6, z0 + 14, M.METAL); box(x0 + 9, top + 7, z0 + 9, x0 + 15, top + 7, z0 + 13, M.DARK);
  box(x1 - 12, top + 2, z0 + 10, x1 - 12, top + 14, z0 + 10, M.DARK); box(x1 - 20, top + 2, z1 - 8, x1 - 20, top + 10, z1 - 8, M.DARK);
  begin('Satellite dish', 'prop', false);
  const dx = x0 + 30, dz = z0 + 20;
  box(dx, top + 2, dz, dx, top + 6, dz, M.STEEL);
  for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) if (a * a + b * b <= 18) set(dx + a, top + 9 + b, dz + 2 + Math.round((a * a + b * b) / 9), M.TRIM);
  box(dx, top + 9, dz + 2, dx, top + 9, dz + 6, M.DARK);
}
function mast(cx, cz, h = 72) {
  begin('Radio mast', 'mast', true);
  box(cx - 4, 0, cz - 4, cx + 4, 0, cz + 4, M.CONC);
  const half = Math.floor(h * 0.5);
  for (let y = 1; y <= h; y++) {
    const band = ((y / 9) | 0) % 2 ? M.AWN_R : M.TRIM, w = y < half ? 2 : 1;
    for (const [a, b] of [[-w, -w], [w, -w], [-w, w], [w, w]]) set(cx + a, y, cz + b, band);
    if (y % 4 === 0) walls(cx - w, y, cz - w, cx + w, y, cz + w, band);
    if (y === half) box(cx - 2, y, cz - 2, cx + 2, y, cz + 2, band);   // where it narrows
  }
  box(cx, h + 1, cz, cx, h + 1, cz, M.DARK); box(cx - 1, h, cz - 1, cx + 1, h, cz + 1, band0()); set(cx, h + 2, cz, M.LIT_R);
  box(cx - 4, 30, cz, cx - 3, 32, cz, M.TRIM); box(cx + 3, 30, cz, cx + 4, 32, cz, M.TRIM);   // the dishes on it
  box(cx - 3, 46, cz, cx - 2, 48, cz, M.TRIM); box(cx + 2, 46, cz, cx + 3, 48, cz, M.TRIM);
  function band0() { return ((h / 9) | 0) % 2 ? M.AWN_R : M.TRIM; }
}
function flag(x, z) {
  begin('Flagpole', 'prop', false);
  box(x - 1, 0, z - 1, x + 1, 1, z + 1, M.STONE); box(x, 2, z, x, 40, z, M.TRIM); set(x, 41, z, M.BRASS);
  // a camp flag of our own: olive with a white bar and a gold disc
  for (let a = 1; a <= 11; a++) for (let y = 33; y <= 39; y++) set(x + a, y, z, y === 36 ? M.TRIM : (a - 6) * (a - 6) + (y - 36) * (y - 36) <= 3 ? M.SIGN : M.AWN_G);
}

// ---- the motor pool and the fuel farm ----------------------------------------------------------------------------------
// a chain-link fence round a rectangle, posts every six, with openings; it goes down at any speed (a prop)
function chainFence(x0, z0, x1, z1, gaps) {
  const open = (x, z) => gaps.some(([a, b, c, d]) => x >= a && x <= c && z >= b && z <= d);
  for (const side of [0, 1, 2, 3]) {
    begin('Wire fence', 'prop', false);
    const n = side < 2 ? x1 - x0 : z1 - z0;
    for (let t = 0; t <= n; t++) {
      const x = side === 0 ? x0 + t : side === 1 ? x0 + t : side === 2 ? x0 : x1, z = side === 0 ? z0 : side === 1 ? z1 : z0 + t;
      if (open(x, z)) continue;
      if (t % 6 === 0) box(x, 0, z, x, 8, z, M.DARK);
      else for (let y = 0; y <= 7; y++) if ((t + y) & 1 || y === 7) set(x, y, z, M.METAL);
    }
  }
}
// a carport for the trucks: a flat roof on posts, high enough to drive under
function canopy(x0, z0, x1, z1) {
  begin('Vehicle shed', 'shed', true);
  for (let z = z0; z <= z1; z += 20) for (const x of [x0, x1]) box(x, 0, Math.min(z, z1 - 1), x + 1, 16, Math.min(z, z1 - 1) + 1, M.STEEL);
  for (let x = x0; x <= x1 + 1; x++) for (let z = z0; z <= z1; z++) set(x, 17, z, (z & 3) ? OLIVE : OLIVE_D);
  box(x0, 16, z0, x0 + 1, 16, z1, M.STEEL); box(x1, 16, z0, x1 + 1, 16, z1, M.STEEL);
}
// a fuel tank: a ringed drum with a red fuel band, a domed cap and a ladder (biting the band sets it off)
function fuelTank(cx, cz, r, h) {
  const b = begin('Fuel tank', 'fuel'); b.explosive = 12;
  disc(cx, cz, 0, r + 1, M.CONC);
  for (let y = 1; y <= h; y++) disc(cx, cz, y, r, y === h - 3 || y === h - 4 ? M.FUEL : y % 5 === 0 ? OLIVE_D : OLIVE, r - 1);
  disc(cx, cz, h + 1, r, M.TRIM); disc(cx, cz, h + 2, r - 2, OLIVE); disc(cx, cz, h + 3, r - 4, OLIVE);
  set(cx, h + 4, cz, M.LIT_R);
  for (let y = 1; y <= h + 1; y++) { set(cx - r - 1, y, cz - 1, M.DARK); set(cx - r - 1, y, cz + 1, M.DARK); if (y % 2 === 0) set(cx - r - 1, y, cz, M.DARK); }
}

// ---- military vehicles: the CC0 pack's tank, jeep and helicopter, scaled and painted ------------------------------------
// The pack models are one colour; paint(x, y, z) picks a material from where a cube sits in the model. The nose is the
// model's z = 0 end; `dir` is which way it points ('n' -z, 's' +z, 'w' -x, 'e' +x). Each is one body that blows up
// once enough of it is gone (a fuel voxel hidden in the middle goes up at once if a blow reaches it).
const MODELS = {};
function model(name) {
  if (MODELS[name]) return MODELS[name];
  const P = PACK[name], [X, Y, Z] = P.size, g = new Uint8Array(X * Y * Z);
  for (let i = 0; i < P.cubes.length; i += 3) g[(P.cubes[i + 2] * Y + P.cubes[i + 1]) * X + P.cubes[i]] = 1;
  return (MODELS[name] = { X, Y, Z, at: (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < X && y < Y && z < Z && g[(z * Y + y) * X + x] });
}
function stamp(name, cx, cz, dir, s, paint, title, explosive) {
  const m = model(name), b = begin(title, 'vehicle', false); b.explosive = explosive;
  const nx = Math.round(m.X * s), ny = Math.round(m.Y * s), nz = Math.round(m.Z * s);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const mx = Math.floor((i + 0.5) / s), my = Math.floor((j + 0.5) / s), mz = Math.floor((k + 0.5) / s);
    if (!m.at(mx, my, mz)) continue;
    const u = i - nx / 2, v = k - nz / 2;
    const [dx, dz] = dir === 'n' ? [u, v] : dir === 's' ? [-u, -v] : dir === 'w' ? [v, -u] : [-v, u];
    set(Math.floor(cx + dx), j, Math.floor(cz + dz), paint(mx, my, mz, m));
  }
  set(Math.floor(cx), Math.max(1, Math.round(ny * 0.35)), Math.floor(cz), M.FUEL);
}
const tankPaint = (mx, my, mz) => (my <= 1 ? M.DARK : my === 2 ? M.METAL : mx >= 5 && mx <= 8 && my >= 7 && my <= 8 && mz < 14 ? M.STEEL : my >= 10 ? M.DARK : camo(mx, my, mz));
const jeepPaint = (mx, my, mz) => (my <= 3 && ((mz >= 4 && mz <= 12) || (mz >= 23 && mz <= 30)) ? M.TYRE : my >= 10 && mz >= 17 && mz <= 23 ? M.STEEL : my >= 11 ? (mz < 4 ? M.DARK : BAG_D) : my === 10 && mz < 13 ? M.GLASS : camo(mx, my, mz));
const heliPaint = (a, b) => (mx, my, mz) => (my >= 8 || my <= 1 ? M.DARK : mz >= 24 && my >= 3 && my <= 5 ? M.GLASS : mz <= 1 && my >= 3 ? M.DARK : (mz >> 1) % 5 === 0 ? b : a);
const wreckPaint = (mx, my, mz) => (hash(mx, my, mz, 9) < 0.5 ? M.CHAR : my <= 2 ? M.DARK : M.METAL);
// an army truck: a cab and a bed under a canvas tilt, or a fuel tank on the back (that one blows up)
function truck(cx, cz, dir, fuel = false) {
  const b = begin(fuel ? 'Fuel truck' : 'Army truck', 'vehicle', false); b.explosive = fuel ? 11 : 7;
  const L = 32, Wd = 12, pt = (u, y, v, m) => { const [dx, dz] = dir === 'n' ? [u, v] : dir === 's' ? [-u, -v] : dir === 'w' ? [v, -u] : [-v, u]; set(Math.floor(cx + dx), y, Math.floor(cz + dz), m); };
  for (let v = -L / 2; v < L / 2; v++) for (let u = -Wd / 2; u < Wd / 2; u++) {
    const f = v + L / 2, side = Math.abs(u + 0.5) > Wd / 2 - 2;
    const wheel = side && [4, 5, 6, 7, 19, 20, 21, 22, 25, 26, 27, 28].includes(f);
    for (let y = 0; y <= 3; y++) if (wheel) pt(u, y, v, y === 0 || y === 3 ? M.TYRE : M.DARK);
    if (!wheel) pt(u, 2, v, M.DARK);
    pt(u, 3, v, OLIVE_D);
    if (f < 9) {   // the cab, nose first
      for (let y = 4; y <= 11; y++) pt(u, y, v, y >= 8 && y <= 10 && (f === 0 || side) && f < 7 ? M.GLASS : f === 0 && y <= 6 ? (Math.abs(u + 0.5) < 3 ? M.DARK : M.LIT_W) : y === 11 ? OLIVE_D : OLIVE);
    } else if (fuel) {
      const d = Math.hypot(u + 0.5, 0), cyl = (y) => Math.hypot(u + 0.5, y - 8.5) <= 5;
      for (let y = 4; y <= 13; y++) if (cyl(y)) pt(u, y, v, f === 18 || f === 19 ? M.FUEL : (f & 3) === 0 ? OLIVE_D : OLIVE);
      void d;
    } else {
      pt(u, 4, v, OLIVE); if (side) pt(u, 5, v, OLIVE);
      const r = Math.abs(u + 0.5), top = 13 - Math.max(0, r - 3) * 0.8;
      if (f > 10) for (let y = 6; y <= 13; y++) if (y <= top && (y >= top - 1 || side || f === L - 1)) pt(u, y, v, (f & 3) === 0 ? BAG_D : BAG);
    }
  }
}

// ---- the water tower over the barracks: legs wide enough apart to drive between, braced above a car's roof ----------
function waterTower(cx, cz) {
  begin('Water tower', 'tower', true);
  const tb = 30, r = 10;
  for (const sx of [-10, 8]) for (const sz of [-10, 8]) box(cx + sx, 0, cz + sz, cx + sx + 1, tb, cz + sz + 1, M.STEEL);
  for (const y of [17, tb]) walls(cx - 10, y, cz - 10, cx + 9, y, cz + 9, M.STEEL);
  for (let k = 0; k < 12; k++) for (const e of [-10, 9]) { set(cx - 8 + k, 18 + k, cz + e, M.STEEL); set(cx + e, 18 + k, cz - 8 + k, M.STEEL); }
  disc(cx, cz, tb + 1, r, OLIVE_D);
  for (let y = tb + 2; y <= tb + 14; y++) disc(cx, cz, y, r, y === tb + 7 || y === tb + 8 ? M.TRIM : OLIVE, r - 1);
  [9, 7, 5, 3, 1].forEach((rr, i) => disc(cx, cz, tb + 15 + i, rr, OLIVE_D));
  set(cx, tb + 20, cz, M.LIT_R);
}

// ---- the build ------------------------------------------------------------------------------------------------------
function build() {
  materials(); setSeed(4242); place(0, 0, -1); ctx.lot = -1; ctx.L = 3;
  // the wall, broken by the four gates, with a guard tower in each corner
  wallRun(W0, N0, GX - GATE - 1, N1); wallRun(GX + GATE, N0, E1, N1);
  wallRun(W0, S0, GX - GATE - 1, S1); wallRun(GX + GATE, S0, E1, S1);
  wallRun(W0, N1 + 1, W1, GZ - GATE - 1); wallRun(W0, GZ + GATE, W1, S0 - 1);
  wallRun(E0, N1 + 1, E1, GZ - GATE - 1); wallRun(E0, GZ + GATE, E1, S0 - 1);
  for (const [cx, cz] of [[17, 17], [WX - 17, 17], [17, WZ - 17], [WX - 17, WZ - 17]]) tower(cx, cz);
  // the gates: pillars, a boom, towers either side of the north and south gates, a guard post at the east and west
  pillar(GX - GATE - 6, N0, GX - GATE - 1, N1 + 5); pillar(GX + GATE, N0, GX + GATE + 5, N1 + 5);
  pillar(GX - GATE - 6, S0 - 5, GX - GATE - 1, S1); pillar(GX + GATE, S0 - 5, GX + GATE + 5, S1);
  pillar(W0, GZ - GATE - 6, W1 + 5, GZ - GATE - 1); pillar(W0, GZ + GATE, W1 + 5, GZ + GATE + 5);
  pillar(E0 - 5, GZ - GATE - 6, E1, GZ - GATE - 1); pillar(E0 - 5, GZ + GATE, E1, GZ + GATE + 5);
  boom(GX - GATE - 2, N1 + 8, GX + 12, N1 + 8); boom(GX + GATE + 1, S0 - 8, GX - 10, S0 - 8);
  for (const x of [GX - GATE - 26, GX + GATE + 20]) { tower(x + 3, N1 + 10, M.STEEL); tower(x + 3, S0 - 10, M.STEEL); }
  booth(W1 + 8, GZ - GATE - 18); booth(E0 - 17, GZ + GATE + 9);
  // the main gate's sign, high enough to drive under
  begin('Gate sign', 'sign', true);
  for (const x of [GX - GATE - 4, GX + GATE + 3]) box(x, 15, S0 - 3, x + 1, 26, S0 - 2, M.STEEL);
  box(GX - GATE - 4, 20, S0 - 3, GX + GATE + 4, 26, S0 - 3, OLIVE_D);
  const sign = face('f', GX - GATE - 4, S0 - 3, GX + GATE + 4, S0 - 3), name = 'CAMP DEADFALL';
  text(sign, name, ((sign.W - textW(name)) >> 1), 21, 1, M.LIT_Y);
  // the sandbag chicane inside the main gate, and wire along the inside of the wall here and there
  sandbags(GX - GATE + 2, S0 - 28, GX + 2, S0 - 28, 4); sandbags(GX - 2, S0 - 44, GX + GATE - 2, S0 - 44, 4);
  sandbags(GX - 2, N1 + 26, GX + GATE - 2, N1 + 26, 4);
  for (const [a, b, c, d] of [[60, 12, 150, 12], [362, 12, 450, 12], [60, WZ - 13, 150, WZ - 13], [362, WZ - 13, 450, WZ - 13], [12, 60, 12, 150], [WX - 13, 270, WX - 13, 360]]) concertina(a, b, c, d);

  // north-west: the hangar on its apron
  hangar(HANGAR);
  flood(HANGAR.x0 - 6, HANGAR.z1 + 6, 1, 1); flood(HANGAR.x1 + 6, HANGAR.z1 + 6, -1, 1);
  crates(HANGAR.x1 + 14, HANGAR.z0 + 10, 5); drums(HANGAR.x1 + 16, HANGAR.z0 + 40, 7); nest(HANGAR.x1 + 28, HANGAR.z1 - 10, 'e');
  truck(HANGAR.x0 - 14, HANGAR.z0 + 40, 'n', true);

  // north-east: headquarters, the parade square and its flag, the radio mast and the helipad
  headquarters(HQ); flag((HQ.x0 + HQ.x1) >> 1, HQ.z1 + 24); mast(HQ.x1 + 16, HQ.z0 + 6);
  stamp('heli', PAD.x, PAD.z, 'w', 2, heliPaint(M.STEEL, M.DARK), 'Helicopter', 10);
  begin('Windsock', 'prop', false); box(PAD.x + 30, 0, PAD.z - 22, PAD.x + 30, 14, PAD.z - 22, M.DARK); for (let t = 1; t <= 6; t++) box(PAD.x + 30 + t, 13 - (t >> 2), PAD.z - 22, PAD.x + 30 + t, 14 - (t >> 2), PAD.z - 22, (t >> 1) & 1 ? M.TRIM : M.SIGN);
  nest(HQ.x0 - 4, HQ.z1 + 40, 's'); ammo(HQ.x1 + 8, HQ.z1 + 10); crates(HQ.x0 + 4, HQ.z0 - 16, 3);
  for (const x of [HQ.x0 + 6, HQ.x1 - 6]) flood(x, HQ.z1 + 50, 0, -1);

  // south-west: the barracks huts, the water tower, the stores
  for (const [a, b, cz] of HUTS) quonset(a, b, cz);
  waterTower(98, 362); crates(150, 352, 6); crates(196, 356, 4); drums(60, 300, 4); ammo(214, 296);
  sandbags(48, 246, 120, 246, 3); nest(186, 300, 'n');

  // south-east: the motor pool behind its fence, the truck shed, and the fuel farm
  chainFence(POOL.x0, POOL.z0, POOL.x1, POOL.z1, [[330, POOL.z0, 370, POOL.z0], [POOL.x0, 290, POOL.x0, 330], [330, POOL.z1, 370, POOL.z1], [POOL.x1, 280, POOL.x1, 300]]);
  canopy(380, 262, 404, 354);
  truck(392, 280, 'w'); truck(392, 316, 'w'); truck(392, 344, 'w', true);
  for (const [i, x] of [302, 326, 350].entries()) stamp('tank', x, 280 + (i & 1) * 4, 'n', 1.25, tankPaint, 'Tank', 9);
  for (const x of [302, 318, 334, 350]) stamp('jeep', x, 340, 's', 0.7, jeepPaint, 'Jeep', 7);
  for (const [x, z] of TANKS) fuelTank(x, z, 9, 18);
  drums(428, 254, 7); drums(430, 356, 5); ammo(296, 372);
  begin('Pump house', 'shop', true); walls(424, 0, 286, 432, 8, 296, M.CONC); box(423, 9, 285, 433, 9, 297, M.ROOF_D); face('l', 424, 286, 432, 296).box(3, 0, 6, 6, 0, 0, M.DOOR_G);

  // the killing field: the runway and the crossing, with some cover, lights and a burnt-out jeep or two
  for (const x of [120, 392]) { blocks(x, RUN[0] + 14, true); blocks(x + 6, RUN[1] - 17, true); }
  blocks(ROAD[0] + 4, 140, false); blocks(ROAD[1] - 7, 260, false);
  nest(ROAD[0] - 16, RUN[0] - 14, 's'); nest(ROAD[1] + 16, RUN[1] + 14, 'n');
  for (const x of [60, 160, 352, 452]) { flood(x, RUN[0] - 4, 0, 1); flood(x, RUN[1] + 4, 0, -1); }
  stamp('jeep', 200, 200, 'e', 0.7, wreckPaint, 'Burnt-out jeep', 0);
  stamp('jeep', 318, 222, 'n', 0.7, wreckPaint, 'Burnt-out jeep', 0);
  stamp('tank', 420, 160, 'w', 1.25, wreckPaint, 'Burnt-out tank', 0);
  finish();
}

// ---- the painted ground -----------------------------------------------------------------------------------------------
function ground() {
  const c = canvasFor('#a39874', 4242), { g, rect, speckle } = c;
  speckle(0, 0, WX, WZ, 70000, ['rgba(120,104,72,0.35)', 'rgba(150,160,96,0.35)', 'rgba(190,178,140,0.3)', 'rgba(96,110,62,0.3)']);
  // patches of dry grass
  for (let i = 0; i < 26; i++) { const x = c.r() * WX, z = c.r() * WZ, w = 20 + c.r() * 50, d = 14 + c.r() * 34; g.fillStyle = 'rgba(122,138,78,0.35)'; rect(x, z, x + w, z + d); speckle(x, z, x + w, z + d, 600, ['rgba(96,120,58,0.45)', 'rgba(160,170,100,0.35)']); }
  // the ring road inside the wall: packed dirt with ruts
  g.fillStyle = '#8f7e5d';
  rect(W1, N1, WX - 7, RING); rect(W1, WZ - RING, WX - 7, S0); rect(W1, N1, RING, S0); rect(WX - RING, N1, E0, S0);
  speckle(W1, N1, WX - 7, S0, 30000, ['rgba(70,58,40,0.3)', 'rgba(170,150,110,0.3)']);
  g.fillStyle = 'rgba(62,52,36,0.35)';
  for (const o of [16, 28]) { rect(o, o, WX - o, o + 1.2); rect(o, WZ - o - 1.2, WX - o, WZ - o); rect(o, o, o + 1.2, WZ - o); rect(WX - o - 1.2, o, WX - o, WZ - o); }
  // aprons: concrete slabs in front of the hangar, round headquarters and in the motor pool, with joints and oil
  const slabs = (x0, z0, x1, z1, col, joint = 'rgba(60,58,52,0.35)') => {
    g.fillStyle = col; rect(x0, z0, x1, z1); speckle(x0, z0, x1, z1, Math.round((x1 - x0) * (z1 - z0) / 4), ['rgba(255,250,235,0.18)', 'rgba(60,56,50,0.16)']);
    g.fillStyle = joint; for (let x = x0; x < x1; x += 16) rect(x, z0, x + 0.25, z1); for (let z = z0; z < z1; z += 16) rect(x0, z, x1, z + 0.25);
  };
  slabs(HANGAR.x0 - 8, HANGAR.z0 - 4, HANGAR.x1 + 8, RUN[0], '#aaa69b');
  slabs(HQ.x0 - 12, HQ.z0 - 8, HQ.x1 + 12, HQ.z1 + 52, '#b8b2a3');
  slabs(POOL.x0, POOL.z0, POOL.x1, POOL.z1, '#8f8c84');
  slabs(TANKS[0][0] - 16, POOL.z0, WX - RING, POOL.z1, '#9b978e');
  for (let i = 0; i < 40; i++) { const x = POOL.x0 + c.r() * (POOL.x1 - POOL.x0), z = POOL.z0 + c.r() * (POOL.z1 - POOL.z0), r = 2 + c.r() * 5; g.fillStyle = 'rgba(30,28,26,0.3)'; g.beginPath(); g.ellipse(x * c.GK, z * c.GK, r * c.GK, r * 0.7 * c.GK, c.r() * 3, 0, 6.3); g.fill(); }
  // the parade square: white lines where the companies form up
  g.fillStyle = 'rgba(240,236,224,0.6)';
  for (let k = 0; k < 4; k++) rect(HQ.x0 + 6 + k * 18, HQ.z1 + 30, HQ.x0 + 18 + k * 18, HQ.z1 + 30.6);
  rect(HQ.x0 - 8, HQ.z1 + 4, HQ.x1 + 8, HQ.z1 + 4.6); rect(HQ.x0 - 8, HQ.z1 + 46, HQ.x1 + 8, HQ.z1 + 46.6);
  // gravel round the barracks, and paths to the doors
  g.fillStyle = '#ab9f84'; rect(44, 246, 232, 372); speckle(44, 246, 232, 372, 9000, ['rgba(90,80,60,0.3)', 'rgba(220,210,190,0.3)']);
  // the main road, north to south
  g.fillStyle = '#56585c'; rect(ROAD[0], N1, ROAD[1], S0);
  speckle(ROAD[0], N1, ROAD[1], S0, 14000, ['rgba(30,32,38,0.25)', 'rgba(120,124,130,0.18)']);
  g.fillStyle = 'rgba(232,206,112,0.75)'; for (let z = 10; z < WZ - 10; z += 12) if (z + 6 < RUN[0] - 6 || z > RUN[1] + 6) rect(GX - 0.4, z, GX + 0.4, z + 6);
  // the runway: darker tarmac, edge lines, the centre line, the threshold bars and the numbers at each end
  g.fillStyle = '#45484e'; rect(W1, RUN[0], E0, RUN[1]);
  speckle(W1, RUN[0], E0, RUN[1], 30000, ['rgba(26,28,32,0.3)', 'rgba(110,114,122,0.2)']);
  g.fillStyle = 'rgba(238,236,228,0.8)';
  rect(W1 + 20, RUN[0] + 2, E0 - 20, RUN[0] + 2.8); rect(W1 + 20, RUN[1] - 2.8, E0 - 20, RUN[1] - 2);
  for (let x = 90; x < WX - 90; x += 22) if (x + 12 < ROAD[0] - 4 || x > ROAD[1] + 4) rect(x, GZ - 0.6, x + 12, GZ + 0.6);
  for (const [x0, s] of [[24, 1], [WX - 24, -1]]) {
    for (let k = 0; k < 6; k++) { const z = RUN[0] + 6 + k * 4.6 + (k > 2 ? 10 : 0); rect(Math.min(x0, x0 + s * 22), z, Math.max(x0, x0 + s * 22), z + 2.6); }
    const n = s > 0 ? '09' : '27', pix = [];
    text({ p(u, y) { pix.push([u, y]); } }, n, 0, 0, 0, 0);
    for (const [u, y] of pix) { const px = s > 0 ? x0 + 34 + (4 - y) * 3 : x0 - 34 - (4 - y) * 3, pz = s > 0 ? GZ + 10 - u * 3 : GZ - 10 + u * 3; rect(Math.min(px, px + 3 * s), pz - 1.5, Math.max(px, px + 3 * s), pz + 1.5); }
  }
  // hold-short bars where the road crosses the runway
  g.fillStyle = 'rgba(232,206,112,0.8)';
  for (const z of [RUN[0] - 4, RUN[1] + 3]) { rect(ROAD[0] + 2, z, ROAD[1] - 2, z + 0.7); rect(ROAD[0] + 2, z + 1.4, ROAD[1] - 2, z + 2.1); }
  // the helipad: a concrete disc, a yellow ring and an H
  g.fillStyle = '#9d9b95'; g.beginPath(); g.arc(PAD.x * c.GK, PAD.z * c.GK, PAD.r * c.GK, 0, 6.3); g.fill();
  g.strokeStyle = 'rgba(232,196,70,0.9)'; g.lineWidth = 1.2 * c.GK; g.beginPath(); g.arc(PAD.x * c.GK, PAD.z * c.GK, (PAD.r - 3) * c.GK, 0, 6.3); g.stroke();
  g.fillStyle = 'rgba(240,238,230,0.85)'; rect(PAD.x - 9, PAD.z - 12, PAD.x - 5, PAD.z + 12); rect(PAD.x + 5, PAD.z - 12, PAD.x + 9, PAD.z + 12); rect(PAD.x - 5, PAD.z - 2, PAD.x + 5, PAD.z + 2);
  // hazard stripes round the fuel farm
  for (let z = POOL.z0; z < POOL.z1; z += 4) { g.fillStyle = (z / 4) & 1 ? 'rgba(230,190,50,0.8)' : 'rgba(40,40,40,0.8)'; rect(TANKS[0][0] - 16, z, TANKS[0][0] - 14, z + 4); }
  // the base has seen a fight: scorch marks and old stains
  for (let i = 0; i < 60; i++) {
    const x = 20 + c.r() * (WX - 40), z = 20 + c.r() * (WZ - 40), r = 2 + c.r() * 6, blood = i % 3 === 0;
    g.fillStyle = blood ? 'rgba(96,24,18,0.35)' : 'rgba(28,24,20,0.3)';
    g.beginPath(); g.ellipse(x * c.GK, z * c.GK, r * c.GK, r * (0.5 + c.r() * 0.5) * c.GK, c.r() * 3, 0, 6.3); g.fill();
  }
  return c.cv;
}

// ---- where the horde comes from (modes/survival.js) ---------------------------------------------------------------------
const GATES = [
  { out: { x: GX, z: -34 }, entry: { x: GX, z: 26 } }, { out: { x: GX, z: WZ + 34 }, entry: { x: GX, z: WZ - 26 } },
  { out: { x: -34, z: GZ }, entry: { x: 26, z: GZ } }, { out: { x: WX + 34, z: GZ }, entry: { x: WX - 26, z: GZ } },
];
// a place on top of the wall away from the gates and the corner towers, and the way in from it
function wallSpot() {
  const side = Math.floor(Math.random() * 4), along = side < 2 ? WX : WZ, mid = side < 2 ? GX : GZ;
  let t;
  do { t = 30 + Math.random() * (along - 60); } while (Math.abs(t - mid) < GATE + 14);
  return side === 0 ? { x: t, z: N1 + 1.5, in: { x: 0, z: 1 } } : side === 1 ? { x: t, z: S0 - 1.5, in: { x: 0, z: -1 } } : side === 2 ? { x: W1 + 1.5, z: t, in: { x: 1, z: 0 } } : { x: E0 - 1.5, z: t, in: { x: -1, z: 0 } };
}
// the horde breaks through: a hole blown in each side of the wall, each a new way in
function breach(G) {
  const holes = [[150, N0 + 2, 0, -1], [370, S1 - 2, 0, 1], [W0 + 2, 300, -1, 0], [E1 - 2, 110, 1, 0]], out = [];
  for (const [x, z, dx, dz] of holes) {
    G.explode(x, 4, z, 9, 0.5, { maxDebris: 160, fire: false });
    out.push({ out: { x: x + dx * 34, z: z + dz * 34 }, entry: { x: x - dx * 26, z: z - dz * 26 } });
  }
  return out;
}

export default {
  id: 'base', name: 'Camp Deadfall', mode: 'survival',
  blurb: 'An army base overrun by the dead, and more of them every minute. No fighting the other cars: outlast them all.',
  loading: ['Building the base', 'Raising the fences and the hangars'],
  outer: 0x8d8566,
  build, ground,
  spawn: STARTS[0], starts: STARTS, gates: GATES, wallSpot, breach,
  waypoint: (c, tx, tz, out) => nav.waypoint(c, tx, tz, out),
  spawnPoint: (player, taken) => pickSpot(SPOTS, player, taken),
  step: (dt) => nav.step(dt),
  // the runway and the main road, then whatever stands (from the route-finder's grid)
  radar(R, s, ox, oy, w, h) {
    R.fillStyle = 'rgba(255,255,255,0.13)';
    R.fillRect(ox + W1 * s, oy + RUN[0] * s, (E0 - W1) * s, (RUN[1] - RUN[0]) * s);
    R.fillRect(ox + ROAD[0] * s, oy + N1 * s, (ROAD[1] - ROAD[0]) * s, (S0 - N1) * s);
    radarGrid(R, s, ox, oy, w, h);
  },
  nav,
};
