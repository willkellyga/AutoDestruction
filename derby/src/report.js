// How the game runs on this device, sent to the server every 3 seconds (derby/server/reports.mjs keeps it, /host shows
// it). Copied from Monster Mayhem's reporter (playtest/server.mjs) and fitted to the derby. Each report holds:
//   the device (iPad, iPhone, Android, Mac, Computer) and a short id kept in this browser, the browser and screen
//   the frame rate over the last 3 s, the slowest frame, and the lowest and average while playing
//   the quality step quality.js settled on (0 best to 6 lightest), draw calls, triangles and cars
//   how long the game's own step and the drawing took, a frame on average (time spent in JavaScript, not on the GPU)
//   load: page download and time to the first frame; a fixed JavaScript check (slow means the fast engine is off)
//   errors, and whether the last visit ended in a crash (the page went away without saying goodbye)
// and, from Monster Mayhem's reports of 2026-11-19 to 25 (what found its real causes on iPads and iPhones):
//   split    the last 3 s of play, a frame on average: game step + drawing calls + waiting (the browser, the graphics card,
//            the screen's beat), and the share of frames over 20 ms. Drawing near 16 ms: the page's own work is the limit
//            (cut JavaScript and draw calls). Little drawing but still slow: the graphics card is (cut triangles, pixels).
//   pauses   each frame of play over 100 ms, with the work of the frame before it and how many new shaders and meshes it
//            had to set up (shader compiles were most of Monster Mayhem's freezes)
//   drawn    one frame's triangles and draws by kind (near city, far city, cars, shadows...), every 3 s of play
//   redraw   MB of new city meshes handed to the graphics card, a second, and the busiest second
//   life     times the tab was hidden, graphics dropped and given back, and what the renderer holds
// Only when the page came from our own server (http or https): on CrazyGames or a file there is nobody to tell, and the
// first refused report stops them. ?report=0 turns it off. ?perf=1 also shows the numbers in a corner of the screen.
export function startReports({ game, quality, renderer, MAP, cars, online, stats = {}, leaving = () => false }) {
  const args = new URLSearchParams(location.search);
  const on = /^https?:$/.test(location.protocol) && args.get('report') !== '0';
  const overlay = args.get('perf') === '1';
  if (!on && !overlay) return { frame() {}, drawStart() {}, drawEnd() {} };   // (main.js calls all three every frame)

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
  const life = { hidden: 0, lost: 0, back: 0 };
  // (the page drops its own context on the way out, leave.js: that one is not an error)
  renderer.domElement.addEventListener('webglcontextlost', () => { if (leaving()) return; errors++; life.lost++; lastError = 'the graphics were dropped (WebGL context lost)'; });
  renderer.domElement.addEventListener('webglcontextrestored', () => { life.back++; });
  addEventListener('visibilitychange', () => { if (document.hidden) life.hidden++; });
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
      memory: m ? Math.round(m.usedJSHeapSize / 1e6) : null, load, jsMs, env, errors, lastError,
      split: split.line, pauses: pauses.slice(-8), pauseCount, drawn: drawn.line, redraw: redrawLine(), life: lifeLine() };
    crashed = 0;
    if (box) box.textContent = MAP.name + ' · ' + body.state + '\n' + (fps == null ? '' : fps + ' fps') + ', slowest ' + body.worst + ' ms, quality ' + body.quality + ' of 6\nplay: lowest ' + (fpsMin ?? '-') + ', average ' + (body.fpsAvg ?? '-') + '\ngame ' + body.stepMs + ' ms, drawing ' + body.drawMs + ' ms a frame\n' + body.calls + ' draws, ' + Math.round(body.tris / 1000) + 'k tris, ' + body.cars + ' cars\nloaded in ' + (load.ready == null ? '?' : (load.ready / 1000).toFixed(1) + ' s') + ', JS check ' + jsMs + ' ms' + extra(body) + (errors ? '\n' + errors + ' errors: ' + lastError : '');
    if (!live) return;
    try {
      fetch('/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true })
        .then((r) => { if (r.status !== 204) live = false; }, () => {});
    } catch (e) { /* no fetch */ }
  }
  // the new lines, for the overlay
  const kf = (v) => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.round(v / 1000) + 'k';
  function extra(b) {
    let t = '';
    if (b.split) t += '\nsplit ' + b.split.frame + ' = game ' + b.split.step + ' + draw ' + b.split.draw + ' + wait ' + b.split.wait + ' ms, ' + b.split.over20 + '% over 20';
    if (b.drawn) t += '\n' + Object.entries(b.drawn.kinds).slice(0, 4).map(([k, e]) => k + ' ' + kf(e[0]) + '/' + e[1]).join(', ');
    if (b.redraw) t += '\ncity redraws ' + b.redraw.mbps + ' MB/s, busiest ' + b.redraw.busiest + ' MB';
    const P = b.pauses[b.pauses.length - 1]; if (P) t += '\n' + b.pauseCount + ' pauses, last ' + P.ms + ' ms at ' + P.at + ' s (' + P.shaders + ' new shaders, ' + P.meshes + ' new meshes)';
    return t;
  }
  if (overlay) {
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;background:rgba(20,16,12,.82);color:#f3ead8;font:12px/1.35 ui-monospace,Menlo,monospace;padding:6px 9px;border-radius:8px;white-space:pre;pointer-events:none';
    document.body.appendChild(box);
  }
  // a second beat on a timer: if the picture stops but the page is alive, this still gets through and says so
  let seen = 0, total = 0;
  setInterval(() => { if (total === seen && document.visibilityState === 'visible' && !window.__hold && !leaving()) { errors++; lastError = 'The picture stopped (no frames for 5 seconds)'; send(0); } seen = total; }, 5000);
  addEventListener('pagehide', () => { lastError = lastError || 'closed'; });

  // ---- the frame's split (Monster Mayhem's noteSplit) ----
  const split = { n: 0, fd: 0, step: 0, draw: 0, slow: 0, line: null };
  function noteSplit(fd, stepMs, drawMs) {
    split.n++; split.fd += fd; split.step += stepMs; split.draw += drawMs; if (fd > 20) split.slow++;
    if (split.fd < 3000) return;
    const k = split.n, avg = (v) => +(v / k).toFixed(1), frame = avg(split.fd), st = avg(split.step), dr = avg(split.draw);
    split.line = { at: Math.round(game.time), q: quality.step, frame, step: st, draw: dr, wait: +Math.max(0, frame - st - dr).toFixed(1), over20: Math.round(split.slow / k * 100) };
    split.n = split.fd = split.step = split.draw = split.slow = 0;
  }
  // ---- pauses: a frame of play over 100 ms, with what the frame before it did ----
  const pauses = []; let pauseCount = 0, pv = null;
  function notePause(fd, stepMs, drawMs) {
    const info = renderer.info, progs = info.programs ? info.programs.length : 0, geos = info.memory.geometries;
    if (pv && fd > 100 && fd < 60000 && game.state === 'play' && !game.paused && !document.hidden) {
      pauseCount++;
      pauses.push({ at: +game.time.toFixed(1), ms: Math.round(fd), step: Math.round(pv.step), draw: Math.round(pv.draw), shaders: progs - pv.progs, meshes: geos - pv.geos, q: pv.q });
      if (pauses.length > 8) pauses.shift();
    }
    pv = { step: stepMs, draw: drawMs, progs, geos, q: quality.step };
  }
  // ---- drawn by kind: one frame's draws counted through renderBufferDirect (Monster Mayhem's drawnCount) ----
  const drawn = { next: 3, on: false, K: null, line: null, kinds: new WeakMap(), carRoots: null };
  function kindOf(o, sc) {
    if (sc === null) return 'shadows';
    if (sc === o && !o.parent) return 'screen passes';
    let k = drawn.kinds.get(o); if (k) return k;
    const geo = o.geometry;
    for (let p = o; p && !k; p = p.parent) if (drawn.carRoots.has(p)) k = 'cars';
    for (let p = o; p && !k; p = p.parent) if (p.userData && p.userData.unit) k = 'other units';
    for (let p = o; p && !k; p = p.parent) if (p.userData && p.userData.kind) k = p.userData.kind;   // (main.js kindFrom)
    for (let p = o; p && !k; p = p.parent) if (p.name && p.type !== 'Scene') k = p.name;
    if (!k) k = geo && geo.attributes.pa ? (geo.boundingSphere && geo.boundingSphere.center.x > 8.5 ? 'far city' : 'near city') : o.isInstancedMesh ? 'instanced (debris, dirt, pools)' : o.isPoints ? 'particles' : o.isSkinnedMesh ? 'skinned' : 'other';
    if (k !== 'cars' && k !== 'other units') drawn.kinds.set(o, k);   // (a car's parts can come and go; the rest keep their kind)
    return k;
  }
  const realDraw = renderer.renderBufferDirect;
  function countDraw(cam, sc, geo, mat, o, group) {
    try {
      const ix = geo.index, r = geo.drawRange; let n = ix ? ix.count : geo.attributes.position ? geo.attributes.position.count : 0;
      let a = Math.max(0, r.start), b = Math.min(n, r.start + r.count); if (group) { a = Math.max(a, group.start); b = Math.min(b, group.start + group.count); }
      n = Math.max(0, b - a) / 3 * (o.isInstancedMesh ? o.count : geo.isInstancedBufferGeometry ? Math.min(geo.instanceCount, geo._maxInstanceCount || Infinity) : 1);
      if (o.isPoints || o.isLine) n = 0;
      const k = kindOf(o, sc), e = drawn.K[k] || (drawn.K[k] = [0, 0]); e[0] += n; e[1]++;
    } catch (e) { /* counting only */ }
    return realDraw.call(renderer, cam, sc, geo, mat, o, group);
  }
  function drawnEnd() {
    renderer.renderBufferDirect = realDraw; drawn.on = false;
    const list = Object.entries(drawn.K).sort((x, y) => y[1][0] - x[1][0]); let t = 0, c = 0; for (const [, e] of list) { t += e[0]; c += e[1]; }
    drawn.line = { at: Math.round(game.time), q: quality.step, tris: Math.round(t), calls: c, kinds: Object.fromEntries(list.slice(0, 10).map(([k, e]) => [k, [Math.round(e[0]), e[1]]])) };
  }
  // ---- city redraws: new chunk meshes handed to the graphics card (src/sim.js stats.sentBytes) ----
  const sent = { b0: stats.sentBytes || 0, last: stats.sentBytes || 0, secB: stats.sentBytes || 0, secT: 0, max: 0, rate: 0 };
  function noteSent(fd) {
    sent.secT += fd;
    if (sent.secT >= 1000) { const b = stats.sentBytes || 0; sent.max = Math.max(sent.max, b - sent.secB); sent.secB = b; sent.secT = 0; }
  }
  const mb = (v) => +(v / 1e6).toFixed(1);
  function redrawLine() { const b = stats.sentBytes || 0, r = mb((b - sent.last) / 3); sent.last = b; return { mbps: r, busiest: mb(sent.max), total: mb(b - sent.b0) }; }
  function lifeLine() { const i = renderer.info; return { ...life, geoms: i.memory.geometries, textures: i.memory.textures, shaders: i.programs ? i.programs.length : null, quads: stats.quads ?? null }; }

  return {
    // around the frame's drawing (main.js): one frame every 3 s of play has its draws counted by kind
    drawStart() {
      if (!live && !box) return;
      if (game.state !== 'play' || game.time < drawn.next) { if (game.time < drawn.next - 4) drawn.next = game.time + 3; return; }
      drawn.next = game.time + 3; drawn.on = true; drawn.K = {};
      drawn.carRoots = new WeakSet(); for (const c of cars) if (c.unit && c.unit.root) drawn.carRoots.add(c.unit.root);
      renderer.renderBufferDirect = countDraw;
    },
    drawEnd() { if (drawn.on) drawnEnd(); },
    // once a frame from main.js: the frame's time stamp, and how long the game's step and the drawing took
    frame(now, stepMs, drawMs) {
      total++;
      { const fd = now - last; if (game.state === 'play' && !game.paused && !document.hidden && fd < 1000) { noteSplit(fd, stepMs, drawMs); noteSent(fd); } notePause(fd, stepMs, drawMs); }
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
