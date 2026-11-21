# Hammerdown Arena: design note

A short look at how car combat games and arena shooters lay out their maps, what traps and set pieces they put in them,
and how Hammerdown Arena (`src/maps/arena.js`, with `src/pickups.js` and `src/hazards.js`) uses each idea. We took the
principles and not the layouts: every name, sign and shape on the map is our own.

## What other games do

1. **Cars need room and a loop.** Bungie's map design notes say vehicles "are fast and need plenty of room to be fun",
   and describe an outer loop that lets players move round the map and choose when to fight
   ([Bungie, map design](https://www.jmeiners.com/shamans/papers/art/bungie_map_design.pdf)). Too many dead ends "do not
   give a good loop for combat"
   ([Game Developer, combat level design pt 2](https://www.gamedeveloper.com/design/engaging-level-design-for-combat-pt-2)).
   Leave out narrow gaps where vehicles get stuck, and make spaces wider for the less precise controls on phones
   ([Game Developer, maps that fit the mechanics](https://gamedeveloper.com/design/designing-maps-that-complement-game-mechanics)).
2. **Keep it small enough that fights keep happening.** When Luxoflux made the levels smaller for Vigilante 8, fights
   happened far more often ([Wikipedia, Vigilante 8](https://en.wikipedia.org/wiki/Vigilante_8)). Crossout's arena map is
   small, and its cover is laid out to "encourage quick encounters" ([Crossout diary 111](https://www.crossout.net/en/diary/111/)).
   Mario Kart 8's battle mode played on racing tracks, which were "long and winding". Deluxe brought in purpose-built
   arenas that keep players close together
   ([Kotaku](https://kotaku.com/mario-kart-8-switch-makes-battle-mode-so-much-better-1794448420)).
   The Twisted Metal team missed "really intense, smaller arena-type levels"
   ([Game Informer](https://gameinformer.com/b/news/archive/2010/12/15/david-jaffe-and-scott-campbell-talk-twisted-metal.aspx)).
3. **An empty arena is disorienting, so give it landmarks.**
   - Super Mario Kart's first battle arena had no obstacles, and "after 5 minutes you'd get really dizzy". The team added
     walls to make it easier to find your way round
     ([Nintendo Life](https://www.nintendolife.com/news/2016/06/miyamoto_and_the_super_mario_kart_team_on_drifting_battle_mode_and_creating_tension_on_the_track)).
   - Bungie hangs a landmark where it can be seen from almost anywhere, so players know where they are.
   - Battle Stadium in Mario Kart 8 Deluxe has different statues at its two ends, and each side carries its own brands
     ([Super Mario Wiki](https://www.mariowiki.com/Battle_Stadium)).
   - High Ground in Halo 3 grew from "a giant wall for no reason"
     ([PC Gamer](https://www.pcgamer.com/uk/what-made-halo-3s-high-ground-a-great-map-according-to-the-people-who-made-it)).
4. **A contested centre.** In the Crossout diary, "the center of the map provides a direction for those who want to get
   into battle as soon as possible", and the centre is exposed to fire from all round. One MY.GAMES map builds its
   geometry "around a central zone where players meet"
   ([MY.GAMES, top-down shooter level design](https://medium.com/my-games-company/top-down-shooter-level-design-how-map-design-supports-game-mechanics-6ae39fdd095d)).
5. **Break the sight lines with cover.**
   - Splitting the space up cuts down long sight lines (Game Developer pt 2), and the views across a map should be
     limited, so that no one spot commands it (Bungie).
   - The share of cover to open ground sets the range of the fighting. Cover must be tall enough to block the guns, and
     wide enough to shield against splash damage (Game Developer, mechanics).
   - Under a high camera, keep cover low and put tall things at the edges. Cover that can be destroyed opens the map up
     as the match goes on (MY.GAMES).
6. **Put pickups where they pull players into risk.**
   - Bungie places power items to pull players into the areas that shape the flow, puts them across open ground, and
     says "make the player earn it".
   - In Twisted Metal, health is "the mother of all pickups" (Game Informer), and pickups scattered about give players a
     reason to move
     ([GameSpot](https://www.gamespot.com/twisted-metal-2012/reviews/twisted-metal-review-6350421/)).
   - Vigilante 8 has wrenches that repair damage.
   - In ShockRods, players asked for pickups that "vacuum towards you when you drive close to them"
     ([Stainless Games](https://www.unrealengine.com/en-US/developer-interviews/stainless-games-explains-how-to-design-a-modern-vehicular-combat-game)).
7. **Hazards and an arena that changes.**
   - Twisted Metal's Black Rock Stadium is built to be dangerous, with spiked balls, electric arcs and lava (GameSpot).
   - Vigilante 8's stages have features that players can set off (Wikipedia).
   - Jaffe wants a level that "evolves and changes as you play".
   - We found no design writing on warning players before a hazard hurts. Destruction AllStars' Gridfall shows it in
     practice (see the traps below), and it is our own rule.
8. **Symmetry.** A symmetric layout gives every side "equal conditions" (MY.GAMES). The landmarks that tell you where you
   are must still differ: Battle Stadium's two ends, and High Ground's deliberate lopsidedness.
9. **Height on a flat map.** Cars kept to a flat plane are predictable, and this "limits the options for level design"
   (Stainless Games). Other games use slopes (Crossout) or overpasses and ramps (Twisted Metal). Our cars cannot climb,
   so height has to be used in other ways.
10. **Make it a show.** Destruction AllStars is "a spectacular prime-time sport for dangerous drivers", with the crowd's
    roar and the flash of cameras
    ([GamesRadar](https://gamesradar.com/destruction-allstars-brings-the-spirit-of-destruction-derby-into-the-next-generation-for-ps5)).
    Jaffe calls Twisted Metal: Black's narrow grey-and-brown palette a mistake, and wants each level to have its own
    colours.
11. **Spawns.** Start players away from the enemy, facing the way they should go (Game Developer pt 2), and close enough
    to get back into the fight quickly (MY.GAMES).
12. **Keep it light.** Stainless kept its maps lean so they would run on phones.

## Traps and set pieces in other car combat games

The first version of the arena got the layout right but played "fine but not very interesting". So a second pass looked
at what these games put into their arenas to hurt, help and surprise the drivers, rather than at how they lay them out.

**Twisted Metal**

- **Construction Yard** (Twisted Metal 4) is the closest thing to a junkyard derby.
  - Two conveyor belts carry cars into flamethrowers.
  - A crane in the middle can pick up a rival and drop it into the flames.
  - Barrels marked "DANGER" blow up on contact.
  - Green sludge pits catch fire when napalm or a blast hits them.
  - Source: [Twisted Metal wiki, Construction Yard](https://twistedmetal.fandom.com/wiki/Construction_Yard).
- **Shock Therapy** (Small Brawl) is a laboratory full of traps that the players set off.
  - A pickup electrifies the whole floor.
  - Acid drips on cars that drive under it.
  - Jars fall when a shelf is shot.
  - Charged bulbs roll down a ramp.
  - Burners along the wall light up when shot.
  - Source: [Twisted Metal wiki, Shock Therapy](https://twistedmetal.fandom.com/wiki/Shock_Therapy).
- **Twisted Metal 2** changes its maps during play.
  - In Paris, C4 brings the top of the Eiffel Tower down across the river. It becomes a bridge to rooftops with weapons
    and health ([Game Informer](https://www.gameinformer.com/b/features/archive/2013/11/26/moments-blowing-up-the-eiffel-tower-in-twisted-metal-2.aspx)).
  - In Los Angeles, a lightning pickup and a few smashed generators send a lightning blast out in every direction.
  - Antarctica "regularly has large chunks of it fall off"
    ([Hardcore Gamer](https://hardcoregamer.com/features/graveyard/graveyard-twisted-metal-2/176106/)).
- **Freeway** (Twisted Metal: Black).
  - A train runs round the map, and an explosive timed right as it crosses brings the bridge down.
  - A crane that is shot drops a crate.
  - Traffic gets in the way of shots.
  - Source: [Twisted Metal wiki, Freeway](https://twistedmetal.fandom.com/wiki/Freeway).
- **Monaco** has racing cars going round its track, and a building that a remote bomb turns into a ramp
  ([Twisted Metal wiki, Monaco](https://twistedmetal.fandom.com/wiki/Monaco)).
- **Twisted Metal (2012).**
  - Black Rock Stadium is built to be dangerous, with "huge spiky balls", electric arcs and lava pools
    ([GameSpot](https://www.gamespot.com/twisted-metal-2012/reviews/twisted-metal-review-6350421/)).
  - The campaign has an electric cage that "teleports around the map and drains your health"
    ([GamesRadar](https://www.gamesradar.com/twisted-metal-review/)).

**Mario Kart battle courses**

- **Thwomp Desert.** A quicksand pit slowly drags karts to the middle, and item boxes near the middle tempt drivers in.
  A giant Thwomp crashes down at fixed intervals, and its shockwave pushes everyone away
  ([Super Mario Wiki](https://www.mariowiki.com/Thwomp_Desert)).
- **Chain Chomp Wheel.** The whole floor is a wheel that never stops turning. A Chain Chomp rolls round it the other way
  and flattens whatever it meets, and the item boxes in the hub hold the best item
  ([Super Mario Wiki](https://mariowiki.com/Chain_Chomp_Wheel)).

**Destruction AllStars**

- **Gridfall.** The floor falls away as the match goes on. Glowing yellow outlines mark the pieces that are about to
  drop, and red marks the holes ([TheGamer](https://www.thegamer.com/destruction-allstars-gridfall-mode-guide/)).
- **Carnado.** You bank your points by driving into a tornado
  ([PlayStation Blog](https://blog.playstation.com/2020/11/05/your-first-look-at-destruction-allstars-game-modes)).
- **GameSpot's review.** Chases run "up the walls, around bottom pits, and through giant buzzsaws". But "a tight turn is
  a more effective trap than something that looks wild and deadly"
  ([GameSpot](https://gamespot.com/reviews/destruction-allstars-review/1900-6417640/)). A hazard has to sit where the
  driving is.

**Rocket League**

- **Dropshot.** The ball breaks the floor open, and the hole closes again after a goal
  ([PCGamesN](https://www.pcgamesn.com/rocket-league/rocket-leagues-new-dropshot-mode-is-volleyball-for-cars-in-an-evolving-destructible-arena)).
- **Rumble.** Power-ups are handed out at random on a timer. They include a Boot that kicks a rival's car, a
  Magnetizer, a Tornado that sweeps up cars, and a Swapper that trades places with a rival
  ([Epic Games](https://www.epicgames.com/help/rocket-league-c-202300000001622/gameplay-c-202300000001682/what-is-rumble-mode-in-rocket-league-a202300000014075)).

**The others**

- **Vigilante 8.** Each stage has features that the players set off, such as the missiles and planes on the Area 51
  level ([Wikipedia](https://en.wikipedia.org/wiki/Vigilante_8)). 2nd Offense keeps these. It adds pickups that change
  how a car crosses terrain, such as hover pods and skis
  ([Wikipedia](https://en.wikipedia.org/wiki/Vigilante_8:_2nd_Offense)).
- **Carmageddon: Max Damage** has over 90 power-ups in barrels, from ejecting a driver to springs and spikes. Its maps
  rely on pedestrians and odd buildings more than on traps ([TheSixthAxis](https://www.thesixthaxis.com/?p=264126)).
- **Death Rally.** The spikes and mines are bought for the car, not set in the track. The tracks have money bonuses to
  pick up ([Wikipedia](https://en.wikipedia.org/wiki/Death_Rally)).
- **Wreckfest 2.** The Scrapyard hurts through its layout: narrow runs, and "the constant risk of getting sideswiped
  into the stacks of discarded cars" ([Operation Sports](https://www.operationsports.com/all-wreckfest-2-courses-ranked)).
- **Gas Guzzlers Extreme** has mines and smoke among its weapons, and pickups for ammunition and damage boosts
  ([GameWatcher](https://www.gamewatcher.com/reviews/gas-guzzlers-extreme-review/8871)).
- **Not found.** In this pass we found nothing specific about the traps in Crossout's brawls, Interstate '76, Roadkill
  or Full Auto.

### What they have in common

1. **A big moving thing in the middle** that everyone has to deal with: the Thwomp, the wheel and its Chomp, the spiky
   balls, the crane.
2. **Traps with a rhythm**, which a driver can learn and use against rivals: the Thwomp's beat, the burners, the
   flamethrowers at the end of the belts.
3. **Things that move cars** as well as hurt them: belts, quicksand, the shockwave, the crane, the Tornado.
4. **Bait.** The best pickup sits in the worst place: the boxes in the quicksand, the item in the wheel's hub, the
   health on the Paris rooftops.
5. **A map that changes during the match**: Antarctica's falling chunks, Gridfall's floor, the Paris bridge, the
   electric cage, Rumble's timed power-ups.
6. **A super weapon on the map**: Shock Therapy's floor-electrifying pickup, and the Los Angeles lightning.
7. **Clear warnings.** Gridfall's yellow, then red, is the plainest example.

### What works on flat ground

Our cars never leave the floor.

- **Works:** anything that sweeps, swings, slams, burns, pulls or carries along the floor.
  - Blades and things that roll round.
  - Crushers, flame jets and belts.
  - A zone that pulls cars in.
  - Barrels, an electric floor, and a zone of danger that moves about.
  - Timed events, and a super weapon on the map.
- **Does not work:** jumps, ramps, rooftops, bridges, falling off edges, or a floor that drops away. The cars can't go up
  or fall, so these would only be for show.
- **Teleporters** would work. On a map this small they would mostly confuse.
- **Jump pads.** We would not fake one.
  - A short boost with a camera bounce would leave the car's wheels and shadow on the floor.
  - The car would still hit walls, and blades would still hit it at ground level.
  - It would look like a glitch, not a jump.
  - The boost strips do the same job honestly.
  - If cars ever get a height (a shadow that drops away, and collisions that know about height), a pad would be worth
    trying.

## How Hammerdown Arena uses them

The arena is a floor about 450 by 320 voxels (113 by 81 metres) inside a barrier wall. Stands rise on the north and
south sides. Race control stands at the west end, and the fuel depot with a tower crane at the east end.

1. **Loop, no dead ends.**
   - A wide loop runs round inside the wall. It is 60 voxels wide on the straights and 78 at the ends. Its corners are
     round, with a radius of 72, well over a car's turning circle at speed (about 48).
   - A lap is about 1,200 voxels, or 15 seconds at full speed.
   - The infield opens onto the loop all round. Every piece of cover is a short wall or an L that opens towards the
     middle, so there is nothing to drive into and get stuck in.
   - No set piece closes the loop. Each one sits across or beside the racing line and leaves a way round or through.
   - The route-finder keeps rivals' lines six voxels clear of walls.
   - Anything a car can smash its way into is packed solid, so a breach is a dent and not a trap: the containers, the
     tanker's tank and the press's base.
   - The wall holds cars in even after rockets have blown it open: hazards.js `bounds`.
2. **Size.** Across the infield takes three or four seconds at speed, so a wave of rivals is never far off. The stands,
   race control, the depot and the crane all stand outside the floor and use none of it.
3. **A set piece in every part of the arena** (`src/hazards.js`, usable by any map). Each one warns before it hurts,
   shows on the radar, and is placed where the driving is, not off in a corner.

   | Set piece | Where | Taken from | Warning | What it does |
   |---|---|---|---|---|
   | **Sweeper** | The middle | Chain Chomp Wheel, Black Rock's spiky balls | Always visible: a red wedge on the floor runs ahead of each blade, the blade's lamps blink, and its saw grows louder as it nears | Three blades turn low over the floor from 14 to 46 voxels out, one turn every 12 seconds. A blade hits for 20 and throws the car on and out of the ring. The eye inside it is still and safe |
   | **Hammers** | Under each gantry, across both straights | The Thwomp's beat | Latched up at one side for 2.2 seconds. For the last second its lamps blink, it beeps and shudders | It swings across the lane in 1.3 seconds, latches on the far side, and comes back. A hit at full swing does 34 and knocks the car across the lane with the head. The two are out of step |
   | **Flame jets** | Three in the wall of each corner | Construction Yard's flamethrowers, Shock Therapy's burners | A second of pilot flame, sparks and a hiss | Each burns 26 voxels across the corner for 2.4 seconds, at 32 a second. Two opposite corners fire at a time, each corner's three in the order the traffic reaches them |
   | **Magnet** | Hung from the crane over the fuel depot (east) | Thwomp Desert's quicksand, Construction Yard's crane | It rests 6 seconds, then hums for 1.6 seconds with an alarm while blue rings run in across the floor | For 3.6 seconds it drags every car within 48 voxels toward the middle, into the barrels round the nitro. It holds the cars it gets, at 7 a second, and drops them with a clang. A car flooring it from the edge gets away |
   | **Press and belts** | The west lane | Construction Yard's belts | Lamps, an alarm and a shudder for a second | Two belts on the inside line carry cars into the press. It slams down for 75 |
   | **Barrels and boost strips** | The depot and the straights | | | As before: barrels blow up when shot or rammed, and the boost strips give a burst of speed |

4. **A super weapon: the Hammerdown strike** (`src/pickups.js`, kind `super`).
   - It sits in the sweeper's eye, so taking it means timing a run between the blades. It first comes up 30 seconds into
     a round. After it is taken it comes back in 70 seconds, or sooner if a show event starts.
   - It locks on to the three nearest cars within 320 voxels. A pink ring follows each one for a second, then holds
     still for 0.4 seconds, and the strike comes down: 55 at the middle, falling to nothing 16 voxels out, on top of the
     blast.
   - Driving out of the ring in time dodges it. A rival that takes the strike always marks the player first.
5. **The show changes the arena** (hazards.js `show`).
   - 35 seconds into a round, and every 45 seconds after that, the announcer calls an event. A banner, a siren and
     thunder start it.
   - For 15 seconds one set of hazards goes wild, and the strike comes up in the eye:
     - **Hammer time!** The hammers swing almost nonstop (they hold 0.55 seconds, warn for 0.45, swing in one), and the
       press slams more often.
     - **Fire in the hole!** All twelve jets burn for the whole event, with flames 30% longer.
     - **Spin cycle!** The sweeper turns twice as fast and hits 30% harder. The magnet rests only 1.6 seconds, and pulls
       40% longer and 25% harder.
   - The radar is framed in the event's colour and shows its name and the seconds left.
   - This is the map changing in play (Antarctica, Gridfall, Rumble's timer) with no floor that drops away.
6. **Bait** (`src/pickups.js`).
   - The strike is in the sweeper's eye.
   - Scrap sits among the sweeper's blades. It is for the player alone: rivals never go for it (`rivals: false`).
   - A repair kit sits under each hammer and under the press.
   - Nitro is under the magnet, among the barrels, with two more in the cover. Overcharge (fast reloads) is in the cover.
   - Each pickup glows and spins over a ring painted in its colour, and comes back after 14 to 30 seconds.
   - Rivals make for a repair kit when they are under 45% health, and grab any other pickup they are about to pass.
7. **Rivals use the set pieces too** (`steerClear` in hazards.js, called from ai.js).
   - Each kind of hazard says where it is dangerous and when. A rival heading through one is sent round it:
     - It crosses a hammer's lane only while the head is up.
     - It times its way into the sweeper's eye between blades, and drives out of the eye just behind a blade.
     - It drives out of a magnet's reach, and out of a jet's flame sideways.
     - It leaves the press's pad by the nearest open side.
   - The map's route grid shuts over each hazard while it is dangerous, and opens again after.
   - Rivals still get caught: rammed or shoved into a set piece, or passing a jet or the magnet just as it comes on. So
     the player's way to use the set pieces is to time them, and to knock rivals into them.
8. **Landmarks.**
   - The middle: the sweeper, under a steel frame that carries the four-sided big screen (HAMMERDOWN, LIVE, CH 6) and the
     trophy, which can be seen from everywhere.
   - The west end has the press, its belts and race control. The east end has the fuel depot, its red barrels and the
     KRANKO FUEL tanks, and the yellow crane with its MAGNET board.
   - The north side has blue seats and the television gantry. The south side has red seats, the start gantry with its
     lights, and the chequered line. Each gantry has its hammer.
   - The floor is painted to match:
     - a dark asphalt loop, a dirt infield, and red and white kerbs;
     - a steel deck with a hazard band round the sweeper, and a target in its eye;
     - a red HAMMER zone under each hammer, soot and hazard bars at the jets, and the MAGNET ring with arrows.
9. **Sight lines and cover.**
   - A concrete barrier stands across each straight's view of the middle. It is a `'barrier'` that cars bounce off, and
     only rockets wear it down.
   - Between the loop and the middle there are tyre walls and stacked shipping containers. These are `'wall'` bodies, so
     a fast car smashes through them, and the infield opens up as a wave goes on.
   - The cover is 11 to 14 voxels high, taller than a car's roof (7 to 11) but low under the chase camera.
   - The tall things (stands, floodlights, the crane and the gantry pillars) stand at the edges. The frame's four legs
     stand just outside the sweeper.
10. **Symmetry.**
    - The floor is laid out twice, turned half way round the middle, so each side has the same cover, pickups, hammer and
      pair of jet corners.
    - The ends differ: the press and repair kit at the west, the magnet and nitro at the east. So do the two stands (blue
      and red). That is how you tell where you are.
11. **Height without ramps.** Things hang overhead, higher than any car:
    - the hammers from the gantries, and the sweeper's drum from the frame;
    - the magnet from the crane's jib, and the press arm over the west lane, which comes down.
12. **A television show.**
    - The announcer's events, and stands full of crowd and flags.
    - Four floodlight towers, a TV gantry with cameras, a start gantry with lights, and the big screen.
    - Sponsor boards, all made up: KRANKO OIL, BOLTZ, GRIT TYRES, FIZZBANG, LUGNUT, AMPED, CH 6 LIVE, MEGAWATT.
13. **Spawns.**
    - 14 spots spread evenly round the loop, each facing clockwise along it.
    - A rival comes in far from the player (`pickSpot`), never nose to a wall or straight in the player's sights.
14. **Light to run.**
    - About 368,000 voxels and 179 bodies, against the town's 532,000 and 511.
    - Every set piece is a few meshes, not voxels, so nothing is rebuilt when it moves.
    - On phones (`api.TOUCH()`), the flames, sparks and dust spawn about a third as many particles.

## What testing taught us

Every set piece was tested on its own (32 checks: does it warn first, hurt what it should, push the way it should, and
leave alone what it shouldn't). We also ran long rounds with six to eight rivals: the cars were made unbreakable, and the
player hopped round the arena every six seconds so that the rivals chased it everywhere.

- **Hollow solids.** A hollow press column or container was chewed open by rockets or rammed open. It became a box a car
  drove into and could not turn round in. These are now packed solid.
- **The press's pad.** It stopped short of its column, so a car held out of the pad was pushed into the column. The pad
  now runs up to the column, and cars are never pushed out on that side.
- **The sweeper's edge.** Rivals grazed the blade tips as they went round. Several changes fixed it:
  - they now keep 9 voxels clear of the ring;
  - the route grid shuts 11 out from the ring;
  - the frame's legs stand well outside it;
  - a hit throws a car outward more than along;
  - the eye was widened to 14, so a car fits in it with room to spare.
- **Crawling past containers.** The route-finder took the first clear step instead of the furthest, so rivals crept
  past the cover a cell at a time. It now takes the furthest point it can see that is clear of walls and hazards.
- **Rivals in the blades.** Rivals drove into the sweeper for the scrap among its blades. That scrap is now bait for
  the player alone.
- **The camera.** The chase camera rides 23 to 28 voxels up behind the car. The sweeper's drum and beams and the
  magnet first hung at 21 to 27, so the camera passed through them. They now hang above 30. A pickup's beam fades
  out as the camera comes up to it, so the camera never sits inside a wall of light.
- **Results.** We ran three three-minute rounds with eight rivals:
  - Rivals reached 71% to 84% of the floor (the first arena: 84%). The parts they reached least were the west end, round
    the press and belts, and the south-west corner. Rivals keep out of those while they are live.
  - In two rounds the longest any rival stood still was 2.5 and 3.5 seconds; the 3.5 was a rival held by the magnet. In
    the third, one rival was pressed into the south concrete wall for about eight seconds before it worked free.
  - All three events came round in every round, and every set piece hurt rivals.
  - There were no page errors.
