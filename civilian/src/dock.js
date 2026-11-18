// The docks, built in code at eighth-metre cubes on the same kit as the cars and boats: a harbor crane that slews, luffs
// and hoists a load, a timber jetty in sections, and stacks of cargo for the quay.
//
// They break with the cars' own code (blowUp, crush, fireSpots in cars.js), set up by `wk` on each definition.
// - The crane stands on rails that run along x, with its jib out over the water toward +z; y = 0 is the top of the rail.
// - A jetty section runs along z, 64 cubes long; y = 0 is the water, and its planks are 11 cubes above it. Sections are
//   laid end to end, the last one of type `end`.
// - A cargo stack stands on a pallet at y = 0.
import { GLOW, hash, tone } from '../../units/src/voxpart.js';
import { blowUp, H, bx, bxs, sx, SIDES, half, clamp, ease, sideOf, BLACK, GLASS, GLASS2, SHINE, DASH, INNER } from './cars.js';
import { lamp } from './buses.js';
import { crate, BOXES } from './boats.js';

const S = Math.sin, C = Math.cos, PI = Math.PI, ab = Math.abs, fl = Math.floor, rnd = Math.round;
const mod = (a, n) => ((a % n) + n) % n;
const YEL = 0xe0b020, BLK = 0x25272b, STEELD = 0x4a4e55, STEELL = 0x8a8e94, GRATE = 0x5f646b, CONC = 0x6f7074, ROPEC = 0x2b2d31;
const TAR = 0x3a2c20, TAR2 = 0x2e2319, WET = 0x241c15, ALGAE = 0x3c5a34, TIMBER = 0x7a5c3c, TIMBER2 = 0x8a6b48, TIMBER3 = 0x5f4630, GREYW = 0x8d8676, IRON = 0x2a2c30, HEMP = 0x9a7a45;
const RED_L = 0xff2a2a | GLOW, GREEN_L = 0x35e06a | GLOW;
const ON = [0, 0, 0, 0, 0, 0, 1.1], OFF = [0, 0, 0, 0, 0, 0, 0];
const glass = (j, q) => (mod(q * 2 + j * 3, 13) === 0 ? SHINE : j >= 11 ? GLASS2 : GLASS);

// a straight run of cubes from a to b, stepped one axis at a time so that it holds together face to face
function line(g, a, b, c) {
  const n = Math.max(ab(b[0] - a[0]), ab(b[1] - a[1]), ab(b[2] - a[2]), 1); let p = a.map(rnd);
  g.set(p[0], p[1], p[2], c);
  for (let s = 1; s <= n; s++) { const q = [0, 1, 2].map((x) => rnd(a[x] + (b[x] - a[x]) * s / n)); for (const x of [1, 2, 0]) if (q[x] !== p[x]) { p = p.slice(); p[x] = q[x]; g.set(p[0], p[1], p[2], c); } }
}
// a ring five cubes across in the fore-and-aft plane at i (an old tyre, a life ring); c is a function of the angle step
function ring(g, i, j, k, c) {
  for (let dj = -2; dj <= 2; dj++) for (let dk = -2; dk <= 2; dk++) { const a = ab(dj), b = ab(dk); if ((Math.max(a, b) === 2 && a + b < 4) || (a === 1 && b === 1)) g.set(i, j + dj, k + dk, c(dj, dk)); }
}
// the six faces of a box and nothing inside; c may be a function (i, j, k)
function hollow(g, i0, i1, j0, j1, k0, k1, c) {
  for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (i === i0 || i === i1 || j === j0 || j === j1 || k === k0 || k === k1) g.set(i, j, k, c);
}

// =====================================================================================================================
// The harbor crane: a portal on four bogies that traffic can pass under, a machinery house that slews on top of it with
// the driver's cab at one front corner and a counterweight behind, an A-frame, and a lattice jib 13 m long. The load
// hangs from the jib head on two falls of rope: `rope` is kept plumb, and `hook` slides down it to pay the rope out.
// =====================================================================================================================
export const CRANE_PAINT = { green: 0x3f7a5a, blue: 0x2f62a8, orange: 0xd9692a, grey: 0x8c9198, yellow: 0xd9a520 };
const CR = { GX: 20, GZ: 16, TOP: 47, SLEW: 50, FOOT: [0, 8, 12], JIB: 102, ROPE: 60 };
const LUFF = 68 * PI / 180;

function craneParts(o) {
  const seed = o.seed || 0, P = CRANE_PAINT[o.paint] ?? CRANE_PAINT.green, PD = tone(P, 0.76), PL = tone(P, 1.16), { GX, GZ, TOP, JIB } = CR;
  const stripes = (i, j, k) => (mod(i + j + k, 4) < 2 ? YEL : BLK);
  const parts = [
    { name: 'body', parent: null, pivot: [0, 0, 0], box: [-27, 0, -29, 27, 100, 25], paint: (g) => {
      for (const kz of [-GZ, GZ]) {
        // a sill beam along each rail, a two-wheeled bogie under each end of it, a buffer on the end
        bx(g, -GX - 3, GX + 2, 5, 8, kz - 2, kz + 1, (i, j) => (j === 8 ? PL : PD));
        for (const s of SIDES) {
          bxs(g, s, GX - 5, GX + 4, 3, 4, kz - 2, kz + 1, STEELD);
          for (const ic of [GX - 5, GX + 1]) bxs(g, s, ic, ic + 3, 0, 2, kz - 1, kz, (i, j) => (j === 1 ? STEELL : BLK));
          bxs(g, s, GX + 3, GX + 4, 5, 7, kz - 1, kz, stripes);
          // the leg: a box section, striped at the foot
          for (let j = 9; j <= TOP - 3; j++) for (let a = GX - 2; a <= GX + 1; a++) for (let k = kz - 2; k <= kz + 1; k++) {
            if (a > GX - 2 && a < GX + 1 && k > kz - 2 && k < kz + 1) continue;
            g.set(sx(s, a), j, k, j <= 16 ? stripes(a, j, k) : mod(j, 12) === 5 ? PD : P);
          }
          // knee braces up to the top girders, across the rails and along them
          const dz = kz < 0 ? 1 : -1;
          line(g, [sx(s, GX), TOP - 14, kz + dz * 2], [sx(s, GX), TOP - 3, kz + dz * 13], PD);
          line(g, [sx(s, GX - 3), TOP - 14, kz], [sx(s, GX - 14), TOP - 3, kz], PD);
        }
      }
      // the portal top: a ring of box girders, two more across under the slewing ring, a deck of grating, a handrail
      for (let i = -GX - 2; i <= GX + 1; i++) for (let k = -GZ - 2; k <= GZ + 1; k++) {
        const onI = half(i) >= GX - 2, onK = k < -GZ + 2 || k > GZ - 3, per = i === -GX - 2 || i === GX + 1 || k === -GZ - 2 || k === GZ + 1;
        if (onI || onK) for (let j = TOP - 2; j <= TOP; j++) g.set(i, j, k, j === TOP ? PL : P);
        else g.set(i, TOP, k, (i + k) & 1 ? GRATE : tone(GRATE, 0.86));
        if (!per) continue;
        const cornerI = i === -GX - 2 || i === GX + 1, cornerK = k === -GZ - 2 || k === GZ + 1, post = (cornerI && cornerK) || (cornerK && mod(i, 6) === 0) || (cornerI && mod(k, 6) === 0);
        g.set(i, TOP + 4, k, YEL); g.set(i, TOP + 2, k, post ? YEL : -1); if (post) { g.set(i, TOP + 1, k, YEL); g.set(i, TOP + 3, k, YEL); }
      }
      for (const kc of [-7, 5]) bx(g, -GX + 2, GX - 3, TOP - 2, TOP - 1, kc, kc + 1, PD);
      for (let i = -9; i < 9; i++) for (let k = -9; k < 9; k++) { const r = Math.hypot(i + 0.5, k + 0.5); if (r < 9) for (let j = TOP + 1; j <= TOP + 2; j++) if (r > 6.6 || j === TOP + 2) g.set(i, j, k, r > 7.8 ? STEELD : BLK); }
      // a ladder up one leg, and the cable drum on the landward sill
      for (let j = 9; j <= TOP + 4; j++) { g.set(GX + 2, j, GZ - 2, YEL); g.set(GX + 2, j, GZ + 1, YEL); if (j & 1) { g.set(GX + 2, j, GZ - 1, STEELL); g.set(GX + 2, j, GZ, STEELL); } }
      bx(g, -6, 5, 9, 15, -GZ - 2, -GZ + 1, (i, j, k) => (half(i) === 5 ? STEELD : j >= 10 && j <= 14 ? (mod(i, 2) ? 0xd9692a : 0xb85520) : STEELD));
    } },
    // ---- the house, slewing on the ring ----
    { name: 'house', parent: 'body', pivot: [0, CR.SLEW, 0], box: [-14, 0, -27, 17, 50, 18], paint: (g) => {
      const W = 12, K0 = -18, K1 = 11, HT = 18;
      bx(g, -W, W - 1, 0, 0, K0 - 6, K1, STEELD);
      for (let k = K0; k <= K1; k++) for (let i = -W; i < W; i++) {
        const side = i === -W || i === W - 1, end = k === K0 || k === K1; if (!side && !end) continue;
        for (let j = 1; j <= HT; j++) {
          let c = j <= 2 ? PD : j === HT ? PL : mod(k - K0, 6) === 5 && side ? tone(P, 0.93) : P;
          if (side && j >= 8 && j <= 12 && k >= K0 + 4 && k <= K1 - 7 && mod(k - K0, 6) < 4) c = glass(j, k);
          if (end && k === K0 && j >= 5 && j <= 14 && half(i) <= 7 && mod(j, 2) === 1) c = 0x3a3d42;                        // louvres over the machinery
          if (side && i === -W && k >= K1 - 5 && k <= K1 - 2 && j >= 1 && j <= 12) c = j === 9 && k === K1 - 3 ? GLASS : tone(P, 0.6);   // the door
          if (end && k === K1 && j >= 12 && j <= 16 && half(i) <= 8) c = mod(i + seed, 5) !== 0 && j >= 13 && j <= 15 ? 0xe9e6dc : c;   // the maker's plate, in made-up letters
          g.set(i, j, k, c);
        }
      }
      bx(g, -W - 1, W, HT + 1, HT + 1, K0 - 1, K1 + 1, (i, j, k) => (i === -W - 1 || i === W || k === K0 - 1 || k === K1 + 1 ? STEELL : 0xb9bcc0));
      // the counterweight, hung behind
      hollow(g, -10, 9, 1, 12, K0 - 6, K0 - 1, (i, j, k) => (j === 12 || j === 1 ? stripes(i, 0, k) : mod(j, 4) === 0 || mod(i, 7) === 3 ? tone(CONC, 0.8) : CONC));
      // the driver's cab at the front port corner, glazed on three sides
      for (let k = 6; k <= 16; k++) for (let i = 8; i <= 15; i++) for (let j = 2; j <= 14; j++) {
        const f = (i === 8) + (i === 15) + (j === 2) + (j === 14) + (k === 6) + (k === 16);
        if (i < W && k <= K1) { if (!f && j >= 3) g.set(i, j, k, -1); continue; }                 // inside the house: open through to it
        if (!f) continue;
        const win = f === 1 && (k === 16 || i === 15 || i === 8) && j >= 5 && j <= 12;
        g.set(i, j, k, win ? glass(j, i + k) : j === 14 ? PL : f >= 2 ? PD : P);
      }
      for (let j = 3; j <= 13; j++) { for (let i = 9; i <= 11; i++) g.set(i, j, K1, -1); for (let k = 7; k <= 11; k++) g.set(W - 1, j, k, -1); }
      bx(g, 10, 13, 3, 4, 9, 11, 0x33363c); bx(g, 10, 13, 5, 8, 9, 9, 0x33363c); bx(g, 9, 14, 3, 5, 14, 15, DASH);   // seat and desk
      // the A-frame: two legs raked forward over the jib foot, two back stays, the head block with its sheaves
      for (const s of SIDES) { line(g, [sx(s, 8), HT + 2, -8], [sx(s, 2), 45, 2], P); line(g, [sx(s, 8), HT + 2, K0 + 1], [sx(s, 2), 45, 0], PD); }
      bx(g, -6, 5, 32, 32, -3, -2, PD);
      bx(g, -3, 2, 44, 47, 0, 3, (i, j, k) => (half(i) === 1 && j >= 45 && j <= 46 && k >= 1 && k <= 2 ? BLK : STEELD));
      // the jib's foot bearings
      for (const s of SIDES) bxs(g, s, 3, 4, 1, 9, K1 + 1, K1 + 2, STEELD);
    } },
    { ...lamp('bcn', [[-1, 48, 1], [0, 48, 1], [-1, 48, 2], [0, 48, 2]], RED_L), parent: 'house' },
    // ---- the jib: four chords laced together, tapering to the head; red and white toward the tip ----
    { name: 'jib', parent: 'house', pivot: CR.FOOT, box: [-7, -7, -1, 7, 7, JIB + 4], paint: (g) => {
      const wAt = (k) => Math.max(2, rnd(k < 12 ? 2 + k / 3 : 6 - 4 * (k - 12) / (JIB - 12)));
      const col = (k) => (k > JIB - 30 ? (mod(fl((JIB - k) / 6), 2) ? 0xe9e6dc : 0xc23b2e) : P);
      const ring = (k, w) => { for (let i = -w; i < w; i++) for (let j = -w; j < w; j++) if (i === -w || i === w - 1 || j === -w || j === w - 1) g.set(i, j, k, tone(col(k), 0.8)); };
      let wp = wAt(0);
      for (let k = 0; k <= JIB; k++) {
        const w = wAt(k); for (const i of [-w, w - 1]) for (const j of [-w, w - 1]) g.set(i, j, k, col(k));
        if (w !== wp) { ring(k, Math.max(w, wp)); wp = w; } else if (mod(k, 12) === 0) ring(k, w);
      }
      // the lacing: a diagonal across each face of every panel, turning about from panel to panel
      for (let k0 = 0, n = 0; k0 + 12 <= JIB; k0 += 12, n++) {
        const a = wAt(k0), b = wAt(k0 + 12), c = tone(col(k0 + 6), 0.86), fw = n & 1;
        line(g, [fw ? -a : a - 1, a - 1, k0], [fw ? b - 1 : -b, b - 1, k0 + 12], c); line(g, [fw ? a - 1 : -a, -a, k0], [fw ? -b : b - 1, -b, k0 + 12], c);
        line(g, [a - 1, fw ? -a : a - 1, k0], [b - 1, fw ? b - 1 : -b, k0 + 12], c); line(g, [-a, fw ? a - 1 : -a, k0], [-b, fw ? -b : b - 1, k0 + 12], c);
      }
      bx(g, -2, 1, -3, 2, JIB - 2, JIB + 2, (i, j, k) => (half(i) === 0 && j >= -2 && j <= 1 && k >= JIB - 1 && k <= JIB + 1 ? BLK : STEELD));   // the head, with its sheaves
      bx(g, -3, 2, -1, 0, -1, 0, STEELD);
    } },
    // ---- the rope: two falls from the head, and the same again on the hook, which slides down them ----
    { name: 'rope', parent: 'jib', pivot: [0, 0, JIB], box: [-1, -CR.ROPE, 0, 1, 0, 1], paint: (g) => { for (let j = -CR.ROPE; j < 0; j++) for (const i of [-1, 0]) g.set(i, j, 0, mod(j, 5) ? ROPEC : 0x3a3d42); } },
    { name: 'hook', parent: 'rope', pivot: [0, 0, 0], box: [-11, -94, -13, 11, 0, 13], paint: (g) => {
      const R = CR.ROPE;
      for (let j = -R; j < 0; j++) for (const i of [-1, 0]) g.set(i, j, 0, mod(j, 5) ? ROPEC : 0x3a3d42);
      bx(g, -2, 1, -R - 6, -R - 1, -1, 1, (i, j, k) => (k === 0 && half(i) === 0 && j >= -R - 4 && j <= -R - 3 ? BLK : mod(i + j, 4) < 2 ? YEL : BLK));   // the block
      bx(g, -1, 0, -R - 9, -R - 7, 0, 0, STEELD); g.set(0, -R - 9, 1, STEELD);                                                                        // the hook
      if (o.load === 'none') return;
      const top = -R - 17;
      if (o.load === 'drums') { for (const s of SIDES) line(g, [sx(s, 0), -R - 9, 0], [sx(s, 8), top - 12, 0], HEMP); pallet(g, -9, top - 12, -9, 18, 18); for (const ci of [-5, 4]) for (const ck of [-5, 4]) drum(g, ci, top - 10, ck, DRUMS[mod(seed + ci + ck, DRUMS.length)], 11); }
      else { for (const s of SIDES) for (const e of [-1, 1]) line(g, [sx(s, 0), -R - 9, 0], [sx(s, 7), top + 1, e > 0 ? 9 : -10], HEMP); woodCrate(g, -8, top - 11, -10, 16, 12, 20, seed + 3); }   // slings to the corners
    } },
  ];
  return parts;
}

// =====================================================================================================================
// Cargo, and the pieces it is made of
// =====================================================================================================================
// a wooden crate: boards on a frame, a brace across each long side, a stencilled mark
function woodCrate(g, i0, j0, k0, w, h, l, seed) {
  for (let k = 0; k < l; k++) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const fi = i === 0 || i === w - 1, fj = j === 0 || j === h - 1, fk = k === 0 || k === l - 1, n = fi + fj + fk; if (!n) continue;
    const v = hash(i0 + (fi ? 0 : i >> 1), j0 + (fj ? 0 : fl(j / 3)), k0 + (fk ? 0 : k >> 1), seed);
    let c = n >= 2 ? TIMBER3 : tone(fj ? (mod(i, 3) ? TIMBER2 : TIMBER) : mod(j, 3) ? TIMBER2 : TIMBER, 0.9 + 0.2 * v);
    if (n === 1 && fi && ab(j / (h - 1) - k / (l - 1)) * (l - 1) < 1.2) c = TIMBER3;
    if (n === 1 && fk && ab(j / (h - 1) - i / (w - 1)) * (w - 1) < 1.2) c = TIMBER3;
    if (n === 1 && fi && j >= h - 5 && j <= h - 3 && k >= 2 && k <= 6 && hash(j, k, 4, seed) < 0.7) c = 0x1f1a16;
    g.set(i0 + i, j0 + j, k0 + k, c);
  }
}
// a pallet two cubes high: three runners and the slats across them
function pallet(g, i0, j0, k0, w, l) {
  for (const i of [i0, i0 + 1, i0 + (w >> 1) - 1, i0 + (w >> 1), i0 + w - 2, i0 + w - 1]) bx(g, i, i, j0, j0, k0, k0 + l - 1, TIMBER3);
  for (let k = k0; k < k0 + l; k++) if (mod(k - k0, 3) < 2) bx(g, i0, i0 + w - 1, j0 + 1, j0 + 1, k, k, (i, j, kk) => tone(GREYW, 0.85 + 0.25 * hash(i >> 2, kk, 2, 5)));
}
// an oil drum seven cubes across, standing on end
const DRUMS = [0x2a5fae, 0xb8322a, 0x2f8257, 0x7a4a2a, 0xd9a520, 0x3a3d42];
function drum(g, ci, j0, ck, col, hgt = 10) {
  for (let di = -4; di <= 3; di++) for (let dk = -4; dk <= 3; dk++) {
    const r = Math.hypot(di + 0.5, dk + 0.5); if (r > 3.7) continue;
    for (let j = 0; j < hgt; j++) { const lid = j === hgt - 1 || j === 0; if (r < 2.6 && !lid) continue; g.set(ci + di, j0 + j, ck + dk, lid ? (r < 0.8 ? STEELL : tone(col, 0.7)) : j === 3 || j === hgt - 4 ? tone(col, 1.25) : col); }
  }
}
// a sack lying flat: a shell with its corners rounded off, a seam along the top and a printed band
function sack(g, i0, j0, k0, w, l, seed) {
  const col = tone(0xb99b6b, 0.86 + 0.26 * hash(i0, j0, k0, seed)), band = [0x2a5fae, 0xb8322a, 0x2f8257][mod(seed, 3)];
  for (let k = 0; k < l; k++) for (let j = 0; j < 3; j++) for (let i = 0; i < w; i++) {
    const ei = i === 0 || i === w - 1, ek = k === 0 || k === l - 1, ej = j === 0 || j === 2; if (!ei && !ek && !ej) continue;
    if (ei && ek) continue;
    const longK = l >= w, along = longK ? k : i, len = longK ? l : w;
    g.set(i0 + i, j0 + j, k0 + k, j === 2 && (along === 2 || along === 3) ? band : j === 2 && (longK ? i === (w >> 1) : k === (l >> 1)) ? tone(col, 0.78) : tone(col, 0.94 + 0.12 * hash(i, j + j0, k, seed)));
    void len;
  }
}
export const CARGO_TYPES = ['crates', 'drums', 'sacks', 'boxes'];
function cargoParts(o) {
  const seed = o.seed || 0, type = o.type || 'crates';
  return [{ name: 'body', parent: null, pivot: [0, 0, 0], box: [-15, 0, -23, 15, 34, 23], paint: (g) => {
    if (type === 'boxes') {   // three shipping containers, one across the other two
      crate(g, -14, 0, -22, BOXES[mod(seed, BOXES.length)], seed, 1); crate(g, 0, 0, -22, BOXES[mod(seed + 2, BOXES.length)], seed + 1, 2);
      crate(g, -7, 16, -22, BOXES[mod(seed + 3, BOXES.length)], seed + 2);
      return;
    }
    if (type === 'drums') {
      pallet(g, -12, 0, -9, 24, 18);
      for (const ci of [-8, 0, 8]) for (const ck of [-5, 4]) drum(g, ci, 2, ck, DRUMS[mod(seed + ci * 3 + ck, DRUMS.length)]);
      drum(g, -8, 12, -5, DRUMS[mod(seed + 1, DRUMS.length)]); drum(g, 0, 12, -5, DRUMS[mod(seed + 4, DRUMS.length)]);
      return;
    }
    if (type === 'sacks') {
      pallet(g, -10, 0, -9, 20, 18);
      for (let lv = 0; lv < 4; lv++) for (const [i0, k0] of lv === 3 ? [[-5, -9], [-5, 0]] : [[-10, -9], [0, -9], [-10, 0], [0, 0]]) sack(g, i0, 2 + lv * 3, k0, 10, 9, seed + lv * 5 + i0 + k0);
      return;
    }
    pallet(g, -11, 0, -10, 22, 20);
    woodCrate(g, -11, 2, -10, 11, 11, 14, seed); woodCrate(g, 0, 2, -9, 11, 9, 13, seed + 1); woodCrate(g, -9, 2, 4, 9, 7, 6, seed + 2); woodCrate(g, 1, 2, 4, 9, 6, 6, seed + 5);
    woodCrate(g, -10, 13, -8, 9, 7, 10, seed + 3); woodCrate(g, 2, 11, -7, 7, 5, 8, seed + 4);
  } }];
}

// =====================================================================================================================
// The timber jetty: tarred piles in pairs with a cap beam and cross braces, stringers, a deck of planks, a kerb timber
// down each edge, fender piles and old tyres outside. The end section has a ladder, a life ring and a beacon.
// =====================================================================================================================
function pile(g, i0, k0, n, jTop, seed) {
  for (let j = -26; j <= jTop; j++) for (let di = 0; di < n; di++) for (let dk = 0; dk < n; dk++) {
    if (n === 3 && di === 1 && dk === 1 && j < jTop) continue;
    const v = hash(i0 + di, j >> 2, k0 + dk, seed);
    g.set(i0 + di, j, k0 + dk, j === jTop ? GREYW : j <= -2 ? tone(WET, 0.85 + 0.3 * v) : j <= 1 ? (v < 0.6 ? ALGAE : tone(ALGAE, 0.7)) : tone(v < 0.5 ? TAR : TAR2, 0.9 + 0.2 * v));
  }
}
function jettyParts(o) {
  const seed = o.seed || 0, end = o.type === 'end', K0 = -32, K1 = 31, W = 12;
  const light = o.light === 'red' ? RED_L : GREEN_L, pk = K1 - 4;
  const parts = [{ name: 'body', parent: null, pivot: [0, 0, 0], box: [-16, -27, K0, 16, 36, K1 + 4], paint: (g) => {
    for (const kb of [-17, 15]) {
      for (const s of SIDES) pile(g, s > 0 ? 7 : -10, kb, 3, 6, seed + kb);
      bx(g, -W, W - 1, 7, 8, kb, kb + 2, (i, j, k) => tone(TAR, 0.9 + 0.25 * hash(i >> 2, j, k, seed)));
      line(g, [-8, 5, kb + 3], [8, -7, kb + 3], TAR2); line(g, [8, 5, kb + 3], [-8, -7, kb + 3], TAR2);
    }
    for (const i0 of [-10, -1, 8]) bx(g, i0, i0 + 1, 9, 9, K0, K1, TIMBER3);
    for (let k = K0; k <= K1; k++) {
      const n = fl((k - K0) / 3), v = hash(n, 3, seed, 7), c = v < 0.07 ? 0xa98c62 : tone(mod(n, 2) ? TIMBER : TIMBER2, 0.86 + 0.26 * v);
      for (let i = -W; i < W; i++) g.set(i, 10, k, mod(k - K0, 3) === 0 ? tone(c, 0.8) : (half(i) === 9 || half(i) === 0) && mod(k - K0, 3) === 1 ? IRON : c);
    }
    // the kerb timbers, on blocks so the deck drains
    for (const s of SIDES) for (let k = K0; k <= K1; k++) { if (mod(k - K0, 8) < 2) g.set(sx(s, W - 1), 11, k, TAR); g.set(sx(s, W - 1), 12, k, tone(TIMBER3, 0.9 + 0.2 * hash(k >> 3, s, 2, seed))); }
    // fender piles and tyres outside, a cleat on the deck
    for (const s of SIDES) {
      for (const kf of [-27, -3, 21]) pile(g, s > 0 ? W : -W - 2, kf, 2, 15, seed + kf + s);
      for (const kt of [-13, 9]) { ring(g, sx(s, W), 5, kt, (dj, dk) => ((dj + dk) & 1 ? 0x34373c : 0x26282c)); for (let j = 8; j <= 10; j++) g.set(sx(s, W), j, kt, HEMP); }
      for (const k of [3, 6]) g.set(sx(s, 8), 11, k, IRON); bx(g, sx(s, 8), sx(s, 8), 12, 12, 2, 7, IRON);
    }
    if (!end) {
      if (mod(seed, 3) === 0) for (let i = -8; i <= -2; i++) for (let k = -26; k <= -20; k++) { const r = Math.hypot(i + 5, k + 23); if (r < 3.6 && r > 0.8) g.set(i, 11, k, fl(r) & 1 ? HEMP : tone(HEMP, 0.8)); }   // a coil of rope
      if (mod(seed, 3) === 1) woodCrate(g, 2, 11, 20, 6, 5, 6, seed);
      return;
    }
    // the end: a kerb across, a pile at each corner, a ladder down to the water, the beacon post and a life ring on it
    for (let i = -W; i < W; i++) { if (mod(i, 8) < 2) g.set(i, 11, K1, TAR); g.set(i, 12, K1, TIMBER3); }
    for (const s of SIDES) { pile(g, s > 0 ? W - 3 : -W + 1, K1 + 1, 2, 17, seed + s); for (let j = 13; j <= 14; j++) for (let d = 0; d < 2; d++) for (let e = 0; e < 2; e++) g.set((s > 0 ? W - 3 : -W + 1) + d, j, K1 + 1 + e, HEMP); }
    for (let j = -6; j <= 13; j++) { g.set(3, j, K1 + 1, IRON); g.set(6, j, K1 + 1, IRON); if (mod(j, 2) === 0) { g.set(4, j, K1 + 1, STEELL); g.set(5, j, K1 + 1, STEELL); } }
    bx(g, -1, 0, 11, 31, pk, pk + 1, (i, j) => (j >= 30 ? STEELD : mod(fl((j - 11) / 5), 2) ? 0xe9e6dc : 0xc23b2e));
    ring(g, 1, 18, pk, (dj, dk) => ((dj > 0) === (dk > 0) && dj * dk !== 0 ? 0xe9e6dc : 0xe8501e));
  } }];
  if (end) parts.push(lamp('bcn', [0, 1].flatMap((dj) => [[-1, 32 + dj, pk], [0, 32 + dj, pk], [-1, 32 + dj, pk + 1], [0, 32 + dj, pk + 1]]), light));
  return parts;
}

// =====================================================================================================================
// Clips
// =====================================================================================================================
const seg = (t, a, b) => ease(clamp((t - a) / (b - a)));
const GONE = [0, 0, 0, 0, 0, 0, 0];
// the crane as it stands: the house slewed, the jib luffed, d cubes of rope paid out, the load swinging a little
const working = (t, u, slew, luff, d, sway, lag = 0) => ({
  house: [0, slew, 0], jib: [-luff, 0, 0], rope: [luff + sway * S(t * 1.7 + u.phase), 0, lag + sway * 0.8 * S(t * 1.3 + u.phase * 2)], hook: [0, 0, 0, 0, -d * H, 0],
  bcn: mod(t * 0.8 + u.phase, 1) < 0.5 ? ON : OFF,
});
const CYCLE = 29, SWING = -1.75;
const craneClips = {
  Idle: { loop: true, speed: 0, pose: (t, u) => working(t, u, 0.5 + 0.012 * S(t * 0.4 + u.phase), LUFF, 24, 0.012) },
  // a working cycle: lower to the barge, lift, swing round along the quay, set down, lift, swing back
  Work: { loop: true, speed: 0, pose: (t, u) => {
    const q = mod(t + (u.opts.seed || 0) * 7.3, CYCLE), out = seg(q, 9.5, 15), back = seg(q, 23.5, 29), f = out - back;
    const d = 8 + 28 * (seg(q, 0, 4) - seg(q, 5.5, 9.5)) + 50 * (seg(q, 15, 18.5) - seg(q, 20, 23.5));
    return working(t, u, SWING * f, LUFF - 0.1 * f, d, 0.014, 0.05 * (S(PI * out) - S(PI * back)));
  } },
  // Blown up: the luffing gear lets go and the jib comes down until its head hits the ground; the load has dropped.
  WreckJib: { loop: false, hidden: true, dur: 3, speed: 0, pose: (t, u) => {
    const st = u.state, s0 = st.s0 ?? 0, l0 = st.l0 ?? LUFF, sd = sideOf(u), e = ease(clamp(t / 0.4)), hop = Math.max(0, 4 * t - 18 * t * t), T = 1.15, a = clamp(t / T), land = Math.max(0, t - T), down = -0.44;
    const luff = l0 + (down - l0) * a * a + (a >= 1 ? 0.07 * Math.exp(-land * 5) * ab(S(land * 11)) : 0);
    return { body: [0.008 * e, 0, 0.012 * sd * e, 0, hop * 0.3, 0], house: [0.03 * e, s0 + 0.22 * sd * seg(t, 0, 1.6), 0.025 * sd * e], jib: [-luff, 0, 0], rope: GONE, bcn: OFF };
  } },
  // Blown off her feet: she goes over sideways along the rails and lies on the quay with the jib beside her.
  WreckTopple: { loop: false, hidden: true, dur: 4, speed: 0, pose: (t, u) => {
    const st = u.state, s0 = st.s0 ?? 0, l0 = st.l0 ?? LUFF, sd = sideOf(u), T = 1.9, a = clamp(t / T), land = Math.max(0, t - T), W = (CR.GX + 4) * H;
    const ang = PI / 2 * (a * a * (1.5 - 0.5 * a)) - (a >= 1 ? 0.05 * Math.exp(-land * 5) * ab(S(land * 10)) : 0);
    const sT = rnd(s0 / PI) * PI, slew = s0 + (sT - s0) * seg(t, 0, 1.3), luff = l0 + (0.5 - l0) * ease(a), droop = -sd * 0.26 * C(sT) * seg(t, T * 0.75, T + 0.35);
    return { body: [0, 0.08 * sd * ease(a), sd * ang, -sd * W * (1 - C(ang)), W * S(ang) - 0.2 * ease(a), 0], house: [0, slew, 0], jib: [-luff, droop, 0], rope: GONE, bcn: OFF };
  } },
  Crushed: { loop: false, hidden: true, dur: 0.3, speed: 0, pose: () => ({ rope: GONE, bcn: OFF }) },
};
const still = (wrecks) => ({
  Idle: { loop: true, speed: 0, pose: (t, u) => ({ bcn: mod(t * 0.5 + u.phase, 1) < 0.5 ? ON : OFF }) },
  ...wrecks,
  Crushed: { loop: false, hidden: true, dur: 0.3, speed: 0, pose: () => ({ bcn: OFF }) },
});
const jettyClips = still({
  // Blown up: the piles give on one side and the section leans, or one end of it drops into the water
  WreckLean: { loop: false, hidden: true, dur: 2, speed: 0, pose: (t, u) => { const e = ease(clamp(t / 0.7)), hop = Math.max(0, 3 * t - 14 * t * t); return { body: [0.02 * e, 0, 0.12 * sideOf(u) * e, 0, hop - 1.1 * e, 0], bcn: OFF }; } },
  WreckDrop: { loop: false, hidden: true, dur: 2, speed: 0, pose: (t, u) => { const e = ease(clamp(t / 0.8)), hop = Math.max(0, 3 * t - 14 * t * t), fwd = (u.opts.seed || 0) & 2 ? 1 : -1; return { body: [0.14 * fwd * e, 0, 0.03 * sideOf(u) * e, 0, hop - 1.5 * e, 0], bcn: OFF }; } },
});
const cargoClips = still({
  // Blown up: it jumps and comes down askew
  WreckStand: { loop: false, hidden: true, dur: 1.5, speed: 0, pose: (t, u) => { const e = ease(clamp(t / 0.5)), hop = Math.max(0, 6 * t - 22 * t * t), tw = (hash(u.opts.seed || 0, 5, 1, 2) - 0.5); return { body: [0.03 * tw * e, 0.5 * tw * e, 0.04 * sideOf(u) * e, 0, hop, 0] }; } },
});

const NONE = /^\0/;
const onKill = (u, point, r, debris) => { if (u.crushes) for (const c of u.crushes) c[2] = -9; blowUp(u, debris, point); };
// the crane remembers how she stood when she was hit, so the wreck starts from there
const craneKill = (u, point, r, debris) => { if (!u.crushed) { u.state.s0 = u.cur.house[1]; u.state.l0 = -u.cur.jib[0]; } onKill(u, point, r, debris); };
// fires on the machinery house, wherever it has ended up (points in the body's space)
const HOUSE_FIRES = [[0, 20, -8], [-8, 20, -14], [8, 20, 0], [-6, 20, 6], [6, 20, -16], [12, 15, 12], [0, 13, -22], [-12, 10, -6], [10, 12, -10], [-3, 20, -2]];
function houseFires(u, n) {
  const v = new u.bones.body.position.constructor(), out = []; u.root.updateWorldMatrix(true, true);
  for (const [i, j, k] of HOUSE_FIRES.slice(0, n)) { v.set(i * H, j * H, k * H); u.bones.house.localToWorld(v); u.bones.body.worldToLocal(v); out.push([v.x, v.y, v.z]); }
  return out;
}

export const DOCK_CRANE = {
  kind: 'crane', h: H, parts: craneParts, start: 'Idle', dieAt: 0.12, inner: INNER, onKill: craneKill, clips: craneClips,
  // the blast starts in the machinery house. A foot flattens the portal and the house together and scatters the jib.
  wk: { wrecks: ['WreckTopple', 'WreckJib'], seat: () => [0, CR.SLEW + 8, -6], R: 22, soot: 70, sootMin: 0.12, max: 800, push: 24, lamps: /^bcn/, loose: /^(bcn|jib|rope|hook)/, drop: /^(rope|hook)$/, scatter: /^(jib|rope|hook)$/,
    mottle: 0.2, fireTop: 99, spread: 10, keep: (d, n) => { const k = 0.1 + 0.9 * ease(clamp((d - 27) / 9)); return k > 0.97 ? 1 : k + 0.05 * (n - 0.5); }, dx: 1, recrush: true, pack: true, boom: 7.5, fires: 10, fireSize: 1.4, fireAt: houseFires, heatproof: true },
};
export const JETTY = {
  kind: 'jetty', h: H, parts: jettyParts, start: 'Idle', dieAt: 0.14, inner: INNER, onKill, clips: jettyClips,
  // a foot drives the deck under it down below the water and leaves the piles beneath
  wk: { wrecks: ['WreckLean', 'WreckDrop'], seat: () => [0, 10, 0], R: 22, soot: 36, sootMin: 0.2, max: 500, push: 18, lamps: /^bcn/, loose: /^bcn/, mottle: 0.3, fireTop: 99, fireMin: 6, spread: 14,
    keep: (d, n) => { const k = 0.1 + 0.9 * ease(clamp((d - 11) / 13)); return k > 0.97 ? 1 : k + 0.07 * (n - 0.5); }, dx: 1, recrush: true, base: () => -3, boom: 5, fires: 10, splash: true, heatproof: true },
};
export const CARGO = {
  kind: 'cargo', h: H, parts: cargoParts, start: 'Idle', dieAt: 0.12, inner: INNER, onKill, clips: cargoClips,
  wk: { wrecks: ['WreckStand'], seat: () => [0, 7, 0], R: 15, soot: 24, max: 320, push: 20, lamps: NONE, loose: NONE, fireTop: 99, spread: 9,
    keep: (d, n) => 0.16 + 0.3 * ease(clamp((d - 6) / 16)) + 0.1 * (n - 0.5), dx: 1.1, recrush: false, boom: 4.6, fires: 8 },
};
