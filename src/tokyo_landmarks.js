// Tokyo's set pieces: the red-and-white lattice tower, the tall broadcast tower across the river, Senso-ji with its
// gate, hall and five-storey pagoda, the palace behind its moat, the brick station with bullet trains at its platforms,
// and the wheel on the bay. The two towers and the wheel are our own takes under our own names (Shiba Tower, Sora
// Tower, Bay Wheel); the temple, the palace and the station keep theirs.
// Each is drawn round a local origin with its front toward low z and turned by place().
import { M, set, put, box, hole, walls, begin, rnd, ri, vehicle } from './world.js';
import { face, faces4, win, door, disc, text, textW, tree, lampPost, bench } from './kit.js';
import { hipRoof, sakura, stoneLantern } from './tokyo_kit.js';

// straight lines between the knots of a profile: [[y, value], ...]
const along = (K) => (y) => { for (let i = 1; i < K.length; i++) if (y <= K[i][0]) { const [y0, v0] = K[i - 1], [y1, v1] = K[i]; return Math.round(v0 + (v1 - v0) * (y - y0) / (y1 - y0)); } return K[K.length - 1][1]; };
const mod = (a, n) => ((a % n) + n) % n;

// ---- Shiba Tower: 196 voxels of orange and white lattice on four splayed legs, with two decks and a mast -------------
export const SHIBA = { S: 86, H: 196, D1: 62, D2: 124 };
export function shibatower(lx, lz, L, o = {}) {
  const cx = lx + 43, cz = lz + 43, { D1, D2 } = SHIBA;
  begin(o.title || 'Shiba Tower', 'landmark');
  // one quarter is drawn and mirrored: a and b count outward from the axis, which lies between two voxels
  const q = (a, y, b, m) => { set(cx + a, y, cz + b, m); set(cx - 1 - a, y, cz + b, m); set(cx + a, y, cz - 1 - b, m); set(cx - 1 - a, y, cz - 1 - b, m); };
  const OUT = along([[0, 40], [58, 17], [112, 8], [150, 4], [162, 3]]), IN = along([[0, 27], [40, 9], [58, 0]]);
  const col = (y) => (y < 34 || (((y - 34) / 21) | 0) % 2 === 1 ? M.TWR_R : M.TWR_W);
  for (let y = 0; y <= 2; y++) for (let a = 25 + y; a < 43 - y; a++) for (let b = 25 + y; b < 43 - y; b++) q(a, y, b, M.STONE);
  // the legs, then the single shaft they join into: hollow squares of lattice with a post at every corner. Every face
  // is two voxels thick and no profile moves more than a voxel a layer, so each layer stands on the one below.
  for (let y = 3; y <= 162; y++) {
    const E = OUT(y), I = IN(y), ring = y % 12 === 0, P = y < 58 ? 3 : 2, m = col(y);
    for (let a = I; a < E; a++) for (let b = I; b < E; b++) {
      const ea = a >= E - 2 || (I > 0 && a < I + 2), eb = b >= E - 2 || (I > 0 && b < I + 2);
      if (!ea && !eb) continue;
      const pa = a >= E - P || (I > 0 && a < I + P), pb = b >= E - P || (I > 0 && b < I + P), t = ea ? b : a;
      if ((pa && pb) || ring || mod(t + y, 12) < 2 || mod(t - y, 12) < 2) q(a, y, b, m);
    }
  }
  // a deck: a glazed box round the shaft, two storeys for the main one
  const deck = (y0, h, D) => {
    for (let y = y0; y <= y0 + h; y++) for (let a = 0; a < D; a++) for (let b = 0; b < D; b++) {
      const r = Math.max(a, b), k = y - y0;
      if (k === 0 || k === h) q(a, y, b, M.TWR_W);
      else if (r === D - 1) q(a, y, b, (k % 6 >= 2 && k % 6 <= 4) && (a + b) % 5 ? M.GLASS : k % 6 === 0 ? M.TWR_R : M.TWR_W);
    }
    if (L >= 1) for (let a = 0; a < D; a += 3) { q(a, y0 + h + 1, D - 1, M.LIT_Y); q(D - 1, y0 + h + 1, a, M.LIT_Y); }
  };
  deck(D1, 12, OUT(D1) + 5); deck(D2, 6, OUT(D2) + 4);
  // the mast
  for (let y = 163; y <= SHIBA.H; y++) { const w = y < 178 ? 2 : 1, m = ((y - 163) / 6 | 0) & 1 ? M.TWR_W : M.TWR_R; for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) q(a, y, b, m); }
  q(0, SHIBA.H + 1, 0, M.LIT_R);
  // the hall between the feet
  begin('Tower hall', 'shop');
  for (let y = 0; y <= 16; y++) for (let a = 0; a < 14; a++) for (let b = 0; b < 14; b++) {
    const r = Math.max(a, b);
    if (y === 16 || (y === 8 && r < 13)) q(a, y, b, y === 16 ? M.SLAB : M.CONC);
    else if (r === 13) q(a, y, b, y < 2 ? M.STONE : (y % 8 >= 3 && y % 8 <= 6) && (a + b) % 4 ? M.GLASS : M.REND_C);
  }
  if (L >= 2) { for (const [a, b] of [[4, 4], [78, 4], [4, 78], [78, 78]]) sakura(lx + a, lz + b, 8, 5); lampPost(lx + 43, lz + 2, 18); bench(lx + 30, lz + 4); bench(lx + 50, lz + 4); }
}

// ---- Sora Tower: a white tube of lattice that narrows as it climbs, two drums of observation deck and a mast to the
// top of the world -----------------------------------------------------------------------------------------------------
export const SORA = { H: 254 };
export function soratower(lx, lz, L, o = {}) {
  const cx = lx + 20, cz = lz + 20;
  begin(o.title || 'Sora Tower', 'landmark');
  const R = along([[0, 16], [60, 12], [150, 9], [168, 9]]);
  // a ring of the tube: lattice lines in white over pale steel, with a light where they cross
  const ringAt = (y, r, t, solid) => {
    for (let x = -r; x < r; x++) for (let z = -r; z < r; z++) {
      const d2 = (x + 0.5) * (x + 0.5) + (z + 0.5) * (z + 0.5);
      if (d2 > r * r || (!solid && d2 < (r - t) * (r - t))) continue;
      const k = Math.floor((Math.atan2(z + 0.5, x + 0.5) + Math.PI) / (Math.PI * 2) * 48), u = mod(k * 2 + y, 16), v = mod(k * 2 - y, 16);
      set(cx + x, y, cz + z, d2 < (r - 2) * (r - 2) ? M.TRIM : u < 2 && v < 2 ? M.LIT_B : u < 2 || v < 2 || y % 16 === 0 ? M.TRIM : M.CHROME);
    }
  };
  for (let y = 0; y <= 168; y++) ringAt(y, R(y), 2, y % 32 === 0);
  for (let y = 0; y <= 228; y++) disc(cx, cz, y, 3, M.TRIM);
  // the decks: a wide drum and a smaller one over it, glazed all round
  const drum = (y0, y1, r) => {
    disc(cx, cz, y0 - 1, r - 3, M.TRIM); disc(cx, cz, y0, r, M.TRIM); disc(cx, cz, y1, r, M.TRIM);
    for (let y = y0 + 1; y < y1; y++) for (let x = -r; x < r; x++) for (let z = -r; z < r; z++) {
      const d2 = (x + 0.5) * (x + 0.5) + (z + 0.5) * (z + 0.5);
      if (d2 <= r * r && d2 >= (r - 1) * (r - 1)) set(cx + x, y, cz + z, (y - y0) % 5 === 0 ? M.TRIM : (x + z + y) % 7 === 0 ? M.LIT_B : M.GLASS);
    }
    for (let y = y0 + 5; y < y1; y += 5) disc(cx, cz, y, r - 1, M.CONC, 3);
  };
  for (let y = 169; y <= 171; y++) disc(cx, cz, y, 9, M.TRIM);
  drum(172, 187, 14);
  for (let y = 188; y <= 191; y++) disc(cx, cz, y, 7, M.TRIM);
  drum(192, 202, 11);
  for (let y = 203; y <= 228; y++) disc(cx, cz, y, y < 206 ? 6 : 4, (y >> 2) & 1 ? M.TRIM : M.CHROME);
  for (let y = 229; y <= 246; y++) disc(cx, cz, y, 2, (y >> 2) & 1 ? M.TRIM : M.CHROME);
  for (let y = 247; y <= SORA.H - 1; y++) box(cx - 1, y, cz - 1, cx, y, cz, M.TRIM);
  set(cx, SORA.H, cz, M.LIT_R); set(cx - 1, SORA.H, cz, M.LIT_R);
  // the hall at its foot
  begin('Sora hall', 'shop');
  for (const F of faces4(lx + 1, lz + 1, lx + 38, lz + 38)) for (let u = 0; u < F.W; u++) for (let y = 0; y <= 9; y++) F.p(u, y, 0, y < 2 ? M.STONE : y === 9 ? M.TRIM : u % 6 === 0 ? M.TRIM : M.GLASS);
  for (let x = lx + 2; x <= lx + 37; x++) for (let z = lz + 2; z <= lz + 37; z++) if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > 15.5) set(x, 9, z, M.SLAB);
  hole(lx + 17, 2, lz + 1, lx + 22, 7, lz + 1);
}

// ---- Senso-ji: the Thunder Gate with its great lantern, the main hall under its huge tiled roof, and the pagoda -------
export const SENSO = { S: 86 };
export function sensoji(lx, lz, L, o = {}) {
  // the gate
  {
    const x0 = lx + 26, x1 = lx + 59, z0 = lz + 4, z1 = lz + 13;
    begin('Thunder Gate', 'monument');
    for (const a of [x0, x0 + 9, x1 - 10, x1 - 1]) for (const b of [z0, z1 - 1]) box(a, 0, b, a + 1, 17, b + 1, M.VERMIL);
    for (const [a0, a1] of [[x0, x0 + 10], [x1 - 10, x1]]) {
      walls(a0, 0, z0, a1, 17, z1, M.VERMIL);
      for (let a = a0 + 2; a < a1 - 1; a++) for (let y = 3; y <= 13; y++) { set(a, y, z0, (a + y) & 1 ? M.DARK : M.ROOF_G); set(a, y, z1, M.PL_W); }
      box(a0, 0, z0, a1, 1, z1, M.STONE);
    }
    box(x0, 18, z0, x1, 18, z1, M.VERMIL); box(x0 + 11, 16, z0, x1 - 11, 17, z0 + 1, M.VERMIL); box(x0 + 11, 16, z1 - 1, x1 - 11, 17, z1, M.VERMIL);
    hipRoof(x0, z0, x1, z1, 19, 4, M.ROOF_S, M.ROOF_D, 2);
    // the lantern: red paper between black hoops, hung from the beam
    const cx = lx + 43, cz = lz + 9;
    box(cx - 1, 16, cz - 1, cx, 17, cz, M.DARK);
    for (let y = 5; y <= 15; y++) disc(cx, cz, y, y === 5 || y === 15 ? 3 : 4, y <= 6 || y >= 14 ? M.DARK : M.CAR_A);
    disc(cx, cz, 4, 2, M.BRASS);
    for (const [a, y] of [[-1, 12], [0, 12], [-1, 11], [0, 9], [-1, 9], [0, 8], [-1, 10]]) { set(cx + a, y, cz - 4, M.DARK); set(cx + a, y, cz + 3, M.DARK); }
  }
  // the main hall
  {
    const x0 = lx + 14, x1 = lx + 71, z0 = lz + 48, z1 = lz + 81;
    begin('Senso-ji', 'landmark');
    walls(x0 - 3, 0, z0 - 3, x1 + 3, 3, z1 + 3, M.STONE); box(x0 - 3, 3, z0 - 3, x1 + 3, 3, z1 + 3, M.STONE);
    for (let k = 0; k < 3; k++) box(lx + 34, 0, z0 - 6 + k, lx + 51, k, z0 - 4, M.STONE);
    walls(x0, 4, z0, x1, 24, z1, M.PL_W);
    const F4 = faces4(x0, z0, x1, z1);
    for (const F of F4) { for (let u = 0; u < F.W; u += 6) F.box(u, 4, u, 24, 0, 0, M.VERMIL); F.box(F.W - 1, 4, F.W - 1, 24, 0, 0, M.VERMIL); for (const y of [4, 5, 14, 23, 24]) F.box(0, y, F.W - 1, y, 0, 0, M.VERMIL); }
    const Ff = F4[0];
    for (const u of [13, 25, 37]) { for (let a = u; a <= u + 7; a++) for (let y = 6; y <= 13; y++) Ff.p(a, y, 0, (a - u) % 3 === 0 || y === 10 ? M.BRASS : M.DARK); }
    hole(lx + 40, 4, z0, lx + 45, 13, z0);
    box(x0 + 1, 24, z0 + 1, x1 - 1, 24, z1 - 1, M.FLOOR);
    hipRoof(x0, z0, x1, z1, 25, 5, M.ROOF_S, M.ROOF_D, 2);
    // a lantern in the doorway and the incense burner out front
    box(lx + 42, 22, z0 - 1, lx + 43, 23, z0 - 1, M.DARK); for (let y = 15; y <= 21; y++) disc(lx + 43, z0 - 1, y, y === 15 || y === 21 ? 2 : 3, y <= 15 || y >= 21 ? M.DARK : M.CAR_A);
    box(lx + 42, 24, z0 - 2, lx + 43, 24, z0 - 1, M.DARK);
    begin('Incense burner', 'prop', false);
    disc(lx + 43, lz + 34, 0, 3, M.STONE); disc(lx + 43, lz + 34, 1, 2, M.IRON); disc(lx + 43, lz + 34, 2, 3, M.IRON); disc(lx + 43, lz + 34, 3, 3, M.IRON, 2);
    for (const [a, b] of [[-3, -3], [2, -3], [-3, 2], [2, 2]]) box(lx + 43 + a, 0, lz + 34 + b, lx + 43 + a, 9, lz + 34 + b, M.VERMIL);
    box(lx + 39, 10, lz + 30, lx + 46, 10, lz + 37, M.ROOF_S); box(lx + 41, 11, lz + 32, lx + 44, 11, lz + 35, M.ROOF_S);
  }
  // the pagoda: five storeys, each a little smaller, each under its own roof, and a bronze spire
  {
    const px = lx + 13, pz = lz + 30;
    begin('Five-storey pagoda', 'landmark');
    box(px - 10, 0, pz - 10, px + 9, 2, pz + 9, M.STONE);
    box(px - 1, 3, pz - 1, px, 66, pz, M.TRUNK);
    let top = 0;
    for (let i = 0; i < 5; i++) {
      const hw = 8 - i, y0 = 3 + i * 12, a0 = px - hw, a1 = px + hw - 1, b0 = pz - hw, b1 = pz + hw - 1;
      walls(a0, y0, b0, a1, y0 + 8, b1, M.VERMIL);
      for (const F of faces4(a0, b0, a1, b1)) { for (let u = 2; u < F.W - 2; u++) for (let y = y0 + 2; y <= y0 + 6; y++) F.p(u, y, 0, Math.abs(u - (F.W - 1) / 2) < 1.6 ? M.DARK : M.PL_W); F.box(0, y0 + 7, F.W - 1, y0 + 7, 1, 1, M.BRASS); }
      top = hipRoof(a0, b0, a1, b1, y0 + 9, 4, M.ROOF_S, M.ROOF_D, 1, i < 4 ? 2 : 0);
    }
    box(px - 1, top - 2, pz - 1, px, top + 15, pz, M.BRASS);
    for (let k = 0; k < 6; k++) disc(px, pz, top + 2 + k * 2, 2, M.BRASS);
    set(px, top + 16, pz, M.BRASS); set(px - 1, top + 16, pz - 1, M.BRASS);
  }
  if (L >= 2) {
    for (const [a, b] of [[70, 26], [80, 40], [6, 6], [78, 8], [62, 30]]) sakura(lx + a, lz + b, 8, 5);
    for (const a of [34, 51]) { stoneLantern(lx + a, lz + 20); stoneLantern(lx + a, lz + 28); }
    lampPost(lx + 2, lz + 2, 18); lampPost(lx + 82, lz + 2, 18);
  }
}

// ---- the Imperial Palace: stone ramparts inside a moat (painted on the ground), white corner turrets, a gate reached
// by a stone bridge of two arches, and a white keep of three tiers on a stone base among the pines ----------------------
export const PALACE = { S: 132, MOAT: [5, 21], WALL: [22, 26] };
const stoneAt = (x, y, z) => ((x >> 1) * 5 + (y >> 1) * 3 + (z >> 1) * 7) % 6 === 0 ? M.STONE : M.GRANITE;
function turret(x0, z0, w, yb, n, title) {
  begin(title, 'monument');
  for (let y = 0; y <= yb; y++) for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + w; z++) if (y === yb || x < x0 + 2 || x >= x0 + w - 2 || z < z0 + 2 || z >= z0 + w - 2) set(x, y, z, stoneAt(x, y, z));
  let y = yb + 1, a0 = x0 + 1, a1 = x0 + w - 2, b0 = z0 + 1, b1 = z0 + w - 2;
  for (let i = 0; i < n; i++) {
    const h = i === n - 1 ? 8 : 9;
    walls(a0, y, b0, a1, y + h, b1, M.TRIM);
    for (const F of faces4(a0, b0, a1, b1)) { for (let u = 2; u < F.W - 2; u += 3) F.box(u, y + 4, u, y + 6, 0, 0, M.DARK); F.box(0, y, F.W - 1, y + 1, 0, 0, M.CONC); }
    y = hipRoof(a0, b0, a1, b1, y + h + 1, 3, M.ROOF_S, M.BRASS, 2, i < n - 1 ? 2 : 0);
    if (i < n - 1) { y -= 2; a0 += 3; a1 -= 3; b0 += 3; b1 -= 3; box(a0, y - 1, b0, a1, y - 1, b1, M.ROOF_S); }
  }
  return y;
}
export function palace(lx, lz, L, o = {}) {
  const S = PALACE.S, [w0, w1] = PALACE.WALL, W = 9;
  // the ramparts: four lengths of battered stone with a plastered parapet, the front one broken by the gate
  const rampart = (xa, za, xb, zb, name) => {
    begin(name, 'monument');
    for (let x = xa; x <= xb; x++) for (let z = za; z <= zb; z++) for (let y = 0; y <= W; y++) set(lx + x, y, lz + z, stoneAt(x, y, z));
    const alongX = xb - xa > zb - za;
    if (alongX) { box(lx + xa, W + 1, lz + za + 1, lx + xb, W + 3, lz + za + 2, M.TRIM); box(lx + xa, W + 4, lz + za, lx + xb, W + 4, lz + za + 3, M.ROOF_S); }
    else { box(lx + xa + 1, W + 1, lz + za, lx + xa + 2, W + 3, lz + zb, M.TRIM); box(lx + xa, W + 4, lz + za, lx + xa + 3, W + 4, lz + zb, M.ROOF_S); }
  };
  rampart(w0 + 14, w0, 55, w1, 'Palace wall'); rampart(76, w0, S - 1 - w0 - 14, w1, 'Palace wall');
  rampart(w0 + 14, S - 1 - w1, S - 1 - w0 - 14, S - 1 - w0, 'Palace wall');
  rampart(w0, w0 + 14, w1, S - 1 - w0 - 14, 'Palace wall'); rampart(S - 1 - w1, w0 + 14, S - 1 - w0, S - 1 - w0 - 14, 'Palace wall');
  for (const [a, b] of [[w0, w0], [S - w0 - 14, w0], [w0, S - w0 - 14], [S - w0 - 14, S - w0 - 14]]) turret(lx + a, lz + b, 14, W + 2, 2, 'Palace turret');
  // the gate house over the way in
  begin('Palace gate', 'monument');
  for (const a of [56, 73]) for (let x = a; x <= a + 2; x++) for (let z = w0; z <= w1; z++) for (let y = 0; y <= W + 1; y++) set(lx + x, y, lz + z, stoneAt(x, y, z));
  box(lx + 56, W + 2, lz + w0 - 1, lx + 75, W + 2, lz + w1 + 1, M.TRUNK);
  walls(lx + 56, W + 3, lz + w0 - 1, lx + 75, W + 9, lz + w1 + 1, M.TRIM);
  for (let x = lx + 58; x <= lx + 73; x += 3) { box(x, W + 5, lz + w0 - 1, x, W + 7, lz + w0 - 1, M.DARK); box(x, W + 5, lz + w1 + 1, x, W + 7, lz + w1 + 1, M.DARK); }
  hipRoof(lx + 56, lz + w0 - 1, lx + 75, lz + w1 + 1, W + 10, 3, M.ROOF_S, M.BRASS, 2);
  // the bridge over the moat: two arches of stone
  begin('Stone bridge', 'monument');
  for (let z = 2; z <= w0 - 1; z++) {
    const k = Math.min(Math.abs(z - 8.5), Math.abs(z - 16.5)), open = k < 3.6 ? Math.round(Math.sqrt(13 - k * k) * 1.2) : -1;
    for (let x = 59; x <= 72; x++) for (let y = 0; y <= 5; y++) if (y > open || y === 5) set(lx + x, y, lz + z, y === 5 ? M.STONE : stoneAt(x, y, z));
    for (const x of [59, 72]) { set(lx + x, 6, lz + z, M.GRANITE); if (z % 3 === 0) set(lx + x, 7, lz + z, M.GRANITE); set(lx + x, z % 3 === 0 ? 8 : 7, lz + z, M.TRIM); }
  }
  // the keep
  const top = turret(lx + 44, lz + 56, 44, 12, 3, 'Imperial Palace');
  if (L >= 2) {
    for (const [a, b] of [[34, 36], [98, 36], [34, 60], [98, 62], [32, 96], [100, 98], [52, 42], [80, 42], [66, 40]]) tree(lx + a, lz + b, ri(9, 13), ri(4, 5));
    for (const [a, b] of [[44, 34], [88, 34], [36, 80], [96, 80]]) sakura(lx + a, lz + b, 8, 5);
    stoneLantern(lx + 60, lz + 32); stoneLantern(lx + 71, lz + 32);
  }
  return top;
}

// ---- Tokyo Station: the long red-brick front with its two domes, and behind it the platforms, with bullet trains
// standing at them -----------------------------------------------------------------------------------------------------
export const STATION = { S: 132, PLAT: [46, 66, 86, 106] };
export function station(lx, lz, L, o = {}) {
  const x0 = lx + 4, x1 = lx + 127, z0 = lz + 8, z1 = lz + 35, G = 12, top = 33;
  begin('Tokyo Station', 'landmark');
  walls(x0, 0, z0, x1, top, z1, M.BRICK);
  for (const y of [G - 1, G + 10]) box(x0 + 1, y, z0 + 1, x1 - 1, y, z1 - 1, M.CONC);
  box(x0, top, z0, x1, top, z1, M.SLAB);
  const F4 = faces4(x0, z0, x1, z1), [Ff, Fr, Fb, Fl] = F4;
  for (const F of F4) {
    F.box(0, 0, F.W - 1, 1, 0, 0, M.GRANITE);
    for (const y of [G - 1, G + 10, top - 1, top]) F.band(y, y, 0, M.TRIM);
    if (L >= 1) F.band(top, top, 1, M.TRIM);
    for (let u = 4; u + 3 <= F.W - 4; u += 7) {
      if (F === Ff && Math.abs(u + 1 - F.W / 2) < 9) continue;
      win(F, u, 3, 3, 6, { frame: M.TRIM }); win(F, u, G + 2, 3, 6, { frame: M.TRIM, lintel: M.TRIM }); win(F, u, G + 13, 3, 5, { frame: M.TRIM });
      if (L >= 1) for (let y = 2; y <= top - 2; y++) F.p(u + 5, y, 0, (y >> 1) & 1 ? M.BRICK : M.BRICK2);
    }
  }
  // the middle entrance under its own gable, and three arched doors
  const mu = Ff.W >> 1;
  Ff.box(mu - 9, 0, mu + 9, top + 6, 1, 1, M.BRICK); for (const y of [G - 1, G + 10, top, top + 6]) Ff.box(mu - 9, y, mu + 9, y, 1, 1, M.TRIM);
  for (const u of [mu - 7, mu - 2, mu + 3]) { Ff.box(u, 0, u + 3, 8, 1, 1, M.DARK); Ff.box(u + 1, 9, u + 2, 9, 1, 1, M.DARK); Ff.box(u, 2, u + 3, 6, 1, 1, M.GLASS); }
  for (const u of [mu - 6, mu - 1, mu + 4]) { Ff.box(u, G + 2, u + 1, G + 7, 1, 1, M.GLASS); Ff.box(u, G + 13, u + 1, G + 17, 1, 1, M.GLASS); }
  for (let k = 0; k < 6; k++) Ff.box(mu - 8 + k * 1, top + 7 + k, mu + 8 - k, top + 7 + k, 1, 1, k === 5 ? M.TRIM : M.BRICK);
  text(Ff, 'TOKYO', mu - 9, top + 1, 2, M.DARK);
  // the slate roof and the two domes
  walls(x0 + 1, top + 1, z0 + 1, x1 - 1, top + 3, z1 - 1, M.ROOF_D); box(x0 + 1, top + 4, z0 + 1, x1 - 1, top + 4, z1 - 1, M.ROOF_D);
  for (const cx of [lx + 26, lx + 106]) {
    const cz = lz + 22;
    for (let y = top + 1; y <= top + 8; y++) { disc(cx, cz, y, 12, M.BRICK, 10); if (y === top + 1 || y === top + 8) disc(cx, cz, y, 12, M.TRIM, y === top + 8 ? -1 : 10); }
    for (let k = 0; k < 8; k++) { const a = Math.PI * 2 * k / 8; for (let y = top + 3; y <= top + 6; y++) set(Math.round(cx - 0.5 + 11.3 * Math.cos(a)), y, Math.round(cz - 0.5 + 11.3 * Math.sin(a)), M.GLASS); }
    for (let k = 1; k <= 9; k++) disc(cx, cz, top + 8 + k, Math.max(1, Math.round(12 * Math.cos(k / 9 * 1.45))), M.ROOF_D);
    box(cx - 1, top + 17, cz - 1, cx, top + 20, cz, M.BRASS);
  }
  if (L >= 2) { for (const a of [20, 44, 86, 110]) lampPost(lx + a, lz + 3, 18); bench(lx + 56, lz + 3); bench(lx + 70, lz + 3); }
  // the platforms, each under a long canopy
  for (const b of STATION.PLAT) {
    begin('Platform', 'prop', true);
    box(lx + 6, 0, lz + b, lx + 125, 2, lz + b + 7, M.CONC); box(lx + 6, 2, lz + b, lx + 125, 2, lz + b, M.TAXI); box(lx + 6, 2, lz + b + 7, lx + 125, 2, lz + b + 7, M.TAXI);
    for (let a = 10; a <= 122; a += 14) box(lx + a, 3, lz + b + 3, lx + a, 15, lz + b + 4, M.STEEL);
    box(lx + 6, 16, lz + b - 1, lx + 125, 16, lz + b + 8, M.ZINC); box(lx + 6, 17, lz + b + 2, lx + 125, 17, lz + b + 5, M.ZINC);
    for (let a = 24; a <= 122; a += 28) { box(lx + a, 12, lz + b + 2, lx + a + 5, 14, lz + b + 2, M.DARK); set(lx + a + 1, 13, lz + b + 2, M.LIT_G); set(lx + a + 3, 13, lz + b + 2, M.LIT_Y); }
  }
  // the trains (the models in civilian/src, stood by src/civilians.js): two express trains and a commuter train between
  // them, each of two cars coupled back to back (the rear one is turned round), a voxel apart
  const car = (kind, a, b, fx, type, paint, rear) => vehicle(kind, lx + a, lz + b, fx, 0, { opts: { type, paint, rear } });
  car('express', 92.5, 60, 1, 'nose', 'blue', false); car('express', 35.5, 60, -1, 'nose', 'blue', true);
  car('express', 39.5, 100, -1, 'nose', 'green', false); car('express', 96.5, 100, 1, 'nose', 'green', true);
  car('commuter', 87, 80, 1, 'cab', 'green', false); car('commuter', 38, 80, -1, 'cab', 'green', true);
}

// ---- the Bay Wheel: a big wheel of white steel and coloured cabins on the waterfront ---------------------------------
export const WHEEL = { S: 86, R: 36, HUB: 42 };
// a line in the x-y plane at z whose voxels touch face to face
function line(x0, y0, x1, y1, z, m) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 || 1; let px = x0, py = y0;
  for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); if (x !== px && y !== py) set(px, y, z, m); set(x, y, z, m); px = x; py = y; }
}
export function baywheel(lx, lz, L, o = {}) {
  const cx = lx + 43, cz = lz + 43, { R, HUB } = WHEEL, CAB = [M.LIT_R, M.SIGN, M.LIT_Y, M.LIT_G, M.LIT_B, M.CAR_B, M.LIT_P, M.CAR_A];
  begin(o.title || 'Bay Wheel', 'landmark');
  box(cx - 26, 0, cz - 9, cx + 26, 1, cz + 9, M.CONC);
  // the two legs each side, the axle, then the rims, the spokes and the cabins
  for (const z of [cz - 6, cz + 5]) { for (const s of [-1, 1]) { line(cx + s * 22, 0, cx + s, HUB, z, M.TRIM); line(cx + s * 22 + 1, 0, cx + s + 1, HUB, z, M.TRIM); } box(cx - 14, 20, z, cx + 14, 20, z, M.TRIM); }
  box(cx - 2, HUB - 2, cz - 6, cx + 2, HUB + 2, cz + 5, M.STEEL);
  for (const z of [cz - 3, cz + 2]) {
    for (let x = -R - 1; x <= R + 1; x++) for (let y = -R - 1; y <= R + 1; y++) { const d = Math.hypot(x, y); if (Math.abs(d - R) <= 1) set(cx + x, HUB + y, z, M.TRIM); }
    for (let k = 0; k < 16; k++) { const a = Math.PI * 2 * k / 16; line(cx, HUB, cx + Math.round((R - 1) * Math.cos(a)), HUB + Math.round((R - 1) * Math.sin(a)), z, k & 1 ? M.CHROME : M.TRIM); }
  }
  for (let k = 0; k < 16; k++) {
    const a = Math.PI * 2 * (k + 0.5) / 16, x = cx + Math.round(R * Math.cos(a)), y = HUB + Math.round(R * Math.sin(a));
    box(x, y, cz - 3, x, y, cz + 2, M.TRIM); box(x, y - 1, cz - 1, x, y - 1, cz, M.DARK);
    box(x - 1, y - 5, cz - 2, x + 1, y - 2, cz + 1, CAB[k & 7]); box(x - 1, y - 3, cz - 2, x + 1, y - 3, cz + 1, M.GLASS);
  }
  // the boarding hall under the wheel
  begin('Wheel hall', 'shop');
  walls(cx - 12, 2, cz + 8, cx + 12, 10, cz + 20, M.REND_C); box(cx - 12, 10, cz + 8, cx + 12, 10, cz + 20, M.ROOF_R);
  const F = face('f', cx - 12, cz + 8, cx + 12, cz + 20); for (let u = 2; u < 22; u += 5) F.box(u, 4, u + 2, 7, 0, 0, M.GLASS);
  box(cx - 11, 11, cz + 8, cx + 11, 18, cz + 8, M.DARK); text(F, 'WHEEL', 3, 12, 1, M.LIT_Y);
  box(cx - 12, 0, cz + 8, cx + 12, 1, cz + 20, M.CONC);
  if (L >= 2) { for (const [a, b] of [[6, 8], [78, 8], [6, 76], [78, 76], [24, 70], [60, 70]]) sakura(lx + a, lz + b, 8, 5); lampPost(lx + 2, lz + 2, 18); lampPost(lx + 82, lz + 2, 18); bench(lx + 20, lz + 6); bench(lx + 56, lz + 6); }
}
