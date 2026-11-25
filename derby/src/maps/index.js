// The maps, and which one this page builds. The world is laid out once, when the page loads, so changing map means
// loading the page again with the new choice (kept in the session, or the window's name where storage is blocked).
//
// A map is a plain object:
//   id, name, mode ('waves', 'race', 'survival' or 'brawl', see ../modes), blurb (one line for the menu), loading [title, line]
//   hidden                        optional: marks a map that is not on the start card (CARD, below); it loads with ?map=<id>
//   build()                       lays the voxels with src/world.js's kit; ends with finish() from ./common.js
//   ground()                      the painted ground: a canvas WX*GK by WZ*GK (canvasFor() in ./common.js)
//   outer                         the colour of the land past the edge of the map
//   backdrop                      optional: the world round the map past its edge, drawn in place of `outer`; its `kind`
//                                 says which (../backdrop.js: the arena's city, the harbor round the race, the wilds)
//   spawn {x, z, yaw}             where the player starts
//   spawnPoint(player, taken)     a place for a rival to come in, away from the cars in `taken`
//   waypoint(car, tx, tz, out)    the next point for a rival to drive at on the way to (tx, tz)
//   radar(R, s, ox, oy, w, h)     draws the map on the radar (s: radar pixels a voxel)
//   radarBox                      optional: [x0, z0, x1, z1], the part of the map the radar shows (all of it if left out)
//   step(dt)                      optional: anything the map runs each frame (moving hazards, the route grid)
//   track                         for the race mode: the circuit, its racing line, gates and grid (./manhattan.js, ./crumble.js, ./bowtie.js)
//   laps                          for the race mode: how many laps (3 if it is left out)
// The race ('race') and the arena are on New York's world, a world of its own: ../flags.js has the list of maps built on it.
import { picked } from '../flags.js';
import { leavePage } from '../leave.js';
import town from './town.js';
import manhattan from './manhattan.js';
import base from './base.js';
import arena from './arena.js';
import crumble from './crumble.js';
import bowtie from './bowtie.js';
import fair from './fair.js';
import empire from './empire.js';
import capital from './capital.js';

const ALL = [town, manhattan, base, fair, arena, crumble, bowtie, empire, capital];
// The start card: three ways to play, in this order. The rest (Crumbletown's waves, its race and the bow-tie) are
// still there by address: ?map=town, ?map=crumble, ?map=bowtie.
export const MAPS = [empire, base, fair, arena];   // (Will, 2026-11-24: Empire City replaces Manhattan Circuit, still at ?map=race)
export const mapById = (id) => ALL.find((m) => m.id === id);
// the maps of one mode that share a card: Zombie Survival's two (the card's map row picks; online picks for you)
// A preview page (one that sets window.__AD_PREVIEW_TRACKS to a track's id before the game loads) opens the Race's stage
// select on that track the first time (main.js lastMap).
export const PREVIEW = (typeof window !== 'undefined' && window.__AD_PREVIEW_TRACKS) || null;
export const SHARED = { survival: [base, fair] };
// The stage select (main.js): a solo player picks a map of the mode from these picture cards, by the mode's name, and the
// line under each card's name. Their pictures are src/stages.json (node derby/tools/stage-shots.mjs). A map here loads
// without ?map= in the address, like the start card's.
export const STAGES = { race: [empire, capital], survival: [base, fair], brawl: [arena] };
export const TAGS = {
  empire: '3 laps · bridges, the subway, Lady Liberty', capital: '3 laps · the Capitol, the Mall, the Metro',
  base: 'Army base · a storm at night', fair: 'County fair · the lights are failing', arena: 'Monster truck show · jumps and traps',
};
const KEY = 'ad-map';
export const MAP = ALL.find((m) => m.id === picked()) || arena;
// load the page again on another map (one that is not on the card keeps its ?map= in the address, so Play again stays on
// it: a kept choice of Crumbletown goes to the arena, ../flags.js)
export function chooseMap(id) {
  try { sessionStorage.setItem(KEY, id); } catch (e) { /* fall through to the window's name */ }
  try { window.name = (window.name || '').replace(/ad-map=\w+;?/, '') + `ad-map=${id};`; } catch (e) { /* stays */ }
  let u = location.href.replace(/([?&])map=\w+&?/, '$1').replace(/[?&]$/, '');
  if (!MAPS.some((m) => m.id === id) && !Object.values(STAGES).some((l) => l.some((m) => m.id === id))) u = u.replace(/(#|$)/, `${u.includes('?') ? '&' : '?'}map=${id}$1`);
  leavePage();   // let this world go before the next one is built (leave.js)
  if (u !== location.href) location.replace(u); else location.reload();
}
