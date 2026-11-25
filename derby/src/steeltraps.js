// Meltdown Steelworks' traps and its robots at their work (maps/steel.js makes them in a custom hazard and steps them).
//   makeLadle(api, G, S)   a ladle of molten steel on chains under the travelling crane: the bridge runs to and fro
//                          along the hall and the ladle swings across under it, low enough at the bottom of its swing
//                          to bat a car across the floor. Its glow lies on the floor under it.
//   makePour(api, P, S)    the runner across the floor. The furnace robot tips the crucible (a warning: lamps along the
//                          runner, a beep), the steel runs the length of it, burns for a while and runs out. A car in
//                          it burns; one on a plate bridge, or in the air over it, does not.
//   makeSmith(api, F, S)   the robot smith's hammer on the forge plate: he lifts it, it shudders, it comes down. What
//                          is under it is hit hard and thrown out; what is near is shoved.
//   makeWorks(api, W)      the three robots, the crucible, the hammer, the cradle and the hall: all to look at, and
//                          the handles the traps move (the crucible's tip, the smith's arm)
// A trap sets its own state on its spec for the map's route grid and radar: G.x, G.s, G.low; P.on, P.hot (and hot0,
// hot1); F.danger, F.low.
import * as THREE from 'three';
import { TRAP } from './hazards.js';
import { fire, sparks, dust, dustWave, puff, ring } from '../../src/sim.js';
import { ladleGeo, crucibleGeo, sledgeGeo, bridgeGeo, makeBoxes, hallShell, hallSteel, pendant, furnace, cradle, steelMat, steelLit, HOT, WARM, WELD } from './steelkit.js';
import { makeBot } from './steelbots.js';

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = (t) => t * t * (3 - 2 * t);
const _e = [[0, 0], [0, 0]];
const kitMeshes = (g, parent, shadow = false) => {
  const a = new THREE.Mesh(g.paint, steelMat()), b = new THREE.Mesh(g.lit, steelLit());
  a.castShadow = shadow; parent.add(a, b); return [a, b];
};
// a soft round glow lying on the floor (the hot metal's light): one texture for all of them
let glowTex = null;
function floorGlow(r, rgb) {
  if (!glowTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(cv);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * r, 2 * r), new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(rgb[0], rgb[1], rgb[2]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.12; m.renderOrder = 2; return m;
}
const airborne = (api, c) => c.y - (api.MAP.floor ? api.MAP.floor(c.x, c.z, c.y) : 0) > 1.6;

// ---- the ladle ----------------------------------------------------------------------------------------------------------
// G.ladles: [{ z, phase }], one or more on the one bridge (each swings about its own z, in its own time); the first is
// also G.s, G.low and G.head, and each has its own s, low and head.
export function makeLadle(api, G, S) {
  const L = G.len, R = G.r ?? 9, DMG = G.dmg ?? 26, A0 = G.amp ?? 0.62, A1 = G.wildAmp ?? 0.86, PER = G.period ?? 5.2;
  const LS = G.ladles || (G.ladles = [{ z: G.z, phase: G.phase ?? 0 }]);
  const bridge = new THREE.Group(); bridge.position.set(G.x0, G.rail, 0); api.scene.add(bridge);
  kitMeshes(bridgeGeo({ z0: G.hall.z0, z1: G.hall.z1, zs: LS.map((l) => l.z) }), bridge);
  const geo = ladleGeo(L);
  for (const l of LS) {
    const pivot = new THREE.Group(); pivot.position.set(0, G.y - G.rail, l.z); bridge.add(pivot);
    l.swing = new THREE.Group(); pivot.add(l.swing);
    const [body] = kitMeshes(geo, l.swing, true); body.castShadow = true;
    l.glow = floorGlow(26, [1.5, 0.6, 0.12]); api.scene.add(l.glow);
    l.ph = l.phase ?? 0; l.creak = 0; l.s = 0; l.low = false; l.head = { x: G.x0, z: l.z }; l.hitAt = new WeakMap();
  }
  let amp = A0, dir = 1, wait = 0, clock = 0, toastT = 0;
  G.x = G.x0; G.s = 0; G.low = false; G.head = LS[0].head;
  return {
    step(dt, live) {
      clock += dt;
      const wild = TRAP.wildIn(G, S);
      // the bridge: along the hall and back, a pause at each end
      if (wait > 0) wait -= dt;
      else { G.x += dir * (wild ? G.speed * 1.8 : G.speed) * dt; if (G.x > G.x1) { G.x = G.x1; dir = -1; wait = wild ? 0.4 : 1.6; } else if (G.x < G.x0) { G.x = G.x0; dir = 1; wait = wild ? 0.4 : 1.6; } }
      amp += ((wild ? A1 : A0) - amp) * Math.min(1, dt * 0.8);
      const w = TAU / (wild ? PER * 0.85 : PER);
      bridge.position.x = G.x;
      for (const l of LS) {
        l.ph += dt * w;
        const th = amp * Math.sin(l.ph), dth = amp * Math.cos(l.ph) * w;
        const s = L * Math.sin(th), by = G.y - L * Math.cos(th), speed = Math.abs(dth) * L, hx = G.x, hz = l.z + s;
        l.swing.rotation.x = -th;
        l.s = s; l.low = by < 5.5; l.head.x = hx; l.head.z = hz;
        const glow = l.glow; glow.position.x = hx; glow.position.z = hz; const k = clamp(1.25 - by / 16, 0.25, 1); glow.scale.setScalar(0.7 + 0.5 * (1 - k)); glow.material.opacity = 0.75 * k;
        if ((l.creak -= dt) <= 0 && Math.abs(th) > amp * 0.96) { l.creak = PER * 0.4; api.sound('creak', 0.5, hx, G.y, l.z); }
        if (l.low && Math.random() < dt * 9 * TRAP.busy(api)) sparks(hx + (Math.random() - 0.5) * R, by + 3, hz + (Math.random() - 0.5) * R, 2, 1, 0.6, 0.2, 9);
        if (!live || speed < 6) continue;
        for (const c of api.cars) {
          if (c.gone || by > c.top - 0.3 || by + 22 < c.y) continue;
          TRAP.ends(c, _e);
          let hit = Math.hypot(c.x - hx, c.z - hz) < R + c.wide;
          for (const [ex, ez] of _e) if (Math.hypot(ex - hx, ez - hz) < R + c.wide * 0.8) hit = true;
          if (!hit || !TRAP.fresh(l.hitAt, c, clock, 1)) continue;
          const sd = Math.sign(dth) || 1, f = Math.max(38, speed * 1.2);
          TRAP.knock(c, dir * (wait > 0 ? 0 : 6), sd * f, 0.42);
          if (c.dead) continue;
          api.damage(c, DMG * (0.6 + 0.4 * Math.min(1, speed / 42)), null);
          sparks(c.x, 4, c.z - sd * c.wide, Math.round(30 * TRAP.busy(api)), 1, 0.7, 0.3, 32); fire(c.x, 4, c.z, Math.round(5 * TRAP.busy(api)), 3);
          api.sound('c.clang', 1.2, hx, 4, hz); api.sfx.play('crunch_heavy', 1, hx, hz, { gap: 0.1 }); api.sound('c.thud', 1, hx, 2, hz);
          TRAP.shake(api, 0.8, hx, hz);
          if (c === api.player && clock > toastT) { toastT = clock + 4; api.toast('Clocked by the ladle!', 'They swing across under the crane: watch their glow on the floor'); }
        }
      }
      G.s = LS[0].s; G.low = LS.some((l) => l.low);
    },
  };
}

// ---- the pour -------------------------------------------------------------------------------------------------------------
export function makePour(api, P, S) {
  const W = P.x1 - P.x0, LEN = P.z1 - P.z0, WARN = P.warn ?? 2.4, BURN = P.burn ?? 6.5, REST = P.rest ?? 17, SPEED = P.speed ?? 130, DPS = P.dps ?? 30;
  const tex = TRAP.canvasTex(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#7a1c04'); gr.addColorStop(0.18, '#f06a10'); gr.addColorStop(0.5, '#ffe9a0'); gr.addColorStop(0.82, '#f06a10'); gr.addColorStop(1, '#7a1c04');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.fillStyle = i % 3 ? 'rgba(120,30,6,0.5)' : 'rgba(255,250,220,0.55)'; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 7, 8 + Math.random() * 40); }
    for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(40,14,6,0.7)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 5, 6 + Math.random() * 14, 0, 0, TAU); g.fill(); }
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(2.3, 1.7, 1.2), toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, 0.5);   // (from z 0 to 1, to be stretched)
  const strip = new THREE.Mesh(geo, mat); strip.position.set((P.x0 + P.x1) / 2, 0.07, P.z0); strip.visible = false; api.scene.add(strip);
  const halo = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: (floorGlow(1, [1, 1, 1]), glowTex), color: new THREE.Color(0.9, 0.3, 0.05), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  halo.position.set((P.x0 + P.x1) / 2, 0.1, P.z0); halo.visible = false; halo.renderOrder = 2; api.scene.add(halo);
  // the lamps along the runner, both sides: dark, or blinking as it is about to run
  const [lampOff, lampOn] = TRAP.lampMats(3, 1.1, 0.15), lampGeo = new THREE.BoxGeometry(1.2, 1.1, 1.2), lamps = [];
  for (let z = P.z0 + 14; z < P.z1 - 6; z += 36) {
    if (P.bridges.some(([a, b]) => z > a - 4 && z < b + 4) || (P.skip && P.skip(z))) continue;
    for (const x of [P.x0 - 2.6, P.x1 + 2.6]) { const l = new THREE.Mesh(lampGeo, lampOff); l.position.set(x, 0.55, z); api.scene.add(l); lamps.push(l); }
  }
  // the plates across it: chequer plate lying just over the steel, so the stream runs under them
  const plateTex = TRAP.canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#6a727a'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(205,212,220,0.35)'; for (let j = 0; j < h; j += 8) for (let i = (j / 8) & 1 ? 4 : 0; i < w; i += 8) g.fillRect(i, j + 2, 4, 2); });
  for (const [a, b] of P.bridges) {
    plateTex.repeat.set((W + 14) / 8, (b - a) / 8);
    const m = new THREE.Mesh(new THREE.BoxGeometry(W + 14, 0.24, b - a), new THREE.MeshLambertMaterial({ map: plateTex, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 })); m.position.set((P.x0 + P.x1) / 2, 0.1, (a + b) / 2); m.receiveShadow = true; api.scene.add(m);
    for (const z of [a - 0.8, b + 0.8]) { const e = new THREE.Mesh(new THREE.BoxGeometry(W + 14, 0.3, 1.6), new THREE.MeshLambertMaterial({ color: 0xe2b02a, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 })); e.position.set((P.x0 + P.x1) / 2, 0.1, z); api.scene.add(e); }
  }
  let phase = 'rest', T = P.first ?? 9, head = 0, tail = 0, clock = 0, beep = 0, toastT = 0, hiss = 0;
  const burnAt = new WeakMap();
  P.on = false; P.hot = false; P.hot0 = P.z0; P.hot1 = P.z0; P.tip = 0; P.pouring = false;
  const onBridge = (z) => P.bridges.some(([a, b]) => z > a && z < b);
  return {
    step(dt, live) {
      clock += dt; T -= dt;
      const wild = TRAP.wildIn(P, S);
      if (phase === 'rest') {
        if (wild && T > 0.5) T = 0.5;
        P.tip = Math.max(0, P.tip - dt * 0.7);
        if (T <= 0) { phase = 'warn'; T = WARN; api.sound('c.alarm', 0.8, (P.x0 + P.x1) / 2, 10, P.z0 + 40); }
      } else if (phase === 'warn') {
        P.tip = Math.min(1, P.tip + dt / WARN);
        if ((beep -= dt) <= 0) { beep = 0.28; api.sfx.play('mine_beep', 1.1, (P.x0 + P.x1) / 2, (P.z0 + P.z1) / 2); }
        if (T <= 0) { phase = 'flow'; T = BURN; head = 0; tail = 0; api.sound('c.hiss', 1.2, (P.x0 + P.x1) / 2, 4, P.z0 + 20); api.sound('rumble', 0.7, (P.x0 + P.x1) / 2, 4, P.z0 + 60); }
      } else if (phase === 'flow') {
        head = Math.min(LEN, head + SPEED * dt);
        if (wild) T = Math.max(T, 1);   // (it runs for as long as the furnace is tapped)
        if (T <= 0) { phase = 'drain'; }
      } else {
        P.tip = Math.max(0, P.tip - dt * 0.9);
        tail = Math.min(LEN, tail + SPEED * 1.3 * dt);
        if (tail >= LEN) { phase = 'rest'; T = REST; head = tail = 0; }
      }
      P.pouring = phase === 'flow'; P.hot = head > tail; P.on = phase !== 'rest'; P.hot0 = P.z0 + tail; P.hot1 = P.z0 + head; P.phase = phase;
      strip.visible = halo.visible = P.hot;
      if (P.hot) {
        const len = head - tail;
        strip.position.z = P.z0 + tail; strip.scale.set(W - 1.6, 1, len); tex.repeat.set(1, len / 60); tex.offset.y += dt * 1.6;
        halo.position.z = P.z0 + tail - 6; halo.scale.set(W * 4.2, 1, len + 12);
        const n = TRAP.busy(api) * len * dt * 0.07;
        for (let i = Math.random() < n % 1 ? Math.ceil(n) : Math.floor(n); i > 0; i--) {
          const z = P.z0 + tail + Math.random() * len; if (onBridge(z)) continue;
          sparks((P.x0 + P.x1) / 2 + (Math.random() - 0.5) * W, 0.6, z, 2, 1, 0.65, 0.2, 12);
          if (Math.random() < 0.3) puff((P.x0 + P.x1) / 2, 1, z, 0, 5, 0, 5, 1.1, 0.16, 1.2);
        }
        if ((hiss -= dt) <= 0) { hiss = 1.4; api.sound('crackle', 0.6, (P.x0 + P.x1) / 2, 2, clamp(api.player ? api.player.z : P.z0, P.hot0, P.hot1)); }
      }
      const blink = phase === 'warn' ? (clock * 7 | 0) & 1 : P.hot;
      for (const l of lamps) l.material = blink ? lampOn : lampOff;
      if (!live || !P.hot) return;
      for (const c of api.cars) {
        if (c.gone || c.dead) continue;
        if (c.x < P.x0 - c.wide * 0.6 || c.x > P.x1 + c.wide * 0.6 || c.z < P.hot0 - c.half || c.z > P.hot1 + c.half) continue;
        if (onBridge(c.z) || airborne(api, c)) continue;
        api.damage(c, DPS * dt, null);
        if (Math.random() < dt * 14 * TRAP.busy(api)) fire(c.x + (Math.random() - 0.5) * c.wide * 2, 1.5, c.z + (Math.random() - 0.5) * c.half * 2, 2, 2);
        if (TRAP.fresh(burnAt, c, clock, 0.5)) api.sound('c.hiss', 0.7, c.x, 2, c.z);
        if (c === api.player && clock > toastT) { toastT = clock + 6; api.toast('Molten steel!', 'The runner burns while it flows: cross on the plates, or jump it'); }
      }
    },
  };
}

// ---- the smith ------------------------------------------------------------------------------------------------------------
// F.arm(k): the works' handle, k from 0 (the hammer on the plate) to 1 (lifted); F.at(v): where the head is now.
export function makeSmith(api, F, S) {
  const HOLD = F.hold ?? 3.4, WARN = F.warn ?? 1.1, DOWN = F.down ?? 0.26, STAY = F.stay ?? 0.55, UP = F.up ?? 1.5, DMG = F.dmg ?? 32, R = F.r ?? 13, REACH = F.reach ?? 30;
  let phase = 'hold', T = F.first ?? 5, k = 1, clock = 0, beep = 0, toastT = 0;
  const [lampOff, lampOn] = TRAP.lampMats(), lamps = [];
  for (const [x, z] of F.lamps || []) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), lampOff); l.position.set(x, 0.7, z); api.scene.add(l); lamps.push(l); }
  const head = new THREE.Vector3();
  F.danger = false; F.low = false; F.head = { x: F.x, z: F.z };
  return {
    step(dt, live) {
      clock += dt; T -= dt;
      const wild = TRAP.wildIn(F, S);
      let jit = 0, struck = false;
      if (phase === 'hold') { k = 1; if (wild && T > 0.5) T = 0.5; if (T <= 0) { phase = 'warn'; T = wild ? 0.6 : WARN; } }
      else if (phase === 'warn') { jit = (Math.random() - 0.5) * 0.03; if ((beep -= dt) <= 0) { beep = 0.2; api.sfx.play('mine_beep', 1.2, F.x, F.z); } if (T <= 0) { phase = 'down'; T = DOWN; api.sound('whoosh', 1, F.x, 30, F.z); } }
      else if (phase === 'down') { const t = clamp(1 - T / DOWN, 0, 1); k = 1 - t * t; if (T <= 0) { phase = 'stay'; T = STAY; k = 0; struck = true; } }
      else if (phase === 'stay') { k = 0; if (T <= 0) { phase = 'up'; T = wild ? UP * 0.6 : UP; } }
      else { const U = wild ? UP * 0.6 : UP; k = ease(clamp(1 - T / U, 0, 1)); if (T <= 0) { phase = 'hold'; T = wild ? 0.5 : HOLD; k = 1; api.sound('creak', 0.6, F.x, 40, F.z); } }
      F.arm(k + jit); F.at(head);
      F.danger = phase === 'warn' || phase === 'down' || phase === 'stay'; F.low = phase === 'stay' || (phase === 'down' && k < 0.3); F.phase = phase; F.k = k; F.head.x = head.x; F.head.z = head.z;
      const blink = phase === 'warn' ? (clock * 8 | 0) & 1 : phase === 'down' || phase === 'stay';
      for (const l of lamps) l.material = blink ? lampOn : lampOff;
      if (!struck) return;
      // the blow: on the plate where the head came down (F.x, F.z is where it is painted)
      const x = F.x, z = F.z;
      api.sound('c.clang', 1.6, x, 4, z); api.sound('stomp', 1.2, x, 2, z); api.sfx.play('crunch_heavy', 1, x, z, { gap: 0.1 });
      sparks(x, 2, z, Math.round(60 * TRAP.busy(api)), 1, 0.75, 0.3, 46); dustWave(x, 0.5, z, Math.round(26 * TRAP.busy(api)), REACH, 1, 0.5, 0.5, 0.46, 0.42); ring(x, 0.6, z, REACH, 0xffb060, 0.5);
      TRAP.shake(api, 1.1, x, z);
      if (!live) return;
      for (const c of api.cars) {
        if (c.gone) continue;
        const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz) || 1;
        if (d > REACH + c.half || airborne(api, c)) continue;
        const under = d < R + c.wide, f = under ? 62 : 40 * (1 - d / (REACH + c.half)) + 14;
        // (thrown out into the floor, never back into the wall behind the plate)
        let nx = dx / d, nz = dz / d; if (F.out) { nx = nx * 0.5 + F.out[0] * 0.5; nz = nz * 0.5 + F.out[1] * 0.5; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; }
        TRAP.knock(c, nx * f, nz * f, under ? 0.45 : 0.3);
        if (c.dead) continue;
        api.damage(c, under ? DMG : DMG * 0.3 * (1 - d / (REACH + c.half)), null);
        if (under) fire(c.x, 3, c.z, Math.round(4 * TRAP.busy(api)), 3);
        if (c === api.player && under && clock > toastT) { toastT = clock + 4; api.toast('Hammered flat!', 'The smith strikes when the lamps round the plate blink'); }
      }
    },
  };
}

// ---- the works: the hall, the robots, what they hold -----------------------------------------------------------------------
// W: { hall: H (steelkit hallShell's), furnaces: [[x, z]], pourer: { x, z }, smith: { x, z }, built: { x, z },
//      banks: [[x, y, z]] (the floodlights' frames) }
// Returns { step(dt), tip(k) (the crucible, 0 to 1), arm(k), at(v) (the smith's: makeSmith's handles), lip: [x, y, z]
// (where the crucible's stream leaves it), welds }.
export function makeWorks(api, W, S = {}) {
  const scene = api.scene, H = W.hall;
  const X = makeBoxes();
  hallShell(X, H);
  hallSteel(X, H, { walks: W.walks, walkY: W.walkY });
  // the pendant lamps over the floor: each a fitting in the hall's mesh, a soft beam down from it and a pool of light
  // on the floor under it (the beams are one mesh and the pools another)
  if (W.lamps && W.lamps.length) {
    const LY = W.lampY ?? 100, run = (H.z1 - H.z0) / 2 + 6, zm = (H.z0 + H.z1) / 2, SEG = 14, R0 = 5, R1 = 21;
    const bp = [], bc = [], bi = [], pp = [], pu = [], pi = [];
    for (const [x, z] of W.lamps) {
      pendant(X, x, LY, z, H.eave + (H.ridge - H.eave) * (1 - Math.abs(z - zm) / run) + 1);
      for (const sh of [0.45, 0.72, 1]) {   // (three shells, one inside the next, so a beam is soft at its edge)
        const at = bp.length / 3;
        for (let k = 0; k <= SEG; k++) { const a = k / SEG * TAU, c = Math.cos(a), sn = Math.sin(a); bp.push(x + c * R0 * sh, LY, z + sn * R0 * sh, x + c * R1 * sh, 0.3, z + sn * R1 * sh); bc.push(0.0095, 0.0078, 0.0048, 0.0012, 0.001, 0.0006); if (k < SEG) { const i = at + k * 2; bi.push(i, i + 1, i + 3, i, i + 3, i + 2); } }
      }
      const q = pp.length / 3, PR = 46; pp.push(x - PR, 0.13, z - PR, x + PR, 0.13, z - PR, x + PR, 0.13, z + PR, x - PR, 0.13, z + PR); pu.push(0, 0, 1, 0, 1, 1, 0, 1); pi.push(q, q + 2, q + 1, q, q + 3, q + 2);
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3)); bg.setIndex(bi);
    const beams = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
    beams.frustumCulled = false; beams.renderOrder = 3; scene.add(beams);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(pu, 2)); pg.setIndex(pi);
    floorGlow(1, [1, 1, 1]);   // (makes the shared glow picture)
    const pools = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(0.42, 0.33, 0.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    pools.frustumCulled = false; pools.renderOrder = 2; scene.add(pools);
  }
  // a second crane parked along the hall, its hook up
  if (W.parked) { const g = new THREE.Group(); g.position.set(W.parked.x, H.rail, 0); scene.add(g); kitMeshes(bridgeGeo({ z0: H.z0, z1: H.z1, zs: W.parked.zs, hook: W.parked.hook }), g); }
  for (const [x, z] of W.furnaces) furnace(X, x, z, H.ridge - 14, 1);
  const SC = W.scale ?? 1;
  cradle(X, W.built.x, W.built.z, 34 * SC, 84 * SC, SC);
  if (W.dress) W.dress(X);
  const hall = X.geos(), [hp, hl] = kitMeshes(hall, scene);
  hp.matrixAutoUpdate = hl.matrixAutoUpdate = false; hp.frustumCulled = hl.frustumCulled = false; hp.receiveShadow = false;

  // the furnace robot (Steeljaw): his arms forward, the crucible between his fists
  const pourer = makeBot({ skin: 'mecha', scale: SC, cuts: ['head'], pose: { armL: [-0.52, 0, 0], armR: [-0.52, 0, 0], neck1: [0.25, 0, 0], head: [0.2, 0, 0], spine2: [0.06, 0, 0] } });
  pourer.root.position.set(W.pourer.x, 0, W.pourer.z); scene.add(pourer.root);
  const fl = pourer.places.ramL, fr = pourer.places.ramR, grip = Math.abs(fl[0] - fr[0]) / 2;
  const cru = new THREE.Group(); cru.position.set(W.pourer.x + (fl[0] + fr[0]) / 2, (fl[1] + fr[1]) / 2 + SC, W.pourer.z + (fl[2] + fr[2]) / 2 + 2.5 * SC); cru.scale.setScalar(SC); scene.add(cru);
  kitMeshes(crucibleGeo(grip / SC), cru);
  const lip = [cru.position.x, cru.position.y + 2 * SC, cru.position.z + 13.5 * SC];
  // the stream from its lip to the runner's head, and the splash of light where it lands
  const stream = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(HOT[0], HOT[1], HOT[2]), toneMapped: false }));
  stream.visible = false; scene.add(stream);
  const splash = floorGlow(20, [1.6, 0.6, 0.12]); splash.position.set(lip[0], 0.14, lip[2] + 3); splash.visible = false; scene.add(splash);

  // the smith (Jackhammer): his right arm is cut loose at the shoulder and swings the hammer
  const smith = makeBot({ skin: 'builder', scale: SC, cuts: ['armR', 'head'], pose: { armL: [-0.25, 0, 0.12], spine1: [0.1, 0, 0], spine2: [0.1, 0, 0], neck1: [0.2, 0, 0], head: [0.15, -0.2, 0] } });
  smith.root.position.set(W.smith.x, 0, W.smith.z); smith.root.rotation.y = Math.PI / 2; scene.add(smith.root);
  const arm = smith.limbs.armR, arm0 = arm.rotation.x;
  const sledge = new THREE.Group(), SL = W.smith.shaft ?? 40;
  {
    // along the forearm, from the fist; set in the arm's own space
    smith.root.updateMatrixWorld(true);
    arm.updateMatrix(); const inv = new THREE.Matrix4().copy(arm.matrix).invert();   // (the places are scaled; the arm's own space is not)
    const a = new THREE.Vector3(...smith.places.forearmR).divideScalar(SC).applyMatrix4(inv), b = new THREE.Vector3(...smith.places.ramR).divideScalar(SC).applyMatrix4(inv);
    const z = b.clone().sub(a).normalize(), x = new THREE.Vector3(1, 0, 0), y = new THREE.Vector3().crossVectors(z, x).normalize(); x.crossVectors(y, z);
    sledge.matrix.makeBasis(x, y, z).setPosition(b.addScaledVector(z, 3)); sledge.matrix.decompose(sledge.position, sledge.quaternion, sledge.scale);
    arm.add(sledge); kitMeshes(sledgeGeo(SL), sledge);
  }
  const UPA = W.smith.up ?? -1.6, DOWNA = W.smith.down ?? -0.46;
  const headAt = new THREE.Vector3();

  // the robot being built (Sprocket's shell, unlit): no shoulder pods yet, his left arm on the hoist beside him
  const built = makeBot({ skin: W.built.skin || 'toy', scale: SC, cuts: ['armL', 'head'], drop: ['podL', 'podR', 'jaw'], ownGlow: true, pose: { armR: [0.08, 0, -0.06] } });
  built.litMat.color.setScalar(0.03);   // (not switched on yet: a show event wakes him for as long as it lasts)
  built.root.position.set(W.built.x, 0, W.built.z); built.root.rotation.y = -Math.PI / 2; scene.add(built.root);
  { const g = built.limbs.armL; g.position.x += 22; g.position.y += 20; g.position.z -= 4; g.rotation.z = -0.5; g.rotation.x = 0.35; }
  // the welders' arcs: a flicker of blue-white at three joints, and sparks falling from them
  const sh = built.places.armL, hipp = built.places.thighR, ch = built.places.chest;
  const toWorld = ([x, y, z]) => [W.built.x - z, y, W.built.z + x];   // (he faces -x)
  const welds = [toWorld([sh[0] - 2, sh[1] + 1, sh[2]]), toWorld([hipp[0] - 3, hipp[1], hipp[2] + 4]), toWorld([ch[0] + 4, ch[1] + 5, ch[2] + 8])].map(([x, y, z], i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(WELD[0], WELD[1], WELD[2]), toneMapped: false })); m.position.set(x, y, z); m.visible = false; scene.add(m);
    return { m, x, y, z, t: 1 + i * 1.7, on: 0 };
  });
  // the floodlights' frames in the hall's corners
  if (W.banks) { const Xb = makeBoxes(); for (const [x, y, z] of W.banks) { Xb.B(x - 7, y - 4, z - 7, x + 7, y + 4, z + 7, 0x22252a); Xb.L(x - 6, y - 4.4, z - 6, x + 6, y - 4, z + 6, [2.6, 2.5, 2.3]); } kitMeshes(Xb.geos(), scene); }

  // Their heads follow the fight: Steeljaw and the smith watch the player's car (or the middle of the floor), as far
  // round as a neck goes; Sprocket only while he is awake.
  const _q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  const heads = [[pourer, W.pourer, 0, 0.9], [smith, W.smith, Math.PI / 2, 0.75], [built, W.built, -Math.PI / 2, 0.8]].map(([bot, at, yaw, max]) => ({ g: bot.limbs.head, q0: bot.limbs.head.quaternion.clone(), x: at.x, z: at.z, yaw, max, a: 0 }));
  const look = (h, dt, on = true) => {
    const p = api.player, tx = p && !p.dead && !p.gone ? p.x : 512, tz = p && !p.dead && !p.gone ? p.z : 512;
    let want = 0; if (on) { want = Math.atan2(tx - h.x, tz - h.z) - h.yaw; want = clamp(Math.atan2(Math.sin(want), Math.cos(want)), -h.max, h.max); }
    h.a += (want - h.a) * Math.min(1, dt * 1.6);
    h.g.quaternion.copy(h.q0).premultiply(_q.setFromAxisAngle(UP, h.a));
  };
  let tipK = 0, pouring = false, clock = 0, awake = 0, wakeT = 0;
  return {
    heads: () => heads.map((h) => +h.a.toFixed(2)), awake: () => awake,
    lip, tris: pourer.tris + smith.tris + built.tris + hall.paint.index.count / 3,
    tip(k, on) { tipK = k; pouring = on; },
    arm(k) { arm.rotation.x = arm0 + DOWNA + (UPA - DOWNA) * k; },
    at(v) { arm.updateWorldMatrix(true, true); return v.set(0, -1, SL - 1).applyMatrix4(sledge.matrixWorld); },
    step(dt) {
      clock += dt;
      look(heads[0], dt, tipK < 0.2); look(heads[1], dt, !W.smithBusy || !W.smithBusy());   // (each looks to his work while he is at it)
      // Sprocket: his lamps stutter on as an event starts, burn while it lasts and die away after it
      const on = !!S.event; if (on && wakeT === 0) api.sound('laser', 0.5, W.built.x, 60, W.built.z);
      wakeT = on ? wakeT + dt : 0; awake += ((on ? 1 : 0) - awake) * Math.min(1, dt * (on ? 3 : 0.8));
      built.litMat.color.setScalar(0.03 + awake * (on && wakeT < 1.3 && Math.random() < 0.45 ? 0.1 : 1.1)); look(heads[2], dt, on);
      cru.rotation.x = ease(clamp(tipK, 0, 1)) * 1.02;
      const run = pouring || tipK > 0.82;
      stream.visible = splash.visible = run;
      if (run) {
        const y0 = lip[1] - 6 * SC, w = (0.8 + 0.25 * Math.sin(clock * 23)) * SC;
        stream.position.set(lip[0], y0 / 2, lip[2] + 3.4); stream.scale.set(w, y0, w);
        splash.material.opacity = 0.7 + 0.3 * Math.sin(clock * 17);
        if (Math.random() < dt * 30 * TRAP.busy(api)) sparks(lip[0], 1, lip[2] + 3.4, 3, 1, 0.7, 0.25, 20);
      }
      for (const wd of welds) {
        wd.t -= dt;
        if (wd.on > 0) { wd.on -= dt; wd.m.visible = Math.random() < 0.7; if (Math.random() < dt * 40 * TRAP.busy(api)) sparks(wd.x, wd.y, wd.z, 2, 0.7, 0.85, 1, 14); if (wd.on <= 0) wd.m.visible = false; }
        else if (wd.t <= 0) { wd.on = 0.6 + Math.random() * 1.4; wd.t = wd.on + 1.5 + Math.random() * 4; }
      }
    },
  };
}
