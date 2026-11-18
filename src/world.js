// Crumbletown world: the voxel grid, materials, bodies and the primitives the town kit builds with.
// One voxel is a quarter metre. y is up, chunks are 16 wide.
import * as THREE from 'three';

// TILES repeats the whole town TILES x TILES times: a stress test for a much larger map (`python3 build.py big`).
export const TILES = typeof __TILES__ === 'number' ? __TILES__ : 1, TILE_X = 512, TILE_Z = 416;
export const tiled = (a, step) => Array.from({ length: TILES }, (_, t) => a.map((v) => v + t * step)).flat();
// CITY: the big city instead of the first town, about four times the map, and taller. A build can fix the map
// (`python3 build.py city`, the move studio, the tiled test); otherwise it is the choice made on the menu, kept for the
// reload that builds the other world (pickMap). A script can force it with `window.__MAP = 'city'` before this runs.
// PARIS builds the Paris map (`python3 build.py paris`, laid out in paris.js). It is a city as far as size, haze and
// street dressing go, so CITY is true for it too; it is taller, for the Eiffel Tower.
export const PARIS = typeof __PARIS__ === 'boolean' && __PARIS__;
// NYC builds the New York map (`python3 build.py nyc`, laid out in nyc.js): a city too, and as tall as the handles allow.
export const NYC = typeof __NYC__ === 'boolean' && __NYC__;
// TOKYO builds the Tokyo map (`python3 build.py tokyo`, laid out in tokyo.js), on the same terms.
export const TOKYO = typeof __TOKYO__ === 'boolean' && __TOKYO__;
export const MAP_FIXED = PARIS || NYC || TOKYO || (typeof __CITY__ === 'boolean' && __CITY__) || (typeof __STUDIO__ === 'boolean' && __STUDIO__) || TILES > 1;
function chosenMap() {
  if (typeof window === 'undefined') return '';
  if (window.__MAP) return window.__MAP;
  try { const v = sessionStorage.getItem('mm-map'); if (v) return v; } catch (e) { /* no storage here: the window's name carries it */ }
  const m = /mm-map=(\w+)/.exec(window.name || ''); return m ? m[1] : '';
}
export function pickMap(m) {
  try { sessionStorage.setItem('mm-map', m); } catch (e) { try { window.name = 'mm-map=' + m; } catch (e2) { /* it stays on this map */ } }
}
export const CITY = PARIS || NYC || TOKYO || (typeof __CITY__ === 'boolean' && __CITY__) || (!MAP_FIXED && chosenMap() === 'city');
export const WX = CITY ? 1024 : TILE_X * TILES, WY = PARIS || NYC || TOKYO ? 256 : CITY ? 224 : 128, WZ = CITY ? 1024 : TILE_Z * TILES, CH = 16;
export const NCX = WX / CH, NCZ = WZ / CH;

// ---- storage ---------------------------------------------------------------
// The world is mostly air, so it is kept in bricks of 8 x 8 x 8 voxels that exist only where something has been built.
// (Five flat arrays cost 6 bytes for every cell of the map, air included: 164 MB for the first big map.)
//
// A cell is named by a handle: x in the low 10 bits, z in the next 10, y above that. Handles work like the old flat
// index: a neighbour is a fixed step away (1, SX, SXZ) and x, z, y come back out with a mask and a shift. The handle
// space is 1024 x 1024 x 256 whatever the map size, so WX, WZ and WY can be anything up to that.
//
// Each brick has a slot in the pools. Slot 0 is a brick of zeros shared by every cell that has no brick, so reading
// never branches. Material and owner live in one pair of pools. What damage leaves behind lives in a second pool with its
// own table, one byte a cell, made only for bricks that have been hit: bit 0 gone (a voxel used to be here, so neighbours
// show a broken face), bit 1 burning, and the top six bits soot (0..252 in steps of 4, darkening from fire).
// The pools grow a slice at a time, so a long rampage never doubles them in one go.
export const SX = 1024, SXZ = 1 << 20, XM = 1023, ZS = 10, ZM = 1023, YS = 20, NV = 1 << 28;
export const idx = (x, y, z) => x | z << 10 | y << 20;
const BN = 512, NT = 1 << 19;
const tab = new Int32Array(NT), ftab = new Int32Array(NT);   // brick -> offset into the pools (0: no brick)
const STEP = 4096;
let cap = 8192, used = 1, fcap = 2048, fused = 1;
let voxP = new Uint8Array(cap * BN), ownP = new Uint16Array(cap * BN);
let fxP = new Uint8Array(fcap * BN);
const bricks = [];                                           // every brick that has a slot, for walking the world
const brickOf = (i) => ((i >> 3) & 127) | ((i >> 13) & 127) << 7 | (i >> 23) << 14;
const cellOf = (i) => (i & 7) | ((i >> 10) & 7) << 3 | ((i >> 20) & 7) << 6;
function grown(a, n) { const b = new a.constructor(n); b.set(a); return b; }
function alloc(b) {
  if (used === cap) { cap += STEP; voxP = grown(voxP, cap * BN); ownP = grown(ownP, cap * BN); }
  bricks.push(b);
  return tab[b] = used++ * BN;
}
function falloc(b) {
  if (fused === fcap) { fcap += STEP; fxP = grown(fxP, fcap * BN); }
  return ftab[b] = fused++ * BN;
}
export function voxAt(i) { return voxP[tab[brickOf(i)] + cellOf(i)]; }
export function ownerAt(i) { return ownP[tab[brickOf(i)] + cellOf(i)]; }
export function goneAt(i) { return fxP[ftab[brickOf(i)] + cellOf(i)] & 1; }
export function burnAt(i) { return fxP[ftab[brickOf(i)] + cellOf(i)] >> 1 & 1; }
export function sootAt(i) { return fxP[ftab[brickOf(i)] + cellOf(i)] & 252; }
export function setVox(i, m) { const b = brickOf(i); let o = tab[b]; if (!o) { if (!m) return; o = alloc(b); } voxP[o + cellOf(i)] = m; }
export function setCell(i, m, id) { const b = brickOf(i), o = (tab[b] || alloc(b)) + cellOf(i); voxP[o] = m; ownP[o] = id; }
function setFx(i, keep, v) { const b = brickOf(i); let o = ftab[b]; if (!o) { if (!v) return; o = falloc(b); } o += cellOf(i); fxP[o] = fxP[o] & keep | v; }
export function setGone(i, v) { setFx(i, 254, v ? 1 : 0); }
export function setBurn(i, v) { setFx(i, 253, v ? 2 : 0); }
export function setSoot(i, v) { setFx(i, 3, v > 252 ? 252 : v & 252); }
// 1 if any brick of the 16 x 8 x 16 slab of chunk column (cx, cz) at brick layer by holds anything; for skipping air
export function slabUsed(cx, cz, by) { const b = cx * 2 | cz * 2 << 7 | by << 14; return (tab[b] | tab[b + 1] | tab[b + 128] | tab[b + 129]) ? 1 : 0; }
// Call fn(handle, material) for every solid voxel.
export function eachVoxel(fn) {
  for (let k = 0; k < bricks.length; k++) {
    const b = bricks[k], o = tab[b], base = (b & 127) << 3 | ((b >> 7) & 127) << 13 | (b >> 14) << 23;
    for (let c = 0; c < BN; c++) { const m = voxP[o + c]; if (m) fn(base + ((c & 7) | ((c >> 3) & 7) << 10 | (c >> 6) << 20), m); }
  }
}
export const storage = () => ({ bricks: used - 1, damaged: fused - 1, MB: +((cap * BN * 3 + fcap * BN + NT * 8) / 1e6).toFixed(1) });
export function solid(x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= WX || y >= WY || z >= WZ) return 0;
  return voxAt(x | z << 10 | y << 20);
}

// ---- layout ---------------------------------------------------------------
// Lots are 40 voxels square. Six streets (three each way) run edge to edge, so every route is at most two corners
// (the army's street planner relies on that). Between them sit four blocks of six lots, back to back across alleys.
export const LOT = 40, WALK = 6, ROADW = 24;
// street centre lines. The city's are unevenly spaced, so its blocks are 2, 3 or 4 lots across and 1, 2 or 3 rows deep (city.js).
// Paris: seven streets across (the two in the middle are the quays either side of the Seine) and five down, which are its bridges.
// New York: six streets across (the first is in the Bronx, the other five cross the East River to Brooklyn) and five avenues down.
export const STREET_Z = TOKYO ? [108, 230, 352, 524, 646, 768, 890] : NYC ? [150, 372, 494, 616, 738, 860] : PARIS ? [144, 266, 388, 560, 728, 850, 972] : CITY ? [80, 202, 324, 492, 614, 736, 858, 934] : tiled([80, 202, 324], TILE_Z);
export const STREET_X = TOKYO ? [156, 330, 504, 678, 936] : NYC ? [262, 436, 610, 738, 952] : PARIS ? [191, 365, 539, 759, 841] : CITY ? [80, 254, 382, 602, 776, 904] : tiled([80, 254, 428], TILE_X);
export const SPAWN = TOKYO ? { x: 936, z: 890, yaw: -1.8 } : NYC ? { x: 952, z: 860, yaw: -1.8 } : PARIS ? { x: 841, z: 972, yaw: -2.3 } : CITY ? { x: 80, z: 934, yaw: 2.55 } : { x: 80, z: 324, yaw: 2.3 };   // the south-west crossing, in the suburbs, looking up at the downtown skyline
export let totalInit = 0;

// ---- materials -----------------------------------------------------------
// kind picks the per-voxel look in the shader. shape: 0 cube, 1 plank, 2 shard, 3 chunk, 4 fleck, 5 drop, 6 sheet
export const K = { PLAIN: 0, BRICK: 1, PLASTER: 2, ROOF: 3, CONC: 4, GLASS: 5, WOOD: 6, METAL: 7, LEAF: 8, STONE: 9, REBAR: 10, CHAR: 11, LIT: 12, CLOTH: 13, WATER: 14, BROKEN: 15 };
export const M = {};
export const NMAT = 96;
export const MAT_R = new Float32Array(NMAT), MAT_G = new Float32Array(NMAT), MAT_B = new Float32Array(NMAT);
export const SOFT = new Float32Array(NMAT), CARRY = new Uint8Array(NMAT), TOUGH = new Float32Array(NMAT), HARD = new Uint8Array(NMAT);
export const KIND = new Uint8Array(NMAT), SHAPE = new Uint8Array(NMAT), SEE = new Uint8Array(NMAT);
export const FLAM = new Float32Array(NMAT), BURN = new Float32Array(NMAT), CHARP = new Float32Array(NMAT);
{
  const c = new THREE.Color();
  const def = (id, name, hex, soft, carry, tough, kind, shape, flam = 0, burn = 0, charp = 0) => {
    M[name] = id; c.setHex(hex, THREE.SRGBColorSpace);
    MAT_R[id] = c.r; MAT_G[id] = c.g; MAT_B[id] = c.b; SOFT[id] = soft; CARRY[id] = carry; TOUGH[id] = tough;
    KIND[id] = kind; SHAPE[id] = shape; FLAM[id] = flam; BURN[id] = burn; CHARP[id] = charp;
  };
  def(1, 'BRICK', 0x9d5846, 0.95, 1, 0.5, K.BRICK, 0);
  def(2, 'BRICK2', 0xc79a6c, 0.95, 1, 0.5, K.BRICK, 0);
  def(3, 'CONC', 0xb9b6ae, 0.88, 1, 0.62, K.CONC, 3);
  def(4, 'PL_W', 0xece4d2, 1.0, 1, 0.4, K.WOOD, 1, 0.55, 3, 0.55);
  def(5, 'PL_Y', 0xdcb76a, 1.0, 1, 0.4, K.WOOD, 1, 0.55, 3, 0.55);
  def(6, 'PL_B', 0x8dbbd4, 1.0, 1, 0.4, K.WOOD, 1, 0.55, 3, 0.55);
  def(7, 'PL_P', 0xe29a8f, 1.0, 1, 0.4, K.WOOD, 1, 0.55, 3, 0.55);
  def(8, 'ROOF_R', 0x8e4a3a, 1.05, 1, 0.35, K.ROOF, 6, 0.3, 2.5, 0.4);
  def(9, 'ROOF_S', 0x4a5563, 1.05, 1, 0.35, K.ROOF, 6, 0.18, 2.5, 0.4);
  def(10, 'GLASS', 0x8fc6d8, 1.7, 0, 0, K.GLASS, 2);
  def(11, 'WOOD', 0x8a5a34, 1.1, 1, 0.3, K.WOOD, 1, 0.7, 3, 0.5);
  def(12, 'LEAF', 0x4d8846, 1.25, 0, 0, K.LEAF, 4, 0.8, 1.2, 0);
  def(13, 'LEAF2', 0x73a457, 1.25, 0, 0, K.LEAF, 4, 0.8, 1.2, 0);
  def(14, 'TRUNK', 0x6b4a2e, 1.0, 1, 0.4, K.WOOD, 1, 0.4, 4, 0.8);
  def(15, 'METAL', 0x7d8790, 0.9, 1, 0.55, K.METAL, 6);
  def(16, 'TYRE', 0x24262b, 1.0, 1, 0.3, K.PLAIN, 0, 0.5, 5, 0.3);
  def(17, 'SPANDREL', 0x4f7390, 1.1, 0, 0.2, K.METAL, 6);
  def(18, 'STEEL', 0x56606c, 0.62, 4, 0.86, K.METAL, 6);
  def(19, 'WATER', 0x4aa3df, 1.6, 0, 0, K.WATER, 5);
  def(20, 'STONE', 0x9d988c, 0.9, 1, 0.6, K.STONE, 3);
  def(21, 'AWN_R', 0xc94a40, 1.2, 0, 0, K.CLOTH, 6, 0.9, 1.2, 0);
  def(22, 'AWN_W', 0xf5efe2, 1.2, 0, 0, K.CLOTH, 6, 0.9, 1.2, 0);
  def(23, 'FUEL', 0xd2493a, 1.0, 1, 0, K.METAL, 6);
  def(24, 'LIT', 0xffd98a, 1.5, 0, 0, K.LIT, 2);
  def(25, 'TANK', 0x5f87a8, 0.95, 1, 0.5, K.METAL, 6);
  def(26, 'TRIM', 0xf3eee2, 1.0, 1, 0.4, K.PLAIN, 3);
  def(27, 'DARK', 0x363b45, 1.0, 1, 0.4, K.PLAIN, 0);
  def(28, 'HEDGE', 0x3f7240, 1.25, 0, 0, K.LEAF, 4, 0.8, 1.2, 0);
  def(29, 'ROOF_G', 0x3f7d6e, 1.05, 1, 0.35, K.ROOF, 6, 0.3, 2.5, 0.4);
  def(30, 'SIGN', 0xf0a23a, 1.1, 1, 0, K.PLAIN, 6);
  def(31, 'PL_G', 0x9aca98, 1.0, 1, 0.4, K.WOOD, 1, 0.55, 3, 0.55);
  def(32, 'CHAR', 0x2c2724, 1.4, 0, 0, K.CHAR, 0);
  def(33, 'REBAR', 0x8a5e4a, 0.8, 0, 0.45, K.REBAR, 1);
  def(35, 'WP_A', 0xe6b5a6, 1.1, 0, 0.2, K.PLASTER, 0, 0.4, 2, 0.3);
  def(36, 'WP_B', 0xa7c5d4, 1.1, 0, 0.2, K.PLASTER, 0, 0.4, 2, 0.3);
  def(37, 'WP_C', 0xd6d198, 1.1, 0, 0.2, K.PLASTER, 0, 0.4, 2, 0.3);
  def(38, 'FLOOR', 0xb58a5a, 1.1, 1, 0.3, K.WOOD, 1, 0.6, 3, 0.5);
  def(39, 'FURN_A', 0xc8503c, 1.2, 0, 0, K.CLOTH, 0, 0.7, 2, 0.2);
  def(40, 'FURN_B', 0x3d8f8a, 1.2, 0, 0, K.CLOTH, 0, 0.7, 2, 0.2);
  def(41, 'FURN_C', 0xf1f1ee, 1.2, 0, 0, K.PLAIN, 0);
  def(42, 'LIT_W', 0xfff6e0, 1.5, 0, 0, K.LIT, 2);
  def(43, 'LIT_Y', 0xffd23a, 1.5, 0, 0, K.LIT, 2);
  def(44, 'LIT_R', 0xff5a48, 1.5, 0, 0, K.LIT, 2);
  def(45, 'DOOR_R', 0x99392f, 1.1, 0, 0.3, K.WOOD, 1, 0.6, 3, 0.5);
  def(46, 'DOOR_B', 0x2f5f8f, 1.1, 0, 0.3, K.WOOD, 1, 0.6, 3, 0.5);
  def(47, 'DOOR_G', 0x2f6b4f, 1.1, 0, 0.3, K.WOOD, 1, 0.6, 3, 0.5);
  def(48, 'REND_C', 0xe6dcc6, 0.95, 1, 0.5, K.PLASTER, 3);
  def(49, 'REND_Y', 0xd9b25a, 0.95, 1, 0.5, K.PLASTER, 3);
  def(50, 'REND_T', 0x6fa9a0, 0.95, 1, 0.5, K.PLASTER, 3);
  def(51, 'REND_P', 0xd98f7e, 0.95, 1, 0.5, K.PLASTER, 3);
  def(52, 'CAR_A', 0xb7332b, 0.95, 1, 0.3, K.METAL, 6);
  def(53, 'CAR_B', 0x3b6ea5, 0.95, 1, 0.3, K.METAL, 6);
  def(54, 'CAR_C', 0xe8e2d0, 0.95, 1, 0.3, K.METAL, 6);
  def(55, 'FLOWER_R', 0xe8527a, 1.3, 0, 0, K.LEAF, 4, 0.8, 1, 0);
  def(56, 'FLOWER_Y', 0xf2c230, 1.3, 0, 0, K.LEAF, 4, 0.8, 1, 0);
  def(57, 'SLAB', 0xc9c4b8, 0.9, 1, 0.6, K.CONC, 3);
  def(58, 'LIT_B', 0x7fd8ff, 1.5, 0, 0, K.LIT, 2);
  def(59, 'ROOF_D', 0x39404a, 1.05, 1, 0.35, K.ROOF, 6, 0.18, 2.5, 0.4);
  def(60, 'STAIN_R', 0xc8453c, 1.6, 0, 0, K.GLASS, 2);
  def(61, 'STAIN_B', 0x3f6fc4, 1.6, 0, 0, K.GLASS, 2);
  def(62, 'STAIN_Y', 0xe8b83a, 1.6, 0, 0, K.GLASS, 2);
  def(63, 'BRASS', 0xc9a24a, 0.9, 1, 0.5, K.METAL, 6);
  def(64, 'AWN_B', 0x3f78b0, 1.2, 0, 0, K.CLOTH, 6, 0.9, 1.2, 0);
  def(65, 'AWN_G', 0x3f8a5c, 1.2, 0, 0, K.CLOTH, 6, 0.9, 1.2, 0);
  def(66, 'DIRT', 0x8a6f4d, 1.2, 0, 0, K.PLAIN, 0);
  // tinted glazing for the office towers: green and bronze glass, each with its own spandrel panel
  def(67, 'GLASS_G', 0x86c9b0, 1.7, 0, 0, K.GLASS, 2);
  def(68, 'GLASS_Z', 0xd2ac7c, 1.7, 0, 0, K.GLASS, 2);
  def(69, 'SPAN_G', 0x3f6f62, 1.1, 0, 0.2, K.METAL, 6);
  def(70, 'SPAN_Z', 0x8a6238, 1.1, 0, 0.2, K.METAL, 6);
  // Paris: cut limestone in two tones, zinc for the roofs and the brown-painted iron of the tower
  def(71, 'LIME', 0xe4d8ba, 0.92, 1, 0.55, K.STONE, 3);
  def(72, 'LIME2', 0xd6c6a2, 0.92, 1, 0.55, K.STONE, 3);
  def(73, 'ZINC', 0x8d99a8, 1.05, 1, 0.35, K.ROOF, 6);
  def(74, 'IRON', 0x77614a, 0.9, 4, 0.5, K.METAL, 6);
  HARD[M.IRON] = 1;
  // New York: brownstone, the statue's weathered copper in two tones, pink granite, taxi yellow, bright steel and two more sign lights
  def(75, 'BROWNST', 0x7d5444, 0.92, 1, 0.55, K.STONE, 3);
  def(76, 'COPPER', 0x9cdcc6, 0.9, 2, 0.55, K.PLASTER, 6);
  def(77, 'COPPER2', 0x80c6ae, 0.9, 2, 0.55, K.PLASTER, 6);
  def(78, 'GRANITE', 0xb9aa9a, 0.88, 1, 0.65, K.STONE, 3);
  def(79, 'TAXI', 0xf2b61c, 0.95, 1, 0.3, K.METAL, 6);
  def(80, 'CHROME', 0xc3ccd6, 0.9, 2, 0.55, K.METAL, 6);
  def(81, 'LIT_G', 0x6cf08a, 1.5, 0, 0, K.LIT, 2);
  def(82, 'LIT_P', 0xff62c8, 1.5, 0, 0, K.LIT, 2);
  // Tokyo: lacquer red, cherry blossom, and the broadcast tower's orange and white steel
  def(83, 'VERMIL', 0xd2412b, 1.0, 1, 0.4, K.WOOD, 1, 0.55, 3, 0.55);
  def(84, 'SAKURA', 0xf4a9c6, 1.25, 0, 0, K.LEAF, 4, 0.8, 1.2, 0);
  def(85, 'SAKURA2', 0xfbd0e0, 1.25, 0, 0, K.LEAF, 4, 0.8, 1.2, 0);
  def(86, 'TWR_R', 0xe8552a, 0.9, 4, 0.5, K.METAL, 6);
  def(87, 'TWR_W', 0xf1eee6, 0.9, 4, 0.5, K.METAL, 6);
  HARD[M.TWR_R] = HARD[M.TWR_W] = 1;
  HARD[M.GRANITE] = 1;
  HARD[M.CONC] = HARD[M.METAL] = HARD[M.STONE] = HARD[M.STEEL] = HARD[M.SLAB] = 1;
  SEE[M.REBAR] = 1;
}
// glass in any colour breaks as a pane
export const PANE = new Uint8Array(NMAT);
PANE[M.GLASS] = PANE[M.STAIN_R] = PANE[M.STAIN_B] = PANE[M.STAIN_Y] = PANE[M.GLASS_G] = PANE[M.GLASS_Z] = 1;

export function jitter(x, y, z) {
  const h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) >>> 0;
  return 0.88 + (h % 1024) / 1024 * 0.24;
}

// ---- rng -----------------------------------------------------------------
let seed = 1;
export function setSeed(s) { seed = s | 0; }
export function rnd() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

// ---- bodies --------------------------------------------------------------
export const bodies = [null];
export const lots = [];
export const rubbleBody = [];
export const ctx = { L: 0, lot: -1 };
let cur = null;
export function begin(name, kind, structural = true) {
  cur = {
    id: bodies.length, name, kind, structural, level: ctx.L, lot: ctx.lot, lit: ctx.L >= 3,
    x0: 1e9, y0: 0, z0: 1e9, x1: -1, y1: 0, z1: -1,
    count: 0, init: 0, layers: new Int32Array(WY), carry: new Int32Array(WY), layers0: null, dCarry: null, dAbove: null,
    dead: false, explosive: 0, exploded: false, failing: false, nextMode: null,
  };
  bodies.push(cur);
  if (ctx.lot >= 0 && lots[ctx.lot].main === 0) lots[ctx.lot].main = cur.id;
  return cur;
}
// Generators draw a lot around a local origin with its front toward low z. place() turns the lot to face its street:
// 0 north (low z), 1 east (high x), 2 south (high z), 3 west (low x). -1 means plain world coordinates.
export const LOC = 64;
let rot = -1, ox = 0, oz = 0, osz = 39, wx = 0, wz = 0;
export function place(x, z, r, size = LOT) { ox = x; oz = z; rot = r; osz = size - 1; }
function tf(x, z) {
  if (rot < 0) { wx = x; wz = z; return; }
  const a = x - LOC, b = z - LOC;
  if (rot === 0) { wx = ox + a; wz = oz + b; }
  else if (rot === 2) { wx = ox + osz - a; wz = oz + osz - b; }
  else if (rot === 3) { wx = ox + b; wz = oz + osz - a; }
  else { wx = ox + osz - b; wz = oz + a; }
}
export function set(x, y, z, m) {
  tf(x, z); x = wx; z = wz;
  if (x < 1 || z < 1 || x >= WX - 1 || z >= WZ - 1 || y < 0 || y >= WY) return;
  const i = idx(x, y, z);
  setCell(i, m, cur.id);
  if (x < cur.x0) cur.x0 = x; if (x > cur.x1) cur.x1 = x;
  if (z < cur.z0) cur.z0 = z; if (z > cur.z1) cur.z1 = z;
  if (y > cur.y1) cur.y1 = y;
}
export function get(x, y, z) { tf(x, z); return solid(wx, y, wz); }
export function clr(x, y, z) { tf(x, z); x = wx; z = wz; if (x < 0 || y < 0 || z < 0 || x >= WX || y >= WY || z >= WZ) return; const i = idx(x, y, z); if (voxAt(i)) setCell(i, 0, 0); }
export function put(x, y, z, m) { if (!get(x, y, z)) set(x, y, z, m); } // only into empty space
export function box(x0, y0, z0, x1, y1, z1, m) {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, y, z, m);
}
export function fill(x0, y0, z0, x1, y1, z1, m) {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) put(x, y, z, m);
}
export function hole(x0, y0, z0, x1, y1, z1) {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) clr(x, y, z);
}
export function walls(x0, y0, z0, x1, y1, z1, m) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) { set(x, y, z0, m); set(x, y, z1, m); }
    for (let z = z0; z <= z1; z++) { set(x0, y, z, m); set(x1, y, z, m); }
  }
}

// ---- after building: counts and load tables --------------------------------
export const levelStats = [];
export function finalize() {
  for (let r = 0; r < 4; r++) levelStats.push({ voxels: 0, quads: 0 });
  eachVoxel((i, m) => {
    const b = bodies[ownerAt(i)], y = i >> YS;
    b.count++; b.layers[y]++; b.carry[y] += CARRY[m];
    levelStats[b.level].voxels++;
  });
  for (let i = 1; i < bodies.length; i++) {
    const b = bodies[i];
    b.init = b.count; b.layers0 = b.layers.slice(); b.dCarry = b.carry.slice();
    b.dAbove = new Float64Array(WY);
    for (let y = WY - 2; y >= 0; y--) b.dAbove[y] = b.dAbove[y + 1] + b.layers[y + 1];
    totalInit += b.count;
  }
}
