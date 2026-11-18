// Chunk meshing and the voxel look. Faces that share a material and have no corner shade are merged into runs,
// and the per-voxel detail (colour variation, weather stains, the line between voxels) is drawn in the shader,
// so a fine grid costs far fewer triangles than one quad per face.
import * as THREE from 'three';
import { WX, WY, WZ, CH, vox, owner, gone, soot, burnF, solid, bodies, levelStats, MAT_R, MAT_G, MAT_B, KIND, SEE, K, PANE } from './world.js';

// run: which in-plane axis a run of merged faces extends along (0 = u, 1 = v). alongZ: runs go along z, otherwise x.
const FACES = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], s: 0.86, alongZ: true, run: 1 },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], s: 0.8, alongZ: true, run: 0 },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], s: 1.0, alongZ: false, run: 1 },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], s: 0.6, alongZ: false, run: 0 },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], s: 0.92, alongZ: false, run: 0 },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], s: 0.76, alongZ: false, run: 1 },
];
const CORN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const FAR = [[1, 2], [2, 3]]; // the corners that move when a run grows along u, or along v
const AO = [0.5, 0.68, 0.84, 1.0];
let cap = 1 << 15;
let P = new Float32Array(cap * 12), N = new Int8Array(cap * 12), C = new Uint8Array(cap * 16), A = new Uint8Array(cap * 16), I = new Uint32Array(cap * 6);
function grow() {
  cap *= 2;
  const p = new Float32Array(cap * 12), n = new Int8Array(cap * 12), c = new Uint8Array(cap * 16), a = new Uint8Array(cap * 16), i = new Uint32Array(cap * 6);
  p.set(P); n.set(N); c.set(C); a.set(A); i.set(I); P = p; N = n; C = c; A = a; I = i;
}
// what hides a face and casts corner shade: everything except see-through rebar
function occ(x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= WX || y >= WY || z >= WZ) return 0;
  const m = vox[x + WX * (z + WZ * y)];
  return m && !SEE[m] ? 1 : 0;
}
export const meshOpts = { merge: true, count: false };
const ao = [0, 0, 0, 0];

export function meshChunk(cx, cz) {
  const xs = cx * CH, zs = cz * CH;
  let top = -1;
  for (let y = WY - 1; y >= 0 && top < 0; y--) for (let z = zs; z < zs + CH && top < 0; z++) { const a = xs + WX * (z + WZ * y); for (let x = 0; x < CH; x++) if (vox[a + x]) { top = y; break; } }
  if (top < 0) return null;
  let q = 0;
  for (let f = 0; f < 6; f++) {
    const F = FACES[f], n = F.n, u = F.u, v = F.v, far = FAR[F.run], axis = F.alongZ ? 2 : 0;
    for (let y = f === 3 ? 1 : 0; y <= top; y++) for (let b = 0; b < CH; b++) {
      let runKey = -1, runQ = -1;
      for (let c = 0; c < CH; c++) {
        const x = F.alongZ ? xs + b : xs + c, z = F.alongZ ? zs + c : zs + b;
        const i = x + WX * (z + WZ * y), m = vox[i];
        if (!m) { runKey = -1; continue; }
        const ax = x + n[0], ay = y + n[1], az = z + n[2], see = SEE[m];
        if (see ? solid(ax, ay, az) : occ(ax, ay, az)) { runKey = -1; continue; }
        const body = bodies[owner[i]], lvl = body ? body.level : 1, rub = body && body.kind === 'rubble';
        const inb = ax >= 0 && az >= 0 && ax < WX && az < WZ && ay < WY;
        const broke = rub || (inb && gone[ax + WX * (az + WZ * ay)] === 1);
        let kind = KIND[m], glow = 0;
        if (broke && kind !== K.REBAR && kind !== K.GLASS && kind !== K.LIT && kind !== K.LEAF) kind = K.BROKEN;
        const burning = burnF[i];
        if (burning) glow = 3;
        else if (KIND[m] === K.LIT) glow = 1;
        else if (PANE[m] && body && body.lit && ((Math.imul(x >> 3, 7) + Math.imul((y / 12) | 0, 13) + Math.imul(z >> 3, 5) + body.id * 3) % 10) < 6) glow = 2;
        const st = soot[i];
        // corner shade: the eight cells around the face, one step out
        const e1 = occ(ax - u[0], ay - u[1], az - u[2]), e2 = occ(ax + u[0], ay + u[1], az + u[2]);
        const e3 = occ(ax - v[0], ay - v[1], az - v[2]), e4 = occ(ax + v[0], ay + v[1], az + v[2]);
        let open = !(e1 | e2 | e3 | e4);
        if (open) {
          open = !(occ(ax - u[0] - v[0], ay - u[1] - v[1], az - u[2] - v[2]) | occ(ax + u[0] - v[0], ay + u[1] - v[1], az + u[2] - v[2])
            | occ(ax + u[0] + v[0], ay + u[1] + v[1], az + u[2] + v[2]) | occ(ax - u[0] + v[0], ay - u[1] + v[1], az - u[2] + v[2]));
        }
        const key = open ? (m | (st >> 3) << 8 | (broke ? 1 : 0) << 13 | glow << 14 | lvl << 16) : -1;
        if (open && key === runKey && meshOpts.merge) { P[runQ * 12 + far[0] * 3 + axis] += 1; P[runQ * 12 + far[1] * 3 + axis] += 1; continue; }
        if (q >= cap) grow();
        if (open) ao[0] = ao[1] = ao[2] = ao[3] = 3;
        else {
          const c0 = occ(ax - u[0] - v[0], ay - u[1] - v[1], az - u[2] - v[2]), c1 = occ(ax + u[0] - v[0], ay + u[1] - v[1], az + u[2] - v[2]);
          const c2 = occ(ax + u[0] + v[0], ay + u[1] + v[1], az + u[2] + v[2]), c3 = occ(ax - u[0] + v[0], ay - u[1] + v[1], az - u[2] + v[2]);
          ao[0] = (e1 && e3) ? 0 : 3 - (e1 + e3 + c0); ao[1] = (e2 && e3) ? 0 : 3 - (e2 + e3 + c1);
          ao[2] = (e2 && e4) ? 0 : 3 - (e2 + e4 + c2); ao[3] = (e1 && e4) ? 0 : 3 - (e1 + e4 + c3);
        }
        const dark = (1 - st / 255 * 0.78) * F.s;
        let r = MAT_R[m] * dark, g = MAT_G[m] * dark, bl = MAT_B[m] * dark;
        if (burning) { r = 1.0; g = 0.5; bl = 0.12; }
        for (let k = 0; k < 4; k++) {
          const su = CORN[k][0], sv = CORN[k][1], o = q * 12 + k * 3, o4 = q * 16 + k * 4, sh = AO[ao[k]];
          P[o] = x + 0.5 + 0.5 * (n[0] + su * u[0] + sv * v[0]);
          P[o + 1] = y + 0.5 + 0.5 * (n[1] + su * u[1] + sv * v[1]);
          P[o + 2] = z + 0.5 + 0.5 * (n[2] + su * u[2] + sv * v[2]);
          N[o] = n[0] * 127; N[o + 1] = n[1] * 127; N[o + 2] = n[2] * 127;
          // colours are stored as square roots so eight bits hold the dark end well
          C[o4] = Math.min(255, Math.sqrt(r * sh) * 255); C[o4 + 1] = Math.min(255, Math.sqrt(g * sh) * 255); C[o4 + 2] = Math.min(255, Math.sqrt(bl * sh) * 255); C[o4 + 3] = 255;
          A[o4] = kind; A[o4 + 1] = glow; A[o4 + 2] = lvl; A[o4 + 3] = 0;
        }
        const vi = q * 4, ii = q * 6;
        if (ao[0] + ao[2] >= ao[1] + ao[3]) { I[ii] = vi; I[ii + 1] = vi + 1; I[ii + 2] = vi + 2; I[ii + 3] = vi; I[ii + 4] = vi + 2; I[ii + 5] = vi + 3; }
        else { I[ii] = vi + 1; I[ii + 1] = vi + 2; I[ii + 2] = vi + 3; I[ii + 3] = vi + 1; I[ii + 4] = vi + 3; I[ii + 5] = vi; }
        if (meshOpts.count && lvl < 4 && !rub) levelStats[lvl].quads++;
        runKey = key; runQ = q; q++;
      }
    }
  }
  if (!q) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P.slice(0, q * 12), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N.slice(0, q * 12), 3, true));
  geo.setAttribute('vcol', new THREE.BufferAttribute(C.slice(0, q * 16), 4, true));
  geo.setAttribute('aux', new THREE.BufferAttribute(A.slice(0, q * 16), 4, false));
  geo.setIndex(new THREE.BufferAttribute(I.slice(0, q * 6), 1));
  const hy = (top + 1) / 2;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(xs + 8, hy, zs + 8), Math.hypot(12, hy) + 1);
  geo.userData.quads = q;
  return geo;
}

// Lambert, plus the per-voxel look. detail 0 leaves every face flat (and level 0 buildings are always flat).
export const look = { detail: { value: 1 }, dusk: { value: 0 }, edge: { value: 1 } };
const FRAG_HEAD = `
uniform float lookDetail; uniform float lookDusk; uniform float lookEdge;
varying vec4 vCol; varying vec3 vAux; varying vec3 vWP; varying vec3 vN0;
float h31(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
//                           plain brick plast roof  conc  glass wood  metal leaf  stone rebar char  lit   cloth water broken
const float VARY[16] = float[16](0.05, 0.34, 0.09, 0.24, 0.10, 0.0, 0.16, 0.06, 0.34, 0.26, 0.0, 0.5, 0.0, 0.05, 0.12, 0.0);
const float WEAR[16] = float[16](0.10, 0.45, 0.80, 0.30, 0.55, 0.0, 0.22, 0.25, 0.0, 0.50, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
const float EDGE[16] = float[16](0.55, 1.0, 0.8, 1.0, 0.7, 0.0, 0.8, 0.5, 0.7, 1.0, 0.0, 1.0, 0.25, 0.45, 0.0, 0.0);
`;
const FRAG_LOOK = `
vec3 lookCol = vCol.rgb * vCol.rgb;
int kind = int(vAux.x + 0.5);
vec3 an = abs(vN0);
vec2 uvp = an.y > 0.5 ? vWP.xz : (an.x > 0.5 ? vWP.zy : vWP.xy);
if (kind == 10) { vec2 g = abs(fract(uvp) - 0.5); if (g.x > 0.13 && g.y > 0.11) discard; }
if (lookDetail > 0.5 && vAux.z > 0.5) {
  vec3 cell = floor(vWP - vN0 * 0.5);
  if (kind == 15) {
    // a freshly broken face: rough and dusty, at a quarter of a voxel
    float hb = h31(floor((vWP - vN0 * 0.02) * 4.0) + 7.0);
    lookCol = mix(lookCol, vec3(dot(lookCol, vec3(0.33))), 0.25) * (0.62 + 0.55 * hb);
  } else if (kind == 5) {
    vec2 fu = fract(uvp);
    lookCol *= 0.82 + 0.3 * smoothstep(0.0, 1.0, fract((cell.y + fu.y) / 6.0)) + 0.1 * step(0.9, fract((uvp.x + uvp.y * 0.6) / 9.0));
  } else {
    vec3 hc = kind == 6 ? vec3(floor(cell.x / 5.0), cell.y, floor(cell.z / 5.0)) : (kind == 3 ? vec3(floor((cell.x + cell.z + mod(cell.y, 2.0)) / 2.0), cell.y, 0.0) : cell);
    float h = h31(hc);
    lookCol *= 1.0 + (h - 0.5) * VARY[kind];
    if (kind == 1 && h31(cell + 19.0) > 0.9) lookCol *= 0.72;
    float wear = WEAR[kind];
    float w = vnoise(cell / 9.0) * 0.6 + vnoise(cell / 3.1 + 5.0) * 0.4;
    // stains land voxel by voxel, thicker where the noise is high, so walls look patched and rained on
    if (h31(cell + 3.0) < smoothstep(0.36, 0.70, w) * wear) lookCol = mix(lookCol, lookCol * vec3(0.64, 0.49, 0.37), 0.4 + 0.55 * h31(cell + 9.0));
    else if (h31(cell + 13.0) < smoothstep(0.5, 0.8, vnoise(cell / 6.0 + 40.0)) * wear * 0.7) lookCol = mix(lookCol, vec3(dot(lookCol, vec3(0.34))) * 1.25 + 0.04, 0.45);
    lookCol *= mix(1.0, mix(0.8, 1.0, smoothstep(0.0, 7.0, cell.y + 3.0 * vnoise(cell / 4.0 + 70.0))), step(0.2, wear));
    vec2 fu = fract(uvp), e = min(fu, 1.0 - fu);
    float fw = max(fwidth(uvp.x), fwidth(uvp.y));
    float line = 1.0 - smoothstep(0.02, 0.05 + fw * 1.5, min(e.x, e.y));
    lookCol *= 1.0 - line * 0.2 * EDGE[kind] * lookEdge * clamp(1.0 - fw * 2.5, 0.0, 1.0);
  }
}
diffuseColor.rgb *= lookCol;
`;
const FRAG_GLOW = `
if (vAux.y > 2.5) totalEmissiveRadiance += vec3(1.0, 0.42, 0.08) * 1.1;
else if (vAux.y > 1.5) totalEmissiveRadiance += vec3(1.0, 0.78, 0.42) * lookDusk * 2.4;
else if (vAux.y > 0.5) totalEmissiveRadiance += vCol.rgb * vCol.rgb * mix(0.55, 2.3, lookDusk);
`;
export function makeChunkMaterial() {
  const mat = new THREE.MeshLambertMaterial();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.lookDetail = look.detail; sh.uniforms.lookDusk = look.dusk; sh.uniforms.lookEdge = look.edge;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 vcol; attribute vec4 aux; varying vec4 vCol; varying vec3 vAux; varying vec3 vWP; varying vec3 vN0;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCol = vcol; vAux = aux.xyz; vWP = position; vN0 = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_LOOK)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FRAG_GLOW);
  };
  return mat;
}
