// Meltdown Steelworks: the second arena, a free-for-all on the floor of a steel mill at night, with giant robots at
// work round it.
//
// (Will, 2026-11-25, after the oil rig played "cramped" and "more frustrating than it is fun": "Let's do steelworks,
// can we have giant robots (maybe some of the ones from monster destruction) being built or working some of the
// machines? Let's remix the monster truck arena floor in terms of the layout and plan. I like the swinging gantry. But
// let's have space and interesting traps, not more traps than space".)
//
// So: Hammerdown's ring, the same size, and its plan turned about, with four traps where Hammerdown has six and most of
// the floor open. Nothing here kills at a touch and there is nowhere to fall.
//
//   the floor    The runner for the molten steel crosses the middle from the north wall to the south. Over it, in the
//                middle of the floor, the jump: a steel kicker either side, the strike hanging in the gap, a boost strip
//                on each run at it (the runs are clear from wall to kicker, as Hammerdown's mountain's are). North-west,
//                the ingot lane: eight cast slabs side by side to drive over. South-west, the rolling line, which
//                carries a car along into the coil jump (a kicker, four rows of coils, a kicker). South-east, the
//                cooling bed's rollers. The north-east is open floor under the crane.
//   the traps    the pour     the furnace robot at the north wall tips his crucible and the runner fills with steel
//                             from end to end for a few seconds: it burns what stands in it. Two plate bridges cross
//                             it, and the jump.
//                the ladle    hangs from the travelling crane over the north-east and swings across under it as the
//                             crane runs up and down the hall: it bats a car across the floor.
//                the smith    the robot at the west wall brings his hammer down on the forge plate.
//                the line     the rolling line: no harm in it, it carries a car where it is going.
//   the robots   Monster Mayhem's robot, three of him (steelbots.js): Steeljaw pours, Jackhammer the builder is the
//                smith, and a third stands in a cradle at the east wall with an arm still on the hoist, being welded.
//   the hall     walls and a roof (it is indoors: no sky), columns, the crane's rails, furnaces behind the north wall,
//                lamps under the trusses. All of it is outside the ring's barrier and nothing of it is solid: the
//                barrier is the edge, as Hammerdown's is.
import { WX, WZ, M, set, begin, ctx } from '../../../src/world.js';
import { makeGridNav, canvasFor, finish, pickSpot, gridRadar, lineClear, GK } from './common.js';
import { PICKUPS } from '../pickups.js';
import { makeDirt } from '../arenadirt.js';
import { makeStalls } from '../fairstalls.js';
import { wreckage } from '../arenakit.js';
import { makeArenaMoves } from '../arenamoves.js';
import '../steelkit.js';
import { makeLadle, makePour, makeSmith, makeWorks } from '../steeltraps.js';

const TAU = Math.PI * 2, E = Math.PI / 2;
const CX = 512, CZ = 512;
// the ring's inside edge (x 176..848, z 292..732): Hammerdown's
const WALL = { hx: 336, hz: 220, r: 100 };
const IN = WALL.hx - WALL.r, IZ = WALL.hz - WALL.r;
function edge(x, z, S) {
  const qx = Math.abs(x - CX) - (S.hx - S.r), qz = Math.abs(z - CZ) - (S.hz - S.r);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - S.r;
}
let seed = 1234567;
const rand = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 8) & 0xffff) / 65536; };
// the hall round it: the walls' inside faces, the eaves and the ridge, a column every bay, the crane's rails
const HALL = { x0: 112, x1: 912, z0: 232, z1: 792, eave: 140, ridge: 188, bay: 40, rail: 76 };

// ---- the floor's measures ------------------------------------------------------------------------------------------------
const CH = { x0: 507, x1: 517, z0: 297, z1: 727 };                                   // the runner
const BRIDGES = [[386, 414], [618, 646]];                                             // the plates across it (z)
const JUMP = { z0: 484, z1: 540, x0: 498, x1: 526, lip: 9, run: 34 };                 // the kickers' lips either side of it
const LANE = { z: 400, x0: 300, x1: 416, half: 11, n: 8 };                            // the ingot lane
const LINE = { kind: 'conveyor', x0: 236, z0: 619, x1: 380, z1: 645, yaw: E, speed: 22 };   // the rolling line, running east
const COIL = { z: 632, half: 14, x0: 414, x1: 454, lip: 9.5, roof: 7, run: 32 };      // the coil jump it runs into
const ROLL = { x0: 610, x1: 730, z0: 600, z1: 632 };                                  // the cooling bed
const slabRoofs = (n) => (u, v) => { const a = (u * n) % 1; return a < 0.07 || a > 0.93 ? -1.6 : 0; };
const coilRoofs = (u) => { const a = (u * 4) % 1 - 0.5; return -10 * a * a; };
// ---- the traps ---------------------------------------------------------------------------------------------------------
// the crane's bridge runs from x0 to x1; the ladle hangs `len` under the trolley over z and swings across (along z)
const LADLE = { x0: 580, x1: 790, z: 410, y: HALL.rail, rail: HALL.rail, len: HALL.rail - 2.6, r: 9, speed: 8, hall: HALL, wild: 'ladle', phase: 1.1 };
const LADLE_REACH = 38;   // (how far either side of the trolley it swings when it is loose)
const POUR = { ...CH, bridges: BRIDGES, wild: 'pour', first: 12, skip: (z) => z > JUMP.z0 - 6 && z < JUMP.z1 + 6 };
// the forge plate: where the smith's hammer comes down (the test steel-bots.js checks it against the robot's arm)
const FORGE = { x: 233, z: 512, r: 13, reach: 30, wild: 'hammer', out: [1, 0], first: 7 };
FORGE.lamps = [0, 1, 2, 3, 4, 5].map((k) => { const a = -1.05 + k * 0.42; return [FORGE.x + Math.cos(a) * 19, FORGE.z + Math.sin(a) * 19]; });
const WORKS = { hall: HALL, scale: 1.5, furnaces: [[396, 258], [628, 258]], pourer: { x: 512, z: 252 }, smith: { x: 142, z: 476, shaft: 40 }, built: { x: 876, z: 512, skin: 'toy' } };

// ---- pickups -------------------------------------------------------------------------------------------------------------
// The strike hangs over the runner between the kickers' lips: only a car in the air takes it. A nitro hangs over the
// coils the same way. Repair kits where it is risky: on the forge plate, under the crane, at the runner's foot.
const SUPER = { kind: 'super', x: (JUMP.x0 + JUMP.x1) / 2, z: CZ, air: JUMP.lip + 0.5, rivals: false };
const PICKUP_SPOTS = [
  SUPER, { kind: 'repair', x: FORGE.x, z: FORGE.z }, { kind: 'repair', x: 686, z: LADLE.z }, { kind: 'repair', x: 560, z: 700 }, { kind: 'repair', x: 452, z: 322 },
  { kind: 'nitro', x: (LANE.x0 + LANE.x1) / 2, z: LANE.z }, { kind: 'nitro', x: (COIL.x0 + COIL.x1) / 2, z: COIL.z, air: COIL.lip - COIL.roof, rivals: false }, { kind: 'nitro', x: 812, z: 512 },
  { kind: 'ammo', x: (ROLL.x0 + ROLL.x1) / 2, z: (ROLL.z0 + ROLL.z1) / 2 }, { kind: 'ammo', x: 236, z: 352 }, { kind: 'ammo', x: 790, z: 676 }, { kind: 'ammo', x: 786, z: 344 }, { kind: 'ammo', x: 250, z: 690 },
  { kind: 'scrap', x: 512, z: 348, rivals: false }, { kind: 'scrap', x: 512, z: 676, rivals: false },   // (bait in the runner, for you alone)
];
const BARRELS = { kind: 'barrels', spots: [{ x: 760, z: 650 }, { x: 766, z: 655 }, { x: 758, z: 658 }, { x: 264, z: 366 }, { x: 270, z: 361 }, { x: 262, z: 358 }] };
// boost strips: one on each run at the jump (ending fifty short of its lip), one into the rollers from the east
const BOOSTS = [
  { kind: 'boost', x0: 372, z0: 505, x1: 442, z1: 519, yaw: E, to: [JUMP.x0 - JUMP.run - 3, JUMP.z0, JUMP.x0 - JUMP.run - 3, JUMP.z1] },
  { kind: 'boost', x0: 582, z0: 505, x1: 652, z1: 519, yaw: -E, to: [JUMP.x1 + JUMP.run + 3, JUMP.z0, JUMP.x1 + JUMP.run + 3, JUMP.z1] },
  { kind: 'boost', x0: 744, z0: 609, x1: 804, z1: 623, yaw: -E },
];
const SHOW = { kind: 'show', first: 35, every: 45, time: 15, events: [
  { tag: 'pour', name: 'TAP THE FURNACE!', sub: 'The runner stays molten. A strike hangs over the jump' },
  { tag: 'ladle', name: 'LADLE LOOSE!', sub: 'The crane runs wild. A strike hangs over the jump' },
  { tag: 'hammer', name: 'DOUBLE TIME!', sub: 'The smith does not stop. A strike hangs over the jump' },
], onEvent: () => { if (!SUPER.up) SUPER.t = Math.min(SUPER.t ?? 1, 1); if (moves) moves.salute(); } };
// where cars come in, each facing the middle, clear of the traps
const SPOTS = [
  [250, 420], [470, 334], [600, 334], [700, 332], [812, 470], [780, 566], [760, 690], [640, 690], [570, 580], [452, 574],
  [300, 570], [330, 468], [640, 470], [420, 700], [300, 694], [250, 600],
].map(([x, z, yaw]) => ({ x, z, yaw: yaw ?? Math.atan2(CX - x, CZ - z) }));

// ---- the steel to drive on (../arenadirt.js) -----------------------------------------------------------------------------
const DIRT = makeDirt([
  { x0: JUMP.x0 - 3, x1: JUMP.x0, z0: JUMP.z0, z1: JUMP.z1, h: JUMP.lip, w: JUMP.run, e: 0 },
  { x0: JUMP.x1, x1: JUMP.x1 + 3, z0: JUMP.z0, z1: JUMP.z1, h: JUMP.lip, w: 0, e: JUMP.run },
  { x0: LANE.x0 - 3, x1: LANE.x0, z0: LANE.z - LANE.half, z1: LANE.z + LANE.half, h: 6.5, w: 24, e: 0 },
  { kind: 'deck', x0: LANE.x0, x1: LANE.x1, z0: LANE.z - LANE.half, z1: LANE.z + LANE.half, h: 5, roof: slabRoofs(LANE.n) },
  { x0: LANE.x1, x1: LANE.x1 + 3, z0: LANE.z - LANE.half, z1: LANE.z + LANE.half, h: 6.5, w: 0, e: 24 },
  { x0: COIL.x0 - 3, x1: COIL.x0, z0: COIL.z - COIL.half, z1: COIL.z + COIL.half, h: COIL.lip, w: COIL.run, e: 0 },
  { kind: 'deck', x0: COIL.x0, x1: COIL.x1, z0: COIL.z - COIL.half + 1, z1: COIL.z + COIL.half - 1, h: COIL.roof, roof: coilRoofs },
  { x0: COIL.x1, x1: COIL.x1 + 3, z0: COIL.z - COIL.half, z1: COIL.z + COIL.half, h: COIL.lip, w: 0, e: COIL.run },
  { kind: 'rollers', ...ROLL, h: 4.5, humps: 3, axis: 'x', w: 0, e: 0 },
]);
const thing = (kind, x, z, yaw = 0, more = {}) => ({ kind, x, z, yaw, name: '', neon: 'warm', ...more });
const THINGS = [
  ...Array.from({ length: LANE.n }, (_, i) => thing('slab', LANE.x0 + (i + 0.5) * (LANE.x1 - LANE.x0) / LANE.n, LANE.z, 0, { c: i, v: i % 3, hot: i % 3 === 1 })),
  ...[0, 1, 2, 3].map((i) => thing('coil', COIL.x0 + 5 + i * 10, COIL.z, 0, { c: i })),
  thing('lip', LANE.x0 + 0.1, LANE.z, E, { w: 2 * LANE.half, lift: 6.5 }), thing('lip', LANE.x1 - 0.1, LANE.z, -E, { w: 2 * LANE.half, lift: 6.5 }),
  thing('lip', COIL.x0 + 0.1, COIL.z, E, { w: 2 * COIL.half, lift: COIL.lip }), thing('lip', COIL.x1 - 0.1, COIL.z, -E, { w: 2 * COIL.half, lift: COIL.lip }),
  thing('lip', JUMP.x0 + 0.1, CZ, E, { w: JUMP.z1 - JUMP.z0, lift: JUMP.lip }), thing('lip', JUMP.x1 - 0.1, CZ, -E, { w: JUMP.z1 - JUMP.z0, lift: JUMP.lip }),
  // flame cannons beside the lips (../arenamoves.js fires them at a take-off)
  ...[[JUMP.x0 - 2, JUMP.z0 - 6.5], [JUMP.x0 - 2, JUMP.z1 + 6.5], [JUMP.x1 + 2, JUMP.z0 - 6.5], [JUMP.x1 + 2, JUMP.z1 + 6.5]].map(([x, z]) => thing('pyro', x, z, 0, { jump: 'pour' })),
  ...[[COIL.x0 - 2, -1], [COIL.x1 + 2, 1]].map(([x, k]) => thing('pyro', x, COIL.z + k * (COIL.half + 6.5), 0, { jump: 'coil' })),
];
// where a car cannot drive straight through: the steel's steep sides (two voxels a cell)
const SG = 2, SGX = Math.ceil(WX / SG), steepAt = new Uint8Array(SGX * Math.ceil(WZ / SG));
for (let z = CZ - WALL.hz; z < CZ + WALL.hz; z += SG) for (let x = CX - WALL.hx; x < CX + WALL.hx; x += SG) if (DIRT.steep(x + 1, z + 1)) steepAt[(z / SG | 0) * SGX + (x / SG | 0)] = 1;
function runClear(x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2);
  for (let k = 1; k < n; k++) { const f = k / n, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f; if (steepAt[(z / SG | 0) * SGX + (x / SG | 0)] || (stalls && stalls.blocks(x | 0, z | 0))) return false; }
  return true;
}
const POWER = { on: [1, 1, 1, 1], lit: [1, 1, 1, 1], rev: 0 };
let stalls = null, moves = null, works = null;

// ---- building: the barrier (voxels: a car bounces off it) -----------------------------------------------------------------
// Concrete, eight high, round the whole floor, its inside face in yellow and black chevrons at the corners and at the
// traps, an amber lamp on its cap every eight. Tiles of it, so a hit only has to check its own piece.
function ring() {
  const T = 32, R = WALL.r;
  for (let tx = 128; tx < 896; tx += T) for (let tz = 256; tz < 768; tz += T) {
    let any = false;
    for (let x = tx; x < tx + T; x++) for (let z = tz; z < tz + T; z++) {
      const e = edge(x + 0.5, z + 0.5, WALL); if (e < 0 || e >= 4) continue;
      if (!any) { begin('Mill barrier', 'barrier', false); any = true; }
      const ox = Math.abs(x + 0.5 - CX) - IN, oz = Math.abs(z + 0.5 - CZ) - IZ, corner = ox > 0 && oz > 0;
      const arc = corner ? Math.floor(Math.atan2(oz, ox) * (R + 1.5)) : (oz > 0 ? x : z);
      if (e >= 3) { for (let y = 0; y <= 3; y++) set(x, y, z, M.CONC); continue; }
      for (let y = 0; y <= 7; y++) set(x, y, z, M.CONC);
      const striped = corner || (oz <= 0 && x < CX && Math.abs(z - FORGE.z) < 44) || (oz > 0 && z < CZ && Math.abs(x - CX) < 30);
      if (e < 1) for (let y = 1; y <= 6; y++) set(x, y, z, striped ? (((arc + y) >> 2) & 1 ? M.TAXI : M.DARK) : (y === 5 ? M.TAXI : y === 1 ? M.DARK : M.CONC));
      set(x, 8, z, e < 1 && arc % 8 === 0 ? M.LIT_Y : M.DARK);
    }
  }
}
// By night (looks/night.js) the hall is lit by four frames of floodlights in its corners, each lighting its own quarter
// of the floor, as Hammerdown's towers do.
const FRAMES = [[HALL.x0 + 22, HALL.z0 + 22], [HALL.x1 - 22, HALL.z0 + 22], [HALL.x1 - 22, HALL.z1 - 22], [HALL.x0 + 22, HALL.z1 - 22]], FRAME_Y = HALL.eave - 8;
const BANKS = FRAMES.flatMap(([hx, hz]) => {
  const fx = Math.sign(CX - hx), fz = Math.sign(CZ - hz), y = FRAME_Y - 4.5, mx = hx + (CX - hx) * 0.5, mz = hz + (CZ - hz) * 0.5;
  return [
    { x: hx + fx * 6, y, z: hz, nx: fx, nz: 0, w: 13, h: 7, aim: [mx + fx * 70, mz] },
    { x: hx, y, z: hz + fz * 6, nx: 0, nz: fz, w: 13, h: 7, aim: [mx, mz + fz * 45] },
  ];
});
// what stands along the walls, outside the barrier (into the hall's one mesh: steelkit makeBoxes): the control pulpit
// over the south wall, slabs and coils stacked along it, billets by the smith, a floodlight frame in each corner
function dress(X) {
  const Y = 0xe2b02a, D = 0x22252a, S = 0x3d444b, R = 0x47301f, W = [1.6, 1.25, 0.7];
  // the pulpit: a cabin on legs against the south wall, a long lit window, a stair
  X.B(430, 30, 760, 594, 33, 790, S); X.B(432, 33, 764, 592, 54, 790, 0x2c333b); X.B(428, 54, 760, 596, 57, 792, D);
  X.L(438, 39, 763.4, 586, 49, 764, W, 0.55); for (let x = 462; x < 586; x += 24) X.B(x, 38, 763.2, x + 1.4, 50, 764.2, D);
  for (const x of [436, 510, 584]) for (const z of [764, 786]) X.B(x, 0, z, x + 3, 30, z + 3, S);
  X.stripes(430, 33, 759.6, 594, 34.4, 760, 20);
  // stacks along the south wall, and along the north between the furnaces
  let k = 0;
  for (const [x0, x1] of [[230, 410], [612, 800]]) for (let x = x0; x < x1; x += 30) {
    const n = 1 + (k++ * 7) % 4;
    for (let i = 0; i < n; i++) X.B(x, i * 5, 764 + (i & 1), x + 24, i * 5 + 4.4, 782 - (i & 1), i & 1 ? 0x4a4038 : S);
    if (k % 3 === 0) X.L(x + 2, 1, 763.8, x + 22, 1.6, 764.2, [0.75, 0.16, 0.03]);
  }
  for (const x of [300, 720]) for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) X.R(x + j * 13 + i * 6.5, 6 + i * 11, 262, 12, 12, 16, [0, 0, Math.PI / 4], j & 1 ? S : 0x69737b);
  // billets racked by the smith, one of them still bright; his anvil block behind the barrier
  for (let i = 0; i < 5; i++) X.B(128, 2 + i * 3.4, 548 + i * 0.6, 168, 5 + i * 3.4, 554 + i * 0.6, i === 4 ? R : S);
  X.L(128, 16.4, 550.4, 168, 17, 556, [1.5, 0.42, 0.08]);
  // the frames of floodlights
  for (const [x, z] of FRAMES) { X.B(x - 8, FRAME_Y - 9, z - 8, x + 8, FRAME_Y, z + 8, D); X.B(x - 1, FRAME_Y, z - 1, x + 1, HALL.eave, z + 1, S); X.L(x - 7, FRAME_Y - 9.5, z - 7, x + 7, FRAME_Y - 9, z + 7, [2.6, 2.5, 2.3]); }
  // a walkway along the north wall at the furnaces' platforms, and the name over the pulpit
  X.B(HALL.x0, 33, 240, HALL.x1, 34.2, 246, S); X.B(HALL.x0, 38.4, 245.4, HALL.x1, 39.2, 246, Y);
}

// ---- the painted floor ----------------------------------------------------------------------------------------------------
function roundRect(g, S, inset = 0) {
  const x0 = CX - S.hx + inset, x1 = CX + S.hx - inset, z0 = CZ - S.hz + inset, z1 = CZ + S.hz - inset, r = Math.max(1, S.r - inset);
  g.beginPath(); g.moveTo(x0 + r, z0); g.lineTo(x1 - r, z0); g.arc(x1 - r, z0 + r, r, -Math.PI / 2, 0); g.lineTo(x1, z1 - r); g.arc(x1 - r, z1 - r, r, 0, Math.PI / 2);
  g.lineTo(x0 + r, z1); g.arc(x0 + r, z1 - r, r, Math.PI / 2, Math.PI); g.lineTo(x0, z0 + r); g.arc(x0 + r, z0 + r, r, Math.PI, Math.PI * 1.5); g.closePath();
}
const stripes = (g, x, z, w, h, n, alongX) => { for (let k = 0; k * n < (alongX ? w : h); k++) { g.fillStyle = k & 1 ? '#1c1c1e' : '#e2b02a'; if (alongX) g.fillRect(x + k * n, z, Math.min(n, w - k * n), h); else g.fillRect(x, z + k * n, w, Math.min(n, h - k * n)); } };
// chequer plate: a steel fill and its raised lozenges, in rows
function plate(g, x, z, w, h, base = '#6a727a', mark = 'rgba(205,212,220,0.3)') {
  g.fillStyle = base; g.fillRect(x, z, w, h); g.fillStyle = mark;
  for (let j = 0; j < h; j += 2) for (let i = (j / 2) & 1; i < w - 0.8; i += 2) g.fillRect(x + i, z + j + ((i >> 1) & 1 ? 0.2 : 0.9), 1, 0.45);
}
const PHONE = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
function paint() {
  const c = canvasFor('#34322f', 91), g = c.g;
  const V = () => g.setTransform(GK, 0, 0, GK, 0, 0), I = () => g.setTransform(1, 0, 0, 1, 0, 0);
  c.mottle(0, 0, WX, WZ, 8, [[20, 18, 16, 0.25], [110, 104, 96, 0.12]]);
  // the floor: worn concrete in slabs, darker along the barrier's foot, scorched along the runner
  g.save(); V(); roundRect(g, WALL); g.fillStyle = '#5b5852'; g.fill(); g.clip(); I();
  const CONC = [[30, 28, 26, 0.35], [150, 144, 132, 0.22], [84, 76, 66, 0.3]];
  for (const [cell, k] of [[40, 0.8], [11, 0.8], [3, 0.8], [1.3, 0.6]]) c.mottle(176, 292, 848, 732, cell, CONC.map(([r, gg, b, a]) => [r, gg, b, a * k]));
  V();
  g.strokeStyle = 'rgba(22,20,18,0.45)'; g.lineWidth = 0.5;
  for (let x = 176 + 48; x < 848; x += 48) { g.beginPath(); g.moveTo(x, 292); g.lineTo(x, 732); g.stroke(); }
  for (let z = 292 + 44; z < 732; z += 44) { g.beginPath(); g.moveTo(176, z); g.lineTo(848, z); g.stroke(); }
  for (let k = 0; k < 6; k++) { g.strokeStyle = `rgba(16,14,12,${0.07 + k * 0.03})`; g.lineWidth = 2; roundRect(g, WALL, 11 - k * 2); g.stroke(); }
  g.strokeStyle = 'rgba(214,170,44,0.75)'; g.lineWidth = 1; g.setLineDash([10, 4]); roundRect(g, WALL, 16); g.stroke(); g.setLineDash([]);
  // oil, scale and rust on it, and the black of tyres
  for (let i = 0; i < 130; i++) {
    const x = 190 + rand() * 644, z = 300 + rand() * 424, rx = 4 + rand() * 16, rz = 3 + rand() * 9, a = rand() * 3;
    g.fillStyle = i % 4 === 0 ? `rgba(96,54,28,${0.1 + rand() * 0.14})` : `rgba(14,12,10,${0.1 + rand() * 0.18})`; g.beginPath(); g.ellipse(x, z, rx, rz, a, 0, TAU); g.fill();
  }
  g.lineCap = 'round';
  for (let i = 0; i < 110; i++) {
    g.strokeStyle = `rgba(12,11,10,${0.1 + rand() * 0.2})`; g.lineWidth = 0.8 + rand() * 1.4; g.beginPath();
    const x = CX + (rand() - 0.5) * 560, z = CZ + (rand() - 0.5) * 340; g.arc(x, z, 26 + rand() * 110, rand() * TAU, rand() * TAU); g.stroke();
  }
  g.lineCap = 'butt';
  // the runner: scorched ground either side, a kerb in stripes, the trough dark with crusts of slag, and the plates
  const sc = g.createLinearGradient(CH.x0 - 22, 0, CH.x1 + 22, 0); sc.addColorStop(0, 'rgba(20,12,8,0)'); sc.addColorStop(0.42, 'rgba(20,12,8,0.6)'); sc.addColorStop(0.58, 'rgba(20,12,8,0.6)'); sc.addColorStop(1, 'rgba(20,12,8,0)');
  g.fillStyle = sc; g.fillRect(CH.x0 - 22, 292, CH.x1 - CH.x0 + 44, 440);
  stripes(g, CH.x0 - 2, CH.z0 - 5, 1.6, CH.z1 - CH.z0 + 10, 4, false); stripes(g, CH.x1 + 0.4, CH.z0 - 5, 1.6, CH.z1 - CH.z0 + 10, 4, false);
  g.fillStyle = '#15110f'; g.fillRect(CH.x0, 292, CH.x1 - CH.x0, 440);
  for (let i = 0; i < 260; i++) { g.fillStyle = i % 3 ? `rgba(70,40,24,${0.3 + rand() * 0.4})` : `rgba(160,70,20,${0.2 + rand() * 0.3})`; g.fillRect(CH.x0 + rand() * 9, 294 + rand() * 436, 0.6 + rand() * 1.6, 1 + rand() * 5); }
  g.strokeStyle = 'rgba(190,80,20,0.35)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(CX - 2, 294); g.lineTo(CX - 2, 730); g.moveTo(CX + 2.4, 294); g.lineTo(CX + 2.4, 730); g.stroke();
  for (const [z0, z1] of BRIDGES) {
    plate(g, CH.x0 - 7, z0, CH.x1 - CH.x0 + 14, z1 - z0);
    stripes(g, CH.x0 - 7, z0 - 1.6, CH.x1 - CH.x0 + 14, 1.6, 3, true); stripes(g, CH.x0 - 7, z1, CH.x1 - CH.x0 + 14, 1.6, 3, true);
    g.fillStyle = 'rgba(232,228,218,0.75)'; g.font = 'bold 6px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [x, d] of [[CH.x0 - 20, 1], [CH.x1 + 20, -1]]) { g.beginPath(); g.moveTo(x + d * 8, (z0 + z1) / 2); g.lineTo(x, (z0 + z1) / 2 - 5); g.lineTo(x, (z0 + z1) / 2 + 5); g.fill(); }
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // under the crane: a bay marked out in stripes, the ladle's path across it at each end and in the middle, the word
  { const x0 = LADLE.x0 - 16, x1 = LADLE.x1 + 16, z0 = LADLE.z - LADLE_REACH, z1 = LADLE.z + LADLE_REACH;
    g.fillStyle = 'rgba(210,120,24,0.1)'; g.fillRect(x0, z0, x1 - x0, z1 - z0);
    stripes(g, x0, z0 - 2, x1 - x0, 2, 5, true); stripes(g, x0, z1, x1 - x0, 2, 5, true);
    g.strokeStyle = 'rgba(226,176,42,0.55)'; g.lineWidth = 1; g.setLineDash([3, 3]);
    for (let x = LADLE.x0; x <= LADLE.x1; x += 35) { g.beginPath(); g.moveTo(x, z0 + 4); g.lineTo(x, z1 - 4); g.stroke(); }
    g.setLineDash([]);
    g.font = 'bold 13px "Arial Black", Impact, sans-serif'; g.fillStyle = 'rgba(226,176,42,0.5)';
    for (const x of [(x0 + LADLE.x0 + LADLE.x1 + x1) / 4 - 26, (x0 + LADLE.x0 + LADLE.x1 + x1) / 4 + 80]) { g.fillText('OVERHEAD', x, LADLE.z - 16); g.fillText('LADLE', x, LADLE.z + 16); }
  }
  // the forge plate: steel, a striped ring, the reach of the blow dashed in red, the word
  g.fillStyle = 'rgba(120,24,18,0.3)'; g.beginPath(); g.arc(FORGE.x, FORGE.z, FORGE.reach, 0, TAU); g.fill();
  g.strokeStyle = '#c23b2e'; g.lineWidth = 1.2; g.setLineDash([4, 3]); g.beginPath(); g.arc(FORGE.x, FORGE.z, FORGE.reach, 0, TAU); g.stroke(); g.setLineDash([]);
  for (let k = 0; k < 40; k++) { g.fillStyle = k & 1 ? '#1c1c1e' : '#e2b02a'; g.beginPath(); g.arc(FORGE.x, FORGE.z, FORGE.r + 4, k / 40 * TAU, (k + 1) / 40 * TAU); g.arc(FORGE.x, FORGE.z, FORGE.r + 1, (k + 1) / 40 * TAU, k / 40 * TAU, true); g.fill(); }
  g.fillStyle = '#3a3d42'; g.beginPath(); g.arc(FORGE.x, FORGE.z, FORGE.r + 1, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(16,16,18,0.6)'; g.lineWidth = 0.4; for (let r = 4; r < FORGE.r; r += 4) { g.beginPath(); g.arc(FORGE.x, FORGE.z, r, 0, TAU); g.stroke(); }
  g.save(); g.translate(FORGE.x + FORGE.r + 11, FORGE.z); g.rotate(Math.PI / 2); g.font = 'bold 8px "Arial Black", Impact, sans-serif'; g.fillStyle = 'rgba(232,228,218,0.75)'; g.fillText('FORGE', 0, 0); g.restore();
  // the rolling line's rails and the mark where it starts
  stripes(g, LINE.x0, LINE.z0 - 2, LINE.x1 - LINE.x0, 2, 4, true); stripes(g, LINE.x0, LINE.z1, LINE.x1 - LINE.x0, 2, 4, true);
  g.save(); g.translate(LINE.x0 - 8, (LINE.z0 + LINE.z1) / 2); g.rotate(-Math.PI / 2); g.font = 'bold 6px "Arial Black", Impact, sans-serif'; g.fillStyle = 'rgba(232,228,218,0.7)'; g.fillText('ROLLING LINE', 0, 0); g.restore();
  // soot round each barrel's spot
  for (const p of BARRELS.spots) { g.strokeStyle = '#c23b2e'; g.lineWidth = 0.8; g.setLineDash([1.5, 1.5]); g.beginPath(); g.arc(p.x, p.z, 3.4, 0, TAU); g.stroke(); g.setLineDash([]); }
  paintSteel(g);
  // the boost strips: blue, with chevrons pointing the way they push
  for (const b of BOOSTS) {
    g.fillStyle = '#1d3f6e'; g.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    const dir = Math.sin(b.yaw) > 0 ? 1 : -1, mz = (b.z0 + b.z1) / 2, hw = (b.z1 - b.z0) / 2 - 1.5;
    g.strokeStyle = '#5fc8ff'; g.lineWidth = 2;
    for (let x = b.x0 + 6; x < b.x1 - 4; x += 9) { g.beginPath(); g.moveTo(x - dir * 4, mz - hw); g.lineTo(x + dir * 2, mz); g.lineTo(x - dir * 4, mz + hw); g.stroke(); }
    if (!b.to) continue;
    g.strokeStyle = 'rgba(238,232,214,0.5)'; g.lineWidth = 1; g.setLineDash([5, 4]);
    const bx = b.to[0] > b.x1 ? b.x1 : b.x0; g.beginPath(); g.moveTo(bx, b.z0); g.lineTo(b.to[0], b.to[1]); g.moveTo(bx, b.z1); g.lineTo(b.to[2], b.to[3]); g.stroke(); g.setLineDash([]);
  }
  for (const p of PICKUP_SPOTS) { const k = PICKUPS[p.kind]; g.strokeStyle = k.css; g.lineWidth = 1.1; g.beginPath(); g.arc(p.x, p.z, 6, 0, TAU); g.stroke(); g.globalAlpha = 0.25; g.fillStyle = k.css; g.fill(); g.globalAlpha = 1; }
  g.restore();
  I();
  if (!PHONE) return c.cv;
  const half = document.createElement('canvas'); half.width = c.cv.width >> 1; half.height = c.cv.height >> 1;
  const h = half.getContext('2d'); h.imageSmoothingQuality = 'high'; h.drawImage(c.cv, 0, 0, half.width, half.height);
  c.cv.width = c.cv.height = 1;
  return half;
}
// the kickers, ramps and rollers: chequer plate, darker down their sides, yellow arrows up each ramp, a striped line
// along every lip and a pale one along every other edge; the slabs' and coils' shadows
function paintSteel(g) {
  for (const p of DIRT.pieces) {
    const w = p.x1 - p.x0, d = p.z1 - p.z0;
    if (p.kind === 'deck') { g.fillStyle = 'rgba(10,9,8,0.75)'; g.fillRect(p.x0 - 1.5, p.z0 - 1.5, w + 3, d + 3); continue; }
    const ramp = (k) => p[k] > p.skirt;
    g.save(); g.beginPath(); g.rect(p.bx0, p.bz0, p.bx1 - p.bx0, p.bz1 - p.bz0); g.clip();
    plate(g, p.bx0, p.bz0, p.bx1 - p.bx0, p.bz1 - p.bz0, '#3c4147', 'rgba(150,158,166,0.2)');
    if (ramp('w')) plate(g, p.bx0, p.z0, p.w, d, '#5d656d'); if (ramp('e')) plate(g, p.x1, p.z0, p.e, d, '#5d656d');
    plate(g, p.x0, p.z0, w, d, '#727a82');
    if (p.kind === 'rollers') {
      for (let k = 0; k <= p.humps; k++) {
        const t = p.x0 + w * k / p.humps, cr = p.x0 + w * (k + 0.5) / p.humps;
        g.fillStyle = 'rgba(14,12,10,0.45)'; g.fillRect(t - 5, p.z0, 10, d);
        if (k < p.humps) { g.fillStyle = 'rgba(214,220,226,0.22)'; g.fillRect(cr - 6, p.z0, 12, d); stripes(g, cr - 0.8, p.z0, 1.6, d, 4, false); }
      }
    }
    g.strokeStyle = 'rgba(226,176,42,0.85)'; g.lineWidth = 2; g.lineJoin = 'miter';
    const arrow = (x, z, dx, half) => { g.beginPath(); g.moveTo(x - dx * 5, z - half); g.lineTo(x, z); g.lineTo(x - dx * 5, z + half); g.stroke(); };
    for (const f of [0.3, 0.55, 0.8]) { if (ramp('w')) arrow(p.bx0 + p.w * f, p.z0 + d / 2, 1, d * 0.3); if (ramp('e')) arrow(p.bx1 - p.e * f, p.z0 + d / 2, -1, d * 0.3); }
    g.restore();
    if (p.kind === 'rollers') continue;
    const edgeLine = (k, x0, z0, x1, z1) => {
      if (ramp(k)) return;
      if (p[k] === 0) { g.strokeStyle = '#1c1c1e'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, z0); g.lineTo(x1, z1); g.stroke(); g.strokeStyle = '#e2b02a'; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(x0, z0); g.lineTo(x1, z1); g.stroke(); g.setLineDash([]); }
      else { g.strokeStyle = 'rgba(238,232,214,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x0, z0); g.lineTo(x1, z1); g.stroke(); }
    };
    edgeLine('w', p.x0 + 0.8, p.z0, p.x0 + 0.8, p.z1); edgeLine('e', p.x1 - 0.8, p.z0, p.x1 - 0.8, p.z1);
    edgeLine('n', p.bx0, p.z0 + 0.8, p.bx1, p.z0 + 0.8); edgeLine('s', p.bx0, p.z1 - 0.8, p.bx1, p.z1 - 0.8);
  }
}

// ---- the map ---------------------------------------------------------------------------------------------------------------
// Routes, as Hammerdown's: the route grid shuts its cells over each trap while it is dangerous (the runner from the
// warning until it has run out, but for the plates; under the ladle where the crane is now; the forge plate while the
// hammer is coming), and the line from a car to its next waypoint must not cut across one.
const nav = makeGridNav({ cell: 4, maxNodes: 16000, side: 6, also: (x, z) => steepAt[(z / SG | 0) * SGX + (x / SG | 0)] === 1 || (!!stalls && stalls.blocks(x | 0, z | 0)) });
const NC = nav.NX * nav.NZ, cellX = (i) => (i % nav.NX + 0.5) * nav.cell, cellZ = (i) => (Math.floor(i / nav.NX) + 0.5) * nav.cell;
const dyn = new Uint8Array(NC), dynWas = new Uint8Array(NC), out = new Uint8Array(NC);
for (let i = 0; i < NC; i++) out[i] = edge(cellX(i), cellZ(i), WALL) > -2 ? 1 : 0;
let zones = null;
function makeZones() {
  const where = (f) => { const o = []; for (let i = 0; i < NC; i++) if (!nav.blocked[i] && f(cellX(i), cellZ(i))) o.push(i); return o; };
  zones = {
    runner: where((x, z) => x > CH.x0 - 5 && x < CH.x1 + 5 && !BRIDGES.some(([a, b]) => z > a + 2 && z < b - 2)),
    ladle: where((x, z) => x > LADLE.x0 - 22 && x < LADLE.x1 + 22 && Math.abs(z - LADLE.z) < 32),
    forge: where((x, z) => Math.hypot(x - FORGE.x, z - FORGE.z) < FORGE.reach - 4),
  };
}
const shown = new Uint8Array(NC), gridR = gridRadar({ NX: nav.NX, NZ: nav.NZ, blocked: shown });
let shownT = 0;
function routeStep(dt) {
  nav.step(dt);
  if (!zones) makeZones();
  dynWas.set(dyn); dyn.fill(0);
  if (POUR.on) for (const i of zones.runner) dyn[i] = 1;
  if (LADLE.x !== undefined) for (const i of zones.ladle) if (Math.abs(cellX(i) - LADLE.x) < 17) dyn[i] = 1;
  if (FORGE.danger) for (const i of zones.forge) dyn[i] = 1;
  for (let i = 0; i < NC; i++) { if (dyn[i] || out[i]) nav.blocked[i] = 1; else if (dynWas[i]) nav.blocked[i] = 0; }
  if ((shownT -= dt) <= 0) { shownT = 1; shown.set(nav.blocked); for (let i = 0; i < NC; i++) if (dyn[i] || out[i]) shown[i] = 0; }
}
function hazardFree(x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2);
  for (let k = 1; k <= n; k++) { const f = k / n; if (dyn[nav.cellOf(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f)]) return false; }
  return true;
}
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
  const st = c._nav;
  if (st && st.path && st.path.some((n) => dyn[n])) { st.next = 0; nav.waypoint(c, tx, tz, o); }
  const P = st && st.path; if (!P) return o;
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
  id: 'steel', name: 'Meltdown Steelworks', mode: 'brawl',
  blurb: 'A steel mill at night with giant robots at work: jump the molten runner in the middle, ride the rolling line into the coil jump, and mind the ladle swinging under the crane and the smith\'s hammer.',
  loading: ['Lighting the furnaces', 'Building the robots', 'Hanging the ladle and laying the runner'],
  outer: 0x2a2826,
  build() { ctx.L = 2; seed = 1234567; ring(); finish(); },
  ground: () => { seed = 7654321; return paint(); },
  floor: (x, z) => DIRT.floor(x, z), floorMesh: () => DIRT.mesh(), ledges: true,
  spawn: { x: 600, z: 690, yaw: Math.atan2(CX - 600, CZ - 690) },
  spots: SPOTS,
  pit: { x: CX, z: CZ },
  waypoint, runClear,
  spawnPoint: (player, taken) => pickSpot(SPOTS, player, taken),
  step: routeStep,
  pickups: PICKUP_SPOTS,
  stalls: () => stalls, moves: () => moves, works: () => works, dirt: DIRT, traps: { LADLE, POUR, FORGE },   // (for the tests)
  // the hall is lit as Hammerdown is (looks/night.js), warmer: the floodlights' frames in its corners, the furnaces'
  // glow from the north for the fill; no sky to see, so no searchlights and no crowd
  look: { kind: 'night', banks: BANKS, ring: { x: CX, z: CZ, ...WALL }, searchlights: [], crowd: [],
    tone: { haze: 0x1c130e, fog: [300, 1700], exposure: 1.06, hemi: [0x8f755f, 0x35221a, 0.9], flood: [0xffeedb, 2.6], fill: [0xff9c58, 0.9, [-0.15, 0.5, -0.85]] } },
  // the works first (the traps move its parts), then the traps, then the bounds
  hazards: [
    { kind: 'custom', make(api) {
      for (const o of THINGS) o.dead = false;
      stalls = makeStalls(api, THINGS, POWER, () => 0, [WX, WZ], { heap: wreckage, bots: true });
      moves = makeArenaMoves(api, { pyros: THINGS.filter((o) => o.kind === 'pyro') });
      works = makeWorks(api, { ...WORKS, dress });
      FORGE.arm = works.arm; FORGE.at = works.at;
      return { step(dt) { stalls.step(dt); moves.step(dt); works.tip(POUR.tip || 0, !!POUR.pouring); works.step(dt); } };
    } },
    LINE, BARRELS, ...BOOSTS, SHOW,
    { kind: 'custom', make: (api, S) => makePour(api, POUR, S) },
    { kind: 'custom', make: (api, S) => makeLadle(api, LADLE, S) },
    { kind: 'custom', make: (api, S) => makeSmith(api, FORGE, S) },
    { kind: 'bounds', x: CX, z: CZ, ...WALL }],
  radarBox: [CX - WALL.hx - 12, CZ - WALL.hz - 12, CX + WALL.hx + 12, CZ + WALL.hz + 12],
  radar(R, s, ox, oy, w, h) {
    const X = (x) => ox + x * s, Y = (z) => oy + z * s, T = performance.now() / 1000, blink = (T * 8 | 0) & 1;
    R.save(); R.translate(ox, oy); R.scale(s, s);
    R.fillStyle = 'rgba(110,106,100,0.4)'; roundRect(R, WALL); R.fill();
    for (const p of DIRT.pieces) {
      if (p.kind === 'deck') { R.fillStyle = 'rgba(232,184,48,0.6)'; R.fillRect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0); continue; }
      R.fillStyle = 'rgba(170,184,198,0.3)'; R.fillRect(p.bx0, p.bz0, p.bx1 - p.bx0, p.bz1 - p.bz0);
      R.fillStyle = 'rgba(200,214,228,0.38)'; R.fillRect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0);
    }
    R.fillStyle = 'rgba(190,196,204,0.3)'; R.fillRect(LINE.x0, LINE.z0, LINE.x1 - LINE.x0, LINE.z1 - LINE.z0);
    // the runner: dark, blinking as it is about to run, orange where the steel is; the plates across it
    R.fillStyle = POUR.on && !POUR.hot && blink ? 'rgba(255,220,90,0.8)' : 'rgba(20,14,10,0.7)'; R.fillRect(CH.x0, CH.z0, CH.x1 - CH.x0, CH.z1 - CH.z0);
    if (POUR.hot) { R.fillStyle = 'rgba(255,130,30,0.95)'; R.fillRect(CH.x0 - 1, POUR.hot0, CH.x1 - CH.x0 + 2, POUR.hot1 - POUR.hot0); }
    R.fillStyle = 'rgba(200,214,228,0.8)'; for (const [a, b] of BRIDGES) R.fillRect(CH.x0 - 5, a, CH.x1 - CH.x0 + 10, b - a);
    R.lineWidth = 2 / s; R.strokeStyle = 'rgba(255,255,255,0.7)'; roundRect(R, WALL, -1.5); R.stroke();
    R.restore();
    gridR(R, s, ox, oy, w, h);
    // the crane's bay, the bridge across it and the ladle
    R.strokeStyle = 'rgba(255,200,60,0.3)'; R.lineWidth = 1; R.strokeRect(X(LADLE.x0 - 14), Y(LADLE.z - LADLE_REACH), (LADLE.x1 - LADLE.x0 + 28) * s, 2 * LADLE_REACH * s);
    if (LADLE.x !== undefined) {
      R.strokeStyle = 'rgba(255,200,60,0.6)'; R.beginPath(); R.moveTo(X(LADLE.x), Y(LADLE.z - LADLE_REACH)); R.lineTo(X(LADLE.x), Y(LADLE.z + LADLE_REACH)); R.stroke();
      R.fillStyle = LADLE.low ? 'rgba(255,90,40,1)' : 'rgba(255,170,60,0.85)'; R.beginPath(); R.arc(X(LADLE.x), Y(LADLE.z + LADLE.s), LADLE.low ? 3.2 : 2.4, 0, TAU); R.fill();
    }
    // the forge plate: red as the hammer lands, blinking as it is about to
    R.fillStyle = FORGE.low ? 'rgba(255,60,40,0.9)' : FORGE.danger && blink ? 'rgba(255,230,90,0.9)' : 'rgba(255,200,40,0.4)';
    R.beginPath(); R.arc(X(FORGE.x), Y(FORGE.z), (FORGE.low ? FORGE.reach : FORGE.r + 3) * s, 0, TAU); R.fill();
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
