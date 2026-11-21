// The combat cars, built in code on the army's cube kit (../../units/src) at sixteenth-metre cubes (h = 0.25 town
// voxels): twice as fine each way as Monster Mayhem's street cars, so about four times the cubes on every surface.
// One builder makes every car from a build (parts.js): four bodies, four sets of wheels, four armour levels, three
// roof guns, three heavy weapons, four fronts and six paint jobs.
//
// Coordinates are whole cubes. Left is +x, forward is +z, the ground is y = 0. A cube (i, j, k) fills i..i+1, j..j+1,
// k..k+1, so its centre is (i + 0.5, j + 0.5, k + 0.5) and the car is symmetric about x = 0. The body is laid out from
// a handful of numbers (length, width, belt line, roof, where the glass starts and ends, the axles) by a function that
// says, for every cube, what it belongs to: lower body, glass house, bumper, wheel arch, flare, mirror, armour plate,
// window bar. A second pass then colours each cube by what it belongs to and which of its faces show: lamps and grille
// on the front, tail lamps and plate on the back, door shut lines and handles on the sides, glass and pillars.
// Wheels, the turret and its guns, the heavy weapon and the front ram are parts of their own, on bones, so they turn,
// spin and pitch, and can be blown off.
import { GLOW, hash, tone } from '../../units/src/voxpart.js';
import { PARTS, PAINTS } from './parts.js';

export const H = 0.25;
const PI = Math.PI, ab = Math.abs, fl = Math.floor, hyp = Math.hypot;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), ease = (a) => a * a * (3 - 2 * a);

// ---- colours ----
const CHROME = 0xc9ced6, PLASTIC = 0x26282c, TRIM = 0x1b1c20, CHASSIS = 0x1a1b1e, ARCH = 0x141518;
const GLASS = 0x24404f, GLASS2 = 0x2f5466, SHINE = 0x8dbdd0;
const LAMP = 0xfff3c4 | GLOW, TAIL = 0xff3826 | GLOW, AMBER = 0xffa51e | GLOW, HOUSING = 0x3a3d42, REV = 0xd8d6cf, TAILC = 0x8a1c16;
const GRILLE = 0x111215, GRILLE2 = 0x2b2d31, PLATEW = 0xeeeee6, INK = 0x24356b;
const TYRE = 0x222326, TYRE2 = 0x2c2d31, WALL = 0x1b1c1f, RIM = 0xb4b9c1, RIMD = 0x3a3d43, HUB = 0xdfe3e8, DRUM = 0x2a2b2f, DISC = 0x5b5f66, CALIPER = 0xc23b2e, GOLD = 0xc9a23a;
const GUNMETAL = 0x3b3f45, STEEL = 0x8a9098, BRIGHT = 0xb9bfc7, DARKS = 0x202327, ARMOUR = 0x5f646b, ARMOUR2 = 0x50555b, RIVET = 0xaab0b8;
const RUST = [0x7a4a2a, 0x8f5a30, 0x5e3a22], HAZ = 0xe2b21e, HAZK = 0x1a1a1a, OLIVE = 0x4f5a36, OLIVE2 = 0x434d2d, TIP = 0xc0402c, BED = [0x34363a, 0x2a2c2f];
const FLAME = [0xffd23a, 0xf58a1f, 0xc8321e], CHECKW = 0xeeeae0, RED_GLOW = 0xff3a2a | GLOW;
const INNER = [0x1c1d20, 0x26272a, 0x151618];

// ---- the bodies ----
// L: length. W: half the width. c0: the underside. belt: the top of the doors (the base of the glass). roof.
// rb, fb: where the glass house starts and ends at the belt; rr, fr: the same at the roof (the slope of the rear window
// and the windscreen). doors: [rear, front] of each door. hood: how far the bonnet falls to the nose. ax: the axles.
// R: wheel radius. noseR, tailR: how round the corners are in plan.
const SHAPES = {
  hatch: { L: 66, W: 14, c0: 3, belt: 14, roof: 23, rb: -30, rr: -27, fb: 12, fr: 2, doors: [[-8, 11]], hood: 2, ax: [21, -21], R: 6, noseR: 6, tailR: 4, bumper: PLASTIC, pipes: 1 },
  sedan: { L: 74, W: 14, c0: 3, belt: 14, roof: 23, rb: -21, rr: -14, fb: 14, fr: 4, doors: [[-3, 13], [-20, -4]], hood: 2, ax: [24, -24], R: 6, noseR: 6, tailR: 5, bumper: CHROME, strip: true, pipes: 1 },
  muscle: { L: 76, W: 15, c0: 3, belt: 14, roof: 21, rb: -24, rr: -12, fb: 9, fr: 0, doors: [[-7, 8]], hood: 1, ax: [25, -25], R: 6, noseR: 5, tailR: 4, bumper: CHROME, scoop: true, pipes: 2 },
  pickup: { L: 80, W: 15, c0: 5, belt: 17, roof: 28, rb: -6, rr: -5, fb: 17, fr: 9, doors: [[-4, 16]], hood: 2, ax: [26, -26], R: 7, noseR: 4, tailR: 2, bumper: 0x7d838b, bed: true, pipes: 1 },
};
// the wheels: radius (0 for the body's own), width in cubes, depth of the tyre, how far the outer face sits inside the body
const WHEELS = {
  street: { R: 0, w: 4, tread: 2, out: 1 },
  offroad: { R: 0.6, w: 6, tread: 2.6, out: 0, blocks: 18 },
  slicks: { R: 0, w: 6, tread: 1.6, out: 0, slick: true },
  monster: { R: 10.5, w: 8, tread: 3.4, out: -6, blocks: 14 },
};
// how deep each front sticks out past the bumper, in cubes
const FRONT_DEPTH = { bumper: 3, plow: 7, spikes: 13, saws: 11 };

// smooth noise for camo and rust: whole-cube lattice, eased between
function noise(x, y, z, s) {
  const i = fl(x), j = fl(y), k = fl(z), fx = ease(x - i), fy = ease(y - j), fz = ease(z - k);
  const L = (a, b, t) => a + (b - a) * t, n = (a, b, c) => hash(i + a, j + b, k + c, s);
  return L(L(L(n(0, 0, 0), n(1, 0, 0), fx), L(n(0, 1, 0), n(1, 1, 0), fx), fy), L(L(n(0, 0, 1), n(1, 0, 1), fx), L(n(0, 1, 1), n(1, 1, 1), fx), fy), fz);
}

// ---- the body ----
const EMPTY = 0, LOWER = 1, GREEN = 2, BUMPER = 3, FLARE = 4, MIRROR = 5, PLATE = 6, BAR = 7, SCOOP = 8, PIPE = 9, BEDF = 10, LINER = 11;

function bodyPart(S, o, wk) {
  const { L, W, c0, belt, roof, rb, rr, fb, fr, R } = S, zN = L / 2, zT = -L / 2;
  const look = PARTS.armour[o.armour] ? PARTS.armour[o.armour].look : 0;
  const base = PAINTS[o.paint] ?? PAINTS.orange, trim = PAINTS[o.trim] ?? PAINTS.black, pattern = o.pattern || 'plain', seed = o.seed || 0;
  const lift = wk.lift, wR = wk.R, wy = wR - lift;   // the wheels' centre height in the body's own cubes
  const cutX = W - wk.out - wk.w - 1;                // the arches are cut out further in than this
  const aR = Math.min(wR + 1.2, belt - wy - 0.6);    // arch radius (the monster tyres outgrow theirs)
  const top = (z) => {                               // the top of the lower body along its length
    let t = belt;
    if (z > fb) t -= S.hood * (z - fb) / (zN - fb);
    const dn = z - (zN - 3); if (dn > 0) t -= dn * dn * 0.35;
    const dt = zT + 3 - z; if (dt > 0) t -= dt * dt * 0.3;
    return t;
  };
  const bot = (z) => c0 + Math.max(0, z - (zN - 5)) * 0.6 + Math.max(0, zT + 5 - z) * 0.6;
  const halfW = (z, y, t, b) => {                    // the width at z, rounded at the corners and along the top and bottom edges
    let w = W;
    const dn = z - (zN - 1 - S.noseR); if (dn > 0) w -= S.noseR - Math.sqrt(Math.max(0, S.noseR * S.noseR - dn * dn));
    const dt = zT + 1 + S.tailR - z; if (dt > 0) w -= S.tailR - Math.sqrt(Math.max(0, S.tailR * S.tailR - dt * dt));
    if (y > t - 1) w -= 1; if (y < b + 1) w -= 1;
    return w;
  };
  const span = roof - belt;
  const gh = (y) => { const t = clamp((y - belt) / span); return { front: fb + (fr - fb) * t, rear: rb + (rr - rb) * t, w: W - 1 - 3 * t }; };
  const plateZ = [S.ax[1] + aR + 1.5, S.ax[0] - aR - 1.5], plateT = look >= 3 ? 2 : 1;
  const nt = top(zN - 1.5), tt = top(zT + 1.5);
  const pipeX = S.pipes === 2 ? [W - 6, -(W - 6)] : [-(W - 6)];

  function role(x, y, z) {
    const ax = ab(x), t = top(z), b = bot(z);
    // the wheel arches, and the flares round them
    let d = 1e9; for (const a of S.ax) d = Math.min(d, hyp(y - wy, z - a));
    if (y < belt && d < aR) { if (ax > cutX) return EMPTY; if (ax > cutX - 1.5 && y >= b && y < t) return LINER; }
    if (y < belt && d >= aR && d < aR + 1.6 && y > wy - 1.5 && ax > W - 1.2 && ax < W + 1) return FLARE;
    // the lower body (and the pickup's open bed)
    if (z > zT + 1 && z < zN - 1 && y >= b && y < t && ax < halfW(z, y, t, b)) {
      if (S.bed && z < rb - 1 && z > zT + 2.5 && ax < W - 1.5) { if (y > c0 + 3.5) return EMPTY; if (y > c0 + 2) return BEDF; }
      return LOWER;
    }
    // the glass house
    if (y >= belt && y < roof) {
      const g = gh(y), last = y >= roof - 1;
      if (z >= g.rear + (last ? 1 : 0) && z <= g.front - (last ? 1 : 0) && ax < g.w - (last ? 1 : 0)) return GREEN;
    }
    // bumpers
    if ((z >= zN - 1.2 && z < zN) || (z > zT && z <= zT + 1.2)) if (y >= c0 + 1 && y < c0 + 4 && ax < W - 1.2) return BUMPER;
    // mirrors on the doors' front corners
    if (z >= fb - 4 && z < fb - 1 && y >= belt && y < belt + 2 && ax >= W - 1.5 && ax < W + 1.5) return MIRROR;
    // tail pipes
    if (z > zT - 1.5 && z < zT + 1.5 && y >= c0 - 0.5 && y < c0 + 2.5) for (const px of pipeX) if (ab(x - px) < 1.5) return PIPE;
    // the muscle car's bonnet scoop
    if (S.scoop && z >= fb + 5 && z < fb + 15 && ax < 4.5 && y >= t && y < t + 2.2) return SCOOP;
    // armour
    if (look >= 1 && ax >= W && ax < W + plateT && z >= plateZ[0] && z <= plateZ[1] && y >= c0 + 2 && y < belt - 0.5) return PLATE;
    if (look >= 2) {
      if (z >= fb + 2 && z < zN - 5 && ax < W - 3 && y >= t && y < t + 1 && !(S.scoop && ax < 5.5 && z < fb + 16)) return PLATE;   // the bonnet plate
      if (y >= roof && y < roof + 1 && ax < W - 6 && z >= rr + 2 && z < fr - 1) return PLATE;                                          // the roof plate
      if (ax >= W && ax < W + 1 && y >= c0 + 2 && y < belt - 0.5 && ((z > zN - 9 && z < zN - 1.5) || (z < zT + 8 && z > zT + 1.5))) return PLATE;   // the corners
    }
    if (look >= 3 && y >= belt + 1 && y < roof - 1) {   // bars over the glass
      const g = gh(y), mid = fl((belt + roof) / 2) + 0.5;
      if (ax >= g.w && ax < g.w + 1 && z >= g.rear + 2 && z <= g.front - 2 && (fl(z) % 3 === 0 || ab(y - mid) < 0.5)) return BAR;
      if (z > g.front && z <= g.front + 1 && ax < g.w - 1 && (fl(x) % 4 === 0 || ab(y - mid) < 0.5)) return BAR;
      if (z < g.rear && z >= g.rear - 1 && ax < g.w - 1 && fl(x) % 4 === 0) return BAR;
    }
    return EMPTY;
  }

  // the paint job at a cube: the body colour, light along the shoulder and darker low down, then the pattern
  function paint(i, j, k, x, y, z, ax, onTop) {
    let c = tone(base, y < c0 + 3 ? 0.84 : y > belt - 2 ? 1.06 : 1);
    switch (pattern) {
      case 'stripes': if (ax >= 1 && ax < 4) c = trim; break;
      case 'flames': {
        if (ax > W - 2.5 && !onTop) {   // licks of flame down each flank from the front wheel
          const u = zN - 5 - z, len = 42;
          if (u >= 0 && u < len) { const mid = (c0 + belt) / 2, amp = (belt - c0) / 2 * (1 - u / len) * (0.62 + 0.38 * Math.sin(u * 0.55 + (x > 0 ? 0 : 1.7))) + 0.6, f = ab(y - mid) / amp; if (f < 1) c = FLAME[f < 0.42 ? 0 : f < 0.75 ? 1 : 2]; }
        } else if (onTop && z > fb) {   // and back along the bonnet
          const u = zN - 2 - z, len = 30;
          if (u >= 0 && u < len) { const amp = 3.6 * (1 - u / len) * (0.6 + 0.4 * Math.sin(u * 0.7)) + 0.5, f = ab(ax - 6.5) / amp; if (f < 1) c = FLAME[f < 0.42 ? 0 : f < 0.75 ? 1 : 2]; }
        }
        break;
      }
      case 'camo': { const n = noise(x / 7, y / 7, z / 7, seed + 9); c = n < 0.42 ? c : n < 0.6 ? tone(trim, y < c0 + 3 ? 0.84 : 1) : tone(base, 0.55); break; }
      case 'checker': {
        const ck = (trim >> 16) + ((trim >> 8) & 255) + (trim & 255) > 560 ? TRIM : trim;
        if (!onTop && y >= belt - 6 && y < belt - 2) c = ((fl(z / 2) + fl(y / 2)) & 1) ? ck : CHECKW;
        else if (onTop && ax < 3) c = ((fl(z / 2) + fl(x / 2)) & 1) ? ck : CHECKW;
        break;
      }
      case 'rust': { const n = noise(x / 5, y / 5, z / 5, seed + 4), r = hash(i, j, k, seed + 2); if (n > 0.6) c = RUST[fl(r * 3)]; else if (n > 0.54) c = tone(c, 0.72); break; }
    }
    return c;
  }

  // The box runs on well past the nose, to 200,000 cells: at that size the cube kit rebuilds a part a slab (16 layers
  // front to back) at a time (units/src/voxpart.js buildSlabs), so a hit rebuilds a slice of the car instead of all of
  // it. The empty layers cost nothing to draw.
  const I0 = -W - 4, I1 = W + 4, J1 = roof + 3, NX = I1 - I0, NY = J1, K0 = zT - 2, K1 = K0 + Math.max(L + 4, Math.ceil(200000 / (NX * NY)) + 1), NZ = K1 - K0;
  return { name: 'body', parent: null, pivot: [0, lift, 0], box: [I0, 0, K0, I1, J1, K1], paint(v) {
    const grid = new Uint8Array(NX * NY * NZ), at = (i, j, k) => (i < I0 || i >= I1 || j < 0 || j >= J1 || k < K0 || k >= K1 ? EMPTY : grid[((k - K0) * NY + j) * NX + i - I0]);
    for (let k = K0; k < K1; k++) for (let j = 0; j < J1; j++) for (let i = I0; i < I1; i++) grid[((k - K0) * NY + j) * NX + i - I0] = role(i + 0.5, j + 0.5, k + 0.5);
    for (let k = K0; k < K1; k++) for (let j = 0; j < J1; j++) for (let i = I0; i < I1; i++) {
      const r = at(i, j, k); if (r === EMPTY) continue;
      const x = i + 0.5, y = j + 0.5, z = k + 0.5, ax = ab(x), s = x > 0 ? 1 : -1;
      const up = !at(i, j + 1, k), fwd = !at(i, j, k + 1), back = !at(i, j, k - 1), side = !at(i + s, j, k);
      const t = top(z), b = bot(z);
      let c;
      if (r === LOWER) {
        c = paint(i, j, k, x, y, z, ax, up);
        if (y < b + 1) c = CHASSIS;
        else if (side && y < b + 2.5) c = PLASTIC;                                                   // the sills
        else if (fwd && z > zN - 10 && !up) {                                                       // the nose: lamps, indicators, grille
          if (ax >= W - 7 && ax < W - 2 && y >= nt - 4.5 && y < nt - 0.5) c = ax >= W - 6 && ax < W - 3 && y >= nt - 3.5 && y < nt - 1.5 ? LAMP : HOUSING;
          else if (ax >= W - 3 && ax < W - 1 && y >= nt - 4.5 && y < nt - 3.5) c = AMBER;
          else if (ax < W - 8 && y >= c0 + 3 && y < nt - 1) c = ax >= W - 9 || y >= nt - 2 ? (S.bumper === CHROME ? CHROME : TRIM) : ax < 1 && y >= nt - 3.5 && y < nt - 2.5 ? CHROME : (j & 1) ? GRILLE : GRILLE2;
          else if (y < c0 + 3) c = TRIM;
        } else if (back && z < zT + 10 && !up) {                                                    // the tail: lamps, reversing lights, plate
          if (ax >= W - 6 && ax < W - 1.5 && y >= tt - 4 && y < tt - 1.5) c = TAIL;
          else if (ax >= W - 7.5 && ax < W - 6 && y >= tt - 4 && y < tt - 1.5) c = REV;
          else if (ax < 4 && y >= c0 + 3.5 && y < c0 + 6.5) c = hash(i, j, 1, seed) < 0.35 && ax < 3 && y > c0 + 4 && y < c0 + 6 ? INK : PLATEW;
          else if (y < c0 + 3) c = TRIM;
          else if (S.bed && y > t - 1.5) c = TRIM;
        } else if (side && !up) {                                                                   // the flanks: shut lines, handles, the rubbing strip
          if (S.doors.some(([a, f]) => ab(z - a) < 0.5 || ab(z - (f + 1)) < 0.5) && y >= c0 + 2 && y < belt) c = tone(c, 0.66);
          else if (S.doors.some(([a]) => z >= a + 1.5 && z < a + 3.5) && y >= belt - 3 && y < belt - 2) c = CHROME;
          else if (S.strip && y >= c0 + 5 && y < c0 + 6) c = TRIM;
          else if (s > 0 && z >= S.ax[1] + aR + 2 && z < S.ax[1] + aR + 4 && y >= belt - 4 && y < belt - 2) c = tone(c, 0.6);   // the fuel cap
        } else if (up) {                                                                            // on top: vents under the windscreen, the bonnet's shut lines
          if (z >= fb && z < fb + 1 && ax < W - 2) c = (i & 1) ? TRIM : PLASTIC;
          else if (z > fb + 1.5 && ax >= W - 2.5 && ax < W - 1.5) c = tone(c, 0.74);
          else if (S.bed && z < rb - 1 && y > t - 1.5) c = TRIM;                                      // the bed rails
        }
      } else if (r === GREEN) {
        const g = gh(y), nearS = ax > g.w - 2, nearF = z > g.front - 2.2, nearR = z < g.rear + (S.bed || S.L === 66 ? 3 : 2.2);
        if (y >= roof - 2) c = side && y < roof - 1 ? TRIM : paint(i, j, k, x, y, z, ax, true);   // the roof and its drip rail
        else if (y < belt + 1) c = S.bumper === CHROME ? CHROME : TRIM;                                // the seal along the bottom of the glass
        else if (nearS && (nearF || nearR)) c = paint(i, j, k, x, y, z, ax, false);                  // the pillars at the corners
        else if (nearS && S.doors.length && z >= S.doors[0][0] - 1.5 && z < S.doors[0][0] + 0.5) c = TRIM;   // the post behind the front door
        else if (side || up) c = ((k + j * 2) % 17 + 17) % 17 < 2 ? SHINE : y >= roof - 4 ? GLASS2 : GLASS;
        else c = ((i + j * 2 + 400) % 15) < 2 ? SHINE : y >= roof - 4 ? GLASS2 : GLASS;
      } else if (r === BUMPER) c = y >= c0 + 2 && y < c0 + 3 && (fwd || back) ? (S.bumper === CHROME ? TRIM : PLASTIC) : S.bumper;
      else if (r === FLARE) c = S.scoop ? tone(base, 0.8) : PLASTIC;
      else if (r === MIRROR) c = back ? SHINE : ax < W ? TRIM : tone(base, 1.02);
      else if (r === PIPE) { const px = pipeX.find((p) => ab(x - p) < 1.5); c = ab(x - px) < 0.6 && ab(y - (c0 + 1)) < 0.6 ? 0x0c0c0e : CHROME; }
      else if (r === SCOOP) c = fwd && ax < 3.5 && y < t + 1.6 ? 0x0c0c0e : paint(i, j, k, x, y, z, ax, true);
      else if (r === PLATE) {
        const zz = fl(z - plateZ[0]);
        c = (look >= 3 && up && ax >= W) ? ((((k + j) >> 1) & 1) ? HAZ : HAZK) : ((zz % 6 === 1 && (j === c0 + 2 || j === belt - 2)) || (ab(z - fb - 4) < 0.6 && up)) ? RIVET : (fl(zz / 12) & 1) ? ARMOUR2 : ARMOUR;
        if (look === 1 && o.pattern === 'rust' && hash(i, j, k, 6) < 0.3) c = RUST[fl(hash(i, k, j, 2) * 3)];
      }
      else if (r === BAR) c = GUNMETAL;
      else if (r === BEDF) c = BED[k & 1];
      else c = ARCH;
      v.set(i, j, k, c);
    }
  } };
}

// ---- wheels ----
function wheelPart(name, s, z, S, wk, kind) {
  const R = wk.R, w = wk.w, x = s * (S.W - wk.out - w / 2), Rc = Math.ceil(R);
  return { name, parent: 'body', pivot: [x, R - wk.lift, z], box: [-w / 2, -Rc, -Rc, w / 2, Rc, Rc], paint: (g) => g.fill((px, py, pz) => {
    const r = hyp(py, pz); if (r > R) return -1;
    const a = Math.atan2(py, pz), xo = px * s, hw = w / 2, outer = xo > hw - 1, inner = xo < -hw + 1;
    if (r > R - 1) {                                                                                  // the tread
      if (wk.blocks) { const seg = fl((a / (2 * PI) + 0.5) * wk.blocks); return ((seg + (xo > 0 ? 0 : 1)) & 1) || ab(xo) < 1 ? TYRE2 : -1; }
      if (wk.slick) return TYRE;
      return (fl((a / (2 * PI) + 0.5) * 40) & 1) && !outer && !inner ? TYRE2 : TYRE;
    }
    if (r > R - wk.tread) return outer && wk.slick && r < R - wk.tread + 0.9 ? HAZ : outer || inner ? WALL : TYRE;
    // inside the tyre: the rim
    const rr = R - wk.tread;
    if (inner) return RIMD;
    if (!outer) return r > rr - 1 ? RIM : r < rr - 1.5 && ab(a - 0.8) < 0.35 && xo > 0 ? CALIPER : xo > -hw + 2 ? DISC : DRUM;   // the rim's barrel, a brake disc and its caliper
    if (r > rr - 1) return kind === 'offroad' ? (Math.cos(a * 12) > 0.8 ? BRIGHT : GUNMETAL) : kind === 'slicks' ? GOLD : RIM;
    if (kind === 'street') return r < 1.5 ? HUB : Math.cos(5 * a) > 0.5 ? RIM : -1;                // five-spoke alloys
    if (kind === 'offroad') return r < 1.5 ? HUB : r > 2.2 && r < 3.6 && Math.cos(6 * a) > 0.6 ? -1 : RIMD;   // black steel with holes
    if (kind === 'slicks') return r < 1.4 ? HUB : Math.cos(10 * a) > 0.2 ? GOLD : -1;                   // gold mesh
    return r < 2.6 ? HUB : Math.cos(8 * a) > 0.45 ? CHROME : RIMD;                                     // monster chrome
  }) };
}

// ---- the turret and its guns ----
function gunParts(S, o, roofY, roofZ) {
  const look = PARTS.primary[o.primary] ? PARTS.primary[o.primary].look : 'mg';
  const parts = [
    { name: 'yaw', parent: 'body', pivot: [0, roofY, roofZ], box: [-6, 0, -6, 6, 8, 6], paint(v) {
      v.fill((x, y, z) => {
        const r = hyp(x, z);
        if (y < 1) return r < 5.8 ? DARKS : -1;
        if (y < 2) return r < 5.2 ? (Math.cos(Math.atan2(x, z) * 8) > 0.85 && r > 4.2 ? BRIGHT : STEEL) : -1;   // the ring and its bolts
        if (y < 3) return r < 3.4 ? GUNMETAL : -1;
        return ab(x) > 3 && ab(x) < 4.2 && z > -1.6 && z < 2 && y < 7 ? GUNMETAL : -1;                         // the yoke
      });
    } },
  ];
  let gun;
  if (look === 'minigun') {
    gun = { name: 'gun', parent: 'yaw', pivot: [0, 6, 0], box: [-6, -4, -10, 6, 5, 6], paint(v) {
      v.box(-3, -3, -6, 3, 3, 5, GUNMETAL); v.box(-3, 3, -5, 3, 4, 3, STEEL);                            // the housing
      v.fill((x, y, z) => (z < -6 && z > -9.5 && hyp(x, y) < 2.6 ? (fl(z) & 1 ? DARKS : GUNMETAL) : -1));   // the motor
      v.box(3, -3, -4, 6, 2, 2, OLIVE); v.box(3, 2, -4, 6, 3, 2, OLIVE2); v.box(3, -1, 2, 4, 1, 4, DARKS);   // the ammo can and its feed
      v.box(-2, -4, -9, -1, -3, -6, HAZK); v.box(1, -4, -9, 2, -3, -6, HAZK);                            // grips
    } };
    parts.push(gun, { name: 'spin', parent: 'gun', pivot: [0, 0, 5], box: [-4, -4, 0, 4, 4, 22], paint(v) {
      v.fill((x, y, z) => {
        const r = hyp(x, y), a = Math.atan2(y, x);
        if ((z > 5 && z < 7) || (z > 15 && z < 17) || z > 20.5) return r < 3.6 ? (z > 20.5 ? DARKS : GUNMETAL) : -1;   // the clamps and the muzzle ring
        if (r < 0.8) return DARKS;
        return ab(r - 2.5) < 0.9 && Math.cos(6 * a) > 0.35 ? (z > 19 ? DARKS : BRIGHT) : -1;              // six barrels
      });
    } });
  } else if (look === 'scatter') {
    gun = { name: 'gun', parent: 'yaw', pivot: [0, 6, 0], box: [-6, -8, -8, 6, 5, 20], paint(v) {
      v.box(-3, -2, -7, 3, 3, 5, GUNMETAL); v.box(-3, 3, -6, 3, 4, 3, STEEL);
      for (const bx of [-3, 0]) v.fill((x, y, z) => (z > 4 && z < 19 && x > bx && x < bx + 3 && y > -1 && y < 2 ? (ab(x - bx - 1.5) < 0.6 && ab(y - 0.5) < 0.6 && z > 17 ? 0x0c0c0e : z > 17 ? DARKS : BRIGHT) : -1));   // two fat barrels
      v.box(-2, -3, 8, 2, -1, 13, DARKS);                                                                // the pump
      v.fill((x, y, z) => (hyp(x * 1.5, y + 5) < 3.2 && z > -4 && z < 3 ? (hyp(x * 1.5, y + 5) < 1 ? STEEL : OLIVE) : -1));   // the drum
      v.box(-2, -4, -8, -1, -2, -6, HAZK); v.box(1, -4, -8, 2, -2, -6, HAZK);
      v.box(-6, -3, 3, 6, 5, 4, ARMOUR); v.box(-6, 4, 3, 6, 5, 4, HAZ);                                  // the shield
    } };
    parts.push(gun);
  } else {
    gun = { name: 'gun', parent: 'yaw', pivot: [0, 6, 0], box: [-7, -4, -9, 7, 7, 27], paint(v) {
      v.box(-2, -2, -7, 2, 2, 5, GUNMETAL); v.box(-2, 2, -6, 2, 3, 3, STEEL); v.box(2, 0, -2, 3, 1, 0, DARKS);   // receiver, top cover, handle
      v.box(-2, -3, -9, -1, -2, -6, HAZK); v.box(1, -3, -9, 2, -2, -6, HAZK);                                  // spade grips
      v.box(-6, -2, -4, -2, 2, 2, OLIVE); v.box(-6, 1, -4, -2, 2, 2, OLIVE2); v.box(-6, -1, -4, -5, 0, 2, HAZ);   // the ammo can, its lid, a stencil
      v.fill((x, y, z) => {
        if (z > 5 && z < 14 && ab(x) < 2 && ab(y) < 2) return (ab(x) > 1 || ab(y) > 1) && (fl(z) & 1) ? DARKS : GUNMETAL;   // the cooling jacket
        if (z > 5 && z < 24 && ab(x) < 1 && ab(y) < 1) return BRIGHT;                                          // the barrel
        if (z > 23 && z < 26.5 && ab(x) < 2 && ab(y) < 2) return ab(x) < 1 && ab(y) < 1 && z > 25 ? 0x0c0c0e : DARKS;   // the muzzle brake
        if (z > 3 && z < 4 && ab(x) < 6.5 && y > -3 && y < 6) return y > 5 ? (((fl(x) >> 1) & 1) ? HAZ : HAZK) : y > 2 && y < 3 && ab(x) > 2 && ab(x) < 4 ? 0x0c0c0e : ARMOUR;   // the shield, its slit
        if (z > -3 && z < 0 && ab(x) < 0.6 && y > 3 && y < 5) return DARKS;                                    // the sight
        return -1;
      });
    } };
    parts.push(gun);
  }
  return parts;
}
function heavyParts(S, o, roofY, roofZ, zT) {
  const kind = o.secondary;
  if (kind === 'rockets') return [{ name: 'pod', parent: 'yaw', pivot: [6, 4, -2], box: [-1, -1, -6, 8, 8, 13], paint(v) {
    v.box(0, 0, -5, 7, 6, 11, OLIVE); v.box(0, 0, -5, 7, 1, 11, OLIVE2); v.box(0, 6, -3, 7, 7, 9, HAZ);
    for (let k = -3; k < 9; k += 2) v.box(0, 6, k, 7, 7, k + 1, HAZK);                              // the striped top
    v.box(-1, 2, -2, 0, 4, 4, GUNMETAL);                                                           // the arm to the mount
    for (const tx of [0.5, 3.5]) for (const ty of [0.5, 3.5]) v.fill((x, y, z) => (z > 10 && z < 12 && ab(x - tx - 1) < 1.5 && ab(y - ty - 1) < 1.5 ? (ab(x - tx - 1) < 0.6 && ab(y - ty - 1) < 0.6 ? TIP : DARKS) : -1));   // four tubes, a rocket in each
  } }];
  if (kind === 'cannon') return [{ name: 'pod', parent: 'yaw', pivot: [6, 4, 0], box: [-1, -1, -7, 6, 6, 32], paint(v) {
    v.box(0, 0, -6, 5, 5, 5, GUNMETAL); v.box(0, 5, -5, 5, 6, 3, HAZ); v.box(-1, 2, -2, 0, 4, 3, GUNMETAL);   // the breech, its stripe, the arm
    v.fill((x, y, z) => {
      const r = hyp(x - 2.5, y - 2.5);
      if (z > 4 && z < 10 && r < 2.2) return STEEL;                                                 // the recoil sleeve
      if (z > 4 && z < 28 && r < 1.3) return BRIGHT;                                               // the barrel
      if (z > 27 && z < 31 && r < 2.2) return r < 1 && z > 30 ? 0x0c0c0e : (fl(z) === 28 && r > 1.6 ? 0x0c0c0e : DARKS);   // the muzzle brake and its ports
      return -1;
    });
  } }];
  if (kind === 'mines') return [{ name: 'mines', parent: 'body', pivot: [0, S.c0 + 4, zT], box: [-9, -3, -7, 9, 8, 1], paint(v) {
    v.box(-8, 0, -6, 8, 1, 0, GUNMETAL); v.box(-8, 6, -6, 8, 7, 0, GUNMETAL);                     // the rack, top and bottom
    for (const x of [-8, -1, 0, 7]) v.box(x, 0, -6, x + 1, 7, -5, GUNMETAL);
    v.box(-8, 6, -1, 8, 7, 0, HAZ);
    for (const cx of [-4, 4]) v.fill((x, y, z) => {                                                 // two mines in the rack
      const r = hyp(x - cx, y - 3.5); if (z > -5 || z < -6 || r > 2.7) return -1;
      return r < 0.8 ? RED_GLOW : ((fl((Math.atan2(y - 3.5, x - cx) / PI + 1) * 3) & 1) ? HAZ : HAZK);
    });
    v.box(-3, -3, -7, 3, 0, -4, DARKS);                                                            // the chute
  } }];
  return [];
}
function frontParts(S, o, zN) {
  const kind = o.front, W = S.W, c0 = S.c0;
  const base = { name: 'front', parent: 'body', pivot: [0, c0, zN] };
  if (kind === 'plow') return [{ ...base, box: [-W - 2, -1, -2, W + 2, 12, 8], paint(v) {
    v.fill((x, y, z) => {
      const zf = 6.5 - y * 0.5 - ab(x) * 0.16;                                                      // a wedge, leaning back, swept back at the ends
      if (ab(x) > W + 1.2 || y > 9) return -1;
      if (z < zf && z > zf - 1.8 && z > 0) {
        if (y < 1) return DARKS;                                                                     // the blade's edge
        if (z > zf - 1 && y > 2 && y < 7.5) return ((fl((x + y * 1.2) / 3)) & 1) ? HAZ : HAZK;          // the hazard face
        return y > 8 ? STEEL : ARMOUR;
      }
      if (ab(ab(x) - 7) < 1 && y > 2 && y < 5 && z > -1.5 && z < zf - 1) return RUST[0];               // the brackets
      return -1;
    });
  } }];
  if (kind === 'spikes') return [{ ...base, box: [-W, -1, -2, W, 11, 14], paint(v) {
    v.box(-W + 1, 2, 0, W - 1, 5, 3, GUNMETAL); v.box(-9, 7, 0, 9, 9, 2, GUNMETAL);                 // the bars
    for (const x of [-9, 9]) v.box(x - 1, 2, 0, x + 1, 9, 2, GUNMETAL);
    const spike = (cx, cy, len) => v.fill((x, y, z) => { const t = (z - 2.5) / len, s = 1.7 * (1 - t); return t >= 0 && t < 1 && ab(x - cx) < s && ab(y - cy) < s ? (t > 0.7 ? BRIGHT : t < 0.15 ? DARKS : STEEL) : -1; });
    for (const cx of [-10, -5, 0, 5, 10]) spike(cx, 3.5, 10);
    for (const cx of [-6, 0, 6]) spike(cx, 8, 7);
  } }];
  if (kind === 'saws') {
    const sx = W - 3.5;
    const saw = (name, s) => ({ name, parent: 'front', pivot: [s * sx, 6, 6], box: [-1, -8, -8, 1, 8, 8], paint(v) {
      v.fill((x, y, z) => {
        if (x < -1 || x > 0) return -1;
        const r = hyp(y, z), a = Math.atan2(y, z), f = (((a / (2 * PI)) * 18) % 1 + 1) % 1;
        if (r < 1.4) return DARKS; if (r < 2.6) return GUNMETAL;
        if (r < 6) return ((fl(a * 3 / PI) & 1) && r > 3.4 && r < 5) ? STEEL : BRIGHT;
        return r < 7.6 && (r - 6) / 1.6 < f ? BRIGHT : -1;                                          // the teeth
      });
    } });
    return [{ ...base, box: [-W, -1, -2, W, 10, 8], paint(v) {
      v.box(-W + 1, 1, 0, W - 1, 3, 2, GUNMETAL);                                                   // the bar
      for (const s of [1, -1]) { const x0 = s > 0 ? sx - 3 : -sx + 1; v.box(x0, 3, 0, x0 + 2, 6, 6, GUNMETAL); v.box(x0, 5, 1, x0 + 2, 7, 4, HAZ); }   // the motor housings
    } }, saw('sawL', 1), saw('sawR', -1)];
  }
  return [{ ...base, box: [-W, 0, -1, W, 10, 4], paint(v) {                                         // a steel push bar
    v.box(-W + 2, 1, 0, W - 2, 3, 2, GUNMETAL); v.box(-7, 7, 0, 7, 9, 2, GUNMETAL);
    for (const x of [-7, 5]) v.box(x, 1, 0, x + 2, 9, 2, GUNMETAL);
    for (const x of [-W + 2, W - 4]) v.box(x, 1, 2, x + 2, 3, 3, PLASTIC);
  } }];
}

// ---- the clips ----
const CLIPS = {
  Race: { loop: true, pose: (t, u) => {
    const s = u.state, a = s.spin || 0, st = s.steer || 0;
    return {
      wFL: [a, st, 0], wFR: [a, st, 0], wRL: [a, 0, 0], wRR: [a, 0, 0],
      body: [s.pitch || 0, 0, s.roll || 0, 0, s.bob || 0, 0],
      yaw: [0, s.yaw || 0, 0], gun: [-(s.aim || 0), 0, 0], pod: [-(s.aim || 0) * 0.85 - 0.04, 0, 0],
      spin: [0, 0, s.gunSpin || 0], sawL: [s.saw || 0, 0, 0], sawR: [s.saw || 0, 0, 0],
    };
  } },
  // blown up: it jumps, lands on burst tyres leaning on one corner, and that corner's wheel rolls away
  Wreck: { loop: false, dur: 3, pose: (t, u) => {
    const sd = u.state.side || 1, hop = Math.max(0, 11 * t - 24 * t * t), e = ease(clamp(t / 0.45)), roll = clamp(t / 1.2), fall = ease(clamp((t - 0.5) / 0.6));
    const P = {
      body: [0.05 * e, 0.12 * sd * e, -0.08 * sd * e, 0, hop - 0.55 * e, 0],
      wFL: [0, 0.15 * e, -0.3 * e, 0, 0.4 * e, 0], wFR: [0, -0.15 * e, 0.3 * e, 0, 0.4 * e, 0], wRL: [0, -0.1 * e, -0.25 * e, 0, 0.4 * e, 0], wRR: [0, 0.1 * e, 0.25 * e, 0, 0.4 * e, 0],
    };
    P[sd > 0 ? 'wFL' : 'wFR'] = [7 * roll, 0, sd * (PI / 2) * fall, sd * 5 * roll, -0.4 * fall + 1.6 * roll * (1 - roll), 2.5 * roll];
    return P;
  } },
};

// The definition of a car for a build: the Unit def, plus its size for the driving code and where its guns fire from.
export function carDef(load, seed = 0) {
  const P = (slot) => PARTS[slot][load[slot]] || Object.values(PARTS[slot])[0];
  const S = SHAPES[P('body').shape] || SHAPES.hatch, W0 = WHEELS[P('wheels').look] || WHEELS.street;
  const R = W0.R > 3 ? W0.R : S.R + W0.R, lift = W0.R > 3 ? Math.round(R - S.R - 1) : 0;
  const wk = { ...W0, R, lift };
  const o = { ...load, seed };
  const zN = S.L / 2, zT = -S.L / 2, look = P('armour').look;
  const roofY = S.roof + (look >= 2 ? 1 : 0), roofZ = Math.round((S.rr + S.fr) / 2);
  const parts = [
    bodyPart(S, o, wk),
    wheelPart('wFL', 1, S.ax[0], S, wk, P('wheels').look), wheelPart('wFR', -1, S.ax[0], S, wk, P('wheels').look),
    wheelPart('wRL', 1, S.ax[1], S, wk, P('wheels').look), wheelPart('wRR', -1, S.ax[1], S, wk, P('wheels').look),
    ...gunParts(S, o, roofY, roofZ), ...heavyParts(S, o, roofY, roofZ, zT), ...frontParts(S, o, zN),
  ];
  const fd = FRONT_DEPTH[load.front] ?? 3, rear = load.secondary === 'mines' ? 7 : 1;
  const nose = (zN + fd) * H, tail = (zT - rear) * H, outer = Math.max(S.W, S.W - wk.out);
  const dims = {
    half: (nose - tail) / 2, mid: (nose + tail) / 2, wide: outer * H, top: (roofY + lift + 2) * H, roof: (roofY + lift) * H,
    wheelR: R * H, lift: lift * H, length: nose - tail,
  };
  const M = { mg: [0, 0, 26.5], minigun: [0, 0, 27], scatter: [0, 0.5, 19] }[P('primary').look] || [0, 0, 26];
  const muzzles = { gun: M.map((v) => v * H), pod: load.secondary === 'cannon' ? [2.5 * H, 2.5 * H, 31 * H] : load.secondary === 'mines' ? [0, 0, -7 * H] : [3.5 * H, 3 * H, 12 * H], podBone: load.secondary === 'mines' ? 'mines' : 'pod' };
  return {
    kind: 'combat-car', h: H, dieAt: 5, start: 'Race', inner: INNER, clips: CLIPS, parts: () => parts, dims, muzzles,
    onKill(u, point, r, debris) { u.state.side = hash(seed, 2, 9, 4) < 0.5 ? 1 : -1; u.wreck(debris, 0.06, 16); u.play('Wreck', 0.05); },
  };
}
// the parts a car loses when it is wrecked: they are blown clear
export const LOOSE = ['yaw', 'gun', 'spin', 'pod', 'mines', 'front', 'sawL', 'sawR'];
