# Licences and credits

Everything that came from outside the project, with where it came from, who made it and its licence. Add a line here when a file, or code adapted from someone else's, enters the repository.

## Code and techniques

| What | Where it is used | Source | Author | Licence |
|---|---|---|---|---|
| three.js | The engine, bundled into every build | https://github.com/mrdoob/three.js | three.js authors | MIT |
| pixelfx effect designs | The Dragon, Jet and Vortex fire breath styles and the Burst, Bubble, Cracks, Wildfire and Bolts radiation pulse styles in `src/main.js`. These were rebuilt in our own block system from the way these pixelfx effects are put together and timed: fire breath, flamethrower, fire tornado, mana burst, EMP blast, ground slam, fire ring and plasma explosion. No pixelfx file is in the repository and none of its code or images is shipped. | https://github.com/patch-gg/pixelfx | Patch (patch-gg). Several of those effects are themselves adapted from MIT-licensed effects by Hugo Duprez (Sprite Fusion), as pixelfx's NOTICE.md records. | MIT |
| qrcode-generator 1.4.4 | `playtest/vendor/qrcode.js`, draws the join code on the playtest server's page. Not part of the game build. | https://github.com/kazuhikoarase/qrcode-generator | Kazuhiko Arase | MIT |

Credit line if one is wanted on screen: "Some effects are based on pixelfx by Patch (MIT)." MIT asks for the copyright notice to stay with copies of the code. We copied no code, so this entry is a courtesy and a record.

## Art and models

See the Credits section of `README.md` for the monster and town. The optional T-rex model is CC0.

<!-- sounds:start -->
## Sound effects and music

Recordings from Freesound.org (https://freesound.org), pulled through its API by tools/sfx/pull.mjs and trimmed, made mono
(sound effects) and levelled for the game by tools/sfx/process.mjs. CC0 1.0 is public domain and needs no credit. CC BY 4.0 /
3.0 needs the author credited: the credits screen or store page should carry the CC BY rows below. Nothing is
non-commercial or Sampling+, and no Freesound ID used in Will's other games is picked (tools/sfx/blocked-ids.json).
The layer clips (crash, debris, sub, scrape loop and the like) are cut by tools/sfx/layers.py from longer Freesound
recordings and from the Sonniss #GameAudioGDC 2026 bundle (https://gdc.sonniss.com/, licence https://sonniss.com/gdc-bundle-license/):
royalty-free in games, no credit needed, no AI training, and the raw bundle files are not to be passed on outside the team
(they are not in this repository; only the cut, levelled clips the game plays are).
Written by tools/sfx/bank.mjs: change the picks and run it again rather than editing this table.

| Clip set | File | Sound | Author | Link | Licence |
|---|---|---|---|---|---|
| roar | assets/sfx/roar_614006.mp3 | Roar3.wav | aarontheonly | https://freesound.org/people/aarontheonly/sounds/614006/ | CC0 1.0 |
| roar | assets/sfx/roar_751713.mp3 | Yeti Roar - Skiing Game - Roar SFX Remix (2 of 2) | el_boss | https://freesound.org/people/el_boss/sounds/751713/ | CC0 1.0 |
| stomp | assets/sfx/stomp_513694.mp3 | impact-stone-heavy.wav | kasparsj | https://freesound.org/people/kasparsj/sounds/513694/ | CC0 1.0 |
| stomp | assets/sfx/stomp_614064.mp3 | Bodyfall | magnuswaker | https://freesound.org/people/magnuswaker/sounds/614064/ | CC0 1.0 |
| quake | assets/sfx/quake_794196.mp3 | kicks bass impacts subs by CVLTIV8R 99.wav | CVLTIV8R | https://freesound.org/people/CVLTIV8R/sounds/794196/ | CC0 1.0 |
| bite | assets/sfx/bite_871149.mp3 | Monsterbite | Robhog | https://freesound.org/people/Robhog/sounds/871149/ | CC0 1.0 |
| bite | assets/sfx/bite_445987.mp3 | Horror / Zombie - Biting on bones | Breviceps | https://freesound.org/people/Breviceps/sounds/445987/ | CC0 1.0 |
| swipe | assets/sfx/swipe_59992.mp3 | Swosh Sword Swing | qubodup | https://freesound.org/people/qubodup/sounds/59992/ | CC0 1.0 |
| hit | assets/sfx/hit_842508.mp3 | Hit_Impact | gulfstreamav | https://freesound.org/people/gulfstreamav/sounds/842508/ | CC0 1.0 |
| hit | assets/sfx/hit_877027.mp3 | Meat Slime Hit Layer 3 | qubodup | https://freesound.org/people/qubodup/sounds/877027/ | CC0 1.0 |
| leap | assets/sfx/leap_475131.mp3 | FX - Swoosh - Super Heavy (for swords, sticks, punches, etc) | bolkmar | https://freesound.org/people/bolkmar/sounds/475131/ | CC0 1.0 |
| skid | assets/sfx/skid_235455.mp3 | Cement_Scrape_short.wav | jcdecha | https://freesound.org/people/jcdecha/sounds/235455/ | CC0 1.0 |
| charge | assets/sfx/charge_744225.mp3 | Swoosh PS 033 | AudioPapkin | https://freesound.org/people/AudioPapkin/sounds/744225/ | CC0 1.0 |
| breath | assets/sfx/breath_683179.mp3 | Fireball | NearTheAtmoshphere | https://freesound.org/people/NearTheAtmoshphere/sounds/683179/ | CC0 1.0 |
| inhale | assets/sfx/inhale_800974.mp3 | Noises - Unhealthy deep breath | Sadiquecat | https://freesound.org/people/Sadiquecat/sounds/800974/ | CC0 1.0 |
| crumble | assets/sfx/crumble_569502.mp3 | Stone Impact Rubble Debris 6 | Sheyvan | https://freesound.org/people/Sheyvan/sounds/569502/ | CC0 1.0 |
| crumble | assets/sfx/crumble_389618.mp3 | Rock Tumble 2.wav | _stubb | https://freesound.org/people/_stubb/sounds/389618/ | CC0 1.0 |
| collapse | assets/sfx/collapse_712918.mp3 | building collapse / demolition | greyfeather | https://freesound.org/people/greyfeather/sounds/712918/ | CC0 1.0 |
| collapse | assets/sfx/collapse_703248.mp3 | Fall debris (crash) | xkeril | https://freesound.org/people/xkeril/sounds/703248/ | CC0 1.0 |
| creak | assets/sfx/creak_506664.mp3 | Wood Creak Single V9 | Rudmer_Rotteveel | https://freesound.org/people/Rudmer_Rotteveel/sounds/506664/ | CC0 1.0 |
| glass | assets/sfx/glass_233605.mp3 | Breaking Glass #3.wav | abstraktgeneriert | https://freesound.org/people/abstraktgeneriert/sounds/233605/ | CC0 1.0 |
| glass | assets/sfx/glass_848290.mp3 | Glass Break 9 | ElevatorFan2020 | https://freesound.org/people/ElevatorFan2020/sounds/848290/ | CC0 1.0 |
| boom | assets/sfx/boom_435414.mp3 | explosion11.wav | V-ktor | https://freesound.org/people/V-ktor/sounds/435414/ | CC0 1.0 |
| boom | assets/sfx/boom_186945.mp3 | cannon_boom5.wav | ReadeOnly | https://freesound.org/people/ReadeOnly/sounds/186945/ | CC0 1.0 |
| crackle | assets/sfx/crackle_422851.mp3 | Fire_Crackle_01.wav | IPaddeh | https://freesound.org/people/IPaddeh/sounds/422851/ | CC0 1.0 |
| rifle | assets/sfx/rifle_804825.mp3 | gun shot | Filmsounduser | https://freesound.org/people/Filmsounduser/sounds/804825/ | CC0 1.0 |
| rifle | assets/sfx/rifle_163460.mp3 | Sniper Shot | LeMudCrab | https://freesound.org/people/LeMudCrab/sounds/163460/ | CC0 1.0 |
| mg | assets/sfx/mg_39071.mp3 | heavy.burst.wav | alienbomb | https://freesound.org/people/alienbomb/sounds/39071/ | CC0 1.0 |
| cannon | assets/sfx/cannon_168707.mp3 | Tank Firing | qubodup | https://freesound.org/people/qubodup/sounds/168707/ | CC0 1.0 |
| launch | assets/sfx/launch_67543.mp3 | bgm-71_tow_missile_launch_1_no_echo.flac | qubodup | https://freesound.org/people/qubodup/sounds/67543/ | CC0 1.0 |
| shell | assets/sfx/shell_350973.mp3 | Boom_C_04 | cabled_mess | https://freesound.org/people/cabled_mess/sounds/350973/ | CC0 1.0 |
| ping | assets/sfx/ping_351369.mp3 | LightBulletPing.mp3 | wilhellboy | https://freesound.org/people/wilhellboy/sounds/351369/ | CC0 1.0 |
| thud | assets/sfx/thud_138481.mp3 | Bullet Blood 4 | JustInvoke | https://freesound.org/people/JustInvoke/sounds/138481/ | CC0 1.0 |
| carboom | assets/sfx/carboom_843247.mp3 | Explosion 1 (Burning Car rec by Ñado) | qubodup | https://freesound.org/people/qubodup/sounds/843247/ | CC0 1.0 |
| crunch | assets/sfx/crunch_807437.mp3 | car crash long 1 | Logicogonist | https://freesound.org/people/Logicogonist/sounds/807437/ | CC0 1.0 |
| crunch | assets/sfx/crunch_33915.mp3 | aluminum11.wav | Necrosensual | https://freesound.org/people/Necrosensual/sounds/33915/ | CC0 1.0 |
| clang | assets/sfx/clang_406562.mp3 | hit - metallic 01.wav | Anthousai | https://freesound.org/people/Anthousai/sounds/406562/ | CC0 1.0 |
| alarm | assets/sfx/alarm_439257.mp3 | Car_Alarm_Sound01.aif | kreationz_100 | https://freesound.org/people/kreationz_100/sounds/439257/ | CC0 1.0 |
| splash | assets/sfx/splash_436792.mp3 | Large Splash | roboroo | https://freesound.org/people/roboroo/sounds/436792/ | CC0 1.0 |
| hiss | assets/sfx/hiss_234782.mp3 | Steam/hiss | wubitog | https://freesound.org/people/wubitog/sounds/234782/ | CC0 1.0 |
| jet | assets/sfx/jet_639839.mp3 | Fighter Jet 3 | sonically_sound | https://freesound.org/people/sonically_sound/sounds/639839/ | CC BY |
| catapult | assets/sfx/catapult_131302.mp3 | release_air_pffft.wav | reg7783 | https://freesound.org/people/reg7783/sounds/131302/ | CC0 1.0 |
| gun | assets/sfx/gun_141447.mp3 | sound_weapon_fire_size_2.wav | odeean | https://freesound.org/people/odeean/sounds/141447/ | CC0 1.0 |
| zap | assets/sfx/zap_77088.mp3 | Laser short 2.wav | Defunct3 | https://freesound.org/people/Defunct3/sounds/77088/ | CC0 1.0 |
| thunder | assets/sfx/thunder_127126.mp3 | SN-Thunder-2.wav | westernsynthetics | https://freesound.org/people/westernsynthetics/sounds/127126/ | CC BY |
| meteor | assets/sfx/meteor_323086.mp3 | meteor fly-by & Impact | LiamG_SFX | https://freesound.org/people/LiamG_SFX/sounds/323086/ | CC BY |
| sizzle | assets/sfx/sizzle_436791.mp3 | Sizzle | roboroo | https://freesound.org/people/roboroo/sounds/436791/ | CC0 1.0 |
| whoosh | assets/sfx/whoosh_523230.mp3 | Hard Swing 1 | magnuswaker | https://freesound.org/people/magnuswaker/sounds/523230/ | CC0 1.0 |
| sub | assets/sfx/sub_1.mp3 | DSGNBass_Bass Drop & Downer Slow 10_344 Audio_Bass Drops & Downers.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| sub | assets/sfx/sub_2.mp3 | EffectiveTrailer_Booms_Vol2_214.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| sub | assets/sfx/sub_3.mp3 | EffectiveTrailer_Booms_Vol2_011.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| sub | assets/sfx/sub_4.mp3 | EffectiveTrailer_Booms_Vol2_075.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| sub | assets/sfx/sub_5.mp3 | DSGNBass_Bass Drop & Downer Medium 04_344 Audio_Bass Drops & Downers.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| thump | assets/sfx/thump_1.mp3 | Big robot footstep 003 (cut by tools/sfx/layers.py) | AudioPapkin | https://freesound.org/people/AudioPapkin/sounds/813054/ | CC0 1.0 |
| thump | assets/sfx/thump_2.mp3 | DinoSteps1.wav (cut by tools/sfx/layers.py) | andysm | https://freesound.org/people/andysm/sounds/77027/ | CC0 1.0 |
| thump | assets/sfx/thump_3.mp3 | DSGNImpt_Metal Hit Thud Thump Low Ring Geofon 1_The Noisery_Moaning Metal.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| thump | assets/sfx/thump_4.mp3 | Bodyfall (cut by tools/sfx/layers.py) | magnuswaker | https://freesound.org/people/magnuswaker/sounds/614064/ | CC0 1.0 |
| thump | assets/sfx/thump_5.mp3 | impact-stone-heavy.wav (cut by tools/sfx/layers.py) | kasparsj | https://freesound.org/people/kasparsj/sounds/513694/ | CC0 1.0 |
| crash | assets/sfx/crash_1.mp3 | Brick Falling.mp3 (cut by tools/sfx/layers.py) | LittleRainySeasons | https://freesound.org/people/LittleRainySeasons/sounds/418861/ | CC0 1.0 |
| crash | assets/sfx/crash_2.mp3 | Wooden Door breaks (cut by tools/sfx/layers.py) | Saladsounds | https://freesound.org/people/Saladsounds/sounds/723974/ | CC0 1.0 |
| crash | assets/sfx/crash_3.mp3 | Brick Falling.mp3 (cut by tools/sfx/layers.py) | LittleRainySeasons | https://freesound.org/people/LittleRainySeasons/sounds/418861/ | CC0 1.0 |
| crash | assets/sfx/crash_4.mp3 | shed_falling_over.wav (cut by tools/sfx/layers.py) | Bibbly10 | https://freesound.org/people/Bibbly10/sounds/652709/ | CC0 1.0 |
| crash | assets/sfx/crash_5.mp3 | house_demo1.wav (cut by tools/sfx/layers.py) | relwin | https://freesound.org/people/relwin/sounds/647371/ | CC0 1.0 |
| crash | assets/sfx/crash_6.mp3 | house_demo1.wav (cut by tools/sfx/layers.py) | relwin | https://freesound.org/people/relwin/sounds/647371/ | CC0 1.0 |
| crash | assets/sfx/crash_7.mp3 | building collapse / demolition (cut by tools/sfx/layers.py) | greyfeather | https://freesound.org/people/greyfeather/sounds/712918/ | CC0 1.0 |
| crash | assets/sfx/crash_8.mp3 | shed_falling_over.wav (cut by tools/sfx/layers.py) | Bibbly10 | https://freesound.org/people/Bibbly10/sounds/652709/ | CC0 1.0 |
| debris | assets/sfx/debris_1.mp3 | Stones Falling (cut by tools/sfx/layers.py) | iwanPlays | https://freesound.org/people/iwanPlays/sounds/567251/ | CC0 1.0 |
| debris | assets/sfx/debris_2.mp3 | Stones Falling (cut by tools/sfx/layers.py) | iwanPlays | https://freesound.org/people/iwanPlays/sounds/567251/ | CC0 1.0 |
| debris | assets/sfx/debris_3.mp3 | Bricks/Stones/Rocks/Gravel Falling (cut by tools/sfx/layers.py) | iwanPlays | https://freesound.org/people/iwanPlays/sounds/567249/ | CC0 1.0 |
| debris | assets/sfx/debris_4.mp3 | Bricks/Stones/Rocks/Gravel Falling (cut by tools/sfx/layers.py) | iwanPlays | https://freesound.org/people/iwanPlays/sounds/567249/ | CC0 1.0 |
| debris | assets/sfx/debris_5.mp3 | rockfall2a.wav (cut by tools/sfx/layers.py) | AlanCat | https://freesound.org/people/AlanCat/sounds/389303/ | CC0 1.0 |
| debris | assets/sfx/debris_6.mp3 | rockfall2a.wav (cut by tools/sfx/layers.py) | AlanCat | https://freesound.org/people/AlanCat/sounds/389303/ | CC0 1.0 |
| metal | assets/sfx/metal_1.mp3 | DSGNImpt_Metal Hit Thud Thump Low Ring Geofon 1_The Noisery_Moaning Metal.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| metal | assets/sfx/metal_2.mp3 | Scrap metal dropping / crashing (cut by tools/sfx/layers.py) | SamsterBirdies | https://freesound.org/people/SamsterBirdies/sounds/587443/ | CC0 1.0 |
| metal | assets/sfx/metal_3.mp3 | Dropping sheet metal (cut by tools/sfx/layers.py) | SamsterBirdies | https://freesound.org/people/SamsterBirdies/sounds/587442/ | CC0 1.0 |
| metal | assets/sfx/metal_4.mp3 | METLImpt_METAL SWING HIT Weapon Swing To Metallic Body Impact And Resonant Tail 01_DDUMAIS_MWP2.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| metal | assets/sfx/metal_5.mp3 | Dropping sheet metal (cut by tools/sfx/layers.py) | SamsterBirdies | https://freesound.org/people/SamsterBirdies/sounds/587442/ | CC0 1.0 |
| groan | assets/sfx/groan_1.mp3 | DSGNTonl_Designed Metal Bowed Screech Tonal Reverb 7_The Noisery_Moaning Metal.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| groan | assets/sfx/groan_2.mp3 | Locked door being forced open.wav (cut by tools/sfx/layers.py) | Talitha5 | https://freesound.org/people/Talitha5/sounds/262538/ | CC0 1.0 |
| groan | assets/sfx/groan_3.mp3 | Metallic Groan (cut by tools/sfx/layers.py) | hinchinbrook | https://freesound.org/people/hinchinbrook/sounds/496836/ | CC0 1.0 |
| groan | assets/sfx/groan_4.mp3 | Metallic groan long.wav (cut by tools/sfx/layers.py) | Crinkem | https://freesound.org/people/Crinkem/sounds/481787/ | CC0 1.0 |
| glassbig | assets/sfx/glassbig_1.mp3 | break-window.mp3 (cut by tools/sfx/layers.py) | Kneeling | https://freesound.org/people/Kneeling/sounds/448004/ | CC0 1.0 |
| glassbig | assets/sfx/glassbig_2.mp3 | Breaking Glass #3.wav (cut by tools/sfx/layers.py) | abstraktgeneriert | https://freesound.org/people/abstraktgeneriert/sounds/233605/ | CC0 1.0 |
| glassbig | assets/sfx/glassbig_3.mp3 | Glass.ogg (cut by tools/sfx/layers.py) | egomassive | https://freesound.org/people/egomassive/sounds/536763/ | CC0 1.0 |
| glassbig | assets/sfx/glassbig_4.mp3 | Glass Break 9 (cut by tools/sfx/layers.py) | ElevatorFan2020 | https://freesound.org/people/ElevatorFan2020/sounds/848290/ | CC0 1.0 |
| glassbig | assets/sfx/glassbig_5.mp3 | Glass Break (cut by tools/sfx/layers.py) | unfa | https://freesound.org/people/unfa/sounds/221528/ | CC0 1.0 |
| rumble | assets/sfx/rumble_1.mp3 | Cracking Earthquake (cracking soil, cracking stone) (cut by tools/sfx/layers.py) | uagadugu | https://freesound.org/people/uagadugu/sounds/222521/ | CC0 1.0 |
| rumble | assets/sfx/rumble_2.mp3 | EARTHQUAKE OR DISTANT SPACE SHUTTLE RUMBLE.WAV (cut by tools/sfx/layers.py) | metrostock99 | https://freesound.org/people/metrostock99/sounds/203281/ | CC0 1.0 |
| rumble | assets/sfx/rumble_3.mp3 | Cinematic Deep Rumble (cut by tools/sfx/layers.py) | swiftoid | https://freesound.org/people/swiftoid/sounds/184313/ | CC0 1.0 |
| rumble | assets/sfx/rumble_4.mp3 | Rumble · loop 10s (cut by tools/sfx/layers.py) | unfa | https://freesound.org/people/unfa/sounds/258339/ | CC0 1.0 |
| boom | assets/sfx/boom_1.mp3 | explosion11.wav (cut by tools/sfx/layers.py) | V-ktor | https://freesound.org/people/V-ktor/sounds/435414/ | CC0 1.0 |
| boom | assets/sfx/boom_2.mp3 | EffectiveTrailer_Booms_Vol2_075.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| boom | assets/sfx/boom_3.mp3 | Muffled Distant Explosion (cut by tools/sfx/layers.py) | NenadSimic | https://freesound.org/people/NenadSimic/sounds/149966/ | CC0 1.0 |
| boom | assets/sfx/boom_4.mp3 | Explosion 1 (Burning Car rec by Ñado) (cut by tools/sfx/layers.py) | qubodup | https://freesound.org/people/qubodup/sounds/843247/ | CC0 1.0 |
| boom | assets/sfx/boom_5.mp3 | EffectiveTrailer_Booms_Vol2_075.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| boom | assets/sfx/boom_6.mp3 | 13 Fireworks_powerful explosions_multiples in a row_near.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| punch | assets/sfx/punch_1.mp3 | FGHTImpt_4 x Punch, Body 02_344 Audio_Cinematic Fight Vol 1.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| punch | assets/sfx/punch_2.mp3 | FGHTImpt_4 x Punch, Body 02_344 Audio_Cinematic Fight Vol 1.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| punch | assets/sfx/punch_3.mp3 | Hit_Impact (cut by tools/sfx/layers.py) | gulfstreamav | https://freesound.org/people/gulfstreamav/sounds/842508/ | CC0 1.0 |
| punch | assets/sfx/punch_4.mp3 | Meat Slime Hit Layer 3 (cut by tools/sfx/layers.py) | qubodup | https://freesound.org/people/qubodup/sounds/877027/ | CC0 1.0 |
| roar | assets/sfx/roar_1.mp3 | Roar3.wav (cut by tools/sfx/layers.py) | aarontheonly | https://freesound.org/people/aarontheonly/sounds/614006/ | CC0 1.0 |
| roar | assets/sfx/roar_2.mp3 | ANMLRept_Large Herbivore Roar 01_344 Audio_Dinosaurs Vol 2.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| roar | assets/sfx/roar_3.mp3 | ANMLRept_T Rex_344 Audio_Dinosaurs.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| roar | assets/sfx/roar_4.mp3 | Yeti Roar - Skiing Game - Roar SFX Remix (2 of 2) (cut by tools/sfx/layers.py) | el_boss | https://freesound.org/people/el_boss/sounds/751713/ | CC0 1.0 |
| bite | assets/sfx/bite_1.mp3 | ANMLRept_Dinosaur Eating Meat 01_344 Audio_Dinosaurs Vol 2.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| bite | assets/sfx/bite_2.mp3 | Monsterbite (cut by tools/sfx/layers.py) | Robhog | https://freesound.org/people/Robhog/sounds/871149/ | CC0 1.0 |
| bite | assets/sfx/bite_3.mp3 | Horror / Zombie - Biting on bones (cut by tools/sfx/layers.py) | Breviceps | https://freesound.org/people/Breviceps/sounds/445987/ | CC0 1.0 |
| swipe | assets/sfx/swipe_1.mp3 | Swosh Sword Swing (cut by tools/sfx/layers.py) | qubodup | https://freesound.org/people/qubodup/sounds/59992/ | CC0 1.0 |
| swipe | assets/sfx/swipe_2.mp3 | FX - Swoosh - Super Heavy (for swords, sticks, punches, etc) (cut by tools/sfx/layers.py) | bolkmar | https://freesound.org/people/bolkmar/sounds/475131/ | CC0 1.0 |
| scrape_loop | assets/sfx/scrape_loop_3.mp3 | Heavy stone door opens 2 (cut by tools/sfx/layers.py) | PostProdDog | https://freesound.org/people/PostProdDog/sounds/578491/ | CC0 1.0 |
| scrape_loop | assets/sfx/scrape_loop_4.mp3 | Dragging a body across a concrete floor 2 (cut by tools/sfx/layers.py) | PostProdDog | https://freesound.org/people/PostProdDog/sounds/578493/ | CC0 1.0 |
| rubble_loop | assets/sfx/rubble_loop_2.mp3 | rockfall2a.wav (cut by tools/sfx/layers.py) | AlanCat | https://freesound.org/people/AlanCat/sounds/389303/ | CC0 1.0 |
| rubble_loop | assets/sfx/rubble_loop_3.mp3 | Foley_Stones_Falls_Debris_Stereo_DR05.wav (cut by tools/sfx/layers.py) | Nox_Sound | https://freesound.org/people/Nox_Sound/sounds/550342/ | CC0 1.0 |
| rumble_loop | assets/sfx/rumble_loop_1.mp3 | EARTHQUAKE OR DISTANT SPACE SHUTTLE RUMBLE.WAV (cut by tools/sfx/layers.py) | metrostock99 | https://freesound.org/people/metrostock99/sounds/203281/ | CC0 1.0 |
| rumble_loop | assets/sfx/rumble_loop_2.mp3 | Cinematic Deep Rumble (cut by tools/sfx/layers.py) | swiftoid | https://freesound.org/people/swiftoid/sounds/184313/ | CC0 1.0 |
| city_loop | assets/sfx/city_loop_1.mp3 | AMBTown_City Courtyard Calm Street Distant Traffic Children Playing 03_ESM_CPS.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| city_loop | assets/sfx/city_loop_2.mp3 | AMBTown_Ambience, Big Town, Streets, Valdemoro, Spain, Daytime, Brush Cutter, Far Traffica, Airplanes, People Activity, Spanish Voices-Stereo_KSL_KS016.wav (cut by tools/sfx/layers.py) | Sonniss #GameAudioGDC 2026 bundle | https://gdc.sonniss.com/ | Sonniss GDC bundle licence: royalty-free, no attribution; the raw files may not be passed on |
| siren_loop | assets/sfx/siren_loop_1.mp3 | Air Raid Request.wav (cut by tools/sfx/layers.py) | hello_flowers | https://freesound.org/people/hello_flowers/sounds/31887/ | CC0 1.0 |
| siren_loop | assets/sfx/siren_loop_2.mp3 | Sirens.wav (cut by tools/sfx/layers.py) | tlabrant1 | https://freesound.org/people/tlabrant1/sounds/658724/ | CC0 1.0 |
| m_a.cannon | assets/sfx/m_a_cannon_a_cannon_3.mp3 | Excalibur howitzer (made from 175430.ogg) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_a.mg | assets/sfx/m_a_mg_a_mg_1.mp3 | Heavy burst (now) (made from 39071.ogg) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_a.rifle | assets/sfx/m_a_rifle_a_rifle_1.mp3 | Gun shot (now) (made from 804825.ogg) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_a.rifle | assets/sfx/m_a_rifle_a_rifle_2.mp3 | Sniper shot (made from 163460.ogg) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_a.rifle | assets/sfx/m_a_rifle_a_rifle_5.mp3 | Gunshot 001 (made from 136766.ogg) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_bite | assets/sfx/m_bite_bite_1.mp3 | Monster bite with crunch (now) (made from bite_1.mp3 + crash_2.mp3) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_c.boom | assets/sfx/m_c_boom_c_boom_5.mp3 | Fireworks blast + metal (made from 13 Fireworks_powerful explosions_multiples in a row_near.wav + 587442.ogg) | Sonniss GDC 2026 | https://gdc.sonniss.com/ | Sonniss GDC bundle licence (royalty-free, no attribution) |
| m_c.boom | assets/sfx/m_c_boom_c_boom_1.mp3 | Car explosion with metal (now) (made from boom_3.mp3 + metal_2.mp3) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_c.crunch | assets/sfx/m_c_crunch_c_crunch_2.mp3 | Car crash (made from 807437.ogg) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_collapse | assets/sfx/m_collapse_collapse_1.mp3 | Layered collapse (now) (made from crash_7.mp3 + sub_2.mp3 + rumble_1.mp3 + debris_3.mp3) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_crumble | assets/sfx/m_crumble_crumble_1.mp3 | Crash and debris (now) (made from crash_3.mp3 + debris_2.mp3) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_crumble | assets/sfx/m_crumble_crumble_2.mp3 | Concrete smash (made from 522099.ogg) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_glass | assets/sfx/m_glass_glass_5.mp3 | Glass crystal fragments (made from GLASMvmt_Whoosh Glass Crystal Fragments Sharp Shards Dry 05_ESM_EMWI.wav) | Sonniss GDC 2026 | https://gdc.sonniss.com/ | Sonniss GDC bundle licence (royalty-free, no attribution) |
| m_glass | assets/sfx/m_glass_glass_r2_2.mp3 | Big window smash, opening hit cut (longer cut) (made from glassbig_1.mp3) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_hit | assets/sfx/m_hit_hit_5.mp3 | Cinematic body punches (made from FGHTImpt_4 x Punch, Body 02_344 Audio_Cinematic Fight Vol 1.wav) | Sonniss GDC 2026 | https://gdc.sonniss.com/ | Sonniss GDC bundle licence (royalty-free, no attribution) |
| m_level | assets/sfx/m_level_level_1.mp3 | Power up, bright (made from DSGNStngr_Power Up Bright Positive Successful Light Saturation Crash Shimmer 05_ESM_AG.wav) | Sonniss GDC 2026 | https://gdc.sonniss.com/ | Sonniss GDC bundle licence (royalty-free, no attribution) |
| m_roar | assets/sfx/m_roar_roar_6.mp3 | Monster roar 3 (Freesound) (made from 614006.ogg) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_swipe | assets/sfx/m_swipe_swipe_2.mp3 | Heavy swing to thud (made from SWSH_SWING IMPACTS Quick Heavy Weapon Swing To Thud Impact Var 01_DDUMAIS_MWP2.wav) | Sonniss GDC 2026 | https://gdc.sonniss.com/ | Sonniss GDC bundle licence (royalty-free, no attribution) |
| m_swipe | assets/sfx/m_swipe_swipe_1.mp3 | Swoosh into crash (now) (made from swipe_1.mp3 + crash_1.mp3) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_wingslice | assets/sfx/m_wingslice_swipe_3.mp3 | Special-move slice (made from DSGNStngr_Action Deploy Units Sword Slice Special Move Layered Swish 04_ESM_TDG.wav) | Sonniss GDC 2026 | https://gdc.sonniss.com/ | Sonniss GDC bundle licence (royalty-free, no attribution) |
| m_quake | assets/sfx/m_quake_stomp_1.mp3 | Layered boom and rubble (now) (made from sub_2.mp3 + thump_1.mp3 + debris_2.mp3) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_step | assets/sfx/m_step_step_r2_1.mp3 | Heavy thud, higher, stone attack (made from thump_2.mp3 + 513694.ogg) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_stomp | assets/sfx/m_stomp_stomp_r2_2.mp3 | Stone slam with punch (made from 513694.ogg + FGHTImpt_Combat Punch Impact Light Hit Delay Crunchy Vintage Quick Smack 05_ESM_AG.wav) | Sonniss GDC 2026 | https://gdc.sonniss.com/ | Sonniss GDC bundle licence (royalty-free, no attribution) |
| m_boom | assets/sfx/m_boom_boom_r2_5.mp3 | Boom C 04 with debris crack (made from 350973.ogg + crash_1.mp3) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_boom | assets/sfx/m_boom_boom_r2_3.mp3 | Firework blast, close (made from 13 Fireworks_powerful explosions_multiples in a row_near.wav) | Sonniss GDC 2026 | https://gdc.sonniss.com/ | Sonniss GDC bundle licence (royalty-free, no attribution) |
| m_boom | assets/sfx/m_boom_boom_r2_2.mp3 | Explosion 11 with a crack on the front (made from 435414.ogg + FGHTImpt_Combat Punch Impact Light Hit Delay Crunchy Vintage Quick Smack 05_ESM_AG.wav) | Sonniss GDC 2026 | https://gdc.sonniss.com/ | Sonniss GDC bundle licence (royalty-free, no attribution) |
| m_a.big | assets/sfx/m_a_big_abig_r2_5.mp3 | Boom C 04 with debris crack (made from 350973.ogg + crash_1.mp3) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_a.big | assets/sfx/m_a_big_abig_r2_3.mp3 | Firework blast, close (made from 13 Fireworks_powerful explosions_multiples in a row_near.wav) | Sonniss GDC 2026 | https://gdc.sonniss.com/ | Sonniss GDC bundle licence (royalty-free, no attribution) |
| m_a.big | assets/sfx/m_a_big_abig_r2_2.mp3 | Explosion 11 with a crack on the front (made from 435414.ogg + FGHTImpt_Combat Punch Impact Light Hit Delay Crunchy Vintage Quick Smack 05_ESM_AG.wav) | Sonniss GDC 2026 | https://gdc.sonniss.com/ | Sonniss GDC bundle licence (royalty-free, no attribution) |
| m_a.launch | assets/sfx/m_a_launch_launch_r2_3.mp3 | Rocket launch (made from 840511.ogg) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_a.launch | assets/sfx/m_a_launch_launch_r2_6.mp3 | Fireworks launch swoosh (made from 675780.ogg) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| m_a.launch | assets/sfx/m_a_launch_launch_r2_5.mp3 | Firework rocket (game-y) (made from 347163.ogg) | Freesound | https://gdc.sonniss.com/ | CC0 1.0 (Freesound) |
| menu | assets/music/menu_787460.mp3 | night in the sci-fi city | solarpsychedelic | https://freesound.org/people/solarpsychedelic/sounds/787460/ | CC0 1.0 |
| round | assets/music/round_683261.mp3 | Battle Music (Village) | Migfus20 | https://freesound.org/people/Migfus20/sounds/683261/ | CC0 1.0 |
| final | assets/music/final_361424.mp3 | Synth Metal Rock Loop.wav | furbyguy | https://freesound.org/people/furbyguy/sounds/361424/ | CC0 1.0 |
| end | assets/music/end_269198.mp3 | game-win.mp3 | mickleness | https://freesound.org/people/mickleness/sounds/269198/ | CC0 1.0 |
<!-- sounds:end -->
