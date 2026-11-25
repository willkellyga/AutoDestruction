// Take the pictures for the stage select (the solo map cards, main.js) from the game's own maps, and keep them in
// src/stages.json, which build.mjs puts into the page. Run it by hand after a map changes, or to add a map's card:
//   npm run build && node derby/tools/stage-shots.mjs [map ids] && npm run build
// It opens the built page in headless Chromium (Playwright: npm i -g playwright if it isn't there) on each map, puts the
// camera where SHOTS says, draws one frame and keeps it as a small webp. Maps not named keep the picture they had.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
const { chromium } = createRequire(import.meta.url)('playwright');
// where to stand and what to look at, in voxels (y up); `car` parks the player's car there for the shot
export const SHOTS = {
  empire: { auto: true },
  capital: { auto: true },
  base: { auto: true },
  fair: { auto: true },
  arena: { from: [268, 34, 662], at: [452, 8, 500] },   // (the show truck, the bus jump and the mountain)
};
const W = 640, H = 400;
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const raw = process.argv.includes('--raw');   // (also save each frame as a png beside the json, to look at)
let out = {}; try { out = JSON.parse(readFileSync(here + '../src/stages.json', 'utf8')); } catch (e) { /* a first run */ }
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const id of only.length ? only : Object.keys(SHOTS)) {
  const S = SHOTS[id]; if (!S) { console.log('no shot for', id); continue; }
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', (e) => console.log(id, 'page error:', e.message));
  await p.goto('file://' + here + `../dist/auto-destruction.html?map=${id}&report=0`);
  await p.waitForFunction(() => window.__derby && window.__derby.MAP, null, { timeout: 240000 });
  const got = await p.evaluate(async ({ S, id }) => {
    const D = window.__derby; window.__hold = true;
    if (D.MAP.id !== id) return { err: 'map is ' + D.MAP.id };
    for (const el of document.querySelectorAll('#menu, #loading, #home, .hud, #radar, #tags, #hint')) el.style.display = 'none';
    const P = D.player(), sp = D.MAP.spawn;
    let from, at;
    if (S.auto) {
      const fx = Math.sin(sp.yaw), fz = Math.cos(sp.yaw);
      from = [sp.x - fx * (S.back || 70), S.up || 45, sp.z - fz * (S.back || 70)];
      at = [sp.x + fx * (S.ahead || 60), 4, sp.z + fz * (S.ahead || 60)];
    } else { from = S.from; at = S.at; }
    if (S.car) { P.x = S.car[0]; P.z = S.car[1]; if (S.car[2] != null) P.yaw = S.car[2]; }
    for (let k = 0; k < 40; k++) D.step(1 / 30);
    const cam = D.camera;
    const put = () => { cam.position.set(from[0], from[1], from[2]); cam.lookAt(at[0], at[1], at[2]); cam.fov = S.fov || 55; cam.updateProjectionMatrix(); cam.updateMatrixWorld(); };
    for (let k = 0; k < 6; k++) { D.step(1 / 30); put(); D.render(); await new Promise((r) => setTimeout(r, 50)); }
    put(); D.render();
    const c = D.renderer.domElement, o = document.createElement('canvas'); o.width = 480; o.height = 300;
    o.getContext('2d').drawImage(c, 0, 0, o.width, o.height);
    return { webp: o.toDataURL('image/webp', 0.72), png: S && o.toDataURL('image/png'), from, at };
  }, { S, id });
  await p.close();
  if (got.err) { console.log(id, got.err); continue; }
  out[id] = got.webp;
  if (raw) writeFileSync(`${process.env.SHOT_DIR || '/tmp'}/stage-${id}.png`, Buffer.from(got.png.split(',')[1], 'base64'));
  console.log(id, Math.round(got.webp.length / 1024), 'KB', JSON.stringify({ from: got.from.map(Math.round), at: got.at.map(Math.round) }));
}
await b.close();
writeFileSync(here + '../src/stages.json', JSON.stringify(out) + '\n');
console.log('wrote src/stages.json,', Math.round(JSON.stringify(out).length / 1024), 'KB');
