// Blackwater Rig: an oil platform in a storm at night, for the free-for-all (modes/brawl.js). Will picked it for the
// second arena (2026-11-24): "three deck heights, no walls, ram rivals into the sea, flare stacks and a swinging crane".
// It stands on the big world (1024 by 1024: see ../flags.js).
//   - The decks stand thirty voxels over the sea, and nothing but a handrail is round them. The main deck is the floor
//     (height 0, so everything that lies on a floor works as it does anywhere); the sea is the floor everywhere else,
//     thirty down (MAP.floor: vehicle.js lets a car drive off a ledge, `ledges`). A car that goes in is wrecked, and the
//     wreck is put down to whoever hit it last, or was pushing it (the custom hazard below, and the mode's own credit).
//   - The handrails (../rigkit.js, in the fair's kit) hold a car that drifts into one. Rammed hard, shot or blasted they
//     go, and the edge behind is open for the rest of the round: the rig gets more dangerous as the round goes on.
//   - Three heights: the main deck and the west deck (0), the drill floor in the middle under the derrick (8 up, a ramp
//     east and west) and the helipad out over the north-east corner (10 up, one ramp, no rail at all, the strike on it).
//   - The west deck is across a gap: two bridges, and a jump straight over the gap between a kicker either side, with a
//     boost strip into it from both decks. One line runs the length of the rig: the flare boom, the drill floor, the
//     strip, the jump, the west deck.
//   - Traps: the crane on the main deck swings a container round low over the deck and out over the corner (hazards.js's
//     sweeper with the crane's model on it); the flare boom is a walk out over the sea with a burn-off across it, a
//     nitro and an overcharge at its end; the moon pool is a hole in the main deck; barrels.
//   - Every so often the rig calls an event: the burn-off (every jet lit), the crane loose (twice as fast), a squall
//     (the wind shoves every car down the deck).
// The sea, the other platforms out in the dark and the supply ship are the backdrop's (../backdrops/sea.js); the night,
// the rain and the lightning are the base's storm (../looks/storm.js).
// Rivals find their way with the route grid (the sea shut for good, the crane's reach and a lit jet while they are
// dangerous), ask MAP.drop before they drive, slide or back toward an edge (ai.js), and cross by the bridges.
import * as THREE from 'three';
import { WX, WZ, M, set, box, walls, begin, ctx } from '../../../src/world.js';
import { face, text, textW } from '../../../src/kit.js';
import { dust, dustWave, sparks } from '../../../src/sim.js';
import { makeGridNav, canvasFor, finish, pickSpot, gridRadar, lineClear, GK } from './common.js';
import { PICKUPS } from '../pickups.js';
import { makeDirt } from '../arenadirt.js';
import { makeStalls } from '../fairstalls.js';
import { rigBody, craneHub, craneArm, railScrap, rigMat } from '../rigkit.js';

const TAU = Math.PI * 2, E = Math.PI / 2;
const SEA = -30;
const CX = 512, CZ = 512;
// ---- the decks (all square to the map; x east, z south) -------------------------------------------------------------
const A = { x0: 352, x1: 672, z0: 412, z1: 612, depth: 4 };            // the main deck
const B = { x0: 186, x1: 316, z0: 422, z1: 602, depth: 4 };            // the west deck (the quarters stand on it)
const BRIDGES = [{ x0: 316, x1: 352, z0: 426, z1: 448, depth: 2 }, { x0: 316, x1: 352, z0: 576, z1: 598, depth: 2 }];
const HELI = { x0: 592, x1: 672, z0: 332, z1: 412, h: 10, depth: 0 };  // (its own frame is drawn by rigkit.js)
const HRAMP = { x0: 617, x1: 647, run: 36 };                           // the way up to it, from the main deck
const BOOM = { x0: 672, x1: 776, z0: 500, z1: 524, depth: 2 };         // the flare boom
const POOL = { x0: 400, x1: 440, z0: 446, z1: 478 };                   // the moon pool: a hole in the main deck
const DRILL = { x0: 487, x1: 537, z0: 487, z1: 537, h: 8, run: 28 };   // the drill floor, a ramp east and west
const LANE = { z0: 500, z1: 524 }, KICK = { h: 8, run: 30, top: 3 };   // the jump over the gap: a kicker either side
const CRANE = { x: 632, z: 578, r0: 30, r1: 46, top: 34 };
const FLARE = { x: 768, z: 512, top: 60 };
const QUARTERS = { x0: 188, x1: 212, z0: 446, z1: 578, h: 33 };
const DECKS = [A, B, ...BRIDGES, HELI, BOOM];
const inR = (R, x, z) => x >= R.x0 && x <= R.x1 && z >= R.z0 && z <= R.z1;
// is there deck under (x, z)?
function onDeck(x, z) {
  if (x > POOL.x0 && x < POOL.x1 && z > POOL.z0 && z < POOL.z1) return false;
  if (x < B.x0 || x > BOOM.x1 || z < HELI.z0 || z > A.z1) return false;
  for (let i = 0; i < DECKS.length; i++) if (inR(DECKS[i], x, z)) return true;
  return false;
}
// what stands on the decks (../arenadirt.js: the same pieces the arena's dirt is made of). The decks themselves are in
// it flat, for the creases of the floor's mesh along their edges.
const flat = (R) => ({ x0: R.x0, x1: R.x1, z0: R.z0, z1: R.z1, h: 0, w: 0, e: 0, n: 0, s: 0 });
const DIRT = makeDirt([
  ...DECKS.map(flat), flat(POOL),
  { x0: HELI.x0, x1: HELI.x1, z0: HELI.z0, z1: HELI.z1, h: HELI.h, w: 0, e: 0, n: 0, s: 0 },
  { x0: HRAMP.x0, x1: HRAMP.x1, z0: HELI.z1 - 3, z1: HELI.z1, h: HELI.h, w: 0, e: 0, n: 0, s: HRAMP.run },
  { x0: DRILL.x0, x1: DRILL.x1, z0: DRILL.z0, z1: DRILL.z1, h: DRILL.h, w: DRILL.run, e: DRILL.run, n: 0, s: 0 },
  { x0: A.x0, x1: A.x0 + KICK.top, z0: LANE.z0, z1: LANE.z1, h: KICK.h, w: 0, e: KICK.run, n: 0, s: 0 },
  { x0: B.x1 - KICK.top, x1: B.x1, z0: LANE.z0, z1: LANE.z1, h: KICK.h, w: KICK.run, e: 0, n: 0, s: 0 },
]);
const floor = (x, z) => (onDeck(x, z) ? DIRT.floor(x, z) : SEA);
// the floor's mesh: the dirt's grid, with only the cells that have deck under them
let MESH = null;
function floorMesh() {
  if (MESH) return MESH;
  const F = DIRT.mesh(), P = F.position, I = F.index, keep = new Uint32Array(I.length);
  let n = 0;
  for (let i = 0; i < I.length; i += 6) {
    const a = I[i], d = I[i + 5], x = (P[a * 3] + P[d * 3]) / 2, z = (P[a * 3 + 2] + P[d * 3 + 2]) / 2;
    if (!onDeck(x, z)) continue;
    for (let k = 0; k < 6; k++) keep[n++] = I[i + k];
  }
  return (MESH = { position: F.position, uv: F.uv, normal: F.normal, index: keep.slice(0, n) });
}

// ---- the live parts ---------------------------------------------------------------------------------------------------
// Pickups: the strike in the middle of the helipad (no rail up there); a repair kit on the drill floor and one on the
// west deck; a nitro and an overcharge out at the end of the flare boom, past the burn-off; an overcharge in the
// crane's eye, and a scrap crate in the corner its container sweeps (bait for you alone); the rest about the decks.
const SUPER = { kind: 'super', x: (HELI.x0 + HELI.x1) / 2, z: (HELI.z0 + HELI.z1) / 2 };
const PICKUP_SPOTS = [
  SUPER, { kind: 'repair', x: CX, z: CZ }, { kind: 'repair', x: 262, z: 470 },
  { kind: 'nitro', x: 748, z: 506 }, { kind: 'ammo', x: 748, z: 518 }, { kind: 'nitro', x: 262, z: 560 }, { kind: 'nitro', x: 380, z: 430 },
  { kind: 'ammo', x: CRANE.x + 15, z: CRANE.z - 4 }, { kind: 'ammo', x: 512, z: 590 }, { kind: 'ammo', x: 512, z: 434 }, { kind: 'ammo', x: 232, z: 512 },
  { kind: 'scrap', x: 664, z: 604, rivals: false }, { kind: 'scrap', x: 420, z: 484, rivals: false },
];
// the crane: one container, from 30 out to 46, a turn every eleven seconds (twice as fast when it is loose)
const SWEEP = { kind: 'sweeper', x: CRANE.x, z: CRANE.z, n: 1, r0: CRANE.r0, r1: CRANE.r1, spin: TAU / 11, top: CRANE.top, dmg: 14, wild: 'crane',
  saws: false, wedge: false, thick: 3, lamp: [7.7, 3.25], toast: ['Hit by the container!', 'Mind the crane\'s swing'] };
// the burn-off: three jets across the flare boom from its north side, one after another
const JETS = { kind: 'jets', len: 24, wild: 'burn', rest: 2.2, toast: ['Burning!', 'Keep off the flare boom while its jets are lit'], jets: [0, 1, 2].map((i) => ({ x: 700 + i * 16, z: BOOM.z0 + 0.5, a: E, group: 0, step: i })) };
const BARRELS = { kind: 'barrels', spots: [
  { x: 398, z: 578 }, { x: 403, z: 582 }, { x: 396, z: 585 },     // the main deck's south-west
  { x: 566, z: 436 }, { x: 571, z: 432 },                          // by the foot of the helipad's ramp
  { x: 656, z: 470 }, { x: 660, z: 476 },                          // by the boom's mouth
  { x: 294, z: 440 }, { x: 299, z: 445 }, { x: 296, z: 586 },      // the west deck, by the bridges
] };
// boost strips, all along the one line: into the drill floor from the east, into the gap from the main deck, and into
// it from the west deck (each ends within 70 voxels of the lip it is for: the push lasts 0.8 seconds)
const BOOSTS = [
  { kind: 'boost', x0: 578, z0: 505, x1: 640, z1: 519, yaw: -E },
  { kind: 'boost', x0: 392, z0: 505, x1: 454, z1: 519, yaw: -E },
  { kind: 'boost', x0: 206, z0: 505, x1: 276, z1: 519, yaw: E },
];
const SQUALL = { push: 11, dir: [0.9, 0.42] };   // a squall: voxels a second every car is shoved, and which way (the way the rain slants)
const SHOW = { kind: 'show', first: 40, every: 42, time: 14, events: [
  { tag: 'burn', name: 'BURN-OFF!', sub: 'Every jet on the flare boom is lit' },
  { tag: 'crane', name: 'CRANE LOOSE!', sub: 'The container swings twice as fast' },
  { tag: 'squall', name: 'SQUALL!', sub: 'The wind shoves everything east. Hold your ground' },
] };
// the floodlight masts (looks/storm.js builds them and lights the decks under them), each on a concrete block
const BANKS = [
  { x: 361, z: 421, nx: 1, nz: 0, aim: [452, 500] }, { x: 663, z: 421, nx: -1, nz: 0, aim: [580, 500] },
  { x: 361, z: 603, nx: 1, nz: 0, aim: [450, 540] }, { x: 556, z: 603, nx: 0, nz: -1, aim: [590, 536] },
  { x: 224, z: 431, nx: 0, nz: 1, aim: [262, 500] }, { x: 224, z: 593, nx: 0, nz: -1, aim: [262, 524] },
].map((b) => ({ ...b, y: 78 }));
// Where cars come in (the free-for-all takes the one furthest from everyone): well in from every edge, facing the
// middle of the deck they are on.
const SPOTS = [
  [380, 470, A], [382, 560, A], [462, 432, A], [562, 462, A], [470, 584, A], [566, 560, A], [450, 556, A], [600, 470, A],
  [250, 462, B], [250, 562, B], [286, 470, B], [286, 556, B],
].map(([x, z, D]) => ({ x, z, yaw: Math.atan2((D.x0 + D.x1) / 2 - x, (D.z0 + D.z1) / 2 - z) }));

// ---- the handrails, the lamps along the open edges, the masts' blocks (../rigkit.js; the fair's kit runs them) --------
const THINGS = [];
{
  let c = 0;
  // a run of rail along a deck's edge, in from it a little, cut into lengths of about sixteen
  const run = (x0, z0, x1, z1) => {
    const along = z0 === z1, len = along ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(len / 16)), each = len / n;
    for (let k = 0; k < n; k++) THINGS.push({ kind: 'rail', x: along ? x0 + (k + 0.5) * each : x0, z: along ? z0 : z0 + (k + 0.5) * each, yaw: along ? 0 : E, len: each - 0.3, name: '', neon: 'warm', c: c++ });
  };
  const IN = 0.9;
  // the main deck: its north side as far as the helipad's wall, its east side but for the boom's mouth, all its south
  // side, and its west side but for the bridges and the jump
  run(A.x0, A.z0 + IN, HELI.x0, A.z0 + IN);
  run(A.x1 - IN, A.z0, A.x1 - IN, BOOM.z0); run(A.x1 - IN, BOOM.z1, A.x1 - IN, A.z1);
  run(A.x0, A.z1 - IN, A.x1, A.z1 - IN);
  // (the rails stop two short of the jump's lane, so a car at the lane's edge does not catch a post)
  const WEST = [[A.z0, BRIDGES[0].z0], [BRIDGES[0].z1, LANE.z0 - 2], [LANE.z1 + 2, BRIDGES[1].z0], [BRIDGES[1].z1, A.z1]];
  for (const [a, b] of WEST) run(A.x0 + IN, a, A.x0 + IN, b);
  // the west deck: north and south, its east side as the main deck's west, and its west side either end of the quarters
  run(B.x0, B.z0 + IN, B.x1, B.z0 + IN); run(B.x0, B.z1 - IN, B.x1, B.z1 - IN);
  for (const [a, b] of WEST.map(([a, b]) => [Math.max(a, B.z0), Math.min(b, B.z1)])) run(B.x1 - IN, a, B.x1 - IN, b);
  run(B.x0 + IN, B.z0, B.x0 + IN, QUARTERS.z0); run(B.x0 + IN, QUARTERS.z1 + 1, B.x0 + IN, B.z1);
  // both sides of both bridges
  for (const R of BRIDGES) { run(R.x0, R.z0 + IN, R.x1, R.z0 + IN); run(R.x0, R.z1 - IN, R.x1, R.z1 - IN); }
  // lamps set in the deck where there is no rail: red along the boom, green round the helipad, amber round the moon pool
  const studs = (x0, z0, x1, z1, rgb, lift = 0, every = 4) => { const along = z0 === z1; THINGS.push({ kind: 'studs', x: (x0 + x1) / 2, z: (z0 + z1) / 2, yaw: along ? 0 : E, len: along ? x1 - x0 : z1 - z0, rgb, lift, every, name: '', neon: 'warm', always: true }); };
  studs(BOOM.x0 + 2, BOOM.z0 + 0.8, BOOM.x1 - 10, BOOM.z0 + 0.8, 'red'); studs(BOOM.x0 + 2, BOOM.z1 - 0.8, BOOM.x1 - 10, BOOM.z1 - 0.8, 'red');
  studs(HELI.x0 + 1, HELI.z0 + 1, HELI.x1 - 1, HELI.z0 + 1, 'green', HELI.h); studs(HELI.x0 + 1, HELI.z0 + 1, HELI.x0 + 1, HELI.z1 - 1, 'green', HELI.h); studs(HELI.x1 - 1, HELI.z0 + 1, HELI.x1 - 1, HELI.z1 - 1, 'green', HELI.h);
  studs(POOL.x0 - 1.5, POOL.z0 - 1.5, POOL.x1 + 1.5, POOL.z0 - 1.5, 'amber'); studs(POOL.x0 - 1.5, POOL.z1 + 1.5, POOL.x1 + 1.5, POOL.z1 + 1.5, 'amber');
  studs(POOL.x0 - 1.5, POOL.z0 - 1.5, POOL.x0 - 1.5, POOL.z1 + 1.5, 'amber'); studs(POOL.x1 + 1.5, POOL.z0 - 1.5, POOL.x1 + 1.5, POOL.z1 + 1.5, 'amber');
  for (const b of BANKS) THINGS.push({ kind: 'plinth', x: b.x, z: b.z, yaw: 0, name: '', neon: 'warm' });
}
let stalls = null;
const POWER = { on: [1, 1, 1, 1], lit: [1, 1, 1, 1], rev: 0 };

// Where a car cannot drive: the sea, the sides of the ramps and the raised decks, and what stands solid (two voxels a
// cell). The rivals' straight runs at a target ask it (ai.js), and so does the route grid.
const SG = 2, SGX = Math.ceil(WX / SG), noGo = new Uint8Array(SGX * Math.ceil(WZ / SG)).fill(1);
for (let z = HELI.z0 - 4; z < A.z1 + 4; z += SG) for (let x = B.x0 - 4; x < BOOM.x1 + 4; x += SG) noGo[(z / SG | 0) * SGX + (x / SG | 0)] = !onDeck(x + 1, z + 1) || !onDeck(x + 3, z + 1) || !onDeck(x - 1, z + 1) || !onDeck(x + 1, z + 3) || !onDeck(x + 1, z - 1) || DIRT.steep(x + 1, z + 1) ? 1 : 0;
const shut = (x, z) => x < 0 || z < 0 || x >= WX || z >= WZ || noGo[(z / SG | 0) * SGX + (x / SG | 0)] === 1 || (!!stalls && stalls.blocks(x | 0, z | 0));
function runClear(x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2);
  for (let k = 1; k < n; k++) { const f = k / n; if (shut(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f)) return false; }
  return true;
}

// ---- what is built of voxels: the quarters, the derrick, the flare stack ------------------------------------------------
let seed = 24680;
const rand = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 8) & 0xffff) / 65536; };
function quarters() {
  const Q = QUARTERS;
  begin('Quarters', 'barrier', false);
  walls(Q.x0, 0, Q.z0, Q.x1, Q.h, Q.z1, M.TRIM); box(Q.x0, Q.h + 1, Q.z0, Q.x1, Q.h + 1, Q.z1, M.ROOF_D);
  for (const y of [0, 1]) walls(Q.x0, y, Q.z0, Q.x1, y, Q.z1, M.STEEL);
  for (const y of [11, 22, Q.h]) walls(Q.x0, y, Q.z0, Q.x1, y, Q.z1, M.DARK);
  // windows on the side that looks at the deck, three floors of them, most lit
  for (let f = 0; f < 3; f++) for (let z = Q.z0 + 4; z < Q.z1 - 5; z += 7) {
    const y = 4 + f * 11, lit = rand() < 0.7;
    box(Q.x1, y, z, Q.x1, y + 3, z + 3, lit ? (rand() < 0.3 ? M.LIT_B : M.LIT) : M.GLASS);
    for (const zz of [Q.z0, Q.z1]) if (z < Q.z0 + 20) box(Q.x0 + 4 + (z - Q.z0 - 4), y, zz, Q.x0 + 7 + (z - Q.z0 - 4), y + 3, zz, lit ? M.LIT : M.GLASS);
  }
  // doors, and an orange band round its foot
  for (const z of [Q.z0 + 30, Q.z1 - 34]) { box(Q.x1, 2, z, Q.x1, 8, z + 4, M.DOOR_R); box(Q.x1 + 1, 9, z - 1, Q.x1 + 1, 9, z + 5, M.DARK); set(Q.x1 + 1, 8, z + 2, M.LIT_W); }
  walls(Q.x0, 2, Q.z0, Q.x1, 2, Q.z1, M.SIGN);
  begin('Sign', 'sign', false);
  { const F = face('r', Q.x0, Q.z0, Q.x1, Q.z1), str = 'BLACKWATER 7'; box(Q.x1 + 1, 25, Q.z0 + 30, Q.x1 + 1, 32, Q.z1 - 30, M.DARK); text(F, str, (F.W - textW(str)) >> 1, 26, 2, M.LIT_Y); }
  // on the roof: the wheelhouse, a radar mast with its lamp, vents
  begin('Wheelhouse', 'building', true);
  walls(Q.x0 + 3, Q.h + 2, CZ - 16, Q.x1 - 3, Q.h + 11, CZ + 16, M.TRIM); box(Q.x0 + 3, Q.h + 12, CZ - 16, Q.x1 - 3, Q.h + 12, CZ + 16, M.ROOF_D);
  box(Q.x1 - 3, Q.h + 6, CZ - 14, Q.x1 - 3, Q.h + 9, CZ + 14, M.LIT_B); for (let z = CZ - 14; z <= CZ + 14; z += 5) box(Q.x1 - 3, Q.h + 6, z, Q.x1 - 3, Q.h + 9, z, M.DARK);
  begin('Mast', 'tower', true);
  box(200, Q.h + 13, CZ, 200, Q.h + 30, CZ, M.STEEL); box(197, Q.h + 26, CZ, 203, Q.h + 26, CZ, M.STEEL); box(199, Q.h + 31, CZ - 3, 201, Q.h + 31, CZ + 3, M.TRIM); set(200, Q.h + 31, CZ, M.STEEL);
  begin('Vent', 'prop', true);
  for (const z of [Q.z0 + 10, Q.z0 + 30, Q.z1 - 30, Q.z1 - 12]) { box(196, Q.h + 2, z, 200, Q.h + 5, z + 3, M.METAL); box(197, Q.h + 6, z + 1, 199, Q.h + 6, z + 2, M.DARK); }
}
// the derrick: four steel legs at the drill floor's corners, a lattice above them drawing in to the crown, the block hung in it
const DERRICK = { base: 44, top: 118 };
function derrick() {
  begin('Derrick', 'gantry', true);
  const D = DRILL, m = (D.x0 + D.x1) / 2;
  for (const [x, z] of [[D.x0 + 1, D.z0 + 1], [D.x1 - 3, D.z0 + 1], [D.x0 + 1, D.z1 - 3], [D.x1 - 3, D.z1 - 3]]) box(x, 0, z, x + 2, DERRICK.base, z + 2, M.STEEL);
  const off = (y) => Math.round(23 - 19 * (y - DERRICK.base) / (DERRICK.top - DERRICK.base));
  // a line of voxels between two points
  const line = (a, b, mat) => { const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]))); for (let k = 0; k <= n; k++) { const f = n ? k / n : 0; set(Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f), mat); } };
  const corners = (y) => { const o = off(y); return [[m - o, y, m - o], [m + o, y, m - o], [m + o, y, m + o], [m - o, y, m + o]]; };
  walls(D.x0 + 1, DERRICK.base, D.z0 + 1, D.x1 - 1, DERRICK.base + 1, D.z1 - 1, M.STEEL);
  const levels = []; for (let y = DERRICK.base; y <= DERRICK.top; y += 12.333) levels.push(Math.round(y));
  for (let i = 0; i < levels.length - 1; i++) {
    const lo = corners(levels[i]), hi = corners(levels[i + 1]);
    for (let k = 0; k < 4; k++) {
      line(lo[k], hi[k], M.STEEL); line([lo[k][0] + (lo[k][0] < m ? 1 : -1), lo[k][1], lo[k][2]], [hi[k][0] + (hi[k][0] < m ? 1 : -1), hi[k][1], hi[k][2]], M.STEEL);
      line(hi[k], hi[(k + 1) % 4], M.STEEL);
      line(lo[k], hi[(k + 1) % 4], i & 1 ? M.TWR_R : M.TWR_W); line(lo[(k + 1) % 4], hi[k], i & 1 ? M.TWR_R : M.TWR_W);
    }
  }
  box(m - 6, DERRICK.top + 1, m - 6, m + 6, DERRICK.top + 4, m + 6, M.DARK); box(m - 1, DERRICK.top + 5, m - 1, m + 1, DERRICK.top + 9, m + 1, M.STEEL);
  // the travelling block, on its lines
  box(m, 74, m, m, DERRICK.top, m, M.DARK); box(m - 2, 64, m - 2, m + 2, 73, m + 2, M.TAXI); box(m - 1, 60, m - 1, m + 1, 63, m + 1, M.STEEL);
  // the monkey board, half way up, with its lamps
  walls(m - off(81) - 2, 81, m - off(81) - 2, m + off(81) + 2, 81, m + off(81) + 2, M.METAL);
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) set(m + a * (off(81) + 2), 82, m + b * (off(81) + 2), M.LIT_W);
}
// the crane's pedestal (the model over it is the sweeper's: this is what a car and a shot strike)
function cranePost() {
  begin('Crane', 'barrier', false);
  box(CRANE.x - 3, 0, CRANE.z - 3, CRANE.x + 2, CRANE.top - 4, CRANE.z + 2, M.TAXI);
}
function flareStack() {
  begin('Flare stack', 'barrier', false);
  const x = FLARE.x, z = FLARE.z;
  box(x - 3, 0, z - 3, x + 3, 3, z + 3, M.STEEL);
  for (let y = 4; y <= FLARE.top; y++) { const r = y < 12 ? 2 : 1; box(x - r, y, z - r, x + r, y, z + r, (y % 12) < 2 ? M.TWR_R : M.STEEL); }
  box(x - 2, FLARE.top + 1, z - 2, x + 2, FLARE.top + 1, z + 2, M.DARK); box(x - 1, FLARE.top - 4, z - 1, x + 1, FLARE.top + 1, z + 1, M.CHAR);
  // a ladder cage up its deck side
  for (let y = 4; y <= FLARE.top - 6; y += 6) walls(x - 3, y, z - 3, x + 3, y, z + 3, M.METAL);
}

// ---- the paint: steel plate, the lines on it ---------------------------------------------------------------------------
// (the floor's shader lays the hard ground's grain and shine over it, and the rain's wet: ground.js, MAP.groundDetail;
// the paint's alpha says what the ground is: 0.5 hard, 0.25 water standing on it)
const PHONE = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
function paint() {
  const c = canvasFor('#20262a', 313), g = c.g;
  const V = () => g.setTransform(GK, 0, 0, GK, 0, 0), I = () => g.setTransform(1, 0, 0, 1, 0, 0);
  const R4 = (R, m = 0) => [R.x0 - m, R.z0 - m, R.x1 - R.x0 + 2 * m, R.z1 - R.z0 + 2 * m];
  const hazard = (x, z, w, h, n = 3) => {   // yellow and black, on the slant
    g.save(); g.beginPath(); g.rect(x, z, w, h); g.clip(); g.fillStyle = '#d9a92a'; g.fillRect(x, z, w, h);
    g.strokeStyle = '#17181b'; g.lineWidth = n * 0.72; for (let k = -h; k < w + h; k += n * 2) { g.beginPath(); g.moveTo(x + k, z + h + 1); g.lineTo(x + k + h + 2, z - 1); g.stroke(); }
    g.restore();
  };
  V();
  // the plate: blue-grey steel, worn pale down the middle of each deck and rusty toward its edges
  for (const D of DECKS) { g.fillStyle = D === HELI ? '#2c5646' : D === BOOM ? '#5a5650' : '#5b666d'; g.fillRect(...R4(D, 1)); }
  I();
  const PLATE = [[30, 36, 42, 0.38], [150, 160, 166, 0.26], [112, 78, 54, 0.3], [70, 80, 88, 0.4]];
  for (const [cell, k] of [[34, 0.8], [11, 0.8], [3.5, 0.7], [1.4, 0.5]]) c.mottle(B.x0 - 2, HELI.z0 - 2, BOOM.x1 + 2, A.z1 + 2, cell, PLATE.map(([r, gg, b, a]) => [r, gg, b, a * k]));
  V();
  // the plates' seams, and rows of weld marks along them
  g.lineWidth = 0.3;
  for (const D of [A, B, ...BRIDGES, BOOM]) {
    g.save(); g.beginPath(); g.rect(...R4(D)); g.clip();
    for (let x = Math.ceil(D.x0 / 16) * 16; x < D.x1; x += 16) { g.strokeStyle = 'rgba(18,22,26,0.55)'; g.beginPath(); g.moveTo(x, D.z0); g.lineTo(x, D.z1); g.stroke(); g.strokeStyle = 'rgba(170,180,186,0.18)'; g.beginPath(); g.moveTo(x + 0.35, D.z0); g.lineTo(x + 0.35, D.z1); g.stroke(); }
    for (let z = Math.ceil(D.z0 / 16) * 16; z < D.z1; z += 16) { g.strokeStyle = 'rgba(18,22,26,0.55)'; g.beginPath(); g.moveTo(D.x0, z); g.lineTo(D.x1, z); g.stroke(); g.strokeStyle = 'rgba(170,180,186,0.18)'; g.beginPath(); g.moveTo(D.x0, z + 0.35); g.lineTo(D.x1, z + 0.35); g.stroke(); }
    // rust creeping in from the edges, streaks of it down the wind
    for (let i = 0; i < (D.x1 - D.x0) * (D.z1 - D.z0) / 260; i++) {
      const x = D.x0 + rand() * (D.x1 - D.x0), z = D.z0 + rand() * (D.z1 - D.z0), e = Math.min(x - D.x0, D.x1 - x, z - D.z0, D.z1 - z);
      if (rand() * 40 < e) continue;
      g.fillStyle = `rgba(${118 + rand() * 30 | 0},${70 + rand() * 20 | 0},${44 + rand() * 12 | 0},${0.12 + rand() * 0.2})`; g.beginPath(); g.ellipse(x, z, 2 + rand() * 7, 1 + rand() * 2.4, 0.42 + (rand() - 0.5) * 0.3, 0, TAU); g.fill();
    }
    g.restore();
  }
  // the walkway round the two decks, in green anti-slip, and the yellow line along every edge
  for (const D of [A, B]) { g.strokeStyle = 'rgba(52,104,84,0.85)'; g.lineWidth = 5; g.strokeRect(D.x0 + 5.5, D.z0 + 5.5, D.x1 - D.x0 - 11, D.z1 - D.z0 - 11); g.strokeStyle = 'rgba(226,176,42,0.9)'; g.lineWidth = 0.8; g.strokeRect(D.x0 + 2.4, D.z0 + 2.4, D.x1 - D.x0 - 4.8, D.z1 - D.z0 - 4.8); }
  // the one line down the middle of the rig: a pale lane with arrows both ways
  g.fillStyle = 'rgba(190,198,204,0.2)'; g.fillRect(B.x0 + 30, LANE.z0, A.x0 - B.x0 - 30 + 36, LANE.z1 - LANE.z0); g.fillRect(DRILL.x1 + DRILL.run, LANE.z0, BOOM.x0 - DRILL.x1 - DRILL.run, LANE.z1 - LANE.z0);
  g.strokeStyle = 'rgba(232,236,238,0.75)'; g.lineWidth = 0.7; g.setLineDash([5, 4]);
  for (const z of [LANE.z0, LANE.z1]) { g.beginPath(); g.moveTo(B.x0 + 30, z); g.lineTo(DRILL.x0 - DRILL.run, z); g.moveTo(DRILL.x1 + DRILL.run, z); g.lineTo(BOOM.x0, z); g.stroke(); }
  g.setLineDash([]);
  // where there is no rail: hazard stripes. The bridges' mouths and the boom's, the jump's lips, round the moon pool
  hazard(A.x1 - 4, BOOM.z0, 4, BOOM.z1 - BOOM.z0);
  for (const R of BRIDGES) { hazard(R.x0, R.z0, 3, R.z1 - R.z0); hazard(R.x1 - 3, R.z0, 3, R.z1 - R.z0); g.fillStyle = '#4c565c'; g.fillRect(R.x0 + 3, R.z0, R.x1 - R.x0 - 6, R.z1 - R.z0); for (let x = R.x0 + 5; x < R.x1 - 4; x += 2) { g.fillStyle = 'rgba(20,24,28,0.4)'; g.fillRect(x, R.z0 + 1.6, 0.8, R.z1 - R.z0 - 3.2); } }
  hazard(POOL.x0 - 5, POOL.z0 - 5, POOL.x1 - POOL.x0 + 10, 5); hazard(POOL.x0 - 5, POOL.z1, POOL.x1 - POOL.x0 + 10, 5); hazard(POOL.x0 - 5, POOL.z0, 5, POOL.z1 - POOL.z0); hazard(POOL.x1, POOL.z0, 5, POOL.z1 - POOL.z0);
  // the flare boom: grating, a red line down each side, and DANGER across its mouth
  for (let x = BOOM.x0 + 1; x < BOOM.x1; x += 2) { g.fillStyle = 'rgba(20,22,24,0.45)'; g.fillRect(x, BOOM.z0 + 2, 0.9, BOOM.z1 - BOOM.z0 - 4); }
  g.fillStyle = '#b8322a'; g.fillRect(BOOM.x0, BOOM.z0, BOOM.x1 - BOOM.x0, 1.6); g.fillRect(BOOM.x0, BOOM.z1 - 1.6, BOOM.x1 - BOOM.x0, 1.6);
  for (const j of JETS.jets) { g.fillStyle = 'rgba(30,20,16,0.6)'; g.fillRect(j.x - 3, BOOM.z0 + 1.6, 6, BOOM.z1 - BOOM.z0 - 3.2); g.strokeStyle = '#e2622a'; g.lineWidth = 0.6; g.strokeRect(j.x - 3, BOOM.z0 + 1.6, 6, BOOM.z1 - BOOM.z0 - 3.2); }
  // the ramps and the raised decks: grip plate, darker, chevrons up each way on, a yellow line along every lip
  const grip = (x, z, w, h, col = '#4a4f52') => { g.fillStyle = col; g.fillRect(x, z, w, h); const alongX = w > 0; void alongX; for (let a = 0; a < w; a += 2) { g.fillStyle = 'rgba(16,18,20,0.35)'; g.fillRect(x + a, z, 0.7, h); } };
  const chev = (x, z, dir, half, col = 'rgba(232,184,48,0.9)') => { g.strokeStyle = col; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - dir * 4, z - half); g.lineTo(x + dir * 2, z); g.lineTo(x - dir * 4, z + half); g.stroke(); };
  // (the drill floor)
  grip(DRILL.x0 - DRILL.run, DRILL.z0, DRILL.run, DRILL.z1 - DRILL.z0); grip(DRILL.x1, DRILL.z0, DRILL.run, DRILL.z1 - DRILL.z0);
  for (let k = 0; k < 3; k++) { chev(DRILL.x0 - DRILL.run + 6 + k * 8, CZ, 1, 9); chev(DRILL.x1 + DRILL.run - 6 - k * 8, CZ, -1, 9); }
  g.fillStyle = '#7a4032'; g.fillRect(...R4(DRILL));
  g.save(); g.beginPath(); g.rect(...R4(DRILL)); g.clip(); g.strokeStyle = 'rgba(40,18,14,0.5)'; g.lineWidth = 0.4; for (let k = -60; k < 60; k += 2.5) { g.beginPath(); g.moveTo(DRILL.x0 + k, DRILL.z0); g.lineTo(DRILL.x0 + k + 50, DRILL.z1); g.moveTo(DRILL.x1 - k, DRILL.z0); g.lineTo(DRILL.x1 - k - 50, DRILL.z1); g.stroke(); } g.restore();
  g.strokeStyle = '#e2b02a'; g.lineWidth = 1.2; g.strokeRect(DRILL.x0 + 0.6, DRILL.z0 + 0.6, 48.8, 48.8);
  g.fillStyle = '#2a2c30'; g.beginPath(); g.arc(CX, CZ, 9, 0, TAU); g.fill(); g.strokeStyle = '#e2b02a'; g.lineWidth = 1.2; g.beginPath(); g.arc(CX, CZ, 9, 0, TAU); g.stroke(); g.strokeStyle = '#8a9096'; g.lineWidth = 0.6; g.beginPath(); g.arc(CX, CZ, 5, 0, TAU); g.stroke();
  // (the kickers)
  grip(A.x0, LANE.z0, KICK.top + KICK.run, LANE.z1 - LANE.z0); grip(B.x1 - KICK.top - KICK.run, LANE.z0, KICK.top + KICK.run, LANE.z1 - LANE.z0);
  for (let k = 0; k < 3; k++) { chev(A.x0 + KICK.run - 2 - k * 8, CZ, -1, 9); chev(B.x1 - KICK.run + 2 + k * 8, CZ, 1, 9); }
  hazard(A.x0, LANE.z0, KICK.top, LANE.z1 - LANE.z0, 2); hazard(B.x1 - KICK.top, LANE.z0, KICK.top, LANE.z1 - LANE.z0, 2);
  // (the helipad and its ramp: the circle, the H, the rig's name)
  grip(HRAMP.x0, HELI.z1, HRAMP.x1 - HRAMP.x0, HRAMP.run); for (let k = 0; k < 3; k++) { g.save(); g.translate((HRAMP.x0 + HRAMP.x1) / 2, HELI.z1 + HRAMP.run - 6 - k * 9); g.rotate(-E); chev(0, 0, 1, 10); g.restore(); }
  g.fillStyle = '#2c5646'; g.fillRect(...R4(HELI));
  g.strokeStyle = '#e8e6de'; g.lineWidth = 1.6; g.strokeRect(HELI.x0 + 2.5, HELI.z0 + 2.5, 75, 75);
  g.strokeStyle = '#e2b02a'; g.lineWidth = 3; g.beginPath(); g.arc(SUPER.x, SUPER.z, 27, 0, TAU); g.stroke();
  g.fillStyle = '#e8e6de'; g.fillRect(SUPER.x - 12, SUPER.z - 15, 5, 30); g.fillRect(SUPER.x + 7, SUPER.z - 15, 5, 30); g.fillRect(SUPER.x - 12, SUPER.z - 2.5, 24, 5);
  g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BLACKWATER 7', SUPER.x, HELI.z1 - 7);
  // the crane's swing: a hatched ring where its container goes round
  g.save(); g.beginPath(); g.rect(...R4(A)); g.clip();
  g.strokeStyle = 'rgba(184,50,42,0.3)'; g.lineWidth = CRANE.r1 - CRANE.r0 + 6; g.beginPath(); g.arc(CRANE.x, CRANE.z, (CRANE.r0 + CRANE.r1) / 2, 0, TAU); g.stroke();
  g.strokeStyle = '#e2b02a'; g.lineWidth = 1; g.setLineDash([4, 3]); for (const r of [CRANE.r0 - 3.5, CRANE.r1 + 3.5]) { g.beginPath(); g.arc(CRANE.x, CRANE.z, r, 0, TAU); g.stroke(); } g.setLineDash([]);
  g.restore();
  g.fillStyle = '#2a2c30'; g.beginPath(); g.arc(CRANE.x, CRANE.z, 8, 0, TAU); g.fill();
  // oil round the drill floor's feet, and stains where things are stood
  for (let i = 0; i < 26; i++) { const a = rand() * TAU, d = 30 + rand() * 46, x = CX + Math.cos(a) * d * 1.3, z = CZ + Math.sin(a) * d * 0.7; if (!inR(A, x, z)) continue; g.fillStyle = `rgba(14,14,16,${0.14 + rand() * 0.22})`; g.beginPath(); g.ellipse(x, z, 3 + rand() * 7, 2 + rand() * 4, rand() * 3, 0, TAU); g.fill(); }
  // rings round the barrels, the boost plates, a ring under each pickup
  for (const p of BARRELS.spots) { g.strokeStyle = '#c23b2e'; g.lineWidth = 0.8; g.setLineDash([1.5, 1.5]); g.beginPath(); g.arc(p.x, p.z, 3.4, 0, TAU); g.stroke(); g.setLineDash([]); }
  for (const b of BOOSTS) {
    g.fillStyle = '#1d3f6e'; g.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    const dir = Math.sin(b.yaw) > 0 ? 1 : -1, mz = (b.z0 + b.z1) / 2, hw = (b.z1 - b.z0) / 2 - 1.5;
    for (let x = b.x0 + 6; x < b.x1 - 4; x += 9) chev(x, mz, dir, hw, '#5fc8ff');
  }
  for (const p of PICKUP_SPOTS) { const k = PICKUPS[p.kind]; g.strokeStyle = k.css; g.lineWidth = 1.1; g.beginPath(); g.arc(p.x, p.z, 6, 0, TAU); g.stroke(); g.globalAlpha = 0.22; g.fillStyle = k.css; g.fill(); g.globalAlpha = 1; }
  // a dark line along every side a raised deck or a ramp falls away at (the floor's mesh draws each as a sheer face)
  g.fillStyle = '#2b3034';
  for (const p of DIRT.pieces) { if (!p.h) continue; if (p.n === 0) g.fillRect(p.bx0, p.z0 - 0.4, p.bx1 - p.bx0, 0.8); if (p.s === 0) g.fillRect(p.bx0, p.z1 - 0.4, p.bx1 - p.bx0, 0.8); if (p.w === 0) g.fillRect(p.x0 - 0.4, p.bz0, 0.8, p.bz1 - p.bz0); if (p.e === 0) g.fillRect(p.x1 - 0.4, p.bz0, 0.8, p.bz1 - p.bz0); }
  // what the ground is, in the alpha: hard everywhere, and water standing in the dips
  g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, WX, WZ);
  for (const D of [A, B]) for (let i = 0; i < (D === A ? 26 : 12); i++) {
    const x = D.x0 + 12 + rand() * (D.x1 - D.x0 - 24), z = D.z0 + 12 + rand() * (D.z1 - D.z0 - 24), rx = 4 + rand() * 11, rz = 2.5 + rand() * 6;
    if (DIRT.floor(x, z) > 0 || DIRT.floor(x + rx, z) > 0 || DIRT.floor(x - rx, z) > 0 || Math.abs(z - CZ) < 20 + rz) continue;
    g.beginPath(); g.ellipse(x, z, rx, rz, rand() * 3, 0, TAU); g.fill();
  }
  g.restore();
  I();
  if (!PHONE) return c.cv;
  const half = document.createElement('canvas'); half.width = c.cv.width >> 1; half.height = c.cv.height >> 1;
  const h = half.getContext('2d'); h.imageSmoothingQuality = 'high'; h.drawImage(c.cv, 0, 0, half.width, half.height);
  c.cv.width = c.cv.height = 1;
  return half;
}

// ---- routes ------------------------------------------------------------------------------------------------------------
// (as the arena's: the route grid shuts its cells under the crane's container always and along a jet while it is lit or
// lighting, and a line to a waypoint must not cut across one)
const nav = makeGridNav({ cell: 4, maxNodes: 16000, side: 6, also: shut });
const NC = nav.NX * nav.NZ, cellX = (i) => (i % nav.NX + 0.5) * nav.cell, cellZ = (i) => (Math.floor(i / nav.NX) + 0.5) * nav.cell;
const dyn = new Uint8Array(NC), dynWas = new Uint8Array(NC);
let zones = null;
function makeZones() {
  const where = (f) => { const o = []; for (let i = 0; i < NC; i++) if (!nav.blocked[i] && f(cellX(i), cellZ(i))) o.push(i); return o; };
  const L = JETS.len * 1.3;
  zones = {
    crane: where((x, z) => { const d = Math.hypot(x - CRANE.x, z - CRANE.z); return d < CRANE.r1 + 9 && d > CRANE.r0 - 8; }),
    jets: JETS.jets.map((j) => where((x, z) => { const px = x - j.x, pz = z - j.z, al = px * Math.cos(j.a) + pz * Math.sin(j.a), off = Math.abs(px * Math.sin(j.a) - pz * Math.cos(j.a)); return al > -4 && al < L + 3 && off < 9; })),
  };
}
const shown = new Uint8Array(NC), gridR = gridRadar({ NX: nav.NX, NZ: nav.NZ, blocked: shown });
let shownT = 0;
function routeStep(dt) {
  nav.step(dt);
  if (!zones) makeZones();
  dynWas.set(dyn); dyn.fill(0);
  for (const i of zones.crane) dyn[i] = 1;
  JETS.jets.forEach((j, k) => { if (j.on) for (const i of zones.jets[k]) dyn[i] = 1; });
  for (let i = 0; i < NC; i++) { if (dyn[i]) nav.blocked[i] = 1; else if (dynWas[i]) nav.blocked[i] = 0; }
  // (the radar draws what stands on the decks: not the sea, and not the hazards' stand-in walls)
  if ((shownT -= dt) <= 0) { shownT = 1; for (let i = 0; i < NC; i++) shown[i] = nav.blocked[i] && !dyn[i] && onDeck(cellX(i), cellZ(i)) && !noGo[(cellZ(i) / SG | 0) * SGX + (cellX(i) / SG | 0)] ? 1 : 0; }
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
  if (nav.blocked[nav.cellOf(c.x, c.z)]) return nearestOpen(c, tx, tz, o);   // (under the container, or out past a broken rail: back to open deck first)
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
    if (lineClear(c.x, c.z, x, z, 3, 6) && runClear(c.x, c.z, x, z)) { far = i; break; }
  }
  const n = P[far >= 0 ? far : near >= 0 ? near : Math.max(0, P.length - 2)]; o.x = cellX(n); o.z = cellZ(n);
  return o;
}

// ---- the sea takes them ------------------------------------------------------------------------------------------------
// Whatever goes off a deck falls to the sea and is gone in a splash. A car still running is wrecked there (main.js's
// wreck() skips its blast for one MAP.sunk says is in the sea), and the wreck goes to whoever hit it in the last few
// seconds (the mode's credit) or, failing that, to whoever was last pushing against it.
function overboard(api) {
  let now = 0, flameT = 0;
  const splash = (x, z) => {
    dustWave(x, SEA + 1.5, z, 34, 19, 1.5, 0.75, 0.8, 0.86, 0.9); dust(x, SEA + 2, z, 26, 9, 0.82, 0.88, 0.92);
    for (let k = 1; k <= 4; k++) dust(x, SEA + 2 + k * 4.5, z, 12 - k * 2, 5 - k * 0.6, 0.86, 0.9, 0.94);   // (a column of spray)
    api.sound('c.hiss', 1, x, 0, z); api.sfx.play('whoosh', 1, x, z, { rate: 0.55 }); api.sound('thud', 0.9, x, 0, z);
  };
  // shots strike the raised decks' sides (they are the floor's, not voxels)
  api.extras.push({
    solid(x, y, z) { return y > 0.3 && y < 11 && x > DRILL.x0 - DRILL.run && onDeck(x, z) && DIRT.floor(x, z) > y + 0.2; },
    hit(p) { if (!this.solid(p.x, p.y, p.z)) return false; sparks(p.x, p.y, p.z, 4, 1, 0.8, 0.4, 14); return true; },
    explosion() {},
  });
  const pix = api.pix, from = { x: FLARE.x + 0.5, y: FLARE.top + 2.5, z: FLARE.z + 0.5 }, dir = { x: 0.5, y: 0.8, z: 0.24 };
  return {
    step(dt, live) {
      now += dt;
      // the flare: a flame off the stack's tip, leaning down the wind, taller in a burn-off
      if (pix) { const big = SHOW.event === 'burn'; flameT += dt; pix.jet(from, dir, big ? 30 : 17, dt, big ? 3.2 : 2.2, flameT, 0, 0, big ? 0.9 : 0.5); }
      if (!live) return;
      const cars = api.cars;
      // who is pushing whom: any two cars touching mark each other
      for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j]; if (a.gone || b.gone || a.dead || b.dead) continue;
        if (Math.hypot(a.x - b.x, a.z - b.z) > a.half + b.half + 1.5 || Math.abs(a.h - b.h) > 5) continue;
        a._pushBy = b; a._pushT = now; b._pushBy = a; b._pushT = now;
      }
      // a squall: every car on the decks is shoved down the wind (the wrecks too)
      if (SHOW.event === 'squall') for (const c of cars) { if (c.gone || c.remote || c.h < -1) continue; const k = SQUALL.push * dt * (c.y > 0.5 ? 1.6 : 1); c.x += SQUALL.dir[0] * k; c.z += SQUALL.dir[1] * k; }
      for (const c of cars) {
        if (c.gone || c._sunk || c.h > SEA + 3) continue;
        c._sunk = true; splash(c.x, c.z);
        if (c.dead) { c.sunk = true; continue; }   // (a wreck that slid off)
        if (c.remote) continue;                    // (someone else's car: their own device wrecks it)
        if (!c.lastBy && c._pushBy && !c._pushBy.gone && c._pushBy !== c && now - c._pushT < 4) c.lastBy = c._pushBy;
        if (c === api.player) api.toast('Overboard!', c.lastBy ? `${c.lastBy.name} put you in the sea` : 'Nothing round the decks but a handrail');
        api.wreck(c, null);
      }
    },
  };
}

// ---- the rig's body, the crane -----------------------------------------------------------------------------------------
// the legs: [x, z, half width], the main deck's four and one under its middle, the west deck's four, one under the helipad
const LEGS = [[378, 438, 6], [646, 438, 6], [378, 586, 6], [646, 586, 6], [512, 512, 5], [206, 442, 5], [296, 442, 5], [206, 582, 5], [296, 582, 5], [632, 352, 4]];
const BRACES = [[0, 1], [2, 3], [0, 2], [1, 3], [5, 6], [7, 8], [5, 7], [6, 8]];
function body(api) {
  const g = rigBody({
    sea: SEA, decks: DECKS.filter((D) => D.depth), legs: LEGS, braces: BRACES, boom: BOOM, heli: HELI, pool: POOL,
    girders: [[A.x0 + 6, 436, A.x1 - 6, 440], [A.x0 + 6, 560, A.x1 - 6, 564], [448, A.z0 + 6, 452, A.z1 - 6], [590, A.z0 + 6, 594, A.z1 - 6], [B.x0 + 6, 510, B.x1 - 6, 514], [249, B.z0 + 6, 253, B.z1 - 6]],
    raised: [
      { h: DRILL.h, sides: [[DRILL.x0, DRILL.z0 - 0.14, DRILL.x1, DRILL.z0 + 0.3], [DRILL.x0, DRILL.z1 - 0.3, DRILL.x1, DRILL.z1 + 0.14]] },
      { h: KICK.h, sides: [[A.x0 + 0.05, LANE.z0 - 0.14, A.x0 + KICK.top, LANE.z0 + 0.3], [A.x0 + 0.05, LANE.z1 - 0.3, A.x0 + KICK.top, LANE.z1 + 0.14], [B.x1 - KICK.top, LANE.z0 - 0.14, B.x1 - 0.05, LANE.z0 + 0.3], [B.x1 - KICK.top, LANE.z1 - 0.3, B.x1 - 0.05, LANE.z1 + 0.14]] },
    ],
    boats: [[430, A.z1, 0], [590, A.z1, 0], [470, A.z0, Math.PI], [B.x0 + 60, B.z0, Math.PI], [B.x0 + 60, B.z1, 0]],
  });
  const paintMesh = new THREE.Mesh(g.paint, rigMat()); paintMesh.castShadow = false; paintMesh.receiveShadow = true; paintMesh.matrixAutoUpdate = false; paintMesh.frustumCulled = false;
  const lit = new THREE.Mesh(g.lit, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })); lit.matrixAutoUpdate = false; lit.frustumCulled = false;
  api.scene.add(paintMesh, lit);
}

export default {
  id: 'rig', name: 'Blackwater Rig', mode: 'brawl',
  blurb: 'An oil platform in a storm, thirty voxels over the sea, and nothing round its decks but a handrail that breaks. A car that goes in is wrecked: ram them over the side. The drill floor, the helipad with the strike on it, a jump over the gap between the decks, the crane\'s swinging container and the flare boom\'s burn-off.',
  loading: ['Raising the rig out of the sea', 'Welding the decks and the handrails', 'Lighting the flare'],
  outer: 0x10181c,
  backdrop: {
    kind: 'sea', seed: 7070, x: CX, z: CZ, view: { x: CX, z: CZ }, sea: SEA, water: 0x16323a, wind: SQUALL.dir,
    legs: LEGS, flare: [FLARE.x, FLARE.z], decks: DECKS.map((D) => [D.x0, D.z0, D.x1, D.z1]), holes: [[POOL.x0, POOL.z0, POOL.x1, POOL.z1]],
    field: [{ x: -520, z: 60, k: 1.5, yaw: 0.5 }, { x: 1560, z: 1250, k: 1.7, yaw: 2.4 }, { x: 900, z: -900, k: 1.6, yaw: 1.2 }],
    ships: [{ x: 470, z: 880, yaw: 0.25, k: 1.1 }], buoys: 12,
  },
  build() {
    ctx.L = 2; seed = 24680;
    quarters(); derrick(); flareStack(); cranePost();
    finish();
  },
  ground: () => { seed = 97531; return paint(); },
  floor: (x, z) => floor(x, z), floorMesh, ledges: true,
  groundDetail: { hard: true, wet: 0.7, fade: 20 },   // steel plate in the rain: the hard ground's grain, its shine and the rubber cars lay (ground.js)
  rutBox: [B.x0 - 2, HELI.z0 - 2, BOOM.x1 + 2, A.z1 + 2],
  sea: SEA, drop: (x, z) => !onDeck(x, z), sunk: (c) => c.h < SEA + 8,   // (ai.js: where there is nothing under a car; main.js: a car that is in the sea)
  spawn: { x: 450, z: 556, yaw: Math.atan2(CX - 450, CZ - 556) },
  spots: SPOTS,
  pit: { x: CX, z: CZ },
  waypoint, runClear,
  spawnPoint: (player, taken) => pickSpot(SPOTS, player, taken),
  step: routeStep,
  pickups: PICKUP_SPOTS,
  stalls: () => stalls, dirt: DIRT, onDeck,   // (for the tests)
  // the base's storm (looks/storm.js): the floodlight masts, the flare's fire and the red lamps on the derrick's crown
  // and the quarters' mast; no searchlights. What it lays flat on the ground stops at the decks' edges (floorMask), and
  // its mist lies on the sea
  look: {
    kind: 'storm', middle: [CX, CZ], towers: [],
    fires: [[FLARE.x + 0.5, FLARE.top + 2, FLARE.z + 0.5, 3.4]],
    beacons: [[CX + 0.5, DERRICK.top + 10.5, CZ + 0.5], [200.5, QUARTERS.h + 32.5, CZ + 0.5]],
    pools: [], banks: BANKS,
    ring: { x: (B.x0 + BOOM.x1) / 2, z: (HELI.z0 + A.z1) / 2, hx: (BOOM.x1 - B.x0) / 2 + 2, hz: (A.z1 - HELI.z0) / 2 + 2, r: 2 },
    floorGeo() { const F = floorMesh(), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(F.position, 3)); g.setIndex(new THREE.BufferAttribute(F.index, 1)); return g; },
    floorMask: { decks: DECKS.map((D) => [D.x0, D.z0, D.x1, D.z1]), holes: [[POOL.x0, POOL.z0, POOL.x1, POOL.z1]] },
    mistY: SEA + 2.5,
  },
  // (the custom one first: it makes the crane's model, which the sweeper after it hangs on its hub)
  hazards: [
    { kind: 'custom', make(api) {
      for (const o of THINGS) o.dead = false;
      SWEEP.geo = { hub: craneHub(CRANE.top), arm: craneArm(CRANE.r0, CRANE.r1, CRANE.top, SWEEP.thick) };
      stalls = makeStalls(api, THINGS, POWER, () => 0, [WX, WZ], { heap: railScrap, bots: true });
      body(api);
      const sea = overboard(api);
      return { step(dt, live) { stalls.step(dt); sea.step(dt, live); } };
    } },
    SWEEP, JETS, BARRELS, ...BOOSTS, SHOW,
    // nothing can shove a car into the derrick's legs or the flare stack (steel it could not dig out of)
    ...[[DRILL.x0 + 2.5, DRILL.z0 + 2.5], [DRILL.x1 - 1.5, DRILL.z0 + 2.5], [DRILL.x0 + 2.5, DRILL.z1 - 1.5], [DRILL.x1 - 1.5, DRILL.z1 - 1.5]].map(([x, z]) => ({ kind: 'keepout', x, z, r: 2.1 })),
    { kind: 'keepout', x: CRANE.x, z: CRANE.z, r: 5.4 }, { kind: 'keepout', x: FLARE.x + 0.5, z: FLARE.z + 0.5, r: 4.2 }],
  radarBox: [B.x0 - 14, HELI.z0 - 130, BOOM.x1 + 14, A.z1 + 130],
  // the radar: the decks (the raised ones paler), the hole, what stands, the crane's reach and its container, the jets
  // that are lit, the barrels and pickups that are up, and an event's name while one is on
  radar(R, s, ox, oy, w, h) {
    const X = (x) => ox + x * s, Y = (z) => oy + z * s, T = performance.now() / 1000, blink = (T * 8 | 0) & 1;
    const rect = (D, m = 0) => R.fillRect(X(D.x0 - m), Y(D.z0 - m), (D.x1 - D.x0 + 2 * m) * s, (D.z1 - D.z0 + 2 * m) * s);
    R.fillStyle = 'rgba(120,136,146,0.5)'; for (const D of DECKS) rect(D);
    R.fillStyle = 'rgba(190,200,206,0.4)'; rect(HELI); rect(DRILL); R.fillRect(X(DRILL.x0 - DRILL.run), Y(DRILL.z0), (50 + 2 * DRILL.run) * s, 50 * s);
    R.fillStyle = 'rgba(8,14,18,0.9)'; rect(POOL);
    R.strokeStyle = 'rgba(255,255,255,0.6)'; R.lineWidth = 1; for (const D of DECKS) R.strokeRect(X(D.x0), Y(D.z0), (D.x1 - D.x0) * s, (D.z1 - D.z0) * s);
    gridR(R, s, ox, oy, w, h);
    R.strokeStyle = 'rgba(255,90,60,0.4)'; R.lineWidth = 1; R.beginPath(); R.arc(X(CRANE.x), Y(CRANE.z), CRANE.r1 * s, 0, TAU); R.stroke();
    R.strokeStyle = 'rgba(255,120,50,0.95)'; R.lineWidth = 3;
    { const a = SWEEP.angle || 0; R.beginPath(); R.moveTo(X(CRANE.x + Math.cos(a) * CRANE.r0), Y(CRANE.z + Math.sin(a) * CRANE.r0)); R.lineTo(X(CRANE.x + Math.cos(a) * CRANE.r1), Y(CRANE.z + Math.sin(a) * CRANE.r1)); R.stroke(); }
    R.lineCap = 'round';
    for (const j of JETS.jets) { if (!j.on) continue; R.strokeStyle = j.hot ? 'rgba(255,130,30,0.95)' : 'rgba(255,170,60,0.55)'; R.lineWidth = j.hot ? 3 : 1.5; R.beginPath(); R.moveTo(X(j.x), Y(j.z)); R.lineTo(X(j.x + Math.cos(j.a) * (j.len || JETS.len)), Y(j.z + Math.sin(j.a) * (j.len || JETS.len))); R.stroke(); }
    R.lineCap = 'butt';
    R.fillStyle = 'rgba(255,80,60,0.85)'; for (const b of BARRELS.spots) if (b.up !== false) R.fillRect(X(b.x) - 0.8, Y(b.z) - 0.8, 1.6, 1.6);
    for (const p of PICKUP_SPOTS) { if (!p.up) continue; const big = p.kind === 'super'; R.fillStyle = PICKUPS[p.kind].css; R.beginPath(); R.arc(X(p.x), Y(p.z), big ? (blink ? 4 : 3.2) : 2.2, 0, TAU); R.fill(); }
    if (SHOW.event) {
      R.strokeStyle = blink ? 'rgba(255,60,40,0.95)' : 'rgba(255,200,60,0.95)'; R.lineWidth = 3; R.strokeRect(1.5, 1.5, 147, 147);
      R.font = 'bold 10px sans-serif'; R.textAlign = 'center'; R.textBaseline = 'alphabetic'; R.fillStyle = '#fff';
      R.fillText(`${SHOW.name} ${Math.ceil(SHOW.left)}`, 75, 14); R.textAlign = 'start';
    }
  },
  nav,
};
