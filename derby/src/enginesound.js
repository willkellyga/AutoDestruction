// The engines' note: the player's engine and the two nearest rivals'. Each engine part names its own recording
// (parts.js `sound`: the stock four's Mustang, the V8s' Crown Victoria, the diesel's Dodge Ram, the jet's Ferrari)
// and a pitch for it. The loop's pitch follows the revs, and the revs follow a little gearbox (ENGINE_NOTE in
// tuning.js): they climb through each gear, dip as it shifts up, and sit in the upper middle of the range at top
// speed, so a car flat out hums instead of buzzing at the redline. Off the gas the note sags and goes muffled (a
// low-pass on the loop); on it the note opens up. The jet turbine has no gears: it winds up and down slowly.
import { ENGINE_NOTE as N } from './tuning.js';
import { PARTS } from './parts.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const G = N.gears;

// move car c's revs on by dt; rev (0 to 1) is a rev in the garage. Returns { rpm, load } (load: on the gas, 0 to 1)
function revs(c, dt, rev = 0) {
  const n = c.note || (c.note = { g: 0, rpm: N.idle, load: 0, cut: 0 });
  const E = PARTS.engine[c.load.engine] || {}, k = clamp(Math.abs(c.fwd || 0) / c.spec.top, 0, 1.3);
  const th = Math.max(Math.abs(c.throttle || 0), rev);
  let want;
  if (E.gears === false) {
    // a turbine: spins up with the gas and the speed, and takes its time about it
    want = N.idle + 0.5 * k + 0.2 * th;
    n.rpm += (Math.min(1, want) - n.rpm) * Math.min(1, dt * N.spool);
    n.load += (th - n.load) * Math.min(1, dt * 4);
    return n;
  }
  n.cut = Math.max(0, n.cut - dt);
  if ((c.fwd || 0) < -1) n.g = 0;   // (backing up: reverse, a low gear)
  else {
    while (n.g < G.length - 1 && k * G[n.g] > N.up) { n.g++; if (th > 0.3) n.cut = N.shift; }
    while (n.g > 0 && k * G[n.g] < N.down) n.g--;
  }
  want = Math.max(N.idle, k * G[n.g]);
  if (n.g === 0 && th > 0.3) want = Math.max(want, N.launch * th);   // pulling away: the clutch lets the revs up first
  want = Math.max(want, 0.2 + rev * 0.7);   // (a rev in the garage)
  want = Math.min(want, (c.fwd || 0) < -1 ? 0.8 : 0.97);
  const r = n.cut > 0 ? N.snap : want > n.rpm ? N.climb : N.drop;
  n.rpm += (want - n.rpm) * Math.min(1, dt * r);
  n.load += ((n.cut > 0 ? th * N.dip : th) - n.load) * Math.min(1, dt * (n.cut > 0 ? 20 : 9));
  return n;
}

export function makeEngineSound({ sfx }) {
  // one loop per recording for each voice (the player, two rivals): an engine swapped in the garage fades over
  const voices = [{}, {}, {}], heard = [null, null, null];   // (heard: what each voice played last, for tests)
  const loop = (v, clip) => voices[v][clip] || (voices[v][clip] = sfx.loop(clip, { tone: true }));
  function voice(v, c, n, boost, vol) {
    const E = PARTS.engine[c.load.engine] || {}, clip = E.sound || 'engine_loop';
    for (const k in voices[v]) if (k !== clip) voices[v][k].set(0);
    if (!(vol > 0)) { loop(v, clip).set(0); heard[v] = null; return; }
    const rate = (N.rate[0] + n.rpm * N.rate[1]) * (E.pitch || 1) * (1 - N.lift * (1 - n.load)) + boost;
    const gain = vol * (N.vol[0] + n.rpm * N.vol[1] + n.load * N.vol[2]);
    const tone = N.tone[0] * Math.pow(N.tone[1] / N.tone[0], clamp(0.2 + 0.45 * n.rpm + 0.35 * n.load, 0, 1));
    loop(v, clip).set(gain, rate, c.x, c.z, tone);
    heard[v] = { clip, gain, rate, tone };
  }
  // every frame: on false mutes the player's engine; near are the nearest rivals (up to two)
  function step(dt, player, near, on, rev = 0) {
    if (player) {
      const n = revs(player, dt, rev);
      voice(0, player, n, player.boostT > 0 ? N.boost : 0, on ? 1 : 0);
    } else voice(0, { load: {} }, { rpm: 0, load: 0 }, 0, 0);
    for (let i = 0; i < 2; i++) {
      const c = near[i];
      if (!c) { for (const k in voices[i + 1]) voices[i + 1][k].set(0); continue; }
      voice(i + 1, c, revs(c, dt), c.boostT > 0 ? N.boost : 0, 0.85);   // (heard even once the player is wrecked)
    }
  }
  return { step, revs, heard };
}
