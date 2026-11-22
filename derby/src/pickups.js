// Pickups: glowing, spinning things on the ground that a car takes by driving through them, each coming back a while
// after it is taken. Any map can have them: it lists spots as MAP.pickups ([{ kind, x, z }]) and main.js runs them
// (makePickups). The vehicle combat games put the best ones where it is risky to go, so they pull cars into the fight
// (derby/docs/arena.md); where they go is the map's choice.
//   repair   patches up a share of the car's health (only a car that is hurt takes it)
//   nitro    a burst of speed, as the nitro gadget gives (and fills the gadget up, if the car has one)
//   ammo     overcharge: every weapon on the car reloads and fires twice as fast for a few seconds
//   scrap    a crate of scrap for the player (a rival that gets there first only denies it)
//   super    the Hammerdown strike: a red ring locks on to the three nearest foes (the player first, for a rival), follows
//            each for a second, holds still a moment and then a strike comes down on it; a car that gets out of its ring
//            in time is spared. It comes up rarely, and a map can bring it up early (when its show calls an event, say)
//            by setting the spot's `t` to 0.
// A pickup is a little voxel-style model over a ring on the ground, with a beam of its colour going up so it can be seen
// across the map. Rivals go for a repair kit when they are hurt, and take anything they pass close to (pickupFor, for
// ai.js), but never make for a spot the map marks `rivals: false` (a lure for the player alone, say scrap among a
// hazard's blades). Each spot object gets `up` (true while it can be taken) for the map's radar.
import * as THREE from 'three';
import { sparks, ring } from '../../src/sim.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const PICKUPS = {
  repair: { name: 'Repair kit', every: 22, share: 0.35, css: '#4be37a', rgb: [0.3, 1, 0.45] },
  nitro: { name: 'Nitro', every: 14, css: '#45b4ff', rgb: [0.27, 0.7, 1], nitro: { time: 2.6, topK: 1.45, accelK: 2.4 } },
  ammo: { name: 'Overcharge', every: 18, css: '#ff8a2a', rgb: [1, 0.55, 0.16], time: 7, rate: 2 },
  scrap: { name: 'Scrap crate', every: 30, css: '#ffd23a', rgb: [1, 0.82, 0.25], scrap: 60 },
  super: { name: 'Hammerdown strike', every: 70, first: 30, css: '#ff4fd8', rgb: [1, 0.3, 0.85], hits: 3, range: 320, follow: 1.0, still: 0.4, dmg: 55, reach: 13 },
};

// ---- the models ------------------------------------------------------------------------------------------------
// A model drawn in small cubes, CELL to a voxel (three times finer than the boxes the models were first made of, as the
// cars went to a sixth of a voxel), so each pickup reads as a little pixel-art icon. fn(x, y, z) gives the colour of the
// cube whose middle is at (x, y, z), in cells from the model's middle, or 0 for none; R is [x0, x1, y0, y1, z0, z1],
// the cells to look at. Only the faces that no other cube covers are drawn, each a little darker the further it turns
// from the light, and each cube a shade lighter or darker than the next so the grain shows.
const CELL = 3;
const FACES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function cubes(R, fn) {
  const [x0, x1, y0, y1, z0, z1] = R, NX = x1 - x0, NY = y1 - y0, NZ = z1 - z0;
  const grid = new Int32Array(NX * NY * NZ).fill(-1);
  const at = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= NX || j >= NY || k >= NZ ? -1 : grid[(k * NY + j) * NX + i]);
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const c = fn(x0 + i + 0.5, y0 + j + 0.5, z0 + k + 0.5); if (c) grid[(k * NY + j) * NX + i] = c;
  }
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const hex = at(i, j, k); if (hex < 0) continue;
    c.setHex(hex);
    const grain = 0.94 + 0.12 * ((((i * 73856093) ^ (j * 19349663) ^ (k * 83492791)) >>> 0) % 100) / 100;
    for (const [nx, ny, nz] of FACES) {
      if (at(i + nx, j + ny, k + nz) >= 0) continue;
      const kk = (0.75 + 0.25 * Math.max(ny, Math.abs(nx) * 0.6, 0)) * grain;
      // the face's four corners, from the cube's middle out along the normal
      const cx = x0 + i + 0.5 + nx * 0.5, cy = y0 + j + 0.5 + ny * 0.5, cz = z0 + k + 0.5 + nz * 0.5;
      const [ux, uy, uz] = nx ? [0, 0.5, 0] : [0.5, 0, 0], [vx, vy, vz] = nz ? [0, 0.5, 0] : [0, 0, 0.5];
      // (wound so the face looks out along the normal)
      const flip = (nx + ny + nz) < 0 !== !!ny;
      const q = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
      for (const [a, b0] of q) {
        const b = flip ? -b0 : b0;
        pos.push((cx + ux * a + vx * b) / CELL, (cy + uy * a + vy * b) / CELL, (cz + uz * a + vz * b) / CELL);
        nor.push(nx, ny, nz); col.push(c.r * kk, c.g * kk, c.b * kk);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const inBox = (x, y, z, ax, bx, ay, by, az, bz) => x > ax && x < bx && y > ay && y < by && z > az && z < bz;
// a pixel bitmap on a face: rows top to bottom, '#' for a pixel; (u, v) from the bitmap's middle, in cells
const bitmap = (rows) => (u, v) => { const r = rows[Math.floor(rows.length / 2 - v)], ch = r && r[Math.floor(u + r.length / 2)]; return ch === '#'; };
const BOLT = bitmap(['....##', '...##.', '..##..', '.#####', '...##.', '..##..', '.##...', '##....']);
const MODELS = {
  // a first-aid case: white with a grey rim, a raised green cross on both faces (outlined darker), latches and a handle
  repair: () => cubes([-9, 9, -8, 10, -5, 5], (x, y, z) => {
    const ax = Math.abs(x), az = Math.abs(z);
    const cross = (ax < 6 && Math.abs(y + 0.5) < 2) || (ax < 2 && Math.abs(y + 0.5) < 6), ring = !cross && ((ax < 7 && Math.abs(y + 0.5) < 3) || (ax < 3 && Math.abs(y + 0.5) < 7));
    if (az > 4) return cross ? 0x2fd35a : 0;
    if (y > 7) {   // the handle on top
      if (az > 1.5) return 0;
      return (y < 8 && ax > 2.5 && ax < 4) || (y > 8 && y < 9 && ax < 4) ? 0x4e535a : 0;
    }
    if (!inBox(x, y, z, -9, 9, -8, 7, -4, 4)) return 0;
    if (az > 3) { if (cross) return 0x26b84c; if (ring) return 0x177a35; if (y > 5 && y < 6 && ax > 4 && ax < 7) return 0x8a8f96; }
    const edges = (ax > 8) + (y > 6 || y < -7) + (az > 3);
    return edges >= 2 ? 0xc2c6cc : 0xf2f2ee;
  }),
  // a nitro bottle: a blue cylinder with a light stripe down one side, a white band with a red stripe round it, a
  // darker foot, a silver neck and a red valve with its T handle
  nitro: () => cubes([-5, 5, -10, 12, -5, 5], (x, y, z) => {
    const r = Math.hypot(x, z), lit = x - z > 3.2;
    if (y < -9) return r < 4 ? 0x1d5aa8 : 0;
    if (y < 6) {
      if (r >= 4.7) return 0;
      if (y > -4.5 && y < -1.5) return y > -3.5 && y < -2.5 ? 0xe0402a : 0xf2f2ee;
      return y < -8 ? 0x1d5aa8 : lit ? 0x62b2ff : 0x2b7fe0;
    }
    if (y < 7.5) return r < 3.6 ? (lit ? 0x62b2ff : 0x2b7fe0) : 0;
    if (y < 9.5) return r < 2.4 ? (y < 8.2 ? 0x8d96a0 : 0xd0d8e0) : 0;
    if (y < 11) return r < 1.6 || (y > 10 && Math.abs(z) < 0.8 && Math.abs(x) < 4.5) ? 0xe0402a : 0;
    return r < 0.9 ? 0xff7a5a : 0;
  }),
  // overcharge: three shells, brass cases with a lit edge, a groove and a rim at the foot, and copper tips
  ammo: () => cubes([-10, 10, -11, 10, -4, 4], (x, y, z) => {
    for (const sx of [-6, 0, 6]) {
      const dx = x - sx, r = Math.hypot(dx, z), lit = dx - z > 1.2;
      if (y < -9) { if (r < 2.9) return 0xa87a22; continue; }
      if (y < 3.5) { if (r < 2.5) return y > -7.6 && y < -6.6 ? 0x9a7020 : lit ? 0xf2d070 : 0xd9a840; continue; }
      const t = (y - 3.5) / 6.5; if (t < 1 && r < 2.4 * (1 - t * t) + 0.4) return lit ? 0xec9060 : 0xc8683a;
    }
    return 0;
  }),
  // a crate of scrap: gold boards with dark edges and corner bolts, and a pale cog raised on each side
  scrap: () => cubes([-9, 9, -8, 8, -9, 9], (x, y, z) => {
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    // the cog, on the four sides: a toothed ring round a hub
    const cog = (u, v) => { const r = Math.hypot(u, v), a = Math.atan2(v, u); return (r < 1.3) || (r > 2.2 && r < 3.3) || (r >= 3.3 && r < 4.4 && Math.cos(a * 8) > 0.3); };
    if (ax > 7.5 || az > 7.5) {
      if (ay > 7.5 || (ax > 7.5 && az > 7.5)) return 0;
      if (ax > 7.5 && ax < 8.5 && az < 5) return cog(z, y) ? 0xfff0b0 : 0;
      if (az > 7.5 && az < 8.5 && ax < 5) return cog(x, y) ? 0xfff0b0 : 0;
      return 0;
    }
    if (ay > 7.5) return 0;
    const edges = (ax > 6) + (ay > 6) + (az > 6);
    if (edges >= 2) return (ax > 6) + (ay > 6) + (az > 6) === 3 ? 0xfff0b0 : 0x6a4a1e;
    return Math.abs(((ay > 6 ? x + z : y) + 8) % 5) < 0.6 ? 0xc99a26 : 0xe8b830;   // the boards' joins
  }),
  // the Hammerdown strike: a sledgehammer, a wrapped wooden handle with a gold knob, a pink head with gold bands,
  // a lit top edge and a yellow bolt on each face
  super: () => cubes([-12, 12, -15, 16, -7, 7], (x, y, z) => {
    const r = Math.hypot(x, z), ax = Math.abs(x), az = Math.abs(z);
    if (y < 5) {
      if (y < -12) return r < 2.4 ? 0xffd23a : 0;
      if (r >= 1.9) return 0;
      return y < -4 && ((y + 13) % 3) < 1 ? 0x2a1c10 : x - z > 0.8 ? 0x6a4c30 : 0x4a3420;
    }
    if (y > 15.5) return 0;
    if (ax > 8.5) return ax < 11.5 && az < 6 && y > 4.5 ? 0xffd23a : 0;
    if (az > 5 && az < 6.2 && BOLT(x, y - 10)) return 0xffe24a;
    if (az > 5) return 0;
    if (y > 14) return 0xff86ce;
    return (az > 4 && (y < 6 || y > 13)) ? 0xc8247e : 0xff3da8;
  }),
};
// a beam of light: brightest at the foot, fading out up top
let beamTex = null;
function beamTexture() {
  if (beamTex) return beamTex;
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64;
  const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0.9)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
  return (beamTex = new THREE.CanvasTexture(cv));
}

// ---- which pickup a rival should go for --------------------------------------------------------------------------
let all = [];
// hurt: the nearest repair kit that is up (within reach); otherwise the strike if it is up and not far; otherwise
// anything up close and nearly straight ahead
export function pickupFor(car, hurt) {
  let best = null, bd = 1e9;
  for (const p of all) {
    if (!p.up || p.rivals === false) continue;
    const d = Math.hypot(p.x - car.x, p.z - car.z);
    if (hurt && p.kind === 'repair' && d < 340) { if (d < bd) { bd = d; best = p; } continue; }
    if (best && best.kind === 'repair' && hurt) continue;
    if (p.kind === 'super' && d < 170) { if (d + 200 < bd) { bd = d + 200; best = p; } continue; }
    if (d < 50 && (p.kind !== 'repair' || car.hp < car.maxHp * 0.85) && Math.abs(wrap(Math.atan2(p.x - car.x, p.z - car.z) - car.yaw)) < 0.6 && d + 400 < bd) { bd = d + 400; best = p; }
  }
  return best;
}

// ---- running them -------------------------------------------------------------------------------------------------
export function makePickups(api, spots = []) {
  const { scene, cars } = api;
  all = spots;
  const geo = {}, ringGeo = new THREE.RingGeometry(4.2, 5.6, 32), beamGeo = new THREE.CylinderGeometry(1.6, 2.4, 70, 12, 1, true);
  beamGeo.translate(0, 35, 0);
  for (const p of spots) {
    const K = PICKUPS[p.kind]; if (!K) continue;
    const glow = new THREE.Color(K.rgb[0] * 2.2, K.rgb[1] * 2.2, K.rgb[2] * 2.2);
    p.K = K; p.up = !K.first; p.t = K.first || 0; p.spin = Math.random() * 6;
    p.model = new THREE.Mesh(geo[p.kind] || (geo[p.kind] = MODELS[p.kind]()), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.25, 1.25, 1.25), toneMapped: false }));
    p.model.position.set(p.x, 6, p.z); p.model.castShadow = true;
    p.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    p.ring.rotation.x = -Math.PI / 2; p.ring.position.set(p.x, 0.12, p.z); p.ring.renderOrder = 3;
    p.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...K.rgb), map: beamTexture(), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    p.beam.position.set(p.x, 0, p.z); p.beam.renderOrder = 3;
    scene.add(p.model, p.ring, p.beam);
    if (!p.up) p.model.visible = p.beam.visible = false;
  }
  const live = spots.filter((p) => p.K);
  // what taking one does
  function take(p, c) {
    const K = p.K, me = c === api.player;
    if (p.kind === 'repair') {
      const n = Math.min(c.maxHp - c.hp, c.maxHp * K.share); c.hp += n;
      api.sfx.play('ui_equip', me ? 1 : 0.6, c.x, c.z); api.sfx.play('servo', me ? 0.8 : 0.5, c.x, c.z);
      if (me) api.toast(K.name, `+${Math.round(n)} armour`);
    } else if (p.kind === 'nitro') {
      const own = c.gadget && c.gadget.nitro;
      if (own) c.gadgetT = 0; else c.padNitro = K.nitro;   // main.js's gadget code burns padNitro when the car has no nitro of its own
      c.boostT = Math.max(c.boostT || 0, (own || K.nitro).time);
      api.sfx.play('nitro', me ? 1 : 0.7, c.x, c.z);
      if (me) api.toast(K.name, own ? 'Nitro filled up' : 'A burst of speed');
    } else if (p.kind === 'ammo') {
      c.overT = K.time;
      api.sfx.play('reload', me ? 1 : 0.6, c.x, c.z);
      if (me) api.toast(K.name, `Every gun fires twice as fast for ${K.time} seconds`);
    } else if (p.kind === 'scrap') {
      if (me) { api.game.scrap += K.scrap; api.keepSave(); api.toast(K.name, `+${K.scrap} scrap`); }
      api.sfx.play('ui_coin', me ? 1 : 0.5, c.x, c.z);
    } else if (p.kind === 'super') strike(c, K);
    const [r, g, b] = K.rgb;
    sparks(p.x, 5, p.z, 22, r, g, b, 22); ring(p.x, 0.4, p.z, 9, new THREE.Color(r, g, b), 0.45);
    p.up = false; p.t = K.every * (0.9 + Math.random() * 0.2);
    // online (net.js): the other devices see it go, to the same car, and it is back on all of them at once
    if (api.net && !c.remote) api.net.picked(live.indexOf(p), c, p.t);
  }
  // ---- the Hammerdown strike: a ring on each foe, then a strike from above on wherever the ring stopped
  const marks = [], markGeo = new THREE.RingGeometry(0.82, 1, 40), shaftGeo = new THREE.CylinderGeometry(1.4, 1.4, 90, 10, 1, true);
  shaftGeo.translate(0, 45, 0);
  function strike(c, K) {
    const me = c === api.player, P = api.player;
    const foes = cars.filter((o) => o !== c && !o.dead && !o.gone && Math.hypot(o.x - c.x, o.z - c.z) < K.range).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z));
    // a rival's strike always has the player in it (but not in the arena's free-for-all, where the player is one car of eight)
    if (!me && P && foes.includes(P) && api.MAP.mode !== 'brawl') { foes.splice(foes.indexOf(P), 1); foes.unshift(P); }
    for (const o of foes.slice(0, K.hits)) {
      const rm = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.9), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
      const sm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.25, 0.75), map: beamTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
      const r = new THREE.Mesh(markGeo, rm), s = new THREE.Mesh(shaftGeo, sm);
      r.rotation.x = -Math.PI / 2; r.renderOrder = 3; s.renderOrder = 3; scene.add(r, s);
      marks.push({ car: o, by: c, t: K.follow + K.still, x: o.x, z: o.z, r, s, K });
    }
    api.sfx.play('mine_beep', me ? 1.2 : 0.8, c.x, c.z); api.sound('c.alarm', 0.8);
    if (me) api.toast(K.name, foes.length ? `Locked on to ${Math.min(K.hits, foes.length)}` : 'Nobody in range');
    else if (foes.slice(0, K.hits).includes(P)) api.toast('Strike incoming!', 'Get out of the red ring');
  }
  function stepMarks(dt) {
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i], K = m.K;
      m.t -= dt;
      if (m.t > K.still && m.car && !m.car.gone) { m.x = m.car.x; m.z = m.car.z; }   // following, then still for a moment
      const k = Math.max(0, m.t) / (K.follow + K.still);
      m.r.position.set(m.x, 0.2, m.z); m.r.scale.setScalar(K.reach * (0.75 + 0.6 * k)); m.r.material.opacity = m.t > K.still ? 0.55 + 0.35 * ((m.t * 8 | 0) & 1) : 1;
      m.s.position.set(m.x, 0, m.z); m.s.material.opacity = 0.75 * (1 - k);
      if (m.t > 0) continue;
      // down it comes
      scene.remove(m.r, m.s); m.r.material.dispose(); m.s.material.dispose(); marks.splice(i, 1);
      api.explode(m.x, 2, m.z, 4.6, 0.8, { maxDebris: 160, fire: true });
      api.sfx.play('bigboom', 1, m.x, m.z); api.sound('thunder', 0.8, m.x, 20, m.z);
      sparks(m.x, 2, m.z, 40, 1, 0.4, 0.9, 40); ring(m.x, 0.4, m.z, K.reach * 1.4, new THREE.Color(1, 0.3, 0.85), 0.5);
      for (const o of cars) {
        if (o.dead || o.gone) continue;
        const d = Math.hypot(o.x - m.x, o.z - m.z); if (d > K.reach + o.wide) continue;
        const f = 1 - Math.max(0, d - 3) / K.reach;
        api.damage(o, K.dmg * f, m.by && m.by !== o ? m.by : null);
        const p = Math.max(1, d); o.vx += (o.x - m.x) / p * 30 * f; o.vz += (o.z - m.z) / p * 30 * f;
      }
      const P = api.player; if (P) api.game.shake = Math.min(1.4, api.game.shake + Math.max(0, 1 - Math.hypot(P.x - m.x, P.z - m.z) / 160) * 0.9);
    }
  }
  const _o = { x: 0, z: 0 };
  return {
    spots: live,
    // online: pickup i was taken on another device, by car c (one of ours there, a puppet here) or by nobody we know
    taken(i, c, t) {
      const p = live[i]; if (!p) return;
      if (p.up) { if (c) take(p, c); else p.up = false; }
      p.up = false; p.model.visible = p.beam.visible = false; if (t > 0) p.t = t;
    },
    step(dt, on) {
      stepMarks(dt);
      const T = performance.now() / 1000;
      for (const p of live) {
        if (!p.up) {
          p.t -= dt;
          // coming back: the ring fills in and brightens over the last few seconds
          const k = Math.max(0, 1 - p.t / 4);
          p.ring.material.opacity = 0.12 + 0.4 * k; p.ring.scale.setScalar(0.4 + 0.6 * k);
          if (p.t <= 0) {
            p.up = true; p.model.visible = p.beam.visible = true; p.ring.scale.setScalar(1);
            const [r, g, b] = p.K.rgb; ring(p.x, 0.4, p.z, 7, new THREE.Color(r, g, b), 0.4); sparks(p.x, 4, p.z, 10, r, g, b, 14);
          }
          continue;
        }
        p.model.visible = p.beam.visible = true;
        p.spin += dt * 2.2; p.model.rotation.y = p.spin; p.model.position.y = 6 + Math.sin(T * 2.6 + p.x) * 0.8;
        p.ring.material.opacity = 0.55 + 0.3 * Math.sin(T * 4 + p.z);
        // (the beam fades out as the camera comes up to it, so the camera never sits in a wall of light)
        const near = Math.min(1, Math.max(0, (Math.hypot(api.camera.position.x - p.x, api.camera.position.z - p.z) - 3) / 10));
        p.beam.material.opacity = (0.32 + 0.1 * Math.sin(T * 3 + p.x)) * near;
        if (!on) continue;
        // taken by the first car whose box it is in
        for (const c of cars) {
          if (c.dead || c.gone || c.remote) continue;   // (someone else's car takes it on its own device: taken())
          const s = Math.sin(c.yaw), co = Math.cos(c.yaw); _o.x = p.x - c.x; _o.z = p.z - c.z;
          const lx = _o.x * co - _o.z * s, lz = _o.x * s + _o.z * co - c.mid;
          if (Math.abs(lx) > c.wide + 3 || Math.abs(lz) > c.half + 3) continue;
          if (p.kind === 'repair' && c.hp >= c.maxHp - 0.5) continue;
          take(p, c); p.model.visible = p.beam.visible = false; break;
        }
      }
      // overcharge: shave the reload off every weapon of a car that has it, and a few sparks off its roof
      for (const c of cars) {
        if (!(c.overT > 0)) continue;
        c.overT -= dt;
        if (c.dead) { c.overT = 0; continue; }
        for (const G of c.guns) G.t = Math.max(0, G.t - dt * (PICKUPS.ammo.rate - 1));
        if (Math.random() < dt * 8) sparks(c.x, c.top + 1, c.z, 2, 1, 0.55, 0.15, 8);
        if (c.overT <= 0 && c === api.player) api.toast('Overcharge over', '');
      }
    },
  };
}
