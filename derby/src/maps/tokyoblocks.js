// Midnight Tokyo's city off the course (maps/tokyo.js). Will, 2026-11-25, of the first cut (maps/blocks.js, the New
// York fronts): "some buildings are just too low ploy looking", "more low poly background buildings", and "it doesn't
// feel japanese enough ... Could we have Kaiju on billboards?" Those fronts had a window five voxels by eight in a
// floor of twelve, twice the size of anything on the voxel buildings beside them, and nothing stood off the wall.
//
// So these are still boxes nothing can reach, a picture on every side a voxel to a pixel, but:
//   - the fronts are Tokyo's and fine: a floor is eight voxels, a bay eight with two or four lights in it. Six kinds:
//     white tile offices with ribbon windows lit a run of bays at a time, cool white; blocks of flats, a balcony and a
//     lit door to each; glass towers; pencil buildings with small windows and their air conditioners; red brick with
//     pale bands; black glass. A street floor of shop windows under their curtains, shutters, vending machines and red
//     lanterns.
//   - things stand off them: a slab to every floor of the flats and a ledge every few floors of an office (near the
//     course), railings, air conditioners, tanks and masts on the roofs, a red light on the tall ones;
//   - and they carry signs (maps/tokyoart.js): words in katakana down boards that hang out from the corners, lit from
//     inside; great lit billboards on the roofs and posters on the walls that face the course: the monster films and
//     what the street sells.
// One mesh a kind of front, one for the street floors, one for everything plain, one for the signs and one for the lamps.
//
// makeTokyoBlocks(scene, list)   list: { x0, z0, w, d, h, style, seed, plain, near, toward: [x, z] }
//   near: how far the course is (the detail and the signs are for the near ones); toward: the way to it
import * as THREE from 'three';
import { poster, POSTERS, FILMS, sign, SIGN_WORDS, SIGN_INKS } from './tokyoart.js';

const BAY = 8, FLOOR = 8, TW = 64, TH = 96, SHOP = 12;
export const STYLES = ['office', 'flats', 'glass', 'pencil', 'brick', 'dark'];
const rnd = (seed) => { let s = seed | 0; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; }; };
const COOL = ['#eaf4ff', '#d8ecff', '#f3fbff', '#fff4dc'], WARM = ['#ffd98a', '#ffe6b0', '#ffc66a', '#fff0cc'];
const CAP = { office: [0.62, 0.64, 0.67], flats: [0.66, 0.62, 0.56], glass: [0.2, 0.25, 0.3], pencil: [0.56, 0.54, 0.5], brick: [0.7, 0.66, 0.58], dark: [0.12, 0.13, 0.15] };
// how many floors a block of this height has, and where its roof is: its top tier [x0, z0, x1, z1, y]
export function shapeOf(B) {
  const floors = Math.max(3, Math.round(B.h / FLOOR)), m = Math.min(B.w, B.d), cut = floors >= 30 && m >= 40 ? [0.5, 0.8, 1] : floors >= 18 && m >= 32 ? [0.66, 1] : [1], in_ = (cut.length - 1) * BAY;
  return { floors, cut, roof: [B.x0 + in_, B.z0 + in_, B.x0 + B.w - in_, B.z0 + B.d - in_, floors * FLOOR] };
}

// a front: [the picture, what of it is lit]. A cell is a bay of a floor, x 0..7 across and y 0..7 up.
function fronts(kind, seed) {
  const cv = document.createElement('canvas'), ev = document.createElement('canvas'); cv.width = ev.width = TW; cv.height = ev.height = TH;
  const g = cv.getContext('2d'), e = ev.getContext('2d'), r = rnd(seed), pick = (a) => a[Math.floor(r() * a.length)];
  e.fillStyle = '#000'; e.fillRect(0, 0, TW, TH);
  const px = (X, Y, col, lit = 0) => { g.fillStyle = col; g.fillRect(X, TH - 1 - Y, 1, 1); if (lit) { e.fillStyle = col; e.globalAlpha = lit; e.fillRect(X, TH - 1 - Y, 1, 1); e.globalAlpha = 1; } };
  for (let fl = 0; fl < TH / FLOOR; fl++) {
    // an office floor is lit a run of bays at a time; a glass tower has floors that are mostly lit and floors mostly dark
    let run = 0, on = false, col = COOL[0], dim = 1; const busy = r() < 0.3 ? 0.6 : 0.18;
    for (let b = 0; b < TW / BAY; b++) {
      if (--run < 0) { run = Math.floor(r() * 4); on = r() < 0.36; col = pick(COOL); dim = 0.7 + r() * 0.3; }
      const flat = r() < 0.32, fcol = pick(WARM), fdim = 0.6 + r() * 0.4, ac = r() < 0.4, half = [r() < busy, r() < busy], hcol = [pick(r() < 0.75 ? COOL : WARM), pick(COOL)], tone = r() < 0.5, wl = [r() < 0.3, r() < 0.3], club = r() < 0.5 ? pick(['#ff5ad0', '#5cf0ff', '#ffe14a', '#eaf4ff']) : pick(COOL);
      for (let y = 0; y < FLOOR; y++) for (let x = 0; x < BAY; x++) {
        const X = b * BAY + x, Y = fl * FLOOR + y;
        if (kind === 'office') {
          if (y <= 2) px(X, Y, y === 2 ? '#e3e6e8' : x % 4 === 0 ? '#b9bec2' : '#cdd1d4');
          else if (y === 7) px(X, Y, '#6f767d');
          else if (x === 0 || x === 4) px(X, Y, x ? '#7f868d' : '#aab0b5');
          else if (on) px(X, Y, y === 6 ? '#ffffff' : col, (y === 6 ? 1 : 0.8) * dim); else px(X, Y, y === 6 ? '#1b2836' : '#22303f');
        } else if (kind === 'flats') {
          if (x === 0) px(X, Y, '#b7a892');
          else if (y === 7) px(X, Y, '#c9bba4');
          else if (y <= 2) px(X, Y, y === 2 ? '#ebe6da' : (x + fl) % 3 ? '#cfc7b6' : '#c2b9a6');
          else if (x >= 2 && x <= 5 && y <= 6) { if (flat) px(X, Y, x <= 3 ? fcol : '#fff6dc', (x <= 3 ? 0.55 : 1) * fdim); else px(X, Y, '#18212c'); }
          else if (ac && x >= 6 && y === 3) px(X, Y, '#9aa0a6');
          else px(X, Y, '#3a352f');
        } else if (kind === 'glass' || kind === 'dark') {
          const dk = kind === 'dark', h = x < 4 ? 0 : 1, lit = dk ? wl[h] && half[h] || (wl[0] && wl[1]) : half[h];
          if (x % 4 === 0) px(X, Y, dk ? '#2a2f38' : '#3b4b5b');
          else if (y <= 1) px(X, Y, dk ? '#1c2129' : '#1b2c3c');
          else if (lit) px(X, Y, dk ? club : hcol[h], y === 7 ? 1 : 0.75); else px(X, Y, dk ? (tone ? '#16283a' : '#1b3044') : tone ? '#27455e' : '#2d516b');
        } else if (kind === 'pencil') {
          const win = (x === 1 || x === 2 || x === 5 || x === 6) && y >= 3 && y <= 6, w = x < 4 ? 0 : 1;
          if (win) { if (wl[w]) px(X, Y, w ? fcol : col, 0.9); else px(X, Y, '#1c2530'); }
          else if (ac && x >= 1 && x <= 2 && y >= 1 && y <= 2) px(X, Y, y === 2 ? '#a3a8ad' : '#7d8388');
          else px(X, Y, y === 0 ? '#a29c90' : x === 0 ? '#aaa498' : '#b8b2a6');
        } else {   // brick
          const win = x >= 2 && x <= 5 && y >= 2 && y <= 6 && !(y === 6 && (x === 2 || x === 5));
          if (win) { if (flat) px(X, Y, fcol, fdim); else px(X, Y, '#1a222c'); }
          else if (y === 7 || (y === 1 && x >= 2 && x <= 5)) px(X, Y, '#d8cdb8');
          else px(X, Y, (x + y * 2 + (y & 1) * 2) % 4 === 0 ? '#7a3c2e' : '#8f4937');
        }
        // a voxel's worth of grain
        const n = r(); g.fillStyle = n < 0.5 ? '#000' : '#fff'; g.globalAlpha = 0.1 * Math.abs(n - 0.5) * 2; g.fillRect(X, TH - 1 - Y, 1, 1); g.globalAlpha = 1;
      }
    }
  }
  return [tex(cv), tex(ev)];
}
// the street floor: eight bays, each a shop window under its curtain with a red lantern at the door, a shutter down for
// the night, a vending machine or a doorway; a lit band of signs over them
function street() {
  const cv = document.createElement('canvas'), ev = document.createElement('canvas'); cv.width = ev.width = TW; cv.height = ev.height = SHOP;
  const g = cv.getContext('2d'), e = ev.getContext('2d'), r = rnd(8823), pick = (a) => a[Math.floor(r() * a.length)];
  e.fillStyle = '#000'; e.fillRect(0, 0, TW, SHOP);
  const px = (X, Y, col, lit = 0) => { g.fillStyle = col; g.fillRect(X, SHOP - 1 - Y, 1, 1); if (lit) { e.fillStyle = col; e.globalAlpha = lit; e.fillRect(X, SHOP - 1 - Y, 1, 1); e.globalAlpha = 1; } };
  const KINDS = ['shop', 'shop', 'shutter', 'vend', 'shop', 'door', 'shop', 'shutter'];
  for (let b = 0; b < TW / BAY; b++) {
    const kind = KINDS[b], cloth = pick(['#1f3a6e', '#a8262a', '#e8e2d0', '#1f3a6e', '#2f6b4a']), band = pick(['#ffe14a', '#ff5a4a', '#eaf4ff', '#5cf0ff', '#ff5ad0', '#ffffff']), can = pick(['#d8322a', '#eef6ff', '#1f48a8']);
    for (let y = 0; y < SHOP; y++) for (let x = 0; x < BAY; x++) {
      const X = b * BAY + x;
      if (y >= 10) { if (kind !== 'shutter' && x >= 1 && x <= 6) px(X, y, (x + y) % 3 === 0 ? '#1a1c22' : band, 0.9); else px(X, y, '#2c2e35'); }
      else if (x === 0) px(X, y, '#4a4640');
      else if (kind === 'shutter') px(X, y, y === 9 ? '#3a3c42' : y % 2 ? '#7a8088' : '#666c74');
      else if (kind === 'vend') { if (x >= 2 && x <= 5 && y <= 7) { if (y >= 3 && y <= 6) px(X, y, (x + y) % 2 ? '#eef6ff' : pick(['#d8322a', '#f2b21e', '#1f48a8', '#0e7a4a']), 1); else px(X, y, can, y === 7 ? 0.5 : 0.25); } else px(X, y, '#33353c'); }
      else if (kind === 'door') px(X, y, x >= 3 && x <= 5 && y <= 7 ? (y >= 5 ? '#ffe6b0' : '#5b4a3c') : '#3a3c42', x >= 3 && x <= 5 && y >= 5 && y <= 7 ? 0.8 : 0);
      else if (y >= 8) px(X, y, x % 3 === 1 && y === 8 ? '#e8e2d0' : cloth, cloth === '#e8e2d0' ? 0.3 : 0);                    // the curtain over the door
      else if (x === 7 && y >= 5 && y <= 7) px(X, y, '#ff3a26', 1);                                                           // a red lantern
      else if (y < 2) px(X, y, '#55504a');
      else px(X, y, y < 4 && r() < 0.5 ? '#c98f3e' : '#ffd98a', y < 4 ? 0.6 : 1);
      const n = r(); g.fillStyle = n < 0.5 ? '#000' : '#fff'; g.globalAlpha = 0.08 * Math.abs(n - 0.5) * 2; g.fillRect(X, SHOP - 1 - y, 1, 1); g.globalAlpha = 1;
    }
  }
  const t = tex(cv), u = tex(ev); t.wrapT = u.wrapT = THREE.ClampToEdgeWrapping; return [t, u];
}
function tex(c) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// every sign and poster on one sheet: { tex, signs: [small boards], bigs: [boards twice the size], films / ads: { wide,
// great, tall } }, each [u0, v0, u1, v1, w, h]
function sheet() {
  const AW = 512, AH = 512, cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
  const g = cv.getContext('2d'), all = [], out = { signs: [], bigs: [], films: { wide: [], great: [], tall: [] }, ads: { wide: [], great: [], tall: [] } };
  const add = (P, list) => { const it = { P, rect: null }; all.push(it); list.push(it); };
  SIGN_WORDS.forEach((w, i) => { add(sign(w, SIGN_INKS[i % SIGN_INKS.length]), out.signs); add(sign(w, SIGN_INKS[(i * 3 + 4) % SIGN_INKS.length]), out.signs); if (w.length <= 4) add(sign(w, SIGN_INKS[(i * 7 + 1) % SIGN_INKS.length], 2), out.bigs); });
  for (const k of POSTERS) { const to = FILMS.includes(k) ? out.films : out.ads; add(poster(k, 64, 40), to.wide); add(poster(k, 28, 44), to.tall); if (FILMS.includes(k)) add(poster(k, 96, 56), to.great); }
  out.ads.great = out.films.great; out.hero = [];
  for (const k of FILMS) add(poster(k, 144, 84), out.hero);
  all.sort((a, b) => b.P.H - a.P.H);
  let x = 1, y = 1, row = 0;
  for (const it of all) {
    const { W, H, d } = it.P;
    if (x + W + 1 > AW) { x = 1; y += row + 2; row = 0; }
    if (y + H + 1 > AH) { it.rect = all[0].rect; continue; }
    g.putImageData(new ImageData(d, W, H), x, y);
    it.rect = [x / AW, 1 - (y + H) / AH, (x + W) / AW, 1 - y / AH, W, H]; x += W + 2; row = Math.max(row, H);
  }
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  const rects = (l) => l.map((it) => it.rect);
  return { tex: t, hero: rects(out.hero), signs: rects(out.signs), bigs: rects(out.bigs), films: { wide: rects(out.films.wide), great: rects(out.films.great), tall: rects(out.films.tall) }, ads: { wide: rects(out.ads.wide), great: rects(out.films.great), tall: rects(out.ads.tall) } };
}

// a side of a box, seen from outside: where its left end is, the way along it and the way out
// (0 the north side, 1 east, 2 south, 3 west)
export const SIDE = (s, x0, z0, x1, z1) => (s === 0 ? { ox: x1, oz: z0, ax: -1, az: 0, nx: 0, nz: -1, L: x1 - x0 } : s === 1 ? { ox: x1, oz: z1, ax: 0, az: -1, nx: 1, nz: 0, L: z1 - z0 } : s === 2 ? { ox: x0, oz: z1, ax: 1, az: 0, nx: 0, nz: 1, L: x1 - x0 } : { ox: x0, oz: z0, ax: 0, az: 1, nx: -1, nz: 0, L: z1 - z0 });

export function makeTokyoBlocks(scene, list, clock = { value: 0 }, heroes = []) {
  const bufs = {}, mk = () => ({ pos: [], uv: [], col: [], nor: [], idx: [], bl: [] });
  let BL = 0;   // how the sign being drawn blinks: 0 steady, 1..99 on and off (its own beat), 100 and up a tube that flickers
  const plain = mk(), shop = mk(), signs = mk(), lamps = mk();
  const buf = (k) => bufs[k] || (bufs[k] = mk());
  const quad = (b, P, n, col, uv) => {
    const i = b.pos.length / 3; b.pos.push(...P); for (let k = 0; k < 4; k++) { b.nor.push(...n); b.col.push(...col); } if (uv) b.uv.push(...uv); else b.uv.push(0, 0, 0, 0, 0, 0, 0, 0);
    b.idx.push(i, i + 1, i + 2, i, i + 2, i + 3); b.bl.push(BL, BL, BL, BL);
  };
  const walls = (b, x0, z0, x1, z1, y0, y1, col, ou, ov, th = TH) => {
    const v0 = (y0 + ov) / th, v1 = (y1 + ov) / th, U = (a, c) => [(a + ou) / TW, v0, (c + ou) / TW, v0, (c + ou) / TW, v1, (a + ou) / TW, v1];
    quad(b, [x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], [0, 0, -1], col, U(0, x1 - x0));
    quad(b, [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1], col, U(0, x1 - x0));
    quad(b, [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0], col, U(0, z1 - z0));
    quad(b, [x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [1, 0, 0], col, U(0, z1 - z0));
  };
  const box = (x0, z0, x1, z1, y0, y1, side, top = side, to = plain) => {
    if (x0 > x1) [x0, x1] = [x1, x0]; if (z0 > z1) [z0, z1] = [z1, z0];
    quad(to, [x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], [0, 0, -1], side); quad(to, [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1], side);
    quad(to, [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0], side); quad(to, [x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [1, 0, 0], side);
    quad(to, [x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0], [0, 1, 0], top);
  };
  const A = sheet(), WHITE = [1, 1, 1], ROOF = [0.13, 0.13, 0.15], STEEL = [0.2, 0.21, 0.24], DARK = [0.06, 0.06, 0.07], UNIT = [0.5, 0.52, 0.55];
  const LIT = [1.55, 1.55, 1.55], SHOWN = [1.05, 1.05, 1.05];   // a board lit from inside, and one with lamps on it
  // a picture on side S, from t along it and o out from it, y0 up: flat on the wall
  const flat = (S, t, o, y0, R, col) => {
    const [u0, v0, u1, v1, w, h] = R, p = (tt) => [S.ox + S.ax * tt + S.nx * o, S.oz + S.az * tt + S.nz * o], a = p(t), b = p(t + w);
    quad(signs, [a[0], y0, a[1], b[0], y0, b[1], b[0], y0 + h, b[1], a[0], y0 + h, a[1]], [S.nx, 0, S.nz], col, [u0, v0, u1, v0, u1, v1, u0, v1]);
  };
  // a board that hangs out from side S at t along it, its foot at y0: the picture on both its faces
  const hung = (S, t, y0, R) => {
    const [u0, v0, u1, v1, w, h] = R, p = (tt, o) => [S.ox + S.ax * tt + S.nx * o, S.oz + S.az * tt + S.nz * o];
    const a = p(t + 0.52, 1 + w), b = p(t + 0.52, 1), c = p(t - 0.52, 1), d = p(t - 0.52, 1 + w), UV = [u0, v0, u1, v0, u1, v1, u0, v1];
    quad(signs, [a[0], y0, a[1], b[0], y0, b[1], b[0], y0 + h, b[1], a[0], y0 + h, a[1]], [S.ax, 0, S.az], LIT, UV);
    quad(signs, [c[0], y0, c[1], d[0], y0, d[1], d[0], y0 + h, d[1], c[0], y0 + h, c[1]], [-S.ax, 0, -S.az], LIT, UV);
    const e = p(t - 0.5, 0), f = p(t + 0.5, 1 + w); box(e[0], e[1], f[0], f[1], y0 - 0.4, y0 + h + 0.4, DARK);
    for (const yy of [y0 + 2, y0 + h - 3]) { const q = p(t - 0.3, 0), s = p(t + 0.3, 1); box(q[0], q[1], s[0], s[1], yy, yy + 1, STEEL); }
  };
  for (const B of list) {
    const r = rnd((B.seed * 2654435761) | 0), kind = STYLES.includes(B.style) ? B.style : 'office', b = buf(kind), cap = CAP[kind], t = 0.86 + r() * 0.2, tint = [t, t * (0.97 + r() * 0.05), t * (0.95 + r() * 0.06)];
    const ou = Math.floor(r() * 8) * BAY, ov = Math.floor(r() * 12) * FLOOR, { floors, cut } = shapeOf(B), near = B.near ?? 1e9, close = near < 210;
    let y = 0, x0 = B.x0, z0 = B.z0, x1 = B.x0 + B.w, z1 = B.z0 + B.d;
    cut.forEach((k, i) => {
      const top = Math.round(floors * k) * FLOOR;
      walls(b, x0, z0, x1, z1, y, top, tint, ou, ov);
      box(x0 - 0.8, z0 - 0.8, x1 + 0.8, z1 + 0.8, top, top + 1.5, cap, ROOF);
      if (i === 0 && !B.plain) { walls(shop, x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, 0, SHOP, WHITE, ou, 0, SHOP); box(x0 - 1.4, z0 - 1.4, x1 + 1.4, z1 + 1.4, SHOP, SHOP + 1, cap.map((v) => v * 0.7)); }
      else if (i === 0) box(x0 - 0.6, z0 - 0.6, x1 + 0.6, z1 + 0.6, 0, 2, cap.map((v) => v * 0.8));
      // what stands off the wall, near the course: the flats' balcony slabs, a ledge every few floors of the others
      if (close) {
        const f0 = Math.round(y / FLOOR) + (i === 0 ? 2 : 1), f1 = Math.round(top / FLOOR), step = kind === 'flats' ? 1 : kind === 'glass' || kind === 'dark' ? 6 : 3, out = kind === 'flats' ? 1.3 : 0.6;
        for (let f = f0; f < f1; f += step) box(x0 - out, z0 - out, x1 + out, z1 + out, f * FLOOR - 1, f * FLOOR, cap.map((v) => v * 0.92), cap.map((v) => v * 0.6));
      }
      y = top; if (i < cut.length - 1) { x0 += BAY; z0 += BAY; x1 -= BAY; z1 -= BAY; }
    });
    // on the roof: a parapet, the lift's house, air conditioners, a tank; on a tall one a mast and a red light
    const w = x1 - x0, d = z1 - z0, cx = x0 + w * (0.3 + r() * 0.4), cz = z0 + d * (0.3 + r() * 0.4);
    if (near < 500) for (const [a0, c0, a1, c1] of [[x0, z0, x1, z0 + 0.6], [x0, z1 - 0.6, x1, z1], [x0, z0, x0 + 0.6, z1], [x1 - 0.6, z0, x1, z1]]) box(a0, c0, a1, c1, y + 1.5, y + 3.5, cap.map((v) => v * 0.85), ROOF);
    if (w >= 16 && d >= 16) box(cx - 4, cz - 3, cx + 4, cz + 3, y + 1.5, y + 7 + r() * 4, cap.map((v) => v * 0.8), ROOF);
    if (near < 400) for (let n = 1 + Math.floor(r() * 4); n > 0; n--) { const ax = x0 + 2 + r() * (w - 7), az = z0 + 2 + r() * (d - 7); box(ax, az, ax + 3, az + 3, y + 1.5, y + 4, UNIT, [0.3, 0.31, 0.33]); }
    if (kind !== 'glass' && kind !== 'dark' && r() < 0.5 && w >= 24 && near < 700) { const tx = x0 + 5 + r() * (w - 10), tz = z0 + 5 + r() * (d - 10); for (const [a, c] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) box(tx + a - 0.3, tz + c - 0.3, tx + a + 0.3, tz + c + 0.3, y + 1.5, y + 6, STEEL); box(tx - 2.6, tz - 2.6, tx + 2.6, tz + 2.6, y + 6, y + 11, [0.62, 0.64, 0.6], [0.4, 0.42, 0.4]); }
    if (floors >= 18 && near < 1000) { const h = 14 + r() * 26; box(cx - 0.6, cz - 0.6, cx + 0.6, cz + 0.6, y + 7, y + 7 + h, STEEL); box(cx - 1, cz - 1, cx + 1, cz + 1, y + 7 + h, y + 9 + h, [3, 0.3, 0.2], [3, 0.3, 0.2], lamps); for (const [a, c] of [[x0, z0], [x1, z1]]) box(a - 0.8, c - 0.8, a + 0.8, c + 0.8, y + 3.5, y + 5, [3, 0.3, 0.2], [3, 0.3, 0.2], lamps); }
    // the signs, on the side that faces the course
    if (near > 330 || !B.toward) continue;
    const s = Math.abs(B.toward[0]) > Math.abs(B.toward[1]) ? (B.toward[0] > 0 ? 1 : 3) : B.toward[1] > 0 ? 2 : 0, S0 = SIDE(s, B.x0, B.z0, B.x0 + B.w, B.z0 + B.d), S1 = SIDE(s, x0, z0, x1, z1), low = Math.round(floors * cut[0]) * FLOOR, pick = (a) => a[Math.floor(r() * a.length)];
    // boards down the corners (a great one on a tall front)
    const n = near < 150 ? 1 + (r() < 0.65 ? 1 : 0) : r() < 0.6 ? 1 : 0, ends = r() < 0.5 ? [3, S0.L - 3] : [S0.L - 3, 3];
    for (let k = 0; k < n; k++) {
      const big = low >= 104 && r() < 0.6, R = pick(big ? A.bigs : A.signs); if (R[5] + 18 > low) continue;
      BL = r() < 0.16 ? 1 + Math.floor(r() * 98) : r() < 0.08 ? 100 + Math.floor(r() * 98) : 0;
      hung(S0, ends[k], Math.min(low - R[5] - 3, 15 + Math.floor(r() * 3) * FLOOR + (big ? 8 : 0)), R); BL = 0;
    }
    // and, near the course, more of them one above another all the way along the front (Will's reference: a street
    // of signs hung out from every floor)
    if (near < 190) for (let tt = 3 + (ends[0] < 10 ? 16 : 0); tt < S0.L - 3; tt += 16) {
      if (Math.abs(tt - ends[0]) < 8 || (n > 1 && Math.abs(tt - ends[1]) < 8)) continue;
      for (let yy = 15 + Math.floor(r() * 2) * 4, m = 0; m < 4; m++) { const R = pick(A.signs); if (yy + R[5] + 4 > low) break; if (r() < 0.8) { BL = r() < 0.12 ? 1 + Math.floor(r() * 98) : r() < 0.06 ? 100 + Math.floor(r() * 98) : 0; hung(S0, tt, yy, R); BL = 0; } yy += R[5] + 3; }
    }
    // a billboard on the roof: a film as often as not
    if (r() < (near < 220 ? 0.5 : 0.3) && floors <= 26) {
      const from = r() < 0.55 ? A.films : A.ads, R = S1.L >= 104 && near > 120 ? pick(from.great) : S1.L >= 70 ? pick(from.wide) : S1.L >= 32 ? pick(from.tall) : null;
      if (R) {
        const [, , , , bw, bh] = R, t0 = (S1.L - bw) / 2, p = (tt, o) => [S1.ox + S1.ax * tt + S1.nx * o, S1.oz + S1.az * tt + S1.nz * o], yb = y + 6;
        flat(S1, t0, -1, yb, R, SHOWN);
        { const a = p(t0 - 0.6, -1.05), c = p(t0 + bw + 0.6, -2); box(a[0], a[1], c[0], c[1], yb - 0.6, yb + bh + 0.6, DARK); }
        for (const tt of [t0 + 3, t0 + bw - 4]) { const a = p(tt, -1.2), c = p(tt + 1, -2.2); box(a[0], a[1], c[0], c[1], y + 1.5, yb, STEEL); const e = p(tt, -2), f = p(tt + 1, -7); box(e[0], e[1], f[0], f[1], yb + bh * 0.5, yb + bh * 0.5 + 1, STEEL); const h = p(tt, -6), q = p(tt + 1, -7); box(h[0], h[1], q[0], q[1], y + 1.5, yb + bh * 0.5, STEEL); }
        for (let tt = t0 + 5; tt < t0 + bw - 3; tt += 12) { const a = p(tt, 2.2), c = p(tt + 2, 3.2); box(a[0], a[1], c[0], c[1], yb + bh + 0.6, yb + bh + 1.4, [2.6, 2.5, 2.2], [2.6, 2.5, 2.2], lamps); const e = p(tt + 0.6, -1), f = p(tt + 1.4, 2.6); box(e[0], e[1], f[0], f[1], yb + bh + 1.2, yb + bh + 1.7, STEEL); }
      }
    }
    // a poster on the wall
    if (r() < (near < 220 ? 0.4 : 0.15) && low >= 72 && S0.L >= 40) { const R = pick((r() < 0.6 ? A.films : A.ads).tall); flat(S0, Math.round((S0.L - R[4]) / 2 / BAY) * BAY + 2, 0.35, SHOP + 12 + Math.floor(r() * 2) * FLOOR, R, SHOWN); }
  }
  // the great boards that stand on their own at the ends of the long straights, a film each: { x, z, s (the way it
  // faces, as a side), film (0..2), y (its foot) }, on two steel legs, lamps along its top
  for (const h of heroes) {
    const R = A.hero[h.film % A.hero.length], [, , , , bw, bh] = R, wide = h.s === 0 || h.s === 2, S = wide ? SIDE(h.s, h.x - bw / 2, h.z - 1, h.x + bw / 2, h.z + 1) : SIDE(h.s, h.x - 1, h.z - bw / 2, h.x + 1, h.z + bw / 2), p = (tt, o) => [S.ox + S.ax * tt + S.nx * o, S.oz + S.az * tt + S.nz * o];
    flat(S, 0, 0.1, h.y, R, [1.2, 1.2, 1.2]);
    { const a = p(-1.5, 0), c = p(bw + 1.5, -2); box(a[0], a[1], c[0], c[1], h.y - 1.5, h.y + bh + 1.5, DARK); }
    for (const tt of [bw * 0.2, bw * 0.8]) { const a = p(tt - 1.5, -0.5), c = p(tt + 1.5, -3.5); box(a[0], a[1], c[0], c[1], 0, h.y + bh * 0.6, STEEL); }
    for (let tt = 6; tt < bw - 4; tt += 14) { const a = p(tt, 3), c = p(tt + 3, 4.4); box(a[0], a[1], c[0], c[1], h.y + bh + 1.5, h.y + bh + 2.6, [2.8, 2.7, 2.4], [2.8, 2.7, 2.4], lamps); const e = p(tt + 1, -1), f = p(tt + 2, 3.4); box(e[0], e[1], f[0], f[1], h.y + bh + 2.2, h.y + bh + 2.8, STEEL); }
  }
  const out = [];
  const mesh = (b, mat, name = 'city blocks') => {
    if (!b.idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    if (b === signs) g.setAttribute('blink', new THREE.Float32BufferAttribute(b.bl, 1));
    g.setIndex(b.idx);
    const m = new THREE.Mesh(g, mat); m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; m.updateMatrix(); m.frustumCulled = false; m.name = name; scene.add(m); out.push(m);
  };
  // the street's own light on the lower floors (the fronts take the moon and the sky only): it dies away going up
  const streetlit = (mat) => {
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUp = position.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vUp;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(0.5, 0.36, 0.46) * (1.0 - smoothstep(4.0, 70.0, vUp));');
    };
    mat.customProgramCacheKey = () => 'tokyo-streetlit'; return mat;
  };
  let n = 0;
  for (const k in bufs) { const [map, emissiveMap] = fronts(k, 211 + 37 * n++); mesh(bufs[k], streetlit(new THREE.MeshLambertMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.5, vertexColors: true }))); }
  { const [map, emissiveMap] = street(); mesh(shop, new THREE.MeshLambertMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.5, vertexColors: true })); }
  mesh(plain, streetlit(new THREE.MeshLambertMaterial({ vertexColors: true })));
  const signMat = new THREE.MeshBasicMaterial({ map: A.tex, vertexColors: true });
  signMat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = clock;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float blink; varying float vBlink;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlink = blink;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT; varying float vBlink;').replace('#include <color_fragment>', `#include <color_fragment>
      if (vBlink > 0.5) { float ph = fract(vBlink * 0.137), k = vBlink < 99.5 ? step(0.42, fract(uT * (0.35 + ph * 0.5) + ph)) : step(0.2, fract(sin(floor(uT * 11.0 + ph * 50.0) * 12.9898) * 43758.5453)); diffuseColor.rgb *= 0.2 + 0.8 * k; }`);
  };
  signMat.customProgramCacheKey = () => 'tokyo-signs';
  mesh(signs, signMat, 'city signs');
  mesh(lamps, new THREE.MeshBasicMaterial({ vertexColors: true }), 'city lamps');
  return { meshes: out, tris: out.reduce((a, m) => a + m.geometry.index.count / 3, 0) };
}

// Petals on the air where the cherries are: points round the camera, falling and drifting, the shader moving them.
// [x0, z0, x1, z1]: where they fall (they show only while the player is there)
export function makePetals(api, [x0, z0, x1, z1], clock = { value: 0 }) {
  const N = 420, pos = new Float32Array(N * 3), r = rnd(4411);
  for (let i = 0; i < N; i++) { pos[i * 3] = r() * 120; pos[i * 3 + 1] = r() * 46; pos[i * 3 + 2] = r() * 120; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: clock, uC: { value: new THREE.Vector3() }, uPx: { value: 600 } },
    vertexShader: `uniform float uT; uniform vec3 uC; uniform float uPx; varying float vK;
      void main() { vec3 p = position; float k = fract(p.x * 0.37 + p.z * 0.11);
        p.x += uT * 1.8 + sin(uT * (0.8 + k) + p.z) * 2.0; p.z += sin(uT * 0.6 + p.x * 0.2) * 1.5 + uT * 0.6;
        p.xz = mod(p.xz - uC.xz + 60.0, 120.0) + uC.xz - 60.0; p.y = mod(position.y - uT * (2.4 + k * 2.2), 46.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * 0.5 / -mv.z, 1.0, 7.0); vK = k; }`,
    fragmentShader: 'varying float vK; void main() { gl_FragColor = vec4(mix(vec3(1.0, 0.56, 0.7), vec3(1.0, 0.84, 0.9), vK) * 1.1, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const m = new THREE.Points(g, mat); m.frustumCulled = false; m.visible = false; m.name = 'petals'; api.scene.add(m);
  return { step() {
    const pl = api.player, cam = api.camera; m.visible = !!pl && pl.x > x0 && pl.x < x1 && pl.z > z0 && pl.z < z1; if (!m.visible || !cam) return;
    mat.uniforms.uC.value.copy(cam.position); mat.uniforms.uPx.value = (api.renderer ? api.renderer.domElement.height : 800) / (2 * Math.tan(cam.fov * Math.PI / 360));
  } };
}
// Pleasure boats on the bay, hung with lanterns, going slowly up and down: [{ z, x0, x1, v }]
export function makeBoats(scene, lanes) {
  const pos = [], col = [], idx = [];
  const part = (x0, y0, z0, x1, y1, z1, c) => {
    const F = [[x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0]];
    F.forEach((P, f) => { const i = pos.length / 3, k = f === 4 ? 1 : f < 2 ? 0.8 : 0.65; pos.push(...P); for (let q = 0; q < 4; q++) col.push(c[0] * k, c[1] * k, c[2] * k); idx.push(i, i + 1, i + 2, i, i + 2, i + 3); });
  };
  part(-15, 0.3, -4, 15, 2.2, 4, [0.1, 0.1, 0.12]); part(-17, 1.2, -2.6, -15, 2.4, 2.6, [0.1, 0.1, 0.12]); part(15, 1.2, -3, 18, 2.6, 3, [0.1, 0.1, 0.12]);
  part(-11, 2.2, -3.4, 11, 5.6, 3.4, [0.2, 0.13, 0.08]); part(-10.5, 3, -3.5, 10.5, 4.8, 3.5, [1.7, 1.25, 0.6]);
  for (let x = -9; x <= 9; x += 3) part(x - 0.3, 2.2, -3.6, x + 0.3, 5.6, 3.6, [0.2, 0.13, 0.08]);
  part(-12.5, 5.6, -4.4, 12.5, 6.3, 4.4, [0.14, 0.15, 0.2]); part(-10, 6.3, -2.6, 10, 6.9, 2.6, [0.14, 0.15, 0.2]);
  for (let x = -11; x <= 11; x += 2.75) for (const z of [-4.5, 4.5]) part(x - 0.55, 4.1, z - 0.55, x + 0.55, 5.4, z + 0.55, [1.9, 0.36, 0.2]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const boats = lanes.map((L) => { const m = new THREE.Mesh(g, mat); m.name = 'boats'; m.position.set((L.x0 + L.x1) / 2 + (L.v > 0 ? -30 : 30), 0, L.z); m.rotation.y = L.v > 0 ? 0 : Math.PI; scene.add(m); return { m, L, v: L.v }; });
  return { step(dt) { for (const b of boats) { b.m.position.x += b.v * dt; if ((b.v > 0 && b.m.position.x > b.L.x1) || (b.v < 0 && b.m.position.x < b.L.x0)) { b.v = -b.v; b.m.rotation.y = b.v > 0 ? 0 : Math.PI; } } } };
}

// The people out to watch: a figure a few voxels tall, one mesh for all of them, along the barriers where the town is
// thickest. Some hop on the spot as the cars come by (the shader moves them; nothing is worked out a frame).
// list: [x, z, yaw, which colour]
const SHIRTS = [[0.92, 0.92, 0.96], [0.86, 0.24, 0.24], [0.2, 0.36, 0.82], [0.96, 0.8, 0.3], [0.2, 0.2, 0.25], [0.92, 0.5, 0.72], [0.3, 0.7, 0.52], [0.95, 0.55, 0.2]];
export function makeCrowd(scene, list, clock = { value: 0 }) {
  if (!list.length) return { step() {} };
  const pos = [], col = [], nor = [], idx = [];
  const part = (x0, y0, z0, x1, y1, z1, c) => {
    const F = [[[x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], [0, 0, -1]], [[x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1]], [[x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0]], [[x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [1, 0, 0]], [[x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0], [0, 1, 0]]];
    for (const [P, n] of F) { const i = pos.length / 3; pos.push(...P); for (let k = 0; k < 4; k++) { nor.push(...n); col.push(...c); } idx.push(i, i + 1, i + 2, i, i + 2, i + 3); }
  };
  part(-0.8, 0, -0.4, -0.1, 2.1, 0.4, [0.16, 0.18, 0.26]); part(0.1, 0, -0.4, 0.8, 2.1, 0.4, [0.16, 0.18, 0.26]);
  part(-0.95, 2.1, -0.5, 0.95, 4.4, 0.5, [1, 1, 1]); part(-0.6, 4.4, -0.6, 0.6, 5.6, 0.6, [1.25, 1.0, 0.82]); part(-0.65, 5.3, -0.65, 0.65, 5.8, 0.3, [0.12, 0.1, 0.1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = clock;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 2.3;
        transformed.y += max(0.0, sin(uT * 6.0 + ph)) * 0.9 * step(0.6, fract(ph * 0.37));
      #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(0.55, 0.45, 0.5);');
  };
  mat.customProgramCacheKey = () => 'tokyo-crowd';
  const m = new THREE.InstancedMesh(g, mat, list.length), M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  list.forEach(([x, z, yaw, k], i) => { const h = 0.9 + ((k * 7 + i * 3) % 5) * 0.05; q.setFromAxisAngle(UP, yaw); M4.compose(p.set(x, 0, z), q, sc.set(1, h, 1)); m.setMatrixAt(i, M4); const s = SHIRTS[k % SHIRTS.length]; m.setColorAt(i, c.setRGB(s[0], s[1], s[2])); });
  m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; m.matrixAutoUpdate = false; m.name = 'crowd'; scene.add(m);
  return { mesh: m, step() {} };
}
