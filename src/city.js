// The big city: a map about four times the first town, laid out by district on a grid of streets of uneven spacing.
// Built when the bundle is made with __CITY__ (python3 build.py city). The streets are in world.js (the army and the
// ground read them there); this file turns them into lots.
//
// Districts (Hole.io style: small food where he hatches, the big prize on the skyline, clusters to run between):
//   S  suburbs, south-west, where he hatches: cottages, row houses, parks, a few shops
//   O  old town, west: shops, cinemas, churches, row houses and low flats
//   U  uptown, north-west: taller flats, row houses, parks
//   D  downtown, north and middle: office towers of 7 to 16 floors, tallest at the core, hotels and plazas
//   M  midtown: mid-rise flats, small towers and shops round the square
//   N  the square at the middle of the map: the Sky Needle between a clock tower and a park
//   T  the stadium quarter, south of the square: the stadium with car parks either side and a row of places to eat
//   E  east side: flats, shops, row houses and the odd fuel station
//   Y  the yard, south-east: factories, fuel depots, water towers and car parks that set each other off
import { M, LOT, STREET_X, STREET_Z } from './world.js';

const MAP = [
  'UUUUUUDDDDDDDEEE',
  'UUUUUDDDDDDDDEEE',
  'UUUUUDDDDDDDDEEE',
  'OOOOODDDDDDDDEEE',
  'OOOOOMDDDDDDMEEE',
  'OOOOOMMMMMMMMEEE',
  'OOOOOMNNNNMMMEEE',
  'OOOOOMMMMMMMMYYY',
  'OOOOMMMMMMMYYYYY',
  'SSSSMMTTTTYYYYYY',
  'SSSSSSTTTTYYYYYY',
  'SSSSSSTTTTYYYYYY',
  'SSSSSSSSSSYYYYYY',
  'SSSSSSSSSSSYYYYY',
  'SSSSSSSSSSSSYYYY',
  'SSSSSSSSSSSSSYYY',
];

// ---- the grid ----------------------------------------------------------------
// A block between two streets holds as many 40-voxel lots as fit, 6 apart: 3 across where the streets are 174 apart,
// 2 at 128, 4 at 220; down the map 2 rows back to back at 122, 3 at 168, 1 at 76. One more column or row runs along each edge.
function axis(S, side, gapFix) {
  const out = [{ v: S[0] - 58, blk: -1, k: 0, n: 1 }];
  for (let i = 0; i + 1 < S.length; i++) { const n = Math.round((S[i + 1] - S[i] - gapFix) / 46); for (let k = 0; k < n; k++) out.push({ v: S[i] + side + 46 * k, blk: i, k, n }); }
  out.push({ v: S[S.length - 1] + 18, blk: S.length - 1, k: 0, n: 1 });
  return out;
}
export const COLS = axis(STREET_X, 21, 36), ROWS = axis(STREET_Z, 18, 30);
export const cityBlocks = () => STREET_X.slice(0, -1).map((x, i) => [x + 18, STREET_X[i + 1] - 18]);
export const cityAlleys = () => { const a = []; for (let j = 0; j + 1 < STREET_Z.length; j++) { const m = Math.round((STREET_Z[j + 1] - STREET_Z[j] - 30) / 46); for (let k = 0; k + 1 < m; k++) a.push(STREET_Z[j] + 58 + 46 * k); } return a; };

// ---- choosing what goes on a lot -------------------------------------------------
let seed = 20261118;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[(rnd() * a.length) | 0], ri = (a, b) => a + ((rnd() * (b - a + 1)) | 0);
// take the names in a shuffled order and start again when they run out, so neighbours rarely match
function deck(list) { let d = []; return () => { if (!d.length) { d = list.slice(); for (let i = d.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; } } return d.pop(); }; }

const WALLS = [M.REND_C, M.REND_Y, M.REND_T, M.REND_P, M.BRICK, M.BRICK2], PLASTER = [M.PL_W, M.PL_Y, M.PL_B, M.PL_P, M.PL_G];
const ROOFS = [M.ROOF_R, M.ROOF_S, M.ROOF_G], DOORS = [M.DOOR_R, M.DOOR_B, M.DOOR_G], AWNS = [M.AWN_R, M.AWN_W, M.AWN_B, M.AWN_G];
const CARS = [M.CAR_A, M.CAR_B, M.CAR_C], PAPER = [M.WP_A, M.WP_B, M.WP_C], INKS = [M.LIT_W, M.LIT_Y, M.LIT_R];
const SHOPS = deck([['GROCER', 'Corner shop'], ['BOOKS', 'Bookshop'], ['PIZZA', 'Pizza place'], ['TOYS', 'Toy shop'], ['CAFE', 'Cafe'], ['DINER', 'Diner'], ['BAKERY', 'Bakery'],
  ['PETS', 'Pet shop'], ['MUSIC', 'Music shop'], ['GAMES', 'Game shop'], ['TACOS', 'Taco place'], ['SUSHI', 'Sushi bar'], ['DELI', 'Deli'], ['BIKES', 'Bike shop'], ['HATS', 'Hat shop'],
  ['SHOES', 'Shoe shop'], ['FLORIST', 'Florist'], ['BARBER', 'Barber'], ['TEA', 'Tea room'], ['COMICS', 'Comic shop'], ['CAMERA', 'Camera shop'], ['CANDY', 'Sweet shop'],
  ['BURGER', 'Burger bar'], ['NOODLE', 'Noodle bar'], ['KITES', 'Kite shop'], ['CLOCKS', 'Clock shop'], ['DONUTS', 'Donut shop'], ['ART', 'Art shop']]);
const EATS = deck([['PIZZA', 'Pizza place'], ['DINER', 'Diner'], ['BURGER', 'Burger bar'], ['TACOS', 'Taco place'], ['NOODLE', 'Noodle bar'], ['DONUTS', 'Donut shop']]);
const TOWERS = deck(['BANK', 'TECH', 'CORP', 'NEWS', 'APEX', 'NOVA', 'OMNI', 'AXIS', 'HALO', 'ORB', 'ZEN', 'MAX', 'VOLT', 'CORE', 'PEAK', 'STAR', 'ECHO', 'LUNA', 'ARC', 'ION', 'KITE', 'JET', 'OAK', 'BOLT']);
const GLAZE = [[M.GLASS, M.SPANDREL], [M.GLASS_G, M.SPAN_G], [M.GLASS_Z, M.SPAN_Z]];
const FILMS = deck(['ROXY', 'REX', 'LUX', 'GEM', 'RITZ']), WORKS = deck([['WORKS', 'Factory'], ['MILL', 'Mill'], ['FORGE', 'Forge'], ['STEEL', 'Steel works'], ['TOOLS', 'Tool works'], ['PAPER', 'Paper mill']]);
const HOTELS = deck(['Grand hotel', 'Palace hotel', 'Park hotel', 'Star hotel']);
const cap = (s) => s[0] + s.slice(1).toLowerCase();

const MAKE = {
  cottage: () => ({ wall: pick(PLASTER), roof: pick(ROOFS), shutters: pick(DOORS), door: pick(DOORS), paper: pick(PAPER) }),
  rowhouse: () => ({ walls: [pick(WALLS), pick(PLASTER), pick(WALLS)], doors: [pick(DOORS), pick(DOORS), pick(DOORS)], roof: pick(ROOFS) }),
  shop: () => { const [name, title] = SHOPS(); return { name, title, wall: pick(WALLS), awn: pick(AWNS), door: pick(DOORS), ink: pick(INKS), car: pick(CARS), paper: pick(PAPER) }; },
  eats: () => { const [name, title] = EATS(); return { name, title, wall: pick(WALLS), awn: pick(AWNS), door: pick(DOORS), ink: pick(INKS), car: pick(CARS), paper: pick(PAPER) }; },
  flats: (lo, hi) => ({ floors: ri(lo, hi), wall: pick(WALLS), door: pick(DOORS), awn: pick(AWNS), car: rnd() < 0.7 ? pick(CARS) : 0 }),
  hotel: (lo, hi) => ({ floors: ri(lo, hi), title: HOTELS(), wall: pick([M.REND_C, M.REND_Y, M.REND_T]), door: M.DOOR_R, awn: M.AWN_R, car: pick(CARS) }),
  tower: (floors) => { const name = TOWERS(), [glass, span] = pick(GLAZE); return { floors, name, title: cap(name) + ' tower', glass, span, ink: pick([M.LIT_Y, M.LIT_W, M.LIT_R, M.LIT_B]) }; },
  cinema: () => { const name = FILMS(); return { name, title: cap(name) + ' cinema', wall: pick([M.REND_C, M.REND_Y, M.REND_P]), ink: pick([M.LIT_R, M.LIT_Y]) }; },
  factory: () => { const [name, title] = WORKS(); return { name, title, wall: pick([M.BRICK, M.BRICK2]), car: pick(CARS) }; },
  carpark: () => ({ full: 0.5 + rnd() * 0.45 }),
  depot: () => ({ tall: rnd() < 0.4 ? 1 : 0 }),
};
// what each district is made of: [kind, weight, options]. 'flats' and 'hotel' are apartment blocks, 'eats' a shop that sells food.
const core = (c, r) => Math.hypot(c - 8.5, (r - 2) * 1.3);   // how far a lot is from the middle of downtown, in lots
const DIST = {
  S: (c, r) => [['cottage', 46], ['rowhouse', 14], ['park', 14], ['shop', 8], ['carpark', 5], ['flats', 3, [3, 3]], ['watertower', 2], ['fuel', 2], ['church', 1.5]],
  O: (c, r) => [['shop', 28], ['rowhouse', 16], ['flats', 14, [3, 4]], ['cottage', 10], ['park', 10], ['carpark', 7], ['plaza', 6], ['cinema', 4], ['church', 3]],
  U: (c, r) => [['flats', 28, [4, 6]], ['rowhouse', 20], ['park', 16], ['shop', 12], ['cottage', 10], ['carpark', 6], ['church', 3], ['watertower', 3]],
  D: (c, r) => [['tower', 50], ['hotel', 14, [7, 9]], ['plaza', 12], ['park', 8], ['carpark', 7], ['shop', 6], ['cinema', 3]],
  M: (c, r) => [['flats', 22, [4, 6]], ['shop', 22], ['tower', 14], ['park', 12], ['plaza', 10], ['carpark', 8], ['rowhouse', 6], ['cinema', 5]],
  E: (c, r) => [['flats', 22, [3, 5]], ['shop', 20], ['rowhouse', 16], ['park', 12], ['carpark', 10], ['cottage', 8], ['fuel', 5], ['factory', 4], ['watertower', 3]],
  Y: (c, r) => [['factory', 22], ['depot', 22], ['carpark', 18], ['fuel', 10], ['watertower', 8], ['eats', 6], ['park', 4], ['flats', 3, [3, 3]]],
};
const NAMES = { S: 'sub', O: 'old', U: 'up', D: 'down', M: 'mid', N: 'mid', T: 'stadium', E: 'east', Y: 'yard' };
const OPEN = [['park', 5], ['plaza', 3], ['carpark', 4]];   // a lot with no street in front of it
// fixed pieces: 'c,r' -> lot. The stadium takes four lots (s: 86), so the three it covers are left out.
const FIXED = {
  '6,6': { k: 'plaza' }, '7,6': { k: 'needle', o: { scale: 1.7 } }, '8,6': { k: 'park' }, '9,6': { k: 'plaza', o: { title: 'Bell tower' } },
  '7,10': { k: 'stadium', s: 86, f: 0 }, '8,10': null, '7,11': null, '8,11': null,
  '6,10': { k: 'carpark', o: { full: 0.9 } }, '6,11': { k: 'carpark', o: { full: 0.8 } }, '9,10': { k: 'carpark', o: { full: 0.85 } }, '9,11': { k: 'carpark', o: { full: 0.9 } },
  '6,9': { k: 'eats' }, '7,9': { k: 'eats' }, '8,9': { k: 'plaza', o: { title: 'Fan fountain' } }, '9,9': { k: 'eats' },
  '0,15': { k: 'park' }, '1,14': { k: 'cottage' }, '1,15': { k: 'cottage' }, '0,14': { k: 'cottage' },   // round the spot where he hatches
};

export function cityLots() {
  const out = [], last = COLS.length - 1, bottom = ROWS.length - 1;
  for (let r = 0; r <= bottom; r++) for (let c = 0; c <= last; c++) {
    const C = COLS[c], R = ROWS[r], key = c + ',' + r;
    if (FIXED[key] === null) continue;
    // which way the front faces: the street along its row first, else the street at the end of its block
    const inner = R.k > 0 && R.k < R.n - 1;   // a middle row, with no street along it
    let f, open = false;
    if (r === 0) f = 2; else if (r === bottom) f = 0;
    else if (c === 0) f = 1; else if (c === last) f = 3;
    else if (!inner) f = R.k === 0 ? 0 : 2;
    else if (C.k === 0) f = 3; else if (C.k === C.n - 1) f = 1;
    else { f = 0; open = true; }
    const d = MAP[r][c];
    let k, o, fix = FIXED[key];
    if (fix) { k = fix.k; o = fix.o; }
    else {
      const table = open ? OPEN : DIST[d](c, r);
      let t = rnd() * table.reduce((s, e) => s + e[1], 0), e = table[0];
      for (const x of table) { t -= x[1]; if (t < 0) { e = x; break; } }
      k = e[0]; o = e[2];
    }
    // turn the choice into a kind the kit knows and its options
    let kind = k, opt = fix && fix.o;
    if (k === 'flats') { kind = 'apartment'; opt = MAKE.flats(o[0], o[1]); }
    else if (k === 'hotel') { kind = 'apartment'; opt = MAKE.hotel(o[0], o[1]); }
    else if (k === 'eats') { kind = 'shop'; opt = MAKE.eats(); }
    else if (k === 'tower') opt = MAKE.tower(d === 'D' ? Math.max(7, Math.min(16, Math.round(16.5 - 2.1 * core(c, r) + rnd() * 2))) : ri(6, 9));
    else if (MAKE[k] && !opt) opt = MAKE[k]();
    const L = { x: C.v, z: R.v, f: fix && fix.f !== undefined ? fix.f : f, k: kind, d: NAMES[d] };
    if (opt) L.o = opt;
    if (fix && fix.s) L.s = fix.s;
    out.push(L);
  }
  return out;
}
