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

// ---- the pictures: each draws in the box (x0, y0, w, h) of P ---------------------------------------------------------
const ART = {
  // WRECKED!: red curtains, a spotlight, and in it a car on its nose with stars round it
  wrecked(P, x0, y0, w, h) {
    const u = Math.min(w / 40, h / 26), cx = x0 + w / 2, by = y0 + h;
    bands(P, x0, y0, w, h, 0x2a0508, 0x7a0f18);
    P.poly([[cx - 3 * u, y0], [cx + 3 * u, y0], [cx + 13 * u, by], [cx - 13 * u, by]], 0xffe9a6); P.ell(cx, by - 1.5 * u, 13 * u, 3 * u, 0xfff6cf);
    for (let x = x0; x < x0 + w; x++) { const d = Math.abs(x - cx) / (w / 2); if (d > 0.62) P.rect(x, y0, x + 1, by, Math.floor((x - x0) / Math.max(2, 2 * u)) % 2 ? 0x8a1218 : 0xb81c24); }
    car(P, cx, by - 9 * u, u * 0.95, 0xf2b21e);
    P.rect(cx - 9 * u, by - 3 * u, cx + 9 * u, by - 2 * u, 0x3a2412);
    for (const [a, b] of [[-11, -20], [10, -22], [-7, -14], [12, -12], [0, -23]]) { const X = cx + a * u, Y = by + b * u; P.rect(X - u, Y, X + u + 1, Y + 1, 0xffffff); P.rect(X, Y - u, X + 1, Y + u + 1, 0xffffff); }
  },
  // FIGHT NIGHT: two cars nose to nose under the lights, a flash between them
  fight(P, x0, y0, w, h) {
    const u = Math.min(w / 44, h / 24), cx = x0 + w / 2, by = y0 + h;
    bands(P, x0, y0, w, h, 0x0b0d18, 0x2a1840);
    for (const s of [-1, 1]) P.poly([[cx + s * 20 * u, y0], [cx + s * 16 * u, y0], [cx + s * 2 * u, by], [cx + s * 12 * u, by]], 0x3a3466);
    P.rect(x0, by - 3 * u, x0 + w, by, 0x4a3a2a);
    const star = [[0, -8], [2, -3], [8, -3], [3, 0], [5, 6], [0, 2], [-5, 6], [-3, 0], [-8, -3], [-2, -3]].map(([a, b]) => [cx + a * u * 0.9, by - 10 * u + b * u * 0.9]);
    P.poly(star, 0xffe14a); P.ell(cx, by - 10 * u, 2.2 * u, 2.2 * u, 0xffffff);
    car(P, cx - 12 * u, by - 6 * u, u * 0.9, 0xb5482a); car(P, cx + 12 * u, by - 6 * u, u * 0.9, 0x2a66d8, true);
  },
  // NITRO COLA: a can, drops down its side, bubbles rising on red
  cola(P, x0, y0, w, h) {
    const u = Math.min(w / 30, h / 26), cx = x0 + w / 2, cy = y0 + h / 2;
    bands(P, x0, y0, w, h, 0xd8281e, 0x8a0f12);
    const r = rnd(77); for (let i = 0; i < Math.round(w * h / 60); i++) { const X = x0 + r() * w, Y = y0 + r() * h, s = 0.5 + r() * 1.2 * u; P.ell(X, Y, s, s, 0xf0564a); }
    P.rect(cx - 6 * u, cy - 10 * u, cx + 6 * u, cy + 10 * u, 0x16233a); P.rect(cx - 5 * u, cy - 11 * u, cx + 5 * u, cy - 10 * u, 0xc8ccd4); P.rect(cx - 5 * u, cy + 10 * u, cx + 5 * u, cy + 11 * u, 0x9a9ea6);
    P.rect(cx - 6 * u, cy - 3 * u, cx + 6 * u, cy + 3 * u, 0xffd84a); P.poly([[cx + u, cy - 8 * u], [cx - 3 * u, cy], [cx, cy], [cx - 1.5 * u, cy + 8 * u], [cx + 3.5 * u, cy - 1.5 * u], [cx + 0.5 * u, cy - 1.5 * u]], 0xff6a1e);
    P.rect(cx + 4 * u, cy - 10 * u, cx + 5 * u, cy + 10 * u, 0x2c426a);
  },
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
// a poster W by H: the title in a band across its top (down its side on a narrow one), the picture, a line at the foot
export function poster(kind, W, H) {
  const [title, short, sub, band, ink] = DEF[kind], P = pixels(W, H, band);
  const k = latinW(title, 3) + 8 <= W && H >= 80 ? 3 : latinW(title, 2) + 6 <= W && H >= 50 ? 2 : 1;
  if (latinW(title, k) + 4 <= W) {
    const bh = 7 * k + 4, q = H >= 80 ? 2 : 1, foot = latinW(sub, q) + 4 <= W && H >= 36 ? 7 * q + 4 : 0;
    ART[kind](P, 0, bh, W, H - bh - foot);
    P.rect(0, 0, W, bh, band); centred(P, title, 2, ink, { k });
    if (foot) { P.rect(0, H - foot, W, H, band); centred(P, sub, H - foot + 2, ink, { k: q }); }
  } else {
    const word = latinH(title) + 4 <= H ? title : short;
    ART[kind](P, 9, 0, W - 9, H); P.rect(0, 0, 9, H, band); label(P, word, 2, Math.max(2, Math.round((H - latinH(word)) / 2)), ink, { down: true });
  }
  for (let x = 0; x < W; x++) { P.dot(x, 0, band); P.dot(x, H - 1, band); } for (let y = 0; y < H; y++) { P.dot(0, y, band); P.dot(W - 1, y, band); }
  return P;
}
