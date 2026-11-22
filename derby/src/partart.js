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
  return {
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
  };
}
