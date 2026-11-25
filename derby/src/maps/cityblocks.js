// A city off the course, cheaply: boxes nothing can reach with a picture on every side, a voxel to a pixel, and what
// makes them a place: things that stand off the walls, roofs with their plant on them, boards that hang out over the
// street, billboards, posters, flags. Written for Midnight Tokyo (maps/tokyoblocks.js; Will, 2026-11-25: "some buildings
// are just too low ploy looking ... it doesn't feel japanese enough"), then asked for on the other two cities ("the same
// final pass to both washington DC and New York"), so the builder is here and each city brings a kit:
//   key                 a name for its shaders
//   styles, cap         the kinds of front, and the colour of each kind's ledges and parapets
//   fronts(kind, seed)  [the picture, what of it is lit (or null by day)]: TW by TH, a bay BAY wide and a floor FLOOR tall
//   street()            the same for the street floor: TW by SHOP
//   sheet()             every sign and poster on one sheet (atlas(), below): { tex, signs, bigs, films, ads, hero }
//   glow, emissive      the street's own light on the lower floors (null by day), and how bright the lit windows are
//   lit, shown          the colour of a board lit from inside, and of one with lamps on it
//   hang                the boards down the fronts: { corner: [share near, share far], row: within, share } or null
//   board, poster       [share near, share far, share that are films]: roof billboards, wall posters
//   tank, tankShare     'wood' for New York's water towers; mast, redLamps: false to leave them off; roof: its colour
//   dress(B, tools)     anything of its own on a block (flags, banners, fire escapes)
// One mesh a kind of front, one for the street floors, one for everything plain, one for the signs and one for the lamps.
//
// makeCityBlocks(scene, list, kit)   list: { x0, z0, w, d, h, style, seed, plain, near, toward: [x, z] }
//   near: how far the course is (the detail and the signs are for the near ones); toward: the way to it
import * as THREE from 'three';

export const BAY = 8, FLOOR = 8, TW = 64, TH = 96, SHOP = 12;
export const rnd = (seed) => { let s = seed | 0; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; }; };
// how many floors a block of this height has, and where its roof is: its top tier [x0, z0, x1, z1, y]
export function shapeOf(B) {
  const floors = Math.max(3, Math.round(B.h / FLOOR)), m = Math.min(B.w, B.d), cut = floors >= 30 && m >= 40 ? [0.5, 0.8, 1] : floors >= 18 && m >= 32 ? [0.66, 1] : [1], in_ = (cut.length - 1) * BAY;
  return { floors, cut, roof: [B.x0 + in_, B.z0 + in_, B.x0 + B.w - in_, B.z0 + B.d - in_, floors * FLOOR] };
}
export function tex(c) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// every sign and poster of a city on one sheet: add(picture) for each ({ W, H, d } as maps/tokyoart.js pixels() makes
// them), then pack(): the texture; each thing added then has rect [u0, v0, u1, v1, w, h]
export function atlas(AW = 512, AH = 512) {
  const all = [];
  return {
    add(P) { const it = { P, rect: null }; all.push(it); return it; },
    pack() {
      const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH; const g = cv.getContext('2d');
      all.sort((a, b) => b.P.H - a.P.H);
      let x = 1, y = 1, row = 0;
      for (const it of all) {
        const { W, H, d } = it.P, s = it.P.s || 1;   // (s: a board drawn finer than a pixel to a voxel)
        if (x + W + 1 > AW) { x = 1; y += row + 2; row = 0; }
        if (y + H + 1 > AH) { it.rect = all[0].rect; continue; }
        g.putImageData(new ImageData(d, W, H), x, y);
        it.rect = [x / AW, 1 - (y + H) / AH, (x + W) / AW, 1 - y / AH, W / s, H / s]; x += W + 2 * s; row = Math.max(row, H + 2 * (s - 1));
      }
      const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
      return t;
    },
  };
}

// a side of a box, seen from outside: where its left end is, the way along it and the way out
// (0 the north side, 1 east, 2 south, 3 west)
export const SIDE = (s, x0, z0, x1, z1) => (s === 0 ? { ox: x1, oz: z0, ax: -1, az: 0, nx: 0, nz: -1, L: x1 - x0 } : s === 1 ? { ox: x1, oz: z1, ax: 0, az: -1, nx: 1, nz: 0, L: z1 - z0 } : s === 2 ? { ox: x0, oz: z1, ax: 1, az: 0, nx: 0, nz: 1, L: x1 - x0 } : { ox: x0, oz: z0, ax: 0, az: 1, nx: -1, nz: 0, L: z1 - z0 });

export function makeCityBlocks(scene, list, kit, clock = { value: 0 }, heroes = []) {
  const STYLES = kit.styles, CAP = kit.cap, HANG = kit.hang === undefined ? {} : kit.hang, LEDGE = kit.ledge || { flats: [1, 1.3], glass: [6, 0.6], dark: [6, 0.6] }, BARE = kit.bare || ['glass', 'dark'];
  const BOARD = kit.board || [0.5, 0.3, 0.55], POSTER = kit.poster || [0.4, 0.15, 0.6], RED = [3, 0.3, 0.2];
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
  const A = kit.sheet(), WHITE = [1, 1, 1], ROOF = kit.roof || [0.13, 0.13, 0.15], STEEL = [0.2, 0.21, 0.24], DARK = [0.06, 0.06, 0.07], UNIT = [0.5, 0.52, 0.55];
  const LIT = kit.lit || [1.55, 1.55, 1.55], SHOWN = kit.shown || [1.05, 1.05, 1.05];   // a board lit from inside, and one with lamps on it
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
  // a flag on a pole at (x, z), its foot at y0 and the pole h tall: the picture R flies from the pole's top the way
  // (dx, dz), in strips that the shader waves (blink 1000 and up: how far along the flag a corner is)
  const wave = (x, z, y0, h, R, dx = 1, dz = 0, size = 1) => {
    const [u0, v0, u1, v1, w0, h0] = R, w = w0 * size, hh = h0 * size, N = 4, top = y0 + h;
    box(x - 0.3, z - 0.3, x + 0.3, z + 0.3, y0, top + 0.6, [0.75, 0.76, 0.78]);
    for (let i = 0; i < N; i++) {
      const a = i / N, b = (i + 1) / N, xa = x + dx * (0.3 + w * a), za = z + dz * (0.3 + w * a), xb = x + dx * (0.3 + w * b), zb = z + dz * (0.3 + w * b), ua = u0 + (u1 - u0) * a, ub = u0 + (u1 - u0) * b;
      for (const sd of [1, -1]) {
        const k = signs.pos.length / 3, P = sd > 0 ? [xa, top - hh, za, xb, top - hh, zb, xb, top, zb, xa, top, za] : [xb, top - hh, zb, xa, top - hh, za, xa, top, za, xb, top, zb], U = sd > 0 ? [ua, v0, ub, v0, ub, v1, ua, v1] : [ub, v0, ua, v0, ua, v1, ub, v1], Wv = sd > 0 ? [a, b, b, a] : [b, a, a, b];
        signs.pos.push(...P); signs.uv.push(...U); for (let q = 0; q < 4; q++) { signs.nor.push(-dz * sd, 0, dx * sd); signs.col.push(...SHOWN); signs.bl.push(1000 + Wv[q] * w); }
        signs.idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
      }
    }
  };
  for (const B of list) {
    const r = rnd((B.seed * 2654435761) | 0), kind = STYLES.includes(B.style) ? B.style : STYLES[0], b = buf(kind), cap = CAP[kind], t = 0.86 + r() * 0.2, tint = [t, t * (0.97 + r() * 0.05), t * (0.95 + r() * 0.06)];
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
        const f0 = Math.round(y / FLOOR) + (i === 0 ? 2 : 1), f1 = Math.round(top / FLOOR), [step, out] = LEDGE[kind] || [3, 0.6];
        for (let f = f0; f < f1; f += step) box(x0 - out, z0 - out, x1 + out, z1 + out, f * FLOOR - 1, f * FLOOR, cap.map((v) => v * 0.92), cap.map((v) => v * 0.6));
      }
      y = top; if (i < cut.length - 1) { x0 += BAY; z0 += BAY; x1 -= BAY; z1 -= BAY; }
    });
    // on the roof: a parapet, the lift's house, air conditioners, a tank; on a tall one a mast and a red light
    const w = x1 - x0, d = z1 - z0, cx = x0 + w * (0.3 + r() * 0.4), cz = z0 + d * (0.3 + r() * 0.4);
    if (near < 500) for (const [a0, c0, a1, c1] of [[x0, z0, x1, z0 + 0.6], [x0, z1 - 0.6, x1, z1], [x0, z0, x0 + 0.6, z1], [x1 - 0.6, z0, x1, z1]]) box(a0, c0, a1, c1, y + 1.5, y + 3.5, cap.map((v) => v * 0.85), ROOF);
    if (w >= 16 && d >= 16) box(cx - 4, cz - 3, cx + 4, cz + 3, y + 1.5, y + 7 + r() * 4, cap.map((v) => v * 0.8), ROOF);
    if (near < 400) for (let n = 1 + Math.floor(r() * 4); n > 0; n--) { const ax = x0 + 2 + r() * (w - 7), az = z0 + 2 + r() * (d - 7); box(ax, az, ax + 3, az + 3, y + 1.5, y + 4, UNIT, [0.3, 0.31, 0.33]); }
    if (!BARE.includes(kind) && r() < (kit.tankShare ?? 0.5) && w >= 24 && near < 700) {
      const tx = x0 + 5 + r() * (w - 10), tz = z0 + 5 + r() * (d - 10);
      for (const [a, c] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) box(tx + a - 0.3, tz + c - 0.3, tx + a + 0.3, tz + c + 0.3, y + 1.5, y + 6, STEEL);
      if (kit.tank === 'wood') {   // (New York's: a round wooden tank under a pointed cap, eight sides drawn as a cross of two boxes)
        const W1 = [0.42, 0.27, 0.16], W2 = [0.3, 0.19, 0.11];
        box(tx - 3, tz - 1.8, tx + 3, tz + 1.8, y + 6, y + 13, W1, W2); box(tx - 1.8, tz - 3, tx + 1.8, tz + 3, y + 6, y + 13, W1, W2); box(tx - 2.6, tz - 2.6, tx + 2.6, tz + 2.6, y + 6, y + 13, W2, W2);
        for (const yy of [y + 7.5, y + 11]) { box(tx - 3.1, tz - 1.9, tx + 3.1, tz + 1.9, yy, yy + 0.4, STEEL); box(tx - 1.9, tz - 3.1, tx + 1.9, tz + 3.1, yy, yy + 0.4, STEEL); }
        box(tx - 2.2, tz - 2.2, tx + 2.2, tz + 2.2, y + 13, y + 14.2, W2); box(tx - 1.2, tz - 1.2, tx + 1.2, tz + 1.2, y + 14.2, y + 15.4, W2); box(tx - 0.4, tz - 0.4, tx + 0.4, tz + 0.4, y + 15.4, y + 16.4, W2);
      } else box(tx - 2.6, tz - 2.6, tx + 2.6, tz + 2.6, y + 6, y + 11, [0.62, 0.64, 0.6], [0.4, 0.42, 0.4]);
    }
    if (floors >= 18 && near < 1000 && kit.mast !== false) { const h = 14 + r() * 26; box(cx - 0.6, cz - 0.6, cx + 0.6, cz + 0.6, y + 7, y + 7 + h, STEEL); if (kit.redLamps !== false) { box(cx - 1, cz - 1, cx + 1, cz + 1, y + 7 + h, y + 9 + h, RED, RED, lamps); for (const [a, c] of [[x0, z0], [x1, z1]]) box(a - 0.8, c - 0.8, a + 0.8, c + 0.8, y + 3.5, y + 5, RED, RED, lamps); } }
    if (kit.dress) kit.dress(B, { r, kind, floors, cut, near, roof: [x0, z0, x1, z1, y], cap, box, flat, hung, wave, quad, SIDE, A, plain, signs, lamps, LIT, SHOWN, STEEL, DARK, setBlink: (v) => { BL = v; } });
    // the signs, on the side that faces the course
    if (near > (kit.signsWithin ?? 330) || !B.toward) continue;
    const s = Math.abs(B.toward[0]) > Math.abs(B.toward[1]) ? (B.toward[0] > 0 ? 1 : 3) : B.toward[1] > 0 ? 2 : 0, S0 = SIDE(s, B.x0, B.z0, B.x0 + B.w, B.z0 + B.d), S1 = SIDE(s, x0, z0, x1, z1), low = Math.round(floors * cut[0]) * FLOOR, pick = (a) => a[Math.floor(r() * a.length)];
    // boards down the corners (a great one on a tall front)
    const C = HANG ? HANG.corner || [0.65, 0.6] : [0, 0], n = !HANG ? 0 : near < 150 ? 1 + (r() < C[0] ? 1 : 0) : r() < C[1] ? 1 : 0, ends = r() < 0.5 ? [3, S0.L - 3] : [S0.L - 3, 3];
    for (let k = 0; k < n; k++) {
      const big = low >= 104 && r() < 0.6, R = pick(big ? A.bigs : A.signs); if (R[5] + 18 > low) continue;
      BL = r() < 0.16 ? 1 + Math.floor(r() * 98) : r() < 0.08 ? 100 + Math.floor(r() * 98) : 0;
      hung(S0, ends[k], Math.min(low - R[5] - 3, 15 + Math.floor(r() * 3) * FLOOR + (big ? 8 : 0)), R); BL = 0;
    }
    // and, near the course, more of them one above another all the way along the front (Will's reference: a street
    // of signs hung out from every floor)
    if (HANG && near < (HANG.row ?? 190)) for (let tt = 3 + (ends[0] < 10 ? 16 : 0); tt < S0.L - 3; tt += 16) {
      if (Math.abs(tt - ends[0]) < 8 || (n > 1 && Math.abs(tt - ends[1]) < 8)) continue;
      for (let yy = 15 + Math.floor(r() * 2) * 4, m = 0; m < 4; m++) { const R = pick(A.signs); if (yy + R[5] + 4 > low) break; if (r() < (HANG.share ?? 0.8)) { BL = r() < 0.12 ? 1 + Math.floor(r() * 98) : r() < 0.06 ? 100 + Math.floor(r() * 98) : 0; hung(S0, tt, yy, R); BL = 0; } yy += R[5] + 3; }
    }
    // a billboard on the roof: a film as often as not
    if (r() < (near < 220 ? BOARD[0] : BOARD[1]) && floors <= 26) {
      const from = r() < BOARD[2] ? A.films : A.ads, R = S1.L >= 104 && near > 120 ? pick(from.great) : S1.L >= 70 ? pick(from.wide) : S1.L >= 32 ? pick(from.tall) : null;
      if (R) {
        const [, , , , bw, bh] = R, t0 = (S1.L - bw) / 2, p = (tt, o) => [S1.ox + S1.ax * tt + S1.nx * o, S1.oz + S1.az * tt + S1.nz * o], yb = y + 6;
        flat(S1, t0, -1, yb, R, SHOWN);
        { const a = p(t0 - 0.6, -1.05), c = p(t0 + bw + 0.6, -2); box(a[0], a[1], c[0], c[1], yb - 0.6, yb + bh + 0.6, DARK); }
        for (const tt of [t0 + 3, t0 + bw - 4]) { const a = p(tt, -1.2), c = p(tt + 1, -2.2); box(a[0], a[1], c[0], c[1], y + 1.5, yb, STEEL); const e = p(tt, -2), f = p(tt + 1, -7); box(e[0], e[1], f[0], f[1], yb + bh * 0.5, yb + bh * 0.5 + 1, STEEL); const h = p(tt, -6), q = p(tt + 1, -7); box(h[0], h[1], q[0], q[1], y + 1.5, yb + bh * 0.5, STEEL); }
        for (let tt = t0 + 5; tt < t0 + bw - 3; tt += 12) { const a = p(tt, 2.2), c = p(tt + 2, 3.2); box(a[0], a[1], c[0], c[1], yb + bh + 0.6, yb + bh + 1.4, kit.boardLamp || [2.6, 2.5, 2.2], kit.boardLamp || [2.6, 2.5, 2.2], lamps); const e = p(tt + 0.6, -1), f = p(tt + 1.4, 2.6); box(e[0], e[1], f[0], f[1], yb + bh + 1.2, yb + bh + 1.7, STEEL); }
      }
    }
    // a poster on the wall
    if (r() < (near < 220 ? POSTER[0] : POSTER[1]) && low >= 72 && S0.L >= 40) { const R = pick((r() < POSTER[2] ? A.films : A.ads).tall); flat(S0, Math.round((S0.L - R[4]) / 2 / BAY) * BAY + 2, 0.35, SHOP + 12 + Math.floor(r() * 2) * FLOOR, R, SHOWN); }
  }
  // the great boards that stand on their own at the ends of the long straights, a film each: { x, z, s (the way it
  // faces, as a side), film (0..2), y (its foot), great (the smaller size) }, on two steel legs, lamps along its top
  for (const h of heroes) {
    const R = h.great ? A.films.great[h.film % A.films.great.length] : A.hero[h.film % A.hero.length], [, , , , bw, bh] = R, wide = h.s === 0 || h.s === 2, S = wide ? SIDE(h.s, h.x - bw / 2, h.z - 1, h.x + bw / 2, h.z + 1) : SIDE(h.s, h.x - 1, h.z - bw / 2, h.x + 1, h.z + bw / 2), p = (tt, o) => [S.ox + S.ax * tt + S.nx * o, S.oz + S.az * tt + S.nz * o];
    flat(S, 0, 0.1, h.y, R, kit.heroLit || [1.2, 1.2, 1.2]);
    { const a = p(-1.5, 0), c = p(bw + 1.5, -2); box(a[0], a[1], c[0], c[1], h.y - 1.5, h.y + bh + 1.5, DARK); }
    for (const tt of [bw * 0.2, bw * 0.8]) { const a = p(tt - 1.5, -0.5), c = p(tt + 1.5, -3.5); box(a[0], a[1], c[0], c[1], 0, h.y + bh * 0.6, STEEL); }
    for (let tt = 6; tt < bw - 4; tt += 14) { const a = p(tt, 3), c = p(tt + 3, 4.4); box(a[0], a[1], c[0], c[1], h.y + bh + 1.5, h.y + bh + 2.6, kit.boardLamp || [2.8, 2.7, 2.4], kit.boardLamp || [2.8, 2.7, 2.4], lamps); const e = p(tt + 1, -1), f = p(tt + 2, 3.4); box(e[0], e[1], f[0], f[1], h.y + bh + 2.2, h.y + bh + 2.8, STEEL); }
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
  const KEY = kit.key || 'tokyo', GLOW = kit.glow === undefined ? [0.5, 0.36, 0.46] : kit.glow;
  const streetlit = (mat) => {
    if (!GLOW) return mat;
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUp = position.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vUp;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(${GLOW.map((v) => v.toFixed(3)).join(', ')}) * (1.0 - smoothstep(4.0, 70.0, vUp));`);
    };
    mat.customProgramCacheKey = () => KEY + '-streetlit'; return mat;
  };
  let n = 0;
  const lit = (map, emissiveMap) => new THREE.MeshLambertMaterial(emissiveMap ? { map, emissiveMap, emissive: 0xffffff, emissiveIntensity: kit.emissive ?? 1.5, vertexColors: true } : { map, vertexColors: true });
  for (const k in bufs) { const [map, emissiveMap] = kit.fronts(k, 211 + 37 * n++); mesh(bufs[k], streetlit(lit(map, emissiveMap))); }
  { const [map, emissiveMap] = kit.street(); mesh(shop, lit(map, emissiveMap)); }
  mesh(plain, streetlit(new THREE.MeshLambertMaterial({ vertexColors: true })));
  const signMat = new THREE.MeshBasicMaterial({ map: A.tex, vertexColors: true });
  signMat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = clock;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT; attribute float blink; varying float vBlink;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlink = blink; if (blink > 999.5) { float a = blink - 1000.0; transformed += normal * sin(uT * 5.0 - a * 0.9 + position.x * 0.31 + position.z * 0.17) * min(1.4, a * 0.22); vBlink = 0.0; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT; varying float vBlink;').replace('#include <color_fragment>', `#include <color_fragment>
      if (vBlink > 0.5) { float ph = fract(vBlink * 0.137), k = vBlink < 99.5 ? step(0.42, fract(uT * (0.35 + ph * 0.5) + ph)) : step(0.2, fract(sin(floor(uT * 11.0 + ph * 50.0) * 12.9898) * 43758.5453)); diffuseColor.rgb *= 0.2 + 0.8 * k; }`);
  };
  signMat.customProgramCacheKey = () => KEY + '-signs';
  mesh(signs, signMat, 'city signs');
  mesh(lamps, new THREE.MeshBasicMaterial({ vertexColors: true }), 'city lamps');
  return { meshes: out, tris: out.reduce((a, m) => a + m.geometry.index.count / 3, 0) };
}

// Petals on the air where the cherries are: points round the camera, falling and drifting, the shader moving them.
// [x0, z0, x1, z1]: where they fall (they show only while the player is there)
export function makePetals(api, [x0, z0, x1, z1], clock = { value: 0 }, { n = 420, a = [1.0, 0.56, 0.7], b = [1.0, 0.84, 0.9], px = 0.5, name = 'petals' } = {}) {
  const N = n, pos = new Float32Array(N * 3), r = rnd(4411);
  for (let i = 0; i < N; i++) { pos[i * 3] = r() * 120; pos[i * 3 + 1] = r() * 46; pos[i * 3 + 2] = r() * 120; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: clock, uC: { value: new THREE.Vector3() }, uPx: { value: 600 } },
    vertexShader: `uniform float uT; uniform vec3 uC; uniform float uPx; varying float vK;
      void main() { vec3 p = position; float k = fract(p.x * 0.37 + p.z * 0.11);
        p.x += uT * 1.8 + sin(uT * (0.8 + k) + p.z) * 2.0; p.z += sin(uT * 0.6 + p.x * 0.2) * 1.5 + uT * 0.6;
        p.xz = mod(p.xz - uC.xz + 60.0, 120.0) + uC.xz - 60.0; p.y = mod(position.y - uT * (2.4 + k * 2.2), 46.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * ${px.toFixed(2)} / -mv.z, 1.0, 7.0); vK = k; }`,
    fragmentShader: `varying float vK; void main() { gl_FragColor = vec4(mix(vec3(${a.join(', ')}), vec3(${b.join(', ')}), vK) * 1.1, 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`,
  });
  const m = new THREE.Points(g, mat); m.frustumCulled = false; m.visible = false; m.name = name; api.scene.add(m);
  return { step() {
    const pl = api.player, cam = api.camera; m.visible = !!pl && pl.x > x0 && pl.x < x1 && pl.z > z0 && pl.z < z1; if (!m.visible || !cam) return;
    mat.uniforms.uC.value.copy(cam.position); mat.uniforms.uPx.value = (api.renderer ? api.renderer.domElement.height : 800) / (2 * Math.tan(cam.fov * Math.PI / 360));
  } };
}
// Pleasure boats on the bay, hung with lanterns, going slowly up and down: [{ z, x0, x1, v }]
export function makeBoats(scene, lanes, draw = null, lit = true) {
  const pos = [], col = [], idx = [];
  const part = (x0, y0, z0, x1, y1, z1, c) => {
    const F = [[x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0]];
    F.forEach((P, f) => { const i = pos.length / 3, k = f === 4 ? 1 : f < 2 ? 0.8 : 0.65; pos.push(...P); for (let q = 0; q < 4; q++) col.push(c[0] * k, c[1] * k, c[2] * k); idx.push(i, i + 1, i + 2, i, i + 2, i + 3); });
  };
  if (draw) draw(part); else {
  part(-15, 0.3, -4, 15, 2.2, 4, [0.1, 0.1, 0.12]); part(-17, 1.2, -2.6, -15, 2.4, 2.6, [0.1, 0.1, 0.12]); part(15, 1.2, -3, 18, 2.6, 3, [0.1, 0.1, 0.12]);
  part(-11, 2.2, -3.4, 11, 5.6, 3.4, [0.2, 0.13, 0.08]); part(-10.5, 3, -3.5, 10.5, 4.8, 3.5, [1.7, 1.25, 0.6]);
  for (let x = -9; x <= 9; x += 3) part(x - 0.3, 2.2, -3.6, x + 0.3, 5.6, 3.6, [0.2, 0.13, 0.08]);
  part(-12.5, 5.6, -4.4, 12.5, 6.3, 4.4, [0.14, 0.15, 0.2]); part(-10, 6.3, -2.6, 10, 6.9, 2.6, [0.14, 0.15, 0.2]);
  for (let x = -11; x <= 11; x += 2.75) for (const z of [-4.5, 4.5]) part(x - 0.55, 4.1, z - 0.55, x + 0.55, 5.4, z + 0.55, [1.9, 0.36, 0.2]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const mat = lit ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true });
  if (!lit) g.computeVertexNormals();
  const boats = lanes.map((L) => { const m = new THREE.Mesh(g, mat); m.name = 'boats'; m.position.set((L.x0 + L.x1) / 2 + (L.v > 0 ? -30 : 30), 0, L.z); m.rotation.y = L.v > 0 ? 0 : Math.PI; scene.add(m); return { m, L, v: L.v }; });
  return { step(dt) { for (const b of boats) { b.m.position.x += b.v * dt; if ((b.v > 0 && b.m.position.x > b.L.x1) || (b.v < 0 && b.m.position.x < b.L.x0)) { b.v = -b.v; b.m.rotation.y = b.v > 0 ? 0 : Math.PI; } } } };
}

// The people out to watch: a figure a few voxels tall, one mesh for all of them, along the barriers where the town is
// thickest. Some hop on the spot as the cars come by (the shader moves them; nothing is worked out a frame).
// list: [x, z, yaw, which colour, the ground's height there (0)]
const SHIRTS = [[0.92, 0.92, 0.96], [0.86, 0.24, 0.24], [0.2, 0.36, 0.82], [0.96, 0.8, 0.3], [0.2, 0.2, 0.25], [0.92, 0.5, 0.72], [0.3, 0.7, 0.52], [0.95, 0.55, 0.2]];
export function makeCrowd(scene, list, clock = { value: 0 }, { glow = [0.55, 0.45, 0.5], key = 'tokyo' } = {}) {
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
    if (glow) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(${glow.join(', ')});`);
  };
  mat.customProgramCacheKey = () => key + '-crowd';
  const m = new THREE.InstancedMesh(g, mat, list.length), M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  list.forEach(([x, z, yaw, k, y = 0], i) => { const h = 0.9 + ((k * 7 + i * 3) % 5) * 0.05; q.setFromAxisAngle(UP, yaw); M4.compose(p.set(x, y, z), q, sc.set(1, h, 1)); m.setMatrixAt(i, M4); const s = SHIRTS[k % SHIRTS.length]; m.setColorAt(i, c.setRGB(s[0], s[1], s[2])); });
  m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; m.matrixAutoUpdate = false; m.name = 'crowd'; scene.add(m);
  return { mesh: m, step() {} };
}
