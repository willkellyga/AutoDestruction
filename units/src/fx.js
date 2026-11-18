// Army attack effects: muzzle blasts, tracer rounds, tank shells, rockets with smoke trails, and what happens when they
// land: sparks and chips on the kaiju, scorch marks on his skin, fireballs, smoke, shock rings and craters.
// Everything is in town voxels (4 to a metre). The particle look (soft round points, additive fire, drifting smoke)
// follows the game's own in src/sim.js so the two can be merged when the units go into Crumbletown.
import * as THREE from 'three';

class Particles {
  constructor(n, additive) {
    this.n = n; this.head = 0; this.live = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n); this.grow = new Float32Array(n); this.s0 = new Float32Array(n); this.a0 = new Float32Array(n);
    this.gy = new Float32Array(n); this.drag = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('pcol', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 }, boost: { value: additive ? 1.5 : 1 } },
      vertexShader: 'attribute vec4 pcol; attribute float psize; varying vec4 vc; uniform float scale; void main(){ vc=pcol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=min(560.0, psize*scale/max(0.1,-mv.z)); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec4 vc; uniform float boost; void main(){ vec2 d=gl_PointCoord-0.5; float r=dot(d,d)*4.0; if(r>1.0) discard; float a=vc.a*(1.0-r)*(1.0-r*0.4); gl_FragColor=vec4(vc.rgb*boost,a); }',
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 11 : 10;
  }
  spawn(x, y, z, vx, vy, vz, size, life, r, g, b, a, grow, gy = 0, drag = 2.2) {
    const i = this.head; this.head = (i + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    this.s0[i] = size; this.size[i] = size; this.life[i] = life; this.max[i] = life; this.grow[i] = grow; this.a0[i] = a; this.gy[i] = gy; this.drag[i] = drag;
  }
  update(dt) {
    const { pos, vel, life, max, col, size } = this; let live = 0;
    for (let i = 0; i < this.n; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { col[i * 4 + 3] = 0; size[i] = 0; continue; }
      live++;
      const t = 1 - life[i] / max[i];
      vel[i * 3 + 1] += this.gy[i] * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.2) { pos[i * 3 + 1] = 0.2; vel[i * 3 + 1] *= -0.3; }
      const dr = Math.exp(-this.drag[i] * dt); vel[i * 3] *= dr; vel[i * 3 + 1] *= dr; vel[i * 3 + 2] *= dr;
      size[i] = this.s0[i] * (1 + this.grow[i] * t);
      col[i * 4 + 3] = this.a0[i] * (1 - t) * Math.min(1, t * 12);
    }
    this.live = live;
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.pcol.needsUpdate = true; g.attributes.psize.needsUpdate = true;
  }
}

// What each weapon fires. speed in voxels a second; len and w size the glowing streak; r is the blast radius.
export const WEAPONS = {
  rifle: { kind: 'bullet', speed: 330, len: 5, w: 0.16, col: [1.0, 0.82, 0.45], spread: 0.01, life: 1.4, sound: 'rifle', vol: 0.55 },
  mg: { kind: 'bullet', speed: 360, len: 7, w: 0.26, col: [1.0, 0.7, 0.3], spread: 0.016, life: 1.4, sound: 'mg', vol: 0.7, tracerEvery: 2 },
  chain: { kind: 'bullet', speed: 380, len: 8, w: 0.3, col: [1.0, 0.62, 0.25], spread: 0.014, life: 1.4, sound: 'mg', vol: 0.8, tracerEvery: 1 },
  cannon: { kind: 'shell', speed: 260, len: 10, w: 0.7, col: [1.0, 0.86, 0.55], spread: 0.004, life: 2, sound: 'cannon', vol: 1, r: 6 },
  rocket: { kind: 'rocket', speed: 34, top: 150, acc: 260, turn: 3.2, spread: 0.025, life: 3.2, sound: 'launch', vol: 0.8, r: 4, scale: 1 },
  pod: { kind: 'rocket', speed: 70, top: 190, acc: 320, turn: 2.4, spread: 0.04, life: 3, sound: 'launch', vol: 0.65, r: 3.6, scale: 0.85 },
};

// `world` and `onLand` are for the game: world.solid(x, y, z) lets shots strike buildings, and onLand(shot, hit, point)
// reports each landing (hit is 1 on the kaiju, 2 on the ground, 3 on a building) so the game can deal the damage.
// `trail` shortens how long rocket smoke hangs in the air; the game's camera sits much closer than the viewer's.
export function makeFx(scene, { target, debris, audio, shake = () => {}, world = null, onLand = null, trail = 1 }) {
  const dustP = new Particles(7000, false), fireP = new Particles(4000, true);
  scene.add(dustP.points, fireP.points);
  const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _c = new THREE.Color(), Z = new THREE.Vector3(0, 0, 1);
  const wind = { x: 1.1, z: 0.4 };

  // glowing streaks for bullets and shells
  const TR = 600, trMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const trGeo = new THREE.BoxGeometry(1, 1, 1); trGeo.translate(0, 0, -0.5); // the head of the streak is at the origin, the tail behind it
  const tracers = new THREE.InstancedMesh(trGeo, trMat, TR); tracers.frustumCulled = false; tracers.count = 0; tracers.renderOrder = 12;
  tracers.instanceMatrix.setUsage(THREE.DynamicDrawUsage); tracers.setColorAt(0, _c.set(0xffffff)); scene.add(tracers);

  // rockets: a small voxel body (olive tube, red nose, dark fins) and a glowing motor
  const rocketGeo = (() => {
    const parts = [[0.42, 0.42, 2.2, 0, 0, 0, 0x55603a], [0.3, 0.3, 0.5, 0, 0, 1.35, 0xc0402c], [1.0, 0.12, 0.45, 0, 0, -0.9, 0x2b2e33], [0.12, 1.0, 0.45, 0, 0, -0.9, 0x2b2e33]];
    const g = new THREE.BufferGeometry(), pos = [], nor = [], col = [], idx = [];
    for (const [w, h, d, x, y, z, c] of parts) {
      const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); const base = pos.length / 3; _c.setHex(c);
      const p = b.attributes.position, n = b.attributes.normal;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); const s = 0.75 + 0.25 * Math.max(0, n.getY(i)); col.push(_c.r * s, _c.g * s, _c.b * s); }
      for (const i of b.index.array) idx.push(base + i);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    return g;
  })();
  const rocketMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const glowGeo = new THREE.SphereGeometry(1, 10, 8), glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.9, 0.35), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const rocketPool = [];
  function rocketMesh() {
    let m = rocketPool.pop();
    if (!m) { m = new THREE.Mesh(rocketGeo, rocketMat); m.castShadow = true; const g = new THREE.Mesh(glowGeo, glowMat); g.position.z = -1.3; g.scale.set(0.45, 0.45, 0.8); m.add(g); }
    scene.add(m); return m;
  }

  // fireball flashes, shock rings and ground scorch decals
  const flashes = [];
  function flash(p, r, dur = 0.26) {
    const m = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.75, 0.25), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.copy(p); m.userData = { t: 0, r, dur }; m.renderOrder = 12; scene.add(m); flashes.push(m);
  }
  const ringGeo = new THREE.RingGeometry(0.86, 1, 48), rings = [];
  function ring(p, r, dur = 0.5, normal = null) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(p); if (normal) m.quaternion.setFromUnitVectors(Z, normal); else m.rotation.x = -Math.PI / 2;
    m.userData = { t: 0, r, dur }; scene.add(m); rings.push(m);
  }
  const scorchTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(20,16,12,.85)'); gr.addColorStop(0.55, 'rgba(30,24,18,.55)'); gr.addColorStop(1, 'rgba(40,32,24,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, d = 8 + Math.random() * 18; g.fillStyle = 'rgba(15,12,10,.5)'; g.fillRect(32 + Math.cos(a) * d - 2, 32 + Math.sin(a) * d - 2, 4, 4); }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const decalGeo = new THREE.PlaneGeometry(1, 1); decalGeo.rotateX(-Math.PI / 2);
  const decals = [];
  function crater(x, z, r) {
    if (decals.length > 60) { const o = decals.shift(); scene.remove(o); o.material.dispose(); }
    const m = new THREE.Mesh(decalGeo, new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(x, 0.04, z); m.rotation.y = Math.random() * 6.28; m.scale.setScalar(r * 2.4); m.userData = { t: 0 }; m.renderOrder = 1; scene.add(m); decals.push(m);
  }
  // two lights shared by the biggest blasts, so the kaiju and the ground light up orange for a moment
  const lights = [0, 1].map(() => { const l = new THREE.PointLight(0xffa040, 0, 70, 1); scene.add(l); l.userData = { t: 9 }; return l; });
  let nextLight = 0;
  function light(p, power) { const l = lights[nextLight++ % lights.length]; l.position.copy(p); l.userData = { t: 0, power }; }

  // ---- particle recipes ----
  function smokePuff(p, n, spread, dark, size = 3, life = 2.4, rise = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = Math.random() * spread, d = dark + Math.random() * 0.08;
      dustP.spawn(p.x + Math.cos(a) * s, p.y + (Math.random() - 0.5) * spread, p.z + Math.sin(a) * s, wind.x * 2 + Math.cos(a) * s * 0.8, rise + Math.random() * rise, wind.z * 2 + Math.sin(a) * s * 0.8,
        size * (0.7 + Math.random() * 0.6), life * (0.7 + Math.random() * 0.6), d, d * 0.96, d * 0.92, 0.5, 2.4, 0.6, 0.9);
    }
  }
  function fireBurst(p, n, speed, size, dir = null, life = 0.4) {
    for (let i = 0; i < n; i++) {
      _r.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      if (dir) _r.addScaledVector(dir, 1.1).normalize();
      const s = speed * (0.3 + Math.random() * 0.8);
      fireP.spawn(p.x, p.y, p.z, _r.x * s, _r.y * s + 2, _r.z * s, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.8), 1.0, 0.3 + Math.random() * 0.32, 0.06, 0.9, 1.1, 3, 3.2);
    }
  }
  function sparks(p, n, speed, dir = null, r = 1, g = 0.78, b = 0.32) {
    for (let i = 0; i < n; i++) {
      _r.set(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize(); if (dir) _r.addScaledVector(dir, 0.9).normalize();
      const s = speed * (0.4 + Math.random() * 0.8);
      fireP.spawn(p.x, p.y, p.z, _r.x * s, _r.y * s, _r.z * s, 0.5 + Math.random() * 0.6, 0.25 + Math.random() * 0.45, r, g, b, 1, -0.3, -60, 1.0);
    }
  }
  function dustKick(p, n, spread, r = 0.72, g = 0.68, b = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = spread * (0.4 + Math.random());
      dustP.spawn(p.x + Math.cos(a) * s * 0.3, 0.6, p.z + Math.sin(a) * s * 0.3, Math.cos(a) * s * 3, 1 + Math.random() * 4, Math.sin(a) * s * 3, 2 + Math.random() * 2.5, 0.9 + Math.random() * 1.2, r, g, b, 0.55, 1.8, 0, 2.6);
    }
  }
  function chips(p, n, normal, speed) {
    if (!debris || !target) return;
    const col = target.colorAt(p);
    for (let i = 0; i < n; i++) {
      _r.set(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().addScaledVector(normal, 1.2).normalize();
      const s = speed * (0.4 + Math.random());
      debris.spawn(p.x, p.y, p.z, _r.x * s, _r.y * s + 4, _r.z * s, Math.random() < 0.25 ? 0x2a211a : col, 0.5);
    }
  }
  function casing(p, side) { if (debris) debris.spawn(p.x, p.y, p.z, side.x * 6 + (Math.random() - 0.5) * 3, 6 + Math.random() * 5, side.z * 6 + (Math.random() - 0.5) * 3, 0xd8a840, 0.25); }

  // ---- muzzle effects ----
  function muzzle(w, p, dir, unit) {
    if (w.kind === 'bullet') {
      fireBurst(p, w === WEAPONS.rifle ? 3 : 4, 14, w === WEAPONS.rifle ? 1.0 : 1.6, dir, 0.08);
      if (Math.random() < 0.5) smokePuff(_p.copy(p).addScaledVector(dir, 0.6), 1, 0.3, 0.7, 1.4, 0.9, 1.5);
    } else if (w.kind === 'shell') {
      fireBurst(_p.copy(p).addScaledVector(dir, 1.5), 22, 40, 3.4, dir, 0.16);
      _s.crossVectors(dir, THREE.Object3D.DEFAULT_UP).normalize();
      for (const side of [1, -1]) { _d.copy(_s).multiplyScalar(side); fireBurst(p, 6, 26, 2.2, _d, 0.12); }   // out of the muzzle brake's side ports
      smokePuff(_p.copy(p).addScaledVector(dir, 3), 18, 3, 0.66, 5, 3, 2);
      flash(_p.copy(p).addScaledVector(dir, 2), 4.5, 0.14); light(p, 22);
      if (unit) { const g = unit.root.getWorldPosition(new THREE.Vector3()); dustKick(g, 14, 5, 0.66, 0.62, 0.55); } // the blast kicks dust up round the tank
      shake(0.25, p);
    } else if (w.kind === 'rocket') {
      fireBurst(p, 8, 16, 1.8, dir, 0.14);
      smokePuff(p, 4, 0.8, 0.7, 2.4, 1.6, 2);
    }
  }
  function backblast(p, back) {
    fireBurst(p, 10, 24, 2.2, back, 0.16);
    smokePuff(_p.copy(p).addScaledVector(back, 2.5), 8, 1.6, 0.74, 3.2, 1.8, 2.5);
    if (p.y < 12) dustKick(_p.copy(p).addScaledVector(back, 4), 8, 2.5);
  }

  // ---- impacts ----
  function explode(p, r, normal, onKaiju) {
    flash(p, r * 0.85, 0.2); light(p, r * 9);
    fireBurst(p, Math.round(r * 12), r * 4.5, r * 0.75, normal, 0.7);
    fireBurst(p, Math.round(r * 3), r * 1.5, r * 1.1, normal, 0.35);
    sparks(p, Math.round(r * 6), r * 9, normal);
    smokePuff(_v.copy(p).addScaledVector(normal, r * 0.6), Math.round(r * 5), r * 0.7, 0.2, r * 0.85, 3.4, 5);
    smokePuff(_v.copy(p).addScaledVector(normal, r * 0.3), Math.round(r * 2), r * 0.4, 0.42, r * 0.6, 2, 3);
    if (onKaiju) { chips(p, Math.round(r * 1.2), normal, r * 4); target.scorch(p, r * 1.1, 1.7); }
    if (p.y < r * 1.2) { crater(p.x, p.z, r); dustKick(p, Math.round(r * 4), r * 1.2); ring(_v.set(p.x, 0.3, p.z), r * 3, 0.45); if (debris) for (let i = 0; i < r * 3; i++) debris.spawn(p.x, 0.5, p.z, (Math.random() - 0.5) * r * 8, 8 + Math.random() * 14, (Math.random() - 0.5) * r * 8, Math.random() < 0.5 ? 0x6b6656 : 0x4d4a40, 0.5); }
    else ring(_v.copy(p).addScaledVector(normal, 0.3), r * 2.2, 0.32, normal);
    audio && audio.play(r >= 5 ? 'big' : 'small', p);
    shake(r >= 5 ? 0.5 : 0.22, p);
  }
  let bulletHits = 0;
  function bulletHit(p, normal, onKaiju, w) {
    if (onKaiju) {
      sparks(p, 5, 18, normal);
      fireP.spawn(p.x, p.y, p.z, 0, 0, 0, 1.6 + w.w * 3, 0.06, 1, 0.8, 0.4, 1, 0.5, 0, 0);
      if (Math.random() < 0.4) smokePuff(p, 1, 0.3, 0.5, 1.2, 0.8, 1);
      if (Math.random() < 0.06) chips(p, 1, normal, 6);
      target.scorch(p, 1.2 + w.w * 2.5, 0.9);
      if (audio) audio.play((bulletHits++ % 5) === 0 ? 'ping' : 'thud', p, 0.7);
    } else {
      dustKick(p, 3, 0.6); sparks(p, 2, 10, normal);
      if (Math.random() < 0.25 && debris) debris.spawn(p.x, 0.3, p.z, (Math.random() - 0.5) * 6, 6 + Math.random() * 6, (Math.random() - 0.5) * 6, 0x5d594c, 0.5);
    }
  }

  // ---- shots in flight ----
  const shots = []; let scorchT = 0;
  const N_UP = new THREE.Vector3(0, 1, 0);
  // fire one round of weapon `name` from p, heading along dir (for rockets) towards the point `aim`
  function fire(name, p, dir, aim, unit = null) {
    const w = WEAPONS[name];
    _d.subVectors(aim, p); const dist = _d.length(); _d.normalize();
    _d.x += (Math.random() - 0.5) * w.spread * 2; _d.y += (Math.random() - 0.5) * w.spread * 2; _d.z += (Math.random() - 0.5) * w.spread * 2; _d.normalize();
    const s = { w, p: p.clone(), from: p.clone(), aim: aim.clone(), age: 0, trail: 0, n: (unit ? (unit._shots = (unit._shots || 0) + 1) : 0) };
    if (w.kind === 'rocket') { s.dir = dir.clone().normalize(); s.speed = w.speed; s.mesh = rocketMesh(); s.mesh.scale.setScalar(w.scale); s.seed = Math.random() * 10; }
    else { s.dir = _d.clone(); s.speed = w.speed; }
    s.lit = w.kind !== 'bullet' || !w.tracerEvery || s.n % w.tracerEvery === 0; // machine guns show every other round as a tracer
    shots.push(s);
    muzzle(w, p, w.kind === 'rocket' ? s.dir : (dir || s.dir), unit);
    if (audio) audio.play(w.sound, p, w.vol);
    return s;
  }
  function land(s, onKaiju, hit) {
    const normal = _s.copy(s.dir).negate();
    if (hit === 2) normal.set(0, 1, 0); else normal.y += 0.15, normal.normalize();
    const p = s.p.clone().addScaledVector(s.dir, -0.4);
    if (s.w.kind !== 'bullet') explode(p, s.w.r, normal.clone(), onKaiju);
    else if (hit === 3) { sparks(p, 3, 12, normal); if (Math.random() < 0.5) smokePuff(p, 1, 0.3, 0.6, 1.3, 0.8, 1); }   // a round off a wall
    else bulletHit(p, normal, onKaiju, s.w);
    if (onLand) onLand(s, hit, p);
  }
  function update(dt) {
    let tn = 0;
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i], w = s.w; s.age += dt;
      if (w.kind === 'rocket') {
        s.speed = Math.min(w.top, s.speed + w.acc * dt);
        _d.subVectors(s.aim, s.p).normalize();
        const k = Math.min(1, w.turn * dt * Math.min(1, s.age * 3));
        s.dir.lerp(_d, k);
        const wob = Math.max(0, 1 - s.age * 0.8) * 0.9;                       // a little corkscrew as the motor lights
        s.dir.x += Math.sin(s.age * 17 + s.seed) * wob * dt; s.dir.y += Math.cos(s.age * 13 + s.seed) * wob * dt;
        s.dir.normalize();
      }
      const step = s.speed * dt, sub = Math.max(1, Math.ceil(step / 0.5)), ds = step / sub;
      let hit = 0;
      for (let k = 0; k < sub; k++) {
        s.p.addScaledVector(s.dir, ds);
        if (s.p.y <= 0.05) { s.p.y = 0.05; hit = 2; break; }
        if (target && target.solid(s.p.x, s.p.y, s.p.z)) { hit = 1; break; }
        if (world && world.solid(s.p.x, s.p.y, s.p.z)) { hit = 3; break; }
      }
      // trails: rockets leave thick grey smoke and a flicker of flame, shells a thin heat haze
      if (w.kind === 'rocket') {
        s.trail += step;
        while (s.trail > 0.9) {
          s.trail -= 0.9; _v.copy(s.p).addScaledVector(s.dir, -1.4 * w.scale - s.trail);
          const g = 0.62 + Math.random() * 0.12;
          dustP.spawn(_v.x, _v.y, _v.z, (Math.random() - 0.5) * 1.2 + wind.x * 0.6, (Math.random() - 0.3) * 1.2, (Math.random() - 0.5) * 1.2 + wind.z * 0.6, 1.4 * w.scale, (2.4 + Math.random() * 1.6) * trail, g, g, g * 0.97, 0.55, 2.6, 0.4, 0.8);
          fireP.spawn(_v.x, _v.y, _v.z, -s.dir.x * 8, -s.dir.y * 8, -s.dir.z * 8, 1.3 * w.scale, 0.09, 1, 0.6, 0.2, 0.9, -0.4, 0, 0);
        }
        s.mesh.position.copy(s.p); s.mesh.quaternion.setFromUnitVectors(Z, s.dir);
        s.mesh.children[0].scale.set(0.45, 0.45, 0.6 + Math.random() * 0.5);
      } else if (w.kind === 'shell') {
        s.trail += step;
        while (s.trail > 3) { s.trail -= 3; _v.copy(s.p).addScaledVector(s.dir, -s.trail); dustP.spawn(_v.x, _v.y, _v.z, 0, 0.5, 0, 0.9, 0.6, 0.85, 0.83, 0.8, 0.3, 1.6, 0, 1); }
      }
      if (hit || s.age > w.life) {
        if (hit) land(s, hit === 1, hit);
        if (s.mesh) { scene.remove(s.mesh); rocketPool.push(s.mesh); }
        shots.splice(i, 1); continue;
      }
      if (w.kind !== 'rocket' && s.lit && tn < TR) {
        const len = Math.min(w.len, s.p.distanceTo(s.from));
        _q.setFromUnitVectors(Z, s.dir); _s.set(w.w, w.w, Math.max(0.01, len));
        tracers.setMatrixAt(tn, _m.compose(s.p, _q, _s)); tracers.setColorAt(tn, _c.setRGB(w.col[0] * 1.25, w.col[1] * 0.95, w.col[2] * 0.6)); tn++;
      }
    }
    tracers.count = tn; tracers.instanceMatrix.needsUpdate = true; if (tracers.instanceColor) tracers.instanceColor.needsUpdate = true;

    for (let i = flashes.length - 1; i >= 0; i--) {
      const m = flashes[i], u = m.userData; u.t += dt; const k = u.t / u.dur;
      if (k >= 1) { scene.remove(m); m.material.dispose(); flashes.splice(i, 1); continue; }
      m.scale.setScalar(u.r * (0.4 + k * 1.1)); m.material.opacity = 0.9 * (1 - k);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const m = rings[i], u = m.userData; u.t += dt; const k = u.t / u.dur;
      if (k >= 1) { scene.remove(m); m.material.dispose(); rings.splice(i, 1); continue; }
      m.scale.setScalar(Math.max(0.01, u.r * (1 - (1 - k) * (1 - k)))); m.material.opacity = 0.7 * (1 - k);
    }
    for (let i = decals.length - 1; i >= 0; i--) {
      const m = decals[i]; m.userData.t += dt; const k = (m.userData.t - 10) / 4;
      if (k >= 1) { scene.remove(m); m.material.dispose(); decals.splice(i, 1); } else if (k > 0) m.material.opacity = 1 - k;
    }
    for (const l of lights) { l.userData.t += dt; const k = l.userData.t / 0.22; l.intensity = k < 1 ? (l.userData.power || 0) * (1 - k) * (1 - k) : 0; }
    dustP.update(dt); fireP.update(dt);
    // the scorch fade re-uploads the kaiju's colours, so it runs about fifteen times a second rather than every frame
    if (target) { scorchT += dt; if (scorchT > 0.066) { target.update(scorchT); scorchT = 0; } }
  }
  function setScale(heightPx, fov) { const s = heightPx / (2 * Math.tan(fov * Math.PI / 360)); dustP.mat.uniforms.scale.value = s; fireP.mat.uniforms.scale.value = s; }
  function clear() { for (const s of shots) if (s.mesh) { scene.remove(s.mesh); rocketPool.push(s.mesh); } shots.length = 0; }
  return { fire, backblast, casing, explode, update, setScale, clear, shots, stats: () => ({ shots: shots.length, particles: dustP.live + fireP.live, scorched: target ? target.scorched : 0 }) };
}
