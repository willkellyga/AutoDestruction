// The five car bodies, built at a sixth of a town voxel (h = 1/6): three times as fine each way as Monster Mayhem's
// street cars. Each body takes its look from a kind of real car without copying one (no badges, names or exact
// shapes): an early-80s European hot hatch, a mid-70s American wood-sided station wagon, a late-60s fastback muscle
// coupe, a late-70s square-body pickup and an early-80s American panel van.
//
// A body is laid out in three steps. The shell: a side silhouette (the top of the car along its length), the belt line
// (the base of the glass), the underside and a width at every height, with the corners rounded in plan and in section,
// the wheel arches cut out and the side windows set one cube in. Then the details, stamped onto whichever cube is
// outermost from the front, the back, a side or the top: grilles and lamps (set in, with their bezels proud), bumpers
// wrapped round the corners, shut lines, handles, trim, mirrors, plates and bars. Then every cube is coloured: the
// stamped ones by their own colour, the shell by the paint job, or as glass, pillar, roof or sill by where it is and
// which of its faces show.
//
// Coordinates are whole cubes: left is +x, forward is +z, the ground is y = 0, and the car is symmetric about x = 0.
import { GLOW, hash, tone } from '../../units/src/voxpart.js';
import { PARTS, PAINTS } from './parts.js';

const PI = Math.PI, ab = Math.abs, fl = Math.floor, sq = Math.sqrt, hyp = Math.hypot;
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), ease = (a) => a * a * (3 - 2 * a);
const lo = (a) => Math.ceil(a - 0.5);   // the first cube whose centre is at or past a

// ---- colours ----
export const CHROME = 0xc9ced6, CHROMEL = 0xe6e9ee, CHROMED = 0x8f969f, PLASTIC = 0x26282c, TRIM = 0x1b1c20, CHASSIS = 0x1a1b1e, ARCH = 0x141518, RUBBER = 0x17181a;
export const GLASS = 0x24404f, GLASS2 = 0x2f5466, SHINE = 0x8dbdd0, MIRRORG = 0xa9cbd8;
export const LAMP = 0xfff3c4 | GLOW, LAMPW = 0xffffff | GLOW, LAMP2 = 0xeadfb0 | GLOW, TAIL = 0xff3826 | GLOW, TAIL2 = 0xd42a1c | GLOW, AMBER = 0xffa51e | GLOW;
export const HOUSING = 0x3a3d42, REV = 0xe4e2da, TAILC = 0x8a1c16, AMBERC = 0xa8640e;
export const GRILLE = 0x111215, GRILLE2 = 0x2b2d31, PLATEW = 0xeeeee6, INK = 0x24356b, PIN = 0xc8281e, HOLE = 0x0c0c0e;
export const GUNMETAL = 0x3b3f45, STEEL = 0x8a9098, BRIGHT = 0xb9bfc7, DARKS = 0x202327, ARMOUR = 0x5f646b, ARMOUR2 = 0x50555b, RIVET = 0xaab0b8;
export const RUST = [0x7a4a2a, 0x8f5a30, 0x5e3a22], HAZ = 0xe2b21e, HAZK = 0x1a1a1a, OLIVE = 0x4f5a36, OLIVE2 = 0x434d2d, TIP = 0xc0402c, BED = [0x34363a, 0x2b2d30, 0x3c3e42];
export const FLAME = [0xffd23a, 0xf58a1f, 0xc8321e], CHECKW = 0xeeeae0, RED_GLOW = 0xff3a2a | GLOW;
const WOOD = [0x5a3218, 0x683b1d, 0x774522, 0x86512b, 0x965e35], WOODB = 0xd9ccaa, WOODD = 0x3b2414;
export const INNER = [0x1c1d20, 0x26272a, 0x151618];

// smooth noise for camo, rust and wood: whole-cube lattice, eased between
export function noise(x, y, z, s) {
  const i = fl(x), j = fl(y), k = fl(z), fx = ease(x - i), fy = ease(y - j), fz = ease(z - k);
  const L = (a, b, t) => a + (b - a) * t, n = (a, b, c) => hash(i + a, j + b, k + c, s);
  return L(L(L(n(0, 0, 0), n(1, 0, 0), fx), L(n(0, 1, 0), n(1, 1, 0), fx), fy), L(L(n(0, 0, 1), n(1, 0, 1), fx), L(n(0, 1, 1), n(1, 1, 1), fx), fy), fz);
}
// a line through points [z, y] from the front back: its height at z (steps are two points a hair apart)
function line(pts) {
  return (z) => {
    if (z >= pts[0][0]) return pts[0][1];
    for (let n = 1; n < pts.length; n++) { const [z1, y1] = pts[n], [z0, y0] = pts[n - 1]; if (z >= z1) return y1 + (y0 - y1) * (z - z1) / (z0 - z1); }
    return pts[pts.length - 1][1];
  };
}
const bump = (z, c, w) => (ab(z - c) < w ? 0.5 + 0.5 * Math.cos(PI * (z - c) / w) : 0);
// a side window: [z at the bottom rear, bottom front, top rear, top front, bottom y, top y]
const inWin = (w, z, y) => { const t = (y - w[4]) / (w[5] - w[4]); return t >= 0 && t <= 1 && z > w[0] + (w[2] - w[0]) * t && z < w[1] + (w[3] - w[1]) * t; };

// ---- role codes in the build grid; 32 and up are colours from the car's own palette ----
const PAINT = 1, SEAM = 2, LINER = 3, LO = 4, HI = 5, WOODR = 6, PLATE = 7, BEDF = 8, GAP = 9;

// ---- the shapes ----
// W: half the width. zN, zT: the shell's nose and tail (the bumpers stand out bumpF, bumpR past them). c0: the sills.
// ax: the axles. R: the wheels. top: the silhouette along the length. belt: the base of the glass. bot: the underside.
// noseR, tailR: the corners in plan. gIn, tumble: how far the glass house is set in at the belt and leans in by the
// roof. rr, sr, ssr, br: the roundness of the roof edge, the bonnet and boot edges, the shoulder under the glass and
// the bottom edge. roofY, roofF, roofR: the roof and where it starts and ends. ws, rw: the windscreen and rear window
// (pil: the pillar width beside the glass, ylo, yhi: the glass from and to). win: the side windows.
export const SHAPES = {
  hatch: {
    W: 21, zN: 48, zT: -47.5, bumpF: 2, bumpR: 2, c0: 5, ax: [32, -31], R: 8,
    top: line([[48, 18.6], [47.2, 19.7], [45.5, 20.3], [25, 21.4], [22.6, 22.2], [12.5, 35], [-35, 35], [-36.5, 34.6], [-44, 24], [-45.5, 23.2], [-47.5, 21.8]]),
    bot: line([[48, 10], [45, 7], [42, 5], [-41, 5], [-44, 6.5], [-47.5, 9.5]]),
    belt: line([[48, 22], [-47.5, 22.6]]),
    noseR: 4, tailR: 3, gIn: 1.5, tumble: 3, rr: 2, sr: 1.5, ssr: 1, br: 2,
    roofY: 35, roofF: 12.5, roofR: -35, cowl: 22.6,
    ws: { pil: 2.6, ylo: 23.2, yhi: 33.4 }, rw: { z0: -46, z1: -35.8, pil: 3.4, ylo: 25.2, yhi: 33.2 },
    win: [[-12.5, 19.2, -12.5, 11.6, 23.6, 33], [-28, -15.6, -24.6, -15.6, 23.6, 33]],
    frame: TRIM, drip: TRIM, sill: PLASTIC, sillH: 3.4, lowTone: 0.86,
    turret: { z: -12, zR: -18 }, roofW: { z: 5.5 }, mirror: { z: 19, style: 'small' }, door: { z: 21 },
    stripe: [1.5, 6], flame: { z0: 26, len: 48, bonnet: 22 },
  },
  wagon: {
    W: 23, zN: 60.5, zT: -60.5, bumpF: 2.5, bumpR: 2.5, c0: 5, ax: [35, -36], R: 9,
    top: line([[60.5, 19.6], [59.6, 20.9], [57.5, 21.4], [24, 22.4], [22, 22.9], [8, 36], [-55.5, 36], [-58, 35.5], [-59.8, 34.2], [-60.5, 32.5]]),
    bot: line([[60.5, 10.5], [57, 6.5], [52, 5], [-50, 5], [-56, 6.5], [-60.5, 9.5]]),
    belt: line([[60.5, 21.8], [-60.5, 22.6]]),
    noseR: 2.5, tailR: 2.5, gIn: 1.5, tumble: 2.6, rr: 1.6, sr: 1, ssr: 1, br: 2,
    roofY: 36, roofF: 8, roofR: -55.5, cowl: 22,
    ws: { pil: 2.6, ylo: 23.4, yhi: 34.3 },
    win: [[-7.5, 18.3, -7.5, 7.8, 24, 34.2], [-27, -10.5, -27, -10.5, 24, 34.2], [-54, -30, -53, -30, 24, 34.2]],
    frame: CHROME, drip: CHROME, sill: null, sillH: 2.4, lowTone: 0.88,
    turret: { z: -18, zR: -24 }, roofW: { z: 1.5 }, mirror: { z: 18, style: 'chrome' }, door: { z: 20 },
    stripe: [1.5, 6], flame: { z0: 30, len: 56, bonnet: 22 },
  },
  muscle: {
    W: 22, Wmax: 23.7, zN: 55.5, zT: -55.5, bumpF: 1.6, bumpR: 1.6, c0: 4.5, ax: [34, -34], R: 9.5,
    Wz: (z) => 22 + 1.6 * bump(z, -33, 19) + 0.5 * bump(z, 34, 15),
    top: line([[55.5, 17.4], [54.6, 18.9], [52, 19.6], [20, 21.3], [18, 21.8], [4, 31], [-9, 31], [-11, 30.7], [-39, 22.9], [-49.5, 22.7], [-53.2, 24.8], [-54.8, 24.8], [-55.5, 23.4]]),
    bot: line([[55.5, 4.8], [52, 4.5], [-46, 4.5], [-51, 6], [-55.5, 8.5]]),
    belt: line([[55.5, 20.6], [20, 21], [-14, 21.4], [-34, 22.4], [-55.5, 22.4]]),
    noseR: 3.5, tailR: 3, gIn: 3, tumble: 4, rr: 2.6, sr: 2, ssr: 1.6, br: 2.4,
    roofY: 31, roofF: 4, roofR: -10, cowl: 18,
    ws: { pil: 2.8, ylo: 22.6, yhi: 29.6 }, rw: { z0: -36.5, z1: -11.2, pil: 6, ylo: 23.6, yhi: 30.2 },
    win: [[-6.5, 13.2, -4.5, 3.6, 23, 29.4], [-17.5, -9, -11.5, -9, 23, 28.6]],
    frame: CHROME, drip: CHROME, sill: null, sillH: 2.6, lowTone: 0.84,
    turret: { z: -3, zR: -14, pedR: 4 }, roofW: { z: 2.5 }, mirror: { z: 14, style: 'chrome' }, door: { z: 16 },
    stripe: [1.5, 6], flame: { z0: 24, len: 50, bonnet: 18 },
  },
  pickup: {
    W: 23, zN: 59.5, zT: -60, bumpF: 2.5, bumpR: 2.5, c0: 8, ax: [37, -37], R: 10.5,
    Wz: (z) => (z < -6 && z > -8.5 ? 18 : 23),
    top: line([[59.5, 28.3], [58.6, 29.6], [57, 30], [19.6, 30.2], [18, 31], [12, 43], [-4.4, 43], [-5.5, 42.4], [-6, 41.4], [-6.01, 13], [-8.49, 13], [-8.5, 30], [-60, 30]]),
    bot: line([[59.5, 14], [55, 9.5], [51, 8], [-51, 8], [-56, 9], [-60, 12]]),
    belt: line([[59.5, 30], [-60, 30]]),
    hwIn: null,   // set below: the bed is hollow
    noseR: 2, tailR: 2, gIn: 1, tumble: 1.6, rr: 1.6, sr: 1.2, ssr: 0.6, br: 1.6,
    roofY: 43, roofF: 12, roofR: -4.4, cowl: 18, bedY: 16, bedZ: [-9.5, -58.5],
    ws: { pil: 2.6, ylo: 31.6, yhi: 41.6 },
    win: [[-3, 15.4, -3, 10.4, 31.8, 41.4]],
    frame: CHROME, drip: CHROME, sill: null, sillH: 2.6, lowTone: 0.88,
    turret: { z: -31, zR: -31, y: 45 }, roofW: { z: 5 }, mirror: { z: 15, style: 'big' }, door: { z: 15 },
    stripe: [1.5, 6], flame: { z0: 25, len: 60, bonnet: 18 },
  },
  van: {
    W: 23, zN: 55.5, zT: -55.5, bumpF: 2.5, bumpR: 2.5, c0: 7, ax: [35, -34], R: 10,
    top: line([[55.5, 24.8], [54.5, 26.8], [52, 28.4], [37.2, 32.3], [35.6, 33.2], [28, 50], [26.5, 51.3], [24.5, 51.8], [-53, 51.8], [-55, 51], [-55.5, 49.8]]),
    bot: line([[55.5, 13], [52, 9], [48, 7], [-48, 7], [-53, 8], [-55.5, 11]]),
    belt: line([[55.5, 31], [36, 33], [-55.5, 33]]),
    noseR: 5.5, tailR: 2.5, gIn: 0, tumble: 1.4, rr: 3, sr: 2.4, ssr: 0, br: 2,
    roofY: 51.8, roofF: 26.5, roofR: -53, cowl: 35.6,
    ws: { pil: 2.6, ylo: 34.2, yhi: 49.6 },
    win: [[11.5, 32.4, 11.5, 26.6, 34.8, 48.4]],
    frame: TRIM, drip: TRIM, sill: null, sillH: 2.6, lowTone: 0.88,
    turret: { z: -14, zR: -20 }, roofW: { z: 18 }, mirror: { z: 30.5, style: 'big' }, door: { z: 29 },
    stripe: [1.5, 6], flame: { z0: 23, len: 64, bonnet: 36 },
  },
};
// a dune buggy: a low open tub between wheels that stand out on their own, a roll cage over it, the engine out in the
// open at the back. noArch: the wheels stand clear of the body, so it has no arches. openTop: no roof to plate.
SHAPES.buggy = {
  W: 17, zN: 44, zT: -42, bumpF: 3, bumpR: 2, c0: 7, ax: [28, -27], R: 9, wheelOut: -8,
  Wz: (z) => 17 - 1.5 * clamp((z - 12) / 8) - 0.22 * Math.max(0, z - 32),
  top: line([[44, 12.5], [43.2, 13.8], [41, 14.6], [21, 19], [-19, 19], [-20.5, 16.5], [-42, 16.5]]),
  bot: line([[44, 9.8], [40, 7.6], [-38, 7.6], [-42, 9.6]]),
  belt: line([[44, 40], [-42, 40]]),
  noseR: 4, tailR: 2, gIn: 0, tumble: 0, rr: 0, sr: 0.8, ssr: 0, br: 2,
  roofY: 37, roofF: 12, roofR: -16, cowl: 21,
  ws: { pil: 0, ylo: 99, yhi: 99 },
  win: [],
  frame: TRIM, drip: TRIM, sill: null, sillH: 2, lowTone: 0.86,
  turret: { z: -6, zR: -6, y: 40 }, roofW: { z: 6, y: 39 }, mirror: { z: 18, style: 'small' }, door: { z: 1, y: 14 },
  stripe: [1.5, 6], flame: { z0: 22, len: 44, bonnet: 21 },
  noArch: true, openTop: true, plateTop: 17,
  hwIn: (z, y, S) => (z < 17 && z > -19 && y >= 11 ? S.Wz(z) - 2 : 0),
};
// a late-70s wedge supercar: a knife-edge nose, a windscreen laid nearly flat, a short roof, louvres over the engine
// behind it, big intakes in the flanks, a wing on posts
SHAPES.wedge = {
  W: 22.5, Wmax: 23.4, zN: 52, zT: -50, bumpF: 1, bumpR: 1, c0: 4, ax: [33, -32], R: 8.5,
  Wz: (z) => 22.5 + 0.9 * bump(z, -31, 17),
  top: line([[52, 9.5], [51, 10.8], [48, 11.6], [24, 16.6], [22.5, 17.4], [4, 24], [-12, 24], [-15, 23.6], [-40, 19.6], [-46.5, 19.4], [-48.4, 20.4], [-50, 18]]),
  bot: line([[52, 5], [48, 3.8], [-45, 3.8], [-50, 6]]),
  belt: line([[52, 16.6], [22, 17.2], [-15, 18.2], [-50, 18.6]]),
  noseR: 4, tailR: 2.5, gIn: 2.5, tumble: 4, rr: 2, sr: 1.4, ssr: 1, br: 1.6,
  roofY: 24, roofF: 4, roofR: -12, cowl: 22,
  ws: { pil: 2.4, ylo: 18, yhi: 23 }, rw: { z0: -27, z1: -15.5, pil: 6, ylo: 19.6, yhi: 23.2 },
  win: [[-12, 16, -9, 4.5, 18.8, 23]],
  frame: TRIM, drip: TRIM, sill: PLASTIC, sillH: 3, lowTone: 0.84,
  turret: { z: -4, zR: -9 }, roofW: { z: 1 }, mirror: { z: 12, style: 'small' }, door: { z: 14 },
  stripe: [1.5, 6], flame: { z0: 26, len: 50, bonnet: 22 },
};
// a conventional school bus: a long tall box behind a bonnet narrower than its wings, a row of split windows, black
// rub rails, warning lamps at the corners of the roof, the folding door on the right, an emergency door at the back
const BUS_WIN = [[23.5, 37.5, 23.5, 37.5, 37, 49, 1]];
for (let z = 20; z > -50; z -= 11) BUS_WIN.push([z - 8, z, z - 8, z, 37, 49]);
SHAPES.bus = {
  W: 24, zN: 66, zT: -66, bumpF: 2.5, bumpR: 2.5, c0: 8, ax: [48, -38], R: 11,
  top: line([[66, 25], [65.2, 27], [63, 28.4], [44, 30.6], [42.4, 32], [40.6, 50.5], [39.4, 52.6], [37.4, 54], [-63.5, 54], [-65.4, 52.8], [-66, 51]]),
  bot: line([[66, 13], [62, 9], [-60, 9], [-66, 12]]),
  belt: line([[66, 31.5], [42, 32.6], [40, 35], [-66, 35]]),
  noseR: 3.5, tailR: 2.5, gIn: 0, tumble: 0.8, rr: 3, sr: 2.6, ssr: 0, br: 2,
  roofY: 54, roofF: 37.4, roofR: -63.5, cowl: 42.4,
  ws: { pil: 2.6, ylo: 35.5, yhi: 51.6 },
  win: BUS_WIN,
  frame: TRIM, drip: TRIM, sill: TRIM, sillH: 3, lowTone: 0.92,
  turret: { z: -14, zR: -26 }, roofW: { z: 16 }, mirror: { z: 39, style: 'big' }, door: { z: 36 },
  stripe: [1.5, 6], flame: { z0: 34, len: 80, bonnet: 42 },
  hood: { z: 41.5, x: 17.5 },
};
SHAPES.pickup.hwIn = (z, y, S, arch) => (z < S.bedZ[0] && z > S.bedZ[1] && y >= S.bedY ? (arch < S.aR + 2 ? S.cutX - 2.2 : S.W - 2) : 0);

// ---- the grid and the stamps ----
function grid(S, box) {
  const [I0, , K0, I1, J1, K1] = box, NX = I1 - I0, NY = J1, NZ = K1 - K0, L = NX * NY;
  const g = new Uint8Array(L * NZ), HW = new Float32Array(NY * NZ), PAL = [], pm = new Map();
  const n = (i, j, k) => (k - K0) * L + j * NX + i - I0;
  const ok = (i, j, k) => i >= I0 && i < I1 && j >= 0 && j < NY && k >= K0 && k < K1;
  const get = (i, j, k) => (ok(i, j, k) ? g[n(i, j, k)] : 0);
  const put = (i, j, k, c) => { if (ok(i, j, k)) g[n(i, j, k)] = c; };
  const hw = (j, k) => (j >= 0 && j < NY && k >= K0 && k < K1 ? HW[(k - K0) * NY + j] : 0);
  // set a cube on the surface, cut in d cubes (d < 0) or build out d cubes (d > 0) along the outward normal (di, dj, dk);
  // c may be [code, d] or [code, d, thick]: thick paints that many cubes in from the surface (a grille's bars)
  const relief = (i, j, k, di, dj, dk, d, c) => {
    if (Array.isArray(c)) { if (c[2]) for (let s = 1; s < c[2]; s++) put(i - di * s, j - dj * s, k - dk * s, c[0]); d = c[1]; c = c[0]; }
    if (d === 0) put(i, j, k, c);
    else if (d > 0) for (let s = 1; s <= d; s++) put(i + di * s, j + dj * s, k + dk * s, c);
    else { for (let s = 0; s < -d; s++) put(i - di * s, j - dj * s, k - dk * s, 0); put(i + di * d, j + dj * d, k + dk * d, c); }
  };
  const halves = (a, b, m) => (m ? [[a, b], [-b, -a]] : [[a, b]]);
  const B = {
    I0, I1, K0, K1, NX, NY, NZ, L, g, HW, PAL, n, ok, get, put, hw,
    P(hex) { let c = pm.get(hex); if (c === undefined) { c = 32 + PAL.length; if (c > 255) return 32; PAL.push(hex); pm.set(hex, c); } return c; },
    // fn(x, y) gives a code (or [code, depth]) for the cube that is outermost from the front at (x, y), or 0 to leave it
    front(x0, x1, y0, y1, fn, d = 0, m = true) {
      for (let j = Math.max(0, lo(y0)); j < Math.min(NY, lo(y1)); j++) for (const [a, b] of halves(x0, x1, m)) for (let i = lo(a); i < lo(b); i++) {
        const c = fn(i + 0.5, j + 0.5); if (!c) continue;
        let k = K1 - 1; while (k >= K0 && !g[n(i, j, k)]) k--; if (k >= K0) relief(i, j, k, 0, 0, 1, d, c);
      }
    },
    back(x0, x1, y0, y1, fn, d = 0, m = true) {
      for (let j = Math.max(0, lo(y0)); j < Math.min(NY, lo(y1)); j++) for (const [a, b] of halves(x0, x1, m)) for (let i = lo(a); i < lo(b); i++) {
        const c = fn(i + 0.5, j + 0.5); if (!c) continue;
        let k = K0; while (k < K1 && !g[n(i, j, k)]) k++; if (k < K1) relief(i, j, k, 0, 0, -1, d, c);
      }
    },
    top(x0, x1, z0, z1, fn, d = 0, m = true) {
      for (let k = Math.max(K0, lo(z0)); k < Math.min(K1, lo(z1)); k++) for (const [a, b] of halves(x0, x1, m)) for (let i = lo(a); i < lo(b); i++) {
        const c = fn(i + 0.5, k + 0.5); if (!c) continue;
        let j = NY - 1; while (j >= 0 && !g[n(i, j, k)]) j--; if (j >= 0) relief(i, j, k, 0, 1, 0, d, c);
      }
    },
    // fn(z, y, s) for the outermost cube on side s (1: left, +x; -1: right) when it is on the skin of the shell
    side(z0, z1, y0, y1, fn, d = 0, sides = 3, skin = 1.6) {
      for (let k = Math.max(K0, lo(z0)); k < Math.min(K1, lo(z1)); k++) for (let j = Math.max(0, lo(y0)); j < Math.min(NY, lo(y1)); j++) {
        const w = hw(j, k);
        for (const s of sides === 3 ? [1, -1] : sides === 1 ? [1] : [-1]) {
          const c = fn(k + 0.5, j + 0.5, s); if (!c) continue;
          let i = s > 0 ? I1 - 1 : I0; while (i >= I0 && i < I1 && (s > 0 ? i >= 0 : i < 0) && !g[n(i, j, k)]) i -= s;
          if (s > 0 ? i < 0 : i >= 0) continue;
          if (w > 0 && ab(i + 0.5) < w - skin) continue;
          relief(i, j, k, s, 0, 0, d, c);
        }
      }
    },
    // fn(x, y, z) for every cube of a box (only the empty ones if empty is set)
    fill(x0, x1, y0, y1, z0, z1, fn, m = true, empty = false) {
      for (let k = Math.max(K0, lo(z0)); k < Math.min(K1, lo(z1)); k++) for (let j = Math.max(0, lo(y0)); j < Math.min(NY, lo(y1)); j++) for (const [a, b] of halves(x0, x1, m)) for (let i = Math.max(I0, lo(a)); i < Math.min(I1, lo(b)); i++) {
        if (empty && g[n(i, j, k)]) continue;
        const c = fn(i + 0.5, j + 0.5, k + 0.5); if (c) g[n(i, j, k)] = c;
      }
    },
  };
  return B;
}

// ---- the shell ----
function shell(B, S, wk, bars) {
  const { I0, K0, K1, NY, NX, L, g, HW, P } = B;
  const wy = wk.R - wk.lift, aR = S.aR, cutX = S.cutX, sq4 = S.squareArch;
  const G = [P(GLASS), P(GLASS2), P(SHINE)], FR = P(S.frame), BAR = P(GUNMETAL);
  const archD = (dz, dy) => (sq4 ? Math.pow(Math.pow(ab(dz), 4) + Math.pow(ab(dy), 4), 0.25) : hyp(dz, dy));
  S.archAt = (z, y) => { let d = 1e9; for (const a of S.ax) d = Math.min(d, archD(z - a, y - wy)); return d; };
  const win = (z, y, s) => S.win.some((w) => (!w[6] || w[6] === s) && inWin(w, z, y));
  const rows = (k) => (k - K0) * NY;
  for (let k = Math.max(K0, lo(S.zT)); k < Math.min(K1, lo(S.zN)); k++) {
    const z = k + 0.5, t = S.top(z), b = S.bot(z), bl = S.belt(z);
    let W = S.Wz ? S.Wz(z) : S.W;
    const dn = z - (S.zN - S.noseR); if (dn > 0) W -= S.noseR - sq(Math.max(0, S.noseR * S.noseR - dn * dn));
    const dt = S.zT + S.tailR - z; if (dt > 0) W -= S.tailR - sq(Math.max(0, S.tailR * S.tailR - dt * dt));
    for (let j = Math.max(0, lo(b)); j < Math.min(NY, lo(t)); j++) {
      const y = j + 0.5;
      let w = W;
      if (y >= bl) {   // the glass house leans in, and its roof edge is rounded
        w -= S.gIn + S.tumble * clamp((y - bl) / (S.roofY - bl));
        const dy = y - (t - S.rr); if (dy > 0) w -= S.rr - sq(Math.max(0, S.rr * S.rr - dy * dy));
      } else {         // the bonnet's and boot's edges, the shoulder under the glass, the bottom edge
        const r = t <= bl + 0.5 ? S.sr : S.ssr, tt = Math.min(t, bl), dy = y - (tt - r);
        if (r > 0 && dy > 0) w -= r - sq(Math.max(0, r * r - dy * dy));
        const db = b + S.br - y; if (db > 0) w -= S.br - sq(Math.max(0, S.br * S.br - db * db));
      }
      if (w <= 0) continue;
      HW[rows(k) + j] = w;
      const arch = y < bl + 0.5 ? S.archAt(z, y) : 1e9, inArch = arch < aR;
      const wIn = S.hwIn ? S.hwIn(z, y, S, arch) : 0;
      const wns = (s) => (win(z, y, s) ? 1 : (win(z + 1, y, s) || win(z - 1, y, s) || win(z, y + 1, s) || win(z, y - 1, s)) ? 2 : 0);
      let wnL = 0, wnR = 0;
      if (y >= bl + 0.5 && y < t - 0.5) { wnL = wns(1); wnR = wns(-1); }
      const gc = G[((k + j * 2) % 19 + 19) % 19 < 2 ? 2 : y > S.roofY - 6 ? 1 : 0];
      const row = (k - K0) * L + j * NX - I0, iw = Math.ceil(w);
      for (let i = -iw; i < iw; i++) {
        const x = i + 0.5, a = ab(x);
        if (a >= w || a < wIn) continue;
        const wn = x > 0 ? wnL : wnR;
        let r = wIn > 0 && a < wIn + 1.5 ? BEDF : PAINT;
        if (inArch) { if (a > cutX) continue; if (a > cutX - 1.5) r = LINER; }
        else if (S.hwIn && wIn > 0 && a < cutX && arch < aR + 2) r = BEDF;
        if (wn === 1) {
          if (a >= w - 1) { if (bars && (fl(z) % 5 === 0 || ab(y - (S.win[0][4] + S.win[0][5]) / 2) < 0.5)) r = BAR; else continue; }
          else if (a >= w - 2) r = gc;
        } else if (wn === 2 && a >= w - 1) r = FR;
        g[row + i] = r;
      }
    }
  }
}

// ---- the paint job ----
function painter(S, o) {
  const base = PAINTS[o.paint] ?? PAINTS.orange, trim = PAINTS[o.trim] ?? PAINTS.black, pattern = o.pattern || 'plain', seed = o.seed || 0;
  const ck = (trim >> 16) + ((trim >> 8) & 255) + (trim & 255) > 560 ? TRIM : trim;
  const fz = S.flame.z0, fl0 = S.flame.len;
  // x, y, z: the cube's centre. up: its top shows. sd: a side shows. bl: the belt here.
  return (i, j, k, x, y, z, ax, up, sd, bl) => {
    let c = tone(base, y < S.c0 + 4 ? S.lowTone : y > bl - 3 && y < bl + 0.5 ? 1.06 : up ? 1.03 : 1);
    switch (pattern) {
      case 'stripes': if (ax >= S.stripe[0] && ax < S.stripe[1]) c = trim; break;
      case 'flames':
        if (sd && !up && y < bl) {   // licks of flame back along each flank from the front wheel
          const u = fz - z;
          if (u >= 0 && u < fl0) { const mid = (S.c0 + bl) / 2 + 1, amp = (bl - S.c0) / 2 * (1 - u / fl0) * (0.62 + 0.38 * Math.sin(u * 0.37 + (x > 0 ? 0 : 1.7))) + 0.9, f = ab(y - mid) / amp; if (f < 1) c = FLAME[f < 0.42 ? 0 : f < 0.75 ? 1 : 2]; }
        } else if (up && z > S.flame.bonnet && y < bl + 0.5) {   // and back along the bonnet
          const u = S.zN - 2 - z, len = Math.min(45, S.zN - S.flame.bonnet);
          if (u >= 0 && u < len) { const amp = 5.4 * (1 - u / len) * (0.6 + 0.4 * Math.sin(u * 0.47)) + 0.8, f = ab(ax - 9.5) / amp; if (f < 1) c = FLAME[f < 0.42 ? 0 : f < 0.75 ? 1 : 2]; }
        }
        break;
      case 'camo': { const nz = noise(x / 10.5, y / 10.5, z / 10.5, seed + 9); c = nz < 0.42 ? c : nz < 0.6 ? tone(trim, y < S.c0 + 4 ? 0.86 : 1) : tone(base, 0.55); break; }
      case 'checker':
        if (!up && y >= bl - 9 && y < bl - 3) c = ((fl(z / 3) + fl(y / 3)) & 1) ? ck : CHECKW;
        else if (up && ax < 4.5) c = ((fl(z / 3) + fl(x / 3)) & 1) ? ck : CHECKW;
        break;
      case 'rust': { const nz = noise(x / 7.5, y / 7.5, z / 7.5, seed + 4), r = hash(i, j, k, seed + 2); if (nz > 0.6) c = RUST[fl(r * 3)]; else if (nz > 0.54) c = tone(c, 0.72); break; }
    }
    return c;
  };
}
// fake wood grain, running along the car
function wood(x, y, z) {
  const t = y * 0.55 + 2.4 * noise(z / 16, y / 5, x > 0 ? 3 : 7, 21) + 0.5 * Math.sin(z / 6.5 + y * 0.8);
  const f = t - fl(t), v = f < 0.12 ? 0 : f < 0.3 ? 1 : f < 0.55 ? 2 : f < 0.8 ? 3 : 4;
  return WOOD[v];
}

// ---- details used by more than one body ----
// a bumper: the empty cubes of a slab across the end, wrapped round the corners. end: 1 front, -1 back.
function bumper(B, S, end, y0, y1, out, wrap, col, side = 1) {
  const zf = end > 0 ? S.zN + out : S.zT - out, zi = end > 0 ? S.zN - wrap : S.zT + wrap, rc = (end > 0 ? S.noseR : S.tailR) + out * 0.6 + 1;
  const Wb = (S.Wmax || S.W) + side;
  B.fill(0, Wb, y0, y1, Math.min(zf, zi), Math.max(zf, zi), (x, y, z) => {
    const dz = end > 0 ? z - (zf - rc) : zf + rc - z, w = Wb - (dz > 0 ? rc - sq(Math.max(0, rc * rc - dz * dz)) : 0);
    return Math.abs(x) < w ? col(x, y, z) : 0;
  }, true, true);
}
// the colours of a chrome bumper with a rubber strip
function chromeBar(B, y0, y1, strip = true) {
  const C = B.P(CHROME), CL = B.P(CHROMEL), CD = B.P(CHROMED), R = B.P(RUBBER);
  return (x, y) => { const u = (y - y0) / (y1 - y0); return y > y1 - 1 ? CL : y < y0 + 1 ? CD : strip && u > 0.38 && u < 0.62 ? R : C; };
}
// a lamp: lens cut one cube in, bezel round it. shape(x, y) is 2 in the lens, 1 on the bezel.
function lamp(B, end, x0, x1, y0, y1, shape, lens, bezel, m = true) {
  const f = (x, y) => { const s = shape(x, y); return s === 2 ? [lens(x, y), -1] : s === 1 ? [bezel, 0] : 0; };
  if (end > 0) B.front(x0, x1, y0, y1, f, 0, m); else B.back(x0, x1, y0, y1, f, 0, m);
}
const rectShape = (x0, x1, y0, y1, b = 1) => (x, y) => { const a = ab(x); return a >= x0 + b && a < x1 - b && y >= y0 + b && y < y1 - b ? 2 : a >= x0 && a < x1 && y >= y0 && y < y1 ? 1 : 0; };
const roundShape = (cx, cy, r, b = 0.9) => (x, y) => { const d = hyp(ab(x) - cx, y - cy); return d < r - b ? 2 : d < r ? 1 : 0; };
// a headlamp lens: bright in the middle, ribbed round it
const headLens = (B, cx, cy) => { const a = B.P(LAMP), w = B.P(LAMPW), c = B.P(LAMP2); return (x, y) => { const d = hyp(ab(x) - cx, y - cy); return d < 1.3 ? w : ((fl(ab(x)) + fl(y)) % 3 === 0) ? c : a; }; };
// a number plate: a frame, white, a few blue figures
function numberPlate(B, end, cy, hwid, ht, seed, d = 0) {
  const W_ = B.P(PLATEW), K = B.P(INK), F = B.P(TRIM);
  const f = (x, y) => { const a = ab(x); if (a >= hwid - 1 || y < cy - ht / 2 + 1 || y >= cy + ht / 2 - 1) return F; const ch = fl((x + hwid) / 2.5); return (ch % 4 !== 3) && ab(y - cy) < ht / 2 - 1.6 && hash(ch, fl(y), 3, seed) < 0.6 ? K : W_; };
  if (end > 0) B.front(-hwid, hwid, cy - ht / 2, cy + ht / 2, f, d, false); else B.back(-hwid, hwid, cy - ht / 2, cy + ht / 2, f, d, false);
}
// a pipe along z: a ring of chrome with a dark bore, from z0 to z1
function pipe(B, x, y, z0, z1, r = 1.7) {
  const C = B.P(CHROME), D = B.P(HOLE), CD = B.P(CHROMED);
  const K = B.P(CHASSIS);   // dark steel under the car, a chrome tip out the back
  B.fill(x - r, x + r, y - r, y + r, z0, z1, (px, py, pz) => { const d = hyp(px - x, py - y); return d < r ? (d < r * 0.45 && (pz < z0 + 1 || pz > z1 - 1) ? D : pz > z0 + 1.6 ? K : py < y - 0.6 ? CD : C) : 0; }, false);
}
// shut lines: a vertical line on both sides
const seamV = (B, z, y0, y1, col = SEAM) => B.side(z - 0.5, z + 0.5, y0, y1, () => col);
const seamH = (B, z0, z1, y, col = SEAM) => B.side(z0, z1, y - 0.5, y + 0.5, () => col);
// a door handle: proud of the door, with a shadowed recess under it
function handle(B, z0, z1, y, col, sides = 3) {
  B.side(z0, z1, y - 1, y, () => LO, 0, sides);
  B.side(z0, z1, y, y + 1, () => col, 1, sides);
}
// side marker lamps
const marker = (B, z0, z1, y0, y1, col) => { const c = B.P(col), b = B.P(TRIM); B.side(z0 - 0.5, z1 + 0.5, y0 - 0.5, y1 + 0.5, (z, y) => (z > z0 && z < z1 && y > y0 && y < y1 ? c : b)); };
// a mirror on each front door
function mirrors(B, S, style, paint) {
  const z = S.mirror.z, bl = S.belt(z), w = B.hw(fl(bl) + 1, fl(z)) || S.W - S.gIn;
  const H_ = B.P(style === 'chrome' ? CHROME : TRIM), G = B.P(MIRRORG), A = B.P(TRIM);
  if (style === 'big') {   // a tall mirror on two arms
    const x0 = S.W + 1.5, y0 = bl + 1.5, y1 = bl + 11;
    B.fill(w - 1, x0 + 3, y0 + 1, y0 + 2, z - 1, z, () => A);
    B.fill(w - 1, x0 + 3, y1 - 2, y1 - 1, z - 1, z, () => A);
    B.fill(x0 + 2, x0 + 5, y0 - 0.5, y1 + 0.5, z - 2.5, z + 1.5, (x, y, zz) => (zz < z - 1.5 ? G : A));
    return;
  }
  const x0 = S.W - 1, xo = x0 + (style === 'chrome' ? 3 : 3.5);
  B.fill(w - 1, x0 + 1, bl + 0.5, bl + 1.5, z - 1, z + 1, () => (paint ? PAINT : A));   // the stalk
  B.fill(x0 + 0.5, xo + 0.5, bl + 1, bl + 4, z - 2, z + 1.5, (x, y, zz) => (zz < z - 1 && ab(x) > x0 + 1.2 && y > bl + 1.5 && y < bl + 3.5 ? G : style === 'small' && paint ? PAINT : H_));
}
// the black or chrome lip round the wheel arches; out: how far it stands proud
function archLip(B, S, wk, col, width, out, yMin) {
  const wy = wk.R - wk.lift;
  for (const a of S.ax) B.side(a - S.aR - width - 1, a + S.aR + width + 1, Math.max(yMin ?? wy - 3, 0), wy + S.aR + width + 1, (z, y) => { const d = S.archAt(z, y); return d >= S.aR - 0.4 && d < S.aR + width && y > (yMin ?? wy - 3) ? col : 0; }, out, 3, 2.6);
}
// the cowl: a vent across the base of the windscreen, and two wiper arms on the glass
function cowl(B, S, zc) {
  const V = B.P(PLASTIC), T = B.P(TRIM);
  B.top(0, S.W - 3, zc + 0.3, zc + 2.6, (x) => ((fl(x) & 1) ? V : T));
  for (const x0 of [-S.W * 0.62, -S.W * 0.05]) for (let t = 0; t <= 1; t += 0.04) {
    const x = x0 + S.W * 0.52 * t, y = S.ws.ylo + 0.6 + 2.6 * t * t;
    const i = fl(x), j = fl(y); let k = B.K1 - 1; while (k >= B.K0 && !B.get(i, j, k)) k--; if (k >= B.K0) B.put(i, j, k, T);
  }
}

// a round bar from a to b ([x, y, z]), r thick, on both sides unless m is false
function rod(B, a, b, r, col, m = true) {
  const n = Math.max(2, Math.ceil(hyp(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 2));
  for (let s = 0; s <= n; s++) {
    const t = s / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
    for (const sx of m ? [1, -1] : [1]) {
      const px = x * sx;
      for (let i = fl(px - r); i <= fl(px + r); i++) for (let j = fl(y - r); j <= fl(y + r); j++) for (let k = fl(z - r); k <= fl(z + r); k++)
        if (hyp(i + 0.5 - px, j + 0.5 - y, k + 0.5 - z) < r + 0.25) B.put(i, j, k, col);
    }
  }
}

// ---- the five bodies' own details ----
const DETAIL = {
  // an early-80s European hot hatch: lamps in a black grille edged in red, thick black bumpers, black arch extensions
  hatch(B, S, c) {
    const { P } = B, zN = S.zN, zT = S.zT, W = S.W;
    const PL = P(PLASTIC), T = P(TRIM), R = P(PIN), A = P(AMBER), G1 = P(GRILLE), G2 = P(GRILLE2), CH = P(CHROME);
    // the grille: a black band right across, slatted, set in; a thin red line round its top
    B.front(0, 19.4, 12.4, 18.2, (x, y) => [(fl(y) & 1) ? G1 : G2, -1]);
    B.front(0, 20.4, 18.2, 19.2, () => R);
    B.front(19.4, 20.4, 12.4, 18.2, () => R);
    // round lamps at its ends, small driving lamps inboard
    lamp(B, 1, 10.5, 19.3, 11.8, 19.4, roundShape(14.8, 15.4, 3.6), headLens(B, 14.8, 15.4), CH);
    lamp(B, 1, 6, 11, 12.6, 18, roundShape(8.4, 15.3, 2.3, 0.8), () => P(LAMP2), CH);
    // the thick black bumpers, a groove along them, a chin spoiler under the front
    bumper(B, S, 1, 6.5, 12.6, S.bumpF, 6, (x, y) => (ab(y - 10) < 0.5 ? T : PL));
    B.fill(0, W - 3, 4.4, 6.5, zN - 5, zN + 0.5, () => PL, true, true);
    B.front(14.5, 19.5, 7.5, 9.5, () => A);
    bumper(B, S, -1, 6.5, 13, S.bumpR, 6, (x, y) => (ab(y - 10) < 0.5 ? T : PL));
    numberPlate(B, -1, 9.8, 7.5, 5, c.seed, -1);
    // the tail lamps: red outboard, amber and reversing lamps inboard, ribbed, in a black housing
    const TL = P(TAIL), T2 = P(TAIL2), RV = P(REV), HS = P(TRIM);
    B.back(8.5, 20.4, 13.6, 20.6, (x, y) => { const a = ab(x); if (a < 9.5 || a >= 19.6 || y < 14.6 || y >= 19.8) return HS; if (a < 13) return y > 17.2 ? A : RV; return (fl(y) & 1) ? TL : T2; });
    // a rear wiper on the hatch glass
    for (let t = 0; t <= 1; t += 0.05) { const x = -0.5 - 9 * t, y = 25.6 + 5 * t; const i = fl(x), j = fl(y); let k = B.K0; while (k < B.K1 && !B.get(i, j, k)) k++; if (k < B.K1) B.put(i, j, k, T); }
    pipe(B, -13, 5.2, zT - 3.2, zT + 3);
    // the sides: black sills (the paint pass), a rubbing strip, shut lines, a pull handle, a fuel flap, black arch extensions
    B.side(S.ax[1] + 11, S.ax[0] - 10.5, 12.6, 14.4, () => PL, 1);
    seamV(B, 21.6, S.c0 + 3, S.belt(21.6) + 0.2); seamV(B, -14, S.c0 + 3, S.belt(-14) + 0.2);
    handle(B, -12.6, -8.4, 19.4, PL);
    B.side(-23.5, -19.5, 16.5, 20, (z, y) => (ab(z + 21.5) > 1.4 || ab(y - 18.25) > 1.2 ? SEAM : 0), 0, 2);
    archLip(B, S, c.wk, PL, 2.4, 1);
    marker(B, 40, 42, 17, 18.6, AMBER);
    // the bonnet's shut lines, the tailgate's
    B.top(17.4, 18.4, S.cowl + 2.5, zN - 1, () => SEAM);
    B.back(0, W - 2, 21.4, 22.2, () => SEAM);
    cowl(B, S, S.cowl);
    mirrors(B, S, 'small', false);
  },

  // a mid-70s full-size American station wagon: long, wood sides with a light border, chrome everywhere, stacked lamps
  wagon(B, S, c) {
    const { P } = B, zN = S.zN, zT = S.zT, W = S.W;
    const CH = P(CHROME), CL = P(CHROMEL), CD = P(CHROMED), G1 = P(GRILLE), G2 = P(GRILLE2), A = P(AMBER), WB = P(WOODB), WD = P(WOODD), R = P(RUBBER);
    // a wide chrome grille between stacked pairs of square lamps, a bright strip along the nose
    B.front(0, 12.6, 11.8, 20.4, (x, y) => { const a = ab(x); if (a >= 11.6 || y < 12.8 || y >= 19.4) return [CH, 0]; return (fl(a) % 4 === 1 || fl(y - 12.8) % 3 === 2) ? [CH, 0] : [(fl(y) & 1) ? G1 : G2, -1]; });
    B.front(12.6, 22, 11.8, 21, (x, y) => (ab(x) >= 21.4 || y >= 20.4 || y < 12.4 ? CH : 0));
    for (const [y0, y1] of [[12.4, 16.4], [16.4, 20.4]]) lamp(B, 1, 12.6, 21.4, y0, y1, rectShape(12.6, 21.4, y0, y1, 1), headLens(B, 17, (y0 + y1) / 2), P(HOUSING));
    B.front(0, 22, 20.4, 21.2, () => CL);
    // chrome bumpers with a rubber strip and guards, parking lamps in the front one
    bumper(B, S, 1, 6.4, 12, S.bumpF, 8, chromeBar(B, 6.4, 12));
    B.front(14.5, 19.5, 10.2, 11.6, () => A);
    for (const gx of [8, 10.5]) B.front(gx - 0.01, gx + 1.01, 6.4, 12, () => R, 1);
    bumper(B, S, -1, 6.4, 12, S.bumpR, 8, chromeBar(B, 6.4, 12));
    numberPlate(B, -1, 9.2, 6.5, 4.6, c.seed, -1);
    // the tailgate: glass with a chrome surround, a wood panel framed light, upright tail lamps in the corners
    const TL = P(TAIL), T2 = P(TAIL2), RV = P(REV);
    B.back(0, W - 3.6, 23.2, 34.4, (x, y) => (ab(x) < W - 4.6 && y >= 24.2 && y < 33.4 ? [(((fl(x + y * 1.4) % 17) + 17) % 17 < 2) ? P(SHINE) : P(GLASS), -1] : CH));
    B.back(0, 15, 12, 21.6, (x, y) => (ab(x) >= 14 || y < 13 || y >= 20.6 ? WB : WOODR));
    B.back(15.6, W, 9.6, 21.6, (x, y) => { const a = ab(x); if (a < 16.6 || y < 10.6 || y >= 20.6) return CH; if (y < 13) return RV; return (fl(y) % 3 === 0) ? CH : (fl(y) & 1) ? TL : T2; });
    B.side(zT, zT + 2.5, 10.6, 20.6, (z, y) => ((fl(y) & 1) ? TL : T2));
    pipe(B, -15, 5, zT - 3.6, zT + 3);
    // the long wood panels down both sides, bordered in light trim, broken by the arches and the doors
    const wz0 = zN - 6, wz1 = zT + 0.5, wy0 = 9.6, wy1 = 20.4, wy = c.wk.R - c.wk.lift;
    B.side(wz1, wz0, wy0, wy1, (z, y) => {
      const d = S.archAt(z, y);
      if (d < S.aR + 1.2) return d >= S.aR - 0.4 ? WB : 0;
      if (y < wy0 + 1 || y >= wy1 - 1 || z >= wz0 - 1 || z < wz1 + 0.6) return WB;
      return WOODR;
    }, 0, 3, 1.6);
    B.side(wz1, wz0, wy0 - 1.6, wy0 - 0.6, (z, y) => (S.archAt(z, y) > S.aR + 0.6 ? CH : 0));   // the chrome rocker strip
    for (const z of [21.5, -8, -27.6]) B.side(z - 0.5, z + 0.5, S.c0 + 3, S.belt(z) + 0.2, (zz, y) => (y >= wy0 - 1.6 && y < wy1 ? WD : SEAM));
    for (const z of [-8, -27.6]) handle(B, z + 1.6, z + 5, 21, CH);
    marker(B, zN - 5.5, zN - 2.5, 14, 16, AMBER);
    marker(B, zT + 2.5, zT + 5.5, 16, 18, TAIL);
    // the bonnet: a crease down the middle, shut lines, a bright strip at the windscreen
    B.top(0, 0.6, S.cowl + 3, zN - 1.5, () => HI);
    B.top(W - 3, W - 2, S.cowl + 2.5, zN - 1.2, () => SEAM);
    cowl(B, S, S.cowl);
    // roof rails on posts, and one cross bar at the back
    const ry = S.roofY + 0.5;
    B.fill(15.4, 17.6, ry + 1.4, ry + 2.8, -54, 3.5, (x, y) => (y > ry + 2.2 ? CL : CH));
    for (const z of [-53, -38, -23, -8, 2]) B.fill(15.6, 17.4, ry - 0.6, ry + 1.4, z - 1, z + 1, () => CD);
    B.fill(0, 15.4, ry + 1.6, ry + 2.6, -51.5, -49.5, () => CH);
    mirrors(B, S, 'chrome');
  },

  // a late-60s fastback muscle coupe: a dark grille right across with the lamps hidden, a scooped bonnet, a ducktail
  muscle(B, S, c) {
    const { P } = B, zN = S.zN, zT = S.zT, W = S.W;
    const CH = P(CHROME), CL = P(CHROMEL), G1 = P(GRILLE), G2 = P(GRILLE2), A = P(AMBER), D = P(HOLE), T = P(TRIM);
    // the grille: set in two cubes, fine bars, a chrome surround; the lamp covers at the ends show as a thin split
    B.front(0, 21.6, 8.6, 18.6, (x, y) => { const a = ab(x); if (a >= 20.6 || y < 9.6 || y >= 17.6) return [CH, 0, 3]; if (a < 1) return [PAINT, 0, 2]; if (ab(a - 12.5) < 0.5) return [G2, -1]; return [(fl(y) & 1) ? G1 : G2, -2]; });
    // a slim chrome bumper, the valance under it with its turn lamps
    bumper(B, S, 1, 6.4, 9.2, S.bumpF, 6, (x, y) => (y > 8.4 ? CL : CH));
    B.front(13, 17.5, 5, 6.4, () => A);
    // the bonnet: a raised scoop with a dark mouth, pins at the front, shut lines
    B.top(0, 5.6, 27, 46, (x, z) => (z > 44.5 && ab(x) < 4.6 ? 0 : PAINT), 2);
    B.front(0, 4.6, S.top(45), S.top(45) + 2, () => D);
    for (const px of [15.5]) B.top(px - 0.5, px + 1.5, 49, 51, () => CH, 1);
    B.top(W - 3.5, W - 2.5, S.cowl + 3, zN - 1.5, () => SEAM);
    cowl(B, S, S.cowl);
    // the sides: a long scallop in the doors, shut lines, a flush handle, marker lamps, a pop-open fuel cap, sail louvres
    B.side(-26, 22, 10.5, 15.6, (z, y) => { const u = clamp((z + 26) / 10); return y < 10.5 + 5.1 * (1 - u) ? 0 : [LO, -1]; });
    seamV(B, 19.2, S.c0 + 3, S.belt(19.2) + 0.2); seamV(B, -9, S.c0 + 3, S.belt(-9) + 0.2);
    handle(B, -7.6, -3.6, 18.6, CH);
    marker(B, 47, 51, 12.6, 14.4, AMBER); marker(B, -50, -46, 14.4, 16.2, TAIL);
    B.side(-46, -42, 16.6, 20.6, (z, y) => (hyp(z + 44, y - 18.6) < 2 ? CH : 0), 1, 1);
    B.side(-30, -21, 23.6, 28.8, (z, y) => ((fl(y) & 1) && z > -29.4 + (y - 23.6) * 0.6 ? [T, -1] : 0), 0, 3, 2);
    // the tail: a black panel set in, long tail lamps either side, a slim bumper, the plate under it, twin pipes
    const TL = P(TAIL), T2 = P(TAIL2);
    B.back(0, W - 1.5, 12, 20.6, (x, y) => { const a = ab(x); if (a >= W - 2.5 || y < 13 || y >= 19.6) return [CH, 0]; if (a > 7.5 && a < W - 3.6 && y > 13.8 && y < 18.8) return [(fl(y) & 1) ? TL : T2, -1]; return [T, -1]; });
    bumper(B, S, -1, 9, 11.8, S.bumpR, 6, (x, y) => (y > 11 ? CL : CH));
    numberPlate(B, -1, 16.2, 6, 4.4, c.seed);
    pipe(B, 14.5, 5.4, zT - 2.4, zT + 4); pipe(B, -14.5, 5.4, zT - 2.4, zT + 4);
    B.back(0, W - 3, 22, 22.8, () => SEAM);
    mirrors(B, S, 'chrome');
  },

  // a late-70s square-body pickup: tall flat cab, upright chrome grille with stacked square lamps, an open bed with rails
  pickup(B, S, c) {
    const { P } = B, zN = S.zN, zT = S.zT, W = S.W;
    const CH = P(CHROME), CL = P(CHROMEL), CD = P(CHROMED), G1 = P(GRILLE), A = P(AMBER), T = P(TRIM), GM = P(GUNMETAL), ST = P(STEEL);
    // the grille: an egg crate of chrome, set in, inside a chrome surround that takes in the lamps
    B.front(0, 22, 15.4, 29.2, (x, y) => (ab(x) >= 21 || y < 16.4 || y >= 28.4 ? [CH, 0] : 0));
    B.front(0, 13.6, 16.4, 28.4, (x, y) => { const a = ab(x); if (a >= 12.6) return [CH, 0]; return fl(y - 16.4) % 4 === 0 ? [ab(y - 22.4) < 1 ? CL : CH, 0, 2] : fl(a) % 4 === 0 ? [CD, 0, 2] : [G1, -2]; });
    for (const [y0, y1] of [[23.2, 28.4], [18, 23.2]]) lamp(B, 1, 13.4, 21, y0, y1, rectShape(13.4, 21, y0, y1, 1), headLens(B, 17.2, (y0 + y1) / 2), P(HOUSING));
    B.front(13.6, 21, 16.4, 18.6, () => A);
    bumper(B, S, 1, 9.4, 15.4, S.bumpF, 5, chromeBar(B, 9.4, 15.4, false));
    B.top(W - 2.2, W - 1.2, S.cowl + 2, zN - 1, () => SEAM);
    cowl(B, S, S.cowl);
    // the sides: a crease all along, shut lines, a handle, marker lamps, a fuel door on the bed
    B.side(zT + 0.5, zN - 1, 25.6, 26.6, () => LO);
    B.side(zT + 0.5, zN - 1, 26.6, 27.4, () => HI);
    seamV(B, 18.6, S.c0 + 3, 30.2); seamV(B, -4.6, S.c0 + 3, 30.2);
    handle(B, -3.2, 0.4, 28, CH);
    marker(B, 52, 55.5, 22, 24, AMBER); marker(B, zT + 2.5, zT + 6, 22, 24, TAIL);
    B.side(-23, -17, 21, 25.4, (z, y) => (z < -22.4 || z > -17.6 || y < 21.6 || y > 24.8 ? SEAM : 0), 0, 1);
    // the vent window at the front of each door window
    B.side(10.8, 11.8, 31.6, 41.6, () => CH, 0, 3, 3);
    // the cab's back window
    B.back(0, 13, 32, 41.6, (x, y) => (ab(x) >= 12 || y < 33 || y >= 40.6 ? T : [(((fl(x + y * 1.6) % 15) + 15) % 15 < 2) ? P(SHINE) : P(GLASS), -1]));
    // the bed: black caps on its walls, stake pockets, ribs on the floor, chrome rails on posts
    const bz0 = S.bedZ[1] + 1, bz1 = S.bedZ[0] - 0.5;
    B.top(W - 2.2, W, zT + 0.2, S.bedZ[0] + 1, (x, z) => ((ab(z + 13) < 1 || ab(z + 32) < 1 || ab(z + 55) < 1) && ab(x) < W - 0.8 ? P(HOLE) : T));
    B.top(0, W - 4, bz0, bz1, (x) => (fl(x + 0.5) % 5 === 0 ? BEDF : 0), 1);
    B.fill(W - 2, W, 31.6, 32.8, -56, -11, (x, y) => (y > 32.2 ? CL : CH));
    for (const z of [-55, -33.5, -12]) B.fill(W - 1.8, W - 0.2, 29.8, 31.6, z - 1, z + 1, () => CD);
    // the tailgate: a pressed panel and handle; upright tail lamps in the bed corners; a chrome step bumper and plate
    const TL = P(TAIL), T2 = P(TAIL2), RV = P(REV);
    B.back(0, 17, 15.6, 27.4, (x, y) => (ab(x) > 16 || y < 16.6 || y > 26.4 ? SEAM : ab(x) < 3 && y > 24.4 ? T : y > 25.4 ? HI : 0));
    B.back(17.6, W, 15.4, 29, (x, y) => { const a = ab(x); if (a < 18.6 || y < 16.4 || y >= 28) return CH; if (y < 19) return RV; if (y < 21) return A; return (fl(y) & 1) ? TL : T2; });
    bumper(B, S, -1, 9.4, 15.4, S.bumpR, 5, chromeBar(B, 9.4, 15.4, false));
    numberPlate(B, -1, 12.4, 6.5, 4.6, c.seed, -1);
    pipe(B, -17, 6.6, zT - 3.4, zT + 4);
    // the gun's post in the bed: a column on a plate, braced to the walls
    const pz = S.turret.z, py = S.turret.y;
    B.fill(0, 6, S.bedY, S.bedY + 1, pz - 6, pz + 6, (x, y, z) => (hyp(x, z - pz) < 6 ? GM : 0));
    B.fill(0, 3.2, S.bedY, py, pz - 3.2, pz + 3.2, (x, y, z) => (hyp(x, z - pz) < 3.2 ? (y > py - 2 ? ST : GM) : 0));
    for (let t = 0; t <= 1; t += 0.02) { const x = 2 + (W - 4.5) * t, y = py - 6 - (py - 6 - 29) * t; B.fill(x - 0.6, x + 0.6, y - 0.6, y + 0.6, pz - 0.6, pz + 0.6, () => GM); }
    mirrors(B, S, 'big');
  },

  // an early-80s American panel van: a tall box, a short sloping nose, blank sides with a porthole, a sliding door, twin
  // rear doors with a ladder
  van(B, S, c) {
    const { P } = B, zN = S.zN, zT = S.zT, W = S.W;
    const CH = P(CHROME), CL = P(CHROMEL), G1 = P(GRILLE), G2 = P(GRILLE2), A = P(AMBER), T = P(TRIM), GM = P(GUNMETAL), ST = P(STEEL);
    // the grille: chrome bars across, between square lamps
    B.front(0, 22, 16, 25.6, (x, y) => (ab(x) >= 21 || y < 17 || y >= 24.6 ? [CH, 0] : 0));
    B.front(0, 12.6, 17, 24.6, (x, y) => (ab(x) >= 11.6 ? [CH, 0] : fl(y) % 2 === 0 ? [CH, 0] : [(fl(ab(x)) % 2) ? G1 : G2, -1]));
    lamp(B, 1, 12.6, 21, 17, 24.6, rectShape(12.6, 21, 17, 24.6, 1), headLens(B, 16.8, 20.8), P(HOUSING));
    B.front(13, 20.6, 14, 16, () => A);
    bumper(B, S, 1, 8.6, 14, S.bumpF, 6, chromeBar(B, 8.6, 14));
    B.top(W - 4, W - 3, S.cowl + 2, zN - 1.5, () => SEAM);
    cowl(B, S, S.cowl);
    // the cab doors, the vent windows, handles, marker lamps, a crease along the body
    seamV(B, 35.2, S.c0 + 3, 33.4); seamV(B, 11, S.c0 + 3, 49);
    B.side(27, 28, 34.8, 48.4, () => T, 0, 3, 3);
    handle(B, 12.6, 16.2, 31, CH);
    marker(B, 48.5, 51.5, 20, 22, AMBER); marker(B, zT + 1.5, zT + 4.5, 43, 45, TAIL);
    B.side(zT + 1, 33, 29.6, 30.4, (z) => (z > 12 && z < 17 ? 0 : LO), 0, 1);
    // the sliding door on the right (-x): its shut lines, its track back along the side, its handle
    B.side(-21.5, 9, S.c0 + 3, 49.4, (z, y) => (ab(z - 8.5) < 0.5 || ab(z + 21) < 0.5 || ab(y - 48.9) < 0.5 || y < S.c0 + 3.6 ? SEAM : 0), 0, 2);
    B.side(zT + 2, -21, 29.6, 30.6, () => T, 0, 2);
    B.side(zT + 1, -21, 30.6, 31.2, () => LO, 0, 2);
    handle(B, 4.6, 8, 31, CH, 2);
    // a porthole on each side, behind the doors
    const pz = -35, py = 40.5;
    B.side(pz - 5.2, pz + 5.2, py - 5.2, py + 5.2, (z, y) => { const d = hyp(z - pz, y - py); return d < 3.6 ? [((fl(z) + fl(y)) % 7 < 1) ? P(SHINE) : P(GLASS), -1] : d < 4.8 ? [d < 4.2 ? CL : CH, 1] : 0; });
    // the rear: twin doors, their windows, handles and hinges; tall tail lamps; the ladder
    B.back(-0.5, 0.5, S.c0 + 4, 50, () => SEAM, 0, false);
    B.back(2.6, 17.4, 34.4, 47, (x, y) => (ab(x) < 3.6 || ab(x) >= 16.4 || y < 35.4 || y >= 46 ? T : [(((fl(x + y * 1.5) % 13) + 13) % 13 < 2) ? P(SHINE) : P(GLASS), -1]));
    B.back(0.5, 3.5, 27.4, 29, () => CH, 1, false);
    for (const hy of [16, 42]) B.back(20.4, 22, hy, hy + 3, () => T, 1);
    const TL = P(TAIL), T2 = P(TAIL2), RV = P(REV);
    B.back(19.4, W - 0.2, 13.6, 32, (x, y) => { if (y < 14.6 || y >= 31) return T; if (y < 18) return RV; if (y < 21) return A; return (fl(y) & 1) ? TL : T2; });
    bumper(B, S, -1, 8.6, 14, S.bumpR, 6, chromeBar(B, 8.6, 14));
    numberPlate(B, -1, 11.3, 6.5, 4.6, c.seed, -1);
    pipe(B, -16, 6.4, zT - 3.4, zT + 3);
    // the ladder up the left door and over the roof edge
    const lx = [8.4, 15.4], lz = zT - 1.6;
    for (const x of lx) { B.fill(x, x + 1.2, 15, 53.4, lz - 1.2, lz, () => GM, false); B.fill(x, x + 1.2, 52.2, 53.4, lz, zT + 4, () => GM, false); B.fill(x, x + 1.2, 15, 52.2, lz, zT + 0.5, (px, py) => (fl(py) % 9 === 0 ? ST : 0), false); }
    for (let y = 18; y < 52; y += 4) B.fill(lx[0], lx[1] + 1.2, y, y + 1, lz - 1.2, lz, () => ST, false);
    mirrors(B, S, 'big');
  },
  // a dune buggy: an open fibreglass tub, a roll cage over it with lamps on top, a bull bar with driving lamps, nerf
  // bars along the sides, a flat engine out in the open at the back
  buggy(B, S, c) {
    const { P } = B, zN = S.zN, zT = S.zT;
    const T = P(TRIM), PL = P(PLASTIC), CH = P(CHROME), CL = P(CHROMEL), CD = P(CHROMED), GM = P(GUNMETAL), ST = P(STEEL), DK = P(DARKS), RB = P(RUBBER);
    const LA = P(LAMP), LW = P(LAMPW), WH = P(PLATEW);
    // a black edge along the cockpit's rim; the cockpit: a rubber floor, a dash with two dials, two bucket seats,
    // the steering wheel on the left, a gear lever
    B.top(13, 17, -19, 17, () => T);
    B.fill(0, 13, 10, 11, -18.5, 16.5, () => RB);
    B.fill(0, 15.5, 11, 19, 13.5, 17, () => PL, true, true);
    B.fill(5, 10.5, 15, 18.5, 13, 14, (x, y) => (hyp(x - 6.2, y - 16.6) < 1.1 || hyp(x - 9.2, y - 16.6) < 1.1 ? WH : 0), false);
    B.fill(3.2, 11.8, 11, 27, -16, 1, (x, y, z) => {
      const a = ab(ab(x) - 7.5), zb = -10.5 - (y - 14) * 0.22;
      if (y < 15) return z > -10.5 && z < 0.5 && a < 4 ? (a > 3 ? PL : T) : 0;
      if (y < 26.5 && z < zb + 2.4 && z > zb - 0.5 && a < 4.2 - (y > 23 ? 1.2 : 0)) return a > 3 || y > 25.5 ? PL : T;
      return 0;
    }, true, true);
    B.fill(3.5, 11.5, 17, 25, 6, 12, (x, y, z) => {
      const r = hyp(x - 7.5, y - 21), zc = 9 + (y - 21) * 0.5;
      return ab(z - zc) < 0.7 && ((r > 2.3 && r < 3.4) || (r < 2.3 && ab(y - 21) < 0.6)) ? T : 0;
    }, false, true);
    rod(B, [7.5, 20.5, 9.8], [7.5, 17, 14], 0.6, DK, false);
    rod(B, [0, 11, 3], [0, 16, 2], 0.5, CH, false);
    B.fill(-1, 1, 16, 18, 1, 3, () => T, false, true);
    // the roll cage: a hoop at the front of the cockpit and one behind the seats, rails along the top, stays down to
    // the back, a brace across; a plate on top for the gun's post, and one on the front hoop for a roof weapon
    const cg = 1.05;
    rod(B, [13.6, 18.6, 13.5], [11.5, 36.5, 5.5], cg, GM);
    rod(B, [11.5, 36.5, 5.5], [-11.5, 36.5, 5.5], cg, GM, false);
    rod(B, [14.6, 18.6, -17], [11.5, 36.5, -13], cg, GM);
    rod(B, [11.5, 36.5, -13], [-11.5, 36.5, -13], cg, GM, false);
    rod(B, [11.5, 36.5, 5.5], [11.5, 36.5, -13], cg, GM);
    rod(B, [11.5, 36.5, -13], [11.5, 17, -37], cg, GM);
    rod(B, [14.2, 19.5, -16.8], [-11.2, 36, -13], 0.8, GM, false);
    if (c.look >= 2) B.fill(0, 11, 37, 38, -13, 5.5, () => PLATE, true, true);   // armour: a plate roof on the cage
    B.fill(0, 12, 37, 38, -9.5, -2.5, () => GM, true, true);
    B.fill(0, 3, 38, 40, -9, -3, (x, y, z) => (hyp(x, z + 6) < 2.8 ? (y > 39 ? ST : GM) : 0));
    B.fill(0, 5.5, 37, 39, 2, 9.5, (x, y) => (y > 38 ? ST : GM), true, true);
    if (c.look >= 3) for (const x of [-9, -4.5, 0, 4.5, 9]) rod(B, [x, 19.5, 13.3], [x, 35.6, 6], 0.6, GM, false);   // bars across the front hoop
    // two spot lamps on the front hoop
    B.fill(7, 11.5, 37.4, 41.4, 3.5, 7.6, (x, y, z) => { const d = hyp(ab(x) - 9.2, y - 39.3); return d < 2 ? (z > 6.6 ? (d < 0.9 ? LW : LA) : DK) : 0; });
    // the bull bar, two round driving lamps on it
    rod(B, [12.5, 10.5, zN + 1.8], [-12.5, 10.5, zN + 1.8], 0.9, GM, false);
    rod(B, [9.5, 10.5, zN + 1.8], [8.5, 17.4, zN + 0.8], 0.9, GM);
    rod(B, [8.5, 17.4, zN + 0.8], [-8.5, 17.4, zN + 0.8], 0.9, GM, false);
    rod(B, [12.5, 10.5, zN + 1.8], [12, 10.5, zN - 3.5], 0.8, GM);
    B.fill(3.4, 8.8, 17.2, 22.2, zN - 1.2, zN + 2.4, (x, y, z) => { const d = hyp(ab(x) - 6.1, y - 19.7); return d < 2.4 ? (z > zN + 1.4 ? (d < 1 ? LW : d < 1.7 ? LA : CH) : CH) : 0; });
    // the nerf bars along the sides
    rod(B, [19.5, 10, 14], [19.5, 10, -15], 0.9, GM);
    for (const z of [10, -11]) rod(B, [19.5, 10, z], [15.5, 10, z], 0.8, GM);
    // the bonnet's lid and a fuel cap on it, small amber lamps at the nose's corners
    B.top(0, 11.5, 23, 40.5, (x, z) => (ab(x) > 10.5 || z < 24 || z > 39.5 ? SEAM : 0));
    B.top(-2, 2, 30, 34, (x, z) => (hyp(x, z - 32) < 1.8 ? CH : 0), 1, false);
    marker(B, 37, 39.5, 10.5, 12, AMBER);
    // the engine at the back: a case, finned cylinders to each side, a black fan shroud on top, a big chrome air
    // cleaner on that; two pipes out under it; round tail lamps and the plate on the tail
    const ey = 16.5, ez0 = -39, ez1 = -23;
    B.fill(0, 5, ey, ey + 6.5, ez0, ez1, () => GM, true, true);
    B.fill(5, 10.5, ey + 0.5, ey + 5, ez0 + 2, ez1 - 2, (x, y, z) => (ab(x) > 9.5 ? DK : (fl(z) & 1) ? ST : GM), true, true);
    B.fill(0, 6.5, ey + 6.5, ey + 10, ez0 + 1.5, ez1 - 1, (x, y) => (y > ey + 9 && ab(x) > 5.5 ? 0 : DK), true, true);
    B.fill(-4, 4, ey + 10, ey + 13, -34, -26, (x, y, z) => { const d = hyp(x, z + 30); return d < 3.8 ? (y > ey + 12 ? (d < 1.2 ? CL : CH) : d > 3 ? CD : CH) : 0; }, false, true);
    pipe(B, 6, 12.8, zT - 3, zT + 3, 1.5); pipe(B, -6, 12.8, zT - 3, zT + 3, 1.5);
    B.back(9.5, 15.5, 9.4, 15.6, (x, y) => { const d = hyp(ab(x) - 12.6, y - 12.5); return d < 1.8 ? [P(TAIL), -1] : d < 2.7 ? [T, 0] : 0; });
    numberPlate(B, -1, 10.6, 3.6, 3, c.seed);
  },

  // a late-70s wedge supercar: a grille slot under the knife-edge nose, pop-up lamps shut flush, a duct in the bonnet,
  // big intakes in the flanks, louvres over the engine, a wing on posts, a lamp band across the tail, four pipes
  wedge(B, S, c) {
    const { P } = B, zN = S.zN, zT = S.zT, W = S.W;
    const T = P(TRIM), PL = P(PLASTIC), G1 = P(GRILLE), G2 = P(GRILLE2), A = P(AMBER), DK = P(DARKS);
    B.front(0, 14, 5, 8.6, (x, y) => [(fl(y) & 1) ? G1 : G2, -1]);
    B.front(14.5, 19.5, 5.6, 8, () => A);
    B.top(9.5, 19, 40, 47.5, (x, z) => (ab(x) < 10.5 || ab(x) > 18 || z < 41 || z > 46.5 ? SEAM : 0));
    B.top(0, 3.5, 28, 37, (x, z) => [(fl(z) & 1) ? T : DK, -1]);
    B.top(W - 4, W - 3, S.cowl + 2, zN - 3, () => SEAM);
    cowl(B, S, S.cowl);
    marker(B, 44, 47.5, 7.6, 9.2, AMBER);
    // the flanks: the door's shut line, the intake behind it (its front edge leaning back), a black lip round the arches
    seamV(B, 17, S.c0 + 3, S.belt(17) + 0.2);
    B.side(-16, -2.5, 8.5, 17.8, (z, y) => { const zf = -3 - (17.8 - y) * 0.5; return z > zf ? 0 : z > zf - 1 || y > 16.8 || z < -15 ? [T, 0] : [(fl(y) & 1) ? G1 : DK, -2]; });
    archLip(B, S, c.wk, PL, 1.4, 0);
    // louvres across the engine cover, the wing on its posts with plates at its tips
    B.top(0, W - 6, -40, -27.5, (x, z) => ((fl(z) & 1) ? [T, -1] : 0));
    B.fill(10, 12, 19, 26.5, -45.5, -43, () => DK, true, true);
    B.fill(0, 21.5, 26.5, 27.6, -49, -40.5, () => PAINT, true, true);
    B.fill(21.5, 22.5, 24.5, 28.6, -49.5, -40, () => T, true, true);
    // the tail: a band of lamps right across in black, the plate, a black diffuser with fins, four pipes
    const TL = P(TAIL), T2 = P(TAIL2), RV = P(REV);
    B.back(0, W - 0.5, 11, 17.4, (x, y) => { const a = ab(x); if (a >= W - 1.5 || y < 12 || y >= 16.4 || a < 4) return [T, 0]; if (a < 7) return [RV, -1]; if (a > W - 5) return [A, -1]; return [(fl(y) & 1) ? TL : T2, -1]; });
    numberPlate(B, -1, 9.2, 6, 3.8, c.seed, -1);
    B.back(0, W - 3, 3.8, 7, (x) => (fl(ab(x)) % 3 === 0 ? [DK, 1] : [T, 0]));
    for (const px of [11.5, 15.5, -11.5, -15.5]) pipe(B, px, 8.4, zT - 2, zT + 3, 1.3);
    mirrors(B, S, 'small', true);
  },

  // a conventional school bus: the bonnet narrower than the wings, a chrome grille and round lamps, a split
  // windscreen, warning lamps at the roof's corners, black rub rails, the stop arm folded on the left, the folding door
  // on the right, the emergency door at the back, hatches in the roof
  bus(B, S, c) {
    const { P } = B, zN = S.zN, zT = S.zT, hx = S.hood.x, hz = S.hood.z;
    const T = P(TRIM), CH = P(CHROME), CD = P(CHROMED), G1 = P(GRILLE), A = P(AMBER), RD = P(TAIL), GM = P(GUNMETAL), WH = P(PLATEW), PL = P(PLASTIC);
    const glass = (x, y) => (((fl(x * 1.3 + y) % 11) + 11) % 11 === 0 ? P(SHINE) : P(GLASS));
    // cut the bonnet down between the wings, which rise over the front wheels
    const wy = c.wk.R - c.wk.lift, wing = (z) => clamp(wy + sq(Math.max(0, 256 - (z - S.ax[0]) ** 2)), 22, 27.5);
    for (let k = lo(hz); k < B.K1; k++) for (let j = 0; j < B.NY; j++) {
      const z = k + 0.5, y = j + 0.5; if (y <= wing(z)) continue;
      for (let i = B.I0; i < B.I1; i++) if (ab(i + 0.5) > hx) B.put(i, j, k, 0);
      const h = (k - B.K0) * B.NY + j; if (B.HW[h] > hx) B.HW[h] = hx;
    }
    // the grille, round lamps either side of it, turn lamps on the wings, a black bumper with the plate on it
    B.front(0, 11.5, 13.5, 24, (x, y) => { const a = ab(x); if (a >= 10.5 || y < 14.5 || y >= 23) return [CH, 0]; return (fl(y) % 2 === 0) ? [CH, 0, 2] : [(fl(a) % 3 === 0) ? CD : G1, -2]; });
    lamp(B, 1, 11.5, 17.5, 15, 22.5, roundShape(14.4, 18.7, 2.9, 0.9), headLens(B, 14.4, 18.7), T);
    B.front(19, 23, 16.5, 20, () => A);
    bumper(B, S, 1, 9, 15, S.bumpF, 4, (x, y) => (y > 14 ? GM : T));
    numberPlate(B, 1, 12, 5.5, 3.8, c.seed);
    // the bonnet: a crease down the middle, its shut lines; round cross-view mirrors on posts at the wings' corners
    B.top(0, 0.6, hz + 1, zN - 1, () => HI);
    B.top(hx - 1.2, hx, hz + 0.5, zN - 1, () => SEAM);
    rod(B, [21, 22, 62.5], [22.4, 30, 63.5], 0.55, T);
    B.fill(20.3, 24.7, 29, 33.4, 61.8, 65.4, (x, y, z) => (hyp(ab(x) - 22.5, y - 31.2, (z - 63.6) * 1.4) < 2.1 ? T : 0));
    // the windscreen split down the middle, big wipers on it
    B.front(-1, 1, S.ws.ylo, S.ws.yhi, () => T, 0, false);
    for (const x0 of [-18, 3]) for (let t = 0; t <= 1; t += 0.03) {
      const x = x0 + 14 * t, y = S.ws.ylo + 0.8 + 4 * t * t;
      const i = fl(x), j = fl(y); let k = B.K1 - 1; while (k >= B.K0 && !B.get(i, j, k)) k--; if (k >= B.K0) B.put(i, j, k, T);
    }
    // warning lamps at the top corners, front and back: red outboard, amber inboard
    const warn = (x, y) => { const a = ab(x), d1 = hyp(a - 18.4, y - 51.6), d2 = hyp(a - 12, y - 51.6); return d1 < 1.9 ? [RD, 1] : d2 < 1.9 ? [A, 1] : d1 < 2.6 || d2 < 2.6 ? [T, 0] : 0; };
    B.front(8, 22, 48.8, 54, warn);
    B.back(8, 22, 48.8, 54, warn);
    // three black rub rails along each side, broken by the arches and the door; clearance lamps along the roof edge
    for (const ry of [15.5, 23, 30.6]) B.side(zT + 2, hz, ry - 0.8, ry + 0.8, (z, y, s) => (S.archAt(z, y) < S.aR + 1.5 || (s < 0 && z > 22.5 && z < 38) ? 0 : [T, 1]));
    for (const z of [34, 4, -26, -56]) marker(B, z, z + 2, 50.4, 51.8, AMBER);
    archLip(B, S, c.wk, T, 1.4, 0);
    // the stop arm folded flat on the left under the driver's window
    B.side(26.5, 35.5, 26.8, 35.6, (z, y) => { const dz = ab(z - 31), dy = ab(y - 31.2), o = Math.max(dz, dy, (dz + dy) / 1.414); return o < 3 ? [RD, 1] : o < 3.8 ? [WH, 1] : 0; }, 0, 1);
    // the folding door on the right: two tall leaves, glass top and bottom, in a black frame
    B.side(23, 37.5, 12.5, 50.5, (z, y) => {
      if (z < 24 || z > 36.5 || y < 13.5 || y > 49.5 || ab(z - 30.25) < 0.6) return [T, 0];
      const zl = z < 30.25 ? z - 24 : z - 30.85;
      return ((y > 33 && y < 48.5) || (y > 15 && y < 31)) && zl > 0.8 && zl < 5.45 ? [glass(z, y), -1] : [T, 0];
    }, 0, 2);
    // the back: the emergency door with its windows and handle, a window either side, round tail lamps low at the
    // corners, a black bumper; a pipe out under the back
    B.back(0, 8.8, 12.5, 50.5, (x, y) => {
      const a = ab(x); if (a > 7.8 || y < 13.5 || y > 49.5) return [T, 0];
      if (y > 37 && y < 48.6) return a > 0.6 && a < 7 ? [glass(x, y), -1] : [T, 0];
      if (y > 21 && y < 34) return a < 7 ? [glass(x, y), -1] : [T, 0];
      return 0;
    });
    B.back(4, 7.5, 34.6, 36, () => [CH, 1], 0, false);
    B.back(10.5, 20.5, 37, 49, (x, y) => { const a = ab(x); return a > 11.5 && a < 19.5 && y > 38 && y < 48 ? [glass(x, y), -1] : [T, 0]; });
    B.back(15, 23, 15, 31, (x, y) => { const a = ab(x), d1 = hyp(a - 19, y - 26.5), d2 = hyp(a - 19, y - 19.5); return d1 < 2.3 ? [RD, -1] : d2 < 2.3 ? [A, -1] : d1 < 3.2 || d2 < 3.2 ? [T, 0] : 0; });
    bumper(B, S, -1, 9, 15, S.bumpR, 4, (x, y) => (y > 14 ? GM : T));
    numberPlate(B, -1, 16.8, 5, 3.4, c.seed);
    pipe(B, -15, 7.4, zT - 2.5, -50, 1.5);
    // hatches in the roof
    for (const z of [-2, -44]) B.top(0, 7, z - 6, z + 6, (x, zz) => (ab(x) > 6 || ab(zz - z) > 5 ? T : PL), 1);
    mirrors(B, S, 'big');
  },
};

// ---- armour: plates on the doors (and the bonnet, roof and corners), bars over the glass ----
function armour(B, S, look, wk) {
  if (!look) return;
  const t = look >= 3 ? 2 : 1, aR = S.aR;
  const z0 = S.ax[1] + aR + 1.5, z1 = S.ax[0] - aR - 1.5, y0 = S.c0 + 3, y1 = S.plateTop ?? S.belt(0) - 1.5;
  B.side(z0, z1, y0, y1, () => PLATE, t);
  if (look >= 2) {
    const nz = S.zN - 2.5, ny0 = S.c0 + 3;
    const pt = (z) => Math.min(S.belt(z) - 3, S.plateTop ?? 1e9);
    B.side(S.ax[0] + aR + 1.5, nz, ny0, pt(nz), (z, y) => (S.archAt(z, y) > aR + 1 ? PLATE : 0), 1);
    B.side(S.zT + 2.5, S.ax[1] - aR - 1.5, ny0, pt(S.zT), (z, y) => (S.archAt(z, y) > aR + 1 ? PLATE : 0), 1);
    B.top(0, S.W - 5, S.cowl + 4, S.zN - 6, (x, z) => (S.scoopX && ab(x) < S.scoopX && z > 25 && z < 47 ? 0 : PLATE), 1);
    if (!S.openTop) B.top(0, S.W - 8.5, S.roofR + 3, S.roofF - 2, () => PLATE, 1);
  }
  if (look >= 3) {   // bars over the windscreen and the rear glass
    const BAR = B.P(GUNMETAL), mid = (S.ws.ylo + S.ws.yhi) / 2;
    const ws = (x, y) => { const z = S.wsZ(y), w = B.hw(fl(y), fl(z)) || S.W - S.gIn; return ab(x) < w - S.ws.pil && (fl(x + 0.5) % 5 === 0 || ab(y - mid) < 0.5) ? BAR : 0; };
    B.front(0, S.W, S.ws.ylo + 0.5, S.ws.yhi, ws, 1);
    if (S.rw) B.top(0, S.W, S.rw.z0, S.rw.z1, (x, z) => (ab(x) < S.W - S.gIn - S.rw.pil - 2 && (fl(x + 0.5) % 5 === 0 || fl(z) % 8 === 0) ? BAR : 0), 1);
  }
}

// ---- the colour of every cube ----
// box: the part's own box, a tight fit round the grid's cubes
function colour(B, S, v, o, look, box) {
  const { I0, K0, NX, NY, NZ, L, g, HW, PAL } = B, col = v.col, paint = painter(S, o), seed = o.seed || 0;
  const vnx = box[3] - box[0], vny = box[4] - box[1], vL = vnx * vny, di = I0 - box[0], dj = -box[1], dk = K0 - box[2];
  const glass = [GLASS, GLASS2, SHINE];
  let count = 0;
  for (let k = 0; k < NZ; k++) {
    const z = K0 + k + 0.5; if (z < S.zT - 8 || z > S.zN + 8) continue;
    const bl = S.belt(z), t = S.top(z), b = S.bot(z);
    for (let j = 0; j < NY; j++) {
      const y = j + 0.5, row = k * L + j * NX, w = HW[k * NY + j];
      for (let i = 0; i < NX; i++) {
        const n = row + i, r = g[n]; if (!r) continue;
        let c;
        if (r >= 32) c = PAL[r - 32];
        else {
          const x = I0 + i + 0.5, ax = ab(x);
          const up = j === NY - 1 || !g[n + NX], dn = j === 0 || !g[n - NX], fw = k === NZ - 1 || !g[n + L], bk = k === 0 || !g[n - L];
          const sd = x > 0 ? i === NX - 1 || !g[n + 1] : i === 0 || !g[n - 1], si = x > 0 ? i === 0 || !g[n - 1] : i === NX - 1 || !g[n + 1];
          if (!(up || dn || fw || bk || sd || si)) c = INNER[0];
          else if (r === PAINT || r === SEAM || r === LO || r === HI) {
            c = shellColour(x, y, z, ax, i, j, k, up, dn, fw, bk, sd, w, bl, t, b);
            if (r === SEAM) c = tone(c, 0.6); else if (r === LO) c = tone(c, 0.8); else if (r === HI) c = tone(c, 1.14);
          } else if (r === LINER) c = ARCH;
          else if (r === WOODR) c = wood(x, y, z);
          else if (r === BEDF) c = up && !sd ? BED[(fl(ab(x) + 0.5) % 5 === 0 ? 2 : 0) + (fl(z / 3) & 1 ? 0 : 0)] : sd && ax > S.W - 1.2 ? paint(I0 + i, j, K0 + k, x, y, z, ax, up, sd, bl) : BED[1];
          else if (r === PLATE) {
            const edgeY = !(g[n + NX] === PLATE) || !(g[n - NX] === PLATE), edgeZ = !(g[n + L] === PLATE) || !(g[n - L] === PLATE), edgeX = !(g[n + 1] === PLATE) || !(g[n - 1] === PLATE);
            const top = up && !sd && ax < S.W - 1, edge = top ? edgeX || edgeZ : edgeY || edgeZ;
            const zz = fl(z + 200);
            c = look >= 3 && up && (sd || ax >= S.W - 2) ? ((((fl(z) + j) >> 1) & 1) ? HAZ : HAZK) : edge && (zz % 5 === 0 || (top ? fl(ab(x)) % 5 === 0 : j % 5 === 0)) ? RIVET : ((fl(zz / 16) + (top ? fl(ab(x) / 12) : 0)) & 1) ? ARMOUR2 : ARMOUR;
            if (look === 1 && o.pattern === 'rust' && hash(i, j, k, 6) < 0.3) c = RUST[fl(hash(i, k, j, 2) * 3)];
          } else c = CHASSIS;
        }
        col[(k + dk) * vL + (j + dj) * vnx + i + di] = c; count++;
      }
    }
  }
  v.count = count;

  // the shell: paint, sills and underside below the belt; glass, pillars and roof above it
  function shellColour(x, y, z, ax, i, j, k, up, dn, fw, bk, sd, w, bl, t, b) {
    const P = () => paint(I0 + i, j, K0 + k, x, y, z, ax, up, sd, bl);
    if (y < bl) {
      if (dn && !sd && !fw && !bk) return CHASSIS;
      if (sd && y < b + S.sillH && ax > (w || S.W) - 1.5) return S.sill ?? tone(P(), 0.78);
      if (dn) return tone(P(), 0.7);
      return P();
    }
    const side = sd && ax >= w - 1.2;
    if (side && y >= S.roofY - 2.6 && y < S.roofY - 1.2 && z < S.roofF + 0.5 && z > S.roofR - 0.5) return S.drip;
    if (!side && z > S.roofF + 0.3 && (fw || up) && y > S.ws.ylo && y < S.ws.yhi + 1) {   // the windscreen in a black surround
      const e = (w || S.W) - S.ws.pil;
      if (ax < e - 1 && y < S.ws.yhi) { const gc = glass[((k + 400 - j * 2) % 23 < 2) ? 2 : y > S.ws.yhi - 4 ? 1 : 0]; return up ? tone(gc, 0.62) : gc; }
      if (ax < e) return TRIM;
    }
    if (S.rw && !side && z > S.rw.z0 && z < S.rw.z1 && (bk || up) && y > S.rw.ylo - 1 && y < S.rw.yhi + 1) {   // the rear glass
      const e = (w || S.W) - S.rw.pil;
      if (ax < e - 1 && y > S.rw.ylo && y < S.rw.yhi) { const gc = glass[((k + j * 2 + 400) % 19 < 2) ? 2 : 0]; return up ? tone(gc, 0.62) : gc; }
      if (ax < e) return TRIM;
    }
    return P();
  }
}

// The body part for a shape and a build. wk: the wheels (R, lift, w, out).
export function bodyPart(S, o, wk) {
  const look = PARTS.armour[o.armour] ? PARTS.armour[o.armour].look : 0;
  const wy = wk.R - wk.lift;
  S = { ...S, aR: Math.min(wk.R + 1.8, S.belt(S.ax[0]) - wy - 1), cutX: S.noArch ? 1e9 : S.W - wk.out - wk.w - 1, scoopX: S.kind === 'muscle' ? 6.6 : 0 };
  // the windscreen's z at a height (for the bars over it)
  S.wsZ = (y) => { for (let z = S.zN; z > S.zT; z -= 0.5) if (S.top(z) > y) return z; return S.roofF; };
  // The cubes are laid out in a roomy grid first, and the part's box is then cut down to the cubes it holds: the kit
  // rebuilds a big part a slab (16 layers front to back) at a time (units/src/voxpart.js buildSlabs), and a slab costs
  // about its cells, so the box is kept as narrow and low as the car. It then runs on past the nose to 200,000 cells or
  // more, so that a hit rebuilds a slice of the car instead of all of it. The empty layers cost nothing to draw.
  const Wm = S.Wmax || S.W, I0 = -Math.ceil(Wm) - 6, J1 = Math.ceil(Math.max(S.roofY + 4, S.turret.y ? S.turret.y + 1 : 0));
  const K0 = fl(S.zT - S.bumpR) - 2, K1 = Math.ceil(S.zN + S.bumpF) + 2;
  let B = null, box = null;
  const make = () => {
    B = grid(S, [I0, 0, K0, -I0, J1, K1]);
    shell(B, S, wk, look >= 3);
    DETAIL[S.kind](B, S, { seed: o.seed || 0, wk, look });
    armour(B, S, look, wk);
    let ia = 1e9, ib = -1e9, ja = 1e9, jb = -1e9, ka = 1e9, kb = -1e9;
    const { g, NX, NY, NZ, L } = B;
    for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0, n = k * L + j * NX; i < NX; i++, n++) if (g[n]) {
      if (i < ia) ia = i; if (i > ib) ib = i; if (j < ja) ja = j; if (j > jb) jb = j; if (k < ka) ka = k; if (k > kb) kb = k;
    }
    const nx = ib - ia + 1, ny = jb - ja + 1, nz = Math.max(kb - ka + 1, Math.ceil(200000 / (nx * ny)) + 1, 32);
    box = [I0 + ia, ja, K0 + ka, I0 + ib + 1, jb + 1, K0 + ka + nz];
  };
  return { name: 'body', parent: null, pivot: [0, wk.lift, 0], get box() { if (!box) make(); return box; }, paint(v) {
    if (!B) make();
    colour(B, S, v, o, look, box);
    B = null;   // the grid is done with
  } };
}
for (const [k, S] of Object.entries(SHAPES)) S.kind = k;
