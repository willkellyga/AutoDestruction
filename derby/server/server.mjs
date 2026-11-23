#!/usr/bin/env node
// Auto Destruction's online server: hands out the game page and runs the lobby and round relay (relay.mjs) at /ws.
//   node derby/build.mjs && node derby/server/server.mjs     (then open http://localhost:8080)
// On Fly.io (FLY.md at the repo root) it runs on one small always-on machine: the rooms live in its memory, so there must be one.
// It serves the game's folder, derby/dist/web (or $GAME_DIR), that derby/build.mjs writes: index.html at /, and the sounds
// in sfx/. How the browser keeps them:
//   index.html   no-cache with an ETag: the browser asks every time, and gets "not modified" until a new build lands
//   sfx/*        named after their content (crunch-3f9a1c02be.mp3), so a name never changes what it holds: kept a year,
//                immutable, never asked about again; a changed sound is a new name the new page asks for
// Each file is compressed once as it is read, Brotli for browsers that take it and gzip for the rest (mp3s are left
// as they are: they don't get smaller). Also /healthz and /stats (counts only).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { attachRelay } from './relay.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.GAME_DIR ? path.resolve(process.env.GAME_DIR) : path.join(here, '../dist/web');
const PORT = +process.env.PORT || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const SQUEEZE = new Set(['.html', '.wav']);

// the folder, read again when a new build lands (index.html's time changes): every file in memory with its zipped
// copies (the page is about 2 MB, about 620 KB in Brotli; the sounds about 2.5 MB)
let site = { at: -1, files: null };
function load(rel) {
  const raw = fs.readFileSync(path.join(DIR, rel)), ext = path.extname(rel);
  const f = { raw, type: TYPES[ext] || 'application/octet-stream', tag: '"' + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16) + '"', page: rel === 'index.html' };
  if (SQUEEZE.has(ext)) {
    // a quick Brotli straight away (a quarter of a second for the page), then the smallest one, in the background (a few seconds)
    const br = (q) => ({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: q, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } });
    f.br = zlib.brotliCompressSync(raw, br(9));
    f.gz = zlib.gzipSync(raw, { level: 9 });
    zlib.brotliCompress(raw, br(11), (e, best) => { if (!e && best.length < f.br.length) f.br = best; });
  }
  return f;
}
function files() {
  try {
    const at = fs.statSync(path.join(DIR, 'index.html')).mtimeMs;
    if (at !== site.at) {
      const m = new Map([['/', load('index.html')]]); m.set('/index.html', m.get('/'));
      let sfx = []; try { sfx = fs.readdirSync(path.join(DIR, 'sfx')); } catch (e) { /* a build with no sounds */ }
      for (const n of sfx) if (/^[\w.-]+$/.test(n)) m.set('/sfx/' + n, load('sfx/' + n));
      site = { at, files: m };
    }
  } catch (e) { return null; }
  return site.files;
}
files();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  if (p === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (p === '/stats') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify(relay.stats())); }
  const all = files();
  if (!all) { res.writeHead(503, { 'content-type': 'text/plain' }); return res.end('The game is not built yet: node derby/build.mjs'); }
  const f = all.get(p);
  if (!f) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
  const keep = f.page ? 'no-cache' : 'public, max-age=31536000, immutable';
  if (req.headers['if-none-match'] === f.tag) { res.writeHead(304, { etag: f.tag, 'cache-control': keep }); return res.end(); }
  const take = req.headers['accept-encoding'] || '';
  const enc = f.br && /\bbr\b/.test(take) ? 'br' : f.gz && /\bgzip\b/.test(take) ? 'gzip' : null;
  const bytes = enc === 'br' ? f.br : enc === 'gzip' ? f.gz : f.raw;
  res.writeHead(200, { 'content-type': f.type, 'content-length': bytes.length, 'cache-control': keep, etag: f.tag, ...(f.br ? { vary: 'accept-encoding' } : {}), ...(enc ? { 'content-encoding': enc } : {}) });
  return res.end(req.method === 'HEAD' ? undefined : bytes);
});
const relay = attachRelay(server, { log: (t) => console.log('  ' + new Date().toISOString().slice(11, 19) + '  ' + t) });
server.listen(PORT, '0.0.0.0', () => console.log(`\nAuto Destruction online is running: http://localhost:${PORT}${files() ? '' : '   (no build yet: node derby/build.mjs)'}\n`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(0));
