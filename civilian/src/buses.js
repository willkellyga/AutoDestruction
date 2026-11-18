// Buses, built in code at eighth-metre cubes on the same kit as the cars (cars.js) and the army's vehicles: a low-floor
// city bus (11 m) and a yellow school bus with a bonnet (10 m).
//
// Laid out on the cube grid by hand like the cars: whole cubes relative to each part's pivot, left is +x, forward is +z,
// the ground is y = 0, cube i on the left mirrors cube -1 - i on the right. The passenger doors are on the right, the
// kerb side. Both are modelled inside: seats, the driver's place, an engine under its cover, and on the city bus the
// yellow grab poles you can see through the windows.
//
// They break with the cars' own code (blowUp, crush, fireSpots in cars.js), set up by `wk` on each definition. A bus is
// long, so a foot only flattens the part it lands on and the bus can be stepped on again somewhere else.
import { GLOW, hash, tone } from '../../units/src/voxpart.js';
import { blowUp, H, bx, bxs, sx, SIDES, half, clamp, ease, spring, sideOf, CHROME, PLASTIC, TRIM, BLACK, CHASSIS, TYRE, RIM, RIMD, HUB, DRUM, GLASS, GLASS2, SHINE, DASH, WHEELC,
  PLATE, INK, LENS, TAILC, AMBERC, REVC, ENGINE, ENGINE2, COVER, RAD, BATT, INNER } from './cars.js';

const S = Math.sin, C = Math.cos, PI = Math.PI, ab = Math.abs, fl = Math.floor;
const YEL = 0xe8b820, FLOOR = 0x3b3e44, FLOOR2 = 0x4a4d53, STEEL = 0x8a8f96, AXLE = 0x54585e;
const LED = 0xffb428 | GLOW, LAMP = 0xfff3c4 | GLOW, TAIL = 0xff3826 | GLOW, AMBER = 0xffa51e | GLOW, RED = 0xff2a2a | GLOW;
const mod = (a, n) => ((a % n) + n) % n;
// glass with a glint running across it on the slant
const glass = (j, k, hi) => (mod(k + j, 23) === 0 && j >= hi - 3 ? SHINE : j >= hi ? GLASS2 : GLASS);
const screen = (i, j, hi) => (mod(i + j + 3, 19) === 0 && j >= hi - 4 ? SHINE : j >= hi ? GLASS2 : GLASS);

// a little three-by-three dot-matrix alphabet for the destination signs
const GLYPH = ['####.####', '##.#.###.', '#.#####.#', '###.#..#.', '#..#..###', '#####.###', '.#.#.##.#', '###..####'];
const led = (x, row, seed) => { if (x < 0) return false; const cell = fl(x / 4), c = x % 4; return c < 3 && GLYPH[mod(seed * 3 + cell * 5, GLYPH.length)][row * 3 + c] === '#'; };

// a wheel: an eight-sided disc seven cubes across; `deep` cubes thick, growing inwards from the flank
const wheel = (name, s, edge, kc, deep, face) => ({ name, parent: 'body', pivot: [s * edge, 3.5, kc + 0.5], box: s > 0 ? [1 - deep, -3.5, -3.5, 1, 3.5, 3.5] : [-1, -3.5, -3.5, deep - 1, 3.5, 3.5], paint: (g) => g.fill((x, y, z) => {
  const ay = ab(y), az = ab(z), m = Math.max(ay, az); if (ay + az >= 5) return -1;
  if (m === 3 || (ay === 2 && az === 2)) return TYRE[(Math.round(Math.atan2(y, z) * 8 / PI) + 16) & 1];
  if (x * s < 0) return DRUM;
  return face(m, ay + az);
}) });

// a lamp that lights: its own little part over the dull lens on the body, shown (a touch bigger, so it sits proud) or hidden
function lamp(name, cubes, c) {
  const mn = [0, 1, 2].map((a) => Math.min(...cubes.map((q) => q[a]))), mx = [0, 1, 2].map((a) => Math.max(...cubes.map((q) => q[a])) + 1), pv = mn.map((v, a) => (v + mx[a]) / 2);
  const key = new Set(cubes.map((q) => q.join()));
  return { name, parent: 'body', pivot: pv, box: [mn[0] - pv[0], mn[1] - pv[1], mn[2] - pv[2], mx[0] - pv[0], mx[1] - pv[1], mx[2] - pv[2]],
    paint: (g) => g.fill((x, y, z) => (key.has([fl(x + pv[0]), fl(y + pv[1]), fl(z + pv[2])].join()) ? c : -1)) };
}
const cubes = (i0, i1, j0, j1, k) => { const o = []; for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) o.push([i, j, k]); return o; };
const mirrored = (list) => list.map(([i, j, k]) => [-1 - i, j, k]);

// one leaf of a folding door on the right flank: four cubes wide, hinged at its outer edge
function leaf(name, x, j0, j1, kHinge, dir, kick) {
  const n = j1 - j0 + 1;
  return { name, parent: 'body', pivot: [x, j0, kHinge], box: dir > 0 ? [0, 0, 0, 1, n, 4] : [0, 0, -4, 1, n, 0], paint: (g) => {
    for (let q = 0; q < 4; q++) for (let j = 0; j < n; j++) {
      const k = dir > 0 ? q : -1 - q, edge = q === 0 || q === 3 || j === n - 1;
      g.set(0, j, k, j <= 1 ? kick : edge ? TRIM : j === 2 ? TRIM : glass(j + j0, k + kHinge, j0 + n - 4));
    }
    g.set(0, fl(n / 2), dir > 0 ? 3 : -4, YEL); g.set(0, fl(n / 2) + 1, dir > 0 ? 3 : -4, YEL);   // the grab handle on the meeting edge
  } };
}

// =====================================================================================================================
// The city bus: 20 cubes wide (i = -10..9), 88 long (k = -44..43), 25 tall. Low floor, engine across the back.
// =====================================================================================================================
const CITY = { k0: -44, k1: 43, axF: 27, axR: -25, doors: [[33, 40], [-6, 1]] };
export { lamp, cubes };
export const LIVERY = { blue: 0x2a62b0, red: 0xc8392f, green: 0x2f8a55, orange: 0xd9772b };

function cityParts(o) {
  const seed = o.seed || 0, base = LIVERY[o.paint] ?? LIVERY.blue, low = tone(base, 0.86);
  const { k0, k1, axF, axR, doors } = CITY, E = 9, BAND = 0xf1efe8, SKIRT = 0x2b2e33, ROOF = 0xe6e4dc, SEATB = 0x2f5fa0, SEATS = 0x8a8f96;
  const inDoor = (k) => doors.some(([a, b]) => k >= a && k <= b);
  const flank = (j) => (j <= 2 ? SKIRT : j <= 5 ? low : j <= 7 ? BAND : j <= 10 ? base : j <= 18 ? TRIM : base);
  const pillar = (k) => mod(k + 40, 9) === 0;

  const parts = [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-13, 0, k0 - 2, 13, 26, k1 + 3], paint: (g) => {
      const set = (i, j, k, c) => g.set(i, j, k, c);
      // ---- the floor, which is also the underside ----
      for (let k = k0 + 1; k <= k1 - 1; k++) for (let i = -9; i <= 8; i++) set(i, 2, k, half(i) <= 2 ? FLOOR2 : FLOOR);
      // ---- flanks: skirt, paint with a white band, the black window line, the header ----
      for (const s of SIDES) for (let k = k0 + 1; k <= k1 - 1; k++) {
        const i = sx(s, E), door = s < 0 && inDoor(k);
        for (let j = 2; j <= 21; j++) {
          if (door && j >= 3 && j <= 18) continue;                                              // the doors are parts of their own
          let c = door && j === 2 ? YEL : flank(j);
          if (j >= 12 && j <= 18 && k >= k0 + 4 && k <= k1 - 2 && !pillar(k)) c = glass(j, k, 17);
          if (j >= 19 && k >= 15 && k <= 30) c = k === 15 || k === 30 ? BLACK : led(s > 0 ? 29 - k : k - 16, 21 - j, seed + 2) ? LED : BLACK;   // the route sign on the side
          set(i, j, k, c);
        }
      }
      // ---- the front: bumper, lamps, a tall windscreen, the destination sign ----
      for (let i = -9; i <= 8; i++) {
        const a = half(i);
        for (let j = 2; j <= 21; j++) {
          let c = flank(j);
          if (j <= 3) c = SKIRT;
          else if (j <= 5 && (a === 6 || a === 7)) c = LENS;
          else if (j <= 5 && a === 8) c = AMBERC;
          else if (j === 7 && a === 0) c = CHROME;
          else if (j === 8) c = TRIM;
          else if (j >= 9 && j <= 18) c = a === 8 ? TRIM : screen(i, j, 16);
          else if (j >= 19) c = a <= 7 ? (led(i + 7, 21 - j, seed) ? LED : BLACK) : base;
          set(i, j, k1, c);
        }
        set(i, 2, k1 + 1, PLASTIC); set(i, 3, k1 + 1, a <= 1 ? PLATE : PLASTIC);
      }
      set(-1, 3, k1 + 1, INK);
      for (const s of SIDES) { for (const [a, j] of [[2, 9], [3, 9], [4, 10], [5, 11]]) set(sx(s, a), j, k1, TRIM); }   // wipers
      for (const s of SIDES) { set(sx(s, 10), 17, k1 - 1, TRIM); set(sx(s, 10), 17, k1, TRIM); set(sx(s, 10), 17, k1 + 1, TRIM); for (let j = 13; j <= 16; j++) { set(sx(s, 10), j, k1 + 1, TRIM); set(sx(s, 11), j, k1 + 1, j === 13 || j === 16 ? TRIM : SHINE); } }   // mirrors
      // ---- the back: lamps either side of the engine cover, a window, the route number ----
      for (let i = -9; i <= 8; i++) {
        const a = half(i);
        for (let j = 2; j <= 21; j++) {
          if (j >= 4 && j <= 10 && a <= 5) continue;                                            // the engine cover is a part of its own
          let c = flank(j);
          if (j <= 3) c = SKIRT;
          else if (a >= 7 && j >= 5 && j <= 6) c = TAILC;
          else if (a >= 7 && j >= 7 && j <= 8) c = AMBERC;
          else if (a >= 7 && j >= 9 && j <= 10) c = REVC;
          else if (j >= 12 && j <= 17) c = a <= 6 ? screen(i + 3, j, 16) : TRIM;
          else if (j >= 19 && j <= 21 && a <= 3) c = led(i + 4, 21 - j, seed + 5) ? LED : BLACK;
          set(i, j, k0, c);
        }
        set(i, 2, k0 - 1, PLASTIC); set(i, 3, k0 - 1, PLASTIC);
      }
      set(-7, 1, k0, 0x8a8e94); set(-7, 1, k0 - 1, 0x8a8e94);                                   // tailpipe
      // ---- the roof, with the air conditioning on it ----
      for (let k = k0; k <= k1; k++) for (let i = -9; i <= 8; i++) set(i, 22, k, mod(k, 11) === 0 ? tone(ROOF, 0.9) : ROOF);
      bx(g, -5, 4, 23, 24, -34, -18, (i, j, k) => (j === 23 && (k === -34 || k === -18 || i === -5 || i === 4) ? 0x6d7279 : 0xc9ccd1));
      for (const kc of [-30, -23]) bx(g, -2, 1, 24, 24, kc, kc + 2, 0x4a4e55);                  // the fans
      bx(g, -4, 3, 23, 23, 28, 38, 0xd3d5d9);
      // ---- wheel arches: cut out of the flank and the floor, boxed in black inside ----
      for (const [kc, deep] of [[axF, 2], [axR, 4]]) for (const s of SIDES) {
        const in0 = 10 - deep;                                                                  // the innermost cube the wheel is in
        for (let k = kc - 5; k <= kc + 5; k++) for (let j = 2; j <= 8; j++) {
          const end = ab(k - kc) === 5 || j === 8;
          for (let a = in0 - 1; a <= 8; a++) set(sx(s, a), j, k, end || a === in0 - 1 ? BLACK : -1);
          if (!end && !(j === 7 && ab(k - kc) === 4)) set(sx(s, E), j, k, -1);
        }
        bxs(g, s, in0 - 1, 8, 9, 9, kc - 4, kc + 4, SEATB); bxs(g, s, 8, 8, 10, 11, kc - 4, kc + 4, SEATS);   // a bench along the top of the wheel box
      }
      // ---- under the floor ----
      bx(g, -8, 7, 1, 1, axF, axF, AXLE); bx(g, -6, 5, 1, 1, axR, axR, AXLE);
      for (const i of [-4, 3]) bx(g, i, i, 1, 1, k0 + 2, k1 - 2, CHASSIS);
      bx(g, 4, 7, 1, 1, 2, 12, 0x34373c); bx(g, -7, -7, 1, 1, k0 + 1, k0 + 12, 0x6c7077);       // tank, exhaust
      // ---- the engine across the back, under a shelf with the rear bench on it ----
      bx(g, -5, 3, 3, 8, k0 + 2, k0 + 7, (i, j, k) => ((k + j) & 1 ? ENGINE : ENGINE2));
      bx(g, -3, 1, 9, 9, k0 + 2, k0 + 6, COVER); bx(g, 5, 8, 3, 9, k0 + 2, k0 + 7, (i, j) => RAD[(i + j) & 1]);
      bx(g, -8, -7, 3, 5, k0 + 2, k0 + 4, BATT); bx(g, -8, -7, 6, 7, k0 + 2, k0 + 3, 0xd9e6ee);
      bx(g, -9, 8, 3, 10, k0 + 9, k0 + 9, 0x2a2c30); bx(g, -9, 8, 10, 10, k0 + 1, k0 + 8, FLOOR);
      bx(g, -8, 7, 11, 11, k0 + 1, k0 + 5, SEATB); bx(g, -8, 7, 12, 13, k0 + 1, k0 + 1, SEATS);
      // ---- seats in pairs, facing forward ----
      const row = (s, k) => { bxs(g, s, 3, 8, 5, 5, k + 1, k + 3, SEATB); bxs(g, s, 3, 8, 6, 10, k, k, (i, j) => (j === 10 ? SEATS : SEATB)); bxs(g, s, 5, 6, 3, 4, k + 2, k + 2, AXLE); set(sx(s, 3), 11, k, YEL); };
      for (const k of [-34, -16, -10, -4, 2, 8, 14]) row(1, k);
      for (const k of [-34, -16, 8, 14]) row(-1, k);
      // ---- grab poles and the rails under the roof ----
      for (const s of SIDES) { for (const k of [-32, -18, -8, 3, 12, 21]) bxs(g, s, 2, 2, 3, 21, k, k, YEL); bxs(g, s, 2, 2, 20, 20, -34, 30, YEL); }
      for (const k of [-7, 2, 32]) bx(g, -8, -8, 3, 21, k, k, YEL);                             // a pole at each door
      // ---- the driver's place ----
      bx(g, 2, 8, 3, 11, 32, 32, 0x2e3136);
      bx(g, 3, 6, 5, 6, 34, 36, 0x33363c); bx(g, 3, 6, 7, 12, 33, 33, 0x33363c); bx(g, 4, 5, 3, 4, 35, 35, AXLE);
      bx(g, -8, 7, 3, 8, 41, 42, DASH); bx(g, 2, 7, 9, 9, 41, 41, DASH);
      bx(g, 3, 6, 9, 9, 38, 40, WHEELC); bx(g, 4, 5, 9, 9, 39, 39, -1); bx(g, 4, 5, 5, 8, 40, 40, DASH);   // steering wheel on its column
      bx(g, -5, -4, 3, 8, 38, 39, STEEL); bx(g, -5, -4, 9, 9, 38, 39, YEL);                     // fare box
    } },
    // ---- the engine cover across the back, hinged along its top ----
    { name: 'boot', parent: 'body', pivot: [0, 11, k0], box: [-6, -7, 0, 6, 0, 1], paint: (g) => {
      for (let i = -6; i <= 5; i++) for (let j = 4; j <= 10; j++) { const a = half(i); g.set(i, j - 11, 0, j === 4 && a <= 1 ? PLATE : a <= 4 && j >= 6 && j <= 9 ? (j & 1 ? TRIM : tone(base, 0.8)) : flank(j)); }
      g.set(0, 4 - 11, 0, INK);
    } },
    // ---- the hatch in the roof ----
    { name: 'vent', parent: 'body', pivot: [0, 23, 6], box: [-3, 0, 0, 3, 1, 6], paint: (g) => bx(g, -3, 2, 0, 0, 0, 5, (i, j, k) => (i === -3 || i === 2 || k === 0 || k === 5 ? 0x9a9fa6 : 0xc4c7cc)) },
    leaf('dF1', -10, 3, 18, 33, 1, low), leaf('dF2', -10, 3, 18, 41, -1, low), leaf('dM1', -10, 3, 18, -6, 1, low), leaf('dM2', -10, 3, 18, 2, -1, low),
    ...[['wFL', 1, axF, 2], ['wFR', -1, axF, 2], ['wRL', 1, axR, 4], ['wRR', -1, axR, 4]].map(([n, s, kc, deep]) => wheel(n, s, E, kc, deep, (m) => (m === 0 ? HUB : m === 1 ? (deep === 4 ? RIMD : RIM) : deep === 4 ? RIM : RIMD))),
    lamp('hlL', cubes(6, 7, 4, 5, k1), LAMP), lamp('hlR', mirrored(cubes(6, 7, 4, 5, k1)), LAMP),
    lamp('tlL', cubes(7, 8, 5, 6, k0), TAIL), lamp('tlR', mirrored(cubes(7, 8, 5, 6, k0)), TAIL),
    lamp('hzFL', cubes(8, 8, 4, 5, k1), AMBER), lamp('hzFR', mirrored(cubes(8, 8, 4, 5, k1)), AMBER),
    lamp('hzRL', cubes(7, 8, 7, 8, k0), AMBER), lamp('hzRR', mirrored(cubes(7, 8, 7, 8, k0)), AMBER),
  ];
  return parts;
}

// =====================================================================================================================
// The school bus: 18 cubes wide (i = -9..8), the body from k = -40 to 22, then a bonnet out to the grille at k = 38.
// High floor (j = 7), a domed roof, black rails along the sides, a stop sign that swings out on the driver's side.
// =====================================================================================================================
const SCHOOL = { k0: -40, kw: 22, k1: 38, axF: 30, axR: -22 };
const SY = 0xf2b41c, SK = 0x1c1d20, GREEN = 0x3f6b4a, GREEN2 = 0x35593e, STOPR = 0xc8201c;

function schoolParts(o) {
  const seed = o.seed || 0, { k0, kw, k1, axF, axR } = SCHOOL, E = 8, top = seed % 2 ? 0xf0eee6 : tone(SY, 1.05);
  const flank = (j) => (j === 7 || j === 10 || j === 13 ? SK : SY);
  const pillar = (k) => mod(k - k0, 5) === 1;
  const board = (i, j) => (j === 19 && (mod(i + 20, 3) !== 0) ? SY : SK);                       // the name board: yellow letters on black
  const cap = (g, k) => {                                                                       // the rounded end of the roof, with its warning lamps
    for (let i = -8; i <= 7; i++) { const a = half(i); g.set(i, 21, k, a >= 6 ? 0x8a1f1a : a >= 4 ? 0x9a6a14 : SY); if (a <= 5) g.set(i, 22, k, top); }
  };

  const parts = [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-12, 0, k0 - 2, 12, 24, k1 + 3], paint: (g) => {
      const set = (i, j, k, c) => g.set(i, j, k, c);
      // ---- floor ----
      for (let k = k0 + 1; k <= kw - 1; k++) for (let i = -8; i <= 7; i++) set(i, 7, k, half(i) <= 1 ? FLOOR2 : FLOOR);
      // ---- flanks: yellow with three black rails, a row of small windows ----
      for (const s of SIDES) for (let k = k0 + 1; k <= kw; k++) {
        const i = sx(s, E), door = s < 0 && k >= 14 && k <= 21;
        for (let j = 4; j <= 20; j++) {
          if (door && j >= 7 && j <= 18) continue;
          let c = j >= 14 && j <= 18 ? SY : flank(j);
          if (j >= 14 && j <= 18 && k >= k0 + 2 && k <= kw - 1 && !pillar(k) && !(s < 0 && k >= 12)) c = glass(j, k, 17);
          set(i, j, k, c);
        }
      }
      // ---- the roof: two steps in, so it reads as a dome ----
      for (let k = k0 + 1; k <= kw - 1; k++) { for (const s of SIDES) { set(sx(s, 7), 21, k, top); set(sx(s, 6), 21, k, top); } for (let i = -6; i <= 5; i++) set(i, 22, k, mod(k - k0, 10) === 0 ? tone(top, 0.9) : top); }
      cap(g, k0); cap(g, kw);
      bx(g, -2, 1, 23, 23, -20, -17, 0xbfc3c9); bx(g, -2, 1, 23, 23, 0, 3, 0xbfc3c9); bx(g, -1, 0, 23, 23, k0 + 3, k0 + 4, 0xf4f4f0);   // hatches and the strobe
      // ---- the back: bumper, lamps, windows either side of the emergency door ----
      for (let i = -8; i <= 7; i++) {
        const a = half(i);
        for (let j = 4; j <= 20; j++) {
          if (a <= 2 && j >= 7 && j <= 18) continue;                                            // the emergency door is a part of its own
          let c = j <= 5 ? SK : flank(j);
          if (a >= 6 && (j === 8 || j === 9)) c = TAILC;
          else if (a >= 6 && (j === 11 || j === 12)) c = AMBERC;
          else if (a >= 4 && a <= 6 && j >= 14 && j <= 18) c = screen(i, j, 17);
          else if (j >= 14 && j <= 18) c = SY;
          else if (j >= 19 && a <= 4) c = board(i, j);
          set(i, j, k0, c);
        }
      }
      for (let i = -9; i <= 8; i++) { set(i, 4, k0 - 1, SK); set(i, 5, k0 - 1, half(i) <= 1 ? PLATE : SK); }
      set(-1, 5, k0 - 1, INK);
      // ---- the front of the body: the cowl, a split windscreen, the name board ----
      for (let i = -8; i <= 7; i++) {
        const a = half(i);
        for (let j = 7; j <= 20; j++) {
          let c = flank(j);
          if (j >= 14 && j <= 18) c = a === 0 ? TRIM : a === 7 ? SY : screen(i, j, 17);
          else if (j >= 19 && a <= 4) c = board(i, j);
          set(i, j, kw, c);
        }
      }
      for (const s of SIDES) { set(sx(s, 2), 14, kw + 1, TRIM); set(sx(s, 3), 14, kw + 1, TRIM); set(sx(s, 4), 15, kw + 1, TRIM); }   // wipers
      for (const s of SIDES) { set(sx(s, 9), 17, kw, TRIM); set(sx(s, 9), 17, kw + 1, TRIM); for (let j = 14; j <= 17; j++) { set(sx(s, 9), j, kw + 2, TRIM); set(sx(s, 10), j, kw + 2, j === 14 || j === 17 ? TRIM : SHINE); } }   // mirrors
      // ---- the nose: bonnet sides, grille, wings over the front wheels, bumper ----
      for (const s of SIDES) bxs(g, s, 5, 5, 6, 10, kw + 1, k1 - 1, SY);
      for (let i = -6; i <= 5; i++) for (let j = 6; j <= 11; j++) { const a = half(i); set(i, j, k1, a === 5 || j === 6 || j === 11 ? CHROME : (j & 1 ? BLACK : 0x55595f)); }
      bx(g, -5, 4, 6, 6, kw + 1, k1 - 1, CHASSIS);
      for (const s of SIDES) {
        bxs(g, s, 6, 8, 8, 8, axF - 4, axF + 4, SY); bxs(g, s, 6, 6, 4, 7, axF - 4, axF + 4, BLACK);          // the wing and its liner
        bxs(g, s, 6, 8, 4, 8, axF + 5, axF + 6, (i, j) => (j <= 4 ? SK : SY)); bxs(g, s, 6, 8, 5, 8, axF - 6, axF - 5, SY);
        bxs(g, s, 6, 7, 6, 7, axF + 6, axF + 6, LENS); bxs(g, s, 8, 8, 6, 7, axF + 6, axF + 6, AMBERC);       // headlamps
        bxs(g, s, 8, 8, 9, 11, axF + 6, axF + 6, TRIM); bxs(g, s, 8, 9, 12, 13, axF + 6, axF + 6, TRIM); set(sx(s, 9), 12, axF + 6, SHINE);   // the crossover mirror
      }
      for (let i = -9; i <= 8; i++) { set(i, 4, k1 + 1, SK); set(i, 5, k1 + 1, half(i) <= 1 ? PLATE : SK); }
      set(0, 5, k1 + 1, INK);
      // ---- under the bonnet ----
      bx(g, -3, 2, 7, 10, 26, 34, (i, j, k) => ((k + j) & 1 ? ENGINE : ENGINE2)); bx(g, -2, 1, 11, 11, 26, 30, COVER);
      bx(g, -4, 3, 7, 10, 36, 37, (i, j) => RAD[(i + j) & 1]);
      bx(g, -5, -4, 9, 10, 24, 27, 0x3f6f9a); bx(g, 3, 4, 8, 10, 24, 25, 0xd9e6ee); bx(g, 3, 4, 7, 8, 27, 29, BATT);
      // ---- the chassis: two rails, axles, the shaft, tank and exhaust ----
      for (const i of [-4, 3]) bx(g, i, i, 5, 5, k0 + 1, k1, CHASSIS);
      for (let k = k0 + 6; k < kw; k += 9) bx(g, -3, 2, 5, 5, k, k, CHASSIS);
      bx(g, -5, 4, 3, 3, axR, axR, AXLE); bx(g, -1, 0, 2, 4, axR - 1, axR + 1, AXLE); bx(g, -7, 6, 3, 3, axF, axF, AXLE);
      bx(g, -1, 0, 4, 4, axR + 2, kw + 2, 0x6c7077); bx(g, 4, 7, 4, 6, -8, 4, 0x34373c); bx(g, -7, -7, 4, 4, k0, 10, 0x6c7077);
      for (const kc of [axR, axF]) for (const i of [-4, 3]) bx(g, i, i, 4, 4, kc - 1, kc + 1, CHASSIS);   // the springs hang the axles off the rails
      // ---- rear wheel arches, cut from the flank ----
      for (const s of SIDES) for (let k = axR - 4; k <= axR + 4; k++) for (let j = 4; j <= 7; j++) if (!(j === 7 && ab(k - axR) === 4)) set(sx(s, E), j, k, -1);
      // ---- the step well at the door ----
      bx(g, -8, -6, 7, 7, 14, 21, -1); bx(g, -8, -6, 5, 5, 14, 21, 0x2a2c30); bx(g, -5, -5, 5, 6, 14, 21, 0x2a2c30); set(-9, 6, 14, YEL);
      for (let k = 14; k <= 21; k++) set(-9, 6, k, YEL);
      // ---- benches ----
      const bench = (s, k) => { bxs(g, s, 2, 7, 10, 10, k + 1, k + 3, GREEN); bxs(g, s, 2, 7, 9, 15, k, k, (i, j) => (j >= 15 ? GREEN2 : GREEN)); bxs(g, s, 2, 2, 8, 9, k + 3, k + 3, SK); bxs(g, s, 7, 7, 8, 9, k + 3, k + 3, SK); };
      for (let k = -37; k <= 11; k += 6) { bench(1, k); if (k <= 5) bench(-1, k); }
      // ---- the driver's place ----
      bx(g, 3, 6, 10, 10, 17, 19, 0x2e3136); bx(g, 3, 6, 9, 15, 16, 16, 0x2e3136); bx(g, 4, 5, 8, 9, 18, 18, AXLE);
      bx(g, -7, 6, 8, 13, 20, 21, DASH);
      bx(g, 3, 5, 12, 14, 19, 19, WHEELC); set(4, 13, 19, -1);
    } },
    // ---- the bonnet: top and upper sides in one piece, tipping forward on a hinge at the bumper ----
    { name: 'hood', parent: 'body', pivot: [0, 6, k1], box: [-6, 5, -16, 6, 8, 0], paint: (g) => {
      for (let k = kw + 1; k <= k1 - 1; k++) {
        const hi = k <= 30, kl = k - k1;
        for (const i of [-6, 5]) { g.set(i, 5, kl, SY); if (hi) g.set(i, 6, kl, SY); }
        for (let i = -6; i <= 5; i++) g.set(i, hi ? 7 : 6, kl, half(i) === 0 ? tone(SY, 1.08) : SY);
      }
      for (let i = -6; i <= 5; i++) g.set(i, 6, 30 - k1, SY);
    } },
    // ---- the emergency door in the back, hinged on its left ----
    { name: 'boot', parent: 'body', pivot: [3, 7, k0], box: [-6, 0, 0, 0, 12, 1], paint: (g) => {
      for (let i = -3; i <= 2; i++) for (let j = 7; j <= 18; j++) g.set(i - 3, j - 7, 0, j >= 14 && j <= 17 && i >= -2 && i <= 1 ? screen(i, j, 17) : flank(j));
      g.set(-2 - 3, 12 - 7, 0, STOPR); g.set(-2 - 3, 11 - 7, 0, STOPR);
    } },
    leaf('dF1', -9, 7, 18, 14, 1, SY), leaf('dF2', -9, 7, 18, 22, -1, SY),
    // ---- the stop sign on the driver's side: flat against the flank, swinging out on a hinge at its front edge ----
    { name: 'stop', parent: 'body', pivot: [9, 9, 15], box: [0, 0, -5, 1, 5, 0], paint: (g) => {
      for (let q = 0; q < 5; q++) for (let j = 0; j < 5; j++) { if ((q === 0 || q === 4) && (j === 0 || j === 4)) continue; g.set(0, j, -1 - q, j === 2 && q >= 1 && q <= 3 ? 0xf1efe8 : STOPR); }
    } },
    wheel('wFL', 1, E, axF, 2, (m) => (m === 0 ? HUB : m === 1 ? SY : RIMD)), wheel('wFR', -1, E, axF, 2, (m) => (m === 0 ? HUB : m === 1 ? SY : RIMD)),
    wheel('wRL', 1, E, axR, 4, (m) => (m === 0 ? HUB : m === 1 ? RIMD : SY)), wheel('wRR', -1, E, axR, 4, (m) => (m === 0 ? HUB : m === 1 ? RIMD : SY)),
    lamp('hlL', cubes(6, 7, 6, 7, axF + 6), LAMP), lamp('hlR', mirrored(cubes(6, 7, 6, 7, axF + 6)), LAMP),
    lamp('tlL', cubes(6, 7, 8, 9, k0), TAIL), lamp('tlR', mirrored(cubes(6, 7, 8, 9, k0)), TAIL),
    lamp('hzFL', cubes(4, 5, 21, 21, kw), AMBER), lamp('hzFR', mirrored(cubes(4, 5, 21, 21, kw)), AMBER),
    lamp('hzRL', cubes(4, 5, 21, 21, k0), AMBER), lamp('hzRR', mirrored(cubes(4, 5, 21, 21, k0)), AMBER),
    lamp('flFL', cubes(6, 7, 21, 21, kw), RED), lamp('flFR', mirrored(cubes(6, 7, 21, 21, kw)), RED),
    lamp('flRL', cubes(6, 7, 21, 21, k0), RED), lamp('flRR', mirrored(cubes(6, 7, 21, 21, k0)), RED),
  ];
  return parts;
}

// =====================================================================================================================
// Clips, shared by both buses. W: half the width in town voxels.
// =====================================================================================================================
const ON = [0, 0, 0, 0, 0, 0, 1.1], OFF = [0, 0, 0, 0, 0, 0, 0], R_WHEEL = 3.5 * H;
const HL = ['hlL', 'hlR', 'tlL', 'tlR'], HZ = ['hzFL', 'hzFR', 'hzRL', 'hzRR'], FLA = ['flFL', 'flRR'], FLB = ['flFR', 'flRL'];
const lit = (names, v) => Object.fromEntries(names.map((n) => [n, v]));
const dark = { ...lit(HL, OFF), ...lit(HZ, OFF), ...lit(FLA, OFF), ...lit(FLB, OFF) };
const spin = (a) => ({ wFL: [a, 0, 0], wFR: [a, 0, 0], wRL: [a, 0, 0], wRR: [a, 0, 0] });
const doors = (a) => ({ dF1: [0, -1.45 * a, 0], dF2: [0, 1.45 * a, 0], dM1: [0, -1.45 * a, 0], dM2: [0, 1.45 * a, 0] });

function busClips(cfg) {
  const { W, axF, axR } = cfg, AX = { wFL: [1, axF], wFR: [-1, axF], wRL: [1, axR], wRR: [-1, axR] };
  // the wheels under a part that has been stepped on lie splayed out from under it
  const splay = (u) => {
    const P = {}; if (!u.crushes) return P;
    for (const n in AX) { const [s, kc] = AX[n]; let e = 0; for (const [, fz, t0, flat] of u.crushes) if (flat && ab(kc - fz) < 24) e = Math.max(e, clamp((u.t - t0) / 0.1)); if (e > 0) P[n] = [0, 0.2 * s * e, -1.3 * s * e, 2.3 * s * e, -1.1 * e, 0]; }
    return P;
  };
  return {
    Parked: { loop: true, speed: 0, pose: () => ({ ...spin(0), ...dark }) },
    Drive: { loop: true, speed: 16, pose: (t, u) => ({ ...spin(t * 16 / R_WHEEL), body: [0.005 * S(t * 5 + u.phase), 0, 0.006 * S(t * 3.7 + u.phase), 0, 0.03 * ab(S(t * 6 + u.phase)), 0], ...dark, ...lit(HL, ON) }) },
    // the alarm when the monster thumps the street: the indicators blink and it rocks on its springs
    Alarm: { loop: true, speed: 0, pose: (t) => {
      const k = Math.exp(-((t % 2.4) * 2.2)), w = S(t * 15), on = fl(t * 2.6 + 0.5) & 1;
      return { ...spin(0), body: [0.008 * k * w, 0, 0.018 * k * C(t * 11), 0, -0.07 * k * ab(w), 0], ...dark, ...lit(HZ, on ? ON : OFF) };
    } },
    // everything opened up, to see inside
    Open: { loop: false, dur: 1.3, speed: 0, pose: (t) => {
      const a = ease(clamp(t / 1.0));
      return { ...spin(0), ...dark, ...doors(a), boot: cfg.boot(a), hood: [0.95 * a, 0, 0], vent: [-0.6 * a, 0, 0], stop: [0, -PI / 2 * a, 0] };
    } },
    // the school bus picking up: the stop sign swings out, the door folds open and the red lamps flash in turn
    Stop: { loop: true, speed: 0, pose: (t) => {
      const a = ease(clamp(t / 0.7)), on = fl(t * 2.2) & 1;
      return { ...spin(0), ...dark, ...doors(a), stop: [0, -PI / 2 * a, 0], ...lit(FLA, on ? ON : OFF), ...lit(FLB, on ? OFF : ON) };
    } },
    // Blown up where it stands: it jumps, comes down on burst tyres and leans. The doors are flung open and the engine
    // cover, the bonnet and the roof hatch are blown clear.
    WreckStand: { loop: false, hidden: true, dur: 2, speed: 0, pose: (t, u) => {
      const sd = sideOf(u), e = ease(clamp(t / 0.5)), hop = Math.max(0, 8 * t - 26 * t * t), sp = spring(t), sp2 = spring(t, 5, 7);
      const a = clamp(t / 1.05), land = Math.max(0, t - 1.05), bounce = a >= 1 ? 0.5 * Math.exp(-land * 9) * ab(S(land * 18)) : 0;
      return { ...spin(0), ...dark, body: [0.012 * e, 0.03 * sd * e, -0.045 * sd * e, 0, hop - 0.3 * e, 0],
        dF1: [0, -1.45 * sp, 0], dF2: [0, 1.15 * sp2, 0.08 * e], dM1: [0, -0.8 * sp2, -0.06 * e], dM2: [0, 1.45 * sp, 0],
        stop: [0.3 * e, -1.2 * sp2, 0],
        ...cfg.blown(a, sd, bounce), ...splay(u) };
    } },
    // Thrown over onto its side: it tips about the wheels on one side and comes down flat.
    WreckSide: { loop: false, hidden: true, dur: 5, speed: 0, pose: (t, u) => {
      const sd = sideOf(u), T = 1.15, a = clamp(t / T), land = Math.max(0, t - T), ang = PI / 2 * (a * a * (1.6 - 0.6 * a)) - (a >= 1 ? 0.045 * Math.exp(-land * 6) * ab(S(land * 13)) : 0);
      const flop = t > 0.9 ? spring(t - 0.9, 3.5, 6) : 0, up = sd < 0, w = 9 / 1.4 * (1 - Math.exp(-1.4 * t));
      return { ...spin(w), ...dark, body: [0, 0.1 * sd * ease(a), sd * ang, -sd * W * (1 - C(ang)), W * S(ang) + 2.2 * S(PI * a) * (1 - a), 0],
        dF1: [0, up ? -0.5 * flop : 0, 0], dF2: [0, up ? 0.35 * flop : 0, 0], dM1: [0, up ? -0.3 * flop : 0, 0], dM2: [0, up ? 0.55 * flop : 0, 0],
        boot: cfg.boot(0.45 * flop), hood: [0.4 * flop, 0, 0], vent: [-0.5 * flop, 0, 0], stop: [0, up ? 0 : -0.7 * flop, 0] };
    } },
    // Stepped on: the body is pressed flat under the foot (crush in cars.js) and the wheels there splay out.
    Crushed: { loop: false, hidden: true, dur: 0.3, speed: 0, pose: (t, u) => ({ ...dark, ...splay(u) }) },
  };
}

const keep = (d, n) => { const k = 0.13 + 0.87 * ease(clamp((d - 12) / 15)); return k > 0.97 ? 1 : k + 0.07 * (n - 0.5); };
const busWk = (seat) => ({ wrecks: ['WreckStand', 'WreckSide'], seat, R: 21, soot: 30, max: 800, push: 24, lamps: /^(hl|tl|hz|fl)/, loose: /^(hl|tl|hz|fl)/, mottle: 0.16, fireTop: 99, spread: 16, keep, dx: 0.4, recrush: true, boom: 6.4, fires: 26 });
const onKill = (u, point, r, debris) => { if (u.crushes) for (const c of u.crushes) c[2] = -9; blowUp(u, debris, point); };

export const CITY_BUS = {
  kind: 'bus', h: H, parts: cityParts, start: 'Parked', dieAt: 0.1, inner: INNER, onKill,
  clips: busClips({ W: 5, axF: CITY.axF, axR: CITY.axR,
    boot: (a) => [1.25 * a, 0, 0],
    // the engine cover is thrown out behind and lands flat; the roof hatch goes up and comes down beside the bus
    blown: (a, sd, bounce) => ({ boot: [2.5 * PI * a, 0.5 * sd * a, 0, 2 * sd * a, 16 * a * (1 - a) - 5.25 * a + bounce, -10 * a], vent: [2 * PI * a, 0.7 * sd * a, 0, 9 * sd * a, 34 * a * (1 - a) - 11.3 * a + bounce, -2 * a] }) }),
  // the blast starts at the engine across the back, or at the tank under the floor
  wk: busWk((u, clip) => (clip === 'WreckStand' || hash(u.opts.seed || 0, 3, 7, 1) < 0.5 ? [0, 6, CITY.k0 + 5] : [5, 4, 7])),
};
export const SCHOOL_BUS = {
  kind: 'bus', h: H, parts: schoolParts, start: 'Parked', dieAt: 0.1, inner: INNER, onKill,
  clips: busClips({ W: 4.5, axF: SCHOOL.axF, axR: SCHOOL.axR,
    boot: (a) => [0, -1.3 * a, 0],
    // the bonnet is thrown up and forward and lands ahead of the bus; the emergency door bursts open
    blown: (a, sd, bounce) => ({ hood: [2 * PI * a, 0.45 * sd * a, 0, 3 * sd * a, 20 * a * (1 - a) - 5.3 * a + bounce, 11 * a], boot: [0, -1.5 * spring(a * 1.05, 5, 7), 0] }) }),
  // the blast starts under the bonnet, or at the tank under the floor
  wk: busWk((u, clip) => (clip === 'WreckStand' || hash(u.opts.seed || 0, 3, 7, 1) < 0.5 ? [0, 9, SCHOOL.axF] : [5, 6, -2])),
};
