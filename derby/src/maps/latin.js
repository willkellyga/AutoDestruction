// Capital letters and figures five pixels by seven, drawn for this game's signs and posters (maps/nycart.js,
// maps/dcart.js), as maps/tokyoart.js has its katakana. No font is loaded. It writes onto a picture from pixels()
// (maps/tokyoart.js): anything with dot(x, y, colour).
const G = (s) => s.trim().split(/\s+/);
export const LATIN = {
  A: G('.XXX. X...X X...X XXXXX X...X X...X X...X'), B: G('XXXX. X...X X...X XXXX. X...X X...X XXXX.'),
  C: G('.XXX. X...X X.... X.... X.... X...X .XXX.'), D: G('XXXX. X...X X...X X...X X...X X...X XXXX.'),
  E: G('XXXXX X.... X.... XXXX. X.... X.... XXXXX'), F: G('XXXXX X.... X.... XXXX. X.... X.... X....'),
  G: G('.XXX. X...X X.... X.XXX X...X X...X .XXX.'), H: G('X...X X...X X...X XXXXX X...X X...X X...X'),
  I: G('XXXXX ..X.. ..X.. ..X.. ..X.. ..X.. XXXXX'), J: G('..XXX ...X. ...X. ...X. ...X. X..X. .XX..'),
  K: G('X...X X..X. X.X.. XX... X.X.. X..X. X...X'), L: G('X.... X.... X.... X.... X.... X.... XXXXX'),
  M: G('X...X XX.XX X.X.X X.X.X X...X X...X X...X'), N: G('X...X XX..X X.X.X X.X.X X..XX X...X X...X'),
  O: G('.XXX. X...X X...X X...X X...X X...X .XXX.'), P: G('XXXX. X...X X...X XXXX. X.... X.... X....'),
  Q: G('.XXX. X...X X...X X...X X.X.X X..X. .XX.X'), R: G('XXXX. X...X X...X XXXX. X.X.. X..X. X...X'),
  S: G('.XXXX X.... X.... .XXX. ....X ....X XXXX.'), T: G('XXXXX ..X.. ..X.. ..X.. ..X.. ..X.. ..X..'),
  U: G('X...X X...X X...X X...X X...X X...X .XXX.'), V: G('X...X X...X X...X X...X .X.X. .X.X. ..X..'),
  W: G('X...X X...X X...X X.X.X X.X.X XX.XX X...X'), X: G('X...X X...X .X.X. ..X.. .X.X. X...X X...X'),
  Y: G('X...X X...X .X.X. ..X.. ..X.. ..X.. ..X..'), Z: G('XXXXX ....X ...X. ..X.. .X... X.... XXXXX'),
  0: G('.XXX. X...X X..XX X.X.X XX..X X...X .XXX.'), 1: G('..X.. .XX.. ..X.. ..X.. ..X.. ..X.. .XXX.'),
  2: G('.XXX. X...X ....X ..XX. .X... X.... XXXXX'), 3: G('XXXX. ....X ....X .XXX. ....X ....X XXXX.'),
  4: G('...X. ..XX. .X.X. X..X. XXXXX ...X. ...X.'), 5: G('XXXXX X.... XXXX. ....X ....X X...X .XXX.'),
  6: G('.XXX. X.... X.... XXXX. X...X X...X .XXX.'), 7: G('XXXXX ....X ...X. ..X.. ..X.. ..X.. ..X..'),
  8: G('.XXX. X...X X...X .XXX. X...X X...X .XXX.'), 9: G('.XXX. X...X X...X .XXXX ....X ....X .XXX.'),
  '!': G('..X.. ..X.. ..X.. ..X.. ..X.. ..... ..X..'), '&': G('.XX.. X..X. X..X. .XX.. X.X.X X..X. .XX.X'),
  '.': G('..... ..... ..... ..... ..... ..... ..X..'), '-': G('..... ..... ..... XXXXX ..... ..... .....'),
  "'": G('..X.. ..X.. ..... ..... ..... ..... .....'), '*': G('..... X.X.X .XXX. XXXXX .XXX. X.X.X .....'),
  ':': G('..... ..X.. ..... ..... ..... ..X.. .....'), '$': G('..X.. .XXXX X.X.. .XXX. ..X.X XXXX. ..X..'),
  '/': G('....X ....X ...X. ..X.. .X... X.... X....'), '?': G('.XXX. X...X ....X ...X. ..X.. ..... ..X..'),
  ' ': G('..... ..... ..... ..... ..... ..... .....'),
};
// how wide and how tall a word is, written across (or down), k times the size
export const latinW = (s, k = 1) => (s.length * 6 - 1) * k;
export const latinH = (s, k = 1) => (s.length * 8 - 1) * k;
// write it on picture P at (x, y) in colour c; down: one letter under another; shade: a colour behind and below it
export function label(P, s, x, y, c, { k = 1, down = false, shade = null } = {}) {
  const put = (dx, dy, col) => [...s.toUpperCase()].forEach((ch, i) => {
    const g = LATIN[ch]; if (!g) return;
    const ox = down ? x : x + i * 6 * k, oy = down ? y + i * 8 * k : y;
    for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r][q] === 'X') P.rect(ox + q * k + dx, oy + r * k + dy, ox + q * k + dx + k, oy + r * k + dy + k, col);
  });
  if (shade !== null) put(k, k, shade);
  put(0, 0, c);
}
// centred across a picture W wide
export const centred = (P, s, y, c, o = {}) => label(P, s, Math.round((P.W - latinW(s, o.k || 1)) / 2), y, c, o);
