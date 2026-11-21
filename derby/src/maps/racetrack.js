// A race circuit's shape, worked out once from a loop of control points, for the map that lays it out and the race mode
// that runs on it. Plain numbers only (no three.js, no voxels), so it can be checked on its own.
//
// makeTrack({ pts, halfW, ... }) gives (pts: control points for a smooth curve, or with smooth: false a dense path,
// such as streetLoop() makes for a course of straight runs and rounded corners):
//   N, L, STEP          the centre line sampled every STEP voxels round the lap: N samples, L voxels a lap
//   X, Z, TX, TZ, K     each sample's place, its heading (a unit vector) and how sharply it bends (1 / radius; above
//                       nought it bends to the left, the way a car's left is)
//   field               for every voxel of the map out to `reach` from the centre line: how far it is from the line
//                       (dist), which side (lat: across the track, the left plus), and the nearest sample (near)
//   project(x, z, hint) the sample nearest a point (searched round `hint`, the car's last one, so the two roads at a
//                       crossing don't get mixed up) with the point's place across the track
//   line                the racing line (racingLine): an offset across the track for each sample, kept inside the
//                       track's half-width or inside the room each side (lo, hi), and how sharply the line bends
//   crossings           the samples where the lap crosses itself, in pairs
//   WL, WR              (a street course's map adds these) the room left and right of each sample, out to whatever
//                       stands there; the race mode and its drivers keep inside them instead of halfW
// Lengths are voxels. A heading of yaw a (as the cars have it) points along (sin a, cos a); a car's left is (cos a, -sin a).

const wrapI = (i, n) => ((i % n) + n) % n;

// a closed centripetal Catmull-Rom curve through the points, sampled densely
function spline(P, per = 48) {
  const n = P.length, out = [];
  const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-3;
  for (let i = 0; i < n; i++) {
    const p0 = P[wrapI(i - 1, n)], p1 = P[i], p2 = P[wrapI(i + 1, n)], p3 = P[wrapI(i + 2, n)];
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    for (let k = 0; k < per; k++) {
      const t = t1 + (t2 - t1) * k / per, L = (a, b, ta, tb) => [a[0] * (tb - t) / (tb - ta) + b[0] * (t - ta) / (tb - ta), a[1] * (tb - t) / (tb - ta) + b[1] * (t - ta) / (tb - ta)];
      const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
      const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
      out.push(L(B1, B2, t1, t2));
    }
  }
  return out;
}
// the same points again every `step` voxels along the curve
function resample(D, step) {
  const n = D.length, cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + Math.hypot(D[i % n][0] - D[i - 1][0], D[i % n][1] - D[i - 1][1]));
  const total = cum[n], N = Math.round(total / step), out = [];
  let j = 0;
  for (let k = 0; k < N; k++) {
    const s = k * total / N;
    while (cum[j + 1] < s) j++;
    const t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1), a = D[j], b = D[(j + 1) % n];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return { pts: out, L: total };
}

// A loop of points as a road: headings, bends, and the distance field round it. Used for the circuit and the pit lane.
export function makeTrack({ pts, halfW = 24, step = 2, WX = 512, WZ = 416, reach = 72, closed = true, smooth = true }) {
  const { pts: S, L } = closed ? resample(smooth ? spline(pts) : pts, step) : openPath(pts, step);
  const N = S.length, STEP = L / N;
  const X = new Float32Array(N), Z = new Float32Array(N), TX = new Float32Array(N), TZ = new Float32Array(N), K = new Float32Array(N);
  for (let i = 0; i < N; i++) { X[i] = S[i][0]; Z[i] = S[i][1]; }
  const at = (i) => (closed ? wrapI(i, N) : Math.max(0, Math.min(N - 1, i)));
  for (let i = 0; i < N; i++) {
    const a = at(i - 1), b = at(i + 1), dx = X[b] - X[a], dz = Z[b] - Z[a], l = Math.hypot(dx, dz) || 1;
    TX[i] = dx / l; TZ[i] = dz / l;
  }
  // the bend: how fast the heading turns towards the car's left, per voxel, smoothed over a few samples
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = at(i - 2), b = at(i + 2);
    const cross = TX[a] * TZ[b] - TZ[a] * TX[b], dot = TX[a] * TX[b] + TZ[a] * TZ[b];
    // turning left is the heading swinging from (tx, tz) towards (tz, -tx)
    raw[i] = -Math.atan2(cross, dot) / (4 * STEP);
  }
  for (let i = 0; i < N; i++) { let s = 0; for (let k = -3; k <= 3; k++) s += raw[at(i + k)]; K[i] = s / 7; }

  // ---- the distance field ----
  const dist = new Float32Array(WX * WZ).fill(1e9), lat = new Float32Array(WX * WZ), near = new Int32Array(WX * WZ).fill(-1);
  const segs = closed ? N : N - 1;
  for (let i = 0; i < segs; i++) {
    const j = at(i + 1), ax = X[i], az = Z[i], bx = X[j], bz = Z[j], ex = bx - ax, ez = bz - az, ll = ex * ex + ez * ez || 1;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - reach)), x1 = Math.min(WX - 1, Math.ceil(Math.max(ax, bx) + reach));
    const z0 = Math.max(0, Math.floor(Math.min(az, bz) - reach)), z1 = Math.min(WZ - 1, Math.ceil(Math.max(az, bz) + reach));
    const nx = TZ[i], nz = -TX[i];
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - ax, pz = z + 0.5 - az;
      let t = (px * ex + pz * ez) / ll; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = px - ex * t, qz = pz - ez * t, d = Math.hypot(qx, qz), c = z * WX + x;
      if (d < dist[c] && d <= reach) { dist[c] = d; near[c] = t < 0.5 ? i : j; lat[c] = px * nx + pz * nz; }
    }
  }
  const field = { dist, lat, near, WX, WZ, reach };
  const cell = (x, z) => { const ix = Math.floor(x), iz = Math.floor(z); return ix < 0 || iz < 0 || ix >= WX || iz >= WZ ? -1 : iz * WX + ix; };

  // the sample nearest (x, z): from the field, or (with a hint) the best within `win` samples of the hint
  const _p = { i: 0, lat: 0, d: 0, s: 0 };
  function project(x, z, hint = -1, win = 40, out = _p) {
    let best = -1, bd = 1e18;
    if (hint >= 0) {
      for (let k = -win; k <= win; k++) {
        const i = at(hint + k), dx = x - X[i], dz = z - Z[i], d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
      // far from every sample near the hint (put back somewhere else, or across a crossing): look everywhere
      if (bd > (halfW * 2.2) * (halfW * 2.2)) best = -1;
    }
    if (best < 0) {
      const c = cell(x, z);
      if (c >= 0 && field.near[c] >= 0) best = field.near[c];
      else for (let i = 0; i < N; i++) { const dx = x - X[i], dz = z - Z[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    }
    out.i = best; out.lat = (x - X[best]) * TZ[best] - (z - Z[best]) * TX[best];
    // how far along the lap, in voxels, with the bit between samples
    const along = (x - X[best]) * TX[best] + (z - Z[best]) * TZ[best];
    out.s = best * STEP + along; out.d = Math.hypot(x - X[best], z - Z[best]);
    return out;
  }
  return { N, L, STEP, X, Z, TX, TZ, K, halfW, field, at, project, cell, closed };
}

// an open path (a pit lane) through its points, as straight runs with the corners rounded off
function openPath(P, step) {
  const D = [];
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5));
    for (let k = 0; k < n; k++) D.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  D.push(P[P.length - 1]);
  // round the corners a little
  for (let pass = 0; pass < 30; pass++) for (let i = 1; i < D.length - 1; i++) { D[i] = [(D[i - 1][0] + D[i][0] * 2 + D[i + 1][0]) / 4, (D[i - 1][1] + D[i][1] * 2 + D[i + 1][1]) / 4]; }
  const cum = [0];
  for (let i = 1; i < D.length; i++) cum.push(cum[i - 1] + Math.hypot(D[i][0] - D[i - 1][0], D[i][1] - D[i - 1][1]));
  const total = cum[cum.length - 1], N = Math.max(2, Math.round(total / step) + 1), out = [];
  let j = 0;
  for (let k = 0; k < N; k++) {
    const s = k * total / (N - 1);
    while (j < D.length - 2 && cum[j + 1] < s) j++;
    const t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1), a = D[j], b = D[j + 1];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return { pts: out, L: total };
}

// A closed loop of straight runs with rounded corners, as a dense path for makeTrack({ smooth: false }). P is the
// corners in order, [x, z, r]: r is the radius of the arc that rounds that corner off (0 for none), so two corners a
// diameter apart with the same radius make a hairpin. The path starts at the first corner, which should be on a straight.
export function streetLoop(P, d = 0.5) {
  const n = P.length;
  const arcs = P.map((p, i) => {
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n], r = p[2] || 0;
    let ux = p[0] - a[0], uz = p[1] - a[1], vx = b[0] - p[0], vz = b[1] - p[1];
    const lu = Math.hypot(ux, uz) || 1, lv = Math.hypot(vx, vz) || 1; ux /= lu; uz /= lu; vx /= lv; vz /= lv;
    const turn = Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz);
    if (!r || Math.abs(turn) < 1e-3) return { sx: p[0], sz: p[1], ex: p[0], ez: p[1], r: 0 };
    const t = r * Math.tan(Math.abs(turn) / 2), sx = p[0] - ux * t, sz = p[1] - uz * t, sg = Math.sign(turn);
    // the arc's middle is a radius from where it starts, square to the way in, on the side it turns to
    const cx = sx - uz * sg * r, cz = sz + ux * sg * r;
    return { sx, sz, ex: p[0] + vx * t, ez: p[1] + vz * t, r, cx, cz, turn };
  });
  const out = [];
  for (let i = 0; i < n; i++) {
    const A = arcs[i], B = arcs[(i + 1) % n];
    // the arc of this corner, then the straight to the next
    if (A.r) {
      const steps = Math.max(2, Math.ceil(Math.abs(A.turn) * A.r / d)), ox = A.sx - A.cx, oz = A.sz - A.cz;
      for (let k = 0; k < steps; k++) { const th = A.turn * k / steps, c = Math.cos(th), s = Math.sin(th); out.push([A.cx + ox * c - oz * s, A.cz + ox * s + oz * c]); }
    }
    const len = Math.hypot(B.sx - A.ex, B.sz - A.ez), m = Math.max(1, Math.ceil(len / d));
    for (let k = 0; k < m; k++) out.push([A.ex + (B.sx - A.ex) * k / m, A.ez + (B.sz - A.ez) * k / m]);
  }
  return out;
}

// Where the lap crosses itself: pairs of samples far apart round the lap but close on the map.
export function findCrossings(T) {
  const { N, X, Z, STEP } = T, far = Math.round(200 / STEP), out = [];
  const minD = new Float32Array(N).fill(1e9), other = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const g = Math.abs(i - j), gap = Math.min(g, N - g); if (gap < far) continue;
    const d = Math.hypot(X[i] - X[j], Z[i] - Z[j]); if (d < minD[i]) { minD[i] = d; other[i] = j; }
  }
  for (let i = 0; i < N; i++) {
    if (minD[i] > 2) continue;
    const a = minD[(i - 1 + N) % N], b = minD[(i + 1) % N];
    if (minD[i] <= a && minD[i] <= b && i < other[i]) out.push([i, other[i]]);
  }
  return out;
}

// The racing line: an offset across the track for each sample, keeping `margin` inside the track's edges, that bends as
// gently as it can. Each pass nudges every point against its fourth difference (the way a bent steel strip springs
// straight), coarse steps first and fine ones after, so a corner is taken wide on the way in, close at the apex and
// wide on the way out, as one long even curve.
export function racingLine(T, { margin = 8, passes = 500, lo = null, hi = null } = {}) {
  const { N, X, Z, TX, TZ, halfW, STEP } = T, lim = halfW - margin;
  const min = (i) => (lo ? lo[i] : -lim), max = (i) => (hi ? hi[i] : lim);
  const off = new Float32Array(N), px = new Float32Array(N), pz = new Float32Array(N);
  for (const span of [24, 12, 6]) {
    const k = Math.max(1, Math.round(span / STEP));
    for (let p = 0; p < passes; p++) {
      for (let i = 0; i < N; i++) { px[i] = X[i] + TZ[i] * off[i]; pz[i] = Z[i] - TX[i] * off[i]; }
      for (let i = 0; i < N; i++) {
        const a = (i - 2 * k + 2 * N) % N, b = (i - k + N) % N, c = (i + k) % N, d = (i + 2 * k) % N;
        const fx = px[a] - 4 * px[b] + 6 * px[i] - 4 * px[c] + px[d], fz = pz[a] - 4 * pz[b] + 6 * pz[i] - 4 * pz[c] + pz[d];
        const push = fx * TZ[i] - fz * TX[i];
        off[i] = Math.max(min(i), Math.min(max(i), off[i] - push * 0.05));
      }
    }
  }
  // how sharply the line itself bends (1 / radius), for the speed the rivals can take it at
  for (let i = 0; i < N; i++) { px[i] = X[i] + TZ[i] * off[i]; pz[i] = Z[i] - TX[i] * off[i]; }
  const bend = new Float32Array(N), g = Math.max(2, Math.round(8 / STEP));
  for (let i = 0; i < N; i++) {
    const a = (i - g + N) % N, b = (i + g) % N;
    const ax = px[i] - px[a], az = pz[i] - pz[a], bx = px[b] - px[i], bz = pz[b] - pz[i];
    const ang = Math.atan2(ax * bz - az * bx, ax * bx + az * bz), len = (Math.hypot(ax, az) + Math.hypot(bx, bz)) / 2 || 1;
    bend[i] = Math.abs(ang) / len;
  }
  const sm = new Float32Array(N);
  for (let i = 0; i < N; i++) { let s = 0; for (let j = -2; j <= 2; j++) s = Math.max(s, bend[(i + j + N) % N]); sm[i] = s; }
  return { off, bend: sm, px, pz };
}
