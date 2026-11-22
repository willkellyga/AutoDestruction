// Every number that sets how the game plays, in one place, so upgrades and timed battles can change them later
// without touching the driving or fighting code. Lengths are town voxels (a quarter metre), speeds voxels a second.

// The cars themselves (bodies, guns, armour, wheels, engines, gadgets, what each costs and how a build adds up) are in
// parts.js, which the garage reads.

// ---- crashing ----------------------------------------------------------------------------------------------------
// (how hard a car must hit a building to break through it is in BUILDINGS below)
export const CRASH = {
  slow: 260,        // a car loses all its speed after knocking out this many voxels (less for fewer)
  bump: 13,         // a car stopped by a wall faster than this (voxels a second, square into the wall) is hurt ...
  wallHurt: 0.05,   // ... losing this much health (times 4) for every voxel a second over `bump`
  carHurt: 0.32,    // health a car takes for every voxel a second it is hit at by another car
  ramShare: 0.35,   // the share of that the car doing the ramming takes itself
  kick: 1.0,        // how hard cars bounce off each other
};

// ---- the buildings -----------------------------------------------------------------------------------------------
// How much punishment the buildings take, on every map. The destruction itself is Monster Mayhem's (src/sim.js, used as
// it is); these scale what the derby's cars, guns, rockets and wrecks ask of it, and how its fire and its rules for
// what still stands behave on these pages (sturdy.js). Lamp posts, bins, fences and rubble go down as easily as ever,
// and the blasts on the cars and the zombies are the same size as before. The map's own set pieces (fuel tanks,
// barrels, the Hammerdown strike, the horde breaking the base's wall) are left as they were.
// [old] is the value before this block, or the town's own where the derby had none: setting every knob to it gives back
// the old feel, apart from the glancing-hit and wall-easing rules in vehicle.js.
export const BUILDINGS = {
  // driving into them (vehicle.js)
  smash: 40,        // [26] a car must meet a wall faster than this, square into it, to break through; slower it is
                    // stopped, and at a glancing angle it slides along (only its speed square into the wall counts)
  hole: 3.4,        // [4.2] radius of the hole a car punches at the smash speed (times its build's ram) ...
  holeK: 0.03,      // [0.035] ... and how much bigger it gets for every voxel a second faster
  stuck: 0.6,       // [0] seconds a car can sit wedged in a wall (turned into one, shoved in) before it digs itself out
  // the guns (main.js): a round that strikes a wall knocks out the block it struck ...
  gun: 0.8,         // [1] ... in a blast this share of the gun's `wall` across (under 1: just that block) ...
  gunHit: 0.5,      // [0.7] ... this share of the time
  // explosions (sturdy.js boom): the flash, the fire, the scorch and the blast on cars and zombies are the full size;
  shell: 0.7,       // [1] rockets, shells and mines break buildings out to this share of their reach ...
  wreck: 0.5,       // [1] ... and a wrecked car's blast out to this share
  tough: 1.5,       // [1] the blocks at the edge of that reach hold this many times as well as in the town's explosions
  glass: 0.7,       // [1] windows burst out to this share of the town's reach
  ignite: 0.5,      // [1] an explosion starts this share of the fires the town's would
  // what still stands (the town's support rules, src/sim.js checkBody)
  slack: 5,         // [0] a wall bridges a hole this many blocks wider each side than the town's own 4 before what is
                    // over the hole falls (a car-sized hole no longer drops the strip of wall over it to the roof)
  carry: 0.7,       // [1] a storey counts as needing this share of the load-bearing blocks it was built with: it gives
                    // way with about 68% of them gone at one height (the town's: 55%)
  // fire
  spread: 0.35,     // [1] how readily fire spreads from block to block, as a share of the town's
  burnCap: 2000,    // [5000] the most blocks alight at once
  char: 0.8,        // [about 0.5] share of the burnt-through walls, floors and roofs left standing as charred blocks
};

// ---- the round -------------------------------------------------------------------------------------------------
// No time limit yet. Waves: each wave sends `count` rivals; when they are all wrecked there is a break (time for the
// garage) and then the next comes.
export const ROUND = {
  waves: [{ count: 3 }, { count: 4 }, { count: 5 }, { count: 6 }, { count: 8 }],
  breakTime: 9,       // seconds between waves
  respawnPlayer: 4,   // seconds after the player is wrecked before the next car
  wreckStays: 18,     // seconds a wreck lies in the street before it crumbles
  timeLimit: 0,       // seconds; 0 for none (timed battles come later)
};

// ---- rival drivers -----------------------------------------------------------------------------------------------
export const AI = {
  see: 230,           // how far they can spot a target
  shoot: 190,         // how far they open fire from
  aimErr: 4.2,        // voxels of wobble in their aim
  dmg: 0.4,           // their guns do this share of the damage the player's do (so a wave is a fair fight)
  hp: 0.75,           // and their cars have this share of the health the same build gives the player
  ram: 0.6,           // and their rams hurt the player this much of what the player's hurt them
  turretTurn: 3.2,    // radians a second their guns can swing
  reaction: 0.45,     // seconds before they start shooting at a target they have just seen
  infight: 0.25,      // share of the time a rival picks on another rival instead of the player
  ramRange: 46,       // closer than this they floor it and ram
  mend: 0.45,         // below this share of their health they make for a repair kit, on maps that have them (pickups.js)
};
