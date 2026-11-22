// Manhattan Circuit races at the end of a summer's day (its `look`, maps/manhattan.js).
//   - The sun: low in the south-east (main.js's sun, which casts the shadows), warm, so the towers throw long shadows
//     across the streets and light comes down the avenues between them. Where it stands, the start straight and most of
//     the lap are not driven into it: the top run heads east with it off to the right across the park, and the long
//     runs west and north have it behind. Coming down the river drive it is ahead and to the left, glaring when it
//     shows between the towers.
//   - The sky: deep blue overhead, paling lower down, to a band of orange round the foot of the sky toward the sun and
//     pink away from it; the sun's disc with a glow round it, and a few clouds, gold on the side toward the sun and pink
//     on the other, brightest along their undersides.
//   - The fog: a warm haze, between the two, so the far towers go soft and gold.
//   - The light: the sky's light a cool blue (the shadows are blue against the warm sun), the windows and the street
//     lamps starting to glow (look.dusk part way), and the cars' lamps on.
// Its own draws: the sun's glare, the cars' lamps' glows and their pools. Its pictures are drawn at load, and it adds
// no light. Down the quality ladder the pools go at step 5.
import * as THREE from 'three';
import { look } from '../../../src/mesh.js';
import { ADD, TONE, cloudStrip, glowSprites, lampPools, carLamps, commit, pixelAt } from './kit.js';

// the look: the way to the sun, the haze (the fog, and the sky at its foot), the fog's start and end, the exposure, the
// sky light (sky colour, ground colour, strength), the sun (colour, strength), how far the windows and lamps are on
// (look.dusk, 0 to 1), how strongly the cars' lamps show (glows, pools: 1 at night) and the shadow box's half height
export const DUSK = {
  sun: new THREE.Vector3(0.62, 0.42, 0.62).normalize(), haze: 0xd39a80, fog: [380, 1720], exposure: 1.2,
  hemi: [0xb8c8ec, 0x8a705a, 1.85], light: [0xffbe8a, 4.1], dusk: 0.3, lamps: [0.75, 0.6], box: 110,
};

export function setup(L, { scene, renderer, sky, hemi, sun }) {
  scene.fog.color.set(DUSK.haze); scene.fog.near = DUSK.fog[0]; scene.fog.far = DUSK.fog[1];
  renderer.setClearColor(scene.fog.color);
  renderer.toneMappingExposure = DUSK.exposure;
  hemi.color.set(DUSK.hemi[0]); hemi.groundColor.set(DUSK.hemi[1]); hemi.intensity = DUSK.hemi[2];
  sun.color.set(DUSK.light[0]); sun.intensity = DUSK.light[1];
  sky.material.dispose(); sky.material = skyMaterial();
  // The shadow box (main.js) is sized for a high sun. A low one lays its height out along the ground, near twice as
  // far, and takes in twice the city to draw into the shadows, so here it is half as tall: it covers about the ground
  // it did, at twice the detail that way. (It still moves in whole texels: main.js steps it by the width's, two of these.)
  const sc = sun.shadow.camera; sc.top = DUSK.box; sc.bottom = -DUSK.box;
  return { sunDir: DUSK.sun };
}

// ---- the sky ------------------------------------------------------------------------------------------------------
// Overhead to the foot: deep blue, a paler blue, then the warm band (orange toward the sun, pink away from it, and
// taller toward it), then the haze. The sun: a disc too bright for the screen (the light pass blooms it), a tight glow
// and a wide warm one that colours that side of the sky. The clouds are the night's strip of them (kit.js), thinned to
// a few and lit from the side the sun is on.
function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      zen: { value: new THREE.Color(0x172c5e) }, high: { value: new THREE.Color(0x4f6ca8) }, orange: { value: new THREE.Color(0xffa04e) },
      pink: { value: new THREE.Color(0xd9879a) }, haze: { value: new THREE.Color(DUSK.haze) }, sun: { value: DUSK.sun },
      clouds: { value: cloudStrip() }, time: { value: 0 },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 zen; uniform vec3 high; uniform vec3 orange; uniform vec3 pink; uniform vec3 haze; uniform vec3 sun;
      uniform sampler2D clouds; uniform float time;
      varying vec3 vD;
      void main() {
        vec3 d = normalize(vD); float h = d.y;
        float s = max(dot(d, sun), 0.0);
        float toward = dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), normalize(vec3(sun.x, 0.0, sun.z))) * 0.5 + 0.5;
        vec3 c = mix(high, zen, smoothstep(0.1, 0.75, h));
        vec3 band = mix(pink, orange, toward * toward);
        c = mix(band, c, smoothstep(0.0, 0.2 + 0.22 * toward, h));
        c = mix(haze, c, smoothstep(-0.03, 0.05, h));
        float s2 = s * s, s8 = s2 * s2 * s2 * s2;
        c += vec3(1.0, 0.55, 0.22) * (s8 * 0.45 + pow(s, 90.0) * 0.9);
        if (h > -0.02 && h < 0.5) {
          vec4 k = texture2D(clouds, vec2(atan(d.z, d.x) / 3.14159 + time * 0.0015, max(h, 0.0) * 2.0));
          float a = smoothstep(0.12, 0.55, k.r) * smoothstep(0.0, 0.05, h) * smoothstep(0.45, 0.25, h);
          vec3 lit = mix(vec3(0.62, 0.34, 0.46), vec3(1.25, 0.72, 0.36), toward * toward) * (0.55 + 1.5 * k.g) + vec3(1.4, 0.8, 0.4) * pow(s, 24.0) * 1.2;
          c = mix(c, lit, a * 0.85);
        }
        c = mix(c, vec3(5.2, 3.7, 2.1), smoothstep(0.99955, 0.99975, s));
        gl_FragColor = vec4(c, 1.0);
        ${TONE}
      }`,
  });
}

// The sun's glare: one quad far off toward the sun (placed from the camera in the shader, so it is always where the
// disc is), tested against what stands in front of it, so a tower in the way hides it: a hot middle, a soft warm
// halo and a faint flat streak.
function sunGlare() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const m = new THREE.ShaderMaterial({
    ...ADD, uniforms: { sun: { value: DUSK.sun } },
    vertexShader: `uniform vec3 sun; varying vec2 vUv;
      void main() { vec4 mv = viewMatrix * vec4(cameraPosition + sun * 1400.0, 1.0); mv.xy += position.xy * 300.0;
        gl_Position = projectionMatrix * mv; vUv = position.xy; }`,
    fragmentShader: `varying vec2 vUv;
      void main() { float r2 = dot(vUv, vUv);
        float a = exp(-r2 * 30.0) * 1.2 + 0.22 * exp(-r2 * 5.0) + exp(-abs(vUv.y) * 40.0) * (1.0 - abs(vUv.x)) * 0.25;
        gl_FragColor = vec4(vec3(1.4, 0.9, 0.5) * a * (1.0 - smoothstep(0.6, 1.0, r2)), 1.0); ${TONE} }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 2;
  return mesh;
}

// ---- it all, and its frame --------------------------------------------------------------------------------------------
const GLOW_MAX = 4 * 40, POOL_MAX = 2 * 40;
export function make(L, { scene, renderer, camera, sky, mats, quality }) {
  look.dusk.value = DUSK.dusk;         // the windows and the street lamps coming on
  mats[1].color.setScalar(1.25);       // the cars' lamps a little brighter than by day
  const glare = sunGlare(), glows = glowSprites(GLOW_MAX), pools = lampPools(POOL_MAX);
  for (const o of [glare, glows, pools]) scene.add(o);
  const T = sky.material.uniforms.time;
  let time = 0, q = -1, pooled = true;
  function step(dt, cars) {
    time += dt; T.value = time;
    if (quality.step !== q) { q = quality.step; pooled = q <= 4; pools.visible = pooled; }
    glows.material.uniforms.ppx.value = pixelAt(camera, renderer);
    const [n, k] = carLamps(cars, glows, pools, 0, 0, pooled, GLOW_MAX, DUSK.lamps[0], DUSK.lamps[1]);
    commit(glows, n, ['gp', 'gc', 'gd']); commit(pools, k, ['pa', 'pb', 'pc']);
  }
  return { step };
}
