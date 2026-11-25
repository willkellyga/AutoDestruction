// Midnight Tokyo: the third city race (Will, 2026-11-24: "one more city map. so we have 3 cities, 2 zombies, and 2
// arenas", then "Tokyo at night"). The plan Will was shown: /mnt/project-files/race-tokyo/tokyo-night-plan.png.
//
// Nothing here is Monster Mayhem's Tokyo but its buildings: the land, the water and every street are laid out for the
// race, and the landmarks (src/tokyo_landmarks.js) stand where the lap wants them. Three laps with the guns on, about
// 4,750 voxels a lap. From the line on Scramble Avenue, heading north:
//   up onto the Shinjuku flyover between the towers and down again, right along Ueno's pond under the cherry trees,
//   Lantern Alley (a slanting back street, the narrow part), Electric Town, left through the Thunder Gate and up the
//   lane to Senso-ji's hall, right over a red arch bridge across the Sumida, round the foot of the Sora Tower, up onto
//   the river expressway (a deck out over the water in two long bends), down on Bay Island and under the Bay Wheel,
//   the Rainbow Bridge back across the bay, the port, north between the legs of the Shiba Tower, all the way round the
//   palace's moat past Tokyo Station, down into the expressway tunnel, and out into the Scramble for a wide hairpin
//   onto the line.
//
// Built the way Capital Circuit is (maps/capital.js): the road's height is maps/heights.js's, the decks and the cut are
// maps/roads.js's, and the course is shut in the whole way round, so only what stands beside it is voxels.
import * as THREE from 'three';
import { WX, WZ, M, place, ctx, setSeed, set, put, box, walls, begin, LOC, vehicles } from '../../../src/world.js';
import { face, text, textW, disc } from '../../../src/kit.js';
import { hipRoof, machiya, zakkyo, shrine } from '../../../src/tokyo_kit.js';
import { SHIBA, SENSO, PALACE, STATION, WHEEL, shibatower, soratower, sensoji, palace, station, baywheel } from '../../../src/tokyo_landmarks.js';
import { METRO, metrohall, mayutower, flamehall } from '../../../src/tokyo_skyline.js';
import { grabModel, statueMesh } from './statue.js';
import { makeBlocks } from './blocks.js';
import { makeGrove } from './trees.js';
import { makeWater } from './water.js';
import { NEON } from '../looks/neon.js';
import { canvasFor, finish, pickSpot, GK } from './common.js';
import { makeTrack, streetLoop, racingLine } from './racetrack.js';
import { gatesFor, gridFor, paintCourse, grassOf, surfaceAt, radarCourse } from './circuit.js';
import { makeHeights } from './heights.js';
import { makeRoads } from './roads.js';
import { dressBridges } from './bridges.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ramp = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const hump = (d, a, b, c, e) => (d <= a || d >= e ? 0 : d < b ? ramp((d - a) / (b - a)) : d <= c ? 1 : ramp((e - d) / (e - c)));

// ---- the land ------------------------------------------------------------------------------------------------------
// North is low z. The Sumida comes down the east side and opens into Tokyo Bay in the south-east; the far bank runs on
// south as Bay Island. West of the river: Shinjuku's towers down the west edge, Ueno's park and pond in the north, the
// temple by the river, the palace in the middle inside its moat with the station facing it, the Shiba Tower in its
// park south of that, the port along the bay and the Scramble in the south-west corner.
const RIVER = { x0: 790, x1: 870 };                                  // the Sumida
const BAY = { x0: 612, x1: 892, z0: 792, cut: 40 };                  // Tokyo Bay: its north-west corner is cut off on the slant
const MOAT = { x0: 326, z0: 356, x1: 534, z1: 564, w: 24 };          // the palace's: a ring of water this wide
const QUAY = { x: 890, z: 195, r: 45 };                              // the round quay the Sora Tower stands on, out into the river
const POND = { x: 300, z: 170, rx: 46, rz: 24 };                     // Ueno's
const onQuay = (x, z) => (x - QUAY.x) ** 2 + (z - QUAY.z) ** 2 < QUAY.r * QUAY.r;
const wet = (x, z) => !onQuay(x, z) && (x >= RIVER.x0 && x < RIVER.x1 && z < BAY.z0 + 8 || (z >= BAY.z0 && x < BAY.x1 && x >= BAY.x0 + Math.max(0, BAY.z0 + BAY.cut - z)));
const inMoat = (x, z) => x >= MOAT.x0 && x < MOAT.x1 && z >= MOAT.z0 && z < MOAT.z1 && !(x >= MOAT.x0 + MOAT.w && x < MOAT.x1 - MOAT.w && z >= MOAT.z0 + MOAT.w && z < MOAT.z1 - MOAT.w);
const inPond = (x, z) => ((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2 < 1;
const land = (x, z) => !wet(x, z);
// the grounds nothing is built on but what belongs there: [x0, z0, x1, z1]
const UENO = [186, 124, 404, 218], PALACE_G = [322, 352, 538, 568], TOWER_G = [344, 674, 516, 846], TEMPLE_G = [636, 0, 776, 240];
const STATION_G = [598, 360, 790, 560], SORA_G = [845, 150, 935, 240], WHEEL_G = [862, 830, 1024, 906], PORT_G = [440, 858, 612, 1024];
const inBox = (b, x, z) => x >= b[0] && x < b[2] && z >= b[1] && z < b[3];
// where the ground is green and the barriers stone: the park, the palace and the tower's park
const leafy = (x, z) => inBox(UENO, x, z) || inBox(PALACE_G, x, z) || inBox(TOWER_G, x, z);
const inPark = (x, z) => leafy(x, z) || inBox(TEMPLE_G, x, z) || inBox(STATION_G, x, z) || inBox(SORA_G, x, z) || inBox(WHEEL_G, x, z) || inBox(PORT_G, x, z);

// The great buildings. The engine builds them small (for a game seen from high up); beside this road they would look
// like models of themselves, so, as in Capital Circuit, each is built once by the engine's own kit, copied out of the
// world and drawn as a model at one and a half to two times the size. Nothing reaches them: the course is shut in.
// [name, builder, the engine's lot, how tall to copy, facing (0 north, 1 east, 2 south, 3 west), times bigger, the
// middle of its ground here (x, z), turned (radians), lifted]
const BIG = [
  ['Shiba Tower', shibatower, SHIBA.S, 200, 0, 2, 430, 760],          // astride the road: the course runs between its legs
  ['Sora Tower', soratower, 40, 256, 0, 2, QUAY.x, QUAY.z],           // in the crook of the bend after the red bridge
  ['Senso-ji', sensoji, SENSO.S, 100, 0, 2, 705, 84, Math.PI],        // the main hall, at the top of the lane, facing down it
  ['Palace', palace, PALACE.S, 90, 1, 1.75, 430, 460],                // inside the moat, its bridge toward the station
  ['Tokyo Station', station, STATION.S, 64, 3, 1.5, 699, 460],        // its long brick front on the moat road
  ['Bay Wheel', baywheel, WHEEL.S, 84, 0, 2, 945, 868, 0, 28],        // astride the road on two halls, the road through its legs
  ['Metro Hall', metrohall, METRO.S, 204, 1, 1.5, 44, 356],           // Shinjuku, beside the flyover
  ['Mayu Tower', mayutower, 42, 172, 0, 2, 216, 440],
  ['Flame Hall', flamehall, 44, 64, 3, 2, 898, 296],
];
// how each is lit at night: [the floodlights' colour on its own colours, the colour of its lit windows (glass, a share
// of them: the fourth number), the glow of its lamps]; the wheel's rim and spokes run through the colours
const LIT = {
  'Shiba Tower': [[1.15, 0.72, 0.36], null, [3.2, 2.2, 0.9]],
  'Sora Tower': [[0.34, 0.52, 1.05], null, [1.8, 2.3, 3.2]],
  'Senso-ji': [[0.85, 0.6, 0.38], null, [3, 2.2, 1]],
  Pagoda: [[0.85, 0.6, 0.38], null, [3, 2.2, 1]],
  Palace: [[0.5, 0.55, 0.68], null, [2.6, 2.2, 1.4]],
  'Tokyo Station': [[0.7, 0.52, 0.36], null, [2.8, 2.2, 1.2]],
  'Bay Wheel': [[1.9, 1.9, 1.9, 1], null, [2.6, 2.6, 2.6]],
  'Metro Hall': [[0.16, 0.18, 0.26], [1.9, 1.7, 1.2, 0.45], [2.6, 2.4, 1.8]],
  'Mayu Tower': [[0.14, 0.24, 0.4], [0.45, 0.9, 1.4, 0.22], [2, 2.4, 3]],
  'Flame Hall': [[0.55, 0.42, 0.2], [1.8, 1.5, 0.9, 0.35], [3, 2.2, 0.8]],
};
// A model's own colours lit as if by floodlights at its foot (statue.js's meshes take the moon and the sky only), and
// its glass lit from inside, a pane here and there.
function floodlit(g, [flood, win]) {
  const mat = g.children[0].material, was = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    was(sh, r);
    sh.uniforms.uFlood = { value: new THREE.Vector4(flood[0], flood[1], flood[2], flood[3] || 0) };
    sh.uniforms.uWin = { value: win ? new THREE.Vector4(...win) : new THREE.Vector4(0, 0, 0, 0) };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 uFlood; uniform vec4 uWin;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 cc = floor(vCell * 0.5 + 0.001); float hh = fract(sin(dot(mod(cc, 89.0), vec3(27.17, 61.3, 43.7))) * 4375.85);
          vec3 fl = uFlood.rgb;
          if (uFlood.w > 0.5) { float a = atan(vCell.y - 84.0, vCell.x) / 6.2832; vec3 hue = 0.5 + 0.5 * cos(6.2832 * (a + vec3(0.0, 0.33, 0.67))); fl *= hue * hue; }
          totalEmissiveRadiance += diffuseColor.rgb * fl; if (uFlood.w > 0.5) diffuseColor.rgb *= 0.3;
          totalEmissiveRadiance += uWin.rgb * step(vColor.r * 1.12, vColor.b) * step(0.2, vColor.b) * step(1.0 - uWin.w, hh); }`);
  };
  mat.customProgramCacheKey = () => 'tokyo-floodlit';
}
const PAGODA = { x: 648, z: 142 };       // Senso-ji's five storeys, taken out of the temple's model to stand beside the lane
const GATE = { x: 705, z: 188 };         // the Thunder Gate, astride the lane (voxels: see thunderGate)
const HALLS = [[881, 846, 913, 890], [977, 846, 1009, 890]];   // what the wheel stands on, either side of the road, as high as it is lifted

// ---- the course ----------------------------------------------------------------------------------------------------
// each corner [x, z, radius of the curve round it]; a leg is the run from one corner to the next, numbered by its first
const LINE_X = 140, LINE_Z = 700, GANTRY_Y = 27;
const COURSE = [
  [LINE_X, LINE_Z, 0],   //  0  the line, on Scramble Avenue: north, up onto the Shinjuku flyover and down
  [140, 90, 55],         //  1  right, along Ueno's pond
  [430, 90, 60],         //  2  half right, Lantern Alley
  [590, 250, 60],        //  3  half left, Electric Town
  [705, 250, 40],        //  4  left, through the Thunder Gate and up the lane
  [705, 120, 40],        //  5  right, in front of the main hall, and the red bridge over the Sumida
  [965, 120, 75],        //  6  right, round the foot of the Sora Tower, then up onto the expressway
  [965, 420, 80],        //  7  half right, out over the river
  [830, 535, 80],        //  8  half left, down the middle of it
  [830, 690, 70],        //  9  half left, off it onto Bay Island
  [945, 805, 60],        // 10  half right, under the Bay Wheel
  [945, 955, 55],        // 11  right, the Rainbow Bridge, then the port
  [430, 955, 50],        // 12  right, north between the legs of the Shiba Tower
  [430, 590, 45],        // 13  right, the moat's south side
  [565, 590, 45],        // 14  left, the station's front
  [565, 330, 45],        // 15  left, the moat's north side
  [295, 330, 45],        // 16  left, its west side, then down into the tunnel
  [295, 890, 60],        // 17  right, the Scramble
  [140, 890, 60],        // 18  right, onto the line
];
const NL = COURSE.length;
// how much room each side of the middle line (the barriers stand just past it)
function widthAt(leg, x, z) {
  switch (leg) {
    case 18: case 0: return z > 560 ? 30 : 24;          // Scramble Avenue and the grid on it, then the flyover
    case 1: return 28;                                  // Ueno
    case 2: return 13;                                  // Lantern Alley
    case 3: return 36;                                  // Electric Town
    case 4: return 22;                                  // the gate and the lane
    case 5: return x > 770 && x < 890 ? 22 : 28;        // the hall's front, the red bridge
    case 6: return z < 250 ? 36 : 25;                   // round the Sora Tower, then the expressway
    case 7: case 8: return 25;
    case 9: return 26;                                  // Bay Island
    case 10: return 26;                                 // under the wheel
    case 11: return x > 590 ? 22 : 28;                  // the Rainbow Bridge, the port
    case 12: return 26;                                 // the Shiba Tower
    case 13: return 28;                                 // the moat
    case 14: return 28;                                 // the station's front
    case 15: return 28;
    case 16: return z < 560 ? 26 : 20;                  // the moat's west side, the tunnel
    case 17: return 40;                                 // the Scramble
    default: return 26;
  }
}
const W_MOST = 40;
// The parts off the flat ground (as maps/capital.js): a deck is a road in the air and a cut one below the ground, from
// one place on the course to another, each [leg, how far along that leg from its first corner].
const PARTS = [
  { name: 'Flyover', kind: 'deck', from: [0, 150], to: [0, 480], h: 14, up: 66, piers: 40, solid: 6 },
  { name: 'Red Bridge', kind: 'deck', from: [5, 58], to: [5, 192], h: 7, up: 40, piers: 44, solid: 4 },
  { name: 'Expressway', kind: 'deck', from: [6, 150], to: [9, 70], h: 16, up: 76, piers: 44, solid: 6 },
  { name: 'Rainbow Bridge', kind: 'deck', from: [11, 60], to: [11, 366], h: 20, up: 84, piers: 60, solid: 6 },
  { name: 'Tunnel', kind: 'cut', from: [16, 250], to: [16, 490], h: -16, up: 72, roof: [[16, 325], [16, 416]], roofY: -1.5 },   // (no slope steeper than a long car can take: vehicle.js STEP_UP)
];
const MARGIN = 6.5;                 // how far inside the room the racing line keeps a car's middle
const GATES = 64;                   // checkpoint gates round the lap

// ---- the course's shape: plain numbers, worked out once ------------------------------------------------------------
let CO = null;
function course() {
  if (CO) return CO;
  const T = makeTrack({ pts: streetLoop(COURSE), halfW: W_MOST, smooth: false, WX, WZ, reach: W_MOST + 14 });
  const { N, X, Z, TX, TZ, K, STEP } = T;
  // which leg each sample is on (the nearest that runs its way), and how far along it
  const leg = new Int16Array(N), far = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let bd = 1e9;
    for (let k = 0; k < NL; k++) {
      const a = COURSE[k], b = COURSE[(k + 1) % NL], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      if ((TX[i] * dx + TZ[i] * dz) / l < 0.7) continue;
      const u = ((X[i] - a[0]) * dx + (Z[i] - a[1]) * dz) / (l * l), t = clamp(u, 0, 1), d = Math.hypot(X[i] - a[0] - dx * t, Z[i] - a[1] - dz * t);
      if (d < bd) { bd = d; leg[i] = k; far[i] = u * l; }
    }
  }
  const find = ([k, t]) => { let bi = 0, bd = 1e9; for (let i = 0; i < N; i++) if (leg[i] === k && Math.abs(far[i] - t) < bd) { bd = Math.abs(far[i] - t); bi = i; } return bi; };
  // the room each side, eased from one width to the next (a voxel of width every two along)
  const raw = new Float32Array(N), W = new Float32Array(N), R = Math.round(60 / STEP);
  for (let i = 0; i < N; i++) raw[i] = widthAt(leg[i], X[i], Z[i]);
  for (let i = 0; i < N; i++) { let m = raw[i]; for (let k = -R; k <= R; k++) m = Math.min(m, raw[T.at(i + k)] + Math.abs(k) * STEP * 0.5); W[i] = m; }
  // on the inside of a bend, no further than short of the middle of the curve
  const WL = W.slice(), WR = W.slice();
  for (let i = 0; i < N; i++) {
    let k = 0; for (let j = -3; j <= 3; j++) { const v = K[T.at(i + j)]; if (Math.abs(v) > Math.abs(k)) k = v; }
    if (Math.abs(k) > 1 / 200) { const A = k > 0 ? WL : WR; A[i] = Math.min(A[i], 1 / Math.abs(k) - 4); }
  }
  T.WL = WL; T.WR = WR;
  // the heights: H at each sample, and what it is on (0 the ground, 1 a deck, 2 a cut)
  const H = new Float32Array(N), on = new Uint8Array(N);
  const span = (from, to) => { const i0 = find(from), n = ((find(to) - i0) % N + N) % N; return { i0, n }; };
  const parts = PARTS.map((p) => {
    const { i0, n } = span(p.from, p.to), D = n * STEP;
    for (let k = 0; k <= n; k++) { const i = T.at(i0 + k); H[i] = p.h * hump(k * STEP, 0, p.up, D - p.up, D); on[i] = p.kind === 'deck' ? 1 : 2; }
    const q = { ...p, i0, n, H, half: (i) => W[i] }, ks = (pl) => ((find(pl) - i0) % N + N) % N;
    if (p.roof) {
      q.roof = [ks(p.roof[0]), ks(p.roof[1])];
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (let k = q.roof[0]; k <= q.roof[1]; k++) { const i = T.at(i0 + k); x0 = Math.min(x0, X[i] - W[i]); x1 = Math.max(x1, X[i] + W[i]); z0 = Math.min(z0, Z[i]); z1 = Math.max(z1, Z[i]); }
      q.roofBox = [x0, z0, x1, z1];   // (the Metro runs along z)
    }
    if (p.open) { q.open = [ks(p.open[0]), ks(p.open[1])]; const a = T.at(i0 + q.open[0]), b = T.at(i0 + q.open[1]); q.openZ = [Math.min(Z[a], Z[b]), Math.max(Z[a], Z[b])]; }
    return q;
  });
  return (CO = { T, leg, far, W, H, on, parts, find });
}
// how high the road is, anywhere (heights.js)
let HT = null;
function heights() {
  if (HT) return HT;
  const { T, W, H, parts } = course(), hm = makeHeights();
  for (const p of parts) hm.lay(T, H, p.i0, p.i0 + p.n, (i) => W[i], { kind: p.kind, top: 4 });
  return (HT = hm);
}
// what is taken, a voxel at a time: `road` the course on the ground (not the decks over it or the cut under it), `used`
// the whole course and a little either side (nothing is built there), `cut` the cut's own floor
let MK = null;
function masks() {
  if (MK) return MK;
  const { T, on } = course(), { N, X, Z, TX, TZ, STEP, WL, WR } = T, road = new Uint8Array(WX * WZ), used = new Uint8Array(WX * WZ), cut = new Uint8Array(WX * WZ), wide = new Uint8Array(WX * WZ);
  for (let i = 0; i < N; i++) {
    const j = T.at(i + 1);
    for (let a = 0; a < STEP; a += 0.5) {
      const t = a / STEP, cx = X[i] + (X[j] - X[i]) * t, cz = Z[i] + (Z[j] - Z[i]) * t;
      for (let l = -(WR[i] + 5); l <= WL[i] + 5; l += 0.5) {
        const x = Math.floor(cx + TZ[i] * l), z = Math.floor(cz - TX[i] * l); if (x < 0 || z < 0 || x >= WX || z >= WZ) continue;
        used[z * WX + x] = 1;
        if (l >= -WR[i] && l <= WL[i]) { if (!on[i]) road[z * WX + x] = 1; else if (on[i] === 2) cut[z * WX + x] = 1; }
      }
    }
  }
  // `wide`: the course and thirty voxels either side of it, where no drawn box stands (the chase camera swings out
  // that far round a bend, and a box has nothing to stop it going inside)
  for (let i = 0; i < N; i++) { const r = Math.max(WL[i], WR[i]) + 30, x0 = Math.max(0, Math.floor(X[i] - r)), x1 = Math.min(WX - 1, Math.ceil(X[i] + r)), z0 = Math.max(0, Math.floor(Z[i] - r)), z1 = Math.min(WZ - 1, Math.ceil(Z[i] + r)); for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if ((x - X[i]) ** 2 + (z - Z[i]) ** 2 < r * r) wide[z * WX + x] = 1; }
  return (MK = { road, used, cut, wide, taken: new Uint8Array(WX * WZ) });
}
// whether a box of ground is free to build on: land, off the course, and nothing planned there yet
function free(x0, z0, x1, z1, park = false) {
  const { used, taken } = masks();
  if (x0 < 10 || z0 < 10 || x1 > WX - 10 || z1 > WZ - 10) return false;
  for (let z = z0; z <= z1; z += 2) for (let x = x0; x <= x1; x += 2) { if (used[z * WX + x] || taken[z * WX + x] || !land(x, z) || (!park && inPark(x, z))) return false; }
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) if (used[z * WX + x] || taken[z * WX + x] || !land(x, z) || !land(x + (x === x0 ? -3 : 3), z + (z === z0 ? -3 : 3))) return false;
  return true;
}
const take = (x0, z0, x1, z1) => { const { taken } = masks(); for (let z = Math.max(0, z0); z <= Math.min(WZ - 1, z1); z++) taken.fill(1, z * WX + Math.max(0, x0), z * WX + Math.min(WX - 1, x1) + 1); };

// ---- the rest, for the race: the racing line, gates and grid --------------------------------------------------------
let TR = null;
function full() {
  if (TR) return TR;
  const { T, H } = course(), { N, WL, WR } = T;
  const lo = new Float32Array(N), hi = new Float32Array(N);
  for (let i = 0; i < N; i++) { lo[i] = -WR[i] + MARGIN; hi[i] = WL[i] - MARGIN; if (lo[i] > hi[i]) lo[i] = hi[i] = (lo[i] + hi[i]) / 2; }
  const line = racingLine(T, { margin: MARGIN, lo, hi });
  const { gates, gateS } = gatesFor(T, GATES);
  const grid = gridFor(T, -1);   // pole on the right: the first corner, at the top of the avenue, goes right
  const g = { x: LINE_X, z: LINE_Z, y: GANTRY_Y };
  const lights = { x: LINE_X, y: g.y - 2.4, z: LINE_Z + 3.3, yaw: 0, lx: 1, lz: 0 };   // in front of the lights' box, facing the grid (it is south of the line)
  return (TR = { T, P: null, line, gates, gateS, grid, gantry: g, lights, HALF: 27, PIT_HALF: 0, H });
}

// ---- what stands beside the course -----------------------------------------------------------------------------------
// The barriers: a wall along each edge of the course wherever it runs on the ground, a body every 64 voxels of it.
// Concrete blocks with a red and white top on the streets; in the parks, on the Mall and in Virginia a low wall of
// pale stone. On the knoll they stand as high as it does.
function barriers() {
  const { T, H, on } = course(), { N, X, Z, TX, TZ, WL, WR } = T, { road } = masks();
  for (let i0 = 0; i0 < N; i0 += 32) {
    let open = false;
    for (let i = i0; i < Math.min(N, i0 + 32); i++) {
      if (on[i]) continue;
      if (!open) { begin('Barrier', 'barrier', false); open = true; }
      const j = T.at(i + 1), park = leafy(X[i], Z[i]), top = Math.round(H[i]) + (park ? 3 : 4), cap = park ? M.MARBLE : Math.floor(i / 3) & 1 ? M.CAR_A : M.TRIM, m = park ? M.GRANITE : M.CONC;
      for (const sd of [1, -1]) for (let a = 0; a < 1; a += 0.25) {
        const cx = X[i] + (X[j] - X[i]) * a, cz = Z[i] + (Z[j] - Z[i]) * a, nx = TZ[i] + (TZ[j] - TZ[i]) * a, nz = -(TX[i] + (TX[j] - TX[i]) * a);
        const w = sd > 0 ? WL[i] + (WL[j] - WL[i]) * a : WR[i] + (WR[j] - WR[i]) * a;
        for (const d of [1.2, 1.9, 2.6]) {
          const x = Math.floor(cx + nx * sd * (w + d)), z = Math.floor(cz + nz * sd * (w + d));
          if (x < 2 || z < 2 || x >= WX - 2 || z >= WZ - 2 || road[z * WX + x]) continue;
          for (let y = 0; y < top; y++) put(x, y, z, m);
          put(x, top, z, cap);
        }
      }
    }
  }
}
// The rows of buildings that face the course: along each straight run, each side, a lot every 44 where there is land
// for one and no park (and down the two diagonal avenues, a staircase of them). What each is depends on the part of
// The start gantry across a course that runs along z (maps/circuit.js's is for one along x): two steel towers either
// side of the avenue, a beam with the race's name on both faces, and the box the race mode hangs its start lights in
// front of, on the beam's south side, where the grid is.
function gantryNS(lineZ, x0, x1, names, y) {
  const z0 = lineZ - 1, z1 = lineZ + 2, xc = (x0 + x1) >> 1;
  begin('Start gantry', 'gantry', true);
  for (const tx of [x0, x1 - 2]) {
    for (let yy = 0; yy < y; yy++) for (const [a, b] of [[0, 0], [0, 3], [2, 0], [2, 3]]) set(tx + a, yy, z0 + b, M.STEEL);
    for (let yy = 0; yy < y; yy += 4) { box(tx, yy, z0, tx, yy, z1, M.METAL); box(tx + 2, yy, z0, tx + 2, yy, z1, M.METAL); }
    box(tx - 1, 0, z0 - 1, tx + 3, 0, z1 + 1, M.CONC);
  }
  walls(x0, y, z0, x1, y + 6, z1, M.DARK); box(x0, y + 6, z0, x1, y + 6, z1, M.TRIM);
  for (const s of ['f', 'b']) {
    const F = face(s, x0, z0, x1, z1);
    for (const name of names) if (textW(name) + 6 <= F.W) { text(F, name, (F.W - textW(name)) >> 1, y + 1, 0, M.LIT_W); break; }
  }
  box(xc - 13, y - 4, z1 - 1, xc + 13, y - 1, z1, M.DARK);
}
// The Thunder Gate, astride the lane at the road's own scale and in voxels, so it can be shot at and driven into: a bay
// either side of the road, the great beam across, a tiled roof over all of it, and the red lantern hung in the middle.
function thunderGate(cx, z0) {
  const OP = 26, BAY = 14, z1 = z0 + 11, TOP = 34, x0 = cx - OP - BAY, x1 = cx + OP + BAY - 1;
  begin('Thunder Gate', 'monument');
  for (const s of [-1, 1]) {
    const a0 = s > 0 ? cx + OP : x0, a1 = a0 + BAY - 1;
    box(a0 - 1, 0, z0 - 1, a1 + 1, 1, z1 + 1, M.STONE);
    walls(a0, 2, z0, a1, TOP - 1, z1, M.VERMIL);
    for (const a of [a0, a1 - 1]) for (const b of [z0, z1 - 1]) box(a, 2, b, a + 1, TOP - 1, b + 1, M.VERMIL);
    for (let y = 6; y <= TOP - 7; y++) {
      for (let a = a0 + 2; a <= a1 - 2; a++) { set(a, y, z0, (a + y) & 1 ? M.DARK : M.ROOF_G); set(a, y, z1, M.PL_W); }
      for (let b = z0 + 2; b <= z1 - 2; b++) { set(a0, y, b, M.PL_W); set(a1, y, b, M.PL_W); }
    }
    for (const y of [5, TOP - 6]) { box(a0, y, z0, a1, y, z0, M.BRASS); box(a0, y, z1, a1, y, z1, M.BRASS); }
    for (const b of [z0 - 1, z1 + 1]) box(a0 + 3, 2, b, a1 - 3, 2, b, M.LIT_Y);   // the floodlights at its foot
  }
  box(x0, TOP, z0, x1, TOP + 3, z1, M.VERMIL);
  for (const b of [z0, z1]) { box(cx - OP, TOP - 3, b, cx + OP - 1, TOP - 1, b, M.VERMIL); box(cx - OP, TOP - 4, b, cx + OP - 1, TOP - 4, b, M.BRASS); }
  box(cx - 8, TOP - 2, z0 - 1, cx + 7, TOP + 4, z0 - 1, M.DARK); box(cx - 8, TOP - 2, z1 + 1, cx + 7, TOP + 4, z1 + 1, M.DARK);
  for (const b of [z0 - 2, z1 + 2]) for (const [a, y, w, h] of [[-6, 3, 3, 1], [-6, 0, 1, 3], [-4, 0, 1, 2], [-1, 0, 1, 4], [-2, 2, 3, 1], [2, 0, 3, 1], [2, 2, 3, 1], [3, 0, 1, 4], [5, 3, 1, 1]]) box(cx + a, TOP - 1 + y, b, cx + a + w - 1, TOP - 1 + y + h - 1, b, M.LIT_Y);
  hipRoof(x0, z0, x1, z1, TOP + 4, 7, M.ROOF_S, M.ROOF_D, 2);
  // the lantern: red paper between black hoops, a brass foot
  const lz = (z0 + z1 + 1) >> 1, Y0 = 19, Y1 = TOP - 5;
  box(cx - 1, Y1, lz - 1, cx, TOP - 1, lz, M.DARK);
  for (let y = Y0; y <= Y1; y++) { const e = Math.min(y - Y0, Y1 - y); disc(cx, lz, y, e === 0 ? 4 : e === 1 ? 5 : 6, e < 2 ? M.DARK : M.LIT_R); }
  disc(cx, lz, Y0 - 1, 3, M.BRASS);
  for (let y = Y0 + 3; y <= Y1 - 3; y++) for (const a of [-1, 0]) if (y % 3) { set(cx + a, y, lz - 6, M.DARK); set(cx + a, y, lz + 5, M.DARK); }
}
// The street lamps: one every fifty voxels or so, on alternate sides, a post outside the barrier (on a deck, on its
// parapet) with its head out over the road's edge; in the tunnel, amber lamps along both walls under the roof. Each is
// a glow and a pool of light for the look (looks/neon.js) and, but in the tunnel, a post in the drawn stonework.
// [x, y, z, colour, the glow's size, its pool (none on a slope): [x, z, radius across the road, along it, the way along (x, z), the road's height], the post's foot]
const WHITE = [1.9, 2.0, 2.35], WARM = [2.4, 1.75, 0.95], AMBER = [2.5, 1.35, 0.4];
let LAMPS = null;
function lamps() {
  if (LAMPS) return LAMPS;
  const { T, H, on, leg, W } = course(), { N, X, Z, TX, TZ, STEP } = T, tun = P('Tunnel'), r0 = tun.i0 + tun.roof[0], r1 = tun.i0 + tun.roof[1], L = [];
  const roofed = (i) => { const k = ((i - r0) % N + N) % N; return k <= r1 - r0; };
  const every = Math.round(52 / STEP), wall = Math.round(15 / STEP);
  for (let i = 0, side = 1; i < N; i += every, side = -side) {
    if (roofed(i) || leg[i] === 2) continue;                    // (Lantern Alley has its lanterns)
    const j = T.at(i + 1), slope = Math.abs(H[j] - H[i]) / STEP, nx = TZ[i] * side, nz = -TX[i] * side, w = side > 0 ? T.WL[i] : T.WR[i];
    const out = on[i] === 1 ? w + 1 : w + 4.6, base = on[i] === 2 ? 0 : H[i], px = X[i] + nx * out, pz = Z[i] + nz * out, top = base + 21;
    const warm = leg[i] === 4 || leg[i] === 5 || leg[i] === 1;   // the temple's lane and court, and the park
    // (on a deck the pool keeps to the road: it lies along it, as wide as the deck)
    const pool = slope > 0.04 ? null : on[i] ? [X[i], Z[i], W[i] - 0.5, 30, TX[i], TZ[i], H[i]] : [px - nx * 5.5, pz - nz * 5.5, 31, 31, 1, 0, 0];
    L.push([px - nx * 5.5, top - 0.6, pz - nz * 5.5, warm ? WARM : WHITE, 2.5, pool, [px, pz, base, nx, nz]]);
  }
  for (let i = r0; i <= r1; i += wall) { const k = T.at(i); for (const side of [1, -1]) L.push([X[k] + TZ[k] * side * (W[k] - 1.2), H[k] + 11, Z[k] - TX[k] * side * (W[k] - 1.2), AMBER, 1.5, side > 0 ? [X[k], Z[k], W[k] - 0.5, 14, TX[k], TZ[k], H[k]] : null, null]); }
  return (LAMPS = L);
}
// Lantern Alley's lanterns: [x, y, z] each, along both sides just outside the barriers
let LANTERNS = null;
function lanterns() {
  if (LANTERNS) return LANTERNS;
  const a = COURSE[ALLEY.leg], b = COURSE[ALLEY.leg + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, L = [];
  for (let t = 50; t < len - 50; t += 6) for (const sd of [1, -1]) { const o = 13 + 6.5; L.push([a[0] + ux * t + uz * sd * o, 11 + ((t / 6) & 1) * 0.6, a[1] + uz * t - ux * sd * o]); }
  return (LANTERNS = L);
}
// The other glows, and the coloured light they throw on the road: { at, rgb, size, pool: [x, z, radius, height] }
let GLOWS = null;
function glows() {
  if (GLOWS) return GLOWS;
  const L = [], RED = [2.6, 0.5, 0.3], GOLD = [2.4, 1.6, 0.6];
  // Lantern Alley: a red lantern every six voxels each side, hung out from the houses over the pavement
  for (const [x, y, z] of lanterns()) L.push({ at: [x, y, z], rgb: RED, size: 2.6, pool: null });
  // the Thunder Gate: its lantern, and the floodlights at the feet of its bays
  L.push({ at: [GATE.x, 24, GATE.z + 6, ], rgb: RED, size: 9, pool: [GATE.x, GATE.z + 6, 30, 0] });
  for (const s of [-1, 1]) for (const dz of [-3, 15]) L.push({ at: [GATE.x + s * 33, 4, GATE.z + dz], rgb: GOLD, size: 5, pool: [GATE.x + s * 33, GATE.z + dz, 16, 0] });
  return (GLOWS = L);
}
// what stands beside and over the course as a drawn model, each [x0, y0, z0, x1, y1, z1, colour]: the two halls the
// wheel stands on, and the lamps' posts
const CONC = [0.5, 0.5, 0.53], CONC2 = [0.36, 0.36, 0.4], POST = [0.2, 0.21, 0.25], HEAD = [0.95, 0.95, 1];
let STONES = null;
function stones() {
  if (STONES) return STONES;
  const L = [], lift = BIG.find((b) => b[0] === 'Bay Wheel')[9];
  for (const [x0, z0, x1, z1] of HALLS) L.push([x0, 0, z0, x1, lift - 2, z1, CONC2], [x0 - 1.5, lift - 2, z0 - 1.5, x1 + 1.5, lift, z1 + 1.5, CONC]);
  // the lanterns, and the line each side they hang from
  for (const [x, y, z] of lanterns()) L.push([x - 0.8, y - 1.2, z - 0.8, x + 0.8, y + 1.2, z + 0.8, [1.0, 0.22, 0.12]], [x - 0.5, y + 1.2, z - 0.5, x + 0.5, y + 1.6, z + 0.5, POST]);
  for (const [, , , , , , post] of lamps()) {
    if (!post) continue;
    const [x, z, y, nx, nz] = post;
    L.push([x - 0.45, y, z - 0.45, x + 0.45, y + 21, z + 0.45, POST]);
    for (let a = 0; a <= 5; a++) L.push([x - nx * a - 0.4, y + 20.4, z - nz * a - 0.4, x - nx * a + 0.4, y + 21, z - nz * a + 0.4, POST]);
    L.push([x - nx * 5.5 - 0.9, y + 19.9, z - nz * 5.5 - 0.9, x - nx * 5.5 + 0.9, y + 20.4, z - nz * 5.5 + 0.9, HEAD]);
  }
  return (STONES = L);
}
function stoneMesh() {
  const pos = [], col = [], nor = [], idx = [];
  const quad = (P, n, c) => { const i = pos.length / 3; pos.push(...P); for (let k = 0; k < 4; k++) { nor.push(...n); col.push(...c); } idx.push(i, i + 1, i + 2, i, i + 2, i + 3); };
  for (const [x0, y0, z0, x1, y1, z1, c] of stones()) {
    quad([x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], [0, 0, -1], c); quad([x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1], c);
    quad([x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0], c); quad([x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [1, 0, 0], c);
    quad([x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0], [0, 1, 0], c); if (y0 > 0) quad([x0, y0, z1, x0, y0, z0, x1, y0, z0, x1, y0, z1], [0, -1, 0], c.map((v) => v * 0.6));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; m.updateMatrix(); m.name = 'stonework';
  return m;
}

// The trees. Elms in rows down both sides of the Mall, cherries in blossom round the Tidal Basin and down the point,
// woods along Rock Creek and over Virginia, and trees about the parks and the great buildings' grounds. All of them
// are drawn models (maps/trees.js: GROVE on the map, FAR in the woods past its edge, from the backdrop's own shores),
// ---- the city beside the course ---------------------------------------------------------------------------------------
// The parts of town: S Shinjuku and the Scramble (the west side: tall sign buildings and towers), U Ueno (old houses
// and low buildings), A Asakusa round the temple (old houses), E Electric Town (every lot a sign building, as tall as
// they come), M Marunouchi round the palace and the station (offices), T the Shiba side and the port, B Bay Island and
// the east bank
function district(x, z) {
  if (x > 870) return 'B';
  if (x >= 600 && z < 330) return 'A';
  if (z < 250 && x < 600) return x < 200 ? 'S' : 'U';
  if (x < 300) return 'S';
  if (z > 610) return 'T';
  return 'M';
}
// what the signs say (made up, every one), and their colours [board, letters]
const WORDS = ['RAMEN', 'SUSHI', 'CAFE', 'KARAOKE', 'ARCADE', 'MANGA', 'TEA', 'SOBA', 'UDON', 'BAR', 'GAME', 'ANIME', 'TOYS', 'CAMERA', 'RADIO', 'HIFI', 'BOOKS', 'CURRY', 'HOTEL', 'SAKE', 'MODELS', 'TAXI', 'SAUNA', 'CLUB', 'TEMPURA', 'YAKITORI'];
const ROOFW = ['TV', 'FM', 'GO', 'HI', 'OK', 'UP', 'ZEN', 'SKY', 'NEO', 'JOY'];
function kitFor(d, R) {
  const p = (a) => a[Math.floor(R() * a.length)], n = (a, b) => a + Math.floor(R() * (b - a + 1)), r = R();
  const INK = [[M.LIT_R, M.LIT_W], [M.DARK, M.LIT_Y], [M.LIT_W, M.CAR_A], [M.LIT_B, M.LIT_W], [M.DARK, M.LIT_P], [M.LIT_Y, M.DARK], [M.DARK, M.LIT_G], [M.LIT_P, M.LIT_W]];
  const conc = [M.REND_C, M.CONC, M.PL_B, M.PL_W, M.REND_T, M.PL_G, M.LIME2, M.REND_Y], wood = [M.PL_W, M.TRUNK, M.REND_C, M.PL_Y, M.PL_W, M.TRUNK], cloths = [M.AWN_B, M.AWN_R, M.AWN_G, M.AWN_W];
  const sign = () => [p(WORDS), ...p(INK)];
  const zak = (lo, hi) => ['zakkyo', { floors: [n(lo, hi), n(lo, hi), n(lo, hi)], walls: [p(conc), p(conc), p(conc)], signs: [sign(), sign(), sign()], awn: [p(cloths), p(cloths), p(cloths)], roof: p(ROOFW), pole: R() < 0.5, vend: R() < 0.6 ? p([M.LIT_R, M.LIT_B, M.LIT_W, M.CAR_A]) : 0, car: 0, inside: false }];
  const mach = () => ['machiya', { walls: [p(wood), p(wood), p(wood)], cloth: [p(cloths), p(cloths), p(cloths)], tile: p([M.ROOF_S, M.ROOF_S, M.ROOF_D, M.ROOF_G]), tall: R() < 0.35 ? n(0, 2) : -1, pole: true, vend: R() < 0.5 ? p([M.LIT_R, M.LIT_B, M.LIT_W]) : 0, car: 0, inside: false }];
  const holy = () => ['shrine', { tile: p([M.ROOF_G, M.ROOF_S]) }];
  switch (d) {
    case 'E': return zak(6, 9);
    case 'S': return zak(6, 9);
    case 'M': return zak(5, 9);
    case 'U': return r < 0.55 ? mach() : r < 0.63 ? holy() : zak(4, 6);
    case 'A': return r < 0.7 ? mach() : r < 0.78 ? holy() : zak(4, 5);
    default: return zak(4, 8);
  }
}
const KITS = { zakkyo, machiya, shrine };
// the towers that stand off the parks, for the lots to keep off: [x0, z0, x1, z1]
const FEET = [[14, 296, 76, 416], [180, 404, 252, 476], [870, 268, 926, 324]];
// Lantern Alley runs on the slant, and voxel houses cannot: so its houses are drawn (two rows of town houses built once
// by the engine's kit and copied out, as the great buildings are, but at their own size), turned to face the alley.
const ALLEY = { leg: 2, n: 4, step: 42, models: [] };
let PLAN = null;
function plan() {
  if (PLAN) return PLAN;
  const { T, leg } = course(), { N, X, Z, WL, WR } = T, lots = [];
  let s = 20261126; const R = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  for (const f of FEET) take(f[0] - 3, f[1] - 3, f[2] + 3, f[3] + 3);
  const lot = (x0, z0, f, d) => { take(x0 - 2, z0 - 2, x0 + 41, z0 + 41); const [k, opt] = kitFor(d, R); lots.push({ x: x0, z: z0, f, kit: k, o: opt, seed: 4000 + lots.length * 37 }); };
  // Lantern Alley's houses, a row each side
  {
    const a = COURSE[ALLEY.leg], b = COURSE[ALLEY.leg + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, t0 = (len - (ALLEY.n - 1) * ALLEY.step) / 2;
    for (let j = 0; j < ALLEY.n; j++) for (const sd of [1, -1]) {
      const t = t0 + j * ALLEY.step, out = 13 + 3.5 + 20, x = a[0] + ux * t + uz * sd * out, z = a[1] + uz * t - ux * sd * out;
      ALLEY.models.push({ x, z, turn: Math.atan2(uz * sd, -ux * sd), v: (j + (sd > 0 ? 0 : 1)) & 1 });
      take(Math.round(x - 29), Math.round(z - 29), Math.round(x + 29), Math.round(z + 29));
    }
  }
  for (let k = 0; k < NL; k++) {
    const a = COURSE[k], b = COURSE[(k + 1) % NL], c = COURSE[(k + 2) % NL], p = COURSE[(k - 1 + NL) % NL];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, mine = []; for (let i = 0; i < N; i++) if (leg[i] === k) mine.push(i);
    if (Math.abs(ux) > 0.01 && Math.abs(uz) > 0.01) continue;   // (the slanting legs: the alley has its own houses; the rest run over water)
    const trim = (q, m, e) => { const vx = m[0] - q[0], vz = m[1] - q[1], wx = e[0] - m[0], wz = e[1] - m[1], t = Math.atan2(vx * wz - vz * wx, vx * wx + vz * wz); return (m[2] || 0) * Math.tan(Math.abs(t) / 2); };
    const s0 = trim(p, a, b) + 4, s1 = len - trim(a, b, c) - 4;
    // the most room the course has from t0 to t1 along this leg, on one side
    const room = (t0, t1, sd) => { let w = 0; for (const i of mine) { const t = (X[i] - a[0]) * ux + (Z[i] - a[1]) * uz; if (t >= t0 - 3 && t <= t1 + 3) w = Math.max(w, sd > 0 ? WL[i] : WR[i]); } return w; };
    const dx = Math.round(ux), dz = Math.round(uz), n = Math.floor((s1 - s0 + 4) / 44); if (n < 1) continue;
    const start = s0 + (s1 - s0 - (n * 44 - 4)) / 2;
    for (let j = 0; j < n; j++) for (const sd of [1, -1]) {
      const t0 = start + j * 44, t1 = t0 + 39, w = room(t0, t1, sd); if (!w) continue;
      const nx = dz * sd, nz = -dx * sd, o0 = w + 7, o1 = o0 + 39;   // out to the lot's near and far edges
      const xs = [a[0] + dx * t0 + nx * o0, a[0] + dx * t1 + nx * o1], zs = [a[1] + dz * t0 + nz * o0, a[1] + dz * t1 + nz * o1];
      const x0 = Math.round(Math.min(...xs)), z0 = Math.round(Math.min(...zs));
      if (!free(x0, z0, x0 + 39, z0 + 39)) continue;
      lot(x0, z0, nz > 0 ? 0 : nx < 0 ? 1 : nz < 0 ? 2 : 3, k === 3 || k === 17 ? 'E' : district(x0 + 20, z0 + 20));   // its front to the course
    }
  }
  // the city off the course: every block of a grid (104, as the pavement's slabs repeat) filled with buildings wherever
  // there is land that nothing else has taken: towers in Shinjuku and Marunouchi, low in the old town
  const boxes = [], { wide } = masks(), clear = (x0, z0, x1, z1) => { for (let z = z0; z <= z1; z += 4) for (let x = x0; x <= x1; x += 4) if (wide[Math.min(WZ - 1, z) * WX + Math.min(WX - 1, x)]) return false; return !wide[z1 * WX + x1] && !wide[z0 * WX + x1] && !wide[z1 * WX + x0]; };
  const open = (x0, z0, w, d) => free(x0 - 2, z0 - 2, x0 + w + 2, z0 + d + 2) && clear(x0, z0, x0 + w, z0 + d);
  const add = (x0, z0, w, d) => {
    take(x0 - 2, z0 - 2, x0 + w + 2, z0 + d + 2);
    const dd = district(x0 + w / 2, z0 + d / 2), r = R(), q = R(), big = Math.min(w, d) >= 40;
    const h = dd === 'S' ? (big ? 110 + r * 130 : 70 + r * 60) : dd === 'M' ? (big ? 96 + r * 96 : 60 + r * 60) : dd === 'B' ? 60 + r * 110 : dd === 'T' ? 48 + r * 72 : 36 + r * 36;
    const style = dd === 'S' || dd === 'B' ? (q < 0.45 ? 'glass' : q < 0.7 ? 'lime' : q < 0.88 ? 'tan' : 'brown') : dd === 'M' ? (q < 0.4 ? 'lime' : q < 0.7 ? 'glass' : q < 0.9 ? 'marble' : 'tan') : dd === 'T' ? (q < 0.35 ? 'tan' : q < 0.6 ? 'glass' : q < 0.85 ? 'lime' : 'brick') : (q < 0.4 ? 'tan' : q < 0.7 ? 'brown' : q < 0.9 ? 'brick' : 'lime');
    boxes.push({ x0, z0, w, d, h, style, seed: 1 + boxes.length, plain: dd === 'M' && q < 0.6, dd });
  };
  for (let bz = 17; bz < WZ - 40; bz += 104) for (let bx = 17; bx < WX - 40; bx += 104) {
    const k = R();
    if (k < 0.16 && open(bx, bz, 80, 80)) { add(bx, bz, 80, 80); continue; }
    if (k < 0.4) { const ns = R() < 0.5; let got = 0; for (const o of [0, 46]) { const [x, z, w, d] = ns ? [bx + o, bz, 40, 80] : [bx, bz + o, 80, 40]; if (open(x, z, w, d)) { add(x, z, w, d); got++; } } if (got === 2) continue; }
    for (const [qx, qz] of [[0, 0], [46, 0], [0, 46], [46, 46]]) {
      if (open(bx + qx, bz + qz, 40, 40)) { add(bx + qx, bz + qz, 40, 40); continue; }
      for (const sz of [32, 24, 16]) for (let oz = 0; oz + sz <= 40; oz += 8) for (let ox = 0; ox + sz <= 40; ox += 8) if (open(bx + qx + ox, bz + qz + oz, sz, sz)) add(bx + qx + ox, bz + qz + oz, sz, sz);
    }
  }
  // and past the map's edge: the city goes on to the horizon on every side but the bay, a block of 104 with a street
  // of 24 between (as wide as the course: no small streets), taller the further out, and tallest west (Shinjuku) and
  // over the bay (the waterfront towers)
  for (let bz = -728; bz < WZ + 728; bz += 104) for (let bx = -728; bx < WX + 728; bx += 104) {
    if (bx > -88 && bz > -88 && bx < WX + 8 && bz < WZ + 8) continue;
    const out = Math.hypot(Math.max(-bx, 0, bx - WX), Math.max(-bz, 0, bz - WZ)); if (out > 700) continue;
    let dry = true; for (const [a, b] of [[0, 0], [80, 0], [0, 80], [80, 80], [40, 40]]) if (wet(bx + a, bz + b)) dry = false; if (!dry) continue;
    const r = R(), west = bx < 0 ? 1 : 0, tall = 48 + out * 0.18 + r * 70 + west * 60, glassy = R();
    const style = () => (glassy < 0.4 ? 'glass' : glassy < 0.65 ? 'lime' : glassy < 0.85 ? 'tan' : 'brown');
    if (r < 0.3) boxes.push({ x0: bx, z0: bz, w: 80, d: 80, h: tall * 1.3, style: style(), seed: 1 + boxes.length, plain: true });
    else for (const [qx, qz] of [[0, 0], [48, 0], [0, 48], [48, 48]]) if (R() < 0.85) boxes.push({ x0: bx + qx, z0: bz + qz, w: 32, d: 32, h: tall * (0.6 + R() * 0.6), style: style(), seed: 1 + boxes.length, plain: true });
  }
  return (PLAN = { lots, boxes });
}
function rows() {
  for (const L of plan().lots) {
    setSeed(L.seed); ctx.lot = -1; ctx.L = 3;
    place(L.x, L.z, L.f);
    KITS[L.kit](LOC, LOC, 3, L.o);
    place(0, 0, -1);
  }
}
// The trees (maps/trees.js: drawn models, a voxel to a cube): cherries round Ueno's pond and through the park, in the
// Shiba Tower's park and the temple's court, and pines and cherries inside the palace's walls and along its moat.
const GROVE = [];
function trees() {
  let s = 7719; const R = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const tree = (x, z, size, kind = 1) => {
    x = Math.round(x); z = Math.round(z);
    if (!free(x - 9, z - 9, x + 9, z + 9, true) || inPond(x, z) || inMoat(x, z)) return;
    take(x - 5, z - 5, x + 5, z + 5);
    GROVE.push([x + 0.5, z + 0.5, size, R() * 6.28, kind]);
  };
  // a ring of cherries round the pond, then the park
  { const m = 14; for (let k = 0; k < m; k++) { const a = (k + R() * 0.3) / m * Math.PI * 2; tree(POND.x + Math.cos(a) * (POND.rx + 12), POND.z + Math.sin(a) * (POND.rz + 11), 0.95 + R() * 0.2); } }
  // where the great buildings' own trees stood (they are left out of the models: statue.js), one of ours
  for (const m of MODELS) for (const [lx, lz, cherry] of m.vol.trees) {
    const a = (lx - m.vol.S / 2) * m.k, b = (lz - m.vol.S / 2) * m.k, c = Math.cos(m.turn), sn = Math.sin(m.turn);
    tree(m.x + a * c + b * sn, m.z - a * sn + b * c, cherry ? 0.9 + R() * 0.2 : 0.55 * m.k + R() * 0.15, cherry);
  }
  for (let gz = 20; gz < WZ - 16; gz += 26) for (let gx = 20; gx < WX - 16; gx += 26) {
    const x = gx + (R() - 0.5) * 16, z = gz + (R() - 0.5) * 16, r = R(), k = R();
    if (!leafy(x, z)) continue;
    const palace = inBox(PALACE_G, x, z), tower = inBox(TOWER_G, x, z);
    if (tower && Math.abs(x - 430) < 46) continue;                       // (the road, and a clear look up at the tower from it)
    if (r > (palace ? 0.5 : 0.8)) continue;
    tree(x, z, palace && k < 0.6 ? 1 + k * 0.4 : 0.9 + k * 0.25, palace && k < 0.6 ? 0 : 1);
  }
}
const MODELS = [];
function build() {
  for (const [name, make, S, NY, f, k, x, z, turn, lift] of BIG) MODELS.push({ name, vol: grabModel(make, S, NY, 16, 16, f, 2), k, x, z, y: lift || 0, turn: turn || 0 });
  // Senso-ji: its hall stands at the top of the lane; the pagoda is taken out to stand on its own beside the lane; the
  // gate and the court's lanterns go (the gate is built at the road's scale, in voxels)
  {
    const v = MODELS.find((m) => m.name === 'Senso-ji').vol, { S, NY, m } = v, PS = 24, pm = new Uint8Array(PS * NY * PS);
    for (let y = 0; y < NY; y++) for (let z = 0; z < PS; z++) for (let x = 0; x < PS; x++) pm[(y * PS + z) * PS + x] = m[(y * S + z + 18) * S + x + 1];
    for (let y = 0; y < NY; y++) for (let z = 0; z < 42; z++) m.fill(0, (y * S + z) * S, (y * S + z) * S + S);
    v.trees = [];
    MODELS.push({ name: 'Pagoda', vol: { S: PS, NY, m: pm, ped: 0, trees: [] }, k: 2, x: PAGODA.x, z: PAGODA.z, y: 0, turn: 0 });
  }
  // the Bay Wheel: only the wheel and its legs are kept (the road runs under it); and the Shiba Tower's hall, lamp and
  // benches go from between its feet (the road runs there)
  {
    const { S, NY, m } = MODELS.find((q) => q.name === 'Bay Wheel').vol;
    for (let y = 0; y < NY; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) if (y < 2 || z < 36 || z > 49) m[(y * S + z) * S + x] = 0;
  }
  {
    const v = MODELS.find((q) => q.name === 'Shiba Tower').vol, { S, m } = v;
    for (let y = 0; y <= 20; y++) for (let z = 0; z < S; z++) for (let x = 28; x < 58; x++) m[(y * S + z) * S + x] = 0;
  }
  // the Sora Tower's hall goes too: the bend wraps round the tower's own foot
  {
    const { S, m } = MODELS.find((q) => q.name === 'Sora Tower').vol;
    for (let y = 0; y <= 9; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) if (Math.hypot(x + 0.5 - 20, z + 0.5 - 20) > 16.5) m[(y * S + z) * S + x] = 0;
  }
  // Lantern Alley's two rows of houses, copied out to be drawn on the slant
  {
    const walls = [[M.PL_W, M.TRUNK, M.REND_C], [M.TRUNK, M.PL_Y, M.PL_W]], cloth = [[M.AWN_B, M.AWN_R, M.AWN_W], [M.AWN_R, M.AWN_G, M.AWN_B]];
    ALLEY.vols = [0, 1].map((v) => { const vol = grabModel(machiya, 40, 40, 16, 16, 0, 2, { walls: walls[v], cloth: cloth[v], tile: v ? M.ROOF_D : M.ROOF_S, tall: v ? 0 : 2, pole: !v, vend: v ? M.LIT_R : M.LIT_B, car: 0, inside: false }, 1900 + v); vol.trees = []; return vol; });
  }
  plan();
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1; setSeed(5115);
  rows();
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1;
  barriers();
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1;
  thunderGate(GATE.x, GATE.z);
  place(0, 0, -1); ctx.L = 3; ctx.lot = -1;
  vehicles.length = 0;   // nothing parked along the road
  gantryNS(LINE_Z, LINE_X - 33, LINE_X + 33, ['MIDNIGHT TOKYO', 'TOKYO GP'], GANTRY_Y);
  trees();
  finish();
}

// ---- the floor: a grid with the knoll's heights and the pool's, and a hole where the cut is open to the sky -----------
function floorMesh() {
  const hm = heights(), { parts } = course(), { cut } = masks(), G = 8, nx = WX / G, nz = WZ / G, V = (nx + 1) * (nz + 1);
  const position = new Float32Array(V * 3), uv = new Float32Array(V * 2), normal = new Float32Array(V * 3), index = [];
  const hAt = (x, z) => { const c = clamp(Math.floor(z), 1, WZ - 2) * WX + clamp(Math.floor(x), 1, WX - 2); return cut[c] ? 0 : hm.gnd[c]; };
  const roofs = parts.filter((p) => p.roofBox).map((p) => p.roofBox), roofed = (x, z) => roofs.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3]);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const v = j * (nx + 1) + i, x = i * G, z = j * G;
    position[v * 3] = x; position[v * 3 + 1] = hAt(x, z); position[v * 3 + 2] = z; uv[v * 2] = x / WX; uv[v * 2 + 1] = 1 - z / WZ;
    const sx = (hAt(x + 4, z) - hAt(x - 4, z)) / 8, sz = (hAt(x, z + 4) - hAt(x, z - 4)) / 8, l = Math.hypot(sx, 1, sz);
    normal[v * 3] = -sx / l; normal[v * 3 + 1] = 1 / l; normal[v * 3 + 2] = -sz / l;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const cx = i * G + G / 2, cz = j * G + G / 2;
    if (cut[cz * WX + cx] && !roofed(cx, cz)) continue;   // the cut, open to the sky
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  return { position, uv, normal, index: new Uint16Array(index) };
}

// ---- the painted ground -------------------------------------------------------------------------------------------
let grassy = null;
const PHONE = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const WATER = '#1f4f6e', LAWN = '#5d8a52', PAVE = '#8b8984', STONE = '#b9b3a3';
function paint() {
  const { T, grid, line } = full(), { on, H } = course(), FOOT = 3, C = canvasFor(WATER, 4412), { cv, g } = C;
  // the land: everything but the river and the bay, a quay round every shore
  const landPath = () => {
    g.beginPath();
    g.rect(-40 * GK, -40 * GK, (RIVER.x0 + 40) * GK, (WZ + 80) * GK);
    g.rect(RIVER.x1 * GK, -40 * GK, (WX + 40 - RIVER.x1) * GK, (WZ + 80) * GK);
  };
  const bayPath = () => { g.beginPath(); g.moveTo(BAY.x0 * GK, (WZ + 40) * GK); g.lineTo(BAY.x0 * GK, (BAY.z0 + BAY.cut) * GK); g.lineTo((BAY.x0 + BAY.cut) * GK, BAY.z0 * GK); g.lineTo(BAY.x1 * GK, BAY.z0 * GK); g.lineTo(BAY.x1 * GK, (WZ + 40) * GK); g.closePath(); };
  landPath(); g.fillStyle = PAVE; g.fill();
  C.speckle(0, 0, WX, WZ, 90000, ['rgba(255,250,235,0.1)', 'rgba(40,40,44,0.14)']);
  // the city off the course stands on pavement: slabs, a joint every eight (no small streets beside the course)
  g.fillStyle = 'rgba(40,40,44,0.16)';
  for (let v = 0; v < WX; v += 8) { C.rect(v - 0.15, 0, v + 0.15, WZ); C.rect(0, v - 0.15, WX, v + 0.15); }
  // the parks, the pond, and the moat in its stone rim
  g.fillStyle = LAWN; for (const b of [UENO, PALACE_G, TOWER_G]) C.rect(b[0], b[1], b[2], b[3]);
  for (const b of [UENO, PALACE_G, TOWER_G]) C.speckle(b[0], b[1], b[2], b[3], 16000, ['rgba(70,116,60,0.5)', 'rgba(120,160,90,0.4)']);
  g.fillStyle = STONE; g.beginPath(); g.ellipse(POND.x * GK, POND.z * GK, (POND.rx + 2.5) * GK, (POND.rz + 2.5) * GK, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = WATER; g.beginPath(); g.ellipse(POND.x * GK, POND.z * GK, POND.rx * GK, POND.rz * GK, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = STONE; C.rect(MOAT.x0 - 3, MOAT.z0 - 3, MOAT.x1 + 3, MOAT.z1 + 3);
  g.fillStyle = WATER; C.rect(MOAT.x0, MOAT.z0, MOAT.x1, MOAT.z1);
  g.fillStyle = STONE; C.rect(MOAT.x0 + MOAT.w - 3, MOAT.z0 + MOAT.w - 3, MOAT.x1 - MOAT.w + 3, MOAT.z1 - MOAT.w + 3);
  g.fillStyle = LAWN; C.rect(MOAT.x0 + MOAT.w, MOAT.z0 + MOAT.w, MOAT.x1 - MOAT.w, MOAT.z1 - MOAT.w);
  // the plazas' paving: the temple's court, the station's front, the tower's and the wheel's feet, the port's quays
  g.fillStyle = '#9a968c'; for (const b of [TEMPLE_G, STATION_G, SORA_G, WHEEL_G]) C.rect(b[0], b[1], b[2], b[3]);
  g.fillStyle = '#77767a'; C.rect(PORT_G[0], PORT_G[1], PORT_G[2], PORT_G[3]);
  // the river and the bay over all of that, with their quays
  g.fillStyle = WATER; C.rect(RIVER.x0, -40, RIVER.x1, BAY.z0 + 8); bayPath(); g.fill();
  g.strokeStyle = '#5c5a58'; g.lineWidth = 4 * GK; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(RIVER.x0 * GK, -40 * GK); g.lineTo(RIVER.x0 * GK, BAY.z0 * GK); g.lineTo((BAY.x0 + BAY.cut) * GK, BAY.z0 * GK); g.lineTo(BAY.x0 * GK, (BAY.z0 + BAY.cut) * GK); g.lineTo(BAY.x0 * GK, (WZ + 40) * GK); g.stroke();
  g.beginPath(); g.moveTo(RIVER.x1 * GK, -40 * GK); g.lineTo(RIVER.x1 * GK, BAY.z0 * GK); g.lineTo(BAY.x1 * GK, BAY.z0 * GK); g.lineTo(BAY.x1 * GK, (WZ + 40) * GK); g.stroke();
  g.fillStyle = '#5c5a58'; g.beginPath(); g.arc(QUAY.x * GK, QUAY.z * GK, (QUAY.r + 2) * GK, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#9a968c'; g.beginPath(); g.arc(QUAY.x * GK, QUAY.z * GK, QUAY.r * GK, 0, Math.PI * 2); g.fill();
  // the course, on the ground only: the decks and the cut have their own road (roads.js), so they get no room here
  // (but under the foot of each slope the ground's road carries on, FOOT up, so nothing shows through at the seam)
  const WLp = T.WL.slice(), WRp = T.WR.slice();
  for (let i = 0; i < T.N; i++) if (on[i] && Math.abs(H[i]) > FOOT) { WLp[i] = -1.4; WRp[i] = -1.4; }
  paintCourse(g, { ...T, WL: WLp, WR: WRp }, grid, 62, line);
  // over the tunnel's roof the pavement carries on (the course's own line would show as a seam)
  { const t = P('Tunnel'); g.strokeStyle = PAVE; g.lineWidth = 6 * GK; g.lineCap = 'butt'; g.beginPath(); for (let k = t.roof[0] - 2; k <= t.roof[1] + 2; k++) { const i = T.at(t.i0 + k); k === t.roof[0] - 2 ? g.moveTo(T.X[i] * GK, T.Z[i] * GK) : g.lineTo(T.X[i] * GK, T.Z[i] * GK); } g.stroke(); }
  grassy = grassOf(cv, true, T);
  if (!PHONE) return cv;
  const half = document.createElement('canvas'); half.width = cv.width >> 1; half.height = cv.height >> 1;
  const h = half.getContext('2d'); h.imageSmoothingQuality = 'high'; h.drawImage(cv, 0, 0, half.width, half.height);
  cv.width = cv.height = 1;
  return half;
}

const RADAR_BOX = [60, 30, 1010, 1010];
let radarCv = null, radarKey = '';
function radar(R, s, ox, oy, w, h) {
  const key = [s, ox, oy, w, h].join();
  if (!radarCv || key !== radarKey) {
    radarKey = key; radarCv = radarCv || document.createElement('canvas'); radarCv.width = R.canvas.width; radarCv.height = R.canvas.height;
    radarCourse(radarCv, full().T, s, ox, oy, [], [], w, h);
  }
  R.drawImage(radarCv, 0, 0);
}

const P = (name) => course().parts.find((p) => p.name === name);
let ROOFS = null;
export default {
  id: 'tokyo', name: 'Midnight Tokyo', mode: 'race', laps: 3, hidden: true,
  blurb: 'Three laps of Tokyo after dark: the Shinjuku flyover, Lantern Alley, the Thunder Gate, the river expressway, the Rainbow Bridge, under the Shiba Tower, round the palace and through the Scramble. Guns on.',
  loading: ['Closing the Scramble', 'Building Tokyo, lighting the signs and filling the moat'],
  outer: 0x8b8984,
  look: { kind: 'neon', get lamps() { return lamps(); }, get signs() { return glows(); } },
  lodK: 0.34,
  // the road's height (vehicle.js, main.js's camera), the sides of the decks and the cut, and the floor that is drawn
  floor: (x, z, y) => heights().floor(x, z, y),
  rail: (x, z, y) => heights().rail(x, z, y),
  floorMesh,
  // where the chase camera has a roof over it and stays under it (main.js stepCamera): the tunnel (from a little
  // before each mouth, so the camera is down in time)
  get roofs() {
    if (!ROOFS) { const s = P('Tunnel').roofBox; ROOFS = [{ x0: s[0], z0: s[1] - 44, x1: s[2], z1: s[3] + 44, y: -1.5 }]; }
    return ROOFS;
  },
  get hazards() {
    const { road } = masks();
    const near = (x, z) => { for (let dz = -5; dz <= 5; dz += 5) for (let dx = -5; dx <= 5; dx += 5) if (road[Math.floor(z + dz) * WX + Math.floor(x + dx)]) return true; return false; };
    const s = P('Tunnel').roofBox;
    return [
      { kind: 'custom', make: (api) => { makeRoads(api.scene, course().T, course().parts.map((p) => ({ ...p, skip: near }))); } },
      { kind: 'custom', make: (api) => { dressBridges(api.scene, course().T, [{ part: P('Rainbow Bridge'), kind: 'stone', white: true }]); api.scene.add(stoneMesh()); } },
      { kind: 'custom', make: (api) => { for (const m of MODELS) { const g = statueMesh(m.vol, m.k, { glow: LIT[m.name][2], greedy: true }); floodlit(g, LIT[m.name]); g.position.set(m.x, m.y, m.z); g.rotation.y = m.turn; g.name = m.name; api.scene.add(g); } } },
      { kind: 'custom', make: (api) => {
        const made = ALLEY.vols.map((v) => { const g = statueMesh(v, 1, { glow: [2.6, 2.1, 1.2], greedy: true }); floodlit(g, [[0.5, 0.36, 0.22], [2.1, 1.5, 0.7, 0.6]]); return g; });
        for (const h of ALLEY.models) { const g = made[h.v].clone(); g.position.set(h.x, 0, h.z); g.rotation.y = h.turn; g.name = 'Lantern Alley'; api.scene.add(g); }
      } },
      { kind: 'custom', make: (api) => { makeBlocks(api.scene, plan().boxes); } },
      // (the trees take the lamps' light too: the blossom stays pink under a blue night)
      { kind: 'custom', make: (api) => {
        const G = makeGrove(api, GROVE); api.MAP.grove = G; if (!G.meshes) return;
        const mat = G.meshes[0].material;
        mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(0.8, 0.5, 0.52);'); };
        mat.customProgramCacheKey = () => 'tokyo-grove'; mat.needsUpdate = true;
      } },
      { kind: 'custom', make: (api) => makeWater(api.scene, { x0: -1024, z0: -1024, span: 3072, sun: NEON.moon, sky: 0x1a1c3a, glint: 0xcfd8ff, isWater: (x, z) => wet(x, z) || inMoat(x, z) || inPond(x, z), pools: [] }) },
      { kind: 'covered', x0: s[0], z0: s[1], x1: s[2], z1: s[3], dim: 0.5 },
    ];
  },
  build,
  ground: paint,
  get spawn() { return full().grid[4]; },   // the player starts fifth
  spawnPoint(player, taken) {
    const { T, gates } = full();
    const at = pickSpot(gates.map((i) => ({ x: T.X[i], z: T.Z[i], yaw: Math.atan2(T.TX[i], T.TZ[i]) })), player, taken), H = course().H;
    return { ...at, y: H[T.project(at.x, at.z).i] };   // (the road's height there)
  },
  waypoint(c, tx, tz, out) {
    const { T } = full(), p = T.project(c.x, c.z, c._rw ?? -1), j = T.at(p.i + Math.round(36 / T.STEP));
    c._rw = p.i; out.x = T.X[j]; out.z = T.Z[j]; return out;
  },
  radar,
  radarBox: RADAR_BOX,
  groundDetail: { hard: true, deFleck: true, fade: 20 },
  rutBox: [0, 0, WX, WZ],
  surface(x, z) { if (!grassy || !TR) return 0; const c = clamp(Math.floor(z), 0, WZ - 1) * WX + clamp(Math.floor(x), 0, WX - 1), d = heights().deck[c]; return d === d || masks().cut[c] ? 0 : surfaceAt(TR.T, grassy, x, z); },
  get track() { return full(); },
};
