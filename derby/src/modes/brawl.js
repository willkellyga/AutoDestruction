// Arena free-for-all (Hammerdown Arena's mode): you and seven rival cars in the pit, every car out for every other, on
// the clock. A wrecked car (yours too) is back a few seconds later at the free spawn point furthest from everyone, and
// nothing can hurt it for a moment as it comes in (main.js's damage() skips a car with `shield` up, and ai.js leaves it
// alone), so nobody is wrecked again on the spot. Most wrecks when the time is up wins. A wreck by the map (a hammer,
// the press, the flames) counts for whoever hit that car last, if they hit it in the last few seconds.
// At the end a card ranks everyone and pays scrap by place, on top of the 100 a wreck that is paid as they happen.
// See waves.js for what a mode is made of.
import { ROUND } from '../tuning.js';

export const BRAWL = {
  rivals: 7,
  time: 180,          // seconds a match lasts (ROUND.timeLimit instead, when that is set)
  respawn: 3,         // seconds a wrecked car is out
  shield: 2.5,        // seconds a car just back in can't be hurt, blinking
  credit: 6,          // seconds a hit counts for: a car the map wrecks inside this is the hitter's wreck
  tiers: [0, 0, 1, 1, 1, 2, 2],                  // the rivals' builds (parts.js rivalBuild), one each
  place: [400, 250, 160, 110, 80, 60, 40, 20],   // scrap for each place
  wreckLies: 8,       // seconds a wreck lies in the pit before it crumbles (not ROUND.wreckStays: it would fill up)
};
const ord = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
const clock = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function makeBrawl(G) {
  const LIMIT = ROUND.timeLimit || BRAWL.time;
  // online (net.js): the players' cars are the other devices' puppets, and the host's device runs the bots that fill
  // the rest; each device counts the wrecks as they are reported, so every scoreboard agrees
  // (asked when the round starts: the relay's welcome has come by then)
  const NET = () => G.net, CARS = () => (G.net ? G.net.players.length + G.net.bots : BRAWL.rivals + 1);
  // the seats' spots, spread round the pit: each player's, then the bots'
  const seatAt = (k) => { const S = G.MAP.spots; if (!S || !S.length) return null; const p = S[[0, 3, 7, 6, 1, 4, 8, 5][k % 8] % S.length]; return { x: p.x, z: p.z, yaw: p.yaw }; };
  let phase = 'wait', left = LIMIT, you = null, warned = 0;
  const rows = new Map();     // name -> { name, me, wrecks, deaths }
  const back = [];            // wrecked rivals waiting to come back: { load, t }
  const row = (name, me = false) => { let r = rows.get(name); if (!r) { r = { name, me, wrecks: 0, deaths: 0 }; rows.set(name, r); } return r; };
  const ranked = () => [...rows.values()].sort((a, b) => b.wrecks - a.wrecks || a.deaths - b.deaths || (a.me ? -1 : b.me ? 1 : 0));
  const placeOf = (r) => ranked().findIndex((o) => o.wrecks === r.wrecks) + 1;   // (cars level on wrecks share a place)

  // the free spawn point furthest from every car still in it (one of the best three, so it is not always the same)
  function freeSpot() {
    const spots = G.MAP.spots, live = G.cars.filter((c) => !c.gone && !c.dead);
    if (!spots || !spots.length) return G.MAP.spawnPoint(null, live);
    const scored = spots.map((p) => ({ p, d: live.reduce((m, c) => Math.min(m, Math.hypot(c.x - p.x, c.z - p.z)), 1e9) })).sort((a, b) => b.d - a.d);
    const p = scored[Math.floor(Math.random() * Math.min(3, scored.length))].p;
    return { x: p.x, z: p.z, yaw: p.yaw };
  }
  const shield = (c) => { c.shield = BRAWL.shield; c.lastBy = null; };

  function finish() {
    if (phase === 'over') return;
    phase = 'over'; G.hint(null);
    const order = ranked(), me = rows.get('You'), mine = placeOf(me);
    const lines = order.map((r) => `${ord(placeOf(r))}  ${r.name}  ${r.wrecks} ${r.wrecks === 1 ? 'wreck' : 'wrecks'}${r.deaths ? ` (wrecked ${r.deaths})` : ''}`);
    if (me.wrecks) lines.push(`Your wrecks paid +${me.wrecks * 100} scrap as they happened`);
    const top = order.filter((r) => r.wrecks === order[0].wrecks);
    const title = mine === 1 ? (top.length > 1 ? 'Joint winner!' : 'You win!') : `${ord(mine)} place`;
    G.over(title, lines, BRAWL.place[Math.min(BRAWL.place.length - 1, mine - 1)]);
  }

  return {
    go: 'Start the match',
    note: 'Free-for-all: you and seven rival cars in the pit for three minutes, everyone against everyone. Wrecked cars are back in three seconds. Most wrecks wins.',
    start() {
      const net = NET(), RIVALS = net ? (net.host ? net.bots : 0) : BRAWL.rivals;
      G.hint(null); phase = 'run'; left = LIMIT - (net && net.lateBy ? net.lateBy : 0); warned = 0;
      you = G.player; row('You', true); if (you) shield(you);
      const humans = net ? net.players.length : 1;
      if (net && you) { const at = seatAt(net.slot); if (at) { you.x = at.x; you.z = at.z; you.yaw = at.yaw; you.gunYaw = at.yaw; } }
      for (let i = 0; i < RIVALS; i++) { const c = G.addRival(BRAWL.tiers[i % BRAWL.tiers.length], net ? seatAt(humans + i) : undefined); row(c.name); shield(c); }
      for (const c of G.cars) if (c.remote) row(c.name);
      G.banner('Free-for-all', `${clock(LIMIT)} on the clock. Most wrecks wins`);
    },
    step(dt) {
      // the scoreboard over the pit (hazards.js) reads this
      G.game.board = { left, rows: ranked().map((r) => ({ name: r.name, wrecks: r.wrecks, me: r.me })) };
      if (phase !== 'run') return;
      const T = G.game.time;
      // the player's car is a new one after a wreck: shield it as it comes in
      if (G.player && G.player !== you) { you = G.player; shield(you); }
      for (const c of G.cars) {
        if (c.gone) continue;
        if (c.shield > 0) { c.shield = c.dead ? 0 : c.shield - dt; c.unit.root.visible = c.shield <= 0 || ((c.shield * 8) | 0) % 2 === 0; }
        // a hit counts for a few seconds: after that the car is nobody's (ai.js's revenge only goes after recent ones too)
        if (c.lastBy !== c._by) { c._by = c.lastBy; c._byT = T; }
        if (c.lastBy && T - c._byT > BRAWL.credit) c.lastBy = c._by = null;
      }
      for (let i = back.length - 1; i >= 0; i--) {
        if ((back[i].t -= dt) > 0) continue;
        const c = G.addCar({ ...back[i].load }, freeSpot(), true); shield(c); back.splice(i, 1);
      }
      if (G.game.state === 'play' || G.game.state === 'dead') left -= dt;
      const s = Math.ceil(left);
      if (s <= 30 && warned < 1) { warned = 1; G.toast('30 seconds left', ''); }
      if (s <= 10 && warned < 2) { warned = 2; G.banner('10 seconds', 'Make them count'); G.sfx.play('ui_tab', 1); }
      if (left <= 0) finish();
    },
    wrecked(c, who) {
      if (phase !== 'run') return;
      // (a car's own rocket or mine still about after it came back is not a wreck for it)
      let by = who && who !== c ? who : c.lastBy && c.lastBy !== c ? c.lastBy : null;
      if (by && by.name === c.name) by = null;
      row(c.name, c === G.player).deaths++;
      if (by) {
        row(by.name, by === G.player).wrecks++;
        // the map did it, but the player set it up: the wreck pays as one by the player's guns would (main.js pays those)
        if (by === G.player && !who) { G.game.kills++; G.game.scrap += 100; G.toast(`${c.name} wrecked`, '+100 scrap'); }
        else if (!who) G.toast(`${by.name} wrecked ${c.name}`, '');
      }
      c.deadT = Math.max(c.deadT, ROUND.wreckStays - BRAWL.wreckLies);
      if (c.rival && !c.remote) back.push({ load: c.load, t: BRAWL.respawn });
    },
    // online: someone else's car joined (or came back from a wreck), and a bot taken over when the host left
    netCar(c) { if (phase !== 'wait') row(c.name); },
    adopt(c) { if (c.dead) back.push({ load: c.load, t: BRAWL.respawn }); else c.driver = G.makeDriver(c); },
    playerDown: () => ({ respawn: BRAWL.respawn, noGarage: true, noSkip: true }),
    respawnAt: () => freeSpot(),
    rivalSpawn: () => freeSpot(),
    hud() {
      if (phase === 'wait') return ['Free-for-all', `${CARS()} cars · ${clock(LIMIT)}`, ['Wrecks', 0]];
      const me = rows.get('You'), order = ranked(), lead = order[0], level = order.filter((r) => r.wrecks === lead.wrecks).length;
      const sub = !lead.wrecks ? 'No wrecks yet' : me.wrecks < lead.wrecks ? `${ord(placeOf(me))} · ${lead.name} leads with ${lead.wrecks}`
        : level > 1 ? `Joint lead on ${lead.wrecks}` : `You lead with ${lead.wrecks}`;
      return [phase === 'over' ? 'Time!' : clock(left), sub, ['Wrecks', me.wrecks]];
    },
    garageOK: () => false,
  };
}
