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
  P.poly = (pts, c, a) => {   // (a: laid over what is there, that much of it)
    let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9; for (const [x, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
      let inside = false; const px = x + 0.5, py = y + 0.5;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside; }
      if (inside) { if (a === undefined) dot(x, y, c); else P.over(x, y, c, a); }
    }
  };
  P.line = (x0, y0, x1, y1, r, c) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1; for (let i = 0; i <= n; i++) { const t = i / n; P.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, c); } };
  P.text = (s, x, y, c, { down = false, k = 1, shade = null } = {}) => { if (shade !== null) write((a, b) => dot(a + k, b + k, shade), s, x, y, down, k); write((a, b) => dot(a, b, c), s, x, y, down, k); };
  // (for the boards drawn two pixels to a voxel: finer tools)
  const at = (x, y) => { const i = (y * W + x) * 4; return (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; };
  P.at = at;
  // a colour laid over what is there, a of it (0..1)
  P.over = (x, y, c, a) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4, q = typeof c === 'number' ? hex(c) : c; d[i] += (q[0] - d[i]) * a; d[i + 1] += (q[1] - d[i + 1]) * a; d[i + 2] += (q[2] - d[i + 2]) * a; };
  // a glow: colour c over a disc, strongest in the middle, in `steps` rings
  P.glow = (cx, cy, r, c, a = 0.5, steps = 5) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const t = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r; if (t < 1) P.over(x, y, c, a * Math.ceil((1 - t) * steps) / steps); } };
  // a box in bands from one colour to another, the bands' edges broken up (a chequer of the two) so they do not read as stripes
  P.fade = (x0, y0, x1, y1, top, foot, bands = 8) => { const h = y1 - y0; for (let y = Math.floor(y0); y < y1; y++) { const f = (y - y0) / h * bands, b = Math.floor(f), edge = f - b > 0.75; for (let x = Math.floor(x0); x < x1; x++) dot(x, y, mix(top, foot, Math.min(1, (b + (edge && (x + y) % 2 ? 1 : 0)) / (bands - 1)))); } };
  // a round thing lit from up and to the left: tones from light to dark (the last is its shadowed edge)
  P.ball = (cx, cy, rx, ry, tones, lx = -0.5, ly = -0.6, top = -1e9, bot = 1e9) => { const n = tones.length; for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) { if (y < top || y >= bot) continue; const a = (x + 0.5 - cx) / rx, b = (y + 0.5 - cy) / ry, q = a * a + b * b; if (q > 1) continue; const t = 0.5 - (a * lx + b * ly) * 0.62 + q * 0.14 + ((x + y) % 2 ? 0.03 : -0.03); dot(x, y, tones[Math.max(0, Math.min(n - 1, Math.floor(t * n)))]); } };
  // every pixel of colour `ink` in a box: lit along its top edge, dark along its foot, t pixels thick (letters cut from metal)
  P.bevel = (x0, y0, x1, y1, ink, light, dark, t = 1) => {
    const I = typeof ink === 'number' ? ink : (ink[0] << 16) | (ink[1] << 8) | ink[2], is = new Uint8Array(W * H);
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, y1); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, x1); x++) if (at(x, y) === I) is[y * W + x] = 1;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, y1); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, x1); x++) { if (!is[y * W + x]) continue; if (y - t < 0 || !is[(y - t) * W + x]) dot(x, y, light); else if (y + t >= H || !is[(y + t) * W + x]) dot(x, y, dark); }
  };
  // a limb: a row of balls from one end to the other, r0 thick to r1
  P.limb = (x0, y0, x1, y1, r0, r1, tones, lx, ly) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, Math.min(r0, r1) * 0.5)) + 1; for (let i = 0; i <= n; i++) { const t = i / n, r = r0 + (r1 - r0) * t; P.ball(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, tones, lx, ly); } };
  // a burst: a star of n points, r1 out and r0 in
  P.star = (cx, cy, r0, r1, n, c, turn = 0, a) => { const pts = []; for (let i = 0; i < n * 2; i++) { const g = turn + i / (n * 2) * 6.2832, rr = i % 2 ? r0 : r1; pts.push([cx + Math.cos(g) * rr, cy + Math.sin(g) * rr]); } P.poly(pts, c, a); };
  P.rect(0, 0, W, H, bg);
  return P;
}
const mix = (a, b, t) => { const p = hex(a), q = hex(b); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]; };
const rnd = (seed) => { let s = seed | 0; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; }; };
// a sky in bands from one colour at the top to another at the foot
function sky(P, top, foot, bands = 7) { for (let y = 0; y < P.H; y++) { const t = Math.floor(y / P.H * bands) / (bands - 1); P.rect(0, y, P.W, y + 1, mix(top, foot, Math.min(1, t))); } }
// a town along the foot of a picture, black against the sky, a window lit here and there
function town(P, h, seed, lit = 0xffd66a, body = 0x0b0c14, k = 1, share = 0.3) {
  const r = rnd(seed); let x = 0;
  while (x < P.W) { const w = (3 + Math.floor(r() * 5)) * k, t = Math.round(P.H - h * (0.45 + r() * 0.55)); P.rect(x, t, x + w, P.H, body); if (k > 1 && r() < 0.3) P.rect(x + w * 0.4, t - 3 * k, x + w * 0.4 + 1, t, body); for (let y = t + k; y < P.H - k; y += 2 * k) for (let a = x + k; a < x + w - k; a += 2 * k) if (r() < share) P.rect(a, y, a + k, y + k, lit); x += w; }
}

// ---- the posters ----------------------------------------------------------------------------------------------------
// GAORA: the beast wading into the town at sundown, the plates down its back alight, its fire across the rooftops
function gaora(P) {
  const { W, H } = P, u = H / 40, X = (v) => W * 0.5 + v * u, Y = (v) => v * u, k = Math.max(1, Math.round(u / 1.5)), r = rnd(4);
  const G = [0x58b094, 0x2f7c68, 0x18493f, 0x0b2623], G2 = [0x2f7c68, 0x18493f, 0x0b2623], BELLY = [0xb9c88a, 0x8a9c62, 0x566a44];
  P.fade(0, 0, W, Y(25), 0x24051a, 0xd9421c, 10); P.fade(0, Y(25), W, H, 0xd9421c, 0xffb43a, 5);
  // the sun low behind it, cloud drawn across the sky
  P.glow(X(15), Y(24), 27 * u, 0xffc86a, 0.5, 6); P.ell(X(15), Y(24), 17 * u, 17 * u, 0xffd76a); P.ell(X(15), Y(24), 14.5 * u, 14.5 * u, 0xffefb4);
  for (const [a, b, l] of [[-30, 5, 16], [26, 3.5, 12], [-10, 9, 9], [38, 11, 14], [-40, 15, 10], [36, 20, 12], [-22, 20.5, 8]]) { P.ell(X(a), Y(b), l * u, 0.8 * u, 0x6a1226); P.ell(X(a + 2), Y(b + 0.9), l * 0.7 * u, 0.5 * u, 0x8a1c28); }
  for (const [a, b] of [[-28, -44], [-14, -4], [42, 30]]) P.poly([[X(a), H], [X(b - 3.5), 0], [X(b + 3.5), 0]], 0xfff2c0, 0.12);   // searchlights
  town(P, 15 * u, 41, 0xffa64a, 0x4a0e1c, k, 0.2);                                                    // the far town
  // the tail, up and over
  const tail = (t) => [20 + 25 * t, 35 - 23 * Math.sin(t * 1.8), 4.6 * (1 - t) + 0.7];
  for (let i = 0; i < 6; i++) { const [a, b, rr] = tail(0.2 + i * 0.13); P.poly([[X(a - rr), Y(b - rr * 0.4)], [X(a - rr * 0.2), Y(b - rr * 2.2)], [X(a + rr * 0.7), Y(b - rr * 0.8)]], 0x39c8c0); }
  for (let i = 40; i >= 0; i--) { const [a, b, rr] = tail(i / 40); P.ball(X(a), Y(b), rr * u, rr * u, G2, 0.5, -0.6); }
  // the plates, alight
  const PL = [[6.5, 6.5, 3], [10.5, 8, 4.6], [15, 11.5, 5.8], [19, 17, 5.6], [21.5, 23.5, 4.6], [23, 29, 3.4]];
  for (const [a, b, s] of PL) P.glow(X(a + s * 0.5), Y(b - s * 0.5), s * 1.9 * u, 0x7ffcff, 0.55, 4);
  for (const [a, b, s] of PL) { P.poly([[X(a - s * 0.75), Y(b + s * 0.2)], [X(a + s * 1.05), Y(b - s * 1.25)], [X(a + s * 0.75), Y(b + s * 1.0)]], 0x2fb4b4); P.poly([[X(a - s * 0.35), Y(b + s * 0.2)], [X(a + s * 0.8), Y(b - s * 0.85)], [X(a + s * 0.55), Y(b + s * 0.7)]], 0x8ff6e6); P.poly([[X(a), Y(b + s * 0.2)], [X(a + s * 0.6), Y(b - s * 0.5)], [X(a + s * 0.4), Y(b + s * 0.45)]], 0xeafffb); }
  // the far arm, the body, the belly
  P.limb(X(5), Y(21), X(-3), Y(21.5), 2.6 * u, 1.9 * u, G2, 0.5, -0.6);
  P.ball(X(13), Y(29), 11.5 * u, 15 * u, G, 0.55, -0.55); P.ball(X(16), Y(38), 8.5 * u, 9 * u, G, 0.55, -0.55);
  P.ball(X(7), Y(31), 6.6 * u, 11 * u, BELLY, 0.6, -0.5);
  for (let y = 22; y < 40; y += 2.4) P.poly([[X(1.2), Y(y)], [X(7), Y(y + 1.1)], [X(12.6), Y(y)], [X(12.6), Y(y + 0.55)], [X(7), Y(y + 1.65)], [X(1.2), Y(y + 0.55)]], 0x3f5234);
  // the neck and the head, the jaws wide
  P.limb(X(9.5), Y(19), X(3), Y(10.5), 5.6 * u, 4.4 * u, G, 0.55, -0.55);
  P.poly([[X(-2), Y(11)], [X(-14.5), Y(12.2)], [X(-12.5), Y(18.4)], [X(-1), Y(15.5)]], 0x5a0a16);       // the mouth
  P.glow(X(-9), Y(14.6), 5 * u, 0x8fe6ff, 0.9, 4);
  P.ball(X(0), Y(8.8), 6.8 * u, 4.9 * u, G, 0.55, -0.55);
  P.poly([[X(-3.5), Y(5.6)], [X(-13), Y(8.2)], [X(-15.8), Y(10.6)], [X(-15), Y(12.6)], [X(-2), Y(12)]], 0x18493f); P.poly([[X(-3.5), Y(5.6)], [X(-13), Y(8.2)], [X(-14.8), Y(9.6)], [X(-3), Y(8.6)]], 0x2f7c68);   // the upper jaw
  P.poly([[X(-1), Y(13.6)], [X(-11.8), Y(17.2)], [X(-13), Y(18.9)], [X(-9), Y(20.2)], [X(3), Y(16.5)]], 0x18493f); P.poly([[X(-8), Y(19.2)], [X(-9), Y(20.2)], [X(3), Y(16.5)], [X(3), Y(15.5)]], 0x0b2623);   // the lower
  for (let a = -14; a <= -4.5; a += 1.9) P.poly([[X(a - 0.7), Y(12.3)], [X(a + 0.7), Y(12.2)], [X(a + 0.1), Y(14.2)]], 0xfffbe8);
  for (let i = 0; i < 5; i++) { const a = -11.2 + i * 2, b = 17.2 - i * 0.62; P.poly([[X(a - 0.6), Y(b + 0.2)], [X(a + 0.7), Y(b - 0.25)], [X(a - 0.1), Y(b - 1.8)]], 0xfffbe8); }
  P.dot(X(-14.2), Y(10), 0x0b2623); P.rect(X(-14.4), Y(9.8), X(-14.4) + k, Y(9.8) + k, 0x0b2623);                                   // a nostril
  P.poly([[X(-7.4), Y(6.2)], [X(-2.6), Y(5.4)], [X(-3), Y(7)], [X(-6.6), Y(7.6)]], 0x0b2623); P.ell(X(-4.6), Y(7.2), 1.5 * u, 1.05 * u, 0xffe14a); P.rect(X(-5), Y(6.3), X(-5) + Math.max(1, 0.5 * u), Y(8.1), 0x24051a); P.glow(X(-4.6), Y(7.2), 3 * u, 0xffe14a, 0.35, 3);   // the brow and the eye
  for (const [a, b, c, d] of [[-0.5, 5.2, 3.2, -3.2], [3.6, 5.4, 9, -0.2], [6, 8, 11.5, 5.6]]) { P.poly([[X(a - 1.3), Y(b + 0.6)], [X(c), Y(d)], [X(a + 1.5), Y(b + 1)]], 0x7a2418); P.poly([[X(a - 0.3), Y(b + 0.4)], [X(c), Y(d)], [X(a + 0.8), Y(b + 0.6)]], 0xc8563a); }   // the horns
  // the near arm, reaching, its claws
  P.limb(X(8), Y(22.5), X(1), Y(27.5), 3.3 * u, 2.6 * u, G, 0.55, -0.55); P.limb(X(1), Y(27.5), X(-6), Y(25), 2.5 * u, 2 * u, G, 0.55, -0.55);
  for (const [a, b] of [[-9.4, 23.2], [-9.8, 25.2], [-9, 27.2]]) P.poly([[X(-6.6), Y(b * 0.5 + 12.4)], [X(a), Y(b)], [X(-6.2), Y(b * 0.5 + 13.6)]], 0xfffbe8);
  P.glow(X(-6), Y(17), 12 * u, 0x3a9cff, 0.3, 4);                                                    // its own fire's light on it
  // the fire: down across the town
  const bx0 = -11.5, by0 = 15.2, bx1 = -47, by1 = 37;
  for (let t = 0; t <= 1; t += 0.08) P.glow(X(bx0 + (bx1 - bx0) * t), Y(by0 + (by1 - by0) * t), 6.5 * u, 0x2a7cff, 0.3, 3);
  for (const [rr, c] of [[2.7, 0x2a8cff], [1.8, 0x7fd6ff], [0.95, 0xe6fbff]]) P.line(X(bx0), Y(by0), X(bx1), Y(by1), rr * u, c);
  for (let i = 0; i < 9; i++) { const t = 0.1 + r() * 0.8, a = bx0 + (bx1 - bx0) * t, b = by0 + (by1 - by0) * t, sd = r() < 0.5 ? 1 : -1, l = 2.5 + r() * 3; P.line(X(a + sd * 1.6), Y(b + sd * 2.6), X(a + sd * 1.6 - l * 0.6), Y(b + sd * 2.6 + sd * l * 0.5 + l * 0.3), Math.max(0.5, 0.25 * u), 0xcff4ff); }
  // the near town, and what the fire has done to it
  town(P, 9 * u, 77, 0xffd66a, 0x0b0c14, k, 0.3);
  P.glow(X(-43), Y(35), 17 * u, 0xff8a1e, 0.75, 6); P.star(X(-43), Y(35.5), 5 * u, 11 * u, 9, 0xffb21e, 0.3); P.star(X(-43), Y(35.5), 3.2 * u, 7.5 * u, 8, 0xffe76a, 0.9); P.ell(X(-43), Y(35.5), 3 * u, 3 * u, 0xffffff);
  for (let i = 0; i < 16; i++) { const g = -r() * 3.14, d = 7 + r() * 9, s = Math.max(1, Math.round((0.4 + r() * 0.8) * u)); P.rect(X(-43 + Math.cos(g) * d), Y(35.5 + Math.sin(g) * d * 0.8), X(-43 + Math.cos(g) * d) + s, Y(35.5 + Math.sin(g) * d * 0.8) + s, r() < 0.5 ? 0x1a0c10 : 0xffd23a); }
  for (const [a, b, smoke] of [[-27, 36.5, 0], [-17, 37, 0], [31, 35.5, 1], [43, 36.5, 1]]) {
    for (let i = 0; smoke && i < 7; i++) P.ell(X(a + i * 1.1 + Math.sin(i) * 0.8), Y(b - 3 - i * 2.4), (1.3 + i * 0.35) * u, (1.1 + i * 0.3) * u, i % 2 ? 0x2a0c18 : 0x3a1220);
    P.poly([[X(a - 2), Y(b)], [X(a - 1.2), Y(b - 4)], [X(a - 0.2), Y(b - 2)], [X(a + 0.6), Y(b - 5.5)], [X(a + 1.6), Y(b - 2.2)], [X(a + 2.4), Y(b - 3.6)], [X(a + 2.6), Y(b)]], 0xff7a1e); P.poly([[X(a - 1), Y(b)], [X(a - 0.4), Y(b - 2)], [X(a + 0.6), Y(b - 3.4)], [X(a + 1.4), Y(b - 1.4)], [X(a + 1.6), Y(b)]], 0xffe14a);
  }
  // jets coming in, and what they have let go
  for (const [a, b] of [[-36, 7.5], [-25, 4]]) { for (let i = 0; i < 14; i++) P.over(X(a - 2 - i), Y(b + 0.4), 0xffffff, 0.6 - i * 0.04); P.poly([[X(a + 3.2), Y(b + 0.5)], [X(a - 1.4), Y(b - 0.5)], [X(a - 2.6), Y(b - 1.6)], [X(a - 2), Y(b + 0.9)]], 0x180a12); P.line(X(a + 4), Y(b + 1.2), X(a + 11), Y(b + 3), Math.max(0.5, 0.2 * u), 0xffe9a6); }
  P.star(X(-9.5), Y(4.5), 1 * u, 2.6 * u, 6, 0xffe76a); P.star(X(14), Y(19), 1.2 * u, 3 * u, 6, 0xffe76a, 0.4); P.ell(X(14), Y(19), 1 * u, 1 * u, 0xffffff);
}
// DAIDAKO: the great octopus up out of the bay under the moon, a tower in one arm and a ferry in another
const bez = (p, t) => { const m = 1 - t; return [m * m * m * p[0] + 3 * m * m * t * p[2] + 3 * m * t * t * p[4] + t * t * t * p[6], m * m * m * p[1] + 3 * m * m * t * p[3] + 3 * m * t * t * p[5] + t * t * t * p[7]]; };
function daidako(P) {
  const { W, H } = P, u = H / 40, X = (v) => W * 0.5 + (v - (W < 30 * u ? 11.5 : 0)) * u, Y = (v) => v * u, k = Math.max(1, Math.round(u / 1.5)), r = rnd(9);
  const V = [0xd69af4, 0xa257cf, 0x6f2f9c, 0x40196a], V2 = [0x8a45b8, 0x5c2688, 0x36145a];
  P.fade(0, 0, W, H, 0x040a24, 0x0e5068, 10);
  for (let i = 0; i < 70; i++) { const x = Math.floor(r() * W), y = Math.floor(r() * H * 0.6), c = r() < 0.3 ? 0x9fd0ff : 0xffffff; P.over(x, y, c, 0.4 + r() * 0.6); if (r() < 0.12) { P.over(x - 1, y, c, 0.5); P.over(x + 1, y, c, 0.5); P.over(x, y - 1, c, 0.5); P.over(x, y + 1, c, 0.5); } }
  // the moon, cloud across it
  P.glow(X(-8), Y(13), 25 * u, 0xbfe6ff, 0.45, 6); P.ball(X(-8), Y(13), 14.5 * u, 14.5 * u, [0xfbfdee, 0xeef2d8, 0xdbe2c2], -0.5, -0.5);
  for (const [a, b, rr] of [[-13, 9, 2.6], [-4, 17, 3.4], [-10, 19, 1.6], [-2, 7, 1.8], [-16, 16, 1.4]]) { P.ell(X(a), Y(b), rr * u, rr * 0.85 * u, 0xccd6b6); P.ell(X(a + 0.3), Y(b + 0.3), rr * 0.75 * u, rr * 0.62 * u, 0xdde4c6); }
  for (const [a, b, l] of [[-30, 6, 14], [30, 9, 16], [-22, 21, 12], [38, 19, 10]]) { P.poly([[X(a - l), Y(b)], [X(a), Y(b - 1)], [X(a + l), Y(b)], [X(a), Y(b + 1)]], 0x0a1838, 0.8); }
  for (const [a, b] of [[40, 22], [-44, -30]]) P.poly([[X(a), Y(33)], [X(b - 3), 0], [X(b + 3), 0]], 0xd8f0ff, 0.1);
  // the far shore's lights, and the bay
  { const T = pixels(W, Math.round(Y(33))); T.rect(0, 0, W, T.H, 0xff00ff); town(T, 8 * u, 23, 0xffd66a, 0x071230, k, 0.35); for (let y = 0; y < T.H; y++) for (let x = 0; x < W; x++) { const c = T.at(x, y); if (c !== 0xff00ff) P.dot(x, y, c); } }
  P.fade(0, Y(33), W, H, 0x0c4a66, 0x04182e, 4);
  for (let i = 0; i < 26; i++) { const y = 33.4 + r() * 6, x = -8 + (r() - 0.5) * (6 + (y - 33) * 5); P.rect(X(x), Y(y), X(x) + (1 + r() * 3) * u, Y(y) + Math.max(1, 0.3 * u), 0xbfe6ff); }
  // the tower, pulled over
  const lean = (x, y) => [X(-34 + x + (34 - y) * 0.16), Y(y)], TR = 0xe8502a, TW2 = 0xf4efe6;
  for (let y = 4; y < 34; y += 0.25) { const w = 0.5 + (y - 4) * 0.17, [x0] = lean(-w, y), [x1, yy] = lean(w, y), c = Math.floor(y / 4) % 2 ? TW2 : TR; P.rect(x0, yy, x0 + Math.max(1, 0.5 * u), yy + 1, c); P.rect(x1 - Math.max(1, 0.5 * u), yy, x1, yy + 1, c); if (Math.abs((y % 2.5) - 1.2) < 0.2) P.rect(x0, yy, x1, yy + 1, c); else if (y > 8 && (Math.floor(y * 4) % 3 === 0)) { const f = ((y * 0.8) % 1); P.dot(x0 + (x1 - x0) * f, yy, c); P.dot(x1 - (x1 - x0) * f, yy, c); } }
  { const [a, b] = lean(0, 16), [c] = lean(0, 4); P.rect(a - 2.4 * u, b - u, a + 2.4 * u, b + 0.6 * u, 0xf4efe6); for (let x = -2; x < 2.4; x += 1) P.rect(a + x * u, b - 0.6 * u, a + x * u + Math.max(1, 0.5 * u), b, 0xffd66a); P.rect(c - Math.max(1, 0.2 * u), Y(0.5), c + Math.max(1, 0.2 * u), Y(4), TR); P.glow(c, Y(0.8), 2 * u, 0xff4a3a, 0.9, 3); }
  // an arm: a row of balls along a curve, cups down one side of it
  const arm = (p, r0, r1, tones, sd = 1) => {
    const n = 70; for (let i = 0; i <= n; i++) { const t = i / n, [x, y] = bez(p, t), rr = r0 + (r1 - r0) * t; P.ball(X(x), Y(y), rr * u, rr * u, tones, -0.6, -0.5); }
    for (let i = 2; i < n; i += 4) { const t = i / n, [x, y] = bez(p, t), [x2, y2] = bez(p, t + 0.01), dx = x2 - x, dy = y2 - y, l = Math.hypot(dx, dy) || 1, rr = r0 + (r1 - r0) * t, sx = x - dy / l * sd * rr * 0.5, sy = y + dx / l * sd * rr * 0.5; P.ell(X(sx), Y(sy), rr * 0.34 * u, rr * 0.34 * u, 0xf8c8ee); if (rr * u > 5) P.ell(X(sx), Y(sy), rr * 0.15 * u, rr * 0.15 * u, 0xb565c4); }
  };
  arm([2, 16, -8, 6, -18, 12, -21, 2], 3.6, 0.7, V2, -1); arm([22, 17, 34, 15, 38, 3, 47, 9], 3.6, 0.7, V2, 1);
  arm([18, 27, 31, 36, 43, 26, 35.5, 12], 4, 1.3, V2, 1);
  // the ferry it has taken out of the water
  { const cx = 34, cy = 8.5, T = (a, b) => [X(cx + a * 0.94 - b * 0.34), Y(cy + a * 0.34 + b * 0.94)], box = (a0, b0, a1, b1, c) => P.poly([T(a0, b0), T(a1, b0), T(a1, b1), T(a0, b1)], c);
    box(-7, 0.2, 7, 2.2, 0xd8322a); P.poly([T(7, 0.2), T(9, 0.2), T(7, 2.2)], 0xd8322a); box(-7, -0.4, 8.4, 0.3, 0x1a2440); box(-6, -2.6, 5.5, -0.4, 0xf4f1e6); box(-4, -4.4, 2, -2.6, 0xe2dfd4); box(-1.8, -6.6, -0.2, -4.4, 0xf2b21e); box(-1.8, -6.6, -0.2, -6, 0x1a2440);
    for (let a = -5.2; a < 5; a += 1.5) box(a, -2, a + 0.9, -1.1, 0xffd66a); for (let a = -3.2; a < 1.6; a += 1.5) box(a, -3.9, a + 0.8, -3.2, 0x7fc4ee);
    for (let i = 0; i < 12; i++) { const a = -8 + r() * 15, l = 1 + r() * 3.4; P.rect(X(cx + a), Y(cy + 3.4 + r() * 2), X(cx + a) + Math.max(1, 0.3 * u), Y(cy + 3.4 + l + 2), 0xbfe6ff); } }
  arm([35.5, 13, 33.5, 9.5, 36.5, 6.5, 39.5, 9.5], 1.5, 0.6, V, 1);
  arm([4, 27, -8, 35, -22, 33, -31, 21], 4.2, 1.6, V2, -1);
  for (const y of [15, 19.4]) { const [a, b] = lean(0, y); P.limb(a - 3.4 * u, b + 0.8 * u, a + 3.4 * u, b - 0.6 * u, 1.5 * u, 1.3 * u, V, -0.6, -0.5); }   // (round the tower, twice)
  // its head
  P.ball(X(12), Y(13), 13.5 * u, 12.5 * u, V, -0.6, -0.5); P.ball(X(11), Y(23.5), 11 * u, 7 * u, V, -0.6, -0.4);
  for (const [a, b, rr] of [[6, 5.5, 1.5], [12, 4, 1.1], [18, 6.5, 1.8], [21, 11, 1.2], [3.5, 10.5, 1.1], [15.5, 10, 0.9], [9.5, 8.5, 0.8], [20, 16, 0.9]]) P.ell(X(a), Y(b), rr * u, rr * 0.8 * u, 0xe9b4fb);
  P.poly([[X(3), Y(4.4)], [X(7), Y(2.3)], [X(11), Y(1.7)], [X(7.4), Y(3.4)], [X(4.4), Y(5.6)]], 0xf6dcff);                                       // the moon on its wet skin
  for (const [a, tilt] of [[5.2, 1], [16.4, -1]]) {
    P.glow(X(a), Y(22.4), 5 * u, 0xffe14a, 0.45, 4); P.ell(X(a), Y(22.4), 3.3 * u, 2.7 * u, 0x2a0c44); P.ell(X(a), Y(22.5), 2.9 * u, 2.3 * u, 0xffe14a); P.ell(X(a), Y(22.9), 2.9 * u, 1.9 * u, 0xffb21e, Y(22.9)); P.rect(X(a - 1.9), Y(22), X(a + 1.9), Y(23.1), 0x1a0a22); P.rect(X(a - 1.2), Y(21.7), X(a - 0.4), Y(22.2), 0xffffff);
    P.poly([[X(a - 4 * tilt), Y(18.6)], [X(a + 4 * tilt), Y(21.2)], [X(a + 4 * tilt), Y(19.6)], [X(a - 3.4 * tilt), Y(17.2)]], 0x40196a);          // a brow, drawn down
  }
  // the arms in front, out of the water
  arm([8, 29, 0, 43, -16, 43, -15, 28], 4.2, 1, V, -1); arm([-15, 28, -14.6, 25, -12, 24.5, -11.4, 27], 1, 0.5, V, -1);
  arm([15, 29, 22, 44, 40, 42, 44, 29], 4.2, 1, V, 1); arm([44, 29, 44.4, 26, 47, 25.6, 47, 28.6], 1, 0.5, V, 1);
  // the sea thrown up round it
  for (let i = 0; i < 46; i++) { const a = -20 + r() * 62, b = 34.5 + r() * 5.5, rr = (0.5 + r() * 1.3) * u; P.ell(X(a), Y(b), rr * 1.8, rr, r() < 0.5 ? 0xffffff : 0xbfeaf0); }
  for (let x = 0; x < W; x += 1) { const v = (x / u), h = 1.6 + Math.sin(v * 0.9) * 0.8 + Math.sin(v * 0.31 + 1) * 1.1; P.rect(x, H - h * u, x + 1, H, 0x06223c); if (Math.sin(v * 0.9) > 0.55) P.rect(x, H - h * u - Math.max(1, 0.4 * u), x + 1, H - h * u, 0xdff6fa); }
  for (let i = 0; i < 18; i++) { const a = -24 + r() * 70, b = 20 + r() * 14; P.over(X(a), Y(b), 0xdff6fa, 0.8); P.over(X(a), Y(b) + 1, 0xdff6fa, 0.5); }
}
// MEKAO: the steel giant, its fist at you, the sky behind it split in rays
function mekao(P) {
  const { W, H } = P, u = H / 40, X = (v) => W * 0.5 + (v - (W < 30 * u ? 11.5 : 0)) * u, Y = (v) => v * u, k = Math.max(1, Math.round(u / 1.5)), r = rnd(21), px = Math.max(1, Math.round(0.35 * u));
  const S = [0xf4f7fa, 0xc6d0dc, 0x8e9aac, 0x586478], SL = 0xf4f7fa, SM = 0xc6d0dc, SD = 0x8e9aac, SK = 0x586478, LN = 0x2a3246, RD = 0xe2362a, RDD = 0x9a1c1c, RL = 0xff7a5a, YL = 0xffd23a, YD = 0xc98f1e, CY = 0x5cf0ff;
  const quad = (a, c) => P.poly(a.map(([x, y]) => [X(x), Y(y)]), c);
  P.fade(0, 0, W, H, 0x0a1466, 0x2a58d0, 6);
  for (let i = 0; i < 20; i++) { const a0 = i / 20 * 6.2832 + 0.1, a1 = (i + 0.5) / 20 * 6.2832 + 0.1, R = W + H; P.poly([[X(12), Y(13)], [X(12) + Math.cos(a0) * R, Y(13) + Math.sin(a0) * R], [X(12) + Math.cos(a1) * R, Y(13) + Math.sin(a1) * R]], i % 2 ? 0x6fc0ff : 0x3f8cf4, i % 2 ? 0.7 : 0.5); }
  P.glow(X(12), Y(13), 26 * u, 0xfff6c0, 0.75, 7);
  for (let i = 0; i < 14; i++) { const a = -46 + r() * 92, b = r() * 30; P.star(X(a), Y(b), 0.4 * u, (1 + r() * 1.4) * u, 4, 0xffffff, 0.785); }
  { const T = pixels(W, H); T.rect(0, 0, W, H, 0xff00ff); town(T, 7 * u, 5, 0xffe9a6, 0x0a1440, k, 0.3); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = T.at(x, y); if (c !== 0xff00ff) P.dot(x, y, c); } }
  // the far arm, bent up, its fist by its head
  quad([[26, 24], [34, 22], [38, 12], [31, 11]], SD); quad([[26, 24], [34, 22], [35, 19.4], [27.4, 21]], SK); P.ball(X(31), Y(23), 4.6 * u, 4.6 * u, S, -0.5, -0.6);
  quad([[30.5, 3.5], [39.5, 4.5], [39, 12.5], [30, 11.5]], SM); quad([[30.5, 3.5], [39.5, 4.5], [39.4, 6], [30.4, 5]], SL); quad([[30, 10], [39, 11], [39, 12.5], [30, 11.5]], SD); for (const a of [32.7, 35, 37.2]) quad([[a, 4], [a + 0.4, 4], [a + 0.2, 8.6], [a - 0.2, 8.6]], LN); quad([[29.6, 11.5], [39.4, 12.6], [39.2, 14.4], [29.4, 13.2]], RD);
  // the chest
  quad([[-8, 40], [-5, 24], [3, 19.5], [21, 19.5], [29, 24], [32, 40]], SD); quad([[-5, 24], [3, 19.5], [21, 19.5], [29, 24], [27, 25.4], [20.4, 21.4], [3.6, 21.4], [-3, 25.4]], SL);
  quad([[-3.6, 25.5], [9.6, 23.4], [9.6, 33], [-5, 35]], RD); quad([[14.4, 23.4], [27.6, 25.5], [29, 35], [14.4, 33]], RD); quad([[-3.6, 25.5], [9.6, 23.4], [9.6, 24.8], [-3.9, 27]], RL); quad([[14.4, 23.4], [27.6, 25.5], [27.8, 27], [14.4, 24.8]], RL); quad([[-4.8, 33.4], [9.6, 31.4], [9.6, 33], [-5, 35]], RDD); quad([[14.4, 31.4], [28.8, 33.4], [29, 35], [14.4, 33]], RDD);
  quad([[2, 26], [12, 38.5], [22, 26], [19, 26], [12, 34.4], [5, 26]], YD); quad([[2.6, 26], [12, 37.6], [21.4, 26], [19.6, 26], [12, 35], [4.4, 26]], YL);
  P.glow(X(12), Y(28), 4.5 * u, CY, 0.7, 4); P.ball(X(12), Y(28), 2.2 * u, 2.2 * u, [0xffffff, CY, 0x1f9ad0], -0.5, -0.6);
  for (const [a, b] of [[-2, 37], [26, 37], [-3.4, 30], [27.6, 30]]) P.ell(X(a), Y(b), 0.5 * u, 0.5 * u, LN);
  quad([[8, 14], [16, 14], [17, 20], [7, 20]], SK); for (let y = 15; y < 20; y += 1.4) quad([[7.8, y], [16.2, y], [16.3, y + 0.5], [7.7, y + 0.5]], LN);   // the neck
  // the near shoulder
  P.ball(X(-6), Y(22.5), 7.4 * u, 6.6 * u, S, -0.5, -0.6); quad([[-12.6, 20.4], [0.4, 19.4], [0.8, 21.2], [-13, 22.4]], RD); for (const a of [-10, -6, -2]) P.ell(X(a), Y(25.4 + (a + 6) * (a + 6) * 0.03), 0.55 * u, 0.55 * u, LN);
  // the head: a helm, a visor alight, a crest
  quad([[3, 2.6], [21, 2.6], [22, 15], [17, 18.6], [7, 18.6], [2, 15]], SM); quad([[3, 2.6], [21, 2.6], [21.2, 5], [2.8, 5]], SL); quad([[2, 15], [7, 18.6], [17, 18.6], [22, 15], [21.6, 13.4], [17, 16.8], [7, 16.8], [2.4, 13.4]], SD); quad([[18.6, 5], [21.2, 5], [22, 15], [20, 16.4]], SD);
  quad([[1.6, 1.2], [22.4, 1.2], [21.6, 3.4], [2.4, 3.4]], RD); quad([[1.6, 1.2], [22.4, 1.2], [22.2, 1.9], [1.8, 1.9]], RL); quad([[10, -2], [14, -2], [13.4, 6.6], [10.6, 6.6]], RD); quad([[10, -2], [11.2, -2], [11.4, 6.6], [10.6, 6.6]], RL); quad([[12, 6.6], [10.6, 6.6], [12, 9]], RD), quad([[12, 6.6], [13.4, 6.6], [12, 9]], RDD);
  quad([[-1.6, 3], [2.4, 4.4], [2.2, 12.4], [-0.6, 10.4]], YL); quad([[21.6, 4.4], [25.6, 3], [24.6, 10.4], [21.8, 12.4]], YD); quad([[-1.6, 3], [-3.4, -3], [0, 3.6]], YL); quad([[25.6, 3], [27.4, -3], [24, 3.6]], YD);
  quad([[3.4, 7], [20.6, 7], [20.2, 11.4], [3.8, 11.4]], 0x0a1430); P.glow(X(12), Y(9.2), 9 * u, CY, 0.45, 4); quad([[4.4, 7.8], [11.2, 8.4], [11, 10.6], [5, 10.4]], CY); quad([[12.8, 8.4], [19.6, 7.8], [19, 10.4], [13, 10.6]], CY); quad([[4.4, 7.8], [11.2, 8.4], [11.2, 8.9], [4.5, 8.4]], 0xe6ffff); quad([[12.8, 8.4], [19.6, 7.8], [19.5, 8.4], [12.8, 8.9]], 0xe6ffff);
  P.star(X(18.4), Y(8.4), 0.5 * u, 3.4 * u, 4, 0xffffff, 0.785);
  for (let a = 7.6; a <= 15.8; a += 1.7) quad([[a, 12.8], [a + 0.9, 12.8], [a + 0.9, 16], [a, 16]], SK); quad([[6.4, 12.2], [17.6, 12.2], [17.6, 12.7], [6.4, 12.7]], LN);
  // the near arm, straight at you: the fist bigger than its head
  quad([[-10, 21], [-3, 25.5], [-17, 34], [-24, 22]], SD); quad([[-10, 21], [-3, 25.5], [-5, 26.6], [-11.4, 22.6]], SK);
  P.glow(X(-31), Y(24), 21 * u, 0xfff2a8, 0.35, 5);
  quad([[-26, 20.6], [-13.6, 19.6], [-12.6, 34.4], [-25, 36.4]], RD); quad([[-26, 20.6], [-13.6, 19.6], [-13.4, 21.6], [-25.8, 22.6]], RL); quad([[-25.2, 34.4], [-12.8, 32.6], [-12.6, 34.4], [-25, 36.4]], RDD);
  quad([[-46, 11], [-22, 9], [-20, 37], [-44, 40]], SM); quad([[-46, 11], [-22, 9], [-21.6, 13], [-45.8, 15]], SL); quad([[-22, 9], [-18.6, 11], [-17, 35.4], [-20, 37]], SK); quad([[-44.2, 36], [-20.2, 33.4], [-20, 37], [-44, 40]], SD);
  for (const a of [-40.2, -34.2, -28.2]) { quad([[a, 10.6], [a + 0.7, 10.5], [a + 1.5, 26], [a + 0.8, 26.1]], LN); }
  quad([[-45.6, 25.6], [-21, 23.2], [-20.9, 24], [-45.5, 26.4]], LN);
  for (const a of [-43.2, -37.2, -31.2, -25.2]) P.ball(X(a + 0.4), Y(18.4 - (a + 46) * 0.085), 2.3 * u, 2.3 * u, [SL, SM, SD], -0.5, -0.6);
  quad([[-46.6, 27.4], [-27, 25.6], [-25.4, 33.4], [-45.8, 35.6]], SL); quad([[-46.6, 27.4], [-27, 25.6], [-26.8, 26.5], [-46.5, 28.3]], 0xffffff); quad([[-45.9, 34.2], [-25.6, 32], [-25.4, 33.4], [-45.8, 35.6]], SD); quad([[-33, 26.1], [-32.3, 26], [-31.4, 33.2], [-32.1, 33.3]], LN);
  for (let i = 0; i < 9; i++) { const g = 2.2 + i * 0.26, d0 = 22, d1 = 27 + (i % 3) * 3; P.line(X(-33 + Math.cos(g) * d0), Y(24 + Math.sin(g) * d0 * 0.8), X(-33 + Math.cos(g) * d1), Y(24 + Math.sin(g) * d1 * 0.8), Math.max(0.5, 0.22 * u), 0xffffff); }
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
// s: pixels to a voxel (Will, 2026-11-25: "rerender the billboards in x2 detail ... the larger ones with images like
// the Kaiju and Musical ones"): the films are drawn at 2, and their rect on the sheet is still W by H voxels (P.s)
export function poster(kind, W0, H0, s = 1) {
  const [draw, title, ink, shade, where, small] = KINDS[kind], W = W0 * s, H = H0 * s, P = pixels(W, H); P.s = s;
  const k = (wordW(title, 3) + 8 <= W0 && H0 >= 80 ? 3 : wordW(title, 2) + 6 <= W0 && H0 >= 50 ? 2 : 1) * s, tw = wordW(title, k), across = tw + 4 * s <= W;
  const cut = (x0, y0, x1, y1, c, t) => P.bevel(x0, y0, x1, y1, c, mix(c, 0xffffff, 0.55), mix(c, 0x000000, 0.4), t);   // (big letters only)
  if (where === 'mid' || !across && wordH(title, s) + 4 * s > H) { draw(P); if (across) P.text(title, (W - tw) >> 1, (H - 7 * k) >> 1, ink, { k, shade }); }
  else {
    // the title in a band of its own (across the top, or down the left side of a tall board), the picture beside it
    const band = across ? 7 * k + 4 * s : 11 * s, A = across ? pixels(W, H - band) : pixels(W - band, H);
    draw(A);
    for (let y = 0; y < A.H; y++) for (let x = 0; x < A.W; x++) { const i = (y * A.W + x) * 4; P.dot(x + (across ? 0 : band), y + (across ? band : 0), [A.d[i], A.d[i + 1], A.d[i + 2]]); }
    const dark = shade === null ? 0x101216 : shade;
    if (across) { P.rect(0, 0, W, band, dark); if (k >= 4) P.text(title, ((W - tw) >> 1) + (k >> 1), 2 * s + (k >> 1), 0x000000, { k }); P.text(title, (W - tw) >> 1, 2 * s, ink, { k }); if (k >= 4) cut(0, 0, W, band, ink, k >> 2); } else { P.rect(0, 0, band, H, dark); P.text(title, 2 * s, 3 * s, ink, { down: true, k: s }); }
    if (small && across && wordW(small, s) + 4 * s <= W && H0 >= 36 && (s === 1 || H0 >= 80)) { const q = H0 >= 80 ? 2 : 1, tx = s > 1 ? W - wordW(small, q) - 5 * s : 3, ty = H - 7 * q - (s > 1 ? 3 : 2) * s; if (s > 1) for (let y = ty - 3; y < ty + 7 * q + 3; y++) for (let x = tx - 4; x < W - s; x++) P.over(x, y, 0x000000, 0.6); P.text(small, tx, ty, 0xffffff, { k: q, shade: 0x000000 }); }
  }
  // a frame
  P.rect(0, 0, W, s, 0x14151a); P.rect(0, H - s, W, H, 0x14151a); P.rect(0, 0, s, H, 0x14151a); P.rect(W - s, 0, W, H, 0x14151a);
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
