// Washington's water and what stands in and over it: the bridges (every street that crosses water is one), the boats,
// the elms of the Mall and the cherry trees round the Tidal Basin; and the painted ground: the Potomac and the far
// bank, the basin, the two pools, the lawns and gravel walks of the Mall, the drives of the White House.
// The map is flat, so the water is paint, a bridge's deck is the street itself, and monsters wade.
import { M, WX, WZ, STREET_X, STREET_Z, set, box, begin, setSeed, ri, rnd, vehicle } from './world.js';
import { tree, lampPost, bench } from './kit.js';
import { sakura } from './tokyo_kit.js';
import { rider, elm } from './dc_kit.js';
import { POOL, CPOOL, BASIN, ISLE, RIVER_W, AXIS, bankE, river, basin, virginia, isle, wet, LINCOLN_AT, MONUMENT_AT, WHITEHOUSE_AT, ELLIPSE_AT, CAPITOL_AT, JEFFERSON_AT, PENTAGON_AT, UNION_AT } from './dc.js';

const onStreet = (x, z, d = 22) => STREET_X.some((s) => Math.abs(x - s) < d) || STREET_Z.some((s) => Math.abs(z - s) < d);
// A bridge: a stone balustrade down each side of the street with a pier every so often, and lamps. `alongX` is a street
// that runs east and west (at z = c, from x = t0 to t1); otherwise one that runs north and south.
function bridge(alongX, c, t0, t1, title, m = M.MARBLE) {
  const P = (t, y, s, mm) => (alongX ? set(t, y, s, mm) : set(s, y, t, mm));
  for (const s of [c - 20, c + 20]) {
    begin(title, 'monument');
    for (let t = t0; t <= t1; t++) { P(t, 3, s, m); P(t, 0, s, M.GRANITE); if ((t - t0) % 3 === 0 || t === t1) { P(t, 1, s, m); P(t, 2, s, m); } }
    for (let t = t0; t <= t1 - 3; t += Math.max(14, Math.round((t1 - t0 - 3) / Math.max(1, Math.round((t1 - t0) / 26))))) for (let q = t; q <= t + 3; q++) for (const e of [-1, 0, 1]) for (let y = 0; y <= 5; y++) P(q, y, s + e, M.GRANITE);
  }
  for (let t = t0 + 10; t < t1 - 8; t += 40) { if (alongX) { lampPost(t, c - 15, 18); lampPost(t + 18, c + 14, 18); } else { lampPost(c - 15, t, 18); lampPost(c + 15, t + 18, 18); } }
}
// where a street meets water along its line: [from, to] pairs
function spans(alongX, c) {
  const out = []; let a = -1;
  for (let t = 2; t <= 1022; t++) { const w = t < 1022 && (alongX ? wet(t, c) : wet(c, t)); if (w && a < 0) a = t; if (!w && a >= 0) { if (t - a > 8) out.push([a, t - 1]); a = -1; } }
  return out;
}
const boat = (kind, x, z, fx, fz, opts, more) => vehicle(kind, x, z, fx, fz, { opts, ...more });

export function dcExtras() {
  setSeed(1791);
  // the bridges
  const NZ = ['Key Bridge', 'Roosevelt Bridge', 'River Bridge', 'Memorial Bridge', 'Long Bridge'], NX = ['Memorial Bridge', 'Basin Bridge'];
  STREET_Z.forEach((z, i) => spans(true, z).forEach(([a, b]) => bridge(true, z, a, b, NZ[i])));
  STREET_X.forEach((x, i) => spans(false, x).forEach(([a, b]) => bridge(false, x, a, b, NX[i] || 'Bridge')));
  // the elms: two rows down each side of the Reflecting Pool, and a row down each side of the Mall's grass
  for (let x = POOL.x0 + 4; x <= POOL.x1 + 40; x += 16) for (const z of [AXIS - 46, AXIS - 31, AXIS + 31, AXIS + 46]) elm(x + ri(-1, 1) + (Math.abs(z - AXIS) > 40 ? 8 : 0), z, ri(9, 11), ri(7, 8));
  for (let x = 590; x <= 712; x += 16) for (const z of [AXIS - 24, AXIS + 24]) elm(x, z, ri(9, 11), ri(7, 8));
  for (const [x, z] of [[466, 480], [538, 482], [466, 688], [538, 686], [470, 540], [534, 628], [470, 630], [534, 538], [205, 478], [300, 690], [240, 686], [360, 480], [150, 690], [130, 500]]) elm(x, z, ri(9, 11), ri(7, 9));
  for (const [x, z] of [[210, 583], [392, 548], [392, 618]]) bench(x - (x === 210 ? 16 : 0), z);
  rider(717, AXIS, 'Mall statue');
  // the cherry trees: all the way round the Tidal Basin, and along the river bank beside it
  let last = null;
  for (let i = 0; i < 720; i++) {
    const an = i * Math.PI / 360, c = Math.cos(an), s = Math.sin(an), k = 2 / 3;
    const x = Math.round(BASIN.x + (BASIN.rx + 6) * Math.sign(c) * Math.pow(Math.abs(c), k)), z = Math.round(BASIN.z + (BASIN.rz + 6) * Math.sign(s) * Math.pow(Math.abs(s), k));
    if (last && Math.hypot(x - last[0], z - last[1]) < 12) continue;
    if (wet(x, z) || onStreet(x, z, 21) || (x >= JEFFERSON_AT.x - 4 && z > 850)) continue;
    last = [x, z]; sakura(x, z, ri(7, 9), ri(5, 6));
  }
  for (let z = 664; z < 826; z += 13) { const x = Math.round(bankE(z)) + 7; if (!onStreet(x, z, 23) && !basin(x + 6, z)) sakura(x, z, ri(7, 9), ri(5, 6)); }
  // trees on the far bank and on the island
  for (let i = 0, n = 0, got = []; i < 600 && n < 24; i++) {
    const x = ri(10, 240), z = ri(770, 1008);
    if (got.some((p) => Math.hypot(p[0] - x, p[1] - z) < 18)) continue;   // crowns may touch but not swallow each other
    got.push([x, z]);
    if (!virginia(x + 8, z) || onStreet(x, z, 24) || (x < PENTAGON_AT.x + 140 && z > PENTAGON_AT.z - 6 && z < PENTAGON_AT.z + 140) || (x < 52 && z > 772 && z < 824)) continue;
    elm(x, z, ri(8, 11), ri(6, 8)); n++;
  }
  for (const [a, b] of [[-14, -18], [12, -22], [-16, 20], [14, 22], [22, -4]]) if (!onStreet(ISLE.x + a, ISLE.z + b, 21)) elm(ISLE.x + a, ISLE.z + b, ri(8, 10), ri(6, 7));
  for (let z = 30; z < 640; z += 37) if (STREET_Z.every((s) => Math.abs(z - s) > 24) && !(z > LINCOLN_AT.z - 8 && z < LINCOLN_AT.z + 94)) elm(64, z + ri(-4, 4), ri(8, 10), ri(6, 7));
  // boats (the models in civilian/src, stood by src/civilians.js): on the river, and two on the basin
  boat('pleasure', 28, 172, 0, 1, { type: 'pleasure', paint: 'green' }); boat('tour', 27, 342, 0, -1, { type: 'tour' }); boat('pleasure', 29, 580, 0, 1, { type: 'pleasure', paint: 'red' });
  boat('tug', 120, 776, 0.7, 1, { type: 'tug' }); boat('pleasure', 300, 985, 0.6, 1, { type: 'pleasure', paint: 'slate' });
  boat('pleasure', 320, 778, 1, 0, { type: 'pleasure', paint: 'red' }); boat('pleasure', 496, 772, -1, 0, { type: 'pleasure', paint: 'green' });
}

// ---- the painted ground ---------------------------------------------------------------------------------------------
const WATER = '#4b8aa0', DEEP = '#3d7890', SHADE = 'rgba(20,52,70,0.42)', STONE = '#e2ded2', GRAVEL = '#d8ceb4', PAVE = '#c6c2b6', GRASS = '#79aa62', LAWN = '#86b56a';
const BLADES = ['rgba(92,146,74,0.5)', 'rgba(146,192,108,0.45)', 'rgba(170,190,110,0.25)'], GRIT = ['rgba(255,250,235,0.25)', 'rgba(120,108,84,0.18)'];
// a lot-local rectangle (a across, b back from the front) as a world rectangle
function LR(L, a0, b0, a1, b1) {
  const f = L.f, S = L.s || 40;
  const X = (a, b) => (f === 0 ? L.x + a : f === 2 ? L.x + S - a : f === 3 ? L.x + b : L.x + S - b), Z = (a, b) => (f === 0 ? L.z + b : f === 2 ? L.z + S - b : f === 3 ? L.z + S - a : L.z + a);
  const xa = X(a0, b0), xb = X(a1, b1), za = Z(a0, b0), zb = Z(a1, b1);
  return [Math.min(xa, xb), Math.min(za, zb), Math.max(xa, xb), Math.max(za, zb)];
}
// before the lot pads: paving under the city, the river and the far bank, the basin and the pools
export function dcBase(g, GK, rect, speckle) {
  let s = 1791; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const E = (x, z, rx, rz) => { g.beginPath(); g.ellipse(x * GK, z * GK, rx * GK, rz * GK, 0, 0, Math.PI * 2); g.fill(); };
  for (const [xa, za, xb, zb] of [[58, 0, WX, 432], [794, 432, WX, 731], [577, 731, WX, WZ], [327, 852, 577, WZ]]) { g.fillStyle = PAVE; rect(xa, za, xb, zb); speckle(xa, za, xb, zb, Math.round((xb - xa) * (zb - za) / 2.4), ['rgba(255,250,240,0.2)', 'rgba(90,88,80,0.14)', 'rgba(160,156,146,0.25)']); }
  for (const [xa, za, xb, zb] of [[452, 247, 552, 432], [452, 168, 552, 222], [794, 464, 940, 702], [452, 852, 552, 952]]) { g.fillStyle = GRASS; rect(xa, za, xb, zb); speckle(xa, za, xb, zb, Math.round((xb - xa) * (zb - za) / 1.9), BLADES); }
  // the river: everything west of the east bank, then the far bank and the island put back
  const shore = (off, close) => { g.beginPath(); g.moveTo(0, 0); for (let z = 0; z <= WZ; z += 2) g.lineTo(Math.max(0, bankE(z) + off) * GK, z * GK); g.lineTo(0, WZ * GK); g.closePath(); g.fill(); };
  g.fillStyle = '#b9b39f'; shore(2); g.fillStyle = WATER; shore(0);
  g.fillStyle = '#a9a488'; shore(-RIVER_W + 2); g.fillStyle = GRASS; shore(-RIVER_W);
  g.fillStyle = '#a9a488'; E(ISLE.x, ISLE.z, ISLE.rx, ISLE.rz); g.fillStyle = GRASS; E(ISLE.x, ISLE.z, ISLE.rx - 2, ISLE.rz - 2);
  // the basin, inside a sea wall
  const basinPath = (grow) => { g.beginPath(); for (let i = 0; i <= 360; i++) { const an = i * Math.PI / 180, c = Math.cos(an), q = Math.sin(an), x = BASIN.x + (BASIN.rx + grow) * Math.sign(c) * Math.pow(Math.abs(c), 2 / 3), z = BASIN.z + (BASIN.rz + grow) * Math.sign(q) * Math.pow(Math.abs(q), 2 / 3); if (i) g.lineTo(x * GK, z * GK); else g.moveTo(x * GK, z * GK); } g.closePath(); g.fill(); };
  g.fillStyle = STONE; basinPath(2.5); g.fillStyle = WATER; basinPath(0);
  // the pools: still, dark water in a rim of stone
  for (const R of [POOL, CPOOL]) { g.fillStyle = STONE; rect(R.x0 - 2, R.z0 - 2, R.x1 + 2, R.z1 + 2); g.fillStyle = DEEP; rect(R.x0, R.z0, R.x1, R.z1); g.fillStyle = 'rgba(190,226,236,0.16)'; for (let i = 0; i < 60; i++) { const x = R.x0 + r() * (R.x1 - R.x0 - 12), z = R.z0 + 1 + Math.floor(r() * (R.z1 - R.z0 - 2)); rect(x, z, x + 4 + r() * 8, z + 0.5); } }
  // ripples, and grass on the far bank
  for (let i = 0; i < 60000; i++) { const x = Math.floor(r() * 560), z = Math.floor(r() * WZ), w = 2 + Math.floor(r() * 7); if (!(river(x, z) && river(x + w, z)) && !(basin(x - 1, z) && basin(x + w + 1, z))) continue; g.fillStyle = r() < 0.5 ? 'rgba(190,230,236,0.24)' : 'rgba(16,56,76,0.2)'; rect(x, z, x + w, z + 1); }
  for (let i = 0; i < 60000; i++) { const x = Math.floor(r() * 320), z = 740 + Math.floor(r() * 284); if (!virginia(x + 3, z) && !isle(x, z)) continue; g.fillStyle = BLADES[(r() * 3) | 0]; rect(x, z, x + 1, z + 1); }
}
// after the lot pads and before the streets, so a bridge is simply a street that crosses the water
export function dcGround(g, GK, rect, speckle, LOTS) {
  const E = (x, z, rx, rz, w) => { g.beginPath(); g.ellipse(x * GK, z * GK, rx * GK, rz * GK, 0, 0, Math.PI * 2); if (w) { g.lineWidth = w * GK; g.stroke(); } else g.fill(); };
  const fill = (c, xa, za, xb, zb, n = 0, cols = GRIT) => { g.fillStyle = c; rect(xa, za, xb, zb); if (n) speckle(xa, za, xb, zb, n, cols); };
  // the Mall: gravel walks beside the pool and down both sides of the grass, the grass itself mown in stripes
  for (const z of [POOL.z0 - 8, POOL.z1 + 4]) fill(GRAVEL, 194, z, 424, z + 4, 700);
  fill(GRAVEL, 194, POOL.z0 - 8, 198, POOL.z1 + 8, 100); 
  for (const z of [AXIS - 31, AXIS + 27]) fill(GRAVEL, 581, z, 720, z + 4, 500);
  fill(LAWN, 584, AXIS - 25, 716, AXIS + 25);
  g.fillStyle = 'rgba(70,128,60,0.22)'; for (let x = 584; x < 716; x += 8) rect(x, AXIS - 25, x + 4, AXIS + 25);
  for (const x of [624, 670, 716]) fill(GRAVEL, x, AXIS - 31, x + 6, AXIS + 31, 150);
  // the Monument's round of paving and the walks that meet at it
  const mx = MONUMENT_AT.x + 20, mz = MONUMENT_AT.z + 20;
  fill(GRAVEL, mx - 3, 468, mx + 3, 695, 600); fill(GRAVEL, 456, mz - 3, 548, mz + 3, 300);
  g.fillStyle = STONE; E(mx, mz, 23, 23); g.strokeStyle = 'rgba(150,140,118,0.5)'; E(mx, mz, 18, 18, 0.5); E(mx, mz, 12, 12, 0.5);
  // the Capitol's pool has a rim already; the walk round it
  fill(GRAVEL, CPOOL.x0 - 6, CPOOL.z0 - 6, CPOOL.x0 - 2, CPOOL.z1 + 6, 100);
  for (const L of LOTS) {
    const S = L.s || 40, R = (c, a0, b0, a1, b1, n = 0, cols = GRIT) => fill(c, ...LR(L, a0, b0, a1, b1), n, cols), C = (a, b) => { const q = LR(L, a, b, a, b); return [q[0], q[1]]; };
    if (L.k === 'lincoln') { R(STONE, 0, 0, S, S, 5000); R('#d2cdbf', 26, 0, 60, 9, 300); }
    else if (L.k === 'ww2') { g.fillStyle = STONE; E(L.x + 20, L.z + 20, 21, 21); speckle(L.x, L.z, L.x + 40, L.z + 40, 900, GRIT); }
    else if (L.k === 'whitehouse') {
      g.strokeStyle = '#d9d2c0'; E(L.x + 43, L.z + 24, 30, 15, 4); R('#d9d2c0', 28, 22, 58, 36, 300); R('#d9d2c0', 39, 0, 47, 8, 60); g.fillStyle = GRASS; E(L.x + 43, L.z + 13, 22, 9.5);
      R('#d9d2c0', 36, 70, 50, 86, 150);
    } else if (L.k === 'ellipse') { g.strokeStyle = '#d9d2c0'; E(L.x + 43, L.z + 46, 33, 31, 4); fill('#d9d2c0', L.x + 41, L.z, L.x + 45, L.z + 15, 60); g.fillStyle = LAWN; E(L.x + 43, L.z + 46, 30, 28); g.fillStyle = 'rgba(70,128,60,0.2)'; for (let x = L.x + 14; x < L.x + 72; x += 8) rect(x, L.z + 22, x + 4, L.z + 70); }
    else if (L.k === 'capitol') { R(STONE, 46, 0, 86, 42, 1500); R(STONE, 0, 30, S, 46, 2500); R(STONE, 40, 98, 92, S, 2500); R(GRAVEL, 0, 104, S, 110, 500); }
    else if (L.k === 'jefferson') { g.fillStyle = STONE; E(L.x + 43, L.z + 48, 38, 38); speckle(L.x + 6, L.z + 10, L.x + 80, L.z + 86, 3000, GRIT); R(STONE, 30, 0, 56, 12, 300); }
    else if (L.k === 'pentagon') { R('#5c5f63', 0, 0, S, 13, 1500, ['rgba(30,32,38,0.24)', 'rgba(110,114,124,0.15)']); R('#5c5f63', 0, 96, 40, S, 1200, ['rgba(30,32,38,0.24)', 'rgba(110,114,124,0.15)']); R('#5c5f63', 92, 96, S, S, 1200, ['rgba(30,32,38,0.24)', 'rgba(110,114,124,0.15)']); R(STONE, 54, 0, 78, 14, 200); }
    else if (L.k === 'unionstation') {
      R(STONE, 0, 0, S, 40, 3000);
      for (const a of [17, 43, 69]) { R('#6f675c', a - 6, 40, a + 6, 92); for (let b = 41; b < 92; b += 2) R('#4a3f33', a - 3, b, a + 4, b + 0.6); R('#b9bcc0', a - 2, 40, a - 1.6, 92); R('#b9bcc0', a + 2.6, 40, a + 3, 92); }
    } else if (L.k === 'castle') { R(GRAVEL, 23, 8, 25, 38, 60); R(GRAVEL, 8, 22, 40, 24, 60); R(GRAVEL, 38, 0, 46, 46, 300); g.fillStyle = STONE; const [x, z] = C(68, 20); E(x, z, 10, 10); }
    else if (L.k === 'dcmuseum') { R(GRAVEL, 37, 0, 49, 32, 300); if (L.o.v === 'space') { R(STONE, 16, 8, 74, 34, 900); } }
    else if (L.k === 'dcgrove' && L.o.v === 1) { R(GRAVEL, 18, 0, 22, 40, 100); R(GRAVEL, 0, 18, 40, 22, 100); g.fillStyle = GRAVEL; E(L.x + 20, L.z + 20, 9, 9); }
    else if (L.k === 'temple') { R(STONE, 0, 0, 40, 40, 700); }
  }
}
// after the streets: nothing to add yet
export function dcOver(g, GK, rect, speckle) {}
