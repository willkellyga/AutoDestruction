// Bundle the game: `node derby/build.mjs` (after `npm install` at the repo root) writes
//   derby/dist/auto-destruction.html           one file with everything in, which opens straight from disk
//   derby/dist/auto-destruction-artifact.html  the same page without the document wrapper (the claude.ai artifact)
//   derby/dist/web/                            the copy derby/server hands out: index.html with the code and fonts in,
//                                              and every sound as a file of its own in web/sfx/, named after its content
//                                              (crunch-3f9a1c02be.mp3), so browsers keep them for a year and an update
//                                              of the game doesn't download them again. The page fetches them once it is
//                                              up (src/sfxfiles.js), by relative paths only, so the folder works from any host.
// The town's meshing worker (src/mesh-worker.js) is bundled first, the way build.py does it, because src/sim.js
// carries it as text from dist/mesh-worker.wtxt.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
const here = new URL('.', import.meta.url).pathname, root = here + '../';
const out = here + 'dist/';
mkdirSync(out, { recursive: true }); mkdirSync(root + 'dist', { recursive: true });
// New York is a world of its own (src/world.js reads __NYC__ as it loads): the race is on it, the other maps are not, so
// __NYC__ is a flag set as the page starts (src/flags.js) rather than fixed here. The meshing worker learns it from
// its name, which flags.js gives it.
const define = { __STUDIO__: 'false', __TILES__: '1', __CITY__: 'false', __PARIS__: 'false', __NYC__: 'globalThis.__DERBY_NYC__', __TOKYO__: 'false', __CAIRO__: 'false', __DC__: 'false', __AD_SERVER__: JSON.stringify(process.env.AD_SERVER || '') };
// (AD_SERVER: a wss://.../ws address for a copy of the page served from somewhere else, so it can still play online;
// left out, the page plays online only when it came from the game's own server: derby/server)
await build({ entryPoints: [root + 'src/mesh-worker.js'], bundle: true, minify: true, format: 'iife', outfile: root + 'dist/mesh-worker.wtxt', alias: { three: root + 'src/three-worker-stub.js' }, define, banner: { js: "self.__DERBY_NYC__ = /mm-map=nyc/.test(self.name || '');" }, logLevel: 'warning' });
// the sounds as files of their own (the served build): an import of one is its path, and the file is copied into web/sfx
const sfxDir = out + 'web/sfx/';
rmSync(out + 'web', { recursive: true, force: true }); mkdirSync(sfxDir, { recursive: true });
const sfxFiles = { name: 'sfx-files', setup(b) {
  b.onLoad({ filter: /\.(mp3|wav)$/ }, (a) => {
    const raw = readFileSync(a.path), name = basename(a.path).replace(/\.(\w+)$/, '-' + createHash('sha256').update(raw).digest('hex').slice(0, 10) + '.$1');
    writeFileSync(sfxDir + name, raw);
    return { contents: 'export default { __sfx: ' + JSON.stringify('sfx/' + name) + ' };', loader: 'js' };
  });
} };
async function bundle(split) {
  const r = await build({ entryPoints: [here + 'src/main.js'], bundle: true, minify: !process.env.NOMIN, format: 'iife', write: false, define, loader: { '.wtxt': 'text', '.mp3': 'binary', '.wav': 'binary' }, plugins: split ? [sfxFiles] : [], logLevel: 'warning' });
  const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
  // one painted frame first, so the loading card is on the screen while the town is built
  return '(() => { let done = false; const boot = () => { if (done) return; done = true;\n' + js + '\n}; requestAnimationFrame(() => setTimeout(boot, 30)); setTimeout(boot, 1500); })();';
}
// the game's fonts (src/fonts, SIL Open Font License, see LICENSES.md) go into the page itself, so nothing loads from outside
const fontCss = readFileSync(here + 'src/fonts/fonts.css', 'utf8').replace(/url\('([^']+\.woff2)'\)/g, (m, f) => `url(data:font/woff2;base64,${readFileSync(here + 'src/fonts/' + f).toString('base64')}) format('woff2')`);
const page = readFileSync(here + 'src/page.html', 'utf8').replace('/*@fonts*/', () => fontCss);
const [head, rest] = page.split('</style>\n');
const doc = (js) => '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">\n' + head + '</style>\n</head>\n<body>\n' + rest + '\n<script>' + js + '</script>\n</body>\n</html>\n';
const js = await bundle(false), body = page + '\n<script>' + js + '</script>\n';
writeFileSync(out + 'auto-destruction-artifact.html', body);
writeFileSync(out + 'auto-destruction.html', doc(js));
const web = doc(await bundle(true));
writeFileSync(out + 'web/index.html', web);
console.log('built', Math.round(body.length / 1024), 'KB; served copy', Math.round(web.length / 1024), 'KB + sounds in dist/web/sfx');
