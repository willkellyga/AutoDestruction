// Voxel kaiju, second pass: every body part is a block of cubes sculpted from blended shapes, hung on its own bone.
// Design units are the town's quarter-metre voxels; the monster itself is sampled RES times finer (eighth-metre cubes).
// He faces +Z and stands on y = 0.
import * as THREE from 'three';
import { wingRig } from './wings.js';

export const RES = 2;

// ---- palette ----
let TEAL = 0x2f927b, LITE = 0x45a888, DARK = 0x1f6562, DEEP = 0x174a4f, INK = 0x0f3338;
// The rest of the paint. These are Chompers' own colours; a skin (SKINS, at the foot of the file) swaps them for its own while its model is built.
const PAINT = { CREAM: 0xecdca6, CREAM2: 0xdcc88c, SEAM: 0xb09a66, IVORY: 0xf7f0da, BONE: 0xd6c7a0, AMBER: [0xb8441a, 0xf07f22, 0xffb637, 0xffe27a],
  MOUTH: 0x8f2233, GUM: 0x5e1626, TONGUE: 0xd65a70, THROAT: 0x2a0a14, EYE: 0xffc928, EYE2: 0xd9831a, PUPIL: 0x15101d, GLINT: 0xffffff, BROW: 0x123a3f, NOSTRIL: 0x0b2226,
  STRIPE: 0x1c1410, glow: 0xff7a1f, glowBase: 0.25 };
let CREAM, CREAM2, SEAM, IVORY, BONE, AMBER0, AMBER1, AMBER2, AMBER3, MOUTH, GUM, TONGUE, THROAT, EYE, EYE2, PUPIL, GLINT, BROW, NOSTRIL, STRIPE, GLOW_C, GLOW_B;
const HEAD_TILT = -0.64;   // how far the head is tipped back on the neck at rest, so it looks ahead
const GLOW = 1 << 24; // flag on a colour: this voxel belongs to the glowing back-plate mesh
const BELLY = [0, 0, 0]; let ARMOUR = [DARK, DEEP, INK];
const SKIN0 = [TEAL, LITE, DARK, DEEP, INK];
function useSkin(c) { [TEAL, LITE, DARK, DEEP, INK] = c || SKIN0; ARMOUR = [DARK, DEEP, INK]; }
function use(p) {
  const q = { ...PAINT, ...p };
  ({ CREAM, CREAM2, SEAM, IVORY, BONE, MOUTH, GUM, TONGUE, THROAT, EYE, EYE2, PUPIL, GLINT, BROW, NOSTRIL, STRIPE } = q);
  [AMBER0, AMBER1, AMBER2, AMBER3] = q.AMBER; BELLY[0] = CREAM; BELLY[1] = CREAM2; BELLY[2] = SEAM; GLOW_C = q.glow; GLOW_B = q.glowBase;
}
use();

// ---- growth stages: state read by the sculpting code below ----
// The adult is the sculpt as written. A younger stage is the same sculpt with every part stretched to new proportions and with
// features turned down or off (F). While a part is being filled, SX, SY, SZ are its stretch
// (real size = sculpted size times this) and RX, RY, RZ are the real position of the voxel, so that surface detail (scales, grooves,
// eyes) can stay one voxel fine whatever the stretch.
// (A skin's own: `stripe` paints tiger stripes down from the spine.)
const ADULT = { stripe: 0, plate: 1, plateW: 1, plateExp: 0.72, barb: 0.26, side: 1, horn: 1, noseHorn: 1, spike: 1, armour: 1, teeth: 1, tailSpikes: 1, throat: 1, brow: 1, spur: 1, hornBase: 1, eye: { y0: 1.5, z0: 3.5, rows: 4, cols: 6, pupil: 3 } };
let F = ADULT, SX = 1, SY = 1, SZ = 1, SB = 1, SD = 1, SAZ = false, RX = 0, RY = 0, RZ = 0;
const mix = (a, b, h) => (h === 1 ? b : a + (b - a) * h);

// ---- small maths helpers ----
function hash(i, j, k, s = 0) { let h = (i * 374761393 + j * 668265263 + k * 2147483647 + s * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const frac = (v) => v - Math.floor(v);
function tone(hex, m) { return (Math.min(255, ((hex >> 16) & 255) * m) << 16) | (Math.min(255, ((hex >> 8) & 255) * m) << 8) | Math.min(255, (hex & 255) * m); }
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }; // smooth union
function sdE(x, y, z, cx, cy, cz, rx, ry, rz) { // distance to an ellipsoid (close enough near the surface), <= 0 inside
  const a = (x - cx) / rx, b = (y - cy) / ry, c = (z - cz) / rz, k0 = Math.sqrt(a * a + b * b + c * c);
  if (k0 < 1e-6) return -Math.min(rx, ry, rz);
  const a2 = a / rx, b2 = b / ry, c2 = c / rz; return k0 * (k0 - 1) / Math.sqrt(a2 * a2 + b2 * b2 + c2 * c2);
}
let capT = 0; // how far along the capsule the last tested point sat, 0 to 1
function cap(x, y, z, ax, ay, az, bx, by, bz, ra, rb) { // tapered capsule, <= 0 inside
  const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz;
  let t = ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t; capT = t;
  const px = ax + dx * t - x, py = ay + dy * t - y, pz = az + dz * t - z;
  return Math.sqrt(px * px + py * py + pz * pz) - (ra + (rb - ra) * t);
}
const horn = (t) => (t < 0.3 ? BONE : IVORY); // claws, horns and spikes: darker at the root
// Scales: a 3D cell pattern. After a call, W.e is small near the line between two scales and W.id is a random number for the scale.
const W = { e: 0, id: 0 };
function cells(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); let f1 = 99, f2 = 99, id = 0;
  for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const cx = ix + di, cy = iy + dj, cz = iz + dk;
    const px = cx + hash(cx, cy, cz, seed) - x, py = cy + hash(cx, cy, cz, seed + 1) - y, pz = cz + hash(cx, cy, cz, seed + 2) - z, d = px * px + py * py + pz * pz;
    if (d < f1) { f2 = f1; f1 = d; id = hash(cx, cy, cz, seed + 3); } else if (d < f2) f2 = d;
  }
  W.e = Math.sqrt(f2) - Math.sqrt(f1); W.id = id;
}
// Banded plates (belly scutes, shin and toe armour): bands `w` deep with a one-voxel groove cut between them.
function scutes(d, band, w, pal) {
  const b = band * SB / w, f = frac(b);
  if (f < 0.5 / w) return d * SD > -0.5 ? -1 : pal[2];
  return tone(pal[Math.floor(b) & 1], 0.94 + 0.1 * f);
}
// Hide: scales that darken from the flanks (back = 0) up to the spine (back = 1), with grooves cut between the scales on the back.
function hide(d, x, y, z, back, seed, cs = 3, band = null, bw = 2.6, pal = BELLY) {
  if (d > 0) return -1;
  if (d * SD < -1.7) return TEAL; // deep inside, never seen
  if (band !== null) return scutes(d, band, bw, pal);
  cells(x * SX / cs, y * SY / cs, z * SZ / cs, seed);
  const k = back + (W.id - 0.5) * 0.24;
  if (W.e < 0.5 / cs && k > 0.45 && d * SD > -0.5) return -1;
  if (F.stripe && back > 0.2) {                                                    // stripes across the part, widest at the spine and tapering down the flanks
    const u = (SAZ ? z * SZ : y * SY) + 0.9 * Math.sin(x * SX * 0.8) + 0.35 * Math.abs(x) * SX;
    if (frac(u / 5.4) < 0.12 + 0.3 * Math.min(1, (back - 0.2) / 0.5)) return tone(STRIPE, 0.9 + 0.25 * W.id);
  }
  const c = k > 0.88 ? DEEP : k > 0.55 ? DARK : k > 0.28 ? TEAL : LITE;
  return tone(c, (0.94 + 0.12 * W.id) * (W.e < 1 / cs ? 0.8 : W.e > 0.5 ? 1.08 : 1));
}
// Torso-style colouring: scutes across the front (within angle tb of straight ahead), scales round the sides and back.
function body(d, x, y, z, zc, tb, seed, yoff, cs = 3) {
  if (d > 0) return -1;
  if (d * SD < -1.7) return TEAL;
  const th = Math.atan2(Math.abs(x), z - zc), band = y + yoff + 0.12 * Math.abs(x);
  return hide(d, x, y, z, th / Math.PI, seed, cs, th < tb * (0.9 + 0.1 * Math.sin(Math.PI * frac(band * SB / 2.6))) ? band : null);
}
// A back plate: a jagged blade growing from (by, bz) along (dy, dz), thick at the root and thin at the edges. Returns a colour or -1.
function plate(x, y, z, by, bz, dy, dz, L, Wd, xc = 0, lean = 0) {
  L *= F.plate; Wd *= F.plate * F.plateW;
  const dl = Math.hypot(dy, dz); dy /= dl; dz /= dl;
  const u = (y - by) * dy + (z - bz) * dz; if (u < -3 || u > L) return -1;
  const v = -(y - by) * dz + (z - bz) * dy, av = Math.abs(v), un = u < 0 ? 0 : u / L;
  const barb = 1 + F.barb * (frac(un * 3.3 + Wd * 0.37 + (v > 0 ? 0.5 : 0)) - 0.5);
  const w = u < 0 ? Wd * 0.5 : Wd * Math.min(1, 0.5 + 1.9 * un) * Math.pow(1 - un, F.plateExp) * barb;
  if (av > w) return -1;
  const e = av / Math.max(w, 0.01), th = Math.max(0.28 / SX, Math.min(1.25, 0.3 + Wd * 0.2) * (1 - 0.62 * un) * (1 - 0.6 * e * e));
  if (Math.abs(x - xc - lean * Math.max(0, u)) > th) return -1;
  const k = un * 0.85 + e * e * 0.3 + (hash(Math.floor(x * RES), Math.floor(y * RES), Math.floor(z * RES), 9) - 0.5) * 0.1;
  return (k < 0.2 ? AMBER0 : k < 0.48 ? AMBER1 : k < 0.8 ? AMBER2 : AMBER3) | GLOW;
}

// ---- the parts: name, parent, pivot (in the parent's space), rest rotation, sampling box, fill(x, y, z) -> colour or -1 ----
const UPPER_TEETH = [[0.22, 1.5], [0.62, 2.3], [1.0, 1.6], [1.35, 1.5], [1.7, 1.3], [2.05, 1.1]].map(([a, l]) => [3.0 * Math.sin(a), 7.2 + 4.55 * Math.cos(a), l]);
const LOWER_TEETH = [[0.3, 1.2], [0.75, 1.9], [1.2, 1.3], [1.6, 1.2], [2.0, 1.0]].map(([a, l]) => [2.45 * Math.sin(a), 5.0 + 4.5 * Math.cos(a), l]);
const TOES = [[-2.8, 8.6], [0, 9.8], [2.8, 8.6]], FINGERS = [-1.5, 0.1, 1.7];

const leg = (s) => {
  const sd = s > 0 ? 'L' : 'R', so = s > 0 ? 0 : 50;
  return [
    { name: 'thigh' + sd, parent: 'hips', pivot: [7 * s, -1, 1], box: [-7, -15, -8, 8, 8, 9], seed: 11,
      fill: (x, y, z) => {
        x *= s;
        let d = cap(x, y, z, 0, 0, 0, 0.5, -9.5, 3.5, 5.7, 4.4);
        d = smin(d, sdE(x, y, z, 0.4, 0.6, -0.8, 5.7, 6.0, 6.3), 1.5);   // haunch
        d = smin(d, sdE(x, y, z, 0.9, -4.6, 3.0, 4.3, 5.0, 3.9), 1.2);   // thigh muscle
        const kn = sdE(x, y, z, 0.5, -9.4, 5.3, 2.7, 2.6, 2.1), kneecap = F.armour && kn < d + 0.4; d = smin(d, kn, 0.6);
        if (d > 0) return -1;
        return kneecap ? scutes(d, y - 0.35 * z, 1.7, ARMOUR) : hide(d, x, y, z, 0.5 - z / 11 + x / 14, 11 + so, 2.8);
      } },
    { name: 'shin' + sd, parent: 'thigh' + sd, pivot: [0.5 * s, -9.5, 3.5], box: [-5, -12, -9, 5, 5, 6], seed: 12,
      fill: (x, y, z) => {
        x *= s;
        if (F.spur && cap(x, y, z, 0, -5.6, -5.0, 0, -4.6, -7.6, 0.95, 0.2) <= 0) return horn(capT);   // spur behind the ankle
        let d = cap(x, y, z, 0, 0, 0, 0, -7.5, -3, 4.2, 3.3); const t = capT;
        d = smin(d, sdE(x, y, z, 0, -3.2, -2.6, 3.3, 3.9, 3.0), 1);                           // calf
        if (d > 0) return -1;
        const r = 4.2 - 0.9 * t, front = z + 3 * t;
        if (F.armour && front > 0.45 * r && Math.abs(x) < 0.8 * r) return hide(d, x, y, z, 0, 12, 2, y - 0.25 * Math.abs(x), 1.8, ARMOUR); // greave down the front
        return hide(d, x, y, z, 0.55 - front / 8, 12 + so, 2.4);
      } },
    { name: 'foot' + sd, parent: 'shin' + sd, pivot: [0, -7.5, -3], box: [-7, -3, -6, 7, 4, 14], seed: 13,
      fill: (x, y, z) => {
        x *= s; if (y < -3) return -1;
        let d = smin(sdE(x, y, z, 0, -0.5, 0, 3.6, 3.1, 3.5), sdE(x, y, z, 0, -1.3, 3.0, 4.1, 2.5, 4.4), 1.2);
        for (const [cx, zl] of TOES) d = smin(d, cap(x, y, z, cx * 0.9, -1.6, 4.6, cx * 1.45, -1.85, zl, 1.6, 1.3), 0.6);
        if (d <= 0) return y < -2.5 ? tone(INK, 1.1) : hide(d, x, y, z, Math.min(0.3, 0.12 + (y + 3) / 12), 13 + so, 2);   // foot and toes: plain green, dark sole
        for (const [cx, zl] of TOES) if (cap(x, y, z, cx * 1.45, -1.9, zl, cx * 1.62, -2.65, zl + 3.0, 1.05, 0.22) <= 0) return IVORY;  // toe claws, clean ivory from the toe tip
        return cap(x, y, z, 0, -1.5, -2.6, 0, -2.6, -5.0, 1.0, 0.25) <= 0 ? IVORY : -1;                                          // heel claw
      } },
  ];
};
const arm = (s) => {
  const sd = s > 0 ? 'L' : 'R', so = s > 0 ? 0 : 50;
  return [
    { name: 'arm' + sd, parent: 'chest', pivot: [8.6 * s, 3.6, 2], rest: [-0.4, 0, 0.16 * s], box: [-4, -10, -5, 5, 4, 6], seed: 21,
      fill: (x, y, z) => {
        x *= s;
        let d = cap(x, y, z, 0, 0, 0, 0.5, -6.5, 2.5, 3.1, 2.5);
        d = smin(d, sdE(x, y, z, 0.5, 0.4, 0, 3.3, 3.1, 3.4), 1);        // shoulder
        d = smin(d, sdE(x, y, z, 0.3, -3.2, 2.0, 2.5, 2.7, 2.4), 0.8);  // upper arm muscle
        return hide(d, x, y, z, 0.5 - z / 7 + x / 9, 21 + so, 2.2);
      } },
    { name: 'forearm' + sd, parent: 'arm' + sd, pivot: [0.5 * s, -6.5, 2.5], rest: [0.45, -0.25 * s, 0], box: [-4, -5, -5, 4, 4, 8], seed: 22,
      fill: (x, y, z) => {
        x *= s;
        if (F.spur && cap(x, y, z, 0.3, 0.3, -1.2, 0.7, 1.2, -4.2, 0.95, 0.2) <= 0) return horn(capT);  // elbow spike
        let d = cap(x, y, z, 0, 0, 0, -0.4, -1.5, 5.0, 2.55, 2.0);
        d = smin(d, sdE(x, y, z, 0.2, 0.1, 2.0, 2.4, 2.5, 2.6), 0.8);
        if (d > 0) return -1;
        if (F.armour && y > 0.9 && Math.abs(x) < 1.9) return hide(d, x, y, z, 0, 22, 2, z, 1.6, ARMOUR);   // bracer along the top
        return hide(d, x, y, z, 0.45 + y / 5 + x / 10, 22 + so, 2);
      } },
    { name: 'hand' + sd, parent: 'forearm' + sd, pivot: [-0.4 * s, -1.5, 5.0], rest: [0.35, 0, -1.1 * s], box: [-4, -4, -2, 4, 2, 7], seed: 23,
      fill: (x, y, z) => {
        x *= s;
        let d = sdE(x, y, z, 0, -0.1, 0.9, 2.2, 1.4, 1.8);
        for (const cx of FINGERS) d = smin(d, cap(x, y, z, cx, -0.1, 1.6, cx * 1.2, -0.9, 3.3, 0.85, 0.7), 0.4);
        d = smin(d, cap(x, y, z, -1.4, 0, 0.4, -2.4, -0.5, 1.5, 0.8, 0.62), 0.4);
        if (d <= 0) return hide(d, x, y, z, 0.5 + y / 4, 23 + so, 1.8);
        for (const cx of FINGERS) if (cap(x, y, z, cx * 1.2, -0.9, 3.3, cx * 1.36, -2.7, 5.5, 0.72, 0.15) <= 0) return IVORY; // finger claws
        return cap(x, y, z, -2.4, -0.5, 1.5, -3.2, -1.9, 2.9, 0.62, 0.15) <= 0 ? IVORY : -1;                                  // thumb claw
      } },
  ];
};
// tail: seven segments that taper and droop, each with a plate, and a cluster of spikes at the tip
const TLEN = [6, 6, 6, 6, 6, 6, 5.5], TDROP = [3.6, 3.4, 3.2, 3.0, 2.6, 1.6, 0.6], TRAD = [6.9, 6.0, 5.1, 4.2, 3.3, 2.5, 1.7, 0.8], TPL = [6.4, 5.6, 4.8, 4.0, 3.2, 2.4, 0];
const tail = (i) => {
  const len = TLEN[i - 1], drop = TDROP[i - 1], ra = TRAD[i - 1], rb = TRAD[i], L = TPL[i - 1], rm = (ra + rb) / 2;
  const by = -drop * 0.45 + rm * 0.8, bz = -len * 0.45, X = i === 7 ? 5 : Math.ceil(ra + 0.5), off = -TLEN.slice(0, i - 1).reduce((a, b) => a + b, 0);
  return { name: 'tail' + i, parent: i === 1 ? 'hips' : 'tail' + (i - 1), rest: i === 1 ? [-0.1, 0, 0] : undefined, pivot: i === 1 ? [0, -0.6, -6.5] : [0, -TDROP[i - 2], -TLEN[i - 2]],
    box: [-X, Math.floor(-drop - Math.max(rb, ra * 0.9) - 1), Math.floor(-len - Math.max(rb + 1, 3.5)), X, Math.ceil(Math.max(ra, by + L * 1.15) + 1), Math.ceil(ra + 1)], seed: 30 + i,
    fill: (x, y, z) => {
      if (L) { const p = plate(x, y, z, by, bz, 1, -0.4, L, L * 0.5); if (p >= 0) return p; }
      else if (F.tailSpikes) {
        const ax = Math.abs(x);
        if (cap(ax, y, z, 0.8, 0.2, -2.4, 4.3, 2.6, -4.0, 0.9, 0.15) <= 0 || cap(ax, y, z, 0.6, -0.1, -4.3, 3.5, 1.9, -6.7, 0.8, 0.15) <= 0) return horn(capT);
      }
      const d = cap(x, y, z, 0, 0, 0, 0, -drop, -len, ra, rb);
      if (d > 0) return -1;
      if (d < -1.7) return TEAL;
      const r = ra + (rb - ra) * capT, th = Math.atan2(Math.abs(x), -(y + drop * capT)); // 0 underneath, PI on top
      const cs = Math.max(1.6, Math.min(3, r * 0.55)), band = z + off;
      return hide(d, x, y, z, th / Math.PI, 30 + i, cs, th < 0.8 * (0.9 + 0.1 * Math.sin(Math.PI * frac(band / 2.6))) ? band : null);
    } };
};

export const PARTS = [
  { name: 'hips', parent: null, pivot: [0, 21, 0], rest: [0.1, 0, 0], box: [-10, -9, -17, 10, 13, 10], seed: 1,
    fill: (x, y, z) => {
      let p = plate(x, y, z, 4.6, -8.2, 0.55, -1, 7.2, 3.6); if (p >= 0) return p;
      if (F.side) { p = plate(Math.abs(x), y, z, 3.4, -7.4, 0.5, -1, 3.8, 1.9, 4.2, 0.22); if (p >= 0) return p; }
      const d = smin(sdE(x, y, z, 0, 0, 0, 8.6, 7.6, 9), sdE(x, y, z, 0, -0.6, -5.5, 6.9, 6.9, 6.5), 2);
      if (d > 0) return -1;
      if (z < 2.5 && y < -3.8 && Math.abs(x) < 4.4) return hide(d, x, y, z, 0, 1, 3, z - 30); // underside: carries the belly round to the tail
      return body(d, x, y, z, 0, 0.66, 1, 21);
    } },
  { name: 'spine1', parent: 'hips', pivot: [0, 4, 0.5], rest: [0.11, 0, 0], box: [-10, -9, -18, 10, 15, 11], seed: 2,
    fill: (x, y, z) => {
      let p = plate(x, y, z, 2.2, -7.4, 0.32, -1, 8.6, 4.2); if (p >= 0) return p;
      if (F.side) { p = plate(Math.abs(x), y, z, 3.2, -6.6, 0.4, -1, 4.4, 2.2, 4.5, 0.22); if (p >= 0) return p; }
      return body(smin(cap(x, y, z, 0, 0, 0, 0, 6, 0.8, 8.5, 8.4), sdE(x, y, z, 0, 2, 3.4, 7.2, 6.6, 6.6), 1.5), x, y, z, 0.5, 0.72, 2, 25);
    } },
  { name: 'spine2', parent: 'spine1', pivot: [0, 6, 0.8], rest: [0.11, 0, 0], box: [-10, -9, -20, 10, 15, 11], seed: 3,
    fill: (x, y, z) => {
      let p = plate(x, y, z, 3, -7.2, 0.42, -1, 11, 5.3); if (p >= 0) return p;
      if (F.side) { p = plate(Math.abs(x), y, z, 4.2, -6.6, 0.45, -1, 5, 2.5, 4.5, 0.22); if (p >= 0) return p; }
      return body(smin(cap(x, y, z, 0, 0, 0, 0, 6, 0.8, 8.4, 8.2), sdE(x, y, z, 0, 2, 3.0, 6.9, 6, 6.2), 1.5), x, y, z, 0.5, 0.7, 3, 31);
    } },
  { name: 'chest', parent: 'spine2', pivot: [0, 6, 0.8], rest: [0.15, 0, 0], box: [0, 0, 0, 0, 0, 0], seed: 0, fill: () => -1 }, // bone only; the rib cage hangs off it so it can swell
  { name: 'ribs', parent: 'chest', pivot: [0, 0, 0], box: [-12, -4, -19, 12, 16, 10], seed: 4,
    fill: (x, y, z) => {
      const ax = Math.abs(x);
      let p = plate(x, y, z, 3.6, -6.8, 0.58, -1, 10, 4.9); if (p >= 0) return p;
      if (F.side) { p = plate(ax, y, z, 4.4, -6.4, 0.6, -1, 4.4, 2.2, 4.7, 0.22); if (p >= 0) return p; }
      let d = smin(sdE(x, y, z, 0, 3.5, 0.5, 9.1, 6.8, 7.9), sdE(ax, y, z, 7.6, 4.2, 1.2, 3.9, 3.9, 4.4), 1.2);
      d = smin(d, sdE(ax, y, z, 3.7, 2.4, 5.9, 3.7, 3.3, 2.6), 1.0);                 // chest muscles
      d = smin(d, cap(x, y, z, 0, 6, 1.2, 0, 9.5, 3.0, 6.0, 5.6), 1.5);              // base of the neck
      return body(d, x, y, z, 0.5, y > 6.5 ? 0.5 : 0.62, 4, 37);
    } },
  { name: 'neck1', parent: 'chest', pivot: [0, 7.5, 2.5], rest: [0.09, 0, 0], box: [-7, -7, -12, 7, 10, 8], seed: 5,
    fill: (x, y, z) => {
      const p = plate(x, y, z, 1.6, -4.8, 0.62, -1, 5.6, 2.9); if (p >= 0) return p;
      return body(cap(x, y, z, 0, 0, 0, 0, 3.6, 0.9, 5.8, 5.3), x, y, z, 0.3, 0.6, 5, 44.5, 2.6);
    } },
  { name: 'neck2', parent: 'neck1', pivot: [0, 3.6, 0.9], rest: [0.08, 0, 0], box: [-6, -6, -9, 6, 9, 7], seed: 6,
    fill: (x, y, z) => {
      const p = plate(x, y, z, 1.4, -4.4, 0.75, -1, 3.8, 2.0); if (p >= 0) return p;
      const c = body(cap(x, y, z, 0, 0, 0, 0, 3.4, 0.8, 5.3, 4.9), x, y, z, 0.3, 0.6, 6, 48, 2.4);
      if (c < 0) return c;
      // Where the closed jaw covers the top of the neck, colour it as the inside of the throat, so an open mouth is dark at the back.
      const yy = y - 3.4, zz = z - 0.8, ct = Math.cos(HEAD_TILT), st = Math.sin(HEAD_TILT), yh = ct * yy + st * zz, zh = -st * yy + ct * zz;       // the same spot, as the head sees it
      return F.throat && zh > 0.2 && sdE(x, yh + 0.5, zh - 1.5, 0, -1.6, 5.0, 3.5, 2.9, 6.0) < -0.5 ? THROAT : c;
    } },
  { name: 'head', parent: 'neck2', pivot: [0, 3.4, 0.8], rest: [HEAD_TILT, 0, 0], box: [-8, -4, -6, 8, 11, 14], seed: 7,
    fill: (x, y, z) => {
      const ax = Math.abs(x);
      const hb = F.hornBase, hx = mix(3.3, 4.9, hb), hy = mix(4.4, 6.7, hb), hz = mix(0.6, -1.5, hb), hr = mix(1.4, 1.05, hb), full = hb === 1 && F.horn === 1;
      if (cap(ax, y, z, 3.3, 4.4, 0.6, hx, hy, hz, 1.4, hr) <= 0) return capT < 0.35 ? BONE : IVORY;         // crest horns, in two sweeps (a young one has less of each)
      if (F.horn && cap(ax, y, z, hx, hy, hz, full ? 5.3 : hx + 0.4 * F.horn, full ? 9.7 : hy + 3 * F.horn, full ? -1.2 : hz + 0.3 * F.horn, hr, 0.28) <= 0) return IVORY;
      if (F.spike && cap(ax, y, z, 4.6, 0.8, -0.6, mix(4.6, 6.6, F.spike), mix(0.8, 1.6, F.spike), mix(-0.6, -3.1, F.spike), 0.85, 0.22) <= 0) return horn(capT);   // cheek spikes
      if (F.noseHorn && cap(x, y, z, 0, 3.3, 10.5, 0, mix(3.3, 5.7, F.noseHorn), mix(10.5, 9.9, F.noseHorn), 0.9, 0.22) <= 0) return horn(capT);   // nose horn
      const cr = plate(x, y, z, 4.6, -2.4, 1, -0.75, 2.8, 1.5); if (cr >= 0) return cr;                      // small crest plate
      if (y < -0.2 && y > -3 && z > 3) for (const [tx, tz, tl] of UPPER_TEETH) if (cap(ax, y, z, tx, -0.2, tz, tx * 1.03, -0.2 - tl * F.teeth, tz + 0.15, 0.62, 0.14) <= 0) return IVORY;
      if (y < -0.5) return y > -3.5 && z > 1.3 && z < 3.3 && (x / 3) * (x / 3) + ((y + 0.5) / 3.6) * ((y + 0.5) / 3.6) <= 1 ? THROAT : -1; // dark back wall of the mouth, hidden inside the jaw until it opens
      let d = smin(sdE(x, y, z, 0, 1.6, 1.2, 5.2, 4.4, 5.4), sdE(x, y, z, 0, 1.0, 7.2, 4.0, 3.0, 5.8), 1.4);
      d = smin(d, sdE(x, y, z, 0, 2.7, 10.5, 2.7, 1.5, 2.2), 1.0);                                           // bump over the nose
      d = smin(d, sdE(ax, y, z, 4.0, 0.6, 2.0, 2.0, 2.4, 2.8), 1.0);                                         // jaw muscle
      const br = sdE(ax, y, z, 3.9, 4.25 - 0.16 * (z - 3.5), 4.6, 1.5 * F.brow, 0.8 * F.brow, 2.7 * F.brow), brow = br < d + 0.25; d = smin(d, br, 0.4); // heavy brow, sloping down to the front
      if (d > 0) return -1;
      if (!brow && ax > 3 && d > -1.2) {                                                                      // eyes: amber with a slit pupil and a glint, under the brow
        const E = F.eye, c = Math.floor((RZ - E.z0) * 2), r = Math.floor((RY - E.y0) * 2);
        if (c >= 0 && c < E.cols && r >= 0 && r < E.rows) return c === E.pupil ? PUPIL : c === E.pupil + 1 && r === E.rows - 2 ? GLINT : c === 0 || c === E.cols - 1 || r === 0 ? EYE2 : EYE;
      }
      if (ax >= 0.75 && ax < 1.75 && z >= 10.75 && z < 11.75 && y > 2.4 && d > -1.2) return d > -0.5 ? -1 : NOSTRIL;
      if (y < 0) {                                                                                            // underside: roof of the mouth, gums, lip
        const e = (x / 3.46) * (x / 3.46) + ((z - 7.2) / 5.0) * ((z - 7.2) / 5.0);
        if (z > 2.5 && e < 0.62) return MOUTH;
        if (z > 2.5 && e < 0.95) return GUM;
        return tone(INK, 1.15);
      }
      if (brow) return tone(DEEP, 0.9 + 0.16 * hash(Math.floor(x * 2), Math.floor(y * 2), Math.floor(z * 2), 3));
      return hide(d, x, y, z, 0.34 + y / 10 - z / 40, 7, 2.2);
    } },
  { name: 'jaw', parent: 'head', pivot: [0, -0.5, 1.5], box: [-5, -5, -3, 5, 3, 12], seed: 8,
    fill: (x, y, z) => {
      const ax = Math.abs(x);
      if (y > -0.4 && z > 1.5) for (const [tx, tz, tl] of LOWER_TEETH) if (cap(ax, y, z, tx, -0.3, tz, tx, tl * F.teeth - 0.3, tz, 0.6, 0.14) <= 0) return IVORY;
      if (y >= 0) return y < 0.75 && sdE(x, y, z, 0, -0.1, 4.8, 1.7, 0.8, 3.6) <= 0 ? TONGUE : -1;
      let d = smin(sdE(x, y, z, 0, -1.6, 5.0, 3.5, 2.9, 6.0), sdE(x, y, z, 0, -2.7, 8.3, 2.3, 1.5, 2.0), 1);   // jaw and chin
      d = smin(d, sdE(ax, y, z, 3.0, -1.2, 0.8, 1.7, 2.1, 2.4), 0.8);                                        // hinge
      if (d > 0) return -1;
      if (y >= -0.5) {
        const e = (x / 2.92) * (x / 2.92) + ((z - 5) / 5) * ((z - 5) / 5);
        return e < 0.55 ? (sdE(x, y, z, 0, -0.1, 4.8, 1.7, 0.8, 3.6) <= 0 ? TONGUE : MOUTH) : e < 0.9 ? GUM : tone(INK, 1.15);
      }
      if (y < -3.1 && ax < 2.4) return hide(d, x, y, z, 0, 8, 2, z, 2.2);                                       // throat scutes
      return hide(d, x, y, z, 0.3 + (y + 3) / 14, 8, 2.2);
    } },
  ...arm(1), ...arm(-1),
  tail(1), tail(2), tail(3), tail(4), tail(5), tail(6), tail(7),
  ...leg(1), ...leg(-1),
];

// ---- the younger stages ----
const uni = (v) => [v, v, v];
// For each stage: k is the size of the legs against the adult's (it also scales every distance in a pose, so the clips fit),
// kx the width of the stance, `scale` the stretch of each part (by name, or by group: leg, arm, tail), `feat` the features,
// and optionally a skin, new rest angles, whole new parts, and a bend applied to a part's sculpt (`warp`).
export const STAGES = {
  // The teen is a halfway point: every measure sits between the baby's and the adult's, so the three read as one animal growing.
  teen: {
    k: 0.7, kx: 0.84, fat: 1.15, skin: [0x33a083, 0x4cb892, 0x22706a, 0x195257, 0x103a3e],
    feat: { ...ADULT, plate: 0.78, plateW: 0.95, side: 0, horn: 0.15, hornBase: 0.7, noseHorn: 0, spike: 0.4, spur: 0, armour: 0, teeth: 0.85, tailSpikes: 0, brow: 0.9, eye: { y0: 1.0, z0: 2.5, rows: 5, cols: 6, pupil: 3 } },
    scale: { hips: [0.86, 0.84, 0.86], spine1: [0.86, 0.74, 0.85], spine2: [0.85, 0.74, 0.84], chest: [0.82, 0.76, 0.83], ribs: [0.82, 0.76, 0.83], neck1: [0.76, 0.74, 0.76], neck2: [0.76, 0.74, 0.76],
      head: uni(0.85), jaw: uni(0.85), arm: uni(0.76), forearm: uni(0.76), hand: uni(0.8), tail: [0.8, 0.76, 0.76] },
    snout: 0.9,   // how much of the adult's snout length is left, for anything that needs to find his mouth
    warp: { head: (q) => { if (q[2] > 3) q[2] = 3 + (q[2] - 3) / 0.9; }, jaw: (q) => { if (q[2] > 1.5) q[2] = 1.5 + (q[2] - 1.5) / 0.9; } },   // a slightly shorter snout
  },
  // The baby: stocky, short in the leg and tail, with a young version of the adult's own head (shorter snout, softer brow, bigger eyes,
  // the horns only just showing) rather than an oversized one.
  baby: {
    k: 0.42, kx: 0.7, fat: 1.45, skin: [0x3fae8e, 0x5cc7a2, 0x2b8676, 0x206a66, 0x154a4c],
    feat: { ...ADULT, plate: 0.62, plateW: 1.5, plateExp: 0.5, barb: 0, side: 0, horn: 0, hornBase: 0.4, noseHorn: 0, spike: 0, spur: 0, armour: 0, teeth: 0.6, tailSpikes: 0, throat: 0, brow: 0.78, eye: { y0: 1.0, z0: 2.0, rows: 4, cols: 5, pupil: 2 } },
    scale: { hips: [0.82, 0.72, 0.8], spine1: [0.84, 0.5, 0.8], spine2: [0.82, 0.5, 0.78], chest: [0.74, 0.55, 0.76], ribs: [0.74, 0.55, 0.76], neck1: [0.64, 0.5, 0.64], neck2: [0.64, 0.5, 0.64],
      head: uni(0.74), jaw: uni(0.74), arm: [0.6, 0.5, 0.6], forearm: [0.6, 0.6, 0.5], hand: uni(0.65), tail: [0.72, 0.62, 0.5] },
    rest: { tail1: [0.06, 0, 0] },
    snout: 0.8,
    warp: { head: (q) => { if (q[2] > 3) q[2] = 3 + (q[2] - 3) / 0.8; }, jaw: (q) => { if (q[2] > 1.5) q[2] = 1.5 + (q[2] - 1.5) / 0.8; } },    // a shorter snout
  },
};
const groupOf = (n) => (/^(thigh|shin|foot)/.test(n) ? 'leg' : /^tail/.test(n) ? 'tail' : n.replace(/[LR]$/, ''));
function stageParts(st, PARTS0 = PARTS) {
  const sc = (n) => (groupOf(n) === 'leg' ? [st.k * st.fat, st.k, st.k * st.fat] : st.scale[n] || st.scale[groupOf(n)] || ONE);
  return PARTS0.map((def) => {
    const n = def.name, g = groupOf(n), own = (st.parts && st.parts[n]) || {}, s = own.fill ? ONE : sc(def.like || n), ps = def.like ? sc(def.like) : def.parent ? sc(def.parent) : ONE;   // (`like`: a design's own part, sized and placed as that part is)
    const side = /L$/.test(n) ? 1 : -1, warp = st.warp && st.warp[n], base = own.fill || def.fill, q = [0, 0, 0];
    const pivot = own.pivot || (n === 'hips' ? [0, def.pivot[1] * st.k, 0] : /^thigh/.test(n) ? [7 * st.kx * side, -st.k, st.k] : g === 'leg' ? def.pivot.map((v) => v * st.k) : def.pivot.map((v, i) => v * ps[i]));
    const b = def.box, pad = b[0] === b[3] ? 0 : 1, box = own.box || [Math.floor(b[0] * s[0]) - pad, Math.floor(b[1] * s[1]) - (g === 'foot' ? 0 : pad), Math.floor(b[2] * s[2]) - pad, Math.ceil(b[3] * s[0]) + pad, Math.ceil(b[4] * s[1]) + pad, Math.ceil(b[5] * s[2]) + pad];
    const fill = own.fill ? base : (x, y, z) => { q[0] = x / s[0]; q[1] = y / s[1]; q[2] = z / s[2]; if (warp) warp(q); return base(q[0], q[1], q[2]); };
    return { ...def, pivot, box, fill, sc: s, sb: g === 'tail' || g === 'forearm' || g === 'jaw' ? 'z' : 'y', rest: (st.rest && st.rest[n]) || def.rest };
  });
}

// ---- voxelise one part and turn its exposed faces into a mesh with baked corner shading ----
const ONE = [1, 1, 1], AXES = [[0, 1, 2], [1, 2, 0], [2, 0, 1]]; // normal axis, then the two in-plane axes, right-handed
function buildPart(def) {
  const [x0, y0, z0, x1, y1, z1] = def.box, nx = (x1 - x0) * RES, ny = (y1 - y0) * RES, nz = (z1 - z0) * RES, h = 1 / RES;
  const col = new Int32Array(nx * ny * nz).fill(-1), sc = def.sc || ONE;
  SX = sc[0]; SY = sc[1]; SZ = sc[2]; SAZ = def.sb === 'z' || (!def.sb && /^(tail|forearm|jaw)/.test(def.name)); SB = def.sb === 'z' ? SZ : SY; SD = (SX + SY + SZ) / 3;
  const at = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) ? -1 : col[(k * ny + j) * nx + i];
  let count = 0, edge = false;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    RX = x0 + (i + 0.5) * h; RY = y0 + (j + 0.5) * h; RZ = z0 + (k + 0.5) * h;
    const c = def.fill(RX, RY, RZ); col[(k * ny + j) * nx + i] = c;
    if (c >= 0) { count++; if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) edge = true; }
  }
  const out = [{ p: [], n: [], c: [], ix: [] }, { p: [], n: [], c: [], ix: [] }], tmp = new THREE.Color(), cell = [0, 0, 0], q = [0, 0, 0];
  const solid = (c, a, da, u, du, v, dv) => { q[0] = c[0]; q[1] = c[1]; q[2] = c[2]; q[a] += da; q[u] += du; q[v] += dv; return at(q[0], q[1], q[2]) >= 0 ? 1 : 0; };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = at(i, j, k); if (c < 0) continue;
    cell[0] = i; cell[1] = j; cell[2] = k;
    const g = out[c & GLOW ? 1 : 0];
    tmp.setHex(c & 0xffffff).multiplyScalar(0.95 + 0.1 * hash(i, j, k, def.seed + 77)); // a little voxel-by-voxel mottle, like the town walls
    for (const [a, u, v] of AXES) for (const s of [1, -1]) {
      if (solid(cell, a, s, u, 0, v, 0)) continue;
      const base = g.p.length / 3, ao = [];
      const corners = s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
      for (const [cu, cv] of corners) {
        const pos = [i, j, k]; pos[a] += s > 0 ? 1 : 0; pos[u] += cu; pos[v] += cv; g.p.push(x0 + pos[0] * h, y0 + pos[1] * h, z0 + pos[2] * h);
        const nrm = [0, 0, 0]; nrm[a] = s; g.n.push(nrm[0], nrm[1], nrm[2]);
        const du = cu ? 1 : -1, dv = cv ? 1 : -1, s1 = solid(cell, a, s, u, du, v, 0), s2 = solid(cell, a, s, u, 0, v, dv), cr = solid(cell, a, s, u, du, v, dv);
        const o = s1 && s2 ? 0 : 3 - s1 - s2 - cr; ao.push(o);
        const sh = 0.6 + 0.4 * o / 3; g.c.push(tmp.r * sh, tmp.g * sh, tmp.b * sh);
      }
      if (ao[0] + ao[2] >= ao[1] + ao[3]) g.ix.push(base, base + 1, base + 2, base, base + 2, base + 3); else g.ix.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    }
  }
  return { count, edge, geos: out.map((g) => {
    if (!g.ix.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('normal', new THREE.Int8BufferAttribute(g.n, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3)); geo.setIndex(g.ix); return geo;
  }) };
}

// ---- assemble: one bone per part, parented into a skeleton tree ----
// Skins: Chompers in other paint, with a pattern of their own. The same body, rig and clips. `skin` is the five hide colours
// (light flank to dark spine, as in STAGES); a young one's are the same, a little lighter.
export const SKINS = {
  tiger: { name: 'Tiger', blurb: 'Chompers in tiger stripes: orange hide striped black, a white belly and ice-blue back plates.', feat: { stripe: 1 },
    skin: [0xf28a1c, 0xffab3d, 0xd96a10, 0xb04e0a, 0x6a2c06],
    paint: { CREAM: 0xfff6e6, CREAM2: 0xf2e2c4, SEAM: 0xc9ae84, AMBER: [0x0e6f8c, 0x1fb8d6, 0x6fe6ff, 0xd6faff], BROW: 0x3a1804, NOSTRIL: 0x2a1004, EYE: 0xb6ff4a, EYE2: 0x5fae1a, glow: 0x2fc8ff, glowBase: 0.35 } },
  midnight: { name: 'Midnight', blurb: 'Chompers after dark: a black and indigo hide, a lavender belly and back plates glowing neon pink.',
    skin: [0x2c2648, 0x3d3664, 0x1d1932, 0x131024, 0x09070f],
    paint: { CREAM: 0x8a7fc0, CREAM2: 0x7468a8, SEAM: 0x4a4078, AMBER: [0xa81e8c, 0xe63cc0, 0xff7ae0, 0xffd0f6], MOUTH: 0x5a1f6a, GUM: 0x3a1248, TONGUE: 0xd65ac8, THROAT: 0x14061c,
      EYE: 0x6affea, EYE2: 0x1fb8a8, BROW: 0x09070f, NOSTRIL: 0x05040a, glow: 0xff4fd0, glowBase: 0.45 } },
  star: { name: 'Starshard', costume: true, blurb: 'Chompers from deep space: a night-sky hide flecked with stars, a crown of crystal shards, a fan of great crystals on each shoulder, one set in his chest, tall shards down his back and a cluster on his tail, all lit from inside.',
    feat: { horn: 0, hornBase: 0, noseHorn: 0, spike: 0, tailSpikes: 0, armour: 0, plate: 1.25, plateW: 0.62, side: 0 }, over: () => STARBEAST,
    box: { head: [-9, -4, -10, 9, 14, 14], ribs: [-23, -4, -19, 23, 26, 10], tail7: [-7, -4, -15, 7, 7, 3] },
    skin: [0x2a2f6e, 0x3b4390, 0x1f2256, 0x15173e, 0x0a0b22],
    paint: { CREAM: 0x8f7fd6, CREAM2: 0x6f5fb8, SEAM: 0x45388a, AMBER: [0x1f8fc4, 0x4fd2f2, 0xa6f1ff, 0xf0fdff], MOUTH: 0x5a2a8a, GUM: 0x35185a, TONGUE: 0xc77dff, THROAT: 0x0c061c,
      BROW: 0x0a0b22, NOSTRIL: 0x05040f, EYE: 0x7fffe6, EYE2: 0x1fb8c8, glow: 0x6fe6ff, glowBase: 0.5 } },
  dragon: { name: 'Emberwing', costume: true, blurb: 'Chompers as a dragon: red scales and a gold belly, long horns swept back, great wings off his shoulders, and a spade on his tail.',
    feat: { horn: 0, hornBase: 0, tailSpikes: 0, plate: 0.6, side: 0 }, over: () => DRAGON, parts: () => WINGS(), box: { head: [-8, -4, -12, 8, 13, 14] },
    skin: [0xc8321e, 0xe2512c, 0xa32416, 0x7c1a12, 0x4a0e0a],
    paint: { CREAM: 0xf6c24a, CREAM2: 0xe0a32e, SEAM: 0xa06a14, AMBER: [0x7a1408, 0xd63c0e, 0xff8420, 0xffd04a], BROW: 0x4a0e0a, NOSTRIL: 0x2a0806, EYE: 0xffe83c, EYE2: 0xff8a1f, glow: 0xff5a10, glowBase: 0.4 } },
};
const dress = (sk) => { const o = sk.over ? sk.over() : {}, b = sk.box || {}; return PARTS.map((def) => { const f = def.fill, of = o[def.name]; return of || b[def.name] ? { ...def, box: b[def.name] || def.box, fill: of ? (x, y, z) => of(x, y, z, f(x, y, z)) : f } : def; }).concat(sk.parts ? sk.parts() : []); };
// ---- costumes: skins with parts of their own ----
// `over` re-dresses a part: over[part](x, y, z, c) is given the part's own colour at that spot (-1 for none) and returns the colour
// to use, so it can repaint the surface, add a shape, or leave it be. `box` is the wider sampling box a part then needs.
const mirror = (f) => ({ L: (x, y, z, c) => f(x, y, z, c), R: (x, y, z, c) => f(-x, y, z, c) });
const sides = (n, f) => { const m = mirror(f); return { [n + 'L']: m.L, [n + 'R']: m.R }; };
const speck = (c, x, y, z, s, a = 0.14) => tone(c, 1 - a / 2 + a * hash(Math.floor(x * 2), Math.floor(y * 2), Math.floor(z * 2), s));
const isHorn = (c) => c === IVORY || c === BONE;
const flank = (x, z, zc = 0.5) => Math.atan2(Math.abs(x), z - zc);      // 0 straight ahead, PI at the spine (as body() has it)
// a flat web of skin between three points: returns how far across it the spot is (0 at a, 1 on its free edge b-c, which is
// scalloped by `scal`), or -1 off it
export function web(a, b, c, th, scal = 0) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], nl = Math.hypot(n[0], n[1], n[2]);
  const d00 = e1[0] * e1[0] + e1[1] * e1[1] + e1[2] * e1[2], d01 = e1[0] * e2[0] + e1[1] * e2[1] + e1[2] * e2[2], d11 = e2[0] * e2[0] + e2[1] * e2[1] + e2[2] * e2[2], den = d00 * d11 - d01 * d01;
  return (x, y, z) => {
    const vx = x - a[0], vy = y - a[1], vz = z - a[2];
    if (Math.abs(vx * n[0] + vy * n[1] + vz * n[2]) > th * nl) return -1;
    const d20 = vx * e1[0] + vy * e1[1] + vz * e1[2], d21 = vx * e2[0] + vy * e2[1] + vz * e2[2], u = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den;
    if (u < 0 || w < 0) return -1;
    const k = (u + w) / (1 - (scal && u + w > 0 ? scal * Math.sin(Math.PI * w / (u + w)) : 0));
    return k <= 1 ? k : -1;
  };
}
// The dragon: long horns swept back, a spade on the tail, and wings. A wing (left side here, mirrored for the right) is an arm
// up and out from the shoulder blade to a wrist, three long fingers fanned from the wrist, and skin between the fingers and
// back down to the body, scalloped along its trailing edge.
const WO = [4.2, 7, -6.6], WW = [14.5, 25, -10.5], WF = [[35.5, 31, -16], [34.5, 11, -23], [23, -4, -26]], WB = [4.8, 0.5, -9.5];
const BONE_R = 0x5a120c, WEB_C = 0xf08a2a, WEB_D = 0xc8601a;
// One wing as a fill, left side (flip x for the right), in the space its points are given in. O the root, W the wrist, F the
// finger tips from the leading edge back, B where the skin meets the body; `bone`, `skin`, `rib` colours and `claw()`.
// (The rivals' wings are made with this too: rivals/src/brine.js.) While it colours a spot it says in WING_PIECE which
// piece of the wing that spot belongs to, so the wing can be cut into parts that fold (wingParts, below): 0 the arm, with
// the skin from the arm and the last finger down to the body; 1, 2, ... a finger and the skin that rides it. The skin
// between two fingers rides the leading one, except the last sheet, which rides the last finger: so the fan closes from
// both sides over a middle finger that is bare bone.
export let WING_PIECE = 0;
export function wingShape({ O, W, F, B, bone, skin, rib, claw, scal = 0.2, th = 0.6, arm = [2.0, 1.4], finger = [1.4, 0.5], seed = 9 }) {
  const n = F.length, webs = F.map((f, i) => [web(W, f, F[i + 1] || B, th, i === n - 1 ? scal * 1.2 : scal), 1, i === n - 1 ? 0 : i === n - 2 ? n : i + 1]).concat([[web(O, W, B, th), 0, 0]]);
  return (x, y, z) => {
    WING_PIECE = 0;
    if (cap(x, y, z, O[0], O[1], O[2], W[0], W[1], W[2], arm[0], arm[1]) <= 0) return bone;                 // the arm
    if (cap(x, y, z, W[0], W[1], W[2], W[0] + 1.5, W[1] + 4.6, W[2] + 3.4, 1.1, 0.2) <= 0) return capT > 0.35 ? claw() : bone;   // a thumb claw on the wrist
    for (let i = 0; i < n; i++) { const t = F[i]; if (cap(x, y, z, W[0], W[1], W[2], t[0], t[1], t[2], finger[0], finger[1]) <= 0) { WING_PIECE = i + 1; return capT > 0.95 ? claw() : bone; } }   // fingers, clawed
    for (const [w, rim, piece] of webs) { const k = w(x, y, z); if (k >= 0) { WING_PIECE = piece; return rim && k > 0.93 ? bone : frac(k * 6) < 0.12 ? rib : speck(skin, x, y, z, seed, 0.1); } }   // the skin between them
    return -1;
  };
}
// A pair of wings as parts that fold: for each side an arm (`wingL`, `wingR`), hinged at the shoulder blade `at` (in the
// parent's space), and a part for each finger (`wing1L`, `wing2L`, ...) hinged on the arm at the wrist. `pts` are the
// wing's points (O, W, F, B, as for wingShape; left side, in any one space), `shape` a wingShape of them, `cut` how far
// across the body's midline a wing may reach, `wrap(colour, x, y, z)` a last word on each spot (holes, say). The clips
// that fold, flap and flare them are kaiju/src/wings.js; `like` sizes them with that part in a young one.
export function wingParts({ at, pts, shape, parent = 'chest', like, seed = 40, cut = -2.7, wrap, pad = 3 }) {
  const { O, W, F } = pts, n = F.length, thumb = [W[0] + 1.5, W[1] + 4.6, W[2] + 3.4], out = [];
  const boxOf = (ps, o, sd) => { const b = [0, 1, 2].map((i) => Math.floor(Math.min(...ps.map((p) => p[i] - o[i])) - pad)).concat([0, 1, 2].map((i) => Math.ceil(Math.max(...ps.map((p) => p[i] - o[i])) + pad))); return sd > 0 ? b : [-b[3], b[1], b[2], -b[0], b[4], b[5]]; };
  for (const sd of [1, -1]) {
    const S = sd > 0 ? 'L' : 'R';
    const fill = (piece, o) => (x, y, z) => { const X = x * sd + o[0], Y = y + o[1], Z = z + o[2]; if (X - O[0] < cut) return -1; const c = shape(X, Y, Z); return c < 0 || WING_PIECE !== piece ? -1 : wrap ? wrap(c, X - O[0], Y - O[1], Z - O[2]) : c; };
    out.push({ name: 'wing' + S, parent, like, pivot: [at[0] * sd, at[1], at[2]], seed, box: boxOf([O, W, pts.B, F[n - 1], thumb], O, sd), fill: fill(0, O) });
    for (let i = 0; i < n; i++) out.push({ name: 'wing' + (i + 1) + S, parent: 'wing' + S, like, pivot: [(W[0] - O[0]) * sd, W[1] - O[1], W[2] - O[2]], seed: seed + 1 + i,
      box: boxOf([W, F[i], i === n - 1 ? F[Math.max(0, n - 2)] : i < n - 2 ? F[i + 1] : F[i]], W, sd), fill: fill(i + 1, W) });
  }
  return out;
}
const WING_PTS = { O: WO, W: WW, F: WF, B: WB };
const dragonWing = wingShape({ ...WING_PTS, bone: BONE_R, skin: WEB_C, rib: WEB_D, claw: () => IVORY });
// The wings hang off the chest and are sized with the rib cage in a young one. kaiju/src/anim.js bakeClips poses them.
const WINGS = () => wingParts({ at: WO, pts: WING_PTS, shape: dragonWing, like: 'ribs' });
SKINS.dragon.wing = wingRig(WING_PTS);   // how they fold and beat: the shared dials, as they are
const DRAGON = {
  head: (x, y, z, c) => {
    const ax = Math.abs(x);
    if (cap(ax, y, z, 3.3, 4.4, 0.6, 4.9, 8.2, -4.2, 1.35, 1.0) <= 0) return capT < 0.3 ? BONE : IVORY;
    if (cap(ax, y, z, 4.9, 8.2, -4.2, 5.5, 10.6, -9.6, 1.0, 0.25) <= 0) return IVORY;
    if (cap(ax, y, z, 3.6, -0.6, 8.6, 5.2, -1.4, 6.6, 0.5, 0.2) <= 0) return IVORY;                         // a whisker spike each side of the mouth
    return c;
  },
  tail7: (x, y, z, c) => {
    const w = z > -5.4 ? 4.4 * (-2.2 - z) / 3.2 : 4.4 * (z + 8.8) / 3.4;                                    // a flat spade
    if (z < -2.2 && z > -8.8 && Math.abs(x) < w && Math.abs(y + 0.4) < 0.6) return Math.abs(x) > w - 0.9 ? BONE_R : WEB_C;
    return c;
  },
};
// The star beast: crystals in place of horns and plates. A crown of shards on the head, a fan of three on each shoulder, a
// row of tall shards down the back and a cluster on the end of the tail, all lit from inside; a hide like the night sky.
const XT = 0x7fe9ff, XT_L = 0xe6fbff, XT_D = 0x2aa6d8, XT_P = 0xc77dff, STAR = 0xdff6ff;
// a shard: a spike from a to b (radius r at the root), lighter towards its tip, some of its cubes catching the light
function shard(x, y, z, ax, ay, az, bx, by, bz, r, tint) {
  if (cap(x, y, z, ax, ay, az, bx, by, bz, r, r * 0.12) > 0) return -1;
  const t = capT, f = hash(Math.floor(x * 2), Math.floor(z * 2), 0, 31);
  return (tint ? (t > 0.75 ? XT_L : XT_P) : t > 0.72 ? XT_L : f < 0.3 ? XT_L : t < 0.2 ? XT_D : XT) | GLOW;
}
const first = (...c) => { for (const v of c) if (v >= 0) return v; return -1; };
const stars = (c, x, y, z) => (c >= 0 && !(c & GLOW) && hash(Math.floor(x * 2), Math.floor(y * 2), Math.floor(z * 2), 77) < 0.035 ? STAR : c);
const SHOULDER = [[7.0, 5.5, -1.0, 13.5, 22.5, -6.5, 2.9, 0], [8.5, 5.0, -1.5, 20.0, 13.5, -7.5, 2.3, 1], [6.0, 5.5, -3.5, 9.5, 15.5, -14.0, 2.1, 0], [8.0, 5.5, 1.0, 12.0, 13.0, 3.2, 1.5, 0]];   // in the rib cage's space, left side: they stand on the shoulders and do not swing with the arms
const STARBEAST = {
  head: (x, y, z, c) => {
    const ax = Math.abs(x);
    const k = first(shard(x, y, z, 0, 4.6, 0.5, 0, 12.5, -2.5, 1.9, 0), shard(ax, y, z, 2.8, 4.4, 0.2, 5.6, 10.6, -3.4, 1.6, 0), shard(ax, y, z, 3.6, 3.6, -1.6, 7.4, 6.8, -6.4, 1.3, 1), shard(x, y, z, 0, 4.4, -2.2, 0, 8.4, -8.2, 1.4, 1));   // the crown
    return k >= 0 ? k : stars(c, x, y, z);
  },
  ribs: (x, y, z, c) => {
    const ax = Math.abs(x);
    if (ax > 4) for (const q of SHOULDER) { const k = shard(ax, y, z, ...q); if (k >= 0) return k; }
    if (c >= 0 && !(c & GLOW) && z > 0 && flank(x, z) < 0.7 && ax / 2.6 + Math.abs(y - 3.2) / 3.8 < 1) return (ax / 2.6 + Math.abs(y - 3.2) / 3.8 < 0.45 ? XT_L : XT) | GLOW;   // a crystal set in the chest
    return stars(c, x, y, z);
  },
  tail7: (x, y, z, c) => {
    const ax = Math.abs(x), k = first(shard(x, y, z, 0, -0.4, -4.0, 0, 0.6, -13.5, 1.7, 0), shard(ax, y, z, 0.4, -0.2, -3.6, 5.2, 2.4, -9.5, 1.3, 1), shard(x, y, z, 0, 0.2, -3.2, 0, 5.6, -8.4, 1.3, 0), shard(ax, y, z, 0.3, -0.4, -2.2, 3.6, 3.4, -4.6, 1.0, 0));
    return k >= 0 ? k : stars(c, x, y, z);
  },
};
for (const n of ['hips', 'spine1', 'spine2', 'armL', 'armR', 'neck1', 'neck2', 'tail1', 'tail2', 'tail3', 'tail4', 'tail5', 'tail6', 'thighL', 'thighR', 'shinL', 'shinR', 'forearmL', 'forearmR']) STARBEAST[n] = (x, y, z, c) => stars(c, x, y, z);
const lighter = (c, t) => { const f = (s) => Math.round(((c >> s) & 255) + (255 - ((c >> s) & 255)) * t); return (f(16) << 16) | (f(8) << 8) | f(0); };
export function buildKaiju(stage, skin) {
  const st = STAGES[stage] || null, sk = typeof skin === 'string' ? SKINS[skin] : skin, P = sk && (sk.over || sk.box || sk.parts) ? dress(sk) : PARTS, parts = st ? stageParts(st, P) : P;
  F = { ...(st ? st.feat : ADULT), ...(sk && sk.feat) }; useSkin(sk && sk.skin ? sk.skin.map((c) => lighter(c, stage === 'baby' ? 0.14 : stage === 'teen' ? 0.07 : 0)) : st && st.skin); use(sk && sk.paint); if (sk && sk.paint && sk.paint.ARM) ARMOUR = sk.paint.ARM;
  const skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  const plateMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, emissive: new THREE.Color(GLOW_C), emissiveIntensity: GLOW_B });
  const root = new THREE.Group(); root.name = 'kaiju';
  const bones = {}, rest = {}, clipped = []; let voxels = 0, tris = 0;
  for (const def of parts) {
    const b = new THREE.Group(); b.name = def.name; b.position.fromArray(def.pivot);
    rest[def.name] = { pos: def.pivot.slice(), rot: (def.rest || [0, 0, 0]).slice() }; b.rotation.set(rest[def.name].rot[0], rest[def.name].rot[1], rest[def.name].rot[2], 'YXZ');
    const built = buildPart(def); voxels += built.count; if (built.edge) clipped.push(def.name);
    built.geos.forEach((geo, gi) => { if (!geo) return; const m = new THREE.Mesh(geo, gi ? plateMat : skinMat); m.name = def.name + (gi ? '_plates' : '_skin'); m.castShadow = true; m.receiveShadow = true; b.add(m); tris += geo.index.count / 3; });
    (def.parent ? bones[def.parent] : root).add(b); bones[def.name] = b;
  }
  F = ADULT; useSkin(null); use();
  return { root, bones, rest, skinMat, plateMat, wing: (sk && sk.wing) || null, stage: st ? stage : 'adult', parts, k: st ? st.k : 1, kx: st ? st.kx : 1, snout: st ? st.snout || 1 : 1, plate: st ? st.feat.plate : 1, stats: { voxels, tris, parts: PARTS.length, clipped } };
}
