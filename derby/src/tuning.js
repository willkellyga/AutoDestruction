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
  // A slide held past `angle` radians charges a boost that fires when the slide ends (let go of the handbrake). The
  // longer it is held the bigger it is: three levels, reached after `at` seconds of sliding, each shown by the sparks
  // off the back wheels changing colour (`rgb`) and the meter on the HUD. A burst kicks the car forwards at once by
  // `kick` of its top speed, then gives `topK` more top speed and `accelK` more pull for `time` seconds, fading over
  // the last 0.4 s. [old: one level at 1 s and one at 2 s, no kick, 1.14 top for 0.7 / 1.4 s]
  boost: {
    angle: 0.2,         // radians off the line (about 11 degrees) for the slide to count
    slide: 0.55,        // how far out the back must be (0 to 1)
    at: [0.6, 1.4, 2.4],
    kick: [0.12, 0.2, 0.3],
    time: [0.9, 1.5, 2.2],
    topK: [1.18, 1.28, 1.4],
    accelK: [2.0, 2.4, 2.8],
    rgb: [[1, 0.85, 0.3], [1, 0.42, 0.08], [0.35, 0.62, 1]],   // yellow, orange, blue
    fov: [4, 7, 10],    // degrees the view widens for a moment as it fires
  },
  camSwing: 0.25,     // share of the slide angle the chase camera swings round towards the way the car is going ...
  camFollow: 1.8,     // ... and how much quicker it keeps up with the car while sliding (it follows at 2.6 a second)
  marks: 1100,        // skid mark pieces kept on the ground (half on phones); the oldest fade out as new ones go down
};

// ---- the buildings -----------------------------------------------------------------------------------------------
// How much punishment the buildings take, on every map. The destruction itself is Monster Mayhem's (src/sim.js, used as
// it is); these scale what the derby's cars, guns, rockets and wrecks ask of it, and how its fire and its rules for
// what still stands behave on these pages (sturdy.js). Lamp posts, bins, fences and rubble go down as easily as ever,
// and the blasts on the cars and the zombies are the same size as before. The maps' own set pieces (the barrels, the
// Hammerdown strike, the horde breaking the base's wall) are left as they were.
// [old] is the value before this block, or the town's own where the derby had none: setting every knob to it gives back
// the old feel, apart from the glancing-hit and wall-easing rules in vehicle.js.
export const BUILDINGS = {
  // driving into them (vehicle.js)
  smash: 40,        // [26] a car must meet a wall faster than this, square into it, to break through; slower it is
                    // stopped, and at a glancing angle it slides along (only its speed square into the wall counts)
  chip: 2.2,        // a car can't break into a building (keepout.js); hitting its wall faster than `smash` knocks a dent
                    // this wide in it, bigger by holeK for every voxel a second faster, and some of it falls
  hole: 3.4,        // [4.2] radius of the hole a car punches at the smash speed (times its build's ram) ...
  holeK: 0.03,      // [0.035] ... and how much bigger it gets for every voxel a second faster
  stuck: 0.6,       // [0] seconds a car can sit wedged in a wall (turned into one, shoved in) before it digs itself out
  // the guns (main.js): a round that strikes a wall knocks out the block it struck ...
  gun: 0.8,         // [1] ... in a blast this share of the gun's `wall` across (under 1: just that block) ...
  gunHit: 0.5,      // [0.7] ... this share of the time
  // explosions (sturdy.js boom): the flash, the fire, the scorch and the blast on cars and zombies are the full size;
  shell: 0.7,       // [1] rockets, shells and mines break buildings out to this share of their reach ...
  wreck: 0.5,       // [1] ... and a wrecked car's blast out to this share
  fuel: 0.7,        // [1] ... and what goes up by itself (fuel tanks, propane, drums, the base's helicopters and tanks)
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
  view: 0.95,         // they only shoot at what is in front of them: this far either side of straight ahead (radians;
                      // about what the player's camera shows), or ...
  close: 22,          // ... closer than this, where a car alongside is in plain sight anyway
};

// ---- the arena's difficulty (modes/brawl.js, picked on the start card like the race's) ----------------------------
// Each level scales the rivals' AI numbers above: `aim` their wobble, `reaction` how long they take to open fire,
// `view` how wide they look, `dmg` / `hp` / `ram` what their guns do, how much armour they get and how hard they ram,
// `turn` how fast their guns swing round. `prize` scales the scrap for the place.
export const BRAWL_LEVELS = {
  easy: { name: 'Easy', aim: 1.7, reaction: 2, view: 0.75, dmg: 0.65, hp: 0.8, ram: 0.7, turn: 0.6, prize: 0.75,
    note: 'Easy: the rivals are slow on the trigger, miss a lot and break sooner.' },
  normal: { name: 'Normal', aim: 1, reaction: 1, view: 1, dmg: 1, hp: 1, ram: 1, turn: 1, prize: 1, note: '' },
  hard: { name: 'Hard', aim: 0.55, reaction: 0.55, view: 1.2, dmg: 1.35, hp: 1.3, ram: 1.25, turn: 1.4, prize: 1.5,
    note: 'Hard: the rivals shoot straight, hit hard and take more to wreck. Pays 1.5x.' },
};
const AI0 = { ...AI };
// set the rivals' numbers for a level (the arena calls it as the match starts; every other mode leaves them as they are)
export function useAILevel(L) {
  AI.aimErr = AI0.aimErr * L.aim; AI.reaction = AI0.reaction * L.reaction; AI.view = AI0.view * L.view;
  AI.dmg = AI0.dmg * L.dmg; AI.hp = AI0.hp * L.hp; AI.ram = AI0.ram * L.ram; AI.turretTurn = AI0.turretTurn * L.turn;
}

// ---- zombie survival's difficulty (modes/survival.js) ----------------------------------------------------------
// `count` scales how many of the dead there are on the base at once, `rate` how fast they come in, `speed` their pace,
// `dmg` how hard they claw, `breach` how long until they break through the walls. `prize` scales the scrap at the end.
// Each level keeps its own best time.
export const SURVIVAL_LEVELS = {
  easy: { name: 'Easy', count: 0.7, rate: 0.7, speed: 0.85, dmg: 0.55, breach: 1.5, prize: 0.75,
    note: 'Easy: fewer of them, slower, weaker claws, and the walls hold longer.' },
  normal: { name: 'Normal', count: 1, rate: 1, speed: 1, dmg: 1, breach: 1, prize: 1, note: '' },
  hard: { name: 'Hard', count: 1.25, rate: 1.35, speed: 1.12, dmg: 1.45, breach: 0.7, prize: 1.5,
    note: 'Hard: more of them, faster, clawing harder, and the walls come down sooner. Pays 1.5x.' },
};

// ---- the race's difficulty (modes/race.js, picked on the start card) ---------------------------------------------
// The rivals' cars are tuned to the player's own, the way the big racing games fill a race with cars of the player's
// class: what the player bought changes how they win, not whether there is a race. Each rival gets the top speed and
// pull of the player's car times `speed` (and its grid slot's share of `spread`, the front of the grid quickest), and
// the same turning. How well they drive: `pace` is the share of top speed they hold down a straight (a range: each
// rival draws its own), `grip` how near their car's limit they take a bend, `brake` how hard they count on braking
// (voxels a second, a second: the cars can do about twice 150, so more is later braking). `ease` is the most a rival far
// ahead of the player backs off, `push` the most one far behind finds (the catch-up: none on Hard). `aim` scales the
// wobble in their aim, `prize` the scrap for the place.
export const RACE = {
  levels: {
    easy: { name: 'Easy', speed: 0.92, pace: [0.92, 0.95], grip: [0.76, 0.81], brake: 135, ease: 0.12, push: 0.03, aim: 1.35, prize: 0.75,
      note: 'The rivals\' cars are a bit slower than yours.' },
    normal: { name: 'Normal', speed: 1.0, pace: [0.965, 0.995], grip: [0.83, 0.88], brake: 150, ease: 0.07, push: 0.05, aim: 1, prize: 1,
      note: 'The rivals\' cars are tuned to about yours: some quicker, some slower.' },
    hard: { name: 'Hard', speed: 1.05, pace: [0.99, 1.0], grip: [0.89, 0.93], brake: 165, ease: 0, push: 0, aim: 0.75, prize: 1.5,
      note: 'The rivals\' cars are quicker than yours and driven hard. No catch-up. Pays 1.5x.' },
  },
  spread: [0.04, 0.02, 0, -0.02, -0.04],   // the rivals' grid slots, front to back
  // slipstream, for every car: tucked in behind another within `reach` voxels and `width` across, above `min` speed,
  // up to this much more top speed (`topK`) and pull (`accelK`), most when close behind
  slip: { reach: 40, width: 7, min: 40, topK: 0.06, accelK: 0.3 },
};
