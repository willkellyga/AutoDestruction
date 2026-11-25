// Cars stay out of buildings (Will, 2026-11-24: "I got stuck in a building"). A building's walls still take hits, shells
// and fire as before, and the rubble still falls, but where it stood when the round began, and the rooms inside it, are
// a wall to a car for the whole round, however big the hole. vehicle.js asks at(x, z) beside the voxels it feels.
//
// Worked out once, after the map is built, on a grid of the ground (one cell a voxel):
//   1. what stands at car height (y 2 or 4) and belongs to a building: anything but rubble, lamps and bins (prop),
//      trees, boats and the maps' own barriers (which never give way anyway)
//   2. the rooms: the walls are grown by GROW cells, which closes doorways and gaps narrower than a car, and every
//      patch of open ground then shut in on all sides and smaller than ROOM cells is a room
//   3. the rooms are grown back by GROW + 1 cells, so they reach the inside face of their walls and fill the doorways
import { WX, WZ, solid, idx, ownerAt, bodies } from '../../src/world.js';

const GROW = 2, ROOM = 9000;
const OPEN = new Set(['prop', 'rubble', 'tree', 'boat', 'barrier']);
let no = null;

export const at = (x, z) => {
  if (!no) return 0;
  const ix = Math.floor(x), iz = Math.floor(z);
  return ix < 0 || iz < 0 || ix >= WX || iz >= WZ ? 0 : no[ix + iz * WX];
};

// the grid grown by r cells each way (a square round each cell)
function grow(src, r) {
  const a = new Uint8Array(WX * WZ), out = new Uint8Array(WX * WZ);
  for (let z = 0; z < WZ; z++) {
    const o = z * WX; let run = -1e9;
    for (let x = 0; x < WX; x++) { if (src[o + x]) run = x; if (x - run <= r) a[o + x] = 1; }
    run = 1e9;
    for (let x = WX - 1; x >= 0; x--) { if (src[o + x]) run = x; if (run - x <= r) a[o + x] = 1; }
  }
  for (let x = 0; x < WX; x++) {
    let run = -1e9;
    for (let z = 0; z < WZ; z++) { if (a[x + z * WX]) run = z; if (z - run <= r) out[x + z * WX] = 1; }
    run = 1e9;
    for (let z = WZ - 1; z >= 0; z--) { if (a[x + z * WX]) run = z; if (run - z <= r) out[x + z * WX] = 1; }
  }
  return out;
}

export function build() {
  const t = performance.now(), N = WX * WZ, wall = new Uint8Array(N);
  let walls = 0;
  for (let z = 0; z < WZ; z++) for (let x = 0; x < WX; x++) {
    for (const y of [2, 4]) {
      if (!solid(x, y, z)) continue;
      const b = bodies[ownerAt(idx(x, y, z))];
      if (b && !OPEN.has(b.kind)) { wall[x + z * WX] = 1; walls++; break; }
    }
  }
  // the rooms: patches of open ground, between the grown walls, shut in and small
  const shut = grow(wall, GROW), seen = new Int32Array(N).fill(-1), q = new Int32Array(N), room = new Uint8Array(N);
  let rooms = 0, roomCells = 0;
  for (let s = 0; s < N; s++) {
    if (shut[s] || seen[s] >= 0) continue;
    let h = 0, n = 0, edge = false; q[n++] = s; seen[s] = s;
    while (h < n) {
      const c = q[h++], x = c % WX, z = (c / WX) | 0;
      if (x === 0 || z === 0 || x === WX - 1 || z === WZ - 1) edge = true;
      if (x > 0 && !shut[c - 1] && seen[c - 1] < 0) { seen[c - 1] = s; q[n++] = c - 1; }
      if (x < WX - 1 && !shut[c + 1] && seen[c + 1] < 0) { seen[c + 1] = s; q[n++] = c + 1; }
      if (z > 0 && !shut[c - WX] && seen[c - WX] < 0) { seen[c - WX] = s; q[n++] = c - WX; }
      if (z < WZ - 1 && !shut[c + WX] && seen[c + WX] < 0) { seen[c + WX] = s; q[n++] = c + WX; }
    }
    if (!edge && n <= ROOM) { rooms++; roomCells += n; for (let i = 0; i < n; i++) room[q[i]] = 1; }
  }
  const inside = grow(room, GROW + 1);
  no = new Uint8Array(N);
  for (let i = 0; i < N; i++) no[i] = wall[i] | inside[i];
  return { walls, rooms, roomCells, ms: Math.round(performance.now() - t), at };
}

// The nearest open ground to (x, z), out to r: for a car that finds itself inside (spawned there, shoved in).
export function nearestOut(x, z, r = 80) {
  const cx = Math.floor(x), cz = Math.floor(z);
  for (let d = 1; d <= r; d++) {
    for (let k = -d; k <= d; k++) {
      for (const [px, pz] of [[cx + k, cz - d], [cx + k, cz + d], [cx - d, cz + k], [cx + d, cz + k]]) {
        if (px < 4 || pz < 4 || px >= WX - 4 || pz >= WZ - 4) continue;
        let ok = true;
        for (let dz = -3; dz <= 3 && ok; dz++) for (let dx = -3; dx <= 3 && ok; dx++) {
          if (no[px + dx + (pz + dz) * WX] || solid(px + dx, 2, pz + dz)) ok = false;
        }
        if (ok) return { x: px + 0.5, z: pz + 0.5 };
      }
    }
  }
  return null;
}
