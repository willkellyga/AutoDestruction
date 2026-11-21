# Auto Destruction

A car combat game built on Monster Mayhem's town. You build a gun car in the garage, drive it round Crumbletown, smash through buildings and wreck waves of rival cars for scrap, then spend the scrap on better parts. The buildings, the destruction (blasts, glass, fire, collapsing storeys, rubble), the parked cars and buses, the gun effects and the sound mixer are Monster Mayhem's own code, imported as it is, with its tuning unchanged. Nothing in `src/`, `units/` or `civilian/` was edited for this.

## Play
`npm install` at the repo root, then `node derby/build.mjs`. Open `derby/dist/auto-destruction.html` in Chrome, Edge, Safari or Firefox. It is one self-contained file.

- WASD or the arrow keys: drive. Space: handbrake, for drifting round corners.
- Mouse: aim the turret (click the view to capture the mouse, Esc to let it go). Wheel: camera distance.
- Left click (or J): the roof gun. Right click (or F, K): the heavy weapon.
- Shift: the gadget (nitro or the repair kit), if one is fitted.
- G: the garage, from the start screen, after being wrecked, or in the break between waves.
- Drive fast into a wall to smash through it; lamps, bins, rubble and parked cars go down at any speed.
- M: sound on or off.

## The garage
A car is a body plus a part in each slot. The idea follows the big car-building brawlers, made simpler for a browser game:

- **Body** (Scrapper hatchback, Bruiser four-door, Viper muscle car, Hauler pickup) sets health, speed and handling, and how much **Power** the car has.
- Every **roof gun** (machine gun, minigun, scattergun), **heavy weapon** (rocket pod, cannon, mine layer), **front** (bumper, ram plow, spike ram, buzz saws) and **gadget** (nitro, repair kit) uses some Power. A build can't use more Power than its body has, so a better body is what lets you carry more.
- **Armour** (light, steel plates, battle cage) adds health, and **wheels** (street, off-road, racing slicks, monster tyres) and **engines** (turbo, big V8) change grip, speed and pull. Armour and big wheels add weight, and weight costs speed and acceleration.
- **Paint**: 14 colours, a second colour and 6 patterns (stripes, flames, camo, checkers, rust), free.

Scrap comes from wrecking cars (100), clearing waves (50 a wave), three wrecks in a row (75) and flattening buildings. A new garage starts with 400. Scrap, the parts bought and the build are kept in the browser (localStorage). Every part shows on the car: the armour is bolted on plates and window bars, the wheels and guns are their own models.

The rivals are built from the same parts, better ones each wave.

## Source (`derby/src`)
- `parts.js`: the garage's catalogue. Every part, what it does and costs (`PARTS`), the Power and weight rules and the stats a build adds up to (`statsOf`), the save, and the rivals' builds for each wave.
- `carmodel.js`: the cars, built in code at sixteenth-metre cubes (twice as fine each way as the street cars, about four times the cubes on every surface). One builder lays out each body from a few numbers (length, width, belt line, roof, glass, axles) and colours it by what each cube is and which faces show: lamps and grille, tail lamps and plate, door shut lines and handles, glass and pillars, wheel arches and flares. Wheels, turret, guns, heavy weapons and rams are parts of their own that turn, spin and get blown off.
- `vehicle.js`: a combat car: arcade driving with sliding, and the crash rules (probes round the car feel for voxels, and a car going faster than `CRASH.smash` knocks a hole with the town's `blast()`).
- `garage.js`: the garage panel (stat bars, the Power meter, a tab per slot, a card per part: try it on, then buy and fit it).
- `audio.js`: the game's own recorded sounds, placed in the street (see `assets/sfx/CREDITS.md`).
- `ai.js`: the rival drivers. They follow the street grid to their target, cut straight across when they have a clear run, shoot when their gun is on target, ram when close, drop mines on whoever is chasing, back out when stuck, and sometimes go after each other or whoever hit them last.
- `tuning.js`: crashing (`CRASH`), the waves (`ROUND`) and the rivals (`AI`).
- `main.js`: the scene and light (as Monster Mayhem's), the town, the parked cars (`src/civilians.js`), the guns (`units/src/fx.js`) and what their hits do, saws, mines and gadgets, car against car crashes, the garage camera, the HUD, the radar and the waves.
- `page.html`: the HUD, the garage panel and the start card. `build.mjs`: bundles everything into one page.

## Not done yet
Timed battles (`ROUND.timeLimit` is the hook), touch controls for driving (the garage already works by touch), a bigger map (`src/city.js` should work, as the build takes the same map flags as `build.py`), and parts being shot off a car before it is wrecked.

## Credits
The town, destruction, effects, gun sounds and the sound mixer are Monster Mayhem's (see the repo's `README.md` and `LICENSES.md`). The car sounds are cut from the Sonniss GDC game audio bundle (`assets/sfx/CREDITS.md`). The cars, the garage, the driving, the rivals and the HUD are new. Inspired by vehicle combat games in general; the names, art and look are our own.
