// The garage: every part a car can be built from, what each does, what it costs, and how a build adds up.
// The idea follows the big car-building brawlers, made simpler: a body sets the base (armour, speed, and how much
// Power it has for guns and gadgets), and every gun, ram and gadget uses some of that Power. Armour and big wheels
// add weight, and weight costs speed. Scrap earned in battle buys parts.
//
// Stats are in the game's own units: hp is health, top and back are voxels a second, accel voxels a second squared,
// turn radians a second, grip how fast sliding dies away, mass relative to a plain hatchback.

export const SLOTS = [
  { key: 'body', name: 'Body', tip: 'The car itself. Sets armour, speed and Power.' },
  { key: 'primary', name: 'Roof gun', tip: 'The gun on the turret. Left click.' },
  { key: 'secondary', name: 'Heavy weapon', tip: 'Right click or F.' },
  { key: 'front', name: 'Front', tip: 'What you hit things with.' },
  { key: 'armour', name: 'Armour', tip: 'More health, more weight.' },
  { key: 'wheels', name: 'Wheels', tip: 'Grip, speed and height.' },
  { key: 'engine', name: 'Engine', tip: 'More go.' },
  { key: 'gadget', name: 'Gadget', tip: 'Shift to use.' },
  { key: 'paint', name: 'Paint', tip: 'Colours and patterns. Free.' },
];

export const PARTS = {
  body: {
    scrapper: { name: 'Scrapper', desc: 'A tough little hatchback. Quick and nimble.', cost: 0, shape: 'hatch', hp: 140, power: 10, mass: 1.0, top: 92, back: 34, accel: 70, turn: 2.5, grip: 7.5, ram: 1.0 },
    bruiser: { name: 'Bruiser', desc: 'A heavy four-door. More armour and more Power.', cost: 400, shape: 'sedan', hp: 175, power: 11, mass: 1.2, top: 88, back: 32, accel: 62, turn: 2.3, grip: 7.0, ram: 1.15 },
    viper: { name: 'Viper', desc: 'A muscle car. The fastest thing on the street.', cost: 700, shape: 'muscle', hp: 135, power: 12, mass: 1.1, top: 106, back: 36, accel: 78, turn: 2.4, grip: 6.6, ram: 1.05 },
    hauler: { name: 'Hauler', desc: 'A pickup truck. Huge armour and Power, slow to turn.', cost: 1000, shape: 'pickup', hp: 230, power: 14, mass: 1.55, top: 82, back: 30, accel: 56, turn: 2.0, grip: 7.2, ram: 1.35 },
  },
  primary: {
    mg: { name: 'Machine gun', desc: 'Steady fire at any range.', cost: 0, power: 3, mass: 0.04, fx: 'mg', rate: 11, dmg: 2.6, wall: 0.85, carve: 0.6, spread: 0.6, range: 260, look: 'mg' },
    minigun: { name: 'Minigun', desc: 'Six spinning barrels. Shreds cars up close.', cost: 500, power: 5, mass: 0.08, fx: 'chain', rate: 20, dmg: 2.0, wall: 0.9, carve: 0.6, spread: 1.0, range: 220, spin: 0.5, look: 'minigun' },
    scatter: { name: 'Scattergun', desc: 'A blast of pellets. Brutal close, weak far.', cost: 350, power: 4, mass: 0.06, fx: 'rifle', reload: 0.75, salvo: 1, pellets: 8, dmg: 3.2, wall: 1.1, carve: 0.7, spread: 7, range: 110, look: 'scatter' },
  },
  secondary: {
    none: { name: 'Nothing', desc: 'Saves Power for something else.', cost: 0, power: 0, mass: 0 },
    rockets: { name: 'Rocket pod', desc: 'Two rockets a volley. Knocks holes in walls.', cost: 0, power: 4, mass: 0.06, fx: 'rocket', reload: 1.1, salvo: 2, gap: 0.14, dmg: 22, splash: 18, reach: 16, wall: 5.2, carve: 2.6, range: 320, look: 'pod' },
    cannon: { name: 'Cannon', desc: 'One big shell. Huge damage, slow reload.', cost: 600, power: 5, mass: 0.1, fx: 'cannon', reload: 1.6, salvo: 1, dmg: 38, splash: 16, reach: 14, wall: 6.5, carve: 3.0, range: 340, look: 'cannon' },
    mines: { name: 'Mine layer', desc: 'Drops mines behind you for whoever is chasing.', cost: 400, power: 3, mass: 0.05, mine: true, reload: 1.4, dmg: 45, splash: 45, reach: 16, wall: 5, carve: 3, look: 'mines' },
  },
  front: {
    bumper: { name: 'Steel bumper', desc: 'A plain bar. Better than nothing.', cost: 0, power: 0, mass: 0.02, ram: 1.0, guard: 0.8, look: 'bumper' },
    plow: { name: 'Ram plow', desc: 'Takes the hit for you. You take half damage ramming.', cost: 150, power: 1, mass: 0.08, ram: 1.3, guard: 0.5, look: 'plow' },
    spikes: { name: 'Spike ram', desc: 'Spikes that punch through cars and walls.', cost: 350, power: 1, mass: 0.07, ram: 1.75, guard: 0.6, look: 'spikes' },
    saws: { name: 'Buzz saws', desc: 'Spinning blades. Grind anything you touch.', cost: 600, power: 2, mass: 0.06, ram: 1.1, guard: 0.7, saw: 32, look: 'saws' },
  },
  armour: {
    none: { name: 'No plates', desc: 'Light and quick.', cost: 0, power: 0, mass: 0, hp: 0, look: 0 },
    light: { name: 'Light plates', desc: 'Door plates. A little more health.', cost: 150, power: 0, mass: 0.1, hp: 35, look: 1 },
    medium: { name: 'Steel plates', desc: 'Doors, sills and a roof plate.', cost: 350, power: 0, mass: 0.22, hp: 75, look: 2 },
    heavy: { name: 'Battle cage', desc: 'Thick plates and bars over the glass.', cost: 700, power: 0, mass: 0.4, hp: 125, look: 3 },
  },
  wheels: {
    street: { name: 'Street', desc: 'Good at everything, great at nothing.', cost: 0, power: 0, mass: 0, look: 'street' },
    offroad: { name: 'Off-road', desc: 'Chunky tread. More grip, tighter turns.', cost: 200, power: 0, mass: 0.04, gripK: 1.25, turnK: 1.06, topK: 0.96, look: 'offroad' },
    slicks: { name: 'Racing slicks', desc: 'Top speed up, but they slide.', cost: 300, power: 0, mass: -0.02, gripK: 0.82, topK: 1.1, look: 'slicks' },
    monster: { name: 'Monster tyres', desc: 'Huge. Ram harder and roll over rubble.', cost: 600, power: 1, mass: 0.2, hp: 20, ramK: 1.4, topK: 0.94, look: 'monster' },
  },
  engine: {
    stock: { name: 'Stock', desc: 'It runs.', cost: 0, power: 0, mass: 0 },
    turbo: { name: 'Turbo', desc: 'Faster off the line.', cost: 250, power: 1, mass: 0.02, accelK: 1.25 },
    v8: { name: 'Big V8', desc: 'More top speed and more pull.', cost: 500, power: 2, mass: 0.06, accelK: 1.12, topK: 1.12 },
  },
  gadget: {
    none: { name: 'Nothing', desc: '', cost: 0, power: 0, mass: 0 },
    nitro: { name: 'Nitro', desc: 'Shift for a burst of speed. Ram through anything.', cost: 300, power: 2, mass: 0.02, nitro: { time: 2.2, every: 7, topK: 1.45, accelK: 2.4 } },
    repair: { name: 'Repair kit', desc: 'Shift to patch up 40 health. Once every 25 seconds.', cost: 400, power: 2, mass: 0.02, repair: { hp: 40, every: 25 } },
  },
};

export const PAINTS = {
  orange: 0xe0782a, red: 0xc23b2e, blue: 0x2f62a8, teal: 0x2c8f8c, green: 0x3d7d55, yellow: 0xe8b82a, purple: 0x6a3f9a,
  white: 0xe6e4dc, silver: 0xa4a9b0, black: 0x2b2e35, maroon: 0x7c2734, lime: 0x8cc63a, pink: 0xe06a9a, sand: 0xc9a66b,
};
export const PATTERNS = { plain: 'Plain', stripes: 'Racing stripes', flames: 'Flames', camo: 'Camo', checker: 'Checkers', rust: 'Rusty' };

export const STARTER = { body: 'scrapper', primary: 'mg', secondary: 'rockets', front: 'plow', armour: 'none', wheels: 'street', engine: 'stock', gadget: 'none', paint: 'orange', trim: 'black', pattern: 'stripes' };
export const START_SCRAP = 400;
// what every new garage owns
const FREE = Object.fromEntries(Object.entries(PARTS).map(([slot, list]) => [slot, Object.keys(list).filter((k) => list[k].cost === 0)]));
FREE.front = [...FREE.front, 'plow'];

// everything a build adds up to: the numbers the driving code reads (as tuning.js BODIES did), plus the garage's
// summary for the stat bars
export function statsOf(L) {
  const P = (slot) => PARTS[slot][L[slot]] || PARTS[slot][Object.keys(PARTS[slot])[0]];
  const B = P('body'), parts = ['primary', 'secondary', 'front', 'armour', 'wheels', 'engine', 'gadget'].map(P);
  const power = parts.reduce((s, p) => s + (p.power || 0), 0);
  const mass = B.mass + parts.reduce((s, p) => s + (p.mass || 0), 0);
  const heavy = B.mass / mass, k = (f) => parts.reduce((s, p) => s * (p[f] || 1), 1);
  const hp = B.hp + parts.reduce((s, p) => s + (p.hp || 0), 0);
  const top = B.top * k('topK') * Math.pow(heavy, 0.35), accel = B.accel * k('accelK') * Math.pow(heavy, 0.6);
  const turn = B.turn * k('turnK') * Math.pow(heavy, 0.25), grip = B.grip * k('gripK');
  const front = P('front'), ram = B.ram * front.ram * k('ramK') * (0.85 + 0.15 * mass / B.mass);
  const g1 = P('primary'), g2 = P('secondary');
  const dps = (g) => (!g || !g.dmg ? 0 : g.rate ? g.rate * g.dmg : ((g.salvo || 1) * (g.pellets || 1) * g.dmg + (g.splash || 0) * 0.5) / g.reload);
  return {
    hp, top, back: B.back, accel, turn, grip, mass, ram, guard: front.guard, saw: front.saw || 0,
    power, maxPower: B.power, over: power > B.power, shape: B.shape,
    gadget: P('gadget'), dps: dps(g1) + dps(g2),
    // the bars in the garage, 0 to 1
    bars: { armour: hp / 380, speed: (top - 60) / 70, handling: (turn * grip - 9) / 14, firepower: (dps(g1) + dps(g2)) / 130, ram: ram / 3 },
  };
}

// ---- the save: scrap, what has been bought, and the build (kept in this browser only) ----
const KEY = 'auto-destruction-save-1';
export function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
  if (!s || !s.load) s = { scrap: START_SCRAP, owned: FREE, load: { ...STARTER } };
  for (const slot of Object.keys(PARTS)) { s.owned[slot] = Array.from(new Set([...(s.owned[slot] || []), ...FREE[slot]])); if (!PARTS[slot][s.load[slot]]) s.load[slot] = STARTER[slot]; }
  if (!PAINTS[s.load.paint]) s.load.paint = STARTER.paint;
  if (!PAINTS[s.load.trim]) s.load.trim = STARTER.trim;
  if (!PATTERNS[s.load.pattern]) s.load.pattern = 'plain';
  return s;
}
export function keepSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* not kept */ } }

// the rivals' builds: better parts as the waves go on
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export function rivalBuild(wave) {
  const t = Math.min(4, wave);
  const L = {
    body: pick([['scrapper', 'bruiser'], ['scrapper', 'bruiser', 'viper'], ['bruiser', 'viper', 'hauler'], ['bruiser', 'viper', 'hauler'], ['viper', 'hauler']][t]),
    primary: pick(t < 1 ? ['mg'] : t < 3 ? ['mg', 'mg', 'scatter', 'minigun'] : ['mg', 'scatter', 'minigun']),
    secondary: pick(t < 1 ? ['none', 'none', 'rockets'] : t < 3 ? ['none', 'rockets', 'mines'] : ['rockets', 'cannon', 'mines']),
    front: pick(t < 2 ? ['bumper', 'plow'] : ['plow', 'spikes', 'saws']),
    armour: pick([['none'], ['none', 'light'], ['light', 'medium'], ['medium', 'heavy'], ['heavy']][t]),
    wheels: pick(t < 2 ? ['street', 'offroad'] : ['street', 'offroad', 'slicks', 'monster']),
    engine: pick(t < 2 ? ['stock'] : ['stock', 'turbo', 'v8']),
    gadget: 'none',
    paint: pick(Object.keys(PAINTS).filter((p) => p !== 'orange')), trim: pick(['black', 'white', 'silver', 'yellow', 'red']), pattern: pick(Object.keys(PATTERNS)),
  };
  // keep within the body's Power: drop the heavy weapon, then the front, until it fits
  if (statsOf(L).over) L.secondary = 'none';
  if (statsOf(L).over) L.front = 'bumper';
  if (statsOf(L).over) L.primary = 'mg';
  return L;
}
export const RIVAL_NAMES = ['Rust Bucket', 'Nitro Nell', 'Grinder', 'Blue Fury', 'The Sheriff', 'Silver Shark', 'Black Widow', 'Cream Puff', 'Hot Rod Hank', 'Mad Maxine', 'Bolt', 'Junkyard Dog', 'Crash Kid', 'Tin Can', 'Boom Boom', 'Road Hog'];
