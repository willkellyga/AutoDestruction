// Dead Man's Fair's rides (maps/fair.js): the Ferris wheel and the carousel. Meshes, not voxels, so they can turn, and
// the wheel can roll.
//   The wheel stands on its two A-frames (voxels, the map's), turning slowly with its lamps on. It comes loose when
//   its rim or hub has been shot enough (it is one of main.js's `extras`, so guns and blasts strike it), or when a car
//   drives over the release switch beside it (the map's pickup; that is how a phone lets it go, and online it is how
//   every device hears of it). Loose, it drops off the stand and rolls east down its alley, faster and faster:
//   the dead in its way are flattened (to the credit of whoever let it go), a car in its way is hurt and thrown aside,
//   and whatever stands in the alley is smashed. It goes through the east fence and off across the fields, and
//   falls over out there.
//   The carousel turns on its plinth (voxels, which is what cars and the dead bump into).
// A handful of draws: the wheel's frame, its lamps, its gondolas (instanced); the carousel's body and its lamps.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sparks, ring, dust } from '../../src/sim.js';
import { WX, solid } from '../../src/world.js';

const TAU = Math.PI * 2;
export const WHEEL = {
  r: 30,          // the rim's radius
  hub: 39,        // how high the hub is on its stand
  thick: 4,       // half its thickness (the two rims are this far either side of the middle, less one)
  hp: 240,        // damage its rim and hub take before it comes off the stand
  speed: 58,      // how fast it rolls at most, and how quickly it gets there
  accel: 22,
  dmg: 55,        // what it does to a car in its way
  seats: 12,
};

// a box with one colour, moved and turned (about z, then placed), for merging
const _c = new THREE.Color();
function part(w, h, d, x, y, z, hex, rz = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rz) g.rotateZ(rz);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  _c.setHex(hex, THREE.SRGBColorSpace);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const RED = 0xc8342c, WHITE = 0xe8e4d8, YELLOW = 0xe8b830, BLUE = 0x2f6fc0, GREEN = 0x3c9a52, DARK = 0x2a2c30;
const SEAT = [RED, YELLOW, BLUE, GREEN, WHITE, 0xd0662a];

function buildWheel() {
  const R = WHEEL.r, T = WHEEL.thick - 1, frame = [], lamps = [];
  for (const sz of [-T, T]) {
    for (let k = 0; k < 24; k++) {   // the rim, and a ring halfway in
      const a = (k + 0.5) / 24 * TAU;
      frame.push(part(2 * R * Math.sin(Math.PI / 24) + 0.4, 1.3, 1.3, Math.cos(a) * R * Math.cos(Math.PI / 24), Math.sin(a) * R * Math.cos(Math.PI / 24), sz, WHITE, a + Math.PI / 2));
      frame.push(part(R * Math.sin(Math.PI / 24) + 0.3, 0.7, 0.7, Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, sz, WHITE, a + Math.PI / 2));
      for (const f of [0.25, 0.75]) { const b = (k + f) / 24 * TAU; lamps.push(part(1, 1, 0.8, Math.cos(b) * R, Math.sin(b) * R, sz + Math.sign(sz) * 0.9, (k * 2 + (f > 0.5 ? 1 : 0)) % 3 === 0 ? 0xff5a4a : (k * 2 + (f > 0.5 ? 1 : 0)) % 3 === 1 ? 0xffd86a : 0x7ab8ff)); }
    }
    for (let k = 0; k < WHEEL.seats; k++) {   // the spokes
      const a = k / WHEEL.seats * TAU;
      frame.push(part(R, 0.9, 0.9, Math.cos(a) * R / 2, Math.sin(a) * R / 2, sz, k & 1 ? RED : YELLOW, a));
      if (k % 2 === 0) lamps.push(part(0.9, 0.9, 0.8, Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, sz + Math.sign(sz) * 0.8, 0xffd86a));
    }
  }
  for (let k = 0; k < WHEEL.seats; k++) { const a = k / WHEEL.seats * TAU; frame.push(part(0.8, 0.8, 2 * T, Math.cos(a) * R, Math.sin(a) * R, 0, DARK)); }   // the bars the gondolas hang from
  frame.push(part(6, 6, 2 * T + 3, 0, 0, 0, RED, Math.PI / 4), part(3, 3, 2 * T + 8, 0, 0, 0, DARK));
  for (const sz of [-T - 1.8, T + 1.8]) for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; lamps.push(part(1, 1, 0.6, Math.cos(a) * 3.4, Math.sin(a) * 3.4, sz, 0xffd86a)); }
  return { frame: mergeGeometries(frame), lamps: mergeGeometries(lamps) };
}

function buildCarousel(r) {
  const body = [], lamps = [];
  body.push(part(5, 15, 5, 0, 7.5, 0, WHITE), part(5.4, 2, 5.4, 0, 4, 0, RED), part(5.4, 2, 5.4, 0, 11, 0, RED));   // the drum in the middle
  const N = 10;
  for (let k = 0; k < N; k++) {
    const a = k / N * TAU, pr = r - 4.5, x = Math.cos(a) * pr, z = Math.sin(a) * pr, up = k & 1 ? 2.2 : 0.6, col = SEAT[k % SEAT.length];
    body.push(part(0.5, 15, 0.5, x, 7.5, z, YELLOW));                                     // the pole
    body.push(part(1.6, 2.2, 4.4, x, 3.4 + up, z, col, 0, -a));                           // the horse: body, neck and head, legs
    body.push(part(1.2, 2.4, 1.2, x - Math.sin(-a) * -1.9, 5.2 + up, z - Math.cos(-a) * -1.9, col, 0, -a));
    body.push(part(1.1, 1.2, 2, x - Math.sin(-a) * -2.9, 6.5 + up, z - Math.cos(-a) * -2.9, col, 0, -a));
    for (const f of [-1.5, 1.5]) body.push(part(1.2, 2, 0.7, x + Math.sin(-a) * f, 1.6 + up, z + Math.cos(-a) * f, DARK, 0, -a));
    body.push(part(1.7, 0.5, 1.6, x, 4.7 + up, z, DARK, 0, -a));                          // the saddle
  }
  // the canopy: a low cone in stripes, a valance round its edge and a ball on top
  const cone = new THREE.ConeGeometry(r + 2.5, 7, 20, 1, true); cone.translate(0, 18.5, 0);
  { const p = cone.attributes.position, col = new Float32Array(p.count * 3), c1 = new THREE.Color().setHex(RED, THREE.SRGBColorSpace), c2 = new THREE.Color().setHex(WHITE, THREE.SRGBColorSpace);
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), c = (Math.floor((a + Math.PI) / (TAU / 20) + 0.5) & 1) ? c1 : c2; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    cone.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
  const coneN = cone.toNonIndexed(); coneN.computeVertexNormals();
  for (let k = 0; k < 20; k++) {
    const a = (k + 0.5) / 20 * TAU, rr = r + 2.3;
    body.push(part(2 * rr * Math.sin(Math.PI / 20) + 0.2, 2, 0.5, Math.cos(a) * rr, 14.6, Math.sin(a) * rr, k & 1 ? YELLOW : RED, 0, -a + Math.PI / 2));
    lamps.push(part(0.9, 0.9, 0.9, Math.cos(a) * (rr + 0.4), 13.6, Math.sin(a) * (rr + 0.4), k & 1 ? 0xffd86a : 0xff5a4a));
  }
  body.push(part(2, 2, 2, 0, 23, 0, YELLOW));
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; lamps.push(part(0.8, 0.8, 0.8, Math.cos(a) * 3.2, 12.2, Math.sin(a) * 3.2, 0xffd86a)); }
  return { body: mergeGeometries([...body.map((g) => g.toNonIndexed()), coneN]), lamps: mergeGeometries(lamps) };
}

// api: main.js's api; spec: { wheel: { x, z, to (how far east it rolls before it falls over), fixed (it stays on its
// stand whatever is done to it: shots only spark off it) }, carousel: { x, z, r } }
export function makeRides(api, spec) {
  const { scene } = api;
  const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15, side: THREE.DoubleSide });
  const lit = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.4, 2.4), toneMapped: false });

  // ---- the carousel ----
  const C = spec.carousel, cg = buildCarousel(C.r), merry = new THREE.Group();
  merry.position.set(C.x, 3, C.z);
  const lit2 = lit.clone();   // (the carousel's lamps: on another quarter's power than the wheel's)
  { const b = new THREE.Mesh(cg.body, paint), l = new THREE.Mesh(cg.lamps, lit2); b.castShadow = true; merry.add(b, l); }
  scene.add(merry);

  // ---- the wheel ----
  const W = spec.wheel, R = WHEEL.r, wg = buildWheel(), root = new THREE.Group(), turn = new THREE.Group();
  const frame = new THREE.Mesh(wg.frame, paint), lamps = new THREE.Mesh(wg.lamps, lit);
  frame.castShadow = true; turn.add(frame, lamps); root.add(turn);
  const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 4.4, 2 * WHEEL.thick - 3), new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 }), WHEEL.seats);
  for (let k = 0; k < WHEEL.seats; k++) seats.setColorAt(k, _c.setHex(SEAT[k % SEAT.length], THREE.SRGBColorSpace));
  seats.instanceMatrix.setUsage(THREE.DynamicDrawUsage); seats.frustumCulled = false; root.add(seats);
  root.position.set(W.x, WHEEL.hub, W.z); scene.add(root);
  const S = { state: 'stand', x: W.x, y: WHEEL.hub, z: W.z, a: 0, v: 0, hp: WHEEL.hp, t: 0, by: null, smashed: false, probe: W.x, tilt: 0 };
  const M4 = new THREE.Matrix4(), hitT = new Map();
  function placeSeats() {
    for (let k = 0; k < WHEEL.seats; k++) { const a = k / WHEEL.seats * TAU + S.a; M4.makeTranslation(Math.cos(a) * R, Math.sin(a) * R - 3.2, 0); seats.setMatrixAt(k, M4); }
    seats.instanceMatrix.needsUpdate = true;
  }
  placeSeats();
  const shake = (k, x, z) => { const P = api.player; if (P) api.game.shake = Math.min(1.2, api.game.shake + Math.max(0, 1 - Math.hypot(P.x - x, P.z - z) / 220) * k); };

  function release(by) {
    if (W.fixed || S.state !== 'stand') return;
    S.state = 'drop'; S.t = 0; S.by = by || null; S.v = 0;
    api.banner('The wheel is loose!', 'It is rolling east. Stay out of its alley');
    api.sfx.play('bigboom', 0.9, S.x, S.z); api.sound('alarm', 0.7);
    sparks(S.x, WHEEL.hub, S.z, 40, 1, 0.8, 0.3, 30); shake(0.7, S.x, S.z);
  }
  // the guns and the blasts (main.js's extras): only while it is on its stand
  const dist = (x, y) => Math.hypot(x - S.x, y - S.y);
  const struck = (x, y, z) => S.state === 'stand' && Math.abs(z - S.z) < WHEEL.thick + 0.5 && (() => { const d = dist(x, y); return (d > R - 2.5 && d < R + 1.5) || d < 5; })();
  const target = {
    solid: (x, y, z) => struck(x, y, z),
    hit(p, dmg, owner) {
      if (!struck(p.x, p.y, p.z)) return false;
      sparks(p.x, p.y, p.z, 5, 1, 0.8, 0.4, 12);
      if (!W.fixed && !(owner && owner.remote) && (S.hp -= dmg) <= 0) release(owner);
      return true;
    },
    explosion(x, y, z, reach, base, by) {
      if (W.fixed || S.state !== 'stand') return;
      const d = Math.hypot(x - S.x, z - S.z); if (d > R + reach || Math.abs(z - S.z) > reach + WHEEL.thick) return;
      if ((S.hp -= base * 2) <= 0) release(by);
    },
  };
  api.extras.push(target);

  function crush(dt) {
    // the dead under it
    const horde = api.horde && api.horde();
    if (horde && !horde.puppet) for (const q of horde.all) if (!q.dead && Math.abs(q.x - S.x) < 7 && Math.abs(q.z - S.z) < WHEEL.thick + 3) horde.splat(q, S.by, 1, (q.z - S.z) * 0.2, 34);
    // a car in its way: hurt, and thrown on ahead and aside
    const now = api.game.time;
    for (const c of api.cars) {
      if (c.dead || c.gone || c.remote) continue;
      if (Math.abs(c.z - S.z) > WHEEL.thick + 1 + c.wide || Math.abs(c.x - S.x) > 6 + c.half) continue;
      if (now - (hitT.get(c) ?? -9) < 1.2) continue;
      hitT.set(c, now);
      api.damage(c, WHEEL.dmg, null);
      c.vx += S.v * 0.7; c.vz += (c.z >= S.z ? 1 : -1) * 48;
      api.sfx.play('bigboom', c === api.player ? 1 : 0.6, c.x, c.z); if (c === api.player) { shake(0.9, c.x, c.z); api.toast('Run down by the wheel', ''); }
    }
    // what stands in the alley: every few voxels, a look ahead at the foot of the rim, and a blast if there is anything
    if (S.x - S.probe > 6 && S.x < WX + 4) {
      S.probe = S.x;
      let any = false;
      for (let dx = 2; dx <= 8 && !any; dx += 2) for (let y = 2; y <= 10 && !any; y += 4) for (const dz of [-2, 0, 2]) if (solid(Math.floor(S.x + dx), y, Math.floor(S.z + dz))) { any = true; break; }
      if (any) api.explode(S.x + 5, 5, S.z, S.x > WX - 20 ? 9 : 4.5, 0.2, { maxDebris: S.x > WX - 20 ? 200 : 60, fire: false });
    }
    if (Math.random() < dt * 14) dust(S.x - 3 + Math.random() * 6, 1, S.z + (Math.random() - 0.5) * 6, 3, 2.4, 0.5, 0.42, 0.3);
  }

  let rumbleT = 0;
  return {
    wheel: S,
    get loose() { return S.state !== 'stand'; },
    release,
    // how much power the wheel's lamps and the carousel's have (0 to 1)
    power(w, c) { lit.color.setScalar(0.12 + 2.28 * w); lit2.color.setScalar(0.12 + 2.28 * c); },
    blocks: () => false,
    step(dt, live) {
      merry.rotation.y -= dt * 0.45;
      if (S.state === 'stand') { S.a -= dt * 0.12; }
      else if (S.state === 'drop') {
        // off the stand and down onto the ground
        S.t += dt; S.y = Math.max(R, WHEEL.hub - 60 * S.t * S.t); S.x += 8 * dt; S.a -= dt * 0.3;
        if (S.y <= R) { S.state = 'roll'; S.v = 14; S.probe = S.x; ring(S.x, 0.4, S.z, 16, new THREE.Color(0.9, 0.8, 0.6), 0.5); for (let i = 0; i < 10; i++) dust(S.x + (Math.random() - 0.5) * 16, 1, S.z + (Math.random() - 0.5) * 8, 4, 3, 0.5, 0.42, 0.3); api.sfx.play('bigboom', 0.8, S.x, S.z); shake(0.8, S.x, S.z); }
      } else if (S.state === 'roll') {
        S.v = Math.min(WHEEL.speed, S.v + WHEEL.accel * dt); S.x += S.v * dt; S.a -= S.v / R * dt;
        if (live) crush(dt);
        if ((rumbleT -= dt) <= 0) { rumbleT = 0.28; api.sfx.play('crunch', 0.5, S.x, S.z, { rate: 0.55, jitter: 0.1 }); shake(0.12, S.x, S.z); }
        if (S.x >= W.to) { S.state = 'tip'; S.t = 0; }
      } else if (S.state === 'tip') {
        // out in the fields it slows, leans and falls on its side
        S.t += dt; S.v = Math.max(0, S.v - 40 * dt); S.x += S.v * dt; S.a -= S.v / R * dt;
        S.tilt = Math.min(1, S.tilt + dt * (0.25 + S.tilt * 1.6));
        S.y = R * Math.cos(S.tilt * Math.PI / 2) + 3 * S.tilt;
        if (S.tilt >= 1) { S.state = 'down'; lamps.visible = false; api.sfx.play('bigboom', 0.5, S.x, S.z); }
      } else return;
      root.position.set(S.x, S.y, S.z); root.rotation.x = S.tilt * Math.PI / 2 * 0.98; turn.rotation.z = S.a;
      placeSeats();
    },
    // on the radar: the wheel edge on, while it is on the map
    radar(Rd, s, ox, oy) {
      if (S.state === 'down' || S.x > WX + R) return;
      Rd.fillStyle = S.state === 'stand' ? 'rgba(255,214,90,0.8)' : ((performance.now() / 150 | 0) & 1 ? '#ff5a4a' : '#ffd65a');
      const h = S.state === 'stand' ? 0.6 : 1;
      Rd.fillRect(ox + (S.x - R * h) * s, oy + (S.z - 3) * s, 2 * R * h * s, 6 * s);
    },
  };
}
