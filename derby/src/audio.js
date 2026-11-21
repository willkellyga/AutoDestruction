// The game's own recorded sounds, cut from the Sonniss GDC game audio bundle (royalty free, no credit needed; see
// derby/assets/sfx/CREDITS.md): crunches and scrapes for crashes, metal pings for bullets on cars, the blasts when a
// car goes up, a real engine and tyre skid on loops, nitro, the garage's clicks and the announcer.
// They play on Monster Mayhem's audio context (src/sfx.js), beside its own clips (guns, buildings coming down), through
// a bus and compressor of their own. Sounds in the street are placed: quieter with distance and panned left or right
// of the camera.
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

const CLIPS = { crunch, crunch_heavy, tink, scrape, carboom, bigboom, nitro, servo, start, door, ui_click, ui_coin, ui_equip, ui_go, ui_open, ui_tab, vo_clear, vo_rampage, engine_loop, skid_loop };
// how loud each clip is against the others (they were levelled by ear)
const LEVEL = { crunch: 0.8, crunch_heavy: 0.9, tink: 0.35, scrape: 0.5, carboom: 0.9, bigboom: 0.8, nitro: 0.55, servo: 0.5, start: 0.6, door: 0.6, ui_click: 0.35, ui_coin: 0.5, ui_equip: 0.4, ui_go: 0.5, ui_open: 0.45, ui_tab: 0.35, vo_clear: 0.8, vo_rampage: 0.8, engine_loop: 1, skid_loop: 1 };

export function makeSounds(getCtx) {
  let ctx = null, bus = null, on = true;
  const buf = {}, last = {}, ear = { x: 0, z: 0, yaw: 0 };
  function init() {
    if (ctx) return true;
    ctx = getCtx(); if (!ctx) return false;
    bus = ctx.createGain(); bus.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
    bus.connect(comp); comp.connect(ctx.destination);
    for (const [k, bytes] of Object.entries(CLIPS)) {
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      try { const p = ctx.decodeAudioData(ab, (b) => { buf[k] = b; }, () => {}); if (p && p.catch) p.catch(() => {}); } catch (e) { /* this browser can't decode it: that sound stays quiet */ }
    }
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
  // a one-shot. gap: the least time between two of the same (a hail of bullets would otherwise stack up)
  function play(name, vol = 1, x, z, { rate = 1, gap = 0, jitter = 0.06 } = {}) {
    if (!on || !ctx || !buf[name] || ctx.state !== 'running') return;
    const t = ctx.currentTime; if (gap && last[name] && t - last[name] < gap) return; last[name] = t;
    const [k, pan] = place(x, z); if (k * vol < 0.02) return;
    const src = ctx.createBufferSource(); src.buffer = buf[name]; src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * jitter * 2);
    const g = ctx.createGain(); g.gain.value = vol * k * (LEVEL[name] ?? 1);
    let node = src; node.connect(g);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(bus); } else g.connect(bus);
    src.start();
  }
  // a loop that keeps going; set(volume, rate, x, z) every frame
  function loop(name) {
    let src = null, g = null, p = null;
    return {
      set(vol, rate = 1, x, z) {
        if (!ctx || !buf[name]) return;
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
      stop() { if (src) { try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); src.stop(ctx.currentTime + 0.3); } catch (e) { /* already stopped */ } src = null; } },
    };
  }
  return { init, play, loop, listen, get on() { return on; }, set on(v) { on = v; } };
}
