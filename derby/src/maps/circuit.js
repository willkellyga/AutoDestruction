// What the street courses share (Crumbletown Circuit, maps/crumble.js, and Manhattan Circuit, maps/manhattan.js): taking
// things out of a built town, the barriers, boards, stands and the start gantry that close it off for a race, measuring
// the room either side of the course's middle line, and painting the course on the ground and the radar.
// A course is a track from racetrack.js (T): its samples X, Z, headings TX, TZ, bends K, and the field round it.
import { WX, WY, WZ, M, set, put, box, walls, begin, rnd, ri, solid, idx, ownerAt, voxAt, setCell, bodies, CARRY } from '../../../src/world.js';
import { GK } from '../../../src/ground.js';
import { face, text, textW } from '../../../src/kit.js';

// ---- taking things out ---------------------------------------------------------------------------------------------
// Take a body out of the town (a lamp post or a tree in the way of the course): its voxels go and it counts as gone.
export function removeBody(b) {
  for (let y = 0; y <= b.y1; y++) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) {
    const i = idx(x, y, z); if (voxAt(i) && ownerAt(i) === b.id) setCell(i, 0, 0);
  }
  b.count = 0; b.init = 0; b.layers.fill(0); b.carry.fill(0); if (b.layers0) b.layers0.fill(0); if (b.dAbove) b.dAbove.fill(0); b.dead = true;
}
export const small = (b) => b && !b.dead && (b.kind === 'prop' || b.kind === 'tree');
// everything small in a box (street furniture, trees, fences, hedges) comes out
export function clearRect(x0, z0, x1, z1) {
  for (const b of bodies) if (small(b) && b.x1 >= x0 - 1 && b.x0 <= x1 + 1 && b.z1 >= z0 - 1 && b.z0 <= z1 + 1) removeBody(b);
}
// The town's build has counted every body's voxels already (finalize in world.js): count the ones added after it the
// same way, from body `first` on.
export function countFrom(first) {
  for (let id = first; id < bodies.length; id++) {
    const b = bodies[id];
    if (b.x1 >= 0) for (let y = 0; y <= b.y1; y++) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) {
      const i = idx(x, y, z), m = voxAt(i);
      if (m && ownerAt(i) === id) { b.count++; b.layers[y]++; b.carry[y] += CARRY[m]; }
    }
    b.init = b.count; b.layers0 = b.layers.slice(); b.dCarry = b.carry.slice(); b.dAbove = new Float64Array(WY);
    for (let y = WY - 2; y >= 0; y--) b.dAbove[y] = b.dAbove[y + 1] + b.layers[y + 1];
  }
}

// ---- closing the streets -------------------------------------------------------------------------------------------
// A wall along a box of cells, a body for each 32 voxels of its length (so a rocket only has a small body to work
// over): concrete blocks four high with a red and white top, or tyres stacked four high with a coloured band.
export function wall(x0, z0, x1, z1, kind) {
  const alongX = x1 - x0 >= z1 - z0, a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1, w0 = alongX ? z0 : x0, w1 = alongX ? z1 : x1;
  for (let a = a0; a <= a1; a += 32) {
    begin(kind === 't' ? 'Tyre wall' : 'Barrier', 'barrier', false);
    for (let t = a; t <= Math.min(a1, a + 31); t++) for (let w = w0; w <= w1; w++) {
      const x = alongX ? t : w, z = alongX ? w : t;
      if (kind === 't') for (let y = 0; y < 4; y++) put(x, y, z, y === 2 ? [M.TRIM, M.CAR_A, M.TRIM, M.CAR_B][Math.floor(t / 3) & 3] : M.TYRE);
      else { for (let y = 0; y < 4; y++) put(x, y, z, M.CONC); put(x, 4, z, Math.floor(t / 6) & 1 ? M.CAR_A : M.TRIM); }
    }
  }
}
// A board standing on a wall, on its side facing the course: a sponsor's name, or chevrons ('<' or '>', the way the
// corner goes as the drivers see it). `side` is the side the course is on: 'f' low z, 'b' high z, 'l' low x, 'r' high x.
export function dress(x0, z0, x1, z1, [side, what]) {
  const alongX = side === 'f' || side === 'b', len = alongX ? x1 - x0 + 1 : z1 - z0 + 1, w = Math.min(len - 6, what.length > 1 ? textW(what) + 6 : 26);
  if (w < 8) return;
  const c = alongX ? (x0 + x1) >> 1 : (z0 + z1) >> 1, a0 = c - (w >> 1), a1 = a0 + w - 1;
  // the board stands on the course's edge of the wall, two voxels thick: the face, and a plain back behind it
  const bx0 = alongX ? a0 : side === 'l' ? x0 : x1, bx1 = alongX ? a1 : bx0, bz0 = alongX ? (side === 'f' ? z0 : z1) : a0, bz1 = alongX ? bz0 : a1;
  const [kx, kz] = { l: [1, 0], r: [-1, 0], f: [0, 1], b: [0, -1] }[side], chev = what === '<' || what === '>';
  begin(chev ? 'Chevron board' : 'Sponsor board', 'sign', false);
  for (let y = 5; y <= 12; y++) for (let z = bz0; z <= bz1; z++) for (let x = bx0; x <= bx1; x++) {
    set(x, y, z, chev ? M.DARK : y === 5 || y === 12 ? M.TRIM : M.CAR_B); set(x + kx, y, z + kz, M.DARK);
  }
  const F = face(side, bx0, bz0, bx1, bz1);
  if (chev) {
    for (let u0 = 2; u0 + 5 < F.W - 1; u0 += 6) for (let t = 0; t <= 3; t++) for (const dy of [t, -t]) for (const k of [0, 1]) {
      const u = what === '<' ? u0 + t + k : u0 + 3 - t + k; F.p(u, 8 + dy, 0, M.LIT_Y);
    }
  } else text(F, what, (F.W - textW(what)) >> 1, 6, 0, M.LIT_Y);
}
// The start gantry across a course that runs along x, at x = lineX from one edge of the course to the other (z0 to
// z1): two steel towers, a beam with the race's name on both faces (the first of `names` that fits), and the box the
// race mode hangs its start lights in front of, on the beam's high-x side (`grid` 1, where the grid is when the course
// runs to low x) or its low-x side (-1).
export function gantry(lineX, z0, z1, names, grid = 1, y = 19) {
  const x0 = lineX - 1, x1 = lineX + 2, zc = (z0 + z1) >> 1;
  clearRect(x0 - 2, z0, x1 + 2, z1);
  begin('Start gantry', 'gantry', true);
  for (const tz of [z0, z1 - 2]) {
    for (let yy = 0; yy < y; yy++) for (const [a, b] of [[0, 0], [3, 0], [0, 2], [3, 2]]) set(x0 + a, yy, tz + b, M.STEEL);
    for (let yy = 0; yy < y; yy += 4) { box(x0, yy, tz, x1, yy, tz, M.METAL); box(x0, yy, tz + 2, x1, yy, tz + 2, M.METAL); }
    box(x0 - 1, 0, tz - 1, x1 + 1, 0, tz + 3, M.CONC);
  }
  walls(x0, y, z0, x1, y + 6, z1, M.DARK); box(x0, y + 6, z0, x1, y + 6, z1, M.TRIM);
  for (const s of ['l', 'r']) {
    const F = face(s, x0, z0, x1, z1);
    for (const name of names) if (textW(name) + 6 <= F.W) { text(F, name, (F.W - textW(name)) >> 1, y + 1, 0, M.LIT_W); break; }
  }
  const bx = grid > 0 ? x1 - 1 : x0; box(bx, y - 4, zc - 13, bx + 1, y - 1, zc + 13, M.DARK);
}
const SKIN = [M.REND_C, M.WP_A, M.FLOOR, M.TRUNK, M.MUD];
const SHIRT = [M.CAR_A, M.CAR_B, M.TRIM, M.AWN_G, M.SIGN, M.DARK, M.FURN_B, M.PL_Y, M.LIT_Y, M.PL_P, M.AWN_B];
// A temporary stand: a steel frame with rows of seats stepping up away from the course, a crowd on most of them, a
// rail along the front and a sponsor's board along the back. (ax, az) is the front corner; it runs `len` along and
// `look` is the way the crowd faces ('w', 'e', 'n' or 's').
export function stand(ax, az, len, rows, look, seat, sponsor) {
  const at = (u, v) => (look === 'w' ? [ax + v, az + u] : look === 'e' ? [ax - v, az + u] : look === 'n' ? [ax + u, az + v] : [ax + u, az - v]);
  const S = (u, y, v, m) => { const [x, z] = at(u, v); set(x, y, z, m); };
  const back = 2 * rows + 2, top = 2 * rows + 5;
  { const [xa, za] = at(0, 0), [xb, zb] = at(len - 1, back + 1); clearRect(Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)); }
  for (let u0 = 0; u0 < len; u0 += 30) {
    begin('Stand', 'stand', true);
    for (let u = u0; u < Math.min(len, u0 + 30); u++) {
      const post = u % 6 === 0 || u === len - 1;
      S(u, 3, 0, M.TRIM); if (post) for (let y = 0; y < 3; y++) S(u, y, 0, M.METAL);
      for (let r = 0; r < rows; r++) {
        const h = 2 + 2 * r, v = 2 + 2 * r;
        S(u, h - 1, v, M.METAL); S(u, h - 1, v + 1, M.METAL); S(u, h, v + 1, (u + r) % 9 === 0 ? M.SLAB : seat);
        if (post) for (let y = 0; y < h - 1; y++) S(u, y, v + 1, M.METAL);
        if ((u + r) % 9 !== 0 && rnd() < 0.62) { S(u, h, v, SHIRT[ri(0, SHIRT.length - 1)]); S(u, h + 1, v, SKIN[ri(0, SKIN.length - 1)]); }
      }
      for (let y = post ? 0 : top - 1; y <= top; y++) S(u, y, back + 1, y === top ? M.TRIM : M.METAL);
    }
  }
  if (sponsor && textW(sponsor) + 4 <= len) {
    begin('Stand sign', 'sign', false);
    const w = textW(sponsor), u = (len - w) >> 1;
    for (let uu = u - 2; uu < u + w + 2; uu++) for (let y = top + 1; y <= top + 7; y++) S(uu, y, back + 1, M.DARK);
    const [xa, za] = at(0, back + 1), [xb, zb] = at(len - 1, back + 1);
    const F = face(look === 'w' ? 'l' : look === 'e' ? 'r' : look === 'n' ? 'f' : 'b', Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb));
    text(F, sponsor, (F.W - w) >> 1, top + 2, 1, M.LIT_Y);
  }
}

// ---- the room either side of the course ------------------------------------------------------------------------------
// whether something stands at car height at (x, z), or it is past where cars can go at the map's edge; with `hard`,
// street furniture and trees don't count
export function blocked(x, z, hard) {
  if (x < 8 || z < 8 || x > WX - 8 || z > WZ - 8) return true;
  for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
    const ix = Math.floor(x + dx), iz = Math.floor(z + dz);
    for (const y of [2, 4]) if (solid(ix, y, iz) && !(hard && small(bodies[ownerAt(idx(ix, y, iz))]))) return true;
  }
  return false;
}
// the room from sample i out to one side (0 left, 1 right) to the first thing standing at car height, or the map's edge
export function reach(T, i, sd, max, hard) {
  const nx = (sd ? -1 : 1) * T.TZ[i], nz = (sd ? 1 : -1) * T.TX[i];
  let d = 1; while (d < max && !blocked(T.X[i] + nx * d, T.Z[i] + nz * d, hard)) d++;
  return d - 1;
}
// The room to the left and right of each sample (T.WL, T.WR), out to whatever stands there, up to `cap` (`capBend` in a
// bend), taken as the least over a few samples either side so that a lamp post or a doorstep counts for a car's length;
// on the inside of a bend, no further than the middle of the curve (past it, across the course means nothing).
export function measure(T, cap, capBend) {
  const { N, K } = T, raw = [new Float32Array(N), new Float32Array(N)];
  for (let i = 0; i < N; i++) { raw[0][i] = reach(T, i, 0, capBend + 6); raw[1][i] = reach(T, i, 1, capBend + 6); }
  const bendy = new Uint8Array(N);
  for (let i = 0; i < N; i++) for (let k = -12; k <= 12; k++) if (Math.abs(K[T.at(i + k)]) > 1 / 90) { bendy[i] = 1; break; }
  const WL = new Float32Array(N), WR = new Float32Array(N);
  for (let i = 0; i < N; i++) for (const [sd, W] of [[0, WL], [1, WR]]) {
    let m = 1e9; for (let k = -4; k <= 4; k++) m = Math.min(m, raw[sd][T.at(i + k)]);
    W[i] = Math.min(m, bendy[i] ? capBend : cap);
  }
  for (let i = 0; i < N; i++) if (K[i]) { const W = K[i] > 0 ? WL : WR; W[i] = Math.min(W[i], 1 / Math.abs(K[i]) - 1); }
  T.WL = WL; T.WR = WR;
}
// the checkpoint gates: `n` of them evenly round the lap from the line, with the nearest moved to each of `apex` (the
// far end of a hairpin, say, so that a short cut across its middle doesn't save the trip round it)
export function gatesFor(T, n, apex = []) {
  const { N, X, Z, L, STEP } = T, gateS = [];
  for (let k = 0; k < n; k++) gateS.push(k * L / n);
  for (const [x, z] of apex) {
    let bi = 0, bd = 1e9; for (let i = 0; i < N; i++) { const d = Math.hypot(X[i] - x, Z[i] - z); if (d < bd) { bd = d; bi = i; } }
    const s = bi * STEP; let k = 1; for (let j = 2; j < n; j++) if (Math.abs(gateS[j] - s) < Math.abs(gateS[k] - s)) k = j;
    gateS[k] = s;
  }
  return { gateS, gates: gateS.map((s) => Math.round(s / STEP) % N) };
}
// the grid behind the line, two by two and staggered across the middle of the road; `pole` is the side the pole sitter
// takes (+1 left, the inside of a first corner that goes left)
export function gridFor(T, pole = 1, row = 26) {
  const { N, X, Z, TX, TZ, L, STEP, WL, WR } = T, grid = [], mid = (WL[0] - WR[0]) / 2;
  for (let k = 0; k < 6; k++) {
    const col = k & 1, back = 16 + (k >> 1) * row + col * Math.round(row / 2), lat = mid + (col ? -10 : 10) * pole, i = Math.round((L - back) / STEP) % N;
    grid.push({ x: X[i] + TZ[i] * lat, z: Z[i] - TX[i] * lat, yaw: Math.atan2(TX[i], TZ[i]) });
  }
  return grid;
}

// ---- painting ------------------------------------------------------------------------------------------------------
// The course on the ground canvas: asphalt over all its room, a pale kerb along each edge, red and white round the
// bends, the start line and the grid's boxes, and an arrow on the road before each corner. The kerbs go down first, just
// outside the edges, so that where the inside edge of a tight corner crosses the asphalt of the course either side of
// it the asphalt covers it. `seed` varies the asphalt's grain. Given the racing line (`line`, for a map whose floor
// lays a fine grain over its hard ground: ground.js), the asphalt has no fleck a voxel big but the wear of a working
// street instead (wear()).
export function paintCourse(g, T, grid, seed = 31, line = null) {
  const { N, X, Z, TX, TZ, K, WL, WR } = T;
  let s = seed; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const P = (a, l, i) => [(X[i] + TX[i] * a + TZ[i] * l) * GK, (Z[i] + TZ[i] * a - TX[i] * l) * GK];   // along and across the course at sample i, on the canvas
  // a piece of the course from sample i to the next, from l0 to l1 across it at i and m0 to m1 at the next
  const quad = (i, l0, l1, m0, m1, col) => {
    const j = T.at(i + 1), a = P(-0.4, l0, i), b = P(-0.4, l1, i), c = P(0.4, m1, j), d = P(0.4, m0, j);
    g.fillStyle = col; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); g.fill();
  };
  const bend = (i) => Math.abs(K[i]) > 1 / 80;
  for (let i = 0; i < N; i++) { const j = T.at(i + 1); quad(i, -WR[i] - 1.4, WL[i] + 1.4, -WR[j] - 1.4, WL[j] + 1.4, '#eee8da'); }
  for (let i = 0; i < N; i++) if (bend(i)) {
    const j = T.at(i + 1), col = (i >> 1) & 1 ? '#d8d2c4' : '#c8352c';
    for (const [sd, w] of [[1, WL], [-1, WR]]) quad(i, sd * (w[i] - 0.2), sd * (w[i] + 2.4), sd * (w[j] - 0.2), sd * (w[j] + 2.4), col);
  }
  for (let i = 0; i < N; i++) { const j = T.at(i + 1); quad(i, -WR[i], WL[i], -WR[j], WL[j], '#474b54'); }
  if (line) wear(g, T, line, r, P);
  else for (let n = 0; n < N * 70; n++) {
    const i = (r() * N) | 0, [x, z] = P(r() * T.STEP, -WR[i] + r() * (WL[i] + WR[i]), i);
    g.fillStyle = r() < 0.5 ? 'rgba(30,32,38,0.24)' : 'rgba(110,114,124,0.15)'; g.fillRect(Math.floor(x / GK) * GK, Math.floor(z / GK) * GK, GK, GK);
  }
  // the start line: a band of chequers across the course, and the grid's boxes behind it
  for (let a = 0; a < 4; a += 2) for (let l = -Math.floor(WR[0]); l < WL[0] - 1; l += 2) {
    const [x, z] = P(-a, l, 0); g.fillStyle = ((a + l) >> 1) & 1 ? '#f4f2ea' : '#1c1d21'; g.fillRect(Math.round(x / GK - 1) * GK, Math.round(z / GK - 1) * GK, 2 * GK, 2 * GK);
  }
  g.strokeStyle = 'rgba(244,242,234,0.9)'; g.lineWidth = 0.7 * GK;
  for (const sl of grid) {
    const fx = Math.sin(sl.yaw), fz = Math.cos(sl.yaw), lx = Math.cos(sl.yaw), lz = -Math.sin(sl.yaw), q = (a, l) => [(sl.x + fx * a + lx * l) * GK, (sl.z + fz * a + lz * l) * GK];
    g.beginPath(); g.moveTo(...q(4, -6)); g.lineTo(...q(15, -6)); g.lineTo(...q(15, 6)); g.lineTo(...q(4, 6)); g.stroke();
  }
  // an arrow on the road before each corner, the way it goes
  g.fillStyle = 'rgba(244,242,234,0.85)'; g.strokeStyle = 'rgba(244,242,234,0.85)'; g.lineWidth = 1.6 * GK;
  for (let i = 0; i < N; i++) {
    const j = T.at(i + 1); if (Math.abs(K[i]) >= 1 / 70 || Math.abs(K[j]) < 1 / 70) continue;   // where a bend starts
    const back = T.at(i - Math.round(40 / T.STEP)), side = K[j] > 0 ? 1 : -1;
    if (Math.abs(K[back]) > 1 / 90) continue;
    g.beginPath(); g.moveTo(...P(-8, 0, back)); g.lineTo(...P(4, 0, back)); g.lineTo(...P(4, side * 5, back)); g.stroke();
    g.beginPath(); g.moveTo(...P(4 + 3, side * 5, back)); g.lineTo(...P(4 - 3, side * 5, back)); g.lineTo(...P(4, side * 9, back)); g.closePath(); g.fill();
  }
}
// The wear of a working street on the course's asphalt, drawn over it and kept inside it. Coarse to fine: the paver's
// strips along it, each a shade apart, with a seam between; the dark bands where the wheels run on the racing line,
// polished and rubbered in; patches where the road was dug up, some fresh and black, some old and faded, and trenches
// across it; oil dripped where cars stood and braked; manhole covers; and cracks, most of them sealed with tar.
function wear(g, T, line, r, P) {
  const { N, K, WL, WR, STEP } = T, at = T.at, off = line.off;
  g.save();
  g.beginPath();
  for (let i = 0; i < N; i++) {
    const j = at(i + 1), a = P(-0.6, -WR[i], i), b = P(-0.6, WL[i], i), c = P(0.6, WL[j], j), d = P(0.6, -WR[j], j);
    g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath();
  }
  g.clip();
  // the paver's strips: 11 voxels wide across the middle line, laid in runs of about 150 voxels
  const LANE = 11;
  for (let k = -6; k <= 5; k++) {
    const runOf = (i) => Math.floor((i * STEP + (k + 6) * 37) / 150);
    for (let i0 = 0; i0 < N;) {
      let i1 = i0; while (i1 < N && runOf(i1) === runOf(i0)) i1++;
      const v = r();
      g.fillStyle = v < 0.5 ? `rgba(255,255,255,${(0.006 + v * 0.02).toFixed(3)})` : `rgba(0,0,0,${(0.008 + (v - 0.5) * 0.03).toFixed(3)})`;
      g.beginPath();
      for (let i = i0; i <= i1; i++) (i > i0 ? g.lineTo : g.moveTo).call(g, ...P(0, k * LANE, at(i)));
      for (let i = i1; i >= i0; i--) g.lineTo(...P(0, (k + 1) * LANE, at(i)));
      g.closePath(); g.fill();
      i0 = i1;
    }
  }
  const along = (l, i0, n, style, width) => {
    g.strokeStyle = style; g.lineWidth = width * GK; g.beginPath();
    for (let k = 0; k <= n; k++) { const i = at(i0 + k); (k ? g.lineTo : g.moveTo).call(g, ...P(0, typeof l === 'function' ? l(i) : l, i)); }
    g.stroke();
  };
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (let k = -5; k <= 5; k++) along(k * LANE, 0, N, 'rgba(18,19,22,0.1)', 0.2);
  // the wheel lanes on the racing line, a shade darker in stretches, darkest where cars brake and turn, and the oil
  // dripped down the middle between them
  g.lineCap = 'butt';
  for (let i0 = 0; i0 < N; i0 += 6) {
    const bend = Math.min(1, Math.abs(K[at(i0 + 8)]) * 60), a = 0.07 + 0.03 * r() + 0.08 * bend;
    along((i) => off[i], i0, 6, `rgba(8,8,10,${(a * 0.3).toFixed(3)})`, 7.5);
    for (const side of [-2.6, 2.6]) along((i) => off[i] + side, i0, 6, `rgba(8,8,10,${a.toFixed(3)})`, 1.7 + r() * 0.6);
    if (r() < 0.7) along((i) => off[i] + 0.3, i0, 6, `rgba(6,6,8,${(0.05 + 0.08 * r()).toFixed(3)})`, 0.9 + r() * 0.6);
  }
  g.lineCap = 'round';
  // patches: a box along the course at sample i, from a0 to a1 along it and l0 to l1 across, filled and its seam sealed
  const patch = (i, a0, a1, l0, l1, fill) => {
    const pts = [P(a0, l0, i), P(a0, l1, i), P(a1, l1, i), P(a1, l0, i)];
    g.fillStyle = fill; g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(16,16,18,0.16)'; g.lineWidth = 0.2 * GK; g.stroke();
  };
  // (few, and only a shade off the road: Will, 2026-11-24, "I don't love the dramatic asphalt texture differences ...
  // It looks patchy ... the asphalt should be more consistent")
  for (let n = 0; n < N / 22; n++) {
    const i = (r() * N) | 0, w = 2 + r() * 4, len = 4 + r() * 12, l = -WR[i] + r() * (WL[i] + WR[i] - w), fresh = r() < 0.45;
    patch(i, 0, len, l, l + w, fresh ? `rgba(50,53,60,${(0.16 + r() * 0.1).toFixed(2)})` : `rgba(96,98,104,${(0.05 + r() * 0.05).toFixed(2)})`);
  }
  // oil: drips along the middle of each car's way, more where they brake for a bend, and pools on the grid
  const stain = (x, z, rx, rz, ang, a) => { g.fillStyle = `rgba(10,10,12,${a.toFixed(3)})`; g.beginPath(); g.ellipse(x, z, rx * GK, rz * GK, ang, 0, 6.3); g.fill(); };
  for (let n = 0; n < N * 0.6; n++) {
    const i = (r() * N) | 0, bend = Math.min(1, Math.abs(K[at(i + 10)]) * 60);
    if (r() > 0.35 + 0.65 * bend) continue;
    const l = r() < 0.6 ? off[i] + (r() - 0.5) * 3 : -WR[i] + r() * (WL[i] + WR[i]), [x, z] = P(r() * STEP, l, i), rx = 0.5 + r() * r() * 2.6;
    stain(x, z, rx, rx * (0.4 + r() * 0.5), Math.atan2(T.TZ[i], T.TX[i]) + (r() - 0.5) * 0.6, 0.1 + r() * 0.22);
  }
  // manhole covers, here and there in the lanes
  for (let n = 0; n < N / 40; n++) {
    const i = (r() * N) | 0, [x, z] = P(0, (r() - 0.5) * 2 * Math.min(WL[i], WR[i]) * 0.8, i);
    g.fillStyle = '#3b3d42'; g.beginPath(); g.arc(x, z, 1.25 * GK, 0, 6.3); g.fill();
    g.strokeStyle = 'rgba(16,16,18,0.7)'; g.lineWidth = 0.25 * GK; g.stroke();
    g.strokeStyle = 'rgba(110,112,118,0.35)'; g.lineWidth = 0.12 * GK; g.beginPath(); g.arc(x, z, 0.8 * GK, 0, 6.3); g.stroke();
  }
  // cracks: a wandering line, along or across the road, now and then branching; most sealed with tar (wider, black)
  const crack = (x, z, a, len, sealed, depth = 0) => {
    g.strokeStyle = sealed ? 'rgba(12,12,14,0.42)' : 'rgba(26,27,30,0.38)'; g.lineWidth = (sealed ? 0.3 : 0.13) * GK;
    g.beginPath(); g.moveTo(x, z);
    let da = 0;
    for (let t = 0; t < len; t += 0.8) {
      da = da * 0.75 + (r() - 0.5) * 0.3; a += da + (r() - 0.5) * 0.25; x += Math.cos(a) * 0.8 * GK; z += Math.sin(a) * 0.8 * GK; g.lineTo(x, z);
      if (depth < 1 && r() < 0.06) { g.stroke(); crack(x, z, a + (r() < 0.5 ? 1 : -1) * (0.6 + r()), len * 0.4, sealed, depth + 1); g.beginPath(); g.moveTo(x, z); }
    }
    g.stroke();
  };
  for (let n = 0; n < N / 7; n++) {
    const i = (r() * N) | 0, [x, z] = P(0, -WR[i] + r() * (WL[i] + WR[i]), i), head = Math.atan2(T.TZ[i], T.TX[i]);
    crack(x, z, head + (r() < 0.5 ? 0 : Math.PI / 2) + (r() - 0.5) * 0.5, 5 + r() * 14, r() < 0.75);
  }
  g.restore();
}

// the grass on a painted ground, read back a voxel at a time (for a map's surface()). With `hard`, the paint's alpha is
// taken down to a half everywhere but on the grass and the water, a voxel at a time: the floor gives that its grain and
// its rubber (ground.js: MAP.groundDetail with hard). Given the course (`T`, painted by paintCourse() with its racing
// line, so without a fleck), the streets off it go a little lower still, 0.45: only there does the floor even out the
// paint's fleck (deFleck), which on the course would only blur its patches and stains away and leave a halo round its
// lines.
export function grassOf(cv, hard = false, T = null) {
  const sm = document.createElement('canvas'); sm.width = WX; sm.height = WZ;
  const sg = sm.getContext('2d'); sg.drawImage(cv, 0, 0, WX, WZ);
  const img = sg.getImageData(0, 0, WX, WZ), D = img.data, grassy = new Uint8Array(WX * WZ);
  for (let c = 0; c < WX * WZ; c++) grassy[c] = D[c * 4 + 1] > D[c * 4] + 12 && D[c * 4 + 1] > D[c * 4 + 2] + 12 ? 1 : 0;
  if (hard) {
    for (let c = 0; c < WX * WZ; c++) {
      const water = D[c * 4 + 2] > D[c * 4] + 25 && D[c * 4 + 2] >= D[c * 4 + 1];
      let on = true;
      if (T) { const i = T.field.near[c], l = T.field.lat[c]; on = i >= 0 && l < T.WL[i] + 2.5 && l > -T.WR[i] - 2.5; }
      D[c * 4] = D[c * 4 + 1] = D[c * 4 + 2] = 0; D[c * 4 + 3] = grassy[c] || water ? 0 : on ? 128 : 140;
    }
    sg.putImageData(img, 0, 0);
    const g = cv.getContext('2d');
    g.save(); g.globalCompositeOperation = 'destination-out'; g.imageSmoothingEnabled = true; g.drawImage(sm, 0, 0, cv.width, cv.height); g.restore();
  }
  sm.width = sm.height = 1;
  return grassy;
}
// What the ground is at (x, z) on a street course: 0 on the course and paving, 0.7 on the grass (see vehicle.js)
export function surfaceAt(T, grassy, x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  if (ix < 0 || iz < 0 || ix >= WX || iz >= WZ) return 0.7;
  const c = iz * WX + ix, i = T.field.near[c];
  if (i >= 0) { const l = T.field.lat[c]; if (l < T.WL[i] + 2 && l > -T.WR[i] - 2) return 0; }
  return grassy[c] ? 0.7 : 0;
}
// The course on the radar, drawn onto a canvas of its own (a map keeps it and draws it each frame): faint streets, the
// course its whole width sample by sample, and the start line
export function radarCourse(cv, T, s, ox, oy, streetsX, streetsZ, w, h) {
  const g = cv.getContext('2d'), { N, X, Z, TX, TZ, WL, WR } = T;
  g.clearRect(0, 0, cv.width, cv.height);
  g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 24 * s; g.beginPath();
  for (const x of streetsX) { g.moveTo(ox + x * s, oy); g.lineTo(ox + x * s, oy + h); }
  for (const z of streetsZ) { g.moveTo(ox, oy + z * s); g.lineTo(ox + w, oy + z * s); }
  g.stroke();
  const P = (a, l, i) => [ox + (X[i] + TX[i] * a + TZ[i] * l) * s, oy + (Z[i] + TZ[i] * a - TX[i] * l) * s];
  g.fillStyle = 'rgba(255,255,255,0.34)';
  for (let i = 0; i < N; i++) {
    const j = T.at(i + 1), a = P(-0.5, -WR[i], i), b = P(-0.5, WL[i], i), c = P(0.5, WL[j], j), d = P(0.5, -WR[j], j);
    g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...d); g.closePath(); g.fill();
  }
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.moveTo(...P(0, -WR[0], 0)); g.lineTo(...P(0, WL[0], 0)); g.stroke();
}
