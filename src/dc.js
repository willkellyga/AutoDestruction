// Washington DC: the sixth map. The same size as the other cities, on the same kind of street grid (the army's route
// finding and the rivals need straight streets that run edge to edge). Built when the bundle is made with __DC__
// (python3 build.py dc). The streets are in world.js; this file turns them into lots.
//
// North is low z. The National Mall runs across the middle of the map, between the two avenues: the Lincoln Memorial
// on the river bank at its west end looking east down the Reflecting Pool, the war memorial at the pool's far end, the
// Washington Monument on its lawn, the long grass between the museums (the red Castle among them), and the Capitol on
// its terrace at the east end, looking back west. North of the Monument is the Ellipse and the White House with the
// square in front of it; south of it the Tidal Basin, ringed with cherry trees, with the Jefferson Memorial on the far
// shore. The Potomac runs down the west edge, then swings south-east; across it in the south-west corner is the
// Pentagon. Round all of that: the brick rows of Georgetown in the north-west, downtown's office blocks (all much of
// a height: nothing here stands taller than the Capitol), the pale federal buildings between downtown and the Mall,
// Union Station in the north-east, the rows of Capitol Hill in the east and the newer blocks of the south-west.
// He hatches at the south-east crossing, among the row houses, with the dome in sight.
//
// The map is flat: the water is painted on the ground and monsters wade. A street that crosses water is a bridge.
// The public buildings and monuments keep their names; shops and signs are made-up words.
import { M } from './world.js';
import { fedblock, dcoffice, dcgrove, temple } from './dc_kit.js';
import { whitehouse, capitol, lincoln, wmonument, jefferson, pentagon, ww2, castle, dcmuseum, unionstation, ellipse, WHITEHOUSE, CAPITOL, LINCOLN, JEFFERSON, PENTAGON, CASTLE, MUSEUM, UNION, ELLIPSE } from './dc_landmarks.js';

// where each column and row of 40-voxel lots starts: 6 apart inside a block, a street's width apart across one
export const PX = [71, 117, 196, 242, 288, 334, 380, 459, 505, 584, 630, 676, 722, 801, 847, 893, 972];
export const PZ = [4, 50, 129, 175, 254, 300, 346, 392, 471, 517, 563, 609, 655, 734, 780, 859, 905, 951];
export const AXIS = 583;                                                   // the Mall's centre line (z)
export const POOL = { x0: 200, x1: 376, z0: 565, z1: 601 };                // the Reflecting Pool
export const CPOOL = { x0: 726, x1: 758, z0: 559, z1: 607 };               // the pool at the foot of the Capitol
export const BASIN = { x: 394, z: 776, rx: 146, rz: 36 };                  // the Tidal Basin
export const ISLE = { x: 181, z: 838, rx: 30, rz: 35 };                    // the island in the river where two bridges meet
export const RIVER_W = 100;
// the Potomac's east bank at this z: it hugs the west edge, then swings south-east below the Lincoln Memorial
export const bankE = (z) => (z <= 650 ? 58 : z <= 850 ? 58 + (z - 650) * 0.95 : 248 + (z - 850) * 0.6);
export const isle = (x, z) => { const a = (x - ISLE.x) / ISLE.rx, b = (z - ISLE.z) / ISLE.rz; return a * a + b * b <= 1; };
export const virginia = (x, z) => x < bankE(z) - RIVER_W;                   // the far bank
export const river = (x, z) => x < bankE(z) && !virginia(x, z) && !isle(x, z);
export const basin = (x, z) => { const a = Math.abs((x - BASIN.x) / BASIN.rx), b = Math.abs((z - BASIN.z) / BASIN.rz); return a * a * a + b * b * b <= 1; };
const inRect = (R, x, z) => x >= R.x0 && x < R.x1 && z >= R.z0 && z < R.z1;
// is this spot water?
export function wet(x, z) { return river(x, z) || basin(x, z) || inRect(POOL, x, z) || inRect(CPOOL, x, z); }

export const LINCOLN_AT = { x: 71, z: AXIS - 43 }, MONUMENT_AT = { x: 482, z: AXIS - 20 }, WW2_AT = { x: 380, z: 563 }, WHITEHOUSE_AT = { x: 459, z: 254 }, ELLIPSE_AT = { x: 459, z: 346 };
export const CAPITOL_AT = { x: 801, z: AXIS - 66 }, JEFFERSON_AT = { x: 459, z: 859 }, PENTAGON_AT = { x: 6, z: 859 }, UNION_AT = { x: 801, z: 129 };
export const CASTLE_AT = { x: 584, z: 609 }, SPACE_AT = { x: 676, z: 609 }, NATURAL_AT = { x: 584, z: 471 }, GALLERY_AT = { x: 676, z: 471 }, COURT_AT = { x: 972, z: 517 }, LIBRARY_AT = { x: 972, z: 609 };

// One letter a lot. Capitals are districts, filled from a weighted list:
//   G Georgetown   K downtown   F the federal buildings   R the row-house neighbourhoods   S the south-west
// Small letters are single pieces: g a grove of trees, l a lawn with walks, t the Treasury, e the old executive
// offices. A dot is water, the Mall's open ground, or ground a big piece takes.
const MAP = [
  'GGGGKKKKKKKKKRRRR',
  'GGGGKKKKKKKKKRRRR',
  'GGKKKKKKKKKKK..RR',
  'GGKKKKKllKKKK..RR',
  'FFFFFFe..tFFFFFRR',
  'FFFFFFe..tFFFFFRR',
  'FFFFFFF..FFFFFFRR',
  'gFFFFFF..FFFFFFRR',
  'ggggggg......gggR',
  '................R',
  '................R',
  '................R',
  '.gggggg......gggR',
  '.........SSSSRRRR',
  '.........SSSSRRRR',
  '....ggg..gSSSRRRR',
  '.....Sg..gSSSRRRR',
  '......SggSSSSRRRR',
];
// the pieces that are not one plain lot: 'c,r' of the lot at their north-west corner (x and z move them off the grid)
const FIXED = {
  '0,9': { k: 'lincoln', s: LINCOLN.S, f: 1, d: 'mall', x: LINCOLN_AT.x, z: LINCOLN_AT.z },
  '6,10': { k: 'ww2', f: 3, d: 'mall' },
  '7,10': { k: 'wmonument', f: 1, d: 'mall', x: MONUMENT_AT.x, z: MONUMENT_AT.z },
  '7,4': { k: 'whitehouse', s: WHITEHOUSE.S, f: 0, d: 'whitehouse' },
  '7,6': { k: 'ellipse', s: ELLIPSE.S, f: 0, d: 'whitehouse' },
  '13,9': { k: 'capitol', s: CAPITOL.S, f: 3, d: 'capitol' },
  '7,15': { k: 'jefferson', s: JEFFERSON.S, f: 0, d: 'basin' },
  '0,15': { k: 'pentagon', s: PENTAGON.S, f: 0, d: 'virginia', x: PENTAGON_AT.x },
  '0,14': { k: 'carpark', f: 2, d: 'virginia', x: 6, z: 778, o: { full: 0.95 } },
  '13,2': { k: 'unionstation', s: UNION.S, f: 2, d: 'station' },
  '9,11': { k: 'castle', s: CASTLE.S, f: 0, d: 'mall' },
  '11,11': { k: 'dcmuseum', s: MUSEUM.S, f: 0, d: 'mall', o: { v: 'space', title: 'Air and Space Museum' } },
  '9,8': { k: 'dcmuseum', s: MUSEUM.S, f: 2, d: 'mall', o: { v: 'natural', title: 'Natural History Museum' } },
  '11,8': { k: 'dcmuseum', s: MUSEUM.S, f: 2, d: 'mall', o: { v: 'gallery', title: 'National Gallery' } },
  '16,9': { k: 'temple', f: 3, d: 'capitol', o: { title: 'Supreme Court', wall: M.MARBLE } },
  '16,11': { k: 'temple', f: 3, d: 'capitol', o: { title: 'Library of Congress', wall: M.GRANITE, dome: M.ROOF_G } },
};
// which way a lot fronts: the street along its row, or for the rows with none the avenue beside its column
const ROW_F = [-1, 2, 0, 2, 0, -1, -1, 2, 0, -1, -1, -1, 2, 0, 2, 0, -1, -1];
const BACK_F = { 0: 2, 5: 0, 6: 2, 9: 0, 10: 2, 11: 2, 16: 0, 17: 0 }, WEST_OF = new Set([1, 6, 8, 12, 15]), EAST_OF = new Set([2, 7, 9, 13, 16]);   // columns with an avenue on their east, or west, side

// ---- choosing what goes on a lot ------------------------------------------------------------------
let seed = 17910909;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[(rnd() * a.length) | 0], ri = (a, b) => a + ((rnd() * (b - a + 1)) | 0);
function deck(list) { let d = []; return () => { if (!d.length) { d = list.slice(); for (let i = d.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; } } return d.pop(); }; }

const BRICKS = [M.BRICK, M.BRICK, M.BRICK2, M.BROWNST, M.REND_P], PAINTED = [M.REND_Y, M.REND_T, M.REND_C, M.PL_B, M.PL_Y, M.PL_G, M.PL_P, M.PL_W];
const STONES = [M.LIME, M.LIME2, M.MARBLE, M.GRANITE, M.LIME], DOORS = [M.DOOR_R, M.DOOR_B, M.DOOR_G, M.DARK], AWNS = [M.AWN_R, M.AWN_G, M.AWN_B, M.AWN_W];
const ROOFS = [M.ROOF_S, M.ROOF_D, M.ROOF_R, M.ROOF_G], CARS = [M.CAR_A, M.CAR_B, M.CAR_C, M.DARK], PAPER = [M.WP_A, M.WP_B, M.WP_C], INKS = [M.LIT_W, M.LIT_Y, M.LIT_R, M.LIT_B];
const SMALL = deck([['BOOKS', 'Bookshop'], ['DELI', 'Deli'], ['CAFE', 'Coffee shop'], ['PIZZA', 'Pizza place'], ['MAPS', 'Map shop'], ['BAGEL', 'Bagel shop'], ['FLAGS', 'Flag shop'], ['DINER', 'Diner'], ['HATS', 'Hat shop'], ['BIKES', 'Bike shop'], ['TACOS', 'Taco stand'], ['PIES', 'Pie shop']]);
const STREET = deck([['CAFE', 'Cafe block', 1], ['POST', 'Post block', 0], ['HOTEL', 'Hotel block', 1], ['BANK', 'Bank block', 0], ['NEWS', 'News block', 0], ['GRILL', 'Grill block', 1], ['LAW', 'Law block', 0], ['INN', 'Inn block', 1]]);
const OFFICES = deck(['LOBBY', 'UNION', 'EAGLE', 'STAR', 'PRESS', 'ATLAS', 'CEDAR', 'METRO', 'OAK', 'BELL', 'CROWN', 'DELTA', 'NORTH', 'POTOMAC', 'RIVER', 'ELM']);
const BUREAUS = deck(['Bureau of Maps', 'Bureau of Weights', 'Bureau of Stamps', 'Patent office', 'Records office', 'Bureau of Rivers', 'Mint office', 'Bureau of Roads', 'Weather bureau', 'Bureau of Parks', 'Bureau of Lights', 'Census office', 'Bureau of Bridges', 'Archives annex', 'Bureau of Clocks', 'Post office department']);
const FILMS = deck(['UPTOWN', 'AVALON', 'RIALTO', 'CAPITAL']), GLASS_T = deck(['POST', 'STAR', 'NEWS', 'BANK', 'CORP']);
const cap = (s) => s[0] + s.slice(1).toLowerCase();

const MAKE = {
  fedblock: (o = {}) => ({ title: BUREAUS(), wall: pick([M.LIME, M.LIME, M.MARBLE, M.LIME2]), roof: pick([M.ROOF_R, M.ROOF_R, M.ROOF_R, M.ZINC, M.ROOF_G]), floors: ri(4, 5), porch: rnd() < 0.4 ? 1 : 0, flag: rnd() < 0.5 ? 1 : 0, ...o }),
  dcoffice: () => { const name = OFFICES(); return { name, title: cap(name) + ' building', floors: ri(6, 8), wall: pick([M.LIME, M.LIME2, M.CONC, M.GRANITE, M.REND_C, M.BRICK2]), glass: pick([M.GLASS, M.GLASS, M.GLASS_G, M.GLASS_Z]), ink: pick(INKS), awn: pick(AWNS), car: rnd() < 0.35 ? pick(CARS) : 0 }; },
  brownstone: () => ({ walls: [pick(BRICKS), pick(BRICKS), pick(BRICKS)], doors: [pick(DOORS), pick(DOORS), pick(DOORS)], floors: [ri(3, 4), ri(3, 4), ri(3, 4)], trim: pick([M.TRIM, M.STONE, M.LIME2]), inside: rnd() < 0.3, car: rnd() < 0.3 ? pick(CARS) : 0 }),
  rowhouse: () => ({ walls: [pick(BRICKS), pick(PAINTED), pick(rnd() < 0.5 ? BRICKS : PAINTED)], doors: [pick(DOORS), pick(DOORS), pick(DOORS)], roof: pick(ROOFS) }),
  cottage: () => ({ wall: pick(PAINTED), roof: pick(ROOFS), shutters: pick(DOORS), door: pick(DOORS), paper: pick(PAPER) }),
  haussmann: (lo, hi) => { const [name, title, terrace] = STREET(); return { floors: ri(lo, hi), name, title, terrace, wall: pick(STONES), front: pick([M.DOOR_G, M.TRUNK, M.DOOR_B, M.DARK]), awn: pick(AWNS), door: pick(DOORS), roof: pick([M.ZINC, M.ROOF_D, M.ROOF_G]), inside: rnd() < 0.25, car: rnd() < 0.3 ? pick(CARS) : 0 }; },
  shop: () => { const [name, title] = SMALL(); return { name, title, wall: pick([...BRICKS, ...PAINTED]), awn: pick(AWNS), door: pick(DOORS), ink: pick(INKS), car: rnd() < 0.4 ? pick(CARS) : 0, paper: pick(PAPER) }; },
  flats: (lo, hi) => ({ floors: ri(lo, hi), wall: pick([M.BRICK, M.BRICK2, M.REND_C, M.CONC, M.LIME2]), door: pick(DOORS), awn: pick(AWNS), car: rnd() < 0.4 ? pick(CARS) : 0, title: pick(['Embassy flats', 'Riverside flats', 'Capitol flats', 'Circle flats', 'Grand hotel']) }),
  tower: (lo, hi) => { const name = GLASS_T(); return { floors: ri(lo, hi), name, title: cap(name) + ' tower', glass: pick([M.GLASS, M.GLASS_G, M.GLASS_Z]), span: pick([M.SPANDREL, M.SPAN_G, M.SPAN_Z]), ink: pick(INKS) }; },
  cinema: () => { const name = FILMS(); return { name, title: cap(name) + ' cinema', wall: pick([M.REND_C, M.BRICK2, M.REND_P]), ink: pick([M.LIT_R, M.LIT_Y]) }; },
  carpark: () => ({ full: 0.5 + rnd() * 0.4 }),
  park: () => ({}),
  place: () => ({}),
  dcgrove: (v = 0) => ({ v }),
};
// what each district is made of: [kind, weight, arguments]
const DIST = {
  G: [['rowhouse', 34], ['brownstone', 30], ['shop', 18], ['cottage', 6], ['park', 4], ['flats', 5, [3, 4]], ['place', 3]],
  K: [['dcoffice', 54], ['haussmann', 14, [5, 6]], ['flats', 12, [6, 7]], ['shop', 6], ['cinema', 3], ['carpark', 4], ['place', 3], ['park', 2], ['fedblock', 2]],
  F: [['fedblock', 70], ['dcoffice', 12], ['haussmann', 6, [5, 6]], ['place', 4], ['park', 4], ['carpark', 4]],
  R: [['brownstone', 40], ['rowhouse', 28], ['shop', 12], ['cottage', 6], ['park', 5], ['flats', 6, [3, 5]], ['carpark', 3]],
  S: [['flats', 34, [5, 7]], ['dcoffice', 26], ['fedblock', 14], ['carpark', 8], ['shop', 8], ['park', 5], ['place', 5]],
};
const NAMES = { G: 'georgetown', K: 'downtown', F: 'federal', R: 'hill', S: 'southwest' };
const TURNS = new Set(['brownstone', 'rowhouse', 'shop', 'apartment', 'cinema', 'haussmann', 'dcoffice', 'fedblock']);
const PIECE = { g: ['dcgrove', 0], l: ['dcgrove', 1], t: ['fedblock', { title: 'The Treasury', wall: M.GRANITE, roof: M.ZINC, floors: 4, porch: 1, flag: 1 }], e: ['fedblock', { title: 'Old executive offices', wall: M.GRANITE, roof: M.ROOF_S, floors: 5, porch: 1, flag: 1 }] };

export function dcLots() {
  const out = [];
  const draw = (ch, inner) => {
    const table = DIST[ch];
    let t = rnd() * table.reduce((s, e) => s + e[1], 0), e = table[0];
    for (const x of table) { t -= x[1]; if (t < 0) { e = x; break; } }
    let [k, , a = []] = e;
    if (inner && (k === 'tower' || k === 'carpark' || k === 'cinema')) { k = ch === 'F' ? 'fedblock' : 'dcoffice'; a = []; }   // these want a street in front of them
    return [k === 'flats' ? 'apartment' : k, MAKE[k](...a)];
  };
  let sid = 0;
  for (let r = 0; r < PZ.length; r++) for (let c = 0; c < PX.length; c++) {
    const key = c + ',' + r, ch = MAP[r][c], fix = FIXED[key];
    if (!fix && ch === '.') continue;
    let f = ROW_F[r];
    const inner = f < 0 && !WEST_OF.has(c) && !EAST_OF.has(c);
    if (f < 0) f = WEST_OF.has(c) ? 1 : EAST_OF.has(c) ? 3 : BACK_F[r];
    let kind, opt, d = NAMES[ch] || 'mall';
    if (fix) { kind = fix.k; opt = fix.o; d = fix.d; f = fix.f; }
    else if (PIECE[ch]) { const [k, a] = PIECE[ch]; kind = k; opt = MAKE[k](a); if (ch === 't') f = 3; if (ch === 'e') f = 1; }
    else [kind, opt] = draw(ch, inner);
    // every other corner lot turns to face its avenue, so the avenues are lined with fronts and not with side walls
    if (!fix && TURNS.has(kind) && ROW_F[r] >= 0 && (r + c) % 2 === 0) f = WEST_OF.has(c) ? 1 : EAST_OF.has(c) ? 3 : f;
    const L = { x: fix && fix.x !== undefined ? fix.x : PX[c], z: fix && fix.z !== undefined ? fix.z : PZ[r], f, k: kind, d, c, r, sid: sid++ };
    if (opt && inner) opt.car = 0;   // a lot inside a block has no street to park on
    if (opt) L.o = opt;
    if (fix && fix.s) L.s = fix.s;
    out.push(L);
  }
  // brownstones stand wall to wall: two side by side in a block that face the same way are joined (their side walls are
  // pushed out to meet and left blank). Directions are 0 north, 1 east, 2 south, 3 west.
  const at = new Map(out.filter((L) => !L.s && !(FIXED[L.c + ',' + L.r])).map((L) => [L.c + ',' + L.r, L]));
  const near = (c, r, d) => (d === 1 ? PX[c + 1] - PX[c] : d === 3 ? PX[c] - PX[c - 1] : d === 2 ? PZ[r + 1] - PZ[r] : PZ[r] - PZ[r - 1]) === 46;   // the same block that way
  const LEFT = [3, 0, 1, 2];   // the direction a lot's left side (its low local x) looks, by facing
  for (const L of at.values()) {
    if (L.k !== 'brownstone') continue;
    for (const d of [(L.f + 1) % 4, (L.f + 3) % 4]) {
      if (!near(L.c, L.r, d)) continue;
      const N = at.get((L.c + [0, 1, 0, -1][d]) + ',' + (L.r + [-1, 0, 1, 0][d]));
      if (!N || N.k !== 'brownstone' || N.f !== L.f) continue;
      if (d === LEFT[L.f]) L.o.jl = 1; else L.o.jr = 1;
    }
  }
  return out;
}
export const DC_KIT = { fedblock, dcoffice, dcgrove, temple, whitehouse, capitol, lincoln, wmonument, jefferson, pentagon, ww2, castle, dcmuseum, unionstation, ellipse };
// ground colours for the lots (ground.js)
export const DC_PAD = { fedblock: '#cfc9b8', dcoffice: '#c4c1b6', temple: '#d6d1c2', brownstone: '#b9b5ab', rowhouse: '#a9ad9a', haussmann: '#c8c2b2', shop: '#c2bcae', apartment: '#c2bcae', cinema: '#c2bcae', tower: '#c2c4c6',
  park: '#79aa62', dcgrove: '#79aa62', cottage: '#86b06c', place: '#d2cab6', carpark: '#55595f' };

// where the street dressing (lamps, parked cars, trees) must stay away: the water and its banks
export function dcKeepOut(x, z) { return wet(x, z) || wet(x - 6, z) || wet(x + 6, z) || wet(x, z - 6) || wet(x, z + 6); }
