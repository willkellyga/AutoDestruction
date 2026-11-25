// Water that moves (maps/empire.js; Will, 2026-11-24: "more interesting, in a cheap way"). The rivers and the harbour
// are paint on the flat ground; this is one flat sheet laid a hair over them, a single draw of two triangles, and all
// of it worked out a pixel at a time from a few trains of waves:
//   - the swell: bands of lighter and darker water crossing each other and running with the current
//   - the sky in it: the flatter the water is seen, the more of the evening sky it gives back, so the far water glows
//     and the water under the bridge stays deep
//   - the sun's road: a broken path of glitter toward the low sun, and a few sparks of it anywhere
//   - the shore: paler shallows, and lines of foam that run in to the quay
// Near the camera it is worked out a voxel at a time, so it reads as part of a voxel world; far off, smooth (it would
// swarm). It fades out into the haze.
//
// makeWater(scene, { x0, z0, span, isWater(x, z), sun, sky, glint, pools }) -> { step(dt) }
import * as THREE from 'three';

function maskOf(x0, z0, span, isWater) {
  const N = 1024, k = span / N, R = 3, a = new Float32Array(N * N), b = new Float32Array(N * N);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) a[z * N + x] = isWater(x0 + (x + 0.5) * k, z0 + (z + 0.5) * k) ? 1 : 0;
  // blurred, so it also says how far off the shore is: 0.5 on the shoreline, 1 from nine voxels out
  const blur = (src, dst, dx, dz) => { for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { let s = 0; for (let i = -R; i <= R; i++) { const X = Math.min(N - 1, Math.max(0, x + dx * i)), Z = Math.min(N - 1, Math.max(0, z + dz * i)); s += src[Z * N + X]; } dst[z * N + x] = s / (R * 2 + 1); } };
  blur(a, b, 1, 0); blur(b, a, 0, 1);
  const px = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) px[i] = Math.round(a[i] * 255);
  const t = new THREE.DataTexture(px, N, N, THREE.RedFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
}

// The sheet lies over [x0, x0 + span] each way (the map and the water round it). It is laid over the painted water and
// only adds to it and darkens it (so the paint's colour and the shadows on it show through, and where the sheet fades
// out nothing is left to see).
export function makeWater(scene, { x0 = 0, z0 = 0, span, isWater, sun, sky = 0xdba892, glint = 0xffe0a8, pools = [] }) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { mask: { value: null }, t: { value: 0 }, org: { value: new THREE.Vector2(x0, z0) }, span: { value: span }, sun: { value: sun.clone().normalize() },
      sky: { value: new THREE.Color(sky) }, glint: { value: new THREE.Color(glint) } }]),
    vertexShader: `varying vec3 wp;
      #include <fog_pars_vertex>
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz;
        vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D mask; uniform float t; uniform vec2 org; uniform float span; uniform vec3 sun; uniform vec3 sky; uniform vec3 glint;
      varying vec3 wp;
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 p0 = wp.xz, uv = (p0 - org) / span;
        float m = texture2D(mask, uv).r;
        vec2 e = min(uv, 1.0 - uv);
        float a = smoothstep(0.5, 0.62, m) * smoothstep(0.0, 0.05, min(e.x, e.y));
        if (a <= 0.003) discard;
        vec3 V = cameraPosition - wp; float dist = max(length(V), 0.001); V /= dist;
        // a voxel at a time near the camera, smooth far off; the small waves only near (they would swarm)
        float far = smoothstep(70.0, 190.0, dist), fine = 1.0 - smoothstep(110.0, 380.0, dist), mid = 1.0 - 0.75 * smoothstep(300.0, 900.0, dist);
        vec2 p = mix(floor(p0) + 0.5, p0, far);
        p += 4.0 * vec2(sin(p.y * 0.047 + t * 0.21), sin(p.x * 0.039 - t * 0.17));   // (bent a little, so the trains do not rule lines)
        // five trains of waves: where each is in its swing, and the slope they make between them
        float w1 = dot(p, vec2(0.80, 0.60)) * 0.21 + t * 0.9, w2 = dot(p, vec2(-0.50, 0.86)) * 0.43 + t * 1.4, w5 = dot(p, vec2(-0.91, -0.42)) * 0.31 + t * 1.1;
        float w3 = dot(p, vec2(0.20, -0.98)) * 0.93 + t * 2.3, w4 = dot(p, vec2(0.95, -0.31)) * 1.71 + t * 3.1;
        float h = (sin(w1) * 0.36 + sin(w2) * 0.3 + sin(w5) * 0.24) * mid + (sin(w3) * 0.16 + sin(w4) * 0.08) * fine;
        vec2 g = (vec2(0.80, 0.60) * cos(w1) * 0.4 + vec2(-0.50, 0.86) * cos(w2) * 0.45 + vec2(-0.91, -0.42) * cos(w5) * 0.35) * mid + (vec2(0.20, -0.98) * cos(w3) * 0.45 + vec2(0.95, -0.31) * cos(w4) * 0.35) * fine;
        vec3 N = normalize(vec3(-g.x * 0.3, 1.0, -g.y * 0.3)), Nf = normalize(vec3(-g.x * 0.1, 1.0, -g.y * 0.1));
        // the sky it gives back, more the flatter it is seen; darker in the troughs, lighter on the crests
        float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(Nf, V), 0.0, 1.0), 4.0), skyK = min(fres, 1.0) * 0.42;
        float cover = 0.06 + 0.2 * max(-h, 0.0) + skyK;
        vec3 add = sky * skyK + vec3(0.02, 0.05, 0.055) * max(h, 0.0);
        // the sun's road, broken up by the waves; and the odd spark anywhere
        vec3 R = reflect(-V, N); float rs = clamp(dot(R, sun), 0.0, 1.0);
        float sp = pow(rs, 160.0) * 2.0 + pow(rs, 24.0) * 0.1;
        float tw = step(0.9965, hash(floor(p0 * 0.5) + floor(t * 2.5) * 7.0)) * (0.3 + 0.7 * max(h, 0.0)) * fine;
        add += glint * (sp + tw * 0.6);
        // the shallows, and the foam running in to the quay
        float shore = 1.0 - smoothstep(0.58, 0.98, m);
        add += vec3(0.02, 0.06, 0.055) * shore;
        float lap = sin(m * 30.0 + t * 1.6 + sin(dot(p0, vec2(0.11, 0.13))) * 2.0);
        float foam = clamp(smoothstep(0.55, 0.95, lap) * shore * shore * (0.45 + 0.55 * hash(floor(p0) + floor(t * 1.5))) * 0.7, 0.0, 1.0) * fine;
        add = mix(add, vec3(0.8, 0.85, 0.85), foam); cover = mix(cover, 1.0, foam);
        #ifdef USE_FOG
          a *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth) * 0.9;
        #endif
        gl_FragColor = vec4(add * a, clamp(cover, 0.0, 1.0) * a);   // (laid on as: this, plus what is under it less the cover)
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, premultipliedAlpha: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  mat.uniforms.mask.value = maskOf(x0, z0, span, isWater);
  const g = new THREE.BufferGeometry(), x1 = x0 + span, z1 = z0 + span;
  // (a pool inland lies on the land, which stands higher than the rivers' bed: a piece of the sheet of its own, [x0, z0, x1, z1, y])
  const pos = [x0, 0.06, z0, x0, 0.06, z1, x1, 0.06, z1, x1, 0.06, z0], idx = [0, 1, 2, 0, 2, 3];
  for (const [a0, b0, a1, b1, y] of pools) { const i = pos.length / 3; pos.push(a0, y, b0, a0, y, b1, a1, y, b1, a1, y, b0); idx.push(i, i + 1, i + 2, i, i + 2, i + 3); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 0; mesh.name = 'water'; scene.add(mesh);
  return { mesh, step(dt) { mat.uniforms.t.value = (mat.uniforms.t.value + dt) % 3600; } };
}
