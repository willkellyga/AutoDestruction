// The painted ground: grass, the four streets with pavements and crossings, lot pads and garden paths.
import { WX, WZ, PARIS, NYC, TOKYO, STREET_X, STREET_Z, WALK, ROADW } from './world.js';
import { LOTS, lotRect, BLOCKS, ALLEYS } from './town.js';
import { STADIUM } from './landmarks.js';
import { PARIS_PAD } from './paris.js';
import { parisBase, parisGround } from './paris_seine.js';
import { NYC_PAD } from './nyc.js';
import { nycBase, nycGround, nycOver } from './nyc_water.js';
import { TOKYO_PAD } from './tokyo.js';
import { tokyoBase, tokyoGround, tokyoOver } from './tokyo_water.js';

export const GK = Math.min(8, Math.floor(4096 / Math.max(WX, WZ)));   // texels a voxel, kept inside a 4096 texture
export function groundCanvas() {
  const cv = document.createElement('canvas'); cv.width = WX * GK; cv.height = WZ * GK;
  const g = cv.getContext('2d');
  const rect = (xa, za, xb, zb) => g.fillRect(xa * GK, za * GK, (xb - xa) * GK, (zb - za) * GK);
  let s = 77; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  // voxel-sized speckle inside a box, so the ground reads at the same grain as the buildings
  const speckle = (xa, za, xb, zb, n, cols) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; const x = Math.floor(xa + r() * (xb - xa)), z = Math.floor(za + r() * (zb - za)); rect(x, z, x + 1, z + 1); } };
  const H = ROADW / 2, P = H + WALK;
  g.fillStyle = '#79aa62'; g.fillRect(0, 0, cv.width, cv.height);
  speckle(0, 0, WX, WZ, Math.round(52000 * WX * WZ / 96768), ['rgba(92,146,74,0.5)', 'rgba(146,192,108,0.45)', 'rgba(110,160,84,0.5)', 'rgba(170,190,110,0.25)']);
  if (PARIS) parisBase(g, GK, rect, speckle);
  if (NYC) nycBase(g, GK, rect, speckle);
  if (TOKYO) tokyoBase(g, GK, rect, speckle);
  // lot pads and paths
  const PAD = { shop: '#c9c2b2', apartment: '#c9c2b2', tower: '#c4c6c8', fuel: '#8e9096', watertower: '#b9a98c', carpark: '#55595f', depot: '#a39d90', plaza: '#d6cdb8', needle: '#d6cdb8', factory: '#9a9690', cinema: '#c9c2b2', ...(PARIS ? PARIS_PAD : {}), ...(NYC ? NYC_PAD : {}), ...(TOKYO ? TOKYO_PAD : {}) };
  const PATH = '#cfc6b0';
  for (const L of LOTS) {
    if (L.s) continue;   // the big lots are painted after the alleys
    const R = (a0, b0, a1, b1) => rect(...lotRect(L, a0, b0, a1, b1));
    if (PAD[L.k]) { g.fillStyle = PAD[L.k]; R(0, 0, 40, 40); const q = lotRect(L, 0, 0, 40, 40); speckle(q[0], q[1], q[2], q[3], 700, ['rgba(255,250,235,0.2)', 'rgba(60,56,50,0.16)']); }
    g.fillStyle = PATH;
    if (L.k === 'cottage') R(12, 0, 16, 12);
    else if (L.k === 'church') { R(17, 0, 23, 5); g.fillStyle = 'rgba(96,120,70,0.5)'; R(1, 12, 9, 38); R(31, 12, 39, 38); }
    else if (L.k === 'carpark') {
      // bay lines between the two columns of cars, and a lane down the middle
      g.fillStyle = '#e9e4d6';
      for (const b of [3, 12, 21, 30, 39]) { R(1, b, 18, b + 0.3); R(21, b, 38, b + 0.3); }
      g.fillStyle = '#d9b84a'; for (let b = 2; b < 38; b += 5) R(19.3, b, 19.7, b + 2.5);
    } else if (L.k === 'rowhouse') { for (const a of [26, 14, 2]) R(a, 0, a + 5, 11); }
    else if (L.k === 'plaza' || L.k === 'needle') {
      // paving in rings round the clock tower
      const c = lotRect(L, 20, 20, 20, 20);
      g.strokeStyle = 'rgba(150,132,104,0.45)'; g.lineWidth = 0.35 * GK;
      for (let r = 9; r < 20; r += 3) { g.beginPath(); g.arc(c[0] * GK, c[1] * GK, r * GK, 0, Math.PI * 2); g.stroke(); }
    } else if (L.k === 'park') {
      R(15, 0, 25, 12); R(25, 15, 40, 24);
      const c = lotRect(L, 20, 20, 20, 20);
      g.beginPath(); g.arc(c[0] * GK, c[1] * GK, 13 * GK, 0, Math.PI * 2); g.fill();
      speckle(c[0] - 12, c[1] - 12, c[0] + 12, c[1] + 12, 500, ['rgba(255,250,235,0.25)', 'rgba(110,96,70,0.2)']);
    }
  }
  // the alley
  for (const az of ALLEYS) for (const [x0, x1] of BLOCKS) {
    g.fillStyle = '#a3906e'; rect(x0, az, x1, az + 6);
    speckle(x0, az, x1, az + 6, 900, ['rgba(70,58,40,0.25)', 'rgba(200,184,150,0.3)']);
  }
  // the stadium: an apron, a running track round the pitch, mown stripes and white lines
  for (const L of LOTS) if (L.k === 'stadium') {
    const S = L.s, R = (a0, b0, a1, b1) => rect(...lotRect(L, a0, b0, a1, b1)), q = lotRect(L, 0, 0, S, S), c = lotRect(L, S / 2, S / 2, S / 2, S / 2);
    g.fillStyle = '#bdb7a8'; R(0, 0, S, S); speckle(q[0], q[1], q[2], q[3], 3000, ['rgba(255,250,235,0.2)', 'rgba(60,56,50,0.16)']);
    const flip = L.f === 1 || L.f === 3, rx = STADIUM.A * (STADIUM.IN + 0.02), rz = STADIUM.B * (STADIUM.IN + 0.02);
    g.fillStyle = '#b5583e'; g.beginPath(); g.ellipse(c[0] * GK, c[1] * GK, (flip ? rz : rx) * GK, (flip ? rx : rz) * GK, 0, 0, Math.PI * 2); g.fill();
    const m = S / 2;
    for (let i = 0; i < 9; i++) { g.fillStyle = i & 1 ? '#5fa653' : '#6fb65f'; R(m - 18 + i * 4, m - 12, m - 14 + i * 4, m + 12); }
    g.fillStyle = '#f2efe4';
    R(m - 18, m - 12, m + 18, m - 11.6); R(m - 18, m + 11.6, m + 18, m + 12); R(m - 18, m - 12, m - 17.6, m + 12); R(m + 17.6, m - 12, m + 18, m + 12); R(m - 0.2, m - 12, m + 0.2, m + 12);
    for (const s of [-1, 1]) { R(m + s * 18, m - 6, m + s * 13, m - 5.6); R(m + s * 18, m + 5.6, m + s * 13, m + 6); R(m + s * 13 - 0.2, m - 6, m + s * 13 + 0.2, m + 6); }
    g.strokeStyle = '#f2efe4'; g.lineWidth = 0.4 * GK; g.beginPath(); g.arc(c[0] * GK, c[1] * GK, 4 * GK, 0, Math.PI * 2); g.stroke();
  }
  if (NYC) nycGround(g, GK, rect, speckle);
  if (TOKYO) tokyoGround(g, GK, rect, speckle);
  if (PARIS) parisGround(g, GK, rect, speckle);   // the river and the squares go under the streets, so a bridge is just a street
  // pavements
  g.fillStyle = '#c8c1b1';
  for (const z of STREET_Z) rect(0, z - P, WX, z + P);
  for (const x of STREET_X) rect(x - P, 0, x + P, WZ);
  g.fillStyle = 'rgba(96,90,78,0.28)';
  for (const z of STREET_Z) { for (let t = 0; t < WX; t += 4) rect(t, z - P, t + 0.18, z + P); for (let t = z - P; t < z + P; t += 4) rect(0, t, WX, t + 0.18); }
  for (const x of STREET_X) { for (let t = 0; t < WZ; t += 4) rect(x - P, t, x + P, t + 0.18); for (let t = x - P; t < x + P; t += 4) rect(t, 0, t + 0.18, WZ); }
  for (const z of STREET_Z) speckle(0, z - P, WX, z + P, Math.round(5000 * WX / 336), ['rgba(255,250,235,0.22)', 'rgba(90,84,72,0.18)']);
  for (const x of STREET_X) speckle(x - P, 0, x + P, WZ, Math.round(4500 * WZ / 288), ['rgba(255,250,235,0.22)', 'rgba(90,84,72,0.18)']);
  // kerbs, then asphalt
  g.fillStyle = '#eee8da';
  for (const z of STREET_Z) rect(0, z - H - 0.6, WX, z + H + 0.6);
  for (const x of STREET_X) rect(x - H - 0.6, 0, x + H + 0.6, WZ);
  g.fillStyle = '#474b54';
  for (const z of STREET_Z) rect(0, z - H, WX, z + H);
  for (const x of STREET_X) rect(x - H, 0, x + H, WZ);
  for (const z of STREET_Z) speckle(0, z - H, WX, z + H, Math.round(7000 * WX / 336), ['rgba(30,32,38,0.24)', 'rgba(110,114,124,0.15)']);
  for (const x of STREET_X) speckle(x - H, 0, x + H, WZ, Math.round(6000 * WZ / 288), ['rgba(30,32,38,0.24)', 'rgba(110,114,124,0.15)']);
  // centre dashes, stopping short of the junctions
  g.fillStyle = '#e6cf78';
  const far = (t, list) => list.every((q) => t + 6 < q - P - 6 || t > q + P + 6);
  for (const z of STREET_Z) for (let t = 4; t < WX - 6; t += 12) if (far(t, STREET_X)) rect(t, z - 0.4, t + 6, z + 0.4);
  for (const x of STREET_X) for (let t = 4; t < WZ - 6; t += 12) if (far(t, STREET_Z)) rect(x - 0.4, t, x + 0.4, t + 6);
  // zebra crossings on every arm of every junction
  g.fillStyle = '#ece8dc';
  for (const x of STREET_X) for (const z of STREET_Z) {
    for (let t = -H + 1.5; t < H - 1.5; t += 3) {
      rect(x - P - 5, z + t, x - P - 1, z + t + 1.5); rect(x + P + 1, z + t, x + P + 5, z + t + 1.5);
      rect(x + t, z - P - 5, x + t + 1.5, z - P - 1); rect(x + t, z + P + 1, x + t + 1.5, z + P + 5);
    }
  }
  if (TOKYO) tokyoOver(g, GK, rect);   // the scramble crossing's diagonal stripes
  if (NYC) nycOver(g, GK, rect);   // the piers are painted over the streets that run out onto them
  return cv;
}
