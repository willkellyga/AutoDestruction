// Crumbletown: Monster Mayhem's town as it is (its layout, buildings and painted streets), with the parked cars and
// buses taken out so the streets are the arena. Waves of rivals; the rivals drive the street grid.
import { WX, WZ, STREET_X, STREET_Z, SPAWN, vehicles } from '../../../src/world.js';
import { generateTown } from '../../../src/town.js';
import { groundCanvas } from '../../../src/ground.js';
import { pickSpot } from './common.js';

const near = (list, v) => { let b = 0; for (let i = 1; i < list.length; i++) if (Math.abs(list[i] - v) < Math.abs(list[b] - v)) b = i; return b; };
const ON = 13;   // within this of a street's middle line a car is on that street

export default {
  id: 'town', name: 'Crumbletown', mode: 'waves',
  blurb: 'The streets of a whole town. Smash through the buildings and wreck each wave of rivals.',
  loading: ['Building the town', 'Laying the streets and raising the buildings'],
  outer: 0x7fb069,
  build() {
    generateTown();
    const keep = vehicles.filter((v) => v.kind !== 'car' && v.kind !== 'bus' && v.kind !== 'school');
    vehicles.length = 0; vehicles.push(...keep);
  },
  ground: () => groundCanvas(),
  spawn: { x: SPAWN.x, z: SPAWN.z, yaw: Math.PI },
  // the next place to drive to on the way to (tx, tz) along the streets
  waypoint(c, tx, tz, out) {
    const ix = near(STREET_X, c.x), iz = near(STREET_Z, c.z), tix = near(STREET_X, tx), tiz = near(STREET_Z, tz);
    const onX = Math.abs(c.x - STREET_X[ix]) < ON, onZ = Math.abs(c.z - STREET_Z[iz]) < ON;
    if (!onX && !onZ) { out.x = STREET_X[ix]; out.z = STREET_Z[iz]; return out; }   // off the streets (smashed into a lot): the nearest crossing
    // the target's own street, if it is on one we share
    if (onX && ix === tix && Math.abs(tx - STREET_X[tix]) < ON) { out.x = STREET_X[ix]; out.z = tz; return out; }
    if (onZ && iz === tiz && Math.abs(tz - STREET_Z[tiz]) < ON) { out.x = tx; out.z = STREET_Z[iz]; return out; }
    // otherwise along this street to the crossing that turns towards the target
    if (onX && (!onZ || Math.abs(tix - ix) <= Math.abs(tiz - iz))) {
      const j = tiz; if (Math.abs(c.z - STREET_Z[j]) < 10 && ix !== tix) { out.x = STREET_X[ix + Math.sign(tix - ix)]; out.z = STREET_Z[j]; return out; }
      out.x = STREET_X[ix]; out.z = STREET_Z[j]; return out;
    }
    const i = tix; if (Math.abs(c.x - STREET_X[i]) < 10 && iz !== tiz) { out.x = STREET_X[i]; out.z = STREET_Z[iz + Math.sign(tiz - iz)]; return out; }
    out.x = STREET_X[i]; out.z = STREET_Z[iz]; return out;
  },
  // a place to come in from: a street end or a crossing far from the player
  spawnPoint(player, taken) {
    const spots = [];
    for (const x of STREET_X) for (const z of STREET_Z) spots.push({ x, z });
    for (const x of STREET_X) { spots.push({ x, z: 14 }); spots.push({ x, z: WZ - 14 }); }
    for (const z of STREET_Z) { spots.push({ x: 14, z }); spots.push({ x: WX - 14, z }); }
    return pickSpot(spots, player, taken);
  },
  // the streets on the radar
  radar(R, s, ox, oy, w, h) {
    R.strokeStyle = 'rgba(255,255,255,0.22)'; R.lineWidth = 24 * s;
    R.beginPath(); for (const x of STREET_X) { R.moveTo(ox + x * s, oy); R.lineTo(ox + x * s, oy + h); } for (const z of STREET_Z) { R.moveTo(ox, oy + z * s); R.lineTo(ox + w, oy + z * s); } R.stroke();
  },
};
