// Times Square's screens (maps/empire.js): big lit advertising boards hung on the fronts of the buildings round the
// start. One mesh and one picture for all of them; every few seconds each board changes to the next advertisement.
// The names are our own (the game's racers, maps and made-up brands).
//
// makeScreens(scene, list) -> { step(dt) }   list: { x, y, z, nx, nz, w, h } a board's middle, the way it faces, its size
import * as THREE from 'three';

const ADS = [
  ['NITRO', 'COLA', '#d81f3a', '#ffe9a8'], ['RUST BROS', 'TIRES', '#1b1d24', '#ff9a2e'], ['EMPIRE', 'GRAND PRIX', '#1a3fae', '#ffffff'], ['BLUE FLAME', 'GASOLINE', '#0d7fd0', '#e8fbff'],
  ['GRINDER', 'GEARS', '#f2c21a', '#1a1408'], ['THE SHARK', 'LIVE TONIGHT', '#0c0c10', '#4ff0d0'], ['HAMMERDOWN', 'DERBY SAT', '#7a1fb0', '#ffe14a'], ['CAMP DEADFALL', 'THE MOVIE', '#143d22', '#b6ff6a'],
];
const COLS = 4, ROWS = 2;

function picture() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const g = cv.getContext('2d');
  ADS.forEach(([a, b, bg, ink], i) => {
    const x = (i % COLS) * 256, y = Math.floor(i / COLS) * 256;
    const gr = g.createLinearGradient(x, y, x, y + 256); gr.addColorStop(0, bg); gr.addColorStop(1, '#000000'); g.fillStyle = bg; g.fillRect(x, y, 256, 256); g.globalAlpha = 0.35; g.fillStyle = gr; g.fillRect(x, y, 256, 256); g.globalAlpha = 1;
    g.strokeStyle = ink; g.lineWidth = 6; g.strokeRect(x + 10, y + 10, 236, 236);
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    let s = 64; g.font = `900 ${s}px Impact, 'Arial Black', sans-serif`; while (g.measureText(a).width > 210 && s > 20) { s -= 2; g.font = `900 ${s}px Impact, 'Arial Black', sans-serif`; } g.fillText(a, x + 128, y + 104);
    s = 40; g.font = `900 ${s}px Impact, 'Arial Black', sans-serif`; while (g.measureText(b).width > 200 && s > 16) { s -= 2; g.font = `900 ${s}px Impact, 'Arial Black', sans-serif`; } g.fillText(b, x + 128, y + 168);
    g.fillRect(x + 48, y + 204, 160, 6);
  });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export function makeScreens(scene, list) {
  const pos = [], uv = [], idx = [], fpos = [], fidx = [];
  list.forEach((s, i) => {
    const tx = s.nz, tz = -s.nx, hw = s.w / 2, hh = s.h / 2, n = pos.length / 3, t = i % ADS.length, u0 = (t % COLS) / COLS, v0 = 1 - (Math.floor(t / COLS) + 1) / ROWS;
    const c = (a, b, o) => [s.x + tx * a * hw + s.nx * o, s.y + b * hh, s.z + tz * a * hw + s.nz * o];
    pos.push(...c(-1, -1, 0), ...c(1, -1, 0), ...c(1, 1, 0), ...c(-1, 1, 0)); uv.push(u0, v0, u0 + 1 / COLS, v0, u0 + 1 / COLS, v0 + 1 / ROWS, u0, v0 + 1 / ROWS); idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    const m = fpos.length / 3, f = (a, b) => [s.x + tx * a * (hw + 1.2) - s.nx * 0.3, s.y + b * (hh + 1.2), s.z + tz * a * (hw + 1.2) - s.nz * 0.3];   // a dark frame behind it
    fpos.push(...f(-1, -1), ...f(1, -1), ...f(1, 1), ...f(-1, 1)); fidx.push(m, m + 1, m + 2, m, m + 2, m + 3);
  });
  const tex = picture(), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.5, 1.5, 1.5), toneMapped: false, side: THREE.DoubleSide })); mesh.frustumCulled = false; scene.add(mesh);
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3)); fg.setIndex(fidx);
  const frame = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0x0b0b0e, side: THREE.DoubleSide })); frame.frustumCulled = false; scene.add(frame);
  let t = 0, k = 0;
  return { step(dt) { t += dt; if (t < 5) return; t = 0; k++; tex.offset.set((k % COLS) / COLS, (Math.floor(k / COLS) % ROWS) / ROWS); } };
}
