// The combat cars, built in code on the army's cube kit (../../units/src) at a sixth of a town voxel (h = 1/6): three
// times as fine each way as Monster Mayhem's street cars. One builder makes every car from a build (parts.js): five
// bodies (carshapes.js), four sets of wheels, four armour levels, three main guns, three roof weapons, three door
// weapons, three heavy weapons, four fronts and six paint jobs.
//
// Coordinates are whole cubes. Left is +x, forward is +z, the ground is y = 0. A cube (i, j, k) fills i..i+1, j..j+1,
// k..k+1, so its centre is (i + 0.5, j + 0.5, k + 0.5) and the car is symmetric about x = 0. Wheels, the turret and its
// guns, the roof and door weapons, the heavy weapon and the front ram are parts of their own, on bones, so they turn,
// spin and pitch, and can be blown off.
import { GLOW, hash } from '../../units/src/voxpart.js';
import { PARTS } from './parts.js';
import { enginePart } from './engines.js';
import {
  SHAPES, bodyPart, clamp, ease, INNER, CHROME, CHROMEL, CHROMED, PLASTIC, HOLE, GUNMETAL, STEEL, BRIGHT, DARKS, ARMOUR, ARMOUR2, RIVET,
  RUST, HAZ, HAZK, OLIVE, OLIVE2, TIP, RED_GLOW, RUBBER,
} from './carshapes.js';

export const H = 1 / 6;
const PI = Math.PI, ab = Math.abs, fl = Math.floor, hyp = Math.hypot;

const TYRE = 0x222326, TYRE2 = 0x2c2d31, WALL = 0x1b1c1f, RIM = 0xb4b9c1, RIMD = 0x3a3d43, HUB = 0xdfe3e8, DRUM = 0x2a2b2f, DISC = 0x5b5f66, CALIPER = 0xc23b2e, GOLD = 0xc9a23a;
const WOOD = 0x7a4a26, WOOD2 = 0x6a3e1f, FUEL = 0xb8321e, FUEL2 = 0xd24a2e, PILOT = 0x6fb8ff | GLOW, MISSILE = 0xe4e0d6, MISSILE2 = 0xf2efe8, LOCK = 0xff3a2a | GLOW;
// the mortar's tube: how far it leans up from level, and its length in cubes (main.js fires its shells from the end)
export const MORTAR_UP = 0.95, MORTAR_LEN = 13;
const WHITE = 0xe6e3da, STEELW = 0xd4d2c8, COPPER = 0xc8763c, COPPER2 = 0x93502a, CERAMIC = 0xe4e0d6, CERAMIC2 = 0xb9b4a8, ARC = 0x9fe3ff | GLOW;

// the wheels: radius (0 for the body's own, a little more, or a size of their own), width in cubes, depth of the tyre,
// how far the outer face sits inside the body
const WHEELS = {
  street: { R: 0, w: 6, tread: 3, out: 1 },
  offroad: { R: 0.9, w: 8, tread: 3.9, out: 0, blocks: 26 },
  slicks: { R: 0, w: 8, tread: 2.4, out: 0, slick: true },
  monster: { R: 16, w: 12, tread: 5.2, out: -9, blocks: 20 },
};
// how deep each front sticks out past the bumper, in cubes
const FRONT_DEPTH = { bumper: 5, plow: 11, spikes: 20, saws: 17 };
// street wheels suit their car: alloys on the hatch, whitewalls and covers on the wagon, slotted mags on the muscle
// car, chrome-ringed steel on the pickup, plain steel with a small cap on the van
const STREET = { hatch: 'alloy', wagon: 'cover', muscle: 'mag', pickup: 'rally', van: 'steel', buggy: 'offroad', wedge: 'alloy', bus: 'steel', offroad: 'rally', yacht: 'cover', rig: 'steel' };

// ---- wheels ----
function wheelPart(name, s, z, S, wk, kind) {
  const R = wk.R, w = wk.w, hw = w / 2, x = s * (S.W - wk.out - hw), Rc = Math.ceil(R), rr = R - wk.tread;
  const style = kind === 'street' ? STREET[S.kind] : kind;
  // the face of the rim, one cube in from the tyre's wall: a colour, or -1 for a hole
  const face = (r, a) => {
    switch (style) {
      case 'alloy': { if (r < 1.6) return HUB; if (r > rr - 1.4) return RIM; const ha = (((a / (2 * PI)) * 7) % 1 + 1) % 1; return hyp((ha - 0.5) * 2 * PI * rr * 0.55, r - rr * 0.55) < rr * 0.2 ? -1 : RIM; }
      case 'cover': return r < 1.8 ? CHROMEL : Math.cos(18 * a + r * 0.7) > 0.3 ? CHROME : CHROMED;
      case 'mag': { if (r < 1.8) return CHROMEL; if (r > rr - 1.3) return CHROME; return r > rr * 0.32 && r < rr * 0.78 && Math.cos(5 * a) > 0.62 ? -1 : CHROME; }
      case 'rally': { if (r < 2.2) return CHROMEL; if (r > rr - 1.6) return CHROME; return r > rr * 0.45 && r < rr * 0.7 && Math.cos(6 * a) > 0.8 ? -1 : RIMD; }
      case 'steel': { if (r < rr * 0.42) return r < 1.2 ? HUB : CHROME; return r > rr * 0.55 && r < rr * 0.75 && Math.cos(8 * a) > 0.75 ? -1 : STEELW; }
      case 'offroad': return r < 1.6 ? HUB : r > 3.2 && r < rr - 1.8 && Math.cos(6 * a) > 0.55 ? -1 : r > rr - 1.4 ? (Math.cos(a * 16) > 0.8 ? BRIGHT : GUNMETAL) : RIMD;
      case 'slicks': return r < 1.5 ? HUB : r > rr - 1.2 ? GOLD : Math.cos(10 * a) > 0.2 ? GOLD : -1;
      default: return r < 3.6 ? (r < 2 ? HUB : CHROMED) : r > rr - 1.8 ? (Math.cos(a * 14) > 0.75 ? BRIGHT : CHROMED) : Math.cos(8 * a) > 0.4 ? CHROME : RIMD;   // monster chrome with a beadlock ring
    }
  };
  return { name, parent: 'body', pivot: [x, R - wk.lift, z], box: [-hw, -Rc, -Rc, hw, Rc, Rc], paint: (g) => g.fill((px, py, pz) => {
    const r = hyp(py, pz), xo = px * s, shoulder = ab(px) > hw - 1;
    if (r > R - (shoulder ? 0.8 : 0)) return -1;
    const a = Math.atan2(py, pz), outer = xo > hw - 1, inner = xo < -hw + 1, second = !outer && xo > hw - 2;
    if (r > R - 1.3) {   // the tread
      const u = (a / (2 * PI) + 0.5);
      if (wk.blocks) { const seg = fl(u * wk.blocks); return ((seg + (xo > 0 ? 0 : 1)) & 1) || ab(xo) < 1.5 ? TYRE2 : r > R - 0.7 ? -1 : TYRE; }
      if (wk.slick) return TYRE;
      return ab(xo) < 0.6 || ((fl(u * 60) & 1) && !shoulder && ab(xo) > 1.6) ? TYRE2 : TYRE;   // a groove round the middle, sipes
    }
    if (r > rr) {        // the wall
      if (outer) {
        if (wk.slick && r < rr + 1) return HAZ;
        if (style === 'cover' && r > rr + 0.7 && r < rr + 2.1) return WHITE;
        if (style === 'mag' && r > rr + 1.2 && r < rr + 2.1 && (fl(a * 9) & 1)) return WHITE;
        return WALL;
      }
      return inner ? WALL : TYRE;
    }
    if (r > rr - 1) return outer ? (style === 'cover' || style === 'mag' || style === 'rally' || style === 'monster' ? CHROMEL : RIM) : RIM;   // the rim's lip and barrel
    if (inner) return RIMD;
    if (outer) return style === 'cover' || (r < 1.4 && style !== 'slicks') ? face(r, a) : -1;   // a cap stands out from the dished face
    if (second) return face(r, a);
    if (r < rr - 2.4 && ab(a - 0.8) < 0.3 && xo > -hw + 2) return CALIPER;   // a brake disc and its caliper behind the spokes
    return xo > -hw + 2.5 ? DISC : DRUM;
  }) };
}

// ---- the turret and its guns ----
// ty, tz: where the turret ring sits on the roof; ped: how far its post goes down to the roof
function gunParts(o, ty, tz, ped) {
  const look = PARTS.primary[o.primary] ? PARTS.primary[o.primary].look : 'mg';
  const parts = [
    { name: 'yaw', parent: 'body', pivot: [0, ty, tz], box: [-9, -ped, -9, 9, 15, 9], paint(v) {
      v.fill((x, y, z) => {
        const r = hyp(x, z), a = Math.atan2(x, z);
        if (y < 0) return r < (y < -ped + 1.5 ? 5.6 : 4.4) ? (y < -ped + 1.5 ? DARKS : fl(-y) % 4 === 2 ? STEEL : Math.cos(a * 6) > 0.9 ? STEEL : GUNMETAL) : -1;   // the post: a foot, bands
        if (y < 1.5) return r < 8.7 ? DARKS : -1;
        if (y < 3) return r < 7.9 ? (Math.cos(a * 12) > 0.86 && r > 6.4 ? BRIGHT : STEEL) : -1;           // the ring and its bolts
        if (y < 4.5) return r < 5.2 ? GUNMETAL : -1;
        return ab(x) > 4.4 && ab(x) < 6.2 && z > -2.8 && z < 3.2 && y < 10.6 ? (y > 9.6 && ab(z) < 1 ? BRIGHT : GUNMETAL) : -1;   // the yoke and its trunnions
      });
    } },
  ];
  if (look === 'minigun') {
    parts.push({ name: 'gun', parent: 'yaw', pivot: [0, 9, 0], box: [-9, -6, -15, 9, 8, 9], paint(v) {
      v.box(-4, -4, -9, 4, 4, 8, GUNMETAL); v.box(-4, 4, -7, 4, 5, 5, STEEL); v.box(-4, -4, -9, 4, -3, 8, DARKS);   // the housing
      v.box(-1, 5, -4, 1, 7, -2, DARKS); v.box(-1, 5, 2, 1, 7, 3, DARKS);                                                // the sight
      v.fill((x, y, z) => (z < -9 && z > -14 && hyp(x, y) < 3.6 ? (fl(z) & 1 ? DARKS : GUNMETAL) : -1));             // the motor
      v.box(4, -4, -6, 9, 3, 3, OLIVE); v.box(4, 3, -6, 9, 4, 3, OLIVE2); v.box(4, -2, -5, 9, -1, 2, HAZ);               // the ammo can and its stencil
      v.fill((x, y, z) => (x > 1 && x < 4 && y > -2 && y < 1 && z > 3 && z < 7 ? ((fl(z) & 1) ? HAZ : DARKS) : -1));   // the belt feed
      v.box(-3, -6, -14, -1, -4, -9, HAZK); v.box(1, -6, -14, 3, -4, -9, HAZK);                                          // grips
    } }, { name: 'spin', parent: 'gun', pivot: [0, 0, 7.5], box: [-6, -6, 0, 6, 6, 33], paint(v) {
      v.fill((x, y, z) => {
        const r = hyp(x, y), a = Math.atan2(y, x);
        if ((z > 7 && z < 10) || (z > 22 && z < 25) || z > 30.5) return r < 5.2 ? (z > 30.5 ? (r < 4 && r > 1.4 ? DARKS : GUNMETAL) : GUNMETAL) : -1;   // the clamps and the muzzle ring
        if (r < 1.2) return DARKS;
        return ab(r - 3.6) < 1.1 && Math.cos(6 * a) > 0.45 ? (z > 28 ? DARKS : BRIGHT) : -1;                                 // six barrels
      });
    } });
  } else if (look === 'scatter') {
    parts.push({ name: 'gun', parent: 'yaw', pivot: [0, 9, 0], box: [-9, -12, -12, 9, 8, 30], paint(v) {
      v.box(-4, -3, -10, 4, 4, 8, GUNMETAL); v.box(-4, 4, -9, 4, 5, 5, STEEL); v.box(-4, -3, -10, 4, -2, 8, DARKS);
      for (const bx of [-4.5, 0]) v.fill((x, y, z) => (z > 6 && z < 29 && x > bx && x < bx + 4.5 && y > -1.5 && y < 3 ? (hyp(x - bx - 2.25, y - 0.75) < 1.2 && z > 26 ? HOLE : z > 26 ? DARKS : (fl(z) % 6 === 0 ? STEEL : BRIGHT)) : -1));   // two fat barrels
      v.fill((x, y, z) => (z > 11 && z < 20 && ab(x) < 3 && y > -5 && y < -1.5 ? ((fl(z) % 2) ? DARKS : GUNMETAL) : -1));   // the pump
      v.fill((x, y, z) => { const d = hyp(x * 1.4, y + 7.5); return d < 4.8 && z > -6 && z < 5 ? (d < 1.5 ? STEEL : ab(z + 0.5) < 0.6 ? OLIVE2 : OLIVE) : -1; });   // the drum
      v.box(-3, -6, -12, -1, -3, -9, HAZK); v.box(1, -6, -12, 3, -3, -9, HAZK);
      v.fill((x, y, z) => (z > 4 && z < 6 && ab(x) < 9 && y > -4.5 && y < 7.5 ? (y > 6.2 ? (((fl(x) >> 1) & 1) ? HAZ : HAZK) : (fl(x + 9) % 6 === 0 && (y < -3.5 || y > 5)) ? RIVET : ARMOUR) : -1));   // the shield
    } });
  } else if (look === 'flamer') {
    // the flamethrower: two big fuel tanks riding on top, a finned barrel under them, a flared nozzle with its pilot
    // light, hoses from the tanks down to the valve
    parts.push({ name: 'gun', parent: 'yaw', pivot: [0, 9, 0], box: [-8, -6, -12, 8, 10, 31], paint(v) {
      v.box(-3, -3, -9, 3, 3, 8, GUNMETAL); v.box(-3, -3, -9, 3, -2, 8, DARKS); v.box(-3, 2, -9, 3, 3, 8, STEEL);   // the body and its valve block
      v.box(-3, -5, -12, -1, -3, -8, HAZK); v.box(1, -5, -12, 3, -3, -8, HAZK);                                      // grips
      v.fill((x, y, z) => {
        for (const tx of [-3.1, 3.1]) {                                                                               // the tanks, banded, domed at the ends
          const r = hyp(x - tx, y - 5.6), zc = clamp(z, -7.5, 2.5), d = hyp(x - tx, y - 5.6, z - zc);
          if (d < 2.9) return ab(z - zc) > 0.8 ? (y > 6.6 ? FUEL2 : FUEL) : (fl(z + 9) % 5 === 0 ? DARKS : r > 2.2 && y > 6.4 ? FUEL2 : FUEL);
        }
        const rr = hyp(x, y);
        if (z >= 8 && z < 25 && rr < 1.3) return BRIGHT;                                                                       // the barrel
        if (z >= 9 && z < 21 && rr < 2.4 && fl(z) % 3 === 0) return DARKS;                                                     // its heat fins
        if (z >= 25 && z < 29) { const fr = 1.5 + (z - 25) * 0.3; if (rr < fr) return rr < fr - 0.9 && z > 27 ? HOLE : DARKS; }   // the flared nozzle
        if (z > 25.5 && z < 27.5 && ab(x) < 0.6 && y > -2.8 && y < -1.4) return PILOT;                                         // the pilot light under it
        if (z > 3 && z < 7 && ab(ab(x) - 3.1) < 0.7 && y > 2.5 && y < 4) return RUBBER;                                       // hoses down to the valve
        if (z > 2.5 && z < 4 && ab(x) < 6.5 && y > 3 && y < 8.5 && ab(ab(x) - 3.1) > 2.2) return GUNMETAL;                    // the straps
        return -1;
      });
    } });
  } else {
    parts.push({ name: 'gun', parent: 'yaw', pivot: [0, 9, 0], box: [-10, -6, -14, 10, 11, 41], paint(v) {
      v.box(-3, -3, -10, 3, 3, 8, GUNMETAL); v.box(-3, 3, -9, 3, 4, 4, STEEL); v.box(-3, -3, -10, 3, -2, 8, DARKS); v.box(3, 0, -3, 4, 1, 0, DARKS);   // receiver, top cover, handle
      v.box(-3, -5, -14, -1, -3, -9, HAZK); v.box(1, -5, -14, 3, -3, -9, HAZK); v.box(-1, -4, -13, 1, -3, -10, DARKS);   // spade grips
      v.box(-9, -3, -6, -3, 3, 3, OLIVE); v.box(-9, 2, -6, -3, 3, 3, OLIVE2); v.box(-9, -1, -6, -8, 1, 3, HAZ); v.box(-4, 3, -5, -3, 4, 2, STEEL);   // the ammo can, its lid, a stencil, the latch
      v.fill((x, y, z) => (x > -3.5 && x < -2 && y > 0 && y < 2 && z > -2 && z < 2 ? ((fl(z) & 1) ? HAZ : DARKS) : -1));   // the belt
      v.fill((x, y, z) => {
        const r = hyp(x, y);
        if (z > 7.5 && z < 21 && r < 2.9) return r > 1.5 && (fl(z) % 3 === 0) ? DARKS : r > 1.5 ? GUNMETAL : BRIGHT;   // the cooling jacket and its holes
        if (z > 7.5 && z < 36 && r < 1.2) return BRIGHT;                                                                 // the barrel
        if (z > 34.5 && z < 40) return r < 2.6 ? (r < 1.2 && z > 38 ? HOLE : (fl(z) === 37 && r > 1.8 ? HOLE : DARKS)) : -1;   // the muzzle brake and its ports
        if (z > 4.5 && z < 6 && ab(x) < 9.8 && y > -4.5 && y < 9) return y > 7.6 ? (((fl(x) >> 1) & 1) ? HAZ : HAZK) : y > 3 && y < 4.6 && ab(x) > 2.4 && ab(x) < 5.5 ? HOLE : (fl(x + 9.8) % 6 === 0 && (y < -3.5 || y > 6.5)) ? RIVET : ARMOUR;   // the shield, its slits
        if (z > -4 && z < 0 && ab(x) < 0.6 && y > 4 && y < 7) return DARKS;                                             // the sight
        return -1;
      });
    } });
  }
  return parts;
}
function heavyParts(S, o, zT) {
  const kind = o.secondary;
  if (kind === 'rockets') return [{ name: 'pod', parent: 'yaw', pivot: [9, 6, -3], box: [-2, -2, -9, 12, 12, 20], paint(v) {
    v.box(0, 0, -8, 11, 9, 16, OLIVE); v.box(0, 0, -8, 11, 1, 16, OLIVE2); v.box(0, 9, -5, 11, 10, 13, HAZ);
    for (let k = -5; k < 13; k += 3) v.box(0, 9, k, 11, 10, k + 1.5 | 0, HAZK);                          // the striped top
    v.box(0, 3, -8, 11, 4, 16, OLIVE2); v.box(-2, 3, -3, 0, 6, 6, GUNMETAL); v.box(-1, 2, -2, 0, 7, 5, STEEL);   // a seam, the arm to the mount
    for (let k = -6; k < 15; k += 6) v.box(0, 1, k, 1, 2, k + 1, RIVET);
    for (const tx of [0.6, 5.6]) for (const ty of [0.6, 4.6]) v.fill((x, y, z) => { const d = hyp(x - tx - 2.4, y - ty - 2); if (z < 15 || z > 18 || d > 2.4) return -1; return d < 1.1 ? (z > 17 ? TIP : 0xe8e4da) : d < 1.7 && z > 16 ? HOLE : DARKS; });   // four tubes, a rocket in each
  } }];
  if (kind === 'seekers') return [{ name: 'pod', parent: 'yaw', pivot: [9, 6, -3], box: [-2, -2, -9, 12, 10, 19], paint(v) {
    v.box(0, 0, -8, 11, 2, 13, GUNMETAL); v.box(0, 1, -8, 11, 2, 13, STEEL); v.box(-2, 1, -3, 0, 5, 6, GUNMETAL);   // the rails' bed, the arm to the mount
    for (const x of [0, 5, 10]) v.box(x, 2, -6, x + 1, 4, 11, DARKS);                                              // the rails
    v.box(4, 0, 10, 7, 3, 13, DARKS); v.box(5, 1, 12.5, 6, 2, 13, LOCK);                                           // the seeker's eye, glowing red
    for (const cx of [2.8, 8.2]) v.fill((x, y, z) => {                                                              // two missiles on the rails
      const r = hyp(x - cx, y - 4.6);
      if (z > -7 && z < 12 && r < 1.8) return fl(z) === 4 ? DARKS : r < 1.8 && y > 5.6 ? MISSILE2 : MISSILE;
      if (z >= 12 && z < 17 && r < 1.8 * (1 - (z - 12) / 5.5)) return TIP;                                            // the nose cone
      if (z > -7 && z < -3 && ((ab(x - cx) < 0.5 && ab(y - 4.6) < 3) || (ab(y - 4.6) < 0.5 && ab(x - cx) < 3))) return DARKS;   // the fins
      return -1;
    });
  } }];
  if (kind === 'cannon') return [{ name: 'pod', parent: 'yaw', pivot: [9, 6, 0], box: [-2, -2, -11, 9, 9, 48], paint(v) {
    v.box(0, 0, -9, 8, 8, 8, GUNMETAL); v.box(0, 8, -8, 8, 9, 5, HAZ); v.box(-2, 3, -3, 0, 6, 5, GUNMETAL); v.box(0, 0, -9, 8, 1, 8, DARKS);   // the breech, its stripe, the arm
    v.fill((x, y, z) => {
      const r = hyp(x - 3.75, y - 3.75);
      if (z < -9 && z > -11 && r < 3) return STEEL;                                                       // the breech block
      if (z > 7 && z < 15 && r < 3.3) return fl(z) % 3 === 0 ? DARKS : STEEL;                            // the recoil sleeve
      if (z > 7 && z < 42 && r < 2) return BRIGHT;                                                       // the barrel
      if (z > 41 && z < 47) return r < 3.3 ? (r < 1.4 && z > 45 ? HOLE : (fl(z) === 43 && r > 2.2 ? HOLE : DARKS)) : -1;   // the muzzle brake and its ports
      return -1;
    });
  } }];
  if (kind === 'mines') return [{ name: 'mines', parent: 'body', pivot: [0, S.c0 + 6, zT], box: [-14, -5, -11, 14, 12, 2], paint(v) {
    v.box(-12, 0, -9, 12, 1, 0, GUNMETAL); v.box(-12, 9, -9, 12, 10, 0, GUNMETAL);                    // the rack, top and bottom
    for (const x of [-12, -1, 0, 11]) v.box(x, 0, -9, x + 1, 10, -8, GUNMETAL);
    v.box(-12, 9, -2, 12, 10, 0, HAZ); for (let x = -12; x < 12; x += 3) v.box(x, 9, -2, x + 1, 10, 0, HAZK);
    v.box(-12, 1, -1, 12, 9, 0, DARKS);
    for (const cx of [-6, 6]) v.fill((x, y, z) => {                                                     // two mines in the rack
      const r = hyp(x - cx, y - 5); if (z > -7.5 || z < -9 || r > 4) return -1;
      return r < 1.2 ? RED_GLOW : r < 1.8 ? DARKS : ((fl((Math.atan2(y - 5, x - cx) / PI + 1) * 4) & 1) ? HAZ : HAZK);
    });
    v.box(-4, -5, -11, 4, 0, -6, DARKS); v.box(-4, -5, -11, 4, -4, -6, GUNMETAL);                    // the chute
  } }];
  return [];
}
// a buzz saw's blade in the y-z plane, its hub out on side s: R is the blade inside its teeth, which run out 2.4 more
function sawBlade(v, s, R) {
  v.fill((x, y, z) => {
    if (x < -1 || x > 1) return -1;
    const r = hyp(y, z), a = Math.atan2(y, z), f = (((a / (2 * PI)) * 22) % 1 + 1) % 1;
    if (r < 2) return x * s > 0 ? BRIGHT : DARKS; if (r < 3.8) return GUNMETAL;
    if (x * s < 0 && r < R) return STEEL;                                                           // the back of the blade is plain
    if (r < R) return ((fl(a * 3 / PI) & 1) && r > R * 0.56 && r < R * 0.83) ? STEEL : (fl(r) === fl(R) - 1 ? 0xd7dce2 : BRIGHT);
    return r < R + 2.4 && (r - R) / 2.4 < f ? BRIGHT : -1;                                           // the teeth
  });
}
function frontParts(S, o, zN) {
  const kind = o.front, W = S.W, c0 = S.c0, ht = Math.max(13, S.bumpTop - c0 + 4);
  const base = { name: 'front', parent: 'body', pivot: [0, c0, zN] };
  if (kind === 'none') return [];
  if (kind === 'plow') return [{ ...base, box: [-W - 3, -2, -3, W + 3, ht + 2, 12], paint(v) {
    v.fill((x, y, z) => {
      const zf = 10 - y * 0.5 - ab(x) * 0.16;                                                                // a wedge, leaning back, swept back at the ends
      if (ab(x) > W + 1.8 || y > ht) return -1;
      if (z < zf && z > zf - 2.7 && z > 0) {
        if (y < 1.5) return DARKS;                                                                            // the blade's edge
        if (z > zf - 1.2 && y > 3 && y < ht - 2.5) return ((fl((x + y * 1.2) / 4.5)) & 1) ? HAZ : HAZK;        // the hazard face
        return y > ht - 1.5 ? STEEL : fl(x + 50) % 9 === 0 && z < zf - 1.5 ? RIVET : ARMOUR;
      }
      if (ab(ab(x) - 10.5) < 1.5 && y > 3 && y < 8 && z > -2.5 && z < zf - 1.5) return RUST[0];                  // the brackets
      return -1;
    });
  } }];
  if (kind === 'spikes') return [{ ...base, box: [-W, -2, -3, W, ht + 2, 22], paint(v) {
    const yb = 5, yt = Math.min(ht - 2, 12);
    v.box(-W + 1, yb - 2, 0, W - 1, yb + 2, 4, GUNMETAL); v.box(-14, yt - 1, 0, 14, yt + 2, 3, GUNMETAL);   // the bars
    v.box(-W + 1, yb + 1, 0, W - 1, yb + 2, 4, STEEL);
    for (const x of [-14, 13]) v.box(x, yb, 0, x + 2, yt + 1, 3, GUNMETAL);
    const spike = (cx, cy, len) => v.fill((x, y, z) => { const t = (z - 3.5) / len, s = 2.6 * (1 - t); return t >= 0 && t < 1 && ab(x - cx) < s && ab(y - cy) < s ? (t > 0.7 ? BRIGHT : t < 0.12 ? DARKS : ((fl(z) & 1) ? STEEL : 0x7d838b)) : -1; });
    for (const cx of [-15, -7.5, 0, 7.5, 15]) spike(cx, yb, 15);
    for (const cx of [-9, 0, 9]) spike(cx, yt, 10.5);
  } }];
  if (kind === 'saws') {
    const sx = W - 5;
    const saw = (name, s) => ({ name, parent: 'front', pivot: [s * sx, 9, 9], box: [-2, -12, -12, 2, 12, 12], paint: (v) => sawBlade(v, s, 9) });
    return [{ ...base, box: [-W, -2, -3, W, 15, 12], paint(v) {
      v.box(-W + 1, 1, 0, W - 1, 4, 3, GUNMETAL); v.box(-W + 1, 3, 0, W - 1, 4, 3, STEEL);           // the bar
      for (const s of [1, -1]) { const x0 = s > 0 ? sx - 5 : -sx + 2; v.box(x0, 4, 0, x0 + 3, 9, 9, GUNMETAL); v.box(x0, 8, 2, x0 + 3, 10, 6, HAZ); v.box(x0, 5, 9, x0 + 3, 8, 10, DARKS); }   // the motor housings
    } }, saw('sawL', 1), saw('sawR', -1)];
  }
  // the steel bumper: a plain bar across the car's own bumper, on two brackets, so the grille and the lamps still show
  const y1 = Math.round(S.bumpTop - c0) - 1, y0 = y1 - 4;
  return [{ ...base, box: [-W, y0 - 1, -2, W, y1 + 1, 6], paint(v) {
    v.box(-W + 2, y0, 1, W - 2, y1, 4, GUNMETAL); v.box(-W + 2, y1 - 1, 1, W - 2, y1, 4, STEEL); v.box(-W + 2, y0, 1, W - 2, y0 + 1, 4, DARKS);   // the bar, its top, its shadowed underside
    for (const s of [1, -1]) {
      v.box(s > 0 ? W - 4 : -W + 2, y0 + 1, 4, s > 0 ? W - 2 : -W + 4, y1 - 1, 5, PLASTIC);                         // rubber at the corners
      v.box(s > 0 ? 9 : -11, y0 + 1, -2, s > 0 ? 11 : -9, y1 - 1, 1, DARKS);                                           // the brackets back to the car
    }
    for (let x = -W + 7; x < W - 6; x += 5) v.box(x, y0 + 1, 4, x + 1, y0 + 2, 5, RIVET);                               // bolt heads
  } }];
}

// ---- the roof weapons: twin guns, a rocket rack, an arc coil ----
function roofParts(o, ry, rz) {
  const look = PARTS.roof[o.roof] && PARTS.roof[o.roof].look;
  if (!look) return [];
  const base = (v) => v.fill((x, y, z) => { const r = hyp(x, z); return y < 1 ? (r < 5 ? DARKS : -1) : y < 3 ? (r < 2.2 ? GUNMETAL : -1) : -1; });
  if (look === 'twin') return [{ name: 'roof', parent: 'body', pivot: [0, ry, rz], box: [-9, 0, -7, 9, 10, 18], paint(v) {
    base(v);
    v.box(-7, 3, -3, 7, 4, 2, GUNMETAL); v.box(-7, 3, -3, -6, 7, 2, GUNMETAL); v.box(6, 3, -3, 7, 7, 2, GUNMETAL);   // the frame
    for (const gx of [-3.5, 3.5]) {
      v.fill((x, y, z) => {
        const dx = x - gx, r = hyp(dx, y - 6);
        if (ab(dx) < 1.5 && y > 4 && y < 8 && z > -6 && z < 4) return y > 7 ? STEEL : GUNMETAL;                       // the receiver
        if (z > 4 && z < 9 && r < 1.6) return (fl(z) & 1) ? DARKS : GUNMETAL;                                          // the jacket
        if (z > 4 && z < 16 && r < 0.8) return z > 15 ? HOLE : BRIGHT;                                                // the barrel
        if (ab(dx) < 0.6 && y > 8 && y < 9 && z > 1 && z < 3) return DARKS;                                           // the sight
        return -1;
      });
    }
    v.box(-6, 4, -5, -5, 8, 1, OLIVE); v.box(5, 4, -5, 6, 8, 1, OLIVE); v.box(-1, 4, -5, 1, 6, 0, OLIVE2);              // ammo boxes
  } }];
  if (look === 'rack') return [{ name: 'roof', parent: 'body', pivot: [0, ry, rz], box: [-9, 0, -8, 9, 13, 11], paint(v) {
    base(v);
    v.box(-8, 2, -7, 8, 12, 9, OLIVE); v.box(-8, 2, -7, 8, 3, 9, OLIVE2); v.box(-8, 11, -7, 8, 12, 9, HAZ);
    for (let x = -8; x < 8; x += 3) v.box(x, 11, -7, x + 1, 12, 9, HAZK);
    v.box(-9, 5, -2, -8, 9, 3, GUNMETAL); v.box(8, 5, -2, 9, 9, 3, GUNMETAL);                                          // trunnions
    for (const tx of [-5, 0, 5]) for (const ty of [5, 9]) v.fill((x, y, z) => { const d = Math.max(ab(x - tx), ab(y - ty)); if (z < 7 || z > 10 || d > 2.2) return -1; return d < 1 ? (z > 9 ? TIP : 0xe8e4da) : z > 8 ? HOLE : DARKS; });   // six tubes, a rocket in each
  } }];
  // the mortar: a fat tube leaning forward on a base plate and a bipod, two spare shells in a rack behind it
  if (look === 'mortar') return [{ name: 'roof', parent: 'body', pivot: [0, ry, rz], box: [-8, 0, -8, 8, 17, 10], paint(v) {
    base(v);
    const ce = Math.cos(MORTAR_UP), se = Math.sin(MORTAR_UP);
    v.fill((x, y, z) => {
      if (y >= 2 && y < 3 && ab(x) < 6.5 && z > -7 && z < 6) return (fl(x + 7) % 4 === 0 && (z < -6 || z > 5)) ? RIVET : ARMOUR;   // the base plate
      const ox = x, oy = y - 4, oz = z + 3, t = oy * se + oz * ce, r = hyp(ox, oy * ce - oz * se);   // along and round the tube
      if (t > -1 && t < MORTAR_LEN && r < (t > MORTAR_LEN - 1.6 ? 3.1 : 2.7)) {
        if (t > MORTAR_LEN - 1.6) return r < 1.6 ? HOLE : r > 2.5 ? STEEL : DARKS;                   // the muzzle and its ring
        if (t > 6 && t < 7.4) return ((fl(Math.atan2(ox, oy) * 2) & 1) ? HAZ : HAZK);               // a hazard band
        return t < 0.6 ? DARKS : y > 4 + t * se + 1.2 ? OLIVE2 : OLIVE;
      }
      if (hyp(x, y - 4, z + 3) < 3.2 && y >= 2.5) return GUNMETAL;                                     // the ball socket at its foot
      const lt = clamp((y - 2) / 5.4), lz = -3 + 6 * ce + 3 * (1 - lt);                                // the bipod's two legs, splayed
      if (y >= 2.5 && y < 7.4 && ab(ab(x) - (1.8 + 2.6 * (1 - lt))) < 0.6 && ab(z - lz) < 0.6) return GUNMETAL;
      for (const sx of [-4.6, 4.6]) { const rs = hyp(x - sx, z + 5.6); if (y >= 3 && y < 8.5 && rs < 1.2) return y > 7.2 ? TIP : BRIGHT; }   // spare shells
      return -1;
    });
  } }];
  // the arc coil: a ceramic foot, a copper coil, a steel ball that sparks
  return [{ name: 'roof', parent: 'body', pivot: [0, ry, rz], box: [-6, 0, -6, 6, 15, 6], paint(v) {
    v.fill((x, y, z) => {
      const r = hyp(x, z), a = Math.atan2(x, z);
      if (y < 1.5) return r < 4.6 ? DARKS : -1;
      if (y < 4) return r < 2.8 - (fl(y * 2) % 2) * 0.6 ? ((fl(y * 2) & 1) ? CERAMIC2 : CERAMIC) : -1;           // the insulator
      if (y < 9) return r < 2.5 ? (r < 1.4 ? COPPER2 : (fl(y * 1.5) & 1) ? COPPER : COPPER2) : -1;                 // the coil
      if (y < 9.6) return r < 1.2 ? STEEL : -1;
      const d = hyp(x, y - 11.6, z);
      if (d < 2.9) return ab(y - 11.6) < 0.6 && Math.cos(a * 4) > 0.3 ? ARC : d > 2.3 && hash(fl(x), fl(y), fl(z), 3) < 0.25 ? ARC : BRIGHT;   // the ball, crackling
      return -1;
    });
  } }];
}
// ---- the door weapons: a gun or a rocket tube on each front door, or blades out of the sills ----
// where the side saws sit: out from the middle of each front door, low enough that their teeth nearly touch the ground
export const DOOR_SAW = { R: 9.5, y: 13 };
export const sawX = (S) => (S.Wmax || S.W) + (S.wheelOut ? 5 : 4.2);
function doorParts(S, o, dz, dy, dx) {
  const look = PARTS.door[o.door] && PARTS.door[o.door].look;
  if (!look) return [];
  if (look === 'blades') {   // a buzz saw on an arm out of each door, a motor on the door behind it
    const bx = sawX(S), W = S.W, R = DOOR_SAW.R, cy = DOOR_SAW.y;
    const saw = (name, s) => ({ name, parent: 'blades', pivot: [s * bx, 0, 0], box: [-2, -13, -13, 2, 13, 13], paint: (v) => sawBlade(v, s, R) });
    return [{ name: 'blades', parent: 'body', pivot: [0, cy, dz], box: [-Math.ceil(bx) - 1, -4, -5, Math.ceil(bx) + 1, 5, 5], paint(v) {
      v.fill((x, y, z) => {
        const ax = ab(x);
        if (ax > W - 1.5 && ax < W + 1.5 && ab(y) < 3.6 && ab(z) < 4.2) return ab(y) > 2.8 ? HAZ : ab(z) > 3.4 ? DARKS : GUNMETAL;   // the motor
        if (ax >= W + 1.5 && ax < bx - 1 && ab(y) < 1.2 && ab(z) < 1.2) return y > 0.4 ? STEEL : GUNMETAL;                        // the arm
        return -1;
      });
    } }, saw('bsawL', 1), saw('bsawR', -1)];
  }
  if (look === 'hubs') return [];   // (on the wheels: see hubParts)
  const parts = [];
  for (const [name, s] of [['doorL', 1], ['doorR', -1]]) {
    if (look === 'guns') parts.push({ name, parent: 'body', pivot: [s * dx, dy, dz], box: [-4, -5, -6, 4, 4, 16], paint(v) {
      v.fill((x, y, z) => {
        const xi = x * s, r = hyp(x, y);
        if (xi < -0.5 && xi > -3.5 && ab(y) < 1 && ab(z) < 2) return DARKS;                                          // the bracket to the door
        if (ab(x) < 1.5 && ab(y + 0.25) < 1.75 && z > -5 && z < 4) return y > 1 ? STEEL : GUNMETAL;                 // the receiver
        if (z > 4 && z < 8 && r < 1.5) return (fl(z) & 1) ? DARKS : GUNMETAL;                                       // the jacket
        if (z > 4 && z < 15 && r < 0.8) return z > 14 ? HOLE : BRIGHT;                                              // the barrel
        if (hyp(x, y + 3) < 1.8 && z > -3 && z < 2) return OLIVE;                                                   // the drum
        return -1;
      });
    } });
    else if (look === 'shotguns') parts.push({ name, parent: 'body', pivot: [s * dx, dy, dz], box: [-4, -4, -8, 4, 4, 15], paint(v) {
      v.fill((x, y, z) => {
        const xi = x * s;
        if (xi < -1.5 && xi > -3.5 && ab(y) < 1 && ab(z) < 2) return DARKS;                                        // the bracket to the door
        if (ab(x) < 1.5 && y > -1.5 && y < 1.5 && z > -5 && z < 2) return y > 1 ? STEEL : GUNMETAL;                // the receiver
        if (z > -7.5 && z <= -5 && ab(x) < 1 && y > -2 && y < 1) return (fl(z) & 1) ? WOOD : WOOD2;                // the stock
        if (z > 2 && z < 14 && ab(x) < 1 && y > 0 && y < 1) return z > 13 ? HOLE : BRIGHT;                          // two barrels side by side
        if (z > 3 && z < 8 && ab(x) < 1.5 && y > -2 && y < 0) return (fl(z) & 1) ? WOOD : WOOD2;                     // the pump grip
        if (z > 8 && z < 12 && ab(x) < 1 && y > -1 && y < 0) return DARKS;                                         // the magazine tube
        return -1;
      });
    } });
    else if (look === 'burners') parts.push({ name, parent: 'body', pivot: [s * dx, dy, dz], box: [-4, -4, -9, 4, 4, 13], paint(v) {
      v.fill((x, y, z) => {
        const xi = x * s, r = hyp(x, y);
        if (xi < -1.5 && xi > -4 && ab(y) < 1 && ab(z) < 2.5) return DARKS;                                        // the bracket to the door
        if (z > -8 && z < 2 && r < 2.2) return z < -7 ? (r < 1.2 ? STEEL : DARKS) : fl(z) % 4 === 0 ? DARKS : y > 1 ? FUEL2 : FUEL;   // the fuel tank, banded
        if (z >= 2 && z < 10 && r < 1) return (fl(z) & 1) ? DARKS : GUNMETAL;                                       // the finned pipe
        if (z >= 10 && z < 12 && r < 1.6) return r < 0.8 && z > 11 ? HOLE : STEEL;                                   // the nozzle
        if (z > 10 && z < 12 && ab(x) < 0.6 && y < -1.5 && y > -2.5) return PILOT;                                    // the pilot light
        return -1;
      });
    } });
    else parts.push({ name, parent: 'body', pivot: [s * dx, dy, dz], box: [-4, -4, -9, 4, 4, 12], paint(v) {
      v.fill((x, y, z) => {
        const xi = x * s, r = hyp(x, y);
        if (xi < -1.5 && xi > -4 && ab(y) < 1 && ab(z) < 2.5) return DARKS;                                         // the bracket to the door
        if (z > -8 && z < 11 && r < 2.6) {
          if (z > 9.5) return r < 1.4 ? TIP : r < 2 ? HOLE : DARKS;                                                    // the rocket's nose in the mouth
          if (z < -7) return r < 1.2 ? HOLE : DARKS;
          return z > 6 && z < 8 ? (((fl(Math.atan2(y, x) * 2) & 1)) ? HAZ : HAZK) : y > 1.2 ? OLIVE : OLIVE2;          // the tube, a hazard band
        }
        return -1;
      });
    } });
  }
  return parts;
}

// hub spikes: a spike out of the middle of each wheel, ringed with short blades, turning with it
function hubParts(wk) {
  const hw = wk.w / 2;
  return [['wFL', 1], ['wFR', -1], ['wRL', 1], ['wRR', -1]].map(([w, s]) => ({ name: 'hub' + w.slice(1), parent: w, pivot: [s * hw, 0, 0], box: [s > 0 ? 0 : -9, -5, -5, s > 0 ? 9 : 0, 5, 5], paint(v) {
    v.fill((x, y, z) => {
      const xo = x * s, r = hyp(y, z), a = Math.atan2(y, z);
      if (xo < 0) return -1;
      if (xo < 1.2) return r < 4.6 ? (r > 3.6 ? DARKS : r < 1.6 ? BRIGHT : STEEL) : -1;                              // the plate on the hub
      if (xo < 3 && r > 2.4 && r < 4.8 && ((((a / (2 * PI)) * 6) % 1 + 1) % 1) < 0.28) return xo > 2.2 ? BRIGHT : STEEL;   // the ring of blades
      const t = (xo - 1.2) / 7.6; if (t < 1 && r < 2.4 * (1 - t) + 0.35) return t > 0.62 ? BRIGHT : (fl(xo) & 1) ? STEEL : GUNMETAL;   // the spike
      return -1;
    });
  } }));
}

// ---- the clips ----
const CLIPS = {
  Race: { loop: true, pose: (t, u) => {
    const s = u.state, a = s.spin || 0, st = s.steer || 0, cone = [-(s.coneAim || 0), s.coneYaw || 0, 0];
    return {
      wFL: [a, st, 0], wFR: [a, st, 0], wRL: [a, 0, 0], wRR: [a, 0, 0],
      body: [s.pitch || 0, 0, s.roll || 0, 0, s.bob || 0, 0],
      yaw: [0, s.yaw || 0, 0], gun: [-(s.aim || 0), 0, 0], pod: [-(s.aim || 0) * 0.85 - 0.04, 0, 0],
      spin: [0, 0, s.gunSpin || 0], sawL: [s.saw || 0, 0, 0], sawR: [s.saw || 0, 0, 0], bsawL: [s.saw || 0, 0, 0], bsawR: [-(s.saw || 0), 0, 0],
      roof: cone, doorL: cone, doorR: cone,
      hood: [(s.hood || 0) * (s.hoodDir || -1), 0, 0], engine: [0, 0, s.shake ? Math.sin(t * 97) * s.shake : 0],
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

const lo = (a) => Math.ceil(a - 0.5);   // how many whole cubes stand under a height
// a roof weapon's height, and how far under the turret's ring the lowest part of its gun hangs where it passes over
// the roof weapon (the minigun's barrels are fat; the cannon beside the gun swings over it when the turret turns)
// gap: how far behind the roof weapon the turret stands (the mg's jacket and the scatter's pump hang lower near the gun)
const ROOF_TOP = { twin: 9, rack: 12, arc: 14.5, mortar: 15 };
const UNDER = { mg: (gap) => (gap < 21 ? 6.1 : 7.6), scatter: (gap) => (gap < 20 ? 4 : 7.3), minigun: () => 3.8, flamer: () => 3.2 };

// The definition of a car for a build: the Unit def, plus its size for the driving code and where its guns fire from.
export function carDef(load, seed = 0) {
  const P = (slot) => PARTS[slot][load[slot]] || Object.values(PARTS[slot])[0];
  const S = SHAPES[P('body').shape] || SHAPES.hatch, W0 = WHEELS[P('wheels').look] || WHEELS.street;
  const R = W0.R > 3 ? W0.R : S.R + W0.R, lift = W0.R > 3 ? Math.round(R - S.R - 1.5) : 0;
  const wk = { ...W0, R, lift, out: W0.out + (S.wheelOut || 0) };
  const o = { ...load, seed };
  const zN = S.zN + S.bumpF, zT = S.zT - S.bumpR, look = P('armour').look, plate = look >= 2 ? 1 : 0;
  const roofLook = P('roof').look, doorLook = P('door').look;
  // the turret: on the middle of the roof, further back when a roof weapon stands at the front, on a post if the roof
  // falls away under it (the fastback) or the weapon in front is tall; the pickup's stands on a post in its bed
  // the turret: lifted on a post just far enough that its gun clears a roof weapon in front of it
  const tz = roofLook ? S.turret.zR : S.turret.z;
  const rz = S.roofW.z, ry = S.roofW.y ?? lo(S.top(rz)) + plate;
  const ty0 = S.turret.y || lo(S.roofY) + plate;
  const under = Math.min((UNDER[P('primary').look] || UNDER.mg)(rz - tz - 7), load.secondary === 'cannon' ? 6.2 : 99);
  const rise = roofLook ? Math.min(12, Math.max(0, Math.ceil(ry + ROOF_TOP[roofLook] + 0.5 - ty0 - under))) : 0;
  const ty = ty0 + rise;
  const ped = S.turret.y ? rise : Math.max(0, ty - lo(Math.min(S.top(tz - 8), S.top(tz + 8))) - plate) + (S.turret.pedR ? 1 : 0);
  // the door weapons hang off each front door under the mirror
  const dz = S.door.z, dyy = S.door.y ?? Math.round(S.belt(dz)) - 3, dxx = S.W + 2.5;
  const body = bodyPart(S, o, wk);
  const Sx = { ...S, aR: Math.min(wk.R + 1.8, S.belt(S.ax[0]) - (wk.R - wk.lift) - 1), bumpTop: { hatch: 12.6, wagon: 12, muscle: 9.2, pickup: 15.4, van: 14, buggy: 12, wedge: 8.6, bus: 15, offroad: 18, yacht: 9.6, rig: 14.8 }[S.kind] };
  const eng = PARTS.engine[load.engine] ? load.engine : 'stock';
  const parts = [
    body, ...(body.hood ? [body.hood] : []), ...(body.bay ? [enginePart((PARTS.engine[eng] && PARTS.engine[eng].look) || eng, body.bay)] : []),
    wheelPart('wFL', 1, S.ax[0], S, wk, P('wheels').look), wheelPart('wFR', -1, S.ax[0], S, wk, P('wheels').look),
    wheelPart('wRL', 1, S.ax[1], S, wk, P('wheels').look), wheelPart('wRR', -1, S.ax[1], S, wk, P('wheels').look),
    ...gunParts(o, ty, tz, ped), ...heavyParts(S, o, zT), ...frontParts(Sx, o, zN),
    ...roofParts(o, ry, rz), ...doorParts(Sx, o, dz, dyy, dxx), ...(doorLook === 'hubs' ? hubParts(wk) : []),
  ];
  const fd = FRONT_DEPTH[load.front] ?? 5, rear = load.secondary === 'mines' ? 11 : 1;
  const nose = (zN + fd) * H, tail = (zT - rear) * H, outer = Math.max(S.Wmax || S.W, S.W - wk.out);
  const dims = {
    half: (nose - tail) / 2, mid: (nose + tail) / 2, wide: outer * H, top: (ty + lift + 3) * H, roof: (lo(S.roofY) + plate + lift) * H,
    wheelR: R * H, lift: lift * H, length: nose - tail,
    // the engine bay's middle (town units along the car) and which way the bonnet lifts (-1 from the back edge)
    // where the loose panels are (crumple.js), in the body's cubes: the bumpers past the nose and tail up to bumpTop, the
    // front doors (from the first side window) between the sills and the base of the glass
    panels: { zN: S.zN, zT: S.zT, bumpTop: Sx.bumpTop || Math.round(S.belt(S.zN) * 0.55), c0: S.c0, W: S.W, belt: S.belt(S.door.z),
      door: S.win && S.win.length && !S.openTop && S.kind !== 'bus' ? [S.win[0][0], S.win[0][1]] : null },
    bayZ: body.bay ? body.bay.zc * H : nose * 0.6, hoodDir: body.bay ? body.bay.dir : -1, hood: !!body.hood,
    // where the side saws or the hub spikes cut, out to the sides: [out, along] in town units, both sides
    cut: doorLook === 'blades' ? [-0.7, 0, 0.7].map((f) => [(sawX(S) + 0.5) * H, (dz + f * DOOR_SAW.R) * H]) : doorLook === 'hubs' ? S.ax.map((a) => [(S.W - wk.out + 5) * H, a * H]) : null,
  };
  const M = { mg: [0, 0, 40], minigun: [0, 0, 40.5], scatter: [0, 0.75, 29], flamer: [0, 0, 29] }[P('primary').look] || [0, 0, 40];
  const v = (p) => p.map((c) => c * H);
  const roofM = roofLook === 'twin' ? [[-3.5, 6, 16], [3.5, 6, 16]] : roofLook === 'rack' ? [-5, 0, 5].flatMap((x) => [[x, 9, 10], [x, 5, 10]]) : roofLook === 'arc' ? [[0, 11.6, 0]]
    : roofLook === 'mortar' ? [[0, 4 + Math.sin(MORTAR_UP) * MORTAR_LEN, -3 + Math.cos(MORTAR_UP) * MORTAR_LEN]] : [];
  const doorM = { guns: [15, 0], rockets: [11, 0], shotguns: [14, 0.5], burners: [11.5, 0] }[doorLook] || null;
  const muzzles = {
    gun: v(M),
    pod: load.secondary === 'cannon' ? v([3.75, 3.75, 47]) : load.secondary === 'mines' ? v([0, 0, -11]) : load.secondary === 'seekers' ? v([5.5, 4.6, 17.5]) : v([5.5, 4.6, 18.5]),
    podBone: load.secondary === 'mines' ? 'mines' : 'pod',
    roof: roofM.map((p) => ({ bone: 'roof', p: v(p) })),
    door: doorM ? [{ bone: 'doorL', p: v([0, doorM[1], doorM[0]]) }, { bone: 'doorR', p: v([0, doorM[1], doorM[0]]) }] : [],
  };
  return {
    kind: 'combat-car', h: H, dieAt: 5, start: 'Race', inner: INNER, clips: CLIPS, parts: () => parts, dims, muzzles,
    onKill(u, point, r, debris) { u.state.side = hash(seed, 2, 9, 4) < 0.5 ? 1 : -1; u.wreck(debris, 0.06, 16); u.play('Wreck', 0.05); },
  };
}
// the parts a car loses when it is wrecked: they are blown clear
export const LOOSE = ['yaw', 'gun', 'spin', 'pod', 'mines', 'front', 'sawL', 'sawR', 'roof', 'doorL', 'doorR', 'blades', 'bsawL', 'bsawR', 'hood'];
