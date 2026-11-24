// A map's own sky, fog and light, and the show that goes with them. A map asks for one with its `look` field: `kind`
// names it, and the rest is what that look needs from the map (where its lamps, towers or fires stand). A map without
// one keeps main.js's daylight.
//   night   the arena (./night.js): a floodlit show at night, with searchlights and the crowd's cameras
//   dusk    the race (./dusk.js): the end of a summer's day, a low sun down the avenues and the lamps coming on
//   storm   the base (./storm.js): a stormy night, rain, lightning, searchlights from the guard towers and fires
//   fair    Dead Man's Fair (./fair.js): twilight, strings of coloured bulbs, and quarters of it going dark
// main.js calls setup() as it makes the sky, the fog and the lights (it can return the way to the sun, `sunDir`, for
// the shadows), and make() once everything else is made; make() returns step(dt, cars), called every frame.
import * as night from './night.js';
import * as dusk from './dusk.js';
import * as storm from './storm.js';
import * as fair from './fair.js';

const KINDS = { night, dusk, storm, fair };
export const lookSetup = (L, o) => KINDS[L.kind].setup(L, o);
export const makeLook = (L, o) => KINDS[L.kind].make(L, o);
