// A combat car: one of Monster Mayhem's street cars (civilian/src/cars.js) with a gun mount, a rocket pod and a ram
// plow bolted on, arcade driving, and crashes that knock holes in the town through the game's own blast() (src/sim.js).
// The car's model space has +z forward and +x to the car's left; yaw 0 faces +z.
import * as THREE from 'three';
import { Unit } from '../../units/src/unit.js';
import { CAR } from '../../civilian/src/cars.js';
import { solid, idx, ownerAt, bodies, WX, WZ } from '../../src/world.js';
import { blast, dust } from '../../src/sim.js';
import { BODIES, GUNS, CRASH } from './tuning.js';

const OFF = [0, 0, 0, 0, 0, 0, 0], LIT = [0, 0, 0, 0, 0, 0, 1.012];
const R_WHEEL = 1.25;   // wheel radius in town voxels (cars.js)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// The street car with one more clip, Race, that reads the wheels' spin and steer and the body's lean from u.state.
// It never dies of lost cubes (dieAt above 1): health decides that, and kill() is called by hand.
const RACE_CAR = {
  ...CAR, dieAt: 5, start: 'Race',
  clips: {
    ...CAR.clips,
    Race: { loop: true, speed: 0, pose: (t, u) => {
      const s = u.state, a = s.spin || 0, st = s.steer || 0;
      return { wFL: [a, st, 0], wFR: [a, st, 0], wRL: [a, 0, 0], wRR: [a, 0, 0], body: [s.pitch || 0, 0, s.roll || 0, 0, s.bob || 0, 0], lights: LIT, hazard: s.hazard ? LIT : OFF, barR: s.bars ? LIT : OFF, barB: s.bars ? LIT : OFF };
    } },
  },
};

// The bolt-on kit, on the same cube kit as the cars (eighth-metre cubes): a gun on a turning mount on the roof, a rocket
// pod beside it and a plow on the nose. Our own design: welded plates, hazard stripes, a stubby barrel.
const GUNMETAL = 0x3b3f45, STEEL = 0x8a9098, BRIGHT = 0xb9bfc7, DARKS = 0x202327, PLATE = 0x5a5e63, RUST = 0x7a4a2a, HAZ = 0xe2b21e, HAZK = 0x1a1a1a, OLIVE = 0x4f5a36, TIP = 0xc0402c;
function kitDef(roofY, roofZ, noseZ, width, o) {
  const c = (v) => Math.round(v * 2);   // voxels to cubes
  const parts = [
    { name: 'yaw', pivot: [0, c(roofY), c(roofZ)], box: [-4, 0, -4, 4, 2, 4], paint(v) { v.box(-4, 0, -4, 4, 1, 4, DARKS); v.box(-3, 1, -3, 3, 2, 3, STEEL); } },
    { name: 'gun', parent: 'yaw', pivot: [0, 3, 0], box: [-4, -1, -5, 4, 5, 18], paint(v) {
      v.box(-2, -1, -4, 2, 2, 3, GUNMETAL); v.box(-2, 2, -3, 2, 3, 2, STEEL);                                       // breech, and the feed on top
      v.box(-3, 0, -5, -2, 2, 0, HAZK); v.box(2, 0, -5, 3, 2, 0, HAZK);                                              // the grips
      v.box(-4, -1, 3, 4, 5, 4, PLATE); v.box(-4, 4, 3, 4, 5, 4, HAZ); v.box(-1, 1, 3, 1, 2, 4, DARKS);              // the shield, its striped top and the slot
      v.box(-1, 0, 4, 1, 2, 16, BRIGHT); v.box(-2, -1, 9, 2, 3, 11, GUNMETAL); v.box(-1, 0, 16, 1, 2, 18, DARKS);    // barrel, its collar, the muzzle
      if (o.chain) { v.box(-2, 0, 4, -1, 1, 15, STEEL); v.box(1, 0, 4, 2, 1, 15, STEEL); v.box(-1, 2, 4, 1, 3, 15, STEEL); }   // a chain gun has more barrels
    } },
  ];
  if (o.pod) parts.push({ name: 'pod', parent: 'yaw', pivot: [5, 1, -3], box: [0, 0, -2, 4, 5, 8], paint(v) {
    const col = o.pod === 'cannon' ? GUNMETAL : OLIVE;
    v.box(0, 0, -2, 4, 4, 7, col); v.box(0, 0, -2, 4, 1, 7, DARKS); v.box(0, 4, 0, 4, 5, 5, HAZ);
    if (o.pod === 'cannon') { v.box(1, 1, 7, 3, 3, 8, DARKS); }
    else for (const i of [0, 2]) for (const j of [1, 3]) { v.set(i, j, 7, TIP); v.set(i + 1, j, 7, TIP); }
  } });
  // the plow: a wedge of plate across the nose, striped
  const w = Math.ceil(c(width) / 2) + 1, k0 = c(noseZ) - 1;
  parts.push({ name: 'plow', pivot: [0, 1, k0], box: [-w, 0, 0, w, 6, 4], paint(v) {
    for (let j = 0; j < 6; j++) for (let i = -w; i < w; i++) {
      const lean = j < 2 ? 3 : j < 4 ? 2 : 1;
      for (let k = 0; k < lean; k++) v.set(i, j, k, k === lean - 1 && j >= 1 && j <= 4 ? ((((i + j) >> 1) & 1) ? HAZ : HAZK) : j === 0 ? DARKS : PLATE);
    }
    for (const i of [-w + 1, w - 2]) v.box(i, 0, -1, i + 1, 5, 0, RUST);   // the brackets that bolt it on
  } });
  return { kind: 'kit', h: 0.5, dieAt: 9, start: 'Idle', clips: { Idle: { loop: true, pose: () => ({}) } }, parts: () => parts };
}

// where the roof is on a car body: the height of its top layer of cubes and the middle of that layer front to back
function roofOf(u) {
  const p = u.parts.find((q) => q.name === 'body');
  const { nx, ny, nz, col } = p; let top = -1, ks = 0, n = 0;
  for (let j = ny - 1; j >= 0 && top < 0; j--) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) if (col[(k * ny + j) * nx + i] >= 0) { top = j; break; }
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) if (col[(k * ny + top) * nx + i] >= 0) { ks += k; n++; }
  const h = p.h, r = u.rest.body.pos;
  return { y: (p.j0 + top + 1) * h + r[1], z: (p.k0 + ks / n + 0.5) * h + r[2], nose: (p.k0 + nz) * h + r[2], tail: p.k0 * h + r[2], width: nx * h };
}

let SEED = 1;
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

export class Vehicle {
  constructor(scene, mats, load, at) {
    this.load = load; this.name = load.name || 'You';
    this.spec = BODIES[load.body];
    const paint = load.paint === 'police' ? 'white' : load.paint;
    this.unit = new Unit(RACE_CAR, mats, { type: this.spec.type, paint, seed: SEED++ });
    Object.assign(this.unit.state, { spin: 0, steer: 0, roll: 0, pitch: 0, bob: 0, bars: this.spec.type === 'police' });
    const roof = roofOf(this.unit);
    this.half = (roof.nose - roof.tail) / 2; this.mid = (roof.nose + roof.tail) / 2; this.wide = roof.width / 2;
    this.top = roof.y;
    const sec = load.secondary ? GUNS[load.secondary] : null;
    this.kit = new Unit(kitDef(roof.y - this.unit.rest.body.pos[1], roof.z - this.unit.rest.body.pos[2], roof.nose - this.unit.rest.body.pos[2], roof.width, { pod: sec ? (sec.fx === 'cannon' ? 'cannon' : 'rocket') : null, chain: load.primary === 'chain' }), mats, { seed: SEED++ });
    this.unit.bones.body.add(this.kit.root);
    scene.add(this.unit.root);
    this.maxHp = this.spec.hp * (load.armour || 1); this.hp = this.maxHp;
    this.x = at.x; this.z = at.z; this.yaw = at.yaw || 0; this.vx = 0; this.vz = 0; this.yawRate = 0;
    this.steer = 0; this.throttle = 0; this.brake = 0;
    this.aimYaw = this.yaw; this.aimPitch = 0; this.gunYaw = this.yaw; this.gunPitch = 0; this.turretTurn = 9;
    this.aim = new THREE.Vector3(at.x, 3, at.z + 40);
    this.guns = [load.primary, load.secondary].filter(Boolean).map((k) => ({ key: k, g: GUNS[k], t: 0, left: 0, gapT: 0 }));
    this.dead = false; this.deadT = 0; this.gone = false; this.hurtT = 0; this.lastBy = null;
    this.smashT = 0; this.scrape = 0; this.spinA = 0;
  }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get fwd() { return this.vx * Math.sin(this.yaw) + this.vz * Math.cos(this.yaw); }

  // ---- driving ----------------------------------------------------------------------------------------------
  step(dt, hooks) {
    const S = this.spec, sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let vf = this.vx * sy + this.vz * cy, vs = this.vx * cy - this.vz * sy;   // forwards, and sideways to the left
    if (this.dead) { this.throttle = 0; this.steer = 0; this.brake = 1; }
    // engine, brakes and drag
    const t = this.throttle;
    if (t > 0) vf += (vf < 0 ? S.accel * 2.2 : S.accel * (1 - Math.max(0, vf) / S.top * 0.7)) * t * dt;
    else if (t < 0) vf += (vf > 0 ? -S.accel * 2.2 : -S.accel * 0.8 * (1 + vf / S.back)) * -t * dt;
    else vf *= Math.exp(-0.55 * dt);
    if (this.brake) vf *= Math.exp(-(this.dead ? 2.2 : 3.5) * this.brake * dt);
    vf = clamp(vf, -S.back, S.top * (this.boost || 1));
    // turning: none standing still, full at about a third of top speed, a little less flat out
    const k = clamp(Math.abs(vf) / 26, 0, 1) * (1 - 0.25 * clamp(Math.abs(vf) / S.top, 0, 1));
    const want = this.steer * S.turn * k * Math.sign(vf || 1) * (this.drift ? 1.35 : 1);
    this.yawRate += (want - this.yawRate) * Math.min(1, dt * 10);
    this.yaw = wrap(this.yaw + this.yawRate * dt);
    // grip: sideways sliding dies away, slower in a handbrake turn
    vs *= Math.exp(-(this.drift ? S.grip * 0.18 : S.grip) * dt);
    const ny = Math.sin(this.yaw), nyc = Math.cos(this.yaw);
    // the old velocity's sideways part carries on through the turn: that is the slide
    this.vx = ny * vf + nyc * vs; this.vz = nyc * vf - ny * vs;
    this.scrape = Math.abs(vs);
    this.collide(dt, hooks);
    this.x = clamp(this.x, 8, WX - 8); this.z = clamp(this.z, 8, WZ - 8);
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
    out.front = 0; out.back = 0; out.side = 0; out.soft = 0; out.hard = 0; out.x = 0; out.y = 0; out.z = 0;
    for (const [lx, lz, kind] of this.probes()) {
      const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
      for (const y of [2, 4]) {
        const ix = Math.floor(wx), iz = Math.floor(wz);
        if (!solid(ix, y, iz)) continue;
        const b = bodies[ownerAt(idx(ix, y, iz))], soft = !b || b.kind === 'rubble' || b.kind === 'prop';
        if (soft) out.soft++; else out.hard++;
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
    if ((H.hard === 0 && sp > 3) || into > CRASH.smash) {
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
  muzzle(which, out, dir) {
    const b = this.kit.bones[which === 1 ? 'pod' : 'gun'];
    this.unit.root.updateWorldMatrix(true, true);
    if (!b) return null;
    b.localToWorld(out.set(which === 1 ? 1 : 0, which === 1 ? 1 : 0.5, which === 1 ? 4.2 : 9.2));
    if (dir) { b.localToWorld(_w.set(which === 1 ? 1 : 0, which === 1 ? 1 : 0.5, 20)); dir.subVectors(_w, out).normalize(); }
    return out;
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
      this.spinA += vf / R_WHEEL * dt; s.spin = this.spinA;
      s.steer += (this.steer * 0.5 - s.steer) * Math.min(1, dt * 12);
      // lean out of turns, dip under braking and lift under power, bob over the bumps
      const acc = (vf - (this._vf || 0)) / Math.max(dt, 1e-3); this._vf = vf;
      s.roll += (clamp(-this.yawRate * Math.abs(vf) * 0.0016, -0.09, 0.09) - s.roll) * Math.min(1, dt * 6);
      s.pitch += (clamp(-acc * 0.0009, -0.06, 0.06) - (s.pitch || 0)) * Math.min(1, dt * 5);
      s.bob = 0.06 * Math.sin(this.spinA * 0.7) * clamp(Math.abs(vf) / 40, 0, 1);
    }
    u.root.position.set(this.x, 0, this.z); u.root.rotation.y = this.yaw;
    u.update(dt); this.kit.update(dt);
    if (!this.dead) {
      this.kit.bones.yaw.rotation.y = wrap(this.gunYaw - this.yaw);
      this.kit.bones.gun.rotation.x = -this.gunPitch;
      if (this.kit.bones.pod) this.kit.bones.pod.rotation.x = -this.gunPitch * 0.8 - 0.06;
    }
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
  dispose() { this.kit.dispose(); this.unit.dispose(); }
}
