// Sturdier buildings. The town's destruction (src/sim.js) is used as it is; this asks less of it, from the derby's side,
// with the knobs in tuning.js BUILDINGS:
//   toughen()   once the map is built: fire spreads slower and leaves more of what it burns standing as charred
//               blocks, a wall bridges a wider hole before what is over it falls, and a storey stands with more of
//               its walls knocked out
//   boom()      the town's explode(), with the part that breaks buildings smaller and tougher at its edge than the
//               flash, the fire and the blast on the cars round it
//   chipAt()    a round from a gun knocks out the one block it strikes
// Lamp posts, bins, fences and rubble go down as easily as ever, and what the cars and the zombies take is not touched.
import { bodies, solid, CARRY, CHARP, FLAM } from '../../src/world.js';
import { hooks, cfg, blast, pushDebris, fire, sparks, dust, smoke, flash, ring, blowGlass, igniteAt } from '../../src/sim.js';
import { BUILDINGS as K } from './tuning.js';

// what any blast still takes in full
export const EASY = { prop: true, rubble: true };

let done = false;
export function toughen() {
  if (done) return; done = true;
  // fire: slower to spread, fewer blocks alight at once, and walls, floors and roofs mostly char rather than vanish
  cfg.burnCap = K.burnCap;
  for (let m = 0; m < FLAM.length; m++) {
    FLAM[m] *= K.spread;
    if (CARRY[m] && CHARP[m] > 0) CHARP[m] = Math.max(CHARP[m], K.char);
  }
  for (let i = 1; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b || b.kind === 'rubble' || !b.dCarry) continue;
    // A storey gives way once it has lost a share of the load-bearing blocks it was built with (sim.js checkBody,
    // against b.dCarry). Counting it as built with fewer, it stands until more are gone.
    if (K.carry !== 1) b.dCarry = Float64Array.from(b.dCarry, (v) => v * K.carry);
    // A block falls once its way down to the ground runs more than 4 blocks further sideways than it did when the body
    // was whole (b.span0, filled in the first time anything is taken from the body). Each way down is counted as
    // `slack` blocks longer as it is filled in, so a wall bridges a wider hole: a car-sized hole no longer drops the
    // strip of wall over it to the roof. What nothing reaches still falls.
    if (K.slack > 0) slacken(b);
  }
}
function slacken(b) {
  let s0 = b.span0 || null;
  Object.defineProperty(b, 'span0', {
    configurable: true, enumerable: true,
    get: () => s0,
    set: (v) => {
      if (v && v !== s0) for (let l = 0; l < v.length; l++) { const d = v[l]; if (d < 255) v[l] = d + K.slack > 254 ? 254 : d + K.slack; }
      s0 = v;
    },
  });
}

// An explosion: the town's explode() (src/sim.js) as it is, but buildings are broken only out to `k` of its reach (and
// their blocks at the edge of that hold better), while lamps, bins and rubble take the whole of it. The flash, smoke,
// scorch mark, shake and the blast on the cars and zombies round it (hooks.explosion) are the full size.
export function boom(x, y, z, r, shake = 0.5, o = {}, k = K.shell) {
  blast(x, y, z, r * k, { push: 40, core: 0.55, maxDebris: o.maxDebris ?? 460, tough: 0.4 * K.tough });
  if (k < 1) blast(x, y, z, r, { only: EASY, push: 40, core: 0.55, maxDebris: 60, tough: 0.4, pushDebris: false });
  pushDebris(x, y, z, r * 2.4, 48, 0.8);
  fire(x, y + 2, z, 60, r); sparks(x, y + 2, z, 36, 1, 0.8, 0.3);
  dust(x, y + 2, z, 18, r * 1.8, 0.25, 0.23, 0.22);
  smoke(x, y + 4, z, 14, r * 0.6);
  flash(x, y + 4, z, r); ring(x, 0.5, z, r * 3.2, 0xfff0d0, 0.5);
  if (cfg.glass) blowGlass(x, y, z, r * 3.4 * K.glass, 90);
  if (cfg.expFire && cfg.fireSpread && o.fire !== false) igniteAt(x, y, z, r * 1.25, 0.3 * K.ignite);
  hooks.scorch(x, z, r * 1.5); hooks.shake(shake, x, y, z); hooks.sound('boom', 1, x, y, z);
  hooks.impact(o.impact ?? 0.7);
  hooks.explosion(x, y, z, r);
}

// A round from a gun has struck a wall at p, going along dir: some of the time, it knocks out the block it struck (and
// with a big enough `wall`, the blocks round it). The town's own hit was a blast at a point a little short of the wall,
// which took two or three blocks, or none, depending on where the round met the block.
export function chipAt(p, dir, wall) {
  if (Math.random() >= K.gunHit) return 0;
  for (let t = 0; t <= 1.6; t += 0.2) {
    const x = Math.floor(p.x + dir.x * t), y = Math.floor(p.y + dir.y * t), z = Math.floor(p.z + dir.z * t);
    if (solid(x, y, z)) return blast(x + 0.5, y + 0.5, z + 0.5, wall * K.gun, { push: 6, maxDebris: 5, core: 0.2, pushDebris: false });
  }
  return 0;
}
