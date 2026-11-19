// Loose cubes for the viewer: thrown, bounce on the ground, rest, then shrink away. In the game the units hand their
// cubes to the town's own debris instead (spawnDebris in src/sim.js), so this file is only for the viewer.
import * as THREE from 'three';
import { cubeGeo, cubeMat, cubeMesh } from './cube3.js';

// water (optional): { at(x, z) -> the water level there, or null over land; splash(x, y, z, size) }. A cube that falls
// into water is gone, with a splash.
export function makeDebris(scene, max = 6000, water = null) {
  const mesh = cubeMesh(cubeGeo(), cubeMat(new THREE.MeshStandardMaterial({ roughness: 0.9 })), max);   // three faces a cube (cube3.js)
  mesh.castShadow = true; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const P = new Float32Array(max * 3), V = new Float32Array(max * 3), R = new Float32Array(max * 4), SZ = new Float32Array(max), AGE = new Float32Array(max);
  const col = new THREE.Color(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < max; i++) { mesh.setMatrixAt(i, ZERO); mesh.setColorAt(i, col.set(0)); }
  mesh.count = 0;
  // The cubes are kept packed in the first n slots: one that goes hands its slot to the last one, so no empty slot is
  // drawn, sent or stepped (they used to be up to half of what was drawn). With the pool full the oldest go.
  let n = 0, head = 0, recol = false;
  function spawn(x, y, z, vx, vy, vz, c, size) {
    let i; if (n < max) i = n++; else { i = head; head = (head + 1) % max; }
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; V[i * 3] = vx; V[i * 3 + 1] = vy; V[i * 3 + 2] = vz;
    R[i * 4] = Math.random() * 6; R[i * 4 + 1] = Math.random() * 6; R[i * 4 + 2] = (Math.random() - 0.5) * 14; R[i * 4 + 3] = (Math.random() - 0.5) * 14;
    SZ[i] = size; AGE[i] = 0; mesh.setColorAt(i, col.setHex(c)); recol = true;
  }
  function move(from, to) {
    P.copyWithin(to * 3, from * 3, from * 3 + 3); V.copyWithin(to * 3, from * 3, from * 3 + 3); R.copyWithin(to * 4, from * 4, from * 4 + 4);
    SZ[to] = SZ[from]; AGE[to] = AGE[from]; mesh.instanceColor.array.copyWithin(to * 3, from * 3, from * 3 + 3); recol = true;
  }
  function update(dt) {
    if (recol) { mesh.instanceColor.needsUpdate = true; recol = false; }
    if (!n) return;
    const was = n, MA = mesh.instanceMatrix.array;
    for (let i = 0; i < n; i++) {
      const a = i * 3, r = i * 4, half = SZ[i] / 2; AGE[i] += dt;
      V[a + 1] -= 60 * dt; P[a] += V[a] * dt; P[a + 1] += V[a + 1] * dt; P[a + 2] += V[a + 2] * dt;
      const wl = water && P[a + 1] < half ? water.at(P[a], P[a + 2]) : null;
      let k = 1;
      if (wl != null) { if (P[a + 1] < wl) { water.splash(P[a], wl, P[a + 2], SZ[i]); k = 0; } }
      else if (P[a + 1] < half) { P[a + 1] = half; V[a + 1] = Math.abs(V[a + 1]) > 6 ? -V[a + 1] * 0.32 : 0; V[a] *= 0.6; V[a + 2] *= 0.6; R[r + 2] *= 0.5; R[r + 3] *= 0.5; }
      if (k && AGE[i] > 5) k = Math.max(0, 1 - (AGE[i] - 5) / 1.2);
      if (k <= 0) { n--; if (i < n) { move(n, i); i--; } continue; }   // gone: the last cube takes this slot, and is stepped in its place
      R[r] += R[r + 2] * dt; R[r + 1] += R[r + 3] * dt;
      // the cube's matrix written straight into the list (a turn about x, then y, times its size); going by way of a
      // quaternion took most of this loop's time when thousands of cubes are loose
      const sz = SZ[i] * k, ca = Math.cos(R[r]) * sz, sa = Math.sin(R[r]) * sz, cy = Math.cos(R[r + 1]), sy = Math.sin(R[r + 1]), w = i * 16;
      MA[w] = cy * sz; MA[w + 1] = sa * sy; MA[w + 2] = -ca * sy; MA[w + 3] = 0;
      MA[w + 4] = 0; MA[w + 5] = ca; MA[w + 6] = sa; MA[w + 7] = 0;
      MA[w + 8] = sy * sz; MA[w + 9] = -sa * cy; MA[w + 10] = ca * cy; MA[w + 11] = 0;
      MA[w + 12] = P[a]; MA[w + 13] = P[a + 1]; MA[w + 14] = P[a + 2]; MA[w + 15] = 1;
    }
    if (!n) head = 0;
    mesh.count = n;
    if (recol) { mesh.instanceColor.needsUpdate = true; recol = false; }
    // sent as far as the highest slot touched since the graphics card last took the data (three empties the ranges when it does)
    const im = mesh.instanceMatrix, rg = im.updateRanges[0], m = Math.max(was * 16, rg ? rg.count : 0); im.clearUpdateRanges(); im.addUpdateRange(0, m); im.needsUpdate = true;
  }
  scene.add(mesh);
  return { spawn, update, mesh, get live() { return n; } };
}
