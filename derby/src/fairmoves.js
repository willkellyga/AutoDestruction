// Dead Man's Fair's rides that move (maps/fair.js), at the stalls' detail (their kit: ../fairstalls.js):
//   the pirate ship   swinging between two A-frames. A car can dash under it while it is up at either end; at the
//                     bottom of its swing it runs down whatever is in its way, car or dead.
//   the chair swing   a striped top turning on a column, the chairs flung out on their chains, well over the cars.
//   the drop tower    a ring of seats hauled to the top of a tall lit tower, held, and let go.
//   the octopus       six arms with a pod on each, turning and rocking, overhead.
//   the coaster train five cars running the rollercoaster's track. Knock the track out from under it (the legs are
//                     the map's voxels) and it comes off, and blows up where it lands.
// What stands still of each (frame, column, tower, hub) is one of the stalls' kinds, so it is in the stalls' two
// meshes, cars bounce off its feet and the bots route round it. What moves is a mesh of paint and a mesh of lights
// each, in the stalls' own materials (so its lights are on its quarter's circuit, and go out with it).
import * as THREE from 'three';
import { makeKit, KINDS, N, CHASE } from './fairstalls.js';
import { sparks } from '../../src/sim.js';
import { solid } from '../../src/world.js';

const TAU = Math.PI * 2;
const RED = 0xc8342c, WHITE = 0xeee8da, YELLOW = 0xe8b830, BLUE = 0x2f6fc0, GREEN = 0x3c9a52, DARK = 0x24262c, TEAL = 0x1f9c98,
  PINK = 0xe86aa8, PURPLE = 0x7a4ac0, ORANGE = 0xe2752a, PLANK = 0x5c4630, STEEL = 0x8e969c, BROWN = 0x6a4326, CREAM = 0xf4ead0;
const SEATS = [RED, YELLOW, BLUE, GREEN, PINK, ORANGE, TEAL, PURPLE];
// one of the dead, riding: sat down, its arms up (2 cubes wide, 6 tall)
export function rider(K, x, y, z, k = 0) {
  const shirt = [0x55783c, 0x6a5a7a, 0x7a5a3c, 0x4a6a7a][k & 3], skin = 0x6f9a4a;
  K.b(x, y, z, 2, 2.6, 1.6, shirt); K.b(x + 0.2, y + 2.6, z, 1.6, 1.6, 1.6, skin);
  K.b(x - 0.6, y + 1.8, z + 0.4, 0.6, 2.8, 0.7, skin); K.b(x + 2, y + 1.8, z + 0.4, 0.6, 2.8 - (k % 3) * 0.6, 0.7, skin);
}

// ---- the pirate ship ------------------------------------------------------------------------------------------------
// It swings along the model's x, about an axle SHIP.pivot cubes up.
export const SHIP = { pivot: 58, keel: 55.5, half: 22, wide: 7, swing: 1.15, rate: 1.2, dmg: 30 };   // cubes (half voxels) but for: swing (radians either way), rate (of the swing), dmg (to a car it hits at full tilt)
function shipFrame(K, o) {
  const P = SHIP.pivot;
  K.b(-34, 0, -13, 68, 0.4, 26, PLANK);
  for (let x = -34; x < 34; x += 4) K.b(x, 0.4, -13, 2, 0.1, 26, 0x4c3a28);
  for (const sz of [-17, 15]) {
    for (let y = 0; y < P; y += 2) { const off = 28 * (1 - y / P); for (const s of [-1, 1]) K.b(s * off - 1.5, y, sz, 3, 2, 2, (y / 6 | 0) & 1 ? WHITE : o.a); }
    for (const s of [-1, 1]) K.b(s * 28 - 3, 0, sz - 1, 6, 1.5, 4, DARK);
    K.b(-14.5, P / 2, sz + 0.5, 29, 1.5, 1, o.a);
    K.b(-2.5, P - 3, sz - 0.5, 5, 6, 3, DARK);
    for (let i = 0; i < 9; i++) K.l(-0.6, 4 + i * 5.6, sz < 0 ? sz - 0.4 : sz + 2, 1.2, 1.2, 0.4, N[CHASE[i % 5]], 0.05 + (i % 6) / 6 * 0.9);
  }
  K.b(-1, P - 1, -17, 2, 2, 34, STEEL);
  for (const sx of [-15, 14]) K.b(sx, P + 1, -0.5, 1, 6, 1, DARK);
  K.sign(o.name, 0, P + 9, 1, 38, 8, o.neon, o.frame, 2);
  K.bulbs(-18, 18, P + 13.2, -0.5, 3, false, 1.2);
  // the steps up to it, and its rail
  K.b(-9, 0.4, 13, 18, 1, 4, PLANK); K.b(-7, 1.4, 13, 14, 1, 2, PLANK);
}
KINDS.shipframe = { make: shipFrame, foot: [[-15.6, -8.8, -12.4, -6.2], [12.4, -8.8, 15.6, -6.2], [-15.6, 6.2, -12.4, 8.8], [12.4, 6.2, 15.6, 8.8]], top: 29, hp: 0, pool: [0, 0, 17] };
function shipHull(K, o) {
  const R = SHIP.keel, a = o.a, b = o.b ?? YELLOW;
  K.b(-12, -R, -5, 24, 2, 10, BROWN);
  K.b(-17, -R + 2, -6.5, 34, 3.5, 13, a);
  K.b(-22, -R + 5.5, -7, 44, 4, 14, a);
  K.b(-22.2, -R + 8.5, -7.2, 44.4, 1, 14.4, b);
  K.b(-21, -R + 9.5, -6, 42, 0.3, 12, PLANK);
  for (const s of [-1, 1]) {
    // the ends, stepped up to a curl
    K.b(s > 0 ? 16 : -22, -R + 9.5, -6.5, 6, 5, 13, a); K.b(s > 0 ? 16 : -22, -R + 13.5, -6.7, 6, 1, 13.4, b);
    K.b(s > 0 ? 19 : -24, -R + 14.5, -5, 5, 5, 10, a);
    K.b(s > 0 ? 22 : -26, -R + 19.5, -3, 4, 4, 6, a); K.b(s > 0 ? 21 : -24, -R + 23.5, -2, 3, 2.5, 4, b);
    K.l(s > 0 ? 24.5 : -26, -R + 21, -1, 1.5, 1.5, 2, N.warm, -0.4);
  }
  // a skull on each side of the prow
  for (const z of [7.05, -7.35]) { K.b(17, -R + 3.5, z, 3, 3, 0.3, CREAM); K.b(17.5, -R + 2.6, z, 2, 1, 0.3, CREAM); K.b(17.5, -R + 4.8, z + (z > 0 ? 0.1 : -0.1), 0.7, 0.8, 0.3, DARK); K.b(18.8, -R + 4.8, z + (z > 0 ? 0.1 : -0.1), 0.7, 0.8, 0.3, DARK); }
  // the benches, and who is still riding
  let k = 0;
  for (let x = -13; x <= 11; x += 4.8) { K.b(x, -R + 9.8, -6, 1, 3.4, 12, DARK); K.b(x + 1, -R + 9.8, -6, 2, 1.4, 12, BROWN); for (const z of [-5, -1.2, 2.8]) if ((k++ * 7 + 3) % 5 < 3) rider(K, x + 1.1, -R + 11.2, z, k); }
  // the arms it hangs by
  K.b(-1.5, -R + 9, -1, 3, R - 9, 2, STEEL);
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) K.b(s * 17 * (1 - i / 12) - 1, -R + 10 + i * (R - 14) / 12, -0.75, 2, (R - 14) / 12 + 0.6, 1.5, STEEL);
  K.bulbs(-20, 20, -R + 9.6, 7.2, 4); K.bulbs(-20, 20, -R + 9.6, -8.2, 4);
}

// ---- the chair swing --------------------------------------------------------------------------------------------------
const SWING_TOP = 52;
function swingBase(K, o) {
  K.discXZ(0, 0, 0, 13, 1.5, DARK); K.discXZ(0, 1.5, 0, 11, 1, o.a);
  for (let y = 2.5, i = 0; y < SWING_TOP; y += 4.5, i++) K.b(-3, y, -3, 6, 4.5, 6, i & 1 ? WHITE : o.a);
  K.b(-4, 20, -4, 8, 2, 8, YELLOW); K.b(-4, 42, -4, 8, 2, 8, YELLOW);
  for (let i = 0; i < 10; i++) { const ph = 0.05 + i / 10 * 0.9; K.l(-0.6, 5 + i * 4.4, 3, 1.2, 1.8, 0.4, N.yellow, ph); K.l(-0.6, 5 + i * 4.4, -3.4, 1.2, 1.8, 0.4, N.yellow, ph); K.l(3, 5 + i * 4.4, -0.6, 0.4, 1.8, 1.2, N.yellow, ph); K.l(-3.4, 5 + i * 4.4, -0.6, 0.4, 1.8, 1.2, N.yellow, ph); }
}
KINDS.swingbase = { make: swingBase, foot: [[-3.4, -3.4, 3.4, 3.4]], top: 26, hp: 0, pool: [0, 0, 19] };
function swingTop(K, o) {
  K.discXZ(0, 0, 0, 24, 1.5, o.a); K.discXZ(0, 1.5, 0, 19, 2, WHITE); K.discXZ(0, 3.5, 0, 13, 2, o.a); K.discXZ(0, 5.5, 0, 7, 2, WHITE);
  K.b(-1.5, 7.5, -1.5, 3, 3, 3, YELLOW); K.l(-1, 10.5, -1, 2, 2, 2, N.yellow, -0.3);
  for (let k = 0; k < 28; k++) { const a = k / 28 * TAU; K.l(Math.cos(a) * 23.6 - 0.6, -1.2, Math.sin(a) * 23.6 - 0.6, 1.2, 1.2, 1.2, N[CHASE[k % 5]], 0.05 + (k % 6) / 6 * 0.9); }
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * TAU; K.l(Math.cos(a) * 9 - 0.8, -0.8, Math.sin(a) * 9 - 0.8, 1.6, 0.8, 1.6, N.warm, 0, 0.8); }
  // the chairs, flung out
  const NC = 12, TILT = 0.66, LEN = 31, sn = Math.sin(TILT), cs = Math.cos(TILT);
  for (let k = 0; k < NC; k++) {
    const a = k / NC * TAU, c = Math.cos(a), s = Math.sin(a);
    for (let i = 0; i < 6; i++) { const r = 21 + sn * LEN * (i + 0.5) / 6, y = -cs * LEN * (i + 1) / 6; K.b(c * r - 0.4, y, s * r - 0.4, 0.8, cs * LEN / 6 + 0.1, 0.8, STEEL); }
    const r = 21 + sn * LEN, y = -cs * LEN, cx = c * r, cz = s * r, col = SEATS[k % SEATS.length];
    K.b(cx - 2.2, y - 3.4, cz - 2.2, 4.4, 1.4, 4.4, col); K.b(cx - c * 1.8 - 1.8, y - 2, cz - s * 1.8 - 1.8, 3.6, 3.4, 3.6, col); K.b(cx - 2.4, y - 0.4, cz - 2.4, 4.8, 0.5, 4.8, YELLOW);
    if ((k * 5 + 1) % 4) rider(K, cx + c * 1 - 1, y - 2, cz + s * 1 - 0.8, k);
  }
}

// ---- the drop tower ---------------------------------------------------------------------------------------------------
export const DROP = { top: 104, low: 6, high: 88, up: 12, hold: 1.6, wait: 3.2, g: 150 };   // cubes: how tall, where the seats rest and where they stop; cubes a second up; seconds held at the top and at the bottom; how hard they fall
function dropTower(K, o) {
  const H = DROP.top;
  K.b(-9, 0, -9, 18, 2, 18, DARK); K.b(-7.5, 2, -7.5, 15, 1, 15, YELLOW);
  K.b(-2.5, 3, -2.5, 5, H - 3, 5, o.a);
  for (const sx of [-4, 2.5]) for (const sz of [-4, 2.5]) K.b(sx, 3, sz, 1.5, H - 3, 1.5, WHITE);
  for (let y = 10, i = 0; y < H; y += 8, i++) K.b(-4, y, -4, 8, 1, 8, i & 1 ? WHITE : YELLOW);
  for (let i = 0; i < 24; i++) { const y = 5 + i * 4, ph = 0.05 + (i % 8) / 8 * 0.9, c = N[o.neon]; K.l(-0.6, y, 4, 1.2, 2, 0.3, c, ph); K.l(-0.6, y, -4.3, 1.2, 2, 0.3, c, ph); K.l(4, y, -0.6, 0.3, 2, 1.2, c, ph); K.l(-4.3, y, -0.6, 0.3, 2, 1.2, c, ph); }
  K.b(-6, H, -6, 12, 3, 12, o.a); K.b(-7, H + 3, -1.5, 14, 1, 3, DARK);
  K.sign(o.name, 0, H + 9, 1, 30, 8, o.neon, o.frame, 2);
  K.bulbs(-14, 14, H + 13.2, -0.5, 3, false, 1.2); K.l(-1.5, H + 15, -1.5, 3, 3, 3, N.red, -0.7);
}
KINDS.droptower = { make: dropTower, foot: [[-5.8, -5.8, 5.8, 5.8]], top: 31, hp: 0, pool: [0, 0, 15] };
function dropCar(K, o) {
  K.b(-10, 0, -10, 20, 1.5, 5, DARK); K.b(-10, 0, 5, 20, 1.5, 5, DARK); K.b(-10, 0, -5, 5, 1.5, 10, DARK); K.b(5, 0, -5, 5, 1.5, 10, DARK);
  K.b(-9, 1.5, -6.5, 18, 6, 1.5, o.a); K.b(-9, 1.5, 5, 18, 6, 1.5, o.a); K.b(-6.5, 1.5, -5, 1.5, 6, 10, o.a); K.b(5, 1.5, -5, 1.5, 6, 10, o.a);
  K.b(-9.2, 7.5, -6.7, 18.4, 0.8, 13.4, YELLOW);
  let k = 0;
  for (const x of [-8, -3.5, 1, 5.5]) { if (k++ % 3) rider(K, x, 1.5, 6.6, k); if (k++ % 3) rider(K, x, 1.5, -8.2, k); }
  for (const z of [-4, 1]) { if (k++ % 3) rider(K, 6.8, 1.5, z, k); if (k++ % 3) rider(K, -8.8, 1.5, z, k); }
  for (const s of [-10.3, 10]) { K.l(-10, 0.3, s, 20, 0.8, 0.3, N[o.neon], -0.2, 0.9); K.l(s, 0.3, -10, 0.3, 0.8, 20, N[o.neon], -0.5, 0.9); }
}

// ---- the octopus ------------------------------------------------------------------------------------------------------
const OCTO_TOP = 22;
function octoBase(K, o) {
  K.discXZ(0, 0, 0, 10, 1.5, DARK); K.discXZ(0, 1.5, 0, 8, 1, YELLOW);
  for (let y = 2.5, i = 0; y < OCTO_TOP; y += 3.25, i++) K.b(-3, y, -3, 6, 3.25, 6, i & 1 ? WHITE : o.a);
  for (let i = 0; i < 4; i++) { const ph = 0.05 + i / 4 * 0.9; K.l(-0.6, 5 + i * 4, 3, 1.2, 1.6, 0.4, N[o.neon], ph); K.l(-0.6, 5 + i * 4, -3.4, 1.2, 1.6, 0.4, N[o.neon], ph); }
}
KINDS.octobase = { make: octoBase, foot: [[-3.2, -3.2, 3.2, 3.2]], top: 11, hp: 0, pool: [0, 0, 17] };
function octoTop(K, o) {
  K.b(-4.5, 0, -4.5, 9, 4, 9, o.a); K.b(-3, 4, -3, 6, 3, 6, YELLOW); K.l(-1.5, 7, -1.5, 3, 3, 3, N[o.neon], -0.5);
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * TAU, c = Math.cos(a), s = Math.sin(a), up = k & 1 ? 10 : 1, col = SEATS[k % SEATS.length];
    for (let i = 1; i <= 14; i++) { const f = i / 14, r = 3 + 27 * f, y = 1 + up * f * f; K.b(c * r - 1.7, y, s * r - 1.7, 3.4, 2.4, 3.4, i & 1 ? WHITE : o.a); if (i % 2 === 0) K.l(c * r - 0.7, y + 2.4, s * r - 0.7, 1.4, 1, 1.4, N[CHASE[k % 5]], 0.05 + f * 0.9); }
    const r = 31, y = 1 + up, cx = c * r, cz = s * r;
    K.b(cx - 0.4, y - 3, cz - 0.4, 0.8, 3, 0.8, STEEL);
    K.b(cx - 4, y - 7.5, cz - 4, 8, 3.5, 8, col); K.b(cx - 4.4, y - 4.4, cz - 4.4, 8.8, 0.9, 8.8, YELLOW); K.b(cx - 3, y - 8.3, cz - 3, 6, 0.8, 6, DARK);
    rider(K, cx - 3, y - 5.4, cz - 0.8, k); if (k % 2) rider(K, cx + 1, y - 5.4, cz - 0.8, k + 2);
    for (const [ax, az] of [[-4.6, -1], [3.4, -1], [-1, -4.6], [-1, 3.4]]) K.l(cx + ax, y - 6.6, cz + az, ax === -1 ? 2 : 1.2, 1.2, az === -1 ? 2 : 1.2, N[CHASE[(k + 2) % 5]], -0.3 - k * 0.1);
  }
}

// ---- a coaster car: its front the model's +z ------------------------------------------------------------------------------
function coasterCar(K) {
  K.b(-4, 0, -6, 8, 1, 12, DARK);
  K.b(-4, 1, -6, 8, 3.5, 12, RED); K.b(-4.2, 2.6, -6.2, 8.4, 1, 12.4, YELLOW); K.b(-3, 1, 6, 6, 2.6, 1.6, RED);
  K.b(-3.5, 4.5, -5.6, 7, 3, 1, DARK); K.b(-3.5, 4.5, -0.4, 7, 3, 1, DARK);
  rider(K, -3, 4.5, -4.2, 1); rider(K, 1, 4.5, -4.2, 2); rider(K, -3, 4.5, 1, 3); rider(K, 1, 4.5, 1, 0);
  for (const x of [-4.4, 4.1]) for (let i = 0; i < 4; i++) K.l(x, 1.4, -5 + i * 3, 0.3, 0.9, 1.2, N[CHASE[i % 5]], 0.05 + i / 4 * 0.9);
  K.l(-3, 2, 7.6, 1.5, 1.2, 0.3, N.warm); K.l(1.5, 2, 7.6, 1.5, 1.2, 0.3, N.warm);
}

// api: main.js's api; spec: { ship, swing, drop, octo: the stalls' own entries for what stands (x, z, yaw, a, neon...),
// coaster: { at(t) => [x, y, z, length] } }; mats: the stalls' { paint, lit: [a quarter each] }; quarter(x, z)
export function makeMoves(api, spec, mats, quarter) {
  const { scene } = api;
  // a moving part: its paint and its lights, under a group; made by `make` about its own middle
  function part(make, o, parent) {
    const K = makeKit(0, 0, 0, true); make(K, o);
    const g = K.geos(), G = new THREE.Group(), p = new THREE.Mesh(g.paint, mats.paint), l = new THREE.Mesh(g.lit, mats.lit[quarter(o.x, o.z)]);
    p.castShadow = true; G.add(p, l); (parent || scene).add(G);
    return G;
  }
  const stand = (o) => { const G = new THREE.Group(); G.position.set(o.x, 0, o.z); G.rotation.y = o.yaw || 0; scene.add(G); return G; };
  let time = 0;

  // ---- the ship ----
  const SH = spec.ship, shipAt = stand(SH), hull = part(shipHull, SH, shipAt);
  hull.position.y = SHIP.pivot / 2;
  const shipCo = Math.cos(SH.yaw || 0), shipSi = Math.sin(SH.yaw || 0), hitT = new Map();
  const PV = SHIP.pivot / 2, RK = SHIP.keel / 2, HALF = SHIP.half / 2, WIDE = SHIP.wide / 2;
  let shipA = 0, shipW = 0, creakT = 0;
  // is a thing at (x, z), h tall and r round, in the hull's way just now? (in the ship's own frame, swung back upright)
  function shipOver(x, z, r, h) {
    const dx = x - SH.x, dz = z - SH.z, lx = dx * shipCo - dz * shipSi, lz = dx * shipSi + dz * shipCo;
    if (Math.abs(lz) > WIDE + r || Math.abs(lx) > 30) return false;
    const c = Math.cos(shipA), s = Math.sin(shipA), py = h * 0.5 - PV, ux = lx * c + py * s, uy = -lx * s + py * c;
    return Math.abs(ux) < HALF + r && uy < -RK + 5 + h * 0.5 && uy > -RK - 3;
  }
  function stepShip(dt, live) {
    shipA = SHIP.swing * Math.sin(time * SHIP.rate); shipW = SHIP.swing * SHIP.rate * Math.cos(time * SHIP.rate);
    hull.rotation.z = shipA;
    if (!live) return;
    // how fast the hull is going along the ground at the bottom of its arc, in the world
    const v = shipW * RK * Math.cos(shipA), wx = v * shipCo, wz = -v * shipSi;
    if ((creakT -= dt) <= 0 && Math.abs(shipA) < 0.12) { creakT = 1.5; api.sound('whoosh', 0.35, SH.x, 6, SH.z); }
    if (Math.abs(shipA) > 0.75) return;   // (up at either end: clear underneath)
    const now = api.game.time;
    for (const c of api.cars) {
      if (c.dead || c.gone || c.remote) continue;
      if (!shipOver(c.x, c.z, Math.max(c.wide, 1.6), 3.4) || now - (hitT.get(c) ?? -9) < 1.1) continue;
      hitT.set(c, now);
      const hard = Math.min(1, Math.abs(v) / 30);
      api.damage(c, 8 + SHIP.dmg * hard, null);
      c.vx += wx * 0.9; c.vz += wz * 0.9;
      sparks(c.x, 3, c.z, 14, 1, 0.8, 0.4, 20);
      api.sfx.play('crunch_heavy', c === api.player ? 1 : 0.6, c.x, c.z);
      if (c === api.player) { api.game.shake = Math.min(1.2, api.game.shake + 0.7 * hard); api.toast('Run down by the pirate ship', ''); }
    }
    const horde = api.horde && api.horde();
    if (horde && !horde.puppet) for (const q of horde.all) if (!q.dead && Math.abs(q.x - SH.x) < 32 && Math.abs(q.z - SH.z) < 32 && shipOver(q.x, q.z, 0.8, 3)) horde.splat(q, null, wx * 0.05, wz * 0.05, 24);
  }

  // ---- the chair swing ----
  const SW = spec.swing, swingAt = stand(SW), swingTilt = new THREE.Group(), swingSpin = part(swingTop, SW, swingTilt);
  swingTilt.position.y = SWING_TOP / 2; swingAt.add(swingTilt);

  // ---- the drop tower ----
  const DT = spec.drop, dropAt = stand(DT), car = part(dropCar, DT, dropAt);
  const D = { y: DROP.low, v: 0, state: 'wait', t: 1 + Math.random() * 2 };
  function stepDrop(dt, live) {
    if (D.state === 'wait') { if ((D.t -= dt) <= 0) D.state = 'up'; }
    else if (D.state === 'up') { D.y += DROP.up * dt; if (D.y >= DROP.high) { D.y = DROP.high; D.state = 'hold'; D.t = DROP.hold; } }
    else if (D.state === 'hold') { if ((D.t -= dt) <= 0) { D.state = 'fall'; D.v = 0; if (live) api.sound('whoosh', 0.5, DT.x, 30, DT.z); } }
    else {
      // let go, and caught by the brakes over the last of it
      D.v += DROP.g * dt; if (D.y < DROP.low + 26) D.v = Math.min(D.v, 8 + (D.y - DROP.low) * 4.4);
      D.y -= D.v * dt;
      if (D.y <= DROP.low) { D.y = DROP.low; D.state = 'wait'; D.t = DROP.wait; if (live) api.sound('thud', 0.4, DT.x, 3, DT.z); }
    }
    car.position.y = D.y / 2;
  }

  // ---- the octopus ----
  const OC = spec.octo, octoAt = stand(OC), octoTilt = new THREE.Group(), octoSpin = part(octoTop, OC, octoTilt);
  octoTilt.position.y = OCTO_TOP / 2; octoAt.add(octoTilt);

  // ---- the coaster's train ----
  const CO = spec.coaster, CARS = 5, GAP = 6.6;
  const train = (() => {
    const K = makeKit(0, 0, 0, true); coasterCar(K);
    const g = K.geos(), q = quarter(CO.x, CO.z);
    const p = new THREE.InstancedMesh(g.paint, mats.paint, CARS), l = new THREE.InstancedMesh(g.lit, mats.lit[q], CARS);
    for (const m of [p, l]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); }
    p.castShadow = true;
    return { p, l };
  })();
  const LEN = CO.at(0)[3], _o = new THREE.Object3D(), _v = new THREE.Vector3();
  const T = { t: 0.1, state: 'run', off: 0, vel: new THREE.Vector3(), pos: [], spin: 0, gone: 0, look: 0 };
  // is there track under a place on the loop?
  function track(t) {
    const [x, y, z] = CO.at(t), ix = Math.round(x), iz = Math.round(z), iy = Math.floor(y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (solid(ix + dx, iy + dy, iz + dz)) return true;
    return false;
  }
  const whole = () => { for (let i = 0; i < 48; i++) if (!track(i / 48)) return false; return true; };
  function showTrain(n) { train.p.count = train.l.count = n; }
  function placeCar(k, x, y, z, fx, fy, fz, roll = 0) {
    _o.position.set(x, y, z); _o.rotation.set(0, 0, 0); _o.lookAt(x + fx, y + fy, z + fz); if (roll) _o.rotateZ(roll); _o.updateMatrix();
    train.p.setMatrixAt(k, _o.matrix); train.l.setMatrixAt(k, _o.matrix);
  }
  function stepTrain(dt, live) {
    if (T.state === 'gone') {
      // back on the rails once there is a whole track again (the next round's)
      if ((T.look -= dt) <= 0) { T.look = 2; if (whole()) { T.state = 'run'; T.t = 0.1; showTrain(CARS); } }
      return;
    }
    if (T.state === 'run') {
      const y0 = CO.at(T.t)[1], v = Math.max(24, Math.min(72, 30 + (56 - y0) * 1.7));
      T.t = (T.t + v * dt / LEN) % 1; T.v = v;
      for (let k = 0; k < CARS; k++) {
        const s = T.t - k * GAP / LEN, [x, y, z] = CO.at(s), [x2, y2, z2] = CO.at(s + 2 / LEN);
        placeCar(k, x, y + 1.6, z, x2 - x, y2 - y, z2 - z);
        (T.pos[k] || (T.pos[k] = new THREE.Vector3())).set(x, y + 1.6, z);
        if (k === 0) T.vel.set(x2 - x, y2 - y, z2 - z).normalize().multiplyScalar(v);
      }
      if (live && !track(T.t + 3 / LEN) && !track(T.t + 5 / LEN)) { T.state = 'fall'; T.spin = 0; api.sound('alarm', 0.4); api.sfx.play('scrape', 0.9, T.pos[0].x, T.pos[0].z); }
    } else {
      // off the end of the track: over it goes
      T.vel.y -= 70 * dt; T.spin += dt * 2.4;
      let down = false;
      for (let k = 0; k < CARS; k++) { const p = T.pos[k]; p.addScaledVector(T.vel, dt); _v.copy(T.vel).normalize(); placeCar(k, p.x, p.y, p.z, _v.x, _v.y, _v.z, T.spin * (k & 1 ? -1 : 1)); if (p.y < 2.5) down = true; }
      if (down) {
        for (let k = 0; k < CARS; k += 2) { const p = T.pos[k]; api.explode(p.x, 3, p.z, 6.5, 0.45, { maxDebris: 70 }); }
        T.state = 'gone'; T.look = 6; showTrain(0);
      }
    }
    train.p.instanceMatrix.needsUpdate = train.l.instanceMatrix.needsUpdate = true;
  }

  return {
    ship: () => ({ a: shipA, w: shipW }), train: T, drop: D,   // (for the tests)
    step(dt, live) {
      time += dt;
      stepShip(dt, live);
      swingSpin.rotation.y -= dt * 1.05; swingTilt.rotation.x = 0.07 * Math.sin(time * 0.8); swingTilt.rotation.z = 0.07 * Math.cos(time * 0.8);
      stepDrop(dt, live);
      octoSpin.rotation.y += dt * 1.15; octoTilt.rotation.x = 0.11 * Math.sin(time * 0.9); octoTilt.rotation.z = 0.11 * Math.cos(time * 0.9);
      stepTrain(dt, live);
    },
    // on the radar: the ship's swing and the train
    radar(R, s, ox, oy) {
      R.fillStyle = 'rgba(255,120,90,0.85)';
      const k = Math.sin(shipA) * RK; R.fillRect(ox + (SH.x + k * shipCo - 2) * s, oy + (SH.z - k * shipSi - 2) * s, 4 * s, 4 * s);
      if (T.state === 'run' && T.pos[0]) { R.fillStyle = 'rgba(255,214,90,0.8)'; R.fillRect(ox + (T.pos[0].x - 2) * s, oy + (T.pos[0].z - 2) * s, 4 * s, 4 * s); }
    },
  };
}
