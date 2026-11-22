// What the wheels do to a dirt floor (ground.js says where the dirt is and what colour; MAP.groundDetail turns it on):
//   - every wheel of every car presses its track into the dirt as it rolls, not only in a drift, deeper the harder it
//     digs (ground.js keeps the ruts; they build up over a round)
//   - the driven wheels (the back ones) throw a rooster tail when they spin up, slide or turn hard: clods arcing out and
//     bouncing, a spray of grit, and a cloud of dust
//   - a fast car trails dust; a big hit throws a burst of clods and dust; a blast on the dirt digs a crater and throws
//     clods all round
// All of it is two pools of fixed size, one draw each: soft points for the dust and grit (lit by the scene's own lights,
// so they sit right by day or at night) and instanced lumps for the clods. Their sizes go with the quality step, and a
// car far from the camera throws nothing. On a map without dirt (the race's streets) only the grass gives off a little
// dust behind a fast car.
import * as THREE from 'three';
import { writeTRS } from '../../src/sim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FAR = 260;   // voxels from the camera past which a car throws nothing (its ruts are still laid)
const SEG = 1.1;   // voxels a wheel goes between one piece of rut and the next
const G = -52;     // gravity on a clod, voxels a second a second
// clods are drawn a little lighter than the ground they came from: it faces the sun square, their faces mostly turn away
const CLOD_LIT = 1.3;
// how many of each there can be at once, by quality step (0 best .. 6 lightest)
const DUST = [2400, 2000, 1600, 1000, 700, 500, 380], CLODS = [520, 420, 340, 240, 170, 120, 90];

// ---- the dust and grit: soft points, lit in the vertex shader by whatever lights the scene has -------------------
const DUST_VS = /* glsl */`
#include <common>
#include <lights_pars_begin>
#include <fog_pars_vertex>
attribute vec4 pcol; attribute float psize; attribute float pkind;
uniform float scale; varying vec4 vC; varying float vKind;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = min( 400.0, psize * scale / max( 0.1, - mvPosition.z ) );
  // a cloud is lit from every side: the sky and the ambient light in full, a sun or a lamp by how much it is overhead
  vec3 up = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
  vec3 irr = ambientLightColor;
  #if NUM_HEMI_LIGHTS > 0
    for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) irr += getHemisphereLightIrradiance( hemisphereLights[ i ], up );
  #endif
  #if NUM_DIR_LIGHTS > 0
    for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) irr += directionalLights[ i ].color * ( 0.35 + 0.65 * max( dot( up, directionalLights[ i ].direction ), 0.0 ) );
  #endif
  #if NUM_SPOT_LIGHTS > 0 || NUM_POINT_LIGHTS > 0
    IncidentLight L;
  #endif
  #if NUM_SPOT_LIGHTS > 0
    for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) { getSpotLightInfo( spotLights[ i ], mvPosition.xyz, L ); irr += L.color * 0.7; }
  #endif
  #if NUM_POINT_LIGHTS > 0
    for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) { getPointLightInfo( pointLights[ i ], mvPosition.xyz, L ); irr += L.color * 0.7; }
  #endif
  vC = vec4( pcol.rgb * irr * RECIPROCAL_PI, pcol.a ); vKind = pkind;
  // a puff right in front of the camera fades away rather than fill the screen as a flat disc
  if ( pkind < 0.5 ) vC.a *= smoothstep( 2.0, 9.0, - mvPosition.z );
  #include <fog_vertex>
}`;
// kind 0 a soft puff; kind 1..2 a speck of grit, hard edged and a little lumpy (the fraction turns its lumps)
const DUST_FS = /* glsl */`
#include <common>
#include <fog_pars_fragment>
varying vec4 vC; varying float vKind;
void main() {
  vec2 d = gl_PointCoord - 0.5; float r = dot( d, d ) * 4.0;
  float a;
  if ( vKind > 0.5 ) { r *= 1.0 + 0.3 * sin( atan( d.y, d.x ) * 3.0 + vKind * 40.0 ); if ( r > 1.0 ) discard; a = vC.a; }
  else { if ( r > 1.0 ) discard; a = vC.a * ( 1.0 - r ) * ( 1.0 - r * 0.4 ); }
  gl_FragColor = vec4( vC.rgb, a );
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
function dustPool(scene, n) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n), kind = new Float32Array(n);
  const vel = new Float32Array(n * 3), life = new Float32Array(n), max = new Float32Array(n), s0 = new Float32Array(n), grow = new Float32Array(n), a0 = new Float32Array(n), gy = new Float32Array(n), drag = new Float32Array(n);
  const g = new THREE.BufferGeometry();
  const attr = (name, a, w) => g.setAttribute(name, new THREE.BufferAttribute(a, w).setUsage(THREE.DynamicDrawUsage));
  attr('position', pos, 3); attr('pcol', col, 4); attr('psize', size, 1); attr('pkind', kind, 1);
  g.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog, { scale: { value: 600 } }]),
    vertexShader: DUST_VS, fragmentShader: DUST_FS, lights: true, fog: true, transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(g, mat); points.frustumCulled = false; points.renderOrder = 9; points.matrixAutoUpdate = false;
  scene.add(points);
  let head = 0, cap = n;
  return {
    mat,
    get cap() { return cap; }, set cap(v) { cap = clamp(v, 16, n); if (head >= cap) head = 0; },
    spawn(x, y, z, vx, vy, vz, sz, lf, r, gg, b, a, gr, k, dr, gyy = 0) {
      const i = head; head = (head + 1) % cap;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      col[i * 4] = r; col[i * 4 + 1] = gg; col[i * 4 + 2] = b; col[i * 4 + 3] = 0;
      s0[i] = sz; size[i] = sz; life[i] = lf; max[i] = lf; grow[i] = gr; a0[i] = a; kind[i] = k; drag[i] = dr; gy[i] = gyy;
    },
    update(dt) {
      let lo = n, hi = -1;
      for (let i = 0; i < n; i++) {
        if (life[i] <= 0) continue;
        if ((life[i] -= dt) <= 0) { col[i * 4 + 3] = 0; size[i] = 0; continue; }
        if (i < lo) lo = i; hi = i;
        const t = 1 - life[i] / max[i], o = i * 3, dk = Math.exp(-drag[i] * dt);
        vel[o + 1] += gy[i] * dt;
        pos[o] += vel[o] * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += vel[o + 2] * dt;
        vel[o] *= dk; vel[o + 1] *= dk; vel[o + 2] *= dk;
        if (pos[o + 1] < 0.15) {
          pos[o + 1] = 0.15;
          if (kind[i] > 0.5) { vel[o] = vel[o + 1] = vel[o + 2] = 0; if (life[i] > 0.3) { life[i] = 0.3; max[i] = 0.3 / Math.max(0.05, 1 - t); } }   // grit lands and lies
          else vel[o + 1] *= -0.3;
        }
        size[i] = s0[i] * (1 + grow[i] * t);
        col[i * 4 + 3] = kind[i] > 0.5 ? a0[i] * (1 - t * t * t) : a0[i] * (1 - t) * Math.min(1, t * 10);
      }
      if (hi < 0) { g.setDrawRange(0, 0); return; }
      g.setDrawRange(lo, hi - lo + 1);
      const A = g.attributes;
      for (const [at, w] of [[A.position, 3], [A.pcol, 4], [A.psize, 1], [A.pkind, 1]]) { at.clearUpdateRanges(); at.addUpdateRange(lo * w, (hi - lo + 1) * w); at.needsUpdate = true; }
    },
  };
}

// ---- the clods: lumps of dirt, instanced, lit as everything else is (no shadows) -----------------------------------
function clodPool(scene, n) {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ flatShading: true }), n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.matrixAutoUpdate = false; mesh.count = 0;
  scene.add(mesh);
  const M = mesh.instanceMatrix.array, C = mesh.instanceColor.array;
  const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), rot = new Float32Array(n * 3), spin = new Float32Array(n * 3), scl = new Float32Array(n * 3), life = new Float32Array(n), max = new Float32Array(n);
  const dead = new Uint8Array(n).fill(1);
  let head = 0, cap = n, cLo = n, cHi = -1;
  return {
    get cap() { return cap; }, set cap(v) { cap = clamp(v, 16, n); if (head >= cap) head = 0; },
    spawn(x, y, z, vx, vy, vz, sz, lf, r, g, b) {
      const i = head, o = i * 3; head = (head + 1) % cap;
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; vel[o] = vx; vel[o + 1] = vy; vel[o + 2] = vz;
      rot[o] = Math.random() * 6.3; rot[o + 1] = Math.random() * 6.3; rot[o + 2] = Math.random() * 6.3;
      for (let k = 0; k < 3; k++) { spin[o + k] = (Math.random() - 0.5) * 22; scl[o + k] = sz * (0.65 + Math.random() * 0.55); }
      life[i] = lf; max[i] = lf; dead[i] = 0;
      C[o] = r; C[o + 1] = g; C[o + 2] = b; cLo = Math.min(cLo, i); cHi = Math.max(cHi, i);
    },
    update(dt) {
      let hi = -1;
      for (let i = 0; i < n; i++) {
        if (dead[i]) continue;
        const o = i * 3;
        if ((life[i] -= dt) <= 0) { dead[i] = 1; M.fill(0, i * 16, i * 16 + 16); hi = i > hi ? i : hi; continue; }
        hi = i;
        const r = scl[o + 1] * 0.6;
        vel[o + 1] += G * dt;
        pos[o] += vel[o] * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += vel[o + 2] * dt;
        if (pos[o + 1] < r) {   // a bounce, losing most of it; then it rolls to a stop
          pos[o + 1] = r;
          if (vel[o + 1] < -4) { vel[o + 1] *= -0.32; vel[o] *= 0.55; vel[o + 2] *= 0.55; spin[o] *= 0.5; spin[o + 1] *= 0.5; spin[o + 2] *= 0.5; }
          else { vel[o + 1] = 0; const k = Math.exp(-6 * dt); vel[o] *= k; vel[o + 2] *= k; spin[o] *= k; spin[o + 1] *= k; spin[o + 2] *= k; }
        }
        rot[o] += spin[o] * dt; rot[o + 1] += spin[o + 1] * dt; rot[o + 2] += spin[o + 2] * dt;
        const k = Math.min(1, life[i] / 0.35);   // shrinks away at the end
        writeTRS(M, i * 16, pos[o], pos[o + 1], pos[o + 2], rot[o], rot[o + 1], rot[o + 2], scl[o] * k, scl[o + 1] * k, scl[o + 2] * k);
      }
      mesh.count = hi + 1;
      if (hi >= 0) { const m = mesh.instanceMatrix; m.clearUpdateRanges(); m.addUpdateRange(0, (hi + 1) * 16); m.needsUpdate = true; }
      // the colours of the clods thrown since the last upload (three.js empties the list once it has sent them; until it
      // has, as when the game takes two steps a frame, the one waiting is widened, or the first step's would never go)
      if (cHi >= 0) {
        const c = mesh.instanceColor, w = c.updateRanges[0];
        if (w) { const e = Math.max(w.start + w.count, (cHi + 1) * 3); w.start = Math.min(w.start, cLo * 3); w.count = e - w.start; }
        else c.addUpdateRange(cLo * 3, (cHi - cLo + 1) * 3);
        c.needsUpdate = true; cLo = n; cHi = -1;
      }
    },
  };
}

// ---- the wheels -----------------------------------------------------------------------------------------------------
// the four wheels of a car, in its own space (+x its left, +z forward), how wide each tyre is, and which are driven
function wheelsOf(c) {
  if (c._wh) return c._wh;
  const parts = c.def.parts(), h = c.def.h, out = [];
  for (const name of ['wRL', 'wRR', 'wFL', 'wFR']) {
    const w = parts.find((p) => p.name === name);
    if (w) out.push({ x: w.pivot[0] * h, z: w.pivot[2] * h, half: Math.max(0.6, (w.box[3] - w.box[0]) * h * 0.5), rear: name[1] === 'R' });
  }
  if (out.length < 4) { out.length = 0; for (const [x, f] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) out.push({ x: x * c.wide * 0.8, z: c.mid + f * c.half * 0.6, half: 0.7, rear: f < 0 }); }
  return (c._wh = out);
}

export function makeDirt({ scene, camera, renderer, floor, MAP, mobile }) {
  const onDirt = floor.dirt;
  const top0 = mobile ? 3 : 0;   // the pools are made for the best step this device starts on
  const dust = dustPool(scene, DUST[top0]);
  const clods = onDirt ? clodPool(scene, CLODS[top0]) : null;
  let q = -1, K = 1;   // the quality step, and how much is thrown at it against the best
  const col = [0, 0, 0];
  // dust off the race's grass: a dry green-brown (as linear colour)
  const GRASS = [0.2, 0.19, 0.11];
  const dcol = [0, 0, 0];
  // dry dust is lighter and greyer than the ground it comes off
  const dustCol = (c) => { const l = (c[0] + c[1] + c[2]) / 3; dcol[0] = (c[0] * 0.7 + l * 0.3) * 1.45 + 0.02; dcol[1] = (c[1] * 0.7 + l * 0.3) * 1.45 + 0.02; dcol[2] = (c[2] * 0.7 + l * 0.3) * 1.45 + 0.02; return dcol; };
  // whole numbers of things to throw this frame from a rate, carrying the fraction over
  const take = (st, key, rate, dt) => { const v = (st[key] || 0) + rate * dt; const n = Math.floor(v); st[key] = v - n; return n; };

  // the dirt off one driven wheel: (x, z) where it touches, (dx, dz) the way it throws, k how hard, c the colour
  function rooster(st, x, z, y, dx, dz, k, cvx, cvz, c, dt) {
    const nc = take(st, 'c', 42 * k * K, dt), ns = take(st, 's', 190 * k * K, dt), nd = take(st, 'd', 40 * k * K, dt);
    for (let i = 0; i < nc; i++) {
      const sp = 14 + 34 * k * (0.5 + Math.random() * 0.7), j = (Math.random() - 0.5) * 0.7;
      const ex = dx - dz * j, ez = dz + dx * j, sh = CLOD_LIT * (0.85 + Math.random() * 0.45);
      clods.spawn(x, y, z, ex * sp + cvx * 0.35, 10 + Math.random() * 22 * k + 6 * k, ez * sp + cvz * 0.35, 0.16 + Math.random() * Math.random() * 0.42, 1.1 + Math.random() * 1.2, c[0] * sh, c[1] * sh, c[2] * sh);
    }
    for (let i = 0; i < ns; i++) {
      const sp = 14 + 40 * k * Math.random(), j = (Math.random() - 0.5) * 0.9, ex = dx - dz * j, ez = dz + dx * j, sh = 0.8 + Math.random() * 0.45;
      dust.spawn(x, y + Math.random() * 0.4, z, ex * sp + cvx * 0.35, 10 + Math.random() * 30 * k, ez * sp + cvz * 0.35, 0.28 + Math.random() * 0.4, 0.5 + Math.random() * 0.6, c[0] * sh, c[1] * sh, c[2] * sh, 1, 0, 1 + Math.random(), 0.6, G * 0.9);
    }
    const dc = dustCol(c);
    for (let i = 0; i < nd; i++) {
      const sp = 5 + 14 * k * Math.random(), j = (Math.random() - 0.5) * 1.2;
      dust.spawn(x + (Math.random() - 0.5), y + 0.6, z + (Math.random() - 0.5), (dx - dz * j) * sp + cvx * 0.2, 2 + Math.random() * 6 * k, (dz + dx * j) * sp + cvz * 0.2, 2.5 + Math.random() * 2.8, 1.1 + Math.random() * 1.3, dc[0], dc[1], dc[2], 0.32 + 0.25 * k, 2.4, 0, 1.6);
    }
  }
  // a burst: clods and dust thrown all round a point (a big hit, a blast). These are rare, so they are cut back less
  // than the steady spray is on the lighter steps (by the square root of it)
  function burst(x, z, k, c) {
    const kb = Math.sqrt(K), nc = Math.round(clamp(6 + 14 * k, 0, 40) * kb), nd = Math.round(clamp(4 + 8 * k, 0, 22) * kb), dc = dustCol(c);
    for (let i = 0; i < nc; i++) {
      const a = Math.random() * 6.283, sp = (8 + Math.random() * 26) * (0.6 + 0.5 * k), sh = CLOD_LIT * (0.85 + Math.random() * 0.45);
      clods.spawn(x + Math.cos(a), 0.6, z + Math.sin(a), Math.cos(a) * sp, 14 + Math.random() * 26 * Math.min(1.6, k), Math.sin(a) * sp, 0.18 + Math.random() * Math.random() * 0.5 * (0.7 + 0.4 * k), 1.3 + Math.random() * 1.2, c[0] * sh, c[1] * sh, c[2] * sh);
    }
    for (let i = 0; i < nd; i++) {
      const a = Math.random() * 6.283, sp = 6 + Math.random() * 16 * k;
      dust.spawn(x + Math.cos(a) * 2, 0.8, z + Math.sin(a) * 2, Math.cos(a) * sp, 2 + Math.random() * 6, Math.sin(a) * sp, 3 + Math.random() * 3 * k, 1.4 + Math.random() * 1.4, dc[0], dc[1], dc[2], 0.36, 2.2, 0, 1.4);
    }
  }

  const camNear = (x, z) => { const dx = x - camera.position.x, dz = z - camera.position.z; return dx * dx + dz * dz < FAR * FAR; };
  function car(c, dt) {
    const st = c._dirt || (c._dirt = { w: [{}, {}, {}, {}], vx: c.vx, vz: c.vz, x: c.x, z: c.z });
    const W = wheelsOf(c), s = Math.sin(c.yaw), co = Math.cos(c.yaw);
    const jumped = Math.hypot(c.x - st.x, c.z - st.z) > 12;   // put somewhere new (a respawn, the garage): no tracks, no burst
    const dv = Math.hypot(c.vx - st.vx, c.vz - st.vz);
    st.x = c.x; st.z = c.z; st.vx = c.vx; st.vz = c.vz;
    const fwd = c.fwd, sp = c.speed, topS = c.spec.top || 100;
    const vs = c.vx * co - c.vz * s;   // sideways, to the car's left
    const thr = c.dead ? 0 : Math.max(0, c.throttle || 0);
    // how hard the driven wheels dig: spinning up from slow, sliding, turning hard, a burst of nitro
    const spin = thr * clamp(1.2 - Math.max(0, fwd) / (topS * 0.6), 0, 1);
    const turn = clamp((Math.abs(c.yawRate * fwd) - 45) / 80, 0, 1);
    const slide = c.skid || 0, nitro = (c.miniT > 0 || c.boostT > 0) ? 0.45 * thr : 0;
    const dig = c.dead ? 0 : Math.max(spin * 0.9, slide, turn * 0.55, nitro);
    const near = camNear(c.x, c.z);
    // ---- the ruts ----
    if (onDirt) {
      const mass = clamp((c.spec.mass || 1) * 0.8, 0.7, 1.5);
      for (let k = 0; k < W.length; k++) {
        const w = W[k], T = st.w[k];
        const x = c.x + w.x * co + w.z * s, z = c.z - w.x * s + w.z * co;
        if (jumped || T.x === undefined) { T.x = x; T.z = z; T.e = null; T.v = 0; continue; }
        const dx = x - T.x, dz = z - T.z, d = Math.hypot(dx, dz);
        if (d < SEG) continue;
        if (floor.dirtAt(x, z) < 0.3) { T.x = x; T.z = z; T.e = null; continue; }
        // the strip's edges lie across the way the wheel is going; sliding, it smears wider
        const half = w.half * (1 + 0.8 * slide) * 1.45, px = -dz / d * half, pz = dx / d * half;
        const e = [x + px, z + pz, x - px, z - pz], a = T.e || [T.x + px, T.z + pz, T.x - px, T.z - pz];
        const deep = (0.055 + 0.09 * slide + (w.rear ? 0.07 * spin : 0)) * mass * (w.rear ? 1 : 0.75);
        floor.quad(a[0], a[1], a[2], a[3], e[0], e[1], e[2], e[3], T.v, T.v + d, deep, deep * 0.55, deep * 0.8);
        T.x = x; T.z = z; T.e = e; T.v += d;
      }
    }
    if (!near || jumped) return;
    // ---- a big hit: something stopped it (or shoved it) hard ----
    if (onDirt && dv > 20 && floor.dirtAt(c.x, c.z) > 0.5) {
      const mx = c.x + s * c.mid, mz = c.z + co * c.mid;
      burst(mx, mz, clamp((dv - 20) / 30, 0.3, 1.6), floor.colourAt(mx, mz, col));
    }
    // ---- the driven wheels ----
    const bx = -s, bz = -co, side = Math.sign(vs) * Math.min(1, Math.abs(vs) / 20);
    for (let k = 0; k < 2; k++) {
      const w = W[k], x = c.x + w.x * co + w.z * s, z = c.z - w.x * s + w.z * co, T = st.w[k];
      if (onDirt) {
        if (dig > 0.08 && floor.dirtAt(x, z) > 0.5) {
          // back off the tyre, and out the way the car slides
          let dx = bx * (0.45 + spin) + co * side * (slide * 1.4 + turn * 0.8), dz = bz * (0.45 + spin) - s * side * (slide * 1.4 + turn * 0.8);
          const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
          const r = c.wheelR || 1.5;
          rooster(T, x + bx * r, z + bz * r, 0.5, dx, dz, dig, c.vx, c.vz, floor.colourAt(x, z, col), dt);
        }
        // a fast car's trail of dust
        if (sp > 30 && !c.dead && floor.dirtAt(x, z) > 0.5) {
          const n = take(T, 't', 9 * clamp((sp - 30) / (topS * 0.7), 0, 1) * K, dt);
          if (n) {
            const dc = dustCol(floor.colourAt(x, z, col));
            for (let i = 0; i < n; i++) dust.spawn(x + bx * 2 + (Math.random() - 0.5) * 1.5, 0.7, z + bz * 2 + (Math.random() - 0.5) * 1.5, c.vx * 0.15 + (Math.random() - 0.5) * 3, 1 + Math.random() * 3, c.vz * 0.15 + (Math.random() - 0.5) * 3, 2.5 + Math.random() * 2.5, 1.6 + Math.random() * 1.6, dc[0], dc[1], dc[2], 0.22, 2.8, 0, 1.3);
          }
        }
      } else if (MAP.surface && sp > 40 && !c.dead && MAP.surface(x, z) > 0.3) {   // the race: a little dust off the grass
        const n = take(T, 't', 6 * clamp((sp - 40) / (topS * 0.7), 0, 1) * K, dt);
        for (let i = 0; i < n; i++) dust.spawn(x + bx * 2, 0.7, z + bz * 2, c.vx * 0.15 + (Math.random() - 0.5) * 3, 1 + Math.random() * 3, c.vz * 0.15 + (Math.random() - 0.5) * 3, 2.2 + Math.random() * 2, 1.2 + Math.random() * 1.2, GRASS[0], GRASS[1], GRASS[2], 0.18, 2.4, 0, 1.4);
      }
    }
  }

  return {
    // once a frame, after the cars have moved: their tracks, what they throw, the pools, and the ruts into the floor
    step(dt, cars, step) {
      if (step !== q) {
        q = step; K = DUST[q] / DUST[0];
        dust.cap = DUST[q]; if (clods) clods.cap = CLODS[q];   // (never more than the pools were made for)
        floor.setStep(q);
      }
      for (const c of cars) if (!c.gone) car(c, dt);
      dust.update(dt); if (clods) clods.update(dt);
      // a point's size on screen: voxels across, over its distance, times this
      dust.mat.uniforms.scale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
      floor.step(dt);
    },
    // a blast at (x, z) of reach r (main.js's scorch hook): on the dirt, a crater and clods thrown all round
    blast(x, z, r) {
      if (!onDirt || floor.dirtAt(x, z) < 0.5) return;
      floor.crater(x, z, clamp(r * 1.2, 3, 12), 0.5);
      if (camNear(x, z)) burst(x, z, clamp(r / 4, 0.6, 1.6), floor.colourAt(x, z, col));
    },
  };
}
