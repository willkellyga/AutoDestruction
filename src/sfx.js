// One sound mixer for the whole game: Chompers, the rivals, the army and the city all play through it.
//
// Before this, src/main.js, units/src/audio.js and civilian/src/sfx.js each made their own AudioContext with its own
// compressor and its own per-sound gaps, and nothing counted how much was playing at once. In an eight-monster round
// that meant every rival's roar, stomp and crumble went off through the same call as the player's, never quieter than
// 8% however far away (tools/sfx/count-round.mjs measures it).
//
// What the mixer does:
// - plays a recorded clip (assets/sfx, Freesound CC0, see LICENSES.md) when the cue has one, else the old synth recipe;
// - every sound has an owner group: 'me' (the player's monster and what it wrecks), 'rival', 'army', 'city', 'ui';
// - a cue has a minimum gap and a most-at-once count; each group has a most-at-once count; the whole mix has one too;
// - distance fades to nothing (no floor), and anything that would play too quietly to hear is not started;
// - a busy mix keeps its loud, near, important sounds: a new sound that does not fit takes the slot of a quieter,
//   less important one, or is dropped;
// - the player's big moments (roar, quake, a near collapse) briefly duck everything else.
// The clock is game time (tick(dt) from the game step), so the scripted bot rounds count the same as real play.
// Counting (stats()) is on only when window.__sfxCount is set, as tools/sfx/count-round.mjs does.

const GROUPS = { me: { voices: 7, gain: 1 }, rival: { voices: 5, gain: 0.7 }, army: { voices: 6, gain: 0.8 }, city: { voices: 6, gain: 0.85 }, ui: { voices: 2, gain: 1 } };
const MAX_VOICES = 18;          // everything at once
const BUDGET = 3.2;             // the summed gain of what is playing; past it only more important sounds start
const QUIET = 0.05;             // a sound that would start below this gain is not started
const RANGE = 280;              // world units at which a positioned sound has faded to nothing (U = 2.5: 112 m)

// Cue table. gap: least seconds between two starts of the cue; n: most of this cue at once; pri: 0 filler .. 3 must play;
// len: seconds it lasts (for counting voices when there is no clip); clip: the recorded clip set it plays (assets/sfx);
// duck: the player's own start of this cue ducks the other groups.
const CUES = {
  // the monsters (src/main.js, src/rivals.js, src/rival-moves.js, src/rival-full.js)
  roar:     { gap: 0.6, n: 2, pri: 3, len: 1.4, clip: 'roar', duck: true },
  stomp:    { gap: 0.12, n: 3, pri: 2, len: 0.7, clip: 'stomp' },
  quake:    { gap: 0.5, n: 2, pri: 3, len: 1.6, clip: 'quake', duck: true },
  bite:     { gap: 0.09, n: 2, pri: 2, len: 0.3, clip: 'bite' },
  swipe:    { gap: 0.09, n: 2, pri: 1, len: 0.3, clip: 'swipe' },
  hit:      { gap: 0.1, n: 2, pri: 2, len: 0.35, clip: 'hit' },
  leap:     { gap: 0.3, n: 2, pri: 2, len: 0.5, clip: 'leap' },
  dive:     { gap: 0.3, n: 1, pri: 2, len: 0.6, clip: 'whoosh' },
  skid:     { gap: 0.4, n: 1, pri: 1, len: 0.6, clip: 'skid' },
  charge:   { gap: 0.6, n: 2, pri: 2, len: 1.1, clip: 'charge' },
  fire:     { gap: 0.5, n: 2, pri: 2, len: 1.3, clip: 'breath' },
  windup:   { gap: 0.4, n: 2, pri: 2, len: 0.75, clip: 'inhale' },
  breathin: { gap: 0.4, n: 2, pri: 2, len: 0.65, clip: 'inhale' },
  pounceup: { gap: 0.4, n: 2, pri: 2, len: 0.5, clip: 'inhale' },
  chargeup: { gap: 0.4, n: 2, pri: 2, len: 0.45, clip: 'inhale' },
  snuff:    { gap: 0.3, n: 1, pri: 1, len: 0.3 },
  shot:     { gap: 0.12, n: 2, pri: 1, len: 0.25 },
  rad:      { gap: 0.25, n: 1, pri: 2, len: 0.5 },
  radup:    { gap: 0.4, n: 1, pri: 1, len: 0.6 },
  // what breaks (src/sim.js, src/main.js)
  crumble:  { gap: 0.2, n: 2, pri: 1, len: 0.5, clip: 'crumble' },
  collapse: { gap: 0.35, n: 2, pri: 3, len: 1.6, clip: 'collapse', duck: true },
  creak:    { gap: 0.6, n: 1, pri: 1, len: 0.6, clip: 'creak' },
  glass:    { gap: 0.18, n: 2, pri: 1, len: 0.3, clip: 'glass' },
  boom:     { gap: 0.15, n: 3, pri: 2, len: 1.0, clip: 'boom' },
  crackle:  { gap: 0.5, n: 1, pri: 0, len: 0.6, clip: 'crackle' },
  // Mayhem cards (src/mayhem.js)
  laser:    { gap: 0.3, n: 1, pri: 1, len: 0.9, clip: 'zap' },
  thunder:  { gap: 0.4, n: 1, pri: 2, len: 1.6, clip: 'thunder' },
  meteor:   { gap: 0.3, n: 1, pri: 2, len: 0.7, clip: 'meteor' },
  sizzle:   { gap: 0.3, n: 1, pri: 0, len: 0.5, clip: 'sizzle' },
  whoosh:   { gap: 0.2, n: 1, pri: 1, len: 0.5, clip: 'whoosh' },
  // screen sounds: always heard, never positioned
  level:    { gap: 0.3, n: 1, pri: 3, len: 0.6, grp: 'ui' },
  unlock:   { gap: 0.3, n: 1, pri: 3, len: 0.7, grp: 'ui' },
  deny:     { gap: 0.15, n: 1, pri: 3, len: 0.15, grp: 'ui' },
  // the army (units/src/fx.js through src/army.js)
  'a.rifle':  { gap: 0.07, n: 2, pri: 0, len: 0.15, clip: 'rifle' },
  'a.mg':     { gap: 0.09, n: 1, pri: 0, len: 0.15, clip: 'mg' },
  'a.cannon': { gap: 0.2, n: 2, pri: 1, len: 0.9, clip: 'cannon' },
  'a.launch': { gap: 0.2, n: 2, pri: 1, len: 0.8, clip: 'launch' },
  'a.small':  { gap: 0.15, n: 2, pri: 1, len: 0.6, clip: 'shell' },
  'a.big':    { gap: 0.2, n: 2, pri: 2, len: 1.2, clip: 'boom' },
  'a.thud':   { gap: 0.12, n: 1, pri: 0, len: 0.1, clip: 'thud' },
  'a.ping':   { gap: 0.25, n: 1, pri: 0, len: 0.22, clip: 'ping' },
  // the city's vehicles (src/civilians.js)
  'c.boom':    { gap: 0.15, n: 2, pri: 2, len: 1.2, clip: 'carboom' },
  'c.crunch':  { gap: 0.1, n: 2, pri: 1, len: 0.35, clip: 'crunch' },
  'c.glass':   { gap: 0.12, n: 1, pri: 0, len: 0.3, clip: 'glass' },
  'c.clang':   { gap: 0.12, n: 1, pri: 0, len: 0.35, clip: 'clang' },
  'c.thud':    { gap: 0.1, n: 1, pri: 0, len: 0.1, clip: 'thud' },
  'c.alarm':   { gap: 4, n: 1, pri: 0, len: 2.4, clip: 'alarm' },
  'c.splash':  { gap: 0.2, n: 2, pri: 1, len: 1.2, clip: 'splash' },
  'c.hiss':    { gap: 0.6, n: 1, pri: 0, len: 1.1, clip: 'hiss' },
  'c.jet':     { gap: 1.2, n: 1, pri: 1, len: 2.4, clip: 'jet' },
  'c.cat':     { gap: 0.4, n: 1, pri: 1, len: 1.1, clip: 'catapult' },
  'c.gun':     { gap: 0.08, n: 1, pri: 0, len: 0.1, clip: 'gun' },
  'c.crackle': { gap: 0.5, n: 1, pri: 0, len: 0.1, clip: 'crackle' },
};

// Layered cues (Will, 2026-11-20: a wall hit should be scraping, crushing, destruction, not a quick thud).
// A big impact in film and game sound is a stack: a sub-bass thump for weight, a crash for the body, debris and glass
// for detail, and a rumble or debris tail. Each layer is a clip set (assets/sfx, cut by tools/sfx/layers.py);
// g: its share of the cue's gain; d: seconds after the hit it starts (stretched for a bigger monster); k: the least
// monster size (0 hatchling .. 1 fully grown) at which it plays; sub: scaled up with size; rate: playback speed.
// A cue with layers plays all of them as one voice; a layer with no clips loaded is skipped; with none at all the cue
// falls back to its single clip or synth recipe.
const LAYERS = {
  crumble:  [{ clip: 'crash', g: 0.8 }, { clip: 'debris', g: 0.55, d: 0.06 }, { clip: 'sub', g: 0.45, k: 0.35, sub: true }],
  stomp:    [{ clip: 'sub', g: 0.9, sub: true }, { clip: 'thump', g: 0.7 }, { clip: 'debris', g: 0.35, d: 0.08, k: 0.3 }],
  quake:    [{ clip: 'sub', g: 1, sub: true }, { clip: 'thump', g: 0.8 }, { clip: 'rumble', g: 0.9, d: 0.05 }, { clip: 'debris', g: 0.6, d: 0.25 }, { clip: 'crash', g: 0.5, d: 0.1 }],
  collapse: [{ clip: 'crash', g: 1 }, { clip: 'sub', g: 0.8, sub: true }, { clip: 'metal', g: 0.45, d: 0.15 }, { clip: 'rumble', g: 0.9, d: 0.1 }, { clip: 'debris', g: 0.8, d: 0.35 }, { clip: 'glassbig', g: 0.35, d: 0.2 }],
  creak:    [{ clip: 'groan', g: 0.8 }],
  glass:    [{ clip: 'glassbig', g: 0.7 }, { clip: 'debris', g: 0.25, d: 0.1 }],
  boom:     [{ clip: 'boom', g: 0.9 }, { clip: 'sub', g: 0.7, sub: true }, { clip: 'debris', g: 0.5, d: 0.2 }],
  hit:      [{ clip: 'punch', g: 0.8 }, { clip: 'sub', g: 0.5, sub: true }, { clip: 'thump', g: 0.5 }],
  bite:     [{ clip: 'crash', g: 0.5 }, { clip: 'bite', g: 0.7 }],
  swipe:    [{ clip: 'swipe', g: 0.6 }, { clip: 'crash', g: 0.45, d: 0.08 }, { clip: 'debris', g: 0.35, d: 0.12 }],
  roar:     [{ clip: 'roar', g: 1 }, { clip: 'sub', g: 0.35, sub: true, k: 0.4 }],
  'c.crunch': [{ clip: 'metal', g: 0.8 }, { clip: 'glassbig', g: 0.35, d: 0.03 }],
  'c.boom':   [{ clip: 'boom', g: 0.9 }, { clip: 'metal', g: 0.45, d: 0.05 }, { clip: 'debris', g: 0.4, d: 0.2 }],
  'a.big':    [{ clip: 'boom', g: 0.9 }, { clip: 'debris', g: 0.4, d: 0.2 }],
};
// Loops: steady beds whose loudness follows what is going on, in place of hundreds of one-shots a second.
// scrape: Chompers grinding into a building, fed by what he breaks; rubble: the debris trickle after it;
// distant: destruction elsewhere in the city, muffled; city: the city itself (traffic, people), fading as it empties;
// sirens: rising as the city falls. scale: how much feed makes the loop full; tau: seconds the feed takes to fall away.
const LOOPS = {
  scrape:  { clip: 'scrape_loop', grp: 'me', gain: 0.85, scale: 40, tau: 0.25, attack: 0.05, release: 0.35, size: true },
  rubble:  { clip: 'rubble_loop', grp: 'me', gain: 0.55, scale: 60, tau: 1.2, attack: 0.2, release: 1.2 },
  distant: { clip: 'rumble_loop', grp: 'city', gain: 0.5, scale: 120, tau: 1.5, attack: 0.4, release: 2, lp: 700 },
  city:    { clip: 'city_loop', grp: 'city', gain: 0.3, attack: 2, release: 2 },
  sirens:  { clip: 'siren_loop', grp: 'city', gain: 0.22, attack: 3, release: 3, lp: 2500 },
  crowd:   { clip: 'crowd_loop', grp: 'city', gain: 0.2, scale: 400, tau: 4, attack: 1, release: 3, lp: 3000 },
};

// The old per-module gaps (seconds), kept so a counting run can say what the game did before the mixer.
const OLD_GAP = {
  main: { crumble: 0.07, bite: 0.06, boom: 0.09, collapse: 0.22, hit: 0.08, creak: 0.16, glass: 0.05, crackle: 0.09 },
  army: { rifle: 0.045, mg: 0.038, ping: 0.07, thud: 0.04, small: 0.06, big: 0.07, launch: 0.06, cannon: 0.06 },
  civ: { boom: 0.07, crunch: 0.06, glass: 0.05, clang: 0.05, thud: 0.04, alarm: 2.6, crackle: 0.06, splash: 0.09, hiss: 0.4, jet: 0.9, cat: 0.2, gun: 0.04 },
};

// The synth recipes the game used before it had clips (moved here from the three modules, unchanged), still played
// for a cue with no clip. s.n = filtered noise, s.t = a swept tone, r = a little random pitch.
const SYNTH = {
  crumble: (s, v) => { s.n(0.28 + v * 0.25, 900 + Math.random() * 700, 0.7, 0.35 * v); s.t(90 + Math.random() * 30, 45, 0.18, 0.3 * v); },
  swipe: (s, v) => { s.n(0.2, 3200, 0.9, 0.3 * v, 'bandpass', 0.25); s.n(0.1, 900, 1, 0.3 * v, 'lowpass', 0.5); s.t(240, 90, 0.16, 0.22 * v, 'triangle'); },
  bite: (s, v) => { s.n(0.12, 2400, 1.2, 0.22 * v, 'bandpass', 0.3); s.t(170, 60, 0.14, 0.35 * v, 'triangle'); },
  boom: (s, v) => { s.n(0.9, 700, 0.5, 0.9 * v, 'lowpass', 0.12); s.t(110, 28, 0.7, 0.9 * v); },
  collapse: (s, v) => { s.n(1.3, 500, 0.4, 0.7 * v, 'lowpass', 0.25); s.t(70, 30, 0.9, 0.5 * v); },
  windup: (s, v) => { s.t(46, 150, 0.72, 0.34 * v, 'sawtooth'); s.t(180, 560, 0.7, 0.1 * v, 'triangle', 0.12); s.n(0.72, 160, 1.2, 0.34 * v, 'bandpass', 4.2); },
  quake: (s, v) => { s.t(84, 17, 1.15, 1.0 * v); s.t(170, 38, 0.24, 0.5 * v, 'triangle'); s.n(1.5, 320, 0.5, 0.85 * v, 'lowpass', 0.14); s.n(0.09, 3200, 1, 0.5 * v, 'highpass', 1); s.t(44, 28, 1.7, 0.42 * v, 'sine', 0.14); },
  stomp: (s, v) => { s.t(95, 24, 0.6, 1.0 * v); s.n(0.5, 420, 0.6, 0.7 * v, 'lowpass', 0.2); },
  roar: (s, v) => { for (let i = 0; i < 3; i++) s.t(150 - i * 22, 62 - i * 6, 1.25, 0.34 * v, 'sawtooth', i * 0.02); s.n(1.25, 520, 2.5, 0.5 * v, 'bandpass', 0.55); },
  breathin: (s, v) => { s.n(0.62, 420, 1.4, 0.34 * v, 'bandpass', 4.5); s.t(52, 118, 0.6, 0.24 * v, 'sawtooth'); s.t(300, 760, 0.55, 0.05 * v, 'triangle', 0.1); },
  fire: (s, v) => { s.n(1.25, 340, 0.6, 0.95 * v, 'lowpass', 1.5); s.n(1.2, 1500, 0.7, 0.34 * v, 'bandpass', 0.8); s.n(0.14, 2600, 1, 0.4 * v, 'highpass', 1); for (let i = 0; i < 2; i++) s.t(74 - i * 17, 50 - i * 8, 1.2, 0.3 * v, 'sawtooth', i * 0.02); },
  snuff: (s, v) => { s.n(0.3, 900, 0.8, 0.3 * v, 'lowpass', 0.3); s.t(150, 70, 0.12, 0.3 * v, 'triangle'); },
  pounceup: (s, v) => { s.t(50, 175, 0.5, 0.32 * v, 'sawtooth'); s.t(210, 640, 0.48, 0.08 * v, 'triangle', 0.08); s.n(0.5, 190, 1.2, 0.32 * v, 'bandpass', 4.2); },
  dive: (s, v) => { s.t(720, 150, 0.6, 0.11 * v, 'triangle'); s.n(0.62, 480, 1, 0.34 * v, 'bandpass', 3.6); },
  chargeup: (s, v) => { s.n(0.36, 950, 1.5, 0.36 * v, 'bandpass', 0.3); s.t(58, 100, 0.45, 0.3 * v, 'sawtooth'); s.t(200, 420, 0.4, 0.07 * v, 'triangle', 0.08); },
  skid: (s, v) => { s.n(0.6, 1500, 0.9, 0.5 * v, 'bandpass', 0.18); s.t(92, 38, 0.42, 0.32 * v); },
  charge: (s, v) => { s.n(1.1, 300, 1, 0.45 * v, 'bandpass', 4); s.t(60, 130, 1.0, 0.3 * v, 'sawtooth'); },
  leap: (s, v) => { s.t(120, 420, 0.45, 0.3 * v, 'triangle'); s.n(0.4, 600, 1, 0.25 * v, 'bandpass', 3); },
  level: (s) => { [392, 523, 659, 784].forEach((f, i) => s.t(f, f, 0.32, 0.26, 'square', i * 0.09)); },
  radup: (s, v) => { s.t(140, 420, 0.62, 0.07 * v, 'triangle'); s.n(0.6, 700, 2, 0.08 * v, 'bandpass', 3); },
  rad: (s, v) => { s.t(74, 36, 0.55, 0.32 * v, 'sine'); s.t(560, 150, 0.3, 0.1 * v, 'sawtooth'); s.n(0.34, 1100, 1.1, 0.2 * v, 'bandpass', 0.35); },
  laser: (s, v) => { s.t(1400, 900, 0.9, 0.08 * v, 'sawtooth'); s.t(2200, 1800, 0.9, 0.05 * v, 'square'); s.n(0.9, 2600, 3, 0.08 * v, 'bandpass', 0.8); },
  thunder: (s, v) => { s.n(0.18, 4200, 0.7, 0.45 * v, 'highpass', 0.5); s.n(1.6, 420, 0.7, 0.55 * v, 'lowpass', 0.2); s.t(70, 30, 1.2, 0.3 * v, 'sawtooth', 0.05); },
  meteor: (s, v) => { s.t(900, 120, 0.7, 0.07 * v, 'triangle'); s.n(0.7, 1800, 1.2, 0.18 * v, 'bandpass', 0.15); },
  sizzle: (s, v) => { s.n(0.5, 5200, 0.8, 0.07 * v, 'highpass', 0.6); },
  whoosh: (s, v) => { s.n(0.5, 700, 1.2, 0.3 * v, 'bandpass', 3); },
  unlock: (s) => { [523, 659, 784, 1046, 1318].forEach((f, i) => s.t(f, f * 1.01, 0.4, 0.22, 'triangle', i * 0.07)); },
  shot: (s, v) => { s.n(0.25, 1400, 0.8, 0.5 * v, 'lowpass', 0.2); s.t(210, 70, 0.2, 0.4 * v, 'square'); },
  hit: (s, v) => { s.t(240, 90, 0.25, 0.45 * v, 'sawtooth'); s.n(0.2, 1800, 1, 0.3 * v); },
  creak: (s, v) => { s.t(58, 36, 0.6, 0.45 * v, 'sawtooth'); s.n(0.55, 320, 3, 0.3 * v, 'bandpass', 0.6); },
  deny: (s) => { s.t(160, 120, 0.12, 0.2, 'square'); },
  glass: (s, v) => { s.n(0.22, 5200 + Math.random() * 2500, 2.5, 0.3 * v, 'highpass', 1.2); s.t(2600 + Math.random() * 1800, 1500, 0.09, 0.1 * v, 'triangle'); s.t(3900 + Math.random() * 1500, 2400, 0.12, 0.07 * v, 'triangle', 0.03); },
  crackle: (s, v) => { s.n(0.06 + Math.random() * 0.08, 1800 + Math.random() * 2600, 1.5, 0.16 * v, 'bandpass', 0.6); },
  'a.rifle': (s, v, r) => { s.n(0.09, 4200 * r, 0.7, 0.45 * v, 'highpass', 0.5); s.n(0.16, 1300 * r, 0.8, 0.35 * v, 'lowpass', 0.3); s.t(320 * r, 110, 0.07, 0.18 * v, 'square'); },
  'a.mg': (s, v, r) => { s.n(0.07, 2600 * r, 0.8, 0.4 * v, 'bandpass', 0.4); s.n(0.12, 700 * r, 0.7, 0.4 * v, 'lowpass', 0.3); s.t(180 * r, 70, 0.08, 0.25 * v, 'square'); },
  'a.cannon': (s, v) => { s.n(0.9, 1600, 0.5, 1.0 * v, 'lowpass', 0.08); s.t(120, 32, 0.8, 1.0 * v); s.t(70, 28, 1.1, 0.6 * v, 'triangle'); s.n(1.4, 500, 0.6, 0.25 * v, 'lowpass', 0.3, 0.32); },
  'a.launch': (s, v) => { s.n(0.12, 900, 0.6, 0.7 * v, 'lowpass', 0.3); s.n(0.9, 700, 1.6, 0.45 * v, 'bandpass', 4.5, 0.02, 0.05); s.t(300, 900, 0.6, 0.06 * v, 'sawtooth', 0.04); },
  'a.small': (s, v, r) => { s.n(0.6, 1400 * r, 0.5, 0.75 * v, 'lowpass', 0.12); s.t(140 * r, 40, 0.45, 0.6 * v); },
  'a.big': (s, v, r) => { s.n(1.3, 1100 * r, 0.5, 1.0 * v, 'lowpass', 0.08); s.t(95 * r, 26, 1.0, 1.0 * v); s.n(0.5, 3200, 0.7, 0.3 * v, 'highpass', 0.4, 0.03); },
  'a.thud': (s, v, r) => { s.n(0.08, 900 * r, 1, 0.3 * v, 'bandpass', 0.5); s.t(150 * r, 80, 0.06, 0.15 * v, 'triangle'); },
  'a.ping': (s, v, r) => { s.t(2600 * r, 1300 * r, 0.22, 0.07 * v, 'triangle'); s.n(0.05, 5000, 2, 0.12 * v, 'highpass', 0.8); },
  'c.boom': (s, v, r) => { s.n(1.2, 1100 * r, 0.5, 1.0 * v, 'lowpass', 0.08); s.t(100 * r, 28, 0.9, 1.0 * v); s.n(0.5, 3000, 0.7, 0.3 * v, 'highpass', 0.4, 0.03); s.n(1.3, 420, 0.6, 0.22 * v, 'lowpass', 0.3, 0.3); },
  'c.crunch': (s, v, r) => { s.t(120 * r, 40, 0.3, 0.9 * v); s.n(0.34, 900 * r, 1.4, 0.8 * v, 'bandpass', 0.35); s.n(0.22, 2600 * r, 2, 0.4 * v, 'bandpass', 0.6, 0.04); s.t(620 * r, 300, 0.25, 0.08 * v, 'square', 0.02); },
  'c.glass': (s, v) => { for (let i = 0; i < 5; i++) { s.n(0.12 + Math.random() * 0.2, 5200 + Math.random() * 3000, 3, 0.3 * v, 'highpass', 0.9, i * 0.03 + Math.random() * 0.05); s.t(3200 + Math.random() * 2600, 2400, 0.09, 0.04 * v, 'triangle', i * 0.04 + Math.random() * 0.06); } },
  'c.clang': (s, v, r) => { s.t(520 * r, 380 * r, 0.35, 0.16 * v, 'square'); s.t(1310 * r, 1100 * r, 0.25, 0.07 * v, 'triangle'); s.n(0.1, 2400, 1.2, 0.4 * v, 'bandpass', 0.5); },
  'c.thud': (s, v, r) => { s.n(0.1, 700 * r, 1, 0.5 * v, 'bandpass', 0.5); s.t(150 * r, 70, 0.08, 0.3 * v, 'triangle'); },
  'c.alarm': (s, v) => { for (let i = 0; i < 6; i++) { s.t(980, 1400, 0.19, 0.045 * v, 'square', i * 0.4); s.t(1400, 980, 0.19, 0.045 * v, 'square', i * 0.4 + 0.2); } },
  'c.splash': (s, v, r) => { s.n(0.16, 900 * r, 0.8, 0.5 * v, 'lowpass', 0.4); s.n(0.9, 2600 * r, 0.6, 0.34 * v, 'bandpass', 0.5, 0.03); s.n(1.4, 5200, 0.5, 0.14 * v, 'highpass', 0.8, 0.12); },
  'c.jet': (s, v, r) => { s.n(2.6, 900 * r, 0.35, 0.5 * v, 'lowpass', 0.5); s.n(2.2, 2600 * r, 0.6, 0.16 * v, 'bandpass', 0.6, 0.1); s.t(190 * r, 90, 2.2, 0.12 * v, 'sawtooth'); },
  'c.cat': (s, v, r) => { s.t(90 * r, 40, 0.25, 0.7 * v); s.n(1.1, 3800 * r, 0.6, 0.3 * v, 'highpass', 0.7, 0.03); },
  'c.gun': (s, v, r) => { s.n(0.05, 1500 * r, 0.7, 0.4 * v, 'bandpass', 0.6); s.t(210 * r, 120, 0.04, 0.2 * v, 'square'); },
  'c.hiss': (s, v, r) => { s.n(1.1, 6000 * r, 0.7, 0.1 * v, 'highpass', 0.7); },
  'c.crackle': (s, v) => { s.n(0.05 + Math.random() * 0.05, 1800 + Math.random() * 2600, 2.5, 0.16 * v, 'bandpass', 0.7); },
};

// How loud each clip set plays next to the others (the clips are all levelled to the same loudness by tools/sfx).
const CLIP_GAIN = { roar: 0.9, stomp: 0.9, quake: 1, bite: 0.6, swipe: 0.5, hit: 0.7, leap: 0.5, whoosh: 0.5, skid: 0.5, charge: 0.6, breath: 0.8, inhale: 0.55,
  crumble: 0.55, collapse: 0.9, creak: 0.5, glass: 0.45, boom: 0.9, crackle: 0.3, zap: 0.4, thunder: 0.8, meteor: 0.5, sizzle: 0.3,
  rifle: 0.35, mg: 0.4, cannon: 0.75, launch: 0.55, shell: 0.6, ping: 0.3, thud: 0.3, carboom: 0.85, crunch: 0.6, clang: 0.4, alarm: 0.25,
  splash: 0.6, hiss: 0.3, jet: 0.55, catapult: 0.5, gun: 0.35 };

export function makeMixer({ camera }) {
  let ctx = null, master = null, noiseBuf = null, clock = 0, duckT = 0, bank = null;
  const buffers = {}, lastAt = {}, oldLast = {}, voices = [], busOf = {};
  const st = newStats();
  function newStats() { return { req: {}, played: {}, drop: {}, old: {}, sec: [], peak: 0, peakOld: 0, oldVoices: [], t0: 0 }; }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.6;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
      master.connect(comp); comp.connect(ctx.destination);
      for (const g in GROUPS) { const b = ctx.createGain(); b.gain.value = GROUPS[g].gain; b.connect(master); busOf[g] = b; }
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      if (bank) decode();
    } catch (e) { ctx = null; }
  }
  function load(b) { bank = b; if (ctx) decode(); }
  function decode() {
    for (const [set, list] of Object.entries(bank)) {
      buffers[set] = buffers[set] || [];
      for (const u8 of list) {
        const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
        const done = (buf) => buffers[set].push(buf);
        try { const p = ctx.decodeAudioData(ab, done, () => {}); if (p && p.catch) p.catch(() => {}); } catch (e) {}
      }
    }
  }

  // where a sound is from: gain by distance (fades to 0 at RANGE, no floor) and pan across the screen
  function place(x, y, z) {
    const dx = x - camera.position.x, dy = (y || 0) - camera.position.y, dz = z - camera.position.z, d = Math.hypot(dx, dy, dz) || 1;
    const e = camera.matrixWorld.elements;
    const pan = Math.max(-0.8, Math.min(0.8, (dx * e[0] + dy * e[1] + dz * e[2]) / d));
    const k = Math.max(0, Math.min(1, 1.2 - d / RANGE)), gain = k * k;   // squared: quiet falls away faster than it used to
    return { d, pan, gain };
  }
  // what the old code did with the same request (its floor and fade), for the counting runs
  function oldGain(mod, d) { return mod === 'main' ? Math.max(0.08, Math.min(1, 1.25 - d / 275)) : mod === 'army' ? Math.max(0.12, Math.min(1, 1.3 - d / 260)) : Math.max(0.15, Math.min(1, 1.3 - d / 240)); }

  function count(tab, key, grp) { const r = tab[key] || (tab[key] = {}); r[grp] = (r[grp] || 0) + 1; }
  function secBucket() { const s = Math.floor(clock); while (st.sec.length <= s) st.sec.push({ req: 0, old: 0, played: 0 }); return st.sec[s]; }

  // play(cue, vol, x, y, z, grp): x undefined = not positioned (the player's own body sounds, the screen)
  function play(cue, vol = 1, x, y, z, grp = 'me', size = 0.5) {
    const C = CUES[cue]; if (!C) return false;
    if (C.grp) grp = C.grp;
    const at = x !== undefined ? place(x, y, z) : null;
    // counting: every request, and whether the old code would have played it
    const counting = !!window.__sfxCount, sb = counting ? secBucket() : null;
    if (counting) { count(st.req, cue, grp); sb.req++; }
    const mod = cue[1] === '.' ? (cue[0] === 'a' ? 'army' : 'civ') : 'main', base = cue[1] === '.' ? cue.slice(2) : cue, og = OLD_GAP[mod][base] || 0;
    const ok = (k) => k + ':' + grp;
    if (counting && !(og && oldLast[mod + base] !== undefined && clock - oldLast[mod + base] < og)) {
      oldLast[mod + base] = clock; count(st.old, cue, grp); sb.old++;
      st.oldVoices.push({ end: clock + C.len, g: vol * (at ? oldGain(mod, at.d) : 1) });
    }
    if (!api.on) return false;
    // the new limits
    const gap = C.gap * (grp === 'rival' ? 1.5 : 1);
    if (lastAt[ok(cue)] !== undefined && clock - lastAt[ok(cue)] < gap) return drop(cue, 'gap');
    let g = vol * (at ? at.gain : 1) * (CLIP_GAIN[C.clip] || 0.7);
    if (grp !== 'me' && grp !== 'ui' && duckT > clock) g *= 0.5;
    if (g * GROUPS[grp].gain < QUIET) return drop(cue, 'quiet');
    reap();
    const pri = C.pri + (grp === 'me' || grp === 'ui' ? 1 : 0) + g;   // own sounds and loud ones win
    const same = voices.filter((v) => v.cue === cue), inGrp = voices.filter((v) => v.grp === grp);
    let victim = null;
    if (same.length >= C.n) victim = weakest(same, pri);
    else if (inGrp.length >= GROUPS[grp].voices) victim = weakest(inGrp, pri);
    else if (voices.length >= MAX_VOICES) victim = weakest(voices, pri);
    if (victim === false) return drop(cue, same.length >= C.n ? 'cue full' : inGrp.length >= GROUPS[grp].voices ? 'group full' : 'mix full');
    const load = voices.reduce((a, v) => a + v.g, 0);
    if (!victim && load + g > BUDGET && pri < 3) { const w = weakest(voices, pri); if (!w) return drop(cue, 'loud mix'); victim = w; }
    if (victim) stop(victim);
    lastAt[ok(cue)] = clock;
    if (C.duck && grp === 'me') duckT = clock + 0.7;
    const v = { cue, grp, pri, g, end: clock + C.len, node: null };
    if (ctx && ctx.state === 'running') v.node = sound(cue, C, g, at, grp, v, size);
    voices.push(v); if (counting) { count(st.played, cue, grp); sb.played++; }
    st.peak = Math.max(st.peak, voices.length);
    return true;
  }
  function weakest(list, pri) { let w = null; for (const v of list) if (!w || v.pri < w.pri) w = v; return w && w.pri < pri ? w : false; }
  function drop(cue, why) { if (!window.__sfxCount) return false; st.drop[why] = st.drop[why] || {}; st.drop[why][cue] = (st.drop[why][cue] || 0) + 1; return false; }
  function stop(v) { const i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1); if (v.node && ctx) { try { const t = ctx.currentTime; v.node.gain.cancelScheduledValues(t); v.node.gain.setTargetAtTime(0, t, 0.03); } catch (e) {} } }
  function reap() { for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end <= clock) voices.splice(i, 1); }

  function sound(cue, C, g, at, grp, v, size) {
    const out = ctx.createGain(); out.gain.value = 1;
    let to = out, chain = out;
    // far away is muffled as well as quieter: the highs go first, as they do across a real city
    if (at) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; const k = Math.max(0, 1 - at.d / RANGE); f.frequency.value = 600 + 17000 * k * k * k; chain.connect(f); chain = f; }
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = at ? at.pan : 0; chain.connect(p); p.connect(busOf[grp]); } else chain.connect(busOf[grp]);
    // a bigger monster sounds deeper and heavier
    const deep = 1.12 - 0.3 * size;
    const lay = LAYERS[cue];
    if (lay) {
      let any = false, end = 0; const t0 = ctx.currentTime;
      for (const L of lay) {
        if (L.k && size < L.k) continue;
        const set = buffers[L.clip]; if (!set || !set.length) continue;
        const buf = set[Math.floor(Math.random() * set.length)];
        const s = ctx.createBufferSource(); s.buffer = buf;
        s.playbackRate.value = (L.rate || 1) * deep * (0.94 + Math.random() * 0.12);
        const lg = ctx.createGain(); lg.gain.value = g * L.g * (L.sub ? 0.3 + 0.9 * size : 1);
        const d = (L.d || 0) * (1 + size * 0.6);
        s.connect(lg); lg.connect(to); s.start(t0 + d); any = true;
        end = Math.max(end, d + buf.duration / s.playbackRate.value);
      }
      if (any) { v.end = clock + end; return out; }
    }
    const set = C.clip && buffers[C.clip];
    if (set && set.length) {
      const buf = set[Math.floor(Math.random() * set.length)];
      const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = deep * (0.92 + Math.random() * 0.16);
      const vg = ctx.createGain(); vg.gain.value = g; s.connect(vg); vg.connect(to); s.start();
      v.end = clock + buf.duration / s.playbackRate.value;
      return out;
    }
    const recipe = SYNTH[cue]; if (!recipe) return out;
    const k = g / (CLIP_GAIN[C.clip] || 0.7);   // the recipes carry their own loudness
    recipe(synthTo(to), k, 0.85 + Math.random() * 0.3);
    return out;
  }
  function synthTo(to) {
    return {
      n(dur, freq, q, vol, type = 'lowpass', sweep = 0.4, delay = 0, attack = 0) {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; const t = ctx.currentTime + delay;
        f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
        const g = ctx.createGain(); vol = Math.max(0.0011, vol);
        if (attack) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); } else g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        s.connect(f); f.connect(g); g.connect(to); s.start(t, Math.random()); s.stop(t + dur + 0.05);
      },
      t(f0, f1, dur, vol, type = 'sine', delay = 0) {
        const o = ctx.createOscillator(); o.type = type; const t = ctx.currentTime + delay;
        o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(Math.max(0.0011, vol), t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(to); o.start(t); o.stop(t + dur + 0.05);
      },
    };
  }

  // loops: feed(name, amount) adds to a loop's drive; level(name, 0..1) sets it outright; tick() moves the gains
  const loopState = {};
  function feed(name, amount) { const L = loopState[name] || (loopState[name] = { acc: 0, drive: 0, set: null, node: null, idle: 0, size: 0.5 }); L.acc += amount; }
  function level(name, v) { feed(name, 0); loopState[name].set = v; }
  function loopSize(name, size) { feed(name, 0); loopState[name].size = size; }
  function stepLoops(dt) {
    for (const [name, L] of Object.entries(loopState)) {
      const D = LOOPS[name]; if (!D) continue;
      L.drive = L.drive * Math.exp(-dt / (D.tau || 1)) + L.acc; L.acc = 0;
      let want = L.set !== null ? L.set : 1 - Math.exp(-L.drive / (D.scale || 1));
      if (!api.on) want = 0;
      if (!ctx || ctx.state !== 'running') continue;
      if (!L.node && want > 0.02) {
        const set = buffers[D.clip]; if (!set || !set.length) continue;
        const s = ctx.createBufferSource(); s.buffer = set[Math.floor(Math.random() * set.length)]; s.loop = true;
        const g = ctx.createGain(); g.gain.value = 0;
        let to = g; if (D.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = D.lp; g.connect(f); to = f; }
        to.connect(busOf[D.grp]); s.connect(g); s.start(ctx.currentTime, Math.random() * s.buffer.duration);
        L.node = { s, g, cur: 0 };
      }
      if (!L.node) continue;
      const tgt = want * D.gain * (D.grp !== 'me' && duckT > clock ? 0.5 : 1);
      L.node.g.gain.setTargetAtTime(tgt, ctx.currentTime, tgt > L.node.cur ? D.attack : D.release); L.node.cur = tgt;
      if (D.size) L.node.s.playbackRate.setTargetAtTime(1.12 - 0.3 * L.size, ctx.currentTime, 0.3);
      L.idle = want < 0.01 ? L.idle + dt : 0;
      if (L.idle > 5) { try { L.node.s.stop(); } catch (e) {} L.node = null; L.idle = 0; }
    }
  }

  function tick(dt) {
    if (!(dt > 0)) return;
    clock += dt; reap(); stepLoops(dt);
    if (!window.__sfxCount) return;
    // the old code had no voice count: estimate what it had playing from the same requests
    const ov = st.oldVoices; for (let i = ov.length - 1; i >= 0; i--) if (ov[i].end <= clock) ov.splice(i, 1);
    st.peakOld = Math.max(st.peakOld, ov.length);
    const s = secBucket(); s.vo = Math.max(s.vo || 0, ov.length); s.vn = Math.max(s.vn || 0, voices.length);
    s.lo = Math.max(s.lo || 0, ov.reduce((a, v) => a + v.g, 0)); s.ln = Math.max(s.ln || 0, voices.reduce((a, v) => a + v.g, 0));
  }

  // an adapter with the old module's play(name, p, vol) shape, for units/src/fx.js and src/civilians.js
  function module(prefix, grp) {
    return { on: true, init, play: (name, p, vol = 1) => (p ? play(prefix + name, vol, p.x, p.y, p.z, grp) : play(prefix + name, vol, undefined, 0, 0, grp)) };
  }

  // Music: one track at a time on its own bus, outside the sound limits. music(slot) crossfades to that slot's track
  // (a slot with several tracks picks one at random); the same slot again does nothing. 'end' plays once, the rest loop.
  // Tracks are decoded the first time they are wanted, not at load, so a round starts as fast as it did.
  let musicBank = {}, musicBus = null, cur = null, want = null;
  const MUSIC_GAIN = 0.32, FADE = 1.2, ONCE = { end: true };
  function loadMusic(b) { musicBank = b || {}; }
  function music(slot) {
    if (slot === want) return;
    if (!ctx || ctx.state !== 'running') return;   // asked again every frame, so it starts once the sound is woken
    want = slot;
    if (!musicBus) { musicBus = ctx.createGain(); musicBus.gain.value = MUSIC_GAIN; musicBus.connect(master); }
    const t = ctx.currentTime;
    if (cur) { const old = cur; old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t); old.g.gain.linearRampToValueAtTime(0, t + FADE); setTimeout(() => { try { old.s.stop(); } catch (e) {} }, FADE * 1000 + 100); cur = null; }
    const list = slot && musicBank[slot]; if (!list || !list.length) return;
    const u8 = list[Math.floor(Math.random() * list.length)];
    const go = (buf) => {
      if (want !== slot || !buf) return;
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = !ONCE[slot];
      const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE);
      s.connect(g); g.connect(musicBus); s.start(); cur = { s, g, slot };
    };
    if (u8.__buf) return go(u8.__buf);
    const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    try { const p = ctx.decodeAudioData(ab, (buf) => { u8.__buf = buf; go(buf); }, () => {}); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  function musicOn(on) { if (musicBus && ctx) musicBus.gain.setTargetAtTime(on ? MUSIC_GAIN : 0, ctx.currentTime, 0.1); }
  function musicRetry() { const w = want; want = null; music(w); }   // after the context wakes up (first tap)

  const api = { on: true, init, load, play, tick, module, feed, level, loopSize, LAYERS, LOOPS, loadMusic, music, musicOn, musicRetry, CUES, GROUPS, stats: () => st, get clock() { return clock; }, get voices() { return voices.length; }, get track() { return cur ? cur.slot : null; }, get clips() { return Object.values(buffers).reduce((n, b) => n + b.length, 0); }, get ctx() { return ctx; } };
  return api;
}
