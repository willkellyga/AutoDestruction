// Loose cubes for the viewer: thrown, bounce on the ground, rest, then shrink away. In the game the units hand their
// cubes to the town's own debris instead (spawnDebris in src/sim.js), so this file is only for the viewer.
import * as THREE from 'three';

// water (optional): { at(x, z) -> the water level there, or null over land; splash(x, y, z, size) }. A cube that falls
// into water is gone, with a splash.
export function makeDebris(scene, max = 6000, water = null) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), max);
  mesh.castShadow = true; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const P = new Float32Array(max * 3), V = new Float32Array(max * 3), R = new Float32Array(max * 4), SZ = new Float32Array(max), AGE = new Float32Array(max), LIVE = new Uint8Array(max);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < max; i++) { mesh.setMatrixAt(i, ZERO); mesh.setColorAt(i, col.set(0)); }
  mesh.count = 0;   // only as far as the highest cube in use is drawn, sent and stepped
  // a freed slot is the next one handed out, lowest first after a lull, so the span in use stays short; with none free the oldest go
  const free = new Int32Array(max); let nfree = 0; const refill = () => { for (let i = 0; i < max; i++) free[i] = max - 1 - i; nfree = max; }; refill();
  let head = 0, live = 0, top = 0;
  function spawn(x, y, z, vx, vy, vz, c, size) {
    let i; if (nfree) i = free[--nfree]; else { i = head; head = (head + 1) % max; }
    if (!LIVE[i]) live++;
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; V[i * 3] = vx; V[i * 3 + 1] = vy; V[i * 3 + 2] = vz;
    R[i * 4] = Math.random() * 6; R[i * 4 + 1] = Math.random() * 6; R[i * 4 + 2] = (Math.random() - 0.5) * 14; R[i * 4 + 3] = (Math.random() - 0.5) * 14;
    SZ[i] = size; AGE[i] = 0; LIVE[i] = 1; mesh.setColorAt(i, col.setHex(c)); mesh.instanceColor.needsUpdate = true;
    if (i >= top) top = i + 1; if (top > mesh.count) mesh.count = top;
  }
  function update(dt) {
    if (!live) return;
    const was = top; top = 0;
    const MA = mesh.instanceMatrix.array;
    for (let i = 0; i < was; i++) {
      if (!LIVE[i]) continue;
      const a = i * 3, r = i * 4, half = SZ[i] / 2; AGE[i] += dt;
      V[a + 1] -= 60 * dt; P[a] += V[a] * dt; P[a + 1] += V[a + 1] * dt; P[a + 2] += V[a + 2] * dt;
      const wl = water && P[a + 1] < half ? water.at(P[a], P[a + 2]) : null;
      if (wl != null) { if (P[a + 1] < wl) { water.splash(P[a], wl, P[a + 2], SZ[i]); LIVE[i] = 0; live--; free[nfree++] = i; mesh.setMatrixAt(i, ZERO); continue; } }
      else if (P[a + 1] < half) { P[a + 1] = half; V[a + 1] = Math.abs(V[a + 1]) > 6 ? -V[a + 1] * 0.32 : 0; V[a] *= 0.6; V[a + 2] *= 0.6; R[r + 2] *= 0.5; R[r + 3] *= 0.5; }
      R[r] += R[r + 2] * dt; R[r + 1] += R[r + 3] * dt;
      const k = AGE[i] > 5 ? Math.max(0, 1 - (AGE[i] - 5) / 1.2) : 1;
      if (k <= 0) { LIVE[i] = 0; live--; free[nfree++] = i; mesh.setMatrixAt(i, ZERO); continue; }
      top = i + 1;
      // the cube's matrix written straight into the list (a turn about x, then y, times its size); going by way of a
      // quaternion took most of this loop's time when thousands of cubes are loose
      const sz = SZ[i] * k, ca = Math.cos(R[r]) * sz, sa = Math.sin(R[r]) * sz, cy = Math.cos(R[r + 1]), sy = Math.sin(R[r + 1]), w = i * 16;
      MA[w] = cy * sz; MA[w + 1] = sa * sy; MA[w + 2] = -ca * sy; MA[w + 3] = 0;
      MA[w + 4] = 0; MA[w + 5] = ca; MA[w + 6] = sa; MA[w + 7] = 0;
      MA[w + 8] = sy * sz; MA[w + 9] = -sa * cy; MA[w + 10] = ca * cy; MA[w + 11] = 0;
      MA[w + 12] = P[a]; MA[w + 13] = P[a + 1]; MA[w + 14] = P[a + 2]; MA[w + 15] = 1;
    }
    if (!live) { head = 0; refill(); }   // all gone: hand slots out from the bottom again
    mesh.count = top;
    // sent as far as the highest slot touched since the graphics card last took the data (three empties the ranges when it does)
    const im = mesh.instanceMatrix, r = im.updateRanges[0], n = Math.max(was * 16, r ? r.count : 0); im.clearUpdateRanges(); im.addUpdateRange(0, n); im.needsUpdate = true;
  }
  scene.add(mesh);
  return { spawn, update, mesh, get live() { return live; } };
}
