// Auto Destruction: drive a gun car round Crumbletown (Monster Mayhem's town, its destruction and its tuning, used as
// they are) and wreck waves of rival cars. Scrap from wrecks buys parts in the garage (garage.js, parts.js).
import './flags.js';   // first: which world this page lays out (New York for the race), before src/world.js reads it
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { WX, WZ, WY, CITY, solid, bodies, ownerAt, idx } from '../../src/world.js';
import * as world from '../../src/world.js';
import { look } from '../../src/mesh.js';
import { hooks, stats, cfg, initSim, stepSim, blast, explode, setFocus, setParticleScale, sparks, dust } from '../../src/sim.js';
import { makeCivilians } from '../../src/civilians.js';
import { makeMixer } from '../../src/sfx.js';
import { DEFAULT_TRIMS } from '../../src/sfx-trims.js';
import { SFX_BANK, SFX_NORM } from '../../src/sfx-bank.js';
import { makeFx, WEAPONS } from '../../units/src/fx.js';
import { Vehicle, newFrame } from './vehicle.js';
import { makeDriver, clearLine } from './ai.js';
import { MAP, MAPS, chooseMap } from './maps/index.js';
import { MODES } from './modes/index.js';
import { CRASH, ROUND, AI, DRIFT, BUILDINGS } from './tuning.js';
import { toughen, boom, chipAt, fuelBlast } from './sturdy.js';
import { PAINTS, loadSave, keepSave, rivalBuild, RIVAL_NAMES } from './parts.js';
import { makeGarage } from './garage.js';
import { makeSounds } from './audio.js';
import { makePickups } from './pickups.js';
import { makeHazards } from './hazards.js';
import { makeQuality } from './quality.js';
import { makeDrift } from './drift.js';
import { makeBackdrop } from './backdrop.js';
import { nightLook, makeNight } from './night.js';
import { makeGround } from './ground.js';
import { makeDirt } from './dirt.js';
import { makeStreaks } from './streaks.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const PROPS = { prop: true };

// ---- renderer, scene, light (as Monster Mayhem's) --------------------------------------------------------------
const canvas = $('view');
const MOBILE = navigator.maxTouchPoints > 0 && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
// touch controls and auto-aim: on phones and tablets (or with ?touch=1 in the address)
let TOUCH = MOBILE || /[?&]touch=1/.test(location.search);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene(); scene.matrixAutoUpdate = false;
const HORIZON = new THREE.Color(0xf3d2ae);
scene.fog = new THREE.Fog(HORIZON, CITY ? 420 : 300, CITY ? 1700 : 1150);
renderer.setClearColor(HORIZON);
const camera = new THREE.PerspectiveCamera(64, 1, 0.5, 2400);
const sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 24, 12), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x4a92d0) }, bot: { value: HORIZON } },
  vertexShader: 'varying float h; void main(){ h=normalize(position).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float h; void main(){ float t=pow(clamp(h*1.6,0.0,1.0),0.6); gl_FragColor=vec4(mix(bot,top,t),1.0); }',
}));
sky.renderOrder = -2; scene.add(sky);
// The dome goes with the camera, just inside the far edge, as Monster Mayhem's does (placeSky, before each draw). Left at the
// map's corner, its far side lay past the far edge when looking away from that corner, and the black behind it showed as
// a dark slab on the horizon. The clear colour is the haze too, so a gap anywhere shows sky, not black.
sky.scale.setScalar(camera.far * 0.95 / 2200);
const placeSky = () => sky.position.copy(camera.position);
const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x9a8460, 1.25); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d2, 2.7);
sun.castShadow = true; sun.shadow.mapSize.set(MOBILE ? 2048 : 4096, MOBILE ? 2048 : 4096);
const sc = sun.shadow.camera; sc.left = -220; sc.right = 220; sc.top = 200; sc.bottom = -200; sc.near = 20; sc.far = 1100;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.8;
scene.add(sun); scene.add(sun.target);
// A map that runs at night (the arena) has its own sky, fog and light (night.js); the sun is then its floodlight bank,
// which shines from the south-east tower, the way the sun already does
if (MAP.night) nightLook({ scene, renderer, sky, hemi, sun });
const SUN_DIR = new THREE.Vector3(0.55, 0.95, 0.35).normalize();
const SUN_R = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), SUN_DIR).normalize(), SUN_U = new THREE.Vector3().crossVectors(SUN_DIR, SUN_R);
const _sunC = new THREE.Vector3();
function followSun(x, z) {   // the shadow box follows the player, in whole texels so shadows do not crawl
  const tex = (sc.right - sc.left) / sun.shadow.mapSize.x;
  _sunC.set(x, 0, z); const u = _sunC.dot(SUN_R), v = _sunC.dot(SUN_U);
  _sunC.addScaledVector(SUN_R, Math.round(u / tex) * tex - u).addScaledVector(SUN_U, Math.round(v / tex) * tex - v);
  sun.target.position.copy(_sunC); sun.position.copy(_sunC).addScaledVector(SUN_DIR, 480);
}

// ---- the map: built once as the page loads (maps/index.js picks which) ------------------------------------------
MAP.build();
const floor = makeGround({ scene, renderer, MAP, mobile: MOBILE });   // the map's painted floor, and on dirt its detail and ruts (ground.js)
{
  // the land past the edge of the map: one plain colour, or a map's own world round it (the arena's city: backdrop.js)
  if (!MAP.backdrop) {
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(6400, 6400), new THREE.MeshLambertMaterial({ color: MAP.outer ?? 0x7fb069, depthWrite: false }));
    outer.renderOrder = -1; outer.rotation.x = -Math.PI / 2; outer.position.set(WX / 2, -0.06, WZ / 2); scene.add(outer);
  }
}
const backdrop = MAP.backdrop ? makeBackdrop({ scene, layout: MAP.backdrop, mobile: MOBILE, viewH: () => renderer.domElement.height }) : null;
initSim(scene);
const drifts = makeDrift({ scene, camera, mobile: MOBILE, el: $('drift'), soft: floor.dirtAt });   // skid marks, tyre smoke, the drift meter
const dirt = makeDirt({ scene, camera, renderer, floor, MAP, mobile: MOBILE });   // ruts, rooster tails, dust and clods off the wheels
const streaks = MAP.mode === 'race' ? makeStreaks({ scene, mobile: MOBILE }) : null;   // the air rushing past, flat out
look.detail.value = 1; look.dusk.value = 0;
cfg.dust = 0.55; cfg.hang = 0.2;
toughen();   // sturdier buildings than the town's own (sturdy.js, tuning.js BUILDINGS)

// ---- the light pass: bloom, grade, vignette ---------------------------------------------------------------------
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: MOBILE ? 0 : 4 }));
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(4, 4), 0.24, 0.55, 1.3));
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.05 }, con: { value: 1.07 }, vig: { value: 0.32 }, hurt: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float sat; uniform float con; uniform float vig; uniform float hurt; varying vec2 vUv; void main(){ vec4 c=texture2D(tDiffuse,vUv); float l=dot(c.rgb,vec3(0.2126,0.7152,0.0722)); c.rgb=mix(vec3(l),c.rgb,sat); c.rgb=max(vec3(0.0),(c.rgb-0.18)*con+0.18)*vec3(1.03,1.0,0.96); vec2 d=vUv-0.5; float e=smoothstep(0.18,0.9,dot(d,d)*2.2); c.rgb*=1.0-vig*e; c.rgb=mix(c.rgb,vec3(0.9,0.08,0.04),hurt*e*0.8); gl_FragColor=c; }',
}));
const grade = composer.passes[2];
composer.addPass(new OutputPass());

// ---- sound: Monster Mayhem's mixer and recorded clips ------------------------------------------------------------
const audioMix = makeMixer({ camera }); audioMix.load(SFX_BANK, SFX_NORM);
for (const [k, v] of Object.entries(DEFAULT_TRIMS)) audioMix.setTrim(k, v);
let muted = false, engine = null;
const sfx = makeSounds(() => audioMix.ctx);
function initAudio() {
  audioMix.init();
  if (engine || !sfx.init()) return;
  // the player's engine and tyres, and the two nearest rivals' engines, on loops
  engine = { me: sfx.loop('engine_loop'), skid: sfx.loop('skid_loop'), rivals: [sfx.loop('engine_loop'), sfx.loop('engine_loop')], spin: sfx.loop('mini_spin'), saw: sfx.loop('saw_loop'), hum: sfx.loop('arc_hum') };
}
function sound(name, vol = 1, x, y, z) {
  audioMix.on = !muted;
  const grp = x !== undefined && player && Math.hypot(x - player.x, z - player.z) > 140 ? 'city' : 'me';
  if (grp === 'city' && (name === 'crumble' || name === 'glass' || name === 'creak')) return;
  audioMix.play(name, vol, x, y, z, grp, 0.4);
}
const armySfx = audioMix.module('a.', 'army');

// ---- effects: the army's guns and the town's cars -------------------------------------------------------------
const mats = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1, color: new THREE.Color(1.2, 1.2, 1.2) }), new THREE.MeshBasicMaterial({ vertexColors: true })];
const game = { state: 'menu', time: 0, wave: 0, kills: 0, deaths: 0, shake: 0, slow: 1, banner: 0, nextWave: 0, killTimes: [] };
// scrap, the parts bought and the build are kept in this browser (parts.js)
const save = loadSave();
Object.defineProperty(game, 'scrap', { get: () => save.scrap, set: (v) => { save.scrap = v; } });
let savedT = 0;
const fakeMon = { x: -9999, y: 0, z: -9999, S: 1, hp: 1e9, maxHp: 1e9, chargeT: 0, hurtT: 0, yaw: 0 };
const civ = makeCivilians({ scene, camera, mon: fakeMon, game: { get state() { return 'idle'; }, time: 0 }, U: 2.5, R: () => 6, hurt() {}, toast() {}, addXp() {}, PROPS, muted: () => muted, mixer: audioMix, tanks: () => [], rivals: () => [], viewH: () => renderer.domElement.height, cubePx: () => 0 });
const debris = civ.debris;
const cube = (x, y, z, vx, vy, vz, c, s) => debris.spawn(x, y, z, vx, vy, vz, c, s);
// the cars' cubes are small (a sixteenth of a metre): only some of the ones a hit knocks off fly, a little bigger
const chip = (x, y, z, vx, vy, vz, c, s) => { if (Math.random() < 0.07) debris.spawn(x, y, z, vx, vy, vz, c, s * 2.5); };   // the cubes are fine, so keep a few and make them bigger
// the scattergun's pellets: the rifle's round, with one bang for the whole blast
WEAPONS.pellet = { ...WEAPONS.rifle, vol: 0, len: 3.5, w: 0.13, tracerEvery: 1 };
const cars = [];   // every combat car, the player's first
// other things on the map the guns can hit and blasts can hurt (a mode's zombies, say): each has
// solid(x, y, z), hit(p, dmg, owner, gun, dir) and explosion(x, y, z, reach, base, by)
const extras = [];
let player = null;
let by = null;      // whose shot or crash is breaking things right now (for scrap and kills)
// what the guns' shots can strike: the combat cars
const target = {
  solid: (x, y, z) => { if (!mode.friendly) for (const c of cars) if (!c.gone && c.inside(x, y, z)) return true; for (const e of extras) if (e.solid(x, y, z)) return true; return false; },   // (a friendly mode's shots go through cars)
  colorAt: (p) => { for (const c of cars) if (c.inside(p.x, p.y, p.z, 1)) return PAINTS[c.load.paint] ?? 0x777b82; return 0x777b82; },
  scorch() {}, update() {}, scorched: 0,
};
const fx = makeFx(scene, { target, debris, audio: armySfx, shake: (a, p) => hooks.shake(a, p.x, p.y, p.z), world: { solid: (x, y, z) => solid(Math.floor(x), Math.floor(y), Math.floor(z)) !== 0 }, onLand, trail: 0.5 });

// ---- hooks from the town's destruction -------------------------------------------------------------------------
hooks.sound = sound;
hooks.shake = (a, x, y, z) => { if (x !== undefined && player) a *= clamp(1.3 - Math.hypot(x - player.x, z - player.z) / 180, 0, 1); game.shake = Math.min(1.4, game.shake + a); };
hooks.impact = () => {};
// where the player has broken things lately (x, z, time): a building gives way later, in the town's own step, so the
// credit for flattening it goes to whoever was knocking it about
const myHits = [];
const noteHit = (x, z) => { myHits.push(x, z, game.time); if (myHits.length > 192) myHits.splice(0, 3); };
hooks.destroyed = (n, x, y, z, indirect) => {
  if (by === player && player) { game.scrap += n * (indirect ? 0.02 : 0.04); if (!indirect) noteHit(x, z); }
  if (!indirect && n > 6) sound('crumble', clamp(n / 120, 0.25, 1), x, y, z);
};
hooks.bodyDown = (b) => {
  if (b.kind === 'prop' || b.kind === 'rubble' || b.kind === 'tree' || b.init < 300) return;
  let mine = by === player;
  for (let i = 0; !mine && i < myHits.length; i += 3) mine = game.time - myHits[i + 2] < 20 && myHits[i] > b.x0 - 6 && myHits[i] < b.x1 + 7 && myHits[i + 1] > b.z0 - 6 && myHits[i + 1] < b.z1 + 7;
  if (mine) { game.scrap += 25; toast(`${b.name} flattened`, '+25 scrap'); }
};
const scorches = []; let scorchN = 0, scorchMat = null;
hooks.scorch = (x, z, r) => {
  dirt.blast(x, z, r);   // on the dirt a blast digs a crater and throws clods
  if (!scorchMat) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(20,16,14,0.8)'); gr.addColorStop(0.55, 'rgba(30,24,20,0.45)'); gr.addColorStop(1, 'rgba(30,24,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    scorchMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  let m = scorches[scorchN % 48];
  if (!m) { m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), scorchMat); m.rotation.x = -Math.PI / 2; m.renderOrder = 1; scene.add(m); scorches[scorchN % 48] = m; }
  m.position.set(x, 0.04 + (scorchN % 48) * 0.002, z); m.scale.set(r, r, 1); m.updateMatrixWorld(); scorchN++;
};
// any explosion in town (a rocket, a fuel tank going up, a car) hurts the cars round it
let splashK = null;
hooks.explosion = (x, y, z, r) => {
  const base = (splashK ? splashK.splash : 16) * (by && by.rival ? AI.dmg : 1), reach = splashK ? splashK.reach : r * 2.4 + 4;
  for (const c of cars) {
    if (c.dead) continue;
    const d = Math.hypot(c.x - x, c.z - z) - c.wide; if (d > reach) continue;
    const k = 1 - Math.max(0, d) / reach;
    damage(c, base * k, mode.friendly && !splashK ? null : by);   // in a friendly mode the map's own blasts (fuel tanks) hurt everyone
    const p = Math.max(1, Math.hypot(c.x - x, c.z - z)); c.vx += (c.x - x) / p * 30 * k; c.vz += (c.z - z) / p * 30 * k;
  }
  for (const e of extras) e.explosion(x, y, z, reach, base, by);
};
// the town's parked cars blow up through a blast of their own (src/civilians.js); that should hurt as well
const civBlast = hooks.blast;
hooks.blast = (cx, cy, cz, r, o) => {
  civBlast(cx, cy, cz, r, o);
  fuelBlast(cx, cy, cz, r, o);   // a fuel tank going up breaks less of the buildings round it (sturdy.js)
  if (o && o.push === 32 && o.core === 0.5) { splashK = { splash: 22, reach: r * 2 + 6 }; try { hooks.explosion(cx, cy, cz, r); } finally { splashK = null; } }
};

// ---- the cars ----------------------------------------------------------------------------------------------------
function addCar(load, at, rival) {
  const c = new Vehicle(scene, mats, load, at);
  if (rival) { c.driver = makeDriver(c); c.rival = true; c.maxHp = c.hp = Math.round(c.spec.hp * AI.hp); }
  cars.push(c); makeTag(c);
  return c;
}
function damage(c, d, who) {
  if (!c || c.dead || d <= 0 || game.state === 'menu') return;
  if (c.shield > 0) return;   // just back in (the arena's free-for-all): nothing hurts it for a moment
  if (mode.friendly && who && who !== c) return;   // a mode with no fighting between cars (survival): only the dead and the map hurt
  if (c === player && who === player) d *= 0.35;   // your own splash hurts, but less
  if (window.__dlog) window.__dlog.push([c.name, who ? who.name : (splashK ? 'boom' : 'wall'), Math.round(d * 10) / 10]);
  c.hp -= d; c.hurtT = 0.25; if (who && who !== c) c.lastBy = who;
  if (c === player) game.hurt = Math.min(1, (game.hurt || 0) + d / 40);
  if (c.hp <= 0) wreck(c, who);
}
function wreck(c, who) {
  if (c.dead) return;
  c.dead = true; c.deadT = 0; c.hp = 0;
  const p = c.centre(new THREE.Vector3());
  c.unit.kill(p, 6, chip);
  c.blowParts(cube, p, 16);
  sfx.play(c.maxHp > 200 ? 'bigboom' : 'carboom', 1, p.x, p.z);
  const was = by; by = who || (mode.friendly ? c : null); splashK = { splash: 18, reach: 18 };   // (friendly: the wreck's own blast spares the other cars)
  try { boom(p.x, 2.5, p.z, 5.5, 0.6, { maxDebris: 260, fire: true }, BUILDINGS.wreck); } finally { by = was; splashK = null; }
  if (c === player) {
    game.deaths++; keepSave(save);
    const r = mode.playerDown();
    if (r && r.respawn !== undefined) { game.state = 'dead'; game.deadT = r.respawn; $('dead').hidden = r.respawn <= 0.01; $('dead-garage').hidden = !!r.noGarage; game.noGarage = !!r.noGarage; $('dead-go').hidden = !!r.noSkip; }
    if (document.exitPointerLock && game.state === 'dead') document.exitPointerLock();
  }
  else if (who === player) {
    game.kills++; game.scrap += 100; toast(`${c.name} wrecked`, '+100 scrap');
    game.killTimes = game.killTimes.filter((t) => game.time - t < 6); game.killTimes.push(game.time);
    if (game.killTimes.length === 3) { sfx.play('vo_rampage', 1); game.scrap += 75; setTimeout(() => toast('Rampage!', 'Three in a row: +75 scrap'), 900); }
  }
  else if (who && who !== c) toast(`${who.name} wrecked ${c.name}`, '');
  mode.wrecked(c, who);
}

// ---- the weapons ------------------------------------------------------------------------------------------------
// what each weapon sounds like (audio.js; clips named <base>_2, _3 are played as variations of <base>)
const SHOT = { mg: 'mg_shot', chain: 'mini_shot', rifle: 'scatter_shot', cannon: 'cannon_shot', rocket: 'rocket_launch' };
// one round, or one salvo of pellets, from weapon G of car c (each door gun fires at once; the roof's barrels take turns)
const _m = new THREE.Vector3(), _d = new THREE.Vector3(), _a = new THREE.Vector3(), _r = new THREE.Vector3(), _q = new THREE.Vector3(), _ap = new THREE.Vector3();
function shoot(c, G) {
  const g = G.g;
  if (!G.mounts.length) return;
  const barrels = G.slot === 'door' ? G.mounts.map((_, i) => i) : [G.next];
  G.next = (G.next + 1) % G.mounts.length;
  for (const i of barrels) {
    if (!c.muzzle(G, _m, _d, i)) continue;
    if (g.mine) { dropMine(c, g, _m); return; }
    // a round whose way out crosses its own car's box (a gun aimed down over the bonnet, a door gun aimed in across the
    // nose) starts just past the box
    const aim = coneAim(c, G, _ap);
    _r.subVectors(aim, _m).normalize(); let past = -1;
    for (let t = 0; t < c.half * 2 + 3; t += 0.5) if (c.inside(_m.x + _r.x * t, _m.y + _r.y * t, _m.z + _r.z * t, 0.2)) past = t;
    if (past >= 0) _m.addScaledVector(g.fx === 'rocket' ? _d : _r, past + 0.5);
    const dist = aim.distanceTo(_m), n = g.pellets || 1;
    if (g.fx === 'rocket') _d.y += 0.12;
    for (let k = 0; k < n; k++) {
      const sp = (g.spread || 0) * Math.max(dist, n > 1 ? 20 : 0) / 100;   // the pellets spread wider the further they go
      _a.copy(aim).add(_r.set((Math.random() - 0.5) * sp, (Math.random() - 0.5) * sp * (n > 1 ? 0.5 : 1), (Math.random() - 0.5) * sp));
      const s = fx.fire(n > 1 && k > 0 ? 'pellet' : g.fx, _m, _d, _a, c.unit);
      s.owner = c; s.gun = g;
    }
    if (c.rival && player && !player.dead && g.fx !== 'rocket' && g.fx !== 'cannon') nearMiss(_m, _a);
  }
  // the bang: the light guns on the roof and doors have their own
  const me = c === player, light = G.slot === 'roof' || G.slot === 'door';
  const name = light && g.fx === 'mg' ? 'twin_shot' : SHOT[g.fx];
  if (name) sfx.play(name, me ? 1 : 0.85, c.x, c.z, { gap: g.rate ? 0.03 : 0, jitter: 0.05 });
  if (me && g.rate && !light && Math.random() < 0.18) sfx.play('brass', 0.5, c.x, c.z, { gap: 0.2 });
  if (g.pellets) c.pumpT = 0.3;
  if (g.spin) c.firing = 0.3;
  if (g.fx === 'cannon' || g.fx === 'rocket' || g.pellets) { const kick = g.fx === 'cannon' ? 5 : light ? 1.5 : 3; c.vx -= Math.sin(c.gunYaw) * kick; c.vz -= Math.cos(c.gunYaw) * kick; }
}
// where weapon G fires at: the car's aim point, or for a weapon on the roof or doors, as near to it as that weapon turns
function coneAim(c, G, out) {
  out.copy(c.aim);
  if (!G.cone || c.inCone(G, c.aim.x, c.aim.z)) return out;
  const dx = c.aim.x - c.x, dz = c.aim.z - c.z, d = Math.max(30, Math.hypot(dx, dz));
  const a = c.yaw + clamp(wrap(Math.atan2(dx, dz) - c.yaw), -G.cone, G.cone);
  return out.set(c.x + Math.sin(a) * d, c.aim.y, c.z + Math.cos(a) * d);
}
// a rival's round flying close past the player's car cracks by
function nearMiss(from, to) {
  _q.subVectors(to, from); const L = _q.length(); if (L < 1) return; _q.multiplyScalar(1 / L);
  const t = clamp((player.x - from.x) * _q.x + (player.z - from.z) * _q.z, 0, L + 40);
  const d = Math.hypot(from.x + _q.x * t - player.x, from.z + _q.z * t - player.z);
  if (d > player.wide + 1 && d < player.wide + 6) sfx.play('crack', 0.7, from.x + _q.x * t, from.z + _q.z * t, { gap: 0.12, jitter: 0.12 });
}
// the arc coil: a bolt jumps to the nearest car close by, wherever it is
const bolts = [], boltMat = new THREE.LineBasicMaterial({ color: 0xa8e4ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
function zap(c, G) {
  let best = null, bd = G.g.range;
  for (const o of mode.friendly ? [] : cars) { if (o === c || o.dead || o.gone) continue; const d = Math.hypot(o.x - c.x, o.z - c.z) - o.wide; if (d < bd) { bd = d; best = o; } }
  if (!best || !c.muzzle(G, _m, null, 0)) return false;
  const to = best.centre(_a); to.y = 2.2 + Math.random();
  let b = bolts.find((x) => x.t <= 0);
  if (!b) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3)); b = { line: new THREE.Line(geo, boltMat), t: 0 }; b.line.frustumCulled = false; b.line.renderOrder = 13; scene.add(b.line); bolts.push(b); }
  const pos = b.line.geometry.attributes.position;
  for (let i = 0; i < 14; i++) {
    const t = i / 13, j = i === 0 || i === 13 ? 0 : 1.4 * Math.sin(t * Math.PI);
    pos.setXYZ(i, _m.x + (to.x - _m.x) * t + (Math.random() - 0.5) * j, _m.y + (to.y - _m.y) * t + (Math.random() - 0.5) * j + Math.sin(t * Math.PI) * 2, _m.z + (to.z - _m.z) * t + (Math.random() - 0.5) * j);
  }
  pos.needsUpdate = true; b.line.visible = true; b.t = 0.14; b.line.updateMatrixWorld();
  const was = by; by = c;
  try { damage(best, G.g.dmg * (c.rival ? AI.dmg : 1), c); } finally { by = was; }
  _q.subVectors(to, _m).normalize();
  best.unit.hit(best.surface(_r.copy(to).addScaledVector(_q, -3), _q, 6, _ap) || to, 0.5, chip, 6);
  sparks(to.x, to.y, to.z, 12, 0.6, 0.85, 1, 26);
  sfx.play('arc_zap', c === player ? 1 : 0.8, c.x, c.z, { jitter: 0.1 });
  c.arcT = 0.25; best.vx *= 0.9; best.vz *= 0.9;
  return true;
}
function stepBolts(dt) { for (const b of bolts) if (b.t > 0 && (b.t -= dt) <= 0) b.line.visible = false; }
// the triggers: want[0] the guns, want[1] the heavy weapons
function guns(c, dt, want) {
  c.arcT = Math.max(0, (c.arcT || 0) - dt);
  if (c.pumpT > 0 && (c.pumpT -= dt) <= 0) sfx.play('pump', c === player ? 0.9 : 0.6, c.x, c.z);
  for (const G of c.guns) {
    const g = G.g, pull = !!want[G.group];
    G.t = Math.max(0, G.t - dt);
    // the rivals don't waste the roof and door weapons on cars that aren't in front of them
    const ok = !G.cone || !c.rival || c.inCone(G, c.aim.x, c.aim.z, 0.25);
    if (g.arc) { if (pull && G.t <= 0 && zap(c, G)) G.t = g.reload; continue; }
    if (g.rate) {   // automatic: keeps firing while held
      if (pull && ok && (G.cone || c.onTarget(0.5))) { while (G.t <= 0) { shoot(c, G); G.t += 1 / g.rate; } }
    } else {        // one load at a time: a salvo, then the reload
      if (G.left > 0) { G.gapT -= dt; if (G.gapT <= 0) { shoot(c, G); G.left--; G.gapT = g.gap || 0; } }
      else if (pull && ok && G.t <= 0) { G.left = g.salvo || 1; G.gapT = 0; G.t = g.reload; G.clack = c === player && !g.mine && !g.pellets; }
      if (G.clack && G.t > 0 && G.t < 0.4) { G.clack = false; sfx.play('reload', 0.7, c.x, c.z); }
    }
  }
}
// where a shot landed: hit 1 a car, 2 the ground, 3 a building
function onLand(s, hit, p) {
  const g = s.gun; if (!g) return;
  const was = by; by = s.owner;
  try {
    if (hit === 1) {
      const c = !mode.friendly && cars.find((o) => !o.gone && o.inside(p.x, p.y, p.z, 1.2));
      if (c && c !== s.owner) {
        let d = g.dmg * (s.owner && s.owner.rival ? AI.dmg : 1);
        if (g.pellets) d *= clamp(1.3 - s.from.distanceTo(p) / g.range, 0.15, 1);   // the scattergun is brutal close and weak far
        damage(c, d, s.owner);
        const q = c.surface(_q.copy(p).addScaledVector(s.dir, -0.8), s.dir, 7) || p;   // carve where the cubes are
        c.unit.hit(q, g.carve, chip, 8);
        if (c.dead && g.splash) c.unit.hit(q, g.carve * 1.4, chip, 14);
        if (!g.splash) sfx.play('tink', 0.9, p.x, p.z, { gap: 0.045, jitter: 0.2 });
      } else if (!c) {
        let d = g.dmg * (s.owner && s.owner.rival ? AI.dmg : 1);
        if (g.pellets) d *= clamp(1.3 - s.from.distanceTo(p) / g.range, 0.15, 1);
        for (const e of extras) if (e.solid(p.x, p.y, p.z) && e.hit(p, d, s.owner, g, s.dir)) break;
      }
    } else if (hit === 3 && g.wall && !g.splash) {
      chipAt(p, s.dir, g.wall);   // a round chips out the block it strikes (sturdy.js)
    }
    if (g.splash) {   // rockets and shells go off: the town's own explosion, which also does the splash
      splashK = g;
      sfx.play('rocket_boom', g.fx === 'cannon' ? 1 : 0.85, p.x, p.z, { gap: 0.05, rate: g.fx === 'cannon' ? 0.85 : 1 });
      boom(p.x, Math.max(1, p.y), p.z, g.wall * (hit === 3 ? 1 : 0.6), 0.35, { maxDebris: 200, fire: Math.random() < 0.35 }, BUILDINGS.shell);
    }
  } finally { by = was; splashK = null; }
}

// two cars meeting: each is two circles, front and back
const _n = { x: 0, z: 0 };
function bump(a, b) {
  let best = 0, ax = 0, az = 0, bx = 0, bz = 0;
  const ra = a.wide + 0.6, rb = b.wide + 0.6;
  for (const fa of [-0.55, 0.55]) for (const fb of [-0.55, 0.55]) {
    const x1 = a.x + Math.sin(a.yaw) * (a.mid + a.half * fa), z1 = a.z + Math.cos(a.yaw) * (a.mid + a.half * fa);
    const x2 = b.x + Math.sin(b.yaw) * (b.mid + b.half * fb), z2 = b.z + Math.cos(b.yaw) * (b.mid + b.half * fb);
    const d = Math.hypot(x2 - x1, z2 - z1), over = ra + rb - d;
    if (over > best) { best = over; ax = x1; az = z1; bx = x2; bz = z2; }
  }
  if (best <= 0) return;
  const d = Math.hypot(bx - ax, bz - az) || 1; _n.x = (bx - ax) / d; _n.z = (bz - az) / d;
  const ma = a.dead ? 2.2 : a.spec.mass, mb = b.dead ? 2.2 : b.spec.mass, ia = 1 / ma, ib = 1 / mb;
  a.x -= _n.x * best * ia / (ia + ib); a.z -= _n.z * best * ia / (ia + ib); b.x += _n.x * best * ib / (ia + ib); b.z += _n.z * best * ib / (ia + ib);
  const vrel = (b.vx - a.vx) * _n.x + (b.vz - a.vz) * _n.z;
  if (vrel >= 0) return;
  const j = -(1 + 0.35 * CRASH.kick) * vrel / (ia + ib);
  a.vx -= j * ia * _n.x; a.vz -= j * ia * _n.z; b.vx += j * ib * _n.x; b.vz += j * ib * _n.z;
  const hitSp = -vrel; if (hitSp < 10) return;
  // the one driving into the other is the rammer; its plow takes less
  const ta = a.vx * _n.x + a.vz * _n.z, tb = -(b.vx * _n.x + b.vz * _n.z), ram = ta >= tb ? a : b, hit = ram === a ? b : a;
  const cp = new THREE.Vector3((ax + bx) / 2, 2.6, (az + bz) / 2), dmg = hitSp * CRASH.carHurt * ram.spec.ram;
  const was = by; by = ram;
  try { damage(hit, dmg * (ram.rival && hit === player ? AI.ram : 1), ram); damage(ram, dmg * CRASH.ramShare * (ram.spec.guard ?? 1), hit); } finally { by = was; }
  hit.unit.hit(cp, clamp(0.8 + hitSp * 0.03, 0.8, 3.2), chip, 6);
  sparks(cp.x, cp.y, cp.z, Math.round(6 + hitSp * 0.3), 1, 0.8, 0.4, 24);
  sound(hitSp > 40 ? 'crash' : 'metal', clamp(hitSp / 60, 0.35, 1.2), cp.x, cp.y, cp.z);
  sfx.play(hitSp > 38 ? 'crunch_heavy' : 'crunch', clamp(hitSp / 45, 0.35, 1.2), cp.x, cp.z, { gap: 0.1 });
  if (a === player || b === player) game.shake = Math.min(1.4, game.shake + hitSp / 80);
}
// what driving into the town feels like
const crashHooks = {
  smash(c, into, H, n) {
    if (c === player) { game.shake = Math.min(1.2, game.shake + clamp(n / 160, 0.1, 0.7)); noteHit(H.x, H.z); }
    if (n > 30) { sound('crash', clamp(n / 140, 0.3, 1.1), H.x, H.y, H.z); sfx.play('crunch_heavy', clamp(n / 120, 0.3, 1), H.x, H.z, { gap: 0.15 }); }
  },
  bump(c, into, H) {
    damage(c, (into - CRASH.bump) * CRASH.wallHurt * 4, null);
    sound('thud', clamp(into / 50, 0.3, 1), H.x, H.y, H.z); sparks(H.x, 2.5, H.z, 6, 1, 0.8, 0.4, 14);
    sfx.play(into > 30 ? 'crunch' : 'scrape', clamp(into / 40, 0.3, 1), H.x, H.z, { gap: 0.25 });
    if (c === player) game.shake = Math.min(1.2, game.shake + into / 90);
  },
  // a drift held long enough pays out a short burst as it ends (vehicle.js)
  drift(c, lvl) {
    sfx.play('nitro', c === player ? 0.35 + 0.15 * lvl : 0.25, c.x, c.z, { rate: 1.3, gap: 0.3 });
    if (c === player) drifts.boost(c, lvl);
  },
};
// the parked cars stand in the way until they are smashed
const _body = { x: 0, z: 0, vx: 0, vz: 0 };
function parked(c, dt) {
  for (const f of [0.5, -0.5]) {
    _body.x = c.x + Math.sin(c.yaw) * (c.mid + c.half * f); _body.z = c.z + Math.cos(c.yaw) * (c.mid + c.half * f); _body.vx = c.vx; _body.vz = c.vz;
    const ox = _body.x, oz = _body.z, rec = civ.block(_body, c.wide + 0.8, 0, dt);
    if (!rec) continue;
    const sp = c.speed;
    c.pushT = (c.pushT || 0) + dt;
    if ((sp > 12 || c.pushT > 0.5) && !c.dead) {
      c.pushT = 0;
      const was = by; by = c;
      try { blast(civ.at.x, 3, civ.at.z, 2.5 + sp * 0.04, { push: 10 + sp * 0.3, dx: c.vx / sp, dz: c.vz / sp, maxDebris: 40 }); } finally { by = was; }
      c.vx *= 0.8; c.vz *= 0.8;
      if (c === player) game.shake = Math.min(1.2, game.shake + 0.25);
    } else { c.x += _body.x - ox; c.z += _body.z - oz; c.vx = _body.vx; c.vz = _body.vz; }
  }
}

// ---- the buzz saws, the mines and the gadgets -------------------------------------------------------------------
// a car with saws grinds whatever is right in front of its nose
const _f = new THREE.Vector3();
function saws(c, dt) {
  if (!c.spec.saw || c.dead) return;
  const fx_ = c.x + Math.sin(c.yaw) * (c.mid + c.half - 0.6), fz = c.z + Math.cos(c.yaw) * (c.mid + c.half - 0.6);
  for (const o of cars) {
    if (o === c || o.gone || !o.inside(fx_, 2.2, fz, 1.4)) continue;
    const was = by; by = c;
    try { damage(o, c.spec.saw * dt * (c.rival ? AI.dmg : 1), c); } finally { by = was; }
    c.sawT = (c.sawT || 0) - dt;
    if (c.sawT <= 0) {
      c.sawT = 0.12; _f.set(fx_, 2.2, fz);
      _q.set(Math.sin(c.yaw), 0, Math.cos(c.yaw)); _f.addScaledVector(_q, -1.5);
      o.unit.hit(o.surface(_f, _q, 5, _r) || _f, 0.9, chip, 10); sparks(fx_, 2.4, fz, 10, 1, 0.85, 0.45, 30);
      sfx.play('grind', 0.9, fx_, fz, { gap: 0.35 }); sfx.play('tink', 0.6, fx_, fz, { gap: 0.08, rate: 0.8 });
    }
  }
}
// side blades cut whatever a car rubs along
const _bl = new THREE.Vector3();
function blades(c, dt) {
  if (!c.spec.blade || c.dead) return;
  const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
  for (const o of cars) {
    if (o === c || o.gone || Math.hypot(o.x - c.x, o.z - c.z) > c.half + o.half + 6) continue;
    for (const side of [1, -1]) for (const f of [-0.35, 0.1, 0.5]) {
      const lx = side * ((c.def.dims.blade || c.wide + 1.5) - 0.3), lz = c.mid + c.half * f;
      const x = c.x + lx * cy + lz * sy, z = c.z - lx * sy + lz * cy;
      if (!o.inside(x, 1.6, z, 0.5)) continue;
      const rel = Math.hypot(o.vx - c.vx, o.vz - c.vz);
      const was = by; by = c;
      try { damage(o, c.spec.blade * dt * clamp(rel / 30, 0.35, 1.6) * (c.rival ? AI.dmg : 1), c); } finally { by = was; }
      c.bladeT = (c.bladeT || 0) - dt;
      if (c.bladeT <= 0) {
        c.bladeT = 0.12; _bl.set(x, 1.6, z); _q.set(side * cy, 0, -side * sy);
        o.unit.hit(o.surface(_bl.addScaledVector(_q, -1.5), _q, 5, _r) || _bl, 0.8, chip, 8); sparks(x, 1.8, z, 9, 1, 0.85, 0.45, 26);
        sfx.play('grind', 0.85, x, z, { gap: 0.3 });
      }
      return;
    }
  }
}
// mines: dropped behind, armed after a moment, set off by any car that comes close (the one that dropped it too)
const mines = [];
const mineGeo = new THREE.CylinderGeometry(1.0, 1.15, 0.45, 10), mineMat = new THREE.MeshStandardMaterial({ color: 0x3b3f45, roughness: 0.5, metalness: 0.4 });
const mineLamp = new THREE.MeshBasicMaterial({ color: 0xff3a2a }), lampGeo = new THREE.BoxGeometry(0.35, 0.3, 0.35);
function dropMine(c, g, at) {
  if (mines.length >= 14) { const old = mines.shift(); old.mesh.removeFromParent(); }
  const m = new THREE.Mesh(mineGeo, mineMat); m.castShadow = true;
  const l = new THREE.Mesh(lampGeo, mineLamp); l.position.y = 0.35; m.add(l);
  m.position.set(at.x, 0.25, at.z); m.matrixAutoUpdate = true; scene.add(m);
  mines.push({ x: at.x, z: at.z, t: 0, owner: c, g, mesh: m, lamp: l });
  sfx.play('mine_drop', c === player ? 1 : 0.8, at.x, at.z);
}
function stepMines(dt) {
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i]; m.t += dt;
    m.lamp.visible = m.t < 1.2 || (m.t * 3) % 1 < 0.5;
    if (m.t < 1.2) continue;
    if (!m.armed) { m.armed = true; sfx.play('mine_beep', 0.8, m.x, m.z); }
    const hit = cars.find((o) => !o.gone && !o.dead && Math.hypot(o.x - m.x, o.z - m.z) < o.wide + 1.6 && (o !== m.owner || m.t > 3));
    if (!hit && m.t < 45) continue;
    mines.splice(i, 1); m.mesh.removeFromParent();
    if (!hit) continue;
    const was = by; by = m.owner; splashK = m.g;
    try { boom(m.x, 1, m.z, m.g.wall, 0.5, { maxDebris: 160, fire: true }, BUILDINGS.shell); hit.vx *= 0.3; hit.vz *= 0.3; } finally { by = was; splashK = null; }
  }
}
// Shift: the gadget. Nitro is a burst of speed; the repair kit patches the car up.
function gadget(c) {
  const G = c.gadget; if (!G || c.dead || c.gadgetT > 0) return;
  if (G.nitro) { c.boostT = G.nitro.time; c.gadgetT = G.nitro.every; sfx.play('nitro', 1, c.x, c.z); }
  else if (G.repair) {
    if (c.hp >= c.maxHp) { if (c === player) toast('Already in one piece', ''); return; }
    c.hp = Math.min(c.maxHp, c.hp + G.repair.hp); c.gadgetT = G.repair.every;
    sfx.play('ui_equip', 1); sfx.play('servo', 0.8); if (c === player) toast('Patched up', `+${G.repair.hp} armour`);
  }
}
function stepGadget(c, dt) {
  c.gadgetT = Math.max(0, c.gadgetT - dt);
  const N = (c.gadget && c.gadget.nitro) || c.padNitro;   // padNitro: a burst from a map's nitro pickup or boost strip
  if (N && c.boostT > 0) {
    c.boostT -= dt; c.boost = N.topK; c.accelK = N.accelK;
    const bx = c.x - Math.sin(c.yaw) * (c.half - c.mid + 0.4), bz = c.z - Math.cos(c.yaw) * (c.half - c.mid + 0.4);
    sparks(bx, 1.2, bz, 3, 0.45, 0.75, 1, 10);
  } else { c.boost = 1 + (c.lift || 0); c.accelK = 1 + (c.liftAccel || 0); }   // lift: a race's tow or catch-up (modes/race.js)
}

// ---- name tags and the HUD ---------------------------------------------------------------------------------------
const tags = $('tags');
function makeTag(c) {
  if (!c.rival) return;
  const el = document.createElement('div'); el.className = 'tag';
  el.innerHTML = `<b></b><i><s></s></i>`; el.querySelector('b').textContent = c.name; tags.appendChild(el); c.tag = el;
}
const _p = new THREE.Vector3();
function drawTags() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  for (const c of cars) {
    if (!c.tag) continue;
    _p.set(c.x, c.top + 6, c.z);
    const d = camera.position.distanceTo(_p); _p.project(camera);
    const show = !c.dead && _p.z < 1 && d < 320 && game.state !== 'menu';
    c.tag.style.display = show ? '' : 'none'; if (!show) continue;
    c.tag.style.transform = `translate(${(_p.x * 0.5 + 0.5) * W}px, ${(-_p.y * 0.5 + 0.5) * H}px) translate(-50%, -100%) scale(${clamp(90 / d, 0.55, 1)})`;
    c.tag.querySelector('s').style.width = `${(c.hp / c.maxHp) * 100}%`;
    c.tag.classList.toggle('hit', c.hurtT > 0);
  }
}
let toastT = 0;
function toast(a, b) { if (!$('over').hidden) return;   // a late wreck message would sit over the results card
  $('toast').innerHTML = `<b></b><span></span>`; $('toast').querySelector('b').textContent = a; $('toast').querySelector('span').textContent = b; $('toast').classList.add('on'); toastT = 2.2; }
function banner(text, sub) { $('banner').querySelector('b').textContent = text; $('banner').querySelector('span').textContent = sub || ''; $('banner').classList.add('on'); game.banner = 2.4; }
const radar = $('radar').getContext('2d');
function drawRadar() {
  // the whole map, or the part of it the map asks for (MAP.radarBox: [x0, z0, x1, z1], New York's course)
  const B = MAP.radarBox || [0, 0, WX, WZ], s = 150 / Math.max(B[2] - B[0], B[3] - B[1]), w = WX * s, h = WZ * s;
  const R = radar, ox = (150 - (B[2] - B[0]) * s) / 2 - B[0] * s, oy = (150 - (B[3] - B[1]) * s) / 2 - B[1] * s;
  R.clearRect(0, 0, 150, 150);
  R.fillStyle = 'rgba(20,24,28,0.55)'; R.fillRect(ox, oy, w, h);
  MAP.radar(R, s, ox, oy, w, h);
  if (mode.radar) mode.radar(R, s, ox, oy, w, h);
  for (const c of cars) {
    if (c.gone) continue;
    const x = ox + c.x * s, y = oy + c.z * s;
    if (c === player) {
      R.save(); R.translate(x, y); R.rotate(-c.yaw + Math.PI); R.fillStyle = c.dead ? '#888' : '#ffb33a';
      R.beginPath(); R.moveTo(0, -6); R.lineTo(4.5, 5); R.lineTo(-4.5, 5); R.closePath(); R.fill(); R.restore();
    } else { R.fillStyle = c.dead ? 'rgba(140,140,140,0.6)' : '#ff4a3a'; R.beginPath(); R.arc(x, y, c.dead ? 2.2 : 3.2, 0, 7); R.fill(); }
  }
}
function drawHud() {
  if (!player) return;
  $('hp-fill').style.width = `${(Math.max(0, player.hp) / player.maxHp) * 100}%`;
  $('hp-text').textContent = Math.ceil(Math.max(0, player.hp));
  $('speed').textContent = Math.round(Math.abs(player.fwd) / 4 * 3.6);   // voxels a second to km/h
  const sec = player.guns.find((G) => G.slot === 'secondary') || player.guns.find((G) => G.group === 1);
  $('sec').hidden = !sec; $('sec-name').textContent = sec ? sec.g.name : '';
  if (sec) { const k = sec.left > 0 ? 0 : sec.t / sec.g.reload; $('sec-fill').style.width = `${(1 - k) * 100}%`; $('sec').classList.toggle('ready', k <= 0); }
  if (TOUCH) {
    const heavy = player.guns.find((g) => g.group === 1); $('t-heavy').hidden = !heavy;
    if (heavy && $('t-heavy').dataset.k !== heavy.key) { $('t-heavy').dataset.k = heavy.key; $('t-heavy').textContent = heavy.g.mine ? 'Mine' : heavy.g.fx === 'cannon' ? 'Cannon' : 'Rockets'; }
    $('t-boost').hidden = !player.gadget || !player.gadget.cost; $('t-boost').textContent = player.gadget && player.gadget.repair ? 'Fix' : 'Nitro';
    $('t-boost').classList.toggle('ready', player.gadgetT <= 0);
  }
  const G = player.gadget, every = G && (G.nitro ? G.nitro.every : G.repair ? G.repair.every : 0);
  $('gad').hidden = !every;
  if (every) { $('gad-fill').style.width = `${(1 - player.gadgetT / every) * 100}%`; $('gad').classList.toggle('ready', player.gadgetT <= 0); }
  const [top, sub, count] = mode.hud(); $('wave').textContent = top; $('left').textContent = sub;
  // the counter by the scrap: cars wrecked, unless the mode counts something else (survival counts zombies)
  $('kills-l').textContent = count ? count[0] : 'Wrecked'; $('kills').textContent = count ? count[1] : game.kills; $('scrap').textContent = Math.floor(game.scrap);
}

// ---- the round: the map's mode runs it (modes/) --------------------------------------------------------------------
let rivalN = 0;
// a rival with the build for wave n, coming in where the mode (or else the map) says
function addRival(n, at) {   // (n can be a build itself: the race's rivals are matched to the player's car)
  const load = { ...(typeof n === 'object' ? n : rivalBuild(n)), name: RIVAL_NAMES[(rivalN++) % RIVAL_NAMES.length] };
  return addCar(load, at || (mode.rivalSpawn && mode.rivalSpawn()) || MAP.spawnPoint(player, cars.filter((c) => !c.gone)), true);
}
function hint(html) { if (html) { $('hint').innerHTML = html; $('hint').classList.add('on'); } else $('hint').classList.remove('on'); }
// the round is over: a card with how it went, and the way to the next one. `more` ({ label, go }), if the mode gives
// it, is a button (and Enter or C) to carry on the same round instead: overGo hides the card and calls `go`
let overMore = null;
function over(title, lines = [], scrap = 0, more = null) {
  if (game.state === 'over') return;
  overMore = more; $('over').classList.toggle('more', !!more); $('over-go').className = more ? 'alt' : 'go';
  if (more) $('over-more').textContent = more.label || 'Keep going';
  game.state = 'over'; game.scrap += scrap; keepSave(save); hint(null);
  $('dead').hidden = true;
  $('over-t').textContent = title;
  $('over-l').innerHTML = ''; for (const l of [...lines, ...(scrap ? [`+${Math.round(scrap)} scrap`] : [])]) { const d = document.createElement('div'); d.textContent = l; $('over-l').appendChild(d); }
  setTimeout(() => { if (game.state === 'over') { $('over').hidden = false; if (document.exitPointerLock) document.exitPointerLock(); } }, 1600);
}
function overGo() {
  const m = overMore; if (!m || game.state !== 'over' || $('over').hidden) return;
  overMore = null; $('over').hidden = true; $('over').classList.remove('more'); $('over-go').className = 'go';
  game.state = 'play'; lockMouse(); m.go(); return true;
}
const api = {
  game, cars, extras, MAP, scene, mats, camera, sfx, save, cube, chip, blast, explode, sparks, dust, CRASH, ROUND, AI,
  get player() { return player; }, TOUCH: () => TOUCH,
  addCar, addRival, rivalBuild, RIVAL_NAMES, damage, wreck, banner, toast, hint, over, keepSave: () => keepSave(save), sound,
  makeDriver, clearLine, spawnPlayer: (at) => spawnPlayer(at),
};
const mode = MODES[MAP.mode](api);
// the map's pickups and hazards, if it lists any (pickups.js, hazards.js)
const pickups = makePickups(api, MAP.pickups), hazards = makeHazards(api, MAP.hazards);
function spawnPlayer(at) {
  if (!at) {
    at = { ...MAP.spawn };
    if (player) { const o = (mode.respawnAt && mode.respawnAt(player)) || MAP.spawnPoint(null, cars.filter((c) => !c.gone && c !== player)); at.x = o.x; at.z = o.z; at.yaw = o.yaw ?? Math.random() * 6.28; }
  }
  if (player && !player.dead) { player.dispose(); cars.splice(cars.indexOf(player), 1); }   // a fresh build in place of the old one
  player = addCar({ ...save.load, name: 'You' }, at, false);
  player.turretTurn = 10;
  cam.yaw = at.yaw; cam.cx = player.x; cam.cz = player.z;
  // the player's car always goes first in the list
  cars.splice(cars.indexOf(player), 1); cars.unshift(player);
}

// ---- the garage: the car stands in the street, the camera goes round it, the panel is beside it -------------------
const garage = makeGarage({
  root: $('garage'), save,
  onChange: (load) => { const at = { x: player.x, z: player.z, yaw: player.yaw }; player.dispose(); cars.splice(cars.indexOf(player), 1); player = null; player = addCar({ ...load, name: 'You' }, at, false); cars.splice(cars.indexOf(player), 1); cars.unshift(player); player.turretTurn = 10; },
  onDrive: leaveGarage,
  sound: (n, v = 1) => { initAudio(); sfx.play(n, v); },
  toast,
});
function openGarage(from) {
  if (game.state === 'garage') return;
  initAudio();
  game.garageFrom = from; game.stateWas = game.state; game.state = 'garage';
  $('menu').hidden = true; $('dead').hidden = true; $('hint').classList.remove('on');
  if (document.exitPointerLock && cam.locked) document.exitPointerLock();
  // in the garage the car is fixed up: a fresh one where it stands (or at a spawn point if it was wrecked)
  const at = player && !player.dead ? { x: player.x, z: player.z, yaw: player.yaw } : null;
  if (player && player.dead) { const o = (mode.respawnAt && mode.respawnAt(player)) || MAP.spawnPoint(null, cars.filter((c) => !c.gone && c !== player)); player = null; spawnPlayer({ x: o.x, z: o.z, yaw: Math.random() * 6.28 }); } else spawnPlayer(at);
  player.vx = player.vz = 0; cam.orbit = player.yaw + 0.8;
  garage.open();
}
function leaveGarage() {
  garage.close(); keepSave(save);
  const from = game.garageFrom; game.garageFrom = null;
  if (game.ended) { chooseMap(MAP.id); return; }   // the round is over: a fresh map for the next one
  spawnPlayer({ x: player.x, z: player.z, yaw: player.yaw });
  cam.yaw = player.yaw;
  if (from === 'menu') { game.state = 'menu'; startGame(); return; }
  game.state = 'play';
  if (from === 'break' && mode.afterGarage) mode.afterGarage();
  sfx.play('start', 0.9); lockMouse();
}
function startGame() {
  initAudio(); $('menu').hidden = true; game.state = 'play';
  // phones and tablets: the whole screen for the round, where the browser allows it (a tap on Start counts as asking)
  const root = document.documentElement;
  if (MOBILE && root.requestFullscreen && !document.fullscreenElement) { try { root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (err) { /* not allowed here */ } }
  sfx.play('start', 0.9); setTimeout(() => sfx.play('ui_go', 0.8), 350);
  lockMouse();
  mode.start();
}
function lockMouse() { if (canvas.requestPointerLock && !MOBILE) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { cam.noLock = true; }); } catch (err) { cam.noLock = true; } } }

// ---- controls ------------------------------------------------------------------------------------------------------
const keys = {};
const cam = { yaw: Math.PI, pitch: 0.3, dist: 36, locked: false, mx: 0, my: 0, cx: 0, cz: 0 };
const mouse = { b0: false, b2: false };
addEventListener('keydown', (e) => {
  keys[e.code] = true; initAudio();
  if (e.code === 'KeyM') { muted = !muted; sfx.on = !muted; }
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && game.state === 'play' && player) gadget(player);
  if (e.code === 'KeyG' && (game.state === 'menu' || (game.state === 'dead' && !game.noGarage) || (game.state === 'play' && mode.garageOK()))) openGarage(game.state === 'play' ? 'break' : game.state);
  else if ((e.code === 'KeyG' || e.code === 'Escape') && game.state === 'garage') leaveGarage();
  if (e.code === 'KeyR' && game.state === 'play' && mode.resetPlayer) mode.resetPlayer();   // back on the track (the race)
  if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyC') && overMore && overGo()) e.preventDefault();   // the end card's Keep going (not a click on a focused button too)
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.b0 = mouse.b2 = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  initAudio();
  if (game.state === 'garage') { cam.drag = true; return; }
  if (game.state === 'menu' || TOUCH) return;
  if (!cam.locked && canvas.requestPointerLock && !cam.noLock) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { cam.noLock = true; }); } catch (err) { cam.noLock = true; } }
  if (e.button === 0) mouse.b0 = true; if (e.button === 2) mouse.b2 = true;
});
addEventListener('mouseup', (e) => { cam.drag = false; if (e.button === 0) mouse.b0 = false; if (e.button === 2) mouse.b2 = false; });
document.addEventListener('pointerlockchange', () => { cam.locked = document.pointerLockElement === canvas; document.body.classList.toggle('locked', cam.locked); });
document.addEventListener('pointerlockerror', () => { cam.noLock = true; });
addEventListener('mousemove', (e) => {
  if (cam.drag && game.state === 'garage') { cam.orbit -= (e.clientX - cam.mx) * 0.01; }
  cam.mx = e.clientX; cam.my = e.clientY;
  // the aim slows a little over a rival, so it is easier to stay on one
  if (cam.locked) { const f = 1 - 0.35 * (cam.sticky || 0); cam.yaw -= e.movementX * 0.0026 * f; cam.pitch = clamp(cam.pitch + e.movementY * 0.0022 * f, 0.02, 0.75); }   // never down behind the car's back
});
addEventListener('wheel', (e) => { cam.dist = clamp(cam.dist + Math.sign(e.deltaY) * 3, 20, 60); }, { passive: true });
$('go').addEventListener('click', () => { if (game.ended) chooseMap(MAP.id); else startGame(); });
// the map picker on the start card: another map loads the page again on it
{
  const box = $('maps');
  for (const m of MAPS) {
    const b = document.createElement('button'); b.className = m.id === MAP.id ? 'on' : '';
    b.innerHTML = '<b></b><i></i>'; b.querySelector('b').textContent = m.name; b.querySelector('i').textContent = { waves: 'Waves', race: 'Race', survival: 'Zombie Survival', brawl: 'Arena · free-for-all' }[m.mode] || m.mode;
    b.addEventListener('click', () => { if (m.id !== MAP.id || game.ended) chooseMap(m.id); });
    box.appendChild(b);
  }
  $('map-blurb').textContent = MAP.blurb; $('go').textContent = mode.go; $('menu-note').textContent = mode.note;
  // a mode with difficulty levels (the race) gets a row of buttons for them, kept in the save
  if (mode.levels) {
    const row = $('levels'); row.hidden = false;
    const show = () => { for (const b of row.querySelectorAll('button')) b.className = b.dataset.id === mode.levels.get() ? 'on' : ''; $('menu-note').textContent = mode.note; };
    for (const [id, name] of mode.levels.list) {
      const b = document.createElement('button'); b.dataset.id = id; b.textContent = name;
      b.addEventListener('click', () => { mode.levels.set(id); show(); });
      row.appendChild(b);
    }
    show();
  }
}
$('over-go').addEventListener('click', () => chooseMap(MAP.id));
$('over-more').addEventListener('click', overGo);
$('over-maps').addEventListener('click', () => { $('over').hidden = true; game.ended = true; $('go').textContent = 'Play again'; $('menu').hidden = false; });
$('over-garage').addEventListener('click', () => { $('over').hidden = true; game.ended = true; $('go').textContent = 'Play again'; openGarage('over'); });
$('menu-garage').addEventListener('click', () => openGarage('menu'));
$('dead-garage').addEventListener('click', () => openGarage('dead'));
$('dead-go').addEventListener('click', () => { if (game.state === 'dead') game.deadT = 0; });
// touch: drag to turn the car in the garage
canvas.addEventListener('touchstart', (e) => { if (game.state === 'garage' && e.touches[0]) { cam.drag = true; cam.mx = e.touches[0].clientX; } }, { passive: true });
canvas.addEventListener('touchmove', (e) => { if (cam.drag && game.state === 'garage' && e.touches[0]) { cam.orbit -= (e.touches[0].clientX - cam.mx) * 0.01; cam.mx = e.touches[0].clientX; } }, { passive: true });
canvas.addEventListener('touchend', () => { cam.drag = false; }, { passive: true });

// On a touch screen: a stick on the left (push it the way to go), and buttons on the right to fire the guns, fire the
// heavy weapons, drift and use the gadget. The guns aim themselves (aimFor).
const touch = { id: null, ox: 0, oy: 0, sx: 0, sy: 0, fire: false, heavy: false, drift: false };
const stickEl = $('stick'), knobEl = $('knob');
function useTouch() {
  if (!TOUCH) { TOUCH = true; if (document.exitPointerLock && cam.locked) document.exitPointerLock(); }
  document.body.classList.add('touch'); $('touch').hidden = false;
}
if (TOUCH) useTouch();
addEventListener('touchstart', () => { if (!TOUCH) useTouch(); }, { passive: true, capture: true });
$('pad').addEventListener('touchstart', (e) => {
  if (touch.id !== null) return;
  const t = e.changedTouches[0]; touch.id = t.identifier; touch.ox = t.clientX; touch.oy = t.clientY; touch.sx = touch.sy = 0;
  stickEl.style.left = `${t.clientX}px`; stickEl.style.top = `${t.clientY}px`; stickEl.classList.add('on'); knobEl.style.transform = '';
  e.preventDefault(); initAudio();
}, { passive: false });
addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier !== touch.id) continue;
    let dx = t.clientX - touch.ox, dy = t.clientY - touch.oy; const d = Math.hypot(dx, dy), R = 56;
    if (d > R) { dx *= R / d; dy *= R / d; }
    touch.sx = dx / R; touch.sy = -dy / R;
    knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  }
}, { passive: true });
const endStick = (e) => { for (const t of e.changedTouches) if (t.identifier === touch.id) { touch.id = null; touch.sx = touch.sy = 0; stickEl.classList.remove('on'); knobEl.style.transform = ''; } };
addEventListener('touchend', endStick, { passive: true }); addEventListener('touchcancel', endStick, { passive: true });
for (const [id, key] of [['t-fire', 'fire'], ['t-heavy', 'heavy'], ['t-drift', 'drift']]) {
  const el = $(id);
  el.addEventListener('touchstart', (e) => { touch[key] = true; el.classList.add('down'); e.preventDefault(); initAudio(); }, { passive: false });
  const up = (e) => { touch[key] = false; el.classList.remove('down'); e.preventDefault(); };
  el.addEventListener('touchend', up, { passive: false }); el.addEventListener('touchcancel', up, { passive: false });
}
$('t-boost').addEventListener('touchstart', (e) => { e.preventDefault(); initAudio(); if (game.state === 'play' && player) gadget(player); }, { passive: false });

function drivePlayer(dt) {
  const c = player; if (!c || c.dead) return;
  const k = (a, b) => keys[a] || keys[b];
  c.throttle = (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0);
  c.steer = (k('KeyA', 'ArrowLeft') ? 1 : 0) - (k('KeyD', 'ArrowRight') ? 1 : 0);
  c.drift = !!keys.Space || touch.drift; c.brake = 0;   // the handbrake: a drift when steering, a brake when not (vehicle.js)
  // the stick: the car turns to the way it is pushed (up the screen is straight ahead) and goes; pulled back, it reverses
  const m = Math.hypot(touch.sx, touch.sy);
  if (touch.id !== null && m > 0.2) {
    const want = cam.yaw - Math.atan2(touch.sx, touch.sy), off = wrap(want - c.yaw);
    if (Math.abs(off) < 2.3) { c.throttle = clamp(m * 1.3, 0, 1); c.steer = clamp(off * 2.2, -1, 1); }
    else { c.throttle = -clamp(m * 1.3, 0, 1); c.steer = 0; }
  }
  // a brake, not reverse, while still rolling forwards fast
  if (c.throttle < 0 && c.fwd > 12) { c.brake = 1; c.throttle = -0.2; }
  guns(c, dt, [mouse.b0 || keys.KeyJ || touch.fire, mouse.b2 || keys.KeyF || keys.KeyK || touch.heavy]);
}

// ---- camera and aiming -----------------------------------------------------------------------------------------
const ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _o = new THREE.Vector3(), _dir = new THREE.Vector3(), _tgt = new THREE.Vector3();
function aimRay() {
  // through the middle of the screen when the mouse is captured, else through the pointer
  if (cam.locked || !cam.mx) _ndc.set(0, 0.2);   // the crosshair sits a little above the middle, clear of the car else _ndc.set(cam.mx / canvas.clientWidth * 2 - 1, -(cam.my / canvas.clientHeight * 2 - 1));
  ray.setFromCamera(_ndc, camera); _o.copy(ray.ray.origin); _dir.copy(ray.ray.direction);
  const p = new THREE.Vector3();
  for (let t = 4; t < 520; t += 1) {
    p.copy(_o).addScaledVector(_dir, t);
    if (p.y <= 0.2) { p.y = 0.2; break; }
    if (Math.hypot(p.x - player.x, p.z - player.z) < 10) continue;   // never your own car
    if (solid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) break;
    let hitCar = false; for (const c of cars) if (c !== player && !c.gone && c.inside(p.x, p.y, p.z, 0.6)) { hitCar = true; break; }
    if (hitCar) break;
  }
  return p;
}
// Aim help. With a mouse, a rival near the crosshair pulls the aim onto itself (and on where it will be when the rounds
// get there), more the nearer the crosshair is. With touch, the guns pick the nearest rival they can see, mostly the
// one ahead, and hold on to it for a moment.
const AIM = { pull: 0.85, margin: 0.06, range: 330 };
const _tc = new THREE.Vector3(), _ts = new THREE.Vector3();
let autoT = null, autoKeep = 0, aimLock = null;
function leadOn(o, from, out) { const t = Math.hypot(o.x - from.x, o.z - from.z) / 360; o.centre(out); out.x += o.vx * t; out.z += o.vz * t; out.y = 2.4; return out; }
function autoTarget(c, dt) {
  autoKeep -= dt;
  const ok = (o) => o && !o.dead && !o.gone && Math.hypot(o.x - c.x, o.z - c.z) < 240 && clearLine(c.x, c.z, o.x, o.z, 4);
  if (autoT && autoKeep > 0 && ok(autoT)) return autoT;
  let best = null, bs = 1e9;
  for (const o of mode.targets ? mode.targets() : cars) {   // (a mode can give other things to aim at: survival's zombies)
    if (o === c || !ok(o)) continue;
    const d = Math.hypot(o.x - c.x, o.z - c.z), off = Math.abs(wrap(Math.atan2(o.x - c.x, o.z - c.z) - cam.yaw));
    const score = d * (1 + off * 0.9) * (o === autoT ? 0.7 : 1);
    if (score < bs) { bs = score; best = o; }
  }
  autoT = best; autoKeep = 0.6;
  return best;
}
function aimFor(c, dt) {
  const p = aimRay();
  let best = null, k = 0;
  if (TOUCH) { best = autoTarget(c, dt); k = best ? 1 : 0; }
  else {
    const tan = Math.tan(camera.fov * Math.PI / 360);
    for (const o of mode.targets ? mode.targets() : cars) {
      if (o === c || o.dead || o.gone) continue;
      leadOn(o, c, _tc); const dist = camera.position.distanceTo(_tc); if (dist > AIM.range) continue;
      _ts.copy(_tc).project(camera); if (_ts.z > 1) continue;
      const r = Math.hypot((_ts.x - _ndc.x) * camera.aspect, _ts.y - _ndc.y);
      const size = (o.half + 1.5) / (dist * tan), R = size + AIM.margin;   // the car's half-length on screen, and a margin round it
      if (r > R) continue;
      const kk = clamp(1 - (r - size * 0.4) / (R - size * 0.4), 0, 1);
      if (kk > k && clearLine(c.x, c.z, o.x, o.z, 4)) { k = kk; best = o; }
    }
  }
  if (best) { leadOn(best, c, _tc); c.aim.copy(p).lerp(_tc, TOUCH ? 1 : AIM.pull * Math.min(1, k * 1.3)); }
  else c.aim.copy(p);
  cam.sticky = TOUCH ? 0 : k; aimLock = k > 0.25 ? best : null;
}
// in the garage: round and round the car, which sits clear of the panel
function garageCamera(dt) {
  const c = player; if (!cam.drag) cam.orbit += dt * 0.18;
  const wide = innerWidth > 760, short = wide && innerHeight < 520, cx = c.x + Math.sin(c.yaw) * c.mid, cz = c.z + Math.cos(c.yaw) * c.mid;
  let d = short ? 22 : wide ? 17 : 27;
  const ox = Math.sin(cam.orbit), oz = Math.cos(cam.orbit);
  for (let t = 5; t < d; t += 1) {   // pull in before a wall (lamp posts and trees don't count)
    const ix = Math.floor(cx + ox * t), iz = Math.floor(cz + oz * t);
    if (!solid(ix, 6, iz)) continue;
    const b = bodies[ownerAt(idx(ix, 6, iz))]; if (b && (b.kind === 'prop' || b.kind === 'rubble')) continue;
    d = Math.max(9, t - 1.5); break;
  }
  camera.position.set(cx + ox * d, wide ? 6.5 : 9, cz + oz * d);
  const rx = oz, rz = -ox, k = short ? d * 0.36 : wide ? d * 0.24 : 0;   // the camera's right: look past the car so it sits to the left
  camera.lookAt(cx + rx * k, wide ? 2 : -3.5, cz + rz * k);
  camera.updateMatrixWorld();
  c.aim.set(c.x + Math.sin(c.yaw + 0.5) * 60, 6, c.z + Math.cos(c.yaw + 0.5) * 60);
}
function stepCamera(dt) {
  const c = player; if (!c) return;
  if (game.state === 'garage') { garageCamera(dt); return; }
  if (!cam.locked) {   // follow the car round its turns
    // in a drift it swings round a little towards where the car is going, and keeps up with the car's quicker turn
    const want = c.yaw + c.slipA * c.slide * DRIFT.camSwing;
    cam.yaw += wrap(want - cam.yaw) * Math.min(1, dt * (2.6 + DRIFT.camFollow * c.slide));
    cam.pitch += ((tall ? 0.4 : 0.3) - cam.pitch) * Math.min(1, dt * 2);   // up behind the car, so the road ahead shows over its roof
  }
  cam.cx += (c.x - cam.cx) * Math.min(1, dt * 12); cam.cz += (c.z - cam.cz) * Math.min(1, dt * 12);
  const dist = cam.dist * (tall ? 1.2 : 1) * (1 + clamp(Math.abs(c.fwd) / 300, 0, 0.25));
  _tgt.set(cam.cx, 7.5, cam.cz);
  // how far back the camera can sit before a wall; lamps, props and rubble don't count (it looks past them)
  const room = (pitch) => {
    const bx = -Math.sin(cam.yaw) * Math.cos(pitch), by = Math.sin(pitch) + 0.15, bz = -Math.cos(cam.yaw) * Math.cos(pitch);
    for (let t = 4; t < dist; t += 1.5) {
      const i = idx(Math.floor(_tgt.x + bx * t), Math.floor(_tgt.y + by * t), Math.floor(_tgt.z + bz * t));
      if (!solid(Math.floor(_tgt.x + bx * t), Math.floor(_tgt.y + by * t), Math.floor(_tgt.z + bz * t))) continue;
      const b = bodies[ownerAt(i)]; if (b && (b.kind === 'prop' || b.kind === 'rubble')) continue;
      return Math.max(7, t - 2);
    }
    return dist;
  };
  // a wall behind: rise and look down over it rather than close in on the car, which would hide the road ahead
  let pitch = cam.pitch, dd = room(pitch);
  if (dd < dist) for (const up of [0.2, 0.45, 0.7, 0.95]) { const p2 = Math.min(1.25, cam.pitch + up), d2 = room(p2); if (d2 > dd + 2) { pitch = p2; dd = d2; } if (d2 >= dist * 0.85) break; }
  cam.p = cam.p === undefined ? pitch : cam.p + (pitch - cam.p) * Math.min(1, dt * 5);
  const bx = -Math.sin(cam.yaw) * Math.cos(cam.p), by_ = Math.sin(cam.p) + 0.15, bz = -Math.cos(cam.yaw) * Math.cos(cam.p);
  cam.d = cam.d === undefined ? dd : cam.d + (dd - cam.d) * Math.min(1, dt * (dd < cam.d ? 14 : 3));
  camera.position.set(_tgt.x + bx * cam.d, Math.max(2.5, _tgt.y + by_ * cam.d), _tgt.z + bz * cam.d);
  const sh = game.shake; if (sh > 0) camera.position.add(_o.set((Math.random() - 0.5) * sh * 1.6, (Math.random() - 0.5) * sh * 1.2, (Math.random() - 0.5) * sh * 1.6));
  camera.lookAt(_tgt.x + Math.sin(cam.yaw) * 16, _tgt.y - 0.5, _tgt.z + Math.cos(cam.yaw) * 16);
  camera.updateMatrixWorld();
  if (!c.dead) aimFor(c, dt);
  const ch = $('cross');
  if (TOUCH && aimLock) { _ts.copy(c.aim).project(camera); ch.style.left = `${(_ts.x * 0.5 + 0.5) * canvas.clientWidth}px`; ch.style.top = `${(-_ts.y * 0.5 + 0.5) * canvas.clientHeight}px`; }
  else if (cam.locked || !cam.mx || TOUCH) { ch.style.left = '50%'; ch.style.top = `${(0.5 - 0.1) * 100}%`; } else { ch.style.left = cam.mx + 'px'; ch.style.top = cam.my + 'px'; }
  ch.classList.toggle('on', c.onTarget(0.08)); ch.classList.toggle('lock', !!aimLock);
}

// ---- the frame -----------------------------------------------------------------------------------------------------
let tall = false;   // a phone held upright: a wider view, from further back and higher up, so the road ahead still shows
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  tall = w / h < 0.9; camera.fov = tall ? 76 : 64;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const ph = h * renderer.getPixelRatio(); setParticleScale(ph, camera.fov); fx.setScale(ph, camera.fov);
}
addEventListener('resize', resize); resize();
const quality = makeQuality({ renderer, composer, bloom: composer.passes[1], scene, camera, sun, resize, playing: () => game.state === 'play', mobile: MOBILE });
// the night show's beams, glows and lamps (night.js), on a map that runs at night (the city round it is out of the
// floodlights' reach)
const night = MAP.night ? makeNight({ scene, renderer, camera, sky, mats, bloom: composer.passes[1], quality, night: MAP.night, backdrop }) : null;
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (window.__hold) return;   // tests step the game by hand (window.__derby.step)
  step(dt);
  quality.judge(now); placeSky(); quality.draw();
}
function step(dt) {
  game.time += dt; newFrame();
  const live = game.state === 'play' || game.state === 'dead' || game.state === 'over';
  if (MAP.step) MAP.step(dt);
  if (live) {
    drivePlayer(dt);
    for (const c of cars) if (c.driver) { c.driver.think(dt, cars, player); guns(c, dt, c.dead ? [] : c.fire || []); }
    for (const c of cars) if (!c.gone) { c.hurtT -= dt; if (c.dead) c.deadT += dt; stepGadget(c, dt); c.step(dt, crashHooks); parked(c, dt); saws(c, dt); blades(c, dt); }
    stepMines(dt); stepBolts(dt); drifts.step(dt, cars, player);
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) if (!cars[i].gone && !cars[j].gone) bump(cars[i], cars[j]);
    // wrecks lie a while, then crumble away
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      if (c.dead && !c.gone && c.deadT > ROUND.wreckStays) { c.unit.burst(cube, null, 6, 0.2); c.gone = true; }
      if (c.gone && c !== player) { c.dispose(); if (c.tag) c.tag.remove(); cars.splice(i, 1); }
    }
    if (game.state === 'dead') {
      game.deadT -= dt; $('dead-t').textContent = Math.max(0, Math.ceil(game.deadT));
      if (game.deadT <= 0) { $('dead').hidden = true; game.state = 'play'; spawnPlayer(); }
    }
    mode.step(dt);
    if ((savedT += dt) > 15) { savedT = 0; keepSave(save); }
  }
  pickups.step(dt, live); hazards.step(dt, live);
  for (const c of cars) if (!c.gone) { if (!c.dead) c.point(dt); c.pose(dt); }
  stepCamera(dt);
  if (backdrop) backdrop.step(dt, quality.step);
  const fc = player || MAP.spawn;
  setFocus(fc.x, fc.z); followSun(fc.x, fc.z);
  stepSim(dt);
  civ.update(dt, false); civ.packFar && civ.packFar();
  fx.update(dt); debris.update(dt);
  dirt.step(dt, cars, quality.step);
  if (streaks) streaks.step(dt, game.state === 'play' ? player : null, quality.step, renderer.domElement);
  if (night) night.step(dt, cars);
  game.shake = Math.max(0, game.shake - dt * 2.4);
  game.hurt = Math.max(0, (game.hurt || 0) - dt * 1.4); grade.uniforms.hurt.value = game.hurt;
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').classList.remove('on');
  if (game.banner > 0 && (game.banner -= dt) <= 0) $('banner').classList.remove('on');
  // the engines and the tyres
  if (engine && player) {
    const sp = Math.abs(player.fwd), on = !muted && (live || game.state === 'garage') && !player.dead, k = clamp(sp / player.spec.top, 0, 1.4);
    sfx.listen(player.x, player.z, cam.yaw);
    engine.me.set(on ? 0.5 + 0.35 * Math.abs(player.throttle) : 0, 0.72 + k * 1.05 + (player.boostT > 0 ? 0.22 : 0), player.x, player.z);
    engine.skid.set(on && player.speed > 14 ? clamp(player.skid, 0, 0.9) : 0, 0.85 + clamp(player.speed / 160, 0, 0.3) + 0.12 * player.skid, player.x, player.z);
    const near = live ? cars.filter((c) => c.rival && !c.dead).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z)) : [];
    // the minigun's barrels, the saws' motor and the arc coil's hum, on the player's car
    const bv = player.barrelV || 0, arcG = player.guns.find((G) => G.g.arc);
    engine.spin.set(on && bv > 1 ? clamp(bv / 30, 0, 1) * 0.8 : 0, 0.45 + bv / 30 * 0.8, player.x, player.z);
    engine.saw.set(on && player.spec.saw ? 0.35 + clamp(player.speed / 80, 0, 0.3) : 0, 1, player.x, player.z);
    engine.hum.set(on && arcG ? (arcG.t <= 0 ? 0.35 : 0.12) : 0, arcG && arcG.t <= 0 ? 1 : 0.8, player.x, player.z);
    engine.rivals.forEach((L, i) => { const c = near[i]; if (!c) L.set(0); else L.set(0.45 + 0.3 * Math.abs(c.throttle), 0.68 + clamp(Math.abs(c.fwd) / c.spec.top, 0, 1.3) * 0.95, c.x, c.z); });
  }
  document.body.classList.toggle('in-garage', game.state === 'garage');
  if (TOUCH) $('touch').hidden = game.state !== 'play';
  drawHud(); drawTags(); drawRadar();
}
$('hint').addEventListener('click', () => { if (game.state === 'play' && mode.garageOK()) openGarage('break'); else if (game.state === 'play' && mode.resetPlayer) mode.resetPlayer(); });
spawnPlayer();
followSun(player.x, player.z);
const loadEl = $('loading'); if (loadEl) loadEl.hidden = true;
$('menu').hidden = false;
requestAnimationFrame((t) => { last = t; frame(t); });
window.__derby = { renderer, night, touch, aim: () => ({ lock: aimLock, sticky: cam.sticky, TOUCH }), useTouch, step, render: () => { placeSky(); quality.draw(); }, quality, cars, game, player: () => player, fx, civ, blast, explode, world, stats, camera, keys, mouse, cam, MAP, mode, chooseMap, api, extras, damage, save, garage, openGarage, leaveGarage, startGame, sfx, mines, gadget, spawnPlayer, addCar, pickups, hazards, backdrop };
