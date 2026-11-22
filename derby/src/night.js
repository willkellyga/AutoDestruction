// Hammerdown Arena runs at night, as a show under floodlights. A map asks for it with a `night` field (maps/arena.js:
// the floodlights' banks of lamps, the ring, the searchlights and the crowd); every other map keeps main.js's daylight.
//   - The sky: blue-black overhead, the city's orange-brown glow round its foot, a few faint clouds lit from below and a
//     moon with a soft halo, all in the dome's own shader; and stars, one cloud of points that rides along with the dome.
//   - The fog: the colour of that glow at the horizon, and thin, so a lit city a long way out still shows through it
//     (anything out there can take its colour from scene.fog.color).
//   - The light: main.js's sun becomes the floodlight bank, cool white and high, from the south-east tower (where the
//     daylight sun already stood, so the shadows fall the way that tower throws them), and a weaker fill without
//     shadows comes from the north-west tower, so a rival's far side still reads; the sky's light is a dim moonlit blue;
//     lit signs and LED strips glow (look.dusk), and so do the cars' lamps.
//   - The floor: a layer over the ground that brightens the pools under the towers' lamps and darkens the dirt toward
//     the walls and the land outside the stadium. It multiplies what is already drawn, after everything solid, so a car
//     standing on it is never darkened: the cars are lit by the floodlight bank itself, as brightly as by day.
//   - The towers: a soft beam from each bank of lamps down into the pit (fading as it is looked along, and close to, so
//     it never washes the picture out), and a glare round each bank.
//   - The show: searchlights sweeping the sky outside, and cameras flashing in the stands.
//   - The cars: a glow on each head and tail lamp (the tail lamps brighter under braking) and a pool of light on the
//     ground ahead.
// All of it is seven draws: the stars, the floor layer, the beams, the searchlights, the flashes, the glows (the
// towers' and the cars' together) and the lamps' pools. Its pictures are drawn at load, its one light of its own is
// that fill, and nothing in it casts a shadow. Down the quality ladder (quality.js) the extras thin out, then go:
//   step  beams          searchlights  flashes   glows, stars, floor  lamp pools
//   0-1   two a tower    six           all       on                   on
//   2-3   one a tower    four          half      on                   on
//   4     off            off           off       on                   on
//   5-6   off            off           off       on                   off
import * as THREE from 'three';
import { look } from '../../src/mesh.js';
import { GLOW } from '../../units/src/voxpart.js';

// the look: the haze (the fog, and the sky at the horizon), the fog's start and end, the exposure, the sky light (sky
// colour, ground colour, strength), the floodlight bank (colour, strength) and the fill from the far tower (colour,
// strength, the way to it)
export const NIGHT = {
  haze: 0x2b211f, fog: [320, 3100], exposure: 1.05, hemi: [0x6276a8, 0x2a2420, 0.95], flood: [0xf1f4ff, 2.85],
  fill: [0xd8e4ff, 0.85, [-0.68, 0.55, -0.45]],
};
const MOON = new THREE.Vector3(0.36, 0.33, -0.87).normalize();   // up over the north stand from the start
const TAU = Math.PI * 2;
const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
const TONE = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';   // (no-ops inside the light pass, which does both at the end)

// The sky, the fog and the light: called as main.js sets them up, before anything else reads them.
// The floodlight bank casts the shadows. The fill is the tower across the arena from it: no shadows, lower, so the
// side of a car turned away from the bank is lit too (by day the sky does that; a moonlit sky is too dim to), and a
// rival reads from any side.
export function nightLook({ scene, renderer, sky, hemi, sun }) {
  scene.fog.color.set(NIGHT.haze); scene.fog.near = NIGHT.fog[0]; scene.fog.far = NIGHT.fog[1];
  renderer.setClearColor(scene.fog.color);
  renderer.toneMappingExposure = NIGHT.exposure;
  hemi.color.set(NIGHT.hemi[0]); hemi.groundColor.set(NIGHT.hemi[1]); hemi.intensity = NIGHT.hemi[2];
  sun.color.set(NIGHT.flood[0]); sun.intensity = NIGHT.flood[1];
  const fill = new THREE.DirectionalLight(NIGHT.fill[0], NIGHT.fill[1]);
  fill.position.set(...NIGHT.fill[2]); fill.updateMatrixWorld(); scene.add(fill);   // (its target stays at the origin: only the way matters)
  sky.material.dispose(); sky.material = skyMaterial();
}

// ---- the sky ------------------------------------------------------------------------------------------------------
// The dome rides with the camera, so its own position is the direction looked along. Overhead to the foot: blue-black,
// a deep blue, the city's glow, the haze. The clouds are a picture wrapped round twice, low in the sky, lit from below
// by the city and a little by the moon near it. The moon is drawn bigger than it would be, with seas, a halo close
// round it and a wide faint one.
function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x02040b) }, mid: { value: new THREE.Color(0x0a1128) }, glow: { value: new THREE.Color(0x5c3b2a) }, haze: { value: new THREE.Color(NIGHT.haze) },
      moon: { value: MOON }, clouds: { value: cloudTexture() }, time: { value: 0 },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 glow; uniform vec3 haze; uniform vec3 moon; uniform sampler2D clouds; uniform float time;
      varying vec3 vD;
      void main() {
        vec3 d = normalize(vD); float h = d.y;
        vec3 c = mix(mid, top, smoothstep(0.12, 0.85, h));
        c = mix(glow, c, smoothstep(0.0, 0.24, h));
        c = mix(haze, c, smoothstep(-0.03, 0.05, h));
        float m = max(dot(d, moon), 0.0), m2 = m * m, m8 = m2 * m2 * m2 * m2;
        c += vec3(0.55, 0.62, 0.8) * (pow(m, 320.0) * 0.22 + m8 * m8 * 0.035);
        if (h > 0.0 && h < 0.5) {
          vec4 k = texture2D(clouds, vec2(atan(d.z, d.x) / 3.14159 + time * 0.002, h * 2.0));
          float a = k.r * smoothstep(0.0, 0.07, h) * smoothstep(0.5, 0.3, h);
          vec3 lit = mix(glow, glow * 0.7 + mid, smoothstep(0.05, 0.4, h)) * (0.45 + 2.2 * k.g) + vec3(0.5, 0.55, 0.7) * pow(m, 30.0) * 0.5;
          c = mix(c, lit, a * 0.9);
        }
        vec3 mu = normalize(cross(moon, vec3(0.0, 1.0, 0.0))), mv = cross(mu, moon);
        vec2 q = vec2(dot(d, mu), dot(d, mv)) / 0.03;
        float r = length(q);
        if (m > 0.99 && r < 1.05) {
          float sea = smoothstep(0.42, 0.18, length(q - vec2(-0.25, 0.3))) + smoothstep(0.3, 0.1, length(q - vec2(0.35, 0.1))) * 0.8 + smoothstep(0.28, 0.08, length(q - vec2(0.05, -0.45))) * 0.7;
          vec3 disc = vec3(2.2, 2.15, 2.0) * (0.78 + 0.22 * sqrt(max(0.0, 1.0 - r * r))) * (1.0 - 0.28 * min(sea, 1.0));
          c = mix(c, disc, smoothstep(1.0, 0.93, r));
        }
        gl_FragColor = vec4(c, 1.0);
        ${TONE}
      }`,
  });
}
// The clouds: soft noise in a strip that wraps round, thinned to patches. Red is how thick a cloud is there, green how
// much of its underside shows (thicker just above its foot).
function cloudTexture() {
  const W = 512, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), img = g.createImageData(W, H), D = img.data;
  let s = 271828; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const oct = [[5, 2], [10, 4], [20, 8], [40, 14]].map(([n, m]) => { const v = new Float32Array(n * (m + 1)); for (let i = 0; i < v.length; i++) v[i] = r(); return { n, m, v }; });
  const sm = (t) => t * t * (3 - 2 * t);
  const at = (o, x, y) => {
    const fx = x * o.n, fy = y * o.m, i = Math.floor(fx), j = Math.min(o.m - 1, Math.floor(fy)), tx = sm(fx - i), ty = sm(fy - j);
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
// The stars: points on the dome's upper half, most faint, a few bright, some a little blue or warm, twinkling slowly,
// fading into the glow near the horizon.
function stars(n) {
  let s = 31337; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const y = 0.04 + 0.96 * Math.pow(r(), 0.8), a = r() * TAU, k = Math.sqrt(1 - y * y), R = 2190;
    pos.set([Math.cos(a) * k * R, y * R, Math.sin(a) * k * R], i * 3);
    const b = 0.25 + 1.6 * Math.pow(r(), 6), t = r();
    col.set(t < 0.2 ? [b * 0.8, b * 0.9, b * 1.15] : t > 0.85 ? [b * 1.1, b, b * 0.8] : [b, b, b], i * 3); ph[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('col', new THREE.BufferAttribute(col, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({
    ...ADD, uniforms: { time: { value: 0 }, px: { value: 1 } },
    vertexShader: `attribute vec3 col; attribute float ph; uniform float time; uniform float px; varying vec3 vC;
      void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        float tw = 0.72 + 0.28 * sin(time * (1.1 + 2.0 * ph) + ph * 60.0);
        vC = col * tw * smoothstep(0.04, 0.22, normalize(position).y);
        gl_PointSize = px * (1.3 + 1.4 * max(col.g - 0.6, 0.0)); }`,
    fragmentShader: `varying vec3 vC; void main() { float r = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vC * (1.0 - r * r), 1.0); ${TONE} }`,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -2;
  return p;
}

// ---- the floor ----------------------------------------------------------------------------------------------------
// The layer over the ground. What it draws scales what is under it: by its colour, plus its alpha (a blend that does
// dst * (src + alpha)), so it can brighten as well as darken, up to twice, on any screen. How much, at each point of
// the world, is worked out once here into a small picture (8 voxels a pixel, smoothed between): the light a bank of
// lamps puts on a point of the floor is inside its cone (soft at the edge), less the further off (as the square), and
// less the flatter it meets the floor, made 1 at the spot it is aimed at; the towers' pools add up, saturating, a
// little cooler where they are bright; and past the ring's wall the ground falls away to dark. Past the picture's edge
// it carries on dark, and the fog takes the layer off with distance, as it does the ground.
const FIELD = 128, FK = 1.5;   // the picture's size, and the most it brightens (stored over FK)
const outside = (d) => { const t = Math.min(1, Math.max(0, (1000 - d) / 620)); return 0.17 + 0.23 * t * t * (3 - 2 * t); };
function floorField(night) {
  const R = night.ring, x0 = R.x - 512, z0 = R.z - 512, S = 1024 / FIELD, data = new Uint8Array(FIELD * FIELD * 4);
  const B = night.banks.map((b) => { const ax = b.aim[0] - b.x, ay = -b.y, az = b.aim[1] - b.z, D = Math.hypot(ax, ay, az); return [b.x, b.y, b.z, ax / D, ay / D, az / D, D]; });
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let j = 0; j < FIELD; j++) for (let i = 0; i < FIELD; i++) {
    const x = x0 + (i + 0.5) * S, z = z0 + (j + 0.5) * S;
    let pool = 0;
    for (const [bx, by, bz, ax, ay, az, D] of B) {
      const lx = x - bx, ly = -by, lz = z - bz, d2 = lx * lx + ly * ly + lz * lz, d = Math.sqrt(d2);
      pool += sm(0.9, 0.995, (lx * ax + ly * ay + lz * az) / d) * Math.min(1.5, D * D / d2) * ((-ly / d) / -ay);
    }
    const lit = 1 - Math.exp(-0.7 * pool);
    const qx = Math.abs(x - R.x) - (R.hx - R.r), qz = Math.abs(z - R.z) - (R.hz - R.r);
    const e = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - R.r;
    const k = sm(40, -10, e), f = outside(Math.hypot(x - R.x, z - R.z)) * (1 - k) + 0.72 * k + 0.55 * lit;
    const o = (j * FIELD + i) * 4;
    data[o] = Math.round(f * (1 - 0.05 * lit) / FK * 255); data[o + 1] = Math.round(f * (1 - 0.02 * lit) / FK * 255); data[o + 2] = Math.min(255, Math.round(f * (1 + 0.05 * lit) / FK * 255)); data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, FIELD, FIELD); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
function floorLayer(night) {
  const R = night.ring;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.SrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { field: { value: null }, box: { value: new THREE.Vector3(R.x - 512, R.z - 512, 1024) }, mid: { value: new THREE.Vector2(R.x, R.z) } }]),
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; vec4 mvPosition = viewMatrix * vec4(vW, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D field; uniform vec3 box; uniform vec2 mid; varying vec3 vW;
      #include <fog_pars_fragment>
      void main() {
        vec2 uv = (vW.xz - box.xy) / box.z;
        vec3 f = uv == clamp(uv, 0.0, 1.0) ? texture2D(field, uv).rgb * ${FK.toFixed(2)} : vec3(0.17 + 0.23 * smoothstep(1000.0, 380.0, length(vW.xz - mid)));
        #ifdef USE_FOG
          f = mix(f, vec3(1.0), smoothstep(fogNear, fogFar, vFogDepth));
        #endif
        f = linearToOutputTexel(vec4(f, 1.0)).rgb;   // (drawn straight to the screen, low on the ladder, what it scales is in the screen's colours)
        float a = max(max(f.r, max(f.g, f.b)) - 1.0, 0.0);
        gl_FragColor = vec4(max(f - a, 0.0), a);
      }`,
  });
  m.uniforms.field.value = floorField(night);   // (set after the merge, which would copy it)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6400, 6400), m);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(R.x, 0.02, R.z); mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
  mesh.renderOrder = -1;   // first of what is drawn after the solid things: the skid marks and anything else on the ground go over it
  return mesh;
}

// ---- beams --------------------------------------------------------------------------------------------------------
// A beam is a soft cone, drawn from both sides and added on. Brightest where its side is seen square on (through the
// middle of it), fading to its edges, toward its far end, and close to the camera.
const BEAM_FRAG = `uniform vec3 col; uniform float near; varying vec3 vN; varying vec3 vW; varying float vT;
  void main() {
    vec3 v = cameraPosition - vW; float d = length(v);
    float side = abs(dot(normalize(vN), v / d));
    float a = side * side * pow(1.0 - vT, 1.4) * smoothstep(0.0, 0.05, vT) * smoothstep(near * 0.2, near, d);
    gl_FragColor = vec4(col * a, 1.0);
    ${TONE}
  }`;
// the floodlights' beams: one cone a bank, from its lamps to where it is aimed; the banks facing along the arena first,
// then those across it (so the quality ladder can draw only the first four)
function towerBeams(banks) {
  const S = 20, list = [...banks.filter((b) => b.nx), ...banks.filter((b) => !b.nx)];
  const P = [], Nn = [], T = [], I = [];
  const from = new THREE.Vector3(), to = new THREE.Vector3(), ax = new THREE.Vector3(), u = new THREE.Vector3(), w = new THREE.Vector3();
  for (const b of list) {
    from.set(b.x + b.nx * 1.5, b.y, b.z + b.nz * 1.5); to.set(b.aim[0], 0, b.aim[1]);
    ax.subVectors(to, from); const L = ax.length(); ax.normalize();
    u.crossVectors(ax, new THREE.Vector3(0, 1, 0)).normalize(); w.crossVectors(u, ax);
    const r0 = 5, r1 = L * 0.3, base = P.length / 3;
    for (let k = 0; k <= S; k++) {
      const a = k / S * TAU, cx = Math.cos(a), sx = Math.sin(a);
      for (const [t, rad] of [[0, r0], [1, r1]]) {
        P.push(from.x + ax.x * L * t + (u.x * cx + w.x * sx) * rad, from.y + ax.y * L * t + (u.y * cx + w.y * sx) * rad, from.z + ax.z * L * t + (u.z * cx + w.z * sx) * rad);
        Nn.push(u.x * cx + w.x * sx, u.y * cx + w.y * sx, u.z * cx + w.z * sx); T.push(t);
      }
      if (k < S) { const i = base + k * 2; I.push(i, i + 1, i + 3, i, i + 3, i + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); g.setAttribute('t', new THREE.Float32BufferAttribute(T, 1)); g.setIndex(I);
  const m = new THREE.ShaderMaterial({
    ...ADD, side: THREE.DoubleSide, uniforms: { col: { value: new THREE.Color(0.25, 0.26, 0.285) }, near: { value: 150 } },
    vertexShader: `attribute float t; varying vec3 vN; varying vec3 vW; varying float vT;
      void main() { vN = normal; vW = position; vT = t; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: BEAM_FRAG,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false;
  mesh.userData.per = S * 6;   // indices a beam
  return mesh;
}
// The searchlights: long thin cones from each lamp up into the sky, leaning out away from the arena and swinging slowly
// to and fro, each at its own pace. The cones are laid out upright and turned in the shader, so they cost nothing to move.
function searchBeams(spots, centre) {
  const S = 12, L = 1500, P = [], Nn = [], A = [], I = [];
  spots.forEach(([x, z], n) => {
    const base = P.length / 3, az = Math.atan2(z - centre[1], x - centre[0]);
    for (let k = 0; k <= S; k++) {
      const a = k / S * TAU, cx = Math.cos(a), sx = Math.sin(a);
      for (const [t, rad] of [[0, 2.5], [1, 55]]) { P.push(cx * rad, t, sx * rad); Nn.push(cx, 0, sx); A.push(x, z, n * 2.39 + 0.7, az); }
      if (k < S) { const i = base + k * 2; I.push(i, i + 1, i + 3, i, i + 3, i + 2); }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); g.setAttribute('sl', new THREE.Float32BufferAttribute(A, 4)); g.setIndex(I);
  const m = new THREE.ShaderMaterial({
    ...ADD, side: THREE.DoubleSide, uniforms: { col: { value: new THREE.Color(0.075, 0.085, 0.11) }, near: { value: 60 }, time: { value: 0 } },
    vertexShader: `attribute vec4 sl; uniform float time; varying vec3 vN; varying vec3 vW; varying float vT;
      void main() {
        float az = sl.w + 0.6 * sin(time * (0.11 + 0.02 * sl.z) + sl.z), el = 1.12 + 0.2 * sin(time * 0.083 + sl.z * 2.3);
        vec3 dir = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
        vec3 u = normalize(cross(dir, vec3(0.0, 1.0, 0.0))), w = cross(u, dir);
        vN = u * normal.x + w * normal.z; vT = position.y;
        vW = vec3(sl.x, 8.0, sl.y) + dir * position.y * ${L.toFixed(1)} + u * position.x + w * position.z;
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
      }`,
    fragmentShader: BEAM_FRAG,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false;
  mesh.userData.per = S * 6;
  return mesh;
}

// ---- the crowd's cameras ----------------------------------------------------------------------------------------------
// A point on a seat flashes for a moment every few seconds, each on its own beat. Between flashes it is moved off the
// screen with no size, so it costs next to nothing.
function flashes(spots) {
  const n = spots.length / 3, ph = new Float32Array(n * 2);
  let s = 4242; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  for (let i = 0; i < n; i++) { ph[i * 2] = r(); ph[i * 2 + 1] = 2 + 6 * r(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(spots, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 2));
  const m = new THREE.ShaderMaterial({
    ...ADD, uniforms: { time: { value: 0 }, px: { value: 1 } },
    vertexShader: `attribute vec2 ph; uniform float time; uniform float px; varying float vF;
      void main() {
        float c = mod(time + ph.x * ph.y, ph.y), f = c < 0.1 ? 1.0 - c / 0.1 : 0.0;
        vec4 mv = modelViewMatrix * vec4(position, 1.0); mv.z += 1.5;
        gl_Position = f > 0.0 ? projectionMatrix * mv : vec4(0.0, 0.0, 2.0, 1.0);
        gl_PointSize = f > 0.0 ? px * clamp(1400.0 / -mv.z, 2.5, 16.0) * (0.5 + 0.5 * f) : 0.0;
        vF = f;
      }`,
    fragmentShader: `varying float vF; void main() { vec2 p = (gl_PointCoord - 0.5) * 2.0; float r2 = dot(p, p);
      float a = exp(-r2 * 7.0) + 0.5 * exp(-abs(p.x * p.y) * 60.0) * (1.0 - r2); gl_FragColor = vec4(vec3(3.4, 3.4, 3.8) * a * vF, 1.0); ${TONE} }`,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.matrixAutoUpdate = false;
  return p;
}

// ---- glows: the towers' banks and the cars' lamps -------------------------------------------------------------------
// One quad an instance, turned to face the camera in the shader: a hot core, a wide soft halo and (for the towers) a
// thin flat streak. A lamp that faces a way is brightest seen from in front of it. Each is pulled a little toward the
// camera, so it is not buried in what it hangs on, and kept between a few pixels across far off and a set part of the
// view close to.
// per instance: gp (x, y, z, size), gc (colour, streak), gd (the way it faces, how much that matters)
const GLOW_MAX = 8 + 4 * 40, POOL_MAX = 2 * 40;
function glowSprites() {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  for (const k of ['gp', 'gc', 'gd']) g.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(GLOW_MAX * 4), 4).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount = 0;
  const m = new THREE.ShaderMaterial({
    ...ADD, uniforms: { ppx: { value: 0.002 } },
    vertexShader: `attribute vec4 gp; attribute vec4 gc; attribute vec4 gd; uniform float ppx; varying vec2 vUv; varying vec3 vC; varying float vS;
      void main() {
        vec3 to = cameraPosition - gp.xyz; float dist = length(to); vec3 v = to / dist;
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
// The pools of light the lamps throw on the ground: a fan ahead of each car from its headlamps, a small red one behind.
// per instance: pa (x, z, heading, strength), pb (where it starts along the heading, its length, its width there and at
// its end), pc (colour)
function lampPools() {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3)); g.setIndex([0, 2, 1, 0, 3, 2]);
  for (const k of ['pa', 'pb', 'pc']) g.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(POOL_MAX * 4), 4).setUsage(THREE.DynamicDrawUsage));
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
      void main() { float a = smoothstep(0.0, 0.12, vUv.x) * pow(1.0 - vUv.x, 1.5) * (1.0 - vUv.y * vUv.y);
        gl_FragColor = vec4(vC * a, 1.0); ${TONE} }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 0;
  return mesh;
}

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

// ---- it all, and its frame --------------------------------------------------------------------------------------------
export function makeNight({ scene, renderer, camera, sky, mats, bloom, quality, night }) {
  look.dusk.value = 1;                 // lit signs, LED strips and the scoreboard's bands glow
  mats[1].color.setScalar(1.5);        // and the cars' lamps (and gun flashes) glow enough for the light pass to bloom them
  bloom.strength = 0.36; bloom.radius = 0.6; bloom.threshold = 1.25;
  const starPts = stars(1800); sky.add(starPts);
  const floor = floorLayer(night), beams = towerBeams(night.banks), search = searchBeams(night.searchlights, [night.ring.x, night.ring.z]);
  const flash = flashes(night.crowd), glows = glowSprites(), pools = lampPools();
  for (const o of [floor, beams, search, flash, glows, pools]) scene.add(o);
  const T = [sky.material.uniforms.time, starPts.material.uniforms.time, search.material.uniforms.time, flash.material.uniforms.time];
  const PX = [starPts.material.uniforms.px, flash.material.uniforms.px];
  const gp = glows.geometry.attributes.gp, gc = glows.geometry.attributes.gc, gd = glows.geometry.attributes.gd;
  const pa = pools.geometry.attributes.pa, pb = pools.geometry.attributes.pb, pc = pools.geometry.attributes.pc;
  // the towers' glare: one a bank, facing down its beam
  const nb = night.banks.length;
  night.banks.forEach((b, i) => {
    _v.set(b.aim[0] - b.x, -b.y, b.aim[1] - b.z).normalize();
    gp.array.set([b.x + b.nx, b.y, b.z + b.nz, 30], i * 4); gc.array.set([2.6, 2.7, 2.9, 1], i * 4); gd.array.set([_v.x, _v.y, _v.z, 0.75], i * 4);
  });
  let time = 0, q = -1, pools_ = true;
  function ladder(n) {
    q = n;
    beams.visible = n <= 3; beams.geometry.setDrawRange(0, beams.userData.per * (n <= 1 ? nb : nb / 2));
    search.visible = n <= 3; search.geometry.setDrawRange(0, search.userData.per * (n <= 1 ? night.searchlights.length : 4));
    flash.visible = n <= 3; flash.geometry.setDrawRange(0, n <= 1 ? night.crowd.length / 3 : night.crowd.length / 6);
    pools_ = n <= 4; pools.visible = pools_;
  }
  function step(dt, cars) {
    time += dt; for (const u of T) u.value = time;
    if (quality.step !== q) ladder(quality.step);
    const pr = renderer.getPixelRatio(); for (const u of PX) u.value = pr;
    glows.material.uniforms.ppx.value = 2 * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, renderer.domElement.height);
    // the cars' lamps: from each car's heading and its lamps' places, every frame
    let n = nb, k = 0;
    for (const c of cars) {
      if (c.gone || c.dead || !c.unit.root.visible || n + 4 > GLOW_MAX) continue;   // (out with the car as it blinks back in)
      const L = c._lamps || (c._lamps = lampsOf(c)), s = Math.sin(c.yaw), co = Math.cos(c.yaw);
      const braking = c.brake > 0 || c.throttle < 0 || c.hbBrake > 0;
      for (const [kind, sgn] of [['head', 1], ['tail', -1]]) for (const e of L[kind]) {
        gp.array.set([c.x + e[0] * co + e[2] * s, e[1], c.z - e[0] * s + e[2] * co, kind === 'head' ? 1.9 : braking ? 2 : 1.5], n * 4);
        gc.array.set(kind === 'head' ? [1.2, 1.1, 0.9, 0.3] : braking ? [2.4, 0.25, 0.15, 0] : [1.3, 0.12, 0.08, 0], n * 4);
        gd.array.set([s * sgn, 0, co * sgn, 0.92], n * 4); n++;
      }
      if (pools_ && k + 2 <= POOL_MAX) {
        const front = Math.max(L.head[0][2], L.head[1][2]) - 0.5, back = Math.min(L.tail[0][2], L.tail[1][2]) + 0.5;
        pa.array.set([c.x, c.z, c.yaw, 1], k * 4); pb.array.set([front, 34, c.wide * 0.8, c.wide * 3.2], k * 4); pc.array.set([0.26, 0.23, 0.18, 0], k * 4); k++;
        pa.array.set([c.x, c.z, c.yaw, braking ? 1.8 : 1], k * 4); pb.array.set([back, -9, c.wide * 0.8, c.wide * 1.6], k * 4); pc.array.set([0.12, 0.012, 0.008, 0], k * 4); k++;
      }
    }
    glows.geometry.instanceCount = n; pools.geometry.instanceCount = k;
    for (const a of [gp, gc, gd]) { a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; }
    for (const a of [pa, pb, pc]) { a.clearUpdateRanges(); a.addUpdateRange(0, k * 4); a.needsUpdate = true; }
  }
  return { step };
}
