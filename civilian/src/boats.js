// Working boats, built in code at eighth-metre cubes on the same kit as the cars and buses: a harbor tug (15 m) and a
// barge (17 m) with a choice of loads, with or without a wheelhouse aft.
//
// Forward is +z, port (left) is +x, and y = 0 is the waterline: the hull goes on down below it, so there is something to
// see when a boat rolls over, and the water hides the rest. A hull is a shell of cubes cut from a shape function (beam,
// deck height and keel depth along its length), not laid by hand like the cars; the houses, gear and loads on it are.
//
// They break with the cars' own code (blowUp, crush, fireSpots in cars.js), set up by `wk` on each definition. A boat
// that is blown up settles on the harbor bottom with a list, or turns turtle; one that is stepped on is flattened under
// the foot and goes down by that end.
import { GLOW, hash, tone } from '../../units/src/voxpart.js';
import { blowUp, H, bx, bxs, sx, SIDES, half, clamp, ease, sideOf, CHROME, TRIM, BLACK, TYRE, GLASS, GLASS2, SHINE, DASH, WHEELC, ENGINE, ENGINE2, INNER } from './cars.js';
import { lamp, cubes } from './buses.js';

const S = Math.sin, C = Math.cos, PI = Math.PI, ab = Math.abs, fl = Math.floor, rnd = Math.round;
const mod = (a, n) => ((a % n) + n) % n;
const HULL = 0x22252a, BOTTOM = 0x8a2f28, BOOT = 0xdedbd0, WHITE = 0xe9e6dc, RAIL = 0xd6d4cc, DECK = 0x3f5a50, ROPE = 0x9a7a45, ROPE2 = 0x7d6236, WOOD = 0x7a5332, WOOD2 = 0x66442a, STEEL = 0x7a7e85, RUST = 0x6b3a22;
const WHITE_L = 0xfff6d8 | GLOW, RED_L = 0xff2a2a | GLOW, GREEN_L = 0x35e06a | GLOW;
const glass = (j, k, hi) => (mod(k + j, 11) === 0 && j >= hi - 2 ? SHINE : j >= hi ? GLASS2 : GLASS);

// A hull as a shell of cubes. halfAt(k, j): half the beam in cubes at that station and height; deckAt(k), keelAt(k): the
// top and bottom cube. paint(i, j, k, where): where is 'side', 'deck' or 'bottom'. Without `bottom` the plating below
// `cut` is left off (a barge never shows it).
function hull(g, { k0, k1, halfAt, deckAt, keelAt, paint, bottom = true, cut = -2 }) {
  const inside = (i, j, k) => k >= k0 && k <= k1 && j <= deckAt(k) && j >= keelAt(k) && half(i) < halfAt(k, j);
  for (let k = k0; k <= k1; k++) {
    const d = deckAt(k), kl = keelAt(k), wm = halfAt(k, d) + 1;
    for (let j = kl; j <= d; j++) for (let i = -wm; i < wm; i++) {
      if (!inside(i, j, k)) continue;
      const side = !inside(i - 1, j, k) || !inside(i + 1, j, k) || !inside(i, j, k - 1) || !inside(i, j, k + 1), under = !inside(i, j - 1, k);
      if (side) g.set(i, j, k, paint(i, j, k, 'side'));
      else if (j === d) g.set(i, j, k, paint(i, j, k, 'deck'));
      else if (under) { if (bottom || j >= cut) g.set(i, j, k, paint(i, j, k, 'bottom')); }
      // where the plating steps in or up, back it with one more cube, so the shell holds together face to face
      else if ((bottom || j >= cut) && !(inside(i - 1, j - 1, k) && inside(i + 1, j - 1, k) && inside(i, j - 1, k - 1) && inside(i, j - 1, k + 1) && inside(i - 1, j + 1, k) && inside(i + 1, j + 1, k) && inside(i, j + 1, k - 1) && inside(i, j + 1, k + 1) || j + 1 > d)) g.set(i, j, k, paint(i, j, k, 'bottom'));
    }
  }
  return inside;
}
// a tyre hung over the side as a fender: a ring in the fore-and-aft plane, on its rope
function tyre(g, i, j, k) {
  for (let dj = -2; dj <= 2; dj++) for (let dk = -2; dk <= 2; dk++) { const m = Math.max(ab(dj), ab(dk)); if (m === 2 && !(ab(dj) === 2 && ab(dk) === 2)) g.set(i, j + dj, k + dk, (dj + dk) & 1 ? 0x3d4046 : 0x2c2e33); }   // a shade lighter than the hull, so they show against it
  g.set(i, j + 3, k, ROPE2); g.set(i, j + 4, k, ROPE2);
}
// a pair of mooring posts with a bar across
function bitts(g, i0, j, k) { for (const i of [i0, i0 + 3]) bx(g, i, i, j, j + 3, k, k, HULL); bx(g, i0 - 1, i0 + 4, j + 2, j + 2, k, k, HULL); }

// =====================================================================================================================
// The tug: 120 cubes long (k = -60..59), 36 in the beam, drawing 10. A low working deck aft, a white deckhouse with the
// wheelhouse on top of it, a funnel in the owner's colour, a mast with a turning radar, tyres down both sides.
// =====================================================================================================================
export const TUG_PAINT = { red: 0xb8322a, blue: 0x2a5fae, green: 0x2f8257, yellow: 0xe0a61e };
const TUG = { k0: -60, k1: 59, B: 18, D: 10 };
const tugPlan = (k) => (k > 20 ? 1 - Math.pow((k - 20) / 40, 1.9) : k < -40 ? Math.sqrt(Math.max(0, 1 - Math.pow((-40 - k) / 21, 2))) : 1);
const tugDeck = (k) => 5 + (k > 0 ? rnd(5 * (k / 59) * (k / 59)) : 0) + (k < -52 ? 1 : 0);
const tugKeel = (k) => -TUG.D + (k > 40 ? rnd((TUG.D - 2) * Math.pow((k - 40) / 19, 2)) : k < -44 ? rnd((TUG.D - 1) * Math.pow((-44 - k) / 16, 1.5)) : 0);
const tugHalf = (k, j) => Math.max(1, rnd(TUG.B * tugPlan(k) * (j >= 0 ? 1 : 1 - 0.45 * Math.pow(-j / TUG.D, 1.5))));

function tugParts(o) {
  const seed = o.seed || 0, trim = TUG_PAINT[o.paint] ?? TUG_PAINT.red, { k0, k1 } = TUG;
  const parts = [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-22, -11, k0 - 3, 22, 62, k1 + 4], paint: (g) => {
      const set = (i, j, k, c) => g.set(i, j, k, c);
      // ---- hull: red below the water, a white line at it, black above, a band in the owner's colour under the deck ----
      hull(g, { k0, k1, halfAt: tugHalf, deckAt: tugDeck, keelAt: tugKeel, paint: (i, j, k, where) => {
        if (where === 'deck') return tone(DECK, 0.9 + 0.2 * hash(i >> 1, 3, k >> 1, seed));
        if (j < -1) return tone(BOTTOM, 0.9 + 0.2 * hash(i, j >> 1, k >> 2, seed));
        if (j <= 0) return BOOT;
        const d = tugDeck(k); return j === d ? 0x3a2c22 : j === d - 2 ? trim : HULL;       // a rubbing strake at the deck edge
      } });
      // ---- bulwarks, with a wooden cap and freeing ports; higher round the bow ----
      for (let k = k0; k <= k1; k++) {
        const d = tugDeck(k), w = tugHalf(k, d), hi = k > 44 ? 4 : 3;
        for (let i = -w; i < w; i++) {
          const a = half(i), edge = a === w - 1 || a >= tugHalf(k + 1, d) || a >= tugHalf(k - 1, d) || k === k0 || k === k1; if (!edge) continue;
          for (let j = 1; j <= hi; j++) if (!(j === 1 && mod(k, 9) === 0 && k > -40 && k < 20)) set(i, d + j, k, j === hi ? WOOD : HULL);
        }
      }
      // ---- fenders: tyres along both sides and a rope pudding round the bow ----
      for (const s of SIDES) for (const k of [-34, -20, -6, 8, 22]) tyre(g, sx(s, tugHalf(k, 4)), 3, k);
      for (let k = 46; k <= k1 + 1; k++) for (let j = 6; j <= 12; j++) {
        const w = k <= k1 ? tugHalf(k, Math.min(j, tugDeck(k))) : 0, wn = k < k1 ? tugHalf(k + 1, Math.min(j, tugDeck(k + 1))) : 0;
        for (let i = -w - 1; i <= w; i++) { const a = half(i); if (a === w || (a >= wn && a < w + 1 && k >= k1 - 1)) set(i, j, k, (i + j + k) & 1 ? ROPE : ROPE2); }
      }
      // ---- the engine, down in the hull ----
      bx(g, -4, 3, -6, 3, -24, 0, (i, j, k) => ((k + j) & 1 ? ENGINE : ENGINE2)); bx(g, -3, 2, 4, 4, -22, -2, 0x3f6b4a);
      // ---- the deckhouse: white, a band in the owner's colour at its foot, portholes, a door each side ----
      const hk0 = -10, hk1 = 26, HW = 11;
      for (let k = hk0; k <= hk1; k++) for (let i = -HW; i < HW; i++) {
        const wall = half(i) === HW - 1 || k === hk0 || k === hk1;
        if (wall) for (let j = tugDeck(k) + 1; j <= 21; j++) {
          let c = j <= 7 ? trim : WHITE;
          if (half(i) === HW - 1 && (j === 15 || j === 16) && mod(k - hk0, 7) >= 3 && mod(k - hk0, 7) <= 4) c = glass(j, k, 16);   // portholes
          if (half(i) === HW - 1 && k >= -6 && k <= -3 && j >= 7 && j <= 18) c = j === 15 && (k === -5 || k === -4) ? GLASS : WOOD2;   // doors
          if (k === hk0 && half(i) <= 1 && j <= 18) c = WOOD2;
          set(i, j, k, c);
        }
      }
      for (const s of SIDES) for (let dj = 0; dj < 4; dj++) for (let dk = 0; dk < 4; dk++) { const ej = dj === 0 || dj === 3, ek = dk === 0 || dk === 3; if (ej !== ek) set(sx(s, HW), 10 + dj, 18 + dk, (dj === 0 && dk === 1) || (dj === 3 && dk === 2) || (dk === 0 && dj === 2) || (dk === 3 && dj === 1) ? WHITE : 0xe8501e); }   // life rings
      // the boat deck on top of it, with a rail round the after end
      bx(g, -HW - 1, HW, 22, 22, hk0 - 1, hk1 + 1, (i, j, k) => tone(DECK, 0.95 + 0.15 * hash(i >> 1, 5, k >> 1, seed)));
      for (let k = hk0 - 1; k <= 3; k++) for (let i = -HW - 1; i <= HW; i++) { const edge = half(i) === HW || k === hk0 - 1; if (!edge) continue; set(i, 25, k, RAIL); if (mod(k + i, 5) === 0 || (half(i) === HW && k === hk0 - 1)) { set(i, 23, k, RAIL); set(i, 24, k, RAIL); } }
      // ---- the wheelhouse: windows all round under a roof in the owner's colour ----
      const wk0 = 6, wk1 = 25, WW = 9;
      for (let k = wk0; k <= wk1; k++) for (let i = -WW; i < WW; i++) {
        const side = half(i) === WW - 1, end = k === wk0 || k === wk1; if (!side && !end) continue;
        for (let j = 23; j <= 36; j++) {
          const post = (side && end) || (side && mod(k - wk0, 5) === 0) || (end && (half(i) === 0 || half(i) === 4));
          let c = WHITE; if (j >= 29 && j <= 34 && !post) c = glass(j, side ? k : i + 20, 33);
          if (k === wk0 && half(i) <= 1 && j <= 34 && i >= 0) c = j >= 30 && j <= 32 ? GLASS : WOOD2;
          set(i, j, k, c);
        }
      }
      bx(g, -WW - 1, WW, 37, 37, wk0 - 1, wk1 + 2, tone(trim, 0.92)); bx(g, -WW, WW - 1, 38, 38, wk0, wk1, trim);
      bx(g, -7, 6, 23, 28, wk1 - 3, wk1 - 2, DASH); bx(g, -1, 0, 28, 30, wk1 - 4, wk1 - 4, WOOD); set(-1, 29, wk1 - 4, -1); set(0, 29, wk1 - 4, WOOD);   // console and wheel
      bx(g, -1, 0, 23, 26, 15, 16, 0x33363c); bx(g, -1, 0, 25, 30, 14, 14, 0x33363c);              // the skipper's chair
      // ---- the funnel: the owner's colour, a white band, a black top ----
      for (let j = 23; j <= 45; j++) { const r = j >= 34 ? -1 : 0; for (let k = -7; k <= 0; k++) for (let i = -4; i <= 3; i++) {
        const a = half(i), end = k === -7 || k === 0, corner = a === 3 && end; if (corner) continue;
        const shell = a === 3 || end || (a === 2 && (k === -6 || k === -1)); if (!shell && j < 45) continue;
        set(i, j, k + r, j >= 42 ? BLACK : j >= 39 && j <= 40 ? WHITE : shell ? trim : 0x151618);
      } }
      // ---- on the wheelhouse roof: the mast, a searchlight, the radar's pedestal, an aerial ----
      bx(g, -1, 0, 39, 58, 11, 11, WHITE); bx(g, -5, 4, 50, 50, 11, 11, WHITE); bx(g, -1, 0, 56, 57, 12, 12, 0xcfcab8);
      for (const i of [-5, 4]) set(i, 49, 11, 0x6d7279);
      bx(g, -1, 0, 39, 40, 18, 19, 0x9a9fa6); bx(g, -2, 1, 39, 41, 24, 25, 0x9a9fa6); bx(g, -1, 0, 40, 40, 26, 26, 0xdedbd0);
      bx(g, 5, 5, 39, 50, 8, 8, 0x55595f);
      for (const s of SIDES) { set(sx(s, WW), 38, 20, s > 0 ? 0x8a1f1a : 0x1f6a38); set(sx(s, WW), 38, 21, 0x2a2c30); }   // side lights: red to port, green to starboard
      // ---- the towing gear aft: a winch, the hook, bitts, a coil of line; bitts and a capstan forward ----
      for (const s of SIDES) bxs(g, s, 5, 5, 6, 12, -26, -17, 0x3f6b4a);
      for (let k = -25; k <= -18; k++) for (let j = 6; j <= 11; j++) { const dj = j - 8.5, dk = k + 21.5; if (dj * dj + dk * dk < 13) bx(g, -5, 4, j, j, k, k, (i) => (i & 1 ? STEEL : 0x63676d)); }
      bx(g, -1, 0, 6, 9, -31, -30, HULL); bx(g, -1, 0, 9, 9, -33, -32, STEEL);
      bitts(g, -2, 6, -46); bitts(g, -2, tugDeck(40) + 1, 40);
      for (let dk = -2; dk <= 2; dk++) for (let di = -2; di <= 2; di++) { const m = Math.max(ab(di), ab(dk)); if (m >= 1 && !(ab(di) === 2 && ab(dk) === 2)) set(10 + di, 6, -36 + dk, m === 2 ? ROPE : ROPE2); }
      bx(g, -1, 0, tugDeck(47) + 1, tugDeck(47) + 4, 47, 48, STEEL); bx(g, -2, 1, tugDeck(47) + 5, tugDeck(47) + 5, 46, 49, 0x55595f);
      // ---- a staff at the stern with the owner's flag ----
      bx(g, 0, 0, 7, 20, -57, -57, WHITE); bx(g, 0, 0, 16, 19, -62, -58, (i, j, k) => (j === 17 || j === 18 ? WHITE : trim));
    } },
    // ---- the radar: a bar that turns on its pedestal ----
    { name: 'radar', parent: 'body', pivot: [0, 41, 19], box: [-5, 0, -1, 5, 2, 1], paint: (g) => { bx(g, -5, 4, 0, 1, -1, 0, 0xe9e6dc); bx(g, -5, 4, 0, 0, -1, -1, 0x9a9fa6); } },
    lamp('nvM', cubes(-1, 0, 56, 57, 12), WHITE_L), lamp('nvP', cubes(9, 9, 38, 38, 20), RED_L), lamp('nvS', cubes(-10, -10, 38, 38, 20), GREEN_L), lamp('slF', cubes(-1, 0, 40, 40, 26), WHITE_L),
  ];
  return parts;
}

// =====================================================================================================================
// The barge: 136 cubes long (k = -68..67), 40 in the beam. A steel box with raked ends, a coaming round the hold and a
// load in it: a heap of sand, gravel or coal, stacked crates, or four shipping containers (parts of their own, so they
// can slide off). `house: true` gives it a wheelhouse aft, as on a river barge.
// =====================================================================================================================
const BARGE = { k0: -68, k1: 67, B: 20, D: 5, deck: 6 };
const HEAP = { sand: [0xcdb27a, 0xbfa46c], gravel: [0x8d8f93, 0x7b7d82], coal: [0x1e1e22, 0x2a2a30] };
const BOXES = [0xb8322a, 0x2a5fae, 0x2f8257, 0xd9772b, 0xdedbd0, 0x7a4f9a];
const bargeHalf = (k) => { const e = Math.min(k - BARGE.k0, BARGE.k1 - k); return BARGE.B - (e < 2 ? 2 - e : 0); };
const bargeKeel = (k) => { const e = Math.min(k - BARGE.k0, BARGE.k1 - k); return -BARGE.D + (e < 10 ? rnd((10 - e) * 0.7) : 0); };

function container(name, i0, j0, k0, col, seed) {
  const W = 14, T = 16, L = 44, dk = tone(col, 0.8);
  return { name, parent: 'body', pivot: [i0, j0, k0], box: [0, 0, 0, W, T, L], paint: (g) => {
    for (let k = 0; k < L; k++) for (let j = 0; j < T; j++) for (let i = 0; i < W; i++) {
      const sideX = i === 0 || i === W - 1, endZ = k === 0 || k === L - 1, top = j === T - 1; if (!sideX && !endZ && !top) continue;
      const frame = (sideX && endZ) || (top && (sideX || endZ)) || (j === 0 && (sideX || endZ));
      let c = frame ? dk : sideX ? ((k >> 1) & 1 ? col : tone(col, 0.9)) : endZ ? ((i >> 1) & 1 ? col : tone(col, 0.9)) : (k >> 1) & 1 ? tone(col, 1.06) : tone(col, 0.97);
      if (k === L - 1 && !frame && (i === 7 || i === 3 || i === 10)) c = i === 7 ? dk : j === 5 || j === 6 ? CHROME : tone(col, 0.72);   // the doors
      if (sideX && j >= 9 && j <= 11 && k >= 14 && k <= 29 && mod(k + seed, 4) !== 0) c = 0xf1efe8;                    // the owner's name
      g.set(i, j, k, c);
    }
  } };
}

function bargeParts(o) {
  const seed = o.seed || 0, load = o.load || 'sand', house = !!o.house, { k0, k1, B, deck } = BARGE;
  const h0 = house ? -44 : -56, h1 = 56, HB = 16;                                                 // the hold
  const parts = [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-23, -6, k0 - 2, 23, 40, k1 + 3], paint: (g) => {
      const set = (i, j, k, c) => g.set(i, j, k, c);
      hull(g, { k0, k1, halfAt: bargeHalf, deckAt: () => deck, keelAt: bargeKeel, bottom: false, paint: (i, j, k, where) => {
        const n = hash(i >> 1, j, k >> 2, seed);
        if (where === 'deck') return half(i) >= HB && k % 8 === 0 ? 0x4a4d52 : tone(0x5a5d62, 0.9 + 0.2 * n);
        if (j < -1) return tone(BOTTOM, 0.9 + 0.2 * n);
        if (j <= 0) return n < 0.22 ? tone(RUST, 0.7) : 0x1b1d21;
        const run = hash(k + i, 9, 3, seed);                                                // rust runs down from the deck edge in thin streaks
        return run < 0.13 && j >= deck - 1 - fl(hash(k + i, 4, 1, seed) * 5) ? tone(RUST, 0.62 + 0.3 * hash(i, j, k, seed)) : j === deck ? 0x2e3136 : HULL;
      } });
      // the hold is open: take the deck out over it, put a coaming round it
      for (let k = h0; k <= h1; k++) for (let i = -HB; i < HB; i++) { const edge = half(i) === HB - 1 || k === h0 || k === h1; set(i, deck, k, -1); if (edge) for (let j = deck - 1; j <= deck + 3; j++) set(i, j, k, j === deck + 3 ? 0xd9a520 : 0x3a3d42); }
      // draught marks, bitts at the corners, tyres
      for (const s of SIDES) for (const k of [k0 + 6, k1 - 6]) for (const j of [1, 3, 5]) set(sx(s, B - 1), j, k, BOOT);
      for (const s of SIDES) for (const k of [k0 + 4, k1 - 7]) { bxs(g, s, 17, 17, deck + 1, deck + 3, k, k, HULL); bxs(g, s, 17, 17, deck + 1, deck + 3, k + 3, k + 3, HULL); bxs(g, s, 17, 17, deck + 3, deck + 3, k - 1, k + 4, HULL); }
      for (const s of SIDES) for (const k of [-40, 0, 40]) tyre(g, sx(s, B), 3, k);
      // ---- the load ----
      if (HEAP[load]) {
        const [c1, c2] = HEAP[load], hgt = (i, k) => {
          const ax = 1 - Math.pow((ab(i + 0.5)) / HB, 2), z = (k - h0) / (h1 - h0), along = 0.55 + 0.45 * ab(S(z * PI * 3 + seed)), end = Math.min(1, Math.min(k - h0, h1 - k) / 6);
          return deck + 1 + rnd(9 * ax * along * end + 1.2 * hash(i >> 1, 2, k >> 1, seed));
        };
        for (let k = h0 + 1; k <= h1 - 1; k++) for (let i = -HB + 1; i < HB - 1; i++) {
          const t = hgt(i, k), lo = Math.min(t, hgt(i - 1, k), hgt(i + 1, k), hgt(i, k - 1), hgt(i, k + 1));
          for (let j = Math.max(deck - 1, lo); j <= t; j++) set(i, j, k, hash(i, j, k, seed) < (load === 'coal' ? 0.06 : 0.3) ? (load === 'coal' ? 0x4a4c55 : c2) : tone(c1, 0.9 + 0.2 * hash(i >> 1, j, k >> 1, seed + 3)));
        }
      } else {
        bx(g, -HB + 1, HB - 2, deck - 1, deck - 1, h0 + 1, h1 - 1, (i, j, k) => (mod(k, 6) === 0 ? WOOD2 : WOOD));   // the floor of the hold
        if (load === 'crates') {
          for (let k = h0 + 3; k + 9 <= h1 - 2; k += 11) for (let i = -HB + 2; i + 9 <= HB - 2; i += 10) {
            const r = hash(i, 4, k, seed), tall = r < 0.35 ? 2 : r < 0.85 ? 1 : 0, tarp = r > 0.6 && r < 0.72;
            for (let n = 0; n < tall; n++) { const j0 = deck + n * 9; for (let a = 0; a < 9; a++) for (let b = 0; b < 9; b++) for (let c = 0; c < 9; c++) {
              const fa = a === 0 || a === 8, fb = b === 0 || b === 8, fc = c === 0 || c === 8; if (!fa && !fb && !fc) continue;
              const frame = (fa ? 1 : 0) + (fb ? 1 : 0) + (fc ? 1 : 0) >= 2;
              set(i + a, j0 + b, k + c, tarp ? ((a + c) % 5 === 0 ? 0x2a5fae : 0x3a78c8) : frame ? WOOD2 : (a + b + c) % 4 === 0 ? tone(WOOD, 0.92) : tone(WOOD, 1.08));
            } }
          }
        }
      }
      // ---- a wheelhouse aft ----
      if (house) {
        const a0 = k0 + 4, a1 = k0 + 19, HW = 12, roof = TUG_PAINT[o.paint] ?? 0x2f8257;
        for (let k = a0; k <= a1; k++) for (let i = -HW; i < HW; i++) {
          const side = half(i) === HW - 1, end = k === a0 || k === a1; if (!side && !end) continue;
          for (let j = deck + 1; j <= deck + 14; j++) {
            const post = (side && end) || (side && mod(k - a0, 5) === 0) || (end && mod(half(i), 6) === 0);
            let c = WHITE; if (j >= deck + 8 && j <= deck + 12 && !post) c = glass(j, side ? k : i + 30, deck + 11);
            if (k === a1 && half(i) <= 1 && i >= 0 && j <= deck + 12) c = WOOD2;
            set(i, j, k, c);
          }
        }
        bx(g, -HW - 1, HW, deck + 15, deck + 15, a0 - 1, a1 + 2, roof); bx(g, -1, 0, deck + 16, deck + 22, a0 + 4, a0 + 4, BLACK); bx(g, -6, 5, deck + 1, deck + 6, a1 - 3, a1 - 2, DASH);
        bx(g, 4, 4, deck + 16, deck + 26, a0 + 10, a0 + 10, WHITE); bx(g, 4, 4, deck + 23, deck + 25, a0 + 5, a0 + 9, (i, j) => (j === deck + 24 ? WHITE : roof));
      }
    } },
  ];
  if (load === 'containers') {
    const cols = [0, 1, 2, 3, 4].map((n) => BOXES[mod(seed * 3 + n * 5 + (n >> 1), BOXES.length)]), j0 = deck, ka = house ? -42 : -47;
    parts.push(container('c1', 1, j0, ka, cols[0], seed), container('c2', -15, j0, ka, cols[1], seed + 1), container('c3', 1, j0, ka + 48, cols[2], seed + 2), container('c4', -15, j0, ka + 48, cols[3], seed + 3));
    if (seed % 2 === 0) parts.push(container('c5', -7, j0 + 16, ka + 22, cols[4], seed + 4));
  }
  return parts;
}

// =====================================================================================================================
// Clips
// =====================================================================================================================
const ON = [0, 0, 0, 0, 0, 0, 1.15], OFF = [0, 0, 0, 0, 0, 0, 0];
const NAV = ['nvM', 'nvP', 'nvS', 'slF'], lit = (v) => Object.fromEntries(NAV.map((n) => [n, v]));
// riding the water: heave, a slow roll and a little pitch. k: how lively.
const bob = (t, u, k = 1) => [0.012 * k * S(t * 0.9 + u.phase), 0, 0.022 * k * S(t * 0.7 + u.phase * 1.3), 0, 0.16 * k * S(t * 1.1 + u.phase), 0];
const add = (a, b) => a.map((v, n) => v + (b[n] || 0));
// The side that goes down when it lists or rolls over: 1 port, -1 starboard. Give `low` in the unit's options for a boat
// lying against a quay (the side away from it); otherwise it is one or the other by chance.
export const lowSide = (u) => u.opts.low || -sideOf(u);

// cfg.sink: how far it settles, in town voxels. cfg.turtle: how deep it rides upside down (leave out if it cannot).
function boatClips(cfg) {
  // being stepped on: it is driven under and bobs back, whatever state it is in
  const dunk = (u) => { let d = 0; for (const c of u.crushes || []) { const dt = u.t - c[2]; if (dt >= 0 && dt < 4) d += 1.7 * Math.exp(-2.2 * dt) * C(dt * 5); } return d; };
  // stepped on while afloat: it floods and goes down by the end that was flattened, or lists if it was hit amidships
  const stomped = (u) => {
    const cr = u.crushes || [], n = cr.length; if (!n) return [0, 0, 0, 0, 0, 0];
    let lean = 0, tip = 0, down = 0.8;
    for (const [, fz, t0] of cr) { const a = ease(clamp((u.t - t0) / 6)), amid = ab(fz) < cfg.len * 0.16; down += (amid ? 3 : 1.6) * a; if (amid) lean += 0.12 * a; else tip += (fz > 0 ? 1 : -1) * 0.075 * a; }   // a hit amidships floods it fastest
    const sd = -lowSide(u);
    return [clamp(tip, -0.16, 0.16), 0, sd * Math.min(0.3, lean), 0, -dunk(u) - Math.min(cfg.sink, down), 0];
  };
  const clips = {
    Moored: { loop: true, speed: 0, pose: (t, u) => ({ body: bob(t, u, cfg.lively), ...lit(OFF), radar: [0, 0.6, 0] }) },
    'Under way': { loop: true, speed: cfg.speed, pose: (t, u) => ({ body: add(bob(t * 1.6, u, cfg.lively * 1.3), [-0.02, 0, 0, 0, 0.1, 0]), ...lit(ON), radar: [0, t * 2.6, 0] }) },
    // Blown up: it jumps, then floods and settles on the harbor bottom with a list, down by one end, the houses and the
    // mast still out of the water. Anything loose on deck slides off the low side.
    WreckSink: { loop: false, hidden: true, dur: 12, speed: 0, pose: (t, u) => {
      const sd = -lowSide(u), end = (u.opts.seed || 0) % 2 ? 1 : -1, a = ease(clamp((t - 0.3) / 6.5)), jolt = 1.1 * Math.exp(-3 * t) * S(Math.min(t * 9, PI)), calm = 1 - a;
      const P = { body: add(bob(u.t, u, 0.6 * calm), [end * cfg.trim * a, 0.05 * sd * a, sd * cfg.list * a, 0, jolt - cfg.sink * a - dunk(u), 0]), ...lit(OFF), radar: [0, 0.6 + 2 * Math.min(t, 1.5), 0.2 * a] };
      // The boxes go over the low side one after another and are left floating, low in the water. Each is steered in the
      // harbor's own frame (where it floats) and brought back into the listing hull's, which is what a pose is in.
      const th = sd * cfg.list * a, drop = cfg.sink * a, low = -sd, ct = C(th), st = S(th);
      for (let n = 1; n <= 5 && u.rest['c' + n]; n++) {
        const r = u.rest['c' + n].pos, b = clamp((t - 1.2 - n * 0.55) / 2.6), e = b * b * (3 - 2 * b), wob = u.t * 1.2 + n * 2.1;
        const sx0 = r[0] * ct - r[1] * st, sy0 = r[0] * st + r[1] * ct - drop;                    // where it rides while it is still aboard
        const ex = low * [14, 23.5, 15, 25, 35][n - 1] + (low > 0 ? -7 : 0), ey = -5.4 - (n & 1) + 0.18 * S(wob), roll = low * (0.2 + 0.11 * n) + 0.05 * S(wob * 0.8);
        const wx = sx0 + (ex - sx0) * e, wy = sy0 + (ey - sy0) * e + 3.2 * S(PI * clamp(b * 1.7)) * (1 - e), dy = wy + drop;
        P['c' + n] = [0.07 * e * S(wob * 0.7), (n & 1 ? 0.3 : -0.22) * e, (roll - th) * e, wx * ct + dy * st - r[0], -wx * st + dy * ct - r[1], [-3, -4.5, 3, 4.5, 0][n - 1] * e];
      }
      return P;
    } },
    Crushed: { loop: false, hidden: true, dur: 0.3, speed: 0, pose: (t, u) => ({ body: add(bob(u.t, u, 0.4), stomped(u)), ...lit(OFF), radar: [0, 0.6, 0] }) },
  };
  // Blown up and rolled right over: it floats bottom up, a little down by the head. Each stomp pushes it further under.
  if (cfg.turtle) clips.WreckTurtle = { loop: false, hidden: true, dur: 12, speed: 0, pose: (t, u) => {
    const sd = -lowSide(u), a = clamp(t / 4.2), roll = PI * 0.955 * (a * a * (3 - 2 * a)), jolt = 1.1 * Math.exp(-3 * t) * S(Math.min(t * 9, PI)), late = ease(clamp((t - 4) / 6));
    let under = 0; for (const c of u.crushes || []) under += 1.1 * ease(clamp((u.t - c[2]) / 5));
    return { body: add(bob(u.t, u, 0.5), [0.05 * late, 0, sd * roll, -sd * 1.5 * S(roll), jolt - cfg.turtle * ease(a) + 1.2 * S(roll) - dunk(u) - under, 0]), ...lit(OFF), radar: [0, 0.6, 0] };
  } };
  return clips;
}

const keep = (d, n) => { const k = 0.15 + 0.85 * ease(clamp((d - 13) / 16)); return k > 0.97 ? 1 : k + 0.06 * (n - 0.5); };
// adrift: parts left floating by a wreck (a stomp on the wreck does not touch them).
// base: a stomp flattens what is above the water and leaves the hull under it alone (upright: from the waterline;
// bottom up: from where the upturned hull meets the water)
const boatWk = (o) => ({ boat: true, adrift: /^c\d/, R: 24, soot: 38, max: 900, push: 26, mottle: 0.2, lamps: /^(nv|sl)/, loose: /^(nv|sl|radar)/, fireTop: 99, fireMin: 3, spread: 18, keep, dx: 0.35, recrush: true, crushedWreck: null, base: (sg) => (sg > 0 ? 0 : -6), boom: 7, fires: 26, ...o });
const onKill = (u, point, r, debris) => { blowUp(u, debris, point); };

export const TUGBOAT = {
  kind: 'boat', h: H, parts: tugParts, start: 'Moored', dieAt: 0.08, inner: INNER, onKill,
  clips: boatClips({ len: 120, speed: 10, lively: 1, sink: 6.5, trim: -0.13, list: 0.3, turtle: 2.4 }),
  // the blast comes up out of the engine room, at the after end of the deckhouse
  wk: boatWk({ beam: 9, wrecks: ['WreckSink', 'WreckTurtle'], seat: () => [0, 9, -14] }),
};
export const BARGE_BOAT = {
  kind: 'boat', h: H, parts: bargeParts, start: 'Moored', dieAt: 0.08, inner: INNER, onKill,
  clips: boatClips({ len: 136, speed: 6, lively: 0.55, sink: 2.9, trim: 0.035, list: 0.2 }),
  // the blast starts amidships, in the hold
  wk: boatWk({ beam: 10, wrecks: ['WreckSink'], seat: (u) => [0, 6, (u.opts.seed || 0) % 2 ? 18 : -14] }),
};
