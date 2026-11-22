// Hammerdown Arena runs at night, as a show under floodlights (its `look`, maps/arena.js: the floodlights' banks of
// lamps, the ring, the searchlights and the crowd).
//   - The sky: blue-black overhead, the city's orange-brown glow round its foot, a few faint clouds lit from below and a
//     moon with a soft halo, all in the dome's own shader; and stars, one cloud of points that rides along with the dome.
//   - The fog: the colour of that glow at the horizon, and thin, so a lit city a long way out still shows through it
//     (anything out there can take its colour from scene.fog.color).
//   - The light: main.js's sun becomes the floodlight bank, cool white and high, from the south-east tower (where the
//     daylight sun already stood, so the shadows fall the way that tower throws them), and a weaker fill without
//     shadows comes from the north-west tower, so a rival's far side still reads; the sky's light is a dim moonlit blue;
//     lit signs and LED strips glow (look.dusk), and so do the cars' lamps.
//   - The floor: a layer over the pit's dirt that brightens the pools under the towers' lamps and darkens it between
//     them. It multiplies what is already drawn, after everything solid, so a car standing on it is never darkened: the
//     cars are lit by the floodlight bank itself, as brightly as by day. (The ground past the ring wall is the city's,
//     backdrop.js, which lights its own lot.)
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
import { look } from '../../../src/mesh.js';
import { TAU, ADD, TONE, rng, cloudStrip, BEAM_FRAG, glowSprites, lampPools, carLamps, commit, pixelAt, outOfReach, floorLayer, towerBeams } from './kit.js';

// the look: the haze (the fog, and the sky at the horizon), the fog's start and end, the exposure, the sky light (sky
// colour, ground colour, strength), the floodlight bank (colour, strength), the fill from the far tower (colour,
// strength, the way to it) and how much of those two the city round the stadium gets (backdrop.js)
export const NIGHT = {
  haze: 0x2b211f, fog: [320, 3100], exposure: 1.05, hemi: [0x6276a8, 0x2a2420, 0.95], flood: [0xf1f4ff, 2.85],
  fill: [0xd8e4ff, 0.85, [-0.68, 0.55, -0.45]], spill: 0.14,
};
const MOON = new THREE.Vector3(0.36, 0.33, -0.87).normalize();   // up over the north stand from the start

// The sky, the fog and the light: called as main.js sets them up, before anything else reads them.
// The floodlight bank casts the shadows. The fill is the tower across the arena from it: no shadows, lower, so the
// side of a car turned away from the bank is lit too (by day the sky does that; a moonlit sky is too dim to), and a
// rival reads from any side. (The bank shines the way main.js's sun already does, so the shadow box needs no new way.)
export function setup(L, { scene, renderer, sky, hemi, sun }) {
  scene.fog.color.set(NIGHT.haze); scene.fog.near = NIGHT.fog[0]; scene.fog.far = NIGHT.fog[1];
  renderer.setClearColor(scene.fog.color);
  renderer.toneMappingExposure = NIGHT.exposure;
  hemi.color.set(NIGHT.hemi[0]); hemi.groundColor.set(NIGHT.hemi[1]); hemi.intensity = NIGHT.hemi[2];
  sun.color.set(NIGHT.flood[0]); sun.intensity = NIGHT.flood[1];
  const fill = new THREE.DirectionalLight(NIGHT.fill[0], NIGHT.fill[1]);
  fill.position.set(...NIGHT.fill[2]); fill.updateMatrixWorld(); scene.add(fill);   // (its target stays at the origin: only the way matters)
  sky.material.dispose(); sky.material = skyMaterial();
  return {};
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
      moon: { value: MOON }, clouds: { value: cloudStrip() }, time: { value: 0 },
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
// The stars: points on the dome's upper half, most faint, a few bright, some a little blue or warm, twinkling slowly,
// fading into the glow near the horizon.
function stars(n) {
  const r = rng(31337);
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
    fragmentShader: `varying vec3 vC; void main() { float r = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vC * max(1.0 - r * r, 0.0), 1.0); ${TONE} }`,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -2;
  return p;
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
  const n = spots.length / 3, ph = new Float32Array(n * 2), r = rng(4242);
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

// ---- it all, and its frame --------------------------------------------------------------------------------------------
const GLOW_MAX = 8 + 4 * 40, POOL_MAX = 2 * 40;
const _v = new THREE.Vector3();
export function make(night, { scene, renderer, camera, sky, mats, bloom, quality, backdrop }) {
  look.dusk.value = 1;                 // lit signs, LED strips and the scoreboard's bands glow
  if (backdrop) outOfReach(backdrop.objects, NIGHT.spill);
  mats[1].color.setScalar(1.5);        // and the cars' lamps (and gun flashes) glow enough for the light pass to bloom them
  bloom.strength = 0.36; bloom.radius = 0.6; bloom.threshold = 1.25;
  const starPts = stars(1800); sky.add(starPts);
  const floor = floorLayer(night), beams = towerBeams(night.banks), search = searchBeams(night.searchlights, [night.ring.x, night.ring.z]);
  const flash = flashes(night.crowd), glows = glowSprites(GLOW_MAX), pools = lampPools(POOL_MAX);
  for (const o of [floor, beams, search, flash, glows, pools]) scene.add(o);
  const T = [sky.material.uniforms.time, starPts.material.uniforms.time, search.material.uniforms.time, flash.material.uniforms.time];
  const PX = [starPts.material.uniforms.px, flash.material.uniforms.px];
  const gp = glows.geometry.attributes.gp, gc = glows.geometry.attributes.gc, gd = glows.geometry.attributes.gd;
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
    glows.material.uniforms.ppx.value = pixelAt(camera, renderer);
    // the cars' lamps: from each car's heading and its lamps' places, every frame
    const [n, k] = carLamps(cars, glows, pools, nb, 0, pools_, GLOW_MAX);
    commit(glows, n, ['gp', 'gc', 'gd']); commit(pools, k, ['pa', 'pb', 'pc']);
  }
  return { step };
}
