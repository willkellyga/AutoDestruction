// Device reports, copied from Monster Mayhem's playtest server (playtest/server.mjs) and cut down for Auto Destruction.
// Each game page (derby/src/report.js) sends a short report every 3 seconds: the device, the frame rate, the slowest
// frame, the quality step, load times, errors and reloads after a crash. They are kept two ways:
//   reports.jsonl in DATA_DIR    one line a report, for reading later (on Fly.io a volume mounted at /data, see FLY.md)
//   in memory                    the last report from each device, for the host page
// GET /host shows the devices (refreshed every 2 s), GET /reports gives the same as JSON. On Fly.io both answer only to
// HOST_KEY: open /host?key=<the key> once and the browser remembers it. With no HOST_KEY there they are switched off
// (reports are still kept). At home (no FLY_APP_NAME) they are open.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function makeReports({ dir, hostKey = '', isPublic = false, log = () => {} }) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* said when the first report cannot be kept */ }
  const LOG = path.join(dir, 'reports.jsonl');
  const LOG_MAX = 64e6;   // the file stops growing here (anyone with the link can send reports)
  const devices = new Map();   // id -> the device's last report
  let logSize = 0, logFailed = false; try { logSize = fs.statSync(LOG).size; } catch (e) { /* no reports yet */ }
  log('device reports kept in ' + LOG + (logSize ? ' (' + Math.round(logSize / 1e3) + ' KB so far)' : ''));

  const sameText = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  const cookie = (req, name) => { const m = new RegExp('(?:^|;\\s*)' + name + '=([^;]*)').exec(req.headers.cookie || ''); return m ? decodeURIComponent(m[1]) : ''; };
  const mayHost = (req, url) => hostKey ? sameText(url.searchParams.get('key') || '', hostKey) || sameText(cookie(req, 'adhost'), hostKey) : !isPublic;

  function take(req, res) {
    let buf = '';
    req.on('data', (c) => { buf += c; if (buf.length > 20000) req.destroy(); });
    req.on('end', () => {
      try {
        const d = JSON.parse(buf);
        if (!d || typeof d !== 'object' || !d.id) throw new Error('not ours');
        d.id = String(d.id).slice(0, 24);
        const was = devices.get(d.id) || { crashes: 0 };
        d.at = Date.now(); d.crashes = was.crashes + (d.crashed ? 1 : 0); delete d.crashed;
        devices.delete(d.id); devices.set(d.id, d);
        if (devices.size > 300) devices.delete(devices.keys().next().value);   // the one heard from longest ago
        const line = JSON.stringify(d) + '\n';
        if (logSize + line.length <= LOG_MAX) {
          logSize += line.length;
          fs.appendFile(LOG, line, (err) => { if (err && !logFailed) { logFailed = true; log('Reports are not being kept: ' + err.message); } });
        }
      } catch (e) { /* not ours */ }
      res.writeHead(204, { 'cache-control': 'no-store' }); res.end();
    });
  }

  const html = (res, body) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(body); };
  const json = (res, v) => { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(v)); };
  const notFound = (res) => { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not found'); };

  // true when the request was one of ours
  function handle(req, res, url) {
    const p = url.pathname;
    if (p === '/report') { if (req.method !== 'POST') { res.writeHead(405); res.end(); } else take(req, res); return true; }
    if (p !== '/host' && p !== '/reports') return false;
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return true; }
    if (!mayHost(req, url)) { notFound(res); return true; }
    if (p === '/host' && hostKey && url.searchParams.has('key')) {   // keep the key in the browser and take it out of the address bar
      res.writeHead(302, { location: '/host', 'cache-control': 'no-store', 'set-cookie': 'adhost=' + encodeURIComponent(hostKey) + '; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax' + (isPublic ? '; Secure' : '') });
      res.end(); return true;
    }
    if (p === '/reports') json(res, [...devices.values()].sort((a, b) => b.at - a.at));
    else html(res, HOST_PAGE);
    return true;
  }
  return { handle, count: () => devices.size };
}

// the page that lists each device's last report
const HOST_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Auto Destruction devices</title>
<style>:root{--ink:#17140f;--paper:#f3ead8;--hot:#ffb02e}*{box-sizing:border-box}html,body{margin:0;min-height:100%}
body{background:var(--ink);color:var(--paper);font:16px/1.45 system-ui,-apple-system,sans-serif;padding:22px 16px 28px;-webkit-text-size-adjust:100%}
h1{font-size:30px;margin:0 0 4px}p{margin:0 0 18px;opacity:.8}main{max-width:1100px;margin:0 auto}.wrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:15px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(243,234,216,.18);vertical-align:top}th{opacity:.65;font-weight:600}
.bad{color:#ff8f7a}.ok{color:#9be28f}.old{opacity:.45}small{opacity:.65}</style></head><body><main>
<h1>Auto Destruction devices</h1><p>Each device that has the game open reports every 3 seconds. Grey rows stopped reporting (page closed or asleep).</p>
<div class="wrap"><table><thead><tr><th>Device</th><th>Map</th><th>Frame rate</th><th>Slowest frame</th><th>Quality step</th><th>Screen</th><th>Notes</th></tr></thead><tbody id="rows"><tr><td colspan="7"><small>Nobody has reported yet.</small></td></tr></tbody></table></div>
</main><script>
const e = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const browser = (v) => { if (!v) return ''; const u = v.ua || '', b = (u.match(/(CriOS|FxiOS|EdgiOS|Edg|Chrome|Version|Firefox)[/][0-9.]+/) || [''])[0].replace('CriOS', 'Chrome').replace('FxiOS', 'Firefox').replace(/EdgiOS|Edg/, 'Edge').replace('Version', 'Safari'), os = (u.match(/OS ([0-9_]+)/) || ['', ''])[1].replace(/_/g, '.');
  return '<small>' + e(b || 'browser?') + (os ? ', iOS ' + e(os) : '') + (v.cores ? ', ' + e(v.cores) + ' cores' : '') + (v.standalone ? ', Home Screen icon' : '') + (v.secure ? '' : ', <b class="bad">not https</b>') + '</small><br>'; };
const kf = (v) => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.round(v / 1000) + 'k';
// the lines from Monster Mayhem's reports: where a frame goes, what is drawn, city redraws, pauses, and the page's life
function more(d) {
  let t = '';
  const S = d.split; if (S) t += '<small>frame ' + e(S.frame) + ' ms = game ' + e(S.step) + ' + drawing ' + e(S.draw) + ' + waiting ' + e(S.wait) + ' (' + e(S.over20) + '% over 20 ms) <span class="' + (S.step + S.draw > 12 ? 'bad' : '') + '">' + (S.step + S.draw > 12 ? 'page-bound' : S.over20 > 20 ? 'graphics-bound' : '') + '</span></small><br>';
  const D = d.drawn; if (D && D.kinds) t += '<small>drawn: ' + Object.entries(D.kinds).slice(0, 5).map(([k, v]) => e(k) + ' ' + kf(v[0]) + ' / ' + e(v[1])).join(', ') + '</small><br>';
  const R = d.redraw; if (R && (R.total || R.mbps)) t += '<small>city redraws ' + e(R.mbps) + ' MB/s, busiest second ' + e(R.busiest) + ' MB</small><br>';
  if (d.pauseCount) { const P = d.pauses[d.pauses.length - 1]; t += '<small class="bad">' + e(d.pauseCount) + ' pauses over 100 ms; last ' + e(P.ms) + ' ms at ' + e(P.at) + ' s: game ' + e(P.step) + ', drawing ' + e(P.draw) + ', ' + e(P.shaders) + ' new shaders, ' + e(P.meshes) + ' new meshes</small><br>'; }
  const L = d.life; if (L) t += '<small>' + (L.hidden ? e(L.hidden) + ' times hidden, ' : '') + (L.lost ? '<b class="bad">graphics dropped ' + e(L.lost) + ', back ' + e(L.back) + '</b>, ' : '') + e(L.geoms) + ' meshes, ' + e(L.textures) + ' textures, ' + e(L.shaders) + ' shaders on the card</small><br>';
  return t;
}
const ms = (v) => v == null ? '?' : (v / 1000).toFixed(1) + ' s';
async function tick() {
  try {
    const list = await (await fetch('/reports')).json(), now = Date.now();
    if (!list.length) return;
    document.getElementById('rows').innerHTML = list.map((d) => {
      const old = now - d.at > 12000, f = d.fps;
      return '<tr class="' + (old ? 'old' : '') + '"><td>' + e(d.device) + '<br><small>' + e(d.id) + '</small></td>'
        + '<td>' + e(d.map) + '<br><small>' + e(d.state) + (d.online ? ', online' : '') + (old ? ', left' : '') + '</small></td>'
        + '<td class="' + (f >= 45 ? 'ok' : f != null && f < 28 ? 'bad' : '') + '">' + (f == null ? '' : f + ' fps') + '<br><small>lowest ' + e(d.fpsMin) + ', average ' + e(d.fpsAvg) + ' in play</small></td>'
        + '<td>' + e(d.worst) + ' ms</td><td>' + e(d.quality) + ' <small>of 6</small></td><td>' + e(d.screen) + '</td>'
        + '<td class="' + (d.errors || d.crashes ? 'bad' : '') + '">' + (d.crashes ? e(d.crashes) + ' reload after a crash<br>' : '') + browser(d.env)
        + (d.stepMs != null ? '<small>game ' + e(d.stepMs) + ' ms, drawing ' + e(d.drawMs) + ' ms of ' + e(d.frameMs) + ' ms a frame</small><br>' : '')
        + (d.load ? '<small>page in ' + ms(d.load.page) + ', ready in ' + ms(d.load.ready) + ', JavaScript check ' + e(d.jsMs) + ' ms</small><br>' : '')
        + (d.calls != null ? '<small>' + e(d.calls) + ' draw calls, ' + e(Math.round((d.tris || 0) / 1000)) + 'k triangles, ' + e(d.cars) + ' cars</small><br>' : '')
        + more(d)
        + (d.errors ? e(d.errors) + ' errors<br><small>' + e(d.lastError) + '</small>' : '') + '</td></tr>';
    }).join('');
  } catch (err) { /* the server stopped */ }
}
tick(); setInterval(tick, 2000);
</script></body></html>`;
