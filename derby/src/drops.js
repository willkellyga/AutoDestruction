// Supply drops, for a mode that wants power-ups coming into the round as it goes (modes/survival.js): every so often a
// crate comes down on a parachute at one of the places the map lists (MAP.drops, made with dropSpots() and listed in
// its pickups too). Nothing is said of it: a plane is heard going over, and the crate is there to see, coming down under
// a beam of its colour (and on the radar). The first car to it takes it. What is in
// it is one of the arena's pickups (pickups.js): a repair kit, overcharge, nitro, a Hammerdown strike (on the dead,
// where cars don't fight) or a crate of scrap.
// Which crate lands where and when comes from the round's own clock and one seed (online, the round's id), so every
// device in a round sees the same crates without a word sent; who took one is sent as for any pickup (net.js).

export const DROPS = {
  first: 20,          // seconds into the round the first one comes
  every: 26,          // and between them after that
  kinds: [['repair', 5], ['ammo', 4], ['nitro', 2], ['super', 3], ['scrap', 1]],   // what is in them, and how often
};
// a map's landing places, from [[x, z], ...]
export const dropSpots = (zones) => zones.map(([x, z]) => ({ drop: true, x, z }));

const seedOf = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rand = (seed, n, k) => { let t = (seed + Math.imul(n + 1, 0x9e3779b1) + Math.imul(k + 1, 0x85ebca6b)) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// G: main.js's api. Returns step(clock): call it each frame of the round with the round's clock.
export function makeDrops(G) {
  const spots = () => (G.pickups && G.pickups.drops) || [];
  const seed = G.net && G.net.round ? seedOf(String(G.net.round)) : (Math.random() * 4294967296) >>> 0;
  const total = DROPS.kinds.reduce((a, [, w]) => a + w, 0);
  let n = -1;   // the last crate sent
  function send(i, fall) {
    const list = spots(); if (!list.length) return;
    let k = rand(seed, i, 1) * total, kind = DROPS.kinds[0][0];
    for (const [id, w] of DROPS.kinds) { if ((k -= w) < 0) { kind = id; break; } }
    // the place: the one the seed picks, or the next one along that has nothing on it
    let at = Math.floor(rand(seed, i, 2) * list.length);
    for (let t = 0; t < list.length && (list[at].up || list[at].fall > 0); t++) at = (at + 1) % list.length;
    const p = list[at]; if (p.up || p.fall > 0) return;
    G.pickups.call(p, kind, fall);
    // no word of it on the screen: a plane goes over, and the crate is there to be seen coming down
    if (fall === undefined) { G.sound('jet', 0.55); G.sound('whoosh', 0.5, p.x, 40, p.z); }
  }
  return {
    step(clock) {
      const due = Math.floor((clock - DROPS.first) / DROPS.every);
      if (due <= n) return;
      // (a page that joined late skips the crates it missed, but lands the last one at once if it is still fresh)
      if (due - n > 1) { n = due - 1; if (clock - (DROPS.first + due * DROPS.every) < 20) { n = due; send(due, 0.01); } return; }
      n = due; send(due);
    },
    // the nearest crate a car might go for: one that is down, or nearly (rivals: modes/survival.js)
    nearest(c, range) {
      let best = null, bd = range;
      for (const p of spots()) { if (!p.up && !(p.fall > 0 && p.fall < 3)) continue; const d = Math.hypot(p.x - c.x, p.z - c.z); if (d < bd) { bd = d; best = p; } }
      return best;
    },
    // on the radar: a ring of its colour where each crate is, blinking while it is still coming down
    radar(R, s, ox, oy) {
      const blink = (performance.now() / 250 | 0) & 1;
      for (const p of spots()) {
        if (!p.up && !(p.fall > 0)) continue;
        if (!p.up && blink) continue;
        R.strokeStyle = p.K.css; R.fillStyle = p.K.css; R.lineWidth = 1.5;
        R.beginPath(); R.arc(ox + p.x * s, oy + p.z * s, 4, 0, 6.3); R.stroke();
        R.beginPath(); R.arc(ox + p.x * s, oy + p.z * s, 1.6, 0, 6.3); R.fill();
      }
    },
  };
}
