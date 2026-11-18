// Tokyo's water and what stands in and over it: the railings along the banks, the six coloured arch bridges over the
// Sumida, the Rainbow Bridge across the bay, a container ship under the cranes and the roofed pleasure boats on the
// river; and the painted ground: river, bay, the palace moat, the station's tracks, the temple's paving, the scramble.
// The map is flat, so the water is paint, a bridge's deck is the street itself, and monsters wade.
import { M, WX, WZ, STREET_X, STREET_Z, set, box, begin, setSeed } from './world.js';
import { lampPost } from './kit.js';
import { RIVER, BAY, PALACE_AT, STATION_AT, SENSO_AT, SHIBA_AT, WHEEL_AT, SCRAMBLE, POND_AT, METRO_AT, STUDIO_AT, EXPO_AT, wet } from './tokyo.js';
import { PALACE, STATION } from './tokyo_landmarks.js';

// A length of iron railing along x (z0 === z1) or along z.
function rail(x0, z0, x1, z1) {
  begin('Quay rail', 'prop', true);
  const n = Math.max(x1 - x0, z1 - z0);
  for (let k = 0; k <= n; k++) { const x = z0 === z1 ? x0 + k : x0, z = z0 === z1 ? z0 : z0 + k; set(x, 3, z, M.DARK); if (k % 4 === 0 || k === n) box(x, 0, z, x, 2, z, M.DARK); }
}
// railings along a shore from a to b at `at`, in lengths, leaving a gap wherever a street comes through
function shore(alongX, at, a, b) {
  const cross = alongX ? STREET_X : STREET_Z;
  for (let t = a; t < b; t += 26) { const tb = Math.min(t + 23, b); if (cross.some((s) => s > t - 22 && s < tb + 22)) continue; if (alongX) rail(t, at, tb, at); else rail(at, t, at, tb); }
}

// ---- the Sumida bridges: a steel arch down each side of the road, with hangers to the deck and two beams across the
// crown, each bridge its own colour ------------------------------------------------------------------------------------
function archBridge(zc, m, title) {
  const X0 = RIVER.x0, X1 = RIVER.x1 - 1, n = X1 - X0, top = (x) => Math.round(3 + 20 * Math.sin(Math.PI * (x - X0) / n)), mid = (X0 + X1) >> 1;
  [zc - 20, zc + 20].forEach((z, side) => {
    begin(title, 'monument');
    let py = 3;
    for (let x = X0; x <= X1; x++) {
      const y = top(x);
      for (let yy = Math.min(py, y); yy <= Math.max(py, y) + 1; yy++) set(x, yy, z, m);
      set(x, 3, z, m); if ((x - X0) % 4 === 0 || x === X1) box(x, 0, z, x, y, z, m);
      py = y;
    }
    for (const x of [X0, X1 - 3]) box(x, 0, z - 1, x + 3, 4, z + 1, M.GRANITE);
    if (side === 0) for (const x of [mid - 9, mid + 9]) box(x, top(x), zc - 19, x, top(x) + 1, zc + 19, m);
  });
  lampPost(X0 + 14, zc - 15, 18); lampPost(X1 - 18, zc + 14, 18);
}

// ---- the Rainbow Bridge: two white towers, the cables down each side, lights along the top ---------------------------
const TA = 742, TB = 818;   // where its two towers stand (each is 8 long)
function tower(xa, zc, m, title, H) {
  begin(title, 'landmark');
  for (const z0 of [zc - 23, zc + 20]) { box(xa + 2, 0, z0, xa + 5, H, z0 + 3, m); box(xa + 1, 0, z0 - 1, xa + 6, 5, z0 + 4, M.GRANITE); set(xa + 3, H + 1, z0 + 1, M.LIT_R); }
  for (const [ya, yb] of [[30, 33], [H - 8, H - 4]]) box(xa + 3, ya, zc - 19, xa + 4, yb, zc + 19, m);
  for (let dz = -19; dz <= 19; dz += 4) set(xa + 3, H - 3, zc + dz, [M.LIT_R, M.LIT_Y, M.LIT_G, M.LIT_B, M.LIT_P][((dz + 19) >> 2) % 5]);
}
// The cables down one side: from an anchor at each end up over both towers, sagging between them, with a hanger down
// to the deck every four voxels. T is the height of the tower tops.
function cables(zc, T, title, m) {
  const X0 = BAY.x0 + 2, X1 = RIVER.x1 - 3, mid = (TA + TB + 7) / 2, half = (TB - TA) / 2 - 4;
  const sag = (x) => (x < TA ? 3 + (T - 3) * ((x - X0) / (TA - 1 - X0)) ** 1.5 : x > TB + 7 ? 3 + (T - 3) * ((X1 - x) / (X1 - TB - 8)) ** 1.5 : 16 + (T - 16) * Math.min(1, ((x - mid) / half) ** 2));
  for (const z of [zc - 21, zc + 21]) {
    begin(title + ' cables', 'monument', true);
    box(X0 - 2, 0, z - 1, X0 + 1, 4, z + 1, M.GRANITE); box(X1 - 1, 0, z - 1, X1 + 2, 4, z + 1, M.GRANITE);
    let py = 3;
    for (let x = X0; x <= X1; x++) {
      const on = (x >= TA && x <= TA + 7) || (x >= TB && x <= TB + 7), edge = x === TA - 1 || x === TA + 8 || x === TB - 1 || x === TB + 8;
      const y = on || edge ? T : Math.max(3, Math.min(T, Math.round(sag(x))));
      if (on) set(x, T, z, m);
      else { for (let yy = Math.min(py, y); yy <= Math.max(py, y); yy++) set(x, yy, z, m); if (x % 4 === 0 || x === X0 || x === X1) box(x, 0, z, x, Math.min(py, y), z, m); set(x, 3, z, m); }
      py = y;
    }
  }
}

// ---- boats: drawn bow first along a line that runs along x, or along z for the river ---------------------------------
const plotter = (x0, z0, alongZ) => (i, y, d, m) => (alongZ ? set(x0 + d, y, z0 + i, m) : set(x0 + i, y, z0 + d, m));
function hull(P, len, half, hgt, m, keel, bow, deckM) {
  const W = (i) => { const t = i >= len - bow ? (i - (len - bow) + 1) / bow : i < 4 ? (4 - i) / 10 : 0; return Math.max(1, Math.round(half * (1 - t * t))); };
  for (let i = 0; i < len; i++) {
    const w = W(i), wn = Math.min(i ? W(i - 1) : 0, i < len - 1 ? W(i + 1) : 0);
    for (let d = -w; d < w; d++) {
      const skin = d === -w || d === w - 1 || d < -wn || d >= wn || i % 8 === 0;
      for (let y = 0; y <= hgt; y++) if (y < 2 || y === hgt || skin) P(i, y, d, y < 2 ? keel : y === hgt ? deckM : m);
    }
  }
}
const pbox = (P, i0, y0, d0, i1, y1, d1, m) => { for (let i = i0; i <= i1; i++) for (let y = y0; y <= y1; y++) for (let d = d0; d <= d1; d++) P(i, y, d, m); };
const LOADS = [M.CAR_A, M.CAR_B, M.DOOR_G, M.SIGN, M.TRIM, M.TAXI, M.ROOF_R, M.TANK];
function containerShip(x0, zc) {
  begin('Container ship', 'boat', true);
  const P = plotter(x0, zc, false);
  hull(P, 86, 8, 9, M.TANK, M.CAR_A, 12, M.DARK);
  for (let k = 0, i = 16; i + 7 <= 72; i += 8, k++) for (const [d0, d1] of [[-7, -1], [0, 6]]) {
    const n = 1 + ((k * 3 + (d0 < 0 ? 1 : 2)) % 3);
    for (let s = 0; s < n; s++) { const m = LOADS[(k * 5 + s * 3 + (d0 < 0 ? 0 : 4)) % LOADS.length], y = 10 + s * 5; pbox(P, i, y, d0, i + 6, y + 4, d1 - 1, m); for (let d = d0; d < d1; d += 2) pbox(P, i, y + 1, d, i, y + 3, d, M.DARK); }
  }
  pbox(P, 3, 10, -6, 11, 24, 5, M.TRIM); pbox(P, 3, 21, -7, 11, 22, 6, M.GLASS); pbox(P, 2, 25, -7, 12, 25, 6, M.TRIM);
  pbox(P, 5, 26, -2, 8, 31, 1, M.CAR_A); pbox(P, 5, 32, -2, 8, 32, 1, M.DARK); pbox(P, 80, 10, 0, 80, 18, 0, M.DARK);
}
function pleasureBoat(x0, z0, roof) {
  begin('Pleasure boat', 'boat', true);
  const P = plotter(x0, z0, true);
  hull(P, 38, 4, 3, M.TRUNK, M.DARK, 9, M.FLOOR);
  for (let i = 6; i <= 27; i++) for (const d of [-3, 2]) for (let y = 4; y <= 8; y++) P(i, y, d, (i - 6) % 4 === 0 || i === 27 ? M.TRUNK : y >= 6 ? M.PL_W : M.WOOD);
  for (let d = -3; d <= 2; d++) for (let y = 4; y <= 8; y++) { P(6, y, d, M.TRUNK); P(27, y, d, d === -1 || d === 0 ? 0 || M.DARK : M.TRUNK); }
  pbox(P, 5, 9, -4, 28, 9, 3, roof); pbox(P, 5, 10, -2, 28, 10, 1, roof); pbox(P, 5, 11, -1, 28, 11, 0, M.ROOF_D);
  for (let i = 6; i <= 27; i += 3) { P(i, 8, -4, M.LIT_R); P(i, 8, 3, M.LIT_R); }
  pbox(P, 32, 4, -1, 32, 9, -1, M.TRUNK); P(32, 9, 0, M.LIT_R);
}

export function tokyoExtras() {
  setSeed(1868);
  // railings along the banks of the river and the bay
  shore(false, RIVER.x0 - 1, 4, BAY.z0 - 2); shore(false, RIVER.x1, 4, WZ - 5);
  shore(true, BAY.z0 - 1, BAY.x0, RIVER.x0 - 1); shore(false, BAY.x0 - 1, BAY.z0, WZ - 5);
  // the river bridges, north to south, then the Rainbow Bridge across the bay on the last street
  const BR = [['Azuma Bridge', M.CAR_A], ['Komagata Bridge', M.TANK], ['Umaya Bridge', M.ROOF_G], ['Kuramae Bridge', M.TAXI], ['Ryogoku Bridge', M.CHROME], ['Eitai Bridge', M.CAR_B]];
  STREET_Z.slice(0, 6).forEach((z, i) => archBridge(z, BR[i][1], BR[i][0]));
  const zr = STREET_Z[6];
  tower(TA, zr, M.TRIM, 'Rainbow Bridge', 74); tower(TB, zr, M.TRIM, 'Rainbow Bridge', 74); cables(zr, 75, 'Rainbow Bridge', M.TRIM);
  for (const x of [712, 780, 846]) { lampPost(x, zr - 15, 18); lampPost(x + 8, zr + 14, 18); }
  // a ship under the cranes and the pleasure boats on the river
  containerShip(702, 857);
  pleasureBoat(806, 270, M.ROOF_G); pleasureBoat(846, 420, M.ROOF_R); pleasureBoat(812, 580, M.ROOF_S); pleasureBoat(850, 700, M.ROOF_G); pleasureBoat(760, 960, M.ROOF_R);
}

// ---- the painted ground ---------------------------------------------------------------------------------------------
// before the lot pads: Tokyo stands on pavement, not grass
export function tokyoBase(g, GK, rect, speckle) {
  g.fillStyle = '#bdbab1'; rect(0, 0, WX, WZ);
  speckle(0, 0, WX, WZ, 520000, ['rgba(255,250,240,0.2)', 'rgba(90,88,80,0.14)', 'rgba(160,156,146,0.25)']);
}
// after the lot pads and before the streets, so a bridge is simply a street that crosses the water
export function tokyoGround(g, GK, rect, speckle) {
  const E = (x, z, rx, rz) => { g.beginPath(); g.ellipse(x * GK, z * GK, rx * GK, rz * GK, 0, 0, Math.PI * 2); };
  let s = 1868; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const WATER = '#4e8fa6', SHADE = 'rgba(22,58,78,0.42)', GRASS = ['rgba(92,146,74,0.5)', 'rgba(146,192,108,0.45)', 'rgba(170,190,110,0.25)'], GRIT = ['rgba(255,250,235,0.25)', 'rgba(120,108,84,0.18)'];
  // the palace: gravel, the moat, the stone foot of the ramparts, lawn, and the gravel court in front of the keep
  {
    const P = PALACE_AT, S = PALACE.S, [m0, m1] = PALACE.MOAT;
    g.fillStyle = '#d6d0be'; rect(P.x, P.z, P.x + S, P.z + S); speckle(P.x, P.z, P.x + S, P.z + S, 9000, GRIT);
    g.fillStyle = SHADE; rect(P.x + m0 - 1.5, P.z + m0 - 1.5, P.x + S - m0 + 1.5, P.z + S - m0 + 1.5);
    g.fillStyle = WATER; rect(P.x + m0, P.z + m0, P.x + S - m0, P.z + S - m0);
    for (let i = 0; i < 2600; i++) { const x = P.x + m0 + Math.floor(r() * (S - 2 * m0 - 6)), z = P.z + m0 + Math.floor(r() * (S - 2 * m0)); g.fillStyle = r() < 0.5 ? 'rgba(190,232,240,0.28)' : 'rgba(24,70,96,0.22)'; rect(x, z, x + 2 + Math.floor(r() * 5), z + 1); }
    g.fillStyle = '#a79f90'; rect(P.x + m1 + 1, P.z + m1 + 1, P.x + S - m1 - 1, P.z + S - m1 - 1);
    g.fillStyle = '#74a65e'; rect(P.x + 27, P.z + 27, P.x + S - 27, P.z + S - 27); speckle(P.x + 27, P.z + 27, P.x + S - 27, P.z + S - 27, 9000, GRASS);
    g.fillStyle = '#d9d2bd'; rect(P.x + 28, P.z + 38, P.x + 80, P.z + 94); rect(P.x + 76, P.z + 59, P.x + S - 27, P.z + 73);
    speckle(P.x + 28, P.z + 38, P.x + 80, P.z + 94, 2500, GRIT);
  }
  // the station: the forecourt, then ballast and rails under the platforms (the lot faces west, so its depth runs east)
  {
    const P = STATION_AT, S = STATION.S;
    g.fillStyle = '#c9c4b6'; rect(P.x, P.z, P.x + S, P.z + S); speckle(P.x, P.z, P.x + S, P.z + S, 7000, GRIT);
    g.fillStyle = '#857f76'; rect(P.x + 41, P.z + 2, P.x + S - 2, P.z + S - 2); speckle(P.x + 41, P.z + 2, P.x + S - 2, P.z + S - 2, 16000, ['rgba(60,54,48,0.3)', 'rgba(190,180,164,0.25)']);
    for (const b of [60, 80, 100]) {
      g.fillStyle = 'rgba(70,52,36,0.55)'; for (let z = P.z + 3; z < P.z + S - 3; z += 3) rect(P.x + b - 4, z, P.x + b + 4, z + 1);
      g.fillStyle = '#c9ccd2'; rect(P.x + b - 3, P.z + 2, P.x + b - 2.5, P.z + S - 2); rect(P.x + b + 2.5, P.z + 2, P.x + b + 3, P.z + S - 2);
    }
  }
  // the temple precinct, the tower's plaza and the wheel's
  g.fillStyle = '#d4cdb9'; rect(SENSO_AT.x, SENSO_AT.z, SENSO_AT.x + 86, SENSO_AT.z + 86); speckle(SENSO_AT.x, SENSO_AT.z, SENSO_AT.x + 86, SENSO_AT.z + 86, 5000, GRIT);
  g.fillStyle = '#e4ddc9'; rect(SENSO_AT.x + 36, SENSO_AT.z + 36, SENSO_AT.x + 50, SENSO_AT.z + 86);
  g.fillStyle = 'rgba(120,108,84,0.3)'; for (let z = SENSO_AT.z + 38; z < SENSO_AT.z + 86; z += 4) rect(SENSO_AT.x + 36, z, SENSO_AT.x + 50, z + 0.25);
  g.fillStyle = '#cdc7b9'; rect(SHIBA_AT.x, SHIBA_AT.z, SHIBA_AT.x + 86, SHIBA_AT.z + 86); speckle(SHIBA_AT.x, SHIBA_AT.z, SHIBA_AT.x + 86, SHIBA_AT.z + 86, 5000, GRIT);
  g.fillStyle = '#7fae66'; for (const [a, b] of [[2, 2], [70, 2], [2, 70], [70, 70]]) rect(SHIBA_AT.x + a, SHIBA_AT.z + b, SHIBA_AT.x + a + 14, SHIBA_AT.z + b + 14);
  g.fillStyle = '#d2c8b0'; rect(WHEEL_AT.x, WHEEL_AT.z, WHEEL_AT.x + 86, WHEEL_AT.z + 86); speckle(WHEEL_AT.x, WHEEL_AT.z, WHEEL_AT.x + 86, WHEEL_AT.z + 86, 5000, GRIT);
  g.fillStyle = '#7fae66'; rect(WHEEL_AT.x + 2, WHEEL_AT.z + 2, WHEEL_AT.x + 30, WHEEL_AT.z + 14); rect(WHEEL_AT.x + 2, WHEEL_AT.z + 72, WHEEL_AT.x + 30, WHEEL_AT.z + 84);
  // Build 2: the plaza of the twin towers, the studio's lot (it runs 86 down the avenue) and the expo's forecourt
  g.fillStyle = '#c9c6bd'; rect(METRO_AT.x, METRO_AT.z, METRO_AT.x + 86, METRO_AT.z + 86); speckle(METRO_AT.x, METRO_AT.z, METRO_AT.x + 86, METRO_AT.z + 86, 5000, GRIT);
  g.fillStyle = '#b4b0a6'; for (let z = METRO_AT.z + 4; z < METRO_AT.z + 86; z += 8) rect(METRO_AT.x + 70, z, METRO_AT.x + 86, z + 0.3);
  g.fillStyle = '#c2c6cc'; rect(STUDIO_AT.x, STUDIO_AT.z, STUDIO_AT.x + 40, STUDIO_AT.z + 86); speckle(STUDIO_AT.x, STUDIO_AT.z, STUDIO_AT.x + 40, STUDIO_AT.z + 86, 3000, GRIT);
  g.fillStyle = '#cfcabd'; rect(EXPO_AT.x, EXPO_AT.z, EXPO_AT.x + 60, EXPO_AT.z + 86); speckle(EXPO_AT.x, EXPO_AT.z, EXPO_AT.x + 60, EXPO_AT.z + 86, 4000, GRIT);
  g.fillStyle = '#7fae66'; rect(EXPO_AT.x + 4, EXPO_AT.z + 64, EXPO_AT.x + 56, EXPO_AT.z + 82);
  // the pond in the garden at Ueno
  g.fillStyle = SHADE; E(POND_AT.x + 20, POND_AT.z + 20, 15, 11.5); g.fill(); g.fillStyle = '#5f9fae'; E(POND_AT.x + 20, POND_AT.z + 20, 13.5, 10); g.fill();
  // the water: the Sumida and the bay
  g.fillStyle = WATER; rect(RIVER.x0, 0, RIVER.x1, WZ); rect(BAY.x0, BAY.z0, RIVER.x1, WZ);
  g.fillStyle = SHADE; rect(RIVER.x0, 0, RIVER.x0 + 3, BAY.z0); rect(RIVER.x1 - 3, 0, RIVER.x1, WZ); rect(BAY.x0, BAY.z0, RIVER.x0 + 3, BAY.z0 + 3); rect(BAY.x0, BAY.z0, BAY.x0 + 3, WZ);
  for (let i = 0; i < 20000; i++) { const x = BAY.x0 + Math.floor(r() * (RIVER.x1 - BAY.x0)), z = Math.floor(r() * WZ), w = 2 + Math.floor(r() * 7); if (!wet(x, z) || !wet(x + w, z)) continue; g.fillStyle = r() < 0.5 ? 'rgba(190,232,240,0.28)' : 'rgba(24,70,96,0.22)'; rect(x, z, x + w, z + 1); }
}
// after the streets: the scramble crossing, striped from corner to corner as well as side to side
export function tokyoOver(g, GK, rect) {
  const { x, z } = SCRAMBLE, H = 12;
  g.save(); g.strokeStyle = '#ece8dc'; g.lineWidth = 5 * GK; g.setLineDash([1.5 * GK, 1.5 * GK]);
  g.beginPath(); g.moveTo((x - H + 1) * GK, (z - H + 1) * GK); g.lineTo((x + H - 1) * GK, (z + H - 1) * GK); g.moveTo((x + H - 1) * GK, (z - H + 1) * GK); g.lineTo((x - H + 1) * GK, (z + H - 1) * GK); g.stroke(); g.restore();
}
