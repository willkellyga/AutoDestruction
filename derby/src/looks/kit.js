// What the maps' looks (./index.js) share: the blend and the tone step every hand-written shader here ends with, the
// soft beams, the glows (lamps, fires, beacons) and the pools of light on the ground, where a car's lamps are and how
// they are drawn each frame, a strip of clouds and a square of noise to make skies and mist from, and the way the
// world past a map's edge (backdrop.js) is kept out of the reach of a light meant for the map.
import * as THREE from 'three';
import { GLOW } from '../../../units/src/voxpart.js';

export const TAU = Math.PI * 2;
export const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
export const TONE = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';   // (no-ops inside the light pass, which does both at the end)
// a repeatable random number from 0 to 1, from its own seed
export const rng = (seed) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; }; };
const smooth = (t) => t * t * (3 - 2 * t);

// ---- pictures to make skies and mist from ---------------------------------------------------------------------------
// The clouds: soft noise in a strip that wraps round, thinned to patches. Red is how thick a cloud is there, green how
// much of its underside shows (thicker just above its foot).
export function cloudStrip() {
  const W = 512, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), img = g.createImageData(W, H), D = img.data;
  const r = rng(271828);
  const oct = [[5, 2], [10, 4], [20, 8], [40, 14]].map(([n, m]) => { const v = new Float32Array(n * (m + 1)); for (let i = 0; i < v.length; i++) v[i] = r(); return { n, m, v }; });
  const at = (o, x, y) => {
    const fx = x * o.n, fy = y * o.m, i = Math.floor(fx), j = Math.min(o.m - 1, Math.floor(fy)), tx = smooth(fx - i), ty = smooth(fy - j);
    const i0 = i % o.n, i1 = (i0 + 1) % o.n, a = o.v[j * o.n + i0], b = o.v[j * o.n + i1], c = o.v[(j + 1) * o.n + i0], d = o.v[(j + 1) * o.n + i1];
    return a + (b - a) * tx + (c + (d - c) * tx - a - (b - a) * tx) * ty;
  };
  const f = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0, amp = 0.53;
    for (const o of oct) { v += at(o, x / W, y / H) * amp; amp *= 0.5; }
    f[y * W + x] = Math.max(0, Math.min(1, (v - 0.5) / 0.3));
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, below = y < H - 4 ? f[i + 4 * W] : 0;   // (the canvas is upside down to the sky: its bottom row is the horizon)
    D[i * 4] = f[i] * f[i] * 255; D[i * 4 + 1] = Math.max(0, f[i] - below * 0.8) * 255; D[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  // no mipmaps: the picture's seam is where the angle round wraps, and a mipmap would draw a line down the sky there
  t.wrapS = THREE.RepeatWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  return t;
}
// A square of soft noise that tiles both ways (so it can be scrolled for ever, and has mipmaps without a seam): red
// is broad billows, green finer ones, made once at load.
export function noiseTile(seed, N = 256) {
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d'), img = g.createImageData(N, N), D = img.data, r = rng(seed);
  const grid = (n) => { const v = new Float32Array(n * n); for (let i = 0; i < v.length; i++) v[i] = r(); return { n, v }; };
  const at = (o, x, y) => {
    const fx = x * o.n, fy = y * o.n, i = Math.floor(fx), j = Math.floor(fy), tx = smooth(fx - i), ty = smooth(fy - j);
    const i0 = i % o.n, i1 = (i0 + 1) % o.n, j0 = j % o.n, j1 = (j0 + 1) % o.n, v = o.v;
    const a = v[j0 * o.n + i0], b = v[j0 * o.n + i1], c = v[j1 * o.n + i0], d = v[j1 * o.n + i1];
    return a + (b - a) * tx + (c + (d - c) * tx - a - (b - a) * tx) * ty;
  };
  const broad = [grid(4), grid(8), grid(16), grid(32)], fine = [grid(16), grid(32), grid(64)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let a = 0, b = 0, amp = 0.53;
    for (const o of broad) { a += at(o, x / N, y / N) * amp; amp *= 0.5; }
    amp = 0.57; for (const o of fine) { b += at(o, x / N, y / N) * amp; amp *= 0.5; }
    const i = (y * N + x) * 4;
    D[i] = Math.max(0, Math.min(255, (a - 0.12) / 0.76 * 255)); D[i + 1] = Math.max(0, Math.min(255, (b - 0.1) / 0.8 * 255)); D[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---- beams --------------------------------------------------------------------------------------------------------
// A beam is a soft cone, drawn from both sides and added on. Brightest where its side is seen square on (through the
// middle of it), fading to its edges, toward its far end, and close to the camera.
export const BEAM_FRAG = `uniform vec3 col; uniform float near; varying vec3 vN; varying vec3 vW; varying float vT;
  void main() {
    vec3 v = cameraPosition - vW; float d = max(length(v), 1e-3);
    float side = abs(dot(vN, v)) / (max(length(vN), 1e-4) * d);
    float a = side * side * pow(max(1.0 - vT, 0.0), 1.4) * smoothstep(0.0, 0.05, vT) * smoothstep(near * 0.2, near, d);
    gl_FragColor = vec4(col * a, 1.0);
    ${TONE}
  }`;

// ---- glows: lamps, fires and beacons ----------------------------------------------------------------------------------
// One quad an instance, turned to face the camera in the shader: a hot core, a wide soft halo and (for the floodlights)
// a thin flat streak. A lamp that faces a way is brightest seen from in front of it. Each is pulled a little toward the
// camera, so it is not buried in what it hangs on, and kept between a few pixels across far off and a set part of the
// view close to.
// per instance: gp (x, y, z, size), gc (colour, streak), gd (the way it faces, how much that matters)
export function glowSprites(max) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  for (const k of ['gp', 'gc', 'gd']) g.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount = 0;
  const m = new THREE.ShaderMaterial({
    ...ADD, uniforms: { ppx: { value: 0.002 } },
    vertexShader: `attribute vec4 gp; attribute vec4 gc; attribute vec4 gd; uniform float ppx; varying vec2 vUv; varying vec3 vC; varying float vS;
      void main() {
        vec3 to = cameraPosition - gp.xyz; float dist = max(length(to), 1e-3); vec3 v = to / dist;
        float face = mix(1.0, smoothstep(-0.2, 0.75, dot(gd.xyz, v)), gd.w);
        vec4 mv = viewMatrix * vec4(gp.xyz + v * min(gp.w * 0.8, dist * 0.5), 1.0);
        float s = clamp(gp.w * (0.4 + 0.6 * face), -mv.z * ppx * 3.0, -mv.z * 0.09);
        mv.xy += position.xy * s;
        gl_Position = projectionMatrix * mv;
        vUv = position.xy; vC = gc.rgb * face * face; vS = gc.w;
      }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vC; varying float vS;
      void main() { float r2 = dot(vUv, vUv);
        float a = exp(-r2 * 16.0) + 0.18 * exp(-r2 * 4.0) + vS * exp(-abs(vUv.y) * 26.0) * (1.0 - abs(vUv.x)) * 0.35;
        gl_FragColor = vec4(vC * a * (1.0 - smoothstep(0.7, 1.0, r2)), 1.0); ${TONE} }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 2;
  return mesh;
}
// The pools of light lamps throw on the ground: a fan ahead of each car from its headlamps, a small red one behind (and
// a beacon's turning sweep). per instance: pa (x, z, heading, strength), pb (where it starts along the heading, its
// length, its width there and at its end), pc (colour)
export function lampPools(max) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3)); g.setIndex([0, 2, 1, 0, 3, 2]);
  for (const k of ['pa', 'pb', 'pc']) g.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount = 0;
  const m = new THREE.ShaderMaterial({
    ...ADD, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6,
    vertexShader: `attribute vec4 pa; attribute vec4 pb; attribute vec4 pc; varying vec2 vUv; varying vec3 vC;
      void main() {
        vec2 f = vec2(sin(pa.z), cos(pa.z)), side = vec2(f.y, -f.x);
        vec2 xz = pa.xy + f * (pb.x + pb.y * position.x) + side * mix(pb.z, pb.w, position.x) * position.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(xz.x, 0.07, xz.y, 1.0);
        vUv = position.xy; vC = pc.rgb * pa.w;
      }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vC;
      void main() { float a = smoothstep(0.0, 0.12, vUv.x) * pow(max(1.0 - vUv.x, 0.0), 1.5) * max(1.0 - vUv.y * vUv.y, 0.0);
        gl_FragColor = vec4(vC * a, 1.0); ${TONE} }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 0;
  return mesh;
}
// Round pools of light on the ground (a searchlight's spot, the glow round a fire): soft ellipses, one quad each.
// per instance: sa (x, z, radius across, radius along), sb (the way "along" points: x, z; how sharp the edge is), sc
// (colour)
export function groundSpots(max) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 2, 1, 0, 3, 2]);
  for (const k of ['sa', 'sb', 'sc']) g.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount = 0;
  const m = new THREE.ShaderMaterial({
    ...ADD, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6,
    vertexShader: `attribute vec4 sa; attribute vec4 sb; attribute vec4 sc; varying vec2 vUv; varying vec3 vC; varying float vE;
      void main() {
        vec2 along = sb.xy, across = vec2(along.y, -along.x);
        vec2 xz = sa.xy + across * position.x * sa.z + along * position.y * sa.w;
        gl_Position = projectionMatrix * viewMatrix * vec4(xz.x, 0.08, xz.y, 1.0);
        vUv = position.xy; vC = sc.rgb; vE = sb.z;
      }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vC; varying float vE;
      void main() { float r = length(vUv); float a = (1.0 - smoothstep(1.0 - 1.0 / max(vE, 1.01), 1.0, r)) * (0.55 + 0.45 * max(1.0 - r * r, 0.0));
        gl_FragColor = vec4(vC * a, 1.0); ${TONE} }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 0;
  return mesh;
}
// after writing n instances' worth of attributes: send just those, and draw just those
export function commit(mesh, n, keys) {
  const g = mesh.geometry; g.instanceCount = n;
  for (const k of keys) { const a = g.attributes[k]; a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; }
}

// ---- the cars' lamps ----------------------------------------------------------------------------------------------------
// Where a car's lamps are, found once from its model: the glowing cubes of its body that are white or warm (the
// headlamps) toward the front, and red toward the back (the tail lamps), each side's averaged, at the lamps' outer
// face. In the car's own space (+x its left, +z forward), from its middle on the ground.
const _v = new THREE.Vector3();
function lampsOf(c) {
  const u = c.unit, body = u.parts.find((p) => p.name === 'body');
  const L = { head: [[0, 0, -1e9, 0], [0, 0, -1e9, 0]], tail: [[0, 0, 1e9, 0], [0, 0, 1e9, 0]] }, acc = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  if (body && body.bone) {
    u.root.updateWorldMatrix(true, true);
    const { nx, ny, nz, col, h } = body;
    for (let k = 0, n = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++, n++) {
      const v = col[n]; if (v < 0 || !(v & GLOW)) continue;
      const R = (v >> 16) & 255, G = (v >> 8) & 255, Bc = v & 255, z = (body.k0 + k + 0.5) * h;
      const kind = R > 200 && G > 190 && Bc > 140 && z > 0 ? 'head' : R > 180 && G < 90 && z < 0 ? 'tail' : null;
      if (!kind) continue;
      _v.set((body.i0 + i + 0.5) * h, (body.j0 + j + 0.5) * h, z); body.bone.localToWorld(_v); u.root.worldToLocal(_v);
      const side = _v.x > 0 ? 0 : 1, e = L[kind][side], a = acc[(kind === 'head' ? 0 : 2) + side];
      a[0] += _v.x; a[1] += _v.y; e[3]++;
      e[2] = kind === 'head' ? Math.max(e[2], _v.z + h) : Math.min(e[2], _v.z - h);
    }
    for (const [kind, o] of [['head', 0], ['tail', 2]]) for (const s of [0, 1]) { const e = L[kind][s]; if (e[3]) { e[0] = acc[o + s][0] / e[3]; e[1] = acc[o + s][1] / e[3]; } }
  }
  // a model without lamps found (they were shot off, say) still shows where they would be
  for (const [kind, z] of [['head', c.mid + c.half], ['tail', c.mid - c.half]]) for (const s of [0, 1]) {
    const e = L[kind][s]; if (!e[3]) { e[0] = (s ? -1 : 1) * c.wide * 0.65; e[1] = 2; e[2] = z; }
  }
  // a ram or a plow standing out past the headlamps would hide them, so their glow goes on its front (and the tail
  // lamps' on the back of a mine dropper)
  for (const e of L.head) e[2] = Math.max(e[2], c.mid + c.half + 0.3);
  for (const e of L.tail) e[2] = Math.min(e[2], c.mid - c.half - 0.3);
  return L;
}
// Every car's lamps, from its heading and its lamps' places, into the glows from instance n on and the pools from k on
// (the pools only while `pooled`); returns where each ended. `k` scales the glows and `kp` the pools (1 at night: by
// day's end they show less).
export function carLamps(cars, glows, pools, n, k, pooled, max, kg = 1, kp = 1) {
  const A = glows.geometry.attributes, gp = A.gp.array, gc = A.gc.array, gd = A.gd.array;
  const B = pools.geometry.attributes, pa = B.pa.array, pb = B.pb.array, pc = B.pc.array, pmax = pa.length / 4;
  for (const c of cars) {
    if (c.gone || c.dead || !c.unit.root.visible || n + 4 > max) continue;   // (out with the car as it blinks back in)
    const L = c._lamps || (c._lamps = lampsOf(c)), s = Math.sin(c.yaw), co = Math.cos(c.yaw);
    const braking = c.brake > 0 || c.throttle < 0 || c.hbBrake > 0;
    for (const [kind, sgn] of [['head', 1], ['tail', -1]]) for (const e of L[kind]) {
      gp.set([c.x + e[0] * co + e[2] * s, e[1], c.z - e[0] * s + e[2] * co, kind === 'head' ? 1.9 : braking ? 2 : 1.5], n * 4);
      gc.set(kind === 'head' ? [1.2 * kg, 1.1 * kg, 0.9 * kg, 0.3] : braking ? [2.4 * kg, 0.25 * kg, 0.15 * kg, 0] : [1.3 * kg, 0.12 * kg, 0.08 * kg, 0], n * 4);
      gd.set([s * sgn, 0, co * sgn, 0.92], n * 4); n++;
    }
    if (pooled && k + 2 <= pmax) {
      const front = Math.max(L.head[0][2], L.head[1][2]) - 0.5, back = Math.min(L.tail[0][2], L.tail[1][2]) + 0.5;
      pa.set([c.x, c.z, c.yaw, kp], k * 4); pb.set([front, 34, c.wide * 0.8, c.wide * 3.2], k * 4); pc.set([0.26, 0.23, 0.18, 0], k * 4); k++;
      pa.set([c.x, c.z, c.yaw, (braking ? 1.8 : 1) * kp], k * 4); pb.set([back, -9, c.wide * 0.8, c.wide * 1.6], k * 4); pc.set([0.12, 0.012, 0.008, 0], k * 4); k++;
    }
  }
  return [n, k];
}
// the size of a pixel at a distance of one, for the glows' smallest size
export const pixelAt = (camera, renderer) => 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, renderer.domElement.height);

// ---- the world past the edge ------------------------------------------------------------------------------------------
// A map's direct lights (three.js's directional lights reach everywhere) can be meant for the map alone: the arena's
// floodlights are aimed into the pit, and a storm's moon is behind cloud. The world past its edge (backdrop.js) then
// gets only `spill` of them, and is lit by its own lamps and windows and the sky. Its lit materials take one more step,
// after their own: the direct light scaled down.
export function outOfReach(objects, spill) {
  for (const o of objects) {
    const m = o.material; if (!m || !m.isMeshLambertMaterial) continue;
    const before = m.onBeforeCompile, key = m.customProgramCacheKey;
    m.onBeforeCompile = (sh, r) => {
      before.call(m, sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <aomap_fragment>', `reflectedLight.directDiffuse *= ${spill.toFixed(3)};\n#include <aomap_fragment>`);
    };
    m.customProgramCacheKey = () => key.call(m) + '-spill';
    m.needsUpdate = true;
  }
}
