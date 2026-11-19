// Effects made of small blocks, in the fine-grain style of the game's own fire (flameBlock in ../../src/main.js at
// FX.detail 2): many small glowing cubes that cool from white-hot through orange and red to dark smoke, and do not swell.
// A fireball, sparks, a dust skirt along the ground, tongues of flame and a smoke column for a burning wreck.
// On water (set `water` on the object this returns: (x, z) -> the water level there, or null over land) a blast throws
// up spray instead of dust, flames go out with a hiss where the wreck goes under, and there is foam for wakes.
// Everything is in town voxels (4 to a metre).
import * as THREE from 'three';
import { cubeGeo, cubeMat, cubeMesh } from '../../units/src/cube3.js';

// colour ramps: [how far through its life, r, g, b]
const HEAT = [[0, 1.75, 1.3, 0.4], [0.1, 1.6, 0.9, 0.12], [0.34, 1.35, 0.4, 0.03], [0.6, 0.85, 0.12, 0.02], [0.78, 0.3, 0.07, 0.04], [1, 0.08, 0.075, 0.075]];
const BLAST = [[0, 1.9, 1.75, 1.1], [0.14, 1.85, 1.3, 0.32], [0.36, 1.6, 0.62, 0.06], [0.58, 0.95, 0.17, 0.02], [0.78, 0.3, 0.07, 0.04], [1, 0.085, 0.08, 0.08]];
const LICK = [[0, 1.7, 1.15, 0.3], [0.35, 1.5, 0.6, 0.06], [0.75, 1.0, 0.2, 0.02], [1, 0.45, 0.06, 0.02]];
const SPARK = [[0, 1.8, 1.5, 0.7], [0.5, 1.6, 0.8, 0.15], [1, 0.8, 0.2, 0.03]];
const SMOKE = [[0, 0.26, 0.18, 0.12], [0.2, 0.12, 0.115, 0.11], [1, 0.07, 0.07, 0.075]];
const DUST = [[0, 0.62, 0.58, 0.5], [1, 0.48, 0.45, 0.4]];
const STEAM = [[0, 0.85, 0.87, 0.88], [1, 0.6, 0.62, 0.64]];
const WATER = [[0, 0.93, 0.97, 1], [0.5, 0.74, 0.88, 0.97], [1, 0.5, 0.74, 0.9]];
const FOAM = [[0, 0.96, 0.98, 1], [0.55, 0.84, 0.92, 0.96], [1, 0.5, 0.7, 0.82]];
export const K = { FIRE: 0, LICK: 1, SPARK: 2, SMOKE: 3, DUST: 4, STEAM: 5, BLAST: 6, WATER: 7, FOAM: 8 };
const RAMPS = [HEAT, LICK, SPARK, SMOKE, DUST, STEAM, BLAST, WATER, FOAM];
function ramp(R, u, out) {
  let a = R[0], b = R[R.length - 1];
  for (let i = 1; i < R.length; i++) if (u <= R[i][0]) { a = R[i - 1]; b = R[i]; break; }
  const t = b[0] > a[0] ? Math.min(1, Math.max(0, (u - a[0]) / (b[0] - a[0]))) : 0;
  out.setRGB(a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t);
}

// o.flash(p, power): the game's own flash for a blast, in place of the three point lights kept here for the viewer
export function makeBlockFx(scene, max = 7000, o = {}) {
  // the cubes light themselves, so their faces are shaded by hand to keep each one reading as a block
  const geo = cubeGeo([0.8, 0.8, 1.12, 0.6, 0.94, 0.7]);   // three faces a cube, turned to the camera (units/src/cube3.js)
  const mesh = cubeMesh(geo, cubeMat(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })), max);
  mesh.name = 'block effects'; mesh.frustumCulled = false; mesh.count = 0; mesh.setColorAt(0, new THREE.Color(1, 1, 1)); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mesh);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  const M = mesh.instanceMatrix.array, C = mesh.instanceColor.array;
  const blocks = [], wind = { x: 1.6, z: 0.7 };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  const R = Math.random;
  const level = (x, z) => { const w = api.water ? api.water(x, z) : null; return w == null ? 0 : w; };
  const wet = (x, z) => !!api.water && api.water(x, z) != null;

  // One block. drag slows it, rise lifts it late in its life (heat), g pulls it down, delay holds it back.
  function block(x, y, z, vx, vy, vz, size, life, kind = 0, drag = 3, rise = 0, g = 0, delay = 0) {
    if (blocks.length >= max) return null;
    const b = { x, y, z, vx, vy, vz, s: size, t: -delay, life, kind, drag, rise, g, ax: R() * 6.283, ay: R() * 6.283, wx: (R() - 0.5) * 8, wy: (R() - 0.5) * 8, j: 0.8 + R() * 0.4, blow: kind === K.SMOKE || kind === K.STEAM ? 1 : 0 };
    if (kind === K.FOAM) { b.ax = 0; b.wx = 0; b.wy = 0; }   // foam lies flat on the water
    blocks.push(b); return b;
  }
  function update(dt) {
    let n = 0;
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i]; b.t += dt;
      if (b.t >= b.life) { blocks[i] = blocks[blocks.length - 1]; blocks.pop(); continue; }
      if (b.t < 0) continue;
      const u = b.t / b.life, dr = Math.exp(-b.drag * dt);
      b.vx *= dr; b.vz *= dr; b.vy = b.vy * dr + (b.rise * u * u - b.g) * dt;
      if (b.blow) { b.vx += (wind.x - b.vx) * dt * 0.8; b.vz += (wind.z - b.vz) * dt * 0.8; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      let size;
      if (b.kind === K.FIRE || b.kind === K.BLAST) size = b.s * (0.75 + 0.3 * Math.min(1, u / 0.5)) * (u > 0.72 ? (1 - u) / 0.28 : 1);
      else if (b.kind === K.SMOKE || b.kind === K.STEAM) size = b.s * (0.6 + 0.5 * Math.min(1, u / 0.3)) * (u > 0.65 ? (1 - u) / 0.35 : 1);
      else if (b.kind === K.DUST || b.kind === K.FOAM) size = b.s * (u > 0.5 ? (1 - u) / 0.5 : 1);
      else size = b.s * (1 - u * u);
      let floor = size * 0.5;
      if (b.y < floor) {
        const w = api.water ? api.water(b.x, b.z) : null;
        if (w != null) { if (b.y < w && b.vy < 0 && (b.kind === K.WATER || b.kind === K.SPARK)) { blocks[i] = blocks[blocks.length - 1]; blocks.pop(); continue; } floor = b.kind === K.FOAM ? w + 0.04 : w + size * 0.5; }   // spray falls back in, sparks go out
        if (b.y < floor) { b.y = floor; if (b.vy < 0) b.vy = b.kind === K.SPARK ? -b.vy * 0.35 : 0; }
      }
      b.ax += b.wx * dt; b.ay += b.wy * dt;
      // the block's matrix written straight into the list (a turn about x, then y, times its size): thousands of blocks are
      // alive after a row of cars goes up, and going by way of a quaternion took most of this loop's time
      const sz = Math.max(0.001, size), ca = Math.cos(b.ax) * sz, sa = Math.sin(b.ax) * sz, cy = Math.cos(b.ay), sy = Math.sin(b.ay), w = n * 16;
      M[w] = cy * sz; M[w + 1] = sa * sy; M[w + 2] = -ca * sy; M[w + 3] = 0;
      M[w + 4] = 0; M[w + 5] = ca; M[w + 6] = sa; M[w + 7] = 0;
      M[w + 8] = sy * sz; M[w + 9] = -sa * cy; M[w + 10] = ca * cy; M[w + 11] = 0;
      M[w + 12] = b.x; M[w + 13] = b.y; M[w + 14] = b.z; M[w + 15] = 1;
      ramp(RAMPS[b.kind], u, _c); const j = b.kind <= K.SPARK || b.kind === K.BLAST ? b.j : 1, v = n * 3;
      C[v] = _c.r * j; C[v + 1] = _c.g * j; C[v + 2] = _c.b * j; n++;
    }
    // only the blocks alive are sent (the whole list of 7,000 used to go every frame)
    if (n || mesh.count) { mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, n * 16); mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.clearUpdateRanges(); mesh.instanceColor.addUpdateRange(0, n * 3); mesh.instanceColor.needsUpdate = true; }
    mesh.count = n;
    for (const L of lights) { if (L.t >= L.dur) { L.light.intensity = 0; continue; } L.t += dt; const k = Math.max(0, 1 - L.t / L.dur); L.light.intensity = L.peak * k * k; }
    stepFires(dt);
  }

  // a short orange light for a blast
  const lights = (o.flash ? [] : [0, 1, 2]).map(() => { const light = new THREE.PointLight(0xffa040, 0, 90, 1.6); scene.add(light); return { light, t: 1, dur: 0.3, peak: 0 }; });
  let li = 0;
  function flash(p, power = 1) { if (o.flash) { o.flash(p, power); return; } const L = lights[li++ % lights.length]; L.light.position.set(p.x, p.y + 3, p.z); L.t = 0; L.dur = 0.34; L.peak = 320 * power; }

  // ---- bursts ----
  const dirOut = (up = 0.25) => { const a = R() * 6.283, e = Math.asin(Math.min(1, -up + R() * (1 + up))), c = Math.cos(e); return [Math.cos(a) * c, Math.sin(e), Math.sin(a) * c]; };
  // A fireball of radius r (about 4 for a car): a white-hot heart, a ball of fire that lifts and turns to smoke, sparks
  // thrown high, and dust run out along the ground.
  function explode(p, r = 4) {
    flash(p, r / 4);
    const n = Math.round(95 * r);
    for (let i = 0; i < n; i++) {   // the ball: it fills out fast, slows, then lifts and darkens into smoke
      const d = dirOut(0.2), q = Math.cbrt(R()), v = r * (1.2 + 6.4 * q), s0 = r * 0.22 * R();
      block(p.x + d[0] * s0, p.y + d[1] * s0, p.z + d[2] * s0, d[0] * v, d[1] * v + r * 1.4, d[2] * v, r * (0.06 + 0.055 * R()), 0.55 + R() * 0.75, K.BLAST, 4.6, 26 + R() * 18);
    }
    for (let i = 0; i < n * 0.35; i++) {   // the heart: fast, white, gone at once
      const d = dirOut(0.5), v = r * (6 + R() * 7);
      block(p.x, p.y, p.z, d[0] * v, d[1] * v, d[2] * v, r * (0.05 + R() * 0.05), 0.12 + R() * 0.16, K.LICK, 7);
    }
    for (let i = 0; i < n * 0.25; i++) {   // a second, slower roll of fire that climbs out of the top
      const d = dirOut(-0.3), v = r * (1.5 + R() * 2.5);
      block(p.x + d[0] * r * 0.3, p.y + r * 0.2, p.z + d[2] * r * 0.3, d[0] * v, d[1] * v + r * 2.6, d[2] * v, r * (0.06 + 0.05 * R()), 0.8 + R() * 0.7, K.BLAST, 2.6, 22, 0, 0.06 + R() * 0.14);
    }
    for (let i = 0; i < r * 16; i++) {   // sparks
      const d = dirOut(-0.1), v = r * (5 + R() * 9);
      block(p.x, p.y, p.z, d[0] * v, d[1] * v + 6, d[2] * v, 0.09 + R() * 0.09, 0.6 + R() * 0.8, K.SPARK, 0.8, 0, 42);
    }
    for (let i = 0; i < r * 22; i++) {   // the smoke that follows it up
      const d = dirOut(0), v = r * (0.5 + R() * 1.5);
      block(p.x + d[0] * r * 0.5, p.y + r * 0.3 + R() * r * 0.6, p.z + d[2] * r * 0.5, d[0] * v, 5 + R() * 7, d[2] * v, r * (0.08 + R() * 0.08), 1.6 + R() * 1.8, K.SMOKE, 1.2, 4, 0, 0.25 + R() * 0.45);
    }
    if (wet(p.x, p.z)) splash(p, Math.round(r * 34), 0.5 + r * 0.16, r * 1.1); else dust(p, Math.round(r * 18), r * 5.5);
  }
  // dust thrown out along the ground from a point
  function dust(p, n = 50, speed = 18, kind = K.DUST) {
    for (let i = 0; i < n; i++) {
      const a = R() * 6.283, v = speed * (0.45 + R() * 0.75), rr = 0.6 + R() * 1.2;
      block(p.x + Math.cos(a) * rr, level(p.x, p.z) + 0.2 + R() * 0.5, p.z + Math.sin(a) * rr, Math.cos(a) * v, 1 + R() * 3.5, Math.sin(a) * v, 0.22 + R() * 0.26, 0.5 + R() * 0.6, kind, 3.6);
    }
  }
  function sparks(p, n = 12, speed = 18) {
    for (let i = 0; i < n; i++) { const d = dirOut(0), v = speed * (0.4 + R() * 0.9); block(p.x, p.y, p.z, d[0] * v, d[1] * v + 3, d[2] * v, 0.09 + R() * 0.08, 0.3 + R() * 0.5, K.SPARK, 1, 0, 40); }
  }
  function puff(p, n = 8, kind = K.SMOKE, size = 0.4) {
    for (let i = 0; i < n; i++) block(p.x + (R() - 0.5) * 2, p.y + R(), p.z + (R() - 0.5) * 2, (R() - 0.5) * 3, 3 + R() * 4, (R() - 0.5) * 3, size * (0.7 + R() * 0.6), 1 + R() * 1.2, kind, 1.4, 3);
  }

  // Water thrown up from a point on the surface: a column of spray that falls back, and froth left where it was.
  // power 1 is a car-sized lump going in; spread is how wide the patch is.
  function splash(p, n = 40, power = 1, spread = 2) {
    const y = level(p.x, p.z);
    for (let i = 0; i < n; i++) {
      const a = R() * 6.283, q = Math.sqrt(R()), rr = spread * q, up = power * (8 + R() * 17) * (1 - 0.55 * q), out = power * (0.8 + R() * 3.2 + 3 * q);
      block(p.x + Math.cos(a) * rr, y + 0.15, p.z + Math.sin(a) * rr, Math.cos(a) * out, up, Math.sin(a) * out, 0.2 + R() * 0.26, 2.4, K.WATER, 0.25, 0, 40, R() * 0.1);
    }
    for (let i = 0; i < n * 0.5; i++) {
      const a = R() * 6.283, rr = spread * (0.2 + 1.2 * Math.sqrt(R())), v = power * (0.6 + R() * 2.4);
      block(p.x + Math.cos(a) * rr, y + 0.04, p.z + Math.sin(a) * rr, Math.cos(a) * v, 0, Math.sin(a) * v, 0.22 + R() * 0.26, 1.2 + R() * 1.8, K.FOAM, 1.6, 0, 0, 0.1 + R() * 0.5);
    }
  }
  // one fleck of foam on the water, as for a wake
  function foam(x, z, vx = 0, vz = 0, size = 0.3, life = 1.6) { block(x, level(x, z) + 0.04, z, vx, 0, vz, size * (0.7 + R() * 0.6), life * (0.6 + R() * 0.8), K.FOAM, 1.2); }

  // ---- fires that keep burning ----
  // obj: the Object3D the fire rides on; spots: points in its own space where the flames sit. A fire burns for `life`
  // seconds, strongest early, and dies down to a wisp of smoke.
  const fires = [];
  function burn(obj, spots, { life = 16, size = 1 } = {}) { const f = { obj, spots, life, t: 0, size, a: 0, b: 0, c: 0 }; fires.push(f); return f; }
  function stepFires(dt) {
    for (let i = fires.length - 1; i >= 0; i--) {
      const f = fires[i]; f.t += dt;
      if (f.t > f.life + 4 || !f.obj.parent) { fires.splice(i, 1); continue; }
      const k = Math.min(1, f.t * 2.5) * Math.max(0, 1 - Math.pow(f.t / f.life, 2.5)), s = f.size, n = f.spots.length;
      if (!n) continue;   // nothing left of it to burn (a wreck blown or stamped to bits)
      f.obj.updateWorldMatrix(true, false);
      const at = () => { const sp = f.spots[Math.floor(R() * n)]; return _p.set(sp[0], sp[1], sp[2]).applyMatrix4(f.obj.matrixWorld); };
      // a spot that has gone under water is out: it steams for a while instead
      const drowned = (q) => { if (!api.water) return false; const w = api.water(q.x, q.z); if (w == null || q.y > w + 0.2) return false; if (k > 0.05 && R() < 0.1) { block(q.x, w + 0.3, q.z, (R() - 0.5) * 2, 3 + R() * 3, (R() - 0.5) * 2, 0.3 + R() * 0.3, 1 + R(), K.STEAM, 1.2, 2); f.hiss = true; } return true; };
      f.a += dt * 230 * k * Math.min(1, n / 8) * s;
      while (f.a >= 1) {   // tongues: small blocks, bright at the root, thinning as they climb
        f.a -= 1; const q = at(), j = () => (R() - 0.5) * 1.1, big = R() < 0.35; if (drowned(q)) continue;
        block(q.x + j(), q.y + R() * 0.4, q.z + j(), wind.x * 0.6 + j() * 1.6, (big ? 3.5 + R() * 3 : 6 + R() * 7) * s, wind.z * 0.6 + j() * 1.6, (big ? 0.42 + R() * 0.2 : 0.22 + R() * 0.2) * s, big ? 0.3 + R() * 0.25 : 0.34 + R() * 0.4, K.LICK, 1.3);
      }
      f.b += dt * (16 + 46 * k);
      while (f.b >= 1) {   // the smoke column
        f.b -= 1; const q = at(), j = () => (R() - 0.5) * 1.8; if (drowned(q)) continue;
        block(q.x + j(), q.y + 2.5 + R() * 2.5, q.z + j(), j(), 6 + R() * 4, j(), (0.3 + R() * 0.3) * s, 2.4 + R() * 1.8, K.SMOKE, 0.45, 2);
      }
      f.c += dt * 9 * k;
      while (f.c >= 1) {   // embers
        f.c -= 1; const q = at(); if (drowned(q)) continue;
        block(q.x, q.y + 1, q.z, (R() - 0.5) * 6, 7 + R() * 8, (R() - 0.5) * 6, 0.1 + R() * 0.06, 0.8 + R() * 0.9, K.SPARK, 0.8, 0, 6);
      }
    }
  }
  function clear() { fires.length = 0; blocks.length = 0; mesh.count = 0; }
  const api = { block, update, explode, dust, sparks, puff, splash, foam, burn, flash, clear, fires, water: null, get live() { return blocks.length; } };
  return api;
}
