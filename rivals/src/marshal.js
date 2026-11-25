// The Marshal: the army's walker mech, on Chompers' skeleton so his clips play on it. Olive-drab armour plate over gunmetal joints,
// a cockpit head shaped like a general's peaked cap with a glowing visor and a bulldog chin plate, a white star on the chest, a
// missile pod on each shoulder that tips up to fire, forearms that drive their fists out on chrome pistons, hydraulic legs with
// big two-toed feet. (He was first built with a jointed tail ending in a striped counterweight; Will had it removed.)
// Every part is sculpted in its own bone's space (flat plates stay flat on the voxel grid, whatever way the bone leans), with a
// drum or ball at its joint so that nothing opens up when it bends. The hull rides on the `chest` bone, not `ribs`, so it does
// not swell when the shared clips breathe.
import * as THREE from 'three';
import { GLOW, tone, frac, grain, hash, sdE } from './vox.js';
import { buildBiped, stretch, stageSpec } from './biped.js';

const side = (n, v) => ({ [n + 'L']: v, [n + 'R']: [-v[0], v[1], v[2]] }), turn = (n, v) => ({ [n + 'L']: v, [n + 'R']: [v[0], -v[1], -v[2]] });
const TAIL_STEP = [0, -1.6, -4.6];
export const MARSHAL_RIG = {
  pivot: { hips: [0, 26, 0], ...side('thigh', [8, -1.5, 0.5]), ...side('shin', [0.5, -11.5, 4]), ...side('foot', [0, -10, -4]),
    spine1: [0, 4.5, 0.5], spine2: [0, 5, 0.5], chest: [0, 5, 0.5], neck1: [0, 12.4, 5.5], neck2: [0, 1.6, 1], head: [0, 1.6, 1], jaw: [0, -0.5, 2],
    ...side('arm', [15.5, 7.5, 0.5]), ...side('forearm', [0.6, -11.5, 1.2]), ...side('hand', [0, -1.5, 10]),
    tail1: [0, 0.5, -7.5], tail2: TAIL_STEP, tail3: TAIL_STEP, tail4: TAIL_STEP, tail5: TAIL_STEP, tail6: TAIL_STEP, tail7: TAIL_STEP },
  rest: { hips: [0.05, 0, 0], spine1: [0.08, 0, 0], spine2: [0.09, 0, 0], chest: [0.14, 0, 0], neck1: [0.1, 0, 0], neck2: [0.1, 0, 0], head: [-0.56, 0, 0],
    ...turn('arm', [-0.42, 0, 0.2]), ...turn('forearm', [0.75, -0.15, 0]), ...turn('hand', [0.25, 0, -0.35]), tail1: [-0.05, 0, 0] },
};

// The paint. These are the army's colours; a skin (below, SKINS) swaps them for its own while its model is built.
const ARMY = { body: 0x5f6e3b, light: 0x7a8a4d, dark: 0x47532c, deep: 0x2f381f, steel: 0x9aa1a8, steelD: 0x5d646c, gun: 0x383d44, black: 0x1a1c1f, chrome: 0xd3dbe2,
  haz: 0xf0bf2c, hazB: 0x1a1c1f, white: 0xe9e6d8, gold: 0xe9b63a, red: 0xc7382c, lens: 0x101418, visor: 0xd63a16, visorL: 0xfff1b8, vent: 0xff7a2e, lamp: 0xff3a2a, hat: 0x5f6e3b, glow: 0xff5a1e };
let OLIVE, OLIVE_L, OLIVE_D, OLIVE_DD, STEEL, STEEL_D, GUN, BLACK, CHROME, HAZ, HAZ_B, WHITE, GOLD, RED, LENS, VISOR, VISOR_L, VENT, LAMP, HAT;
function use(p) {
  OLIVE = p.body; OLIVE_L = p.light; OLIVE_D = p.dark; OLIVE_DD = p.deep; STEEL = p.steel; STEEL_D = p.steelD; GUN = p.gun; BLACK = p.black; CHROME = p.chrome;
  HAZ = p.haz; HAZ_B = p.hazB; WHITE = p.white; GOLD = p.gold; RED = p.red; LENS = p.lens; HAT = p.hat;
  VISOR = p.visor | GLOW; VISOR_L = p.visorL | GLOW; VENT = p.vent | GLOW; LAMP = p.lamp | GLOW;
}
use(ARMY);

// What a prototype has less of (the growth stages turn these down): the peaked cap, the missile pods (0 none, 0.5 a small pod of
// two, 1 the full six), the star, the hazard stripes, the exhaust stacks, the counterweight on the tail, the armour skirts.
// A skin also picks the hat ('cap', 'hard', 'toy', 'fin'), the badge ('star', 'gear', 'dial', 'bolt'), the eyes ('slit', 'round') and what rides on the back ('stacks', 'key', 'jets').
const ADULT = { cap: 1, pods: 1, star: 1, haz: 1, stacks: 1, weight: 1, plate: 1, lens: 1, tail: 0, hat: 'cap', badge: 'star', eyes: 'slit', back: 'stacks' };   // tail: Will had it taken off (the sculpt is kept below, switched off)
let F = ADULT;

// ---- shapes: boxes with cut corners, drums, and how near a point is to a plate's edge ----
const E = { a: 0, b: 0, c: 0 };
function bev(x, y, z, cx, cy, cz, hx, hy, hz, c = 1) {
  const a = Math.abs(x - cx) - hx, b = Math.abs(y - cy) - hy, d = Math.abs(z - cz) - hz; E.a = a; E.b = b; E.c = d;
  return Math.max(a, b, d, a + b + c, a + d + c, b + d + c);
}
const drumX = (x, y, z, cy, cz, r, x0, x1) => Math.max(Math.hypot(y - cy, z - cz) - r, x0 - x, x - x1);
const drumY = (x, y, z, cx, cz, r, y0, y1) => Math.max(Math.hypot(x - cx, z - cz) - r, y0 - y, y - y1);
const drumZ = (x, y, z, cx, cy, r, z0, z1) => Math.max(Math.hypot(x - cx, y - cy) - r, z0 - z, z - z1);
const ball = (x, y, z, cx, cy, cz, r) => Math.hypot(x - cx, y - cy, z - cz) - r;
// Painted armour: worn bright along the edges of a plate, chipped here and there, blotched like camouflage elsewhere.
function paint(d, x, y, z, base, seed) {
  if (d < -1.3) return OLIVE_DD;
  const near = (E.a > -0.55 ? 1 : 0) + (E.b > -0.55 ? 1 : 0) + (E.c > -0.55 ? 1 : 0), g = grain(x, y, z, seed);
  if (near >= 2) return g > 0.8 ? STEEL : tone(base, 1.18);
  if (g > 0.988) return STEEL_D;
  const b = hash(Math.floor(x / 2.5 + 0.3 * Math.floor(y / 2.5)), Math.floor(y / 2.5), Math.floor(z / 2.5), seed + 1);
  return tone(base, b > 0.7 ? 0.9 : b < 0.2 ? 1.06 : 1);
}
const metal = (d, x, y, z, base, seed) => (d < -1.3 ? BLACK : tone(base, 0.92 + 0.16 * grain(x, y, z, seed)));
// A five-pointed star of radius R about (0, 0), one point up.
function star(u, v, R) {
  const k = Math.PI / 5, r = Math.hypot(u, v), a = Math.atan2(u, v), th = Math.abs(((a % (2 * k)) + 2 * k + k) % (2 * k) - k), ri = 0.4 * R;
  return r < R * ri * Math.sin(k) / (ri * Math.sin(k) * Math.cos(th) + (R - ri * Math.cos(k)) * Math.sin(th));
}
const stripes = (u, v, w = 1.6) => (frac((u + v) / (2 * w)) < 0.5 ? HAZ : HAZ_B);
// The badge on the chest and the shoulders, of radius R about (0, 0): the colour there, or -1 off it.
function badge(u, v, R) {
  const r = Math.hypot(u, v);
  if (F.badge === 'star') return star(u, v, R) ? WHITE : -1;
  if (F.badge === 'gear') {                                                                            // a cog: eight teeth round a ring
    if (r < 0.3 * R) return -1;
    return r < 0.72 * R || (r < R && frac(Math.atan2(u, v) * 4 / Math.PI + 0.25) < 0.5) ? WHITE : -1;
  }
  if (F.badge === 'dial') {                                                                            // a gauge: a pale face in a gold rim, a red needle
    if (r > R) return -1;
    if (r > 0.8 * R) return GOLD;
    if (r < 0.14 * R) return BLACK;
    if (v > 0 && Math.abs(u - 0.55 * v) < 0.11 * R && r < 0.7 * R) return RED;
    return v > 0.1 * R && r > 0.55 * R && frac(Math.atan2(u, v) * 3 / Math.PI + 0.5) < 0.3 ? BLACK : WHITE;
  }
  if (F.badge === 'core') return r > R ? -1 : r > 0.78 * R ? GUN : frac(r / (0.36 * R) + 0.25) < 0.5 ? VENT : VISOR_L;   // a reactor core: glowing rings in a dark rim
  if (F.badge === 'bolt') {                                                                            // a lightning bolt: two slanted strokes, stepped at the middle
    const k = v / R;
    if (k > -0.12 && k <= 1) return Math.abs(u - R * (0.22 - 0.5 * k)) < R * (0.1 + 0.2 * (1 - k)) ? WHITE : -1;
    if (k >= -1 && k < 0.12) return Math.abs(u - R * (-0.22 - 0.5 * k)) < R * (0.1 + 0.2 * (1 + k)) ? WHITE : -1;
  }
  return -1;
}

// ---- pelvis and waist ----
function hipsFill(x, y, z) {
  const ax = Math.abs(x); let d;
  if (drumX(ax, y, z, -1.5, 0.5, 3.7, 5.2, 6.7) <= 0) return metal(0, x, y, z, STEEL_D, 3);                     // hip collars
  if (F.plate && (d = bev(x, y, z, 0, -2.6, 6.6, 3.4, 3.4, 0.8, 1.2)) <= 0) return F.haz && E.c > -0.9 && y < -2.4 ? stripes(x, y) : paint(d, x, y, z, OLIVE_L, 4);   // front skirt
  if (bev(x, y, z, 0, 3.3, 0.2, 6.3, 0.8, 6.7, 0.6) <= 0) return frac(x / 2 + 0.25) < 0.2 && Math.abs(z) > 5.6 ? STEEL : OLIVE_DD;   // belt, riveted
  if ((d = bev(x, y, z, 0, 0, 0, 5.6, 4.2, 6, 1.4)) <= 0) return paint(d, x, y, z, OLIVE_D, 5);                 // pelvis
  if (F.tail && bev(x, y, z, 0, 0.5, -6.6, 3.4, 2.8, 1.2, 1) <= 0) return metal(0, x, y, z, GUN, 6);            // tail mount
  if (!F.tail && F.plate && (d = bev(x, y, z, 0, -1.6, -6.5, 4.2, 3.2, 0.8, 1.2)) <= 0) return d > -0.6 && Math.abs(y + 1.6) < 0.25 ? OLIVE_DD : paint(d, x, y, z, OLIVE_L, 6);   // rear skirt
  if (drumY(x, y, z, 0, 0.5, 5.4, 4, 5) <= 0) return metal(0, x, y, z, STEEL_D, 7);                             // turntable under the waist
  return -1;
}
// The waist: a ribbed boot round the spine with an armour plate in front and a pair of short rams behind.
const waistFill = (r, seed) => (x, y, z) => {
  let d;
  if (F.plate && (d = bev(x, y, z, 0, 2.5, r + 0.1, 3.6, 2.1, 0.8, 0.8)) <= 0) return paint(d, x, y, z, OLIVE, seed);
  if (drumY(Math.abs(x), y, z, 3.4, -r + 0.6, 0.9, 0.2, 4.8) <= 0) return CHROME;
  const ring = frac(y / 1.5 + 0.2) < 0.5;
  if (drumY(x, y, z, 0, 0, r + (ring ? 0.5 : 0), -0.6, 5.4) <= 0) return ring ? GUN : BLACK;
  return -1;
};

// ---- the hull, on the chest bone: y runs up the spine, z out through the chest plate ----
const HULL = [0, 6, 0.5, 12.5, 7, 8];
function chestFill(x, y, z) {
  const ax = Math.abs(x); let d;
  if (F.back === 'fins') {                                                                             // a row of back plates down the spine, a smaller row either side, their edges alight
    for (const [fx, y0, L, h] of [[0, 2.5, 5.2, 2.6], [0, 7.6, 6.6, 3.1], [0, 12.6, 5.4, 2.6], [5.2, 5.2, 3.4, 1.9], [5.2, 10.2, 3.6, 1.9]]) {
      const q = (-9.4 - z) / L, e = Math.abs(y - y0 - 0.55 * (-9.4 - z)) - h * (1 - q);
      if (Math.abs(ax - fx) < 0.8 && q > -0.35 && q < 1 && e < 0) return e > -0.75 || q > 0.8 ? VENT : metal(0, x, y, z, STEEL_D, 20);
    }
  } else if (F.stacks && F.back === 'key') {                                                                  // a wind-up key in the back: a shaft and a two-ringed bow
    if (drumZ(x, y, z, 0, 6, 1.1, -14.2, -10) <= 0) return metal(0, x, y, z, STEEL, 20);
    const r = Math.hypot(ax - 3.1 * F.stacks, y - 6);
    if (Math.abs(z + 14.6) < 0.8 && r < 3.3 * F.stacks && (r > 1.4 * F.stacks || ax < 0.9)) return r > 2.6 * F.stacks && grain(x, y, z, 20) > 0.6 ? tone(GOLD, 1.12) : GOLD;
  } else if (F.stacks && F.back === 'jets') {                                                          // a rocket pack: two round-nosed boosters, alight underneath
    const top = 4 + 8 * F.stacks, rr = Math.hypot(ax - 4.6, z + 10.4);
    if (y > 0.2 && y < top + 2.2 && rr < (y > top ? 2.3 * Math.sqrt(Math.max(0, 1 - ((y - top) / 2.2) ** 2)) : y < 1.6 ? 2.7 : 2.3)) return y < 1.2 ? (rr < 1.9 ? VENT : GUN) : y < 1.6 ? GUN : y > top ? HAZ : Math.abs(y - top + 1.6) < 0.4 ? HAZ : metal(0, x, y, z, WHITE, 20);
  } else if (F.stacks) {                                                                               // exhaust stacks up the back
    const top = 12.5 + 5.5 * F.stacks;
    if (drumY(ax, y, z, 5, -8.6, 1.5, 6, top) <= 0) return y > top - 1.2 ? BLACK : Math.hypot(ax - 5, z + 8.6) < 0.8 && y > top - 2.5 ? BLACK : frac(y / 3) < 0.17 ? STEEL_D : metal(0, x, y, z, STEEL, 20);
  }
  if (bev(x, y, z, 0, 4.5, -9, 7.6, 4.2, 1.6, 0.8) <= 0) {                                             // engine deck: a grille that glows
    if (E.c > -0.6 && ax < 6.4 && y > 1.6 && y < 7.4) return frac(y / 1.5) < 0.34 ? VENT : BLACK;
    return metal(0, x, y, z, GUN, 21);
  }
  if (drumX(ax, y, z, 7.5, 0.5, 4.3, 12, 14) <= 0) return metal(0, x, y, z, STEEL_D, 22);              // shoulder collars
  if (drumY(x, y, z, 0, 5.5, 4.9, 12.6, 13.6) <= 0) return metal(0, x, y, z, STEEL_D, 23);             // neck ring
  d = bev(x, y, z, ...HULL, 2);
  d = Math.max(d, (y - 10.6) + 0.9 * (z - 6.2));                                                       // the glacis: the top front corner sloped off
  d = Math.max(d, -(y - 1.2) - 0.8 * (z + 5.4), -(y + 0.2) + 0.7 * (z - 6.6) - 1.6);                   // and the belly cut in, front and back
  if (d > 0) return -1;
  if (d < -1.3) return OLIVE_DD;
  const front = z > 7.9 && y < 9.6;
  if (front && F.star && (d = badge(x, y - 4.6, 3.7)) >= 0) return d;                                  // the star (or the skin's own badge)
  if (front && ax > 7 && ax < 10.6 && y > 2.2 && y < 7.4) return frac(y / 1.3 + 0.1) < 0.4 ? VENT : BLACK;   // reactor vents either side of it
  if (d > -0.6 && (Math.abs(y - 9.6) < 0.25 || Math.abs(ax - 6.2) < 0.25 && y > 9.6)) return OLIVE_DD;  // panel lines
  if (d > -0.6 && ax > 12 && Math.abs(z - 0.5) < 6 && Math.abs(y - 1.4) < 0.25) return OLIVE_DD;
  if (F.haz && d > -0.6 && ax > 12 && y < 1.1 && y > -0.6 && Math.abs(z) < 6.5) return stripes(z, y, 1.3);   // a warning band low on each flank
  if (d > -0.6 && frac(ax / 3.1 + 0.4) < 0.16 && (Math.abs(y - 11.4) < 0.3 || Math.abs(y - 0.3) < 0.3) && z < 7) return STEEL;   // rivets
  const lit = y > 9.6 || (y - 10.6) + 0.9 * (z - 6.2) > -0.7;
  return paint(d, x, y, z, lit ? OLIVE_L : OLIVE, 24);
}
// ---- missile pods: a bone each on top of the hull, so they can tip up to fire. z runs out through the tubes. ----
const POD = { at: [10.4, 15.5, -3.6], rest: -0.5 };
export const TUBES = [[-2.7, 1.5], [0, 1.5], [2.7, 1.5], [-2.7, 4.1], [0, 4.1], [2.7, 4.1]], TUBE_Z = 9.4;
const podFill = (s) => (x, y, z) => {
  x *= s; let d;
  const small = F.pods < 0.8, w = small ? 3.1 : 4.5, tubes = small ? [[-1.4, 2.8], [1.4, 2.8]] : TUBES, h = small ? 1.9 : 2.7, cy = small ? 2.8 : 2.8;
  if (drumX(x, y, z, 0.3, 0, 1.5, -w + 0.6, w - 0.6) <= 0) return metal(0, x, y, z, STEEL_D, 30);       // trunnion
  if (bev(x, y, z, 0, -1.5, 0, 2.4, 1.8, 2.4, 0.6) <= 0) return metal(0, x, y, z, GUN, 31);               // pedestal
  if ((d = bev(x, y, z, 0, cy, 3.4, w, h, 6, 0.9)) > 0) return -1;
  if (z > 8.2) for (const [tx, ty] of tubes) {                                                          // tubes, a red nose in each
    const r = Math.hypot(x - tx, y - ty);
    if (r < 1.15) return r < 0.7 && z < 9.1 ? RED : z > 8.9 ? -1 : LENS;
  }
  if (d < -1.3) return OLIVE_DD;
  if (E.c > -0.6 && z > 8) return GUN;                                                                  // face plate
  if (d > -0.6 && z < -0.6 && z > -1.8) return WHITE;                                                   // a white band round the back
  if (d > -0.6 && Math.abs(z - 4.6) < 0.25) return OLIVE_DD;
  if (F.haz && d > -0.6 && z < -1.8) return stripes(x, y, 1.2);
  return paint(d, x, y, z, y > cy + h - 0.6 ? OLIVE_L : OLIVE, 32);
};

// ---- neck and head: the cockpit, in a general's peaked cap ----
function neck1Fill(x, y, z) { const ring = frac(y / 1.2) < 0.5; return drumY(x, y, z, 0, 0, 3.9 + (ring ? 0.4 : 0), -1.4, 2) <= 0 ? (ring ? GUN : BLACK) : -1; }
function neck2Fill(x, y, z) { return drumY(x, y, z, 0, 0, 3.3, -0.6, 2) <= 0 ? metal(0, x, y, z, GUN, 40) : -1; }
function headFill(x, y, z) {
  const ax = Math.abs(x); let d;
  if (F.cap && F.hat === 'hard') {
    // a hard hat: a domed shell with a rib over the top, a brim that is longest at the front, a beacon on the crown
    if (drumY(x, y, z, 0, 3.1, 1.5, 9, 11.2) <= 0) return y > 9.7 ? LAMP : GUN;
    if (y > 4.3 && y < 5.2 && (x / 6.9) ** 2 + ((z - 3.3) / (z > 3.3 ? 9.2 : 6.6)) ** 2 < 1) return tone(HAT, 0.8);
    if (y >= 5.2 && ax < 1 && sdE(x, y, z, 0, 5.2, 3.1, 6, 5, 6.6) <= 0) return tone(HAT, 1.08);
    if (y >= 5.2 && (d = sdE(x, y, z, 0, 5.2, 3.1, 5.7, 4.4, 6.2)) <= 0) return z > 8 && ax < 1.8 && y < 7.6 ? GOLD : tone(HAT, 0.94 + 0.1 * grain(x, y, z, 41));
    if (bev(x, y, z, 0, 4.9, 3.1, 5, 0.5, 5.5, 1.5) <= 0) return GUN;
  } else if (F.cap && F.hat === 'toy') {
    // a tin robot's lid: flat, a lamp in a collar on top, a sprung aerial with a bulb over each ear
    if (drumY(x, y, z, 0, 3.1, 2, 5.6, 6.5) <= 0) return GOLD;
    if (ball(x, y, z, 0, 7.4, 3.1, 1.7) <= 0) return LAMP;
    if (ball(ax, y, z, 6.4, 8.9, 0.6, 1.1) <= 0) return LAMP;
    if (Math.hypot(ax - 6.4, z - 0.6) < (frac(y / 1.2) < 0.5 ? 0.75 : 0.4) && y > 2 && y < 8.4) return STEEL;
    if ((d = bev(x, y, z, 0, 5.2, 3, 5.2, 0.6, 5.6, 1.2)) <= 0) return paint(d, x, y, z, HAT, 41);
  } else if (F.cap && F.hat === 'dino') {
    // a robot dinosaur's skull: a heavy brow, a horn swept back over each eye, a low crest plate between them
    const t = (y - 4.4) / 6.2;
    if (t > 0 && t < 1 && Math.hypot(ax - 3.2 - 0.9 * t, z - 2.6 + 4.2 * t) < 1.7 * (1 - t) + 0.25) return t > 0.72 ? VENT : t < 0.14 ? GUN : metal(0, x, y, z, CHROME, 41);
    const cz = (z - 1.4) / 6.4;
    if (ax < 0.8 && Math.abs(cz) < 1 && y > 4.4 && y < 5.2 + 2.6 * (1 - cz * cz) * (0.7 - 0.3 * cz)) return metal(0, x, y, z, STEEL_D, 41);
    if ((d = bev(x, y, z, 0, 5, 3.6, 5.3, 0.75, 5.7, 1.2)) <= 0) return paint(d, x, y, z, OLIVE_D, 41);
  } else if (F.cap && F.hat === 'fin') {
    // a space helmet: a smooth dome, and a crest fin swept back over it
    const fz = (z - 1.2) / 7.2;
    if (ax < 0.8 && Math.abs(fz) < 1 && y > 4 && y < 5 + 5.2 * Math.sqrt(1 - fz * fz) * (0.62 - 0.38 * fz)) return y > 4.4 + 5.2 * Math.sqrt(1 - fz * fz) * (0.62 - 0.38 * fz) ? tone(HAZ, 1.15) : HAZ;
    if (y >= 4.4 && (d = sdE(x, y, z, 0, 4.4, 3.1, 5.3, 3.4, 5.9)) <= 0) return y < 5.1 ? HAZ : tone(HAT, 0.95 + 0.07 * grain(x, y, z, 41));
  } else if (F.cap) {
    // the brim: black, curved, dipping forward over the visor
    const bz = (z - 8.4) / 4.2, by = 4.75 - 0.24 * (z - 8.4);
    if (z > 7.6 && bz < 1 && ax < 5.3 * Math.sqrt(1 - Math.max(0, bz) ** 2) && Math.abs(y - by) < 0.45) return z > 12 || ax > 5 * Math.sqrt(1 - Math.max(0, bz) ** 2) ? GUN : BLACK;
    // the crown: flaring out and rising to the front, a gold star on its face and a gold cord above the brim
    const up = y - 5.7;
    if (up > 0) {
      const g = Math.min(up, 2.2) * 0.42, top = 8.3 + 0.26 * (z - 3);
      if (y < top && (d = bev(x, 0, z, 0, 0, 3.1, 5.5 + g, 9, 5.9 + g, 1.6)) <= 0) {
        if (z > 8.3 + g && star(x, y - 7.7, 2.1)) return GOLD;
        if (y > top - 0.55) return (ax > 4.6 + g || Math.abs(z - 3.1) > 5 + g) ? OLIVE_DD : tone(OLIVE_L, 1.05);
        return paint(Math.max(d, y - top), x, y, z, OLIVE, 41);
      }
    }
    if (bev(x, y, z, 0, 5.2, 3.1, 5.4, 0.55, 5.8, 1.5) <= 0) return z > 7.6 && ax < 4.4 ? GOLD : OLIVE_DD;   // the band, with its cord
  } else if ((d = bev(x, y, z, 0, 5.1, 2.6, 4.6, 0.7, 4.8, 1.2)) <= 0) return paint(d, x, y, z, OLIVE_D, 41);   // a prototype's flat lid
  if (drumX(ax, y, z, 1.4, 0.6, 1.7, 4.6, 5.7) <= 0) return Math.hypot(y - 1.4, z - 0.6) < 0.8 ? BLACK : metal(0, x, y, z, STEEL_D, 42);   // ear housings
  if (F.hat !== 'toy' && F.hat !== 'dino' && x > 4.9 && x < 5.5 && Math.abs(z - 0.6) < 0.3 && y > 2 && y < 12.5) return y > 11.6 ? LAMP : BLACK;                 // aerial, lamp at its tip
  if (F.hat === 'dino') {                                                                              // the snout: an armoured muzzle, nostrils, a row of teeth along each side of its lip
    const sw = 3.7 - 0.13 * Math.max(0, z - 8);
    if ((d = bev(x, y, z, 0, 0.7, 10.6, sw, 1.9, 3.3, 0.9)) <= 0) return z > 13.2 && ax > 0.7 && ax < 1.7 && y > 1.1 && y < 1.9 ? BLACK : d > -0.6 && Math.abs(z - 9.2) < 0.25 ? OLIVE_DD : paint(d, x, y, z, y > 1.6 ? OLIVE_L : OLIVE, 45);
    if (y > -2.3 && y <= -1.1 && z > 7.6 && z < 13.9 && ((ax > sw - 1.1 && ax < sw - 0.2 && frac(z / 1.5) < 0.6) || (z > 13 && ax < sw - 0.2 && frac(x / 1.5 + 0.5) < 0.6))) return WHITE;
  }
  if (bev(x, y, z, 0, -0.5, 5.4, 3.3, 0.8, 2.6, 0.4) <= 0) return frac(x / 1.2) < 0.5 ? VENT : BLACK;   // the speaker grille behind the chin plate
  if ((d = bev(x, y, z, 0, 1.7, 3.2, 4.8, 3, 5.3, 1.2)) > 0) return -1;
  if (d < -1.3) return BLACK;
  if (F.eyes === 'angry') {                                                                            // two slanted eyes under the brow, running round onto the cheeks
    if (y > 2.7 && ((z > 7.9 && ax > 1.4 && ax < 4.6 && y < 4.15 - 0.42 * (4.6 - ax)) || (ax > 4.2 && z > 5.6 && y < 4.15))) return z > 7.9 && ax > 2.6 && ax < 3.6 ? VISOR_L : VISOR;
  } else if (F.eyes === 'round') {                                                                            // two round lamp eyes
    const r = Math.hypot(ax - 2.4, y - 2.5);
    if (z > 7.9 && r < 1.9) return r < 0.8 ? VISOR_L : r < 1.5 ? VISOR : BLACK;
  } else if (y > 1.9 && y < 3.5 && (z > 7.9 || (ax > 4.2 && z > 3))) {                                  // the visor: one slit across the face and round the sides
    const e = F.lens * 1.1;
    return z > 7.9 && Math.abs(ax - 2.3) < e && Math.abs(y - 2.7) < 0.6 * Math.max(1, F.lens) ? VISOR_L : VISOR;
  }
  if (z > 7.9 && y < 1.4 && ax < 3.6) return frac(x / 1.4 + 0.5) < 0.25 ? OLIVE_DD : OLIVE_D;           // nose plate
  if (d > -0.6 && ax > 4.2 && Math.abs(z - 2.6) < 0.25) return OLIVE_DD;
  return paint(d, x, y, z, OLIVE, 43);
}
// The chin plate hinges under the cab: heavy, jutting, a row of steel teeth along its lip.
function jawFill(x, y, z) {
  let d;
  if (F.hat === 'dino') {                                                                              // the lower jaw runs out under the snout, its teeth inside the upper row
    const ax = Math.abs(x);
    if (y > -1.7 && y < -0.7 && z > 5.6 && z < 11.3 && ((ax > 1.5 && ax < 2.3 && frac(z / 1.5 + 0.5) < 0.6) || (z > 10.5 && ax < 1.5 && frac(x / 1.5) < 0.6))) return WHITE;
    if ((d = bev(x, y, z, 0, -2.5, 8.2, 3.1, 0.9, 3.6, 0.8)) <= 0) return y > -1.9 && ax < 2.2 && z < 11 ? BLACK : paint(d, x, y, z, OLIVE_D, 44);
  }
  if (y > -0.5 && y < 0.7 && z > 6.5 && z < 7.4 && Math.abs(x) < 4 && frac(x / 1.6 + 0.5) < 0.62) return STEEL;
  if ((d = bev(x, y, z, 0, -1.7, 3.3, 4.5, 1.25, 4.4, 0.9)) > 0) return -1;
  if (y > -0.9 && Math.abs(x) < 3.6 && z < 6.4) return BLACK;
  return paint(d, x, y, z, OLIVE_D, 44);
}

// ---- arms: `s` is 1 for the left ----
const armFill = (s) => (x, y, z) => {
  x *= s; let d;
  if ((d = bev(x, y, z, 2.6, 4.7, 0, 4.5, 0.8, 5.5, 0.7)) <= 0) return F.haz && Math.abs(z) > 3.4 && d > -0.6 ? HAZ : paint(d, x, y, z, OLIVE_L, 50);   // epaulette, yellow bars at each end
  if ((d = bev(x, y, z, 2.2, 0.4, 0, 3.8, 4.2, 4.8, 1.5)) <= 0) {                                       // shoulder
    if (F.star && x > 5.4 && (d = badge(z, y - 0.4, 2.7)) >= 0) return d;
    return paint(d, x, y, z, OLIVE, 51);
  }
  if (drumX(x, y, z, 0, 0, 3.4, -2.6, -1.4) <= 0) return metal(0, x, y, z, GUN, 52);
  if ((d = bev(x, y, z, 2.3, -6.6, 0.7, 1.1, 3.6, 3.2, 0.8)) <= 0) return paint(d, x, y, z, OLIVE, 53);  // outer plate
  if (drumY(x, y, z, 0.3, -2.4, 0.8, -10.5, -3) <= 0) return CHROME;                                    // ram down the back
  if (bev(x, y, z, 0.3, -6.8, 0.7, 2.5, 4.4, 2.7, 0.8) <= 0) return metal(0, x, y, z, GUN, 54);
  return -1;
};
const forearmFill = (s) => (x, y, z) => {
  x *= s; let d;
  if (drumX(x, y, z, 0, 0, 3.3, -3.3, 3.3) <= 0) return Math.abs(x) > 2.7 ? (Math.hypot(y, z) < 1.2 ? STEEL : OLIVE_D) : metal(0, x, y, z, GUN, 55);   // elbow drum
  if (drumZ(Math.abs(x), y, z, 2.1, 2.7, 1.1, 0.6, 9.4) <= 0) return z > 7.6 ? CHROME : metal(0, x, y, z, STEEL_D, 56);   // the piston barrels, either side of the top ridge
  if ((d = bev(x, y, z, 0, 3.1, 5.6, 0.9, 0.9, 4.2, 0.5)) <= 0) return paint(d, x, y, z, OLIVE_L, 58);                  // the ridge along the top, in line with the thumb
  if ((d = bev(x, y, z, 0, -1.3, 6.1, 3.6, 4, 4.6, 1.3)) > 0) return -1;
  if (d < -1.3) return OLIVE_DD;
  if (d > -0.6 && x > 3 && y > -3.4 && y < -0.2 && z > 3.2 && z < 8.4) return frac(z / 1.4) < 0.45 ? VENT : BLACK;   // heat slots down the outside
  if (d > -0.6 && (Math.abs(z - 9.2) < 0.25 || Math.abs(z - 2.9) < 0.25)) return OLIVE_DD;
  if (F.haz && d > -0.6 && z > 9.4) return stripes(x, y, 1.3);
  return paint(d, x, y, z, y > 1.4 ? OLIVE_L : OLIVE, 57);
};
// The hand is only a cuff; the fist is the head of a piston (the `ram` bone) and slides out of it.
function handFill(x, y, z) {
  if (drumZ(x, y, z, 0, 0, 3.5, -0.9, 3.1) > 0) return -1;
  return z > 2.3 || z < -0.2 ? STEEL_D : frac(Math.atan2(y, x) * 8 / Math.PI) < 0.5 ? GUN : BLACK;
}
export const RAM_AT = [0, 0, 3.1];
// It is held thumb up, as a hand hangs naturally: the thumb on top, the knuckles and the back of the hand to the outside, the
// fingers curled in toward the body. (Sculpted palm down, then turned a quarter turn about the wrist.)
const ramFill = (s) => (px, py, z) => {
  const x = -py, y = s * px; let d;
  if (z < 0.4) return drumZ(x, y, z, 0, 0, 1.7, -6.6, 0.4) <= 0 ? (frac(z / 2.2) < 0.12 ? STEEL_D : CHROME) : -1;    // the rod
  if ((d = bev(x, y, z, -4.7, -0.7, 5.3, 1.25, 2, 3.1, 0.7)) <= 0) return z > 7.6 ? STEEL_D : d > -0.6 && Math.abs(z - 4.4) < 0.25 ? GUN : metal(0, x, y, z, STEEL, 60);   // thumb, laid along the top
  if (z > 5.2) {                                                                                                    // four fingers, curled, one above the next
    const f = (x + 4.2) / 2.1, fi = Math.floor(f), fx = -4.2 + 2.1 * (fi + 0.5);
    if (fi >= 0 && fi < 4 && (d = bev(x, y, z, fx, 0.2, 7, 0.9, 3.8, 1.7, 0.6)) <= 0) return y > 2.6 ? metal(0, x, y, z, STEEL, 61) : d > -0.6 && Math.abs(y + 0.9) < 0.25 ? BLACK : metal(0, x, y, z, STEEL_D, 61);
  }
  if ((d = bev(x, y, z, 0, 0, 3.4, 4.2, 4, 3.1, 1.3)) > 0) return -1;
  if (d < -1.3) return BLACK;
  if (F.haz && d > -0.6 && z < 2.5) return stripes(x + y, z, 1.2);                                                 // a striped collar
  if (d > -0.6 && z > 2.5 && z < 3) return BLACK;
  return metal(d, x, y, z, GUN, 62);
};

// ---- legs ----
const thighFill = (s) => (x, y, z) => {
  x *= s; let d; const zs = z + y * (4 / 11.5);
  if (drumX(x, y, z, 0, 0, 4.5, -1.3, 3.4) <= 0) return x > 2.8 ? (Math.hypot(y, z) < 1.6 ? STEEL : Math.hypot(y, z) > 3.6 ? OLIVE_D : OLIVE) : metal(0, x, y, z, GUN, 70);   // hip drum
  if (F.plate && (d = bev(x, y, zs, 0.7, -6.2, 3.7, 2.7, 4.2, 0.9, 0.9)) <= 0) return paint(d, x, y, z, OLIVE_L, 71);   // thigh plate
  if ((d = bev(x, y, zs, 0.7, -6.4, 0, 3.4, 5.4, 3.6, 1.2)) <= 0) return d > -0.6 && Math.abs(y + 3) < 0.25 ? OLIVE_DD : paint(d, x, y, z, OLIVE, 72);
  return -1;
};
const shinFill = (s) => (x, y, z) => {
  x *= s; let d; const zs = z - 0.4 * y, w = 0.14 * Math.max(0, -y - 3);
  if (drumX(x, y, z, 0, 0, 3.5, -3.4, 3.4) <= 0) return Math.abs(x) > 2.8 ? (Math.hypot(y, z) < 1.2 ? STEEL : OLIVE_D) : metal(0, x, y, z, GUN, 73);   // knee drum
  if ((d = bev(x, y, z, 0, 0.4, 3.9, 2.7, 2.5, 0.9, 1.1)) <= 0) return paint(d, x, y, z, OLIVE_L, 74);                 // knee guard
  if (drumY(x, y, zs, 0, -3.7, 0.9, -8.6, -1.6) <= 0) return CHROME;                                                   // ram up the calf
  if (bev(x, y, zs, 0, -9, 0.2, 4 + w, 0.7, 3.9, 0.6) <= 0) return F.haz ? stripes(x + zs, y, 1.1) : OLIVE_DD;         // a striped cuff over the ankle
  if ((d = bev(x, y, zs, 0, -5.4, 0.3, 2.9 + w, 4.4, 3.1, 1)) <= 0) return d > -0.6 && Math.abs(y + 4.2) < 0.25 ? OLIVE_DD : paint(d, x, y, z, OLIVE, 75);
  return -1;
};
const footFill = (s) => (x, y, z) => {
  x *= s; let d; if (y < -3) return -1;
  if (ball(x, y, z, 0, 0, 0, 2.7) <= 0) return metal(0, x, y, z, GUN, 76);
  if (bev(x, y, z, 0, -1.9, -4.5, 2.3, 1.1, 1.6, 0.7) <= 0) return y < -2.5 ? BLACK : metal(0, x, y, z, STEEL_D, 77);   // heel
  d = Math.max(bev(x, y, z, 0, -1.5, 2.7, 4.7, 1.5, 6.3, 0.9), (y + 0.6) + 0.3 * (z - 4.5));                            // the foot, sloping down to the toes
  if (d > 0) return -1;
  if (z > 5.6 && Math.abs(x) < 0.5) return -1;                                                                         // two toes
  if (y < -2.5) return BLACK;
  if (z > 6.4) return d > -0.6 && F.haz && z < 7.4 ? HAZ : metal(d, x, y, z, STEEL_D, 78);                              // toe caps
  return paint(d, x, y, z, OLIVE_D, 79);
};

// ---- tail: seven armoured links, and a counterweight ----
const tailFill = (i) => (x, y, z) => {
  const w = 5.1 - 0.37 * i, h = 3.9 - 0.27 * i, ys = y - z * (1.6 / 4.6); let d;
  if (i === 7 && F.weight) {
    if ((d = bev(x, ys, z, 0, -0.2, -8.2, 4.4, 3.4, 3.1, 1.3)) <= 0) {
      if (d < -1.3) return BLACK;
      if (d > -0.6 && F.haz && Math.abs(x) > 3.6) return stripes(z, ys, 1.4);
      if (d > -0.6 && frac(x / 2.2 + 0.5) < 0.22 && frac(z / 2.2) < 0.22) return STEEL;
      return metal(d, x, y, z, GUN, 80);
    }
    if (drumZ(x, ys, z, 0, -0.2, 1.3, -5.4, -3) <= 0) return STEEL_D;
  }
  if (ball(x, y, z, 0, 0, 0, h * 0.95) <= 0) return metal(0, x, y, z, GUN, 81);
  if (bev(x, ys, z, 0, h - 0.1, -2.3, w * 0.45, 0.6, 1.5, 0.4) <= 0) return OLIVE_DD;                                    // ridge plate
  if ((d = bev(x, ys, z, 0, 0, -2.4, w, h, 1.75, 1.1)) <= 0) return i === 5 && d > -0.6 && Math.abs(z + 2.4) < 0.8 ? WHITE : paint(d, x, y, z, i & 1 ? OLIVE : OLIVE_D, 82 + i);
  return -1;
};

// ---- a missile: its own free bone, hidden until the salvo. Nose along +z, a flame out of the back. ----
function missileFill(x, y, z) {
  x /= 1.6; y /= 1.6; z /= 1.6;
  const r = Math.hypot(x, y);
  if (z < -2.6) return r < 1.15 * (1 - (-2.6 - z) / 4.6) ? (z < -4.4 ? VISOR_L : VENT) : -1;            // flame
  if (z < -1.2 && (Math.abs(x) < 0.3 || Math.abs(y) < 0.3) && r < 1.9) return GUN;                      // fins
  if (z > 2.4) return r < 0.95 * (1 - (z - 2.4) / 1.9) ? RED : -1;
  return r < 0.95 ? (Math.abs(z - 1.4) < 0.4 ? BLACK : WHITE) : -1;
}

// ---- growth stages ----
// A young Marshal is an earlier prototype off the same line. `k` is the size of the legs against the adult's (and of every distance
// in a pose), `wide` how wide and deep the pelvis and legs are, `waist` the height of the waist, `hull` the hull as [height, width,
// depth], `arm` the arms as [length, thickness], then the size of the fists, the head, the pods and the tail, and `feat` the fittings.
export const STAGES = {
  // Mk II: the frame nearly grown, the hull not yet broad; a plain helmet with no cap, a small pod of two on each shoulder.
  teen: { k: 0.8, wide: 0.78, waist: 0.8, hull: [0.78, 0.74, 0.8], arm: [0.78, 0.74], fist: 0.76, head: 0.86, pod: 0.8, tail: 0.76,
    feat: { ...ADULT, cap: 0, pods: 0.5, stacks: 0.5, weight: 0, lens: 1.25 } },
  // Mk I: a stubby test rig. Short legs, a small round-shouldered hull, a big-eyed sensor head, no pods, cap, star or stacks.
  baby: { k: 0.48, wide: 0.62, waist: 0.55, hull: [0.52, 0.5, 0.58], arm: [0.5, 0.52], fist: 0.52, head: 0.66, pod: 0.6, tail: 0.5,
    feat: { ...ADULT, cap: 0, pods: 0, star: 0, stacks: 0, weight: 0, plate: 0, lens: 1.7 } },
};
// Every stage, the adult too, is the sculpt below seen through stageSpec: the adult is the drawing at SIZE, so that he stands level
// with the other rivals (the drawing alone is 15.8 m to the tip of the aerial; they are about 17 m).
const SIZE = 1.08, FULL = { k: 1, wide: 1, waist: 1, hull: [1, 1, 1], arm: [1, 1], fist: 1, head: 1, pod: 1, tail: 1 };
const sized = (S) => Object.fromEntries(Object.entries(S).filter(([n]) => n !== 'feat').map(([n, v]) => [n, Array.isArray(v) ? v.map((q) => q * SIZE) : v * SIZE]));
function stageOf(name) {
  const S = sized(STAGES[name] || FULL), k = S.k, w = S.wide, HY = MARSHAL_RIG.pivot.hips[1];
  const body = stretch({ knots: [[0, 0, w, w], [HY, HY * k, w, w], [HY + 100, HY * k + 100 * S.waist, w, w]] });
  const bone = { hips: 'body' }, leg = [w, k, w], hull = [S.hull[1], S.hull[0], S.hull[2]], arm = [S.arm[1], S.arm[0], S.arm[1]], fore = [S.arm[1], S.arm[1], S.arm[0]], tl = [w, w, S.tail];
  const part = { hips: [w, (w + k) / 2, w], spine1: [w, S.waist, w], spine2: [w, S.waist, w], chest: hull, neck1: S.head, neck2: S.head, head: S.head, jaw: S.head,
    podL: S.pod, podR: S.pod, footL: leg, footR: leg, thighL: leg, thighR: leg, shinL: leg, shinR: leg };
  for (const s of ['L', 'R']) { part['arm' + s] = arm; part['forearm' + s] = fore; part['hand' + s] = S.fist; part['ram' + s] = S.fist; }
  for (let i = 1; i <= 7; i++) part['tail' + i] = tl;
  for (let i = 1; i <= MISSILES; i++) part['mis' + i] = S.pod;
  return { name, k, kx: 1.12 * w, unit: k, pod: S.pod, maps: { body }, bone, part };
}
export const MISSILES = 6;
// ---- skins: the same machine, rig and moves in another trade's paint and fittings ----
// `paint` replaces army colours, `limbs` repaints the parts whose bone name it matches, `feat` picks the hat, badge, eyes and back.
// A skin keeps its hat at every growth stage (the army's prototypes have no cap).
const LIMB = /^(arm|forearm|thigh|shin|foot)/;
export const SKINS = {
  // A building-site machine: safety yellow, an orange-and-white barrier stripe, a white hard hat with an amber beacon, a cog badge,
  // diesel stacks. Its rockets are painted like traffic cones.
  builder: { name: 'Jackhammer', feat: { hat: 'hard', badge: 'gear' },
    paint: { body: 0xe3a41a, light: 0xf5c63c, dark: 0xb57d16, deep: 0x5e4110, haz: 0xf26a1b, hazB: 0xf2efe6, white: 0x23262b, gold: 0xf26a1b, red: 0xf26a1b, hat: 0xf2efe6,
      visor: 0xffb020, visorL: 0xfff6cf, vent: 0xffa02e, lamp: 0xffb020, glow: 0xffa030 },
    blurb: 'A runaway building-site machine in safety yellow and a hard hat. Drives its fists out on pistons and fires a salvo of cone-striped rockets from its shoulders.' },
  // A giant tin toy: red body, blue arms and legs, yellow trim, round lamp eyes, a bulb on its lid, a gauge on its chest and a
  // wind-up key in its back.
  toy: { name: 'Sprocket', feat: { hat: 'toy', badge: 'dial', eyes: 'round', back: 'key', lens: 1 },
    paint: { body: 0xd4332b, light: 0xee574a, dark: 0xa5241f, deep: 0x5a1512, steel: 0xc9d2da, steelD: 0x7d8791, gun: 0x4a5058, haz: 0xffd23a, hazB: 0x2253a8, white: 0xfff5d6, gold: 0xffc93c, hat: 0xd4332b,
      visor: 0xffd83a, visorL: 0xfffbe0, vent: 0xffc23a, lamp: 0x4dff7a, glow: 0xffd040 },
    limbs: { body: 0x2f6fd6, light: 0x4f8eea, dark: 0x2253a8, deep: 0x142f63 },
    blurb: 'A giant wind-up tin robot: red, blue and yellow, lamp eyes, a key in its back. Drives its fists out on pistons and fires a salvo of toy rockets from its shoulders.' },
  // A robot dinosaur, the machine built to beat the monsters at their own game: silver plate over dark joints, a snouted skull with
  // teeth and swept-back horns, slanted green eyes, a reactor core in the chest, a row of back plates, and the tail put back on.
  mecha: { name: 'Steeljaw', feat: { hat: 'dino', badge: 'core', eyes: 'angry', back: 'fins', tail: 1, weight: 0, haz: 1 },
    paint: { body: 0xaab4bf, light: 0xd0d8e0, dark: 0x7e8996, deep: 0x39414b, gun: 0x2e333a, haz: 0x35c98a, hazB: 0x1a1c1f, gold: 0x35c98a, red: 0x35c98a, hat: 0xaab4bf,
      visor: 0x3dff86, visorL: 0xe6ffe9, vent: 0x35e88a, lamp: 0x3dff86, glow: 0x40ff90 },
    limbs: { body: 0x5f6f82, light: 0x7d8ea3, dark: 0x4a5868, deep: 0x252d37, only: /^(forearm|shin)/ },
    blurb: 'A silver robot dinosaur with a toothed snout, swept-back horns, glowing back plates and a tail. Drives its fists out on pistons and fires a salvo of rockets from its shoulders.' },
  // A space ranger: white with orange gloves and boots, a crested dome helmet, a teal visor, a lightning bolt, a rocket pack.
  astro: { name: 'Astro', feat: { hat: 'fin', badge: 'bolt', back: 'jets' },
    paint: { body: 0xdfe5ec, light: 0xf6f9fc, dark: 0xb3bec9, deep: 0x596573, gun: 0x2c3440, haz: 0xf47a26, hazB: 0xdfe5ec, white: 0xf47a26, gold: 0xf47a26, red: 0xf47a26, hat: 0xf6f9fc,
      visor: 0x1fd8cc, visorL: 0xd6fffb, vent: 0x2ec8ff, lamp: 0x1fd8cc, glow: 0x2ed8e8 },
    limbs: { body: 0xf47a26, light: 0xff9a4a, dark: 0xc45c18, deep: 0x6b300c, only: /^(forearm|shin|foot)/ },
    blurb: 'A space ranger robot in white and orange with a crested helmet and a rocket pack. Drives its fists out on pistons and fires a salvo of rockets from its shoulders.' },
};
SKINS.mechaTail = { ...SKINS.mecha, name: 'Steeljaw with a tail' }; SKINS.mecha = { ...SKINS.mecha, feat: { ...SKINS.mecha.feat, tail: 0 }, blurb: SKINS.mecha.blurb.replace(', glowing back plates and a tail.', ' and glowing back plates.') };   // with and without the tail (Will had the Marshal's taken off)
export function buildMarshal(stage, skin) {
  const sk = typeof skin === 'string' ? SKINS[skin] : skin, base = (STAGES[stage] && STAGES[stage].feat) || ADULT;
  F = sk ? { ...base, ...sk.feat, cap: 1 } : base;
  const main = sk ? { ...ARMY, ...sk.paint } : ARMY;
  try { use(main); return build(stage, sk, main); } finally { F = ADULT; use(ARMY); }
}
function build(stage, sk, main) {
  const local = {
    hips: { box: [-8, -7, -9, 8, 6, 9], fill: hipsFill }, spine1: { box: [-8, -1, -8, 8, 6, 8], fill: waistFill(4.9, 10) }, spine2: { box: [-8, -1, -8, 8, 6, 8], fill: waistFill(5.3, 11) },
    chest: { box: [-16, -3, -13, 16, 21, 11], fill: chestFill },
    neck1: { box: [-5, -2, -5, 5, 3, 5], fill: neck1Fill }, neck2: { box: [-4, -1, -4, 4, 3, 4], fill: neck2Fill },
    head: { box: [-8, -2, -5, 8, 13, 14], fill: headFill }, jaw: { box: [-5, -4, -2, 5, 1, 9], fill: jawFill },
    armL: { box: [-3, -12, -6, 8, 6, 6], fill: armFill(1) }, armR: { box: [-8, -12, -6, 3, 6, 6], fill: armFill(-1) },
    forearmL: { box: [-5, -5, -4, 5, 5, 12], fill: forearmFill(1) }, forearmR: { box: [-5, -5, -4, 5, 5, 12], fill: forearmFill(-1) },
    handL: { box: [-4, -4, -2, 4, 4, 4], fill: handFill }, handR: { box: [-4, -4, -2, 4, 4, 4], fill: handFill },
    thighL: { box: [-4, -13, -6, 6, 5, 10], fill: thighFill(1) }, thighR: { box: [-6, -13, -6, 4, 5, 10], fill: thighFill(-1) },
    shinL: { box: [-6, -11, -9, 6, 4, 6], fill: shinFill(1) }, shinR: { box: [-6, -11, -9, 6, 4, 6], fill: shinFill(-1) },
    footL: { box: [-6, -3, -7, 6, 3, 10], fill: footFill(1) }, footR: { box: [-6, -3, -7, 6, 3, 10], fill: footFill(-1) },
  };
  if (F.tail) for (let i = 1; i <= 7; i++) local['tail' + i] = { box: i === 7 ? [-6, -10, -13, 6, 5, 4] : [-6, -6, -6, 6, 6, 5], fill: tailFill(i) };
  const extra = [
    { name: 'ramL', parent: 'handL', slide: true, pivot: RAM_AT, box: [-5, -5, -7, 5, 6, 9], fill: ramFill(1), seed: 63 },
    { name: 'ramR', parent: 'handR', slide: true, pivot: RAM_AT, box: [-5, -5, -7, 5, 6, 9], fill: ramFill(-1), seed: 64 },
  ];
  if (F.pods) extra.push(
    { name: 'podL', parent: 'chest', pivot: POD.at, rest: [POD.rest, 0, 0], box: [-5, -4, -3, 5, 6, 10], fill: podFill(1), seed: 33 },
    { name: 'podR', parent: 'chest', pivot: [-POD.at[0], POD.at[1], POD.at[2]], rest: [POD.rest, 0, 0], box: [-5, -4, -3, 5, 6, 10], fill: podFill(-1), seed: 34 });
  if (F.pods) for (let i = 1; i <= MISSILES; i++) extra.push({ name: 'mis' + i, parent: null, free: true, pivot: [0, -20, 0], box: [-4, -4, -12, 4, 4, 8], fill: missileFill, seed: 90 + i });
  if (sk && sk.limbs) {                                                                                // the limbs in their own colours
    const limb = { ...main, ...sk.limbs }, re = sk.limbs.only || LIMB;
    for (const n in local) if (re.test(n)) { const f = local[n].fill; local[n].fill = (x, y, z) => { use(limb); const c = f(x, y, z); use(main); return c; }; }
  }
  if (F.back === 'key' || F.back === 'fins') local.chest.box = [-16, -3, -17, 16, 23, 11];
  if (F.hat === 'dino') { local.head.box = [-8, -3, -5, 8, 13, 15]; local.jaw.box = [-5, -4, -2, 5, 1, 13]; }
  const spec = {
    name: 'marshal', box: {}, local, extra, tubes: (F.pods < 0.8 ? [[-1.4, 2.8], [1.4, 2.8]] : TUBES).map(([x, y]) => [x, y, TUBE_Z]), glow: main.glow, glowBase: 0.55, rough: 0.55, kx: 1.12, frame: 1.25, ...MARSHAL_RIG,
    blurb: 'The army’s walker mech. Drives its fists out on pistons, stomps, charges, and tips up its shoulder pods to fire a missile salvo.',
  };
  if (sk) spec.blurb = sk.blurb;
  const st = stageOf(stage); spec.tubes = spec.tubes.map((t) => t.map((v) => v * st.pod));
  return buildBiped(stageSpec(spec, st));
}
