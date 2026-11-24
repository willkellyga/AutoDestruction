// What a drift looks like (vehicle.js drives it, tuning.js DRIFT tunes it): dark skid marks laid on the ground behind
// the back wheels, tyre smoke off them, sparks off them while a slide charges a boost (their colour shows its level),
// and on the HUD a meter that fills while a slide is held at an angle and flashes when it pays out a burst.
//
// The marks are one mesh: a ring of quads, DRIFT.marks of them (half on phones), each the strip between where a back
// wheel was and where it is. A new quad takes the oldest one's place, and the oldest fifth fade out in the shader as
// they wait their turn, so it costs one draw and a few vertices sent a frame however much anyone drifts.
//
// On dirt (soft(x, z), from ground.js, says how much the ground there is) there are no black marks and no white smoke:
// the wheels cut ruts and throw the dirt up instead (dirt.js).
import * as THREE from 'three';
import { dust, sparks } from '../../src/sim.js';
import { DRIFT } from './tuning.js';

const SEG = 1.4;      // voxels a wheel travels between one piece of mark and the next
const Y = 0.05;       // just above the ground
const SMOKE_FAR = 260;

export function makeDrift({ scene, camera, mobile, el, soft = null }) {
  const N = Math.round(DRIFT.marks * (mobile ? 0.5 : 1));
  const pos = new Float32Array(N * 6 * 3), aa = new Float32Array(N * 6 * 2);   // per vertex: alpha, and the piece's number
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aa', new THREE.BufferAttribute(aa, 2).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { head: { value: 0 }, span: { value: N }, color: { value: new THREE.Color(0x0b0a09) } }]),
    vertexShader: `attribute vec2 aa; uniform float head; uniform float span; varying float vA;
      #include <fog_pars_vertex>
      void main() { float age = head - aa.y; vA = aa.x * clamp((span - age) / (span * 0.2), 0.0, 1.0);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 color; varying float vA;
      #include <fog_pars_fragment>
      void main() { gl_FragColor = vec4(color, vA);
        #include <fog_fragment>
        #ifdef USE_FOG
          gl_FragColor.a *= 1.0 - fogFactor;
        #endif
      }`,
    transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 1;
  scene.add(mesh);
  let head = 0, lo = Infinity, hi = -1;   // the next piece's number, and the span of pieces written this frame
  function piece(a, b, alphaA, alphaB) {
    const i = head % N, o = i * 18, q = i * 12, n = head++;
    // two triangles: a's edge (left, right) to b's edge
    const P = [a[0], a[1], b[0], a[1], b[1], b[0]], A = [alphaA, alphaA, alphaB, alphaA, alphaB, alphaB];
    for (let k = 0; k < 6; k++) { pos[o + k * 3] = P[k][0]; pos[o + k * 3 + 1] = Y; pos[o + k * 3 + 2] = P[k][1]; aa[q + k * 2] = A[k]; aa[q + k * 2 + 1] = n; }
    lo = Math.min(lo, i); hi = Math.max(hi, i);
  }
  function flush() {
    mat.uniforms.head.value = head;
    if (hi < 0) return;
    for (const [at, w] of [[g.attributes.position, 18], [g.attributes.aa, 12]]) { at.clearUpdateRanges(); at.addUpdateRange(lo * w, (hi - lo + 1) * w); at.needsUpdate = true; }
    lo = Infinity; hi = -1;
  }

  // the back wheels of a car, in its own space (+x its left, +z forward), and how wide the tyres are
  function rear(c) {
    if (c._rear) return c._rear;
    const parts = c.def.parts(), h = c.def.h, w = parts.find((p) => p.name === 'wRL');
    const out = w ? { x: Math.abs(w.pivot[0]) * h, z: w.pivot[2] * h, half: Math.max(0.65, (w.box[3] - w.box[0]) * h * 0.5) } : { x: c.wide * 0.8, z: c.mid - c.half * 0.6, half: 0.6 };
    return (c._rear = out);
  }
  const _c = new THREE.Vector3();
  function wheels(c, dt, near) {
    const R = rear(c), s = Math.sin(c.yaw), co = Math.cos(c.yaw), on = c.skid > 0.12 && !c.gone;
    const tr = c._tr || (c._tr = [{ on: false }, { on: false }]);
    for (let k = 0; k < 2; k++) {
      const T = tr[k], lx = k ? -R.x : R.x;
      const x = c.x + lx * co + R.z * s, z = c.z - lx * s + R.z * co;
      if (!on || (soft && soft(x, z) > 0.5)) { T.on = false; continue; }
      // the strip's edges lie across the way the wheel is going
      const dx = x - (T.x ?? x), dz = z - (T.z ?? z), d = Math.hypot(dx, dz);
      if (!T.on || d > 8) { T.on = true; T.x = x; T.z = z; T.a = 0; T.e = null; continue; }   // a new mark (or the car was moved)
      if (d < SEG) continue;
      const px = -dz / d * R.half, pz = dx / d * R.half;
      const e = [[x + px, z + pz], [x - px, z - pz]];
      const a = Math.min(0.82, 0.25 + c.skid * 0.6);
      piece(T.e || [[T.x + px, T.z + pz], [T.x - px, T.z - pz]], e, T.a, a);
      T.x = x; T.z = z; T.e = e; T.a = a;
    }
    // smoke off the back wheels, more the harder they skid (only near the camera)
    if (near && c.skid > 0.25) {
      const n = (mobile ? 16 : 30) * c.skid * dt;
      for (let k = 0; k < 2; k++) { const T = tr[k]; if (T.on) dust(T.x, 0.9, T.z, n, 1.4, 0.9, 0.9, 0.92); }
    }
    // a slide charging a boost: sparks off the back wheels, more and hotter as it climbs the levels (yellow, orange,
    // blue: DRIFT.boost.rgb), so you can see when to let go
    const B = DRIFT.boost;
    if (near && c.driftLvl > 0 && c.slide > 0.4) {
      const [r, g, b] = B.rgb[c.driftLvl - 1], n = (mobile ? 0.6 : 1) * (14 + 10 * c.driftLvl) * dt;
      for (let k = 0; k < 2; k++) {
        const m = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); if (!m) continue;
        const lx = k ? -R.x : R.x;
        sparks(c.x + lx * co + R.z * s, 0.7, c.z - lx * s + R.z * co, m, r, g, b, 8 + 3 * c.driftLvl);
      }
    }
    // a drift's burst: sparks out of the back in its level's colour
    if (near && c.miniT > 0 && c.miniLvl > 0 && Math.random() < 0.8) {
      const [r, g, b] = B.rgb[c.miniLvl - 1];
      const bx = c.x - s * (c.half - c.mid + 0.4), bz = c.z - co * (c.half - c.mid + 0.4);
      sparks(bx, 1.2, bz, 1 + c.miniLvl, r, g, b, 10 + 2 * c.miniLvl);
    }
  }

  // the meter: shown while the player holds a slide, filling towards the top level, with a notch at each level
  let shown = false, flashT = 0, lvlShown = -1;
  const bar = el && el.querySelector('s'), label = el && el.querySelector('b');
  const NAMES = ['Drift', 'Boost', 'Big boost', 'Mega boost'];   // (charging; with a ! when it fires)
  const LV = ['lv1', 'lv2', 'lv3'];
  if (el) { const i = el.querySelector('i'); for (const t of DRIFT.boost.at.slice(0, 2)) { const u = document.createElement('u'); u.style.left = `${t / DRIFT.boost.at[2] * 100}%`; i.appendChild(u); } }
  function meter(p, dt) {
    if (!el) return;
    if (flashT > 0 && (flashT -= dt) <= 0) el.classList.remove('boost');
    const B = DRIFT.boost, on = flashT > 0 || (p && !p.dead && p.slide > 0.5 && p.driftT > 0.12);
    if (on !== shown) { shown = on; el.classList.toggle('on', on); }
    if (!on || flashT > 0) return;
    const lvl = p.driftLvl || 0;
    bar.style.width = `${Math.min(1, p.driftT / B.at[2]) * 100}%`;
    if (lvl !== lvlShown) { lvlShown = lvl; LV.forEach((c, k) => el.classList.toggle(c, lvl === k + 1)); label.textContent = NAMES[lvl]; }
  }

  return {
    step(dt, cars, player) {
      for (const c of cars) {
        if (c.gone) continue;
        const near = c === player || camera.position.distanceToSquared(c.centre(_c)) < SMOKE_FAR * SMOKE_FAR;
        wheels(c, dt, near);
      }
      flush();
      meter(player, dt);
    },
    // a drift paid out a burst (vehicle.js, through main.js's hooks)
    boost(c, lvl) {
      if (!el) return;
      flashT = 1.1; lvlShown = -1; shown = true;
      el.classList.add('on'); LV.forEach((k, i) => el.classList.toggle(k, lvl === i + 1)); el.classList.remove('boost'); void el.offsetWidth; el.classList.add('boost');
      label.textContent = `${NAMES[lvl]}!`; bar.style.width = '100%';
      // a ring of sparks round the car as it fires
      const [r, g, b] = DRIFT.boost.rgb[lvl - 1];
      sparks(c.x, 1.5, c.z, (mobile ? 8 : 14) * lvl, r, g, b, 18 + 6 * lvl);
    },
  };
}
