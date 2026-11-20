// Paris: the second map. The same size as the big city, on the same kind of street grid (the army's route finding and
// the rivals need straight streets that run edge to edge), with the Seine across the middle. Built when the bundle is
// made with __PARIS__ (python3 build.py paris). The streets are in world.js; this file turns them into lots.
//
// North is low z. From the top: Montmartre, the grand boulevards, the Champs-Elysees and Rue de Rivoli, the Right Bank
// quay, the river (z 406 to 542) with its island, the Left Bank quay, Saint-Germain, Montparnasse and the ring road.
// He hatches in the south-east corner, by a village of small houses, and the Eiffel Tower stands over the first avenue
// in from the west.
import { M, LOT, STREET_X } from './world.js';
import { haussmann, lawn, place, market } from './paris_kit.js';
import { eiffel, EIFFEL } from './paris_eiffel.js';
import { arc, notredame, louvre, sacrecoeur, ARC, NOTRE_DAME } from './paris_landmarks.js';

// where each column and row of 40-voxel lots starts: 6 apart inside a block, a street's width apart across one
export const PX = [41, 87, 133, 212, 258, 304, 386, 432, 478, 560, 606, 652, 698, 780, 862, 908, 954];
export const PZ = [40, 86, 162, 208, 284, 330, 578, 624, 670, 746, 792, 868, 914];
export const SEINE = { z0: 406, z1: 542 };
export const ISLE = { tip: 722, x0: 746, x1: 1004, z0: 440, z1: 508 };     // the island: a point at the west end, then a long quay
export const ISLET = { x0: 52, x1: 140, z: 474 };                           // the narrow islet with the little statue
export const ETOILE = { x: 107, z: 266, r: 58 };                            // the round plaza where the Arc will stand
export const NOTRE = { x: 874, z: 446 };                                    // Notre-Dame's west front, on the island (it runs east from here)
export const TOWER = { x: 133, z: 578 };                                    // the Eiffel Tower's lot (119 by 132)

// One letter a lot. Capitals are districts, filled from a weighted list:
//   H Haussmann blocks   C the Champs-Elysees   V Montmartre village   L the Left Bank's old streets   R the Marais
//   P Montparnasse       S the village where he hatches
//   N more city where there were gardens and squares (2026-11-20, Will chose "Add more city to Paris": Paris fell too fast,
//     about 87% down at the bell against two thirds elsewhere). They draw from their own random numbers and names, so the
//     rest of the city Will approved is laid out exactly as before.
// Small letters are single pieces: g garden, p paved square, f square with a drinking fountain, l lawn, k car park,
// o column or statue, c church, m street market. A dot is ground a big piece takes, or bare paving.
// Ground set aside for a landmark that is not built yet holds a garden, a lawn or a square for now.
const MAP = [
  'HHHVVVV..VVVVHHHH',
  'HHHVNVV..VVVHHHHH',
  'HHHHHHHHHHHHHHRRo',
  '...CCCCCCHoHHHRRR',
  '...CCCCCoNN..HRRR',
  'HHNNHHCCNNN..HRRR',
  'HH..HHHHHLLLLNLLL',
  'HH..HHHHHLLLLLLLL',
  'HH..HHllHLcLLLLLL',
  'HHllHHHHHNNLLLLLL',
  'HHllHHHHHNNLLLLLL',
  '..PPPPP.PPoPPSmSS',
  '..PPPPPkPPPPNSSSS',
];
// the pieces that are not one plain lot: 'c,r' of the lot at their north-west corner
const FIXED = {
  '2,6': { k: 'eiffel', s: EIFFEL.D, f: 0, d: 'tower' },
  '0,11': { k: 'stadium', s: 86, f: 0, d: 'south', o: { seats: [M.CAR_B, M.TRIM, M.CAR_A, M.TRIM], home: 'PARIS 2', away: 'LYON 1' } },
  '0,3': { k: 'arc', s: ARC.S, f: 0, d: 'champs', at: [ETOILE.x - ARC.S / 2, ETOILE.z - ARC.S / 2] },
  '11,4': { k: 'louvre', s: 86, f: 3, d: 'right' },
  '7,0': { k: 'sacrecoeur', s: 86, f: 2, d: 'montmartre' },
  '7,11': { k: 'tower', d: 'south', o: { floors: 15, name: 'TOUR', title: 'Dark tower', glass: M.GLASS_Z, span: M.SPAN_Z, ink: M.LIT_W } },
};
// which way a lot fronts: the street along its row, or for the two rows with none (0 and 7) the avenue beside its column
const ROW_F = [-1, 2, 0, 2, 0, 2, 0, -1, 2, 0, 2, 0, 2];
const WEST_OF = new Set([2, 5, 8, 12]), EAST_OF = new Set([3, 6, 9, 13, 14]);   // columns with an avenue on their east, or west, side

// ---- choosing what goes on a lot ------------------------------------------------------------------
let seed = 17890714;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
let seedN = 20261120;
const pick = (a) => a[(rnd() * a.length) | 0], ri = (a, b) => a + ((rnd() * (b - a + 1)) | 0);
function deck(list) { let d = []; return () => { if (!d.length) { d = list.slice(); for (let i = d.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; } } return d.pop(); }; }

const STONE = [M.LIME, M.LIME, M.LIME2, M.REND_C, M.PL_W], SLATES = [M.ZINC, M.ZINC, M.ROOF_S, M.ROOF_S, M.ROOF_D], PLASTER = [M.PL_W, M.PL_Y, M.PL_P, M.PL_B, M.PL_G], OLD = [M.LIME2, M.REND_C, M.REND_Y, M.REND_P, M.BRICK2];
const FRONTS = [M.DOOR_G, M.DOOR_R, M.DOOR_B, M.DARK], AWNS = [M.AWN_R, M.AWN_G, M.AWN_B, M.AWN_W], DOORS = [M.DOOR_R, M.DOOR_B, M.DOOR_G];
const ROOFS = [M.ROOF_S, M.ROOF_R, M.ROOF_D], CARS = [M.CAR_A, M.CAR_B, M.CAR_C], PAPER = [M.WP_A, M.WP_B, M.WP_C], INKS = [M.LIT_W, M.LIT_Y, M.LIT_R];
// shop names are French and short enough for the board over the shopfront; the title is what the game calls the building
const STREET = deck([['CAFE', 'Cafe', 1], ['BISTRO', 'Bistro', 1], ['TABAC', 'Tobacconist'], ['PAIN', 'Bakery'], ['FLEURS', 'Florist'], ['LIVRES', 'Bookshop'], ['VINS', 'Wine shop'],
  ['CREPES', 'Creperie', 1], ['FROMAGE', 'Cheese shop'], ['GLACES', 'Ice cream shop', 1], ['HOTEL', 'Hotel'], ['PRESSE', 'Newsagent'], ['THE', 'Tea room', 1], ['JOUETS', 'Toy shop'],
  ['MUSIQUE', 'Music shop'], ['GATEAUX', 'Cake shop'], ['POISSON', 'Fishmonger'], ['VELOS', 'Bike shop'], ['ARTS', 'Art shop'], ['JAZZ', 'Jazz club']]);
const SMART = deck([['MODE', 'Fashion house'], ['BIJOUX', 'Jeweller'], ['PARFUM', 'Perfume shop'], ['CAFE', 'Grand cafe', 1], ['HOTEL', 'Grand hotel'], ['CINE', 'Picture house'], ['GALERIE', 'Gallery'], ['SOIE', 'Silk shop']]);
const SMALL = deck([['PAIN', 'Bakery'], ['CAFE', 'Corner cafe'], ['VINS', 'Wine shop'], ['FLEURS', 'Florist'], ['CREPES', 'Creperie'], ['LIVRES', 'Bookshop'], ['ARTS', 'Art shop'], ['FROMAGE', 'Cheese shop'], ['TABAC', 'Tobacconist'], ['JOUETS', 'Toy shop']]);
const FILMS = deck(['REX', 'LUX', 'ROXY', 'CINE']), TOWERS = deck(['SUD', 'GARE', 'NORD', 'AXE', 'PLAN']);
const cap = (s) => s[0] + s.slice(1).toLowerCase();
// the new blocks' shop names: a deck of their own, so the names on the old blocks do not move
const STREET_N = deck([['CAFE', 'Cafe', 1], ['BISTRO', 'Bistro', 1], ['TABAC', 'Tobacconist'], ['PAIN', 'Bakery'], ['FLEURS', 'Florist'], ['LIVRES', 'Bookshop'], ['VINS', 'Wine shop'], ['CREPES', 'Creperie', 1], ['FROMAGE', 'Cheese shop'], ['HOTEL', 'Hotel'], ['PRESSE', 'Newsagent'], ['JOUETS', 'Toy shop'], ['GATEAUX', 'Cake shop'], ['ARTS', 'Art shop']]);

const MAKE = {
  // one in three is furnished inside; the rest are floors and walls, which keeps a map of close-knit blocks light
  haussmann: (lo, hi, names = STREET) => { const [name, title, terrace] = names(); return { floors: ri(lo, hi), name, title, terrace, wall: pick(STONE), front: pick(FRONTS), awn: pick(AWNS), door: pick(DOORS), roof: pick(SLATES), inside: rnd() < 0.34, car: rnd() < 0.3 ? pick(CARS) : 0 }; },
  shop: () => { const [name, title] = SMALL(); return { name, title, wall: pick(OLD), awn: pick(AWNS), door: pick(DOORS), ink: pick(INKS), car: rnd() < 0.5 ? pick(CARS) : 0, paper: pick(PAPER) }; },
  cottage: () => ({ wall: pick(PLASTER), roof: pick(ROOFS), shutters: pick(DOORS), door: pick(DOORS), paper: pick(PAPER) }),
  rowhouse: () => ({ walls: [pick(OLD), pick(PLASTER), pick(OLD)], doors: [pick(DOORS), pick(DOORS), pick(DOORS)], roof: pick(ROOFS) }),
  flats: (lo, hi) => ({ floors: ri(lo, hi), wall: pick([M.REND_C, M.REND_T, M.REND_Y, M.BRICK2]), door: pick(DOORS), awn: pick(AWNS), car: rnd() < 0.6 ? pick(CARS) : 0 }),
  tower: (lo, hi) => { const name = TOWERS(); return { floors: ri(lo, hi), name, title: cap(name) + ' tower', glass: pick([M.GLASS, M.GLASS_G]), span: M.SPANDREL, ink: pick(INKS) }; },
  cinema: () => { const name = FILMS(); return { name, title: cap(name) + ' cinema', wall: pick([M.REND_C, M.LIME, M.REND_P]), ink: pick([M.LIT_R, M.LIT_Y]) }; },
  carpark: () => ({ full: 0.5 + rnd() * 0.4 }),
};
// what each district is made of: [kind, weight, options]. 'smart' is a Haussmann block with a smarter shop, 'flats' a modern block.
const DIST = {
  H: [['haussmann', 88, [3, 5]], ['shop', 3], ['cinema', 3], ['church', 2], ['place', 2], ['park', 2]],
  C: [['smart', 90, [4, 5]], ['cinema', 6], ['place', 4]],
  V: [['rowhouse', 30], ['shop', 28], ['haussmann', 20, [3, 4]], ['cottage', 12], ['park', 4], ['place', 4], ['church', 2]],
  L: [['haussmann', 72, [3, 5]], ['shop', 11], ['rowhouse', 9], ['church', 2], ['cinema', 2], ['place', 2], ['park', 2]],
  R: [['haussmann', 62, [3, 4]], ['rowhouse', 17], ['shop', 15], ['place', 3], ['park', 3]],
  P: [['haussmann', 46, [4, 6]], ['flats', 20, [5, 7]], ['tower', 6, [6, 9]], ['shop', 10], ['cinema', 5], ['carpark', 5], ['park', 4], ['place', 4]],
  S: [['cottage', 38], ['rowhouse', 24], ['shop', 20], ['park', 8], ['place', 4], ['market', 6]],
};
const ONE = { g: 'park', p: 'place', f: 'place', l: 'lawn', k: 'carpark', o: 'plaza', c: 'church', m: 'market' };
const NAMES = { N: 'right', H: 'right', C: 'champs', V: 'montmartre', L: 'left', R: 'marais', P: 'south', S: 'village' };
const COLUMNS = { '10,3': 'Vendome column', '16,2': 'July column', '8,4': 'Obelisk', '10,11': 'Lion statue' };

// UP: one more floor on every Haussmann block, for more city to wreck (being tried, 2026-11-20; 0 is the approved height)
const UP = 0;
export function parisLots() {
  const out = [];
  for (let r = 0; r < PZ.length; r++) for (let c = 0; c < PX.length; c++) {
    const key = c + ',' + r, ch = MAP[r][c], fix = FIXED[key];
    if (!fix && ch === '.') continue;
    let f = ROW_F[r];
    if (f < 0) f = WEST_OF.has(c) ? 1 : EAST_OF.has(c) ? 3 : r === 0 ? 2 : 0;
    let kind, opt, d = NAMES[ch] || 'garden';
    if (fix) { kind = fix.k; opt = fix.o; d = fix.d; if (fix.f !== undefined) f = fix.f; }
    else if (ONE[ch]) {
      kind = ONE[ch];
      if (ch === 'f') opt = { fountain: 1 };
      else if (ch === 'o') opt = { title: COLUMNS[key] || 'Column' };
      else if (ch === 'k') opt = MAKE.carpark();
      else if (ch === 'l') opt = { cannons: r === 8 && (c === 6 || c === 7), beds: r === 9 || r === 10 };
    } else if (ch === 'N') {   // a new block, on its own random numbers (see MAP)
      const keep = seed; seed = seedN;
      kind = 'haussmann'; opt = MAKE.haussmann(4, 6, STREET_N);
      seedN = seed; seed = keep;
    } else {
      const table = DIST[ch];
      let t = rnd() * table.reduce((s, e) => s + e[1], 0), e = table[0];
      for (const x of table) { t -= x[1]; if (t < 0) { e = x; break; } }
      const [k, , a] = e; kind = k;
      if (k === 'haussmann') opt = MAKE.haussmann(a[0], a[1]);
      else if (k === 'smart') { kind = 'haussmann'; opt = MAKE.haussmann(a[0], a[1], SMART); opt.wall = M.LIME; }
      else if (k === 'flats') { kind = 'apartment'; opt = MAKE.flats(a[0], a[1]); }
      else if (k === 'tower') opt = MAKE.tower(a[0], a[1]);
      else if (MAKE[k]) opt = MAKE[k]();
    }
    if (UP && kind === 'haussmann' && opt && ch !== 'N') opt.floors += UP;   // see UP
    const L = { x: PX[c], z: PZ[r], f, k: kind, d, c, r };
    if (opt && ROW_F[r] < 0 && !WEST_OF.has(c) && !EAST_OF.has(c)) { opt.car = 0; opt.terrace = 0; }   // a lot inside a block has no street to park on
    if (opt) L.o = opt;
    if (fix && fix.s) L.s = fix.s;
    if (fix && fix.at) { L.x = fix.at[0]; L.z = fix.at[1]; }
    out.push(L);
  }
  out.push({ x: NOTRE.x, z: NOTRE.z, f: 3, k: 'notredame', s: NOTRE_DAME.W, d: 'island' });   // the island is outside the grid of lots
  joinBlocks(out);
  return out;
}
// Close-knit blocks: two Haussmann buildings that stand next to each other in a block are joined, side to side along a
// street and back to back at a block's ends, so a block is one closed wall of fronts round a narrow courtyard. A front is
// never joined. Directions are 0 north, 1 east, 2 south, 3 west, like a lot's facing.
function joinBlocks(lots) {
  const at = new Map(lots.map((L) => [L.c + ',' + L.r, L]));
  const near = (c, r, d) => (d === 1 ? PX[c + 1] - PX[c] : d === 3 ? PX[c] - PX[c - 1] : d === 2 ? PZ[r + 1] - PZ[r] : PZ[r] - PZ[r - 1]) === 46;   // the same block that way
  const role = (L, d) => (d === L.f ? 'front' : d === (L.f + 2) % 4 ? 'back' : 'side');
  const end = (L) => !near(L.c, L.r, (L.f + 1) % 4) || !near(L.c, L.r, (L.f + 3) % 4);   // the last building of its row
  const LEFT = [3, 0, 1, 2];   // the direction a lot's left side (its low local x) looks, by facing
  for (const L of lots) {
    if (L.k !== 'haussmann' || L.s) continue;
    for (let d = 0; d < 4; d++) {
      if (!near(L.c, L.r, d)) continue;
      const N = at.get((L.c + [0, 1, 0, -1][d]) + ',' + (L.r + [-1, 0, 1, 0][d]));
      if (!N || N.k !== 'haussmann' || N.s) continue;
      const a = role(L, d), b = role(N, (d + 2) % 4);
      if (a === 'front' || b === 'front' || (a === 'back' && b === 'back' && !end(L) && !end(N))) continue;
      if (a === 'back') L.o.jb = 1; else if (d === LEFT[L.f]) L.o.jl = 1; else L.o.jr = 1;
    }
  }
}
export const PARIS_KIT = { haussmann, lawn, place, market, eiffel, arc, notredame, louvre, sacrecoeur };
// ground colours for the lots (ground.js): Paris is pale gravel and paving, and green only where something grows
export const PARIS_PAD = { haussmann: '#cbc4b3', place: '#d8cfba', market: '#d2c9b4', park: '#79aa62', lawn: '#79aa62', cottage: '#86b06c', rowhouse: '#86b06c', church: '#86b06c' };

// is this spot water? (the island and the islet are roughly their painted shapes)
export function wet(x, z) {
  if (z < SEINE.z0 || z >= SEINE.z1) return false;
  if (x >= ISLE.tip && x < ISLE.x1 && z >= ISLE.z0 && z < ISLE.z1) return false;
  return !(x >= ISLET.x0 && x < ISLET.x1 && Math.abs(z - ISLET.z) < 7);
}
// where the street dressing (lamps, parked cars, trees) must stay away: the river, the round plaza and under the tower
export function parisKeepOut(x, z) {
  if (z > SEINE.z0 - 8 && z < SEINE.z1 + 8) return true;
  if (Math.hypot(x - ETOILE.x, z - ETOILE.z) < ETOILE.r + 4) return true;
  if (x > TOWER.x - 2 && x < TOWER.x + EIFFEL.W + 2 && z > TOWER.z - 2 && z < TOWER.z + EIFFEL.D + 2) return true;
  return false;
}
export const onBridge = (x) => STREET_X.some((s) => Math.abs(x - s) < 20);
