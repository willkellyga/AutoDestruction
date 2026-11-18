// Tokyo, Build 2: the shapes that make its skyline its own and not New York's. All six are our own takes under our own
// names, drawn from the look of well-known Tokyo buildings (plain names, real shapes):
//   Metro Hall   a granite block that splits into twin towers, like a cathedral made of offices
//   Mayu Tower   a tall cocoon of dark glass wrapped in white diagonal bands
//   Flame Hall   a black box by the river with a great gold flame lying on its roof
//   Bay Studio   two silver slabs joined by glazed bridges, with a silver ball hung between them
//   Bay Expo     four upside-down pyramids standing on glass legs
//   Pod Tower    two concrete cores hung with capsule rooms, each with one round window
// Each is drawn round a local origin with its front toward low z and turned by place().
import { M, set, box, hole, walls, begin } from './world.js';
import { faces4, face, disc, text, lampPost, bench } from './kit.js';
import { sakura } from './tokyo_kit.js';

const along = (K) => (y) => { for (let i = 1; i < K.length; i++) if (y <= K[i][0]) { const [y0, v0] = K[i - 1], [y1, v1] = K[i]; return Math.round(v0 + (v1 - v0) * (y - y0) / (y1 - y0)); } return K[K.length - 1][1]; };
const mod = (a, n) => ((a % n) + n) % n;

// ---- Metro Hall: one block to two thirds of its height, then twin towers that step in twice toward their crowns ------
export const METRO = { S: 86, H: 200, SPLIT: 132 };
export function metrohall(lx, lz, L, o = {}) {
  const x0 = lx + 6, x1 = lx + 79, z0 = lz + 26, z1 = lz + 59, { H, SPLIT } = METRO;
  begin(o.title || 'Metro Hall', 'landmark');
  // the skin of a box from ya to yb: grey stone piers three wide every six, a band at every floor, and dark windows
  // between with a pane of pale glass here and there, so that the face reads as a pattern and not as stripes
  const skin = (xa, za, xb, zb, ya, yb, k = 0) => {
    for (const F of faces4(xa, za, xb, zb)) for (let u = 0; u < F.W; u++) for (let y = ya; y <= yb; y++) {
      const e = Math.min(u, F.W - 1 - u), bay = ((u + k) / 6) | 0, fl = (y / 12) | 0;
      F.p(u, y, 0, e < 2 || (u + k) % 6 < 3 ? (((u >> 1) + (y >> 2) + k) % 5 ? M.CONC : M.STONE) : y % 12 >= 9 ? M.SLAB : (bay * 3 + fl) % 4 === 0 ? M.GLASS : M.SPANDREL);
    }
  };
  // the podium: a low wing all round the foot, with the way in at the middle of the front
  walls(lx + 2, 0, lz + 18, lx + 83, 13, lz + 67, M.CONC);
  for (const F of faces4(lx + 2, lz + 18, lx + 83, lz + 67)) { for (let u = 2; u < F.W - 2; u++) if (u % 6 > 1) F.box(u, 3, u, 9, 0, 0, M.GLASS); F.band(13, 13, 0, M.STONE); F.band(0, 1, 0, M.STONE); }
  box(lx + 2, 13, lz + 18, lx + 83, 13, lz + 67, M.SLAB);
  hole(lx + 39, 2, lz + 18, lx + 46, 10, lz + 18); box(lx + 37, 11, lz + 16, lx + 48, 11, lz + 18, M.STONE);
  // the block, its floors, and a core under each tower that runs to the top
  skin(x0, z0, x1, z1, 0, SPLIT);
  for (let y = 23; y < SPLIT; y += 24) box(x0 + 1, y, z0 + 1, x1 - 1, y, z1 - 1, M.CONC);
  box(x0, SPLIT, z0, x1, SPLIT, z1, M.SLAB);
  // between the towers the block ends in a stepped roof
  skin(x0 + 28, z0 + 4, x1 - 28, z1 - 4, SPLIT + 1, SPLIT + 10, 2); box(x0 + 28, SPLIT + 11, z0 + 4, x1 - 28, SPLIT + 11, z1 - 4, M.SLAB);
  for (const tx of [x0, x1 - 25]) {
    // three tiers, each two voxels in from the one below and standing on a floor that spans it
    const T = [[SPLIT + 1, 168, 0], [169, 186, 2], [187, H, 4]];
    for (const [ya, yb, i] of T) {
      const xa = tx + i, xb = tx + 25 - i, za = z0 + 2 + i, zb = z1 - 2 - i;
      skin(xa, za, xb, zb, ya, yb, i);
      // a dark groove down the middle of the front and back, the mark of these towers
      for (const F of [face('f', xa, za, xb, zb), face('b', xa, za, xb, zb)]) { const m = F.W >> 1; F.box(m - 2, ya, m + 1, yb, 0, 0, M.STEEL); for (let y = ya; y <= yb; y++) if (y % 6 < 4) F.box(m - 1, y, m, y, 0, 0, M.GLASS); }
      for (let y = ya + 10; y < yb; y += 12) box(xa + 1, y, za + 1, xb - 1, y, zb - 1, M.CONC);
      box(xa, yb, za, xb, yb, zb, M.SLAB);
    }
    walls(tx + 9, 0, lz + 39, tx + 16, H - 1, lz + 46, M.CONC);
    // the crown: a parapet, a plant room and a cluster of masts
    walls(tx + 4, H + 1, z0 + 6, tx + 21, H + 2, z1 - 6, M.CONC);
    walls(tx + 8, H + 1, lz + 38, tx + 17, H + 6, lz + 47, M.STEEL); box(tx + 8, H + 7, lz + 38, tx + 17, H + 7, lz + 47, M.METAL);
    box(tx + 12, H + 8, lz + 42, tx + 13, H + 20, lz + 43, M.STEEL); box(tx + 12, H + 21, lz + 42, tx + 12, H + 27, lz + 42, M.TRIM); set(tx + 12, H + 28, lz + 42, M.LIT_R);
    box(tx + 9, H + 8, lz + 39, tx + 9, H + 14, lz + 39, M.TRIM); box(tx + 16, H + 8, lz + 46, tx + 16, H + 12, lz + 46, M.TRIM);
  }
  if (L >= 2) {
    for (const a of [8, 24, 60, 76]) sakura(lx + a, lz + 8, 8, 5);
    lampPost(lx + 34, lz + 3, 18); lampPost(lx + 51, lz + 3, 18); bench(lx + 14, lz + 13); bench(lx + 66, lz + 13);
  }
}

// ---- Mayu Tower: a cocoon. Round in plan, widest a little under half way up, drawn in to a blunt point, and wrapped
// in white bands that cross it on two slants -----------------------------------------------------------------------------
export const MAYU = { H: 168 };
export function mayutower(lx, lz, L, o = {}) {
  const cx = lx + 20, cz = lz + 21, H = MAYU.H;
  begin(o.title || 'Mayu Tower', 'landmark');
  const R = along([[0, 12], [16, 13], [70, 17], [120, 14], [150, 9], [162, 5], [H, 2]]);
  for (let y = 0; y <= H; y++) {
    const r = R(y), solid = y % 24 === 23 || y >= H - 1 || y === 0;
    for (let x = -r; x < r; x++) for (let z = -r; z < r; z++) {
      const d2 = (x + 0.5) * (x + 0.5) + (z + 0.5) * (z + 0.5);
      if (d2 > r * r) continue;
      const skinned = d2 >= (r - 2) * (r - 2);
      if (!skinned && !solid && d2 > 12) continue;                      // hollow but for the floors and the core
      if (!skinned) { set(cx + x, y, cz + z, d2 > 12 ? M.CONC : M.TRIM); continue; }   // floors of concrete, a core that can be bitten through
      // the bands: two families of slanting lines of different pitch, so the web looks woven and not like a grid
      const k = Math.floor((Math.atan2(z + 0.5, x + 0.5) + Math.PI) / (Math.PI * 2) * 96), u = mod(k + y, 24), v = mod(k * 2 - y * 3, 40);
      set(cx + x, y, cz + z, y < 2 ? M.STONE : u < 3 || v < 4 ? M.TRIM : y % 4 === 3 ? M.GLASS : M.SPANDREL);
    }
  }
  set(cx, H + 1, cz, M.LIT_R); set(cx - 1, H + 1, cz - 1, M.LIT_R);
  for (let y = 2; y <= 8; y++) for (let x = cx - 2; x <= cx + 1; x++) set(x, y, cz - R(y), M.DARK);     // the doors
  // the white dome of the hall at its foot
  begin('Mayu hall', 'shop');
  const hx = lx + 7, hz = lz + 7;
  for (let y = 0; y <= 5; y++) { const r = Math.round(Math.sqrt(36 - y * y)); disc(hx, hz, y, r, y === 2 ? M.GLASS : M.TRIM, y === 0 || y >= 4 ? -1 : r - 2); }
  disc(hx, hz, 3, 5, M.TRIM); set(hx, 6, hz, M.CHROME);
  if (L >= 2) { sakura(lx + 34, lz + 5, 8, 4); lampPost(lx + 20, lz + 2, 18); }
}

// ---- Flame Hall: a black box that widens as it rises, on a glass foot, and on its roof a gold flame lying on its side
// with its tail curled up ------------------------------------------------------------------------------------------------
export function flamehall(lx, lz, L, o = {}) {
  const cx = lx + 20, cz = lz + 22, Y0 = 8, Y1 = 36;
  begin(o.title || 'Flame Hall', 'landmark');
  box(cx - 12, 0, cz - 11, cx + 11, 0, cz + 10, M.STONE);
  walls(cx - 10, 1, cz - 9, cx + 9, Y0 - 1, cz + 8, M.GLASS);
  for (const [a, b] of [[-10, -9], [9, -9], [-10, 8], [9, 8]]) box(cx + a, 1, cz + b, cx + a, Y0 - 1, cz + b, M.DARK);
  box(cx - 2, 1, cz - 2, cx + 1, Y0 - 1, cz + 1, M.DARK);
  for (let x = cx - 3; x <= cx + 2; x++) for (let y = 1; y <= 5; y++) set(x, y, cz - 9, M.DARK);
  // the box: every layer is a ring two thick, and a ring is never more than one voxel wider than the ring under it
  for (let y = Y0; y <= Y1; y++) {
    const h = 12 + (((y - Y0) / 6) | 0), hz = h - 2, full = y === Y0 || y === Y1 || y === 22;
    for (let x = -h; x < h; x++) for (let z = -hz; z < hz; z++) {
      const rx = x < 0 ? -x - 1 : x, rz = z < 0 ? -z - 1 : z, edge = rx >= h - 2 || rz >= hz - 2;
      if (!edge && !full) continue;
      const out = rx === h - 1 || rz === hz - 1;
      set(cx + x, y, cz + z, out && y % 8 === 5 && (x + z) % 4 === 0 ? M.LIT_Y : M.DARK);
    }
  }
  // the flame, in slices across x: thin and high at the tail (low x), fat toward the head, rounded off at the end
  box(cx - 1, Y1 + 1, cz - 3, cx + 12, Y1 + 2, cz + 2, M.BRASS);
  const N = 38, RM = 8;
  let py = 0;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), fat = t < 0.7;
    const r = Math.max(1, Math.round(fat ? RM * Math.pow(t / 0.7, 0.85) : RM * Math.sqrt(Math.max(0, 1 - ((t - 0.7) / 0.3) ** 2))));
    const yc = fat ? Y1 + 2 + r + Math.round(13 * (1 - t / 0.7) ** 2) : Y1 + 2 + RM, x = lx + 1 + i;
    for (let dy = -r; dy < r; dy++) for (let dz = -r; dz < r; dz++) if ((dy + 0.5) * (dy + 0.5) + (dz + 0.5) * (dz + 0.5) <= r * r) set(x, yc + dy, cz + dz, dy === r - 1 && (i & 3) === 0 ? M.LIT_Y : M.BRASS);
    // a slice never sits clear of the last one: where the tail climbs fast, a spine fills between them
    if (i) for (let y = Math.min(py, yc) - 1; y <= Math.max(py, yc); y++) { set(x, y, cz, M.BRASS); set(x, y, cz - 1, M.BRASS); }
    py = yc;
  }
  if (L >= 2) { sakura(lx + 4, lz + 4, 8, 4); sakura(lx + 35, lz + 4, 8, 4); lampPost(lx + 20, lz + 2, 18); }
}

// ---- Bay Studio: two silver slabs, three glazed bridges between them, and a silver ball hung in the frame. It is
// drawn 86 long and 40 deep, so it stands on its own lot and the one beside it -------------------------------------------
export const STUDIO = { LEN: 86, H: 84 };
export function baystudio(lx, lz, L, o = {}) {
  const z0 = lz + 8, z1 = lz + 31, H = STUDIO.H;
  begin(o.title || 'Bay Studio', 'landmark');
  for (const xa of [lx + 2, lx + 60]) {
    const xb = xa + 23;
    for (const F of faces4(xa, z0, xb, z1)) for (let u = 0; u < F.W; u++) for (let y = 0; y <= H; y++) {
      const e = Math.min(u, F.W - 1 - u);
      F.p(u, y, 0, e < 1 || y % 12 === 11 || y === 0 ? M.ZINC : u % 4 === 0 ? M.CHROME : y % 12 < 4 ? M.ZINC : M.GLASS);
    }
    for (let y = 11; y < H; y += 12) box(xa + 1, y, z0 + 1, xb - 1, y, z1 - 1, M.CONC);
    box(xa, H, z0, xb, H, z1, M.SLAB);
    walls(xa + 9, 0, z0 + 9, xa + 14, H, z0 + 14, M.CONC);
    walls(xa + 2, H + 1, z0 + 2, xb - 2, H + 3, z1 - 2, M.CHROME);
  }
  // the frame between the slabs: four columns, and a glazed bridge at three levels
  for (const a of [36, 37, 48, 49]) for (const b of [12, 13, 26, 27]) box(lx + a, 0, lz + b, lx + a, H, lz + b, M.STEEL);
  for (const y0 of [24, 51, 78]) {
    const xa = lx + 25, xb = lx + 60, za = lz + 12, zb = lz + 27, y1 = y0 + 5;
    box(xa, y0, za, xb, y0, zb, M.ZINC); box(xa, y1, za, xb, y1, zb, M.ZINC);
    for (let x = xa; x <= xb; x++) for (let y = y0 + 1; y < y1; y++) for (const z of [za, zb]) set(x, y, z, (x - xa) % 4 === 0 ? M.STEEL : M.GLASS);
  }
  // the ball: a shell two thick resting on the middle bridge and reaching the top one
  const sx = lx + 47, sy = 68, sz = lz + 20, R = 11;
  for (let x = -R; x < R; x++) for (let y = -R; y < R; y++) for (let z = -R; z < R; z++) {
    const d2 = (x + 0.5) ** 2 + (y + 0.5) ** 2 + (z + 0.5) ** 2;
    if (d2 > R * R || d2 < (R - 2) * (R - 2)) continue;
    set(sx + x, sy + y, sz + z, (y === 0 || y === -1) && d2 > (R - 1) * (R - 1) && (x + z) & 1 ? M.GLASS : (x + y * 2 + z) % 5 === 0 ? M.TRIM : M.CHROME);
  }
  box(sx - 1, sy - R - 6, sz - 1, sx, sy - R, sz, M.CHROME); box(sx - 1, sy + R - 1, sz - 1, sx, 78, sz, M.CHROME);
  // a mast on the first slab and the name on the front of it
  box(lx + 13, H + 1, lz + 19, lx + 14, H + 14, lz + 20, M.STEEL); box(lx + 13, H + 15, lz + 19, lx + 13, H + 22, lz + 19, M.TRIM); set(lx + 13, H + 23, lz + 19, M.LIT_R);
  const Ff = face('f', lx + 2, z0, lx + 25, z1);
  Ff.box(0, H - 14, 23, H - 1, 1, 1, M.DARK); text(Ff, 'BAY', 1, H - 13, 2, M.LIT_B, 2);
  hole(lx + 11, 1, z0, lx + 16, 8, z0); hole(lx + 69, 1, z0, lx + 74, 8, z0);
  if (L >= 2) { for (const a of [30, 42, 54]) sakura(lx + a, lz + 4, 8, 4); lampPost(lx + 28, lz + 2, 18); lampPost(lx + 57, lz + 2, 18); bench(lx + 36, lz + 34); bench(lx + 48, lz + 34); }
}

// ---- Bay Expo: four upside-down pyramids, each on a leg, joined at the top into one roof -----------------------------
export const EXPO = { S: 60, LEG: 24, TOP: 46 };
export function bayexpo(lx, lz, L, o = {}) {
  const { LEG, TOP } = EXPO;
  begin(o.title || 'Bay Expo', 'landmark');
  for (const [a, b] of [[15, 15], [45, 15], [15, 45], [45, 45]]) {
    const cx = lx + a, cz = lz + b;
    // the leg: a shaft of silver with a slot of glass down each face, round a concrete core
    for (const F of faces4(cx - 4, cz - 4, cx + 3, cz + 3)) for (let u = 0; u < 8; u++) for (let y = 0; y <= LEG; y++) F.p(u, y, 0, (u === 3 || u === 4) && y % 6 && y > 1 ? M.GLASS : M.CHROME);
    box(cx - 2, 0, cz - 2, cx + 1, LEG, cz + 1, M.CONC); box(cx - 4, LEG, cz - 4, cx + 3, LEG, cz + 3, M.CHROME);
    // the pyramid, point down: a ring two thick at every layer, one voxel wider every second layer
    for (let y = LEG + 1; y <= TOP; y++) {
      const h = 4 + Math.ceil((y - LEG) / 2), full = y === TOP;
      for (let x = -h; x < h; x++) for (let z = -h; z < h; z++) {
        const r = Math.max(x < 0 ? -x - 1 : x, z < 0 ? -z - 1 : z);
        if (r < h - 2 && !full) continue;
        set(cx + x, y, cz + z, full ? M.SLAB : (y - LEG) % 4 === 0 ? M.GLASS : r === h - 1 && (Math.min(x < 0 ? -x - 1 : x, z < 0 ? -z - 1 : z) === h - 1) ? M.TRIM : (y - LEG) % 4 === 2 ? M.ZINC : M.CHROME);
      }
    }
  }
  // the roof they share: a parapet and a line of lights
  walls(lx, TOP + 1, lz, lx + 59, TOP + 1, lz + 59, M.CHROME);
  for (let a = 3; a < 60; a += 6) { set(lx + a, TOP + 2, lz, M.LIT_W); set(lx + a, TOP + 2, lz + 59, M.LIT_W); }
  walls(lx + 24, TOP + 1, lz + 24, lx + 35, TOP + 5, lz + 35, M.ZINC); box(lx + 24, TOP + 6, lz + 24, lx + 35, TOP + 6, lz + 35, M.METAL);
  // the glass hall between the legs
  begin('Expo hall', 'shop');
  walls(lx + 19, 0, lz + 19, lx + 40, 10, lz + 40, M.GLASS); box(lx + 19, 10, lz + 19, lx + 40, 11, lz + 40, M.CHROME);
  for (const [a, b] of [[19, 19], [40, 19], [19, 40], [40, 40]]) box(lx + a, 0, lz + b, lx + a, 10, lz + b, M.CHROME);
  box(lx + 19, 0, lz + 19, lx + 40, 0, lz + 40, M.STONE);
  hole(lx + 27, 1, lz + 19, lx + 32, 7, lz + 19);
  const Ff = face('f', lx + 19, lz + 19, lx + 40, lz + 40);
  Ff.box(2, 12, 19, 18, 0, 0, M.DARK); text(Ff, 'EXPO', 4, 13, 1, M.LIT_Y);
  if (L >= 2) { lampPost(lx + 2, lz + 2, 18); lampPost(lx + 56, lz + 2, 18); bench(lx + 26, lz + 6); bench(lx + 34, lz + 6); }
}

// ---- Pod Tower: two concrete cores, and plugged into them on three sides each a stack of capsule rooms, every one a
// white box with a single round window --------------------------------------------------------------------------------
export function podtower(lx, lz, L, o = {}) {
  begin(o.title || 'Pod Tower', 'landmark');
  // the podium: two storeys of concrete and glass that the cores rise through
  walls(lx + 5, 0, lz + 7, lx + 34, 15, lz + 32, M.CONC); box(lx + 5, 15, lz + 7, lx + 34, 15, lz + 32, M.SLAB); box(lx + 6, 7, lz + 8, lx + 33, 7, lz + 31, M.CONC);
  for (const F of faces4(lx + 5, lz + 7, lx + 34, lz + 32)) for (let u = 2; u < F.W - 2; u++) if (u % 5) { F.box(u, 2, u, 5, 0, 0, M.GLASS); F.box(u, 9, u, 12, 0, 0, M.GLASS); }
  hole(lx + 18, 1, lz + 7, lx + 21, 6, lz + 7);
  // a capsule: a hollow box from (xa, y, za) to (xb, y + 5, zb), with its window on the side that faces out
  const pod = (xa, y, za, xb, zb, side, old) => {
    const m = old ? M.REND_C : M.TRIM;
    walls(xa, y, za, xb, y + 5, zb, m); box(xa, y, za, xb, y, zb, m); box(xa, y + 5, za, xb, y + 5, zb, m);
    const F = face(side, xa, za, xb, zb), u0 = (F.W >> 1) - 2;
    for (let u = 0; u < 4; u++) for (let v = 0; v < 4; v++) if ((u !== 0 && u !== 3) || (v !== 0 && v !== 3)) F.p(u0 + u, y + 1 + v, 0, M.DARK);
    F.p(u0 + 1, y + 3, 0, M.GLASS); F.p(u0 + 2, y + 3, 0, M.GLASS);
  };
  const cores = [[lx + 9, 104, ['l', 'f', 'b']], [lx + 25, 120, ['r', 'f', 'b']]], cz = lz + 17;
  cores.forEach(([x0, H, sides], ci) => {
    box(x0, 0, cz, x0 + 5, H, cz + 5, M.CONC);
    for (let y = 0; y <= H; y += 6) box(x0, y, cz, x0 + 5, y, cz + 5, M.STONE);
    sides.forEach((s, si) => {
      const off = s === 'f' ? 0 : s === 'b' ? 5 : 3;
      for (let k = 0, y = 18 + off; y + 5 <= H - 8; k++, y += 7) {
        const d = 8 - ((k + si + ci) % 3 === 0 ? 1 : 0), old = (k * 7 + si * 3 + ci) % 5 === 0;
        if (s === 'f') pod(x0, y, cz - d, x0 + 7, cz - 1, 'f', old);                // north of the core, shifted east
        else if (s === 'b') pod(x0 - 2, y, cz + 6, x0 + 5, cz + 5 + d, 'b', old);   // south, shifted west
        else if (s === 'l') pod(x0 - d, y, cz - 2, x0 - 1, cz + 5, 'l', old);       // west, shifted north
        else pod(x0 + 6, y, cz, x0 + 5 + d, cz + 7, 'r', old);                      // east, shifted south
      }
    });
    // the plant room and a mast on top
    box(x0 - 1, H + 1, cz - 1, x0 + 6, H + 1, cz + 6, M.CONC); walls(x0 - 1, H + 2, cz - 1, x0 + 6, H + 5, cz + 6, M.CONC); box(x0 - 1, H + 6, cz - 1, x0 + 6, H + 6, cz + 6, M.DARK);
    box(x0 + 2, H + 7, cz + 2, x0 + 2, H + 12 + ci * 4, cz + 2, M.STEEL); set(x0 + 2, H + 13 + ci * 4, cz + 2, M.LIT_R);
  });
  // the bridges between the cores
  for (const y of [40, 70, 96]) box(lx + 15, y, cz + 2, lx + 24, y + 3, cz + 3, M.CONC);
  if (L >= 2) { lampPost(lx + 2, lz + 2, 18); bench(lx + 26, lz + 3); }
}
