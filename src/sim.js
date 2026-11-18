// Destruction: blasts, glass, fire, support checks, falling sections (free, toppling, pancake), debris, rubble and particles.
// Tuned in the Wrecking Yard sandbox. Everything optional is behind a flag in `cfg`.
import * as THREE from 'three';
import { WX, WY, WZ, NCX, NCZ, SX, SXZ, XM, ZS, ZM, YS, NV, voxAt, ownerAt, sootAt, burnAt, setVox, setCell, setGone, setSoot, setBurn, eachVoxel, idx, solid, bodies, rubbleBody, M, MAT_R, MAT_G, MAT_B, SOFT, CARRY, HARD, TOUGH, SHAPE, FLAM, BURN, CHARP, PANE, jitter } from './world.js';
import { meshChunk, meshRegionCoarse, makeChunkMaterial, makeChunkDepthMaterial, meshOpts } from './mesh.js';

export const hooks = { destroyed() {}, bodyDown() {}, shake() {}, sound() {}, scorch() {}, impact() {}, explosion() {} };
export const stats = { destroyed: 0, active: 0, asleep: 0, particles: 0, burning: 0, quads: 0, rubble: 0 };
export const cfg = {
  glass: true,        // whole panes shatter into shards
  shapes: true,       // planks, shards, slabs and sheets instead of cubes
  rebar: true,        // concrete leaves bars behind
  topple: true,       // tall severed pieces hinge over like trees
  rubble: true,       // settled debris becomes rubble voxels
  linger: true,       // dust and smoke hang in the air
  fireSpread: true, expFire: true, burnCap: 5000,
  dust: 1,            // particle amount multiplier
  hang: 0.45,         // share of dust that hangs in the air
  debrisMul: 1,
};
const G = 68;
const MARGIN = 2.2;   // a storey gives way once it carries this many times its designed load for each block left in it
const UNDER = 0.45;   // a storey left with less than this share of what carried it gives way under any real load
const SLACK = 4;      // how many blocks further sideways than it was built a block may hang from its support before it falls
let scene;

// ---- chunks --------------------------------------------------------------
// Chunks that lost voxels are redrawn at once, nearest the action first and inside a time budget. One that is hit
// frame after frame (a wall coming down on it) is redrawn every third frame. Chunks that only gained rubble or soot
// wait longer, so a rain of rubble does not redraw a chunk every frame.
const chunkMesh = new Array(NCX * NCZ).fill(null);
const dirty = new Set(), lazy = new Set(), built = new Int32Array(NCX * NCZ);
let tick = 10, nearShadow = true;
let chunkMat, chunkDepth, focusX = WX / 2, focusZ = WZ / 2;
export function setFocus(x, z) { focusX = x; focusZ = z; }
function markLazy(x, z) { const k = (x >> 4) + (z >> 4) * NCX; if (!dirty.has(k)) lazy.add(k); }
export function markDirty(x, z) {
  const cx = x >> 4, cz = z >> 4;
  dirty.add(cx + cz * NCX);
  const lx = x & 15, lz = z & 15;
  if (lx === 0 && cx > 0) dirty.add(cx - 1 + cz * NCX); else if (lx === 15 && cx < NCX - 1) dirty.add(cx + 1 + cz * NCX);
  if (lz === 0 && cz > 0) dirty.add(cx + (cz - 1) * NCX); else if (lz === 15 && cz < NCZ - 1) dirty.add(cx + (cz + 1) * NCX);
}
function rebuildChunk(k) {
  const cx = k % NCX, cz = (k / NCX) | 0;
  stats.rebuilt = (stats.rebuilt || 0) + 1;   // counted for the playtest reports (playtest/server.mjs)
  built[k] = tick;
  const geo = meshChunk(cx, cz);
  let m = chunkMesh[k];
  if (m) { stats.quads -= m.geometry.userData.quads || 0; m.geometry.dispose(); if (!geo) { scene.remove(m); chunkMesh[k] = null; return; } m.geometry = geo; stats.quads += geo.userData.quads; return; }
  if (!geo) return;
  m = new THREE.Mesh(geo, chunkMat); m.customDepthMaterial = chunkDepth; m.position.set(cx * 16, 0, cz * 16); m.updateMatrix(); m.updateMatrixWorld(true);
  m.castShadow = nearShadow; m.receiveShadow = true; m.matrixAutoUpdate = false;
  scene.add(m); chunkMesh[k] = m; stats.quads += geo.userData.quads;
}
// how many changed chunks are redrawn each frame however long they take: two on a computer, one on a slow device
let MIN_CHUNKS = 2;
export function setMinChunks(n) { MIN_CHUNKS = n; }
const order = [];
const far = (k) => { const dx = (k % NCX) * 16 + 8 - focusX, dz = ((k / NCX) | 0) * 16 + 8 - focusZ; return dx * dx + dz * dz; };
export function flushChunks(ms = 5) {
  const t0 = performance.now();
  let n = 0;
  tick++;
  updateLod();
  if (dirty.size) {
    order.length = 0;
    for (const k of dirty) {
      if (lodNow[k]) { dirty.delete(k); lazy.delete(k); staleFar(k); continue; }   // shown coarse: redraw that copy instead
      if (tick - built[k] >= 3) order.push(k);
    }
    if (order.length > 2) order.sort((a, b) => far(a) - far(b));
    for (const k of order) { rebuildChunk(k); dirty.delete(k); lazy.delete(k); if (++n >= MIN_CHUNKS && performance.now() - t0 > ms) break; }
  }
  n = 0;
  for (const k of lazy) { if (n >= 2 || (n >= MIN_CHUNKS - 1 && performance.now() - t0 > ms)) break; if (tick - built[k] < 10 || dirty.has(k)) continue; lazy.delete(k); if (lodNow[k]) { staleFar(k); continue; } rebuildChunk(k); n++; }
  // coarse copies for far regions, nearest first, with whatever time is left (at least one every fourth frame)
  if (regTodo.size && (performance.now() - t0 < ms || (tick & 3) === 0)) {
    // a region that is already showing waits a while between redraws: far away a second's lag is not seen, and bots
    // wrecking the far side of the city would otherwise redraw several regions every frame
    fOrder.length = 0; for (const r of regTodo) if (regMesh[r] === null || tick - regBuilt[r] >= (r >= 2 * NRG ? 90 : 30)) fOrder.push(r);
    if (fOrder.length > 1) fOrder.sort((a, b) => regFar(a) - regFar(b));
    let m = 0;
    for (const r of fOrder) {
      if (m >= 1 && performance.now() - t0 > ms) break;
      regTodo.delete(r); buildRegion(r); m++;
    }
    if (m) lodX = -1e9;   // show what was just built
  }
}

// ---- far chunks: coarse copies (mesh.js meshRegionCoarse) ----------------------------------------------------------------
// Past LOD1 voxels from the action, chunks are drawn by region: one mesh for 2 x 2 chunks at half the detail. Past LOD2,
// one mesh for 4 x 4 chunks at a quarter of the detail. So the far city is a few hundred draws instead of thousands, with
// a fraction of the triangles. Until a region's mesh is built, its chunks show the next finer copy that is ready.
// A chunk that changes while shown coarse redraws only the region showing it; its full copy is redrawn when it comes near.
// Regions are numbered r = level * NRG + (rx + rz * NRX) on a grid of 2 x 2 chunks; a level-2 region is named by its first
// 2 x 2 cell (rx, rz both even).
const NCH = NCX * NCZ, NRX = Math.ceil(NCX / 2), NRZ = Math.ceil(NCZ / 2), NRG = NRX * NRZ;
const regMesh = new Array(3 * NRG).fill(null), regStale = new Uint8Array(3 * NRG), regShown = new Uint8Array(3 * NRG), regBuilt = new Int32Array(3 * NRG);
const lodNow = new Uint8Array(NCH), nearStale = new Uint8Array(NCH);   // what each chunk shows: 0 its full copy, 1 or 2 a region
const regTodo = new Set(), fOrder = [];
const cell = (k) => ((k % NCX) >> 1) + (((k / NCX) | 0) >> 1) * NRX;   // the 2 x 2 cell a chunk is in
const up2 = (c) => ((c % NRX) & ~1) + (((c / NRX) | 0) & ~1) * NRX;   // the level-2 region's cell
const regFar = (r) => {
  const L = (r / NRG) | 0, c = r % NRG, n = L === 2 ? 4 : 2;
  const dx = ((c % NRX) * 2 + n / 2) * 16 - focusX, dz = (((c / NRX) | 0) * 2 + n / 2) * 16 - focusZ; return dx * dx + dz * dz;
};
let LOD1 = Infinity, LOD2 = Infinity, lodX = -1e9, lodZ = -1e9;
export function setLod(d1, d2) { if (d1 === LOD1 && d2 === LOD2) return; LOD1 = d1; LOD2 = d2; lodX = -1e9; }
export function lodStats() {
  let a = 0, b = 0, r1 = 0, r2 = 0;
  for (let k = 0; k < NCH; k++) { if (lodNow[k] === 1) a++; else if (lodNow[k] === 2) b++; }
  for (let c = 0; c < NRG; c++) { r1 += regShown[NRG + c]; r2 += regShown[2 * NRG + c]; }
  return { half: a, quarter: b, regions: r1 + r2, waiting: regTodo.size };
}
function staleFar(k) {
  nearStale[k] = 1;
  const c = cell(k), r1 = NRG + c, r2 = 2 * NRG + up2(c);
  regStale[r1] = 1; regStale[r2] = 1;
  if (lodNow[k] === 1) regTodo.add(r1); else if (lodNow[k] === 2) regTodo.add(r2);
}
function buildRegion(r) {
  const L = (r / NRG) | 0, c = r % NRG, rx = (c % NRX) * 2, rz = ((c / NRX) | 0) * 2, n = L === 2 ? 4 : 2;
  const t = performance.now(), geo = meshRegionCoarse(rx, rz, n, L === 2 ? 4 : 2), m = regMesh[r];
  stats.regions = (stats.regions || 0) + 1; stats.regionMs = (stats.regionMs || 0) + performance.now() - t;   // for the playtest reports
  regStale[r] = 0; regBuilt[r] = tick;
  if (m) { m.geometry.dispose(); if (geo) m.geometry = geo; else { scene.remove(m); regMesh[r] = false; } return; }
  if (!geo) { regMesh[r] = false; return; }   // nothing there: built, and empty
  const mm = new THREE.Mesh(geo, chunkMat); mm.customDepthMaterial = chunkDepth; mm.position.set(rx * 16, 0, rz * 16); mm.updateMatrix(); mm.updateMatrixWorld(true);
  mm.castShadow = false; mm.receiveShadow = true;   // far past the shadow box round the monster
  mm.matrixAutoUpdate = false; mm.visible = !!regShown[r]; scene.add(mm); regMesh[r] = mm;
}
const ready = (r) => regMesh[r] !== null;   // built (a mesh, or false when the region is empty); may be stale
function showRegion(r, on) { if (regShown[r] === on) return; regShown[r] = on; if (regMesh[r]) regMesh[r].visible = !!on; }
function updateLod() {
  const dx = focusX - lodX, dz = focusZ - lodZ;
  if (dx * dx + dz * dz < 64) return;   // looked at again when the action has moved 8 voxels
  lodX = focusX; lodZ = focusZ;
  const a = LOD1 * LOD1, b = LOD2 * LOD2;
  for (let c2 = 0; c2 < NRG; c2++) {
    if (((c2 % NRX) & 1) || (((c2 / NRX) | 0) & 1)) continue;   // level-2 regions start on even cells
    const r2 = 2 * NRG + c2, want2 = regFar(r2) > b, show2 = want2 && ready(r2) ? 1 : 0;
    if (want2 && (!ready(r2) || regStale[r2])) regTodo.add(r2);
    showRegion(r2, show2);
    for (let j = 0; j < 4; j++) {
      const cx = (c2 % NRX) + (j & 1), cz = ((c2 / NRX) | 0) + (j >> 1);
      if (cx >= NRX || cz >= NRZ) continue;
      const c = cx + cz * NRX, r1 = NRG + c;
      const want1 = !show2 && (want2 || regFar(r1) > a);
      if (want1 && !want2 && (!ready(r1) || regStale[r1])) regTodo.add(r1);
      const show1 = want1 && ready(r1) ? 1 : 0;
      showRegion(r1, show1);
      const L = show2 ? 2 : show1 ? 1 : 0;
      for (let q = 0; q < 4; q++) {
        const kx = cx * 2 + (q & 1), kz = cz * 2 + (q >> 1);
        if (kx >= NCX || kz >= NCZ) continue;
        const k = kx + kz * NCX;
        if (lodNow[k] === L) continue;
        lodNow[k] = L;
        const near = chunkMesh[k]; if (near) near.visible = L === 0;
        if (L === 0 && nearStale[k]) { nearStale[k] = 0; dirty.add(k); }   // its full copy is out of date: redrawn in turn
      }
    }
  }
}

// ---- particles -----------------------------------------------------------
class Particles {
  constructor(n, additive) {
    this.n = n; this.head = 0; this.live = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n); this.grow = new Float32Array(n); this.s0 = new Float32Array(n); this.a0 = new Float32Array(n);
    this.gy = new Float32Array(n); this.drag = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('pcol', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(WX / 2, 20, WZ / 2), 500);
    const mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 }, boost: { value: additive ? 1.5 : 1 } },
      vertexShader: 'attribute vec4 pcol; attribute float psize; varying vec4 vc; uniform float scale; void main(){ vc=pcol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=min(560.0, psize*scale/max(0.1,-mv.z)); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec4 vc; uniform float boost; void main(){ vec2 d=gl_PointCoord-0.5; float r=dot(d,d)*4.0; if(r>1.0) discard; float a=vc.a*(1.0-r)*(1.0-r*0.4); gl_FragColor=vec4(vc.rgb*boost,a); }',
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mat = mat;
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false; this.points.renderOrder = additive ? 11 : 10;
  }
  spawn(x, y, z, vx, vy, vz, size, life, r, g, b, a, grow, gy = 0, drag = 2.2) {
    const i = this.head; this.head = (i + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    this.s0[i] = size; this.size[i] = size; this.life[i] = life; this.max[i] = life; this.grow[i] = grow; this.a0[i] = a; this.gy[i] = gy; this.drag[i] = drag;
  }
  update(dt) {
    const { pos, vel, life, max, col, size } = this;
    let live = 0, lo = this.n, hi = -1;
    for (let i = 0; i < this.n; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { col[i * 4 + 3] = 0; size[i] = 0; continue; }
      live++; if (i < lo) lo = i; hi = i;
      const t = 1 - life[i] / max[i];
      vel[i * 3 + 1] += this.gy[i] * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.2) { pos[i * 3 + 1] = 0.2; vel[i * 3 + 1] *= -0.3; }
      const dr = Math.exp(-this.drag[i] * dt); vel[i * 3] *= dr; vel[i * 3 + 1] *= dr; vel[i * 3 + 2] *= dr;
      size[i] = this.s0[i] * (1 + this.grow[i] * t);
      col[i * 4 + 3] = this.a0[i] * (1 - t) * Math.min(1, t * 12);
    }
    this.live = live;
    // only the span that holds live particles is sent to the graphics card and drawn (it used to be all 9,200 every frame)
    const g = this.points.geometry;
    if (hi < 0) { g.setDrawRange(0, 0); return; }
    g.setDrawRange(lo, hi - lo + 1);
    const A = g.attributes;
    for (const [at, w] of [[A.position, 3], [A.pcol, 4], [A.psize, 1]]) { at.clearUpdateRanges(); at.addUpdateRange(lo * w, (hi - lo + 1) * w); at.needsUpdate = true; }
  }
}
let dustP, fireP;
const wind = { x: 0.9, z: 0.35 };
const amt = (n) => { const v = n * cfg.dust; return Math.floor(v) + (Math.random() < v % 1 ? 1 : 0); };
export function dust(x, y, z, n, spread, r = 0.78, g = 0.74, b = 0.68) {
  n = amt(n);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, s = Math.random() * spread, hang = cfg.linger && Math.random() < cfg.hang;
    dustP.spawn(x + Math.cos(a) * s * 0.5, y + Math.random() * spread * 0.5, z + Math.sin(a) * s * 0.5,
      Math.cos(a) * s * 1.6 + (hang ? wind.x * 2 : 0), 2 + Math.random() * 5, Math.sin(a) * s * 1.6 + (hang ? wind.z * 2 : 0),
      4.5 + Math.random() * 5.5, hang ? 5 + Math.random() * 5 : 1.2 + Math.random() * 1.6, r, g, b, hang ? 0.26 + Math.random() * 0.14 : 0.5 + Math.random() * 0.25, hang ? 2.6 : 1.6, hang ? 0.25 : 0, hang ? 1.5 : 2.2);
  }
}
// A low wall of dust thrown outward from a point, as if shoved by a shockwave: it races out and stalls near `reach`.
// The move effects are sized in proportion to the monster: this scales their dust and motes with him.
let fxK = 1;
export function setFxScale(k) { fxK = k; }
export function dustWave(x, y, z, n, reach, tall = 1, alpha = 0.6, r = 0.78, g = 0.74, b = 0.68) {
  n = amt(n);
  const a0 = Math.random() * 6.283;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i + Math.random()) / n * 6.283, drag = 3.4, v = reach * drag * (0.7 + Math.random() * 0.45), s0 = reach * 0.06 * Math.random();
    dustP.spawn(x + Math.cos(a) * s0, y + Math.random() * 1.5 * tall * fxK, z + Math.sin(a) * s0, Math.cos(a) * v, (0.5 + Math.random() * 3.5) * tall * fxK, Math.sin(a) * v,
      (3.2 + Math.random() * 4.2) * (0.6 + 0.4 * tall) * fxK, 0.8 + Math.random() * 0.9, r, g, b, alpha * (0.8 + Math.random() * 0.4), 2.0, 0, drag);
  }
}
// One puff of dust or one glowing mote with its own velocity, for effects that steer their particles themselves.
export function puff(x, y, z, vx, vy, vz, size, life, a = 0.4, grow = 0.6, drag = 0) { if (Math.random() < cfg.dust * 1.4) dustP.spawn(x, y, z, vx, vy, vz, size * fxK, life, 0.78, 0.74, 0.68, a, grow, 0, drag); }
export function mote(x, y, z, vx, vy, vz, size, life, r, g, b) { fireP.spawn(x, y, z, vx, vy, vz, size * fxK, life, r, g, b, 1, -0.5, 0, 0); }
export function smoke(x, y, z, n, spread, dark = 0.16) {
  n = amt(n);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, s = Math.random() * spread, life = cfg.linger ? 5 + Math.random() * 5 : 2 + Math.random() * 2, d = dark + Math.random() * 0.08;
    dustP.spawn(x + Math.cos(a) * s, y + Math.random() * 2, z + Math.sin(a) * s, wind.x * 2.8 + Math.cos(a) * 1.4, 6 + Math.random() * 5, wind.z * 2.8 + Math.sin(a) * 1.4,
      5.5 + Math.random() * 5.5, life, d, d * 0.95, d * 0.92, 0.42, 2.4, 0.9, 0.6);
  }
}
export function fire(x, y, z, n, spread) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, e = Math.random() * 3.14 - 1.57, s = spread * (0.3 + Math.random());
    fireP.spawn(x, y, z, Math.cos(a) * Math.cos(e) * s * 3, Math.abs(Math.sin(e)) * s * 3 + 4, Math.sin(a) * Math.cos(e) * s * 3,
      3.6 + Math.random() * 6, 0.35 + Math.random() * 0.5, 1.0, 0.45 + Math.random() * 0.35, 0.12, 0.9, 1.2);
  }
}
function flame(x, y, z) {
  fireP.spawn(x + (Math.random() - 0.5) * 0.9, y + 0.3, z + (Math.random() - 0.5) * 0.9, wind.x * 1.1 + (Math.random() - 0.5) * 2, 6 + Math.random() * 7, wind.z * 1.1 + (Math.random() - 0.5) * 2,
    2 + Math.random() * 2.6, 0.4 + Math.random() * 0.45, 1.0, 0.26 + Math.random() * 0.3, 0.04, 0.5, -0.5, 3, 1.2);
}
export function sparks(x, y, z, n, r, g, b, speed = 26) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, e = Math.random() * 1.4;
    fireP.spawn(x, y, z, Math.cos(a) * Math.cos(e) * speed, Math.sin(e) * speed, Math.sin(a) * Math.cos(e) * speed, 1.1 + Math.random() * 1.2, 0.3 + Math.random() * 0.5, r, g, b, 1, 0, -46, 1.2);
  }
}

// ---- debris --------------------------------------------------------------
const ND = 16000;
const dp = new Float32Array(ND * 3), dv = new Float32Array(ND * 3), dr = new Float32Array(ND * 3), dw = new Float32Array(ND * 3), ds = new Float32Array(ND * 3);
const dh = new Float32Array(ND), dlife = new Float32Array(ND), dstate = new Uint8Array(ND), dmat = new Uint8Array(ND), dlvl = new Uint8Array(ND); // 0 free 1 active 2 asleep 3 turned to rubble, about to go
const dhot = new Float32Array(ND);   // seconds a piece keeps burning
let dmesh, dhead = 0, frame = 0, hotNext = 0;   // hotNext: the next piece spawned comes off something that was alight
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
export let debrisBudget = 8000;
let dShown = 0, cLo = 1e9, cHi = -1;
export function setDebrisBudget(n) {
  n = Math.max(500, Math.min(ND, n));
  for (let i = n; i < debrisBudget; i++) if (dstate[i]) { dstate[i] = 0; dmesh.setMatrixAt(i, ZERO); }
  debrisBudget = n; if (dhead >= n) dhead = 0; dmesh.count = n; dmesh.instanceMatrix.needsUpdate = true;
}
function writeDebris(i) {
  const k = dstate[i] === 2 && dlife[i] < 1 ? Math.max(0, dlife[i]) : 1;
  _e.set(dr[i * 3], dr[i * 3 + 1], dr[i * 3 + 2]); _q.setFromEuler(_e);
  _p.set(dp[i * 3], dp[i * 3 + 1], dp[i * 3 + 2]); _s.set(ds[i * 3] * k, ds[i * 3 + 1] * k, ds[i * 3 + 2] * k);
  _m.compose(_p, _q, _s); dmesh.setMatrixAt(i, _m);
}
export function spawnDebris(x, y, z, vx, vy, vz, m, lvl = 1, size = 0) {
  let i = -1;
  for (let t = 0; t < 40; t++) { const k = (dhead + t) % debrisBudget; if (dstate[k] === 0) { i = k; break; } }
  if (i < 0) { for (let t = 0; t < 200; t++) { const k = (dhead + t) % debrisBudget; if (dstate[k] === 2) { i = k; break; } } }
  if (i < 0) return;
  dhead = (i + 1) % debrisBudget;
  const a = i * 3;
  dp[a] = x; dp[a + 1] = y; dp[a + 2] = z;
  dv[a] = vx; dv[a + 1] = vy; dv[a + 2] = vz;
  dr[a] = Math.random() * 6; dr[a + 1] = Math.random() * 6; dr[a + 2] = Math.random() * 6;
  dw[a] = (Math.random() - 0.5) * 12; dw[a + 1] = (Math.random() - 0.5) * 12; dw[a + 2] = (Math.random() - 0.5) * 12;
  const sh = cfg.shapes ? SHAPE[m] : 0, s = size || (Math.random() < 0.25 ? 1.3 + Math.random() * 0.8 : 0.75 + Math.random() * 0.3);
  let j = 0.85 + Math.random() * 0.25;
  if (sh === 1) { ds[a] = 0.5; ds[a + 1] = 0.4; ds[a + 2] = 1.8 + Math.random() * 1.6; dh[i] = 0.22; }
  else if (sh === 2) { const q = 0.5 + Math.random() * 0.8; ds[a] = q; ds[a + 1] = q * (0.5 + Math.random()); ds[a + 2] = 0.09; dh[i] = 0.08; j = 1.25; }
  else if (sh === 3) { const rq = Math.random(), q = 0.9 + rq * rq * 1.3; ds[a] = q; ds[a + 1] = q * (0.6 + Math.random() * 0.4); ds[a + 2] = q * (0.7 + Math.random() * 0.4); dh[i] = q * 0.4; }
  else if (sh === 4) { const q = 0.45 + Math.random() * 0.35; ds[a] = q; ds[a + 1] = q; ds[a + 2] = q; dh[i] = q * 0.5; dw[a] *= 0.4; }
  else if (sh === 5) { const q = 0.6 + Math.random() * 0.4; ds[a] = q; ds[a + 1] = q * 1.3; ds[a + 2] = q; dh[i] = q * 0.5; }
  else if (sh === 6) { const q = 1.1 + Math.random() * 0.9; ds[a] = q; ds[a + 1] = 0.18; ds[a + 2] = q * (0.6 + Math.random() * 0.4); dh[i] = 0.12; }
  else { ds[a] = s; ds[a + 1] = s; ds[a + 2] = s; dh[i] = s * 0.5; }
  dlife[i] = 12 + Math.random() * 14; dstate[i] = 1; dmat[i] = m; dlvl[i] = lvl;
  if (sh === 5) dlife[i] = 3 + Math.random() * 2;
  dhot[i] = hotNext && cfg.fireSpread ? 2.2 + Math.random() * 3.8 : 0; hotNext = 0;
  if (dhot[i]) j *= 0.45;   // scorched
  _c.setRGB(MAT_R[m] * j, MAT_G[m] * j, MAT_B[m] * j);
  dmesh.setColorAt(i, _c); if (i < cLo) cLo = i; if (i > cHi) cHi = i;   // sent with the next update (updateDebris)
}
export function pushDebris(cx, cy, cz, r, force, up = 0.5) {
  const r2 = r * r;
  for (let i = 0; i < debrisBudget; i++) {
    if (!dstate[i] || dstate[i] === 3) continue;
    const x = dp[i * 3] - cx, y = dp[i * 3 + 1] - cy, z = dp[i * 3 + 2] - cz, d2 = x * x + y * y + z * z;
    if (d2 > r2) continue;
    const d = Math.sqrt(d2) + 0.3, f = force * (1 - d / (r + 0.3)) / d;
    dv[i * 3] += x * f; dv[i * 3 + 1] += y * f + force * up * (1 - d / (r + 0.3)); dv[i * 3 + 2] += z * f;
    if (dstate[i] === 2) { dstate[i] = 1; dlife[i] = Math.max(dlife[i], 8); }
  }
}
// Feet and tail shove loose pieces around.
export function kickDebris(cx, cz, r, vx, vz, maxY) {
  const r2 = r * r;
  for (let i = 0; i < debrisBudget; i++) {
    if (!dstate[i] || dstate[i] === 3) continue;
    const a = i * 3;
    if (dp[a + 1] > maxY) continue;
    const x = dp[a] - cx, z = dp[a + 2] - cz, d2 = x * x + z * z;
    if (d2 > r2) continue;
    const d = Math.sqrt(d2) + 0.2;
    dv[a] = vx * 0.9 + (x / d) * 14; dv[a + 2] = vz * 0.9 + (z / d) * 14; dv[a + 1] = 8 + Math.random() * 10;
    dw[a] = (Math.random() - 0.5) * 14; dw[a + 2] = (Math.random() - 0.5) * 14;
    if (dstate[i] === 2) { dstate[i] = 1; dlife[i] = Math.max(dlife[i], 8); }
  }
}
// A settled piece becomes a rubble voxel of its own material, so heaps build up and can be hit again.
function settle(i) {
  const sh = SHAPE[dmat[i]];
  if (!cfg.rubble || !(sh === 0 || sh === 3 || (sh === 1 && Math.random() < 0.3) || (sh === 6 && Math.random() < 0.25)) || Math.random() > 0.6) return false;
  const a = i * 3, x = Math.floor(dp[a]), y = Math.floor(dp[a + 1] - dh[i] + 0.3), z = Math.floor(dp[a + 2]);
  if (x < 1 || z < 1 || x >= WX - 1 || z >= WZ - 1 || y < 0 || y >= WY - 1) return false;
  const k = idx(x, y, z);
  if (voxAt(k) || (y > 0 && !voxAt(idx(x, y - 1, z)))) return false;
  setCell(k, PANE[dmat[i]] ? M.STONE : dmat[i], rubbleBody[dlvl[i]].id); setGone(k, 0);
  markLazy(x, z); stats.rubble++;
  dstate[i] = 3; dlife[i] = 0.4; // the piece stays in view until its voxel has been drawn
  return true;
}
function updateDebris(dt) {
  let active = 0, asleep = 0, hotN = 0;
  const hotP = Math.min(1, 90 / (stats.hot || 1));   // however many pieces are alight, they share a fixed budget of flames
  frame++;
  let top = -1;
  for (let i = 0; i < debrisBudget; i++) {
    const st = dstate[i];
    if (!st) continue;
    top = i;
    const a = i * 3;
    if (st === 3) { dlife[i] -= dt; if (dlife[i] <= 0) { dstate[i] = 0; dmesh.setMatrixAt(i, ZERO); } continue; }
    if (dhot[i] > 0) {
      // a burning piece trails flame as it flies, and smoulders for a while where it comes to rest
      dhot[i] -= dt; hotN++;
      if ((i + frame) % (st === 1 ? 3 : 7) === 0 && Math.random() < hotP) { flame(dp[a], dp[a + 1], dp[a + 2]); if ((i + frame) % 21 === 0) smoke(dp[a], dp[a + 1] + 1, dp[a + 2], 1, 0.5); }
    }
    if (st === 2) {
      asleep++;
      dlife[i] -= dt;
      if (dlife[i] <= 0) { dstate[i] = 0; dmesh.setMatrixAt(i, ZERO); continue; }
      if (dlife[i] < 1) { writeDebris(i); continue; }
      if ((i + frame) % 24 === 0) {
        const h = dh[i];
        if (dp[a + 1] > h + 0.2 && !solid(Math.floor(dp[a]), Math.floor(dp[a + 1] - h - 0.3), Math.floor(dp[a + 2]))) dstate[i] = 1;
      }
      continue;
    }
    active++;
    const h = dh[i];
    dv[a + 1] -= G * dt;
    const px = dp[a], py = dp[a + 1], pz = dp[a + 2];
    let nx = px + dv[a] * dt, ny = py + dv[a + 1] * dt, nz = pz + dv[a + 2] * dt, rest = false;
    if (ny < h) {
      ny = h;
      if (dv[a + 1] > -6) { dv[a + 1] = 0; rest = true; } else dv[a + 1] *= -0.32;
      dv[a] *= 0.72; dv[a + 2] *= 0.72; dw[a] *= 0.6; dw[a + 1] *= 0.6; dw[a + 2] *= 0.6;
    } else if (solid(Math.floor(nx), Math.floor(ny - h * 0.6), Math.floor(nz))) {
      if (!solid(Math.floor(px), Math.floor(ny - h * 0.6), Math.floor(pz))) {
        nx = px; nz = pz; dv[a] *= -0.3; dv[a + 2] *= -0.3;
      } else {
        ny = py;
        if (dv[a + 1] < 0) { if (dv[a + 1] > -6) { dv[a + 1] = 0; rest = true; } else dv[a + 1] *= -0.28; dv[a] *= 0.7; dv[a + 2] *= 0.7; dw[a] *= 0.6; dw[a + 1] *= 0.6; dw[a + 2] *= 0.6; }
        else dv[a + 1] *= -0.3;
        if (solid(Math.floor(nx), Math.floor(ny - h * 0.6), Math.floor(nz))) { nx = px; nz = pz; dv[a] *= -0.3; dv[a + 2] *= -0.3; }
      }
    }
    dp[a] = nx; dp[a + 1] = ny; dp[a + 2] = nz;
    dr[a] += dw[a] * dt; dr[a + 1] += dw[a + 1] * dt; dr[a + 2] += dw[a + 2] * dt;
    if (rest && dv[a] * dv[a] + dv[a + 2] * dv[a + 2] < 2) {
      dstate[i] = 2; dv[a] = dv[a + 2] = 0;
      if (dhot[i] > 0 && Math.random() < 0.6) igniteAt(dp[a], dp[a + 1], dp[a + 2], 1.8, 0.5);   // and can set light to what it lands on
      if (ds[a + 1] < 0.45 && ds[a + 2] > 1 || ds[a + 2] < 0.1) { dr[a] = ds[a + 2] < 0.1 ? Math.PI / 2 : 0; dr[a + 2] = 0; } // planks, sheets and shards lie flat
      if (settle(i)) { writeDebris(i); continue; }
    }
    writeDebris(i);
  }
  // draw and send only up to the highest piece in use (it used to be all 8,000 boxes, drawn and sent every frame)
  const shown = top + 1, im = dmesh.instanceMatrix, upTo = Math.max(shown, dShown);
  dmesh.count = shown; dShown = shown;
  if (upTo > 0) { im.clearUpdateRanges(); im.addUpdateRange(0, upTo * 16); im.needsUpdate = true; }
  if (cHi >= 0) { const ic = dmesh.instanceColor; ic.clearUpdateRanges(); ic.addUpdateRange(cLo * 3, (cHi - cLo + 1) * 3); ic.needsUpdate = true; cLo = 1e9; cHi = -1; }
  stats.active = active; stats.asleep = asleep; stats.hot = hotN;
}

// ---- voxel removal -------------------------------------------------------
const pending = new Set();
const failing = [];
const explQueue = [];
const glassQ = [];
const burnT = new Map();
// A storey's strength is counted in voxels that hold something up: carrying material with more of the same body's
// carrying material straight above (walls and columns, not floorboards or a roof). Call before voxel i stops carrying.
function uncarry(b, i, y, m) {
  if (!CARRY[m]) return;
  const up = i + SXZ, dn = i - SXZ;
  if (ownerAt(up) === b.id && CARRY[voxAt(up)]) b.carry[y] -= CARRY[m];
  if (y > 0 && ownerAt(dn) === b.id) b.carry[y - 1] -= CARRY[voxAt(dn)];
}
const loose = [];   // rubble that may have lost what it lay on
let simStep = 0;
const later = [];   // bodies to look at again shortly: [id, seconds]
function removeVoxel(i, x, y, z) {
  const m = voxAt(i);
  const b = bodies[ownerAt(i)];
  hotNext = burnAt(i);
  if (b && !b.span0 && b.kind !== 'rubble') prime(b);
  if (b && b.kind !== 'rubble') { uncarry(b, i, y, m); b.count--; b.layers[y]--; pending.add(b.id); stats.destroyed++; }
  setVox(i, 0); setGone(i, 1);
  if (burnAt(i)) { setBurn(i, 0); burnT.delete(i); }
  markDirty(x, z);
  // what leaned on this voxel: rubble lying on top of it, and parts that hang on another body (a sign on a roof)
  for (let f = 0; f < 6; f++) {
    const k = i + NB[f];
    if (k < 0 || k >= NV || !voxAt(k)) continue;
    const o = bodies[ownerAt(k)];
    if (!o) continue;
    if (o.kind === 'rubble') { if (f === 4) loose.push(k); } else if (o !== b && o.hung) pending.add(o.id);
  }
  if (m === M.FUEL && b && !b.exploded) { b.exploded = true; explQueue.push([x + 0.5, y + 0.5, z + 0.5, b.explosive || 11, 0.25]); }
  return m;
}
const lvlOf = (i) => { const b = bodies[ownerAt(i)]; return b ? b.level : 1; };
let lastHit = [0, 0, 0];
const list = new Int32Array(400000);
const NB = [1, -1, SX, -SX, SXZ, -SXZ];

// Glass: one broken voxel takes the whole pane with it, as thin glinting shards.
const paneStack = new Int32Array(4096);
function shatterPane(i0, dx, dy, dz) {
  if (!PANE[voxAt(i0)]) return 0;
  let sp = 0, n = 0, sx = 0, sy = 0, sz = 0;
  paneStack[sp++] = i0;
  const lvl = lvlOf(i0);
  while (sp && n < 600) {
    const i = paneStack[--sp];
    if (!PANE[voxAt(i)]) continue;
    const x = (i & XM), z = ((i >> ZS) & ZM), y = (i >> YS);
    const gm = removeVoxel(i, x, y, z); n++; sx += x; sy += y; sz += z;
    if (Math.random() < 0.5 * cfg.debrisMul) spawnDebris(x + 0.5, y + 0.5, z + 0.5, dx * (8 + Math.random() * 12) + (Math.random() - 0.5) * 9, dy * 8 + Math.random() * 7, dz * (8 + Math.random() * 12) + (Math.random() - 0.5) * 9, gm, lvl);
    for (let f = 0; f < 6; f++) { const k = i + NB[f]; if (k >= 0 && k < NV && PANE[voxAt(k)] && sp < 4090) paneStack[sp++] = k; }
  }
  if (n) {
    const cx = sx / n + 0.5, cy = sy / n + 0.5, cz = sz / n + 0.5;
    sparks(cx, cy, cz, Math.min(14, 2 + (n >> 2)), 0.85, 0.95, 1.0, 16);
    hooks.sound('glass', Math.min(1, 0.4 + n / 120), cx, cy, cz);
    hooks.destroyed(n, cx, cy, cz, true);
  }
  return n;
}

// A hit: the core turns to dust, the shell is thrown as debris.
export function blast(cx, cy, cz, r, o = {}) {
  const push = o.push ?? 9, core = o.core ?? 0.45, maxDeb = (o.maxDebris ?? 260) * cfg.debrisMul, ys = o.ys ?? 1;
  const dx = o.dx || 0, dy = o.dy || 0, dz = o.dz || 0, hard = o.hard ?? 1, tough = o.tough ?? 1;
  const only = o.only;   // { kind: true }: hit only bodies of these kinds (street props, say) and leave the rest standing
  const R = r * 1.7;
  const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(WX - 1, Math.floor(cx + R));
  const y0 = Math.max(0, Math.floor(cy - R / ys)), y1 = Math.min(WY - 1, Math.floor(cy + R / ys));
  const z0 = Math.max(0, Math.floor(cz - R)), z1 = Math.min(WZ - 1, Math.floor(cz + R));
  let n = 0;
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    let i = idx(x0, y, z);
    for (let x = x0; x <= x1; x++, i++) {
      const m = voxAt(i);
      if (!m) continue;
      if (only) { const b = bodies[ownerAt(i)]; if (!b || !only[b.kind]) continue; }
      const ex = x + 0.5 - cx, ey = (y + 0.5 - cy) * ys, ez = z + 0.5 - cz, re = r * SOFT[m] * (HARD[m] ? hard : 1);
      const d2 = ex * ex + ey * ey + ez * ez;
      if (d2 <= re * re && n < list.length && (d2 < re * re * 0.3 || Math.random() >= TOUGH[m] * tough)) list[n++] = i;
    }
  }
  if (o.pushDebris !== false) pushDebris(cx, cy, cz, r * 1.6, push * 0.9);
  if (!n) return 0;
  lastHit = [cx, cy, cz];
  const p = Math.min(1, maxDeb / (n * 0.8));
  const rc2 = r * core * r * core;
  let glassN = 0;
  const before = stats.destroyed;
  for (let k = 0; k < n; k++) {
    const i = list[k], x = (i & XM), z = ((i >> ZS) & ZM), y = (i >> YS);
    const ex = x + 0.5 - cx, ey = y + 0.5 - cy, ez = z + 0.5 - cz, d2 = ex * ex + ey * ey + ez * ez;
    const lvl = lvlOf(i), m0 = voxAt(i);
    if (m0 === M.CONC && cfg.rebar && lvl >= 1 && d2 > rc2 * 0.6 && Math.random() < 0.4) {
      // the concrete breaks away and the bars stay, still tying the pieces together
      const b = bodies[ownerAt(i)];
      if (b && !b.span0 && b.kind !== 'rubble') prime(b);
      if (b && b.kind !== 'rubble') { uncarry(b, i, y, M.CONC); pending.add(b.id); }
      setVox(i, M.REBAR);
      markDirty(x, z);
      if (Math.random() < p) { const d = Math.sqrt(d2) + 0.01, s = push * (0.45 + Math.random() * 0.75); spawnDebris(x + 0.5, y + 0.5, z + 0.5, ex / d * s + dx * push, ey / d * s + 5, ez / d * s + dz * push, M.CONC, lvl); }
      continue;
    }
    if (PANE[m0]) glassN++;
    const m = removeVoxel(i, x, y, z);
    if ((d2 > rc2 || n < 80) && Math.random() < p) {
      const d = Math.sqrt(d2) + 0.01, s = push * (0.45 + Math.random() * 0.75);
      spawnDebris(x + 0.5, y + 0.5, z + 0.5, ex / d * s + dx * push, ey / d * s + dy * push + 5 + Math.random() * 7, ez / d * s + dz * push, m, lvl);
    }
  }
  const real = stats.destroyed - before; // rubble that is hit again does not count a second time
  if (cfg.glass && glassN) {
    for (let k = 0; k < n; k++) {
      const i = list[k];
      for (let f = 0; f < 6; f++) { const j = i + NB[f]; if (j >= 0 && j < NV && PANE[voxAt(j)]) { const x = (j & XM), z = ((j >> ZS) & ZM), y = (j >> YS), ex = x - cx, ey = y - cy, ez = z - cz, d = Math.hypot(ex, ey, ez) + 0.01; shatterPane(j, ex / d, ey / d, ez / d); } }
    }
  }
  dust(cx, cy, cz, Math.min(16, 2 + (n >> 6)), r * 1.2);
  if (real) hooks.destroyed(real, cx, cy, cz);
  return n;
}

// A flat cut, the tail sweep: everything in a low slab is knocked out sideways, so what stands on it has to fall.
export function slice(cx, cy, cz, ax, az, half, depth, thick) {
  const bx = -az, bz = ax;
  const R = Math.max(half, depth) + 1;
  const x0 = Math.max(1, Math.floor(cx - R)), x1 = Math.min(WX - 2, Math.floor(cx + R)), z0 = Math.max(1, Math.floor(cz - R)), z1 = Math.min(WZ - 2, Math.floor(cz + R));
  const y0 = Math.max(0, Math.floor(cy - thick)), y1 = Math.min(WY - 1, Math.floor(cy + thick));
  let n = 0;
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const i = idx(x, y, z), m = voxAt(i);
    if (!m) continue;
    const ex = x + 0.5 - cx, ez = z + 0.5 - cz, u = ex * ax + ez * az, v = ex * bx + ez * bz;
    if (Math.abs(u) > half || Math.abs(v) > depth) continue;
    if (HARD[m] && Math.random() < 0.25) continue;
    const lvl = lvlOf(i);
    removeVoxel(i, x, y, z); n++;
    if (Math.random() < Math.min(1, 700 * cfg.debrisMul / (half * depth * 2))) spawnDebris(x + 0.5, y + 0.5, z + 0.5, ax * (18 + Math.random() * 18), 4 + Math.random() * 8, az * (18 + Math.random() * 18), m, lvl);
  }
  lastHit = [cx - ax * half, cy, cz - az * half];
  if (n) { dust(cx, cy, cz, 10, half * 0.6); hooks.destroyed(n, cx, cy, cz); hooks.shake(0.3, cx, cy, cz); hooks.sound('crumble', 1, cx, cy, cz); }
  return n;
}

// Remove whole storeys of one body. Used by the topple and pancake tools.
export function cutBody(b, ya, yb, mode, hx = 0, hz = 0) {
  let n = 0, sx = 0, sz = 0;
  for (let y = ya; y <= yb; y++) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) {
    const i = idx(x, y, z);
    if (!voxAt(i) || ownerAt(i) !== b.id) continue;
    const m = removeVoxel(i, x, y, z); n++; sx += x; sz += z;
    if (Math.random() < Math.min(1, 320 * cfg.debrisMul / Math.max(1, b.layers0[y] * (yb - ya + 1)))) spawnDebris(x + 0.5, y + 0.5, z + 0.5, (Math.random() - 0.5) * 22 - hx * 8, Math.random() * 5, (Math.random() - 0.5) * 22 - hz * 8, m, b.level);
  }
  if (!n) return 0;
  const cx = (b.x0 + b.x1 + 1) / 2, cz = (b.z0 + b.z1 + 1) / 2;
  b.nextMode = { mode, hx, hz };
  lastHit = [cx + hx * 40, ya, cz + hz * 40];
  dust(cx, ya + 1, cz, 14, (b.x1 - b.x0) * 0.6);
  hooks.destroyed(n, cx, ya, cz, true); hooks.shake(0.35, cx, ya, cz); hooks.sound(mode === 'drop' ? 'collapse' : 'creak', 1, cx, ya, cz);
  return n;
}

export function explode(x, y, z, r, shake = 0.5, o = {}) {
  blast(x, y, z, r, { push: 40, core: 0.55, maxDebris: o.maxDebris ?? 460, tough: 0.4 });
  pushDebris(x, y, z, r * 2.4, 48, 0.8);
  fire(x, y + 2, z, 60, r); sparks(x, y + 2, z, 36, 1, 0.8, 0.3);
  dust(x, y + 2, z, 18, r * 1.8, 0.25, 0.23, 0.22);
  smoke(x, y + 4, z, 14, r * 0.6);
  flash(x, y + 4, z, r); ring(x, 0.5, z, r * 3.2, 0xfff0d0, 0.5);
  if (cfg.glass) blowGlass(x, y, z, r * 3.4, 90);
  if (cfg.expFire && cfg.fireSpread && o.fire !== false) igniteAt(x, y, z, r * 1.25, 0.3);
  hooks.scorch(x, z, r * 1.5); hooks.shake(shake, x, y, z); hooks.sound('boom', 1, x, y, z);
  hooks.impact(o.impact ?? 0.7);
  hooks.explosion(x, y, z, r);
}

// Queue every pane within reach to burst as the pressure front passes.
export function blowGlass(cx, cy, cz, R, speed = 120) {
  const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(WX - 1, Math.floor(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(WY - 1, Math.floor(cy + R)), z0 = Math.max(0, Math.floor(cz - R)), z1 = Math.min(WZ - 1, Math.floor(cz + R));
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    let i = idx(x0, y, z);
    for (let x = x0; x <= x1; x++, i++) {
      if (!PANE[voxAt(i)]) continue;
      const ex = x + 0.5 - cx, ey = y + 0.5 - cy, ez = z + 0.5 - cz, d = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (d <= R) glassQ.push([i, d / speed + Math.random() * 0.05, ex / (d + 0.01), ey / (d + 0.01), ez / (d + 0.01)]);
    }
  }
  glassQ.sort((a, b) => b[1] - a[1]);
}
export function shockwave(x, y, z, R) {
  ring(x, 0.6, z, R, 0xffffff, 0.75); ring(x, 0.6, z, R * 0.7, 0xbfe8ff, 0.6);
  if (cfg.glass) blowGlass(x, y, z, R, 120);
  else {
    // demo behaviour: glass simply goes
    eachVoxel((i, m) => { if (!PANE[m]) return; const gx = i & XM, gz = (i >> ZS) & ZM, gy = i >> YS; if (Math.hypot(gx - x, gy - y, gz - z) <= R) removeVoxel(i, gx, gy, gz); });
  }
  pushDebris(x, y, z, R * 0.6, 26, 0.6);
  dust(x, 2, z, 12, 20);
  hooks.shake(0.4, x, y, z); hooks.sound('roar', 1, x, y, z);
}

// ---- fire ----------------------------------------------------------------
const BURN_K = 1.6;   // how much longer than its material's own time a voxel stays alight: more of a fire is burning at once
const FN = [[1, 0, 0, 1], [-1, 0, 0, 1], [0, 0, 1, 1], [0, 0, -1, 1], [0, 1, 0, 2.6], [0, -1, 0, 0.3], [1, 1, 0, 1], [-1, 1, 0, 1], [0, 1, 1, 1], [0, 1, -1, 1]];
const newFire = [];
export const fireInfo = { n: 0, x: 0, y: 0, z: 0 };
export function ignite(i) {
  const m = voxAt(i);
  if (!m || FLAM[m] <= 0 || burnAt(i) || burnT.size >= cfg.burnCap) return false;
  setBurn(i, 1); burnT.set(i, BURN[m] * BURN_K * (0.7 + Math.random() * 0.6));
  const x = (i & XM), z = ((i >> ZS) & ZM), y = (i >> YS);
  for (let f = 0; f < 6; f++) { const k = i + NB[f]; if (k >= 0 && k < NV && voxAt(k)) setSoot(k, Math.min(255, sootAt(k) + 70)); }
  markLazy(x, z);
  return true;
}
export function igniteAt(cx, cy, cz, r, chance = 1) {
  let n = 0;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(WX - 1, Math.floor(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(WY - 1, Math.floor(cy + r)), z0 = Math.max(0, Math.floor(cz - r)), z1 = Math.min(WZ - 1, Math.floor(cz + r));
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const ex = x + 0.5 - cx, ey = y + 0.5 - cy, ez = z + 0.5 - cz;
    if (ex * ex + ey * ey + ez * ez > r * r) continue;
    const i = idx(x, y, z);
    if (voxAt(i) && !FLAM[voxAt(i)]) setSoot(i, Math.min(255, sootAt(i) + 110)), markLazy(x, z);
    if (Math.random() < chance && ignite(i)) n++;
  }
  return n;
}
let fireAcc = 0, crackleT = 0;
function stepFire(dt) {
  fireAcc += dt;
  const h = 0.125;
  if (fireAcc < h) return;
  fireAcc -= h; if (fireAcc > h) fireAcc = 0;
  const size = burnT.size;
  stats.burning = size; fireInfo.n = size;
  if (!size) return;
  const pe = Math.min(1, 90 / size) * (cfg.dust > 0 ? 1 : 0.5);
  const pTongue = Math.min(0.5, 16 / size), pPlume = Math.min(5, size / 220) / size;
  let sx = 0, sy = 0, sz = 0, emb = -1;
  for (const [i, t] of burnT) {
    const m = voxAt(i);
    if (!m) { burnT.delete(i); setBurn(i, 0); continue; }
    const x = (i & XM), z = ((i >> ZS) & ZM), y = (i >> YS);
    sx += x; sy += y; sz += z;
    if (Math.random() < pe) { flame(x + 0.5, y + 0.5, z + 0.5); if (Math.random() < 0.3) smoke(x + 0.5, y + 2.5, z + 0.5, 1, 1); }
    if (Math.random() < 0.002) emb = i;
    const open = !voxAt(i + SXZ);
    // tongues of flame stand up off whatever is burning in the open, and a big fire sends up a dark column
    if (open && Math.random() < pTongue) fireP.spawn(x + 0.5, y + 1.2, z + 0.5, wind.x * 1.6 + (Math.random() - 0.5) * 2.5, 9 + Math.random() * 9, wind.z * 1.6 + (Math.random() - 0.5) * 2.5, 3.2 + Math.random() * 3.4, 0.5 + Math.random() * 0.45, 1.0, 0.28 + Math.random() * 0.34, 0.05, 0.6, -0.6, 4, 1.1);
    if (Math.random() < pPlume) { const d = 0.07 + Math.random() * 0.06; dustP.spawn(x + 0.5, y + 3, z + 0.5, wind.x * 4 + (Math.random() - 0.5) * 2, 9 + Math.random() * 6, wind.z * 4 + (Math.random() - 0.5) * 2, 9 + Math.random() * 8, cfg.linger ? 6 + Math.random() * 4 : 3, d, d * 0.95, d * 0.9, 0.5, 2.2, 1.2, 0.5); }
    // heat rises: the fire can take hold of the first thing above it across an open gap (the next floor), or blacken it
    if (cfg.fireSpread && open && Math.random() < 0.09) {
      for (let k = i + SXZ * 2, yy = y + 2; yy < WY && yy <= y + 14; yy++, k += SXZ) {
        const um = voxAt(k);
        if (!um) continue;
        if (FLAM[um] > 0) { if (!burnAt(k) && Math.random() < 0.5) newFire.push(k); }
        else if (sootAt(k) < 200) { setSoot(k, sootAt(k) + 28); markLazy(x, z); }
        break;
      }
    }
    if (cfg.fireSpread) for (let f = 0; f < FN.length; f++) {
      const F = FN[f], nx = x + F[0], ny = y + F[1], nz = z + F[2];
      if (nx < 0 || ny < 0 || nz < 0 || nx >= WX || ny >= WY || nz >= WZ) continue;
      const k = idx(nx, ny, nz), nm = voxAt(k);
      if (!nm || burnAt(k)) continue;
      if (nm === M.FUEL) { if (Math.random() < h * 1.0) removeVoxel(k, nx, ny, nz); continue; }
      if (PANE[nm]) { if (Math.random() < h * 0.1) glassQ.push([k, 0, 0, 0.2, 0]); continue; }
      if (FLAM[nm] > 0 && Math.random() < FLAM[nm] * h * 1.5 * F[3]) newFire.push(k);
    }
    const left = t - h;
    if (left > 0) { burnT.set(i, left); continue; }
    burnT.delete(i); setBurn(i, 0);
    const b = bodies[ownerAt(i)];
    if (Math.random() < CHARP[m]) {
      // burnt through: still there, but it carries nothing, so the storey rule can finish the job
      if (b && !b.span0 && b.kind !== 'rubble') prime(b);
      if (b && b.kind !== 'rubble') { uncarry(b, i, y, m); pending.add(b.id); }
      setVox(i, M.CHAR); setSoot(i, 0);
      markLazy(x, z);
    } else { removeVoxel(i, x, y, z); if (Math.random() < 0.15) spawnDebris(x + 0.5, y + 0.5, z + 0.5, (Math.random() - 0.5) * 5, 1, (Math.random() - 0.5) * 5, M.CHAR, b ? b.level : 1, 0.7); }
  }
  for (let k = 0; k < newFire.length; k++) ignite(newFire[k]);
  newFire.length = 0;
  fireInfo.x = sx / size + 0.5; fireInfo.y = sy / size + 4; fireInfo.z = sz / size + 0.5;
  // embers ride the wind and can start a new fire across the street
  if (emb >= 0 && cfg.fireSpread) {
    const x = (emb & XM), z = ((emb >> ZS) & ZM), y = (emb >> YS);
    for (let s = 0; s < 6; s++) fireP.spawn(x + 0.5, y + 1, z + 0.5, wind.x * (11 + Math.random() * 14) + (Math.random() - 0.5) * 7, 9 + Math.random() * 10, wind.z * (11 + Math.random() * 14) + (Math.random() - 0.5) * 7, 1.0, 1.6 + Math.random(), 1, 0.6, 0.15, 1, 0, -11, 0.4);
    const d = 14 + Math.random() * 24, tx = Math.floor(x + wind.x * d + (Math.random() - 0.5) * 12), tz = Math.floor(z + wind.z * d + (Math.random() - 0.5) * 12);
    if (tx > 0 && tz > 0 && tx < WX - 1 && tz < WZ - 1) for (let ty = Math.min(WY - 1, y + 12); ty >= 0; ty--) { const k = idx(tx, ty, tz); if (voxAt(k)) { if (Math.random() < 0.7) ignite(k); break; } }
  }
  crackleT -= h;
  if (crackleT <= 0) { crackleT = 0.18 + Math.random() * 0.25; hooks.sound('crackle', Math.min(1, 0.3 + size / 1800), fireInfo.x, fireInfo.y, fireInfo.z); }
}

// ---- flashes and shock rings ---------------------------------------------
const flashes = [], rings = [];
let flashGeo, ringGeo;
export function flash(x, y, z, r) {
  const m = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.25, 0.5), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.set(x, y, z); m.userData = { t: 0, r };
  scene.add(m); flashes.push(m);
}
export function ring(x, y, z, r, color = 0xffffff, dur = 0.55, tilt = null) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(x, y, z);
  if (tilt) m.quaternion.copy(tilt); else m.rotation.x = -Math.PI / 2;
  m.userData = { t: 0, r, dur };
  scene.add(m); rings.push(m);
}
function updateFx(dt) {
  for (let i = flashes.length - 1; i >= 0; i--) {
    const m = flashes[i], u = m.userData; u.t += dt;
    const k = u.t / 0.28; m.scale.setScalar(u.r * (0.4 + k * 1.2)); m.material.opacity = 0.9 * (1 - k);
    if (k >= 1) { scene.remove(m); m.material.dispose(); flashes.splice(i, 1); }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const m = rings[i], u = m.userData; u.t += dt;
    const k = u.t / u.dur, e = 1 - (1 - k) * (1 - k); m.scale.setScalar(Math.max(0.01, u.r * e)); m.material.opacity = 0.8 * (1 - k);
    if (k >= 1) { scene.remove(m); m.material.dispose(); rings.splice(i, 1); }
  }
}

// Something heavy comes down on the street: dust rolls out along the ground, loose wreckage is thrown outward and
// whatever small stands there (cars, trees, lamp posts) is flattened. k is 0..1. The ground itself is left whole.
const PUNCH_MAX = 11, SLAM_ONLY = { prop: true, tree: true };
const SOFT_KIND = { prop: true, tree: true, rubble: true };   // what a falling piece runs down without being stopped
// the cells that falling pieces fill this step, so that they can strike one another (open addressing, stamped by step)
const OCC_BITS = 19, OCC_SHIFT = 32 - OCC_BITS, OCC_MASK = (1 << OCC_BITS) - 1;
const occKey = new Int32Array(1 << OCC_BITS), occStamp = new Int32Array(1 << OCC_BITS), occWho = new Int16Array(1 << OCC_BITS);
const frameSecs = [];
const NP = 8, punchAt = new Float32Array(NP * 3);
function slam(x, z, k) {
  const reach = 9 + k * 22;
  dustWave(x, 0.5, z, 16 + k * 46, reach, 0.7, 0.34);
  if (k > 0.4) dustWave(x, 1.5, z, 14, reach * 0.5, 1.7, 0.36);
  pushDebris(x, 1, z, reach * 0.8, 9 + k * 22, 0.6);
  const keep = lastHit;
  blast(x, 2, z, 2.5 + k * 6, { only: SLAM_ONLY, pushDebris: false, maxDebris: 40, push: 14 });
  lastHit = keep;
  hooks.shake(0.15 + k * 0.45, x, 1, z);
}

// ---- falling sections ----------------------------------------------------
// free: tumbles as in the demo. hinge: pivots over its base edge like a felled tree. drop: comes straight down, floor onto floor.
const sections = [];
let boxGeo, secMat;
class Section {
  constructor(cells, n, hit, mode, lvl, hx, hz) {
    this.n = n; this.alive = n; this.n0 = n; this.mode = mode; this.lvl = lvl; this.gen = 0;
    this.off = new Float32Array(n * 3); this.mat = new Uint8Array(n); this.live = new Uint8Array(n).fill(1);
    this.hot = new Uint8Array(n); this.nHot = 0;   // voxels that were alight when the piece broke away
    this.lean = 0; this.onTop = 0; this.cool = 0;
    if (!cells) return;   // a piece of another section: Section.piece fills it in
    let sx = 0, sy = 0, sz = 0, minY = 1e9, maxY = 0;
    for (let k = 0; k < n; k++) { const i = cells[k]; const x = (i & XM), z = ((i >> ZS) & ZM), y = (i >> YS); sx += x; sy += y; sz += z; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    const cx = sx / n + 0.5, cy = sy / n + 0.5, cz = sz / n + 0.5;
    this.mesh = new THREE.InstancedMesh(boxGeo, secMat, n);
    this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    this.col = new Float32Array(n * 3);
    let ext = 0;
    for (let k = 0; k < n; k++) {
      const i = cells[k]; const x = (i & XM), z = ((i >> ZS) & ZM), y = (i >> YS), m = voxAt(i);
      this.off[k * 3] = x + 0.5 - cx; this.off[k * 3 + 1] = y + 0.5 - cy; this.off[k * 3 + 2] = z + 0.5 - cz; this.mat[k] = m;
      _m.makeTranslation(this.off[k * 3], this.off[k * 3 + 1], this.off[k * 3 + 2]); this.mesh.setMatrixAt(k, _m);
      const j = jitter(x, y, z) * (1 - sootAt(i) / 255 * 0.78); _c.setRGB(MAT_R[m] * j, MAT_G[m] * j, MAT_B[m] * j); this.mesh.setColorAt(k, _c);
      this.col[k * 3] = _c.r; this.col[k * 3 + 1] = _c.g; this.col[k * 3 + 2] = _c.b;
      if (burnAt(i)) { this.hot[k] = 1; this.nHot++; }
      if (y - minY < 6) { const e = this.off[k * 3] * hx + this.off[k * 3 + 2] * hz; if (e > ext) ext = e; }
    }
    this.pos = new THREE.Vector3(cx, cy, cz); this.vel = new THREE.Vector3(0, 0, 0); this.q = new THREE.Quaternion(); this.w = new THREE.Vector3();
    this.height = maxY - minY + 1;
    if (mode === 'hinge') {
      this.axis = new THREE.Vector3(hz, 0, -hx);
      this.pivot = new THREE.Vector3(cx + hx * (ext + 0.5), Math.max(0, minY - 1), cz + hz * (ext + 0.5));
      this.c0 = new THREE.Vector3(cx, cy, cz);
      this.theta = 0; this.omega = 0.38; this.k = 1.5 * G / Math.max(16, this.height);
      this.slow = 0;
      // a tall piece often snaps part way over, and the halves come down apart
      this.snapAt = this.height > 36 && Math.random() < 0.65 ? 0.4 + Math.random() * 0.45 : 9;
    } else if (mode === 'drop') {
      if (hx || hz) this.w.set(hz * 0.1, 0, -hx * 0.1);   // a pancake that leans toward its weak side
    } else if (mode === 'free') {
      let tx = hit[0] - cx, tz = hit[2] - cz; const hl = Math.hypot(tx, tz);
      if (hl > 0.5) { tx /= hl; tz /= hl; const rate = 0.25 + Math.random() * 0.45; this.w.set(tz * rate, (Math.random() - 0.5) * 0.2, -tx * rate); this.vel.set(tx * 3, 0, tz * 3); }
    }
    this.age = 0; this.stuck = 0; this.pd = Math.min(0.9, 1000 * cfg.debrisMul / n); this.puff = 0;
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
  }
  // Break into two to four pieces that carry on by themselves. `along` 1 cuts across the piece's long side (a tower snapping).
  split(along) {
    const e = _m.makeRotationFromQuaternion(this.q).elements.slice(), off = this.off, n = this.n, live = this.live;
    let lx = 0, ly = 0, lz = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let k = 0; k < n; k++) {
      if (!live[k]) continue;
      const ox = off[k * 3], oy = off[k * 3 + 1], oz = off[k * 3 + 2];
      lx += ox; ly += oy; lz += oz;
      if (ox < x0) x0 = ox; if (ox > x1) x1 = ox; if (oy < y0) y0 = oy; if (oy > y1) y1 = oy; if (oz < z0) z0 = oz; if (oz > z1) z1 = oz;
    }
    lx /= this.alive; ly /= this.alive; lz /= this.alive;
    const ex = x1 - x0, ey = y1 - y0, ez = z1 - z0;
    // first cut across the longest side, a little off square; a big piece is cut a second time
    let ax = (Math.random() - 0.5) * 0.7, ay = (Math.random() - 0.5) * 0.7, az = (Math.random() - 0.5) * 0.7;
    if (ey >= ex && ey >= ez) ay = 1; else if (ex >= ez) ax = 1; else az = 1;
    if (!along) { ax += (Math.random() - 0.5) * 0.9; ay += (Math.random() - 0.5) * 0.9; az += (Math.random() - 0.5) * 0.9; }
    const at = (Math.random() - 0.5) * 0.3 * Math.max(ex, ey, ez);
    const two = this.alive > 1400;
    const bx = Math.random() - 0.5, by = (Math.random() - 0.5) * 0.6, bz = Math.random() - 0.5;
    const grp = new Uint8Array(n), cnt = [0, 0, 0, 0];
    for (let k = 0; k < n; k++) {
      if (!live[k]) continue;
      const ox = off[k * 3] - lx, oy = off[k * 3 + 1] - ly, oz = off[k * 3 + 2] - lz;
      let g = ox * ax + oy * ay + oz * az > at ? 1 : 0;
      if (two && ox * bx + oy * by + oz * bz > 0) g |= 2;
      grp[k] = g; cnt[g]++;
    }
    const hinge = this.mode === 'hinge';
    for (let g = 0; g < 4; g++) {
      const c = cnt[g];
      if (!c) continue;
      if (c < 30 || sections.length >= 30) {
        // crumbs: straight to debris
        for (let k = 0; k < n; k++) {
          if (!live[k] || grp[k] !== g || Math.random() > this.pd * 2) continue;
          const ox = off[k * 3], oy = off[k * 3 + 1], oz = off[k * 3 + 2];
          hotNext = this.hot[k];
          spawnDebris(this.pos.x + e[0] * ox + e[4] * oy + e[8] * oz, Math.max(0.5, this.pos.y + e[1] * ox + e[5] * oy + e[9] * oz), this.pos.z + e[2] * ox + e[6] * oy + e[10] * oz, this.vel.x + (Math.random() - 0.5) * 10, this.vel.y * 0.3 + Math.random() * 5, this.vel.z + (Math.random() - 0.5) * 10, this.mat[k], this.lvl);
        }
        continue;
      }
      const s = new Section(null, c, null, 'free', this.lvl, 0, 0);
      s.gen = this.gen + 1; s.col = new Float32Array(c * 3); s.bodyId = this.bodyId;
      let gx = 0, gy = 0, gz = 0, j = 0;
      for (let k = 0; k < n; k++) if (live[k] && grp[k] === g) { gx += off[k * 3]; gy += off[k * 3 + 1]; gz += off[k * 3 + 2]; }
      gx /= c; gy /= c; gz /= c;
      s.mesh = new THREE.InstancedMesh(boxGeo, secMat, c);
      s.mesh.castShadow = this.mesh.castShadow; s.mesh.frustumCulled = false;
      let my0 = 1e9, my1 = -1e9;
      for (let k = 0; k < n; k++) {
        if (!live[k] || grp[k] !== g) continue;
        const ox = off[k * 3] - gx, oy = off[k * 3 + 1] - gy, oz = off[k * 3 + 2] - gz;
        s.off[j * 3] = ox; s.off[j * 3 + 1] = oy; s.off[j * 3 + 2] = oz; s.mat[j] = this.mat[k];
        if (this.hot[k]) { s.hot[j] = 1; s.nHot++; }
        s.col[j * 3] = this.col[k * 3]; s.col[j * 3 + 1] = this.col[k * 3 + 1]; s.col[j * 3 + 2] = this.col[k * 3 + 2];
        _m.makeTranslation(ox, oy, oz); s.mesh.setMatrixAt(j, _m); s.mesh.setColorAt(j, _c.setRGB(s.col[j * 3], s.col[j * 3 + 1], s.col[j * 3 + 2]));
        const wy = e[1] * ox + e[5] * oy + e[9] * oz; if (wy < my0) my0 = wy; if (wy > my1) my1 = wy;
        j++;
      }
      // where the piece is, and how that point of the parent was moving
      const rx = e[0] * gx + e[4] * gy + e[8] * gz, ry = e[1] * gx + e[5] * gy + e[9] * gz, rz = e[2] * gx + e[6] * gy + e[10] * gz;
      s.pos = new THREE.Vector3(this.pos.x + rx, this.pos.y + ry, this.pos.z + rz);
      s.q = this.q.clone(); s.w = this.w.clone(); s.vel = this.vel.clone();
      const px = hinge ? s.pos.x - this.pivot.x : rx, py = hinge ? s.pos.y - this.pivot.y : ry, pz = hinge ? s.pos.z - this.pivot.z : rz;
      s.vel.x += this.w.y * pz - this.w.z * py; s.vel.y += this.w.z * px - this.w.x * pz; s.vel.z += this.w.x * py - this.w.y * px;
      // the pieces push apart a little and each picks up its own spin
      const rl = Math.hypot(rx, rz) + 0.01, kick = 2 + Math.random() * 4;
      s.vel.x += rx / rl * kick; s.vel.z += rz / rl * kick;
      s.w.x += (Math.random() - 0.5) * 0.9; s.w.y += (Math.random() - 0.5) * 0.4; s.w.z += (Math.random() - 0.5) * 0.9;
      s.height = my1 - my0 + 1; s.age = 0; s.stuck = 0; s.puff = 0; s.pd = Math.min(0.9, 1000 * cfg.debrisMul / c);
      s.mesh.position.copy(s.pos); s.mesh.quaternion.copy(s.q);
      scene.add(s.mesh); sections.push(s);
    }
    dust(this.pos.x, Math.max(1, this.pos.y), this.pos.z, 6, Math.max(6, Math.min(ex, ez) * 0.5));
    if (this.nHot > 8) sparks(this.pos.x, Math.max(1, this.pos.y), this.pos.z, Math.min(40, 8 + (this.nHot >> 3)), 1, 0.6, 0.2, 20);
    hooks.sound('crumble', 0.8, this.pos.x, this.pos.y, this.pos.z);
    scene.remove(this.mesh); this.mesh.dispose();
  }
  update(dt) {
    this.age += dt;
    const hinge = this.mode === 'hinge', drop = this.mode === 'drop';
    const th0 = this.theta, p0x = this.pos.x, p0y = this.pos.y, p0z = this.pos.z;
    if (hinge) {
      this.omega += this.k * Math.sin(Math.max(0.1, this.theta)) * dt; this.theta += this.omega * dt;
      this.q.setFromAxisAngle(this.axis, this.theta);
      _p.copy(this.c0).sub(this.pivot).applyQuaternion(this.q); this.pos.copy(this.pivot).add(_p);
      this.w.copy(this.axis).multiplyScalar(this.omega);
    } else {
      this.vel.y -= G * dt;
      if (drop && this.vel.y < -30) this.vel.y = -30;
      this.pos.addScaledVector(this.vel, dt);
      const wl = this.w.length();
      if (wl > 1e-4) { _q.setFromAxisAngle(_p.copy(this.w).multiplyScalar(1 / wl), wl * dt); this.q.premultiply(_q).normalize(); }
    }
    _m.makeRotationFromQuaternion(this.q);
    const e = _m.elements, px = this.pos.x, py = this.pos.y, pz = this.pos.z, off = this.off;
    const before = this.alive;
    if (this.nHot) for (let t = 0; t < 4; t++) {
      // a piece that was burning keeps burning on the way down
      const k = (Math.random() * this.n) | 0;
      if (!this.hot[k] || !this.live[k]) continue;
      const ox = off[k * 3], oy = off[k * 3 + 1], oz = off[k * 3 + 2];
      flame(px + e[0] * ox + e[4] * oy + e[8] * oz, py + e[1] * ox + e[5] * oy + e[9] * oz, pz + e[2] * ox + e[6] * oy + e[10] * oz);
    }
    // Collisions. Each voxel of the piece is tried against the ground, against what still stands and against the other
    // falling pieces (a table of the cells they fill, rebuilt every step). Where it strikes hard, both sides crumble; a
    // voxel that survives the knock blocks, and a blocked piece is put back where it was and pushed off what it met.
    // A pancake (drop) is the exception: it crushes its way straight down as before.
    let contacts = 0, crushed = 0, cx = 0, cy = 0, cz = 0;
    let wHits = 0, hx = 0, hy = 0, hz = 0, gHits = 0, gx0 = 0, gz0 = 0;   // what was struck: standing voxels, and the ground
    let gBlock = 0, oBlock = 0, sBlock = 0, bx = 0, by = 0, bz = 0, other = null, oN = 0;
    this.cool = (this.cool || 0) - dt;
    const me = frameSecs.length; frameSecs.push(this);
    const speed = hinge ? this.omega * this.height * 0.6 : this.vel.length(), crushP = Math.min(hinge || drop ? 0.6 : 0.42, 0.08 + speed * 0.009);
    const dieP = drop ? 1 : Math.min(0.62, Math.max(0, speed - 4) * 0.022);   // how likely a voxel of the piece is to break where it strikes
    const wx0 = this.w.x, wy0 = this.w.y, wz0 = this.w.z, pvx = hinge ? this.pivot.x : px, pvy = hinge ? this.pivot.y : py, pvz = hinge ? this.pivot.z : pz;
    for (let k = 0; k < this.n; k++) {
      if (!this.live[k]) continue;
      const ox = off[k * 3], oy = off[k * 3 + 1], oz = off[k * 3 + 2];
      const wx = px + e[0] * ox + e[4] * oy + e[8] * oz, wy = py + e[1] * ox + e[5] * oy + e[9] * oz, wz = pz + e[2] * ox + e[6] * oy + e[10] * oz;
      let hit = 0;   // 1 the ground, 2 something standing, 3 another falling piece
      if (wy < 0.5) { hit = 1; gHits++; gx0 += wx; gz0 += wz; }
      else {
        const gx = Math.floor(wx), gy = Math.floor(wy), gz = Math.floor(wz);
        if (gx >= 0 && gz >= 0 && gx < WX && gz < WZ && gy < WY) {
          const gi = idx(gx, gy, gz);
          if (voxAt(gi)) {
            const ob = bodies[ownerAt(gi)], soft = !ob || SOFT_KIND[ob.kind];
            hit = soft ? 0 : ob.id === this.bodyId ? 4 : 2;   // 4: the building it came off
            if (!soft) {
              // keep a few of the places it struck, spread over the whole contact, for the blows it lands there
              const j = wHits < NP ? wHits : Math.random() * (wHits + 1) < NP ? (Math.random() * NP) | 0 : -1;
              if (j >= 0) { punchAt[j * 3] = wx; punchAt[j * 3 + 1] = wy; punchAt[j * 3 + 2] = wz; }
              wHits++; hx += wx; hy += wy; hz += wz;
            }
            if (soft || Math.random() < crushP) {
              // small things (posts, trees, cars, loose rubble) are simply run down
              const lv = lvlOf(gi), m = removeVoxel(gi, gx, gy, gz); crushed++;
              if (Math.random() < 0.3) spawnDebris(gx + 0.5, gy + 0.5, gz + 0.5, (Math.random() - 0.5) * 14, 4 + Math.random() * 5, (Math.random() - 0.5) * 14, m, lv);
            }
          } else if (!drop) {
            // the table of cells taken by falling pieces this step
            let h = (Math.imul(gi, 0x9E3779B1) >>> OCC_SHIFT), o = -1;
            for (let t = 0; t < 6; t++, h = (h + 1) & OCC_MASK) {
              if (occStamp[h] !== simStep) { occStamp[h] = simStep; occKey[h] = gi; occWho[h] = me; break; }
              if (occKey[h] === gi) { o = occWho[h]; break; }
            }
            if (o >= 0 && o !== me) { const s2 = frameSecs[o]; if (s2.alive > before * 0.25) { hit = 3; if (s2 !== other) { other = s2; oN = 0; } oN++; } }
          }
        }
      }
      if (!hit) continue;
      cx += wx; cy += wy; cz += wz;
      // a toppling piece grinds its heel into the ground and into its own stump, as it always did
      if (Math.random() < dieP || (hinge && (hit === 1 || hit === 4))) {
        contacts++;
        this.live[k] = 0; this.alive--; this.mesh.setMatrixAt(k, ZERO);
        if (Math.random() < this.pd) {
          const rx = wx - pvx, ry = wy - pvy, rz = wz - pvz;
          const vx = this.vel.x + wy0 * rz - wz0 * ry, vy = this.vel.y + wz0 * rx - wx0 * rz, vz = this.vel.z + wx0 * ry - wy0 * rx;
          hotNext = this.hot[k];
          spawnDebris(wx, Math.max(0.5, wy), wz, vx * 0.5 + (Math.random() - 0.5) * 12, Math.abs(vy) * 0.22 + Math.random() * 7, vz * 0.5 + (Math.random() - 0.5) * 12, this.mat[k], this.lvl);
        }
      } else if (hit === 1) gBlock++;
      else { oBlock++; bx += wx; by += wy; bz += wz; if (hit === 4) sBlock++; }
    }
    const hits = contacts + gBlock + oBlock;
    if (hits) {
      if (contacts) this.mesh.instanceMatrix.needsUpdate = true;
      const f = hits / before;
      cx /= hits; cy /= hits; cz /= hits;
      if (speed > 9 && this.cool <= 0) {
        const heft = 0.45 + 0.55 * Math.min(1, before / 2500);
        if (wHits >= 8) {
          // it punches into what it lands on: enough of that and the neighbour starts to go as well
          // (a wide contact lands several blows across it, a small one a single blow)
          const keep = lastHit, np = Math.min(NP, 1 + (wHits >> 5)), o = { push: Math.min(24, speed * 0.5), maxDebris: 50 / np, tough: 0.5, hard: 1.3, pushDebris: false };
          const r = Math.min(PUNCH_MAX, 1.6 + Math.sqrt(wHits / np) * 1.0 * Math.min(1.4, speed / 22) * heft);
          if (np === 1) blast(hx / wHits, hy / wHits, hz / wHits, r, o);
          else for (let j = 0; j < np; j++) blast(punchAt[j * 3], punchAt[j * 3 + 1], punchAt[j * 3 + 2], r, o);
          lastHit = keep; this.cool = 0.1;
        }
        if (gHits >= 20 && before > 300) { slam(gx0 / gHits, gz0 / gHits, Math.min(1, gHits / 220) * Math.min(1, speed / 28) * heft); this.cool = 0.22; }
      }
      // a hard knock breaks the piece up, and the parts tumble on by themselves
      if (!drop && this.gen < 2 && this.alive > 260 && speed > 11 && hits > Math.max(5, before * 0.012) && sections.length < 27) {
        if (crushed) hooks.destroyed(crushed, cx, cy, cz, true);
        hooks.shake(Math.min(0.5, this.alive / 9000), cx, cy, cz);
        if (gBlock + oBlock) { this.pos.set(p0x, p0y, p0z); if (hinge) { this.theta = th0; this.q.setFromAxisAngle(this.axis, th0); } }
        this.split(0); return false;
      }
      const blocked = gBlock + oBlock;
      if (hinge) {
        if (oBlock >= Math.max(4, before * 0.002)) {
          // a toppling piece that meets something solid is stopped there: it leans, and only goes on if that gives way
          this.theta = th0; this.omega *= -0.12; this.leaning = true;
          this.q.setFromAxisAngle(this.axis, th0); _p.copy(this.c0).sub(this.pivot).applyQuaternion(this.q); this.pos.copy(this.pivot).add(_p);
        } else this.omega *= 1 - Math.min(0.3, f * 1.5);
      } else if (!drop) {
        if (blocked) {
          // away from what was met: straight up off the ground, and from the point of contact toward the piece's middle
          let nx = 0, ny = gBlock, nz = 0;
          if (oBlock) { const ax = px - bx / oBlock, ay = py - by / oBlock, az = pz - bz / oBlock, al = Math.hypot(ax, ay, az) + 1e-6; nx += ax / al * oBlock; ny += ay / al * oBlock; nz += az / al * oBlock; }
          const nl = Math.hypot(nx, ny, nz) + 1e-6; nx /= nl; ny /= nl; nz /= nl;
          this.pos.set(p0x + nx * 0.12, p0y + ny * 0.12, p0z + nz * 0.12);
          const vn = this.vel.x * nx + this.vel.y * ny + this.vel.z * nz;
          if (vn < 0) {
            // where it touches pushes back, so a piece that comes down on an edge or a corner goes over
            const rx = cx - px, ry = cy - py, rz = cz - pz, J = -vn * 1.6 / Math.max(40, this.height * this.height * 0.5);
            this.w.x += (ry * nz - rz * ny) * J; this.w.y += (rz * nx - rx * nz) * J; this.w.z += (rx * ny - ry * nx) * J;
            this.vel.x -= 1.12 * vn * nx; this.vel.y -= 1.12 * vn * ny; this.vel.z -= 1.12 * vn * nz;
            // another falling piece takes its share of the knock
            if (other && oN > 3 && other.mode === 'free') { const sh = Math.min(1, before / other.alive) * 0.5 * vn; other.vel.x += sh * nx; other.vel.y += sh * ny; other.vel.z += sh * nz; }
          }
          this.vel.multiplyScalar(0.9); this.w.multiplyScalar(0.9);
          const wl = this.w.length(); if (wl > 2.6) this.w.multiplyScalar(2.6 / wl);
        } else {
          this.vel.multiplyScalar(Math.max(0.3, 1 - f * 3.5)); this.w.multiplyScalar(0.96);
        }
      }
      if (speed > 8) {
        const power = Math.min(1, hits / 200) * Math.min(1, speed / 36);
        this.puff -= dt;
        if (drop) { if (this.puff <= 0) { this.puff = 0.07; const a = Math.random() * 6.283; dust(cx + Math.cos(a) * 12, cy + 0.5, cz + Math.sin(a) * 12, 3, 10); dust(cx, cy + 0.5, cz, 2, 18); } }
        else if (Math.random() < 0.5) dust(cx, cy + 0.5, cz, 1 + Math.round(power * 5), 6 + power * 8);
        hooks.shake(power * 0.35, cx, cy, cz); hooks.sound('crumble', 0.3 + power * 0.7, cx, cy, cz);
      }
      if (crushed) hooks.destroyed(crushed, cx, cy, cz, true);
      if (!hinge && !drop && speed < 6) { this.stuck += dt; if (sBlock > gBlock && sBlock * 2 > oBlock) this.onTop += dt; }
    }
    if (hinge) {
      if (Math.abs(this.omega) < 0.06 && this.theta > 0.25) this.slow += dt; else this.slow = 0;
      if (this.theta > this.snapAt && this.alive > 400 && sections.length < 27) { this.split(1); return false; }
      // held up against a neighbour for a while: it breaks where it leans and comes down in pieces
      if (this.leaning) this.lean += dt;
      if (this.lean > 0.6) { if (this.gen < 2 && this.alive > 260 && sections.length < 27) this.split(1); else this.shatter(); return false; }
    }
    this.mesh.position.copy(this.pos); this.mesh.quaternion.copy(this.q);
    if (!hinge && !drop && this.stuck > 0.45 && this.onTop > 0.3 && this.alive > 500) {
      // a big piece that has come to rest on what is left of its own building does not sit there: it goes down through it, floor on floor
      this.mode = 'drop'; this.vel.set(0, -6, 0); this.w.multiplyScalar(0.1); this.stuck = 0;
      return true;
    }
    const done = hinge ? (this.theta > 1.5 || this.slow > 1.2) : (this.stuck > 0.45 || py < -20);
    if (this.alive < Math.max(8, this.n0 * 0.06) || done || this.age > 9) { this.shatter(); return false; }
    return true;
  }
  shatter() {
    _m.makeRotationFromQuaternion(this.q);
    const e = _m.elements, off = this.off, big = this.mode !== 'free';
    const p = Math.min(1, (big ? 1500 : this.alive > 1500 ? 900 : 400) * cfg.debrisMul / Math.max(1, this.alive));
    const wx0 = this.w.x, wy0 = this.w.y, wz0 = this.w.z;
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let k = 0; k < this.n; k++) {
      if (!this.live[k]) continue;
      const ox = off[k * 3], oy = off[k * 3 + 1], oz = off[k * 3 + 2];
      const wx = this.pos.x + e[0] * ox + e[4] * oy + e[8] * oz, wy = this.pos.y + e[1] * ox + e[5] * oy + e[9] * oz, wz = this.pos.z + e[2] * ox + e[6] * oy + e[10] * oz;
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx; if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
      if (Math.random() < p) {
        let vx = this.vel.x, vy = this.vel.y * 0.3, vz = this.vel.z;
        if (this.mode === 'hinge') { const rx = wx - this.pivot.x, ry = wy - this.pivot.y, rz = wz - this.pivot.z; vx = (wy0 * rz - wz0 * ry) * 0.35; vy = 0; vz = (wx0 * ry - wy0 * rx) * 0.35; }
        hotNext = this.hot[k];
        spawnDebris(wx, Math.max(0.5, wy), wz, vx + (Math.random() - 0.5) * 9, vy + Math.random() * 5, vz + (Math.random() - 0.5) * 9, this.mat[k], this.lvl);
      }
    }
    if (this.nHot > 8) sparks(this.pos.x, Math.max(1, this.pos.y), this.pos.z, Math.min(50, 10 + (this.nHot >> 3)), 1, 0.6, 0.2, 22);
    if (big && this.alive > 240) {
      const n = Math.min(26, 6 + (this.alive >> 9));
      for (let i = 0; i < n; i++) dust(minX + Math.random() * (maxX - minX), 2, minZ + Math.random() * (maxZ - minZ), 2, 12);
      hooks.shake(Math.min(0.9, 0.3 + this.alive / 36000), this.pos.x, 1, this.pos.z); hooks.sound('collapse', 1, this.pos.x, 1, this.pos.z);
      slam((minX + maxX) / 2, (minZ + maxZ) / 2, Math.min(1, 0.25 + this.alive / 5000));
      hooks.impact(Math.min(1, this.n0 / 30000));
    } else dust(this.pos.x, Math.max(1, this.pos.y), this.pos.z, 5, 10);
    scene.remove(this.mesh); this.mesh.dispose();
  }
}

// ---- support -------------------------------------------------------------
let vis = new Uint8Array(1 << 16), dist = new Uint8Array(1 << 16), qa = new Int32Array(1 << 16), qb = new Int32Array(1 << 16), comp = new Int32Array(1 << 16);
// Fill `dist` over the body's box with how far sideways each of its voxels is from support (255: nothing reaches it).
// Seeds are the body's voxels on the ground; a body built wholly on top of another (b.hung) is seeded where it touches one.
function spanFill(b) {
  const w = b.x1 - b.x0 + 1, h = b.y1 + 1, d = b.z1 - b.z0 + 1, vol = w * h * d, wd = w * d, id = b.id;
  if (vol > dist.length) { vis = new Uint8Array(vol); dist = new Uint8Array(vol); qa = new Int32Array(vol); qb = new Int32Array(vol); comp = new Int32Array(vol); }
  dist.fill(255, 0, vol);
  let nc = 0;
  for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    const gi = idx(b.x0 + x, 0, b.z0 + z);
    if (voxAt(gi) && ownerAt(gi) === id) { dist[x + w * z] = 0; qa[nc++] = x + w * z; }
  }
  if (b.hung) for (let y = 0, l = 0; y < h; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++, l++) {
    const gi = idx(b.x0 + x, y, b.z0 + z);
    if (!voxAt(gi) || ownerAt(gi) !== id) continue;
    for (let f = 0; f < 6; f++) {
      const k = gi + NB[f];
      if (k < 0 || k >= NV || !voxAt(k)) continue;
      const o = bodies[ownerAt(k)];
      if (o && o !== b && o.kind !== 'rubble') { dist[l] = 0; qa[nc++] = l; break; }
    }
  }
  for (let L = 0; nc && L < 254; L++) {
    let sp = nc, nn = 0;
    while (sp) {
      const l = qa[--sp];
      if (dist[l] !== L) continue;
      const x = l % w, z = ((l / w) | 0) % d, y = (l / wd) | 0, g0 = idx(b.x0 + x, y, b.z0 + z);
      for (let f = 0; f < 6; f++) {
        let nl;
        if (f === 0) { if (x === w - 1) continue; nl = l + 1; } else if (f === 1) { if (x === 0) continue; nl = l - 1; }
        else if (f === 2) { if (z === d - 1) continue; nl = l + w; } else if (f === 3) { if (z === 0) continue; nl = l - w; }
        else if (f === 4) { if (y === h - 1) continue; nl = l + wd; } else { if (y === 0) continue; nl = l - wd; }
        if (dist[nl] <= L) continue;
        const gi = g0 + NB[f], m = voxAt(gi);
        if (!m || ownerAt(gi) !== id) continue;
        if (f > 3 && CARRY[m]) { dist[nl] = L; qa[sp++] = nl; }
        else if (dist[nl] > L + 1) { dist[nl] = L + 1; qb[nn++] = nl; }
      }
    }
    const t = qa; qa = qb; qb = t; nc = nn;
  }
  return vol;
}
// Remember how the body hangs together while it is whole, the first time anything is about to be taken from it.
function prime(b) {
  const vol = spanFill(b);
  b.span0 = dist.slice(0, vol);
}
// Rubble lies only on what is under it: when that goes, it falls again.
function dropLoose() {
  let budget = 3000;
  while (loose.length && budget-- > 0) {
    const i = loose.pop(), m = voxAt(i);
    if (!m) continue;
    const b = bodies[ownerAt(i)], y = i >> YS;
    if (!b || b.kind !== 'rubble' || y === 0 || voxAt(i - SXZ)) continue;
    const x = i & XM, z = (i >> ZS) & ZM;
    removeVoxel(i, x, y, z); stats.rubble--;
    spawnDebris(x + 0.5, y + 0.5, z + 0.5, (Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3, m, b.level);
  }
}
function crushLayer(b, y) {
  let n = 0, sx = 0, sz = 0;
  for (let yy = y; yy <= Math.min(b.y1, y + 1); yy++) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) {
    const i = idx(x, yy, z);
    if (!voxAt(i) || ownerAt(i) !== b.id) continue;
    const m = removeVoxel(i, x, yy, z); n++; sx += x; sz += z;
    if (Math.random() < 0.2 * cfg.debrisMul) spawnDebris(x + 0.5, yy + 0.5, z + 0.5, (Math.random() - 0.5) * 18, Math.random() * 5, (Math.random() - 0.5) * 18, m, b.level);
  }
  if (n) {
    dust(sx / n, y, sz / n, 10, 14);
    hooks.destroyed(n, sx / n, y, sz / n, true); hooks.shake(0.35, sx / n, y, sz / n); hooks.sound('collapse', 1, sx / n, y, sz / n);
  }
}
// How a storey that gives way takes the rest down: where what still carries sits to one side, the top goes over toward the
// side that was eaten away (a tall top falls like a tree, a squat one drops leaning); with the damage all round it pancakes.
function failMode(b, y) {
  let n = 0, sx = 0, sz = 0;
  for (let yy = y; yy <= Math.min(b.y1, y + 1); yy++) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) {
    const i = idx(x, yy, z), m = voxAt(i);
    if (m && CARRY[m] && ownerAt(i) === b.id) { n++; sx += x; sz += z; }
  }
  const w = b.x1 - b.x0 + 1, d = b.z1 - b.z0 + 1;
  if (!n) return { mode: 'drop', hx: 0, hz: 0 };
  let hx = (b.x0 + b.x1) / 2 - sx / n, hz = (b.z0 + b.z1) / 2 - sz / n;
  const l = Math.hypot(hx, hz);
  if (l < Math.min(w, d) * 0.09) return { mode: 'drop', hx: 0, hz: 0 };
  hx /= l; hz /= l;
  return { mode: b.y1 - y > Math.min(w, d) * 0.9 ? 'hinge' : 'drop', hx, hz };
}
function checkBody(b) {
  if (b.kind === 'rubble') return;
  if (b.count <= 0) { finish(b); return; }
  if (b.structural) {
    let above = 0, worst = -1, ratio = 1;
    for (let y = b.y1; y >= 0; y--) {
      const c = b.carry[y], n = b.layers[y];
      if (b.dCarry[y] > 0 && n > 0 && above > 80) {
        const load = above / b.dAbove[y], kept = c / b.dCarry[y];
        let r = c > 0 ? load / kept / MARGIN : Infinity;
        // undermined: with more than half of what carried a storey gone, what is left cannot hold a real load steady
        if (kept < UNDER && load > 0.3 && r < 1.01) r = 1.01 + UNDER - kept;
        if (r > ratio) { worst = y; ratio = r; }
      }
      above += n;
    }
    // an overloaded storey groans for a moment before it gives way
    if (worst >= 0 && !b.failing) {
      b.failMode = failMode(b, worst);
      b.failing = true; b.failT = 0.35 + Math.random() * 0.35; b.failY = worst; failing.push(b); hooks.sound('creak', 1, (b.x0 + b.x1) / 2, worst, (b.z0 + b.z1) / 2);
    }
  }
  if (b.explosive && !b.exploded && b.count < b.init * 0.7) {
    b.exploded = true;
    explQueue.push([(b.x0 + b.x1 + 1) / 2, 4, (b.z0 + b.z1 + 1) / 2, b.explosive, 0.05]);
  }
  // What still stands. Support spreads from the ground through the body: straight up or down through anything that can
  // carry costs nothing, every sideways step costs one. A voxel falls when nothing reaches it, or when it now hangs
  // more than SLACK further out than it did when the body was whole (the part over a knocked-out corner, say).
  const vol = spanFill(b), s0 = b.span0;
  let reached = 0, bad = 0;
  vis.fill(0, 0, vol);
  if (s0) { for (let l = 0; l < vol; l++) { const v = dist[l]; if (v === 255) continue; reached++; if (v > s0[l] + SLACK) { vis[l] = 1; bad++; } } }
  else for (let l = 0; l < vol; l++) if (dist[l] !== 255) reached++;
  const spanFail = bad > 0;
  if (reached < b.count || bad) {
    const w = b.x1 - b.x0 + 1, h = b.y1 + 1, d = b.z1 - b.z0 + 1, wd = w * d, id = b.id;
    if (reached < b.count) for (let y = 0, l = 0; y < h; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++, l++) {
      if (dist[l] !== 255) continue;
      const gi = idx(b.x0 + x, y, b.z0 + z);
      if (voxAt(gi) && ownerAt(gi) === id) vis[l] = 1;
    }
    for (let l0 = 0; l0 < vol; l0++) {
      if (vis[l0] !== 1) continue;
      let sp = 0, cn = 0;
      vis[l0] = 2; qa[sp++] = l0;
      while (sp) {
        const l = qa[--sp]; comp[cn++] = l;
        const x = l % w, z = ((l / w) | 0) % d, y = (l / wd) | 0;
        if (x > 0 && vis[l - 1] === 1) { vis[l - 1] = 2; qa[sp++] = l - 1; }
        if (x < w - 1 && vis[l + 1] === 1) { vis[l + 1] = 2; qa[sp++] = l + 1; }
        if (z > 0 && vis[l - w] === 1) { vis[l - w] = 2; qa[sp++] = l - w; }
        if (z < d - 1 && vis[l + w] === 1) { vis[l + w] = 2; qa[sp++] = l + w; }
        if (y > 0 && vis[l - wd] === 1) { vis[l - wd] = 2; qa[sp++] = l - wd; }
        if (y < h - 1 && vis[l + wd] === 1) { vis[l + wd] = 2; qa[sp++] = l + wd; }
      }
      for (let k = 0; k < cn; k++) { const c = comp[k]; comp[k] = idx(b.x0 + (c % w), (c / wd) | 0, b.z0 + (((c / w) | 0) % d)); }
      detach(b, comp, cn);
    }
    // what broke away may have been holding up something else: look again in a moment, so a collapse runs on in steps
    if (spanFail && !b.again) { b.again = true; later.push([b.id, 0.18]); }
  }
  b.nextMode = null;
  if (!b.dead && b.count < b.init * 0.15) finish(b);
}
function finish(b) {
  if (b.dead) return;
  b.dead = true; hooks.bodyDown(b);
}
function detach(b, cells, n) {
  let sec = null;
  if (n >= 40 && sections.length < 26) {
    let mode = 'free', hx = 0, hz = 0;
    if (b.nextMode && n > 240) { mode = b.nextMode.mode; hx = b.nextMode.hx; hz = b.nextMode.hz; }
    else if (cfg.topple && n > 600) {
      // a tall piece cut loose at its foot falls like a tree, toward the side that was hit
      let x0 = 1e9, x1 = -1, z0 = 1e9, z1 = -1, y0 = 1e9, y1 = -1, sx = 0, sz = 0;
      for (let k = 0; k < n; k++) { const i = cells[k], x = (i & XM), z = ((i >> ZS) & ZM), y = (i >> YS); if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; if (y < y0) y0 = y; if (y > y1) y1 = y; sx += x; sz += z; }
      const hgt = y1 - y0 + 1, wid = Math.max(x1 - x0, z1 - z0) + 1;
      if (hgt > wid * 1.5 && y0 <= 16) { hx = lastHit[0] - sx / n; hz = lastHit[2] - sz / n; const l = Math.hypot(hx, hz); if (l > 0.5) { hx /= l; hz /= l; mode = 'hinge'; } }
    }
    if (mode === 'hinge' && Math.hypot(hx, hz) < 0.5) mode = 'free';
    sec = new Section(cells, n, lastHit, mode, b.level, hx, hz); sec.bodyId = b.id; sections.push(sec);
  }
  let sx = 0, sy = 0, sz = 0;
  const p = Math.min(1, 90 / n);
  for (let k = 0; k < n; k++) {
    const i = cells[k], x = (i & XM), z = ((i >> ZS) & ZM), y = (i >> YS);
    const m = removeVoxel(i, x, y, z); sx += x; sy += y; sz += z;
    if (!sec && Math.random() < p) spawnDebris(x + 0.5, y + 0.5, z + 0.5, (Math.random() - 0.5) * 9, Math.random() * 4, (Math.random() - 0.5) * 9, m, b.level);
  }
  hooks.destroyed(n, sx / n, sy / n, sz / n, true);
  if (sec && n > 900) { hooks.sound('collapse', Math.min(1, n / 6000), sx / n, sy / n, sz / n); hooks.shake(Math.min(0.5, n / 16000), sx / n, sy / n, sz / n); }
  pending.delete(b.id);
}

// ---- lifecycle -----------------------------------------------------------
export function initSim(sc) {
  scene = sc;
  chunkMat = makeChunkMaterial(); chunkDepth = makeChunkDepthMaterial();
  meshOpts.count = true;
  for (let k = 0; k < NCX * NCZ; k++) rebuildChunk(k);
  meshOpts.count = false;
  for (let i = 1; i < bodies.length; i++) { const b = bodies[i]; b.hung = b.kind !== 'rubble' && b.count > 0 && b.layers0[0] === 0; b.carry.fill(0); }
  eachVoxel((i, m) => { if (!CARRY[m]) return; const o = ownerAt(i), up = i + SXZ; if (ownerAt(up) === o && CARRY[voxAt(up)]) bodies[o].carry[i >> YS] += CARRY[m]; });
  for (let i = 1; i < bodies.length; i++) bodies[i].dCarry = bodies[i].carry.slice();
  boxGeo = new THREE.BoxGeometry(1, 1, 1);
  secMat = new THREE.MeshLambertMaterial();
  dmesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial(), ND);
  dmesh.frustumCulled = false; dmesh.castShadow = true; dmesh.receiveShadow = true;
  for (let i = 0; i < ND; i++) { dmesh.setMatrixAt(i, ZERO); dmesh.setColorAt(i, _c.setRGB(1, 1, 1)); }
  dmesh.count = debrisBudget;
  scene.add(dmesh);
  dustP = new Particles(6000, false); fireP = new Particles(3200, true);
  scene.add(dustP.points); scene.add(fireP.points);
  flashGeo = new THREE.SphereGeometry(1, 16, 10);
  ringGeo = new THREE.RingGeometry(0.9, 1, 64);
}
export function setParticleScale(h, fov) { const s = h / (2 * Math.tan(fov * Math.PI / 360)); dustP.mat.uniforms.scale.value = s; fireP.mat.uniforms.scale.value = s; }
export function setShadows(on) { dmesh.castShadow = on; nearShadow = on; for (const m of chunkMesh) if (m) m.castShadow = on; }
export function stepSim(dt) {
  if (explQueue.length) {
    for (let i = explQueue.length - 1; i >= 0; i--) {
      const q = explQueue[i]; q[4] -= dt;
      if (q[4] <= 0) { explQueue.splice(i, 1); explode(q[0], q[1], q[2], q[3], 0.6); }
    }
  }
  if (glassQ.length) {
    for (let i = 0; i < glassQ.length; i++) glassQ[i][1] -= dt;
    let budget = 60;
    while (glassQ.length && glassQ[glassQ.length - 1][1] <= 0 && budget > 0) { const q = glassQ.pop(); if (shatterPane(q[0], q[2], q[3], q[4])) budget--; }
  }
  for (let i = failing.length - 1; i >= 0; i--) {
    const b = failing[i]; b.failT -= dt;
    if (Math.random() < dt * 16) dust(b.x0 + Math.random() * (b.x1 - b.x0 + 1), b.failY + 0.5, b.z0 + Math.random() * (b.z1 - b.z0 + 1), 1, 4);
    if (b.failT <= 0) { failing.splice(i, 1); b.failing = false; if (b.count > 0) { crushLayer(b, b.failY); if (!b.nextMode) b.nextMode = b.failMode; pending.add(b.id); } }
  }
  stepFire(dt);
  for (let i = later.length - 1; i >= 0; i--) { const q = later[i]; q[1] -= dt; if (q[1] <= 0) { later.splice(i, 1); const b = bodies[q[0]]; b.again = false; if (b.count > 0) pending.add(b.id); } }
  if (loose.length) dropLoose();
  let n = 0;
  const tc = performance.now();
  simStep++;
  for (const id of pending) {
    const b = bodies[id];
    if (simStep - (b.seen || 0) < 3) continue;   // a body under steady attack is looked at ten times a second, not thirty
    pending.delete(id); b.seen = simStep; checkBody(b);
    if (++n >= 4 || performance.now() - tc > 4) break;
  }
  frameSecs.length = 0;
  for (let i = sections.length - 1; i >= 0; i--) if (!sections[i].update(dt)) sections.splice(i, 1);
  updateDebris(dt);
  dustP.update(dt); fireP.update(dt);
  stats.particles = dustP.live + fireP.live;
  updateFx(dt);
  flushChunks(4);
}
export function sectionCount() { return sections.length; }
export function sectionVoxels() { let n = 0; for (const s of sections) n += s.alive; return n; }
