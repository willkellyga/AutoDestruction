// A combat car: a body, wheels, guns and a ram built from a build in the garage (carmodel.js, parts.js), arcade
// driving, and crashes that knock holes in the town through the game's own blast() (src/sim.js).
// The car's model space has +z forward and +x to the car's left; yaw 0 faces +z.
import * as THREE from 'three';
import { Unit } from '../../units/src/unit.js';
import { solid, idx, ownerAt, bodies, WX, WZ } from '../../src/world.js';
import { blast, dust } from '../../src/sim.js';
import { CRASH, DRIFT } from './tuning.js';
import { MAP } from './maps/index.js';
import { carDef, LOOSE } from './carmodel.js';
import { PARTS, statsOf } from './parts.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

let SEED = 1;
// A car's body is rebuilt after it is hit, which costs a millisecond or two. Hits pile up between rebuilds: each car is
// rebuilt at most about twelve times a second, and no more than three cars in one frame (newFrame resets the count).
let rebuilds = 3;
export function newFrame() { rebuilds = 3; }
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _lp = new THREE.Vector3(), _ld = new THREE.Vector3(), _inv = new THREE.Matrix4();

export class Vehicle {
  constructor(scene, mats, load, at) {
    this.load = load; this.name = load.name || 'You';
    this.spec = statsOf(load);
    const seed = SEED++;
    this.def = carDef(load, seed);
    this.unit = new Unit(this.def, mats, { seed });
    Object.assign(this.unit.state, { spin: 0, steer: 0, roll: 0, pitch: 0, bob: 0, yaw: 0, aim: 0, gunSpin: 0, saw: 0, coneYaw: 0, coneAim: 0, arc: 0 });
    const D = this.def.dims;
    this.half = D.half; this.mid = D.mid; this.wide = D.wide; this.top = D.top; this.wheelR = D.wheelR;
    scene.add(this.unit.root);
    this.maxHp = this.spec.hp; this.hp = this.maxHp;
    this.x = at.x; this.z = at.z; this.yaw = at.yaw || 0; this.vx = 0; this.vz = 0; this.yawRate = 0;
    this.steer = 0; this.throttle = 0; this.brake = 0; this.boost = 1; this.accelK = 1;
    this.aimYaw = this.yaw; this.aimPitch = 0; this.gunYaw = this.yaw; this.gunPitch = 0; this.turretTurn = 9;
    this.aim = new THREE.Vector3(at.x, 3, at.z + 40);
    // every weapon on the car: which trigger it answers (group 0 the guns, left click; group 1 the heavy weapons, right
    // click), and the barrels it fires from (a bone of the model and a point on it). The main gun always comes first.
    const M = this.def.muzzles;
    this.guns = [];
    const add = (slot, key, mounts) => {
      const g = PARTS[slot][key]; if (!g || !(g.dmg || g.mine)) return;
      const group = slot === 'primary' ? 0 : slot === 'secondary' ? 1 : g.group === 'heavy' ? 1 : 0;
      this.guns.push({ slot, key, g, group, mounts: mounts.filter((m) => m && m.p), next: 0, t: 0, left: 0, gapT: 0, cone: g.cone || 0 });
    };
    // (a model without barrels for the roof or doors fires them from the body: the front of the roof, the front doors)
    const D0 = this.def.dims, mount = (x, y, z) => ({ bone: 'body', p: [x, y - D0.lift, z] });
    add('primary', PARTS.primary[load.primary] ? load.primary : 'mg', [{ bone: 'gun', p: M.gun }]);
    if (load.roof && load.roof !== 'none') add('roof', load.roof, M.roof && M.roof.length ? M.roof : [mount(0.7, D0.roof + 0.5, D0.mid + D0.half * 0.3), mount(-0.7, D0.roof + 0.5, D0.mid + D0.half * 0.3)]);
    if (load.door && load.door !== 'none') add('door', load.door, M.door && M.door.length ? M.door : [mount(D0.wide + 0.4, 2, D0.mid + D0.half * 0.4), mount(-D0.wide - 0.4, 2, D0.mid + D0.half * 0.4)]);
    if (load.secondary && load.secondary !== 'none') add('secondary', load.secondary, [{ bone: M.podBone, p: M.pod }]);
    this.gadget = this.spec.gadget; this.gadgetT = 0; this.boostT = 0;
    this.dead = false; this.deadT = 0; this.gone = false; this.hurtT = 0; this.lastBy = null;
    this.smashT = 0; this.scrape = 0; this.spinA = 0; this.firing = 0;
    // drifting (see handbrake()): how far the back is out, the handbrake's braking, how long a slide has been held, the
    // burst after one, the slip angle, how hard the tyres skid, and how loose this car's tyres let the back go
    this.drift = false; this.slide = 0; this.hbBrake = 0; this.driftT = 0; this.miniT = 0; this.slipA = 0; this.skid = 0;
    this.loose = DRIFT.tyres[load.wheels] || 1;
  }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get fwd() { return this.vx * Math.sin(this.yaw) + this.vz * Math.cos(this.yaw); }

  // ---- driving ----------------------------------------------------------------------------------------------
  // The car's velocity, taken forwards (vf) and sideways (vs) to where it points. Gripping, the velocity turns with
  // the car and any sideways slide dies away fast (S.grip). With the handbrake held while steering at speed the back
  // lets go (slide, 0 to 1, see handbrake()): the car yaws faster than its velocity follows, so it slides at an angle,
  // the slide dies away slowly, and most of the speed it scrubs off carries on forwards. slide 0 is the plain grip
  // driving the racers use.
  step(dt, hooks) {
    const S = this.spec, sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let vf = this.vx * sy + this.vz * cy, vs = this.vx * cy - this.vz * sy;   // forwards, and sideways to the left
    if (this.dead) { this.throttle = 0; this.steer = 0; this.brake = 1; }
    const d = this.handbrake(dt, vf, vs, hooks);
    // engine, brakes and drag
    const t = this.throttle;
    // rough ground (a map's grass and gravel: MAP.surface gives 0 on the road up to 1) holds a car back and makes it
    // slide; off-road and monster tyres hardly feel it (S.rough)
    const rough = MAP.surface ? MAP.surface(this.x, this.z) * S.rough : 0;
    const mini = this.miniT > 0 ? Math.min(1, this.miniT / 0.3) : 0;   // a drift's burst, fading over its last 0.3 s
    const top = S.top * this.boost * (1 - 0.45 * rough) * (1 + (DRIFT.boost.topK - 1) * mini), acc = S.accel * this.accelK * (1 + (DRIFT.boost.accelK - 1) * mini);
    const vEng = d > 0 ? Math.hypot(vf, vs) : vf;   // sliding, the engine pulls against the whole speed
    if (t > 0) vf += (vf < 0 ? acc * 2.2 : acc * (1 - Math.max(0, vEng) / top * 0.7)) * t * dt;
    else if (t < 0) vf += (vf > 0 ? -S.accel * 2.2 : -S.accel * 0.8 * (1 + vf / S.back)) * -t * dt;
    else vf *= Math.exp(-0.55 * dt);
    const brake = Math.max(this.brake, this.hbBrake);
    if (brake) vf *= Math.exp(-(this.dead ? 2.2 : 3.5) * brake * dt);
    vf = clamp(vf, -S.back, rough > 0 && vf > top ? top + (vf - top) * Math.exp(-2.4 * dt) : top);   // ploughing onto grass slows a car over a moment
    // turning: none standing still, full at about a third of top speed, a little less flat out; faster with the back out
    const k = clamp(Math.abs(vf) / 26, 0, 1) * (1 - 0.25 * clamp(Math.abs(vf) / S.top, 0, 1));
    const want = this.steer * S.turn * k * Math.sign(vf || 1) * (1 + (DRIFT.turn - 1) * d);
    this.yawRate += (want - this.yawRate) * Math.min(1, dt * (10 + 8 * d));   // (the nose swings round quicker with the back out)
    const turned = this.yawRate * dt;
    this.yaw = wrap(this.yaw + turned);
    let g = S.grip * (1 - 0.35 * rough);
    if (d > 0) {
      // the velocity follows only part of the turn: the rest swings the nose past the way the car is going
      const lag = -turned * d * (1 - DRIFT.follow), lc = Math.cos(lag), ls = Math.sin(lag);
      const f = vf * lc - vs * ls; vs = vf * ls + vs * lc; vf = f;
      g += (DRIFT.rearGrip / this.loose * (1 - DRIFT.power * Math.max(0, t)) - g) * d;
    }
    // grip: sideways sliding dies away
    const vs0 = vs;
    vs *= Math.exp(-g * dt);
    if (d > 0 && vf > 0) {
      // what the slide loses sideways mostly carries on forwards, so a drift keeps its pace; never past top speed,
      // and never further off the line than maxAngle
      vf = Math.sqrt(vf * vf + DRIFT.keep * Math.min(1, d * 3) * (vs0 * vs0 - vs * vs));
      const m = DRIFT.maxAngle;
      if (Math.abs(vs) > vf * Math.tan(m)) { const sp = Math.hypot(vf, vs); vf = sp * Math.cos(m); vs = Math.sign(vs) * sp * Math.sin(m); }
      const sp = Math.hypot(vf, vs); if (sp > top) { vf *= top / sp; vs *= top / sp; }
    }
    const ny = Math.sin(this.yaw), nyc = Math.cos(this.yaw);
    this.vx = ny * vf + nyc * vs; this.vz = nyc * vf - ny * vs;
    this.scrape = Math.abs(vs);
    this.slipA = vf > 4 ? Math.atan2(vs, vf) : 0;   // how far the travel is off the nose (+ to the left)
    // how hard the tyres are skidding, for the marks, the smoke and the sound (drift.js): sliding sideways, or the back
    // wheels locked by the handbrake
    this.skid = this.dead ? 0 : Math.max(clamp((Math.abs(vs) - 8) / 25, 0, 1), this.hbBrake === DRIFT.stop && vf > 20 ? 0.55 : 0);
    this.collide(dt, hooks);
    this.x = clamp(this.x, 8, WX - 8); this.z = clamp(this.z, 8, WZ - 8);
  }
  // The handbrake: steered at speed (or still sliding) the back lets go, straight it is a brake. Returns how far out
  // the back is (0 to 1), and sets the handbrake's own braking. A slide held at an angle long enough gives a burst
  // when it ends (hooks.drift tells main.js, for the HUD and the sound).
  handbrake(dt, vf, vs, hooks) {
    const D = DRIFT, hb = this.drift && !this.dead;
    this.miniT = Math.max(0, (this.miniT || 0) - dt);
    const sliding = vf > 4 && Math.abs(Math.atan2(vs, vf)) > D.holdAngle && this.slide > 0.3;
    const go = hb && (Math.abs(this.steer) >= D.steerMin || sliding);
    const reach = go ? clamp((vf - D.minSpeed * 0.5) / (D.minSpeed * 0.5), 0, 1) : 0;
    this.slide += clamp(reach - this.slide, -dt / D.recover, dt / D.kickIn);
    this.hbBrake = !hb ? 0 : go ? D.drag : D.stop;
    // a slide held at an angle counts towards a burst; when it ends, the burst
    if (reach > 0) { if (this.slide > 0.7 && Math.abs(Math.atan2(vs, Math.max(1, vf))) > D.boost.angle) this.driftT += dt; }
    else if (this.driftT > 0) {
      const lvl = this.driftT >= D.boost.after2 ? 2 : this.driftT >= D.boost.after ? 1 : 0;
      if (lvl && vf > D.minSpeed * 0.8) { this.miniT = D.boost.time * lvl; if (hooks && hooks.drift) hooks.drift(this, lvl); }
      this.driftT = 0;
    }
    return this.slide;
  }
  // the points round the car that feel for walls, in the car's own space (left, forward)
  probes() {
    const h = this.half - 0.3, w = this.wide - 0.2, m = this.mid, P = [];
    for (const lx of [-w, -w / 3, w / 3, w]) { P.push([lx, m + h, 0]); P.push([lx, m - h, 1]); }
    for (const lz of [-h * 0.6, 0, h * 0.6]) { P.push([w, m + lz, 2]); P.push([-w, m + lz, 2]); }
    return P;
  }
  hits(x, z, yaw, out) {
    const s = Math.sin(yaw), c = Math.cos(yaw); let n = 0;
    out.front = 0; out.back = 0; out.side = 0; out.soft = 0; out.hard = 0; out.wall = 0; out.x = 0; out.y = 0; out.z = 0;
    for (const [lx, lz, kind] of this.probes()) {
      const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
      for (const y of [2, 4]) {
        const ix = Math.floor(wx), iz = Math.floor(wz);
        if (!solid(ix, y, iz)) continue;
        const b = bodies[ownerAt(idx(ix, y, iz))], soft = !b || b.kind === 'rubble' || b.kind === 'prop';
        if (soft) out.soft++; else out.hard++;
        if (b && b.kind === 'barrier') out.wall++;   // a map's barriers: a car bounces off, however fast
        if (kind === 0) out.front++; else if (kind === 1) out.back++; else out.side++;
        out.x += wx; out.y += y; out.z += wz; n++;
        break;
      }
    }
    if (n) { out.x /= n; out.y /= n; out.z /= n; }
    return n;
  }
  collide(dt, hooks) {
    const ox = this.x, oz = this.z, nx = ox + this.vx * dt, nz = oz + this.vz * dt, H = this._h || (this._h = {});
    // already in something (rubble came down on it, a wreck is in it): shove it aside
    if (this.hits(ox, oz, this.yaw, H) && (this.smashT -= dt) <= 0) {
      this.smashT = 0.12;
      blast(H.x, H.y, H.z, 2.6, { push: 8, maxDebris: 30, core: 0.2, pushDebris: false });
    }
    if (!this.hits(nx, nz, this.yaw, H)) { this.x = nx; this.z = nz; return; }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), vf = this.vx * sy + this.vz * cy, vs = this.vx * cy - this.vz * sy;
    const into = H.front > H.back ? Math.max(0, vf) : H.back > H.front ? Math.max(0, -vf) : Math.abs(vs);
    const sp = this.speed;
    // what is only rubble, a lamp or a bin goes down at any speed; walls need some pace
    if (!H.wall && ((H.hard === 0 && sp > 3) || into > CRASH.smash)) {
      const r = H.hard === 0 ? 2.8 : (CRASH.hole + (into - CRASH.smash) * CRASH.holeK) * this.spec.ram;
      const dx = this.vx / (sp || 1), dz = this.vz / (sp || 1);
      const n = blast(H.x + dx * 1.5, 3.2, H.z + dz * 1.5, r, { ys: 0.9, dx: dx * 0.9, dz: dz * 0.9, dy: 0.25, push: 12 + into * 0.18, maxDebris: 160, core: 0.3, hard: 0.85 });
      if (n > 0) {
        const keep = Math.max(H.hard === 0 ? 0.85 : 0.4, 1 - n / CRASH.slow * (H.hard === 0 ? 0.3 : 1));
        this.vx *= keep; this.vz *= keep; this.x = nx; this.z = nz;
        if (H.hard) hooks.smash(this, into, H, n);
        return;
      }
    }
    // stopped: back off a touch and lose the speed going into it
    if (H.front > H.back && vf > 0) { this.vx -= sy * vf * 1.3; this.vz -= cy * vf * 1.3; }
    else if (H.back > H.front && vf < 0) { this.vx -= sy * vf * 1.3; this.vz -= cy * vf * 1.3; }
    else { this.vx -= cy * vs * 1.4; this.vz += sy * vs * 1.4; }
    if (into > CRASH.smash * 0.5) hooks.bump(this, into, H);
  }

  // ---- guns -------------------------------------------------------------------------------------------------
  // turn the mount and the gun towards the aim point, at the turret's own pace
  point(dt) {
    _v.set(this.aim.x - this.x, 0, this.aim.z - this.z);
    const want = Math.atan2(_v.x, _v.z), d = Math.hypot(_v.x, _v.z);
    const step = this.turretTurn * dt;
    this.gunYaw = wrap(this.gunYaw + clamp(wrap(want - this.gunYaw), -step, step));
    const pitch = Math.atan2(this.aim.y - (this.top + 2), Math.max(6, d));
    this.gunPitch += clamp(clamp(pitch, -0.35, 0.7) - this.gunPitch, -step, step);
  }
  // where weapon G's barrel i is (in the world), and which way it points
  muzzle(G, out, dir, i = G.next) {
    const m = G.mounts[i % Math.max(1, G.mounts.length)]; if (!m) return null;
    const b = this.unit.bones[m.bone]; if (!b) return null;
    this.unit.root.updateWorldMatrix(true, true);
    const p = m.p;
    b.localToWorld(out.set(p[0], p[1], p[2]));
    if (dir) { b.localToWorld(_w.set(p[0], p[1], p[2] + (m.bone === 'mines' ? -4 : 4))); dir.subVectors(_w, out).normalize(); }
    return out;
  }
  // the weapons on the roof and doors only turn a little either side of straight ahead
  inCone(G, x, z, slack = 0) {
    if (!G.cone) return true;
    return Math.abs(wrap(Math.atan2(x - this.x, z - this.z) - this.yaw)) < G.cone + slack;
  }
  // the gun lines up with the aim point closely enough to fire
  onTarget(tol = 0.12) {
    const want = Math.atan2(this.aim.x - this.x, this.aim.z - this.z);
    return Math.abs(wrap(want - this.gunYaw)) < tol;
  }

  // ---- the model --------------------------------------------------------------------------------------------
  pose(dt) {
    const u = this.unit, s = u.state;
    if (!this.dead) {
      const vf = this.fwd;
      this.spinA += vf / this.wheelR * dt; s.spin = this.spinA;
      s.steer += (this.steer * 0.5 - s.steer) * Math.min(1, dt * 12);
      // lean out of turns, dip under braking and lift under power, bob over the bumps
      const acc = (vf - (this._vf || 0)) / Math.max(dt, 1e-3); this._vf = vf;
      s.roll += (clamp(-this.yawRate * Math.abs(vf) * 0.0016, -0.09, 0.09) - s.roll) * Math.min(1, dt * 6);
      s.pitch += (clamp(-acc * 0.0009, -0.06, 0.06) - (s.pitch || 0)) * Math.min(1, dt * 5);
      s.bob = 0.06 * Math.sin(this.spinA * 0.7) * clamp(Math.abs(vf) / 40, 0, 1);
      s.yaw = wrap(this.gunYaw - this.yaw); s.aim = this.gunPitch;
      s.coneYaw = clamp(s.yaw, -0.4, 0.4); s.coneAim = clamp(this.gunPitch, -0.25, 0.4); s.arc += dt * (this.arcT > 0 ? 18 : 2);
      // the minigun's barrels wind up while it fires; the saws never stop
      this.firing = Math.max(0, this.firing - dt);
      this.barrelV = (this.barrelV || 0) + ((this.firing > 0 ? 30 : 0) - (this.barrelV || 0)) * Math.min(1, dt * 3);
      s.gunSpin += this.barrelV * dt; s.saw += 24 * dt;
    }
    u.root.position.set(this.x, 0, this.z); u.root.rotation.y = this.yaw;
    const body = this.body || (this.body = u.parts.find((p) => p.name === 'body'));
    let held = false;
    this.rebuildT = (this.rebuildT || 0) - dt;
    if (body.dirty && !body.more) {
      if (this.rebuildT > 0 || rebuilds <= 0) { held = body.dirty; body.dirty = false; }
      else { this.rebuildT = 0.08; rebuilds--; }
    }
    u.update(dt);
    if (held) body.dirty = held;
  }
  // wrecked: the guns, the pod and the ram are blown clear
  blowParts(debris, point, push = 16) {
    const u = this.unit; u.root.updateWorldMatrix(true, true);
    const out = [];
    for (const p of u.parts) {
      if (!LOOSE.includes(p.name) || !p.count) continue;
      out.length = 0; p.all(out, 0.2);
      for (const [x, y, z, c] of out) {
        _w.set(x, y, z); p.bone.localToWorld(_w);
        const dx = _w.x - point.x, dz = _w.z - point.z, d = Math.hypot(dx, dz) + 0.01, s = push * (0.4 + Math.random());
        debris(_w.x, _w.y, _w.z, dx / d * s, 6 + Math.random() * 14, dz / d * s, c, u.def.h * 3);
      }
      p.col.fill(-1); p.count = 0; p.dirty = true;
    }
  }
  // where a round going along dir from p first meets one of the car's cubes (within reach voxels), or null. The car's
  // box is bigger than the car (it takes in the turret, the mirrors and the ram), so hits are carved where the cubes are.
  surface(p, dir, reach = 6, out = new THREE.Vector3()) {
    this.unit.root.updateWorldMatrix(true, true);
    let hit = false, bt = reach;
    for (const part of this.unit.parts) {
      if (!part.count) continue;
      _inv.copy(part.bone.matrixWorld).invert(); _lp.copy(p).applyMatrix4(_inv); _ld.copy(dir).transformDirection(_inv);
      const h = part.h;
      for (let t = 0; t < bt; t += 0.1) {
        if (part.at(Math.floor((_lp.x + _ld.x * t) / h - part.i0), Math.floor((_lp.y + _ld.y * t) / h - part.j0), Math.floor((_lp.z + _ld.z * t) / h - part.k0)) >= 0) { bt = t; hit = true; break; }
      }
    }
    return hit ? out.copy(p).addScaledVector(dir, bt) : null;
  }
  // does a world point lie inside the car's box?
  inside(x, y, z, pad = 0) {
    if (this.gone || y > this.top + 0.6 + pad) return false;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw), dx = x - this.x, dz = z - this.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c - this.mid;
    return Math.abs(lx) < this.wide + pad && Math.abs(lz) < this.half + pad;
  }
  // the middle of the car, as a world point
  centre(out) { const s = Math.sin(this.yaw), c = Math.cos(this.yaw); return out.set(this.x + this.mid * s, 3, this.z + this.mid * c); }
  dust(n) { dust(this.x, 0.8, this.z, n, 5); }
  dispose() { this.unit.dispose(); }
}
