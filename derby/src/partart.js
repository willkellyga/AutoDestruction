// Little pictures of the parts for the garage's cards, drawn from the parts' own voxel models: the car is built for the
// build with that part fitted, everything but the part is left out, and the part is drawn from three-quarters on, on a
// small canvas of its own (a second, tiny renderer, so the game's own frame is never touched). Pictures are drawn one at
// a time between frames and kept, so opening a tab never stalls the game; until a picture is ready its card shows a
// plain glyph.
import * as THREE from 'three';
import { Unit } from '../../units/src/unit.js';
import { carDef } from './carmodel.js';

// which of the car model's parts make up each slot's picture ('body' is the shell; the gun hangs off the turret ring)
const SHOW = {
  body: ['body', 'hood', 'engine', 'wFL', 'wFR', 'wRL', 'wRR'], armour: ['body', 'hood', 'engine', 'wFL', 'wFR', 'wRL', 'wRR'], engine: ['engine'],
  primary: ['yaw', 'gun', 'spin'], roof: ['roof'], door: ['doorL'], secondary: ['pod', 'mines'],
  front: ['front', 'sawL', 'sawR'], wheels: ['wFL'],
};
// the way each picture is looked at: from the front left and a little above, or from the side for a wheel
const VIEW = { engine: [1, 0.75, 0.9], wheels: [1, 0.25, 0.25], door: [1, 0.35, 0.55], body: [1, 0.55, 1.2], armour: [1, 0.55, 1.2], secondary: [1, 0.6, 0.9] };
export const ART_SLOTS = new Set(Object.keys(SHOW));

export function makePartArt({ mats }) {
  const W = 192, H = 128;
  const cache = new Map(), queue = [], wait = new Map();
  let gl = null, scene = null, cam = null, timer = 0;
  function setup() {
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    gl = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    gl.setPixelRatio(1); gl.setSize(W, H, false); gl.setClearColor(0x000000, 0);
    gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.15;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x6b5a48, 1.7));
    const key = new THREE.DirectionalLight(0xfff2dc, 2.6); key.position.set(4, 7, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 1.2); rim.position.set(-6, 3, -5); scene.add(rim);
    cam = new THREE.PerspectiveCamera(28, W / H, 0.1, 400);
  }
  const keyOf = (slot, key, load) => [slot, key, load.body, load.paint, load.trim, load.pattern, slot === 'secondary' || slot === 'primary' ? '' : load.armour].join(':');
  function draw(job) {
    if (!gl) setup();
    const { slot, key, load } = job;
    const L = { ...load, [slot]: key };
    const def = carDef(L, 3), keep = new Set(slot === 'door' && key === 'hubs' ? ['wFL', 'hubFL'] : slot === 'door' && key === 'blades' ? ['bsawL'] : SHOW[slot]);
    // every part of the car is kept as a bone (the turret ring, the body) so the part sits where it would, but only
    // the slot's own parts get their cubes
    const parts = def.parts().map((p) => (keep.has(p.name) ? p : { ...p, box: null }));
    const unit = new Unit({ ...def, parts: () => parts }, mats, { seed: 3 });
    Object.assign(unit.state, { spin: 0, steer: 0, roll: 0, pitch: 0, bob: 0, yaw: 0, aim: 0, gunSpin: 0, saw: 0, coneYaw: 0, coneAim: 0, arc: 0 });
    unit.update(0);
    scene.add(unit.root); unit.root.updateMatrixWorld(true);
    const bb = new THREE.Box3();
    for (const p of unit.parts) if (p.count) for (const m of p.meshes) if (m) { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld); bb.union(b); }
    let url = null;
    if (!bb.isEmpty()) {
      const c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3()), r = Math.max(0.3, s.length() / 2);
      const v = VIEW[slot] || [1, 0.5, 0.8], d = new THREE.Vector3(v[0], v[1], v[2]).normalize();
      const dist = r / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * (slot === 'body' || slot === 'armour' ? 0.78 : 0.9);
      cam.position.copy(c).addScaledVector(d, dist); cam.lookAt(c); cam.updateMatrixWorld();
      gl.render(scene, cam);
      url = gl.domElement.toDataURL('image/png');
    }
    unit.dispose();
    return url;
  }
  function pump() {
    timer = 0;
    const job = queue.shift(); if (!job) return;
    const k = keyOf(job.slot, job.key, job.load);
    if (!cache.has(k)) {
      let url = null;
      try { url = draw(job); } catch (err) { url = null; }
      cache.set(k, url);
      for (const cb of wait.get(k) || []) cb(url);
      wait.delete(k);
    }
    if (queue.length) timer = setTimeout(pump, 16);
  }
  // The whole car from its right-hand side, nose to the right and a little from above, for the loading screen
  // (page.html): the car without its near wheels, one near wheel on its own (the screen spins it), and where the
  // wheels and the gun's muzzle are on the picture, as fractions of it (y from the top). Drawn flat (no perspective),
  // so the wheel is the same size wherever it sits. Every car at the same scale (PPU pixels a town unit), so the
  // picture's size (meta w, h) says how big the car is.
  function side(load, PPU = 20) {
    let W2 = 400, H2 = 160;
    if (!gl) setup();
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xe8f0ff, 0x6b5a48, 1.7));
    const key = new THREE.DirectionalLight(0xfff2dc, 2.4); key.position.set(-6, 7, 3); sc.add(key);
    const rim = new THREE.DirectionalLight(0xffc58a, 1.0); rim.position.set(3, 4, -6); sc.add(rim);
    const def = carDef(load, 3), unit = new Unit(def, mats, { seed: 3 });
    Object.assign(unit.state, { spin: 0, steer: 0, roll: 0, pitch: 0, bob: 0, yaw: 0, aim: 0, gunSpin: 0, saw: 0, coneYaw: 0, coneAim: 0, arc: 0 });
    unit.update(0);
    sc.add(unit.root); unit.root.updateMatrixWorld(true);
    const near = new Set(['wFR', 'wRR', 'hubFR', 'hubRR']);
    const meshes = (p) => p.meshes.filter(Boolean);
    const box = (parts) => { const bb = new THREE.Box3(); for (const p of parts) if (p.count) for (const m of meshes(p)) { m.geometry.computeBoundingBox(); bb.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); } return bb; };
    const all = box(unit.parts), c = all.getCenter(new THREE.Vector3());
    const cam2 = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
    cam2.position.copy(c).addScaledVector(new THREE.Vector3(-1, 0.2, 0).normalize(), 60); cam2.lookAt(c); cam2.updateMatrixWorld();
    // the car's corners on the screen's axes, then a frame of the picture's shape round them, sat on the bottom edge
    const toCam = (v) => v.clone().applyMatrix4(cam2.matrixWorldInverse);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of unit.parts) if (p.count) for (const m of meshes(p)) { const b = m.geometry.boundingBox; for (let i = 0; i < 8; i++) { const q = toCam(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(m.matrixWorld)); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); } }
    let fw = 0, fh = 0;
    const frame = (pad) => {
      const w = (x1 - x0) * pad, h = (y1 - y0) * pad, k = Math.max(w / W2, h / H2), mx = (x0 + x1) / 2; fw = W2 * k; fh = H2 * k;
      Object.assign(cam2, { left: mx - fw / 2, right: mx + fw / 2, bottom: y0 - (y1 - y0) * 0.01, top: y0 - (y1 - y0) * 0.01 + fh }); cam2.updateProjectionMatrix();
    };
    // the parts' boxes are roomier than their cubes, so draw it once and frame what was really drawn
    frame(1.02);
    const alpha = () => { const cv = document.createElement('canvas'); cv.width = W2; cv.height = H2; const cx = cv.getContext('2d'); cx.drawImage(gl.domElement, 0, 0); return cx.getImageData(0, 0, W2, H2).data; };
    {
      gl.setSize(W2, H2, false); gl.render(sc, cam2);
      const a = alpha(); let px0 = W2, px1 = -1, py0 = H2, py1 = -1;
      for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) if (a[(y * W2 + x) * 4 + 3] > 8) { if (x < px0) px0 = x; if (x > px1) px1 = x; if (y < py0) py0 = y; if (y > py1) py1 = y; }
      if (px1 >= 0) { const L0 = cam2.left, T0 = cam2.top; x0 = L0 + (px0 / W2) * fw; x1 = L0 + ((px1 + 1) / W2) * fw; y1 = T0 - (py0 / H2) * fh; y0 = T0 - ((py1 + 1) / H2) * fh; }
    }
    // then a picture of the car's own size: PPU pixels to a town unit for every car, so a truck comes out bigger than a car
    W2 = Math.round((x1 - x0) * 1.04 * PPU); H2 = Math.round((y1 - y0) * 1.04 * PPU);
    frame(1.04);
    const at = (v) => { const q = v.clone().project(cam2); return [(q.x + 1) / 2, (1 - q.y) / 2]; };
    const shot = (w3, h3) => { gl.setSize(w3, h3, false); gl.render(sc, cam2); return gl.domElement.toDataURL(load.webp ? 'image/webp' : 'image/png', 0.9); };
    // 1. the car, near wheels left out
    for (const p of unit.parts) for (const m of meshes(p)) m.visible = !near.has(p.name);
    const body = shot(W2, H2);
    // the car's front edge in 16 bands down the picture (where a shot coming at it from ahead lands), -1 for none
    const front = []; { const a = alpha(), n = H2 / 16; for (let i = 0; i < 16; i++) { let e = -1; for (let y = Math.floor(i * n); y < (i + 1) * n; y++) for (let x = W2 - 1; x > e; x--) if (a[(y * W2 + x) * 4 + 3] > 100) { e = x; break; } front.push(e < 0 ? -1 : Math.round((e / W2) * 1000) / 1000); } }
    // 2. the front near wheel alone, in a square of its own size
    const wheelParts = unit.parts.filter((p) => p.name === 'wFR' || p.name === 'hubFR');
    const wb = box(wheelParts), wc = wb.getCenter(new THREE.Vector3());
    const wheels = ['wFR', 'wRR'].map((n) => { const b = unit.bones[n], v = new THREE.Vector3(); b.getWorldPosition(v); const [x, y] = at(v); return { x, y }; });
    // its size on the picture: the wheel's own bounds seen from the camera
    let r = 0; { const cc = toCam(wc); for (const p of wheelParts) for (const m of meshes(p)) { const b = m.geometry.boundingBox; for (let i = 0; i < 8; i++) { const q = toCam(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(m.matrixWorld)); r = Math.max(r, Math.abs(q.x - cc.x), Math.abs(q.y - cc.y)); } } }
    const d = (2 * r) / fw, px = Math.max(8, Math.round(d * W2));
    for (const p of unit.parts) for (const m of meshes(p)) m.visible = wheelParts.includes(p);
    const saved = { left: cam2.left, right: cam2.right, top: cam2.top, bottom: cam2.bottom }, cc = toCam(wc);
    Object.assign(cam2, { left: cc.x - r, right: cc.x + r, bottom: cc.y - r, top: cc.y + r }); cam2.updateProjectionMatrix();
    const wheel = shot(px, px);
    Object.assign(cam2, saved); cam2.updateProjectionMatrix();
    // where the wheel centres really sit (the middle of the wheel's own bounds, which is what spins), and the muzzle
    const off = at(wc), piv = wheels[0]; for (const q of wheels) { q.x += off[0] - piv.x; q.y += off[1] - piv.y; }
    let gun = null;
    if (unit.bones.gun && def.muzzles && def.muzzles.gun) { const v = new THREE.Vector3(...def.muzzles.gun); unit.bones.gun.localToWorld(v); const [x, y] = at(v); gun = { x, y }; }
    unit.dispose(); gl.setSize(W, H, false);
    const f = (n) => Math.round(n * 1000) / 1000;
    return { body, wheel, meta: { wheels: wheels.map((q) => ({ x: f(q.x), y: f(q.y) })), d: f(d), gun: gun && { x: f(gun.x), y: f(gun.y) }, front, w: W2, h: H2 } };
  }
  return {
    side,
    // the picture of `key` in `slot` on this build, now if it has been drawn (a data URL, or null if it can't be)
    // and otherwise undefined, with cb called once it is
    get(slot, key, load, cb) {
      if (!ART_SLOTS.has(slot)) return null;
      const k = keyOf(slot, key, load);
      if (cache.has(k)) return cache.get(k);
      if (cb) { if (!wait.has(k)) wait.set(k, []); wait.get(k).push(cb); }
      if (!queue.some((j) => keyOf(j.slot, j.key, j.load) === k)) queue.push({ slot, key, load: { ...load } });
      if (!timer) timer = setTimeout(pump, 30);
      return undefined;
    },
    // drop waiting work (the tab changed): only the newest asks are drawn
    clear() { queue.length = 0; wait.clear(); },
    // the page is being left (leave.js): give its drawing context back
    dispose() { clearTimeout(timer); queue.length = 0; if (gl) { gl.dispose(); gl.forceContextLoss(); gl = null; } },
  };
}
