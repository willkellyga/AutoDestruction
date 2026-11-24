// A subway station either side of a road tunnel (maps/empire.js: "go into a subway area"). The road runs where the
// middle tracks would be. On one side a platform behind a row of columns, tiled, with the station's name on the wall;
// on the other a low wall, more columns and a track a train runs on (hazards.js 'el', on the ground). The tunnel's own
// walls are left out along it (roads.js `open`), and the cars are kept to the road by the cut's rails as before: the
// platform's edge and the low wall stand just where those are.
//
// makeStation(scene, { x, w, z0, z1, y0, y1, name }): a tunnel along z, its middle at x and w each side, the station
// from z0 to z1, the road at y0 and the roof's underside at y1. The platform is on the high x side.
import * as THREE from 'three';

const PLAT = 18, BAY = 20, UP = 3, REPEAT = 48;

function tiles(name) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#e9e6da'; g.fillRect(0, 0, 512, 256);
  let s = 77; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  for (let y = 0; y < 256; y += 8) for (let x = (y / 8) % 2 ? 8 : 0; x < 512; x += 16) { const t = r(); g.fillStyle = t < 0.08 ? '#cfcabb' : t < 0.5 ? '#efece2' : '#e3e0d3'; g.fillRect(x + 1, y + 1, 14, 6); }   // tiles, in bond
  g.fillStyle = '#2f6b57'; g.fillRect(0, 206, 512, 50);                                                                   // a green dado
  for (let x = 0; x < 512; x += 16) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, 206, 1, 50); } g.fillStyle = '#1d4a3c'; g.fillRect(0, 206, 512, 4);
  g.fillStyle = '#1f3f77'; g.fillRect(0, 40, 512, 26); g.fillStyle = '#d9b64a'; g.fillRect(0, 38, 512, 3); g.fillRect(0, 65, 512, 3);   // the band along the top
  // the name, in a tablet set in the band
  g.fillStyle = '#d9b64a'; g.fillRect(118, 22, 276, 62); g.fillStyle = '#16305e'; g.fillRect(123, 27, 266, 52);
  g.fillStyle = '#f4f1e6'; g.font = 'bold 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 256, 54);
  for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(40,36,30,0.07)'; g.fillRect((r() * 512) | 0, (r() * 256) | 0, 3, 2); }   // grime
  const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function makeStation(scene, { x, w, z0, z1, y0, y1, name = 'LIBERTY ST' }) {
  const body = { pos: [], col: [], idx: [] }, wall = { pos: [], uv: [], idx: [] }, glow = { pos: [], idx: [] };
  const quad = (buf, a, b, c, d, col, uv) => {
    const n = buf.pos.length / 3; buf.pos.push(...a, ...b, ...c, ...d);
    if (buf.col) for (let k = 0; k < 4; k++) buf.col.push(...col); if (buf.uv) buf.uv.push(...uv);
    buf.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  const box = (buf, x0, x1, ya, yb, za, zb, col) => {
    quad(buf, [x0, ya, za], [x0, ya, zb], [x0, yb, zb], [x0, yb, za], col); quad(buf, [x1, ya, zb], [x1, ya, za], [x1, yb, za], [x1, yb, zb], col);
    quad(buf, [x0, ya, za], [x0, yb, za], [x1, yb, za], [x1, ya, za], col); quad(buf, [x1, ya, zb], [x1, yb, zb], [x0, yb, zb], [x0, ya, zb], col);
    quad(buf, [x0, yb, za], [x0, yb, zb], [x1, yb, zb], [x1, yb, za], col);
  };
  // a tiled wall: along z at one x, or across x at one z
  const tiledZ = (X, ya, yb, f = 1) => quad(wall, [X, ya, z0], [X, ya, z1], [X, yb, z1], [X, yb, z0], null, [f * z0 / REPEAT, 0, f * z1 / REPEAT, 0, f * z1 / REPEAT, 1, f * z0 / REPEAT, 1]);   // (f -1: read from the other side)
  const tiledX = (Z, xa, xb, ya, yb) => quad(wall, [xa, ya, Z], [xb, ya, Z], [xb, yb, Z], [xa, yb, Z], null, [0.02, 0, 0.02 + (xb - xa) / REPEAT * 0.4, 0, 0.02 + (xb - xa) / REPEAT * 0.4, 1, 0.02, 1]);
  const CONC = [0.5, 0.5, 0.48], EDGE = [0.86, 0.68, 0.16], FACE = [0.26, 0.26, 0.28], DARK = [0.13, 0.13, 0.15], POST = [0.17, 0.3, 0.36], BED = [0.19, 0.18, 0.17], WOOD = [0.36, 0.22, 0.12], BLACK = [0.01, 0.01, 0.012];
  // ---- the platform side ----
  const E0 = x + w, E1 = E0 + PLAT, py = y0 + UP;
  quad(body, [E0, py, z0], [E0, py, z1], [E1, py, z1], [E1, py, z0], CONC);
  quad(body, [E0, py + 0.03, z0], [E0, py + 0.03, z1], [E0 + 1.6, py + 0.03, z1], [E0 + 1.6, py + 0.03, z0], EDGE);
  quad(body, [E0, y0, z0], [E0, y0, z1], [E0, py, z1], [E0, py, z0], FACE);
  quad(body, [E0, y1, z0], [E1, y1, z0], [E1, y1, z1], [E0, y1, z1], DARK);
  tiledZ(E1, py, y1); tiledX(z0, E0, E1, py, y1); tiledX(z1, E0, E1, py, y1);
  for (let z = z0 + 6; z < z1 - 4; z += 12) { box(body, E0 + 2.4, E0 + 3.8, py, y1, z, z + 1.4, POST); box(body, E0 + 2.1, E0 + 4.1, y1 - 1, y1, z - 0.3, z + 1.7, POST); }
  for (let z = z0 + 14; z < z1 - 14; z += 16) quad(glow, [E0 + 8.4, y1 - 0.06, z], [E0 + 9.6, y1 - 0.06, z], [E0 + 9.6, y1 - 0.06, z + 8], [E0 + 8.4, y1 - 0.06, z + 8]);
  for (let z = z0 + 22; z < z1 - 22; z += 36) { box(body, E1 - 2.6, E1 - 1, py, py + 1.1, z, z + 7, WOOD); box(body, E1 - 1.2, E1 - 0.9, py, py + 2.4, z, z + 7, WOOD); }
  // ---- the track side ----
  const W0 = x - w, W1 = W0 - BAY;
  quad(body, [W1, y0, z0], [W1, y0, z1], [W0, y0, z1], [W0, y0, z0], BED);
  box(body, W0 - 1.3, W0, y0, y0 + 2.2, z0, z1, CONC);
  quad(body, [W1, y1, z0], [W0, y1, z0], [W0, y1, z1], [W1, y1, z1], DARK);
  tiledZ(W1, y0, y1, -1); tiledX(z0, W1, W0, y0, y1); tiledX(z1, W1, W0, y0, y1);
  for (let z = z0 + 6; z < z1 - 4; z += 12) { box(body, W0 - 1.35, W0 + 0.05, y0 + 2.2, y1, z, z + 1.4, POST); box(body, W0 - 1.65, W0 + 0.35, y1 - 1, y1, z - 0.3, z + 1.7, POST); }
  for (let z = z0 + 14; z < z1 - 14; z += 16) quad(glow, [W0 - 10.6, y1 - 0.06, z], [W0 - 9.4, y1 - 0.06, z], [W0 - 9.4, y1 - 0.06, z + 8], [W0 - 10.6, y1 - 0.06, z + 8]);
  // the mouths the train comes out of: black, a little in front of each end wall
  for (const [Z, d] of [[z0, 0.06], [z1, -0.06]]) quad(body, [W1 + 3, y0, Z + d], [W0 - 3, y0, Z + d], [W0 - 3, y0 + 13.4, Z + d], [W1 + 3, y0 + 13.4, Z + d], BLACK);
  const out = [];
  const mesh = (buf, mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
    if (buf.col) g.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3)); if (buf.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
    g.setIndex(buf.idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); out.push(m);
  };
  mesh(body, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh(wall, new THREE.MeshBasicMaterial({ map: tiles(name), color: new THREE.Color(0.78, 0.76, 0.7), side: THREE.DoubleSide }));
  mesh(glow, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.4, 1.9), toneMapped: false, side: THREE.DoubleSide }));
  return { track: x - w - BAY / 2 - 0.5, meshes: out };
}
