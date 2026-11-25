// Empire City's city off the course (maps/empire.js), with the builder Midnight Tokyo's was written for
// (maps/cityblocks.js). Will, 2026-11-25: "the same final pass to both washington DC and New York". The first cut
// (maps/blocks.js) had a window five voxels by eight in a floor of twelve and nothing on the walls. These are New
// York's, a floor eight voxels and a bay eight:
//   brick   a red brick tenement, a pale lintel over each window, and a fire escape zigzagging down every eighth bay
//   brown   a brownstone: tall windows under heavy heads, a band at every floor
//   tan     a pre-war apartment house: windows in pairs, an air conditioner in one here and there, stone bands
//   lime    a limestone tower between the wars: piers running straight up, dark metal panels under the windows
//   glass   a glass tower with the evening sky in it, floors lit a run at a time
// a street floor of delis, diners and bars under striped awnings; wooden water tanks on the roofs; stepped crowns with
// a lit top on the tall limestone towers; blade signs down the corners, and the shows and the street's ads on the roofs
// and the walls (maps/nycart.js). It is dusk: about a window in three is lit.
import * as THREE from 'three';
import { poster, POSTERS, FILMS, sign, SIGN_WORDS, SIGN_INKS } from './nycart.js';
import { BAY, FLOOR, TW, TH, SHOP, rnd, tex, atlas, makeCityBlocks } from './cityblocks.js';

export const STYLES = ['tan', 'brick', 'brown', 'lime', 'glass'];
const CAP = { tan: [0.78, 0.72, 0.6], brick: [0.76, 0.7, 0.62], brown: [0.32, 0.23, 0.19], lime: [0.8, 0.75, 0.64], glass: [0.2, 0.25, 0.3] };
const WARM = ['#ffd98a', '#ffe6b0', '#ffc66a', '#fff0cc'], TV = '#a8d0ff';

function fronts(kind, seed) {
  const cv = document.createElement('canvas'), ev = document.createElement('canvas'); cv.width = ev.width = TW; cv.height = ev.height = TH;
  const g = cv.getContext('2d'), e = ev.getContext('2d'), r = rnd(seed), pick = (a) => a[Math.floor(r() * a.length)];
  e.fillStyle = '#000'; e.fillRect(0, 0, TW, TH);
  const px = (X, Y, col, lit = 0) => { g.fillStyle = col; g.fillRect(X, TH - 1 - Y, 1, 1); if (lit) { e.fillStyle = col; e.globalAlpha = lit; e.fillRect(X, TH - 1 - Y, 1, 1); e.globalAlpha = 1; } };
  for (let fl = 0; fl < TH / FLOOR; fl++) {
    let run = 0, on = false, col = WARM[0];
    for (let b = 0; b < TW / BAY; b++) {
      if (--run < 0) { run = Math.floor(r() * 4); on = r() < 0.4; col = pick(['#fff0cc', '#eaf4ff', '#ffe6b0']); }
      const home = r() < 0.36, hcol = r() < 0.14 ? TV : pick(WARM), dim = 0.6 + r() * 0.4, ac = r() < 0.22, shade = r() < 0.4 ? 1 + Math.floor(r() * 3) : 0, pair = [r() < 0.36, r() < 0.36], tone = r() < 0.5;
      for (let y = 0; y < FLOOR; y++) for (let x = 0; x < BAY; x++) {
        const X = b * BAY + x, Y = fl * FLOOR + y;
        if (kind === 'brick') {
          const win = x >= 2 && x <= 5 && y >= 2 && y <= 6;
          if (win) { if (home && y <= 6 - shade) px(X, Y, hcol, dim); else px(X, Y, home ? '#d8c8a0' : y === 6 ? '#10161e' : '#1a222c', home ? dim * 0.5 : 0); }
          else if (y === 7 && x >= 1 && x <= 6) px(X, Y, '#d8cdb8');
          else if (y === 1 && x >= 2 && x <= 5) px(X, Y, '#b9ad98');
          else px(X, Y, (x + y * 2 + (y & 1) * 2) % 4 === 0 ? '#7a3a2c' : (x * 3 + y) % 7 === 0 ? '#a25540' : '#8f4937');
          // the fire escape: two bays wide, a landing at every floor and a stair up to the next
          if (b === 2 || b === 3) { const t = (b - 2) * BAY + x; if (y === 1 || (y === 3 && t % 2 === 0) || (y === 2 && (t === 0 || t === 15)) || y === 1 + Math.floor(t / 2) || (t >= 2 && y === Math.floor(t / 2))) px(X, Y, y === 1 ? '#0e0f12' : '#1b1d22'); }
        } else if (kind === 'brown') {
          const win = x >= 2 && x <= 5 && y >= 1 && y <= 6 && !(y === 6 && (x === 2 || x === 5));
          if (win) { if (home && y <= 6 - shade) px(X, Y, hcol, dim); else px(X, Y, home ? '#c8b088' : '#171c24', home ? dim * 0.45 : 0); }
          else if (y === 7) px(X, Y, x >= 1 && x <= 6 ? '#3e2a22' : '#5a3d32');
          else if (y === 0) px(X, Y, '#7d5646');
          else px(X, Y, (x + y) % 5 === 0 ? '#63412f' : '#6f4c3e');
        } else if (kind === 'tan') {
          const w = x < 4 ? 0 : 1, win = (x === 1 || x === 2 || x === 5 || x === 6) && y >= 2 && y <= 6;
          if (win) { if (ac && w === 1 && y <= 3) px(X, Y, y === 3 ? '#b4b8bc' : '#8c9196'); else if (pair[w] && y <= 6 - shade) px(X, Y, w ? hcol : pick(WARM), dim); else px(X, Y, pair[w] ? '#d4c296' : '#1c2530', pair[w] ? dim * 0.45 : 0); }
          else if (fl % 4 === 0 && y === 0) px(X, Y, '#e6dcc6');
          else if (y === 1 && (x === 1 || x === 2 || x === 5 || x === 6)) px(X, Y, '#dfd3ba');
          else px(X, Y, (x + y * 3) % 5 === 0 ? '#b3885c' : '#c2966a');
        } else if (kind === 'lime') {
          if (x === 0 || x === 4) px(X, Y, x ? '#cfc2a6' : '#e2d6bc');
          else if (y <= 1) px(X, Y, (x + y) % 2 ? '#3b4250' : '#4a5262');
          else if (on) px(X, Y, y === 7 ? '#ffffff' : col, y === 7 ? 0.9 : 0.75); else px(X, Y, y === 7 ? '#33495c' : tone ? '#4a6478' : '#56738c');
        } else {   // glass: the evening in it, warmer toward the top of each pane
          const h = x < 4 ? 0 : 1, litp = on && pair[h] !== tone;
          if (x % 4 === 0) px(X, Y, '#2f3b46');
          else if (y === 0) px(X, Y, '#26323c');
          else if (litp) px(X, Y, col, y === 7 ? 1 : 0.7); else px(X, Y, ['#4f7f9a', '#5a8aa2', '#6a94a8', '#7f9cac', '#9aa4ae', '#b89c9c', '#cf9a8c'][Math.min(6, y - 1 + (tone ? 0 : 0))]);
        }
        const n = r(); g.fillStyle = n < 0.5 ? '#000' : '#fff'; g.globalAlpha = 0.1 * Math.abs(n - 0.5) * 2; g.fillRect(X, TH - 1 - Y, 1, 1); g.globalAlpha = 1;
      }
    }
  }
  return [tex(cv), tex(ev)];
}
// the street floor: eight bays under a band of signs: a deli and a diner under striped awnings, a bar's door with its
// neon, a shutter someone has written on, a fruit stand, a laundry
function street() {
  const cv = document.createElement('canvas'), ev = document.createElement('canvas'); cv.width = ev.width = TW; cv.height = ev.height = SHOP;
  const g = cv.getContext('2d'), e = ev.getContext('2d'), r = rnd(5151), pick = (a) => a[Math.floor(r() * a.length)];
  e.fillStyle = '#000'; e.fillRect(0, 0, TW, SHOP);
  const px = (X, Y, col, lit = 0) => { g.fillStyle = col; g.fillRect(X, SHOP - 1 - Y, 1, 1); if (lit) { e.fillStyle = col; e.globalAlpha = lit; e.fillRect(X, SHOP - 1 - Y, 1, 1); e.globalAlpha = 1; } };
  const KINDS = ['deli', 'bar', 'shop', 'shutter', 'fruit', 'diner', 'door', 'wash'];
  for (let b = 0; b < TW / BAY; b++) {
    const kind = KINDS[b], awn = pick(['#b3362e', '#2f6b4a', '#2c4f8a', '#c9952c', '#7a2f52']), band = pick(['#ffe14a', '#ff5a4a', '#eaf4ff', '#58e8ff', '#ff6ad8', '#7dff8a']), tag = pick(['#ff6ad8', '#58e8ff', '#ffe14a']);
    for (let y = 0; y < SHOP; y++) for (let x = 0; x < BAY; x++) {
      const X = b * BAY + x;
      if (y >= 10) { if (kind !== 'shutter' && kind !== 'door' && x >= 1 && x <= 6) px(X, y, (x * 2 + y) % 3 === 0 ? '#1a1c22' : band, 0.85); else px(X, y, '#2c2e35'); }
      else if (x === 0) px(X, y, '#4a4640');
      else if (kind === 'shutter') { if ((y === 4 && x >= 2 && x <= 5) || (y === 5 && (x === 2 || x === 4)) || (y === 3 && (x === 3 || x === 5))) px(X, y, tag); else px(X, y, y === 9 ? '#3a3c42' : y % 2 ? '#7a8088' : '#666c74'); }
      else if (kind === 'door') px(X, y, x >= 3 && x <= 5 && y <= 8 ? (y >= 6 ? '#ffe6b0' : '#4a2f22') : y === 9 ? '#5a3d32' : '#6f4c3e', x >= 3 && x <= 5 && y >= 6 && y <= 8 ? 0.7 : 0);
      else if (kind === 'bar') { if (x >= 5 && y <= 7) px(X, y, y >= 5 ? '#3a1410' : '#4a2f22'); else if (y >= 3 && y <= 6 && x >= 1 && x <= 3) px(X, y, (x + y) % 2 ? '#ff4a3a' : '#2a0c0c', (x + y) % 2 ? 1 : 0.2); else px(X, y, '#241a1a'); }
      else if (y >= 8) px(X, y, x % 2 ? awn : '#f0e8d8');                                              // the awning
      else if (y < 2) px(X, y, kind === 'diner' ? '#b8bcc4' : '#55504a');
      else if (kind === 'fruit' && y <= 3) px(X, y, pick(['#e2362a', '#f2a21e', '#f7d84a', '#5aa83a']), 0.3);
      else if (kind === 'wash') px(X, y, (x % 3 === 1 && y >= 3 && y <= 5) ? '#eaf4ff' : '#9fc4e8', 0.8);
      else if (kind === 'diner') px(X, y, y === 7 ? '#ff5a4a' : y < 4 && x % 3 === 0 ? '#b8281e' : '#ffe6b0', y === 7 ? 1 : 0.85);
      else px(X, y, y < 4 && r() < 0.5 ? '#c98f3e' : '#ffd98a', y < 4 ? 0.55 : 0.95);
      const n = r(); g.fillStyle = n < 0.5 ? '#000' : '#fff'; g.globalAlpha = 0.08 * Math.abs(n - 0.5) * 2; g.fillRect(X, SHOP - 1 - y, 1, 1); g.globalAlpha = 1;
    }
  }
  const t = tex(cv), u = tex(ev); t.wrapT = u.wrapT = THREE.ClampToEdgeWrapping; return [t, u];
}
function sheet() {
  const A = atlas(), out = { signs: [], bigs: [], films: { wide: [], great: [], tall: [] }, ads: { wide: [], great: [], tall: [] }, hero: [] };
  const add = (P, list) => list.push(A.add(P));
  SIGN_WORDS.forEach((w, i) => { add(sign(w, SIGN_INKS[i % SIGN_INKS.length]), out.signs); add(sign(w, SIGN_INKS[(i * 3 + 4) % SIGN_INKS.length]), out.signs); if (w.length <= 5) add(sign(w, SIGN_INKS[(i * 7 + 1) % SIGN_INKS.length], 2), out.bigs); });
  for (const k of POSTERS) { const to = FILMS.includes(k) ? out.films : out.ads; add(poster(k, 64, 40), to.wide); add(poster(k, 28, 44), to.tall); if (FILMS.includes(k)) add(poster(k, 96, 56), to.great); }
  for (const k of FILMS) add(poster(k, 144, 84), out.hero);
  const t = A.pack(), rects = (l) => l.map((it) => it.rect);
  return { tex: t, hero: rects(out.hero), signs: rects(out.signs), bigs: rects(out.bigs), films: { wide: rects(out.films.wide), great: rects(out.films.great), tall: rects(out.films.tall) }, ads: { wide: rects(out.ads.wide), great: rects(out.films.great), tall: rects(out.ads.tall) } };
}
// a tall limestone tower's crown: three steps in, a lit lantern, a needle
function dress(B, { r, kind, floors, roof, cap, box, lamps, STEEL }) {
  if (kind !== 'lime' || floors < 28) return;
  let [x0, z0, x1, z1, y] = roof; const GOLD = [2.3, 1.7, 0.8];
  y += 1.5;
  for (let i = 0; i < 3; i++) { const inx = (x1 - x0) * 0.16, inz = (z1 - z0) * 0.16, h = 10 + r() * 6; x0 += inx; z0 += inz; x1 -= inx; z1 -= inz; if (x1 - x0 < 6 || z1 - z0 < 6) break; box(x0, z0, x1, z1, y, y + h, cap.map((v) => v * (0.95 - i * 0.05)), cap.map((v) => v * 0.6)); y += h; }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = Math.min(x1 - x0, z1 - z0) * 0.3;
  box(cx - w, cz - w, cx + w, cz + w, y, y + 5, GOLD, GOLD, lamps); box(cx - w * 0.5, cz - w * 0.5, cx + w * 0.5, cz + w * 0.5, y + 5, y + 12, cap.map((v) => v * 0.8)); box(cx - 0.6, cz - 0.6, cx + 0.6, cz + 0.6, y + 12, y + 34, STEEL);
}
const KIT = {
  key: 'nyc', styles: STYLES, cap: CAP, fronts, street, sheet, dress,
  glow: [0.16, 0.1, 0.06], emissive: 1.25, lit: [1.3, 1.3, 1.3], shown: [0.98, 0.98, 0.98], heroLit: [1.1, 1.1, 1.1],
  tank: 'wood', tankShare: 0.8, bare: ['glass', 'lime'],
  ledge: { tan: [4, 0.7], brick: [5, 0.6], brown: [1, 0.5], lime: [6, 0.8], glass: [8, 0.4] },
  hang: { corner: [0.55, 0.35], row: 150, share: 0.3 }, board: [0.5, 0.28, 0.5], poster: [0.4, 0.14, 0.5],
};
export const makeNycBlocks = (scene, list, clock = { value: 0 }, heroes = []) => makeCityBlocks(scene, list, KIT, clock, heroes);
