// The world round Hammerdown Arena, past its walls: the parking lot the stadium stands in (painted bays, lamp posts with
// pools of light under them, rows of parked cars), the avenues out of the lot to the east and west, an elevated road
// round it all with its traffic, the city's towers beyond that, a skyline painted round the horizon and the show's blimp
// going round overhead. maps/arena.js lays it out (its `backdrop`); main.js makes it in place of the plain land past the
// edge of the map, and steps it each frame.
//   - None of it is voxels and none of it can be hit. It is all past the ring wall, which keeps the cars in, and none of
//     it stands where the stadium does: the lot starts past the concrete apron round the stadium, which everything
//     arena.js builds stands inside.
//   - Five draws: the ground (one plane with a hole where the pit is, its paint and lamplight worked out from where each
//     pixel is, so there is no texture to hold in memory), every box (towers, the road's deck and piers, lamp posts,
//     parked cars: one instanced box), every light seen from afar (lamps, aviation lights, traffic and the blimp's: one
//     set of points, the traffic moved along its road in the shader), the skyline and the blimp.
//   - The ground, the boxes and the blimp are drawn after the arena (renderOrder 1; three.js otherwise draws them
//     first, by material), so where the stands hide them their pixels are never worked out.
//   - Each frame it only moves a clock and the blimp, and looks at the picture quality step: lower steps draw fewer of
//     the far parked cars, then no traffic (both are at the ends of their buffers, so it is a shorter draw, not a rebuild).
//   - Night is look.dusk, the voxels' own switch for lit windows (src/mesh.js): the windows, lamps and headlights come
//     on with it. By day the same towers stand in the haze and the lamps are off.
//   - Fog: its own, from the scene's fog (colour and distances, which three.js hands every material each frame). The
//     scene's fog would swallow the city whole at night; here the walls fade into it, but never quite, so the towers
//     stand dark against the glow of the sky, and lit windows and lamps keep most of their light through it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { look } from '../../src/mesh.js';

const TAU = Math.PI * 2;
const F = (v) => (+v).toFixed(4);   // a number for GLSL (always with a point)
const V3 = (c) => `vec3(${F(c[0])}, ${F(c[1])}, ${F(c[2])})`;
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
// Light colours (linear): the lot's lamps a warm white, the street lamps and the elevated road's sodium orange.
const LAMP = [1.0, 0.78, 0.52], SODIUM = [1.0, 0.52, 0.18], RED = [1.0, 0.06, 0.03];

// What every shader here shares: a hash and a value noise, the rounded rectangles the lot is laid out with (as a signed
// distance, less than 0 inside, from a point already folded into one quarter), and the fog.
const COMMON = `
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
const FOG_PARS = `
#ifdef USE_FOG
uniform vec3 fogColor;
#ifdef FOG_EXP2
uniform float fogDensity;
#else
uniform float fogNear; uniform float fogFar;
#endif
#endif
`;

// The lit materials (ground, boxes, blimp) are three.js's Lambert, so the scene's own lights fall on them as on the
// arena, with the fog step swapped for this one: what a material puts in bdGlow (its lamps and windows) keeps
// 1 - keep of itself in the thickest fog, and the rest fades to at most `cap` of the way to the fog colour.
function fogKeep(sh, cap, keep) {
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
function sdBox(ax, az, S) {
  const qx = ax - (S.hx - S.r), qz = az - (S.hz - S.r);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - S.r;
}
// points round a rounded rectangle (offsets from the middle), about `step` apart, as a closed loop
function loopPath(S, step) {
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

export function makeBackdrop({ scene, layout: L, mobile, viewH }) {
  const CX = L.x, CZ = L.z, A = L.apron, LOT = L.lot, HW = L.highway, DR = L.drive, REACH = L.city;
  const AVE_END = L.avenueEnd;
  let seed = 20240917;
  const rand = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 8) & 0xffff) / 65536; };
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const U = { time: { value: 0 }, vh: { value: 540 }, detail: { value: 1 }, blimp: { value: new THREE.Matrix4() } };
  const NIGHT = look.dusk;   // shared with the voxels: 0 by day, 1 at night
  const objects = [];
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
`;
  const lampAt = (ax, az) => sdBox(ax, az, A) > DR + 6 && sdBox(ax, az, LOT) < -6 && !(az < AVE && ax > A.hx);
  const inLot = (ax, az) => sdBox(ax, az, A) > DR + 1 && sdBox(ax, az, LOT) < -1 && !(az < AVE && ax > A.hx);

  // ---- the ground: a plane out to where the plain land used to reach, with the pit cut out of it -------------------
  // The hole is a little inside the line of the ring wall's outside, under its voxels, so no seam shows; the arena's
  // own floor goes on under the lot everywhere else and the lot is drawn a hair above it.
  {
    const H = L.hole, ix = H.hx - H.r, iz = H.hz - H.r, R = 3200;
    const shape = new THREE.Shape([new THREE.Vector2(-R, -R), new THREE.Vector2(R, -R), new THREE.Vector2(R, R), new THREE.Vector2(-R, R)]);
    const hole = new THREE.Path();
    hole.moveTo(ix + H.r, -iz);
    hole.absarc(ix, iz, H.r, 0, Math.PI / 2, false); hole.absarc(-ix, iz, H.r, Math.PI / 2, Math.PI, false);
    hole.absarc(-ix, -iz, H.r, Math.PI, Math.PI * 1.5, false); hole.absarc(ix, -iz, H.r, Math.PI * 1.5, TAU, false);
    shape.holes.push(hole);
    const g = new THREE.ShapeGeometry(shape, 16), p = g.attributes.position;
    // (from the shape's x, y to the ground's x, z: a mirror, so the triangles are turned back round to face up)
    for (let i = 0; i < p.count; i++) p.setXYZ(i, CX + p.getX(i), 0.03, CZ + p.getY(i));
    const ix0 = g.index.array; for (let i = 0; i < ix0.length; i += 3) { const t = ix0[i + 1]; ix0[i + 1] = ix0[i + 2]; ix0[i + 2] = t; }
    g.deleteAttribute('uv');
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    g.computeBoundingSphere();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    mat.customProgramCacheKey = () => 'bd-ground';
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.bdNight = NIGHT; sh.uniforms.bdDetail = U.detail;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vBdW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvBdW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      fogKeep(sh, 1.0, 0.45);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vBdW; uniform float bdNight; uniform float bdDetail;')
        .replace('#include <fog_pars_fragment>\n' + COMMON, '#include <fog_pars_fragment>\n' + COMMON + LAYOUT + GROUND_FN)
        .replace('vec3 bdGlow = vec3(0.0);', 'vec3 bdGlow = vec3(0.0);\n' + GROUND_MAIN)
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = bdAlb;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nbdGlow = bdAlb * bdLight * bdNight; totalEmissiveRadiance += bdGlow;');
    };
    // (no shadows on it: the stands' fall where the stands hide them from the pit, and it saves a shadow lookup for
    // every pixel of it)
    const ground = new THREE.Mesh(g, mat);
    ground.renderOrder = 1; ground.matrixAutoUpdate = false; ground.updateMatrix();
    objects.push(ground);
  }

  // ---- the boxes: everything square-cornered, in one instanced draw ------------------------------------------------
  // kind 0 an office tower (bands of glass), 1 flats (rows of windows), 2 plain (concrete, steel, parked cars: lit by
  // the scene and, near the ground, by the lot's lamps), 3 a lamp's head (lit), 4 a parking garage (its floors lit
  // the whole way along). `lit` is the share of windows lit at night, `crown` the height of a lit band round the top.
  // Each is put in a group: the order they are drawn in, so the lower quality steps can leave off the end.
  const boxes = [];
  const add = (grp, x, y, z, sx, sy, sz, yaw, kind, col, lit = 0, crown = 0) => boxes.push({ grp, x, y, z, sx, sy, sz, yaw, kind, col, lit, crown, seed: rand() * 997, d: Math.hypot(x - CX, z - CZ) });
  const P = { a: [], b: [], d: [], c: [] };
  // a light seen from afar: kind 0 a lamp (on at night), 1 an aviation light (blinks red), 2 traffic (runs from a to
  // b over and over), 3 traffic that fades in and out at the ends of its run, 4 a light on the blimp, 5 its strobe
  const pts = { lamp: [], blink: [], blimp: [], road: [], ave: [] };
  const pt = (list, x, y, z, size, kind, col, phase = 0, speed = 0, bx = x, by = y, bz = z) => list.push([x, y, z, bx, by, bz, size, kind, phase, speed, col]);

  // the lot's lamp posts: a pole and a double head
  const POLE = lin(0x3a3d42), HEAD = LAMP.map((v) => v * 0.9);
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
  const OFFICE = [0x2a3442, 0x1f252d, 0x3a3430, 0x4a4c50, 0x29323a, 0x575852].map(lin);
  const HOMES = [0x6b4a3a, 0x8c7c68, 0x5f5f5c, 0x7a6a58, 0x4f4a46].map(lin);
  const ROOF = lin(0x2c2d30), MAST = lin(0x55585e);
  const DT = [-0.25, Math.PI - 0.45], DEG = Math.PI / 180;
  const cluster = (ang) => 0.72 + 0.42 * Math.max(0, Math.cos(ang - DT[0])) ** 3 + 0.36 * Math.max(0, Math.cos(ang - DT[1])) ** 4;
  const blink = (x, y, z) => pt(pts.blink, x, y, z, 7, 1, RED, rand());
  // a plain tower: one block, or set back once or twice on the way up, with what stands on its roof
  function tower(x, z, w, d, h, office) {
    const col = pick(office ? OFFICE : HOMES), kind = office ? 0 : 1, lit = office ? 0.14 + rand() * 0.26 : 0.14 + rand() * 0.24;
    const crown = office && h > 180 && rand() < 0.2 ? 6 + rand() * 10 : 0;
    let y = 0, tw = w, td = d, top = h;
    if (h > 170 && rand() < 0.45) {
      const h1 = h * (0.55 + rand() * 0.2); add(0, x, 0, z, w, h1, d, 0, kind, col, lit);
      y = h1; tw = w * (0.68 + rand() * 0.17); td = d * (0.68 + rand() * 0.17);
      if (h > 260 && rand() < 0.35) { const h2 = y + (h - y) * 0.7; add(0, x, y, z, tw, h2 - y, td, 0, kind, col, lit); y = h2; tw *= 0.72; td *= 0.72; }
    }
    add(0, x, y, z, tw, top - y, td, 0, kind, col, lit, crown);
    if (rand() < 0.55) add(1, x + (rand() - 0.5) * tw * 0.3, top, z + (rand() - 0.5) * td * 0.3, tw * (0.3 + rand() * 0.25), 7 + rand() * 12, td * (0.3 + rand() * 0.25), 0, 2, ROOF);
    if (top > 200 && rand() < 0.4) { const mh = 30 + rand() * 60, mx = x + (rand() - 0.5) * tw * 0.4, mz = z + (rand() - 0.5) * td * 0.4; add(1, mx, top, mz, 2.4, mh, 2.4, 0, 2, MAST); blink(mx, top + mh + 1, mz); }
    else if (top > 280) for (const s of [-1, 1]) blink(x + s * tw * 0.45, top + 1.5, z + s * td * 0.45);
  }
  // The landmarks: a few towers of their own, far out where their tops still come under the top of the picture. Each is
  // drawn with add and blink passed in, which scale its heights to fit.
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
          }
        }
      }
    }
  }

  // ---- fill the boxes' buffers, nearest first within each group ---------------------------------------------------
  boxes.sort((a, b) => a.grp - b.grp || (a.grp === 3 ? a.d - b.d : 0));
  const cut = { g0: 0, g1: 0, g2: 0, near: 0, all: boxes.length };
  boxes.forEach((b, i) => { if (b.grp === 0) cut.g0 = i + 1; if (b.grp <= 1) cut.g1 = i + 1; if (b.grp <= 2) cut.g2 = i + 1; if (b.grp < 3 || b.d < 640) cut.near = i + 1; });
  const boxMesh = (() => {
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); geo.deleteAttribute('uv');
    const data = new Float32Array(boxes.length * 4);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    mat.customProgramCacheKey = () => 'bd-boxes';
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.bdNight = NIGHT;
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
      fogKeep(sh, 0.88, 0.62);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float bdNight; varying vec4 vBdD; varying vec3 vBdW; varying vec4 vBdF; varying float vBdTop;')
        .replace('#include <fog_pars_fragment>\n' + COMMON, '#include <fog_pars_fragment>\n' + COMMON + LAYOUT)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + BOX_FRAG)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += bdGlow;');
    };
    const m = new THREE.InstancedMesh(geo, mat, boxes.length);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), T = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    boxes.forEach((b, i) => {
      Q.setFromAxisAngle(UP, b.yaw); T.set(b.x, b.y, b.z); S.set(b.sx, b.sy, b.sz); M.compose(T, Q, S); m.setMatrixAt(i, M);
      col.setRGB(b.col[0], b.col[1], b.col[2]); m.setColorAt(i, col);
      data.set([b.kind, b.seed, b.lit, b.crown], i * 4);
    });
    geo.setAttribute('iData', new THREE.InstancedBufferAttribute(data, 4));
    m.matrixAutoUpdate = false; m.updateMatrix(); m.frustumCulled = false; m.renderOrder = 1;
    return m;
  })();
  objects.push(boxMesh);

  // ---- the blimp ------------------------------------------------------------------------------------------------
  const B = L.blimp, blimp = makeBlimp(B, mobile, NIGHT);
  blimp.mesh.renderOrder = 1;
  objects.push(blimp.mesh);
  // its lights, carried round with it: red to port and green to starboard on the tail fins, a white strobe on top of
  // the tail and one under the gondola
  pt(pts.blimp, -0.4 * B.len, 0, -0.2 * B.len, 9, 4, [1, 0.08, 0.04]);
  pt(pts.blimp, -0.4 * B.len, 0, 0.2 * B.len, 9, 4, [0.1, 1, 0.2]);
  pt(pts.blimp, -0.46 * B.len, 0.16 * B.len, 0, 12, 5, [1, 1, 1], 0);
  pt(pts.blimp, 0.1 * B.len, -0.17 * B.len, 0, 12, 5, [1, 1, 1], 0.5);

  // ---- the lights' points ------------------------------------------------------------------------------------------
  const order = [...pts.lamp, ...pts.blink, ...pts.blimp, ...pts.road, ...pts.ave];
  const ptCut = { noAve: pts.lamp.length + pts.blink.length + pts.blimp.length + pts.road.length, noRoad: pts.lamp.length + pts.blink.length + pts.blimp.length, all: order.length };
  const glow = (() => {
    const n = order.length, pa = new Float32Array(n * 3), pb = new Float32Array(n * 3), pd = new Float32Array(n * 4), pc = new Float32Array(n * 3);
    order.forEach((p, i) => { pa.set(p.slice(0, 3), i * 3); pb.set(p.slice(3, 6), i * 3); pd.set(p.slice(6, 10), i * 4); pc.set(p[10], i * 3); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pa, 3)); g.setAttribute('aB', new THREE.BufferAttribute(pb, 3));
    g.setAttribute('aD', new THREE.BufferAttribute(pd, 4)); g.setAttribute('aC', new THREE.BufferAttribute(pc, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: U.time, uNight: NIGHT, uVH: U.vh, uBlimp: { value: blimp.mesh.matrixWorld } },
      vertexShader: FOG_PARS + COMMON + POINTS_VERT, fragmentShader: POINTS_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    });
    const p = new THREE.Points(g, mat);
    p.frustumCulled = false; p.renderOrder = -1;   // (first of the see-through things: it is all far off, behind the smoke)
    p.matrixAutoUpdate = false; p.updateMatrix();
    return p;
  })();
  objects.push(glow);

  // ---- the skyline round the horizon ------------------------------------------------------------------------------
  // A ring of painted silhouettes just inside the camera's far edge, centred on the camera (so it is always as far off,
  // like the sky), drawn straight after the sky and before everything else, so all of the scene stands in front of it.
  {
    const W = mobile ? 2048 : 4096, H = 128, tex = new THREE.CanvasTexture(paintSkyline(W, H, rand));
    tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
    const R = 2200, top = 380, g = new THREE.CylinderGeometry(R, R, top + 20, 96, 1, true).translate(0, top / 2 - 10, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), map: { value: tex }, uRep: { value: 2 }, uNight: NIGHT },
      vertexShader: 'varying vec2 vUv; uniform float uRep; void main(){ vUv = vec2(uv.x * uRep, uv.y); vec3 p = vec3(cameraPosition.x + position.x, position.y, cameraPosition.z + position.z); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }',
      fragmentShader: FOG_PARS + SKYLINE_FRAG,
      side: THREE.BackSide, depthWrite: false, fog: true,
      blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    const band = new THREE.Mesh(g, mat);
    band.renderOrder = -1.5; band.frustumCulled = false; band.matrixAutoUpdate = false; band.updateMatrix();
    objects.push(band);
  }

  for (const o of objects) scene.add(o);
  const counts = { boxes: boxes.length, cars: boxes.filter((b) => b.grp === 3).length / 2, lotLamps: lotLamps.length, points: order.length, traffic: pts.road.length + pts.ave.length };
  boxes.length = 0; order.length = 0; for (const k in pts) pts[k].length = 0;   // (all in the buffers now)
  let q = -1;
  return {
    objects, night: NIGHT, counts,
    step(dt, quality) {
      U.time.value = (U.time.value + dt) % 7200;
      U.vh.value = viewH();
      blimp.step(U.time.value);
      if (quality === q) return;
      q = quality;
      // lower steps: fewer of the far parked cars, then no avenue traffic, then no traffic at all, then no cars or sheds
      boxMesh.count = q <= 3 ? cut.all : q <= 5 ? cut.near : cut.g1;
      glow.geometry.setDrawRange(0, q <= 3 ? ptCut.all : q === 4 ? ptCut.noAve : ptCut.noRoad);
      U.detail.value = q <= 3 ? 1 : 0;
    },
  };
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

// The boxes' look, after the instance's colour is in diffuseColor: windows on the buildings' walls (lit at night by
// floor and by window, warm, white or now and then cool), a lit band round the top of a few, the lot's lamplight on the
// cars and posts, and the lamps' heads.
const BOX_FRAG = `
float bdK = vBdD.x, bdSeed = vBdD.y;
bool bdOff = bdK < 0.5, bdGar = bdK > 3.5;
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
    float on = step(bdH(ci * vec2(1.0, 1.7) + vec2(vBdF.z * 37.0 + bdSeed * 91.0, bdSeed * 17.0)), vBdD.z * (0.2 + 1.6 * fl * fl));
    float th = bdH(vec2(bdOff ? ci.y : ci.x + ci.y * 7.0, bdSeed + vBdF.z));
    vec3 tint = th < 0.45 ? vec3(1.0, 0.64, 0.34) : th < 0.8 ? vec3(1.0, 0.85, 0.64) : th < 0.95 ? vec3(0.6, 0.78, 1.0) : vec3(0.66, 1.0, 0.76);
    if (bdGar) tint = vec3(0.78, 0.9, 1.0);
    float bri = 0.55 + 0.75 * bdH(ci + bdSeed);
    float area = min(ws.x, 1.0) * ws.y;
    vec3 lit = mix(tint * bri * on * win, vec3(0.95, 0.75, 0.5) * vBdD.z * 0.4 * area, far);
    bdGlow += lit * bdNight * 1.55;
    // the glass: darker than the wall (so the rows of windows show by day too)
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03, 0.038, 0.05), mix(win, area, far) * 0.85);
  } else if (vBdF.w > 0.5) diffuseColor.rgb *= 0.5;
  if (vBdD.w > 0.5 && abs(vBdF.w) < 0.5 && vBdW.y > vBdTop - vBdD.w) {
    float ch = fract(bdSeed * 7.31);
    vec3 cc = ch < 0.4 ? vec3(1.0, 0.84, 0.6) : ch < 0.65 ? vec3(0.45, 0.82, 1.0) : ch < 0.85 ? vec3(1.0, 0.36, 0.3) : vec3(0.78, 0.58, 1.0);
    bdGlow += cc * (0.06 + 1.5 * bdNight);
  }
} else if (bdK < 2.5) {
  // plain: near the ground in the lot, lit by its lamps (from above, so the tops more than the sides)
  if (vBdW.y < 50.0) bdGlow += bdBase * ${V3(LAMP)} * 1.0 * bdLotLight(abs(vBdW.xz - BD_C)) * (0.35 + 0.65 * max(vBdF.w, 0.0)) * bdNight;
} else {
  // a lamp's head
  bdGlow += bdBase * (0.04 + 2.6 * bdNight);
  diffuseColor.rgb *= 0.3;
}
`;

const POINTS_VERT = `
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
    vec2 dir = normalize(aB.xz - position.xz), to = normalize(cameraPosition.xz - p.xz);
    col = mix(vec3(1.0, 0.07, 0.03) * 0.85, vec3(1.0, 0.9, 0.72) * 1.1, smoothstep(-0.25, 0.25, dot(dir, to)));
    k *= 0.2 + 0.8 * uNight;
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
const POINTS_FRAG = `
varying vec3 vC;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q);
  if (r > 1.0) discard;
  gl_FragColor = vec4(vC * (exp(-r * 9.0) + 0.35 * (1.0 - r) * (1.0 - r)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
// The skyline's texture holds, in its channels: red the shade of the building (1 the far rows, lighter in the haze), green
// a window's light, blue its tint (warm to cool, and past 0.8 an aviation light's red), alpha the outline.
const SKYLINE_FRAG = `
uniform sampler2D map; uniform float uNight;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(map, vUv);
  if (t.a < 0.02) discard;
  vec3 haze = vec3(0.6, 0.55, 0.5);
#ifdef USE_FOG
  haze = fogColor;
#endif
  float shade = t.r / t.a;
  vec3 body = haze * mix(0.84, 0.42, uNight) * mix(1.0, shade, 0.55);
  float b = t.b / t.a;
  vec3 tint = b > 0.8 ? vec3(1.0, 0.08, 0.04) * 2.0 : mix(vec3(1.0, 0.66, 0.38), vec3(0.66, 0.82, 1.0), b / 0.6);
  vec3 win = tint * (t.g / t.a) * uNight * 0.75;
  gl_FragColor = vec4(body + win, t.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// The skyline: rows of buildings of all heights, painted texel by texel so the channels hold exactly what the shader
// reads. It wraps (the right edge runs into the left), and goes round twice.
function paintSkyline(W, H, rand) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  // a slow swell along the skyline, so the buildings bunch into taller districts (whole waves, so it wraps)
  const swell = (x) => { const u = x / W * TAU; return 0.62 + 0.22 * Math.sin(u * 2 + 0.7) + 0.12 * Math.sin(u * 5 + 2.1) + 0.06 * Math.sin(u * 11); };
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

// The blimp: a long envelope (fuller at the nose), four tail fins and a gondola, in one mesh. Its sides carry the show's
// name in lights; it goes round the arena on a wide ellipse, nose first, a little up and down.
function makeBlimp(B, mobile, NIGHT) {
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
  const w = B.speed / ((B.rx + B.rz) / 2);
  return {
    mesh,
    step(t) {
      const a = B.a0 + t * w, x = B.x + Math.cos(a) * B.rx, z = B.z + Math.sin(a) * B.rz;
      const tx = -Math.sin(a) * B.rx, tz = Math.cos(a) * B.rz;
      mesh.position.set(x, B.y + Math.sin(t * 0.21) * 5, z);
      mesh.rotation.set(0, Math.atan2(-tz, tx), Math.sin(t * 0.17) * 0.02);
      mesh.updateMatrix(); mesh.updateMatrixWorld(true);
    },
  };
}
