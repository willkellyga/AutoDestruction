// Cairo's set pieces: the three pyramids of Giza and the Sphinx, the Citadel on its rise with the palace inside,
// the lattice tower on the island, the pink museum and the opera house.
// Our own voxel designs. The pyramids, the Sphinx, the Citadel and the museum are public monuments and keep their names;
// the tower is our own take and is called the Lotus Tower.
import { M, set, put, box, fill, hole, walls, begin, rnd, ri } from './world.js';
import { face, faces4, win, door, text, textW, lampPost, bench } from './kit.js';
import { palm, rdisc, dome, pointed } from './cairo_kit.js';

const hsh = (a, b, c) => ((Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) >>> 0) % 100;

// ---- a pyramid: solid courses of stone, three voxels to a course, stepping in two, two and three so the faces climb at
// the true angle. The blocks show in two tones. Deep inside is a small chamber, reached by a passage from the north face.
// A big pyramid is laid as a square of upright columns of stone, each a body of its own, so a bite out of the foot of
// one brings down the slice of the face above it and the game only has to think about that slice. The column in the
// middle, with the top and the chamber in it, is the landmark; the others carry the same name. Returns the height.
function pyr(x0, z0, B, name, o = {}) {
  const ins = [];
  for (let k = 0, inset = 0; B - 2 * inset >= 2; k++) { ins.push(inset); inset += k % 3 === 2 ? 3 : 2; }
  const H = ins.length * 3, cx = x0 + (B >> 1), cz = z0 + (B >> 1), yc = o.cap ? Math.round(H * o.cap) : 0;
  const N = B >= 100 ? 5 : B >= 50 ? 3 : 1, cut = (i) => Math.round(i * B / N);
  for (let cj = 0; cj < N; cj++) for (let ci = 0; ci < N; ci++) {
    begin(name, ci === (N >> 1) && cj === (N >> 1) ? (o.kind || 'landmark') : 'stonework', false);   // a heap of stone, not storeys: it goes bite by bite
    const ax = x0 + cut(ci), bx = x0 + cut(ci + 1) - 1, az = z0 + cut(cj), bz = z0 + cut(cj + 1) - 1;
    ins.forEach((inset, k) => {
      const a = x0 + inset, b = z0 + inset, c = x0 + B - 1 - inset, d = z0 + B - 1 - inset, foot = o.foot && k < o.foot;
      for (let yy = k * 3; yy < k * 3 + 3; yy++) for (let z = Math.max(b, az); z <= Math.min(d, bz); z++) for (let x = Math.max(a, ax); x <= Math.min(c, bx); x++) {
        const edge = Math.min(x - a, c - x, z - b, d - z);
        let m = M.SAND;
        if (edge < 4) { const h = hsh((x + k * 2) >> 2, (z + k * 2) >> 2, k); m = foot ? (h < 30 ? M.BROWNST : M.REND_P) : h < 26 ? M.SAND2 : h < 30 ? M.OCHRE : M.SAND; }
        set(x, yy, z, m);
      }
    });
    // the smooth white casing that is left near the top
    if (o.cap) for (let yy = yc - 5; yy < H + 5; yy++) {
      const r = Math.round((H - yy) * (B / 2) / H) + 3;
      for (let x = Math.max(cx - r, ax); x <= Math.min(cx + r - 1, bx); x++) for (let z = Math.max(cz - r, az); z <= Math.min(cz + r - 1, bz); z++) if (r > 0 && (yy >= yc || hsh(x >> 1, z >> 1, yy >> 1) < 45 - (yc - yy) * 7)) put(x, yy, z, hsh(x >> 2, yy, z >> 2) < 20 ? M.LIME2 : M.LIME);
    }
    // the chamber and what is in it: it lies wholly inside the middle column
    if (ci === (N >> 1) && cj === (N >> 1) && o.room !== 0 && B >= 50) {
      const ry = Math.round(H * 0.3);
      hole(cx - 7, ry, cz - 4, cx + 6, ry + 7, cz + 3);
      box(cx - 3, ry, cz - 1, cx + 2, ry + 1, cz + 1, M.DARK); box(cx - 2, ry + 2, cz - 1, cx + 1, ry + 2, cz + 1, M.BRASS); set(cx - 2, ry + 3, cz, M.LIT_B);
      for (const [a, b] of [[-6, -3], [5, -3], [-6, 2], [5, 2]]) { box(cx + a, ry, cz + b, cx + a, ry + 1 + ((a + b) & 1), cz + b, M.BRASS); }
      box(cx + 3, ry, cz + 2, cx + 4, ry, cz + 3, M.BRASS); set(cx - 7, ry + 5, cz, M.LIT_Y); set(cx + 6, ry + 5, cz - 1, M.LIT_Y);
    }
  }
  if (o.room !== 0 && B >= 50) { const ry = Math.round(H * 0.3); for (let z = z0; z < cz - 4; z++) hole(cx - 1, ry, z, cx, ry + 2, z); }
  return H;
}
export const GREAT = { S: 132, B: 120 }, KHAFRE = { S: 132, B: 112 }, MENK = { S: 110, B: 60 };
export function greatpyramid(lx, lz, L, o = {}) { pyr(lx + 6, lz + 6, GREAT.B, 'Great Pyramid'); }
export function khafre(lx, lz, L, o = {}) { pyr(lx + 10, lz + 10, KHAFRE.B, 'Pyramid of Khafre', { cap: 0.72 }); }
export function menkaure(lx, lz, L, o = {}) {
  pyr(lx + 6, lz + 4, MENK.B, 'Pyramid of Menkaure', { foot: 4 });
  // the three small pyramids of the queens stand in a row to the south, the last of them never finished
  [8, 40, 72].forEach((a, i) => { const H = pyr(lx + a, lz + 76, 24, "Queen's pyramid", { room: 0, kind: 'monument' }); if (i === 2) hole(lx + a, H - 6, lz + 76, lx + a + 23, H, lz + 99); });
}

// ---- the Sphinx: a lion's body with long paws, a man's head in a striped headcloth. It lies along the lot, looking out
// over the front, with the stumps of its temple before it. The rock is banded, as the real one is. -------------------
export const SPHINX = { S: 132 };
export function sphinx(lx, lz, L, o = {}) {
  const cx = lx + 66, zf = lz + 36, rock = (y) => (y % 5 < 2 ? M.SAND : M.SAND2);
  begin('Great Sphinx', 'landmark');
  const slab = (xa, xb, za, zb, ya, yb, m) => { for (let y = ya; y <= yb; y++) box(xa, y, za, xb, y, zb, m || rock(y)); };
  // the paws
  for (const s of [-1, 1]) { const xa = s < 0 ? cx - 10 : cx + 5; slab(xa, xa + 5, zf + 4, zf + 30, 0, 5); slab(xa, xa + 5, zf + 2, zf + 3, 0, 4); slab(xa + 1, xa + 4, zf, zf + 1, 0, 3); for (const a of [1, 3]) hole(xa + a + (s < 0 ? 0 : 1), 3, zf, xa + a + (s < 0 ? 0 : 1), 5, zf + 5); }
  // the chest rises from between them
  for (let k = 0; k < 6; k++) slab(cx - 11, cx + 10, zf + 22 + k * 2, zf + 23 + k * 2, 0, 10 + k * 2);
  // the body, rounded over the back
  for (let y = 0; y <= 19; y++) { const w = y <= 12 ? 11 : y <= 16 ? 10 : y <= 18 ? 8 : 6; box(cx - w, y, zf + 32, cx + w - 1, y, zf + 78, rock(y)); }
  // the haunches and the hind paws
  for (let y = 0; y <= 13; y++) { const w = y <= 9 ? 15 : y <= 11 ? 14 : 13; box(cx - w, y, zf + 58 + (y > 9 ? 2 : 0), cx + w - 1, y, zf + 77, rock(y)); }
  for (const s of [-1, 1]) { const xa = s < 0 ? cx - 16 : cx + 11; slab(xa, xa + 4, zf + 46, zf + 60, 0, 4); slab(xa + 1, xa + 3, zf + 44, zf + 45, 0, 3); }
  // the rump, and the tail laid along one side
  for (let k = 0; k < 4; k++) { const w = 10 - k * 2; for (let y = 0; y <= 17 - k * 3; y++) box(cx - w, y, zf + 79 + k, cx + w - 1, y, zf + 79 + k, rock(y)); }
  for (let z = zf + 62; z <= zf + 83; z++) box(cx + 15, 0, z, cx + 16, 2, z, M.SAND2); box(cx + 12, 0, zf + 82, cx + 16, 2, zf + 83, M.SAND2);
  // the neck and the head
  slab(cx - 6, cx + 5, zf + 22, zf + 33, 20, 26);
  const HC = M.SAND2;
  for (let y = 26; y <= 40; y++) box(cx - 7, y, zf + 19, cx + 6, y, zf + 31, y <= 27 ? rock(y) : HC);
  box(cx - 6, 41, zf + 20, cx + 5, 41, zf + 31, HC);
  // the headcloth: wide behind the face, striped, with a flap down each shoulder
  for (let y = 18; y <= 42; y++) { const w = y >= 40 ? 8 : y >= 34 ? 10 : 11, m = (y >> 1) & 1 ? M.SAND : M.OCHRE; box(cx - w, y, zf + 23, cx + w - 1, y, zf + 33, m); if (y <= 34) { box(cx - w, y, zf + 20, cx - 8, y, zf + 22, m); box(cx + 7, y, zf + 20, cx + w - 1, y, zf + 22, m); } }
  box(cx - 7, 42, zf + 20, cx + 6, 43, zf + 30, M.OCHRE); box(cx - 1, 41, zf + 18, cx, 44, zf + 19, M.OCHRE);
  // the face: brows, eyes, what is left of the nose, the mouth
  const zq = zf + 18;
  box(cx - 5, 29, zq, cx + 4, 39, zq, HC); box(cx - 5, 37, zq - 1, cx - 2, 37, zq - 1, M.OCHRE); box(cx + 1, 37, zq - 1, cx + 4, 37, zq - 1, M.OCHRE);
  box(cx - 4, 35, zq, cx - 2, 36, zq, M.DARK); box(cx + 1, 35, zq, cx + 3, 36, zq, M.DARK); set(cx - 3, 36, zq, M.TRIM); set(cx + 2, 36, zq, M.TRIM);
  box(cx - 1, 32, zq - 1, cx, 35, zq - 1, HC); box(cx - 1, 32, zq - 1, cx, 32, zq - 1, M.OCHRE);
  box(cx - 3, 30, zq, cx + 2, 30, zq, M.OCHRE); box(cx - 2, 28, zq, cx + 1, 28, zq + 1, HC);
  for (const s of [-1, 1]) box(s < 0 ? cx - 8 : cx + 7, 32, zf + 22, s < 0 ? cx - 8 : cx + 7, 36, zf + 24, HC);
  // the stone slab between the paws
  begin('Dream stone', 'monument'); box(cx - 3, 0, zf + 20, cx + 2, 1, zf + 21, M.SAND2); box(cx - 2, 2, zf + 21, cx + 1, 11, zf + 21, M.REND_P); box(cx - 1, 12, zf + 21, cx, 12, zf + 21, M.REND_P);
  // what is left of the temple in front: two rows of square pillars, a few still carrying a beam
  for (let i = 0; i < 14; i++) {
    const a = 14 + (i % 7) * 17, b = i < 7 ? 6 : 20, side = i % 7 < 2 || i % 7 > 4, h = side ? 7 + hsh(i, 3, 7) % 6 : 2 + hsh(i, 3, 7) % 3;
    begin('Temple pillar', 'monument'); box(lx + a, 0, lz + b, lx + a + 3, h, lz + b + 3, hsh(i, 1, 1) < 50 ? M.SAND2 : M.SAND);
  }
  for (const a of [14, 116]) { begin('Temple gate', 'monument'); for (const b of [6, 20]) box(lx + a, 0, lz + b, lx + a + 3, 14, lz + b + 3, M.SAND2); box(lx + a, 15, lz + 6, lx + a + 3, 16, lz + 23, M.SAND); }
  // the low wall of its hollow, and a few onlookers
  begin('Old wall', 'wall', false);
  for (let b = 34; b <= 126; b++) for (const a of [36, 96]) if (hsh(a, b >> 3, 5) < 70) box(lx + a, 0, lz + b, lx + a + 1, 2 + hsh(a, b >> 2, 9) % 3, lz + b, M.SAND2);
  for (let a = 36; a <= 97; a++) if (hsh(a >> 3, 2, 5) < 75) box(lx + a, 0, lz + 126, lx + a, 2 + hsh(a >> 2, 4, 9) % 3, lz + 127, M.SAND2);
  if (L >= 2) { palm(lx + 120, lz + 110, 22); palm(lx + 8, lz + 118, 19); palm(lx + 112, lz + 118, 17); }
}

// ---- the Citadel: a walled fort with round towers on a rise of rock, and inside it a palace round a court, with a
// fountain and a copper clock tower -------------------------------------------------------------------------------
export const CITADEL = { S: 132, P: 12 };
export function citadel(lx, lz, L, o = {}) {
  const S = CITADEL.S, P = CITADEL.P, X = (a) => lx + a, Z = (b) => lz + b, W = M.LIME2;
  begin('The Citadel', 'landmark');
  // the rise: a crust of rock in terraces, with a ramp up to the gate
  const ramp = (a) => a >= 59 && a <= 72;
  const hill = (a, b) => {
    if (a < 0 || a >= S || b < 0 || b >= S) return 0;
    const d = Math.min(a, S - 1 - a, b, S - 1 - b), t = Math.min(P, Math.floor((d + 1) * 1.5 / 3) * 3);
    return ramp(a) && b < 10 ? Math.min(P, Math.floor(b * 1.5) + 1) : t;
  };
  const HA = 38, HB = 60, HS = 55, CA = 40, CB = 24, CW = 51;   // the hall and its court
  const inPalace = (a, b) => (a >= HA - 6 && a <= HA + HS + 6 && b >= HB - 3 && b <= HB + HS) || (a >= CA && a <= CA + CW && b >= CB && b < HB);
  const crust = (mine) => { for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) {
    const h = hill(a, b); if (!h || inPalace(a, b) !== mine) continue;
    const low = Math.min(hill(a - 1, b), hill(a + 1, b), hill(a, b - 1), hill(a, b + 1));
    for (let y = Math.max(0, Math.min(h - 2, low - 1)); y < h; y++) set(X(a), y, Z(b), y === h - 1 ? (ramp(a) && b < 10 ? M.LIME : hsh(a >> 2, b >> 2, 3) < 30 ? M.SAND2 : M.SAND) : hsh(a >> 1, y, b >> 1) < 40 ? M.OCHRE : M.SAND2);
  } };
  crust(false);
  // the curtain wall, with a walk and battlements, down through the rock to the ground
  const A0 = 9, A1 = S - 10, T = P + 16;
  for (let y = 0; y <= T; y++) { const m = y < P ? M.SAND2 : (y - P) % 6 === 5 ? M.LIME : W; walls(X(A0), y, Z(A0), X(A1), y, Z(A1), m); walls(X(A0 + 1), y, Z(A0 + 1), X(A1 - 1), y, Z(A1 - 1), m); }
  for (let t = A0; t <= A1; t++) if ((t - A0) % 4 < 2) for (const q of [A0, A1]) { box(X(t), T + 1, Z(q), X(t), T + 2, Z(q), W); box(X(q), T + 1, Z(t), X(q), T + 2, Z(t), W); }
  // the gate: a pointed arch between two towers
  for (let a = 61; a <= 70; a++) for (let y = P; y <= P + 13; y++) { const k = y - (P + 7), off = Math.abs(a - 65.5); if (k > 0 && off > 5 * (1 - (k / 7) * (k / 7))) continue; hole(X(a), y, Z(A0), X(a), y, Z(A0 + 1)); }
  const drum = (a, b, R, top) => {
    for (let y = 0; y <= top; y++) rdisc(X(a), Z(b), y, R, y < P ? M.SAND2 : (y - P) % 6 === 5 ? M.LIME : W, y === top || y === P ? -1 : R - 2);
    for (let k = 0; k < 16; k++) { const an = k * Math.PI / 8; if (k & 1) { const ex = X(a) + Math.round((R - 0.5) * Math.cos(an)), ez = Z(b) + Math.round((R - 0.5) * Math.sin(an)); box(ex, top + 1, ez, ex, top + 2, ez, W); } }
    if (L >= 1) for (const [dx, dz] of [[R, 0], [-R, 0], [0, R], [0, -R]]) box(X(a) + dx, P + 8, Z(b) + dz, X(a) + dx, P + 11, Z(b) + dz, M.DARK);
  };
  for (const [a, b] of [[A0, A0], [A1, A0], [A0, A1], [A1, A1]]) drum(a, b, 8, T + 8);
  for (const [a, b] of [[A0, 66], [A1, 66], [66, A1], [38, A0], [93, A0]]) drum(a, b, 6, T + 5);
  for (const a of [55, 76]) drum(a, A0, 6, T + 7);

  // ---- the palace: a long two-storey house in cream render with tall shuttered windows, a columned porch, a look-out
  // room on the roof under a green hipped roof, and a square tower at each front corner --------------------------------
  begin('Citadel palace', 'landmark');
  const ca = HA + 28, cb = HB + 28, top = P + 26, G = M.ROOF_G, D = M.REND_C, T2 = M.TRIM;
  crust(true);
  for (let y = 0; y <= top; y++) walls(X(HA), y, Z(HB), X(HA + HS), y, Z(HB + HS), y < P ? M.SAND2 : y === P + 13 ? T2 : D);
  box(X(HA), top, Z(HB), X(HA + HS), top, Z(HB + HS), M.SLAB);
  const HF = faces4(X(HA), Z(HB), X(HA + HS), Z(HB + HS));
  for (const F of HF) {
    for (let u = 4; u + 4 < F.W; u += 8) {
      win(F, u, P + 3, 4, 8, { frame: T2 }); win(F, u, P + 16, 4, 7, { frame: T2 });
      if (L >= 1) { F.box(u - 1, P + 15, u + 4, P + 15, 1, 2, T2); for (let k = u - 1; k <= u + 4; k++) F.p(k, P + 16, 2, M.DARK); for (const k of [u - 1, u + 4]) F.box(k, P + 17, k, P + 22, 1, 1, M.DOOR_G); }
    }
    F.band(top, top, 1, T2); F.band(P, P, 1, T2);
    for (let u = 0; u < F.W; u++) { F.p(u, top + 1, 0, T2); if (u % 3 === 0) F.p(u, top + 2, 0, T2); }
    for (const u of [0, F.W - 1]) for (let y = P; y <= top; y++) if ((y - P) % 4 < 2) F.p(u, y, 1, T2);
  }
  // the porch on the court side: four columns under a balcony, and the great door
  pointed(HF[0], 24, 8, 12, { y0: P, fill: M.TRUNK });
  for (const u of [19, 25, 30, 36]) { HF[0].box(u, P, u, P + 12, 4, 4, T2); HF[0].p(u, P + 12, 3, T2); }
  HF[0].box(18, P + 13, 37, P + 13, 1, 5, T2); for (let u = 18; u <= 37; u++) for (const d of [5]) HF[0].p(u, P + 14, d, u % 2 ? M.DARK : T2);
  for (const u of [18, 37]) for (let d = 1; d <= 5; d++) HF[0].p(u, P + 14, d, M.DARK);
  // the look-out room on the roof, under a hipped roof with a flag
  for (let y = top + 1; y <= top + 9; y++) walls(X(ca - 11), y, Z(cb - 11), X(ca + 11), y, Z(cb + 11), y === top + 9 ? T2 : D);
  { const BF = faces4(X(ca - 11), Z(cb - 11), X(ca + 11), Z(cb + 11)); for (const F of BF) for (let u = 3; u + 2 < F.W; u += 5) F.box(u, top + 3, u + 2, top + 7, 0, 0, M.GLASS); }
  for (let k = 0; k < 7; k++) { const r = 13 - k * 2; if (r < 0) break; for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (k === 6 || Math.max(Math.abs(a), Math.abs(b)) >= r - 2) set(X(ca + a), top + 10 + k, Z(cb + b), k === 0 ? T2 : G); }
  box(X(ca), top + 17, Z(cb), X(ca), top + 26, Z(cb), M.METAL); box(X(ca) + 1, top + 23, Z(cb), X(ca) + 5, top + 26, Z(cb), M.AWN_R); box(X(ca) + 1, top + 24, Z(cb), X(ca) + 5, top + 25, Z(cb), M.AWN_W);
  // a square tower at each front corner, with a roof of its own
  for (const a of [HA - 3, HA + HS + 3]) {
    for (let y = 0; y <= top + 9; y++) walls(X(a - 3), y, Z(HB - 3), X(a + 3), y, Z(HB + 3), y < P ? M.SAND2 : y === P + 13 || y === top || y === top + 9 ? T2 : D);
    for (let y = 0; y <= top + 9; y += 6) box(X(a - 2), y, Z(HB - 2), X(a + 2), y, Z(HB + 2), M.FLOOR);
    box(X(a - 3), top + 9, Z(HB - 3), X(a + 3), top + 9, Z(HB + 3), T2);
    const TF = faces4(X(a - 3), Z(HB - 3), X(a + 3), Z(HB + 3)); for (const F of TF) { F.box(3, P + 5, 3, P + 9, 0, 0, M.GLASS); F.box(3, P + 18, 3, P + 22, 0, 0, M.GLASS); F.box(2, top + 3, 4, top + 6, 0, 0, M.GLASS); }
    for (let k = 0; k < 4; k++) box(X(a - 4 + k), top + 10 + k, Z(HB - 4 + k), X(a + 4 - k), top + 10 + k, Z(HB + 4 - k), k === 0 ? T2 : G);
    box(X(a), top + 14, Z(HB), X(a), top + 16, Z(HB), M.BRASS);
  }
  // the court in front: arcaded walls with a plain coping, an open fountain, the clock tower
  const CD = HB - CB;
  for (let y = 0; y <= P + 13; y++) { const m = y < P ? M.SAND2 : M.LIME; box(X(CA), y, Z(CB), X(CA + CW), y, Z(CB), m); box(X(CA), y, Z(CB), X(CA), y, Z(CB + CD), m); box(X(CA + CW), y, Z(CB), X(CA + CW), y, Z(CB + CD), m); }
  { const Cf = face('f', X(CA), Z(CB), X(CA + CW), Z(CB + CD)), Cl = face('l', X(CA), Z(CB), X(CA + CW), Z(CB + CD)), Cr = face('r', X(CA), Z(CB), X(CA + CW), Z(CB + CD));
    for (const F of [Cf, Cl, Cr]) { for (let u = 3; u + 5 < F.W; u += 8) pointed(F, u, 5, 10, { y0: P }); F.band(P + 13, P + 13, 1, M.TRIM); for (let u = 0; u < F.W; u += 2) F.p(u, P + 14, 0, M.LIME); } }
  begin('Court fountain', 'monument');
  { const fa = X(ca), fb = Z(CB + 20);
    for (let y = 0; y < P; y++) rdisc(fa, fb, y, 2, M.SAND2);
    rdisc(fa, fb, P, 6, M.LIME); rdisc(fa, fb, P + 1, 6, M.LIME, 5); rdisc(fa, fb, P + 1, 5, M.WATER);
    box(fa, P + 1, fb, fa, P + 5, fb, M.LIME); rdisc(fa, fb, P + 6, 2, M.LIME); rdisc(fa, fb, P + 7, 2, M.LIME, 1); rdisc(fa, fb, P + 7, 1, M.WATER); set(fa, P + 8, fb, M.WATER); }
  begin('Clock tower', 'monument');
  { const ta = X(ca), tb = Z(CB - 6);
    for (let y = 0; y <= P + 38; y++) walls(ta - 2, y, tb - 2, ta + 2, y, tb + 2, y < P ? M.SAND2 : y > P + 26 ? M.COPPER2 : (y - P) % 8 === 7 ? M.BRASS : M.COPPER);
    box(ta - 1, 0, tb - 1, ta + 1, P, tb + 1, M.SAND2);
    for (let y = P + 6; y <= P + 38; y += 6) box(ta - 1, y, tb - 1, ta + 1, y, tb + 1, M.COPPER2);
    for (const [dx, dz] of [[0, -3], [0, 3], [-3, 0], [3, 0]]) { box(ta + dx - (dz ? 1 : 0), P + 29, tb + dz - (dx ? 1 : 0), ta + dx + (dz ? 1 : 0), P + 31, tb + dz + (dx ? 1 : 0), M.TRIM); set(ta + dx, P + 30, tb + dz, M.DARK); }
    box(ta - 3, P + 39, tb - 3, ta + 3, P + 39, tb + 3, M.BRASS); box(ta - 2, P + 40, tb - 2, ta + 2, P + 41, tb + 2, M.COPPER); box(ta - 1, P + 42, tb - 1, ta + 1, P + 44, tb + 1, M.COPPER2); box(ta, P + 45, tb, ta, P + 48, tb, M.BRASS); }
  if (L >= 2) for (const [a, b] of [[20, 30], [112, 30], [20, 100], [112, 100], [24, 60], [108, 60]]) palm(X(a), Z(b), P + ri(16, 20));
}

// ---- the Lotus Tower: a core in a round shell of open lattice, opening at the top like a flower under a round deck ----
export function lotustower(lx, lz, L, o = {}) {
  const cx = lx + 20, cz = lz + 20, H = 150, mod = (a, b) => ((a % b) + b) % b;
  begin(o.title || 'Lotus Tower', 'landmark');
  rdisc(cx, cz, 0, 16, M.STONE); rdisc(cx, cz, 1, 15, M.STONE);
  for (let y = 2; y <= 10; y++) for (let dx = -13; dx <= 13; dx++) for (let dz = -13; dz <= 13; dz++) { const d = dx * dx + dz * dz; if (d <= 13.3 * 13.3 && d > 11.3 * 11.3) set(cx + dx, y, cz + dz, y === 10 || mod(Math.round(Math.atan2(dz, dx) * 16 / Math.PI), 4) === 0 ? M.LIME2 : dz < -11 && Math.abs(dx) < 3 && y < 9 ? M.DARK : M.GLASS_Z); }
  rdisc(cx, cz, 11, 14, M.TRIM);
  const R = (y) => (y <= H ? 8 : Math.min(13, 8 + Math.round(5 * Math.pow((y - H) / 20, 1.4))));
  for (let y = 2; y <= H + 31; y++) rdisc(cx, cz, y, 4, y % 10 === 5 ? M.DARK : M.TRIM, 2);   // the core: it gives way when it is bitten through
  for (let y = 12; y <= H + 20; y++) {
    const r = R(y), flare = y > H, ringY = flare ? y === H + 20 || y === H + 1 : y % 20 < 2;
    if (y % 20 === 0 || y === H + 20 || y === H + 10) { rdisc(cx, cz, y, r, M.CONC); continue; }
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const d = dx * dx + dz * dz; if (d > (r + 0.3) * (r + 0.3) || d <= (r - 1.7) * (r - 1.7)) continue;
      const k = Math.round(Math.atan2(dz, dx) * 24 / Math.PI);
      if (ringY) set(cx + dx, y, cz + dz, M.TRIM);
      else if (flare ? mod(k, 6) < 4 : mod(k + y, 8) < 3 || mod(k - y, 8) < 3) set(cx + dx, y, cz + dz, flare && mod(k, 6) === 0 ? M.LIME : M.LIME2);
    }
  }
  // the deck: two floors of glass, a roof, a smaller drum and the mast
  const y0 = H + 21;
  for (let y = y0; y <= y0 + 9; y++) { if (y === y0 + 5) { rdisc(cx, cz, y, 13, M.CONC); continue; } for (let dx = -13; dx <= 13; dx++) for (let dz = -13; dz <= 13; dz++) { const d = dx * dx + dz * dz; if (d <= 13.3 * 13.3 && d > 11.6 * 11.6) set(cx + dx, y, cz + dz, mod(Math.round(Math.atan2(dz, dx) * 16 / Math.PI), 4) === 0 ? M.TRIM : (dx * 5 + dz * 3 + y) % 11 === 0 ? M.LIT : M.GLASS_Z); } }
  rdisc(cx, cz, y0 + 10, 14, M.TRIM); rdisc(cx, cz, y0 + 11, 12, M.LIME2);
  for (let y = y0 + 12; y <= y0 + 18; y++) rdisc(cx, cz, y, 8, y === y0 + 18 ? M.TRIM : M.LIME2, y === y0 + 18 ? -1 : 6);
  box(cx, y0 + 19, cz, cx, y0 + 48, cz, M.STEEL); for (const y of [y0 + 26, y0 + 34]) { box(cx - 2, y, cz, cx + 2, y, cz, M.STEEL); box(cx, y, cz - 2, cx, y, cz + 2, M.STEEL); } set(cx, y0 + 49, cz, M.LIT_R);
  if (L >= 2) { for (const [a, b] of [[3, 3], [36, 3], [3, 36], [36, 36]]) palm(lx + a, lz + b, ri(16, 20)); }
}

// ---- the museum: a long pink front in the classical manner, a great arched door under a dome, a garden with a pool ----
export const MUSEUM = { S: 86 };
export function museum(lx, lz, L, o = {}) {
  const x0 = lx + 3, x1 = lx + 82, z0 = lz + 36, z1 = lz + 80, H = 28, W = M.REND_P, cx = lx + 42;
  begin(o.title || 'Egyptian Museum', 'landmark');
  walls(x0, 0, z0, x1, H, z1, W); box(x0 + 1, 13, z0 + 1, x1 - 1, 13, z1 - 1, M.FLOOR); box(x0, H, z0, x1, H, z1, M.SLAB);
  const [Ff, Fr, Fb, Fl] = faces4(x0, z0, x1, z1);
  for (const F of [Ff, Fr, Fb, Fl]) {
    F.box(0, 0, F.W - 1, 2, 0, 0, M.LIME); if (L >= 1) { F.band(13, 13, 1, M.LIME); F.band(H, H, 1, M.LIME); F.band(H - 1, H - 1, 1, M.TRIM); }
    for (let u = 4; u + 5 < F.W; u += 9) { if (F === Ff && u > 26 && u < 50) continue; pointed(F, u, 5, 8, { y0: 4, fill: M.GLASS }); pointed(F, u, 5, 9, { y0: 16, fill: M.GLASS }); if (L >= 1) F.box(u - 2, 3, u - 2, H - 2, 1, 1, M.LIME); }
  }
  // the centre: a tall block that stands forward, the arch, columns either side, a low dome over the hall behind
  box(cx - 13, 0, z0 - 5, cx + 13, H + 8, z0 + 2, W); hole(cx - 12, 0, z0 - 4, cx + 12, H + 7, z0 + 1);
  box(cx - 13, H + 8, z0 - 5, cx + 13, H + 9, z0 + 2, M.LIME);
  const Pf = face('f', cx - 13, z0 - 5, cx + 13, z0 + 2);
  pointed(Pf, 8, 11, 24, { fill: M.DARK }); door(Pf, 11, 5, 11, M.TRUNK, { frame: M.BRASS, step: false });
  if (L >= 1) { for (const u of [2, 5, 21, 24]) Pf.box(u, 0, u, H + 2, 1, 1, M.TRIM); Pf.box(1, H + 1, 25, H + 7, 1, 1, M.LIME); text(Pf, 'MUSEUM', 2, H + 2, 2, M.BRASS); for (let u = 0; u <= 26; u += 2) Pf.p(u, H + 10, 0, M.LIME); }
  for (let y = H + 1; y <= H + 4; y++) rdisc(cx, z0 + 14, y, 10, y === H + 4 ? M.TRIM : W, 8);
  const dt = dome(cx, z0 + 14, H + 5, 10, M.LIME2, { sq: 0.8 }); box(cx, dt + 1, z0 + 14, cx, dt + 3, z0 + 14, M.BRASS);
  // the roof: a balustrade, and glass over the long galleries
  for (let x = x0; x <= x1; x++) if ((x - x0) % 2 === 0) for (const z of [z0, z1]) if (z === z1 || Math.abs(x - cx) > 13) set(x, H + 1, z, M.TRIM);
  for (let z = z0; z <= z1; z++) if ((z - z0) % 2 === 0) for (const x of [x0, x1]) set(x, H + 1, z, M.TRIM);
  for (const [a, b] of [[x0 + 6, cx - 16], [cx + 16, x1 - 6]]) { walls(a, H + 1, z0 + 14, b, H + 2, z0 + 30, M.TRIM); box(a, H + 3, z0 + 14, b, H + 3, z0 + 30, M.GLASS); }
  // inside: seated kings of stone down the hall, and a golden mask in a glass case
  if (L >= 3) {
    box(x0 + 1, 0, z0 + 1, x1 - 1, 0, z1 - 1, M.SLAB);
    for (let x = x0 + 8; x <= x1 - 8; x += 10) { if (Math.abs(x - cx) < 8) continue; box(x, 1, z1 - 8, x + 3, 2, z1 - 4, M.SAND2); box(x, 3, z1 - 6, x + 3, 6, z1 - 4, M.SAND); box(x, 7, z1 - 6, x + 3, 9, z1 - 5, M.SAND); box(x + 1, 10, z1 - 6, x + 2, 12, z1 - 5, M.SAND2); }
    box(cx - 1, 1, z0 + 20, cx + 1, 3, z0 + 22, M.DARK); box(cx - 1, 4, z0 + 20, cx + 1, 7, z0 + 22, M.GLASS); box(cx, 4, z0 + 21, cx, 6, z0 + 21, M.BRASS); set(cx, 8, z0 + 21, M.LIT_Y);
  }
  // the garden: a long pool with lotus leaves, two sphinxes, a small obelisk, palms
  begin('Museum pool', 'prop', false);
  walls(cx - 12, 0, lz + 10, cx + 12, 1, lz + 20, M.LIME); box(cx - 11, 0, lz + 11, cx + 11, 0, lz + 19, M.WATER);
  for (const [a, b] of [[-8, 13], [-3, 17], [4, 12], [9, 16], [0, 15]]) set(cx + a, 1, lz + b, a & 1 ? M.FLOWER_R : M.LEAF2);
  for (const s of [-1, 1]) { begin('Stone sphinx', 'monument'); const a = cx + s * 20; box(a - 2, 0, lz + 22, a + 2, 2, lz + 31, M.LIME); box(a - 1, 3, lz + 24, a + 1, 5, lz + 31, M.SAND2); box(a - 1, 6, lz + 23, a + 1, 9, lz + 25, M.SAND2); box(a - 1, 3, lz + 22, a + 1, 3, lz + 23, M.SAND2); }
  begin('Garden obelisk', 'monument'); box(lx + 10, 0, lz + 12, lx + 14, 3, lz + 16, M.LIME); box(lx + 11, 4, lz + 13, lx + 13, 22, lz + 15, M.REND_P); box(lx + 12, 23, lz + 14, lx + 12, 25, lz + 14, M.BRASS);
  if (L >= 2) { for (const [a, b] of [[5, 5], [80, 5], [28, 8], [58, 8], [72, 18], [5, 26]]) palm(lx + a, lz + b, ri(18, 24)); lampPost(lx + 30, lz + 3, 18); lampPost(lx + 55, lz + 3, 18); bench(lx + 64, lz + 26); }
}

// ---- the opera house: plain sand-coloured blocks stepping up to the stage tower, a porch of three tall pointed arches,
// a low dome over the foyer -----------------------------------------------------------------------------------------
export const OPERA = { S: 86 };
export function opera(lx, lz, L, o = {}) {
  const W = M.LIME2, cx = lx + 43;
  begin(o.title || 'Opera House', 'landmark');
  walls(lx + 12, 0, lz + 30, lx + 73, 30, lz + 80, W); box(lx + 12, 30, lz + 30, lx + 73, 30, lz + 80, M.SLAB);
  walls(lx + 25, 31, lz + 48, lx + 60, 50, lz + 80, W); box(lx + 25, 50, lz + 48, lx + 60, 50, lz + 80, M.SLAB);
  for (let y = 0; y <= 30; y += 10) { box(lx + 25, y, lz + 48, lx + 25, y, lz + 79, W); box(lx + 60, y, lz + 48, lx + 60, y, lz + 79, W); box(lx + 25, y, lz + 48, lx + 60, y, lz + 48, W); }
  for (const x of [lx + 25, lx + 60]) for (const z of [lz + 48]) box(x, 0, z, x, 30, z, W);
  const Fs = faces4(lx + 12, lz + 30, lx + 73, lz + 80), Ts = faces4(lx + 25, lz + 48, lx + 60, lz + 80);
  for (const F of Fs) { for (let u = 4; u + 2 < F.W; u += 6) { if (F === Fs[0] && u > 14 && u < 46) continue; F.box(u, 6, u + 1, 24, 0, 0, M.DARK); } if (L >= 1) { F.band(30, 30, 1, M.OCHRE); F.band(27, 27, 0, M.OCHRE); } }
  for (const F of Ts) { for (let u = 4; u + 2 < F.W; u += 6) F.box(u, 36, u + 1, 46, 0, 0, M.DARK); if (L >= 1) F.band(50, 50, 1, M.OCHRE); }
  walls(lx + 12, 31, lz + 30, lx + 73, 32, lz + 80, W); walls(lx + 25, 51, lz + 48, lx + 60, 52, lz + 80, W);
  // the porch
  box(lx + 22, 0, lz + 21, lx + 63, 28, lz + 29, W); hole(lx + 23, 0, lz + 22, lx + 62, 26, lz + 29);
  const Pf = face('f', lx + 22, lz + 21, lx + 63, lz + 29);
  for (const u of [3, 16, 29]) pointed(Pf, u, 10, 23);
  if (L >= 1) { Pf.band(28, 28, 1, M.OCHRE); text(Pf, 'OPERA', (42 - textW('OPERA')) >> 1, 30, 0, M.BRASS); }
  box(lx + 31, 29, lz + 21, lx + 54, 35, lz + 21, W);
  for (const u of [8, 21, 34]) door(Fs[0], u + 10, 5, 10, M.TRUNK, { glass: true, frame: M.BRASS, step: false });
  // the domes
  for (let y = 31; y <= 34; y++) rdisc(cx, lz + 39, y, 8, y === 34 ? M.TRIM : W, 6);
  const dt = dome(cx, lz + 39, 35, 8, M.LIME, { sq: 0.9 }); box(cx, dt + 1, lz + 39, cx, dt + 3, lz + 39, M.BRASS);
  for (const a of [18, 68]) { rdisc(lx + a, lz + 36, 31, 4, W); rdisc(lx + a, lz + 36, 32, 4, W, 2); dome(lx + a, lz + 36, 33, 4, M.LIME); }
  // the forecourt
  begin('Opera fountain', 'prop', false);
  rdisc(cx, lz + 10, 0, 7, M.LIME); rdisc(cx, lz + 10, 1, 7, M.LIME, 6); rdisc(cx, lz + 10, 1, 6, M.WATER); box(cx, 1, lz + 10, cx, 6, lz + 10, M.BRASS); rdisc(cx, lz + 10, 7, 2, M.BRASS); set(cx, 8, lz + 10, M.WATER);
  if (L >= 2) { for (const [a, b] of [[6, 6], [80, 6], [6, 30], [80, 30], [22, 10], [64, 10], [5, 60], [81, 60]]) palm(lx + a, lz + b, ri(18, 24)); lampPost(lx + 30, lz + 3, 18); lampPost(lx + 56, lz + 3, 18); bench(lx + 26, lz + 16); bench(lx + 52, lz + 16); }
}
