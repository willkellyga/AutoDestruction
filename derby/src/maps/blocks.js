// The city off the course (maps/empire.js): buildings nothing can hit, drawn as plain boxes with a picture of a front
// on every side. The pictures are drawn here a voxel to a pixel, in the voxel buildings' own colours, and shown
// unsmoothed, so up close a box reads as one more voxel building and not as a blank model: bays of windows, some lit,
// spandrels, sills. One mesh a style (five), one for the shop fronts along the street, and one more for everything
// plain: cornices, roofs, water tanks, bulkheads and masts. A few thousand triangles for the whole city.
//
// makeBlocks(scene, list)   list: { x0, z0, w, d, h, style, seed }   w, d in whole bays (8), h in whole floors (12)
//   styles: 'lime' (a limestone office tower), 'glass', 'brick', 'tan' (apartment houses), 'brown'
import * as THREE from 'three';

const BAY = 8, FLOOR = 12, TW = 64, TH = 96;   // a picture is 8 bays by 8 floors
const STYLES = {
  //        wall       window     lit        spandrel   sill / trim   win x0, x1 (in the bay), y0, y1 (in the floor)
  lime: { wall: '#d6c9ae', glass: '#56738c', lit: '#ffe2a0', span: '#3b4250', trim: '#e7dcc4', wx: [2, 6], wy: [3, 10], lights: 0.3, cap: [0.78, 0.73, 0.62] },
  glass: { wall: '#3d4853', glass: '#7fb2c6', lit: '#f4f0d4', span: '#566572', trim: '#2f3840', wx: [1, 7], wy: [3, 11], lights: 0.22, cap: [0.2, 0.24, 0.28] },
  brick: { wall: '#9a5644', glass: '#2b3340', lit: '#ffd078', span: '#9a5644', trim: '#d9cfbe', wx: [2, 5], wy: [3, 9], lights: 0.3, cap: [0.8, 0.76, 0.68] },
  tan: { wall: '#c2966a', glass: '#33404e', lit: '#ffd88a', span: '#b08658', trim: '#e6dcc6', wx: [2, 6], wy: [3, 9], lights: 0.3, cap: [0.82, 0.78, 0.68] },
  marble: { wall: '#e2dccd', glass: '#3f4c5a', lit: '#ffe6ac', span: '#d3ccbb', trim: '#f1ede2', wx: [2, 5], wy: [2, 10], lights: 0.25, cap: [0.86, 0.84, 0.78] },
  brown: { wall: '#6f4c3e', glass: '#232a34', lit: '#ffc66a', span: '#5e3f33', trim: '#3a2a24', wx: [2, 5], wy: [2, 9], lights: 0.26, cap: [0.3, 0.22, 0.19] },
};

// by day no window is lit: the ones that would be show the sky in their glass instead
const DAYGLASS = '#93aec4';
function pictures(st, seed, day) {
  const cv = document.createElement('canvas'), ev = document.createElement('canvas'); cv.width = ev.width = TW; cv.height = ev.height = TH;
  const g = cv.getContext('2d'), e = ev.getContext('2d');
  let s = seed; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const px = (c, x, y, col, k = 1) => { c.fillStyle = col; c.globalAlpha = k; c.fillRect(x, TH - 1 - y, 1, 1); c.globalAlpha = 1; };
  e.fillStyle = '#000'; e.fillRect(0, 0, TW, TH);
  for (let fl = 0; fl < TH / FLOOR; fl++) for (let b = 0; b < TW / BAY; b++) {
    const on = r() < st.lights, dim = r() < 0.5;
    for (let y = 0; y < FLOOR; y++) for (let x = 0; x < BAY; x++) {
      const X = b * BAY + x, Y = fl * FLOOR + y, inX = x >= st.wx[0] && x <= st.wx[1], inY = y >= st.wy[0] && y <= st.wy[1];
      let col = st.wall;
      if (inX && inY) col = on ? (day ? DAYGLASS : st.lit) : st.glass;
      else if (inX && y < st.wy[0]) col = y === st.wy[0] - 1 ? st.trim : st.span;   // the spandrel under a window, a sill along its top
      else if (y === FLOOR - 1 && st === STYLES.glass) col = st.trim;
      px(g, X, Y, col);
      // a voxel's worth of grain, as the voxel buildings have
      const n = r(); px(g, X, Y, n < 0.5 ? '#000' : '#fff', inX && inY ? (on ? 0.05 : 0.1) * Math.abs(n - 0.5) * 2 + (!on && y > st.wy[1] - 2 ? 0.06 : 0) : 0.13 * Math.abs(n - 0.5) * 2);
      if (inX && inY && on && !day) px(e, X, Y, st.lit, dim ? 0.55 : 1);
    }
  }
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  return [tex(cv), tex(ev)];
}

// the street floor: eight bays of shop fronts (a lit window under an awning, a dark one, a door), a sign band over them
function shopPictures(day) {
  const cv = document.createElement('canvas'), ev = document.createElement('canvas'); cv.width = ev.width = TW; cv.height = ev.height = FLOOR;
  const g = cv.getContext('2d'), e = ev.getContext('2d');
  let s = 4711; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const px = (c, x, y, col, k = 1) => { c.fillStyle = col; c.globalAlpha = k; c.fillRect(x, FLOOR - 1 - y, 1, 1); c.globalAlpha = 1; };
  const AWN = ['#b3362e', '#2f6b4a', '#2c4f8a', '#c9952c', '#7a2f52'], SIGN = ['#e9e2cf', '#f2c14a', '#7fd0e0', '#e9e2cf'];
  e.fillStyle = '#000'; e.fillRect(0, 0, TW, FLOOR);
  for (let b = 0; b < TW / BAY; b++) {
    const kind = r() < 0.5 ? 'lit' : r() < 0.55 ? 'dark' : 'door', awn = AWN[Math.floor(r() * AWN.length)], sign = SIGN[Math.floor(r() * SIGN.length)], hasAwn = kind !== 'door' && r() < 0.7;
    for (let y = 0; y < FLOOR; y++) for (let x = 0; x < BAY; x++) {
      const X = b * BAY + x; let col = '#2a2b30', glow = null;
      if (y >= 10) { col = '#3a3c42'; if (kind === 'lit' && y === 10 && x >= 1 && x <= 6 && r() < 0.75) { col = sign; glow = 0.8; } }
      else if (y === 9 || (y === 8 && hasAwn)) col = hasAwn ? (x % 2 ? awn : '#e8e0d0') : '#3a3c42';
      else if (x === 0 || x === 7) col = '#4a4640';                                   // a pier between shops
      else if (kind === 'door') { col = x >= 3 && x <= 4 ? (y < 7 ? '#1c2026' : '#4a4640') : '#5b4a3c'; }
      else if (y < 2) col = '#4a4640';                                                // the stall riser under a window
      else if (kind === 'lit') { col = y < 4 && r() < 0.5 ? '#c98f3e' : day ? '#7f98ab' : '#ffd98a'; glow = y < 4 ? 0.6 : 1; }   // (things in the window)
      else col = '#1e2630';
      px(g, X, y, col); const n = r(); px(g, X, y, n < 0.5 ? '#000' : '#fff', 0.1 * Math.abs(n - 0.5) * 2);
      if (glow && !day) px(e, X, y, col, glow);
    }
  }
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  return [tex(cv), tex(ev)];
}

// list: [{ x0, z0, w, d, h, style, seed, plain }] (plain: no shop fronts along the street: an office or a ministry);
// day: no window lit
export function makeBlocks(scene, list, { day = false } = {}) {
  const bufs = {}, plain = { pos: [], col: [], nor: [], idx: [] };
  const buf = (k) => bufs[k] || (bufs[k] = { pos: [], uv: [], col: [], nor: [], idx: [] });
  const quad = (b, P, n, col, uv) => {
    const i = b.pos.length / 3; b.pos.push(...P); for (let k = 0; k < 4; k++) { b.nor.push(...n); b.col.push(...col); } if (uv) b.uv.push(...uv);
    b.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  // the four walls of a box, each with the picture laid over it from (u0, v0), a voxel to a pixel
  const walls = (b, x0, z0, x1, z1, y0, y1, col, ou, ov, th = TH) => {
    const v0 = (y0 + ov) / th, v1 = (y1 + ov) / th, U = (a, c) => [(a + ou) / TW, v0, (c + ou) / TW, v0, (c + ou) / TW, v1, (a + ou) / TW, v1];
    quad(b, [x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], [0, 0, -1], col, U(0, x1 - x0));
    quad(b, [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1], col, U(0, x1 - x0));
    quad(b, [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0], col, U(0, z1 - z0));
    quad(b, [x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [1, 0, 0], col, U(0, z1 - z0));
  };
  const box = (x0, z0, x1, z1, y0, y1, side, top = side) => {
    quad(plain, [x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], [0, 0, -1], side); quad(plain, [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1], side);
    quad(plain, [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0], side); quad(plain, [x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [1, 0, 0], side);
    quad(plain, [x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0], [0, 1, 0], top);
  };
  const shop = { pos: [], uv: [], col: [], nor: [], idx: [] }, WHITE = [1, 1, 1];
  const ROOF = [0.16, 0.16, 0.17], WOOD = [0.3, 0.19, 0.11], STEEL = [0.2, 0.21, 0.23];
  for (const B of list) {
    let s = (B.seed * 2654435761) | 0; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
    const st = STYLES[B.style] || STYLES.tan, b = buf(B.style in STYLES ? B.style : 'tan'), t = 0.86 + r() * 0.2, tint = [t, t * (0.97 + r() * 0.05), t * (0.95 + r() * 0.06)];
    const ou = Math.floor(r() * 8) * BAY, ov = Math.floor(r() * 8) * FLOOR, floors = Math.max(2, Math.round(B.h / FLOOR));
    // up to three tiers, each a bay in from the one below
    const cut = floors >= 22 && Math.min(B.w, B.d) >= 40 ? [0.5, 0.8, 1] : floors >= 13 && Math.min(B.w, B.d) >= 32 ? [0.66, 1] : [1];
    let y = 0, x0 = B.x0, z0 = B.z0, x1 = B.x0 + B.w, z1 = B.z0 + B.d;
    cut.forEach((k, i) => {
      const top = Math.round(floors * k) * FLOOR;
      walls(b, x0, z0, x1, z1, y, top, tint, ou, ov);
      box(x0 - 1, z0 - 1, x1 + 1, z1 + 1, top, top + 2, st.cap, ROOF);   // a cornice, and the roof
      if (i === 0 && !B.plain) { walls(shop, x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, 0, FLOOR, WHITE, ou, 0, FLOOR); box(x0 - 0.8, z0 - 0.8, x1 + 0.8, z1 + 0.8, 12, 13.5, st.cap); }   // shop fronts along the street, under a band
      y = top; if (i < cut.length - 1) { x0 += BAY; z0 += BAY; x1 -= BAY; z1 -= BAY; }
    });
    // on the roof: a bulkhead, and a water tank on the brick ones or a mast on a tall tower
    const w = x1 - x0, d = z1 - z0, cx = x0 + w * (0.3 + r() * 0.4), cz = z0 + d * (0.3 + r() * 0.4);
    if (w >= 16 && d >= 16) box(cx - 5, cz - 4, cx + 5, cz + 4, y + 2, y + 9 + r() * 5, st.cap.map((v) => v * 0.8), ROOF);
    if (B.style !== 'lime' && B.style !== 'glass' && r() < 0.6 && w >= 24) { const tx = x0 + 5 + r() * (w - 10), tz = z0 + 5 + r() * (d - 10); box(tx - 2, tz - 2, tx + 2, tz + 2, y + 2, y + 7, STEEL); box(tx - 3, tz - 3, tx + 3, tz + 3, y + 7, y + 15, WOOD); box(tx - 2, tz - 2, tx + 2, tz + 2, y + 15, y + 17, WOOD.map((v) => v * 0.7)); }
    else if (floors >= 20 && r() < 0.5) box(cx - 0.8, cz - 0.8, cx + 0.8, cz + 0.8, y + 9, y + 40 + r() * 40, STEEL);
  }
  const out = [];
  const mesh = (b, mat) => {
    if (!b.idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    if (b.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setIndex(b.idx);
    const m = new THREE.Mesh(g, mat); m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; m.updateMatrix(); m.frustumCulled = false; m.name = 'city blocks'; scene.add(m); out.push(m);
  };
  let n = 0;
  for (const k in bufs) { const [map, emissiveMap] = pictures(STYLES[k], 101 + 37 * n++, day); mesh(bufs[k], new THREE.MeshLambertMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.25, vertexColors: true })); }
  { const [map, emissiveMap] = shopPictures(day); mesh(shop, new THREE.MeshLambertMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.3, vertexColors: true })); }
  mesh(plain, new THREE.MeshLambertMaterial({ vertexColors: true }));
  return { meshes: out, tris: out.reduce((a, m) => a + m.geometry.index.count / 3, 0) };
}
