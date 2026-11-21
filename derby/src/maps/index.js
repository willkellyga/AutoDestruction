// The maps, and which one this page builds. The world is laid out once, when the page loads, so changing map means
// loading the page again with the new choice (kept in the session, or the window's name where storage is blocked).
//
// A map is a plain object:
//   id, name, mode ('waves', 'race' or 'survival', see ../modes), blurb (one line for the menu), loading [title, line]
//   hidden                        optional: left off the start card (it still loads with ?map=<id>)
//   build()                       lays the voxels with src/world.js's kit; ends with finish() from ./common.js
//   ground()                      the painted ground: a canvas WX*GK by WZ*GK (canvasFor() in ./common.js)
//   outer                         the colour of the land past the edge of the map
//   spawn {x, z, yaw}             where the player starts
//   spawnPoint(player, taken)     a place for a rival to come in, away from the cars in `taken`
//   waypoint(car, tx, tz, out)    the next point for a rival to drive at on the way to (tx, tz)
//   radar(R, s, ox, oy, w, h)     draws the map on the radar (s: radar pixels a voxel)
//   step(dt)                      optional: anything the map runs each frame (moving hazards, the route grid)
//   track                         for the race mode: the circuit, its racing line, gates and grid (./race.js, ./bowtie.js)
import town from './town.js';
import race from './race.js';
import base from './base.js';
import arena from './arena.js';
import bowtie from './bowtie.js';

const ALL = [town, race, base, arena, bowtie];
export const MAPS = ALL.filter((m) => !m.hidden);   // the ones on the start card
const KEY = 'ad-map';
function picked() {
  const q = /[?&]map=(\w+)/.exec(location.search); if (q) return q[1];
  try { const v = sessionStorage.getItem(KEY); if (v) return v; } catch (e) { /* storage blocked: the window's name has it */ }
  const m = /ad-map=(\w+)/.exec(window.name || ''); return m ? m[1] : 'town';
}
export const MAP = ALL.find((m) => m.id === picked()) || town;
// load the page again on another map
export function chooseMap(id) {
  try { sessionStorage.setItem(KEY, id); } catch (e) { /* fall through to the window's name */ }
  try { window.name = (window.name || '').replace(/ad-map=\w+;?/, '') + `ad-map=${id};`; } catch (e) { /* stays */ }
  const u = location.href.replace(/([?&])map=\w+&?/, '$1').replace(/[?&]$/, '');
  if (/[?&]map=/.test(location.search)) location.replace(u); else location.reload();
}
