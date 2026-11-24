// Dead Man's Fair at twilight (its `look`, maps/fair.js: the bulbs strung between its lamp posts, the posts, and which
// quarters of the fair still have power).
//   - The sky: the sun has just gone. Deep violet overhead, down through magenta to a band of orange along the west,
//     a few clouds lit pink from below, and the first stars.
//   - The light: what is left of the day comes low out of the west (main.js's sun, which casts the shadows: long ones),
//     warm and not strong; the sky's light is a soft violet, strong enough that the dead never go to silhouettes.
//   - The fair's own light: every bulb on the strings is a glow (one draw for all of them and the cars' lamps), each
//     post throws a warm pool on the ground (one draw), and the voxels' lit cubes, the rides' lamps and the tent's are
//     full on (look.dusk).
//   - The power: where a quarter's lights are out (L.power.lit, which the map eases between 0 and 1) its bulbs and
//     pools go dark, and a layer over the ground there takes the ground down to a blue dusk. It multiplies what is
//     drawn, after everything solid, so the cars and the dead standing on it are never darkened: they stay easy to see.
// Its pictures are drawn at load and it adds no light of its own. Down the quality ladder: half the bulbs at step 3,
// the pools off at step 5.
import * as THREE from 'three';
import { look } from '../../../src/mesh.js';
import { ADD, TONE, cloudStrip, glowSprites, lampPools, groundSpots, carLamps, commit, pixelAt } from './kit.js';

export const FAIR = {
  sun: new THREE.Vector3(-0.78, 0.3, 0.38).normalize(), haze: 0x6a4a6e, fog: [340, 2300], exposure: 1.12,
  hemi: [0x9a94d8, 0x5a4658, 1.75], light: [0xffa878, 2.5], lamps: [1, 0.9], box: 110,
  dark: [0.42, 0.42, 0.62],   // what the ground is multiplied by where the lights are out
};
// the bulbs' colours: red, amber, green, blue, white
const BULB = [[2.6, 0.5, 0.35], [2.6, 1.7, 0.4], [0.6, 2.4, 0.7], [0.5, 1.2, 2.8], [2.2, 2.1, 1.8]];

export function setup(L, { scene, renderer, sky, hemi, sun }) {
  scene.fog.color.set(FAIR.haze); scene.fog.near = FAIR.fog[0]; scene.fog.far = FAIR.fog[1];
  renderer.setClearColor(scene.fog.color);
  renderer.toneMappingExposure = FAIR.exposure;
  hemi.color.set(FAIR.hemi[0]); hemi.groundColor.set(FAIR.hemi[1]); hemi.intensity = FAIR.hemi[2];
  sun.color.set(FAIR.light[0]); sun.intensity = FAIR.light[1];
  sky.material.dispose(); sky.material = skyMaterial();
  const sc = sun.shadow.camera; sc.top = FAIR.box; sc.bottom = -FAIR.box;   // (a low sun: see looks/dusk.js)
  return { sunDir: FAIR.sun };
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      zen: { value: new THREE.Color(0x15133a) }, high: { value: new THREE.Color(0x43357c) }, orange: { value: new THREE.Color(0xff8a4a) },
      pink: { value: new THREE.Color(0xa85a92) }, haze: { value: new THREE.Color(FAIR.haze) }, sun: { value: FAIR.sun },
      clouds: { value: cloudStrip() }, time: { value: 0 },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 zen; uniform vec3 high; uniform vec3 orange; uniform vec3 pink; uniform vec3 haze; uniform vec3 sun;
      uniform sampler2D clouds; uniform float time;
      varying vec3 vD;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vD); float h = d.y;
        float toward = dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), normalize(vec3(sun.x, 0.0, sun.z))) * 0.5 + 0.5;
        vec3 c = mix(high, zen, smoothstep(0.08, 0.7, h));
        vec3 band = mix(pink, orange, toward * toward * toward);
        c = mix(band, c, smoothstep(0.0, 0.14 + 0.26 * toward, h));
        // the afterglow where the sun went down
        float s = max(dot(d, normalize(vec3(sun.x, 0.02, sun.z))), 0.0);
        c += vec3(1.0, 0.5, 0.2) * (pow(s, 6.0) * 0.35 + pow(s, 40.0) * 0.5) * smoothstep(-0.05, 0.1, h);
        // the first stars, high up and away from the glow
        vec2 sp = d.xz / max(h + 0.25, 0.1) * 46.0; vec2 cell = floor(sp);
        float st = step(0.985, hash(cell)) * smoothstep(0.42, 0.1, length(fract(sp) - 0.5)) * smoothstep(0.25, 0.6, h) * (1.0 - toward * 0.7);
        c += vec3(0.9, 0.9, 1.0) * st * (0.6 + 0.4 * sin(time * 2.0 + hash(cell + 3.0) * 40.0));
        if (h > -0.02 && h < 0.5) {
          vec4 k = texture2D(clouds, vec2(atan(d.z, d.x) / 3.14159 + time * 0.001, max(h, 0.0) * 2.0));
          float a = smoothstep(0.16, 0.6, k.r) * smoothstep(0.0, 0.05, h) * smoothstep(0.45, 0.25, h);
          vec3 lit = mix(vec3(0.3, 0.2, 0.42), vec3(1.15, 0.5, 0.36), toward * toward) * (0.5 + 1.3 * k.g);
          c = mix(c, lit, a * 0.8);
        }
        c = mix(haze, c, smoothstep(-0.03, 0.05, h));
        gl_FragColor = vec4(c, 1.0);
        ${TONE}
      }`,
  });
}

// the layer that takes the ground down where the lights are out: one quad over the fair, each quarter's share of the
// dark eased across the midway and the avenue so no edge shows
function darkLayer(L) {
  const [x0, z0, x1, z1] = L.box, [mx, mz] = L.middle;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { lit: { value: new THREE.Vector4(1, 1, 1, 1) }, mid: { value: new THREE.Vector2(mx, mz) }, dark: { value: new THREE.Vector3(...FAIR.dark) } },
    vertexShader: 'varying vec2 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec4 lit; uniform vec2 mid; uniform vec3 dark; varying vec2 vW;
      void main() {
        float sx = smoothstep(mid.x - 26.0, mid.x + 26.0, vW.x), sz = smoothstep(mid.y - 26.0, mid.y + 26.0, vW.y);
        float k = mix(mix(lit.x, lit.y, sx), mix(lit.z, lit.w, sx), sz);
        gl_FragColor = vec4(mix(dark, vec3(1.0), clamp(k, 0.0, 1.0)), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), m);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2); mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
  mesh.renderOrder = -1; mesh.visible = false;
  return mesh;
}

const CAR_MAX = 4 * 40, POOL_MAX = 2 * 40;
export function make(L, { scene, renderer, camera, sky, mats, quality }) {
  look.dusk.value = 1;                 // every lit cube full on
  mats[1].color.setScalar(1.3);
  const bulbs = L.bulbs || [], posts = L.posts || [], P = L.power || { lit: [1, 1, 1, 1] };
  const glows = glowSprites(bulbs.length + posts.length + CAR_MAX), pools = lampPools(POOL_MAX), spots = groundSpots(posts.length), dark = darkLayer(L);
  for (const o of [dark, spots, pools, glows]) scene.add(o);
  const T = sky.material.uniforms.time;
  const A = glows.geometry.attributes, gp = A.gp.array, gc = A.gc.array, gd = A.gd.array;
  const B = spots.geometry.attributes, sa = B.sa.array, sb = B.sb.array, sc = B.sc.array;
  let time = 0, q = -1, pooled = true, every = 1, shown = [-1, -1, -1, -1], nStatic = 0;
  // the bulbs and the posts' lamps, then the posts' pools: written again only when a quarter's light has changed
  function lamps() {
    let n = 0;
    for (let i = 0; i < bulbs.length; i += every) {
      const [x, y, z, c, quarter] = bulbs[i], k = P.lit[quarter], col = BULB[c];
      gp.set([x, y, z, 1.5], n * 4); gc.set([col[0] * k, col[1] * k, col[2] * k, 0], n * 4); gd.set([0, 1, 0, 0], n * 4); n++;
    }
    for (const [x, z, quarter] of posts) { const k = P.lit[quarter]; gp.set([x, 16.6, z, 2.6], n * 4); gc.set([2.2 * k, 1.7 * k, 0.9 * k, 0], n * 4); gd.set([0, 1, 0, 0], n * 4); n++; }
    nStatic = n;
    let s = 0;
    for (const [x, z, quarter] of posts) { const k = P.lit[quarter]; sa.set([x, z, 30, 30], s * 4); sb.set([1, 0, 1.6, 0], s * 4); sc.set([0.2 * k, 0.14 * k, 0.07 * k, 0], s * 4); s++; }
    commit(spots, s, ['sa', 'sb', 'sc']);
  }
  function step(dt, cars) {
    time += dt; T.value = time;
    let changed = false;
    if (quality.step !== q) { q = quality.step; pooled = q <= 4; pools.visible = spots.visible = pooled; every = q >= 3 ? 2 : 1; changed = true; }
    for (let i = 0; i < 4; i++) if (Math.abs(P.lit[i] - shown[i]) > 0.004) { shown[i] = P.lit[i]; changed = true; }
    if (changed) {
      lamps();
      dark.material.uniforms.lit.value.set(P.lit[0], P.lit[1], P.lit[2], P.lit[3]);
      dark.visible = Math.min(P.lit[0], P.lit[1], P.lit[2], P.lit[3]) < 0.995;
    }
    glows.material.uniforms.ppx.value = pixelAt(camera, renderer);
    const [n, k] = carLamps(cars, glows, pools, nStatic, 0, pooled, nStatic + CAR_MAX, FAIR.lamps[0], FAIR.lamps[1]);
    commit(glows, n, ['gp', 'gc', 'gd']); commit(pools, k, ['pa', 'pb', 'pc']);
  }
  return { step };
}
