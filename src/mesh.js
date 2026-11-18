// Chunk meshing and the voxel look. Faces that share a material and have no corner shade are merged into runs,
// and the per-voxel detail (colour variation, weather stains, the line between voxels) is drawn in the shader,
// so a fine grid costs far fewer triangles than one quad per face.
//
// A vertex is 8 bytes, and a chunk mesh sits at its chunk's corner so positions fit in a byte:
//   pa  4 x uint8   x and z within the chunk (0..16), y (low 8 bits), then bits: y's ninth bit | face << 1 | glow << 4 | level << 6
//   pc  4 x uint8   colour with the corner shade in it, as square roots (so eight bits hold the dark end well), and the kind
// The shader works the normal out from the face. The arrays are dropped once they are on the graphics card, so the drawn
// town costs the page no memory of its own. (Full-size vertices cost 116 bytes a quad, kept twice.)
import * as THREE from 'three';
import { WX, WY, WZ, CH, NCX, NCZ, voxAt, ownerAt, goneAt, sootAt, burnAt, slabUsed, idx, solid, bodies, levelStats, MAT_R, MAT_G, MAT_B, KIND, SEE, K, PANE } from './world.js';

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
let PA = new Uint8Array(cap * 16), PC = new Uint8Array(cap * 16), FLIP = new Uint8Array(cap);
function grow() {
  cap *= 2;
  const a = new Uint8Array(cap * 16), c = new Uint8Array(cap * 16), f = new Uint8Array(cap);
  a.set(PA); c.set(PC); f.set(FLIP); PA = a; PC = c; FLIP = f;
}
function dropArray() { this.array = null; }
// what hides a face and casts corner shade: everything except see-through rebar
function occ(x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= WX || y >= WY || z >= WZ) return 0;
  const m = voxAt(idx(x, y, z));
  return m && !SEE[m] ? 1 : 0;
}
export const meshOpts = { merge: true, count: false };
const ao = [0, 0, 0, 0];

export function meshChunk(cx, cz) {
  const xs = cx * CH, zs = cz * CH;
  let top = -1;
  for (let by = (WY - 1) >> 3; by >= 0 && top < 0; by--) {
    if (!slabUsed(cx, cz, by)) continue;
    for (let y = by * 8 + 7; y >= by * 8 && top < 0; y--) for (let z = zs; z < zs + CH && top < 0; z++) { const a = idx(xs, y, z); for (let x = 0; x < CH; x++) if (voxAt(a + x)) { top = y; break; } }
  }
  if (top < 0) return null;
  let q = 0;
  for (let f = 0; f < 6; f++) {
    const F = FACES[f], n = F.n, u = F.u, v = F.v, far = FAR[F.run], axis = F.alongZ ? 1 : 0;
    for (let y = f === 3 ? 1 : 0; y <= top; y++) if (slabUsed(cx, cz, y >> 3)) for (let b = 0; b < CH; b++) {
      let runKey = -1, runQ = -1;
      for (let c = 0; c < CH; c++) {
        const x = F.alongZ ? xs + b : xs + c, z = F.alongZ ? zs + c : zs + b;
        const i = idx(x, y, z), m = voxAt(i);
        if (!m) { runKey = -1; continue; }
        const ax = x + n[0], ay = y + n[1], az = z + n[2], see = SEE[m];
        if (see ? solid(ax, ay, az) : occ(ax, ay, az)) { runKey = -1; continue; }
        const body = bodies[ownerAt(i)], lvl = body ? body.level : 1, rub = body && body.kind === 'rubble';
        const inb = ax >= 0 && az >= 0 && ax < WX && az < WZ && ay < WY;
        const broke = rub || (inb && goneAt(idx(ax, ay, az)) === 1);
        let kind = KIND[m], glow = 0;
        if (broke && kind !== K.REBAR && kind !== K.GLASS && kind !== K.LIT && kind !== K.LEAF) kind = K.BROKEN;
        const burning = burnAt(i);
        if (burning) glow = 3;
        else if (KIND[m] === K.LIT) glow = 1;
        else if (PANE[m] && body && body.lit && ((Math.imul(x >> 3, 7) + Math.imul((y / 12) | 0, 13) + Math.imul(z >> 3, 5) + body.id * 3) % 10) < 6) glow = 2;
        const st = sootAt(i);
        // corner shade: the eight cells around the face, one step out
        const e1 = occ(ax - u[0], ay - u[1], az - u[2]), e2 = occ(ax + u[0], ay + u[1], az + u[2]);
        const e3 = occ(ax - v[0], ay - v[1], az - v[2]), e4 = occ(ax + v[0], ay + v[1], az + v[2]);
        let open = !(e1 | e2 | e3 | e4);
        if (open) {
          open = !(occ(ax - u[0] - v[0], ay - u[1] - v[1], az - u[2] - v[2]) | occ(ax + u[0] - v[0], ay + u[1] - v[1], az + u[2] - v[2])
            | occ(ax + u[0] + v[0], ay + u[1] + v[1], az + u[2] + v[2]) | occ(ax - u[0] + v[0], ay - u[1] + v[1], az - u[2] + v[2]));
        }
        const key = open ? (m | (st >> 3) << 8 | (broke ? 1 : 0) << 13 | glow << 14 | lvl << 16) : -1;
        if (open && key === runKey && meshOpts.merge) { PA[runQ * 16 + far[0] * 4 + axis]++; PA[runQ * 16 + far[1] * 4 + axis]++; continue; }
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
        const bits = f << 1 | glow << 4 | lvl << 6;
        for (let k = 0; k < 4; k++) {
          const su = CORN[k][0], sv = CORN[k][1], o = q * 16 + k * 4, sh = AO[ao[k]];
          const py = y + 0.5 + 0.5 * (n[1] + su * u[1] + sv * v[1]);
          PA[o] = x - xs + 0.5 + 0.5 * (n[0] + su * u[0] + sv * v[0]); PA[o + 1] = z - zs + 0.5 + 0.5 * (n[2] + su * u[2] + sv * v[2]);
          PA[o + 2] = py & 255; PA[o + 3] = bits | py >> 8;
          PC[o] = Math.min(255, Math.sqrt(r * sh) * 255); PC[o + 1] = Math.min(255, Math.sqrt(g * sh) * 255); PC[o + 2] = Math.min(255, Math.sqrt(bl * sh) * 255); PC[o + 3] = kind;
        }
        FLIP[q] = ao[0] + ao[2] >= ao[1] + ao[3] ? 0 : 1;
        if (meshOpts.count && lvl < 4 && !rub) levelStats[lvl].quads++;
        runKey = key; runQ = q; q++;
      }
    }
  }
  return finish(q, top);
}
// Build the geometry from the first q quads in PA, PC and FLIP.
function finish(q, top, size = 16) {
  if (!q) return null;
  const geo = new THREE.BufferGeometry();
  const I = q * 4 > 65536 ? new Uint32Array(q * 6) : new Uint16Array(q * 6);
  for (let k = 0; k < q; k++) {
    const vi = k * 4, ii = k * 6;
    if (FLIP[k]) { I[ii] = vi + 1; I[ii + 1] = vi + 2; I[ii + 2] = vi + 3; I[ii + 3] = vi + 1; I[ii + 4] = vi + 3; I[ii + 5] = vi; }
    else { I[ii] = vi; I[ii + 1] = vi + 1; I[ii + 2] = vi + 2; I[ii + 3] = vi; I[ii + 4] = vi + 2; I[ii + 5] = vi + 3; }
  }
  geo.setAttribute('pa', new THREE.BufferAttribute(PA.slice(0, q * 16), 4).onUpload(dropArray));
  geo.setAttribute('pc', new THREE.BufferAttribute(PC.slice(0, q * 16), 4, true).onUpload(dropArray));
  geo.setIndex(new THREE.BufferAttribute(I, 1).onUpload(dropArray));
  geo.userData.bytes = q * 32 + I.byteLength;
  const hy = (top + 1) / 2, h = size / 2;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(h, hy, h), Math.hypot(h * 1.5, hy) + 1);   // the mesh sits at (xs, 0, zs)
  geo.userData.quads = q;
  return geo;
}

// ---- far chunks ---------------------------------------------------------------
// Far away a chunk is drawn from a coarse copy: each s x s x s block of voxels becomes one cell with the material most of
// its voxels have (see-through ones count as air; a block needs a quarter of its voxels filled), and only faces between a
// full cell and an empty one are drawn, merged into runs, with no corner shade. At s = 2 that is about a quarter of the
// faces, at s = 4 about a sixteenth. Bottom faces on the ground are left out. The shader's per-voxel look still applies.
const CNT = new Uint16Array(256), SEEN = new Uint16Array(64);   // materials are one byte
let CG = new Uint16Array(4096), CI = new Int32Array(4096);
let cgCell = -1;   // the handle of one voxel of the winning material, from the last cellMat call
function cellMat(X, Y, Z, s) {
  const x0 = X * s, y0 = Y * s, z0 = Z * s;
  if (x0 < 0 || z0 < 0 || x0 >= WX || z0 >= WZ || y0 >= WY) return 0;
  if (!slabUsed(x0 >> 4, z0 >> 4, y0 >> 3)) return 0;
  let ns = 0, best = 0, bc = 0, full = 0;
  for (let y = y0; y < y0 + s && y < WY; y++) for (let z = z0; z < z0 + s; z++) {
    const a = idx(x0, y, z);
    for (let x = 0; x < s; x++) {
      const m = voxAt(a + x);
      if (!m || SEE[m]) continue;
      full++;
      if (CNT[m]++ === 0) SEEN[ns++] = m;
      if (CNT[m] > bc) { bc = CNT[m]; best = m; cgCell = a + x; }
    }
  }
  for (let i = 0; i < ns; i++) CNT[SEEN[i]] = 0;
  return full * 4 >= s * s * s ? best : 0;
}
export function meshChunkCoarse(cx, cz, s) { const q = coarseQuads(cx, cz, s, 0, 0, 0); return finish(q, cTop); }
// A square of R x R chunks in one mesh (fewer draws far away), placed at the first chunk's corner.
export function meshRegionCoarse(cx0, cz0, R, s) {
  let q = 0, top = -1;
  for (let cz = cz0; cz < Math.min(cz0 + R, NCZ); cz++) for (let cx = cx0; cx < Math.min(cx0 + R, NCX); cx++) { q = coarseQuads(cx, cz, s, q, (cx - cx0) * CH, (cz - cz0) * CH); if (cTop > top) top = cTop; }
  return finish(q, top, R * CH);
}
let cTop = -1;
function coarseQuads(cx, cz, s, q, ox0, oz0) {
  const xs = cx * CH, zs = cz * CH, n = CH / s;
  let top = -1;
  for (let by = (WY - 1) >> 3; by >= 0 && top < 0; by--) if (slabUsed(cx, cz, by)) top = by * 8 + 7;
  cTop = top;
  if (top < 0) return q;
  const ny = ((top + s) / s) | 0, W = n + 2, L = W * W;   // cells up, and the grid's width with a one-cell border
  if (CG.length < L * (ny + 1)) { CG = new Uint16Array(L * (ny + 1) * 2); CI = new Int32Array(L * (ny + 1) * 2); }
  const X0 = cx * n - 1, Z0 = cz * n - 1;
  for (let Y = 0; Y <= ny; Y++) for (let gz = 0; gz < W; gz++) for (let gx = 0; gx < W; gx++) {
    const g = gx + gz * W + Y * L;
    if (Y === ny || ((gx === 0 || gx === W - 1) && (gz === 0 || gz === W - 1))) { CG[g] = 0; continue; }   // the corners are never looked at
    CG[g] = cellMat(X0 + gx, Y, Z0 + gz, s); CI[g] = cgCell;
  }
  const h = s / 2;
  for (let f = 0; f < 6; f++) {
    const F = FACES[f], nv = F.n, u = F.u, v = F.v, far = FAR[F.run], axis = F.alongZ ? 1 : 0;
    const dg = nv[0] + nv[2] * W + nv[1] * L;
    for (let Y = 0; Y < ny; Y++) for (let b = 0; b < n; b++) {
      let runKey = -1, runQ = -1;
      for (let c = 0; c < n; c++) {
        const lx = F.alongZ ? b : c, lz = F.alongZ ? c : b, g = (lx + 1) + (lz + 1) * W + Y * L, m = CG[g];
        if (!m || (f === 3 && Y === 0) || CG[g + dg]) { runKey = -1; continue; }
        const i = CI[g], body = bodies[ownerAt(i)], lvl = body ? body.level : 1;
        const x = i & 1023, y = i >> 20, z = (i >> 10) & 1023;
        let glow = 0;
        if (burnAt(i)) glow = 3;
        else if (KIND[m] === K.LIT) glow = 1;
        else if (PANE[m] && body && body.lit && ((Math.imul(x >> 3, 7) + Math.imul((y / 12) | 0, 13) + Math.imul(z >> 3, 5) + body.id * 3) % 10) < 6) glow = 2;
        const st = sootAt(i);
        const key = m | (st >> 3) << 8 | glow << 14 | lvl << 16;
        if (key === runKey) { PA[runQ * 16 + far[0] * 4 + axis] += s; PA[runQ * 16 + far[1] * 4 + axis] += s; continue; }
        if (q >= cap) grow();
        const dark = (1 - st / 255 * 0.78) * F.s;
        let r = MAT_R[m] * dark, gg = MAT_G[m] * dark, bl = MAT_B[m] * dark;
        if (glow === 3) { r = 1.0; gg = 0.5; bl = 0.12; }
        const bits = f << 1 | glow << 4 | lvl << 6, kind = KIND[m];
        const ox = ox0 + lx * s + h, oy = Y * s + h, oz = oz0 + lz * s + h;
        for (let k = 0; k < 4; k++) {
          const su = CORN[k][0], sv = CORN[k][1], o = q * 16 + k * 4;
          const py = oy + h * (nv[1] + su * u[1] + sv * v[1]);
          PA[o] = ox + h * (nv[0] + su * u[0] + sv * v[0]); PA[o + 1] = oz + h * (nv[2] + su * u[2] + sv * v[2]);
          PA[o + 2] = py & 255; PA[o + 3] = bits | py >> 8;
          PC[o] = Math.min(255, Math.sqrt(r) * 255); PC[o + 1] = Math.min(255, Math.sqrt(gg) * 255); PC[o + 2] = Math.min(255, Math.sqrt(bl) * 255); PC[o + 3] = kind;
        }
        FLIP[q] = 0;
        runKey = key; runQ = q; q++;
      }
    }
  }
  return q;
}

// Lambert, plus the per-voxel look. detail 0 leaves every face flat (and level 0 buildings are always flat).
export const look = { detail: { value: 1 }, dusk: { value: 0 }, edge: { value: 1 } };
const VERT_HEAD = `
attribute vec4 pa; attribute vec4 pc;
vec3 chunkPos() { return vec3(pa.x, pa.z + mod(pa.w, 2.0) * 256.0, pa.y); }
`;
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
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD + 'varying vec4 vCol; varying vec3 vAux; varying vec3 vWP; varying vec3 vN0;')
      .replace('#include <beginnormal_vertex>', 'int pb = int(pa.w + 0.5), face = (pb >> 1) & 7, ax = face >> 1;\nvec3 objectNormal = vec3(ax == 0 ? 1.0 : 0.0, ax == 1 ? 1.0 : 0.0, ax == 2 ? 1.0 : 0.0) * (1.0 - 2.0 * float(face & 1));')
      .replace('#include <begin_vertex>', 'vec3 transformed = chunkPos();\nvCol = vec4(pc.rgb, 1.0); vAux = vec3(floor(pc.a * 255.0 + 0.5), float((pb >> 4) & 3), float(pb >> 6)); vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vN0 = objectNormal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_LOOK)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FRAG_GLOW);
  };
  return mat;
}
// Shadows are drawn with their own material, which has to unpack the position the same way.
export function makeChunkDepthMaterial() {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
      .replace('#include <begin_vertex>', 'vec3 transformed = chunkPos();');
  };
  return mat;
}
