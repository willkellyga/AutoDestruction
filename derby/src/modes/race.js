// The race: three laps of the map's circuit (its `track`: see maps/race.js, the street course, and maps/bowtie.js) with
// the guns on.
//
// Six cars line up on the grid, the player fifth, and are held there through a 3-2-1 countdown (with lights on the
// start gantry). Laps are counted through checkpoint gates spaced round the lap, which have to be passed in order, so
// cutting across the infield gains nothing. The HUD has the lap and the player's place, a warning when going the wrong
// way or past a missed gate, and the radar shows the next gate. A wrecked car, the player's too, comes back at the last
// gate it passed, facing the right way, after RESPAWN seconds: wrecking someone costs them time. When the player takes
// the flag the car drives itself and the rivals race on for a few seconds; then the results, with scrap for the place
// and for every rival wrecked. If a rival wins and the player is still out there, the race closes after a while.
import * as THREE from 'three';
import { makeRacer } from './racer.js';

const LAPS = 3, RESPAWN = 2.5, COUNT = 3;
const PRIZE = [300, 200, 120, 80, 50, 30];   // by place (each rival you wreck already pays 100 as it happens)
const TIERS = [1, 1, 2, 1, 2];        // the rivals' builds (rivalBuild in parts.js), front of the grid first
const CLOSE = 40;                     // seconds the race stays open after the winner finishes
const AFTER = 9;                      // seconds the rivals race on after the player finishes, before the results
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ord = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

export function makeRace(G) {
  const TR = G.MAP.track;
  const { T, line, P, gates, gateS, grid, HALF, PIT_HALF } = TR, NG = gates.length;
  const wrapS = (d) => d - Math.round(d / T.L) * T.L;
  // the room left and right of the centre line at sample i (a street course measures it: T.WL, T.WR)
  const WL = (i) => (T.WL ? T.WL[i] : HALF), WR = (i) => (T.WR ? T.WR[i] : HALF);
  const recs = [];                     // one for each car in the race: see join()
  const byCar = new Map();
  let phase = 'grid', countT = 0, raceT = 0, shown = 0, closeT = -1, doneT = -1, finishers = 0, lights = null, lightsT = -1;
  const race = { T, line, P, HALF, PIT_HALF, phase: () => phase, time: () => raceT, rec: (c) => byCar.get(c), pull };

  // a car joins the race (or comes back): its record follows it to its new car
  function join(car, name, me, slot) {
    const r = { car, name, me, slot, i: -1, s: 0, lat: 0, passed: 0, lapT0: 0, laps: [], best: 0, wrecks: 0, kills: 0, finished: false, finishT: 0, place: 0, downT: 0, wrongT: 0, lostT: 0, stuckT: 0, lastProg: 0, progress: 0, resets: 0 };
    recs.push(r); byCar.set(car, r); locate(r, true);
    return r;
  }
  function swapCar(r, car) { r.car = car; byCar.set(car, r); r.i = -1; locate(r, true); }   // the old car keeps its record: its mines still count
  // where the car is round the lap: the nearest sample (searched round the last one, so a car at the crossover stays
  // on its own half), how far along, and across
  function locate(r, fresh) {
    const p = T.project(r.car.x, r.car.z, fresh ? -1 : r.i, 40);
    const prev = r.s; r.i = p.i; r.lat = p.lat; r.s = ((p.s % T.L) + T.L) % T.L;
    return fresh ? 0 : wrapS(r.s - prev);
  }
  // how far into the race: gates passed, and how far past the last one (for the places)
  function progressOf(r) {
    const g = r.passed % NG, base = Math.floor(r.passed / NG) * T.L + gateS[g], next = g + 1 < NG ? gateS[g + 1] : T.L;
    return base + clamp(wrapS(r.s - gateS[g]), -150, next - gateS[g]);
  }
  // a rival well ahead of the player eases off a little, and one well behind pushes a little, so the race stays a race
  function pull(c) {
    const r = byCar.get(c), me = recs.find((o) => o.me);
    if (!r || r.me || !me || me.finished || phase !== 'race') return 1;
    const gap = r.progress - me.progress;
    return gap > 100 ? 1 - Math.min(0.08, (gap - 100) / 2500) : gap < -150 ? 1 + Math.min(0.04, (-gap - 150) / 3000) : 1;
  }
  const place = (r) => 1 + recs.filter((o) => o !== r && (o.finished ? !r.finished || o.finishT < r.finishT : !r.finished && o.progress > r.progress)).length;

  // where a car comes back: at its last gate, on the road and clear of the other cars, facing on round the lap
  function backAt(r) {
    const gi = gates[r.passed % NG];
    for (const back of [0, 14, 28, 42]) for (const lat of [0, -12, 12, -20, 20]) {
      const i = T.at(gi - Math.round(back / T.STEP)), x = T.X[i] + T.TZ[i] * lat, z = T.Z[i] - T.TX[i] * lat;
      if (T.WL && (lat > WL(i) - 5 || -lat > WR(i) - 5)) continue;   // too near the kerb on a street
      if (G.cars.some((c) => !c.gone && (c !== r.car || c.dead) && Math.hypot(c.x - x, c.z - z) < 18)) continue;   // wrecks too
      return { x, z, yaw: Math.atan2(T.TX[i], T.TZ[i]) };
    }
    return { x: T.X[gi], z: T.Z[gi], yaw: Math.atan2(T.TX[gi], T.TZ[gi]) };
  }
  // put a car back on the track at its last gate without a wreck (stuck, or lost off the route)
  function reset(r) {
    const at = backAt(r), c = r.car;
    c.x = at.x; c.z = at.z; c.yaw = at.yaw; c.vx = c.vz = 0; c.yawRate = 0; c.gunYaw = at.yaw;
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

  function grab(r) { if (r.car.dead) return; const c = r.car, s = r.slot; c.x = s.x; c.z = s.z; c.yaw = s.yaw; c.vx = c.vz = 0; c.yawRate = 0; }
  function holdGuns(c) { for (const g of c.guns) { g.t = Math.max(g.t, 0.3); g.left = 0; } c.boostT = 0; }

  function startRace() {
    // the rivals take the other slots on the grid
    const slots = [0, 1, 2, 3, 5];
    slots.forEach((k, n) => {
      const c = G.addRival(TIERS[n], { ...grid[k] });
      c.driver = makeRacer(c, race, { pace: 0.94 + Math.random() * 0.05, grip: 0.8 + Math.random() * 0.06 });
      join(c, c.name, false, grid[k]);
    });
    join(G.player, 'You', true, grid[4]);
    for (const r of recs) grab(r);
    phase = 'count'; countT = COUNT; shown = COUNT + 1;
    lights = lights || makeLights();
  }

  function finishRace() {
    const me = recs.find((r) => r.me); if (!me) return;
    // whoever hasn't finished is placed by how far round they got
    const order = [...recs].sort((a, b) => (a.finished && b.finished ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.progress - a.progress));
    order.forEach((r, k) => { r.place = k + 1; });
    const lines = order.map((r) => `${ord(r.place)}  ${r.name}  ${r.finished ? clock(r.finishT) : `lap ${Math.min(LAPS, Math.floor(r.passed / NG) + 1)}`}${r.wrecks ? ` (wrecked ${r.wrecks})` : ''}`);
    lines.push(`Best lap ${me.best ? clock(me.best) : '-'}  ·  You wrecked ${me.kills}`);
    const title = me.place === 1 ? 'You win!' : me.finished ? `${ord(me.place)} place` : 'Out of time';
    G.over(title, lines, PRIZE[me.place - 1]);
    phase = 'over';
  }

  return {
    go: 'Start the race',
    note: 'Three laps, six cars, guns on. Wreck whoever gets in front, and take the checkpoints in order.',
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
        if (c.dead) {
          // a wrecked rival comes back at its last gate (the player comes back through main.js, at respawnAt)
          if (!r.me && (r.downT -= dt) <= 0) {
            const nc = G.addCar({ ...c.load }, backAt(r), true);
            nc.driver = makeRacer(nc, race, { pace: (c.driver && c.driver.pace) || 0.96, grip: (c.driver && c.driver.grip) || 0.82 });
            swapCar(r, nc);
            r.lastProg = progressOf(r); r.stuckT = 0;
          }
          continue;
        }
        const moved = locate(r, false);
        // through the next gate, in order: a lap done each time round to the line (a jump round the lap is not a pass:
        // a car that cut across the inside of a hairpin has its nearest sample jump past the gate at the far end)
        if (moved > 0 && moved < 30) {
          const ng = (r.passed + 1) % NG, a = wrapS(gateS[ng] - (r.s - moved));
          if (a > 0 && a <= moved) {
            r.passed++;
            if (ng === 0) {
              const lapT = raceT - r.lapT0; r.lapT0 = raceT; r.laps.push(lapT); if (!r.best || lapT < r.best) r.best = lapT;
              const done = r.passed / NG;
              if (done >= LAPS && !r.finished) {
                r.finished = true; r.finishT = raceT; r.place = ++finishers;
                if (closeT < 0) closeT = CLOSE;
                if (r.me) {
                  G.banner(r.place === 1 ? 'Winner!' : `${ord(r.place)} place`, clock(raceT)); G.sfx.play('ui_go', 1);
                  c.driver = makeRacer(c, race, { autopilot: true, pace: 0.8 }); doneT = AFTER; phase = 'done'; G.hint(null);
                } else if (phase === 'race') G.toast(`${r.name} finished ${ord(r.place)}`, clock(raceT));
              } else if (r.me) {
                if (done === LAPS - 1) G.banner('Final lap', `Lap ${clock(lapT)}`); else G.toast(`Lap ${done} ${clock(lapT)}`, r.best === lapT ? 'Best lap' : `Best ${clock(r.best)}`);
                G.sfx.play('ui_coin', 0.8);
              }
            }
          }
        }
        r.progress = progressOf(r);
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
      // the player done: the rivals race on a little, then the results
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
      if (phase === 'grid') return ['Race', `${LAPS} laps · 6 cars`];
      if (phase === 'count') return ['Get ready', `${ord(5)} on the grid`];
      if (!me) return ['Race', ''];
      if (me.finished) return ['Finished', `${ord(me.place)} of ${n}`];
      const lap = Math.min(LAPS, Math.floor(me.passed / NG) + 1), closing = closeT >= 0 ? ` · ends in ${Math.ceil(closeT)}` : '';
      return [`Lap ${lap}/${LAPS}`, `${ord(place(me))} of ${n} · ${clock(raceT - me.lapT0)}${closing}`];
    },
    garageOK: () => false,
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
