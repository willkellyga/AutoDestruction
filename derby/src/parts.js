// The garage: every part a car can be built from, what each does, what it costs, and how a build adds up.
// The idea follows the big car-building brawlers, made simpler: a body sets the base (armour, speed, and how much
// Power it has for guns and gadgets), and every gun, ram and gadget uses some of that Power. Armour and big wheels
// add weight, and weight costs speed. Scrap earned in battle buys parts.
//
// Stats are in the game's own units: hp is health, top and back are voxels a second, accel voxels a second squared,
// turn radians a second, grip how fast sliding dies away, mass relative to a plain hatchback.

export const SLOTS = [
  { key: 'body', name: 'Body', tip: 'The car itself. Sets armour, speed and Power.' },
  { key: 'primary', name: 'Main gun', tip: 'The gun on the turret. Left click.' },
  { key: 'roof', name: 'Roof', tip: 'Bolted to the roof, firing forward. Guns go with left click, rockets with right click.' },
  { key: 'door', name: 'Doors', tip: 'On the doors, firing forward. Guns go with left click, rockets with right click.' },
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
    scrapper: { name: 'Scrapper', desc: 'A boxy little hot hatch. Quick and nimble.', cost: 0, shape: 'hatch', hp: 140, power: 12, mass: 1.0, top: 92, back: 34, accel: 70, turn: 2.5, grip: 7.5, ram: 1.0 },
    bruiser: { name: 'Bruiser', desc: 'A long wood-sided station wagon. More armour, more Power.', cost: 400, shape: 'wagon', hp: 180, power: 14, mass: 1.25, top: 88, back: 32, accel: 62, turn: 2.25, grip: 7.0, ram: 1.2 },
    jackal: { name: 'Jackal', desc: 'An open dune buggy with a roll cage. Light, quick off the line, and thin-skinned.', cost: 550, shape: 'buggy', hp: 115, power: 11, mass: 0.8, top: 104, back: 36, accel: 84, turn: 2.7, grip: 7.2, ram: 0.85 },
    viper: { name: 'Viper', desc: 'A fastback muscle car. Brutal in a straight line.', cost: 700, shape: 'muscle', hp: 135, power: 14, mass: 1.1, top: 106, back: 36, accel: 78, turn: 2.4, grip: 6.6, ram: 1.05 },
    duchess: { name: 'Duchess', desc: 'A finned fifties land yacht. Long, heavy and fast, with a lazy turn.', cost: 850, shape: 'yacht', hp: 175, power: 15, mass: 1.4, top: 100, back: 32, accel: 64, turn: 2.0, grip: 6.6, ram: 1.35 },
    rhino: { name: 'Rhino', desc: 'A boxy 4x4 on big tyres. Tough, grippy, and it shrugs off a knock.', cost: 900, shape: 'offroad', hp: 210, power: 16, mass: 1.45, top: 86, back: 32, accel: 60, turn: 2.15, grip: 7.8, ram: 1.3 },
    hauler: { name: 'Hauler', desc: 'A square-body pickup truck. Huge armour, slow to turn.', cost: 1000, shape: 'pickup', hp: 230, power: 17, mass: 1.55, top: 82, back: 30, accel: 56, turn: 2.0, grip: 7.2, ram: 1.35 },
    stiletto: { name: 'Stiletto', desc: 'A low wedge supercar. The top speed of the lot, and it corners flat.', cost: 1200, shape: 'wedge', hp: 145, power: 15, mass: 1.05, top: 114, back: 36, accel: 82, turn: 2.55, grip: 8.4, ram: 0.95 },
    mule: { name: 'Mule', desc: 'A panel van. Lots of Power and armour, and slow.', cost: 1400, shape: 'van', hp: 265, power: 19, mass: 1.75, top: 78, back: 28, accel: 50, turn: 1.85, grip: 7.0, ram: 1.45 },
    mammoth: { name: 'Mammoth', desc: 'A school bus. Huge armour and Power, and it turns like a ship.', cost: 1800, shape: 'bus', hp: 320, power: 22, mass: 2.2, top: 74, back: 26, accel: 44, turn: 1.65, grip: 7.0, ram: 1.6 },
    kingpin: { name: 'Kingpin', desc: 'A semi truck with no trailer. The most armour and Power, and it hits like a train.', cost: 2200, shape: 'rig', hp: 360, power: 24, mass: 2.6, top: 76, back: 24, accel: 42, turn: 1.55, grip: 7.2, ram: 1.85 },
  },
  primary: {
    mg: { name: 'Machine gun', desc: 'Steady fire at any range.', cost: 0, power: 3, mass: 0.04, fx: 'mg', rate: 11, dmg: 2.6, wall: 0.85, carve: 0.6, spread: 0.6, range: 260, look: 'mg' },
    minigun: { name: 'Minigun', desc: 'Six spinning barrels. Shreds cars up close.', cost: 500, power: 5, mass: 0.08, fx: 'chain', rate: 20, dmg: 2.2, wall: 0.9, carve: 0.6, spread: 1.0, range: 220, spin: 0.5, look: 'minigun' },
    scatter: { name: 'Scattergun', desc: 'A blast of pellets. Brutal close, weak far.', cost: 350, power: 4, mass: 0.06, fx: 'rifle', reload: 0.75, salvo: 1, pellets: 8, dmg: 3.2, wall: 1.1, carve: 0.7, spread: 7, range: 110, look: 'scatter' },
    flamer: { name: 'Flamethrower', desc: 'A jet of burning fuel. Short reach, and what it touches keeps burning.', cost: 550, power: 4, mass: 0.06, flame: true, rate: 14, dmg: 1.8, range: 44, burn: 4, look: 'flamer' },
  },
  // the roof and the doors carry extra weapons that fire forward (within cone radians of straight ahead) with one of
  // the two triggers: group 'guns' with the main gun, group 'heavy' with the heavy weapon
  roof: {
    none: { name: 'Nothing', desc: 'A clean roof.', cost: 0, power: 0, mass: 0 },
    twin: { name: 'Twin guns', desc: 'Two light guns on a roof frame. They fire forward with your main gun.', cost: 350, power: 3, mass: 0.05, fx: 'mg', group: 'guns', rate: 10, dmg: 2.0, wall: 0.7, carve: 0.5, spread: 0.9, range: 230, cone: 0.45, look: 'twin' },
    rack: { name: 'Rocket rack', desc: 'Six small rockets, fired forward three at a time with the heavy weapon.', cost: 500, power: 4, mass: 0.07, fx: 'rocket', group: 'heavy', reload: 2.4, salvo: 3, gap: 0.12, dmg: 13, splash: 12, reach: 12, wall: 4.2, carve: 2.0, range: 300, cone: 0.5, look: 'rack' },
    arc: { name: 'Arc coil', desc: 'Zaps the nearest car close by. No aiming needed.', cost: 700, power: 4, mass: 0.06, arc: true, group: 'guns', reload: 0.45, dmg: 9, range: 36, look: 'arc' },
    mortar: { name: 'Mortar', desc: 'Lobs a heavy shell high over walls and cars, onto wherever you aim. Right click.', cost: 650, power: 4, mass: 0.08, mortar: true, group: 'heavy', reload: 2.4, salvo: 1, dmg: 34, splash: 26, reach: 20, wall: 6, carve: 3, range: 240, cone: 0.5, look: 'mortar' },
  },
  door: {
    none: { name: 'Nothing', desc: 'Plain doors.', cost: 0, power: 0, mass: 0 },
    guns: { name: 'Door guns', desc: 'A gun on each door, firing forward with your main gun.', cost: 300, power: 3, mass: 0.05, fx: 'mg', group: 'guns', rate: 8, dmg: 1.8, wall: 0.7, carve: 0.5, spread: 1.0, range: 210, cone: 0.3, look: 'guns' },
    rockets: { name: 'Side rockets', desc: 'A rocket tube on each door, fired with the heavy weapon.', cost: 450, power: 3, mass: 0.06, fx: 'rocket', group: 'heavy', reload: 2.0, salvo: 2, gap: 0.1, dmg: 10, splash: 9, reach: 13, wall: 4.5, carve: 2.2, range: 300, cone: 0.3, look: 'rockets' },
    shotguns: { name: 'Door shotguns', desc: 'A shotgun on each door, both fired with your main gun. Brutal up close.', cost: 400, power: 3, mass: 0.05, fx: 'rifle', group: 'guns', reload: 0.85, salvo: 1, pellets: 6, dmg: 2.4, wall: 0.9, carve: 0.6, spread: 7, range: 100, cone: 0.3, look: 'shotguns' },
    burners: { name: 'Side burners', desc: 'A flame jet on each door, lit with your main gun. Short reach, and it sets cars alight.', cost: 500, power: 3, mass: 0.05, flame: true, group: 'guns', rate: 12, dmg: 0.8, range: 32, burn: 3, cone: 0.3, look: 'burners' },
    blades: { name: 'Side saws', desc: 'A buzz saw spinning out of each door. Side-swipe a car to cut it up.', cost: 450, power: 2, mass: 0.07, blade: 30, look: 'blades' },
    hubs: { name: 'Hub spikes', desc: 'Spikes out of all four wheels. Rub alongside a car to shred it.', cost: 350, power: 2, mass: 0.05, blade: 22, look: 'hubs' },
  },
  secondary: {
    none: { name: 'Nothing', desc: 'Saves Power for something else.', cost: 0, power: 0, mass: 0 },
    rockets: { name: 'Rocket pod', desc: 'Two rockets a volley. Knocks holes in walls.', cost: 0, power: 4, mass: 0.06, fx: 'rocket', reload: 1.4, salvo: 2, gap: 0.14, dmg: 16, splash: 13, reach: 16, wall: 5.2, carve: 2.6, range: 320, look: 'pod' },
    cannon: { name: 'Cannon', desc: 'One big shell. Huge damage, slow reload.', cost: 600, power: 5, mass: 0.1, fx: 'cannon', reload: 1.6, salvo: 1, dmg: 44, splash: 16, reach: 14, wall: 6.5, carve: 3.0, range: 340, look: 'cannon' },
    mines: { name: 'Mine layer', desc: 'Drops mines behind you for whoever is chasing.', cost: 400, power: 3, mass: 0.05, mine: true, reload: 1.4, dmg: 45, splash: 45, reach: 16, wall: 5, carve: 3, look: 'mines' },
    seekers: { name: 'Seeker missiles', desc: 'Two missiles that steer themselves onto the car in your sights.', cost: 800, power: 5, mass: 0.08, fx: 'missile', seek: true, reload: 2.0, salvo: 2, gap: 0.22, dmg: 18, splash: 14, reach: 13, wall: 3.5, carve: 2.2, look: 'seekers' },
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
    offroad: { name: 'Off-road', desc: 'Chunky tread. More grip, tighter turns, and grass hardly slows them.', cost: 200, power: 0, mass: 0.04, gripK: 1.25, turnK: 1.06, topK: 0.96, roughK: 0.2, look: 'offroad' },
    slicks: { name: 'Racing slicks', desc: 'Top speed up, but they slide.', cost: 300, power: 0, mass: -0.02, gripK: 0.82, topK: 1.1, roughK: 1.15, look: 'slicks' },
    monster: { name: 'Monster tyres', desc: 'Huge. Ram harder and roll over rubble and grass.', cost: 600, power: 1, mass: 0.2, hp: 20, ramK: 1.4, topK: 0.94, roughK: 0.1, look: 'monster' },
  },
  engine: {
    stock: { name: 'Stock', desc: 'A plain four. It runs.', cost: 0, power: 0, mass: 0, look: 'stock' },
    turbo: { name: 'Turbo', desc: 'A four with a turbo on it. Faster off the line.', cost: 250, power: 1, mass: 0.02, accelK: 1.25, pitch: 1.06, look: 'turbo' },
    diesel: { name: 'Big diesel', desc: 'A huge six. Slow to rev, but it shoves: rams harder, and black smoke when you floor it.', cost: 450, power: 2, mass: 0.12, accelK: 1.1, ramK: 1.25, pitch: 0.7, smoke: true, look: 'diesel' },
    v8: { name: 'Big V8', desc: 'More top speed and more pull.', cost: 500, power: 2, mass: 0.06, accelK: 1.12, topK: 1.12, pitch: 0.9, look: 'v8' },
    blower: { name: 'Supercharger', desc: 'A V8 with a blower sticking up through the bonnet. Huge pull and top speed.', cost: 850, power: 3, mass: 0.08, accelK: 1.28, topK: 1.16, pitch: 0.85, look: 'blower' },
    jet: { name: 'Jet turbine', desc: 'A screaming turbine. The highest top speed of all, but slow to wind up.', cost: 1100, power: 4, mass: 0.05, accelK: 0.94, topK: 1.26, pitch: 1.45, whine: true, look: 'jet' },
  },
  gadget: {
    none: { name: 'Nothing', desc: '', cost: 0, power: 0, mass: 0 },
    nitro: { name: 'Nitro', desc: 'Shift for a burst of speed. Ram through anything.', cost: 300, power: 2, mass: 0.02, nitro: { time: 2.2, every: 7, topK: 1.45, accelK: 2.4 } },
    repair: { name: 'Repair kit', desc: 'Shift to patch up 40 health. Once every 25 seconds.', cost: 400, power: 2, mass: 0.02, repair: { hp: 40, every: 25 } },
    shield: { name: 'Shield', desc: 'Shift for four seconds when nothing can hurt you. Once every 20 seconds.', cost: 550, power: 3, mass: 0.03, shield: { time: 4, every: 20 } },
    oil: { name: 'Oil slick', desc: 'Shift to pour a slick behind you. Whoever drives into it spins out.', cost: 300, power: 1, mass: 0.04, oil: { every: 8, life: 14, r: 9 } },
    jump: { name: 'Jump jets', desc: 'Shift to leap over cars and come down on top of them.', cost: 450, power: 2, mass: 0.04, jump: { every: 6, vy: 34 } },
  },
};

export const PAINTS = {
  orange: 0xe0782a, red: 0xc23b2e, blue: 0x2f62a8, teal: 0x2c8f8c, green: 0x3d7d55, yellow: 0xe8b82a, purple: 0x6a3f9a,
  white: 0xe6e4dc, silver: 0xa4a9b0, black: 0x2b2e35, maroon: 0x7c2734, lime: 0x8cc63a, pink: 0xe06a9a, sand: 0xc9a66b,
};
export const PATTERNS = { plain: 'Plain', stripes: 'Racing stripes', flames: 'Flames', camo: 'Camo', checker: 'Checkers', rust: 'Rusty' };

export const STARTER = { body: 'scrapper', primary: 'mg', roof: 'none', door: 'none', secondary: 'rockets', front: 'plow', armour: 'none', wheels: 'street', engine: 'stock', gadget: 'none', paint: 'orange', trim: 'black', pattern: 'stripes' };
export const START_SCRAP = 400;
// what every new garage owns
const FREE = Object.fromEntries(Object.entries(PARTS).map(([slot, list]) => [slot, Object.keys(list).filter((k) => list[k].cost === 0)]));
FREE.front = [...FREE.front, 'plow'];

// everything a build adds up to: the numbers the driving code reads (as tuning.js BODIES did), plus the garage's
// summary for the stat bars
export function statsOf(L) {
  const P = (slot) => PARTS[slot][L[slot]] || PARTS[slot][Object.keys(PARTS[slot])[0]];
  const B = P('body'), parts = ['primary', 'roof', 'door', 'secondary', 'front', 'armour', 'wheels', 'engine', 'gadget'].map(P);
  const power = parts.reduce((s, p) => s + (p.power || 0), 0);
  const mass = B.mass + parts.reduce((s, p) => s + (p.mass || 0), 0);
  const heavy = B.mass / mass, k = (f) => parts.reduce((s, p) => s * (p[f] || 1), 1);
  const hp = B.hp + parts.reduce((s, p) => s + (p.hp || 0), 0);
  const top = B.top * k('topK') * Math.pow(heavy, 0.35), accel = B.accel * k('accelK') * Math.pow(heavy, 0.6);
  const turn = B.turn * k('turnK') * Math.pow(heavy, 0.25), grip = B.grip * k('gripK');
  const front = P('front'), ram = B.ram * front.ram * k('ramK') * (0.85 + 0.15 * mass / B.mass);
  const guns = ['primary', 'roof', 'door', 'secondary'].map(P);
  // a door weapon is a pair, one on each door
  const dps = (g) => (!g || !g.dmg ? 0 : (g.rate ? g.rate * g.dmg : ((g.salvo || 1) * (g.pellets || 1) * g.dmg + (g.splash || 0) * 0.5) / g.reload) * (g === P('door') ? 2 : 1));
  const fire = guns.reduce((s, g) => s + dps(g), 0) + (P('door').blade || 0) * 0.4;
  return {
    hp, top, back: B.back, accel, turn, grip, mass, ram, guard: front.guard, saw: front.saw || 0,
    rough: k('roughK'),   // how much rough ground (a map's grass and gravel) holds the car back: 1 on street tyres
    power, maxPower: B.power, over: power > B.power, shape: B.shape,
    gadget: P('gadget'), dps: fire, blade: P('door').blade || 0,
    // the bars in the garage, 0 to 1
    bars: { armour: hp / 380, speed: (top - 60) / 70, handling: (turn * grip - 9) / 14, firepower: fire / 170, ram: ram / 3 },
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
    body: pick([['scrapper', 'bruiser', 'jackal'], ['scrapper', 'bruiser', 'jackal', 'viper', 'duchess'], ['bruiser', 'jackal', 'viper', 'duchess', 'rhino', 'hauler', 'stiletto', 'mammoth', 'kingpin'], ['viper', 'duchess', 'rhino', 'hauler', 'stiletto', 'mule', 'kingpin'], ['rhino', 'hauler', 'stiletto', 'mule', 'mammoth', 'kingpin']][t]),
    primary: pick(t < 1 ? ['mg'] : t < 3 ? ['mg', 'mg', 'scatter', 'minigun', 'flamer'] : ['mg', 'scatter', 'minigun', 'flamer']),
    roof: pick(t < 1 ? ['none'] : t < 2 ? ['none', 'none', 'twin', 'rack'] : t < 3 ? ['none', 'twin', 'rack', 'mortar'] : ['none', 'twin', 'rack', 'arc', 'mortar']),
    door: pick(t < 2 ? ['none', 'none', 'guns', 'shotguns', 'hubs'] : ['none', 'guns', 'rockets', 'blades', 'shotguns', 'burners', 'hubs']),
    secondary: pick(t < 1 ? ['none', 'none', 'rockets'] : t < 2 ? ['none', 'rockets', 'mines'] : t < 3 ? ['none', 'rockets', 'mines', 'seekers'] : ['rockets', 'cannon', 'mines', 'seekers']),
    front: pick(t < 2 ? ['bumper', 'plow'] : ['plow', 'spikes', 'saws']),
    armour: pick([['none'], ['none', 'light'], ['light', 'medium'], ['medium', 'heavy'], ['heavy']][t]),
    wheels: pick(t < 2 ? ['street', 'offroad'] : ['street', 'offroad', 'slicks', 'monster']),
    engine: pick(t < 2 ? ['stock', 'stock', 'turbo'] : t < 3 ? ['stock', 'turbo', 'v8', 'diesel'] : ['turbo', 'v8', 'diesel', 'blower', 'jet']),
    gadget: pick(t < 1 ? ['none'] : t < 2 ? ['none', 'none', 'nitro', 'oil', 'jump'] : t < 3 ? ['none', 'nitro', 'oil', 'jump', 'shield'] : ['none', 'nitro', 'repair', 'shield', 'oil', 'jump']),
    paint: pick(Object.keys(PAINTS).filter((p) => p !== 'orange')), trim: pick(['black', 'white', 'silver', 'yellow', 'red']), pattern: pick(Object.keys(PATTERNS)),
  };
  return fit(L);
}
// keep within the body's Power: drop the doors, the roof, the heavy weapon, then the front, until it fits
function fit(L) {
  if (statsOf(L).over) L.door = 'none';
  if (statsOf(L).over) L.roof = 'none';
  if (statsOf(L).over) L.secondary = 'none';
  if (statsOf(L).over) L.front = 'bumper';
  if (statsOf(L).over) L.gadget = 'none';
  if (statsOf(L).over) L.primary = 'mg';
  return L;
}
// A rival for the race (modes/race.js), matched to the player's car: one of the two bodies nearest the player's in
// speed (`near`, the player's body's top speed), with the engine and tyres that bring it nearest the top speed it is to
// have (`target`), and middling guns. The race then tunes it the rest of the way, so the field looks like cars of the
// player's sort rather than vans keeping up with a muscle car.
export function racerBuild(target, near) {
  const B = PARTS.body, bodies = Object.keys(B).sort((a, b) => Math.abs(B[a].top - near) - Math.abs(B[b].top - near));
  const L = rivalBuild(2);
  L.body = pick(bodies.slice(0, 2));
  let best = null, bd = Infinity;
  for (const engine of ['stock', 'turbo', 'v8', 'diesel', 'blower', 'jet']) for (const wheels of ['street', 'offroad', 'slicks']) {
    const d = Math.abs(statsOf({ ...L, engine, wheels }).top - target) + Math.random() * 4;   // (a little luck in a near thing)
    if (d < bd) { bd = d; best = { engine, wheels }; }
  }
  return fit(Object.assign(L, best));
}
export const RIVAL_NAMES = ['Rust Bucket', 'Nitro Nell', 'Grinder', 'Blue Fury', 'The Sheriff', 'Silver Shark', 'Black Widow', 'Cream Puff', 'Hot Rod Hank', 'Mad Maxine', 'Bolt', 'Junkyard Dog', 'Crash Kid', 'Tin Can', 'Boom Boom', 'Road Hog'];
