// Pickups: glowing, spinning things on the ground that a car takes by driving through them, each coming back a while
// after it is taken. Any map can have them: it lists spots as MAP.pickups ([{ kind, x, z }]) and main.js runs them
// (makePickups). The vehicle combat games put the best ones where it is risky to go, so they pull cars into the fight
// (derby/docs/arena.md); where they go is the map's choice.
//   repair   patches up a share of the car's health (only a car that is hurt takes it)
//   nitro    a burst of speed, as the nitro gadget gives (and fills the gadget up, if the car has one)
//   ammo     overcharge: every weapon on the car reloads and fires twice as fast for a few seconds
//   scrap    a crate of scrap for the player (a rival that gets there first only denies it)
// A pickup is a little voxel-style model over a ring on the ground, with a beam of its colour going up so it can be seen
// across the map. Rivals go for a repair kit when they are hurt, and take anything they pass close to (pickupFor, for
// ai.js). Each spot object gets `up` (true while it can be taken) for the map's radar.
import * as THREE from 'three';
import { sparks, ring } from '../../src/sim.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const PICKUPS = {
  repair: { name: 'Repair kit', every: 22, share: 0.35, css: '#4be37a', rgb: [0.3, 1, 0.45] },
  nitro: { name: 'Nitro', every: 14, css: '#45b4ff', rgb: [0.27, 0.7, 1], nitro: { time: 2.6, topK: 1.45, accelK: 2.4 } },
  ammo: { name: 'Overcharge', every: 18, css: '#ff8a2a', rgb: [1, 0.55, 0.16], time: 7, rate: 2 },
  scrap: { name: 'Scrap crate', every: 30, css: '#ffd23a', rgb: [1, 0.82, 0.25], scrap: 60 },
};

// ---- the models ------------------------------------------------------------------------------------------------
// a model from boxes [x0, y0, z0, x1, y1, z1, colour] (in voxels, round the model's middle), as one geometry with colours
function blocks(list) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [x0, y0, z0, x1, y1, z1, hex] of list) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).toNonIndexed(); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    c.setHex(hex);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i));
      const k = 0.75 + 0.25 * Math.max(n.getY(i), Math.abs(n.getX(i)) * 0.6, 0);   // faces a little darker the further they turn from the light
      col.push(c.r * k, c.g * k, c.b * k);
    }
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const MODELS = {
  // a white case with a green cross on both faces
  repair: () => blocks([[-3, -2.6, -1.2, 3, 2.6, 1.2, 0xf2f2ee], [-2.4, -0.7, -1.5, 2.4, 0.7, 1.5, 0x2fd35a], [-0.7, -2.1, -1.5, 0.7, 2.1, 1.5, 0x2fd35a], [-1, 2.6, -0.4, 1, 3.3, 0.4, 0x8a8f96]]),
  // a blue bottle with a silver neck and a red valve
  nitro: () => blocks([[-1.5, -3, -1.5, 1.5, 2, 1.5, 0x2b7fe0], [-1.55, -1.2, -1.55, 1.55, -0.4, 1.55, 0xf2f2ee], [-0.9, 2, -0.9, 0.9, 3, 0.9, 0xc3ccd6], [-0.5, 3, -0.5, 0.5, 3.8, 0.5, 0xe0402a], [-1.4, 3.2, -0.3, 1.4, 3.6, 0.3, 0xe0402a]]),
  // three rounds: brass cases and copper tips
  ammo: () => blocks([-2.2, 0, 2.2].flatMap((x) => [[x - 0.8, -3, -0.8, x + 0.8, 1.2, 0.8, 0xd9a840], [x - 0.6, 1.2, -0.6, x + 0.6, 2.6, 0.6, 0xc8683a], [x - 0.35, 2.6, -0.35, x + 0.35, 3.1, 0.35, 0xc8683a], [x - 0.85, -3.2, -0.85, x + 0.85, -2.7, 0.85, 0xb88a2a]])),
  // a gold crate with dark edges
  scrap: () => blocks([[-2.5, -2.5, -2.5, 2.5, 2.5, 2.5, 0xe8b830], ...[-2.6, 2.1].flatMap((a) => [[a, -2.6, -2.6, a + 0.5, 2.6, 2.6, 0x6a4a1e], [-2.6, a, -2.6, 2.6, a + 0.5, 2.6, 0x6a4a1e]]), [-0.6, -0.6, -2.7, 0.6, 0.6, 2.7, 0xfff0b0]]),
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
// hurt: the nearest repair kit that is up (within reach); otherwise anything up close and nearly straight ahead
export function pickupFor(car, hurt) {
  let best = null, bd = 1e9;
  for (const p of all) {
    if (!p.up) continue;
    const d = Math.hypot(p.x - car.x, p.z - car.z);
    if (hurt && p.kind === 'repair' && d < 340) { if (d < bd) { bd = d; best = p; } continue; }
    if (best && best.kind === 'repair' && hurt) continue;
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
    p.K = K; p.up = true; p.t = 0; p.spin = Math.random() * 6;
    p.model = new THREE.Mesh(geo[p.kind] || (geo[p.kind] = MODELS[p.kind]()), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.25, 1.25, 1.25), toneMapped: false }));
    p.model.position.set(p.x, 6, p.z); p.model.castShadow = true;
    p.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    p.ring.rotation.x = -Math.PI / 2; p.ring.position.set(p.x, 0.12, p.z); p.ring.renderOrder = 3;
    p.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...K.rgb), map: beamTexture(), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    p.beam.position.set(p.x, 0, p.z); p.beam.renderOrder = 3;
    scene.add(p.model, p.ring, p.beam);
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
    }
    const [r, g, b] = K.rgb;
    sparks(p.x, 5, p.z, 22, r, g, b, 22); ring(p.x, 0.4, p.z, 9, new THREE.Color(r, g, b), 0.45);
    p.up = false; p.t = K.every * (0.9 + Math.random() * 0.2);
  }
  const _o = { x: 0, z: 0 };
  return {
    spots: live,
    step(dt, on) {
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
        p.beam.material.opacity = 0.32 + 0.1 * Math.sin(T * 3 + p.x);
        if (!on) continue;
        // taken by the first car whose box it is in
        for (const c of cars) {
          if (c.dead || c.gone) continue;
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
