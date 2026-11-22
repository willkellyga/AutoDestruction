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

// ---- drifting ----------------------------------------------------------------------------------------------------
// The handbrake (Space, or Drift on a phone) while steering at speed lets the back out: the car yaws faster than its
// direction of travel follows, so it slides at an angle, and most of the speed the slide would scrub off is kept.
// Steering and throttle hold the angle, steering the other way brings it back, and letting go grips up again over
// `recover`. With the wheel straight the handbrake is a brake. vehicle.js drives it; drift.js draws the smoke, the skid
// marks and the meter. Rivals only drift if their driver holds the handbrake (the town's and the base's do; racers don't).
export const DRIFT = {
  minSpeed: 34,       // voxels a second forwards for the full slide; it fades in from half this
  steerMin: 0.25,     // how far over the steering has to be (0 to 1) to start a slide rather than brake
  holdAngle: 0.12,    // radians: still sliding at least this much keeps a slide going with the wheel straight
  kickIn: 0.1,        // seconds for the back to let go
  recover: 0.45,      // seconds for the grip to come back once the handbrake is let go
  turn: 1.45,         // the car yaws this many times faster with the back out
  follow: 0.2,        // share of that yaw the direction of travel follows at once (1 would be no slide at all)
  rearGrip: 4.1,      // how fast the slide dies away with the back out, a second (the tyres' own grip is about 7)
  power: 0.25,        // full throttle loosens the back this much more, so the throttle holds the angle
  keep: 0.9,          // share of the speed the slide scrubs off that carries on along where the car points
  maxAngle: 0.95,     // radians (about 55 degrees): the most the car slides off its line, so it never spins out
  drag: 0.08,         // how hard the handbrake pulls while sliding (a full brake is 1) ...
  stop: 0.5,          // ... and with the wheel straight, when it stops the car
  // how loose each set of tyres lets the back go (rearGrip is divided by it): more is a bigger angle
  tyres: { street: 1, slicks: 0.7, offroad: 1.2, monster: 1.3 },
  // a slide held at more than `angle` radians for `after` seconds gives a short burst when it ends (twice as long
  // after `after2`): this much more top speed and pull, fading over its last 0.3 s
  boost: { angle: 0.3, after: 1.0, after2: 2.0, time: 0.7, topK: 1.14, accelK: 1.8 },
  camSwing: 0.25,     // share of the slide angle the chase camera swings round towards the way the car is going ...
  camFollow: 1.8,     // ... and how much quicker it keeps up with the car while sliding (it follows at 2.6 a second)
  marks: 1100,        // skid mark pieces kept on the ground (half on phones); the oldest fade out as new ones go down
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
