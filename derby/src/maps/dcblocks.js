// Capital Circuit's city off the course (maps/capital.js), with the builder Midnight Tokyo's was written for
// (maps/cityblocks.js). Will, 2026-11-25: "the same final pass to both washington DC and New York". The first cut
// (maps/blocks.js) had a window five voxels by eight in a floor of twelve and nothing on the walls or the roofs. These
// are Washington's, by day, a floor eight voxels and a bay eight:
//   lime    a federal department in limestone: a tall window between piers, a blind half down here and there
//   marble  white marble: a column to every bay and the window deep between them
//   tan     a buff brick apartment house: sash windows in pairs over stone sills
//   brick   Georgetown: red brick, a white sash window between dark shutters, a flat arch over it
//   brown   a painted house front, cream, the same windows under round heads, green shutters
//   glass   an office block downtown: ribbons of window with the sky in them, between bands of concrete
// It is the low city it is: nothing has a mast or a tank or a billboard on it. What it has instead (dress, below):
// slate roofs and chimneys on the houses, a copper roof gone green on a department here and there, a porch of columns
// under a pediment on the ministries that face the course, museum banners down the fronts, and a flag on the roof.
import * as THREE from 'three';
import { poster, POSTERS, FILMS, sign, SIGN_WORDS, SIGN_INKS, flagUS, flagDC } from './dcart.js';
import { BAY, FLOOR, TW, TH, SHOP, rnd, tex, atlas, makeCityBlocks } from './cityblocks.js';

export const STYLES = ['lime', 'marble', 'tan', 'brick', 'brown', 'glass'];
const CAP = { lime: [0.86, 0.82, 0.72], marble: [0.95, 0.95, 0.92], tan: [0.82, 0.74, 0.58], brick: [0.9, 0.88, 0.82], brown: [0.93, 0.91, 0.85], glass: [0.72, 0.72, 0.7] };
const GLASS = ['#27384a', '#2d4054', '#33495e'], SKY = ['#5f86ac', '#6f9cc4', '#86b0d4', '#a2c6e2'], BLIND = '#d9d4c4';

function fronts(kind, seed) {
  const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
  const g = cv.getContext('2d'), r = rnd(seed), pick = (a) => a[Math.floor(r() * a.length)];
  const px = (X, Y, col) => { g.fillStyle = col; g.fillRect(X, TH - 1 - Y, 1, 1); };
  for (let fl = 0; fl < TH / FLOOR; fl++) for (let b = 0; b < TW / BAY; b++) {
    const gl = pick(GLASS), blind = r() < 0.3 ? 1 + Math.floor(r() * 3) : 0, pair = [r() < 0.25 ? 1 + Math.floor(r() * 2) : 0, r() < 0.25 ? 1 + Math.floor(r() * 2) : 0], cloud = r() < 0.3, box = r() < 0.18;
    for (let y = 0; y < FLOOR; y++) for (let x = 0; x < BAY; x++) {
      const X = b * BAY + x, Y = fl * FLOOR + y;
      if (kind === 'lime') {
        const win = x >= 2 && x <= 5 && y >= 1 && y <= 6;
        if (win) px(X, Y, y > 6 - blind ? BLIND : y === 6 ? '#55708a' : y === 4 ? '#1c2836' : gl);
        else if (x === 0 || x === 7) px(X, Y, x ? '#cdc3aa' : '#e6ddc8');                     // the pier, lit on one edge
        else if (y === 7) px(X, Y, '#e9e1cd');
        else if (y === 0) px(X, Y, '#b9af97');
        else px(X, Y, x === 1 ? '#b3a98f' : '#c4baa1');                                       // (the window's reveal, in shade)
      } else if (kind === 'marble') {
        if (x <= 1) px(X, Y, x ? '#d3d2cc' : '#f4f3ee');                                      // the column
        else if (x === 2 || x === 7) px(X, Y, '#b9b8b2');
        else if (y === 0) px(X, Y, '#dcdad2');
        else if (y === 7) px(X, Y, '#c2c1ba');
        else px(X, Y, y > 6 - blind ? BLIND : y === 6 ? '#4f6a84' : y === 3 ? '#1c2836' : gl);
      } else if (kind === 'tan') {
        const w = x < 4 ? 0 : 1, win = (x === 1 || x === 2 || x === 5 || x === 6) && y >= 2 && y <= 6;
        if (win) px(X, Y, y > 6 - pair[w] ? BLIND : y === 6 ? '#55708a' : y === 4 ? '#e8e0cc' : gl);
        else if (y === 1 && x >= 1 && x <= 6 && x !== 3 && x !== 4) px(X, Y, '#e6dcc4');
        else if (fl % 4 === 0 && y === 0) px(X, Y, '#e2d6ba');
        else px(X, Y, (x + y * 3) % 5 === 0 ? '#b8905e' : (x * 2 + y) % 7 === 0 ? '#d2aa76' : '#c69c6a');
      } else if (kind === 'brick' || kind === 'brown') {
        const cream = kind === 'brown', win = x >= 2 && x <= 5 && y >= 2 && y <= 5, round = cream && y === 6 && (x === 3 || x === 4);
        if (win || round) px(X, Y, y === 4 ? '#f2eee2' : y > 5 - Math.min(blind, 2) && blind && !round ? BLIND : y >= 5 ? '#55708a' : gl);
        else if ((x === 1 || x === 6) && y >= 2 && y <= 5) px(X, Y, cream ? (y % 2 ? '#2f5a40' : '#24482f') : y % 2 ? '#1c1e22' : '#26282e');   // the shutters
        else if (y === 1 && x >= 1 && x <= 6) px(X, Y, '#f2eee2');                            // the sill
        else if (y === 6 && x >= 2 && x <= 5) px(X, Y, cream ? '#f6f2e6' : '#e6d8c2');        // the head
        else if (box && y === 1) px(X, Y, '#f2eee2');
        else if (cream) px(X, Y, (x + y * 2) % 6 === 0 ? '#d9c690' : '#e6d49c');
        else px(X, Y, (x + y * 2 + (y & 1) * 2) % 4 === 0 ? '#86402f' : (x * 3 + y) % 7 === 0 ? '#ad5a44' : '#9a4a38');
        if (box && y === 2 && x >= 2 && x <= 5) px(X, Y, (x + b) % 2 ? '#e2456a' : '#3f8a3c');   // a window box in flower
      } else {   // glass: the sky in a ribbon of window
        if (y <= 1 || y === 7) px(X, Y, y === 1 ? '#aaa598' : y === 7 ? '#d6d1c4' : '#c6c1b4');
        else if (x % 4 === 0) px(X, Y, '#3a4a5a');
        else px(X, Y, cloud && y >= 4 && (x + b) % 3 ? '#dfeaf2' : SKY[y - 2 + (y > 4 ? -1 : 0)] || SKY[3]);
      }
      const n = r(); g.fillStyle = n < 0.5 ? '#000' : '#fff'; g.globalAlpha = 0.07 * Math.abs(n - 0.5) * 2; g.fillRect(X, TH - 1 - Y, 1, 1); g.globalAlpha = 1;
    }
  }
  return [tex(cv), null];
}
// the street floor, eight bays under a painted fascia: a cafe and a bookshop under awnings, a house door with a
// fanlight over it, a bank between its columns, a pub, a flower shop, an arched window, a shop with bunting in it
function street() {
  const cv = document.createElement('canvas'); cv.width = TW; cv.height = SHOP;
  const g = cv.getContext('2d'), r = rnd(1791), pick = (a) => a[Math.floor(r() * a.length)];
  const px = (X, Y, col) => { g.fillStyle = col; g.fillRect(X, SHOP - 1 - Y, 1, 1); };
  const KINDS = ['cafe', 'door', 'books', 'bank', 'pub', 'flowers', 'arch', 'bunting'];
  for (let b = 0; b < TW / BAY; b++) {
    const kind = KINDS[b], awn = pick(['#1f4f3a', '#7a1f24', '#1f3560', '#c9a03a']), board = pick(['#1c3a2c', '#1a2a4a', '#5a161a', '#22242a']);
    for (let y = 0; y < SHOP; y++) for (let x = 0; x < BAY; x++) {
      const X = b * BAY + x;
      if (kind === 'bank') px(X, y, x === 0 || x === 7 || x === 3 || x === 4 ? (x % 2 ? '#d2cfc6' : '#f0eee6') : y >= 10 ? '#e2dfd6' : y >= 9 ? '#b9b6ae' : y < 1 ? '#c9c6bc' : y < 8 ? '#27384a' : '#8a6a2a');
      else if (y >= 10) px(X, y, kind === 'door' || kind === 'arch' ? '#e6dcc4' : x >= 1 && x <= 6 && (x * 5 + b) % 3 === 0 && y === 10 ? '#e8c860' : board);
      else if (x === 0) px(X, y, '#8a8478');
      else if (kind === 'door') px(X, y, x >= 3 && x <= 5 && y <= 6 ? (x === 5 && y === 3 ? '#e8c860' : y % 3 === 0 ? '#12301f' : '#1a4a2e') : x >= 3 && x <= 5 && y <= 8 ? '#6f9cc4' : x >= 2 && x <= 6 && y <= 9 ? '#f2eee2' : (x + y * 2) % 4 === 0 ? '#86402f' : '#9a4a38');
      else if (kind === 'arch') px(X, y, x >= 2 && x <= 6 && y >= 2 && y <= 8 && !(y === 8 && (x === 2 || x === 6)) ? (y === 5 || x === 4 ? '#f2eee2' : y > 5 ? '#55708a' : '#2d4054') : y < 2 ? '#b9af97' : '#d9cfb8');
      else if (kind === 'pub') px(X, y, x >= 5 && y <= 7 ? (y >= 5 ? '#c9a03a' : '#3a1c12') : y >= 3 && y <= 7 && x >= 1 && x <= 3 ? (y === 5 || x === 2 ? '#2a1a12' : '#c98f3e') : '#4a2416');
      else if (y >= 8) px(X, y, kind === 'flowers' ? (x % 2 ? '#e88aa8' : '#f6f0e6') : x % 2 ? awn : '#f0e8d8');     // the awning
      else if (y < 2) px(X, y, kind === 'flowers' ? pick(['#e2456a', '#f2b21e', '#f6f0e6', '#3f8a3c', '#9a5ac8']) : '#6a655c');
      else if (kind === 'bunting' && y === 7) px(X, y, ['#b22234', '#f6f3ea', '#2a3a78'][x % 3]);
      else if (kind === 'books' && y <= 4) px(X, y, y === 4 ? '#3a2a1c' : pick(['#7a1f24', '#1f3560', '#c9a03a', '#2f5a40', '#e8e0cc']));
      else if (kind === 'cafe' && y <= 3 && (x === 2 || x === 5)) px(X, y, y === 3 ? '#e8e0cc' : '#2a2c30');           // a table at the window
      else px(X, y, y === 7 ? '#55708a' : x === 4 ? '#3a4a5a' : pick(GLASS));
      const n = r(); g.fillStyle = n < 0.5 ? '#000' : '#fff'; g.globalAlpha = 0.07 * Math.abs(n - 0.5) * 2; g.fillRect(X, SHOP - 1 - y, 1, 1); g.globalAlpha = 1;
    }
  }
  const t = tex(cv); t.wrapT = THREE.ClampToEdgeWrapping; return [t, null];
}
function sheet() {
  const A = atlas(), out = { signs: [], bigs: [], films: { wide: [], great: [], tall: [] }, ads: { wide: [], great: [], tall: [] }, hero: [], flags: [] };
  const add = (P, list) => list.push(A.add(P));
  SIGN_WORDS.forEach((w, i) => { add(sign(w, SIGN_INKS[i]), out.signs); if (w.length <= 5) add(sign(w, SIGN_INKS[i], 2), out.bigs); });
  for (const k of POSTERS) { const to = FILMS.includes(k) ? out.films : out.ads; add(poster(k, 64, 40), to.wide); add(poster(k, 28, 44), to.tall); if (FILMS.includes(k)) add(poster(k, 96, 56), to.great); }
  for (const k of FILMS) add(poster(k, 144, 84), out.hero);
  add(flagUS(), out.flags); add(flagDC(), out.flags);
  const t = A.pack(), rects = (l) => l.map((it) => it.rect);
  return { tex: t, hero: rects(out.hero), signs: rects(out.signs), bigs: rects(out.bigs), flags: rects(out.flags), films: { wide: rects(out.films.wide), great: rects(out.films.great), tall: rects(out.films.tall) }, ads: { wide: rects(out.ads.wide), great: rects(out.films.great), tall: rects(out.ads.tall) } };
}
const SLATE = [0.3, 0.32, 0.37], SLATE2 = [0.22, 0.24, 0.28], COPPER = [0.4, 0.66, 0.56], COPPER2 = [0.3, 0.52, 0.44], STONE = [0.93, 0.92, 0.88], STONE2 = [0.78, 0.77, 0.73], WIND = [0.8, 0.6];
function dress(B, { r, kind, floors, near, roof, cap, box, flat, hung, wave, SIDE, A, SHOWN, DARK }) {
  const [x0, z0, x1, z1, y] = roof, w = x1 - x0, d = z1 - z0, top = y + 1.5, house = kind === 'brick' || kind === 'brown', pick = (a) => a[Math.floor(r() * a.length)];
  const s = !B.toward ? 2 : Math.abs(B.toward[0]) > Math.abs(B.toward[1]) ? (B.toward[0] > 0 ? 1 : 3) : B.toward[1] > 0 ? 2 : 0, S = SIDE(s, B.x0, B.z0, B.x0 + B.w, B.z0 + B.d);
  const p = (t, o) => [S.ox + S.ax * t + S.nx * o, S.oz + S.az * t + S.nz * o], along = (t0, o0, t1, o1, ya, yb, side, up = side) => { const a = p(t0, o0), c = p(t1, o1); box(a[0], a[1], c[0], c[1], ya, yb, side, up); };
  // a house's roof: slate, in steps up to a ridge along its length, and a chimney at each end
  if (house && near < 900) {
    const ns = d > w, n = near < 420 ? 3 : 2, half = (ns ? w : d) / 2, rise = Math.min(4, half * 0.5);
    for (let i = 0; i < n; i++) { const a = half * i / n; if (ns) box(x0 - 1 + a, z0 - 1, x1 + 1 - a, z1 + 1, top + i * rise, top + (i + 1) * rise, SLATE2, SLATE); else box(x0 - 1, z0 - 1 + a, x1 + 1, z1 + 1 - a, top + i * rise, top + (i + 1) * rise, SLATE2, SLATE); }
    if (near < 500) for (const e of [0.12, 0.88]) { const cx = ns ? x0 + w * 0.3 : x0 + w * e, cz = ns ? z0 + d * e : z0 + d * 0.3; box(cx - 1.6, cz - 1.6, cx + 1.6, cz + 1.6, top, top + n * rise + 4, [0.5, 0.25, 0.19], [0.2, 0.18, 0.17]); }
  }
  // a department's roof of copper, gone green (and a lantern on the big ones)
  else if ((kind === 'lime' || kind === 'marble') && r() < 0.45 && w >= 24 && d >= 24 && near < 900) {
    box(x0 + 3, z0 + 3, x1 - 3, z1 - 3, top, top + 5, COPPER2, COPPER); box(x0 + 6, z0 + 6, x1 - 6, z1 - 6, top + 5, top + 7, COPPER2, COPPER);
    if (w >= 56 && d >= 56 && near < 600) { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; box(cx - 7, cz - 7, cx + 7, cz + 7, top + 7, top + 16, STONE, STONE2); box(cx - 8, cz - 8, cx + 8, cz + 8, top + 16, top + 17.5, STONE2, COPPER); box(cx - 5, cz - 5, cx + 5, cz + 5, top + 17.5, top + 22, COPPER2, COPPER); box(cx - 2, cz - 2, cx + 2, cz + 2, top + 22, top + 26, COPPER2, COPPER); }
  }
  if (near > 520) return;
  const wallTop = floors * FLOOR;
  // a ministry that faces the course: a porch of columns under a pediment, up a flight of steps
  let porch = false;
  if (B.plain && (kind === 'lime' || kind === 'marble') && S.L >= 40 && wallTop >= 48 && near < 420) {
    porch = true;
    const n = S.L >= 72 ? 6 : 4, gap = 8, W = (n - 1) * gap + 4, t0 = Math.round((S.L - W) / 2 / BAY) * BAY + (BAY - 4) / 2 - 2, h = Math.min(wallTop - 14, 44), col = kind === 'marble' ? STONE : cap, sh = col.map((v) => v * 0.82);
    along(t0 - 3, 0, t0 + W + 3, 7, 0, 1.5, sh, col); along(t0 - 1.5, 0, t0 + W + 1.5, 5.5, 1.5, 3, sh, col);
    for (let i = 0; i < n; i++) { const t = t0 + i * gap; along(t + 0.6, 2.4, t + 3.4, 5, 3, 3 + h, col.map((v) => v * 0.9), col); along(t, 2, t + 4, 5.4, 3 + h - 1.5, 3 + h, sh, col); }
    along(t0 - 1.5, 0, t0 + W + 1.5, 6, 3 + h, 3 + h + 4, col, sh);
    for (let i = 0; i < 4; i++) { const a = (W / 2 + 2.5) * i / 4; along(t0 - 2.5 + a, 0, t0 + W + 2.5 - a, 6.5, 3 + h + 4 + i * 2, 3 + h + 6 + i * 2, col.map((v) => v * (0.97 - i * 0.02)), sh); }
  }
  // museum banners down the front, on the piers between the windows (either side of the porch where there is one)
  if (!house && kind !== 'glass' && near < 330 && S.L >= (porch ? 64 : 32) && r() < (B.plain ? 0.75 : 0.4)) {
    const fits = (wallTop >= 104 ? [...A.bigs, ...A.signs] : A.signs).filter((R) => R[5] + SHOP + 12 <= wallTop), n = porch ? 2 : Math.max(1, Math.min(3, Math.floor((S.L - 16) / 24)));
    const R0 = fits.length ? pick(fits) : null;
    for (let i = 0; R0 && i < n; i++) {
      const R = i === 0 || r() < 0.5 ? R0 : pick(fits), [, , , , bw, bh] = R, mid = porch ? (i ? S.L - 10 : 10) : S.L / 2 + (i - (n - 1) / 2) * 24, t = Math.round(mid / BAY) * BAY - bw / 2, yb = wallTop - bh - 6;
      flat(S, t, 0.7, yb, R, SHOWN); along(t - 1, 0, t + bw + 1, 1.1, yb + bh, yb + bh + 0.8, DARK); along(t - 0.6, 0, t + bw + 0.6, 0.9, yb - 0.6, yb, DARK);
    }
  }
  // Georgetown: a banner hung out over a shop here and there
  if (house && !B.plain && near < 170 && r() < 0.45 && wallTop >= 48) { const R = pick(A.signs); if (R[5] + SHOP + 6 <= wallTop) hung(S, r() < 0.5 ? 3 : S.L - 3, SHOP + 3, R); }
  // and a flag on the roof: the Stars and Stripes on the ministries, the District's on the rest (all flying one way)
  if (near < 520 && w >= 16 && d >= 16 && (B.plain ? r() < 0.4 : r() < 0.1)) {
    const mid = p(S.L / 2, -3 - (roof[0] - B.x0)), F = A.flags[B.plain || r() < 0.5 ? 0 : 1], ph = 25 + r() * 6;
    wave(mid[0], mid[1], top, ph, F, WIND[0], WIND[1], 0.7);
  }
}
const KIT = {
  key: 'dc', styles: STYLES, cap: CAP, fronts, street, sheet, dress,
  glow: null, lit: [1, 1, 1], shown: [0.98, 0.98, 0.98], heroLit: [1, 1, 1], roof: [0.5, 0.5, 0.48], boardLamp: [0.46, 0.47, 0.5],
  mast: false, redLamps: false, tankShare: 0, hang: null, board: [0, 0, 0], poster: [0.3, 0.1, 0.35],
  ledge: { lime: [4, 0.9], marble: [4, 1], tan: [4, 0.6], brick: [20, 0.5], brown: [20, 0.5], glass: [2, 0.7] },
};
export const makeDcBlocks = (scene, list, clock = { value: 0 }, heroes = []) => makeCityBlocks(scene, list, KIT, clock, heroes);
