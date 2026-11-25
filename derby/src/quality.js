// Picture quality that fits the device. The game starts on a lighter step on phones and tablets, then judges the frame
// rate over 2-second windows of play: under about 38 fps it drops a step, and after 8 s at about 54 fps or better it
// tries one step up again (not straight back to a step it just had to leave). The same ladder as Monster Mayhem's, cut
// down to what the derby draws:
//   step  pixels   shadows       glow  grade  debris  far detail
//   0     to 1.5x  4096, soft    on    on     8000    all
//   1     1x       2048, soft    on    on     8000    all
//   2     1x       2048          off   on     5000    all
//   3     1x       1024          off   on     5000    300 / 640 voxels
//   4     1x       none          off   off    3000    260 / 560
//   5     0.8x     none          off   off    3000    220 / 440
//   6     0.65x    none          off   off    3000    180 / 360
// Add ?q=0 to ?q=6 to the address to hold a step (for testing and screenshots).
import * as THREE from 'three';
import { setShadows, setDebrisBudget, setLod } from '../../src/sim.js';

const QMAX = 6;
const LODS = [[Infinity, Infinity], [Infinity, Infinity], [Infinity, Infinity], [300, 640], [260, 560], [220, 440], [180, 360]];
// On a phone or tablet the far detail never turns off, however well it runs: climbing from step 3 to 2 used to switch it
// off, the whole of New York came back in full (and twice over, for the shadows), and the race fell to 27 fps on an
// iPad before the next window could step it down again (device report, 2026-11-24). Measured headless on the race:
// 1,100 draws and 2.9 million triangles in view with it off, about 510 and 1.1 million with it on.
const LODS_MOBILE = [[360, 720], [360, 720], [330, 680], [300, 640], [260, 560], [220, 440], [180, 360]];

export function makeQuality({ renderer, composer, bloom, scene, camera, sun, resize, playing, mobile, lodK = 1 }) {
  let q = -1, post = true;
  const win = { t: 0, n: 0, fast: 0, settle: 3, prev: 0, left: new Float64Array(QMAX + 1) };
  const fixed = /[?&]q=(\d)/.exec(location.search);
  const shadowSize = (n) => { sun.shadow.mapSize.set(n, n); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } };
  function set(n) {
    n = Math.max(0, Math.min(QMAX, Math.round(n)));
    if (n === q) return;
    q = n;
    const pr = n === 0 ? Math.min(window.devicePixelRatio || 1, 1.5) : n >= 6 ? 0.65 : n >= 5 ? 0.8 : 1;
    if (renderer.getPixelRatio() !== pr) { renderer.setPixelRatio(pr); composer.setPixelRatio(pr); resize(); }
    const sh = n === 0 ? 4096 : n <= 2 ? 2048 : n === 3 ? 1024 : 0;
    if (sh) {
      if (!renderer.shadowMap.enabled) { renderer.shadowMap.enabled = true; sun.castShadow = true; setShadows(true); }
      if (sun.shadow.mapSize.x !== sh) shadowSize(sh);
      const type = n <= 1 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;   // soft shadows take several times the samples
      if (renderer.shadowMap.type !== type) { renderer.shadowMap.type = type; if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    } else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; sun.castShadow = false; setShadows(false); }
    bloom.enabled = n <= 1;
    post = n <= 3;   // below that the picture goes straight to the screen, without the grade and vignette
    setDebrisBudget(n <= 1 ? 8000 : n <= 3 ? 5000 : 3000);
    const L = (mobile ? LODS_MOBILE : LODS)[n]; setLod(L[0] * (mobile ? lodK : 1), L[1] * (mobile ? lodK : 1));   // (lodK: a map that shows more city at once asks for less of it in full, maps/empire.js)
    win.t = 0; win.n = 0; win.fast = 0; win.settle = 3;   // let a change settle (shaders compile) before judging again
  }
  // once a frame, with the frame's time stamp
  function judge(now) {
    const dt = (now - (win.prev || now)) / 1000; win.prev = now;
    if (fixed || !playing() || dt > 1) return;
    if (win.settle > 0) { win.settle -= dt; return; }
    win.t += dt; win.n++;
    if (win.t < 2 || win.n < 20) return;
    const avg = win.t / win.n; win.t = 0; win.n = 0;
    if (avg > 0.026 && q < QMAX) { win.left[q] = now; set(q + 1); return; }   // under about 38 fps: a step down
    if (avg < 0.0185) win.fast++; else win.fast = 0;                           // about 54 fps or better
    if (win.fast >= 4 && q > 0 && now - win.left[q - 1] > 60000) set(q - 1);   // 8 s of that: a step up
  }
  const draw = () => { if (post) composer.render(); else renderer.render(scene, camera); };
  set(fixed ? +fixed[1] : mobile ? 3 : 0);
  return { set, judge, draw, get step() { return q; } };
}
