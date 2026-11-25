// What makes a deck a bridge (maps/empire.js): towers, cables and trusses over a road that roads.js has already drawn.
// Two kinds, both our own takes on the kind:
//   'stone'  a suspension bridge: two stone towers with an arch over the road, a cable each side hung from their tops,
//            hangers down to the deck and stays fanning out from the towers, a lamp at the head of every hanger
//   'truss'  a steel cantilever bridge: a truss each side of the road, rising to a peak over each pier and dipping
//            between, braced across overhead where it is high enough to clear the chase camera
// All of it stands outside the deck's parapets or well over the road, so there is nothing new to drive into.
//
// dressBridges(scene, T, list): list of { part, kind } with part as roads.js takes it ({ i0, n, H, half }).
import * as THREE from 'three';

const STONE = [0.6, 0.53, 0.44], STONE3 = [0.54, 0.47, 0.39], STONE2 = [0.7, 0.64, 0.55], CABLE = [0.2, 0.2, 0.22], STEEL = [0.44, 0.33, 0.25], STEEL2 = [0.36, 0.27, 0.21];
const CLEAR = 34;   // nothing crosses over the road lower than this above it (the chase camera rides about 25 up)

export function dressBridges(scene, T, list) {
  const body = { pos: [], col: [], idx: [] }, glow = { pos: [], idx: [] };
  const quad = (buf, a, b, c, d, col) => { const n = buf.pos.length / 3; buf.pos.push(...a, ...b, ...c, ...d); if (buf.col) for (let k = 0; k < 4; k++) buf.col.push(...col); buf.idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  // a box from its eight corners: [low four, round], [high four, the same way round]
  const hull = (buf, lo, hi, col, caps = true) => {
    for (let k = 0; k < 4; k++) { const j = (k + 1) % 4; quad(buf, lo[k], lo[j], hi[j], hi[k], col); }
    if (caps) { quad(buf, hi[0], hi[1], hi[2], hi[3], col); quad(buf, lo[3], lo[2], lo[1], lo[0], col); }
  };
  // a straight member between two points, square, `t` thick
  const _d = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), SIDE = new THREE.Vector3(1, 0, 0);
  const beam = (buf, p0, p1, t, col) => {
    _d.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); if (_d.lengthSq() < 1e-6) return; _d.normalize();
    _u.crossVectors(_d, Math.abs(_d.y) > 0.95 ? SIDE : UP).normalize().multiplyScalar(t / 2); _v.crossVectors(_d, _u).normalize().multiplyScalar(t / 2);
    const ring = (p) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [p[0] + _u.x * a + _v.x * b, p[1] + _u.y * a + _v.y * b, p[2] + _u.z * a + _v.z * b]);
    hull(buf, ring(p0), ring(p1), col, false);
  };
  for (const { part, kind } of list) {
    const { i0, n, H, half } = part, L = n * T.STEP;
    // the deck's own frame: s along it from its start, l to the left of it
    const at = (s) => {
      const f = Math.max(0, Math.min(n - 0.001, s / T.STEP)), k = Math.floor(f), t = f - k, i = T.at(i0 + k), j = T.at(i0 + k + 1);
      return { x: T.X[i] + (T.X[j] - T.X[i]) * t, z: T.Z[i] + (T.Z[j] - T.Z[i]) * t, nx: T.TZ[i], nz: -T.TX[i], h: H[i] + (H[j] - H[i]) * t, w: half(i) };
    };
    const P = (s, l, y) => { const c = at(s); return [c.x + c.nx * l, y, c.z + c.nz * l]; };
    // an upright box in the deck's frame: s0 to s1 along, l0 to l1 across, y0 to y1
    const block = (s0, s1, l0, l1, y0, y1, col) => hull(body, [P(s0, l0, y0), P(s1, l0, y0), P(s1, l1, y0), P(s0, l1, y0)], [P(s0, l0, y1), P(s1, l0, y1), P(s1, l1, y1), P(s0, l1, y1)], col);
    const lampAt = (p, r = 0.55) => hull(glow, [[p[0] - r, p[1] - r, p[2] - r], [p[0] + r, p[1] - r, p[2] - r], [p[0] + r, p[1] - r, p[2] + r], [p[0] - r, p[1] - r, p[2] + r]], [[p[0] - r, p[1] + r, p[2] - r], [p[0] + r, p[1] + r, p[2] - r], [p[0] + r, p[1] + r, p[2] + r], [p[0] - r, p[1] + r, p[2] + r]]);
    const s1 = L * 0.25, s2 = L * 0.75, mid = L / 2, w = at(mid).w;
    if (kind === 'stone') {
      const TOP = 80, IN = w + 1.8, OUT = IN + 7.5, HALF = 6;
      for (const st of [s1, s2]) {
        for (const sd of [1, -1]) {
          for (let y = -4, k = 0; y < TOP; y += 6, k++) block(st - HALF, st + HALF, sd > 0 ? IN : -OUT, sd > 0 ? OUT : -IN, y, Math.min(TOP, y + 6), k % 2 ? STONE : STONE3);   // in courses
          block(st - HALF - 1.5, st + HALF + 1.5, sd > 0 ? IN - 1 : -OUT - 1.5, sd > 0 ? OUT + 1.5 : -IN + 1, -4, 3, STONE2);   // its foot in the water
          // the arch: corbels stepping in under the lintel
          const hd = at(st).h, a0 = hd + CLEAR + 4;
          block(st - HALF, st + HALF, sd > 0 ? IN - 4 : -IN, sd > 0 ? IN : -IN + 4, a0, a0 + 5, STONE);
          block(st - HALF, st + HALF, sd > 0 ? IN - 9 : -IN, sd > 0 ? IN : -IN + 9, a0 + 5, a0 + 10, STONE);
        }
        const a1 = at(st).h + CLEAR + 14;
        block(st - HALF, st + HALF, -IN, IN, a1, TOP, STONE);
        block(st - HALF - 1, st + HALF + 1, -OUT - 1, OUT + 1, TOP, TOP + 3, STONE2);   // the cornice
        block(st - HALF + 1.5, st + HALF - 1.5, -OUT + 2, OUT - 2, TOP + 3, TOP + 5, STONE);
      }
      // the cables: from an anchorage at each end up over the towers, hanging low between them
      const CL = w + 2.6, cy = (s) => {
        const e0 = at(0).h + 2.5, e1 = at(L).h + 2.5, top = TOP - 3;
        if (s <= s1) { const t = s / s1; return e0 + (top - e0) * t * t; }
        if (s >= s2) { const t = (L - s) / (L - s2); return e1 + (top - e1) * t * t; }
        const t = (s - mid) / (mid - s1), low = at(mid).h + 9; return low + (top - low) * t * t;
      };
      const HANG = 6, nH = Math.floor(L / HANG);
      for (const sd of [1, -1]) {
        for (let k = 0; k < nH; k++) { const a = k * L / nH, b = (k + 1) * L / nH; beam(body, P(a, sd * CL, cy(a)), P(b, sd * CL, cy(b)), 0.9, CABLE); }
        for (let k = 1; k < nH; k++) {
          const s = k * L / nH, y = cy(s), d = at(s).h;
          if (y - d < 5 || Math.abs(s - s1) < 7 || Math.abs(s - s2) < 7) continue;
          beam(body, P(s, sd * CL, y), P(s, sd * CL, d + 1), 0.28, CABLE);
          if (k % 2 === 0) lampAt(P(s, sd * CL, y + 0.9));
        }
        // the stays, fanning out from each tower's top to the deck
        for (const st of [s1, s2]) for (const dir of [1, -1]) for (const d of [16, 30, 44]) {
          const s = st + dir * d; if (s < 4 || s > L - 4) continue;
          beam(body, P(st + dir * 5, sd * CL, TOP - 8), P(s, sd * CL, at(s).h + 2), 0.22, CABLE);
        }
        block(-2, 5, sd > 0 ? w + 0.6 : -w - 4.6, sd > 0 ? w + 4.6 : -w - 0.6, at(0).h - 2, at(0).h + 5, STONE2);   // the anchorages
        block(L - 5, L + 2, sd > 0 ? w + 0.6 : -w - 4.6, sd > 0 ? w + 4.6 : -w - 0.6, at(L).h - 2, at(L).h + 5, STONE2);
      }
    } else {
      // the truss: how high its top stands over the deck, along it
      const PEAK = 50, DIP = 24, E = 12;
      const top = (s) => {
        if (s < E || s > L - E) return 0;
        const m = s <= s1 ? (s - E) / (s1 - E) : s >= s2 ? (L - E - s) / (L - E - s2) : -1;
        if (m >= 0) return PEAK * Math.pow(m, 1.35);
        const t = Math.abs(s - mid) / (mid - s1); return DIP + (PEAK - DIP) * Math.pow(t, 1.7);
      };
      const TL = w + 2.8, PANELS = 16, ds = (L - 2 * E) / PANELS;
      for (const sd of [1, -1]) {
        for (let k = 0; k < PANELS; k++) {
          const a = E + k * ds, b = a + ds, ha = at(a).h, hb = at(b).h, ta = ha + Math.max(1.2, top(a)), tb = hb + Math.max(1.2, top(b));
          beam(body, P(a, sd * TL, ha + 0.6), P(b, sd * TL, hb + 0.6), 1.3, STEEL2);             // the bottom chord
          beam(body, P(a, sd * TL, ta), P(b, sd * TL, tb), 1.3, STEEL);                          // the top chord
          if (k > 0 && top(a) > 2) beam(body, P(a, sd * TL, ha + 0.6), P(a, sd * TL, ta), 0.8, STEEL);   // a post
          if (top(a) > 3 || top(b) > 3) { if (k % 2) beam(body, P(a, sd * TL, ha + 0.6), P(b, sd * TL, tb), 0.6, STEEL2); else beam(body, P(a, sd * TL, ta), P(b, sd * TL, hb + 0.6), 0.6, STEEL2); }
        }
        // a tower at each peak, with a spire
        for (const st of [s1, s2]) {
          const hd = at(st).h, y1 = hd + PEAK + 6;
          block(st - 1.2, st + 1.2, sd > 0 ? TL - 1.2 : -TL - 1.2, sd > 0 ? TL + 1.2 : -TL + 1.2, hd - 2, y1, STEEL2);
          beam(body, P(st, sd * TL, y1), P(st, sd * TL, y1 + 9), 0.7, STEEL);
          lampAt(P(st, sd * TL, y1 + 9.6), 0.7);
        }
      }
      // across the top, where it is high enough: a strut at each post and a cross between
      for (let k = 0; k <= PANELS; k++) {
        const a = E + k * ds; if (top(a) < CLEAR) continue;
        const ya = at(a).h + top(a); beam(body, P(a, -TL, ya), P(a, TL, ya), 0.9, STEEL);
        const b = a + ds; if (k < PANELS && top(b) >= CLEAR) { const yb = at(b).h + top(b); beam(body, P(a, -TL, ya), P(b, TL, yb), 0.5, STEEL2); beam(body, P(a, TL, ya), P(b, -TL, yb), 0.5, STEEL2); }
      }
      for (const st of [s1, s2]) {   // the portal at each tower, and the stone pier under it
        const hd = at(st).h; beam(body, P(st, -TL, hd + PEAK + 5), P(st, TL, hd + PEAK + 5), 1.4, STEEL2); beam(body, P(st, -TL, hd + CLEAR + 4), P(st, TL, hd + CLEAR + 4), 1.1, STEEL2);
        block(st - 6, st + 6, -TL - 3, TL + 3, -4, hd - 2.5, STONE); block(st - 7.5, st + 7.5, -TL - 4.5, TL + 4.5, -4, 3, STONE2);
      }
      for (let k = 2; k < PANELS; k += 2) for (const sd of [1, -1]) { const a = E + k * ds; if (top(a) > 6) lampAt(P(a, sd * TL, at(a).h + top(a) + 1.1), 0.5); }
    }
  }
  const mesh = (buf, mat) => {
    if (!buf.idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3)); if (buf.col) g.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3));
    g.setIndex(buf.idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; m.updateMatrix(); m.frustumCulled = false; scene.add(m);
  };
  mesh(body, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh(glow, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 1.7), toneMapped: false }));
  return { tris: (body.idx.length + glow.idx.length) / 3 };
}
