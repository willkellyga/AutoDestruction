# Auto Destruction (first playable demo)

A car combat demo built on Monster Mayhem's town. You drive a gun car round Crumbletown, smash through buildings and wreck waves of rival cars. The buildings, the destruction (blasts, glass, fire, collapsing storeys, rubble), the parked cars and buses, the gun effects and the sound mixer are Monster Mayhem's own code, imported as it is, with its tuning unchanged. Nothing in `src/`, `units/` or `civilian/` was edited for this.

## Play
`npm install` at the repo root, then `node derby/build.mjs`. Open `derby/dist/auto-destruction.html` in Chrome, Edge, Safari or Firefox. It is one self-contained file.

- WASD or the arrow keys: drive. Space: handbrake, for drifting round corners.
- Mouse: aim the turret (click the view to capture the mouse, Esc to let it go). Wheel: camera distance.
- Left click (or J): machine gun. Right click (or F, K): rockets.
- Drive fast into a wall to smash through it; lamps, bins, rubble and parked cars go down at any speed.
- M: sound on or off.

## Source (`derby/src`)
- `tuning.js`: every number that sets how it plays. `BODIES` (health, speed, grip, weight, ram strength), `GUNS`, the player's loadout `PLAYER`, the rival drivers `RIVALS`, `CRASH` (what it takes to smash through a wall, how much crashes hurt), `ROUND` (waves, respawn) and `AI`. Upgrades will edit loadouts here; `ROUND.timeLimit` is the hook for timed battles.
- `vehicle.js`: a combat car. The body is a street car from `civilian/src/cars.js` (with a `Race` clip that turns the wheels and leans the body), and a bolt-on kit of our own (a gun on a turning mount, a rocket pod, a striped ram plow), on the same cube kit as the army's units. Arcade driving with sliding, and the crash rules: probes round the car feel for voxels, and a car going faster than `CRASH.smash` knocks a hole with the town's `blast()`.
- `ai.js`: the rival drivers. They follow the street grid to their target, cut straight across when they have a clear run, shoot when their gun is on target, ram when close, back out when stuck, and sometimes go after each other or whoever hit them last.
- `main.js`: the scene and light (as Monster Mayhem's), the town, the parked cars (`src/civilians.js`), the guns (`units/src/fx.js`) and what their hits do (cars lose health and cubes, buildings lose voxels, rockets go off with the town's `explode()`), car against car crashes, the camera, the HUD, the radar and the waves.
- `page.html`: the HUD and the start card. `build.mjs`: bundles everything into one page.

## Not done yet
Upgrades and a garage, timed battles, touch controls, a bigger map (`src/city.js` should work, as the build takes the same map flags as `build.py`), and sound for the guns beyond the army's clips. Scrap is counted already (kills, wave bonuses, buildings flattened) for the upgrades to spend.

## Credits
The car bodies, town, destruction, effects and sounds are Monster Mayhem's (see the repo's `README.md` and `LICENSES.md`). The kit, the driving, the rivals and the HUD are new. Inspired by vehicle combat games in general; the names, art and look are our own.
