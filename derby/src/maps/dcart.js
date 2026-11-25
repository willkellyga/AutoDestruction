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

const RED = 0xb22234, BLUE = 0x2a3a78, WHITE = 0xf6f3ea, NAVY = 0x16224a, GOLD = 0xe8b830;
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => { const p = hex(a), q = hex(b); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]; };
const bands = (P, x0, y0, w, h, top, foot, n = 6) => { for (let y = 0; y < h; y++) P.rect(x0, y0 + y, x0 + w, y0 + y + 1, mix(top, foot, Math.min(1, Math.floor(y / h * n) / (n - 1)))); };
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
  // the dome on its hill, and a car
  dome(P, x0, y0, w, h) {
    const u = Math.min(w / 44, h / 24), cx = x0 + w / 2, by = y0 + h;
    bands(P, x0, y0, w, h, 0x6ab0e8, 0xcfe6f6);
    P.rect(cx - 18 * u, by - 9 * u, cx + 18 * u, by - 4 * u, WHITE); for (let x = -17; x <= 17; x += 2) P.rect(cx + x * u, by - 8.4 * u, cx + x * u + Math.max(1, 0.6 * u), by - 4 * u, 0xc8ccd4);
    P.rect(cx - 6 * u, by - 12 * u, cx + 6 * u, by - 9 * u, WHITE); P.ell(cx, by - 12 * u, 5 * u, 6 * u, WHITE, -1e9, by - 12 * u); P.rect(cx - 0.8 * u, by - 21 * u, cx + 0.8 * u, by - 17.6 * u, WHITE);
    P.rect(x0, by - 4 * u, x0 + w, by, 0x3a3c42); for (let i = 0; i < w / (2 * u); i++) P.rect(x0 + i * 2 * u, by - 1.4 * u, x0 + i * 2 * u + u, by - 0.6 * u, i % 2 ? WHITE : 0x15171c);
  },
};
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
  prix: ['CAPITAL GRAND PRIX', 'RACE', 'THREE LAPS OF THE MALL', NAVY, WHITE, 'dome', 0x6ab0e8],
  festival: ['CHERRY BLOSSOM', 'BLOOM', 'FESTIVAL', 0xb0204a, WHITE, 'blossom', 0xffe9f0],
  space: ['SPACE MUSEUM', 'SPACE', 'SEE THE ROCKET', 0x0e1430, WHITE, 'rocket', 0x1a2458],
  rust: ['VOTE RUST', 'RUST', 'A WRECK YOU CAN TRUST', RED, WHITE, 'vote', WHITE],
  nitro: ['NITRO 4 MAYOR', 'NITRO', 'FASTER GOVERNMENT', BLUE, WHITE, 'race', 0xf2ead8],
  dinos: ['DINOSAURS', 'DINOS', 'NATURAL HISTORY', 0x5a2f1c, 0xf2ead8, 'dino', 0x2a1a12],
  zoo: ['THE ZOO', 'ZOO', 'PANDAS ARE BACK', 0x1e6a3c, WHITE, 'panda', 0x9fd08a],
  kites: ['KITE DAY', 'KITES', 'ON THE MALL', 0x2a66d8, WHITE, 'kite', 0xbfe0f6],
  gallery: ['THE GALLERY', 'ART', 'OPEN LATE', 0x7a1418, GOLD, 'art', 0x2a0c10],
};
export const FILMS = ['prix', 'festival', 'space'];
export const POSTERS = Object.keys(DEF);
export function poster(kind, W, H) {
  const [title, short, sub, band, ink, art, ground] = DEF[kind], P = pixels(W, H, ground);
  const k = latinW(title, 3) + 8 <= W && H >= 80 ? 3 : latinW(title, 2) + 6 <= W && H >= 50 ? 2 : 1;
  if (latinW(title, k) + 4 <= W) {
    const bh = 7 * k + 4, q = H >= 80 && latinW(sub, 2) + 4 <= W ? 2 : 1, foot = latinW(sub, q) + 4 <= W && H >= 36 ? 7 * q + 4 : 0;
    ART[art](P, 1, bh + 1, W - 2, H - bh - foot - 2);
    P.rect(0, 0, W, bh, band); centred(P, title, 2, ink, { k });
    if (foot) { P.rect(0, H - foot, W, H, band); centred(P, sub, H - foot + 2, ink, { k: q }); }
  } else {
    const word = latinH(title) + 4 <= H ? title : short;
    ART[art](P, 10, 1, W - 11, H - 2); P.rect(0, 0, 9, H, band); label(P, word, 2, Math.max(2, Math.round((H - latinH(word)) / 2)), ink, { down: true });
  }
  for (let x = 0; x < W; x++) { P.dot(x, 0, band); P.dot(x, H - 1, band); } for (let y = 0; y < H; y++) { P.dot(0, y, band); P.dot(W - 1, y, band); }
  return P;
}
// (for the sheet that tools draw to look at everything)
export const EXTRAS = () => [flagUS(), flagDC()];
