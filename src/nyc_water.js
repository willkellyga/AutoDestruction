// New York's water and what stands in and over it: the railings along the shores, the five East River bridges (the
// Brooklyn Bridge with its stone towers first among them), the small bridges over the Harlem River, the ships at the
// Hudson piers, the ferry, and the painted ground: rivers, bay, the big park, the ballpark's field and Liberty Island.
// The map is flat, so the water is paint, a bridge's deck is the street itself, and monsters wade.
import { M, WX, WZ, STREET_X, STREET_Z, SHUT, shut, set, box, walls, begin, setSeed, rnd, ri, vehicle } from './world.js';
import { tree, lampPost, bench, bollards, disc } from './kit.js';
import { HARLEM, HUDSON, EAST, BAY, SOUTH, LIB, PARK, BALL, wet } from './nyc.js';
import { BALLPARK, fieldAt } from './nyc_landmarks.js';

// A length of iron railing along x (z0 === z1) or along z.
function rail(x0, z0, x1, z1) {
  begin('Harbor rail', 'prop', true);
  const n = Math.max(x1 - x0, z1 - z0);
  for (let k = 0; k <= n; k++) { const x = z0 === z1 ? x0 + k : x0, z = z0 === z1 ? z0 : z0 + k; set(x, 3, z, M.DARK); if (k % 4 === 0 || k === n) box(x, 0, z, x, 2, z, M.DARK); }
}
// railings along a shore from a to b at `at`, in lengths, leaving a gap wherever a street comes through
function shore(alongX, at, a, b) {
  const cross = alongX ? STREET_X : STREET_Z;
  for (let t = a; t < b; t += 26) { const tb = Math.min(t + 23, b); if (cross.some((s) => s > t - 22 && s < tb + 22)) continue; if (alongX) rail(t, at, tb, at); else rail(at, t, at, tb); }
}

// ---- bridges over the East River: the deck is the street; the towers stand either side of it ------------------------
const TA = 796, TB = 849;   // where the two towers of a bridge stand (each is 8 long)
// The Brooklyn Bridge's tower: granite, two pointed arches over the roadway, a cornice under the top.
// The road passes under at ground level, so the pier between the arches starts above the traffic.
function stoneTower(xa, zc, title) {
  begin(title, 'landmark');
  for (let x = xa; x <= xa + 7; x++) for (let dz = -24; dz <= 24; dz++) {
    const a = Math.abs(dz), leg = a >= 19, k = Math.abs(a - 9.5);
    for (let y = 0; y <= 72; y++) {
      if (!leg) { if (y < 24) continue; if (k <= 6.5 && y <= 42 + (6.5 - k) * 2.4) continue; }
      set(x, y, zc + dz, (y >= 56 && y <= 58) || y >= 70 ? M.TRIM : ((y >> 2) * 3 + (x >> 1) + dz * 5) % 7 === 0 ? M.STONE : M.GRANITE);
    }
  }
  for (const s of [-25, 19]) box(xa - 2, 0, zc + s, xa + 9, 4, zc + s + 6, M.STONE);
}
// A steel tower: two legs, three cross beams and X bracing between them.
function steelTower(xa, zc, m, title) {
  begin(title, 'monument');
  for (const z0 of [zc - 23, zc + 20]) { box(xa + 2, 0, z0, xa + 5, 66, z0 + 3, m); box(xa + 1, 0, z0 - 1, xa + 6, 5, z0 + 4, M.GRANITE); }
  for (const [ya, yb] of [[26, 28], [44, 46], [61, 66]]) box(xa + 3, ya, zc - 19, xa + 4, yb, zc + 19, m);
  for (const [ya, yb] of [[29, 43], [47, 60]]) for (let dz = -19; dz <= 19; dz++) { const t = (dz + 19) / 38; for (const y of [Math.round(ya + (yb - ya) * t), Math.round(yb - (yb - ya) * t)]) { set(xa + 3, y, zc + dz, m); set(xa + 3, Math.min(yb, y + 1), zc + dz, m); } }
}
// The cables down one side: from an anchor on each bank up over both towers, sagging between them, with a hanger down
// to the deck every four voxels. T is the height of the tower tops.
function cables(zc, T, title, m) {
  const X0 = EAST.x0 + 2, X1 = EAST.x1 - 3, mid = (TA + TB + 7) / 2, half = (TB - TA) / 2 - 4;
  const sag = (x) => (x < TA ? 3 + (T - 3) * ((x - X0) / (TA - 1 - X0)) ** 1.5 : x > TB + 7 ? 3 + (T - 3) * ((X1 - x) / (X1 - TB - 8)) ** 1.5 : 16 + (T - 16) * Math.min(1, ((x - mid) / half) ** 2));
  for (const z of [zc - 21, zc + 21]) {
    begin(title + ' cables', 'monument', true);
    box(X0 - 2, 0, z - 1, X0 + 1, 4, z + 1, M.GRANITE); box(X1 - 1, 0, z - 1, X1 + 2, 4, z + 1, M.GRANITE);
    let py = 3;
    for (let x = X0; x <= X1; x++) {
      const tower = (x >= TA && x <= TA + 7) || (x >= TB && x <= TB + 7), edge = x === TA - 1 || x === TA + 8 || x === TB - 1 || x === TB + 8;
      const y = tower || edge ? T : Math.max(3, Math.min(T, Math.round(sag(x))));
      if (tower) set(x, T, z, m);
      else { for (let yy = Math.min(py, y); yy <= Math.max(py, y); yy++) set(x, yy, z, m); if (x % 4 === 0 || x === X0 || x === X1) box(x, 0, z, x, Math.min(py, y), z, m); }
      py = y;
    }
  }
}
// rails and lamps along the deck of an East River bridge, clear of its towers
function deck(zc) {
  for (const z of [zc - 19, zc + 19]) for (const [a, b] of [[EAST.x0, TA - 4], [TA + 11, TB - 4], [TB + 11, EAST.x1 - 1]]) rail(a, z, b, z);
  for (const x of [780, 822, 866]) { lampPost(x, zc - 15, 18); lampPost(x + 8, zc + 14, 18); }
}
// A steel truss bridge: a humped frame down each side with a portal over the road at each peak.
function trussBridge(zc, m, title) {
  const X0 = EAST.x0, X1 = EAST.x1 - 1, P = [[X0, 14], [796, 46], [826, 22], [856, 46], [X1, 14]];
  const top = (x) => { for (let i = 0; i < 4; i++) if (x <= P[i + 1][0]) return Math.round(P[i][1] + (P[i + 1][1] - P[i][1]) * (x - P[i][0]) / (P[i + 1][0] - P[i][0])); return 14; };
  [zc - 20, zc + 20].forEach((z, side) => {
    begin(title, 'monument');
    let py = top(X0);
    for (let x = X0; x <= X1; x++) {
      const y = top(x), post = (x - X0) % 6 === 0 || x === X1;
      for (let yy = Math.min(py, y); yy <= Math.max(py, y); yy++) set(x, yy, z, m);
      set(x, 4, z, m); set(x, 0, z, m);
      if (post) box(x, 0, z, x, y, z, m);
      else { const k = (x - X0) % 6, yb = top(Math.min(X1, x - k + 6)), d0 = Math.round(4 + (yb - 4) * (k - 1) / 6), d1 = Math.round(4 + (yb - 4) * k / 6); for (let yy = d0; yy <= d1; yy++) set(x, yy, z, m); }
      py = y;
    }
    if (side === 0) for (const x of [796, 856]) { box(x, 44, zc - 19, x, 46, zc + 19, m); box(x, 36, zc - 19, x, 37, zc + 19, m); for (let dz = -19; dz <= 19; dz += 6) box(x, 38, zc + dz, x, 43, zc + dz, m); }
    for (const x of [796, 856]) box(x - 2, 0, z - 2, x + 2, 3, z + 2, M.GRANITE);
  });
}
// A small steel arch bridge over the Harlem River: an arch down each side with hangers to the deck.
function archBridge(xc, m) {
  for (const x of [xc - 20, xc + 20]) {
    begin('Harlem River bridge', 'prop', true);
    let py = 3;
    for (let z = HARLEM.z0; z < HARLEM.z1; z++) {
      const y = Math.round(3 + 15 * Math.sin(Math.PI * (z - HARLEM.z0) / (HARLEM.z1 - HARLEM.z0 - 1)));
      for (let yy = Math.min(py, y); yy <= Math.max(py, y); yy++) set(x, yy, z, m);
      set(x, 3, z, m); if ((z - HARLEM.z0) % 4 === 0 || z === HARLEM.z1 - 1) box(x, 0, z, x, y, z, m);
      py = y;
    }
  }
  lampPost(xc - 15, HARLEM.z0 + 12, 18); lampPost(xc + 14, HARLEM.z0 + 34, 18);
}

// ---- ships, boats and the docks: the models in civilian/src, stood by src/civilians.js. A boat is given by its middle
// and the way its bow points. The liner and the carrier are 46 m long, twice the gap between two Hudson piers, so each
// lies along the shore across the line of a street, and that street stops at a short pier with a crane (world.SHUT). ----
const boat = (kind, x, z, fx, fz, opts, more) => vehicle(kind, x, z, fx, fz, { opts, ...more });
function docks() {
  // the two great ships, each with the low side away from her pier
  boat('liner', 36, 494, 0, -1, { type: 'liner', paint: 'red' }, { low: 1 });
  boat('carrier', 29, 738, 0, 1, { type: 'carrier' }, { low: -1 });
  // their short piers: a crane working the ship, and cargo waiting on the planks
  for (const [z, paint, load, stacks] of [[494, 'green', 'crate', ['crates', 'sacks', 'drums']], [738, 'grey', 'drums', ['boxes', 'drums', 'crates']]]) {
    vehicle('crane', 76, z + 1, -1, 0, { opts: { paint, load } });
    vehicle('cargo', 59, z - 11, 1, 0, { opts: { type: stacks[0] } }); vehicle('cargo', 60, z + 11, 0, 1, { opts: { type: stacks[1] } }); vehicle('cargo', 90, z - 12, 1, 0, { opts: { type: stacks[2] } });
  }
  // the three long piers the streets still run out on: cargo down both edges, clear of the roadway
  const LOADS = ['boxes', 'crates', 'drums', 'sacks', 'crates', 'boxes'];
  [372, 616, 860].forEach((z, n) => { for (let k = 0; k < 6; k++) { const type = LOADS[(k + n * 2) % 6]; vehicle('cargo', 16 + k * 14 + (k & 1) * 3, z + (k & 1 ? 12.5 : -12.5), type === 'boxes' ? 1 : 0, type === 'boxes' ? 0 : 1, { opts: { type } }); } });
  // the upper Hudson: a timber jetty out from the shore, a tug on one side of it and a barge on the other
  vehicle('jetty', 80, 308, -1, 0, { opts: { type: 'span' }, y: -2.5 }); vehicle('jetty', 48, 308, -1, 0, { opts: { type: 'end', light: 'green' }, y: -2.5 });
  boat('tug', 58, 290, 1, 0, { type: 'tug', paint: 'red' }, { low: -1 }); boat('barge', 56, 330, 1, 0, { type: 'barge', load: 'coal', house: true, paint: 'blue' }, { low: 1 });
  // the harbor along the tip: the ferry in her slip, a tug and a barge
  boat('ferry', 523, 1006, 1, 0, { type: 'ferry', paint: 'orange' }); boat('tug', 340, 1006, 1, 0, { type: 'tug', paint: 'green' }); boat('barge', 674, 1007, 1, 0, { type: 'barge', load: 'containers' });
  // the East River, between the bridges
  boat('tug', 800, 433, 0, -1, { type: 'tug', paint: 'blue' }); boat('barge', 850, 555, 0, 1, { type: 'barge', load: 'sand', house: true, paint: 'green' });
  boat('tug', 806, 677, 0, -1, { type: 'tug', paint: 'yellow' }); boat('barge', 848, 799, 0, 1, { type: 'barge', load: 'crates' }); boat('tug', 836, 945, 0, 1, { type: 'tug', paint: 'red' });
  // the bay: a jetty off the Battery with a tug alongside, and a barge under the east shore
  for (const [k, type] of [[0, 'span'], [1, 'span'], [2, 'end']]) vehicle('jetty', 180, BAY.z + 16 + k * 32, 0, 1, { opts: { type, light: 'red' }, y: -2.5 });
  boat('tug', 198, 934, 0, -1, { type: 'tug', paint: 'blue' }, { low: -1 }); boat('barge', 226, 946, 0, 1, { type: 'barge', load: 'containers' }, { low: 1 });
}

export function nycExtras() {
  setSeed(1626);
  // railings along every shore
  shore(true, HARLEM.z0 - 1, 4, WX - 5); shore(true, HARLEM.z1, HUDSON, EAST.x0 - 1); shore(true, HARLEM.z1, EAST.x1, WX - 5);
  shore(false, HUDSON, HARLEM.z1 + 2, BAY.z - 2); shore(true, BAY.z - 1, HUDSON, BAY.x - 1); shore(false, BAY.x, BAY.z, SOUTH - 2);
  shore(true, SOUTH - 1, BAY.x, EAST.x0 - 1); shore(false, EAST.x0 - 1, HARLEM.z1 + 2, SOUTH - 2); shore(false, EAST.x1, HARLEM.z1 + 2, WZ - 5);
  // the East River bridges, north to south; the last is the Brooklyn Bridge
  const BR = [['Uptown bridge', M.ROOF_G], ['Queensboro Bridge', M.BRICK2], ['Williamsburg Bridge', M.STEEL], ['Manhattan Bridge', M.TANK], ['Brooklyn Bridge', 0]];
  STREET_Z.slice(1).forEach((z, i) => {
    const [title, m] = BR[i];
    if (i === 1) trussBridge(z, m, title);
    else if (m) { steelTower(TA, z, m, title); steelTower(TB, z, m, title); cables(z, 67, title, m); }
    else { stoneTower(TA, z, title); stoneTower(TB, z, title); cables(z, 73, title, M.DARK); }
    deck(z);
  });
  STREET_X.forEach((x, i) => archBridge(x, [M.ROOF_G, M.STEEL, M.TANK, M.BRICK2, M.STEEL][i]));
  // the Hudson piers: bollards down each side and a lamp at the end. The two the big ships lie across are short.
  for (const z of STREET_Z.slice(1)) {
    const x0 = shut(10, z) ? 58 : 10;
    for (const s of [-17, 16]) bollards(x0, z + s, Math.floor((90 - x0) / 8) + 1, 8);
    if (x0 === 10) lampPost(6, z - 14, 18); lampPost(x0 === 10 ? 50 : 56, z + 13, 18);
  }
  docks();
  // the landing on Liberty Island
  for (const s of [-5, 4]) for (const b of [-13, -7]) bollards(LIB.x + s, LIB.z - LIB.r + b, 1);
}

// ---- the painted ground ---------------------------------------------------------------------------------------------
// before the lot pads: New York stands on pavement, not grass
export function nycBase(g, GK, rect, speckle) {
  g.fillStyle = '#bfbbb0'; rect(0, 0, WX, WZ);
  speckle(0, 0, WX, WZ, 520000, ['rgba(255,250,240,0.2)', 'rgba(90,88,80,0.14)', 'rgba(160,156,146,0.25)']);
}
// after the lot pads and before the streets, so a bridge is simply a street that crosses the water
export function nycGround(g, GK, rect, speckle) {
  const E = (x, z, rx, rz) => { g.beginPath(); g.ellipse(x * GK, z * GK, rx * GK, rz * GK, 0, 0, Math.PI * 2); };
  let s = 1626; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  // the big park: grass, lawns, a loop of path, the pond and the fountain terrace
  const pw = PARK.x1 - PARK.x0, pmx = (PARK.x0 + PARK.x1) / 2;
  g.fillStyle = '#74a65e'; rect(PARK.x0, PARK.z0, PARK.x1, PARK.z1);
  speckle(PARK.x0, PARK.z0, PARK.x1, PARK.z1, 30000, ['rgba(92,146,74,0.5)', 'rgba(146,192,108,0.45)', 'rgba(170,190,110,0.25)']);
  g.fillStyle = '#86b86c'; E(pmx, 414, 46, 17); g.fill(); E(pmx, 572, 42, 16); g.fill();
  g.strokeStyle = '#d8cfb6'; g.lineWidth = 2.6 * GK; E(pmx, 448, pw / 2 - 9, 50); g.stroke(); E(pmx, 552, pw / 2 - 9, 40); g.stroke();
  g.lineWidth = 2 * GK; g.beginPath(); g.moveTo(pmx * GK, (PARK.z0 + 2) * GK); g.lineTo(pmx * GK, 440 * GK); g.moveTo(pmx * GK, 546 * GK); g.lineTo(pmx * GK, (PARK.z1 - 2) * GK); g.stroke();
  g.fillStyle = '#d8cfb6'; E(pmx, 456, 16, 16); g.fill();
  g.fillStyle = 'rgba(30,70,84,0.4)'; E(pmx, 532, 15, 12.5); g.fill(); g.fillStyle = '#5f9fae'; E(pmx, 532, 13.5, 11); g.fill();
  // the Battery: a green along the bay
  g.fillStyle = '#74a65e'; rect(HUDSON + 6, 800, BAY.x + 3, 842); speckle(HUDSON + 6, 800, BAY.x + 3, 842, 5000, ['rgba(92,146,74,0.5)', 'rgba(146,192,108,0.45)']);
  g.fillStyle = '#d8cfb6'; rect(HUDSON + 6, 836, BAY.x + 3, 842);
  // the ballpark's field. The lot faces south, so its front is its high-z side.
  {
    const S = BALLPARK.S, HA = BALLPARK.HA, HB = BALLPARK.HB, R = BALLPARK.R;
    g.fillStyle = '#b3aea2'; rect(BALL.x, BALL.z, BALL.x + S, BALL.z + S);
    for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) {
      if (!fieldAt(a + 0.5, b + 0.5)) continue;
      const da = a + 0.5 - HA, db = b + 0.5 - HB, rho = Math.hypot(da, db), line = Math.abs(Math.abs(da) - db), fence = R + 12 * Math.cos(2 * Math.atan2(da, db));
      let c = (((a + b) >> 3) ^ ((a - b + 256) >> 3)) & 1 ? '#5fa653' : '#6bb35c';
      if (rho > fence - 4 || rho < 6 || (rho > 26 && rho < 39 && line > 1) || (line < 2.2 && rho < 38) || Math.hypot(da, db - 18.4) < 3.6) c = '#b98a5c';
      if (rho >= 9 && line < 0.7 && db > 0) c = '#f4f0e4';
      if ((Math.abs(Math.abs(da) - 18.4) < 1.2 && Math.abs(db - 18.4) < 1.2) || (Math.abs(da) < 1.2 && Math.abs(db - 36.8) < 1.2) || rho < 1.4) c = '#ffffff';
      g.fillStyle = c; rect(BALL.x + S - a - 1, BALL.z + S - b - 1, BALL.x + S - a, BALL.z + S - b);
    }
  }
  // the water: the Harlem River, the Hudson, the East River, the bay and the harbor along the tip
  g.fillStyle = '#4e8fa6';
  rect(0, HARLEM.z0, WX, HARLEM.z1); rect(0, HARLEM.z1, HUDSON, WZ); rect(EAST.x0, HARLEM.z1, EAST.x1, WZ); rect(0, BAY.z, BAY.x, WZ); rect(0, SOUTH, EAST.x1, WZ);
  g.fillStyle = 'rgba(22,58,78,0.42)';
  rect(0, HARLEM.z0, WX, HARLEM.z0 + 3); rect(HUDSON, HARLEM.z1 - 3, EAST.x0, HARLEM.z1); rect(EAST.x1, HARLEM.z1 - 3, WX, HARLEM.z1);
  rect(HUDSON - 3, HARLEM.z1, HUDSON, BAY.z); rect(HUDSON, BAY.z, BAY.x, BAY.z + 3); rect(BAY.x - 3, BAY.z, BAY.x, SOUTH); rect(BAY.x, SOUTH, EAST.x0, SOUTH + 3);
  rect(EAST.x0, HARLEM.z1, EAST.x0 + 3, SOUTH); rect(EAST.x1 - 3, HARLEM.z1, EAST.x1, WZ);
  for (let i = 0; i < 26000; i++) { const x = Math.floor(r() * WX), z = Math.floor(HARLEM.z0 + r() * (WZ - HARLEM.z0)), w = 2 + Math.floor(r() * 7); if (!wet(x, z) || !wet(x + w, z)) continue; g.fillStyle = r() < 0.5 ? 'rgba(190,232,240,0.28)' : 'rgba(24,70,96,0.22)'; rect(x, z, x + w, z + 1); }
  // Liberty Island: a sea wall, lawn, the paved star round the fort and the landing
  g.fillStyle = 'rgba(22,58,78,0.42)'; E(LIB.x, LIB.z, LIB.r + 3, LIB.r + 3); g.fill();
  g.fillStyle = '#c9c2b0'; E(LIB.x, LIB.z, LIB.r, LIB.r); g.fill();
  g.fillStyle = '#74a65e'; E(LIB.x, LIB.z, LIB.r - 3, LIB.r - 3); g.fill();
  g.fillStyle = '#d8cfb6'; E(LIB.x, LIB.z, 36, 36); g.fill(); rect(LIB.x - 5, LIB.z - LIB.r - 14, LIB.x + 5, LIB.z - 30);
  speckle(LIB.x - 30, LIB.z - 30, LIB.x + 30, LIB.z + 30, 3000, ['rgba(255,250,235,0.25)', 'rgba(120,108,84,0.18)']);
}
// after the streets: where a street runs out over the Hudson or the harbor it is a timber pier
export function nycOver(g, GK, rect) {
  const planks = (xa, za, xb, zb, alongX) => {
    g.fillStyle = '#9a8262'; rect(xa, za, xb, zb);
    g.fillStyle = 'rgba(58,40,22,0.32)';
    if (alongX) for (let x = xa; x < xb; x += 2) rect(x, za, x + 0.25, zb); else for (let z = za; z < zb; z += 2) rect(xa, z, xb, z + 0.25);
    g.fillStyle = 'rgba(40,28,16,0.5)'; if (alongX) { rect(xa, za, xb, za + 0.6); rect(xa, zb - 0.6, xb, zb); } else { rect(xa, za, xa + 0.6, zb); rect(xb - 0.6, za, xb, zb); }
  };
  for (const z of STREET_Z.slice(1)) planks(shut(10, z) ? 52 : 0, z - 18, HUDSON - 1, z + 18, true);
  // where the liner and the carrier lie, the street stops at a short pier: beyond it is open water again
  for (const [x0, z0, x1, z1] of SHUT) {
    g.fillStyle = '#4e8fa6'; rect(x0, z0 - 2, x1, z1 + 2);
    let s = 77 + z0; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
    for (let i = 0; i < 90; i++) { const x = Math.floor(x0 + r() * (x1 - x0 - 8)), z = Math.floor(z0 - 2 + r() * (z1 - z0 + 4)), w = 2 + Math.floor(r() * 6); g.fillStyle = r() < 0.5 ? 'rgba(190,232,240,0.28)' : 'rgba(24,70,96,0.22)'; rect(x, z, x + w, z + 1); }
    g.fillStyle = 'rgba(22,58,78,0.42)'; rect(x1 - 2, z0 - 2, x1, z1 + 2);
  }
  for (const x of STREET_X) if (x < EAST.x0) planks(x - 18, SOUTH + 1, x + 18, WZ, false);
}
