// Which world this page lays out, settled before anything else in the bundle runs (main.js imports this first).
// Most maps stand on Crumbletown; the New York race stands on Monster Mayhem's New York map, which src/world.js builds
// when __NYC__ is true (bigger, taller, with nyc.js's lots). Hammerdown Arena is built on the same world for its size
// alone (1024 by 1024, where Crumbletown's is 512 by 416): it lays out none of New York, only the pit. The derby's build (build.mjs) defines __NYC__ as
// globalThis.__DERBY_NYC__, so this sets that from the map the page is on, the same choice maps/index.js makes: the
// address's ?map=, or the one kept from the start card.
// The meshing worker (src/mesh-worker.js, started by src/sim.js) is bundled with the same define and has its own copy of
// the world, so it has to agree: sim.js names it 'mm-map=city' for any city, and on New York this renames that
// 'mm-map=nyc', which the worker's banner (build.mjs) reads to set the flag on its side.
export const NYC_MAPS = ['race', 'arena'];   // the maps built on New York's world (maps/manhattan.js, maps/arena.js)
const KEY = 'ad-map';
// The map: the address's ?map= first (any map, the hidden ones too), then the one kept from the start card. The start
// card has three (maps/index.js); a new player starts in the arena, and a choice kept from when Crumbletown was on the
// card goes there too (Crumbletown is still at ?map=town).
export function picked() {
  const q = /[?&]map=(\w+)/.exec(location.search); if (q) return q[1];
  let v = null;
  try { v = sessionStorage.getItem(KEY); } catch (e) { /* storage blocked: the window's name has it */ }
  if (!v) { const m = /ad-map=(\w+)/.exec(window.name || ''); v = m && m[1]; }
  return !v || v === 'town' ? 'arena' : v;
}
const nyc = NYC_MAPS.includes(picked());
globalThis.__DERBY_NYC__ = nyc;
if (nyc && typeof Worker !== 'undefined') {
  const W = Worker;
  globalThis.Worker = function (url, opts) { return new W(url, opts && opts.name ? { ...opts, name: opts.name.replace('mm-map=city', 'mm-map=nyc') } : opts); };
}
