// What the backdrops share (../backdrop.js puts each together): number and colour helpers, the bits of shader every one
// of them uses (a hash and a noise, rounded rectangles, their own fog), the boxes' look, the lights seen from afar, the
// skyline round the horizon, the towers and the craft overhead. Plain pieces: nothing here knows which map it is on.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2, DEG = Math.PI / 180;
export const F = (v) => (+v).toFixed(4);   // a number for GLSL (always with a point)
export const V3 = (c) => `vec3(${F(c[0])}, ${F(c[1])}, ${F(c[2])})`;
export const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// a seeded random, so a backdrop comes out the same every time
export function seeded(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 8) & 0xffff) / 65536; };
}
// Light colours (linear): a car park's lamps a warm white, street lamps and the elevated road's sodium orange, the
// aviation lights' red, and fire.
export const LAMP = [1.0, 0.78, 0.52], SODIUM = [1.0, 0.52, 0.18], RED = [1.0, 0.06, 0.03], FIRE = [1.0, 0.42, 0.08];

// What every shader here shares: a hash and a value noise, the rounded rectangles a layout is drawn with (as a signed
// distance, less than 0 inside, from a point already folded into one quarter), and the fog.
export const COMMON = `
float bdH(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float bdN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(bdH(i), bdH(i + vec2(1.0, 0.0)), f.x), mix(bdH(i + vec2(0.0, 1.0)), bdH(i + vec2(1.0, 1.0)), f.x), f.y); }
float bdBox(vec2 a, vec3 S) { vec2 q = a - (S.xy - S.z); return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - S.z; }
#ifdef USE_FOG
float bdFogF(float d) {
#ifdef FOG_EXP2
  return 1.0 - exp(-fogDensity * fogDensity * d * d);
#else
  return smoothstep(fogNear, fogFar, d);
#endif
}
#endif
`;
// the fog uniforms for the hand-written shaders (the lit ones have three.js's own)
export const FOG_PARS = `
#ifdef USE_FOG
uniform vec3 fogColor;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear; uniform float fogFar;
#endif
#endif
`;

// The lit materials (ground, boxes, trees, craft) are three.js's Lambert, so the scene's own lights fall on them as on
// the map, with the fog step swapped for this one: what a material puts in bdGlow (its lamps and windows) keeps
// 1 - keep of itself in the thickest fog, and the rest fades to at most `cap` of the way to the fog colour.
export function fogKeep(sh, cap, keep) {
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <fog_pars_fragment>', '#include <fog_pars_fragment>\n' + COMMON)
    .replace('void main() {', 'void main() {\n\tvec3 bdGlow = vec3(0.0);')
    .replace('#include <opaque_fragment>', `#ifdef USE_FOG
{ float bdF = bdFogF(vFogDepth); outgoingLight = mix(outgoingLight - bdGlow, fogColor, bdF * ${F(cap)}) + bdGlow * (1.0 - bdF * ${F(keep)}); }
#endif
#include <opaque_fragment>`)
    .replace('#include <fog_fragment>', '');
}

// the signed distance to a rounded rectangle round the middle, from a point folded into one quarter (ax, az >= 0)
export function sdBox(ax, az, S) {
  const qx = ax - (S.hx - S.r), qz = az - (S.hz - S.r);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - S.r;
}
// points round a rounded rectangle (offsets from the middle), about `step` apart, as a closed loop
export function loopPath(S, step) {
  const ix = S.hx - S.r, iz = S.hz - S.r, pts = [];
  const corners = [[ix, iz, 0], [-ix, iz, Math.PI / 2], [-ix, -iz, Math.PI], [ix, -iz, Math.PI * 1.5]];
  corners.forEach(([cx, cz, a0], i) => {
    const n = Math.max(2, Math.ceil(S.r * Math.PI / 2 / step));
    for (let k = 0; k <= n; k++) { const a = a0 + k / n * Math.PI / 2; pts.push([cx + Math.cos(a) * S.r, cz + Math.sin(a) * S.r]); }
    const [nx, nz, na] = corners[(i + 1) % 4], ex = cx + Math.cos(a0 + Math.PI / 2) * S.r, ez = cz + Math.sin(a0 + Math.PI / 2) * S.r;
    const sx = nx + Math.cos(na) * S.r, sz = nz + Math.sin(na) * S.r, m = Math.ceil(Math.hypot(sx - ex, sz - ez) / step);
    for (let k = 1; k < m; k++) pts.push([ex + (sx - ex) * k / m, ez + (sz - ez) * k / m]);
  });
  return pts;
}

// ---- the boxes' look ---------------------------------------------------------------------------------------------
// After the instance's colour is in diffuseColor: windows on the buildings' walls (lit at night by floor and by window,
// warm, white or now and then cool), a lit band round the top of a few, the light of the ground's lamps on the plain
// boxes (bdPlainLight, which each backdrop's layout defines) and the lamps' heads. Kind 5 is a building on fire: its
// windows lit by flames, flickering. BD_SHARE is how many of the windows that are lit at night are lit yet, and
// BD_BRIGHT how bright they are, both from the night: the layout sets them (by default all of them, as bright as the
// night is).
export const BOX_FRAG = `
float bdK = vBdD.x, bdSeed = vBdD.y;
bool bdOff = bdK < 0.5, bdGar = bdK > 3.5 && bdK < 4.5, bdFire = bdK > 4.5;
vec2 bdCs = bdOff ? vec2(9.0, 14.0) : bdGar ? vec2(40.0, 12.0) : vec2(12.0, 12.0);
float bdCols = max(1.0, floor(vBdF.y / bdCs.x + 0.5)), bdCw = vBdF.y / bdCols;
vec2 bdG = vec2(vBdF.x / bdCw, (vBdW.y - 2.0) / bdCs.y), bdFw = fwidth(bdG);
vec3 bdBase = diffuseColor.rgb;
if (bdK < 1.5 || bdK > 3.5) {
  if (abs(vBdF.w) < 0.5) {
    vec2 ci = floor(bdG), cf = fract(bdG);
    float far = smoothstep(0.45, 1.1, max(bdFw.x, bdFw.y));
    vec2 ws = bdOff ? vec2(0.84, 0.62) : bdGar ? vec2(1.04, 0.42) : vec2(0.5, 0.55);
    vec2 e = abs(cf - 0.5) - ws * 0.5;
    float win = clamp(0.5 - max(e.x / max(bdFw.x, 1e-3), e.y / max(bdFw.y, 1e-3)), 0.0, 1.0) * step(0.0, ci.y) * step(vBdW.y, vBdTop - 4.0);
    float fl = bdH(vec2(ci.y + bdSeed * 13.1, bdSeed));
    float on = step(bdH(ci * vec2(1.0, 1.7) + vec2(vBdF.z * 37.0 + bdSeed * 91.0, bdSeed * 17.0)), vBdD.z * (0.2 + 1.6 * fl * fl) * BD_SHARE);
    float th = bdH(vec2(bdOff ? ci.y : ci.x + ci.y * 7.0, bdSeed + vBdF.z));
    vec3 tint = th < 0.45 ? vec3(1.0, 0.64, 0.34) : th < 0.8 ? vec3(1.0, 0.85, 0.64) : th < 0.95 ? vec3(0.6, 0.78, 1.0) : vec3(0.66, 1.0, 0.76);
    if (bdGar) tint = vec3(0.78, 0.9, 1.0);
    float bri = 0.55 + 0.75 * bdH(ci + bdSeed);
    float area = min(ws.x, 1.0) * ws.y;
    vec3 lit = mix(tint * bri * on * win, vec3(0.95, 0.75, 0.5) * vBdD.z * 0.4 * area * BD_SHARE, far);
    if (bdFire) {
      // flames behind the glass, lower floors more than upper ones, each window flickering on its own
      float fk = 0.55 + 0.45 * sin(bdTime * (7.0 + 5.0 * bdH(ci + 3.1)) + bdH(ci) * 6.3) * sin(bdTime * 3.1 + bdSeed);
      float up = clamp(1.0 - (vBdW.y - 2.0) / max(vBdTop - 2.0, 1.0), 0.0, 1.0);
      lit = vec3(1.0, 0.38, 0.07) * mix(win * step(bdH(ci * 1.3 + bdSeed), vBdD.z * (0.4 + up)) * (0.8 + 0.5 * fk), vBdD.z * area * 0.8, far) * (0.6 + up);
      bdGlow += lit * 1.8;
    } else bdGlow += lit * BD_BRIGHT * 1.55;
    // the glass: darker than the wall (so the rows of windows show by day too)
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.038, 0.05), mix(win, area, far) * 0.85);
  } else if (vBdF.w > 0.5) diffuseColor.rgb *= 0.5;
  if (vBdD.w > 0.5 && abs(vBdF.w) < 0.5 && vBdW.y > vBdTop - vBdD.w) {
    float ch = fract(bdSeed * 7.31);
    vec3 cc = ch < 0.4 ? vec3(1.0, 0.84, 0.6) : ch < 0.65 ? vec3(0.45, 0.82, 1.0) : ch < 0.85 ? vec3(1.0, 0.36, 0.3) : vec3(0.78, 0.58, 1.0);
    bdGlow += cc * (0.06 + 1.5 * bdNight);
  }
} else if (bdK < 2.5) {
  // plain: lit by the lamps on the ground near it (from above, so the tops more than the sides)
  bdGlow += bdBase * bdPlainLight(vBdW) * (0.35 + 0.65 * max(vBdF.w, 0.0)) * bdNight;
} else {
  // a lamp's head
  bdGlow += bdBase * (0.04 + 2.6 * bdNight);
  diffuseColor.rgb *= 0.3;
}
`;

// One instanced box for everything square-cornered in a backdrop. `boxes` is in the order to draw (the groups the
// quality steps cut, nearest first within them); `layout` is the backdrop's own GLSL (its constants and bdPlainLight)
// and `defs` its #defines.
export function makeBoxes(boxes, { NIGHT, U, layout, defs = '', cap = 0.88, keep = 0.62, key = 'bd-boxes' }) {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); geo.deleteAttribute('uv');
  const data = new Float32Array(boxes.length * 4);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.bdNight = NIGHT; sh.uniforms.bdTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 iData; varying vec4 vBdD; varying vec3 vBdW; varying vec4 vBdF; varying float vBdTop;')
      .replace('#include <project_vertex>', `#include <project_vertex>
vec3 bdS = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
vBdW = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
vBdTop = instanceMatrix[3].y + bdS.y;
bool bdX = abs(normal.x) > 0.5;
// across the face, its width, which face (for the windows' hash) and whether it is a wall (0), roof (1) or floor (-1)
vBdF = vec4(bdX ? (position.z + 0.5) * bdS.z : (position.x + 0.5) * bdS.x, bdX ? bdS.z : bdS.x, dot(normal, vec3(1.0, 0.0, 2.0)) + 3.0, normal.y);
vBdD = iData;`);
    fogKeep(sh, cap, keep);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float bdNight; uniform float bdTime; varying vec4 vBdD; varying vec3 vBdW; varying vec4 vBdF; varying float vBdTop;\n' + defs)
      .replace('#include <fog_pars_fragment>\n' + COMMON, '#include <fog_pars_fragment>\n' + COMMON + layout)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + BOX_FRAG)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += bdGlow;');
  };
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, boxes.length));
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), T = new THREE.Vector3(), E = new THREE.Euler(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  boxes.forEach((b, i) => {
    // (turned about the upright only, or for a box knocked over, about its length as well)
    if (b.roll) Q.setFromEuler(E.set(0, b.yaw, b.roll, 'YXZ')); else Q.setFromAxisAngle(UP, b.yaw);
    T.set(b.x, b.y, b.z); S.set(b.sx, b.sy, b.sz); M.compose(T, Q, S); m.setMatrixAt(i, M);
    col.setRGB(b.col[0], b.col[1], b.col[2]); m.setColorAt(i, col);
    data.set([b.kind, b.seed, b.lit, b.crown], i * 4);
  });
  m.count = boxes.length;
  geo.setAttribute('iData', new THREE.InstancedBufferAttribute(data, 4));
  m.matrixAutoUpdate = false; m.updateMatrix(); m.frustumCulled = false; m.renderOrder = 1;
  return m;
}

// ---- the towers ----------------------------------------------------------------------------------------------------
// Plain towers and the landmarks, put down with the backdrop's own add (a box) and blink (an aviation light).
export const OFFICE = [0x2a3442, 0x1f252d, 0x3a3430, 0x4a4c50, 0x29323a, 0x575852].map(lin);
export const HOMES = [0x6b4a3a, 0x8c7c68, 0x5f5f5c, 0x7a6a58, 0x4f4a46].map(lin);
export const ROOF = lin(0x2c2d30), MAST = lin(0x55585e), POLE = lin(0x3a3d42);
export function towerKit(add, blink, rand, pick) {
  // a plain tower: one block, or set back once or twice on the way up, with what stands on its roof
  function tower(x, z, w, d, h, office, grp = 0) {
    const col = pick(office ? OFFICE : HOMES), kind = office ? 0 : 1, lit = office ? 0.14 + rand() * 0.26 : 0.14 + rand() * 0.24;
    const crown = office && h > 180 && rand() < 0.2 ? 6 + rand() * 10 : 0;
    let y = 0, tw = w, td = d, top = h;
    if (h > 170 && rand() < 0.45) {
      const h1 = h * (0.55 + rand() * 0.2); add(grp, x, 0, z, w, h1, d, 0, kind, col, lit);
      y = h1; tw = w * (0.68 + rand() * 0.17); td = d * (0.68 + rand() * 0.17);
      if (h > 260 && rand() < 0.35) { const h2 = y + (h - y) * 0.7; add(grp, x, y, z, tw, h2 - y, td, 0, kind, col, lit); y = h2; tw *= 0.72; td *= 0.72; }
    }
    add(grp, x, y, z, tw, top - y, td, 0, kind, col, lit, crown);
    if (rand() < 0.55) add(grp + 1, x + (rand() - 0.5) * tw * 0.3, top, z + (rand() - 0.5) * td * 0.3, tw * (0.3 + rand() * 0.25), 7 + rand() * 12, td * (0.3 + rand() * 0.25), 0, 2, ROOF);
    if (top > 200 && rand() < 0.4) { const mh = 30 + rand() * 60, mx = x + (rand() - 0.5) * tw * 0.4, mz = z + (rand() - 0.5) * td * 0.4; add(grp + 1, mx, top, mz, 2.4, mh, 2.4, 0, 2, MAST); blink(mx, top + mh + 1, mz); }
    else if (top > 280) for (const s of [-1, 1]) blink(x + s * tw * 0.45, top + 1.5, z + s * td * 0.45);
  }
  // The landmarks: a few towers of their own. Each is drawn with add and blink passed in, which scale its heights to
  // fit (the designs are about 480 to the tip).
  const LANDMARKS = [
    // a stepped tower with a lit crown and a spire
    (x, z, s, add, blink) => {
      const c = OFFICE[2]; add(0, x, 0, z, 150 * s, 250, 150 * s, 0, 0, c, 0.36); add(0, x, 250, z, 118 * s, 80, 118 * s, 0, 0, c, 0.36);
      add(0, x, 330, z, 88 * s, 48, 88 * s, 0, 0, c, 0.4, 14); add(0, x, 378, z, 58 * s, 16, 58 * s, 0, 3, lin(0xffd9a0).map((v) => v * 0.7));
      add(1, x, 394, z, 9, 56, 9, 0, 2, MAST); add(1, x, 450, z, 3.5, 40, 3.5, 0, 2, MAST); blink(x, 491, z);
    },
    // two slabs, a bridge between them near the top
    (x, z, s, add, blink) => {
      const c = OFFICE[0]; for (const [o, h] of [[-58, 400], [58, 365]]) { add(0, x + o * s, 0, z, 66 * s, h, 150 * s, 0, 0, c, 0.34, 10); add(1, x + o * s, h, z + 40, 3, 50, 3, 0, 2, MAST); blink(x + o * s, h + 51, z + 40); }
      add(0, x, 285, z, 54 * s, 18, 40 * s, 0, 0, c, 0.7, 18);
    },
    // a square tower with an open lantern on top: four posts and a lit ring
    (x, z, s, add, blink) => {
      const c = OFFICE[3], w = 132 * s, hw = w / 2 - 4; add(0, x, 0, z, w, 352, w, 0, 0, c, 0.32);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(1, x + a * hw, 352, z + b * hw, 8, 46, 8, 0, 2, MAST);
      add(0, x, 352, z, w * 0.6, 30, w * 0.6, 0, 2, ROOF);
      const ring = lin(0x9fe6ff).map((v) => v * 0.8);
      for (const [a, b, sx, sz] of [[0, -1, w, 3], [0, 1, w, 3], [-1, 0, 3, w], [1, 0, 3, w]]) add(0, x + a * hw, 392, z + b * hw, sx, 4, sz, 0, 3, ring);
      add(1, x, 382, z, 4, 70, 4, 0, 2, MAST); blink(x, 453, z);
    },
    // a stack turning a little at every step
    (x, z, s, add, blink) => {
      const c = OFFICE[5]; for (let k = 0; k < 7; k++) add(0, x, k * 50, z, (128 - k * 6) * s, 50, (128 - k * 6) * s, k * 0.16, 0, c, 0.33, k === 6 ? 10 : 0);
      add(1, x, 350, z, 4, 60, 4, 0, 2, MAST); blink(x, 411, z);
    },
    // a needle: a slim shaft, a pod near the top, a long mast
    (x, z, s, add, blink) => {
      const c = OFFICE[4]; add(0, x, 0, z, 44 * s, 300, 44 * s, 0, 1, c, 0.18);
      add(0, x, 300, z, 96 * s, 26, 96 * s, 0, 0, c, 0.55); add(0, x, 300, z, 96 * s, 26, 96 * s, Math.PI / 4, 0, c, 0.55);
      add(0, x, 326, z, 64 * s, 9, 64 * s, Math.PI / 8, 3, lin(0xff8a6a).map((v) => v * 0.7));
      add(1, x, 335, z, 7, 70, 7, 0, 2, MAST); add(1, x, 405, z, 3, 50, 3, 0, 2, MAST); blink(x, 456, z); blink(x, 372, z);
    },
    // a wedge stepping down one side
    (x, z, s, add, blink) => {
      const c = OFFICE[1]; [[160, 130], [130, 220], [100, 290], [70, 345], [42, 390]].forEach(([dd, h], k) => add(0, x, 0, z + (160 - dd) / 2 * s, 160 * s, h, dd * s, 0, 0, c, 0.3, k === 4 ? 12 : 0));
      add(1, x, 390, z + 59 * s, 3, 40, 3, 0, 2, MAST); blink(x, 431, z + 59 * s);
    },
  ];
  // a landmark scaled to stand `tall` to its tip, at most its full height
  const landmark = (k, x, z, s, tall) => {
    const v = clamp(tall / 480, 0.3, 1);
    LANDMARKS[k](x, z, s, (g, ax, y, az, sx, sy, sz, ...o) => add(g, ax, y * v, az, sx, sy * v, sz, ...o), (bx, y, bz) => blink(bx, y * v, bz));
  };
  return { tower, LANDMARKS, landmark };
}

// ---- the lights seen from afar --------------------------------------------------------------------------------------
// One set of points. A light: [x, y, z, bx, by, bz, size, kind, phase, speed, colour]. Kind 0 a lamp (on at night), 1 an
// aviation light (blinks red), 2 traffic (runs from a to b over and over), 3 traffic that fades in and out at the ends
// of its run, 4 a light on the craft overhead (carried round with it), 5 its strobe, 6 a fire (flickers, by day too),
// 7 a hazard light (blinks amber).
export const POINTS_VERT = `
uniform float uTime; uniform float uNight; uniform float uVH; uniform mat4 uBlimp;
attribute vec3 aB; attribute vec4 aD; attribute vec3 aC;
varying vec3 vC;
void main() {
  float kind = aD.y, k = 1.0;
  vec3 p = position, col = aC;
  if (kind > 1.5 && kind < 3.5) {
    // traffic: along its run, white coming this way and red going away
    float s = fract(aD.z + uTime * aD.w);
    p = mix(position, aB, s);
    if (kind > 2.5) k *= smoothstep(0.0, 0.05, s) * smoothstep(1.0, 0.95, s);
    vec2 dir = normalize(aB.xz - position.xz + vec2(1e-3, 0.0)), to = normalize(cameraPosition.xz - p.xz + vec2(1e-3, 0.0));
    col = mix(vec3(1.0, 0.07, 0.03) * 0.85, vec3(1.0, 0.9, 0.72) * 1.1, smoothstep(-0.25, 0.25, dot(dir, to)));
    k *= 0.2 + 0.8 * uNight;
  } else if (kind > 5.5) {
    if (kind < 6.5) {
      // a fire: two flickers out of step, and a little lift and sway in the flames
      float f = 0.62 + 0.38 * sin(uTime * (9.0 + aD.z * 4.0) + aD.z * 40.0) * sin(uTime * 3.7 + aD.z * 17.0);
      k *= f * (0.45 + 0.55 * uNight); p.y += aD.x * 0.08 * f;
    } else { float f = fract(uTime * 0.75 + aD.z); k *= step(f, 0.45) * (0.35 + 0.65 * uNight); }
  } else if (kind > 3.5) {
    p = (uBlimp * vec4(position, 1.0)).xyz;
    if (kind > 4.5) { float f = fract(uTime * 0.8 + aD.z); k *= smoothstep(0.0, 0.02, f) * smoothstep(0.14, 0.07, f) * 1.6; }
    k *= 0.35 + 0.65 * uNight;
  } else if (kind > 0.5) {
    // an aviation light: a slow red blink, by day as well
    float f = fract(uTime * 0.5 + aD.z);
    k *= smoothstep(0.0, 0.08, f) * smoothstep(0.55, 0.42, f) * (0.4 + 0.6 * uNight);
  } else k *= uNight;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = max(-mv.z, 1.0), px = aD.x * projectionMatrix[1][1] * 0.5 * uVH / d;
  gl_PointSize = max(px, 2.0);
  k *= min(1.0, px * px / 4.0);   // (a light smaller than two pixels keeps its share of the light)
#ifdef USE_FOG
  k *= 1.0 - 0.6 * bdFogF(d);
#endif
  vC = col * k * 2.2;
  if (k < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // off: put it out of sight
}
`;
export const POINTS_FRAG = `
varying vec3 vC;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q);
  if (r > 1.0) discard;
  gl_FragColor = vec4(vC * (exp(-r * 9.0) + 0.35 * (1.0 - r) * (1.0 - r)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
// the points, from the lists in the order to draw (quality steps leave off the end); `craft` is the matrix the craft's
// lights ride on
export function makePoints(order, { NIGHT, U, craft }) {
  const n = order.length, pa = new Float32Array(n * 3), pb = new Float32Array(n * 3), pd = new Float32Array(n * 4), pc = new Float32Array(n * 3);
  order.forEach((p, i) => { pa.set(p.slice(0, 3), i * 3); pb.set(p.slice(3, 6), i * 3); pd.set(p.slice(6, 10), i * 4); pc.set(p[10], i * 3); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pa, 3)); g.setAttribute('aB', new THREE.BufferAttribute(pb, 3));
  g.setAttribute('aD', new THREE.BufferAttribute(pd, 4)); g.setAttribute('aC', new THREE.BufferAttribute(pc, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: U.time, uNight: NIGHT, uVH: U.vh, uBlimp: { value: craft || new THREE.Matrix4() } },
    vertexShader: FOG_PARS + COMMON + POINTS_VERT, fragmentShader: POINTS_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = -1;   // (first of the see-through things: it is all far off, behind the smoke)
  p.matrixAutoUpdate = false; p.updateMatrix();
  return p;
}

// ---- the skyline round the horizon ------------------------------------------------------------------------------
// The skyline's texture holds, in its channels: red the shade of the building (1 the far rows, lighter in the haze), green
// a window's light, blue its tint (warm to cool, and past 0.8 an aviation light's red), alpha the outline. uBody is how
// dark the outlines stand against the haze, by day and by night.
const SKYLINE_FRAG = `
uniform sampler2D map; uniform float uNight; uniform vec2 uBody;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(map, vUv);
  if (t.a < 0.02) discard;
  vec3 haze = vec3(0.6, 0.55, 0.5);
#ifdef USE_FOG
  haze = fogColor;
#endif
  float shade = t.r / t.a;
  vec3 body = haze * mix(uBody.x, uBody.y, uNight) * mix(1.0, shade, 0.55);
  float b = t.b / t.a;
  vec3 tint = b > 0.8 ? vec3(1.0, 0.08, 0.04) * 2.0 : mix(vec3(1.0, 0.66, 0.38), vec3(0.66, 0.82, 1.0), b / 0.6);
  vec3 win = tint * (t.g / t.a) * uNight * 0.75;
  gl_FragColor = vec4(body + win, t.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
// A ring of painted outlines just inside the camera's far edge, centred on the camera (so it is always as far off,
// like the sky), drawn straight after the sky and before everything else, so all of the scene stands in front of it.
// The texture goes round `rep` times; u 0 is due south (+z), going round by east.
export function makeSkyline(canvas, { NIGHT, R = 2200, top = 380, rep = 2, body = [0.84, 0.42] }) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
  const g = new THREE.CylinderGeometry(R, R, top + 20, 96, 1, true).translate(0, top / 2 - 10, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), map: { value: tex }, uRep: { value: rep }, uNight: NIGHT, uBody: { value: new THREE.Vector2(body[0], body[1]) } },
    vertexShader: 'varying vec2 vUv; uniform float uRep; void main(){ vUv = vec2(uv.x * uRep, uv.y); vec3 p = vec3(cameraPosition.x + position.x, position.y, cameraPosition.z + position.z); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }',
    fragmentShader: FOG_PARS + SKYLINE_FRAG,
    side: THREE.BackSide, depthWrite: false, fog: true,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const band = new THREE.Mesh(g, mat);
  band.renderOrder = -1.5; band.frustumCulled = false; band.matrixAutoUpdate = false; band.updateMatrix();
  return band;
}
// The skyline: rows of buildings of all heights, painted texel by texel so the channels hold exactly what the shader
// reads. It wraps (the right edge runs into the left). `scale` (optional) shrinks the buildings by where round they
// are, 0 to 1 of the way round: lower over open water, say.
export function paintSkyline(W, H, rand, scale) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  // a slow swell along the skyline, so the buildings bunch into taller districts (whole waves, so it wraps)
  const swell = (x) => { const u = x / W * TAU; return (0.62 + 0.22 * Math.sin(u * 2 + 0.7) + 0.12 * Math.sin(u * 5 + 2.1) + 0.06 * Math.sin(u * 11)) * (scale ? scale(x / W) : 1); };
  const put = (x, y, r, gg, b) => { if (y < 0 || y >= H) return; const i = (((x % W) + W) % W + (H - 1 - y) * W) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; };
  for (const [shade, hMax, wMin, wMax, gap] of [[235, 70, 5, 16, 2], [150, 118, 6, 22, 4]]) {
    for (let x = 0; x < W;) {
      const w = Math.round(wMin + rand() * (wMax - wMin)), h = Math.round(Math.max(6, hMax * swell(x) * (0.35 + rand() * 0.75)));
      const lit = 0.12 + rand() * 0.25, tint = rand() < 0.75 ? rand() * 0.25 : 0.35 + rand() * 0.25;
      for (let i = x; i < x + w; i++) for (let y = 0; y < h; y++) {
        const win = (i - x) % 2 === 1 && y % 2 === 1 && y < h - 2 && i < x + w - 1 && rand() < lit;
        put(i, y, shade, win ? 140 + rand() * 115 : 0, win ? Math.round(tint * 255) : 0);
      }
      if (h > hMax * 0.7 && rand() < 0.5) { const ax = x + (w >> 1), ah = 4 + Math.round(rand() * 9); for (let y = h; y < h + ah; y++) put(ax, y, shade, 0, 0); put(ax, h + ah, shade, 255, 240); }
      x += w + Math.round(rand() * gap);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ---- the craft overhead -------------------------------------------------------------------------------------------
// The blimp: a long envelope (fuller at the nose), four tail fins and a gondola, in one mesh. Its sides carry the show's
// name in lights; it goes round on a wide ellipse, nose first, a little up and down. Its lights go in the points
// (kinds 4 and 5), carried round on its matrix.
export function makeBlimp(B, mobile, NIGHT, pt) {
  const len = B.len, rad = B.len * 0.13;
  const env = new THREE.SphereGeometry(1, 40, 20), p = env.attributes.position, uv = env.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    // the sphere's poles are on y: turn them onto x (nose +x: a quarter turn, not a swap, which would turn it inside
    // out), and give each point its place on the painted skin: along its length (u), and round it (v, from the bottom,
    // where the join in the paint does not show)
    const sx = p.getY(i), sy = -p.getX(i), sz = p.getZ(i), f = 1 + 0.12 * sx;
    p.setXYZ(i, sx * len / 2, sy * rad * f, sz * rad * f);
    uv.setXY(i, (sx + 1) / 2, Math.atan2(sz, sy) / TAU + 0.5);
  }
  env.computeVertexNormals();
  const part = (w, h, d, x, y, z, u, v) => { const b = new THREE.BoxGeometry(w, h, d).translate(x, y, z), a = b.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, u, v); return b; };
  const fx = -len * 0.4, fl = len * 0.16, fh = rad * 0.95;
  const geo = mergeGeometries([
    env,
    part(fl, fh, 2, fx, rad * 0.55 + fh / 2 - 4, 0, 0.004, 0.996), part(fl, fh, 2, fx, -rad * 0.55 - fh / 2 + 4, 0, 0.004, 0.996),
    part(fl, 2, fh, fx, 0, rad * 0.55 + fh / 2 - 4, 0.004, 0.996), part(fl, 2, fh, fx, 0, -rad * 0.55 - fh / 2 + 4, 0.004, 0.996),
    part(len * 0.2, rad * 0.32, rad * 0.4, len * 0.08, -rad - rad * 0.12, 0, 0.004, 0.004),
  ]);
  // the skin, and what of it is lit: the name along each side between red lines, the channel by the tail
  const skin = (w, h, lit) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = lit ? '#000' : '#c9ccd2'; g.fillRect(0, 0, w, h);
    if (!lit) { g.fillStyle = '#b02a22'; g.fillRect(0, 0, w * 0.012, h * 0.5); g.fillStyle = '#26272b'; g.fillRect(0, h * 0.5, w * 0.012, h * 0.5); }
    // the side at v 0.75 (+z) is painted upside down and the one at v 0.25 (-z) back to front, as each is seen
    for (const [cy, sx, sy] of [[0.25, 1, -1], [0.75, -1, 1]]) {
      g.save(); g.translate(w / 2, cy * h); g.scale(sx, sy * 0.3);
      if (!lit) { g.fillStyle = '#1c1c22'; g.fillRect(-w * 0.4, -h * 0.4, w * 0.8, h * 0.8); }
      g.fillStyle = '#e23b2e'; g.fillRect(-w * 0.4, -h * 0.42, w * 0.8, h * 0.05); g.fillRect(-w * 0.4, h * 0.37, w * 0.8, h * 0.05);
      g.font = `900 ${Math.round(h * 0.42)}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const tw = g.measureText(B.name).width, k = Math.min(1, w * 0.62 / tw);
      g.save(); g.scale(k, 1); g.fillStyle = lit ? '#ffcc40' : '#ffd23a'; g.fillText(B.name, 0.06 * w / k, -h * 0.02); g.restore();
      g.font = `900 ${Math.round(h * 0.2)}px "Arial Black", Impact, sans-serif`; g.fillStyle = lit ? '#6ab8ff' : '#ffffff'; g.fillText(B.sub, -w * 0.34, 0);
      g.restore();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  const S = mobile ? 512 : 1024;
  const mat = new THREE.MeshLambertMaterial({ map: skin(S, S / 4, false), emissiveMap: skin(S / 2, S / 8, true), emissive: 0xffffff });
  mat.customProgramCacheKey = () => 'bd-blimp';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.bdNight = NIGHT;
    fogKeep(sh, 0.8, 0.45);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float bdNight;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 0.08 + 1.9 * bdNight; totalEmissiveRadiance += diffuseColor.rgb * 0.05 * bdNight; bdGlow = totalEmissiveRadiance;');
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.matrixAutoUpdate = false;
  // its lights: red to port and green to starboard on the tail fins, a white strobe on top of the tail and one under
  // the gondola
  pt(-0.4 * B.len, 0, -0.2 * B.len, 9, 4, [1, 0.08, 0.04]);
  pt(-0.4 * B.len, 0, 0.2 * B.len, 9, 4, [0.1, 1, 0.2]);
  pt(-0.46 * B.len, 0.16 * B.len, 0, 12, 5, [1, 1, 1], 0);
  pt(0.1 * B.len, -0.17 * B.len, 0, 12, 5, [1, 1, 1], 0.5);
  const w = B.speed / ((B.rx + B.rz) / 2);
  return {
    mesh,
    step(dt, t) {
      const a = B.a0 + t * w, x = B.x + Math.cos(a) * B.rx, z = B.z + Math.sin(a) * B.rz;
      const tx = -Math.sin(a) * B.rx, tz = Math.cos(a) * B.rz;
      mesh.position.set(x, B.y + Math.sin(t * 0.21) * 5, z);
      mesh.rotation.set(0, Math.atan2(-tz, tx), Math.sin(t * 0.17) * 0.02);
      mesh.updateMatrix(); mesh.updateMatrixWorld(true);
    },
  };
}

// The camera helicopter: a news crew's, hanging over the course a way ahead of the player and turned to film the
// cars coming at it, keeping up with them round the lap. Body, tail boom, fin, skids and rotors in one mesh with its
// colours in the vertices; the rotors turn in the shader. Its lights go in the points like the blimp's.
export function makeHeli(H, mobile, NIGHT, U, pt) {
  const s = H.size || 1, parts = [];
  // a box: w along the length (x, nose +x), h, d; spin 1 for the main rotor's blades, 2 the tail rotor's
  const box = (w, h, d, x, y, z, hex, spin = 0, ry = 0) => {
    const b = new THREE.BoxGeometry(w * s, h * s, d * s);
    if (ry) b.rotateY(ry);
    b.translate(x * s, y * s, z * s); b.deleteAttribute('uv');
    const c = lin(hex), n = b.attributes.position.count, col = new Float32Array(n * 3), sp = new Float32Array(n);
    for (let i = 0; i < n; i++) { col.set(c, i * 3); sp[i] = spin; }
    b.setAttribute('color', new THREE.BufferAttribute(col, 3)); b.setAttribute('aSpin', new THREE.BufferAttribute(sp, 1));
    parts.push(b);
  };
  const BODY = H.body || 0xe8e6e0, BAND = H.band || 0x1d4f9c, GLASS = 0x182028, DARK = 0x2a2c30;
  box(9, 5.2, 5.6, 0.5, 0.2, 0, BODY);                 // the cabin
  box(4.2, 3.6, 5.0, 5.2, -0.4, 0, GLASS);             // the nose, glazed
  box(9.4, 1.6, 5.8, 0.4, -2.0, 0, BAND);              // a band along the belly
  box(11, 1.4, 1.4, -9.2, 1.2, 0, BODY);               // the tail boom
  box(2.6, 4.4, 0.6, -14.2, 3.2, 0, BAND);             // the fin
  box(3.2, 0.5, 4.0, -12.4, 1.2, 0, BODY);             // the tailplane
  for (const z of [-2.6, 2.6]) { box(10, 0.45, 0.5, 0.4, -4.6, z, DARK); box(0.4, 1.8, 0.4, 2.4, -3.6, z, DARK); box(0.4, 1.8, 0.4, -1.8, -3.6, z, DARK); }
  box(1.6, 1.2, 1.6, 0.4, 3.3, 0, DARK);               // the mast
  for (const a of [0, Math.PI / 2]) box(26, 0.22, 1.1, 0.4, 4.0, 0, 0x16181b, 1, a);   // two blades, crossed
  box(0.5, 5.2, 0.16, -14.2, 3.4, 0.6, 0x16181b, 2); box(5.2, 0.5, 0.16, -14.2, 3.4, 0.6, 0x16181b, 2);   // the tail rotor
  const geo = mergeGeometries(parts);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.customProgramCacheKey = () => 'bd-heli';
  const ROTOR = [0.4 * s, 4.0 * s], TAIL = [-14.2 * s, 3.4 * s];
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.bdTime = U.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSpin; uniform float bdTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
if (aSpin > 1.5) {
  // the tail rotor, about the boom's crosswise axis
  float a = bdTime * 31.0; vec2 q = transformed.xy - vec2(${F(TAIL[0])}, ${F(TAIL[1])});
  transformed.xy = vec2(${F(TAIL[0])}, ${F(TAIL[1])}) + mat2(cos(a), sin(a), -sin(a), cos(a)) * q;
} else if (aSpin > 0.5) {
  float a = bdTime * 23.0; vec2 q = transformed.xz - vec2(${F(ROTOR[0])}, 0.0);
  transformed.xz = vec2(${F(ROTOR[0])}, 0.0) + mat2(cos(a), sin(a), -sin(a), cos(a)) * q;
}`);
    fogKeep(sh, 0.85, 0.5);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.matrixAutoUpdate = false;
  // its lights: red to port and green to starboard, a red beacon on the tail and a white strobe under the belly, and
  // the camera's light in the nose
  pt(0, -1.6 * s, -3.2 * s, 5, 4, [1, 0.08, 0.04]);
  pt(0, -1.6 * s, 3.2 * s, 5, 4, [0.1, 1, 0.2]);
  pt(-14.2 * s, 5.8 * s, 0, 6, 5, [1, 0.1, 0.05], 0.3);
  pt(0.4 * s, -3.2 * s, 0, 8, 5, [1, 1, 1], 0.8);
  pt(7.4 * s, -1.4 * s, 0, 9, 4, [1, 0.95, 0.85]);
  // Where it goes: a point on the course AHEAD voxels on from the player (or straight ahead of the car where there is no
  // course), at height Y with a slow drift from side to side, closed on smoothly; nose to the player. Closing on it
  // smoothly cuts the course's corners, over the blocks, and downtown's towers stand higher than Y: so it looks at the
  // roofs under it and on the way it is going (roof(x, z): backdrop.js) and climbs over them in good time, quicker than
  // it comes down again.
  const pos = new THREE.Vector3(), prev = new THREE.Vector3(), out = { i: 0, lat: 0, d: 0, s: 0 };
  const CLEAR = 8 * s;   // (how far over a roof it keeps)
  let hint = -1, ready = false, roll = 0;
  const over = (roof, x, z, tx, tz) => {
    let top = 0;
    for (let a = 0; a <= 0.75; a += 0.125) top = Math.max(top, roof(x + (tx - x) * a, z + (tz - z) * a));
    return top + CLEAR;
  };
  return {
    mesh, follows: true,
    step(dt, t, car, track, roof) {
      if (!car) return;
      let tx, tz, nx = 0, nz = 0;
      if (track && track.T) {
        const T = track.T, p = T.project(car.x, car.z, hint, 40, out); hint = p.i;
        const j = T.at(p.i + Math.round(H.ahead / T.STEP));
        tx = T.X[j]; tz = T.Z[j]; nx = T.TZ[j]; nz = -T.TX[j];
      } else { tx = car.x + Math.sin(car.yaw) * H.ahead; tz = car.z + Math.cos(car.yaw) * H.ahead; nx = Math.cos(car.yaw); nz = -Math.sin(car.yaw); }
      const sway = Math.sin(t * 0.23) * (H.sway || 18);
      tx += nx * sway; tz += nz * sway;
      let ty = H.y + Math.sin(t * 0.41) * 4;
      prev.copy(pos);
      if (!ready || Math.hypot(tx - pos.x, tz - pos.z) > 900) { pos.set(tx, roof ? Math.max(ty, over(roof, tx, tz, tx, tz)) : ty, tz); prev.copy(pos); ready = true; }
      else {
        const k = 1 - Math.exp(-dt * 0.9); pos.x += (tx - pos.x) * k; pos.z += (tz - pos.z) * k;
        if (roof) ty = Math.max(ty, over(roof, pos.x, pos.z, tx, tz));
        pos.y += (ty - pos.y) * (ty > pos.y ? 1 - Math.exp(-dt * 4) : k);
      }
      // nose to the player; tipped forward as it goes, banked into the way it is sliding
      const yaw = Math.atan2(-(car.z - pos.z), car.x - pos.x), vx = (pos.x - prev.x) / Math.max(dt, 1e-3), vz = (pos.z - prev.z) / Math.max(dt, 1e-3);
      const fx = Math.cos(yaw), fz = -Math.sin(yaw), fwd = vx * fx + vz * fz, side = vz * fx - vx * fz;   // (its right is (-fz, fx))
      roll += (clamp(side * 0.004, -0.3, 0.3) - roll) * Math.min(1, dt * 2);
      mesh.position.copy(pos);
      mesh.rotation.set(roll, yaw, -clamp(fwd * 0.003, -0.25, 0.25) - 0.04, 'YZX');
      mesh.updateMatrix(); mesh.updateMatrixWorld(true);
    },
  };
}
