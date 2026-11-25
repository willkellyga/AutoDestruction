// What the show does at Hammerdown (maps/arena.js) besides its traps:
//   the flame cannons   beside every lip and on the mountain's table (arenakit.js's `pyro`). When a car flies off a
//                       jump, the cannons round where it took off throw a column of fire for a moment (the
//                       flamethrower's pixel fire: pixelfire.js), with a thump; and they all fire a salute when the
//                       announcer calls an event.
//   big air             the player's own long flights are called: "Big air!" and how long it flew.
// Looks and a line of text only: nothing here hurts a car, so each device runs its own.
export const PYRO = { air: 0.22, high: 2.2, near: 48, burn: 0.75, reach: 20, rate: 0.5, salute: 1.1, saluteRate: 0.22, call: 1.3 };

// api: main.js's api; spec: { pyros: the map's `pyro` things (x, z, lift, jump), burn, reach, rate, air, ripple }
//   burn, reach   a map's own seconds of fire and its height (the steelworks: longer and taller)
//   ripple        seconds a voxel: cannons further from the take-off light later, so the fire runs along the jump
//   a pyro's `jump` names the jump it stands at: a take-off there lights all of that jump's cannons, however long it is
export function makeArenaMoves(api, spec) {
  const BURN = spec.burn ?? PYRO.burn, REACH = spec.reach ?? PYRO.reach, RIPPLE = spec.ripple ?? 0, RATE = spec.rate ?? PYRO.rate, AIR = spec.air ?? PYRO.air;
  const cannons = spec.pyros.map((o) => ({ x: o.x, z: o.z, y: (o.lift || 0) + 3.7, t: 0, wait: 0, rate: PYRO.rate, jump: o.jump }));
  const air = new WeakMap();
  let boomT = 0;
  function fire(x, z) {
    let any = false;
    let tag, best = PYRO.near, d0 = Infinity;
    for (const p of cannons) { const d = Math.hypot(p.x - x, p.z - z); d0 = Math.min(d0, d); if (p.jump && d < best) { best = d; tag = p.jump; } }
    for (const p of cannons) {
      const d = Math.hypot(p.x - x, p.z - z); if (tag ? p.jump !== tag : d > PYRO.near) continue;
      if (p.t <= 0) p.wait = Math.min(0.4, (d - d0) * RIPPLE);   // (one already burning burns on)
      p.t = BURN; p.rate = RATE; any = true;
    }
    if (any && boomT <= 0) { boomT = 0.25; api.sound('whoosh', 1, x, 4, z); api.sfx.play('carboom', 0.35, x, z, { gap: 0.2 }); }
  }
  return {
    // every cannon at once, a little thinner
    salute() { for (const p of cannons) { p.t = Math.max(p.t, PYRO.salute * (0.8 + Math.random() * 0.4)); p.wait = 0; p.rate = PYRO.saluteRate; } },
    step(dt) {
      boomT -= dt;
      for (const c of api.cars) {
        if (c.gone) continue;
        let a = air.get(c); if (!a) air.set(c, a = { t: 0, fired: false, x: 0, z: 0 });
        if ((c.y || 0) > 0.3) {
          if (a.t === 0) { a.x = c.x; a.z = c.z; }
          a.t += dt;
          if (!a.fired && a.t > AIR && c.y > PYRO.high && !c.dead) { a.fired = true; fire(a.x, a.z); }
        } else {
          if (a.fired && a.t >= PYRO.call && c === api.player && !c.dead) api.toast('Big air!', `${a.t.toFixed(1)} seconds off the ground`);
          a.t = 0; a.fired = false;
        }
      }
      const pix = api.pix; if (!pix) return;
      for (const p of cannons) { if (p.t <= 0) continue; if (p.wait > 0) { p.wait -= dt; continue; } p.t -= dt; pix.column(p.x, p.y, p.z, REACH, dt, 1, p.rate); }
    },
    cannons,
  };
}
