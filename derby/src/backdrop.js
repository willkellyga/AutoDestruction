// The world round a map, past the edge of what can be driven on: a map that has one lays it out in its `backdrop`
// (`kind` says which), and main.js makes it in place of the plain land past the edge of the map and steps it each frame.
//   arena   Hammerdown Arena's parking lot, avenues, elevated road and city at night, and the show's blimp
//           (./backdrops/arena.js)
//   harbor  New York carrying on past the edge of its map: more boroughs of towers, the far banks across the rivers, two
//           bridges reaching off it, the traffic on far roads, and the news helicopter over the race (./backdrops/harbor.js)
//   wilds   the forest round Camp Deadfall: pines, hills, a road out with what was left on it, a radio mast, and a town
//           burning on the horizon (./backdrops/wilds.js)
//   potomac Washington carrying on past the edge of its map: the low pale city, the rivers, the towers across the Potomac,
//           the cathedral on its hill and wooded hills round the horizon (./backdrops/potomac.js)
// What they share is in ./backdrops/kit.js.
//   - None of it is voxels and none of it can be hit, and none of it stands on anything that can be driven on.
//   - A handful of draws: the ground (one mesh with a hole where the map is, its paint and lamplight worked out from where
//     each pixel is, so there is no texture to hold in memory), every box (one instanced box: towers, decks, posts,
//     parked and burnt-out cars), every light seen from afar (lamps, aviation lights, traffic, fires and the craft's:
//     one set of points, the traffic moved along its road in the shader), the skyline, the craft overhead, and what a
//     backdrop has of its own (the wilds' pines, and its smoke and the glow of the fires).
//   - The ground, the boxes and the craft are drawn after the map (renderOrder 1; three.js otherwise draws them first,
//     by material), so where the map hides them their pixels are never worked out.
//   - Each frame it only moves a clock and the craft, and looks at the picture quality step: lower steps draw fewer of
//     the far boxes, then no traffic (at the ends of their buffers, so it is a shorter draw, not a rebuild).
//   - Night is look.dusk, the voxels' own switch for lit windows (src/mesh.js): the windows, lamps and headlights come
//     on with it. By day the same towers stand in the haze and the lamps are off.
//   - Fog: its own, from the scene's fog (colour and distances, which three.js hands every material each frame). The
//     scene's fog would swallow a city whole at night; here the walls fade into it, but never quite, so the towers
//     stand dark against the glow of the sky, and lit windows and lamps keep most of their light through it.
import * as THREE from 'three';
import { look } from '../../src/mesh.js';
import { WX as VX, WY as VY, WZ as VZ, brickEmpty } from '../../src/world.js';
import { seeded, fogKeep, COMMON, RED, makeBoxes, makePoints, makeSkyline, paintSkyline, makeBlimp, makeHeli, towerKit } from './backdrops/kit.js';
import { arena } from './backdrops/arena.js';
import { harbor } from './backdrops/harbor.js';
import { wilds } from './backdrops/wilds.js';
import { potomac } from './backdrops/potomac.js';
import { sea } from './backdrops/sea.js';

const STYLES = { arena, harbor, wilds, potomac, sea };

// map: the map (its backdrop, and the race's course for the helicopter); follow(): the car the craft keeps with
export function makeBackdrop({ scene, map, mobile, viewH, follow }) {
  const L = map.backdrop, kind = L.kind || 'arena';
  const rand = seeded(L.seed ?? 20240917);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const U = { time: { value: 0 }, vh: { value: 540 }, detail: { value: 1 } };
  const NIGHT = look.dusk;   // shared with the voxels: 0 by day, 1 at night
  const C = L.view || { x: L.x, z: L.z };   // where the backdrop is seen from: nearer boxes are kept at lower steps

  // Everything square-cornered is a box: [group, place, size, yaw, kind, colour, share of windows lit, lit crown].
  // kind 0 an office tower (bands of glass), 1 flats (rows of windows), 2 plain (concrete, steel, cars: lit by the scene
  // and by the lamps on the ground near it), 3 a lamp's head (lit), 4 a parking garage (its floors lit the whole way
  // along), 5 a building on fire. Each is put in a group: the order they are drawn in, so the lower quality steps can
  // leave off the end (0 what makes the place, 1 what stands on roofs, 2 low buildings, 3 small things, nearest first).
  const boxes = [];
  const add = (grp, x, y, z, sx, sy, sz, yaw, kind, col, lit = 0, crown = 0, roll = 0) => boxes.push({ grp, x, y, z, sx, sy, sz, yaw, kind, col, lit, crown, roll, seed: rand() * 997, d: Math.hypot(x - C.x, z - C.z) });
  // the lights, by the order they are dropped in at lower steps (the end first): see kit.js's POINTS_VERT for the kinds
  const pts = { lamp: [], blink: [], craft: [], road: [], ave: [] };
  const pt = (list, x, y, z, size, kind, col, phase = 0, speed = 0, bx = x, by = y, bz = z) => list.push([x, y, z, bx, by, bz, size, kind, phase, speed, col]);
  const blink = (x, y, z) => pt(pts.blink, x, y, z, 7, 1, RED, rand());
  const { tower, LANDMARKS, landmark } = towerKit(add, blink, rand, pick);
  const kit = { L, map, mobile, rand, pick, add, pt, pts, blink, tower, LANDMARKS, landmark, U, NIGHT };
  const S = STYLES[kind](kit);
  if (L.fill) L.fill(kit);   // and what the map stands on its own ground the same cheap way (maps/empire.js: the city off the course)
  const objects = [], parts = {};

  // ---- the ground ------------------------------------------------------------------------------------------------
  {
    const G = S.ground;
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    mat.customProgramCacheKey = () => 'bd-ground-' + kind;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.bdNight = NIGHT; sh.uniforms.bdDetail = U.detail; sh.uniforms.bdTime = U.time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vBdW; varying float vBdUp;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvBdW = (modelMatrix * vec4(transformed, 1.0)).xyz; vBdUp = normal.y;');
      fogKeep(sh, G.cap, G.keep);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vBdW; varying float vBdUp; uniform float bdNight; uniform float bdDetail; uniform float bdTime;')
        .replace('#include <fog_pars_fragment>\n' + COMMON, '#include <fog_pars_fragment>\n' + COMMON + S.layout + G.fn)
        .replace('vec3 bdGlow = vec3(0.0);', 'vec3 bdGlow = vec3(0.0);\n' + G.main)
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = bdAlb;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\nbdGlow = ${G.glow}; totalEmissiveRadiance += bdGlow;`);
    };
    // (no shadows on it: what the map stands on takes the shadows that matter, and it saves a shadow lookup for every
    // pixel of it)
    const ground = new THREE.Mesh(G.geo, mat);
    ground.renderOrder = 1; ground.matrixAutoUpdate = false; ground.updateMatrix();
    objects.push(ground); parts.ground = ground;
  }

  // ---- the boxes, nearest first within each group --------------------------------------------------------------------
  boxes.sort((a, b) => a.grp - b.grp || (a.grp === 3 ? a.d - b.d : 0));
  const nearD = S.nearD ?? 640;
  const cut = { g0: 0, g1: 0, g2: 0, near: 0, all: boxes.length };
  boxes.forEach((b, i) => { if (b.grp === 0) cut.g0 = i + 1; if (b.grp <= 1) cut.g1 = i + 1; if (b.grp <= 2) cut.g2 = i + 1; if (b.grp < 3 || b.d < nearD) cut.near = i + 1; });
  const boxMesh = makeBoxes(boxes, { NIGHT, U, layout: S.layout, defs: S.defs });
  objects.push(boxMesh); parts.boxes = boxMesh;

  // ---- the craft overhead: the blimp going round, or the helicopter over the race ------------------------------------
  let craft = null;
  const craftPt = (...a) => pt(pts.craft, ...a);
  if (S.craft && S.craft.blimp) craft = makeBlimp(S.craft.blimp, mobile, NIGHT, craftPt);
  else if (S.craft && S.craft.heli) craft = makeHeli(S.craft.heli, mobile, NIGHT, U, craftPt);
  if (craft) { craft.mesh.renderOrder = 1; objects.push(craft.mesh); parts.craft = craft.mesh; }
  // How high what stands on the map is, round (x, z) (0 past its edge): what the helicopter keeps above. A grid of 16
  // voxels square, each the top of the highest brick of 8 in it or in the squares next to it, from the world's table of
  // bricks the first time it is asked (a few milliseconds, and only on a map with a craft that asks). It is not kept up
  // as things are knocked down, so it errs high: never into a tower.
  const CELL = 16, NX = Math.ceil(VX / CELL), NZ = Math.ceil(VZ / CELL), BY = VY >> 3;
  let tops = null;
  const roof = (x, z) => {
    if (!tops) {
      const own = new Float32Array(NX * NZ);
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        let h = 0;
        for (let bz = j * 2; bz < j * 2 + 2; bz++) for (let bx = i * 2; bx < i * 2 + 2; bx++) {
          for (let by = BY - 1; by >= 0 && (by + 1) * 8 > h; by--) if (!brickEmpty(bx, by, bz)) { h = (by + 1) * 8; break; }
        }
        own[i + j * NX] = h;
      }
      tops = new Float32Array(NX * NZ);
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        let h = 0;
        for (let b = Math.max(0, j - 1); b <= Math.min(NZ - 1, j + 1); b++) for (let a = Math.max(0, i - 1); a <= Math.min(NX - 1, i + 1); a++) h = Math.max(h, own[a + b * NX]);
        tops[i + j * NX] = h;
      }
    }
    const i = Math.floor(x / CELL), j = Math.floor(z / CELL);
    return i < 0 || j < 0 || i >= NX || j >= NZ ? 0 : tops[i + j * NX];
  };

  // ---- the lights' points ------------------------------------------------------------------------------------------
  const order = [...pts.lamp, ...pts.blink, ...pts.craft, ...pts.road, ...pts.ave];
  const ptCut = { noAve: pts.lamp.length + pts.blink.length + pts.craft.length + pts.road.length, noRoad: pts.lamp.length + pts.blink.length + pts.craft.length, all: order.length };
  const glow = makePoints(order, { NIGHT, U, craft: craft ? craft.mesh.matrixWorld : null });
  objects.push(glow); parts.points = glow;

  // ---- the skyline round the horizon ------------------------------------------------------------------------------
  {
    const K = S.skyline, W = mobile ? 2048 : 4096, H = 128;
    const canvas = K.paint ? K.paint(W, H, rand) : paintSkyline(W, H, rand, K.scale);
    const band = makeSkyline(canvas, { NIGHT, R: K.R, top: K.top, rep: K.rep, body: K.body });
    objects.push(band); parts.skyline = band;
  }
  // ---- and what the backdrop has of its own -------------------------------------------------------------------------
  for (const [name, o] of Object.entries(S.extra || {})) { objects.push(o); parts[name] = o; }

  for (const o of objects) scene.add(o);
  const counts = { boxes: boxes.length, points: order.length, traffic: pts.road.length + pts.ave.length, ...S.counts };
  boxes.length = 0; order.length = 0; for (const k in pts) pts[k].length = 0;   // (all in the buffers now)
  let q = -1;
  return {
    objects, parts, night: NIGHT, counts,
    step(dt, quality) {
      U.time.value = (U.time.value + dt) % 7200;
      U.vh.value = viewH();
      if (craft) craft.step(dt, U.time.value, follow && follow(), craft.follows ? map.track : null, roof);
      if (S.step) S.step(dt, U.time.value);
      if (quality === q) return;
      q = quality;
      // lower steps: fewer of the far small things, then no avenue traffic, then no traffic at all, then nothing low
      boxMesh.count = q <= 3 ? cut.all : q <= 5 ? cut.near : cut.g1;
      glow.geometry.setDrawRange(0, q <= 3 ? ptCut.all : q === 4 ? ptCut.noAve : ptCut.noRoad);
      U.detail.value = q <= 3 ? 1 : 0;
      if (S.quality) S.quality(q);
    },
  };
}
