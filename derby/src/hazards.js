// Things set in a map's floor that act on the cars, for any map that lists them as MAP.hazards ([{ kind, ... }]); main.js
// runs them (makeHazards). Each one warns before it hurts, so a driver can learn its rhythm and lure rivals into it:
//   grates   a ring of fire grates round a point, in quarters that take turns in opposite pairs: a pair glows and spits
//            sparks for a second, then flares for a few, burning any car on it. { x, z, r0, r1 }
//   press    a hydraulic press over a pad: it waits up high, flashes its lamps and sounds its alarm, slams down (crushing
//            any car under it), sits a moment, and rises. While it is low, cars are held out of its pad.
//            { x0, z0, x1, z1, top (where its rods go up to), rods: [[x, z], ...], shut: sides with a wall against them
//            that a car under it is never pushed out of, from 'x0', 'x1', 'z0', 'z1' }
//   barrels  red barrels that blow up when shot, rammed or caught in a blast (setting off the ones beside them), and come
//            back a while later. { spots: [{ x, z }] }
//   boost    a strip of chevrons that gives a car driving along it a burst of speed. { x0, z0, x1, z1, yaw }
//   bounds   the edge of the floor, a rounded rectangle that holds cars in even where the wall is blown open.
//            { x, z, hx, hz, r }
//   keepout  something too tough to dig out of (a steel plinth, say) that shoves and blasts can't bury a car in:
//            a round post { x, z, r } or a block { x0, z0, x1, z1 }.
// None of them are voxels: they are meshes that move and glow, so nothing has to be rebuilt. The map's own list objects
// carry their live state, for its radar: a grate ring's `hot` and `warn` (which pair, or -1), a press's `low`, and each
// barrel spot's `up`.
import * as THREE from 'three';
import { fire, sparks, smoke, ring, dust } from '../../src/sim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const TAU = Math.PI * 2;
// a car's two ends, as main.js's bump() sees a car: a circle at the front and one at the back
function ends(c, out) {
  const s = Math.sin(c.yaw), co = Math.cos(c.yaw);
  for (let i = 0; i < 2; i++) { const f = i ? -0.55 : 0.55; out[i][0] = c.x + s * (c.mid + c.half * f); out[i][1] = c.z + co * (c.mid + c.half * f); }
  return out;
}
const _e = [[0, 0], [0, 0]];
// is the point inside the car's box, with a margin?
function inCar(c, x, z, pad) {
  const s = Math.sin(c.yaw), co = Math.cos(c.yaw), dx = x - c.x, dz = z - c.z;
  return Math.abs(dx * co - dz * s) < c.wide + pad && Math.abs(dx * s + dz * co - c.mid) < c.half + pad;
}
// shake the camera, less the further the player is from it
function shake(api, a, x, z) { const p = api.player; if (!p) return; api.game.shake = Math.min(1.4, api.game.shake + a * clamp(1.3 - Math.hypot(x - p.x, z - p.z) / 180, 0, 1)); }
// a canvas texture drawn by fn(g, w, h)
function canvasTex(w, h, fn, rep = [1, 1]) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; fn(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makeHazards(api, list = []) {
  const parts = list.map((h) => (KINDS[h.kind] ? KINDS[h.kind](api, h) : null)).filter(Boolean);
  return { parts, step(dt, live) { for (const p of parts) p.step(dt, live); } };
}

// ---- fire grates -------------------------------------------------------------------------------------------------
function grates(api, h) {
  const WARN = h.warn ?? 1.1, BURN = h.burn ?? 2.6, REST = h.rest ?? 0.6, DPS = h.dps ?? 18, HALF = WARN + BURN + REST;
  // the glow over the painted grates: slots of light, a quarter of the ring each
  const tex = canvasTex(32, 32, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#fff'; for (let x = 2; x < 32; x += 8) g.fillRect(x, 0, 4, 32); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 14, 32, 4); }, [h.r1 / 6, h.r1 / 6]);
  const quarters = [0, 1, 2, 3].map((k) => {
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    // RingGeometry's angles run the other way round once it is laid flat, so quarter k (centred on k right angles from
    // +x, towards +z) starts at minus that
    const m = new THREE.Mesh(new THREE.RingGeometry(h.r0, h.r1, 20, 1, -k * Math.PI / 2 - Math.PI / 4, Math.PI / 2), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(h.x, 0.08, h.z); m.renderOrder = 2; api.scene.add(m);
    return mat;
  });
  let t = 0, was = '', burnS = 0;
  h.hot = -1; h.warn = -1;
  const at = (k, out) => { const a = k * Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 2, r = h.r0 + Math.random() * (h.r1 - h.r0); out[0] = h.x + Math.cos(a) * r; out[1] = h.z + Math.sin(a) * r; return out; };
  const _p = [0, 0];
  return {
    step(dt, live) {
      t = (t + dt) % (2 * HALF);
      const pair = t < HALF ? 0 : 1, u = t % HALF, state = u < WARN ? 'warn' : u < WARN + BURN ? 'burn' : 'rest';
      h.hot = state === 'burn' ? pair : -1; h.warn = state === 'warn' ? pair : -1;
      if (state + pair !== was) { was = state + pair; if (state === 'warn') api.sound('hiss', 0.7, h.x, 1, h.z); else if (state === 'burn') api.sound('whoosh', 1, h.x, 1, h.z); }
      for (let k = 0; k < 4; k++) {
        const mine = (k & 1) === pair;
        let glow = 0.1;
        if (mine && state === 'warn') glow = (u * 8 | 0) & 1 ? 0.9 : 0.35;      // flickers before it goes
        // burning: red far past 1 so it blooms, green held near a half so it reads orange and not white on screen
        if (mine && state === 'burn') quarters[k].color.setRGB(5 + Math.random() * 0.8, 0.5 + Math.random() * 0.08, 0.08);
        else quarters[k].color.setRGB(glow, glow * 0.42, glow * 0.1);
        if (!mine) continue;
        if (state === 'burn') for (let i = 0; i < 3; i++) { at(k, _p); fire(_p[0], 0.5, _p[1], 1, 0.5); }
        else if (state === 'warn' && Math.random() < dt * 14) { at(k, _p); sparks(_p[0], 0.4, _p[1], 3, 1, 0.55, 0.15, 12); }
      }
      if (state === 'burn' && (burnS -= dt) <= 0) { burnS = 0.5; api.sound('crackle', 0.5, h.x, 1, h.z); }
      if (!live || h.hot < 0) return;
      // burn the cars on the flaring quarters
      for (const c of api.cars) {
        if (c.dead || c.gone) continue;
        const dx = c.x - h.x, dz = c.z - h.z, d = Math.hypot(dx, dz);
        if (d < h.r0 - c.wide || d > h.r1 + c.wide * 0.5) continue;
        const k = ((Math.round(Math.atan2(dz, dx) / (Math.PI / 2)) % 4) + 4) % 4;
        if ((k & 1) !== pair) continue;
        api.damage(c, DPS * dt, null);
        if (Math.random() < dt * 20) fire(c.x + (Math.random() - 0.5) * c.wide * 2, 1.5 + Math.random() * 3, c.z + (Math.random() - 0.5) * c.half, 2, 0.6);
        if (c === api.player && Math.random() < dt * 3) api.sfx.play('scrape', 0.5, c.x, c.z, { gap: 0.4 });
      }
    },
  };
}

// ---- the press ---------------------------------------------------------------------------------------------------
// up, then warn (lamps, alarm, a shudder), drop (fast), slam, down (a moment), rise (slowly), up again
function press(api, h) {
  const UP = h.wait ?? 3.4, WARN = h.warn ?? 1.1, DROP = 0.16, DOWN = h.down ?? 1.1, RISE = h.rise ?? 1.6, HIGH = h.high ?? 24, THICK = 6, DMG = h.dmg ?? 75;
  const w = h.x1 - h.x0, d = h.z1 - h.z0, mx = (h.x0 + h.x1) / 2, mz = (h.z0 + h.z1) / 2;
  const stripes = canvasTex(128, 24, (g, W, H) => { g.fillStyle = '#e2b02a'; g.fillRect(0, 0, W, H); g.fillStyle = '#1c1c1e'; for (let x = -H; x < W; x += 16) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + 8, H); g.lineTo(x + 8 + H, 0); g.lineTo(x + H, 0); g.fill(); } }, [2, 1]);
  const steel = new THREE.MeshStandardMaterial({ color: 0x4a525c, roughness: 0.5, metalness: 0.6 }), side = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6, metalness: 0.2 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, THICK, d), [side, side, steel, steel, side, side]);
  slab.castShadow = true; slab.receiveShadow = true; api.scene.add(slab);
  const rodMat = new THREE.MeshStandardMaterial({ color: 0xc3ccd6, roughness: 0.25, metalness: 0.9 });
  const rods = (h.rods || [[mx, mz]]).map(([x, z]) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1, 10), rodMat); r.position.set(x, 0, z); r.castShadow = true; api.scene.add(r); return r; });
  // the warning lamps along the slab's two long sides
  const lampOff = new THREE.MeshBasicMaterial({ color: 0x3a1010 }), lampOn = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.2), toneMapped: false });
  const lamps = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), lampOff); l.userData = { dx: sx * (w / 2 + 0.6), dz: (i - 1) * d / 3 }; slab.add(l); l.position.set(l.userData.dx, THICK / 2 - 1, l.userData.dz); lamps.push(l); }
  let phase = 'up', t = h.offset ?? 1.5, y = HIGH, beep = 0;
  const place = (yy, jx = 0, jz = 0) => {
    slab.position.set(mx + jx, yy + THICK / 2, mz + jz);
    const top = h.top ?? 46;
    for (const r of rods) { const len = Math.max(0.5, top - (yy + THICK)); r.scale.y = len; r.position.y = yy + THICK + len / 2; }
  };
  place(y);
  // hold cars out of the pad while the slab is low, and crush the ones under it as it lands
  const shut = h.shut || [];
  const hold = (crush) => {
    const low = y < 13;
    h.low = low;
    for (const c of api.cars) {
      if (c.gone) continue;
      const r = c.wide + 0.6;
      ends(c, _e);
      let px = 0, pz = 0, hit = false;
      for (const [ex, ez] of _e) {
        const qx = clamp(ex, h.x0, h.x1), qz = clamp(ez, h.z0, h.z1), ddx = ex - qx, ddz = ez - qz, dd = Math.hypot(ddx, ddz);
        if (dd >= r) continue;
        hit = true;
        if (!low) continue;
        if (dd > 0.01) { px += ddx / dd * (r - dd); pz += ddz / dd * (r - dd); }
        else {   // its end is right under the slab: out by the nearest side
          const o = [[ex - h.x0, -1, 0, 'x0'], [h.x1 - ex, 1, 0, 'x1'], [ez - h.z0, 0, -1, 'z0'], [h.z1 - ez, 0, 1, 'z1']].filter((s) => !shut.includes(s[3])).sort((a, b) => a[0] - b[0])[0];
          px += o[1] * (o[0] + r); pz += o[2] * (o[0] + r);
        }
      }
      if (!hit) continue;
      if (crush && !c.dead) {
        api.damage(c, DMG, null);
        const top = new THREE.Vector3();
        for (const f of [-0.5, 0, 0.5]) { top.set(c.x + Math.sin(c.yaw) * c.half * f, c.top, c.z + Math.cos(c.yaw) * c.half * f); c.unit.hit(top, 2.4, api.chip, 12); }
        sparks(c.x, c.top, c.z, 30, 1, 0.8, 0.4, 30);
        if (c === api.player) api.toast('Crushed!', `-${DMG} armour`);
      }
      if (!low) continue;
      const pl = Math.hypot(px, pz); if (pl < 0.001) continue;
      c.x += px; c.z += pz;
      const nx = px / pl, nz = pz / pl, vn = c.vx * nx + c.vz * nz;
      if (vn < 0) { c.vx -= nx * vn * 1.2; c.vz -= nz * vn * 1.2; }
    }
  };
  return {
    step(dt, live) {
      t -= dt;
      let jx = 0, jz = 0;
      if (phase === 'up') { y = HIGH; if (t <= 0) { phase = 'warn'; t = WARN; api.sound('alarm', 0.9, mx, HIGH, mz); } }
      else if (phase === 'warn') {
        jx = (Math.random() - 0.5) * 0.5; jz = (Math.random() - 0.5) * 0.5; y = HIGH + Math.sin(t * 40) * 0.3;
        if ((beep -= dt) <= 0) { beep = 0.22; api.sfx.play('mine_beep', 1.4, mx, mz); }
        if (Math.random() < dt * 10) sparks(mx + (Math.random() - 0.5) * w, HIGH, mz + (Math.random() - 0.5) * d, 2, 1, 0.8, 0.4, 10);
        if (t <= 0) { phase = 'drop'; t = DROP; }
      } else if (phase === 'drop') {
        const k = 1 - Math.max(0, t) / DROP; y = HIGH * (1 - k * k);
        if (t <= 0) {
          phase = 'down'; t = DOWN; y = 0;
          if (live) hold(true);
          api.sound('stomp', 1, mx, 0, mz); api.sfx.play('crunch_heavy', 1, mx, mz);
          dust(mx, 1, mz, 16, Math.max(w, d) * 0.5); ring(mx, 0.4, mz, Math.max(w, d) * 0.9, 0xd8d0c0, 0.5);
          for (let i = 0; i < 8; i++) sparks(h.x0 + Math.random() * w, 0.6, Math.random() < 0.5 ? h.z0 : h.z1, 4, 1, 0.75, 0.35, 26);
          shake(api, 0.7, mx, mz);
        }
      } else if (phase === 'down') { y = 0; if (t <= 0) { phase = 'rise'; t = RISE; api.sound('hiss', 0.8, mx, 2, mz); } }
      else if (phase === 'rise') { const k = 1 - Math.max(0, t) / RISE; y = HIGH * k * k * (3 - 2 * k); if (t <= 0) { phase = 'up'; t = UP; } }
      place(y, jx, jz);
      const flash = phase === 'warn' ? (t * 6 | 0) & 1 : phase === 'drop' || phase === 'down';
      for (const l of lamps) l.material = flash ? lampOn : lampOff;
      if (live) hold(false); else h.low = y < 13;
    },
  };
}

// ---- barrels -------------------------------------------------------------------------------------------------------
function barrels(api, h) {
  const R = 2.1, H = 5, HP = 6, EVERY = h.every ?? 22, n = h.spots.length;
  const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; api.scene.add(m); return m; };
  const body = mk(new THREE.CylinderGeometry(R, R, H, 14), new THREE.MeshStandardMaterial({ color: 0xc8302a, roughness: 0.45, metalness: 0.35 }));
  const band = mk(new THREE.CylinderGeometry(R + 0.08, R + 0.08, 0.9, 14), new THREE.MeshStandardMaterial({ color: 0xf0c020, roughness: 0.5 }));
  const lid = mk(new THREE.CylinderGeometry(R - 0.3, R - 0.3, 0.3, 14), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.5 }));
  const M4 = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0), Q = new THREE.Quaternion(), S1 = new THREE.Vector3(1, 1, 1), V = new THREE.Vector3();
  const show = (i, b) => {
    if (!b.up) { body.setMatrixAt(i, ZERO); band.setMatrixAt(i, ZERO); lid.setMatrixAt(i, ZERO); }
    else {
      Q.setFromAxisAngle(V.set(0, 1, 0), b.a);
      body.setMatrixAt(i, M4.compose(V.set(b.x, H / 2, b.z), Q, S1)); band.setMatrixAt(i, M4.compose(V.set(b.x, H * 0.62, b.z), Q, S1)); lid.setMatrixAt(i, M4.compose(V.set(b.x, H + 0.1, b.z), Q, S1));
    }
    body.instanceMatrix.needsUpdate = band.instanceMatrix.needsUpdate = lid.instanceMatrix.needsUpdate = true;
  };
  h.spots.forEach((b, i) => { b.up = true; b.hp = HP; b.t = 0; b.fuse = 0; b.a = Math.random() * 6; show(i, b); });
  // up it goes: the town's own explosion (which hurts the cars round it and sets off the next barrels), and a harder
  // knock of our own to the cars nearest, put down to whoever set it off
  function blow(i, who) {
    const b = h.spots[i]; if (!b.up) return;
    b.up = false; b.t = EVERY * (0.85 + Math.random() * 0.3); b.fuse = 0; show(i, b);
    api.explode(b.x, 2.5, b.z, 4.2, 0.7, { maxDebris: 120, fire: true });
    api.sfx.play('carboom', 0.9, b.x, b.z, { gap: 0.06 });
    for (const c of api.cars) {
      if (c.dead || c.gone) continue;
      const dd = Math.hypot(c.x - b.x, c.z - b.z) - c.wide; if (dd > 16) continue;
      const k = 1 - Math.max(0, dd) / 16;
      api.damage(c, 24 * k, who && who !== c ? who : null);
      const p = Math.max(1, Math.hypot(c.x - b.x, c.z - b.z)); c.vx += (c.x - b.x) / p * 26 * k; c.vz += (c.z - b.z) / p * 26 * k;
    }
  }
  // shots strike barrels (main.js asks everything in `extras`), and blasts set them off
  api.extras.push({
    solid(x, y, z) { if (y > H + 0.3) return false; for (const b of h.spots) if (b.up && (x - b.x) * (x - b.x) + (z - b.z) * (z - b.z) < (R + 0.3) * (R + 0.3)) return true; return false; },
    hit(p, dmg, owner) {
      for (let i = 0; i < n; i++) {
        const b = h.spots[i]; if (!b.up || Math.hypot(p.x - b.x, p.z - b.z) > R + 0.6) continue;
        b.hp -= dmg; sparks(p.x, p.y, p.z, 4, 1, 0.8, 0.4, 14);
        if (b.hp <= 0) blow(i, owner);
        return true;
      }
      return false;
    },
    explosion(x, y, z, reach, base, by) {
      for (const b of h.spots) if (b.up && !b.fuse && Math.hypot(b.x - x, b.z - z) < Math.max(10, reach * 0.75)) { b.fuse = 0.12 + Math.random() * 0.18; b.by = by; }
    },
  });
  return {
    step(dt, live) {
      for (let i = 0; i < n; i++) {
        const b = h.spots[i];
        if (!b.up) {
          if ((b.t -= dt) > 0) continue;
          if (api.cars.some((c) => !c.gone && Math.hypot(c.x - b.x, c.z - b.z) < 12)) continue;   // not under a car
          b.up = true; b.hp = HP; show(i, b); ring(b.x, 0.4, b.z, 5, 0xff6040, 0.35);
          continue;
        }
        if (b.fuse > 0 && (b.fuse -= dt) <= 0) { blow(i, b.by); continue; }
        if (!live) continue;
        for (const c of api.cars) if (!c.gone && inCar(c, b.x, b.z, R + 0.2)) { blow(i, c.dead ? null : c); break; }
      }
    },
  };
}

// ---- boost strips ----------------------------------------------------------------------------------------------------
const BOOST = { time: 0.8, topK: 1.35, accelK: 2.2 };
function boost(api, h) {
  const w = h.x1 - h.x0, d = h.z1 - h.z0, along = Math.abs(Math.sin(h.yaw)) > 0.7;   // along x, or along z
  const tex = canvasTex(64, 32, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 64, 32); g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.moveTo(14, 2); g.lineTo(34, 16); g.lineTo(14, 30); g.stroke(); }, [(along ? w : d) / 9, 1]);
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.5, 1.4, 2.4), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(along ? w : d, along ? d : w), mat);
  // the texture's chevrons point along +u; turn the plane so that is the way the strip pushes
  m.rotation.order = 'YXZ'; m.rotation.y = h.yaw - Math.PI / 2; m.rotation.x = -Math.PI / 2;
  m.position.set((h.x0 + h.x1) / 2, 0.1, (h.z0 + h.z1) / 2); m.renderOrder = 2; api.scene.add(m);
  return {
    step(dt, live) {
      tex.offset.x -= dt * 1.6;
      mat.opacity = 0.45 + 0.15 * Math.sin(performance.now() / 120);
      if (!live) return;
      for (const c of api.cars) {
        if (c.dead || c.gone) continue;
        const on = c.x > h.x0 && c.x < h.x1 && c.z > h.z0 && c.z < h.z1 && c.fwd > 10 && Math.abs(wrap(c.yaw - h.yaw)) < 1.0;
        if (on) {
          if (!c.gadget || !c.gadget.nitro) c.padNitro = BOOST;
          c.boostT = Math.max(c.boostT || 0, BOOST.time);
          if (!c.onBoost) { api.sfx.play('nitro', c === api.player ? 0.7 : 0.4, c.x, c.z, { gap: 0.3 }); if (c === api.player) shake(api, 0.15, c.x, c.z); }
        }
        c.onBoost = on;
      }
    },
  };
}

// ---- the bounds ------------------------------------------------------------------------------------------------------
// The edge of the floor, as a rounded rectangle round (x, z): a car is held inside it even where rockets have blown the
// wall open, so nobody drives out into the stands. `give` is how far into the wall the line sits, so a whole wall stops
// a car first, as it always has.
function bounds(api, h) {
  const give = h.give ?? 1.5;
  return {
    step() {
      for (const c of api.cars) {
        if (c.gone) continue;
        ends(c, _e);
        for (const [ex, ez] of _e) {
          const sx = Math.sign(ex - h.x) || 1, sz = Math.sign(ez - h.z) || 1, qx = Math.abs(ex - h.x) - (h.hx - h.r), qz = Math.abs(ez - h.z) - (h.hz - h.r);
          let e, nx, nz;
          if (qx > 0 && qz > 0) { const l = Math.hypot(qx, qz); e = l - h.r; nx = qx / l * sx; nz = qz / l * sz; }
          else if (qx > qz) { e = qx - h.r; nx = sx; nz = 0; } else { e = qz - h.r; nx = 0; nz = sz; }
          const over = e + c.wide + 0.6 - give; if (over <= 0) continue;
          c.x -= nx * over; c.z -= nz * over;
          const vn = c.vx * nx + c.vz * nz; if (vn > 0) { c.vx -= nx * vn * 1.3; c.vz -= nz * vn * 1.3; }
        }
      }
    },
  };
}

// Something solid that a car is held off: a round post { x, z, r } or a block { x0, z0, x1, z1 }. Driving into it a car
// bounces off as it always does; this is for the shoves (a ram, a blast) that would otherwise bury a car in something
// too tough for it to dig itself out of.
function keepout(api, h) {
  const round = h.r != null;
  return {
    step() {
      for (const c of api.cars) {
        if (c.gone) continue;
        ends(c, _e);
        for (const [ex, ez] of _e) {
          let nx, nz, over;
          if (round) { const dx = ex - h.x, dz = ez - h.z, d = Math.hypot(dx, dz) || 0.01; nx = dx / d; nz = dz / d; over = h.r + c.wide + 0.2 - d; }
          else {
            const qx = clamp(ex, h.x0, h.x1), qz = clamp(ez, h.z0, h.z1), dx = ex - qx, dz = ez - qz, d = Math.hypot(dx, dz);
            if (d > 0.01) { nx = dx / d; nz = dz / d; over = c.wide + 0.2 - d; }
            else {   // its end is inside: out by the nearest side
              const o = [[ex - h.x0, -1, 0], [h.x1 - ex, 1, 0], [ez - h.z0, 0, -1], [h.z1 - ez, 0, 1]].sort((a, b) => a[0] - b[0])[0];
              nx = o[1]; nz = o[2]; over = o[0] + c.wide + 0.2;
            }
          }
          if (over <= 0) continue;
          c.x += nx * over; c.z += nz * over;
          const vn = c.vx * nx + c.vz * nz; if (vn < 0) { c.vx -= nx * vn * 1.3; c.vz -= nz * vn * 1.3; }
        }
      }
    },
  };
}

const KINDS = { grates, press, barrels, boost, bounds, keepout };
void smoke; void TAU;
