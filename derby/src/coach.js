// The coach: one short popup at a time over a new player's first rounds, each for one thing the car can do, in the
// words for the device in hand ("Right click for rockets!", Will, 2026-11-25). A popup goes with a tick the moment the
// player does the thing, or by itself after a while; either way it is not shown again in this browser (save.taught).
// A save from before the coach has the basics ticked already (parts.js loadSave), so only what is new to it shows:
// the gadget, the first round one is fitted.
// main.js steps it during a round with what the player is doing: { moved, fired, heavy, drift, gadget, picked } and
// what the car has: { heavyName ('Rockets', 'Mine', 'Cannon' or null), gadgetName (or null), pickups (the map has some) }.
const TIPS = [
  { id: 'drive', desk: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to drive · <b>Mouse</b> to aim', touch: '<b>Left thumb</b> drives the car', done: (s) => s.moved },
  { id: 'fire', desk: '<b>Left click</b> fires your guns', touch: 'Hold <b>Fire</b>: your guns aim for you', done: (s) => s.fired },
  { id: 'heavy', when: (h) => !!h.heavyName, desk: (h) => `<b>Right click</b> for ${h.heavyName === 'Mine' ? 'a mine' : h.heavyName === 'Cannon' ? 'the cannon' : 'rockets'}!`, touch: (h) => `Tap <b>${h.heavyName}</b> for the big hits!`, done: (s) => s.heavy },
  { id: 'drift', desk: 'Hold <kbd>Space</kbd> in a turn to drift', touch: 'Hold <b>Drift</b> in a turn to slide round', done: (s) => s.drift },
  { id: 'glow', when: (h) => h.pickups, desk: 'Drive through the <b>glowing pickups</b>: fix, speed, faster guns', touch: 'Drive through the <b>glowing pickups</b>: fix, speed, faster guns', done: (s) => s.picked },
  { id: 'gadget', when: (h) => !!h.gadgetName, desk: (h) => `Press <kbd>E</kbd> to use your <b>${h.gadgetName}</b>`, touch: (h) => `Tap <b>${h.gadgetName}</b> to use your gadget`, done: (s) => s.gadget },
];
export const BASICS = ['drive', 'fire', 'heavy', 'drift', 'glow'];
const FIRST = 2.2, GAP = 1.6, STAY = 9, TICK = 0.9;   // seconds: before the first, between two, a popup's longest, the tick's

export function makeCoach({ el, save, keep, touch }) {
  const taught = () => (save.taught && typeof save.taught === 'object' ? save.taught : (save.taught = {}));
  let cur = null, t = 0, wait = FIRST, tick = 0;
  const hide = () => { el.classList.remove('on', 'ok'); cur = null; wait = GAP; };
  return {
    // (a new round: the first popup waits a moment for the banner)
    reset() { hide(); el.hidden = true; wait = FIRST; },
    step(dt, s, has) {
      if (tick > 0) { if ((tick -= dt) <= 0) hide(); return; }
      if (cur) {
        t += dt;
        const did = cur.done(s);
        if (did || t > STAY) { taught()[cur.id] = 1; keep(); if (did) { el.classList.add('ok'); tick = TICK; } else hide(); }
        return;
      }
      if ((wait -= dt) > 0) return;
      const T = taught(), next = TIPS.find((p) => !T[p.id] && (!p.when || p.when(has)));
      if (!next) return;
      if (next.done(s) && next.id !== 'drive') { T[next.id] = 1; return; }   // (already doing it: nothing to say)
      cur = next; t = 0;
      const text = touch() ? next.touch : next.desk;
      el.innerHTML = `<i></i><span>${typeof text === 'function' ? text(has) : text}</span>`;
      el.hidden = false; void el.offsetWidth; el.classList.add('on');
    },
    get showing() { return cur ? cur.id : null; },
  };
}
