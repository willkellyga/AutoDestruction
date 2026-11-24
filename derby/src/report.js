// How the game runs on this device, sent to the server every 3 seconds (derby/server/reports.mjs keeps it, /host shows
// it). Copied from Monster Mayhem's reporter (playtest/server.mjs) and fitted to the derby. Each report holds:
//   the device (iPad, iPhone, Android, Mac, Computer) and a short id kept in this browser, the browser and screen
//   the frame rate over the last 3 s, the slowest frame, and the lowest and average while playing
//   the quality step quality.js settled on (0 best to 6 lightest), draw calls, triangles and cars
//   how long the game's own step and the drawing took, a frame on average (time spent in JavaScript, not on the GPU)
//   load: page download and time to the first frame; a fixed JavaScript check (slow means the fast engine is off)
//   errors, and whether the last visit ended in a crash (the page went away without saying goodbye)
// Only when the page came from our own server (http or https): on CrazyGames or a file there is nobody to tell, and the
// first refused report stops them. ?report=0 turns it off. ?perf=1 also shows the numbers in a corner of the screen.
export function startReports({ game, quality, renderer, MAP, cars, online }) {
  const args = new URLSearchParams(location.search);
  const on = /^https?:$/.test(location.protocol) && args.get('report') !== '0';
  const overlay = args.get('perf') === '1';
  if (!on && !overlay) return { frame() {} };

  let id = ''; try { id = localStorage.adDevice || (localStorage.adDevice = Math.random().toString(36).slice(2, 7)); } catch (e) { id = 'private'; }
  // a crash on iOS reloads the page without a pagehide: the flag left at 1 says so on the next visit
  let crashed = 0; try { if (sessionStorage.adAlive === '1') crashed = 1; sessionStorage.adAlive = '1'; addEventListener('pagehide', () => { sessionStorage.adAlive = '0'; }); } catch (e) { /* private mode */ }
  const ua = navigator.userAgent;
  const device = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : 'Computer';
  const env = { ua: ua.slice(0, 200), secure: !!window.isSecureContext, cores: navigator.hardwareConcurrency || null, mem: navigator.deviceMemory || null,
    standalone: !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)) };
  let errors = 0, lastError = '';
  addEventListener('error', (e) => { errors++; lastError = String(e.message || e.type).slice(0, 200); });
  addEventListener('unhandledrejection', (e) => { errors++; lastError = String((e.reason && e.reason.message) || e.reason).slice(0, 200); });
  renderer.domElement.addEventListener('webglcontextlost', () => { errors++; lastError = 'the graphics were dropped (WebGL context lost)'; });
  // the same fixed piece of plain JavaScript as Monster Mayhem's: about 58 ms on a cloud test machine, over 1,000 ms
  // with the fast engine off (Lockdown Mode, or an iPad on a plain http address)
  const jsMs = (() => { const a = new Uint8Array(1 << 20), t = performance.now(); let h = 0; for (let r = 0; r < 24; r++) for (let i = 0; i < a.length; i++) { a[i] = (a[i] + i * 31 + r) & 255; h = (h + a[i]) | 0; } a[0] = h; return +(performance.now() - t).toFixed(1); })();
  const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
  const load = { page: nav ? Math.round(nav.responseEnd) : null, ready: null };

  // the bloom and grade passes each reset the counts, so they are added up over the frame here and cleared by hand
  renderer.info.autoReset = false;
  let calls = 0, tris = 0;
  let n = 0, t0 = performance.now(), last = t0, worst = 0, fpsMin = null, sum = 0, cnt = 0, stepT = 0, drawT = 0, frames = 0, live = on, box = null;
  function send(fps) {
    const m = performance.memory;
    const body = { id, device, crashed, map: MAP.name, mode: MAP.id, state: game.paused ? 'paused' : game.state, online: !!online(),
      fps, fpsMin, fpsAvg: cnt ? Math.round(sum / cnt) : null, worst: Math.round(worst), quality: quality.step,
      stepMs: frames ? +(stepT / frames).toFixed(1) : null, drawMs: frames ? +(drawT / frames).toFixed(1) : null, frameMs: fps ? +(1000 / fps).toFixed(1) : null,
      calls, tris, cars: cars.length, screen: innerWidth + ' x ' + innerHeight + ' @' + devicePixelRatio,
      memory: m ? Math.round(m.usedJSHeapSize / 1e6) : null, load, jsMs, env, errors, lastError };
    crashed = 0;
    if (box) box.textContent = MAP.name + ' · ' + body.state + '\n' + (fps == null ? '' : fps + ' fps') + ', slowest ' + body.worst + ' ms, quality ' + body.quality + ' of 6\nplay: lowest ' + (fpsMin ?? '-') + ', average ' + (body.fpsAvg ?? '-') + '\ngame ' + body.stepMs + ' ms, drawing ' + body.drawMs + ' ms a frame\n' + body.calls + ' draws, ' + Math.round(body.tris / 1000) + 'k tris, ' + body.cars + ' cars\nloaded in ' + (load.ready == null ? '?' : (load.ready / 1000).toFixed(1) + ' s') + ', JS check ' + jsMs + ' ms' + (errors ? '\n' + errors + ' errors: ' + lastError : '');
    if (!live) return;
    try {
      fetch('/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true })
        .then((r) => { if (r.status !== 204) live = false; }, () => {});
    } catch (e) { /* no fetch */ }
  }
  if (overlay) {
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;background:rgba(20,16,12,.82);color:#f3ead8;font:12px/1.35 ui-monospace,Menlo,monospace;padding:6px 9px;border-radius:8px;white-space:pre;pointer-events:none';
    document.body.appendChild(box);
  }
  // a second beat on a timer: if the picture stops but the page is alive, this still gets through and says so
  let seen = 0, total = 0;
  setInterval(() => { if (total === seen && document.visibilityState === 'visible' && !window.__hold) { errors++; lastError = 'The picture stopped (no frames for 5 seconds)'; send(0); } seen = total; }, 5000);
  addEventListener('pagehide', () => { lastError = lastError || 'closed'; });

  return {
    // once a frame from main.js: the frame's time stamp, and how long the game's step and the drawing took
    frame(now, stepMs, drawMs) {
      total++;
      calls = renderer.info.render.calls; tris = renderer.info.render.triangles; renderer.info.reset();
      if (load.ready == null) load.ready = Math.round(now);
      const dt = now - last; last = now;
      if (dt > worst && dt < 60000) worst = dt;
      n++; frames++; stepT += stepMs; drawT += drawMs;
      if (now - t0 >= 3000) {
        const fps = Math.round(1000 * n / (now - t0));
        if (game.state === 'play' && !game.paused && !document.hidden) { fpsMin = fpsMin == null ? fps : Math.min(fpsMin, fps); sum += fps; cnt++; }
        send(fps);
        n = 0; t0 = now; worst = 0; frames = 0; stepT = 0; drawT = 0;
      }
    },
  };
}
