// Cars that crumple. A hit on a car no longer knocks a ball of cubes out of it the way it does a wall: the bodywork is
// pushed in (a dent), the paint round the dent scrapes to bare metal, and only a few chips fly. The bumpers and the
// front doors are cut from the body into panels of their own; with the bonnet (carshapes.js makes that one) they work
// loose when they are hit hard enough (a bumper drops at one end and drags, a door swings, the bonnet pops up and
// flaps), and then tear off and tumble away whole. Smoke from the engine shows how hurt a car is: white, grey, black,
// then flames. A wreck is crushed (the roof sags) and keeps most of its panels, charred.
//
// Every hit on a car goes through its unit's hit() (rounds, rams, saws, blasts, the hazards), so attach() swaps that
// for one that dents instead. A wreck is carved as before.
import * as THREE from 'three';
import { VoxPart, GLOW, hash, tone } from '../../units/src/voxpart.js';
import { smoke, mote, sparks } from '../../src/sim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// How hits are turned into dents (lengths in town units). A hit of radius r dents a patch DENT.R * r + DENT.R0 across,
// DENT.D * r deep (a small hit at least DENT.D0); hits of PUNCH and up (rockets, shells) also punch a hole of PUNCH_K r.
// A round (r under 1) makes a shallow dimple instead: DENT.small r + DENT.R0 across, DENT.D0 deep. However many hits
// land, the skin goes no further in than DENT.max (across, down, along the car), twice that on a wreck.
export const DENT = { R: 1.7, R0: 0.3, small: 1.1, D: 0.55, D0: 0.17, max: [0.9, 1.1, 2.2], PUNCH: 1.8, PUNCH_K: 0.3, carry: 3, chips: 0.015, maxChips: 5 };
// How much a panel takes before it works loose (1) and tears off (off): a hit of radius r near it counts PANEL.k * r
// (rounds, under 1, count PANEL.small each), less the further off it is.
export const PANEL = { small: 0.05, k: 0.5, loose: { bumper: 1, door: 1, hood: 0.6 }, off: { bumper: 2.2, door: 2.6, hood: 1.8 } };
// the smoke from the engine: below each share of health, its shade (0 black, 1 white) and puffs a second
const SMOKE = [[0.12, 0.06, 12], [0.25, 0.1, 9], [0.45, 0.38, 6], [0.7, 0.72, 3]];
const WHEEL = /^w[FR][LR]$/;
const METAL = 0x9a9ea5, METAL2 = 0x7d8188, SCRATCH = 0x2e2f33, DEAD_LAMP = 0x1e1f22;
const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Vector3(), _inv = new THREE.Matrix4(), _box = new THREE.Box3();
const _qa = new THREE.Quaternion(), _e = new THREE.Euler();

export function makeCrumple({ scene }) {
  const flying = [];   // panels torn off, tumbling: { g, vx, vy, vz, sx, sy, sz, t }

  // ---- setting up -------------------------------------------------------------------------------------------------
  // cut the panels out of a new car's body, and make its hits dent
  function attach(car) {
    const u = car.unit, body = u.parts.find((p) => p.name === 'body'), P = car.def.dims.panels;
    if (!body || !P) return;
    const C = car.crumple = { body, panels: [], hood: null, t: Math.random() * 9, smokeT: 0, orig: u.hit.bind(u) };
    const seed = u.opts.seed || 0, side = hash(seed, 7, 1, 3) < 0.5 ? 1 : -1;
    // the cubes of the body (cube coordinates) that pick() wants, moved to a panel hinged at pivot
    // (only the layers from z0 to z1 along the car are looked at)
    const cut = (name, z0, z1, pick, pivot, axis, ang, kind) => {
      const cells = [];
      const { nx, ny, nz, col, i0, j0, k0 } = body;
      for (let k = Math.max(0, Math.floor(z0) - k0 - 1), kz = Math.min(nz, Math.ceil(z1) - k0 + 1); k < kz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const n = (k * ny + j) * nx + i, c = col[n]; if (c < 0) continue;
        if (pick(i + i0 + 0.5, j + j0 + 0.5, k + k0 + 0.5, i, j, k)) cells.push(n, i + i0, j + j0, k + k0);
      }
      if (cells.length < 4 * 40) return;
      const pv = pivot.map(Math.round);
      let a0 = 1e9, b0 = 1e9, c0 = 1e9, a1 = -1e9, b1 = -1e9, c1 = -1e9;
      for (let q = 0; q < cells.length; q += 4) {
        const a = cells[q + 1] - pv[0], b = cells[q + 2] - pv[1], c = cells[q + 3] - pv[2];
        a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
      }
      // (the box has room round the panel, so a dent can push its cubes in without pushing them out of it)
      const px = Math.ceil(DENT.max[0] * 2 / body.h), py = Math.ceil(DENT.max[1] * 2 / body.h), pz = Math.ceil(DENT.max[2] * 2 / body.h);
      const vp = new VoxPart([a0 - px, b0 - py, c0 - pz, a1 + 1 + px, b1 + 1 + py, c1 + 1 + pz], body.h, seed * 31 + 50 + C.panels.length);
      for (let q = 0; q < cells.length; q += 4) {
        const n = cells[q];
        vp.set(cells[q + 1] - pv[0], cells[q + 2] - pv[1], cells[q + 3] - pv[2], col[n]);
        col[n] = -1; body.count--;
      }
      const bone = new THREE.Group(); bone.name = name; bone.rotation.order = 'YXZ';
      bone.position.set(pv[0] * body.h, pv[1] * body.h, pv[2] * body.h);
      u.bones.body.add(bone);
      vp.build(u.mats, bone); vp.bone = bone; vp.name = name;
      for (const m of vp.meshes) if (m) m.userData.unit = u;
      u.parts.push(vp);
      // its box in the body's space (town units), for telling which panel a hit is near
      const h = body.h, lo = new THREE.Vector3((a0 + pv[0]) * h, (b0 + pv[1]) * h, (c0 + pv[2]) * h), hi = new THREE.Vector3((a1 + 1 + pv[0]) * h, (b1 + 1 + pv[1]) * h, (c1 + 1 + pv[2]) * h);
      C.panels.push({ name, part: vp, bone, axis, ang, kind, box: new THREE.Box3(lo, hi), dmg: 0, state: 0, a: 0, ph: Math.random() * 6 });
    };
    const W = P.W, bt = P.bumpTop;
    // the bumpers: everything past the nose and tail up to the top of the bumper; hinged at one end, so the other drops
    cut('bumperF', P.zN - 1, P.zN + 30, (x, y, z) => z > P.zN - 0.5 && y < bt, [side * W, bt, P.zN], 'z', side * 0.3, 'bumper');
    cut('bumperR', P.zT - 30, P.zT + 1, (x, y, z) => z < P.zT + 0.5 && y < bt, [-side * W, bt, P.zT], 'z', -side * 0.3, 'bumper');
    // the front doors: the outer skin (three cubes deep) between the sills and the base of the glass, hinged at the front
    if (P.door) {
      const [d0, d1] = P.door, y0 = P.c0 + 2, y1 = P.belt + 0.5;
      for (const s of [1, -1]) {
        const skin = new Map();   // the first three cubes in from the side, on each row and layer
        const { nx, ny, col } = body;
        cut(s > 0 ? 'doorPanelL' : 'doorPanelR', d0, d1, (x, y, z, i, j, k) => {
          if (z < d0 || z > d1 || y < y0 || y > y1 || x * s < W * 0.45) return false;
          const key = j * 100000 + k;
          let o = skin.get(key);
          if (o === undefined) {   // how far in the skin goes on this row: find the outermost cube
            o = null;
            for (let t = s > 0 ? nx - 1 : 0; s > 0 ? t >= 0 : t < nx; t -= s) if (col[(k * ny + j) * nx + t] >= 0) { o = t; break; }
            skin.set(key, o);
          }
          return o !== null && Math.abs(i - o) < DENT.carry;
        }, [s * W, Math.round((y0 + y1) / 2), d1], 'y', -s * 0.6, 'door');
      }
    }
    if (u.parts.find((p) => p.name === 'hood') && car.def.dims.hood) {
      const hp = u.parts.find((p) => p.name === 'hood');
      C.hood = { name: 'hood', part: hp, bone: hp.bone, kind: 'hood', box: null, dmg: 0, state: 0, a: 0, ph: Math.random() * 6 };
    }
    body.dirty = true;
    u.hit = (point, r, debris, push = 10, dir = null) => hit(car, point, r, debris, push, dir);
  }

  // ---- hits -------------------------------------------------------------------------------------------------------
  // the parts that are bodywork (dented) rather than machinery (carved)
  const sheets = (C) => [C.body, ...(C.hood && C.hood.state < 2 ? [C.hood.part] : []), ...C.panels.filter((p) => p.state < 2).map((p) => p.part)];
  // dirW: which way the blow goes (a round's flight), if known
  function hit(car, point, r, debris, push = 10, dirW = null) {
    const C = car.crumple, u = car.unit;
    if (!C || car.dead && !C.wrecking) return C ? C.orig(point, r, debris, push) : 0;
    if (u.gone) return 0;
    u.root.updateWorldMatrix(true, true);
    const bodyBone = u.bones.body;
    // which way the dent goes: in towards the middle of the car (a line along its length at half height), unless told
    if (dirW) _d.copy(dirW).normalize();
    else {
      _p.copy(point); bodyBone.worldToLocal(_p);
      const B = C.body, h = B.h, P = car.def.dims.panels, yc = (B.j0 + B.ny * 0.45) * h;
      _q.set(0, yc, clamp(_p.z, P.zT * h * 0.5, P.zN * h * 0.5)).sub(_p);
      if (_q.lengthSq() < 1e-6) _q.set(0, -1, 0);
      _d.copy(_q.normalize()).transformDirection(bodyBone.matrixWorld);
    }
    const R = r < 1 ? DENT.small * r + DENT.R0 : DENT.R * r + DENT.R0, D = r < 1 ? DENT.D0 : Math.max(DENT.D0, DENT.D * r), deep = C.wrecking ? 2 : 1;
    let n = 0; const out = [];
    const sh = sheets(C);
    for (const part of u.parts) {
      if (!part.count) continue;
      out.length = 0;
      _p.copy(point); part.bone.worldToLocal(_p);
      if (sh.includes(part)) {
        _inv.copy(part.bone.matrixWorld).invert(); _q.copy(_d).transformDirection(_inv);
        n += dent(part, _p, _q, R, D, out, deep);
        for (const [x, y, z, c] of out) {   // paint chips off the dent: small, and every one kept
          _w.set(x, y, z); part.bone.localToWorld(_w);
          chipFn(_w.x, _w.y, _w.z, (Math.random() - 0.5) * push - _d.x * 4, 5 + Math.random() * 7, (Math.random() - 0.5) * push - _d.z * 4, c, u.def.h * 1.5);
        }
        out.length = 0;
        if (r >= DENT.PUNCH) n += part.carve(_p.x, _p.y, _p.z, r * DENT.PUNCH_K, out);
      } else if (r >= 1 || !WHEEL.test(part.name)) n += part.carve(_p.x, _p.y, _p.z, r * 0.5, out);   // (rounds leave the wheels be)
      for (const [x, y, z, c] of out) {
        _w.set(x, y, z); part.bone.localToWorld(_w);
        const dx = _w.x - point.x, dy = _w.y - point.y, dz = _w.z - point.z, d = Math.hypot(dx, dy, dz) + 0.01, s = push * (0.5 + Math.random());
        debris(_w.x, _w.y, _w.z, dx / d * s, dy / d * s + 4 + Math.random() * 6, dz / d * s, c, u.def.h);
      }
    }
    if (!car.dead) loosen(car, point, r, R);
    return n;
  }
  // Push the cubes of a part in round a point (lp, part space) along ld: a patch R across, D deep at its middle. Each
  // line of cubes along the push's main axis has its outer few cubes moved in, the skin keeping its paint (scraped);
  // the cubes it lands on are lost, as the metal folds. Returns the cubes removed; a few of them go to `out` as chips.
  function dent(part, lp, ld, R, D, out, deep = 1) {
    const { h, nx, ny, nz, col } = part, N = [nx, ny, nz], S = [1, nx, nx * ny];
    const ax = Math.abs(ld.x), ay = Math.abs(ld.y), az = Math.abs(ld.z);
    const a = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2, s = (a === 0 ? ld.x : a === 1 ? ld.y : ld.z) > 0 ? 1 : -1, u = (a + 1) % 3, v = (a + 2) % 3;
    const P = [lp.x / h - part.i0, lp.y / h - part.j0, lp.z / h - part.k0];
    const Rc = R / h, Dc = D / h, carry = DENT.carry, lim = DENT.max[a] * deep / h;
    // where the skin was before any dent, on each line (filled in as lines are first dented)
    const sk = a * 2 + (s > 0 ? 1 : 0), surf = (part.surf || (part.surf = []))[sk] || (part.surf[sk] = new Int16Array(N[u] * N[v]).fill(-1));
    const u0 = Math.max(0, Math.floor(P[u] - Rc)), u1 = Math.min(N[u] - 1, Math.floor(P[u] + Rc));
    const v0 = Math.max(0, Math.floor(P[v] - Rc)), v1 = Math.min(N[v] - 1, Math.floor(P[v] + Rc));
    if (u0 > u1 || v0 > v1 || Dc < 0.5) return 0;
    let removed = 0, kd0 = 1e9, kd1 = -1;
    const seg = [], cell = [0, 0, 0];
    for (let cu = u0; cu <= u1; cu++) for (let cv = v0; cv <= v1; cv++) {
      const f = Math.hypot(cu + 0.5 - P[u], cv + 0.5 - P[v]) / Rc; if (f >= 1) continue;
      cell[u] = cu; cell[v] = cv;
      const m = Math.round(Dc * (1 - f * f) * (0.8 + 0.4 * hash(cu, cv, a, part.seed)));
      if (m < 1) continue;
      // the line's first cube coming from outside, within reach of the hit (not the far side of the car)
      const t0 = clamp(Math.floor(P[a] - s * (Rc + 1)), 0, N[a] - 1), t1 = clamp(Math.floor(P[a] + s * (Rc + Dc)), 0, N[a] - 1);
      cell[a] = 0; const base = cell[0] * S[0] + cell[1] * S[1] + cell[2] * S[2], st = S[a] * s;
      let e = -1;
      for (let t = t0; s > 0 ? t <= t1 : t >= t1; t += s) if (col[base + t * S[a]] >= 0) { e = t; break; }
      if (e < 0) continue;
      const li = cu + cv * N[u];
      if (surf[li] < 0) surf[li] = e;
      const m2 = Math.min(m, Math.floor(lim - (e - surf[li]) * s));
      if (m2 < 1) continue;
      // read the outer cubes, then write them back m further in
      const mm = m2, L = mm + carry; seg.length = 0;
      for (let t = 0; t < L; t++) { const q = e + s * t; seg.push(q >= 0 && q < N[a] ? col[base + q * S[a]] : -2); }
      for (let t = L - 1; t >= 0; t--) {
        const q = e + s * t; if (q < 0 || q >= N[a]) continue;
        const at = base + q * S[a], was = col[at];
        let c = t < mm ? -1 : seg[t - mm] >= 0 ? seg[t - mm] : was;
        if (t === mm && seg[0] >= 0) c = scrape(seg[0], f, cu, cv, part.seed);
        if (was < 0 && c >= 0) part.count++; else if (was >= 0 && c < 0) { part.count--; removed++; }
        col[at] = c;
      }
      if (seg[0] >= 0 && out.length < DENT.maxChips && Math.random() < DENT.chips) {
        cell[a] = e; out.push([(part.i0 + cell[0] + 0.5) * h, (part.j0 + cell[1] + 0.5) * h, (part.k0 + cell[2] + 0.5) * h, seg[0] & 0xffffff]);
      }
      // the layers (along the car) that changed
      const ka = a === 2 ? Math.min(e, e + s * L) : cell[2], kb = a === 2 ? Math.max(e, e + s * L) : cell[2];
      if (ka < kd0) kd0 = ka; if (kb > kd1) kd1 = kb;
    }
    if (kd1 >= 0) part.touched(Math.max(0, kd0), Math.min(nz - 1, kd1));
    return removed;
  }
  // the paint on a dent: scratched to bare metal or dark, or just darker; a lamp there is smashed
  // (f: how far out from the middle of the dent, 0 to 1: the middle is scraped bare, the rim only shadowed)
  function scrape(c, f, i, j, seed) {
    if (c & GLOW) return DEAD_LAMP;
    if (c === METAL || c === METAL2 || c === SCRATCH) return c;
    const r = hash(i, j, 5, seed);
    if (f < 0.35 && r < 0.55) return r < 0.3 ? METAL : METAL2;
    if (f < 0.6 && r < 0.12) return SCRATCH;
    return tone(c, 0.84 + 0.12 * f);
  }

  // ---- panels -----------------------------------------------------------------------------------------------------
  // a hit near a panel works it loose, then tears it off
  function loosen(car, point, r, R) {
    const C = car.crumple, w = r < 1 ? PANEL.small : PANEL.k * r;
    _p.copy(point); car.unit.bones.body.worldToLocal(_p);
    for (const P of [...C.panels, ...(C.hood ? [C.hood] : [])]) {
      if (P.state >= 2) continue;
      const box = P.box || (P.box = hoodBox(car, P));
      const d = box.distanceToPoint(_p); if (d >= R) continue;
      P.dmg += w * (1 - d / R);
      if (P.state === 0 && P.dmg >= PANEL.loose[P.kind]) P.state = 1;
      if (P.dmg >= PANEL.off[P.kind]) tearOff(car, P, point);
    }
  }
  function hoodBox(car, P) {
    car.unit.root.updateWorldMatrix(true, true);
    const part = P.part, h = part.h;
    _box.set(new THREE.Vector3(part.i0 * h, part.j0 * h, part.k0 * h), new THREE.Vector3((part.i0 + part.nx) * h, (part.j0 + part.ny) * h, (part.k0 + part.nz) * h));
    // into the body's space: the bonnet's bone sits on the body's at its hinge
    return _box.clone().translate(part.bone.position);
  }
  // the panel comes away whole and tumbles off, flung away from the hit
  function tearOff(car, P, from) {
    const part = P.part; if (P.state >= 2 || !part.count) return;
    P.state = 2;
    car.unit.root.updateWorldMatrix(true, true);
    const g = new THREE.Group(); scene.add(g);
    part.bone.getWorldPosition(g.position); part.bone.getWorldQuaternion(g.quaternion);
    for (const m of part.meshes) if (m) g.attach(m);
    part.meshes = [null, null]; part.col.fill(-1); part.count = 0; part.tris = 0; part.dirty = false;
    _w.copy(g.position).sub(from || car.centre(_q)); _w.y = 0;
    const d = _w.length() || 1, k = 10 + Math.random() * 12;
    flying.push({ g, vx: car.vx * 0.8 + _w.x / d * k, vy: 9 + Math.random() * 12, vz: car.vz * 0.8 + _w.z / d * k,
      sx: (Math.random() - 0.5) * 9, sy: (Math.random() - 0.5) * 6, sz: (Math.random() - 0.5) * 9, t: 0 });
    if (P.kind === 'hood') car.hoodUp = 0;
    sparks(g.position.x, g.position.y, g.position.z, 8, 1, 0.82, 0.45, 18);
  }

  // ---- crashes and wrecks -----------------------------------------------------------------------------------------
  // into a wall (vehicle.js collide: H says which end met it) or a fence: dent the end that hit
  function crash(car, into, H, r) {
    if (!car.crumple || car.dead) return;
    const end = H && H.front !== undefined ? (H.front > H.back ? 1 : H.back > H.front ? -1 : 0) : (car.fwd >= 0 ? 1 : -1);
    const s = Math.sin(car.yaw), c = Math.cos(car.yaw), y = 1.6 + (car.y || 0);
    if (end) {
      const along = car.mid + end * (car.half + 0.4), off = (Math.random() - 0.5) * car.wide;
      _p.set(car.x + s * along + c * off, y, car.z + c * along - s * off);
    } else {   // side on: the side nearer the wall's point
      const lx = (H.x - car.x) * c - (H.z - car.z) * s >= 0 ? 1 : -1, along = car.mid + (Math.random() - 0.5) * car.half;
      _p.set(car.x + s * along + c * lx * (car.wide + 0.4), y, car.z + c * along - s * lx * (car.wide + 0.4));
    }
    car.unit.hit(_p.clone(), r, chipFn, 6);
  }
  let chipFn = () => {};
  function setChip(fn) { chipFn = fn; }
  // a car wrecked: the roof caves in, the bonnet blows off and another panel or two go, the rest hang loose
  function wrecked(car, debris) {
    const C = car.crumple; if (!C) return;
    const top = car.def.dims.roof + (car.y || 0);
    C.wrecking = true;
    for (const f of [-0.35, 0.3]) {
      const s = Math.sin(car.yaw), c = Math.cos(car.yaw), along = car.mid + f * car.half;
      hit(car, _w.set(car.x + s * along, top - 0.6, car.z + c * along).clone(), 1.3, debris, 4, new THREE.Vector3(0, -1, 0));
    }
    C.wrecking = false;
    const centre = car.centre(new THREE.Vector3());
    if (C.hood && C.hood.state < 2) tearOff(car, C.hood, centre.clone().setY(0));
    const left = C.panels.filter((p) => p.state < 2);
    for (const p of left) { if (Math.random() < 0.35) tearOff(car, p, centre); else p.state = 1; }
  }

  // ---- every frame ------------------------------------------------------------------------------------------------
  function step(dt, cars) {
    for (const car of cars) {
      const C = car.crumple; if (!C || car.gone) continue;
      C.t += dt;
      const sp = car.speed, fly = Math.min(1, sp / 45);
      // loose panels hang, swing and drag
      for (const P of C.panels) {
        if (P.state !== 1) continue;
        const want = P.kind === 'door' ? P.ang * (0.55 + 0.35 * Math.sin(C.t * 5 + P.ph) * (0.3 + fly) + (car.yawRate || 0) * 0.2)
          : P.ang * (1 + 0.25 * Math.sin(C.t * 13 + P.ph) * fly);
        P.a += (want - P.a) * Math.min(1, dt * 8);
        if (P.axis === 'y') P.bone.rotation.y = P.a; else P.bone.rotation.z = P.a;
        if (P.kind === 'bumper' && sp > 12 && !car.y && Math.random() < dt * 14) {   // the dropped end scrapes the road
          P.part.bone.updateWorldMatrix(true, false);
          _w.set(-Math.sign(P.ang) * car.wide * 1.9, -0.8, 0); P.bone.localToWorld(_w);
          sparks(_w.x, 0.4, _w.z, 2, 1, 0.8, 0.4, 10);
        }
      }
      // the bonnet: popped and flapping in the wind
      if (C.hood && C.hood.state === 1) car.hoodUp = 0.3 + 0.25 * fly + 0.08 * Math.sin(C.t * 21 + C.hood.ph) * (0.3 + fly);
      if (car.hoodUp !== undefined && C.hood && C.hood.state < 2) car.unit.state.hood = car.hoodUp;
      // smoke from the engine: thicker and darker as the car is hurt; flames near the end
      const f = car.dead ? 0 : car.hp / car.maxHp;
      let stage = null; for (const S of SMOKE) if (f < S[0]) { stage = S; break; }
      if (stage && (!car.dead || car.deadT < 6)) {
        const s = Math.sin(car.yaw), c = Math.cos(car.yaw), bz = car.def.dims.bayZ, x = car.x + s * bz, z = car.z + c * bz, y = car.top * 0.55 + (car.y || 0);
        if (Math.random() < dt * stage[2]) smoke(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), 1, 0.4, stage[1]);
        if (f < 0.12 && Math.random() < dt * 30) mote(x + (Math.random() - 0.5) * 1.6, y - 0.4, z + (Math.random() - 0.5) * 1.6, car.vx * 0.3, 4 + Math.random() * 5, car.vz * 0.3, 1.2 + Math.random() * 1.4, 0.3 + Math.random() * 0.3, 1, 0.45 + Math.random() * 0.3, 0.08);
      }
    }
    // panels torn off: thrown, bouncing, then lying in the road a while before they sink away
    for (let i = flying.length - 1; i >= 0; i--) {
      const F = flying[i], g = F.g; F.t += dt;
      if (F.t < 7) {
        F.vy -= 48 * dt;
        g.position.x += F.vx * dt; g.position.y += F.vy * dt; g.position.z += F.vz * dt;
        _qa.setFromEuler(_e.set(F.sx * dt, F.sy * dt, F.sz * dt)); g.quaternion.multiply(_qa);
        if (g.position.y < 0.4) {
          g.position.y = 0.4;
          if (F.vy < -4) { F.vy *= -0.3; F.vx *= 0.6; F.vz *= 0.6; F.sx *= 0.5; F.sy *= 0.5; F.sz *= 0.5; }
          else { F.vy = 0; F.vx *= 1 - Math.min(1, dt * 4); F.vz *= 1 - Math.min(1, dt * 4); F.sx *= 0.9; F.sy *= 0.9; F.sz *= 0.9; }
        }
      } else g.position.y -= dt * 0.8;
      if (F.t > 9) { drop(F); flying.splice(i, 1); }
    }
  }
  function drop(F) { F.g.removeFromParent(); F.g.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); }
  function clear() { for (const F of flying) drop(F); flying.length = 0; }
  return { attach, hit, crash, wrecked, step, clear, setChip, flying };
}
