// Capital Circuit races on a clear spring day (its `look`, maps/capital.js; Will, 2026-11-24: "spring day").
//   - The sun: high in the south, a little east of it, white with a touch of warmth, so the marble is bright and the
//     shadows are short and fall north, away from the Mall. Nowhere on the lap is driven into it.
//   - The sky: a deep clear blue overhead, paler lower down, to a white haze round its foot; the sun's disc with a
//     glow round it, and fair-weather clouds low round the sky, white on top and grey-blue underneath.
//   - The fog: a thin pale haze, far off, so the far bank and the city past the map go soft and blue.
//   - The light: the sky's light a clear blue, the ground's a green from the lawns; no window or lamp is lit.
// Its own draws: none but the sky's. It adds no light.
import * as THREE from 'three';
import { look } from '../../../src/mesh.js';
import { TONE, cloudStrip } from './kit.js';

// the look: the way to the sun, the haze (the fog, and the sky at its foot), the fog's start and end, the exposure, the
// sky light (sky colour, ground colour, strength), the sun (colour, strength) and the shadow box's half width and height
export const SPRING = {
  sun: new THREE.Vector3(0.3, 0.8, 0.52).normalize(), haze: 0xc9dcec, fog: [560, 2250], exposure: 1.06,
  hemi: [0xc4dcff, 0x93a37c, 1.9], light: [0xfff3df, 3.45], box: [180, 165],
};

export function setup(L, { scene, renderer, sky, hemi, sun }) {
  scene.fog.color.set(SPRING.haze); scene.fog.near = SPRING.fog[0]; scene.fog.far = SPRING.fog[1];
  renderer.setClearColor(scene.fog.color);
  renderer.toneMappingExposure = SPRING.exposure;
  hemi.color.set(SPRING.hemi[0]); hemi.groundColor.set(SPRING.hemi[1]); hemi.intensity = SPRING.hemi[2];
  sun.color.set(SPRING.light[0]); sun.intensity = SPRING.light[1];
  sky.material.dispose(); sky.material = skyMaterial();
  // The shadow box (main.js) is sized for any sun. Under a high one the shadows are short and what throws them stands
  // close by, so here it is a little smaller: less of the city to draw into the shadows, and finer ones.
  const sc = sun.shadow.camera; sc.left = -SPRING.box[0]; sc.right = SPRING.box[0]; sc.top = SPRING.box[1]; sc.bottom = -SPRING.box[1]; sc.updateProjectionMatrix();
  return { sunDir: SPRING.sun };
}

// Overhead to the foot: deep blue, a paler blue, a white haze. The clouds are the strip the other skies use (kit.js),
// lit from above: white where they are thick, grey-blue along their undersides.
function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      zen: { value: new THREE.Color(0x2f6fd0) }, high: { value: new THREE.Color(0x78aee8) }, low: { value: new THREE.Color(0xb4d2ee) },
      haze: { value: new THREE.Color(SPRING.haze) }, sun: { value: SPRING.sun }, clouds: { value: cloudStrip() }, time: { value: 0 },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 zen; uniform vec3 high; uniform vec3 low; uniform vec3 haze; uniform vec3 sun;
      uniform sampler2D clouds; uniform float time;
      varying vec3 vD;
      void main() {
        vec3 d = normalize(vD); float h = d.y;
        float s = max(dot(d, sun), 0.0);
        vec3 c = mix(high, zen, smoothstep(0.12, 0.8, h));
        c = mix(low, c, smoothstep(0.0, 0.3, h));
        c = mix(haze, c, smoothstep(-0.03, 0.07, h));
        float s2 = s * s, s8 = s2 * s2 * s2 * s2;
        c += vec3(1.0, 0.95, 0.85) * (s8 * s8 * 0.3 + pow(s, 180.0) * 0.8);
        if (h > -0.02 && h < 0.56) {
          vec4 k = texture2D(clouds, vec2(atan(d.z, d.x) / 3.14159 + time * 0.0012, max(h, 0.0) * 1.8));
          float a = smoothstep(0.1, 0.5, k.r) * smoothstep(0.015, 0.09, h) * smoothstep(0.52, 0.3, h);
          vec3 lit = mix(vec3(0.7, 0.76, 0.86), vec3(1.12, 1.12, 1.1), smoothstep(0.0, 0.55, k.g + k.r * 0.5)) + vec3(0.4, 0.38, 0.3) * pow(s, 12.0);
          c = mix(c, lit, a * 0.9);
        }
        c = mix(c, vec3(6.0, 5.6, 4.8), smoothstep(0.99955, 0.99975, s));
        gl_FragColor = vec4(c, 1.0);
        ${TONE}
      }`,
  });
}

export function make(L, { sky }) {
  look.dusk.value = 0;   // no window or lamp is lit
  const T = sky.material.uniforms.time;
  let time = 0;
  return { step(dt) { time += dt; T.value = time; } };
}
