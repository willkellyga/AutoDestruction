// Tank, jeep and helicopter, built in code at eighth-metre cubes (the same cube as the soldiers and the kaiju).
// Proportions follow the single-colour silhouettes in padadu's "Voxel pack 15: modern warfare" (CC0); the pack models
// themselves are 32 cubes long, one colour and one piece, so the moving parts, paint and detail here are our own.
// Coordinates are cubes relative to each part's pivot. Left is +x, forward is +z, the ground is y = 0.
import { GLOW, hash, tone } from './voxpart.js';
import { PACK } from './pack.js';

const H = 0.5;
const S = Math.sin, C = Math.cos, PI = Math.PI, hyp = Math.hypot, fl = Math.floor;
// ---- paint ----
const GREEN = [0x5c6b3a, 0x46532c, 0x76804a], SAND = [0xb09a62, 0x8c7848, 0xc8b47c], GREY = [0x58634f, 0x424c40, 0x6e7862];
const DARK = 0x2c3226, STEEL = 0x4a4f57, METAL = 0x2b2e33, BLACK = 0x101214, RUBBER = [0x1d1e21, 0x2a2b2f], TREAD = [0x26272b, 0x3a3b40];
const STOW = [0x6b5a3a, 0x5a4a2e], CANVAS = 0x7b7350, GLASS = 0x2a4c5c, GLASS2 = 0x3d6e80, SEAT = 0x4a3526, STRIPE = 0xdcd6bd, WARN = 0xe0b020, BELLY = 0x8a9084;
const LAMP = 0xfff0b0 | GLOW, RED = 0xff4030 | GLOW, GREENLAMP = 0x40ff70 | GLOW, FIRE1 = 0xffe27a | GLOW, FIRE2 = 0xff9a2e | GLOW;
const INNER = [0x1c1d20, 0x26272a, 0x151618];
// blobby three-tone camouflage
const camo = (pal, seed) => (x, y, z) => {
  const n = S(x * 0.31 + seed) * C(z * 0.23 + y * 0.37 + seed * 2.1) + 0.6 * S(z * 0.47 - x * 0.19 + y * 0.29 + seed * 0.7);
  return tone(pal[n > 0.45 ? 2 : n < -0.4 ? 1 : 0], 0.96 + 0.08 * hash(fl(x), fl(y), fl(z), 3));
};
const flashPart = (parent, pivot, len = 6, r = 2.6) => ({ name: 'flash', parent, pivot, box: [-3, -3, 0, 3, 3, len + 1], paint: (g) => g.fill((x, y, z) => { const d = hyp(x, y); return d < r - z * r / len ? (d < 1.2 && z < len * 0.6 ? FIRE1 : FIRE2) : -1; }) });
const OFF = [0, 0, 0, 0, 0, 0, 0];

// ================= TANK =================
const TW = [-21, -10.5, 0, 10.5, 21]; // road wheel positions along the hull
function trackProfile(y, z) { // > 0 inside the track's side outline
  return Math.min(z + 29, 29 - z, y, 9 - y, ((29 - z) + y - 6) * 0.707, ((z + 29) + y - 5) * 0.707, ((29 - z) + (9 - y) - 2.5) * 0.707, ((z + 29) + (9 - y) - 2.5) * 0.707);
}
function tankParts(o) {
  const pal = o.type === 'desert' ? SAND : GREEN, paint = camo(pal, 1 + (o.seed || 0)), dk = tone(pal[1], 0.7);
  const wheel = (s, i) => ({ name: 'w' + (s > 0 ? 'L' : 'R') + i, parent: 'hull', pivot: [11.5 * s, 4.4, TW[i]], box: [-2, -4, -4, 2, 4, 4], paint: (g) => g.fill((x, y, z) => {
    const r = hyp(y, z); if (r > 3.3) return -1;
    if (r > 2.4) return RUBBER[0];
    if (x * s < 0.9) return METAL;
    return r < 1.1 ? STEEL : (Math.abs(y) < 0.6 || Math.abs(z) < 0.6) ? tone(pal[1], 0.8) : pal[0];
  }) });
  return [
    { name: 'hull', parent: null, pivot: [0, 0, 0], box: [-15, 0, -31, 15, 17, 31], paint: (g) => {
      g.fill((x, y, z) => {
        const ax = Math.abs(x);
        if (ax >= 8 && ax < 14 && y < 9) {                                       // tracks
          const p = trackProfile(y, z); if (p <= 0) return -1;
          if (p < 1.5) return TREAD[(fl(z + y) & 1)];
          return ax < 9.6 ? METAL : -1;                                          // open on the outside so the wheels show
        }
        if (ax < 8 && y >= 2.5 && y < 9 && z > -28 && z < 28 && y > 2.5 + Math.max(0, z - 22) * 0.9 && y > 2.5 + Math.max(0, -23 - z) * 0.7) return y < 3.5 ? METAL : dk; // belly
        if (ax < 14.5 && y >= 9 && y < 13.5 && z > -29 && z < 29) {              // upper hull with a sloped glacis
          const top = Math.min(13.5, 13.5 - (z - 16) * 0.42, 13.5 - (-25 - z) * 0.8); if (y > top) return -1;
          if (y < 9.8) return dk;                                                // shadow line under the fenders
          if (top === 13.5 && y > 12.5 && z < -12 && z > -25 && ax < 9) return fl(z) & 1 ? BLACK : STEEL; // engine grille
          if (z > 16 && ax < 0.6) return dk;                                     // glacis centre weld
          return paint(x, y, z);
        }
        return -1;
      });
      for (const s of [1, -1]) {
        const b = (x0, y0, z0, x1, y1, z1, c) => g.box(Math.min(x0 * s, x1 * s), y0, z0, Math.max(x0 * s, x1 * s), y1, z1, c);
        b(10, 9, 23, 13, 11, 25, LAMP); b(10, 11, 23, 13, 12, 25, METAL);        // headlamps under a guard
        b(10, 13, -12, 14, 15, 2, (i, j, k) => STOW[(i + k) & 1]); b(10, 15, -11, 14, 16, -5, CANVAS); // stowage box and bedroll
        b(10, 13, 5, 14, 14, 12, STEEL); b(11, 14, 6, 13, 15, 8, METAL);         // tool rack
        b(9, 10, -31, 12, 13, -29, BLACK); b(9, 13, -30, 12, 14, -29, STEEL);    // exhausts
        b(4, 6, -29, 6, 8, -28, STEEL);                                          // tow hooks
        b(14, 9, -29, 15, 10, 28, dk);                                           // fender lip
      }
      g.box(-7, 13, -11, 7, 14, 7, METAL);                                       // turret ring
      g.box(-2, 6, 28, 2, 8, 30, STEEL); g.box(-6, 13, 9, -3, 14, 13, DARK);     // tow eye, driver's hatch
      g.box(-5, 14, 10, -4, 15, 12, GLASS2);                                     // driver's periscope
    } },
    { name: 'turret', parent: 'hull', pivot: [0, 14, -2], box: [-11, 0, -15, 11, 13, 14], paint: (g) => {
      g.fill((x, y, z) => {
        const ax = Math.abs(x);
        if (y < 6.5 && z > -11 && z < 12.5) {
          const lim = 9.6 - Math.max(0, z - 3) * 0.72 - Math.max(0, -6 - z) * 0.55 - y * 0.28;
          if (ax < lim) return (z < -6.5 && z > -8.5 && ax > lim - 1.2) ? STRIPE : y > 5.5 ? tone(paint(x, y + 20, z), 1.06) : paint(x, y + 20, z);
        }
        if (z <= -11 && z > -15 && ax < 6.5 && y > 1 && y < 5) return (fl(x) + fl(y) + fl(z)) & 1 ? STOW[0] : (y < 2 || z < -14 ? STEEL : STOW[1]); // stowage basket
        if (hyp(x + 3.5, z + 3) < 2.7 && y >= 6.5 && y < 8) return y > 7.3 ? DARK : (fl(Math.atan2(z + 3, x + 3.5) * 2.5) & 1 ? GLASS2 : METAL); // commander's cupola
        return -1;
      });
      g.box(3, 6, -1, 4, 9, 0, METAL); g.box(3, 9, -3, 4, 10, 5, METAL); g.box(3, 8, -2, 5, 9, -1, STOW[1]); // roof machine gun
      g.box(-6, 6, -8, -5, 13, -7, METAL); g.set(-6, 12, -8, WARN);              // aerial
      for (const s of [1, -1]) { g.box(s > 0 ? 8 : -10, 2, 2, s > 0 ? 10 : -8, 4, 3, STEEL); g.box(s > 0 ? 8 : -10, 2, 4, s > 0 ? 10 : -8, 4, 5, STEEL); g.box(s > 0 ? 8 : -10, 2, 0, s > 0 ? 10 : -8, 4, 1, STEEL); } // smoke launchers
      g.box(4, 6, 4, 6, 7, 7, GLASS2);                                           // gunner's sight
    } },
    { name: 'barrel', parent: 'turret', pivot: [0, 3, 11], box: [-3, -3, 0, 3, 3, 37], paint: (g) => g.fill((x, y, z) => {
      const r = hyp(x, y);
      if (z < 3.5) return Math.abs(x) < 3 && Math.abs(y) < 2.6 ? tone(pal[1], 0.8) : -1;   // mantlet
      if (z > 32) return r < 2 ? (z > 36 && r < 1.2 ? BLACK : (fl(z) & 1 ? METAL : STEEL)) : -1; // muzzle brake
      if (z > 17 && z < 23) return r < 2 ? pal[1] : -1;                          // fume extractor
      return r < 1.25 ? (z < 7 ? METAL : pal[0]) : -1;
    }) },
    flashPart('barrel', [0, 0, 37], 9, 3),
    ...[0, 1, 2, 3, 4].map((i) => wheel(1, i)), ...[0, 1, 2, 3, 4].map((i) => wheel(-1, i)),
  ];
}
const tankWheels = (spin) => { const p = {}; for (let i = 0; i < 5; i++) { p['wL' + i] = [spin, 0, 0]; p['wR' + i] = [spin, 0, 0]; } return p; };
export const TANK = {
  kind: 'tank', h: H, parts: tankParts, start: 'Idle', dieAt: 0.22, inner: INNER, respawn: 9,
  clips: {
    Idle: { loop: true, speed: 0, pose: (t, u) => ({ ...tankWheels(0), hull: [0, 0, 0, 0, 0.025 * S(t * 34), 0], turret: [0, 0.7 * S(t * 0.45 + u.phase), 0], barrel: [-0.04 + 0.03 * S(t * 0.8 + u.phase), 0, 0], flash: OFF }) },
    Drive: { loop: true, speed: 9, pose: (t, u) => ({ ...tankWheels(t * 9 / 1.65), hull: [0.012 * S(t * 4.7 + u.phase), 0, 0.008 * S(t * 3.1), 0, 0.05 * S(t * 12) + 0.03, 0], turret: [0, 0.2 * S(t * 0.6 + u.phase), 0], barrel: [-0.03 - 0.02 * S(t * 4.7 + u.phase), 0, 0], flash: OFF }) },
    Fire: { loop: true, speed: 0, pose: (t, u) => {
      const aim = Math.min(1, t / 0.9), ph = Math.max(0, t - 1.1 + u.phase * 0.12) % 2.6, on = t > 1.1 - u.phase * 0.12, k = on ? Math.exp(-ph * 5) : 0;
      return { ...tankWheels(0), hull: [0, 0, 0.05 * k * C(ph * 9), 0, 0, 0], turret: [0, PI / 2 * aim * aim * (3 - 2 * aim), 0], barrel: [-0.3 * aim, 0, 0, 0, 0, -1.8 * k], flash: [0, 0, ph * 20, 0, 0, 0, on && ph < 0.11 ? 1.5 : 0] };
    } },
    Wreck: { loop: false, hidden: true, dur: 1.4, speed: 0, pose: (t, u) => { // the turret is blown off and lands askew
      const a = Math.min(1, t / 0.9), y = 26 * a - 26 * a * a, e = Math.min(1, t / 1.1), sd = u.phase > 3 ? 1 : -1;
      return { ...tankWheels(0), hull: [0.03 * e, 0, 0.05 * sd * e, 0, -0.25 * e, 0], turret: [0.5 * a * (1 - a) * 4 + 0.22 * a, 1.1 * sd * a, 0.3 * sd * a, 2.5 * sd * a, y + 0.4 * a, -1.5 * a], barrel: [0.3 * e, 0, 0], flash: OFF };
    } },
  },
  onKill(u, point, r, debris) { u.wreck(debris, 0.3, 24); u.play('Wreck', 0.05); },
};

// ================= JEEP =================
function jeepParts(o) {
  const pal = o.type === 'desert' ? SAND : GREEN, paint = camo(pal, 5 + (o.seed || 0)), dk = tone(pal[1], 0.72);
  const wheel = (n, sx, sz) => ({ name: n, parent: 'body', pivot: [7 * sx, 3.6, 10 * sz], box: [-2, -4, -4, 2, 4, 4], paint: (g) => g.fill((x, y, z) => {
    const r = hyp(y, z); if (r > 3.7) return -1;
    if (r > 2.2) return RUBBER[fl((Math.atan2(y, z) + PI) * 7 / PI) & 1];
    if (x * sx < 0.9) return METAL;
    return r < 0.9 ? STEEL : (Math.abs(y) < 0.55 || Math.abs(z) < 0.55) ? dk : pal[0];
  }) });
  return [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-9, 0, -18, 9, 18, 18], paint: (g) => {
      g.fill((x, y, z) => {
        const ax = Math.abs(x), da = hyp(y - 3.6, Math.abs(z) - 10), arch = da < 4.7 && ax > 4.5;
        if (ax > 4.5 && ax < 8.5 && da >= 4.7 && da < 5.8 && y > 4.5) return dk;                                // wheel arch flares
        if (arch) return -1;
        if (ax < 7 && y >= 2.6 && y < 8 && z > -15.5 && z < 15.5) return y < 3.6 ? METAL : y > 7 && z < 4 && z > -15 && ax < 6 ? DARK : paint(x, y, z); // tub and floor
        if (z >= 4 && z < 15.5 && ax < 6.6 && y >= 8 && y < 10.6 - Math.max(0, z - 12.5) * 0.5) return ax < 0.6 ? dk : (y > 9.6 && ax > 2 && ax < 5 && z > 6 && z < 12 && (fl(z) & 1) ? dk : paint(x, y, z)); // bonnet with vents
        if (z < 4 && z > -15.5 && ax >= 6 && ax < 7 && y >= 8 && y < 10.2) return (z > -3.5 && z < 2.5 && y > 8.8) ? -1 : paint(x, y, z); // sides with a cut-down door
        if (z <= -14.5 && z > -15.5 && ax < 7 && y >= 8 && y < 10.6) return paint(x, y, z);                     // tailgate
        if (z >= 3 && z < 4 && ax < 6.6 && y >= 8 && y < 11) return DARK;                                       // dashboard
        if (z >= 4 && z < 5 && ax < 6.6 && y >= 10.6 && y < 15.4) return ax > 5.6 || y > 14.4 || ax < 0.5 ? dk : GLASS2; // windscreen
        if (z >= -7.5 && z < -6.5 && ((ax >= 5.6 && ax < 6.6 && y >= 10 && y < 17) || (y >= 16 && y < 17 && ax < 6.6))) return METAL; // roll bar
        if (ax > 1 && ax < 5.6) { if (z >= -4 && z < -0.5 && y >= 8 && y < 9.5) return SEAT; if (z >= -5 && z < -4 && y >= 8 && y < 13) return SEAT; } // seats
        return -1;
      });
      g.box(-8, 4, 16, 8, 6, 17, STEEL); g.box(-8, 4, -16, 8, 6, -15, STEEL);     // bumpers
      for (let i = -3; i < 3; i++) g.box(i, 5, 15, i + 1, 9, 16, i & 1 ? BLACK : STEEL); // grille
      g.box(-6, 6, 15, -4, 8, 16, LAMP); g.box(4, 6, 15, 6, 8, 16, LAMP);          // headlamps
      g.box(-7, 6, -16, -5, 7, -15, RED); g.box(5, 6, -16, 7, 7, -15, RED);        // tail lamps
      g.fill((x, y, z) => (z > -17 && z < -15 && hyp(x, y - 10) < 3.4 ? (hyp(x, y - 10) < 1.6 ? STEEL : RUBBER[0]) : -1)); // spare wheel
      g.box(2, 11, 3, 5, 12, 4, METAL); g.box(3, 9, 2, 4, 12, 3, METAL);           // steering wheel
      g.box(-6, 8, -14, -3, 11, -11, (i, j, k) => STOW[(i + j) & 1]); g.box(3, 8, -14, 5, 11, -12, 0x5a2a22); g.box(3, 11, -13, 5, 12, -12, METAL); // crate and fuel can
      g.box(-5, 8, -10, 5, 9, -8, CANVAS);                                         // bedroll
      g.box(-9, 10, 3, -7, 12, 4, METAL); g.box(7, 10, 3, 9, 12, 4, METAL);        // wing mirrors
      g.box(6, 10, -14, 7, 18, -13, METAL);                                        // aerial
    } },
    { name: 'gun', parent: 'body', pivot: [0, 17, -7], box: [-3, 0, -4, 3, 5, 10], paint: (g) => {
      g.box(-1, 0, -1, 1, 1, 1, STEEL); g.box(-1, 1, -3, 1, 3, 3, METAL); g.box(0, 2, 3, 1, 3, 9, STEEL); g.box(-1, 2, 3, 0, 3, 5, METAL);
      g.box(-3, 1, -1, -1, 3, 1, pal[1]); g.box(-1, 2, -4, 1, 3, -3, STOW[0]); g.box(-2, 3, -2, 2, 5, -1, STEEL); // ammunition box, grips, shield
    } },
    { name: 'flash', parent: 'gun', pivot: [0.5, 2.5, 9], box: [-1, -1, 0, 1, 1, 4], paint: (g) => { g.box(-1, -1, 0, 1, 1, 2, FIRE2); g.box(-1, -1, 2, 1, 1, 3, FIRE1); g.set(0, 0, 3, FIRE1); } },
    wheel('wFL', 1, 1), wheel('wFR', -1, 1), wheel('wRL', 1, -1), wheel('wRR', -1, -1),
  ];
}
const jeepWheels = (spin, steer = 0) => ({ wFL: [spin, steer, 0], wFR: [spin, steer, 0], wRL: [spin, 0, 0], wRR: [spin, 0, 0] });
export const JEEP = {
  kind: 'jeep', h: H, parts: jeepParts, start: 'Idle', dieAt: 0.2, inner: INNER, respawn: 9,
  clips: {
    Idle: { loop: true, speed: 0, pose: (t, u) => ({ ...jeepWheels(0), body: [0, 0, 0, 0, 0.03 * S(t * 38), 0], gun: [0.05, 0.9 * S(t * 0.6 + u.phase), 0], flash: OFF }) },
    Drive: { loop: true, speed: 20, pose: (t, u) => ({ ...jeepWheels(t * 20 / 1.85), body: [0.02 * S(t * 7 + u.phase), 0, 0.015 * S(t * 5.3 + u.phase), 0, 0.1 * Math.abs(S(t * 8 + u.phase)), 0], gun: [0.05, 0.3 * S(t * 0.9 + u.phase), 0], flash: OFF }) },
    Fire: { loop: true, speed: 0, pose: (t, u) => {
      const aim = Math.min(1, t / 0.5), ph = (t + u.phase) % 1.6, burst = ph < 1.0 && aim >= 1, sh = burst ? (ph * 11) % 1 : 1, k = burst ? Math.exp(-sh * 4) : 0;
      return { ...jeepWheels(0), body: [0, 0, 0.012 * k, 0, 0, 0], gun: [-0.28 * aim - 0.03 * k, PI / 2 * aim, 0, 0, 0, -0.12 * k], flash: [0, 0, ph * 50, 0, 0, 0, burst && sh < 0.4 ? 1.4 : 0] };
    } },
    Flee: { loop: true, speed: 30, pose: (t, u) => { const sw = S(t * 2.6 + u.phase); return { ...jeepWheels(t * 30 / 1.85, 0.35 * sw), body: [0.03 * S(t * 9), 0.16 * sw, -0.07 * C(t * 2.6 + u.phase), 0.8 * sw, 0.16 * Math.abs(S(t * 10)), 0], gun: [0.3, PI + 0.4 * S(t * 3), 0], flash: OFF }; } },
    Wreck: { loop: false, hidden: true, dur: 1.2, speed: 0, pose: (t, u) => { // flipped onto its roll bar
      const a = Math.min(1, t / 0.85), e = a * a * (3 - 2 * a), sd = u.phase > 3 ? 1 : -1, land = Math.max(0, t - 0.85);
      return { ...jeepWheels(t * 9 * (1 - e) + 3), body: [0.08 * e, 0.5 * sd * e, PI * e * sd, 2 * sd * e, 8.6 * e + 9 * a * (1 - a) + 0.5 * Math.exp(-land * 8) * Math.abs(S(land * 14)) * (a >= 1 ? 1 : 0), 0], gun: [0.5 * e, 0.6 * e, 0], flash: OFF };
    } },
  },
  onKill(u, point, r, debris) { u.wreck(debris, 0.28, 22); u.play('Wreck', 0.05); },
};

// ================= HELICOPTER =================
function seg(x, y, z, ax, ay, az, bx, by, bz, ra, rb) { // tapered capsule, <= 0 inside
  const dx = bx - ax, dy = by - ay, dz = bz - az; let t = ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / (dx * dx + dy * dy + dz * dz); t = t < 0 ? 0 : t > 1 ? 1 : t;
  return hyp(ax + dx * t - x, ay + dy * t - y, az + dz * t - z) - (ra + (rb - ra) * t);
}
function heliParts(o) {
  const pal = GREY, paint = camo(pal, 9 + (o.seed || 0)), dk = tone(pal[1], 0.7);
  return [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-16, -15, -62, 16, 19, 28], paint: (g) => {
      g.fill((x, y, z) => {
        const ax = Math.abs(x), e = hyp(x / 7.6, y / 8.2, (z - 4) / 22.5);
        if (e < 1) {                                                              // fuselage
          if (z > 12 && y > -2 && e > 0.72) return (ax < 0.6 || Math.abs(z - 18.5) < 0.6 || y < -1) ? dk : (y > 4 ? GLASS2 : GLASS); // canopy
          if (y < -4.5) return tone(BELLY, 0.95 + 0.08 * hash(fl(x), fl(y), fl(z)));
          if (z > -1 && z < 8 && y > -2.5 && y < 3 && ax > 5 && e > 0.8) return (z > 0 && z < 7 && y > -1.5 && y < 2) ? GLASS : dk; // cabin door window
          if (z > -9 && z < -8 && e > 0.8) return dk;                             // panel line behind the cabin
          return paint(x, y, z);
        }
        if (seg(x, y, z, 0, 2, -14, 0, 5.5, -57, 3.4, 1.7) <= 0) return z < -38 && z > -42 ? WARN : paint(x, y, z); // tail boom with a warning band
        if (ax < 1 && z > -62 && z < -50 && y > 4 && y < 18.5 && (y - 4) < (z + 62) * 2.6 + 3) return y > 17 ? RED : y > 14.5 ? WARN : paint(x, y, z); // fin
        if (y >= 5 && y < 6.2 && ax < 9.5 && z > -53 && z < -47) return dk;       // tailplane
        const eh = hyp(x / 4.1, (y - 6.4) / 4.3, (z + 2) / 12.5);                // engine fairing: a low streamlined hump on the roof
        if (eh < 1 && y > 5) return eh > 0.72 && z > 5.5 && y > 7.6 && ax > 0.8 && ax < 3 ? BLACK : eh > 0.72 && z < -11 && y > 7.4 && ax < 2 ? BLACK : (eh > 0.8 && Math.abs(z + 3) < 0.6) ? dk : paint(x, y + 9, z);
        if (hyp(x, z) < 1.2 && y >= 10 && y < 13.5) return METAL;                 // rotor mast
        if (y >= -3.2 && y < -1.8 && ax < 14.5 && z > -2 && z < 6) return dk;     // stub wings
        const pr = hyp(ax - 12.5, y + 5); if (pr < 1.9 && z > -3.5 && z < 8.5) return z > 7.5 ? (pr < 1.1 ? BLACK : WARN) : z < -2.5 ? BLACK : pal[1]; // rocket pods
        if (ax >= 5.6 && ax < 7 && y >= -14 && y < -12.8 && z > -13 && z < 17) return METAL; // skids
        if (ax >= 5.6 && ax < 7 && z >= 16 && z < 18 && y >= -14 && y < -11.5) return METAL;
        if (ax >= 5 && ax < 6.6 && y >= -12.8 && y < -2 && ((z > -8.5 && z < -7) || (z > 9 && z < 10.5))) return STEEL; // skid struts, run up into the cabin sides
        return -1;
      });
      g.fill((x, y, z) => (hyp(x, y + 5.2, z - 21) < 2.1 ? (z > 22 && y < -5 ? GLASS2 : METAL) : -1)); // sensor ball tucked under the nose
      g.box(-15, -3, 2, -14, -2, 3, RED); g.box(14, -3, 2, 15, -2, 3, GREENLAMP); // navigation lights on the wing tips
      g.box(-1, -9, -2, 1, -8, 0, RED);                                           // belly beacon
    } },
    { name: 'rotor', parent: 'body', pivot: [0, 13.5, 0], box: [-43, 0, -43, 43, 2, 43], paint: (g) => g.fill((x, y, z) => {
      const ax = Math.abs(x), az = Math.abs(z);
      if (hyp(x, z) < (y < 1 ? 1.6 : 2.4)) return y < 1 ? METAL : STEEL;
      if (y < 1) return -1;
      if ((az < 1.5 && ax < 42) || (ax < 1.5 && az < 42)) return Math.max(ax, az) > 38 ? WARN : METAL;
      return -1;
    }) },
    { name: 'tailRotor', parent: 'body', pivot: [1, 12.5, -57], box: [0, -8, -8, 2, 8, 8], paint: (g) => g.fill((x, y, z) => {
      const ay = Math.abs(y), az = Math.abs(z);
      if (hyp(y, z) < 1.6) return STEEL;
      if (x > 1) return -1;
      return (az < 1 && ay < 7.6) || (ay < 1 && az < 7.6) ? (Math.max(ay, az) > 6 ? WARN : METAL) : -1;
    }) },
    { name: 'gun', parent: 'body', pivot: [0, -7.2, 16], box: [-2, -4, -2, 2, 1, 9], paint: (g) => { g.fill((x, y, z) => (hyp(x, y + 1.5, z) < 2.3 ? METAL : -1)); g.box(-1, -3, 1, 1, -2, 8, STEEL); g.box(-1, -3, 7, 1, -2, 8, BLACK); } },
    { name: 'flash', parent: 'gun', pivot: [0, -2.5, 8], box: [-1, -1, 0, 1, 1, 4], paint: (g) => { g.box(-1, -1, 0, 1, 1, 2, FIRE2); g.box(-1, -1, 2, 1, 1, 4, FIRE1); } },
  ];
}
export const HELI = {
  kind: 'heli', h: H, parts: heliParts, start: 'Hover', dieAt: 0.1, inner: INNER, respawn: 5, crumbleAt: 1.55, altitude: 40,
  clips: {
    Hover: { loop: true, speed: 0, pose: (t, u) => ({ body: [0.03 * S(t * 0.9), 0.12 * S(t * 0.37), 0.04 * S(t * 1.3), 0.8 * S(t * 0.5), 0.9 * S(t * 1.1 + u.phase), 0], rotor: [0, t * 17, 0], tailRotor: [t * 31, 0, 0], gun: [0.2, 0.7 * S(t * 0.8), 0], flash: OFF }) },
    Fly: { loop: true, speed: 26, pose: (t, u) => ({ body: [0.24 + 0.02 * S(t * 2), 0, 0.05 * S(t * 0.9), 0, 0.6 * S(t * 1.4 + u.phase), 0], rotor: [0, t * 20, 0], tailRotor: [t * 34, 0, 0], gun: [0, 0, 0], flash: OFF }) },
    Fire: { loop: true, speed: 0, pose: (t, u) => {
      const aim = Math.min(1, t / 1.2), e = aim * aim * (3 - 2 * aim), ph = t % 1.4, burst = ph < 0.9 && aim >= 1, sh = burst ? (ph * 13) % 1 : 1;
      return { body: [0.16 * e + 0.02 * S(t * 1.7), PI / 2 * e, 0.03 * S(t * 1.3), 0, 0.7 * S(t * 1.1), 0], rotor: [0, t * 17, 0], tailRotor: [t * 31, 0, 0], gun: [0.1, 0, 0, 0, 0, burst ? -0.08 * (1 - sh) : 0], flash: [0, 0, ph * 40, 0, 0, 0, burst && sh < 0.45 ? 1.6 : 0] };
    } },
    Crash: { loop: false, hidden: true, dur: 1.6, speed: 0, pose: (t, u) => { // spins down and breaks up on the ground
      const a = Math.min(1, t / 1.55), fall = a * a;
      return { body: [0.3 * fall, 7 * a * a + 2 * a, 0.7 * fall, 5 * a, -(u.def.altitude - 6) * fall, 0], rotor: [0.25 * a, t * 17 * (1 - 0.6 * a), 0], tailRotor: [t * 8, 0, 0], gun: [0.4, 0, 0], flash: OFF };
    } },
  },
  onKill(u, point, r, debris) { u.play('Crash', 0.05); },
};

// paint and helpers shared with the convoy vehicles (convoy.js)
export { GREEN, SAND, DARK, STEEL, METAL, BLACK, RUBBER, TREAD, STOW, CANVAS, GLASS, GLASS2, STRIPE, WARN, LAMP, RED, FIRE1, FIRE2, INNER, OFF, camo, flashPart };

// ================= the pack's own models, unchanged, for comparison =================
function packDef(name, h, alt = 0) {
  const m = PACK[name], [sx, sy, sz] = m.size, ox = -Math.floor(sx / 2), oz = -Math.floor(sz / 2);
  return { kind: 'pack-' + name, h, start: 'Idle', dieAt: 0.3, respawn: 9, altitude: alt, pack: true,
    parts: () => [{ name: 'body', parent: null, pivot: [0, 0, 0], box: [ox, 0, oz, ox + sx, sy, oz + sz], paint: (g) => { for (let i = 0; i < m.cubes.length; i += 3) g.set(ox + m.cubes[i], m.cubes[i + 1], oz + m.cubes[i + 2], m.colour); } }],
    clips: { Idle: { loop: true, speed: 0, pose: () => ({}) } },
    onKill(u, point, r, debris) { u.burst(debris, point, 18); } };
}
// pack cube sizes chosen so each original comes out at a believable real-world length
export const PACK_TANK = packDef('tank', 1), PACK_JEEP = packDef('jeep', 0.5), PACK_HELI = packDef('heli', 1.5, 40);
