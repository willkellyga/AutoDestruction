// A carrier attack jet, built in code at eighth-metre cubes on the army's kit: 72 cubes long (9 m), 60 across the wings
// (28 with them folded), a little shorter than the army helicopter. Twin engines, twin fins, a bubble canopy, intakes
// under the wing roots, rocket pods and missiles under the wings, a gun in the nose.
//
// x is across (port is +x), y is up from the deck its wheels stand on, z is along with the nose at +z.
//
// It exists twice. As a Unit (JET) it flies: the outer wings fold on hinges, the gear retracts, the burners light, the gun
// flashes. As a still model (jetStatic) it is painted into a part of the carrier, wings folded, so that it breaks with
// her: goes over the side when she lists, is pressed into the deck by a foot. The two are the same cubes: a deck jet
// that launches is swapped for a Unit standing exactly where it stood. That is why the wings fold a clean quarter turn
// and every pivot is a whole number of cubes.
import { GLOW, hash, tone } from '../../units/src/voxpart.js';
import { H, clamp, ease, GLASS, GLASS2, SHINE, INNER } from './cars.js';

const S = Math.sin, PI = Math.PI, ab = Math.abs, fl = Math.floor, hyp = Math.hypot;
const TOP = 0x8f979e, BOT = 0xb9c0c5, RADOME = 0x596068, NOZ = 0x2a2c30, PANEL = 0x3a3f46, FRAME = 0x33373d, WHITE = 0xe4e2d8, POD = 0x6a7350, TYRE = 0x17181b, STRUT = 0xc9ccd0, STRIP = 0xc8d08a;
const RED_L = 0xff3a30 | GLOW, GREEN_L = 0x35e06a | GLOW, FIRE1 = 0xfff0b0 | GLOW, FIRE2 = 0xff9a2e | GLOW, FIRE3 = 0x8fc4ff | GLOW;
export const JET_TINT = { gold: 0xd8a52a, red: 0xb8322a, blue: 0x2a5fae, green: 0x2f8257 };
export const JET_HINGE = [13, 12, -8];   // the wing fold: a line fore and aft through this point

const skin = (x, y, z, seed) => tone(y < 9.6 ? BOT : TOP, (0.95 + 0.1 * hash(fl(x), fl(y), fl(z / 2), seed)) * (y > 9.6 && (ab(z - 5.5) < 0.5 || ab(z + 9.5) < 0.5 || ab(z + 24.5) < 0.5) ? 0.88 : 1));

// The body: fuselage, canopy, intakes, inner wings and what hangs under them, tailplanes, fins, nozzles.
function bodyAt(x, y, z, seed, tint) {
  const ax = ab(x), sk = () => skin(x, y, z, seed);
  if (z > 7 && z < 23.6 && y > 13.2) {                                                              // the canopy, in its frame
    const e = hyp(x / 2.9, (y - 13.2) / 4.1, (z - 15) / 8.6);
    if (e < 1) return (e > 0.74 && y < 14.2) || ab(z - 16.5) < 0.5 || z < 9.2 ? FRAME : z > 17 && y > 15 && ax < 1 ? SHINE : y > 15.2 ? GLASS2 : GLASS;
  }
  if (z >= 24) {                                                                                    // the nose and its radome, the gun port on the port side
    const t = (z - 24) / 12.6; if (t >= 1) return -1;
    if (hyp(x, y - (10.4 - 0.3 * t)) >= 3.4 * Math.pow(1 - t, 0.7)) return -1;
    return z > 31 ? RADOME : x > 1 && x < 3 && y > 12 && y < 13 && z < 28 ? NOZ : y > 12.6 ? PANEL : sk();
  }
  if (z >= -24) { const W = z > 6 ? 3.6 : 3.6 + 2 * clamp((6 - z) / 6); if (Math.pow(ax / W, 4) + Math.pow(ab(y - 10.4) / 3.3, 4) < 1) return y > 13 && z > 22 ? PANEL : sk(); }
  else if (z >= -34) { if (hyp(ax - 3.5, y - 10) < 3.3 || (ax < 3.5 && ab(y - 10.2) < 1.8)) return z < -31 ? 0x4a4f56 : sk(); }   // the engines, side by side
  else if (z >= -37) { const r = hyp(ax - 3.5, y - 10); return r < 2.9 && r > 1.5 ? NOZ : -1; }       // nozzles
  if (z > -16 && z <= 8 && ax < 2.3 && y >= 13 && y < 13.7 + 2.2 * clamp((z + 16) / 22)) return sk();   // the spine behind the canopy
  if (z > -26 && z < 9.5 && y >= 7 && y < 12.4) {                                                    // intake trunks: a raked lip, dark inside
    const out = z > -6 ? 8.2 : 8.2 - 1.8 * clamp((-6 - z) / 16), lip = 9.5 - (12.4 - y) * 0.45;
    if (ax < out && z < lip) return z > lip - 1.6 && ax > 4.4 && ax < out - 0.9 && y > 8 && y < 11.4 ? 0x15161a : z > lip - 1.2 ? 0xb8322a : sk();
  }
  if (z >= 4 && z < 22 && y >= 12 && y < 13 && ax < 3.6 + (22 - z) * 0.3) return tone(TOP, 0.82);     // the wing root running forward beside the canopy
  if (ax >= 5 && ax < 13 && y >= (ax < 10 ? 11 : 12) && y < 13) {                                     // the inner wing
    const le = 6 - (ax - 5.5) * 0.62, te = -18 + (ax - 5.5) * 0.05;
    if (z < le && z > te) return z < te + 3 ? tone(TOP, 0.86) : sk();
  }
  if (ax >= 10 && ax < 12 && z >= -13 && z < -3 && y >= 9.4 && y < 12) return PANEL;                  // a pylon and a rocket pod
  if (z >= -15 && z < 0 && hyp(ax - 11, y - 8) < 1.75) return z > -1.2 ? NOZ : z < -13.8 ? PANEL : POD;
  if (ax >= 5 && ax < 13 && y >= 10 && y < 11 && z > -35 + (ax - 5) * 0.2 && z < -23 - (ax - 5) * 0.8) return sk();   // tailplanes
  if (y >= 12.5 && y < 26 && z < -13 - (y - 13) * 0.8 && z > -27 - (y - 13) * 0.25 && ab(ax - 4.6 - (y - 13) * 0.32) < 0.75) return y > 23.5 ? tint : y > 17 && y < 18 && z < -20 ? STRIP : sk();   // fins, leaning out
  return -1;
}
// An outer wing panel, in its own frame: lx out from the hinge, ly up, lz along. The port one; the starboard is its mirror.
function wingAt(lx, ly, lz, side, seed) {
  if (lx >= 16 && lx < 17 && ly >= 0 && ly < 1 && lz >= -10 && lz < 5) return lz > 3 ? RADOME : WHITE;   // the missile on its tip
  if (lx >= 16 && lx < 17 && ly >= -1 && ly < 2 && lz >= -10 && lz < -8) return WHITE;
  if (lx < 0 || lx >= 16 || ly < 0 || ly >= 1) return -1;
  const ax = 13 + lx, le = 14 - (ax - 5.5) * 0.62, te = -10 + (ax - 5.5) * 0.05;
  if (lz >= le || lz <= te) return -1;
  if (lx >= 15) return lz > le - 2 ? (side > 0 ? RED_L : GREEN_L) : PANEL;                              // the rail, a lamp at its front
  return lz < te + 3 ? tone(TOP, 0.86) : skin(ax * side, 12.5, lz - 8, seed);
}
// Landing gear, each in its own frame with the top of the leg at the origin: a leg, an axle, two wheels (or one).
const wheel = (y, z, r) => { const d = hyp(y, z); return d < r ? (d < r - 1.2 ? STRUT : TYRE) : -1; };
const noseGear = (x, y, z) => (ab(x) < 1 && y < 0 && y >= -5 && z >= 0 && z < 1 ? STRUT : ab(x) < 1 && y >= -6 && y < -5 && z >= 0 && z < 1 ? PANEL : ab(x) >= 1 && ab(x) < 2 && y < -3.4 ? wheel(y + 5.5, z - 0.5, 1.7) : -1);
const mainGear = (x, y, z) => (ab(x) < 1 && y < 0 && y >= -4 && z >= 0 && z < 1 ? STRUT : ab(x) < 1 && y < -2.6 ? wheel(y + 5, z, 2.15) : -1);

// The whole jet as a still model, wings folded or spread, for a part of something else. fill gives the cube centres
// relative to the pivot, which is on the deck under the jet's middle. dir turns it a quarter at a time: 0 nose forward
// (+z), 1 aft, 2 to port (+x), 3 to starboard.
export function jetStatic(g, { dir = 0, folded = true, seed = 0, tint = JET_TINT.gold } = {}) {
  g.fill((X, Y, Z) => {
    const x = dir === 0 ? X : dir === 1 ? -X : dir === 2 ? -Z : Z, z = dir === 0 ? Z : dir === 1 ? -Z : dir === 2 ? X : -X, y = Y, ax = ab(x), s = x >= 0 ? 1 : -1;
    let c = bodyAt(x, y, z, seed, tint); if (c >= 0) return c;
    c = noseGear(x, y - 7, z - 20); if (c >= 0) return c;
    c = mainGear(ax - 7, y - 7, z + 8); if (c >= 0) return c;
    return folded ? wingAt(y - JET_HINGE[1], JET_HINGE[0] - ax, z - JET_HINGE[2], s, seed) : wingAt(ax - JET_HINGE[0], y - JET_HINGE[1], z - JET_HINGE[2], s, seed);
  });
}
// the box a still jet needs, for the same dir
export const jetBox = (dir, folded = true) => { const w = folded ? 15 : 31; return dir < 2 ? [-w, 0, -38, w, 30, 38] : [-38, 0, -w, 38, 30, w]; };

function jetParts(o) {
  const seed = o.seed || 0, tint = JET_TINT[o.paint] ?? JET_TINT.gold, [hx, hy, hz] = JET_HINGE;
  const flame = (g) => g.fill((x, y, z) => { const r = hyp(x - 0.5, y), k = -z / 12; return r < 2.4 * (1 - k) ? (r < 1.1 * (1 - k) && k < 0.7 ? FIRE1 : k < 0.25 ? FIRE3 : FIRE2) : -1; });
  return [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-17, 6, -38, 17, 27, 38], paint: (g) => g.fill((x, y, z) => bodyAt(x, y, z, seed, tint)) },
    { name: 'wingL', parent: 'body', pivot: [hx, hy, hz], box: [0, -1, -12, 17, 2, 15], paint: (g) => g.fill((x, y, z) => wingAt(x, y, z, 1, seed)) },
    { name: 'wingR', parent: 'body', pivot: [-hx, hy, hz], box: [-17, -1, -12, 0, 2, 15], paint: (g) => g.fill((x, y, z) => wingAt(-x, y, z, -1, seed)) },
    { name: 'gearN', parent: 'body', pivot: [0, 7, 20], box: [-2, -8, -2, 2, 0, 3], paint: (g) => g.fill(noseGear) },
    { name: 'gearL', parent: 'body', pivot: [7, 7, -8], box: [-1, -8, -3, 1, 0, 3], paint: (g) => g.fill(mainGear) },
    { name: 'gearR', parent: 'body', pivot: [-7, 7, -8], box: [-1, -8, -3, 1, 0, 3], paint: (g) => g.fill(mainGear) },
    { name: 'flameL', parent: 'body', pivot: [3, 10, -36], box: [-2, -3, -12, 3, 3, 0], paint: flame },
    { name: 'flameR', parent: 'body', pivot: [-4, 10, -36], box: [-2, -3, -12, 3, 3, 0], paint: flame },
    { name: 'flash', parent: 'body', pivot: [2, 12, 28], box: [-1, -1, 0, 2, 2, 7], paint: (g) => g.fill((x, y, z) => (hyp(x - 0.5, y - 0.5) < 1.5 * (1 - z / 7) + 0.3 ? (z < 3 ? FIRE1 : FIRE2) : -1)) },
  ];
}

const OFF = [0, 0, 0, 0, 0, 0, 0], FOLD = PI / 2;
const gearUp = (e) => [1.35 * e, 0, 0, 0, 1.6 * e, 0, e >= 1 ? 0 : 1];
const burn = (t, k, ph = 0) => (k <= 0.02 ? OFF : [0, 0, t * 9 + ph, 0, 0, 0, k * (0.86 + 0.14 * S(t * 47 + ph))]);
const flying = (t, u, power) => ({ body: [0.012 * S(t * 2.1 + u.phase), 0, 0.02 * S(t * 1.3 + u.phase), 0, 0.3 * S(t * 1.7 + u.phase), 0], gearN: gearUp(1), gearL: gearUp(1), gearR: gearUp(1), flameL: burn(t, power), flameR: burn(t, power, 2), flash: OFF });
export const JET = {
  kind: 'jet', h: H, parts: jetParts, start: 'Parked', dieAt: 0.1, inner: INNER, altitude: 60,
  clips: {
    // on deck, wings folded, engines cold
    Parked: { loop: true, speed: 0, pose: () => ({ wingL: [0, 0, FOLD], wingR: [0, 0, -FOLD], flameL: OFF, flameR: OFF, flash: OFF }) },
    // on the catapult: the wings come down, the burners light, it squats on its nose leg; then it is thrown off the bow
    // and the gear comes up. Whoever plays this moves it: see `launch` in the viewer.
    Launch: { loop: false, dur: 4.6, speed: 0, pose: (t, u) => {
      const w = ease(clamp(t / 1.0)), b = clamp((t - 0.7) / 0.7), g = ease(clamp((t - 3.3) / 1.0)), squat = b * (t < 1.9 ? 1 : 0);
      return { body: [0.02 * squat, 0, 0, 0, -0.25 * squat + (b > 0 && t < 1.9 ? 0.06 * S(t * 60) : 0), 0], wingL: [0, 0, FOLD * (1 - w)], wingR: [0, 0, -FOLD * (1 - w)], gearN: gearUp(g), gearL: gearUp(g), gearR: gearUp(g), flameL: burn(t, 1.3 * b), flameR: burn(t, 1.3 * b, 2), flash: OFF };
    } },
    Fly: { loop: true, speed: 70, pose: (t, u) => flying(t, u, 0.75) },
    // the gun: short bursts
    Fire: { loop: true, speed: 70, pose: (t, u) => ({ ...flying(t, u, 0.9), flash: [0, 0, t * 40, 0, 0, 0, (t * 15) % 1 < 0.5 ? 1.5 : 0] }) },
    // shot down: the engines die, a wing folds back on its hinge, it rolls. Whoever plays this drops it.
    Crash: { loop: false, hidden: true, dur: 4, speed: 0, pose: (t, u) => ({ body: [0, 0, 0, 0, 0, 0], wingL: [0, 0, 0.9 * clamp(t * 2)], gearN: gearUp(1), gearL: gearUp(1), gearR: gearUp(1), flameL: OFF, flameR: OFF, flash: OFF }) },
  },
  onKill(u) { u.play('Crash', 0.05); },
};
