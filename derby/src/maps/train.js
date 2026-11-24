// Monster Mayhem's trains (civilian/src/trains.js) as scenery for a map: the commuter train or the express, as many cars
// as asked for, coupled nose to tail. Each car is built once as the engine's own unit (moving, so its lamps are lit),
// and its parts are then run together into one mesh a material, so a whole train is a handful of draws; cars alike
// share theirs. Nothing here can be hit or wrecked: it is for an elevated line or a station the cars drive past.
//
// makeTrain(mats, { model: 'commuter' | 'express', cars, paint }) -> { group, length, car }
//   group: forward is +z, y = 0 the top of the rail, its middle at the train's middle. length, car: voxels.
import * as THREE from 'three';
import { Unit } from '../../../units/src/unit.js';
import { COMMUTER_TRAIN, EXPRESS_TRAIN } from '../../../civilian/src/trains.js';

// every part of unit u that uses material gi, as one geometry in the unit's own space
function merged(u, gi, inside = null) {
  const list = [], v = new THREE.Vector3(); let nv = 0, ni = 0;
  u.root.updateWorldMatrix(true, true);
  for (const p of u.parts) { const m = p.meshes[gi]; if (!m || !m.visible || p.bone.getWorldScale(v).x < 0.5) continue; list.push(m); nv += m.geometry.getAttribute('position').count; ni += m.geometry.index.count; }
  if (!nv) return null;
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), I = new Uint32Array(ni), nm = new THREE.Matrix3(); let a = 0, b = 0;
  for (const m of list) {
    const g = m.geometry, p = g.getAttribute('position'), n = g.getAttribute('normal'), ix = g.index.array, base = a / 3; nm.getNormalMatrix(m.matrixWorld);
    C.set(g.getAttribute('color').array.subarray(0, p.count * 3), a);
    for (let i = 0; i < p.count; i++, a += 3) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); P[a] = v.x; P[a + 1] = v.y; P[a + 2] = v.z; v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); N[a] = v.x; N[a + 1] = v.y; N[a + 2] = v.z; }
    // (a face in among the seats is left out: the windows are dark glass, and nothing inside is ever seen)
    for (let i = 0; i < g.index.count; i += 3) {
      const c0 = (ix[i] + base) * 3, c1 = (ix[i + 1] + base) * 3, c2 = (ix[i + 2] + base) * 3;
      if (inside && inside((P[c0] + P[c1] + P[c2]) / 3, (P[c0 + 1] + P[c1 + 1] + P[c2 + 1]) / 3, (P[c0 + 2] + P[c1 + 2] + P[c2 + 2]) / 3)) continue;
      I[b++] = ix[i] + base; I[b++] = ix[i + 1] + base; I[b++] = ix[i + 2] + base;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setIndex(new THREE.BufferAttribute(I.subarray(0, b), 1));
  return g;
}

export function makeTrain(mats, { model = 'commuter', cars = 4, paint } = {}) {
  const def = model === 'express' ? EXPRESS_TRAIN : COMMUTER_TRAIN, LEN = { end: model === 'express' ? 56 : 48, mid: 48 }, GAP = 1;
  const made = {};
  const geos = (type, rear) => {
    const key = type + (rear ? 'r' : '');
    if (!made[key]) {
      const u = new Unit(def, mats, { type, rear, paint, seed: 5 }); u.play('Drive', 0); u.update(0.05);
      const half = LEN[type === 'mid' ? 'mid' : 'end'] / 2, inside = (x, y, z) => Math.abs(x) < 5.1 && y > 3.1 && y < 12.1 && Math.abs(z) < half - 0.4;
      made[key] = [merged(u, 0, inside), merged(u, 1, inside)];
      for (const p of u.parts) for (const m of p.meshes) if (m) m.geometry.dispose();
    }
    return made[key];
  };
  const kinds = Array.from({ length: cars }, (_, k) => (k === 0 || k === cars - 1 ? 'end' : 'mid'));
  const length = kinds.reduce((s, k) => s + LEN[k], 0) + GAP * (cars - 1), group = new THREE.Group();
  let z = length / 2, tris = 0;
  kinds.forEach((kind, k) => {
    const rear = k === cars - 1 && cars > 1, G = geos(kind === 'end' ? 'cab' : 'mid', rear), c = new THREE.Group();
    z -= LEN[kind] / 2; c.position.z = z; z -= LEN[kind] / 2 + GAP; if (rear) c.rotation.y = Math.PI;
    G.forEach((g, gi) => { if (!g) return; const m = new THREE.Mesh(g, mats[gi]); m.castShadow = false; m.receiveShadow = false; c.add(m); tris += g.index.count / 3; });
    group.add(c);
  });
  return { group, length, car: 48, tris };
}
