// A block of cubes that can be painted, meshed with baked corner shading (same look as the kaiju and the town walls),
// and carved when it is hit. One VoxPart hangs on one bone of a unit.
// Lengths outside this file are in town voxels (a quarter metre); a part's own cubes are `h` town voxels across.
import * as THREE from 'three';

export const GLOW = 1 << 24; // flag on a colour: this cube goes in the glowing mesh (lamps, muzzle flash)

export function hash(i, j, k, s = 0) { let h = (i * 374761393 + j * 668265263 + k * 2147483647 + s * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function tone(hex, m) { return (hex & GLOW) | (Math.min(255, ((hex >> 16) & 255) * m) << 16) | (Math.min(255, ((hex >> 8) & 255) * m) << 8) | Math.min(255, (hex & 255) * m); }

const AXES = [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
const SLAB = 16, SLAB_MIN = 200000, SLAB_WORK = 250000;   // a part of SLAB_MIN cells or more is rebuilt a slab of SLAB layers at a time, about SLAB_WORK cells a call
// the index list of F four-cornered faces: 0 1 2, 0 2 3 and so on
function quadIndex(F) {
  const ix = F * 4 > 65535 ? new Uint32Array(F * 6) : new Uint16Array(F * 6);
  for (let f = 0, e = 0, v = 0; f < F; f++, e += 6, v += 4) { ix[e] = v; ix[e + 1] = v + 1; ix[e + 2] = v + 2; ix[e + 3] = v; ix[e + 4] = v + 2; ix[e + 5] = v + 3; }
  return ix;
}

export class VoxPart {
  // box: [i0, j0, k0, i1, j1, k1] in cubes, relative to the bone's pivot
  constructor(box, h, seed = 0) {
    this.i0 = box[0]; this.j0 = box[1]; this.k0 = box[2];
    this.nx = box[3] - box[0]; this.ny = box[4] - box[1]; this.nz = box[5] - box[2];
    this.h = h; this.seed = seed; this.count = 0;
    this.col = new Int32Array(this.nx * this.ny * this.nz).fill(-1);
    this.meshes = [null, null];
    this.kd0 = 1e9; this.kd1 = -1;   // the layers changed since the last build, while `dirty` is 2 (see touched)
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

  // (re)build the meshes; mats = [plain, glowing]. One quad for every cube face that shows, its corners darkened where
  // neighbours crowd them. Written over flat arrays (count the faces, then fill): a big hull is rebuilt on every hit.
  // How many faces of each kind (painted, glowing) the layers k0 to k1 - 1 show.
  faceCount(k0, k1, cnt) {
    const { nx, ny, nz, col } = this, L = nx * ny; let f0 = 0, f1 = 0;
    for (let k = k0, n = k0 * L; k < k1; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++, n++) {
      const c = col[n]; if (c < 0) continue;
      let f = 0;
      if (i === nx - 1 || col[n + 1] < 0) f++; if (i === 0 || col[n - 1] < 0) f++;
      if (j === ny - 1 || col[n + nx] < 0) f++; if (j === 0 || col[n - nx] < 0) f++;
      if (k === nz - 1 || col[n + L] < 0) f++; if (k === 0 || col[n - L] < 0) f++;
      if (c & GLOW) f1 += f; else f0 += f;
    }
    cnt[0] = f0; cnt[1] = f1;
  }
  // Write those faces: four corners each into A[kind].p, .n and .c, from at[kind] on (at moves along). The corners go
  // (0,0) (1,0) (1,1) (0,1) on a face that looks along +a, the other way round on one that looks along -a, and every face
  // is indexed 0 1 2, 0 2 3. So that the shading runs smoothly the diagonal sometimes has to be the other one; then the
  // face starts a corner later, and the index list can stay as it is whatever the cubes do.
  faceFill(k0, k1, A, at) {
    const { nx, ny, nz, h, col } = this, x0 = this.i0 * h, y0 = this.j0 * h, z0 = this.k0 * h, L = nx * ny;
    const D = [nx, ny, nz], ST = [1, nx, L], seed = this.seed + 77;
    const tmp = new THREE.Color(), cell = [0, 0, 0], pos = [0, 0, 0], ao = [0, 0, 0, 0], qp = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], qs = [0, 0, 0, 0];
    for (let k = k0, n = k0 * L; k < k1; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++, n++) {
      const c = col[n]; if (c < 0) continue;
      cell[0] = i; cell[1] = j; cell[2] = k;
      const gi = c & GLOW ? 1 : 0, g = A[gi]; let tinted = false, cr = 0, cg = 0, cb = 0;
      for (let a = 0; a < 3; a++) {
        const u = (a + 1) % 3, v = (a + 2) % 3, ca = cell[a], cu = cell[u], cv = cell[v], Du = D[u], Dv = D[v], su = ST[u], sv = ST[v];
        for (let s = 1; s >= -1; s -= 2) {
          const na = ca + s, inA = na >= 0 && na < D[a], nb = n + s * ST[a];
          if (inA && col[nb] >= 0) continue;
          if (!tinted) { tinted = true; tmp.setHex(c & 0xffffff).multiplyScalar(0.95 + 0.1 * hash(i, j, k, seed)); cr = tmp.r; cg = tmp.g; cb = tmp.b; }
          for (let q = 0; q < 4; q++) {
            const hi = q === 1 || q === 2, lo = q >= 2, fu = (s > 0 ? hi : lo) ? 1 : 0, fv = (s > 0 ? lo : hi) ? 1 : 0;
            pos[0] = i; pos[1] = j; pos[2] = k; pos[a] += s > 0 ? 1 : 0; pos[u] += fu; pos[v] += fv;
            const du = fu ? 1 : -1, dv = fv ? 1 : -1, uu = cu + du, vv = cv + dv, okU = uu >= 0 && uu < Du, okV = vv >= 0 && vv < Dv;
            const s1 = inA && okU && col[nb + du * su] >= 0 ? 1 : 0, s2 = inA && okV && col[nb + dv * sv] >= 0 ? 1 : 0, s3 = inA && okU && okV && col[nb + du * su + dv * sv] >= 0 ? 1 : 0;
            const o = s1 && s2 ? 0 : 3 - s1 - s2 - s3; ao[q] = o; qs[q] = 0.6 + 0.4 * o / 3;
            qp[q * 3] = x0 + pos[0] * h; qp[q * 3 + 1] = y0 + pos[1] * h; qp[q * 3 + 2] = z0 + pos[2] * h;
          }
          const r = ao[0] + ao[2] >= ao[1] + ao[3] ? 0 : 1, w0 = at[gi], P = g.p, N = g.n, C = g.c;
          for (let q = 0; q < 4; q++) {
            const from = (q + r) & 3, w = w0 + q * 3, sh = qs[from];
            P[w] = qp[from * 3]; P[w + 1] = qp[from * 3 + 1]; P[w + 2] = qp[from * 3 + 2];
            N[w] = 0; N[w + 1] = 0; N[w + 2] = 0; N[w + a] = s;
            C[w] = cr * sh; C[w + 1] = cg * sh; C[w + 2] = cb * sh;
          }
          at[gi] = w0 + 12;
        }
      }
    }
  }
  build(mats, parent) {
    if (this.built && this.nx * this.ny * this.nz >= SLAB_MIN && this.nz >= SLAB * 2) return this.buildSlabs(mats, parent);
    this.built = true; this.rg = null; this.more = false; this.kd0 = 1e9; this.kd1 = -1;
    const cnt = [0, 0]; this.faceCount(0, this.nz, cnt);
    const out = cnt.map((f) => (f ? { p: new Float32Array(f * 12), n: new Float32Array(f * 12), c: new Float32Array(f * 12) } : null));
    this.faceFill(0, this.nz, out, [0, 0]);
    let tris = 0;
    out.forEach((g, gi) => {
      let m = this.meshes[gi];
      if (!g) { if (m) m.visible = false; return; }
      const geo = new THREE.BufferGeometry(), F = cnt[gi];
      geo.setAttribute('position', new THREE.BufferAttribute(g.p, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(g.n, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(g.c, 3)); geo.setIndex(new THREE.BufferAttribute(quadIndex(F), 1)); tris += F * 2;
      if (m) { m.geometry.dispose(); m.geometry = geo; m.visible = true; }
      else { m = this.meshes[gi] = new THREE.Mesh(geo, mats[gi]); m.castShadow = gi === 0; m.receiveShadow = gi === 0; parent.add(m); }
    });
    this.tris = tris; return this;
  }
  // A big part's second build and every one after it. Rebuilding a ship's hull whole (2.4 million cells) took 50 to 70 ms
  // and sent 20 MB to the graphics card: four times a second while it was being bitten, and every few seconds while it
  // burned. Here the part is cut into slabs along its length, and each slab keeps its own stretch of the vertex lists with
  // a little room to spare. A build sums up each layer of cubes, compares the sums with the last build's, and refills and
  // sends only the slabs whose cubes (or whose neighbours' edge cubes) changed. Room not in use holds faces of no size. A
  // slab that outgrows its stretch moves to free room at the end of the lists; when that runs out, new lists are laid out.
  // One call refills only so many cells (SLAB_WORK); if slabs are still owed it sets `more`, and the unit calls again next
  // frame. So a change to the whole hull (charring, the blast that wrecks it) shows over a few frames instead of holding
  // one frame up, and newly laid-out lists take the old ones' place only once every slab is in them.
  buildSlabs(mats, parent) {
    const { nx, ny, nz, h, col } = this, L = nx * ny, S = Math.ceil(nz / SLAB);
    const sum = (k) => { let x = 0; for (let n = k * L, e = n + L; n < e; n++) x = Math.imul(x ^ col[n], 16777619) + 1 | 0; return x; };
    let rg = this.rg && this.rg.cells === col.length ? this.rg : null;
    if (rg && this.dirty) {   // (called with nothing new, it only carries on with the slabs still owed)
      const some = this.dirty === 2, ka = some ? Math.max(0, this.kd0) : 0, kb = some ? Math.min(nz - 1, this.kd1) : nz - 1;
      for (let k = ka; k <= kb; k++) {
        const x = sum(k); if (x === rg.sums[k]) continue;
        rg.sums[k] = x; const sl = (k / SLAB) | 0; rg.todo[sl] = 1;    // a face is shaded by the cubes one layer either side
        if (k % SLAB === 0 && sl > 0) rg.todo[sl - 1] = 1; if (k % SLAB === SLAB - 1 && sl < S - 1) rg.todo[sl + 1] = 1;
      }
    }
    this.kd0 = 1e9; this.kd1 = -1;
    const room = (f) => (f ? f + Math.max(64, f >> 3) : 0), two = [0, 0], at = [0, 0];
    const layout = () => {   // new lists, with every slab still to be filled; what is on screen stays until they are full
      const old = rg, need = [new Int32Array(S), new Int32Array(S)];
      for (let sl = 0; sl < S; sl++) { if (old && !old.todo[sl]) { need[0][sl] = old.used[0][sl]; need[1][sl] = old.used[1][sl]; } else { this.faceCount(sl * SLAB, Math.min(nz, (sl + 1) * SLAB), two); need[0][sl] = two[0]; need[1][sl] = two[1]; } }
      let sums = old && old.sums; if (!sums) { sums = new Int32Array(nz); for (let k = 0; k < nz; k++) sums[k] = sum(k); }
      rg = this.rg = { cells: col.length, sums, todo: new Uint8Array(S).fill(1), cur: 0, live: false, cap: [new Int32Array(S), new Int32Array(S)], start: [new Int32Array(S), new Int32Array(S)], used: [new Int32Array(S), new Int32Array(S)], arr: [null, null], geo: [null, null], end: [0, 0], F: [0, 0], moved: 0, laid: (old ? old.laid : 0) + 1 };
      const x0 = this.i0 * h, y0 = this.j0 * h, z0 = this.k0 * h;
      for (let gi = 0; gi < 2; gi++) {
        let E = 0; for (let sl = 0; sl < S; sl++) { rg.start[gi][sl] = E; E += rg.cap[gi][sl] = room(need[gi][sl]); }
        const F = E ? E + Math.max(512, E >> 2) : 0; rg.end[gi] = E; rg.F[gi] = F;
        if (!F) continue;
        const A = rg.arr[gi] = { p: new Float32Array(F * 12), n: new Float32Array(F * 12), c: new Float32Array(F * 12) }, geo = rg.geo[gi] = new THREE.BufferGeometry();
        for (const [name, a] of [['position', A.p], ['normal', A.n], ['color', A.c]]) { const t = new THREE.BufferAttribute(a, 3); t.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(name, t); }
        geo.setIndex(new THREE.BufferAttribute(quadIndex(F), 1)); geo.setDrawRange(0, E * 6);
        // the bounds are the part's whole box: stretches are refilled without the bounds being worked out again
        geo.boundingBox = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x0 + nx * h, y0 + ny * h, z0 + nz * h)); geo.boundingSphere = geo.boundingBox.getBoundingSphere(new THREE.Sphere());
      }
    };
    const sent = (gi, name, a0, n) => { if (!rg.live) return; const t = rg.geo[gi].attributes[name]; t.addUpdateRange(a0, n); t.needsUpdate = true; };
    if (!rg) layout();
    let work = SLAB_WORK;
    for (let i = 0, laid = false; i < S && work > 0; i++) {
      const sl = (rg.cur + i) % S; if (!rg.todo[sl]) continue;
      const k0 = sl * SLAB, k1 = Math.min(nz, k0 + SLAB);
      this.faceCount(k0, k1, two);
      let fits = true;
      for (let gi = 0; gi < 2 && fits; gi++) {
        const f = two[gi]; if (f <= rg.cap[gi][sl]) continue;
        const cap = room(f), a0 = rg.start[gi][sl] * 12, old = rg.cap[gi][sl] * 12;
        if (rg.end[gi] + cap > rg.F[gi]) { fits = false; break; }
        if (old) { rg.arr[gi].p.fill(0, a0, a0 + old); sent(gi, 'position', a0, old); }   // the stretch it leaves: faces of no size
        rg.start[gi][sl] = rg.end[gi]; rg.cap[gi][sl] = cap; rg.end[gi] += cap; rg.moved++;
        rg.geo[gi].setDrawRange(0, rg.end[gi] * 6);
      }
      if (!fits) { if (laid) break; layout(); laid = true; i = -1; continue; }   // no room left: lay out again and start over (once a call)
      at[0] = rg.start[0][sl] * 12; at[1] = rg.start[1][sl] * 12;
      this.faceFill(k0, k1, rg.arr, at);
      for (let gi = 0; gi < 2; gi++) {
        const A = rg.arr[gi], cap = rg.cap[gi][sl]; if (!A || !cap) { rg.used[gi][sl] = 0; continue; }
        const a0 = rg.start[gi][sl] * 12;
        rg.used[gi][sl] = (at[gi] - a0) / 12;
        A.p.fill(0, at[gi], a0 + cap * 12);                                        // the room left over: faces of no size
        for (const name of ['position', 'normal', 'color']) sent(gi, name, a0, cap * 12);
      }
      rg.todo[sl] = 0; rg.cur = (sl + 1) % S; work -= (k1 - k0) * L;
    }
    let left = 0; for (let sl = 0; sl < S; sl++) left += rg.todo[sl];
    if (!left && !rg.live) {   // the new lists are full: show them
      rg.live = true;
      for (let gi = 0; gi < 2; gi++) {
        let m = this.meshes[gi]; const geo = rg.geo[gi];
        if (!geo) { if (m) m.visible = false; continue; }
        if (m) { m.geometry.dispose(); m.geometry = geo; m.visible = true; }
        else { m = this.meshes[gi] = new THREE.Mesh(geo, mats[gi]); m.castShadow = gi === 0; m.receiveShadow = gi === 0; parent.add(m); }
      }
    }
    this.more = left > 0;
    let tris = 0; for (let gi = 0; gi < 2; gi++) for (let sl = 0; sl < S; sl++) tris += rg.used[gi][sl] * 2;
    this.tris = tris; return this;
  }

  // Say that cubes in layers k0 to k1 (along z) were changed and the part needs a build. `dirty` becomes 2, meaning
  // "only these layers", so a big part need not look through all its cubes to find what changed. Anything that changes
  // cubes without saying where just sets `dirty = true` as before, and that wins.
  touched(k0, k1) {
    if (this.dirty !== true) this.dirty = 2;
    if (k0 < this.kd0) this.kd0 = k0; if (k1 > this.kd1) this.kd1 = k1;
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
    if (n > 0 || touched) this.touched(c0, c1);
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
