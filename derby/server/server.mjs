#!/usr/bin/env node
// Auto Destruction's online server: hands out the game page and runs the lobby and round relay (relay.mjs) at /ws.
//   node derby/build.mjs && node derby/server/server.mjs     (then open http://localhost:8080)
// On Fly.io (derby/FLY.md) it runs on one small always-on machine: the rooms live in its memory, so there must be one.
// It serves derby/dist/auto-destruction.html (or $GAME_FILE) at /, zipped, and /healthz and /stats (counts only).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { attachRelay } from './relay.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const GAME = process.env.GAME_FILE ? path.resolve(process.env.GAME_FILE) : path.join(here, '../dist/auto-destruction.html');
const PORT = +process.env.PORT || 8080;

// the page, read again when a new build lands, and zipped once (about 5 MB, a little over 1 MB zipped)
let page = { at: -1, raw: null, gz: null, tag: '' };
function game() {
  try {
    const at = fs.statSync(GAME).mtimeMs;
    if (at !== page.at) { const raw = fs.readFileSync(GAME); page = { at, raw, gz: zlib.gzipSync(raw, { level: 9 }), tag: '"' + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16) + '"' }; }
  } catch (e) { return null; }
  return page;
}
game();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  if (p === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (p === '/stats') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify(relay.stats())); }
  if (p === '/' || p === '/index.html') {
    const g = game();
    if (!g) { res.writeHead(503, { 'content-type': 'text/plain' }); return res.end('The game is not built yet: node derby/build.mjs'); }
    if (req.headers['if-none-match'] === g.tag) { res.writeHead(304, { etag: g.tag }); return res.end(); }
    const zip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', etag: g.tag, vary: 'accept-encoding', ...(zip ? { 'content-encoding': 'gzip' } : {}) });
    return res.end(req.method === 'HEAD' ? undefined : zip ? g.gz : g.raw);
  }
  res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not found');
});
const relay = attachRelay(server, { log: (t) => console.log('  ' + new Date().toISOString().slice(11, 19) + '  ' + t) });
server.listen(PORT, '0.0.0.0', () => console.log(`\nAuto Destruction online is running: http://localhost:${PORT}${game() ? '' : '   (no build yet: node derby/build.mjs)'}\n`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0));
