// The sounds of driving, under the engine: what racing games layer to make a car feel like it is on the road.
//  - Tyres: a squeal on tarmac (squeal_loop) that comes from how hard the tyres are working, not only from a drift:
//    cornering (the turn's sideways pull, yawRate x forward speed, against the car's grip), sliding (the drift's skid),
//    braking hard at speed, and the wheels spinning up from a standstill. On dirt, grass and a map's rough ground the
//    same work plays the gravel skid (skid_loop) instead. The nearest squealing rival gets a loop of its own.
//  - Scraping: metal grinding (scrape_loop) while the player's car slides along a wall or door to door with another
//    car (vehicle.js touch(), main.js bump()), louder and higher the faster it goes.
//  - Wind (wind_loop) rising with speed, and a whoosh when a car rushes past close by.
//  - Knocks (bump) for cars touching too gently to crunch, a body thump under each crash's crunch, bits falling off
//    after a big one (debris) and sometimes glass, a thump coming down from a jump (land).
//  - The player's engine wheezing and hissing (hiss_loop) once it is badly hurt (with the black smoke, crumple.js).
// The same set plays in every mode; ROAD_MIX in tuning.js balances it for each (the race's tarmac and speed, the
// arena's dirt and crowd of cars, the zombie base's storm).
import { ROAD_MIX } from './tuning.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function makeRoadSound({ sfx, sound, map }) {
  const M = { ...ROAD_MIX.all, ...(ROAD_MIX[map.mode] || {}) };
  let L = null;   // the loops (made once the audio is up)
  const seen = new WeakMap();   // per rival: how far from the player it was last frame (for the pass-bys)
  const later = [];   // sounds waiting a moment: [time left, name, volume, x, z]

  // how hard car c's tyres are working (0 to 1), and how much of that is on tarmac
  function tyres(c, dt) {
    if (c.dead || (c.y || 0) > 0.3) { c.spinT = 0; return 0; }
    const S = c.spec, vf = c.fwd, sp = c.speed;
    const corner = clamp((Math.abs((c.yawRate || 0) * vf) / (S.grip * M.latGrip) - M.cornerFrom) / (1 - M.cornerFrom), 0, 1) * clamp((sp - 12) / 14, 0, 1);
    const slide = sp > 12 ? clamp(c.skid || 0, 0, 1) : 0;
    const brake = (c.brake || 0) > 0.4 && vf > M.brakeFrom ? clamp((vf - M.brakeFrom) / 40, 0.25, 0.7) * c.brake : 0;
    // pulling away hard from (nearly) a standstill: a short chirp as the wheels spin up
    if ((c.throttle || 0) > 0.8 && Math.abs(vf) < 4 && !(c.spinT > 0) && !c.spun) { c.spinT = 0.45; c.spun = true; }
    if ((c.throttle || 0) < 0.3 || Math.abs(vf) > 30) c.spun = false;
    c.spinT = Math.max(0, (c.spinT || 0) - dt);
    const spin = c.spinT > 0 ? M.spin * c.spinT / 0.45 * clamp(S.accel / 70, 0.6, 1.2) : 0;
    return Math.max(corner * 0.85, slide, brake, spin);
  }
  // how much of the ground under c squeals (the rest is the gravel skid)
  const tarmac = (c) => M.asphalt * (1 - (map.surface ? clamp(map.surface(c.x, c.z), 0, 1) : 0));

  // every frame: player is the listener's car (null: all quiet), cars every car, on false when the sound is off or the
  // round isn't running
  function step(dt, player, cars, on) {
    if (!L) L = { squeal: sfx.loop('squeal_loop'), gravel: sfx.loop('skid_loop'), rival: sfx.loop('squeal_loop'), scrape: sfx.loop('scrape_loop'), wind: sfx.loop('wind_loop'), hiss: sfx.loop('hiss_loop') };
    for (let i = later.length - 1; i >= 0; i--) { const w = later[i]; if ((w[0] -= dt) <= 0) { later.splice(i, 1); sfx.play(w[1], w[2], w[3], w[4], { gap: 0.15 }); } }
    if (!on || !player || player.dead) { for (const k in L) L[k].set(0); return; }
    const p = player, sp = p.speed, k = clamp(sp / p.spec.top, 0, 1.4);
    // the player's tyres
    const t = tyres(p, dt), hard = tarmac(p);
    const wob = 1 + 0.03 * Math.sin(performance.now() / 170) + 0.02 * Math.sin(performance.now() / 61);   // a squeal never holds one note
    L.squeal.set(t * hard * M.squeal, (0.88 + 0.22 * t + 0.12 * clamp(sp / 120, 0, 1)) * wob, p.x, p.z);
    L.gravel.set(t * (1 - hard) * 0.9 * M.gravel, 0.85 + clamp(sp / 160, 0, 0.3) + 0.12 * t, p.x, p.z);
    // the loudest squealing rival near by
    let best = null, bv = 0;
    for (const c of cars) {
      if (c === p || c.dead || !c.spec) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z); if (d > 90) { seen.delete(c); continue; }
      const v = tyres(c, dt) * tarmac(c) / (1 + d / 30); if (v > bv) { bv = v; best = c; }
      // a pass-by: a car going by close, much faster or slower than the player, whooshes as it is closest
      const was = seen.get(c); seen.set(c, d);
      if (was !== undefined && d > was && was < M.passNear && M.whoosh > 0) {
        const rel = Math.hypot(c.vx - p.vx, c.vz - p.vz);
        if (rel > M.passSpeed && !c.passT) { c.passT = 1; sfx.play('whoosh', M.whoosh * clamp(rel / 70, 0.35, 1), c.x, c.z, { gap: 0.25, rate: 0.85 + clamp(rel / 220, 0, 0.4) }); }
      }
      if (c.passT && d > M.passNear * 1.5) c.passT = 0;
    }
    if (best) L.rival.set(M.rivals * clamp(tyres(best, 0) * tarmac(best), 0, 1) * M.squeal, 0.9 + 0.2 * clamp(best.speed / 120, 0, 1), best.x, best.z);
    else L.rival.set(0);
    // grinding along a wall or another car
    const rub = p.rubT > 0 ? clamp((p.rub - 6) / 40, 0, 1) : 0;
    L.scrape.set(rub * M.scrape, 0.8 + 0.35 * rub, p.x, p.z);
    // the wind, from windFrom up (and in the air off a jump)
    const w = clamp((sp - M.windFrom) / 80, 0, 1), air = (p.y || 0) > 0.5 ? 0.25 : 0;
    L.wind.set(M.wind * Math.max(w * w, air), 0.8 + 0.45 * w, p.x, p.z);
    // badly hurt: the engine wheezes, more on the throttle
    const hurt = p.maxHp ? clamp((M.hissFrom - p.hp / p.maxHp) / (M.hissFrom * 0.7), 0, 1) : 0;
    L.hiss.set(M.hiss * hurt * (0.55 + 0.45 * Math.abs(p.throttle || 0)), 0.9 + 0.25 * k, p.x, p.z);
  }

  // two cars meeting (main.js bump(), which also has them touch() for the grind door to door): hit is how fast they
  // closed, at (x, z)
  function meet(a, b, hit, x, z) {
    if (hit < 4) return;
    if (hit < 10) {
      // (two cars shoving against each other knock once, not on and on)
      const now = performance.now() / 1000; if (now - (a.knockAt || -9) < 0.5 || now - (b.knockAt || -9) < 0.5) return;
      a.knockAt = b.knockAt = now;
      sfx.play('bump', M.knock * clamp(hit / 12, 0.3, 0.8), x, z, { gap: M.knockGap, jitter: 0.1 }); return;
    }
    sfx.play('bump', M.body * clamp(hit / 40, 0.4, 1), x, z, { gap: M.knockGap, rate: 0.85 });   // the bodies' thump under the crunch
    big(hit, x, z);
  }
  // a car into a wall hard enough to hurt (main.js crashHooks.bump)
  function wall(c, into, x, z) {
    sfx.play('bump', M.body * clamp(into / 40, 0.35, 1), x, z, { gap: M.knockGap, rate: 0.8 });
    big(into, x, z);
  }
  // after a big hit: bits falling off, and now and then glass
  function big(hit, x, z) {
    if (hit < 45) return;
    later.push([0.12 + Math.random() * 0.1, 'debris', M.debris * clamp(hit / 80, 0.4, 1), x, z]);
    if (Math.random() < M.glass) sound('glass', clamp(hit / 90, 0.3, 0.8), x, 2, z);
  }
  // a car wrecked: its bits come down a moment after the blast
  function wrecked(x, z) { later.push([0.35, 'debris', M.debris, x, z]); }
  // down from a jump (specials.js landed)
  function land(c, speed) {
    if (speed < 10) return;
    sfx.play('land', M.land * clamp(speed / 35, 0.35, 1), c.x, c.z, { gap: 0.2 });
  }
  return { step, meet, wall, wrecked, land, mix: M };
}
