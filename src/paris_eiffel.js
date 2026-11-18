// The Eiffel Tower: 250 voxels of iron lattice on four legs, with three platforms and a mast. It stands over a street,
// which runs between its legs (the gap is 56 voxels, the street with both pavements 36), so its lot is drawn unturned:
// 119 voxels across and 132 deep, with the tower's axis 58 in from the west side and 66 down from the north.
//
// The tower is one body, so the pieces have to hold on to each other face to face. Every lattice face is two voxels
// thick and every profile changes by at most one voxel a layer, which keeps a common column between any two layers.
import { M, set, put, box, begin } from './world.js';
import { tree, lampPost, bench, bin, planter } from './kit.js';

// straight lines between the knots of a profile: [[y, value], ...]
const along = (K) => (y) => { for (let i = 1; i < K.length; i++) if (y <= K[i][0]) { const [y0, v0] = K[i - 1], [y1, v1] = K[i]; return Math.round(v0 + (v1 - v0) * (y - y0) / (y1 - y0)); } return K[K.length - 1][1]; };
export const EIFFEL = { H: 250, P1: 44, P2: 89, P3: 213, AX: 58, AZ: 66, W: 119, D: 132 };
const { P1, P2, P3 } = EIFFEL;
const OUT = along([[0, 50], [P1, 27], [P2, 15], [P3, 5], [221, 4], [236, 2]]);   // half the tower's width at height y
const IN = along([[0, 28], [P1, 13], [P2, 6], [104, 0]]);                         // half the gap between the legs
const mod = (a, n) => ((a % n) + n) % n;

export function eiffel(lx, lz, L, o = {}) {
  const cx = lx + EIFFEL.AX, cz = lz + EIFFEL.AZ;
  begin(o.title || 'Eiffel Tower', 'landmark');
  // one quarter is drawn and mirrored: a and b count outward from the axis, which lies between two voxels
  const q = (a, y, b, m) => { set(cx + a, y, cz + b, m); set(cx - 1 - a, y, cz + b, m); set(cx + a, y, cz - 1 - b, m); set(cx - 1 - a, y, cz - 1 - b, m); };
  const qp = (a, y, b, m) => { put(cx + a, y, cz + b, m); put(cx - 1 - a, y, cz + b, m); put(cx + a, y, cz - 1 - b, m); put(cx - 1 - a, y, cz - 1 - b, m); };
  // masonry feet
  for (let y = 0; y <= 2; y++) for (let a = 26 + y; a < 52 - y; a++) for (let b = 26 + y; b < 52 - y; b++) q(a, y, b, M.STONE);
  // the legs, then the single shaft they join into: hollow squares of lattice with a post at every corner
  for (let y = 3; y <= 236; y++) {
    const E = OUT(y), I = IN(y), ring = y % 12 === 0, P = y < P2 ? 3 : 2;
    for (let a = I; a < E; a++) for (let b = I; b < E; b++) {
      const ea = a >= E - 2 || (I > 0 && a < I + 2), eb = b >= E - 2 || (I > 0 && b < I + 2);
      if (!ea && !eb) continue;
      const pa = a >= E - P || (I > 0 && a < I + P), pb = b >= E - P || (I > 0 && b < I + P);
      const t = ea ? b : a;
      if ((pa && pb) || ring || mod(t + y, 12) < 2 || mod(t - y, 12) < 2) q(a, y, b, M.IRON);
    }
  }
  // the four arches under the first platform, on the sloping outer faces, with struts up to the deck
  const arch = (t) => (t >= 26 ? -1 : 8 + 31 * Math.sqrt(1 - (t / 26) * (t / 26)));
  for (let y = 6; y < P1; y++) {
    const E = OUT(y), I = IN(y);
    for (let t = 0; t < I + 2; t++) {
      const top = arch(t), low = arch(t + 1);
      const band = top >= 0 && y <= top + 1 && y >= Math.max(low, 0) - 1.5 && (low >= 0 || y >= 8);
      const strut = top >= 0 && y > top && (t % 6 === 2 || y >= P1 - 2);
      if (!band && !strut) continue;
      for (const a of [E - 2, E - 1]) { qp(a, y, t, M.IRON); qp(t, y, a, M.IRON); }
    }
  }
  // a platform: a deck with a hole in the middle, a fascia strung with bulbs and a rail round the edge
  const deck = (y, D, hole, lamp) => {
    for (let a = 0; a < D; a++) for (let b = 0; b < D; b++) {
      const r = Math.max(a, b);
      if (r >= hole) q(a, y, b, M.IRON);
      if (r >= D - 2) { for (let yy = y + 1; yy <= y + 3; yy++) q(a, yy, b, r === D - 1 && yy === y + 2 && (a + b) % lamp === 0 ? M.LIT_Y : M.IRON); }
      if (r === D - 1) { q(a, y + 5, b, M.IRON); if ((a + b) % 3 === 0 || Math.min(a, b) === D - 1) q(a, y + 4, b, M.IRON); }
    }
  };
  deck(P1, OUT(P1) + 3, 9, 4);
  deck(P2, OUT(P2) + 3, 0, 3);
  if (L >= 2) {
    // a glass pavilion on each side of the first platform, between the legs
    for (let t = 0; t < 8; t++) for (let d = 17; d <= 25; d++) {
      const wall = t === 7 || d === 17 || d === 25;
      for (let y = P1 + 1; y <= P1 + 6; y++) if (wall) { const m = y === P1 + 1 || (t === 7 && (d === 17 || d === 25)) ? M.TRIM : M.GLASS; qp(t, y, d, m); qp(d, y, t, m); }
      qp(t, P1 + 7, d, M.ZINC); qp(d, P1 + 7, t, M.ZINC);
    }
    for (const [t, d] of [[2, 21], [5, 21]]) { qp(t, P1 + 6, d, M.LIT); qp(d, P1 + 6, t, M.LIT); }
  }
  // the lift shaft from the second platform to the top
  for (let y = P2 + 1; y < P3; y++) q(0, y, 0, y % 6 < 4 ? M.STEEL : M.LIT_W);
  // the top: a glazed cabin under a roof, the spire and the mast with its red light
  deck(P3, OUT(P3) + 3, 0, 2);
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
    if (Math.max(a, b) === 5) for (let y = P3 + 1; y <= P3 + 6; y++) q(a, y, b, a === b || y === P3 + 1 || y === P3 + 6 ? M.IRON : (a + b) % 3 === 0 ? M.LIT_W : M.GLASS);
    q(a, P3 + 7, b, M.IRON);
  }
  for (let y = 237; y <= 248; y++) q(0, y, 0, M.DARK);
  q(0, 249, 0, M.LIT_R);
  // round the foot: ticket kiosks, lamps, benches and a row of trees at each end of the lot
  if (L >= 2) {
    for (const s of [0, 1]) {
      const kx = cx + (s ? 19 : -26), kz = cz + (s ? 34 : -41);   // between the pavement and a foot
      begin('Ticket kiosk', 'shop');
      for (let y = 0; y <= 7; y++) for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) { if (x > 0 && x < 6 && z > 0 && z < 6) continue; set(kx + x, y, kz + z, y >= 3 && y <= 5 && (x === 3 || z === 3) ? M.GLASS : M.DOOR_G); }
      box(kx - 1, 8, kz - 1, kx + 7, 8, kz + 7, M.ZINC); box(kx + 1, 9, kz + 1, kx + 5, 9, kz + 5, M.ZINC); set(kx + 3, 10, kz + 3, M.BRASS);
    }
    for (const z of [lz + 3, lz + 124]) for (const a of [26, 34, 42, 50]) { tree(cx + a, z, 11, 4); tree(cx - 2 - a, z, 11, 4); }
    for (const [a, b] of [[22, 57], [-23, 57], [22, -58], [-23, -58]]) lampPost(cx + a, cz + b, 22);
    for (const [a, b] of [[30, 60], [-38, 60], [30, -62], [-38, -62]]) bench(cx + a, cz + b);
    for (const [a, b] of [[24, 0], [-26, 0]]) { planter(cx + a, cz + b - 12, 9); planter(cx + a, cz + b + 4, 9); }
    bin(cx + 22, cz + 54); bin(cx - 24, cz - 56);
  }
}
