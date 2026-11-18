// Street cars, built in code at eighth-metre cubes like the army's jeep and tank (h = 0.5 town voxels), on the same
// Unit and VoxPart kit (../../units/src). One builder makes four cars: a four-door sedan, a two-door hatchback, a taxi
// and a police car (both on the sedan's body).
//
// Everything is laid out on the cube grid by hand, not from curves, so every edge is crisp. Coordinates are whole cubes
// relative to each part's pivot: a cube (i, j, k) fills i..i+1, j..j+1, k..k+1. Left is +x, forward is +z, the ground
// is y = 0. The car is 14 cubes wide (i = -7..6), so cube i on the left mirrors cube -1 - i on the right.
//
// The bonnet, the boot lid (or the hatchback's tailgate) and the doors are parts of their own, so they can swing open,
// hang off a wreck or be blown clear. Under them the car is modelled too: engine, radiator and battery, a boot with
// luggage in it, seats, dashboard and steering wheel, and an underside with its exhaust for when it lands on its roof.
import { GLOW, hash, tone } from '../../units/src/voxpart.js';

const H = 0.5;
const S = Math.sin, C = Math.cos, PI = Math.PI, ab = Math.abs, fl = Math.floor;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), ease = (a) => a * a * (3 - 2 * a);

// ---- colours ----
export const PAINTS = { red: 0xc23b2e, blue: 0x2f62a8, white: 0xe6e4dc, silver: 0xa4a9b0, green: 0x3d7d55, black: 0x2b2e35, orange: 0xdb7a2a, teal: 0x2c8f8c, cream: 0xe0cf9c, maroon: 0x7c2734, taxi: 0xf4b71a };
const CHROME = 0xc9ced6, PLASTIC = 0x26282c, TRIM = 0x1b1c20, BLACK = 0x111215, CHASSIS = 0x1a1b1e, WHITE = 0xe9e7e0, COPBLUE = 0x2b55a8;
const TYRE = [0x25262a, 0x2f3035], RIM = 0xb4b9c1, RIMD = 0x3a3d43, HUB = 0xdfe3e8, DRUM = 0x2a2b2f;
const GLASS = 0x24404f, GLASS2 = 0x2f5466, SHINE = 0x8dbdd0;
const SEAT = 0x4a3a30, SEAT2 = 0x5d4a3d, CARD = 0x38302b, DASH = 0x1f2023, WHEELC = 0x141518;
const PLATE = 0xeeeee6, PLATE_NY = 0xf2c838, INK = 0x24356b;
const LENS = 0xdedbd0, TAILC = 0xa81d18, AMBERC = 0xc7791a, REVC = 0xd8d6cf;
const LAMP = 0xfff3c4 | GLOW, TAIL = 0xff3826 | GLOW, AMBER = 0xffa51e | GLOW, SIGN = 0xffe27a | GLOW, SIGN2 = 0xe09a1c | GLOW, RED = 0xff2a2a | GLOW, BLUE = 0x3f6bff | GLOW;
const ENGINE = 0x5c6168, ENGINE2 = 0x44484e, COVER = 0x8c2a24, RAD = [0x9aa0a8, 0x6d7279], BATT = 0x1d2430;
const INNER = [0x1c1d20, 0x26272a, 0x151618];
const GLASSES = new Set([GLASS, GLASS2, SHINE]);
const SHARD = 0x9cc7d6;
export const isGlass = (c) => GLASSES.has(c & 0xffffff);

// ---- body shapes ----
// k0..k1: tail and nose cubes. archF, archR: the cube each axle is in. front and rear: for the four rows of glass
// (j = 7..10), the cube the windscreen and the rear window are in. doors: [rear cube, front cube] of each door on a side.
const SPEC = {
  sedan: { k0: -18, k1: 17, archF: 11, archR: -12, front: [6, 5, 4, 3], rear: [-11, -10, -9, -8], doors: [[-1, 6], [-8, -3]], hatch: false },
  hatch: { k0: -16, k1: 15, archF: 10, archR: -11, front: [5, 4, 3, 2], rear: [-15, -15, -14, -14], doors: [[-4, 5]], hatch: true },
};
const specOf = (type) => SPEC[type === 'hatch' ? 'hatch' : 'sedan'];

// boxes with both ends included, and the same mirrored onto side s (+1 left, -1 right)
const bx = (g, i0, i1, j0, j1, k0, k1, c) => g.box(i0, j0, k0, i1 + 1, j1 + 1, k1 + 1, c);
const sx = (s, i) => (s > 0 ? i : -1 - i);
const bxs = (g, s, i0, i1, j0, j1, k0, k1, c) => (s > 0 ? bx(g, i0, i1, j0, j1, k0, k1, c) : bx(g, -1 - i1, -1 - i0, j0, j1, k0, k1, c));
const SIDES = [1, -1];
const half = (i) => (i >= 0 ? i : -1 - i);   // how far a cube is from the centre line: 0..6 on either side

const sideGlass = (i, j, k) => (((k * 2 + j * 3) % 13 + 13) % 13 === 0 ? SHINE : j >= 10 ? GLASS2 : GLASS);
const screenGlass = (i, j, k) => (((i * 2 + j * 5 + 40) % 11) === 0 ? SHINE : j >= 10 ? GLASS2 : GLASS);

function carParts(o) {
  const type = o.type || 'sedan', sp = specOf(type), taxi = type === 'taxi', police = type === 'police', seed = o.seed || 0;
  const base = taxi ? PAINTS.taxi : police ? 0x23272f : PAINTS[o.paint] ?? PAINTS.red;
  const { k0, k1, archF, archR, front, rear, doors, hatch } = sp, cowl = front[0], roofF = front[3] - 1, roofR = rear[3] + 1;
  const pc = (j) => tone(base, j <= 2 ? 0.85 : j >= 6 ? 1.07 : 1);
  const BUMP = taxi || police || hatch ? PLASTIC : CHROME, STRIP = police ? COPBLUE : hatch ? PLASTIC : tone(base, 0.62);
  const roofC = police ? WHITE : tone(base, 1.07), lidC = police ? 0x23272f : tone(base, 1.07);
  const inDoor = (k) => doors.some(([a, b]) => k >= a && k <= b);
  const pillars = doors.map((d) => d[0] - 1);   // the post behind each door
  // the paint on the flank at height j, cube k
  const flank = (j, k, door) => {
    if (taxi && (j === 4 || j === 5)) return ((k + j) & 1) ? 0x17181b : 0xf4f1e8;          // the checker band
    if (police && door) return j === 4 ? COPBLUE : WHITE;
    if (j === 4) return STRIP;                                                              // rubbing strip
    return pc(j);
  };

  const wheel = (name, s, kc) => ({ name, parent: 'body', pivot: [s * 6, 2.5, kc + 0.5], box: [-1, -2.5, -2.5, 1, 2.5, 2.5], paint: (g) => g.fill((x, y, z) => {
    const m = Math.max(ab(y), ab(z)); if (ab(y) === 2 && ab(z) === 2) return -1;
    if (m === 2) return TYRE[(Math.round(Math.atan2(y, z) * 8 / PI) + 16) & 1];
    if (x * s < 0) return DRUM;
    if (taxi) return m === 0 ? RIMD : RIM;                                                  // plain steel discs
    if (police) return m === 0 ? HUB : RIMD;                                                // black steel, chrome centre
    return m === 0 ? HUB : (ab(y) + ab(z) === 1 ? RIM : RIMD);                              // four-spoke alloy
  }) });

  const door = (name, s, [kA, kB], first) => {
    const iS = s > 0 ? -1 : 0, iC = s > 0 ? -2 : 1, iM = s > 0 ? 0 : -1, hk = kB + 1;      // skin, inner card and glass, mirror; hinge plane
    return { name, parent: 'body', pivot: [s * 7, 2, hk], box: s > 0 ? [-2, 0, kA - hk, 1, 9, 0] : [-1, 0, kA - hk, 2, 9, 0], paint: (g) => {
      for (let k = kA; k <= kB; k++) {
        const kl = k - hk;
        for (let j = 2; j <= 6; j++) g.set(iS, j - 2, kl, k === kA && !(taxi && (j === 4 || j === 5)) ? tone(flank(j, k, true), 0.82) : flank(j, k, true));   // skin, with a shut line down its rear edge
        for (let j = 2; j <= 5; j++) g.set(iC, j - 2, kl, j === 4 ? SEAT2 : CARD);                                                // door card with an armrest
        for (let r = 0; r < 4; r++) if (k <= front[r] - 1 && k >= rear[r] + 2) g.set(iC, 5 + r, kl, sideGlass(0, 7 + r, k));     // the window
      }
      g.set(iS, 3, kA + 1 - hk, CHROME); g.set(iS, 3, kA + 2 - hk, CHROME);                                                       // handle
      if (police && first) { g.set(iS, 3, kA + 4 - hk, 0xd8a928); g.set(iS, 4, kA + 4 - hk, 0xd8a928); }                          // a gold shield
      if (first) { g.set(iM, 5, -2, police ? WHITE : tone(base, 1.0)); g.set(iM, 5, -3, TRIM); g.set(iS, 5, -2, TRIM); }       // wing mirror on its stalk
    } };
  };

  const parts = [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-9, 0, k0 - 3, 9, 16, k1 + 4], paint: (g) => {
      const set = (i, j, k, c) => g.set(i, j, k, c);
      // ---- the underside: sills, floor pan, transmission tunnel, sump, exhaust and tank ----
      for (let k = k0; k <= k1; k++) for (let i = -7; i <= 6; i++) {
        const a = half(i); if (a === 6 && (k === k0 || k === k1)) continue;                 // the corners are cut off in plan
        let c = CHASSIS;
        if (a === 6) c = PLASTIC;
        else if (i === -3 && k <= cowl + 2) c = 0x6c7077;                                   // exhaust pipe
        else if ((i === -1 || i === 0) && k > archR + 4 && k < cowl) c = 0x3e4146;          // tunnel
        else if (i >= -2 && i <= 1 && k >= cowl + 3 && k <= cowl + 6) c = 0x54585e;         // sump
        else if (i >= 0 && i <= 2 && k >= archR + 5 && k <= archR + 8) c = 0x34373c;        // fuel tank
        set(i, 1, k, c);
      }
      bx(g, -4, -2, 1, 1, archR + 6, archR + 9, 0x7a7e85);                                  // silencer
      // ---- flanks: everything but the doors ----
      for (const s of SIDES) for (let k = k0 + 1; k <= k1 - 1; k++) if (!inDoor(k)) for (let j = 2; j <= 6; j++) set(sx(s, 6), j, k, flank(j, k, false));
      // ---- nose ----
      for (let i = -6; i <= 5; i++) {
        const a = half(i);
        set(i, 1, k1, PLASTIC); set(i, 2, k1, CHASSIS);
        for (const j of [3, 4]) set(i, j, k1, a <= 2 ? (j === 4 && a === 0 ? CHROME : (a === 2 ? TRIM : BLACK)) : a <= 4 ? LENS : AMBERC);   // grille and badge, headlamps, indicators
        set(i, 5, k1, pc(5));
        set(i, 2, k1 + 1, a <= 1 ? (o.ny ? PLATE_NY : PLATE) : BUMP);                       // bumper, with the plate on it
      }
      set(-1, 2, k1 + 1, INK);
      for (const s of SIDES) set(sx(s, 6), 2, k1, BUMP);
      // ---- tail ----
      for (let i = -6; i <= 5; i++) {
        const a = half(i);
        set(i, 1, k0, PLASTIC); set(i, 2, k0, CHASSIS);
        set(i, 3, k0, a <= 1 ? (o.ny ? PLATE_NY : PLATE) : pc(3));
        set(i, 4, k0, a === 3 ? REVC : a === 4 ? TAILC : a === 5 ? AMBERC : pc(4));
        set(i, 5, k0, a >= 3 ? TAILC : a === 0 ? CHROME : pc(5));
        set(i, 6, k0, pc(6));
        set(i, 2, k0 - 1, BUMP);
      }
      set(0, 3, k0, INK); set(-2, 3, k0, INK);
      for (const s of SIDES) set(sx(s, 6), 2, k0, BUMP);
      set(-3, 1, k0 - 1, 0x8a8e94);                                                          // tailpipe
      if (police) { for (const i of [-4, 3]) bx(g, i, i, 2, 4, k1 + 2, k1 + 2, BLACK); bx(g, -4, 3, 4, 4, k1 + 2, k1 + 2, BLACK); bx(g, -4, 3, 2, 2, k1 + 2, k1 + 2, BLACK); }   // push bar
      // ---- bulkheads ----
      bx(g, -6, 5, 2, 5, cowl, cowl, 0x2a2c30);                                             // firewall
      for (let i = -6; i <= 5; i++) set(i, 6, cowl, (i & 1) ? TRIM : PLASTIC);              // the vents under the windscreen
      if (!hatch) { bx(g, -6, 5, 2, 5, rear[0] + 1, rear[0] + 1, 0x2a2c30); bx(g, -6, 5, 6, 6, rear[0], rear[0], pc(6)); bx(g, -5, 4, 6, 6, rear[0] + 1, rear[0] + 2, CARD); }   // boot bulkhead, the panel under the rear window, parcel shelf
      else { bx(g, -6, 5, 6, 6, k0 + 1, rear[0] - 1, pc(6)); bx(g, -5, 4, 6, 6, rear[0] + 1, rear[0] + 2, CARD); }
      // ---- the glasshouse: pillars, the windows that do not open, the roof ----
      for (let r = 0; r < 4; r++) {
        const j = 7 + r, f = front[r], b = rear[r];
        for (const s of SIDES) {
          const i = sx(s, 5);
          set(i, j, f, police ? WHITE : pc(6));                                             // windscreen pillar
          set(i, j, b, police ? WHITE : pc(6)); set(i, j, b + 1, police ? WHITE : pc(6));   // rear pillar, two cubes thick
          for (let k = b + 2; k <= f - 1; k++) { if (pillars.includes(k)) set(i, j, k, TRIM); else if (!inDoor(k)) set(i, j, k, sideGlass(i, j, k)); }
        }
        for (let i = -5; i <= 4; i++) { set(i, j, f, screenGlass(i, j, f)); if (!hatch) set(i, j, b, screenGlass(i + 3, j, b)); }
      }
      bx(g, -6, 5, 11, 11, roofR, roofF, roofC);
      if (hatch) bx(g, -6, 5, 11, 11, roofR - 1, roofR - 1, PLASTIC);                       // the lip over the tailgate
      else if (!taxi && !police && seed % 3 === 0) bx(g, -3, 2, 11, 11, roofF - 6, roofF - 3, GLASS);   // some have a sunroof
      set(-1, 10, roofF, TRIM); set(0, 10, roofF, TRIM);                                    // rear-view mirror
      if (police) { bx(g, -5, 4, 12, 12, -3, -2, BLACK); bx(g, 1, 4, 12, 12, -3, -2, 0x7a1c1c); bx(g, -5, -2, 12, 12, -3, -2, 0x1c2c7a); }   // the light bar, unlit
      // ---- wheel arches: cut out of the flank, lined in black ----
      for (const kc of [archF, archR]) for (const s of SIDES) {
        for (let k = kc - 3; k <= kc + 3; k++) for (let j = 1; j <= 5; j++) {
          const corner = j === 5 && ab(k - kc) === 3;
          if (!corner) set(sx(s, 6), j, k, -1);
          for (const i of [4, 5]) set(sx(s, i), j, k, j === 5 ? BLACK : -1);
          set(sx(s, 3), j, k, BLACK);
        }
        for (const k of [kc - 4, kc + 4]) for (let j = 1; j <= 5; j++) { set(sx(s, 4), j, k, BLACK); if (!inDoor(k)) set(sx(s, 5), j, k, BLACK); }
      }
      // ---- under the bonnet ----
      bx(g, -3, 2, 2, 4, cowl + 3, cowl + 6, (i, j, k) => ((k + j) & 1 ? ENGINE : ENGINE2));
      bx(g, -2, 1, 5, 5, cowl + 3, cowl + 6, COVER); bx(g, -1, 0, 5, 5, cowl + 3, cowl + 6, 0x30323a);   // rocker cover with a dark rail
      bx(g, -5, 4, 2, 5, k1 - 1, k1 - 1, (i, j) => RAD[(i + j) & 1]);                       // radiator
      bx(g, 1, 2, 2, 3, cowl + 1, cowl + 2, BATT); g.set(1, 4, cowl + 1, 0xc23b2e); g.set(2, 4, cowl + 1, 0x8a8e94);   // battery and its terminals
      bx(g, -3, -2, 2, 4, cowl + 1, cowl + 1, 0xd9e6ee);                                    // washer bottle
      bx(g, -2, 1, 2, 2, cowl + 7, k1 - 2, ENGINE2);
      // ---- inside ----
      const sk = doors[0][0], bk = rear[0] + 3;                                             // where the front seat backs and the rear bench back stand
      bx(g, -5, 4, 4, 6, cowl - 2, cowl - 1, DASH); bx(g, 1, 3, 7, 7, cowl - 2, cowl - 2, DASH);       // dashboard and the hood over the dials
      set(2, 6, cowl - 3, WHEELC); bx(g, 1, 3, 7, 7, cowl - 3, cowl - 3, WHEELC); set(2, 8, cowl - 3, WHEELC);   // steering wheel, on the left
      bx(g, -1, 0, 2, 3, sk, cowl - 3, DASH); set(0, 4, sk + 3, CHROME);                    // console and gear lever
      for (const s of SIDES) { bxs(g, s, 1, 4, 2, 3, sk, sk + 3, SEAT); bxs(g, s, 1, 4, 4, 8, sk, sk, SEAT2); bxs(g, s, 2, 3, 9, 9, sk, sk, SEAT); }   // front seats with head rests
      bx(g, -5, 4, 2, 3, bk + 1, bk + 3, SEAT); bx(g, -5, 4, 4, 8, bk, bk, SEAT2); for (const s of SIDES) bxs(g, s, 2, 3, 9, 9, bk, bk, SEAT);            // rear bench
      if (taxi) { bx(g, -5, 4, 4, 9, sk - 1, sk - 1, (i, j) => (j >= 7 ? 0x6f8c98 : 0x5a5e64)); bx(g, -1, 0, 7, 8, cowl - 2, cowl - 2, 0x3fd07a | GLOW); }   // partition and the fare meter
      if (police) bx(g, -5, 4, 4, 9, sk - 1, sk - 1, (i, j) => ((i + j) & 1 ? 0x3a3d42 : -1));                                                    // a cage
      // ---- in the boot ----
      if (!hatch) { bx(g, -4, -1, 2, 3, k0 + 2, k0 + 4, 0x7a5332); bx(g, -3, -2, 4, 4, k0 + 3, k0 + 3, 0x4e341f); bx(g, 1, 4, 2, 2, k0 + 2, k0 + 5, TYRE[1]); bx(g, 2, 3, 2, 2, k0 + 3, k0 + 4, RIM); bx(g, 0, 1, 2, 3, k0 + 6, k0 + 6, 0xb5332a); }
      else { bx(g, -4, -2, 2, 4, k0 + 1, k0 + 2, 0x7a5332); bx(g, 0, 3, 2, 3, k0 + 1, k0 + 2, 0x3f6f9a); }
    } },
    // ---- bonnet, hinged at the windscreen ----
    { name: 'hood', parent: 'body', pivot: [0, 6, cowl + 1], box: [-6, 0, 0, 6, 1, k1 - cowl - 1], paint: (g) => {
      const n = k1 - 1 - cowl;
      bx(g, -6, 5, 0, 0, 0, n - 1, (i, j, k) => (police ? 0x23272f : tone(base, (i === -1 || i === 0) ? 1.13 : 1.07)));
      if (taxi) bx(g, -2, 1, 0, 0, 2, 3, 0xf4f1e8);                                         // the medallion number
    } },
    // ---- boot lid, hinged under the rear window; on the hatchback the whole tailgate, hinged at the roof ----
    hatch
      ? { name: 'boot', parent: 'body', pivot: [0, 11, roofR], box: [-5, -4, -2, 5, 0, 0], paint: (g) => {
        for (let r = 0; r < 4; r++) for (let i = -5; i <= 4; i++) g.set(i, r - 4, rear[r] - roofR, r === 0 ? (half(i) === 0 ? CHROME : pc(6)) : screenGlass(i + 3, 7 + r, 0));
        g.set(2, -3, rear[1] - roofR, TRIM); g.set(1, -3, rear[1] - roofR, TRIM);           // rear wiper
      } }
      : { name: 'boot', parent: 'body', pivot: [0, 6, rear[0]], box: [-6, 0, k0 + 1 - rear[0], 6, 1, 0], paint: (g) => bx(g, -6, 5, 0, 0, k0 + 1 - rear[0], -1, lidC) },
    door('dFL', 1, doors[0], true), door('dFR', -1, doors[0], true),
    ...(doors[1] ? [door('dRL', 1, doors[1], false), door('dRR', -1, doors[1], false)] : []),
    wheel('wFL', 1, archF), wheel('wFR', -1, archF), wheel('wRL', 1, archR), wheel('wRR', -1, archR),
    // ---- lamps that light: head and tail lamps when it is driven, indicators when the alarm goes ----
    { name: 'lights', parent: 'body', pivot: [0, 0, 0], box: [-7, 3, k0, 7, 6, k1 + 1], paint: (g) => {
      for (let i = -6; i <= 5; i++) { const a = half(i); if (a === 3 || a === 4) { g.set(i, 3, k1, LAMP); g.set(i, 4, k1, LAMP); } if (a >= 3) g.set(i, 5, k0, TAIL); if (a === 4) g.set(i, 4, k0, TAIL); }
    } },
    { name: 'hazard', parent: 'body', pivot: [0, 0, 0], box: [-7, 3, k0, 7, 6, k1 + 1], paint: (g) => {
      for (const s of SIDES) { const i = sx(s, 5); g.set(i, 3, k1, AMBER); g.set(i, 4, k1, AMBER); g.set(i, 4, k0, AMBER); }
    } },
  ];
  if (taxi) parts.push({ name: 'sign', parent: 'body', pivot: [0, 12, -2], box: [-3, 0, -1, 3, 2, 1], paint: (g) => bx(g, -3, 2, 0, 1, -1, 0, (i, j) => ((i + 3) % 3 === 1 && j === 0 ? SIGN2 : SIGN)) });
  if (police) parts.push(
    { name: 'barR', parent: 'body', pivot: [3, 12.5, -2], box: [-2, -0.5, -1, 2, 0.5, 1], paint: (g) => g.fill(() => RED) },
    { name: 'barB', parent: 'body', pivot: [-3, 12.5, -2], box: [-2, -0.5, -1, 2, 0.5, 1], paint: (g) => g.fill(() => BLUE) });
  return parts;
}

// ---- clips ----
const OFF = [0, 0, 0, 0, 0, 0, 0], LIT = [0, 0, 0, 0, 0, 0, 1.012], BAR = [0, 0, 0, 0, 0, 0, 1.08];
const R_WHEEL = 2.5 * H;   // wheel radius in town voxels
const spin = (a, steer = 0) => ({ wFL: [a, steer, 0], wFR: [a, steer, 0], wRL: [a, 0, 0], wRR: [a, 0, 0] });
const dark = { lights: OFF, hazard: OFF, barR: OFF, barB: OFF };
const bars = (t) => ({ barR: fl(t * 5) & 1 ? BAR : OFF, barB: fl(t * 5) & 1 ? OFF : BAR });
const spring = (t, k = 6, w = 9) => 1 - Math.exp(-k * t) * C(w * t);   // swings to 1, overshoots and settles
const sideOf = (u) => (u.phase > PI ? 1 : -1);

export const CAR = {
  kind: 'car', h: H, parts: carParts, start: 'Parked', dieAt: 0.2, inner: INNER, respawn: 8,
  clips: {
    Parked: { loop: true, speed: 0, pose: () => ({ ...spin(0), ...dark }) },
    Drive: { loop: true, speed: 22, pose: (t, u) => ({ ...spin(t * 22 / R_WHEEL), body: [0.01 * S(t * 6 + u.phase), 0, 0.008 * S(t * 4.7 + u.phase), 0, 0.04 * ab(S(t * 7 + u.phase)), 0], ...dark, lights: LIT, ...(u.opts.type === 'police' ? bars(t) : {}) }) },
    // the alarm going off when the monster thumps the street: the indicators blink and the car rocks on its springs
    Alarm: { loop: true, speed: 0, pose: (t, u) => {
      const k = Math.exp(-((t % 2.4) * 2.2)), w = S(t * 17), on = fl(t * 2.6 + 0.5) & 1;
      return { ...spin(0), body: [0.025 * k * w, 0, 0.04 * k * C(t * 13), 0, -0.12 * k * ab(w), 0], ...dark, hazard: on ? LIT : OFF, ...(u.opts.type === 'police' ? bars(t) : {}) };
    } },
    // everything opened up, to see inside
    Open: { loop: false, dur: 1.2, speed: 0, pose: (t) => {
      const a = ease(clamp(t / 0.9)), d = 1.15 * a;
      return { ...spin(0), ...dark, hood: [-0.95 * a, 0, 0], boot: [1.0 * a, 0, 0], dFL: [0, -d, 0], dRL: [0, -d, 0], dFR: [0, d, 0], dRR: [0, d, 0] };
    } },
    // Blown up where it stands: it jumps and comes down on burst tyres, leaning on the corner that lost its wheel. The bonnet
    // is thrown clear, the doors on the blast side are flung open and the boot springs.
    WreckStand: { loop: false, hidden: true, dur: 1.8, speed: 0, pose: (t, u) => {
      const sd = sideOf(u), e = ease(clamp(t / 0.45)), hop = Math.max(0, 15 * t - 42 * t * t);
      const a = clamp(t / 0.95), land = Math.max(0, t - 0.95), fall = ease(clamp((t - 0.55) / 0.45)), roll = ease(clamp(t / 1.0));
      const lost = sd > 0 ? 'wFL' : 'wFR', P = {
        ...spin(0), ...dark,
        body: [0, 0.1 * sd * e, -0.075 * sd * e, 0, hop - 0.22 * e, 0],
        hood: [-(2 * PI) * a - 0.5 * S(PI * a), 1.3 * sd * a, 0, -9.5 * sd * a, 22 * a * (1 - a) - 2.75 * a + (a >= 1 ? 0.5 * Math.exp(-land * 9) * ab(S(land * 18)) : 0), 3.5 * a],
        boot: [1.0 * spring(t, 5, 8), 0, 0],
        dFL: [0, -(sd > 0 ? 1.25 : 0.45) * spring(t), sd > 0 ? 0.07 * e : 0], dFR: [0, (sd < 0 ? 1.25 : 0.45) * spring(t), sd < 0 ? -0.07 * e : 0],
        dRL: [0, -(sd > 0 ? 0.3 : 0.95) * spring(t, 5, 7), 0], dRR: [0, (sd < 0 ? 0.3 : 0.95) * spring(t, 5, 7), 0],
      };
      P[lost] = [9 * roll, 0.5 * sd * roll, sd * (PI / 2) * fall, sd * 6.5 * roll, -0.72 * fall + 1.6 * roll * (1 - roll), 2.5 * roll];   // the wheel rolls off and falls flat
      return P;
    } },
    // Thrown into the air and over onto its roof; the wheels go on turning for a while.
    WreckRoof: { loop: false, hidden: true, dur: 5, speed: 0, pose: (t, u) => {
      const sd = sideOf(u), T = 1.0, a = clamp(t / T), e = ease(a), land = Math.max(0, t - T), w = 16 / 1.1 * (1 - Math.exp(-1.1 * t));
      const y = a < 1 ? 5.6 * e + 30 * a * (1 - a) * 0.36 : 5.6 + 0.9 * Math.exp(-land * 7) * ab(S(land * 15)), flop = spring(Math.max(0, t - 0.5), 4, 7) * (t > 0.5 ? 1 : 0);
      return { ...spin(w), ...dark, body: [0.3 * S(PI * a) * (1 - a), 0.45 * sd * e, PI * sd * e, 1.5 * sd * e, y, -1.5 * e],
        hood: [-0.62 * flop, 0, 0], boot: [0.3 * flop, 0, 0], dFL: [0, -0.5 * flop, 0], dFR: [0, 0.8 * flop, 0], dRL: [0, -0.9 * flop, 0], dRR: [0, 0.35 * flop, 0] };
    } },
    // Rolled onto its side; the doors that end up on top fall open.
    WreckSide: { loop: false, hidden: true, dur: 5, speed: 0, pose: (t, u) => {
      const sd = sideOf(u), T = 0.85, a = clamp(t / T), e = ease(a), land = Math.max(0, t - T), w = 12 / 1.3 * (1 - Math.exp(-1.3 * t));
      const y = a < 1 ? 3.3 * e + 22 * a * (1 - a) * 0.3 : 3.3 + 0.7 * Math.exp(-land * 7) * ab(S(land * 15)), flop = spring(Math.max(0, t - 0.45), 3.5, 6) * (t > 0.45 ? 1 : 0);
      const up = sd > 0;   // the left side ends up on top when it rolls this way
      return { ...spin(w), ...dark, body: [0.15 * S(PI * a), 0.3 * sd * e, PI / 2 * sd * e, -2.5 * sd * e, y, 1.0 * e],
        hood: [-0.3 * flop, 0, 0], boot: [0.35 * flop, 0, 0], dFL: [0, up ? -0.75 * flop : 0, 0], dRL: [0, up ? -0.4 * flop : 0, 0], dFR: [0, up ? 0 : 0.75 * flop, 0], dRR: [0, up ? 0 : 0.4 * flop, 0] };
    } },
    // Flattened under a foot: the body is pressed flat in place (see crush) and the wheels splay out from under it.
    Crushed: { loop: false, hidden: true, dur: 0.3, speed: 0, pose: (t) => {
      const e = clamp(t / 0.1);
      return { ...dark, wFL: [0, 0.25 * e, -1.25 * e, 1.5 * e, -0.75 * e, 0.4 * e], wFR: [0, -0.2 * e, 1.3 * e, -1.6 * e, -0.75 * e, 0.2 * e], wRL: [0, -0.2 * e, -1.2 * e, 1.4 * e, -0.75 * e, -0.3 * e], wRR: [0, 0.3 * e, 1.25 * e, -1.5 * e, -0.75 * e, -0.5 * e], sign: [0, 0, 0, 0, 0, 0, 0] };
    } },
  },
  onKill(u, point, r, debris) { blowUp(u, debris, point); },
};
const WRECKS = ['WreckStand', 'WreckRoof', 'WreckSide', 'WreckStand'];

// every cube of every part, with where it is in the body's own cube grid when the part is at rest
function bodyPos(u, p, i, j, k, out) {
  const r = u.rest[p.name].pos, h = p.h, own = p.name === 'body' ? 0 : 1;   // rest pivots are relative to the body for every part here
  out[0] = own * r[0] / h + p.i0 + i + 0.5; out[1] = own * r[1] / h + p.j0 + j + 0.5; out[2] = own * r[2] / h + p.k0 + k + 0.5;
  return out;
}
const _q = [0, 0, 0];
let _vec = null; const v3 = (p) => (_vec || (_vec = new p.bone.position.constructor()));
function toss(p, i, j, k, c, debris, cx, cy, cz, push) {
  const h = p.h, w = p.bone.localToWorld(v3(p).set((p.i0 + i + 0.5) * h, (p.j0 + j + 0.5) * h, (p.k0 + k + 0.5) * h));
  const dx = w.x - cx, dy = w.y - cy, dz = w.z - cz, d = Math.hypot(dx, dy, dz) + 0.01, s = push * (0.4 + Math.random());
  debris(w.x, w.y, w.z, dx / d * s, ab(dy) / d * s + 5 + Math.random() * 12, dz / d * s, c & 0xffffff, c === SHARD ? h * 0.5 : h);
}

// The car goes up. The blast starts in the engine bay or at the tank: it tears cubes off round there, blows every window
// out, blackens the body nearest it and leaves the paint showing, sooty, further away. Then one of three wrecks plays.
export function blowUp(u, debris) {
  if (u.blown) return; u.blown = true; u.dead = true; u.deadT = 0;
  u.root.updateWorldMatrix(true, true);
  const sp = specOf(u.opts.type), seed = u.opts.seed || 0, clip = u.wreckClip || WRECKS[seed % WRECKS.length], frontal = clip === 'WreckStand' || hash(seed, 3, 7, 1) < 0.5;
  const O = [0, 4, frontal ? sp.archF - 1 : sp.archR + 4];   // the seat of the blast, in body cubes
  u.blast = O;
  const c0 = u.bones.body.localToWorld(v3(u.parts[0]).set(O[0] * H, O[1] * H, O[2] * H)).clone();
  let thrown = 0;
  for (const p of u.parts) {
    const { nx, ny, nz, col } = p; if (p.name === 'lights' || p.name === 'hazard') continue;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const n = (k * ny + j) * nx + i, c = col[n]; if (c < 0) continue;
      const q = bodyPos(u, p, i, j, k, _q), d = Math.hypot(q[0] - O[0], q[1] - O[1], q[2] - O[2]);
      const lump = hash(fl(q[0] / 2), fl(q[1] / 2), fl(q[2] / 2), seed + 41), grain = hash(fl(q[0]), fl(q[1]), fl(q[2]), seed + 5);
      const gone = isGlass(c) || lump < 0.5 * clamp(1 - d / 13) || grain < 0.03;
      if (gone) { col[n] = -1; p.count--; if (thrown < 420 && grain < (isGlass(c) ? 0.3 : 0.7)) { thrown++; toss(p, i, j, k, isGlass(c) ? SHARD : tone(c & 0xffffff, 0.5), debris, c0.x, c0.y - 1, c0.z, 20); } continue; }
      // soot: black at the seat of the blast, streaked further out, the paint still showing at the far end
      const burn = clamp(Math.max(0.34, 1.25 - d / 15) + (lump - 0.5) * 0.5 + (grain - 0.5) * 0.2);
      col[n] = tone(c & 0xffffff, 0.92 - 0.72 * burn);
    }
    p.dirty = true;
  }
  u.play(clip, 0.04);
}
// A wreck goes on charring as it burns: call now and then with a small amount (0.1 or so).
export function char(u, amt = 0.1) {
  for (const p of u.parts) {
    const { col } = p;
    for (let n = 0; n < col.length; n++) { const c = col[n]; if (c < 0) continue; const v = tone(c & 0xffffff, 1 - amt * (0.5 + hash(n, 2, 5, 9))); col[n] = ((v >> 16) & 255) < 24 && ((v >> 8) & 255) < 24 ? (c & 0xffffff) : v; }
    p.dirty = true;
  }
}

// Squash a car flat where it stands, as when the monster steps on it. The bonnet, boot and doors are pressed into the body,
// then every column of cubes is pushed down: hardest under the foot (fx, fz, in body cubes), less at the ends, so it
// crumples instead of shrinking. The glass bursts out as shards. `debris` gets the shards and a few torn panels.
export function crush(u, debris, fx = 0, fz = 0) {
  if (u.crushed) return; u.crushed = true; u.dead = true; u.deadT = 0;
  u.root.updateWorldMatrix(true, true);
  const body = u.parts.find((p) => p.name === 'body'), seed = u.opts.seed || 0;
  const c0 = u.bones.body.localToWorld(v3(body).set(fx * H, 2, fz * H)).clone();
  let shards = 0;
  // press the loose panels into the body's own grid (they sit on it cube for cube when shut); on a wreck they are already
  // hanging off, so they are scattered instead
  for (const p of u.parts) {
    if (p === body || /^w[FR]/.test(p.name)) continue;
    const { nx, ny, nz, col } = p, shut = !u.blown && !/^(lights|hazard|bar.|sign)$/.test(p.name);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const n = (k * ny + j) * nx + i, c = col[n]; if (c < 0) continue;
      if (shut) { const q = bodyPos(u, p, i, j, k, _q); body.set(fl(q[0]), fl(q[1]), fl(q[2]), c); }
      else if (u.blown && shards < 200 && hash(i, j, k, 3) < 0.4) { shards++; toss(p, i, j, k, c, debris, c0.x, c0.y, c0.z, 9); }
      col[n] = -1;
    }
    p.count = 0; p.dirty = true;
  }
  const { nx, ny, nz, col, i0, k0 } = body, out = new Int32Array(col.length).fill(-1);
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const x = i0 + i + 0.5, z = k0 + k + 0.5, d = Math.hypot((x - fx) * 1.3, z - fz);
    // how much of its height this column keeps
    const keep = 0.2 + 0.3 * ease(clamp((d - 4) / 14)) + 0.1 * (hash(fl(x / 2), 7, fl(z / 2), seed) - 0.5);
    let top = -1, jb = -1;
    for (let j = 0; j < ny; j++) {
      const n = (k * ny + j) * nx + i, c = col[n]; if (c < 0) continue;
      if (isGlass(c)) { if (shards < 320 && hash(i, j, k, 9) < 0.55) { shards++; toss(body, i, j, k, SHARD, debris, c0.x, c0.y, c0.z, 12); } continue; }
      if (jb < 0) jb = j;
      const nj = Math.max(0, Math.round((j - 1) * keep)), m = (k * ny + nj) * nx + i;   // the floor (j = 1) comes down onto the road
      const folded = (c & GLOW) ? tone(c & 0xffffff, 0.45) : j - jb > 2 ? tone(c, 0.74 + 0.24 * hash(i, j, k, 4)) : c;
      if (nj >= top) { out[m] = folded; top = nj; }                                     // what was on top stays on top
      else if (out[m] < 0) out[m] = folded;
    }
  }
  let count = 0; for (let n = 0; n < out.length; n++) if (out[n] >= 0) count++;
  body.col = out; body.count = count; body.dirty = true;
  u.play('Crushed', 0);
}

// Where fires sit on a wreck: on whichever face of the body is uppermost as it lies now, at the cubes nearest the seat of
// the blast, as points in the body bone's space. Call again once the wreck has come to rest.
export function fireSpots(u, n = 12) {
  const p = u.parts.find((q) => q.name === 'body'), O = u.blast || [0, 4, 0], found = [], dims = [p.nx, p.ny, p.nz], org = [p.i0, p.j0, p.k0];
  u.root.updateWorldMatrix(true, true);
  const e = p.bone.matrixWorld.elements, up = [e[1], e[5], e[9]];   // world up, seen from the body
  let a = 0; for (let m = 1; m < 3; m++) if (ab(up[m]) > ab(up[a])) a = m;
  const sg = up[a] > 0 ? 1 : -1, b = (a + 1) % 3, c = (a + 2) % 3, q = [0, 0, 0];
  for (q[b] = 0; q[b] < dims[b]; q[b]++) for (q[c] = 0; q[c] < dims[c]; q[c]++) for (let m = 0; m < dims[a]; m++) {
    q[a] = sg > 0 ? dims[a] - 1 - m : m;
    if (a === 1 && sg > 0 && org[1] + q[1] > 8) continue;   // upright: the fire is in the engine bay, the boot and the seats, not on the roof
    if (p.at(q[0], q[1], q[2]) < 0) continue;
    const w = [org[0] + q[0] + 0.5, org[1] + q[1] + 0.5, org[2] + q[2] + 0.5]; w[a] += 0.5 * sg;
    found.push([Math.hypot(w[b] - O[b], w[c] - O[c]) + 7 * hash(q[b], 1, q[c], 2), w[0] * p.h, w[1] * p.h, w[2] * p.h]); break;
  }
  found.sort((x, y) => x[0] - y[0]);
  const out = []; for (let m = 0; m < found.length && out.length < n; m += 3) out.push(found[m].slice(1));
  return out;
}
export const CAR_TYPES = ['sedan', 'hatch', 'taxi', 'police'];
