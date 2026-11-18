// Paris landmarks after the tower: the Arc de Triomphe, Notre-Dame, the Louvre with a glass pyramid in its courtyard,
// and Sacre-Coeur on its hill. Our own voxel designs of public monuments (the pyramid is a plain glass pyramid of ours).
// Each is one body, so every piece is drawn to hold on to the rest face to face and to reach the ground.
import { M, set, put, clr, box, walls, begin } from './world.js';
import { faces4, win, disc, spire, lampPost, bench } from './kit.js';

// ---- the Arc de Triomphe ---------------------------------------------------------------------------------------------
// It stands in the roadway: the street runs along x through the vault, which is 36 wide so a tank and the soldiers
// beside it pass under. 80 across the street, 36 through, 84 tall. The lot is 116 square with the arch at its middle.
export const ARC = { S: 116, HW: 40, HD: 18, OPEN: 18, SPRING: 34, H: 83 };
export function arc(lx, lz, L, o = {}) {
  const cx = lx + 58, cz = lz + 58, { HW, HD, OPEN: RO, SPRING: SP, H } = ARC, T = 3, st = M.LIME, dk = M.LIME2;
  begin(o.title || 'Arc de Triomphe', 'landmark');
  const open = (zc, y, r) => Math.abs(zc) < r && (y < SP || Math.hypot(zc, y - SP) < r);
  for (let y = 0; y <= H; y++) for (let a = -HD; a < HD; a++) for (let b = -HW; b < HW; b++) {
    const zc = b + 0.5;
    if (open(zc, y, RO)) continue;
    const outer = a < -HD + T || a >= HD - T || b < -HW + T || b >= HW - T, lining = open(zc, y, RO + T);
    if (!outer && !lining && !(y >= 54 && y <= 56) && y < 80) continue;
    let m = st;
    const face = a === -HD || a === HD - 1 || b === -HW || b === HW - 1, i = a + b + 200;
    if (lining && open(zc, y, RO + 1) && y >= SP) m = ((a + HD) % 4 < 2) !== (Math.floor(Math.atan2(y - SP, zc) * 7 / Math.PI) % 2 === 0) ? dk : st;   // coffers under the vault
    else if (face && y >= 58 && y <= 60) m = (i + y) & 1 ? dk : st;                       // the frieze
    else if (face && y >= 66 && y <= 73 && i % 5 < 2) m = dk;                             // the shields of the attic
    set(cx + a, y, cz + b, m);
  }
  // mouldings: rings that stand proud of the walls (not across the vault's mouth)
  const ring = (y, d, m, gap) => {
    for (let a = -HD - d; a < HD + d; a++) for (let b = -HW - d; b < HW + d; b++) {
      if (a !== -HD - d && a !== HD - 1 + d && b !== -HW - d && b !== HW - 1 + d) continue;
      if (gap && Math.abs(b + 0.5) < RO) continue;
      put(cx + a, y, cz + b, m);
    }
  };
  for (const y of [0, 1, 2]) ring(y, 1, M.STONE, true);
  for (const y of [33, 34]) ring(y, 1, M.TRIM, true);
  for (const y of [53, 54, 55, 56, 62, 79, 80, 81, 82, 83]) ring(y, 1, M.TRIM);
  for (const y of [55, 56, 82, 83]) ring(y, 2, M.TRIM);
  if (L >= 1) {
    // the four sculpture groups on the piers, a relief panel over each, and the keystones
    for (const sx of [-1, 1]) for (const sb of [-1, 1]) {
      const fx = (d) => cx + (sx < 0 ? -HD - d : HD - 1 + d), mid = sb * 29.5;
      for (let y = 3; y <= 30; y++) {
        const hw = y < 6 ? 8 : y < 16 ? 6 : y < 24 ? 5 : y < 28 ? 3 : 2;
        for (let b = Math.ceil(mid - hw); b < mid + hw; b++) { put(fx(1), y, cz + b, y < 6 ? M.STONE : dk); if (y < 24 && Math.abs(b + 0.5 - mid) < hw - 1.5) put(fx(2), y, cz + b, y < 6 ? M.STONE : dk); }
      }
      for (let y = 37; y <= 48; y++) for (let b = Math.ceil(mid - 7); b < mid + 7; b++) put(fx(1), y, cz + b, y === 37 || y === 48 || Math.abs(b + 0.5 - mid) > 6 ? M.TRIM : (b + y) & 1 ? dk : st);
    }
    for (const sx of [-1, 1]) for (let y = 50; y <= 53; y++) for (const b of [-2, -1, 0, 1]) put(cx + (sx < 0 ? -HD - 1 : HD), y, cz + b, M.TRIM);
    // a blind arch in each end wall
    for (const sb of [-1, 1]) for (let y = 3; y <= 27; y++) for (let a = -6; a < 6; a++) {
      if (y >= 21 && Math.hypot(a + 0.5, y - 21) >= 6) continue;
      const z0 = cz + (sb < 0 ? -HW : HW - 1), z1 = z0 - sb, z2 = z1 - sb;
      clr(cx + a, y, z0); clr(cx + a, y, z1); set(cx + a, y, z2, dk);
    }
    // the terrace rail
    for (let a = -HD; a < HD; a++) for (let b = -HW; b < HW; b++) if (a === -HD || a === HD - 1 || b === -HW || b === HW - 1) { set(cx + a, H + 1, cz + b, M.TRIM); if ((a + b) & 1) set(cx + a, H + 2, cz + b, M.TRIM); }
  }
  if (L >= 2) for (const [a, b] of [[-28, -50], [27, -50], [-28, 49], [27, 49]]) lampPost(cx + a, cz + b, 22);
}

// ---- Notre-Dame -------------------------------------------------------------------------------------------------------
// The west front is toward low z: two towers, three portals, the gallery of kings, the rose and the open gallery. Behind
// it the nave with its aisles and flying buttresses, the transept with a rose at each end, the spire over the crossing
// and the round apse. 56 across (a) and 124 long (b); it is drawn one side and mirrored about the long axis.
export const NOTRE_DAME = { W: 56, D: 124 };
export function notredame(lx, lz, L, o = {}) {
  begin(o.title || 'Notre-Dame', 'landmark');
  const st = M.LIME, st2 = M.LIME2, lead = M.ROOF_S;
  const S = (a, y, b, m) => { set(lx + a, y, lz + b, m); set(lx + 55 - a, y, lz + b, m); };
  const P = (a, y, b, m) => { put(lx + a, y, lz + b, m); put(lx + 55 - a, y, lz + b, m); };
  const C = (a, y, b) => { clr(lx + a, y, lz + b); clr(lx + 55 - a, y, lz + b); };
  const B = (a0, y0, b0, a1, y1, b1, m) => { for (let y = y0; y <= y1; y++) for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) S(a, y, b, m); };
  const glass = (y, t) => { const k = (y * 3 + t * 5) % 7; return k === 0 ? M.STAIN_R : k === 3 ? M.STAIN_Y : M.STAIN_B; };   // mostly blue, flecked with red and gold
  const N0 = 18, N1 = 97, AW = 26, NW = 52;   // the nave runs from b 18 to 97; aisle and nave wall heights
  // aisles and nave: walls, then the lean-to and the steep lead roofs
  B(6, 0, N0, 7, AW, N1, st); B(20, 0, N0, 21, NW, N1, st);
  for (let b = N0; b <= N1; b++) {
    for (let a = 6; a <= 19; a++) { const y = AW + 1 + ((a - 6) >> 1); S(a, y, b, lead); S(a, y - 1, b, a < 8 ? st : lead); }
    for (let a = 20; a <= 27; a++) { const y = NW + 1 + Math.floor((a - 20) * 1.5); for (let k = 0; k < 3; k++) S(a, y - k, b, k === 2 && a < 22 ? st : lead); }
  }
  for (let a = 20; a <= 27; a++) for (let y = NW; y <= NW + Math.floor((a - 20) * 1.5); y++) { S(a, y, N0, st); S(a, y, N0 + 1, st); }
  // the transept: an arm each side, as tall as the nave, with a gable and a rose at its end
  const T0 = 56, T1 = 67;
  B(4, 0, T0, 5, NW, T1, st);
  for (const b of [T0, T0 + 1, T1 - 1, T1]) B(4, 0, b, 19, NW, b, st);
  for (let k = 0; k < 6; k++) {
    const y = NW + 1 + Math.floor(k * 1.5);
    for (const b of [T0 + k, T1 - k]) { for (let a = 4; a <= 27; a++) for (let j = 0; j < 3; j++) S(a, y - j, b, lead); for (let yy = NW; yy <= y; yy++) { S(4, yy, b, st); S(5, yy, b, st); } }
  }
  if (L >= 1) for (let y = 31; y <= 45; y++) for (let b = T0 + 1; b <= T1 - 1; b++) {
    const r = Math.hypot(b - 61.5, y - 38);
    if (r >= 5.6) continue;
    S(5, y, b, glass(y, b)); if (r < 4.4 && Math.abs(b - 61.5) > 0.6 && Math.abs(y - 38) > 0.6) C(4, y, b); else S(4, y, b, M.TRIM);
  }
  for (let y = 0; y <= 13; y++) for (let b = 59; b <= 64; b++) { if (y > 10 + Math.min(b - 59, 64 - b) * 1.5) continue; C(4, y, b); S(5, y, b, M.WOOD); }
  // the apse: a low ambulatory round a tall choir, both half round, with stained glass between the buttresses
  for (let b = N1 + 1; b <= N1 + 23; b++) for (let a = 0; a <= 55; a++) {
    const ac = a - 27.5, bc = b - N1 - 0.5, r = Math.hypot(ac, bc);
    if (r >= 22) continue;
    const ang = Math.atan2(bc, ac) * 180 / Math.PI, lit = (w) => L >= 1 && [36, 72, 108, 144].some((t) => Math.abs(ang - t) < w);
    if (r >= 20) for (let y = 0; y <= AW; y++) set(lx + a, y, lz + b, y >= 6 && y <= 19 && lit(4.5) ? glass(y, a + b) : st);
    if (r >= 8) { const y = AW + 1 + Math.floor((22 - r) / 2); set(lx + a, y, lz + b, lead); set(lx + a, y - 1, lz + b, lead); }
    if (r >= 6 && r < 8) for (let y = 0; y <= NW; y++) set(lx + a, y, lz + b, y >= 35 && y <= 48 && lit(10) ? glass(y, a + b) : st);
    if (r < 8) { const y = NW + 1 + Math.floor((8 - r) * 1.5); for (let k = 0; k < 3; k++) set(lx + a, y - k, lz + b, lead); }
  }
  // flying buttresses: a pier against the aisle with a pinnacle, and an arm up over the aisle roof to the nave wall
  const BAYS = [24, 34, 44, 72, 82, 92];
  for (const b0 of BAYS) for (const b of [b0, b0 + 1]) {
    B(3, 0, b, 5, 38, b, st); S(4, 39, b, st);
    for (let a = 5; a <= 19; a++) { const y = 36 + Math.round((a - 5) * 11 / 14); S(a, y, b, st); S(a, y + 1, b, st); }
  }
  for (const b0 of BAYS) for (let y = 40; y <= 44; y++) S(4, y, b0, y === 44 ? lead : st);
  for (const deg of [18, 54, 90, 126, 162]) {
    const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180), at = (r) => [Math.floor(27.5 + r * c), Math.floor(N1 + 0.5 + r * s)];
    for (let r = 22.5; r <= 25; r += 0.5) { const [a, b] = at(r); for (let y = 0; y <= 38; y++) { set(lx + a, y, lz + b, st); set(lx + a + 1, y, lz + b, st); set(lx + a, y, lz + b + 1, st); } }
    let [pa, pb] = at(24);
    for (let r = 24; r >= 7.5; r -= 0.5) {
      const [a, b] = at(r), y = 36 + Math.round((24 - r) * 11 / 16);
      for (const [qa, qb] of a !== pa && b !== pb ? [[a, pb], [a, b]] : [[a, b]]) { set(lx + qa, y, lz + qb, st); set(lx + qa, y + 1, lz + qb, st); }
      pa = a; pb = b;
    }
  }
  // windows down both sides: tall lancets in the aisles and the clerestory, and an arcade from the nave into each aisle
  if (L >= 1) for (const b0 of [28, 38, 48, 76, 86]) {
    for (let t = 0; t < 3; t++) for (let k = 0; k <= 14; k++) {
      if (k === 14 && t !== 1) continue;
      C(6, 6 + k, b0 + t); S(7, 6 + k, b0 + t, glass(k, b0 + t));
      C(20, 35 + k, b0 + t); S(21, 35 + k, b0 + t, glass(k, b0));
    }
    for (let t = -1; t <= 3; t++) for (let y = 1; y <= 16 - Math.abs(t - 1) * 2; y++) { C(20, y, b0 + t); C(21, y, b0 + t); }
  }
  // the west front: the two towers, hollow, with their floors
  B(6, 0, 2, 21, 76, 3, st); B(6, 0, 16, 21, 76, 17, st); B(6, 0, 2, 7, 76, 17, st); B(20, 0, 2, 21, 76, 17, st);
  for (const y of [22, 46, 56, 76]) B(8, y, 4, 19, y, 15, st2);
  B(22, 0, 2, 27, 55, 3, st); B(22, 55, 4, 27, 56, 17, st2);
  for (let t = 0; t < 16; t++) for (const [a, b] of [[6 + t, 2], [6 + t, 17], [6, 2 + t], [21, 2 + t]]) { S(a, 77, b, st); if (t & 1) S(a, 78, b, st); }
  if (L >= 1) {
    // belfry openings with louvres, on all four sides of each tower
    for (const t0 of [3, 10]) for (let t = t0; t < t0 + 3; t++) for (let y = 58; y <= 73; y++) {
      if (y === 73 && t !== t0 + 1) continue;
      const slat = y % 3 === 0 ? M.DARK : 0;
      for (const [a0, b0, a1, b1] of [[6 + t, 2, 6 + t, 3], [6 + t, 17, 6 + t, 16], [6, 2 + t, 7, 2 + t], [21, 2 + t, 20, 2 + t]]) { C(a0, y, b0); if (slat) S(a1, y, b1, slat); else C(a1, y, b1); }
    }
    // the four tall buttresses that divide the front, the gallery of kings and the open gallery under the towers
    for (const a of [6, 7, 20, 21]) for (let y = 0; y <= 76; y++) { P(a, y, 1, st); if (y < 47) P(a, y, 0, st); }
    for (let a = 8; a <= 27; a++) {
      if (a === 20 || a === 21) continue;
      P(a, 23, 1, M.TRIM); P(a, 27, 1, M.TRIM); for (let y = 24; y <= 26; y++) S(a, y, 2, a & 1 ? M.STONE : st2);
      P(a, 47, 1, M.TRIM); P(a, 55, 1, M.TRIM);
      if (a & 1) for (let y = 48; y <= 54; y++) P(a, y, 1, M.TRIM); else for (let y = 49; y <= 53; y++) { C(a, y, 2); S(a, y, 3, M.DARK); }
    }
    // the west rose, and a pair of lancets in each tower beside it
    for (let y = 29; y <= 45; y++) for (let a = 20; a <= 27; a++) {
      const r = Math.hypot(a - 27.5, y - 37);
      if (r >= 7.6 || a < 22) continue;
      S(a, y, 3, glass(y, a)); if (r < 6.4 && Math.abs(a - 27.5) > 1 && Math.abs(y - 37) > 0.6 && Math.abs(Math.abs(a - 27.5) - Math.abs(y - 37)) > 0.8) C(a, y, 2); else S(a, y, 2, M.TRIM);
    }
    for (const a0 of [10, 15]) for (let k = 0; k <= 13; k++) for (const a of [a0, a0 + 1]) { C(a, 31 + k, 2); S(a, 31 + k, 3, glass(k, a0)); }
    // three portals: wooden doors under pointed arches
    const portal = (a0, a1, h, mid) => {
      const top = (a) => h + (mid ? a - a0 : Math.min(a - a0, a1 - a)) * 1.5, isOpen = (a, y) => a >= a0 && a <= a1 && y <= top(a);
      for (let a = a0 - 1; a <= a1 + (mid ? 0 : 1); a++) for (let y = 0; y <= top(Math.min(a1, Math.max(a0, a))) + 1; y++) {
        if (isOpen(a, y)) { C(a, y, 2); S(a, y, 3, y < h - 1 ? M.WOOD : st2); }
        else if (isOpen(a + 1, y) || isOpen(a - 1, y) || isOpen(a, y - 1)) P(a, y, 1, M.TRIM);
      }
    };
    portal(24, 27, 12, true); portal(11, 16, 9, false);
  }
  // the spire over the crossing, in lead, with the rooster at its tip
  box(lx + 26, 58, lz + 60, lx + 29, 76, lz + 63, M.ROOF_D); box(lx + 25, 70, lz + 59, lx + 30, 71, lz + 64, lead);
  box(lx + 27, 77, lz + 61, lx + 28, 98, lz + 62, M.ROOF_D); box(lx + 27, 99, lz + 61, lx + 27, 104, lz + 61, M.ROOF_D); set(lx + 27, 105, lz + 61, M.BRASS);
  if (L >= 2) { lampPost(lx + 8, lz - 8, 20); lampPost(lx + 46, lz - 8, 20); bench(lx + 18, lz - 10); bench(lx + 34, lz - 10); }
}

// ---- the Louvre -------------------------------------------------------------------------------------------------------
// A palace on three sides of a courtyard that opens to the front, with a taller pavilion at each corner and one in the
// middle of the back wing, and a glass pyramid in the courtyard. The lot is 86 square.
function wing(x0, z0, x1, z1, h, R, roofM) {
  const wall = M.LIME;
  walls(x0, 0, z0, x1, h, z1, wall);
  for (let y = 13; y < h - 6; y += 12) box(x0 + 1, y, z0 + 1, x1 - 1, y, z1 - 1, M.CONC);
  box(x0, h, z0, x1, h, z1, M.SLAB);
  for (const F of faces4(x0, z0, x1, z1)) {
    F.box(0, 0, F.W - 1, 1, 1, 1, M.STONE); F.box(0, 13, F.W - 1, 13, 1, 1, M.TRIM); F.box(0, h - 1, F.W - 1, h, 1, 1, M.TRIM); F.box(0, h, F.W - 1, h, 2, 2, M.TRIM);
    const n = Math.floor((F.W - 3) / 7), u0 = (F.W - (n * 7 - 3)) >> 1;
    for (let i = 0; i < n; i++) {
      const u = u0 + i * 7;
      win(F, u, 2, 4, 8, { sill: false }); F.p(u + 1, 11, 1, M.TRIM); F.p(u + 2, 11, 1, M.TRIM);   // the arcade of the ground floor
      win(F, u, 16, 4, 7, { lintel: M.TRIM });
      for (let y = 27; y + 4 < h - 1; y += 12) win(F, u, y, 4, 4);
      if (i) for (let y = 2; y <= h - 2; y++) F.q(u - 2, y, 1, M.LIME2);                           // pilasters between the bays
    }
  }
  for (let k = 0; k < R; k++) for (const j of [k, k + 1]) walls(x0 + j, h + 1 + 2 * k, z0 + j, x1 - j, h + 2 + 2 * k, z1 - j, roofM);
  box(x0 + R, h + 2 * R + 1, z0 + R, x1 - R, h + 2 * R + 1, z1 - R, M.ZINC);
}
function pyramid(px, pz, half, rise) {
  for (let k = 0; k < half; k++) {
    const h = half - k, y0 = Math.floor(k * rise), y1 = Math.floor((k + 1) * rise);
    for (let i = -h; i < h; i++) for (let j = -h; j < h; j++) {
      const ei = i === -h || i === h - 1, ej = j === -h || j === h - 1;
      if (!ei && !ej) continue;
      const t = ei ? j : i;
      for (let y = y0; y <= y1; y++) set(px + i, y, pz + j, (ei && ej) || (((t + y) % 5 + 5) % 5 === 0) || (((t - y) % 5 + 5) % 5 === 0) ? M.STEEL : M.GLASS);
    }
  }
}
export function louvre(lx, lz, L, o = {}) {
  begin(o.title || 'The Louvre', 'landmark');
  const X = (a) => lx + a, Z = (b) => lz + b, roof = M.ROOF_S;
  wing(X(1), Z(18), X(17), Z(68), 36, 4, roof); wing(X(68), Z(18), X(84), Z(68), 36, 4, roof); wing(X(14), Z(67), X(71), Z(84), 36, 4, roof);
  for (const [a0, b0, a1, b1, h, R] of [[0, 3, 19, 22, 42, 6], [66, 3, 85, 22, 42, 6], [0, 64, 21, 85, 42, 6], [64, 64, 85, 85, 42, 6], [33, 62, 52, 85, 46, 8]]) wing(X(a0), Z(b0), X(a1), Z(b1), h, R, roof);
  // the clock on the middle pavilion, and a crest along each tall roof
  for (let y = 37; y <= 43; y++) for (let a = 39; a <= 46; a++) if (Math.hypot(a - 42.5, y - 40) < 3.6) set(X(a), y, Z(61), Math.hypot(a - 42.5, y - 40) < 2.6 ? M.LIT_W : M.BRASS);
  for (let a = 41; a <= 44; a++) set(X(a), 46 + 17, Z(73), M.BRASS);
  // the glass pyramid in the courtyard, with a small one each side
  begin('Glass pyramid', 'monument'); pyramid(X(43), Z(36), 13, 1.3);
  for (const a of [24, 62]) { begin('Small glass pyramid', 'prop'); pyramid(X(a), Z(36), 4, 1.3); }
  if (L >= 2) for (const [a, b] of [[24, 10], [62, 10], [26, 58], [60, 58]]) lampPost(X(a), Z(b), 20);
}

// ---- Sacre-Coeur ------------------------------------------------------------------------------------------------------
// The white church on its hill. The hill is voxels (a crust of turf over stone retaining walls, stepped in terraces), with
// the long stair up the middle of the front and a funicular beside it. The church has a tall egg-shaped dome on a drum,
// a small dome at each corner, a porch of three arches and the bell tower behind. The lot is 86 square.
export const BUTTE = 16;
export function sacrecoeur(lx, lz, L, o = {}) {
  begin(o.title || 'Sacre-Coeur', 'landmark');
  const W = M.TRIM, W2 = M.SLAB, Y0 = BUTTE, X = (a) => lx + a, Z = (b) => lz + b;
  const stair = (a) => a >= 34 && a <= 51, rail = (a) => a >= 62 && a <= 65;
  const hill = (a, b) => {
    if (a < 1 || a > 84 || b < 2 || b > 84) return 0;
    const t4 = (v) => Math.floor(v / 4) * 4, front = b >= 30 ? Y0 : (b - 2) * Y0 / 28;
    return Math.max(0, Math.min(Y0, t4(Math.min(a - 1, 84 - a) * 2 + 4), t4((84 - b) * 2 + 4), stair(a) || rail(a) ? Math.floor(front) + 1 : t4(front) + 4));
  };
  for (let a = 1; a <= 84; a++) for (let b = 2; b <= 84; b++) {
    const h = hill(a, b); if (!h) continue;
    const low = Math.min(hill(a - 1, b), hill(a + 1, b), hill(a, b - 1), hill(a, b + 1));
    for (let y = Math.max(0, Math.min(h - 2, low)); y < h; y++) {
      const topm = stair(a) ? (b & 1 ? W2 : M.STONE) : rail(a) ? (a === 62 || a === 65 ? M.METAL : b & 1 ? M.DARK : M.STONE) : h === Y0 && b >= 30 && a > 12 && a < 73 ? W2 : (a * 7 + b * 13) % 11 < 2 ? M.LEAF : M.LEAF2;
      set(X(a), y, Z(b), y === h - 1 ? topm : y >= low ? M.STONE : M.DIRT);
    }
  }
  for (let b = 2; b <= 30; b++) for (const a of [33, 52]) { const h = Math.max(hill(a, b), hill(a === 33 ? 34 : 51, b)); for (let y = 0; y <= h + 1; y++) set(X(a), y, Z(b), M.STONE); }
  // the funicular's cabin, part way up
  for (let a = 62; a <= 65; a++) for (let b = 14; b <= 20; b++) for (let y = hill(a, b); y <= 16; y++) set(X(a), y, Z(b), y < 11 ? M.CAR_B : y < 14 && b > 14 && b < 20 ? M.GLASS : y === 16 ? M.TRIM : M.CAR_B);
  // the church: its walls go down through the hill to the ground
  const x0 = X(20), x1 = X(65), z0 = Z(40), z1 = Z(79), top = Y0 + 34;
  walls(x0, 0, z0, x1, top, z1, W); walls(x0 + 1, 0, z0 + 1, x1 - 1, Y0 - 1, z1 - 1, M.STONE);
  box(x0, top, z0, x1, top + 1, z1, W2);
  const F4 = faces4(x0, z0, x1, z1);
  for (const F of F4) {
    for (const y of [Y0, Y0 + 22, top - 1, top]) F.box(0, y, F.W - 1, y, 1, 1, W2);
    F.box(0, top + 1, F.W - 1, top + 1, 1, 2, W2);
    if (L >= 1) for (let u = 5; u + 3 <= F.W - 5; u += 8) {
      if (F === F4[0] && u > 8 && u < F.W - 12) continue;   // the porch covers the middle of the front
      win(F, u, Y0 + 6, 3, 12, { glass: M.STAIN_B, frame: W2 }); F.p(u + 1, Y0 + 19, 0, M.STAIN_Y);
      win(F, u, Y0 + 25, 3, 4, { glass: M.STAIN_R, frame: W2, sill: false });
    }
  }
  // the porch: three round arches, a pediment, and a bronze horseman at each end of its roof
  const pz0 = Z(34), ph = Y0 + 22;
  walls(X(26), Y0, pz0, X(59), ph, Z(40), W); box(X(26), ph, pz0, X(59), ph + 1, Z(40), W2);
  walls(X(27), 0, pz0 + 1, X(58), Y0 - 1, Z(39), M.STONE);
  for (const c of [32, 42.5, 53]) for (let a = Math.ceil(c - 3.5); a < c + 3.5; a++) for (let y = Y0; y <= Y0 + 15; y++) {
    if (y >= Y0 + 12 && Math.hypot(a + 0.5 - c - 0.5, y - Y0 - 12) >= 3.6) continue;
    clr(a + lx, y, pz0);
  }
  for (let k = 0; k <= 8; k++) for (let a = 34 + k; a <= 51 - k; a++) { set(X(a), ph + 2 + k, pz0, W); set(X(a), ph + 2 + k, pz0 + 1, W); }
  for (const a of [27, 55]) { box(X(a), ph + 2, pz0 + 1, X(a + 3), ph + 3, pz0 + 3, W2); box(X(a), ph + 4, pz0 + 2, X(a + 3), ph + 6, pz0 + 2, M.ROOF_G); box(X(a + 1), ph + 7, pz0 + 2, X(a + 1), ph + 9, pz0 + 2, M.ROOF_G); set(X(a + 3), ph + 7, pz0 + 2, M.ROOF_G); }
  // the great dome: a drum with a ring of arched windows, the tall dome, a lantern and the cross
  const cx = X(43), cz = Z(60), DR = 12, d0 = top + 2, d1 = d0 + 24, DH = 24;
  for (let y = d0; y <= d1; y++) {
    for (let a = -DR; a < DR; a++) for (let b = -DR; b < DR; b++) {
      const r = Math.hypot(a + 0.5, b + 0.5); if (r > DR || r < DR - 2) continue;
      const slot = Math.floor((Math.atan2(b + 0.5, a + 0.5) + Math.PI) * 24 / Math.PI);
      set(cx + a, y, cz + b, L >= 1 && y >= d0 + 6 && y <= d0 + 18 && slot % 3 === 1 ? (r > DR - 1 ? M.DARK : M.STAIN_Y) : y === d0 + 3 || y >= d1 - 1 ? W2 : W);
    }
  }
  const rad = (y) => DR * Math.sqrt(Math.max(0, 1 - ((y - d1) / DH) * ((y - d1) / DH)));
  let ly = d1 + 1;
  for (; rad(ly) > 3.6; ly++) disc(cx, cz, ly, Math.round(rad(ly)), W, Math.max(0, Math.round(rad(ly + 1)) - 1.6));
  for (let y = ly; y <= ly + 10; y++) for (let a = -3; a < 3; a++) for (let b = -3; b < 3; b++) {
    const r = Math.hypot(a + 0.5, b + 0.5); if (r > 3.6) continue;
    if (y === ly || y >= ly + 9 || (r > 2.2 && ((a + b + 20) % 3 !== 0 || y < ly + 2))) set(cx + a, y, cz + b, W);
  }
  disc(cx, cz, ly + 11, 3, W); disc(cx, cz, ly + 12, 2, W); disc(cx, cz, ly + 13, 1, W);
  box(cx - 1, ly + 14, cz - 1, cx - 1, ly + 20, cz - 1, W2); box(cx - 2, ly + 18, cz - 1, cx, ly + 18, cz - 1, W2);
  // a small dome at each corner
  for (const [a, b] of [[26, 46], [60, 46], [26, 74], [60, 74]]) {
    const sx = X(a), sz = Z(b);
    for (let y = top + 2; y <= top + 9; y++) disc(sx, sz, y, 5, y === top + 5 || y === top + 6 ? W2 : W, 3);
    for (let k = 0; k <= 8; k++) { const r = 5 * Math.sqrt(1 - (k / 9) * (k / 9)), rn = 5 * Math.sqrt(Math.max(0, 1 - ((k + 1) / 9) * ((k + 1) / 9))); disc(sx, sz, top + 10 + k, Math.max(1, Math.round(r)), W, Math.max(0, Math.round(rn) - 1.6)); }
    box(sx - 1, top + 19, sz - 1, sx - 1, top + 22, sz - 1, W2);
  }
  // the bell tower behind
  const tx0 = X(37), tx1 = X(48), tz0 = Z(74), tz1 = Z(85), th = Y0 + 78;
  walls(tx0, 0, tz0, tx1, th, tz1, W); walls(tx0 + 1, 0, tz0 + 1, tx1 - 1, th, tz1 - 1, W);
  for (const y of [top, th - 16, th]) box(tx0 + 2, y, tz0 + 2, tx1 - 2, y, tz1 - 2, W2);
  for (const F of faces4(tx0, tz0, tx1, tz1)) {
    for (const y of [th - 18, th - 1, th]) F.box(0, y, F.W - 1, y, 1, 1, W2);
    if (L >= 1) for (const u of [2, 7]) for (let y = th - 14; y <= th - 4; y++) for (const uu of [u, u + 1, u + 2]) { if (y === th - 4 && uu !== u + 1) continue; F.c(uu, y, 0); if (y % 3 === 0) F.p(uu, y, -1, M.DARK); else F.c(uu, y, -1); }
  }
  const st = spire(tx0, tz0, tx1, tz1, th + 1, W, 3);
  box(tx0 + 5, st, tz0 + 5, tx0 + 6, st + 4, tz0 + 6, W2);
  if (L >= 2) { lampPost(X(30), Z(0), 20); lampPost(X(55), Z(0), 20); }
}
