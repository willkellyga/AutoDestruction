// The weapons and gadgets that need more than the shared rounds and rockets (units/src/fx.js): the flamethrower's jet
// and the fires it leaves on cars, the seeker missiles' steering, the mortar's lobbed shells, and the gadgets beyond
// nitro and the repair kit: the shield, the oil slick and the jump jets (the car's own hop is in vehicle.js).
//
// main.js hands over what these need: the cars, the effects, the sounds, damage() and a blast that credits the car
// that fired it.
import * as THREE from 'three';
import { WEAPONS } from '../../units/src/fx.js';
import { solid } from '../../src/world.js';
import { mote, puff, igniteAt, sparks, dust, smoke, ring } from '../../src/sim.js';
import { AI } from './tuning.js';
import { makePixelFire } from './pixelfire.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// the seeker missiles: slower off the rail than the rocket pod's, and they turn hard after their car
WEAPONS.missile = { kind: 'rocket', speed: 46, top: 132, acc: 200, turn: 4.4, spread: 0.08, life: 4.6, sound: 'launch', vol: 0.7, r: 3.6, scale: 0.85 };

const GRAV = 70;   // the mortar's shells fall at this (voxels a second squared)
const STOMP = { base: 30, k: 1.1 };   // coming down on another car, off the jump jets or a ramp: this, and this for each voxel a second it was falling (times the car's weight)
const _d = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Vector3();

export function makeSpecials({ scene, fx, sfx, cars, extras, player, damage, blast, friendly, cube, chip, mobile }) {
  const enemy = (c, o) => o !== c && !o.dead && !o.gone && (!friendly() || o.dummy);
  const pix = makePixelFire(scene, { mobile });   // the fire's blocks (pixelfire.js)
  // the rivals' guns do AI.dmg of the player's to cars (main.js); their flames the same
  const cut = (c) => (c && c.rival ? AI.dmg : 1);

  // ---- the flamethrower ----------------------------------------------------------------------------------------
  // One puff of the jet: fire along the line to the aim point, cut short by a wall, burning every car and zombie in a
  // cone that widens along it. What it touches keeps burning for a few seconds (burn, below). The look is block fire
  // (pixelfire.js); a side burner (w under 1) is a thinner jet.
  const FLAME = { widen: 0.08, burnFor: 2.5, zombies: 3 };   // cone half-width grows this per voxel; seconds a car burns on; zombies one puff can burn
  function flame(c, G, from, aim, i = 0) {
    const g = G.g;
    _d.subVectors(aim, from); _d.y = clamp(_d.y / Math.max(1, Math.hypot(_d.x, _d.z)), -0.25, 0.3) * Math.hypot(_d.x, _d.z); _d.normalize();
    let reach = g.range, wall = false;
    for (let t = 2; t < g.range; t += 1.5) {
      const x = from.x + _d.x * t, y = from.y + _d.y * t, z = from.z + _d.z * t;
      if (y <= 0.4 || solid(Math.floor(x), Math.floor(y), Math.floor(z))) { reach = t; wall = y > 0.4; break; }
    }
    // the look: the nozzle pours blocks every frame until the next puff (step, below)
    const J = (G.jets || (G.jets = []))[i] || (G.jets[i] = { d: new THREE.Vector3(), left: 0 });
    J.d.copy(_d); J.reach = g.range; J.w = G.slot === 'door' ? 0.7 : 1; J.left = 1.6 / (g.rate || 14);
    // what it burns: cars in the cone
    for (const o of cars) {
      if (!enemy(c, o)) continue;
      o.centre(_c); _c.y = from.y;
      const t = (_c.x - from.x) * _d.x + (_c.z - from.z) * _d.z;
      if (t < -2 || t > reach + o.wide) continue;
      const px = _c.x - (from.x + _d.x * t), pz = _c.z - (from.z + _d.z * t);
      if (Math.hypot(px, pz) > o.wide + 1.5 + Math.max(0, t) * FLAME.widen) continue;
      damage(o, g.dmg * cut(c), c);
      if (!o.dead) { o.burnT = Math.max(o.burnT || 0, FLAME.burnFor); o.burnBy = c; o.burnDps = (g.burn || 4) * cut(c); }
    }
    // and the dead on foot (survival): the same cone, a few of them a puff
    let n = 0;
    for (const e of extras) if (e.cone) n += e.cone(from, _d, reach, 1.5, FLAME.widen, g.dmg, c, g, FLAME.zombies - n);
    // (anything else a mode puts out to be shot: along the middle of the stream)
    for (let t = 3; t < reach && n < FLAME.zombies; t += 2.5) for (const e of extras) {
      if (e.cone) continue;
      _p.copy(from).addScaledVector(_d, t); _p.y = Math.min(_p.y, 3);
      if (e.solid(_p.x, _p.y, _p.z) && e.hit(_p, g.dmg, c, g, _d)) { n++; break; }
    }
    if (wall && Math.random() < 0.05) { _p.copy(from).addScaledVector(_d, reach); igniteAt(_p.x, _p.y, _p.z, 2.4, 0.5); }
    c.flameT = 0.15;
  }
  // a burning car: block flames licking up off it, and its health going down
  function burn(c, dt) {
    if (!(c.burnT > 0)) return;
    if (c.dead || c.gone || c.shieldT > 0) { c.burnT = 0; return; }
    c.burnT -= dt;
    c.burnAcc = (c.burnAcc || 0) + c.burnDps * dt;
    if (c.burnAcc >= 2) { damage(c, c.burnAcc, c.burnBy); c.burnAcc = 0; }
    pix.burning(c.x + Math.sin(c.yaw) * c.mid, c.h + c.top * 0.55, c.z + Math.cos(c.yaw) * c.mid, c.yaw, c.half, c.wide, dt);
  }

  // ---- the seeker missiles ---------------------------------------------------------------------------------------
  // the car a seeker locks on to: whichever enemy is nearest the aim point (within 70), else nearest the line of fire
  function lockFor(c, aim, cone = 0.55) {
    let best = null, bd = 70;
    for (const o of cars) { if (!enemy(c, o)) continue; const d = Math.hypot(o.x - aim.x, o.z - aim.z) - o.wide; if (d < bd) { bd = d; best = o; } }
    if (best) return best;
    let ba = cone;
    for (const o of cars) {
      if (!enemy(c, o)) continue;
      const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz); if (d > 320) continue;
      const a = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - c.gunYaw), Math.cos(Math.atan2(dx, dz) - c.gunYaw)));
      if (a < ba) { ba = a; best = o; }
    }
    // nothing to lock on among the cars (survival, where the cars are on the same side): the zombie nearest the aim point
    if (!best) for (const e of extras) if (e.closest && (best = e.closest(aim.x, aim.z, 40))) break;
    return best;
  }
  const seekers = [];
  function seek(shot, c, aim) {
    const t = lockFor(c, aim);
    if (t) seekers.push({ shot, car: t });
  }
  function stepSeekers() {
    for (let i = seekers.length - 1; i >= 0; i--) {
      const S = seekers[i];
      if (!fx.shots.includes(S.shot)) { seekers.splice(i, 1); continue; }
      const t = S.car; if (t.dead || t.gone || t.shieldT > 0) continue;   // (it flies on to the last place it saw)
      const d = S.shot.p.distanceTo(t.centre(_c)), lead = d / 150, mid = t.mid || 0;   // (a zombie has no mid)
      S.shot.aim.set(t.x + Math.sin(t.yaw) * mid + (t.vx || 0) * lead, (t.mid === undefined ? 3 : 1.6) + (t.h ?? (t.y || 0)), t.z + Math.cos(t.yaw) * mid + (t.vz || 0) * lead);
    }
  }

  // ---- the mortar ----------------------------------------------------------------------------------------------
  // A shell thrown high to come down on the aim point (as far as the roof lets it turn): it falls on whatever is under
  // it there, over any wall or car in between. The player sees where it will land.
  const shells = [];
  const shellGeo = new THREE.SphereGeometry(0.55, 8, 6), shellMat = new THREE.MeshStandardMaterial({ color: 0x3b4030, roughness: 0.6, metalness: 0.3 });
  const markGeo = new THREE.RingGeometry(0.82, 1, 32).rotateX(-Math.PI / 2), markMat = new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.75, depthWrite: false });
  function lob(c, G, from, aim) {
    const g = G.g, dx = aim.x - from.x, dz = aim.z - from.z, flat = Math.hypot(dx, dz) || 1;
    const D = clamp(flat, 26, g.range || 240), tx = from.x + dx / flat * D, tz = from.z + dz / flat * D, ty = clamp(aim.y, 0.5, 8);
    const T = 0.95 + D / 160;
    const s = { c, g, x: from.x, y: from.y, z: from.z, vx: (tx - from.x) / T, vz: (tz - from.z) / T, vy: (ty - from.y + 0.5 * GRAV * T * T) / T, t: 0, T };
    s.mesh = new THREE.Mesh(shellGeo, shellMat); s.mesh.position.set(s.x, s.y, s.z); scene.add(s.mesh);
    if (c === player()) { s.mark = new THREE.Mesh(markGeo, markMat); s.mark.position.set(tx, 0.15, tz); s.mark.scale.setScalar(g.reach * 0.6); s.mark.renderOrder = 2; scene.add(s.mark); }
    shells.push(s);
    smoke(from.x, from.y + 1, from.z, 6, 2.5); sparks(from.x, from.y + 0.5, from.z, 8, 1, 0.75, 0.35, 18);
    sfx.play('cannon_shot', c === player() ? 0.9 : 0.75, from.x, from.z, { rate: 0.62 });
    c.vy = Math.max(c.vy || 0, 0); c.vx -= Math.sin(c.yaw) * 2; c.vz -= Math.cos(c.yaw) * 2;
  }
  function stepShells(dt) {
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i]; s.t += dt;
      const sub = 3; let hit = 0, car = null;
      for (let k = 0; k < sub && !hit; k++) {
        const h = dt / sub; s.vy -= GRAV * h; s.x += s.vx * h; s.y += s.vy * h; s.z += s.vz * h;
        if (s.y <= 0.3) { s.y = 0.3; hit = 2; break; }
        if (s.vy < 0) for (const o of cars) if (o !== s.c && !o.dead && !o.gone && o.inside(s.x, s.y, s.z, 0.4)) { hit = 1; car = o; break; }
        if (!hit && solid(Math.floor(s.x), Math.floor(s.y), Math.floor(s.z))) hit = 3;
      }
      s.mesh.position.set(s.x, s.y, s.z);
      if (Math.random() < 0.6) puff(s.x, s.y, s.z, 0, 0.5, 0, 0.9, 0.7, 0.45, 1.2, 0.5);
      if (s.mark) { const k = clamp(s.t / s.T, 0, 1); s.mark.material.opacity = 0.35 + 0.5 * k; }
      if (!hit && s.t < 8) continue;
      shells.splice(i, 1); s.mesh.removeFromParent(); if (s.mark) s.mark.removeFromParent();
      if (car && !friendly()) damage(car, s.g.dmg * 0.6 * cut(s.c), s.c);   // a direct hit on top of a car, besides the blast
      blast(s.c, s.g, s.x, Math.max(1, s.y), s.z, hit === 3);
    }
  }

  // ---- the shield ------------------------------------------------------------------------------------------------
  // a bubble round the car: faint, brighter at its edge, flaring where it is struck
  const bubbleGeo = new THREE.SphereGeometry(1, 28, 18);
  const bubbleMat = () => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { t: { value: 0 }, hit: { value: 0 }, fade: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); vP = position; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float t; uniform float hit; uniform float fade; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        f = f * f;
        float hex = step(0.92, abs(sin(vP.x * 9.0 + t * 1.5)) * abs(sin(vP.y * 9.0)) + 0.4 * abs(sin(vP.z * 9.0 - t)));
        float a = (0.06 + 0.55 * f + 0.12 * hex + 0.5 * hit) * fade;
        gl_FragColor = vec4(vec3(0.35, 0.75, 1.0) * a, 1.0);
      }`,
  });
  function shieldOn(c, time) {
    c.shieldT = time;
    if (!c.bubble) { c.bubble = new THREE.Mesh(bubbleGeo, bubbleMat()); c.bubble.renderOrder = 12; c.bubble.frustumCulled = false; scene.add(c.bubble); }
    c.bubble.visible = true; c.bubbleHit = 0.6;
    sfx.play('arc_zap', c === player() ? 0.8 : 0.6, c.x, c.z, { rate: 0.55 });
  }
  function shieldHit(c) { c.bubbleHit = 1; sfx.play('tink', 0.5, c.x, c.z, { rate: 0.55, gap: 0.08 }); }
  function stepShield(c, dt) {
    if (c.shieldT > 0) {
      c.shieldT -= dt;
      if (c.shieldT <= 0 || c.dead) { c.shieldT = 0; if (c.bubble) c.bubble.visible = false; sfx.play('servo', 0.5, c.x, c.z, { rate: 1.4 }); }
    }
    const b = c.bubble; if (!b || !b.visible) return;
    if (c.gone) { b.removeFromParent(); c.bubble = null; return; }
    c.bubbleHit = Math.max(0, (c.bubbleHit || 0) - dt * 3);
    const u = b.material.uniforms; u.t.value += dt; u.hit.value = c.bubbleHit; u.fade.value = c.shieldT < 0.8 ? ((c.shieldT * 8) % 1 < 0.5 ? 0.4 : 1) : 1;   // it flickers before it goes
    b.position.set(c.x + Math.sin(c.yaw) * c.mid, c.h + c.top * 0.42, c.z + Math.cos(c.yaw) * c.mid);
    b.rotation.y = c.yaw; b.scale.set(c.wide + 2.2, c.top * 0.75 + 1.4, c.half + 2.4);
  }

  // ---- the oil slick -------------------------------------------------------------------------------------------
  // a black pool behind the car, shining, that spreads for a moment and lasts a while; a car driving into it loses its
  // grip and spins (vehicle.js oilT)
  const slicks = [];
  let oilMat = null;
  function oilTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64);
    gr.addColorStop(0, 'rgba(8,8,10,0.95)'); gr.addColorStop(0.78, 'rgba(10,10,14,0.92)'); gr.addColorStop(1, 'rgba(10,10,14,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    // a sheen of colour across it, like oil on water
    for (let i = 0; i < 7; i++) {
      g.strokeStyle = `hsla(${(i * 47 + 180) % 360}, 55%, 42%, 0.1)`; g.lineWidth = 3 + i;
      g.beginPath(); g.ellipse(64 + Math.sin(i) * 8, 64 + Math.cos(i * 1.7) * 6, 18 + i * 5, 12 + i * 4, i * 0.6, 0, Math.PI * 1.4); g.stroke();
    }
    return new THREE.CanvasTexture(cv);
  }
  const oilGeo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
  function oil(c, O) {
    if (!oilMat) oilMat = new THREE.MeshStandardMaterial({ map: oilTexture(), transparent: true, depthWrite: false, roughness: 0.08, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const s = Math.sin(c.yaw), co = Math.cos(c.yaw), back = c.half - c.mid + O.r * 0.55;
    const x = c.x - s * back, z = c.z - co * back;
    if (slicks.length >= 8) { const old = slicks.shift(); old.mesh.removeFromParent(); }
    const m = new THREE.Mesh(oilGeo, oilMat.clone()); m.position.set(x, 0.08 + slicks.length * 0.004, z); m.rotation.y = Math.random() * 6.28; m.renderOrder = 1; m.scale.setScalar(0.5);
    scene.add(m);
    slicks.push({ x, z, r: O.r, life: O.life, t: 0, owner: c, mesh: m });
    sfx.play('mine_drop', c === player() ? 0.9 : 0.7, x, z, { rate: 0.6 });
    for (let k = 0; k < 10; k++) cube && cube(c.x - s * (c.half - c.mid), 1.4, c.z - co * (c.half - c.mid), -s * 6 + (Math.random() - 0.5) * 5, 2 + Math.random() * 3, -co * 6 + (Math.random() - 0.5) * 5, 0x101014, 0.25);
  }
  function stepSlicks(dt) {
    for (let i = slicks.length - 1; i >= 0; i--) {
      const S = slicks[i]; S.t += dt;
      const grow = clamp(S.t / 0.45, 0, 1), r = S.r * (0.35 + 0.65 * grow);
      S.mesh.scale.setScalar(r);
      if (S.t > S.life - 2) S.mesh.material.opacity = clamp((S.life - S.t) / 2, 0, 1);
      if (S.t >= S.life) { slicks.splice(i, 1); S.mesh.removeFromParent(); S.mesh.material.dispose(); continue; }
      for (const o of cars) {
        if (o.dead || o.gone || (o.y || 0) > 0.6 || (o === S.owner && S.t < 1.6)) continue;
        if (Math.hypot(o.x + Math.sin(o.yaw) * o.mid - S.x, o.z + Math.cos(o.yaw) * o.mid - S.z) > r + o.wide * 0.4) continue;
        if (!(o.oilT > 0) && o.speed > 12) {   // into it: the back steps out, one way or the other
          o.yawRate += (Math.random() < 0.5 ? -1 : 1) * (2.6 + Math.min(3, o.speed * 0.035));
          if (o === player() || S.owner === player()) sfx.play('scrape', 0.6, o.x, o.z, { rate: 0.7 });
          if (S.owner && S.owner !== o) o.lastBy = S.owner;
        }
        o.oilT = Math.max(o.oilT || 0, 0.9);
      }
    }
  }

  // ---- the jump jets -------------------------------------------------------------------------------------------
  // the car's hop is in vehicle.js (y, vy); here the jets' flame and dust as it goes up, the landing, and coming down
  // on top of another car
  function jump(c, J) {
    if ((c.y || 0) > 0.1) return false;
    c.vy = J.vy; c.y = 0.05;
    dust(c.x, 0.6, c.z, 10, 6); ring(c.x, 0.4, c.z, c.wide * 3, 0xffe0b0, 0.4);
    jets(c, 12);
    sfx.play('nitro', c === player() ? 1 : 0.7, c.x, c.z, { rate: 1.35 });
    return true;
  }
  function jets(c, n) {
    const s = Math.sin(c.yaw), co = Math.cos(c.yaw), y = c.h + 0.6;
    for (let k = 0; k < n; k++) {
      const u = (Math.random() < 0.5 ? -0.6 : 0.6) * c.half, v = (Math.random() < 0.5 ? -0.7 : 0.7) * c.wide;
      mote(c.x + s * (c.mid + u) + co * v, y, c.z + co * (c.mid + u) - s * v, (Math.random() - 0.5) * 3, -24 - Math.random() * 14, (Math.random() - 0.5) * 3, 0.9 + Math.random() * 0.9, 0.12 + Math.random() * 0.1, 1, 0.62 + Math.random() * 0.25, 0.3);
    }
  }
  // each frame: jets while it rises; coming down on another car crushes it and bounces off
  function stepAir(c) {
    if (!((c.y || 0) > 0.05)) return;
    if (c.vy > 8) jets(c, 2);
    if (c.vy >= -5 || c.dead) return;   // (coming down in earnest: not the hops of a rough floor)
    for (const o of cars) {
      if (o === c || o.dead || o.gone || (o.y || 0) > 0.5) continue;
      if (c.h > o.h + o.top + 1.2 || c.h < o.h - 1) continue;   // (heights in the world: the floor may be a heap of dirt, maps/arena.js)
      const dx = (c.x + Math.sin(c.yaw) * c.mid) - (o.x + Math.sin(o.yaw) * o.mid), dz = (c.z + Math.cos(c.yaw) * c.mid) - (o.z + Math.cos(o.yaw) * o.mid);
      if (Math.hypot(dx, dz) > Math.max(o.half, o.wide) * 0.9 + c.wide * 0.5) continue;
      const hard = Math.abs(c.vy);
      if (!friendly() || o.dummy) damage(o, STOMP.base + hard * STOMP.k * (c.spec.mass || 1), c, true);   // (true: a car driven on another device is told: net.js)
      _p.set(o.x + Math.sin(o.yaw) * o.mid, o.top, o.z + Math.cos(o.yaw) * o.mid);
      o.unit.hit(_p, 2.4, chip, 10);
      sparks(_p.x, _p.y, _p.z, 18, 1, 0.8, 0.4, 24);
      sfx.play('crunch_heavy', 1, _p.x, _p.z);
      c.vy = 16; c.y = Math.max(c.y, o.h + o.top + 0.6 - (c.fy || 0)); c.vx += dx * 0.8; c.vz += dz * 0.8;
      o.vx *= 0.4; o.vz *= 0.4;
      if (c === player()) c.stomped = 0.4;
      break;
    }
  }
  function landed(c, speed) {
    // coming down from the jump jets on the dead squashes the ones under the car and throws the rest back
    if (speed > 14 && !c.dead) for (const e of extras) if (e.explosion) e.explosion(c.x + Math.sin(c.yaw) * c.mid, 0.5, c.z + Math.cos(c.yaw) * c.mid, Math.max(c.half, c.wide) + 3, 10 + speed * 0.4, c);
    if (speed < 8) return;
    dust(c.x, 0.6, c.z, Math.round(4 + speed * 0.25), 6);
    if (speed > 30) sfx.play('crunch', 0.4, c.x, c.z, { rate: 0.8 });   // (a hard landing; the thump is roadsound.js land())
  }
  // a hop on the garage's turntable: up, and back down onto it (the car stands still there, so this does the falling)
  function hop(c, dt) {
    if (!((c.y || 0) > 0) && !(c.vy > 0)) return;
    c.vy -= GRAV * 0.75 * dt; c.y = (c.y || 0) + c.vy * dt;
    if (c.vy > 8) jets(c, 2);
    if (c.y <= 0) { landed(c, -c.vy); c.y = 0; c.vy = 0; }
  }

  // each frame, from every nozzle still lit: a frame's worth of blocks, out of where the nozzle is now (after the
  // blocks already out have moved, so the stream starts right at the nozzle), going the car's speed as well
  function pour(dt) {
    for (const c of cars) {
      if (!c.guns) continue;
      for (const G of c.guns) {
        if (!G.jets) continue;
        for (let i = 0; i < G.jets.length; i++) {
          const J = G.jets[i]; if (!J || J.left <= 0) continue;
          J.left -= dt;
          if (c.dead || c.gone || !c.muzzle(G, _p, null, i)) { J.left = 0; continue; }
          c.flameClock = (c.flameClock || 0) + dt;
          pix.jet(_p, J.d, J.reach, dt, J.w, c.flameClock, c.vx || 0, c.vz || 0);
        }
      }
    }
  }
  function step(dt) {
    stepSeekers(); stepShells(dt); stepSlicks(dt);
    for (const c of cars) { burn(c, dt); stepShield(c, dt); if (!c.gone) stepAir(c); }
    pix.step(dt); pour(dt);
  }
  // the garage closed, a round over: everything in flight and on the ground goes
  function clear(all = true) {
    for (const s of shells) { s.mesh.removeFromParent(); if (s.mark) s.mark.removeFromParent(); }
    shells.length = 0; seekers.length = 0;
    if (all) { for (const S of slicks) S.mesh.removeFromParent(); slicks.length = 0; pix.clear(); }
  }
  // slicks and shells in the garage's room and yard (south of the map) go when it closes
  function clearOffMap() {
    for (let i = slicks.length - 1; i >= 0; i--) if (slicks[i].z < 0) { slicks[i].mesh.removeFromParent(); slicks.splice(i, 1); }
    for (let i = shells.length - 1; i >= 0; i--) if (shells[i].z < 0) { shells[i].mesh.removeFromParent(); if (shells[i].mark) shells[i].mark.removeFromParent(); shells.splice(i, 1); }
  }
  // a big diesel floored: black smoke out of the back
  function exhaust(c, dt, rev) {
    if (c.dead || c.load.engine !== 'diesel') return;
    const k = Math.max(Math.abs(c.throttle || 0) * (1 - Math.min(1, Math.abs(c.fwd || 0) / c.spec.top) * 0.7), rev || 0);
    if (k < 0.35 || Math.random() > dt * 9 * k) return;
    const s = Math.sin(c.yaw), co = Math.cos(c.yaw), b = c.mid - c.half - 0.3;
    smoke(c.x + s * b - co * 1.2, 0.8 + c.y, c.z + co * b + s * 1.2, 1, 0.3, 0.05);
  }
  return { pix, exhaust, flame, seek, lockFor, lob, shieldOn, shieldHit, oil, jump, landed, hop, step, clear, clearOffMap, slicks, shells };
}
