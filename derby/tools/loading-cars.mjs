// Draw the cars for the loading screen (src/page.html) from the game's own models, and keep them in
// src/loadcars.json, which build.mjs puts into the page. Run it by hand after the cars change:
//   npm run build && node derby/tools/loading-cars.mjs && npm run build
// It opens the built page in headless Chromium (Playwright, which isn't one of the game's packages: install it with
// npm i -g playwright if it isn't there) and calls partart.js's side() for each build below.
// `me` is the starter car, shown until a player's own car has been drawn on their device (main.js keepLoadCar keeps
// theirs); the rival is one of `foes`, picked at random each time.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
const { chromium } = createRequire(import.meta.url)('playwright');
const BUILDS = {
  me: {},
  foes: [
    { body: 'bruiser', paint: 'maroon', trim: 'sand', pattern: 'plain', primary: 'minigun', front: 'spikes', armour: 'light' },
    { body: 'viper', paint: 'teal', trim: 'white', pattern: 'stripes', primary: 'mg', roof: 'twin', front: 'bumper', wheels: 'slicks' },
    { body: 'hauler', paint: 'green', trim: 'black', pattern: 'camo', primary: 'scatter', front: 'plow', armour: 'medium', wheels: 'offroad' },
    { body: 'duchess', paint: 'purple', trim: 'silver', pattern: 'flames', primary: 'flamer', front: 'saws', engine: 'blower' },
  ],
};
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('page error:', e.message));
await p.goto('file://' + here + '../dist/auto-destruction.html?map=pit');
await p.waitForFunction(() => window.__derby && window.__derby.art, null, { timeout: 180000 });
const draw = (L) => p.evaluate((L) => {
  const { STARTER } = window.__derby, S = { ...(STARTER || window.__derby.save.load), ...L, webp: true };
  return window.__derby.art.side(S);
}, L);
const out = { me: await draw(BUILDS.me), foes: [] };
for (const f of BUILDS.foes) out.foes.push(await draw(f));
await b.close();
const json = JSON.stringify(out);
writeFileSync(here + '../src/loadcars.json', json + '\n');
console.log('wrote src/loadcars.json,', Math.round(json.length / 1024), 'KB');
