// Trains, built in code at eighth-metre cubes on the same kit as the cars, buses and the army's vehicles: an express train
// (a 14 m nose car and a 12 m middle car) and a commuter train (a 12 m cab car and a 12 m middle car).
//
// Every car is a unit of its own, so a train of any length is coupled from them: nose, middle cars, and a nose car
// turned round with `rear: true` (its lamps show red). Cars stand two cubes apart, bellows to bellows. Forward is +z,
// left is +x, and y = 0 is the top of the rail. Both are 22 cubes wide on a 12-cube gauge (wheels at 6 and 7 cubes out).
//
// They are modelled inside: rows of seats and luggage racks in the express train, long benches, poles and hanging
// straps in the commuter train, a driver's place in each cab, bogies with a frame, axles and eight wheels that turn.
//
// They break with the cars' own code (blowUp, crush, fireSpots in cars.js), set up by `wk` on each definition, like
// the buses: a foot flattens only the part of a car it lands on, and the car can be stepped on again somewhere else.
import { GLOW, hash, tone } from '../../units/src/voxpart.js';
import { blowUp, H, bx, bxs, sx, SIDES, half, clamp, ease, spring, sideOf, TRIM, BLACK, GLASS, GLASS2, SHINE, DASH, LENS, INNER } from './cars.js';
import { lamp, led } from './buses.js';

const S = Math.sin, C = Math.cos, PI = Math.PI, ab = Math.abs, fl = Math.floor;
const mod = (a, n) => ((a % n) + n) % n;
const LAMP = 0xfff3c4 | GLOW, TAIL = 0xff3826 | GLOW, LIGHT = 0xfff6da | GLOW, LED = 0xffb428 | GLOW;
const FRAME = 0x4b4f57, FRAME2 = 0x2e3035, AXLE = 0x60646c, RUBBER = 0x2a2c30, COUPLER = 0x777b83;
const glass = (j, k, hi) => (mod(k + j, 23) === 0 && j >= hi - 3 ? SHINE : j >= hi ? GLASS2 : GLASS);
const screen = (i, j, hi) => (mod(i + j + 3, 19) === 0 && j >= hi - 4 ? SHINE : j >= hi ? GLASS2 : GLASS);
const mirrored = (list) => list.map(([i, j, k]) => [-1 - i, j, k]);
const inAny = (k, list, w) => list.some((a) => k >= a && k < a + w);

const NEAR = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) if (ab(a) + ab(b) + ab(c) === 1 || ab(a) + ab(b) + ab(c) === 2) NEAR.push([a, b, c]);
// paint the skin of a solid: every cube of it that has an empty neighbour, in the colour `skin` gives (-1 leaves a hole)
function shell(g, [i0, j0, k0, i1, j1, k1], solid, skin) {
  for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (!solid(i, j, k)) continue;
    // (the cubes on a slope's inner corners count too, so a stepped skin is joined face to face)
    let inside = true; for (const [a, b, c] of NEAR) if (!solid(i + a, j + b, k + c)) { inside = false; break; }
    if (inside) continue;
    const c = skin(i, j, k); if (c >= 0) g.set(i, j, k, c);
  }
}

// a steel wheel: an eight-sided disc seven cubes across and two thick, with a bright tread
const railWheel = (name, s, kc) => ({ name, parent: 'body', pivot: [s * 7, 3.5, kc + 0.5], box: s > 0 ? [-1, -3.5, -3.5, 1, 3.5, 3.5] : [-1, -3.5, -3.5, 1, 3.5, 3.5], paint: (g) => g.fill((x, y, z) => {
  const ay = ab(y), az = ab(z), m = Math.max(ay, az); if (ay + az >= 5) return -1;
  if (m === 3 || (ay === 2 && az === 2)) return x * s < 0 ? 0x8d9199 : 0xb9bdc4;
  return m === 0 ? 0x33363b : m === 1 ? 0x6b6f77 : 0x565a62;
}) });
// a bogie under the body at kb: side frames, a bolster up to the floor, two axles. Its four wheels are parts.
function bogie(g, kb) {
  for (const s of SIDES) { bxs(g, s, 8, 9, 3, 4, kb - 8, kb + 8, FRAME); for (const kc of [kb - 5, kb + 5]) { bxs(g, s, 9, 9, 2, 4, kc - 1, kc + 1, FRAME2); g.set(sx(s, 9), 3, kc, 0xd6b23a); } bxs(g, s, 8, 9, 5, 5, kb - 1, kb + 1, RUBBER); }
  bx(g, -9, 8, 4, 4, kb - 1, kb, FRAME); bx(g, -4, 3, 3, 5, kb - 2, kb + 2, 0x44474d); bx(g, -1, 0, 4, 4, kb - 5, kb + 5, FRAME);
  for (const kc of [kb - 5, kb + 5]) bx(g, -6, 5, 3, 3, kc, kc, AXLE);
}
const wheels = (kbF, kbR) => [['wFa', kbF + 5], ['wFb', kbF - 5], ['wRa', kbR + 5], ['wRb', kbR - 5]].flatMap(([n, kc]) => [railWheel(n + 'L', 1, kc), railWheel(n + 'R', -1, kc)]);
// the rubber bellows and the coupler on a car's end at k (dir: which way it faces)
function bellows(g, k, dir) {
  for (let j = 7; j <= 21; j++) for (let i = -5; i <= 4; i++) if (half(i) >= 3 || j === 7 || j === 21) g.set(i, j, k + dir, RUBBER);
  bx(g, -1, 0, 3, 5, Math.min(k, k - dir * 2), Math.max(k, k - dir * 2), FRAME2); bx(g, -1, 0, 3, 4, k + dir, k + dir, COUPLER);   // the draft gear under the floor, and the coupler on it
}
// a single-arm pantograph on the roof, as a part of its own (it is thrown off when the car is wrecked)
function panto(k, j0) {
  const ST = 0x6f747c, HD = 0x34373c, INS = 0xe9e6dc;
  return { name: 'panto', parent: 'body', pivot: [0, j0, k], box: [-7, 0, -1, 7, 13, 11], paint: (g) => {
    bx(g, -2, 1, 0, 0, 0, 5, HD); for (const i of [-3, 2]) for (const kk of [0, 5]) g.set(i, 0, kk, INS);
    for (let n = 0; n <= 8; n++) { const j = 1 + Math.round(n * 5 / 8); bx(g, -1, 0, j, j + 1, 1 + n, 1 + n, ST); }
    for (let n = 0; n <= 5; n++) { const j = 7 + Math.round(n * 4 / 5); bx(g, -1, 0, j, j + 1, 9 - n, 9 - n, ST); }
    bx(g, -7, 6, 12, 12, 3, 4, HD); for (const i of [-7, 6]) bx(g, i, i, 11, 11, 3, 4, HD);
  } };
}

// =====================================================================================================================
// The express train, with the round nose of the first bullet trains, so it can run in any city. 22 cubes wide
// (i = -11..10), the body from the belly at j = 2 to the roof at j = 24.
// The nose car is 112 long (k = -56..55) with a 26-cube nose; the middle car is 96 long (k = -48..47).
// =====================================================================================================================
export const EXPRESS_PAINT = { blue: 0x1f4fa8, green: 0x1d8a5a, red: 0xc8324a, gold: 0xc9972c };
const BW = (j) => (j < 2 || j > 24 ? 0 : j === 2 ? 10 : j <= 21 ? 11 : j === 22 ? 10 : j === 23 ? 9 : 7);   // cubes each side of the middle, at height j
const NL = 26;
// the top of the nose, t cubes back from its tip: a round hood, then a raked windscreen up to the roof
const noseTop = (t) => (t >= NL ? 24 : t < 8 ? Math.round(5 + 9 * Math.sqrt(1 - Math.pow(1 - (t + 0.5) / 8.5, 2))) : Math.min(24, Math.round(14 + (t - 7.5) * 0.74)));
// The nose is the classic one: short and round like the end of a bullet, seen from above and from the side.
const NOSE = new Map();
function noseW(j, t) {
  if (t < 0) return 0; if (t >= NL) return BW(j);
  const key = j * 64 + t; let v = NOSE.get(key); if (v === undefined) NOSE.set(key, v = noseW0(j, t)); return v;
}
function noseW0(j, t) {
  const s = (t + 0.5) / NL, jt = noseTop(t), j0 = t < 5 ? 2 + Math.round((5 - t) * 0.6) : 2;
  if (j < j0 || j > jt) return 0;
  const hw = 11 * Math.pow(1 - Math.pow(1 - Math.min(1, (t + 0.5) / 16), 2.2), 1 / 2.2), u = (j - j0 + 0.5) / (jt - j0 + 1), p = 2.4 + 5 * s * s;
  const raw = hw * Math.pow(Math.max(0, 1 - Math.pow(ab(2 * u - 0.85) / 1.15, p)), 1 / p), b = ease(clamp((s - 0.72) / 0.28));
  return Math.max(1, Math.round(raw + (BW(j) - raw) * b));
}
const WHITE = 0xf1f1ec, SKIRT = 0xc9ccd2, BELLY = 0x8f939b, ROOF = 0xdcdde0, SEAT = 0x3b5fa8, SEAT2 = 0x33528f, CLOTH = 0xf4f2ea, FLOOR = 0x5f6878, AISLE = 0x8d93a0, WALL = 0xd8d4c6;

function expressParts(o) {
  const nose = o.type !== 'mid', seed = o.seed || 0, stripe = EXPRESS_PAINT[o.paint] ?? EXPRESS_PAINT.blue;
  const k0 = nose ? -56 : -48, k1 = nose ? 55 : 47, kbF = nose ? 20 : 29, kbR = nose ? -38 : -30;
  const doors = nose ? [-52] : [-45, 38], DW = 7;                 // where each plug door starts
  const sal0 = nose ? -43 : -36, sal1 = nose ? 26 : 35;           // the saloon, between its bulkheads
  const W = (j, k) => (nose ? noseW(j, k1 - k) : BW(j));
  const well = (a, j, k) => [kbF, kbR].some((kb) => ab(k - kb) <= 9) && ((a <= 9 && j <= 5) || (a === 10 && j <= 4));
  // two big headlamps set into the front of the hood, each three cubes square
  let tEye = 0; if (nose) while ([8, 9, 10].some((j) => noseW(j, tEye) < 8)) tEye++;
  const eyes = nose ? [4, 5, 6].flatMap((a) => [8, 9, 10].map((j) => [a, j, k1 - tEye])) : [];
  const socket = (a, j, k) => nose && k1 - k < tEye && a >= 4 && a <= 6 && j >= 8 && j <= 10;
  const solid = (i, j, k) => k >= k0 && k <= k1 && half(i) < W(j, k) && !well(half(i), j, k) && !socket(half(i), j, k);
  const eye = new Set([...eyes, ...mirrored(eyes)].map((q) => q.join()));
  const skin = (i, j, k) => {
    const a = half(i), t = k1 - k, w = W(j, k), flank = a === w - 1, inNose = nose && t < NL;
    if (k === k0 || (!nose && k === k1)) return a <= 2 && j >= 8 && j <= 19 ? BLACK : j <= 6 ? SKIRT : a === 3 && j <= 20 ? tone(WHITE, 0.8) : WHITE;   // the end wall and its gangway
    if ([kbF, kbR].some((kb) => ab(k - kb) <= 10) && j <= 6 && a <= 9) return BLACK;                                // inside a bogie well
    if (eye.has([i, j, k].join())) return LENS;
    if (inNose) {
      if (t >= 9 && t <= 20 && j >= 15 && j >= noseTop(t) - 3 && a < w - 2) return i === 0 || i === -1 ? WHITE : screen(i, j, noseTop(t) - 1);   // the windscreen, in two panes
      if (t >= 17 && t <= 23 && j >= 16 && j <= 19 && flank) return glass(j, k, 18);                                // the cab's side window
      if (t <= 1 && a <= 2) return a === 2 || j === noseTop(t) ? 0x9da1a8 : 0xc4c7cc;                              // the round cover over the coupler
    }
    if (flank && j >= 7 && j <= 21 && inAny(k, doors, DW)) return -1;                                               // a doorway: the door is a part
    if (flank && j >= 14 && j <= 18 && k > sal0 && k < sal1 - 1 && mod(k - sal0 - 2, 8) < 5) return glass(j, k, 17);
    if ((j === 11 || j === 12) && a >= w - 2) return stripe;
    if (j === 2) return BELLY; if (j <= 6 && !inNose) return j <= 3 ? tone(SKIRT, 0.86) : SKIRT;
    if (inNose && j <= 3) return BELLY;
    if (j >= 23 && !inNose) return mod(k, 12) === 0 ? tone(ROOF, 0.9) : ROOF;
    return WHITE;
  };
  const doorSkin = (j, q) => (q === 0 || q === DW - 1 ? tone(WHITE, 0.84) : j >= 15 && j <= 18 && q >= 2 && q <= 4 ? glass(j, q, 17) : j === 11 || j === 12 ? stripe : j === 7 ? TRIM : WHITE);
  const plug = (name, s, ka) => ({ name, parent: 'body', pivot: [sx(s, 10), 7, ka], box: [0, 0, 0, 1, 15, DW], paint: (g) => { for (let q = 0; q < DW; q++) for (let j = 0; j < 15; j++) g.set(0, j, q, doorSkin(j + 7, q)); } });

  const parts = [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-13, 0, k0 - 2, 13, 29, k1 + 3], paint: (g) => {
      const set = (i, j, k, c) => g.set(i, j, k, c);
      shell(g, [-11, 2, k0, 10, 24, k1], solid, skin);
      for (const [i, j, k] of [...eyes, ...mirrored(eyes)]) set(i, j, k, LENS);
      // ---- the floor, the bulkheads at the vestibules, the strip of lights ----
      const fEnd = nose ? 45 : k1 - 1;
      for (let k = k0 + 1; k <= fEnd; k++) for (let i = -10; i <= 9; i++) if (half(i) < W(7, k) - 1) set(i, 7, k, half(i) <= 1 ? AISLE : FLOOR);
      for (const kw of nose ? [sal0 - 1, sal1 + 1] : [sal0 - 1, sal1 + 1]) for (let j = 8; j <= 23; j++) for (let i = -10; i <= 9; i++) {
        const a = half(i); if (a >= W(j, kw) - 1 || (a <= 2 && j <= 19)) continue; set(i, j, kw, a === 3 && j <= 20 ? TRIM : WALL);
      }
      bx(g, -1, 0, 23, 23, sal0, sal1, LIGHT);
      // ---- rows of seats, two and two, facing forward, with a white cloth over each headrest ----
      for (let k = sal0 + 2; k + 3 <= sal1 - 1; k += 7) for (const s of SIDES) {
        bxs(g, s, 2, 9, 8, 9, k + 1, k + 3, (i, j) => (half(i) === 5 || half(i) === 6 ? SEAT2 : j === 9 ? SEAT : SEAT2));
        bxs(g, s, 2, 9, 8, 15, k, k, (i, j) => (j >= 14 ? CLOTH : half(i) === 5 || half(i) === 6 ? SEAT2 : SEAT));
      }
      for (const s of SIDES) bxs(g, s, 8, 9, 20, 20, sal0, sal1, 0xc9ccd0);                        // luggage racks
      // ---- under the floor: the bogies in their wells ----
      bogie(g, kbF); bogie(g, kbR);
      // ---- the roof: air conditioning under long covers ----
      for (const [ka, kb] of nose ? [[-38, -18]] : [[-40, -24], [18, 38]]) bx(g, -5, 4, 25, 25, ka, kb, (i, j, k) => (k === ka || k === kb || i === -5 || i === 4 ? 0xaeb2b8 : 0xc4c7cc));
      bellows(g, k0, -1);
      if (nose) {
        // ---- the driver's place: a desk under the windscreen, a seat in the middle ----
        bx(g, -7, 6, 8, 11, 42, 44, DASH); bx(g, -5, 4, 12, 12, 43, 44, 0x2b2d31); for (const i of [-4, -1, 2]) set(i, 12, 42, 0x7fd0a0);
        bx(g, -3, 2, 8, 9, 35, 38, SEAT2); bx(g, -3, 2, 8, 15, 34, 34, SEAT);
        bx(g, -1, 0, 25, 26, -8, -5, 0xe6e4dc);                                                   // an aerial fin
        bx(g, -1, 0, 1, 3, k1 - 7, k1 - 5, COUPLER); for (let t = 4; t <= 13; t++) for (let i = -fl(noseW(2, t) * 0.8); i < fl(noseW(2, t) * 0.8); i++) set(i, 1, k1 - t, 0x3a3d43);   // the plough under the nose
      } else {
        bellows(g, k1, 1);
        for (const s of SIDES) bxs(g, s, 8, 8, 24, 27, -14, 8, (i, j, k) => (j === 27 || k === -14 || k === 8 ? 0xd3d5d9 : WHITE));   // the shields either side of the pantograph
      }
    } },
    ...doors.flatMap((ka, n) => SIDES.map((s) => plug('d' + 'AB'[n] + (s > 0 ? 'L' : 'R'), s, ka))),
    ...wheels(kbF, kbR),
  ];
  if (nose) parts.push(lamp('hlL', eyes, LAMP), lamp('hlR', mirrored(eyes), LAMP), lamp('tlL', eyes, TAIL), lamp('tlR', mirrored(eyes), TAIL));
  else parts.push(panto(-6, 25));
  return parts;
}

// =====================================================================================================================
// The commuter train. 22 cubes wide, a plain box from the underframe at j = 6 to the roof at j = 24, 96 long
// (k = -48..47), three double doors a side. The cab car has its cab at the +z end.
// =====================================================================================================================
export const LINE_PAINT = { green: 0x7fbf3f, orange: 0xe8742a, blue: 0x2a8fd0, yellow: 0xf2c230 };
const CW = (j) => (j < 6 || j > 24 ? 0 : j <= 22 ? 11 : j === 23 ? 10 : 8);
const STEELB = 0xc5c9ce, CROOF = 0xb4b8be, CFLOOR = 0xb8b09c, CAISLE = 0xa39b88, BENCH = 0x4f8a4a, BENCH2 = 0x437741, PRIO = 0xb5483f, POLE = 0xd9dce0;

function commuterParts(o) {
  const cab = o.type !== 'mid', seed = o.seed || 0, line = LINE_PAINT[o.paint] ?? LINE_PAINT.green;
  const k0 = -48, k1 = 47, kbF = 29, kbR = -30, DW = 10;
  const doors = cab ? [-37, -8, 19] : [-37, -5, 27];                                              // where each double door starts
  const wins = cab ? [[-26, -10], [3, 17], [-45, -40]] : [[-26, -7], [6, 25], [-45, -40], [39, 44]];
  const solid = (i, j, k) => k >= k0 && k <= k1 && half(i) < CW(j);
  const front = (i, j) => {
    const a = half(i);
    if (j <= 7) return 0x3c3f45;
    if (j <= 9 && a >= 6 && a <= 8) return LENS;
    if (j <= 11) return a === 10 ? STEELB : line;
    if (j >= 23) return CROOF;
    if (a === 10) return STEELB;
    if (j >= 20 && j <= 22 && a <= 6) return led(i + 7, 22 - j, seed) ? LED : BLACK;
    if (j >= 13 && j <= 19 && a <= 8) return i === 3 ? BLACK : screen(i, j, 18);
    return BLACK;
  };
  const skin = (i, j, k) => {
    const a = half(i);
    if (cab && k === k1) return front(i, j);
    if (k === k0 || k === k1) return a <= 2 && j >= 8 && j <= 19 ? BLACK : a === 3 && j >= 7 && j <= 20 ? tone(STEELB, 0.8) : j === 6 ? FRAME : STEELB;
    if (j === 6) return FRAME;
    if (a === 10 && j <= 22) {
      if (j >= 7 && j <= 21 && inAny(k, doors, DW)) return -1;                                    // a doorway: its two leaves are parts
      if (j >= 13 && j <= 19) {
        if (cab && k >= 40 && k <= 45) return glass(j, k, 18);                                    // the cab's side window
        if (cab && j >= 14 && j <= 18 && k >= 35 && k <= 36) return glass(j, k, 17);
        for (const [wa, wb] of wins) if (k >= wa && k <= wb) return wb - wa > 8 && k === (wa + wb + 1 >> 1) ? TRIM : glass(j, k, 18);
      }
      if (cab && (k === 32 || k === 39) && j >= 7 && j <= 21) return tone(STEELB, 0.78);          // the seam of the cab door
      if (j === 10 || j === 11 || j === 22) return line;
      return j === 8 || j === 21 ? tone(STEELB, 0.9) : STEELB;
    }
    return mod(k, 6) === 0 ? tone(CROOF, 0.9) : CROOF;
  };
  const leafSkin = (j, q, meet) => (q === meet ? RUBBER : j >= 13 && j <= 19 && q >= 1 && q <= 3 ? glass(j, q, 18) : j === 10 || j === 11 ? line : j === 7 ? TRIM : tone(STEELB, 0.95));
  const leaf = (name, s, ka, meet) => ({ name, parent: 'body', pivot: [sx(s, 10), 7, ka], box: [0, 0, 0, 1, 15, 5], paint: (g) => { for (let q = 0; q < 5; q++) for (let j = 0; j < 15; j++) g.set(0, j, q, leafSkin(j + 7, q, meet)); } });

  const parts = [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-13, 0, k0 - 2, 13, 28, k1 + 4], paint: (g) => {
      const set = (i, j, k, c) => g.set(i, j, k, c);
      shell(g, [-11, 6, k0, 10, 24, k1], solid, skin);
      const sal1 = cab ? 29 : k1 - 1;
      bx(g, -10, 9, 7, 7, k0 + 1, k1 - 1, (i) => (half(i) <= 2 ? CAISLE : CFLOOR));
      bx(g, -1, 0, 23, 23, k0 + 2, sal1 - 1, LIGHT);
      // ---- long benches under the windows, a panel and a pole at each door, racks over the benches ----
      for (const [wa, wb] of wins) {
        const end = wb - wa <= 8, ka = end ? (wa < 0 ? k0 + 1 : wa - 1) : wa - 1, kb = end ? (wa < 0 ? wb + 1 : k1 - 1) : wb + 1, cloth = end ? PRIO : BENCH;
        for (const s of SIDES) {
          bxs(g, s, 6, 8, 8, 9, ka, kb, (i, j, k) => (j === 9 ? (mod(k - ka, 4) === 3 ? tone(cloth, 0.86) : cloth) : BENCH2));
          bxs(g, s, 9, 9, 8, 12, ka, kb, (i, j) => (j >= 10 ? cloth : BENCH2));
          bxs(g, s, 8, 9, 20, 20, ka, kb, POLE);
          for (const ke of [ka, kb]) { if (ke === k0 + 1 || ke === k1 - 1) continue; bxs(g, s, 6, 9, 10, 14, ke, ke, 0xaeb2b8); bxs(g, s, 6, 6, 8, 22, ke, ke, POLE); }
        }
      }
      // ---- the rails under the roof, with straps hanging from them ----
      for (const s of SIDES) { bxs(g, s, 5, 5, 22, 22, k0 + 3, sal1 - 2, POLE); for (let k = k0 + 5; k <= sal1 - 4; k += 3) { set(sx(s, 5), 21, k, 0x55585e); set(sx(s, 5), 20, k, 0xf0eee6); } }
      // ---- under the floor: equipment boxes between the bogies ----
      bogie(g, kbF); bogie(g, kbR);
      bx(g, -8, 7, 3, 5, -18, -10, (i, j, k) => (mod(k, 3) === 0 ? 0x3d4046 : 0x4d5057)); bx(g, -8, 7, 3, 5, -6, 6, (i, j, k) => (j === 4 && mod(k, 2) === 0 ? 0x6a6e76 : 0x585c64)); bx(g, -8, 7, 4, 5, 10, 17, 0x44474d);
      // ---- the roof: the air conditioner and two vents ----
      bx(g, -6, 5, 25, 26, -14, 12, (i, j, k) => (j === 26 && half(i) <= 3 && mod(k + 14, 9) >= 2 && mod(k + 14, 9) <= 6 ? 0x5d6168 : k === -14 || k === 12 ? 0x9a9ea5 : 0xaeb2b8));
      for (const kv of cab ? [24] : [24, 38]) bx(g, -3, 2, 25, 25, kv, kv + 5, 0x9a9ea5);
      bellows(g, k0, -1);
      if (cab) {
        // ---- the cab: a bulkhead with a window, the desk across the front, the driver's seat on the left ----
        for (let j = 8; j <= 22; j++) for (let i = -10; i <= 9; i++) { const a = half(i); set(i, j, 30, a <= 2 && j <= 19 ? 0x8f949b : j >= 14 && j <= 18 && a >= 4 && a <= 8 ? GLASS : 0xbfc3c8); }
        bx(g, -9, 8, 8, 11, k1 - 4, k1 - 2, DASH); bx(g, 2, 7, 12, 12, k1 - 3, k1 - 2, 0x2b2d31); for (const i of [3, 5]) set(i, 12, k1 - 4, 0x7fd0a0);
        bx(g, 3, 6, 8, 9, 37, 40, BENCH2); bx(g, 3, 6, 8, 14, 36, 36, 0x3a3d43);
        // the pilot under the front, the coupler, the wipers
        bx(g, -9, 8, 2, 5, k1 - 3, k1, (i, j) => (j === 2 ? 0x2e3035 : 0x3a3d43)); bx(g, -1, 0, 3, 4, k1 + 1, k1 + 2, COUPLER);
        for (const [i, j] of [[-6, 13], [-5, 14], [-4, 15], [5, 13], [6, 14], [7, 15]]) set(i, j, k1 + 1, TRIM);
        for (const s of SIDES) bxs(g, s, 3, 4, 8, 9, k1, k1, 0x7a2420);                           // the dull tail lamps
      } else bellows(g, k1, 1);
    } },
    ...doors.flatMap((ka, n) => SIDES.flatMap((s) => [leaf('d' + (n + 1) + 'a' + (s > 0 ? 'L' : 'R'), s, ka, 4), leaf('d' + (n + 1) + 'b' + (s > 0 ? 'L' : 'R'), s, ka + 5, -1)])),
    ...wheels(kbF, kbR),
  ];
  if (cab) {
    const head = [6, 7, 8].flatMap((a) => [8, 9].map((j) => [a, j, k1])), tail = [3, 4].flatMap((a) => [8, 9].map((j) => [a, j, k1]));
    parts.push(lamp('hlL', head, LAMP), lamp('hlR', mirrored(head), LAMP), lamp('tlL', tail, TAIL), lamp('tlR', mirrored(tail), TAIL));
  } else parts.push(panto(-42, 25));
  return parts;
}

// =====================================================================================================================
// Clips, shared by both trains.
// =====================================================================================================================
const ON = [0, 0, 0, 0, 0, 0, 1.1], OFF = [0, 0, 0, 0, 0, 0, 0], R_WHEEL = 3.5 * H, W = 5.5;
const WHEELS = ['wFa', 'wFb', 'wRa', 'wRb'].flatMap((n) => [n + 'L', n + 'R']);
const spin = (a) => Object.fromEntries(WHEELS.map((n) => [n, [a, 0, 0]]));
const dark = { hlL: OFF, hlR: OFF, tlL: OFF, tlR: OFF };
// which lamps a car shows when the train is moving: white on the leading car, red on the one turned round at the back
const lamps = (u) => (u.opts.rear ? { hlL: OFF, hlR: OFF, tlL: ON, tlR: ON } : { hlL: ON, hlR: ON, tlL: OFF, tlR: OFF });
const sideOfDoor = (n) => (n.endsWith('L') ? 1 : -1);

function trainClips(cfg) {
  const { doors } = cfg;   // doors: { name: which way it slides }
  const open = (a) => { const out = ease(clamp(a * 3)), run = ease(clamp(a * 1.5 - 0.3)), P = {}; for (const n in doors) P[n] = [0, 0, 0, cfg.out * sideOfDoor(n) * out * H, 0, doors[n] * cfg.run * run * H]; return P; };
  // blown out: the doors hang off, burst outwards
  const burst = (sp, e) => { const P = {}; for (const n in doors) { const s = sideOfDoor(n), w = hash(n.charCodeAt(1), n.charCodeAt(2), 3, 5); P[n] = [0.25 * w * e, 0.5 * s * doors[n] * sp * w, -0.2 * s * e, s * (0.6 + 1.2 * w) * sp * H, -0.6 * w * e, doors[n] * w * 0.8 * e]; } return P; };
  // the wheels under a part that has been stepped on lie splayed out from under it
  const splay = (u) => {
    const P = {}; if (!u.crushes) return P;
    for (const n of WHEELS) { const r = u.rest[n]; if (!r) continue; const s = r.pos[0] > 0 ? 1 : -1, kc = r.pos[2] / H; let e = 0; for (const [, fz, t0, flat] of u.crushes) if (flat && ab(kc - fz) < 24) e = Math.max(e, clamp((u.t - t0) / 0.1)); if (e > 0) P[n] = [0, 0.2 * s * e, -1.35 * s * e, 2.6 * s * e, -1.2 * e, 0]; }
    return P;
  };
  return {
    Parked: { loop: true, speed: 0, pose: () => ({ ...spin(0), ...dark }) },
    // standing at a platform with every door open
    Open: { loop: false, dur: 1.4, speed: 0, pose: (t) => ({ ...spin(0), ...dark, ...open(clamp(t / 1.3)) }) },
    Drive: { loop: true, speed: cfg.speed, pose: (t, u) => ({ ...spin((u.opts.rear ? -1 : 1) * t * cfg.speed / R_WHEEL), body: [0, 0, 0.004 * S(t * 2.3 + u.phase), 0, 0.02 * ab(S(t * 9 + u.phase)), 0], ...lamps(u) }) },
    // Blown up where it stands: it jumps, comes down off the rails onto the sleepers and leans. The doors burst out and
    // the pantograph is thrown clear.
    WreckStand: { loop: false, hidden: true, dur: 2, speed: 0, pose: (t, u) => {
      const sd = sideOf(u), e = ease(clamp(t / 0.5)), hop = Math.max(0, 7 * t - 24 * t * t), sp = spring(t), yaw = (hash(u.opts.seed || 0, 5, 1, 2) - 0.5) * 0.09;
      const a = clamp(t / 1.05), land = Math.max(0, t - 1.05), bounce = a >= 1 ? 0.5 * Math.exp(-land * 9) * ab(S(land * 18)) : 0;
      return { ...spin(0), ...dark, body: [0.008 * e, yaw * e, -0.075 * sd * e, 0.9 * sd * e, hop - 0.42 * e, 0], ...burst(sp, e),
        panto: [2 * PI * a, 0.7 * sd * a, 0, 10 * sd * a, 30 * a * (1 - a) - 12.4 * a + bounce, -3 * a], ...splay(u) };
    } },
    // Thrown off the track onto its side: it tips about the wheels on one side and comes down flat on the ballast.
    WreckSide: { loop: false, hidden: true, dur: 5, speed: 0, pose: (t, u) => {
      const sd = sideOf(u), T = 1.25, a = clamp(t / T), land = Math.max(0, t - T), ang = PI / 2 * (a * a * (1.6 - 0.6 * a)) - (a >= 1 ? 0.04 * Math.exp(-land * 6) * ab(S(land * 13)) : 0);
      const flop = t > 1 ? spring(t - 1, 3.5, 6) : 0, w = 7 / 1.4 * (1 - Math.exp(-1.4 * t)), yaw = (hash(u.opts.seed || 0, 5, 1, 2) - 0.5) * 0.14, P = {};
      for (const n in doors) if (sideOfDoor(n) * sd < 0) P[n] = [0, 0.5 * sideOfDoor(n) * doors[n] * flop, 0, sideOfDoor(n) * 0.5 * flop * H, 0, 0];   // the doors on the upper side spring open
      return { ...spin(w), ...dark, body: [0, yaw * ease(a), sd * ang, -sd * W * (1 - C(ang)), W * S(ang) + 2 * S(PI * a) * (1 - a) - 0.42 * ease(a), 0], ...P,
        panto: [0, 0, -sd * 0.5 * flop, 0, 0, 0] };
    } },
    // Stepped on: the body is pressed flat under the foot (crush in cars.js) and the wheels there splay out.
    Crushed: { loop: false, hidden: true, dur: 0.3, speed: 0, pose: (t, u) => ({ ...dark, ...splay(u) }) },
  };
}

const keep = (d, n) => { const k = 0.13 + 0.87 * ease(clamp((d - 12) / 15)); return k > 0.97 ? 1 : k + 0.07 * (n - 0.5); };
// the blast starts in the equipment under the floor, toward one end or the other
const trainWk = (o) => ({ wrecks: ['WreckSide', 'WreckStand'], seat: (u) => [0, 5, (u.opts.seed || 0) % 2 ? 12 : -12], R: 24, soot: 40, sootMin: 0.1, max: 900, push: 24, lamps: /^(hl|tl)/, loose: /^(hl|tl)/, mottle: 0.16, fireTop: 99, spread: 16, keep, dx: 0.4, recrush: true, boom: 6.8, fires: 28, ...o });
const onKill = (u, point, r, debris) => { if (u.crushes) for (const c of u.crushes) c[2] = -9; blowUp(u, debris, point); };

export const EXPRESS_TRAIN = {
  kind: 'train', h: H, parts: expressParts, start: 'Parked', dieAt: 0.1, inner: INNER, onKill,
  // each plug door slides along the body toward the middle of the car
  clips: trainClips({ speed: 64, out: 1.1, run: 7, doors: { dAL: 1, dAR: 1, dBL: -1, dBR: -1 } }),
  wk: trainWk(),
};
export const COMMUTER_TRAIN = {
  kind: 'train', h: H, parts: commuterParts, start: 'Parked', dieAt: 0.1, inner: INNER, onKill,
  // the two leaves of each door part and slide back inside the wall
  clips: trainClips({ speed: 30, out: -1, run: 5, doors: Object.fromEntries([1, 2, 3].flatMap((n) => ['L', 'R'].flatMap((s) => [['d' + n + 'a' + s, -1], ['d' + n + 'b' + s, 1]]))) }),
  wk: trainWk(),
};
