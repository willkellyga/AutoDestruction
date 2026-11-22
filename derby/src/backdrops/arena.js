// Hammerdown Arena's backdrop: the parking lot the stadium stands in (painted bays, lamp posts with pools of light under
// them, rows of parked cars), the avenues out of the lot to the east and west, an elevated road round it all with its
// traffic, the city's towers beyond that and the show's blimp going round overhead. maps/arena.js lays it out.
//   - None of it stands where the stadium does: the lot starts past the concrete apron round the stadium, which
//     everything arena.js builds stands inside.
//   - The ground is one plane with a hole where the pit is, its paint and lamplight worked out from where each pixel is.
import * as THREE from 'three';
import { F, V3, TAU, DEG, lin, clamp, sdBox, loopPath, LAMP, SODIUM, POLE, OFFICE, HOMES } from './kit.js';

// The lot, in voxels (a quarter of a metre): bays ten wide and twenty deep, two rows nose to nose with a strip between
// them that the lamps stand on, then an aisle 28 wide: 68 for a pair of rows. A cross aisle 40 wide every 240, and a
// lamp every 120 along each strip. The lot is the same in each quarter, mirrored through the middle, so the bays and
// lamps are found from the distance to the middle on each axis (here and in the shaders alike): the strips are at 34 +
// 68k from it and the lamps at 60 + 120k along them, both of which come out the same mirrored. (The apron and the drive
// round it in arena.js are sized so the first aisle meets the drive.)
const ROW = 68, ROW0 = 14, XA = 240, XAW = 40, LAMP_X = 120, LAMP_X0 = 60, LAMP_H = 40, POOL = 34;
// The avenues east and west out of the lot: road out to 26 from the middle line, pavement to 34, a verge to 54. Street
// lamps every 60 along each side, their heads over the road at 24.
const AVE = 54, AVE_LAMP = 30, AVE_HEAD = 24, AVE_STEP = 60, AVE_POOL = 30;
// The city's streets: every 260 from the middle, 44 wide.
const BLOCK = 260, STREET = 22;

export function arena(kit) {
  const { L, rand, pick, add, pt, pts, blink, tower, LANDMARKS } = kit;
  const CX = L.x, CZ = L.z, A = L.apron, LOT = L.lot, HW = L.highway, DR = L.drive, REACH = L.city;
  const AVE_END = L.avenueEnd;
  const LAYOUT = `
const vec2 BD_C = vec2(${F(CX)}, ${F(CZ)});
const vec3 BD_APRON = vec3(${F(A.hx)}, ${F(A.hz)}, ${F(A.r)});
const vec3 BD_LOT = vec3(${F(LOT.hx)}, ${F(LOT.hz)}, ${F(LOT.r)});
const vec3 BD_HWY = vec3(${F(HW.hx)}, ${F(HW.hz)}, ${F(HW.r)});
const float BD_DRIVE = ${F(DR)}; const float BD_AVE = ${F(AVE)}; const float BD_AVE_END = ${F(AVE_END)};
bool bdLampAt(vec2 a) { return bdBox(a, BD_APRON) > BD_DRIVE + 6.0 && bdBox(a, BD_LOT) < -6.0 && !(a.y < BD_AVE && a.x > BD_APRON.x); }
// the light from the lot's lamps at a point (folded into one quarter): the four nearest lamps, two along the strip
// either side and the strips either side
float bdLotLight(vec2 a) {
  float x0 = floor((a.x - ${F(LAMP_X0)}) / ${F(LAMP_X)}) * ${F(LAMP_X)} + ${F(LAMP_X0)}, z0 = floor((a.y - 34.0) / ${F(ROW)}) * ${F(ROW)} + 34.0, s = 0.0;
  for (int i = 0; i < 2; i++) for (int j = 0; j < 2; j++) {
    vec2 q = vec2(x0 + float(i) * ${F(LAMP_X)}, z0 + float(j) * ${F(ROW)});
    if (bdLampAt(abs(q))) { vec2 d = a - q; s += exp(-dot(d, d) * ${F(1 / (POOL * POOL))}); }
  }
  return s;
}
// and from the avenues' street lamps
float bdAveLight(vec2 a) {
  if (a.y > 90.0 || a.x < BD_APRON.x + BD_DRIVE) return 0.0;
  float x0 = floor((a.x - 30.0) / ${F(AVE_STEP)}) * ${F(AVE_STEP)} + 30.0, s = 0.0;
  for (int i = 0; i < 2; i++) {
    float x = x0 + float(i) * ${F(AVE_STEP)};
    if (x < BD_APRON.x + BD_DRIVE + 10.0 || x > BD_AVE_END) continue;
    vec2 d = vec2(a.x - x, a.y - ${F(AVE_HEAD)}); s += exp(-dot(d, d) * ${F(1 / (AVE_POOL * AVE_POOL))});
  }
  return s;
}
// the lamplight on a plain box (the parked cars and lamp posts): the lot's lamps, near the ground
vec3 bdPlainLight(vec3 w) { return w.y < 50.0 ? ${V3(LAMP)} * 1.0 * bdLotLight(abs(w.xz - BD_C)) : vec3(0.0); }
`;
  const lampAt = (ax, az) => sdBox(ax, az, A) > DR + 6 && sdBox(ax, az, LOT) < -6 && !(az < AVE && ax > A.hx);
  const inLot = (ax, az) => sdBox(ax, az, A) > DR + 1 && sdBox(ax, az, LOT) < -1 && !(az < AVE && ax > A.hx);

  // ---- the ground: a plane out to where the plain land used to reach, with the pit cut out of it -------------------
  // The hole is a little inside the line of the ring wall's outside, under its voxels, so no seam shows; the arena's
  // own floor goes on under the lot everywhere else and the lot is drawn a hair above it.
  let geo;
  {
    const H = L.hole, ix = H.hx - H.r, iz = H.hz - H.r, R = 3200;
    const shape = new THREE.Shape([new THREE.Vector2(-R, -R), new THREE.Vector2(R, -R), new THREE.Vector2(R, R), new THREE.Vector2(-R, R)]);
    const hole = new THREE.Path();
    hole.moveTo(ix + H.r, -iz);
    hole.absarc(ix, iz, H.r, 0, Math.PI / 2, false); hole.absarc(-ix, iz, H.r, Math.PI / 2, Math.PI, false);
    hole.absarc(-ix, -iz, H.r, Math.PI, Math.PI * 1.5, false); hole.absarc(ix, -iz, H.r, Math.PI * 1.5, TAU, false);
    shape.holes.push(hole);
    geo = flatGround(shape, CX, CZ);
  }

  // ---- the lamp posts --------------------------------------------------------------------------------------------
  // the lot's: a pole and a double head
  const HEAD = LAMP.map((v) => v * 0.9);
  const lotLamps = [];
  for (let ax = LAMP_X0; ax < LOT.hx; ax += LAMP_X) for (let az = 34; az < LOT.hz; az += ROW) {
    if (!lampAt(ax, az)) continue;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) lotLamps.push([CX + sx * ax, CZ + sz * az]);
  }
  for (const [x, z] of lotLamps) {
    add(0, x, 0, z, 1.3, LAMP_H, 1.3, 0, 2, POLE);
    add(0, x, LAMP_H, z, 15, 1.4, 2.6, 0, 3, HEAD);
    for (const s of [-6, 6]) pt(pts.lamp, x + s, LAMP_H - 0.6, z, 10, 0, LAMP);
  }
  // the avenues' street lamps: a pole on the pavement and an arm out over the road
  for (const side of [-1, 1]) for (let ax = 30; ax <= AVE_END; ax += AVE_STEP) {
    if (ax < A.hx + DR + 10) continue;
    for (const sz of [-1, 1]) {
      const x = CX + side * ax, zp = CZ + sz * AVE_LAMP, zh = CZ + sz * AVE_HEAD;
      add(0, x, 0, zp, 1.1, 32, 1.1, 0, 2, POLE);
      add(0, x, 31, (zp + zh) / 2, 0.9, 0.9, AVE_LAMP - AVE_HEAD + 1, 0, 2, POLE);
      add(0, x, 30.4, zh, 2.2, 0.8, 3.2, 0, 3, SODIUM.map((v) => v * 0.9));
      pt(pts.lamp, x, 30, zh, 8, 0, SODIUM);
    }
  }

  // ---- the elevated road round the lot --------------------------------------------------------------------------
  // A deck 90 wide on piers, three lanes each way, sodium lamps on masts down the middle. The traffic runs each piece of
  // deck from end to end: every piece is as busy as the next, so the stream looks unbroken round the bends.
  {
    const path = loopPath(HW, 110), Y = HW.y, CONC = lin(0x8a8780), LANES = [[9, 120], [22, 105], [35, 92]];
    const head = SODIUM.map((v) => v * 0.9);
    path.forEach(([x0, z0], i) => {
      const [x1, z1] = path[(i + 1) % path.length], dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
      const yaw = Math.atan2(-uz, ux), mx = CX + (x0 + x1) / 2, mz = CZ + (z0 + z1) / 2, rx = -uz, rz = ux;   // (rx, rz: to the right)
      add(0, mx, Y - 7, mz, len + 3, 7, HW.w, yaw, 2, CONC);                                 // the deck
      add(0, mx + rx * (HW.w / 2 - 0.5), Y, mz + rz * (HW.w / 2 - 0.5), len + 3, 2.2, 1.2, yaw, 2, CONC);   // its low walls
      add(0, mx - rx * (HW.w / 2 - 0.5), Y, mz - rz * (HW.w / 2 - 0.5), len + 3, 2.2, 1.2, yaw, 2, CONC);
      add(0, CX + x0, 0, CZ + z0, 12, Y - 12, 24, yaw, 2, CONC);                             // a pier, and its cap
      add(0, CX + x0, Y - 12, CZ + z0, 12, 5, HW.w - 10, yaw, 2, CONC);
      if (i % 2 === 0) {   // a mast down the middle with a head each way
        add(0, mx, Y, mz, 1.6, 36, 1.6, yaw, 2, POLE);
        add(0, mx, Y + 36, mz, 2.4, 1.4, 30, yaw, 3, head);
        for (const s of [-13, 13]) pt(pts.lamp, mx + rx * s, Y + 35.4, mz + rz * s, 11, 0, SODIUM);
      }
      for (const [off, v] of LANES) for (const dir of [1, -1]) {
        // right-hand traffic: the lanes right of the path's way go along it, the left ones back
        const ox = rx * off * dir, oz = rz * off * dir, n = Math.max(1, Math.round(len / (32 + rand() * 18)));
        const a = dir > 0 ? [CX + x0 + ox, Y + 3, CZ + z0 + oz] : [CX + x1 + ox, Y + 3, CZ + z1 + oz];
        const b = dir > 0 ? [CX + x1 + ox, Y + 3, CZ + z1 + oz] : [CX + x0 + ox, Y + 3, CZ + z0 + oz];
        const sp = (v * (0.9 + rand() * 0.2)) / len;
        for (let k = 0; k < n; k++) pt(pts.road, a[0], a[1], a[2], 5, 2, [1, 1, 1], (k + rand() * 0.7) / n, sp, b[0], b[1], b[2]);
      }
    });
  }
  // the avenues' traffic: two lanes each way, fading in where the avenue leaves the lot's drive and out at the far end
  for (const side of [-1, 1]) for (const [off, v] of [[6, 58], [18, 48]]) for (const dir of [1, -1]) {
    const x0 = CX + side * (A.hx + DR), x1 = CX + side * AVE_END, z = CZ + side * dir * off, len = Math.abs(x1 - x0);
    const [ax, bx] = dir > 0 ? [x0, x1] : [x1, x0], n = Math.round(len / 46);
    for (let k = 0; k < n; k++) pt(pts.ave, ax, 2.6, z, 5, 3, [1, 1, 1], (k + rand() * 0.8) / n, v * (0.9 + rand() * 0.2) / len, bx, 2.6, z);
  }

  // ---- the city -----------------------------------------------------------------------------------------------
  // Blocks between streets every 260, from past the elevated road out to REACH from the middle (so the far side of the
  // furthest tower is still nearer than the camera's far edge, wherever it is in the pit). A tower's height is set by
  // how high its top stands from the middle of the pit: from 3 degrees up to 6.5 on the nearest blocks and 12 on the
  // furthest (over the stands, which stand about 8, and under the top of the chase camera's picture, about 14, so there
  // is sky over most of them), a little higher in two downtowns, one beyond each end. So the skyline rises away from
  // the arena, in layers, and only the landmarks reach the top of the picture.
  const DT = [-0.25, Math.PI - 0.45];
  const cluster = (ang) => 0.72 + 0.42 * Math.max(0, Math.cos(ang - DT[0])) ** 3 + 0.36 * Math.max(0, Math.cos(ang - DT[1])) ** 4;
  {
    const HWO = HW.w / 2 + 34, blocks = [];
    for (let i = -8; i < 8; i++) for (let j = -8; j < 8; j++) {
      const bx = (i + 0.5) * BLOCK, bz = (j + 0.5) * BLOCK, h = BLOCK / 2 - STREET - 5;
      let x0 = bx - h, x1 = bx + h, z0 = bz - h, z1 = bz + h;
      const corners = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]];
      if (corners.some(([x, z]) => sdBox(Math.abs(x), Math.abs(z), HW) < HWO)) continue;
      if (corners.some(([x, z]) => Math.hypot(x, z) > REACH)) continue;
      if (Math.abs(bz) < BLOCK) { if (bz > 0) z0 = Math.max(z0, AVE + 4); else z1 = Math.min(z1, -AVE - 4); }   // clear of the avenues
      blocks.push({ x0, x1, z0, z1, d: Math.hypot(bx, bz), a: Math.atan2(bz, bx) });
    }
    // the landmarks' blocks: far out, spread round
    const marks = new Map();
    [-0.3, 2.65, -1.95, 1.2, -2.7, 0.62].forEach((ang, k) => {
      let best = null, bd = 9;
      for (const b of blocks) { if (b.d < 1480 || b.d > 1760 || marks.has(b)) continue; const da = Math.abs(Math.atan2(Math.sin(b.a - ang), Math.cos(b.a - ang))); if (da < bd) { bd = da; best = b; } }
      if (best) marks.set(best, k);
    });
    for (const b of blocks) {
      const mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2, w = b.x1 - b.x0, dd = b.z1 - b.z0;
      if (marks.has(b)) {
        const v = clamp((24 + b.d * Math.tan(13.5 * DEG)) / 480, 0.7, 1);   // (the designs are about 480 to the tip)
        const addV = (g, x, y, z, sx, sy, sz, ...o) => add(g, x, y * v, z, sx, sy * v, sz, ...o), blinkV = (x, y, z) => blink(x, y * v, z);
        LANDMARKS[marks.get(b)](CX + mx, CZ + mz, Math.min(1, Math.min(w, dd) / 165), addV, blinkV); continue;
      }
      const cl = cluster(b.a), r = rand(), top = 3.5 + 5.5 * clamp((b.d - 1150) / 600, 0, 1);
      const H = (k) => clamp((24 + b.d * Math.tan((3 + top * rand() ** 1.3 * cl) * DEG)) * k, 45, 600);
      if (r < 0.35) tower(CX + mx, CZ + mz, w * (0.6 + rand() * 0.3), dd * (0.6 + rand() * 0.3), H(1.1), rand() < 0.8);
      else if (r < 0.65) {   // two, side by side
        const alongX = rand() < 0.5;
        for (const s of [-1, 1]) {
          const cx = alongX ? mx + s * w / 4 : mx, cz = alongX ? mz : mz + s * dd / 4;
          tower(CX + cx, CZ + cz, (alongX ? w / 2 : w) * (0.7 + rand() * 0.2), (alongX ? dd : dd / 2) * (0.7 + rand() * 0.2), H(0.95), rand() < 0.6);
        }
      } else for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {   // four smaller
        if (rand() < 0.12) continue;
        tower(CX + mx + sx * w / 4, CZ + mz + sz * dd / 4, w / 2 * (0.65 + rand() * 0.25), dd / 2 * (0.65 + rand() * 0.25), H(0.75), rand() < 0.4);
      }
    }
    // low buildings between the lot and the elevated road: sheds, a motel, parking garages
    for (let x = -1400; x <= 1400; x += 120) for (let z = -1300; z <= 1300; z += 120) {
      const px = x + (rand() - 0.5) * 50, pz = z + (rand() - 0.5) * 50, w = 50 + rand() * 70, dd = 40 + rand() * 60, r = Math.hypot(w, dd) / 2;
      const ax = Math.abs(px), az = Math.abs(pz);
      if (sdBox(ax, az, LOT) < 46 + r || sdBox(ax, az, HW) > -(HW.w / 2 + 14 + r) || (az < AVE + r && ax > A.hx)) { rand(); continue; }
      const garage = rand() < 0.2;
      add(2, px + CX, 0, pz + CZ, w, garage ? 36 + rand() * 20 : 28 + rand() * 60, dd, 0, garage ? 4 : 1, garage ? lin(0x77736c) : pick(HOMES), garage ? 0.9 : 0.1 + rand() * 0.2);
    }
  }

  // ---- the parked cars: two boxes each, in the bays, fuller near the stadium -------------------------------------
  let cars = 0;
  {
    const PAINT = [0xd8d8d4, 0xd8d8d4, 0x9a9da3, 0x9a9da3, 0x5b5f66, 0x1c1d21, 0x1c1d21, 0x22324f, 0x7a1f1c, 0x2c3b2e, 0x8c7a5a, 0x3b4a63, 0xb5b0a5, 0xa8402a].map(lin);
    const GLASS = lin(0x15181c);
    for (let ax = 5; ax < LOT.hx; ax += 10) {
      const xm = ((ax + 15) % XA + XA) % XA; if (xm < XAW || xm > XA - 10) continue;   // (not in a cross aisle)
      for (let k = 0; ; k++) {
        const row = ROW0 + k * ROW; if (row > LOT.hz) break;
        for (const [cz, face] of [[row + 10, 1], [row + 30, -1]]) {
          if (![[-5, -10], [5, -10], [-5, 10], [5, 10]].every(([u, v]) => inLot(ax + u, cz + v))) continue;
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            const full = 0.92 - 0.62 * clamp((sdBox(ax, cz, A) - DR) / 430, 0, 1);
            if (rand() > full) continue;
            const x = CX + sx * ax + (rand() - 0.5) * 1.4, z = CZ + sz * cz + (rand() - 0.5) * 1.6, nose = sz * face * (rand() < 0.12 ? -1 : 1);
            const yaw = (rand() - 0.5) * 0.06, len = 16 + rand() * 2.5, tall = rand() < 0.25 ? 1.25 : 1;   // (a few vans and trucks)
            add(3, x, 0.4, z, 7.2, 3.4 * tall, len, yaw, 2, pick(PAINT));
            add(3, x - Math.sin(yaw) * nose * 1.5, 0.4 + 3.4 * tall, z - nose * 1.5, 6.3, 2.2, len * (tall > 1 ? 0.8 : 0.52), yaw, 2, GLASS);
            cars++;
          }
        }
      }
    }
  }

  return {
    layout: LAYOUT,
    defs: '#define BD_SHARE 1.0\n#define BD_BRIGHT bdNight\n',
    ground: { geo, fn: GROUND_FN, main: GROUND_MAIN, glow: 'bdAlb * bdLight * bdNight', cap: 1.0, keep: 0.45 },
    nearD: 640,   // (the parked cars past this are left off at the middle quality steps)
    craft: { blimp: L.blimp },
    skyline: { R: 2200, top: 380, rep: 2 },
    counts: { cars, lotLamps: lotLamps.length },
  };
}

// A flat ground from a shape on (x, y), moved to stand on (x, z) round (cx, cz), facing up.
export function flatGround(shape, cx, cz) {
  const g = new THREE.ShapeGeometry(shape, 16), p = g.attributes.position;
  // (from the shape's x, y to the ground's x, z: a mirror, so the triangles are turned back round to face up)
  for (let i = 0; i < p.count; i++) p.setXYZ(i, cx + p.getX(i), 0.03, cz + p.getY(i));
  const ix0 = g.index.array; for (let i = 0; i < ix0.length; i += 3) { const t = ix0[i + 1]; ix0[i + 1] = ix0[i + 2]; ix0[i + 2] = t; }
  g.deleteAttribute('uv');
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  g.computeBoundingSphere();
  return g;
}

// The ground's paint, by where it is. Everything is worked out folded into one quarter (a = the distance from the middle
// on each axis), as the lot is the same in each. Lines fade to their share of the pixel when they are finer than one.
const GROUND_FN = `
float bdLn(float c, float w, float fw) { return clamp((w + 0.5 * fw - abs(c)) / fw, 0.0, 1.0) * min(1.0, 2.0 * w / fw); }
vec3 bdGround(vec2 p, vec2 fw, float fA, float fL, out vec3 light) {
  vec2 a = abs(p);
  float dA = bdBox(a, BD_APRON), dL = bdBox(a, BD_LOT), dH = bdBox(a, BD_HWY);
  float big = bdN(p * 0.021), mid = bdN(p * 0.13 + 7.0);
  float grain = bdDetail > 0.5 ? mix(bdH(floor(p * 2.0)), 0.5, clamp(max(fw.x, fw.y) * 1.5 - 0.4, 0.0, 1.0)) : 0.5;
  vec3 tar = vec3(0.05, 0.051, 0.054) * (0.78 + 0.38 * big + 0.16 * mid) * (0.86 + 0.28 * grain);
  vec3 conc = vec3(0.2, 0.195, 0.185) * (0.84 + 0.24 * big + 0.12 * grain);
  vec3 white = vec3(0.52, 0.52, 0.5) * (0.85 + 0.2 * grain), yellow = vec3(0.62, 0.42, 0.05) * (0.85 + 0.2 * grain);
  vec3 col; float w = 0.0, y = 0.0;
  light = vec3(0.0);
  if (dA < 0.0) {
    // the apron round the stadium: concrete slabs, lit a little from the stadium's doors and concourse
    col = conc;
    vec2 j = abs(fract(p / 24.0 + 0.5) - 0.5) * 24.0;
    col *= 1.0 - 0.3 * max(bdLn(j.x, 0.18, fw.x), bdLn(j.y, 0.18, fw.y));
    light = vec3(1.0, 0.8, 0.55) * 0.22;
  } else if (dA < BD_DRIVE) {
    // the drive round the apron: white edges and a double yellow line
    col = tar;
    w = max(bdLn(dA - 1.6, 0.3, fA), bdLn(dA - BD_DRIVE + 1.6, 0.3, fA));
    y = max(bdLn(dA - BD_DRIVE * 0.5 + 0.7, 0.25, fA), bdLn(dA - BD_DRIVE * 0.5 - 0.7, 0.25, fA));
  } else if (a.y < BD_AVE && a.x > BD_APRON.x) {
    // an avenue: four lanes, then pavement and a verge
    if (a.y < 26.0) {
      col = tar * 0.92;
      y = bdLn(a.y - 0.9, 0.28, fw.y);
      float dash = smoothstep(0.45 - fw.x / 30.0, 0.45 + fw.x / 30.0, fract(a.x / 30.0));
      w = max(bdLn(a.y - 12.5, 0.3, fw.y) * dash, bdLn(a.y - 24.6, 0.3, fw.y));
    } else if (a.y < 34.0) col = conc * (1.0 - 0.3 * bdLn(a.y - 26.2, 0.25, fw.y));
    else col = vec3(0.034, 0.042, 0.03) * (0.75 + 0.5 * big + 0.2 * grain);
  } else if (dL < 0.0) {
    // the lot: pairs of rows of bays, aisles between, cross aisles every 240, a curb round the edge
    col = tar;
    float zm = mod(a.y - ${F(ROW0)}, ${F(ROW)}), xm = mod(a.x + ${F(XAW / 2)}, ${F(XA)});
    if (zm < 40.0 && xm > ${F(XAW)}) {
      float lx = abs(fract(a.x / 10.0 + 0.5) - 0.5) * 10.0;
      w = bdLn(lx, 0.3, fw.x) * smoothstep(0.4, 1.2, zm) * smoothstep(39.6, 38.8, zm);
      y = bdLn(zm - 20.0, 0.32, fw.y);
    }
    col = mix(col, conc, 1.0 - smoothstep(-3.5, -2.5, dL));
  } else if (dL < 40.0) {
    // the road round the lot
    col = tar; w = bdLn(dL - 3.0, 0.3, fL); y = bdLn(dL - 21.0, 0.3, fL);
  } else if (dH < -${F(46)}) {
    // between the lot and the elevated road: verge and yards
    col = mix(vec3(0.034, 0.04, 0.03), conc * 0.55, step(0.55, big)) * (0.8 + 0.4 * mid);
  } else {
    // the city: streets every 260 and pavement between, darker under the elevated road
    vec2 s = abs(fract(a / ${F(BLOCK)} + 0.5) - 0.5) * ${F(BLOCK)};
    float st = min(s.x, s.y);
    col = st < ${F(STREET)} ? tar : st < ${F(STREET + 5)} ? conc * 0.8 : vec3(0.085, 0.082, 0.078) * (0.8 + 0.4 * big);
    light = st < ${F(STREET)} ? ${V3(SODIUM)} * 0.35 : vec3(0.0);
  }
  if (abs(dH) < ${F(46)}) { col *= 0.6; light *= 0.3; }
  col = mix(col, white, w * 0.9); col = mix(col, yellow, y * 0.9);
  // the lamps' light, and a little concrete footing under each of the lot's lamps
  if (dA > BD_DRIVE - 50.0 && dL < 50.0) light += ${V3(LAMP)} * 1.0 * bdLotLight(a);
  if (a.x > BD_APRON.x) light += ${V3(SODIUM)} * 1.6 * bdAveLight(a);
  return col;
}
`;
const GROUND_MAIN = `
vec2 bdP = vBdW.xz - BD_C; vec2 bdFw = max(fwidth(bdP), vec2(1e-3));
vec2 bdA0 = abs(bdP);
float bdFA = max(fwidth(bdBox(bdA0, BD_APRON)), 1e-3), bdFL = max(fwidth(bdBox(bdA0, BD_LOT)), 1e-3);
vec3 bdLight; vec3 bdAlb = bdGround(bdP, bdFw, bdFA, bdFL, bdLight);
`;
