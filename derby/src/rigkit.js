// Blackwater Rig's own things (maps/rig.js), in the fair's kit (cubes of half a voxel: fairstalls.js makeKit), so the
// rig is drawn at the level of detail of the fair, the base and the arena.
//   what stands on the decks (kinds for makeStalls)
//     rail    a run of handrail along a deck's edge, `len` voxels long: two bars on posts and a kick plate, an amber lamp
//             on every other post. It holds a car (a wall to the rivals' routes), takes rams, shots and blasts, and
//             goes in the end: the edge behind it is open after that, and its lamps are out
//     studs   a row of lamps set in the deck along an edge with no rail, every four voxels (nothing to hit)
//     plinth  the concrete block a floodlight mast stands on
//   rigBody(S)   everything under and beside the decks, one mesh: the decks' own depth, the girders under them, the
//                legs down into the sea with their bracing, the truss under the flare boom, the helipad's frame and
//                net, lifeboats in their davits, risers down the moon pool
//   craneHub, craneArm   the pedestal crane the map's sweeper turns: the pedestal and machinery house, and the jib
//                with a container slung from it, low over the deck
import * as THREE from 'three';
import { KINDS, makeKit } from './fairstalls.js';

const STEEL = 0x4f585e, STEEL_D = 0x353c42, STEEL_L = 0x6c767c, DARK = 0x202428, RUST = 0x6e4630, RUST_L = 0x8a5a3a;
const YELLOW = 0xe2b02a, YELLOW_D = 0xb88a1c, BLACK = 0x17181b, ORANGE = 0xd8601e, ORANGE_D = 0xa8481a, WHITE = 0xdcd8cc, RED = 0xb8322a, GREEN_D = 0x2c4a3c, CONC = 0x8c8a82, CHROME = 0xc3ccd6;
const AMBER = [2.6, 1.5, 0.3], RED_L = [3.0, 0.35, 0.2], GREEN_L = [0.5, 2.8, 0.8], WHITE_L = [2.4, 2.3, 2.0];

// ---- on the decks ---------------------------------------------------------------------------------------------------
function rail(K, o) {
  const L = o.len * 2, x0 = -L / 2;
  K.b(x0, 0, -0.4, L, 1.2, 0.8, STEEL_D);                                    // the kick plate
  K.b(x0, 7.2, -0.5, L, 1, 1, YELLOW); K.b(x0, 3.8, -0.4, L, 0.8, 0.8, YELLOW_D);   // the top rail and the knee rail
  const n = Math.max(1, Math.round(o.len / 4));
  for (let i = 0; i <= n; i++) {
    const x = x0 + (L - 1) * i / n;
    K.b(x, 0, -0.5, 1, 8.2, 1, i === 0 || i === n ? BLACK : YELLOW);
    if (i & 1) { K.b(x - 0.1, 8.2, -0.6, 1.2, 0.5, 1.2, DARK); K.l(x + 0.05, 8.7, -0.45, 0.9, 0.9, 0.9, AMBER, -0.1 - ((i * 7 + (o.c || 0) * 3) % 10) * 0.07); }
  }
}
function studs(K, o) {
  const L = o.len * 2, x0 = -L / 2, n = Math.max(1, Math.round(o.len / (o.every || 4))), rgb = o.rgb === 'green' ? GREEN_L : o.rgb === 'red' ? RED_L : o.rgb === 'white' ? WHITE_L : AMBER;
  const y = (o.lift || 0) * 2;   // (on a raised deck: the kit's heights are from the main deck)
  for (let i = 0; i <= n; i++) { const x = x0 + (L - 1) * i / n; K.b(x - 0.2, y, -0.7, 1.4, 0.3, 1.4, DARK); K.l(x, y + 0.3, -0.5, 1, 0.5, 1, rgb, o.steady ? 0 : 0.05 + (i % 6) / 6 * 0.9); }
}
function plinth(K) {
  K.b(-14, 0, -14, 28, 5, 28, CONC); K.b(-15, 0, -15, 30, 1.4, 30, STEEL_D);
  K.stripes(-14, 5, -14, 28, 0.6, 2, 7, YELLOW, BLACK); K.stripes(-14, 5, 12, 28, 0.6, 2, 7, BLACK, YELLOW);
}
// what a smashed rail leaves: next to nothing (it went over the side)
export function railScrap(K) { K.b(-2, 0, -0.6, 3, 0.6, 1.2, STEEL_D); K.b(1.4, 0, 0.2, 2, 0.5, 0.8, YELLOW_D); }

Object.assign(KINDS, {
  rail: { make: rail, foot: (o) => [[-o.len / 2, -0.7, o.len / 2, 0.7]], top: 4.5, hp: 110, tough: true, heap: 0.5, pool: null },
  studs: { make: studs, foot: null, top: 0, hp: 0, pool: null },
  plinth: { make: plinth, foot: [[-7.4, -7.4, 7.4, 7.4]], top: 3, hp: 0, pool: null },
});

// ---- the rig's body ---------------------------------------------------------------------------------------------------
// S: { sea, decks: [{ x0, z0, x1, z1, depth }], legs: [[x, z, r]], braces: [[i, j]] (pairs of legs), girders: [[x0, z0,
// x1, z1]], boom: { x0, x1, z0, z1 }, heli: { x0, x1, z0, z1, h }, raised: [{ x0, x1, z0, z1, h }] (blocks standing on a
// deck with straight sides), pool: { x0, x1, z0, z1 }, boats: [[x, z, yaw]] }. Returns { paint, lit } (geometry).
export function rigBody(S) {
  const K = makeKit(0, 0, 0, true), SEA = S.sea;
  const B = (x0, y0, z0, x1, y1, z1, col) => K.b(x0 * 2, y0 * 2, z0 * 2, (x1 - x0) * 2, (y1 - y0) * 2, (z1 - z0) * 2, col);
  const Lt = (x0, y0, z0, x1, y1, z1, rgb, ph = 0) => K.l(x0 * 2, y0 * 2, z0 * 2, (x1 - x0) * 2, (y1 - y0) * 2, (z1 - z0) * 2, rgb, ph);
  // a straight member from a to b, t thick: cubes in steps (nothing in the kit lies at an angle)
  const strut = (a, b, t, col) => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.ceil(d / (t * 0.9)));
    for (let k = 0; k <= n; k++) { const f = k / n, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f; B(x - t / 2, y - t / 2, z - t / 2, x + t / 2, y + t / 2, z + t / 2, col); }
  };
  // a band round the outside of a box (four strips: not a slab, which would lie across a hole in the deck)
  const frame = (x0, y0, z0, x1, y1, z1, col, t = 1) => { B(x0, y0, z0, x1, y1, z0 + t, col); B(x0, y0, z1 - t, x1, y1, z1, col); B(x0, y0, z0 + t, x0 + t, y1, z1 - t, col); B(x1 - t, y0, z0 + t, x1, y1, z1 - t, col); };
  // the decks: a slab each, a paler band round its top edge and a rust one under it
  for (const D of S.decks) {
    const P = S.pool && S.pool.x0 > D.x0 && S.pool.x1 < D.x1 && S.pool.z0 > D.z0 && S.pool.z1 < D.z1 ? S.pool : null;
    if (!P) B(D.x0, -D.depth, D.z0, D.x1, -0.06, D.z1, STEEL_D);
    else { B(D.x0, -D.depth, D.z0, D.x1, -0.06, P.z0, STEEL_D); B(D.x0, -D.depth, P.z1, D.x1, -0.06, D.z1, STEEL_D); B(D.x0, -D.depth, P.z0, P.x0, -0.06, P.z1, STEEL_D); B(P.x1, -D.depth, P.z0, D.x1, -0.06, P.z1, STEEL_D); }   // (the moon pool goes through it)
    frame(D.x0 - 0.15, -1.1, D.z0 - 0.15, D.x1 + 0.15, -0.3, D.z1 + 0.15, STEEL_L);
    frame(D.x0 - 0.1, -D.depth - 0.6, D.z0 - 0.1, D.x1 + 0.1, -D.depth + 0.4, D.z1 + 0.1, RUST);
  }
  for (const [x0, z0, x1, z1] of S.girders) { B(x0, -9, z0, x1, -4, z1, STEEL); B(x0 - 0.3, -9.6, z0 - 0.3, x1 + 0.3, -9, z1 + 0.3, RUST); }
  // the legs: square columns into the sea, hazard bands above the water, a fender at the splash line, a red lamp each
  S.legs.forEach(([x, z, r], i) => {
    B(x - r, SEA - 14, z - r, x + r, -4, z + r, STEEL);
    B(x - r - 0.4, -8, z - r - 0.4, x + r + 0.4, -4, z + r + 0.4, STEEL_D);
    for (let k = 0; k < 4; k++) B(x - r - 0.2, SEA + 7 + k * 1.6, z - r - 0.2, x + r + 0.2, SEA + 8.6 + k * 1.6, z + r + 0.2, k & 1 ? BLACK : YELLOW);
    B(x - r - 1, SEA - 2, z - r - 1, x + r + 1, SEA + 3, z + r + 1, RUST);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Lt(x + a * (r + 0.4) - 0.4, SEA + 14, z + b * (r + 0.4) - 0.4, x + a * (r + 0.4) + 0.4, SEA + 14.8, z + b * (r + 0.4) + 0.4, RED_L, -0.2 - i * 0.13);
  });
  // the bracing between them: a level tube above the water and a cross from each one's foot to the next one's head
  for (const [i, j] of S.braces) {
    const a = S.legs[i], b = S.legs[j], lo = SEA + 9, hi = -9;
    strut([a[0], lo, a[1]], [b[0], lo, b[1]], 3, STEEL); strut([a[0], lo, a[1]], [b[0], hi, b[1]], 2.4, STEEL_D); strut([b[0], lo, b[1]], [a[0], hi, a[1]], 2.4, STEEL_D);
  }
  // the truss under the flare boom: a bottom chord from the deck's side out to the tip, posts and diagonals
  if (S.boom) {
    const M = S.boom, n = Math.round((M.x1 - M.x0) / 13);
    for (const z of [M.z0 + 1.5, M.z1 - 1.5]) {
      strut([M.x0 - 6, -16, z], [M.x1 - 2, -5, z], 2, STEEL);
      for (let k = 0; k < n; k++) { const xa = M.x0 + (M.x1 - M.x0) * k / n, xb = M.x0 + (M.x1 - M.x0) * (k + 1) / n, ya = -16 + 11 * k / n, yb = -16 + 11 * (k + 1) / n; strut([xa, ya, z], [xa, -3, z], 1.4, STEEL_D); strut([xa, -3, z], [xb, yb, z], 1.4, STEEL_D); }
    }
    for (let k = 0; k <= n; k++) { const x = M.x0 + (M.x1 - M.x0) * k / n; B(x - 0.7, -16 + 11 * k / n - 0.7, M.z0 + 1.5, x + 0.7, -16 + 11 * k / n + 0.7, M.z1 - 1.5, STEEL_D); }
  }
  // what stands on a deck with straight sides (the drill floor's sides, the kickers' ends): plate, a hazard band at the foot
  for (const R of S.raised || []) {
    for (const [x0, z0, x1, z1] of R.sides) {
      B(x0, 0, z0, x1, R.h - 0.25, z1, STEEL);
      const along = x1 - x0 > z1 - z0, len = along ? x1 - x0 : z1 - z0, n = Math.max(2, Math.round(len / 3));
      for (let k = 0; k < n; k++) { const a = len * k / n, b = len * (k + 1) / n; if (along) B(x0 + a, 0, z0 - 0.12, x0 + b, 1.6, z1 + 0.12, k & 1 ? BLACK : YELLOW); else B(x0 - 0.12, 0, z0 + a, x1 + 0.12, 1.6, z0 + b, k & 1 ? BLACK : YELLOW); }
      for (let k = 1; k < n; k += 3) { const a = len * k / n; if (along) B(x0 + a - 0.4, 1.6, z0 - 0.1, x0 + a + 0.4, R.h - 0.25, z1 + 0.1, STEEL_D); else B(x0 - 0.1, 1.6, z0 + a - 0.4, x1 + 0.1, R.h - 0.25, z0 + a + 0.4, STEEL_D); }
    }
  }
  // the helipad: its frame down to the deck's level, struts under it, the safety net round its three open sides
  if (S.heli) {
    const H = S.heli, y = H.h;
    B(H.x0, y - 2.2, H.z0, H.x1, y - 0.06, H.z1, STEEL_D); B(H.x0 - 0.2, y - 1, H.z0 - 0.2, H.x1 + 0.2, y - 0.3, H.z1 + 0.2, WHITE);
    for (const x of [H.x0 + 6, (H.x0 + H.x1) / 2, H.x1 - 6]) { strut([x, y - 2, H.z0 + 6], [x, -3, H.z1 - 2], 2, STEEL); strut([x, y - 2, H.z1 - 8], [x, -3, H.z1 - 2], 2, STEEL); B(x - 1.2, -4, H.z1 - 4, x + 1.2, y - 2, H.z1 - 1.6, STEEL); }
    for (const z of [H.z0 + 6, (H.z0 + H.z1) / 2]) B(H.x0 + 2, y - 4, z - 1, H.x1 - 2, y - 2.2, z + 1, STEEL);
    const net = (x0, z0, x1, z1) => { B(x0, y - 1.6, z0, x1, y - 1.2, z1, GREEN_D); const along = x1 - x0 > z1 - z0, len = along ? x1 - x0 : z1 - z0; for (let a = 0; a <= len; a += 5) { if (along) B(x0 + a - 0.3, y - 1.7, z0, x0 + a + 0.3, y - 1.0, z1, YELLOW_D); else B(x0, y - 1.7, z0 + a - 0.3, x1, y - 1.0, z0 + a + 0.3, YELLOW_D); } };
    net(H.x0 - 5, H.z0 - 5, H.x1 + 5, H.z0); net(H.x0 - 5, H.z0, H.x0, H.z1); net(H.x1, H.z0, H.x1 + 5, H.z1);
    // (and the wall under it that faces the deck: plate between the struts, with a hazard band)
    B(H.x0, 0, H.z1 - 0.9, H.x1, y - 2.2, H.z1 + 0.12, STEEL);
    K.stripes(H.x0 * 2, 0, (H.z1 + 0.12) * 2, (H.x1 - H.x0) * 2, 3.2, 0.3, Math.round((H.x1 - H.x0) / 3), YELLOW, BLACK);
  }
  // the moon pool: a coaming down its sides, two risers down to the sea
  if (S.pool) {
    const P = S.pool;
    for (const [x0, z0, x1, z1] of [[P.x0 - 1.2, P.z0 - 1.2, P.x1 + 1.2, P.z0], [P.x0 - 1.2, P.z1, P.x1 + 1.2, P.z1 + 1.2], [P.x0 - 1.2, P.z0, P.x0, P.z1], [P.x1, P.z0, P.x1 + 1.2, P.z1]]) B(x0, -10, z0, x1, -0.08, z1, RUST);
    for (const x of [P.x0 + 6, P.x1 - 6]) { B(x - 1.3, SEA - 8, P.z0 + 3, x + 1.3, -1, P.z0 + 5.6, RUST_L); for (let yy = SEA + 4; yy < -2; yy += 7) B(x - 1.6, yy, P.z0 + 2.7, x + 1.6, yy + 0.8, P.z0 + 5.9, STEEL_D); }
    B(P.x0, -6.4, P.z0 + 2, P.x1, -5.6, P.z0 + 6.6, STEEL);   // the grating the risers come up through
    // a strip of work lights round the inside, under the deck's edge, and a yellow band below them: the hole reads as one
    for (const [x0, z0, x1, z1] of [[P.x0, P.z0, P.x1, P.z0 + 0.12], [P.x0, P.z1 - 0.12, P.x1, P.z1], [P.x0, P.z0, P.x0 + 0.12, P.z1], [P.x1 - 0.12, P.z0, P.x1, P.z1]]) {
      B(x0, -3.4, z0, x1, -2.2, z1, YELLOW); B(x0, -5.2, z0, x1, -4.6, z1, STEEL_L);
      const along = x1 - x0 > z1 - z0, len = along ? x1 - x0 : z1 - z0;
      for (let a = 2; a < len - 1; a += 5) { if (along) Lt(x0 + a, -1.5, z0, x0 + a + 1.6, -0.9, z1, AMBER, -0.3 - a * 0.01); else Lt(x0, -1.5, z0 + a, x1, -0.9, z0 + a + 1.6, AMBER, -0.3 - a * 0.01); }
    }
  }
  // lifeboats: an orange capsule hung outside the rail from two davits
  for (const [x, z, yaw] of S.boats || []) {
    const co = Math.round(Math.cos(yaw)), si = Math.round(Math.sin(yaw));   // (square to the deck: along x, or along z)
    const box = (a0, y0, b0, a1, y1, b1, col) => { const xs = [x + a0 * co + b0 * si, x + a1 * co + b1 * si], zs = [z - a0 * si + b0 * co, z - a1 * si + b1 * co]; B(Math.min(...xs), y0, Math.min(...zs), Math.max(...xs), y1, Math.max(...zs), col); };
    box(-8, -5.5, 2, 8, -1.5, 7, ORANGE); box(-6.5, -1.5, 2.6, 6.5, 0.4, 6.4, ORANGE_D); box(-9.2, -4.6, 3, -8, -2.4, 6, ORANGE_D); box(8, -4.6, 3, 9.2, -2.4, 6, ORANGE_D);
    box(-7, -3.6, 1.9, 7, -3, 7.1, WHITE); box(-3, -0.9, 2.5, 3, -0.2, 6.5, DARK);
    for (const a of [-6, 6]) { box(a - 0.5, -0.1, -0.6, a + 0.5, 5, 0.4, YELLOW_D); box(a - 0.5, 4.2, -0.6, a + 0.5, 5, 5, YELLOW_D); box(a - 0.2, 0.4, 4.3, a + 0.2, 4.2, 4.7, DARK); }
  }
  return K.geos();
}

// ---- the crane (the map's sweeper: hazards.js turns these) -----------------------------------------------------------
const kit = () => makeKit(0, 0, 0, true);
const done = (K) => { const g = K.geos(); g.lit.dispose(); return g.paint; };
function round(K, y, r0, r1, h, col) {
  const R = Math.ceil(r1);
  for (let dz = -R; dz < R; dz++) {
    let x0 = 0, c0 = null;
    for (let dx = -R; dx <= R; dx++) {
      const r = Math.hypot(dx + 0.5, dz + 0.5), c = dx < R && r < r1 && r >= r0 ? (typeof col === 'function' ? col(dx + 0.5, dz + 0.5) : col) : null;
      if (c === c0) continue;
      if (c0 !== null) K.b(x0, y, dz, dx - x0, h, 1, c0);
      x0 = dx; c0 = c;
    }
  }
}
// the pedestal (round, banded at its foot) up to TOP, the slewing ring, the machinery house and the driver's cab on it,
// the A-frame over the house and the counterweight behind (-x; the jib goes out along +x)
export function craneHub(TOP) {
  const K = kit(), y = TOP * 2;
  round(K, 0, 0, 11, 3, STEEL_D);
  for (let k = 0; k < 4; k++) round(K, 3 + k * 2.4, 0, 8.6, 2.4, k & 1 ? BLACK : YELLOW);
  round(K, 12.6, 0, 8, y - 12.6 - 6, YELLOW); round(K, y - 22, 0, 8.5, 1.4, YELLOW_D); round(K, y - 40, 0, 8.5, 1.4, YELLOW_D);
  round(K, y - 6, 0, 12, 3, STEEL_D); round(K, y - 3, 0, 10, 3, DARK);
  K.b(-22, y, -10, 34, 14, 20, YELLOW); K.b(-22, y + 14, -10, 34, 1.2, 20, STEEL_D); K.b(-22.3, y + 4, -10.3, 34.6, 1.6, 20.6, BLACK);
  K.b(12, y + 2, -10.4, 8, 10, 8, YELLOW_D); K.b(13, y + 6, -10.7, 6, 5, 0.4, 0x8fc6d8); K.b(19.8, y + 6, -9.6, 0.5, 5, 6, 0x8fc6d8);   // the cab, glazed
  K.b(-30, y - 1, -9, 9, 12, 18, STEEL_D); K.b(-30.4, y + 2, -9.4, 9.8, 2, 18.8, RED);                                                 // the counterweight
  for (const z of [-7, 6]) { K.b(-12, y + 15, z, 1.6, 22, 1.6, STEEL); K.b(4, y + 15, z, 1.6, 22, 1.6, STEEL); K.b(-12, y + 36, z, 17.6, 1.6, 1.6, STEEL); }
  K.b(-12, y + 36, -7, 1.6, 1.6, 14.6, STEEL); K.b(4, y + 36, -7, 1.6, 1.6, 14.6, STEEL);
  return done(K);
}
// the jib, along +x: a lattice out past R1, the hoist ropes down to a spreader, and the container slung under it from R0
// to R1, 2 * W wide, a voxel clear of the deck: corrugated sides, corner castings, doors at the outer end
export function craneArm(R0, R1, TOP, W = 3) {
  const K = kit(), y = TOP * 2 + 4, x1 = (R1 + 5) * 2, b0 = R0 * 2, len = (R1 - R0) * 2, w = W * 2, mid = (R0 + R1);
  for (const z of [-4, 3]) { K.b(14, y, z, x1 - 14, 1, 1, YELLOW_D); K.b(14, y + 7, z + (z < 0 ? 1.4 : -1.4), x1 - 14, 1, 1, YELLOW_D); }
  for (let x = 14; x < x1 - 2; x += 8) { K.b(x, y, -4, 1, 1, 8, YELLOW_D); K.b(x, y + 7, -2.6, 1, 1, 5.2, YELLOW_D); for (const z of [-4, 3]) { K.b(x, y + 1, z + (z < 0 ? 0.5 : -0.5), 1, 6, 1, YELLOW); K.b(x + 4, y + 1, z + (z < 0 ? 0.7 : -0.7), 0.8, 6, 0.8, YELLOW); } }
  K.b(x1 - 2, y - 1, -4.4, 3, 10, 8.8, STEEL_D);                                 // the jib's head, and its sheaves
  K.b(mid - 5, y - 3, -3, 10, 3, 6, STEEL_D); K.b(mid - 4, y - 5, -2, 8, 2, 4, DARK);   // the trolley
  // the ropes, the block and the spreader
  const top = 2 + 13, sp = top + 5;
  for (const dx of [-1.6, 1]) for (const dz of [-1.4, 0.8]) K.b(mid + dx, sp + 8, dz, 0.6, y - 5 - sp - 8, 0.6, DARK);
  K.b(mid - 3, sp + 4, -2.4, 6, 5, 4.8, YELLOW); K.b(mid - 3.3, sp + 5.4, -2.7, 6.6, 1.4, 5.4, BLACK); K.b(mid - 1, sp + 1.5, -1, 2, 3, 2, STEEL_D);
  K.b(b0 + 3, sp, -w + 1, len - 6, 1.6, 2, YELLOW_D); K.b(b0 + 3, sp, w - 3, len - 6, 1.6, 2, YELLOW_D); K.b(b0 + 3, sp, -w + 1, 2, 1.6, 2 * w - 2, YELLOW_D); K.b(b0 + len - 5, sp, -w + 1, 2, 1.6, 2 * w - 2, YELLOW_D);
  K.b(mid - 1.5, sp, -w + 1, 3, 1.6, 2 * w - 2, YELLOW_D);
  for (const x of [b0 + 3.4, b0 + len - 4.4]) for (const z of [-w + 1.4, w - 2.4]) K.b(x, top, z, 1, 5, 1, DARK);   // the slings to its corners
  // the container
  const ribs = Math.round(len / 2);
  K.stripes(b0, 2.4, -w, len, 12, 2 * w, ribs, ORANGE, ORANGE_D);
  K.b(b0, 2, -w, len, 0.8, 2 * w, STEEL_D); K.b(b0 - 0.1, 14, -w - 0.1, len + 0.2, 1, 2 * w + 0.2, ORANGE_D);
  for (const x of [b0 - 0.2, b0 + len - 1.2]) for (const z of [-w - 0.2, w - 1.2]) { K.b(x, 2, z, 1.4, 13.2, 1.4, STEEL_D); K.b(x - 0.1, 2, z - 0.1, 1.6, 1.4, 1.6, CHROME); K.b(x - 0.1, 13.8, z - 0.1, 1.6, 1.4, 1.6, CHROME); }
  K.b(b0 + len, 3, -w + 1.2, 0.3, 10.6, w - 1.4, RUST_L); K.b(b0 + len, 3, 0.2, 0.3, 10.6, w - 1.4, RUST_L);        // the doors
  for (const z of [-w + 2.4, -1.4, 1.2, w - 2.6]) K.b(b0 + len + 0.3, 3.4, z, 0.3, 9.8, 0.4, CHROME);
  K.b(b0 + len * 0.3, 6, w, len * 0.4, 5, 0.12, WHITE); K.b(b0 + len * 0.3, 6, -w - 0.12, len * 0.4, 5, 0.12, WHITE);   // the line's name plate, blank at this size
  K.stripes(b0, 2.4, w + 0.02, len, 1.6, 0.14, Math.round(len / 3), YELLOW, BLACK); K.stripes(b0, 2.4, -w - 0.16, len, 1.6, 0.14, Math.round(len / 3), BLACK, YELLOW);
  return done(K);
}
export const rigMat = () => new THREE.MeshLambertMaterial({ vertexColors: true });
