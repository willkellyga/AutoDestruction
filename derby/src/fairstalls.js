// Dead Man's Fair's stalls, trucks and signs (maps/fair.js lists them): everything a car is close up to on the midway,
// so it is modelled at twice the town's detail (cubes of half a voxel) and is meshes, not voxels.
//   game stalls   a counter under a striped awning with the game inside it: ring toss, balloon pop, a can pyramid, a
//                 duck pond, a shooting gallery, hoops, a prize wheel. Prize bears hang along the back.
//   food stalls   a kiosk with a serving window and the thing it sells, huge, on the roof: fried Oreos, corn dogs,
//                 cotton candy, popcorn, lemonade.
//   food trucks   tacos, ice cream, burgers. Steel: a car bounces off them.
//   signs         arches over the ways in to the midway and the avenue, signs on poles, high strikers, a ticket booth,
//                 the big top's and the main gate's names in neon.
//   and           the lamp posts, and the generator on its trailer.
// Every one has a neon sign (letters drawn once into one picture shared by all of them), rows of bulbs that chase,
// and a lit window or back wall. The lit parts are one unlit material a quarter of the fair, so they flicker and go
// out with that quarter's power (the map's POWER.lit) at no cost.
// A stall is smashed by driving through it, by shooting it or by a blast: it flies apart in cubes and leaves a heap.
// The trucks and the arches' posts only stop cars and shots.
// Draws: one for all the paint, one a quarter for the lights, one for the heaps (and the paint again for its shadow).
import * as THREE from 'three';
import { sparks, dust } from '../../src/sim.js';
import { TONE } from './looks/kit.js';

const TAU = Math.PI * 2, HV = 0.5;   // a cube of the models is half a voxel
// ---- colours --------------------------------------------------------------------------------------------------------
const RED = 0xc8342c, WHITE = 0xeee8da, YELLOW = 0xe8b830, BLUE = 0x2f6fc0, GREEN = 0x3c9a52, DARK = 0x24262c, TEAL = 0x1f9c98,
  PINK = 0xe86aa8, PURPLE = 0x7a4ac0, ORANGE = 0xe2752a, WOOD = 0x8a6238, WOODL = 0xb88a52, PLANK = 0x5c4630, STEEL = 0x8e969c,
  NAVY = 0x243a6a, CREAM = 0xf4ead0, BROWN = 0x6a4326, GOLD = 0xc98a2c, TAN = 0xd9a45e, SKY = 0x7ac4ee, LIME = 0x9ad03c, TYRE = 0x1a1a1c;
// what glows (unlit, bright enough to bloom): r, g, b
const N = {
  pink: [2.6, 0.5, 1.5], blue: [0.5, 1.3, 2.8], yellow: [2.6, 1.9, 0.4], green: [0.5, 2.5, 0.8], red: [2.8, 0.45, 0.35], white: [2.2, 2.1, 1.9],
  orange: [2.7, 1.1, 0.3], purple: [1.6, 0.6, 2.8], cyan: [0.4, 2.3, 2.5], warm: [2.2, 1.6, 0.8],
};
const CSS = { pink: '#ff4fb0', blue: '#52b4ff', yellow: '#ffd23e', green: '#4dff8a', red: '#ff4a3c', white: '#fff4e0', orange: '#ff9a30', purple: '#b86aff', cyan: '#44f0ff', warm: '#ffc878' };
const CHASE = ['red', 'yellow', 'blue', 'green', 'white'];

// ---- the signs' picture: every sign's letters, drawn once ---------------------------------------------------------------
const ATLAS = { W: 2048, H: 1024, list: new Map(), x: 16, y: 0, row: 0, tex: null, cv: null };   // (the first 16 across are the white corner)
function signRect(text, wHV, hHV, colour, frame) {
  const key = `${text}|${wHV}|${hHV}|${colour}|${frame}`;
  let r = ATLAS.list.get(key);
  if (!r) {
    const S = wHV > 60 ? 8 : wHV > 40 ? 10 : 12;   // dots a cube: fewer on the big boards, which are seen from further off
    const pw = Math.round(wHV * S), ph = Math.round(hHV * S);
    if (ATLAS.x + pw > ATLAS.W) { ATLAS.x = 0; ATLAS.y += ATLAS.row + 2; ATLAS.row = 0; }
    r = { text, colour, frame, px: ATLAS.x, py: ATLAS.y, pw, ph, S };
    ATLAS.x += pw + 2; ATLAS.row = Math.max(ATLAS.row, ph);
    if (r.py + ph > ATLAS.H) { r.px = 16; r.py = 0; console.error('fair signs: the picture is full', text); }   // (out of room: it shares the first sign's place)
    ATLAS.list.set(key, r);
  }
  return r;
}
function drawSigns() {
  const cv = ATLAS.cv || (ATLAS.cv = document.createElement('canvas'));
  cv.width = ATLAS.W; cv.height = ATLAS.H;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, ATLAS.W, ATLAS.H);
  g.fillStyle = '#fff'; g.fillRect(0, 0, 14, 14);   // the white corner the bulbs and lit panels are drawn from
  for (const r of ATLAS.list.values()) {
    const { px, py, pw, ph, S } = r, col = CSS[r.colour], col2 = CSS[r.frame];
    g.save(); g.beginPath(); g.rect(px, py, pw, ph); g.clip();
    g.fillStyle = '#100d18'; g.fillRect(px, py, pw, ph);
    // the tube round the edge
    g.strokeStyle = col2; g.lineWidth = S * 0.4; g.shadowColor = col2; g.shadowBlur = S * 0.9;
    const m = S * 0.8, rad = S * 1.2;
    for (let k = 0; k < 2; k++) { g.beginPath(); g.roundRect(px + m, py + m, pw - 2 * m, ph - 2 * m, rad); g.stroke(); }
    // the letters: as tall as fits, squeezed if the words are long
    const size = ph * 0.64; g.font = `${size}px Anton, Impact, 'Arial Narrow', sans-serif`;
    const room = pw - S * 3.4, w = g.measureText(r.text).width;
    const sx = Math.min(1.45, room / w);   // (and stretched a little where the board is wide)
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.translate(px + pw / 2, py + ph / 2 + size * 0.04); g.scale(sx, 1);
    g.shadowColor = col; g.shadowBlur = S * 1.3; g.fillStyle = col;
    g.fillText(r.text, 0, 0); g.fillText(r.text, 0, 0);
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillText(r.text, 0, 0);
    g.restore();
  }
  if (!ATLAS.tex) { ATLAS.tex = new THREE.CanvasTexture(cv); ATLAS.tex.colorSpace = THREE.SRGBColorSpace; ATLAS.tex.anisotropy = 4; }
  ATLAS.tex.needsUpdate = true;
}

// ---- the kit: boxes in the model's cubes, turned and placed in the world --------------------------------------------------
const FACES = [
  [[1, 0, 0], [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]], [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
  [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]], [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
  [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]], [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]],
];
const _c = new THREE.Color();
const WHITE_UV = [7 / ATLAS.W, 1 - 7 / ATLAS.H];
// a kit writes into `paint` (lit by the day, casts a shadow) and `lit` (glows); at (ox, oz), its front (the model's +z)
// turned to face yaw (0: south, as a car's)
function makeKit(ox, oz, yaw) {
  const co = Math.cos(yaw), si = Math.sin(yaw);
  const P = { p: [], n: [], c: [], i: [] }, L = { p: [], c: [], u: [], h: [], i: [] };
  const wx = (x, z) => ox + (x * co + z * si) * HV, wz = (x, z) => oz + (-x * si + z * co) * HV;
  function faces(x, y, z, w, h, d, each) {
    for (const [n, cs] of FACES) {
      if (n[1] < 0 && y <= 0) continue;   // (nothing sees the underside of what stands on the ground)
      each(n, cs.map(([a, b, c]) => [x + a * w, y + b * h, z + c * d]));
    }
  }
  const K = {
    cols: [],   // the colours it is painted in, for the cubes it flies apart into
    b(x, y, z, w, h, d, hex) {
      _c.setHex(hex, THREE.SRGBColorSpace);
      if (K.cols.length < 24 && !K.cols.includes(hex)) K.cols.push(hex);
      faces(x, y, z, w, h, d, (n, cs) => {
        const at = P.p.length / 3;
        for (const [a, b, c] of cs) { P.p.push(wx(a, c), b * HV, wz(a, c)); P.n.push(n[0] * co + n[2] * si, n[1], -n[0] * si + n[2] * co); P.c.push(_c.r, _c.g, _c.b); }
        P.i.push(at, at + 1, at + 2, at, at + 2, at + 3);
      });
    },
    // a lit box: rgb as N's, ph its part in a chase (0: steady; 0 to 1: its turn in the chase; under 0: it twinkles)
    l(x, y, z, w, h, d, rgb, ph = 0, k = 1) {
      faces(x, y, z, w, h, d, (n, cs) => {
        const at = L.p.length / 3;
        for (const [a, b, c] of cs) { L.p.push(wx(a, c), b * HV, wz(a, c)); L.c.push(rgb[0] * k, rgb[1] * k, rgb[2] * k); L.u.push(WHITE_UV[0], WHITE_UV[1]); L.h.push(ph); }
        L.i.push(at, at + 1, at + 2, at, at + 2, at + 3);
      });
    },
    // n boxes side by side along x, in two colours turn about
    stripes(x, y, z, w, h, d, n, a, b) { const s = w / n; for (let i = 0; i < n; i++) K.b(x + i * s, y, z, s, h, d, i & 1 ? b : a); },
    // a disc standing up, facing front and back (in rows of cubes); col: a colour or (dx, dy) => colour; lit: N's rgb
    discXY(cx, cy, z, r, d, col, lit = null) {
      for (let dy = -r; dy < r; dy++) {
        const half = Math.floor(Math.sqrt(r * r - (dy + 0.5) * (dy + 0.5)) + 0.5); if (half <= 0) continue;
        if (typeof col !== 'function') { if (lit) K.l(cx - half, cy + dy, z, 2 * half, 1, d, lit); else K.b(cx - half, cy + dy, z, 2 * half, 1, d, col); continue; }
        let x0 = -half, c0 = col(-half + 0.5, dy + 0.5);
        for (let dx = -half + 1; dx <= half; dx++) { const c = dx < half ? col(dx + 0.5, dy + 0.5) : null; if (c !== c0) { K.b(cx + x0, cy + dy, z, dx - x0, 1, d, c0); x0 = dx; c0 = c; } }
      }
    },
    // a disc lying flat
    discXZ(cx, y, cz, r, h, col) {
      for (let dz = -r; dz < r; dz++) { const half = Math.floor(Math.sqrt(r * r - (dz + 0.5) * (dz + 0.5)) + 0.5); if (half > 0) K.b(cx - half, y, cz + dz, 2 * half, h, 1, col); }
    },
    // a row of bulbs along x (or along z with `alongZ`), every `step`, chasing
    bulbs(x0, x1, y, z, step, alongZ = false, size = 1) {
      const n = Math.max(1, Math.floor((x1 - x0) / step));
      for (let i = 0; i <= n; i++) { const t = x0 + i * step, rgb = N[CHASE[i % CHASE.length]]; if (alongZ) K.l(z, y, t, size, size, size, rgb, 0.05 + (i % 6) / 6 * 0.9); else K.l(t, y, z, size, size, size, rgb, 0.05 + (i % 6) / 6 * 0.9); }
    },
    // a neon sign: its board, and its letters on the front and on the back; w by h cubes, its middle at (cx, cy), its
    // front face at z
    sign(text, cx, cy, z, w, h, colour = 'pink', frame = 'cyan', thick = 1) {
      K.b(cx - w / 2, cy - h / 2, z - thick, w, h, thick, DARK);
      const r = signRect(text, w, h, colour, frame);
      const u0 = r.px / ATLAS.W, u1 = (r.px + r.pw) / ATLAS.W, v1 = 1 - r.py / ATLAS.H, v0 = 1 - (r.py + r.ph) / ATLAS.H;
      const quad = (zz, flip) => {
        const at = L.p.length / 3, xa = flip ? cx + w / 2 : cx - w / 2, xb = flip ? cx - w / 2 : cx + w / 2;
        for (const [x, y, u, v] of [[xa, cy - h / 2, u0, v0], [xb, cy - h / 2, u1, v0], [xb, cy + h / 2, u1, v1], [xa, cy + h / 2, u0, v1]]) { L.p.push(wx(x, zz), y * HV, wz(x, zz)); L.c.push(1.35, 1.35, 1.35); L.u.push(u, v); L.h.push(0); }
        L.i.push(at, at + 1, at + 2, at, at + 2, at + 3);
      };
      quad(z + 0.08, false); quad(z - thick - 0.08, true);
    },
    geos() {
      const paint = new THREE.BufferGeometry();
      paint.setAttribute('position', new THREE.Float32BufferAttribute(P.p, 3)); paint.setAttribute('normal', new THREE.Float32BufferAttribute(P.n, 3)); paint.setAttribute('color', new THREE.Float32BufferAttribute(P.c, 3)); paint.setIndex(P.i);
      const lit = new THREE.BufferGeometry();
      lit.setAttribute('position', new THREE.Float32BufferAttribute(L.p, 3)); lit.setAttribute('color', new THREE.Float32BufferAttribute(L.c, 3)); lit.setAttribute('uv', new THREE.Float32BufferAttribute(L.u, 2)); lit.setAttribute('ph', new THREE.Float32BufferAttribute(L.h, 1)); lit.setIndex(L.i);
      paint.computeBoundingSphere(); lit.computeBoundingSphere();
      return { paint, lit };
    },
  };
  return K;
}

// ---- the models -------------------------------------------------------------------------------------------------------
// a prize bear, sitting, facing front
function bear(K, x, y, z, col) {
  K.b(x, y, z, 3, 3, 2, col); K.b(x + 0.5, y + 3, z, 2, 2, 2, col);
  K.b(x, y + 4.5, z + 0.5, 1, 1, 1, col); K.b(x + 2, y + 4.5, z + 0.5, 1, 1, 1, col);
  K.b(x + 1, y + 3, z + 2, 1, 1, 0.5, CREAM); K.b(x + 1, y + 0.5, z + 2, 1, 1.5, 0.5, CREAM);
  K.b(x - 0.5, y + 1.5, z + 0.5, 0.5, 1.5, 1, col); K.b(x + 3, y + 1.5, z + 0.5, 0.5, 1.5, 1, col);
}
const BEARS = [PINK, SKY, YELLOW, LIME, PURPLE, ORANGE, WHITE];
// A game stall, 28 cubes wide and 16 deep (14 by 8 voxels), open to the front: the floor, the back and sides, the
// counter, the striped roof and the awning out over the counter with its scalloped edge and its bulbs, and the sign on
// the roof.
function booth(K, o) {
  const a = o.a, b = o.b ?? WHITE;
  K.b(-14, 0, -8, 28, 1, 16, PLANK);
  K.b(-14, 1, -8, 28, 17, 1, o.back ?? a);
  for (const sx of [-14, 13]) { K.b(sx, 1, -7, 1, 6, 14, a); K.b(sx, 7, -7, 1, 1, 14, b); for (const sz of [-8, 7]) K.b(sx, 1, sz, 1, 17, 1, b); }
  K.stripes(-14, 1, 7, 28, 5, 1, 14, a, b); K.b(-14, 6, 5, 28, 1, 4, WOODL);
  K.stripes(-15, 18, -9, 30, 1, 14, 15, a, b);
  for (let k = 0; k < 3; k++) K.stripes(-15, 17 - k, 5 + 2 * k, 30, 1, 2, 15, a, b);
  for (let i = 0; i < 15; i++) K.b(-15 + 2 * i, i & 1 ? 14 : 13, 10, 2, i & 1 ? 1 : 2, 1, i & 1 ? b : a);
  K.bulbs(-14.5, 14, 16, 10, 2);
  K.l(-12, 16.4, -6, 24, 0.6, 1, N.warm, 0, 0.75);                    // the strip light inside
  for (const x of [-11, 10]) K.b(x, 19, -3, 1, 5, 4, DARK);          // the sign's stays
  K.sign(o.name, 0, 24, 1, 26, 9, o.neon, o.frame);
  K.bulbs(-13, 13, 28.5, 0, 2, false, 1);
  // the prizes along the back, hung high
  for (let i = 0; i < 6; i++) bear(K, -12 + i * 4.2, 12, -7, BEARS[(i + (o.seed || 0)) % BEARS.length]);
  GAMES[o.game](K, o);
}
const GAMES = {
  ring(K) {
    K.b(-10, 1, -5, 20, 4, 8, WOOD); K.b(-10, 5, -5, 20, 0.5, 8, GREEN);
    for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) { const x = -9.5 + i * 3, z = -4.5 + j * 3, c = [GREEN, BROWN, BLUE][(i + j) % 3]; K.b(x, 5.5, z, 1, 3, 1, c); K.b(x, 8.5, z, 1, 1, 1, WHITE); }
    for (const [x, z, c] of [[-7, -2, RED], [2, -5, YELLOW], [5, 1, RED], [-1, 1, YELLOW]]) K.b(x, 7, z, 2, 0.5, 2, c);
    for (let i = 0; i < 4; i++) K.b(-8 + i * 5, 7, 6, 2, 0.5, 2, i & 1 ? YELLOW : RED);   // rings on the counter
  },
  balloon(K) {
    K.b(-12, 2, -7, 24, 9.5, 1, WHITE);
    const C = [RED, YELLOW, BLUE, GREEN, PINK, ORANGE, PURPLE];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) { if ((i * 5 + j * 3) % 11 === 0) continue; K.b(-11.5 + i * 3, 2.5 + j * 3, -6, 2, 2, 1.5, C[(i * 3 + j * 5) % C.length]); }
    for (let i = 0; i < 5; i++) { K.b(-9 + i * 4, 7, 6, 0.5, 0.5, 2, DARK); K.b(-9 + i * 4, 7, 5.5, 0.5, 1, 0.5, RED); }   // darts
  },
  cans(K, o) {
    for (const x0 of [-11, -3, 5]) {
      K.b(x0, 1, -5, 6, 5, 4, o.a); K.b(x0 - 0.5, 6, -5.5, 7, 1, 5, WHITE);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) { const x = x0 + r + i * 2, y = 7 + r * 2; K.b(x, y, -4, 2, 2, 2, STEEL); K.b(x - 0.1, y + 0.6, -4.1, 2.2, 0.8, 2.2, (r + i) & 1 ? RED : BLUE); }
    }
    for (let i = 0; i < 6; i++) K.b(-10 + i * 2.5, 7, 6, 1, 1, 1, i % 3 ? WHITE : RED);   // the balls
  },
  duck(K, o) {
    K.b(-12, 1, -6, 24, 4, 10, o.a); K.b(-12, 5, -6, 24, 1, 1, WHITE); K.b(-12, 5, 3, 24, 1, 1, WHITE); K.b(-12, 5, -5, 1, 1, 8, WHITE); K.b(11, 5, -5, 1, 1, 8, WHITE);
    K.l(-11, 5, -5, 22, 0.5, 8, [0.12, 0.42, 0.7]);                   // the water, lit from under
    for (const [x, z, f] of [[-9, -4, 1], [-5, 0, -1], [-1, -3, 1], [3, 1, 1], [6, -4, -1], [8, 0, 1], [-8, 1, 1], [1, -1, -1]]) {
      K.b(x, 5.5, z, 2, 1, 1.5, YELLOW); K.b(f > 0 ? x + 1 : x, 6.5, z + 0.25, 1, 1, 1, YELLOW); K.b(f > 0 ? x + 2 : x - 0.5, 6.7, z + 0.5, 0.5, 0.4, 0.5, ORANGE);
    }
    for (let i = 0; i < 3; i++) { K.b(-8 + i * 7, 7, 5.5, 0.5, 0.5, 3.5, WOODL); K.b(-8 + i * 7, 7, 5, 0.5, 1, 0.5, STEEL); }   // the hooks
  },
  deadeye(K) {
    K.b(-13, 1, -7, 26, 11, 0.6, 0x1c3a2a);
    for (const y of [3, 7]) K.b(-12, y, -6.4, 24, 0.5, 2, WOOD);
    // a row of the dead's heads, and a row of bullseyes
    for (let i = 0; i < 6; i++) { const x = -11 + i * 4; K.b(x, 3.5, -6, 2, 2.5, 1, 0x6f9a4a); K.b(x + 0.25, 4.7, -5, 0.5, 0.5, 0.2, DARK); K.b(x + 1.25, 4.7, -5, 0.5, 0.5, 0.2, DARK); K.b(x + 0.5, 3.8, -5, 1, 0.4, 0.2, 0x7a1c16); }
    for (let i = 0; i < 5; i++) { const x = -9 + i * 4; K.discXY(x + 1, 9, -6, 1.5, 0.6, WHITE); K.l(x + 0.5, 8.5, -5.4, 1, 1, 0.3, N.red, 0, 0.8); }
    for (let i = 0; i < 4; i++) { const x = -10 + i * 6; K.b(x, 7, 3, 1, 1, 6, DARK); K.b(x, 6.6, 7.5, 1, 1.4, 2.5, WOOD); }   // the rifles on the counter
  },
  hoops(K) {
    for (const x0 of [-11, -3, 5]) {
      K.b(x0, 6, -7, 6, 5, 0.6, WHITE); K.b(x0 + 2, 7, -6.4, 2, 2, 0.2, RED);
      K.b(x0 + 1, 6.5, -6.4, 4, 0.5, 0.5, ORANGE); K.b(x0 + 1, 6.5, -3, 4, 0.5, 0.5, ORANGE); K.b(x0 + 1, 6.5, -6, 0.5, 0.5, 3.5, ORANGE); K.b(x0 + 4.5, 6.5, -6, 0.5, 0.5, 3.5, ORANGE);
      K.b(x0 + 1.5, 4.5, -5.5, 3, 2, 2.5, CREAM);
      K.b(x0 + 2.5, 1, -7, 1, 5, 0.6, STEEL);
    }
    for (let i = 0; i < 5; i++) K.b(-10 + i * 4.5, 7, 5.5, 2, 2, 2, ORANGE);   // the balls
  },
  spin(K) {
    const C = [RED, YELLOW, BLUE, GREEN, PINK, WHITE, PURPLE, ORANGE];
    K.b(-1, 1, -6.5, 2, 3, 1, STEEL);
    K.discXY(0, 6, -6.4, 5.5, 1, (dx, dy) => C[Math.floor(((Math.atan2(dy, dx) + TAU) % TAU) / (TAU / 8)) % 8]);
    K.l(-1, 5, -5.4, 2, 2, 0.5, N.yellow);
    K.b(-0.5, 11.3, -5.6, 1, 1.4, 0.6, RED);                            // the pointer
    for (let k = 0; k < 8; k++) { const an = (k + 0.5) / 8 * TAU; K.l(Math.cos(an) * 5.2 - 0.25, 6 + Math.sin(an) * 5.2 - 0.25, -5.4, 0.5, 0.5, 0.4, N.white, 0.05 + k / 8 * 0.9); }
    for (const x of [-11, 8]) { K.b(x, 1, -5, 4, 4, 4, WOOD); bear(K, x + 0.5, 5, -4.5, x < 0 ? PINK : SKY); }
  },
};

// A food stall: a kiosk, 24 cubes wide and 14 deep, with a serving window lit from inside, a little awning, the name
// on the roof and what it sells up there too.
function kiosk(K, o) {
  const a = o.a, b = o.b ?? WHITE, w = 24, d = 14, h = 17, x0 = -w / 2, z0 = -d / 2;
  K.b(x0, 0, z0, w, 6, d, a); K.stripes(x0 - 0.2, 4, z0 - 0.2, w + 0.4, 1.5, d + 0.4, 1, b, b);
  K.b(x0, 6, z0, w, h - 6, 1, b); K.b(x0, 6, z0, 1, h - 6, d, b); K.b(-x0 - 1, 6, z0, 1, h - 6, d, b);
  K.b(x0, h - 3, -z0 - 1, w, 3, 1, b);
  K.l(x0 + 1, 6.5, z0 + 1, w - 2, h - 7, 0.5, N.warm, 0, 0.24);       // the inside, lit, and what is in there against the light
  K.b(x0 + 2, 11, z0 + 1.5, w - 4, 0.5, 2, DARK); K.b(x0 + 2, 8, z0 + 1.5, 7, 3, 3, STEEL); K.b(x0 + 3, 11, z0 + 3.5, 0.5, 0.5, 0.5, DARK);
  for (let i = 0; i < 6; i++) K.b(x0 + 3 + i * 3.2, 11.5, z0 + 1.8, 1.2, 1.5 + (i * 7 % 3) * 0.5, 1.2, [o.b2 ?? RED, CREAM, YELLOW, BROWN][i % 4]);
  K.b(4, 7, z0 + 2, 6, 5, 3, STEEL); K.b(4.5, 12, z0 + 2.5, 5, 2.5, 2, DARK); K.b(6.5, 14.5, z0 + 3, 1, 2, 1, DARK);
  K.b(x0 - 0.5, 6, -z0 - 2, w + 1, 1, 4, STEEL);                      // the counter
  K.b(x0 - 1, h, z0 - 1, w + 2, 1, d + 2, a);
  for (let k = 0; k < 2; k++) K.stripes(x0 - 1, h - 1 - k, -z0 + 1 + 2 * k, w + 2, 1, 2, 13, a, b);
  K.bulbs(x0 - 0.5, -x0, h, -z0 + 4, 2);
  // the menu on the side of the counter, and things on it
  K.b(x0 + 2, 1.5, -z0, 6, 3.5, 0.3, DARK); for (let i = 0; i < 3; i++) K.l(x0 + 2.5, 4 - i * 1.1, -z0 + 0.3, 3 + (i % 2), 0.4, 0.1, N.white, 0, 0.5);
  K.b(-3, 7, -z0 - 1, 2, 2, 2, o.b2 ?? RED); K.b(2, 7, -z0 - 1.5, 3, 1, 2.5, CREAM); K.b(7, 7, -z0 - 1, 1.5, 2.5, 1.5, o.b2 ?? YELLOW);
  K.sign(o.name, 0, h + 4.5, 5, 24, 7, o.neon, o.frame);
  K.bulbs(-11.5, 11.5, h + 8.2, 4, 2);
  FOOD[o.food](K, h + 1, o);
}
const FOOD = {
  // a great sandwich biscuit on its edge
  oreo(K, y) {
    K.b(-1.5, y, -5, 3, 6, 3, STEEL);
    const dark = 0x3a2a24, emboss = (dx, dy) => { const r = Math.hypot(dx, dy); return (r > 4.6 && r < 6) || r < 1.6 || (r > 2.6 && r < 3.4 && ((Math.atan2(dy, dx) + 7) * 3 | 0) % 2 === 0) ? 0x5c463c : dark; };
    K.discXY(0, y + 13, -6, 8.5, 1.8, emboss); K.discXY(0, y + 13, -4.2, 8, 1.6, CREAM); K.discXY(0, y + 13, -2.6, 8.5, 1.8, emboss);
  },
  corndog(K, y) {
    for (const [x, sauce] of [[-5, N.yellow], [5, N.red]]) {
      K.b(x - 0.5, y, -3.5, 1, 5, 1, WOODL);
      K.b(x - 1.5, y + 5, -4.5, 3, 1, 3, GOLD); K.b(x - 2, y + 6, -5, 4, 9, 4, GOLD); K.b(x - 1.5, y + 15, -4.5, 3, 1, 3, GOLD);
      for (let i = 0; i < 4; i++) K.l(x + (i & 1 ? -1.5 : 0.5), y + 7 + i * 2, -1, 1, 1, 0.4, sauce, 0, 0.32);
    }
  },
  cotton(K, y) {
    for (const [x, c, hgt] of [[-7, PINK, 0], [0, SKY, 3], [7, PINK, 1]]) {
      K.b(x - 0.5, y, -3.5, 1, 6 + hgt, 1, WHITE);
      const py = y + 5 + hgt; K.b(x - 2, py, -5, 4, 7, 4, c); K.b(x - 3, py + 1.5, -5, 6, 4, 4, c); K.b(x - 2, py + 1.5, -6, 4, 4, 6, c);
    }
  },
  popcorn(K, y) {
    K.stripes(-5, y, -7, 10, 8, 6, 5, RED, WHITE); K.stripes(-6, y + 8, -8, 12, 2, 8, 6, WHITE, RED);
    K.l(-5.5, y + 10, -7.5, 11, 1.5, 7, [1.5, 1.25, 0.5], 0, 0.6);
    for (const [x, z, s] of [[-4, -6, 3], [0, -5, 4], [-1, -7, 2], [2, -6.5, 3], [-5, -4, 2]]) K.l(x, y + 11.5, z, s, s * 0.7, s, [1.6, 1.4, 0.7], -0.5, 0.6);
  },
  lemonade(K, y) {
    K.b(-8, y + 2, -6, 10, 6, 6, YELLOW); K.b(-9, y + 3, -5, 12, 4, 4, YELLOW); K.b(-7, y + 1, -5, 8, 8, 4, YELLOW); K.b(-10, y + 4, -4, 1, 2, 2, YELLOW); K.b(3, y + 4, -4, 1, 2, 2, YELLOW);
    K.b(-4, y + 9, -4, 3, 1, 2, GREEN); K.b(-0.2, y, -4, 0.5, 2, 1, BROWN);
    K.b(5, y, -5.5, 5, 7, 5, WHITE); K.stripes(4.9, y + 2, -5.6, 5.2, 2, 5.2, 1, RED, RED); K.b(6.5, y + 7, -4, 1, 5, 1, RED); K.l(5.5, y + 7, -5, 4, 0.4, 4, N.yellow, 0, 0.5);
  },
};

// A food truck, its length along x, serving from its front side (+z): 44 cubes long, 16 wide (22 by 8 voxels).
function truck(K, o) {
  const a = o.a, b = o.b ?? WHITE;
  for (const x of [-14, 13]) for (const z of [-8, 7]) { K.discXY(x, 3, z, 3, 1, TYRE); K.discXY(x, 3, z < 0 ? z - 0.2 : z + 0.2, 1.5, 1, STEEL); }
  K.b(-22, 2, -7, 44, 2, 14, DARK);
  K.b(-22, 4, -8, 33, 16, 16, a); K.b(-22.2, 6, -8.2, 33.4, 2, 16.4, b);
  K.b(11, 4, -7.5, 10, 11, 15, a); K.b(11, 15, -7.5, 7, 1, 15, a);
  K.b(19, 10, -6.5, 2.2, 4.5, 13, 0x2c4660); K.b(13, 10, -7.7, 5, 4, 0.4, 0x2c4660); K.b(13, 10, 7.3, 5, 4, 0.4, 0x2c4660);   // the glass
  K.b(21, 3, -7.5, 1, 2.5, 15, STEEL);
  for (const z of [-6.5, 4.5]) { K.l(21, 6.5, z, 0.4, 1.6, 2, N.warm, 0, 0.9); K.l(-22.4, 7, z, 0.4, 1.5, 2, N.red, 0, 0.7); }
  // the serving window, its counter and its awning
  K.l(-17, 10, 8, 22, 6.5, 0.2, N.warm, 0, 0.26);
  K.b(-16, 13.5, 8.2, 20, 0.4, 0.2, DARK); for (let i = 0; i < 6; i++) K.b(-15 + i * 3.3, 13.9, 8.2, 1.2, 1.2 + (i * 5 % 3) * 0.5, 0.2, i & 1 ? DARK : BROWN);
  K.b(-3, 10, 8.2, 3, 4, 0.2, 0x55783c); K.b(-2.5, 14, 8.2, 2, 1.8, 0.2, 0x6f9a4a);   // (who is serving) K.b(-17.5, 9.5, 8, 23, 0.6, 0.5, b); K.b(-17.5, 16.5, 8, 23, 0.6, 0.5, b); K.b(-6.2, 10, 8.1, 0.5, 6.5, 0.3, b);
  K.b(-18, 9, 8, 24, 0.8, 3, STEEL);
  for (let k = 0; k < 2; k++) K.stripes(-18, 18 - k, 8 + 2.5 * k, 24, 1, 2.5, 12, o.c ?? RED, b);
  K.b(6.5, 7, 8, 4, 8, 0.3, DARK); for (let i = 0; i < 5; i++) K.l(7, 13.6 - i * 1.3, 8.3, 2 + (i * 7 % 3) * 0.5, 0.5, 0.1, N[o.neon], 0, 0.6);   // the menu
  K.b(-12, 9.8, 9, 2, 2, 1.5, RED); K.b(-2, 9.8, 9, 1.5, 2.5, 1.5, YELLOW); K.b(1, 9.8, 9, 3, 1, 2, CREAM);
  // the roof: bulbs along both sides, the sign, and what it sells
  K.bulbs(-21.5, 10, 20, 7, 2.5); K.bulbs(-21.5, 10, 20, -8, 2.5);
  K.b(-20, 20, 4, 1, 3, 2, DARK); K.b(-4, 20, 4, 1, 3, 2, DARK);
  K.sign(o.name, -11.5, 24.5, 6, 21, 7, o.neon, o.frame);
  TOPS[o.top](K, 20, o);
}
const TOPS = {
  taco(K, y) {
    for (const z of [-5, -1]) for (let dy = -7; dy < 0; dy++) { const half = Math.floor(Math.sqrt(49 - (dy + 0.5) * (dy + 0.5)) + 0.5); K.b(4 - half, y + 8 + dy, z, 2 * half, 1, 1, GOLD); }
    K.b(-2.5, y + 5, -4, 13, 3, 3, BROWN); K.b(-3, y + 8, -4, 14, 1.5, 3, LIME); K.b(-1, y + 9, -4, 2, 1.5, 3, RED); K.b(4, y + 9, -4, 2, 1.5, 3, RED); K.b(8, y + 9, -3.5, 1.5, 1, 2, RED);
    K.l(1, y + 9.4, -3.8, 2, 0.8, 2.6, N.yellow, 0, 0.5); K.l(6, y + 9.4, -3.8, 1.5, 0.8, 2.6, N.yellow, 0, 0.5);
  },
  cone(K, y) {
    for (let k = 0; k < 4; k++) { const w = 2 + k * 2; K.b(5 - w / 2, y + k * 3, -1 - w / 2, w, 3, w, k & 1 ? TAN : GOLD); }
    K.b(0, y + 12, -6, 10, 5, 10, PINK); K.b(1, y + 17, -5, 8, 3, 8, PINK); K.b(2.5, y + 20, -3.5, 5, 2, 5, CREAM);
    K.l(4, y + 22, -2, 2, 2, 2, N.red, 0, 0.8);
    for (const [x, yy, z, c] of [[-0.2, 14, -3, YELLOW], [10, 15, 0, SKY], [3, 16.9, -5.2, LIME], [6, 14, 4, YELLOW], [7, 19.9, -4.2, SKY], [2, 13, 4, LIME]]) K.b(x, y + yy, z, 0.6, 1.4, 0.6, c);
  },
  burger(K, y) {
    K.discXZ(5, y, 0, 6, 2.5, TAN); K.discXZ(5, y + 2.5, 0, 7, 2, 0x4a2c1a); K.b(-1.5, y + 4.5, -6.5, 13, 0.7, 13, YELLOW);
    K.discXZ(5, y + 5.2, 0, 7, 1, LIME); K.discXZ(5, y + 6.2, 0, 6, 1, RED); K.discXZ(5, y + 7.2, 0, 6, 3, TAN); K.discXZ(5, y + 10.2, 0, 4, 1.5, TAN);
    for (const [x, z] of [[3, -2], [7, 0], [5, 2], [2, 1], [7, -3]]) K.b(x, y + 11.7, z, 0.7, 0.4, 0.7, CREAM);
  },
};

// An arch over a way in: two striped posts, a truss between them high up with the name on it, bulbs along the top.
// span: cubes between the posts' middles (its length is along x)
function arch(K, o) {
  const s = o.span / 2, H = 92;   // (its truss is 37 voxels up: the chase camera goes under it)
  for (const sx of [-s, s]) {
    for (let y = 0; y < H; y += 4) K.b(sx - 2, y, -2, 4, 4, 4, (y / 4) & 1 ? WHITE : o.a);
    K.b(sx - 3, 0, -3, 6, 2, 6, DARK); K.l(sx - 1.5, H, -1.5, 3, 3, 3, N.yellow, -0.3);
  }
  K.b(-s, H - 2, -1, 2 * s, 2, 2, o.a); K.b(-s, H - 18, -1, 2 * s, 2, 2, o.a);
  for (let x = -s + 6; x < s - 4; x += 10) { K.b(x, H - 16, -0.5, 1, 14, 1, WHITE); }
  K.sign(o.name, 0, H - 9, 1.5, Math.min(2 * s - 16, 66), 14, o.neon, o.frame, 3);
  K.bulbs(-s + 3, s - 3, H, -0.5, 3, false, 1.2); K.bulbs(-s + 3, s - 3, H - 19.2, -0.5, 3, false, 1.2);
}
// a sign on a pole, with an arrow
function pylon(K, o) {
  K.b(-3, 0, -3, 6, 2, 6, DARK); K.b(-1, 2, -1, 2, 30, 2, STEEL);
  K.sign(o.name, 0, 37, 1.5, 24, 8, o.neon, o.frame, 3);
  K.bulbs(-11.5, 11.5, 41.2, -0.5, 2.5); K.bulbs(-11.5, 11.5, 31.8, -0.5, 2.5);
  for (let k = 0; k < 4; k++) K.l(-2 + k * 0.5 - 0.5, 28 - k * 1.5, -0.5, 5 - k * 1, 1.5, 1, N[o.neon], 0.05 + k * 0.22);   // the arrow, pointing down
  K.l(-1, 44, -1, 2, 2, 2, N.yellow, -0.6);
}
// the high striker: hit the pad, ring the bell; its lamps climb
function striker(K, o) {
  K.b(-5, 0, -4, 10, 2, 8, o.a); K.b(-3, 2, 2, 5, 1, 3, DARK); K.b(3, 2, 1, 1, 5, 1, WOODL); K.b(2, 7, 0, 3, 2, 3, STEEL);
  for (let y = 2; y < 52; y += 5) K.b(-2, y, -1.5, 4, 5, 2, (y / 5 | 0) & 1 ? o.a : WHITE);
  for (let i = 0; i < 15; i++) K.l(-1, 4 + i * 3.2, 0.5, 2, 1.4, 0.4, N[['green', 'green', 'yellow', 'yellow', 'orange', 'red'][Math.min(5, i / 2.6 | 0)]], 0.05 + i / 15 * 0.9);
  K.discXY(0, 55, -1, 3.5, 2, GOLD); K.l(-1, 54, 1, 2, 2, 0.4, N.yellow, -0.2);
  K.b(-0.5, 58.5, -0.5, 1, 2, 1, STEEL); K.l(-1, 60.5, -1, 2, 2, 2, N.red, -0.8);
}
// the ticket booth: a little hut with a pointed roof
function tickets(K, o) {
  K.b(-7, 0, -7, 14, 6, 14, o.a); K.stripes(-7, 6, -7, 14, 1, 14, 7, WHITE, o.a);
  for (const sx of [-7, 6]) for (const sz of [-7, 6]) K.b(sx, 7, sz, 1, 8, 1, WHITE);
  K.b(-7, 7, -7, 14, 8, 1, WHITE); K.l(-6, 7.5, -6, 12, 7, 0.5, N.warm, 0, 0.4);
  for (let k = 0; k < 5; k++) K.stripes(-8 + k * 1.6, 15 + k * 1.5, -8 + k * 1.6, 16 - k * 3.2, 1.5, 16 - k * 3.2, Math.max(1, 8 - k * 2), o.a, WHITE);
  K.l(-1, 22.5, -1, 2, 2, 2, N.yellow, -0.4);
  K.sign('TICKETS', 0, 11.5, 7.6, 12, 4, o.neon, o.frame, 0.5);
  K.bulbs(-7, 7, 15, 7.5, 2);
}
// a lamp post: iron, slender, a lantern on top (its light is the look's: a glow and a pool) and a bar the strings of
// bulbs hang from
function lamp(K) {
  const IRON = 0x2c3834;
  K.b(-1.5, 0, -1.5, 3, 1.5, 3, IRON); K.b(-1, 1.5, -1, 2, 2, 2, IRON); K.b(-0.5, 3.5, -0.5, 1, 26.5, 1, IRON);
  K.b(-1, 14, -1, 2, 0.6, 2, IRON); K.b(-3, 29, -0.3, 6, 0.6, 0.6, IRON); K.b(-0.3, 29, -3, 0.6, 0.6, 6, IRON);
  K.b(-1.5, 30, -1.5, 3, 0.6, 3, IRON); K.b(-1, 30.6, -1, 2, 3, 2, 0xfff0c0); K.b(-1.6, 33.6, -1.6, 3.2, 0.6, 3.2, IRON); K.b(-0.8, 34.2, -0.8, 1.6, 0.8, 1.6, IRON); K.b(-0.25, 35, -0.25, 0.5, 1, 0.5, IRON);
}
// a neon board on its own: o.w by o.h cubes, its middle o.y up; with o.legs, on two posts
function board(K, o) {
  if (o.legs) for (const sx of [-o.w / 2 - 1, o.w / 2]) K.b(sx, 0, -1, 1, o.y + o.h / 2, 1, DARK);
  K.sign(o.name, 0, o.y, 1, o.w, o.h, o.neon, o.frame, 2);
  K.bulbs(-o.w / 2 + 1, o.w / 2 - 1, o.y + o.h / 2 + 0.2, -0.5, 3, false, 1.2);
}
// the generator: a trailer with the set on it, its doors open on the panel, a stack, a red lamp turning on top
function genset(K) {
  const Y = 0xd8a428, G = 0x4a5a52;
  for (const x of [-10, 9]) for (const z of [-7, 6]) { K.discXY(x, 3, z, 3, 1, TYRE); K.discXY(x, 3, z < 0 ? z - 0.2 : z + 0.2, 1.3, 1, STEEL); }
  K.b(-18, 3, -6, 36, 2, 12, DARK); K.b(18, 3.5, -0.5, 8, 1, 1, DARK); K.b(25, 0, -0.5, 1, 4, 1, STEEL);       // the bed and the tow bar
  K.b(-17, 5, -6, 30, 14, 12, Y); K.b(-17.2, 5, -6.2, 30.4, 1.5, 12.4, DARK); K.b(-17.2, 17.5, -6.2, 30.4, 1.5, 12.4, G);
  for (let i = 0; i < 6; i++) { K.b(-15, 8 + i * 1.5, 6, 12, 0.7, 0.4, DARK); K.b(-15, 8 + i * 1.5, -6.4, 26, 0.7, 0.4, DARK); }   // the louvres
  K.b(0, 7, 6, 10, 10, 0.3, DARK); K.l(1, 13, 6.3, 3, 2, 0.2, N.green, -0.3, 0.7); K.l(5, 13, 6.3, 3, 2, 0.2, N.yellow, 0, 0.6);     // the panel
  for (let i = 0; i < 4; i++) K.l(1 + i * 2, 10, 6.3, 1, 1, 0.2, i === 1 ? N.red : N.green, i === 1 ? -0.9 : 0, 0.7);
  K.b(11, 8, 6, 0.5, 9, 3, Y); K.b(-0.5, 8, 6, 0.5, 9, 3, Y);                                                   // its doors, open
  K.b(-13, 19, -3, 2, 9, 2, STEEL); K.b(-13.5, 28, -3.5, 3, 1, 3, DARK);                                         // the stack
  K.b(5, 19, -1, 2, 1.5, 2, DARK); K.l(5.2, 20.5, -0.8, 1.6, 1.6, 1.6, N.red, -0.7);
  for (let i = 0; i < 5; i++) K.b(13 + (i & 1), 0, 7 + i * 2, 1, 0.5, 2.5, DARK);                                // the cable off to the fair
  K.b(-17.3, 9, -3, 0.3, 4, 6, DARK); K.l(-17.5, 10, -2, 0.2, 2, 4, N.yellow, 0, 0.5);
}
// what is left of a smashed stall: a heap of boards and striped cloth (one model, shared)
function heap(K) {
  const R = (() => { let s = 99; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; }; })();
  for (let i = 0; i < 16; i++) {
    const w = 3 + R() * 9, d = 2 + R() * 5, long = R() < 0.5, x = -13 + R() * (26 - (long ? w : d)), z = -7 + R() * (14 - (long ? d : w));
    K.b(x, 0, z, long ? w : d, 0.6 + R() * 1.6, long ? d : w, [PLANK, WOOD, WOODL, RED, WHITE, DARK][i % 6]);
  }
  K.b(-9, 0, -6, 8, 2.5, 1, WOOD); K.b(4, 0, 2, 1, 3.5, 6, WOODL);
}

// what each kind is: its model, the ground it stands on (in voxels, about its middle: x0, z0, x1, z1), how tall, how
// much shooting it takes (0: it can't be smashed, and cars bounce off it), and where its light falls on the ground
const KINDS = {
  booth: { make: booth, foot: [[-7.2, -4.2, 7.2, 4.4]], top: 9.5, hp: 90, heap: 1, pool: [0, 9, 13] },
  kiosk: { make: kiosk, foot: [[-6.2, -3.7, 6.2, 4.2]], top: 9, hp: 80, heap: 0.9, pool: [0, 8, 12] },
  truck: { make: truck, foot: [[-11, -4, 11, 4]], top: 10, hp: 0, pool: [-4, 9, 14] },
  arch: { make: arch, foot: null, top: 30, hp: 0, pool: null },
  pylon: { make: pylon, foot: [[-1.4, -1.4, 1.4, 1.4]], top: 21, hp: 40, heap: 0.3, pool: [0, 0, 9] },
  striker: { make: striker, foot: [[-2.4, -2, 2.4, 2]], top: 28, hp: 50, heap: 0.4, pool: [0, 3, 8] },
  tickets: { make: tickets, foot: [[-3.5, -3.5, 3.5, 3.6]], top: 9, hp: 50, heap: 0.5, pool: [0, 7, 9] },
  lamp: { make: lamp, foot: [[-0.7, -0.7, 0.7, 0.7]], top: 17.5, hp: 25, heap: 0.14, pool: null },
  board: { make: board, foot: null, top: 0, hp: 0, pool: null },
  genset: { make: genset, foot: [[-9, -3.2, 9, 3.2]], top: 10, hp: 0, pool: [3, 7, 9] },
};
const footOf = (o) => (o.kind === 'board' ? null : o.kind === 'arch' ? [[-o.span / 4 - 1.2, -1.2, -o.span / 4 + 1.2, 1.2], [o.span / 4 - 1.2, -1.2, o.span / 4 + 1.2, 1.2]] : KINDS[o.kind].foot);
// is (x, z) on the ground thing o stands on, with a margin?
function inFoot(o, x, z, pad = 0) {
  const dx = x - o.x, dz = z - o.z; if (dx * dx + dz * dz > o.reach2) return false;
  const lx = dx * o.co - dz * o.si, lz = dx * o.si + dz * o.co;
  for (const [x0, z0, x1, z1] of o.foot) if (lx > x0 - pad && lx < x1 + pad && lz > z0 - pad && lz < z1 + pad) return true;
  return false;
}
// where each one's light falls on the ground, for the look (maps/fair.js hands these to looks/fair.js):
// { x, z, r, rgb, quarter, on }
export function stallPools(list, quarter) {
  const out = [];
  for (const o of list) {
    const K = KINDS[o.kind]; if (!K.pool) continue;
    const co = Math.cos(o.yaw || 0), si = Math.sin(o.yaw || 0), [px, pz, r] = K.pool, x = o.x + px * co + pz * si, z = o.z - px * si + pz * co;
    out.push(o.pool = { x, z, r, rgb: N[o.neon || 'warm'], quarter: quarter(x, z), on: 1, at: [o.x, K.top + 2.5, o.z] });
  }
  return out;
}

const _e = [[0, 0], [0, 0]];
// api: main.js's api; list: the map's [{ kind, x, z, yaw, name, neon, frame, a, b, ... }]; power: the map's POWER
// ({ lit: [four quarters, 0 to 1], rev }); quarter(x, z): which quarter a place is in; grid: [WX, WZ]
export function makeStalls(api, list, power, quarter, [WX, WZ]) {
  const { scene } = api;
  const paintMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const time = { value: 0 }, atlas = { value: null };
  const litMats = [0, 1, 2, 3].map(() => new THREE.ShaderMaterial({
    uniforms: { time, atlas, power: { value: 1 } },
    vertexShader: `attribute vec3 color; attribute float ph; uniform float time; uniform float power; varying vec3 vC; varying vec2 vUv;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        float k = 1.0;
        if (ph > 0.0) k = 0.22 + 0.78 * step(0.5, fract(time * 1.4 - ph));                       // the chase
        else if (ph < 0.0) k = 0.55 + 0.45 * sin(time * 5.0 + ph * 40.0);                         // a twinkle
        vC = color * k * (0.05 + 0.95 * power); vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform sampler2D atlas; varying vec3 vC; varying vec2 vUv;
      void main() { gl_FragColor = vec4(vC * texture2D(atlas, vUv).rgb, 1.0); ${TONE} }`,
  }));
  // Everything goes into one mesh of paint and one of lights a quarter (a handful of draws for the whole fair, however
  // much of it is in view). Each thing remembers which vertices are its own: smashed, they are folded away to a point.
  const objs = [], paints = [], lits = [[], [], [], []];
  let nPaint = 0; const nLit = [0, 0, 0, 0];
  for (const o of list) {
    const KD = KINDS[o.kind], yaw = o.yaw || 0, K = makeKit(o.x, o.z, yaw);
    KD.make(K, o);
    const g = K.geos(), q = quarter(o.x, o.z);
    const S = { ...o, K: KD, yaw, co: Math.cos(yaw), si: Math.sin(yaw), foot: footOf(o), top: KD.top, hp: KD.hp, solid: !KD.hp, dead: false, q, cols: K.cols, src: o };
    S.reach2 = 0; if (S.foot) for (const [x0, z0, x1, z1] of S.foot) S.reach2 = Math.max(S.reach2, (Math.max(-x0, x1) + 6) ** 2 + (Math.max(-z0, z1) + 6) ** 2);
    S.pv = [nPaint, g.paint.attributes.position.count]; nPaint += S.pv[1]; paints.push(g.paint);
    S.lv = [nLit[q], g.lit.attributes.position.count]; nLit[q] += S.lv[1]; lits[q].push(g.lit);
    if (S.foot) objs.push(S);
  }
  const merge = (gs, keys) => {
    const out = new THREE.BufferGeometry(); let nv = 0, ni = 0;
    for (const g of gs) { nv += g.attributes.position.count; ni += g.index.count; }
    for (const [k, size] of keys) { const a = new Float32Array(nv * size); let at = 0; for (const g of gs) { a.set(g.attributes[k].array, at); at += g.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(a, size)); }
    const idx = new Uint32Array(ni); let at = 0, base = 0;
    for (const g of gs) { const src = g.index.array; for (let i = 0; i < src.length; i++) idx[at++] = src[i] + base; base += g.attributes.position.count; g.dispose(); }
    out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere();
    return out;
  };
  const paintMesh = new THREE.Mesh(merge(paints, [['position', 3], ['normal', 3], ['color', 3]]), paintMat);
  paintMesh.castShadow = paintMesh.receiveShadow = true; paintMesh.matrixAutoUpdate = false; paintMesh.frustumCulled = false; scene.add(paintMesh);
  const litMesh = lits.map((gs, q) => { if (!gs.length || !nLit[q]) return null; const m = new THREE.Mesh(merge(gs, [['position', 3], ['color', 3], ['uv', 2], ['ph', 1]]), litMats[q]); m.matrixAutoUpdate = false; m.frustumCulled = false; scene.add(m); return m; });
  // fold a thing's vertices away
  const fold = (mesh, [start, count]) => { if (!mesh || !count) return; const a = mesh.geometry.attributes.position; a.array.fill(0, start * 3, (start + count) * 3); a.addUpdateRange(start * 3, count * 3); a.needsUpdate = true; };
  // the heaps the smashed ones leave: one model, as many times as there are things to smash
  let heaps = null, nHeaps = 0;
  const _m = new THREE.Object3D();
  // the signs' letters (drawn again once the page's own lettering is in: until then it is the browser's)
  drawSigns(); atlas.value = ATLAS.tex;
  if (document.fonts && document.fonts.load) document.fonts.load("40px Anton").then(() => drawSigns(), () => {});

  // ---- where they stand, for the route grid and the radar: two voxels a cell, made again when one is smashed ----
  const GX = Math.ceil(WX / 2), GZ = Math.ceil(WZ / 2), grid = new Uint8Array(GX * GZ);
  function regrid() {
    grid.fill(0);
    for (const o of objs) {
      if (o.dead) continue;
      const r = Math.sqrt(o.reach2), i0 = Math.max(0, Math.floor((o.x - r) / 2)), i1 = Math.min(GX - 1, Math.ceil((o.x + r) / 2)), j0 = Math.max(0, Math.floor((o.z - r) / 2)), j1 = Math.min(GZ - 1, Math.ceil((o.z + r) / 2));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (inFoot(o, i * 2 + 1, j * 2 + 1, 1.2)) grid[j * GX + i] = 1;
    }
  }
  regrid();
  const blocks = (x, z) => x >= 0 && z >= 0 && x < WX && z < WZ && grid[(z >> 1) * GX + (x >> 1)] === 1;

  // ---- smashing one ----
  function smash(o, by, vx = 0, vz = 0) {
    if (o.dead || o.solid) return;
    o.dead = true; fold(paintMesh, o.pv); fold(litMesh[o.q], o.lv);
    o.src.dead = true; if (o.src.pool) o.src.pool.on = 0;
    power.rev = (power.rev || 0) + 1;
    if (!heaps) { const K = makeKit(0, 0, 0); heap(K); heaps = new THREE.InstancedMesh(K.geos().paint, paintMat, objs.length); heaps.count = 0; heaps.frustumCulled = false; heaps.receiveShadow = true; heaps.matrixAutoUpdate = false; scene.add(heaps); }
    const k = o.K.heap;
    _m.position.set(o.x, 0, o.z); _m.rotation.y = o.yaw; _m.scale.set(k, Math.min(1, k * 1.3), k); _m.updateMatrix();
    heaps.setMatrixAt(nHeaps++, _m.matrix); heaps.count = nHeaps; heaps.instanceMatrix.needsUpdate = true;
    // it flies apart: cubes in its colours from all through it, thrown the way it was hit
    const [x0, z0, x1, z1] = o.foot[0], n = Math.round(46 * Math.max(0.35, k));
    for (let i = 0; i < n; i++) {
      const lx = x0 + Math.random() * (x1 - x0), lz = z0 + Math.random() * (z1 - z0), x = o.x + lx * o.co + lz * o.si, z = o.z - lx * o.si + lz * o.co;
      api.cube(x, 0.5 + Math.random() * Math.min(o.top, 12), z, vx * (0.3 + Math.random() * 0.6) + (Math.random() - 0.5) * 22, 6 + Math.random() * 20, vz * (0.3 + Math.random() * 0.6) + (Math.random() - 0.5) * 22, o.cols[(Math.random() * o.cols.length) | 0], 0.5 + Math.random() * 0.9);
    }
    sparks(o.x, o.top * 0.6, o.z, 26, 1, 0.8, 0.4, 26);
    for (let i = 0; i < 6; i++) dust(o.x + (Math.random() - 0.5) * 10, 2, o.z + (Math.random() - 0.5) * 8, 3, 3, 0.62, 0.54, 0.4);
    api.sfx.play('crunch_heavy', 0.9, o.x, o.z); api.sound('crash', 0.6, o.x, 3, o.z); api.sound('glass', 0.5, o.x, 3, o.z);
    const P = api.player; if (P && by === P) api.game.shake = Math.min(1.2, api.game.shake + 0.35);
    regrid();
  }
  // shots strike them and blasts flatten them (main.js asks everything in `extras`). It is the players who wreck the
  // fair: a bot's shots only spark off a stall, and its blasts do a third as much
  const mine = (c) => !!c && (c === api.player || !!c.remote);
  api.extras.push({
    solid(x, y, z) { if (y < 0 || y > 31) return false; for (const o of objs) if (!o.dead && y < o.top && inFoot(o, x, z, 0.2)) return true; return false; },
    hit(p, dmg, owner, g, dir) {
      for (const o of objs) {
        if (o.dead || p.y > o.top || !inFoot(o, p.x, p.z, 0.5)) continue;
        sparks(p.x, p.y, p.z, 4, 1, 0.8, 0.4, 14);
        if (!o.solid && mine(owner) && (o.hp -= dmg) <= 0) smash(o, owner, dir ? dir.x * 30 : 0, dir ? dir.z * 30 : 0);
        return true;
      }
      return false;
    },
    explosion(x, y, z, reach, base, by) {
      for (const o of objs) {
        if (o.dead || o.solid) continue;
        const d = Math.hypot(o.x - x, o.z - z); if (d > reach + 5) continue;
        if ((o.hp -= base * (mine(by) ? 2.5 : 0.8) * (1 - d / (reach + 5))) <= 0) smash(o, by, (o.x - x) / Math.max(1, d) * 24, (o.z - z) / Math.max(1, d) * 24);
      }
    },
  });
  // a car's end against one of a thing's boxes: put back out of it (as hazards.js's army does)
  function out(c, ex, ez, o, b) {
    const dx = ex - o.x, dz = ez - o.z, lx = dx * o.co - dz * o.si, lz = dx * o.si + dz * o.co, r = c.wide + 0.2;
    const [x0, z0, x1, z1] = b, qx = Math.max(x0, Math.min(x1, lx)), qz = Math.max(z0, Math.min(z1, lz));
    let nx, nz, over;
    const ax = lx - qx, az = lz - qz, d = Math.hypot(ax, az);
    if (d > 0.01) { if (d >= r) return false; nx = ax / d; nz = az / d; over = r - d; }
    else { const m = [[lx - x0, -1, 0], [x1 - lx, 1, 0], [lz - z0, 0, -1], [z1 - lz, 0, 1]].sort((p, q) => p[0] - q[0])[0]; nx = m[1]; nz = m[2]; over = m[0] + r; }
    const wx = nx * o.co + nz * o.si, wz = -nx * o.si + nz * o.co;
    // (the bots never go through one: left to themselves they would flatten the fair in a minute)
    if (o.solid || Math.hypot(c.vx, c.vz) < (c === api.player || c.remote ? SMASH : SMASH_BOT)) { c.x += wx * over; c.z += wz * over; const vn = c.vx * wx + c.vz * wz; if (vn < 0) { c.vx -= wx * vn * 1.3; c.vz -= wz * vn * 1.3; } return false; }
    return true;
  }
  const SMASH = 9, SMASH_BOT = Infinity;   // how fast a car must be going to go through a stall and not bounce off it: a player's, and a bot's (never: it goes round)
  return {
    objs, blocks, smash,
    step(dt) {
      time.value += dt;
      for (let q = 0; q < 4; q++) litMats[q].uniforms.power.value = power.lit[q];
      for (const c of api.cars) {
        if (c.gone) continue;
        const s = Math.sin(c.yaw), co = Math.cos(c.yaw);
        for (let i = 0; i < 2; i++) { const f = i ? -0.55 : 0.55; _e[i][0] = c.x + s * (c.mid + c.half * f); _e[i][1] = c.z + co * (c.mid + c.half * f); }
        for (const o of objs) {
          if (o.dead) continue;
          const dx = c.x - o.x, dz = c.z - o.z; if (dx * dx + dz * dz > o.reach2 + 60) continue;
          let through = false;
          for (const b of o.foot) for (const [ex, ez] of _e) if (out(c, ex, ez, o, b)) through = true;
          if (through) {
            smash(o, c, c.vx, c.vz);
            const k = 1 - 0.2 * Math.min(1, o.K.heap * 1.4); c.vx *= k; c.vz *= k;
            if (c === api.player) api.sfx.play('crunch', 0.8, c.x, c.z);
          }
        }
      }
    },
    // on the radar: what still stands
    radar(R, s, ox, oy) {
      R.fillStyle = 'rgba(255,190,110,0.5)';
      for (const o of objs) { if (o.dead) continue; const r = Math.max(1.5, Math.sqrt(o.reach2) - 6) * 0.7; R.fillRect(ox + (o.x - r) * s, oy + (o.z - r) * s, 2 * r * s, 2 * r * s); }
    },
  };
}
