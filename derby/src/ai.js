// The rival drivers. Each picks a target (mostly the player, sometimes another rival), drives the map's routes towards
// it (the town's street grid, or the route-finder on open maps), cuts straight across once it has a clear run (through
// a wall if it is going fast enough), shoots once its gun is on and it can see, and rams when close. When it is stuck
// it backs out and tries the other way. On a map with pickups, a hurt rival makes for a repair kit (still shooting at
// its target on the way), and any rival takes a pickup it is about to drive past.
import { solid } from '../../src/world.js';
import { MAP } from './maps/index.js';
import { AI } from './tuning.js';
import { pickupFor } from './pickups.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// a clear line at car height between two points (every 3 voxels)
export function clearLine(x0, z0, x1, z1, y = 3) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 3);
  for (let i = 1; i < n; i++) { const t = i / n; if (solid(Math.floor(x0 + (x1 - x0) * t), y, Math.floor(z0 + (z1 - z0) * t))) return false; }
  return true;
}

export function makeDriver(car) {
  const b = { target: null, pickT: 0, stuckT: 0, backT: 0, backSteer: 1, seenT: 0, wp: { x: car.x, z: car.z }, wobT: 0, wob: [0, 0, 0] };
  car.turretTurn = AI.turretTurn;
  function pick(all, player) {
    const foes = all.filter((o) => o !== car && !o.dead);
    if (car.lastBy && !car.lastBy.dead && Math.random() < 0.6) return car.lastBy;   // get back at whoever hit it last
    if (player && !player.dead && Math.random() > AI.infight) return player;
    let best = null, bd = 1e9;
    for (const o of foes) { const d = Math.hypot(o.x - car.x, o.z - car.z); if (d < bd) { bd = d; best = o; } }
    return best || player;
  }
  function think(dt, all, player) {
    if (car.dead) return;
    b.pickT -= dt;
    if (!b.target || b.target.dead || b.pickT <= 0) { b.target = pick(all, player); b.pickT = 3 + Math.random() * 3; }
    const T = b.target; if (!T) { car.throttle = 0; return; }
    const dx = T.x - car.x, dz = T.z - car.z, d = Math.hypot(dx, dz);
    const sees = d < AI.see && clearLine(car.x, car.z, T.x, T.z, 4);
    // where to drive: to a pickup it wants (looked at again every half second), else straight at the target with a
    // clear run, else along the streets
    b.pkT = (b.pkT || 0) - dt;
    if (b.pkT <= 0) { b.pkT = 0.5; b.pk = pickupFor(car, car.hp < car.maxHp * AI.mend); }
    if (b.pk && !b.pk.up) b.pk = null;
    let gx, gz;
    if (b.pk) { if (clearLine(car.x, car.z, b.pk.x, b.pk.z, 4)) { gx = b.pk.x; gz = b.pk.z; } else { MAP.waypoint(car, b.pk.x, b.pk.z, b.wp); gx = b.wp.x; gz = b.wp.z; } }
    else if (sees || d < 30) { gx = T.x; gz = T.z; } else { MAP.waypoint(car, T.x, T.z, b.wp); gx = b.wp.x; gz = b.wp.z; }
    const want = Math.atan2(gx - car.x, gz - car.z), off = wrap(want - car.yaw), sp = car.fwd;
    if (b.backT > 0) {   // backing out of a corner
      b.backT -= dt; car.throttle = -1; car.steer = b.backSteer; car.brake = 0; car.drift = false;
    } else if (b.fwdT > 0) {   // pulling forward out of a corner it backed into
      b.fwdT -= dt; car.throttle = 1; car.steer = b.backSteer; car.brake = 0; car.drift = false;
    } else {
      car.steer = clamp(off * 2.2, -1, 1);
      car.throttle = Math.abs(off) > 1.4 && sp > 30 ? 0.2 : Math.abs(off) > 2.4 ? -0.6 : 1;
      if (d < AI.ramRange && Math.abs(off) < 0.5) car.throttle = 1;   // floor it into them
      car.brake = Math.abs(off) > 1.1 && sp > 55 ? 0.6 : 0;
      car.drift = Math.abs(off) > 0.9 && sp > 50;
      // feel ahead for walls when not out to smash one
      if (!(sees && sp > 40)) {
        const s = Math.sin(car.yaw), c = Math.cos(car.yaw), look = 14 + Math.abs(sp) * 0.35;
        const hit = (a) => solid(Math.floor(car.x + Math.sin(car.yaw + a) * look), 3, Math.floor(car.z + Math.cos(car.yaw + a) * look));
        if (hit(0)) { const l = hit(0.45), r = hit(-0.45); if (l && !r) car.steer = -1; else if (r && !l) car.steer = 1; }
        void s; void c;
      }
      // stuck: pressing on but going nowhere
      // stuck: pressing on but getting nowhere for a second
      b.chkT = (b.chkT || 0) + dt;
      if (b.chkT > 1.1) { const moved = Math.hypot(car.x - (b.lx ?? car.x + 99), car.z - (b.lz ?? 0)); b.lx = car.x; b.lz = car.z; b.chkT = 0; if (moved < 5 && car.throttle > 0.5) { b.backT = 0.9 + Math.random() * 0.5; b.backSteer = -Math.sign(off || 1); }
        // or backing round to face a target behind it, with something behind it too: pull forward for a moment instead
        else if (moved < 5 && car.throttle < 0) { b.fwdT = 0.8 + Math.random() * 0.4; b.backSteer = Math.sign(off || 1); } }
    }
    // the gun: lead the target a little, wobble, and fire once it has been in sight for a moment
    b.wobT -= dt; if (b.wobT <= 0) { b.wobT = 0.5; for (let i = 0; i < 3; i++) b.wob[i] = (Math.random() - 0.5) * 2 * AI.aimErr; }
    const lead = d / 340;
    car.aim.set(T.x + T.vx * lead + b.wob[0], 3 + b.wob[1] * 0.4, T.z + T.vz * lead + b.wob[2]);
    b.seenT = sees ? b.seenT + dt : 0;
    const g0 = car.guns[0].g, sec = car.guns.find((G) => G.slot === 'secondary'), g1 = sec && sec.g, reach = Math.min(AI.shoot, (g0.range || AI.shoot) * 0.85);
    const arc = car.guns.find((G) => G.g.arc);
    let heavy = sees && b.seenT > AI.reaction + 0.6 && d < AI.shoot && d > 24 && car.onTarget(0.1) && Math.random() < dt * 1.2;
    if (g1 && g1.mine) {   // mines: dropped when someone is on its tail
      heavy = all.some((o) => o !== car && !o.dead && Math.hypot(o.x - car.x, o.z - car.z) < 50 && Math.abs(wrap(Math.atan2(o.x - car.x, o.z - car.z) - car.yaw)) > 2.2) && Math.random() < dt * 1.5;
    }
    // a rocket rack on the roof or side rockets fire at whatever is ahead, mines or not
    if (!heavy && car.guns.some((G) => G.group === 1 && G.cone)) heavy = sees && b.seenT > AI.reaction + 0.6 && d < AI.shoot && d > 20 && Math.abs(wrap(Math.atan2(dx, dz) - car.yaw)) < 0.5 && Math.random() < dt * 1.2;
    car.fire = [(sees && b.seenT > AI.reaction && d < reach && car.onTarget(0.18)) || (arc && d < arc.g.range + 4), heavy];
  }
  return { think, brain: b };
}
