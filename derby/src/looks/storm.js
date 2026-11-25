// Camp Deadfall in a storm at night (its `look`, maps/base.js: the guard towers' searchlights, the fires, the beacons).
//   - The sky: a low, heavy deck of cloud, dark green-grey, rolling over (noise scrolled two ways at once), thinner in
//     places, where the moon behind it shows as a pale patch. Lightning lights it from inside.
//   - The fog: the colour of the murk at the foot of the sky, closer in than by day; and a low mist over the ground,
//     drifting, that thins out close to the camera so what is near stays clear.
//   - The light: eight floodlight towers stand outside the wall, two a side, each a bank of lamps high up aimed well into
//     the base (Will, 2026-11-22: the camp was too dark and the dead washed out). main.js's sun is their light, warm
//     white, and casts the shadows; the ground under each bank's cone is brighter still (the arena's floor layer), and
//     the country past the wall gets little of it. A cold fill from the other side and a dark sky light keep the night
//     round the edges, so the dead read warm on one side and blue on the other. Lit windows and
//     lamps glow (look.dusk), and so do the cars' lamps.
//   - Lightning: every few seconds, out past the walls, a bolt down from the cloud, two or three flashes that light the
//     sky round it and the whole base, and thunder after it (the game's big boom, slowed down: audio.js), later the
//     further off it was.
//   - Rain: streaks that fall round the camera, the same ones wrapping round as it moves, slanted by the wind.
//   - The guard towers: each searchlight's beam sweeps the base, its spot on the ground, a glare at the lamp; every
//     so often one of them finds the player's car and stays on it a while.
//   - Fires: burning barrels and wrecks (the map's), a flickering glow on them and on the ground round them, and
//     smoke going up; a fire goes out when what was burning is knocked away. Red beacons turn on the gate pillars.
// Its own draws: the rain, the mist, the beams, the spots, the smoke, the glows, the lamps' pools and the bolt; one
// light of its own (the fill), and nothing new casts a shadow. Down the quality ladder (quality.js):
//   step  rain   mist  beams  smoke   spots, glows, bolt  pools
//   0-1   all    on    on     all     on                  on
//   2-3   0.6    on    on     half    on                  on
//   4     0.4    off   off    off     on                  on
//   5-6   0.25   off   off    off     on                  off
import * as THREE from 'three';
import { look } from '../../../src/mesh.js';
import { solid } from '../../../src/world.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TAU, ADD, TONE, rng, noiseTile, BEAM_FRAG, glowSprites, lampPools, groundSpots, carLamps, commit, pixelAt, outOfReach, floorLayer, towerBeams as bankBeams } from './kit.js';

// the look: the murk (the fog, and the sky at its foot), the fog's start and end, the exposure, the sky light (sky
// colour, ground colour, strength), the floodlights (the way their light comes from, colour, strength; the moon's
// pale patch in the cloud is that way too), the fill (colour, strength, the way to it), how much of the floodlights the
// world past the walls gets (backdrop.js), the ground under the banks (unlit, and how much brighter in a cone: kit.js
// floorLayer), and the lightning (seconds between strikes, least and most; how far off, least and most)
export const STORM = {
  murk: 0x1c2321, fog: [150, 1000], exposure: 1.18, hemi: [0x5f707a, 0x2b2b22, 1.1],
  moon: [new THREE.Vector3(-0.45, 0.72, -0.53).normalize(), 0xffe9d0, 2.25], fill: [0x5a7290, 1.05, [0.6, 0.35, 0.72]],
  spill: 0.2, floor: { base: 0.92, gain: 0.8, FK: 1.8 }, strikes: [5, 14], far: [650, 1250],
};

export function setup(L, { scene, renderer, sky, hemi, sun }) {
  scene.fog.color.set(STORM.murk); scene.fog.near = STORM.fog[0]; scene.fog.far = STORM.fog[1];
  renderer.setClearColor(scene.fog.color);
  renderer.toneMappingExposure = STORM.exposure;
  hemi.color.set(STORM.hemi[0]); hemi.groundColor.set(STORM.hemi[1]); hemi.intensity = STORM.hemi[2];
  sun.color.set(STORM.moon[1]); sun.intensity = STORM.moon[2];
  const fill = new THREE.DirectionalLight(STORM.fill[0], STORM.fill[1]);
  fill.position.set(...STORM.fill[2]); fill.updateMatrixWorld(); scene.add(fill);
  sky.material.dispose(); sky.material = skyMaterial();
  return { sunDir: STORM.moon[0], fill };
}

// ---- the sky ------------------------------------------------------------------------------------------------------
// The deck is a flat ceiling seen from below: each direction up is turned into a place on it, and the noise there is
// how thick it is, two layers drifting different ways. Thick cloud is darker than thin; the moon lights a patch where
// it is thin; toward the horizon it all goes into the murk. A strike lights the whole deck a little and the part over
// the bolt a lot, thin cloud most.
function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      thick: { value: new THREE.Color(0x141a18) }, thin: { value: new THREE.Color(0x3a4642) }, murk: { value: new THREE.Color(STORM.murk) },
      moon: { value: STORM.moon[0] }, noise: { value: noiseTile(9091) }, time: { value: 0 }, flash: { value: 0 }, strike: { value: new THREE.Vector3(1, 0, 0) },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 thick; uniform vec3 thin; uniform vec3 murk; uniform vec3 moon; uniform sampler2D noise; uniform float time;
      uniform float flash; uniform vec3 strike;
      varying vec3 vD;
      void main() {
        vec3 d = normalize(vD); float h = d.y;
        vec2 p = d.xz / max(h + 0.12, 0.05) * 0.55;
        float k = texture2D(noise, p * 0.7 + time * vec2(0.011, 0.004)).r * 0.62 + texture2D(noise, p * 1.9 - time * vec2(0.004, 0.012)).g * 0.38;
        k = smoothstep(0.25, 0.8, k);
        vec3 c = mix(thin, thick, k);
        float m = max(dot(d, moon), 0.0);
        c += vec3(0.32, 0.38, 0.45) * pow(m, 18.0) * (1.0 - k) * 0.9 + vec3(0.06, 0.07, 0.08) * pow(m, 4.0);
        float s = max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), strike), 0.0);
        c += flash * vec3(0.5, 0.56, 0.7) * (0.06 + 1.1 * pow(s, 8.0) * smoothstep(0.6, 0.05, h)) * (1.3 - 0.8 * k);
        c = mix(murk, c, smoothstep(-0.02, 0.2, h));
        gl_FragColor = vec4(c, 1.0);
        ${TONE}
      }`,
  });
}

// ---- rain -----------------------------------------------------------------------------------------------------------
// Each drop is a place in a box round the camera; it falls (and drifts with the wind) through the box and wraps round,
// so the same few thousand fill it however the camera moves. Drawn as a thin streak along the way it falls, never
// thinner than about a pixel (and fainter for it, far off), fading out toward the box's sides and right by the camera.
function rain(n) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const r = rng(7771), a = new Float32Array(n * 4); for (let i = 0; i < a.length; i++) a[i] = r();
  g.setAttribute('drop', new THREE.InstancedBufferAttribute(a, 4)); g.instanceCount = n;
  const m = new THREE.ShaderMaterial({
    ...ADD,
    uniforms: { time: { value: 0 }, box: { value: new THREE.Vector3(150, 90, 150) }, fall: { value: 120 }, wind: { value: new THREE.Vector2(26, 12) }, ppx: { value: 0.002 }, flash: { value: 0 } },
    vertexShader: `attribute vec4 drop; uniform float time; uniform vec3 box; uniform float fall; uniform vec2 wind; uniform float ppx;
      varying float vA; varying vec2 vUv;
      void main() {
        float sp = fall * (0.8 + 0.4 * drop.w);
        vec3 o = drop.xyz * box + vec3(mod(wind.x * time, box.x), -mod(sp * time, box.y), mod(wind.y * time, box.z));
        vec3 base = cameraPosition - box * 0.5, p0 = base + mod(o - base, box);
        vec3 v = normalize(vec3(wind.x, -sp, wind.y)), to = cameraPosition - p0; float dist = length(to);
        vec3 side = cross(v, to); side = length(side) > 1e-4 ? normalize(side) : vec3(1.0, 0.0, 0.0);
        float w = max(0.05, dist * ppx * 0.7);
        vec3 p = p0 + v * (position.y - 1.0) * sp * 0.035 + side * position.x * w;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        vec2 off = abs(p0.xz - cameraPosition.xz) / (box.xz * 0.5);
        vA = min(1.0, 0.05 / w) * smoothstep(1.0, 0.6, max(off.x, off.y)) * smoothstep(3.0, 12.0, dist);
        vUv = position.xy;
      }`,
    fragmentShader: `uniform float flash; varying float vA; varying vec2 vUv;
      void main() { gl_FragColor = vec4(vec3(0.085, 0.095, 0.11) * (1.0 + 5.0 * flash) * vA * (1.0 - abs(vUv.x)) * (0.3 + 0.7 * vUv.y), 1.0); ${TONE} }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 3;
  mesh.userData.n = n;
  return mesh;
}

// ---- the mist over the ground ---------------------------------------------------------------------------------------
// One sheet a little above the ground, patchy (the same noise as the sky, drifting), clear close to the camera, and
// lit up by the lightning.
function groundMist(noise, [cx, cz]) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { noise: { value: null }, time: { value: 0 }, flash: { value: 0 }, col: { value: new THREE.Color(STORM.murk).multiplyScalar(2.8) } }]),
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; vec4 mvPosition = viewMatrix * vec4(vW, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D noise; uniform float time; uniform float flash; uniform vec3 col; varying vec3 vW;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = vW.xz / 140.0;
        float n = texture2D(noise, p + time * vec2(0.010, 0.004)).r * 0.6 + texture2D(noise, p * 2.6 - time * vec2(0.006, 0.013)).g * 0.4;
        float a = smoothstep(0.15, 0.75, n) * 0.42 * smoothstep(10.0, 80.0, vFogDepth);
        gl_FragColor = vec4(col * (1.0 + 2.5 * flash), a);
        #include <fog_fragment>
        ${TONE}
      }`,
  });
  m.uniforms.noise.value = noise;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), m);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(cx, 2.4, cz); mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
  mesh.renderOrder = -0.5;   // after the solid things, before the lamps' pools, the glows and the rain
  return mesh;
}

// ---- the guard towers' searchlights ---------------------------------------------------------------------------------
// A cone a light, from the lamp to the spot it is aimed at; the lamps and the spots are uniforms, moved each frame, and
// the cones are built round them in the shader.
function towerBeams(n) {
  const S = 14, P = [], Nn = [], W = [], I = [];
  for (let b = 0; b < n; b++) {
    const base = P.length / 3;
    for (let k = 0; k <= S; k++) {
      const a = k / S * TAU, cx = Math.cos(a), sx = Math.sin(a);
      for (const t of [0, 1]) { P.push(cx, t, sx); Nn.push(cx, 0, sx); W.push(b); }
      if (k < S) { const i = base + k * 2; I.push(i, i + 1, i + 3, i, i + 3, i + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); g.setAttribute('which', new THREE.Float32BufferAttribute(W, 1)); g.setIndex(I);
  const from = [], aim = []; for (let b = 0; b < 4; b++) { from.push(new THREE.Vector3()); aim.push(new THREE.Vector3()); }
  const m = new THREE.ShaderMaterial({
    ...ADD, side: THREE.DoubleSide, uniforms: { col: { value: new THREE.Color(0.1, 0.11, 0.125) }, near: { value: 90 }, from: { value: from }, aim: { value: aim } },
    vertexShader: `attribute float which; uniform vec3 from[4]; uniform vec3 aim[4]; varying vec3 vN; varying vec3 vW; varying float vT;
      void main() {
        int i = int(which + 0.5); vec3 a = from[0], b = aim[0];
        if (i == 1) { a = from[1]; b = aim[1]; } else if (i == 2) { a = from[2]; b = aim[2]; } else if (i == 3) { a = from[3]; b = aim[3]; }
        vec3 ax = b - a; float L = max(length(ax), 1e-3); ax /= L;
        vec3 u = cross(ax, vec3(0.0, 1.0, 0.0)); u = length(u) > 1e-4 ? normalize(u) : vec3(1.0, 0.0, 0.0); vec3 w = cross(u, ax);
        float rad = mix(0.8, 7.0, position.y);
        vN = u * normal.x + w * normal.z; vT = position.y;
        vW = a + ax * L * position.y + (u * position.x + w * position.z) * rad;
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
      }`,
    fragmentShader: BEAM_FRAG,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 1;
  return mesh;
}

// ---- smoke --------------------------------------------------------------------------------------------------------
// Puffs going up from each fire, each on its own beat: it rises, swells, leans with the wind and thins away; lit
// orange from below while it is low. A quad an instance, all worked out in the shader from the time. The puffs are
// laid out one round of all the fires after another, so drawing fewer of them still gives every fire some. A fire
// gone out (`live`, one a fire) sends up no more.
const FIRE_MAX = 16;
function smoke(fires, per, noise) {
  const n = fires.length * per, g = new THREE.InstancedBufferGeometry(), r = rng(5150);
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const at = new Float32Array(n * 4), ph = new Float32Array(n * 4), fi = new Float32Array(n);
  for (let k = 0; k < per; k++) fires.forEach(([x, y, z, s], f) => {
    const i = k * fires.length + f;
    at.set([x, y + 1, z, s], i * 4); ph.set([(k + r() * 0.6) / per, 0.09 + 0.05 * r(), r() * TAU, r()], i * 4); fi[i] = f;
  });
  g.setAttribute('at', new THREE.InstancedBufferAttribute(at, 4)); g.setAttribute('ph', new THREE.InstancedBufferAttribute(ph, 4));
  g.setAttribute('fi', new THREE.InstancedBufferAttribute(fi, 1)); g.instanceCount = n;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 }, flash: { value: 0 }, wind: { value: new THREE.Vector2(9, 4) }, noise: { value: null }, live: { value: new Array(FIRE_MAX).fill(1) } }]),
    vertexShader: `attribute vec4 at; attribute vec4 ph; attribute float fi; uniform float time; uniform vec2 wind; uniform float live[${FIRE_MAX}];
      varying vec2 vUv; varying float vL; varying float vA; varying float vS;
      #include <fog_pars_vertex>
      void main() {
        float life = fract(time * ph.y + ph.x), up = life * 34.0 * at.w;
        vec3 c = at.xyz + vec3(wind.x * life * 2.2 + sin(ph.z + time * 0.7) * 1.5, up, wind.y * life * 2.2 + cos(ph.z + time * 0.6) * 1.5);
        vec4 mvPosition = viewMatrix * vec4(c, 1.0);
        float s = at.w * (1.2 + life * 5.0);
        mvPosition.xy += position.xy * s;
        gl_Position = projectionMatrix * mvPosition;
        vUv = position.xy; vL = life; vS = ph.w; vA = smoothstep(0.0, 0.12, life) * (1.0 - life) * live[int(fi + 0.5)];
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float flash; uniform sampler2D noise; varying vec2 vUv; varying float vL; varying float vA; varying float vS;
      #include <fog_pars_fragment>
      void main() {
        float r2 = dot(vUv, vUv); if (r2 > 1.0) discard;
        float n = texture2D(noise, vUv * 0.25 + vec2(vS, vL * 0.3)).r;
        float a = (1.0 - r2) * (0.55 + 0.6 * n) * vA * 0.55;
        vec3 c = mix(vec3(0.5, 0.22, 0.07), vec3(0.075, 0.075, 0.08), smoothstep(0.0, 0.3, vL)) * (1.0 + 3.0 * flash);
        gl_FragColor = vec4(c, a);
        #include <fog_fragment>
        ${TONE}
      }`,
  });
  m.uniforms.noise.value = noise;
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 1.5;
  mesh.userData.n = n;
  return mesh;
}

// ---- the lightning bolt ---------------------------------------------------------------------------------------------
// A jagged line from the cloud to the ground, with a branch or two, drawn as ribbons turned to face the camera, a hot
// core with a soft edge. Made anew for each strike (a few dozen points).
const BOLT_MAX = 64;
function bolt() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BOLT_MAX * 4 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('u', new THREE.BufferAttribute(new Float32Array(BOLT_MAX * 4), 1));
  const idx = []; for (let q = 0; q < BOLT_MAX; q++) idx.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3);
  g.setIndex(idx); g.setDrawRange(0, 0);
  const u = g.attributes.u.array; for (let q = 0; q < BOLT_MAX; q++) u.set([-1, 1, 1, -1], q * 4);
  const m = new THREE.ShaderMaterial({
    ...ADD, side: THREE.DoubleSide, uniforms: { k: { value: 0 } },
    vertexShader: 'attribute float u; varying float vU; void main(){ vU = u; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float k; varying float vU; void main() { float e = max(1.0 - abs(vU), 0.0);
      gl_FragColor = vec4(vec3(1.6, 1.7, 2.2) * k * (pow(e, 6.0) * 2.0 + e * 0.35), 1.0); ${TONE} }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = -1.5; mesh.visible = false;
  return mesh;
}
// lay out a bolt from (x, top, z) down to the ground, seen from `eye`
function boltAt(mesh, x, top, z, eye, r) {
  const pos = mesh.geometry.attributes.position.array, side = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  let q = 0;
  const seg = (p0, p1, w) => {
    if (q >= BOLT_MAX) return;
    d.subVectors(p1, p0); a.subVectors(eye, p0); side.crossVectors(d, a).normalize().multiplyScalar(w);
    pos.set([p0.x - side.x, p0.y - side.y, p0.z - side.z, p0.x + side.x, p0.y + side.y, p0.z + side.z,
      p1.x + side.x, p1.y + side.y, p1.z + side.z, p1.x - side.x, p1.y - side.y, p1.z - side.z], q * 12);
    q++;
  };
  const walk = (from, steps, dy, wob, w, branches) => {
    const p = from.clone(), n = new THREE.Vector3();
    for (let s = 0; s < steps && p.y > 0; s++) {
      n.set(p.x + (r() - 0.5) * wob, Math.max(0, p.y - dy * (0.7 + 0.6 * r())), p.z + (r() - 0.5) * wob);
      seg(p, n, w);
      if (branches && r() < 0.18) walk(n, 6 + Math.floor(r() * 5), dy * 0.8, wob * 1.4, w * 0.55, false);
      p.copy(n);
    }
  };
  walk(new THREE.Vector3(x, top, z), 26, top / 22, 46, 9, true);
  const g = mesh.geometry; g.attributes.position.needsUpdate = true; g.setDrawRange(0, q * 6);
}

// ---- the floodlight towers --------------------------------------------------------------------------------------------
// Each a steel lattice mast outside the wall (four legs leaning in, rings and crossed braces), a platform at the top and
// a head of lamps, four by three, turned down at where its bank is aimed. Two draws for all of them: the steel (lit,
// fogged) and the lamps' faces (unlit, bright enough to bloom, not fogged, so they show through the murk). Nothing
// casts a shadow. per bank (maps/base.js): x, y (the head's middle), z, aim [x, z]
export function floodTowers(banks) {
  const steel = [], lamps = [], o = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  // a bar of thickness t from p to q
  const bar = (p, q, t) => {
    const L = p.distanceTo(q), g = new THREE.BoxGeometry(t, t, L);
    o.position.copy(p).add(q).multiplyScalar(0.5); o.up.copy(up); o.lookAt(q); o.updateMatrix();
    steel.push(g.applyMatrix4(o.matrix));
  };
  for (const B of banks) {
    const top = B.y - 7, sec = 6, R0 = 6.5, R1 = 2.4;
    const corner = (y, k) => { const r = R0 + (R1 - R0) * (y / top), cx = k & 1 ? 1 : -1, cz = k & 2 ? 1 : -1; return new THREE.Vector3(B.x + cx * r, y, B.z + cz * r); };
    const ring = [0, 1, 3, 2];
    for (let k = 0; k < 4; k++) bar(corner(0, k), corner(top, k), 0.9);
    for (let s = 1; s <= sec; s++) {
      const y0 = top * (s - 1) / sec, y1 = top * s / sec;
      for (let e = 0; e < 4; e++) {
        const k0 = ring[e], k1 = ring[(e + 1) % 4];
        bar(corner(y1, k0), corner(y1, k1), 0.5);
        bar(corner(y0, k0), corner(y1, k1), 0.35); bar(corner(y0, k1), corner(y1, k0), 0.35);
      }
    }
    // the platform, and the head on its yoke, facing down its beam
    const plat = new THREE.BoxGeometry(9, 0.8, 9); plat.translate(B.x, top + 0.4, B.z); steel.push(plat);
    a.set(B.x, B.y, B.z); b.set(B.aim[0], 0, B.aim[1]);
    bar(new THREE.Vector3(B.x, top + 0.8, B.z), a.clone().setY(B.y - 3), 0.8);
    o.position.copy(a); o.up.copy(up); o.lookAt(b); o.updateMatrix();
    const head = new THREE.BoxGeometry(19, 12, 2.2); head.translate(0, 0, -0.6); steel.push(head.applyMatrix4(o.matrix));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const f = new THREE.PlaneGeometry(3.7, 3.0); f.translate(-6.6 + i * 4.4, -3.8 + j * 3.8, 0.56); lamps.push(f.applyMatrix4(o.matrix));
    }
  }
  const strip = (gs) => gs.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; });
  const mast = new THREE.Mesh(mergeGeometries(strip(steel)), new THREE.MeshLambertMaterial({ color: 0x34383b }));
  const faces = new THREE.Mesh(mergeGeometries(strip(lamps)), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.05, 2.75), fog: false }));
  for (const m of [mast, faces]) { m.matrixAutoUpdate = false; m.castShadow = m.receiveShadow = false; }
  return [mast, faces];
}

// ---- it all, and its frame --------------------------------------------------------------------------------------------
const CAR_GLOWS = 4 * 40;
export function make(L, { scene, renderer, camera, sky, hemi, sun, mats, bloom, quality, backdrop, sfx, setup: S }) {
  look.dusk.value = 1;                 // windows and lamps lit
  if (backdrop) outOfReach(backdrop.objects, STORM.spill);
  mats[1].color.setScalar(1.5);        // the cars' lamps (and gun flashes) bright enough to bloom
  bloom.strength = 0.36; bloom.radius = 0.6; bloom.threshold = 1.25;
  const towers = L.towers, fires = L.fires, beacons = L.beacons, nt = towers.length, nf = fires.length, nbk = beacons.length;
  const noise = sky.material.uniforms.noise.value;
  const drops = rain(2800), mist = groundMist(noise, L.middle), beams = towerBeams(nt), smokes = smoke(fires, 8, noise), flashBolt = bolt();
  const banks = L.banks || [], nfl = banks.length;
  const gmax = nfl + nt + 2 * nbk + nf + CAR_GLOWS, glows = glowSprites(gmax), pools = lampPools(2 * nbk + 2 * 40), spots = groundSpots(nt + nf);
  for (const o of [drops, mist, beams, smokes, flashBolt, glows, pools, spots]) scene.add(o);
  // the floodlights: the towers, their beams in the rain and the light they put on the ground inside the wall
  const floodBeams = nfl ? bankBeams(banks) : null;
  if (nfl) {
    for (const m of floodTowers(banks)) scene.add(m);
    scene.add(floorLayer(L, STORM.floor));
    floodBeams.material.uniforms.col.value.setRGB(0.15, 0.145, 0.13); floodBeams.material.uniforms.near.value = 120;
    scene.add(floodBeams);
  }
  const floodGlow = banks.map((B) => [B.x + B.nx * 1.6, B.y, B.z + B.nz * 1.6, ...new THREE.Vector3(B.aim[0] - B.x, -B.y, B.aim[1] - B.z).normalize().toArray()]);
  const T = [sky.material.uniforms.time, drops.material.uniforms.time, mist.material.uniforms.time, smokes.material.uniforms.time];
  const F = [sky.material.uniforms.flash, drops.material.uniforms.flash, mist.material.uniforms.flash, smokes.material.uniforms.flash];
  const G = glows.geometry.attributes, gp = G.gp.array, gc = G.gc.array, gd = G.gd.array;
  const P = pools.geometry.attributes, pa = P.pa.array, pb = P.pb.array, pc = P.pc.array;
  const Sp = spots.geometry.attributes, sa = Sp.sa.array, sb = Sp.sb.array, sc = Sp.sc.array;
  const from = beams.material.uniforms.from.value, aim = beams.material.uniforms.aim.value, live = smokes.material.uniforms.live.value;
  towers.forEach(([x, y, z], i) => from[i].set(x, y, z));
  const base = { hemi: hemi.intensity, moon: sun.intensity, fill: S.fill.intensity };
  // the dust and smoke the game throws up (src/sim.js, and the guns' in units/src/fx.js) is drawn in its own colours,
  // not lit, so at night the tyre smoke would show white: here it is dimmed to the moon, and comes up with the lightning
  const dusts = scene.children.filter((o) => o.isPoints && o.renderOrder === 10 && o.material.uniforms && o.material.uniforms.boost);
  const r = rng(60606), [mx, mz] = L.middle;
  const heat = fires.map(() => 1);       // each fire's strength: 1 burning, down to 0 once what burned is gone
  let time = 0, q = -1, pooled = true, smokeOn = true, checkT = 0;
  // the lightning: when the next strike comes, the flashes of this one (start, strength), and the thunder still to come
  let next = 3 + r() * 3, flashes = [], thunder = [];
  const strikeDir = sky.material.uniforms.strike.value;
  // the searchlight on the player: which tower, how far it has turned to the car (0 to 1), and the time left on it
  let hunter = 0, lock = 0, lockT = 0, lockNext = 8;
  const _p = new THREE.Vector3();
  function ladder(n) {
    q = n;
    drops.geometry.instanceCount = Math.round(drops.userData.n * (n <= 1 ? 1 : n <= 3 ? 0.6 : n === 4 ? 0.4 : 0.25));
    mist.visible = n <= 3; beams.visible = n <= 3;
    if (floodBeams) { floodBeams.visible = n <= 3; }
    smokeOn = n <= 3; smokes.visible = smokeOn; smokes.geometry.instanceCount = n <= 1 ? smokes.userData.n : smokes.userData.n / 2;
    pooled = n <= 4; pools.visible = pooled;
  }
  function strike() {
    const a = r() * TAU, d = STORM.far[0] + r() * (STORM.far[1] - STORM.far[0]);
    const x = camera.position.x + Math.cos(a) * d, z = camera.position.z + Math.sin(a) * d;
    strikeDir.set(Math.cos(a), 0, Math.sin(a));
    boltAt(flashBolt, x, 420, z, camera.position, r);
    flashes = [[time, 1], [time + 0.07 + r() * 0.06, 0.4 + r() * 0.3]];
    if (r() < 0.6) flashes.push([time + 0.2 + r() * 0.15, 0.5 + r() * 0.4]);
    // thunder: sound covers about 1300 voxels a second here (a quarter-metre voxel); deeper and quieter further off
    const k = (d - STORM.far[0]) / (STORM.far[1] - STORM.far[0]);
    thunder.push([time + d / 1300, 0.75 - 0.35 * k, 0.42 - 0.1 * k]);
    next = time + STORM.strikes[0] + r() * (STORM.strikes[1] - STORM.strikes[0]);
  }
  function step(dt, cars) {
    time += dt; for (const u of T) u.value = time;
    if (quality.step !== q) ladder(quality.step);
    const ppx = pixelAt(camera, renderer); glows.material.uniforms.ppx.value = ppx; drops.material.uniforms.ppx.value = ppx;
    // the lightning
    if (time >= next) strike();
    let f = 0; for (const [t0, a] of flashes) if (time >= t0) f = Math.max(f, a * Math.exp(-(time - t0) * 16));
    for (const u of F) u.value = f;
    hemi.intensity = base.hemi + 2.4 * f; sun.intensity = base.moon + 1.1 * f; S.fill.intensity = base.fill + 0.8 * f;
    for (const o of dusts) o.material.uniforms.boost.value = 0.3 + 1.1 * f;
    flashBolt.visible = f > 0.06; flashBolt.material.uniforms.k.value = f;
    while (thunder.length && time >= thunder[0][0]) { const [, vol, rate] = thunder.shift(); if (sfx) sfx.play('bigboom', vol, undefined, undefined, { rate, jitter: 0.05 }); }
    // the fires: is what was burning still there? (twice a second)
    if ((checkT -= dt) <= 0) { checkT = 0.5; fires.forEach(([x, y, z], i) => { if (!solid(Math.floor(x), Math.floor(y) - 1, Math.floor(z))) heat[i] = Math.min(heat[i], 0.999); }); }
    for (let i = 0; i < nf; i++) if (heat[i] < 1) { heat[i] = Math.max(0, heat[i] - dt * 0.6); live[i] = heat[i]; }
    // the searchlights: each sweeps its side of the base; now and then one turns to the player's car and stays on it
    const player = cars.find((c) => !c.rival && !c.gone && !c.dead);
    if ((lockT -= dt) <= 0 && time > lockNext) { hunter = Math.floor(r() * nt); lockT = 5 + r() * 3; lockNext = time + 16 + r() * 10; }
    lock += ((lockT > 0 && player ? 1 : 0) - lock) * Math.min(1, dt * 1.6);
    let n = 0, k = 0;
    // the floodlights' glare, facing down their beams (brighter in a flash: the rain round them lights up)
    for (const [x, y, z, dx, dy, dz] of floodGlow) { gp.set([x, y, z, 26], n * 4); gc.set([2.5 + f, 2.45 + f, 2.3 + f, 1], n * 4); gd.set([dx, dy, dz, 0.7], n * 4); n++; }
    towers.forEach(([x, y, z], i) => {
      const cx = mx + (x - mx) * 0.2, cz = mz + (z - mz) * 0.2;
      let ax = cx + Math.sin(time * (0.21 + 0.03 * i) + i * 1.7) * 150, az = cz + Math.sin(time * (0.27 + 0.02 * i) + i * 2.3) * 120;
      if (i === hunter && lock > 0.001 && player) { ax += (player.x - ax) * lock; az += (player.z - az) * lock; }
      aim[i].set(ax, 0, az);
      const dx = ax - x, dz = az - z, h = Math.hypot(dx, dz), sl = y / Math.hypot(h, y);
      sa.set([ax, az, 13, 13 * Math.min(2.2, 1 / sl)], k * 4); sb.set([dx / h, dz / h, 1.8, 0], k * 4); sc.set([0.075, 0.085, 0.1, 0], k * 4); k++;
      _p.set(dx, -y, dz).normalize();
      gp.set([x, y, z, 9], n * 4); gc.set([2.2, 2.3, 2.5, 0.6], n * 4); gd.set([_p.x, _p.y, _p.z, 0.8], n * 4); n++;
    });
    // the fires: a flicker each, on the flame, the ground and the smoke's foot
    fires.forEach(([x, y, z, s], i) => {
      const fl = heat[i] * (0.75 + 0.15 * Math.sin(time * 13 + i * 3.1) + 0.1 * Math.sin(time * 23.7 + i));
      gp.set([x, y + 1.2, z, 3.2 * s], n * 4); gc.set([2.6 * fl, 1.15 * fl, 0.35 * fl, 0], n * 4); gd.set([0, 0, 0, 0], n * 4); n++;
      sa.set([x, z, 15 * s, 15 * s], k * 4); sb.set([1, 0, 1.6, 0], k * 4); sc.set([0.36 * fl, 0.145 * fl, 0.04 * fl, 0], k * 4); k++;
    });
    // the beacons: two lamps back to back turning, each a glow that flares as it faces the camera and a red sweep
    let kp = 0;
    beacons.forEach(([x, y, z], i) => {
      const a = time * 4.4 + i * 1.3;
      for (const t of [0, Math.PI]) {
        gp.set([x, y, z, 4], n * 4); gc.set([3.2, 0.3, 0.12, 0], n * 4); gd.set([Math.sin(a + t), 0, Math.cos(a + t), 0.97], n * 4); n++;
        if (pooled) { pa.set([x, z, a + t, 1], kp * 4); pb.set([2, 46, 1.5, 16], kp * 4); pc.set([0.34, 0.03, 0.015, 0], kp * 4); kp++; }
      }
    });
    commit(spots, k, ['sa', 'sb', 'sc']);
    const [n2, k2] = carLamps(cars, glows, pools, n, kp, pooled, gmax);
    commit(glows, n2, ['gp', 'gc', 'gd']); commit(pools, k2, ['pa', 'pb', 'pc']);
  }
  return { step, strike: () => { next = time; } };
}
