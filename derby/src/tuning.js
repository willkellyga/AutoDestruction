// Every number that sets how the demo plays, in one place, so upgrades and timed battles can change them later
// without touching the driving or fighting code. Lengths are town voxels (a quarter metre), speeds voxels a second.

// ---- bodies: what a car is built on ----------------------------------------------------------------------------
// hp: health. top: top speed forwards. back: top speed in reverse. accel: how fast it gets there. turn: how fast it
// turns at speed (radians a second). grip: how quickly sideways sliding dies away (lower drifts more). mass: who
// wins when two cars meet. ram: how hard its nose hits walls and cars (1 = normal).
export const BODIES = {
  scrapper: { name: 'Scrapper', type: 'hatch', hp: 160, top: 92, back: 34, accel: 70, turn: 2.5, grip: 7.5, mass: 1.0, ram: 1.0 },
  bruiser: { name: 'Bruiser', type: 'sedan', hp: 110, top: 84, back: 30, accel: 58, turn: 2.2, grip: 6.5, mass: 1.15, ram: 1.1 },
  runner: { name: 'Runner', type: 'hatch', hp: 80, top: 98, back: 34, accel: 72, turn: 2.6, grip: 6.0, mass: 0.85, ram: 0.9 },
  cruiser: { name: 'Cruiser', type: 'police', hp: 130, top: 88, back: 32, accel: 62, turn: 2.3, grip: 7.0, mass: 1.1, ram: 1.0 },
};

// ---- guns ------------------------------------------------------------------------------------------------------
// fx: which effect in units/src/fx.js it fires. rate: shots a second. dmg: health a direct hit takes. splash and
// reach: health taken by cars nearby, out to reach voxels. wall: how big a hole a hit knocks in a building (0 for
// none). carve: how many of a car's cubes a hit knocks off. heat: how long a burst can last before it must cool
// (seconds); reload: seconds between shots for one-at-a-time weapons.
export const GUNS = {
  mg: { name: 'Machine gun', fx: 'mg', rate: 11, dmg: 2.6, wall: 0.85, carve: 0.75, spread: 0.6, range: 260 },
  chain: { name: 'Chain gun', fx: 'chain', rate: 16, dmg: 2.2, wall: 0.9, carve: 0.75, spread: 0.8, range: 260 },
  rockets: { name: 'Rockets', fx: 'rocket', reload: 1.1, salvo: 2, gap: 0.14, dmg: 22, splash: 18, reach: 16, wall: 5.2, carve: 3.2, range: 320 },
  cannon: { name: 'Cannon', fx: 'cannon', reload: 1.6, salvo: 1, dmg: 34, splash: 14, reach: 14, wall: 6, carve: 3.6, range: 340 },
};

// ---- loadouts: a body plus its guns (and paint). Upgrades will edit these. --------------------------------------
export const PLAYER = { body: 'scrapper', paint: 'orange', primary: 'mg', secondary: 'rockets', armour: 1 };
// the rival drivers, in the order they join; later waves draw from the end of the list
export const RIVALS = [
  { name: 'Rust Bucket', body: 'bruiser', paint: 'maroon', primary: 'mg' },
  { name: 'Nitro Nell', body: 'runner', paint: 'teal', primary: 'mg' },
  { name: 'Grinder', body: 'bruiser', paint: 'green', primary: 'chain' },
  { name: 'Blue Fury', body: 'runner', paint: 'blue', primary: 'mg', secondary: 'rockets' },
  { name: 'The Sheriff', body: 'cruiser', paint: 'police', primary: 'mg', secondary: 'cannon' },
  { name: 'Silver Shark', body: 'bruiser', paint: 'silver', primary: 'chain', secondary: 'rockets' },
  { name: 'Black Widow', body: 'runner', paint: 'black', primary: 'chain', secondary: 'rockets' },
  { name: 'Cream Puff', body: 'cruiser', paint: 'cream', primary: 'mg', secondary: 'cannon' },
];

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
// The demo has no time limit yet. Waves: each wave sends `count` rivals; when they are all wrecked the next comes.
export const ROUND = {
  waves: [{ count: 3 }, { count: 4 }, { count: 5 }, { count: 6 }, { count: 8 }],
  respawnPlayer: 3,   // seconds after the player is wrecked before the next car
  wreckStays: 18,     // seconds a wreck lies in the street before it crumbles
  timeLimit: 0,       // seconds; 0 for none (timed battles come later)
};

// ---- rival drivers -----------------------------------------------------------------------------------------------
export const AI = {
  see: 230,           // how far they can spot a target
  shoot: 190,         // how far they open fire from
  aimErr: 4.2,        // voxels of wobble in their aim
  dmg: 0.4,           // their guns do this share of the damage the player's do (so a wave is a fair fight)
  turretTurn: 3.2,    // radians a second their guns can swing
  reaction: 0.45,     // seconds before they start shooting at a target they have just seen
  infight: 0.25,      // share of the time a rival picks on another rival instead of the player
  ramRange: 46,       // closer than this they floor it and ram
};
