// What stands outside Camp Deadfall's wall (maps/base.js adds these to its things): the rest of the camp, seen over the
// wall and through the gates. Scenery only: nothing here can be reached, hit or smashed (no `foot`), and it is on the
// lot of lights that never goes out (`always`).
//   north   two arched hangars with their doors open and lit, a transport parked on the grass, a radar dome on its
//           tower, tents and trucks by the track out of the north gate
//   east    the tent lines, trucks on the track, another dome
//   south   the evacuation point's board by the road, the quarantine pens, a carrier and lights at the road block
//   west    the truck park, a second mast
// The tents, trucks and the rest are basekit.js's models, entered again without a foot.
import { KINDS, N } from './fairstalls.js';
import './basekit.js';

const GREY = 0x8c908a, GREY_D = 0x6b6e66, GREY_L = 0xa8aca4, OLIVE = 0x5f6a3a, OLIVE_D = 0x475030, DARK = 0x24262c, BLACK = 0x121316, WHITE = 0xeee8da,
  STEEL = 0x8e969c, STEEL_D = 0x6a7178, CONC = 0xb9b9ae, RED = 0xc8342c, YELLOW = 0xe8b830, TYRE = 0x1a1a1c;

// an arched hangar, 60 voxels wide, 44 deep and 28 high, its doors open to the front and the lights on inside
function hangar(K, o) {
  const W = 60, D = 44, H = 56, half = (y) => W * Math.sqrt(Math.max(0, 1 - (y / H) * (y / H)));
  for (let y = 0; y < H; y += 2) { const w = half(y + 1); K.b(-w, y, -D, 2 * w, 2, 2 * D, (y / 2) % 5 === 4 ? OLIVE_D : OLIVE); }
  for (let z = -D; z <= D - 2; z += 14.6) for (let y = 0; y < H + 1; y += 2) { const w = half(y + 1) + 0.8; K.b(-w, y, z, 2 * w, 2, 1.6, OLIVE_D); }
  // the front: the wall above the doors, the doors slid back, the lit inside, the tail of what is in there
  for (let y = 0; y < H - 1; y += 2) { const w = half(y + 1) - 1.4; if (w > 1) K.b(-w, y, D, 2 * w, 2, 0.8, y > 34 ? GREY_D : BLACK); }
  K.l(-38, 0.4, D + 0.9, 76, 33, 0.2, [1.0, 0.78, 0.46], 0, 0.11);
  for (const [x, w, h] of [[-36, 9, 7], [-26, 5, 4], [24, 6, 5], [30, 7, 9]]) K.b(x, 0.4, D + 1.2, w, h, 0.4, BLACK);
  for (const s of [-1, 1]) { K.b(s > 0 ? 38 : -52, 0, D + 1, 14, 34, 1, GREY); for (let i = 0; i < 4; i++) K.b((s > 0 ? 38 : -52) + i * 3.6, 0, D + 2, 0.5, 34, 0.3, GREY_D); }
  K.b(-10, 6, D + 1.2, 20, 8, 0.4, BLACK); K.b(-1.2, 6, D + 1.2, 2.4, 26, 0.4, BLACK); K.b(-12, 28, D + 1.2, 24, 2, 0.4, BLACK); K.b(-26, 9, D + 1.2, 52, 2.4, 0.4, BLACK);
  K.sign(o.name || 'HANGAR', 0, 42, D + 1, 40, 8, 'white', 'yellow', 0.6, 6);
  for (const x of [-30, 0, 30]) K.l(x - 1.5, 34.4, D + 1.2, 3, 1.4, 1.2, N.white, 0, 1);
  K.l(-1, H + 1, -1, 2, 2, 2, N.red, -0.4); K.b(-0.5, H - 2, -0.5, 1, 4, 1, DARK);
}
// a four-engined transport, parked: its length along x (the nose to +x), a high wing, the ramp down at the back
function plane(K) {
  K.b(-40, 7, -7, 76, 13, 14, GREY); K.b(-40, 9, -8, 76, 9, 16, GREY); K.b(-40, 20, -5, 70, 1.6, 10, GREY_L);
  K.b(36, 8, -6, 6, 11, 12, GREY); K.b(42, 9, -4.6, 4, 8, 9.2, GREY); K.b(46, 10, -3, 3, 5, 6, GREY_D);
  K.b(34, 16, -6.2, 6, 3, 12.4, BLACK); K.b(40, 15, -4.8, 2.4, 2.6, 9.6, BLACK);
  for (let i = 0; i < 6; i++) K.b(-46 - i * 4, 9 + i * 1.6, -6 + i * 0.5, 6, 11 - i * 1.2, 12 - i, GREY);
  K.b(-52, 2, -5, 12, 1, 10, GREY_D); K.b(-44, 3, -5, 4, 5, 10, GREY_D);
  for (let i = 0; i < 7; i++) K.b(-68 + i * 2.2, 19 + (6 - i) * 3.4, -1, 12 - i * 0.6, 3.4, 2, GREY);
  K.b(-70, 22, -22, 9, 1.4, 44, GREY);
  K.b(-6, 21.6, -62, 14, 2.2, 124, GREY); K.b(-4, 21.2, -40, 10, 0.8, 80, GREY_D);
  for (const z of [-44, -24, 20, 40]) { K.b(-4, 16.4, z, 14, 5, 4.4, GREY_D); K.b(10, 17, z + 0.4, 3, 3.8, 3.6, DARK); K.b(13, 12, z + 1.8, 0.5, 14, 0.9, BLACK); K.b(13, 18.4, z - 4.4, 0.5, 0.9, 13.2, BLACK); }
  for (const x of [-6, 4]) for (const z of [-9.4, 7.4]) K.discXY(x, 3.4, z, 3.4, 2, TYRE);
  K.discXY(34, 2.6, -1, 2.6, 2, TYRE); K.b(33.4, 4, -0.4, 1.2, 4, 0.8, STEEL_D); K.b(-10, 5, -9.6, 20, 3.4, 19.2, GREY_D);
  K.b(-22, 12, 8.02, 5, 5, 0.12, WHITE); K.b(-22, 12, -8.14, 5, 5, 0.12, WHITE); K.b(-36, 14, 8.02, 8, 1.4, 0.12, YELLOW);
  K.l(-1, 22, 61.4, 2, 1.4, 1, N.green, 0, 1.2); K.l(-1, 22, -62.4, 2, 1.4, 1, N.red, 0, 1.2); K.l(-56, 43.6, -1.4, 1.6, 1.6, 2.8, N.white, -0.9); K.l(8, 21.8, -1, 2, 1.2, 2, N.red, -0.3);
}
// a radar dome: a white ball on a steel tower
function dome(K) {
  for (const sx of [-9, 7]) for (const sz of [-9, 7]) K.b(sx, 0, sz, 2, 30, 2, STEEL_D);
  for (const y of [10, 20, 28]) for (const [x, z, w, d] of [[-9, -9, 18, 1.2], [-9, 7.8, 18, 1.2], [-9, -9, 1.2, 18], [7.8, -9, 1.2, 18]]) K.b(x, y, z, w, 1.4, d, STEEL);
  K.b(-12, 30, -12, 24, 2, 24, CONC); K.b(-13, 32, -13, 26, 0.6, 0.6, YELLOW); K.b(-13, 32, 12.4, 26, 0.6, 0.6, YELLOW);
  const R = 15; for (let y = -R + 3; y < R; y += 2) { const r = Math.sqrt(R * R - (y + 1) * (y + 1)); K.discXZ(0, 32 + y + R - 3, 0, Math.round(r), 2, (y + R) % 8 < 2 ? 0xd9dcd6 : WHITE); }
  K.l(-1, 32 + 2 * R - 3, -1, 2, 2, 2, N.red, -0.2); K.l(-12.4, 26, -1, 0.6, 1.4, 2, N.white, 0, 0.9);
}
// the board by the road out: where the people of the town were to be flown from, and what became of that
function bigsign(K, o) {
  for (const x of [-34, 31]) { K.b(x, 0, -1.5, 3, 40, 3, STEEL_D); K.b(x - 1, 0, -2.5, 5, 2, 5, CONC); }
  K.b(-37, 16, -1, 74, 24, 1.2, OLIVE_D);
  K.sign(o.name || 'CAMP DEADFALL', 0, 31, 0.9, 68, 12, 'yellow', 'white', 0.5, 6); K.sign(o.sub || 'RESTRICTED AREA', 0, 20.6, 0.9, 50, 6.4, 'red', 'white', 0.5, 6);
  for (const x of [-28, -9, 9, 27]) K.l(x - 1.5, 41, 2, 3, 1, 2.4, N.white, 0, 1.1);
  K.b(-36, 41.6, -0.4, 72, 0.8, 0.8, STEEL);
}

// the models of basekit.js again, as scenery
const scenery = (k) => ({ ...KINDS[k], foot: null, shot: null, hp: 0, tough: false, boom: false, pool: null });
Object.assign(KINDS, {
  hangar: { make: hangar, foot: null, top: 0, hp: 0, pool: null }, plane: { make: plane, foot: null, top: 0, hp: 0, pool: null },
  dome: { make: dome, foot: null, top: 0, hp: 0, pool: null }, bigsign: { make: bigsign, foot: null, top: 0, hp: 0, pool: null },
  xtent: scenery('tent'), xcargo: scenery('cargo'), xjeep: scenery('jeep'), xapc: scenery('apc'), xqtent: scenery('qtent'), xltower: scenery('ltower'),
  xmast: scenery('mast'), xgtower: scenery('gtower'), xtanker: scenery('tanker'), xcrates: scenery('crates'), xnest: scenery('nest'), xjersey: scenery('jersey'),
});

// the things, for a base WX by WZ with its gates' middles at GX and GZ
export function baseTown(WX, WZ, GX, GZ) {
  const E = Math.PI / 2, out = [];
  const add = (kind, x, z, yaw = 0, more = {}) => out.push({ kind, x, z, yaw, name: '', neon: 'warm', always: true, ...more });
  // north: the hangars, the transport, a dome; tents and a truck by the track
  add('hangar', 92, -92, 0, { name: 'HANGAR 1' }); add('hangar', 160, -92, 0, { name: 'HANGAR 2' });
  add('plane', 356, -76, 0.25); add('dome', 470, -86); add('xtanker', 318, -50, 0.2); add('xltower', 300, -40, 0.4); add('xcrates', 404, -52, 0, { v: 1 });
  for (const [x, z] of [[214, -46], [214, -72], [298, -84]]) add('xtent', x, z, x < GX ? E : -E);
  add('xcargo', 226, -100, E); add('xjeep', 288, -62, E); add('xnest', 232, -30, Math.PI);
  // east: the tent lines, trucks on the track out
  for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) add('xtent', WX + 56 + i * 26, 48 + j * 24, 0, j === 2 && i === 1 ? { v: 'med' } : {});
  add('xcargo', WX + 50, GZ - 16, 0); add('xcargo', WX + 84, GZ - 12, 0.1, { v: 'med' }); add('xjeep', WX + 38, GZ + 18, Math.PI); add('xltower', WX + 44, GZ - 34, -1.2);
  add('dome', WX + 96, 316); add('xgtower', WX + 60, 372); add('xapc', WX + 44, 262, -E);
  // south: the board, the road block, the quarantine pens
  add('bigsign', GX + 62, WZ + 44, Math.PI, { name: 'EVAC POINT 4', sub: 'CLOSED' });
  add('xjersey', GX - 34, WZ + 38, 0); add('xjersey', GX + 34, WZ + 62, 0); add('xapc', GX + 36, WZ + 84, E); add('xltower', GX - 30, WZ + 58, 2.4); add('xnest', GX - 36, WZ + 76, 0);
  for (let i = 0; i < 4; i++) add('xqtent', 96 + i * 26, WZ + 66, 0, { name: i & 1 ? 'DO NOT ENTER' : 'QUARANTINE' });
  add('xltower', 80, WZ + 44, 0.6); add('xltower', 200, WZ + 96, -2.6); add('xcargo', 60, WZ + 78, E, { v: 'med' }); add('xgtower', 40, WZ + 50);
  // west: the truck park, a second mast, a tower
  for (let j = 0; j < 5; j++) add(j === 3 ? 'xtanker' : 'xcargo', -62, 60 + j * 18, 0);
  for (let j = 0; j < 3; j++) add('xjeep', -94, 66 + j * 16, 0);
  add('xmast', -78, 310); add('xgtower', -52, 30); add('xltower', -40, 150, 1.2); add('xtent', -70, 262, E, { v: 'cmd' }); add('xtent', -70, 240, E); add('xjeep', -36, GZ + 20, 0);
  return out;
}
