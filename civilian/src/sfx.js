// Synthesised sounds for the street vehicles, no sound files: filtered noise and swept tones, the same method as the
// game's sound() in ../../src/main.js and the army's ../../units/src/audio.js. Sounds are panned and quietened by where
// they are from the camera.
export function makeSfx(camera) {
  let ctx = null, master = null, noiseBuf = null; const last = {};
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  function bus(pan) { const g = ctx.createGain(); let out = g; if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; } out.connect(master); return g; }
  function noise(to, dur, freq, q, vol, type = 'lowpass', sweep = 0.4, delay = 0) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; const t = ctx.currentTime + delay;
    f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(to); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(to, f0, f1, dur, vol, type = 'sine', delay = 0) {
    const o = ctx.createOscillator(); o.type = type; const t = ctx.currentTime + delay;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(to); o.start(t); o.stop(t + dur + 0.05);
  }
  const GAP = { boom: 70, crunch: 60, glass: 50, clang: 50, thud: 40, alarm: 2600, crackle: 60, splash: 90, hiss: 400, jet: 900, cat: 200, gun: 40 };
  const api = {
    on: true, init,
    play(name, p, vol = 1) {
      if (!ctx || !api.on || ctx.state !== 'running') return;
      const now = performance.now(); if (GAP[name] && last[name] && now - last[name] < GAP[name]) return; last[name] = now;
      let pan = 0;
      if (p) {
        const dx = p.x - camera.position.x, dy = p.y - camera.position.y, dz = p.z - camera.position.z, d = Math.hypot(dx, dy, dz) || 1, e = camera.matrixWorld.elements;
        pan = Math.max(-0.85, Math.min(0.85, (dx * e[0] + dy * e[1] + dz * e[2]) / d)); vol *= Math.max(0.15, Math.min(1, 1.3 - d / 240));
      }
      const o = bus(pan), r = 0.85 + Math.random() * 0.3;
      switch (name) {
        case 'boom': noise(o, 1.2, 1100 * r, 0.5, 1.0 * vol, 'lowpass', 0.08); tone(o, 100 * r, 28, 0.9, 1.0 * vol); noise(o, 0.5, 3000, 0.7, 0.3 * vol, 'highpass', 0.4, 0.03); noise(o, 1.3, 420, 0.6, 0.22 * vol, 'lowpass', 0.3, 0.3); break;
        // metal folding flat: a low thump, a grinding crunch and a ring
        case 'crunch': tone(o, 120 * r, 40, 0.3, 0.9 * vol); noise(o, 0.34, 900 * r, 1.4, 0.8 * vol, 'bandpass', 0.35); noise(o, 0.22, 2600 * r, 2, 0.4 * vol, 'bandpass', 0.6, 0.04); tone(o, 620 * r, 300, 0.25, 0.08 * vol, 'square', 0.02); break;
        case 'glass': for (let i = 0; i < 5; i++) { noise(o, 0.12 + Math.random() * 0.2, 5200 + Math.random() * 3000, 3, 0.3 * vol, 'highpass', 0.9, i * 0.03 + Math.random() * 0.05); tone(o, 3200 + Math.random() * 2600, 2400, 0.09, 0.04 * vol, 'triangle', i * 0.04 + Math.random() * 0.06); } break;
        case 'clang': tone(o, 520 * r, 380 * r, 0.35, 0.16 * vol, 'square'); tone(o, 1310 * r, 1100 * r, 0.25, 0.07 * vol, 'triangle'); noise(o, 0.1, 2400, 1.2, 0.4 * vol, 'bandpass', 0.5); break;
        case 'thud': noise(o, 0.1, 700 * r, 1, 0.5 * vol, 'bandpass', 0.5); tone(o, 150 * r, 70, 0.08, 0.3 * vol, 'triangle'); break;
        // a car alarm: six two-tone whoops
        case 'alarm': for (let i = 0; i < 6; i++) { tone(o, 980, 1400, 0.19, 0.045 * vol, 'square', i * 0.4); tone(o, 1400, 980, 0.19, 0.045 * vol, 'square', i * 0.4 + 0.2); } break;
        // water thrown up and falling back: a soft slap, then a long wash of hiss
        case 'splash': noise(o, 0.16, 900 * r, 0.8, 0.5 * vol, 'lowpass', 0.4); noise(o, 0.9, 2600 * r, 0.6, 0.34 * vol, 'bandpass', 0.5, 0.03); noise(o, 1.4, 5200, 0.5, 0.14 * vol, 'highpass', 0.8, 0.12); break;
        // a jet going by: a long roar that falls away; the catapult: a slam and a rush of steam; the gun: a short rip
        case 'jet': noise(o, 2.6, 900 * r, 0.35, 0.5 * vol, 'lowpass', 0.5); noise(o, 2.2, 2600 * r, 0.6, 0.16 * vol, 'bandpass', 0.6, 0.1); tone(o, 190 * r, 90, 2.2, 0.12 * vol, 'sawtooth'); break;
        case 'cat': tone(o, 90 * r, 40, 0.25, 0.7 * vol); noise(o, 1.1, 3800 * r, 0.6, 0.3 * vol, 'highpass', 0.7, 0.03); break;
        case 'gun': noise(o, 0.05, 1500 * r, 0.7, 0.4 * vol, 'bandpass', 0.6); tone(o, 210 * r, 120, 0.04, 0.2 * vol, 'square'); break;
        case 'hiss': noise(o, 1.1, 6000 * r, 0.7, 0.1 * vol, 'highpass', 0.7); break;
        case 'crackle': noise(o, 0.05 + Math.random() * 0.05, 1800 + Math.random() * 2600, 2.5, 0.16 * vol, 'bandpass', 0.7); break;
      }
    },
  };
  return api;
}
