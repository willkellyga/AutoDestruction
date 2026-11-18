// Cairo's river and what stands in and over it: the bridges (every street across is one), the lions at the ends of the
// middle bridge, the sailing boats and a river cruiser; and the painted ground: sand and
// its ripples, the green of the valley, the Nile and its island, the paving round the pyramids, sand over the desert roads.
// The map is flat, so the water is paint, a bridge's deck is the street itself, and monsters wade.
import { M, WX, WZ, STREET_X, STREET_Z, WALK, ROADW, set, box, begin, setSeed, ri } from './world.js';
import { lampPost } from './kit.js';
import { NILE, ISLE, DESERT, GREAT_AT, KHAFRE_AT, MENK_AT, SPHINX_AT, CITADEL_AT, MUSEUM_AT, OPERA_AT, BARON_AT, RAMSES_AT, ABDEEN_AT, HALL_AT, wet, isle } from './cairo.js';
import { palm, chain, rdisc } from './cairo_kit.js';

// where a street at z meets the water: one span, or two with the island between
function spans(z) {
  if (z < ISLE.z0 || z >= ISLE.z1) return [[NILE.x0, NILE.x1 - 1]];
  let a = ISLE.x0, b = ISLE.x1 - 1; while (!isle(a, z)) a++; while (!isle(b, z)) b--;
  return [[NILE.x0, a - 1], [b + 1, NILE.x1 - 1]];
}
// A bridge over x0..x1 on the street at zc: a railing and stone piers down each side, lamps, and for `truss` a frame of
// steel over the road.
function bridge(x0, x1, zc, title, o = {}) {
  for (const z of [zc - 20, zc + 20]) {
    begin(title, 'monument');
    for (let x = x0; x <= x1; x++) { set(x, 3, z, M.DARK); if ((x - x0) % 4 === 0 || x === x1) box(x, 0, z, x, 2, z, M.DARK); }
    for (const x of [x0, x1 - 3]) box(x, 0, z - 1, x + 3, 5, z + 1, M.LIME2);
    for (let x = x0 + 28; x < x1 - 20; x += 28) box(x, 0, z - 1, x + 2, 4, z + 1, M.LIME2);
    if (o.truss) {
      const T = 22, m = o.truss, n = Math.floor((x1 - x0) / 12);
      box(x0, T, z, x1, T, z, m); box(x0, 4, z, x1, 4, z, m);
      for (let k = 0; k <= n; k++) { const x = k === n ? x1 : x0 + k * 12; box(x, 0, z, x, T, z, m); if (k < n) chain(k & 1 ? [[x, T, z], [Math.min(x1, x + 12), 4, z]] : [[x, 4, z], [Math.min(x1, x + 12), T, z]], m); }
      if (z < zc) for (let k = 0; k <= n; k += 2) { const x = k === n ? x1 : x0 + k * 12; box(x, T, zc - 19, x, T, zc + 19, m); }
    }
  }
  if (!o.lions) for (let x = x0 + 12; x < x1 - 10; x += 44) { lampPost(x, zc - 15, 18); lampPost(x + 20, zc + 14, 18); }
}
// A bronze lion on a stone block, at the end of a bridge. It looks along x: dir 1 toward high x.
function lion(x, z, dir) {
  begin('Bridge lion', 'monument');
  box(x - 4, 0, z - 2, x + 4, 5, z + 2, M.LIME); box(x - 5, 0, z - 2, x + 5, 1, z + 2, M.LIME2);
  const B = M.IRON, X = (a) => x + a * dir;
  box(Math.min(X(-3), X(2)), 6, z - 1, Math.max(X(-3), X(2)), 8, z + 1, B);
  box(Math.min(X(1), X(3)), 9, z - 1, Math.max(X(1), X(3)), 12, z + 1, B); box(X(4), 9, z, X(4), 10, z, B);
  box(Math.min(X(3), X(4)), 6, z - 1, Math.max(X(3), X(4)), 6, z - 1, B); box(Math.min(X(3), X(4)), 6, z + 1, Math.max(X(3), X(4)), 6, z + 1, B);
  set(X(-4), 7, z, B); set(X(-4), 8, z, B);
}

// ---- boats: drawn bow first along z, the way the river runs -----------------------------------------------------------
const plotter = (x0, z0, back) => (i, y, d, m) => set(x0 + d, y, back ? z0 - i : z0 + i, m);
function hull(P, len, half, hgt, m, keel, bow, deckM) {
  const W = (i) => { const t = i >= len - bow ? (i - (len - bow) + 1) / bow : i < 4 ? (4 - i) / 10 : 0; return Math.max(1, Math.round(half * (1 - t * t))); };
  for (let i = 0; i < len; i++) {
    const w = W(i), wn = Math.min(i ? W(i - 1) : 0, i < len - 1 ? W(i + 1) : 0);
    for (let d = -w; d < w; d++) {
      const skin = d === -w || d === w - 1 || d < -wn || d >= wn || i % 8 === 0;
      for (let y = 0; y <= hgt; y++) if (y < 2 || y === hgt || skin) P(i, y, d, y < 2 ? keel : y === hgt ? deckM : m);
    }
  }
}
const pbox = (P, i0, y0, d0, i1, y1, d1, m) => { for (let i = i0; i <= i1; i++) for (let y = y0; y <= y1; y++) for (let d = d0; d <= d1; d++) P(i, y, d, m); };
// A felucca: a low wooden hull under one great triangle of sail on a slanting spar.
function felucca(x0, z0, back, paint) {
  begin('Sailing boat', 'boat', true);
  const P = plotter(x0, z0, back);
  hull(P, 30, 3, 3, paint, M.DARK, 8, M.FLOOR);
  pbox(P, 18, 4, 0, 18, 24, 0, M.TRUNK);
  const yard = (i) => Math.round(34 - (i - 6) * 28 / 20);
  for (let i = 6; i <= 26; i++) { const yt = yard(i); for (let y = 7; y <= yt; y++) P(i, y, 0, y === yt || y === yt - 1 ? M.TRUNK : M.AWN_W); }
  pbox(P, 6, 4, 0, 6, 7, 0, M.TRUNK); pbox(P, 26, 4, 0, 26, 7, 0, M.TRUNK);
  pbox(P, 3, 4, -2, 5, 4, 1, M.AWN_R); pbox(P, 10, 4, -1, 11, 5, 0, M.WOOD);
}
// A river cruiser: three white decks of cabins, a sun deck under an awning, a funnel.
function cruiser(x0, z0) {
  begin('River cruiser', 'boat', true);
  const P = plotter(x0, z0, false);
  hull(P, 78, 7, 5, M.TRIM, M.CAR_B, 12, M.FLOOR);
  for (let s = 0; s < 3; s++) {
    const y = 6 + s * 7, a = 8 + s * 2, b = 62 - s * 3;
    for (let i = a; i <= b; i++) for (const d of [-6, 5]) for (let yy = y; yy <= y + 5; yy++) P(i, yy, d, yy >= y + 2 && yy <= y + 4 && (i - a) % 4 !== 0 ? ((i * 3 + s) % 13 === 0 ? M.LIT : M.GLASS) : M.TRIM);
    for (let d = -6; d <= 5; d++) for (let yy = y; yy <= y + 5; yy++) { P(a, yy, d, M.TRIM); P(b, yy, d, M.TRIM); }
    pbox(P, a - 1, y + 6, -7, b + 1, y + 6, 6, s === 2 ? M.FLOOR : M.TRIM);
    for (let i = a - 1; i <= b + 1; i += 2) { P(i, y + 7, -7, M.DARK); P(i, y + 7, 6, M.DARK); }
  }
  for (const i of [16, 30, 44, 56]) for (const d of [-6, 5]) pbox(P, i, 27, d, i, 33, d, M.STEEL);
  pbox(P, 15, 34, -7, 57, 34, 6, M.AWN_B); for (let i = 15; i <= 57; i += 4) pbox(P, i, 34, -7, i + 1, 34, 6, M.AWN_W);
  pbox(P, 20, 27, -2, 24, 38, 1, M.CAR_A); pbox(P, 20, 39, -2, 24, 39, 1, M.DARK);
  pbox(P, 70, 6, 0, 70, 14, 0, M.DARK);
}

export function cairoExtras() {
  setSeed(1969);
  // the bridges, north to south. The middle one keeps its lions.
  const NAMES = ['Imbaba Bridge', 'Zamalek Bridge', 'Gala Bridge', 'Qasr El Nil Bridge', 'Rhoda Bridge', 'Giza Bridge'];
  STREET_Z.forEach((z, i) => spans(z).forEach(([a, b]) => bridge(a, b, z, NAMES[i], i === 0 ? { truss: M.STEEL } : i === 5 ? { truss: M.ROOF_G } : i === 3 ? { lions: 1 } : {})));
  { const z = STREET_Z[3], [[a0, a1], [b0, b1]] = spans(z); for (const [x, dir] of [[a0 + 6, -1], [a1 - 6, 1], [b0 + 6, -1], [b1 - 6, 1]]) for (const s of [-16, 16]) lion(x, z + s, dir); }
  // boats: sails on the open water and in the channels, a cruiser below the island
  felucca(420, 30, false, M.WOOD); felucca(500, 190, true, M.PL_B); felucca(540, 40, false, M.TRUNK); felucca(455, 140, false, M.PL_W);
  felucca(412, 440, true, M.WOOD); felucca(548, 610, false, M.PL_G); felucca(414, 760, false, M.TRUNK); felucca(546, 300, true, M.WOOD);
  felucca(430, 925, false, M.PL_B); felucca(535, 1000, true, M.WOOD);
  cruiser(486, 905);
  // palms along the island's banks and on its two points
  for (let z = ISLE.z0 + 34; z < ISLE.z1 - 30; z += 37) for (const x of [ISLE.x0 + 2, ISLE.x1 - 3]) if (STREET_Z.every((s) => Math.abs(z - s) > 24)) palm(x, z + ri(-3, 3), ri(16, 24));
  for (const [x, z] of [[470, 266], [492, 270], [481, 282], [462, 284], [500, 286], [468, 832], [494, 828], [481, 816], [460, 812], [502, 814]]) palm(x, z, ri(18, 26));
  begin('Island fountain', 'prop', false);
  rdisc(481, 800, 0, 6, M.LIME); rdisc(481, 800, 1, 6, M.LIME, 5); rdisc(481, 800, 1, 5, M.WATER); box(481, 1, 800, 481, 6, 800, M.LIME); set(481, 7, 800, M.WATER);
  // palms on the desert bank, and a few out on the sand
  for (let z = DESERT.z0 + 40; z < WZ - 20; z += 46) if (STREET_Z.every((s) => Math.abs(z - s) > 24)) palm(NILE.x0 - 2, z + ri(-6, 6), ri(18, 26));
  for (const [x, z] of [[30, 384], [176, 496], [12, 668], [150, 840], [60, 990], [120, 950], [180, 640], [300, 836], [176, 420]]) palm(x, z, ri(16, 24));
  // rocks, all clear of the roads
  for (const [x, z, w] of [[20, 496, 5], [178, 670, 4], [150, 400, 3], [10, 836, 5], [60, 498, 3], [170, 1000, 4]]) { begin('Rock', 'prop', false); box(x, 0, z, x + w, 2, z + w - 1, M.SAND2); box(x + 1, 3, z + 1, x + w - 1, 3 + (w > 4 ? 1 : 0), z + w - 2, M.SAND2); }
}

// ---- the painted ground ---------------------------------------------------------------------------------------------
const SANDC = '#dfc994', DUST = '#c9bc9f', FIELD = '#9bb26a', LAWN = '#8fb46a', WATER = '#3f8f94', SHADE = 'rgba(18,60,66,0.42)';
// before the lot pads: sand, the dust of the town, the green of the valley, and the river with its island
export function cairoBase(g, GK, rect, speckle) {
  let s = 1969; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  g.fillStyle = SANDC; rect(0, 0, WX, WZ);
  speckle(0, 0, WX, WZ, 420000, ['rgba(255,244,214,0.3)', 'rgba(170,138,84,0.16)', 'rgba(236,214,160,0.3)']);
  // ripples where the wind has combed the sand
  g.lineWidth = 0.7 * GK;
  for (let i = 0; i < 900; i++) {
    const x = r() * DESERT.x1, z = DESERT.z0 + r() * (WZ - DESERT.z0), len = 14 + r() * 40;
    g.strokeStyle = r() < 0.5 ? 'rgba(255,246,220,0.3)' : 'rgba(160,126,72,0.2)';
    g.beginPath(); g.moveTo(x * GK, z * GK); g.quadraticCurveTo((x + len / 2) * GK, (z - 2 - r() * 5) * GK, (x + len) * GK, (z + r() * 3) * GK); g.stroke();
  }
  // the town stands on dusty paving
  g.fillStyle = DUST; rect(NILE.x1, 0, WX, 884); rect(0, 0, NILE.x0, DESERT.z0);
  speckle(NILE.x1, 0, WX, 884, 170000, ['rgba(255,250,235,0.2)', 'rgba(110,96,70,0.15)']); speckle(0, 0, NILE.x0, DESERT.z0, 60000, ['rgba(255,250,235,0.2)', 'rgba(110,96,70,0.15)']);
  // the fields: along the south on both banks, and at the western edge of Giza
  for (const [xa, za, xb, zb] of [[NILE.x1, 884, WX, WZ], [220, 884, NILE.x0, WZ], [0, 166, 49, 338], [49, 290, 95, 338]]) {
    g.fillStyle = FIELD; rect(xa, za, xb, zb);
    g.fillStyle = 'rgba(66,108,48,0.28)'; for (let z = za + 2; z < zb; z += 5) rect(xa, z, xb, z + 1.5);
    g.fillStyle = 'rgba(120,96,58,0.35)'; for (let x = xa + 22; x < xb; x += 46) rect(x, za, x + 1, zb);
    speckle(xa, za, xb, zb, Math.round((xb - xa) * (zb - za) / 6), ['rgba(150,196,104,0.4)', 'rgba(60,100,44,0.25)']);
  }
  // the river
  g.fillStyle = WATER; rect(NILE.x0, 0, NILE.x1, WZ);
  g.fillStyle = SHADE; rect(NILE.x0, 0, NILE.x0 + 3, WZ); rect(NILE.x1 - 3, 0, NILE.x1, WZ);
  for (let i = 0; i < 26000; i++) { const x = NILE.x0 + Math.floor(r() * (NILE.x1 - NILE.x0 - 8)), z = Math.floor(r() * WZ), w = 2 + Math.floor(r() * 7); g.fillStyle = r() < 0.5 ? 'rgba(190,236,226,0.26)' : 'rgba(16,66,72,0.22)'; rect(x, z, x + w, z + 1); }
  // the island: a sandy bank, lawn inside it
  const rr = (x0, z0, x1, z1, q) => { g.beginPath(); g.moveTo((x0 + q) * GK, z0 * GK); g.arcTo(x1 * GK, z0 * GK, x1 * GK, z1 * GK, q * GK); g.arcTo(x1 * GK, z1 * GK, x0 * GK, z1 * GK, q * GK); g.arcTo(x0 * GK, z1 * GK, x0 * GK, z0 * GK, q * GK); g.arcTo(x0 * GK, z0 * GK, x1 * GK, z0 * GK, q * GK); g.closePath(); g.fill(); };
  g.fillStyle = SHADE; rr(ISLE.x0 - 2, ISLE.z0 - 2, ISLE.x1 + 2, ISLE.z1 + 2, ISLE.r + 2);
  g.fillStyle = '#cdb983'; rr(ISLE.x0, ISLE.z0, ISLE.x1, ISLE.z1, ISLE.r);
  g.fillStyle = LAWN; rr(ISLE.x0 + 3, ISLE.z0 + 3, ISLE.x1 - 3, ISLE.z1 - 3, ISLE.r - 3);
  for (let i = 0; i < 26000; i++) { const x = ISLE.x0 + 4 + Math.floor(r() * (ISLE.x1 - ISLE.x0 - 8)), z = ISLE.z0 + 4 + Math.floor(r() * (ISLE.z1 - ISLE.z0 - 8)); if (!isle(x - 4, z) || !isle(x + 4, z) || !isle(x, z - 4) || !isle(x, z + 4)) continue; g.fillStyle = r() < 0.5 ? 'rgba(150,196,104,0.45)' : 'rgba(70,116,54,0.3)'; rect(x, z, x + 1, z + 1); }
  // reeds along the banks
  for (let i = 0; i < 5000; i++) { const z = Math.floor(r() * WZ), e = r() < 0.5, x = e ? NILE.x0 + Math.floor(r() * 4) : NILE.x1 - 1 - Math.floor(r() * 4); g.fillStyle = 'rgba(96,150,70,0.6)'; rect(x, z, x + 1, z + 1 + Math.floor(r() * 2)); }
}
// after the lot pads and before the streets, so a bridge is simply a street that crosses the water
export function cairoGround(g, GK, rect, speckle, LOTS) {
  const GRIT = ['rgba(255,250,235,0.25)', 'rgba(130,108,70,0.18)'];
  // the gardens, groves, fields and villages: each lot by what grows on it
  for (const L of LOTS) {
    const x = L.x, z = L.z;
    if (L.k === 'palms') {
      const v = L.o.v;
      if (v === 0) { g.fillStyle = LAWN; rect(x, z, x + 40, z + 40); speckle(x, z, x + 40, z + 40, 600, ['rgba(150,196,104,0.45)', 'rgba(70,116,54,0.3)']); g.fillStyle = '#d6c9a8'; rect(x + 18, z, x + 22, z + 40); rect(x, z + 18, x + 40, z + 22); }
      else if (v === 1) { g.fillStyle = 'rgba(120,160,84,0.75)'; g.beginPath(); g.ellipse((x + 20) * GK, (z + 20) * GK, 18 * GK, 15 * GK, 0, 0, Math.PI * 2); g.fill(); speckle(x + 4, z + 6, x + 36, z + 34, 500, ['rgba(150,196,104,0.45)', 'rgba(70,116,54,0.3)']); }
      else if (v === 2) { g.fillStyle = '#806c48'; rect(x, z, x + 40, z + 40); g.fillStyle = 'rgba(52,40,24,0.3)'; for (let t = 1; t < 40; t += 3) rect(x, z + t, x + 40, z + t + 1); }
      else { g.fillStyle = '#b3b673'; rect(x, z, x + 40, z + 40); speckle(x, z, x + 40, z + 40, 600, ['rgba(150,196,104,0.45)', 'rgba(120,96,58,0.25)']); }
    } else if (L.k === 'village') { g.fillStyle = '#d2ba88'; rect(x, z, x + 40, z + 40); speckle(x, z, x + 40, z + 40, 600, GRIT); }
    else if (L.k === 'camp' || L.k === 'dig') { g.fillStyle = 'rgba(190,160,104,0.45)'; rect(x + 2, z + 2, x + 38, z + 38); speckle(x, z, x + 40, z + 40, 500, GRIT); }
  }
  // the pyramids stand on paving of their own stone; a causeway runs from the second down to the Sphinx
  for (const [P, S] of [[GREAT_AT, 132], [KHAFRE_AT, 132], [MENK_AT, 110]]) {
    g.fillStyle = '#d6c08a'; rect(P.x - 4, P.z - 4, P.x + S + 4, P.z + S + 4); speckle(P.x - 4, P.z - 4, P.x + S + 4, P.z + S + 4, 9000, GRIT);
    g.fillStyle = 'rgba(140,110,62,0.22)'; for (let t = 0; t <= S + 8; t += 6) { rect(P.x - 4 + t, P.z - 4, P.x - 4 + t + 0.25, P.z + S + 4); rect(P.x - 4, P.z - 4 + t, P.x + S + 4, P.z - 4 + t + 0.25); }
  }
  g.fillStyle = '#d2bb84'; rect(KHAFRE_AT.x + 132, 602, SPHINX_AT.x + 8, 614); speckle(KHAFRE_AT.x + 132, 602, SPHINX_AT.x + 8, 614, 500, GRIT);
  // the Sphinx lies in a hollow cut down into darker rock
  { const P = SPHINX_AT; g.fillStyle = '#d2bb84'; rect(P.x, P.z, P.x + 132, P.z + 132); speckle(P.x, P.z, P.x + 132, P.z + 132, 6000, GRIT);
    g.fillStyle = 'rgba(92,70,36,0.3)'; rect(P.x + 3, P.z + 35, P.x + 98, P.z + 99); g.fillStyle = '#c4a970'; rect(P.x + 5, P.z + 37, P.x + 96, P.z + 97); speckle(P.x + 5, P.z + 37, P.x + 96, P.z + 97, 5000, GRIT);
    g.fillStyle = '#cdb47c'; rect(P.x + 98, P.z + 18, P.x + 130, P.z + 116); }
  // the Citadel's rock, the museum's garden, the opera's forecourt
  g.fillStyle = '#cdb680'; rect(CITADEL_AT.x, CITADEL_AT.z, CITADEL_AT.x + 132, CITADEL_AT.z + 132);
  { const P = MUSEUM_AT; g.fillStyle = '#d6ccb2'; rect(P.x, P.z, P.x + 86, P.z + 86); speckle(P.x, P.z, P.x + 86, P.z + 86, 5000, GRIT);
    g.fillStyle = LAWN; rect(P.x + 2, P.z + 52, P.x + 28, P.z + 84); rect(P.x + 58, P.z + 52, P.x + 84, P.z + 84); speckle(P.x + 2, P.z + 52, P.x + 84, P.z + 84, 1500, ['rgba(150,196,104,0.4)', 'rgba(70,116,54,0.25)']);
    g.fillStyle = '#d6ccb2'; rect(P.x + 28, P.z + 52, P.x + 58, P.z + 86); }
  { const P = OPERA_AT; g.fillStyle = '#d9cfb5'; rect(P.x, P.z, P.x + 86, P.z + 86); speckle(P.x, P.z, P.x + 86, P.z + 86, 5000, GRIT);
    g.fillStyle = 'rgba(150,132,104,0.4)'; for (let t = 4; t < 86; t += 8) rect(P.x + 56, P.z + t, P.x + 86, P.z + t + 0.3); }
  // round 2. The palaces and the station are turned to face south, the hall to face east: R takes lot coordinates
  { const P = ABDEEN_AT, R = (a0, b0, a1, b1) => rect(P.x + 86 - a1, P.z + 86 - b1, P.x + 86 - a0, P.z + 86 - b0);
    g.fillStyle = '#d6ccb2'; R(0, 0, 86, 86); speckle(P.x, P.z, P.x + 86, P.z + 86, 5000, GRIT);
    g.fillStyle = LAWN; R(3, 4, 37, 32); R(49, 4, 83, 32); speckle(P.x + 3, P.z + 54, P.x + 83, P.z + 82, 1500, ['rgba(150,196,104,0.4)', 'rgba(70,116,54,0.25)']);
    g.fillStyle = '#e4dcc6'; R(38, 0, 48, 33); R(36, 12, 50, 24); }
  { const P = BARON_AT, R = (a0, b0, a1, b1) => rect(P.x + 86 - a1, P.z + 86 - b1, P.x + 86 - a0, P.z + 86 - b0);
    g.fillStyle = LAWN; R(0, 0, 86, 86); speckle(P.x, P.z, P.x + 86, P.z + 86, 5000, ['rgba(150,196,104,0.4)', 'rgba(70,116,54,0.25)']);
    g.fillStyle = '#d9c9a0'; R(33, 0, 53, 28); R(6, 26, 80, 83); speckle(P.x + 6, P.z + 3, P.x + 80, P.z + 60, 2500, GRIT); }
  { const P = RAMSES_AT, R = (a0, b0, a1, b1) => rect(P.x + 86 - a1, P.z + 86 - b1, P.x + 86 - a0, P.z + 86 - b0);
    g.fillStyle = '#d2c8b0'; R(0, 0, 86, 86); speckle(P.x, P.z, P.x + 86, P.z + 86, 5000, GRIT);
    for (const [a0, a1] of [[11, 23], [34, 52], [63, 75]]) { g.fillStyle = '#6f675c'; R(a0, 34, a1, 90); }
    for (const c of [16, 38, 47, 68]) { g.fillStyle = '#4a3f33'; for (let b = 35; b < 90; b += 2) R(c - 3, b, c + 4, b + 0.6); g.fillStyle = '#b9bcc0'; R(c - 2, 34, c - 1.6, 90); R(c + 2.6, 34, c + 3, 90); } }
  { const P = HALL_AT, R = (a0, b0, a1, b1) => rect(P.x + 86 - b1, P.z + a0, P.x + 86 - b0, P.z + a1);
    g.fillStyle = '#d6ccb2'; R(0, 0, 86, 86); speckle(P.x, P.z, P.x + 86, P.z + 86, 5000, GRIT);
    g.fillStyle = 'rgba(150,132,104,0.4)'; for (let t = 4; t < 86; t += 8) R(t, 0, t + 0.3, 30); }
}
// after the streets: the desert roads have no pavements, only sand, and the sand drifts over their edges
export function cairoOver(g, GK, rect, speckle) {
  const H = ROADW / 2, P = H + WALK, SAND = ['rgba(223,201,148,0.75)', 'rgba(236,214,160,0.6)', 'rgba(200,172,116,0.5)'];
  let s = 404; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const blot = (x, z, rx, rz) => { g.beginPath(); g.ellipse(x * GK, z * GK, rx * GK, rz * GK, 0, 0, Math.PI * 2); g.fill(); };
  const zs = [[352, 0], [524, 2], [696, 2], [868, 2]], XB = DESERT.x1 - 34;   // [street, sides: 0 south only, 2 both], as far east as the corniche
  g.fillStyle = SANDC;
  rect(202 - P, DESERT.z0 + 18, 202 - H - 0.6, WZ); rect(202 + H + 0.6, DESERT.z0 + 18, 202 + P, WZ); rect(373 - P, DESERT.z0 + 18, 373 - H - 0.6, WZ);
  for (const [z, sides] of zs) { rect(0, z + H + 0.6, XB, z + P); if (sides) rect(0, z - P, XB, z - H - 0.6); }
  // put the kerb line back where a sanded pavement crosses another street
  g.fillStyle = '#474b54';
  for (const [z] of zs) for (const x of [202, 373]) rect(x - H, z - P, x + H, z + P);
  for (const x of [202]) for (const [z] of zs) rect(x - P, z - H, x + P, z + H);
  for (const [z] of zs) rect(373 - P, z - H, 373, z + H);
  // drifts
  for (let i = 0; i < 700; i++) {
    g.fillStyle = SAND[(r() * 3) | 0];
    if (r() < 0.5) { const x = r() < 0.75 ? 202 : 373, z = DESERT.z0 + 20 + r() * (WZ - DESERT.z0 - 20), e = x === 373 || r() < 0.5 ? -1 : 1; blot(x + e * (H - r() * 4), z, 1.5 + r() * 4, 3 + r() * 7); }
    else { const [z, sides] = zs[(r() * 4) | 0], x = r() * XB, e = !sides || r() < 0.5 ? 1 : -1; blot(x, z + e * (H - r() * 4), 3 + r() * 7, 1.5 + r() * 4); }
  }
  const DUSTY = ['rgba(223,201,148,0.35)', 'rgba(236,214,160,0.25)'];
  speckle(202 - H, DESERT.z0 + 18, 202 + H, WZ, 2600, DUSTY); speckle(373 - H, DESERT.z0 + 18, 373 + H, WZ, 1500, DUSTY);
  for (const [z] of zs) speckle(0, z - H, XB, z + H, 1400, DUSTY);
}
