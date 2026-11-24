// The roads that aren't on the flat ground, drawn (maps/empire.js): the decks of bridges, a flyover and a causeway, and
// the cut down to a tunnel. None of it is voxels. Where the cars go on them is maps/heights.js's business; this is only
// what they look like: the road, a parapet each side, the underside, piers, and a cut's walls, roof and lamps.
// All of a map's go into three meshes: the roads (one picture of asphalt, repeated along them), everything concrete
// (coloured a corner at a time) and the lamps.
//
// makeRoads(scene, T, parts): T the course (racetrack.js), parts a list of
//   { kind: 'deck' | 'cut', i0, n, H, half(i), ... }   samples i0 to i0 + n of the course, at heights H[i]
//   deck: solid (a deck no higher than this stands on a wall down to the ground: a ramp, a causeway),
//         piers (one pair every so many voxels where it is open underneath), skip(x, z) (no pier here)
//   cut:  top (how high its walls stand over the ground), roof [k0, k1] (the samples from i0 with a roof over them)
//         and roofY (its underside)
import * as THREE from 'three';

const CONC = [0.5, 0.49, 0.46], PALE = [0.62, 0.61, 0.57], DARK = [0.2, 0.2, 0.21], TILE = [0.66, 0.67, 0.62], STEEL = [0.24, 0.3, 0.3];
const REPEAT = 40;   // voxels of road to one picture of it

function roadTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#474b54'; g.fillRect(0, 0, 256, 256);
  let s = 9; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(30,32,38,0.25)' : 'rgba(120,124,134,0.16)'; g.fillRect((r() * 256) | 0, (r() * 256) | 0, 2, 2); }
  g.fillStyle = 'rgba(8,8,10,0.16)'; g.fillRect(70, 0, 22, 256); g.fillRect(164, 0, 22, 256);   // where the wheels run
  g.fillStyle = '#eee8da'; g.fillRect(5, 0, 5, 256); g.fillRect(246, 0, 5, 256);                // a line along each edge
  g.fillStyle = '#e6cf78'; g.fillRect(126, 20, 4, 130);                                         // and a broken one down the middle
  g.fillStyle = 'rgba(16,16,18,0.55)'; g.fillRect(0, 251, 256, 3);                              // a joint across
  const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function makeRoads(scene, T, parts) {
  const road = { pos: [], uv: [], idx: [] }, body = { pos: [], col: [], idx: [] }, glow = { pos: [], idx: [] };
  // a strip of quads between rows of two points each: [x, y, z, x, y, z, v]
  const strip = (buf, rows, col) => {
    if (rows.length < 2) return;
    const base = buf.pos.length / 3;
    for (const r of rows) { buf.pos.push(r[0], r[1], r[2], r[3], r[4], r[5]); if (buf.uv) buf.uv.push(0, r[6] || 0, 1, r[6] || 0); if (buf.col) buf.col.push(...col, ...col); }
    for (let k = 0; k + 1 < rows.length; k++) { const a = base + k * 2; buf.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  };
  // an upright post, square, from y0 to y1
  const post = (x, z, r, y0, y1, col) => {
    const c = [[-r, -r], [r, -r], [r, r], [-r, r], [-r, -r]];
    for (let k = 0; k < 4; k++) strip(body, [[x + c[k][0], y0, z + c[k][1], x + c[k][0], y1, z + c[k][1]], [x + c[k + 1][0], y0, z + c[k + 1][1], x + c[k + 1][0], y1, z + c[k + 1][1]]], col);
  };
  for (const p of parts) {
    const { i0, n, H, half } = p, S = [];
    for (let k = 0; k <= n; k++) { const i = T.at(i0 + k); S.push({ k, x: T.X[i], z: T.Z[i], nx: T.TZ[i], nz: -T.TX[i], w: half(i), h: H[i], s: k * T.STEP }); }
    const P = (c, l, y) => [c.x + c.nx * l, y, c.z + c.nz * l];
    const row = (c, l0, y0, l1, y1, v) => [...P(c, l0, y0), ...P(c, l1, y1), v];
    if (p.kind === 'deck') {
      const LIFT = 0.06, T0 = 1.3, U = 2.5, solid = p.solid ?? 0, drop = (c) => (c.h <= solid ? c.h + 1 : U);
      strip(road, S.map((c) => row(c, c.w, c.h + LIFT, -c.w, c.h + LIFT, c.s / REPEAT)));
      for (const sd of [1, -1]) {
        strip(body, S.map((c) => row(c, sd * c.w, c.h, sd * c.w, c.h + 3)), PALE);
        strip(body, S.map((c) => row(c, sd * c.w, c.h + 3, sd * (c.w + T0), c.h + 3)), PALE);
        strip(body, S.map((c) => row(c, sd * (c.w + T0), c.h + 3, sd * (c.w + T0), c.h - drop(c))), CONC);
      }
      const open = S.filter((c) => c.h > solid && c.h > U + 0.5);
      strip(body, open.map((c) => row(c, c.w + T0, c.h - U, -(c.w + T0), c.h - U)), DARK);
      // the piers, in pairs, where it is open underneath and high enough to need them
      if (p.piers) {
        const every = Math.max(1, Math.round(p.piers / T.STEP));
        for (const c of open) {
          if (c.k % every || c.h < 7) continue;
          for (const sd of [1, -1]) { const [x, , z] = P(c, sd * (c.w - 4), 0); if (!p.skip || !p.skip(x, z)) post(x, z, 2, -1, c.h - U, CONC); }
          strip(body, [row(c, c.w, c.h - U - 2, -c.w, c.h - U - 2), row(c, c.w, c.h - U, -c.w, c.h - U)], CONC);   // the beam across their tops
        }
      }
    } else {
      const top = p.top ?? 3, T0 = 1.6, [r0, r1] = p.roof || [1, 0], RY = p.roofY ?? -1, roofed = (c) => c.k >= r0 && c.k <= r1;
      strip(road, S.map((c) => row(c, c.w, c.h, -c.w, c.h, c.s / REPEAT)));
      for (const sd of [1, -1]) {
        strip(body, S.map((c) => row(c, sd * c.w, c.h, sd * c.w, roofed(c) ? RY : top)), TILE);
        for (const run of [S.filter((c) => c.k <= r0), S.filter((c) => c.k >= r1)]) {
          strip(body, run.map((c) => row(c, sd * c.w, top, sd * (c.w + T0), top)), PALE);
          strip(body, run.map((c) => row(c, sd * (c.w + T0), top, sd * (c.w + T0), 0)), CONC);
        }
      }
      const R = S.filter(roofed);
      if (R.length > 1) {
        strip(body, R.map((c) => row(c, c.w, RY, -c.w, RY)), DARK);
        strip(glow, R.map((c) => row(c, 1.2, RY - 0.08, -1.2, RY - 0.08)));
        for (const c of [R[0], R[R.length - 1]]) {   // over each mouth: the wall across, up to the parapet
          strip(body, [row(c, c.w + T0, RY, -(c.w + T0), RY), row(c, c.w + T0, top, -(c.w + T0), top)], CONC);
          strip(body, [row(c, c.w + T0, RY, -(c.w + T0), RY), row(c, c.w + T0, RY - 1.2, -(c.w + T0), RY - 1.2)], STEEL);
        }
      }
    }
  }
  const out = [];
  const mesh = (buf, mat, shadow) => {
    if (!buf.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
    if (buf.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
    if (buf.col) g.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3));
    g.setIndex(buf.idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = false; m.receiveShadow = !!shadow; m.matrixAutoUpdate = false; m.updateMatrix(); m.frustumCulled = false;
    scene.add(m); out.push(m); return m;
  };
  mesh(road, new THREE.MeshLambertMaterial({ map: roadTexture(), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), true);
  mesh(body, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), true);
  mesh(glow, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 1.7), toneMapped: false, side: THREE.DoubleSide }), false);
  return out;
}
