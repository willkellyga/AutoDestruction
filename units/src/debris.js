// Loose cubes for the viewer: thrown, bounce on the ground, rest, then shrink away. In the game the units hand their
// cubes to the town's own debris instead (spawnDebris in src/sim.js), so this file is only for the viewer.
import * as THREE from 'three';

export function makeDebris(scene, max = 6000) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), max);
  mesh.castShadow = true; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const P = new Float32Array(max * 3), V = new Float32Array(max * 3), R = new Float32Array(max * 4), SZ = new Float32Array(max), AGE = new Float32Array(max), LIVE = new Uint8Array(max);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < max; i++) { mesh.setMatrixAt(i, ZERO); mesh.setColorAt(i, col.set(0)); }
  let head = 0, live = 0;
  function spawn(x, y, z, vx, vy, vz, c, size) {
    const i = head; head = (head + 1) % max; if (!LIVE[i]) live++;
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; V[i * 3] = vx; V[i * 3 + 1] = vy; V[i * 3 + 2] = vz;
    R[i * 4] = Math.random() * 6; R[i * 4 + 1] = Math.random() * 6; R[i * 4 + 2] = (Math.random() - 0.5) * 14; R[i * 4 + 3] = (Math.random() - 0.5) * 14;
    SZ[i] = size; AGE[i] = 0; LIVE[i] = 1; mesh.setColorAt(i, col.setHex(c)); mesh.instanceColor.needsUpdate = true;
  }
  function update(dt) {
    if (!live) return;
    for (let i = 0; i < max; i++) {
      if (!LIVE[i]) continue;
      const a = i * 3, r = i * 4, half = SZ[i] / 2; AGE[i] += dt;
      V[a + 1] -= 60 * dt; P[a] += V[a] * dt; P[a + 1] += V[a + 1] * dt; P[a + 2] += V[a + 2] * dt;
      if (P[a + 1] < half) { P[a + 1] = half; V[a + 1] = Math.abs(V[a + 1]) > 6 ? -V[a + 1] * 0.32 : 0; V[a] *= 0.6; V[a + 2] *= 0.6; R[r + 2] *= 0.5; R[r + 3] *= 0.5; }
      R[r] += R[r + 2] * dt; R[r + 1] += R[r + 3] * dt;
      const k = AGE[i] > 5 ? Math.max(0, 1 - (AGE[i] - 5) / 1.2) : 1;
      if (k <= 0) { LIVE[i] = 0; live--; mesh.setMatrixAt(i, ZERO); continue; }
      p.set(P[a], P[a + 1], P[a + 2]); q.setFromEuler(e.set(R[r], R[r + 1], 0)); s.setScalar(SZ[i] * k); mesh.setMatrixAt(i, m.compose(p, q, s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  scene.add(mesh);
  return { spawn, update, mesh, get live() { return live; } };
}
