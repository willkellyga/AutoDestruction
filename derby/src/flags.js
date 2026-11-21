// Which world this page lays out, settled before anything else in the bundle runs (main.js imports this first).
// Most maps stand on Crumbletown; the New York race stands on Monster Mayhem's New York map, which src/world.js builds
// when __NYC__ is true (bigger, taller, with nyc.js's lots). The derby's build (build.mjs) defines __NYC__ as
// globalThis.__DERBY_NYC__, so this sets that from the map the page is on, the same choice maps/index.js makes: the
// address's ?map=, or the one kept from the start card.
// The meshing worker (src/mesh-worker.js, started by src/sim.js) is bundled with the same define and has its own copy of
// the world, so it has to agree: sim.js names it 'mm-map=city' for any city, and on New York this renames that
// 'mm-map=nyc', which the worker's banner (build.mjs) reads to set the flag on its side.
export const NYC_MAPS = ['race'];   // the maps built on New York (maps/manhattan.js)
const KEY = 'ad-map';
export function picked() {
  const q = /[?&]map=(\w+)/.exec(location.search); if (q) return q[1];
  try { const v = sessionStorage.getItem(KEY); if (v) return v; } catch (e) { /* storage blocked: the window's name has it */ }
  const m = /ad-map=(\w+)/.exec(window.name || ''); return m ? m[1] : 'town';
}
const nyc = NYC_MAPS.includes(picked());
globalThis.__DERBY_NYC__ = nyc;
if (nyc && typeof Worker !== 'undefined') {
  const W = Worker;
  globalThis.Worker = function (url, opts) { return new W(url, opts && opts.name ? { ...opts, name: opts.name.replace('mm-map=city', 'mm-map=nyc') } : opts); };
}
