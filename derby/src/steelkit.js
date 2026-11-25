// Meltdown Steelworks' own things (maps/steel.js).
//   what stands on the floor, in the fair's kit (cubes of half a voxel: fairstalls.js makeKit; kinds for makeStalls)
//     slab   a cast slab on its bearers, still warm in its cracks: eight of them side by side are the ingot lane
//     coil   three coils of strip strapped side by side: four rows of them lie in the coil jump's gap
//   what hangs and moves, in the same kit (each about its own middle, for steeltraps.js to hang and turn)
//     ladleGeo(len)    the ladle on its bail and chains, hanging `len` voxels below its pivot, and its molten top
//     crucibleGeo()    the crucible the furnace robot tips, about its trunnions
//     sledgeGeo(len)   the smith's hammer: the shaft along +z from the fist, the head across it
//   the hall itself, in plain boxes (makeBoxes: boxes of any size, at any angle, one mesh)
//     hallShell(H)     walls in bays, columns, the crane's rails, the roof and its trusses, the lamps under them
//     bridgeGeo(S)     the travelling crane's bridge, across the hall, with its trolley
//     furnace, cradle  the furnaces behind the north wall, and the scaffold round the robot being built
import * as THREE from 'three';
import { KINDS, makeKit } from './fairstalls.js';

const STEEL = 0x69737b, STEEL_D = 0x3d444b, STEEL_L = 0x8c979f, DARK = 0x22252a, BLACK = 0x141518, RUST = 0x6b4630, RUST_D = 0x47301f;
const YELLOW = 0xe2b02a, YELLOW_D = 0xb5881c, RED = 0xb8322a, WHITE = 0xdcd8cc, BRICK = 0x51342a, BRICK_D = 0x3c2720, SHEET = 0x2c333b, SHEET_D = 0x242a31;
const SCALE = 0x4a4038, SLAG = 0x2e2824, TIMBER = 0x6a5236, CHROME = 0xc3ccd6, CONC = 0x6f6c66;
export const HOT = [3.4, 1.5, 0.28], WARM = [1.5, 0.42, 0.08], EMBER = [0.75, 0.16, 0.03], LAMP = [2.4, 1.8, 1.0], AMBER = [2.6, 1.5, 0.3], MOON = [0.16, 0.2, 0.3], WELD = [2.2, 2.8, 3.6];
const TAU = Math.PI * 2;

// ---- on the floor -----------------------------------------------------------------------------------------------------
// (model x runs along the lane, z across it; the lane's deck is five voxels up, so the slab's top is at ten)
function slab(K, o) {
  const v = o.v || 0;
  for (const x of [-9, 6]) K.b(x, 0, -19, 3, 1.4, 38, TIMBER);
  K.b(-12.5, 1.4, -20, 25, 8.6, 40, v === 1 ? SCALE : STEEL_D);
  K.b(-12.5, 9, -20, 25, 1, 40, v === 2 ? STEEL : SCALE);
  // the scale on it, flaked in patches, and the heat still in its cracks and round its foot
  for (let i = 0; i < 7; i++) { const x = -11 + ((i * 7 + v * 5) % 20), z = -18 + ((i * 11 + v * 3) % 33); K.b(x, 10, z, 3 + (i % 3), 0.3, 4 + ((i * 5) % 4), i & 1 ? SLAG : RUST_D); }
  const glow = o.hot ? WARM : EMBER;
  for (const z of [-20.15, 20]) { K.l(-11, 2.2, z, 22, 0.5, 0.15, glow, -0.2 - (o.c || 0) * 0.11, o.hot ? 0.9 : 0.7); K.l(-6 + v * 3, 5.4, z, 9, 0.4, 0.15, glow, -0.4 - (o.c || 0) * 0.07, 0.6); }
  K.l(-12.65, 3, -8 + v * 4, 0.15, 0.5, 14, glow, -0.3, 0.6); K.l(12.5, 6, -12 + v * 5, 0.15, 0.5, 12, glow, -0.5, 0.6);
  if (o.hot) { K.l(-3, 10.02, -14, 0.6, 0.1, 22, WARM, -0.25, 0.8); K.l(4, 10.02, -6, 0.5, 0.1, 17, WARM, -0.45, 0.7); }
  // chalked on its end: the heat's number
  K.b(-8, 6.2, 20.02, 5, 0.5, 0.1, WHITE); K.b(-8, 4.6, 20.02, 0.5, 2.1, 0.1, WHITE); K.b(-1, 4.6, 20.02, 3, 0.5, 0.1, WHITE);
}
// a coil lying along z (across the jump): rings of strip round a dark eye, strapped, on a cradle
function oneCoil(K, cz, w, r, col, hot, ph) {
  for (let dy = -r; dy < r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - (dy + 0.5) * (dy + 0.5)) + 0.5); if (half <= 0) continue;
    K.b(-half, r + dy, cz - w / 2, 2 * half, 1, w, (dy + r) % 3 === 1 ? STEEL_L : col);
  }
  for (const z of [cz - w / 2 - 0.1, cz + w / 2 - 0.1]) {
    K.discXY(0, r, z, Math.round(r * 0.42), 0.2, BLACK);
    if (hot) K.discXY(0, r, z + (z < cz ? -0.05 : 0.05), Math.round(r * 0.3), 0.2, 0, WARM);
  }
  K.b(-r - 0.2, r - 0.6, cz - 1, 2 * r + 0.4, 1.2, 2, BLACK);                      // a strap round it, and the cradle's chocks
  K.b(-r, 0, cz - w / 2, 3, 2.4, w, TIMBER); K.b(r - 3, 0, cz - w / 2, 3, 2.4, w, TIMBER);
  if (hot) K.l(-2, 2 * r - 0.1, cz - w / 2 + 1, 4, 0.2, w - 2, EMBER, ph, 0.8);
}
function coil(K, o) {
  const c = o.c || 0;
  [-18, 0, 18].forEach((z, i) => oneCoil(K, z, 16, 7, [STEEL, STEEL_D, 0x5a6670][(i + c) % 3], (i + c) % 4 === 1, -0.2 - i * 0.2));
}
Object.assign(KINDS, {
  slab: { make: slab, foot: null, top: 5, hp: 0, pool: null },
  coil: { make: coil, foot: null, top: 7, hp: 0, pool: null },
});

// ---- what hangs and moves ---------------------------------------------------------------------------------------------
const kit = () => makeKit(0, 0, 0, true);
// a round slab lying flat between radii r0 and r1 (rows of cubes); col a colour or (dx, dz) => colour; lit: rgb
function round(K, y, r0, r1, h, col, lit = null, k = 1) {
  const R = Math.ceil(r1);
  for (let dz = -R; dz < R; dz++) {
    let x0 = 0, c0 = null;
    for (let dx = -R; dx <= R; dx++) {
      const r = Math.hypot(dx + 0.5, dz + 0.5), c = dx < R && r < r1 && r >= r0 ? (typeof col === 'function' ? col(dx + 0.5, dz + 0.5) : col) : null;
      if (c === c0) continue;
      if (c0 !== null) { if (lit) K.l(x0, y, dz, dx - x0, h, 1, lit, 0, k); else K.b(x0, y, dz, dx - x0, h, 1, c0); }
      x0 = dx; c0 = c;
    }
  }
}
// a pot: stacked rings from y0 up, the radius by `prof` (a row every two half-voxels), lined, with a molten top
function pot(K, y0, prof, molten = 0.8, cols = [STEEL_D, 0x4b4640]) {
  prof.forEach((r, i) => {
    const y = y0 + i * 2, band = i === 2 || i === prof.length - 3;
    if (i === 0) round(K, y, 0, r, 2, SLAG); else round(K, y, r - 3, r, 2, band ? DARK : cols[i & 1]);
    if (band) round(K, y + 0.4, r, r + 0.8, 1.2, RUST_D);
  });
  const top = y0 + prof.length * 2, rt = prof[prof.length - 1];
  round(K, top, rt - 3.4, rt + 0.8, 1, DARK);                                       // the rim
  const ym = y0 + Math.round(prof.length * molten) * 2;
  round(K, ym, 0, rt - 3, 0.6, 0, HOT);                                             // the melt
  round(K, ym + 0.6, rt - 5.5, rt - 3, 0.3, 0, WARM, 0.9);                          // the crust at its edge
  return { top, rt };
}
// The ladle, hanging `len` voxels under its pivot (the pivot is the origin): two chains down to the bail, the bail's
// arms down to the trunnions, and the pot between them, eight voxels across at its foot and nine at its lip.
export function ladleGeo(len) {
  const K = kit(), y0 = -len * 2, prof = [13, 14.5, 15.5, 16, 16.5, 17, 17, 17.5, 17.5, 18, 18, 18];
  const { top } = pot(K, y0, prof, 0.86);
  const ty = y0 + 14;                                                                // the trunnions
  for (const s of [-1, 1]) {
    K.b(s > 0 ? 17 : -21, ty - 1.5, -1.5, 4, 3, 3, CHROME);
    K.b(s > 0 ? 20 : -22, ty - 1, -1.6, 2, top + 12 - ty, 3.2, YELLOW);            // the bail's arm
    K.stripes(s > 0 ? 19.9 : -22.1, ty + 6, -1.7, 2.2, 6, 3.4, 1, BLACK, BLACK);
  }
  K.b(-22, top + 10, -2, 44, 3, 4, YELLOW); K.b(-4, top + 13, -2.4, 8, 3, 4.8, DARK); // the bail's beam and its eye
  K.stripes(-22, top + 10.2, -2.1, 44, 2.6, 4.2, 11, YELLOW, BLACK);
  for (const x of [-12.6, 11.4]) K.b(x, top + 13, -0.6, 1.2, -top - 13, 1.2, STEEL_D);   // the chains, up to the trolley
  for (let y = top + 16; y < -4; y += 6) for (const x of [-12.9, 11.1]) K.b(x, y, -0.9, 1.8, 1.4, 1.8, DARK);
  K.b(-0.7, top + 16, -0.7, 1.4, -top - 16, 1.4, STEEL_D);
  // drips of slag down its side, still alight
  K.l(15.6, y0 + 12, 6, 0.5, 9, 1.2, WARM, -0.3, 0.8); K.l(-9, y0 + 15, 15.4, 1.2, 7, 0.5, WARM, -0.55, 0.7); K.l(4, y0 + 17, -16.6, 1, 6, 0.5, EMBER, -0.2, 0.9);
  K.b(-7, y0 + 9, 17.4, 14, 5, 0.5, YELLOW); K.stripes(-7, y0 + 9, 17.5, 14, 5, 0.45, 5, YELLOW, BLACK);
  return K.geos();
}
// The crucible the furnace robot holds by its trunnions (the origin: it tips about x, its lip toward +z): a pot twelve
// voxels across, a pouring lip, the trunnion pins out to the robot's fists.
export function crucibleGeo(grip = 20) {
  const K = kit(), prof = [15, 18, 20, 21.5, 22.5, 23, 23.5, 24, 24, 24, 24.5, 24.5, 25], y0 = -16;
  const { top, rt } = pot(K, y0, prof, 0.78, [0x8c6a48, 0x74563a]);
  round(K, top + 1, rt - 3.4, rt - 2.2, 0.4, 0, WARM, 0.9);                              // the heat at its rim
  K.b(-5, top - 3, rt - 3, 10, 3, 7, DARK); K.l(-3, top - 1.4, rt - 4, 6, 1.5, 7.5, HOT);                     // the lip, running with metal
  for (const s of [-1, 1]) { K.b(s > 0 ? rt - 2 : -grip * 2 - 1, -2.5, -2.5, grip * 2 - rt + 3, 5, 5, CHROME); K.b(s > 0 ? rt - 1 : -rt - 3, -5, -5, 4, 10, 10, STEEL_D); }
  K.stripes(-rt - 0.4, y0 + 8, -rt - 0.4, 2 * rt + 0.8, 3, 0.5, 12, YELLOW, BLACK);
  K.l(-8, y0 + 4, rt - 1.6, 1, 14, 0.6, WARM, -0.3, 0.8); K.l(6, y0 + 9, rt - 1.2, 1.2, 12, 0.6, EMBER, -0.5, 0.9);
  return K.geos();
}
// The smith's hammer, from his fist (the origin) along +z: a shaft `len` voxels long, banded, and the head across its
// end, its two faces up and down the way it swings (y).
export function sledgeGeo(len = 40) {
  const K = kit(), L = len * 2;
  K.b(-1.6, -1.6, -10, 3.2, 3.2, L + 4, STEEL_D); K.b(-2.2, -2.2, -11, 4.4, 4.4, 4, DARK);
  for (let z = 8; z < L - 18; z += 14) K.b(-2, -2, z, 4, 4, 2, YELLOW_D);
  // the head: a block bevelled at its corners, a collar where the shaft goes in, a face plate top and bottom with
  // bolts at its corners, hazard bands round it and the maker's plate on its side
  K.b(-9, -12, L - 12, 18, 24, 22, STEEL_D); K.b(-10, -10, L - 13, 20, 20, 24, 0x4b535b); K.b(-8, -13, L - 11, 16, 26, 20, STEEL_D);
  K.b(-10.6, -3.4, L - 13.6, 21.2, 6.8, 25.2, DARK); K.b(-3.2, -3.2, L - 16, 6.4, 6.4, 3, STEEL);
  for (const y of [-15.4, 13]) {
    K.b(-10, y, L - 13, 20, 2.4, 24, STEEL_L);
    for (const [x, z] of [[-9, L - 12], [7.4, L - 12], [-9, L + 8.4], [7.4, L + 8.4]]) K.b(x, y + (y < 0 ? -0.4 : 2.4), z, 1.6, 0.4, 1.6, CHROME);
  }
  K.stripes(-10.7, -9.4, L - 13.7, 21.4, 3.6, 0.5, 6, YELLOW, BLACK); K.stripes(-10.7, 5.8, L - 13.7, 21.4, 3.6, 0.5, 6, BLACK, YELLOW);
  K.stripes(-10.7, -9.4, L + 11.2, 21.4, 3.6, 0.5, 6, BLACK, YELLOW); K.stripes(-10.7, 5.8, L + 11.2, 21.4, 3.6, 0.5, 6, YELLOW, BLACK);
  for (const x of [-10.8, 10.3]) { K.b(x, -9.4, L - 10, 0.5, 3.6, 18, YELLOW); K.b(x, 5.8, L - 10, 0.5, 3.6, 18, YELLOW); K.b(x, -1.6, L - 6, 0.5, 3.2, 10, RED); K.b(x - (x < 0 ? 0.1 : -0.1), -0.9, L - 5, 0.5, 0.5, 8, WHITE); K.b(x - (x < 0 ? 0.1 : -0.1), 0.4, L - 5, 0.5, 0.5, 5, WHITE); }
  K.l(-8, -15.9, L - 11, 16, 0.5, 20, WARM, -0.3, 0.8);                               // the working face, hot from the billet
  return K.geos();
}

// ---- plain boxes --------------------------------------------------------------------------------------------------------
// One mesh of boxes of any size: B (two corners), R (a middle, a size and a turn), beam (from a to b, t thick), and the
// same lit (L, Lr). Colours as hex; lit colours as rgb past white.
export function makeBoxes() {
  const P = [], N = [], C = [], I = [], LP = [], LC = [], LI = [];
  const col = new THREE.Color(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), n = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  const FACES = [[[1, 0, 0], [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]], [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]], [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]],
    [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]], [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]], [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]]];
  function put(w, h, d, hex, rgb) {
    const lit = !!rgb, p = lit ? LP : P, idx = lit ? LI : I;
    if (!lit) col.setHex(hex, THREE.SRGBColorSpace);
    for (const [nn, cs] of FACES) {
      const at = p.length / 3;
      n.set(nn[0], nn[1], nn[2]).transformDirection(m);
      for (const [a, b, c] of cs) {
        v.set((a - 0.5) * w, (b - 0.5) * h, (c - 0.5) * d).applyMatrix4(m); p.push(v.x, v.y, v.z);
        if (lit) LC.push(rgb[0], rgb[1], rgb[2]); else { N.push(n.x, n.y, n.z); C.push(col.r, col.g, col.b); }
      }
      idx.push(at, at + 1, at + 2, at, at + 2, at + 3);
    }
  }
  const at = (cx, cy, cz, rot) => { if (rot) q.setFromEuler(e.set(rot[0], rot[1], rot[2])); else q.identity(); m.compose(v.set(cx, cy, cz), q, s); };
  const X = {
    B(x0, y0, z0, x1, y1, z1, hex) { at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); put(x1 - x0, y1 - y0, z1 - z0, hex); },
    L(x0, y0, z0, x1, y1, z1, rgb, k = 1) { at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); put(x1 - x0, y1 - y0, z1 - z0, 0, [rgb[0] * k, rgb[1] * k, rgb[2] * k]); },
    R(cx, cy, cz, w, h, d, rot, hex) { at(cx, cy, cz, rot); put(w, h, d, hex); },
    Lr(cx, cy, cz, w, h, d, rot, rgb, k = 1) { at(cx, cy, cz, rot); put(w, h, d, 0, [rgb[0] * k, rgb[1] * k, rgb[2] * k]); },
    beam(a, b, t, hex, t2 = t) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
      q.setFromUnitVectors(n.set(0, 0, 1), v.set(dx / len, dy / len, dz / len)); m.compose(v.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, s);
      put(t, t2, len, hex);
    },
    // yellow and black along x or z
    stripes(x0, y0, z0, x1, y1, z1, nn, alongZ = false) { for (let i = 0; i < nn; i++) { const f0 = i / nn, f1 = (i + 1) / nn; if (alongZ) X.B(x0, y0, z0 + (z1 - z0) * f0, x1, y1, z0 + (z1 - z0) * f1, i & 1 ? BLACK : YELLOW); else X.B(x0 + (x1 - x0) * f0, y0, z0, x0 + (x1 - x0) * f1, y1, z1, i & 1 ? BLACK : YELLOW); } },
    geos() {
      const paint = new THREE.BufferGeometry();
      paint.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); paint.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); paint.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); paint.setIndex(I);
      const lit = new THREE.BufferGeometry();
      lit.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3)); lit.setAttribute('color', new THREE.Float32BufferAttribute(LC, 3)); lit.setIndex(LI);
      return { paint, lit };
    },
  };
  return X;
}
let boxMat = null, boxLit = null;
export const steelMat = () => boxMat || (boxMat = new THREE.MeshLambertMaterial({ vertexColors: true }));
export const steelLit = () => boxLit || (boxLit = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));

// ---- the hall -----------------------------------------------------------------------------------------------------------
// H: { x0, x1, z0, z1 (the walls' inside faces), eave, ridge, bay, rail (the crane rails' height) }. Into X (makeBoxes).
// The walls are brick to sixteen up and sheet above, a column at every bay with a striped foot, a band of grimy panes
// (the moon in them), the crane's rails along the two long walls on brackets, a pitched roof on trusses with a strip of
// skylight along the ridge, and a lamp under every other truss's quarter points. Returns where those lamps hang.
export function hallShell(X, H) {
  const { x0, x1, z0, z1, eave, ridge, bay, rail } = H, zm = (z0 + z1) / 2, lamps = [];
  const side = (a0, a1, at, alongX, out) => {
    const n = Math.round((a1 - a0) / bay), w = (a1 - a0) / n;
    for (let i = 0; i < n; i++) {
      const u0 = a0 + i * w, u1 = u0 + w;
      const box = (ua, y0, ub, y1, d0, d1, col, lit) => {
        const p0 = at + out * d0, p1 = at + out * d1, lo = Math.min(p0, p1), hi = Math.max(p0, p1);
        if (lit) { if (alongX) X.L(ua, y0, lo, ub, y1, hi, lit); else X.L(lo, y0, ua, hi, y1, ub, lit); } else if (alongX) X.B(ua, y0, lo, ub, y1, hi, col); else X.B(lo, y0, ua, hi, y1, ub, col);
      };
      box(u0, 0, u1, 16, 0, 3, i & 1 ? BRICK : BRICK_D); box(u0, 16, u1, 17.5, -0.6, 3, CONC);
      box(u0, 17.5, u1, 46, 0.6, 3, i & 1 ? SHEET_D : SHEET); box(u0, 62, u1, eave - 36, 0.6, 3, i & 1 ? SHEET : SHEET_D); box(u0, eave - 22, u1, eave, 0.6, 3, i & 1 ? SHEET_D : SHEET);
      box(u0, eave - 36, u1, eave - 22, 1.2, 3, DARK);
      for (let k = 0; k < 3; k++) { const a = u0 + 2.5 + k * (w - 3) / 3, b = a + (w - 3) / 3 - 1.5; if ((i * 5 + k) % 6 !== 1) box(a, eave - 34.5, b, eave - 23.5, 1, 1.3, 0, MOON); }
      box(u0, 46, u1, 62, 1.2, 3, DARK);                                              // the band of panes, in their frames
      for (let k = 0; k < 4; k++) { const a = u0 + 2.5 + k * (w - 3) / 4, b = a + (w - 3) / 4 - 1.5; if ((i * 3 + k) % 7 !== 2) box(a, 47.5, b, 60.5, 1, 1.3, 0, MOON); }
      box(u0 - 1.6, 0, u0 + 1.6, eave, -4, 0.6, RUST_D); box(u0 - 2.4, 0, u0 + 2.4, eave, -4.8, -4, STEEL_D);          // the column: a web and a flange
      for (let k = 0; k < 4; k++) box(u0 - 2.6, k * 2.5, u0 + 2.6, k * 2.5 + 2.5, -5, -4.7, k & 1 ? BLACK : YELLOW);
      if (alongX) { box(u0 - 2, rail - 9, u0 + 2, rail - 4, -9, -4, STEEL_D); box(u0, rail - 4, u1, rail, -9, -5, i & 1 ? YELLOW_D : YELLOW); box(u0, rail, u1, rail + 1, -8, -6, STEEL_L); }
    }
  };
  side(x0, x1, z0, true, -1); side(x0, x1, z1, true, 1); side(z0, z1, x0, false, -1); side(z0, z1, x1, false, 1);
  // the gable ends above the eaves, stepped
  for (let k = 0; k < 6; k++) { const f0 = k / 6, f1 = (k + 1) / 6, half = (z1 - z0) / 2 * (1 - f0); for (const x of [x0 - 3, x1 + 0.6]) X.B(x, eave + (ridge - eave) * f0, zm - half, x + 2.4, eave + (ridge - eave) * f1, zm + half, k & 1 ? SHEET : SHEET_D); }
  // the roof: two slopes of sheet, purlins under them, the skylight along the ridge
  const run = (z1 - z0) / 2 + 6, rise = ridge - eave, len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
  for (const sg of [-1, 1]) {
    X.R((x0 + x1) / 2, (eave + ridge) / 2 + 1.5, zm + sg * run / 2, x1 - x0 + 8, 1.2, len, [sg * ang, 0, 0], 0x1a1d22);
    for (let k = 1; k < 7; k++) { const f = k / 7; if (k === 6) continue; X.R((x0 + x1) / 2, eave + rise * (1 - f) + 0.2, zm + sg * run * f, x1 - x0, 1.6, 1.6, [sg * ang, 0, 0], STEEL_D); }
    X.Lr((x0 + x1) / 2, ridge - rise * 0.08 + 0.6, zm + sg * run * 0.08, x1 - x0 - 30, 0.4, len * 0.1, [sg * ang, 0, 0], MOON, 0.8);
    for (let x = x0 + 15; x <= x1 - 15; x += 14) X.R(x, ridge - rise * 0.08 + 0.2, zm + sg * run * 0.08, 1.2, 1.4, len * 0.1 + 1, [sg * ang, 0, 0], DARK);
  }
  // the trusses: a bottom chord at the eaves' height, the two rafters, and the web between
  const nt = Math.round((x1 - x0) / (bay * 2));
  for (let i = 0; i <= nt; i++) {
    const x = x0 + (x1 - x0) * i / nt;
    X.B(x - 1.2, eave - 3, z0, x + 1.2, eave, z1, STEEL_D);
    for (const sg of [-1, 1]) {
      X.beam([x, eave, zm + sg * (z1 - z0) / 2], [x, ridge - 2, zm], 2.4, RUST_D, 2.8);
      for (let k = 0; k < 4; k++) {
        const f0 = k / 4, f1 = (k + 1) / 4, za = zm + sg * (z1 - z0) / 2 * (1 - f0), zb = zm + sg * (z1 - z0) / 2 * (1 - f1), yb = eave + (ridge - 2 - eave) * f1;
        X.beam([x, eave - 1.5, za], [x, yb, zb], 1.6, STEEL_D); X.B(x - 0.8, eave, zb - 0.8, x + 0.8, yb, zb + 0.8, STEEL_D);
      }
      // a lamp under the quarter point: a shade and the lamp in it
      if (i > 0 && i < nt) for (const f of [0.28, 0.72]) {
        const z = zm + sg * (z1 - z0) / 2 * f, y = eave - 12;
        X.B(x - 0.4, y + 3, z - 0.4, x + 0.4, eave - 3, z + 0.4, DARK); X.B(x - 3, y + 1.5, z - 3, x + 3, y + 3, z + 3, DARK); X.L(x - 2.2, y, z - 2.2, x + 2.2, y + 1.5, z + 2.2, LAMP);
        lamps.push([x, y, z]);
      }
    }
  }
  return lamps;
}
// More steel in the hall (into X): cross bracing in every other bay of the long walls, ties along the hall between
// the trusses' bottom chords, a pipe run along the north wall, and a catwalk along each long side hung from the trusses.
export function hallSteel(X, H, C = {}) {
  const { x0, x1, z0, z1, eave, bay } = H, zm = (z0 + z1) / 2, n = Math.round((x1 - x0) / bay), w = (x1 - x0) / n;
  for (let i = 0; i < n; i += 2) for (const [z, sg] of [[z0 + 2.5, 1], [z1 - 2.5, -1]]) {
    const a = x0 + i * w, b = a + w;
    X.beam([a, 64, z], [b, eave - 38, z], 1.4, RUST_D); X.beam([b, 64, z], [a, eave - 38, z], 1.4, RUST_D); X.B((a + b) / 2 - 2, (64 + eave - 38) / 2 - 2, z - 0.9, (a + b) / 2 + 2, (64 + eave - 38) / 2 + 2, z + 0.9, STEEL_D);
    X.beam([a, eave - 20, z + sg * 3], [a, eave - 3, z + sg * 26], 1.6, RUST_D); X.beam([b, eave - 20, z + sg * 3], [b, eave - 3, z + sg * 26], 1.6, RUST_D);   // knee braces up to the trusses
  }
  for (const f of [0.18, 0.5, 0.82]) { const z = z0 + (z1 - z0) * f; X.B(x0, eave - 3.4, z - 1, x1, eave - 1, z + 1, STEEL_D); X.B(x0, eave - 9, z - 0.6, x1, eave - 8, z + 0.6, RUST_D); for (let x = x0; x < x1 - 1; x += bay) { X.beam([x, eave - 8.5, z], [x + bay / 2, eave - 2, z], 1, RUST_D); X.beam([x + bay / 2, eave - 2, z], [x + bay, eave - 8.5, z], 1, RUST_D); } }
  X.B(x0, 66, z0 + 9, x1, 71, z0 + 14, RUST); for (let x = x0 + 12; x < x1; x += 60) { X.B(x, 65.4, z0 + 8.4, x + 2, 71.6, z0 + 14.6, DARK); X.B(x + 0.4, 71, z0 + 4, x + 1.6, 72, z0 + 10, STEEL_D); }
  X.B(x0, 88, z1 - 13, x1, 91, z1 - 10, STEEL); X.B(x0, 84, z1 - 12.5, x1, 86, z1 - 10.5, RUST);
  for (const z of C.walks || []) {
    const y = C.walkY || 108;
    X.B(x0, y, z - 4, x1, y + 1, z + 4, STEEL_D); X.stripes(x0, y - 0.3, z - 4.3, x1, y + 0.5, z - 4, Math.round((x1 - x0) / 12)); X.stripes(x0, y - 0.3, z + 4, x1, y + 0.5, z + 4.3, Math.round((x1 - x0) / 12));
    for (const s of [-4, 3.6]) { X.B(x0, y + 5, z + s, x1, y + 5.6, z + s + 0.4, YELLOW); X.B(x0, y + 2.8, z + s, x1, y + 3.2, z + s + 0.4, YELLOW_D); }
    for (let x = x0; x <= x1; x += bay / 2) { for (const s of [-4, 3.6]) X.B(x - 0.3, y + 1, z + s, x + 0.3, y + 5.6, z + s + 0.4, YELLOW_D); }
    for (let x = x0; x <= x1 + 1; x += bay * 2) for (const s of [-4.4, 3.8]) X.B(x - 0.4, y, z + s, x + 0.4, eave - 2, z + s + 0.6, STEEL_D);   // hangers up to the trusses
    for (let x = x0 + bay; x < x1; x += bay * 2) X.L(x - 0.8, y - 1.2, z - 0.8, x + 0.8, y, z + 0.8, AMBER, 0.8);
  }
}
// A pendant lamp (into X) hung from the roof over (x, z), its mouth at y: the rod, a wide shade, the lamp in it.
export function pendant(X, x, y, z, top) {
  X.B(x - 0.5, y + 6, z - 0.5, x + 0.5, top, z + 0.5, DARK);
  X.B(x - 2, y + 5, z - 2, x + 2, y + 7, z + 2, STEEL_D); X.B(x - 4, y + 3, z - 4, x + 4, y + 5, z + 4, DARK); X.B(x - 6, y + 1, z - 6, x + 6, y + 3, z + 6, DARK); X.B(x - 7.5, y, z - 7.5, x + 7.5, y + 1, z + 7.5, YELLOW_D);
  X.L(x - 5.5, y - 0.3, z - 5.5, x + 5.5, y + 0.9, z + 5.5, [3.0, 2.5, 1.7]);
}
// The crane's bridge across the hall, about its own middle along x (it travels along x): two box girders from wall to
// wall at the rails' height, the end trucks on the rails, and a trolley over each of `S.zs` with its drum and lamps
// (S.hook: a hook block hanging that far under it, for a crane with no ladle).
export function bridgeGeo(S) {
  const X = makeBoxes(), y = 0, z0 = S.z0 + 5, z1 = S.z1 - 5;
  for (const x of [-7, 4]) { X.B(x, y + 1, z0, x + 3, y + 9, z1, YELLOW); X.B(x - 0.3, y + 0.4, z0, x + 3.3, y + 1, z1, YELLOW_D); X.B(x - 0.3, y + 9, z0, x + 3.3, y + 9.6, z1, YELLOW_D); }
  for (let z = z0 + 20; z < z1 - 10; z += 44) { X.B(-4, y + 3, z, 4, y + 5, z + 1.6, STEEL_D); X.stripes(-7.2, y + 2, z + 6, -6.9, y + 8, z + 26, 5, true); X.stripes(6.9, y + 2, z + 6, 7.2, y + 8, z + 26, 5, true); }
  for (const z of [z0 - 1, z1 - 5]) { X.B(-13, y, z, 13, y + 6, z + 6, STEEL_D); X.stripes(-13, y + 1.5, z - 0.2, 13, y + 4.5, z + 6.2, 8); for (const x of [-11, 9]) X.B(x, y - 2.4, z + 1, x + 2, y, z + 5, DARK); }
  // a trolley over each ladle: a frame across the girders, the hoist's drum, lamps underneath; a cab beside the first
  (S.zs || [S.z]).forEach((tz, i) => {
    X.B(-9, y + 9.6, tz - 9, 9, y + 12, tz + 9, STEEL_D); X.B(-5, y + 12, tz - 6, 5, y + 18, tz + 6, RUST); X.B(-6, y + 13, tz - 3, 6, y + 17, tz + 3, DARK);
    X.B(-3, y - 4, tz - 3, 3, y + 1, tz + 3, DARK);
    if (!i) { X.B(7.2, y - 9, tz - 20, 13.2, y + 1, tz - 11, YELLOW_D); X.B(7, y - 7, tz - 19.6, 13.4, y - 3, tz - 11.4, BLACK); X.L(7.6, y - 6.6, tz - 20.1, 12.8, y - 3.4, tz - 19.9, LAMP, 0.35); }
    for (const [x, z] of [[-8, tz - 8], [8, tz - 8], [-8, tz + 8], [8, tz + 8]]) X.L(x - 0.8, y - 0.9, z - 0.8, x + 0.8, y + 0.4, z + 0.8, AMBER);
    if (S.hook) { X.B(-0.6, y - S.hook, tz - 0.6, 0.6, y - 4, tz + 0.6, STEEL_D); X.B(-3.5, y - S.hook - 7, tz - 2.5, 3.5, y - S.hook, tz + 2.5, YELLOW); X.stripes(-3.6, y - S.hook - 5, tz - 2.6, 3.6, y - S.hook - 2, tz + 2.6, 4); X.B(-1, y - S.hook - 11, tz - 1, 1, y - S.hook - 7, tz + 1, DARK); X.B(-1, y - S.hook - 12, tz - 1, 3, y - S.hook - 11, tz + 1, DARK); }
  });
  return X.geos();
}
// A furnace behind the wall (into X), its front toward +z turned by `flip` (-1: toward -z): a stepped stack in bands,
// a platform round it, the charging door alight, the tap hole and its runner, the offtake up through the roof.
export function furnace(X, x, z, top, flip = 1) {
  const f = flip, zz = (a) => z + f * a;
  const tier = (hw, y0, y1, col) => X.B(x - hw, y0, Math.min(zz(-hw), zz(hw)), x + hw, y1, Math.max(zz(-hw), zz(hw)), col);
  tier(21, 0, 10, CONC); tier(18, 10, 34, RUST_D); tier(19, 20, 23, DARK); tier(16, 34, 60, 0x4a3a30); tier(17, 44, 47, DARK); tier(13, 60, 78, RUST_D); tier(14.5, 68, 70.5, DARK); tier(9, 78, 90, STEEL_D);
  X.B(x - 4, 90, zz(-4) < zz(4) ? zz(-4) : zz(4), x + 4, top + 6, Math.max(zz(-4), zz(4)), DARK);
  // the platform at thirty-four, with a rail
  tier(24, 33, 34.4, STEEL_D); for (const sx of [-24, 23.2]) X.B(x + sx, 34.4, Math.min(zz(-24), zz(24)), x + sx + 0.8, 39, Math.max(zz(-24), zz(24)), YELLOW_D);
  X.B(x - 24, 38.4, Math.min(zz(23.2), zz(24)), x + 24, 39.2, Math.max(zz(23.2), zz(24)), YELLOW);
  // the door, alight, and the glow round its frame; the tap hole low down
  const face = (hw, y0, y1, d0, d1, col, lit, k) => { const a = zz(d0), b = zz(d1); if (lit) X.L(x - hw, y0, Math.min(a, b), x + hw, y1, Math.max(a, b), lit, k); else X.B(x - hw, y0, Math.min(a, b), x + hw, y1, Math.max(a, b), col); };
  face(8.5, 38, 53, 16, 17.2, DARK); face(7, 39.5, 51.5, 17, 17.5, 0, [2.8, 0.95, 0.14]); face(7, 44.6, 45.4, 17.4, 17.9, DARK); face(0.5, 39.5, 51.5, 17.4, 17.9, DARK);
  face(4, 12, 18, 18, 19.4, DARK); face(2.6, 13, 17, 19.2, 19.7, 0, HOT, 0.9); face(3.4, 9, 11.4, 19, 30, STEEL_D); face(2.2, 11.2, 11.6, 19.5, 30, 0, WARM);
  // pipes up its sides
  for (const sx of [-20.5, 18.5]) { X.B(x + sx, 10, Math.min(zz(6), zz(8)), x + sx + 2, 74, Math.max(zz(6), zz(8)), STEEL); X.B(x + sx - 0.3, 30, Math.min(zz(5.7), zz(8.3)), x + sx + 2.3, 31.4, Math.max(zz(5.7), zz(8.3)), DARK); }
}
// The cradle the robot is built in (into X), about (x, z), open toward `face` (+1: +x... the robot looks that way):
// two scaffold towers either side of him (along z), decks at three heights with rails, a beam over his head with a
// hoist, and work lamps. half: from his middle to each tower; top: the beam's height.
export function cradle(X, x, z, half, top, k = 1) {
  for (const sg of [-1, 1]) {
    const zc = z + sg * half;
    for (const [px, pz] of [[-9, -5], [9, -5], [-9, 5], [9, 5]]) X.B(x + px - 1, 0, zc + pz - 1, x + px + 1, top, zc + pz + 1, STEEL_D);
    for (let y = 0; y < top - 8; y += 16) { X.beam([x - 9, y + 1, zc - 5], [x + 9, y + 15, zc - 5], 1, STEEL); X.beam([x - 9, y + 1, zc + 5], [x + 9, y + 15, zc + 5], 1, STEEL); X.beam([x + 9, y + 1, zc - 5], [x + 9, y + 15, zc + 5], 1, STEEL); }
    for (const y of [22 * k, 44 * k, 65 * k]) {
      if (y > top - 6) continue;
      const zi = zc - sg * 9;   // the deck reaches in toward him
      X.B(x - 11, y, Math.min(zi, zc + sg * 6), x + 11, y + 1, Math.max(zi, zc + sg * 6), STEEL_D);
      X.B(x + 10.4, y + 1, Math.min(zi, zc + sg * 6), x + 11, y + 5.5, Math.max(zi, zc + sg * 6), YELLOW);
      X.B(x - 11, y + 4.8, zi - 0.3, x + 11, y + 5.5, zi + 0.3, YELLOW); X.stripes(x - 11, y - 0.4, zi - 0.4, x + 11, y + 0.2, zi + 0.4, 8);
      X.L(x + 8, y + 5.6, zi - 0.8, x + 9.6, y + 7, zi + 0.8, LAMP, 0.8);
    }
    for (const y of [10 * k, 33 * k, 55 * k]) X.L(x + 10.2, y, zc - 0.6, x + 11, y + 1.2, zc + 0.6, AMBER);
  }
  X.B(x - 3, top, z - half - 8, x + 3, top + 6, z + half + 8, YELLOW); X.stripes(x + 3, top + 1, z - half - 8, x + 3.3, top + 5, z + half + 8, 14, true);
  X.B(x - 5, top - 3, z - 3, x + 5, top, z + 3, DARK);
}
