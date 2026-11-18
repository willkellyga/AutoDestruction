// Crumbletown's layout: twenty lots round a ring of four streets, each turned to face its street, plus the park,
// street dressing and the trees round the edge.
import { M, WX, WZ, CITY, PARIS, NYC, TILES, TILE_X, TILE_Z, tiled, LOC, LOT, STREET_X, STREET_Z, place, begin, set, box, ctx, lots, rubbleBody, setSeed, rnd, ri, finalize } from './world.js';
import { disc, tree, lampPost, bench, bin, hydrant, planter, hedge, fence, car } from './kit.js';
import { cottage, shop, fuel } from './buildings_a.js';
import { apartment, watertower, church, tower } from './buildings_b.js';
import { carpark, depot, plaza } from './lots_c.js';
import { needle, stadium, factory, cinema, rowhouse } from './landmarks.js';
import { cityLots, cityBlocks, cityAlleys } from './city.js';
import { parisLots, parisKeepOut, PARIS_KIT } from './paris.js';
import { parisExtras } from './paris_seine.js';
import { nycLots, nycKeepOut, NYC_KIT } from './nyc.js';
import { nycExtras } from './nyc_water.js';

// The districts (Hole.io style: small food where you start, the big prize in sight, clusters to run between):
//   south-west  suburbs, where he hatches: cottages, a park, a diner, cars to snack on
//   north-west  old town: shops, the church, a cinema and row houses round the stadium
//   middle      the square: the plaza and the Sky Needle either side of the central crossing
//   north-east  downtown: four office towers of different heights and glass, a hotel and apartment blocks
//   south-east  the fuel yard: depots, fuel stations, factories, water towers and car parks that set each other off
// Columns of lots: west edge 22, block A 101 147 193, block B 275 321 367, east edge 446.
// Rows: north edge 22, then back-to-back pairs 98/144 and 220/266, then south edge 342.
// f is the way the front faces: 0 north (low z), 1 east, 2 south, 3 west. d names the district (for the ground and the HUD).
const TOWN = [
  // north edge, facing the first street
  { x: 22, z: 22, f: 2, k: 'watertower', d: 'old' },
  { x: 101, z: 22, f: 2, k: 'rowhouse', d: 'old' },
  { x: 147, z: 22, f: 2, k: 'church', d: 'old' },
  { x: 193, z: 22, f: 2, k: 'shop', d: 'old', o: { name: 'BOOKS', title: 'Bookshop', wall: M.REND_Y, awn: M.AWN_G, door: M.DOOR_R, car: M.CAR_B } },
  { x: 275, z: 22, f: 2, k: 'apartment', d: 'down', o: { floors: 6, wall: M.REND_T, door: M.DOOR_R, awn: M.AWN_G, car: M.CAR_A } },
  { x: 321, z: 22, f: 2, k: 'tower', d: 'down' },
  { x: 367, z: 22, f: 2, k: 'tower', d: 'down', o: { floors: 7, name: 'TECH', title: 'Tech tower', glass: M.GLASS_G, span: M.SPAN_G, ink: M.LIT_B } },
  { x: 446, z: 22, f: 2, k: 'apartment', d: 'down', o: { floors: 4, wall: M.REND_P, awn: M.AWN_B, car: M.CAR_C } },
  // first back-to-back row, facing north onto the first street
  { x: 22, z: 98, f: 1, k: 'cottage', d: 'old', o: { wall: M.PL_W, roof: M.ROOF_S, shutters: M.DOOR_R, door: M.DOOR_R } },
  { x: 101, z: 98, f: 0, k: 'shop', d: 'old', o: { name: 'GROCER' } },
  // the stadium takes four lots and the alley between them (s is the size of a lot when it is not the usual one)
  { x: 147, z: 98, f: 2, k: 'stadium', d: 'old', s: 86 },
  { x: 275, z: 98, f: 0, k: 'apartment', d: 'down', o: { floors: 4 } },
  { x: 321, z: 98, f: 0, k: 'tower', d: 'down', o: { floors: 8, name: 'CORP', title: 'Bronze tower', glass: M.GLASS_Z, span: M.SPAN_Z, ink: M.LIT_W } },
  { x: 367, z: 98, f: 0, k: 'apartment', d: 'down', o: { floors: 7, title: 'Grand hotel', wall: M.REND_C, awn: M.AWN_R, car: M.CAR_B } },
  { x: 446, z: 98, f: 3, k: 'shop', d: 'down', o: { name: 'PIZZA', title: 'Pizza place', wall: M.REND_C, awn: M.AWN_G, door: M.DOOR_R, ink: M.LIT_R, car: M.CAR_A, paper: M.WP_A } },
  // ... and its other half, facing south onto the middle street
  { x: 22, z: 144, f: 1, k: 'cottage', d: 'old', o: { wall: M.PL_P, roof: M.ROOF_S, shutters: M.DOOR_B, door: M.DOOR_B, paper: M.WP_B } },
  { x: 101, z: 144, f: 2, k: 'cinema', d: 'old' },
  { x: 275, z: 144, f: 2, k: 'plaza', d: 'mid' },
  { x: 321, z: 144, f: 2, k: 'apartment', d: 'down', o: { wall: M.REND_T, door: M.DOOR_B, awn: M.AWN_B, car: 0 } },
  { x: 367, z: 144, f: 2, k: 'tower', d: 'down', o: { floors: 6, name: 'NEWS', title: 'News tower', ink: M.LIT_R } },
  { x: 446, z: 144, f: 3, k: 'carpark', d: 'down' },
  // second back-to-back row, facing north onto the middle street
  { x: 22, z: 220, f: 1, k: 'shop', d: 'sub', o: { name: 'TOYS', title: 'Toy shop', wall: M.REND_T, awn: M.AWN_R, door: M.DOOR_R, ink: M.LIT_Y, car: M.CAR_C, paper: M.WP_C } },
  { x: 101, z: 220, f: 0, k: 'cottage', d: 'sub', o: { wall: M.PL_W, roof: M.ROOF_G, shutters: M.DOOR_B, door: M.DOOR_G, paper: M.WP_B } },
  { x: 147, z: 220, f: 0, k: 'shop', d: 'sub', o: { name: 'CAFE', title: 'Cafe', wall: M.REND_P, awn: M.AWN_G, door: M.DOOR_G, ink: M.LIT_Y, car: M.CAR_A } },
  { x: 193, z: 220, f: 0, k: 'apartment', d: 'mid', o: { floors: 3, wall: M.BRICK2, door: M.DOOR_G, awn: M.AWN_R, car: M.CAR_B } },
  { x: 275, z: 220, f: 0, k: 'needle', d: 'mid' },
  { x: 321, z: 220, f: 0, k: 'fuel', d: 'yard' },
  { x: 367, z: 220, f: 0, k: 'carpark', d: 'yard' },
  { x: 446, z: 220, f: 3, k: 'watertower', d: 'yard' },
  // ... and its other half, facing south onto the last street
  { x: 22, z: 266, f: 1, k: 'cottage', d: 'sub', o: { wall: M.PL_Y, roof: M.ROOF_G, door: M.DOOR_G, paper: M.WP_C } },
  { x: 101, z: 266, f: 2, k: 'rowhouse', d: 'sub', o: { walls: [M.REND_Y, M.BRICK, M.PL_B], doors: [M.DOOR_B, M.DOOR_G, M.DOOR_R], roof: M.ROOF_R } },
  { x: 147, z: 266, f: 2, k: 'shop', d: 'sub', o: { name: 'DINER', title: 'Diner', wall: M.REND_C, awn: M.AWN_R, door: M.DOOR_R, ink: M.LIT_R, car: M.CAR_B, paper: M.WP_A } },
  { x: 193, z: 266, f: 2, k: 'cottage', d: 'sub', o: { wall: M.PL_P, roof: M.ROOF_S, shutters: M.DOOR_G, door: M.DOOR_G, paper: M.WP_B } },
  { x: 275, z: 266, f: 2, k: 'factory', d: 'yard' },
  { x: 321, z: 266, f: 2, k: 'depot', d: 'yard' },
  { x: 367, z: 266, f: 2, k: 'depot', d: 'yard', o: { tall: 1 } },
  { x: 446, z: 266, f: 3, k: 'fuel', d: 'yard' },
  // south edge, facing the last street
  { x: 22, z: 342, f: 0, k: 'park', d: 'sub' },
  { x: 101, z: 342, f: 0, k: 'cottage', d: 'sub', o: { wall: M.PL_G, roof: M.ROOF_S, shutters: M.DOOR_B, door: M.DOOR_B } },
  { x: 147, z: 342, f: 0, k: 'carpark', d: 'sub', o: { full: 0.9 } },
  { x: 193, z: 342, f: 0, k: 'cottage', d: 'sub', o: { wall: M.PL_W, roof: M.ROOF_R, shutters: M.DOOR_R, door: M.DOOR_R, paper: M.WP_C } },
  { x: 275, z: 342, f: 0, k: 'carpark', d: 'yard' },
  { x: 321, z: 342, f: 0, k: 'watertower', d: 'yard' },
  { x: 367, z: 342, f: 0, k: 'depot', d: 'yard' },
  { x: 446, z: 342, f: 0, k: 'factory', d: 'yard', o: { wall: M.BRICK2, name: 'MILL', title: 'Mill', car: M.CAR_A } },
];
// the blocks between the streets, and the alleys behind their back-to-back rows (ground.js paints them, generateTown fences them)
export const LOTS = NYC ? nycLots() : PARIS ? parisLots() : CITY ? cityLots() : [];
if (!CITY) for (let tz = 0; tz < TILES; tz++) for (let tx = 0; tx < TILES; tx++) for (const L of TOWN) LOTS.push({ ...L, x: L.x + tx * TILE_X, z: L.z + tz * TILE_Z });
export const BLOCKS = PARIS || NYC ? [] : CITY ? cityBlocks() : Array.from({ length: TILES }, (_, t) => [[98, 236], [272, 410]].map(([a, b]) => [a + t * TILE_X, b + t * TILE_X])).flat();
export const ALLEYS = PARIS || NYC ? [] : CITY ? cityAlleys() : tiled([138, 260], TILE_Z);

// A lot-local rectangle (a across, b back from the front) as a world rectangle [xa, za, xb, zb].
export function lotRect(L, a0, b0, a1, b1) {
  const f = L.f, S = L.s || LOT;
  const X = (a, b) => (f === 0 ? L.x + a : f === 2 ? L.x + S - a : f === 3 ? L.x + b : L.x + S - b);
  const Z = (a, b) => (f === 0 ? L.z + b : f === 2 ? L.z + S - b : f === 3 ? L.z + S - a : L.z + a);
  const xa = X(a0, b0), xb = X(a1, b1), za = Z(a0, b0), zb = Z(a1, b1);
  return [Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)];
}

function park(lx, lz) {
  hedge(lx + 1, lz + 1, lx + 14, lz + 2, 3); hedge(lx + 25, lz + 1, lx + 38, lz + 2, 3);
  hedge(lx + 1, lz + 37, lx + 38, lz + 38, 3);
  hedge(lx + 1, lz + 3, lx + 2, lz + 36, 3);
  hedge(lx + 37, lz + 3, lx + 38, lz + 14, 3); hedge(lx + 37, lz + 25, lx + 38, lz + 36, 3);
  const cx = lx + 20, cz = lz + 20;
  begin('Fountain', 'prop', false);
  disc(cx, cz, 0, 7, M.STONE); disc(cx, cz, 1, 7, M.STONE, 6); disc(cx, cz, 2, 7, M.TRIM, 6);
  box(cx - 1, 1, cz - 1, cx, 6, cz, M.STONE); disc(cx, cz, 7, 3, M.TRIM); disc(cx, cz, 8, 3, M.STONE, 2);
  box(cx - 1, 8, cz - 1, cx, 9, cz, M.BRASS);
  begin('Fountain water', 'prop', false);
  for (let x = -6; x < 6; x++) for (let z = -6; z < 6; z++) if ((x + 0.5) * (x + 0.5) + (z + 0.5) * (z + 0.5) < 34 && !(x >= -1 && x <= 0 && z >= -1 && z <= 0)) set(cx + x, 1, cz + z, M.WATER);
  for (const [x, z] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) set(cx + x, 8, cz + z, M.WATER);
  tree(lx + 7, lz + 9, 13, 6); tree(lx + 31, lz + 8, 12, 5); tree(lx + 8, lz + 30, 12, 6); tree(lx + 31, lz + 31, 14, 6);
  bench(lx + 16, lz + 31); bench(lx + 16, lz + 6); bin(lx + 26, lz + 31);
  lampPost(lx + 12, lz + 5); lampPost(lx + 27, lz + 5);
  planter(lx + 4, lz + 19, 9); planter(lx + 27, lz + 19, 9);
}

const KIT = { cottage, shop, fuel, apartment, watertower, church, tower, park, carpark, depot, plaza, needle, stadium, factory, cinema, rowhouse, ...PARIS_KIT, ...NYC_KIT };
const off = NYC ? nycKeepOut : PARIS ? parisKeepOut : () => false;   // Paris and New York keep the street dressing out of the water and off their set pieces

export function generateTown() {
  ctx.L = 3;
  LOTS.forEach((L, i) => {
    ctx.lot = lots.length; setSeed(9000 + i * 101);
    lots.push({ id: ctx.lot, x: L.x, z: L.z, main: 0, kind: L.k });
    place(L.x, L.z, L.f, L.s || LOT);
    KIT[L.k](LOC, LOC, 3, L.o || {});
  });
  ctx.lot = -1;
  if (PARIS) { place(0, 0, -1); parisExtras(); }   // the river is drawn in plain map coordinates
  if (NYC) { place(0, 0, -1); nycExtras(); }
  // street dressing that no lot brings with it, laid along every street: lamps on both pavements, a hydrant or bin here
  // and there, a tree at some corners and cars parked in the kerb lane. A prop is turned by placing it as a one-voxel lot.
  const prop = (x, z, f, fn) => { place(x, z, f, 1); fn(LOC, LOC); };
  setSeed(4242);
  const nearX = (v, list, d) => list.some((s) => Math.abs(v - s) < d);
  const PAINTS = NYC ? [M.TAXI, M.CAR_B, M.TAXI] : [M.CAR_A, M.CAR_B, M.CAR_C];   // New York's kerbs are mostly taxis
  for (const c of STREET_X) for (let z = 30; z < WZ - 20; z += 34) {
    if (nearX(z, STREET_Z, 30) || off(c, z) || off(c, z + 20)) continue;
    const j = z + ri(-4, 4);
    if (c - 15 > 4) prop(c - 15, j, 1, lampPost); if (c + 15 < WX - 4) prop(c + 15, j + 17, 3, lampPost);
    const r = rnd();
    if (r < 0.18) prop(c + 16, j + 8, 0, hydrant); else if (r < 0.32) prop(c - 16, j + 8, 0, bin);
    if (rnd() < 0.3 && !nearX(j + 20, STREET_Z, 34)) prop(c + (rnd() < 0.5 ? 9 : -9), j + 10, rnd() < 0.5 ? 1 : 3, (x, z) => car(x, z, PAINTS[ri(0, 2)]));
  }
  for (const c of STREET_Z) for (let x = 30; x < WX - 20; x += 34) {
    if (nearX(x, STREET_X, 30) || off(x, c) || off(x + 20, c)) continue;
    const j = x + ri(-4, 4);
    prop(j, c - 15, 2, lampPost); prop(j + 17, c + 15, 0, lampPost);
    const r = rnd();
    if (r < 0.18) prop(j + 8, c - 16, 0, hydrant); else if (r < 0.32) prop(j + 8, c + 16, 0, bin);
    if (rnd() < 0.3 && !nearX(j + 20, STREET_X, 34)) { place(0, 0, -1); car(j + 2, rnd() < 0.5 ? c - 9 : c + 3, PAINTS[ri(0, 2)]); }
  }
  for (const x of STREET_X) for (const z of STREET_Z) if (rnd() < 0.5 && !off(x + 15, z + 15)) prop(x + 15, z + 15, 0, (px, pz) => tree(px, pz, ri(9, 11), 4));
  place(0, 0, -1);
  // the alleys behind the back-to-back rows: a fence down the middle with gaps, crates and bins
  const big = LOTS.filter((L) => L.s > LOT), free = (xa, xb, z) => big.every((L) => xb < L.x - 2 || xa > L.x + L.s + 1 || z < L.z || z > L.z + L.s);
  if (CITY) for (const az of ALLEYS) for (const [x0, x1] of BLOCKS) {
    // the city's blocks are 2, 3 or 4 lots across: a length of fence behind each lot, crates or bins in the gaps
    const n = Math.round((x1 - x0 + 6) / 46);
    for (let k = 0; k < n; k++) {
      const xa = x0 + 46 * k + 2, dz = 2 + (k & 1);
      if (free(xa, xa + 38, az + dz)) fence(xa, xa + 38, az + dz);
      if (k === n - 1 || !free(xa + 41, xa + 44, az + 2) || rnd() < 0.3) continue;
      if (k & 1) { begin('Bins', 'prop', false); box(xa + 42, 0, az + 3, xa + 43, 3, az + 4, M.DOOR_G); box(xa + 42, 4, az + 3, xa + 43, 4, az + 4, M.DARK); }
      else { begin('Crates', 'prop', false); box(xa + 41, 0, az + 1, xa + 43, 2, az + 3, M.WOOD); box(xa + 42, 3, az + 2, xa + 43, 4, az + 3, M.WOOD); }
    }
  }
  else for (const az of ALLEYS) for (const [x0, x1] of BLOCKS) {
    for (const [xa, xb, dz] of [[x0 + 2, x0 + 44, 2], [x0 + 52, x0 + 92, 3], [x0 + 98, x1 - 3, 2]]) if (free(xa, xb, az + dz)) fence(xa, xb, az + dz);
    if (free(x0 + 46, x0 + 48, az + 2)) { begin('Crates', 'prop', false); box(x0 + 46, 0, az + 1, x0 + 48, 2, az + 3, M.WOOD); box(x0 + 47, 3, az + 2, x0 + 48, 4, az + 3, M.WOOD); }
    if (free(x0 + 94, x0 + 95, az + 3)) { begin('Bins', 'prop', false); box(x0 + 94, 0, az + 3, x0 + 95, 3, az + 4, M.DOOR_G); box(x0 + 94, 4, az + 3, x0 + 95, 4, az + 4, M.DARK); }
  }
  // trees round the edge, clear of the streets
  const clearOf = (v, list) => list.every((s) => Math.abs(v - s) > 22);
  const offLots = (x, z) => LOTS.every((L) => x < L.x - 6 || x > L.x + (L.s || LOT) + 6 || z < L.z - 6 || z > L.z + (L.s || LOT) + 6);
  for (let i = 0, n = 0, want = CITY ? 110 : 44; i < want * 9 && n < want; i++) {
    const side = i & 3, t = rnd();
    const x = side === 0 ? ri(5, 15) : side === 1 ? ri(WX - 17, WX - 7) : Math.floor(10 + t * (WX - 22));
    const z = side === 2 ? ri(5, 15) : side === 3 ? ri(WZ - 17, WZ - 7) : Math.floor(10 + t * (WZ - 22));
    if (!clearOf(x, STREET_X) || !clearOf(z, STREET_Z) || !offLots(x, z) || off(x, z)) continue;
    if (lastTrees.some((p) => Math.abs(p[0] - x) + Math.abs(p[1] - z) < 14)) continue;
    lastTrees.push([x, z]); n++;
    tree(x, z, ri(10, 15), ri(4, 6));
  }
  for (let r = 0; r < 4; r++) { ctx.L = r; rubbleBody.push(begin('Rubble', 'rubble', false)); }
  finalize();
}
const lastTrees = [];
