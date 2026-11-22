// New York: the third map. The same size as the big city and Paris, on the same kind of street grid (the army's route
// finding and the rivals need straight streets that run edge to edge). Built when the bundle is made with __NYC__
// (python3 build.py nyc). The streets are in world.js; this file turns them into lots.
//
// North is low z. From the top: the Bronx with the ballpark, the Harlem River, then Manhattan: Harlem, the big park
// between the west and east sides, midtown with Times Square and the two spire towers, the village and its lofts, and
// the financial district at the tip. The Hudson runs down the west side and opens into the bay, where the Statue of
// Liberty stands on her island, looking east at the tip of Manhattan (and into the sun). The East River runs down the east side, under five bridges, with Brooklyn beyond it.
// He hatches in Brooklyn, at the foot of the Brooklyn Bridge, looking across the river at the skyline.
//
// The map is flat: the water is painted on the ground and monsters wade. A street that crosses water is a bridge, and one
// that runs out into the Hudson or the harbor is a pier or a ferry slip (nyc_water.js dresses them).
// The stadium and the two famous towers are our own takes under our own names; the statue and the bridge keep theirs.
import { M, STREET_X } from './world.js';
import { brownstone, tenement, deco, billboard, meadow } from './nyc_kit.js';
import { liberty, ballpark, kingtower, silverspire, BALLPARK, LIBERTY } from './nyc_landmarks.js';

// where each column and row of 40-voxel lots starts: 6 apart inside a block, a street's width apart across one
export const PX = [17, 63, 109, 155, 201, 283, 329, 375, 457, 503, 549, 631, 677, 784, 830, 890, 973];
export const PZ = [46, 92, 168, 268, 314, 390, 436, 512, 558, 634, 680, 756, 802, 878, 924];
export const HARLEM = { z0: 214, z1: 262 };                  // the Harlem River, right across the map
export const HUDSON = 96;                                    // the Hudson's shore (it lies west of this, south of the Harlem River)
export const EAST = { x0: 772, x1: 880 };                    // the East River
export const BAY = { x: 241, z: 884 };                       // the bay: west of x and south of z
export const SOUTH = 986;                                    // the harbor along the tip of the island
export const LIB = { x: 118, z: 954, r: 44 };                // Liberty Island
export const PARK = { x0: 280, x1: 418, z0: 390, z1: 598 };  // the big park, crossed by one street
export const BALL = { x: 283, z: 0 };                        // the ballpark's lot
export const KING = { x: 631, z: 634 }, SILVER = { x: 549, z: 634 }, TIMES = { x: 436, z: 738 };
// is this spot water?
export function wet(x, z) {
  if (z < HARLEM.z0) return false;
  if (z < HARLEM.z1) return true;
  if (x >= EAST.x1) return false;
  if (x >= EAST.x0) return true;
  if (Math.hypot(x - LIB.x, z - LIB.z) < LIB.r) return false;
  return x < HUDSON || z >= SOUTH || (x < BAY.x && z >= BAY.z);
}

// One letter a lot. Capitals are districts, filled from a weighted list:
//   X the Bronx   U Harlem   W the west side   E the east side   M midtown   T Times Square   V the village and the lofts
//   F the financial district   B Brooklyn
// Small letters are single pieces: g a piece of the big park, b the park at the Battery, k a car park. A dot is water, or
// ground a big piece takes.
const MAP = [
  'XXXXX...XXXXXXXXX',
  'XXXXX...XXXXXXXXX',
  'XXXXXkXkXXXXXXXXX',
  '..UUUUUUUUUUU..BB',
  '..UUUUUUUUUUU..BB',
  '..WWWgggEEEEE..BB',
  '..WWWgggEEEEE..BB',
  '..WWWgggEEEEE..BB',
  '..WWWgggEEEEE..BB',
  '..MMMMMMMMM....BB',
  '..MMMMTTTTM....BB',
  '..VVVVTTTTVVV..BB',
  '..bbbVVVVVVVV..BB',
  '.....FFFFFFFF..BB',
  '.....FFFFFFFF..BB',
];
// the pieces that are not one plain lot: 'c,r' of the lot at their north-west corner
const FIXED = {
  '5,0': { k: 'ballpark', s: BALLPARK.S, f: 2, d: 'bronx', at: [BALL.x, BALL.z] },
  '11,9': { k: 'kingtower', s: 86, f: 0, d: 'midtown' },
  '10,9': { k: 'silverspire', f: 0, d: 'midtown' },
};
// which way a lot fronts: the street along its row, or for the rows with none the avenue beside its column
const ROW_F = [-1, 2, 0, -1, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, -1], BACK_F = { 0: 2, 3: 0, 14: 2 };
const WEST_OF = new Set([4, 7, 10, 12, 15]), EAST_OF = new Set([5, 8, 11, 13, 16]);   // columns with an avenue on their east, or west, side

// ---- choosing what goes on a lot ------------------------------------------------------------------
let seed = 16240504;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[(rnd() * a.length) | 0], ri = (a, b) => a + ((rnd() * (b - a + 1)) | 0);
function deck(list) { let d = []; return () => { if (!d.length) { d = list.slice(); for (let i = d.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; } } return d.pop(); }; }

const BROWNS = [M.BROWNST, M.BROWNST, M.BROWNST, M.BRICK, M.BRICK2, M.LIME2], BRICKS = [M.BRICK, M.BRICK, M.BRICK2, M.BROWNST, M.REND_C], IRONS = [M.REND_C, M.TRIM, M.LIME, M.PL_W, M.TANK, M.REND_T];
const STONES = [M.LIME, M.LIME, M.LIME2, M.BRICK2, M.REND_C, M.CONC, M.BRICK], SPANS = [M.DARK, M.METAL, M.ROOF_G, M.BRICK, M.SPAN_Z];
const FRONTS = [M.DOOR_G, M.DOOR_R, M.DOOR_B, M.DARK], AWNS = [M.AWN_R, M.AWN_G, M.AWN_B, M.AWN_W], DOORS = [M.DOOR_R, M.DOOR_B, M.DOOR_G, M.DARK], CORNICE = [M.DARK, M.TRIM, M.BROWNST, M.ROOF_G];
const ROOFS = [M.ROOF_S, M.ROOF_R, M.ROOF_D], CARS = [M.TAXI, M.TAXI, M.CAR_A, M.CAR_B, M.CAR_C], PAPER = [M.WP_A, M.WP_B, M.WP_C], INKS = [M.LIT_W, M.LIT_Y, M.LIT_R], PLASTER = [M.PL_W, M.PL_Y, M.PL_P, M.PL_B, M.PL_G];
// shop names are short enough for the board over the shopfront; the title is what the game calls the building
const STREET = deck([['DELI', 'Deli'], ['PIZZA', 'Pizza place'], ['BAGELS', 'Bagel shop'], ['DINER', 'Diner'], ['BOOKS', 'Bookshop'], ['RECORDS', 'Record shop'], ['HATS', 'Hat shop'],
  ['BARBER', 'Barber'], ['NEWS', 'Newsstand'], ['LAUNDRY', 'Laundry'], ['HOTEL', 'Hotel'], ['TOYS', 'Toy shop'], ['COFFEE', 'Coffee shop'], ['JAZZ', 'Jazz club'], ['BAKERY', 'Bakery'],
  ['FLOWERS', 'Florist'], ['HOT DOG', 'Hot dog stand'], ['TAILOR', 'Tailor'], ['MUSIC', 'Music shop'], ['PIES', 'Pie shop'], ['CAMERAS', 'Camera shop'], ['COMICS', 'Comic shop']]);
const SMALL = deck([['DELI', 'Corner deli'], ['PIZZA', 'Pizza place'], ['BAGELS', 'Bagel shop'], ['DINER', 'Diner'], ['NEWS', 'Newsstand'], ['COFFEE', 'Coffee shop'], ['BAKERY', 'Bakery'], ['PIES', 'Pie shop'], ['TOYS', 'Toy shop'], ['BOOKS', 'Bookshop']]);
const FILMS = deck(['ROXY', 'GEM', 'STAR', 'LYRIC']), GLASS_T = deck(['BANK', 'NEWS', 'TRUST', 'AXIS', 'RADIO', 'APEX', 'UNION']);
const DECO_T = deck(['Trust building', 'Exchange tower', 'Herald building', 'Atlas tower', 'Union building', 'Harbor tower', 'Guild tower', 'Beacon building', 'Liberty tower', 'Mercantile building', 'Gotham tower', 'Pioneer building']);
const APT_T = deck(['Park apartments', 'Grand apartments', 'Riverside apartments', 'Court apartments', 'Plaza hotel', 'Garden apartments']);
// the signs of Times Square: our own made-up names, each with a background and a letter colour
const SIGNS = deck([['ZAP', M.LIT_R, M.LIT_W], ['FIZZ', M.LIT_B, M.LIT_W], ['MEGA', M.LIT_Y, M.DARK], ['KAIJU', M.DARK, M.LIT_G], ['TOYS', M.LIT_P, M.LIT_W], ['SHOW', M.DARK, M.LIT_Y], ['NEWS', M.LIT_W, M.CAR_A],
  ['POP', M.LIT_G, M.DARK], ['STAR', M.CAR_B, M.LIT_Y], ['JAZZ', M.DARK, M.LIT_P], ['ROAR', M.LIT_R, M.LIT_Y], ['GLOW', M.DARK, M.LIT_B], ['PIZZA', M.LIT_Y, M.CAR_A], ['TAXI', M.TAXI, M.DARK],
  ['LIVE', M.CAR_A, M.LIT_W], ['WOW', M.LIT_P, M.LIT_Y], ['YUM', M.LIT_W, M.LIT_R], ['COLA', M.CAR_A, M.LIT_W], ['MOVIES', M.DARK, M.LIT_W], ['DANCE', M.LIT_B, M.LIT_Y], ['HITS', M.LIT_G, M.LIT_W], ['CHOMP', M.DARK, M.LIT_R]]);
const cap = (s) => s[0] + s.slice(1).toLowerCase();

const MAKE = {
  brownstone: () => ({ walls: [pick(BROWNS), pick(BROWNS), pick(BROWNS)], doors: [pick(DOORS), pick(DOORS), pick(DOORS)], floors: [ri(3, 4), ri(3, 4), ri(3, 4)], trim: pick(CORNICE), inside: rnd() < 0.3, car: rnd() < 0.3 ? pick(CARS) : 0 }),
  tenement: (lo, hi) => { const [name, title] = STREET(); return { floors: ri(lo, hi), name, title, wall: pick(BRICKS), front: pick(FRONTS), awn: pick(AWNS), door: pick(DOORS), trim: pick(CORNICE), tank: rnd() < 0.6, inside: rnd() < 0.3, car: rnd() < 0.3 ? pick(CARS) : 0 }; },
  loft: (lo, hi) => { const [name, title] = STREET(); return { loft: 1, floors: ri(lo, hi), name, title, wall: pick(IRONS), front: pick(FRONTS), awn: pick(AWNS), door: pick(DOORS), trim: M.TRIM, tank: rnd() < 0.75, inside: rnd() < 0.25, car: rnd() < 0.3 ? pick(CARS) : 0 }; },
  deco: (lo, hi, names = DECO_T) => ({ floors: ri(lo, hi), title: names(), wall: pick(STONES), span: pick(SPANS), crown: pick(['pyramid', 'pyramid', 'lantern', 'tank', 'mast']), cap: pick([M.ROOF_G, M.COPPER, M.ROOF_D, M.BRASS, M.ROOF_R]), car: rnd() < 0.4 ? M.TAXI : 0 }),
  billboard: () => ({ floors: ri(6, 9), signs: [SIGNS(), SIGNS(), SIGNS(), SIGNS(), SIGNS(), SIGNS(), SIGNS()], title: 'Theater block', car: rnd() < 0.5 ? M.TAXI : 0 }),
  shop: () => { const [name, title] = SMALL(); return { name, title, wall: pick(BRICKS), awn: pick(AWNS), door: pick(DOORS), ink: pick(INKS), car: rnd() < 0.5 ? pick(CARS) : 0, paper: pick(PAPER) }; },
  cottage: () => ({ wall: pick(PLASTER), roof: pick(ROOFS), shutters: pick(DOORS), door: pick(DOORS), paper: pick(PAPER) }),
  rowhouse: () => ({ walls: [pick(BRICKS), pick(PLASTER), pick(BRICKS)], doors: [pick(DOORS), pick(DOORS), pick(DOORS)], roof: pick(ROOFS) }),
  flats: (lo, hi) => ({ floors: ri(lo, hi), wall: pick([M.BRICK, M.BRICK2, M.REND_C, M.BROWNST]), door: pick(DOORS), awn: pick(AWNS), car: rnd() < 0.5 ? pick(CARS) : 0 }),
  tower: (lo, hi) => { const name = GLASS_T(); return { floors: ri(lo, hi), name, title: cap(name) + ' tower', glass: pick([M.GLASS, M.GLASS_G, M.GLASS_Z]), span: pick([M.SPANDREL, M.SPAN_G, M.SPAN_Z]), ink: pick(INKS) }; },
  cinema: () => { const name = FILMS(); return { name, title: cap(name) + ' theater', wall: pick([M.REND_C, M.BRICK2, M.REND_P]), ink: pick([M.LIT_R, M.LIT_Y]) }; },
  carpark: () => ({ full: 0.5 + rnd() * 0.4 }),
  factory: () => ({ wall: pick([M.BRICK, M.BRICK2]), name: pick(['MILL', 'WORKS', 'SUGAR', 'SOAP']), title: 'Warehouse', car: 0 }),
};
// what each district is made of: [kind, weight, options]
// Will, 2026-11-22: more of the big buildings, so it reads as New York (and there is more city to wreck). Midtown and the
// financial district are nearly all towers and taller; the apartment houses on the west and east sides and a few in
// Harlem, the village and Brooklyn's river edge stand where brownstones were. Nothing goes above the King Tower.
const DIST = {
  X: [['tenement', 36, [5, 6]], ['flats', 18, [6, 8]], ['apts', 10, [8, 11]], ['brownstone', 14], ['rowhouse', 6], ['shop', 8], ['church', 3], ['park', 2], ['cinema', 2], ['carpark', 1]],
  U: [['brownstone', 34], ['tenement', 26, [5, 6]], ['apts', 24, [9, 12]], ['shop', 5], ['church', 5], ['cinema', 4], ['park', 2]],
  W: [['apts', 58, [11, 15]], ['brownstone', 18], ['tower', 10, [11, 14]], ['tenement', 8, [5, 6]], ['church', 3], ['shop', 3]],
  E: [['apts', 56, [11, 15]], ['tower', 14, [11, 15]], ['brownstone', 16], ['flats', 8, [7, 8]], ['church', 3], ['shop', 3]],
  M: [['deco', 54, [13, 17]], ['tower', 40, [12, 17]], ['cinema', 3], ['shop', 3]],
  T: [['billboard', 100]],
  V: [['loft', 32, [5, 7]], ['tenement', 24, [5, 6]], ['apts', 14, [9, 12]], ['brownstone', 14], ['tower', 6, [9, 12]], ['shop', 6], ['cinema', 2], ['church', 2]],
  F: [['deco', 54, [13, 17]], ['tower', 40, [13, 17]], ['church', 3], ['plaza', 3]],
  B: [['brownstone', 36], ['rowhouse', 12], ['shop', 12], ['loft', 12, [4, 6]], ['apts', 8, [8, 10]], ['factory', 6], ['park', 6], ['cottage', 3], ['carpark', 3], ['church', 2]],
};
const NAMES = { X: 'bronx', U: 'harlem', W: 'west', E: 'east', M: 'midtown', T: 'times', V: 'village', F: 'downtown', B: 'brooklyn' };
const JOINS = new Set(['brownstone', 'tenement']);   // these stand wall to wall along a street

export function nycLots() {
  const out = [];
  for (let r = 0; r < PZ.length; r++) for (let c = 0; c < PX.length; c++) {
    const key = c + ',' + r, ch = MAP[r][c], fix = FIXED[key];
    if (!fix && ch === '.') continue;
    let f = ROW_F[r];
    const inner = f < 0 && !WEST_OF.has(c) && !EAST_OF.has(c);
    if (f < 0) f = WEST_OF.has(c) ? 1 : EAST_OF.has(c) ? 3 : BACK_F[r];
    let kind, opt, d = NAMES[ch] || 'park';
    if (fix) { kind = fix.k; opt = fix.o; d = fix.d; if (fix.f !== undefined) f = fix.f; }
    else if (ch === 'g') { kind = 'meadow'; opt = { v: (c - 5) + (r - 5) * 3 }; }
    else if (ch === 'b') { kind = 'meadow'; opt = { v: 20 + c }; d = 'battery'; }
    else if (ch === 'k') { kind = 'carpark'; opt = MAKE.carpark(); d = 'bronx'; }
    else {
      const table = DIST[ch];
      let t = rnd() * table.reduce((s, e) => s + e[1], 0), e = table[0];
      for (const x of table) { t -= x[1]; if (t < 0) { e = x; break; } }
      const [k, , a] = e; kind = k;
      if (k === 'tenement' || k === 'loft') { kind = 'tenement'; opt = MAKE[k](a[0], a[1]); }
      else if (k === 'apts') { kind = 'deco'; opt = MAKE.deco(a[0], a[1], APT_T); opt.wall = pick([M.BRICK2, M.LIME2, M.BRICK, M.REND_C]); opt.crown = pick(['tank', 'lantern', 'twin']); }
      else if (k === 'flats') { kind = 'apartment'; opt = MAKE.flats(a[0], a[1]); }
      else if (a) opt = MAKE[k](a[0], a[1]);
      else if (MAKE[k]) opt = MAKE[k]();
    }
    if (kind === 'billboard') {
      // a sign block on a corner carries signs down the side that looks onto the avenue too, and one of them has the ball on its roof
      const LEFT = [3, 0, 1, 2], way = WEST_OF.has(c) ? 1 : EAST_OF.has(c) ? 3 : -1;
      if (way >= 0) { if (LEFT[f] === way) opt.sl = 1; else opt.sr = 1; }
      if (c === 7 && r === 10) { opt.ball = 1; opt.floors = 9; opt.title = 'Times tower'; }
    }
    const L = { x: PX[c], z: PZ[r], f, k: kind, d, c, r };
    if (opt && inner) { opt.car = 0; }   // a lot inside a block has no street to park on
    if (opt) L.o = opt;
    if (fix && fix.s) L.s = fix.s;
    if (fix && fix.at) { L.x = fix.at[0]; L.z = fix.at[1]; }
    out.push(L);
  }
  out.push({ x: LIB.x - LIBERTY.S / 2, z: LIB.z - LIBERTY.S / 2, f: 1, k: 'liberty', s: LIBERTY.S, d: 'harbor' });   // the island is outside the grid of lots
  joinRows(out);
  return out;
}
// Brownstones and tenements stand wall to wall: two that are side by side in a block and face the same way are joined
// (their side walls are pushed out to meet and left blank). Directions are 0 north, 1 east, 2 south, 3 west.
function joinRows(lots) {
  const at = new Map(lots.map((L) => [L.c + ',' + L.r, L]));
  const near = (c, r, d) => (d === 1 ? PX[c + 1] - PX[c] : d === 3 ? PX[c] - PX[c - 1] : d === 2 ? PZ[r + 1] - PZ[r] : PZ[r] - PZ[r - 1]) === 46;   // the same block that way
  const LEFT = [3, 0, 1, 2];   // the direction a lot's left side (its low local x) looks, by facing
  for (const L of lots) {
    if (!JOINS.has(L.k) || L.s || L.c === undefined) continue;
    for (const d of [(L.f + 1) % 4, (L.f + 3) % 4]) {
      if (!near(L.c, L.r, d)) continue;
      const N = at.get((L.c + [0, 1, 0, -1][d]) + ',' + (L.r + [-1, 0, 1, 0][d]));
      if (!N || !JOINS.has(N.k) || N.s || N.f !== L.f) continue;
      if (d === LEFT[L.f]) L.o.jl = 1; else L.o.jr = 1;
    }
  }
}
export const NYC_KIT = { brownstone, tenement, deco, billboard, meadow, liberty, ballpark, kingtower, silverspire };
// ground colours for the lots (ground.js): New York is pavement grey, and green only in its parks
export const NYC_PAD = { brownstone: '#b9b5ab', tenement: '#b9b5ab', deco: '#c2c0b8', billboard: '#b4b2ac', kingtower: '#c8c4b8', silverspire: '#c2c0b8', shop: '#b9b5ab', apartment: '#b9b5ab', cinema: '#b9b5ab', tower: '#c2c4c6',
  park: '#79aa62', cottage: '#86b06c', rowhouse: '#a9ad9a', church: '#86b06c' };

// where the street dressing (lamps, parked cars, trees) must stay away: the water, the ballpark and the park's street
export function nycKeepOut(x, z) {
  if (wet(x, z) || wet(x - 6, z) || wet(x + 6, z) || wet(x, z - 6) || wet(x, z + 6)) return true;
  if (x > BALL.x - 4 && x < BALL.x + BALLPARK.S + 4 && z < BALL.z + BALLPARK.S + 2) return true;
  return false;
}
export const onStreet = (v, list = STREET_X, d = 20) => list.some((s) => Math.abs(v - s) < d);
