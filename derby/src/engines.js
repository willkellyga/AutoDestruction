// The engines under the bonnet. Each is built to fit its car's engine bay (carshapes.js bodyPart): e.w is half the
// bay's width, e.h its height from the floor to the underside of the bonnet, e.L its length, all in cubes, and e.front
// says whether the engine sits in the nose (with a radiator and fan ahead of it) or behind the cabin. The part's pivot
// is the middle of the bay's floor, so x runs -w..w, y 0..h and z -L/2..L/2 with +z towards the car's nose. The garage
// lifts the bonnet to show it (main.js); the supercharger's blower stands up through a hole in the bonnet.
import { GLOW } from '../../units/src/voxpart.js';
import { CHROME, CHROMEL, CHROMED, PLASTIC, HOLE, GUNMETAL, STEEL, BRIGHT, DARKS, TRIM, BLOWER } from './carshapes.js';

const PI = Math.PI, ab = Math.abs, fl = Math.floor, hyp = Math.hypot;
const IRON = 0x5d6168, IRON2 = 0x3a3d42, ALLOY = 0x7d838b, BLACK = 0x1d1f23, RIB = 0x34373c, RED = 0xb8321e, RED2 = 0x8a2518;
const ORANGE = 0xc0541f, ORANGE2 = 0xa84818, RUSTY = 0x8f5a30, RUSTY2 = 0x6e4426, GREEN = 0x4b5a4a, GREEN2 = 0x323b31, GREEN3 = 0x5d6c5b;
const BLUE = 0x2f62a8, CREAM = 0xe8e4da, AMBERC = 0xd9a227, BRONZE = 0xb07a3a, BRONZE2 = 0x8a5a2a, HOT = 0xff8a2a | GLOW, FIN = 0x2a2c30, FIN2 = 0x3a3d42;

// how a point turns around a centre, as a fraction of a turn
const turnOf = (y, x) => (((Math.atan2(y, x) / (2 * PI)) % 1) + 1) % 1;

// the radiator across the front of the bay and the fan behind it; the block runs from z0 to z1 behind them
function frontEnd(e) {
  const { w, h, L } = e, zr = L / 2, z1 = e.front ? zr - 3.5 : zr - 0.5, z0 = -zr + 0.5, fr = Math.min(w * 0.5, h * 0.42);
  const rad = (x, y, z) => {
    if (!e.front) return -1;
    if (z > zr - 1.6 && ab(x) < w * 0.92 && y > 0.5 && y < h * 0.92) return ab(x) > w * 0.92 - 1 || y < 1.5 || y > h * 0.92 - 1 ? DARKS : (fl(x) & 1) ? FIN : FIN2;
    if (z > zr - 3 && z <= zr - 1.6) { const d = hyp(x, y - h * 0.5); if (d < fr) return d < 1.2 ? STEEL : (turnOf(y - h * 0.5, x) * 7 % 1) < 0.55 ? GUNMETAL : DARKS; }
    return -1;
  };
  return { z0, z1, zc: (z0 + z1) / 2, rad };
}
// the runners of a manifold along the block: n of them between z0 and z1
const runner = (z, z0, z1, n) => { const p = (z1 - z0) / n, u = ((z - z0) % p + p) % p; return u > p * 0.2 && u < p * 0.65; };
// a snail-shell turbo in the y-z plane, centred at (y0, z0) on side x0..x1
function snail(x, y, z, x0, x1, y0, z0, R, hous, hous2) {
  if (x < x0 || x > x1) return -1;
  const d = hyp(y - y0, z - z0); if (d > R) return -1;
  if (d < R * 0.32) return HOLE;
  return (turnOf(y - y0, z - z0) + d / R * 0.5) % 0.5 < 0.08 ? hous2 : hous;
}

const MODELS = {
  // an inline four: a cast-iron block, an alloy head, a ribbed black cam cover, the intake on one side and the exhaust
  // on the other, the air box, the battery and the coolant tank
  stock(e) {
    const { w, h } = e, F = frontEnd(e), { z0, z1 } = F;
    return (x, y, z) => {
      const r = F.rad(x, y, z); if (r >= 0) return r;
      if (z < z0 || z > z1) return -1;
      const ax = ab(x);
      if (hyp(x + w * 0.1, z - (z0 + 3)) < 1 && y > h * 0.68 && y < h * 0.9) return AMBERC;                                  // the oil cap
      if (ax < w * 0.24 && y >= h * 0.68 && y < h * 0.82 && z > z0 + 1.5 && z < z1 - 1.5) return fl(z) % 3 === 0 ? RIB : y >= h * 0.82 - 1 && ax < w * 0.1 ? CREAM : BLACK;   // the cam cover, its name along the top
      if (ax < w * 0.28 && y >= h * 0.55 && y < h * 0.68 && z > z0 + 1 && z < z1 - 1) return ALLOY;                          // the head
      if (ax < w * 0.3 && y < h * 0.55 && z > z0 + 1 && z < z1 - 1) return y < h * 0.15 ? IRON2 : IRON;                       // the block and its sump
      if (x > w * 0.3 && x < w * 0.5 && y > h * 0.45 && y < h * 0.65 && runner(z, z0 + 1, z1 - 1, 4)) return STEEL;           // the intake runners
      if (x >= w * 0.5 && x < w * 0.64 && y > h * 0.42 && y < h * 0.76 && z > z0 + 1 && z < z1 - 1) return STEEL;            // the plenum
      if (x < -w * 0.3 && x > -w * 0.5 && y > h * 0.3 && y < h * 0.55 && runner(z, z0 + 1, z1 - 1, 4)) return (fl(y) & 1) ? RUSTY : RUSTY2;   // the exhaust
      if (x > w * 0.64 && x < w * 0.9 && y > h * 0.5 && y < h * 0.88 && z > z1 - 6) return y > h * 0.84 ? RIB : PLASTIC;      // the air box
      if (x < -w * 0.55 && x > -w * 0.92 && y > h * 0.4 && y < h * 0.82 && z < z0 + 5) {                                     // the battery
        if (y > h * 0.82 - 1) return z < z0 + 1.6 ? (x > -w * 0.7 ? RED : BLACK) : PLASTIC;
        return PLASTIC;
      }
      if (x < -w * 0.6 && x > -w * 0.9 && y > h * 0.55 && y < h * 0.85 && z > z1 - 4) return y > h * 0.85 - 1 && x > -w * 0.8 ? BLACK : CREAM;   // the coolant tank
      return -1;
    };
  },
  // the same four with a turbo on its exhaust side: a red cam cover, a polished pipe to an intercooler in the nose
  turbo(e) {
    const { w, h, L } = e, base = MODELS.stock(e), F = frontEnd(e), { z0, z1 } = F, ty = h * 0.5, tz = z0 + (z1 - z0) * 0.62, R = Math.min(h * 0.24, 3.2);
    return (x, y, z) => {
      if (e.front && z > L / 2 - 1.6 && ab(x) < w * 0.92 && y > 0.5 && y < h * 0.34) return (fl(x) & 1) ? BRIGHT : STEEL;   // the intercooler
      const sn = snail(x, y, z, -w * 0.72, -w * 0.46, ty, tz, R, BRIGHT, STEEL); if (sn >= 0) return sn;
      if (hyp(x + w * 0.59, y - h * 0.8) < 1 && z > tz && z < z1 + (e.front ? 2 : 0)) return z > tz + 2 && z < tz + 3 ? BLUE : CHROME;   // the pipe, its blow-off valve
      const c = base(x, y, z);
      if (c === BLACK) return RED; if (c === RIB) return RED2;
      return c;
    };
  },
  // a V8: an orange block, two chrome rocker covers on its banks, a big round chrome air cleaner on top, headers
  v8(e, blower) {
    const { w, h } = e, F = frontEnd(e), { z0, z1, zc } = F, ar = Math.min(w * 0.42, (z1 - z0) * 0.22);
    return (x, y, z) => {
      const r = F.rad(x, y, z); if (r >= 0) return r;
      if (z < z0 || z > z1) return -1;
      const ax = ab(x);
      if (!blower) {
        const d = hyp(x, z - zc);
        if (d < 0.9 && y >= h * 0.92 && y < h * 0.92 + 1) return BRIGHT;                                                      // the wing nut
        if (d < ar && y >= h * 0.72 && y < h * 0.92) return y > h * 0.92 - 1 ? CHROMEL : d > ar - 1 ? CHROMED : CHROME;        // the air cleaner
      }
      if (ax > w * 0.27 && ax < w * 0.57 && y >= h * 0.62 && y < h * 0.74 && z > z0 + 1 && z < z1 - 1) return fl(z) % 3 === 0 ? CHROMEL : CHROME;   // the rocker covers
      if (ax < w * 0.22 && y >= h * 0.4 && y < h * 0.72 && z > z0 + 1.5 && z < z1 - 1.5) return (fl(z) & 1) ? ORANGE2 : ORANGE;   // the intake manifold
      if (y >= h * 0.4 && y < h * 0.62 && ab(ax - (w * 0.3 + (y - h * 0.4) * 0.5)) < w * 0.17 && z > z0 + 1 && z < z1 - 1) return ORANGE;   // the banks
      if (ax < w * 0.5 && y < h * 0.4 && z > z0 + 1 && z < z1 - 1) return y < h * 0.12 ? IRON2 : ORANGE;                      // the block, the sump
      if (ax > w * 0.58 && ax < w * 0.8 && y > h * 0.2 && y < h * 0.46 && runner(z, z0 + 1, z1 - 1, 4)) return (fl(y) & 1) ? BRIGHT : CHROME;   // the headers
      if (hyp(x, z - (z0 + 1.2)) < 1.2 && y >= h * 0.4 && y < h * 0.82) return y > h * 0.75 ? RED : BLACK;                 // the distributor
      return -1;
    };
  },
  // the V8 with a blower: a tall polished case driven by a belt off the front, an injector scoop on top
  blower(e) {
    const { w, h } = e, base = MODELS.v8(e, true), F = frontEnd(e), { zc } = F;
    const cz = Math.min((F.z1 - F.z0) * 0.25, BLOWER.hz - 1.2), sz = Math.min((F.z1 - F.z0) * 0.2, BLOWER.hz - 1.6), cx = Math.min(w * 0.3, BLOWER.hx - 1.2), top = h + BLOWER.up;
    return (x, y, z) => {
      const ax = ab(x), dz = z - zc;
      if (ax < cx + 0.4 && y >= h + 2.6 && y < top && ab(dz) < sz + 0.4) {                                                    // the scoop
        if (dz > sz - 0.6 && y < top - 0.8 && ax < cx - 0.4) return HOLE;
        return y > top - 1 ? RIB : ax < 0.6 && dz > sz - 1.6 ? CHROME : BLACK;
      }
      if (ax < cx && y >= h * 0.62 && y < h + 2.6 && ab(dz) < cz) return fl(y) % 2 === 0 ? CHROMED : CHROMEL;               // the case
      if (dz >= cz && dz < cz + 1.5 && ax < cx * 0.7 && y > h * 0.3 && y < h + 1.5) {                                        // the belt and its pulleys
        if (hyp(x, y - h * 0.38) < 1.7 || hyp(x, y - (h + 0.6)) < 1.5) return STEEL;
        return ax < 1 ? TRIM : -1;
      }
      return base(x, y, z);
    };
  },
  // a big straight-six diesel: a green block and head, two long cam covers, chrome injector lines, a big rusty
  // turbo, a black air filter can along the side, a red fuel filter
  diesel(e) {
    const { w, h } = e, F = frontEnd(e), { z0, z1 } = F, ty = h * 0.58, tz = z0 + (z1 - z0) * 0.3, R = Math.min(h * 0.26, 3.6), fr = Math.min(w * 0.2, h * 0.19);
    return (x, y, z) => {
      const r = F.rad(x, y, z); if (r >= 0) return r;
      if (z < z0 || z > z1) return -1;
      const ax = ab(x), zm = (z0 + z1) / 2;
      const sn = snail(x, y, z, -w * 0.76, -w * 0.48, ty, tz, R, RUSTY, RUSTY2); if (sn >= 0) return sn;
      if (ax < w * 0.3 && y >= h * 0.72 && y < h * 0.84 && z > z0 + 1.5 && z < z1 - 1.5 && ab(z - zm) > 0.6) return fl(z) % 4 === 0 && ax > w * 0.2 ? STEEL : BLACK;   // the cam covers
      if (x > w * 0.3 && x < w * 0.38 && y > h * 0.58 && y < h * 0.76 && runner(z, z0 + 1.5, z1 - 1.5, 6)) return CHROME;      // the injector lines
      if (ax < w * 0.36 && y >= h * 0.62 && y < h * 0.72 && z > z0 + 1 && z < z1 - 1) return GREEN3;                          // the head
      if (ax < w * 0.4 && y < h * 0.62 && z > z0 + 0.5 && z < z1 - 0.5) return y < h * 0.15 ? GREEN2 : (fl(z) % 5 === 0 ? GREEN2 : GREEN);   // the block
      if (hyp(x - w * 0.66, y - h * 0.72) < fr && z > z0 + 1 && z < z1 - 2) return z < z0 + 2 || z > z1 - 3 ? STEEL : fl(z) % 3 === 0 ? RIB : PLASTIC;   // the air filter
      if (hyp(x - w * 0.6, z - (z0 + 2.5)) < 1.3 && y > h * 0.2 && y < h * 0.55) return y > h * 0.5 ? STEEL : RED;           // the fuel filter
      return -1;
    };
  },
  // a jet turbine on its side: a chrome lip round a fan and spinner at the front, banded casing, a bronze hot section
  // and a nozzle glowing inside at the back, strapped down to the bay's floor
  jet(e) {
    const { w, h, L } = e, r = Math.min(w * 0.82, h * 0.48), cy = r + 0.3, zf = L / 2 - 0.5, zb = -L / 2 + 0.5, zs = [zb + L * 0.25, zf - L * 0.25];
    return (x, y, z) => {
      if (z < zb || z > zf) return -1;
      const d = hyp(x, y - cy);
      if (zs.some((s) => ab(z - s) < 0.6) && ((d >= r && d < r + 0.9 && y < cy + r * 0.3) || (ab(ab(x) - r * 0.55) < 0.6 && y < cy - r * 0.6))) return DARKS;   // the straps and legs
      if (d > r) return -1;
      if (z > zf - 1.8) return d > r - 1.2 ? CHROMEL : -1;                                                                     // the lip
      if (z > zf - 2.8) return d < 1.4 ? BRIGHT : d > r - 1.2 ? CHROME : (turnOf(y - cy, x) * 12 % 1) < 0.5 ? BRIGHT : DARKS;    // the fan and spinner
      if (z < zb + 3) return d > r * 0.8 ? -1 : d > r * 0.8 - 1 ? DARKS : z < zb + 1 ? HOT : HOLE;                            // the nozzle
      const hot = z < zb + 3 + L * 0.3;
      if (fl(z) % 4 === 0) return hot ? BRONZE2 : DARKS;
      return hot ? BRONZE : d > r - 1 ? (y > cy ? BRIGHT : STEEL) : GUNMETAL;                                                // the casing
    };
  },
};
export const ENGINE_LOOKS = Object.keys(MODELS);

// The engine part for a bay. kind: the engine's look (its key in parts.js).
export function enginePart(kind, e) {
  const fn = (MODELS[kind] || MODELS.stock)(e), up = kind === 'blower' ? BLOWER.up + 0.5 : 1;
  const W = Math.ceil(e.w) + 1, Lh = Math.ceil(e.L / 2) + 1;
  return { name: 'engine', parent: 'body', pivot: [0, e.y0, e.zc], box: [-W, 0, -Lh, W, Math.ceil(e.h + up), Lh], paint(v) { v.fill(fn); } };
}
