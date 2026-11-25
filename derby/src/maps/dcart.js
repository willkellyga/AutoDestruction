// Capital Circuit's flags, banners and posters (Will, 2026-11-25: "the same final pass to both washington DC and New
// York"). Washington has no neon and no roof billboards: what it hangs out is flags, banners down the fronts of its
// museums, bunting, and at election time a poster in every window. As the other cities' (maps/tokyoart.js,
// maps/nycart.js) every picture is drawn here a voxel to a pixel, with made-up names; no font or image is loaded.
//   - the flags: the Stars and Stripes, and the District's (three red stars over two red bars);
//   - banners, the word down them under a small picture: the museums (SPACE, DINOS, ART, ZOO), the festival
//     (BLOSSOM, KITES), the race, and VOTE;
//   - posters for the walls: campaign posters for the game's own rivals, the museums' shows, the blossom festival;
//   - the great boards (FILMS): the Capital Grand Prix, the Cherry Blossom Festival, the Space Museum.
import { pixels } from './tokyoart.js';
import { label, latinW, latinH, centred } from './latin.js';
import { ride, disc, bez, scene } from './nycart.js';

const RED = 0xb22234, BLUE = 0x2a3a78, WHITE = 0xf6f3ea, NAVY = 0x16224a, GOLD = 0xe8b830;
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => { const p = hex(a), q = hex(b); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]; };
const bands = (P, x0, y0, w, h, top, foot, n = 6) => { for (let y = 0; y < h; y++) P.rect(x0, y0 + y, x0 + w, y0 + y + 1, mix(top, foot, Math.min(1, Math.floor(y / h * n) / (n - 1)))); };
const rnd = (seed) => { let s = seed | 0; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; }; };
const star = (P, cx, cy, r, c) => P.poly([[0, -1], [0.25, -0.3], [0.95, -0.3], [0.4, 0.12], [0.6, 0.82], [0, 0.4], [-0.6, 0.82], [-0.4, 0.12], [-0.95, -0.3], [-0.25, -0.3]].map(([a, b]) => [cx + a * r, cy + b * r]), c);

// ---- flags ----------------------------------------------------------------------------------------------------------
export function flagUS(W = 26, H = 14) {
  const P = pixels(W, H, WHITE);
  for (let i = 0; i < 7; i++) P.rect(0, i * 2, W, i * 2 + 1, RED);
  P.rect(0, 0, 11, 7, BLUE); for (let y = 1; y < 7; y += 2) for (let x = 1; x < 10; x += 2) P.dot(x + (y % 4 === 1 ? 0 : 1), y, WHITE);
  return P;
}
export function flagDC(W = 26, H = 14) {
  const P = pixels(W, H, WHITE);
  P.rect(0, 6, W, 8, 0xd8262c); P.rect(0, 10, W, 12, 0xd8262c); for (const x of [6, 13, 20]) star(P, x, 3, 2.6, 0xd8262c);
  return P;
}

// ---- the small pictures: each draws in the box (x0, y0, w, h) ---------------------------------------------------------
const ART = {
  rocket(P, x0, y0, w, h) {
    const u = Math.min(w / 16, h / 26), cx = x0 + w / 2, cy = y0 + h / 2;
    P.poly([[cx, cy - 12 * u], [cx + 3.4 * u, cy - 6 * u], [cx - 3.4 * u, cy - 6 * u]], 0xd8262c); P.rect(cx - 3.4 * u, cy - 6 * u, cx + 3.4 * u, cy + 6 * u, WHITE); P.rect(cx - 3.4 * u, cy - 1 * u, cx + 3.4 * u, cy + 0.6 * u, 0x15171c);
    P.ell(cx, cy - 3.4 * u, 1.5 * u, 1.5 * u, 0x7fc4ee); P.poly([[cx - 3.4 * u, cy + 2 * u], [cx - 6.4 * u, cy + 7 * u], [cx - 3.4 * u, cy + 6 * u]], 0xd8262c); P.poly([[cx + 3.4 * u, cy + 2 * u], [cx + 6.4 * u, cy + 7 * u], [cx + 3.4 * u, cy + 6 * u]], 0xd8262c);
    P.poly([[cx - 2.4 * u, cy + 6 * u], [cx + 2.4 * u, cy + 6 * u], [cx, cy + 12 * u]], 0xffb21e); P.poly([[cx - 1.2 * u, cy + 6 * u], [cx + 1.2 * u, cy + 6 * u], [cx, cy + 9.4 * u]], 0xfff2a8);
  },
  // a great lizard's bones: skull, a row of ribs, a tail
  dino(P, x0, y0, w, h) {
    const u = Math.min(w / 30, h / 18), cx = x0 + w / 2, cy = y0 + h / 2, B = 0xf2ead8;
    P.line(cx - 12 * u, cy + 2 * u, cx + 6 * u, cy - 2 * u, 0.7 * u, B); P.line(cx + 6 * u, cy - 2 * u, cx + 10 * u, cy - 6 * u, 0.7 * u, B);
    P.ell(cx + 11.5 * u, cy - 6.5 * u, 3 * u, 2 * u, B); P.rect(cx + 11 * u, cy - 5.6 * u, cx + 14.6 * u, cy - 4.8 * u, 0x15171c); P.dot(cx + 11 * u, cy - 7.4 * u, 0x15171c);
    for (let i = -6; i <= 4; i += 2) P.line(cx + i * u, cy + (0.6 - i * 0.2) * u, cx + (i - 0.6) * u, cy + 5 * u, 0.4 * u, B);
    P.line(cx - 4 * u, cy + 4 * u, cx - 5 * u, cy + 8 * u, 0.6 * u, B); P.line(cx + 3 * u, cy + 2 * u, cx + 3 * u, cy + 8 * u, 0.6 * u, B);
  },
  // a picture in a gold frame
  art(P, x0, y0, w, h) {
    const u = Math.min(w / 20, h / 20), cx = x0 + w / 2, cy = y0 + h / 2;
    P.rect(cx - 8 * u, cy - 8 * u, cx + 8 * u, cy + 8 * u, GOLD); P.rect(cx - 6.4 * u, cy - 6.4 * u, cx + 6.4 * u, cy + 6.4 * u, 0x8fc4e8); P.rect(cx - 6.4 * u, cy + 2 * u, cx + 6.4 * u, cy + 6.4 * u, 0x5a9a4a);
    P.ell(cx + 3 * u, cy - 3 * u, 1.8 * u, 1.8 * u, 0xfff2a8); P.poly([[cx - 6.4 * u, cy + 2 * u], [cx - 2 * u, cy - 3 * u], [cx + 2 * u, cy + 2 * u]], 0x6a7a9a);
  },
  panda(P, x0, y0, w, h) {
    const u = Math.min(w / 20, h / 20), cx = x0 + w / 2, cy = y0 + h / 2, K = 0x15171c;
    P.ell(cx - 5.4 * u, cy - 5.6 * u, 2.6 * u, 2.6 * u, K); P.ell(cx + 5.4 * u, cy - 5.6 * u, 2.6 * u, 2.6 * u, K); P.ell(cx, cy, 7.4 * u, 6.8 * u, WHITE);
    P.ell(cx - 3 * u, cy - 0.6 * u, 2 * u, 2.4 * u, K); P.ell(cx + 3 * u, cy - 0.6 * u, 2 * u, 2.4 * u, K); P.ell(cx - 2.8 * u, cy - 0.8 * u, 0.7 * u, 0.7 * u, WHITE); P.ell(cx + 2.8 * u, cy - 0.8 * u, 0.7 * u, 0.7 * u, WHITE);
    P.ell(cx, cy + 2.4 * u, 1.3 * u, 0.9 * u, K);
  },
  // a branch in blossom
  blossom(P, x0, y0, w, h) {
    const u = Math.min(w / 24, h / 20), cx = x0 + w / 2, cy = y0 + h / 2;
    P.line(cx - 11 * u, cy + 8 * u, cx + 2 * u, cy - 1 * u, 0.8 * u, 0x4a2f22); P.line(cx + 2 * u, cy - 1 * u, cx + 10 * u, cy - 6 * u, 0.6 * u, 0x4a2f22); P.line(cx - 3 * u, cy + 2.4 * u, cx - 5 * u, cy - 6 * u, 0.5 * u, 0x4a2f22);
    for (const [a, b, r] of [[-5, -7, 2.6], [3, -2, 3], [10, -7, 2.6], [-9, 6, 2.4], [-1, 3, 2.2], [6, -6, 2], [-6, -2, 2]]) { for (let k = 0; k < 5; k++) P.ell(cx + a * u + Math.cos(k * 1.257) * r * 0.6 * u, cy + b * u + Math.sin(k * 1.257) * r * 0.6 * u, r * 0.55 * u, r * 0.55 * u, k % 2 ? 0xffb6cc : 0xff9cba); P.ell(cx + a * u, cy + b * u, 0.6 * u, 0.6 * u, 0xfff2a8); }
  },
  kite(P, x0, y0, w, h) {
    const u = Math.min(w / 18, h / 24), cx = x0 + w / 2, cy = y0 + h / 2 - 2 * u;
    P.poly([[cx, cy - 8 * u], [cx + 6 * u, cy], [cx, cy + 5 * u]], 0xd8262c); P.poly([[cx, cy - 8 * u], [cx - 6 * u, cy], [cx, cy + 5 * u]], 0xf2b21e);
    for (let i = 0; i < 6; i++) P.rect(cx + Math.sin(i * 1.3) * 1.6 * u, cy + (5.5 + i * 1.3) * u, cx + Math.sin(i * 1.3) * 1.6 * u + Math.max(1, u), cy + (6.5 + i * 1.3) * u, i % 2 ? 0x2a66d8 : WHITE);
  },
  // a chequered flag
  race(P, x0, y0, w, h) {
    const u = Math.min(w / 20, h / 20), cx = x0 + w / 2, cy = y0 + h / 2, q = Math.max(1, Math.round(2 * u));
    P.rect(cx - 7 * u, cy - 8 * u, cx - 6 * u, cy + 9 * u, 0x9a9ea6);
    for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) P.rect(cx - 6 * u + i * q, cy - 8 * u + j * q, cx - 6 * u + (i + 1) * q, cy - 8 * u + (j + 1) * q, (i + j) % 2 ? 0x15171c : WHITE);
  },
  // a box with a paper going into it
  vote(P, x0, y0, w, h) {
    const u = Math.min(w / 20, h / 20), cx = x0 + w / 2, cy = y0 + h / 2;
    P.rect(cx - 7 * u, cy - 1 * u, cx + 7 * u, cy + 8 * u, BLUE); P.rect(cx - 4 * u, cy - 1 * u, cx + 4 * u, cy, 0x15171c); P.poly([[cx - 3 * u, cy - 1 * u], [cx - 1 * u, cy - 8 * u], [cx + 4 * u, cy - 6.6 * u], [cx + 3 * u, cy - 1 * u]], WHITE);
    star(P, cx, cy + 4 * u, 2.6 * u, WHITE);
  },
  prix: scene(prixScene), festival: scene(festivalScene), space: scene(spaceScene),
};
// ---- the three great boards, drawn two pixels to a voxel (Will, 2026-11-25: "redo all of the larger ones in higher
// detail ... take some liberties with them to make them more dynamic and interesting") --------------------------------
// As New York's (maps/nycart.js): each a whole scene on its own canvas, u its unit (40 of them up the picture, fewer on
// a narrow board so its subject still fits), X and Y from the middle of its foot, v0 the top of the canvas in units.
const MARBLE = [0xffffff, 0xeceef4, 0xcfd4e0, 0xa4acbe];
// THE CAPITAL GRAND PRIX: three cars flat out past the Capitol, bunting over the road, the flag out
function prixScene(P) {
  const { W, H } = P, u = Math.min(H / 40, W / 25), X = (v) => W / 2 + v * u, Y = (v) => H - (40 - v) * u, hw = W / 2 / u, v0 = 40 - H / u, r = rnd(31), px = Math.max(1, Math.round(u * 0.4)), M = MARBLE, C = (v) => Y(v + 3);
  const box = (x0, y0, x1, y1, c) => P.rect(X(x0), C(y0), X(x1), C(y1), c);
  P.fade(0, 0, W, Y(30), 0x3a8ae0, 0xd6ecfa, 8);
  P.glow(X(hw * 0.55), Y(v0 + 7), 17 * u, 0xfff6c0, 0.55, 6);
  for (const [a, b, q] of [[-15, 8, 1.2], [15, 13, 0.9], [-hw * 0.78, 16, 1], [hw * 0.82, 6, 1.1], [4, v0 + 3.4, 0.8], [-6, v0 + 12, 1.1], [9, v0 + 22, 1]]) if (Math.abs(a) < hw + 3 && b < 18) for (const [dx, dy, rr] of [[-3, 0.4, 1.6], [-1, -0.6, 2.2], [1.6, -0.2, 1.9], [3.6, 0.5, 1.3], [0.4, 0.8, 2.4]]) P.ball(X(a + dx * q), Y(b + dy * q), rr * q * u * 1.3, rr * q * u, [0xffffff, 0xf2f6fc, 0xcfdcee], -0.3, -0.7);
  if (hw > 26) { const x = -hw * 0.7; P.poly([[X(x - 1), Y(29)], [X(x - 0.7), Y(11.6)], [X(x), Y(10.2)], [X(x + 0.7), Y(11.6)], [X(x + 1), Y(29)]], 0xf0f0ee); P.poly([[X(x), Y(10.2)], [X(x + 0.7), Y(11.6)], [X(x + 1), Y(29)], [X(x), Y(29)]], 0xcfd0d6); }
  P.ell(X(0), Y(33), Math.max(hw, 30) * u * 1.3, 5.4 * u, 0x5aa04a); P.ell(X(0), Y(33.6), Math.max(hw, 30) * u * 1.3, 5.4 * u, 0x4a8e3e);
  // the Capitol: wings, the porch and its steps, the drum and the dome
  for (const sd of [-1, 1]) {
    const a0 = sd < 0 ? -21 : 8, a1 = sd < 0 ? -8 : 21;
    box(a0, 19.5, a1, 26, M[1]); box(a0 + 0.5, 20.4, a1 - 0.5, 25.4, M[3]); for (let x = a0 + 0.7; x < a1 - 0.6; x += 1.3) box(x, 20.4, x + 0.6, 25.4, M[0]); box(a0 - 0.3, 19.2, a1 + 0.3, 20.2, M[0]); box(a0, 25.4, a1, 26, M[2]);
    const e0 = sd < 0 ? -21.6 : 17.4; box(e0, 18.4, e0 + 4.2, 26, M[1]); P.poly([[X(e0 - 0.3), C(18.4)], [X(e0 + 2.1), C(16.8)], [X(e0 + 4.5), C(18.4)]], M[0]); box(e0 + 0.5, 19.4, e0 + 3.7, 25.4, M[3]); for (let x = e0 + 0.6; x < e0 + 3.6; x += 1.1) box(x, 19.4, x + 0.6, 25.4, M[0]);
  }
  box(-5.6, 10.6, 5.6, 14.6, M[3]); for (let x = -5.3; x < 5.2; x += 1.1) box(x, 10.8, x + 0.55, 14.6, x > 2.4 ? M[1] : M[0]); box(-6, 10, 6, 10.8, M[0]); box(-6.3, 14.4, 6.3, 15.4, M[1]);
  box(-4.6, 7.8, 4.6, 10, M[1]); for (let x = -4; x < 3.8; x += 1.3) box(x, 8.4, x + 0.6, 9.6, M[3]);
  P.ball(X(0), C(7.9), 4.5 * u, 6.4 * u, M, -0.5, -0.5, -1e9, C(7.9));
  for (const f of [-0.8, -0.45, 0, 0.45, 0.8]) for (let g = 0; g < 1.5; g += 0.02) P.dot(X(4.5 * f * Math.cos(g)), C(7.9 - 6.4 * Math.sin(g)), f > 0.3 ? M[3] : M[2]);
  box(-1, -0.4, 1, 1.9, M[1]); for (const x of [-0.6, 0.1]) box(x, 0, x + 0.45, 1.5, M[3]); P.ell(X(0), C(-0.4), 1.15 * u, 1.05 * u, M[0], -1e9, C(-0.4)); box(-0.22, -2.7, 0.22, -1.3, 0x5a7a6a);
  box(-8, 17.5, 8, 26, M[1]); box(-7.5, 18.2, 7.5, 25.4, M[3]); for (let x = -7.2; x < 7; x += 1.6) { box(x, 18.2, x + 0.7, 25.4, M[0]); box(x + 0.5, 18.2, x + 0.7, 25.4, M[2]); }
  P.poly([[X(-8.7), C(17.6)], [X(0), C(14.2)], [X(8.7), C(17.6)]], M[0]); P.poly([[X(-6.4), C(17.1)], [X(0), C(15)], [X(6.4), C(17.1)]], M[2]); box(-8.7, 17.4, 8.7, 18.2, M[0]);
  P.poly([[X(-6.4), C(25.4)], [X(6.4), C(25.4)], [X(9.6), C(28)], [X(-9.6), C(28)]], M[1]); for (let y = 25.9; y < 28; y += 0.55) P.rect(X(-6.4 - (y - 25.4) * 1.23), C(y), X(6.4 + (y - 25.4) * 1.23), C(y) + Math.max(1, px * 0.5), M[2]);
  // trees along the hill: the cherries are out
  for (let a = -hw - 2; a <= hw + 2; a += 1.9 + r() * 1.2) { const q = 1.5 + r() * 1.1, b = 30.6 - r() * 0.8, pink = r() < 0.4; if (Math.abs(a) < 10.5) continue; P.rect(X(a) - px * 0.5, Y(b), X(a) + px * 0.5, Y(b + q + 0.6), 0x4a2f22); P.ball(X(a), Y(b), q * u, q * 0.9 * u, pink ? [0xffe0ea, 0xffb0cc, 0xe07ea4] : [0x8ed06a, 0x4a9a3e, 0x2a6a2c], -0.4, -0.7); }
  // the road
  P.rect(0, Y(32.4), W, Y(33.2), 0x3a7a34);
  for (let a = -Math.ceil(hw / 2) * 2 - 2, i = 0; a < hw + 2; a += 2, i++) P.poly([[X(a + 0.5), Y(33.2)], [X(a + 2.5), Y(33.2)], [X(a + 2), Y(34)], [X(a), Y(34)]], i % 2 ? 0xe2362a : 0xffffff);
  P.fade(0, Y(34), W, H, 0x555a66, 0x2a2c34, 5); P.rect(0, Y(34), W, Y(34) + px, 0xf4f0e6);
  for (let i = 0; i < hw * 1.2; i++) { const x = r() * W, y = Y(34.6 + r() * 4), l = (2 + r() * 6) * u; for (let d = 0; d < l; d++) P.over(x + d, y, 0xffffff, 0.16); }
  for (let a = -Math.ceil(hw / 3) * 3 - 3, i = 0; a < hw + 3; a += 3, i++) P.poly([[X(a + 0.8), Y(38.9)], [X(a + 3.8), Y(38.9)], [X(a + 3), Y(40.2)], [X(a), Y(40.2)]], i % 2 ? 0xe2362a : 0xffffff);
  const wake = (a, b, q) => { for (let i = 0; i < 7; i++) { const y = Y(b - 4.5 * q + i * 1.2 * q), l = (5 + ((i * 7) % 5) * 2.2) * q * u; for (let d = 0; d < l; d++) P.over(X(a - 9 * q) - d, y, 0xffffff, 0.55 * (1 - d / l)); } for (let i = 0; i < 6; i++) { const rr = (0.7 + i * 0.28) * q; P.ball(X(a - (7 + i * 2.1) * q), Y(b + (4.2 - i * 0.35) * q), rr * 1.3 * u, rr * u, [0xe6dcc8, 0xbfb49c, 0x8e846e], -0.4, -0.7); } };
  if (hw > 34) { wake(-31, 35.2, 0.7); ride(P, X(-31), Y(35.2), u * 0.7, 0.02, false, { body: [0x8ee0a0, 0x2f9a58, 0x145a30], stripe: 0xffffff }); }
  wake(-13.5, 35, 0.8); ride(P, X(-13.5), Y(35), u * 0.8, 0.03, false, { body: [0x7ab0f4, 0x2a66d8, 0x163a8a], stripe: 0xffd84a });
  wake(6, 34.6, 1); ride(P, X(6), Y(34.6), u, -0.05, false, { body: [0xf0786a, 0xd8322a, 0x8a1418], stripe: 0xffffff });
  // bunting, and the flag
  const swags = Math.max(1, Math.round(hw / 12));
  for (let i = 0; i < swags; i++) { const a0 = -hw + i * 2 * hw / swags, a1 = a0 + 2 * hw / swags; let n = 0; for (let t = 0; t <= 1.0001; t += 2.3 / (a1 - a0)) { const a = a0 + (a1 - a0) * t, b = v0 + 0.6 + 14 * t * (1 - t) * Math.min(1, (a1 - a0) / 40); n++; if (Math.abs(a) < 2.6 && b > 1) continue; P.poly([[X(a - 0.95), Y(b)], [X(a + 0.95), Y(b)], [X(a), Y(b + 2.5)]], [0xd8262c, 0xffffff, 0x2a4aa8][n % 3]); } for (let t = 0; t <= 1; t += 0.002) { const a = a0 + (a1 - a0) * t; P.dot(X(a), Y(v0 + 0.6 + 14 * t * (1 - t) * Math.min(1, (a1 - a0) / 40)), 0x3a3e4a); } }
  if (hw > 24) {
    const fx = hw - 5.5, fy = 13; P.line(X(hw - 2.2), Y(41), X(fx), Y(fy - 0.6), 0.35 * u, 0x8a92a2);
    const at = (i, j) => [X(fx - i * 1.9 - j * 0.3), Y(fy + j * 1.8 + Math.sin(i * 0.95 + j * 0.25) * 0.95 + i * 0.3)];
    for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) { const dark = (i + j) % 2, sh = Math.cos(i * 0.95 + j * 0.25) < -0.2; P.poly([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)], dark ? (sh ? 0x05060a : 0x1c1e25) : (sh ? 0xc6ccd6 : 0xffffff)); }
  }
}
// THE CHERRY BLOSSOM FESTIVAL: a branch in full bloom across the top, the Monument and the Jefferson's dome over the
// Basin behind it, kites up, a boat out, petals coming down everywhere
function festivalScene(P) {
  const { W, H } = P, u = Math.min(H / 40, W / 34), X = (v) => W / 2 + v * u, Y = (v) => H - (40 - v) * u, hw = W / 2 / u, v0 = 40 - H / u, r = rnd(14), px = Math.max(1, Math.round(u * 0.4)), M = MARBLE;
  const PINK = [0xfff0f6, 0xffc6da, 0xf08cb0], box = (x0, y0, x1, y1, c) => P.rect(X(x0), Y(y0), X(x1), Y(y1), c);
  P.fade(0, 0, W, Y(27), 0x7ec0f0, 0xffe6ee, 8);
  P.glow(X(-hw * 0.5), Y(13), 18 * u, 0xfffbe6, 0.55, 6);
  for (const [a, b, q] of [[-18, 17, 1], [19, 13, 0.8], [0, v0 + 20, 1.1], [-hw * 0.8, 9, 0.9]]) if (Math.abs(a) < hw + 3 && b < 21) for (const [dx, dy, rr] of [[-3, 0.4, 1.4], [-1, -0.5, 2], [1.6, -0.2, 1.7], [3.6, 0.5, 1.2], [0.4, 0.7, 2.2]]) P.ball(X(a + dx * q), Y(b + dy * q), rr * q * u * 1.4, rr * q * u * 0.8, [0xffffff, 0xfff4f8, 0xf4d6e2], -0.3, -0.7);
  // the far shore
  for (let a = -hw - 2; a <= hw + 2; a += 1.5 + r() * 0.8) P.ball(X(a), Y(25.6 - r() * 1.6), (1.5 + r()) * u, (1.2 + r() * 0.8) * u, r() < 0.75 ? [0xffdce8, 0xffb0cc, 0xe888aa] : [0xfff4f8, 0xffd0de, 0xf0a8c0], -0.4, -0.7);
  const ox = -12, jx = 9;
  P.poly([[X(ox - 0.95), Y(26.8)], [X(ox - 0.62), Y(11.8)], [X(ox), Y(10.2)], [X(ox + 0.62), Y(11.8)], [X(ox + 0.95), Y(26.8)]], 0xf6f2ec); P.poly([[X(ox), Y(10.2)], [X(ox + 0.62), Y(11.8)], [X(ox + 0.95), Y(26.8)], [X(ox + 0.1), Y(26.8)]], 0xd2ccd0);
  box(jx - 4.6, 18.4, jx + 4.6, 19.7, M[1]); P.ball(X(jx), Y(18.5), 4.6 * u, 3.9 * u, M, -0.5, -0.6, -1e9, Y(18.5));
  box(jx - 6, 20.6, jx + 6, 25, 0xa8a4b8); for (let x = jx - 5.8; x < jx + 5.5; x += 1.2) { box(x, 20.6, x + 0.6, 25, M[0]); box(x + 0.42, 20.6, x + 0.6, 25, M[2]); }
  box(jx - 6.4, 19.6, jx + 6.4, 20.7, M[0]); box(jx - 6.4, 20.5, jx + 6.4, 20.8, M[2]);
  box(jx - 2.8, 20.7, jx + 2.8, 25, 0x8e8aa2); for (const x of [-2.6, -1.1, 0.5, 2]) box(jx + x, 20.7, jx + x + 0.65, 25, M[0]); P.poly([[X(jx - 3.4), Y(20.8)], [X(jx), Y(18.3)], [X(jx + 3.4), Y(20.8)]], M[0]); P.poly([[X(jx - 2.3), Y(20.5)], [X(jx), Y(18.9)], [X(jx + 2.3), Y(20.5)]], M[2]);
  P.poly([[X(jx - 6.4), Y(25)], [X(jx + 6.4), Y(25)], [X(jx + 7.6), Y(26.9)], [X(jx - 7.6), Y(26.9)]], M[1]); for (let y = 25.5; y < 26.9; y += 0.5) P.rect(X(jx - 6.4 - (y - 25) * 0.63), Y(y), X(jx + 6.4 + (y - 25) * 0.63), Y(y) + Math.max(1, px * 0.5), M[2]);
  for (let a = -hw - 2; a <= hw + 2; a += 2.2 + r() * 1.4) { if (Math.abs(a - jx) < 7.4 || Math.abs(a - ox) < 1.6) continue; P.ball(X(a), Y(26.5 - r() * 0.5), (1.3 + r() * 0.7) * u, (1.1 + r() * 0.5) * u, PINK, -0.4, -0.7); }
  // the Basin, and what stands over it upside down in it
  P.fade(0, Y(27), W, H, 0xa8d6f0, 0x4a8cc8, 7);
  for (let y = Math.floor(Y(27)); y < Y(30.4); y++) for (let x = 0; x < W; x++) if ((x + y * 3) % 5 < 3) P.over(x, y, 0xffb0cc, 0.5 * (1 - (y - Y(27)) / (3.4 * u)));
  for (let y = Y(27); y < Y(37); y += 1) { const f = (y - Y(27)) / (10 * u), w = (0.9 - f * 0.3) * u, sh = Math.sin(y * 1.1) * px * 0.8; for (let x = X(ox) - w + sh; x < X(ox) + w + sh; x++) P.over(x, y, 0xffffff, 0.5 * (1 - f)); }
  for (let y = Y(27); y < Y(33.5); y += 1) { const f = (y - Y(27)) / (6.5 * u), w = (6 - f * 2) * u, sh = Math.sin(y * 1.1) * px * 0.8; for (let x = X(jx) - w + sh; x < X(jx) + w + sh; x++) if ((Math.floor(y) % 2) || f < 0.4) P.over(x, y, 0xffffff, 0.42 * (1 - f)); }
  for (let i = 0; i < hw * 1.5; i++) { const x = r() * W, y = Y(28 + r() * 12), l = (1 + r() * 3) * u; P.rect(x, y, x + l, y + Math.max(1, px * 0.5), r() < 0.6 ? 0xdff2fc : 0x3f7ab8); }
  // a boat out
  { const bx = -2.5, by = 32; box(bx - 2.2, by - 2.9, bx + 2.2, by - 2.3, 0xffffff); for (let x = -2.2; x < 2; x += 1.1) box(bx + x, by - 2.9, bx + x + 0.55, by - 2.3, 0xe2362a); box(bx - 2, by - 2.3, bx - 1.8, by, 0x8a92a2); box(bx + 1.8, by - 2.3, bx + 2, by, 0x8a92a2);
    for (const [x, c] of [[-0.9, 0x2a66d8], [0.7, 0xf2b21e]]) { box(bx + x - 0.45, by - 1.1, bx + x + 0.45, by, c); P.ell(X(bx + x), Y(by - 1.5), 0.45 * u, 0.45 * u, 0xe8b48a); }
    P.poly([[X(bx - 3.2), Y(by)], [X(bx + 3.2), Y(by)], [X(bx + 2.5), Y(by + 1.2)], [X(bx - 2.5), Y(by + 1.2)]], 0xffffff); box(bx - 2.9, by + 0.5, bx + 2.9, by + 0.8, 0x2a9ad8);
    for (let i = 0; i < 4; i++) box(bx - 4 - i * 0.6, by + 1.3 + i * 0.5, bx + 4 + i * 0.6, by + 1.3 + i * 0.5 + 0.22, 0xe6f6ff); }
  // kites
  const kite = (a, b, q, c0, c1, to) => { for (let t = 0; t <= 1; t += 0.004) P.over(X(a + (to - a) * t), Y(b + 3 * q + (26.5 - b - 3 * q) * t * t), 0x2a3a58, 0.45); P.poly([[X(a), Y(b - 3 * q)], [X(a + 2.2 * q), Y(b)], [X(a), Y(b + 3 * q)]], c0); P.poly([[X(a), Y(b - 3 * q)], [X(a - 2.2 * q), Y(b)], [X(a), Y(b + 3 * q)]], c1); P.poly([[X(a), Y(b)], [X(a + 2.2 * q), Y(b)], [X(a), Y(b + 3 * q)]], mix(c0, 0x000000, 0.2)); for (let i = 1; i < 6; i++) { const x = a + Math.sin(i * 1.4) * 0.8 * q + i * 0.35 * q, y = b + 3 * q + i * 1.1 * q; P.poly([[X(x - 0.5 * q), Y(y - 0.3 * q)], [X(x + 0.5 * q), Y(y + 0.3 * q)], [X(x + 0.5 * q), Y(y - 0.3 * q)], [X(x - 0.5 * q), Y(y + 0.3 * q)]], i % 2 ? c0 : c1); } };
  kite(-3.5, Math.max(15, v0 + 22), 1, 0xe2362a, 0xffd84a, -6); if (hw > 20) kite(-20, 16.5, 0.75, 0x2a66d8, 0xffffff, -17); if (hw > 28) kite(hw * 0.86, 19, 0.8, 0x2f9a58, 0xffd84a, hw * 0.8); if (v0 < -20) kite(4, v0 + 32, 0.9, 0x8a45b8, 0xffffff, 2);
  // the branch, its twigs, and the bloom on them
  const BARK = [0x8a5e42, 0x5a3826, 0x2e1a12], limb = (p, r0, r1) => { for (let t = 0; t <= 1; t += 0.012) { const [x, y] = bez(p, t), q = r0 + (r1 - r0) * t; P.ball(X(x), Y(y), q * u, q * u, BARK, -0.4, -0.7); } };
  const bloom = (x, y, q, turn = 0) => { for (let i = 0; i < 5; i++) { const g = turn + i * 1.2566; P.ball(x + Math.cos(g) * q * 0.6, y + Math.sin(g) * q * 0.6, q * 0.52, q * 0.52, PINK, -0.4, -0.6); } P.ell(x, y, q * 0.3, q * 0.3, 0xd8487a); if (q > 3) for (let i = 0; i < 5; i++) P.dot(x + Math.cos(turn + 0.6 + i * 1.2566) * q * 0.36, y + Math.sin(turn + 0.6 + i * 1.2566) * q * 0.36, 0xffe14a); else P.dot(x, y, 0xffe14a); };
  const main = [hw + 3, v0 + 13, hw * 0.45, v0 + 1, -3, v0 + 9.5, -hw * 0.66, v0 + 3.4];
  const twigs = [[0.16, 6, 5], [0.3, -3.4, -3.6], [0.42, 5, 6.4], [0.56, -2.6, -4], [0.68, 3, 5.6], [0.82, -3, -2.6], [0.92, 2, 4.4]].map(([t, dx, dy]) => { const [x, y] = bez(main, t); return [x, y, x - dx * 0.2, y + dy * 0.55, x - dx * 0.8, y + dy * 0.8, x - dx, y + dy]; });
  for (const tw of twigs) limb(tw, 0.55, 0.22); limb(main, 1.5, 0.3);
  for (const tw of twigs) { for (const t of [0.35, 0.62, 0.85, 1]) { const [x, y] = bez(tw, t), sd = t * 10 % 2 < 1 ? 1 : -1; bloom(X(x + sd * (1 - t) * 0.9), Y(y - (1 - t) * 0.8), (1.25 + r() * 0.8) * u, r() * 6); } const [x, y] = bez(tw, 0.5); P.ball(X(x + 0.9), Y(y + 0.7), 0.5 * u, 0.5 * u, [0xff9cba, 0xe0608c, 0xb03a68], -0.4, -0.6); }
  for (let t = 0.04; t < 1; t += 0.062) { const [x, y] = bez(main, t), sd = Math.round(t * 16) % 2 ? 1 : -1; bloom(X(x + (r() - 0.5) * 1.2), Y(y + sd * (1.2 + r() * 0.9)), (1.5 + r() * 1.1) * u, r() * 6); if (r() < 0.5) P.ball(X(x + 1.3), Y(y - sd * 1.5), 0.55 * u, 0.55 * u, [0xff9cba, 0xe0608c, 0xb03a68], -0.4, -0.6); }
  bloom(X(hw - 2.4), Y(v0 + 8.4), 4.4 * u, 0.3); bloom(X(hw - 8.5), Y(v0 + 3.2), 3.4 * u, 1.1); if (hw > 26) bloom(X(hw - 14.5), Y(v0 + 7.6), 2.8 * u, 0.7);
  // petals on the wind
  for (let i = 0; i < hw * 2.6; i++) { const x = r() * W, y = r() * H, q = (0.35 + r() * 0.55) * u, g = r() * 3.14; P.ell(x, y, Math.max(1, q * (0.6 + 0.4 * Math.abs(Math.cos(g)))), Math.max(0.8, q * (0.6 + 0.4 * Math.abs(Math.sin(g)))), r() < 0.6 ? 0xffc6da : 0xfff0f6); P.dot(x + q * 0.5, y + q * 0.3, 0xf08cb0); }
}
// THE SPACE MUSEUM: the rocket up off the Earth on a column of fire, a ringed world, a spaceman waving it by
function spaceScene(P) {
  const { W, H } = P, u = Math.min(H / 40, W / 34), X = (v) => W / 2 + v * u, Y = (v) => H - (40 - v) * u, hw = W / 2 / u, v0 = 40 - H / u, r = rnd(42), px = Math.max(1, Math.round(u * 0.4));
  P.fade(0, 0, W, H, 0x04051a, 0x2e1660, 8);
  P.glow(X(hw * 0.45), Y(v0 + 12), 21 * u, 0x7a2aa8, 0.38, 6); P.glow(X(-hw * 0.65), Y(20), 17 * u, 0x1f58c8, 0.32, 5); P.glow(X(2), Y(v0 + 3), 12 * u, 0xc83a8a, 0.2, 4);
  for (let i = 0; i < W * H / 70; i++) P.over(r() * W, r() * H, [0xffffff, 0xbfdcff, 0xfff2c0][i % 3], 0.25 + r() * 0.75);
  for (let i = 0; i < hw * 0.6; i++) P.star(r() * W, r() * H, 0.25 * u, (0.8 + r() * 1.2) * u, 4, 0xffffff);
  // a world with rings
  { const cx = X(-13), cy = Y(Math.max(9, v0 + 12)), q = 5 * u, c = Math.cos(-0.4), s = Math.sin(-0.4);
    const ring = (front) => { for (let y = Math.floor(cy - 2.2 * q); y <= cy + 2.2 * q; y++) for (let x = Math.floor(cx - 2.2 * q); x <= cx + 2.2 * q; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy, a = dx * c + dy * s, b = -dx * s + dy * c, e = (a / (2.05 * q)) ** 2 + (b / (0.5 * q)) ** 2; if (e <= 1 && e > 0.42 && (b > 0) === front) P.dot(x, y, e > 0.8 ? 0xe6c89a : e > 0.72 ? 0x6a4a3a : e > 0.55 ? 0xffe6b8 : 0xc8a070); } };
    ring(false); P.ball(cx, cy, q, q, [0xffe0a8, 0xf2a850, 0xc8682a, 0x7a3414], -0.5, -0.6);
    for (let y = Math.floor(cy - q); y <= cy + q; y++) for (let x = Math.floor(cx - q); x <= cx + q; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy < q * q * 0.96 && Math.sin((-dx * s + dy * c) / q * 9) > 0.35) P.over(x, y, 0x8a3a14, 0.28); }
    ring(true); }
  if (hw > 30) { const mx = X(hw * 0.74), my = Y(v0 + 9); P.ball(mx, my, 3.6 * u, 3.6 * u, [0xf6f6ee, 0xd6d8d4, 0xa2a4aa, 0x5e606c], -0.5, -0.6); for (const [a, b, q] of [[-1, -0.6, 0.8], [0.9, 0.9, 0.6], [0.4, -1.6, 0.45], [-1.5, 1.2, 0.5]]) { P.ell(mx + a * u, my + b * u, q * u, q * u, 0xa2a4aa); P.ell(mx + a * u + px * 0.5, my + b * u + px * 0.5, q * u * 0.7, q * u * 0.7, 0xc2c4c8); } }
  // the Earth
  const ex = X(-14), ey = Y(58), er = 26 * u, inE = (x, y) => (x + 0.5 - ex) ** 2 + (y + 0.5 - ey) ** 2 < er * er;
  P.glow(ex, ey, er * 1.1, 0x6fc0ff, 0.55, 5); P.ball(ex, ey, er, er, [0xa8e0ff, 0x4a98f4, 0x2458c8, 0x122a7a], 0.15, -0.9);
  const blob = (a, b, rx, ry, c, al) => { for (let y = Math.floor(Y(b - ry)); y <= Y(b + ry); y++) for (let x = Math.floor(X(a - rx)); x <= X(a + rx); x++) if (inE(x, y) && ((x + 0.5 - X(a)) / (rx * u)) ** 2 + ((y + 0.5 - Y(b)) / (ry * u)) ** 2 <= 1) { if (al) P.over(x, y, c, al); else P.dot(x, y, c); } };
  for (const [a, b, rx, ry] of [[-22, 36.4, 5, 1.6], [-18.5, 38, 3.4, 1.6], [-27, 39, 4, 1.4], [-4, 38.6, 4.4, 1.5], [-0.5, 39.8, 3, 1], [5, 40.4, 2.4, 0.8], [-34, 40, 3, 1.2]]) { blob(a, b, rx, ry, 0x3aa85a); blob(a - 0.4, b - 0.3, rx * 0.6, ry * 0.5, 0x6ad07a); }
  for (const [a, b, rx, ry] of [[-25, 35.2, 4, 0.55], [-12, 36.6, 5, 0.6], [-7, 35, 3, 0.45], [-30, 37.6, 3.4, 0.5], [2, 38.2, 3, 0.45], [-17, 34.2, 2.6, 0.4]]) blob(a, b, rx, ry, 0xffffff, 0.85);
  // the rocket: its smoke back down to the pad, its fire, its fins, then each pixel of its body asked where on it it is
  const q = 0.86 * u, ang = 0.62, cx = X(6.5), cy = Y(14.2), c = Math.cos(ang), s = Math.sin(ang), T = (a, b) => [cx + (a * c - b * s) * q, cy + (a * s + b * c) * q], Q = (pts, col) => P.poly(pts.map(([a, b]) => T(a, b)), col);
  const [fx, fy] = T(0, 19), trail = [(fx - W / 2) / u, 40 - (H - fy) / u, -6.5, 31, -12, 28.5, -13.5, 32.6];
  for (let t = 1; t >= 0; t -= 0.035) { const [x, y] = bez(trail, t), rr = 1 + t * 1.5 + Math.sin(t * 40) * 0.25; P.ball(X(x + Math.sin(t * 23) * 0.5), Y(y), rr * 1.15 * u, rr * u, [0xffffff, 0xdfe2ec, 0xa8acc0, 0x6e7290], -0.4, -0.7); }
  for (let i = 0; i < 9; i++) { const rr = 1.3 + r() * 1.5; P.ball(X(-13.5 + (i - 4) * 1.5), Y(32.9 + r() * 0.8), rr * 1.3 * u, rr * u, [0xffffff, 0xdfe2ec, 0xa8acc0, 0x6e7290], -0.4, -0.7); }
  for (const [tones, k, b1] of [[[0xffc23a, 0xff7a1e, 0xe2362a], 1, 20], [[0xfff2a8, 0xffe14a, 0xffb21e], 0.62, 17], [[0xffffff, 0xffffff, 0xfff2a8], 0.3, 14]]) for (let b = 9.4; b < b1; b += 0.25) { const f = (b - 9.4) / (b1 - 9.4), rr = (3.1 * (1 - f) ** 0.7 + 0.25) * k, [x, y] = T(Math.sin(b * 1.9) * 0.3 * f, b); P.ball(x, y, rr * q, rr * q, tones, -0.4, -0.6); }
  Q([[-3.3, 3.2], [-8.2, 11.6], [-3.3, 9]], 0xe2362a); Q([[-3.3, 3.2], [-4.6, 5.4], [-3.3, 6]], 0xff7a6a); Q([[3.3, 3.2], [8.2, 11.6], [3.3, 9]], 0xa81c1c);
  for (let y = Math.floor(cy - 16 * q); y <= cy + 16 * q; y++) for (let x = Math.floor(cx - 16 * q); x <= cx + 16 * q; x++) {
    const dx = (x + 0.5 - cx) / q, dy = (y + 0.5 - cy) / q, a = dx * c + dy * s, b = -dx * s + dy * c; if (b < -14 || b > 9.6) continue;
    const wd = b < -5 ? 3.5 * Math.sqrt(1 - ((-5 - b) / 9) ** 2) : b > 8 ? 3.5 - (b - 8) * 0.5 : 3.5; if (Math.abs(a) > wd) continue;
    const t = a / wd, d1 = Math.hypot(a, b + 2.4), d2 = Math.hypot(a, b - 2);
    let base = b < -8.6 ? 0xe2362a : b < -8 ? 0x15171c : b > 4.4 && b < 6.8 ? ((Math.floor((a + 3.5) / 1.17) + Math.floor((b - 4.4) / 1.2)) % 2 ? 0x15171c : 0xf4f6fa) : b > 8 ? 0x3a3e4a : b > 7.2 ? 0xe2362a : 0xf4f6fa, flat = false;
    if (d1 < 1.9) { base = d1 < 1.35 ? (a + (b + 2.4) < -0.7 ? 0xdff4ff : 0x4aa8e8) : 0x8a92a2; flat = d1 < 1.35; } else if (d2 < 1.1) { base = d2 < 0.7 ? 0x4aa8e8 : 0x8a92a2; flat = d2 < 0.7; }
    const f = flat ? 1 : t < -0.84 ? 0.62 : t < -0.62 ? 0.86 : t < -0.4 ? 1.4 : t < 0.3 ? 1 : t < 0.66 ? 0.78 : 0.55;
    P.dot(x, y, f > 1 ? mix(base, 0xffffff, 0.5) : mix(base, 0x000000, 1 - f));
  }
  Q([[-0.35, 4], [0.35, 4], [0.35, 10.8], [-0.35, 10.8]], 0xa81c1c); for (let a = -2.8; a <= 2.8; a += 1.4) for (const b of [-7.4, 3.6]) { const [x, y] = T(a, b); P.dot(x, y, 0x8a92a2); }
  // a satellite, a spaceman, a shooting star
  { const sx = Math.min(-1.5, hw - 26), sy = v0 + 5; P.rect(X(sx - 4.2), Y(sy - 0.7), X(sx - 1.1), Y(sy + 0.7), 0x2a66d8); P.rect(X(sx + 1.1), Y(sy - 0.7), X(sx + 4.2), Y(sy + 0.7), 0x2a66d8); for (const a of [-3.2, -2.2, 2.1, 3.1]) P.rect(X(sx + a), Y(sy - 0.7), X(sx + a) + Math.max(1, px * 0.5), Y(sy + 0.7), 0x9fd0ff); P.rect(X(sx - 1.1), Y(sy - 1), X(sx + 1.1), Y(sy + 1), 0xe8b830); P.rect(X(sx - 1.1), Y(sy - 1), X(sx + 1.1), Y(sy - 0.5), 0xfff2a8); P.ell(X(sx), Y(sy + 1.7), 0.9 * u, 0.5 * u, 0xdfe2ec); P.rect(X(sx) - px * 0.5, Y(sy + 1), X(sx) + px * 0.5, Y(sy + 1.6), 0x8a92a2); }
  { const ax = Math.min(16, hw - 4.5), ay = 26.5, A = (a, b) => [X(ax + a), Y(ay + b)], WH = [0xffffff, 0xe6eaf2, 0xb8bed0];
    for (let t = 0; t <= 1; t += 0.01) { const [x, y] = bez([ax + 1, ay + 1, ax + 5, ay + 6, ax + 9, ay - 2, hw + 3, ay + 3], t); if (Math.floor(t * 50) % 2) P.dot(X(x), Y(y), 0xdfe2ec); }
    P.rect(...A(-1.7, -1.5), ...A(1.7, 2.3), 0x8a92a2); P.limb(...A(-0.7, 2.2), ...A(-1.5, 4.7), 0.7 * u, 0.6 * u, WH, -0.4, -0.6); P.limb(...A(0.7, 2.2), ...A(1.7, 4.4), 0.7 * u, 0.6 * u, WH, -0.4, -0.6); P.ell(...A(-1.6, 5), 0.8 * u, 0.55 * u, 0x6e7290); P.ell(...A(1.9, 4.7), 0.8 * u, 0.55 * u, 0x6e7290);
    P.limb(...A(-1.2, 0), ...A(-3, -2.6), 0.6 * u, 0.55 * u, WH, -0.4, -0.6); P.limb(...A(1.2, 0.2), ...A(3, 1.2), 0.6 * u, 0.55 * u, WH, -0.4, -0.6); P.ell(...A(-3.2, -3), 0.7 * u, 0.7 * u, 0xe2362a); P.ell(...A(3.3, 1.4), 0.7 * u, 0.7 * u, 0xe2362a);
    P.ball(...A(0, 0.7), 1.6 * u, 2 * u, WH, -0.4, -0.6); P.rect(...A(-0.7, 0.3), ...A(0.7, 1.3), 0x2a66d8); P.rect(...A(-0.4, 0.5), ...A(0, 0.8), 0xe2362a);
    P.ball(...A(0, -2.1), 1.6 * u, 1.6 * u, WH, -0.4, -0.6); P.ell(...A(0.15, -2), 1.1 * u, 0.9 * u, 0x16233a); P.ell(...A(-0.2, -2.3), 0.5 * u, 0.3 * u, 0x5cc8f0); P.dot(...A(-0.4, -2.4), 0xffffff); }
  { const hx = X(hw * 0.86), hy = Y(v0 + 3.6); P.poly([[hx, hy - 0.4 * u], [hx, hy + 0.4 * u], [hx + 11 * u, hy - 5 * u]], 0xffffff, 0.5); P.star(hx, hy, 0.4 * u, 1.6 * u, 4, 0xffffff); }
}

// ---- banners: the word down a strip under its picture ---------------------------------------------------------------
// [word, picture, the cloth, the letters]
const BANNERS = [
  ['SPACE', 'rocket', NAVY, WHITE], ['DINOS', 'dino', 0x5a2f1c, 0xf2ead8], ['ART', 'art', 0x7a1418, GOLD], ['ZOO', 'panda', 0x1e6a3c, WHITE],
  ['BLOSSOM', 'blossom', 0xf6dce6, 0xb0204a], ['KITES', 'kite', 0x7fc4ee, NAVY], ['RACE', 'race', 0xd8262c, WHITE], ['VOTE', 'vote', WHITE, BLUE],
  ['MUSEUM', 'art', NAVY, GOLD], ['PRIX', 'race', NAVY, WHITE], ['JAZZ', 'kite', 0x2a1840, GOLD], ['SPRING', 'blossom', 0xffe9f0, 0x7a2f52],
];
export const SIGN_WORDS = BANNERS.map((b) => b[0]);
export const SIGN_INKS = BANNERS.map((b) => [b[2], b[3]]);
export function sign(word, ink, k = 1) {
  const B = BANNERS.find((b) => b[0] === word) || BANNERS[0], W = 5 * k + 6, top = 11 * k, H = top + latinH(word, k) + 5, P = pixels(W, H, ink[0]);
  ART[B[1]](P, 1, 1, W - 2, top - 1);
  label(P, word, 3, top + 1, ink[1], { k, down: true });
  for (let x = 0; x < W; x++) { P.dot(x, 0, ink[1]); P.dot(x, H - 1, ink[1]); }
  return P;
}
// ---- posters --------------------------------------------------------------------------------------------------------
// [title, short, the line under, the band, the letters, the picture, the ground behind the picture]
const DEF = {
  prix: ['CAPITAL GRAND PRIX', 'RACE', 'THREE LAPS OF THE MALL', NAVY, WHITE, 'prix', 0x6ab0e8],
  festival: ['CHERRY BLOSSOM', 'BLOOM', 'FESTIVAL', 0xb0204a, WHITE, 'festival', 0xffe9f0],
  space: ['SPACE MUSEUM', 'SPACE', 'SEE THE ROCKET', 0x0e1430, WHITE, 'space', 0x1a2458],
  rust: ['VOTE RUST', 'RUST', 'A WRECK YOU CAN TRUST', RED, WHITE, 'vote', WHITE],
  nitro: ['NITRO 4 MAYOR', 'NITRO', 'FASTER GOVERNMENT', BLUE, WHITE, 'race', 0xf2ead8],
  dinos: ['DINOSAURS', 'DINOS', 'NATURAL HISTORY', 0x5a2f1c, 0xf2ead8, 'dino', 0x2a1a12],
  zoo: ['THE ZOO', 'ZOO', 'PANDAS ARE BACK', 0x1e6a3c, WHITE, 'panda', 0x9fd08a],
  kites: ['KITE DAY', 'KITES', 'ON THE MALL', 0x2a66d8, WHITE, 'kite', 0xbfe0f6],
  gallery: ['THE GALLERY', 'ART', 'OPEN LATE', 0x7a1418, GOLD, 'art', 0x2a0c10],
};
export const FILMS = ['prix', 'festival', 'space'];
export const POSTERS = Object.keys(DEF);
// s: pixels to a voxel (2 for the great boards: the rect on the sheet stays W0 by H0 voxels)
export function poster(kind, W0, H0, s = 1) {
  const [title, short, sub, band, ink, art, ground] = DEF[kind], W = W0 * s, H = H0 * s, P = pixels(W, H, ground); P.s = s;
  const k0 = latinW(title, 3) + 8 <= W0 && H0 >= 80 ? 3 : latinW(title, 2) + 6 <= W0 && H0 >= 50 ? 2 : 1, k = s > 1 && k0 === 1 && H0 >= 80 && latinW(title, 3) + 8 <= W ? 3 : k0 * s;
  if (latinW(title, k0) + 4 <= W0) {
    const bh = 7 * k + 4 * s, q0 = H0 >= 80 && latinW(sub, 2) + 4 <= W0 ? 2 : 1, q = s > 1 && q0 > 1 ? Math.max(2, Math.min(3, k - 1)) : q0 * s, foot = latinW(sub, q0) + 4 <= W0 && H0 >= 36 ? 7 * q + 4 * s : 0;
    ART[art](P, s, bh + s, W - 2 * s, H - bh - foot - 2 * s);
    P.rect(0, 0, W, bh, band); centred(P, title, 2 * s, ink, { k });
    if (foot) { P.rect(0, H - foot, W, H, band); centred(P, sub, H - foot + 2 * s, ink, { k: q }); }
  } else {
    const word = latinH(title) + 4 <= H0 ? title : short;
    ART[art](P, 10 * s, s, W - 11 * s, H - 2 * s); P.rect(0, 0, 9 * s, H, band); label(P, word, 2 * s, Math.max(2, Math.round((H0 - latinH(word)) / 2)) * s, ink, { down: true, k: s });
  }
  P.rect(0, 0, W, s, band); P.rect(0, H - s, W, H, band); P.rect(0, 0, s, H, band); P.rect(W - s, 0, W, H, band);
  return P;
}
// (for the sheet that tools draw to look at everything)
export const EXTRAS = () => [flagUS(), flagDC()];
