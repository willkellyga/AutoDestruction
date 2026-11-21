// The garage: the panel where a car is put together from parts bought with scrap. The car itself stands in the street
// with the camera going round it (main.js rebuilds it as parts change); this file is the panel beside it: scrap, the
// build's stat bars and Power meter, a tab for each slot, and a card for each part to look at, buy and fit.
// A part that is not bought yet goes on the car to look at when its card is picked; the second press buys it.
import { SLOTS, PARTS, PAINTS, PATTERNS, statsOf, keepSave } from './parts.js';

const KMH = 0.9;   // voxels a second to km/h
const pct = (v) => `${Math.round(Math.max(0.03, Math.min(1, v)) * 100)}%`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// what a part changes, as short chips on its card
function chips(slot, p) {
  const c = [];
  const sign = (v, unit = '') => `${v > 0 ? '+' : ''}${v}${unit}`;
  if (slot === 'body') { c.push(`${p.hp} armour`, `${p.power} Power`, `${Math.round(p.top * KMH)} km/h`); return c; }
  if (p.power) c.push(`${p.power} Power`);
  if (slot === 'primary' || slot === 'secondary' || slot === 'roof' || slot === 'door') {
    const two = slot === 'door' && p.dmg ? 2 : 1;   // the doors carry a pair
    if (p.arc) c.push(`${Math.round(p.dmg / p.reload)} dmg/s`, 'aims itself');
    else if (p.rate) c.push(`${Math.round(p.rate * p.dmg * two)} dmg/s`);
    else if (p.dmg) c.push(`${Math.round((p.salvo || 1) * (p.pellets || 1) * p.dmg * two)} a shot`, `${p.reload}s reload`);
    if (p.splash) c.push('blast');
    if (p.range && p.range < 150) c.push('short range');
    if (p.group) c.push(p.group === 'heavy' ? 'right click' : 'left click');
    if (p.blade) c.push('cuts what you rub');
  }
  if (slot === 'front') { c.push(`ram ×${p.ram}`); if (p.guard < 0.7) c.push('you take less'); if (p.saw) c.push('grinds'); }
  if (p.hp) c.push(`${sign(p.hp)} armour`);
  if (p.gripK) c.push(`grip ${sign(Math.round((p.gripK - 1) * 100), '%')}`);
  if (p.topK) c.push(`top ${sign(Math.round((p.topK - 1) * 100), '%')}`);
  if (p.accelK) c.push(`pull ${sign(Math.round((p.accelK - 1) * 100), '%')}`);
  if (p.ramK) c.push(`ram ${sign(Math.round((p.ramK - 1) * 100), '%')}`);
  if (p.mass && slot !== 'body' && Math.abs(p.mass) >= 0.05) c.push(`${sign(Math.round(p.mass * 1000))} kg`);
  return c;
}

export function makeGarage({ root, save, onChange, onDrive, sound, toast }) {
  let tab = 'body', look = null;   // look: [slot, key] of a part tried on but not bought
  const $ = (s) => root.querySelector(s);
  const shown = () => (look ? { ...save.load, [look[0]]: look[1] } : save.load);

  function owned(slot, key) { return slot === 'paint' || (save.owned[slot] || []).includes(key); }
  function fit(slot, key) {
    const next = { ...save.load, [slot]: key }, s = statsOf(next);
    if (s.over) { toast('Not enough Power', `${s.power} of ${s.maxPower} needed. Take a part off or build on a bigger body.`); sound('ui_click'); flashPower(); return false; }
    save.load = next; look = null; keepSave(save); onChange(save.load, true);
    sound('ui_equip'); sound('servo', 0.7);
    return true;
  }
  function pick(slot, key) {
    if (slot !== 'paint' && save.load[slot] === key) { if (look) { look = null; onChange(save.load); } render(); return; }
    if (owned(slot, key)) { fit(slot, key); render(); return; }
    const p = PARTS[slot][key];
    if (look && look[0] === slot && look[1] === key) {   // the second press buys it
      if (save.scrap < p.cost) { toast('Not enough scrap', `${p.cost - Math.floor(save.scrap)} more needed. Wreck more cars!`); sound('ui_click'); return; }
      const s = statsOf({ ...save.load, [slot]: key });
      if (s.over) { toast('Not enough Power to fit it', `${s.power} of ${s.maxPower}. Take a part off first, or build on a bigger body.`); sound('ui_click'); flashPower(); return; }
      save.scrap -= p.cost; save.owned[slot] = [...(save.owned[slot] || []), key]; keepSave(save);
      sound('ui_coin');
      if (!fit(slot, key)) { look = null; onChange(save.load); }
      render(); return;
    }
    look = [slot, key]; onChange(shown()); sound('ui_click'); render();
  }
  function flashPower() { const m = $('.g-power'); if (!m) return; m.classList.remove('flash'); void m.offsetWidth; m.classList.add('flash'); }

  function statsHtml() {
    const now = statsOf(save.load), then = statsOf(shown());
    const bar = (label, k) => {
      const a = now.bars[k], b = then.bars[k], cls = b > a + 0.005 ? 'up' : b < a - 0.005 ? 'down' : '';
      return `<div class="g-stat ${cls}"><span>${label}</span><i><s style="width:${pct(b)}"></s><u style="left:${pct(a)}"></u></i></div>`;
    };
    let seg = ''; for (let i = 0; i < then.maxPower; i++) seg += `<b class="${i < then.power ? (then.over ? 'over' : 'on') : ''}"></b>`;
    return `${bar('Armour', 'armour')}${bar('Speed', 'speed')}${bar('Handling', 'handling')}${bar('Firepower', 'firepower')}${bar('Ramming', 'ram')}
      <div class="g-power ${then.over ? 'over' : ''}"><span>Power <em>${then.power} / ${then.maxPower}</em></span><div>${seg}</div></div>
      <div class="g-nums"><span>${Math.round(then.hp)} health</span><span>${Math.round(then.top * KMH)} km/h</span><span>${(then.mass).toFixed(2)} t</span></div>`;
  }
  function card(slot, key, p) {
    const eq = save.load[slot] === key, own = owned(slot, key), trying = look && look[0] === slot && look[1] === key;
    const state = eq ? '<b class="g-eq">Fitted</b>' : own ? '<b class="g-own">Fit</b>' : trying ? `<b class="g-buy">Buy · ${p.cost}</b>` : `<b class="g-price">${p.cost} scrap</b>`;
    const ch = chips(slot, p).map((c) => `<i>${esc(c)}</i>`).join('');
    return `<button class="g-card ${eq ? 'eq' : ''} ${trying ? 'try' : ''} ${!own && p.cost > save.scrap ? 'dear' : ''}" data-slot="${slot}" data-key="${key}"><div class="g-top"><strong>${esc(p.name)}</strong>${state}</div><p>${esc(p.desc || '')}</p><div class="g-chips">${ch}</div></button>`;
  }
  function paintHtml() {
    const L = save.load, sw = (which) => Object.entries(PAINTS).map(([k, c]) => `<button class="g-sw ${L[which] === k ? 'eq' : ''}" data-paint="${which}" data-key="${k}" title="${k}" style="background:#${c.toString(16).padStart(6, '0')}"></button>`).join('');
    const pats = Object.entries(PATTERNS).map(([k, n]) => `<button class="g-pat ${L.pattern === k ? 'eq' : ''}" data-paint="pattern" data-key="${k}">${esc(n)}</button>`).join('');
    return `<h4>Body colour</h4><div class="g-sws">${sw('paint')}</div><h4>Second colour</h4><div class="g-sws">${sw('trim')}</div><h4>Pattern</h4><div class="g-pats">${pats}</div>`;
  }
  function render() {
    $('.g-scrap b').textContent = Math.floor(save.scrap);
    $('.g-stats').innerHTML = statsHtml();
    $('.g-tabs').innerHTML = SLOTS.map((s) => `<button class="${s.key === tab ? 'on' : ''}" data-tab="${s.key}">${esc(s.name)}</button>`).join('');
    const S = SLOTS.find((s) => s.key === tab);
    $('.g-list').innerHTML = `<div class="g-tip">${esc(S.tip)}</div>` + (tab === 'paint' ? paintHtml() : Object.entries(PARTS[tab]).map(([k, p]) => card(tab, k, p)).join(''));
  }
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t || !root.contains(t)) return;
    if (t.dataset.tab) { tab = t.dataset.tab; if (look) { look = null; onChange(save.load); } sound('ui_tab'); render(); return; }
    if (t.dataset.paint) { save.load = { ...save.load, [t.dataset.paint]: t.dataset.key }; keepSave(save); onChange(save.load, true); sound('ui_click'); render(); return; }
    if (t.dataset.slot) { pick(t.dataset.slot, t.dataset.key); return; }
    if (t.classList.contains('g-drive')) { look = null; onChange(save.load); onDrive(); }
  });
  return {
    open() { look = null; root.hidden = false; sound('ui_open'); sound('door', 0.6); render(); },
    close() { root.hidden = true; if (look) { look = null; onChange(save.load); } },
    render,
    get open_() { return !root.hidden; },
  };
}
