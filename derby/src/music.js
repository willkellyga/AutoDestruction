// The game's music: the main theme loops on the home screen, in the garage and shop, and on a mode's start card (Will,
// 2026-11-24: once you're back in the home zone the music shouldn't switch). In a round the map's own track plays, where
// it has one (Camp Deadfall and the New York races so far), and the theme fades out.
// Every track is an original made in Will's Suno account (derby/assets/music/CREDITS.md). Each file is the loop plus
// half a second either side: the loop runs from a track's start for its len seconds, both cut on a drum hit, and the bars just
// after the start already hold a short crossfade from the bars after the end, so going round has no seam. The spare
// half seconds mean a decoder that pads the start a little still lands the loop on music, not on silence.
// It is fetched on its own after the page is up (not through sfxfiles.js's count, so the loading screen never waits for it).
import theme from '../assets/music/theme.mp3';
import deadfall from '../assets/music/deadfall.mp3';
import raceNyc from '../assets/music/race-nyc.mp3';

const TRACKS = {
  theme: { clip: theme, start: 0.5, len: 42.36723, level: 0.42 },
  deadfall: { clip: deadfall, start: 0.5, len: 32.71338, level: 0.38 },   // Camp Deadfall's rounds
  race: { clip: raceNyc, start: 0.5, len: 55.18617, level: 0.38 },   // the New York races: Manhattan Circuit and Empire City
};
// each map's round track (maps without one are quiet in a round)
export const MAP_TRACK = { base: 'deadfall', race: 'race', empire: 'race' };

function load(clip) {
  if (clip && typeof clip.__sfx === 'string') return fetch(clip.__sfx).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)));
  const u8 = clip || new Uint8Array(0);
  return Promise.resolve(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
}

// uses: the tracks this page may play (the theme and its map's own); only those are fetched
export function makeMusic(getCtx, uses = Object.keys(TRACKS)) {
  const raw = {}, buf = {};
  let ctx = null, out = null, now = null, src = null, g = null, want = null, on = true;
  // ask for the bytes now; they decode once there is an AudioContext (the first tap or key)
  function fetchMusic() { for (const k of uses) if (TRACKS[k] && !raw[k]) raw[k] = load(TRACKS[k].clip).catch(() => null); }
  function decode(k) {
    if (buf[k] !== undefined || !ctx || !raw[k]) return;
    buf[k] = null;
    raw[k].then((ab) => { if (!ab) return; try { const p = ctx.decodeAudioData(ab.slice(0), (b) => { buf[k] = b; sync(); }, () => {}); if (p && p.catch) p.catch(() => {}); } catch (e) { /* can't decode here: no music */ } });
  }
  function stopNow(fade = 1.2) {
    if (!src) return;
    const s = src, gg = g; src = null; g = null; now = null;
    try { const t = ctx.currentTime; gg.gain.cancelScheduledValues(t); gg.gain.setValueAtTime(gg.gain.value, t); gg.gain.linearRampToValueAtTime(0, t + fade); s.stop(t + fade + 0.05); } catch (e) { /* already stopped */ }
  }
  function sync() {
    if (!ctx) return;
    const k = on ? want : null;
    if (k === now) return;
    stopNow();
    if (!k) return;
    decode(k);
    const b = buf[k], tr = TRACKS[k]; if (!b) return;   // (not in yet: sync() runs again once it decodes)
    src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
    src.loopStart = tr.start; src.loopEnd = Math.min(b.duration, tr.start + tr.len);
    g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(out);
    const t = ctx.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(tr.level, t + 1.5);
    src.start(t, tr.start); now = k;
  }
  return {
    fetchMusic,
    // call once there is an AudioContext (after a tap); safe to call every time
    init() {
      if (ctx) return;
      ctx = getCtx(); if (!ctx) return;
      out = ctx.createGain(); out.gain.value = 1; out.connect(ctx.destination);   // (not through the effects' compressor: it would pump with every crash)
      fetchMusic(); for (const k of uses) decode(k);
      sync();
    },
    // which track should be playing (a TRACKS name, or null for none); cheap to call every frame
    play(k) { if (k !== want) { want = k; sync(); } },
    get on() { return on; }, set on(v) { if (v !== on) { on = v; sync(); } },
    get playing() { return now; },
  };
}
