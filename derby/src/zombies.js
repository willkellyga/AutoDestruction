// The dead: the horde for the last-car-standing round (modes/survival.js). Voxel zombies that shamble at the nearest
// car, lunge when they get close, claw at it and hang on to it (several hanging on drag it down) until it shakes them
// off. A car that hits one fast enough splats it (saws, blades and big rams at any speed), and the guns and blasts kill
// them through main.js's `extras` hook (solid, hit and explosion below).
//
// Kept cheap for phones: at most a set number alive (the mode says how many; fewer on phones). Each of the three looks is one instanced mesh whose walk, lunge and
// cling are posed in its vertex shader from four numbers an instance, so the whole horde is three draws (and three
// shadow draws) and no per-limb matrices. One route field serves the whole horde: a flood out from every car over the
// map's route grid (maps/common.js makeGridNav), a few times a second. Each zombie then does plain seek, separation and
// sliding along walls.
import * as THREE from 'three';
import { WX, WZ, solid } from '../../src/world.js';
import { VoxPart, hash, tone } from '../../units/src/voxpart.js';
import { lineClear } from './maps/common.js';
import { AI } from './tuning.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Every number that sets how the horde plays. Lengths are town voxels, speeds voxels a second (a car does 70 to 150).
export const HORDE = {
  max: 48,          // zombies alive at once, unless the mode asks for more (makeHorde's o.max)
  hp: 5,            // health: two rounds of the machine gun
  hitR: 2.0,        // how far either side of one a shot still hits it (a generous box, so bursts connect)
  rivalGun: 0.7,    // the rivals' guns and blasts do this share of the player's to the dead (not AI.dmg's, which is for cars)
  pellet: 1.6,      // and the scattergun's pellets hit them this much harder, so a blast clears a group
  speed: [7, 10],   // shambling speed (the mode's `speed` scales it up as the round goes on)
  runner: 16,       // the speed of the runners that come late in the round
  lunge: 2.6,       // how much faster the last few voxels go
  reach: 5,         // closer than this to a car's side they lunge
  claw: 3.2,        // health one claw takes (the mode's `dmg` scales it) ...
  clawT: 0.85,      // ... about this often, from each zombie hanging on to a car or standing at it
  hold: 6,          // zombies that can hang on to one car at once
  drag: 0.11,       // each one hanging on costs the car this share of its speed a second
  splat: 30,        // a car hitting one faster than this, divided by its ram strength, splats it
  knock: 9,         // slower than that but faster than this, it is knocked flying instead
  shake: 115,       // a car turning harder than this (speed times turn rate) starts throwing them off
  scrap: 1,         // scrap for each one the player kills
};
const R = 1.25;     // a zombie's radius
const TALL = 7.6;   // and its height
const H = 0.5;      // the cubes they are built from: an eighth of a metre, like the town's soldiers

// ---- the models ---------------------------------------------------------------------------------------------------
// Three looks: a dead soldier in torn fatigues and a helmet, a base worker in a bloodied white shirt and jeans, and a
// mechanic in an orange boiler suit with one boot gone. Grey-green skin, dark sockets and red eyes for all of them.
// Six parts each, in cube coordinates in the model's own space (+x is its left, +z forward, y up from the ground):
// 0 torso, 1 head, 2 left arm, 3 right arm, 4 left leg, 5 right leg. The shader below poses them.
const SKIN = [0x8d9c76, 0x7f8f69, 0x98a681, 0x86946c], ROT = [0x66724f, 0x5b6646];
const BLOOD = [0x6b1a14, 0x561410, 0x7c231a];
const EYE = 0xe0391f, SOCKET = 0x1b1e17, MOUTH = 0x2a120e, TEETH = 0xd9d2b4;
const LOOKS = [
  { shirt: [0x5d6a3c, 0x525d34, 0x67744a], legs: [0x4b5532, 0x434c2d, 0x535d38], shoes: [0x2a2520, 0x2a2520], hat: [0x4a562f, 0x3f4a28], sleeves: [1, 0.45], blood: 0.07 },
  { shirt: [0xc8c2b0, 0xb9b2a0, 0xd3cdbd], legs: [0x3d587c, 0x354d6e, 0x46628a], shoes: [0x4a3426, 0x4a3426], hair: [0x2e2620, 0x3a3028], sleeves: [0.55, 0], blood: 0.16 },
  { shirt: [0xc2652b, 0xb05a26, 0xcf7434], legs: [0xb45e28, 0xa65524, 0xc2652b], shoes: [0x2b2a28, -1], hair: [0x6b5a44], sleeves: [1, 1], blood: 0.1, bald: true },
];
const BOXES = [
  [-3, 6, -1, 3, 11, 2],    // torso
  [-2, 11, -1, 2, 16, 3],   // head (the top row is hair or a helmet)
  [3, 5, -1, 5, 11, 1],     // left arm, hanging from the shoulder
  [-5, 5, -1, -3, 11, 1],   // right arm
  [0, 0, -1, 2, 6, 2],      // left leg (the toe sticks out in front)
  [-2, 0, -1, 0, 6, 2],     // right leg
];
function paintLook(n) {
  const L = LOOKS[n], s = 17 + n * 31;
  const of = (pal, i, j, k, t = 0) => pal[Math.floor(hash(i, j, k, s + t) * pal.length)];
  const skin = (i, j, k) => (hash(i >> 1, j, k >> 1, s + 3) < 0.18 ? of(ROT, i, j, k, 4) : of(SKIN, i, j, k, 5));
  // cloth: torn through to the skin here and there, and spattered with blood
  const cloth = (pal, rip = 0.07) => (i, j, k) => { const r = hash(i, j, k, s + 7); return r < rip ? skin(i, j, k) : r < rip + L.blood ? of(BLOOD, i, j, k, 8) : of(pal, i, j, k, 9); };
  const parts = BOXES.map((b, id) => ({ id, vp: new VoxPart(b, H, s + id) }));
  const [torso, head, armL, armR, legL, legR] = parts.map((p) => p.vp);
  // the torso: the shirt, a ragged hem (a few cubes gone along the bottom) and blood down the front
  torso.box(-3, 6, -1, 3, 11, 2, cloth(L.shirt, 0.09));
  for (let i = -3; i < 3; i++) { if (hash(i, 6, 0, s + 11) < 0.35) torso.set(i, 6, 1, -1); if (hash(i, 6, 1, s + 12) < 0.3) torso.set(i, 6, -1, -1); }
  for (let j = 7; j < 11; j++) if (hash(j, 1, 2, s) < 0.7) torso.set(-1 + (n & 1), j, 1, of(BLOOD, 0, j, 1, 13));
  if (n === 0) { torso.box(-3, 7, -1, 3, 8, 2, 0x3b2f22); torso.set(0, 7, 1, 0xa89048); }   // the soldier's belt and buckle
  if (n === 2) torso.box(-1, 8, 1, 1, 10, 2, 0x9a4a1e);                                     // a chest pocket on the boiler suit
  // the head: sunken eyes with a red glint, a slack mouth with a tooth, a bloody chin; then a helmet or hair
  head.box(-2, 11, -1, 2, 15, 3, skin);
  head.set(-2, 13, 2, EYE); head.set(1, 13, 2, EYE); head.set(-2, 12, 2, SOCKET); head.set(1, 12, 2, SOCKET);
  head.set(-1, 11, 2, MOUTH); head.set(0, 11, 2, n === 1 ? TEETH : MOUTH); head.set(-2, 11, 2, of(BLOOD, 0, 11, 2, 2));
  if (L.hat) { head.box(-2, 15, -1, 2, 16, 3, (i, j, k) => of(L.hat, i, j, k, 14)); head.box(-2, 14, -1, 2, 15, 0, L.hat[1]); head.box(-2, 14, -1, -1, 15, 3, L.hat[0]); head.box(1, 14, -1, 2, 15, 3, L.hat[0]); }
  else if (L.bald) { for (const [i, k] of [[-1, -1], [1, 0], [-2, 1]]) head.set(i, 15, k, L.hair[0]); }
  else { head.box(-2, 15, -1, 2, 16, 3, (i, j, k) => (hash(i, j, k, s + 15) < 0.2 ? -1 : of(L.hair, i, j, k, 16))); head.box(-2, 12, -1, 2, 15, 0, L.hair[0]); head.set(-2, 14, 2, L.hair[1]); }
  // the arms: a sleeve, torn off at some length, then grey skin down to the hand
  for (const [vp, x0, sl] of [[armL, 3, L.sleeves[0]], [armR, -5, L.sleeves[1]]]) {
    const cut = 11 - Math.round(sl * 5);
    vp.box(x0, 5, -1, x0 + 2, 11, 1, (i, j, k) => (j >= cut && !(j === cut && hash(i, j, k, s + 21) < 0.5) ? cloth(L.shirt, 0.04)(i, j, k) : skin(i, j, k)));
    vp.box(x0, 5, -1, x0 + 2, 6, 1, (i, j, k) => tone(skin(i, j, k), 0.85));   // the hands, a little darker
  }
  // the legs: trousers torn at the knee, and the shoes (or a bare foot)
  for (const [vp, x0, shoe] of [[legL, 0, L.shoes[0]], [legR, -2, L.shoes[1]]]) {
    vp.box(x0, 1, -1, x0 + 2, 6, 1, cloth(L.legs, 0.05));
    if (hash(x0, 3, 0, s + 23) < 0.6) vp.set(x0 + (x0 ? 1 : 0), 3, 0, skin(x0, 3, 0));
    vp.box(x0, 0, -1, x0 + 2, 1, 1, shoe < 0 ? skin : shoe); vp.set(x0, 0, 1, shoe < 0 ? skin(x0, 0, 1) : shoe); vp.set(x0 + 1, 0, 1, shoe < 0 ? skin(x0 + 1, 0, 1) : shoe);
  }
  return parts;
}
// one look as a single geometry: every part's faces (with the cubes' baked corner shading), each vertex tagged with
// its part; and its cubes, for the splat
function buildLook(n) {
  const parts = paintLook(n), cnt = [0, 0];
  let F = 0;
  for (const P of parts) { P.vp.faceCount(0, P.vp.nz, cnt); P.f = cnt[0] + cnt[1]; F += P.f; }
  const p = new Float32Array(F * 12), nn = new Float32Array(F * 12), c = new Float32Array(F * 12), part = new Float32Array(F * 4);
  const spare = { p: new Float32Array(12), n: new Float32Array(12), c: new Float32Array(12) };
  let at = 0;
  for (const P of parts) {
    P.vp.faceFill(0, P.vp.nz, [{ p, n: nn, c }, spare], [at * 12, 0]);
    part.fill(P.id, at * 4, (at + P.f) * 4); at += P.f;
  }
  const ix = new Uint16Array(F * 6);
  for (let f = 0, e = 0, v = 0; f < F; f++, e += 6, v += 4) { ix[e] = v; ix[e + 1] = v + 1; ix[e + 2] = v + 2; ix[e + 3] = v; ix[e + 4] = v + 2; ix[e + 5] = v + 3; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.setAttribute('zpart', new THREE.BufferAttribute(part, 1));
  geo.setIndex(new THREE.BufferAttribute(ix, 1));
  const cubes = []; for (const P of parts) P.vp.all(cubes, 1);
  return { geo, cubes, tris: F * 2 };
}

// ---- the pose, in the vertex shader -------------------------------------------------------------------------------
// zanim per instance: x the walk's phase, y the lunge (0 to 1), z the state (0 on its feet, 1 hanging on to a car),
// w a number of its own (which way its head lolls). Pivots are in town voxels: the hips 3 up, the neck 5.5, the
// shoulders 5.25 and two out. The legs swing; the torso leans and sways; the arms reach out in front and the head
// lolls, both carried by the torso.
const POSE = `
attribute float zpart;
attribute vec4 zanim;
mat3 zrx(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
mat3 zry(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 zrz(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
vec3 zpose(vec3 v, float w) {
  float p = zanim.x, L = zanim.y, cl = step(0.5, zanim.z), sd = zanim.w;
  if (zpart > 3.5) {
    float side = zpart < 4.5 ? 1. : -1.;
    vec3 hp = vec3(0.5 * side, 3., 0.) * w;
    return zrx(mix(0.55 * sin(p) * side, 0.95 + 0.2 * sin(p * 2. + side), cl)) * (v - hp) + hp;
  }
  mat3 T = zry(0.12 * sin(p) * (1. - cl)) * zrx(0.3 + 0.35 * L + 0.06 * sin(2. * p) + 0.3 * cl) * zrz(0.08 * sin(p) + (sd - 0.5) * 0.25);
  if (zpart > 1.5) {
    float side = zpart < 2.5 ? 1. : -1.;
    vec3 sh = vec3(2. * side, 5.25, 0.) * w;
    float a = -1.3 - 0.45 * L - 0.4 * cl + 0.22 * sin(p + side * 1.7) + (sd - 0.5) * 0.35 * side;
    v = zrz(side * (0.08 + 0.3 * L)) * zrx(a) * (v - sh) + sh;
  } else if (zpart > 0.5) {
    vec3 nk = vec3(0., 5.5, 0.25) * w;
    v = zrz((sd - 0.5) * 1.1 + 0.12 * sin(p * 0.5)) * zrx(0.18 - 0.45 * L + 0.08 * sin(p)) * (v - nk) + nk;
  }
  vec3 hip = vec3(0., 3., 0.) * w;
  return T * (v - hip) + hip;
}
`;
function posed(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + POSE)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = zpose(objectNormal, 0.);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = zpose(transformed, 1.);');
  };
  mat.customProgramCacheKey = () => 'zombie-pose-1';
  return mat;
}

// ---- blood on the ground: one instanced mesh of flat splats, the oldest painted over first ------------------------
function makeStains(scene, max = 96) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  let s = 5; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  g.fillStyle = 'rgba(120,18,12,0.92)';
  // a splat: a blob, smaller drops round it, in voxel-sized squares so it reads like the rest of the ground
  for (let i = 0; i < 260; i++) { const a = r() * 6.283, d = Math.pow(r(), 1.6) * 26 * (i < 200 ? 0.6 : 1), q = 2 + Math.floor(r() * 3); g.fillRect(Math.round(32 + Math.cos(a) * d - q / 2), Math.round(32 + Math.sin(a) * d - q / 2), q, q); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.InstancedMesh(geo, mat, max); mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 1;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  let n = 0;
  return function stain(x, z, size, stretch = 1, yaw = Math.random() * 6.283) {
    const i = n++ % max;
    m.compose(v.set(x, 0.05 + (i % 24) * 0.003, z), q.setFromAxisAngle(UP, yaw), sc.set(size, 1, size * stretch));
    mesh.setMatrixAt(i, m); mesh.setColorAt(i, col.setScalar(0.65 + Math.random() * 0.45));
    mesh.count = Math.min(max, n); mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  };
}

// ---- the horde ----------------------------------------------------------------------------------------------------
// G is main.js's api. o.onKill(z, by) hears of every kill (by: the car that did it, or null).
export function makeHorde(G, o = {}) {
  const MAX = o.max || HORDE.max;
  const looks = [0, 1, 2].map(buildLook);
  const mat = posed(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, color: new THREE.Color(1.15, 1.15, 1.15) }));
  const depth = posed(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  const meshes = looks.map((L) => {
    const geo = L.geo.clone();
    geo.setAttribute('zanim', new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.InstancedMesh(geo, mat, MAX);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, new THREE.Color(1, 1, 1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.customDepthMaterial = depth; m.name = 'zombies';
    G.scene.add(m); return m;
  });
  const stain = makeStains(G.scene);
  const all = [];   // the living, in no order
  const H_ = { all, max: MAX, strength: { speed: 1, dmg: 1 }, active: true, killed: 0, byPlayer: 0, spawned: 0, ms: 0, tris: looks.map((l) => l.tris) };
  let seq = 0;
  function centre(out) { return out.set(this.x, this.y + 3.6 * this.size, this.z); }

  // ---- coming in ----
  // x, z: where it appears; entry: a point inside the walls to walk to first (it came in through a gate or a gap);
  // drop: it climbs over the wall, so it starts on top of it and drops down
  H_.spawn = (x, z, opt = {}) => {
    if (all.length >= MAX) return null;
    const id = seq++, look = opt.look ?? (id % 3);
    const sp = opt.speed ?? (HORDE.speed[0] + hash(id, 1, 2, 9) * (HORDE.speed[1] - HORDE.speed[0]));
    const z_ = {
      id, look, x, z, y: opt.drop ? 9.5 : 0, vx: 0, vz: 0, vy: 0, yaw: opt.yaw ?? Math.random() * 6.283, hp: HORDE.hp,
      speed: sp, phase: Math.random() * 6.283, L: 0, S: 0, seed: hash(id, 7, 3, 1), size: 0.92 + hash(id, 4, 4, 2) * 0.16, tint: 0.85 + hash(id, 5, 1, 3) * 0.3,
      state: opt.drop ? 'drop' : 'walk', t: 0, car: null, lx: 0, lz: 0, clawT: 0.4, lungeCD: 0, grabCD: 0, entry: opt.entry || null, fall: 0,
      seeT: Math.random() * 0.4, see: false, tgt: null, td: 1e9, by: null, holdT: 0,
      half: 1, centre,   // for main.js's aim assist (a mode's targets): its size and where its middle is
    };
    if (opt.drop && opt.in) { z_.vx = opt.in.x * 7; z_.vz = opt.in.z * 7; }
    all.push(z_); H_.spawned++;
    return z_;
  };

  // ---- the route field: how many cells to the nearest car, from every cell, over the map's route grid ----
  const nav = G.MAP.nav;
  const N = nav ? nav.NX * nav.NZ : 0, dist = new Uint16Array(N), queue = new Int32Array(N);
  let fieldT = 0;
  function field(cars) {
    if (!nav) return;
    dist.fill(65535); let qh = 0, qt = 0;
    for (const c of cars) { if (c.dead || c.gone) continue; const i = nav.cellOf(c.x, c.z); if (dist[i]) { dist[i] = 0; queue[qt++] = i; } }
    const NX = nav.NX, NZ = nav.NZ, B = nav.blocked;
    while (qh < qt) {
      const i = queue[qh++], d = dist[i] + 1, x = i % NX, z = (i / NX) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, zz = z + dz; if ((!dx && !dz) || xx < 0 || zz < 0 || xx >= NX || zz >= NZ) continue;
        const j = zz * NX + xx; if (B[j] || dist[j] <= d) continue;
        if (dx && dz && (B[z * NX + xx] || B[zz * NX + x])) continue;   // no squeezing past a corner
        dist[j] = d; queue[qt++] = j;
      }
    }
  }
  // which way the field says to go from (x, z): towards the neighbouring cell nearest a car, or null
  const _f = { x: 0, z: 0 };
  function downhill(x, z) {
    if (!nav) return null;
    const NX = nav.NX, NZ = nav.NZ, i = nav.cellOf(x, z), cx = i % NX, cz = (i / NX) | 0;
    let best = dist[i], bi = -1;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const xx = cx + dx, zz = cz + dz; if ((!dx && !dz) || xx < 0 || zz < 0 || xx >= NX || zz >= NZ) continue;
      const j = zz * NX + xx; if (dist[j] < best) { best = dist[j]; bi = j; }
    }
    if (bi < 0) return null;
    _f.x = (bi % NX + 0.5) * nav.cell - x; _f.z = (((bi / NX) | 0) + 0.5) * nav.cell - z;
    const d = Math.hypot(_f.x, _f.z) || 1; _f.x /= d; _f.z /= d; return _f;
  }

  // ---- walking: slide along whatever stands in the way at knee and chest height ----
  const wallAt = (x, z) => x >= 0 && z >= 0 && x < WX && z < WZ && (solid(Math.floor(x), 3, Math.floor(z)) || solid(Math.floor(x), 6, Math.floor(z)));
  function move(z, dx, dz) {
    if (wallAt(z.x, z.z)) { z.x += dx; z.z += dz; return; }   // buried in rubble: let it climb out
    if (dx && !wallAt(z.x + dx + Math.sign(dx) * R, z.z)) z.x += dx; else z.vx *= -0.2;
    if (dz && !wallAt(z.x, z.z + dz + Math.sign(dz) * R)) z.z += dz; else z.vz *= -0.2;
  }

  // ---- dying ----
  const _p = new THREE.Vector3();
  let puffT = -1;
  function splat(z, by, dx = 0, dz = 0, push = 10) {
    if (z.dead) return;
    z.dead = true; H_.killed++;
    if (by && by === G.player) { H_.byPlayer++; G.game.scrap += HORDE.scrap; }
    if (o.onKill) o.onKill(z, by);
    // fly apart into cubes, thrown the way the blow went
    const cubes = looks[z.look].cubes, sy = Math.sin(z.yaw), cy = Math.cos(z.yaw), n = Math.min(cubes.length, 26), step = cubes.length / n;
    const hd = Math.hypot(dx, dz) || 1;
    for (let k = 0; k < n; k++) {
      const [x, y, zz, c] = cubes[Math.floor(k * step + Math.random() * step) % cubes.length];
      const wx = z.x + x * cy + zz * sy, wz = z.z - x * sy + zz * cy, s = push * (0.5 + Math.random() * 0.8);
      G.cube(wx, z.y + y * z.size, wz, dx / hd * s + (Math.random() - 0.5) * 9, 5 + Math.random() * 11, dz / hd * s + (Math.random() - 0.5) * 9, c, H * (1.6 + Math.random()));
    }
    stain(z.x, z.z, 3.5 + Math.random() * 2.5);
    if (push > 20) stain(z.x + dx / hd * 4, z.z + dz / hd * 4, 3 + Math.random() * 2, 2.2, Math.atan2(dx, dz));   // a smear the way it was thrown
    // a puff of red (not one for every splat when a car goes through a crowd, or it turns into a red fog)
    if (G.game.time - puffT > 0.12) { puffT = G.game.time; G.dust(z.x, 2.5, z.z, 2, 1.2, 0.36, 0.05, 0.04); }
    G.sfx.play('crunch', 0.32, z.x, z.z, { gap: 0.05, rate: 1.35, jitter: 0.12 });
    G.sound('bite', 0.35, z.x, 2, z.z);
  }
  function hurt(z, d, by, dx, dz, push) { z.hp -= d; if (by) z.by = by; if (z.hp <= 0) splat(z, by || z.by, dx, dz, push); }
  // knocked flying (by a car, a blast, or thrown off a car)
  function fling(z, vx, vz, vy, by) {
    z.state = 'down'; z.t = 0; z.car = null; z.vx = vx; z.vz = vz; z.vy = vy; z.by = by || z.by; z.y = Math.max(z.y, 0.1);
  }

  // ---- the cars: run over, pushed aside, grabbed ----
  function local(c, z, out) {
    const s = Math.sin(c.yaw), co = Math.cos(c.yaw), dx = z.x - c.x, dz = z.z - c.z;
    out.lx = dx * co - dz * s; out.lz = dx * s + dz * co - c.mid; return out;
  }
  const _l = { lx: 0, lz: 0 };
  function contact(z, c, dt) {
    local(c, z, _l);
    const ox = c.wide + R - Math.abs(_l.lx), oz = c.half + R - Math.abs(_l.lz);
    if (ox <= 0 || oz <= 0) return false;
    const s = Math.sin(c.yaw), co = Math.cos(c.yaw), end = oz < ox;
    const nlx = end ? 0 : Math.sign(_l.lx) || 1, nlz = end ? Math.sign(_l.lz) || 1 : 0;
    const nx = nlx * co + nlz * s, nz = -nlx * s + nlz * co, over = end ? oz : ox;
    if (c.dead) { z.x += nx * over; z.z += nz * over; return true; }   // a wreck is only in the way
    // how fast the car comes at it (its own lunge into a standing car doesn't count: that is a grab, not a hit)
    const hit = c.vx * nx + c.vz * nz, ram = c.spec.ram || 1;
    // what kills it: saws on the nose, blades along the sides, or enough speed for the ram the car has
    const shred = (end && nlz > 0 && c.spec.saw) || (!end && c.spec.blade);
    const kill = shred ? 2 : HORDE.splat / ram;
    if (z.y < 3.5 && hit > kill) {
      splat(z, c, c.vx, c.vz, 10 + hit * 0.5);
      c.vx *= 0.985; c.vz *= 0.985;
      if (c === G.player) G.game.shake = Math.min(1.2, G.game.shake + 0.07);
      if (shred) G.sparks(z.x, 2.5, z.z, 6, 0.6, 0.1, 0.08, 16);
      return true;
    }
    if (hit > HORDE.knock || z.state === 'down') {
      fling(z, c.vx * 0.85 + nx * 9, c.vz * 0.85 + nz * 9, 5 + hit * 0.12, c);
      z.x += nx * over; z.z += nz * over;
      hurt(z, hit * 0.18 * ram, c, c.vx, c.vz, 14);
      return true;
    }
    // slow: shoved aside, and it grabs hold if it can
    z.x += nx * over; z.z += nz * over;
    if (H_.active && (z.state === 'walk' || z.state === 'lunge' || z.state === 'claw') && z.grabCD <= 0) {
      if (hold(c) < HORDE.hold && Math.abs(hit) < 40) {
        z.state = 'cling'; z.car = c; z.t = 0; z.holdT = 0; z.clawT = 0.3 + Math.random() * 0.4;
        z.lx = clamp(_l.lx, -c.wide - 0.9, c.wide + 0.9) + nlx * 0.9; z.lz = clamp(_l.lz, -c.half - 0.6, c.half + 0.6) + nlz * 0.9 + c.mid;
        if (end) z.lx = clamp(z.lx, -c.wide + 1, c.wide - 1); else z.lz = clamp(z.lz, c.mid - c.half + 2, c.mid + c.half - 2);
      } else if (z.state !== 'claw') { z.state = 'claw'; z.car = c; z.t = 0; }
    }
    return true;
  }
  const holding = new Map();
  const hold = (c) => holding.get(c) || 0;
  H_.clingers = hold;
  function claw(z, c) {
    z.clawT = HORDE.clawT * (0.8 + Math.random() * 0.45); z.L = 1;
    G.damage(c, HORDE.claw * H_.strength.dmg, null);
    // the claws take a little paint and metal off where it hangs on (a few times a second at most: each one rebuilds
    // part of the car's model, and a big crowd claws a lot)
    if (G.game.time > (c.zChipT || 0)) { c.zChipT = G.game.time + 0.3; _p.set(z.x, 2 + Math.random() * 2.5, z.z); c.unit.hit(_p, 0.45, G.chip, 4); }
    G.sfx.play('scrape', 0.28, z.x, z.z, { gap: 0.12, rate: 1.4, jitter: 0.2 });
  }

  // ---- each frame ----
  const _q = new THREE.Vector3();
  H_.step = (dt) => {
    const t0 = performance.now(), cars = G.cars;
    const live = cars.filter((c) => !c.dead && !c.gone);
    if ((fieldT -= dt) <= 0) { fieldT = 0.35; field(live); }
    // how many hang on to each car, and how hard each car is turning (for throwing them off)
    holding.clear();
    for (const z of all) if (z.state === 'cling' && z.car) holding.set(z.car, hold(z.car) + 1);
    for (const c of live) {
      const n = hold(c); if (n) { const k = Math.exp(-HORDE.drag * n * dt); c.vx *= k; c.vz *= k; }
      const sp = c.speed; c._zdv = Math.abs(sp - (c._zsp ?? sp)) / Math.max(dt, 1e-3); c._zsp = sp;
    }
    for (const z of all) {
      if (z.dead) continue;
      z.t += dt; z.grabCD -= dt; z.lungeCD -= dt; z.L = Math.max(0, z.L - dt * 3);
      // the nearest car still running, and how far its side is
      if (z.state !== 'cling') {
        let best = null, bd = 1e9;
        for (const c of live) { const d = Math.hypot(c.x - z.x, c.z - z.z) - c.wide; if (d < bd) { bd = d; best = c; } }
        z.tgt = best; z.td = bd;
      }
      if (z.state === 'drop') {   // coming down off the top of the wall
        z.vy -= 60 * dt; z.y += z.vy * dt; move(z, z.vx * dt, z.vz * dt);
        if (z.y <= 0) { z.y = 0; z.vy = 0; z.state = 'walk'; z.vx *= 0.3; z.vz *= 0.3; G.dust(z.x, 0.5, z.z, 2, 1.5); }
        continue;
      }
      if (z.state === 'down') {   // flying, or flat on its back
        if (z.y > 0 || z.vy > 0) {
          z.vy -= 60 * dt; z.y += z.vy * dt; move(z, z.vx * dt, z.vz * dt);
          z.fall = Math.min(1.45, z.fall + dt * 5);
          if (z.y <= 0) {
            z.y = 0; const sp = Math.hypot(z.vx, z.vz);
            if (sp > 55) { splat(z, z.by, z.vx, z.vz, sp * 0.4); continue; }   // hit the ground too hard
            if (sp > 25) hurt(z, (sp - 25) * 0.15, z.by, z.vx, z.vz, 12);
            z.vy = 0; z.t = 0; G.dust(z.x, 0.5, z.z, 2, 2);
          }
        } else {
          const k = Math.exp(-6 * dt); z.vx *= k; z.vz *= k; move(z, z.vx * dt, z.vz * dt);
          if (z.t > 1.1) { z.fall = Math.max(0, z.fall - dt * 3); if (z.fall <= 0) { z.state = 'walk'; z.t = 0; } }
        }
        continue;
      }
      if (z.state === 'cling') {
        const c = z.car;
        if (!c || c.dead || c.gone || !H_.active) { fling(z, (c ? c.vx : 0) * 0.5, (c ? c.vz : 0) * 0.5, 4, null); z.grabCD = 1; continue; }
        z.holdT += dt; z.phase += dt * 9;
        const s = Math.sin(c.yaw), co = Math.cos(c.yaw);
        z.x = c.x + z.lx * co + z.lz * s; z.z = c.z - z.lx * s + z.lz * co; z.y = 0;
        z.vx = c.vx; z.vz = c.vz;
        z.yaw = Math.atan2(c.x + c.mid * s - z.x, c.z + c.mid * co - z.z);
        // thrown off by a hard turn or a crash
        const turn = Math.abs(c.yawRate * c.fwd);
        if (z.holdT > 0.5 && ((turn > HORDE.shake && Math.random() < dt * (turn - HORDE.shake) / 45) || c._zdv > 260)) {
          const ox = Math.sin(z.yaw), oz = Math.cos(z.yaw);
          fling(z, c.vx * 0.8 - ox * 10, c.vz * 0.8 - oz * 10, 6, c); z.grabCD = 1.5;
          continue;
        }
        if ((z.clawT -= dt) <= 0) claw(z, c);
        continue;
      }
      // on its feet: walk in, lunge at the car, or stand at it clawing
      const T = z.tgt;
      let wx = 0, wz = 0, sp = z.speed * H_.strength.speed;
      if (z.entry) {
        wx = z.entry.x - z.x; wz = z.entry.z - z.z;
        if (Math.hypot(wx, wz) < 8 || (z.x > 14 && z.z > 14 && z.x < WX - 14 && z.z < WZ - 14)) z.entry = null;
      } else if (T) {
        if ((z.seeT -= dt) <= 0) { z.seeT = 0.35 + Math.random() * 0.3; z.see = z.td < 90 && lineClear(z.x, z.z, T.x, T.z, 3, 0.8); }
        const f = !z.see && downhill(z.x, z.z);
        if (f) { wx = f.x; wz = f.z; } else { wx = T.x + T.vx * 0.25 - z.x; wz = T.z + T.vz * 0.25 - z.z; }
      }
      if (z.state === 'claw') {
        const c = z.car;
        if (!c || c.dead || c.gone || !H_.active || z.td > 3.5 || T !== c) { z.state = 'walk'; z.car = null; }
        else { sp *= 0.6; if ((z.clawT -= dt) <= 0) claw(z, c); }
      } else if (z.state === 'lunge') {
        sp *= HORDE.lunge; z.L = 1;
        if (z.t > 0.45) { z.state = 'walk'; z.t = 0; z.lungeCD = 1.1; }
      } else if (T && z.td < HORDE.reach && z.lungeCD <= 0 && H_.active) { z.state = 'lunge'; z.t = 0; G.sound('breath', 0.15, z.x, 3, z.z); }
      const wl = Math.hypot(wx, wz);
      if (wl > 0.01) {
        const k = Math.min(1, dt * 7); z.vx += (wx / wl * sp - z.vx) * k; z.vz += (wz / wl * sp - z.vz) * k;
        z.yaw += wrap(Math.atan2(wx, wz) - z.yaw) * Math.min(1, dt * 8);
      } else { z.vx *= 0.9; z.vz *= 0.9; }
      z.phase += dt * Math.hypot(z.vx, z.vz) * 1.25;
    }
    // separation: those on their feet keep a body's width apart
    for (let i = 0; i < all.length; i++) {
      const a = all[i]; if (a.dead || a.state === 'cling' || a.y > 1) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j]; if (b.dead || b.state === 'cling' || b.y > 1) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
        if (d2 >= 4 * R * R || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), push = (2 * R - d) * 0.5 / d;
        a.vx -= dx * push * 2; a.vz -= dz * push * 2; b.vx += dx * push * 2; b.vz += dz * push * 2;
      }
    }
    for (const z of all) if (!z.dead && (z.state === 'walk' || z.state === 'lunge' || z.state === 'claw')) move(z, z.vx * dt, z.vz * dt);
    // the cars against everyone not hanging on
    for (const z of all) {
      if (z.dead || z.state === 'cling' || z.state === 'drop') continue;
      for (const c of cars) { if (c.gone || Math.abs(c.x - z.x) > c.half + 8 || Math.abs(c.z - z.z) > c.half + 8) continue; if (contact(z, c, dt) && z.dead) break; }
    }
    // the gone are taken out
    for (let i = all.length - 1; i >= 0; i--) if (all[i].dead) { all[i] = all[all.length - 1]; all.pop(); }
    grid();
    draw();
    H_.ms = H_.ms * 0.95 + (performance.now() - t0) * 0.05;
  };

  // ---- drawing: each look's living into its instanced mesh ----
  const fill = [0, 0, 0];
  function draw() {
    fill[0] = fill[1] = fill[2] = 0;
    for (const z of all) {
      const m = meshes[z.look], i = fill[z.look]++;
      const e = m.instanceMatrix.array, a = m.geometry.attributes.zanim.array, col = m.instanceColor.array, o16 = i * 16, s = z.size;
      // where it stands, which way it faces and how far over it has fallen (on its back), as one matrix
      const sy = Math.sin(z.yaw), cy = Math.cos(z.yaw), f = -z.fall, sf = Math.sin(f), cf = Math.cos(f);
      const bob = z.state === 'walk' || z.state === 'lunge' ? Math.abs(Math.sin(z.phase)) * 0.18 : 0;
      e[o16] = cy * s; e[o16 + 1] = 0; e[o16 + 2] = -sy * s; e[o16 + 3] = 0;
      e[o16 + 4] = sy * sf * s; e[o16 + 5] = cf * s; e[o16 + 6] = cy * sf * s; e[o16 + 7] = 0;
      e[o16 + 8] = sy * cf * s; e[o16 + 9] = -sf * s; e[o16 + 10] = cy * cf * s; e[o16 + 11] = 0;
      e[o16 + 12] = z.x; e[o16 + 13] = z.y + bob + (z.fall > 0.3 && z.y <= 0 ? 0.6 : 0); e[o16 + 14] = z.z; e[o16 + 15] = 1;
      a[i * 4] = z.phase; a[i * 4 + 1] = z.L; a[i * 4 + 2] = z.state === 'cling' ? 1 : 0; a[i * 4 + 3] = z.seed;
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = z.tint;
    }
    meshes.forEach((m, k) => {
      m.count = fill[k];
      if (!fill[k]) return;
      m.instanceMatrix.needsUpdate = true; m.geometry.attributes.zanim.needsUpdate = true; m.instanceColor.needsUpdate = true;
    });
  }

  // ---- what the guns can hit: a coarse grid of who stands where, made fresh each frame ----
  const GC = 8, GM = 64, GX = Math.ceil((WX + GM * 2) / GC), GZ = Math.ceil((WZ + GM * 2) / GC);
  const head = new Int16Array(GX * GZ), next = new Int16Array(MAX * 4), who = new Int16Array(MAX * 4);
  const cellAt = (x, z) => { const i = Math.floor((x + GM) / GC), k = Math.floor((z + GM) / GC); return i < 0 || k < 0 || i >= GX || k >= GZ ? -1 : k * GX + i; };
  function grid() {
    head.fill(-1); let n = 0;
    for (let zi = 0; zi < all.length; zi++) {
      const z = all[zi];
      const r = HORDE.hitR * 1.6, i0 = Math.floor((z.x - r + GM) / GC), i1 = Math.floor((z.x + r + GM) / GC), k0 = Math.floor((z.z - r + GM) / GC), k1 = Math.floor((z.z + r + GM) / GC);
      for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
        if (i < 0 || k < 0 || i >= GX || k >= GZ || n >= who.length) continue;
        const c = k * GX + i; who[n] = zi; next[n] = head[c]; head[c] = n++;
      }
    }
  }
  // the zombie a point is inside, or null
  function at(x, y, z) {
    if (y < 0 || y > TALL + 3) return null;
    const c = cellAt(x, z); if (c < 0) return null;
    for (let n = head[c]; n >= 0; n = next[n]) {
      const q = all[who[n]]; if (!q || q.dead) continue;
      const lying = q.fall > 0.6, h = lying ? 3 : TALL * q.size + 1, r = lying ? HORDE.hitR * 1.6 : HORDE.hitR;
      if (Math.abs(q.x - x) < r && Math.abs(q.z - z) < r && y >= q.y && y < q.y + h) return q;
    }
    return null;
  }
  // A shot stops at the first point inside one, but the point it lands at is stepped back a little from there
  // (units/src/fx.js), often just outside again: so the last one struck is remembered, and a landing point right by
  // where it was struck still counts as hitting it.
  let struck = null; const sp = { x: 0, y: 0, z: 0 };
  const nearStruck = (x, y, z) => struck && !struck.dead && Math.abs(x - sp.x) < 1 && Math.abs(y - sp.y) < 1 && Math.abs(z - sp.z) < 1;
  H_.solid = (x, y, z) => {
    const q = at(x, y, z);
    if (q) { struck = q; sp.x = x; sp.y = y; sp.z = z; return true; }
    return nearStruck(x, y, z);
  };
  H_.hit = (p, dmg, owner, gun, dir) => {
    const q = at(p.x, p.y, p.z) || (nearStruck(p.x, p.y, p.z) ? struck : null); if (!q) return false;
    struck = null;
    const dx = dir ? dir.x : 0, dz = dir ? dir.z : 0;
    for (let k = 0; k < 2; k++) G.cube(p.x, p.y, p.z, dx * 6 + (Math.random() - 0.5) * 6, 3 + Math.random() * 5, dz * 6 + (Math.random() - 0.5) * 6, BLOOD[k], H * 1.4);
    q.L = Math.max(q.L, 0.6); q.vx += dx * 4; q.vz += dz * 4;
    if (owner && owner.rival) dmg *= HORDE.rivalGun / AI.dmg;   // main.js cut it down for shooting at cars
    if (gun && gun.pellets) dmg *= HORDE.pellet;
    hurt(q, dmg, owner, dx, dz, 14);
    return true;
  };
  H_.explosion = (x, y, z, reach, base, by) => {
    if (by && by.rival) base *= HORDE.rivalGun / AI.dmg;
    for (const q of all) {
      if (q.dead) continue;
      const d = Math.hypot(q.x - x, q.z - z); if (d > reach + R) continue;
      const k = 1 - Math.max(0, d - R) / reach, dx = q.x - x, dz = q.z - z, dl = d || 1;
      if (q.state === 'cling') { q.state = 'walk'; q.car = null; }
      hurt(q, base * k * 1.6, by, dx, dz, 16 + k * 30);
      if (!q.dead) fling(q, dx / dl * 30 * k, dz / dl * 30 * k, 8 + 14 * k, by);
    }
  };
  // the nearest one to a car within `range`, within `cone` radians either side of `yaw` (0: any way), or null.
  // `own`: leave out the ones at another car (shooting those hits the car)
  H_.nearest = (c, range, cone = 0, yaw = c.yaw, own = false) => {
    let best = null, bd = range;
    for (const q of all) {
      if (q.dead || (own && q.car && q.car !== c)) continue;
      const dx = q.x - c.x, dz = q.z - c.z, d = Math.hypot(dx, dz);
      if (d >= bd || (cone && Math.abs(wrap(Math.atan2(dx, dz) - yaw)) > cone)) continue;
      best = q; bd = d;
    }
    return best;
  };
  // an arc coil's zap at the nearest one within `range` of car c (main.js's arc only zaps cars): a crackle of sparks
  // along the way and `dmg` to it. False when there is none in reach.
  H_.zap = (c, range, dmg) => {
    const q = H_.nearest(c, range + c.wide); if (!q) return false;
    const n = 6, y0 = 4.2, y1 = q.y + 3.5;
    for (let i = 1; i <= n; i++) { const t = i / n; G.sparks(c.x + (q.x - c.x) * t + (Math.random() - 0.5), y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 1.5, c.z + (q.z - c.z) * t + (Math.random() - 0.5), 2, 0.6, 0.85, 1, 10); }
    G.sfx.play('arc_zap', c === G.player ? 1 : 0.7, c.x, c.z, { jitter: 0.1 });
    hurt(q, dmg, c, q.x - c.x, q.z - c.z, 18);
    return true;
  };
  // the horde on the radar: a green fleck each
  H_.radar = (Rd, s, ox, oy) => {
    Rd.fillStyle = 'rgba(150,214,96,0.9)';
    for (const q of all) if (!q.dead) Rd.fillRect(ox + q.x * s - 1, oy + q.z * s - 1, 2, 2);
  };
  H_.splat = splat;
  return H_;
}
