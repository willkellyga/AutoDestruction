// Bundle the demo into one HTML file: `node derby/build.mjs` (after `npm install` at the repo root) writes
// derby/dist/auto-destruction.html, which opens straight from disk, and auto-destruction-artifact.html (the same page
// without the document wrapper).
// The town's meshing worker (src/mesh-worker.js) is bundled first, the way build.py does it, because src/sim.js
// carries it as text from dist/mesh-worker.wtxt.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const here = new URL('.', import.meta.url).pathname, root = here + '../';
const out = here + 'dist/';
mkdirSync(out, { recursive: true }); mkdirSync(root + 'dist', { recursive: true });
const define = { __STUDIO__: 'false', __TILES__: '1', __CITY__: 'false', __PARIS__: 'false', __NYC__: 'false', __TOKYO__: 'false', __CAIRO__: 'false', __DC__: 'false' };
await build({ entryPoints: [root + 'src/mesh-worker.js'], bundle: true, minify: true, format: 'iife', outfile: root + 'dist/mesh-worker.wtxt', alias: { three: root + 'src/three-worker-stub.js' }, define, logLevel: 'warning' });
const r = await build({ entryPoints: [here + 'src/main.js'], bundle: true, minify: !process.env.NOMIN, format: 'iife', write: false, define, loader: { '.wtxt': 'text', '.mp3': 'binary' }, logLevel: 'warning' });
let js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
// one painted frame first, so the loading card is on the screen while the town is built
js = '(() => { let done = false; const boot = () => { if (done) return; done = true;\n' + js + '\n}; requestAnimationFrame(() => setTimeout(boot, 30)); setTimeout(boot, 1500); })();';
const page = readFileSync(here + 'src/page.html', 'utf8');
const body = page + '\n<script>' + js + '</script>\n';
writeFileSync(out + 'auto-destruction-artifact.html', body);
const [head, rest] = page.split('</style>\n');
writeFileSync(out + 'auto-destruction.html', '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' + head + '</style>\n</head>\n<body>\n' + rest + '\n<script>' + js + '</script>\n</body>\n</html>\n');
console.log('built', Math.round(body.length / 1024), 'KB');
