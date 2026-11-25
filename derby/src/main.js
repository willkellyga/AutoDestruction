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
import { MAP, MAPS, SHARED, STAGES, TAGS, PREVIEW, mapById, chooseMap } from './maps/index.js';
import STAGE_PICS from './stages.json';   // the stage select's pictures (tools/stage-shots.mjs)
import { MODES } from './modes/index.js';
import { CRASH, ROUND, AI, DRIFT, BUILDINGS, CAM, RACE, SURVIVAL_LEVELS, BRAWL_LEVELS } from './tuning.js';
import { build as buildKeepOut } from './keepout.js';
import { toughen, boom, chipAt, fuelBlast } from './sturdy.js';
import { PARTS, PAINTS, STARTER, loadSave, keepSave, rivalBuild, RIVAL_NAMES, statsOf } from './parts.js';
import { makeGarage, rating, classOf, GADGET, gadgetIcon } from './garage.js';
import { makeGarageRoom } from './garageroom.js';
import { makePartArt } from './partart.js';
import { makeSpecials } from './specials.js';
import { makeCrumple } from './crumple.js';
import { makeSounds, fetchClips } from './audio.js';
import { makeRoadSound } from './roadsound.js';
import { makeEngineSound } from './enginesound.js';
import { bank as sfxBank, count as sfxCount } from './sfxfiles.js';
import { makePickups } from './pickups.js';
import { makeHazards } from './hazards.js';
import { makeQuality } from './quality.js';
import { startReports } from './report.js';
import { makeDrift } from './drift.js';
import { makeBackdrop } from './backdrop.js';
import { lookSetup, makeLook } from './looks/index.js';
import { makeGround } from './ground.js';
import { makeDirt } from './dirt.js';
import { makeStreaks } from './streaks.js';
import { makeNet, makeLobby, serverUrl, quickPlay } from './net.js';
import { makeLearn } from './learn.js';

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
// A map with a look of its own (looks/: the arena by night, the race at sundown, the base in a storm) sets its own sky,
// fog and light; the sun can be its floodlight bank, a low evening sun or the moon, and the shadows go its way
const LOOK = MAP.look ? lookSetup(MAP.look, { scene, renderer, sky, hemi, sun }) : null;
const SUN_DIR0 = (LOOK && LOOK.sunDir) || new THREE.Vector3(0.55, 0.95, 0.35).normalize();
// (the garage has a light of its own from overhead: sunFrom swaps the way to the sun, and back)
const SUN_DIR = new THREE.Vector3(), SUN_R = new THREE.Vector3(), SUN_U = new THREE.Vector3();
function sunFrom(d) { SUN_DIR.copy(d).normalize(); SUN_R.crossVectors(new THREE.Vector3(0, 1, 0), SUN_DIR).normalize(); SUN_U.crossVectors(SUN_DIR, SUN_R); }
sunFrom(SUN_DIR0);
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
const backdrop = MAP.backdrop ? makeBackdrop({ scene, map: MAP, mobile: MOBILE, viewH: () => renderer.domElement.height, follow: () => player }) : null;
initSim(scene);
const drifts = makeDrift({ scene, camera, mobile: MOBILE, el: $('drift'), soft: floor.dirtAt });   // skid marks, tyre smoke, the drift meter
const dirt = makeDirt({ scene, camera, renderer, floor, MAP, mobile: MOBILE });   // ruts, rooster tails, dust and clods off the wheels
const streaks = MAP.mode === 'race' ? makeStreaks({ scene, mobile: MOBILE }) : null;   // the air rushing past, flat out
look.detail.value = 1; look.dusk.value = 0;
cfg.dust = 0.55; cfg.hang = 0.2;
toughen();   // sturdier buildings than the town's own (sturdy.js, tuning.js BUILDINGS)
const keep = buildKeepOut();   // cars can't get into buildings (keepout.js)

// the garage's own workshop and yard, out past the edge of the map (garageroom.js)
const room = makeGarageRoom({ scene, WX, mobile: MOBILE });

// ---- the light pass: bloom, grade, vignette ---------------------------------------------------------------------
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: MOBILE ? 0 : 4 }));
composer.addPass(new RenderPass(scene, camera));
// A pixel that came out as not-a-number (or infinite) from any shader would be spread by the bloom's blur into big black
// blocks over the whole picture on real graphics cards (the software renderer the tests use rarely makes one). Clear
// any such pixel to black, and any below zero to zero, before the bloom sees it. Checked by the bits, which a shader
// compiler's fast maths can't assume away.
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; bool bad(float x){ return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; } void main(){ vec4 c=texture2D(tDiffuse,vUv); if (bad(c.r) || bad(c.g) || bad(c.b)) c.rgb = vec3(0.0); if (bad(c.a)) c.a = 1.0; gl_FragColor=vec4(max(c.rgb, vec3(0.0)), c.a); }',
}));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(4, 4), 0.24, 0.55, 1.3));
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.05 }, con: { value: 1.07 }, vig: { value: 0.32 }, hurt: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float sat; uniform float con; uniform float vig; uniform float hurt; varying vec2 vUv; void main(){ vec4 c=texture2D(tDiffuse,vUv); float l=dot(c.rgb,vec3(0.2126,0.7152,0.0722)); c.rgb=mix(vec3(l),c.rgb,sat); c.rgb=max(vec3(0.0),(c.rgb-0.18)*con+0.18)*vec3(1.03,1.0,0.96); vec2 d=vUv-0.5; float e=smoothstep(0.18,0.9,dot(d,d)*2.2); c.rgb*=1.0-vig*e; c.rgb=mix(c.rgb,vec3(0.9,0.08,0.04),hurt*e*0.8); gl_FragColor=c; }',
}));
const bloomPass = composer.passes[2], grade = composer.passes[3];
composer.addPass(new OutputPass());

// ---- sound: Monster Mayhem's mixer and recorded clips ------------------------------------------------------------
const audioMix = makeMixer({ camera }); sfxBank(SFX_BANK).then((b) => audioMix.load(b, SFX_NORM));   // (the served build fetches them: sfxfiles.js)
for (const [k, v] of Object.entries(DEFAULT_TRIMS)) audioMix.setTrim(k, v);
let muted = false, engine = null;
const sfx = makeSounds(() => audioMix.ctx);
function initAudio() {
  audioMix.init();
  if (engine || !sfx.init()) return;
  // the player's engine and tyres, and the two nearest rivals' engines, on loops
  engine = { note: makeEngineSound({ sfx }), spin: sfx.loop('mini_spin'), saw: sfx.loop('saw_loop'), hum: sfx.loop('arc_hum'), flame: sfx.loop('flame_loop'), jet: sfx.loop('mini_spin') };
}
function sound(name, vol = 1, x, y, z) {
  audioMix.on = !muted;
  const grp = x !== undefined && player && Math.hypot(x - player.x, z - player.z) > 140 ? 'city' : 'me';
  if (grp === 'city' && (name === 'crumble' || name === 'glass' || name === 'creak')) return;
  audioMix.play(name, vol, x, y, z, grp, 0.4);
}
const armySfx = audioMix.module('a.', 'army');
const road = makeRoadSound({ sfx, sound, map: MAP });   // tyres, scrapes, knocks, wind, pass-bys (roadsound.js)

// ---- effects: the army's guns and the town's cars -------------------------------------------------------------
const mats = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1, color: new THREE.Color(1.2, 1.2, 1.2) }), new THREE.MeshBasicMaterial({ vertexColors: true })];
room.parkOnLift(mats);   // (a car up on the lift in the workshop)
const game = { state: 'menu', time: 0, wave: 0, kills: 0, deaths: 0, shake: 0, slow: 1, banner: 0, nextWave: 0, killTimes: [] };
// scrap, the parts bought and the build are kept in this browser (parts.js)
const save = loadSave();
Object.defineProperty(game, 'scrap', { get: () => save.scrap, set: (v) => { save.scrap = v; } });
let savedT = 0;
const fakeMon = { x: -9999, y: 0, z: -9999, S: 1, hp: 1e9, maxHp: 1e9, chargeT: 0, hurtT: 0, yaw: 0 };
const civ = makeCivilians({ scene, camera, mon: fakeMon, game: { get state() { return 'idle'; }, time: 0 }, U: 2.5, R: () => 6, hurt() {}, toast() {}, addXp() {}, PROPS, muted: () => muted, mixer: audioMix, tanks: () => [], rivals: () => [], viewH: () => renderer.domElement.height, cubePx: () => 0 });
const debris = civ.debris;
const cube = (x, y, z, vx, vy, vz, c, s) => debris.spawn(x, y, z, vx, vy, vz, c, s);
// cars dent, their panels work loose and tear off, and they smoke as they are hurt (crumple.js)
const crumple = makeCrumple({ scene }); crumple.setChip(cube);
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
  solid: (x, y, z) => { for (const c of cars) if ((!mode.friendly || c.dummy) && !c.gone && c.inside(x, y, z)) return true; for (const e of extras) if (e.solid(x, y, z)) return true; return false; },   // (a friendly mode's shots go through cars, but not the garage's target cars)
  colorAt: (p) => { for (const c of cars) if (c.inside(p.x, p.y, p.z, 1)) return PAINTS[c.load.paint] ?? 0x777b82; return 0x777b82; },
  scorch() {}, update() {}, scorched: 0,
};
const fx = makeFx(scene, { target, debris, audio: armySfx, shake: (a, p) => hooks.shake(a, p.x, p.y, p.z), world: { solid: (x, y, z) => solid(Math.floor(x), Math.floor(y), Math.floor(z)) !== 0 }, onLand, trail: 0.5 });
// the flamethrower, seekers, mortar, shield, oil slick and jump jets (specials.js)
const specials = makeSpecials({
  scene, fx, sfx, cars, extras, player: () => player, damage, cube, chip, friendly: () => !!mode.friendly, mobile: MOBILE,
  // a mortar shell landing: the town's blast, credited to the car that fired it
  blast(who, g, x, y, z, wall) {
    const was = by; by = who; splashK = g;
    try { sfx.play('rocket_boom', 1, x, z, { gap: 0.05, rate: 0.8 }); boom(x, y, z, g.wall * (wall ? 1 : 0.7), 0.5, { maxDebris: 220, fire: Math.random() < 0.4 }, BUILDINGS.shell); } finally { by = was; splashK = null; }
  },
});

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
function addCar(load, at, rival, opt) {
  const c = new Vehicle(scene, mats, load, at);
  crumple.attach(c);
  if (opt && opt.remote) c.remote = true;   // someone else's car, moved by what their device sends (net.js)
  if (rival) { if (!c.remote) c.driver = makeDriver(c); c.rival = true; c.maxHp = c.hp = Math.round(c.spec.hp * AI.hp); }
  cars.push(c); makeTag(c);
  return c;
}
// fwd: damage only this device works out (the dead's claws on the host, a stomp from the jump jets), so a car whose
// owner is on another device is told it (net.js)
function damage(c, d, who, fwd) {
  if (!c || c.dead || d <= 0 || game.state === 'menu') return;
  if (c.shield > 0) return;   // just back in (the arena's free-for-all): nothing hurts it for a moment
  if (c.shieldT > 0) { specials.shieldHit(c); return; }   // the shield gadget
  if (mode.friendly && who && who !== c && !c.dummy) return;   // a mode with no fighting between cars (survival): only the dead and the map hurt
  if (c === player && game.state === 'garage') return;   // nothing hurts the car on the turntable (a mine tried out behind it, say)
  if (c.dummy) c.popAcc = (c.popAcc || 0) + d;   // the target cars show what each hit does (stepDummies)
  if (c === player && who === player) d *= 0.35;   // your own splash hurts, but less
  if (window.__dlog) window.__dlog.push([c.name, who ? who.name : (splashK ? 'boom' : 'wall'), Math.round(d * 10) / 10]);
  // someone else's car: what hit it here only shows; it is hurt on its owner's own device, by what hit it there
  if (c.remote) { c.hurtT = 0.25; if (fwd && net) net.hurt(c, d, who); return; }
  c.hp -= d; c.hurtT = 0.25; if (who && who !== c) c.lastBy = who;
  if (c === player && game.state !== 'garage') game.hurt = Math.min(1, (game.hurt || 0) + d / 40);
  if (c.hp <= 0) wreck(c, who);
}
function wreck(c, who) {
  if (c.dead) return;
  if (net && !c.remote) net.wrecked(c, who);   // every other device wrecks its copy, put down to the same car
  c.dead = true; c.deadT = 0; c.hp = 0;
  const p = c.centre(new THREE.Vector3());
  crumple.wrecked(c, chip);   // the roof caves in, the bonnet and a panel or two blow off
  c.unit.kill(p, 6, chip);
  c.blowParts(cube, p, 16);
  sfx.play(c.maxHp > 200 ? 'bigboom' : 'carboom', 1, p.x, p.z); road.wrecked(p.x, p.z);
  const was = by; by = who || (mode.friendly ? c : null); splashK = { splash: 18, reach: 18 };   // (friendly: the wreck's own blast spares the other cars)
  try { boom(p.x, 2.5, p.z, 5.5, 0.6, { maxDebris: 260, fire: true }, BUILDINGS.wreck); } finally { by = was; splashK = null; }
  if (c.dummy) { c.respawnT = 2.6; if (who === player) toast('Target wrecked', 'Another one is on its way'); return; }   // no scrap for these
  if (c === player && game.state === 'test') { game.testEnd = Math.min(game.testEnd ?? 9, 1.8); toast('Wrecked!', 'Back to the garage'); return; }
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
const SHOT = { mg: 'mg_shot', chain: 'mini_shot', rifle: 'scatter_shot', cannon: 'cannon_shot', rocket: 'rocket_launch', missile: 'rocket_launch' };
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
    if (g.flame) { specials.flame(c, G, _m, coneAim(c, G, _ap), i); continue; }   // (its roar is a loop: see the sounds)
    if (g.mortar) { specials.lob(c, G, _m, coneAim(c, G, _ap)); return; }
    // a round whose way out crosses its own car's box (a gun aimed down over the bonnet, a door gun aimed in across the
    // nose) starts just past the box
    const aim = coneAim(c, G, _ap);
    _r.subVectors(aim, _m).normalize(); let past = -1;
    for (let t = 0; t < c.half * 2 + 3; t += 0.5) if (c.inside(_m.x + _r.x * t, _m.y + _r.y * t, _m.z + _r.z * t, 0.2)) past = t;
    const rocket = g.fx === 'rocket' || g.fx === 'missile';
    if (past >= 0) _m.addScaledVector(rocket ? _d : _r, past + 0.5);
    const dist = aim.distanceTo(_m), n = g.pellets || 1;
    if (rocket) _d.y += 0.12;
    for (let k = 0; k < n; k++) {
      const sp = (g.spread || 0) * Math.max(dist, n > 1 ? 20 : 0) / 100;   // the pellets spread wider the further they go
      _a.copy(aim).add(_r.set((Math.random() - 0.5) * sp, (Math.random() - 0.5) * sp * (n > 1 ? 0.5 : 1), (Math.random() - 0.5) * sp));
      const s = fx.fire(n > 1 && k > 0 ? 'pellet' : g.fx, _m, _d, _a, c.unit);
      s.owner = c; s.gun = g;
      if (g.seek) specials.seek(s, c, aim);
    }
    if (c.rival && player && !player.dead && !rocket && g.fx !== 'cannon') nearMiss(_m, _a);
  }
  // the bang: the light guns on the roof and doors have their own
  const me = c === player, light = G.slot === 'roof' || G.slot === 'door';
  const name = light && g.fx === 'mg' ? 'twin_shot' : SHOT[g.fx];
  if (name) sfx.play(name, me ? 1 : 0.85, c.x, c.z, { gap: g.rate ? 0.03 : 0, jitter: 0.05 });
  if (me && g.rate && !light && Math.random() < 0.18) sfx.play('brass', 0.5, c.x, c.z, { gap: 0.2 });
  if (g.pellets) c.pumpT = 0.3;
  if (g.spin) c.firing = 0.3;
  if (g.fx === 'cannon' || g.fx === 'rocket' || g.fx === 'missile' || g.pellets) { const kick = g.fx === 'cannon' ? 5 : light ? 1.5 : 3; c.vx -= Math.sin(c.gunYaw) * kick; c.vz -= Math.cos(c.gunYaw) * kick; }
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
  for (const o of cars) { if (o === c || o.dead || o.gone || (mode.friendly && !o.dummy)) continue; const d = Math.hypot(o.x - c.x, o.z - c.z) - o.wide; if (d < bd) { bd = d; best = o; } }
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
function guns(c, dt, want, only) {
  if (!c.remote) c.lastWant = want;   // (what the triggers are doing goes to the other devices: net.js)
  c.arcT = Math.max(0, (c.arcT || 0) - dt);
  if (c.pumpT > 0 && (c.pumpT -= dt) <= 0) sfx.play('pump', c === player ? 0.9 : 0.6, c.x, c.z);
  for (const G of c.guns) {
    if (only && G.slot !== only) continue;   // (the garage's firing range tries one weapon at a time)
    const g = G.g, pull = !!want[G.group];
    G.t = Math.max(0, G.t - dt);
    // the rivals don't waste the roof and door weapons on cars that aren't in front of them
    let ok = !G.cone || !c.rival || c.inCone(G, c.aim.x, c.aim.z, 0.25);
    if (ok && g.flame && c.rival && G.slot !== 'primary' && Math.hypot(c.aim.x - c.x, c.aim.z - c.z) > g.range * 1.3) ok = false;   // (nor flame at cars out of reach)
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
      const c = cars.find((o) => (!mode.friendly || o.dummy) && !o.gone && o.inside(p.x, p.y, p.z, 1.2));
      if (c && c !== s.owner) {
        let d = g.dmg * (s.owner && s.owner.rival ? AI.dmg : 1);
        if (g.pellets) d *= clamp(1.3 - s.from.distanceTo(p) / g.range, 0.15, 1);   // the scattergun is brutal close and weak far
        damage(c, d, s.owner);
        const q = c.surface(_q.copy(p).addScaledVector(s.dir, -0.8), s.dir, 7) || p;   // carve where the cubes are
        c.unit.hit(q, g.carve, chip, 8, s.dir);
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
  if (Math.abs(a.h - b.h) > Math.min(a.top, b.top) * 0.6) return;   // one jumping over the other
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
  const vt = Math.abs((b.vx - a.vx) * -_n.z + (b.vz - a.vz) * _n.x);   // how fast they go past each other along the touch
  if (vt > 6) { a.touch(vt); b.touch(vt); }   // door to door: the grind (roadsound.js)
  if (vrel >= 0) return;
  const j = -(1 + 0.35 * CRASH.kick) * vrel / (ia + ib);
  a.vx -= j * ia * _n.x; a.vz -= j * ia * _n.z; b.vx += j * ib * _n.x; b.vz += j * ib * _n.z;
  const hitSp = -vrel; if (hitSp < 10) { road.meet(a, b, hitSp, (ax + bx) / 2, (az + bz) / 2); return; }   // a knock
  // the one driving into the other is the rammer; its plow takes less
  const ta = a.vx * _n.x + a.vz * _n.z, tb = -(b.vx * _n.x + b.vz * _n.z), ram = ta >= tb ? a : b, hit = ram === a ? b : a;
  const cp = new THREE.Vector3((ax + bx) / 2, 2.6, (az + bz) / 2), dmg = hitSp * CRASH.carHurt * ram.spec.ram;
  const was = by; by = ram;
  try { damage(hit, dmg * (ram.rival && hit === player ? AI.ram : 1), ram); damage(ram, dmg * CRASH.ramShare * (ram.spec.guard ?? 1), hit); } finally { by = was; }
  hit.unit.hit(cp, clamp(0.8 + hitSp * 0.03, 0.8, 3.2), chip, 6);
  ram.unit.hit(cp, clamp(0.5 + hitSp * 0.015, 0.5, 1.8) * (ram.spec.guard ?? 1), chip, 4);   // the rammer's own front crumples, less
  sparks(cp.x, cp.y, cp.z, Math.round(6 + hitSp * 0.3), 1, 0.8, 0.4, 24);
  sound(hitSp > 40 ? 'crash' : 'metal', clamp(hitSp / 60, 0.35, 1.2), cp.x, cp.y, cp.z);
  sfx.play(hitSp > 38 ? 'crunch_heavy' : 'crunch', clamp(hitSp / 45, 0.35, 1.2), cp.x, cp.z, { gap: 0.1 });
  road.meet(a, b, hitSp, cp.x, cp.z);
  if (a === player || b === player) game.shake = Math.min(1.4, game.shake + hitSp / 80);
}
// what driving into the town feels like
const crashHooks = {
  smash(c, into, H, n) {
    if (c === player) { game.shake = Math.min(1.2, game.shake + clamp(n / 160, 0.1, 0.7)); noteHit(H.x, H.z); }
    if (into > 40 && Math.random() < 0.5) crumple.crash(c, into, H, clamp(into * 0.012, 0.5, 1.4));   // smashing through dents the nose too
    if (n > 30) { sound('crash', clamp(n / 140, 0.3, 1.1), H.x, H.y, H.z); sfx.play('crunch_heavy', clamp(n / 120, 0.3, 1), H.x, H.z, { gap: 0.15 }); }
  },
  bump(c, into, H) {
    damage(c, (into - CRASH.bump) * CRASH.wallHurt * 4, null);
    crumple.crash(c, into, H, clamp(0.5 + (into - CRASH.bump) * 0.035, 0.5, 2.6));   // the end that hit the wall crumples
    sound('thud', clamp(into / 50, 0.3, 1), H.x, H.y, H.z); sparks(H.x, 2.5, H.z, 6, 1, 0.8, 0.4, 14);
    sfx.play(into > 30 ? 'crunch' : 'scrape', clamp(into / 40, 0.3, 1), H.x, H.z, { gap: 0.25 });
    road.wall(c, into, H.x, H.z);
    if (c === player) game.shake = Math.min(1.2, game.shake + into / 90);
  },
  land(c, speed) { specials.landed(c, speed); road.land(c, speed); },   // down from a jump (vehicle.js)
  // a drift held long enough pays out a short burst as it ends (vehicle.js)
  // (bigger the longer it was held: a whoosh, the nitro's roar, the view widening and a jolt, DRIFT.boost)
  drift(c, lvl) {
    const me = c === player;
    sfx.play('nitro', me ? 0.45 + 0.2 * lvl : 0.25, c.x, c.z, { rate: 1.45 - 0.1 * lvl, gap: 0.2 });
    sound('charge', me ? 0.55 + 0.2 * lvl : 0.3, c.x, 1, c.z);   // the whoosh
    if (me) { drifts.boost(c, lvl); cam.fovKick = DRIFT.boost.fov[lvl - 1]; game.shake = Math.min(1.2, game.shake + 0.12 * lvl); }
  },
  // a slide held long enough to reach the next boost level: a click, higher each level
  driftUp(c, lvl) { if (c === player) sfx.play('ui_tab', 0.5 + 0.15 * lvl, undefined, undefined, { rate: 0.9 + 0.3 * lvl }); },
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
// the side saws and the hub spikes cut whatever a car rubs along
const _bl = new THREE.Vector3();
function blades(c, dt) {
  if (!c.spec.blade || c.dead || !c.def.dims.cut) return;
  const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
  for (const o of cars) {
    if (o === c || o.gone || Math.hypot(o.x - c.x, o.z - c.z) > c.half + o.half + 6) continue;
    for (const side of [1, -1]) for (const [out, along] of c.def.dims.cut) {
      const lx = side * (out - 0.3), lz = along;
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
    const hit = cars.find((o) => !o.gone && !o.dead && !((o.y || 0) > 1.5) && Math.hypot(o.x - m.x, o.z - m.z) < o.wide + 1.6 && (o !== m.owner || m.t > 3));
    const trod = !hit && extras.some((e) => e.onMine && e.onMine(m.x, m.z, 1.6));   // one of the dead walking onto it (survival) sets it off too
    const fused = m.fuse !== undefined && m.t >= m.fuse;   // (one dropped on the garage floor goes off by itself)
    if (!hit && !trod && !fused && m.t < 45) continue;
    mines.splice(i, 1); m.mesh.removeFromParent();
    if (!hit && !trod && !fused) continue;
    const was = by; by = m.owner; splashK = m.g;
    try { boom(m.x, 1, m.z, m.g.wall, 0.5, { maxDebris: 160, fire: true }, BUILDINGS.shell); if (hit) { hit.vx *= 0.3; hit.vz *= 0.3; } } finally { by = was; splashK = null; }
  }
}
// E (or Q): the gadget. Nitro is a burst of speed; the repair kit patches the car up.
function gadget(c) {
  const G = c.gadget; if (!G || c.dead || c.gadgetT > 0) return;
  useGadget(c, G);
  if (net && !c.remote && c.gadgetT > 0) net.gadget(c);   // the others see it go off too (and an oil slick is on every road)
}
function useGadget(c, G) {
  if (G.nitro) { c.boostT = G.nitro.time; c.gadgetT = G.nitro.every; sfx.play('nitro', 1, c.x, c.z); }
  else if (G.repair) {
    if (c.hp >= c.maxHp) { if (c === player) toast('Already in one piece', ''); return; }
    c.hp = Math.min(c.maxHp, c.hp + G.repair.hp); c.gadgetT = G.repair.every;
    sfx.play('ui_equip', 1); sfx.play('servo', 0.8); if (c === player) toast('Patched up', `+${G.repair.hp} armour`);
  }
  else if (G.shield) { specials.shieldOn(c, G.shield.time); c.gadgetT = G.shield.every; }
  else if (G.oil) { specials.oil(c, G.oil); c.gadgetT = G.oil.every; }
  else if (G.jump) { if (specials.jump(c, G.jump)) c.gadgetT = G.jump.every; }
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
  if (!c.rival && !c.dummy && !c.remote) return;
  const el = document.createElement('div'); el.className = c.dummy ? 'tag dummy' : c.remote && !c.rival ? 'tag human' : 'tag';
  el.innerHTML = `<b></b><i><s></s></i>`; el.querySelector('b').textContent = c.name; tags.appendChild(el); c.tag = el;
}
const _p = new THREE.Vector3();
function drawTags() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  for (const c of cars) {
    if (!c.tag) continue;
    _p.set(c.x, c.top + 6, c.z);
    const d = camera.position.distanceTo(_p); _p.project(camera);
    const show = !c.dead && _p.z < 1 && d < 320 && game.state !== 'menu' && !(c.dummy && game.state === 'garage' && !tryer.slot);   // (the range's target shows its bar only while something is fired at it)
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
  R.fillStyle = 'rgba(14,15,18,0.5)'; R.fillRect(ox, oy, w, h);   // (on the box's own dark backing: page.html #radar)
  MAP.radar(R, s, ox, oy, w, h);
  if (mode.radar) mode.radar(R, s, ox, oy, w, h);
  for (const c of cars) {
    if (c.gone) continue;
    const x = ox + c.x * s, y = oy + c.z * s;
    if (c === player) {
      R.save(); R.translate(x, y); R.rotate(-c.yaw + Math.PI); R.fillStyle = c.dead ? '#888' : '#ffb33a';
      R.beginPath(); R.moveTo(0, -6); R.lineTo(4.5, 5); R.lineTo(-4.5, 5); R.closePath(); R.fill(); R.restore();
    } else { R.fillStyle = c.dead ? 'rgba(140,140,140,0.6)' : c.remote && !c.rival ? '#4ad6ff' : '#ff4a3a'; R.beginPath(); R.arc(x, y, c.dead ? 2.2 : 3.2, 0, 7); R.fill(); }
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
    const gk = gadgetKey(player.gadget), tb = $('t-boost');
    tb.hidden = !gk;
    if (gk && tb.dataset.k !== gk) { tb.dataset.k = gk; tb.innerHTML = gadgetIcon(gk) + GADGET[gk].label; }
    tb.classList.toggle('ready', player.gadgetT <= 0);
  }
  // the gadget's meter fills as it comes back, with its picture beside it
  const G = player.gadget, gk = gadgetKey(G), gd = G && (G.nitro || G.repair || G.shield || G.oil || G.jump), every = gd ? gd.every : 0;
  $('gad').hidden = !every;
  if ($('gad').dataset.k !== (gk || '')) { $('gad').dataset.k = gk || ''; $('gad-ico').innerHTML = gadgetIcon(gk); $('gad').style.setProperty('--g', gk ? GADGET[gk].c : ''); }
  if (every) { $('gad-fill').style.width = `${(1 - player.gadgetT / every) * 100}%`; $('gad').classList.toggle('ready', player.gadgetT <= 0); }
  const [top, sub, count] = mode.hud(); $('wave').textContent = top; $('left').textContent = sub;
  drawRaceHud();
  // the counter by the scrap: cars wrecked, unless the mode counts something else (survival counts zombies)
  $('kills-l').textContent = count ? count[0] : 'Wrecked'; $('kills').textContent = count ? count[1] : game.kills; $('scrap').textContent = Math.floor(game.scrap);
}

// which gadget a car carries (its key in PARTS.gadget), or null
function gadgetKey(G) { if (!G || !G.cost) return null; for (const k in PARTS.gadget) if (PARTS.gadget[k] === G || PARTS.gadget[k].name === G.name) return k; return null; }

// the race panel (a mode with raceHud: modes/race.js): the place, big and coloured, with an arrow and a pop when it
// changes; the lap ('Final lap' blinking red); the lap time; a strip of the whole race with every car on it; the car
// to catch and the gap to it; and, where there's room, the order down the left with the gaps
const RH = { place: 0, popT: 0, arrowT: 0, n: -1, laps: 0, rows: '' };
const ordSuf = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
const lapClock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const gapText = (g) => `${Math.abs(g).toFixed(1)}s`;
function drawRaceHud() {
  const d = mode.raceHud && game.state !== 'over' ? mode.raceHud() : null;
  document.body.classList.toggle('racing', !!d);
  $('racehud').hidden = !d; $('standings').hidden = !d;
  if (!d) { RH.place = 0; return; }
  const now = performance.now() / 1000;
  if (RH.place && d.place !== RH.place && !d.count) {
    $('rh-arrow').textContent = d.place < RH.place ? '▲' : '▼'; $('rh-arrow').className = d.place < RH.place ? 'up' : 'down';
    $('rh-place').classList.add('pop'); RH.popT = now + 0.25; RH.arrowT = now + 1.6;
  }
  if (RH.popT && now > RH.popT) { $('rh-place').classList.remove('pop'); RH.popT = 0; }
  if (RH.arrowT && now > RH.arrowT) { $('rh-arrow').className = ''; RH.arrowT = 0; }
  RH.place = d.place;
  $('rh-pos').textContent = d.place; $('rh-suf').textContent = ordSuf(d.place); $('rh-of').textContent = `/${d.of}`;
  $('rh-place').className = `${d.place <= 3 ? 'p' + d.place : ''}${RH.popT ? ' pop' : ''}`;
  $('rh-lap').textContent = d.finished ? 'Finished' : d.final ? 'Final lap' : `Lap ${d.lap}/${d.laps}`;
  $('rh-lap').classList.toggle('final', d.final);
  $('rh-time').textContent = lapClock(d.lapT);
  $('rh-best').textContent = d.best ? `Best ${lapClock(d.best)}` : d.finished ? '' : `Race ${lapClock(d.total)}`;
  // the strip: a tick at each lap, the flag at the end, a dot for each car
  const strip = $('rh-strip');
  if (RH.laps !== d.laps || RH.n !== d.strip.length) {
    RH.laps = d.laps; RH.n = d.strip.length;
    strip.innerHTML = '';
    for (let k = 1; k <= d.laps; k++) { const t = document.createElement('i'); t.style.left = `${(k / d.laps) * 100}%`; strip.appendChild(t); }
    for (let k = 0; k < RH.n; k++) strip.appendChild(document.createElement('s'));
  }
  const dots = strip.querySelectorAll('s');
  d.strip.forEach((o, k) => { const el = dots[k]; el.style.left = `${o.k * 100}%`; el.className = o.me ? 'me' : o.dead ? 'dead' : o.remote ? 'net' : ''; });
  // the car to catch (or, in front, the one chasing)
  const at = d.order.findIndex((o) => o.me), ahead = d.order[at - 1], behind = d.order[at + 1];
  let next = '';
  if (d.finished) next = `${d.place === 1 ? 'You win!' : `${d.place}${ordSuf(d.place)} place`} · auto-drive`;
  else if (d.closing) next = `Race ends in <em>${d.closing}</em>`;
  else if (d.count) next = 'Get ready';
  else if (ahead) next = `Catch <b></b>${ahead.gap != null ? ` <em>${gapText(ahead.gap)}</em>` : ''}`;
  else if (behind) next = `In the lead${behind.gap != null ? ` by <em>${gapText(behind.gap)}</em>` : ''}`;
  if (d.tow && !d.finished) next += '<span class="tow">Tow</span>';
  if ($('rh-next').dataset.h !== next) { $('rh-next').dataset.h = next; $('rh-next').innerHTML = next; }
  const nb = $('rh-next').querySelector('b'); if (nb && ahead) nb.textContent = ahead.name;
  // the order, with the gaps (seconds ahead of, or behind, the player)
  const rows = d.order.map((o, k) => `${k + 1}|${o.name}|${o.me ? 'me' : o.dead ? 'dead' : ''}|${o.me ? '' : o.gap == null ? '' : gapText(o.gap)}`).join(';');
  if (rows !== RH.rows) {
    RH.rows = rows; const box = $('standings'); box.innerHTML = ''; const near = Math.min(Math.max(at, 1), d.order.length - 2);
    d.order.forEach((o, k) => {
      const r = document.createElement('div'); r.className = (o.me ? 'me' : o.dead ? 'dead' : '') + (Math.abs(k - near) <= 1 ? ' near' : '');   // near: the three shown on a phone held upright
      const b = document.createElement('b'), n = document.createElement('span'), g = document.createElement('em');
      b.textContent = k + 1; n.textContent = o.me ? 'You' : o.name; g.textContent = o.me || o.gap == null ? '' : gapText(o.gap);
      r.append(b, n, g); box.appendChild(r);
    });
  }
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
  game, cars, extras, MAP, scene, mats, camera, renderer, sfx, save, cube, chip, blast, explode, sparks, dust, CRASH, ROUND, AI,
  get player() { return player; }, TOUCH: () => TOUCH,
  addCar, addRival, rivalBuild, RIVAL_NAMES, damage, wreck, banner, toast, hint, over, keepSave: () => keepSave(save), sound,
  makeDriver, clearLine, spawnPlayer: (at) => spawnPlayer(at),
  get net() { return net; },
  // for the map's own parts and the pickups: the mode (its phase and clock), whether cars can hurt each other, the dead
  get mode() { return mode; }, get pickups() { return pickups; }, friendly: () => !!mode.friendly, horde: () => mode.horde || null,
  fx,   // (the shots, for a map's own guns: basemoves.js)
  get pix() { return specials.pix; },   // (the pixel fire, for a map's own flames: hazards.js's jets, the arena's cannons)
};
// playing online (net.js): made before the mode, which asks it how many bots to run and where its player starts
let net = null;
const mode = MODES[MAP.mode](api);
net = makeNet({ cars, game, MAP, mode, api, addCar, wreck, damage, gadget, player: () => player, toast, banner, $,
  get pickups() { return pickups; }, horde: () => mode.horde || null,
  removeCar: (c) => { c.gone = true; c.dispose(); if (c.tag) c.tag.remove(); const i = cars.indexOf(c); if (i >= 0) cars.splice(i, 1); },
  begin: () => { if (game.state === 'menu') startGame(true); },
  onRoster: () => { const n = net.players.length + net.bots; $('menu-note').textContent = `${net.players.map((p) => p.name).join(', ')}${net.bots ? ` and ${net.bots} bot${net.bots === 1 ? '' : 's'}` : ''}: ${n} cars.`; },
  // (quick play: the round is over, so straight into the next one)
  noRound: () => { toast('That round is over', net.quick ? 'Finding another one' : 'Back to the lobby'); setTimeout(() => { if (net.quick) playAgain(); else location.href = net.lobby(); }, 1500); } });
// the map's pickups and hazards, if it lists any (pickups.js, hazards.js)
const pickups = makePickups(api, MAP.pickups), hazards = makeHazards(api, MAP.hazards);
function spawnPlayer(at) {
  if (!at) {
    at = { ...MAP.spawn };
    if (player) { const o = (mode.respawnAt && mode.respawnAt(player)) || MAP.spawnPoint(null, cars.filter((c) => !c.gone && c !== player)); at.x = o.x; at.z = o.z; at.yaw = o.yaw ?? Math.random() * 6.28; at.y = o.y; }   // (y: the road's height there, so it comes back on a bridge and not under it)
  }
  if (player && !player.dead) { player.dispose(); cars.splice(cars.indexOf(player), 1); }   // a fresh build in place of the old one
  player = addCar({ ...save.load, name: 'You' }, at, false);
  player.turretTurn = 10;
  cam.yaw = at.yaw; cam.head = undefined; cam.cx = player.x; cam.cz = player.z;
  // the player's car always goes first in the list
  cars.splice(cars.indexOf(player), 1); cars.unshift(player);
}

// ---- the garage: the car on the turntable in the workshop (garageroom.js), the panel beside it (garage.js) ----------
// The workshop is out past the edge of the map. While it is open the map's own light and weather are put by for the
// workshop's (garageLight), the camera swings round to whichever part is being changed (VIEWS), parts drop on with a
// clunk (stepBolt), weapons are fired at a target car through the door (stepTry), and a build can be taken out into
// the yard for half a minute (startTest).
const art = makePartArt({ mats });
const garage = makeGarage({
  root: $('garage'), save, art,
  onChange: (load, how, slot) => {
    const old = player, same = old.load[slot] === load[slot];
    const at = { x: old.x, z: old.z, yaw: old.yaw };
    old.dispose(); cars.splice(cars.indexOf(old), 1); player = null;
    player = addCar({ ...load, name: 'You' }, at, false); cars.splice(cars.indexOf(player), 1); cars.unshift(player);
    player.turretTurn = 10; player.gunYaw = old.gunYaw; player.aim.copy(old.aim);
    if (how === 'fit' || how === 'look' || how === 'build') boltOn(how === 'build' ? 'body' : slot, how, same);
    room.setScrap(save.scrap);
  },
  onDrive: leaveGarage,
  onTest: (load) => startTest(load),
  onTry: (slot, key) => onTry(slot, key),
  onTab: (slot) => { gcam.view = slot; gcam.user = 0; tryer.slot = null; },
  sound: (n, v = 1) => { initAudio(); sfx.play(n, v); },
  toast,
});

// the workshop's light in place of the map's, and back
const GLIGHT = { sky: 0xdde6ff, ground: 0x6a5a48, hemi: 1.15, sun: 0xfff0dc, sunI: 2.4, dir: new THREE.Vector3(0.35, 1, 0.6) };
let lightWas = null;
function garageLight(on) {
  if (on === !!lightWas) return;
  if (on) {
    lightWas = { hc: hemi.color.getHex(), hg: hemi.groundColor.getHex(), hi: hemi.intensity, sc: sun.color.getHex(), si: sun.intensity, fog: scene.fog ? [scene.fog.near, scene.fog.far] : null, bd: backdrop ? backdrop.objects.map((o) => o.visible) : [], lk: lookObjs.map((o) => o.visible) };
    hemi.color.set(GLIGHT.sky); hemi.groundColor.set(GLIGHT.ground); hemi.intensity = GLIGHT.hemi;
    sun.color.set(GLIGHT.sun); sun.intensity = GLIGHT.sunI; sunFrom(GLIGHT.dir);
    if (scene.fog) { scene.fog.near = 320; scene.fog.far = 1500; }
    if (backdrop) for (const o of backdrop.objects) o.visible = false;
    for (const o of lookObjs) o.visible = false;
  } else {
    const w = lightWas; lightWas = null;
    hemi.color.setHex(w.hc); hemi.groundColor.setHex(w.hg); hemi.intensity = w.hi; sun.color.setHex(w.sc); sun.intensity = w.si; sunFrom(SUN_DIR0);
    if (scene.fog && w.fog) { scene.fog.near = w.fog[0]; scene.fog.far = w.fog[1]; }
    if (backdrop) backdrop.objects.forEach((o, i) => { o.visible = w.bd[i]; });
    lookObjs.forEach((o, i) => { o.visible = w.lk[i]; });
  }
  room.show(on);
}

// ---- the target cars: one on the firing range, three about the yard on a test drive ---------------------------------
const TARGET = { body: 'hauler', primary: 'mg', roof: 'none', door: 'none', secondary: 'none', front: 'bumper', armour: 'medium', wheels: 'street', engine: 'stock', gadget: 'none', paint: 'white', trim: 'red', pattern: 'checker' };
const dummies = [];
function addDummy(at) {
  const c = new Vehicle(scene, mats, { ...TARGET, name: 'Target' }, at); crumple.attach(c);
  c.dummy = true; c.maxHp = c.hp = 420; c.bounds = room.bounds; c.home = { ...at };
  cars.push(c); makeTag(c); dummies.push(c);
  return c;
}
function dropDummy(c) {
  c.dispose(); if (c.tag) c.tag.remove();
  const i = cars.indexOf(c); if (i >= 0) cars.splice(i, 1);
  const j = dummies.indexOf(c); if (j >= 0) dummies.splice(j, 1);
}
function clearDummies() { while (dummies.length) dropDummy(dummies[0]); }
const popsEl = $('pops'), _pp = new THREE.Vector3();
function pop(text, at, big) {
  _pp.copy(at).project(camera); if (_pp.z > 1) return;
  const el = document.createElement('i'); el.textContent = text; if (big) el.className = 'big';
  el.style.left = `${(_pp.x * 0.5 + 0.5) * canvas.clientWidth + (Math.random() - 0.5) * 40}px`; el.style.top = `${(-_pp.y * 0.5 + 0.5) * canvas.clientHeight}px`;
  popsEl.appendChild(el); setTimeout(() => el.remove(), 950);
}
function stepDummies(dt) {
  for (const c of [...dummies]) {
    if (game.state === 'garage') { c.hurtT -= dt; if (c.dead) c.deadT += dt; }
    c.popT = (c.popT || 0) - dt;
    if (c.popAcc >= 1 && c.popT <= 0) { pop(`-${Math.round(c.popAcc)}`, c.centre(_pp).setY(c.top + 2.5), c.popAcc >= 25); c.popAcc = 0; c.popT = 0.2; }
    if (c.dead && (c.respawnT -= dt) <= 0) { const at = c.home; dropDummy(c); addDummy(at); }
  }
}

// ---- parts going on and coming off ----------------------------------------------------------------------------------
// which bones of the car's model are each slot's part (null: the whole car)
const SLOT_BONES = { primary: ['yaw'], roof: ['roof'], door: ['doorL', 'doorR', 'blades', 'hubFL', 'hubFR', 'hubRL', 'hubRR'], secondary: ['pod', 'mines'], front: ['front'], wheels: ['wFL', 'wFR', 'wRL', 'wRR'], engine: ['engine'] };
let bolt = null;
function boltOn(slot, how, same) {
  const names = SLOT_BONES[slot] || null;
  bolt = { names, t: same ? 0.3 : 0, lockOnly: same, big: how === 'fit', whole: !names, landed: false, slot };
  sfx.play('servo', 0.6);
}
function stepBolt(dt) {
  const B = bolt, c = player;
  if (c) {   // the bonnet lifts while the engines are being looked at; the engine rocks as it revs
    const st = c.unit.state, want = game.state === 'garage' && !game.home && gcam.view === 'engine' && c.def.dims.hood ? (c.def.dims.hoodDir > 0 ? 1.75 : 1.15) : 0;   // (a lid behind the cabin goes up past upright, out of the way)
    st.hood = game.state === 'garage' ? st.hood + (want - st.hood) * Math.min(1, dt * 3.2) : (c.hoodUp || 0);   // (out of the garage: popped by a crash, crumple.js)
    st.shake = game.state === 'garage' && game.revT > 0 ? 0.045 * Math.sin(Math.min(1, game.revT / 1.4) * Math.PI) : 0;
  }
  if (c && game.state === 'garage') {
    // the engine tried out: the car shakes as it revs, smoke from the back
    if (game.revT > 0) {
      game.revT -= dt;
      c.unit.root.position.y += (Math.random() - 0.5) * 0.05; c.unit.bones.body.rotation.z += (Math.random() - 0.5) * 0.012;
      if (Math.random() < dt * 14) { const s = Math.sin(c.yaw), co = Math.cos(c.yaw); dust(c.x + s * (c.mid - c.half), 1, c.z + co * (c.mid - c.half), 3, 2.5); }
      specials.exhaust(c, dt, 1);
    }
    if (game.boostT > 0) {
      game.boostT -= dt;
      const s = Math.sin(c.yaw), co = Math.cos(c.yaw), bx = c.x + s * (c.mid - c.half - 0.4), bz = c.z + co * (c.mid - c.half - 0.4);
      sparks(bx, 1.2, bz, 4, 0.45, 0.75, 1, 12);
    }
  }
  if (!B || !c) return;
  B.t += dt;
  const T = 0.32, t = B.t;
  const fall = t < T ? (1 - t / T) ** 2 : 0, spring = t >= T ? Math.exp(-(t - T) * 6) * Math.sin((t - T) * 21) : 0;
  const body = c.unit.bones.body;
  if (B.whole) c.unit.root.position.y += fall * 7 - spring * 0.3;
  else {
    for (const n of B.names) { const b = c.unit.bones[n]; if (b) { b.position.y += fall * 4.5 + spring * 0.25; b.scale.multiplyScalar(1 + spring * 0.06); } }
    if (body) body.position.y -= spring * 0.18;
  }
  if (!B.landed && t >= T) {
    B.landed = true;
    sfx.play('reload', 0.8); sfx.play('tink', 0.7, undefined, undefined, { rate: 0.8 });
    if (B.whole || B.big) sound('thud', 0.7);
    // sparks where it lands
    c.unit.root.updateWorldMatrix(true, true);
    const at = new THREE.Vector3();
    const b = B.names && B.names.map((n) => c.unit.bones[n]).find((x) => x && c.unit.parts.some((p) => p.bone === x && p.count));
    if (b) b.getWorldPosition(at); else c.centre(at).setY(0.6);
    sparks(at.x, at.y + 0.4, at.z, B.big ? 26 : 12, 1, 0.85, 0.45, B.big ? 26 : 16);
    if (B.big) game.shake = Math.min(0.5, game.shake + 0.25);
  }
  if (t > 1.3) bolt = null;
}

// ---- the camera and the turntable -------------------------------------------------------------------------------------
// Each slot has its view: which way the turntable turns the car (turn: from nose-on to the camera, round to the car's
// side and back), how high the camera is (h) and how far off (d), the height it looks at (y), how far along the car
// it looks (f, in half-lengths: + towards the nose), and how much of the car must fit on the screen (r, in
// half-lengths). The overall views turn the car slowly by themselves; a drag turns it by hand.
const VIEWS = {
  body: { turn: 0.75, h: 7, d: 21, y: 2.4, f: 0, r: 1.25, spin: true },
  primary: { turn: 0.55, h: 11.5, d: 15, y: 4, f: 0, r: 0.95 },
  roof: { turn: 0.85, h: 13.5, d: 14.5, y: 4, f: 0.1, r: 0.95 },
  door: { turn: 1.5, h: 4.6, d: 14, y: 2.3, f: 0.2, r: 1.05 },
  secondary: { turn: 0.5, h: 10.5, d: 15, y: 3.8, f: -0.1, r: 0.95 },
  rear: { turn: 2.55, h: 8, d: 15, y: 2.4, f: -0.5, r: 0.95 },
  front: { turn: 0.38, h: 5, d: 13, y: 1.9, f: 0.75, r: 0.8 },
  armour: { turn: 1.05, h: 7.5, d: 16, y: 2.4, f: 0, r: 1.15 },
  wheels: { turn: 1.3, h: 2.8, d: 11, y: 1.6, f: 0.55, r: 0.7 },
  engine: { turn: 0.45, h: 14, d: 13, y: 2.3, f: 0.5, r: 0.6 },   // (high, to look down into the bay with the bonnet up)
  gadget: { turn: 2.6, h: 6.5, d: 15, y: 2.4, f: -0.5, r: 1 },
  paint: { turn: 0.75, h: 7, d: 19, y: 2.4, f: 0, r: 1.2, spin: true },
  home: { turn: 0.75, h: 6.5, d: 22, y: 2.6, f: 0, r: 1.3, spin: true },   // the home screen: the whole car, turning
  range: { turn: 0, h: 13, d: 30, y: 3.2, f: 0.55, r: 1.6, yaw: Math.PI, az: 0.16 },   // the firing range: nose to the door, looking out past the car
};
const gcam = { view: 'body', user: 0, pos: new THREE.Vector3(), look: new THREE.Vector3(), init: false, az: 0.35, idle: 0 };
const _gl = new THREE.Vector3(), _gp = new THREE.Vector3(), _gr = new THREE.Vector3(), _gu = new THREE.Vector3();
function turnTable(dx) { gcam.user += dx * 0.012; gcam.idle = 0; }
function viewNow() {
  if (game.home) return VIEWS.home;
  if (tryer.slot && tryer.view) return VIEWS[tryer.view];
  if (gcam.view === 'secondary' && player && player.load.secondary === 'mines') return VIEWS.rear;
  if (gcam.view === 'engine' && player && player.def.dims.bayZ < player.mid) return { ...VIEWS.engine, turn: 2.05, h: 17, d: 11, f: (player.def.dims.bayZ - player.mid) / player.half };   // (from the side, past the wing)
  return VIEWS[gcam.view] || VIEWS.body;
}
function garageCamera(dt) {
  const c = player, V = viewNow(), az = V.az ?? gcam.az;
  if (V.spin && !cam.drag) { gcam.idle += dt; if (gcam.idle > 1.5) gcam.user += dt * 0.22; }
  // the turntable turns the car to the view (the shorter way round), not faster than a real one would
  const want = V.yaw ?? (az + V.turn + gcam.user), dy = wrap(want - c.yaw), rate = cam.drag ? 30 : 3.2;
  const turn = clamp(dy * Math.min(1, dt * 5), -rate * dt, rate * dt);
  c.yaw = wrap(c.yaw + turn); c.x = room.spot.x; c.z = room.spot.z;
  room.lift.rotation.y = c.yaw;
  if (Math.abs(turn) > dt * 1.2 && !cam.drag) { gcam.motor = (gcam.motor || 0) - dt; if (gcam.motor <= 0) { gcam.motor = 0.8; sfx.play('servo', 0.25, undefined, undefined, { rate: 0.7 }); } }
  // what to look at: a point along the car, at the view's height
  const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
  _gl.set(c.x + sy * (c.mid + c.half * V.f), V.y, c.z + cy * (c.mid + c.half * V.f));
  // how far off: the view's distance, or further if the part of the screen the panel leaves is small
  const fr = game.home ? homeFree() : garage.free(), W = innerWidth, H = innerHeight, tanV = Math.tan(camera.fov * Math.PI / 360);
  const fw = Math.max(0.2, (fr.x1 - fr.x0) / W), fh = Math.max(0.2, (fr.y1 - fr.y0) / H);
  const need = (c.half + 1) * V.r / (tanV * Math.min(fh, camera.aspect * fw * 0.9));
  const d = clamp(Math.max(V.d, need), 7, 30), h = V.y + (V.h - V.y) * d / V.d;
  _gp.set(_gl.x + Math.sin(az) * d, Math.min(h, 21), _gl.z + Math.cos(az) * d);
  // the car in the middle of the free part of the screen: look past it by as much
  camera.position.copy(_gp); camera.lookAt(_gl); camera.updateMatrixWorld();
  _gr.setFromMatrixColumn(camera.matrixWorld, 0); _gu.setFromMatrixColumn(camera.matrixWorld, 1);
  const nx = (fr.x0 + fr.x1) / W - 1, ny = 1 - (fr.y0 + fr.y1) / H, dist = _gp.distanceTo(_gl);
  _gl.addScaledVector(_gr, -nx * tanV * camera.aspect * dist).addScaledVector(_gu, -ny * tanV * dist);
  // ease there
  if (!gcam.init) { gcam.pos.copy(_gl).lerp(_gp, 1.9); gcam.pos.y += 5; gcam.look.copy(_gl); gcam.init = true; }   // (it swoops in as the garage opens)
  const k = 1 - Math.exp(-dt * 4.5);
  gcam.pos.lerp(_gp, k); gcam.look.lerp(_gl, k);
  camera.position.copy(gcam.pos);
  if (game.shake > 0) camera.position.add(_gp.set((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake * 0.7, (Math.random() - 0.5) * game.shake));
  camera.lookAt(gcam.look); camera.updateMatrixWorld();
  // the turret: at the target car on the range, else off to one side
  const tg = dummies[0];
  if (tryer.slot && tg && !tg.dead) tg.centre(c.aim).setY(2.4);
  else c.aim.set(c.x + Math.sin(c.yaw + 0.5) * 60, 6, c.z + Math.cos(c.yaw + 0.5) * 60);
  hotspots();
}
// the glowing spots: a point on the car for each slot, shown when its side faces the camera
const _hp = new THREE.Vector3(), _hn = new THREE.Vector3(), _hc = new THREE.Vector3();
function hotspots() {
  const c = player, D = c.def.dims, sy = Math.sin(c.yaw), cy = Math.cos(c.yaw), u = c.unit, list = [];
  if (tryer.slot || game.revT > 0 || game.boostT > 0 || !garage.open_) { garage.place(list); return; }
  u.root.updateWorldMatrix(true, true);
  // which side of the car is towards the camera (+1 its left)
  const side = (camera.position.x - c.x) * cy - (camera.position.z - c.z) * sy > 0 ? 1 : -1;
  const local = (lx, ly, lz, nx, ny, nz) => { _hp.set(c.x + lx * cy + lz * sy, ly, c.z - lx * sy + lz * cy); _hn.set(nx * cy + nz * sy, ny, -nx * sy + nz * cy); };
  const bone = (n, ox = 0, oy = 0, nx = 0, ny = 1, nz = 0) => { const b = u.bones[n]; if (!b || !u.parts.some((p) => p.bone === b && p.count)) return false; b.getWorldPosition(_hp); _hp.y += oy; _hp.x += ox; _hn.set(nx * cy + nz * sy, ny, -nx * sy + nz * cy); return true; };
  const add = (slot) => {
    _hc.subVectors(camera.position, _hp);
    const facing = _hn.dot(_hc) > 0;
    _hc.copy(_hp).project(camera);
    list.push({ slot, x: (_hc.x * 0.5 + 0.5) * canvas.clientWidth, y: (-_hc.y * 0.5 + 0.5) * canvas.clientHeight, on: facing && _hc.z < 1 });
  };
  local(0, 2, D.mid + D.half - 0.4, 0, 0.2, 1); add('front');
  if (gcam.view !== 'engine') { const bz = D.bayZ ?? D.mid + D.half * 0.6; local(0, D.roof * 0.78, bz, 0, 1, bz < D.mid ? -0.5 : 0.5); add('engine'); }   // (not over the open bay)
  if (!bone('yaw', 0, 1.6)) local(0, D.top, D.mid, 0, 1, 0); add('primary');
  if (!bone('roof', 0, 0.8)) local(0, D.roof + 0.4, D.mid + D.half * 0.25, 0, 1, 0.3); add('roof');
  local(side * (D.wide + 0.1), 2.3, D.mid + D.half * 0.25, side, 0, 0); add('door');
  local(side * (D.wide - 0.2), D.wheelR + D.lift, D.mid + D.half * 0.62, side, 0.2, 0); add('wheels');
  local(side * D.wide, D.roof * 0.55, D.mid - D.half * 0.4, side, 0, 0); add('armour');
  if (c.load.secondary === 'mines') { local(0, 1.4, D.mid - D.half, 0, 0, -1); add('secondary'); }
  else { if (!bone('pod', 0, 0.8)) local(side * D.wide * 0.5, D.top - 0.4, D.mid - D.half * 0.2, 0, 1, 0); add('secondary'); }
  local(0, 1.3, D.mid - D.half - 0.2, 0, 0.3, -1); add('gadget');
  // two spots on top of each other (the main gun and the heavy weapon on the turret): the second steps aside
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i].on && list[j].on && Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y) < 34) list[j].x = list[i].x + 38;
  garage.place(list);
}

// ---- trying a part: fire it on the range, rev the engine, light the nitro -------------------------------------------------
const tryer = { slot: null, key: null, t: 0, wait: 0, view: null, fired: 0 };
function onTry(slot, key) {
  if (game.state !== 'garage') return;
  const p = PARTS[slot][key];
  if (slot === 'engine') { game.revT = 1.4; sfx.play('start', 0.7); gcam.view = 'engine'; return; }
  if (slot === 'gadget') {
    if (p.shield) specials.shieldOn(player, 2.6);
    else if (p.oil) specials.oil(player, p.oil);
    else if (p.jump) specials.jump(player, { vy: 21 });
    else { game.boostT = 1.6; sfx.play('nitro', 0.9); }
    return;
  }
  const mine = !!p.mine;
  tryer.slot = slot; tryer.key = key; tryer.t = 0; tryer.wait = 0.75; tryer.fired = 0;
  tryer.view = mine ? 'rear' : 'range';
  tryer.long = p.rate || p.arc ? 2.4 : mine ? 2.8 : Math.min(4.2, (p.reload || 1) * 1.6 + 0.6);
  if (!mine && (!dummies[0] || dummies[0].dead)) { clearDummies(); addDummy(room.target); }
}
function stepTry(dt) {
  const T = tryer; if (!T.slot || !player) return;
  T.t += dt;
  const c = player, G = c.guns.find((g) => g.slot === T.slot);
  const ready = T.t > T.wait && (T.view !== 'range' || Math.abs(wrap(c.yaw - Math.PI)) < 0.05);
  if (G && ready && T.fired < T.long) {
    T.fired += dt;
    const want = [G.group === 0, G.group === 1];
    if (G.g.mine && G.left === 0 && G.t > 0) want[1] = false;   // (one mine is enough)
    guns(c, dt, want, T.slot);
    for (const m of mines) if (m.owner === c && m.fuse === undefined) m.fuse = 1.5;
  }
  if (!G || T.fired >= T.long) { T.after = (T.after || 0) + dt; if (T.after > 1.4) { T.slot = null; T.after = 0; } }
}

// ---- the test drive: half a minute in the yard with the build on the turntable ----------------------------------------
function placePlayer(load, at) {
  if (player && !player.dead) { player.dispose(); cars.splice(cars.indexOf(player), 1); }
  player = addCar({ ...load, name: 'You' }, at, false); cars.splice(cars.indexOf(player), 1); cars.unshift(player);
  player.turretTurn = 10;
}
function startTest(load) {
  if (game.state !== 'garage') return;
  tryer.slot = null; bolt = null;
  garage.hide(); $('testbar').hidden = false;
  game.state = 'test'; game.testT = 30; game.testEnd = null; game.testLoad = { ...load };
  placePlayer(load, room.start); player.bounds = room.bounds;
  clearDummies(); for (const d of room.dummies) addDummy(d);
  cam.yaw = player.yaw; cam.head = undefined; cam.cx = player.x; cam.cz = player.z; cam.d = undefined; cam.p = undefined;
  sfx.play('start', 0.9); setTimeout(() => sfx.play('ui_go', 0.8), 300); lockMouse();
  toast('Test drive', TOUCH ? 'Try the build on the targets' : 'WASD to drive, click to fire. G to come back');
}
function endTest() {
  if (game.state !== 'test') return;
  $('testbar').hidden = true; game.state = 'garage';
  if (document.exitPointerLock && cam.locked) document.exitPointerLock();
  clearDummies(); addDummy(room.target);
  for (let i = mines.length - 1; i >= 0; i--) if (mines[i].z < 0) { mines[i].mesh.removeFromParent(); mines.splice(i, 1); }
  specials.clearOffMap();
  placePlayer(garage.shown(), { x: room.spot.x, z: room.spot.z, yaw: Math.PI + gcam.az });
  gcam.init = false; garage.show(); sfx.play('door', 0.6);
}
function stepTest(dt) {
  game.testT -= dt; $('test-t').textContent = Math.max(0, Math.ceil(game.testT));
  if (game.testT <= 0 || (game.testEnd != null && (game.testEnd -= dt) <= 0)) endTest();
}
$('test-back').addEventListener('click', endTest);

// The workshop, with the car fixed up on the turntable: the home screen and the garage both stand in it.
function intoRoom() {
  if (!lightWas) {
    if (document.exitPointerLock && cam.locked) document.exitPointerLock();
    // where the car goes back to when it drives out: where it stood, or a spawn point if it was wrecked
    if (player && !player.dead) game.garageBack = { x: player.x, z: player.z, yaw: player.yaw, y: player.fy };
    else {
      const o = (mode.respawnAt && mode.respawnAt(player)) || MAP.spawnPoint(null, cars.filter((c) => !c.gone && c !== player));
      game.garageBack = { x: o.x, z: o.z, yaw: o.yaw ?? Math.random() * 6.28, y: o.y };
      player = null;   // (the wreck stays where it is)
    }
    garageLight(true);
  }
  room.setScrap(save.scrap);
  placePlayer(save.load, { x: room.spot.x, z: room.spot.z, yaw: Math.PI + gcam.az });
  player.vx = player.vz = 0;
  clearDummies(); addDummy(room.target);
  gcam.init = false; gcam.user = 0; tryer.slot = null;
}
function outOfRoom() {
  clearDummies(); garage.place([]);
  for (let i = mines.length - 1; i >= 0; i--) if (mines[i].z < 0) { mines[i].mesh.removeFromParent(); mines.splice(i, 1); }
  specials.clearOffMap();
  garageLight(false);
  spawnPlayer(game.garageBack || null);
  cam.yaw = player.yaw; cam.head = undefined; cam.d = undefined; cam.p = undefined;
}
// The home screen: the car turning on the turntable, and a card for each way to play and for the garage.
const BRIEF = 'ad-brief';   // (kept across the page loading again on another map: straight to that mode's card)
const HOME_CARDS = [
  { map: 'race', k: 'Two tracks', t: 'Race', d: 'Laps of New York and Washington with the guns on', icon: 'M5 3h2v18H5zm3 1h4l1 1h6v9h-6l-1-1H8zm2 2v2h2V6zm4 1v2h2V7zm-2 1v2h2V8zm-2 2v2h2v-2zm4 1v2h2v-2z' },
  { map: 'base', k: 'Two maps', t: 'Zombie Survival', d: 'Outlast the horde. Last car running wins', icon: 'M12 2a8 8 0 0 1 8 8c0 3-1.5 5-3 6v3h-2v-2h-2v2h-2v-2H9v2H7v-3c-1.5-1-3-3-3-6a8 8 0 0 1 8-8zM8.5 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 13l-1.2 2.5h2.4z' },
  { map: 'arena', k: 'Hammerdown Arena', t: 'Arena', d: 'Eight cars, three minutes, most wrecks wins', icon: 'M12 1l2.2 5.6L19 3.5l-1.6 5.6L23 10l-4.6 3.2L21 18.5l-5.6-1.3L14 23l-2-5-2 5-1.4-5.8L3 18.5l2.6-5.3L1 10l5.6-.9L5 3.5l4.8 3.1z' },
  { garage: true, k: 'Your car', t: 'Garage', d: 'Build it, arm it, paint it', icon: 'M21.7 6.3l-3.6 3.6-2.8-.7-.7-2.8 3.6-3.6a6 6 0 0 0-7.7 7.7L2.3 18.7a2.1 2.1 0 0 0 3 3l8.2-8.2a6 6 0 0 0 8.2-7.2z' },
];
// Solo, Online or Friends, picked on the home screen and kept. Solo: a mode's card has Start. Online is one tap: the
// mode's card on the home screen goes straight into a round (quick play, net.js quickPlay), no lobby, no Ready button.
// Friends: the mode's card has the friends' room (a code to share, the host starts it).
const PLAY = 'ad-play', CAN_ONLINE = !!serverUrl();
let playAs = 'solo'; try { const p = localStorage.getItem(PLAY); if (CAN_ONLINE && (p === 'online' || p === 'friends')) playAs = p; } catch (e) { /* solo */ }
const ONLINE_D = { race: 'Tap to race: up to 6 drivers, bots take the empty seats', base: 'Tap to play: up to 6 cars against the horde, together', arena: 'Tap to fight: up to 8 cars, bots take the empty seats' };
const FRIENDS_D = { race: 'A room for friends: share the code', base: 'A room for friends: share the code', arena: 'A room for friends: share the code' };
function setPlay(p) {
  playAs = (p === 'online' || p === 'friends') && CAN_ONLINE ? p : 'solo';
  try { localStorage.setItem(PLAY, playAs); } catch (e) { /* this visit only */ }
  drawHome();
}
// which way in the mode's card shows: 'solo', 'online', or both (a link straight to a map, as before)
function cardAs(a) {
  if ((a === 'online' || a === 'friends') && !lobby) a = 'solo';
  document.body.classList.toggle('as-solo', a === 'solo'); document.body.classList.toggle('as-online', a === 'online' || a === 'friends');
  const kind = { waves: 'Waves', race: 'Race', survival: 'Zombie Survival', brawl: 'Arena' }[MAP.mode] || MAP.mode;
  const lv = LEVELS[MAP.mode] && LEVELS[MAP.mode].list[levelOf(MAP.mode)];
  $('brief-k').textContent = a === 'online' ? kind + ' · Online' : a === 'friends' ? kind + ' · Friends' : a === 'solo' ? kind + ' · Solo' + (lv ? ' · ' + lv.name : '') : kind;
  $('menu-home').textContent = a === 'solo' && STAGES[MAP.mode] ? 'Back' : 'Main menu';
  if (!net) $('menu-note').textContent = a === 'solo' && STAGES[MAP.mode] ? '' : mode.tip || '';   // (solo: the stage select said it)
  $('on-quick').hidden = a === 'friends';   // (Friends: the room's buttons only; quick play is the home screen's Online)
  $('on-quick').className = a === 'online' ? 'go' : 'alt'; $('on-quick').textContent = 'Play online';
}
// one tap: the loading screen at once, and a quick room for this mode (the relay sends us straight into its round)
function goOnline(id) {
  initAudio(); sfx.play('ui_open', 0.7);
  $('home').hidden = true; $('over').hidden = true; $('menu').hidden = true;
  if (window.__adLoad) window.__adLoad.again('Finding a round'); else { const l = $('loading'); if (l) l.hidden = false; }
  quickPlay(id, (why) => {
    const l = $('loading'); if (l) l.hidden = true;
    toast(why, ''); if (net) { $('over').hidden = false; } else showHome();
  });
}
// Play again after a quick round: off this round, and straight into the next one for the same mode
function playAgain() { if (net) net.bye(); goOnline(MAP.id); }
{
  const box = $('home-cards');
  $('home-play').hidden = !CAN_ONLINE;
  for (const b of $('home-play').querySelectorAll('button')) b.addEventListener('click', () => { sfx.play('ui_open', 0.5); setPlay(b.dataset.p); });
  // playtesting: own every car, weapon and part (kept in the save, so it holds for solo and online)
  $('home-unlock').addEventListener('click', () => {
    if (!game.home) return;
    for (const slot of Object.keys(PARTS)) save.owned[slot] = Object.keys(PARTS[slot]);
    keepSave(save); sfx.play('ui_coin', 0.7); toast('Everything unlocked', 'Every car and part is yours in the garage'); drawHome();
  });
  for (const c of HOME_CARDS) {
    const b = document.createElement('button'); b.className = 'h-card ' + (c.garage ? 'garage' : c.map);
    b.innerHTML = `<small></small><b></b><span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${c.icon}"/></svg>`;
    b.querySelector('small').textContent = c.k; b.querySelector('b').textContent = c.t; b.querySelector('span').textContent = c.d;
    if (c.map) b.dataset.map = c.map;
    b.addEventListener('click', () => { if (!game.home) return; if (c.garage) openGarage('home'); else if (playAs === 'online') goOnline(c.map); else if (playAs === 'solo' && STAGES[modeOf(c.map)]) showStages(modeOf(c.map)); else pickMode(lastMap(c.map)); });
    box.appendChild(b);
  }
}
// A mode with two maps (Zombie Survival: maps/index.js SHARED) opens on the one played last, kept in this browser; its
// start card has a row to change map.
const LAST = 'ad-last-';
function lastMap(id) {
  const m = mapById(id), list = m && (STAGES[m.mode] || SHARED[m.mode]); if (!list) return id;
  let v = null; try { v = localStorage.getItem(LAST + m.mode); } catch (e) { /* the first */ }
  return list.some((o) => o.id === v) ? v : list.some((o) => o.id === PREVIEW) ? PREVIEW : list.some((o) => o.id === id) ? id : list[0].id;   // (a preview page opens on the track it is for)
}
function drawHome() {
  const st = statsOf(save.load), r = rating(st), body = PARTS.body[save.load.body] || {};
  $('home-scrap').textContent = Math.round(save.scrap);
  const all = Object.keys(PARTS).every((s) => Object.keys(PARTS[s]).every((k) => (save.owned[s] || []).includes(k)));
  $('home-unlock').disabled = all; $('home-unlock').textContent = all ? 'All unlocked' : 'Unlock all';
  for (const b of $('home-play').querySelectorAll('button')) b.classList.toggle('on', b.dataset.p === playAs);
  for (const c of HOME_CARDS) if (c.map) document.querySelector(`.h-card[data-map="${c.map}"] span`).textContent = playAs === 'online' ? ONLINE_D[c.map] : playAs === 'friends' ? FRIENDS_D[c.map] : c.d;
  $('home-car').textContent = body.name || 'Your car';
  $('home-class').textContent = classOf(r); $('home-rate').dataset.c = classOf(r); $('home-num').textContent = r;
  const gk = save.load.gadget, hg = $('home-gad'); hg.hidden = !GADGET[gk];
  if (GADGET[gk]) hg.innerHTML = gadgetIcon(gk) + PARTS.gadget[gk].name;
}
// the part of the screen the cards leave free, for the camera to frame the car in
function homeFree() {
  const p = $('home-cards').getBoundingClientRect(), W = innerWidth, H = innerHeight;
  if (p.top > H * 0.2 && p.width > W * 0.8) return { x0: 0, y0: 0, x1: W, y1: p.top };
  return { x0: 0, y0: 0, x1: p.left, y1: H };
}
function showHome() {
  intoRoom();
  game.state = 'garage'; game.home = true; game.garageFrom = null;
  $('menu').hidden = true; $('over').hidden = true; $('dead').hidden = true; $('hint').classList.remove('on');
  drawHome(); $('home').hidden = false;
}
// ---- the stage select (solo): a picture card for each map of the mode, the difficulty, and Start -----------------------
// Picking a map no longer loads it at once (Will, 2026-11-25: "it instantly takes you to a loading screen, it's a little
// jarring"): this screen comes first, over the workshop, and Start goes to the loading screen, then the mode's card.
const modeOf = (id) => (mapById(id) || {}).mode;
const MODE_NAME = { waves: 'Waves', race: 'Race', survival: 'Zombie Survival', brawl: 'Arena' };
const PICK_WORD = { race: 'Pick a track', survival: 'Pick a map', brawl: 'Pick a map' };
// each mode's difficulty, as kept in the save (the same places the modes read: modes/race.js, survival.js, brawl.js)
const lvBox = () => (save.levels && typeof save.levels === 'object' ? save.levels : (save.levels = {}));
const LEVELS = {
  race: { list: RACE.levels, get: () => save.raceLevel, put: (id) => { save.raceLevel = id; } },
  survival: { list: SURVIVAL_LEVELS, get: () => lvBox().survival, put: (id) => { lvBox().survival = id; } },
  brawl: { list: BRAWL_LEVELS, get: () => lvBox().brawl, put: (id) => { lvBox().brawl = id; } },
};
const levelOf = (m) => { const L = LEVELS[m]; return L && L.list[L.get()] ? L.get() : 'normal'; };
function setLevel(m, id) {
  if (!LEVELS[m] || !LEVELS[m].list[id]) return;
  if (m === MAP.mode && mode.levels) mode.levels.set(id); else { LEVELS[m].put(id); keepSave(save); }
}
const stage = { mode: null, pick: null };
function bestText(m, lv) {   // Zombie Survival: the best time on that map at that difficulty (modes/survival.js keeps it)
  const b = +((save.survivalBest || {})[lv === 'normal' ? m.id : `${m.id}-${lv}`]) || 0;
  return b ? `Best ${Math.floor(b / 60)}:${String(Math.floor(b) % 60).padStart(2, '0')}` : '';
}
function drawStages() {
  const m = stage.mode, lv = levelOf(m), L = LEVELS[m];
  for (const b of $('st-cards').children) {
    b.classList.toggle('on', b.dataset.id === stage.pick);
    const best = b.querySelector('.st-best'); best.textContent = m === 'survival' ? bestText(STAGES[m].find((o) => o.id === b.dataset.id), lv) : '';
  }
  for (const b of $('st-levels').querySelectorAll('button')) b.classList.toggle('on', b.dataset.id === lv);
  $('st-note').textContent = (L && L.list[lv] && L.list[lv].note) || '';
}
function showStages(m) {
  const list = STAGES[m]; if (!list) return;
  initAudio(); sfx.play('ui_open', 0.6);
  stage.mode = m; stage.pick = lastMap(list[0].id);
  if (!list.some((o) => o.id === stage.pick)) stage.pick = list[0].id;
  if (!game.home) { intoRoom(); game.state = 'garage'; game.home = true; }   // (Back from the mode's card: the workshop again behind it)
  $('home').hidden = true; $('menu').hidden = true; $('over').hidden = true; $('dead').hidden = true; $('hint').classList.remove('on');
  $('st-k').textContent = MODE_NAME[m] + ' · Solo'; $('st-t').textContent = list.length > 1 ? PICK_WORD[m] : 'Ready to roll';
  const box = $('st-cards'); box.textContent = '';
  for (const o of list) {
    const b = document.createElement('button'); b.className = 'st-card'; b.dataset.id = o.id;
    b.innerHTML = '<img alt=""><span class="st-best"></span><span class="st-lab"><b></b><small></small></span>';
    if (STAGE_PICS[o.id]) b.querySelector('img').src = STAGE_PICS[o.id];
    b.querySelector('b').textContent = o.name; b.querySelector('small').textContent = TAGS[o.id] || '';
    b.addEventListener('click', () => { if (stage.pick === o.id) { stageGo(); return; } stage.pick = o.id; sfx.play('ui_open', 0.35); drawStages(); });
    box.appendChild(b);
  }
  const row = $('st-levels'); for (const b of row.querySelectorAll('button')) b.remove();
  const L = LEVELS[m]; row.hidden = !L;
  if (L) for (const [id, v] of Object.entries(L.list)) {
    const b = document.createElement('button'); b.dataset.id = id; b.textContent = v.name;
    b.addEventListener('click', () => { setLevel(m, id); sfx.play('ui_open', 0.35); drawStages(); });
    row.appendChild(b);
  }
  drawStages(); $('stages').hidden = false;
}
function hideStages() { $('stages').hidden = true; stage.mode = null; }
function stageGo() {
  const id = stage.pick; if (!id) return;
  try { localStorage.setItem(LAST + stage.mode, id); } catch (e) { /* this visit only */ }
  hideStages(); pickMode(id);
}
$('st-go').addEventListener('click', stageGo);
$('st-back').addEventListener('click', () => { sfx.play('ui_open', 0.4); hideStages(); showHome(); });
addEventListener('keydown', (e) => {
  if (!stage.mode || $('stages').hidden) return;
  const list = STAGES[stage.mode], k = list.findIndex((o) => o.id === stage.pick);
  if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); hideStages(); showHome(); }
  else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) stageGo(); }
  else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD') {
    const d = e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : 1; stage.pick = list[(k + d + list.length) % list.length].id; drawStages();
  } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyW' || e.code === 'KeyS') {
    const L = LEVELS[stage.mode]; if (!L) return; const ids = Object.keys(L.list), j = ids.indexOf(levelOf(stage.mode));
    const n = ids[Math.max(0, Math.min(ids.length - 1, j + (e.code === 'ArrowUp' || e.code === 'KeyW' ? 1 : -1)))]; setLevel(stage.mode, n); drawStages();
  }
}, true);
// a way to play, picked on the home screen (or the stage select): its card (what it is, the controls, Start), on its own map
function pickMode(id) {
  initAudio(); sfx.play('ui_open', 0.7);
  if (id !== MAP.id || game.ended) {
    try { sessionStorage.setItem(BRIEF, playAs); } catch (e) { /* it lands on the home screen again */ }
    $('home').hidden = true; if (window.__adLoad) window.__adLoad.again(((mapById(id) || {}).loading || [])[0]); else { const l = $('loading'); if (l) l.hidden = false; }
    chooseMap(id); return;
  }
  outOfRoom();
  game.home = false; $('home').hidden = true; game.state = 'menu'; $('menu').hidden = false; cardAs(playAs);
}

// ---- the round's menu: Esc, P, or the button under the score ------------------------------------------------------------
// Alone, the round stops while it is up. Online it cannot (the others play on), so it says so and the car coasts.
function stopInput() { for (const k in keys) keys[k] = false; mouse.b0 = mouse.b2 = false; touch.id = null; touch.sx = touch.sy = 0; touch.fire = touch.heavy = touch.drift = false; $('knob').style.transform = ''; for (const b of document.querySelectorAll('.tbtn.down')) b.classList.remove('down'); }
function drawPause() {
  $('pause-t').textContent = net ? 'Round menu' : 'Paused';
  $('pause-note').textContent = net ? 'An online round cannot pause: the others play on, and your car is still out there.' : '';
  $('pause-again').hidden = !!net; $('pause-home').textContent = net ? 'Leave the round' : 'Main menu';
  $('pause-sound').textContent = muted ? 'Sound: off' : 'Sound: on';
  $('pause-auto').textContent = autoFire ? 'Auto-fire: on' : 'Auto-fire: off';
}
function pauseOn() {
  if (game.paused || (game.state !== 'play' && game.state !== 'dead')) return;
  game.paused = true; game.pausedAt = performance.now(); stopInput(); drawPause();
  $('pause').hidden = false; $('dead').classList.add('under'); document.body.classList.add('paused');
  if (!net && audioMix.ctx && audioMix.ctx.suspend) audioMix.ctx.suspend();
  if (document.exitPointerLock) document.exitPointerLock();
}
function pauseOff() {
  if (!game.paused) return;
  game.paused = false; $('pause').hidden = true; $('dead').classList.remove('under'); document.body.classList.remove('paused'); stopInput();
  if (audioMix.ctx && audioMix.ctx.resume) audioMix.ctx.resume();
  if (game.state === 'play') lockMouse(true);
}
// out of a round to the home screen (online: off the round first, and the page loads again without it)
function toHome() {
  pauseOff(); if (document.exitPointerLock) document.exitPointerLock();
  if (net) { net.bye(); const u = new URL(location.href), q = u.searchParams; u.search = ''; for (const k of ['server', 'as', 'touch']) if (q.get(k)) u.searchParams.set(k, q.get(k)); location.href = u.toString(); return; }
  keepSave(save); game.ended = true; showHome();
}

function openGarage(from) {
  if (game.state === 'test' || (game.state === 'garage' && !game.home)) return;
  if (net) return;   // (an online round: the garage is open from the start card before and after it)
  initAudio();
  if (game.home) { game.home = false; $('home').hidden = true; gcam.user = 0; }   // (already in the workshop)
  else { game.stateWas = game.state; game.state = 'garage'; intoRoom(); }
  game.garageFrom = from;
  $('menu').hidden = true; $('dead').hidden = true; $('hint').classList.remove('on');
  document.querySelector('#garage .g-drive').textContent = from === 'home' || game.ended ? 'Done' : 'Drive';
  garage.open();
}
function leaveGarage() {
  garage.close(); keepSave(save);
  tryer.slot = null; bolt = null; game.revT = 0; game.boostT = 0;
  const from = game.garageFrom; game.garageFrom = null;
  if (from === 'home' || game.ended) { showHome(); return; }   // back to the home screen (after a round too: the next one starts from there)
  outOfRoom();
  if (from === 'menu') { game.state = 'menu'; startGame(); return; }
  game.state = 'play';
  if (from === 'break' && mode.afterGarage) mode.afterGarage();
  sfx.play('start', 0.9); lockMouse();
}
// auto: the round started by itself (online, net.js begin), not from a click. The browser only hands the mouse over on a
// click, so the first click on the game takes it (Will's online playtest, 2026-11-24: the refusal had switched the
// mouse lock off for good, and the gun stayed pointing straight ahead)
function startGame(auto) {
  learn.dismiss();   // (online, the round can start while the how-to-play card is still up)
  initAudio(); $('menu').hidden = true; game.state = 'play';
  // phones and tablets: the whole screen for the round, where the browser allows it (a tap on Start counts as asking)
  const root = document.documentElement;
  if (MOBILE && root.requestFullscreen && !document.fullscreenElement) { try { root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (err) { /* not allowed here */ } }
  sfx.play('start', 0.9); setTimeout(() => sfx.play('ui_go', 0.8), 350);
  lockMouse(auto);
  mode.start();
  if (auto && !MOBILE && !TOUCH && !cam.locked) hint('<b>Click</b> to take the mouse and aim');
}
// (soft: straight after Esc the browser may refuse the mouse for a second; that is not "this browser cannot", and the next click on the game takes it)
function lockMouse(soft) { if (soft) cam.softAt = performance.now(); if (canvas.requestPointerLock && !MOBILE) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { if (!soft) cam.noLock = true; }); } catch (err) { if (!soft) cam.noLock = true; } } }

// ---- controls ------------------------------------------------------------------------------------------------------
const keys = {};
const AUTOFIRE = 'auto-destruction-autofire';
let autoFire = true; try { autoFire = localStorage.getItem(AUTOFIRE) !== '0'; } catch (e) { /* on */ }
const cam = { yaw: Math.PI, pitch: 0.3, dist: 36, locked: false, mx: 0, my: 0, cx: 0, cz: 0 };
const mouse = { b0: false, b2: false };
addEventListener('keydown', (e) => {
  if (game.paused) { if ((e.code === 'Escape' || e.code === 'KeyP') && performance.now() - game.pausedAt > 350) pauseOff(); return; }
  if ((e.code === 'Escape' || e.code === 'KeyP') && (game.state === 'play' || game.state === 'dead')) { pauseOn(); return; }
  keys[e.code] = true; initAudio();
  if (e.code === 'KeyM') { muted = !muted; sfx.on = !muted; }
  // the gadget is E (or Q) since 2026-11-25; Shift drifts with Space, so the left hand drifts without leaving W A S D
  if ((e.code === 'KeyE' || e.code === 'KeyQ') && !e.repeat && (game.state === 'play' || game.state === 'test') && player) gadget(player);
  if (e.code === 'KeyG' && game.home) openGarage('home');
  else if (e.code === 'KeyG' && (game.state === 'menu' || (game.state === 'dead' && !game.noGarage) || (game.state === 'play' && mode.garageOK()))) openGarage(game.state === 'play' ? 'break' : game.state);
  else if ((e.code === 'KeyG' || e.code === 'Escape') && game.state === 'garage' && !game.home) leaveGarage();
  else if ((e.code === 'KeyG' || e.code === 'Escape' || e.code === 'KeyT') && game.state === 'test') endTest();
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
document.addEventListener('pointerlockchange', () => {
  const was = cam.locked; cam.locked = document.pointerLockElement === canvas; document.body.classList.toggle('locked', cam.locked);
  if (cam.locked && /take the mouse/.test($('hint').innerHTML)) hint(null);
  if (was && !cam.locked && game.state === 'play') pauseOn();   // Esc with the mouse held by the game: the browser lets go of it, and the round's menu comes up
});
document.addEventListener('pointerlockerror', () => { if (performance.now() - (cam.softAt || -1e9) > 1500) cam.noLock = true; });
document.addEventListener('visibilitychange', () => { if (document.hidden && !net && game.state === 'play' && !window.__hold) pauseOn(); });
addEventListener('mousemove', (e) => {
  if (cam.drag && game.state === 'garage') turnTable(e.clientX - cam.mx);
  cam.mx = e.clientX; cam.my = e.clientY;
  // the aim slows a little over a rival, so it is easier to stay on one
  if (cam.locked) { const f = 1 - 0.35 * (cam.sticky || 0); if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) cam.idle = 0; cam.yaw -= e.movementX * 0.0026 * f; cam.pitch = clamp(cam.pitch + e.movementY * 0.0022 * f, 0.02, 0.75); }   // never down behind the car's back
});
addEventListener('wheel', (e) => { cam.dist = clamp(cam.dist + Math.sign(e.deltaY) * 3, 20, 60); }, { passive: true });
// the mode's how-to-play cards: on its start card, and again from the round's menu (learn.js)
const learn = makeLearn({ $, MAP });
$('go').addEventListener('click', () => {
  if (net) { initAudio(); if (game.state === 'menu' && net.started) startGame(); return; }   // (online the round starts by itself: net.js begin)
  if (game.ended) { try { sessionStorage.setItem(BRIEF, 'solo'); } catch (e) { /* home */ } chooseMap(MAP.id); } else { initAudio(); startGame(); }
});
$('pause-learn').addEventListener('click', () => learn.show());
// the mode's card: its name and map, how to play it (learn.js), and the difficulty
{
  $('brief-t').textContent = MAP.name;
  $('go').textContent = mode.go; $('menu-note').textContent = mode.tip || '';
  // (the map and the difficulty are picked on the stage select before the map loads: showStages. The card says which.)
}
let lobby = null;
$('over-go').addEventListener('click', () => { if (net && net.quick) playAgain(); else if (net) { net.bye(); location.href = net.lobby(); } else chooseMap(MAP.id); });
$('over-more').addEventListener('click', overGo);
$('over-maps').addEventListener('click', () => { if (net) toHome(); else { game.ended = true; showHome(); } });
$('pause-b').addEventListener('click', pauseOn);
$('pause-go').addEventListener('click', pauseOff);
$('pause-again').addEventListener('click', () => { pauseOff(); try { sessionStorage.setItem(BRIEF, 'solo'); } catch (e) { /* home */ } chooseMap(MAP.id); });
$('pause-sound').addEventListener('click', () => { muted = !muted; sfx.on = !muted; audioMix.on = !muted; drawPause(); });
$('pause-auto').addEventListener('click', () => { autoFire = !autoFire; try { localStorage.setItem(AUTOFIRE, autoFire ? '1' : '0'); } catch (e) { /* this visit only */ } drawPause(); });
$('pause-home').addEventListener('click', toHome);
$('over-garage').addEventListener('click', () => { $('over').hidden = true; game.ended = true; openGarage('over'); });
$('menu-home').addEventListener('click', () => { if (game.state !== 'menu') return; if (document.body.classList.contains('as-solo') && STAGES[MAP.mode]) showStages(MAP.mode); else showHome(); });
// online (net.js): in a round, the start card is a Ready button for it; otherwise it has the lobby (Play online, With friends)
if (net) {
  document.body.classList.add('online');
  $('brief-k').textContent = ({ waves: 'Waves', race: 'Race', survival: 'Zombie Survival', brawl: 'Arena' }[MAP.mode] || MAP.mode) + ' · Online';
  for (const id of ['menu-home', 'over-garage']) $(id).hidden = true;
  // no Ready button: the map is built, so this page is ready (main.js's end), and the round starts by itself when the
  // countdown is out and everyone has loaded. The card shows how to play meanwhile, and how long is left.
  $('go').disabled = true; $('go').textContent = 'Loading...'; $('menu-note').textContent = 'Joining the round...';
  $('over-go').textContent = net.quick ? 'Play again' : 'Back to the lobby';
  setInterval(() => {
    if (game.state !== 'menu') return;
    const s = net.startIn();
    $('go').textContent = net.started ? 'Starting...' : s > 0.5 ? `Starting in ${Math.ceil(s)}` : net.ready ? 'Waiting for the others...' : 'Loading...';
  }, 250);
} else {
  lobby = makeLobby({ $, MAP, onOpen: () => { $('menu').classList.add('lobby-on'); }, onShut: () => { $('menu').classList.remove('lobby-on'); },
    onQuick: () => { const l = $('loading'); if (window.__adLoad) window.__adLoad.again('Finding a round'); else if (l) l.hidden = false; $('menu').hidden = true; },
    onFail: () => { const l = $('loading'); if (l) l.hidden = true; $('menu').hidden = false; } });
  window.__lobby = lobby;
}
$('dead-garage').addEventListener('click', () => openGarage('dead'));
$('dead-go').addEventListener('click', () => { if (game.state === 'dead') game.deadT = 0; });
// touch: drag to turn the car in the garage
canvas.addEventListener('touchstart', (e) => { if (game.state === 'garage' && e.touches[0]) { cam.drag = true; cam.mx = e.touches[0].clientX; } }, { passive: true });
canvas.addEventListener('touchmove', (e) => { if (cam.drag && game.state === 'garage' && e.touches[0]) { turnTable(e.touches[0].clientX - cam.mx); cam.mx = e.touches[0].clientX; } }, { passive: true });
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
$('t-boost').addEventListener('touchstart', (e) => { e.preventDefault(); initAudio(); if ((game.state === 'play' || game.state === 'test') && player) gadget(player); }, { passive: false });

function drivePlayer(dt) {
  const c = player; if (!c || c.dead) return;
  const k = (a, b) => keys[a] || keys[b];
  c.throttle = (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0);
  c.steer = (k('KeyA', 'ArrowLeft') ? 1 : 0) - (k('KeyD', 'ArrowRight') ? 1 : 0);
  c.drift = !!(keys.Space || keys.ShiftLeft || keys.ShiftRight) || touch.drift; c.brake = 0;   // the handbrake: a drift when steering, a brake when not (vehicle.js)
  // the stick: the car turns to the way it is pushed (up the screen is straight ahead) and goes; pulled back, it reverses
  const m = Math.hypot(touch.sx, touch.sy);
  if (touch.id !== null && m > 0.2) {
    const want = cam.yaw - Math.atan2(touch.sx, touch.sy), off = wrap(want - c.yaw);
    if (Math.abs(off) < 2.3) { c.throttle = clamp(m * 1.3, 0, 1); c.steer = clamp(off * 2.2, -1, 1); }
    else { c.throttle = -clamp(m * 1.3, 0, 1); c.steer = 0; }
    // drifting (Drift held and the back out): the stick steers left and right, the way it is pushed across the screen,
    // rather than pointing the car. Pointing it, the car would swing round to the stick, straighten up and end the
    // slide, so a long drift (and its bigger boost, DRIFT.boost) meant winding the stick round with the car.
    if (touch.drift && c.slide > 0.3 && touch.sy > -0.5) { c.throttle = clamp(m * 1.3, 0, 1); c.steer = clamp(-touch.sx / 0.45, -1, 1); }
  }
  // a brake, not reverse, while still rolling forwards fast
  if (c.throttle < 0 && c.fwd > 12) { c.brake = 1; c.throttle = -0.2; }
  // auto-fire (PC, a switch on the pause menu, on unless turned off): the guns fire by themselves while the crosshair is
  // on a rival (aimLock, aimFor), so drifting and steering never mean letting go of the trigger. The heavy weapons stay
  // on the right click.
  const auto = autoFire && !TOUCH && aimLock && !aimLock.dead;
  guns(c, dt, [mouse.b0 || keys.KeyJ || touch.fire || auto, mouse.b2 || keys.KeyF || keys.KeyK || touch.heavy]);
}

// ---- camera and aiming -----------------------------------------------------------------------------------------
const ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _o = new THREE.Vector3(), _dir = new THREE.Vector3(), _tgt = new THREE.Vector3();
function aimRay() {
  // through the middle of the screen when the mouse is captured, else through the pointer
  // (the crosshair sits a little above the middle, clear of the car; on a touch screen it stays there too)
  if (cam.locked || !cam.mx || TOUCH) _ndc.set(0, 0.2);
  else _ndc.set(cam.mx / canvas.clientWidth * 2 - 1, -(cam.my / canvas.clientHeight * 2 - 1));
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
// get there), more the nearer the crosshair is. With touch, the guns lock on to a rival only while it is on the screen
// (in front of the camera, inside the picture, with a clear line from the car): never one behind you or off to the side
// that you can't see. It finds one by itself only in the middle of the picture (`zone`, of the screen's half-width,
// round the crosshair), the one nearest the crosshair (a near one before a far one), held on to for a moment; a tap
// on one anywhere on the screen picks it, and the guns stay on it while it stays on screen (`edge`). The locked one
// wears the crosshair. On touch the guns swing round at `turn` radians a second (about a rival's), not the mouse's
// near-instant 10, so a new target takes a moment to come onto.
const AIM = { pull: 0.85, margin: 0.06, range: 330, edge: 0.88, zone: 0.6, tap: 70, turn: 3.5 };
const _tc = new THREE.Vector3(), _ts = new THREE.Vector3();
let autoT = null, autoKeep = 0, aimLock = null, picked = null;
function leadOn(o, from, out) { const t = Math.hypot(o.x - from.x, o.z - from.z) / 360; o.centre(out); out.x += o.vx * t; out.z += o.vz * t; out.y = 2.4; return out; }
const aimables = () => (game.state !== 'test' && mode.targets ? mode.targets() : cars);   // (a mode can give other things to aim at: survival's zombies)
// whether o is in the picture, or with `mid` in the middle of it round the crosshair (leaves where on the screen in _ts)
function onScreen(o, c, mid) {
  leadOn(o, c, _tc); if (camera.position.distanceTo(_tc) > AIM.range) return false;
  _ts.copy(_tc).project(camera);
  if (!(_ts.z < 1 && Math.abs(_ts.x) < AIM.edge && Math.abs(_ts.y) < AIM.edge)) return false;
  return !mid || (Math.abs(_ts.x) < AIM.zone && Math.abs(_ts.y - 0.2) < AIM.zone);
}
function autoTarget(c, dt) {
  autoKeep -= dt;
  const ok = (o, mid) => o && o !== c && !o.dead && !o.gone && Math.hypot(o.x - c.x, o.z - c.z) < 240 && onScreen(o, c, mid) && clearLine(c.x, c.z, o.x, o.z, 4);
  if (picked && !ok(picked)) picked = null;
  if (picked) return picked;
  if (autoT && autoKeep > 0 && ok(autoT)) return autoT;   // (one already locked can drift out of the middle for a moment)
  let best = null, bs = 1e9;
  for (const o of aimables()) {
    if (!ok(o, true)) continue;
    const d = Math.hypot(o.x - c.x, o.z - c.z), r = Math.hypot(_ts.x * camera.aspect, _ts.y - 0.2);
    const score = (r + 0.25) * (d + 60) * (o === autoT ? 0.7 : 1);
    if (score < bs) { bs = score; best = o; }
  }
  autoT = best; autoKeep = 0.6;
  return best;
}
// a tap on the picture (not on the stick or the buttons) picks the target nearest it, if one is close enough to the tap
canvas.addEventListener('touchstart', (e) => {
  const c = player, t = e.changedTouches[0];
  if (!TOUCH || !t || !c || c.dead || (game.state !== 'play' && game.state !== 'test')) return;
  const W = canvas.clientWidth, H = canvas.clientHeight; let best = null, bd = AIM.tap;
  for (const o of aimables()) {
    if (o === c || o.dead || o.gone || !onScreen(o, c)) continue;
    const dd = Math.hypot((_ts.x * 0.5 + 0.5) * W - t.clientX, (-_ts.y * 0.5 + 0.5) * H - t.clientY);
    if (dd < bd && clearLine(c.x, c.z, o.x, o.z, 4)) { bd = dd; best = o; }
  }
  if (best) { picked = autoT = best; autoKeep = 0.6; }
}, { passive: true });
function aimFor(c, dt) {
  const p = aimRay();
  let best = null, k = 0;
  c.turretTurn = TOUCH ? AIM.turn : 10;
  if (TOUCH) { best = autoTarget(c, dt); k = best ? 1 : 0; }
  else {
    const tan = Math.tan(camera.fov * Math.PI / 360);
    for (const o of aimables()) {
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
function stepCamera(dt) {
  const c = player; if (!c) return;
  if (game.state === 'garage') { garageCamera(dt); return; }
  // in a drift it swings round a little towards where the car is going, and keeps up with the car's quicker turn
  const want = c.yaw + c.slipA * c.slide * DRIFT.camSwing, pitch0 = tall ? 0.4 : 0.3;
  if (!cam.locked) {   // follow the car round its turns
    cam.yaw += wrap(want - cam.yaw) * Math.min(1, dt * (2.6 + DRIFT.camFollow * c.slide));
    cam.pitch += (pitch0 - cam.pitch) * Math.min(1, dt * 2);   // up behind the car, so the road ahead shows over its roof
  } else {
    // smart follow (Will, 2026-11-25: with the mouse on the camera, it never turned with the car, so in a drift the view
    // stayed put and the corner was out of sight). The mouse's look is kept as a turn off the car's way: the view turns
    // with the car, and a moment after the mouse goes still it eases back behind it. In a slide it looks further into
    // the way the car is going, to see round the corner.
    const head = want + c.slipA * c.slide * CAM.driftLook;
    if (cam.head === undefined) cam.head = head;
    const turn = wrap(head - cam.head); cam.head = head;
    cam.yaw += clamp(turn, -CAM.carry * dt, CAM.carry * dt);   // (a spin after a hit doesn't whip the view round with it)
    cam.idle = (cam.idle || 0) + dt;
    const back = c.slide > 0.3 ? CAM.driftWait : CAM.wait;
    if (cam.idle > back && !c.dead) {
      const k = Math.min(1, (cam.idle - back) / CAM.ramp);   // (it starts slowly, so a short pause doesn't snap the aim)
      cam.yaw += wrap(head - cam.yaw) * Math.min(1, dt * CAM.rate * k * (1 + c.slide));
      cam.pitch += (pitch0 - cam.pitch) * Math.min(1, dt * CAM.rate * 0.6 * k);
    }
  }
  cam.cx += (c.x - cam.cx) * Math.min(1, dt * 12); cam.cz += (c.z - cam.cz) * Math.min(1, dt * 12);
  const dist = cam.dist * (tall ? 1.2 : 1) * (1 + clamp(Math.abs(c.fwd) / 300, 0, 0.25));
  cam.cy = cam.cy === undefined ? c.h : cam.cy + (c.h - cam.cy) * Math.min(1, dt * 9);   // (the road's height, and a jump's)
  _tgt.set(cam.cx, 7.5 + (c.fy === undefined ? 0 : cam.cy - Math.max(0, c.y || 0) * 0.6), cam.cz);
  // how far back the camera can sit before a wall; lamps, props and rubble don't count (it looks past them)
  const room = (pitch) => {
    const bx = -Math.sin(cam.yaw) * Math.cos(pitch), by = Math.sin(pitch) + 0.15, bz = -Math.cos(cam.yaw) * Math.cos(pitch);
    for (let t = 4; t < dist; t += 1.5) {
      const i = idx(Math.floor(_tgt.x + bx * t), Math.floor(_tgt.y + by * t), Math.floor(_tgt.z + bz * t));
      if (!solid(Math.floor(_tgt.x + bx * t), Math.floor(_tgt.y + by * t), Math.floor(_tgt.z + bz * t))) continue;
      const b = bodies[ownerAt(i)]; if (b && (b.kind === 'prop' || b.kind === 'rubble' || b.see)) continue;   // (b.see: something the map lets it look through, maps/empire.js)
      return Math.max(7, t - 2);
    }
    return dist;
  };
  // a wall behind: rise and look down over it rather than close in on the car, which would hide the road ahead. Backed
  // up to a tall wall, the last tries go up nearly over the car's roof, so the camera never sits inside the wall.
  let pitch = cam.pitch, dd = room(pitch);
  // under a map's roof (a tunnel, a hall: MAP.roofs, [{ x0, z0, x1, z1, y }]) it never climbs: it would go up into it
  const under = (x, z) => { if (MAP.roofs) for (const r of MAP.roofs) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1 && c.h < r.y - 4) return r.y; return Infinity; };   // (a car on the deck over a road is over that roof, not under it)
  const roofY = under(_tgt.x, _tgt.z);
  if (dd < dist && roofY === Infinity) for (const up of [0.2, 0.45, 0.7, 0.95, 1.15]) { const p2 = Math.min(1.45, cam.pitch + up), d2 = room(p2); if (d2 > dd + 2) { pitch = p2; dd = d2; } if (d2 >= dist * 0.85) break; }
  cam.p = cam.p === undefined ? pitch : cam.p + (pitch - cam.p) * Math.min(1, dt * 5);
  const bx = -Math.sin(cam.yaw) * Math.cos(cam.p), by_ = Math.sin(cam.p) + 0.15, bz = -Math.cos(cam.yaw) * Math.cos(cam.p);
  cam.d = cam.d === undefined ? dd : cam.d + (dd - cam.d) * Math.min(1, dt * (dd < cam.d ? 14 : 3));
  camera.position.set(_tgt.x + bx * cam.d, Math.max((MAP.floor ? MAP.floor(_tgt.x + bx * cam.d, _tgt.z + bz * cam.d, _tgt.y) : 0) + 2.5, _tgt.y + by_ * cam.d), _tgt.z + bz * cam.d);
  // (it comes down under a roof over a moment, not at once; and never below the road where it is: coming down a ramp to
  // a tunnel's mouth it is still up the ramp behind the car)
  { const ry = Math.min(roofY, under(camera.position.x, camera.position.z)), want = ry === Infinity ? 0 : Math.max(0, camera.position.y - (ry - 2.5));
    cam.duck = (cam.duck || 0) + (want - (cam.duck || 0)) * Math.min(1, dt * (want > (cam.duck || 0) ? 6 : 3));
    if (cam.duck > 0.01) camera.position.y = Math.max(camera.position.y - cam.duck, (MAP.floor ? MAP.floor(camera.position.x, camera.position.z, _tgt.y) : 0) + 1.5); }
  const sh = game.shake; if (sh > 0) camera.position.add(_o.set((Math.random() - 0.5) * sh * 1.6, (Math.random() - 0.5) * sh * 1.2, (Math.random() - 0.5) * sh * 1.6));
  // a map's view (MAP.vista(x, z) -> 0 to 1): it looks up from the road, at something tall ahead (maps/empire.js: the statue)
  { const v = MAP.vista ? MAP.vista(c.x, c.z) * (cam.locked ? 0.7 : 1) : 0;   // (less with the mouse on the camera: it can look up itself)
    cam.vista = (cam.vista || 0) + (v - (cam.vista || 0)) * Math.min(1, dt * 1.4); }
  camera.lookAt(_tgt.x + Math.sin(cam.yaw) * 16, _tgt.y - 0.5 + cam.vista * (tall ? 10 : 13), _tgt.z + Math.cos(cam.yaw) * 16);
  // a drift boost widens the view for a moment (it springs out, then eases back as the burst runs out)
  const fk = c.miniT > 0 ? (cam.fovKick || 0) * Math.min(1, c.miniT / 0.6) : 0;
  cam.fov = (cam.fov || 0) + (fk - (cam.fov || 0)) * Math.min(1, dt * (fk > (cam.fov || 0) ? 14 : 3));
  const fov = baseFov + cam.fov;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
  if (!c.dead) aimFor(c, dt);
  const ch = $('cross');
  if (TOUCH && aimLock) { _ts.copy(c.aim).project(camera); ch.style.left = `${(_ts.x * 0.5 + 0.5) * canvas.clientWidth}px`; ch.style.top = `${(-_ts.y * 0.5 + 0.5) * canvas.clientHeight}px`; }
  else if (cam.locked || !cam.mx || TOUCH) { ch.style.left = '50%'; ch.style.top = `${(0.5 - 0.1) * 100}%`; } else { ch.style.left = cam.mx + 'px'; ch.style.top = cam.my + 'px'; }
  ch.classList.toggle('on', c.onTarget(0.08)); ch.classList.toggle('lock', !!aimLock);
}

// ---- the frame -----------------------------------------------------------------------------------------------------
let tall = false, baseFov = 64;   // a phone held upright: a wider view, from further back and higher up, so the road ahead still shows
let sizeW = 0, sizeH = 0;
function resize() {
  const w = innerWidth, h = innerHeight; sizeW = w; sizeH = h;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  tall = w / h < 0.9; baseFov = camera.fov = tall ? 76 : 64;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const ph = h * renderer.getPixelRatio(); setParticleScale(ph, camera.fov); fx.setScale(ph, camera.fov);
}
addEventListener('resize', resize); resize();
// iPads and iPhones can fire 'resize' on a turn before the new size is in, leaving the view at the old shape:
// check again after a turn, and on any frame where the window's size no longer matches the view's
addEventListener('orientationchange', () => { for (const t of [100, 300, 700]) setTimeout(resize, t); });
if (window.visualViewport) visualViewport.addEventListener('resize', resize);
const quality = makeQuality({ renderer, composer, bloom: bloomPass, scene, camera, sun, resize, playing: () => game.state === 'play' || game.state === 'test', mobile: MOBILE, lodK: MAP.lodK });
// the rest of a map's look (looks/): its beams, glows, lamps, weather and the rest
const lookFrom = scene.children.length;
const mapLook = MAP.look ? makeLook(MAP.look, { scene, renderer, camera, sky, hemi, sun, mats, bloom: bloomPass, quality, backdrop, sfx, setup: LOOK }) : null;
const lookObjs = scene.children.slice(lookFrom);   // the look's own draws (the storm's rain, mist and beams): put away in the garage
// how the game runs on this device, for the server's /host page (report.js; ?perf=1 shows it on screen too)
const reports = startReports({ game, quality, renderer, MAP, cars, online: () => !!net });
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  if (innerWidth !== sizeW || innerHeight !== sizeH) resize();
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (window.__hold) return;   // tests step the game by hand (window.__derby.step)
  const a = performance.now();
  step(dt);
  const b = performance.now();
  quality.judge(now); placeSky(); quality.draw();
  reports.frame(now, b - a, performance.now() - b);
}
// Online, a hidden tab gets no frames: the host's bots (and horde) would stand still for everyone. So while the page is
// hidden in an online round, a worker's clock steps the game (without drawing it); a worker's timer is not slowed the way
// the page's own are.
if (net) {
  let at = 0;
  try {
    const w = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 50)'], { type: 'text/javascript' })));
    w.onmessage = () => { const now = performance.now(); if (!document.hidden || window.__hold) { at = now; return; } const dt = Math.min(0.1, (now - (at || now)) / 1000); at = now; if (dt > 0) step(dt); };
  } catch (e) { /* no workers: a hidden host just waits */ }
}
function step(dt) {
  if (game.paused && (game.state !== 'play' && game.state !== 'dead')) pauseOff();   // (the round ended under the menu)
  document.body.classList.toggle('in-round', game.state === 'play' || game.state === 'dead');
  if (game.paused && !net) { if (TOUCH) $('touch').hidden = true; return; }   // alone, the round waits
  game.time += dt; newFrame();
  const live = game.state === 'play' || game.state === 'dead' || game.state === 'over', test = game.state === 'test';
  if (MAP.step) MAP.step(dt);
  if (net) net.step(dt);
  if (live || test) {
    drivePlayer(dt);
    // (a test drive moves only the player and the target cars in the yard; the round waits)
    const on = (c) => !c.gone && (live || c === player || c.dummy);
    if (live) for (const c of cars) if (c.driver) { c.driver.think(dt, cars, player); guns(c, dt, c.dead ? [] : c.fire || []); if (c.useGadget) gadget(c); } else if (c.remote) guns(c, dt, c.dead ? [] : c.want);
    for (const c of cars) if (on(c) && c.remote) { c.hurtT -= dt; if (c.dead) c.deadT += dt; net.drive(c, dt); stepGadget(c, dt); saws(c, dt); blades(c, dt); specials.exhaust(c, dt); }
    for (const c of cars) if (on(c) && !c.remote) { c.hurtT -= dt; if (c.dead) c.deadT += dt; stepGadget(c, dt); c.step(dt, crashHooks); parked(c, dt); saws(c, dt); blades(c, dt); specials.exhaust(c, dt); }
    stepMines(dt); stepBolts(dt); drifts.step(dt, cars, player);
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) if (on(cars[i]) && on(cars[j])) bump(cars[i], cars[j]);
    // wrecks lie a while, then crumble away (the target cars come back on their own: stepDummies)
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i]; if (c.dummy || !on(c)) continue;
      if (c.dead && !c.gone && c.deadT > ROUND.wreckStays) { c.unit.burst(cube, null, 6, 0.2); c.gone = true; }
      if (c.gone && c !== player) { if (net) net.forget(c); c.dispose(); if (c.tag) c.tag.remove(); cars.splice(i, 1); }
    }
    if (test) stepTest(dt);
    if (game.state === 'dead') {
      game.deadT -= dt; $('dead-t').textContent = Math.max(0, Math.ceil(game.deadT));
      if (game.deadT <= 0) { $('dead').hidden = true; game.state = 'play'; spawnPlayer(); }
    }
    if (live) mode.step(dt);
    if ((savedT += dt) > 15) { savedT = 0; keepSave(save); }
  }
  if (game.state === 'garage' || test) stepDummies(dt);
  if (game.state === 'garage') { stepTry(dt); if (player) specials.hop(player, dt); }
  if (lightWas) room.step(dt);   // (the workshop at work: sparks, fans, the hoist)
  specials.step(dt);
  crumple.step(dt, cars);
  for (const c of cars) if (c.flameT > 0) c.flameT -= dt;
  if (!lightWas) { pickups.step(dt, live); hazards.step(dt, live); }   // (the map's pickups and hazards wait while the garage is open: their walls would shove the cars in the yard)
  for (const c of cars) if (!c.gone) { if (!c.dead) c.point(dt); c.pose(dt); }
  stepBolt(dt);   // (after the cars' poses: a part dropping on in the garage, the car settling on its springs)
  stepCamera(dt);
  if (backdrop) backdrop.step(dt, quality.step);
  const fc = player || MAP.spawn;
  setFocus(fc.x, fc.z); followSun(fc.x, fc.z);
  stepSim(dt);
  civ.update(dt, false); civ.packFar && civ.packFar();
  fx.update(dt); debris.update(dt);
  dirt.step(dt, cars, quality.step);
  if (streaks) streaks.step(dt, game.state === 'play' ? player : null, quality.step, renderer.domElement);
  if (mapLook && !lightWas) mapLook.step(dt, cars);   // (the map's weather and show wait while the garage is open)
  game.shake = Math.max(0, game.shake - dt * 2.4);
  game.hurt = Math.max(0, (game.hurt || 0) - dt * 1.4); grade.uniforms.hurt.value = game.hurt;
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').classList.remove('on');
  if (game.banner > 0 && (game.banner -= dt) <= 0) $('banner').classList.remove('on');
  // the engines and the tyres
  if (engine && player) {
    const sp = Math.abs(player.fwd), on = !muted && (live || test || game.state === 'garage') && !player.dead, k = clamp(sp / player.spec.top, 0, 1.4);
    sfx.listen(player.x, player.z, cam.yaw);
    const rev = game.revT > 0 ? Math.sin(Math.min(1, game.revT / 1.4) * Math.PI) : 0;   // an engine tried in the garage: a rev
    const E = PARTS.engine[player.load.engine] || {};
    engine.jet.set(on && E.whine ? 0.22 + 0.3 * Math.max(Math.abs(player.throttle), rev) : 0, 1.3 + k * 0.9 + rev * 0.8, player.x, player.z);
    road.step(dt, player, cars, on && game.state !== 'garage');   // the tyres, scrapes, wind and the rest (roadsound.js)
    const near = live ? cars.filter((c) => c.rival && !c.dead).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z)) : [];
    // the minigun's barrels, the saws' motor and the arc coil's hum, on the player's car
    const bv = player.barrelV || 0, arcG = player.guns.find((G) => G.g.arc);
    engine.spin.set(on && bv > 1 ? clamp(bv / 30, 0, 1) * 0.8 : 0, 0.45 + bv / 30 * 0.8, player.x, player.z);
    engine.saw.set(on && (player.spec.saw || (player.spec.blade && player.load.door === 'blades')) ? 0.35 + clamp(player.speed / 80, 0, 0.3) : 0, 1, player.x, player.z);
    engine.hum.set(on && arcG ? (arcG.t <= 0 ? 0.35 : 0.12) : 0, arcG && arcG.t <= 0 ? 1 : 0.8, player.x, player.z);
    // a flamethrower going: the player's, or else the nearest one
    const fl = player.flameT > 0 && !player.dead ? player : cars.filter((c) => c.flameT > 0 && !c.dead).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
    engine.flame.set(!muted && fl ? (fl === player ? 0.8 : 0.6) : 0, fl === player ? 1 : 0.92, fl ? fl.x : player.x, fl ? fl.z : player.z);
    engine.note.step(dt, player, near, on, rev);   // the engines' note, through the gears (enginesound.js)
  }
  document.body.classList.toggle('in-garage', game.state === 'garage');
  document.body.classList.toggle('at-home', !!game.home);
  document.body.classList.toggle('in-test', game.state === 'test');
  if (TOUCH) $('touch').hidden = (game.state !== 'play' && game.state !== 'test') || !!game.paused;
  drawHud(); drawTags(); drawRadar();
}
$('hint').addEventListener('click', () => { if (/take the mouse/.test($('hint').innerHTML)) { lockMouse(true); return; } if (game.state === 'play' && mode.garageOK()) openGarage('break'); else if (game.state === 'play' && mode.resetPlayer) mode.resetPlayer(); });
spawnPlayer();
followSun(player.x, player.z);
// the loading screen (page.html) stays until the sounds are in too (or a few seconds more), then goes once a frame is drawn
fetchClips();
if (window.__adLoad) window.__adLoad.built(() => sfxCount); else { const l = $('loading'); if (l) l.hidden = true; }
// online: the map is built, so this page is ready for the round (it starts by itself: net.js)
if (net) net.ready_();
// the home screen first; a mode's card instead when one was just picked, in an online round, or on a link into a room
{
  let brief = ''; try { brief = sessionStorage.getItem(BRIEF) || ''; sessionStorage.removeItem(BRIEF); } catch (e) { /* home */ }
  // (?online=quick, the old way back from a quick round, is the one tap now)
  const quickLink = !net && /[?&]online=quick/.test(location.search) && lobby && MAPS.some((m) => m.id === MAP.id);
  if (!net) cardAs(/[?&]room=/.test(location.search) ? 'friends' : brief === 'online' || brief === 'friends' ? brief : brief ? 'solo' : 'both');
  if (quickLink) goOnline(MAP.id);
  else if (net || brief || /[?&](room|online|map)=/.test(location.search)) $('menu').hidden = false; else showHome();
}
requestAnimationFrame((t) => { last = t; frame(t); });
window.__derby = { art, STARTER, net, specials, crumple, cube, room, gcam, garageLight, startTest, endTest, tryPart: (s, k) => onTry(s, k), dummies, renderer, mapLook, touch, aim: () => ({ lock: aimLock, sticky: cam.sticky, TOUCH, picked }), useTouch, step, render: () => { placeSky(); quality.draw(); }, quality, cars, game, player: () => player, fx, civ, blast, explode, world, stats, camera, keys, mouse, cam, MAP, mode, chooseMap, api, extras, damage, save, garage, openGarage, leaveGarage, startGame, pauseOn, pauseOff, toHome, setPlay, sfx, audioMix, mines, gadget, spawnPlayer, addCar, pickups, hazards, backdrop, keep, road, engine: () => engine };
