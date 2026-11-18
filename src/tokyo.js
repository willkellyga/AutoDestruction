// Tokyo: the fourth map. The same size as the big city, Paris and New York, on the same kind of street grid (the army's
// route finding and the rivals need straight streets that run edge to edge). Built when the bundle is made with
// __TOKYO__ (python3 build.py tokyo). The streets are in world.js; this file turns them into lots.
//
// North is low z. The Sumida River runs down the east side under six coloured bridges and opens into Tokyo Bay in the
// south-east, which the Rainbow Bridge crosses. West of the river, from the top: the park at Ueno and the old low town,
// Senso-ji by the river with the Sora Tower across it, the electric town, the towers of Shinjuku in the west, the
// palace in the middle behind its moat with the brick station facing it, the shrine in its wood, the business blocks,
// Shiba Tower, the scramble crossing in the south-west, the container port along the water and the Bay Wheel.
// He hatches at the east end of the Rainbow Bridge, looking across the bay at the skyline: out of the sea, as is proper.
//
// The map is flat: the water is painted on the ground and monsters wade. A street that crosses water is a bridge.
// The two towers and the wheel are our own takes under our own names; the temple, palace, station and bridge keep theirs.
import { M, STREET_X } from './world.js';
import { billboard } from './nyc_kit.js';
import { machiya, zakkyo, shrine, garden, port } from './tokyo_kit.js';
import { shibatower, soratower, sensoji, palace, station, baywheel, PALACE, STATION, SENSO, SHIBA, WHEEL } from './tokyo_landmarks.js';

// where each column and row of 40-voxel lots starts: 6 apart inside a block, a street's width apart across one
export const PX = [6, 52, 98, 177, 223, 269, 351, 397, 443, 525, 571, 617, 699, 745, 875, 957];
export const PZ = [4, 50, 126, 172, 248, 294, 370, 416, 462, 542, 588, 664, 710, 786, 832, 908, 954];
export const RIVER = { x0: 790, x1: 868 };                   // the Sumida, the whole height of the map
export const BAY = { x0: 698, z0: 832 };                     // Tokyo Bay: from here east to the river's far bank, and south
export const PALACE_AT = { x: 351, z: 370 }, STATION_AT = { x: 525, z: 370 }, SENSO_AT = { x: 699, z: 126 }, SORA_AT = { x: 875, z: 172 };
export const SHIBA_AT = { x: 351, z: 664 }, WHEEL_AT = { x: 571, z: 908 }, SCRAMBLE = { x: 156, z: 768 }, POND_AT = { x: 571, z: 50 };
// is this spot water?
export function wet(x, z) { return x < RIVER.x1 && (x >= RIVER.x0 || (x >= BAY.x0 && z >= BAY.z0)); }

// One letter a lot. Capitals are districts, filled from a weighted list:
//   Z the dense sign-hung blocks   R the old low town   J Shinjuku   M the business blocks   K the electric town
//   A the mixed wards of the south and west   T the scramble crossing   P the port   O the island side of the bay
// Small letters are single pieces: y a cherry garden, u the garden with the pond, s a shrine, t the great torii,
// d the garden with the dog's statue, c a quay with a gantry crane. A dot is water, or ground a big piece takes.
const MAP = [
  'ZZZRRRZZZyyyRRRR',
  'ZZZRRRZZZyuyRRRR',
  'JJZZZZRRRKKK..RR',
  'JJZZZZRsRKKK...R',
  'JJJJZZMMMZZZRRRR',
  'JJJJZZMMMZZZRsRR',
  'JJJAAA......MMRR',
  'styAAA......MMRR',
  'yyJAAA......MMRR',
  'JJyAAAMMMMMMPcRR',
  'AAAAAAMMMMMMPcRR',
  'AATTAA..AAAAPcOO',
  'ATTTTA..AAAAPcOO',
  'AdTTTAAAAAPPccOO',
  'AAAAAAAAAPPP..OO',
  'AAAAAAAyyy....Oy',
  'AAAAAAAyyy....OO',
];
// the pieces that are not one plain lot: 'c,r' of the lot at their north-west corner
const FIXED = {
  '6,6': { k: 'palace', s: PALACE.S, f: 1, d: 'palace' },
  '9,6': { k: 'station', s: STATION.S, f: 3, d: 'marunouchi' },
  '12,2': { k: 'sensoji', s: SENSO.S, f: 2, d: 'asakusa' },
  '14,3': { k: 'soratower', f: 3, d: 'sumida' },
  '6,11': { k: 'shibatower', s: SHIBA.S, f: 0, d: 'minato' },
  '10,15': { k: 'baywheel', s: WHEEL.S, f: 1, d: 'bay' },
};
// which way a lot fronts: the street along its row, or for the rows with none the avenue beside its column
const ROW_F = [-1, 2, 0, 2, 0, 2, 0, -1, 2, 0, 2, 0, 2, 0, 2, 0, -1], BACK_F = { 0: 2, 7: 0, 16: 0 };
const WEST_OF = new Set([2, 5, 8, 11, 14]), EAST_OF = new Set([3, 6, 9, 12, 15]);   // columns with an avenue on their east, or west, side

// ---- choosing what goes on a lot ------------------------------------------------------------------
let seed = 18680903;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[(rnd() * a.length) | 0], ri = (a, b) => a + ((rnd() * (b - a + 1)) | 0);
function deck(list) { let d = []; return () => { if (!d.length) { d = list.slice(); for (let i = d.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; } } return d.pop(); }; }

const HOUSE = [M.PL_W, M.PL_W, M.TRUNK, M.WOOD, M.REND_C, M.PL_Y, M.LIME2], CLAD = [M.REND_C, M.CONC, M.PL_B, M.BRICK2, M.TRIM, M.REND_T, M.LIME, M.PL_P, M.SLAB, M.REND_Y, M.TANK];
const AWNS = [M.AWN_R, M.AWN_G, M.AWN_B, M.AWN_W, M.DOOR_B], DOORS = [M.DOOR_R, M.DOOR_B, M.DOOR_G, M.DARK], TILES = [M.ROOF_S, M.ROOF_S, M.ROOF_D, M.ZINC];
const CARS = [M.CAR_C, M.CAR_C, M.CAR_A, M.CAR_B, M.TAXI], PAPER = [M.WP_A, M.WP_B, M.WP_C], INKS = [M.LIT_W, M.LIT_Y, M.LIT_R], BRICKS = [M.BRICK2, M.REND_C, M.CONC, M.LIME2];
const VEND = [M.CAR_A, M.TRIM, M.CAR_B, M.DOOR_G];
// the signs: short words, each with a background and a letter colour (our own made-up shops)
const SIGNS = deck([['RAMEN', M.LIT_R, M.LIT_W], ['SUSHI', M.DARK, M.LIT_Y], ['KARAOKE', M.LIT_P, M.LIT_W], ['MANGA', M.LIT_Y, M.DARK], ['ARCADE', M.DARK, M.LIT_G], ['NEKO', M.LIT_W, M.CAR_A],
  ['UDON', M.CAR_B, M.LIT_W], ['SOBA', M.DARK, M.LIT_W], ['TEA', M.LIT_G, M.DARK], ['BOOKS', M.LIT_W, M.CAR_B], ['CAMERA', M.DARK, M.LIT_Y], ['RADIO', M.LIT_B, M.DARK], ['GAMES', M.DARK, M.LIT_P],
  ['HOTEL', M.CAR_A, M.LIT_W], ['CAFE', M.LIT_W, M.DOOR_G], ['CURRY', M.LIT_Y, M.CAR_A], ['BENTO', M.LIT_R, M.LIT_Y], ['KAIJU', M.DARK, M.LIT_G], ['ROBOT', M.LIT_B, M.LIT_W], ['KAWAII', M.LIT_P, M.LIT_W],
  ['DENKI', M.LIT_Y, M.CAR_B], ['GYOZA', M.DARK, M.LIT_R], ['TAIKO', M.CAR_A, M.LIT_Y], ['TOYS', M.LIT_G, M.LIT_W], ['MOCHI', M.LIT_W, M.LIT_P], ['TEMPURA', M.DARK, M.LIT_Y], ['IZAKAYA', M.CAR_A, M.LIT_W],
  ['ANIME', M.LIT_B, M.LIT_Y], ['PURIN', M.LIT_Y, M.DARK], ['ONSEN', M.DARK, M.LIT_B], ['BAR', M.DARK, M.LIT_R], ['YAKI', M.LIT_R, M.DARK], ['MATCHA', M.LIT_G, M.LIT_W], ['OTAKU', M.DARK, M.LIT_P]]);
const ROOFW = deck(['TV', 'ZAP', 'POP', 'WOW', 'YUM', 'UFO', 'CD', 'DVD', 'HI', 'GO', 'OK', 'FM']);
const SMALL = deck([['RAMEN', 'Ramen shop'], ['SUSHI', 'Sushi bar'], ['TEA', 'Tea house'], ['MOCHI', 'Sweet shop'], ['BOOKS', 'Bookshop'], ['SOBA', 'Noodle shop'], ['BENTO', 'Lunch box shop'], ['TOYS', 'Toy shop'], ['CAFE', 'Cat cafe'], ['MANGA', 'Comic shop']]);
const FILMS = deck(['KINO', 'GEM', 'STAR', 'LYRIC']), GLASS_T = deck(['BANK', 'DENKI', 'SORA', 'AXIS', 'RADIO', 'APEX', 'UMI', 'HANA', 'KAZE', 'MORI']);
const cap = (s) => s[0] + s.slice(1).toLowerCase();

const MAKE = {
  machiya: () => ({ walls: [pick(HOUSE), pick(HOUSE), pick(HOUSE)], cloth: [pick(AWNS), pick(AWNS), pick(AWNS)], tile: pick(TILES), tall: rnd() < 0.3 ? ri(0, 2) : -1, inside: rnd() < 0.25, pole: 1, vend: rnd() < 0.35 ? pick(VEND) : 0, tree: rnd() < 0.3 ? 1 : 0, car: rnd() < 0.25 ? pick(CARS) : 0 }),
  zakkyo: (lo, hi) => { const s = [SIGNS(), SIGNS(), SIGNS()]; return { floors: [ri(lo, hi), ri(lo, hi), ri(lo, hi)], walls: [pick(CLAD), pick(CLAD), pick(CLAD)], signs: s, titles: s.map((x) => cap(x[0]) + ' building'), awn: [pick(AWNS), pick(AWNS), pick(AWNS)], roof: ROOFW(), inside: rnd() < 0.2, pole: rnd() < 0.5, vend: rnd() < 0.5 ? pick(VEND) : 0, tree: 0, car: rnd() < 0.3 ? pick(CARS) : 0 }; },
  billboard: () => ({ floors: ri(6, 9), signs: [SIGNS(), SIGNS(), SIGNS(), SIGNS(), SIGNS(), SIGNS(), SIGNS()], title: 'Scramble block', notank: 1, car: rnd() < 0.4 ? pick(CARS) : 0 }),
  shop: () => { const [name, title] = SMALL(); return { name, title, wall: pick(BRICKS), awn: pick(AWNS), door: pick(DOORS), ink: pick(INKS), car: rnd() < 0.4 ? pick(CARS) : 0, paper: pick(PAPER) }; },
  flats: (lo, hi) => ({ floors: ri(lo, hi), wall: pick([M.REND_C, M.BRICK2, M.CONC, M.LIME2, M.PL_B]), door: pick(DOORS), awn: pick(AWNS), car: rnd() < 0.4 ? pick(CARS) : 0, title: pick(['Mansion block', 'Sakura mansion', 'Riverside mansion', 'Garden mansion']) }),
  tower: (lo, hi) => { const name = GLASS_T(); return { floors: ri(lo, hi), name, title: cap(name) + ' tower', glass: pick([M.GLASS, M.GLASS_G, M.GLASS_Z, M.GLASS]), span: pick([M.SPANDREL, M.SPAN_G, M.SPAN_Z, M.CHROME]), ink: pick(INKS) }; },
  cinema: () => { const name = FILMS(); return { name, title: cap(name) + ' cinema', wall: pick([M.REND_C, M.BRICK2, M.REND_P]), ink: pick([M.LIT_R, M.LIT_Y]) }; },
  carpark: () => ({ full: 0.5 + rnd() * 0.4 }),
  factory: () => ({ wall: pick([M.CONC, M.BRICK2]), name: pick(['COLD', 'RICE', 'FISH', 'TEA']), title: 'Warehouse', car: 0 }),
  shrine: () => ({ tile: pick([M.ROOF_G, M.ROOF_S, M.ROOF_D]) }),
  garden: () => ({ green: rnd() < 0.4 }),
  port: () => ({}),
};
// what each district is made of: [kind, weight, options]
const DIST = {
  Z: [['zakkyo', 50, [3, 7]], ['machiya', 22], ['flats', 5, [5, 7]], ['shop', 9], ['cinema', 4], ['shrine', 5], ['carpark', 5]],
  R: [['machiya', 58], ['zakkyo', 14, [3, 5]], ['shop', 8], ['shrine', 7], ['garden', 6], ['flats', 7, [4, 6]]],
  J: [['tower', 36, [9, 14]], ['zakkyo', 40, [5, 8]], ['flats', 8, [7, 10]], ['cinema', 5], ['shop', 6], ['garden', 5]],
  M: [['tower', 30, [8, 12]], ['zakkyo', 38, [5, 8]], ['flats', 8, [6, 9]], ['cinema', 4], ['shop', 10], ['garden', 6], ['shrine', 4]],
  K: [['billboard', 40], ['zakkyo', 60, [5, 8]]],
  A: [['zakkyo', 28, [3, 6]], ['flats', 11, [5, 8]], ['machiya', 38], ['tower', 5, [8, 12]], ['shrine', 5], ['garden', 6], ['shop', 7]],
  T: [['billboard', 100]],
  P: [['port', 55], ['factory', 35], ['carpark', 10]],
  O: [['tower', 20, [8, 13]], ['flats', 20, [6, 9]], ['garden', 32], ['shop', 14], ['carpark', 14]],
};
const NAMES = { Z: 'shitamachi', R: 'lowtown', J: 'shinjuku', M: 'marunouchi', K: 'akihabara', A: 'minato', T: 'shibuya', P: 'port', O: 'odaiba' };
const TURNS = new Set(['zakkyo', 'machiya', 'shop', 'apartment', 'cinema']);
const PIECE = { y: ['garden', 0], u: ['garden', 1], t: ['garden', 2], d: ['garden', 3], s: ['shrine', 0], c: ['port', 0] };

export function tokyoLots() {
  const out = [];
  for (let r = 0; r < PZ.length; r++) for (let c = 0; c < PX.length; c++) {
    const key = c + ',' + r, ch = MAP[r][c], fix = FIXED[key];
    if (!fix && ch === '.') continue;
    let f = ROW_F[r];
    const inner = f < 0 && !WEST_OF.has(c) && !EAST_OF.has(c);
    if (f < 0) f = WEST_OF.has(c) ? 1 : EAST_OF.has(c) ? 3 : BACK_F[r];
    let kind, opt, d = NAMES[ch] || 'park';
    if (fix) { kind = fix.k; opt = fix.o; d = fix.d; if (fix.f !== undefined) f = fix.f; }
    else if (PIECE[ch]) {
      kind = PIECE[ch][0]; opt = MAKE[kind](); if (kind === 'garden') { opt.v = PIECE[ch][1]; if (opt.v) opt.green = 0; }
      if (ch === 'c') { opt.crane = 1; f = r === 13 ? 2 : 1; d = 'port'; }
    } else {
      const table = DIST[ch];
      let t = rnd() * table.reduce((s, e) => s + e[1], 0), e = table[0];
      for (const x of table) { t -= x[1]; if (t < 0) { e = x; break; } }
      const [k, , a] = e; kind = k;
      if (k === 'flats') { kind = 'apartment'; opt = MAKE.flats(a[0], a[1]); }
      else if (a) opt = MAKE[k](a[0], a[1]);
      else if (MAKE[k]) opt = MAKE[k]();
    }
    // every other corner lot turns to face its avenue, so the avenues are lined with fronts and not with side walls
    if (!fix && TURNS.has(kind) && ROW_F[r] >= 0 && (r + c) % 2 === 0) f = WEST_OF.has(c) ? 1 : EAST_OF.has(c) ? 3 : f;
    if (kind === 'billboard') {
      // a sign block on a corner carries signs down the side that looks onto the avenue too
      const LEFT = [3, 0, 1, 2], way = WEST_OF.has(c) ? 1 : EAST_OF.has(c) ? 3 : -1;
      if (way >= 0) { if (LEFT[f] === way) opt.sl = 1; else opt.sr = 1; }
    }
    const L = { x: PX[c], z: PZ[r], f, k: kind, d, c, r };
    if (opt && inner) { opt.car = 0; opt.vend = 0; }   // a lot inside a block has no street to park on
    if (opt) L.o = opt;
    if (fix && fix.s) L.s = fix.s;
    out.push(L);
  }
  return out;
}
export const TOKYO_KIT = { machiya, zakkyo, shrine, garden, port, billboard, shibatower, soratower, sensoji, palace, station, baywheel };
// ground colours for the lots (ground.js): Tokyo is pavement grey, gravel at its shrines and green in its gardens
export const TOKYO_PAD = { machiya: '#b9b5ab', zakkyo: '#b4b2ac', billboard: '#b4b2ac', shrine: '#d2cbb6', garden: '#7fae66', port: '#8b8e94', soratower: '#c8c4b8', shop: '#b9b5ab', apartment: '#b9b5ab', cinema: '#b9b5ab', tower: '#c2c4c6',
  park: '#79aa62', factory: '#9a9690' };

// where the street dressing (lamps, parked cars, trees) must stay away: the water and its banks
export function tokyoKeepOut(x, z) { return wet(x, z) || wet(x - 6, z) || wet(x + 6, z) || wet(x, z - 6) || wet(x, z + 6); }
export const onStreet = (v, list = STREET_X, d = 20) => list.some((s) => Math.abs(v - s) < d);
