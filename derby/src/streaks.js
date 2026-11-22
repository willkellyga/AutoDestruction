// Speed, on the race: near the top of the player's speed, faint streaks of air rush out past the edges of the screen,
// more of them and brighter the nearer it is to flat out (and with a burst of nitro past it). The camera is left alone:
// the streaks are drawn straight onto the screen over the scene, so nothing about the view moves.
//
// One mesh of thin wedges round the edges (none across the bottom middle, where the car is), sent to the graphics chip
// once: each wedge's place, pace and length are fixed numbers, and the shader slides it outwards and brings it round
// again from the time, so a frame costs one draw and a few uniforms, and below the speed it starts at, nothing at all.
import * as THREE from 'three';

const START = 0.84;                               // how far into its top speed the streaks start to show
const COUNT = [56, 48, 40, 30, 22, 0, 0];         // how many by quality step (0 best .. 6 lightest): none on the last two

const VS = /* glsl */`
attribute vec4 seed;     // angle round the screen, phase, pace, a random 0..1
attribute vec2 corner;   // along the wedge (0 inner tip, 1 outer end), and across it (-1, 1)
uniform float time, k, aspect, pix;
varying float vA, vSide;
void main() {
  float t = fract( seed.y + time * seed.z );                    // 0 just in from the middle, 1 gone off the edge
  float r = mix( 0.8, 2.1, t ) + corner.x * ( 0.25 + 0.35 * seed.w ) * ( 0.6 + 0.6 * k );   // half-heights from the middle
  vec2 dir = vec2( cos( seed.x ), sin( seed.x ) ), across = vec2( - dir.y, dir.x );
  vec2 p = dir * r + across * corner.y * pix * ( 1.3 + 2.0 * seed.w ) * r;   // (wider as it goes out, a pixel or two in)
  gl_Position = vec4( p.x / aspect, p.y, 0.0, 1.0 );
  vA = k * ( 0.3 + 0.3 * seed.w ) * corner.x * sin( t * 3.14159 );
  vSide = corner.y;
}`;
const FS = /* glsl */`
varying float vA, vSide;
void main() { float a = vA * ( 1.0 - abs( vSide ) ); gl_FragColor = vec4( vec3( 0.92, 0.95, 1.0 ) * a, a ); }`;

export function makeStreaks({ scene, mobile }) {
  const n = COUNT[mobile ? 3 : 0];
  const seed = new Float32Array(n * 4 * 4), corner = new Float32Array(n * 4 * 2), idx = new Uint16Array(n * 6);
  for (let i = 0; i < n; i++) {
    // round the screen, but not across its bottom middle (the car), and fewer up in the sky
    let a; do { a = Math.random() * Math.PI * 2; } while (Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.75 || (Math.sin(a) > 0.8 && Math.random() < 0.6));
    const s = [a, Math.random(), 1.6 + Math.random() * 1.6, Math.random()];
    for (let v = 0; v < 4; v++) { seed.set(s, (i * 4 + v) * 4); corner.set([v === 1 || v === 2 ? 1 : 0, v < 2 ? -1 : 1], (i * 4 + v) * 2); }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));   // (unused: the shader places them)
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const U = { time: { value: 0 }, k: { value: 0 }, aspect: { value: 1 }, pix: { value: 0.002 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 1000; mesh.matrixAutoUpdate = false; mesh.visible = false;
  scene.add(mesh);
  let k = 0;
  return {
    // once a frame: how near flat out the player is (none when there is no player driving), and the screen's shape
    step(dt, car, step, canvas) {
      const top = car && !car.dead ? (car.spec.top || 100) : 0, f = top ? Math.min(1.2, car.fwd / top) : 0;
      const want = Math.max(0, Math.min(1, (f - START) / (1 - START)));
      k += (want - k) * Math.min(1, dt * (want > k ? 3 : 5));
      const on = k > 0.01 && COUNT[step] > 0;
      mesh.visible = on; if (!on) return;
      U.k.value = k; U.time.value += dt * (0.7 + 0.6 * k); g.setDrawRange(0, Math.min(n, COUNT[step]) * 6);
      U.aspect.value = canvas.width / Math.max(1, canvas.height); U.pix.value = 2 / Math.max(1, canvas.height);
    },
  };
}
