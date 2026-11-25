// The Statue of Liberty at twice Monster Mayhem's size (Will, 2026-11-24: "make the statue of liberty 100% larger"). The
// engine's own stands 176 voxels tall, and its world stops at 256, so at this size she is a drawn model, not voxels:
// she can't be shot down, and nothing drives into her (the island's road runs round her inside its own barriers).
//
// grabStatue(x0, z0, facing)  during the map's build: has the engine's kit build her at (x0, z0), copies the voxels and
//                             takes them out of the world again
// statueMesh(vol, scale)      -> a THREE.Group, its origin at the middle of her lot on the ground
// At twice the size each voxel is cut in eight, and the corners of the figure's rounds are taken off and filled in
// (layer by layer, as the kit draws her), so she is rounder than a blown-up copy would be.
import * as THREE from 'three';
import { idx, voxAt, setVox, place, ctx, setSeed, LOC, MAT_R, MAT_G, MAT_B, KIND, K } from '../../../src/world.js';
import { liberty, LIBERTY } from '../../../src/nyc_landmarks.js';

export function grabStatue(x0, z0, facing = 0) {
  const S = LIBERTY.S, NY = LIBERTY.TOP + 4, m = new Uint8Array(S * NY * S);
  setSeed(1886); ctx.lot = -1; ctx.L = 1;
  place(x0, z0, facing, S); liberty(LOC, LOC, 1); place(0, 0, -1); ctx.L = 3;
  for (let y = 0; y < NY; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const i = idx(x0 + x, y, z0 + z), v = voxAt(i);
    if (v) { m[(y * S + z) * S + x] = v; setVox(i, 0); }
  }
  return { S, NY, m, ped: LIBERTY.PED };
}

export function statueMesh(vol, scale = 2) {
  const { S, NY, m, ped } = vol, F = 2, FS = S * F, FY = NY * F, f = new Uint8Array(FS * FY * FS);
  const at = (x, y, z) => (x < 0 || z < 0 || y < 0 || x >= S || z >= S || y >= NY ? 0 : m[(y * S + z) * S + x]);
  // the air outside her, found from the edge of the box: faces are drawn only against it (the pedestal is hollow)
  const out = new Uint8Array(S * NY * S), q = new Int32Array(S * NY * S); let qh = 0, qn = 0;
  const push = (x, y, z) => { if (x < 0 || z < 0 || y < 0 || x >= S || z >= S || y >= NY) return; const c = (y * S + z) * S + x; if (m[c] || out[c]) return; out[c] = 1; q[qn++] = c; };
  for (let y = 0; y < NY; y++) for (let a = 0; a < S; a++) { push(a, y, 0); push(a, y, S - 1); push(0, y, a); push(S - 1, y, a); }
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) push(x, NY - 1, z);
  while (qh < qn) { const c = q[qh++], x = c % S, z = ((c / S) | 0) % S, y = (c / (S * S)) | 0; push(x + 1, y, z); push(x - 1, y, z); push(x, y + 1, z); push(x, y - 1, z); push(x, y, z + 1); push(x, y, z - 1); }
  // each voxel in eight; on the figure (over the pedestal) a corner that sticks out is taken off, one that is tucked in filled
  for (let y = 0; y < NY; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const v = m[(y * S + z) * S + x], round = y >= ped;
    for (let c = 0; c < 2; c++) for (let a = 0; a < 2; a++) {
      let w = v;
      if (round) {
        const dx = a ? 1 : -1, dz = c ? 1 : -1, nx = at(x + dx, y, z), nz = at(x, y, z + dz);
        if (v) { if (!nx && !nz && !at(x + dx, y, z + dz) && at(x - dx, y, z) && at(x, y, z - dz)) w = 0; } else if (nx && nz) w = nx;
      }
      if (!w) continue;
      for (let b = 0; b < 2; b++) f[((y * 2 + b) * FS + z * 2 + c) * FS + x * 2 + a] = w;
    }
  }
  const open = (x, y, z) => {   // is this small cube air that can be seen from outside?
    if (x < 0 || z < 0 || y < 0 || x >= FS || z >= FS || y >= FY) return y >= 0;
    if (f[(y * FS + z) * FS + x]) return false;
    const c = ((y >> 1) * S + (z >> 1)) * S + (x >> 1); return !!(out[c] || m[c]);
  };
  // the faces, a side at a time, runs of one material in a row drawn as one
  const pos = [], col = [], nor = [], ind = [], gpos = [], gind = [];
  const SIDES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const quad = (P, I, c) => { const b = P.length / 3; P.push(...c); I.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  const H0 = FS / 2;
  for (const [sx, sy, sz] of SIDES) {
    const along = sx ? 2 : 0;   // the run goes along z for the east and west faces, along x for the rest
    const n1 = FS;
    for (let y = 0; y < FY; y++) for (let b = 0; b < FS; b++) {
      let run = 0, mat = 0, start = 0;
      for (let a = 0; a <= n1; a++) {
        const x = along === 2 ? b : a, z = along === 2 ? a : b;
        const v = a < n1 ? f[(y * FS + z) * FS + x] : 0, show = v && open(x + sx, y + sy, z + sz) ? v : 0;
        if (show === mat && show) { run++; continue; }
        if (mat) {
          const a0 = start, a1 = start + run, lit = KIND[mat] === K.LIT;
          const u0 = along === 2 ? [b, a0] : [a0, b], u1 = along === 2 ? [b, a1] : [a1, b];   // (x, z) of the run's two ends, at the cube's low corner
          let c;
          if (sx) { const X = b + (sx > 0 ? 1 : 0); c = sx < 0 ? [X, y, a1, X, y + 1, a1, X, y + 1, a0, X, y, a0] : [X, y, a0, X, y + 1, a0, X, y + 1, a1, X, y, a1]; }
          else if (sz) { const Z = b + (sz > 0 ? 1 : 0); c = sz < 0 ? [a0, y, Z, a0, y + 1, Z, a1, y + 1, Z, a1, y, Z] : [a1, y, Z, a1, y + 1, Z, a0, y + 1, Z, a0, y, Z]; }
          else { const Y = y + (sy > 0 ? 1 : 0); c = sy > 0 ? [a0, Y, b, a0, Y, b + 1, a1, Y, b + 1, a1, Y, b] : [a0, Y, b, a1, Y, b, a1, Y, b + 1, a0, Y, b + 1]; }
          for (let k = 0; k < 12; k += 3) { c[k] -= H0; c[k + 2] -= H0; }
          if (lit) quad(gpos, gind, c);
          else {
            quad(pos, ind, c);
            const h = Math.sin(u0[0] * 12.9898 + y * 78.233 + u0[1] * 37.719) * 43758.5453, t = 0.94 + 0.1 * (h - Math.floor(h));
            for (let k = 0; k < 4; k++) { col.push(MAT_R[mat] * t, MAT_G[mat] * t, MAT_B[mat] * t); nor.push(sx, sy, sz); }
          }
        }
        mat = show; run = 1; start = a;
      }
    }
  }
  const grp = new THREE.Group(), k = scale / F;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(ind);
  const body = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); body.castShadow = false; body.receiveShadow = false; grp.add(body);
  if (gind.length) {
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3)); gg.setIndex(gind);
    grp.add(new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.5, 0.9), toneMapped: false })));
  }
  grp.scale.setScalar(k); grp.userData.tris = (ind.length + gind.length) / 3; grp.userData.top = FY * k;
  return grp;
}
