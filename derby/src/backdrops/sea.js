// The open sea round Blackwater Rig (maps/rig.js), in a storm at night. The rig's decks stand well above it (the map's
// floor is the main deck, at 0; the sea is at L.sea, below); everything here is to look at, nothing of it is solid.
//   - The sea: one flat sheet at the sea's level, its swell, chop and white caps worked out in the ground's shader and
//     run with the wind (the same way the rain slants: looks/storm.js); foam washes round each of the rig's legs, the
//     flare's light lies on the water under it, and the decks' own lights spill a little over their edges.
//   - Out in the dark: two more platforms of the field, each with its flare burning and its lamps, a supply ship
//     standing off with her deck lights on, and a few buoys' lights.
//   - The skyline is the sea's own edge: nothing but a few lights low on it.
// backdrop: { kind: 'sea', x, z, sea, water, legs: [[x, z, r]], flare: [x, z], decks: [[x0, z0, x1, z1]], holes: [[x0, z0,
// x1, z1]] (through a deck: the lamps' light gets down them), wind: [x, z], field, ships, buoys }
import * as THREE from 'three';
import { F, V3, lin } from './kit.js';

const STEEL = lin(0x4a5258), RUST = lin(0x6a4a3a), HULL = lin(0x8a3226), WHITE = lin(0xd8d8d2), YELLOW = lin(0xd8a828);
const SODIUM = [1.0, 0.62, 0.3], COLD = [0.75, 0.88, 1.0], FLAME = [1.0, 0.5, 0.16];

export function sea(kit) {
  const { L, rand, add, pt, pts, blink } = kit;
  const Y = L.sea, wl = Math.hypot(L.wind[0], L.wind[1]), wind = [L.wind[0] / wl, L.wind[1] / wl];
  const legs = L.legs.slice(0, 16), decks = L.decks.slice(0, 8);

  const LAYOUT = `
const vec3 BD_SEA = ${V3(lin(L.water))};
const vec2 BD_WIND = vec2(${F(wind[0])}, ${F(wind[1])});
const vec2 BD_FLARE = vec2(${F(L.flare[0])}, ${F(L.flare[1])});
vec3 bdPlainLight(vec3 w) { return vec3(0.0); }
`;
  // how far a point is from the nearest leg's side, and from the nearest deck's edge (less than 0 under a deck)
  const LEGS = `float bdLeg(vec2 p) { float d = 1e4;\n${legs.map(([x, z, r]) => `  d = min(d, length(p - vec2(${F(x)}, ${F(z)})) - ${F(r)});`).join('\n')}\n  return d; }\n`;
  const holes = (L.holes || []).slice(0, 4);
  const DECKS = `float bdDeck(vec2 p) { float d = 1e4; vec2 q;\n${decks.map(([x0, z0, x1, z1]) => `  q = abs(p - vec2(${F((x0 + x1) / 2)}, ${F((z0 + z1) / 2)})) - vec2(${F((x1 - x0) / 2)}, ${F((z1 - z0) / 2)}); d = min(d, length(max(q, 0.0)) + min(max(q.x, q.y), 0.0));`).join('\n')}
${holes.map(([x0, z0, x1, z1]) => `  q = abs(p - vec2(${F((x0 + x1) / 2)}, ${F((z0 + z1) / 2)})) - vec2(${F((x1 - x0) / 2)}, ${F((z1 - z0) / 2)}); d = max(d, -(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0)));`).join('\n')}
  return d; }\n`;
  const GROUND_FN = LEGS + DECKS + `
vec3 bdGround(vec2 p, vec2 fw, out vec3 light) {
  float t = bdTime, px = max(fw.x, fw.y);
  float far = clamp(px * 0.5 - 0.15, 0.0, 1.0);        // far off, the fine waves even out
  vec2 w = BD_WIND, c = vec2(-w.y, w.x);
  vec2 q = vec2(dot(p, w), dot(p, c));                   // along the wind, and across it
  // the swell: long crests across the wind, rolling down it; a second set a little off it
  float s1 = bdN(vec2(q.x * 0.026 - t * 0.62, q.y * 0.007));
  float s2 = bdN(vec2(q.x * 0.011 - t * 0.31 + 5.0, q.y * 0.004 + 2.0));
  float s3 = bdN(p * 0.058 + vec2(-t * 0.45, t * 0.2) + 9.0);
  // the chop on top of it
  float c1 = mix(bdN(vec2(q.x * 0.21 - t * 1.5, q.y * 0.09)), 0.5, far);
  float c2 = mix(bdN(p * 0.55 + vec2(t * 0.9, -t * 1.2) + 3.0), 0.5, clamp(px * 1.4 - 0.2, 0.0, 1.0));
  float h = s1 * 0.5 + s2 * 0.25 + s3 * 0.25;
  vec3 col = BD_SEA * (0.45 + 1.25 * smoothstep(0.2, 0.85, h) + 0.35 * (c1 - 0.5) + 0.25 * (c2 - 0.5));
  // white caps: where a crest of the swell is steep and the chop breaks on it, streaked down the wind
  float cap = smoothstep(0.6, 0.78, s1 * 0.7 + s3 * 0.3) * smoothstep(0.42, 0.7, c1) * (0.55 + 0.45 * c2);
  float streak = smoothstep(0.66, 0.9, bdN(vec2(q.x * 0.035 - t * 0.5, q.y * 0.2))) * smoothstep(0.5, 0.8, s2) * 0.25;
  // foam washing round the legs, and a wake down the wind from each
  float dl = bdLeg(p);
  float wash = smoothstep(7.0 + 3.0 * s3, 0.5, dl) * (0.55 + 0.45 * bdN(p * 0.4 + vec2(-t * 1.3, t * 0.7)));
  float foam = clamp(cap + streak + wash, 0.0, 1.0);
  col = mix(col, vec3(0.52, 0.58, 0.6), foam * 0.8);
  // the light on the water: the flare's, flickering, over its own patch of sea; and the decks' lamps over their edges
  float df = length(p - BD_FLARE);
  float fl = 0.8 + 0.2 * sin(t * 11.0) * sin(t * 7.3 + 1.0);
  light = vec3(1.0, 0.44, 0.13) * fl * (0.35 + 0.65 * c1) * 0.9 / (1.0 + df * df / 1700.0);
  float dd = bdDeck(p);
  light += vec3(0.95, 0.9, 0.8) * 0.17 * smoothstep(60.0, 0.0, dd) * smoothstep(-5.0, 3.0, dd) * (0.5 + c1);
  light *= 0.3 + 0.3 * foam + col * 5.0;
  // under the decks it is darker still
  col *= mix(0.45, 1.0, smoothstep(-14.0, 6.0, dd));
  return col;
}
`;
  const GROUND_MAIN = `
vec2 bdP = vBdW.xz; vec2 bdFw = max(fwidth(bdP), vec2(1e-3));
vec3 bdLight; vec3 bdAlb = bdGround(bdP, bdFw, bdLight);
`;

  // the sheet
  const R = 3600, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([L.x - R, Y, L.z - R, L.x + R, Y, L.z - R, L.x + R, Y, L.z + R, L.x - R, Y, L.z + R], 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  geo.setIndex([0, 2, 1, 0, 3, 2]); geo.computeBoundingSphere();

  // ---- the rest of the field: a platform is four legs, a deck, a block of quarters, a derrick and a flare boom ----
  const platform = (x, z, k, yaw) => {
    const co = Math.cos(yaw), si = Math.sin(yaw), at = (a, b) => [x + (a * co + b * si) * k, z + (-a * si + b * co) * k];
    for (const [a, b] of [[-60, -36], [60, -36], [-60, 36], [60, 36]]) { const [lx, lz] = at(a, b); add(0, lx, Y - 4, lz, 14 * k, 34 * k, 14 * k, yaw, 2, STEEL); }
    add(0, x, Y + 30 * k, z, 170 * k, 9 * k, 110 * k, yaw, 2, RUST);
    { const [bx, bz] = at(-52, 0); add(1, bx, Y + 39 * k, bz, 44 * k, 30 * k, 80 * k, yaw, 1, WHITE, 0.55); }
    { const [dx, dz] = at(20, 0); add(1, dx, Y + 39 * k, dz, 22 * k, 60 * k, 22 * k, yaw, 2, STEEL); add(2, dx, Y + 99 * k, dz, 11 * k, 46 * k, 11 * k, yaw, 2, STEEL); blink(dx, Y + 148 * k, dz); }
    { const [fx, fz] = at(150, 30); add(2, (x + 85 * k * co + fx) / 2, Y + 34 * k, (z - 85 * k * si + fz) / 2, 80 * k, 4 * k, 6 * k, yaw, 2, STEEL); add(2, fx, Y + 34 * k, fz, 5 * k, 40 * k, 5 * k, yaw, 2, STEEL);
      pt(pts.lamp, fx, Y + 80 * k, fz, 44 * k, 0, FLAME); pt(pts.lamp, fx, Y + 86 * k, fz, 26 * k, 0, [1, 0.8, 0.5]); }
    for (const [a, b] of [[-80, -52], [80, -52], [-80, 52], [80, 52], [0, -54], [0, 54]]) { const [lx, lz] = at(a, b); pt(pts.lamp, lx, Y + 44 * k, lz, 9, 0, SODIUM); }
  };
  for (const P of L.field || []) platform(P.x, P.z, P.k || 1, P.yaw || 0);
  // the supply ship: hull, deck, bridge forward, a crane aft, her lights
  for (const S of L.ships || []) {
    const co = Math.cos(S.yaw), si = Math.sin(S.yaw), k = S.k || 1, at = (a, b = 0) => [S.x + (a * co + b * si) * k, S.z + (-a * si + b * co) * k];
    add(0, S.x, Y - 2, S.z, 150 * k, 13 * k, 30 * k, S.yaw, 2, HULL);
    { const [x, z] = at(48); add(1, x, Y + 11 * k, z, 34 * k, 22 * k, 26 * k, S.yaw, 1, WHITE, 0.7); add(2, x, Y + 33 * k, z, 12 * k, 12 * k, 12 * k, S.yaw, 2, YELLOW); blink(x, Y + 50 * k, z); }
    { const [x, z] = at(-40); add(2, x, Y + 11 * k, z, 6 * k, 26 * k, 6 * k, S.yaw, 2, YELLOW); }
    for (const a of [-60, -30, 0, 28]) for (const b of [-13, 13]) { const [x, z] = at(a, b); pt(pts.lamp, x, Y + 16 * k, z, 8, 0, a < 20 ? SODIUM : COLD); }
  }
  for (let i = 0; i < (L.buoys || 0); i++) { const a = rand() * 6.283, d = 260 + rand() * 900; pt(pts.blink, L.x + Math.cos(a) * d, Y + 4, L.z + Math.sin(a) * d, 6, 1, rand() < 0.5 ? [0.3, 1, 0.4] : [1, 0.2, 0.1], rand()); }

  return {
    layout: LAYOUT,
    defs: '#define BD_SHARE 1.0\n#define BD_BRIGHT 1.0\n',
    ground: { geo, fn: GROUND_FN, main: GROUND_MAIN, glow: 'bdLight * bdNight', cap: 1.0, keep: 0.4 },
    nearD: 1400,
    skyline: { R: 2340, top: 200, rep: 1, body: [0.8, 0.5], paint: paintHorizon },
  };
}

// the sea's edge: nothing stands on it but a few far lights (the texture's channels: makeSkyline)
function paintHorizon(W, H, rand) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  const put = (x, y, r, gg, b) => { if (y < 0 || y >= H) return; const i = (((x % W) + W) % W + (H - 1 - y) * W) * 4; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; };
  for (let k = 0; k < 9; k++) {
    const x = Math.floor(rand() * W), w = 6 + Math.floor(rand() * 10), h = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < w; i++) for (let y = 4; y < 4 + h; y++) put(x + i, y, 120, (i + y) % 3 === 0 ? 200 : 0, 60);
    const tx = x + 2 + Math.floor(rand() * (w - 4)); for (let y = 4 + h; y < 4 + h + 6; y++) put(tx, y, 120, 0, 0);
    put(tx, 4 + h + 6, 120, 255, 240);
  }
  g.putImageData(img, 0, 0);
  return c;
}
