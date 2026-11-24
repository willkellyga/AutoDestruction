// The game's own recorded sounds, cut from the Sonniss GDC game audio bundle (royalty free, no credit needed; see
// derby/assets/sfx/CREDITS.md): crunches and scrapes for crashes, metal pings for bullets on cars, the blasts when a
// car goes up, a real engine and tyre skid on loops, nitro, the garage's clicks and the announcer, and every weapon's
// own sounds (the library has no gunfire, so the guns are layered from shots, fireworks, booms and metal foley).
// They play on Monster Mayhem's audio context (src/sfx.js), beside its own clips (buildings coming down), through
// a bus and compressor of their own. Sounds in the street are placed: quieter with distance and panned left or right
// of the camera. A clip named <base>_<n> is another take of <base>: play('<base>') picks one of them at random.
import { bytes } from './sfxfiles.js';
import crunch from '../assets/sfx/crunch.mp3';
import crunch_heavy from '../assets/sfx/crunch_heavy.mp3';
import tink from '../assets/sfx/tink.mp3';
import scrape from '../assets/sfx/scrape.mp3';
import carboom from '../assets/sfx/carboom.mp3';
import bigboom from '../assets/sfx/bigboom.mp3';
import nitro from '../assets/sfx/nitro.mp3';
import servo from '../assets/sfx/servo.mp3';
import start from '../assets/sfx/start.mp3';
import door from '../assets/sfx/door.mp3';
import ui_click from '../assets/sfx/ui_click.mp3';
import ui_coin from '../assets/sfx/ui_coin.mp3';
import ui_equip from '../assets/sfx/ui_equip.mp3';
import ui_go from '../assets/sfx/ui_go.mp3';
import ui_open from '../assets/sfx/ui_open.mp3';
import ui_tab from '../assets/sfx/ui_tab.mp3';
import vo_clear from '../assets/sfx/vo_clear.mp3';
import vo_rampage from '../assets/sfx/vo_rampage.mp3';
import engine_loop from '../assets/sfx/engine_loop.wav';
import skid_loop from '../assets/sfx/skid_loop.wav';
// the weapons
import mg_shot from '../assets/sfx/mg_shot.mp3';
import mg_shot_2 from '../assets/sfx/mg_shot_2.mp3';
import mg_shot_3 from '../assets/sfx/mg_shot_3.mp3';
import mini_shot from '../assets/sfx/mini_shot.mp3';
import mini_shot_2 from '../assets/sfx/mini_shot_2.mp3';
import twin_shot from '../assets/sfx/twin_shot.mp3';
import twin_shot_2 from '../assets/sfx/twin_shot_2.mp3';
import scatter_shot from '../assets/sfx/scatter_shot.mp3';
import pump from '../assets/sfx/pump.mp3';
import cannon_shot from '../assets/sfx/cannon_shot.mp3';
import rocket_launch from '../assets/sfx/rocket_launch.mp3';
import rocket_boom from '../assets/sfx/rocket_boom.mp3';
import rocket_boom_2 from '../assets/sfx/rocket_boom_2.mp3';
import mine_drop from '../assets/sfx/mine_drop.mp3';
import mine_beep from '../assets/sfx/mine_beep.mp3';
import grind from '../assets/sfx/grind.mp3';
import reload from '../assets/sfx/reload.mp3';
import brass from '../assets/sfx/brass.mp3';
import tink_2 from '../assets/sfx/tink_2.mp3';
import tink_3 from '../assets/sfx/tink_3.mp3';
import arc_zap from '../assets/sfx/arc_zap.mp3';
import crack from '../assets/sfx/crack.mp3';
import mini_spin from '../assets/sfx/mini_spin.wav';
import saw_loop from '../assets/sfx/saw_loop.wav';
import arc_hum from '../assets/sfx/arc_hum.wav';
import flame_loop from '../assets/sfx/flame_loop.wav';
// the road (roadsound.js): tyres squealing on tarmac, metal grinding along a wall or another car, the wind at speed, a
// badly hurt engine, knocks between cars, more takes of the crashes, coming down from a jump, bits falling off, a car
// rushing past
import squeal_loop from '../assets/sfx/squeal_loop.wav';
import scrape_loop from '../assets/sfx/scrape_loop.wav';
import wind_loop from '../assets/sfx/wind_loop.wav';
import hiss_loop from '../assets/sfx/hiss_loop.wav';
import bump from '../assets/sfx/bump.mp3';
import bump_2 from '../assets/sfx/bump_2.mp3';
import bump_3 from '../assets/sfx/bump_3.mp3';
import crunch_2 from '../assets/sfx/crunch_2.mp3';
import crunch_heavy_2 from '../assets/sfx/crunch_heavy_2.mp3';
import land from '../assets/sfx/land.mp3';
import debris from '../assets/sfx/debris.mp3';
import whoosh from '../assets/sfx/whoosh.mp3';
import whoosh_2 from '../assets/sfx/whoosh_2.mp3';

const CLIPS = { crunch, crunch_heavy, tink, scrape, carboom, bigboom, nitro, servo, start, door, ui_click, ui_coin, ui_equip, ui_go, ui_open, ui_tab, vo_clear, vo_rampage, engine_loop, skid_loop,
  mg_shot, mg_shot_2, mg_shot_3, mini_shot, mini_shot_2, twin_shot, twin_shot_2, scatter_shot, pump, cannon_shot, rocket_launch, rocket_boom, rocket_boom_2, mine_drop, mine_beep, grind, reload, brass, tink_2, tink_3, arc_zap, crack, mini_spin, saw_loop, arc_hum, flame_loop,
  squeal_loop, scrape_loop, wind_loop, hiss_loop, bump, bump_2, bump_3, crunch_2, crunch_heavy_2, land, debris, whoosh, whoosh_2 };
// how loud each clip is against the others. The first ones were levelled by ear. The weapons were set by measured
// loudness (A-weighted, loudest 300 ms; loops over the loop) against the engine at full throttle (about -25 dBA here):
// cannon -19, carboom -20, rocket hit and scattergun -22, rocket launch and arc zap -22, machine gun -25 a round
// (about -22 in a burst), minigun -27, light guns -28, rounds hitting a car (all three tinks) -29. The crunches, carboom,
// tink and door were cut about 20 dB too quiet; their files are now raised to peak at -1 dB like the rest.
const LEVEL = { crunch: 0.8, crunch_heavy: 0.9, tink: 0.42, scrape: 0.5, carboom: 1, bigboom: 0.8, nitro: 0.55, servo: 0.5, start: 0.6, door: 0.6, ui_click: 0.35, ui_coin: 0.5, ui_equip: 0.4, ui_go: 0.5, ui_open: 0.45, ui_tab: 0.35, vo_clear: 0.8, vo_rampage: 0.8, engine_loop: 1, skid_loop: 1,
  mg_shot: 0.6, mg_shot_2: 0.62, mg_shot_3: 0.67, mini_shot: 0.45, mini_shot_2: 0.44, twin_shot: 0.47, twin_shot_2: 0.48, scatter_shot: 0.53, pump: 0.66, cannon_shot: 1.2, rocket_launch: 0.65, rocket_boom: 0.89, rocket_boom_2: 0.84, mine_drop: 0.6, mine_beep: 0.083, grind: 0.27, reload: 0.62, brass: 1.2, tink_2: 0.38, tink_3: 0.36, arc_zap: 0.78, crack: 0.6, mini_spin: 0.27, saw_loop: 0.82, arc_hum: 0.83, flame_loop: 0.7,
  // the road's, set against the same loudest-300 ms measure (the engine loop about -23 dB, the gravel skid -16.5 at 1):
  // squeal -12.7, scrape -16.6, wind -13, hiss -13.7, knocks -21 (bump) and -27.5 (the other two), crunch_2 -20,
  // crunch_heavy_2 -20, land -18, debris -25, whooshes -17
  squeal_loop: 0.5, scrape_loop: 0.62, wind_loop: 0.32, hiss_loop: 0.42, bump: 0.62, bump_2: 1.1, bump_3: 1.15, crunch_2: 0.72, crunch_heavy_2: 0.62, land: 0.62, debris: 0.7, whoosh: 0.5, whoosh_2: 0.55 };
// takes of the same sound: <base>_<n> joins <base> (mg_shot, mg_shot_2, mg_shot_3; tink, tink_2, tink_3)
const TAKES = {};
for (const k of Object.keys(CLIPS)) { const m = /^(.+)_\d+$/.exec(k); if (m && CLIPS[m[1]]) (TAKES[m[1]] = TAKES[m[1]] || [m[1]]).push(k); }

// ask for every clip now (the served build fetches them), so they are in by the time the first sound plays
export function fetchClips() { for (const clip of Object.values(CLIPS)) bytes(clip); }
export function makeSounds(getCtx) {
  let ctx = null, bus = null, on = true;
  const buf = {}, last = {}, ear = { x: 0, z: 0, yaw: 0 };
  function init() {
    if (ctx) return true;
    ctx = getCtx(); if (!ctx) return false;
    bus = ctx.createGain(); bus.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
    bus.connect(comp); comp.connect(ctx.destination);
    for (const [k, clip] of Object.entries(CLIPS)) bytes(clip).then((u8) => {   // (in the served build it may still be on its way: sfxfiles.js)
      const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
      try { const p = ctx.decodeAudioData(ab, (b) => { buf[k] = b; }, () => {}); if (p && p.catch) p.catch(() => {}); } catch (e) { /* this browser can't decode it: that sound stays quiet */ }
    });
    return true;
  }
  // where the listener is: the car (x, z) and the camera's heading
  function listen(x, z, yaw) { ear.x = x; ear.z = z; ear.yaw = yaw; }
  function place(x, z) {
    if (x === undefined) return [1, 0];
    const dx = x - ear.x, dz = z - ear.z, d = Math.hypot(dx, dz);
    const k = 1 / Math.pow(1 + d / 45, 1.4);
    const a = Math.atan2(dx, dz) - ear.yaw;
    return [k, Math.max(-0.85, Math.min(0.85, -Math.sin(a) * Math.min(1, d / 20)))];
  }
  // one of a sound's takes, at random (any that has decoded), or the clip itself
  function pick(name) {
    const set = TAKES[name]; if (!set) return name;
    const ready = set.filter((k) => buf[k]); return ready.length ? ready[Math.floor(Math.random() * ready.length)] : name;
  }
  // a one-shot. gap: the least time between two of the same (a hail of bullets would otherwise stack up)
  function play(name, vol = 1, x, z, { rate = 1, gap = 0, jitter = 0.06 } = {}) {
    const clip = pick(name);
    if (!on || !ctx || !buf[clip] || ctx.state !== 'running') return;
    const t = ctx.currentTime; if (gap && last[name] && t - last[name] < gap) return; last[name] = t;
    const [k, pan] = place(x, z); if (k * vol < 0.02) return;
    const src = ctx.createBufferSource(); src.buffer = buf[clip]; src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * jitter * 2);
    const g = ctx.createGain(); g.gain.value = vol * k * (LEVEL[clip] ?? 1);
    let node = src; node.connect(g);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(bus); } else g.connect(bus);
    src.start();
  }
  // a loop that keeps going; set(volume, rate, x, z) every frame
  function loop(name) {
    let src = null, g = null, p = null, quiet = 0, lastT = 0;
    return {
      set(vol, rate = 1, x, z) {
        if (!ctx || !buf[name]) return;
        // a loop left silent for a moment is stopped (there are a dozen of them, most quiet most of the time: an iPad
        // needn't mix them), and starts again, somewhere new in it, when it is next wanted
        if (!(vol > 0) || !on) { if (src && (quiet += ctx.currentTime - (lastT || ctx.currentTime)) > 0.6) this.stop(); lastT = ctx.currentTime; if (!src) return; }
        else { quiet = 0; lastT = ctx.currentTime; }
        if (!src) {
          src = ctx.createBufferSource(); src.buffer = buf[name]; src.loop = true;
          g = ctx.createGain(); g.gain.value = 0; src.connect(g);
          if (ctx.createStereoPanner) { p = ctx.createStereoPanner(); g.connect(p); p.connect(bus); } else g.connect(bus);
          src.start(0, Math.random() * buf[name].duration);
        }
        const [k, pan] = place(x, z), t = ctx.currentTime;
        g.gain.setTargetAtTime(on ? vol * k * (LEVEL[name] ?? 1) : 0, t, 0.06);
        src.playbackRate.setTargetAtTime(Math.max(0.3, rate), t, 0.05);
        if (p) p.pan.setTargetAtTime(pan, t, 0.05);
      },
      stop() { quiet = 0; if (src) { try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); src.stop(ctx.currentTime + 0.3); } catch (e) { /* already stopped */ } src = null; } },
    };
  }
  return { init, play, loop, listen, get clips() { return Object.keys(buf).length; }, get on() { return on; }, set on(v) { on = v; } };
}
