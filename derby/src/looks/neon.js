// Midnight Tokyo races at night, in a lit city (its `look`, maps/tokyo.js: the street lamps along the course, the signs'
// glows and the coloured light the big signs throw on the road).
//   - The sky: blue-black overhead, a deep violet lower down and the city's own glow round its foot, magenta one way
//     and amber the other; a few clouds lit from below, the first stars high up, and a full moon over the start.
//   - The fog: the colour of that glow, thin, so the lit towers a long way off still show through it.
//   - The light: main.js's sun is the moon, cool and not strong, high over the north so the shadows are short; the
//     sky's light is a blue-violet strong enough that the road, the kerbs and a rival's car always read. Every lit
//     cube, window and sign is full on (look.dusk).
//   - The street: a lamp every fifty voxels or so along the course, each a glow on its post and a pool of light on the
//     road under it; the tunnel's are amber. A big sign throws a pool of its own colour.
//   - The cars: a glow on each head and tail lamp and a pool of light on the road ahead, at the road's own height (the
//     flyover, the bridges and the tunnel).
// Its draws: the sky's, the glows (the lamps', the signs' and the cars' together), the pools under the lamps and the
// cars' lamp pools. Its pictures are drawn at load and it adds no light. Down the quality ladder: half the lamps'
// glows at step 3, the pools off at step 5.
import * as THREE from 'three';
import { look } from '../../../src/mesh.js';
import { TONE, cloudStrip, glowSprites, lampPools, groundSpots, carLamps, commit, pixelAt } from './kit.js';

export const NEON = {
  moon: new THREE.Vector3(0.28, 0.74, -0.61).normalize(), haze: 0x2a1c3c, fog: [380, 2600], exposure: 1.08,
  hemi: [0x8f9be6, 0x4c4264, 1.55], light: [0xb9c8ff, 1.25], lamps: [1, 1], box: [115, 105],
};

export function setup(L, { scene, renderer, sky, hemi, sun }) {
  scene.fog.color.set(NEON.haze); scene.fog.near = NEON.fog[0]; scene.fog.far = NEON.fog[1];
  renderer.setClearColor(scene.fog.color);
  renderer.toneMappingExposure = NEON.exposure;
  hemi.color.set(NEON.hemi[0]); hemi.groundColor.set(NEON.hemi[1]); hemi.intensity = NEON.hemi[2];
  sun.color.set(NEON.light[0]); sun.intensity = NEON.light[1];
  sky.material.dispose(); sky.material = skyMaterial();
  const sc = sun.shadow.camera; sc.left = -NEON.box[0]; sc.right = NEON.box[0]; sc.top = NEON.box[1]; sc.bottom = -NEON.box[1]; sc.updateProjectionMatrix();   // (a high moon: see looks/spring.js)
  return { sunDir: NEON.moon };
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x03040c) }, mid: { value: new THREE.Color(0x0d1034) }, pink: { value: new THREE.Color(0x6a2c70) }, amber: { value: new THREE.Color(0x7a4630) },
      haze: { value: new THREE.Color(NEON.haze) }, moon: { value: NEON.moon }, clouds: { value: cloudStrip() }, time: { value: 0 },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 pink; uniform vec3 amber; uniform vec3 haze; uniform vec3 moon; uniform sampler2D clouds; uniform float time;
      varying vec3 vD;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vD); float h = d.y;
        float az = atan(d.z, d.x);
        vec3 glow = mix(pink, amber, 0.5 + 0.5 * sin(az * 2.0 + 0.6));
        vec3 c = mix(mid, top, smoothstep(0.1, 0.8, h));
        c = mix(glow, c, smoothstep(0.0, 0.26, h));
        // the stars, high up
        vec2 sp = d.xz / max(h + 0.25, 0.1) * 150.0; vec2 cell = floor(sp);
        float st = step(0.986, hash(cell)) * smoothstep(0.45, 0.1, length(fract(sp) - 0.5)) * smoothstep(0.2, 0.55, h) * (0.4 + 0.6 * hash(cell + 7.0));
        c += vec3(0.85, 0.9, 1.0) * st * (0.55 + 0.45 * sin(time * 1.7 + hash(cell + 3.0) * 40.0));
        float m = max(dot(d, moon), 0.0), m2 = m * m, m8 = m2 * m2 * m2 * m2;
        c += vec3(0.5, 0.58, 0.8) * (pow(m, 320.0) * 0.22 + m8 * m8 * 0.03);
        if (h > 0.0 && h < 0.5) {
          vec4 k = texture2D(clouds, vec2(az / 3.14159 + time * 0.0015, h * 2.0));
          float a = k.r * smoothstep(0.0, 0.07, h) * smoothstep(0.5, 0.3, h);
          vec3 lit = mix(glow * 1.15, glow * 0.5 + mid, smoothstep(0.04, 0.4, h)) * (0.5 + 1.9 * k.g) + vec3(0.5, 0.55, 0.7) * pow(m, 30.0) * 0.4;
          c = mix(c, lit, a * 0.85);
        }
        vec3 mu = normalize(cross(moon, vec3(0.0, 1.0, 0.0))), mv = cross(mu, moon);
        vec2 q = vec2(dot(d, mu), dot(d, mv)) / 0.028;
        float r = length(q);
        if (m > 0.99 && r < 1.05) {
          float sea = smoothstep(0.42, 0.18, length(q - vec2(-0.25, 0.3))) + smoothstep(0.3, 0.1, length(q - vec2(0.35, 0.1))) * 0.8 + smoothstep(0.28, 0.08, length(q - vec2(0.05, -0.45))) * 0.7;
          vec3 disc = vec3(2.2, 2.15, 2.0) * (0.78 + 0.22 * sqrt(max(0.0, 1.0 - r * r))) * (1.0 - 0.28 * min(sea, 1.0));
          c = mix(c, disc, smoothstep(1.0, 0.93, r));
        }
        c = mix(haze, c, smoothstep(-0.03, 0.05, h));
        gl_FragColor = vec4(c, 1.0);
        ${TONE}
      }`,
  });
}

// L.lamps: each [x, y, z, colour (r, g, b), size, its pool or null: [x, z, radius across, radius along, the way along (x, z), the road's height]]
// L.signs: each { at: [x, y, z], rgb, size, pool: [x, z, radius, height] or none }
const CAR_MAX = 4 * 40, POOL_MAX = 2 * 40;
export function make(L, { scene, renderer, camera, sky, mats, quality }) {
  look.dusk.value = 1;                 // every lit cube and window full on
  mats[1].color.setScalar(1.4);        // the cars' lamps (and gun flashes) bright enough to bloom
  const lamps = L.lamps || [], signs = L.signs || [];
  const glows = glowSprites(lamps.length + signs.length + CAR_MAX), pools = lampPools(POOL_MAX), spots = groundSpots(lamps.length + signs.length);
  for (const o of [spots, pools, glows]) scene.add(o);
  const T = sky.material.uniforms.time;
  const A = glows.geometry.attributes, gp = A.gp.array, gc = A.gc.array, gd = A.gd.array;
  const B = spots.geometry.attributes, sa = B.sa.array, sb = B.sb.array, sc = B.sc.array;
  let time = 0, q = -1, pooled = true, nStatic = 0;
  function fixed(every) {
    let n = 0, s = 0;
    for (let i = 0; i < lamps.length; i++) {
      const [x, y, z, rgb, size, pool] = lamps[i];
      if (i % every === 0) { gp.set([x, y, z, size], n * 4); gc.set([rgb[0], rgb[1], rgb[2], 0], n * 4); gd.set([0, -1, 0, 0], n * 4); n++; }
      if (pooled && pool) { sa.set([pool[0], pool[1], pool[2], pool[3]], s * 4); sb.set([pool[4], pool[5], 1.5, 0], s * 4); sc.set([rgb[0] * 0.085, rgb[1] * 0.085, rgb[2] * 0.085, pool[6]], s * 4); s++; }
    }
    for (const g of signs) {
      gp.set([g.at[0], g.at[1], g.at[2], g.size], n * 4); gc.set([g.rgb[0], g.rgb[1], g.rgb[2], 0], n * 4); gd.set([0, 1, 0, 0], n * 4); n++;
      if (pooled && g.pool) { sa.set([g.pool[0], g.pool[1], g.pool[2], g.pool[2]], s * 4); sb.set([1, 0, 1.4, 0], s * 4); sc.set([g.rgb[0] * 0.06, g.rgb[1] * 0.06, g.rgb[2] * 0.06, g.pool[3] || 0], s * 4); s++; }
    }
    nStatic = n;
    commit(spots, s, ['sa', 'sb', 'sc']);
  }
  function step(dt, cars) {
    time += dt; T.value = time;
    if (quality.step !== q) { q = quality.step; pooled = q <= 4; pools.visible = spots.visible = pooled; fixed(q >= 3 ? 2 : 1); }
    glows.material.uniforms.ppx.value = pixelAt(camera, renderer);
    const [n, k] = carLamps(cars, glows, pools, nStatic, 0, pooled, nStatic + CAR_MAX, NEON.lamps[0], NEON.lamps[1], true);
    commit(glows, n, ['gp', 'gc', 'gd']); commit(pools, k, ['pa', 'pb', 'pc']);
  }
  return { step };
}
