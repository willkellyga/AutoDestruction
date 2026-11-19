// The town's own vehicles: parked cars and buses, boats and ships, trains, and the cranes, jetties and cargo of the
// docks. They are the models in civilian/src (the army's eighth-metre cubes), not town voxels. A map's generator only
// records where each one stands (world.vehicle); this file builds them, draws them and lets the monsters wreck them.
//
// A parked car is drawn cheaply: every car of one kind and paint shares a mesh, and a car far from the camera is drawn
// from a copy made of town-sized cubes. It becomes a real unit (parts, bones, clips, damage) the moment something
// touches it. Boats, trains and cranes are few and move, so each is a unit from the start, with the same far copy.
// Lengths are town voxels (a quarter metre); a model's cubes are half of one.
import * as THREE from 'three';
import { Unit } from '../units/src/unit.js';
import { hash } from '../units/src/voxpart.js';
import { makeDebris } from '../units/src/debris.js';
import { CAR, crush, fireSpots, char } from '../civilian/src/cars.js';
import { CITY_BUS, SCHOOL_BUS } from '../civilian/src/buses.js';
import { TUGBOAT, BARGE_BOAT, TOUR_BOAT, FERRY, LINER, CARRIER, CONTAINER_SHIP, PLEASURE_BOAT, DECK_JETS, WAIST, lowSide } from '../civilian/src/boats.js';
import { EXPRESS_TRAIN, COMMUTER_TRAIN } from '../civilian/src/trains.js';
import { DOCK_CRANE, JETTY, CARGO } from '../civilian/src/dock.js';
import { JET } from '../civilian/src/jet.js';
import { makeBlockFx, K } from '../civilian/src/blockfx.js';
import { makeSfx } from '../civilian/src/sfx.js';
import * as world from './world.js';
import { wet } from './town.js';
import { hooks, cfg, blast, blowGlass, flash } from './sim.js';

const { WX, WZ, solid } = world;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// n: what wrecking one is worth, counted in town voxels like everything else he wrecks (the old voxel car was 420).
// solo: a unit of its own from the start. bonus: XP and a line on screen when he finishes one off himself.
const SPEC = {
  car: { def: CAR, n: 420 },
  bus: { def: CITY_BUS, n: 1400 },
  school: { def: SCHOOL_BUS, n: 1200 },
  cargo: { def: CARGO, n: 260 },
  jetty: { def: JETTY, n: 420, solo: true },
  crane: { def: DOCK_CRANE, n: 1600, solo: true, clip: 'Work', bonus: 60, name: 'Harbor crane', done: 'toppled' },
  tug: { def: TUGBOAT, n: 1600, solo: true },
  barge: { def: BARGE_BOAT, n: 1600, solo: true },
  pleasure: { def: PLEASURE_BOAT, n: 1500, solo: true },
  tour: { def: TOUR_BOAT, n: 2400, solo: true },
  ferry: { def: FERRY, n: 4000, solo: true, bonus: 80, name: 'Ferry', done: 'sunk' },
  liner: { def: LINER, n: 9000, solo: true, bonus: 300, name: 'Ocean liner', done: 'sunk' },
  carrier: { def: CARRIER, n: 9000, solo: true, bonus: 400, name: 'Aircraft carrier', done: 'sunk' },
  ship: { def: CONTAINER_SHIP, n: 9000, solo: true, bonus: 300, name: 'Container ship', done: 'sunk' },
  express: { def: EXPRESS_TRAIN, n: 1500, solo: true },
  commuter: { def: COMMUTER_TRAIN, n: 1500, solo: true },
};
const NEAR = 200, NEAR_SOLO = 300;   // inside this distance of the camera a model is drawn in full
const FAR_SOLO = 600;                // past this a ship or a crane's far copy is the one in bigger cubes, on every quality step
const CELL = 128;                    // parked cars are grouped by squares of the map this size, so whole groups can be left out
const BIG_PART = 9000;               // a part with more cubes than this is not rebuilt more than a few times a second
const JET_HP = 2;

// ---- the far copy: the whole model redrawn as one shell of cubes the size of the town's own, a flat colour each ----
// Returns two: [0] in cubes of one voxel, [1] in cubes of two (a quarter of the faces), for far off and for the lighter
// quality steps. Each face is four corners and two triangles, with its own normal.
function coarse(u) {
  const v = new THREE.Vector3(), box = new THREE.Box3(), list = [];
  for (const p of u.parts) {
    if (p.bone.getWorldScale(v).x < 0.5 || !p.count) continue;   // lamps that are switched off
    list.push(p);
    for (const i of [p.i0, p.i0 + p.nx]) for (const j of [p.j0, p.j0 + p.ny]) for (const k of [p.k0, p.k0 + p.nz]) box.expandByPoint(v.set(i * p.h, j * p.h, k * p.h).applyMatrix4(p.bone.matrixWorld));
  }
  const a0 = Math.floor(box.min.x) - 1, b0 = Math.floor(box.min.y) - 1, c0 = Math.floor(box.min.z) - 1;
  const X = Math.ceil(box.max.x) - a0 + 2, Y = Math.ceil(box.max.y) - b0 + 2, Z = Math.ceil(box.max.z) - c0 + 2, M = X * Y * Z;
  const cnt = new Uint16Array(M), sr = new Float32Array(M), sg = new Float32Array(M), sb = new Float32Array(M);
  for (const p of list) {
    const mw = p.bone.matrixWorld, h = p.h;
    for (let n = 0, k = 0; k < p.nz; k++) for (let j = 0; j < p.ny; j++) for (let i = 0; i < p.nx; i++, n++) {
      const c = p.col[n]; if (c < 0) continue;
      v.set((p.i0 + i + 0.5) * h, (p.j0 + j + 0.5) * h, (p.k0 + k + 0.5) * h).applyMatrix4(mw);
      const m = ((Math.floor(v.z) - c0) * Y + Math.floor(v.y) - b0) * X + Math.floor(v.x) - a0;
      if (cnt[m] < 65535) { cnt[m]++; sr[m] += (c >> 16) & 255; sg[m] += (c >> 8) & 255; sb[m] += c & 255; }
    }
  }
  const fine = { cnt, sr, sg, sb, X, Y, Z, a0, b0, c0 };
  return [shell(fine, 1, 2), shell(halved(fine), 2, 4)];
}
// the same count-and-colour grid in cells twice the size
function halved(G) {
  const a0 = Math.floor(G.a0 / 2) - 1, b0 = Math.floor(G.b0 / 2) - 1, c0 = Math.floor(G.c0 / 2) - 1;
  const X = Math.floor((G.a0 + G.X - 1) / 2) - a0 + 2, Y = Math.floor((G.b0 + G.Y - 1) / 2) - b0 + 2, Z = Math.floor((G.c0 + G.Z - 1) / 2) - c0 + 2, M = X * Y * Z;
  const cnt = new Uint32Array(M), sr = new Float32Array(M), sg = new Float32Array(M), sb = new Float32Array(M);
  for (let c = 0, n = 0; c < G.Z; c++) for (let b = 0; b < G.Y; b++) for (let a = 0; a < G.X; a++, n++) {
    if (!G.cnt[n]) continue;
    const m = ((Math.floor((c + G.c0) / 2) - c0) * Y + Math.floor((b + G.b0) / 2) - b0) * X + Math.floor((a + G.a0) / 2) - a0;
    cnt[m] += G.cnt[n]; sr[m] += G.sr[n]; sg[m] += G.sg[n]; sb[m] += G.sb[n];
  }
  return { cnt, sr, sg, sb, X, Y, Z, a0, b0, c0 };
}
// the outside of a grid as cubes of side s; a cell counts as solid with at least `need` of the model's cubes in it
function shell(G, s, need) {
  const { cnt, sr, sg, sb, X, Y, Z, a0, b0, c0 } = G, M = X * Y * Z;
  // only the outside shows: flood the air in from a corner, and whatever it cannot reach counts as solid
  const air = new Uint8Array(M), stack = [0], D = [1, -1, X, -X, X * Y, -X * Y]; air[0] = 1;
  while (stack.length) {
    const m = stack.pop(), a = m % X, b = Math.floor(m / X) % Y, c = Math.floor(m / (X * Y));
    for (let d = 0; d < 6; d++) {
      if ((d === 0 && a === X - 1) || (d === 1 && a === 0) || (d === 2 && b === Y - 1) || (d === 3 && b === 0) || (d === 4 && c === Z - 1) || (d === 5 && c === 0)) continue;
      const k = m + D[d]; if (air[k] || cnt[k] >= need) continue;
      air[k] = 1; stack.push(k);
    }
  }
  const P = [], N = [], C = [], I = [], col = new THREE.Color(), q = [0, 0, 0], nrm = [0, 0, 0];
  for (let c = 1; c < Z - 1; c++) for (let b = 1; b < Y - 1; b++) for (let a = 1; a < X - 1; a++) {
    const m = (c * Y + b) * X + a, n = cnt[m]; if (n < need) continue;
    let tinted = false;
    for (let ax = 0; ax < 3; ax++) for (const sg2 of [1, -1]) {
      if (!air[m + sg2 * D[ax * 2]]) continue;
      if (!tinted) { tinted = true; col.setRGB(sr[m] / n / 255, sg[m] / n / 255, sb[m] / n / 255, THREE.SRGBColorSpace).multiplyScalar(0.84 + 0.1 * hash(a, b, c, 5)); }
      const uu = (ax + 1) % 3, vv = (ax + 2) % 3, cs = sg2 > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [1, 1], [1, 0], [0, 1]], base = P.length / 3;
      nrm[0] = nrm[1] = nrm[2] = 0; nrm[ax] = sg2;
      for (const [cu, cv] of cs) {
        q[0] = a + a0; q[1] = b + b0; q[2] = c + c0; q[ax] += sg2 > 0 ? 1 : 0; q[uu] += cu; q[vv] += cv;
        P.push(q[0] * s, q[1] * s, q[2] * s); N.push(nrm[0], nrm[1], nrm[2]); C.push(col.r, col.g, col.b);
      }
      if (sg2 > 0) I.push(base, base + 1, base + 2, base, base + 2, base + 3); else I.push(base, base + 1, base + 2, base, base + 3, base + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(P.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
  return g;
}
// every part of a unit as it stands, in one mesh (gi 0: painted cubes, 1: the lit ones), or null if it has none
function merged(u, gi) {
  const list = [], v = new THREE.Vector3(); let nv = 0, ni = 0;
  for (const p of u.parts) { const m = p.meshes[gi]; if (!m || !m.visible || p.bone.getWorldScale(v).x < 0.5) continue; list.push(m); nv += m.geometry.getAttribute('position').count; ni += m.geometry.index.count; }
  if (!nv) return null;
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), I = new Uint32Array(ni), nm = new THREE.Matrix3(); let a = 0, b = 0;
  for (const m of list) {
    const g = m.geometry, p = g.getAttribute('position'), n = g.getAttribute('normal'), ix = g.index.array, base = a / 3; nm.getNormalMatrix(m.matrixWorld);
    C.set(g.getAttribute('color').array, a);
    for (let i = 0; i < p.count; i++, a += 3) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); P[a] = v.x; P[a + 1] = v.y; P[a + 2] = v.z; v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); N[a] = v.x; N[a + 1] = v.y; N[a + 2] = v.z; }
    for (let i = 0; i < ix.length; i++) I[b++] = ix[i] + base;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setIndex(new THREE.BufferAttribute(I, 1));
  return g;
}
// how big it is, in its own space: the footprint a foot can land on (its body), and the box anything else can reach
function sizeOf(u) {
  const body = u.parts.find((p) => p.name === 'body') || u.parts[0], h = u.def.h, box = new THREE.Box3(), inv = new THREE.Matrix4().copy(u.root.matrixWorld).invert(), b2 = new THREE.Box3();
  for (const p of u.parts) for (const m of p.meshes) if (m && m.visible) { m.geometry.computeBoundingBox(); box.union(b2.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld).applyMatrix4(inv)); }
  // the body's box, trimmed to the cubes that are really there
  let i0 = 1e9, i1 = -1e9, k0 = 1e9, k1 = -1e9;
  for (let n = 0, k = 0; k < body.nz; k++) for (let j = 0; j < body.ny; j++) for (let i = 0; i < body.nx; i++, n++) if (body.col[n] >= 0) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (k < k0) k0 = k; if (k > k1) k1 = k; }
  const r = u.rest[body.name].pos;
  return { fx0: r[0] + (body.i0 + i0) * h, fx1: r[0] + (body.i0 + i1 + 1) * h, fz0: r[2] + (body.k0 + k0) * h, fz1: r[2] + (body.k0 + k1 + 1) * h, box };
}

export function makeCivilians(o) {
  const { scene, camera, mon, game, U, R, hurt, toast, addXp } = o;
  const mats = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74, metalness: 0.04, color: new THREE.Color(1.2, 1.2, 1.2) }),   // lifted a little, as the army's are: the game's tone curve is darker than the viewer's
    new THREE.MeshBasicMaterial({ vertexColors: true })];
  const waterAt = (x, z) => (wet(Math.floor(x), Math.floor(z)) ? 0 : null);
  const fx = makeBlockFx(scene, 7000, { flash: (p, power) => flash(p.x, p.y + 3, p.z, 5 * power) }); fx.water = waterAt;
  const debris = makeDebris(scene, 6000, { at: waterAt, splash: (x, y, z) => { if (Math.random() < 0.3) { fx.block(x, y + 0.1, z, (Math.random() - 0.5) * 3, 5 + Math.random() * 6, (Math.random() - 0.5) * 3, 0.14 + Math.random() * 0.12, 1.5, K.WATER, 0.3, 0, 40); fx.foam(x, z, 0, 0, 0.3, 1.2); } } });
  const cube = (x, y, z, vx, vy, vz, c, s) => debris.spawn(x, y, z, vx, vy, vz, c, s);
  const sfx = makeSfx(camera);
  const wakeSound = () => sfx.init(); window.addEventListener('pointerdown', wakeSound); window.addEventListener('keydown', wakeSound);
  const shake = (a, p) => hooks.shake(a, p.x, p.y, p.z);

  const recs = [], live = [], cells = new Map(), variants = new Map(), grid = new Map(), fuses = [], air = [], sorties = [], rockets = [];
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), UP = new THREE.Vector3(0, 1, 0), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _s = new THREE.Vector3(1, 1, 1);
  let clock = 0, quiet = false, lodT = 0, stamp = 0, carrier = null, jetT = 26, toldJets = false;
  let nearD = NEAR, nearSoloD = NEAR_SOLO, farLvl = 0;   // the lighter quality steps draw models in full less far out, and their far copies in bigger cubes (detail() below)

  // ---- which model stands where ----
  const hx = (v, s) => hash(Math.round(v.x), s, Math.round(v.z), 17);
  const SEDAN = ['blue', 'silver', 'black', 'maroon'], HATCH = ['red', 'white', 'green', 'teal'];
  const LIVERY = world.NYC ? ['blue', 'blue', 'green'] : world.PARIS ? ['green', 'green', 'blue'] : world.TOKYO ? ['green', 'blue', 'orange'] : world.CAIRO ? ['red', 'orange', 'blue'] : ['blue', 'red', 'green', 'orange'];
  function resolve(v, all) {
    if (v.kind !== 'car') return { kind: v.kind, opts: v.opts || {} };
    if (v.taxi) return { kind: 'car', opts: { type: 'taxi', paint: 'taxi', ny: world.NYC } };
    if (v.lot < 0) {   // out on the street: now and then a bus stands there, where it has the room, or a police car
      if (hx(v, 1) < 0.3 && !all.some((w) => w !== v && Math.abs(w.x - v.x) < 36 && Math.abs(w.z - v.z) < 36)) {
        if (!world.PARIS && !world.TOKYO && !world.CAIRO && hx(v, 2) < 0.3) return { kind: 'school', opts: { type: 'school', paint: 'yellow' } };
        return { kind: 'bus', opts: { type: 'city', paint: LIVERY[Math.floor(hx(v, 3) * LIVERY.length)] } };
      }
      if (hx(v, 4) < 0.05) return { kind: 'car', opts: { type: 'police', paint: 'police' } };
    }
    const sedan = !v.bay && hx(v, 5) < 0.55, list = sedan ? SEDAN : HATCH;
    return { kind: 'car', opts: { type: sedan ? 'sedan' : 'hatch', paint: list[Math.floor(hx(v, 6) * list.length)] } };
  }
  function variantOf(kind, opts) {
    const key = kind + JSON.stringify(opts); let V = variants.get(key);
    if (V) return V;
    const u = new Unit(SPEC[kind].def, mats, { ...opts, seed: 1 }); u.root.updateWorldMatrix(true, true);
    V = { key, kind, opts, near: [merged(u, 0), merged(u, 1)], far: coarse(u), size: sizeOf(u), recs: [], farMesh: null };
    u.dispose(); variants.set(key, V); return V;
  }
  function build() {
    const all = world.vehicles;
    all.forEach((v, n) => {
      const { kind, opts } = resolve(v, all), spec = SPEC[kind]; if (!spec) return;
      const rec = { n, kind, spec, opts, x: v.x, y: v.y || 0, z: v.z, yaw: v.yaw, sin: Math.sin(v.yaw), cos: Math.cos(v.yaw), unit: null, left: spec.n, heat: 0, hitT: 0, treadT: 0, idle: 0, name: v.name || spec.name, alone: !!v.alone };
      rec.m = new THREE.Matrix4().compose(_c.set(rec.x, rec.y, rec.z), _q.setFromAxisAngle(UP, rec.yaw), _s);
      if (spec.solo) {
        const u = stand(rec, { ...opts, seed: 3 + n, low: v.low });
        rec.size = sizeOf(u); u.half = Math.round(rec.size.fz1 - rec.size.fz0) - 2;
        rec.farG = coarse(u); rec.far = new THREE.Mesh(rec.farG[farLvl], mats[0]); rec.far.receiveShadow = true; rec.far.matrixAutoUpdate = false; rec.far.matrix.copy(rec.m); rec.far.matrixWorldNeedsUpdate = true; rec.far.visible = false; scene.add(rec.far);
        u.root.position.set(rec.x, rec.y, rec.z); u.root.rotation.y = rec.yaw; scene.add(u.root);
        if (spec.clip) u.play(spec.clip, 0);
        if (kind === 'carrier') carrier = rec;
        live.push(rec);
      } else {
        const V = variantOf(kind, opts); rec.V = V; rec.size = V.size; rec.farSlot = V.recs.length; V.recs.push(rec);
        const ck = Math.floor(rec.x / CELL) + Math.floor(rec.z / CELL) * 64; let c = cells.get(ck);
        if (!c) cells.set(ck, c = { x0: Math.floor(rec.x / CELL) * CELL, z0: Math.floor(rec.z / CELL) * CELL, recs: [], meshes: [], near: false });
        rec.cell = c; c.recs.push(rec);
      }
      // how far anything on it reaches from its middle, for the look-up below
      const b = rec.size.box; rec.reach = Math.hypot(Math.max(-b.min.x, b.max.x), Math.max(-b.min.z, b.max.z));
      for (let cx = Math.floor((rec.x - rec.reach) / 64); cx <= Math.floor((rec.x + rec.reach) / 64); cx++) for (let cz = Math.floor((rec.z - rec.reach) / 64); cz <= Math.floor((rec.z + rec.reach) / 64); cz++) { const k = cx + cz * 256; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(rec); }
      recs.push(rec);
    });
    // the shared meshes: one far copy of each kind for the whole map, and the full model once for each square it stands in
    for (const V of variants.values()) {
      V.farMesh = new THREE.InstancedMesh(V.far[farLvl], mats[0], V.recs.length); V.farMesh.frustumCulled = false; V.farMesh.receiveShadow = true; scene.add(V.farMesh);
      V.recs.forEach((r) => V.farMesh.setMatrixAt(r.farSlot, r.m));
    }
    for (const c of cells.values()) {
      const by = new Map(); for (const r of c.recs) { if (!by.has(r.V)) by.set(r.V, []); by.get(r.V).push(r); }
      for (const [V, list] of by) {
        const ms = V.near.map((g, gi) => { if (!g) return null; const m = new THREE.InstancedMesh(g, mats[gi], list.length); m.castShadow = gi === 0; m.receiveShadow = gi === 0; m.visible = false; scene.add(m); c.meshes.push(m); return m; });
        list.forEach((r, i) => { r.slot = i; r.nearMeshes = ms; for (const m of ms) if (m) m.setMatrixAt(i, r.m); });
        for (const m of ms) if (m) m.computeBoundingSphere();
      }
    }
  }
  // a unit standing where the record says, not yet in the scene
  function stand(rec, opts) {
    const u = new Unit(rec.spec.def, mats, { ...opts, phase: (rec.n * 2.399) % 6.283 });
    u.root.updateWorldMatrix(true, true);
    u.home = new THREE.Vector3(rec.x, rec.y, rec.z); u.half = 0; u.heat = 0; u.rec = rec; rec.unit = u;
    const wk = u.def.wk; if (wk.wrecks && wk.wrecks.length > 1) u.wreckClip = wk.wrecks[rec.n % wk.wrecks.length];
    return u;
  }
  // ---- a parked car becomes a unit, and goes back to being a drawing if nothing came of it ----
  function draw(rec, on) {
    for (const m of rec.nearMeshes) if (m) { m.setMatrixAt(rec.slot, on ? rec.m : ZERO); m.instanceMatrix.needsUpdate = true; }
    rec.V.farMesh.setMatrixAt(rec.farSlot, on && !rec.cell.near ? rec.m : ZERO); rec.V.farMesh.instanceMatrix.needsUpdate = true;
  }
  function wake(rec) {
    if (rec.unit || rec.gone) return rec.unit;
    const u = stand(rec, { ...rec.opts, seed: 1 });
    u.root.position.set(rec.x, rec.y, rec.z); u.root.rotation.y = rec.yaw; scene.add(u.root); u.root.updateWorldMatrix(true, true);
    u.half = Math.round((rec.size.fz1 - rec.size.fz0)) - 2;   // half its length in cubes, as the viewer keeps it
    draw(rec, false); rec.idle = 0; live.push(rec); return u;
  }
  function sleep(rec) { rec.unit.dispose(); rec.unit = null; draw(rec, true); }
  const pristine = (rec) => { const u = rec.unit; return u && !u.dead && !u.gone && u.voxels === u.voxels0 && !rec.touched; };
  function touch(rec) {   // the first time a boat or crane is damaged its far copy is put away for good
    rec.touched = true; rec.idle = 0;
    if (rec.far) { rec.far.removeFromParent(); for (const g of rec.farG) g.dispose(); rec.far = rec.farG = null; rec.unit.root.visible = true; }
  }

  // ---- look-up ----
  function near(x, z, r, fn) {
    const mark = ++stamp, out = [];   // gathered first: fn may start a look-up of its own (one car setting off the next)
    for (let cx = Math.floor((x - r) / 64); cx <= Math.floor((x + r) / 64); cx++) for (let cz = Math.floor((z - r) / 64); cz <= Math.floor((z + r) / 64); cz++) {
      const list = grid.get(cx + cz * 256); if (!list) continue;
      for (const rec of list) { if (rec.stamp === mark || rec.gone) continue; rec.stamp = mark; if (Math.hypot(rec.x - x, rec.z - z) < r + rec.reach) out.push(rec); }
    }
    for (const rec of out) if (!rec.gone) fn(rec);
  }
  // a world point in a record's own space: x across it, z along it
  const local = (rec, x, z, out) => { const dx = x - rec.x, dz = z - rec.z; out.x = dx * rec.cos - dz * rec.sin; out.z = dx * rec.sin + dz * rec.cos; return out; };
  const _l = { x: 0, z: 0 };
  // how far a point is from a record's box (0 inside it)
  function gap(rec, x, y, z) {
    const b = rec.size.box; local(rec, x, z, _l);
    return Math.hypot(Math.max(b.min.x - _l.x, 0, _l.x - b.max.x), Math.max(b.min.y - (y - rec.y), 0, y - rec.y - b.max.y), Math.max(b.min.z - _l.z, 0, _l.z - b.max.z));
  }

  // ---- XP: a wrecked car counts as so many wrecked voxels, to whoever wrecked it ----
  const ARMY = {};
  function pay(rec, share, who, later) {
    const n = Math.min(rec.left, Math.ceil(rec.spec.n * share)); if (n <= 0 || game.state !== 'play') return;
    rec.left -= n;
    if (who === ARMY) return;
    if (who) { who.gain(n); return; }
    const mine = !hooks.by;
    hooks.destroyed(n, rec.x, 2, rec.z, !!later);
    if (mine && !later && rec.left <= 0 && rec.spec.bonus && !rec.told) { rec.told = true; addXp(rec.spec.bonus); toast(`${rec.name} ${rec.spec.done}`, `+${rec.spec.bonus} XP`); }
  }

  // ---- what happens to them (the same steps as the Street Vehicle Viewer, civilian/src/main.js) ----
  const centre = (u, out) => u.bones.body.localToWorld(out.set(0, 3, 0));
  function alarms(p, r) {
    let n = 0;
    near(p.x, p.z, r, (rec) => {
      if (n >= 3 || rec.kind !== 'car' || (rec.unit && (rec.unit.dead || rec.unit.clipName === 'Alarm')) || Math.random() < 0.4) return;
      const u = wake(rec); u.play('Alarm', 0.05); rec.alarmT = 6 + Math.random() * 3; n++;
    });
    if (n) sfx.play('alarm', p);
  }
  // It goes up: the fireball, the scorch, fires on the wreck, heat on whatever stands next to it, and the town round it.
  function boom(rec, who, later) {
    const u = rec.unit; u.root.updateWorldMatrix(true, true);
    const O = u.blast || [0, 4, 0]; u.bones.body.localToWorld(_c.set(O[0] * 0.5, O[1] * 0.5 + 0.5, O[2] * 0.5));
    const p = _c.clone(); p.y = Math.max(rec.y + 1.5, p.y);
    const wk = u.def.wk, big = wk.boom || 4.2, nf = wk.fires || 12, boat = wk.boat;
    fx.explode(p, big); sfx.play('boom', p, big / 4.2); shake(0.13 * big, p); if (waterAt(p.x, p.z) == null) hooks.scorch(p.x, p.z, big * 1.7);
    if (boat) { sfx.play('splash', p, 1.2); u.frothT = 9; u.plop = 1; }
    u.fire = fx.burn(u.bones.body, fireSpots(u, nf), { life: 13 + Math.random() * 6 + (nf - 12) * 0.4, size: wk.fireSize || 1 }); u.charT = 3; u.settleT = 1.6;
    near(p.x, p.z, 30, (r2) => {
      if (r2 === rec) return;
      const d = Math.hypot(r2.x - p.x, r2.z - p.z);
      if (d > 30 && !r2.spec.solo) return;
      if (r2.spec.solo) { if (gap(r2, p.x, p.y, p.z) < big * 0.9) hit(r2, p, big * 0.5, 16, who, true); return; }
      if (d < 17) hit(r2, _d.set(r2.x, 2.5, r2.z).lerp(p, 0.55).setY(2.5), 2.6 * (1 - d / 22), 16, who, true);   // the side facing the blast is torn
      const v = r2.unit;
      if (v && v.blown && !v.boomed) { v.boomed = true; fuses.push([0.25 + Math.random() * 0.3, r2, who]); return; }
      // heat builds up: the car alongside goes at once, one across the aisle only after a few blasts
      if ((!v || !v.dead) && !r2.spec.def.wk.heatproof) { r2.heat += 1 - d / 30; if (r2.heat > 0.32) { r2.heat = -9; fuses.push([0.45 + Math.random() * 0.7, r2, who]); } }
    });
    alarms(p, 70);
    // the town round it: walls and windows go, and anyone standing next to it is caught
    const gr = big * 1.15;
    quiet = true; try { blast(p.x, Math.max(2, p.y), p.z, gr, { push: 32, core: 0.5, maxDebris: 120, tough: 0.5 }); } finally { quiet = false; }
    if (cfg.glass) blowGlass(p.x, p.y, p.z, gr * 3, 90);
    hooks.explosion(p.x, p.y, p.z, gr);
    pay(rec, 1, who, later);
  }
  function kill(rec, who) {   // blown up where it stands
    const u = wake(rec); if (!u || u.blown || u.gone) return;
    touch(rec);
    if (u.crushed && !u.def.wk.recrush) { u.fire = u.fire || fx.burn(u.bones.body, fireSpots(u, 6), { life: 8, size: 0.8 }); return; }   // a flattened car only burns
    if (u.crushed) u.wreckClip = null;
    if (u.dead) u.def.onKill(u, centre(u, new THREE.Vector3()), 3, cube); else u.kill(centre(u, new THREE.Vector3()), 3, cube);
    u.boomed = true; boom(rec, who, true);
  }
  // a blow at a point: cubes are knocked out of whatever is within r of it, and it may go up
  function hit(rec, p, r, push, who, later) {
    if (r <= 0.3 || rec.gone) return 0;
    const u = wake(rec); if (!u || u.gone) return 0;
    const n = u.hit(p, r, cube, push);
    if (n) { touch(rec); if (u.blown && !u.boomed) { u.boomed = true; boom(rec, who, later); } else if (!u.blown && Math.random() < 0.3) sfx.play('clang', p, 0.6); }
    return n;
  }
  // a foot comes down on it at (lx, lz) in its own space
  const canCrush = (u) => !u.gone && (u.def.wk.recrush ? (u.crushes ? u.crushes.length : 0) < 6 : !u.crushed);
  function tread(rec, lx, lz, who) {
    const u = wake(rec); if (!u || !canCrush(u)) return;
    const s = rec.size, fz = clamp(lz, s.fz0 + 5, s.fz1 - 5) * 2, fxc = clamp(lx, s.fx0, s.fx1) * 2;
    if (u.crushes && u.crushes.some((c) => Math.abs(c[1] - fz) < 26)) return;   // that part of it is flat already
    touch(rec); u.wreckClip = null;
    const first = !u.crushed, wk = u.def.wk, boat = wk.boat || wk.splash;
    crush(u, cube, u.def.wk.recrush ? fxc : 0, fz);
    const p = u.bones.body.localToWorld(new THREE.Vector3(0, 0, fz * 0.5)).setY(rec.y + 1);
    sfx.play('crunch', p); sfx.play('glass', p, 0.8); shake(0.25, p);
    if (boat) { fx.splash(p, 300, 1.7, 10); fx.sparks(p, 8, 14); sfx.play('splash', p, 1.5); u.frothT = 5; u.frothZ = fz; }
    else { fx.dust(p, 50, 20); fx.sparks(p, 12, 16); }
    if (u.fire && !wk.recrush) { u.fire.life = Math.min(u.fire.life, u.fire.t + 1.5); fx.puff(p, 16); }   // it stamps the fire out
    else if (u.fire) { u.fire.spots = fireSpots(u, wk.fires); fx.puff(p, 16); }
    else if (!boat && Math.random() < 0.25) u.leakT = 0.8;   // now and then the squashed tank catches
    pay(rec, wk.recrush ? 0.3 : 1, who, false);
    if (wk.recrush && u.crushes && u.crushes.length >= 3 && !u.blown) fuses.push([0.7, rec, who]);   // three feet through it finish it
    if (first) alarms(p, 50);
  }

  // ---- the monsters' side: every blow on the town comes through sim's blast ----
  hooks.blast = (cx, cy, cz, r, bo) => {
    if (quiet || !recs.length) return;
    const who = hooks.by ? { gain: hooks.by } : null;
    if (bo.only) {   // a sweep along the ground that only takes street furniture: his charge, the stomp's ring, a pounce
      if (bo.only !== o.PROPS) return;
      near(cx, cz, r, (rec) => {
        if (clock - rec.hitT < 0.14) return;
        const b = rec.size.box; local(rec, cx, cz, _l);
        const qx = clamp(_l.x, b.min.x, b.max.x), qz = clamp(_l.z, b.min.z, b.max.z), d = Math.hypot(_l.x - qx, _l.z - qz); if (d > r) return;
        rec.hitT = clock;
        _d.set(rec.x + qx * rec.cos + qz * rec.sin, rec.y + 2.5, rec.z - qx * rec.sin + qz * rec.cos);
        hit(rec, _d, Math.min(5.5, 2.2 + (r - d) * 0.5), 18, who, false);
      });
      return;
    }
    const ys = bo.ys || 1, rr = r * 1.05;
    near(cx, cz, rr, (rec) => {
      if (cy - rr / ys > rec.y + rec.size.box.max.y + 1 || gap(rec, cx, cy, cz) > rr) return;
      hit(rec, _d.set(cx, cy, cz), rr * 0.85, bo.push ?? 12, who, false);
    });
    // a jet caught in it
    for (const j of air) if (!j.dead && Math.hypot(j.x - cx, j.y - cy, j.z - cz) < r + 7) damageJet(j, 3);
  };
  // feet: the player, the rivals and the army's tanks walk and roll over whatever is in the road
  function feet() {
    const W = [];
    if (game.state === 'play' && mon.y < 2) W.push([mon.x, mon.z, R(), null]);
    for (const rv of o.rivals()) if (rv.alive) W.push([rv.x, rv.z, rv.rad, rv]);
    for (const t of o.tanks()) if (!t.dead && t.kind === 'tank') W.push([t.x, t.z, 7, ARMY]);
    for (const [x, z, r, who] of W) near(x, z, r, (rec) => {
      const s = rec.size; local(rec, x, z, _l);
      const k = who === ARMY ? 0.2 : 0.55;   // how much of his foot has to be over it
      if (_l.x < s.fx0 - r * k || _l.x > s.fx1 + r * k || _l.z < s.fz0 - r * k || _l.z > s.fz1 + r * k) return;
      if (r < 4.2 && who !== ARMY) {   // too small to flatten it: he kicks a hole in it as he pushes past
        if (clock - rec.treadT < 0.3) return; rec.treadT = clock;
        hit(rec, _d.set(x, rec.y + 1.5 + r * 0.3, z), r * 0.95, 10, who, false);
      } else tread(rec, _l.x, _l.z, who);
    });
  }

  // ---- boats: what one does to the water as it goes down or is stepped on ----
  function afloat(rec, dt) {
    const u = rec.unit, s = rec.size, L = (s.fz1 - s.fz0) / 2, B = u.def.wk.beam, Rn = Math.random, WL = rec.y;
    const at = (x, z) => u.root.localToWorld(_w.set(x, 0, z));
    if (u.frothT > 0) {
      u.frothT -= dt; const k = Math.min(1, u.frothT / 3);
      for (let n = Rn() < dt * 70 * k ? 1 : 0; n > 0; n--) {
        const here = u.frothZ != null && Rn() < 0.6, z = here ? u.frothZ * 0.5 + (Rn() - 0.5) * 16 : (Rn() * 2 - 1) * L, q = at((Rn() < 0.5 ? 1 : -1) * B * (here ? 0.5 + Rn() * 0.6 : 0.85 + Rn() * 0.3), z);
        fx.foam(q.x, q.z, (Rn() - 0.5) * 2, (Rn() - 0.5) * 2, 0.36, 1.8);
        if (Rn() < 0.25) fx.block(q.x, WL + 0.2, q.z, (Rn() - 0.5) * 3, 4 + Rn() * 6, (Rn() - 0.5) * 3, 0.14 + Rn() * 0.12, 1.5, K.WATER, 0.3, 0, 40);
      }
    }
    const pl = u.def.wk.plop || { pre: 'c', n: 5, t0: 2.9, dt: 0.55, size: 90 };
    if (u.blown && u.clipName === 'WreckSink' && u.plop <= pl.n && u.bones[pl.pre + u.plop] && u.t > pl.t0 + u.plop * pl.dt) {   // the boxes, or the jets, going over the side
      const q = u.bones[pl.pre + u.plop].getWorldPosition(_w); q.y = WL; fx.splash(q, pl.size, 1.1 * Math.sqrt(pl.size / 90), 5 * Math.sqrt(pl.size / 90)); sfx.play('splash', q, 0.9); u.plop++;
    }
    if (u.blown && u.clipName === 'WreckTurtle' && u.t > 1.3 && u.t < 3.4 && Rn() < dt * 26) { const q = at(lowSide(u) * B * (0.9 + Rn() * 0.8), (Rn() * 2 - 1) * L * 0.5); q.y = WL; fx.splash(q, 26, 0.9, 3); sfx.play('splash', q, 0.7); }
    if (u.blown && u.clipName === 'WreckTurtle' && u.fire && u.t > 2.2 && !u.doused) { u.doused = true; u.fire.life = Math.min(u.fire.life, u.fire.t + 1.2); fx.puff(at(0, 0).setY(WL + 1), 26, K.STEAM, 0.5); sfx.play('hiss', u.root.position); }
    if (u.fire && u.fire.hiss) { u.fire.hiss = false; sfx.play('hiss', u.root.position, 0.8); }
  }

  // ---- each frame ----
  function stepUnit(rec, dt) {
    const u = rec.unit;
    // a big hull is rebuilt at most a few times a second, however fast the blows land
    for (const p of u.parts) if (p.count > BIG_PART || p.owed) {
      if (p.dirty) { if (clock - (p.builtAt || -9) < 0.22) { p.dirty = false; p.owed = true; } else p.builtAt = clock; }
      else if (p.owed && clock - p.builtAt >= 0.22) { p.owed = false; p.dirty = true; p.builtAt = clock; }
    }
    u.update(dt);
    if (u.def.wk.boat) afloat(rec, dt);
    if (!u.dead && rec.alarmT > 0) { rec.alarmT -= dt; if (rec.alarmT <= 0) u.play(u.def.start, 0.3); }
    if (u.leakT > 0) { u.leakT -= dt; if (u.leakT <= 0 && !u.blown) { const p = u.bones.body.localToWorld(new THREE.Vector3(0, 3, (u.crushes ? u.crushes[u.crushes.length - 1][1] : 0) * 0.5)); fx.explode(p.setY(rec.y + 1.2), 2.2); sfx.play('boom', p, 0.5); u.fire = fx.burn(u.bones.body, fireSpots(u, 8), { life: 9, size: 0.85 }); } }
    if (u.settleT > 0) { u.settleT -= dt; if (u.settleT <= 0 && u.fire && !u.crushed) u.fire.spots = fireSpots(u, u.def.wk.fires || 12); }   // once it has come to rest the fire moves to whatever is now on top
    if (u.fire && u.blown && u.charT > 0 && u.fire.t > u.charT && u.fire.t < u.fire.life) { u.charT += 3.5; char(u, u.def.wk.char ?? 0.13); }   // a burning wreck goes on charring
  }
  function lod() {
    const cx = camera.position.x, cz = camera.position.z, cy = camera.position.y;
    for (const c of cells.values()) {
      const d = Math.hypot(Math.max(c.x0 - cx, 0, cx - c.x0 - CELL), Math.max(c.z0 - cz, 0, cz - c.z0 - CELL), cy * 0.5), want = d < (c.near ? nearD + 30 : nearD);
      if (want === c.near) continue;
      c.near = want; for (const m of c.meshes) m.visible = want;
      for (const r of c.recs) if (!r.unit && !r.gone) { r.V.farMesh.setMatrixAt(r.farSlot, want ? ZERO : r.m); r.V.farMesh.instanceMatrix.needsUpdate = true; }
    }
    for (const rec of live) if (rec.far) { const d = Math.hypot(rec.x - cx, rec.z - cz) - rec.reach, want = d < (rec.unit.root.visible ? nearSoloD + 40 : nearSoloD); rec.unit.root.visible = want; rec.far.visible = !want; if (!want) { const g = rec.farG[farLvl || d > FAR_SOLO ? 1 : 0]; if (rec.far.geometry !== g) rec.far.geometry = g; } }
  }
  function update(dt, playing) {
    if (!(dt >= 0)) dt = 0;   // the very first frame has no time step yet
    clock += dt; lodT -= dt; if (lodT <= 0) { lodT = 0.2; lod(); }
    sfx.on = !o.muted();
    if (playing) { feet(); stepJets(dt); }
    for (let i = live.length - 1; i >= 0; i--) {
      const rec = live[i], u = rec.unit;
      if (rec.far && !u.root.visible) continue;   // far off and untouched: its far copy stands in, and it need not move
      stepUnit(rec, dt);
      if (rec.spec.solo) continue;
      // a car that was only woken (an alarm, a near miss) is put back; a wreck lies a while, then crumbles
      if (pristine(rec) && !(rec.alarmT > 0)) { rec.idle += dt; if (rec.idle > 2) { sleep(rec); live.splice(i, 1); } continue; }
      if (u.dead) {
        rec.idle += dt; const burning = u.fire && u.fire.t < u.fire.life + 3;
        if (!u.gone && !burning && rec.idle > (u.crushed && !u.blown ? 70 : 45)) u.burst(cube, null, 5, 0.15);
        if (u.gone) { pay(rec, 1, ARMY, true); u.dispose(); rec.unit = null; rec.gone = true; live.splice(i, 1); }
      }
    }
    for (let i = fuses.length - 1; i >= 0; i--) {
      fuses[i][0] -= dt; if (fuses[i][0] > 0) continue;
      const [, rec, who] = fuses[i]; fuses.splice(i, 1);
      if (typeof rec === 'function') { rec(); continue; }
      if (rec.gone) continue;
      const u = rec.unit; if (u && u.blown) boom(rec, who, true); else kill(rec, who);
    }
    if (fx.fires.length && Math.random() < dt * 14) sfx.play('crackle', fx.fires[Math.floor(Math.random() * fx.fires.length)].obj.getWorldPosition(_c), 0.8);
    debris.update(dt); fx.update(dt);
  }

  // ---- the carrier's jets. The two on her catapults take off in turn, make a strafing pass at the monster and fly
  // off; a fresh one is brought up in its place. A deck jet is a part of the carrier; when it launches its cubes are
  // taken out of that part and a JET unit is stood exactly where it was (the viewer's launch and stepSortie). ----
  const tall = () => 9.6 * U * mon.S, chest = (out) => out.set(mon.x, mon.y + tall() * 0.6, mon.z);
  function harm(d) {
    if (game.state !== 'play' || mon.chargeT > 0 || d <= 0) return;
    if (d >= 2.5) { hurt(d); return; }
    mon.hp -= d; mon.hurtT = Math.max(mon.hurtT, 0.12); if (mon.hp <= 0) hurt(0.01);
  }
  function launch() {
    const cv = carrier && carrier.unit; if (!cv || cv.dead || cv.crushed) return false;
    cv.away = cv.away || [];
    const n = [0, 1].find((m) => !cv.away[m]); if (n == null) return false;
    const part = cv.parts.find((p) => p.name === 'p' + (n + 1)); if (!part || part.count < 5800) return false;   // hit: it is going nowhere
    touch(carrier);
    cv.away[n] = { col: part.col.slice(), count: part.count }; part.col.fill(-1); part.count = 0; part.dirty = true;
    const u = new Unit(JET, mats, { paint: DECK_JETS[n][2], seed: 40 + n });
    scene.add(u.root); u.play('Launch', 0);
    const s = { u, n, cv, t: 0, phase: 'deck', v: 0, yaw: 0, pitch: 0, bank: 0, wp: 0, wps: null, gun: 0, salvo: 0, roll: 0, vy: 0, hp: JET_HP, x: 0, y: 0, z: 0, dead: true, jet: true };
    sorties.push(s); air.push(s); stepSortie(s, 0); sfx.play('jet', u.root.position, 0.7);
    if (!toldJets) { toldJets = true; toast('Jets incoming', 'Burn them down, or sink the carrier'); }
    return true;
  }
  function endSortie(s, lost) {
    sorties.splice(sorties.indexOf(s), 1); air.splice(air.indexOf(s), 1); s.dead = true; s.u.dispose();
    // a fresh jet comes up to the catapult, unless she has been wrecked or stepped on meanwhile
    fuses.push([lost ? 9 : 4, () => { const cv = s.cv, part = cv.parts.find((p) => p.name === 'p' + (s.n + 1)), sv = cv.away && cv.away[s.n]; if (!sv || cv.dead || cv.gone) return; part.col.set(sv.col); part.count = sv.count; part.dirty = true; cv.away[s.n] = null; }]);
  }
  function damageJet(s, d) {
    if (s.phase !== 'air' || !(d > 0)) return;
    if (d >= 1 && mon.y + tall() + 10 < s.y) return;   // out of reach of anything but his breath
    s.hp -= d; s.u.hit(s.u.root.position, 1.2 + d, cube, 14);
    if (s.hp > 0) return;
    s.phase = 'down'; s.dead = true; s.vy = 6; s.u.play('Crash', 0.05); fx.explode(s.u.root.position, 2.6); sfx.play('boom', s.u.root.position, 0.7);
    if (game.state === 'play') { addXp(160); toast('Jet shot down', '+160 XP'); }
  }
  // the height of the roofs in 32-voxel squares (as the town was built), so a jet keeps above the towers on its way round
  const RC = 32, RW = Math.ceil(WX / RC), RH = Math.ceil(WZ / RC), roofs = new Uint16Array(RW * RH);
  for (const b of world.bodies) {
    if (!b || !(b.x1 >= b.x0) || !(b.y1 > 0)) continue;
    for (let cz = Math.max(0, Math.floor(b.z0 / RC)); cz <= Math.min(RH - 1, Math.floor(b.z1 / RC)); cz++) for (let cx = Math.max(0, Math.floor(b.x0 / RC)); cx <= Math.min(RW - 1, Math.floor(b.x1 / RC)); cx++) if (b.y1 > roofs[cx + cz * RW]) roofs[cx + cz * RW] = b.y1;
  }
  // (a square is looked at again every few seconds, in case what stood there has come down since)
  const roofT = new Float32Array(RW * RH).fill(-99);
  const roofAt = (x, z) => {
    const cx = Math.floor(x / RC), cz = Math.floor(z / RC); if (cx < 0 || cz < 0 || cx >= RW || cz >= RH) return 0;
    const i = cx + cz * RW;
    if (roofs[i] && clock - roofT[i] > 6) {
      roofT[i] = clock; let y = Math.min(roofs[i], world.WY - 1);
      scan: for (; y > 0; y--) for (let dz = 0; dz < RC; dz++) for (let dx = 0; dx < RC; dx++) if (solid(cx * RC + dx, y, cz * RC + dz)) break scan;   // every column: a mast or a torch counts
      roofs[i] = y;
    }
    return roofs[i];
  };
  function stepSortie(s, dt) {
    const { u, cv } = s, pos = u.root.position, Rn = Math.random; s.t += dt; u.update(dt);
    if (s.phase === 'deck') {            // still on her deck: it rides with her while the wings come down and the burners light
      const bone = cv.bones['p' + (s.n + 1)]; bone.updateWorldMatrix(true, false); bone.matrixWorld.decompose(pos, u.root.quaternion, _d);
      if (s.n === 1) u.root.quaternion.multiply(_q.setFromAxisAngle(UP, WAIST * smooth(s.t / 1.3)));                // the waist catapult points out to port
      if (cv.dead) { u.burst(cube, null, 16); fx.explode(pos, 3); endSortie(s, true); return; }                      // she went up under it
      if (s.t >= 1.9) { s.phase = 'cat'; s.yaw = _e.setFromQuaternion(u.root.quaternion, 'YXZ').y; s.run = 0; s.len = s.n === 0 ? 38 : 47; sfx.play('cat', pos, 1); }
    } else if (s.phase === 'cat') {      // the catapult stroke: steam along the track, and it is flying by the bow
      s.v = Math.min(74, s.v + 100 * dt); s.run += s.v * dt; pos.x += Math.sin(s.yaw) * s.v * dt; pos.z += Math.cos(s.yaw) * s.v * dt;
      u.root.rotation.set(0, s.yaw, 0, 'YXZ');
      for (let m = Rn() < dt * 90 ? 2 : 0; m > 0; m--) fx.block(pos.x - Math.sin(s.yaw) * (4 + Rn() * 10) + (Rn() - 0.5) * 2, pos.y + 0.4, pos.z - Math.cos(s.yaw) * (4 + Rn() * 10) + (Rn() - 0.5) * 2, (Rn() - 0.5) * 3, 2 + Rn() * 3, (Rn() - 0.5) * 3, 0.5 + Rn() * 0.5, 0.8 + Rn() * 0.8, K.STEAM, 1.5, 1.5);
      if (s.run >= s.len) {
        s.phase = 'air'; s.dead = false; const f = [Math.sin(s.yaw), Math.cos(s.yaw)];
        // out ahead and up over the rooftops, round to a point well off from him, then down at him
        // (of the lines in on that side, it takes the one with the lowest roofs under it and beyond him)
        const a0 = Math.atan2(pos.x - mon.x, pos.z - mon.z) + (s.n ? -0.7 : 0.7); let a = a0, best = 1e9;
        for (const k of [0, 1, -1, 2, -2, 3]) {
          const b = a0 + k * 0.3, sb = Math.sin(b), cb = Math.cos(b); let top = Math.abs(k) * 6;
          for (let d = -200; d <= 300; d += 30) top = Math.max(top, roofAt(mon.x + sb * d, mon.z + cb * d) + Math.abs(k) * 6);
          if (top < best) { best = top; a = b; }
        }
        s.wps = [[pos.x + f[0] * 150, 120, pos.z + f[1] * 150], [mon.x + Math.sin(a) * 420, 150, mon.z + Math.cos(a) * 420], [mon.x, mon.y + 20, mon.z, 'gun']];
      }
    } else if (s.phase === 'air') {
      if (u.clipName === 'Launch' && s.t > 4.6) u.play('Fly', 0.3);
      const W = s.wps[s.wp], gun = W[3] === 'gun';
      if (gun && !s.out) { chest(_c); W[0] += (_c.x - W[0]) * Math.min(1, dt * 1.2); W[1] += (_c.y - W[1]) * Math.min(1, dt * 1.2); W[2] += (_c.z - W[2]) * Math.min(1, dt * 1.2); }   // he can move: the pilot follows, a little behind
      const dx = W[0] - pos.x, dy = W[1] - pos.y, dz = W[2] - pos.z, hd = Math.hypot(dx, dz);
      const err = wrap(Math.atan2(dx, dz) - s.yaw), rate = clamp(err * 1.7, -0.8, 0.8);
      // a tower in the way: pull up over it
      const fwx = Math.sin(s.yaw), fwz = Math.cos(s.yaw); let block = false;
      for (const a of [40, 80, 120]) if (solid(Math.floor(pos.x + fwx * a), Math.floor(Math.max(1, pos.y + Math.sin(s.pitch) * a - 6)), Math.floor(pos.z + fwz * a))) { block = !(gun && hd < a + 30); break; }
      // and it never goes down among the towers: it keeps above every roof ahead of it and on the side it is turning to
      // (it can climb steeply, so a far roof may still stand higher), and comes at him over them. If something ahead
      // stands too high to climb over in time, it turns to the side where the roofs are lower.
      const probe = (yaw) => { const sx = Math.sin(yaw), cz = Math.cos(yaw); let n = 0; for (let a = 0; a <= 360; a += 30) n = Math.max(n, roofAt(pos.x + sx * a, pos.z + cz * a) + 16 - Math.max(0, a - 70) * 0.5); return n; };
      let turn = rate; const ahead = probe(s.yaw);
      if (pos.y < ahead - 6) { const L = probe(s.yaw + 0.7), Rt = probe(s.yaw - 0.7); if (Math.min(L, Rt) < ahead - 4) turn = L < Rt ? 0.8 : -0.8; }
      const need = Math.max(ahead, turn ? probe(s.yaw + Math.sign(turn) * 0.5) : 0), near = pos.y < need + 12;
      let want = clamp(Math.atan2(dy, hd) * (gun ? 1 : 1.5), -0.5, 0.45);
      if (near) want = Math.max(want, clamp((need + 10 - pos.y) * 0.08, -0.1, 0.75));
      if (block) want = Math.max(want, 0.6);
      s.yaw += turn * dt; s.bank += (-turn * 1.1 - s.bank) * Math.min(1, dt * 3);
      s.pitch += (want - s.pitch) * Math.min(1, dt * (block || (near && want > s.pitch) ? 3.6 : 1.8));
      const cp = Math.cos(s.pitch), v = 74; pos.x += Math.sin(s.yaw) * cp * v * dt; pos.y += Math.sin(s.pitch) * v * dt; pos.z += Math.cos(s.yaw) * cp * v * dt;
      u.root.rotation.set(-s.pitch, s.yaw, s.bank, 'YXZ');
      if (gun && !s.out) {
        // it fires with him in its sights and nothing standing between them
        let on = hd < 300 && hd > 120 && Math.abs(err) < 0.12;
        if (on) { const d = Math.hypot(dx, dy, dz), end = d - R() - 8; for (let q = 12; q < end; q += 8) if (solid(Math.floor(pos.x + dx / d * q), Math.floor(pos.y + dy / d * q), Math.floor(pos.z + dz / d * q))) { on = false; break; } }
        if (on !== (u.clipName === 'Fire') && u.clipName !== 'Launch') u.play(on ? 'Fire' : 'Fly', 0.05);
        if (on) {                        // the gun: a stream of tracers walking on to him; then the rocket pods, two at a time
          s.gun -= dt; const d = Math.hypot(dx, dy, dz), ux = dx / d, uy = dy / d, uz = dz / d, onHim = Math.hypot(W[0] - mon.x, W[2] - mon.z) < R() + 3;
          while (s.gun <= 0) {
            s.gun += 0.04; const q = u.bones.flash.getWorldPosition(_w), j = () => (Rn() - 0.5) * 0.03, T = 300, k0 = (a) => a + (Rn() - 0.5) * 9;
            fx.block(q.x, q.y, q.z, (ux + j()) * T, (uy + j()) * T, (uz + j()) * T, 0.55, d / T, K.SPARK, 0, 0, 0);
            for (let m = 0; m < 2; m++) fx.block(k0(W[0]), W[1] + (Rn() - 0.5) * 14, k0(W[2]), (Rn() - 0.5) * 14, Rn() * 12, (Rn() - 0.5) * 14, 0.22 + Rn() * 0.2, 0.3 + Rn() * 0.3, m ? K.DUST : K.SPARK, 2, 0, 30, d / T);
            sfx.play('gun', q, 0.7); if (onHim) harm(0.035);
          }
          if (hd < 230 && s.salvo < 3 && s.t > (s.nextSalvo || 0)) { s.salvo++; s.nextSalvo = s.t + 0.32; for (const side of [1, -1]) { const q = u.bones.body.localToWorld(_w.set(side * 5.5, 4, -3)); rockets.push({ p: q.clone(), v: new THREE.Vector3(ux, uy, uz).multiplyScalar(74), to: new THREE.Vector3(W[0] + (Rn() - 0.5) * 8, W[1] + (Rn() - 0.5) * 12, W[2] + (Rn() - 0.5) * 8), t: 0 }); } sfx.play('cat', pos, 0.6); }
        }
        if (hd < 120) {                  // it pulls up over his head, then turns away and climbs out
          const by = s.yaw + (s.n ? -0.8 : 0.8); s.out = true;
          s.wps.push([pos.x + fwx * 270, 190, pos.z + fwz * 270], [pos.x + fwx * 270 + Math.sin(by) * 1500, 220, pos.z + fwz * 270 + Math.cos(by) * 1500]); s.wp++;
          if (u.clipName === 'Fire') u.play('Fly', 0.1); sfx.play('jet', pos, 1);
        }
      } else if (hd < 45 && s.wp < s.wps.length - 1) s.wp++;
      if (solid(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z)) && pos.y > 3) { s.phase = 'down'; s.dead = true; s.vy = 0; pos.y = Math.max(pos.y, 4); }   // it has flown into a tower
      if (s.out && (pos.x < -300 || pos.z < -300 || pos.x > WX + 300 || pos.z > WZ + 300 || s.t > 70)) { endSortie(s, false); return; }
    } else {                             // shot down: it rolls, trails fire and smoke, and goes in
      s.vy -= 34 * dt; s.roll += 5.5 * dt; s.pitch += (-0.9 - s.pitch) * Math.min(1, dt * 0.9);
      pos.x += Math.sin(s.yaw) * 58 * dt; pos.z += Math.cos(s.yaw) * 58 * dt; pos.y += s.vy * dt;
      u.root.rotation.set(-s.pitch, s.yaw, s.bank + s.roll, 'YXZ');
      for (let m = Rn() < dt * 60 ? 2 : 0; m > 0; m--) fx.block(pos.x + (Rn() - 0.5) * 2, pos.y + 4, pos.z + (Rn() - 0.5) * 2, (Rn() - 0.5) * 3, 2 + Rn() * 3, (Rn() - 0.5) * 3, 0.6 + Rn() * 0.7, 1.2 + Rn() * 1.2, m > 1 ? K.SMOKE : K.FIRE, 1, 1.5);
      const inside = pos.x > 1 && pos.z > 1 && pos.x < WX - 1 && pos.z < WZ - 1, wall = inside && solid(Math.floor(pos.x), Math.floor(Math.max(0, pos.y)), Math.floor(pos.z));
      if (pos.y <= 1.5 || wall) {
        pos.y = Math.max(1.5, pos.y); u.burst(cube, null, 22); fx.explode(pos, 5.5); shake(0.6, pos); sfx.play('boom', pos, 1);
        if (inside) { if (waterAt(pos.x, pos.z) != null && !wall) { fx.splash(pos, 300, 1.8, 9); sfx.play('splash', pos, 1.2); } else hooks.scorch(pos.x, pos.z, 9); blast(pos.x, Math.max(2, pos.y), pos.z, 7, { push: 30, core: 0.5, maxDebris: 160, tough: 0.4 }); }
        endSortie(s, true); return;
      }
    }
    s.x = pos.x; s.y = pos.y; s.z = pos.z;
  }
  function stepJets(dt) {
    // she sends them once the army is out in strength, one at a time
    if (carrier && carrier.unit && !carrier.unit.dead && (hooks.heat ? hooks.heat() : 0) > 0.22) { jetT -= dt; if (jetT <= 0) { jetT = sorties.length ? 12 : launch() ? 34 + Math.random() * 14 : 8; } }
    for (const s of [...sorties]) stepSortie(s, dt);
    for (let i = rockets.length - 1; i >= 0; i--) {      // rockets: they speed up, trail smoke and burst on him, or on the street where he was
      const r = rockets[i]; r.t += dt; const d = _d.copy(r.to).sub(r.p), len = d.length(), sp = Math.min(240, 74 + r.t * 420);
      r.v.lerp(d.multiplyScalar(sp / (len || 1)), Math.min(1, dt * 9)); r.p.addScaledVector(r.v, dt);
      fx.block(r.p.x, r.p.y, r.p.z, 0, 0, 0, 0.5, 0.12, K.FIRE, 0, 0); if (Math.random() < dt * 70) fx.block(r.p.x, r.p.y, r.p.z, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, 0.4 + Math.random() * 0.4, 0.9 + Math.random() * 0.8, K.SMOKE, 1, 1);
      if (len < sp * dt * 1.5 || r.t > 4) {
        fx.explode(r.p, 2.4); shake(0.25, r.p); sfx.play('boom', r.p, 0.55); rockets.splice(i, 1);
        if (Math.hypot(r.p.x - mon.x, r.p.z - mon.z) < R() + 4 && r.p.y < mon.y + tall() + 4) harm(1.2);
        else blast(r.p.x, Math.max(1, r.p.y), r.p.z, 4, { push: 22, core: 0.5, maxDebris: 80, tough: 0.4 });
      }
    }
  }

  build();
  const api = { recs, live, variants, cells, air, sorties, rockets, fx, sfx, debris, update, damageJet, launch, kill, hit, tread, wake, near,
    detail(k) {
      nearD = NEAR * k; nearSoloD = NEAR_SOLO * k; lodT = 0;
      const l = k < 1 ? 1 : 0; if (l === farLvl) return;
      farLvl = l; for (const V of variants.values()) if (V.farMesh) V.farMesh.geometry = V.far[l];
    },
    get carrier() { return carrier; },
    counts() { const n = {}; for (const r of recs) n[r.kind] = (n[r.kind] || 0) + 1; return n; } };
  window.__civ = api;
  return api;
}
