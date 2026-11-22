// Waves: each wave sends rivals in; when they are all wrecked there is a break (time for the garage) and the next comes.
// The player comes back after a wreck. The town's mode, and any map's that wants a straight brawl.
//
// A mode is made from the game's api (see `api` in main.js) and returns:
//   go, note                 the menu's start button and its line under it
//   start()                  the round begins (the player's car is already on the map)
//   step(dt)                 every frame while the round runs
//   wrecked(c, who)          a car was wrecked (c by who, who may be null); scrap for the player's kills is already paid
//   playerDown()             the player was wrecked: { respawn: seconds } to come back, or nothing to end the round
//   hud()                    [the top line, the line under it] for the top of the screen, and optionally a third,
//                            [label, number], for the counter by the scrap (cars wrecked when it is left out)
//   garageOK()               the garage can be opened now (G, or the hint)
//   rivalSpawn()             optional: where a rival comes in (default: the map's spawnPoint)
import { ROUND } from '../tuning.js';

export function makeWaves(G) {
  let wave = 0, nextWave = 0;
  function startWave(n) {
    wave = n + 1; nextWave = 0; G.hint(null);
    const W = ROUND.waves[Math.min(n, ROUND.waves.length - 1)], count = W.count + Math.max(0, n - ROUND.waves.length + 1);
    for (let i = 0; i < count; i++) G.addRival(n);
    G.banner(`Wave ${wave}`, `${count} rivals incoming`);
  }
  return {
    go: 'Start the brawl',
    note: 'Wreck each wave of rival cars. Spend the scrap in the garage on guns, armour, rams, wheels and engines.',
    get wave() { return wave; },
    start() { startWave(0); },
    step(dt) {
      if (G.game.state !== 'play' || G.cars.some((c) => c.rival && !c.dead)) return;
      if (!nextWave) {
        nextWave = ROUND.breakTime; G.banner('Wave cleared', `+${50 * wave} scrap`); G.game.scrap += 50 * wave; G.keepSave();
        G.sfx.play('vo_clear', 1);
      }
      nextWave -= dt;
      G.hint(`Next wave in ${Math.max(0, Math.ceil(nextWave))} &middot; ${G.TOUCH() ? 'tap here' : '<kbd>G</kbd> or click here'} for the garage`);
      if (nextWave <= 0) { nextWave = 0; G.hint(null); startWave(wave); }
    },
    wrecked() {},
    playerDown: () => ({ respawn: ROUND.respawnPlayer }),
    hud() { const left = G.cars.filter((c) => c.rival && !c.dead).length; return [`Wave ${wave}`, left === 1 ? '1 rival left' : `${left} rivals left`]; },
    garageOK: () => nextWave > 0,
    afterGarage() { nextWave = Math.max(nextWave, 2.5); },
  };
}
