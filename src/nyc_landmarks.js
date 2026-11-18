// New York's set pieces: the Statue of Liberty on her star fort, the ballpark in the Bronx, and the two spire towers of
// midtown. The statue is hers; the ballpark and the towers are our own takes on the kind, under our own names.
// Drawn like the other kits: round a local origin with the front toward low z, turned by place().
import { M, set, box, walls, begin } from './world.js';
import { face, faces4, door, disc, text, textW, tree, lampPost, bench } from './kit.js';

// ---- the Statue of Liberty -------------------------------------------------------------------------------------------
// An eleven-pointed star fort, a stepped granite pedestal with a stone core right up the middle, and the copper figure:
// robe, raised right arm with the gilded torch, the tablet in the crook of her left, and the crown of seven rays.
// She faces the front of her lot. One body, so a bite out of the pedestal brings her down.
export const LIBERTY = { S: 80, PED: 70, TOP: 176 };
export function liberty(lx, lz, L, o = {}) {
  const cx = lx + 40, cz = lz + 40, Y = LIBERTY.PED;
  begin('Statue of Liberty', 'landmark');
  for (let dz = -34; dz < 34; dz++) for (let dx = -34; dx < 34; dx++) {
    const px = dx + 0.5, pz = dz + 0.5, r = Math.hypot(px, pz), t = ((Math.atan2(pz, px) / (2 * Math.PI) + 1.25) * 11) % 1, R = 21 + 11 * Math.abs(1 - 2 * t);
    if (r > R) continue;
    if (r > R - 2.2) { for (let y = 0; y <= 11; y++) set(cx + dx, y, cz + dz, y === 11 ? M.TRIM : y > 8 ? M.GRANITE : M.STONE); } else set(cx + dx, 10, cz + dz, M.SLAB);
  }
  box(cx - 3, 0, cz - 3, cx + 2, Y - 1, cz + 2, M.GRANITE);   // the core
  const tier = (y0, y1, h, m) => { walls(cx - h, y0, cz - h, cx + h - 1, y1, cz + h - 1, m); box(cx - h, y1, cz - h, cx + h - 1, y1, cz + h - 1, m); };
  tier(11, 24, 16, M.GRANITE); tier(25, 27, 17, M.TRIM); tier(28, 58, 12, M.GRANITE); tier(59, 61, 14, M.TRIM); tier(62, 69, 10, M.GRANITE);
  walls(cx - 14, 62, cz - 14, cx + 13, 62, cz + 13, M.GRANITE);
  if (L >= 1) {
    for (const F of faces4(cx - 12, cz - 12, cx + 11, cz + 11)) {
      for (let u = 3; u <= 20; u++) { if ((u % 4) === 1 || (u % 4) === 2) F.box(u, 38, u, 50, 0, 0, M.DARK); if (u % 3 === 0) F.p(u, 32, 0, M.BRASS); }
      F.band(53, 53, 1, M.TRIM); F.band(34, 34, 1, M.TRIM);
    }
    for (const F of faces4(cx - 16, cz - 16, cx + 15, cz + 15)) for (let u = 4; u <= 27; u += 4) F.box(u, 15, u + 1, 20, 0, 0, M.DARK);
    const Ff = face('f', cx - 16, cz - 16, cx + 15, cz + 15); Ff.box(13, 11, 18, 21, 0, 0, M.DARK); Ff.box(12, 11, 12, 22, 1, 1, M.TRIM); Ff.box(19, 11, 19, 22, 1, 1, M.TRIM); Ff.box(12, 22, 19, 22, 1, 1, M.TRIM);
  }
  // the figure, layer by layer. el() fills one ellipse; the folds of the robe are a darker stripe every third turn
  const fold = (dx, dz) => (Math.floor((Math.atan2(dz + 0.5, dx + 0.5) + Math.PI) * 16 / Math.PI) % 3 === 0 ? M.COPPER2 : M.COPPER);
  const el = (h, rx, rz, m, ox = 0, oz = 0) => { for (let dz = Math.floor(oz - rz) - 1; dz <= oz + rz + 1; dz++) for (let dx = Math.floor(ox - rx) - 1; dx <= ox + rx + 1; dx++) { const a = (dx + 0.5 - ox) / rx, b = (dz + 0.5 - oz) / rz; if (a * a + b * b <= 1) set(cx + dx, Y + h, cz + dz, typeof m === 'function' ? m(dx, dz) : m); } };
  for (let h = 0; h <= 3; h++) el(h, 9.6, 9, M.COPPER2);
  for (let h = 4; h <= 44; h++) { const k = (h - 4) / 40; el(h, 9.5 - 2 * k, 8 - 1.5 * k, fold); }
  for (let h = 45; h <= 58; h++) { const k = h <= 54 ? (h - 45) / 9 : 1 - (h - 54) / 4 * 0.45; el(h, 7.5 + k, 6.5 - (h > 54 ? (h - 54) * 0.4 : 0), h > 52 ? M.COPPER : fold); }
  for (let h = 59; h <= 62; h++) el(h, 2.8, 2.8, M.COPPER);
  for (let h = 63; h <= 73; h++) { const r = 4.5 * Math.sqrt(Math.max(0.05, 1 - ((h - 68) / 5.6) ** 2)); el(h, r, r, M.COPPER); }
  set(cx - 2, Y + 69, cz - 4, M.DARK); set(cx + 1, Y + 69, cz - 4, M.DARK); set(cx - 1, Y + 67, cz - 5, M.COPPER2); set(cx, Y + 67, cz - 5, M.COPPER2);
  el(72, 5.3, 5.3, M.COPPER2);
  for (const deg of [-75, -50, -25, 0, 25, 50, 75]) {
    const a = deg * Math.PI / 180;
    for (let t = 1, px = null, py = null; t <= 13; t += 0.5) { const x = Math.round(Math.sin(a) * t), y = Math.round(Math.cos(a) * t); if (px !== null && x !== px && y !== py) set(cx + px, Y + 72 + y, cz - 1, M.COPPER); set(cx + x, Y + 72 + y, cz - 1, M.COPPER); px = x; py = y; }
  }
  // her right arm (on the east side when she looks north), straight up with the torch
  for (let h = 50; h <= 90; h++) { const x = Math.round(6 + (h - 50) * 0.13), w = h < 62 ? 3 : h < 80 ? 2 : 1; box(cx + x - w, Y + h, cz - 3, cx + x + 1, Y + h, cz + (h < 80 ? 0 : -1), h < 62 && (h & 3) === 0 ? M.COPPER2 : M.COPPER); }
  const tx = 11.5;
  for (let h = 91; h <= 95; h++) el(h, 1.5, 1.5, M.COPPER2, tx, -2);
  el(96, 3.6, 3.6, M.COPPER2, tx, -2); el(97, 3.6, 3.6, M.BRASS, tx, -2);
  [2.6, 3, 2.8, 2.4, 2, 1.6, 1.3, 1, 0.8].forEach((r, i) => el(98 + i, r, r, i === 0 ? M.BRASS : i % 3 === 2 ? M.LIT : M.LIT_Y, tx + (i > 5 ? 0.4 : 0), -2));
  // her left arm, and the tablet
  box(cx - 10, Y + 38, cz - 6, cx - 6, Y + 43, cz - 3, M.COPPER); box(cx - 9, Y + 44, cz - 5, cx - 6, Y + 52, cz - 2, M.COPPER);
  box(cx - 13, Y + 38, cz - 8, cx - 9, Y + 53, cz - 7, M.COPPER2); if (L >= 1) for (const y of [42, 45, 48]) box(cx - 12, Y + y, cz - 9, cx - 10, Y + y, cz - 9, M.COPPER);
  // the island: trees round the fort, lamps and benches by the landing
  if (L >= 2) {
    for (const [a, b] of [[13, 13], [67, 13], [13, 67], [67, 67], [40, 5], [5, 40], [75, 40]]) tree(lx + a, lz + b, 11, 5);
    lampPost(lx + 30, lz + 2, 18); lampPost(lx + 50, lz + 2, 18); bench(lx + 22, lz + 5); bench(lx + 52, lz + 5);
    begin('Flagpole', 'prop', false); box(lx + 40, 0, lz + 76, lx + 40, 34, lz + 76, M.TRIM); box(lx + 41, 28, lz + 76, lx + 48, 33, lz + 76, M.CAR_A); box(lx + 41, 31, lz + 76, lx + 44, 33, lz + 76, M.CAR_B);
  }
}

// ---- the ballpark ----------------------------------------------------------------------------------------------------
// A baseball park on a lot 132 square: home plate near the front, the field fanning out behind it, a three-tier
// grandstand wrapped round the infield under a roof with a white scalloped frieze, low bleachers round the outfield
// and a scoreboard in centre field. The field itself is painted on the ground (nyc_water.js).
export const BALLPARK = { S: 132, HA: 66, HB: 30, R: 70 };
// is this spot of the lot (a across, b back from the front) part of the field?
export function fieldAt(a, b) {
  const da = a - BALLPARK.HA, db = b - BALLPARK.HB, rho = Math.hypot(da, db);
  if (rho < 9) return true;
  const phi = Math.atan2(da, db);
  return Math.abs(phi) <= Math.PI / 4 + 0.06 && rho <= BALLPARK.R + 12 * Math.cos(2 * phi);
}
export function ballpark(lx, lz, L, o = {}) {
  const { S, HA, HB, R } = BALLPARK, DG = 24, DO = 12, TOP = 47;
  // how far each spot is from the field (a chamfer distance transform)
  const d = new Float32Array(S * S).fill(1e6);
  for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) if (fieldAt(a + 0.5, b + 0.5)) d[a + b * S] = 0;
  const pass = (a, b, da, db, w) => { const aa = a + da, bb = b + db; if (aa >= 0 && bb >= 0 && aa < S && bb < S && d[aa + bb * S] + w < d[a + b * S]) d[a + b * S] = d[aa + bb * S] + w; };
  for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) { pass(a, b, -1, 0, 1); pass(a, b, 0, -1, 1); pass(a, b, -1, -1, 1.414); pass(a, b, 1, -1, 1.414); }
  for (let b = S - 1; b >= 0; b--) for (let a = S - 1; a >= 0; a--) { pass(a, b, 1, 0, 1); pass(a, b, 0, 1, 1); pass(a, b, 1, 1, 1.414); pass(a, b, -1, 1, 1.414); }
  begin(o.title || 'Bronx Ballpark', 'landmark');
  const seat = [M.CAR_B, M.CAR_B, M.SPANDREL];
  for (let b = 2; b <= S - 3; b++) for (let a = 2; a <= S - 3; a++) {
    const dd = d[a + b * S]; if (dd <= 0) continue;
    const da = a + 0.5 - HA, db = b + 0.5 - HB, phi = Math.atan2(da, db), out = Math.abs(phi) < Math.PI / 4 + 0.06 && Math.hypot(da, db) > R - 4, D = out ? DO : DG;
    if (dd > D) continue;
    const x = lx + a, z = lz + b, rim = a === 2 || a === S - 3 || b === 2 || b === S - 3, grid = a % 6 === 0 && b % 6 === 0;
    if (dd > D - 2 || rim) {
      // the outer wall, two thick: pale stone, two tiers of tall narrow arches lined up on home plate, a blue band under the roof
      const top = out ? 13 : TOP, k = Math.floor((phi + Math.PI) * 132 / Math.PI) % 6;
      for (let y = 0; y <= top; y++) {
        if (!out && !rim && k < 3 && ((y > 3 && y < 15 - (k === 1 ? 0 : 1)) || (y > 19 && y < 35 - (k === 1 ? 0 : 2)))) continue;
        set(x, y, z, y === top || y === 17 ? M.TRIM : !out && y > 38 && y < 42 ? M.CAR_B : M.LIME);
      }
      continue;
    }
    if (dd <= 1.6) { box(x, 0, z, x, 4, z, out ? M.DOOR_G : M.CAR_B); continue; }   // the wall round the field
    if (out) { const h = 2 + Math.floor(dd * 0.6); box(x, 0, z, x, h - 1, z, M.CONC); set(x, h, z, (Math.floor(dd) & 1) ? M.PL_B : M.TRIM); continue; }
    // the grandstand: the lower deck on the ground, a walkway behind it, the upper deck over that and the roof on top
    if (dd <= 12) { const h = 2 + Math.floor((dd - 1) * 0.6); box(x, 0, z, x, h - 1, z, M.CONC); set(x, h, z, seat[Math.floor(dd) % 3]); }
    else { set(x, 8, z, M.SLAB); if (grid) box(x, 0, z, x, 7, z, M.CONC); }
    if (dd > 8) {
      const y = 22 + Math.floor((dd - 8) * 0.85);
      set(x, y - 1, z, M.CONC); set(x, y, z, dd <= 9 ? M.TRIM : seat[(Math.floor(dd) + 1) % 3]); if (dd <= 9) set(x, y + 1, z, M.TRIM);
      if (grid && dd > 13) { box(x, 9, z, x, y - 2, z, M.CONC); if (dd > 14) box(x, y + 1, z, x, TOP - 1, z, M.STEEL); }
    }
    if (dd > 13.2) set(x, TOP, z, M.TRIM);
    if (dd > 13.2 && dd <= 14.4) for (let y = TOP - 5; y < TOP; y++) if (y >= TOP - 2 || ((a + b) & 3) < 2) set(x, y, z, M.TRIM);   // the frieze
  }
  // the scoreboard in centre field, and the name over the gate behind home plate
  box(lx + HA - 20, 0, lz + S - 6, lx + HA + 19, 40, lz + S - 4, M.DARK); box(lx + HA - 20, 41, lz + S - 6, lx + HA + 19, 41, lz + S - 4, M.STEEL);
  if (L >= 1) {
    const Fs = face('f', lx + HA - 20, lz + S - 6, lx + HA + 19, lz + S - 6);
    text(Fs, o.home || 'BRONX 3', (40 - textW(o.home || 'BRONX 3')) >> 1, 31, 1, M.LIT_Y); text(Fs, o.away || 'AWAY 1', (40 - textW(o.away || 'AWAY 1')) >> 1, 23, 1, M.LIT_W);
    for (let u = 4; u < 36; u += 3) Fs.p(u, 18, 1, u % 2 ? M.LIT_R : M.LIT_G);
    const Fg = face('f', lx + HA - 16, lz + 2, lx + HA + 15, lz + 2);
    text(Fg, 'BALLPARK', (32 - textW('BALLPARK')) >> 1, 36, 1, M.BRASS);
    for (let u = 6; u <= 24; u += 6) { Fg.box(u, 0, u + 3, 9, 0, 0, M.DARK); Fg.box(u, 10, u + 3, 10, 1, 1, M.TRIM); }
  }
  // floodlights: a rack on a steel mast at each end of the grandstand and behind the bleachers
  for (const [a, b] of [[8, 8], [S - 10, 8], [6, 78], [S - 8, 78]]) {
    begin('Floodlight', 'prop', true);
    box(lx + a, 0, lz + b, lx + a + 1, 62, lz + b + 1, M.STEEL); box(lx + a - 3, 63, lz + b, lx + a + 4, 68, lz + b + 1, M.DARK);
    for (let u = -3; u <= 4; u++) for (let y = 63; y <= 68; y += 1) if ((u + y) & 1) set(lx + a + u, y, lz + b + (a < S / 2 ? 2 : -1), M.LIT_W);
  }
}

// ---- towers built as a stack of tiers ----------------------------------------------------------------------------------
// Each tier is [y0, y1, half width, half depth] round (cx, cz): stone piers two wide with strips of window between them,
// a floor every 12 (every `sparse` for the wide tiers, to keep the count down) and a roof slab the next tier stands on.
function stack(cx, cz, tiers, wall, span, o = {}) {
  let last = null;
  tiers.forEach(([y0, y1, hx, hz], ti) => {
    const x0 = cx - hx, x1 = cx + hx - 1, z0 = cz - hz, z1 = cz + hz - 1;
    faces4(x0, z0, x1, z1).forEach((F, fi) => {
      for (let u = 0; u < F.W; u++) {
        const edge = Math.min(u, F.W - 1 - u), pier = edge < 3 || ((u - 3) & 3) >= 2;
        for (let y = y0; y <= y1; y++) {
          const r = y % 12;
          F.p(u, y, 0, y < 2 ? M.STONE : pier || y === y1 ? wall : r < 3 ? span : ((Math.floor(y / 12) * 7 + (u >> 2) * 13 + fi * 5) % 13) === 0 ? M.LIT : M.GLASS);
        }
      }
      F.band(y1, y1, 1, o.band || M.TRIM);
    });
    const every = hx * hz > 900 ? 24 : 12;
    for (let y = y0 + every - 1 - (y0 % 12); y < y1; y += every) box(x0 + 1, y, z0 + 1, x1 - 1, y, z1 - 1, M.CONC);
    box(x0 + 1, y1, z0 + 1, x1 - 1, y1, z1 - 1, M.SLAB);
    if (o.glow && ti >= o.glow) walls(x0, y1 + 1, z0, x1, y1 + 1, z1, M.LIT_W); else walls(x0, y1 + 1, z0, x1, y1 + 2, z1, wall);
    last = { x0, x1, z0, z1, y: y1 + 1 };
  });
  return last;
}

// ---- King Tower: our own take on the great 1930s skyscraper. A broad base, the long shaft stepping in near the top,
// and a round mast with a needle. It fills a lot 86 square and is 255 voxels tall, the full height of the sky ---------
export function kingtower(lx, lz, L, o = {}) {
  const cx = lx + 43, cz = lz + 43;
  begin(o.title || 'King Tower', 'landmark');
  stack(cx, cz, [[0, 63, 37, 33], [64, 87, 29, 25], [88, 111, 25, 20], [112, 195, 21, 15], [196, 207, 17, 12], [208, 219, 13, 9], [220, 227, 9, 7]], M.LIME, M.METAL, { glow: 4 });
  for (let y = 228; y <= 241; y++) { disc(cx, cz, y, 5, M.METAL, y % 4 === 0 || y === 241 ? -1 : 4); if (y % 4 && y < 240) for (const [a, b] of [[-5, -1], [-5, 0], [4, -1], [4, 0], [-1, -5], [0, -5], [-1, 4], [0, 4]]) set(cx + a, y, cz + b, M.LIT_W); }
  for (const [a, b] of [[-7, -1], [5, -1], [-1, -7], [-1, 5]]) box(cx + a, 228, cz + b, cx + a + 1, 236, cz + b + 1, M.CHROME);
  disc(cx, cz, 242, 4, M.CHROME); disc(cx, cz, 243, 3, M.CHROME); disc(cx, cz, 244, 2, M.CHROME); disc(cx, cz, 245, 1, M.CHROME);
  box(cx - 1, 246, cz - 1, cx - 1, 253, cz - 1, M.DARK); set(cx - 1, 254, cz - 1, M.LIT_R);
  // the entrance: three tall doors in a bronze frame, the name over them, flagpoles either side
  const Ff = face('f', cx - 37, cz - 33, cx + 36, cz + 32);
  Ff.box(28, 2, 45, 22, 0, 0, M.DARK); for (const u of [30, 35, 40]) Ff.box(u, 2, u + 3, 14, 0, 0, M.GLASS);
  if (L >= 1) {
    Ff.box(27, 0, 27, 24, 1, 1, M.BRASS); Ff.box(46, 0, 46, 24, 1, 1, M.BRASS); Ff.box(27, 24, 46, 25, 1, 2, M.BRASS);
    text(Ff, 'KING', (74 - textW('KING', 2)) >> 1, 28, 1, M.BRASS, 2);
    for (const u of [20, 53]) { Ff.box(u, 40, u, 40, 1, 6, M.DARK); Ff.box(u, 41, u, 47, 6, 6, M.DARK); Ff.box(u - 4, 44, u - 1, 47, 6, 6, M.CAR_A); }
  }
  if (L >= 2) { for (const a of [4, 24, 56, 76]) lampPost(lx + a, lz + 4, 20); for (const a of [12, 66]) tree(lx + a, lz + 3, 12, 4); }
}

// ---- the Silver Spire: our own take on the slender 1930s tower with the steel crown. White brick with dark bands, steel
// birds leaning out from the corners, and a crown of shrinking steel tiers with triangle lights under a long needle ------
export function silverspire(lx, lz, L, o = {}) {
  const cx = lx + 20, cz = lz + 22;
  begin(o.title || 'Silver Spire', 'landmark');
  const T = stack(cx, cz, [[0, 39, 17, 16], [40, 75, 15, 14], [76, 171, 12, 11], [172, 183, 10, 9]], M.TRIM, M.DARK, { band: M.CHROME });
  let y = T.y;
  [9, 8, 6, 5, 3, 2].forEach((h, k) => {
    walls(cx - h, y, cz - h, cx + h - 1, y + 6, cz + h - 1, M.CHROME); box(cx - h, y + 6, cz - h, cx + h - 1, y + 6, cz + h - 1, M.CHROME);
    if (h >= 3) for (const F of faces4(cx - h, cz - h, cx + h - 1, cz + h - 1)) for (let j = 0; j < Math.min(4, h - 2); j++) for (let u = h - Math.min(4, h - 2) + j; u <= h - 1 + Math.min(4, h - 2) - j; u++) F.p(u, y + 1 + j, 0, M.LIT_W);
    y += 7;
  });
  box(cx - 1, y, cz - 1, cx, y + 12, cz, M.CHROME); box(cx - 1, y + 13, cz - 1, cx - 1, y + 24, cz - 1, M.STEEL); set(cx - 1, y + 25, cz - 1, M.LIT_R);
  // the birds: four steel shapes leaning out from the corners where the shaft steps in
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const X = sx > 0 ? cx + 11 : cx - 12, Z = sz > 0 ? cz + 10 : cz - 11;
    for (let s = 0; s < 4; s++) box(Math.min(X + sx * s, X + sx * (s + 1)), 168 - (s > 2 ? 1 : 0), Math.min(Z + sz * s, Z + sz * (s + 1)), Math.max(X + sx * s, X + sx * (s + 1)), 170, Math.max(Z + sz * s, Z + sz * (s + 1)), M.CHROME);
  }
  const Ff = face('f', cx - 17, cz - 16, cx + 16, cz + 15);
  door(Ff, 14, 6, 12, M.DARK, { glass: true, frame: M.CHROME });
  if (L >= 1) { Ff.box(12, 0, 12, 16, 1, 1, M.CHROME); Ff.box(21, 0, 21, 16, 1, 1, M.CHROME); for (let j = 0; j < 5; j++) Ff.box(12 + j, 16 + j, 21 - j, 16 + j, 1, 1, M.CHROME); }
  if (L >= 2) { lampPost(lx + 1, lz + 2); lampPost(lx + 38, lz + 2); }
}
