// Fire built from blocks, for the flamethrower, the side burners and the cars they set alight. Will (2026-11-24): the
// flamethrower "looks like it's just yellow smoke", and asked for the pixel fire of Monster Mayhem. This is that fire,
// brought over from Monster Mayhem's src/main.js (flameBlock, stepFlames and its Jet style, which was itself rebuilt
// from the flamethrower in the pixelfx library: see LICENSES.md) and sized for a car's nozzle.
//
// Every flame is a small glowing cube, white-hot as it leaves the nozzle and cooling through yellow, orange and red to
// dark smoke as it slows, swells and lifts. Blocks that reach the ground wash out along it; blocks that meet a wall
// splash across its face. One instanced mesh draws all of them, so it is one draw however much is burning.
import * as THREE from 'three';
import { solid } from '../../src/world.js';
import { writeFlame } from '../../src/sim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The colour ramps, as [age 0 to 1, red, green, blue]: over 1 glows (the bloom picks it up).
const HEAT = [[0, 1.75, 1.3, 0.4], [0.1, 1.6, 0.9, 0.12], [0.34, 1.35, 0.4, 0.03], [0.6, 0.85, 0.12, 0.02], [0.78, 0.3, 0.07, 0.04], [1, 0.08, 0.075, 0.075]];
const MARK = [[0, 1.7, 1.15, 0.38], [0.4, 1.6, 0.72, 0.1], [1, 1.1, 0.28, 0.04]];   // a white-hot streak: no smoke
const BLUEF = [[0, 0.9, 1.5, 2.0], [0.4, 0.25, 0.7, 1.9], [1, 0.05, 0.2, 0.9]];      // the blue pilot flame at the nozzle
const LICK = [[0, 1.65, 0.95, 0.14], [0.45, 1.3, 0.36, 0.03], [1, 0.6, 0.08, 0.02]]; // a lick or ember of plain fire
const RAMPS = [HEAT, MARK, BLUEF, LICK];
export const KIND = { heat: 0, mark: 1, pilot: 2, lick: 3 };

// Every number that sets how the fire looks. Lengths are voxels.
export const PIXFIRE = {
  max: 4000,         // blocks alive at once (phones: maxPhone)
  maxPhone: 1800,
  jet: 760,          // blocks a second down one flamethrower's stream (phones: times `phone`)
  strands: 280,      // and in the two bright strands twisting round it
  pilot: 60,         // and in the blue pilot flame at the nozzle
  drops: 8,          // burning drops that fall out of it
  phone: 0.55,
  spread: 0.1,       // radians either side of the stream's middle the blocks are thrown
  size: 1.0,         // a stream block's size as it leaves the nozzle (it swells to about twice this)
  drag: 1.2,          // how fast the stream slows
  rise: 26,          // how hard the heat lifts it late on
  burn: 110,         // blocks a second off a burning car
};

export function makePixelFire(scene, { mobile = false } = {}) {
  const MAX = mobile ? PIXFIRE.maxPhone : PIXFIRE.max, K = mobile ? PIXFIRE.phone : 1;
  // a unit cube whose faces are shaded by hand (the blocks light themselves, so this keeps each one reading as a block)
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const shade = [0.8, 0.8, 1.12, 0.6, 0.94, 0.7], col = new Float32Array(24 * 3);
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) col.fill(shade[f], (f * 4 + v) * 3, (f * 4 + v) * 3 + 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), MAX);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, new THREE.Color(1, 1, 1)); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0; mesh.frustumCulled = false; mesh.name = 'pixel-fire'; mesh.renderOrder = 9;
  scene.add(mesh);
  const live = [];

  // one block: where, how fast, how big, how long it lives, how fast it slows, how hard the heat lifts it, its colours
  function block(x, y, z, vx, vy, vz, size, life, drag, rise, kind = 0) {
    if (live.length >= MAX) return null;
    const f = { x, y, z, vx, vy, vz, s: size, t: 0, life, drag, rise, kind, hit: kind ? 3 : 0, j: 0.72 + Math.random() * 0.5, o: (Math.random() - 0.5) * 0.16,
      ax: Math.random() * 6.283, ay: Math.random() * 6.283, wx: (Math.random() - 0.5) * 9, wy: (Math.random() - 0.5) * 9, g: 0, cap: 1, sw: 1.1, curl: 0, cx: 0, cz: 0 };
    live.push(f);
    return f;
  }

  // One puff of a flamethrower, from `from` along unit direction `d` (reach: how far it carries), standing for `dt`
  // seconds of the jet (the gun's own fire rate puffs it: the blocks are spread over that time so it pours, not pulses).
  // `rate` thins it (the arena's flame jets burn eight at once: hazards.js).
  // `w` scales its width and block size (the side burners are thinner). Fire under pressure: a tight stream, white down
  // the middle and red at its skin, two bright strands twisting round it, a blue pilot flame at the nozzle, burning
  // drops, and a tip that rolls up and back into smoke.
  const _r = new THREE.Vector3(), _u = new THREE.Vector3();
  let spin = 0;
  function jet(from, d, reach, dt, w = 1, t = 0, cvx = 0, cvz = 0, rate = 1) {
    const R = Math.random, A = PIXFIRE.spread * w, drag = PIXFIRE.drag, hl = Math.hypot(d.x, d.z) || 1;
    _r.set(d.z / hl, 0, -d.x / hl); _u.crossVectors(_r, d);   // across the stream and up from it
    const shot = (a, off, v, size, life, rise, kind, lead) => {
      const ca = Math.cos(a) * off, sa = Math.sin(a) * off, dx = d.x + _r.x * ca + _u.x * sa, dy = d.y + _r.y * ca + _u.y * sa, dz = d.z + _r.z * ca + _u.z * sa;
      return block(from.x + dx * lead, from.y + dy * lead, from.z + dz * lead, dx * v + cvx, dy * v, dz * v + cvz, size, life, drag, rise, kind);
    };
    const surge = (t * 6) % 1 < 0.2, vr = reach * drag / (1 - Math.exp(-drag * 0.72));   // (vr: how fast a block must leave to carry `reach` in its life)
    // the stream
    let n = PIXFIRE.jet * K * dt * rate * (surge ? 1.5 : 1);
    for (; n > 0; n--) {
      if (n < 1 && R() > n) break;
      const q = Math.sqrt(R()), v0 = vr * (0.95 + R() * 0.15), tau = R() * dt;
      const f = shot(R() * 6.283, q * A, v0, (0.8 + R() * 0.5) * PIXFIRE.size * w * (0.8 + 0.4 * q) * (surge ? 1.2 : 1), 0.6 + R() * 0.22, PIXFIRE.rise, 0, tau * v0 + 0.3);
      if (f) { f.o = -0.36 + 0.7 * q * q - (surge ? 0.25 : 0); f.curl = 30; f.cx = d.x / hl; f.cz = d.z / hl; if (R() < 0.12) f.vy += 3 + R() * 5; if (R() < 0.4) f.cap = 0.74; }
    }
    // the two strands: each block is aimed a little further round than the last
    n = PIXFIRE.strands * K * dt * rate;
    for (; n > 0; n--) {
      if (n < 1 && R() > n) break;
      const tau = R() * dt, v = vr * 1.1;
      spin++;
      const f = shot((t - tau) * 40 + (spin & 1 ? Math.PI : 0), A * 1.1, v, 0.65 * PIXFIRE.size * w, 0.42, 0, 1, tau * v);
      if (f) { f.j = 1.3; f.wx = f.wy = 0; }
    }
    // the pilot flame at the nozzle
    n = PIXFIRE.pilot * K * dt * rate;
    for (; n > 0; n--) { if (n < 1 && R() > n) break; const life = 0.1 + R() * 0.06, f = shot(R() * 6.283, R() * 0.18, reach * 0.06 * 6 / (1 - Math.exp(-6 * life)), (0.4 + R() * 0.25) * PIXFIRE.size * w, life, 0, 2, R() * 0.3); if (f) f.drag = 6; }
    // burning drops
    if (R() < PIXFIRE.drops * dt) {
      const at = reach * (0.18 + R() * 0.6), v = reach * (0.5 + R() * 0.5);
      const f = block(from.x + d.x * at, from.y + d.y * at, from.z + d.z * at, d.x * v, d.y * v + R() * 3, d.z * v, 0.3 * w, 0.45 + R() * 0.2, 1.2, 0, 3);
      if (f) f.g = 30;
    }
  }
  // A column of fire thrown straight up from (x, y, z), `reach` high, for `dt` seconds of it: a show's flame cannon
  // (the arena's: arenamoves.js). White at its foot and down its middle, rolling out into smoke at the top.
  function column(x, y, z, reach, dt, w = 1, rate = 1) {
    const R = Math.random, drag = PIXFIRE.drag, vr = reach * drag / (1 - Math.exp(-drag * 0.72));
    let n = PIXFIRE.jet * K * dt * rate;
    for (; n > 0; n--) {
      if (n < 1 && R() > n) break;
      const a = R() * 6.283, q = Math.sqrt(R()), out = q * 0.11 * w, v0 = vr * (0.85 + R() * 0.25);
      const f = block(x + Math.cos(a) * q * 0.8 * w, y + R() * v0 * dt, z + Math.sin(a) * q * 0.8 * w, Math.cos(a) * out * v0, v0, Math.sin(a) * out * v0, (0.85 + R() * 0.6) * PIXFIRE.size * w, 0.55 + R() * 0.3, drag, PIXFIRE.rise * 0.4, 0);
      if (f) { f.o = -0.36 + 0.7 * q * q; f.hit = 3; if (R() < 0.4) f.cap = 0.74; }
    }
  }
  // flames licking up off a burning car (x, z its middle; half, wide its size; dt the step)
  function burning(x, y, z, yaw, half, wide, dt) {
    const R = Math.random, s = Math.sin(yaw), c = Math.cos(yaw);
    let n = PIXFIRE.burn * K * dt;
    for (; n > 0; n--) {
      if (n < 1 && R() > n) break;
      const u = (R() - 0.5) * 1.6 * half, v = (R() - 0.5) * 1.6 * wide, smoke = R() < 0.25;
      const f = block(x + s * u + c * v, y + R() * 1.5, z + c * u - s * v, (R() - 0.5) * 2, 5 + R() * 6, (R() - 0.5) * 2, (smoke ? 0.9 : 0.6) + R() * 0.5, smoke ? 1 + R() * 0.6 : 0.5 + R() * 0.35, 1.5, smoke ? 4 : 0, smoke ? 0 : 3);
      if (f && smoke) { f.o = 0.25; f.sw = 0.8; }
    }
  }

  function step(dt) {
    const arr = mesh.instanceMatrix.array, ca = mesh.instanceColor.array;
    let n = 0;
    for (let i = live.length - 1; i >= 0; i--) {
      const f = live[i];
      f.t += dt;
      if (f.t >= f.life) { live[i] = live[live.length - 1]; live.pop(); continue; }
      const u = f.t / f.life, dr = Math.exp(-f.drag * dt), ramp = RAMPS[f.kind];
      f.vx *= dr; f.vz *= dr; f.vy = f.vy * dr + f.rise * u * u * dt;   // it slows as it goes, and the heat lifts it late on
      if (f.g) f.vy -= f.g * dt;
      if (f.curl && u > 0.5) { const k = (u - 0.5) * 2 * f.curl * dt; f.vx -= f.cx * k; f.vz -= f.cz * k; }   // the tip rolls back on itself
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      const size = f.kind ? f.s * (1 - u * u) : f.s * (1 + f.sw * Math.min(1, u / 0.6)) * (u > 0.72 ? (1 - u) / 0.28 : 1);
      if (f.kind === 1 || f.kind === 2) { /* streaks and the pilot pass through everything */ } else if (f.y < 0.3 + size * 0.3) {
        // the ground: it washes out along it
        f.y = 0.3 + size * 0.3; if (f.vy < 0) f.vy = f.kind ? -f.vy * 0.2 : 0;
        if (!f.hit) { f.hit = 1; const j = (Math.random() - 0.5), vx = f.vx, vz = f.vz; f.vx = (vx - vz * j) * 0.85; f.vz = (vz + vx * j) * 0.85; f.rise *= 1.6; }
      } else if (f.hit < 2 && u < 0.8 && solid(Math.floor(f.x), Math.floor(f.y), Math.floor(f.z))) {
        // a wall: it splashes out across the face and climbs
        f.hit = 2; f.x -= f.vx * dt; f.y -= f.vy * dt; f.z -= f.vz * dt;
        const sp = Math.hypot(f.vx, f.vz), a = Math.random() * 6.283;
        f.vx = Math.cos(a) * sp * 0.28 - f.vx * 0.08; f.vz = Math.sin(a) * sp * 0.28 - f.vz * 0.08; f.vy = sp * (0.08 + Math.random() * 0.3);
      }
      f.ax += f.wx * dt; f.ay += f.wy * dt;
      writeFlame(arr, n * 16, f, size);
      const uc = Math.min(f.cap, clamp(u + f.o * Math.min(1, u * 5), 0, 1));   // each block runs a little hot or cool, so neighbours differ
      let k = 1; while (ramp[k][0] < uc) k++;
      const h0 = ramp[k - 1], h1 = ramp[k], w = (uc - h0[0]) / (h1[0] - h0[0] || 1), j = f.j, c3 = n * 3;
      ca[c3] = (h0[1] + (h1[1] - h0[1]) * w) * j; ca[c3 + 1] = (h0[2] + (h1[2] - h0[2]) * w) * j; ca[c3 + 2] = (h0[3] + (h1[3] - h0[3]) * w) * j;
      n++;
    }
    mesh.count = n;
    if (n) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
  }
  function clear() { live.length = 0; mesh.count = 0; }
  return { jet, column, burning, block, step, clear, live, mesh };
}
