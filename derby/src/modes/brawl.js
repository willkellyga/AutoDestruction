// Arena free-for-all (Hammerdown Arena's mode): you and seven rival cars in the pit, every car out for every other, on
// the clock. A wrecked car (yours too) is back a few seconds later at the free spawn point furthest from everyone, and
// nothing can hurt it for a moment as it comes in (main.js's damage() skips a car with `shield` up, and ai.js leaves it
// alone), so nobody is wrecked again on the spot. Most wrecks when the time is up wins. A wreck by the map (a hammer,
// the press, the flames) counts for whoever hit that car last, if they hit it in the last few seconds.
// At the end a card ranks everyone and pays scrap by place, on top of the 100 a wreck that is paid as they happen.
// See waves.js for what a mode is made of.
import { ROUND, BRAWL_LEVELS, BRAWL_FIRST, useAILevel } from '../tuning.js';
import { PARTS } from '../parts.js';

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
  // the difficulty (the start card's buttons): the save's, or Normal. Online rounds are always Normal
  const levels = () => (G.save.levels && typeof G.save.levels === 'object' ? G.save.levels : (G.save.levels = {}));
  const levelId = () => (BRAWL_LEVELS[levels().brawl] ? levels().brawl : 'normal');
  let LV = BRAWL_LEVELS.normal;
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
    const title = mine === 1 ? (top.length > 1 ? 'Joint winner!' : 'You win!') : mine <= 3 ? 'On the podium' : 'Round over';   // (the place itself is on the card's yellow tab)
    const prize = Math.round(BRAWL.place[Math.min(BRAWL.place.length - 1, mine - 1)] * LV.prize);
    const carOf = (r) => { const c = G.cars.find((o) => o.name === r.name && !o.gone); return (c && (PARTS.body[c.load.body] || {}).name) || ''; };
    const sheet = {
      kicker: `${G.MAP.name || 'Arena'} · results`, badge: ord(mine), sub: `You wrecked ${me.wrecks} ${me.wrecks === 1 ? 'car' : 'cars'}`,
      cols: ['Pos', 'Driver', 'Car', 'Wrecks'],
      rows: order.map((r) => ({ pos: placeOf(r), name: r.name, me: r.me, car: carOf(r), value: String(r.wrecks), note: r.deaths ? `wrecked ${r.deaths}` : '' })),
      stats: [['Your wrecks', String(me.wrecks)], ['Times wrecked', String(me.deaths)], ['Difficulty', LV.name]],
      pay: [[`${ord(mine)} place`, prize]],
    };
    G.over(title, lines, prize, null, sheet);
  }

  return {
    go: 'Fight',
    // the start card's one line under the difficulty (the how-to-play cards say the rest)
    get tip() { return BRAWL_LEVELS[levelId()].note || ''; },
    get note() { const n = BRAWL_LEVELS[levelId()].note; return `Free-for-all: you and seven rival cars for three minutes, everyone against everyone. Wrecked cars are back in three seconds. Most wrecks wins.${n ? ' ' + n : ''}`; },
    levels: {
      list: Object.entries(BRAWL_LEVELS).map(([id, L]) => [id, L.name]),
      get: levelId,
      set(id) { if (!BRAWL_LEVELS[id]) return; levels().brawl = id; G.keepSave(); },
    },
    start() {
      const net = NET(), RIVALS = net ? (net.host ? net.bots : 0) : BRAWL.rivals;
      LV = net ? BRAWL_LEVELS.normal : G.game.firstRound ? BRAWL_FIRST : BRAWL_LEVELS[levelId()]; useAILevel(LV);   // (before the rivals are made: their armour)
      // (online the server keeps the clock: a page that came late or reloaded takes what is left on it)
      G.hint(null); phase = 'run'; left = net && net.clockLeft() > 0 ? net.clockLeft() : LIMIT - (net && net.lateBy ? net.lateBy : 0); warned = 0;
      you = G.player; row('You', true); if (you) shield(you);
      const humans = net ? net.players.length : 1;
      // (a player who came late into a bot's seat starts where the bot was)
      if (net && you) { const at = net.spawn || seatAt(net.slot); if (at) { you.x = at.x; you.z = at.z; you.yaw = at.yaw; you.gunYaw = at.yaw; } }
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
    // ...a bot handed to another device (this one was away too long): it brings the wrecked ones back now, not this one
    release() { back.length = 0; },
    // ...a bot whose seat a new player took: it does not come back
    netDrop(c) { for (let i = back.length - 1; i >= 0; i--) if (back[i].load.name === c.name) back.splice(i, 1); },
    // ...a host's page that reloaded: a bot that was wrecked comes back as the others do
    netRevive(e) { back.push({ load: { ...e.load, name: e.name }, t: BRAWL.respawn }); },
    // the round's clock is the server's (the relay ends it on time even when the host has gone)
    netLen: LIMIT,
    netClock(s) { if (phase === 'run' && Math.abs(s - left) > 0.5) left = s; },
    netEnd() { if (phase === 'run') { left = 0; finish(); } },
    // the scoreboard, for the relay to keep: a page that reloads mid-round gets it back (the most each device saw)
    netSave(me) { return [...rows.values()].map((r) => [r.me ? me : r.name, r.wrecks, r.deaths]); },
    netLoad(back, me) {
      for (const list of Object.values(back)) {
        if (!Array.isArray(list)) continue;
        for (const [name, w, d] of list) { if (typeof name !== 'string') continue; const r = name === me ? row('You', true) : row(name); r.wrecks = Math.max(r.wrecks, w | 0); r.deaths = Math.max(r.deaths, d | 0); }
      }
    },
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
    // The scoreboard, kept on screen all round (main.js draws it down the left as it draws the race's order): every
    // car by its wrecks, cars level sharing a place, a car that is down greyed until it is back. Will, 2026-11-25:
    // "use that style [the Race UI] to have some persistent leader board so we can see the rankings".
    board() {
      if (phase === 'wait') return null;
      const down = new Set(); for (const c of G.cars) if (!c.gone && c.dead) down.add(c === G.player ? 'You' : c.name);
      const order = ranked();
      return { head: 'Wrecks', rows: order.map((r) => ({ pos: order.findIndex((o) => o.wrecks === r.wrecks) + 1, name: r.name, me: r.me, dead: down.has(r.name), note: String(r.wrecks) })) };
    },
    garageOK: () => false,
  };
}
