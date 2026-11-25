// What the show does at Hammerdown (maps/arena.js) besides its traps:
//   the flame cannons   beside every lip and on the mountain's table (arenakit.js's `pyro`). When a car flies off a
//                       jump, the cannons round where it took off throw a column of fire for a moment (the
//                       flamethrower's pixel fire: pixelfire.js), with a thump; and they all fire a salute when the
//                       announcer calls an event.
//   big air             the player's own long flights are called: "Big air!" and how long it flew.
// Looks and a line of text only: nothing here hurts a car, so each device runs its own.
export const PYRO = { air: 0.22, high: 2.2, near: 48, burn: 0.75, reach: 20, rate: 0.5, salute: 1.1, saluteRate: 0.22, call: 1.3 };

// api: main.js's api; spec: { pyros: the map's `pyro` things (x, z, lift) }
export function makeArenaMoves(api, spec) {
  const cannons = spec.pyros.map((o) => ({ x: o.x, z: o.z, y: (o.lift || 0) + 3.7, t: 0, rate: PYRO.rate }));
  const air = new WeakMap();
  let boomT = 0;
  function fire(x, z) {
    let any = false;
    for (const p of cannons) { if (Math.hypot(p.x - x, p.z - z) > PYRO.near) continue; p.t = PYRO.burn; p.rate = PYRO.rate; any = true; }
    if (any && boomT <= 0) { boomT = 0.25; api.sound('whoosh', 1, x, 4, z); api.sfx.play('carboom', 0.35, x, z, { gap: 0.2 }); }
  }
  return {
    // every cannon at once, a little thinner
    salute() { for (const p of cannons) { p.t = PYRO.salute * (0.8 + Math.random() * 0.4); p.rate = PYRO.saluteRate; } },
    step(dt) {
      boomT -= dt;
      for (const c of api.cars) {
        if (c.gone) continue;
        let a = air.get(c); if (!a) air.set(c, a = { t: 0, fired: false, x: 0, z: 0 });
        if ((c.y || 0) > 0.3) {
          if (a.t === 0) { a.x = c.x; a.z = c.z; }
          a.t += dt;
          if (!a.fired && a.t > PYRO.air && c.y > PYRO.high && !c.dead) { a.fired = true; fire(a.x, a.z); }
        } else {
          if (a.fired && a.t >= PYRO.call && c === api.player && !c.dead) api.toast('Big air!', `${a.t.toFixed(1)} seconds off the ground`);
          a.t = 0; a.fired = false;
        }
      }
      const pix = api.pix; if (!pix) return;
      for (const p of cannons) { if (p.t <= 0) continue; p.t -= dt; pix.column(p.x, p.y, p.z, PYRO.reach, dt, 1, p.rate); }
    },
    cannons,
  };
}
