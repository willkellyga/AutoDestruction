// New York past the edge of its map, for the race (maps/manhattan.js lays it out): the city carries on to the horizon
// instead of stopping at the water's edge. Brooklyn and Queens go on east and south of the map, the Bronx north of it,
// the far bank of the Hudson stands across the river to the west and an island closes the harbor off to the south,
// with the Narrows out to the sea between it and Brooklyn. A suspension bridge crosses the Narrows and a cable-stayed
// one the Hudson north of the map; traffic runs over both and out along the streets that leave the map. The news
// helicopter hangs over the course ahead of the player.
//   - The streets past the edge carry on the map's own (src/world.js's STREET_X and STREET_Z, then at the same spacing),
//     so the view down a street runs on between more towers to the horizon. The towers stand on the blocks between.
//   - A tower's height is set by how high its top stands seen from the nearest point of the course: from 2.5 degrees
//     on the nearest blocks to 8 on the furthest, more in the downtowns, under the top of the chase camera's picture
//     (about 14). Nothing stands further from any corner of the course than REACH, so it is all inside the camera's far
//     edge wherever the car is.
//   - Land and water are worked out in the ground's shader from the shores below (each a line with a little wobble),
//     the water the same blue as the map's own painted water, so the two meet without a seam.
import * as THREE from 'three';
import { F, V3, DEG, lin, clamp, LAMP, SODIUM, POLE, MAST, HOMES } from './kit.js';
import { flatGround } from './arena.js';

// How far a point is into the land past the map (less than 0 in the water), from a layout's shores: for the backdrop
// below, and for a map that wants to know where the water goes on past its edge (maps/water.js).
export function harborLand(L) {
  const W = L.world, SH = L.shores, [HZ0, HZ1] = SH.harlem, BK = SH.brooklyn, IS = SH.island, SO = SH.sound;
  const N1 = (t) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f), h = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }; return h(i) + (h(i + 1) - h(i)) * u; };
  const wob = (t) => 22 * (N1(t * 0.006) - 0.5) + 8 * (N1(t * 0.021 + 7) - 0.5);
  const bkW = (z) => BK.x + Math.max(0, z - W[3]) * BK.slope, bkS = (x) => BK.south + Math.max(0, x - BK.x - 90) * BK.fall + wob(x + 900) * 0.6;
  const sound = (x, z) => Math.min(x - (SO.x + wob(z + 2300)), z - (SO.z0 + wob(x + 2900) * 0.7), SO.z1 + wob(x + 3700) * 0.7 - z);
  const land = (x, z) => Math.min(-sound(x, z), Math.max(
    SH.jersey + wob(z) - x,
    Math.min(x - (SH.bronx + wob(z + 500) * 0.5), HZ0 - z),
    Math.min(x - bkW(z), z - HZ1, bkS(x) - z),
    Math.min(z - (IS.z + wob(x + 300)), IS.x + wob(z + 1700) - x),
  ));
  return { wob, bkW, bkS, land };
}

export function harbor(kit) {
  const { L, rand, pick, add, pt, pts, blink, tower, landmark } = kit;
  const W = L.world, SH = L.shores, REACH = L.reach, ST = L.streets;
  const [HZ0, HZ1] = SH.harlem, BK = SH.brooklyn, IS = SH.island, SO = SH.sound;
  // the course's corners, and how far a point is from the nearest point of the course's box and the furthest corner
  const [cx0, cz0, cx1, cz1] = L.course;
  const near = (x, z) => Math.hypot(Math.max(cx0 - x, 0, x - cx1), Math.max(cz0 - z, 0, z - cz1));
  const far = (x, z) => Math.max(Math.hypot(x - cx0, z - cz0), Math.hypot(x - cx1, z - cz0), Math.hypot(x - cx0, z - cz1), Math.hypot(x - cx1, z - cz1));

  // ---- land and water --------------------------------------------------------------------------------------------
  // How far a point is into the land past the map (less than 0 in the water): the union of the far bank (west), the
  // Bronx (north of the Harlem River, east of its shore on the Hudson), Brooklyn and Queens (east of the East River,
  // south of the Harlem, down to their shore on the harbor) and the island across the harbor. The same in JS and GLSL.
  const { wob, bkW, bkS, land } = harborLand(L);
  const WOB = `
float bdN1(float t) { float i = floor(t), f = t - i, u = f * f * (3.0 - 2.0 * f); return mix(fract(sin(i * 127.1 + 311.7) * 43758.5453), fract(sin((i + 1.0) * 127.1 + 311.7) * 43758.5453), u); }
float bdWob(float t) { return 22.0 * (bdN1(t * 0.006) - 0.5) + 8.0 * (bdN1(t * 0.021 + 7.0) - 0.5); }
float bdLand(vec2 p) {
  float bkW = ${F(BK.x)} + max(0.0, p.y - ${F(W[3])}) * ${F(BK.slope)}, bkS = ${F(BK.south)} + max(0.0, p.x - ${F(BK.x + 90)}) * ${F(BK.fall)} + bdWob(p.x + 900.0) * 0.6;
  float so = min(p.x - (${F(SO.x)} + bdWob(p.y + 2300.0)), min(p.y - (${F(SO.z0)} + bdWob(p.x + 2900.0) * 0.7), ${F(SO.z1)} + bdWob(p.x + 3700.0) * 0.7 - p.y));
  return min(-so, max(max(${F(SH.jersey)} + bdWob(p.y) - p.x, min(p.x - (${F(SH.bronx)} + bdWob(p.y + 500.0) * 0.5), ${F(HZ0)} - p.y)),
             max(min(min(p.x - bkW, p.y - ${F(HZ1)}), bkS - p.y), min(p.y - (${F(IS.z)} + bdWob(p.x + 300.0)), ${F(IS.x)} + bdWob(p.y + 1700.0) - p.x))));
}
`;
  // The streets: the map's own where they leave it, then on at the same spacing (across the map's width: its own five).
  const zLines = (z) => z < (HZ0 + HZ1) / 2 ? ST.zN : ST.zS;   // [first, step] for the streets running east-west
  const streetDist = (x, z) => {
    const [z0, zs] = zLines(z), dz = Math.abs(((z - z0) % zs + zs * 1.5) % zs - zs / 2);
    let dx;
    if (x > W[2]) dx = Math.abs(((x - ST.xE[0]) % ST.xE[1] + ST.xE[1] * 1.5) % ST.xE[1] - ST.xE[1] / 2);
    else if (x < W[0]) dx = Math.abs(((x - ST.xW[0]) % ST.xW[1] + ST.xW[1] * 1.5) % ST.xW[1] - ST.xW[1] / 2);
    else dx = Math.min(...ST.x.map((s) => Math.abs(x - s)));
    return Math.min(dx, dz);
  };
  const LAYOUT = `
const vec3 BD_WATER = ${V3(lin(L.water))};
const vec4 BD_WORLD = vec4(${W.map(F).join(', ')});
${WOB}
// how far a point is from the middle of the nearest street
float bdStreet(vec2 p) {
  vec2 zl = p.y < ${F((HZ0 + HZ1) / 2)} ? vec2(${F(ST.zN[0])}, ${F(ST.zN[1])}) : vec2(${F(ST.zS[0])}, ${F(ST.zS[1])});
  float dz = abs(mod(p.y - zl.x + zl.y * 0.5, zl.y) - zl.y * 0.5), dx;
  if (p.x > BD_WORLD.z) dx = abs(mod(p.x - ${F(ST.xE[0])} + ${F(ST.xE[1] / 2)}, ${F(ST.xE[1])}) - ${F(ST.xE[1] / 2)});
  else if (p.x < BD_WORLD.x) dx = abs(mod(p.x - ${F(ST.xW[0])} + ${F(ST.xW[1] / 2)}, ${F(ST.xW[1])}) - ${F(ST.xW[1] / 2)});
  else dx = min(min(min(abs(p.x - ${F(ST.x[0])}), abs(p.x - ${F(ST.x[1])})), min(abs(p.x - ${F(ST.x[2])}), abs(p.x - ${F(ST.x[3])}))), abs(p.x - ${F(ST.x[4])}));
  return min(dx, dz);
}
vec3 bdPlainLight(vec3 w) { return vec3(0.0); }
`;

  // ---- the ground: a plane out past the camera's reach, with the map cut out of it --------------------------------
  // (the hole a voxel inside the map's edge all round, so the two overlap rather than leave a crack)
  let geo;
  {
    const R = 3400, mx = (W[0] + W[2]) / 2, mz = (W[1] + W[3]) / 2, hx = (W[2] - W[0]) / 2 - 1, hz = (W[3] - W[1]) / 2 - 1;
    const shape = new THREE.Shape([new THREE.Vector2(-R, -R), new THREE.Vector2(R, -R), new THREE.Vector2(R, R), new THREE.Vector2(-R, R)]);
    const hole = new THREE.Path([new THREE.Vector2(-hx, -hz), new THREE.Vector2(-hx, hz), new THREE.Vector2(hx, hz), new THREE.Vector2(hx, -hz)]);
    shape.holes.push(hole);
    geo = flatGround(shape, mx, mz);
  }

  // ---- the blocks and their towers ------------------------------------------------------------------------------
  // Every block between the streets that is on land, clear of the map and inside REACH: one tower, two or four. The
  // downtowns stand taller: across the Hudson facing the tip, and in Brooklyn across the East River.
  const DOWN = L.downtowns;
  // (and clear of the bridges, their approaches and the elevated roads)
  const onBridge = (x, z, r) => [...L.bridges, ...L.expressways].some((B) => {
    const [ax, az] = B.a, [bx, bz] = B.b, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    const s = (x - ax) * ux + (z - az) * uz, o = Math.abs((x - ax) * -uz + (z - az) * ux);
    return s > -190 - r && s < len + 190 + r && o < B.w / 2 + 16 + r;
  });
  const lift = (x, z) => DOWN.reduce((m, d) => Math.max(m, 1 + (d.k - 1) * clamp(1 - Math.hypot(x - d.x, z - d.z) / d.r, 0, 1) ** 1.5), 1);
  const blocks = [];
  {
    const lines = (a0, step, lo, hi) => { const out = []; for (let v = a0 + Math.ceil((lo - a0) / step) * step; v <= hi; v += step) out.push(v); return out; };
    const X = [...lines(ST.xW[0], ST.xW[1], -2400, W[0] - 1), ...ST.x, ...lines(ST.xE[0], ST.xE[1], W[2] + 1, 3200)];
    const ZN = lines(ST.zN[0], ST.zN[1], -2400, HZ0), ZS = lines(ST.zS[0], ST.zS[1], HZ1, 3200);
    const half = ST.w / 2 + 5;
    for (const Z of [ZN, ZS]) for (let j = 0; j + 1 < Z.length; j++) for (let i = 0; i + 1 < X.length; i++) {
      const x0 = X[i] + half, x1 = X[i + 1] - half, z0 = Z[j] + half, z1 = Z[j + 1] - half;
      if (x1 - x0 < 30 || z1 - z0 < 30) continue;
      // past the map's edge, and on land all over (the corners and the middle a little in from the shore)
      const pts4 = [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]];
      if (pts4.some(([x, z]) => land(x, z) < 10 || far(x, z) > REACH)) continue;
      if (x1 > W[0] - 12 && x0 < W[2] + 12 && z1 > W[1] - 12 && z0 < W[3] + 12) continue;
      if (onBridge((x0 + x1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0) / 2)) continue;
      blocks.push({ x0, x1, z0, z1, mx: (x0 + x1) / 2, mz: (z0 + z1) / 2 });
    }
  }
  // the landmarks, one in each downtown that has one, on the block nearest its middle
  const marks = new Map();
  for (const d of DOWN) if (d.mark !== undefined) {
    let best = null, bd = 1e9;
    for (const b of blocks) { const dd = Math.hypot(b.mx - d.x, b.mz - d.z); if (dd < bd && !marks.has(b)) { bd = dd; best = b; } }
    if (best) marks.set(best, d.mark);
  }
  for (const b of blocks) {
    const w = b.x1 - b.x0, dd = b.z1 - b.z0, dn = near(b.mx, b.mz), k = lift(b.mx, b.mz);
    if (marks.has(b)) { landmark(marks.get(b), b.mx, b.mz, Math.min(1, Math.min(w, dd) / 165), 24 + dn * Math.tan(12 * DEG)); continue; }
    const low = b.mz > IS.z - 40 && b.mx < IS.x + 60;   // the island: houses and yards
    const top = 2.5 + 5.5 * clamp((dn - 250) / 900, 0, 1);
    const H = (f) => clamp((24 + dn * Math.tan(Math.min(12.5, (low ? 1.2 : 1) * (2 + top * rand() ** 1.2 * k)) * DEG)) * f * (low ? 0.4 : 1), 34, 520);
    const r = rand();
    if (low) {
      // houses in rows, with gaps
      for (let a = b.x0 + 12; a < b.x1 - 10; a += 26) for (const s of [-1, 1]) { if (rand() < 0.25) continue; add(2, a, 0, b.mz + s * dd / 4, 18 + rand() * 6, 14 + rand() * 12, dd / 2 - 12, 0, 1, pick(HOMES), 0.1 + rand() * 0.2); }
    } else if (r < 0.35) tower(b.mx, b.mz, w * (0.6 + rand() * 0.3), dd * (0.6 + rand() * 0.3), H(1.1), rand() < 0.7);
    else if (r < 0.7) {   // two, side by side
      const alongX = w > dd ? rand() < 0.8 : rand() < 0.2;
      for (const s of [-1, 1]) {
        const tx = alongX ? b.mx + s * w / 4 : b.mx, tz = alongX ? b.mz : b.mz + s * dd / 4;
        tower(tx, tz, (alongX ? w / 2 : w) * (0.7 + rand() * 0.2), (alongX ? dd : dd / 2) * (0.7 + rand() * 0.2), H(0.95), rand() < 0.5);
      }
    } else for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {   // four smaller
      if (rand() < 0.15) continue;
      tower(b.mx + sx * w / 4, b.mz + sz * dd / 4, w / 2 * (0.65 + rand() * 0.25), dd / 2 * (0.65 + rand() * 0.25), H(0.75), rand() < 0.35);
    }
  }

  // ---- the bridges ----------------------------------------------------------------------------------------------
  // A box along a run from a to b (in the plan, at heights ya and yb), `w` wide and `t` thick: its yaw along the run,
  // tipped up or down by the rise (the box's roll, about its crosswise axis, since its length is along x).
  const STEEL = lin(L.steel || 0x6d7a78), CONC = lin(0x8a8780), DECK = lin(0x55585b);
  const strut = (grp, ax, ay, az, bx, by, bz, w, t, col, kind = 2) => {
    const dx = bx - ax, dz = bz - az, run = Math.hypot(dx, dz), len = Math.hypot(run, by - ay);
    add(grp, (ax + bx) / 2, (ay + by) / 2 - t / 2, (az + bz) / 2, len, t, w, Math.atan2(-dz, dx), kind, col, 0, 0, Math.atan2(by - ay, run));
  };
  // a run's lanes of traffic, each way, fading in and out at the ends (it carries on off the bridge)
  const lanes = (ax, az, bx, bz, y, offs, v) => {
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, rx = -uz, rz = ux;
    for (const off of offs) for (const dir of [1, -1]) {
      const ox = rx * off * dir, oz = rz * off * dir, n = Math.max(2, Math.round(len / (34 + rand() * 16)));
      const a = dir > 0 ? [ax + ox, az + oz] : [bx + ox, bz + oz], b = dir > 0 ? [bx + ox, bz + oz] : [ax + ox, az + oz];
      const sp = v * (0.85 + rand() * 0.3) / len;
      for (let k = 0; k < n; k++) pt(pts.road, a[0], y, a[1], 5, 3, [1, 1, 1], (k + rand() * 0.7) / n, sp, b[0], y, b[1]);
    }
  };
  for (const B of L.bridges) {
    const [ax, az] = B.a, [bx, bz] = B.b, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, rx = -uz, rz = ux;
    const at = (s) => [ax + ux * s, az + uz * s], Y = B.y, hw = B.w / 2;
    // the deck, its edges and the approaches stepping down to the ground at each end
    strut(0, ax, Y, az, bx, Y, bz, B.w, 6, DECK);
    for (const e of [-1, 1]) strut(1, ax + rx * e * (hw - 1), Y + 2.4, az + rz * e * (hw - 1), bx + rx * e * (hw - 1), Y + 2.4, bz + rz * e * (hw - 1), 1.2, 2.4, CONC);
    for (const [s, dir] of [[0, -1], [len, 1]]) {
      const [ex, ez] = at(s);
      for (let k = 0; k < 4; k++) { const y = Y * (1 - (k + 1) / 5); strut(0, ex + ux * dir * k * 40, y, ez + uz * dir * k * 40, ex + ux * dir * (k + 1) * 40, y, ez + uz * dir * (k + 1) * 40, B.w, 5, DECK); add(0, ex + ux * dir * (k * 40 + 20), 0, ez + uz * dir * (k * 40 + 20), 10, Math.max(1, y - 5), B.w - 14, Math.atan2(-uz, ux), 2, CONC); }
    }
    // lamps down both edges, and the traffic
    for (let s = 20; s < len; s += 44) for (const e of [-1, 1]) { const [x, z] = at(s); pt(pts.lamp, x + rx * e * (hw - 2), Y + 9, z + rz * e * (hw - 2), 6, 0, SODIUM); }
    lanes(ax - ux * 160, az - uz * 160, bx + ux * 160, bz + uz * 160, Y + 2.2, [6, 15], 95);
    if (B.kind === 'suspension') {
      // two towers, each two legs with beams across; two main cables hung between their tops and back to the
      // anchorages at the ends, hangers down to the deck, and lamps strung along the cables
      const H = B.h, [s0, s1] = B.towers, sag = B.sag ?? Y + 8;
      for (const s of [s0, s1]) {
        const [x, z] = at(s);
        for (const e of [-1, 1]) add(0, x + rx * e * (hw + 4), 0, z + rz * e * (hw + 4), 8, H, 8, Math.atan2(-uz, ux), 2, STEEL);
        for (const y of [Y - 10, H * 0.62, H - 7]) add(0, x, y, z, 6, 7, B.w + 16, Math.atan2(-uz, ux), 2, STEEL);
        blink(x + rx * (hw + 4), H + 1.5, z + rz * (hw + 4)); blink(x - rx * (hw + 4), H + 1.5, z - rz * (hw + 4));
      }
      const cable = (s) => {
        // the cable's height along the bridge: a sag between the towers, straight runs down to the ends
        if (s < s0) return Y + 6 + (H - Y - 6) * (s / s0);
        if (s > s1) return Y + 6 + (H - Y - 6) * ((len - s) / (len - s1));
        const u = (s - s0) / (s1 - s0) * 2 - 1; return sag + (H - sag) * u * u;
      };
      for (const e of [-1, 1]) {
        const ox = rx * e * (hw + 4), oz = rz * e * (hw + 4);
        const seg = (s, t) => { const [x0, z0] = at(s), [x1, z1] = at(t); strut(0, x0 + ox, cable(s) + 0.8, z0 + oz, x1 + ox, cable(t) + 0.8, z1 + oz, 1.6, 1.6, STEEL); };
        for (let k = 0; k < 4; k++) seg(s0 * k / 4, s0 * (k + 1) / 4);
        for (let k = 0; k < 4; k++) seg(s1 + (len - s1) * k / 4, s1 + (len - s1) * (k + 1) / 4);
        for (let k = 0; k < 18; k++) seg(s0 + (s1 - s0) * k / 18, s0 + (s1 - s0) * (k + 1) / 18);
        for (let s = s0 + 22; s < s1 - 10; s += 22) { const [x, z] = at(s); add(1, x + ox, Y, z + oz, 0.7, cable(s) - Y, 0.7, 0, 2, STEEL); }
        for (let s = 6; s < len; s += 14) { const [x, z] = at(s); pt(pts.lamp, x + ox, cable(s) + 2, z + oz, 4.5, 0, [1, 0.92, 0.74]); }
      }
      // the anchorages at each end
      for (const s of [0, len]) { const [x, z] = at(s); add(0, x, 0, z, 36, Y + 14, B.w + 24, Math.atan2(-uz, ux), 2, CONC); }
    } else {
      // cable-stayed: one pylon, two legs leaning in to meet over the deck, and two fans of stays to each side
      const [px, pz] = at(B.pylon), H = B.h, yaw = Math.atan2(ux, uz), lean = Math.atan2(hw + 10, H * 0.82);
      for (const e of [-1, 1]) add(0, px + rx * e * (hw + 10), 0, pz + rz * e * (hw + 10), 9, H * 0.82 / Math.cos(lean), 9, yaw, 2, CONC, 0, 0, -e * lean);
      add(0, px, H * 0.8, pz, 11, H * 0.2, 11, 0, 2, CONC);
      add(0, px, Y - 10, pz, 8, 6, B.w + 30, Math.atan2(-uz, ux), 2, CONC);
      blink(px, H + 1.5, pz);
      for (const side of [-1, 1]) for (let k = 1; k <= 9; k++) {
        const s = B.pylon + side * k * (side < 0 ? B.pylon : len - B.pylon) / 9.6, [x, z] = at(s), y = H * (0.82 + 0.018 * k);
        for (const e of [-1, 1]) {
          const ox = rx * e * (hw - 3), oz = rz * e * (hw - 3), tx = rx * e * 3, tz = rz * e * 3;
          strut(0, x + ox, Y + 1, z + oz, px + tx, y, pz + tz, 0.9, 0.9, lin(0xd9d6cf));
          pt(pts.lamp, x + ox, Y + 6, z + oz, 5, 0, [0.85, 0.92, 1]);
        }
      }
      pt(pts.lamp, px, H * 0.9, pz, 14, 0, [0.85, 0.92, 1]);
    }
  }

  // ---- the elevated roads: a deck on piers across the far end of a view, lamps down the middle, three lanes each way
  for (const E of L.expressways) {
    const [ax, az] = E.a, [bx, bz] = E.b, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, rx = -uz, rz = ux;
    const yaw = Math.atan2(-uz, ux), Y = E.y, n = Math.max(1, Math.round(len / 110));
    for (let k = 0; k < n; k++) {
      const s0 = len * k / n, s1 = len * (k + 1) / n, mx = ax + ux * (s0 + s1) / 2, mz = az + uz * (s0 + s1) / 2;
      add(0, mx, Y - 6, mz, s1 - s0 + 2, 6, E.w, yaw, 2, CONC);
      for (const e of [-1, 1]) add(1, mx + rx * e * (E.w / 2 - 0.6), Y, mz + rz * e * (E.w / 2 - 0.6), s1 - s0 + 2, 2.2, 1.2, yaw, 2, CONC);
      add(0, ax + ux * s0, 0, az + uz * s0, 10, Y - 10, E.w - 16, yaw, 2, CONC);
      if (k % 2 === 0) { add(1, mx, Y, mz, 1.6, 30, 1.6, 0, 2, POLE); for (const e of [-1, 1]) pt(pts.lamp, mx + rx * e * 11, Y + 29.4, mz + rz * e * 11, 9, 0, SODIUM); }
    }
    lanes(ax, az, bx, bz, Y + 2.2, [6, 15, 24], 105);
  }

  // ---- the harbor: cranes and stacked containers along the island's shore, and ships at anchor ------------------------
  {
    const Q = L.port, BOXES = [0xa8402a, 0x2f5d8a, 0x2c6b3f, 0xb8862b, 0x6c6f73, 0x8c2f2a].map(lin);
    for (let k = 0; k < Q.cranes; k++) {
      const x = Q.x0 + (Q.x1 - Q.x0) * (k + 0.5) / Q.cranes, z = Q.z, C = lin(k % 2 ? 0xc2452d : 0x2d5f9a);
      for (const s of [-1, 1]) add(3, x + s * 12, 0, z, 3, 52, 3, 0, 2, C);
      add(3, x, 52, z - 30, 6, 5, 110, 0, 2, C); add(3, x, 57, z + 4, 3, 18, 3, 0, 2, C);
      blink(x, 76, z + 4);
      pt(pts.lamp, x, 50, z - 70, 7, 0, LAMP);
    }
    for (let k = 0; k < Q.stacks; k++) {
      const x = Q.x0 + rand() * (Q.x1 - Q.x0), z = Q.z + 30 + rand() * 60;
      for (let h = 0; h < 1 + Math.floor(rand() * 3); h++) add(3, x, h * 7, z, 30, 6.6, 7.5, 0, 2, pick(BOXES));
    }
    for (const S of L.ships) {
      const yaw = S.yaw, cx = Math.cos(yaw), sz = -Math.sin(yaw);
      add(0, S.x, 0, S.z, S.len, 12, S.len * 0.15, yaw, 2, lin(S.hull));
      add(0, S.x - cx * S.len * 0.38, 12, S.z - sz * S.len * 0.38, S.len * 0.14, 22, S.len * 0.13, yaw, 1, lin(0xe4e0d6), 0.6);
      for (let s = -0.45; s <= 0.45; s += 0.15) pt(pts.lamp, S.x + cx * S.len * s, 14, S.z + sz * S.len * s, 5, 0, LAMP);
      blink(S.x - cx * S.len * 0.38, 38, S.z - sz * S.len * 0.38);
    }
  }

  // ---- traffic out along the streets that leave the map, and along the far bank -----------------------------------
  {
    const ave = (ax, az, bx, bz) => {
      let len = Math.hypot(bx - ax, bz - az);
      const ux = (bx - ax) / len, uz = (bz - az) / len, rx = -uz, rz = ux;
      // (as far as the street is on land: no traffic over the water)
      if (land(ax, az) < 4) return;
      for (let s = 0; s <= len; s += 20) if (land(ax + ux * s, az + uz * s) < 4) { len = s - 20; bx = ax + ux * len; bz = az + uz * len; break; }
      if (len < 120) return;
      for (const off of [4.5, 11]) for (const dir of [1, -1]) {
        const a = dir > 0 ? [ax, az] : [bx, bz], b = dir > 0 ? [bx, bz] : [ax, az], n = Math.max(2, Math.round(len / 52));
        for (let k = 0; k < n; k++) pt(pts.ave, a[0] + rx * off * dir, 2.6, a[1] + rz * off * dir, 4.5, 3, [1, 1, 1], (k + rand() * 0.8) / n, 46 * (0.8 + rand() * 0.4) / len, b[0] + rx * off * dir, 2.6, b[1] + rz * off * dir);
        // street lamps along it
        if (dir > 0 && off < 5) for (let s = 30; s < len; s += 60) for (const e of [-1, 1]) pt(pts.lamp, ax + ux * s + rx * e * 16, 22, az + uz * s + rz * e * 16, 5, 0, SODIUM);
      }
    };
    const out = L.traffic;
    for (const z of out.east) ave(W[2] + 14, z, W[2] + out.length, z);
    for (const x of out.north) ave(x, W[1] - 14, x, W[1] - out.length);
    for (const z of out.south || []) ave(W[2] + 14, z, W[2] + out.length, z);
    const fz = out.bank;   // the road along the far bank of the Hudson
    for (let z = fz[0]; z < fz[1]; z += 300) ave(SH.jersey - 60 + wob(z) * 0.5, z, SH.jersey - 60 + wob(z + 300) * 0.5, z + 300);
  }

  // the skyline: lower over the water to the south, highest over Brooklyn and Queens and across the Hudson
  const SKY = L.skyline;
  const scale = (u) => { const n = SKY.length - 1, t = u * n, i = Math.min(n - 1, Math.floor(t)), f = t - i, s = f * f * (3 - 2 * f); return SKY[i] + (SKY[i + 1] - SKY[i]) * s; };

  return {
    layout: LAYOUT,
    // The windows come on with the dusk: by the race's sunset about half of those that will be lit at night already
    // are, not as bright yet.
    defs: '#define BD_SHARE (0.25 + 0.75 * smoothstep(0.15, 0.9, bdNight))\n#define BD_BRIGHT min(1.0, bdNight * 1.8)\n',
    ground: { geo, fn: GROUND_FN, main: GROUND_MAIN, glow: 'bdAlb * bdLight * min(1.0, bdNight * 1.6)', cap: 1.0, keep: 0.5 },
    nearD: 900,
    craft: { heli: L.heli },
    skyline: { R: 2340, top: 380, rep: 1, scale, body: [0.8, 0.45] },
    counts: { blocks: blocks.length },
  };
}

// The ground's paint: the water (the map's own blue, with the ripple of its painted water, darker along the shores), a
// concrete edge along the shore, and the land past it in streets and blocks, the streets lit by their lamps at night.
const GROUND_FN = `
vec3 bdGround(vec2 p, vec2 fw, out vec3 light) {
  float big = bdN(p * 0.017), mid = bdN(p * 0.11 + 7.0);
  float grain = bdDetail > 0.5 ? mix(bdH(floor(p * 1.5)), 0.5, clamp(max(fw.x, fw.y) * 1.2 - 0.4, 0.0, 1.0)) : 0.5;
  float d = bdLand(p);
  light = vec3(0.0);
  if (d < 0.0) {
    // the water: short streaks across the current, like the map's own, fading out with distance; darker by the shore
    float streak = bdN(vec2(p.x * 0.35, p.y * 2.2)) * bdN(vec2(p.x * 0.07 + 3.0, p.y * 0.6));
    vec3 col = BD_WATER * (0.94 + 0.16 * mix(streak, 0.25, clamp(max(fw.x, fw.y) * 2.0 - 0.5, 0.0, 1.0)) - 0.06 * big);
    return mix(col, col * 0.62, smoothstep(-6.0, -2.5, d));
  }
  if (d < 5.0) return vec3(0.42, 0.4, 0.37) * (0.85 + 0.2 * grain);
  float st = bdStreet(p);
  vec3 tar = vec3(0.06, 0.064, 0.07) * (0.8 + 0.3 * big) * (0.88 + 0.24 * grain);
  vec3 walk = vec3(0.44, 0.42, 0.38) * (0.85 + 0.2 * grain);
  vec3 lot = mix(vec3(0.16, 0.155, 0.145), vec3(0.06, 0.09, 0.05), step(0.62, big)) * (0.75 + 0.4 * mid) * (0.9 + 0.2 * grain);
  if (st < 18.0) {
    // a street: lamps along both kerbs every 60
    float lq = mod(p.x + p.y, 60.0) - 30.0; float lamp = exp(-lq * lq * 0.004);
    light = ${V3(SODIUM)} * (0.25 + 0.45 * lamp) * smoothstep(18.0, 10.0, st);
    return tar;
  }
  return st < 22.0 ? walk : lot;
}
`;
const GROUND_MAIN = `
vec2 bdP = vBdW.xz; vec2 bdFw = max(fwidth(bdP), vec2(1e-3));
vec3 bdLight; vec3 bdAlb = bdGround(bdP, bdFw, bdLight);
`;
