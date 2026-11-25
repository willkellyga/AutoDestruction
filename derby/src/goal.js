// The next part: what the scrap is for. One part the player does not own yet is "next", and a bar on the home screen
// and on the results card shows the scrap in the bank against its price, so there is always something to play the next
// round for (Will, 2026-11-25: no second currency, the scrap every mode pays is the progress; show where it is going).
// Which part: the one picked in the garage (a tap on a part that costs too much makes it the goal: garage.js), else the
// Flamethrower (the first thing worth having), else the cheapest weapon, gadget or car not owned, else the cheapest of
// anything. When the scrap covers it, the bar turns into a button that opens the garage with the part on the car and
// working, one press from bought (main.js shopFor).
// The very first round pays a bonus on its results card, enough to buy that part there and then.
import { PARTS } from './parts.js';

const FUN = ['primary', 'secondary', 'roof', 'door', 'gadget', 'body'];   // (the slots a new player feels at once)
const FIRST = ['primary', 'flamer'];
export const FIRST_BONUS = 200;   // the least the first round's bonus pays

const has = (save, slot, key) => (save.owned[slot] || []).includes(key);
function cheapest(save, slots) {
  let best = null;
  for (const slot of slots) for (const [key, p] of Object.entries(PARTS[slot] || {})) if (p.cost > 0 && !has(save, slot, key) && (!best || p.cost < best.cost)) best = { slot, key, cost: p.cost };
  return best;
}
// { slot, key, part, cost, have, left, k (0 to 1), ready } or null when everything is owned
export function nextPart(save, scrap = save.scrap) {
  const g = Array.isArray(save.goal) ? save.goal : null;
  let t = g && PARTS[g[0]] && PARTS[g[0]][g[1]] && g[0] !== 'paint' && !has(save, g[0], g[1]) ? { slot: g[0], key: g[1] } : null;
  if (!t && PARTS[FIRST[0]][FIRST[1]] && !has(save, FIRST[0], FIRST[1])) t = { slot: FIRST[0], key: FIRST[1] };
  if (!t) t = cheapest(save, FUN) || cheapest(save, Object.keys(PARTS).filter((s) => s !== 'paint'));
  if (!t) return null;
  const part = PARTS[t.slot][t.key], cost = part.cost, have = Math.floor(scrap);
  return { slot: t.slot, key: t.key, part, cost, have, left: Math.max(0, cost - have), k: Math.max(0, Math.min(1, have / cost)), ready: have >= cost };
}
// the first round's bonus: what is still missing for the next part once the round has paid, and never less than FIRST_BONUS
export function firstBonus(save, scrap) {
  const n = nextPart(save, scrap);
  return Math.max(FIRST_BONUS, n ? Math.ceil((n.cost - scrap) / 50) * 50 : 0);
}
// the bar's insides (the same on the home screen and the results card): name, numbers, the bar, and what to do
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function barHtml(n, from = null) {
  const k0 = from == null ? n.k : Math.max(0, Math.min(1, from / n.cost));
  return `<small>${n.ready ? 'You can buy' : 'Next part'}</small><b>${esc(n.part.name)}</b>`
    + `<i class="nx-bar"><s style="width:${Math.round(k0 * 100)}%" data-to="${Math.round(n.k * 100)}"></s></i>`
    + `<em>${n.ready ? 'Try it out and buy it' : `${Math.min(n.have, n.cost)} / ${n.cost} scrap`}</em>`;
}
