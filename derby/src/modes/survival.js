// Last one standing: the player and five rivals on a base the dead are overrunning. The cars don't fight each other
// (the mode is `friendly`, so main.js drops any damage one car does to another and lets shots pass through cars):
// everyone is up against the horde, which comes in through the gates and over the walls in ever greater numbers,
// faster and hungrier, and breaks through the walls a minute and a half in. No second cars: a wrecked car is out.
// The player wrecked ends the round with their place and how long they lasted; the last car still running wins.
//
// The map can say where things happen (maps/base.js does): `starts` (six places to line up, the player's first),
// `gates` ({ out, entry }: where a group appears outside and the point inside it walks to first), `wallSpot()` (a
// place on top of the wall to climb over from, with `in`, the way into the base) and `breach(api)` (blow holes in the
// walls, and return the gaps as more gates). Without them the horde comes in from the middle of each edge.
import { makeHorde, HORDE } from '../zombies.js';
import { WX, WZ } from '../../../src/world.js';

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const clockText = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t) % 60).padStart(2, '0')}`;

export const SURVIVAL = {
  rivals: 5,
  tiers: [0, 0, 1, 1, 2],     // the rivals' builds (parts.js rivalBuild): a mix, so some last longer than others (with
                              // main.js's cut to a rival's armour, AI.hp, so a starting car can outlast them)
  countdown: 3,               // seconds on the start line
  tough: 3.5,                 // every car's armour is this many times its build's: one car each, so they have to last
  inside: 8,                  // zombies already wandering the base when the round starts (away from the cars)
  // how many there are: the number on the base at once climbs all round, up to the peak (fewer on phones), and so
  // does how fast they come in. After the peak they keep getting faster and clawing harder, so the end always comes.
  cap: [14, 0.7],             // zombies on the base at once: at the start, and how many more each second
  peak: 160,                  // the most there can be at once (zombies.js keeps this many ready to draw) ...
  peakPhone: 90,              // ... and on a touch screen
  rate: [1.5, 0.08],          // zombies coming in a second: at the start, and how much faster each second
  speed: [1, 0.0035],         // their pace: at the start, and how much faster each second
  dmg: [1, 0.006],            // how hard they claw: at the start, and how much harder each second
  breach: 90,                 // seconds in: the horde blows holes in the walls and pours in
  surge: 20,                  // zombies that pour in through the gaps at once
  runners: [0.25, 0.6, 0.002], // after the breach, this share of them run, rising each second to the most
  // scrap: each zombie the player kills pays as it goes (HORDE.scrap); at the end, the place and the time lasted
  place: [300, 160, 90, 50, 25, 0],
  perMinute: 40,
};

export function makeSurvival(G) {
  const S = SURVIVAL, MAP = G.MAP;
  let horde = null, phase = 'wait', countT = 0, clock = 0, owed = 0, breached = false, out = null;
  const held = new Map();
  // where the horde comes from
  const edge = [{ out: { x: WX / 2, z: -30 }, entry: { x: WX / 2, z: 30 } }, { out: { x: WX / 2, z: WZ + 30 }, entry: { x: WX / 2, z: WZ - 30 } }, { out: { x: -30, z: WZ / 2 }, entry: { x: 30, z: WZ / 2 } }, { out: { x: WX + 30, z: WZ / 2 }, entry: { x: WX - 30, z: WZ / 2 } }];
  let gates = (MAP.gates || edge).slice();
  const live = () => G.cars.filter((c) => !c.dead && !c.gone);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const capNow = () => (horde ? Math.min(horde.max, Math.round(S.cap[0] + S.cap[1] * clock)) : 0);

  // a rival's driving: it mows down the dead, picking ones ahead of it that aren't at another car (going for those
  // means hitting the car too) and, when it is hurt, ones out on their own rather than in a crowd. It shoots the ones
  // in its way or hanging on, and swerves to throw them off. It never goes after a car.
  function prey(c) {
    const hurt = c.hp < c.maxHp * 0.4;
    let best = null, bs = 1e9;
    for (const q of horde.all) {
      if (q.dead || (q.car && q.car !== c)) continue;
      const dx = q.x - c.x, dz = q.z - c.z, d = Math.hypot(dx, dz);
      if (d > 300 || G.cars.some((o) => o !== c && !o.dead && Math.abs(o.x - q.x) < 25 && Math.abs(o.z - q.z) < 25)) continue;
      const off = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - c.yaw), Math.cos(Math.atan2(dx, dz) - c.yaw)));
      let s = d * (1 + off * 0.6);
      if (hurt) { let n = 0; for (const o of horde.all) if (Math.abs(o.x - q.x) < 14 && Math.abs(o.z - q.z) < 14) n++; s *= 1 + n * 0.5; }
      if (s < bs) { bs = s; best = q; }
    }
    return best;
  }
  function coach(c) {
    const d = c.driver, think = d.think, b = d.brain, wob = Math.random() * 6;
    // what it drives at: a stand-in that follows one zombie (the driver wants something with a position and a speed)
    const mark = { x: c.x, z: c.z, vx: 0, vz: 0, dead: false, name: 'the horde' };
    const mines = c.guns.some((g) => g.g.mine);
    let q0 = null, pickT = 0;
    d.think = (dt, all, player) => {
      if (c.dead) return;
      if (phase === 'count' || phase === 'wait') { c.throttle = 0; c.steer = 0; c.brake = 1; c.fire = [false, false]; b.chkT = 0; return; }
      if ((pickT -= dt) <= 0 || !q0 || q0.dead || (q0.car && q0.car !== c)) { q0 = prey(c); pickT = 1; }
      if (q0) { mark.x = q0.x; mark.z = q0.z; mark.vx = q0.vx; mark.vz = q0.vz; }
      else { mark.x = WX / 2 + Math.sin(G.game.time * 0.2 + wob) * 120; mark.z = WZ / 2 + Math.cos(G.game.time * 0.2 + wob) * 90; mark.vx = mark.vz = 0; }   // none about: a lap of the base
      b.target = mark; b.pickT = 1;
      think(dt, all, player);
      const n = horde.clingers(c);
      if (n >= 2 && c.speed > 25) { c.drift = true; c.steer = Math.sin(G.game.time * 4 + wob) > 0 ? 1 : -1; c.throttle = 1; c.brake = 0; }
      const q = horde.nearest(c, 70, 0.9, c.yaw, true) || (n ? horde.nearest(c, 16, 0, c.yaw, true) : null);
      if (q) { c.aim.set(q.x, 3, q.z); c.fire = [c.onTarget(0.3), mines ? false : c.fire[1]]; }
      else if (mines) c.fire = [c.fire[0], false];
    };
  }

  // in they come: a few through a gate, or one over the wall. Returns how many.
  function spawn() {
    const runs = breached ? Math.min(S.runners[1], S.runners[0] + (clock - S.breach) * S.runners[2]) : 0;
    const runner = () => (Math.random() < runs ? HORDE.runner * (0.9 + Math.random() * 0.2) : undefined);
    if (MAP.wallSpot && Math.random() < 0.35) { const w = MAP.wallSpot(); return horde.spawn(w.x, w.z, { drop: true, in: w.in, speed: runner() }) ? 1 : 0; }
    const g = pick(gates), n = 1 + (Math.random() < 0.5 ? 1 : 0) + (clock > 60 ? 1 : 0);
    let k = 0;
    for (let i = 0; i < n; i++) if (horde.spawn(g.out.x + (Math.random() - 0.5) * 16, g.out.z + (Math.random() - 0.5) * 16, { entry: g.entry, speed: runner(), yaw: Math.atan2(g.entry.x - g.out.x, g.entry.z - g.out.z) })) k++;
    return k;
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
    for (let i = 0; i < S.surge; i++) { const g = pick(gates); horde.spawn(g.out.x + (Math.random() - 0.5) * 20, g.out.z + (Math.random() - 0.5) * 20, { entry: g.entry, speed: Math.random() < S.runners[0] ? HORDE.runner : undefined }); }
  }
  // the round is over: a card with how it went
  function finish(won) {
    if (phase === 'done') return;
    phase = 'done'; horde.active = false;
    // (the player and the last rival can go down in the same moment: they share first)
    const place = won ? 1 : live().filter((c) => c !== G.player).length + 1, total = S.rivals + 1, tie = !won && place === 1;
    const bonus = S.place[place - 1] || 0, timeScrap = Math.round(clock / 60 * S.perMinute);
    const lines = [
      `${tie ? 'Shared 1st' : ORD[place - 1]} of ${total}`,
      `Survived ${clockText(clock)} (+${timeScrap} scrap)`,
      `Zombies killed: ${horde.byPlayer} (+${horde.byPlayer * HORDE.scrap} scrap)`,
    ];
    out = { won, place, time: clock, zombies: horde.byPlayer, bonus, timeScrap };
    G.over(won ? 'Last car standing!' : tie ? 'Out together' : 'Wrecked', lines, bonus + timeScrap);
  }

  return {
    go: 'Survive',
    note: 'The dead are overrunning the base and there are more every minute. One car, no second chances: outlast everyone.',
    friendly: true,   // main.js: cars can't hurt each other, and shots go through them
    get horde() { return horde; }, get phase() { return phase; }, get clock() { return clock; }, get result() { return out; }, get breached() { return breached; },
    get cap() { return capNow(); },
    coach,   // (tests drive the player's car with it)
    start() {
      horde = makeHorde(G, { max: G.TOUCH() ? S.peakPhone : S.peak });
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
      G.banner(String(S.countdown), 'Outlast them all'); G.sfx.play('ui_tab', 0.9);
    },
    step(dt) {
      if (!horde) return;
      if (phase === 'count') {
        // everyone waits on the line, engines running, guns quiet
        for (const c of G.cars) { const h = held.get(c); if (!h) continue; c.x = h.x; c.z = h.z; c.yaw = h.yaw; c.vx = c.vz = 0; c.yawRate = 0; for (const g of c.guns) { g.t = Math.max(g.t, 0.15); g.left = 0; } }
        const was = Math.ceil(countT); countT -= dt; const now = Math.ceil(countT);
        if (now !== was && now > 0) { G.banner(String(now), 'Outlast them all'); G.sfx.play('ui_tab', 0.9); }
        if (countT <= 0) { phase = 'run'; G.banner('Survive!', 'The dead are at the gates'); G.sfx.play('ui_go', 1); for (let i = 0; i < 4; i++) spawn(); for (let i = 0; i < S.inside; i++) lurker(); }
        horde.step(dt);
        return;
      }
      if (phase === 'run') {
        clock += dt;
        horde.strength.speed = S.speed[0] + S.speed[1] * clock;
        horde.strength.dmg = S.dmg[0] + S.dmg[1] * clock;
        if (!breached && clock >= S.breach) breakThrough();
        owed += (S.rate[0] + S.rate[1] * clock) * dt;
        const cap = capNow();
        while (owed >= 1 && horde.all.length < cap) owed -= Math.max(1, spawn());
        owed = Math.min(owed, 6);
        // the arc coils: main.js's arc only zaps cars, so here they zap the nearest of the dead (no aiming needed)
        for (const c of G.cars) {
          if (c.dead || c.gone) continue;
          for (const g of c.guns) if (g.g.arc && g.t <= 0 && horde.zap(c, g.g.range, g.g.dmg * (c.rival ? HORDE.rivalGun : 1))) g.t = g.g.reload;
        }
      }
      horde.step(dt);
    },
    wrecked(c) {
      if (!horde || c === G.player) return;
      G.toast(`The dead got ${c.name}`, `${live().length} cars left`);
      if (phase === 'run' && G.player && !G.player.dead && !live().some((o) => o !== G.player)) finish(true);
    },
    playerDown() { if (horde) finish(false); },
    hud() {
      if (phase === 'wait') return ['Last car standing', `${S.rivals + 1} cars on the base`];
      if (phase === 'count') return ['Get ready', `${S.rivals + 1} cars on the base`];
      const n = live().length;
      return [n === 1 ? '1 car left' : `${n} cars left`, `Survived ${clockText(clock)}`, ['Zombies', horde.byPlayer]];
    },
    garageOK: () => false,
    radar(R, s, ox, oy) { if (horde) horde.radar(R, s, ox, oy); },
    // what the aim assist (and a phone's auto-aim) picks from: the dead, never the other cars
    targets() { return horde ? horde.all : []; },
  };
}
