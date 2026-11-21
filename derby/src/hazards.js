// Things set in a map's floor, walls and roof that act on the cars, for any map that lists them as MAP.hazards
// ([{ kind, ... }]); main.js runs them (makeHazards). Each one warns before it hurts, so a driver can learn its rhythm
// and lure rivals into it:
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
//   sweeper  blades that turn round a point, low along the floor from r0 out to r1, hung from a drum overhead. A blade
//            knocks a car on ahead of it and out, and hurts; the eye inside r0 is still. A red wedge on the floor runs
//            ahead of each blade and its lamps blink. { x, z, n (blades), r0, r1, spin (radians a second), top }
//   hammer   a hammer on an arm under a gantry, latched up to one side. It blinks and beeps, lets go, swings across the
//            lane (knocking any car it meets across with it) and latches on the far side, then comes back.
//            { x, z, y (the pivot), len, axis ('x' or 'z': the way the head swings), lane (half the lane's width) }
//   jets     flame jets in a wall. Each glows and hisses, then burns out across the floor; they go in turns, `group`
//            by group, each `step` a moment after the one before. { jets: [{ x, z, a (the way it points, as
//            atan2(dz, dx)), group, step }], len }
//   magnet   a crane's magnet over a point: it hums and glows (blue rings run in across the floor), then pulls every car
//            within `r` in toward the point under it for a few seconds, holding the ones it gets, and lets go.
//            { x, z, r, y (how high it hangs), top (the jib it hangs from) }
//   conveyor a belt in the floor that carries whatever is on it along `yaw`. { x0, z0, x1, z1, yaw, speed }
//   show     the announcer: every so often it calls an event (a banner and a siren), and for a while the hazards whose
//            `wild` names that event's tag go wild (faster, more often, all at once). { first, every, time,
//            events: [{ tag, name, sub }], onEvent(event) }
// None of them are voxels: they are meshes that move and glow, so nothing has to be rebuilt. The map's own list objects
// carry their live state, for its radar and its route grid: a grate ring's `hot` and `warn` (which pair, or -1), a
// press's `low` and `danger`, each barrel spot's `up`, a sweeper's `angle`, a hammer's `head` and `low`, each jet's
// `on` and `hot`, a magnet's `on` and `pull`, and the show's `event` and `left`.
// Rivals keep clear of them through steerClear (for ai.js): each kind that can hurt says where it is dangerous and
// when, and a rival bound through it is sent round (by the map's route grid, which the map blocks while it is on).
import * as THREE from 'three';
import { fire, sparks, ring, dust } from '../../src/sim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const TAU = Math.PI * 2;
const wrapPos = (a) => ((a % TAU) + TAU) % TAU;
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
// yellow and black hazard stripes
const stripesTex = (rep) => canvasTex(128, 24, (g, W, H) => { g.fillStyle = '#e2b02a'; g.fillRect(0, 0, W, H); g.fillStyle = '#1c1c1e'; for (let x = -H; x < W; x += 16) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + 8, H); g.lineTo(x + 8 + H, 0); g.lineTo(x + H, 0); g.fill(); } }, rep);
const steelMat = () => new THREE.MeshStandardMaterial({ color: 0x4a525c, roughness: 0.5, metalness: 0.6 });
// a warning lamp: dark, or lit far past white so it blooms
const lampMats = (r = 3, g = 0.4, b = 0.2) => [new THREE.MeshBasicMaterial({ color: new THREE.Color(r * 0.08, g * 0.08, b * 0.08) }), new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false })];
const glowMat = (r, g, b, o = 0.6) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
// fewer sparks and flames on a phone
const busy = (api) => (api.TOUCH && api.TOUCH() ? 0.35 : 1);

// ---- moving cars about -------------------------------------------------------------------------------------------
const _H = {};
// move a car by (dx, dz) unless that would put it in something solid; true if it moved
function slide(c, dx, dz) {
  const nx = c.x + dx, nz = c.z + dz;
  if (c.hits && c.hits(nx, nz, c.yaw, _H)) return false;
  c.x = nx; c.z = nz; return true;
}
// a hard knock: the car is carried along (vx, vz) for a moment, easing off, so its tyres can't just soak it up (they
// kill a sideways slide in a fraction of a second), and stopped short of anything solid
function knock(c, vx, vz, t = 0.35) { c.knock = { vx, vz, t, T: t }; c.vx += vx * 0.4; c.vz += vz * 0.4; }
function carry(api, dt) {
  for (const c of api.cars) {
    const k = c.knock; if (!k) continue;
    if (c.gone || (k.t -= dt) <= 0) { c.knock = null; continue; }
    if (!slide(c, k.vx * (k.t / k.T) * dt, k.vz * (k.t / k.T) * dt)) c.knock = null;   // it hit something: that's as far as it goes
  }
}
// a car's cooldown for one hazard: true (and the clock starts again) if it is more than `gap` seconds since it last hurt it
function fresh(map, c, now, gap) { const t = map.get(c); if (t !== undefined && now - t < gap) return false; map.set(c, now); return true; }

// ---- running them --------------------------------------------------------------------------------------------------
let running = [];
// the show's event (if one is on) and how long it has been on, shared by all of a map's hazards
const wildIn = (h, S) => !!S.event && !!h.wild && (h.wild === S.event || h.wild === 'all' || (Array.isArray(h.wild) && h.wild.includes(S.event)));
export function makeHazards(api, list = []) {
  const S = { event: null, on: 0 };
  const parts = list.map((h) => (KINDS[h.kind] ? KINDS[h.kind](api, h, S) : null)).filter(Boolean);
  running = parts;
  return { parts, show: S, step(dt, live) { if (S.event) S.on += dt; else S.on = 0; for (const p of parts) p.step(dt, live); carry(api, dt); } };
}

// ---- rivals keeping clear ---------------------------------------------------------------------------------------
// Where a rival means to drive next (x, z), on its way to (tx, tz) (what it is after: a car or a pickup): `out` is set
// to where it should drive instead, if that way runs into harm. True if it was moved.
const _o = { x: 0, z: 0 };
export function steerClear(car, x, z, out, tx = x, tz = z) {
  out.x = x; out.z = z;
  let moved = false;
  for (const p of running) if (p.avoid && p.avoid(car, out, tx, tz)) moved = true;
  return moved;
}
// does the way from the car to `out` come within r of (cx, cz)? (only the first 90 voxels of it count)
function passes(car, out, cx, cz, r) {
  const ax = car.x - cx, az = car.z - cz;
  let sx = out.x - car.x, sz = out.z - car.z; const L = Math.hypot(sx, sz); if (L > 90) { sx *= 90 / L; sz *= 90 / L; }
  const L2 = sx * sx + sz * sz || 1, t = clamp(-(ax * sx + az * sz) / L2, 0, 1);
  return Math.hypot(ax + sx * t, az + sz * t) < r;
}
// past a circle: if the way there crosses it, aim past its edge on the side the goal is on; if the car is in it, out
function around(car, out, cx, cz, r) {
  const ax = car.x - cx, az = car.z - cz, da = Math.hypot(ax, az), gx = out.x - cx, gz = out.z - cz;
  if (da < r) { const k = (r + 6) / (da || 1); out.x = cx + ax * k; out.z = cz + az * k; return true; }
  if (Math.hypot(gx, gz) < r || !passes(car, out, cx, cz, r)) return false;
  const R = r + 6, side = Math.sign(ax * gz - az * gx) || 1, b = da > R ? Math.acos(R / da) : 0, a = Math.atan2(az, ax) + side * Math.max(b, 0.4);
  out.x = cx + Math.cos(a) * R; out.z = cz + Math.sin(a) * R; return true;
}
// the long way round, by the map's route grid (which the map keeps blocked over a hazard while it is dangerous)
function detour(api, car, out, tx, tz) {
  if (!api.MAP || !api.MAP.waypoint) return false;
  api.MAP.waypoint(car, tx, tz, _o); out.x = _o.x; out.z = _o.z; return true;
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
      if (state + pair !== was) { was = state + pair; if (state === 'warn') api.sound('c.hiss', 0.7, h.x, 1, h.z); else if (state === 'burn') api.sound('whoosh', 1, h.x, 1, h.z); }
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
// up, then warn (lamps, alarm, a shudder), drop (fast), slam, down (a moment), rise (slowly), up again. Gone wild, it
// hardly waits at the top.
function press(api, h, S) {
  const WAIT = h.wait ?? 3.4, WARN = h.warn ?? 1.1, DROP = 0.16, DOWN = h.down ?? 1.1, RISE = h.rise ?? 1.6, HIGH = h.high ?? 24, THICK = 6, DMG = h.dmg ?? 75;
  const w = h.x1 - h.x0, d = h.z1 - h.z0, mx = (h.x0 + h.x1) / 2, mz = (h.z0 + h.z1) / 2;
  const steel = steelMat(), side = new THREE.MeshStandardMaterial({ map: stripesTex([2, 1]), roughness: 0.6, metalness: 0.2 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, THICK, d), [side, side, steel, steel, side, side]);
  slab.castShadow = true; slab.receiveShadow = true; api.scene.add(slab);
  const rodMat = new THREE.MeshStandardMaterial({ color: 0xc3ccd6, roughness: 0.25, metalness: 0.9 });
  const rods = (h.rods || [[mx, mz]]).map(([x, z]) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1, 10), rodMat); r.position.set(x, 0, z); r.castShadow = true; api.scene.add(r); return r; });
  // the warning lamps along the slab's two long sides
  const [lampOff, lampOn] = lampMats();
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
  const out = (ex, ez) => [[ex - h.x0, -1, 0, 'x0'], [h.x1 - ex, 1, 0, 'x1'], [ez - h.z0, 0, -1, 'z0'], [h.z1 - ez, 0, 1, 'z1']].filter((s) => !shut.includes(s[3])).sort((a, b) => a[0] - b[0])[0];
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
        else { const o = out(ex, ez); px += o[1] * (o[0] + r); pz += o[2] * (o[0] + r); }   // its end is right under the slab: out by the nearest side
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
      if (phase === 'up') { y = HIGH; if (t > (h.wildWait ?? 0.9) && wildIn(h, S)) t = h.wildWait ?? 0.9; if (t <= 0) { phase = 'warn'; t = WARN; api.sound('c.alarm', 0.9, mx, HIGH, mz); } }
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
      } else if (phase === 'down') { y = 0; if (t <= 0) { phase = 'rise'; t = RISE; api.sound('c.hiss', 0.8, mx, 2, mz); } }
      else if (phase === 'rise') { const k = 1 - Math.max(0, t) / RISE; y = HIGH * k * k * (3 - 2 * k); if (t <= 0) { phase = 'up'; t = WAIT; } }
      place(y, jx, jz);
      const flash = phase === 'warn' ? (t * 6 | 0) & 1 : phase === 'drop' || phase === 'down';
      for (const l of lamps) l.material = flash ? lampOn : lampOff;
      if (live) hold(false); else h.low = y < 13;
      // dangerous: about to come down, coming down, or down (for the map's route grid and the rivals)
      h.danger = phase === 'warn' || phase === 'drop' || phase === 'down' || (phase === 'up' && t < 0.8);
    },
    avoid(car, o, tx, tz) {
      if (!h.danger) return false;
      const pad = car.wide + 3, inX = car.x > h.x0 - pad && car.x < h.x1 + pad, inZ = car.z > h.z0 - pad && car.z < h.z1 + pad;
      if (inX && inZ) {   // on the pad: off it by the nearest open side
        const s = out(clamp(car.x, h.x0, h.x1), clamp(car.z, h.z0, h.z1));
        o.x = car.x + s[1] * (s[0] + pad + 10); o.z = car.z + s[2] * (s[0] + pad + 10); return true;
      }
      // bound across it: round, by the route grid
      for (let k = 1; k <= 8; k++) {
        const f = k / 8, x = car.x + (o.x - car.x) * f, z = car.z + (o.z - car.z) * f;
        if (x > h.x0 - pad && x < h.x1 + pad && z > h.z0 - pad && z < h.z1 + pad) return detour(api, car, o, tx, tz);
      }
      return false;
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
// a flat strip with a texture whose chevrons point along +u, turned so that is the way `yaw` points
function strip(api, h, tex, mat) {
  const w = h.x1 - h.x0, d = h.z1 - h.z0, along = Math.abs(Math.sin(h.yaw)) > 0.7;   // along x, or along z
  const m = new THREE.Mesh(new THREE.PlaneGeometry(along ? w : d, along ? d : w), mat);
  m.rotation.order = 'YXZ'; m.rotation.y = h.yaw - Math.PI / 2; m.rotation.x = -Math.PI / 2;
  m.position.set((h.x0 + h.x1) / 2, 0.1, (h.z0 + h.z1) / 2); m.renderOrder = 2; api.scene.add(m);
  return { m, len: along ? w : d };
}
function boost(api, h) {
  const along = Math.abs(Math.sin(h.yaw)) > 0.7, len = along ? h.x1 - h.x0 : h.z1 - h.z0;
  const tex = canvasTex(64, 32, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 64, 32); g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.moveTo(14, 2); g.lineTo(34, 16); g.lineTo(14, 30); g.stroke(); }, [len / 9, 1]);
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.5, 1.4, 2.4), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  strip(api, h, tex, mat);
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

// ---- conveyors ---------------------------------------------------------------------------------------------------
// A rubber belt with ridges and yellow arrows, running the way it carries. Anything on it (wrecks too) goes with it.
function conveyor(api, h) {
  const SPEED = h.speed ?? 18, along = Math.abs(Math.sin(h.yaw)) > 0.7, len = along ? h.x1 - h.x0 : h.z1 - h.z0, TILE = 8;
  const tex = canvasTex(64, 64, (g, W, H) => {
    g.fillStyle = '#26282b'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#3a3d42'; for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 3, H);   // the ridges, across the way it runs
    g.strokeStyle = '#e2b02a'; g.lineWidth = 5; g.beginPath(); g.moveTo(20, 18); g.lineTo(40, 32); g.lineTo(20, 46); g.stroke();
  }, [len / TILE, (along ? h.z1 - h.z0 : h.x1 - h.x0) / 16]);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 });
  const { m } = strip(api, h, tex, mat); m.position.y = 0.06; m.receiveShadow = true;
  const dx = Math.sin(h.yaw) * SPEED, dz = Math.cos(h.yaw) * SPEED;
  return {
    step(dt, live) {
      tex.offset.x -= dt * SPEED / TILE;
      if (!live) return;
      for (const c of api.cars) if (!c.gone && c.x > h.x0 && c.x < h.x1 && c.z > h.z0 && c.z < h.z1) slide(c, dx * dt, dz * dt);
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

// ---- the sweeper -------------------------------------------------------------------------------------------------
function sweeper(api, h, S) {
  const N = h.n ?? 3, R0 = h.r0 ?? 12, R1 = h.r1 ?? 46, SPIN = h.spin ?? 0.52, DMG = h.dmg ?? 20, TOP = h.top ?? 27, LEAD = 0.55;
  const steel = steelMat(), side = new THREE.MeshStandardMaterial({ map: stripesTex([(R1 - R0) / 8, 1]), roughness: 0.6, metalness: 0.2 });
  const drumSide = new THREE.MeshStandardMaterial({ map: stripesTex([4, 1]), roughness: 0.6, metalness: 0.2 });
  const [lampOff, lampOn] = lampMats(3.2, 0.3, 0.15);
  // the saw at each blade's tip: a disc with teeth round its rim
  const sawTex = canvasTex(64, 64, (g) => { g.fillStyle = '#8a9099'; g.beginPath(); for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, b = (k + 0.5) / 24 * TAU; g.lineTo(32 + Math.cos(a) * 31, 32 + Math.sin(a) * 31); g.lineTo(32 + Math.cos(b) * 25, 32 + Math.sin(b) * 25); } g.fill(); g.fillStyle = '#3c4148'; g.beginPath(); g.arc(32, 32, 9, 0, TAU); g.fill(); g.fillStyle = '#c8302a'; g.beginPath(); g.arc(32, 32, 4, 0, TAU); g.fill(); });
  const sawMat = new THREE.MeshStandardMaterial({ map: sawTex, roughness: 0.35, metalness: 0.8, transparent: true, alphaTest: 0.5 });
  // the glow on the floor ahead of each blade, brightest at the blade and fading out ahead of it
  const wedgeGeo = new THREE.RingGeometry(R0, R1 + 3, 16, 1, -LEAD, LEAD), wp = wedgeGeo.attributes.position, wc = [];
  for (let i = 0; i < wp.count; i++) { const f = 1 + Math.atan2(wp.getY(i), wp.getX(i)) / LEAD; const k = Math.pow(clamp(f, 0, 1), 2.2); wc.push(k, k * 0.12, k * 0.06); }
  wedgeGeo.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
  const wedgeMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.6, 2.6, 2.6), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const g = new THREE.Group(); g.position.set(h.x, 0, h.z); api.scene.add(g);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 24), [drumSide, steel, steel]); drum.position.y = TOP - 3; drum.castShadow = true; g.add(drum);
  const saws = [], lamps = [];
  for (let k = 0; k < N; k++) {
    // each blade in its own frame, along +x (the way the blades turn is +z in it)
    const arm = new THREE.Group(); arm.rotation.y = -k * TAU / N; g.add(arm);
    const mid = (R0 + R1) / 2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(R1 - 6, 2, 2.2), steel); beam.position.set((R1 + 6) / 2, TOP - 5, 0); beam.castShadow = true; arm.add(beam);
    for (const r of [R0 + 1, mid, R1 - 1]) { const rod = new THREE.Mesh(new THREE.BoxGeometry(1.2, TOP - 11, 1.2), steel); rod.position.set(r, (TOP - 5 + 6) / 2, 0); arm.add(rod); }
    const blade = new THREE.Mesh(new THREE.BoxGeometry(R1 - R0, 5, 1.8), [steel, steel, steel, steel, side, side]); blade.position.set(mid, 3.5, 0); blade.castShadow = true; arm.add(blade);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(R1 - R0, 0.8, 0.5), lampOff); edge.position.set(mid, 5.5, 0.9); arm.add(edge); lamps.push(edge);
    const saw = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.8, 24), [steel, sawMat, sawMat]); saw.rotation.x = Math.PI / 2; saw.position.set(R1, 4.3, 0); arm.add(saw); saws.push(saw);
    const wedge = new THREE.Mesh(wedgeGeo, wedgeMat); wedge.rotation.x = -Math.PI / 2; wedge.position.y = 0.09; wedge.renderOrder = 2; arm.add(wedge);
  }
  let th = h.offset ?? 0, w = SPIN, spinA = 0, clock = 0, saw = null, toastT = 0;
  const hitAt = new WeakMap();
  h.angle = th; h.w = w; h.n = N;
  const blades = (i) => th + i * TAU / N;
  // seconds till a blade next comes round to angle a
  const next = (a) => { let m = 1e9; for (let i = 0; i < N; i++) m = Math.min(m, wrapPos(a - blades(i)) / Math.max(0.05, w)); return m; };
  return {
    step(dt, live) {
      clock += dt;
      const want = SPIN * (wildIn(h, S) ? 2 : 1);
      w += (want - w) * Math.min(1, dt * 0.8);   // it spins up (and back down) over a second or two
      th = wrapPos(th + w * dt); h.angle = th; h.w = w;
      g.rotation.y = -th; spinA += dt * 16; for (const s of saws) s.rotation.y = spinA;
      const blink = (clock * 6 | 0) & 1;
      for (const l of lamps) l.material = blink ? lampOn : lampOff;
      wedgeMat.opacity = 0.5 + 0.2 * Math.sin(clock * 9);
      // the saws' whine, from the nearest point of a blade to the player
      const p = api.player;
      if (p && api.sfx.loop) {
        if (!saw) saw = api.sfx.loop('saw_loop');
        const pa = Math.atan2(p.z - h.z, p.x - h.x); let bi = 0, bd = 9;
        for (let i = 0; i < N; i++) { const d = Math.abs(wrap(blades(i) - pa)); if (d < bd) { bd = d; bi = i; } }
        const r = clamp(Math.hypot(p.x - h.x, p.z - h.z), R0, R1), a = blades(bi);
        saw.set(live ? 0.32 * (w / SPIN) : 0, 0.55 + 0.25 * (w / SPIN), h.x + Math.cos(a) * r, h.z + Math.sin(a) * r);
      }
      for (const c of api.cars) {
        if (c.gone) continue;
        const cx = c.x - h.x, cz = c.z - h.z, rc = Math.hypot(cx, cz), reach = c.half + c.wide;
        if (rc > R1 + 4 + reach || rc < R0 - reach) continue;   // nowhere near the blades (or sat in the eye)
        ends(c, _e);
        for (let i = 0; i < N; i++) {
          const a = blades(i), ux = Math.cos(a), uz = Math.sin(a), tx = -uz, tz = ux;
          const need = c.wide + 1.1, lc = cx * tx + cz * tz;   // the car's middle: ahead of the blade (+) or behind it
          let push = 0, hit = false;
          for (const [ex, ez] of _e) {
            const rx = ex - h.x, rz = ez - h.z, al = rx * ux + rz * uz, le = rx * tx + rz * tz;
            if (al < R0 - c.wide || al > R1 + 5) continue;   // (the saw at the tip reaches 4 past r1)
            if (lc >= 0 ? le >= need : le <= -need) continue;
            hit = true; push = lc >= 0 ? Math.max(push, need - le) : Math.min(push, -need - le);
          }
          if (!hit) continue;
          c.x += tx * push; c.z += tz * push;
          const vb = w * clamp(rc, R0, R1), vt = c.vx * tx + c.vz * tz;
          if (lc < 0) { if (vt > vb) { c.vx -= tx * (vt - vb); c.vz -= tz * (vt - vb); } continue; }   // ran into the back of it: stopped dead
          if (vt < vb + 3) { c.vx += tx * (vb + 3 - vt); c.vz += tz * (vb + 3 - vt); }
          if (!live || !fresh(hitAt, c, clock, 0.7)) continue;
          // a fresh hit: thrown out (and a little on), wrecks too, so they never pile up in the blades, and clear of the
          // blade before it comes round again
          const f = 30 + vb * 1.4;
          knock(c, (ux * 0.9 + tx * 0.44) * f, (uz * 0.9 + tz * 0.44) * f, 0.45);
          if (c.dead) continue;
          api.damage(c, DMG * (wildIn(h, S) ? 1.3 : 1), null);
          const hx = c.x - tx * c.wide, hz = c.z - tz * c.wide;
          sparks(hx, 3, hz, Math.round(26 * busy(api)), 1, 0.75, 0.3, 30);
          api.sound('c.clang', 1, hx, 3, hz); api.sfx.play('grind', 0.9, hx, hz, { gap: 0.1 }); api.sfx.play('crunch_heavy', 0.7, hx, hz, { gap: 0.15 });
          shake(api, 0.45, hx, hz);
          if (c === api.player && clock > toastT) { toastT = clock + 3; api.toast('Swept!', 'Mind the blades'); }
        }
      }
    },
    // Rivals keep out of the blades' reach, unless what they are after is in there: then they wait outside, circling
    // against the turn, for a gap behind a blade, and go in; and leave the eye right behind a blade.
    avoid(car, out, tx, tz) {
      const cx = car.x - h.x, cz = car.z - h.z, rc = Math.hypot(cx, cz), R = R1 + 9;   // (clear of the saws at the tips)
      const tIn = Math.hypot(tx - h.x, tz - h.z) < R - 4;   // what it is after is in there
      const v = Math.max(16, Math.abs(car.fwd)), a = Math.atan2(cz, cx), face = Math.atan2(Math.cos(car.yaw), Math.sin(car.yaw));
      const set = (ang, r) => { out.x = h.x + Math.cos(ang) * r; out.z = h.z + Math.sin(ang) * r; return true; };
      if (rc < R0 - 2) {   // in the eye
        if (tIn) return false;
        let best = 0, bd = 9;
        for (let i = 0; i < N; i++) { const ea = blades(i) - 0.5, d = Math.abs(wrap(ea - face)); if (d < bd) { bd = d; best = ea; } }
        return set(best, R + 6);
      }
      if (rc < R) {   // among the blades: on to what it is after if no blade is about to come round, else straight out
        if (tIn && next(a - 0.3) > (rc - R0 + 6) / v + 0.3) return false;
        return set(a + 0.25, R + 6);
      }
      if (tIn) {   // outside, after something in there: in through a gap, or round against the turn till one comes
        const turnT = Math.abs(wrap(Math.atan2(-cz, -cx) - face)) / 2.2;
        if (next(a - 0.35) > (rc - R0 + 8) / v + turnT + 0.3) return false;
        return set(a - 0.45, R + 6);
      }
      return around(car, out, h.x, h.z, R);
    },
  };
}

// ---- the hammer --------------------------------------------------------------------------------------------------
// Latched at one side: wait, then warn (the lamps blink, it beeps and shudders), then let go: it swings across like a
// pendulum, fastest at the bottom, and latches at the other side. Gone wild, it hardly waits.
function hammer(api, h, S) {
  const L = h.len ?? 26.5, PY = h.y ?? 32, A = h.amp ?? 58 * Math.PI / 180, HR = h.head ?? 4.6, HL = 6, LANE = h.lane ?? 30, DMG = h.dmg ?? 34;
  const ux = h.axis === 'x' ? 1 : 0, uz = h.axis === 'x' ? 0 : 1, nx = uz, nz = -ux;   // the way the head swings, and across it
  const steel = steelMat(), side = new THREE.MeshStandardMaterial({ map: stripesTex([3, 1]), roughness: 0.55, metalness: 0.3 });
  const [lampOff, lampOn] = lampMats();
  const pivot = new THREE.Group(); pivot.position.set(h.x, PY, h.z); api.scene.add(pivot);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 11, 12), steel); axle.rotation.set(0, 0, 0); pivot.add(axle);
  if (ux) axle.rotation.x = Math.PI / 2; else axle.rotation.z = Math.PI / 2;   // across the swing
  const swing = new THREE.Group(); pivot.add(swing);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, L - HR, 1.8), steel); arm.position.y = -(L - HR) / 2; arm.castShadow = true; swing.add(arm);
  const brace = new THREE.Mesh(new THREE.BoxGeometry(ux ? 1.2 : 6, 6, ux ? 6 : 1.2), steel); brace.position.y = -(L - HR - 3); swing.add(brace);
  // the head: a drum lying the way it swings, so it strikes flat on
  const head = new THREE.Mesh(new THREE.CylinderGeometry(HR, HR, HL * 2, 20), [side, steel, steel]); head.position.y = -L; head.castShadow = true; swing.add(head);
  if (ux) head.rotation.z = Math.PI / 2; else head.rotation.x = Math.PI / 2;
  const lamps = [];
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), lampOff); l.position.set(nx * s * (HR + 0.2), -L + HR - 0.6, nz * s * (HR + 0.2)); swing.add(l); lamps.push(l); }
  const beacon = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 2), lampOff); beacon.position.y = 2.2; pivot.add(beacon); lamps.push(beacon);
  const turn = (th) => { if (ux) swing.rotation.z = th; else swing.rotation.x = -th; };
  let from = 1, phase = 'hold', T = h.offset ?? 2, th = A, clock = 0, beep = 0, toastT = 0;
  const hitAt = new WeakMap();
  const HOLD = h.hold ?? 2.2, WARN = h.warn ?? 1, SWING = h.swing ?? 1.3;   // (read now: h.warn is its live state from here on)
  const hold = () => (wildIn(h, S) ? 0.55 : HOLD), warnT = () => (wildIn(h, S) ? 0.45 : WARN), swingT = () => (wildIn(h, S) ? 1.0 : SWING);
  // the arm's angle t seconds from now, if nothing changes
  function ahead(t) {
    let ph = phase, left = T, f = from;
    for (let n = 0; n < 6; n++) {
      if (ph === 'hold') { if (t < left) return f * A; t -= left; ph = 'swing'; left = swingT(); }
      else { const SW = swingT(); if (t < left) return f * A * Math.cos(Math.PI * (SW - left + t) / SW); t -= left; ph = 'hold'; left = hold(); f = -f; }
    }
    return f * A;
  }
  const lowAt = (a) => PY - L * Math.cos(a) - HR < 9;   // down where it meets cars
  h.head = { x: h.x, y: PY - L * Math.cos(A), z: h.z }; h.low = false; h.warn = false;
  return {
    step(dt, live) {
      clock += dt; T -= dt;
      let jit = 0, dth = 0;
      if (phase === 'hold') {
        if (T > hold() && wildIn(h, S)) T = hold();   // gone wild: let go soon
        th = from * A;
        h.warn = T < warnT();
        if (h.warn) { jit = (Math.random() - 0.5) * 0.02; if ((beep -= dt) <= 0) { beep = 0.2; api.sfx.play('mine_beep', 1.2, h.x, h.z); } }
        if (T <= 0) { phase = 'swing'; T = swingT(); h.warn = false; api.sound('creak', 1, h.x, PY, h.z); api.sound('whoosh', 1, h.x, PY - L, h.z); }
      } else {
        const SW = swingT(), e = clamp(SW - T, 0, SW);
        th = from * A * Math.cos(Math.PI * e / SW); dth = -from * A * Math.sin(Math.PI * e / SW) * Math.PI / SW;
        if (T <= 0) { phase = 'hold'; T = hold(); from = -from; th = from * A; dth = 0; api.sound('c.clang', 0.6, h.x + ux * L * Math.sin(th), PY, h.z + uz * L * Math.sin(th)); }
      }
      turn(th + jit);
      const flash = h.warn ? (clock * 8 | 0) & 1 : phase === 'swing';
      for (const l of lamps) l.material = flash ? lampOn : lampOff;
      const s = L * Math.sin(th), hy = PY - L * Math.cos(th), hx = h.x + ux * s, hz = h.z + uz * s, speed = Math.abs(dth) * L;
      h.head.x = hx; h.head.y = hy; h.head.z = hz; h.low = lowAt(th); h.phase = phase;
      if (phase === 'swing' && h.low && Math.random() < dt * 30 * busy(api)) dust(hx, 0.5, hz, 1, 3);
      if (!live || phase !== 'swing' || speed < 8) return;
      for (const c of api.cars) {
        if (c.gone || hy - HR > c.top - 0.3) continue;
        ends(c, _e);
        let hit = false;
        for (const [ex, ez] of _e) {
          const es = (ex - h.x) * ux + (ez - h.z) * uz, eq = (ex - h.x) * nx + (ez - h.z) * nz;
          if (Math.abs(eq) < HR + c.wide && Math.abs(es - s) < HL + c.wide) { hit = true; break; }
        }
        if (!hit || !fresh(hitAt, c, clock, 0.9)) continue;
        // knocked across with the head, harder the faster it is going
        const dir = Math.sign(dth) || 1, f = Math.max(40, speed * 1.25);
        knock(c, ux * dir * f, uz * dir * f, 0.42);
        if (c.dead) continue;
        api.damage(c, DMG * (0.6 + 0.4 * Math.min(1, speed / 45)), null);
        sparks(c.x - ux * dir * c.wide, 4, c.z - uz * dir * c.wide, Math.round(34 * busy(api)), 1, 0.8, 0.4, 34);
        api.sound('c.clang', 1.2, hx, 4, hz); api.sfx.play('crunch_heavy', 1, hx, hz, { gap: 0.1 }); api.sound('c.thud', 1, hx, 2, hz);
        shake(api, 0.8, hx, hz);
        if (c === api.player && clock > toastT) { toastT = clock + 3; api.toast('Hammered!', 'Watch its lamps: it swings when they blink'); }
      }
    },
    // A rival about to drive under it picks a spot across the lane that the head won't be swinging through as it
    // passes (the head swings on a timetable, so it can be read ahead).
    avoid(car, out) {
      const rx = car.x - h.x, rz = car.z - h.z, s = rx * ux + rz * uz, q = rx * nx + rz * nz;
      if (Math.abs(q) > 64 || Math.abs(q) < 2 || Math.abs(s) > LANE + 14) return false;
      const gq = (out.x - h.x) * nx + (out.z - h.z) * nz;
      if (gq * q > 0) return false;   // not going across
      const vq = Math.max(16, Math.abs(car.vx * nx + car.vz * nz)), clear = HR + car.half + 1;
      const t0 = Math.max(0, (Math.abs(q) - clear) / vq) - 0.15, t1 = (Math.abs(q) + clear) / vq + 0.15;
      const bad = [];
      for (let k = 0; k <= 8; k++) { const a = ahead(Math.max(0, t0 + (t1 - t0) * k / 8)); if (lowAt(a)) bad.push(L * Math.sin(a)); }
      if (!bad.length) return false;
      const gap = HL + car.wide + 2;
      let best = null, bd = 1e9;
      for (let sc = -LANE + car.wide; sc <= LANE - car.wide; sc += 3) {
        if (bad.some((b) => Math.abs(b - sc) < gap)) continue;
        const d = Math.abs(sc - s); if (d < bd) { bd = d; best = sc; }
      }
      if (best === null) return false;
      const sd = -Math.sign(q);
      out.x = h.x + ux * best + nx * sd * 8; out.z = h.z + uz * best + nz * sd * 8;
      return true;
    },
  };
}

// ---- flame jets ----------------------------------------------------------------------------------------------------
// Groups take turns; in a group's turn each jet goes `step` lags after the first, so the fire runs along the wall.
// Gone wild, every jet burns at once, and further.
function jets(api, h, S) {
  const WARN = h.warn ?? 1, BURN = h.burn ?? 2.4, REST = h.rest ?? 1.2, LAG = h.lag ?? 0.35, LEN = h.len ?? 26, DPS = h.dps ?? 32;
  const J = h.jets, G = Math.max(...J.map((j) => j.group)) + 1, SLOT = WARN + BURN + REST + LAG * Math.max(...J.map((j) => j.step || 0));
  // a cone with its point at the nozzle and its mouth at the far end (along +x), fading out toward the mouth
  const geo = new THREE.ConeGeometry(1, 1, 14, 1, true); geo.translate(0, -0.5, 0); geo.rotateZ(Math.PI / 2);
  const ftex = canvasTex(32, 64, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = 0; x < W; x += 6) g.fillRect(x, 0, 2, H); });
  const outerM = new THREE.MeshBasicMaterial({ map: ftex, color: new THREE.Color(3.2, 0.95, 0.16), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const innerM = new THREE.MeshBasicMaterial({ map: ftex, color: new THREE.Color(3.4, 2.4, 0.9), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.5, metalness: 0.7 });
  const mouthOff = new THREE.MeshBasicMaterial({ color: 0x3a1a0a }), mouthWarm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.5, 0.1), toneMapped: false }), mouthHot = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.6, 0.4), toneMapped: false });
  for (const j of J) {
    j.dx = Math.cos(j.a); j.dz = Math.sin(j.a); j.on = false; j.hot = false; j.was = 0; j.len = LEN;
    const box = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 4.4), steel); box.position.set(j.x - j.dx * 0.8, 3.6, j.z - j.dz * 0.8); box.rotation.y = -j.a; api.scene.add(box);
    j.mouth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2, 2.6), mouthOff); j.mouth.position.set(j.x + j.dx * 0.9, 3.6, j.z + j.dz * 0.9); j.mouth.rotation.y = -j.a; api.scene.add(j.mouth);
    j.outer = new THREE.Mesh(geo, outerM); j.inner = new THREE.Mesh(geo, innerM);
    for (const m of [j.outer, j.inner]) { m.position.set(j.x + j.dx, 3.6, j.z + j.dz); m.rotation.y = -j.a; m.visible = false; m.renderOrder = 3; api.scene.add(m); }
  }
  let t = h.offset ?? 0, hissT = 0, crackT = 0, clock = 0;
  const hitAt = new WeakMap(), _q = [0, 0];
  // how far along the flame (0..1) and how far from its line a point is
  const rel = (j, x, z, out) => { const px = x - j.x, pz = z - j.z, al = px * j.dx + pz * j.dz; out[0] = al / j.len; out[1] = Math.abs(px * j.dz - pz * j.dx); return out; };
  const width = (f) => 1.6 + 4.4 * clamp(f, 0, 1);
  return {
    step(dt, live) {
      clock += dt;
      const wild = wildIn(h, S);
      t = (t + dt) % (SLOT * G);
      const grp = Math.floor(t / SLOT), u = t - grp * SLOT;
      let anyHot = false;
      for (const j of J) {
        let st = 0;   // 0 off, 1 warning, 2 burning
        if (wild) st = S.on < 0.7 ? 1 : 2;
        else if (j.group === grp) { const uj = u - (j.step || 0) * LAG; st = uj < 0 ? 0 : uj < WARN ? 1 : uj < WARN + BURN ? 2 : 0; }
        j.len = LEN * (wild ? 1.3 : 1);
        if (st !== j.was) {
          if (st === 1 && clock > hissT) { hissT = clock + 0.3; api.sound('c.hiss', 0.9, j.x, 3, j.z); }
          if (st === 2) api.sound('whoosh', 1, j.x, 3, j.z);
          j.was = st;
        }
        j.on = st > 0; j.hot = st === 2; if (j.hot) anyHot = true;
        j.mouth.material = st === 2 ? mouthHot : st === 1 ? ((clock * 10 | 0) & 1 ? mouthHot : mouthWarm) : mouthOff;
        j.outer.visible = j.inner.visible = st > 0;
        if (st === 1) {   // a pilot flame, and sparks spitting from the nozzle
          j.outer.scale.set(2.2, 0.8, 0.8); j.inner.scale.set(1.4, 0.5, 0.5);
          if (Math.random() < dt * 16 * busy(api)) sparks(j.x + j.dx * 2, 3.6, j.z + j.dz * 2, 3, 1, 0.6, 0.15, 14);
        } else if (st === 2) {
          const k = 0.92 + Math.random() * 0.12, r = 6 * (0.9 + Math.random() * 0.15);
          j.outer.scale.set(j.len * k, r, r); j.inner.scale.set(j.len * 0.62 * k, r * 0.45, r * 0.45);
          if (Math.random() < dt * 24 * busy(api)) { const f = 0.25 + Math.random() * 0.75; fire(j.x + j.dx * j.len * f, 3 + Math.random() * 2, j.z + j.dz * j.len * f, 1, 0.5 + f); }
        }
      }
      outerM.map.offset.x = clock * 2.3;
      if (anyHot && (crackT -= dt) <= 0) { crackT = 0.45; const j = J.find((q) => q.hot); api.sound('crackle', 0.7, j.x, 2, j.z); }
      if (!live) return;
      // burn the cars in a flame
      for (const c of api.cars) {
        if (c.dead || c.gone) continue;
        ends(c, _e);
        for (const j of J) {
          if (!j.hot) continue;
          let inside = false;
          for (const [ex, ez] of _e) { rel(j, ex, ez, _q); if (_q[0] > -0.05 && _q[0] < 1.05 && _q[1] < width(_q[0]) + c.wide) { inside = true; break; } }
          if (!inside) continue;
          api.damage(c, DPS * dt, null);
          if (Math.random() < dt * 18 * busy(api)) fire(c.x + (Math.random() - 0.5) * c.wide * 2, 1.5 + Math.random() * 3, c.z + (Math.random() - 0.5) * c.half, 2, 0.6);
          if (c === api.player && fresh(hitAt, c, clock, 3)) api.toast('Burning!', 'Keep off the walls while the jets are lit');
          break;
        }
      }
    },
    // Rivals bound through a lit (or lighting) jet go round by the route grid; one caught in a flame gets out sideways.
    avoid(car, out, tx, tz) {
      for (const j of J) {
        if (!j.on || Math.hypot(car.x - j.x, car.z - j.z) > j.len + 70) continue;
        rel(j, car.x, car.z, _q);
        if (_q[0] > -0.1 && _q[0] < 1.1 && _q[1] < width(_q[0]) + car.wide + 2) {   // in it: out across it, the way it is already
          const sd = Math.sign((car.x - j.x) * j.dz - (car.z - j.z) * j.dx) || 1;
          out.x = car.x + j.dz * sd * 18 + j.dx * 6; out.z = car.z - j.dx * sd * 18 + j.dz * 6; return true;
        }
        for (let k = 1; k <= 10; k++) {
          const f = k / 10, x = car.x + (out.x - car.x) * f, z = car.z + (out.z - car.z) * f;
          if (Math.hypot(x - car.x, z - car.z) > 80) break;
          rel(j, x, z, _q);
          if (_q[0] > -0.1 && _q[0] < 1.1 && _q[1] < width(_q[0]) + car.wide + 3) return detour(api, car, out, tx, tz);
        }
      }
      return false;
    },
  };
}

// ---- the magnet ----------------------------------------------------------------------------------------------------
// rest, then warn (it hums up and glows, rings run in across the floor), pull (everything in reach is dragged in toward
// the point under it; at the middle it holds them, and sparks), drop (it lets go, with a clang), rest again.
function magnet(api, h, S) {
  const R = h.r ?? 48, Y = h.y ?? 24, TOP = h.top ?? 54, REST = h.rest ?? 6, WARN = h.warn ?? 1.6, PULL = h.pull ?? 3.6, DPS = h.dps ?? 7;
  const steel = steelMat(), dark = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.6, metalness: 0.6 });
  const rim = new THREE.MeshStandardMaterial({ map: canvasTex(128, 16, (g, W, H) => { for (let x = 0; x < W; x += 16) { g.fillStyle = (x / 16) & 1 ? '#e8e4da' : '#c8302a'; g.fillRect(x, 0, 16, H); } }, [3, 1]), roughness: 0.5, metalness: 0.3 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xb86a32, roughness: 0.35, metalness: 0.85 });
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1, 6), dark); api.scene.add(cable);
  const body = new THREE.Group(); body.position.set(h.x, Y, h.z); api.scene.add(body);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 3.6, 28), [rim, steel, steel]); disc.castShadow = true; body.add(disc);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 2.4, 14), dark); cap.position.y = 3; body.add(cap);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(6, 0.9, 8, 28), copper); coil.rotation.x = Math.PI / 2; coil.position.y = 2.1; body.add(coil);
  const under = glowMat(0.4, 1.2, 3, 0), glow = new THREE.Mesh(new THREE.CircleGeometry(7.8, 28), under); glow.rotation.x = Math.PI / 2; glow.position.y = -1.85; body.add(glow);
  // the rings that run in across the floor
  const ringM = [0, 1, 2].map(() => glowMat(0.3, 0.9, 2.6, 0));
  const rings = ringM.map((m) => { const r = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 56), m); r.rotation.x = -Math.PI / 2; r.position.set(h.x, 0.14, h.z); r.renderOrder = 2; api.scene.add(r); return r; });
  let phase = 'rest', T = h.offset ?? REST, clock = 0, hum = null, sparkT = 0, toastT = 0;
  h.on = false; h.pull = false;
  const rest = () => (wildIn(h, S) ? 1.6 : REST);
  return {
    step(dt, live) {
      clock += dt; T -= dt;
      if (phase === 'rest') { if (T > rest() && wildIn(h, S)) T = rest(); if (T <= 0) { phase = 'warn'; T = WARN; api.sound('c.alarm', 0.6, h.x, Y, h.z); } }
      else if (phase === 'warn') { if (T <= 0) { phase = 'pull'; T = PULL * (wildIn(h, S) ? 1.4 : 1); api.sfx.play('arc_zap', 1.2, h.x, h.z); api.sound('laser', 0.8, h.x, Y, h.z); } }
      else if (phase === 'pull') { if (T <= 0) { phase = 'drop'; T = 0.5; api.sound('c.clang', 1, h.x, Y, h.z); sparks(h.x, Y - 2, h.z, Math.round(30 * busy(api)), 0.5, 0.8, 1, 20); } }
      else if (T <= 0) { phase = 'rest'; T = rest(); }
      h.on = phase === 'warn' || phase === 'pull'; h.pull = phase === 'pull'; h.phase = phase;
      // the look: it drops a little and shakes while it pulls, glows blue, and the floor rings run in
      const k = phase === 'warn' ? 1 - T / WARN : phase === 'pull' ? 1 : 0;
      const y = Y - (phase === 'pull' ? 4 : phase === 'warn' ? 4 * k * k : 0);
      body.position.set(h.x + (h.pull ? (Math.random() - 0.5) * 0.4 : 0), y, h.z + (h.pull ? (Math.random() - 0.5) * 0.4 : 0));
      const top = TOP, len = top - (y + 3); cable.scale.y = len; cable.position.set(h.x, y + 3 + len / 2, h.z);
      under.opacity = phase === 'pull' ? 0.75 + Math.random() * 0.2 : phase === 'warn' ? 0.6 * k * ((clock * 10 | 0) & 1 ? 1 : 0.5) : 0;
      rings.forEach((r, i) => {
        if (!h.on) { ringM[i].opacity = 0; return; }
        const f = 1 - (((clock * (h.pull ? 0.9 : 0.6)) + i / 3) % 1);   // each ring runs from the edge in to the middle
        r.scale.setScalar(Math.max(0.5, R * f)); ringM[i].opacity = (h.pull ? 0.75 : 0.45 * k) * Math.min(1, (1 - f) * 4) * Math.min(1, f * 3);
      });
      if (h.pull && Math.random() < dt * 20 * busy(api)) { const a = Math.random() * TAU; sparks(h.x + Math.cos(a) * 6, y - 1.5, h.z + Math.sin(a) * 6, 2, 0.5, 0.8, 1, 10); }
      // the hum
      const p = api.player;
      if (p && api.sfx.loop) { if (!hum) hum = api.sfx.loop('arc_hum'); hum.set(live && h.on ? (h.pull ? 0.7 : 0.15 + 0.45 * k) : 0, h.pull ? 1.25 : 0.6 + 0.5 * k, h.x, h.z); }
      if (!live || !h.pull) return;
      const wild = wildIn(h, S) ? 1.25 : 1;
      for (const c of api.cars) {
        if (c.gone) continue;
        const dx = h.x - c.x, dz = h.z - c.z, d = Math.hypot(dx, dz);
        if (d > R) continue;
        if (d > 1.5) { const v = (14 + 40 * (1 - d / R)) * wild; slide(c, dx / d * Math.min(v * dt, d - 1), dz / d * Math.min(v * dt, d - 1)); }
        if (d < 8) {   // held fast under it, and crackling
          c.vx *= Math.exp(-4 * dt); c.vz *= Math.exp(-4 * dt);
          if (!c.dead) api.damage(c, DPS * dt, null);
          if ((sparkT -= dt) <= 0) { sparkT = 0.15; sparks(c.x, c.top, c.z, Math.round(6 * busy(api)), 0.5, 0.8, 1, 14); }
        }
        if (c === api.player && clock > toastT) { toastT = clock + 4; api.toast('The magnet has you!', 'Floor it, straight away from it'); }
      }
    },
    // rivals keep out while it hums or pulls, and drive straight away from it if they are caught
    avoid(car, out, tx, tz) {
      if (!h.on && !(phase === 'rest' && T < 0.8)) return false;
      const dx = car.x - h.x, dz = car.z - h.z, d = Math.hypot(dx, dz);
      if (d < R) { out.x = h.x + dx / (d || 1) * (R + 14); out.z = h.z + dz / (d || 1) * (R + 14); return true; }
      return passes(car, out, h.x, h.z, R * 0.7) ? detour(api, car, out, tx, tz) : false;
    },
  };
}

// ---- the show ------------------------------------------------------------------------------------------------------
// Every so often the announcer calls an event, round the list in turn: a banner and a siren, then for `time` seconds the
// hazards that name its tag in their `wild` go wild. It waits for the wave's own banner to clear first.
function show(api, h, S) {
  let n = 0;
  h.event = null; h.left = 0; h.t = h.first ?? 40;   // (h.t: seconds to the next event)
  return {
    step(dt, live) {
      const on = live && (api.game.state === 'play' || api.game.state === 'dead');
      if (S.event) {
        h.left = Math.max(0, h.left - dt);
        if (h.left <= 0 || !on) { S.event = h.event = null; h.t = h.every ?? 45; if (on) api.toast(`${h.name} is over`, 'Back to normal'); }
        return;
      }
      if (!on || (h.t -= dt) > 0) return;
      if (api.game.banner > 0.2) { h.t = 0.4; return; }
      const ev = h.events[n++ % h.events.length];
      S.event = h.event = ev.tag; h.name = ev.name.replace(/!$/, ''); h.left = h.time ?? 15;
      api.banner(ev.name, ev.sub || ''); api.game.banner = 3;
      api.sound('c.alarm', 1); api.sound('thunder', 0.5); api.sfx.play('ui_go', 1);
      if (h.onEvent) h.onEvent(ev);
    },
  };
}

const KINDS = { grates, press, barrels, boost, conveyor, bounds, keepout, sweeper, hammer, jets, magnet, show };
