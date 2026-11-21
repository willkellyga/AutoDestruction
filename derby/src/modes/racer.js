// A rival who races (modes/race.js). It drives the circuit's racing line, looking further ahead the faster it goes,
// and takes each bend at the speed its car can hold there (worked out from the car's own turn and top speed), braking
// in time for the tight ones. It moves over to get round a car in its way and keeps off a car alongside. It shoots at
// the cars ahead of it in the race when it can see them, and at the player when the player is close; it fires its
// heavy weapons at cars ahead and drops mines when someone is right behind. When it is stuck it backs out.
//
// race: { T, line, P, HALF, PIT_HALF, phase(), time(), rec(car), pull(car) } from the race mode (pull: a share of its
// pace, a little under 1 for a rival far ahead of the player and a little over for one far behind). A driver made with { autopilot: true }
// only drives (the player's car after the flag).
import { AI } from '../tuning.js';
import { clearLine } from '../ai.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const BRAKE = 150;   // voxels a second, a second: how hard a rival counts on braking (the cars can do about twice that)
const CLOSE = 45;    // how near the player has to be to be shot at when not ahead (and not in the first seconds of the race)
const WOBBLE = 1.4;  // a racer's aim wobbles more than a derby rival's (AI.aimErr): it has the driving to think about

export function makeRacer(car, race, { autopilot = false, pace = 0.96, grip = 0.82 } = {}) {
  const { T, line, P, HALF, PIT_HALF } = race;
  const wrapS = (d) => d - Math.round(d / T.L) * T.L;
  const b = { i: -1, pi: 0, lane: 0, backT: 0, backSteer: 1, chkT: 0, lx: car.x, lz: car.z, target: null, pickT: 0, seenT: 0, wobT: 0, wob: [0, 0, 0], ahead: { x: 0, z: 0 } };
  car.turretTurn = AI.turretTurn;
  const lim = HALF - 6;
  // the fastest the car can go round a bend of curvature k (1 / radius): its turn rate falls off a little with speed
  const cornerSpeed = (k) => { const S = car.spec, t = S.turn * grip; return Math.min(S.top * pace, t / (k + 0.25 * t / S.top + 1e-6)); };

  function drive(dt, all) {
    const S = car.spec, p = T.project(car.x, car.z, b.i, 40); b.i = p.i;
    const v = car.fwd, sp = Math.abs(v), me = race.rec(car);
    // in the pit lane: follow it out
    const k = Math.floor(car.z) * T.field.WX + Math.floor(car.x);
    const inPit = P && P.field.dist[k] < PIT_HALF + 1 && T.field.dist[k] > HALF + 1;
    let tx, tz, vmax = Math.min(S.top, S.top * pace * race.pull(car)), look = 12 + sp * 0.3;
    if (inPit) {
      let best = b.pi, bd = 1e9;
      for (let j = Math.max(0, b.pi - 20); j < Math.min(P.N, b.pi + 20); j++) { const d = Math.hypot(P.X[j] - car.x, P.Z[j] - car.z); if (d < bd) { bd = d; best = j; } }
      if (bd > 20) for (let j = 0; j < P.N; j++) { const d = Math.hypot(P.X[j] - car.x, P.Z[j] - car.z); if (d < bd) { bd = d; best = j; } }
      b.pi = best; const j = Math.min(P.N - 1, best + Math.round(look / P.STEP));
      tx = P.X[j]; tz = P.Z[j]; vmax = Math.min(vmax, 60);
    } else {
      // move over for a car in the way ahead, and keep off one alongside
      let want = 0, near = 1e9;
      const myLine = line.off[p.i];
      for (const o of all) {
        if (o === car || o.dead || o.gone) continue;
        const r = race.rec(o); if (!r || r.i < 0) continue;
        const ds = wrapS(r.s - (me ? me.s : p.s)), dl = r.lat - p.lat;
        if (Math.abs(ds) < 14 && Math.abs(dl) < 13) { want += (dl > 0 ? -1 : 1) * 7; continue; }
        if (ds < 0 || ds > 36 + sp * 0.45 || ds > near) continue;
        if (Math.abs(r.lat - (myLine + b.lane)) > 13) continue;
        near = ds;
        const left = r.lat + 15, right = r.lat - 15;
        const side = left > lim ? right : right < -lim ? left : Math.abs(left - p.lat) < Math.abs(right - p.lat) ? left : right;
        want += side - myLine;
        if (ds < 22 && Math.abs(dl) < 11 && r.car && r.car.fwd < v) vmax = Math.min(vmax, Math.max(30, r.car.fwd + 4));   // boxed in: hang back
      }
      b.lane += clamp(want - b.lane, -34 * dt, 34 * dt);
      b.lane = clamp(b.lane, -lim - myLine, lim - myLine);
      const j = T.at(p.i + Math.round(look / T.STEP)), off = clamp(line.off[j] + b.lane, -lim, lim);
      tx = T.X[j] + T.TZ[j] * off; tz = T.Z[j] - T.TX[j] * off;
      // the bends coming up, as far ahead as it would need to brake for them
      const reach = sp * sp / (2 * BRAKE) + 24;
      for (let d = 0; d < reach; d += T.STEP * 2) {
        const vc = cornerSpeed(line.bend[T.at(p.i + Math.round(d / T.STEP))] * (1 + Math.abs(b.lane) / 40));
        const allow = Math.sqrt(vc * vc + 2 * BRAKE * Math.max(0, d - 8));
        if (allow < vmax) vmax = allow;
      }
      // off the road: back on to it
      if (Math.abs(p.lat) > HALF + 2) { const jj = T.at(p.i + 4); tx = T.X[jj]; tz = T.Z[jj]; }
    }
    b.ahead.x = tx; b.ahead.z = tz;
    // steer for the point ahead (pure pursuit: the bend that goes through it, as a share of the car's full lock)
    const ang = wrap(Math.atan2(tx - car.x, tz - car.z) - car.yaw), Ld = Math.max(8, Math.hypot(tx - car.x, tz - car.z));
    const kk = clamp(sp / 26, 0.15, 1) * (1 - 0.25 * clamp(sp / S.top, 0, 1));
    if (b.backT > 0) {   // backing out of a wall or a tangle
      b.backT -= dt; car.throttle = -1; car.steer = b.backSteer; car.brake = 0; car.drift = false; return;
    }
    car.steer = clamp(Math.max(sp, 20) * 2 * Math.sin(ang) / (Ld * S.turn * kk) * 1.1, -1, 1);
    if (Math.abs(ang) > 1.6) { car.steer = Math.sign(ang); vmax = Math.min(vmax, 30); }
    car.drift = false;
    if (v > vmax + 3) { car.throttle = 0; car.brake = clamp((v - vmax) / 25, 0.25, 1); }
    else { car.throttle = v < vmax - 3 ? 1 : 0.45; car.brake = 0; }
    // stuck: pressing on but going nowhere for a second
    b.chkT += dt;
    if (b.chkT > 1) {
      const moved = Math.hypot(car.x - b.lx, car.z - b.lz); b.lx = car.x; b.lz = car.z; b.chkT = 0;
      if (moved < 4 && car.throttle > 0.4) { b.backT = 0.7 + Math.random() * 0.4; b.backSteer = -Math.sign(ang || 1); }
    }
  }

  // who to shoot: the nearest car ahead of it in the race that it can see in front, or the player when close
  function pick(all, player) {
    const me = race.rec(car); let best = null, bs = 1e9;
    for (const o of all) {
      if (o === car || o.dead || o.gone) continue;
      const r = race.rec(o); if (r && r.finished) continue;
      const dx = o.x - car.x, dz = o.z - car.z, d = Math.hypot(dx, dz); if (d > AI.shoot) continue;
      const front = Math.abs(wrap(Math.atan2(dx, dz) - car.yaw)) < 1.1, ahead = r && me && r.progress > me.progress;
      let score;
      if (o === player && d < CLOSE && race.time() > 5) score = d * 0.6;
      else if (ahead && front) score = d;
      else continue;
      if (score < bs && clearLine(car.x, car.z, o.x, o.z, 4)) { bs = score; best = o; }
    }
    return best;
  }
  function shoot(dt, all, player) {
    b.pickT -= dt;
    if (b.pickT <= 0 || (b.target && (b.target.dead || b.target.gone))) { b.pickT = 0.35 + Math.random() * 0.3; const t = pick(all, player); if (t !== b.target) b.seenT = 0; b.target = t; }
    const Tg = b.target, me = race.rec(car);
    b.wobT -= dt; if (b.wobT <= 0) { b.wobT = 0.5; for (let i = 0; i < 3; i++) b.wob[i] = (Math.random() - 0.5) * 2 * AI.aimErr * WOBBLE; }
    let gun = false, heavy = false;
    const sec = car.guns.find((G) => G.slot === 'secondary'), mines = sec && sec.g.mine, arc = car.guns.find((G) => G.g.arc);
    if (Tg) {
      const dx = Tg.x - car.x, dz = Tg.z - car.z, d = Math.hypot(dx, dz), lead = d / 340;
      car.aim.set(Tg.x + Tg.vx * lead + b.wob[0], 3 + b.wob[1] * 0.4, Tg.z + Tg.vz * lead + b.wob[2]);
      b.seenT += dt;
      const g0 = car.guns[0].g, reach = Math.min(150, (g0.range || AI.shoot) * 0.85), r = race.rec(Tg);
      gun = b.seenT > AI.reaction && d < reach && car.onTarget(0.18);
      if (Tg === player && b.seenT % 1.8 > 1) gun = false;   // at the player, in bursts: it gets a moment to get away
      if (arc && d < arc.g.range + 4) gun = true;
      const inFront = Math.abs(wrap(Math.atan2(dx, dz) - car.yaw)) < 0.4, ahead = r && me && r.progress > me.progress;
      if (!mines || car.guns.some((G) => G.group === 1 && G.cone)) heavy = ahead && b.seenT > AI.reaction + 0.5 && d > 26 && d < 210 && (inFront || car.onTarget(0.1)) && Math.random() < dt * 0.9;
    } else {
      // nothing to shoot: the gun looks down the road
      car.aim.set(b.ahead.x, 3, b.ahead.z); b.seenT = 0;
    }
    // mines: dropped when someone is right on its tail
    if (mines && me) {
      for (const o of all) {
        if (o === car || o.dead || o.gone) continue;
        const r = race.rec(o); if (!r) continue;
        const gap = me.progress - r.progress;
        if (gap > 0 && gap < 50 && Math.hypot(o.x - car.x, o.z - car.z) < 45 && Math.random() < dt * 0.8) { heavy = true; break; }
      }
    }
    car.fire = [gun, heavy];
  }

  function think(dt, all, player) {
    if (car.dead) return;
    const ph = race.phase();
    if (ph !== 'race' && ph !== 'done' && ph !== 'over') { car.throttle = 0; car.brake = 1; car.steer = 0; car.fire = []; return; }
    drive(dt, all);
    const me = race.rec(car);
    if (autopilot || ph === 'over' || (me && me.finished)) { car.fire = []; car.aim.set(b.ahead.x, 3, b.ahead.z); return; }
    shoot(dt, all, player);
  }
  return { think, brain: b, racer: true, pace, grip };
}
