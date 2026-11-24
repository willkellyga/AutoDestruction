// How to play: three pictures with a line or two under each, in words a kid can read at a glance, and the controls for
// the device in hand (keys and mouse, or the touch buttons: page.html's desk-only / touch-only). They are the mode's
// start card itself (#menu, before every round, with the difficulty and Back), and "How to play" on the round's menu
// brings them back over the round (#learn). One button closes that (Enter, Space or Esc too).

// the pictures: line drawings in the card's colour (64 x 64)
const I = {
  flag: '<path d="M14 58V8"/><path d="M14 10h36v24H14"/><path d="M14 10h9v8h-9zM32 10h9v8h-9zM23 18h9v8h-9zM41 18h9v8h-9zM14 26h9v8h-9zM32 26h9v8h-9z" fill="currentColor" stroke="none"/>',
  radar: '<circle cx="32" cy="32" r="24"/><circle cx="32" cy="32" r="12" opacity="0.5"/><path d="M32 32l14-14"/><circle cx="44" cy="44" r="5" fill="currentColor" stroke="none"/><path d="M28 36l4-12 4 12-4-3z" fill="currentColor" stroke="none"/>',
  aim: '<circle cx="32" cy="32" r="18"/><circle cx="32" cy="32" r="4" fill="currentColor" stroke="none"/><path d="M32 4v12M32 48v12M4 32h12M48 32h12"/>',
  tow: '<rect x="6" y="36" width="20" height="12" rx="3"/><rect x="36" y="36" width="22" height="12" rx="3"/><path d="M30 26h26M38 18h18M26 42h8" opacity="0.6"/><circle cx="12" cy="50" r="3"/><circle cx="21" cy="50" r="3"/><circle cx="43" cy="50" r="3"/><circle cx="53" cy="50" r="3"/>',
  zombie: '<path d="M20 58V40c0-4-6-6-6-12 0-3 3-4 5-2V12a3 3 0 016 0v14-18a3 3 0 016 0v18-16a3 3 0 016 0v18-12a3 3 0 016 0v24c0 8-5 12-5 18v4"/>',
  smash: '<path d="M32 6l5 15 15-6-8 14 14 6-15 4 5 15-14-9-10 12-1-16-15 1 11-11L8 18l16 3z"/>',
  shake: '<rect x="20" y="22" width="24" height="20" rx="4"/><path d="M10 18c-4 6-4 22 0 28M54 18c4 6 4 22 0 28M4 24c-2 5-2 11 0 16M60 24c2 5 2 11 0 16"/><path d="M44 22l8-8M20 42l-8 8" opacity="0.6"/>',
  clock: '<circle cx="32" cy="36" r="22"/><path d="M32 36V22M32 36l10 6M26 6h12M32 6v8"/>',
  glow: '<path d="M32 10l12 14-12 14-12-14z"/><path d="M14 50c4-4 32-4 36 0M20 56c4-3 20-3 24 0" opacity="0.6"/><path d="M32 4V0" opacity="0.5"/>',
  wrench: '<path d="M44 8a12 12 0 00-12 16L10 46a5 5 0 007 7l22-22A12 12 0 0056 20l-7 7-8-2-2-8 7-7a12 12 0 00-2-2z"/>',
};
const pic = (k) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
const dot = (c, t) => `<i class="ln-dot" style="--d:${c}"></i>${t}`;

// what each mode says: [picture, headline, line] three times (a line can have a desk-only and a touch-only part)
const desk = (t) => `<span class="desk-only">${t}</span>`, tap = (t) => `<span class="touch-only">${t}</span>`;
const STEPS = {
  race: (MAP) => [
    ['flag', 'Finish first', `${MAP.laps || 3} laps round the city. Beat everyone to the checkered flag!`],
    ['radar', 'Follow the radar', `The blinking dot on the radar is where to go next. Lost or facing the wrong way? ${desk('Press <kbd>R</kbd>.')}${tap('Tap the yellow message.')}`],
    ['tow', 'Shoot and tow', 'Blast the cars in front of you. Drive right behind a car and it pulls you along faster.'],
  ],
  survival: () => [
    ['zombie', 'Last car running', 'Zombies are taking over the base. Stay alive longer than every other car!'],
    ['smash', 'Run them over', 'Smash through zombies or shoot them. The cars here can\'t hurt each other.'],
    ['shake', 'Shake them off', 'Zombies grab onto your car. Turn hard to throw them off. You only get one car!'],
  ],
  brawl: () => [
    ['clock', 'Most wrecks wins', 'Everyone against everyone until the clock runs out.'],
    ['smash', 'Ram and shoot', 'Wreck as many cars as you can. Got wrecked? You\'re back in three seconds.'],
    ['glow', 'Grab the glow', `${dot('#4be37a', 'fix')} ${dot('#45b4ff', 'speed')} ${dot('#ff8a2a', 'faster guns')}<br>Watch out for the hammers and the flames!`],
  ],
  waves: () => [
    ['smash', 'Wreck each wave', 'Rival cars come in waves. Ram them and shoot them until they\'re all wrecked.'],
    ['aim', 'Aim and fire', 'Your guns pull onto the nearest car. Rockets hit hardest.'],
    ['wrench', 'Upgrade', 'Spend your scrap in the garage between waves on guns, armour and engines.'],
  ],
};
const TITLE = { race: 'Race', survival: 'Zombie Survival', brawl: 'Arena', waves: 'Waves' };

export function makeLearn({ $, MAP }) {
  const id = STEPS[MAP.mode] ? MAP.mode : 'waves';
  const el = $('learn');
  let then = null;

  const steps = STEPS[id](MAP).map(([p, h, t], k) =>
    `<div class="ln-step"><b class="ln-n">${k + 1}</b><div class="ln-pic">${pic(p)}</div><strong>${h}</strong><span>${t}</span></div>`).join('');
  $('ln-t').textContent = TITLE[id];
  $('ln-steps').innerHTML = steps;
  $('brief-steps').innerHTML = steps;   // the start card's own copy

  function close() {
    if (el.hidden) return;
    el.hidden = true; document.body.classList.remove('learning');
    const f = then; then = null; if (f) f();
  }
  function show(after) {
    then = after || null; el.hidden = false; document.body.classList.add('learning');
    try { $('ln-go').focus({ preventScroll: true }); } catch (e) { /* no focus */ }
  }
  $('ln-go').addEventListener('click', close);
  // (capture: before the game's own keys, so Esc here doesn't also close the round's menu under it)
  addEventListener('keydown', (e) => {
    if (el.hidden) return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space' || e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) close(); }
    else e.stopImmediatePropagation();
  }, true);

  return {
    id,
    open: () => !el.hidden,
    show,
    // the round started while it was up (online: the others were ready): out of the way, what it was holding not run
    dismiss() { then = null; close(); },
  };
}
