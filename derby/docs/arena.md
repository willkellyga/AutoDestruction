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

The arena has been laid out twice. The first layout was a racing-style loop, 450 by 320 voxels, round a sweeper in the
middle, for waves of rivals. It was too small, and it was asked to feel more like a demolition derby pit, keeping the
traps and pickups. At the same time the arena became the game's free-for-all (below). The second layout is described here.

The floor is 672 by 440 voxels inside the ring (168 by 110 metres), with corners of radius 100. That is about 287,000
square voxels, twice the first layout's 142,000. Crumbletown's world (512 by 416) could not hold that, so the arena
stands on New York's world (1024 by 1024: `src/flags.js`), with none of the city built.

1. **A pit, not a loop.**
   - The middle is an open bowl of churned mud, 476 by 252, with nothing standing in it. It is the contested centre
     (Crossout's "direction for those who want to get into battle"), and the place to ram.
   - The set pieces stand round the edge and in the corners. So the middle stays open, and every trap is somewhere to
     shove a rival into.
   - A rival going after a far target goes by way of the middle of the pit (`ai.js`), so the fights keep coming back to it.
   - The ring holds cars in. Concrete barriers and tyre walls are `'barrier'` bodies, which cars bounce off and only
     rockets wear down. hazards.js `bounds` holds cars in where the barrier has been blown open.
2. **Size.** The floor is twice the first layout, for eight cars at once. End to end takes about eight seconds at full
   speed, and across about five. The small-map lesson above still holds, so other things keep the fights coming: the
   open middle that rivals pass through, eight cars instead of a wave of three to six, and spawn spots no more than a
   few seconds' drive from the middle. The first cars meet about two and a half seconds into a match. All the dressing stands outside the ring and uses none of the floor: the stands, the
   booth, the depot, the crane and the towers.
3. **A set piece in every part of the arena** (`src/hazards.js`). Each one warns before it hurts, shows on the radar, and
   stands at the edge of the pit, where cars get shoved.

   | Set piece | Where | What changed from the first layout |
   |---|---|---|
   | **Sweeper** | The north-west corner, under its frame and the big screen | Moved out of the middle. Same blades (14 to 46 out, a turn every 12 seconds), the strike in its eye, scrap among its blades |
   | **Hammers** | The middle of each long side, hung from a TV gantry reaching out over the floor | Each swings out from the wall across the first sixty voxels of floor. The two are out of step |
   | **Flame jets** | Four round each of the north-east and south-west corners | Four a corner instead of three, each 30 long |
   | **Magnet** | The east end, from the crane over the fuel depot | Same pull (48 voxels) into the barrels round its nitro, with the tanker beside it |
   | **Press and belts** | The west end, against the wall, with a belt either side of it along the wall | The belts carry cars along the wall into the press. The announcer's booth stands over it |
   | **Barrels** | The fuel depot (round the magnet's nitro and at the tanker's ends) and the boneyard | As before: they blow up when shot or rammed |
   | **Boost strips** | Two on each long side, pointing into the pit | They launch a car from the wall towards the middle |
   | **The boneyard** | The south-east corner | New: loose wrecks and stacks of tyres to hide among (`'wall'` bodies a fast car smashes through) |

4. **A super weapon: the Hammerdown strike** (`src/pickups.js`, kind `super`).
   - It sits in the sweeper's eye, as before. It comes up 30 seconds into a match, again 70 seconds after it is taken,
     and a second after a show event starts.
   - It works as before: three marked cars, a ring that follows each one and then holds still, and the blow. In the
     free-for-all a rival that takes it does not mark the player first (in the other modes it still does).
5. **The show changes the arena** (hazards.js `show`).
   - 35 seconds in, and every 45 seconds after that, the announcer calls one of three events for 15 seconds:
     **Hammer time!**, **Fire in the hole!** or **Spin cycle!**. Each works as in the first layout, and the strike comes
     up in the eye.
   - The radar is framed in the event's colour.
6. **Bait** (`src/pickups.js`). Every pickup is at the edge, next to a set piece:
   - Repair kits: under each hammer, and on the press's pad.
   - Nitro: under the magnet, in the boneyard, and on each long side between a boost strip and the hammer.
   - Overcharge: in each flame corner, and in the boneyard.
   - The strike is in the sweeper's eye. Scrap sits among its blades, for the player alone (`rivals: false`).
7. **Rivals use the set pieces too** (`steerClear` in hazards.js, called from `ai.js`).
   - Rivals keep out of a hazard while it is dangerous, as before, and the route grid shuts over it.
   - In the free-for-all, a rival with no car near takes in a pickup on its way, one nearer than its target that no
     other car is after (`ai.js`). That brings the fighting out to the edges, where the set pieces are.
8. **Landmarks.** Each end and each corner looks different:
   - North-west: the sweeper's frame and the big screen.
   - North-east and south-west: the flame corners, in red and white concrete.
   - The other two corners: tyre walls, with wrecked cars stacked three high behind them. South-east: the boneyard.
   - West: the press, and the announcer's booth with the HAMMERDOWN sign on its roof.
   - East: the yellow crane and its MAGNET board, the KRANKO FUEL tanks, and the tanker.
   - Over the middle: the scoreboard on four cables from the floodlight towers. It shows the clock and the top three on
     all four faces (hazards.js `scoreboard`).
   - The floor is painted to match:
     - dark mud in the pit, with puddles and ruts, and HAMMERDOWN written faintly across it;
     - lighter dirt round the edge;
     - each set piece's own paint (as before), chevrons on the boost strips, and a ring in its colour round each pickup.
9. **Sight lines and cover.** A derby pit is open on purpose: the other cars are the cover. What there is stands at the
   edges: the boneyard's wrecks and tyres, the tanker and the depot's barrels. The guns reach across the pit, so ramming
   decides most fights. A match's wrecks are mostly rams and gunfire in the pit, and 3% to 10% are by the map.
10. **Symmetry.**
    - The long sides are laid out twice, turned half way round the middle: the stands, the gantries and their hammers,
      the boost strips, and the two flame corners.
    - The ends and the other two corners differ (press and booth against crane and magnet; sweeper against boneyard), so
      you can tell where you are.
11. **Height without ramps.** Things hang overhead, higher than any car: the scoreboard, the hammers from the gantries'
    arms, the sweeper's drum and screen, the magnet, and the press's arm.
12. **A television show.**
    - Grandstands full of crowd along both long sides, each with a HAMMERDOWN board and sponsors on its roof.
    - The booth, the floodlights, the TV gantries with their cameras, the scoreboard, and the announcer's events.
    - Sponsor boards, all made up: KRANKO OIL, BOLTZ, GRIT TYRES, FIZZBANG, LUGNUT, AMPED, CH 6 LIVE, MEGAWATT,
      DENTS R US, SCRAPCO.
13. **Spawns.** There are 17 spots round the edge of the pit and a few in it, each facing the middle and clear of the
    hazards. In the free-for-all a wrecked car comes back at one of the three spots furthest from every live car.
14. **Light to run.**
    - The bigger world costs memory: on the test machine the page's renderer used about 0.5 to 0.8 GB while playing (the
      race, on the same world, about 1.25 GB). The floor's chunk meshes are built the first time something chews into a chunk, so this
      grows a little over a match.
    - Every set piece is a few meshes, not voxels, so nothing is rebuilt when it moves.
    - On phones (`api.TOUCH()`), the flames, sparks and dust spawn about a third as many particles, and the floor is
      painted at half the detail.

## The free-for-all (`src/modes/brawl.js`)

The game has three modes on its start card: the race (Manhattan Circuit), zombie survival (Camp Deadfall), and the arena.
The arena is the free-for-all. (Crumbletown's waves are still there at `?map=town`.)

- **Eight cars.** You and seven rivals, of three builds (`BRAWL.tiers`). Every car is out for every other.
- **Three minutes** (`BRAWL.time`, or `ROUND.timeLimit` when that is set). A toast warns at 30 seconds, and a banner
  at 10. The clock is on the HUD and on the scoreboard.
- **Back in three seconds.** A wrecked car comes back at the free spawn spot furthest from everyone. For 2.5 seconds it
  blinks, and nothing can hurt it: main.js `damage()` skips a car with its `shield` up, and rivals leave it alone. So
  nobody is wrecked again on the spot. A wreck lies in the pit for a few seconds, then crumbles.
- **Most wrecks wins.** A wreck by the map counts for whoever hit that car in the last six seconds. The HUD shows your
  wrecks, the clock, and your place against the leader.
- **The results card** ranks everyone by wrecks (cars level on wrecks share a place). It pays scrap by place (400, 250,
  160, 110, 80, 60, 40, 20), on top of the 100 a wreck that is paid as it happens. The garage is open from the start card
  and the results card, not during a match.
- **How rivals pick a target** (`ai.js` `pickAny`):
  - Any car will do. A near one is likelier, and one that other rivals are already after is less likely. So the fights
    spread out instead of everyone piling on one car.
  - A car whose shield is up is passed over unless there is nothing else.
  - Four times in ten, a rival goes after whoever hit it in the last six seconds.

## What testing taught us

### The first layout

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

### The pit (the second layout, with the free-for-all)

We ran whole three-minute matches with the player's car driven by the rivals' AI, so it fought like a ninth driver
(with the player's full-strength guns). The coverage figure is the share of the open floor, in cells 16 voxels
across, that some live car drove through.

- **Rivals stayed in the middle.** At first, rivals picked the nearest car and went for far ones by way of the pit. The
  fighting stayed in a band across the middle, and the cars reached only 50% of the floor. The ends and corners went
  almost unvisited, and nobody took an overcharge all match. Now a rival with no car near takes in a pickup on its way
  (`ai.js` `forage`). That brought coverage to 65% to 74% and pickups taken from 24 to 62 to 71 a match, with no
  fewer wrecks.
- **The catch fence.** A fence of posts and rails stood on top of the long straights' barriers. With a car pinned to
  the wall, the chase camera sat behind the barrier, and the fence's one-voxel rails slipped between the points that
  main.js tests for walls (every 1.5 voxels), so the view was through bars. The fence is gone. The barrier is 8 high,
  and the camera rises over it.
- **The opening.** All eight cars meet in the first few seconds, and the first hit lands about 2.5 seconds in. The
  damage to the cars' models (rebuilt on every hit) makes the first second or two the slowest frames of a match.
- **Memory.** A long match's memory climbs and falls but does not run away. What it keeps is the floor's chunk meshes
  (one for each 16 by 16 chunk anything has chewed into), and a wreck held for a while by a mine it dropped (up to
  45 seconds).
- **Results** of four matches (the first before rivals took in pickups):

  | | Wrecks a minute | Coverage | Longest stall | Wrecked within 40 voxels of its spawn | Wrecked under 6 s after coming in | Pickups taken |
  |---|---|---|---|---|---|---|
  | Before | 34 | 50% | none | (not measured) | 15 | 24 |
  | After, 1 | 35 | 65% | about 2 s | (not measured) | 10 | 67 |
  | After, 2 | 29 | 67% | about 2 s | none | 5, all 138 or more voxels from where it came in | 62 |
  | After, 3 (with drifting and sturdier buildings merged) | 29 | 74% | about 2.5 s | none | 4, all 89 or more voxels from where it came in | 71 |

  - A stall is a live car, with no other car within 34 voxels and its shield down, that moves less than 6 voxels in
    1.5 seconds or more. Rivals that hold the handbrake now really slide (since drifting was merged), and that made no
    real difference to the stalls. The 2.5 seconds was one rival backing out from beside the tanker.
  - The wrecks spread across the cars. In the last match, rivals made 4 to 11 wrecks each and were wrecked 8 to 14
    times; the AI-driven player made 29. A car lived about 12 seconds between wrecks (the median).
  - Between 3% and 10% of a match's wrecks were by the map (a hammer, the press, the flames, the sweeper or the magnet).
  - No page errors.
