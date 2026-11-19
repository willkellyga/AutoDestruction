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
| menu | assets/music/menu_787460.mp3 | night in the sci-fi city | solarpsychedelic | https://freesound.org/people/solarpsychedelic/sounds/787460/ | CC0 1.0 |
| round | assets/music/round_683261.mp3 | Battle Music (Village) | Migfus20 | https://freesound.org/people/Migfus20/sounds/683261/ | CC0 1.0 |
| final | assets/music/final_361424.mp3 | Synth Metal Rock Loop.wav | furbyguy | https://freesound.org/people/furbyguy/sounds/361424/ | CC0 1.0 |
| end | assets/music/end_269198.mp3 | game-win.mp3 | mickleness | https://freesound.org/people/mickleness/sounds/269198/ | CC0 1.0 |
<!-- sounds:end -->
