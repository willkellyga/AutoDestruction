// Two-legged rivals built on Chompers' own skeleton (kaiju/src/model.js PARTS: same bone names, pivots and rest angles), so every clip
// in kaiju/src/anim.js plays on them unchanged.
// Most of a biped rival is sculpted as one shape in rest space (the skeleton's bind pose, feet on y = 0, facing +Z) and each voxel is
// given to the bone whose segment it sits nearest (`owner`). Parts that are easier to shape in their own space (hands, feet) give a
// local `fill` instead and own all of their box.
// A rival may instead give `layers`: whole solids in rest space (a torso, an arm, a kilt), each with a `weights` function that says
// how much of each bone a point follows. Those are drawn as one skin that bends at the joints, so nothing can split apart there;
// layers overlap each other freely (an arm's shoulder sits inside the torso). Hands, feet and heads stay rigid parts on their bones.
import * as THREE from 'three';
import { PARTS as SKELETON } from '../../kaiju/src/model.js';
import { buildPart, GLOW } from './vox.js';

export const FORCE = { bone: null };
// While a young stage's sculpt is being sampled, `th` says how much the part has been shrunk (1 / its scale), so the sculpt can keep
// thin things (a belt, cloth, a rim) at least a voxel or two thick. `unit` is the stage's overall size against the adult.
export const STAGE = { th: 1 };   // a sculpt can set this while colouring a voxel, to hand that voxel to a given bone

const _v = new THREE.Vector3();
function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l2 = dx * dx + dy * dy + dz * dz || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y, a.z + dz * t - p.z);
}

// spec: { name, world(x, y, z) -> colour or -1, seg: { bone: [[ax,ay,az],[bx,by,bz], r] }, local: { bone: { box, fill } },
//         box: { bone: [x0,y0,z0,x1,y1,z1] in rest space }, glow, glowBase }
// Where each joint of a rig sits in the rest pose, for a sculpt to hang its shapes on: { bone: [x, y, z] }, plus `dir(bone, v)`, which
// turns a direction given in a bone's own space into rest space.
export function restJoints(rig = {}) {
  const root = new THREE.Group(), bones = {};
  for (const def of SKELETON) {
    const b = new THREE.Group(); b.position.fromArray((rig.pivot && rig.pivot[def.name]) || def.pivot);
    const r = (rig.rest && rig.rest[def.name]) || def.rest || [0, 0, 0]; b.rotation.set(r[0], r[1], r[2], 'YXZ');
    (def.parent ? bones[def.parent] : root).add(b); bones[def.name] = b;
  }
  root.updateMatrixWorld(true);
  const J = {}; for (const n in bones) J[n] = bones[n].getWorldPosition(new THREE.Vector3()).toArray();
  J.at = (bone, v) => new THREE.Vector3(...v).applyMatrix4(bones[bone].matrixWorld).toArray();
  J.mat = (bone) => bones[bone].matrixWorld.clone();
  J.dirInto = (bone, v) => new THREE.Vector3(...v).applyQuaternion(bones[bone].getWorldQuaternion(new THREE.Quaternion()).invert()).normalize().toArray();   // a rest-space direction, in a bone's own space
  J.into = (bone, v) => new THREE.Vector3(...v).applyMatrix4(bones[bone].matrixWorld.clone().invert()).toArray();   // a rest-space point, in a bone's own space
  return J;
}

// ---- skin weights ----
// While a layer's `weights(x, y, z)` runs it calls SK.add(bone, weight) for each bone that point follows.
export const SK = { n: 0, b: new Array(12), w: new Float64Array(12), add(bone, w) { if (w > 1e-4) { this.b[this.n] = bone; this.w[this.n++] = w; } } };
const sstep = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };
// A chain of bones, bone i joined to bone i + 1 at joints[i].at. Across each joint the weight passes from one bone to the next over a
// band `m` either side of the plane through the joint (normal `n`, by default along the chain). `within` keeps a joint's pull to a
// tube round a segment, so that a neck does not drag the shoulders beside it: { a, b, r0, r1 }.
// Returns weights(x, y, z, k = 1, widen = 0), which adds the chain's weights times k.
export function chainW(bones, joints, { start, end } = {}) {
  const Jn = joints.map((j, i) => {
    const prev = i ? joints[i - 1].at : start || j.at, next = i < joints.length - 1 ? joints[i + 1].at : end || j.at;
    const n = new THREE.Vector3(...(j.n || [next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]])).normalize();
    return { at: j.at, n, m: j.m, w: j.within && { a: new THREE.Vector3(...j.within.a), b: new THREE.Vector3(...j.within.b), r0: j.within.r0, r1: j.within.r1 } };
  });
  const f = new Float64Array(joints.length + 2), p = new THREE.Vector3();
  return (x, y, z, k = 1, widen = 0) => {
    let prev = 1; f[0] = 1;
    for (let i = 0; i < Jn.length; i++) {
      const j = Jn[i]; let v = sstep(-j.m, j.m, (x - j.at[0]) * j.n.x + (y - j.at[1]) * j.n.y + (z - j.at[2]) * j.n.z);
      if (v > 0 && j.w) v *= 1 - sstep(j.w.r0 + widen, j.w.r1 + widen, segDist(p.set(x, y, z), j.w.a, j.w.b));
      prev = f[i + 1] = Math.min(v, prev);
    }
    f[Jn.length + 1] = 0;
    for (let i = 0; i <= Jn.length; i++) SK.add(bones[i], k * (f[i] - f[i + 1]));
  };
}

// four weights a vertex, 0 to 1, as bytes 0 to 255 that still add up to 255 (the largest takes the rounding)
function weightBytes(w) {
  const b = new Uint8Array(w.length);
  for (let v = 0; v < w.length; v += 4) {
    let sum = 0, big = v;
    for (let q = v; q < v + 4; q++) { b[q] = Math.round(w[q] * 255); sum += b[q]; if (w[q] > w[big]) big = q; }
    b[big] += 255 - sum;
  }
  return b;
}
// Mesh the layers and bind them to the bones as one skin (and one glowing skin, if any voxel glows).
function skinLayers(spec, root, bones, mats, stats) {
  const names = Object.keys(bones), index = Object.fromEntries(names.map((n, i) => [n, i])), got = [[], []];
  for (const L of spec.layers) {
    const built = buildPart({ seed: L.seed || 1, box: L.box, fill: L.fill }); stats.voxels += built.count; if (built.edge) stats.clipped.push(L.name);
    built.geos.forEach((geo, gi) => {
      if (!geo) return;
      const P = geo.attributes.position.array, n = P.length / 3, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let v = 0; v < n; v++) {
        SK.n = 0; L.weights(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
        if (!SK.n) throw new Error('no weights in layer ' + L.name);
        let tot = 0; const pick = [];
        for (let q = 0; q < 4; q++) { let bi = -1; for (let i = 0; i < SK.n; i++) if (!pick.includes(i) && (bi < 0 || SK.w[i] > SK.w[bi])) bi = i; if (bi < 0) break; pick.push(bi); tot += SK.w[bi]; }
        pick.forEach((i, q) => { if (!(SK.b[i] in index)) throw new Error('unknown bone ' + SK.b[i]); si[v * 4 + q] = index[SK.b[i]]; sw[v * 4 + q] = SK.w[i] / tot; });
      }
      geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      got[gi].push(geo);
    });
  }
  const skeleton = new THREE.Skeleton(names.map((n) => bones[n]));
  got.forEach((list, gi) => {
    if (!list.length) return;
    const merged = new THREE.BufferGeometry(); let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
    // Memory (phones, 2026-11-25): normals as bytes (they are -1, 0 or 1), bone numbers as bytes, and weights as bytes
    // read as 0 to 1 (each vertex's four still add up to exactly 1); 35 bytes a vertex in place of 60.
    for (const [name, size, Type] of [['position', 3, Float32Array], ['normal', 3, Int8Array], ['color', 3, Float32Array], ['skinIndex', 4, names.length < 256 ? Uint8Array : Uint16Array], ['skinWeight', 4, Float32Array]]) {
      const a = new Type(nv * size); let o = 0; for (const g of list) { a.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
      merged.setAttribute(name, name === 'skinWeight' ? new THREE.BufferAttribute(weightBytes(a), 4, true) : new THREE.BufferAttribute(a, size));
    }
    const ix = nv < 65536 ? new Uint16Array(ni) : new Uint32Array(ni); let o = 0, base = 0; for (const g of list) { const src = g.index.array; for (let i = 0; i < src.length; i++) ix[o++] = src[i] + base; base += g.attributes.position.count; }
    merged.setIndex(new THREE.BufferAttribute(ix, 1));
    const m = new THREE.SkinnedMesh(merged, mats[gi]); m.name = spec.name + (gi ? '_glow' : '_skin'); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    root.add(m); m.bind(skeleton, new THREE.Matrix4()); stats.tris += ni / 3;
  });
}
// The bone a point of a layer mostly follows (for the collision check, which treats each bone's share as a rigid block).
function mostly(L, x, y, z) { SK.n = 0; L.weights(x, y, z); let bi = 0; for (let i = 1; i < SK.n; i++) if (SK.w[i] > SK.w[bi]) bi = i; return SK.b[bi]; }

export function buildBiped(spec) {
  const skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: spec.rough ?? 0.7, metalness: 0 });
  const plateMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, emissive: new THREE.Color(spec.glow), emissiveIntensity: spec.glowBase ?? 0.3 });
  const root = new THREE.Group(); root.name = spec.name;
  const bones = {}, rest = {};
  for (const def of SKELETON) {
    const pv = (spec.pivot && spec.pivot[def.name]) || def.pivot;      // a rival may move a joint (longer arms); the clips only turn bones
    const b = spec.layers ? new THREE.Bone() : new THREE.Group(); b.name = def.name; b.position.fromArray(pv);
    rest[def.name] = { pos: pv.slice(), rot: ((spec.rest && spec.rest[def.name]) || def.rest || [0, 0, 0]).slice() }; b.rotation.set(rest[def.name].rot[0], rest[def.name].rot[1], rest[def.name].rot[2], 'YXZ');
    (def.parent ? bones[def.parent] : root).add(b); bones[def.name] = b;
  }
  for (const def of spec.extra || []) {            // extra bones the shared clips leave at rest (a claw's moving finger)
    const b = spec.layers ? new THREE.Bone() : new THREE.Group(); b.name = def.name; b.position.fromArray(def.pivot);
    rest[def.name] = { pos: def.pivot.slice(), rot: (def.rest || [0, 0, 0]).slice() }; b.rotation.set(rest[def.name].rot[0], rest[def.name].rot[1], rest[def.name].rot[2], 'YXZ');
    (def.parent ? bones[def.parent] : root).add(b); bones[def.name] = b;
  }
  root.updateMatrixWorld(true);
  const segs = Object.entries(spec.seg || {}).map(([n, [a, b, r]]) => ({ n, a: new THREE.Vector3(...a), b: new THREE.Vector3(...b), r }));
  const owner = (p) => { let best = null, bd = 1e9; for (const s of segs) { const d = segDist(p, s.a, s.b) - s.r; if (d < bd) { bd = d; best = s.n; } } return best; };
  let voxels = 0, tris = 0; const clipped = [], solid = {};   // solid: each part's voxel grid, kept only for the collision check (tools/)
  for (const def of [...SKELETON, ...(spec.extra || [])]) {
    const b = bones[def.name], M = b.matrixWorld.clone(), Mi = M.clone().invert();
    let part = null;
    let rigid = true;                               // false: a block cut from the layers, wanted only by the collision check
    if (spec.local[def.name] || ((spec.extra || []).includes(def) && def.fill)) part = { seed: def.seed || 1, ...(spec.local[def.name] || def) };
    else if ((spec.extra || []).includes(def)) continue;
    else if (spec.layers && !globalThis.__keepGrids) continue;
    else if (spec.box[def.name]) {
      const w = spec.box[def.name], lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (let i = 0; i < 8; i++) { _v.set(w[i & 1 ? 3 : 0], w[i & 2 ? 4 : 1], w[i & 4 ? 5 : 2]).applyMatrix4(Mi); _v.toArray().forEach((c, k) => { lo[k] = Math.min(lo[k], c); hi[k] = Math.max(hi[k], c); }); }
      const p = new THREE.Vector3(), me = def.name;
      if (spec.layers) { rigid = false; part = { seed: 1, box: [...lo.map(Math.floor), ...hi.map(Math.ceil)], fill: (x, y, z) => {
        p.set(x, y, z).applyMatrix4(M);
        for (const L of spec.layers) { const B = L.box; if (p.x < B[0] || p.y < B[1] || p.z < B[2] || p.x > B[3] || p.y > B[4] || p.z > B[5]) continue; const c = L.fill(p.x, p.y, p.z); if (c >= 0 && mostly(L, p.x, p.y, p.z) === me) return c; }
        return -1;
      } }; }
      else part = { seed: def.seed || 1, box: [...lo.map(Math.floor), ...hi.map(Math.ceil)], fill: (x, y, z) => {
        p.set(x, y, z).applyMatrix4(M); FORCE.bone = null;
        const c = spec.world(p.x, p.y, p.z); if (c < 0) return -1;
        return (FORCE.bone || owner(p)) === me ? c : -1;
      } };
    }
    if (!part) continue;
    const built = buildPart(part); if (built.solid) solid[def.name] = built.solid;
    if (!rigid) continue;
    voxels += built.count; if (built.edge) clipped.push(def.name);
    built.geos.forEach((geo, gi) => { if (!geo) return; const m = new THREE.Mesh(geo, gi ? plateMat : skinMat); m.name = def.name + (gi ? '_glow' : '_skin'); m.castShadow = true; m.receiveShadow = true; b.add(m); tris += geo.index.count / 3; });
  }
  if (spec.layers) { const st = { voxels: 0, tris: 0, clipped }; skinLayers(spec, root, bones, [skinMat, plateMat], st); voxels += st.voxels; tris += st.tris; }
  return { name: spec.name, root, bones, rest, skinMat, plateMat, glowMat: plateMat, parts: SKELETON.map((p) => (spec.pivot && spec.pivot[p.name] ? { ...p, pivot: spec.pivot[p.name] } : p)), k: spec.k || 1, kx: spec.kx || 1, def: spec, solid, stats: { voxels, tris, parts: SKELETON.length, clipped } };
}

// ---- younger stages ----
// A young stage is the adult's sculpt seen through a stretch: each layer names a `map` that carries adult rest space to the young
// one's (shorter legs, a rounder middle, a smaller head), rigid parts are scaled about their bones, and the joints are moved to
// match, so the same clips drive it. The sculpt itself can read a feature list to change what a stretch cannot (horns, mane).
//
// A stretch along the height: knots are [adult y, young y, x scale, z scale], in rising order; between knots everything is blended
// in a straight line. x is scaled about x[0] (which lands on x[1]), z about z[0] (lands on z[1]).
export function stretch({ knots, x = [0, 0], z = [0, 0] }) {
  const at = (v, col) => { let i = 0; while (i < knots.length - 2 && v > knots[i + 1][col]) i++; const a = knots[i], b = knots[i + 1], t = (v - a[col]) / (b[col] - a[col]); return [a, b, t]; };
  const mixk = (a, b, t, c) => { const u = t < 0 ? 0 : t > 1 ? 1 : t; return a[c] + (b[c] - a[c]) * u; };
  return {
    fwd(v) { const [a, b, t] = at(v.y, 0); v.set(x[1] + (v.x - x[0]) * mixk(a, b, t, 2), a[1] + (b[1] - a[1]) * t, z[1] + (v.z - z[0]) * mixk(a, b, t, 3)); return v; },
    inv(v) { const [a, b, t] = at(v.y, 1); v.set(x[0] + (v.x - x[1]) / mixk(a, b, t, 2), a[0] + (b[0] - a[0]) * t, z[0] + (v.z - z[1]) / mixk(a, b, t, 3)); return v; },
  };
}
// st: { maps: { name: stretch }, bone: { bone: map name } (which stretch moves each joint), part: { bone: scale } (rigid parts, scaled
// about their bone; their child joints follow), th: { layer or bone: thickness factor }, rest, k, kx, sway(chains) }.
// A layer names its stretch with `map`, or with `rigid: bone` if it is sculpted round a scaled rigid part (the inside of a mouth).
const sc3 = (s) => (s === undefined ? [1, 1, 1] : typeof s === 'number' ? [s, s, s] : s);
export function stageSpec(spec, st) {
  const mk = (pivot, rest) => {
    const root = new THREE.Group(), bones = {};
    for (const def of [...SKELETON, ...(spec.extra || [])]) {
      const b = new THREE.Group(); b.position.fromArray(pivot(def, bones)); const r = rest(def); b.rotation.set(r[0], r[1], r[2], 'YXZ');
      (def.parent ? bones[def.parent] : root).add(b); bones[def.name] = b; b.updateWorldMatrix(true, false);
    }
    return bones;
  };
  const isExtra = (def) => (spec.extra || []).includes(def);
  const restOf = (def) => (isExtra(def) ? def.rest : (spec.rest && spec.rest[def.name]) || def.rest) || [0, 0, 0];
  const adult = mk((def) => (isExtra(def) ? def.pivot : (spec.pivot && spec.pivot[def.name]) || def.pivot), restOf);
  const pivot = {}, v = new THREE.Vector3();
  const young = mk((def, bones) => {
    const a = adult[def.name], m = st.bone[def.name], sp = def.parent && st.part[def.parent];
    let out;
    if (m) { st.maps[m].fwd(a.getWorldPosition(v)); out = (def.parent ? bones[def.parent].worldToLocal(v) : v).toArray(); }
    else out = sp ? a.position.toArray().map((c, i) => c * (sp[i] ?? sp)) : a.position.toArray();
    pivot[def.name] = out; return out;
  }, (def) => (st.rest && st.rest[def.name]) || restOf(def));
  const mapOf = (L) => {
    if (!L.rigid) return st.maps[L.map];
    const s = sc3(st.part[L.rigid]), A = adult[L.rigid].matrixWorld, Y = young[L.rigid].matrixWorld, Ai = A.clone().invert(), Yi = Y.clone().invert();
    return { fwd: (q) => { q.applyMatrix4(Ai); q.set(q.x * s[0], q.y * s[1], q.z * s[2]); return q.applyMatrix4(Y); }, inv: (q) => { q.applyMatrix4(Yi); q.set(q.x / s[0], q.y / s[1], q.z / s[2]); return q.applyMatrix4(A); } };
  };
  const boxOf = (B, map) => { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; for (let i = 0; i < 8; i++) { map.fwd(v.set(B[i & 1 ? 3 : 0], B[i & 2 ? 4 : 1], B[i & 4 ? 5 : 2])); v.toArray().forEach((c, k) => { lo[k] = Math.min(lo[k], c); hi[k] = Math.max(hi[k], c); }); } return [...lo.map((c) => Math.floor(c) - 1), ...hi.map((c) => Math.ceil(c) + 1)]; };
  const q = new THREE.Vector3(), th = (n) => (st.th && st.th[n]) || 1;
  const layers = (spec.layers || []).map((L) => { const map = mapOf(L), t = th(L.name); return { ...L, box: boxOf(L.box, map),
    fill: (x, y, z) => { map.inv(q.set(x, y, z)); STAGE.th = t; const c = L.fill(q.x, q.y, q.z); STAGE.th = 1; return c; },
    weights: (x, y, z) => { map.inv(q.set(x, y, z)); STAGE.th = t; L.weights(q.x, q.y, q.z); STAGE.th = 1; } }; });
  const shrink = (part, sc, name) => { const s = sc3(sc), t = Math.max(th(name), 1 / Math.min(s[0], s[1], s[2])); return { ...part, box: part.box.map((c, i) => (i < 3 ? Math.floor(c * s[i]) - 1 : Math.ceil(c * s[i - 3]) + 1)),
    fill: (x, y, z) => { STAGE.th = t; const c = part.fill(x / s[0], y / s[1], z / s[2]); STAGE.th = 1; return c; } }; };
  const local = Object.fromEntries(Object.entries(spec.local || {}).map(([n, part]) => [n, shrink(part, st.part[n], n)]));
  const extra = (spec.extra || []).map((e) => ({ ...(e.fill ? shrink(e, st.part[e.name], e.name) : e), pivot: pivot[e.name], rest: (st.rest && st.rest[e.name]) || e.rest }));
  const box = Object.fromEntries(Object.entries(spec.box || {}).map(([n, B]) => { const m = (st.box && st.box[n]) || st.bone[n]; return [n, m ? boxOf(B, st.maps[m]) : B]; }));
  // A rival sculpted as one rigid `world`: each young point is looked up in the adult sculpt, through the regions of `st.world` in
  // turn ([map, which bones it holds]); a voxel keeps the bone it belongs to on the adult, so the parts cut along the same lines.
  let world = spec.world;
  if (spec.world && st.world) {
    const segs = Object.entries(spec.seg || {}).map(([n, [a, b, r]]) => ({ n, a: new THREE.Vector3(...a), b: new THREE.Vector3(...b), r }));
    const owner = (p) => { let best = null, bd = 1e9; for (const g of segs) { const d = segDist(p, g.a, g.b) - g.r; if (d < bd) { bd = d; best = g.n; } } return best; };
    const regs = st.world.map(([m, holds]) => [st.maps[m], holds]), w = new THREE.Vector3();
    world = (x, y, z) => {
      for (const [map, holds] of regs) {
        map.inv(w.set(x, y, z)); FORCE.bone = null;
        const c = spec.world(w.x, w.y, w.z); if (c < 0) continue;
        const o = FORCE.bone || owner(w);
        if (holds(o)) { FORCE.bone = o; return c; }
      }
      FORCE.bone = null; return -1;
    };
  }
  return { ...spec, world, pivot: Object.fromEntries(SKELETON.map((d) => [d.name, pivot[d.name]])), rest: { ...spec.rest, ...st.rest }, layers: spec.layers && layers, local, extra, box,
    sway: st.sway ? st.sway(spec.sway || []) : spec.sway, k: st.k, kx: st.kx, unit: st.unit || st.k, stage: st.name };
}
export { GLOW };
