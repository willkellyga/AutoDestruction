# Hammerdown Arena: design note

A short look at how car combat games and arena shooters lay out their maps, and how Hammerdown Arena
(`src/maps/arena.js`, with `src/pickups.js` and `src/hazards.js`) uses each idea. We took the principles and not the
layouts: every name, sign and shape on the map is our own.

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
   - We found no good source on telegraphing hazards in this pass. Warning before a hazard hurts is our own rule.
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

## How Hammerdown Arena uses them

The arena is a floor about 450 by 320 voxels (113 by 81 metres) inside a barrier wall. Stands rise on the north and
south sides, race control stands at the west end, and a fuel depot at the east end.

1. **Loop, no dead ends.**
   - A wide loop runs round inside the wall. It is 60 voxels wide on the straights and 78 at the ends. Its corners are
     round, with a radius of 72, well over a car's turning circle at speed (about 48).
   - A lap is about 1,200 voxels, or 15 seconds at full speed.
   - The infield opens onto the loop all round. Every piece of cover is a short wall or an L that opens towards the
     middle, so there is nothing to drive into and get stuck in.
   - The route-finder keeps rivals' lines six voxels clear of walls and keeps a margin round the plinth.
   - Anything a car can smash its way into is packed solid, so a breach is a dent and not a trap: the containers, the
     tanker's tank, the press's base and the plinth.
   - The wall holds cars in even after rockets have blown it open: hazards.js `bounds`.
2. **Size.** Across the infield takes three or four seconds at speed, so a wave of rivals is never far off. The stands,
   race control and the depot are all outside the floor and use none of it.
3. **Landmarks.**
   - The middle: the trophy, and a four-sided big screen 16 to 20 metres up (HAMMERDOWN, LIVE, CH 6), which can be seen
     from everywhere.
   - The west end has the press and race control.
   - The east end has the fuel depot: red barrels, the tanker and the KRANKO FUEL tanks.
   - The north side has blue seats and the television gantry. The south side has red seats, the start gantry with its
     lights, and the chequered line.
   - The floor is painted to match: a dark asphalt loop, a dirt infield and red and white kerbs.
4. **Contested centre.**
   - The plinth is ringed by fire grates, in four quarters. Opposite pairs take turns to warn and then burn.
   - Two of the three repair kits sit in that ring: the best pickup is in the most dangerous place.
   - The middle is open, so it can be shot at from the cover all round it.
5. **Sight lines and cover.**
   - A concrete barrier stands across each straight's view of the middle. It is a `'barrier'` that cars bounce off, and
     only rockets wear it down.
   - Between the loop and the middle, each half has a tyre yard (an L of tyre stacks) and an L of shipping containers,
     one stacked on top. These are `'wall'` bodies, so a fast car smashes through them, and the infield opens up as a
     wave goes on.
   - The cover is 11 to 14 voxels high, taller than a car's roof (7 to 11) but low under the chase camera.
   - The tall things (stands, floodlights, the gantry pillars) stand at the edges.
6. **Pickups** (`src/pickups.js`, usable by any map that lists `pickups`).
   - Repair kits: two in the fire ring, and one under the press.
   - Nitro: one between the depot's barrels, and two in the containers' corners.
   - Overcharge (fast reloads): one in each tyre yard.
   - Scrap: on the racing line under each gantry.
   - Each glows and spins over a ring painted in its colour, and comes back after 14 to 30 seconds (the floor ring
     fills as it does).
   - A car picks one up by driving through it. The catch box is generous, so a near miss counts.
   - Rivals make for a repair kit when they are under 45% health, and grab any other pickup they are about to pass.
7. **Hazards** (`src/hazards.js`). Each one warns before it hurts, so a driver can learn its rhythm and lead rivals into
   it.
   - The grates flicker and hiss for a second, then burn for 2.6 seconds.
   - The press waits, flashes its lamps, sounds its alarm and shudders for a second, then slams down for 75 damage. It
     holds cars out of its pad while it is down.
   - The barrels blow up when shot or rammed, set off the ones beside them, and come back later.
   - Rivals route round a quarter of the grates that is warning or burning. A rival chasing the player in plain sight
     still follows them straight in.
8. **Symmetry.** Everything on the floor is laid out twice, turned half way round the middle, so each side has the same
   cover and pickups. The ends differ (press and repair at the west, depot and nitro at the east), and so do the two
   stands (blue and red). That is how you tell where you are.
9. **Height without ramps.**
   - Things hang over the lanes, higher than any car: the gantries over both straights, and the press arm over the west
     lane, which comes down.
   - Boost strips on the two straights give a burst of speed in place of a jump.
   - The stands rise twelve rows at the edges.
10. **A television show.**
    - Stands full of crowd and flags, four floodlight towers, and a TV gantry with cameras.
    - A start gantry with lights, and the big screen.
    - Sponsor boards, all made up: KRANKO OIL, BOLTZ, GRIT TYRES, FIZZBANG, LUGNUT, AMPED, CH 6 LIVE, MEGAWATT.
    - A strip of lights on the wall's cap, blue on the north and red on the south.
11. **Spawns.**
    - 14 spots spread evenly round the loop, each facing clockwise along it.
    - A rival comes in far from the player (`pickSpot`), never nose to a wall or straight in the player's sights.
12. **Light to run.**
    - About 372,000 voxels and 176 bodies, against the town's 532,000 and 511.
    - Big pieces are cut into small tiles, so a hit only makes its own piece check whether it still stands.
    - The hazards and pickups are meshes, not voxels, so nothing is rebuilt when they move.

## What testing taught us

Long runs with six rivals, cars made unbreakable and the player moved round the arena, showed three ways a rival could
get stuck:

- **Hollow solids.** A hollow plinth, press column or container was chewed open by rockets or rammed open, and became a
  box a car drove into and could not turn round in. These are now packed solid. The plinth is steel, the toughest
  material.
- **Hugging corners.** Rivals cut so close to the round plinth that they scraped it and stuck. Waypoints now need a line
  six voxels clear either side, and the route grid keeps a margin round the plinth.
- **The press's pad.** It stopped short of its column, so a car held out of the pad was pushed into the column. The pad
  now runs up to the column, and cars are never pushed out on that side.
