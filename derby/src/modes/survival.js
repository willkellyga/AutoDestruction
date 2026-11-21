// Last one standing: the player and five rivals, every car for itself, while the dead come in through the gates and
// over the walls, more of them and faster as the round goes on, until the horde breaks through the walls. No second
// cars: a wrecked car is out. The player wrecked ends the round with their place; the last car still running wins.
//
// The map can say where things happen (maps/base.js does): `starts` (six places to line up, the player's first),
// `gates` ({ out, entry }: where a group appears outside and the point inside it walks to first), `wallSpot()` (a
// place on top of the wall to climb over from, with `in`, the way into the base) and `breach(api)` (blow holes in the
// walls, and return the gaps as more gates). Without them the horde comes in from the middle of each edge.
import { makeHorde, HORDE } from '../zombies.js';
import { WX, WZ } from '../../../src/world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

export const SURVIVAL = {
  rivals: 5,
  tiers: [0, 1, 1, 2, 2],     // the rivals' builds (parts.js rivalBuild): a mix, so some are tougher than others
  countdown: 3,               // seconds on the start line
  cap: [12, 34],              // zombies on the base at once: at the start, and by `full` seconds in
  every: [1.5, 0.5],          // seconds between groups coming in: at the start, and by `full`
  full: 75,
  breach: 80,                 // seconds in: the horde breaks through the walls (the cap goes to HORDE.max)
  surge: 16,                  // zombies that pour in through the gaps at once
  runners: 0.35,              // after the breach, this share of them run
  speed: [1, 1.35],           // the horde's pace, at the start and by the breach; it keeps creeping up after
  dmg: [1, 1.5],              // and how hard they claw
  creep: 0.006,               // how much both go up each second after the breach, so a round can't stall
  place: [300, 160, 90, 50, 25, 0],   // scrap for finishing 1st, 2nd, ...
  inside: 8,                  // zombies already wandering the base when the round starts (away from the cars)
  tough: 3,                   // every car's armour is this many times its build's: one car each, so they have to last
  hunt: [4, 7],               // seconds a rival spends going after a car, then it ploughs through the dead for a while
  aggro: [0.1, 0.4],          // the share of their time the rivals spend hunting cars: at the start, and by the breach
                              // (so the early round is about the horde and the late one is a brawl)
  grudge: 40,                 // health a car has to knock off a rival in a few seconds to turn it round
  payback: 0.25,              // the chance it does when that car is another rival (the player, always)
};

export function makeSurvival(G) {
  const S = SURVIVAL, MAP = G.MAP;
  let horde = null, phase = 'wait', countT = 0, clock = 0, spawnT = 0, breached = false, out = null;
  const held = new Map();
  // where the horde comes from
  const edge = [{ out: { x: WX / 2, z: -30 }, entry: { x: WX / 2, z: 30 } }, { out: { x: WX / 2, z: WZ + 30 }, entry: { x: WX / 2, z: WZ - 30 } }, { out: { x: -30, z: WZ / 2 }, entry: { x: 30, z: WZ / 2 } }, { out: { x: WX + 30, z: WZ / 2 }, entry: { x: WX - 30, z: WZ / 2 } }];
  let gates = (MAP.gates || edge).slice();
  const live = () => G.cars.filter((c) => !c.dead && !c.gone);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // a rival's driving, with the dead in it: it goes after the nearest car (now and then whoever hit it last), shoots
  // the zombies in its way or hanging on, and swerves to throw them off
  function foe(c) {
    if (c.lastBy && !c.lastBy.dead && Math.random() < 0.5) return c.lastBy;
    let best = null, bs = 1e9;
    for (const o of live()) { if (o === c) continue; const d = Math.hypot(o.x - c.x, o.z - c.z) * (o === G.player ? 0.75 : 1) * (0.75 + Math.random() * 0.5); if (d < bs) { bs = d; best = o; } }
    return best;
  }
  // the nearest zombie to mow down that isn't at another car (going for those means ramming the car too)
  function loose(c) {
    let best = null, bd = 1e9;
    for (const q of horde.all) {
      if (q.dead || (q.car && q.car !== c)) continue;
      const d = Math.hypot(q.x - c.x, q.z - c.z);
      if (d < bd && !G.cars.some((o) => o !== c && !o.dead && Math.hypot(o.x - q.x, o.z - q.z) < 30)) { bd = d; best = q; }
    }
    return best;
  }
  function coach(c) {
    const d = c.driver, think = d.think, b = d.brain, wob = Math.random() * 6;
    // its mind: after a car for a while, then clearing the dead off the base for a while. `mark` is what it drives at
    // while it clears: a stand-in that follows one zombie (the driver wants something with a position and a speed)
    const mark = { x: c.x, z: c.z, vx: 0, vz: 0, dead: false, name: 'the horde' };
    let mood = Math.random() < 0.8 ? 'clear' : 'hunt', moodT = 4 + Math.random() * 16, prey = null, hp = c.hp, grudge = 0;
    d.think = (dt, all, player) => {
      if (c.dead) return;
      if (phase !== 'run') { c.throttle = 0; c.steer = 0; c.brake = 1; c.fire = [false, false]; b.chkT = 0; hp = c.hp; if (phase === 'done') think(dt, all, player); return; }
      // hurt by a car: it goes after that one now (what the dead do to it doesn't count)
      if (c.hp < hp && c.lastBy && !horde.clingers(c)) grudge += hp - c.hp;
      hp = c.hp; grudge *= Math.exp(-dt / 3);
      if (grudge > S.grudge && c.lastBy && !c.lastBy.dead && c.lastBy !== c) {
        grudge = 0;
        // always at the player; at another rival only sometimes (or they would all be at each other in a minute)
        if (c.lastBy === G.player || Math.random() < S.payback) { mood = 'hunt'; moodT = S.hunt[0] + Math.random() * (S.hunt[1] - S.hunt[0]); b.target = c.lastBy; b.pickT = moodT; }
      }
      if ((moodT -= dt) <= 0) {
        mood = mood === 'hunt' ? 'clear' : 'hunt';
        const a = lerp(S.aggro[0], S.aggro[1], clamp(clock / S.breach, 0, 1)), h = S.hunt[0] + Math.random() * (S.hunt[1] - S.hunt[0]);
        moodT = mood === 'hunt' ? h : h * (1 - a) / a * (0.6 + Math.random() * 0.8); b.pickT = 0; prey = null;
      }
      if (mood === 'clear') {
        if (!prey || prey.dead || (prey.car && prey.car !== c) || !horde.all.includes(prey)) prey = loose(c);
        if (!prey) { mood = 'hunt'; b.pickT = 0; } else { mark.x = prey.x; mark.z = prey.z; b.target = mark; b.pickT = 1; }
      }
      if (mood === 'hunt' && (!b.target || b.target === mark || b.target.dead || b.pickT <= 0)) { b.target = foe(c); b.pickT = 2.5 + Math.random() * 3; }
      c.mood = mood;   // on the car too, for tests
      think(dt, all, player);
      const n = horde.clingers(c);
      if (n >= 2 && c.speed > 25) { c.drift = true; c.steer = Math.sin(G.game.time * 4 + wob) > 0 ? 1 : -1; c.throttle = 1; c.brake = 0; }
      const T = b.target, dT = T && T !== mark ? Math.hypot(T.x - c.x, T.z - c.z) : 1e9;
      const q = horde.nearest(c, 60, 0.9, c.yaw, true) || (n ? horde.nearest(c, 16, 0, c.yaw, true) : null);
      if (q && (Math.hypot(q.x - c.x, q.z - c.z) < 32 || dT > 150 || !c.fire[0])) { c.aim.set(q.x, 3, q.z); c.fire = [c.onTarget(0.3), c.fire[1]]; }
    };
  }

  // in they come: a few through a gate, or one over the wall
  function spawn(k) {
    const runner = () => (breached && Math.random() < S.runners ? HORDE.runner * (0.9 + Math.random() * 0.2) : undefined);
    if (MAP.wallSpot && Math.random() < 0.35) { const w = MAP.wallSpot(); horde.spawn(w.x, w.z, { drop: true, in: w.in, speed: runner() }); return; }
    const g = pick(gates), n = 1 + (Math.random() < 0.5 ? 1 : 0) + (k > 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) horde.spawn(g.out.x + (Math.random() - 0.5) * 16, g.out.z + (Math.random() - 0.5) * 16, { entry: g.entry, speed: runner(), yaw: Math.atan2(g.entry.x - g.out.x, g.entry.z - g.out.z) });
  }
  // one already inside: somewhere open on the route grid, well away from every car
  function lurker() {
    const nav = MAP.nav; if (!nav) return;
    for (let i = 0; i < 40; i++) {
      const x = 24 + Math.random() * (WX - 48), z = 24 + Math.random() * (WZ - 48);
      if (nav.blocked[nav.cellOf(x, z)] || G.cars.some((c) => Math.hypot(c.x - x, c.z - z) < 70)) continue;
      horde.spawn(x, z, { yaw: Math.random() * 6.28 }); return;
    }
  }
  function breakThrough() {
    breached = true;
    G.banner('The horde breaks through', 'The walls are down. Keep moving.');
    G.sound('alarm', 1); G.sfx.play('bigboom', 0.9);
    if (MAP.breach) gates = gates.concat(MAP.breach(G) || []);
    for (let i = 0; i < S.surge; i++) { const g = pick(gates); horde.spawn(g.out.x + (Math.random() - 0.5) * 20, g.out.z + (Math.random() - 0.5) * 20, { entry: g.entry, speed: Math.random() < S.runners ? HORDE.runner : undefined }); }
  }
  // the round is over: a card with how it went
  function finish(won) {
    if (phase === 'done') return;
    phase = 'done'; horde.active = false;
    // (the player's wreck can blow up the last rival with it: they go out together and share first)
    const place = won ? 1 : live().filter((c) => c !== G.player).length + 1, total = S.rivals + 1, tie = !won && place === 1;
    const t = Math.floor(clock), bonus = S.place[place - 1] || 0;
    const lines = [
      `${tie ? 'Shared 1st' : ORD[place - 1]} of ${total}`,
      `Survived ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`,
      `Cars wrecked: ${G.game.kills}`,
      `Zombies killed: ${horde.byPlayer} (+${horde.byPlayer * HORDE.scrap} scrap)`,
    ];
    out = { won, place, time: clock, kills: G.game.kills, zombies: horde.byPlayer, bonus };
    G.over(won ? 'Last car standing!' : tie ? 'Out together' : 'Wrecked', lines, bonus);
  }

  return {
    go: 'Survive',
    note: 'Every car for itself, and the dead are coming. One car, no second chances: be the last one still running.',
    get horde() { return horde; }, get phase() { return phase; }, get clock() { return clock; }, get result() { return out; }, get breached() { return breached; },
    start() {
      horde = makeHorde(G, {});
      G.extras.push(horde);
      const starts = MAP.starts || [];
      const tiers = S.tiers.slice().sort(() => Math.random() - 0.5);
      for (let i = 0; i < S.rivals; i++) {
        const at = starts[i + 1] || MAP.spawnPoint(G.player, live());
        const c = G.addRival(tiers[i % tiers.length], { x: at.x, z: at.z, yaw: at.yaw ?? Math.atan2(WX / 2 - at.x, WZ / 2 - at.z) });
        coach(c);
      }
      for (const c of G.cars) { c.maxHp = c.hp = Math.round(c.maxHp * S.tough); held.set(c, { x: c.x, z: c.z, yaw: c.yaw }); }
      phase = 'count'; countT = S.countdown;
      G.banner(String(S.countdown), 'Every car for itself'); G.sfx.play('ui_tab', 0.9);
    },
    step(dt) {
      if (!horde) return;
      if (phase === 'count') {
        // everyone waits on the line, engines running, guns quiet
        for (const c of G.cars) { const h = held.get(c); if (!h) continue; c.x = h.x; c.z = h.z; c.yaw = h.yaw; c.vx = c.vz = 0; c.yawRate = 0; for (const g of c.guns) { g.t = Math.max(g.t, 0.15); g.left = 0; } }
        const was = Math.ceil(countT); countT -= dt; const now = Math.ceil(countT);
        if (now !== was && now > 0) { G.banner(String(now), 'Every car for itself'); G.sfx.play('ui_tab', 0.9); }
        if (countT <= 0) { phase = 'run'; G.banner('Survive!', 'The dead are at the gates'); G.sfx.play('ui_go', 1); for (let i = 0; i < 4; i++) spawn(0); for (let i = 0; i < S.inside; i++) lurker(); }
        horde.step(dt);
        return;
      }
      if (phase === 'run') {
        clock += dt;
        const k = clamp(clock / S.full, 0, 1), kb = clamp(clock / S.breach, 0, 1), after = Math.max(0, clock - S.breach);
        horde.strength.speed = lerp(S.speed[0], S.speed[1], kb) + after * S.creep;
        horde.strength.dmg = lerp(S.dmg[0], S.dmg[1], kb) + after * S.creep * 2;
        if (!breached && clock >= S.breach) breakThrough();
        const cap = breached ? HORDE.max : Math.round(lerp(S.cap[0], S.cap[1], k));
        if ((spawnT -= dt) <= 0 && horde.all.length < cap) { spawnT = lerp(S.every[0], S.every[1], k) * (0.7 + Math.random() * 0.6) * (breached ? 0.6 : 1); spawn(k); }
      }
      horde.step(dt);
    },
    wrecked(c, who) {
      if (!horde || c === G.player) return;
      if (!who) G.toast(`The dead got ${c.name}`, `${live().length} cars left`);
      if (phase === 'run' && G.player && !G.player.dead && !live().some((o) => o !== G.player)) finish(true);
    },
    playerDown() { if (horde) finish(false); },
    hud() {
      if (phase === 'wait') return ['Last car standing', `${S.rivals + 1} cars on the base`];
      if (phase === 'count') return ['Get ready', `${S.rivals + 1} cars on the base`];
      const n = live().length;
      return [n === 1 ? '1 car left' : `${n} cars left`, `${horde.byPlayer} zombies killed`];
    },
    garageOK: () => false,
    radar(R, s, ox, oy) { if (horde) horde.radar(R, s, ox, oy); },
    // on a touch screen with no rival in view, the guns aim themselves at the zombie ahead
    autoAim(c, yaw, at) {
      const q = horde && horde.nearest(c, 110, 0.7, yaw); if (!q) return false;
      at.set(q.x, 3.2, q.z); return true;
    },
  };
}
