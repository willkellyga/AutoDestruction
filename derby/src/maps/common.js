// What every map shares: a painted ground canvas, closing the build, a route-finder for open ground, and spawn spots.
// A map is a plain object (see maps/index.js for the full list of what one can have). Lengths are town voxels.
import { WX, WZ, M, solid, rubbleBody, ctx, begin, finalize, place, set as setV } from '../../../src/world.js';
import { GK } from '../../../src/ground.js';

export { GK };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- the ground: one canvas the size of the map, GK texels a voxel ----------------------------------------------
// rect(x0, z0, x1, z1) fills in voxel units; speckle(...) scatters voxel-sized flecks so flat paint reads at the same
// grain as the buildings; r() is a seeded random number.
export function canvasFor(base = '#79aa62', seed = 77) {
  const cv = document.createElement('canvas'); cv.width = WX * GK; cv.height = WZ * GK;
  const g = cv.getContext('2d');
  const rect = (xa, za, xb, zb) => g.fillRect(xa * GK, za * GK, (xb - xa) * GK, (zb - za) * GK);
  let s = seed; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const speckle = (xa, za, xb, zb, n, cols) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; const x = Math.floor(xa + r() * (xb - xa)), z = Math.floor(za + r() * (zb - za)); rect(x, z, x + 1, z + 1); } };
  g.fillStyle = base; g.fillRect(0, 0, cv.width, cv.height);
  // mottle(...): soft blotches about `cell` voxels across instead of hard flecks, for a ground the floor's shader gives
  // its own fine grain (ground.js): a little canvas of random colours, one texel a cell, drawn up smooth over the box.
  // cols are [r, g, b, most alpha].
  const mottle = (xa, za, xb, zb, cell, cols) => {
    const w = Math.ceil((xb - xa) / cell) + 2, h = Math.ceil((zb - za) / cell) + 2;
    const sm = document.createElement('canvas'); sm.width = w; sm.height = h;
    const sg = sm.getContext('2d'), img = sg.createImageData(w, h), d = img.data;
    for (let i = 0; i < w * h; i++) { const c = cols[(r() * cols.length) | 0]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = c[3] * r() * 255; }
    sg.putImageData(img, 0, 0);
    // a big stretch is drawn up in two goes (to f times, then the rest of the way), which smooths away the diamonds one
    // big stretch leaves
    const f = clamp(Math.round(cell * GK / 4), 1, 4);
    const mid = f > 1 ? document.createElement('canvas') : sm;
    if (f > 1) { mid.width = w * f; mid.height = h * f; const mg = mid.getContext('2d'); mg.imageSmoothingEnabled = true; mg.imageSmoothingQuality = 'high'; mg.drawImage(sm, 0, 0, mid.width, mid.height); }
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(mid, f / 2, f / 2, mid.width - f, mid.height - f, (xa - cell / 2) * GK, (za - cell / 2) * GK, (w - 1) * cell * GK, (h - 1) * cell * GK);
    g.restore();
    sm.width = sm.height = mid.width = mid.height = 1;
  };
  return { cv, g, rect, speckle, mottle, r, GK };
}

// ---- closing the build ------------------------------------------------------------------------------------------
// The town's destruction needs the four rubble bodies (one per level) that falling storeys turn into, then finalize()
// counts every body's voxels. Call this last in a map's build().
export function finish() {
  place(0, 0, -1); ctx.lot = -1;
  for (let r = 0; r < 4; r++) { ctx.L = r; rubbleBody.push(begin('Rubble', 'rubble', false)); }
  finalize();
}

// ---- route-finding on open ground --------------------------------------------------------------------------------
// The map in cells of CELL voxels. A cell is blocked when anything stands in it at car height; cells next to a blocked
// one cost more, so routes keep a car's width off walls. The grid is checked again a few rows a frame, so walls that
// get knocked down open up. waypoint() gives the next point to drive at on the way to (tx, tz): the furthest point of
// the found route that can be seen straight from the car.
export function makeGridNav({ cell = 4, maxNodes = 6000, every = 0.6, side = 3 } = {}) {   // side: how wide a line to a waypoint must be clear
  const NX = Math.ceil(WX / cell), NZ = Math.ceil(WZ / cell), N = NX * NZ;
  const blocked = new Uint8Array(N), near = new Uint8Array(N);
  const cellBlocked = (i, k) => {
    const x0 = i * cell, z0 = k * cell;
    for (let x = x0; x < x0 + cell; x += 2) for (let z = z0; z < z0 + cell; z += 2) if (solid(x, 2, z) || solid(x, 4, z)) return 1;
    return 0;
  };
  let row = 0;
  const nearRow = (k) => {
    if (k < 0 || k >= NZ) return;
    for (let i = 0; i < NX; i++) {
      let b = 0; for (let dk = -1; dk <= 1 && !b; dk++) for (let di = -1; di <= 1; di++) { const ii = i + di, kk = k + dk; if (ii >= 0 && kk >= 0 && ii < NX && kk < NZ && blocked[kk * NX + ii]) { b = 1; break; } }
      near[k * NX + i] = b;
    }
  };
  function refreshRows(n) {
    const r0 = row;
    for (let r = 0; r < n; r++, row = (row + 1) % NZ) for (let i = 0; i < NX; i++) blocked[row * NX + i] = cellBlocked(i, row);
    if (n >= NZ) { for (let k = 0; k < NZ; k++) nearRow(k); return; }
    for (let r = -1; r <= n; r++) nearRow((r0 + r + NZ) % NZ);
  }
  let ready = false;
  const ensure = () => { if (!ready) { ready = true; refreshRows(NZ); } };
  const g = new Float32Array(N), from = new Int32Array(N), seen = new Uint32Array(N), shut = new Uint32Array(N); let stamp = 0;
  const heap = [];
  const push = (n, f) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], end = heap.pop(); if (heap.length) { heap[0] = end; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const cellOf = (x, z) => clamp(Math.floor(z / cell), 0, NZ - 1) * NX + clamp(Math.floor(x / cell), 0, NX - 1);
  // a route from cell a to cell b as a list of cells (b first), or null
  function route(a, b) {
    ensure(); stamp++; heap.length = 0;
    const bx = b % NX, bz = (b / NX) | 0, hx = (n) => { const dx = Math.abs(n % NX - bx), dz = Math.abs(((n / NX) | 0) - bz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    g[a] = 0; from[a] = -1; seen[a] = stamp; push(a, hx(a));
    let best = a, bestH = hx(a), count = 0;
    while (heap.length && count++ < maxNodes) {
      const [, n] = pop(); if (shut[n] === stamp) continue; shut[n] = stamp;
      if (n === b) { best = b; break; }
      const h = hx(n); if (h < bestH) { bestH = h; best = n; }
      const nx = n % NX, nz = (n / NX) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const x = nx + dx, z = nz + dz; if (x < 0 || z < 0 || x >= NX || z >= NZ) continue;
        const m = z * NX + x; if (blocked[m] && m !== b) continue;
        if (dx && dz && (blocked[nz * NX + x] || blocked[z * NX + nx])) continue;   // no cutting a corner
        const cost = g[n] + (dx && dz ? 1.414 : 1) * (near[m] ? 2.5 : 1);
        if (seen[m] === stamp && cost >= g[m]) continue;
        seen[m] = stamp; g[m] = cost; from[m] = n; push(m, cost + hx(m));
      }
    }
    const out = []; for (let n = best; n >= 0; n = from[n]) { out.push(n); if (n === a) break; }
    return out.length > 1 ? out : null;
  }
  const centre = (n, o) => { o.x = (n % NX + 0.5) * cell; o.z = (((n / NX) | 0) + 0.5) * cell; return o; };
  const _c = { x: 0, z: 0 };
  return {
    cell, NX, NZ, blocked, cellOf,
    blockedAt: (x, z) => { ensure(); return !!blocked[cellOf(x, z)]; },
    step(dt) { ensure(); this._t = (this._t || 0) + dt; const rows = Math.max(1, Math.round(NZ * dt / 3)); refreshRows(rows); },
    // the next point to drive at on the way from car c to (tx, tz)
    waypoint(c, tx, tz, out) {
      const st = c._nav || (c._nav = { next: 0, path: null, goal: -1 });
      const a = cellOf(c.x, c.z), b = cellOf(tx, tz), now = performance.now() / 1000;
      if (!st.path || now > st.next || Math.abs((b % NX) - (st.goal % NX)) + Math.abs(((b / NX) | 0) - ((st.goal / NX) | 0)) > 3) {
        st.path = route(a, b); st.goal = b; st.next = now + every * (0.8 + Math.random() * 0.4);
      }
      if (!st.path) { out.x = tx; out.z = tz; return out; }
      // the furthest cell along the route (up to 80 voxels on) with a clear line from the car
      let pick = st.path[st.path.length - 2] ?? st.path[0];
      for (let i = 0; i < st.path.length - 1; i++) {
        centre(st.path[i], _c);
        if (Math.hypot(_c.x - c.x, _c.z - c.z) > 80) continue;
        if (lineClear(c.x, c.z, _c.x, _c.z, 3, side)) { pick = st.path[i]; break; }
      }
      return centre(pick, out);
    },
  };
}
// a clear line at car height between two points (every 3 voxels), a car's width either side
export function lineClear(x0, z0, x1, z1, y = 3, side = 3) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 3), sx = -(z1 - z0) / (d || 1) * side, sz = (x1 - x0) / (d || 1) * side;
  for (let i = 1; i < n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    if (solid(Math.floor(x), y, Math.floor(z)) || solid(Math.floor(x + sx), y, Math.floor(z + sz)) || solid(Math.floor(x - sx), y, Math.floor(z - sz))) return false;
  }
  return true;
}

// ---- spawning --------------------------------------------------------------------------------------------------
// pick a free spot from a list, far from the player (or anywhere when there is none), away from the cars in `taken`
export function pickSpot(spots, player, taken, faceTo = null) {
  const free = spots.filter((p) => !solid(Math.floor(p.x), 3, Math.floor(p.z)) && taken.every((t) => Math.hypot(t.x - p.x, t.z - p.z) > 30));
  const list = free.length ? free : spots;
  list.sort((a, b) => (player ? Math.hypot(b.x - player.x, b.z - player.z) - Math.hypot(a.x - player.x, a.z - player.z) : Math.random() - 0.5));
  const p = list[Math.floor(Math.random() * Math.min(4, list.length))];
  const f = faceTo || player;
  return { x: p.x, z: p.z, yaw: p.yaw ?? (f ? Math.atan2(f.x - p.x, f.z - p.z) : Math.random() * 6.28) };
}

// ---- the radar ---------------------------------------------------------------------------------------------------
// a radar picture of what stands on the map, from the route-finder's grid (redrawn every couple of seconds, as walls go)
export function gridRadar(nav, colour = 'rgba(255,255,255,0.32)') {
  let cv = null, t = 0;
  return (R, s, ox, oy, w, h) => {
    const now = performance.now();
    if (!cv || now - t > 2000) {
      t = now; cv = cv || document.createElement('canvas'); cv.width = nav.NX; cv.height = nav.NZ;
      const g = cv.getContext('2d'), img = g.createImageData(nav.NX, nav.NZ);
      for (let n = 0; n < nav.NX * nav.NZ; n++) if (nav.blocked[n]) { img.data[n * 4] = img.data[n * 4 + 1] = img.data[n * 4 + 2] = 255; img.data[n * 4 + 3] = 90; }
      g.putImageData(img, 0, 0);
    }
    R.imageSmoothingEnabled = false; R.drawImage(cv, ox, oy, w, h);
    void colour;
  };
}

// ---- a placeholder open map (a walled yard with a few blocks), until a map is built out ----------------------------
export function openStub(o) {
  const nav = makeGridNav();
  const spots = [];
  return {
    outer: 0x8f8a74, ...o,
    build() {
      begin('Wall', 'barrier', false);
      for (let y = 0; y < 6; y++) { for (let x = 4; x < WX - 4; x++) { setV(x, y, 4, M.CONC); setV(x, y, WZ - 5, M.CONC); } for (let z = 4; z < WZ - 4; z++) { setV(4, y, z, M.CONC); setV(WX - 5, y, z, M.CONC); } }
      for (const [x, z] of [[160, 140], [340, 140], [160, 280], [340, 280], [256, 208]]) { begin('Block', 'barrier', false); for (let y = 0; y < 10; y++) for (let a = -10; a <= 10; a++) for (let b = -10; b <= 10; b++) setV(x + a, y, z + b, M.CONC); }
      for (let x = 40; x < WX - 40; x += 48) for (const z of [30, WZ - 30]) spots.push({ x, z });
      finish();
    },
    ground() { const c = canvasFor('#8d8673'); c.speckle(0, 0, WX, WZ, 60000, ['rgba(60,56,48,0.35)', 'rgba(200,190,160,0.3)']); return c.cv; },
    spawn: { x: 60, z: WZ / 2, yaw: Math.PI / 2 },
    waypoint: (c, tx, tz, out) => nav.waypoint(c, tx, tz, out),
    spawnPoint: (player, taken) => pickSpot(spots, player, taken),
    step: (dt) => nav.step(dt),
    radar: gridRadar(nav),
    nav,
  };
}
