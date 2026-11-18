// Cairo: the fifth map. The same size as the big city, Paris, New York and Tokyo, on the same kind of street grid (the
// army's route finding and the rivals need straight streets that run edge to edge). Built when the bundle is made with
// __CAIRO__ (python3 build.py cairo). The streets are in world.js; this file turns them into lots.
//
// North is low z. The Nile runs down the middle of the map, the whole height of it, round a long island. Every street
// across is a bridge. West of the river: the town of Giza in the north, bare brick and concrete, and south of it the
// desert, where the three pyramids stand in their slanting line with the Sphinx in front of the second, looking east
// at the river. On the island: gardens, villas, the Lotus Tower and the opera house. East of the river: the hotels along
// the corniche, downtown behind them with the pink museum and the square with the obelisk, then the old town of
// narrow houses and the bazaar, and the Citadel on its rise in the south-east. Fields and palm groves along the south.
// He hatches in the desert south of the pyramids, with a mud-brick village beside him: out of the sand.
//
// The map is flat: the water is painted on the ground and monsters wade. A street that crosses water is a bridge.
// The tower is our own take under our own name; the pyramids, the Sphinx, the Citadel and the museum keep theirs.
import { M, STREET_X } from './world.js';
import { baladi, oldhouse, souk, mosque, palms, nilehotel, villa, village, mastabas, camp, dig, obelisk } from './cairo_kit.js';
import { greatpyramid, khafre, menkaure, sphinx, citadel, lotustower, museum, opera, GREAT, KHAFRE, MENK, SPHINX, CITADEL, MUSEUM, OPERA } from './cairo_landmarks.js';

// where each column and row of 40-voxel lots starts: 6 apart inside a block, a street's width apart across one
export const PX = [6, 52, 98, 144, 223, 269, 315, 438, 484, 607, 653, 699, 778, 824, 870, 949];
export const PZ = [4, 50, 126, 172, 248, 294, 370, 416, 462, 542, 588, 634, 714, 760, 806, 886, 932];
export const NILE = { x0: 394, x1: 566 };                                   // the river, the whole height of the map
export const ISLE = { x0: 434, x1: 528, z0: 256, z1: 842, r: 30 };          // the island in it, with rounded ends
export const DESERT = { x1: 390, z0: 334 };                                 // west of the river and south of the town: sand
export const GREAT_AT = { x: 223, z: 370 }, KHAFRE_AT = { x: 40, z: 542 }, MENK_AT = { x: 20, z: 724 }, SPHINX_AT = { x: 223, z: 542 };
export const CITADEL_AT = { x: 778, z: 714 }, LOTUS_AT = { x: 438, z: 416 }, MUSEUM_AT = { x: 607, z: 416 }, OPERA_AT = { x: 438, z: 542 }, TAHRIR_AT = { x: 607, z: 542 };
// is this spot on the island?
export function isle(x, z) {
  const I = ISLE; if (x < I.x0 || x >= I.x1 || z < I.z0 || z >= I.z1) return false;
  const cx = Math.max(I.x0 + I.r, Math.min(I.x1 - I.r, x)), cz = Math.max(I.z0 + I.r, Math.min(I.z1 - I.r, z));
  return (x - cx) * (x - cx) + (z - cz) * (z - cz) <= I.r * I.r;
}
// is this spot water?
export function wet(x, z) { return x >= NILE.x0 && x < NILE.x1 && !isle(x, z); }
export const sandy = (x, z) => x < DESERT.x1 && z > DESERT.z0;

// One letter a lot. Capitals are districts, filled from a weighted list:
//   G Giza town   B the wards of flats   D downtown   O the old town   S the bazaar   H the hotels on the corniche
//   F fields and groves   V the village
// Small letters are single pieces: p a palm garden, o an oasis, v a villa, r a round hotel, t and c a camp, x a dig,
// m a field of old tombs. A dot is water, sand, or ground a big piece takes.
const MAP = [
  'GGGGGGB..BBBBBBB',
  'GGGGGGH..HBBBBBB',
  'GGGGGGB..HDDBBBB',
  'FGGGGGH..DDDBOOO',
  'FGGGGBB..HDDOOOO',
  'FFGGGBHppDDDOOOO',
  '.......vpHDDSSOO',
  '.mm.....p..DSSOO',
  '.m.....pr..DOSOO',
  '..........DDOOOO',
  '.........HDDOOOO',
  '.......pvHDDOOOO',
  '....t.cvpHBB...O',
  '.....x.pvpBB...O',
  '....o.t..BBB...O',
  '..o.VVF..FBBBFBF',
  '....VFF..FFBFBFF',
];
// the pieces that are not one plain lot: 'c,r' of the lot at their north-west corner (x and z move them off the grid)
const FIXED = {
  '4,6': { k: 'greatpyramid', s: GREAT.S, f: 0, d: 'giza' },
  '0,9': { k: 'khafre', s: KHAFRE.S, f: 0, d: 'giza', x: KHAFRE_AT.x },
  '0,12': { k: 'menkaure', s: MENK.S, f: 0, d: 'giza', x: MENK_AT.x, z: MENK_AT.z },
  '4,9': { k: 'sphinx', s: SPHINX.S, f: 1, d: 'giza' },
  '12,12': { k: 'citadel', s: CITADEL.S, f: 2, d: 'citadel' },
  '7,7': { k: 'lotustower', f: 1, d: 'gezira' },
  '9,7': { k: 'museum', s: MUSEUM.S, f: 2, d: 'downtown' },
  '7,9': { k: 'opera', s: OPERA.S, f: 1, d: 'gezira' },
  '9,9': { k: 'obelisk', f: 0, d: 'downtown' },
};
// which way a lot fronts: the street along its row, or for the rows with none the avenue beside its column
const ROW_F = [-1, 2, 0, 2, 0, 2, 0, -1, 2, 0, -1, 2, 0, -1, 2, 0, -1], BACK_F = { 0: 2, 7: 0, 10: 0, 13: 2, 16: 0 };
const WEST_OF = new Set([3, 6, 11, 14]), EAST_OF = new Set([4, 9, 12, 15]);   // columns with an avenue on their east, or west, side

// ---- choosing what goes on a lot ------------------------------------------------------------------
let seed = 19690405;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[(rnd() * a.length) | 0], ri = (a, b) => a + ((rnd() * (b - a + 1)) | 0);
function deck(list) { let d = []; return () => { if (!d.length) { d = list.slice(); for (let i = d.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; } } return d.pop(); }; }

const PLASTER = [M.MUD, M.MUD, M.OCHRE, M.LIME2, M.REND_C, M.SAND, M.REND_Y, M.LIME, M.REND_P], OLD = [M.MUD, M.LIME2, M.OCHRE, M.SAND2, M.REND_C, M.LIME];
const SHUT = [M.DOOR_G, M.DOOR_G, M.DOOR_B, M.WOOD, M.ROOF_G, M.TRUNK], AWNS = [M.AWN_R, M.AWN_G, M.AWN_B, M.SIGN, M.DOOR_B], DOORS = [M.DOOR_R, M.DOOR_B, M.DOOR_G, M.WOOD];
const CARS = [M.CAR_C, M.CAR_C, M.CAR_A, M.CAR_B, M.DARK], PAPER = [M.WP_A, M.WP_B, M.WP_C], INKS = [M.LIT_W, M.LIT_Y, M.LIT_R], STONE = [M.LIME2, M.LIME, M.SAND, M.REND_C, M.MUD];
// the signs: short words, each with a board and a letter colour (our own made-up shops)
const W3 = deck([['TEA', M.DOOR_G, M.LIT_W], ['FIG', M.CAR_A, M.LIT_Y], ['OUD', M.DARK, M.LIT_W], ['NUT', M.TRUNK, M.LIT_Y], ['GEM', M.CAR_B, M.LIT_W], ['OIL', M.SIGN, M.DARK], ['DYE', M.LIT_P, M.LIT_W], ['TIN', M.METAL, M.DARK],
  ['PIE', M.LIT_Y, M.CAR_A], ['MAP', M.TRIM, M.CAR_B], ['HAT', M.DARK, M.LIT_Y], ['KEY', M.BRASS, M.DARK], ['RUG', M.CAR_A, M.LIT_W], ['JAM', M.LIT_R, M.LIT_W], ['INK', M.TRIM, M.DARK], ['ICE', M.LIT_B, M.LIT_W]]);
const W4 = deck([['CAFE', M.DOOR_G, M.LIT_W], ['NILE', M.CAR_B, M.LIT_W], ['GOLD', M.DARK, M.LIT_Y], ['RUGS', M.CAR_A, M.LIT_Y], ['LAMP', M.DARK, M.LIT_Y], ['DATE', M.TRUNK, M.LIT_W], ['FIGS', M.DOOR_G, M.LIT_Y], ['MINT', M.LIT_G, M.DARK],
  ['SOUK', M.SIGN, M.DARK], ['BANK', M.TRIM, M.CAR_B], ['ROSE', M.LIT_P, M.LIT_W], ['SILK', M.CAR_B, M.LIT_Y], ['SALT', M.TRIM, M.DARK], ['RICE', M.LIT_Y, M.DARK], ['BEAN', M.TRUNK, M.LIT_Y], ['TAXI', M.TAXI, M.DARK],
  ['BOOK', M.CAR_A, M.LIT_W], ['FISH', M.LIT_B, M.DARK], ['SODA', M.LIT_R, M.LIT_W], ['KITE', M.LIT_W, M.CAR_A]]);
const SMALL = deck([['JUICE', 'Juice bar'], ['BREAD', 'Bakery'], ['SPICE', 'Spice shop'], ['LAMPS', 'Lamp shop'], ['BOOKS', 'Bookshop'], ['SWEET', 'Sweet shop'], ['CAFE', 'Coffee house'], ['DATES', 'Date shop'], ['RUGS', 'Carpet shop'], ['TEA', 'Tea house']]);
const STREET = deck([['CAFE', 'Cafe block', 1], ['NILE', 'Nile block', 0], ['LOTUS', 'Lotus block', 1], ['GRAND', 'Grand block', 0], ['OASIS', 'Oasis block', 1], ['SCARAB', 'Scarab block', 0], ['PALM', 'Palm block', 1], ['DELTA', 'Delta block', 0]]);
const FILMS = deck(['RIO', 'LUX', 'GEM', 'ROX']), GLASS_T = deck(['BANK', 'NILE', 'DELTA', 'APEX', 'ORYX', 'SUN']), HOTELS = deck(['NILE', 'LOTUS', 'OASIS', 'RA', 'SUN', 'PALM', 'DELTA', 'IBIS', 'ORYX', 'DUNE']);
const SOUKS = deck(['SOUK', 'SPICE', 'GOLD', 'RUGS', 'LAMPS', 'BAZAAR', 'SILK', 'BRASS']);
const cap = (s) => s[0] + s.slice(1).toLowerCase();

const MAKE = {
  // style: 'raw' bare brick, 'mix' mostly plaster, 'low' the old town's, 'tall' downtown's
  baladi: (style) => {
    const n = rnd() < (style === 'tall' ? 0.6 : 0.35) ? 2 : 3, [lo, hi] = style === 'raw' ? [5, 9] : style === 'low' ? [3, 5] : style === 'tall' ? [6, 9] : [4, 7], pr = style === 'raw' ? 0.75 : style === 'mix' ? 0.15 : 0;
    const raw = [0, 0, 0].map(() => (rnd() < pr ? 1 : 0)), deckW = n === 2 ? W4 : W3;
    return { n, floors: [ri(lo, hi), ri(lo, hi), ri(lo, hi)], walls: [pick(PLASTER), pick(PLASTER), pick(PLASTER)], raw, shut: [pick(SHUT), pick(SHUT), pick(SHUT)], signs: [deckW(), deckW(), deckW()],
      roofs: raw.map((b) => (b && rnd() < 0.6 ? 3 : ri(0, 2))), awn: [pick(AWNS), pick(AWNS), pick(AWNS)], palm: rnd() < 0.25 ? 1 : 0, car: rnd() < 0.3 ? pick(CARS) : 0 };
  },
  oldhouse: () => ({ floors: [ri(2, 4), ri(2, 3), ri(2, 4)], walls: [pick(OLD), pick(OLD), pick(OLD)], wood: [pick([M.TRUNK, M.WOOD]), M.TRUNK, pick([M.TRUNK, M.WOOD])], doors: [pick(DOORS), pick(DOORS), pick(DOORS)], roofs: [ri(0, 2), ri(0, 2), ri(0, 2)], cloth: [pick(AWNS), pick(AWNS), pick(AWNS)], palm: rnd() < 0.3 ? 1 : 0, jars: rnd() < 0.5 ? 1 : 0 }),
  souk: () => { const name = SOUKS(); return { name, title: cap(name) + ' bazaar', cloth: [pick(AWNS), pick(AWNS), pick(AWNS), pick(AWNS)], goods: ri(0, 7), domeM: pick([M.LIME, M.REND_T, M.LIME2]) }; },
  mosque: () => ({ domeM: pick([M.LIME2, M.REND_T, M.ROOF_G, M.LIME]), stripe: pick([M.OCHRE, M.REND_P, M.LIME2]), tower: rnd() < 0.35 ? 1 : 0, rib: rnd() < 0.5 ? M.LIME : 0 }),
  palms: (v = 0) => ({ v }),
  nilehotel: (round) => { const name = HOTELS(); return { name, title: cap(name) + ' hotel', floors: ri(9, 14), round: round === undefined ? rnd() < 0.3 : round, wall: pick([M.LIME, M.TRIM, M.LIME2, M.REND_C]), glass: pick([M.GLASS_Z, M.GLASS, M.GLASS_G]), ink: pick(INKS), car: rnd() < 0.4 ? pick(CARS) : 0 }; },
  villa: () => ({ wall: pick([M.REND_C, M.REND_Y, M.LIME, M.REND_P, M.TRIM]), door: pick(DOORS) }),
  village: () => ({ v: ri(0, 3) }),
  mastabas: () => ({ v: ri(0, 5) }),
  camp: (v = 0) => ({ v }),
  dig: () => ({}),
  haussmann: (lo, hi) => { const [name, title, terrace] = STREET(); return { floors: ri(lo, hi), name, title, terrace, wall: pick(STONE), front: pick([M.DOOR_G, M.TRUNK, M.DOOR_B, M.DARK]), awn: pick(AWNS), door: pick(DOORS), roof: pick([M.ZINC, M.ROOF_D, M.ROOF_R]), inside: rnd() < 0.25, car: rnd() < 0.3 ? pick(CARS) : 0 }; },
  shop: () => { const [name, title] = SMALL(); return { name, title, wall: pick(STONE), awn: pick(AWNS), door: pick(DOORS), ink: pick(INKS), car: rnd() < 0.4 ? pick(CARS) : 0, paper: pick(PAPER) }; },
  flats: (lo, hi) => ({ floors: ri(lo, hi), wall: pick([M.REND_C, M.LIME2, M.MUD, M.CONC, M.REND_Y]), door: pick(DOORS), awn: pick(AWNS), car: rnd() < 0.4 ? pick(CARS) : 0, title: pick(['Corniche flats', 'Garden flats', 'Nile flats', 'Palm court']) }),
  tower: (lo, hi) => { const name = GLASS_T(); return { floors: ri(lo, hi), name, title: cap(name) + ' tower', glass: pick([M.GLASS_Z, M.GLASS_Z, M.GLASS_G]), span: pick([M.SPAN_Z, M.SPAN_Z, M.SPAN_G]), ink: pick(INKS) }; },
  cinema: () => { const name = FILMS(); return { name, title: cap(name) + ' cinema', wall: pick([M.REND_C, M.LIME2, M.REND_P]), ink: pick([M.LIT_R, M.LIT_Y]) }; },
  carpark: () => ({ full: 0.5 + rnd() * 0.4 }),
};
// what each district is made of: [kind, weight, arguments]
const DIST = {
  G: [['baladi', 64, ['raw']], ['baladi', 18, ['mix']], ['mosque', 3], ['palms', 4, [0]], ['shop', 4], ['carpark', 3], ['souk', 4]],
  B: [['baladi', 58, ['mix']], ['baladi', 10, ['raw']], ['oldhouse', 9], ['palms', 6, [0]], ['mosque', 3], ['shop', 5], ['flats', 6, [5, 8]], ['souk', 3]],
  D: [['haussmann', 34, [4, 6]], ['baladi', 30, ['tall']], ['flats', 9, [6, 9]], ['cinema', 5], ['tower', 6, [8, 12]], ['palms', 5, [0]], ['shop', 5], ['nilehotel', 6, [false]]],
  O: [['oldhouse', 54], ['baladi', 15, ['low']], ['souk', 10], ['mosque', 7], ['palms', 6, [0]], ['shop', 4], ['village', 4]],
  S: [['souk', 72], ['oldhouse', 28]],
  H: [['nilehotel', 100]],
  F: [['palms', 50, [2]], ['palms', 26, [3]], ['village', 24]],
  V: [['village', 100]],
};
const NAMES = { G: 'giza', B: 'wards', D: 'downtown', O: 'oldtown', S: 'bazaar', H: 'corniche', F: 'fields', V: 'village' };
const TURNS = new Set(['baladi', 'oldhouse', 'shop', 'apartment', 'cinema', 'souk', 'haussmann', 'nilehotel']);
const PIECE = { p: ['palms', 0], o: ['palms', 1], v: ['villa'], r: ['nilehotel', true], t: ['camp', 0], c: ['camp', 1], x: ['dig'], m: ['mastabas'] };
const DESERT_BITS = new Set(['o', 't', 'c', 'x', 'm']);

export function cairoLots() {
  const out = [];
  for (let r = 0; r < PZ.length; r++) for (let c = 0; c < PX.length; c++) {
    const key = c + ',' + r, ch = MAP[r][c], fix = FIXED[key];
    if (!fix && ch === '.') continue;
    let f = ROW_F[r];
    const inner = f < 0 && !WEST_OF.has(c) && !EAST_OF.has(c);
    if (f < 0) f = WEST_OF.has(c) ? 1 : EAST_OF.has(c) ? 3 : BACK_F[r];
    if (c === 7) f = 3; else if (c === 8) f = 1;   // the island's lots look out over the water
    let kind, opt, d = NAMES[ch] || (DESERT_BITS.has(ch) ? 'giza' : c === 7 || c === 8 ? 'gezira' : 'park');
    if (fix) { kind = fix.k; opt = fix.o; d = fix.d; if (fix.f !== undefined) f = fix.f; }
    else if (PIECE[ch]) { const [k, a] = PIECE[ch]; kind = k; opt = MAKE[k](a); }
    else {
      const table = DIST[ch];
      let t = rnd() * table.reduce((s, e) => s + e[1], 0), e = table[0];
      for (const x of table) { t -= x[1]; if (t < 0) { e = x; break; } }
      let [k, , a = []] = e;
      if (inner && k === 'tower') { k = 'baladi'; a = ['tall']; }   // the glass tower parks a car out front, and a lot inside a block has no street
      kind = k === 'flats' ? 'apartment' : k; opt = MAKE[k](...a);
    }
    // every other corner lot turns to face its avenue, so the avenues are lined with fronts and not with side walls
    if (!fix && TURNS.has(kind) && ROW_F[r] >= 0 && (r + c) % 2 === 0) f = WEST_OF.has(c) ? 1 : EAST_OF.has(c) ? 3 : f;
    if (ch === 'H' || ch === 'r') f = c === 6 ? 1 : c === 9 ? 3 : f;   // the hotels face the river
    const L = { x: fix && fix.x !== undefined ? fix.x : PX[c], z: fix && fix.z !== undefined ? fix.z : PZ[r], f, k: kind, d, c, r };
    if (opt && inner) { opt.car = 0; }   // a lot inside a block has no street to park on
    if (opt && sandy(L.x, L.z)) opt.lamp = 0;
    if (opt) L.o = opt;
    if (fix && fix.s) L.s = fix.s;
    out.push(L);
  }
  return out;
}
export const CAIRO_KIT = { baladi, oldhouse, souk, mosque, palms, nilehotel, villa, village, mastabas, camp, dig, obelisk, greatpyramid, khafre, menkaure, sphinx, citadel, lotustower, museum, opera };
// ground colours for the lots (ground.js): dusty pavement in town, lawn in the gardens; the desert pieces have none, so the sand shows
export const CAIRO_PAD = { baladi: '#cbbd9f', oldhouse: '#cdbf9e', souk: '#d2c3a0', mosque: '#d6c9a8', nilehotel: '#cfc7b4', villa: '#8fb46a', obelisk: '#d8ccae', lotustower: '#d2cab4', haussmann: '#cbc2ad', shop: '#cbbd9f', apartment: '#cbbd9f',
  cinema: '#cbbd9f', tower: '#c9c6bc', park: '#8fb46a', carpark: '#5c5f63' };

// where the street dressing (lamps, parked cars, trees) must stay away: the water and its banks, and the open desert
export function cairoKeepOut(x, z) { return wet(x, z) || wet(x - 6, z) || wet(x + 6, z) || wet(x, z - 6) || wet(x, z + 6) || sandy(x, z); }
export const onStreet = (v, list = STREET_X, d = 20) => list.some((s) => Math.abs(v - s) < d);
