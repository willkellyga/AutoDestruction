// A block of cubes that can be painted, meshed with baked corner shading (same look as the kaiju and the town walls),
// and carved when it is hit. One VoxPart hangs on one bone of a unit.
// Lengths outside this file are in town voxels (a quarter metre); a part's own cubes are `h` town voxels across.
import * as THREE from 'three';

export const GLOW = 1 << 24; // flag on a colour: this cube goes in the glowing mesh (lamps, muzzle flash)

export function hash(i, j, k, s = 0) { let h = (i * 374761393 + j * 668265263 + k * 2147483647 + s * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function tone(hex, m) { return (hex & GLOW) | (Math.min(255, ((hex >> 16) & 255) * m) << 16) | (Math.min(255, ((hex >> 8) & 255) * m) << 8) | Math.min(255, (hex & 255) * m); }

const AXES = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];

export class VoxPart {
  // box: [i0, j0, k0, i1, j1, k1] in cubes, relative to the bone's pivot
  constructor(box, h, seed = 0) {
    this.i0 = box[0]; this.j0 = box[1]; this.k0 = box[2];
    this.nx = box[3] - box[0]; this.ny = box[4] - box[1]; this.nz = box[5] - box[2];
    this.h = h; this.seed = seed; this.count = 0;
    this.col = new Int32Array(this.nx * this.ny * this.nz).fill(-1);
    this.meshes = [null, null];
  }
  // painting, in cube coordinates relative to the pivot; c is a colour or a function (i, j, k) -> colour or -1
  set(i, j, k, c) {
    i -= this.i0; j -= this.j0; k -= this.k0;
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return;
    const n = (k * this.ny + j) * this.nx + i, v = typeof c === 'function' ? c(i + this.i0, j + this.j0, k + this.k0) : c;
    if (this.col[n] < 0 && v >= 0) this.count++; else if (this.col[n] >= 0 && v < 0) this.count--;
    this.col[n] = v;
  }
  box(i0, j0, k0, i1, j1, k1, c) { for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) this.set(i, j, k, c); }
  at(i, j, k) { return (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) ? -1 : this.col[(k * this.ny + j) * this.nx + i]; }

  // (re)build the meshes; mats = [plain, glowing]
  build(mats, parent) {
    const { nx, ny, nz, h } = this, x0 = this.i0 * h, y0 = this.j0 * h, z0 = this.k0 * h;
    const out = [{ p: [], n: [], c: [], ix: [] }, { p: [], n: [], c: [], ix: [] }], tmp = new THREE.Color(), cell = [0, 0, 0], q = [0, 0, 0];
    const solid = (c, a, da, u, du, v, dv) => { q[0] = c[0]; q[1] = c[1]; q[2] = c[2]; q[a] += da; q[u] += du; q[v] += dv; return this.at(q[0], q[1], q[2]) >= 0 ? 1 : 0; };
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = this.at(i, j, k); if (c < 0) continue;
      cell[0] = i; cell[1] = j; cell[2] = k;
      const g = out[c & GLOW ? 1 : 0];
      tmp.setHex(c & 0xffffff).multiplyScalar(0.95 + 0.1 * hash(i, j, k, this.seed + 77));
      for (const [a, u, v] of AXES) for (const s of [1, -1]) {
        if (solid(cell, a, s, u, 0, v, 0)) continue;
        const base = g.p.length / 3, ao = [];
        const corners = s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
        for (const [cu, cv] of corners) {
          const pos = [i, j, k]; pos[a] += s > 0 ? 1 : 0; pos[u] += cu; pos[v] += cv; g.p.push(x0 + pos[0] * h, y0 + pos[1] * h, z0 + pos[2] * h);
          const nrm = [0, 0, 0]; nrm[a] = s; g.n.push(nrm[0], nrm[1], nrm[2]);
          const du = cu ? 1 : -1, dv = cv ? 1 : -1, s1 = solid(cell, a, s, u, du, v, 0), s2 = solid(cell, a, s, u, 0, v, dv), cr = solid(cell, a, s, u, du, v, dv);
          const o = s1 && s2 ? 0 : 3 - s1 - s2 - cr; ao.push(o);
          const sh = 0.6 + 0.4 * o / 3; g.c.push(tmp.r * sh, tmp.g * sh, tmp.b * sh);
        }
        if (ao[0] + ao[2] >= ao[1] + ao[3]) g.ix.push(base, base + 1, base + 2, base, base + 2, base + 3); else g.ix.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      }
    }
    let tris = 0;
    out.forEach((g, gi) => {
      let m = this.meshes[gi];
      if (!g.ix.length) { if (m) m.visible = false; return; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3)); geo.setIndex(g.ix); tris += g.ix.length / 3;
      if (m) { m.geometry.dispose(); m.geometry = geo; m.visible = true; }
      else { m = this.meshes[gi] = new THREE.Mesh(geo, mats[gi]); m.castShadow = gi === 0; m.receiveShadow = gi === 0; parent.add(m); }
    });
    this.tris = tris; return this;
  }

  // Remove every cube within r of a point given in the bone's own space. Cubes just outside are scorched.
  // Removed cubes are pushed to `out` as [x, y, z, colour] (bone space). Returns how many were removed.
  carve(lx, ly, lz, r, out, scorch = 1.2) {
    const { h } = this, R = r + scorch;
    const a0 = Math.max(0, Math.floor((lx - R) / h - this.i0)), a1 = Math.min(this.nx - 1, Math.floor((lx + R) / h - this.i0));
    const b0 = Math.max(0, Math.floor((ly - R) / h - this.j0)), b1 = Math.min(this.ny - 1, Math.floor((ly + R) / h - this.j0));
    const c0 = Math.max(0, Math.floor((lz - R) / h - this.k0)), c1 = Math.min(this.nz - 1, Math.floor((lz + R) / h - this.k0));
    let n = 0, touched = false;
    for (let k = c0; k <= c1; k++) for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) {
      const m = (k * this.ny + j) * this.nx + i, c = this.col[m]; if (c < 0) continue;
      const x = (this.i0 + i + 0.5) * h, y = (this.j0 + j + 0.5) * h, z = (this.k0 + k + 0.5) * h;
      const d = Math.hypot(x - lx, y - ly, z - lz) + (hash(i, j, k, this.seed) - 0.5) * h * 1.4; // ragged edge
      if (d <= r) { this.col[m] = -1; this.count--; n++; out.push([x, y, z, c & 0xffffff]); }
      else if (d <= R && !(c & GLOW)) { this.col[m] = tone(c, 0.38 + 0.5 * (d - r) / scorch); touched = true; }
    }
    this.dirty = this.dirty || n > 0 || touched;
    return n;
  }
  // Fill from a function of the cube's centre (cube coordinates relative to the pivot) -> colour or -1.
  fill(fn) {
    for (let k = 0; k < this.nz; k++) for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const n = (k * this.ny + j) * this.nx + i; if (this.col[n] >= 0) continue;
      const c = fn(this.i0 + i + 0.5, this.j0 + j + 0.5, this.k0 + k + 0.5); if (c >= 0) { this.col[n] = c; this.count++; }
    }
  }
  // Recolour cubes that are buried on all six sides, so a hole shows a dark inside instead of paint.
  inside(pal) {
    const hid = [];
    for (let k = 1; k < this.nz - 1; k++) for (let j = 1; j < this.ny - 1; j++) for (let i = 1; i < this.nx - 1; i++) {
      if (this.at(i, j, k) >= 0 && this.at(i - 1, j, k) >= 0 && this.at(i + 1, j, k) >= 0 && this.at(i, j - 1, k) >= 0 && this.at(i, j + 1, k) >= 0 && this.at(i, j, k - 1) >= 0 && this.at(i, j, k + 1) >= 0) hid.push((k * this.ny + j) * this.nx + i);
    }
    for (const n of hid) this.col[n] = pal[Math.floor(hash(n, 3, 1, this.seed) * pal.length)];
  }
  // A wreck: knock off a share of the cubes at random (pushed to `out` up to `max`) and scorch the rest.
  wreck(frac, out, max = 400) {
    const { h } = this;
    for (let k = 0; k < this.nz; k++) for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const n = (k * this.ny + j) * this.nx + i, c = this.col[n]; if (c < 0) continue;
      const r = hash(i >> 1, j >> 1, k >> 1, this.seed + 41);
      if (r < frac) { this.col[n] = -1; this.count--; if (out.length < max && hash(i, j, k, 8) < 0.5) out.push([(this.i0 + i + 0.5) * h, (this.j0 + j + 0.5) * h, (this.k0 + k + 0.5) * h, c & 0xffffff]); }
      else if (!(c & GLOW)) this.col[n] = tone(c, 0.25 + 0.3 * hash(i >> 1, j, k >> 1, 3));
      else this.col[n] = tone(c & 0xffffff, 0.2);
    }
    this.dirty = true;
  }
  // Every remaining cube, as [x, y, z, colour] in bone space; used when a unit bursts apart.
  all(out, keep = 1) {
    const { h } = this;
    for (let k = 0; k < this.nz; k++) for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const c = this.col[(k * this.ny + j) * this.nx + i];
      if (c >= 0 && (keep >= 1 || hash(i, j, k, 5) < keep)) out.push([(this.i0 + i + 0.5) * h, (this.j0 + j + 0.5) * h, (this.k0 + k + 0.5) * h, c & 0xffffff]);
    }
  }
}
