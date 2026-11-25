// Dead Man's Fair's big wheel (maps/fair.js). A mesh, not voxels, so it can turn, and roll. (The other rides are
// ../fairmoves.js.)
//   The wheel stands on its two A-frames (voxels, the map's), turning slowly with its lamps on. It comes loose when
//   its rim or hub has been shot enough (it is one of main.js's `extras`, so guns and blasts strike it), or when a car
//   drives over the release switch beside it (the map's pickup; that is how a phone lets it go, and online it is how
//   every device hears of it). Loose, it drops off the stand and rolls east down its alley, faster and faster:
//   the dead in its way are flattened (to the credit of whoever let it go), a car in its way is hurt and thrown aside,
//   and whatever stands in the alley is smashed. It goes through the east fence and off across the fields, and
//   falls over out there.
//   With `fixed` (as the fair has it) it doesn't roll: shot or blown up enough by the players it flies apart where it
//   stands, and its stand is left.
// Three draws: the wheel's frame, its lamps, its gondolas (instanced).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sparks, ring, dust } from '../../src/sim.js';
import { WX, solid } from '../../src/world.js';

const TAU = Math.PI * 2;
export const WHEEL = {
  r: 30,          // the rim's radius
  hub: 39,        // how high the hub is on its stand
  thick: 4,       // half its thickness (the two rims are this far either side of the middle, less one)
  hp: 600,        // damage its rim and hub take before it comes off the stand (or, fixed, flies apart)
  speed: 58,      // how fast it rolls at most, and how quickly it gets there
  accel: 22,
  dmg: 55,        // what it does to a car in its way
  seats: 12,
  turn: 0.3,      // how fast it turns on its stand (radians a second: a turn every twenty seconds or so)
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

// api: main.js's api; spec: { wheel: { x, z, to (how far east it rolls before it falls over), fixed (it stays on its
// stand, and flies apart there when it has been shot enough) } }
export function makeRides(api, spec) {
  const { scene } = api;
  const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15, side: THREE.DoubleSide });
  const lit = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.4, 2.4), toneMapped: false });

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

  const mine = (c) => !!c && (c === api.player || !!c.remote);   // (it is the players who wreck the fair, as with the stalls)
  // fixed, and shot to bits: it flies apart where it stands
  function wreck() {
    if (S.state !== 'stand') return;
    S.state = 'gone'; root.visible = false;
    for (let i = 0; i < 90; i++) { const a = Math.random() * TAU, r = i % 4 ? R * (0.9 + Math.random() * 0.15) : Math.random() * R; api.cube(S.x + Math.cos(a) * r, WHEEL.hub + Math.sin(a) * r, S.z + (Math.random() - 0.5) * 2 * WHEEL.thick, (Math.random() - 0.5) * 40, Math.random() * 22, (Math.random() - 0.5) * 40, [WHITE, RED, YELLOW, BLUE, GREEN, DARK][i % 6], 0.7 + Math.random() * 1.4); }
    sparks(S.x, WHEEL.hub, S.z, 60, 1, 0.8, 0.3, 40);
    api.sfx.play('bigboom', 1, S.x, S.z); api.sound('crash', 0.7, S.x, WHEEL.hub, S.z); shake(0.8, S.x, S.z);
  }
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
      if (mine(owner) && (S.hp -= dmg) <= 0) (W.fixed ? wreck() : release(owner));
      return true;
    },
    explosion(x, y, z, reach, base, by) {
      if (S.state !== 'stand') return;
      const d = Math.hypot(x - S.x, z - S.z); if (d > R + reach || Math.abs(z - S.z) > reach + WHEEL.thick) return;
      if ((S.hp -= base * (mine(by) ? 2 : 0.5)) <= 0) (W.fixed ? wreck() : release(by));
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
    // how much power the wheel's lamps have (0 to 1)
    power(w) { lit.color.setScalar(0.12 + 2.28 * w); },
    blocks: () => false,
    step(dt, live) {
      if (S.state === 'stand') { S.a -= dt * WHEEL.turn; }
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
      if (S.state === 'down' || S.state === 'gone' || S.x > WX + R) return;
      Rd.fillStyle = S.state === 'stand' ? 'rgba(255,214,90,0.8)' : ((performance.now() / 150 | 0) & 1 ? '#ff5a4a' : '#ffd65a');
      const h = S.state === 'stand' ? 0.6 : 1;
      Rd.fillRect(ox + (S.x - R * h) * s, oy + (S.z - 3) * s, 2 * R * h * s, 6 * s);
    },
  };
}
