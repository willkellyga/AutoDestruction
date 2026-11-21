// Every number that sets how the game plays, in one place, so upgrades and timed battles can change them later
// without touching the driving or fighting code. Lengths are town voxels (a quarter metre), speeds voxels a second.

// The cars themselves (bodies, guns, armour, wheels, engines, gadgets, what each costs and how a build adds up) are in
// parts.js, which the garage reads.

// ---- crashing ----------------------------------------------------------------------------------------------------
export const CRASH = {
  smash: 26,        // faster than this a car smashes through what is in front of it; slower it is stopped
  hole: 4.2,        // radius of the hole a car punches at the smash speed ...
  holeK: 0.035,     // ... and how much bigger it gets for every voxel a second faster
  slow: 260,        // a car loses all its speed after knocking out this many voxels (less for fewer)
  wallHurt: 0.05,   // health lost for every voxel a second over `smash` when a car is stopped dead by a wall
  carHurt: 0.32,    // health a car takes for every voxel a second it is hit at by another car
  ramShare: 0.35,   // the share of that the car doing the ramming takes itself
  kick: 1.0,        // how hard cars bounce off each other
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
