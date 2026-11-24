// Camp Deadfall: an army base the dead have overrun, for the last-car-standing round (modes/survival.js).
// A square of concrete wall with a gate in each side. A runway runs east to west through the middle and the main road
// north to south, and they cross in the open: that is the killing field. Round them, a quarter each, one big thing to
// know it by and open ground round it: a helicopter parked on its apron, headquarters with the radio mast and the
// helipad, two quonset huts of barracks under a water tower, and three parked tanks beside the fuel farm. Guard
// towers stand at the corners. It is kept open on purpose, for driving through a horde of hundreds: no crates, wire,
// sandbags or parked trucks to snag on, and the big pieces far enough apart for a car to get round them. Everything can
// be knocked down; the fuel and the vehicles blow up. A ring road runs inside the wall, so there is always a way round.
// Nothing has a way in for a car (Will, 2026-11-24: the hangar's doors let cars in and the camera got shut inside it, so
// it is gone): headquarters and the huts are 'barrier' bodies, so cars bounce off them and only the guns break them.
//
// The horde comes in through the gates and over the wall (gates, wallSpot), and late in the round it blows holes in the
// wall (breach). The rivals find their way with the route-finder in common.js.
import * as THREE from 'three';
import { WX, WZ, M, K, MAT_R, MAT_G, MAT_B, SOFT, CARRY, TOUGH, KIND, SHAPE, FLAM, BURN, CHARP, begin, set, box, walls, ctx, place, rnd, setSeed } from '../../../src/world.js';
import { face, text, textW, disc } from '../../../src/kit.js';
import { armyFoot } from '../hazards.js';
import { canvasFor, finish, makeGridNav, pickSpot, gridRadar } from './common.js';

// the tanks and helicopters (Monster Mayhem's models, units/src/vehicles.js; run by hazards.js 'army'): a helicopter out
// on the north-west apron and one on the helipad, three tanks in a row on the motor pool's slab. They aren't voxels, so
// the route grid is told where they stand.
const ARMY = [
  { type: 'heli', x: 124, z: 104, yaw: 0 }, { type: 'heli', x: 438, z: 134, yaw: -Math.PI / 2 },
  { type: 'tank', x: 306, z: 304, yaw: Math.PI }, { type: 'tank', x: 340, z: 308, yaw: Math.PI }, { type: 'tank', x: 374, z: 304, yaw: Math.PI },
];
const nav = makeGridNav({ also: (x, z) => ARMY.some((u) => armyFoot(u, x, z, 1)) });
const radarGrid = gridRadar(nav);

// ---- the plan (town voxels; x east, z south) ------------------------------------------------------------------------
const W0 = 3, W1 = 6, E0 = WX - 7, E1 = WX - 4, N0 = 3, N1 = 6, S0 = WZ - 7, S1 = WZ - 4;   // the wall, four thick
const GATE = 22;                       // half the width of a gate
const GX = 256, GZ = 208;              // the gates' middles: north and south on x = GX, west and east on z = GZ
const RUN = [178, 238];                // the runway, z from and to
const ROAD = [236, 276];               // the main road, x from and to
const RING = 40;                       // the ring road: this far in from the wall's outside
const APRON = { x0: 64, x1: 184, z0: 58, z1: 146 };   // where the hangar stood: its slab, and the helicopter on it
const HQ = { x0: 300, x1: 380, z0: 60, z1: 100 };
const PAD = { x: 430, z: 134, r: 26 };
const POOL = { x0: 290, x1: 410, z0: 250, z1: 366 };
const HUTS = [[56, 128, 268], [150, 222, 268]];   // two quonset huts in a row
const WTOWER = [98, 352];
const TANKS = [[452, 272], [452, 306], [452, 340]];
const CORNERS = [[17, 17], [WX - 17, 17], [17, WZ - 17], [WX - 17, WZ - 17]];   // the guard towers
// what burns on the night of the storm (looks/storm.js): oil drums by the buildings, and two wrecked cars (on the
// north-west apron, and south of the barracks), all clear of the runway, the road and the places to line up
const DRUMS = [[196, 64], [48, 120], [286, 108], [46, 300], [118, 372], [470, 246]];
const WRECKS = [[60, 160, true], [200, 330, true]];
// the floodlight towers outside the wall (looks/storm.js): two a side, either side of its gate, 32 out in the cleared
// strip, each a bank of lamps 80 up aimed 200 in (and a little toward the middle), so the inside of the base is lit
// and the dead stand out. Not part of the world: nothing can reach them.
const FLOODS = [];
for (const f of [0.25, 0.75]) FLOODS.push({ x: WX * f, z: -32, nx: 0, nz: 1 }, { x: WX * f, z: WZ + 32, nx: 0, nz: -1 }, { x: -32, z: WZ * f, nx: 1, nz: 0 }, { x: WX + 32, z: WZ * f, nx: -1, nz: 0 });
for (const b of FLOODS) { b.y = 80; b.aim = [b.x + b.nx * 200 + (WX / 2 - b.x) * 0.15 * Math.abs(b.nz), b.z + b.nz * 200 + (WZ / 2 - b.z) * 0.15 * Math.abs(b.nx)]; }
// the gate pillars whose lamps are red beacons: one at each gate (the middle of the pillar's top)
const BEACONS = [[280, 7], [230, 408], [7, 182], [504, 232]];

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
// ---- the barracks: quonset huts, half a cylinder of ribbed metal on its side -----------------------------------------
function quonset(x0, x1, cz, r = 11) {
  const top = (dz) => Math.floor(Math.sqrt(Math.max(0, r * r - (dz + 0.5) * (dz + 0.5))));
  for (let xs = x0; xs <= x1; xs += 12) {
    begin('Barracks hut', 'barrier', true);
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
    begin('Hut end', 'barrier', true);
    for (let dz = -r + 1; dz < r - 1; dz++) for (let y = 0; y < top(dz); y++) {
      const door = Math.abs(dz + 0.5) < 2.5 && y < 7, win = Math.abs(Math.abs(dz + 0.5) - 6) < 1.6 && y >= 4 && y <= 6;
      set(x, y, cz + dz, door ? M.DOOR_G : win ? M.GLASS : y === 0 ? M.CONC : M.PL_W);
    }
    for (let dz = -3; dz <= 2; dz++) set(x + (x === x0 ? -1 : 1), 8, cz + dz, OLIVE_D);   // a little porch roof over the door
  }
}

// ---- headquarters, the radio mast and the flag ------------------------------------------------------------------------
function headquarters({ x0, x1, z0, z1 }) {
  begin('Headquarters', 'barrier', true);   // (cars bounce off: nothing to drive into)
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

// ---- the fuel farm --------------------------------------------------------------------------------------------------
// a fuel tank: a ringed drum with a red fuel band, a domed cap and a ladder (biting the band sets it off)
function fuelTank(cx, cz, r, h) {
  const b = begin('Fuel tank', 'fuel'); b.explosive = 12;
  disc(cx, cz, 0, r + 1, M.CONC);
  for (let y = 1; y <= h; y++) disc(cx, cz, y, r, y === h - 3 || y === h - 4 ? M.FUEL : y % 5 === 0 ? OLIVE_D : OLIVE, r - 1);
  disc(cx, cz, h + 1, r, M.TRIM); disc(cx, cz, h + 2, r - 2, OLIVE); disc(cx, cz, h + 3, r - 4, OLIVE);
  set(cx, h + 4, cz, M.LIT_R);
  for (let y = 1; y <= h + 1; y++) { set(cx - r - 1, y, cz - 1, M.DARK); set(cx - r - 1, y, cz + 1, M.DARK); if (y % 2 === 0) set(cx - r - 1, y, cz, M.DARK); }
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
  for (const [cx, cz] of CORNERS) tower(cx, cz);
  // the gates: pillars, and a boom across the north and south ones
  pillar(GX - GATE - 6, N0, GX - GATE - 1, N1 + 5); pillar(GX + GATE, N0, GX + GATE + 5, N1 + 5);
  pillar(GX - GATE - 6, S0 - 5, GX - GATE - 1, S1); pillar(GX + GATE, S0 - 5, GX + GATE + 5, S1);
  pillar(W0, GZ - GATE - 6, W1 + 5, GZ - GATE - 1); pillar(W0, GZ + GATE, W1 + 5, GZ + GATE + 5);
  pillar(E0 - 5, GZ - GATE - 6, E1, GZ - GATE - 1); pillar(E0 - 5, GZ + GATE, E1, GZ + GATE + 5);
  boom(GX - GATE - 2, N1 + 8, GX + 12, N1 + 8); boom(GX + GATE + 1, S0 - 8, GX - 10, S0 - 8);
  // the main gate's sign, high enough to drive under
  begin('Gate sign', 'sign', true);
  for (const x of [GX - GATE - 4, GX + GATE + 3]) box(x, 15, S0 - 3, x + 1, 26, S0 - 2, M.STEEL);
  box(GX - GATE - 4, 20, S0 - 3, GX + GATE + 4, 26, S0 - 3, OLIVE_D);
  const sign = face('f', GX - GATE - 4, S0 - 3, GX + GATE + 4, S0 - 3), name = 'CAMP DEADFALL';
  text(sign, name, ((sign.W - textW(name)) >> 1), 21, 1, M.LIT_Y);

  // north-west: the apron, open (a helicopter stands on it: ARMY)

  // north-east: headquarters, the parade square and its flag, the radio mast and the helipad
  headquarters(HQ); flag((HQ.x0 + HQ.x1) >> 1, HQ.z1 + 24); mast(HQ.x1 + 16, HQ.z0 + 6);
  begin('Windsock', 'prop', false); box(PAD.x + 30, 0, PAD.z - 22, PAD.x + 30, 14, PAD.z - 22, M.DARK); for (let t = 1; t <= 6; t++) box(PAD.x + 30 + t, 13 - (t >> 2), PAD.z - 22, PAD.x + 30 + t, 14 - (t >> 2), PAD.z - 22, (t >> 1) & 1 ? M.TRIM : M.SIGN);

  // south-west: the barracks huts and the water tower
  for (const [a, b, cz] of HUTS) quonset(a, b, cz);
  waterTower(WTOWER[0], WTOWER[1]);

  // south-east: the motor pool's slab (its tanks: ARMY) and the fuel farm
  for (const [x, z] of TANKS) fuelTank(x, z, 9, 18);

  // the night's fires and beacons
  for (const [x, z] of DRUMS) drum(x, z);
  for (const [x, z, alongX] of WRECKS) wreck(x, z, alongX);
  for (const [x, z] of BEACONS) set(x, 15, z, M.LIT_R);

  // the killing field, the runway and the crossing, is left open
  finish();
}
// An oil drum burning (the flames are the storm's, looks/storm.js): olive with dark hoops, its rim burnt black. Knocked
// over by anything that hits it.
function drum(x, z) {
  begin('Burning drum', 'prop', false);
  for (let y = 0; y <= 4; y++) disc(x, z, y, 2, y === 4 ? M.CHAR : y === 1 || y === 3 ? M.DARK : OLIVE_D);
}
// A car burnt out where it stopped: a blackened shell on its rims, the cab's roof caved in. Pushed aside by anything
// that hits it.
function wreck(x, z, alongX) {
  begin('Burnt-out wreck', 'prop', false);
  const b = (a0, y0, c0, a1, y1, c1, m) => (alongX ? box(x + a0, y0, z + c0, x + a1, y1, z + c1, m) : box(x + c0, y0, z + a0, x + c1, y1, z + a1, m));
  for (const a of [-5, 3]) for (const c of [-3, 2]) b(a, 0, c, a + 1, 1, c, M.TYRE);
  b(-7, 1, -3, 6, 3, 2, M.CHAR); b(-6, 2, -2, 5, 3, 1, M.DARK);
  b(-3, 4, -3, 2, 4, -3, M.CHAR); b(-3, 4, 2, 2, 4, 2, M.CHAR); b(-3, 4, -3, -3, 5, 2, M.CHAR); b(2, 4, -3, 2, 5, 2, M.CHAR);
  b(-2, 5, -2, 1, 5, 1, M.CHAR);
}

// ---- the painted ground -----------------------------------------------------------------------------------------------
// The open ground is dirt, and the floor's shader lays its fine grain, stones and the ruts over it (ground.js:
// MAP.groundDetail), so the paint there is soft blotches at a few sizes rather than a fleck a voxel. The slabs, the road,
// the runway and the helipad are hard (the paint's alpha is taken down to a half over them at the end): the shader gives
// them a finer grain of their own, so they are soft blotches too, with what years of trucks and weather leave: cracks,
// patches, oil, rubber. It has been raining: water stands in the low places, on the hard ground (alpha a quarter) and in
// the dirt (three quarters, as the arena's puddles), and the shader makes all of it shine under the lights.
function ground() {
  const c = canvasFor('#a39874', 4242), { g, rect, mottle } = c, GK = c.GK;
  // a crack: a line wandering from (x, z) at angle a for len voxels, now and then branching; `tar` sealed (wider, black)
  const crack = (x, z, a, len, tar, depth = 0) => {
    g.strokeStyle = tar ? 'rgba(14,14,16,0.32)' : 'rgba(40,38,34,0.36)'; g.lineWidth = (tar ? 0.3 : 0.13) * GK; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x * GK, z * GK);
    let da = 0;
    for (let t = 0; t < len; t += 0.7) {
      da = da * 0.75 + (c.r() - 0.5) * 0.3; a += da + (c.r() - 0.5) * 0.25; x += Math.cos(a) * 0.7; z += Math.sin(a) * 0.7; g.lineTo(x * GK, z * GK);
      if (depth < 1 && c.r() < 0.06) { g.stroke(); crack(x, z, a + (c.r() < 0.5 ? 1 : -1) * (0.6 + c.r()), len * 0.4, tar, depth + 1); g.beginPath(); g.moveTo(x * GK, z * GK); }
    }
    g.stroke();
  };
  const cracks = (x0, z0, x1, z1, n, tar) => { for (let i = 0; i < n; i++) crack(x0 + c.r() * (x1 - x0), z0 + c.r() * (z1 - z0), c.r() * 6.3, 4 + c.r() * 14, c.r() < tar); };
  const stain = (x, z, rx, rz, a, alpha) => { g.fillStyle = `rgba(14,13,12,${alpha.toFixed(3)})`; g.beginPath(); g.ellipse(x * GK, z * GK, rx * GK, rz * GK, a, 0, 6.3); g.fill(); };
  // standing water: a few ovals run together, painted darker (the shader adds the shine); kept for the alpha at the end
  const pools = { hard: [], dirt: [] };
  const blobPath = (blob, k = 1) => { g.beginPath(); for (const [ex, ez, rx, rz, an] of blob) { g.moveTo((ex + rx * k * Math.cos(an)) * GK, (ez + rx * k * Math.sin(an)) * GK); g.ellipse(ex * GK, ez * GK, rx * k * GK, rz * k * GK, an, 0, 6.3); } };
  const puddle = (x, z, r, hard) => {
    const blob = [];
    for (let k = 0, n = 2 + Math.floor(c.r() * 3); k < n; k++) blob.push([x + (c.r() - 0.5) * r * 1.4, z + (c.r() - 0.5) * r * 0.9, r * (0.45 + c.r() * 0.5), r * (0.3 + c.r() * 0.35), c.r() * 3]);
    if (!hard) { g.fillStyle = 'rgba(52,42,30,0.22)'; blobPath(blob, 1.4); g.fill(); }   // the damp round it
    g.fillStyle = hard ? 'rgba(20,22,26,0.3)' : 'rgba(50,46,40,0.5)'; blobPath(blob); g.fill();
    (hard ? pools.hard : pools.dirt).push(blob);
  };
  // (sandy browns, not greens: the dead are green, and should stand out on it)
  const SAND = [[120, 104, 72, 0.4], [176, 160, 120, 0.36], [190, 178, 140, 0.34], [108, 96, 70, 0.36]];
  for (const [cell, k] of [[24, 0.8], [7, 0.85], [2.5, 0.9], [1.25, 0.7]]) mottle(0, 0, WX, WZ, cell, SAND.map(([r, gg, b, a]) => [r, gg, b, a * k]));
  // a few patches of dead grass, gone straw-coloured
  for (let i = 0; i < 10; i++) { const x = c.r() * WX, z = c.r() * WZ, w = 20 + c.r() * 50, d = 14 + c.r() * 34; g.fillStyle = 'rgba(176,160,96,0.3)'; rect(x, z, x + w, z + d); mottle(x, z, x + w, z + d, 1.5, [[150, 132, 80, 0.45], [196, 180, 120, 0.4]]); }
  // the ring road inside the wall: packed dirt with ruts
  g.fillStyle = '#8f7e5d';
  rect(W1, N1, WX - 7, RING); rect(W1, WZ - RING, WX - 7, S0); rect(W1, N1, RING, S0); rect(WX - RING, N1, E0, S0);
  for (const cell of [6, 2]) mottle(W1, N1, E0, S0, cell, [[70, 58, 40, 0.4], [170, 150, 110, 0.36]]);
  g.fillStyle = 'rgba(62,52,36,0.35)';
  for (const o of [16, 28]) { rect(o, o, WX - o, o + 1.2); rect(o, WZ - o - 1.2, WX - o, WZ - o); rect(o, o, o + 1.2, WZ - o); rect(WX - o - 1.2, o, WX - o, WZ - o); }
  // aprons: concrete slabs on the north-west apron, round headquarters and in the motor pool, with joints and oil
  const slabs = (x0, z0, x1, z1, col, joint = 'rgba(60,58,52,0.35)') => {
    g.fillStyle = col; rect(x0, z0, x1, z1);
    // each slab poured on its own day: a shade lighter or darker than the next, and blotched within
    for (let x = x0; x < x1; x += 16) for (let z = z0; z < z1; z += 16) {
      const v = c.r(); g.fillStyle = v < 0.5 ? `rgba(255,250,235,${(v * 0.14).toFixed(3)})` : `rgba(40,38,34,${((v - 0.5) * 0.16).toFixed(3)})`; rect(x, z, Math.min(x1, x + 16), Math.min(z1, z + 16));
    }
    for (const [cell, k] of [[6, 1], [1.5, 0.8]]) mottle(x0, z0, x1, z1, cell, [[255, 250, 235, 0.16 * k], [60, 56, 50, 0.16 * k], [120, 112, 96, 0.1 * k]]);
    g.fillStyle = joint; for (let x = x0; x < x1; x += 16) rect(x, z0, x + 0.25, z1); for (let z = z0; z < z1; z += 16) rect(x0, z, x1, z + 0.25);
    cracks(x0, z0, x1, z1, Math.round((x1 - x0) * (z1 - z0) / 420), 0.2);
    for (let i = 0, n = Math.round((x1 - x0) * (z1 - z0) / 900); i < n; i++) { const r = 0.6 + c.r() * c.r() * 3.5; stain(x0 + c.r() * (x1 - x0), z0 + c.r() * (z1 - z0), r, r * (0.5 + c.r() * 0.4), c.r() * 3, 0.08 + c.r() * 0.2); }
    for (let i = 0, n = Math.round((x1 - x0) * (z1 - z0) / 2600); i < n; i++) puddle(x0 + 4 + c.r() * (x1 - x0 - 8), z0 + 4 + c.r() * (z1 - z0 - 8), 2 + c.r() * 3.5, true);
  };
  const SLABS = [[APRON.x0 - 8, APRON.z0 - 4, APRON.x1 + 8, RUN[0], '#aaa69b'], [HQ.x0 - 12, HQ.z0 - 8, HQ.x1 + 12, HQ.z1 + 52, '#b8b2a3'],
    [POOL.x0, POOL.z0, POOL.x1, POOL.z1, '#8f8c84'], [TANKS[0][0] - 16, POOL.z0, WX - RING, POOL.z1, '#9b978e']];
  for (const s of SLABS) slabs(...s);
  for (let i = 0; i < 16; i++) { const x = POOL.x0 + c.r() * (POOL.x1 - POOL.x0), z = POOL.z0 + c.r() * (POOL.z1 - POOL.z0), r = 2 + c.r() * 5; g.fillStyle = 'rgba(30,28,26,0.3)'; g.beginPath(); g.ellipse(x * c.GK, z * c.GK, r * c.GK, r * 0.7 * c.GK, c.r() * 3, 0, 6.3); g.fill(); }
  // the parade square: white lines where the companies form up
  g.fillStyle = 'rgba(240,236,224,0.6)';
  for (let k = 0; k < 4; k++) rect(HQ.x0 + 6 + k * 18, HQ.z1 + 30, HQ.x0 + 18 + k * 18, HQ.z1 + 30.6);
  rect(HQ.x0 - 8, HQ.z1 + 4, HQ.x1 + 8, HQ.z1 + 4.6); rect(HQ.x0 - 8, HQ.z1 + 46, HQ.x1 + 8, HQ.z1 + 46.6);
  // gravel round the barracks, and paths to the doors
  g.fillStyle = '#ab9f84'; rect(44, 250, 232, 290); mottle(44, 250, 232, 290, 1.25, [[90, 80, 60, 0.4], [220, 210, 190, 0.4]]);
  // the main road, north to south: blotched tarmac, patched and cracked, darker where the wheels run, puddles at its sides
  g.fillStyle = '#56585c'; rect(ROAD[0], N1, ROAD[1], S0);
  for (const [cell, k] of [[10, 1], [3, 0.9], [1.25, 0.7]]) mottle(ROAD[0], N1, ROAD[1], S0, cell, [[30, 32, 38, 0.18 * k], [120, 124, 130, 0.14 * k]]);
  g.fillStyle = 'rgba(20,20,24,0.1)'; for (const x of [GX - 13, GX - 7, GX + 7, GX + 13]) rect(x - 1.3, N1, x + 1.3, S0);
  for (let i = 0; i < 26; i++) {
    const x = ROAD[0] + 2 + c.r() * 30, z = N1 + c.r() * (S0 - N1), w = Math.min(ROAD[1] - 1 - x, 3 + c.r() * 9), d = 3 + c.r() * 14;
    g.fillStyle = c.r() < 0.5 ? 'rgba(38,40,45,0.65)' : 'rgba(110,112,116,0.22)'; rect(x, z, x + w, z + d);
    g.strokeStyle = 'rgba(16,16,18,0.35)'; g.lineWidth = 0.2 * GK; g.strokeRect(x * GK, z * GK, w * GK, d * GK);
  }
  cracks(ROAD[0] + 1, N1, ROAD[1] - 1, S0, 40, 0.7);
  for (let i = 0; i < 60; i++) { const r = 0.5 + c.r() * c.r() * 2.5; stain(GX + (c.r() < 0.5 ? -10 : 10) + (c.r() - 0.5) * 4, N1 + c.r() * (S0 - N1), r * 0.6, r, c.r() * 0.4 - 0.2 + Math.PI / 2, 0.08 + c.r() * 0.16); }
  for (let i = 0; i < 14; i++) puddle(c.r() < 0.5 ? ROAD[0] + 2.5 + c.r() * 3 : ROAD[1] - 2.5 - c.r() * 3, N1 + 10 + c.r() * (S0 - N1 - 20), 1.8 + c.r() * 3, true);
  g.fillStyle = 'rgba(232,206,112,0.75)'; for (let z = 10; z < WZ - 10; z += 12) if (z + 6 < RUN[0] - 6 || z > RUN[1] + 6) rect(GX - 0.4, z, GX + 0.4, z + 6);
  // the runway: darker tarmac, edge lines, the centre line, the threshold bars and the numbers at each end
  g.fillStyle = '#45484e'; rect(W1, RUN[0], E0, RUN[1]);
  for (const [cell, k] of [[16, 1], [4, 0.9], [1.25, 0.7]]) mottle(W1, RUN[0], E0, RUN[1], cell, [[26, 28, 32, 0.2 * k], [110, 114, 122, 0.14 * k]]);
  // where the wheels came down at each end, years of rubber smeared along the middle
  for (const [x0, s] of [[40, 1], [WX - 40, -1]]) for (let i = 0; i < 160; i++) {
    const t = c.r(), x = x0 + s * t * 120, len = 3 + c.r() * 9, a = 0.06 + 0.16 * (1 - t) * c.r();
    stain(x, GZ + (c.r() < 0.5 ? -1 : 1) * (2 + c.r() * 6), len, 0.35 + c.r() * 0.6, (c.r() - 0.5) * 0.06, a);
  }
  cracks(W1, RUN[0] + 1, E0, RUN[1] - 1, 55, 0.8);
  for (let i = 0; i < 30; i++) { const r = 0.6 + c.r() * c.r() * 3; stain(W1 + c.r() * (E0 - W1), RUN[0] + 4 + c.r() * (RUN[1] - RUN[0] - 8), r, r * (0.4 + c.r() * 0.5), c.r() * 3, 0.08 + c.r() * 0.16); }
  for (let i = 0; i < 22; i++) puddle(W1 + 10 + c.r() * (E0 - W1 - 20), c.r() < 0.5 ? RUN[0] + 3 + c.r() * 5 : RUN[1] - 3 - c.r() * 5, 2 + c.r() * 4, true);
  g.fillStyle = 'rgba(238,236,228,0.8)';
  rect(W1 + 20, RUN[0] + 2, E0 - 20, RUN[0] + 2.8); rect(W1 + 20, RUN[1] - 2.8, E0 - 20, RUN[1] - 2);
  for (let x = 90; x < WX - 90; x += 22) if (x + 12 < ROAD[0] - 4 || x > ROAD[1] + 4) rect(x, GZ - 0.6, x + 12, GZ + 0.6);
  for (const [x0, s] of [[24, 1], [WX - 24, -1]]) {
    for (let k = 0; k < 6; k++) { const z = RUN[0] + 6 + k * 4.6 + (k > 2 ? 10 : 0); rect(Math.min(x0, x0 + s * 22), z, Math.max(x0, x0 + s * 22), z + 2.6); }
    const n = s > 0 ? '09' : '27', pix = [];
    text({ p(u, y) { pix.push([u, y]); } }, n, 0, 0, 0, 0);
    // (the right way up for a pilot coming in over that end: they were upside down)
    for (const [u, y] of pix) { const px = s > 0 ? x0 + 34 + y * 3 : x0 - 34 - y * 3, pz = s > 0 ? GZ - 10 + u * 3 : GZ + 10 - u * 3; rect(Math.min(px, px + 3 * s), pz - 1.5, Math.max(px, px + 3 * s), pz + 1.5); }
  }
  // hold-short bars where the road crosses the runway
  g.fillStyle = 'rgba(232,206,112,0.8)';
  for (const z of [RUN[0] - 4, RUN[1] + 3]) { rect(ROAD[0] + 2, z, ROAD[1] - 2, z + 0.7); rect(ROAD[0] + 2, z + 1.4, ROAD[1] - 2, z + 2.1); }
  // the helipad: a concrete disc, a yellow ring and an H
  g.fillStyle = '#9d9b95'; g.beginPath(); g.arc(PAD.x * c.GK, PAD.z * c.GK, PAD.r * c.GK, 0, 6.3); g.fill();
  g.save(); g.clip(); for (const [cell, k] of [[6, 1], [1.5, 0.8]]) mottle(PAD.x - PAD.r, PAD.z - PAD.r, PAD.x + PAD.r, PAD.z + PAD.r, cell, [[255, 250, 235, 0.16 * k], [60, 56, 50, 0.16 * k]]);
  cracks(PAD.x - PAD.r, PAD.z - PAD.r, PAD.x + PAD.r, PAD.z + PAD.r, 8, 0.2); g.restore();
  g.strokeStyle = 'rgba(232,196,70,0.9)'; g.lineWidth = 1.2 * c.GK; g.beginPath(); g.arc(PAD.x * c.GK, PAD.z * c.GK, (PAD.r - 3) * c.GK, 0, 6.3); g.stroke();
  g.fillStyle = 'rgba(240,238,230,0.85)'; rect(PAD.x - 9, PAD.z - 12, PAD.x - 5, PAD.z + 12); rect(PAD.x + 5, PAD.z - 12, PAD.x + 9, PAD.z + 12); rect(PAD.x - 5, PAD.z - 2, PAD.x + 5, PAD.z + 2);
  // hazard stripes round the fuel farm
  for (let z = POOL.z0; z < POOL.z1; z += 4) { g.fillStyle = (z / 4) & 1 ? 'rgba(230,190,50,0.8)' : 'rgba(40,40,40,0.8)'; rect(TANKS[0][0] - 16, z, TANKS[0][0] - 14, z + 4); }
  // water in the ring road's ruts and the low places of the open ground
  for (let i = 0; i < 26; i++) {
    const side = i & 3, o = [16, 28][(i >> 2) & 1] + 0.6, t = 30 + c.r() * (WX - 60);
    const [x, z] = side === 0 ? [t, o] : side === 1 ? [t, WZ - o] : side === 2 ? [o, t * WZ / WX] : [WX - o, t * WZ / WX];
    puddle(x, z, 1.6 + c.r() * 2.4, false);
  }
  for (let i = 0; i < 30; i++) {
    const x = 50 + c.r() * (WX - 100), z = 50 + c.r() * (WZ - 100);
    if ((x > ROAD[0] - 6 && x < ROAD[1] + 6) || (z > RUN[0] - 6 && z < RUN[1] + 6)) continue;
    puddle(x, z, 2 + c.r() * 5, false);
  }
  // the base has seen a fight: scorch marks and old stains
  for (let i = 0; i < 24; i++) {
    const x = 20 + c.r() * (WX - 40), z = 20 + c.r() * (WZ - 40), r = 2 + c.r() * 6, blood = i % 3 === 0;
    g.fillStyle = blood ? 'rgba(96,24,18,0.35)' : 'rgba(28,24,20,0.3)';
    g.beginPath(); g.ellipse(x * c.GK, z * c.GK, r * c.GK, r * (0.5 + c.r() * 0.5) * c.GK, c.r() * 3, 0, 6.3); g.fill();
  }
  // what the ground is, in the alpha: the concrete and the tarmac taken down to a half (no grain, no ruts, no dirt thrown)
  g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.5)';
  g.beginPath();
  for (const [x0, z0, x1, z1] of SLABS) g.rect(x0 * c.GK, z0 * c.GK, (x1 - x0) * c.GK, (z1 - z0) * c.GK);
  g.rect(ROAD[0] * c.GK, N1 * c.GK, (ROAD[1] - ROAD[0]) * c.GK, (S0 - N1) * c.GK);
  g.rect(W1 * c.GK, RUN[0] * c.GK, (E0 - W1) * c.GK, (RUN[1] - RUN[0]) * c.GK);
  g.moveTo((PAD.x + PAD.r) * c.GK, PAD.z * c.GK); g.arc(PAD.x * c.GK, PAD.z * c.GK, PAD.r * c.GK, 0, 6.3);
  g.fill('nonzero');
  // and the water: on the hard ground down to a quarter, in the dirt to three quarters
  g.fillStyle = 'rgba(0,0,0,0.5)'; for (const blob of pools.hard) { blobPath(blob); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,0.25)'; for (const blob of pools.dirt) { blobPath(blob); g.fill(); }
  g.restore();
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
  loading: ['Building the base', 'Raising the fences and the towers'],
  outer: 0x8d8566,
  // a stormy night (looks/storm.js): the guard towers' searchlights (the lamps), the fires (on the drums' and the
  // wrecks' tops: x, y, z, size) and the beacons, round the middle of the base
  look: {
    kind: 'storm', middle: [GX, GZ], towers: CORNERS.map(([x, z]) => [x + 0.5, 25.5, z + 0.5]),
    fires: [...DRUMS.map(([x, z]) => [x, 5, z, 1]), ...WRECKS.map(([x, z]) => [x + 0.5, 6, z + 0.5, 1.6])],
    beacons: BEACONS.map(([x, z]) => [x + 0.5, 15.5, z + 0.5]),
    banks: FLOODS, ring: { x: (W1 + 1 + E0) / 2, z: (N1 + 1 + S0) / 2, hx: (E0 - W1 - 1) / 2, hz: (S0 - N1 - 1) / 2, r: 2 },
  },
  // The country past the wall (../backdrops/wilds.js): forest and hills, the road out with what was left on it, a radio
  // mast, a farm burning to the east and the town the road goes to burning on the horizon. x east, z south, in voxels.
  backdrop: {
    kind: 'wilds', seed: 5151,
    world: [0, 0, WX, WZ],
    view: { x: WX / 2, z: WZ / 2 },
    sand: 0xa39874,                           // the base's own ground, for the cleared strip outside the wall
    clear: 100,                               // that strip: open ground, no trees or wrecks (the horde comes in over it)
    far: 1950,                                // no pines further than this from the middle of the base
    hills: { flat: 170, base: 30, amp: 260 }, // flat this far out, then rising to hills this high
    // the road south out of the gate, down its valley to the town, and the dirt tracks out of the other three gates
    road: [[GX, WZ - 2], [GX, 560], [236, 760], [150, 1000], [60, 1280], [-40, 1560], [-110, 1790]], roadW: 40,
    tracks: [[[GX, 2], [GX, -160], [300, -420], [420, -760]], [[2, GZ], [-180, 214], [-460, 160]], [[WX - 2, GZ], [700, 236], [980, 380]]],
    wrecks: { from: 110, to: 980, checkpoint: 150 },   // the cars left on the road from and to (along it), and the army's checkpoint
    town: { x: -150, z: 1950, r: 250 },
    farm: { x: 1000, z: 420 },
    mast: { x: -560, z: -480, h: 120 },
    pines: { count: 4200, mobile: 2400 },
    smoke: 7,                                 // columns of smoke over the town
    wind: [0.22, -0.06],                      // which way the smoke leans, a share of its height
  },
  build, ground,
  hazards: [{ kind: 'army', units: ARMY }],
  // the open ground's grain, ruts and thrown dirt, the hard ground's grain and rubber, and all of it wet from the storm
  // (ground.js, dirt.js)
  groundDetail: { soft: 'dirt', hard: true, wet: 0.6 },
  rutBox: [W1, N1, E0, S0],      // (inside the wall)
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
