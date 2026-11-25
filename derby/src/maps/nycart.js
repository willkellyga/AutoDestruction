// Empire City's signs and posters (Will, 2026-11-25, after Midnight Tokyo's: "the same final pass to both washington DC
// and New York ... a final polish and flavour pass"). As Tokyo's (maps/tokyoart.js) everything is a picture a voxel to a
// pixel drawn here: no font and no image is loaded, and every name on them is made up for this game.
//   - blade signs, the word down a lit board: what a New York street sells (HOTEL, DINER, PIZZA, DELI, JAZZ, PAWN...);
//   - the shows, for the great boards (FILMS): WRECKED! the musical, FIGHT NIGHT (two of the game's rivals nose to
//     nose), NITRO COLA;
//   - the street's ads: a slice, a cab, hot dogs, coffee, the radio, the paper, the scrap yard.
import { pixels } from './tokyoart.js';
import { label, latinW, latinH, centred } from './latin.js';

export const SIGN_WORDS = ['HOTEL', 'DINER', 'PIZZA', 'DELI', 'BAR', 'JAZZ', 'PAWN', 'LOANS', 'BAGELS', 'COFFEE', 'TATTOO', 'LIQUOR', 'GYM', 'CAFE', 'SUBS', 'CLUB', 'BOOKS', 'CIGARS', 'PARK', 'GRILL', 'TAXI', 'NEWS'];
// [the board, the letters]
export const SIGN_INKS = [[0x14161c, 0xff4a3a], [0x14161c, 0x58e8ff], [0x14161c, 0xffd84a], [0x7a1418, 0xfff2d8], [0x14161c, 0xff6ad8], [0x123a2a, 0xf4ffe8], [0x14161c, 0xffffff], [0x1a2a66, 0xfff2d8], [0xf2ead8, 0xb0201c], [0x14161c, 0x7dff8a]];
// a blade sign: the word down it, a rule round it, k times the size
export function sign(word, [board, ink], k = 1) {
  const W = 5 * k + 6, H = latinH(word, k) + 6, P = pixels(W, H, board);
  for (let x = 1; x < W - 1; x++) { P.dot(x, 1, ink); P.dot(x, H - 2, ink); }
  for (let y = 1; y < H - 1; y++) { P.dot(1, y, ink); P.dot(W - 2, y, ink); }
  label(P, word, 3, 3, ink, { k, down: true });
  return P;
}

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => { const p = hex(a), q = hex(b); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]; };
const rnd = (seed) => { let s = seed | 0; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; }; };
const bands = (P, x0, y0, w, h, top, foot, n = 6) => { for (let y = 0; y < h; y++) P.rect(x0, y0 + y, x0 + w, y0 + y + 1, mix(top, foot, Math.min(1, Math.floor(y / h * n) / (n - 1)))); };
// a car from the side, its nose to the right (flip: to the left), about 16 long, drawn by u
function car(P, cx, cy, u, body, flip = false, dark = 0x15171c) {
  const s = flip ? -1 : 1, X = (v) => cx + v * u * s, Y = (v) => cy + v * u, R = (a, b, c, d, col) => P.rect(Math.min(X(a), X(c)), Y(b), Math.max(X(a), X(c)), Y(d), col);
  R(-8, -2, 8, 2, body); R(-5, -5, 3, -2, body); R(-4, -4.4, -1, -2.2, 0x9fd4ee); R(-0.4, -4.4, 2.4, -2.2, 0x9fd4ee); R(7.4, -1, 8.6, 0.4, 0xfff2a8); R(-8.6, -1.4, -7.6, 0, 0xd8322a);
  P.ell(X(-4.6), Y(2.2), 2.1 * u, 2.1 * u, dark); P.ell(X(4.8), Y(2.2), 2.1 * u, 2.1 * u, dark); P.ell(X(-4.6), Y(2.2), 0.9 * u, 0.9 * u, 0x9a9ea6); P.ell(X(4.8), Y(2.2), 0.9 * u, 0.9 * u, 0x9a9ea6);
}
// a row of towers black against the sky along the foot, a window lit here and there
function skyline(P, x0, y1, w, h, seed, body = 0x10121c, lit = 0xffd66a) {
  const r = rnd(seed); let x = x0;
  while (x < x0 + w) { const bw = 3 + Math.floor(r() * 5), t = y1 - h * (0.4 + r() * 0.6); P.rect(x, t, Math.min(x + bw, x0 + w), y1, body); for (let y = t + 1; y < y1 - 1; y += 2) for (let a = x + 1; a < Math.min(x + bw, x0 + w) - 1; a += 2) if (r() < 0.3) P.dot(a, y, lit); x += bw; }
}

// ---- the three shows, drawn two pixels to a voxel (Will, 2026-11-25: "redo all of the larger ones in higher detail ...
// take some liberties with them to make them more dynamic and interesting, they're a little basic at the moment") ------
// Each is a whole scene on a canvas of its own: u is its unit (the picture is 40 of them high, or as wide as its subject
// needs on a narrow board), X and Y place a point from its middle; what is wider than the subject fills the long boards.
export const bez = (p, t) => { const m = 1 - t; return [m * m * m * p[0] + 3 * m * m * t * p[2] + 3 * m * t * t * p[4] + t * t * t * p[6], m * m * m * p[1] + 3 * m * m * t * p[3] + 3 * m * t * t * p[5] + t * t * t * p[7]]; };
export const disc = (P, cx, cy, rx, ry, c, a) => { const pts = []; for (let i = 0; i < 28; i++) pts.push([cx + Math.cos(i / 28 * 6.2832) * rx, cy + Math.sin(i / 28 * 6.2832) * ry]); P.poly(pts, c, a); };
export function scene(draw) { return (P, x0, y0, w, h) => { const A = pixels(Math.round(w), Math.round(h)); draw(A); for (let y = 0; y < A.H; y++) for (let x = 0; x < A.W; x++) { const i = (y * A.W + x) * 4; P.dot(x0 + x, y0 + y, [A.d[i], A.d[i + 1], A.d[i + 2]]); } }; }
// a row of flats along a line, k pixels to a window
function flats(P, y1, h, seed, body, lit, k = 1, share = 0.3) {
  const r = rnd(seed); let x = 0;
  while (x < P.W) { const bw = (3 + Math.floor(r() * 5)) * k * 2, t = Math.round(y1 - h * (0.35 + r() * 0.65)); P.rect(x, t, x + bw, y1, body); if (r() < 0.3) P.rect(x + bw / 2 - k / 2, t - 3 * k, x + bw / 2 + k / 2, t, body); for (let y = t + k; y < y1 - k; y += 2 * k) for (let a = x + k; a < x + bw - k; a += 2 * k) if (r() < share) P.rect(a, y, a + k, y + k, lit); x += bw; }
}
// a car from the side in some detail, turned by ang about its middle (under 0: its nose up), its nose to the right (flip:
// the left). o: body [light, mid, dark], stripe, checks, hat, spikes, tanks, dents
export function ride(P, cx, cy, u, ang, flip, o) {
  const [BL, BM, BD] = o.body, c = Math.cos(ang), s = Math.sin(ang), f = flip ? -1 : 1, ST = 0xc6ccd6, G = 0x8ec8ea, GL = 0xe2f6ff;
  const T = (a, b) => [cx + (a * c - b * s) * f * u, cy + (a * s + b * c) * u], Q = (pts, col, al) => P.poly(pts.map(([a, b]) => T(a, b)), col, al), D = (a, b, rr, col) => { const [x, y] = T(a, b); P.ell(x, y, rr * u, rr * u, col); };
  if (o.tanks) { Q([[-8.4, -4.6], [-5.4, -4.6], [-5.4, -2.6], [-8.4, -2.6]], 0x5cd8f0); Q([[-8.4, -4.6], [-5.4, -4.6], [-5.4, -4], [-8.4, -4]], 0xc8f6ff); Q([[-5.4, -4], [-4.6, -3.8], [-4.6, -3.2], [-5.4, -3]], ST); }
  Q([[-9, -1.4], [-8.4, -2.7], [3.2, -2.8], [8.3, -2.1], [9.3, -0.6], [9.3, 1.5], [-9, 1.5]], BM);
  Q([[-5.6, -2.7], [-3.9, -6.1], [1.7, -6.1], [4.2, -2.7]], BM); Q([[-3.9, -6.1], [1.7, -6.1], [2.1, -5.5], [-4.2, -5.5]], BL);
  Q([[-8.4, -2.7], [3.2, -2.8], [8.3, -2.1], [8.7, -1.5], [3.2, -2.1], [-8.7, -2]], BL); Q([[-9, 0.4], [9.3, 0.4], [9.3, 1.5], [-9, 1.5]], BD);
  Q([[-4.7, -2.9], [-3.5, -5.4], [-1.3, -5.4], [-1.3, -2.9]], G); Q([[-0.6, -2.9], [-0.6, -5.4], [1.4, -5.4], [3.3, -2.9]], G);
  Q([[-4, -3], [-3.1, -5.3], [-2.5, -5.3], [-3.4, -3]], GL); Q([[0.1, -3], [0.7, -5.3], [1.1, -5.3], [0.9, -3]], GL);
  if (o.dents) { Q([[-0.4, -5.2], [1.2, -4.2], [0.4, -3.9], [2.4, -3.1]].slice(0, 3), 0x3a5a70); Q([[0.4, -3.9], [2.4, -3.1], [1.1, -4.2]], 0x3a5a70); }
  if (o.stripe !== undefined) Q([[-8.9, -1.2], [9.3, -1], [9.3, -0.2], [-9, -0.3]], o.stripe);
  if (o.checks) for (let i = 0; i < 12; i++) Q([[-8.8 + i * 1.5, -1.2], [-8.8 + i * 1.5 + 0.75, -1.2], [-8.8 + i * 1.5 + 0.75, -0.3], [-8.8 + i * 1.5, -0.3]], 0x15171c);
  Q([[-1.1, -2.8], [-0.8, -2.8], [-0.8, 0.4], [-1.1, 0.4]], BD); Q([[-0.4, -1.9], [0.8, -1.9], [0.8, -1.5], [-0.4, -1.5]], ST);
  Q([[8.5, -1.6], [9.3, -1.3], [9.3, -0.3], [8.5, -0.3]], 0xfff6c0); Q([[-9, -1.3], [-8.3, -1.5], [-8.3, -0.4], [-9, -0.4]], 0xe2362a);
  Q([[8.9, 0.3], [10.1, 0.3], [10.1, 1.5], [8.9, 1.5]], ST); Q([[-9.9, 0.3], [-8.9, 0.3], [-8.9, 1.5], [-9.9, 1.5]], ST);
  if (o.dents) { Q([[4.6, -2.5], [6.8, -1.1], [6.1, -0.9]], BD); Q([[-7.6, -1.9], [-6, -0.2], [-6.5, 0]], BD); Q([[5.6, -2.5], [7.6, -3.2], [8.3, -2.1]], BL); Q([[2, 0.2], [3.4, -0.6], [3.2, 0.3]], BD); }
  if (o.spikes) for (const b of [-1.4, -0.1, 1.2]) Q([[9.6, b - 0.5], [12.4, b + 0.1], [9.6, b + 0.7]], ST);
  for (const a of [-5.3, 5.5]) { D(a, 1.9, 2.9, 0x0c0d12); D(a, 2.2, 2.4, 0x1c1e25); D(a, 2.2, 1.35, 0x9aa2ae); D(a, 2.2, 0.6, 0xe6eaf0); }
  if (o.hat) { Q([[-3.5, -6.7], [1.3, -6.7], [1.3, -6.1], [-3.5, -6.1]], 0x12131a); Q([[-2.5, -10.2], [0.3, -10.2], [0.3, -6.7], [-2.5, -6.7]], 0x12131a); Q([[-2.5, -7.7], [0.3, -7.7], [0.3, -6.9], [-2.5, -6.9]], 0xe2362a); Q([[-2.2, -10], [-1.8, -10], [-1.8, -7.9], [-2.2, -7.9]], 0x4a4e5c); }
  return T;
}
// WRECKED! THE MUSICAL: the curtain up on a stage, a battered cab in a top hat on its back wheels in the lights, the
// chorus line behind it, the front rows on their feet
function wreckedScene(P) {
  const { W, H } = P, u = Math.min(H / 40, W / 25), X = (v) => W / 2 + v * u, Y = (v) => H - (40 - v) * u, hw = W / 2 / u, r = rnd(5), k = Math.max(1, Math.round(u / 1.5)), px = Math.max(1, Math.round(u * 0.35)), GOLD = 0xf2c23a;
  P.fade(0, 0, W, Y(30), 0x140c3a, 0x7a2e8e, 7);
  for (let i = 0; i < W * 0.3; i++) P.over(r() * W, r() * Y(18), 0xffffff, 0.3 + r() * 0.6);
  P.glow(X(-12), Y(8), 11 * u, 0xfff2a8, 0.4, 5); P.ball(X(-12), Y(8), 4.6 * u, 4.6 * u, [0xfffbe0, 0xffeeb0, 0xf0cc70], -0.5, -0.5);
  flats(P, Y(30), 16 * u, 12, 0x2a1450, 0xffd66a, k, 0.3);
  P.fade(0, Y(30), W, H, 0xc88a44, 0x5a3418, 5);
  for (let i = -Math.ceil(hw / 5) - 8; i <= hw / 5 + 8; i++) P.line(X(i * 5), Y(30), X(i * 8.5), Y(41), px * 0.5, 0x4a2a12);
  P.rect(0, Y(30), W, Y(30) + px, 0x3a2010);
  for (const sx of [-hw * 0.55, hw * 0.55, 0]) P.poly([[X(sx - 1.5), 0], [X(sx + 1.5), 0], [X(9), Y(32.5)], [X(-9), Y(32.5)]], sx ? 0xfff2c0 : 0xffffff, 0.2);
  disc(P, X(0), Y(32.5), 14 * u, 2.6 * u, 0xfff6cf, 0.5);
  // the chorus, as many as the stage is wide
  const cw = Math.min(Math.max(7 * u, W * 0.1), W * 0.17), room = hw - cw / u - 7, tints = [[0xf0786a, 0xd8322a, 0x8a1418], [0x7ab0f4, 0x2a66d8, 0x163a8a], [0x8ee0a0, 0x2f9a58, 0x145a30], [0xd69af4, 0x8a45b8, 0x4a1f72]];
  let n = 0; for (let a = 16; a <= room; a += 13.5) for (const sd of [-1, 1]) { disc(P, X(sd * (a + 1.5)), Y(33), 6 * u, 1.1 * u, 0x1a0c06, 0.45); ride(P, X(sd * a), Y(27.2), u * 0.7, -0.6, sd > 0, { body: tints[(n++) % 4], hat: true, dents: true }); }
  // the star
  disc(P, X(-2), Y(34), 9 * u, 1.5 * u, 0x1a0c06, 0.5);
  ride(P, X(0.5), Y(23.4), u * 1.15, -0.72, false, { body: [0xffe27a, 0xf7c81e, 0xb98a10], checks: true, hat: true, dents: true });
  for (const [a, b, q] of [[-11, 9, 2.2], [12, 11, 2.6], [-8, 20, 1.5], [15, 22, 1.8], [3, 4, 1.6], [-15, 15, 1.4], [9, 28, 1.3], [18, 6, 1.2]]) P.star(X(a), Y(b), 0.35 * q * u * 0.5, q * u, 4, 0xffffff);
  for (let i = 0; i < hw * 1.1; i++) { const a = (r() - 0.5) * 2 * (hw - cw / u), x = X(a), y = Y(r() * 30), c = [0xff6ad8, 0x58e8ff, 0xffd84a, 0x7dff8a, 0xffffff][i % 5]; if (Math.abs(a) > 9 || y < Y(8)) P.rect(x, y, x + px, y + px * (1 + (i % 2)), c); }
  for (let i = 0; i < hw * 0.5; i++) { const a = (r() - 0.5) * 2 * (hw - cw / u - 2), b = 33.4 + r() * 3.6; P.line(X(a), Y(b), X(a + 1.6), Y(b + 0.5), px * 0.4, 0x2f7a3a); P.ell(X(a), Y(b), 0.75 * u, 0.7 * u, 0xe2243a); P.ell(X(a - 0.15), Y(b - 0.15), 0.3 * u, 0.3 * u, 0xff7a8a); }
  // the curtains, tied back, and the swags across the top
  const tie = Y(22);
  for (let y = 0; y < H; y++) { const edge = cw * (1 - 0.45 * Math.exp(-(((y - tie) / (5 * u)) ** 2))); for (let x = 0; x < edge; x++) { const fold = Math.sin(x / edge * 9.4 + 0.6 + y * 0.004), c = fold > 0.5 ? 0xe2343a : fold > -0.2 ? 0xb81c24 : fold > -0.7 ? 0x8a1218 : 0x5a0a10; P.dot(x, y, c); P.dot(W - 1 - x, y, c); } }
  for (const sd of [0, 1]) { const x0 = sd ? W - cw * 0.57 : 0, x1 = sd ? W : cw * 0.57; P.rect(x0, tie - 0.7 * u, x1, tie + 0.7 * u, GOLD); P.rect(x0, tie + 0.3 * u, x1, tie + 0.7 * u, 0xb98a10); const tx = sd ? x0 + 1.2 * u : x1 - 1.2 * u; P.poly([[tx - 0.5 * u, tie + 0.7 * u], [tx + 0.5 * u, tie + 0.7 * u], [tx + 0.9 * u, tie + 4 * u], [tx - 0.9 * u, tie + 4 * u]], GOLD); }
  const ns = Math.max(2, Math.round(W / (11 * u))), sw = W / ns;
  for (let i = 0; i < ns; i++) { const c = (i + 0.5) * sw; P.ell(c, 1.5 * u, sw / 2, 5.4 * u, GOLD, 1.5 * u); P.ell(c, 1.5 * u, sw / 2, 4.7 * u, 0xa8181e, 1.5 * u); P.ell(c, 1.5 * u, sw * 0.36, 3.3 * u, 0xc8242a, 1.5 * u); P.ell(c, 1.5 * u, sw * 0.2, 1.8 * u, 0xe2343a, 1.5 * u); }
  P.rect(0, 0, W, 1.5 * u, 0x6a0a12); P.rect(0, 1.5 * u, W, 1.5 * u + px, GOLD);
  // the footlights, and the house
  for (let a = -Math.floor(hw / 5) * 5; a <= hw; a += 5) { P.glow(X(a), Y(38.4), 3 * u, 0xfff2a8, 0.55, 3); P.ell(X(a), Y(38.6), 0.8 * u, 0.6 * u, 0xffffff); }
  for (let a = -hw - 2; a <= hw + 2; a += 3.2 + r() * 1.2) { const hr = 1.5 + r() * 0.6; P.ell(X(a), Y(40.4 - r()), hr * u, hr * u * 1.1, 0x14060c); if (r() < 0.35) P.line(X(a + 1.7), Y(40), X(a + 2.5 + r()), Y(36 - r() * 2), 0.45 * u, 0x14060c); }
}
// FIGHT NIGHT: the two of them meet nose to nose in the pit under the lights, both off their front wheels, a wheel gone
// over the wall, the stands on their feet
function fightScene(P) {
  const { W, H } = P, u = Math.min(H / 40, W / 31), X = (v) => W / 2 + v * u, Y = (v) => H - (40 - v) * u, hw = W / 2 / u, r = rnd(8), px = Math.max(1, Math.round(u * 0.4)), v0 = 40 - H / u;
  const tints = [0xd8322a, 0xf7c81e, 0x2a66d8, 0xf4f0e6, 0x2f9a58, 0xe0489a, 0xff7a1e, 0x9aa2ae];
  P.rect(0, 0, W, H, 0x05060f);
  const rows = Math.ceil((20.6 - v0) / 1.9);
  for (let j0 = 0; j0 < rows; j0++) { const j = Math.max(0, 11 - rows + j0), y0 = Math.round(Y(26.6 - (rows - j0) * 1.9)), y1 = Math.round(Y(26.6 - (rows - j0 - 1) * 1.9)); P.rect(0, y0, W, y1, j % 2 ? 0x16162c : 0x0e0e20); for (let x = (j % 2) * px; x < W; x += px * 2) if (r() < 0.84) { const dim = 0.5 - j * 0.03; P.rect(x, y0, x + px, y0 + px, mix(r() < 0.5 ? 0xe8b48a : 0x9a6a48, 0x0a0a18, dim)); P.rect(x, y0 + px, x + px, y1, mix(tints[Math.floor(r() * 8)], 0x0a0a18, dim)); } }
  P.rect(0, 0, W, Y(v0 + 4.4), 0x05060f); P.rect(0, Y(v0 + 4.4), W, Y(v0 + 6), 0x1c1e2c); for (let x = 0; x < W; x += 3 * u) P.line(x, Y(v0 + 4.4), x + 1.5 * u, Y(v0 + 6), px * 0.4, 0x343848);
  const rigs = hw > 40 ? [-hw * 0.66, 0, hw * 0.66] : hw < 18 ? [0] : [-hw * 0.6, hw * 0.6];
  for (const a of rigs) { P.poly([[X(a - 4), Y(v0 + 4)], [X(a + 4), Y(v0 + 4)], [X(a * 0.2 + 15), Y(33)], [X(a * 0.2 - 15), Y(33)]], 0xcfe0ff, 0.12); P.rect(X(a - 5), Y(v0 + 0.6), X(a + 5), Y(v0 + 4.4), 0x23263a); for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const x = X(a - 3.6 + i * 2.4), y = Y(v0 + 1.6 + j * 1.8); P.glow(x, y, 2.2 * u, 0xdfeaff, 0.5, 3); P.ell(x, y, 0.8 * u, 0.7 * u, 0xffffff); } }
  for (let i = 0; i < hw * 0.5; i++) P.star(X((r() - 0.5) * 2 * hw), Y(v0 + 7 + r() * (18 - v0)), 0.3 * u, (0.9 + r() * 1.1) * u, 4, 0xffffff);
  // the wall, the dirt
  P.rect(0, Y(26.6), W, Y(29.6), 0x2a2c33); P.rect(0, Y(26.6), W, Y(26.6) + px, 0x8a909c);
  for (let a = -Math.ceil(hw / 3) * 3 - 3; a < hw + 3; a += 3) P.poly([[X(a), Y(29.6)], [X(a + 1.5), Y(27.2)], [X(a + 3), Y(27.2)], [X(a + 1.5), Y(29.6)]], 0xf7c81e);
  P.fade(0, Y(29.6), W, H, 0x8a6238, 0x3a2414, 5);
  for (let i = 0; i < W * 0.5; i++) P.over(r() * W, Y(29.8 + r() * 10.2), r() < 0.5 ? 0x2a1a0e : 0xc8a070, 0.5);
  for (const sd of [-1, 1]) for (const b of [0, 2.4]) for (let t = 0; t < 1; t += 0.01) { const a = sd * (hw + 2 - t * (hw - 14)), y = 37 + b - t * 4 + Math.sin(t * 3) * 1.2; P.ell(X(a), Y(y), 0.5 * u, 0.4 * u, 0x2a1a0e); }
  for (const sd of [-1, 1]) for (let i = 0; i < 16; i++) { const a = sd * (19 + r() * 16), b = 25 + r() * 8, q = 1.6 + r() * 2.6; P.ball(X(a), Y(b), q * u, q * 0.85 * u, [0xd8c8aa, 0xa8987c, 0x74644e], -0.5, -0.6); }
  // the hit
  P.glow(X(0), Y(21), 22 * u, 0xffd84a, 0.5, 6);
  P.star(X(0), Y(21.4), 6 * u, 17 * u, 14, 0xff6a1e, 0.1); P.star(X(0), Y(21.4), 4.6 * u, 12.6 * u, 14, 0xffd84a, 0.33); P.star(X(0), Y(21.4), 2.4 * u, 7.5 * u, 10, 0xffffff, 0.05);
  for (const sd of [-1, 1]) disc(P, X(sd * 14), Y(33), 11 * u, 1.3 * u, 0x1a0e06, 0.5);
  ride(P, X(-12.4), Y(25.4), u, -0.3, false, { body: [0xe89a5a, 0xb5482a, 0x6a2412], stripe: 0x15171c, spikes: true, dents: true });
  ride(P, X(12.4), Y(25.4), u, -0.3, true, { body: [0x7ab0f4, 0x2a66d8, 0x163a8a], stripe: 0xffffff, tanks: true, dents: true });
  P.star(X(0), Y(22), 1.2 * u, 4.4 * u, 8, 0xffffff, 0.2);
  for (let i = 0; i < 26; i++) { const g = -3.14 * r(), d0 = (5 + r() * 6) * u, d1 = d0 + (2 + r() * 5) * u; P.line(X(0) + Math.cos(g) * d0, Y(22) + Math.sin(g) * d0, X(0) + Math.cos(g) * d1, Y(22) + Math.sin(g) * d1, px * 0.4, i % 3 ? 0xffe14a : 0xffffff); }
  for (let i = 0; i < 12; i++) { const g = -3.14 * r(), d = (9 + r() * 10) * u, x = X(0) + Math.cos(g) * d, y = Y(22) + Math.sin(g) * d * 0.9, q = (0.4 + r() * 0.5) * u; P.poly([[x - q, y - q * 0.4], [x + q * 0.6, y - q], [x + q, y + q * 0.5], [x - q * 0.5, y + q]], i % 2 ? 0x9aa2ae : 0x55595f); }
  // a wheel, and a bumper, on their way out
  for (let t = 0; t < 1; t += 0.03) { const [x, y] = bez([2, 20, 4, 12, 8, 7, 13, 6.5], t); P.over(X(x), Y(y), 0xffffff, 0.15 + t * 0.4); P.over(X(x) + px, Y(y), 0xffffff, 0.1 + t * 0.3); }
  P.ell(X(14), Y(6.6), 2.5 * u, 2.5 * u, 0x1c1e25); P.ell(X(14), Y(6.6), 1.4 * u, 1.4 * u, 0x9aa2ae); P.ell(X(14), Y(6.6), 0.6 * u, 0.6 * u, 0xe6eaf0);
  P.poly([[X(-10), Y(10)], [X(-5.4), Y(8.2)], [X(-5), Y(9.2)], [X(-9.4), Y(11.2)]], 0xc6ccd6); P.poly([[X(-10), Y(10)], [X(-9.4), Y(11.2)], [X(-10.6), Y(12.6)], [X(-11.2), Y(11.4)]], 0x9aa2ae);
  for (let a = -hw - 2; a <= hw + 2; a += 4.4 + r() * 3) { const hr = 1.7 + r() * 0.7; P.ell(X(a), Y(40.6 - r()), hr * u, hr * u * 1.1, 0x08080e); if (r() < 0.5) { P.line(X(a + 1.9), Y(40), X(a + 2.6 + r()), Y(35.4 - r() * 2), 0.5 * u, 0x08080e); P.ell(X(a + 2.9), Y(35), 0.8 * u, 0.8 * u, 0x08080e); } }
}
// NITRO COLA: the can gone off like a bomb: cola out of its top, a crown of it round its foot, ice and bolts thrown clear
function colaScene(P) {
  const { W, H } = P, u = Math.min(H / 40, W / 40), X = (v) => W / 2 + v * u, Y = (v) => H / 2 + (v - 20) * u, hw = W / 2 / u, r = rnd(77), px = Math.max(1, Math.round(u * 0.4));
  const CO = [0xd88a3a, 0x8a3c12, 0x451a08], FO = [0xffffff, 0xfff2d8, 0xe6c89a];
  P.fade(0, 0, W, H, 0xf2441e, 0x8a0c14, 7);
  const far = Math.hypot(W, H) / 2;
  for (let gy = 0; gy * 2.4 * u < H + 3 * u; gy++) for (let gx = 0; gx * 2.4 * u < W + 3 * u; gx++) { const x = (gx + (gy % 2) * 0.5) * 2.4 * u, y = gy * 2.4 * u, rr = (Math.hypot(x - X(0), y - Y(20)) / far - 0.42) * 1.9 * u; if (rr > 0.35) P.ell(x, y, Math.min(rr, 1.1 * u), Math.min(rr, 1.1 * u), 0xb81418); }
  for (let i = 0; i < 18; i++) { const a0 = i / 18 * 6.2832 + 0.15, a1 = (i + 0.5) / 18 * 6.2832 + 0.15, R = W + H; P.poly([[X(0), Y(20)], [X(0) + Math.cos(a0) * R, Y(20) + Math.sin(a0) * R], [X(0) + Math.cos(a1) * R, Y(20) + Math.sin(a1) * R]], 0xffc21e, 0.34); }
  P.glow(X(0), Y(19), 23 * u, 0xfff6c0, 0.6, 7);
  const bolt = (cx, cy, q, turn) => { const c = Math.cos(turn), s = Math.sin(turn), at = (m) => [[1, -8], [-3.4, 0.6], [-0.3, 0.6], [-1.5, 8], [3.6, -1.6], [0.6, -1.6]].map(([a, b]) => [cx + (a * c - b * s) * q * m, cy + (a * s + b * c) * q * m]); P.poly(at(1.16), 0x8a0c14); P.poly(at(1), 0xffe14a); P.poly(at(0.5), 0xfffbd0); };
  for (const [a, b, q, t] of [[-18, 11, 0.85, 0.5], [19, 26, 0.9, -0.4], [-hw * 0.7, 27, 1.05, -0.3], [hw * 0.7, 10, 1.05, 0.4]]) if (Math.abs(a) < hw - 3 && (Math.abs(a) > 15)) bolt(X(a), Y(b), q * u, t);
  // the crown of cola round its foot
  for (let i = -7; i <= 7; i++) { if (!i) continue; const sd = Math.sign(i), m = Math.abs(i), p = [sd * m * 1.3, 35, sd * (m * 2.2 + 1), 33 - (8 - m) * 1.2, sd * (m * 3.2 + 3), 30 - (8 - m) * 1.5, sd * (m * 3.9 + 5), 31.5 - (8 - m) * 0.9]; for (let t = 0; t <= 1; t += 0.03) { const [x, y] = bez(p, t), q = 1.9 * (1 - t) + 0.5; P.ball(X(x), Y(y), q * u, q * u, CO, -0.5, -0.6); } const [x, y] = bez(p, 1); P.ball(X(x + sd * 1.6), Y(y - 1 + (m % 3) * 0.8), 0.8 * u, 0.8 * u, CO, -0.5, -0.6); P.ball(X(x + sd * 3.2), Y(y + 0.6 - (m % 2) * 2), 0.5 * u, 0.5 * u, CO, -0.5, -0.6); }
  P.ball(X(0), Y(36.5), 17 * u, 4.2 * u, CO, -0.3, -0.7); for (let i = 0; i < 22; i++) { const a = (r() - 0.5) * 30, q = 0.7 + r() * 1.1; P.ball(X(a), Y(34 + r() * 2.4), q * 1.3 * u, q * u, FO, -0.4, -0.6); }
  // the can: each pixel asked where on the can it is (a across it, b along it)
  const ang = 0.26, cx = X(-0.5), cy = Y(19.5), c = Math.cos(ang), s = Math.sin(ang), T = (a, b) => [cx + (a * c - b * s) * u, cy + (a * s + b * c) * u];
  for (let y = Math.floor(cy - 15 * u); y <= cy + 15 * u; y++) for (let x = Math.floor(cx - 15 * u); x <= cx + 15 * u; x++) {
    const dx = (x + 0.5 - cx) / u, dy = (y + 0.5 - cy) / u, a = dx * c + dy * s, b = -dx * s + dy * c; if (Math.abs(a) > 6.5) continue;
    const cap = 1.7 * Math.sqrt(1 - (a / 6.5) ** 2), t = a / 6.5; let col = null;
    if ((a / 6.5) ** 2 + ((b + 11) / 1.7) ** 2 <= 1) col = (a / 5.5) ** 2 + ((b + 11) / 1.2) ** 2 <= 1 ? ((a - 0.4) ** 2 / 5 + (b + 11.1) ** 2 / 0.4 <= 1 ? 0x2a2e38 : 0xaab2be) : 0xe6eaf0;
    else if (b > -11 && b <= 11 + cap) {
      const bc = b - cap, base = bc < -10.7 ? 0xd6dce6 : bc > 9.5 ? 0x9aa2ae : bc > -4.6 && bc < 3.4 ? 0xffd84a : (bc > -5.4 && bc <= -4.6) || (bc >= 3.4 && bc < 4.2) ? 0xffffff : 0x1c2e5a;
      const f = t < -0.84 ? 0.6 : t < -0.62 ? 0.85 : t < -0.4 ? 1.4 : t < 0.3 ? 1 : t < 0.66 ? 0.78 : 0.55;
      col = f > 1 ? mix(base, 0xffffff, 0.45) : mix(base, 0x000000, 1 - f);
    }
    if (col !== null) P.dot(x, y, col);
  }
  const zig = (m, col) => P.poly([[1, -8], [-3.4, 0.6], [-0.3, 0.6], [-1.5, 8], [3.6, -1.6], [0.6, -1.6]].map(([a, b]) => T(a * 0.44 * m + 0.4, b * 0.44 * m + 1.1)), col); zig(1.25, 0x16233a); zig(1, 0xff5a1e);
  for (const b of [-8.6, -7.4, 6.6, 7.8]) for (let a = -5; a <= 5; a += 2) { const [x, y] = T(a, b + 1.7 * Math.sqrt(1 - (a / 6.5) ** 2)); P.rect(x, y, x + 1.1 * u, y + Math.max(1, 0.45 * u), b < 0 ? 0xffd84a : 0x5c7ac8); }
  for (let i = 0; i < 16; i++) { const [x, y] = T(-5.4 + r() * 10.8, -8.5 + r() * 18); P.ell(x, y, 0.5 * u, 0.7 * u, 0xcfeaff); P.dot(x - px * 0.5, y - px * 0.5, 0xffffff); }
  // out of its top
  const [mx, my] = T(0.4, -11.2), M = (x, y) => [(mx - W / 2) / u + x, (my - H) / u + 40 + y];
  const Yb = (v) => H - (40 - v) * u;   // (M gives units from the mouth in the X/Yb frame)
  for (const [p, q0] of [[[0, 0, 5, -9, 14, -11, 20, -2], 2.3], [[0, 0, -3, -10, -12, -10, -15, -1], 2], [[0, 0, 1, -7, 3, -11, 5, -13], 2.4], [[0, 0, 9, -3, 16, 0, 19, 7], 1.5]]) {
    for (let t = 0; t <= 1; t += 0.025) { const [a, b] = bez(p, t), [x, y] = M(a, b), q = q0 * (1 - t * 0.7); P.ball(X(x), Yb(y), q * u, q * u, CO, -0.5, -0.6); }
    const [a, b] = bez(p, 1), [x, y] = M(a, b); for (let i = 0; i < 5; i++) P.ball(X(x + (r() - 0.5) * 6), Yb(y + r() * 5), (0.4 + r() * 0.6) * u, (0.5 + r() * 0.7) * u, CO, -0.5, -0.6);
  }
  for (let i = 0; i < 12; i++) { const [x, y] = M((r() - 0.5) * 7, -1 + (r() - 0.5) * 3), q = 0.8 + r() * 1.1; P.ball(X(x), Yb(y), q * u, q * 0.9 * u, FO, -0.4, -0.6); }
  // ice, bubbles, drops
  const cube = (x, y, q, turn) => { const pt = (a, b) => [x + (a * Math.cos(turn) - b * Math.sin(turn)) * q, y + (a * Math.sin(turn) + b * Math.cos(turn)) * q]; P.poly([pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1)], 0xbfe6ff); P.poly([pt(-1, -1), pt(1, -1), pt(0.6, -0.5), pt(-0.6, -0.5)], 0xffffff); P.poly([pt(-0.6, -0.5), pt(0.6, -0.5), pt(0.6, 0.6), pt(-0.6, 0.6)], 0xe2f6ff); P.poly([pt(1, -1), pt(1, 1), pt(0.6, 0.6), pt(0.6, -0.5)], 0x8ec8ea); P.poly([pt(-1, 1), pt(1, 1), pt(0.6, 0.6), pt(-0.6, 0.6)], 0x7ab4dc); };
  for (const [a, b, q, t] of [[-13, 26, 2.2, 0.5], [13.5, 15, 1.9, -0.3], [-11, 5, 1.5, 0.9], [-hw * 0.5, 14, 2.4, 0.3], [hw * 0.5, 28, 2.4, -0.6], [-hw * 0.78, 30, 1.8, 1], [hw * 0.76, 20, 1.9, 0.2]]) if (Math.abs(a) < hw - 3) cube(X(a), Y(b), q * u, t);
  for (let i = 0; i < hw * 1.3; i++) { const x = X((r() - 0.5) * 2 * hw), y = Y(r() * 40), q = (0.5 + r() * 1.3) * u; if (Math.abs(x - cx) < 8 * u) continue; if (i % 3) { P.ell(x, y, q, q, 0xffd6a0); P.ell(x, y, q - px, q - px, 0xf2702e); P.dot(x - q * 0.4, y - q * 0.4, 0xffffff); } else P.ball(x, y, q * 0.7, q * 0.9, CO, -0.5, -0.6); }
}

// ---- the pictures: each draws in the box (x0, y0, w, h) of P ---------------------------------------------------------
const ART = {
  wrecked: scene(wreckedScene), fight: scene(fightScene), cola: scene(colaScene),
  // a slice: the crust up, the point down, pepperoni
  pizza(P, x0, y0, w, h) {
    const u = Math.min(w / 30, h / 26), cx = x0 + w / 2, cy = y0 + h / 2;
    P.rect(x0, y0, x0 + w, y0 + h, 0x1e6a3c);
    for (let y = y0; y < y0 + h; y += Math.max(3, Math.round(4 * u))) for (let x = x0 + (Math.floor((y - y0) / Math.max(3, Math.round(4 * u))) % 2 ? 0 : Math.max(3, Math.round(4 * u))); x < x0 + w; x += Math.max(6, Math.round(8 * u))) P.rect(x, y, x + Math.max(3, Math.round(4 * u)), y + Math.max(3, Math.round(4 * u)), 0x237a46);
    P.poly([[cx - 12 * u, cy - 9 * u], [cx + 12 * u, cy - 9 * u], [cx, cy + 12 * u]], 0xf6c64a); P.rect(cx - 13 * u, cy - 11.5 * u, cx + 13 * u, cy - 8 * u, 0xc98f3e); P.rect(cx - 12 * u, cy - 11.5 * u, cx + 12 * u, cy - 10.5 * u, 0xe0ac58);
    for (const [a, b] of [[-5, -4], [4, -5], [0, 1], [-2, -7.5 + 3], [2.5, 4.5 - 4]]) P.ell(cx + a * u, cy + b * u, 1.9 * u, 1.9 * u, 0xb8281e);
    P.ell(cx - 0.5 * u, cy + 6 * u, 1.3 * u, 1.3 * u, 0xb8281e);
  },
  // a yellow cab, a row of black and white squares along it, the town behind
  taxi(P, x0, y0, w, h) {
    const u = Math.min(w / 30, h / 22), cx = x0 + w / 2, by = y0 + h;
    bands(P, x0, y0, w, h, 0x241a4a, 0xe8763a); skyline(P, x0, by - 4 * u, w, h * 0.55, 31);
    P.rect(x0, by - 4 * u, x0 + w, by, 0x2a2c33); for (let x = x0 + 1; x < x0 + w; x += Math.max(4, Math.round(6 * u))) P.rect(x, by - 2 * u, x + Math.max(2, Math.round(3 * u)), by - 2 * u + 1, 0xf2ead8);
    car(P, cx, by - 6.5 * u, u * 1.25, 0xf7c81e);
    for (let i = -4; i < 4; i++) P.rect(cx + i * 1.25 * u, by - 7 * u, cx + (i + 1) * 1.25 * u, by - 7 * u + Math.max(1, u), (i + 8) % 2 ? 0x15171c : 0xffffff);
    P.rect(cx - 2 * u, by - 14.4 * u, cx + u, by - 12.8 * u, 0xfff2a8);
  },
  // a hot dog, a line of mustard down it
  hotdog(P, x0, y0, w, h) {
    const u = Math.min(w / 34, h / 20), cx = x0 + w / 2, cy = y0 + h / 2;
    for (let x = x0; x < x0 + w; x++) P.rect(x, y0, x + 1, y0 + h, Math.floor((x - x0) / Math.max(3, Math.round(4 * u))) % 2 ? 0xfff2d8 : 0xe2362a);
    P.ell(cx, cy + 2 * u, 14 * u, 5 * u, 0xe6b05a); P.ell(cx, cy - 0.5 * u, 15.5 * u, 3.2 * u, 0xb8452e); P.ell(cx, cy - 1.2 * u, 14.5 * u, 1.6 * u, 0xd05a3a); P.ell(cx, cy + 4.5 * u, 14 * u, 3.6 * u, 0xf0c070);
    for (let i = -12; i <= 12; i++) P.rect(cx + i * u, cy - 1 * u + (Math.abs(i) % 4 < 2 ? -1 : 0) * u * 0.8, cx + i * u + Math.max(1, u), cy - 1 * u + (Math.abs(i) % 4 < 2 ? -1 : 0) * u * 0.8 + Math.max(1, u * 0.9), 0xffe14a);
  },
  // a paper cup, steam off it
  coffee(P, x0, y0, w, h) {
    const u = Math.min(w / 26, h / 26), cx = x0 + w / 2, cy = y0 + h / 2;
    bands(P, x0, y0, w, h, 0x1a3a7a, 0x10224a);
    P.poly([[cx - 7 * u, cy - 5 * u], [cx + 7 * u, cy - 5 * u], [cx + 5 * u, cy + 11 * u], [cx - 5 * u, cy + 11 * u]], 0xf4f0e6); P.rect(cx - 8 * u, cy - 7 * u, cx + 8 * u, cy - 5 * u, 0xffffff);
    P.poly([[cx - 6.6 * u, cy - u], [cx + 6.6 * u, cy - u], [cx + 5.8 * u, cy + 5 * u], [cx - 5.8 * u, cy + 5 * u]], 0xc8842e);
    for (const a of [-3, 0, 3]) for (let i = 0; i < 5; i++) P.ell(cx + a * u + Math.sin(i * 1.6 + a) * u, cy - 8 * u - i * 1.4 * u, 0.7 * u, 0.7 * u, 0xb8c8e8);
  },
  // the radio: a torch with rings going out from its flame
  radio(P, x0, y0, w, h) {
    const u = Math.min(w / 30, h / 26), cx = x0 + w / 2, cy = y0 + h / 2;
    bands(P, x0, y0, w, h, 0x0c2a2e, 0x1c5a5a);
    for (const rr of [12, 9, 6]) { P.ell(cx, cy - 5 * u, rr * u, rr * u, 0x7fe0d0, -1e9, cy - 3 * u); P.ell(cx, cy - 5 * u, (rr - 1.1) * u, (rr - 1.1) * u, mix(0x0c2a2e, 0x1c5a5a, 0.3), -1e9, cy - 3 * u); }
    P.poly([[cx - 2.4 * u, cy - 2 * u], [cx + 2.4 * u, cy - 2 * u], [cx + 1.2 * u, cy + 11 * u], [cx - 1.2 * u, cy + 11 * u]], 0x6fb8a4); P.rect(cx - 3.4 * u, cy - 3.4 * u, cx + 3.4 * u, cy - 2 * u, 0x8fd8c4);
    P.poly([[cx - 2.6 * u, cy - 3.4 * u], [cx, cy - 10 * u], [cx + 2.6 * u, cy - 3.4 * u]], 0xffb21e); P.poly([[cx - 1.3 * u, cy - 3.4 * u], [cx, cy - 7.4 * u], [cx + 1.3 * u, cy - 3.4 * u]], 0xfff2a8);
  },
  // the paper: a front page, a headline and a picture
  news(P, x0, y0, w, h) {
    const u = Math.min(w / 30, h / 26), cx = x0 + w / 2, cy = y0 + h / 2;
    P.rect(x0, y0, x0 + w, y0 + h, 0x9a1c1c);
    P.rect(cx - 10 * u, cy - 11 * u, cx + 10 * u, cy + 11 * u, 0xf2ead8); P.rect(cx - 8.5 * u, cy - 9.5 * u, cx + 8.5 * u, cy - 6 * u, 0x15171c);
    P.rect(cx - 8.5 * u, cy - 4.5 * u, cx - 0.5 * u, cy + 3 * u, 0x7a8088); skyline(P, cx - 8.5 * u, cy + 3 * u, 8 * u, 6 * u, 9, 0x2a2c33, 0xf2ead8);
    for (let y = cy - 4.5 * u; y < cy + 9.5 * u; y += Math.max(2, 1.6 * u)) { if (y < cy + 3.4 * u) P.rect(cx + 0.8 * u, y, cx + 8.5 * u, y + Math.max(1, 0.6 * u), 0x55595f); else P.rect(cx - 8.5 * u, y, cx + 8.5 * u, y + Math.max(1, 0.6 * u), 0x55595f); }
  },
  // the scrap yard: a crown over a heap of cars
  scrap(P, x0, y0, w, h) {
    const u = Math.min(w / 34, h / 24), cx = x0 + w / 2, by = y0 + h;
    bands(P, x0, y0, w, h, 0xf2b21e, 0xe07a14);
    car(P, cx - 7 * u, by - 3.5 * u, u * 0.8, 0x6a7078); car(P, cx + 7 * u, by - 3.5 * u, u * 0.8, 0x8a4a2e, true); car(P, cx, by - 9.5 * u, u * 0.8, 0x3f5a7a);
    P.poly([[cx - 6 * u, by - 14 * u], [cx - 6 * u, by - 20 * u], [cx - 3 * u, by - 17 * u], [cx, by - 21 * u], [cx + 3 * u, by - 17 * u], [cx + 6 * u, by - 20 * u], [cx + 6 * u, by - 14 * u]], 0x15171c);
  },
};
// title (short: for a board too narrow for it), the line under it, the band's colour and the letters'
const DEF = {
  wrecked: ['WRECKED!', 'SHOW', 'THE MUSICAL', 0x15090a, 0xffd84a],
  fight: ['FIGHT NIGHT', 'FIGHT', 'RUST VS NITRO', 0x0b0d18, 0xff4a3a],
  cola: ['NITRO COLA', 'COLA', 'TASTE THE BOOM', 0x16233a, 0xffffff],
  pizza: ['PIZZA', 'PIZZA', 'SLICE $1', 0xb8281e, 0xfff2d8],
  taxi: ['TAXI', 'TAXI', 'CALL A CAB', 0x15171c, 0xf7c81e],
  hotdog: ['HOT DOGS', 'DOGS', 'ALL NIGHT', 0x1a2a66, 0xffe14a],
  coffee: ['COFFEE', 'CUP', '24 HOURS', 0xf4f0e6, 0x1a3a7a],
  radio: ['LIBERTY FM', 'RADIO', '99.9 ON AIR', 0x0c2a2e, 0xb8fff0],
  news: ['EXTRA!', 'NEWS', 'EMPIRE POST', 0xf2ead8, 0x15171c],
  scrap: ['SCRAP KING', 'SCRAP', 'WE BUY WRECKS', 0x15171c, 0xf2b21e],
};
export const FILMS = ['wrecked', 'fight', 'cola'];
export const POSTERS = Object.keys(DEF);
// a poster W0 by H0 voxels: the title in a band across its top (down its side on a narrow one), the picture, a line at
// the foot. s: pixels to a voxel (2 for the great boards, which are seen close: the rect on the sheet stays W0 by H0)
export function poster(kind, W0, H0, s = 1) {
  const [title, short, sub, band, ink] = DEF[kind], W = W0 * s, H = H0 * s, P = pixels(W, H, band); P.s = s;
  const k0 = latinW(title, 3) + 8 <= W0 && H0 >= 80 ? 3 : latinW(title, 2) + 6 <= W0 && H0 >= 50 ? 2 : 1, k = k0 * s;
  if (latinW(title, k0) + 4 <= W0) {
    const bh = (7 * k0 + 4) * s, q0 = H0 >= 80 ? 2 : 1, q = s > 1 && q0 > 1 ? 3 : q0 * s, foot = latinW(sub, q0) + 4 <= W0 && H0 >= 36 ? 7 * q + 4 * s : 0;
    ART[kind](P, 0, bh, W, H - bh - foot);
    P.rect(0, 0, W, bh, band); if (k >= 4) centred(P, title, 2 * s + (k >> 1), 0x000000, { k }); centred(P, title, 2 * s, ink, { k });
    if (k >= 4) P.bevel(0, 0, W, bh, ink, mix(ink, 0xffffff, 0.55), mix(ink, 0x000000, 0.4), k >> 2);
    if (foot) { P.rect(0, H - foot, W, H, band); centred(P, sub, H - foot + 2 * s, ink, { k: q }); }
  } else {
    const word = latinH(title) + 4 <= H0 ? title : short;
    ART[kind](P, 9 * s, 0, W - 9 * s, H); P.rect(0, 0, 9 * s, H, band); label(P, word, 2 * s, Math.max(2, Math.round((H0 - latinH(word)) / 2)) * s, ink, { down: true, k: s });
  }
  P.rect(0, 0, W, s, band); P.rect(0, H - s, W, H, band); P.rect(0, 0, s, H, band); P.rect(W - s, 0, W, H, band);
  return P;
}
