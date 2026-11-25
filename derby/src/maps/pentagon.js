// The Pentagon, drawn (maps/capital.js). The engine's own is a plain tan block with blue squares, and its slanted
// sides come out as stairs of voxels; beside this road and at twice its size it looked unfinished (Will, 2026-11-24:
// "pentagon feels like it could be better textured or detailed"). So it is a model of flat faces here, to the engine's
// plan at twice the size: three rings with light courts between and the corridors across them, a limestone front drawn
// a voxel to a pixel (a rusticated ground floor, three floors of tall windows between piers, an entablature), a
// portico of square columns in the middle of each side, a pavilion at each end, and slate roofs.
//
// pentagonMesh() -> a THREE.Group, its origin the middle of the building on the ground, the front toward -z
import * as THREE from 'three';

const R = 102, H = 50, RINGS = [[84, 102], [58, 74], [32, 48]], T36 = Math.tan(Math.PI / 5), TW = 64, TH = 64;
const STONE = [0.72, 0.68, 0.57], SLATE = [0.14, 0.16, 0.18], DARK = [0.1, 0.12, 0.15];   // (as light, not as paint: these go to the shader as they are)

// the front: eight bays of it, no two windows quite alike
function front() {
  const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
  const g = cv.getContext('2d');
  let s = 1943; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const px = (x, y, col, k = 1) => { g.fillStyle = col; g.globalAlpha = k; g.fillRect(x, TH - 1 - y, 1, 1); g.globalAlpha = 1; };
  const WALL = '#d8d1be', PIER = '#e0dac9', BACK = '#cbc4b1', PLINTH = '#b7b09d', LINE = '#b5ae9b', TRIM = '#ece7d9', GLASS = '#44586a', SKY = '#8eabc2', BLIND = '#d9d3c2', SPAN = '#b9b29f';
  for (let b = 0; b < 8; b++) {
    // (a window on each of the four floors: dark glass, or the sky in it, or a blind half down)
    const kind = [0, 1, 2, 3].map(() => { const k = r(); return k < 0.22 ? 'sky' : k < 0.42 ? 'blind' : 'glass'; });
    for (let y = 0; y < TH; y++) for (let x = 0; x < 8; x++) {
      const pier = x === 7 || x <= 1, win = x >= 3 && x <= 5;
      let col = WALL;
      if (y < 3) col = y === 2 ? TRIM : PLINTH;
      else if (y < 13) {                                                    // the ground floor, its stone in courses
        col = (y - 3) % 3 === 2 ? LINE : WALL;
        if (win && y >= 5 && y <= 10) col = kind[0] === 'sky' ? SKY : kind[0] === 'blind' && y >= 9 ? BLIND : GLASS;
        else if (x >= 2 && x <= 6 && y === 11) col = TRIM;                  // a lintel
      }
      else if (y === 13) col = TRIM;                                        // the course over it
      else if (y < 44) {
        const fl = Math.floor((y - 14) / 10), fy = (y - 14) % 10, k = kind[1 + fl];
        col = pier ? PIER : BACK;
        if (win && fy >= 2 && fy <= 8) col = k === 'sky' ? SKY : k === 'blind' && fy >= 6 ? BLIND : GLASS;
        else if (win && fy < 2) col = SPAN;                                 // the panel under a window
      }
      else if (y === 44) col = LINE;                                        // the shade under the cornice
      else if (y < 48) col = y === 46 ? WALL : TRIM;
      else if (y < 50) col = y === 48 ? LINE : WALL;                        // the parapet
      else col = WALL;
      px(b * 8 + x, y, col);
      const n = r(), glass = col === GLASS || col === SKY; px(b * 8 + x, y, n < 0.5 ? '#000' : '#fff', (glass ? 0.06 : 0.09) * Math.abs(n - 0.5) * 2);
    }
    // the pier's shade down its right side, and the window's along its top
    for (let y = 14; y < 44; y++) px(b * 8 + 2, y, '#000', 0.1);
    for (let fl = 0; fl < 3; fl++) for (let x = 3; x <= 5; x++) px(b * 8 + x, 14 + fl * 10 + 8, '#000', 0.22);
    for (let x = 3; x <= 5; x++) px(b * 8 + x, 10, '#000', 0.22);
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function pentagonMesh() {
  const wall = { pos: [], uv: [], nor: [], idx: [] }, plain = { pos: [], col: [], nor: [], idx: [] };
  // a quad of four corners, turned to face the way `n` says
  const quad = (b, P, n, extra) => {
    const [ax, ay, az, bx, by, bz, , , , dx, dy, dz] = P, ux = bx - ax, uy = by - ay, uz = bz - az, vx = dx - ax, vy = dy - ay, vz = dz - az;
    let N = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; const l = Math.hypot(...N) || 1; N = N.map((v) => v / l);
    const flip = N[0] * n[0] + N[1] * n[1] + N[2] * n[2] < 0; if (flip) N = N.map((v) => -v);
    const i = b.pos.length / 3; b.pos.push(...P); for (let k = 0; k < 4; k++) b.nor.push(...N);
    extra(b); b.idx.push(...(flip ? [i, i + 2, i + 1, i, i + 3, i + 2] : [i, i + 1, i + 2, i, i + 2, i + 3]));
  };
  for (let k = 0; k < 5; k++) {
    const an = (-90 + 72 * k) * Math.PI / 180, c = Math.cos(an), s = Math.sin(an);
    const at = (r, t, y) => [r * c - t * s, y, r * s + t * c];
    // a stretch of wall on this side, r out from the middle, from t0 to t1 along it, the front's picture on it
    const face = (r, t0, t1, y0, y1, out = 1) => quad(wall, [...at(r, t0, y0), ...at(r, t1, y0), ...at(r, t1, y1), ...at(r, t0, y1)], [c * out, 0, s * out], (b) => b.uv.push((t0 + 4.5) / TW, y0 / TH, (t1 + 4.5) / TW, y0 / TH, (t1 + 4.5) / TW, y1 / TH, (t0 + 4.5) / TW, y1 / TH));
    const flat = (P, n, col) => quad(plain, P, n, (b) => { for (let i = 0; i < 4; i++) b.col.push(...col); });
    // a block of plain stone: its four sides and its top (`ends` false: the two sides along the wall only, and the top)
    const box = (r0, r1, t0, t1, y0, y1, col, top = col) => {
      flat([...at(r1, t0, y0), ...at(r1, t1, y0), ...at(r1, t1, y1), ...at(r1, t0, y1)], [c, 0, s], col);
      flat([...at(r0, t0, y0), ...at(r0, t1, y0), ...at(r0, t1, y1), ...at(r0, t0, y1)], [-c, 0, -s], col);
      flat([...at(r0, t0, y0), ...at(r1, t0, y0), ...at(r1, t0, y1), ...at(r0, t0, y1)], [s, 0, -c], col);
      flat([...at(r0, t1, y0), ...at(r1, t1, y0), ...at(r1, t1, y1), ...at(r0, t1, y1)], [-s, 0, c], col);
      flat([...at(r0, t0, y1), ...at(r1, t0, y1), ...at(r1, t1, y1), ...at(r0, t1, y1)], [0, 1, 0], top);
    };
    // the rings: a wall outside and in, and a slate roof hipped over each
    RINGS.forEach(([r0, r1], i) => {
      face(r1, -r1 * T36, r1 * T36, 0, H); face(r0, -r0 * T36, r0 * T36, 0, H, -1);
      const m = (r0 + r1) / 2, y1 = H + (i ? 5 : 6), e = 0.8;
      flat([...at(r1 + e, -(r1 + e) * T36, H), ...at(r1 + e, (r1 + e) * T36, H), ...at(m, m * T36, y1), ...at(m, -m * T36, y1)], [c, 1, s], SLATE);
      flat([...at(r0 - e, -(r0 - e) * T36, H), ...at(r0 - e, (r0 - e) * T36, H), ...at(m, m * T36, y1), ...at(m, -m * T36, y1)], [-c, 1, -s], SLATE.map((v) => v * 0.94));
      // (the eaves: a thin edge of stone under the slate)
      flat([...at(r1 + e, -(r1 + e) * T36, H - 0.6), ...at(r1 + e, (r1 + e) * T36, H - 0.6), ...at(r1 + e, (r1 + e) * T36, H), ...at(r1 + e, -(r1 + e) * T36, H)], [c, 0, s], STONE);
      flat([...at(r0 - e, -(r0 - e) * T36, H - 0.6), ...at(r0 - e, (r0 - e) * T36, H - 0.6), ...at(r0 - e, (r0 - e) * T36, H), ...at(r0 - e, -(r0 - e) * T36, H)], [-c, 0, -s], STONE);
    });
    // the corridors across the courts: one in the middle of the side, one along each corner
    for (let i = 0; i < 2; i++) {
      const a = RINGS[i + 1][1], b = RINGS[i][0];
      for (const [t0, t1] of [[-5, 5]]) {
        quad(wall, [...at(a, t0, 0), ...at(b, t0, 0), ...at(b, t0, H - 2), ...at(a, t0, H - 2)], [s, 0, -c], (B) => B.uv.push(a / TW, 0, b / TW, 0, b / TW, (H - 2) / TH, a / TW, (H - 2) / TH));
        quad(wall, [...at(a, t1, 0), ...at(b, t1, 0), ...at(b, t1, H - 2), ...at(a, t1, H - 2)], [-s, 0, c], (B) => B.uv.push(a / TW, 0, b / TW, 0, b / TW, (H - 2) / TH, a / TW, (H - 2) / TH));
        flat([...at(a, t0, H - 2), ...at(b, t0, H - 2), ...at(b, t1, H - 2), ...at(a, t1, H - 2)], [0, 1, 0], SLATE.map((v) => v * 0.85));
      }
      // (the corner's: from this side's end of the inner ring to its end of the outer, five wide)
      const w = 5;
      quad(wall, [...at(a, a * T36 - w, 0), ...at(b, b * T36 - w, 0), ...at(b, b * T36 - w, H - 2), ...at(a, a * T36 - w, H - 2)], [s, 0, -c], (B) => B.uv.push(a / TW, 0, b / TW, 0, b / TW, (H - 2) / TH, a / TW, (H - 2) / TH));
      quad(wall, [...at(a, -a * T36 + w, 0), ...at(b, -b * T36 + w, 0), ...at(b, -b * T36 + w, H - 2), ...at(a, -a * T36 + w, H - 2)], [-s, 0, c], (B) => B.uv.push(a / TW, 0, b / TW, 0, b / TW, (H - 2) / TH, a / TW, (H - 2) / TH));
      flat([...at(a, a * T36 - w, H - 2), ...at(b, b * T36 - w, H - 2), ...at(b, b * T36, H - 2), ...at(a, a * T36, H - 2)], [0, 1, 0], SLATE.map((v) => v * 0.85));
      flat([...at(a, -a * T36 + w, H - 2), ...at(b, -b * T36 + w, H - 2), ...at(b, -b * T36, H - 2), ...at(a, -a * T36, H - 2)], [0, 1, 0], SLATE.map((v) => v * 0.85));
    }
    // the outside: a plinth, the cornice, and a pavilion at each end standing a little proud and a little taller
    const E = (r) => r * T36;
    box(R, R + 0.8, -E(R + 0.8), E(R + 0.8), 0, 2.4, STONE.map((v) => v * 0.8));
    box(R, R + 1.3, -E(R + 1.3), E(R + 1.3), 44.6, 46.4, STONE.map((v) => v * 1.04));
    for (const sg of [-1, 1]) {
      const r = R + 1.6, t0 = sg * 59.5, t1 = sg * E(r);
      face(r, Math.min(t0, t1), Math.max(t0, t1), 0, H);
      flat([...at(R, t0, 0), ...at(r, t0, 0), ...at(r, t0, H + 2), ...at(R, t0, H + 2)], [-sg * -s, 0, -sg * c], STONE);
      box(R - 6, r + 0.9, Math.min(t0, t1) - 0.6, Math.max(sg * E(r + 0.9), t0), H, H + 2.2, STONE.map((v) => v * 0.97), SLATE.map((v) => v * 0.9));
      box(r, r + 0.7, Math.min(t0, sg * E(r + 0.7)), Math.max(t0, sg * E(r + 0.7)), 0, 2.4, STONE.map((v) => v * 0.8));
    }
    // the middle of the side: a block standing forward, and before it the portico, six square columns on a few steps
    // under a deep entablature and a plain attic
    const p = R + 3;
    face(p, -29.5, -22.5, 0, H); face(p, 22.5, 29.5, 0, H);
    flat([...at(R, -29.5, 0), ...at(p, -29.5, 0), ...at(p, -29.5, H + 4), ...at(R, -29.5, H + 4)], [s, 0, -c], STONE);
    flat([...at(R, 29.5, 0), ...at(p, 29.5, 0), ...at(p, 29.5, H + 4), ...at(R, 29.5, H + 4)], [-s, 0, c], STONE);
    box(R - 8, p + 0.6, -30.1, 30.1, H, H + 4, STONE.map((v) => v * 0.98), SLATE.map((v) => v * 0.9));       // the attic
    box(p, p + 0.9, -30.4, 30.4, 44.6, 46.6, STONE.map((v) => v * 1.04));
    flat([...at(p - 0.4, -22.5, 3), ...at(p - 0.4, 22.5, 3), ...at(p - 0.4, 22.5, 40), ...at(p - 0.4, -22.5, 40)], [c, 0, s], DARK);   // the porch's back wall, in shade
    for (let j = -2; j <= 2; j++) {                                                                           // the doors and the tall windows in it
      flat([...at(p - 0.3, j * 8 - 2, 3), ...at(p - 0.3, j * 8 + 2, 3), ...at(p - 0.3, j * 8 + 2, 11), ...at(p - 0.3, j * 8 - 2, 11)], [c, 0, s], j % 2 ? [0.3, 0.37, 0.44] : [0.36, 0.25, 0.14]);
      for (let f = 0; f < 3; f++) flat([...at(p - 0.3, j * 8 - 1.5, 15 + f * 9), ...at(p - 0.3, j * 8 + 1.5, 15 + f * 9), ...at(p - 0.3, j * 8 + 1.5, 21 + f * 9), ...at(p - 0.3, j * 8 - 1.5, 21 + f * 9)], [c, 0, s], [0.3, 0.38, 0.46]);
    }
    box(p - 0.4, p + 0.3, -22.5, 22.5, 12, 13.2, STONE.map((v) => v * 0.7));
    box(p, p + 6, -24, 24, 0, 3, STONE.map((v) => v * 0.9)); box(p + 6, p + 6.8, -24, 24, 0, 2, STONE.map((v) => v * 0.86)); box(p + 6.8, p + 7.6, -24, 24, 0, 1, STONE.map((v) => v * 0.82));   // the steps
    for (let j = -3; j <= 2; j++) { const t = j * 8 + 4; box(p + 2.5, p + 5.5, t - 1.5, t + 1.5, 3, 40, STONE.map((v) => v * 1.03)); box(p + 2.2, p + 5.8, t - 1.8, t + 1.8, 3, 4.2, STONE.map((v) => v * 0.9)); box(p + 2.2, p + 5.8, t - 1.8, t + 1.8, 38.8, 40, STONE); }
    box(p - 0.2, p + 6, -23, 23, 40, 45.5, STONE); box(p - 0.2, p + 6.8, -23.8, 23.8, 45.5, 47, STONE.map((v) => v * 1.05));       // the entablature and its cornice
    box(p - 0.2, p + 5.4, -22, 22, 47, H + 2.5, STONE.map((v) => v * 0.97), SLATE.map((v) => v * 0.9));
  }
  const grp = new THREE.Group(); let tris = 0;
  const mesh = (b, mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    if (b.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); if (b.col) g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    g.setIndex(b.idx); tris += b.idx.length / 3;
    const m = new THREE.Mesh(g, mat); m.castShadow = false; m.receiveShadow = false; grp.add(m);
  };
  mesh(wall, new THREE.MeshLambertMaterial({ map: front() }));
  // (the plain stone and the slate have the voxels' grain, a cube to a voxel)
  const stone = new THREE.MeshLambertMaterial({ vertexColors: true });
  stone.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCell;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvCell = position - normal * 0.02;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCell;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n{ vec3 c = floor(vCell + 0.001); float h = fract(sin(dot(mod(c, 97.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453); diffuseColor.rgb *= 0.9 + 0.16 * h; }');
  };
  mesh(plain, stone);
  grp.userData.tris = tris;
  return grp;
}

// is this spot of the engine's lot (132 across, the middle at 65.5) under the building? (the map takes the engine's own
// walls out of the model it draws, and keeps what stands round it: the flag, the court's pavilion)
export function underPentagon(a, b) {
  let pd = -1e9; for (let k = 0; k < 5; k++) { const an = (-90 + 72 * k) * Math.PI / 180; pd = Math.max(pd, (a - 65.5) * Math.cos(an) + (b - 65.5) * Math.sin(an)); }
  return pd >= 14 && pd < 53;
}
