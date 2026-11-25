// Midnight Tokyo's city off the course (maps/tokyo.js). Will, 2026-11-25, of the first cut (maps/blocks.js, the New
// York fronts): "some buildings are just too low ploy looking", "more low poly background buildings", and "it doesn't
// feel japanese enough ... Could we have Kaiju on billboards?" Those fronts had a window five voxels by eight in a
// floor of twelve, twice the size of anything on the voxel buildings beside them, and nothing stood off the wall.
//
// So these are still boxes nothing can reach, a picture on every side a voxel to a pixel, but:
//   - the fronts are Tokyo's and fine: a floor is eight voxels, a bay eight with two or four lights in it. Six kinds:
//     white tile offices with ribbon windows lit a run of bays at a time, cool white; blocks of flats, a balcony and a
//     lit door to each; glass towers; pencil buildings with small windows and their air conditioners; red brick with
//     pale bands; black glass. A street floor of shop windows under their curtains, shutters, vending machines and red
//     lanterns.
//   - things stand off them: a slab to every floor of the flats and a ledge every few floors of an office (near the
//     course), railings, air conditioners, tanks and masts on the roofs, a red light on the tall ones;
//   - and they carry signs (maps/tokyoart.js): words in katakana down boards that hang out from the corners, lit from
//     inside; great lit billboards on the roofs and posters on the walls that face the course: the monster films and
//     what the street sells.
// The builder is maps/cityblocks.js (the other cities use it too); this file is what is Tokyo's: the fronts, the street
// floor, and the sheet of signs.
import { poster, POSTERS, FILMS, sign, SIGN_WORDS, SIGN_INKS } from './tokyoart.js';
import { BAY, FLOOR, TW, TH, SHOP, rnd, tex, atlas, makeCityBlocks } from './cityblocks.js';
export { shapeOf, SIDE, makeCrowd, makePetals, makeBoats } from './cityblocks.js';
import * as THREE from 'three';

export const STYLES = ['office', 'flats', 'glass', 'pencil', 'brick', 'dark'];
const COOL = ['#eaf4ff', '#d8ecff', '#f3fbff', '#fff4dc'], WARM = ['#ffd98a', '#ffe6b0', '#ffc66a', '#fff0cc'];
const CAP = { office: [0.62, 0.64, 0.67], flats: [0.66, 0.62, 0.56], glass: [0.2, 0.25, 0.3], pencil: [0.56, 0.54, 0.5], brick: [0.7, 0.66, 0.58], dark: [0.12, 0.13, 0.15] };

// a front: [the picture, what of it is lit]. A cell is a bay of a floor, x 0..7 across and y 0..7 up.
function fronts(kind, seed) {
  const cv = document.createElement('canvas'), ev = document.createElement('canvas'); cv.width = ev.width = TW; cv.height = ev.height = TH;
  const g = cv.getContext('2d'), e = ev.getContext('2d'), r = rnd(seed), pick = (a) => a[Math.floor(r() * a.length)];
  e.fillStyle = '#000'; e.fillRect(0, 0, TW, TH);
  const px = (X, Y, col, lit = 0) => { g.fillStyle = col; g.fillRect(X, TH - 1 - Y, 1, 1); if (lit) { e.fillStyle = col; e.globalAlpha = lit; e.fillRect(X, TH - 1 - Y, 1, 1); e.globalAlpha = 1; } };
  for (let fl = 0; fl < TH / FLOOR; fl++) {
    // an office floor is lit a run of bays at a time; a glass tower has floors that are mostly lit and floors mostly dark
    let run = 0, on = false, col = COOL[0], dim = 1; const busy = r() < 0.3 ? 0.6 : 0.18;
    for (let b = 0; b < TW / BAY; b++) {
      if (--run < 0) { run = Math.floor(r() * 4); on = r() < 0.36; col = pick(COOL); dim = 0.7 + r() * 0.3; }
      const flat = r() < 0.32, fcol = pick(WARM), fdim = 0.6 + r() * 0.4, ac = r() < 0.4, half = [r() < busy, r() < busy], hcol = [pick(r() < 0.75 ? COOL : WARM), pick(COOL)], tone = r() < 0.5, wl = [r() < 0.3, r() < 0.3], club = r() < 0.5 ? pick(['#ff5ad0', '#5cf0ff', '#ffe14a', '#eaf4ff']) : pick(COOL);
      for (let y = 0; y < FLOOR; y++) for (let x = 0; x < BAY; x++) {
        const X = b * BAY + x, Y = fl * FLOOR + y;
        if (kind === 'office') {
          if (y <= 2) px(X, Y, y === 2 ? '#e3e6e8' : x % 4 === 0 ? '#b9bec2' : '#cdd1d4');
          else if (y === 7) px(X, Y, '#6f767d');
          else if (x === 0 || x === 4) px(X, Y, x ? '#7f868d' : '#aab0b5');
          else if (on) px(X, Y, y === 6 ? '#ffffff' : col, (y === 6 ? 1 : 0.8) * dim); else px(X, Y, y === 6 ? '#1b2836' : '#22303f');
        } else if (kind === 'flats') {
          if (x === 0) px(X, Y, '#b7a892');
          else if (y === 7) px(X, Y, '#c9bba4');
          else if (y <= 2) px(X, Y, y === 2 ? '#ebe6da' : (x + fl) % 3 ? '#cfc7b6' : '#c2b9a6');
          else if (x >= 2 && x <= 5 && y <= 6) { if (flat) px(X, Y, x <= 3 ? fcol : '#fff6dc', (x <= 3 ? 0.55 : 1) * fdim); else px(X, Y, '#18212c'); }
          else if (ac && x >= 6 && y === 3) px(X, Y, '#9aa0a6');
          else px(X, Y, '#3a352f');
        } else if (kind === 'glass' || kind === 'dark') {
          const dk = kind === 'dark', h = x < 4 ? 0 : 1, lit = dk ? wl[h] && half[h] || (wl[0] && wl[1]) : half[h];
          if (x % 4 === 0) px(X, Y, dk ? '#2a2f38' : '#3b4b5b');
          else if (y <= 1) px(X, Y, dk ? '#1c2129' : '#1b2c3c');
          else if (lit) px(X, Y, dk ? club : hcol[h], y === 7 ? 1 : 0.75); else px(X, Y, dk ? (tone ? '#16283a' : '#1b3044') : tone ? '#27455e' : '#2d516b');
        } else if (kind === 'pencil') {
          const win = (x === 1 || x === 2 || x === 5 || x === 6) && y >= 3 && y <= 6, w = x < 4 ? 0 : 1;
          if (win) { if (wl[w]) px(X, Y, w ? fcol : col, 0.9); else px(X, Y, '#1c2530'); }
          else if (ac && x >= 1 && x <= 2 && y >= 1 && y <= 2) px(X, Y, y === 2 ? '#a3a8ad' : '#7d8388');
          else px(X, Y, y === 0 ? '#a29c90' : x === 0 ? '#aaa498' : '#b8b2a6');
        } else {   // brick
          const win = x >= 2 && x <= 5 && y >= 2 && y <= 6 && !(y === 6 && (x === 2 || x === 5));
          if (win) { if (flat) px(X, Y, fcol, fdim); else px(X, Y, '#1a222c'); }
          else if (y === 7 || (y === 1 && x >= 2 && x <= 5)) px(X, Y, '#d8cdb8');
          else px(X, Y, (x + y * 2 + (y & 1) * 2) % 4 === 0 ? '#7a3c2e' : '#8f4937');
        }
        // a voxel's worth of grain
        const n = r(); g.fillStyle = n < 0.5 ? '#000' : '#fff'; g.globalAlpha = 0.1 * Math.abs(n - 0.5) * 2; g.fillRect(X, TH - 1 - Y, 1, 1); g.globalAlpha = 1;
      }
    }
  }
  return [tex(cv), tex(ev)];
}
// the street floor: eight bays, each a shop window under its curtain with a red lantern at the door, a shutter down for
// the night, a vending machine or a doorway; a lit band of signs over them
function street() {
  const cv = document.createElement('canvas'), ev = document.createElement('canvas'); cv.width = ev.width = TW; cv.height = ev.height = SHOP;
  const g = cv.getContext('2d'), e = ev.getContext('2d'), r = rnd(8823), pick = (a) => a[Math.floor(r() * a.length)];
  e.fillStyle = '#000'; e.fillRect(0, 0, TW, SHOP);
  const px = (X, Y, col, lit = 0) => { g.fillStyle = col; g.fillRect(X, SHOP - 1 - Y, 1, 1); if (lit) { e.fillStyle = col; e.globalAlpha = lit; e.fillRect(X, SHOP - 1 - Y, 1, 1); e.globalAlpha = 1; } };
  const KINDS = ['shop', 'shop', 'shutter', 'vend', 'shop', 'door', 'shop', 'shutter'];
  for (let b = 0; b < TW / BAY; b++) {
    const kind = KINDS[b], cloth = pick(['#1f3a6e', '#a8262a', '#e8e2d0', '#1f3a6e', '#2f6b4a']), band = pick(['#ffe14a', '#ff5a4a', '#eaf4ff', '#5cf0ff', '#ff5ad0', '#ffffff']), can = pick(['#d8322a', '#eef6ff', '#1f48a8']);
    for (let y = 0; y < SHOP; y++) for (let x = 0; x < BAY; x++) {
      const X = b * BAY + x;
      if (y >= 10) { if (kind !== 'shutter' && x >= 1 && x <= 6) px(X, y, (x + y) % 3 === 0 ? '#1a1c22' : band, 0.9); else px(X, y, '#2c2e35'); }
      else if (x === 0) px(X, y, '#4a4640');
      else if (kind === 'shutter') px(X, y, y === 9 ? '#3a3c42' : y % 2 ? '#7a8088' : '#666c74');
      else if (kind === 'vend') { if (x >= 2 && x <= 5 && y <= 7) { if (y >= 3 && y <= 6) px(X, y, (x + y) % 2 ? '#eef6ff' : pick(['#d8322a', '#f2b21e', '#1f48a8', '#0e7a4a']), 1); else px(X, y, can, y === 7 ? 0.5 : 0.25); } else px(X, y, '#33353c'); }
      else if (kind === 'door') px(X, y, x >= 3 && x <= 5 && y <= 7 ? (y >= 5 ? '#ffe6b0' : '#5b4a3c') : '#3a3c42', x >= 3 && x <= 5 && y >= 5 && y <= 7 ? 0.8 : 0);
      else if (y >= 8) px(X, y, x % 3 === 1 && y === 8 ? '#e8e2d0' : cloth, cloth === '#e8e2d0' ? 0.3 : 0);                    // the curtain over the door
      else if (x === 7 && y >= 5 && y <= 7) px(X, y, '#ff3a26', 1);                                                           // a red lantern
      else if (y < 2) px(X, y, '#55504a');
      else px(X, y, y < 4 && r() < 0.5 ? '#c98f3e' : '#ffd98a', y < 4 ? 0.6 : 1);
      const n = r(); g.fillStyle = n < 0.5 ? '#000' : '#fff'; g.globalAlpha = 0.08 * Math.abs(n - 0.5) * 2; g.fillRect(X, SHOP - 1 - y, 1, 1); g.globalAlpha = 1;
    }
  }
  const t = tex(cv), u = tex(ev); t.wrapT = u.wrapT = THREE.ClampToEdgeWrapping; return [t, u];
}

// every sign and poster on one sheet: { tex, signs: [small boards], bigs: [boards twice the size], films / ads: { wide,
// great, tall } }, each [u0, v0, u1, v1, w, h]
function sheet() {
  const A = atlas(), out = { signs: [], bigs: [], films: { wide: [], great: [], tall: [] }, ads: { wide: [], great: [], tall: [] } };
  const add = (P, list) => list.push(A.add(P));
  SIGN_WORDS.forEach((w, i) => { add(sign(w, SIGN_INKS[i % SIGN_INKS.length]), out.signs); add(sign(w, SIGN_INKS[(i * 3 + 4) % SIGN_INKS.length]), out.signs); if (w.length <= 4) add(sign(w, SIGN_INKS[(i * 7 + 1) % SIGN_INKS.length], 2), out.bigs); });
  for (const k of POSTERS) { const to = FILMS.includes(k) ? out.films : out.ads; add(poster(k, 64, 40), to.wide); add(poster(k, 28, 44), to.tall); if (FILMS.includes(k)) add(poster(k, 96, 56), to.great); }
  out.ads.great = out.films.great; out.hero = [];
  for (const k of FILMS) add(poster(k, 144, 84), out.hero);
  const t = A.pack(), rects = (l) => l.map((it) => it.rect);
  return { tex: t, hero: rects(out.hero), signs: rects(out.signs), bigs: rects(out.bigs), films: { wide: rects(out.films.wide), great: rects(out.films.great), tall: rects(out.films.tall) }, ads: { wide: rects(out.ads.wide), great: rects(out.films.great), tall: rects(out.ads.tall) } };
}

const KIT = { key: 'tokyo', styles: STYLES, cap: CAP, fronts, street, sheet };
export const makeTokyoBlocks = (scene, list, clock = { value: 0 }, heroes = []) => makeCityBlocks(scene, list, KIT, clock, heroes);
