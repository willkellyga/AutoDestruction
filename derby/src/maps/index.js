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
//   radarBox                      optional: [x0, z0, x1, z1], the part of the map the radar shows (all of it if left out)
//   step(dt)                      optional: anything the map runs each frame (moving hazards, the route grid)
//   track                         for the race mode: the circuit, its racing line, gates and grid (./manhattan.js, ./crumble.js, ./bowtie.js)
//   laps                          for the race mode: how many laps (3 if it is left out)
// The race ('race') is on New York, a world of its own: ../flags.js has the list of maps built on it.
import { picked } from '../flags.js';
import town from './town.js';
import manhattan from './manhattan.js';
import base from './base.js';
import arena from './arena.js';
import crumble from './crumble.js';
import bowtie from './bowtie.js';

const ALL = [town, manhattan, base, arena, crumble, bowtie];
export const MAPS = ALL.filter((m) => !m.hidden);   // the ones on the start card
const KEY = 'ad-map';
export const MAP = ALL.find((m) => m.id === picked()) || town;
// load the page again on another map
export function chooseMap(id) {
  try { sessionStorage.setItem(KEY, id); } catch (e) { /* fall through to the window's name */ }
  try { window.name = (window.name || '').replace(/ad-map=\w+;?/, '') + `ad-map=${id};`; } catch (e) { /* stays */ }
  const u = location.href.replace(/([?&])map=\w+&?/, '$1').replace(/[?&]$/, '');
  if (/[?&]map=/.test(location.search)) location.replace(u); else location.reload();
}
