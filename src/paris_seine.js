// The Seine and what stands in and along it: the stone walls of the quays, the rails, lamps and piers of the five
// bridges, the footbridge, the island, the islet with its little statue, and the boats. The water itself is painted
// on the ground (the map is flat, so monsters wade and only the army needs the bridges).
import { M, WX, STREET_X, set, box, walls, begin, setSeed, rnd, ri, vehicle } from './world.js';
import { tree, lampPost, bench, bin, disc } from './kit.js';
import { SEINE, ISLE, ISLET, ETOILE, TOWER, NOTRE, PX, PZ, onBridge } from './paris.js';
import { EIFFEL } from './paris_eiffel.js';

const FOOT = 690;   // the footbridge: x 690 to 697

// A length of parapet along x at z: a stone wall three high under a cap, sometimes with a bookseller's green boxes on top.
function parapet(xa, xb, z, boxes) {
  begin('Quay wall', 'prop', true);
  box(xa, 0, z, xb, 2, z, M.LIME2); box(xa, 3, z, xb, 3, z, M.TRIM);
  if (boxes && xb - xa > 14) { box(xa + 3, 4, z, xa + 12, 6, z, M.DOOR_G); box(xa + 3, 7, z, xa + 12, 7, z, M.DARK); set(xa + 5, 5, z, M.AWN_W); set(xa + 8, 5, z, M.SIGN); set(xa + 10, 6, z, M.AWN_R); }
}
// A stone balustrade down one side of a bridge (along z at x): posts and a rail.
function balustrade(x, za, zb) {
  begin('Bridge rail', 'prop', true);
  box(x, 0, za, x, 0, zb, M.LIME2);
  for (let z = za; z <= zb; z++) { set(x, 3, z, M.TRIM); if ((z - za) % 3 !== 1) { set(x, 1, z, M.LIME); set(x, 2, z, M.LIME); } }
}
// A pier: a pointed block of stone standing in the water beside a bridge, with the tip upstream or down.
function pier(x, z, dir) {
  begin('Bridge pier', 'prop', true);
  for (let k = 0; k < 7; k++) { const w = Math.max(0, 3 - (k >> 1)); box(x + dir * k, 0, z - w, x + dir * k, k < 5 ? 3 : 2, z + w, M.STONE); }
  for (let k = 0; k < 5; k++) { const w = Math.max(0, 2 - (k >> 1)); box(x + dir * k, 4, z - w, x + dir * k, 4, z + w, M.TRIM); }
}
// A boat on the river: the models in civilian/src, stood by src/civilians.js, given by its middle and the way its bow points.
const boat = (kind, x, z, fx, fz, opts) => vehicle(kind, x, z, fx, fz, { opts });

export function parisExtras() {
  setSeed(1889);
  const { z0, z1 } = SEINE;
  // the quay walls on both banks, broken where a bridge lands
  for (const z of [z0 - 1, z1]) for (let x = 4; x < WX - 4; x += 26) {
    const xb = Math.min(x + 23, WX - 5);
    if (onBridge(x) || onBridge(xb) || (x < FOOT + 9 && xb > FOOT - 2)) continue;
    parapet(x, xb, z, rnd() < 0.3);
  }
  // the bridges: a balustrade in three lengths down each side, lamps along both pavements, and piers in the water
  STREET_X.forEach((sx, n) => {
    const isle = sx > ISLE.tip;   // the last two bridges cross the island
    for (const x of [sx - 18, sx + 17]) {
      const spans = isle ? [[z0, ISLE.z0 - 3], [ISLE.z1 + 3, z1 - 1]] : [[z0, z0 + 44], [z0 + 46, z1 - 46], [z1 - 44, z1 - 1]];
      for (const [a, b] of spans) balustrade(x, a, b);
    }
    for (let z = z0 + 10; z < z1 - 6; z += 29) { if (isle && z > ISLE.z0 && z < ISLE.z1) continue; lampPost(sx - 15, z, 18); lampPost(sx + 14, z + 14, 18); }
    for (const z of isle ? [z0 + 17, z1 - 17] : [z0 + 34, z0 + 68, z1 - 34]) { pier(sx + 18, z, 1); pier(sx - 19, z, -1); }
    if (n === 1) {
      // the ornate bridge: a stone pylon at each corner with a gilded figure on top
      for (const px of [sx - 23, sx + 19]) for (const pz of [z0 - 6, z1 + 2]) {
        begin('Gilded pylon', 'monument', true);
        box(px - 1, 0, pz - 1, px + 5, 1, pz + 5, M.STONE); box(px, 2, pz, px + 4, 30, pz + 4, M.LIME); box(px - 1, 31, pz - 1, px + 5, 32, pz + 5, M.TRIM);
        for (const y of [8, 22]) box(px - 1, y, pz - 1, px + 5, y, pz + 5, M.TRIM);
        box(px + 1, 33, pz + 1, px + 3, 36, pz + 3, M.BRASS); box(px + 2, 37, pz + 1, px + 2, 40, pz + 2, M.BRASS); set(px + 2, 39, pz + 3, M.BRASS); set(px + 1, 38, pz + 1, M.BRASS); set(px + 3, 38, pz + 1, M.BRASS); set(px + 2, 41, pz + 2, M.BRASS);
      }
    }
  });
  // the footbridge: iron rails either side of a wooden deck (the deck is painted)
  for (const x of [FOOT, FOOT + 7]) for (const [a, b] of [[z0, z0 + 44], [z0 + 46, z1 - 46], [z1 - 44, z1 - 1]]) {
    begin('Footbridge rail', 'prop', true);
    for (let z = a; z <= b; z++) { set(x, 0, z, M.DARK); set(x, 3, z, M.DARK); if ((z - a) % 2 === 0) { set(x, 1, z, M.DARK); set(x, 2, z, M.DARK); } }
  }
  for (const z of [z0 + 30, z0 + 68, z0 + 106]) { lampPost(FOOT + 1, z, 14); for (const x of [FOOT - 2, FOOT + 8]) { begin('Footbridge pier', 'prop', true); box(x, 0, z - 1, x + 1, 2, z + 1, M.DARK); } }
  // the island: a low kerb round it, and trees and benches west of the cathedral
  for (let x = ISLE.x0; x < ISLE.x1 - 4; x += 26) for (const z of [ISLE.z0, ISLE.z1 - 1]) {
    const xb = Math.min(x + 23, ISLE.x1 - 6);
    if (onBridge(x) || onBridge(xb)) continue;
    begin('Island kerb', 'prop', true); box(x, 0, z, xb, 1, z, M.LIME2); box(x, 2, z, xb, 2, z, M.TRIM);
  }
  for (let x = ISLE.x0 + 6; x < NOTRE.x - 24; x += 22) { if (onBridge(x) || onBridge(x + 4)) continue; tree(x, ISLE.z0 + 9 + ri(0, 4), ri(11, 14), 5); tree(x + 9, ISLE.z1 - 12 - ri(0, 4), ri(11, 14), 5); if (rnd() < 0.5) bench(x + 4, ISLE.z0 + 30); else lampPost(x + 6, ISLE.z0 + 34, 18); }
  tree(ISLE.tip + 12, 473, 13, 5);
  // the islet at the west end, with trees and the little statue on its plinth looking downstream
  for (let x = ISLET.x0 + 30; x < ISLET.x1 - 8; x += 13) tree(x, ISLET.z - 1 + ri(-1, 1), ri(9, 12), 4);
  {
    begin('Little Liberty', 'monument', true);
    const x = ISLET.x0 + 12, z = ISLET.z - 2;
    box(x - 1, 0, z - 1, x + 5, 1, z + 5, M.STONE); box(x, 2, z, x + 4, 9, z + 4, M.LIME); box(x - 1, 10, z - 1, x + 5, 10, z + 5, M.TRIM);
    box(x + 1, 11, z + 1, x + 3, 20, z + 3, M.ROOF_G); box(x + 1, 21, z + 1, x + 3, 23, z + 3, M.ROOF_G);                 // robe and head
    box(x + 1, 24, z + 1, x + 3, 24, z + 3, M.ROOF_G); for (const [a, b] of [[4, 2], [2, 0], [2, 4]]) set(x + a, 24, z + b, M.ROOF_G); set(x + 2, 25, z + 2, M.ROOF_G);  // crown
    box(x, 18, z + 2, x, 27, z + 2, M.ROOF_G); set(x, 28, z + 2, M.BRASS); set(x, 29, z + 2, M.LIT_Y);                      // the raised arm and the torch
    box(x + 4, 15, z + 1, x + 4, 18, z + 2, M.ROOF_G);                                                                         // the tablet
  }
  // boats: tour boats under way in mid-stream, barges moored along the quays
  // (a tour boat is 20 m long and a barge 17 m, so each lies in the reach between two bridges)
  boat('tour', 278, 440, -1, 0, { type: 'tour', paint: 'blue' }); boat('tour', 452, 512, -1, 0, { type: 'tour', paint: 'red' }); boat('tour', 640, 456, -1, 0, { type: 'tour', paint: 'green' }); boat('tour', 95, 505, -1, 0, { type: 'tour', paint: 'blue' });
  boat('barge', 290, 528, -1, 0, { type: 'barge', load: 'sand', house: true }); boat('barge', 484, 420, 1, 0, { type: 'barge', load: 'crates', house: true, paint: 'green' }); boat('barge', 650, 528, -1, 0, { type: 'barge', load: 'gravel', house: true, paint: 'blue' });
  boat('barge', 110, 420, 1, 0, { type: 'barge', load: 'sand', house: true, paint: 'green' }); boat('barge', 930, 420, 1, 0, { type: 'barge', load: 'coal', house: true }); boat('barge', 925, 526, -1, 0, { type: 'barge', load: 'gravel', house: true, paint: 'blue' });
}

// ---- the painted ground ---------------------------------------------------------------------------------------------
// before the lot pads: Paris stands on pale gravel, not grass
export function parisBase(g, GK, rect, speckle) {
  g.fillStyle = '#d6cdb9'; rect(0, 0, WX, WX);
  speckle(0, 0, WX, WX, 520000, ['rgba(255,250,235,0.22)', 'rgba(120,108,84,0.16)', 'rgba(190,178,150,0.25)']);
}
// after the lot pads and before the streets, so the bridges are simply the streets that cross the water
export function parisGround(g, GK, rect, speckle) {
  const { z0, z1 } = SEINE, P = (pts) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(x * GK, z * GK) : g.moveTo(x * GK, z * GK))); g.closePath(); g.fill(); };
  // the round plaza: paving in rings, and the twelve avenues of the star
  g.fillStyle = '#d9d0bb'; g.beginPath(); g.arc(ETOILE.x * GK, ETOILE.z * GK, ETOILE.r * GK, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(150,132,104,0.5)'; g.lineWidth = 0.4 * GK;
  for (let r = 14; r < ETOILE.r; r += 6) { g.beginPath(); g.arc(ETOILE.x * GK, ETOILE.z * GK, r * GK, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = 'rgba(120,112,100,0.55)'; g.lineWidth = 3 * GK;
  for (let a = 0; a < 12; a++) { const t = a * Math.PI / 6 + Math.PI / 12; g.beginPath(); g.moveTo((ETOILE.x + Math.cos(t) * 30) * GK, (ETOILE.z + Math.sin(t) * 30) * GK); g.lineTo((ETOILE.x + Math.cos(t) * (ETOILE.r - 1)) * GK, (ETOILE.z + Math.sin(t) * (ETOILE.r - 1)) * GK); g.stroke(); }
  // under the tower: gravel, a lawn down each side and the four feet
  g.fillStyle = '#d9d0bb'; rect(TOWER.x, TOWER.z, TOWER.x + EIFFEL.W, TOWER.z + EIFFEL.D);
  speckle(TOWER.x, TOWER.z, TOWER.x + EIFFEL.W, TOWER.z + EIFFEL.D, 9000, ['rgba(255,250,235,0.25)', 'rgba(120,108,84,0.18)']);
  g.fillStyle = '#79aa62';
  for (const [xa, xb] of [[TOWER.x + 2, TOWER.x + 5], [TOWER.x + EIFFEL.W - 6, TOWER.x + EIFFEL.W - 3]]) rect(xa, TOWER.z + 14, xb + 1, TOWER.z + EIFFEL.D - 14);
  for (const zz of [TOWER.z + 1, TOWER.z + EIFFEL.D - 11]) { rect(TOWER.x + 2, zz, TOWER.x + 38, zz + 10); rect(TOWER.x + 78, zz, TOWER.x + EIFFEL.W - 2, zz + 10); }
  // the river: green-blue water, darker along the walls, with light and dark ripples
  g.fillStyle = '#5f9fae'; rect(0, z0, WX, z1);
  g.fillStyle = 'rgba(30,70,84,0.45)'; rect(0, z0, WX, z0 + 3); rect(0, z1 - 3, WX, z1);
  g.fillStyle = 'rgba(30,70,84,0.2)'; rect(0, z0 + 3, WX, z0 + 7); rect(0, z1 - 7, WX, z1 - 3);
  let s = 1889; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  for (let i = 0; i < 5200; i++) { const x = r() * WX, z = z0 + 4 + r() * (z1 - z0 - 8), w = 2 + r() * 7; g.fillStyle = r() < 0.5 ? 'rgba(190,232,236,0.3)' : 'rgba(34,84,100,0.22)'; rect(Math.floor(x), Math.floor(z), Math.floor(x) + Math.ceil(w), Math.floor(z) + 1); }
  // the island and the islet: stone quays with a garden at the point
  const isle = [[ISLE.tip, 474], [ISLE.x0, ISLE.z0], [ISLE.x1, ISLE.z0], [ISLE.x1 + 8, 462], [ISLE.x1 + 8, 486], [ISLE.x1, ISLE.z1], [ISLE.x0, ISLE.z1]];
  g.fillStyle = 'rgba(30,70,84,0.4)'; P(isle.map(([x, z]) => [x + (x < 730 ? -3 : 0), z + (z < 474 ? -2.5 : z > 474 ? 2.5 : 0)]));
  g.fillStyle = '#d3cab5'; P(isle);
  speckle(ISLE.x0, ISLE.z0, ISLE.x1, ISLE.z1, 16000, ['rgba(255,250,235,0.25)', 'rgba(120,108,84,0.18)']);
  g.fillStyle = '#79aa62'; P([[ISLE.tip + 4, 474], [ISLE.x0 - 2, ISLE.z0 + 6], [ISLE.x0 - 2, ISLE.z1 - 6]]);
  for (let x = ISLE.x0 + 2; x < NOTRE.x - 26; x += 22) { rect(x, ISLE.z0 + 5, x + 16, ISLE.z0 + 16); rect(x, ISLE.z1 - 16, x + 16, ISLE.z1 - 5); }
  g.fillStyle = 'rgba(30,70,84,0.4)'; g.beginPath(); g.ellipse((ISLET.x0 + ISLET.x1) / 2 * GK, ISLET.z * GK, ((ISLET.x1 - ISLET.x0) / 2 + 2) * GK, 9 * GK, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#7fae66'; g.beginPath(); g.ellipse((ISLET.x0 + ISLET.x1) / 2 * GK, ISLET.z * GK, (ISLET.x1 - ISLET.x0) / 2 * GK, 7 * GK, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d3cab5'; rect(ISLET.x0 + 8, ISLET.z - 5, ISLET.x0 + 21, ISLET.z + 5);
  // the footbridge's deck: planks
  g.fillStyle = '#9c7a55'; rect(FOOT, z0, FOOT + 8, z1);
  g.fillStyle = 'rgba(60,40,22,0.35)'; for (let z = z0; z < z1; z += 2) rect(FOOT, z, FOOT + 8, z + 0.25);
}
