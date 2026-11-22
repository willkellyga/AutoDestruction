// The garage's panel: scrap, three saved builds, the build's rating and stat bars (which slide, and say by how much a part
// changes them), a tab for each slot, and a card for each part with its picture, what it does, and buttons to try it
// out. The car itself stands on the turntable in the workshop (garageroom.js); main.js turns it to show whichever slot
// is open, bolts parts on, fires weapons on the range and runs test drives, through the callbacks here.
//
// A part that is not bought yet goes on the car to look at when its card is picked; the second press buys it.
// Glowing spots on the car (placed by main.js through place()) open their slot's tab.
import { SLOTS, PARTS, PAINTS, PATTERNS, statsOf, keepSave } from './parts.js';

const KMH = 0.9;   // voxels a second to km/h
const pct = (v) => `${Math.round(Math.max(0.03, Math.min(1, v)) * 100)}%`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// a small line drawing for each slot (tabs, hotspots, and the cards of parts without a model of their own)
const P = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
export const ICON = {
  body: P('M3 15v-3l2-1 2-4h9l3 4 2 1v3h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3zm5-4h3V8H9zm5 0h4l-2-3h-2z'),
  primary: P('M5 18v-3h3v-3h5V9h8v2h-6v1h-1v3h3v3zm4-1h6v-1H9z'),
  roof: P('M3 18v-3l2-1 2-3h9l3 3 2 1v3zM9 10V8h2V5h2v3h2v2z'),
  door: P('M5 3h11l3 4v14H5zm2 2v6h10V7.5L15 5zm6 9h3v1.5h-3z'),
  secondary: P('M3 14l9-9 3 1 4-4 3 3-4 4 1 3-9 9-1-3-3 3-1-1 3-3zm9-5l-5 5 1 1 5-5z'),
  front: P('M2 6h5l3 3h4v6h-4l-3 3H2l3-6zm14 3h6v6h-6z'),
  armour: P('M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5zm0 3l-5 2v4c0 3.5 2.2 6.4 5 7.8z'),
  wheels: P('M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z'),
  engine: P('M4 9h3V7h6v2h2l2 2h2V9h2v8h-2v-2h-2l-2 3H8l-2-2H4zm-2 2h2v4H2z'),
  gadget: P('M13 2L4 14h6l-1 8 9-12h-6z'),
  paint: P('M17 2l5 5-9 9-5-5zM7 12l5 5c-1 3-4 5-9 5 1-1 2-3 2-5 0-3 1-5 2-5z'),
};
const SHORT = { body: 'Body', primary: 'Main gun', roof: 'Roof', door: 'Doors', secondary: 'Heavy', front: 'Front', armour: 'Armour', wheels: 'Wheels', engine: 'Engine', gadget: 'Gadget', paint: 'Paint' };

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
    if (p.burn) c.push('sets alight');
    if (p.seek) c.push('homing');
    if (p.mortar) c.push('over walls');
  }
  const gd = p.nitro || p.repair || p.shield || p.oil || p.jump;
  if (slot === 'gadget' && gd) c.push(`every ${gd.every}s`);
  if (slot === 'front') { c.push(`ram ×${p.ram}`); if (p.guard < 0.7) c.push('you take less'); if (p.saw) c.push('grinds'); }
  if (p.hp) c.push(`${sign(p.hp)} armour`);
  if (p.gripK) c.push(`grip ${sign(Math.round((p.gripK - 1) * 100), '%')}`);
  if (p.topK) c.push(`top ${sign(Math.round((p.topK - 1) * 100), '%')}`);
  if (p.accelK) c.push(`pull ${sign(Math.round((p.accelK - 1) * 100), '%')}`);
  if (p.ramK) c.push(`ram ${sign(Math.round((p.ramK - 1) * 100), '%')}`);
  if (p.mass && slot !== 'body' && Math.abs(p.mass) >= 0.05) c.push(`${sign(Math.round(p.mass * 1000))} kg`);
  return c;
}
// the button on a card that shows the part working: fire a weapon on the range, rev an engine, light the nitro
export function tryLabel(slot, p) {
  if ((slot === 'primary' || slot === 'roof' || slot === 'door' || slot === 'secondary') && (p.dmg || p.mine || p.arc)) return p.mine ? 'Drop' : 'Fire';
  if (slot === 'engine') return 'Rev';
  if (slot === 'gadget') return p.nitro ? 'Boost' : p.shield ? 'Use' : p.oil ? 'Pour' : p.jump ? 'Jump' : null;
  return null;
}
// one number for a whole build, and a class letter for it
const BARS = [['armour', 'Armour'], ['speed', 'Speed'], ['handling', 'Handling'], ['firepower', 'Firepower'], ['ram', 'Ramming']];
export function rating(s) {
  const b = s.bars, f = (v) => Math.max(0, Math.min(1.15, v));
  return Math.round(220 * (f(b.armour) + f(b.speed) + f(b.handling) + f(b.firepower) * 1.2 + f(b.ram) * 0.8));
}
export const classOf = (r) => (r >= 700 ? 'S' : r >= 600 ? 'A' : r >= 500 ? 'B' : r >= 400 ? 'C' : 'D');

export function makeGarage({ root, save, art, onChange, onDrive, onTest, onTry, onTab, sound, toast }) {
  let tab = 'body', look = null;   // look: [slot, key] of a part tried on but not bought
  const $ = (s) => root.querySelector(s);
  const shown = () => (look ? { ...save.load, [look[0]]: look[1] } : save.load);
  // three builds to switch between; the one in use is save.load
  if (!Array.isArray(save.builds) || save.builds.length !== 3) save.builds = [{ ...save.load }, null, null];
  if (!(save.slot >= 0 && save.slot < 3)) save.slot = 0;
  const keep = () => { save.builds[save.slot] = { ...save.load }; keepSave(save); };

  function owned(slot, key) { return slot === 'paint' || (save.owned[slot] || []).includes(key); }
  function fit(slot, key) {
    const next = { ...save.load, [slot]: key }, s = statsOf(next);
    if (s.over) { toast('Not enough Power', `${s.power} of ${s.maxPower} needed. Take a part off or build on a bigger body.`); sound('ui_click'); flashPower(); return false; }
    save.load = next; look = null; keep(); onChange(save.load, 'fit', slot);
    return true;
  }
  function pick(slot, key) {
    if (slot !== 'paint' && save.load[slot] === key) { if (look) { const was = look[0]; look = null; onChange(save.load, 'reset', was); } render(); return; }
    if (owned(slot, key)) { if (fit(slot, key)) sound('ui_equip'); render(); return; }
    const p = PARTS[slot][key];
    if (look && look[0] === slot && look[1] === key) {   // the second press buys it
      if (save.scrap < p.cost) { toast('Not enough scrap', `${p.cost - Math.floor(save.scrap)} more needed. Wreck more cars!`); sound('ui_click'); return; }
      const s = statsOf({ ...save.load, [slot]: key });
      if (s.over) { toast('Not enough Power to fit it', `${s.power} of ${s.maxPower}. Take a part off first, or build on a bigger body.`); sound('ui_click'); flashPower(); return; }
      save.scrap -= p.cost; save.owned[slot] = [...(save.owned[slot] || []), key];
      sound('ui_coin'); scrapRoll();
      fit(slot, key); toast(`${p.name} bought`, `-${p.cost} scrap`);
      render(); return;
    }
    look = [slot, key]; onChange(shown(), 'look', slot); sound('ui_click'); render();
  }
  // try a part out: on the car to look at (unless it's on already), then show it working
  function tryPart(slot, key) {
    if (shown()[slot] !== key) { look = save.load[slot] === key ? null : [slot, key]; onChange(shown(), 'look', slot); render(); }
    onTry(slot, key);
  }
  function flashPower() { const m = $('.g-power'); if (!m) return; m.classList.remove('flash'); void m.offsetWidth; m.classList.add('flash'); }
  // the scrap counter rolls to its new value
  let scrapShown = Math.floor(save.scrap), rollT = 0;
  function scrapRoll() {
    cancelAnimationFrame(rollT);
    const from = scrapShown, to = Math.floor(save.scrap), t0 = performance.now();
    const go = (now) => { const k = Math.min(1, (now - t0) / 600); scrapShown = Math.round(from + (to - from) * (1 - (1 - k) ** 3)); $('.g-scrap b').textContent = scrapShown; if (k < 1) rollT = requestAnimationFrame(go); };
    rollT = requestAnimationFrame(go);
  }

  // ---- the stats: made once, then their bars slide ----------------------------------------------------------------
  const statsEl = $('.g-stats');
  statsEl.innerHTML = BARS.map(([k, n]) => `<div class="g-stat" data-k="${k}"><span>${n}</span><i><s></s><u></u></i><em></em></div>`).join('')
    + '<div class="g-power"><span>Power <em></em></span><div></div></div><div class="g-nums"><span></span><span></span><span></span></div>';
  let rateShown = null, rateT = 0;
  function stats() {
    const now = statsOf(save.load), then = statsOf(shown());
    for (const [k] of BARS) {
      const el = statsEl.querySelector(`[data-k="${k}"]`), a = now.bars[k], b = then.bars[k], d = Math.round((Math.min(1.15, b) - Math.min(1.15, a)) * 100);
      el.className = `g-stat ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`;
      el.querySelector('s').style.width = pct(b); el.querySelector('u').style.left = pct(a);
      el.querySelector('em').textContent = d ? `${d > 0 ? '+' : ''}${d}` : '';
    }
    const pw = statsEl.querySelector('.g-power'), seg = pw.querySelector('div');
    pw.classList.toggle('over', then.over); pw.querySelector('em').textContent = `${then.power} / ${then.maxPower}`;
    if (seg.children.length !== then.maxPower) seg.innerHTML = '<b></b>'.repeat(then.maxPower);
    [...seg.children].forEach((b, i) => { b.className = i < then.power ? (then.over ? 'over' : i >= now.power ? 'on new' : 'on') : i < now.power ? 'freed' : ''; });
    const n = statsEl.querySelectorAll('.g-nums span');
    n[0].textContent = `${Math.round(then.hp)} health`; n[1].textContent = `${Math.round(then.top * KMH)} km/h`; n[2].textContent = `${then.mass.toFixed(2)} t`;
    // the build's rating counts up or down to its new value
    const r = rating(then), cls = classOf(r), was = rating(now);
    const rb = root.querySelector('.g-rate');
    rb.classList.toggle('up', r > was); rb.classList.toggle('down', r < was);
    rb.querySelector('.g-class').textContent = cls; rb.dataset.c = cls;
    rb.querySelector('.g-delta').textContent = r !== was ? `${r > was ? '+' : ''}${r - was}` : '';
    cancelAnimationFrame(rateT);
    const from = rateShown ?? r, t0 = performance.now();
    const go = (t) => { const k = Math.min(1, (t - t0) / 450); rateShown = Math.round(from + (r - from) * (1 - (1 - k) ** 3)); rb.querySelector('.g-num').textContent = rateShown; if (k < 1) rateT = requestAnimationFrame(go); };
    rateT = requestAnimationFrame(go);
  }

  // ---- the cards ----------------------------------------------------------------------------------------------------
  function artHtml(slot, key) {
    const url = art && art.get(slot, key, save.load, () => { const img = root.querySelector(`.g-card[data-slot="${slot}"][data-key="${key}"] .g-art`); if (img) img.innerHTML = artHtml(slot, key); });
    if (url) return `<img src="${url}" alt="">`;
    if (key === 'none') return '<i class="g-none"></i>';
    return `<i class="g-glyph g-${esc(slot)}">${ICON[slot] || ''}</i>${slot === 'engine' ? `<em>${{ stock: '', turbo: 'T', v8: 'V8', diesel: 'D', blower: 'SC', jet: 'J' }[key] || ''}</em>` : ''}`;
  }
  function card(slot, key, p) {
    const eq = save.load[slot] === key, own = owned(slot, key), trying = look && look[0] === slot && look[1] === key;
    const fitS = statsOf({ ...save.load, [slot]: key }), nofit = !eq && fitS.over;
    const state = eq ? '<b class="g-eq">Fitted</b>' : own ? (trying ? '<b class="g-buy">Fit it</b>' : '<b class="g-own">Owned</b>') : trying ? `<b class="g-buy">Buy · ${p.cost}</b>` : `<b class="g-price">${p.cost} scrap</b>`;
    const ch = [...(nofit ? [`needs ${fitS.power - fitS.maxPower} more Power`] : []), ...chips(slot, p)].map((c, i) => `<i class="${nofit && i === 0 ? 'warn' : ''}">${esc(c)}</i>`).join('');
    const tl = tryLabel(slot, p);
    const tb = tl ? `<button class="g-trybtn" data-try="${key}" title="Try it out">${tl}</button>` : '';
    return `<div role="button" tabindex="0" class="g-card ${eq ? 'eq' : ''} ${trying ? 'try' : ''} ${!own && p.cost > save.scrap ? 'dear' : ''} ${nofit ? 'nofit' : ''}" data-slot="${slot}" data-key="${key}">`
      + `<div class="g-art">${artHtml(slot, key)}</div><div class="g-info"><div class="g-top"><strong>${esc(p.name)}</strong>${state}</div><p>${esc(p.desc || '')}</p><div class="g-chips">${ch}</div></div>${tb}</div>`;
  }
  function paintHtml() {
    const L = save.load, sw = (which) => Object.entries(PAINTS).map(([k, c]) => `<button class="g-sw ${L[which] === k ? 'eq' : ''}" data-paint="${which}" data-key="${k}" title="${k}" style="background:#${c.toString(16).padStart(6, '0')}"></button>`).join('');
    const pats = Object.entries(PATTERNS).map(([k, n]) => `<button class="g-pat ${L.pattern === k ? 'eq' : ''}" data-paint="pattern" data-key="${k}">${esc(n)}</button>`).join('');
    return `<div class="g-paint"><h4>Body colour</h4><div class="g-sws">${sw('paint')}</div><h4>Second colour</h4><div class="g-sws">${sw('trim')}</div><h4>Pattern</h4><div class="g-pats">${pats}</div></div>`;
  }
  function buildsHtml() {
    return save.builds.map((b, i) => `<button class="${i === save.slot ? 'on' : ''}" data-build="${i}" title="Saved build ${i + 1}"><b>${i + 1}</b><i>${b ? esc(PARTS.body[b.body]?.name || '') : 'Empty'}</i></button>`).join('');
  }
  function render() {
    $('.g-scrap b').textContent = (scrapShown = Math.floor(save.scrap));
    $('.g-builds').innerHTML = buildsHtml();
    stats();
    $('.g-tabs').innerHTML = SLOTS.map((s) => `<button class="${s.key === tab ? 'on' : ''}" data-tab="${s.key}" title="${esc(s.name)}">${ICON[s.key] || ''}<span>${esc(SHORT[s.key] || s.name)}</span></button>`).join('');
    const S = SLOTS.find((s) => s.key === tab), L = shown();
    const cur = tab === 'paint' ? null : PARTS[tab][L[tab]];
    $('.g-sel').innerHTML = cur ? `<b>${esc(cur.name)}</b> ${esc(cur.desc || S.tip)}` : esc(S.tip);
    const list = $('.g-list'), keepX = list.scrollLeft, keepY = list.scrollTop, same = list.dataset.tab === tab;
    list.dataset.tab = tab; list.classList.toggle('paint', tab === 'paint');
    list.innerHTML = `<div class="g-tip">${esc(S.tip)}</div>` + (tab === 'paint' ? paintHtml() : Object.entries(PARTS[tab]).map(([k, p]) => card(tab, k, p)).join(''));
    if (same) { list.scrollLeft = keepX; list.scrollTop = keepY; }
    else { list.scrollLeft = 0; list.scrollTop = 0; const on = list.querySelector('.g-card.eq'); if (on && list.scrollWidth > list.clientWidth + 4) list.scrollLeft = Math.max(0, on.offsetLeft - 12); }
    const hot = root.querySelectorAll('.g-hot'); hot.forEach((h) => h.classList.toggle('on', h.dataset.tab === tab));
  }
  function setTab(slot, quiet) {
    if (tab === slot && !quiet) return;
    tab = slot; if (look) { const was = look[0]; look = null; onChange(save.load, 'reset', was); }
    if (art) art.clear();
    onTab(slot); if (!quiet) sound('ui_tab'); render();
  }
  function switchBuild(n) {
    if (n === save.slot) return;
    look = null; save.builds[save.slot] = { ...save.load };
    if (!save.builds[n]) { save.builds[n] = { ...save.load }; toast(`Build ${n + 1}`, 'A copy of this one to start from'); }
    save.slot = n;
    const L = { ...save.builds[n] };
    for (const s of Object.keys(PARTS)) if (!PARTS[s][L[s]] || !owned(s, L[s])) L[s] = save.load[s];
    save.load = L; keep(); onChange(save.load, 'build', 'body'); sound('ui_equip'); render();
  }
  // a tap on a card: pick it (keyboard too: Enter or Space on a focused card)
  root.addEventListener('keydown', (e) => { const c = e.target.closest && e.target.closest('.g-card'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(c.dataset.slot, c.dataset.key); } });
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button, .g-card'); if (!t || !root.contains(t)) return;
    if (t.dataset.tab) { setTab(t.dataset.tab); return; }
    if (t.dataset.try) { const c = t.closest('.g-card'); tryPart(c.dataset.slot, c.dataset.key); return; }
    if (t.dataset.build) { switchBuild(+t.dataset.build); return; }
    if (t.dataset.paint) { save.load = { ...save.load, [t.dataset.paint]: t.dataset.key }; keep(); onChange(save.load, 'paint', 'paint'); sound('ui_click'); render(); return; }
    if (t.dataset.slot) { pick(t.dataset.slot, t.dataset.key); return; }
    if (t.classList.contains('g-test')) { onTest(shown()); return; }
    if (t.classList.contains('g-drive')) { const was = look; look = null; if (was) onChange(save.load, 'reset', was[0]); onDrive(); }
  });
  // the glowing spots on the car, one per slot that has something to point at
  const hots = $('.g-hots'), hotEl = {};
  function place(list) {
    for (const h of list) {
      let el = hotEl[h.slot];
      if (!el) {
        el = hotEl[h.slot] = document.createElement('button'); el.className = 'g-hot'; el.dataset.tab = h.slot;
        el.innerHTML = `${ICON[h.slot] || ''}<span>${esc(SHORT[h.slot])}</span>`; hots.appendChild(el);
      }
      el.hidden = !h.on;
      if (h.on) { el.style.transform = `translate(${Math.round(h.x)}px, ${Math.round(h.y)}px)`; el.classList.toggle('on', h.slot === tab); }
    }
    for (const k in hotEl) if (!list.some((h) => h.slot === k)) hotEl[k].hidden = true;
  }
  return {
    open() { look = null; root.hidden = false; sound('ui_open'); sound('door', 0.6); setTab(tab, true); },
    close() { root.hidden = true; if (look) { const was = look[0]; look = null; onChange(save.load, 'reset', was); } },
    hide() { root.hidden = true; }, show() { root.hidden = false; render(); },
    render, place, setTab, shown,
    get tab() { return tab; },
    get open_() { return !root.hidden; },
    // the part of the screen the panel leaves free, for the camera to frame the car in
    free() {
      const p = $('.g-panel').getBoundingClientRect(), W = innerWidth, H = innerHeight;
      if (p.top > H * 0.2 && p.width > W * 0.8) return { x0: 0, y0: 0, x1: W, y1: p.top };
      return { x0: 0, y0: 0, x1: p.left, y1: H };
    },
  };
}
