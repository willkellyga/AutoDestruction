// The race: three laps (or the map's `laps`) of the map's circuit (its `track`: see maps/race.js, the street course, and maps/bowtie.js) with
// the guns on.
//
// Six cars line up on the grid, the player fifth, and are held there through a 3-2-1 countdown (with lights on the
// start gantry). Laps are counted through checkpoint gates spaced round the lap, which have to be passed in order, so
// cutting across the infield gains nothing. The HUD has the lap and the player's place, a warning when going the wrong
// way or past a missed gate, and the radar shows the next gate. A wrecked car, the player's too, comes back at the last
// gate it passed, facing the right way, after RESPAWN seconds: wrecking someone costs them time. When the player takes
// the flag the car drives itself and the results come up at once, with scrap for the place and for every rival
// wrecked; whoever is still racing is listed by how far behind they were. If a rival wins and the player is still out there, the race closes after a while.
//
// Difficulty (Easy, Normal, Hard on the start card, kept in the save as `raceLevel`: tuning.js RACE): the rivals' cars
// are tuned to the player's, faster or slower by the level, and drive better or worse; Easy and Normal have a little
// catch-up, Hard none. Every car, the player's too, gets a tow tucked in behind another (slipstream), which keeps the
// pack together the fair way.
import * as THREE from 'three';
import { makeRacer } from './racer.js';
import { RACE } from '../tuning.js';
import { PARTS, racerBuild } from '../parts.js';

const RESPAWN = 2.5, COUNT = 3;
const PRIZE = [300, 200, 120, 80, 50, 30];   // by place, on Normal (each rival you wreck already pays 100 as it happens)
const CLOSE = 40;                     // seconds the race stays open after the winner finishes
// seconds after the player takes the flag before the results: a moment for the banner, no more (Will, 2026-11-24:
// "When you win a race, you should get to the screen where you can quit and rerace if you want rather than waiting
// for everyone to finish"). The card comes up over the race, and the rivals drive on behind it.
const AFTER = 0.4;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ord = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const between = ([a, b]) => a + Math.random() * (b - a);

export function makeRace(G) {
  const TR = G.MAP.track;
  const LAPS = G.MAP.laps || 3;   // a short, fast course can ask for more
  const { T, line, P, gates, gateS, grid, HALF, PIT_HALF } = TR, NG = gates.length;
  const wrapS = (d) => d - Math.round(d / T.L) * T.L;
  // the room left and right of the centre line at sample i (a street course measures it: T.WL, T.WR)
  const WL = (i) => (T.WL ? T.WL[i] : HALF), WR = (i) => (T.WR ? T.WR[i] : HALF);
  const recs = [];                     // one for each car in the race: see join()
  const byCar = new Map();
  let phase = 'grid', countT = 0, raceT = 0, shown = 0, closeT = -1, doneT = -1, finishers = 0, lights = null, lightsT = -1;
  const race = { T, line, P, HALF, PIT_HALF, phase: () => phase, time: () => raceT, rec: (c) => byCar.get(c), pull };
  // the difficulty: the save's, or Normal
  const levelId = () => (RACE.levels[G.save.raceLevel] ? G.save.raceLevel : 'normal');
  let LV = RACE.levels[levelId()];

  // a car joins the race (or comes back): its record follows it to its new car
  function join(car, name, me, slot) {
    const r = { car, name, me, slot, i: -1, s: 0, lat: 0, draft: 0, tune: null, passed: 0, lapT0: 0, laps: [], best: 0, wrecks: 0, kills: 0, finished: false, finishT: 0, place: 0, downT: 0, wrongT: 0, lostT: 0, stuckT: 0, lastProg: 0, progress: 0, resets: 0, gateT: [0] };   // gateT[k]: race time it passed its k-th gate (the gaps)
    recs.push(r); byCar.set(car, r); locate(r, true);
    return r;
  }
  function swapCar(r, car) { r.car = car; byCar.set(car, r); r.i = -1; locate(r, true); }   // the old car keeps its record: its mines still count
  // where the car is round the lap: the nearest sample (searched round the last one, so a car at the crossover stays
  // on its own half), how far along, and across
  function locate(r, fresh) {
    if (!Number.isFinite(r.car.x) || !Number.isFinite(r.car.z)) return 0;   // (a car being rebuilt: keep where it was, or the places go wrong)
    const p = T.project(r.car.x, r.car.z, fresh ? -1 : r.i, 40);
    const prev = r.s; r.i = p.i; r.lat = p.lat; r.s = ((p.s % T.L) + T.L) % T.L;
    r.ox = fresh ? r.car.x : r.px; r.oz = fresh ? r.car.z : r.pz; r.px = r.car.x; r.pz = r.car.z;   // where it was, and is
    return fresh ? 0 : wrapS(r.s - prev);
  }
  // whether a car's path since the last frame crossed gate g's line, forwards and between the course's edges
  function through(r, g) {
    const i = gates[g], gx = T.X[i], gz = T.Z[i], tx = T.TX[i], tz = T.TZ[i];
    const a0 = (r.ox - gx) * tx + (r.oz - gz) * tz, a1 = (r.px - gx) * tx + (r.pz - gz) * tz;
    if (!(a0 < 0 && a1 >= 0) || Math.hypot(r.px - r.ox, r.pz - r.oz) > 16 || Math.abs(wrapS(r.s - gateS[g])) > 60) return false;
    const t = a0 / (a0 - a1), x = r.ox + (r.px - r.ox) * t - gx, z = r.oz + (r.pz - r.oz) * t - gz, lat = x * tz - z * tx;
    return lat < WL(i) + 4 && -lat < WR(i) + 4;
  }
  // how far into the race: gates passed, and how far past the last one (for the places)
  function progressOf(r) {
    const g = r.passed % NG, base = Math.floor(r.passed / NG) * T.L + gateS[g], next = g + 1 < NG ? gateS[g + 1] : T.L;
    return base + clamp(wrapS(r.s - gateS[g]), -150, next - gateS[g]);
  }
  // the catch-up: a rival well ahead of the player eases off a little (pull, a share of its pace), and one well behind
  // pushes a little (push, more top speed: see step), so the race stays a race; as much as the level allows
  function pull(c) {
    const r = byCar.get(c), me = recs.find((o) => o.me);
    if (!r || r.me || !me || me.finished || phase !== 'race') return 1;
    const gap = r.progress - me.progress;
    return gap > 100 ? 1 - Math.min(LV.ease, (gap - 100) / 2500) : 1;
  }
  function push(r, me) {
    if (r.me || !me || me.finished || phase !== 'race') return 0;
    const gap = r.progress - me.progress;
    return gap < -150 ? Math.min(LV.push, (-gap - 150) / 3000) : 0;
  }
  // slipstream: how much tow a car gets now, 0 to 1, from the nearest car just ahead of it on the same line
  function tow(r) {
    const S = RACE.slip, c = r.car;
    if (c.dead || c.fwd < S.min || r.i < 0) return 0;
    let best = 0;
    for (const o of recs) {
      if (o === r || o.car.dead || o.i < 0) continue;
      const ds = wrapS(o.s - r.s);
      if (ds < 4 || ds > S.reach || Math.abs(o.lat - r.lat) > S.width) continue;
      best = Math.max(best, 1 - (ds - 4) / (S.reach - 4));
    }
    return best;
  }
  // a rival's car, tuned to the player's (see RACE): its top speed and pull, its turning, and its grip if the
  // player's tyres hold better; again each time it comes back from a wreck (a new car is built from the load)
  function tune(c, t) { const S = c.spec; S.top = t.top; S.accel = t.accel; S.turn = t.turn; S.grip = Math.max(S.grip, t.grip); }
  const racer = (c, d) => makeRacer(c, race, { pace: d.pace, grip: d.grip, brake: LV.brake, aim: LV.aim });
  const place = (r) => 1 + recs.filter((o) => o !== r && (o.finished ? !r.finished || o.finishT < r.finishT : !r.finished && o.progress > r.progress)).length;

  // where a car comes back: at its last gate, on the road and clear of the other cars, facing on round the lap
  function backAt(r) {
    const gi = gates[r.passed % NG];
    for (const back of [0, 14, 28, 42]) for (const lat of [0, -12, 12, -20, 20]) {
      const i = T.at(gi - Math.round(back / T.STEP)), x = T.X[i] + T.TZ[i] * lat, z = T.Z[i] - T.TX[i] * lat;
      if (T.WL && (lat > WL(i) - 5 || -lat > WR(i) - 5)) continue;   // too near the kerb on a street
      if (G.cars.some((c) => !c.gone && (c !== r.car || c.dead) && Math.hypot(c.x - x, c.z - z) < 18)) continue;   // wrecks too
      return { x, z, yaw: Math.atan2(T.TX[i], T.TZ[i]), y: TR.H ? TR.H[i] : 0 };   // (y: the road's height there, on a course that climbs)
    }
    return { x: T.X[gi], z: T.Z[gi], yaw: Math.atan2(T.TX[gi], T.TZ[gi]), y: TR.H ? TR.H[gi] : 0 };
  }
  // put a car back on the track at its last gate without a wreck (stuck, or lost off the route)
  function reset(r) {
    const at = backAt(r), c = r.car;
    c.x = at.x; c.z = at.z; c.yaw = at.yaw; c.vx = c.vz = 0; c.yawRate = 0; c.gunYaw = at.yaw;
    if (G.MAP.floor) { c.fy = G.MAP.floor(at.x, at.z, at.y || 0); c.y = 0; c.vy = 0; }   // on the bridge, not under it
    if (c.driver && c.driver.brain) { c.driver.brain.i = -1; c.driver.brain.lane = 0; c.driver.brain.backT = 0; }
    locate(r, true); r.stuckT = 0; r.lostT = 0; r.lastProg = progressOf(r); r.resets++;
  }

  // ---- the start lights on the gantry: five lamps, red as the count goes down, all green for the start ----
  // (TR.lights: the middle lamp's place, which way the row runs (lx, lz) and faces (yaw); or under the gantry's beam)
  function makeLights() {
    const g = TR.gantry, L = TR.lights || { x: T.X[0], y: g.y - 2.4, z: g.z - 1.3, yaw: 0, lx: 1, lz: 0 }, mats = { off: new THREE.MeshBasicMaterial({ color: 0x2a1c1a }), red: new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }), green: new THREE.MeshBasicMaterial({ color: 0x3dff6a, toneMapped: false }) };
    const geo = new THREE.BoxGeometry(2.6, 2.6, 0.5), lamps = [];
    for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(geo, mats.off); m.position.set(L.x + L.lx * (k - 2) * 5, L.y, L.z + L.lz * (k - 2) * 5); m.rotation.y = L.yaw;
      m.matrixAutoUpdate = false; m.updateMatrix(); G.scene.add(m); m.updateMatrixWorld(true); lamps.push(m);
    }
    return { lamps, mats, set(n, mat) { lamps.forEach((m, k) => { m.material = k < n ? mats[mat] : mats.off; }); } };
  }

  function grab(r) { if (r.car.dead || r.car.remote) return; const c = r.car, s = r.slot; c.x = s.x; c.z = s.z; c.yaw = s.yaw; c.vx = c.vz = 0; c.yawRate = 0; }
  function holdGuns(c) { for (const g of c.guns) { g.t = Math.max(g.t, 0.3); g.left = 0; } c.boostT = 0; }

  function startRace() {
    // the rivals take the other slots on the grid, in cars tuned to the player's (the quickest at the front)
    LV = RACE.levels[levelId()];
    const me = G.player.spec, near = (PARTS.body[G.player.load.body] || PARTS.body.scrapper).top;
    // online (net.js): the players take the back of the grid in the order they came, and the host's device runs bots
    // in the rest; the other players' cars are puppets, raced by their own devices, which say how many gates they passed
    const NET = G.net, ORDER = [4, 3, 5, 2, 1, 0];
    const mine = NET ? ORDER[NET.slot % 6] : 4, people = NET ? NET.players.map((p) => ORDER[p.slot % 6]) : [4];
    const slots = NET ? (NET.host ? [0, 1, 2, 3, 5, 4].filter((k) => !people.includes(k)).slice(0, NET.bots) : []) : [0, 1, 2, 3, 5];
    slots.forEach((k, n) => {
      const share = LV.speed * (1 + RACE.spread[n]);
      const c = G.addRival(racerBuild(me.top * share, near), { ...grid[k] });
      const t = { top: me.top * share, accel: me.accel * share, turn: me.turn, grip: me.grip };
      tune(c, t);
      c.driver = racer(c, { pace: between(LV.pace), grip: between(LV.grip) });
      join(c, c.name, false, grid[k]).tune = t;
    });
    join(G.player, 'You', true, grid[mine]);
    for (const c of G.cars) if (c.remote && !c.dead && !byCar.has(c)) join(c, c.name, false, null).remote = true;
    for (const r of recs) grab(r);
    phase = 'count'; countT = COUNT; shown = COUNT + 1;
    lights = lights || makeLights();
    // online, a page that was still loading at the start (or reloaded mid-race) goes straight into the race, with the
    // race's clock where everyone else's is; a reloaded one gets its gates back (netLoad) and starts at its last one
    const late = NET && NET.lateBy > 0 ? NET.lateBy : 0;
    if (late > COUNT) { phase = 'race'; raceT = late - COUNT; lights.set(0, 'off'); for (const r of recs) { r.lapT0 = 0; r.lastProg = progressOf(r); } }
    else countT -= late;
  }

  function finishRace() {
    const me = recs.find((r) => r.me); if (!me) return;
    // whoever hasn't finished is placed by how far round they got
    const order = [...recs].sort((a, b) => (a.finished && b.finished ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.progress - a.progress));
    order.forEach((r, k) => { r.place = k + 1; });
    // (a rival still out there when the player is home: how far behind it was at the last gate it passed, and at
    // least the time since the player went through the next one)
    const behind = (r) => { const k = r.passed, a = r.gateT[k], b = me.gateT[k], n = me.gateT[k + 1]; return k >= 1 && a !== undefined && b !== undefined ? Math.max(a - b, n !== undefined ? raceT - n : 0) : null; };
    const still = (r) => { const d = me.finished && r !== me ? behind(r) : null; return d !== null ? `+${d.toFixed(1)} s` : `lap ${Math.min(LAPS, Math.floor(r.passed / NG) + 1)}`; };
    const lines = order.map((r) => `${ord(r.place)}  ${r.name}  ${r.finished ? clock(r.finishT) : still(r)}${r.wrecks ? ` (wrecked ${r.wrecks})` : ''}`);
    lines.push(`Best lap ${me.best ? clock(me.best) : '-'}  ·  You wrecked ${me.kills}  ·  ${LV.name}`);
    const title = me.place === 1 ? 'You win!' : me.finished ? `${ord(me.place)} place` : 'Out of time';
    G.over(title, lines, Math.round(PRIZE[me.place - 1] * LV.prize));
    phase = 'over';
  }

  return {
    // tests: the player's car drives itself round, as it does after the flag (window.__derby.mode.pilot())
    pilot() { const m = recs.find((r) => r.me); if (m) m.car.driver = makeRacer(m.car, race, { autopilot: true, pace: 1, grip: 0.9 }); },
    go: 'Race',
    get tip() { return LV.note || ''; },
    get note() { return `${G.MAP.laps || 3} laps, six cars, guns on. ${LV.note} Tuck in behind a car for a tow.`; },
    // the start card's difficulty buttons (main.js)
    levels: {
      list: Object.entries(RACE.levels).map(([id, L]) => [id, L.name]),
      get: levelId,
      set(id) { if (!RACE.levels[id]) return; G.save.raceLevel = id; LV = RACE.levels[id]; G.keepSave(); },
    },
    start() { startRace(); G.hint(null); },
    step(dt) {
      if (phase === 'grid') return;
      if (phase === 'over') { for (const r of recs) if (!r.car.dead) locate(r, false); return; }   // they drive on behind the results
      const me = recs.find((r) => r.me);
      // the player's car is a new one after a wreck (or the garage): the record follows it
      if (me && G.player && me.car !== G.player) swapCar(me, G.player);
      if (phase === 'count') {
        countT -= dt;
        for (const r of recs) { grab(r); holdGuns(r.car); }
        const n = Math.ceil(countT);
        if (n < shown && n > 0) { shown = n; G.banner(String(n), n === COUNT ? `${LAPS} laps` : ''); G.sfx.play('ui_tab', 1); lights.set({ 3: 2, 2: 4, 1: 5 }[n] || 5, 'red'); }
        if (countT <= 0) {
          phase = 'race'; raceT = 0; G.banner('Go!', ''); G.sfx.play('ui_go', 1); lights.set(5, 'green'); lightsT = 3;
          for (const r of recs) { r.lapT0 = 0; r.lastProg = progressOf(r); }
        }
        return;
      }
      raceT += dt;
      if (lightsT > 0 && (lightsT -= dt) <= 0) lights.set(0, 'off');
      for (const r of recs) {
        const c = r.car;
        if (r.remote) { if (!c.dead) { locate(r, false); r.progress = progressOf(r); } continue; }   // (raced on its own device: netTake)
        if (c.dead) {
          // a wrecked rival comes back at its last gate (the player comes back through main.js, at respawnAt)
          if (!r.me && (r.downT -= dt) <= 0) {
            const nc = G.addCar({ ...c.load }, backAt(r), true);
            if (r.tune) tune(nc, r.tune);
            nc.driver = racer(nc, { pace: (c.driver && c.driver.pace) || 0.96, grip: (c.driver && c.driver.grip) || 0.82 });
            swapCar(r, nc);
            r.lastProg = progressOf(r); r.stuckT = 0;
          }
          continue;
        }
        const moved = locate(r, false);
        // through the next gate, in order: a lap done each time round to the line. A pass is the car's nearest sample
        // moving past the gate (a jump round the lap is not a pass: a car that cut across the inside of a hairpin has its
        // nearest sample jump past the gate at the far end), or its path crossing the gate's line (a car clipping the
        // very inside of a tight corner has its nearest sample swing round the bend faster than a jump)
        const ng = (r.passed + 1) % NG, a = wrapS(gateS[ng] - (r.s - moved));
        if ((moved > 0 && moved < 30 && a > 0 && a <= moved) || through(r, ng)) {
          r.passed++; r.gateT[r.passed] = raceT;
          if (ng === 0) {
            const lapT = raceT - r.lapT0; r.lapT0 = raceT; r.laps.push(lapT); if (!r.best || lapT < r.best) r.best = lapT;
            const done = r.passed / NG;
            if (done >= LAPS && !r.finished) {
              r.finished = true; r.finishT = raceT; r.place = ++finishers;
              if (closeT < 0) closeT = CLOSE;
              if (r.me) {
                G.banner(r.place === 1 ? 'Winner!' : `${ord(r.place)} place`, clock(raceT)); G.sfx.play('ui_go', 1);
                // (the car drives itself on at the player's own speed: at 0.8 it felt like it had slowed, kids' playtest)
                c.driver = makeRacer(c, race, { autopilot: true, pace: 0.97, grip: 0.86 });
                doneT = AFTER; phase = 'done'; G.hint(null);
              } else if (phase === 'race') G.toast(`${r.name} finished ${ord(r.place)}`, clock(raceT));
            } else if (r.me) {
              if (done === LAPS - 1) G.banner('Final lap', `Lap ${clock(lapT)}`); else G.toast(`Lap ${done} ${clock(lapT)}`, r.best === lapT ? 'Best lap' : `Best ${clock(r.best)}`);
              G.sfx.play('ui_coin', 0.8);
            }
          }
        }
        r.progress = progressOf(r);
        // the tow, building up over a moment and fading as fast, and a rival's catch-up: more top speed and pull for
        // the car (main.js stepGadget turns c.lift into its boost)
        r.draft += (tow(r) - r.draft) * Math.min(1, dt * 2.5);
        c.lift = r.draft * RACE.slip.topK + push(r, me); c.liftAccel = r.draft * RACE.slip.accelK;
        // the player: wrong way, or past a gate it missed
        if (r.me && !r.finished) {
          const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), dot = fx * T.TX[r.i] + fz * T.TZ[r.i];
          r.wrongT = dot < -0.35 && Math.abs(c.fwd) > 8 ? r.wrongT + dt : (c.fwd > 8 && dot > 0 ? 0 : r.wrongT);
          const g = r.passed % NG, ahead = wrapS(r.s - gateS[g]), gap = (g + 1 < NG ? gateS[g + 1] : T.L) - gateS[g];
          r.lostT = ahead > gap + 30 || ahead < -160 ? r.lostT + dt : 0;
          const tap = G.TOUCH() ? 'tap here' : '<kbd>R</kbd>';
          G.hint(r.lostT > 0.6 ? `Missed a checkpoint: turn back, or ${tap} to go back to it` : r.wrongT > 0.8 ? `Wrong way! Turn round (${tap}: back on track)` : null);
        }
        // a rival stuck, or lost off its route, for a while goes back to its last gate
        if (!r.me && phase !== 'grid') {
          const g = r.passed % NG, ahead = wrapS(r.s - gateS[g]), gap = (g + 1 < NG ? gateS[g + 1] : T.L) - gateS[g];
          r.lostT = ahead > gap + 30 || ahead < -100 ? r.lostT + dt : 0;
          if (r.progress > r.lastProg + 12) { r.lastProg = r.progress; r.stuckT = 0; } else r.stuckT += dt;
          if (r.lostT > 1.5 || r.stuckT > 6) reset(r);
        }
      }
      // the player done: a moment for the banner, then the results
      if (phase === 'done') {
        if (me) holdGuns(me.car);
        if (me && !me.car.dead) me.car.hp = me.car.maxHp;
        doneT -= dt;
        if (doneT <= 0 || recs.every((r) => r.finished)) finishRace();
      } else if (closeT >= 0 && (closeT -= dt) <= 0) finishRace();
    },
    wrecked(c, who) {
      const r = byCar.get(c), w = who && byCar.get(who);
      if (r) { r.wrecks++; r.downT = RESPAWN; }
      if (w && w !== r) w.kills++;
      c.deadT = Math.max(c.deadT, G.ROUND.wreckStays - 3.2);   // the wreck clears off the track soon after
    },
    playerDown: () => ({ respawn: RESPAWN, noGarage: true, noSkip: true }),
    respawnAt(player) { const r = byCar.get(player) || recs.find((o) => o.me); return r ? backAt(r) : { ...grid[4] }; },
    // back to the last gate on request (R, or a tap on the hint) when lost or facing the wrong way
    resetPlayer() { const r = recs.find((o) => o.me); if (r && phase === 'race' && !r.car.dead && (r.lostT > 0.6 || r.wrongT > 0.8 || r.lat > WL(r.i) + 6 || -r.lat > WR(r.i) + 6)) reset(r); },
    hud() {
      const me = recs.find((r) => r.me), n = recs.length || 6;
      if (phase === 'grid') return ['Race', `${LAPS} laps · 6 cars · ${G.net ? 'online' : LV.name}`];
      if (phase === 'count') return ['Get ready', G.net ? `${n} cars on the grid` : `${ord(5)} on the grid`];
      if (!me) return ['Race', ''];
      if (me.finished) return ['Finished', `${ord(me.place)} of ${n}`];
      const lap = Math.min(LAPS, Math.floor(me.passed / NG) + 1), closing = closeT >= 0 ? ` · ends in ${Math.ceil(closeT)}` : '';
      return [`Lap ${lap}/${LAPS}`, `${ord(place(me))} of ${n} · ${clock(raceT - me.lapT0)}${closing}${me.draft > 0.3 ? ' · Tow!' : ''}`];
    },
    // the race panel (main.js drawRaceHud): the place, big; the lap; the lap times; the whole race as a strip with every
    // car on it; and the order, with the gap in seconds to each car, timed at the last gate both have passed
    raceHud() {
      const me = recs.find((r) => r.me);
      if (!me || phase === 'grid') return null;
      const n = recs.length, total = LAPS * T.L;
      const order = [...recs].sort((a, b) => (a.finished && b.finished ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.progress - a.progress));
      const gap = (o) => {   // seconds o is ahead of the player (minus: behind), or null before they share a gate
        if (o === me) return null;
        if (o.finished && me.finished) return me.finishT - o.finishT;
        const k = Math.min(o.passed, me.passed);
        if (k < 1 || o.gateT[k] === undefined || me.gateT[k] === undefined) return null;
        // and, when one is through a gate the other hasn't reached yet, at least the time since (so a gap grows while
        // the car behind is stuck, instead of waiting for the next gate)
        if (o.passed > me.passed) return Math.max(me.gateT[k] - o.gateT[k], raceT - o.gateT[k + 1]);
        if (me.passed > o.passed) return -Math.max(o.gateT[k] - me.gateT[k], raceT - me.gateT[k + 1]);
        return me.gateT[k] - o.gateT[k];
      };
      const lap = Math.min(LAPS, Math.floor(me.passed / NG) + 1);
      return {
        count: phase === 'count', place: me.finished ? me.place : phase === 'count' ? order.indexOf(me) + 1 : place(me), of: n,
        lap, laps: LAPS, final: lap === LAPS && !me.finished && phase !== 'count', finished: me.finished,
        lapT: phase === 'count' ? 0 : me.finished ? me.finishT : raceT - me.lapT0, best: me.best, total: raceT,
        tow: me.draft > 0.3, closing: closeT >= 0 && !me.finished ? Math.ceil(closeT) : 0,
        order: order.map((o) => ({ name: o.name, me: o.me, gap: Number.isFinite(gap(o)) ? gap(o) : null, dead: o.car.dead, done: o.finished })),
        strip: recs.map((o) => ({ k: clamp(o.finished ? 1 : o.progress / total, 0, 1), me: o.me, dead: o.car.dead, remote: !!o.remote })),
      };
    },
    garageOK: () => false,
    // online: what each car's device says about it (gates passed, its finishing time), and someone else's car coming in
    netState(c) { const r = byCar.get(c); return r ? [r.passed, r.finished ? Math.round(r.finishT * 100) / 100 : 0] : 0; },
    netTake(c, ex) {
      const r = byCar.get(c); if (!r || !Array.isArray(ex)) return;
      while (r.passed < ex[0]) r.gateT[++r.passed] = raceT;
      if (ex[1] && !r.finished) { r.finished = true; r.finishT = ex[1]; r.place = ++finishers; if (closeT < 0) closeT = CLOSE; if (phase === 'race') G.toast(`${r.name} finished ${ord(r.place)}`, clock(r.finishT)); }
    },
    netCar(c, was) {
      if (phase === 'grid') return;
      const r = was && byCar.get(was);
      if (r) { r.car = c; byCar.set(c, r); r.i = -1; locate(r, true); }
      else join(c, c.name, false, null).remote = true;
    },
    adopt(c) {
      const r = byCar.get(c); if (!r) return;
      r.remote = false; r.downT = RESPAWN;
      if (!c.dead) c.driver = racer(c, { pace: between(LV.pace), grip: between(LV.grip) });
    },
    // ...a bot handed to another device (this one was away too long): raced there from now on
    release(c) { const r = byCar.get(c); if (r) r.remote = true; },
    // ...a host's page that reloaded: a bot that was wrecked is back on the track at once
    netRevive(e, make) { make(e); },
    // this player's race, for the relay to keep: a page that reloads mid-race gets its gates and laps back
    netSave() { const r = recs.find((o) => o.me); return r ? { passed: r.passed, laps: r.laps, best: r.best, kills: r.kills, wrecks: r.wrecks } : 0; },
    netLoad(back) {
      const me = recs.find((o) => o.me), k = back && back[G.net.me];
      if (!me || !k || !(k.passed > me.passed) || me.finished) return;
      while (me.passed < k.passed) me.gateT[++me.passed] = raceT;
      me.laps = Array.isArray(k.laps) ? k.laps.slice() : me.laps; me.best = k.best || me.best; me.kills = k.kills | 0; me.wrecks = k.wrecks | 0;
      me.lapT0 = raceT; reset(me);
    },
    // the radar: the player's next gate, blinking
    radar(R, s, ox, oy) {
      const me = recs.find((r) => r.me); if (!me || me.finished || phase === 'grid') return;
      const gi = gates[(me.passed + 1) % NG], x = T.X[gi], z = T.Z[gi], nx = T.TZ[gi], nz = -T.TX[gi];
      R.strokeStyle = (performance.now() / 300) % 2 < 1.3 ? '#ffd23a' : 'rgba(255,210,58,0.35)'; R.lineWidth = 3;
      R.beginPath(); R.moveTo(ox + (x - nx * WR(gi)) * s, oy + (z - nz * WR(gi)) * s); R.lineTo(ox + (x + nx * WL(gi)) * s, oy + (z + nz * WL(gi)) * s); R.stroke();
    },
    // for tests and tools
    get race() { return { recs, phase, raceT, gates, gateS, NG, driver: (c, o) => makeRacer(c, race, o) }; },
  };
}
