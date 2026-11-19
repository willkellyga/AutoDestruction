// Builds chunk meshes off the page's thread (bundled on its own by build.py, with the same map settings as the game, and
// carried in the game as text; started by sim.js). It keeps its own copy of the voxel world: the whole store once the world
// is built, then each request brings the cells the game wrote since the last one (world.js wlog), so a mesh is built from
// the world as it was when it was asked for. A changed chunk is asked for again by the game.
// Messages in: { store } once; then { w: written cells, jobs: [[0, chunk, cx, cz] or [1, region, cx0, cz0, R, s], ...] }
// (kind 2 is a chunk asked for by sim.js meshWorkerCheck).
// Messages out: one per job, { t, k, p: packed mesh or null, ms }, its arrays handed over; or { error } when it cannot go on.
import { storeLoad, putCells } from './world.js';
import { chunkPack, regionPack } from './mesh.js';

let ok = false;
self.onmessage = (e) => {
  const d = e.data;
  try {
    if (d.store) { storeLoad(d.store); ok = true; return; }
    if (!ok) return;
    if (d.w && d.w.length) putCells(d.w);
    for (const j of d.jobs) {
      const t0 = performance.now(), p = j[0] === 1 ? regionPack(j[2], j[3], j[4], j[5]) : chunkPack(j[2], j[3]);
      self.postMessage({ t: j[0], k: j[1], p, ms: performance.now() - t0 }, p ? [p.pa.buffer, p.pc.buffer, p.ix.buffer] : []);
    }
  } catch (err) { ok = false; self.postMessage({ error: String(err && err.stack || err) }); }
};
