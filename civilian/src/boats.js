// Working boats, built in code at eighth-metre cubes on the same kit as the cars and buses: a harbor tug (15 m), a
// barge (17 m) with a choice of loads, with or without a wheelhouse aft, a sightseeing tour boat (20 m) and a
// double-ended harbor ferry (22 m).
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
// `cut` is left off (a barge never shows it); with `skirt: false` the sides below it are left off as well.
function hull(g, { k0, k1, halfAt, deckAt, keelAt, paint, bottom = true, cut = -2, skirt = true }) {
  const inside = (i, j, k) => k >= k0 && k <= k1 && j <= deckAt(k) && j >= keelAt(k) && half(i) < halfAt(k, j);
  for (let k = k0; k <= k1; k++) {
    const d = deckAt(k), kl = keelAt(k), wm = halfAt(k, d) + 1;
    for (let j = skirt ? kl : Math.max(kl, cut); j <= d; j++) for (let i = -wm; i < wm; i++) {
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
// The tour boat: 160 cubes long (k = -80..79), 40 in the beam. A long, low sightseeing boat: an open foredeck, a small
// wheelhouse, a saloon glazed along both sides and over the top with rows of seats inside, an open after deck under a
// striped awning, a string of lamps along the roof that light under way.
// =====================================================================================================================
export const TOUR_PAINT = { blue: 0x2a5fae, red: 0xb8322a, green: 0x2f8257 };
const TOUR = { k0: -80, k1: 79, B: 20, D: 5 };
const TEAK = 0xb08a58, TEAK2 = 0x9a7646;
const tourPlan = (k) => (k > 40 ? 1 - Math.pow((k - 40) / 40, 2.3) : k < -70 ? 0.8 + 0.2 * Math.sqrt(Math.max(0, 1 - Math.pow((-70 - k) / 10, 2))) : 1);
const tourDeck = (k) => 4 + (k > 50 ? rnd(3 * Math.pow((k - 50) / 29, 2)) : 0);
const tourKeel = (k) => -TOUR.D + (k > 56 ? rnd(4 * Math.pow((k - 56) / 23, 2)) : k < -66 ? rnd(3 * (-66 - k) / 14) : 0);
const tourHalf = (k, j) => Math.max(1, rnd(TOUR.B * tourPlan(k) * (j >= 0 ? 1 : 1 - 0.4 * Math.pow(-j / TOUR.D, 1.5))));
// a life ring on a wall that faces sideways
function lifeRing(g, i, j, k) { for (let dj = 0; dj < 4; dj++) for (let dk = 0; dk < 4; dk++) { const ej = dj === 0 || dj === 3, ek = dk === 0 || dk === 3; if (ej !== ek) g.set(i, j + dj, k + dk, (dj === 0 && dk === 1) || (dj === 3 && dk === 2) || (dk === 0 && dj === 2) || (dk === 3 && dj === 1) ? WHITE : 0xe8501e); } }
// four walls, no floor or roof; c may be a function (i, j, k)
function shell(g, i0, i1, j0, j1, k0, k1, c) { for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) if (i === i0 || i === i1 || k === k0 || k === k1) for (let j = j0; j <= j1; j++) g.set(i, j, k, c); }
// an open rail round the edge of a deck between two stations: posts, a middle rail and a wooden top rail
function rails(g, halfAt, deckAt, ka, kb, K0, K1) {
  for (let k = ka; k <= kb; k++) {
    const d = deckAt(k), w = halfAt(k, d), wn = Math.min(k < K1 ? halfAt(k + 1, d) : w, k > K0 ? halfAt(k - 1, d) : w), ds = [d];
    for (const q of [k - 1, k + 1]) if (q >= K0 && q <= K1 && deckAt(q) !== d) ds.push(deckAt(q));   // where the deck steps, the rail is carried up the step
    for (let i = -w; i < w; i++) {
      const a = half(i), side = a === w - 1, end = a >= wn - 1 || k === K0 || k === K1; if (!side && !end) continue;   // and where the side steps in, across it
      for (const dd of ds) { g.set(i, dd + 7, k, WOOD); g.set(i, dd + 4, k, RAIL); }
      if (side ? mod(k, 4) === 0 : mod(i, 4) === 0) for (let j = d + 1; j <= d + 6; j++) g.set(i, j, k, RAIL);
    }
  }
}

function tourParts(o) {
  const seed = o.seed || 0, trim = TOUR_PAINT[o.paint] ?? TOUR_PAINT.blue, { k0, k1 } = TOUR, s0 = -50, s1 = 37, seatC = tone(trim, 0.9), CARPET = tone(trim, 0.5);
  const roofAt = (a) => (a <= 14 ? 20 : a <= 16 ? 19 : 18);   // the saloon's glass roof, curving down to the walls
  const bulbs = []; for (const s of SIDES) for (let k = s0 + 2; k <= s1 - 2; k += 4) bulbs.push([sx(s, 18), 17, k]);
  return [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-22, -6, k0 - 5, 22, 36, k1 + 2], paint: (g) => {
      const set = (i, j, k, c) => g.set(i, j, k, c);
      // ---- hull: white, a line in the owner's colour at the water and at the deck edge; a teak deck, carpet in the saloon ----
      hull(g, { k0, k1, halfAt: tourHalf, deckAt: tourDeck, keelAt: tourKeel, paint: (i, j, k, where) => {
        if (where === 'deck') return k >= s0 && k <= s1 && half(i) < 17 ? tone(CARPET, 0.92 + 0.16 * hash(i >> 1, 1, k >> 1, seed)) : tone(mod(i, 4) === 0 ? TEAK2 : TEAK, 0.94 + 0.12 * hash(i, 2, k >> 2, seed));
        if (j < -1) return tone(BOTTOM, 0.9 + 0.2 * hash(i, j >> 1, k >> 2, seed));
        return j <= 0 || j === tourDeck(k) ? trim : WHITE;
      } });
      // ---- rails round the open decks fore and aft, a toe rail beside the saloon ----
      rails(g, tourHalf, tourDeck, s1 + 1, k1, k0, k1); rails(g, tourHalf, tourDeck, k0, s0 - 1, k0, k1);
      for (let k = s0; k <= s1; k++) for (const s of SIDES) set(sx(s, 19), 5, k, WHITE);
      // ---- the saloon: low white walls, tall panes, a glass roof on white frames with a spine down the middle ----
      for (let k = s0; k <= s1; k++) {
        const endW = k === s0 || k === s1, post = mod(k - s0, 8) === 0 || k === s1;
        for (let i = -18; i <= 17; i++) {
          const a = half(i), pk = mod(k - s0, 8), rg = (j) => (post || (j === 20 && a <= 1) ? WHITE : j === 20 && a >= 6 && a <= 8 && pk - 2 === a - 6 ? SHINE : GLASS2);   // one short glint a pane
          if (a <= 14) set(i, 20, k, rg(20)); if (a >= 14 && a <= 16) set(i, 19, k, rg(19)); if (a >= 16) set(i, 18, k, rg(18));
          if (a === 17) for (let j = 5; j <= 17; j++) set(i, j, k, j === 5 ? trim : j <= 8 || j === 17 || post ? WHITE : glass(j, k, 15));
          else if (endW) for (let j = 5; j < roofAt(a); j++) {
            let c = j >= 9 && j <= 16 && a >= 5 && a <= 15 && a !== 10 ? glass(j, i + 30, 15) : WHITE;
            if (a <= 2 && j <= 15) c = k === s0 ? (a === 2 || j === 15 ? WOOD2 : j >= 8 ? GLASS : WOOD) : a <= 1 && j <= 14 ? WOOD2 : c;   // glazed doors to the after deck, a plain one forward
            set(i, j, k, c);
          }
        }
      }
      // rows of seats in pairs, an aisle down the middle
      for (let k = s0 + 5; k <= s1 - 8; k += 6) for (const s of SIDES) {
        bxs(g, s, 4, 15, 5, 6, k + 1, k + 2, 0x44474c); bxs(g, s, 4, 15, 7, 7, k + 1, k + 3, seatC); bxs(g, s, 4, 15, 5, 12, k, k, tone(seatC, 0.82));
        bxs(g, s, 9, 10, 7, 12, k, k + 3, -1);
      }
      for (const s of SIDES) for (const k of [-32, 16]) lifeRing(g, sx(s, 18), 5, k);
      // ---- the wheelhouse, ahead of the saloon and a little higher, so the skipper sees over it ----
      const w0 = 38, w1 = 50, WW = 11;
      for (let k = w0; k <= w1; k++) for (let i = -WW - 1; i <= WW; i++) {
        const a = half(i), side = a === WW, end = k === w0 || k === w1; if (!side && !end) continue;
        for (let j = 5; j <= 24; j++) {
          const post = (side && end) || (side && mod(k - w0, 4) === 0) || (end && mod(a, 6) === 5);
          let c = j <= 6 ? trim : WHITE;
          if (j >= 15 && j <= 21 && !post && (k !== w0 || j >= 22)) c = glass(j, side ? k : i + 20, 20);
          if (side && k >= 40 && k <= 43 && j <= 14) c = WOOD2;
          set(i, j, k, c);
        }
      }
      bx(g, -WW - 2, WW + 1, 25, 25, w0 - 1, w1 + 2, (i, j, k) => (half(i) === WW + 1 || k === w0 - 1 || k === w1 + 2 ? trim : WHITE));
      bx(g, -8, 7, 5, 14, 48, 49, DASH); bx(g, -1, 0, 13, 15, 47, 47, WOOD); set(-1, 14, 47, -1); bx(g, -1, 0, 5, 9, 42, 43, 0x33363c); bx(g, -1, 0, 8, 13, 41, 41, 0x33363c);
      // on its roof: a mast with a yard, the radar's pedestal, a searchlight, side lights, a horn
      bx(g, 0, 0, 26, 32, 44, 44, WHITE); set(0, 33, 44, 0xcfcab8); bx(g, -3, 2, 30, 30, 44, 44, WHITE);
      bx(g, -1, 0, 26, 27, 40, 41, 0x9a9fa6); bx(g, -1, 0, 26, 27, 49, 50, 0x9a9fa6); bx(g, -1, 0, 27, 27, 51, 51, 0xdedbd0); bx(g, 5, 6, 26, 26, 48, 51, CHROME);
      for (const s of SIDES) { set(sx(s, 11), 26, 46, s > 0 ? 0x8a1f1a : 0x1f6a38); set(sx(s, 11), 26, 45, 0x2a2c30); }
      // ---- the foredeck: two benches, bitts, a windlass, a staff with a pennant ----
      for (const k of [53, 57]) { bx(g, -9, 8, 7, 7, k, k + 1, TEAK2); for (const i of [-9, -1, 8]) bx(g, i, i, 5, 6, k, k, 0x55595f); }
      bitts(g, -2, 5, 62); bx(g, -2, 1, 6, 8, 66, 69, STEEL); bx(g, -3, 2, 7, 7, 67, 68, 0x55595f);
      bx(g, 0, 0, 8, 17, 77, 77, WHITE); bx(g, 0, 0, 15, 17, 73, 76, trim);
      // ---- the after deck: benches down the sides and across the stern, under an awning in the owner's stripes ----
      for (const s of SIDES) { bxs(g, s, 13, 15, 7, 7, -72, -56, TEAK2); for (const k of [-72, -64, -56]) bxs(g, s, 14, 14, 5, 6, k, k, 0x55595f); for (const k of [-75, -54]) bxs(g, s, 15, 15, 5, 17, k, k, RAIL); }
      bx(g, -10, 9, 7, 7, -77, -76, TEAK2); for (const i of [-10, 9]) bx(g, i, i, 5, 6, -76, -76, 0x55595f);
      for (let k = -77; k <= -52; k++) for (let i = -17; i <= 16; i++) { const c = mod(i + 18, 6) < 3 ? trim : WHITE, rim = half(i) === 16 || k === -77 || k === -52; set(i, 18, k, c); if (rim && mod(i + k, 2) === 0) set(i, 17, k, c); }
      // the engine's stack on the saloon roof, a staff and flag at the stern, fenders over the sides
      bx(g, -3, 2, 21, 27, s0 + 3, s0 + 8, (i, j) => (j >= 26 ? BLACK : j === 23 || j === 24 ? trim : WHITE));
      bx(g, 0, 0, 5, 18, -79, -79, WHITE); bx(g, 0, 0, 14, 17, -84, -80, (i, j) => (j === 15 || j === 16 ? WHITE : trim));
      for (const s of SIDES) for (const k of [-58, -28, 2, 32]) { bxs(g, s, 20, 20, 1, 3, k, k, 0xf1efe8); bxs(g, s, 20, 20, 4, 4, k, k, trim); }
    } },
    { name: 'radar', parent: 'body', pivot: [0, 28, 41], box: [-4, 0, -1, 4, 2, 1], paint: (g) => { bx(g, -4, 3, 0, 1, -1, 0, 0xe9e6dc); bx(g, -4, 3, 0, 0, -1, -1, 0x9a9fa6); } },
    lamp('nvM', cubes(0, 0, 33, 33, 44), WHITE_L), lamp('nvP', cubes(11, 11, 26, 26, 46), RED_L), lamp('nvS', cubes(-12, -12, 26, 26, 46), GREEN_L),
    lamp('fest', bulbs, 0xffd27a | GLOW), lamp('festOff', bulbs, 0xd8d2b8),
  ];
}

// =====================================================================================================================
// The harbor ferry: 176 cubes long (k = -88..87), 56 in the beam, the same at both ends. A black hull with a rubber
// belt round it, an open apron and gate at each end, a main cabin with benches, an upper deck with a promenade and rail
// round a smaller cabin, and on top a wheelhouse at each end, the funnel between them and life rafts.
// =====================================================================================================================
export const FERRY_PAINT = { orange: 0xe07a1f, blue: 0x2d5fa3, green: 0x2f8257 };
const FRY = { k0: -88, k1: 87, B: 28, D: 7, deck: 5 };
const fEnd = (k) => Math.max(0, (ab(k + 0.5) - 58) / 30);
const ferryHalf = (k, j) => Math.max(1, rnd(FRY.B * (1 - 0.6 * fEnd(k) * fEnd(k)) * (j >= 0 ? 1 : 1 - 0.3 * Math.pow(-j / FRY.D, 1.5))));
const ferryKeel = (k) => -FRY.D + rnd(6 * fEnd(k) * fEnd(k));

function ferryParts(o) {
  const seed = o.seed || 0, paint = FERRY_PAINT[o.paint] ?? FERRY_PAINT.orange, dark = tone(paint, 0.72), { k0, k1, deck } = FRY;
  const c0 = -62, c1 = 61, MW = 25, U = 24, u0 = -44, u1 = 43, UW = 20, RF = 41, LINO = 0x7d8272, GREY = 0xcfd2d4, BENCH = 0x2f5d8a, LEG = 0x4a4d52;
  const deckC = (i, k, n) => tone(DECK, 0.9 + 0.2 * hash(i >> 1, n, k >> 1, seed)), lino = (i, k, n) => tone(LINO, 0.94 + 0.12 * hash(i >> 1, n, k >> 1, seed));
  return [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-31, -8, k0 - 2, 31, 68, k1 + 3], paint: (g) => {
      const set = (i, j, k, c) => g.set(i, j, k, c);
      hull(g, { k0, k1, halfAt: ferryHalf, deckAt: () => deck, keelAt: ferryKeel, bottom: false, skirt: false, cut: -3, paint: (i, j, k, where) => {
        if (where === 'deck') return k > c0 && k < c1 && half(i) < MW ? lino(i, k, 1) : ab(k + 0.5) > 80 && mod(i + k, 4) < 2 ? 0xd9a520 : deckC(i, k, 3);
        if (j < -1) return tone(BOTTOM, 0.9 + 0.2 * hash(i, j >> 1, k >> 2, seed));
        return j <= 0 ? BOOT : j === deck ? dark : HULL;
      } });
      for (const s of SIDES) for (const k of [-45, -15, 15, 45]) tyre(g, sx(s, 28), 2, k);
      // the rubber belt, standing one cube proud all the way round
      for (let k = k0 - 1; k <= k1 + 1; k++) { const w = k < k0 || k > k1 ? 0 : ferryHalf(k, 4), wn = Math.max(k - 1 >= k0 && k - 1 <= k1 ? ferryHalf(k - 1, 4) : 0, k + 1 >= k0 && k + 1 <= k1 ? ferryHalf(k + 1, 4) : 0); for (let i = -Math.max(w, wn) - 1; i <= Math.max(w, wn); i++) { const a = half(i); if (a >= w && a <= Math.max(w, wn - 1)) set(i, 4, k, 0x15161a); } }
      // ---- the aprons at each end: a bulwark in the owner's colour, a gate with a yellow bar, bitts ----
      for (let k = k0; k <= k1; k++) {
        if (k >= c0 && k <= c1) continue;
        const w = ferryHalf(k, deck);
        for (let i = -w; i < w; i++) {
          const a = half(i), side = a === w - 1, end = a >= ferryHalf(k + 1, deck) || a >= ferryHalf(k - 1, deck) || k === k0 || k === k1; if (!side && !end) continue;
          if ((k === k0 || k === k1) && a <= 7) { set(i, deck + 5, k, 0xd9a520); if (a === 7) for (let j = deck + 1; j <= deck + 4; j++) set(i, j, k, 0x55595f); continue; }
          for (let j = deck + 1; j <= deck + 6; j++) set(i, j, k, j === deck + 6 ? WHITE : paint);
        }
      }
      for (const e of [1, -1]) for (const i0 of [14, -18]) bitts(g, i0, deck + 1, e * 72);
      // ---- the main cabin: a dark skirt, a row of windows, a white band; a wide doorway at each end ----
      for (let k = c0; k <= c1; k++) for (let i = -MW - 1; i <= MW; i++) {
        const a = half(i), side = a === MW, end = k === c0 || k === c1; if (!side && !end) continue;
        if (end && a <= 8) { for (let j = 20; j < U; j++) set(i, j, k, j >= 22 ? WHITE : paint); continue; }
        for (let j = deck + 1; j < U; j++) {
          const post = side ? mod(k - c0, 8) < 2 || k >= c1 - 1 : a <= 10 || a >= 23 || mod(a, 6) === 4;
          set(i, j, k, j >= 22 ? WHITE : j >= 12 && j <= 19 && !post ? glass(j, side ? k : i + 40, 18) : j <= 7 ? dark : paint);
        }
      }
      // inside: the casing round the engine's uptake, and long benches back to back
      shell(g, -5, 4, deck + 1, U - 1, -10, 9, (i, j, k) => (k === 9 && half(i) <= 1 && j <= 19 ? WOOD2 : WHITE));
      for (const s of SIDES) for (const a0 of [8, 17]) for (const [ka, kb] of [[-54, -8], [8, 54]]) {
        bxs(g, s, a0, a0 + 2, 9, 9, ka, kb, BENCH); bxs(g, s, a0 + 1, a0 + 1, 10, 13, ka, kb, tone(BENCH, 0.8));
        for (let k = ka; k <= kb; k += 9) bxs(g, s, a0, a0 + 2, 6, 8, k, k, LEG);
      }
      // ---- the upper deck: over the whole cabin and a little more, a rail all round ----
      for (let k = c0 - 2; k <= c1 + 2; k++) for (let i = -27; i <= 26; i++) {
        const a = half(i), endK = k === c0 - 2 || k === c1 + 2, rim = a === 26 || endK;
        set(i, U, k, rim ? WHITE : k > u0 && k < u1 && a < UW ? lino(i, k, 5) : deckC(i, k, 7));
        if (rim) { set(i, U + 7, k, WOOD); set(i, U + 4, k, RAIL); if ((a === 26 && (endK || mod(k, 5) === 0)) || (endK && mod(i, 5) === 0)) for (let j = U + 1; j <= U + 6; j++) set(i, j, k, RAIL); }
      }
      // the upper cabin, with benches inside and along its walls outside
      for (let k = u0; k <= u1; k++) for (let i = -UW - 1; i <= UW; i++) {
        const a = half(i), side = a === UW, end = k === u0 || k === u1; if (!side && !end) continue;
        for (let j = U + 1; j < RF; j++) {
          const post = side ? mod(k - u0, 8) < 2 || k >= u1 - 1 : a >= 18 || a <= 4 || mod(a, 7) === 4;
          let c = j >= 38 ? WHITE : j >= 30 && j <= 36 && !post ? glass(j, side ? k : i + 40, 35) : paint;
          if (end && a <= 2 && j <= 37) c = j >= 31 && j <= 34 && a <= 1 ? GLASS : WOOD2;
          set(i, j, k, c);
        }
      }
      shell(g, -5, 4, U + 1, RF - 1, -10, 9, WHITE);
      for (let k = u0 + 6; k <= u1 - 8; k += 7) { if (ab(k) < 16) continue; for (const s of SIDES) { bxs(g, s, 7, 17, U + 4, U + 4, k, k + 2, BENCH); bxs(g, s, 7, 17, U + 5, U + 8, k, k, tone(BENCH, 0.8)); for (const a of [7, 17]) bxs(g, s, a, a, U + 1, U + 3, k + 1, k + 1, LEG); } }
      for (const s of SIDES) for (const [ka, kb] of [[-36, -8], [8, 36]]) { bxs(g, s, 21, 23, U + 4, U + 4, ka, kb, TEAK2); for (let k = ka; k <= kb; k += 14) bxs(g, s, 22, 22, U + 1, U + 3, k, k, LEG); }
      for (const s of SIDES) for (const k of [-30, 26]) lifeRing(g, sx(s, UW + 1), U + 1, k);
      // ---- the top: a wheelhouse at each end, the funnel between them, life rafts, vents ----
      for (let k = u0 - 2; k <= u1 + 2; k++) for (let i = -23; i <= 22; i++) set(i, RF, k, half(i) === 22 || k === u0 - 2 || k === u1 + 2 ? WHITE : tone(GREY, 0.94 + 0.1 * hash(i >> 1, 9, k >> 1, seed)));
      for (const e of [1, -1]) {
        const ka = e > 0 ? 28 : -43, kb = ka + 15, km = e > 0 ? kb - 4 : ka + 4;
        for (let k = ka; k <= kb; k++) for (let i = -9; i <= 8; i++) {
          const a = half(i), side = a === 8, end = k === ka || k === kb; if (!side && !end) continue;
          for (let j = RF + 1; j <= 54; j++) { const post = (side && end) || (side && mod(k - ka, 5) === 0) || (end && (a === 0 || a === 4)); set(i, j, k, j >= 47 && j <= 52 && !post ? glass(j, side ? k : i + 20, 51) : WHITE); }
        }
        bx(g, -10, 9, 55, 55, ka - 1, kb + 1, (i, j, k) => (half(i) === 9 || k === ka - 1 || k === kb + 1 ? WHITE : paint));
        bx(g, 0, 0, 56, 64, km, km, WHITE); set(0, 65, km, 0xcfcab8); bx(g, -3, 2, 61, 61, km, km, WHITE);
        bx(g, -6, 5, RF + 1, RF + 5, e > 0 ? kb - 3 : ka + 2, e > 0 ? kb - 2 : ka + 3, DASH);
      }
      for (const s of SIDES) { set(sx(s, 9), 56, 34, s > 0 ? 0x8a1f1a : 0x1f6a38); set(sx(s, 9), 56, 33, 0x2a2c30); }
      bx(g, -1, 0, 56, 57, 31, 32, 0x9a9fa6);
      for (let j = RF + 1; j <= 63; j++) for (let k = -7; k <= 6; k++) for (let i = -5; i <= 4; i++) {
        const a = half(i), ke = k <= -6 || k >= 5; if (a === 4 && (k === -7 || k === 6)) continue;
        if (!(a === 4 || k === -7 || k === 6 || (a === 3 && ke)) && j < 63) continue;
        set(i, j, k, j >= 59 ? BLACK : j === 55 || j === 56 ? WHITE : paint);
      }
      for (const s of SIDES) {
        for (const kk of [-24, 14]) bxs(g, s, 15, 18, RF + 1, RF + 3, kk, kk + 9, (i, j, k) => (k === kk + 4 || k === kk + 5 ? 0x33363c : WHITE));
        for (const k of [-17, 16]) { bxs(g, s, 9, 10, RF + 1, RF + 4, k, k + 1, WHITE); bxs(g, s, 8, 11, RF + 5, RF + 5, k - 1, k + 2, WHITE); }
      }
    } },
    { name: 'radar', parent: 'body', pivot: [0, 58, 32], box: [-5, 0, -1, 5, 2, 1], paint: (g) => { bx(g, -5, 4, 0, 1, -1, 0, 0xe9e6dc); bx(g, -5, 4, 0, 0, -1, -1, 0x9a9fa6); } },
    lamp('nvM', cubes(0, 0, 65, 65, 39), WHITE_L), lamp('nvA', cubes(0, 0, 65, 65, -39), WHITE_L), lamp('nvP', cubes(9, 9, 56, 56, 34), RED_L), lamp('nvS', cubes(-10, -10, 56, 56, 34), GREEN_L),
  ];
}

// =====================================================================================================================
// Clips
// =====================================================================================================================
const ON = [0, 0, 0, 0, 0, 0, 1.15], OFF = [0, 0, 0, 0, 0, 0, 0], SHOW = [0, 0, 0, 0, 0, 0, 1];
const NAV = ['nvM', 'nvP', 'nvS', 'slF', 'nvA'], lit = (v) => Object.fromEntries(NAV.map((n) => [n, v]));
// riding the water: heave, a slow roll and a little pitch. k: how lively.
const bob = (t, u, k = 1) => [0.012 * k * S(t * 0.9 + u.phase), 0, 0.022 * k * S(t * 0.7 + u.phase * 1.3), 0, 0.16 * k * S(t * 1.1 + u.phase), 0];
const add = (a, b) => a.map((v, n) => v + (b[n] || 0));
// The side that goes down when it lists or rolls over: 1 port, -1 starboard. Give `low` in the unit's options for a boat
// lying against a quay (the side away from it); otherwise it is one or the other by chance.
export const lowSide = (u) => u.opts.low || -sideOf(u);

// cfg.sink: how far it settles, in town voxels. cfg.turtle: how deep it rides upside down (leave out if it cannot).
function boatClips(cfg) {
  // cfg.lamps: more parts to show or hide, { on: {...}, off: {...} } (under way, and otherwise)
  const on = { ...lit(ON), ...(cfg.lamps ? cfg.lamps.on : null) }, off = { ...lit(OFF), ...(cfg.lamps ? cfg.lamps.off : null) };
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
    Moored: { loop: true, speed: 0, pose: (t, u) => ({ body: bob(t, u, cfg.lively), ...off, radar: [0, 0.6, 0] }) },
    'Under way': { loop: true, speed: cfg.speed, pose: (t, u) => ({ body: add(bob(t * 1.6, u, cfg.lively * 1.3), [-0.02, 0, 0, 0, 0.1, 0]), ...on, radar: [0, t * 2.6, 0] }) },
    // Blown up: it jumps, then floods and settles on the harbor bottom with a list, down by one end, the houses and the
    // mast still out of the water. Anything loose on deck slides off the low side.
    WreckSink: { loop: false, hidden: true, dur: 12, speed: 0, pose: (t, u) => {
      const sd = -lowSide(u), end = (u.opts.seed || 0) % 2 ? 1 : -1, a = ease(clamp((t - 0.3) / 6.5)), jolt = 1.1 * Math.exp(-3 * t) * S(Math.min(t * 9, PI)), calm = 1 - a;
      const P = { body: add(bob(u.t, u, 0.6 * calm), [end * cfg.trim * a, 0.05 * sd * a, sd * cfg.list * a, 0, jolt - cfg.sink * a - dunk(u), 0]), ...off, radar: [0, 0.6 + 2 * Math.min(t, 1.5), 0.2 * a] };
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
    Crushed: { loop: false, hidden: true, dur: 0.3, speed: 0, pose: (t, u) => ({ body: add(bob(u.t, u, 0.4), stomped(u)), ...off, radar: [0, 0.6, 0] }) },
  };
  // Blown up and rolled right over: it floats bottom up, a little down by the head. Each stomp pushes it further under.
  if (cfg.turtle) clips.WreckTurtle = { loop: false, hidden: true, dur: 12, speed: 0, pose: (t, u) => {
    const sd = -lowSide(u), a = clamp(t / 4.2), roll = PI * 0.955 * (a * a * (3 - 2 * a)), jolt = 1.1 * Math.exp(-3 * t) * S(Math.min(t * 9, PI)), late = ease(clamp((t - 4) / 6));
    let under = 0; for (const c of u.crushes || []) under += 1.1 * ease(clamp((u.t - c[2]) / 5));
    return { body: add(bob(u.t, u, 0.5), [0.05 * late, 0, sd * roll, -sd * 1.5 * S(roll), jolt - cfg.turtle * ease(a) + 1.2 * S(roll) - dunk(u) - under, 0]), ...off, radar: [0, 0.6, 0] };
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
export const TOUR_BOAT = {
  kind: 'boat', h: H, parts: tourParts, start: 'Moored', dieAt: 0.08, inner: INNER, onKill,
  clips: boatClips({ len: 160, speed: 9, lively: 0.8, sink: 4.6, trim: 0.05, list: 0.26, turtle: 1.4, lamps: { on: { fest: SHOW, festOff: OFF }, off: { fest: OFF, festOff: SHOW } } }),
  // the blast starts at the engine, under the after end of the saloon
  wk: boatWk({ beam: 10, wrecks: ['WreckSink', 'WreckTurtle'], seat: () => [0, 7, -40], R: 22, soot: 46, fireSize: 1.2, lamps: /^(nv|sl|fest$)/, loose: /^(nv|sl|radar|fest)/, base: (sg) => (sg > 0 ? 0 : -3) }),
};
export const FERRY = {
  kind: 'boat', h: H, parts: ferryParts, start: 'Moored', dieAt: 0.08, inner: INNER, onKill,
  clips: boatClips({ len: 176, speed: 8, lively: 0.45, sink: 5.6, trim: 0.03, list: 0.14 }),
  // the blast starts amidships on the main deck, at the foot of the funnel
  wk: boatWk({ beam: 14, wrecks: ['WreckSink'], seat: (u) => [0, 12, (u.opts.seed || 0) % 2 ? 14 : -14], R: 30, soot: 62, max: 1300, boom: 9, fires: 34, fireSize: 1.5, spread: 26 }),
};
