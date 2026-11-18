// Working boats, built in code at eighth-metre cubes on the same kit as the cars and buses: a harbor tug (15 m), a
// barge (17 m) with a choice of loads, with or without a wheelhouse aft, a sightseeing tour boat (20 m), a
// double-ended harbor ferry (22 m), an ocean liner (46 m) and an aircraft carrier (46 m) with four jets on deck (the jet itself is in jet.js).
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
import { jetStatic, jetBox, JET_TINT } from './jet.js';

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

// One shipping container, 14 by 16 by 44 cubes, painted at (oi, oj, ok). hide: 1 leaves off the +x wall, 2 the -x wall,
// 4 the top (where another box stands against it, so no hidden plating is drawn).
function crate(g, oi, oj, ok, col, seed, hide = 0) {
  const W = 14, T = 16, L = 44, dk = tone(col, 0.8);
  for (let k = 0; k < L; k++) for (let j = 0; j < T; j++) for (let i = 0; i < W; i++) {
    const sideX = i === 0 || i === W - 1, endZ = k === 0 || k === L - 1, top = j === T - 1;
    if (!((i === 0 && !(hide & 2)) || (i === W - 1 && !(hide & 1))) && !endZ && !(top && !(hide & 4))) continue;
    const frame = (sideX && endZ) || (top && (sideX || endZ)) || (j === 0 && (sideX || endZ));
    let c = frame ? dk : sideX ? ((k >> 1) & 1 ? col : tone(col, 0.9)) : endZ ? ((i >> 1) & 1 ? col : tone(col, 0.9)) : (k >> 1) & 1 ? tone(col, 1.06) : tone(col, 0.97);
    if (k === L - 1 && !frame && (i === 7 || i === 3 || i === 10)) c = i === 7 ? dk : j === 5 || j === 6 ? CHROME : tone(col, 0.72);   // the doors
    if (sideX && j >= 9 && j <= 11 && k >= 14 && k <= 29 && mod(k + seed, 4) !== 0) c = 0xf1efe8;                    // the owner's name
    g.set(oi + i, oj + j, ok + k, c);
  }
}
// a container as a part of its own, so it can slide off a sinking deck and float
const container = (name, i0, j0, k0, col, seed) => ({ name, parent: 'body', pivot: [i0, j0, k0], box: [0, 0, 0, 14, 16, 44], paint: (g) => crate(g, 0, 0, 0, col, seed) });

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
function rails(g, halfAt, deckAt, ka, kb, K0, K1, col = RAIL, cap = WOOD) {
  for (let k = ka; k <= kb; k++) {
    const d = deckAt(k), w = halfAt(k, d), wn = Math.min(k < K1 ? halfAt(k + 1, d) : w, k > K0 ? halfAt(k - 1, d) : w), ds = [d];
    for (const q of [k - 1, k + 1]) if (q >= K0 && q <= K1 && deckAt(q) !== d) ds.push(deckAt(q));   // where the deck steps, the rail is carried up the step
    for (let i = -w; i < w; i++) {
      const a = half(i), side = a === w - 1, end = a >= wn - 1 || k === K0 || k === K1; if (!side && !end) continue;   // and where the side steps in, across it
      for (const dd of ds) { g.set(i, dd + 7, k, cap); g.set(i, dd + 4, k, col); }
      if (side ? mod(k, 4) === 0 : mod(i, 4) === 0) for (let j = d + 1; j <= d + 6; j++) g.set(i, j, k, col);
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
// The ocean liner: 368 cubes long (k = -184..183), 48 in the beam. A black hull with a flared bow, a counter stern and
// rows of lit portholes; a promenade deck with an open walk down each side; a boat deck with seven lifeboats a side; a
// bridge with wings; three raked funnels (parts of their own: they come down when she is wrecked); two masts with
// derricks over the hatches. She is hollow, and the decks hidden under the houses are left out, to keep her light.
// =====================================================================================================================
export const LINER_PAINT = { red: 0xc8452c, buff: 0xd9a13a, blue: 0x2a5fae };
const LNR = { k0: -184, k1: 183, B: 24, D: 6 };
const lnPlan = (k) => (k > 64 ? 1 - Math.pow((k - 64) / 120, 1.7) : k < -150 ? 0.45 + 0.55 * Math.sqrt(Math.max(0, 1 - Math.pow((-150 - k) / 36, 2))) : 1);
const lnDeck = (k) => 26 + (k > 90 ? rnd(7 * Math.pow((k - 90) / 93, 2)) : 0) + (k < -140 ? rnd(2 * Math.pow((-140 - k) / 44, 2)) : 0);
// the bow flares (narrow at the water, full at the deck) and the stern overhangs
const lnHalf = (k, j) => { const up = clamp(j / lnDeck(k)), fb = clamp((k - 100) / 84), fs = clamp((-160 - k) / 24); return Math.max(1, rnd(LNR.B * lnPlan(k) * (1 - 0.3 * fb * (1 - up)) * (1 - 0.55 * fs * Math.pow(1 - up, 1.5)) * (j >= 0 ? 1 : 1 + 0.03 * j))); };
const FUNNELS = [36, -4, -44];
// a mast: two cubes square to `mid`, one above; a yard; a derrick boom each side sloping away over the hatch (dir = 1 forward)
function mast(g, k, j0, mid, top, yard, dir) {
  bx(g, -1, 0, j0, mid, k, k + 1, 0xd9a13a); bx(g, -1, 0, mid + 1, top, k, k, 0xd9a13a); bx(g, -8, 7, yard, yard, k, k, 0xd9a13a); bx(g, -1, 0, top + 1, top + 1, k, k, 0xcfcab8);
  bx(g, -3, 2, mid - 8, mid - 6, k - 1, k + 2, WHITE);                                    // the crow's nest
  for (const i of [-4, 3]) for (let t = 0; t < 24; t++) { const j = j0 + 5 + fl(t * 0.5), kk = k + (dir > 0 ? 2 + t : -1 - t); g.set(i, j, kk, STEEL); if (t % 2) g.set(i, j + 1, kk, STEEL); }
  bx(g, -4, 3, j0 + 4, j0 + 5, k, k + 1, STEEL);
}
function lifeboat(g, s, c, j0, cover) {
  for (let k = c - 9; k <= c + 8; k++) {
    const e = ab(k - c + 0.5), w = e > 7.5 ? 1 : 2;
    for (let a = 19 - w; a <= 18 + w; a++) { if (w === 2 && a > 17 && a < 20) g.set(sx(s, a), j0, k, WHITE); g.set(sx(s, a), j0 + 1, k, WHITE); g.set(sx(s, a), j0 + 2, k, k === c - 1 || k === c ? 0x2a2c30 : WHITE); g.set(sx(s, a), j0 + 3, k, cover); }
  }
  for (const k of [c - 5, c + 4]) bxs(g, s, 18, 19, j0 - 1, j0 - 1, k, k, 0x55595f);       // chocks
  for (const k of [c - 10, c + 9]) { bxs(g, s, 20, 20, j0 - 1, j0 + 7, k, k, 0x6d7279); bxs(g, s, 18, 20, j0 + 7, j0 + 7, k, k, 0x6d7279); }   // davits
}

function linerParts(o) {
  const seed = o.seed || 0, paint = LINER_PAINT[o.paint] ?? LINER_PAINT.red, { k0, k1 } = LNR;
  const A0 = -118, A1 = 94, AO = 21, AI = 17, D0 = 26, RA = 42, B0 = -100, B1 = 84, BW = 15, RB = 59, C0 = -70, C1 = 60, CW = 9, RC = 71;
  const teak = (i, k) => tone(mod(i, 4) === 0 ? TEAK2 : TEAK, 0.94 + 0.12 * hash(i, 2, k >> 2, seed)), GREY = 0xcfd2d4, DAVIT = 0x6d7279;
  const bulbs = []; for (const s of SIDES) for (let k = A0 + 4; k <= A1 - 16; k += 8) bulbs.push([sx(s, AO + 1), RA - 1, k]);
  const parts = [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-28, -4, k0 - 6, 28, 108, k1 + 3], paint: (g) => {
      const set = (i, j, k, c) => g.set(i, j, k, c);
      // ---- hull: red below the water, a white line, black topsides with two rows of lit portholes, a white strake at the deck ----
      hull(g, { k0, k1, halfAt: lnHalf, deckAt: lnDeck, keelAt: () => -LNR.D, bottom: false, skirt: false, cut: -3, paint: (i, j, k, where) => {
        const d = lnDeck(k);
        if (where === 'deck') return teak(i, k);
        if (j <= 0) return tone(BOTTOM, 0.9 + 0.2 * hash(i, j >> 1, k >> 2, seed));
        if (j === 1) return BOOT;
        if (j >= d - 3) return WHITE;
        if (j === d - 4) return paint;
        return (j === 7 || j === 12 || j === 17) && mod(k, 6) === 0 && k > -166 && k < 150 ? SHINE : HULL;
      } });
      for (let k = A0 + 6; k <= A1 - 6; k++) for (let i = -12; i <= 11; i++) set(i, D0, k, -1);   // the deck nobody can see, under the houses
      // ---- the forecastle: a solid bulwark round the bow, rails behind it; rails round the after deck ----
      for (let k = 150; k <= k1; k++) { const d = lnDeck(k), w = lnHalf(k, d), wn = Math.min(k < k1 ? lnHalf(k + 1, d) : 0, lnHalf(k - 1, d)); for (let i = -w; i < w; i++) { const a = half(i); if (a === w - 1 || a >= wn - 1) for (let j = d + 1; j <= d + 5; j++) set(i, j, k, j === d + 5 ? WOOD : WHITE); } }
      rails(g, lnHalf, lnDeck, A1 + 1, 149, k0, k1); rails(g, lnHalf, lnDeck, k0, A0 - 1, k0, k1);
      // ---- the promenade deck: an open walk down each side behind posts and a rail, closed in with big windows forward ----
      for (let k = A0; k <= A1; k++) {
        const front = k >= A1 - 14, endK = k === A0 || k === A1;
        for (let i = -AO - 1; i <= AO; i++) {
          const a = half(i);
          if (a >= 10 || k < B0 + 6 || k > B1 - 6) set(i, RA, k, a === AO || endK ? WHITE : teak(i, k));
          const wall = front ? a === AO || k === A1 || (k === A1 - 14 && a > AI) : a === AI || (endK && a <= AI);
          if (wall) for (let j = D0 + 1; j < RA; j++) {
            const along = a === AO || a === AI, post = along && !(k === A1 || (endK && a < AI)) ? mod(k - A0, 6) < 2 : mod(a, 6) < 2;
            let c = j >= D0 + 6 && j <= D0 + 12 && !post ? glass(j, along ? k : i + 40, D0 + 11) : WHITE;
            if (a === AI && !front && mod(k - A0, 44) >= 22 && mod(k - A0, 44) <= 24 && j <= D0 + 12) c = WOOD2;
            set(i, j, k, c);
          } else if (a === AO) { if (mod(k - A0, 8) === 0 || endK) for (let j = D0 + 1; j < RA; j++) set(i, j, k, WHITE); else { set(i, D0 + 6, k, WOOD); set(i, D0 + 3, k, RAIL); } }
        }
      }
      // ---- the boat deck: its house, a rail along the edge, seven lifeboats a side under their davits ----
      for (let k = B0; k <= B1; k++) for (let i = -BW - 1; i <= BW; i++) {
        const a = half(i), endK = k === B0 || k === B1;
        if (a >= 5 || k < C0 + 5 || k > C1 + 12) set(i, RB, k, a === BW || endK ? WHITE : teak(i, k));
        if (a === BW || endK) {
          for (let j = RA + 1; j < RB; j++) { const post = a === BW && !endK ? mod(k - B0, 6) < 2 : mod(a, 6) < 2; let c = j >= RA + 6 && j <= RA + 11 && !post ? glass(j, a === BW ? k : i + 40, RA + 10) : WHITE; if (a === BW && mod(k - B0, 40) >= 18 && mod(k - B0, 40) <= 20 && j <= RA + 12) c = WOOD2; set(i, j, k, c); }
          set(i, RB + 5, k, WOOD); set(i, RB + 3, k, RAIL); if (mod(a === BW ? k : i, 6) === 0) for (let j = RB + 1; j <= RB + 4; j++) set(i, j, k, RAIL);   // the sun deck's rail
        }
      }
      for (let k = A0; k <= A1; k++) for (const s of SIDES) { set(sx(s, AO), RA + 5, k, WOOD); set(sx(s, AO), RA + 3, k, RAIL); if (mod(k, 6) === 0) for (let j = RA + 1; j <= RA + 4; j++) set(sx(s, AO), j, k, RAIL); }
      for (const s of SIDES) for (let n = 0; n < 7; n++) lifeboat(g, s, -86 + 26 * n, RA + 2, paint);
      // ---- on top: the officers' house the funnels stand on, and the bridge ahead of it with a wing out each side ----
      for (let k = C0; k <= C1; k++) for (let i = -CW - 1; i <= CW; i++) {
        const a = half(i), endK = k === C0 || k === C1;
        set(i, RC, k, a === CW || endK ? WHITE : tone(GREY, 0.94 + 0.1 * hash(i >> 1, 9, k >> 1, seed)));
        if (a === CW || endK) for (let j = RB + 1; j < RC; j++) set(i, j, k, j >= RB + 5 && j <= RB + 8 && (a === CW ? mod(k - C0, 6) >= 2 : mod(a, 5) >= 2) ? glass(j, a === CW ? k : i + 40, RB + 8) : WHITE);
      }
      const W0 = 61, W1 = 78, WW = 13, RW = 73;
      for (let k = W0; k <= W1; k++) for (let i = -WW - 1; i <= WW; i++) {
        const a = half(i), endK = k === W0 || k === W1; set(i, RW, k, a === WW || endK ? paint : WHITE);
        if (a === WW || endK) for (let j = RB + 1; j < RW; j++) { const post = (a === WW && endK) || (a === WW ? mod(k - W0, 4) === 0 : mod(a, 5) === 4); set(i, j, k, j >= RB + 6 && j <= RB + 11 && !post && k !== W0 ? glass(j, a === WW ? k : i + 20, RB + 10) : WHITE); }
      }
      for (const s of SIDES) { bxs(g, s, 14, 23, RB, RB, 66, 76, WHITE); for (let k = 66; k <= 76; k++) for (let a = 14; a <= 23; a++) if (a === 23 || k === 66 || k === 76) bxs(g, s, a, a, RB + 1, RB + 5, k, k, WHITE); set(sx(s, 23), RB + 6, 71, s > 0 ? 0x8a1f1a : 0x1f6a38); }
      bx(g, -1, 0, RW + 1, RW + 2, 69, 70, 0x9a9fa6); bx(g, 0, 0, RW + 1, RW + 12, 64, 64, WHITE); bx(g, -4, 3, RW + 9, RW + 9, 64, 64, WHITE); bx(g, -1, 0, RW + 1, RW + 3, 75, 76, 0xb08a58);
      // ventilators between the funnels, and the collars the funnels stand in
      for (const kc of FUNNELS) bx(g, -6, 5, RC + 1, RC + 1, kc - 9, kc + 8, 0x33363c);
      for (const s of SIDES) for (const k of [18, -22, -60]) { bxs(g, s, 7, 8, RC + 1, RC + 6, k, k + 1, WHITE); bxs(g, s, 6, 9, RC + 7, RC + 9, k - 1, k + 3, WHITE); bxs(g, s, 7, 8, RC + 7, RC + 8, k + 3, k + 3, 0xb8322a); }
      // ---- the weather decks: hatches under the derricks, a windlass and capstans forward, a staff and flag aft ----
      mast(g, 116, lnDeck(116) + 1, 78, 102, 92, 1); mast(g, -130, D0 + 1, 74, 98, 88, -1);
      for (let k = 124; k <= 142; k++) bx(g, -8, 7, lnDeck(k) + 1, lnDeck(124) + 3, k, k, (i, j) => (j === lnDeck(124) + 3 ? 0x3f5a50 : 0x55595f));
      bx(g, -8, 7, D0 + 1, D0 + 3, -156, -138, (i, j) => (j === D0 + 3 ? 0x3f5a50 : 0x55595f));
      { const d = lnDeck(160); bx(g, -4, 3, d + 1, d + 3, 158, 163, STEEL); bx(g, -6, 5, d + 2, d + 2, 160, 161, 0x55595f); for (const i of [-9, 7]) bx(g, i, i + 1, lnDeck(150) + 1, lnDeck(150) + 3, 150, 151, STEEL); }
      for (const s of SIDES) { const d = lnDeck(168); bxs(g, s, lnHalf(168, d - 3), lnHalf(168, d - 3), d - 5, d - 3, 167, 169, 0x2a2c30); }   // the anchors, in their pipes
      { const d = lnDeck(-181); bx(g, 0, 0, d + 1, d + 16, -181, -181, WHITE); bx(g, 0, 0, d + 12, d + 15, -187, -182, (i, j) => (j === d + 13 || j === d + 14 ? WHITE : paint)); }
      for (const k of [-176, -164]) for (const i of [-8, 6]) bx(g, i, i + 1, lnDeck(k) + 1, lnDeck(k) + 3, k, k + 1, STEEL);
    } },
    { name: 'radar', parent: 'body', pivot: [0, 76, 70], box: [-5, 0, -1, 5, 2, 1], paint: (g) => { bx(g, -5, 4, 0, 1, -1, 0, 0xe9e6dc); bx(g, -5, 4, 0, 0, -1, -1, 0x9a9fa6); } },
    lamp('nvM', cubes(-1, 0, 103, 103, 116), WHITE_L), lamp('nvA', cubes(-1, 0, 99, 99, -130), WHITE_L), lamp('nvP', cubes(23, 23, 65, 65, 71), RED_L), lamp('nvS', cubes(-24, -24, 65, 65, 71), GREEN_L),
    lamp('fest', bulbs, 0xffd27a | GLOW), lamp('festOff', bulbs, 0xd8d2b8),
  ];
  // ---- the funnels: oval, raked aft, the owner's colour under a black top ----
  FUNNELS.forEach((kc, n) => parts.push({ name: 'f' + (n + 1), parent: 'body', pivot: [0, 72, kc], box: [-5, 0, -12, 5, 31, 8], paint: (g) => {
    for (let j = 0; j <= 30; j++) { const r = -fl(j / 8); for (let k = -7; k <= 6; k++) for (let i = -5; i <= 4; i++) {
      const a = half(i), ke = k <= -6 || k >= 5; if (a === 4 && (k === -7 || k === 6)) continue;
      if (!(a === 4 || k === -7 || k === 6 || (a === 3 && ke)) && j < 30) continue;
      g.set(i, j, k + r, j >= 24 ? BLACK : paint);
    } }
    for (let j = 8; j <= 24; j += 8) for (let i = -5; i <= 4; i++) g.set(i, j - 1, 6 - fl(j / 8) + 1, j >= 24 ? BLACK : paint);   // close the steps the rake leaves at the front
  } }));
  return parts;
}

// =====================================================================================================================
// The aircraft carrier: 368 cubes long (k = -184..183), 52 in the beam at the water and up to 88 across the flight deck.
// A grey hull that flares out to the deck, hangar doors down both sides, an angled landing strip that bulges out to
// port, two catapult tracks forward, arrestor wires aft, lifts, and on the starboard side the island: three tiers of
// bridges, a funnel, a mast with a turning radar. Four jets stand on deck, each a part of its own: they go over the side
// when she lists. She is hollow, like the liner.
// =====================================================================================================================
const CVR = { k0: -184, k1: 183, B: 26, FD: 38 };
const GREY = 0x8d959c, GREY2 = 0x7b838a, GREY3 = 0x9aa2a8, FDECK = 0x393d43, LINE = 0xe4e2d8, YEL = 0xe2b93b, WIRE = 0x1d1f23, CABLE = 0x8a8f96, NOZ = 0x26282c;
const dkBase = (k) => (k > 150 ? 30 - rnd(9 * Math.pow((k - 150) / 33, 1.6)) : k < -176 ? 28 : 30);
const dkPort = (k) => dkBase(k) + (k <= 60 && k >= -112 ? rnd(14 * Math.min(1, (60 - k) / 44, (k + 112) / 30)) : 0);            // the angled deck
const dkStar = (k) => dkBase(k) + (k >= -10 && k <= 50 ? 6 : 0) + (k >= -78 && k <= -46 ? 8 : 0);                                // the island, the deck-edge lift
const cvPlan = (k) => (k > 184 ? 0 : k > 84 ? 1 - Math.pow((k - 84) / 100, 2.1) : k < -150 ? 0.72 + 0.28 * Math.sqrt(Math.max(0, 1 - Math.pow((-150 - k) / 34, 2))) : 1);
// the stem rakes forward and the bow flares out under the deck; the stern tucks in toward the water
const cvHalf = (k, j) => {
  const up = clamp(j / 37), wl = CVR.B * cvPlan(k + (1 - up) * 24) * (j >= 0 ? 1 : 1 + 0.03 * j); if (wl <= 0) return 0;
  const top = Math.min(CVR.B + 2, dkBase(k) - 2) * (k > 150 ? Math.pow(clamp((185 - k) / 35), 0.45) : 1), fs = clamp((-150 - k) / 34);
  return Math.max(1, rnd((wl + (top - wl) * Math.pow(up, 2.2)) * (1 - 0.3 * fs * Math.pow(1 - up, 1.5))));
};
const NINE = ['.###.', '#...#', '#...#', '.####', '....#', '#...#', '.###.'];
const nine = (u, v) => u >= 0 && u < 5 && v >= 0 && v < 7 && NINE[v][u] === '#';
// the centre line of the landing strip, which runs from the stern out over the port bow
const strip = (k) => -8 + (k + 176) * 0.17;

// Where her four jets stand, wings folded: [across, along, squadron colour]. The first is on the bow catapult and the
// second on the waist catapult, which throws it out along the angled deck; the other two are parked abaft the island, one of them on the deck-edge lift.
export const DECK_JETS = [[-13, 112, 'gold'], [14, -14, 'gold'], [-18, -61, 'red'], [-18, -135, 'blue']];
export const WAIST = 0.21;   // how far the waist catapult points off the bow, to port
export const CARRIER_DECK = CVR.FD + 1;   // the cube the jets' wheels stand in

function carrierParts(o) {
  const seed = o.seed || 0, { k0, k1, FD } = CVR, IK0 = -6, IK1 = 44, IA0 = 24, IA1 = 35;
  const deckPaint = (i, k) => {
    const base = tone(FDECK, 0.9 + 0.2 * hash(i >> 1, 4, k >> 1, seed)), wP = dkPort(k), wS = dkStar(k);
    if (i === wP - 3 || i === -wS + 2) return LINE;                                                         // the deck edge lines
    if (k >= -180 && k <= 46) {                                                                             // the landing strip
      const d = i - strip(k);
      if ((k === -152 || k === -140 || k === -128 || k === -116) && ab(d) < 12) return CABLE;               // arrestor wires
      if (ab(d) < 0.55) return mod(k, 12) < 7 ? YEL : base;
      if (ab(ab(d) - 13) < 0.55) return LINE;
    }
    if (k >= 84 && k <= 178 && (i === -13 || i === -14)) return WIRE;                                     // the bow catapult's track
    if (k >= -8 && k <= 62) { const d = i - (14 + (k + 14) * WAIST); if (ab(d) < 0.6) return WIRE; }   // and the waist one's, out along the angled deck
    if (k >= 148 && k <= 161 && (nine(fl((11 - i) / 2), fl((161 - k) / 2)) || nine(fl((-1 - i) / 2), fl((161 - k) / 2)))) return LINE;   // her number, read from astern
    if (k >= 38 && k <= 62 && i >= -11 && i <= 10 && (k === 38 || k === 62 || i === -11 || i === 10)) return GREY2;                       // the forward lift
    if (k >= -78 && k <= -46 && i <= -22 && (k === -78 || k === -46 || i === -22)) return (i + k) & 2 ? YEL : WIRE;                     // the deck-edge lift
    return base;
  };
  const parts = [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-48, -4, k0 - 4, 48, FD + 62, k1 + 4], paint: (g) => {
      const set = (i, j, k, c) => g.set(i, j, k, c);
      // ---- hull: red under the water, a black boot top, grey above with hangar doors down both sides ----
      hull(g, { k0, k1, halfAt: cvHalf, deckAt: () => FD - 1, keelAt: () => -6, bottom: false, skirt: false, cut: -3, paint: (i, j, k, where) => {
        if (where === 'deck') return -1;                                                                  // the flight deck covers it
        if (j < 0) return tone(BOTTOM, 0.9 + 0.2 * hash(i, j >> 1, k >> 2, seed));
        if (j <= 1) return 0x1c1e22;
        if (k === k0 && j >= 18 && j <= 29 && half(i) < 15) return j === 18 || j === 29 || half(i) === 14 ? GREY2 : mod(i, 5) === 0 ? GREY2 : j <= 21 ? 0x4a4f56 : 0x1b1d21;   // the open fantail under the round-down
        if (k >= -150 && k <= 96 && j >= 12 && j <= 28 && mod(k + 150, 50) < 24) {                        // a hangar door: two stand open
          const n = fl((k + 150) / 50), open = n === 1 || n === 3, e = mod(k + 150, 50);
          if (e === 0 || e === 23 || j === 12 || j === 28) return GREY2;
          return open ? (j < 15 ? 0x4a4f56 : 0x1b1d21) : tone(GREY3, mod(j, 4) === 0 ? 0.82 : 1);
        }
        if (j === 7 && mod(k, 9) === 0 && k > -170 && k < 130) return SHINE;
        return tone(GREY, 0.95 + 0.1 * hash(i, j >> 1, k >> 2, seed) - (j >= FD - 3 ? 0.08 : 0));
      } });
      // ---- the flight deck, two cubes thick at its edge, with her markings ----
      for (let k = k0; k <= k1; k++) {
        const wP = dkPort(k), wS = dkStar(k), end = k === k0 || k === k1;
        for (let i = -wS; i < wP; i++) {
          const edge = end || i === -wS || i === wP - 1 || i >= dkPort(k + 1) || i >= dkPort(k - 1) || i < -dkStar(k + 1) || i < -dkStar(k - 1);
          set(i, FD, k, edge ? GREY2 : deckPaint(i, k));
          if (edge) set(i, FD - 1, k, k === k0 && mod(i, 6) < 3 ? LINE : GREY2);
        }
        // under the angled deck a sponson slopes back in to the hull; under the rest of the overhang a walkway with rafts
        const hw = cvHalf(k, FD - 1);
        for (let a = hw; a < wP - 1; a++) if (wP > dkBase(k)) { const j = Math.max(FD - 16, FD - 2 - rnd((wP - 2 - a) * 0.9)); set(a, j, k, GREY); set(a, j + 1, k, GREY); }
        if (k > -172 && k < 150) for (const s of SIDES) {
          if (s > 0 && wP > dkBase(k)) continue;
          for (let a = hw; a <= hw + 1; a++) set(sx(s, a), FD - 6, k, 0x5d646b);
          if (mod(k, 6) === 0) for (let j = FD - 5; j <= FD - 2; j++) set(sx(s, hw + 1), j, k, GREY2);
          if (mod(k, 18) < 4) { set(sx(s, hw + 1), FD - 7, k, LINE); set(sx(s, hw + 1), FD - 8, k, LINE); }
        }
      }
      // ---- the island: three tiers, each with its band of windows, and the funnel built into its after end ----
      const tier = (a0, a1, j0, j1, ka, kb, g0, g1, roof) => { for (let k = ka; k <= kb; k++) for (let a = a0; a <= a1; a++) {
        const edge = a === a0 || a === a1 || k === ka || k === kb, i = sx(-1, a); set(i, j1, k, edge ? GREY2 : roof);
        if (edge) for (let j = j0; j < j1; j++) { const along = a === a0 || a === a1, post = along ? mod(k - ka, 4) === 0 || k === kb : mod(a - a0, 4) === 0 || a === a1; set(i, j, k, j >= g0 && j <= g1 && !post ? glass(j, along ? k : a + 30, g1) : tone(GREY, 0.96 + 0.08 * hash(a, j >> 1, k >> 2, seed))); }
      } };
      tier(IA0, IA1, FD + 1, FD + 14, IK0, IK1, 0, -1, 0x5d646b);
      tier(IA0, IA1 - 1, FD + 15, FD + 22, 6, IK1, FD + 18, FD + 20, 0x5d646b);
      tier(IA0, IA1 - 2, FD + 23, FD + 30, 12, IK1 - 2, FD + 26, FD + 28, 0x5d646b);
      for (let k = 14; k <= 22; k++) for (let a = IA0 - 3; a < IA0; a++) { const i = sx(-1, a), e = a === IA0 - 3 || k === 14 || k === 22; set(i, FD + 22, k, GREY2); set(i, FD + 30, k, GREY2); if (e) for (let j = FD + 23; j < FD + 30; j++) set(i, j, k, j >= FD + 25 && j <= FD + 28 && !(a === IA0 - 3 && (k === 14 || k === 22)) ? glass(j, k, FD + 28) : GREY); }   // flight control, looking out over the deck
      for (const a of [IA0, IA1]) for (let k = 14; k <= 36; k++) for (let j = FD + 3; j <= FD + 12; j++) { const u = a === IA1 ? k - 14 : 36 - k; if (nine(fl(u / 2), fl((FD + 12 - j) / 1.45)) || nine(fl((u - 12) / 2), fl((FD + 12 - j) / 1.45))) set(sx(-1, a), j, k, LINE); }   // her number on the island
      for (let k = IK0; k <= 5; k++) for (let a = IA0 + 2; a <= IA1 - 3; a++) { const e = a === IA0 + 2 || a === IA1 - 3 || k === IK0 || k === 5; if (e) for (let j = FD + 15; j <= FD + 34; j++) set(sx(-1, a), j, k - fl((j - FD - 15) / 10), j >= FD + 31 ? BLACK : GREY2); }   // the funnel, raked
      for (let j = FD + 25; j <= FD + 34; j += 10) for (let a = IA0 + 2; a <= IA1 - 3; a++) set(sx(-1, a), j - 1, 5 - fl((j - FD - 15) / 10) + 1, j >= FD + 31 ? BLACK : GREY2);
      bxs(g, -1, IA0 + 3, IA0 + 6, FD + 31, FD + 34, 36, 39, LINE);                                       // a radar dome on the bridge roof
      // the mast: a post with a platform and a yard, the big radar turning on top
      bxs(g, -1, 29, 30, FD + 31, FD + 49, 24, 25, GREY2); bxs(g, -1, 27, 32, FD + 43, FD + 43, 22, 27, GREY2); bxs(g, -1, 23, 36, FD + 39, FD + 39, 24, 24, GREY2); bxs(g, -1, 29, 29, FD + 50, FD + 55, 24, 24, GREY2);
      // a crane abaft the island, two yellow deck tractors, a flag
      bxs(g, -1, 28, 29, FD + 1, FD + 11, -20, -19, YEL); for (let t = 0; t < 16; t++) { set(sx(-1, 28), FD + 11 + fl(t / 4), -21 - t, YEL); set(sx(-1, 28), FD + 10 + fl(t / 4), -21 - t, YEL); }
      for (const [i, k] of [[-22, 66], [12, -150]]) { bx(g, i, i + 3, FD + 2, FD + 3, k, k + 5, YEL); bx(g, i, i + 3, FD + 4, FD + 4, k, k + 1, YEL); for (const kk of [k, k + 5]) for (const ii of [i, i + 3]) set(ii, FD + 1, kk, BLACK); bx(g, i + 1, i + 2, FD + 1, FD + 1, k, k + 5, 0x2a2c30); }
      bxs(g, -1, 30, 30, FD + 15, FD + 26, IK0 - 1, IK0 - 1, GREY2); bx(g, -31, -31, FD + 23, FD + 26, IK0 - 7, IK0 - 2, (i, j) => (j & 1 ? LINE : 0xb8322a));
      // anchors in their pipes
      for (const s of SIDES) { const w = cvHalf(150, 26); bxs(g, s, w, w, 24, 27, 149, 151, 0x2a2c30); }
    } },
    { name: 'radar', parent: 'body', pivot: [-30, FD + 50, 25], box: [-7, 0, -1, 7, 6, 1], paint: (g) => { for (let x = -7; x <= 6; x++) for (let y = 0; y <= 5; y++) if (y === 0 || y === 5 || x === -7 || x === 6 || mod(x, 3) === 0) g.set(x, y, -1, GREY3); bx(g, -1, 0, 0, 5, 0, 0, GREY2); } },
    lamp('nvM', cubes(-30, -30, FD + 56, FD + 56, 24), WHITE_L), lamp('nvA', cubes(-1, 0, FD - 3, FD - 3, k0 - 1), WHITE_L),
    lamp('nvP', cubes(dkPort(120), dkPort(120), FD, FD, 120), RED_L), lamp('nvS', cubes(-dkStar(120) - 1, -dkStar(120) - 1, FD, FD, 120), GREEN_L),
  ];
  // deck lights: along the landing strip and down both edges
  const bulbs = []; for (let k = -176; k <= 40; k += 12) bulbs.push([rnd(strip(k)), FD + 1, k]); for (let k = -170; k <= 150; k += 16) { bulbs.push([dkPort(k) - 2, FD + 1, k]); bulbs.push([-dkStar(k) + 1, FD + 1, k]); }
  parts.push(lamp('fest', bulbs, 0xffe08a | GLOW), lamp('festOff', bulbs, 0x6d7279));
  DECK_JETS.forEach(([i, k, tint], n) => parts.push({ name: 'p' + (n + 1), parent: 'body', pivot: [i, FD + 1, k], box: jetBox(0), paint: (g) => jetStatic(g, { dir: 0, folded: true, seed: seed + n, tint: JET_TINT[tint] }) }));
  return parts;
}

// =====================================================================================================================
// The container ship: a coastal feeder, 304 cubes long (k = -152..151), 48 in the beam, drawing 8. The house is aft:
// five decks with the bridge and its wings on top, a funnel in the owner's colour, an orange lifeboat on each side.
// Ahead of it four bays of containers stand three across on their hatch covers, and a raised forecastle carries the
// foremast and the windlasses. Most boxes are painted into the hull; the top one of each bay is a part (`c1`..`c5`), so
// it slides off and floats when she goes down.
// =====================================================================================================================
export const SHIP_PAINT = { blue: 0x1f3f6e, green: 0x1f5a45, red: 0x8a2a24, black: 0x23262b };
const CS = { k0: -152, k1: 151, B: 24, D: 8, deck: 14, bays: [-98, -52, -6, 40], cols: [7, -7, -21] };
const csPlan = (k) => (k > 92 ? 1 - Math.pow((k - 92) / 61, 2.1) : k < -138 ? 0.86 + 0.14 * Math.sqrt(Math.max(0, 1 - Math.pow((-138 - k) / 15, 2))) : 1);
const csDeck = (k) => (k > 96 ? 21 + rnd(4 * Math.pow((k - 96) / 55, 2)) : CS.deck);          // a raised forecastle with a little sheer
const csKeel = (k) => -CS.D + (k > 128 ? rnd(6 * Math.pow((k - 128) / 23, 2)) : k < -132 ? rnd(5 * (-132 - k) / 20) : 0);
const csHalf = (k, j) => Math.max(1, rnd(CS.B * csPlan(k) * (j >= 0 ? 1 : 1 - 0.3 * Math.pow(-j / CS.D, 1.5))));
const DECKRED = 0x7d3b33, ORANGE = 0xe8641e, HATCH = 0x6a6e75;

// The line's name is in made-up letters, each a few strokes of a 5 by 7 cell and the same either way round, so it reads
// alike from both sides: T top, M middle, B bottom, S both sides (n their upper half, u their lower), C a stroke down
// the centre (c its upper half, v its lower), o a dot. null is a space.
const LINE_NAME = ['Tnv', 'Buc', 'SMv', 'TMu', null, 'Mnv', 'TBSo', 'Tnv', null, 'TMu', 'Buc', 'SMv'];
const bar = (b, c, r) => { const side = c === 0 || c === 4, mid = c === 2, has = (x) => b.includes(x);
  return (has('T') && r === 6) || (has('M') && r === 3) || (has('B') && r === 0) || (side && (has('S') || (has('n') && r >= 3) || (has('u') && r <= 3))) || (mid && (has('C') || (has('c') && r >= 3) || (has('v') && r <= 3) || (has('o') && r === 3))); };

function shipParts(o) {
  const seed = o.seed || 0, paint = SHIP_PAINT[o.paint] ?? SHIP_PAINT.blue, { k0, k1, B, deck, bays, cols } = CS;
  const ph = o.phase ?? ((seed * 2.399) % 6.283), lowS = o.low || (ph > PI ? -1 : 1);            // the side she will list to (lowSide)
  // how many boxes are painted in each column of each bay (port, middle, starboard), from the house forward
  const high = [[2, 2, 2], [2, 2, 2], [1, 2, 1], [1, 1, 1]];
  const boxCol = (b, c, n) => BOXES[fl(hash(b * 7 + c, n, 3, seed) * BOXES.length)];
  const j0 = deck + 2, h0 = -146, h1 = -106, HW = 20, LV = 10, top = deck + 1 + 5 * LV;          // the house: k h0..h1, five decks of LV cubes
  const parts = [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-28, -9, k0 - 6, 28, 96, k1 + 3], paint: (g) => {
      const set = (i, j, k, c) => g.set(i, j, k, c);
      hull(g, { k0, k1, halfAt: csHalf, deckAt: csDeck, keelAt: csKeel, paint: (i, j, k, where) => {
        const n = hash(i >> 1, j, k >> 2, seed);
        if (where === 'deck') return mod(k, 16) === 0 ? tone(DECKRED, 0.86) : tone(DECKRED, 0.94 + 0.12 * n);
        if (j < -1) return tone(BOTTOM, 0.9 + 0.2 * n);
        if (j <= 1) return BOOT;
        if (k >= 108 && k <= 130 && j >= 16 && j <= 18 && half(i) >= csHalf(k, j) - 1 && mod(k + seed, 4) !== 0 && !(j === 17 && mod(k, 3) === 0)) return 0xf1efe8;   // her name on the bow, in made-up letters
        if (j >= 5 && j <= 11 && k >= -44 && k < 40) { const q = i >= 0 ? 39 - k : k + 44, n = fl(q / 7), c = q - n * 7, bars = LINE_NAME[n]; if (bars && c < 5 && bar(bars, c, j - 5)) return 0xf1efe8; }   // the line's name along her side
        const run = hash(k + i, 9, 3, seed);                                                // a few rust streaks from the deck edge
        return run < 0.07 && j >= csDeck(k) - 1 - fl(hash(k + i, 4, 1, seed) * 6) ? tone(RUST, 0.7 + 0.25 * n) : j === csDeck(k) ? tone(paint, 1.25) : paint;
      } });
      rails(g, csHalf, csDeck, k0, 96, k0, k1, RAIL, 0xd9d6cc); rails(g, csHalf, csDeck, 97, k1, k0, k1, RAIL, 0xd9d6cc);
      for (const s of SIDES) for (const k of [k0 + 8, k1 - 10]) for (const j of [3, 5, 7]) set(sx(s, csHalf(k, j) - 1), j, k, BOOT);   // draught marks
      // ---- the cargo: a hatch cover under each bay, the boxes on it three across ----
      bays.forEach((kb, b) => {
        bx(g, -22, 21, deck + 1, deck + 1, kb - 1, kb + 44, (i, j, k) => (mod(i + 22, 15) === 0 || k === kb - 1 || k === kb + 44 ? 0x4f5359 : HATCH));
        cols.forEach((i0, c) => { for (let n = 0; n < high[b][c]; n++) {
          const up = n + 1 < high[b][c], px = c > 0 && high[b][c - 1] > n, nx = c < 2 && high[b][c + 1] > n;   // (cols run from port to starboard, so the one before is on +x)
          crate(g, i0, j0 + n * 16, kb, boxCol(b, c, n), seed + b * 9 + c * 3 + n, (px ? 1 : 0) | (nx ? 2 : 0) | (up ? 4 : 0));
        } });
      });
      // posts between the bays to lash to
      for (const kg of [bays[0] - 3, ...bays.slice(1).map((kb) => kb - 2), bays[3] + 45]) for (const s of SIDES) { bxs(g, s, 22, 22, deck + 1, deck + 20, kg, kg, 0x55595f); bxs(g, s, 19, 22, deck + 20, deck + 20, kg, kg, 0xd9a520); }
      // ---- the house: white, a row of windows to each deck, the bridge glazed all round on top ----
      for (let lv = 0; lv < 5; lv++) {
        const b0 = deck + 1 + lv * LV, bridge = lv === 4;
        for (let k = h0; k <= h1; k++) for (let i = -HW; i < HW; i++) {
          const a = half(i), side = a === HW - 1, end = k === h0 || k === h1; if (!side && !end) continue;
          for (let j = b0; j < b0 + LV; j++) {
            const q = side ? k - h0 : i + HW, post = (side && end) || (bridge ? mod(q, 5) === 0 : mod(q, 6) < 2);
            let c = j === b0 ? tone(WHITE, 0.86) : WHITE;
            if (bridge ? j >= b0 + 4 && j <= b0 + 7 && !post && !(end && k === h0 && a > 8) : j >= b0 + 4 && j <= b0 + 6 && !post && !(end && k === h1 && lv < 3)) c = glass(j, q + lv * 3, b0 + 6);
            if (lv === 0 && side && k >= h1 - 8 && k <= h1 - 5 && j <= b0 + 7) c = j === b0 + 5 && k === h1 - 6 ? GLASS : 0x8a8e94;   // a door on to the deck
            set(i, j, k, c);
          }
        }
      }
      bx(g, -HW - 1, HW, top, top, h0 - 1, h1 + 1, (i, j, k) => (half(i) === HW || k === h0 - 1 || k === h1 + 1 ? tone(WHITE, 0.8) : 0xc9c6bc));
      // the bridge wings out to the ship's side, with a dodger round them
      { const w0 = h1 - 12, b0 = deck + 1 + 4 * LV; for (const s of SIDES) { bxs(g, s, HW, B - 1, b0, b0, w0, h1, 0xc9c6bc); for (let k = w0; k <= h1; k++) for (let a = HW; a <= B - 1; a++) if (a === B - 1 || k === w0 || k === h1) for (let j = b0 + 1; j <= b0 + 4; j++) set(sx(s, a), j, k, WHITE); bxs(g, s, B - 2, B - 2, b0 - 6, b0 - 1, h1 - 6, h1 - 6, WHITE); } }
      bx(g, -HW + 1, HW - 2, top - LV, top - LV, h0 + 1, h1 - 1, 0x6f7378);                                                       // the bridge floor
      bx(g, -10, 9, top - LV + 1, top - LV + 3, h1 - 4, h1 - 2, DASH); bx(g, -1, 0, top - LV + 1, top - LV + 3, h1 - 7, h1 - 7, 0x55595f); bx(g, -1, 0, top - LV + 4, top - LV + 5, h1 - 7, h1 - 7, WOOD);        // the desk and the wheel
      // ---- on the roof: the funnel, the radar mast ----
      bx(g, -6, 5, top + 1, top + 18, h0 + 2, h0 + 13, (i, j, k) => { const edge = (half(i) === 5 ? 1 : 0) + (k === h0 + 2 || k === h0 + 13 ? 1 : 0); return edge === 0 && j < top + 18 ? -1 : j >= top + 16 ? BLACK : j >= top + 9 && j <= top + 12 ? WHITE : paint; });
      bx(g, -1, 0, top + 1, top + 20, h1 - 14, h1 - 13, WHITE); bx(g, -6, 5, top + 14, top + 14, h1 - 14, h1 - 14, WHITE); bx(g, -3, 2, top + 7, top + 7, h1 - 14, h1 - 12, 0x9a9fa6);
      for (const s of SIDES) { set(sx(s, B - 1), top - LV + 5, h1 - 3, s > 0 ? 0x8a1f1a : 0x1f6a38); }
      // an orange lifeboat hung on each side
      for (const s of SIDES) { bxs(g, s, HW, HW + 4, deck + 13, deck + 18, h0 + 8, h0 + 24, (i, j, k) => (j === deck + 16 && mod(k, 4) < 2 && half(i) === HW + 4 ? 0x2b2d31 : (k === h0 + 8 || k === h0 + 24) && (j === deck + 13 || j === deck + 18) ? -1 : j === deck + 18 ? tone(ORANGE, 0.85) : ORANGE)); for (const k of [h0 + 10, h0 + 22]) bxs(g, s, HW, HW + 2, deck + 19, deck + 21, k, k, 0x8a8e94); }
      // ---- the after deck: bitts, a staff and flag ----
      bitts(g, -8, deck + 1, k0 + 3); bitts(g, 4, deck + 1, k0 + 3);
      bx(g, 0, 0, deck + 1, deck + 14, k0 + 1, k0 + 1, WHITE); bx(g, 0, 0, deck + 10, deck + 13, k0 - 5, k0, (i, j) => (j === deck + 11 || j === deck + 12 ? WHITE : paint));
      // ---- the forecastle: a breakwater, two windlasses, bitts, the foremast, the anchors ----
      { const f = csDeck(104);
        for (let i = -16; i <= 15; i++) for (let j = f + 1; j <= f + 4; j++) set(i, j, 100 + (half(i) >> 2), tone(paint, 1.2));
        for (const s of SIDES) { bxs(g, s, 4, 9, csDeck(118) + 1, csDeck(118) + 4, 116, 121, STEEL); bxs(g, s, 5, 8, csDeck(118) + 5, csDeck(118) + 5, 117, 120, 0x55595f); bxs(g, s, 6, 7, csDeck(126) + 1, csDeck(126) + 1, 122, 132, 0x3a3d42); }
        bitts(g, -2, csDeck(138) + 1, 138);
        const fm = 110, fd = csDeck(fm); bx(g, -1, 0, fd + 1, fd + 26, fm, fm + 1, WHITE); bx(g, -5, 4, fd + 20, fd + 20, fm, fm, WHITE); bx(g, -2, 1, fd + 1, fd + 3, fm - 1, fm + 2, 0x9a9fa6);
        for (const s of SIDES) for (const [dj, dk] of [[0, 0], [-1, 0], [-2, 0], [-2, 1], [-1, -1], [-1, 1]]) { const k = 132 + dk, j = 13 + dj; set(sx(s, csHalf(k, j)), j, k, 0x2e3035); }
      }
    } },
    { name: 'radar', parent: 'body', pivot: [0, top + 21, h1 - 13], box: [-5, 0, -1, 5, 2, 1], paint: (g) => { bx(g, -5, 4, 0, 1, -1, 0, 0xe9e6dc); bx(g, -5, 4, 0, 0, -1, -1, 0x9a9fa6); } },
    lamp('nvM', cubes(-1, 0, top + 15, top + 15, h1 - 15), WHITE_L), lamp('nvA', cubes(-1, 0, csDeck(110) + 27, csDeck(110) + 27, 110), WHITE_L),
    lamp('nvP', cubes(B - 1, B - 1, top - LV + 5, top - LV + 5, h1 - 3), RED_L), lamp('nvS', cubes(-B, -B, top - LV + 5, top - LV + 5, h1 - 3), GREEN_L),
  ];
  // the boxes that can go over the side: one on top of each bay, and two on the second bay, the low side's first
  const loose = [[0, 1], [1, lowS > 0 ? 0 : 2], [2, 1], [3, 1], [1, lowS > 0 ? 2 : 0]];
  loose.forEach(([b, c], n) => { const lv = Math.max(...high[b]); parts.push(container('c' + (n + 1), cols[c], j0 + lv * 16, bays[b], boxCol(b, c, 5), seed + 40 + n)); });
  return parts;
}

// =====================================================================================================================
// The river pleasure boat: a long, low wooden boat for dinner parties on the river, 136 cubes long (k = -68..67), 32
// in the beam. A dark plank hull with an upswept bow, a long cabin of wooden posts and paper screens (some slid open,
// with low tables and cushions on straw mats inside) under a tiled roof, and a row of red paper lanterns along each
// eave that light under way.
// =====================================================================================================================
export const ROOF_PAINT = { green: 0x3f7a5a, red: 0xa5402f, slate: 0x4a5a6a };
const PB = { k0: -68, k1: 67, B: 16, D: 4 };
const pbPlan = (k) => (k > 30 ? 1 - Math.pow((k - 30) / 39, 2.2) : k < -56 ? 0.78 + 0.22 * Math.sqrt(Math.max(0, 1 - Math.pow((-56 - k) / 12, 2))) : 1);
const pbDeck = (k) => 3 + (k > 34 ? rnd(6 * Math.pow((k - 34) / 33, 2)) : k < -58 ? rnd(2 * (-58 - k) / 10) : 0);
const pbKeel = (k) => -PB.D + (k > 40 ? rnd(5 * Math.pow((k - 40) / 27, 2)) : k < -58 ? rnd(3 * (-58 - k) / 10) : 0);
const pbHalf = (k, j) => Math.max(1, rnd(PB.B * pbPlan(k) * (j >= 0 ? 1 : 1 - 0.35 * Math.pow(-j / PB.D, 1.5))));
const PLANK = 0x4a3222, PLANK2 = 0x5c3f2a, PAPER = 0xf2ead2, PAPER2 = 0xe2d8b8, MAT = 0xb9b06a, MAT2 = 0xa59c58, LACQ = 0x8a1f1a, CUSH = 0x3d3a78;

function pleasureParts(o) {
  const seed = o.seed || 0, tile = ROOF_PAINT[o.paint] ?? ROOF_PAINT.green, { k0, k1 } = PB, c0 = -42, c1 = 30, CW = 13;
  const roofAt = (a) => (a <= 2 ? 19 : a <= 6 ? 18 : a <= 10 ? 17 : a <= 13 ? 16 : 15);       // the roof curves down to eaves that overhang the walls
  const bulbs = []; for (const s of SIDES) for (let k = c0 + 1; k <= c1 - 1; k += 6) { bulbs.push([sx(s, 15), 13, k]); bulbs.push([sx(s, 15), 12, k]); }
  return [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-18, -5, k0 - 4, 18, 34, k1 + 2], paint: (g) => {
      const set = (i, j, k, c) => g.set(i, j, k, c);
      // ---- the hull: dark planks, a paler strake along the top, a straw-mat floor in the cabin ----
      hull(g, { k0, k1, halfAt: pbHalf, deckAt: pbDeck, keelAt: pbKeel, paint: (i, j, k, where) => {
        if (where === 'deck') return k >= c0 && k <= c1 && half(i) < CW ? (mod(k - c0, 12) === 0 || mod(i + 16, 8) === 0 ? MAT2 : MAT) : tone(mod(i, 3) === 0 ? WOOD2 : WOOD, 0.94 + 0.12 * hash(i, 2, k >> 2, seed));
        return j === pbDeck(k) ? WOOD : tone(mod(j + 8, 2) ? PLANK : PLANK2, 0.92 + 0.16 * hash(i >> 1, j, k >> 3, seed));
      } });
      // ---- the cabin: posts, a low wooden panel, paper screens above; every third screen is slid open ----
      for (let k = c0; k <= c1; k++) for (let i = -CW; i < CW; i++) {
        const a = half(i), side = a === CW - 1, end = k === c0 || k === c1; if (!side && !end) continue;
        const q = side ? k - c0 : i + CW, post = (side && end) || mod(q, 6) === 0, open = side ? mod(fl(q / 6) + seed, 3) === 1 : a <= 2;
        for (let j = 4; j <= 14; j++) {
          let c = post || j === 14 ? WOOD2 : j <= 6 ? WOOD : open ? -1 : (mod(q, 6) === 3 || j === 10 ? PAPER2 : PAPER);
          if (end && a <= 2 && j <= 12) c = -1;                                              // a doorway at each end
          if (c >= 0) set(i, j, k, c);
        }
      }
      // the roof: tiles in rows, a darker ridge and edge
      for (let k = c0 - 2; k <= c1 + 2; k++) for (let i = -16; i <= 15; i++) { const a = half(i), j = roofAt(a), gable = k === c0 - 2 || k === c1 + 2; set(i, j, k, a <= 1 || a === 15 || gable ? tone(tile, 0.72) : mod(k, 3) === 0 ? tone(tile, 0.86) : tile); if (a <= 13 && roofAt(a + 1) < j) set(i, j - 1, k, tone(tile, 0.8)); }
      for (const k of [c0, c1]) for (let i = -CW + 1; i < CW - 1; i++) for (let j = 15; j < roofAt(half(i)); j++) set(i, j, k, PAPER);   // the gable ends
      // inside: low red tables down the middle, a cushion either side of each
      for (let k = c0 + 5; k + 5 <= c1 - 4; k += 11) { bx(g, -3, 2, 5, 5, k, k + 5, LACQ); for (const kk of [k, k + 5]) for (const i of [-3, 2]) set(i, 4, kk, tone(LACQ, 0.7)); for (const s of SIDES) for (const kk of [k, k + 4]) bxs(g, s, 5, 7, 4, 4, kk, kk + 1, (i, j, k2) => (mod(kk + (s > 0 ? 0 : 1), 2) ? CUSH : 0x7a3a5a)); }
      // ---- the foredeck: a low rail, a stem post; the after deck: the helmsman's bench, a lantern on a post ----
      rails(g, pbHalf, pbDeck, c1 + 4, 56, k0, k1, WOOD2, 0xb8372b); rails(g, pbHalf, pbDeck, k0, c0 - 4, k0, k1, WOOD2, 0xb8372b);
      bx(g, -1, 0, pbDeck(66) + 1, pbDeck(66) + 6, 65, 66, PLANK); bx(g, -1, 0, pbDeck(66) + 7, pbDeck(66) + 7, 65, 66, 0xd9a520);
      bx(g, -5, 4, 4, 6, -60, -58, WOOD2); bx(g, -1, 0, 4, 9, -55, -55, 0x33363c); bx(g, -1, 0, 9, 9, -57, -55, WOOD);                       // bench, and the tiller on its post
      bx(g, -1, 0, pbDeck(-66) + 1, pbDeck(-66) + 13, -66, -66, WOOD2); bx(g, -2, 1, pbDeck(-66) + 14, pbDeck(-66) + 14, -67, -66, WOOD2);
      for (const s of SIDES) bxs(g, s, 15, 15, 14, 14, c0 - 1, c1 + 1, WOOD2);                 // the rail the lanterns hang from
    } },
    lamp('nvA', cubes(-1, 0, pbDeck(-66) + 11, pbDeck(-66) + 13, -67), WHITE_L), lamp('nvP', cubes(CW, CW, 15, 15, c1 + 2), RED_L), lamp('nvS', cubes(-CW - 1, -CW - 1, 15, 15, c1 + 2), GREEN_L),
    lamp('fest', bulbs, 0xff6a3c | GLOW), lamp('festOff', bulbs, 0xb8372b),
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
    for (const [, fz, t0] of cr) { const a = ease(clamp((u.t - t0) / 6)), amid = ab(fz) < cfg.len * 0.16; down += (amid ? 3 : 1.6) * a; if (amid) lean += 0.12 * a; else tip += (fz > 0 ? 1 : -1) * (cfg.tip || 0.075) * a; }   // a hit amidships floods it fastest
    const sd = -lowSide(u);
    const tm = (cfg.tip || 0.075) * 2.1; return [clamp(tip, -tm, tm), 0, sd * Math.min(cfg.lean || 0.3, lean), 0, -dunk(u) - Math.min(cfg.sink, down), 0];
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
        const ex = low * ([14, 23.5, 15, 25, 35][n - 1] + (cfg.drift || 0)) + (low > 0 ? -7 : 0), ey = -5.4 - (n & 1) + 0.18 * S(wob), roll = low * (0.2 + 0.11 * n) + 0.05 * S(wob * 0.8);
        const wx = sx0 + (ex - sx0) * e, wy = sy0 + (ey - sy0) * e + 3.2 * S(PI * clamp(b * 1.7)) * (1 - e), dy = wy + drop;
        P['c' + n] = [0.07 * e * S(wob * 0.7), (n & 1 ? 0.3 : -0.22) * e, (roll - th) * e, wx * ct + dy * st - r[0], -wx * st + dy * ct - r[1], [-3, -4.5, 3, 4.5, 0][n - 1] * e];
      }
      // aircraft on deck roll to the low side, go over the edge one after another and sink
      (cfg.planes || []).forEach((name, n) => {
        const r = u.rest[name] && u.rest[name].pos, b = clamp((t - 1.5 - n * 0.75) / 3.6); if (!r || b <= 0) return;
        const s1 = clamp(b / 0.62), s2 = clamp((b - 0.62) / 0.38), go = low * (cfg.edge + 3) - r[0];
        P[name] = [0, 0.25 * s1 * (n & 1 ? 1 : -1), -low * 1.9 * s2 * s2, go * s1 * s1 + low * 7 * s2, -(r[1] + 9) * s2 * s2, 0, s2 >= 1 ? 0 : 1];
      });
      // her funnels come down across the low side, one after another
      (cfg.topple || []).forEach((name, n) => { const b = clamp((t - 1.6 - n * 1.2) / 1.5), ang = 1.38 * b * b - 0.07 * S(clamp((t - 3.1 - n * 1.2) / 0.5) * PI); P[name] = [0, 0, -low * ang, low * 1.5 * b, -1.2 * b * b, 0]; });
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
export const LINER = {
  kind: 'boat', h: H, parts: linerParts, start: 'Moored', dieAt: 0.08, inner: INNER, onKill,
  clips: boatClips({ len: 368, speed: 7, lively: 0.22, sink: 7.5, trim: 0.016, list: 0.17, tip: 0.02, lean: 0.2, topple: ['f1', 'f2', 'f3'], lamps: { on: { fest: SHOW, festOff: OFF }, off: { fest: OFF, festOff: SHOW } } }),
  // the blast starts in the boiler rooms, under the middle funnel. stacks: where her smoke comes out, in town voxels.
  wk: boatWk({ beam: 12, wrecks: ['WreckSink'], seat: () => [0, 26, -6], R: 42, soot: 100, max: 1700, boom: 12, fires: 46, fireSize: 2.1, spread: 80, fireStride: 150, sootMin: 0.1, pack: true, floor: 18, fallen: /^f\d/, adrift: /^(c|f)\d/,
    lamps: /^(nv|sl|fest$)/, loose: /^(nv|sl|radar|fest)/, stacks: FUNNELS.map((kc) => [0, 51.5, (kc - 4) * 0.5]) }),
};
export const CARRIER = {
  kind: 'boat', h: H, parts: carrierParts, start: 'Moored', dieAt: 0.08, inner: INNER, onKill,
  clips: boatClips({ len: 368, speed: 8, lively: 0.15, sink: 8, trim: 0.012, list: 0.21, tip: 0.02, lean: 0.2, edge: 22, planes: DECK_JETS.map((q, n) => 'p' + (n + 1)), lamps: { on: { fest: SHOW, festOff: OFF }, off: { fest: OFF, festOff: SHOW } } }),
  // the blast starts in the hangar, under the island
  wk: boatWk({ beam: 15, wrecks: ['WreckSink'], seat: () => [-6, 24, 14], R: 40, soot: 74, char: 0.05, max: 1800, boom: 13, fires: 46, fireSize: 2.1, spread: 80, fireStride: 150, sootMin: 0.1, pack: true, floor: 20,
    adrift: /^p\d/, parked: /^p\d/, plop: { pre: 'p', n: DECK_JETS.length, t0: 3.9, dt: 0.75, size: 170 }, lamps: /^(nv|sl|fest$)/, loose: /^(nv|sl|radar|fest)/, stacks: [[-14.5, 36.5, -1]] }),
};
export const CONTAINER_SHIP = {
  kind: 'boat', h: H, parts: shipParts, start: 'Moored', dieAt: 0.08, inner: INNER, onKill,
  clips: boatClips({ len: 304, speed: 7, lively: 0.18, sink: 7, trim: 0.014, list: 0.18, tip: 0.025, lean: 0.2, drift: 5 }),
  // the blast starts in the engine room, under the house
  wk: boatWk({ beam: 12, wrecks: ['WreckSink'], seat: () => [0, 8, -122], R: 40, soot: 84, char: 0.06, max: 1700, boom: 12, fires: 44, fireSize: 2, spread: 80, fireStride: 150, sootMin: 0.1, pack: true, floor: 12, stacks: [[0, 42, -69]] }),
};
export const PLEASURE_BOAT = {
  kind: 'boat', h: H, parts: pleasureParts, start: 'Moored', dieAt: 0.08, inner: INNER, onKill,
  clips: boatClips({ len: 136, speed: 8, lively: 0.9, sink: 3.4, trim: 0.05, list: 0.28, turtle: 1.2, lamps: { on: { fest: SHOW, festOff: OFF }, off: { fest: OFF, festOff: SHOW } } }),
  // the blast starts at the engine, under the after deck
  wk: boatWk({ beam: 8, wrecks: ['WreckSink', 'WreckTurtle'], seat: () => [0, 4, -50], R: 20, soot: 40, fireSize: 1.1, lamps: /^(nv|sl|fest$)/, loose: /^(nv|sl|radar|fest)/, base: (sg) => (sg > 0 ? 0 : -3) }),
};
