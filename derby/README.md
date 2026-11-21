# Auto Destruction

A car combat game built on Monster Mayhem's town. You build a gun car in the garage, pick one of four maps, wreck rival cars for scrap, then spend the scrap on better parts. The buildings, the destruction (blasts, glass, fire, collapsing storeys, rubble), the gun effects and the sound mixer are Monster Mayhem's own code, imported as it is, with its tuning unchanged. Nothing in `src/`, `units/` or `civilian/` was edited for this.

## Play
`npm install` at the repo root, then `node derby/build.mjs`. Open `derby/dist/auto-destruction.html` in Chrome, Edge, Safari or Firefox. It is one self-contained file.

- WASD or the arrow keys: drive. Space: handbrake, for drifting round corners.
- Mouse: aim the turret (click the view to capture the mouse, Esc to let it go). The aim pulls onto a rival near the crosshair, and the crosshair turns red when it has one. Wheel: camera distance.
- Left click (or J): every gun (main gun, roof guns, door guns, arc coil). Right click (or F, K): every heavy weapon (heavy weapon slot, roof rockets, door rockets).
- Shift: the gadget (nitro or the repair kit), if one is fitted.
- G: the garage, from the start screen, after being wrecked, or in the break between waves (in the race and on the base, only from the start screen and the results).
- R: in the race, back to the last checkpoint if you are lost or going the wrong way (or tap the hint).
- Drive fast into a wall to smash through it; lamps, bins and rubble go down at any speed.
- M: sound on or off.
- Phones and tablets (or `?touch=1`): a drive stick on the left (push the way you want to go), and Fire, Rockets, Drift and Nitro buttons on the right. The guns aim themselves at the nearest rival in view.

## Maps
The start card picks a map. Each map comes with its own rules. To open one directly, add `?map=town`, `race`, `base` or `arena` to the page's address.

- **Crumbletown** (`town`, waves): Monster Mayhem's whole town, with its parked cars and buses taken out. Smash through the buildings and wreck each wave of rivals; the garage opens in the break between waves.
- **Bowtie Raceway** (`race`): a figure-of-eight circuit with an at-grade crossover in the middle, raced over 3 laps by 6 cars with the guns on. Checkpoint gates must be passed in order, so cutting gains nothing. A wrecked car (yours too) comes back at its last gate after 2.5 s, so wrecking someone costs them time. Grass and gravel slow you unless you have off-road or monster tyres. Scrap by place (300, 200, 120, 80, 50, 30) on top of 100 for each rival you wreck.
- **Camp Deadfall** (`base`, last one standing): an army base overrun by the dead. You and 5 rivals fight each other while a growing horde claws at every car; there are no second cars, and the last car running wins. Zombies cling on and drag a car down (swerve hard to throw them off), splat under a fast car, and are shredded by saws and blades. At 80 s the horde blows holes in the walls. Scrap for each zombie (5), each car (100) and your place.
- **Hammerdown Arena** (`arena`, waves): built for car combat after a look at how other vehicle combat games design their arenas (`docs/arena.md`). An outer loop that keeps you moving, a trophy plinth in the middle ringed by fire grates, concrete and container cover, a hydraulic press at one end and a fuel depot of explosive barrels at the other, boost strips, and pickups (repair, nitro, overcharge, scrap) placed where you have to take a risk to get them.

## The garage
A car is a body plus a part in each slot. The idea follows the big car-building brawlers, made simpler for a browser game:

- **Body** (Scrapper hatchback, Bruiser station wagon, Viper muscle car, Hauler pickup, Mule panel van) sets health, speed and handling, and how much **Power** the car has.
- Every **main gun** on the turret (machine gun, minigun, scattergun), **roof** weapon (twin guns, rocket rack, arc coil), **door** weapon (a gun or a rocket tube on each door, or blades out of the sills), **heavy weapon** (rocket pod, cannon, mine layer), **front** (bumper, ram plow, spike ram, buzz saws) and **gadget** (nitro, repair kit) uses some Power. A build can't use more Power than its body has, so a better body is what lets you carry more. Roof and door weapons are fixed: they only turn a little either side of straight ahead, so you point the car at what they shoot.
- **Armour** (light, steel plates, battle cage) adds health, and **wheels** (street, off-road, racing slicks, monster tyres) and **engines** (turbo, big V8) change grip, speed and pull. Armour and big wheels add weight, and weight costs speed and acceleration.
- **Paint**: 14 colours, a second colour and 6 patterns (stripes, flames, camo, checkers, rust), free.

Scrap comes from wrecking cars (100), clearing waves (50 a wave), finishing places in the race and on the base, three wrecks in a row (75) and flattening buildings. A new garage starts with 400. Scrap, the parts bought and the build are kept in the browser (localStorage). Every part shows on the car: the armour is bolted on plates and window bars, the wheels and guns are their own models.

The rivals are built from the same parts, better ones each wave.

## Source (`derby/src`)
- `parts.js`: the garage's catalogue. Every part, what it does and costs (`PARTS`), the Power and weight rules and the stats a build adds up to (`statsOf`), the save, and the rivals' builds for each wave.
- `carshapes.js` and `carmodel.js`: the cars, built in code at cubes a third the size of the street cars' (`H = 1/6` of a town unit). Each body takes after a kind of real car, with no makes or badges: an early-80s boxy hot hatch, a mid-70s wood-sided station wagon, a late-60s fastback, a late-70s square-body pickup and an early-80s panel van. `carshapes.js` holds the body shapes and the shared builder that colours each cube by what it is and which faces show (lamps and grille, chrome, shut lines and handles, glass and pillars, arches, wood trim); `carmodel.js` turns a build into parts. Wheels, turret, guns, roof and door weapons, heavy weapons and rams are parts of their own that turn, spin and get blown off.
- `vehicle.js`: a combat car: arcade driving with sliding, the weapons it carries and where their barrels are, and the crash rules (probes round the car feel for voxels, and a car going faster than `CRASH.smash` knocks a hole with the town's `blast()`).
- `garage.js`: the garage panel (stat bars, the Power meter, a tab per slot, a card per part: try it on, then buy and fit it).
- `audio.js`: the game's own recorded sounds, placed in the street, with a few takes of the sounds heard most (see `assets/sfx/CREDITS.md`).
- `ai.js`: the rival drivers. They follow the map's routes to their target, cut straight across when they have a clear run, shoot when their gun is on target, ram when close, drop mines on whoever is chasing, back out when stuck, go for repair kits when hurt, and sometimes go after each other or whoever hit them last.
- `tuning.js`: crashing (`CRASH`), the waves (`ROUND`) and the rivals (`AI`).
- `maps/`: one file per map. `maps/index.js` explains what a map provides (how to build it, the painted ground, where cars start, how rivals find their way, the radar drawing) and picks the map from the start card. `maps/common.js` has the shared pieces, including a grid route-finder for open maps. `maps/racetrack.js` is the race track's maths (the centre line, the racing line, the crossover). A map can also say where the ground is rough (`surface(x, z)`, which tyres scale by their `roughK`) and list pickups and hazards.
- `modes/`: one file per set of rules. `modes/waves.js` explains what a mode provides (start, step, what happens when a car or the player is wrecked, the HUD and the results). `waves.js` is the town and arena's waves, `race.js` the race (with the rivals' race driver in `racer.js`), `survival.js` the last car standing on the base.
- `zombies.js`: the horde. Three looks drawn as one instanced mesh each and posed on the graphics card, a shared route field that steers them all at once, clinging, splatting and dying to guns and blasts. Tuning in `HORDE`.
- `pickups.js` and `hazards.js`: pickups (repair, nitro, overcharge, scrap) and floor hazards (fire grates, the press, explosive barrels, boost strips) for any map that lists them.
- `../docs/arena.md`: what vehicle combat games do with their arenas, with sources, and how Hammerdown Arena uses it.
- `main.js`: the scene and light (as Monster Mayhem's), the map and its rules, the guns (`units/src/fx.js`) and what their hits do, aim assist and the phones' auto-aim, the arc coil, blades, saws, mines and gadgets, the touch controls, car against car crashes, the garage camera, the HUD, the radar and the results card.
- `page.html`: the HUD, the garage panel and the start card. `build.mjs`: bundles everything into one page.

## Not done yet
Timed battles (`ROUND.timeLimit` is the hook), a human playtest of each map's difficulty (the knobs are at the top of each mode file), a bigger map (`src/city.js` should work, as the build takes the same map flags as `build.py`), parts being shot off a car before it is wrecked, and a frame rate check on real phones (wrecking a car now costs 20 to 40 ms in a slow headless browser; `SLAB_WORK` in `units/src/voxpart.js` spreads that over more frames if it shows).

## Credits
The town, destruction, effects and the sound mixer are Monster Mayhem's (see the repo's `README.md` and `LICENSES.md`). The car and weapon sounds are cut from Sonniss's free GDC game audio bundles, the gunfire from real recordings in their older bundles (`assets/sfx/CREDITS.md`). The cars, the garage, the driving, the rivals and the HUD are new. Inspired by vehicle combat games in general; the names, art and look are our own.
