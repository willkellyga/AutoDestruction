// Midnight Tokyo's signs and posters (Will, 2026-11-25: "I want more of a japanese culture and flaire. Could we have
// Kaiju on billboards? ... it doesn't feel japanese enough"). Everything here is a picture a voxel to a pixel, drawn
// by this file and nothing else: no font and no image is loaded.
//   - the katakana, seven pixels square, drawn for this game (GLYPHS), and words written with them across or down;
//   - the film posters: three monsters of our own (Gaora, a horned sea beast that breathes blue fire; Daidako, a
//     giant octopus; Mekao, a steel giant) and the things a Tokyo street sells (ramen, sushi, beer, karaoke, pachinko,
//     the lucky cat).
// It has no part of three.js in it, so a test can draw the pictures on their own (tools: node, see pixels()).

// each glyph seven rows of seven (eight where it carries the two dots or the ring at its top right)
const G = (s) => s.trim().split(/\s+/);
export const GLYPHS = {
  ア: G('XXXXXXX ......X ...X.X. ...XX.. ...X... ..X.... .X.....'),
  イ: G('.....X. ....X.. ..XXX.. XX..X.. ....X.. ....X.. ....X..'),
  ウ: G('...X... XXXXXXX X.....X ......X .....X. ....X.. ..XX...'),
  オ: G('....X.. XXXXXXX ....X.. ...XX.. ..X.X.. .X..X.. X..XX..'),
  カ: G('..X.... XXXXXX. ..X..X. ..X..X. .X...X. .X...X. X..XX..'),
  ガ: G('..X..X.X XXXXX... ..X.X... ..X.X... .X..X... .X..X... X.XX....'),
  キ: G('...X... XXXXXX. ...X... XXXXXXX ...X... ...X... ...X...'),
  ク: G('..X.... ..XXXXX .X....X X....X. ....X.. ...X... .XX....'),
  ケ: G('.X..... .XXXXXX X...X.. ....X.. ....X.. ...X... ..X....'),
  ゲ: G('.X...X.X .XXXX... X..X.... ...X.... ...X.... ..X..... .X......'),
  コ: G('....... XXXXXX. .....X. .....X. .....X. XXXXXX. .......'),
  サ: G('.X...X. XXXXXXX .X...X. .X...X. .....X. ....X.. ..XX...'),
  シ: G('.X..... ..X...X X.....X .X...X. ....X.. ...X... XXX....'),
  ジ: G('.X...X.X ..X..... X....X.. .X...X.. ....X... ...X.... XXX.....'),
  ス: G('XXXXXX. .....X. ....X.. ...X... ..X.X.. .X...X. X.....X'),
  ソ: G('X.....X .X....X .X....X .....X. .....X. ....X.. ..XX...'),
  タ: G('..X.... ..XXXXX .X....X X.XX.X. ....X.. ...X... .XX....'),
  ダ: G('..X..X.X ..XXX... .X..X... X.X.X... ...X.... ..X..... XX......'),
  チ: G('....XX. XXXX... ...X... XXXXXXX ...X... ...X... ..X....'),
  テ: G('.XXXXX. ....... XXXXXXX ...X... ...X... ..X.... .X.....'),
  ト: G('.X..... .X..... .XXX... .X..XX. .X..... .X..... .X.....'),
  ド: G('.X...X.X .X...... .XXX.... .X..XX.. .X...... .X...... .X......'),
  ナ: G('...X... ...X... XXXXXXX ...X... ...X... ..X.... .X.....'),
  ニ: G('....... .XXXXX. ....... ....... ....... XXXXXXX .......'),
  ネ: G('...X... XXXXXXX .....X. ....X.. ..XXXX. XX.X..X ...X...'),
  ハ: G('....... ..X.X.. ..X..X. .X...X. .X....X X.....X X.....X'),
  バ: G('.....X.X .X.X.... .X..X... .X..X... X....X.. X....X.. X.....X.'),
  パ: G('.....XXX .X.X.X.X .X..XXXX .X..X... X....X.. X....X.. X.....X.'),
  ビ: G('X....X.X X....... X..XX... XXX..... X....... X....... .XXXXX..'),
  ホ: G('...X... XXXXXXX ...X... .X.X.X. .X.X.X. X..X..X ..XX...'),
  マ: G('XXXXXXX ......X .....X. .X..X.. ..XX... ...X... ....X..'),
  ム: G('...X... ...X... ..X.... ..X.... .X...X. XXXXXXX ......X'),
  メ: G('.....X. .....X. .XX.X.. ...X... ..X.X.. .X...X. X......'),
  ュ: G('....... ....... .XXXX.. ....X.. ....X.. .XXXXXX .......'),
  ョ: G('....... ....... .XXXXX. .....X. ..XXXX. .....X. .XXXXX.'),
  ラ: G('.XXXXX. ....... XXXXXXX ......X .....X. ....X.. ..XX...'),
  ル: G('..X.X.. ..X.X.. ..X.X.. ..X.X.. ..X.X.X .X..XX. X...X..'),
  レ: G('X...... X...... X...... X.....X X....X. X..XX.. XXX....'),
  ロ: G('....... XXXXXXX X.....X X.....X X.....X XXXXXXX .......'),
  ン: G('.X..... ..X...X ......X .....X. ....X.. ...X... XXX....'),
  大: G('...X... ...X... XXXXXXX ...X... ..X.X.. .X...X. X.....X'),
  ー: G('....... ....... ....... XXXXXXX ....... ....... .......'),
  '|': G('...X... ...X... ...X... ...X... ...X... ...X... ...X...'),   // the long mark, written down a sign
};
// a word's size in pixels: across, a glyph every eight; down, every nine
export const wordW = (s, k = 1) => (s.length * 8 - 1) * k;
export const wordH = (s, k = 1) => (s.length * 9 - 2) * k;
// write it: dot(x, y) is called for every pixel (y down); `down` writes it top to bottom, k times the size
export function write(dot, s, x, y, down = false, k = 1) {
  [...s].forEach((ch, i) => {
    const g = GLYPHS[down && ch === 'ー' ? '|' : ch]; if (!g) return;
    const ox = down ? x : x + i * 8 * k, oy = down ? y + i * 9 * k : y;
    for (let r = 0; r < 7; r++) for (let c = 0; c < g[r].length; c++) if (g[r][c] === 'X') for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) dot(ox + c * k + a, oy + r * k + b);
  });
}

// ---- a picture: W by H pixels, [r, g, b] each 0..255 -----------------------------------------------------------------
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
export function pixels(W, H, bg = 0x000000) {
  const d = new Uint8ClampedArray(W * H * 4), P = { W, H, d };
  const dot = (x, y, c) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4, q = typeof c === 'number' ? hex(c) : c; d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; d[i + 3] = 255; };
  P.dot = dot;
  P.rect = (x0, y0, x1, y1, c) => { for (let y = Math.floor(y0); y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) dot(x, y, c); };
  P.ell = (cx, cy, rx, ry, c, top = -1e9, bot = 1e9) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (y >= top && y < bot && ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) dot(x, y, c); };
  P.poly = (pts, c) => {
    let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9; for (const [x, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
      let inside = false; const px = x + 0.5, py = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside; }
      if (inside) dot(x, y, c);
    }
  };
  P.line = (x0, y0, x1, y1, r, c) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1; for (let i = 0; i <= n; i++) { const t = i / n; P.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, c); } };
  P.text = (s, x, y, c, { down = false, k = 1, shade = null } = {}) => { if (shade !== null) write((a, b) => dot(a + k, b + k, shade), s, x, y, down, k); write((a, b) => dot(a, b, c), s, x, y, down, k); };
  P.rect(0, 0, W, H, bg);
  return P;
}
const mix = (a, b, t) => { const p = hex(a), q = hex(b); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]; };
const rnd = (seed) => { let s = seed | 0; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; }; };
// a sky in bands from one colour at the top to another at the foot
function sky(P, top, foot, bands = 7) { for (let y = 0; y < P.H; y++) { const t = Math.floor(y / P.H * bands) / (bands - 1); P.rect(0, y, P.W, y + 1, mix(top, foot, Math.min(1, t))); } }
// a town along the foot of a picture, black against the sky, a window lit here and there
function town(P, h, seed, lit = 0xffd66a, body = 0x0b0c14) {
  const r = rnd(seed); let x = 0;
  while (x < P.W) { const w = 3 + Math.floor(r() * 5), t = P.H - h * (0.45 + r() * 0.55); P.rect(x, t, x + w, P.H, body); for (let y = t + 1; y < P.H - 1; y += 2) for (let a = x + 1; a < x + w - 1; a += 2) if (r() < 0.3) P.dot(a, y, lit); x += w; }
}

// ---- the posters ----------------------------------------------------------------------------------------------------
// GAORA: a horned beast out of the bay, plates down its back, blue fire from its jaws, a red sky and a great pale sun
function gaora(P) {
  const { W, H } = P, u = H / 40, X = (v) => W * 0.5 + v * u, Y = (v) => v * u;
  sky(P, 0x3d0a1c, 0xe2561e);
  P.ell(X(6), Y(17), 15 * u, 15 * u, 0xffe9a6); P.ell(X(6), Y(17), 12.5 * u, 12.5 * u, 0xfff6cf);
  const D = 0x0f3530, B = 0x1d5a4e, L = 0x3f8f77;
  // tail, body, the plates, neck and head (it faces left)
  P.line(X(13), Y(33), X(24), Y(27), 2.4 * u, D); P.line(X(24), Y(27), X(30), Y(19), 1.5 * u, D);
  for (const [a, b, s] of [[12, 12, 3.4], [15.5, 16, 4], [17.5, 21, 4], [18, 26, 3.6], [22, 26, 2.4]]) P.poly([[X(a - s * 0.5), Y(b + s * 0.5)], [X(a + s * 0.9), Y(b - s * 1.1)], [X(a + s * 0.7), Y(b + s * 0.9)]], 0x7fd6c0);
  P.ell(X(8), Y(30), 10 * u, 13 * u, D); P.ell(X(5), Y(31), 6 * u, 10 * u, B);
  for (let y = 23; y < 40; y += 3) P.rect(X(1), Y(y), X(8), Y(y) + Math.max(1, u * 0.6), L);
  P.line(X(6), Y(20), X(2), Y(12), 4.2 * u, D);
  P.ell(X(-1), Y(9.5), 6 * u, 4.4 * u, D);
  P.poly([[X(-4), Y(6)], [X(-14), Y(9)], [X(-13), Y(11.5)], [X(-2), Y(12)]], D);                // the upper jaw
  P.poly([[X(-2), Y(13)], [X(-11), Y(15.5)], [X(-9), Y(17)], [X(2), Y(15)]], D);                // the lower
  for (let a = -12; a <= -4; a += 2) { P.dot(X(a), Y(11.6), 0xffffff); P.dot(X(a + 1), Y(15), 0xffffff); }
  P.poly([[X(-1), Y(6)], [X(2), Y(-1)], [X(3.5), Y(5.5)]], 0x8a2a1c); P.poly([[X(3), Y(6.5)], [X(7.5), Y(2)], [X(6.5), Y(8)]], 0x8a2a1c);   // the horns
  P.rect(X(-3), Y(8), X(-3) + Math.max(2, 1.6 * u), Y(8) + Math.max(1, u), 0xffe14a);           // the eye
  P.line(X(0), Y(24), X(-6), Y(27), 1.6 * u, D); for (const a of [-8.5, -7.5, -6.5]) P.dot(X(a), Y(28 + (a + 8.5) * 0.5), 0xe9e2c8);       // an arm, its claws
  // the fire
  for (const [r, c] of [[2.6, 0x2a8cff], [1.5, 0x8fe6ff], [0.6, 0xffffff]]) P.line(X(-11), Y(13.3), X(-30), Y(31), r * u, c);
  P.ell(X(-30), Y(32), 5 * u, 3 * u, 0x8fe6ff); P.ell(X(-30), Y(32.5), 3 * u, 1.6 * u, 0xffffff);
  town(P, 11 * u, 77);
}
// DAIDAKO: the giant octopus, its arms round a tower, the moon behind
function daidako(P) {
  const { W, H } = P, u = H / 40, X = (v) => W * 0.5 + v * u, Y = (v) => v * u;
  sky(P, 0x061433, 0x0e5a6a);
  P.ell(X(-14), Y(9), 6 * u, 6 * u, 0xf2f0d0); P.ell(X(-12), Y(8), 5 * u, 5 * u, mix(0x061433, 0x0e5a6a, 0.2));
  const D = 0x4a176a, B = 0x7a2fa3, L = 0xc27be0, S = 0xf2b6e6;
  // the tower it has hold of
  P.rect(X(-21), Y(12), X(-17), H, 0xd9dde4); P.rect(X(-20), Y(8), X(-18), Y(12), 0xd9dde4); P.rect(X(-19.5), Y(3), X(-18.5), Y(8), 0xff5a4a);
  for (let y = 14; y < 40; y += 3) P.rect(X(-20), Y(y), X(-18), Y(y) + 1, 0x2a3a66);
  const arm = (x0, y0, x1, y1, bend, r0, ph = 0) => { const n = 26; for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t + Math.sin(t * 5 + ph) * bend * t, y = y0 + (y1 - y0) * t + Math.cos(t * 4 + ph) * bend * 0.5 * t, r = r0 * (1 - 0.7 * t); P.ell(X(x), Y(y), r * u, r * u, i % 4 === 0 ? B : D); if (i % 3 === 1) P.dot(X(x), Y(y), S); } };
  arm(-2, 28, -19, 14, 3, 3.2, 1); arm(-4, 31, -22, 26, 3, 3, 2.4); arm(8, 30, 26, 16, 3.5, 3.2, 0); arm(10, 32, 27, 34, 2.5, 3, 3); arm(2, 33, -8, 40, 2, 2.8, 4); arm(6, 33, 15, 41, 2, 2.8, 5);
  P.ell(X(4), Y(17), 12 * u, 13 * u, D); P.ell(X(3), Y(15), 9.5 * u, 10.5 * u, B); P.ell(X(0), Y(10), 4 * u, 3 * u, L);
  P.ell(X(4), Y(27), 9 * u, 5 * u, D);
  for (const a of [-1.5, 8]) { P.ell(X(a), Y(23), 3 * u, 2.4 * u, 0xffe14a); P.rect(X(a) - Math.max(1, u * 0.5), Y(21.2), X(a) + Math.max(1, u * 0.5), Y(24.8), 0x1a0a22); }
  for (let x = 0; x < W; x++) { const h = 2 + Math.round(Math.sin(x * 0.7) + Math.sin(x * 0.23) * 1.5); P.rect(x, H - h * u, x + 1, H, x % 5 === 0 ? 0xbfeaf0 : 0x0a3550); }
}
// MEKAO: the steel giant, head and shoulders, a fist up, rays behind
function mekao(P) {
  const { W, H } = P, u = H / 40, X = (v) => W * 0.5 + v * u, Y = (v) => v * u;
  P.rect(0, 0, W, H, 0x10245c);
  for (let i = 0; i < 16; i += 2) { const a0 = i / 16 * 6.283, a1 = (i + 1) / 16 * 6.283, R = W + H; P.poly([[X(2), Y(20)], [X(2) + Math.cos(a0) * R, Y(20) + Math.sin(a0) * R], [X(2) + Math.cos(a1) * R, Y(20) + Math.sin(a1) * R]], 0x1f48a8); }
  const S = 0xc9d2dc, D = 0x7c8794, R = 0xd8322a, Yl = 0xffd23a;
  P.poly([[X(-18), H], [X(-16), Y(26)], [X(-6), Y(22)], [X(10), Y(22)], [X(20), Y(26)], [X(22), H]], D);   // the shoulders and chest
  P.rect(X(-17), Y(25), X(-7), Y(31), R); P.rect(X(11), Y(25), X(21), Y(31), R);
  P.poly([[X(-3), Y(28)], [X(2), Y(36)], [X(7), Y(28)], [X(2), Y(31)]], Yl);
  P.rect(X(-1), Y(18), X(5), Y(23), D);                                                                    // the neck
  P.rect(X(-6), Y(5), X(10), Y(19), S); P.rect(X(-7), Y(8), X(-6), Y(15), D); P.rect(X(10), Y(8), X(11), Y(15), D);
  P.rect(X(-6), Y(3), X(10), Y(5), R); P.rect(X(1), Y(0), X(3), Y(5), R);                                   // a crest
  P.rect(X(-5), Y(9), X(9), Y(12), 0x0c1830); P.rect(X(-4), Y(10), X(8), Y(11), 0x5cf0ff);                  // the visor
  for (let a = -3; a <= 7; a += 2) P.rect(X(a), Y(14.5), X(a) + Math.max(1, u * 0.8), Y(18), D);            // the grille
  P.rect(X(-9), Y(6), X(-7), Y(12), Yl); P.rect(X(11), Y(6), X(13), Y(12), Yl);                              // its ears
  P.rect(X(-28), Y(8), X(-19), Y(17), S); for (let a = -27; a < -19; a += 2.4) P.rect(X(a), Y(8), X(a) + Math.max(1, u * 0.5), Y(12), D);   // the fist
  P.rect(X(-26), Y(17), X(-21), Y(40), D); P.rect(X(-27), Y(17), X(-20), Y(20), R);
}
// what the street sells
function ramen(P) { const { W, H } = P, cx = W * 0.5, cy = H * 0.66, r = Math.min(W * 0.36, H * 0.42); P.rect(0, 0, W, H, 0xb3261e); P.ell(cx, cy, r, r * 0.8, 0xf4efe2, cy); P.rect(cx - r * 0.4, cy + r * 0.72, cx + r * 0.4, cy + r * 0.9, 0xf4efe2); P.ell(cx, cy, r, r * 0.28, 0xf4efe2); P.ell(cx, cy, r * 0.86, r * 0.2, 0xf0c460); for (let a = -0.7; a < 0.75; a += 0.24) P.line(cx + r * a, cy - r * 0.08, cx + r * (a + 0.12), cy + r * 0.06, 0.5, 0xfff0a0); P.ell(cx + r * 0.4, cy - r * 0.02, r * 0.2, r * 0.1, 0xf07a8a); for (const a of [-0.35, 0.1, 0.5]) for (let t = 0; t < 1; t += 0.1) P.dot(cx + r * a + Math.sin(t * 7) * 1.6, cy - r * 0.45 - t * r * 0.7, 0xffffff); for (let y = cy - r * 0.1; y < cy + r * 0.6; y += 3) P.rect(cx - r * 0.86, y, cx + r * 0.86, y + 1, 0x2c4f8a); P.ell(cx, cy, r * 0.86, r * 0.2, 0xf0c460); }
function sushi(P) { const { W, H } = P; P.rect(0, 0, W, H, 0x101216); for (const [a, c, d] of [[0.3, 0xff6a3a, 0xffa27a], [0.7, 0xd8322a, 0xf06a5a]]) { const cx = W * a, cy = H * 0.66, rx = W * 0.15, ry = H * 0.12; P.ell(cx, cy + ry * 0.8, rx, ry, 0xf4f1e6); P.rect(cx - rx, cy, cx + rx, cy + ry * 0.8, 0xf4f1e6); P.ell(cx, cy - ry * 0.2, rx * 1.12, ry, c); for (let k = -0.6; k <= 0.6; k += 0.4) P.line(cx + rx * k, cy - ry, cx + rx * (k + 0.2), cy + ry * 0.4, 0.4, d); } P.rect(0, H - 3, W, H, 0x6a4a2a); }
function beer(P) { const { W, H } = P, cx = W * 0.46, w = Math.min(W * 0.2, H * 0.24), t = H * 0.36, b = H - 4; P.rect(0, 0, W, H, 0x154a9c); for (let i = 0; i < 20; i++) P.dot((i * 37) % W, (i * 53) % H, 0x5aa0e8); P.rect(cx - w, t, cx + w, b, 0xf2b21e); P.rect(cx - w, t, cx - w + 2, b, 0xffd66a); P.rect(cx + w, t + (b - t) * 0.2, cx + w + w * 0.5, t + (b - t) * 0.3, 0xdde6ee); P.rect(cx + w + w * 0.4, t + (b - t) * 0.2, cx + w + w * 0.6, t + (b - t) * 0.75, 0xdde6ee); P.rect(cx + w, t + (b - t) * 0.65, cx + w + w * 0.5, t + (b - t) * 0.75, 0xdde6ee); for (const [a, r] of [[-0.6, 0.55], [0, 0.7], [0.6, 0.55]]) P.ell(cx + w * a, t, w * r, w * r * 0.8, 0xffffff); for (let i = 0; i < 6; i++) P.dot(cx - w * 0.6 + (i * 5) % (w * 1.4), t + 4 + (i * 7) % Math.max(4, b - t - 6), 0xfff0a0); }
function karaoke(P) { const { W, H } = P, cx = W * 0.5, cy = H * 0.6, r = Math.min(W, H) * 0.14; P.rect(0, 0, W, H, 0x3a1466); for (let i = 0; i < 26; i++) P.dot((i * 29) % W, (i * 41) % H, i % 3 ? 0xff5ad0 : 0x5cf0ff); P.line(cx + r * 0.6, cy + r * 0.6, cx + r * 2.6, cy + r * 2.8, r * 0.45, 0x2a2c36); P.ell(cx, cy, r * 1.1, r * 1.1, 0xc9d2dc); for (let a = -1; a <= 1; a += 0.5) P.line(cx - r, cy + r * a, cx + r, cy + r * a, 0.3, 0x7c8794); for (const [a, b] of [[-2.6, -0.6], [2.4, -1.4]]) { P.ell(cx + r * a, cy + r * b, r * 0.4, r * 0.3, 0xffe14a); P.rect(cx + r * (a + 0.3), cy + r * (b - 1.6), cx + r * (a + 0.3) + 1, cy + r * b, 0xffe14a); } }
function pachinko(P) { const { W, H } = P; P.rect(0, 0, W, H, 0xffd23a); for (let y = 2; y < H; y += 6) for (let x = ((y / 6) & 1) * 3 + 2; x < W; x += 6) { P.ell(x + 0.5, y + 0.5, 2, 2, 0x9aa4b0); P.dot(x - 1, y - 1, 0xffffff); } P.rect(0, H * 0.3, W, H * 0.7, 0xd8322a); }
function neko(P) { const { W, H } = P, cx = W * 0.5, cy = H * 0.56, r = Math.min(W * 0.3, H * 0.34); P.rect(0, 0, W, H, 0xf2b21e); for (const s of [-1, 1]) { P.poly([[cx + s * r * 0.95, cy - r * 0.3], [cx + s * r * 0.8, cy - r * 1.35], [cx + s * r * 0.2, cy - r * 0.85]], 0xffffff); P.poly([[cx + s * r * 0.8, cy - r * 0.55], [cx + s * r * 0.72, cy - r * 1.1], [cx + s * r * 0.42, cy - r * 0.8]], 0xe0483a); } P.ell(cx, cy, r, r * 0.9, 0xffffff); for (const s of [-1, 1]) { P.line(cx + s * r * 0.56, cy - r * 0.1, cx + s * r * 0.42, cy - r * 0.24, 0.5, 0x101216); P.line(cx + s * r * 0.42, cy - r * 0.24, cx + s * r * 0.26, cy - r * 0.1, 0.5, 0x101216); for (const a of [-0.1, 0.12]) P.line(cx + s * r * 0.45, cy + r * (0.25 + a), cx + s * r * 1.15, cy + r * (0.2 + a * 2.4), 0.3, 0x6a6a6a); } P.ell(cx, cy + r * 0.12, r * 0.12, r * 0.08, 0xf07a8a); P.line(cx, cy + r * 0.2, cx, cy + r * 0.34, 0.4, 0x101216); for (const s of [-1, 1]) { P.line(cx, cy + r * 0.34, cx + s * r * 0.16, cy + r * 0.42, 0.4, 0x101216); P.line(cx + s * r * 0.16, cy + r * 0.42, cx + s * r * 0.3, cy + r * 0.32, 0.4, 0x101216); } P.rect(cx - r * 0.75, cy + r * 0.72, cx + r * 0.75, cy + r * 0.9, 0xd8322a); P.ell(cx, cy + r * 0.95, r * 0.17, r * 0.17, 0xffd23a); }

// name: [how it is drawn, its title, the title's colour and shade, where the title goes ('top' across the top, 'left'
// down the left side, 'foot' across the foot)]
const KINDS = {
  gaora: [gaora, 'ガオラ', 0xffe14a, 0x2a0508, 'top', '大カイジュウ'],
  daidako: [daidako, 'ダイダコ', 0xfff06a, 0x06102a, 'top', '大カイジュウ'],
  mekao: [mekao, 'メカオー', 0xffffff, 0x0a1230, 'top', ''],
  ramen: [ramen, 'ラーメン', 0xffffff, 0x5a0d0a, 'top', ''],
  sushi: [sushi, 'スシ', 0xffffff, null, 'top', ''],
  beer: [beer, 'ビール', 0xffffff, 0x0a2a5c, 'top', ''],
  karaoke: [karaoke, 'カラオケ', 0xfff06a, 0x1a0a30, 'top', ''],
  pachinko: [pachinko, 'パチンコ', 0xffffff, 0x5a0d0a, 'mid', ''],
  neko: [neko, 'ネコ', 0xb3261e, null, 'top', ''],
};
export const POSTERS = Object.keys(KINDS), FILMS = ['gaora', 'daidako', 'mekao'];
// a poster W by H (a landscape board or a tall one; the monsters want W >= H)
export function poster(kind, W, H) {
  const [draw, title, ink, shade, where, small] = KINDS[kind], P = pixels(W, H);
  const k = wordW(title, 3) + 8 <= W && H >= 80 ? 3 : wordW(title, 2) + 6 <= W && H >= 50 ? 2 : 1, tw = wordW(title, k), across = tw + 4 <= W;
  if (where === 'mid' || !across && wordH(title) + 4 > H) { draw(P); if (across) P.text(title, (W - tw) >> 1, (H - 7 * k) >> 1, ink, { k, shade }); }
  else {
    // the title in a band of its own (across the top, or down the left side of a tall board), the picture beside it
    const band = across ? 7 * k + 4 : 11, A = across ? pixels(W, H - band) : pixels(W - band, H);
    draw(A);
    for (let y = 0; y < A.H; y++) for (let x = 0; x < A.W; x++) { const i = (y * A.W + x) * 4; P.dot(x + (across ? 0 : band), y + (across ? band : 0), [A.d[i], A.d[i + 1], A.d[i + 2]]); }
    const dark = shade === null ? 0x101216 : shade;
    if (across) { P.rect(0, 0, W, band, dark); P.text(title, (W - tw) >> 1, 2, ink, { k }); } else { P.rect(0, 0, band, H, dark); P.text(title, 2, 3, ink, { down: true }); }
    if (small && across && wordW(small) + 4 <= W && H >= 36) { const q = H >= 80 ? 2 : 1; P.text(small, 3, H - 7 * q - 2, 0xffffff, { k: q, shade: 0x000000 }); }
  }
  // a frame
  for (let x = 0; x < W; x++) { P.dot(x, 0, 0x14151a); P.dot(x, H - 1, 0x14151a); } for (let y = 0; y < H; y++) { P.dot(0, y, 0x14151a); P.dot(W - 1, y, 0x14151a); }
  return P;
}
// a sign that hangs down a building's corner: a word written down a board of one colour, a border round it
export const SIGN_WORDS = ['ラーメン', 'スシ', 'カラオケ', 'ホテル', 'ゲーム', 'カメラ', 'パチンコ', 'タクシー', 'バー', 'サウナ', 'マンガ', 'アニメ', 'ソバ', 'ウドン', 'カレー', 'ビール', 'ネコ', 'トーキョー', 'サケ', 'ロボ'].filter((w) => [...w].every((c) => GLYPHS[c]));
export const SIGN_INKS = [[0xd8322a, 0xffffff], [0x101216, 0xffe14a], [0xffffff, 0xd8322a], [0x1f48a8, 0xffffff], [0x101216, 0xff5ad0], [0xffd23a, 0x101216], [0x101216, 0x5cf0ff], [0xe0489a, 0xffffff], [0x0e7a4a, 0xffffff], [0xff7a1e, 0x101216]];
export function sign(word, [board, ink], k = 1) {
  const W = 7 * k + 4, H = wordH(word, k) + 4, P = pixels(W, H, board);
  for (let x = 0; x < W; x++) { P.dot(x, 0, ink); P.dot(x, H - 1, ink); } for (let y = 0; y < H; y++) { P.dot(0, y, ink); P.dot(W - 1, y, ink); }
  P.text(word, 2, 2, ink, { down: true, k });
  return P;
}
