// What moves at Camp Deadfall (maps/base.js), on the stands basekit.js models:
//   the sentry guns   four of them on the corners of the crossing. Dead until someone drives over the fire control
//                     switch by headquarters; then for SENTRY.on seconds each one turns to the nearest of the dead in
//                     reach and shoots it, a green lamp on it, and then they are down for SENTRY.cool seconds while
//                     the switch comes back. A wrecked gun stays wrecked.
//   the radar         its dish turns on the trailer's post until the trailer is wrecked.
//   the siren         wails from its pole by headquarters (a sound made here, no file), louder as you come near, until
//                     the pole is brought down.
// The guns' rounds are the game's own (units/src/fx.js through main.js's api.fx), so they kill the dead as a car's do.
// Each device runs its own guns: online, only the host's rounds count (the others' dead are the host's puppets).
// Draws: two for each gun (its paint, its lamp), one for the dish.
import * as THREE from 'three';
import { makeKit, N } from './fairstalls.js';

export const SENTRY = { range: 95, burst: 9, rate: 3.5, dmg: 34, turn: 5, on: 30, cool: 40, first: 12, y: 4.4, reach: 5.4 };
export const SIREN_SOUND = { vol: 0.42, full: 30, far: 230, loop: 6 };
const OLIVE = 0x5f6a3a, OLIVE_D = 0x475030, STEEL = 0x8e969c, STEEL_D = 0x5c6268, DARK = 0x24262c, YELLOW = 0xe8b830, WHITE = 0xeee8da;
const TAU = Math.PI * 2;

// the gun: twin barrels to the front, on a yoke, its ammunition at its side (turned about its own middle)
function gunGeo() {
  const K = makeKit(0, 0, 0, true);
  K.b(-2.2, 0, -2.2, 4.4, 1, 4.4, STEEL_D); K.b(-2.7, 1, -1, 0.9, 4.2, 2, STEEL_D); K.b(1.8, 1, -1, 0.9, 4.2, 2, STEEL_D);
  K.b(-1.8, 2.2, -4.4, 3.6, 2.8, 7.6, OLIVE); K.b(-1.8, 5, -4, 3.6, 0.5, 5, OLIVE_D);
  K.b(-1.4, 3, 3.2, 0.9, 0.9, 8, DARK); K.b(0.5, 3, 3.2, 0.9, 0.9, 8, DARK); K.b(-1.6, 2.8, 10, 3.2, 1.3, 1.2, DARK); K.b(-1.5, 2.9, 5.6, 3, 1.1, 0.8, STEEL_D);
  K.b(2.7, 1.6, -4, 2.6, 3, 4.4, OLIVE_D); K.b(5.3, 2.6, -3.6, 0.1, 0.7, 3.6, YELLOW); K.b(1.8, 3.4, -1, 1, 0.8, 1.2, DARK);
  K.b(-1, 5.5, -3.4, 2, 1.6, 2.6, DARK);
  return K.geos().paint;
}
const lampGeo = (rgb) => { const K = makeKit(0, 0, 0, true); K.l(-0.7, 7.1, -2.8, 1.4, 1.2, 1.4, rgb, 0, 1.2); K.l(-0.6, 5.9, -0.9, 1.2, 0.8, 0.3, rgb, 0, 1); return K.geos().lit; };
// the radar's dish: a curved sheet of mesh on a frame, the horn out in front of it (turned about its post)
function dishGeo() {
  const K = makeKit(0, 0, 0, true);
  K.b(-1.4, 0, -1.4, 2.8, 2, 2.8, STEEL_D); K.b(-0.6, 2, -2.4, 1.2, 1.2, 2.4, STEEL_D);
  for (let i = -3; i <= 3; i++) { const z = -1.2 - Math.abs(i) * Math.abs(i) * 0.32; K.b(i * 3 - 1.5, 1, z, 3, 9, 0.7, i & 1 ? STEEL : WHITE); K.b(i * 3 - 1.5, 5, z - 0.5, 3, 0.8, 0.5, STEEL_D); }
  K.b(-10.5, 0.4, -4.6, 21, 0.8, 0.8, STEEL_D); K.b(-10.5, 9.8, -4.6, 21, 0.8, 0.8, STEEL_D);
  K.b(-0.4, 1.4, -1, 0.8, 0.8, 8, DARK); K.b(-1, 4, 6.4, 2, 2.4, 1.4, DARK); K.b(-0.4, 2, 6.8, 0.8, 2.4, 0.6, DARK);
  return K.geos().paint;
}

// a siren's wail, made here: a tone that climbs and falls once in SIREN_SOUND.loop seconds (a whole number of waves, so
// it comes round without a click), a few harmonics, a second voice a shade off it
function sirenSound(ctx) {
  const T = SIREN_SOUND.loop, sr = Math.min(22050, ctx.sampleRate), n = Math.round(T * sr), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  const f0 = 400, A = 200;   // (f0 + A / 2) * T waves in all: 3000
  for (let i = 0; i < n; i++) {
    const t = i / sr, ph = TAU * (f0 * t + A / 2 * (t - Math.sin(TAU * t / T) * T / TAU)), lvl = 0.55 + 0.45 * (0.5 - 0.5 * Math.cos(TAU * t / T));
    let v = 0; for (let h = 1; h <= 6; h++) v += Math.sin(ph * h) / (h * h * 0.6 + 0.4);
    v += 0.5 * Math.sin(ph * 1.5);
    d[i] = v * 0.28 * lvl;
  }
  return buf;
}

// api: main.js's api; spec: { sentries, radar, siren } (the map's things: their `dead` is read here); mats: the kit's
// materials (fairstalls.js makeStalls().mats)
export function makeBaseMoves(api, spec, mats) {
  const { scene } = api, lit = mats.lit[4];
  const paint = mats.paint, gGun = gunGeo(), gOn = lampGeo(N.green), gOff = lampGeo(N.red);
  const guns = spec.sentries.map((o, i) => {
    const g = new THREE.Group(); g.position.set(o.x, SENTRY.y, o.z); g.rotation.y = i * 1.3;
    const m = new THREE.Mesh(gGun, paint); m.castShadow = true;
    const on = new THREE.Mesh(gOn, lit), off = new THREE.Mesh(gOff, lit); on.visible = false;
    g.add(m, on, off); scene.add(g);
    return { o, g, on, off, yaw: g.rotation.y, t: i * 0.07, seek: 0, target: null, idle: i * 2.1, skip: null, skipT: 0, spent: 0 };
  });
  const dish = new THREE.Mesh(dishGeo(), paint); dish.castShadow = true;
  const R = spec.radar, rc = Math.cos(R.yaw || 0), rs = Math.sin(R.yaw || 0);
  dish.position.set(R.x + (8 * rc) * 0.5, 10.2, R.z + (-8 * rs) * 0.5); scene.add(dish);
  const GUN = { dmg: SENTRY.dmg, fx: 'mg', carve: 0, wall: 0 };
  const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _a = new THREE.Vector3();
  let armed = 0, cool = SENTRY.first, time = 0, siren = null, sirenRun = 1, wasRound = false;

  function wreck(x, y, z, cols) {
    for (let i = 0; i < 14; i++) api.cube(x + (Math.random() - 0.5) * 4, y + Math.random() * 3, z + (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 30, 8 + Math.random() * 18, (Math.random() - 0.5) * 30, cols[i % cols.length], 0.5 + Math.random() * 0.8);
  }
  function arm(c) {
    if (armed > 0 || cool > 0 || !guns.some((s) => !s.o.dead)) return;
    armed = SENTRY.on;
    api.sfx.play('ui_go', 0.8, c ? c.x : undefined, c ? c.z : undefined); api.sound('alarm', 0.4);
  }
  function stepGun(s, dt, live) {
    if (s.o.dead) { if (s.g.visible) { s.g.visible = false; wreck(s.o.x, SENTRY.y, s.o.z, [OLIVE, OLIVE_D, DARK, STEEL_D]); } return; }
    const up = armed > 0 && live;
    s.on.visible = up; s.off.visible = !up;
    let want;
    if (up) {
      const horde = api.horde && api.horde();
      // the nearest of the dead in reach (but not one it has emptied a burst at for nothing: that one is behind something)
      if ((s.seek -= dt) <= 0 || (s.target && s.target.dead)) {
        s.seek = 0.18; if ((s.skipT -= 0.18) <= 0) s.skip = null;
        let best = null, bd = SENTRY.range;
        if (horde) for (const q of horde.all) { if (q.dead || q === s.skip) continue; const d = Math.hypot(q.x - s.o.x, q.z - s.o.z); if (d < bd) { bd = d; best = q; } }
        if (best !== s.target) s.spent = 0;
        s.target = best;
      }
      const q = s.target;
      if (q && !q.dead) {
        want = Math.atan2(q.x - s.o.x, q.z - s.o.z);
        s.t -= dt;
        const off = Math.abs(((want - s.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI);
        if (s.t <= 0 && off < 0.14 && api.fx) {
          s.t = 1 / SENTRY.rate;
          if (++s.spent > SENTRY.burst) { s.skip = q; s.skipT = 6; s.target = null; s.seek = 0; }
          const sy = Math.sin(s.yaw), cy = Math.cos(s.yaw), side = (s.flip = !s.flip) ? 0.5 : -0.5;
          _p.set(s.o.x + sy * SENTRY.reach + cy * side, SENTRY.y + 1.7, s.o.z + cy * SENTRY.reach - sy * side);
          _a.set(q.x, 2.6, q.z); _d.subVectors(_a, _p).normalize();
          const shot = api.fx.fire('mg', _p, _d, _a, null); shot.owner = null; shot.gun = GUN;
          api.sfx.play('mg_shot', 0.5, s.o.x, s.o.z, { gap: 0.05 });
        }
      } else want = s.yaw + dt * 0.8;
    } else want = s.idle + Math.sin(time * 0.3 + s.idle) * 0.9;
    const dy = ((want - s.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI, most = (up ? SENTRY.turn : 0.5) * dt;
    s.yaw += Math.max(-most, Math.min(most, dy)); s.g.rotation.y = s.yaw;
  }
  function stepSiren(dt) {
    if (!siren) { if (!api.sfx.make('base_siren', sirenSound)) return; siren = api.sfx.loop('base_siren', { hold: 0.5 }); }
    const S = spec.siren;
    if (S.dead) { if (sirenRun <= 0) return; sirenRun = Math.max(0, sirenRun - dt / 2.2); if (sirenRun <= 0) { siren.stop(); return; } }
    const P = api.player || api.camera.position, d = Math.hypot(P.x - S.x, P.z - S.z);
    const t = Math.max(0, Math.min(1, (SIREN_SOUND.far - d) / (SIREN_SOUND.far - SIREN_SOUND.full))), want = t * t * (0.3 + 0.7 * t);
    siren.set(SIREN_SOUND.vol * want * Math.pow(1 + d / 45, 1.4) * sirenRun, 0.4 + 0.6 * sirenRun, S.x, S.z);
  }
  return {
    arm,
    // is the switch up? (the guns are down, rested, and one at least still stands)
    ready: () => armed <= 0 && cool <= 0 && guns.some((s) => !s.o.dead),
    get armed() { return armed; }, get cool() { return cool; }, guns, siren: () => siren,
    step(dt, live) {
      time += dt;
      const m = api.mode, round = !!m && m.phase === 'run';
      if (round && !wasRound) { armed = 0; cool = SENTRY.first; }   // a new round: the guns are down, the switch comes up soon
      wasRound = round;
      if (round) {
        if (armed > 0) { if ((armed -= dt) <= 0) { armed = 0; cool = SENTRY.cool; api.sfx.play('ui_tab', 0.7); } }
        else if (cool > 0) cool = Math.max(0, cool - dt);
      }
      for (const s of guns) stepGun(s, dt, round);
      if (R.dead) { if (dish.visible) { dish.visible = false; wreck(dish.position.x, 10, dish.position.z, [STEEL, WHITE, STEEL_D]); } } else dish.rotation.y += dt * 1.3;
      stepSiren(dt);
    },
    radar(Rd, s, ox, oy) {
      Rd.fillStyle = armed > 0 ? 'rgba(110,255,140,0.95)' : 'rgba(255,120,100,0.8)';
      for (const g of guns) if (!g.o.dead) Rd.fillRect(ox + (g.o.x - 2) * s, oy + (g.o.z - 2) * s, 4 * s, 4 * s);
    },
  };
}
