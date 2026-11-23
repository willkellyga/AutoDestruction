// The workshop at work: benches, racks, tools and signs along the walls, and the things that move. At the left of the door a car
// is up on the lift with a welder under it, and at the right a fitter grinds a part in the vice; an engine swings on
// the chain hoist, the wall fans turn, a strip light flickers and the clock tells the right time.
//
// It is all plain three.js: boxes and cylinders (the still ones are joined into a few meshes by garageroom.js once the
// room is built), sprites, points and lines, with the materials three.js ships. Nothing here has a shader of its own,
// and nothing is a real light: the glow of the arc and the lamps is painted on with see-through planes, so the game
// draws the same on a phone as it did before.
import * as THREE from 'three';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// a soft round blob: the glow of a lamp or the arc, a puff of smoke
const blobTex = (inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)') => canvasTex(64, 64, (g) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, inner); r.addColorStop(0.35, mid); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
});

// ---- sparks: one pool for the whole shop, drawn as short bright streaks with a dot at the head -----------------------
function makeSparks(root, n) {
  const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), life = new Float32Array(n), max = new Float32Array(n), col = new Float32Array(n * 3);
  const lp = new Float32Array(n * 6).fill(-99), lc = new Float32Array(n * 6), pp = new Float32Array(n * 3).fill(-99), pc = new Float32Array(n * 3);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  const points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.26, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  for (const o of [lines, points]) { o.frustumCulled = false; o.userData.live = true; o.renderOrder = 8; root.add(o); }
  let next = 0;
  function emit(x, y, z, vx, vy, vz, t, r, g, b) {
    const i = next; next = (next + 1) % n;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    life[i] = max[i] = t; col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
  }
  function step(dt) {
    for (let i = 0; i < n; i++) {
      const a = i * 3, b = i * 6;
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { lp[b + 1] = lp[b + 4] = pp[a + 1] = -99; lc.fill(0, b, b + 6); pc.fill(0, a, a + 3); continue; }
      vel[a + 1] -= 34 * dt;
      pos[a] += vel[a] * dt; pos[a + 1] += vel[a + 1] * dt; pos[a + 2] += vel[a + 2] * dt;
      if (pos[a + 1] < 0.06 && vel[a + 1] < 0) { pos[a + 1] = 0.06; vel[a + 1] *= -0.38; vel[a] *= 0.55; vel[a + 2] *= 0.55; }   // (they skip once on the floor)
      // it cools as it goes: white-yellow, orange, a dull red
      const k = life[i] / max[i], r = col[a] * Math.min(1, k * 1.6), g = col[a + 1] * k, bl = col[a + 2] * k * k;
      lp[b] = pp[a] = pos[a]; lp[b + 1] = pp[a + 1] = pos[a + 1]; lp[b + 2] = pp[a + 2] = pos[a + 2];
      lp[b + 3] = pos[a] - vel[a] * 0.04; lp[b + 4] = pos[a + 1] - vel[a + 1] * 0.04; lp[b + 5] = pos[a + 2] - vel[a + 2] * 0.04;
      lc[b] = pc[a] = r; lc[b + 1] = pc[a + 1] = g; lc[b + 2] = pc[a + 2] = bl;
      lc[b + 3] = r * 0.2; lc[b + 4] = g * 0.2; lc[b + 5] = bl * 0.2;
    }
    lg.attributes.position.needsUpdate = lg.attributes.color.needsUpdate = pg.attributes.position.needsUpdate = pg.attributes.color.needsUpdate = true;
  }
  return { emit, step };
}

// where the car on the lift goes: its middle, and the height of its wheels off the floor
export const LIFT = { x: -25.2, y: 7.7, z: -19 };

export function dressShop({ root, box, cyl, M, std, R, mobile }) {
  const hw = R.w / 2, wz = -R.front + 0.4;   // (wz: the door wall's inside face)
  const rnd = (() => { let s = 20261123; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();   // (the same shop every time)
  const group = (x, y, z, ry = 0, live = false) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.userData.live = live; root.add(g); return g; };
  const basic = (color, k = 1) => { const m = new THREE.MeshBasicMaterial({ color, toneMapped: false }); m.color.multiplyScalar(k); return m; };
  // see-through light, painted on: it adds to whatever is behind it and never hides anything
  const glowMat = (map, color, opacity) => new THREE.MeshBasicMaterial({ map, color, opacity, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  const blob = blobTex();
  const wash = (w, h, x, y, z, color, opacity, o = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glowMat(blob, color, opacity));
    m.position.set(x, y, z); if (o.floor) m.rotation.x = -Math.PI / 2; if (o.ry) m.rotation.y = o.ry;
    m.renderOrder = 4; m.userData.live = true; (o.to || root).add(m); return m;
  };
  const C = { cast: true };
  const X = {
    skin: std(0xc98d62), suitA: std(0x2c4f8a), suitB: std(0xd2691e), hiVis: std(0xd8e02a), boot: std(0x191a1c), glove: std(0x6b4a2a), card: std(0xb08a55), card2: std(0x9a7446),
    orange: std(0xe0661c), chrome: std(0xc9ced6, { metalness: 0.8, roughness: 0.25 }), iron: std(0x3a3d42, { metalness: 0.5, roughness: 0.55 }), cream: std(0xd8d2c0), gasG: std(0x2f6b48), gasR: std(0x7c2f26),
    tube: basic(0xeaf4ff, 1.5), tubeBad: basic(0xeaf4ff, 1.5), bulb: basic(0xffe2a6, 2.2), sky: basic(0x7f97ad, 0.55), amber: basic(0xffa21a, 2.4), visor: basic(0x18222c),
  };

  // ---- the things that stand still ---------------------------------------------------------------------------------
  // a bench: a thick top on steel legs with a shelf under it
  const bench = (x, z, w, to = root) => {
    box(w, 0.5, 3.2, x, 3.55, z, M.wood, { ...C, to });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.5, 3.3, 0.5, x + sx * (w / 2 - 0.5), 1.65, z + sz * 1.2, M.dark, { to });
    box(w - 1, 0.25, 2.6, x, 1.1, z, M.rib, { to });
    box(w, 1, 0.2, x, 2.9, z + 1.5, M.red, { to });   // (a row of drawers along the front)
    for (let i = 0; i < Math.floor(w / 3.4); i++) box(1.2, 0.14, 0.12, x - w / 2 + 1.9 + i * 3.4, 2.9, z + 1.64, M.steel, { to });
  };
  // a vice
  const vice = (x, z) => { box(1.3, 0.5, 1.5, x, 4.05, z, M.blue, C); box(0.5, 1, 1.3, x - 0.45, 4.6, z, M.blue, C); box(0.5, 1, 1.3, x + 0.55, 4.6, z, M.blue, C); box(2.4, 0.16, 0.16, x + 0.3, 4.45, z + 0.85, M.steel); };
  // a pegboard with the tools hung on it
  const pegboard = (x, y, w, h) => {
    box(w, h, 0.2, x, y, wz + 0.1, M.pegs); box(w + 0.5, 0.3, 0.3, x, y + h / 2, wz + 0.15, M.wood); box(w + 0.5, 0.3, 0.3, x, y - h / 2, wz + 0.15, M.wood);
    const z = wz + 0.28, top = y + h / 2 - 0.9;
    let tx = x - w / 2 + 1;
    for (let i = 0; tx < x + w / 2 - 0.8; i++) {
      const k = i % 5;
      if (k === 0) { box(0.26, 2.6, 0.14, tx, top - 1.3, z, M.steel); box(0.8, 0.5, 0.16, tx, top, z, M.steel); box(0.6, 0.4, 0.16, tx, top - 2.6, z, M.steel); }   // a spanner
      else if (k === 1) { box(0.28, 2.4, 0.2, tx, top - 1.5, z, M.wood); box(1.3, 0.7, 0.5, tx, top - 0.2, z + 0.1, M.iron); }   // a hammer
      else if (k === 2) { box(0.2, 1.4, 0.14, tx, top - 0.7, z, M.steel); box(0.4, 1, 0.3, tx, top - 1.9, z, M.red); box(0.2, 1.1, 0.14, tx + 0.7, top - 0.55, z, M.steel); box(0.4, 1, 0.3, tx + 0.7, top - 1.6, z, M.yellow); tx += 0.7; }   // screwdrivers
      else if (k === 3) { box(2.6, 1, 0.1, tx + 0.9, top - 0.6, z, M.steel, { rz: -0.12 }); box(0.9, 1.2, 0.3, tx - 0.6, top - 0.6, z, M.wood); tx += 1.9; }   // a saw
      else { box(0.3, 1.6, 0.16, tx, top - 0.8, z, M.steel, { rz: 0.25 }); box(0.3, 1.6, 0.16, tx + 0.35, top - 0.8, z, M.steel, { rz: -0.25 }); box(0.3, 1.2, 0.3, tx - 0.15, top - 2, z, M.red); box(0.3, 1.2, 0.3, tx + 0.5, top - 2, z, M.red); tx += 0.4; }   // pliers
      tx += 1.5;
    }
    // a row of smaller things under them
    for (let sx = x - w / 2 + 0.9; sx < x + w / 2 - 0.5; sx += 0.9) box(0.22, 0.9 + (Math.round(sx * 7) % 3) * 0.35, 0.14, sx, y - h / 2 + 1.2, z, M.steel);
  };
  // a strip light on the wall, and the light it throws down the wall under it
  const strip = (x, y, w, mat) => {
    box(w, 0.4, 0.7, x, y + 0.3, wz + 0.35, M.dark); box(w - 0.4, 0.22, 0.22, x, y, wz + 0.45, mat, { receive: false });
    return wash(w * 1.5, 13, x, y - 4.6, wz + 0.5, 0xfff0d2, 0.3);
  };
  // steel racking with a jumble of parts, cans and tyres on it (along a side wall)
  const rack = (x, z, len, ry) => {
    const g = group(x, 0, z, ry), n = 4, hgt = 12;
    for (const sx of [-len / 2, 0, len / 2]) for (const sz of [-1.1, 1.1]) box(0.3, hgt, 0.3, sx, hgt / 2, sz, M.blue, { to: g, cast: true });
    for (let i = 0; i < n; i++) {
      const y = 0.5 + i * 3.5;
      box(len, 0.25, 2.5, 0, y, 0, X.orange, { to: g, cast: true });
      for (let sx = -len / 2 + 1.3; sx < len / 2 - 1; ) {
        const k = Math.floor(rnd() * 6), w = 1.2 + rnd() * 1.4;
        if (k === 0) { cyl(1.25, 0.9, sx + 0.5, y + 0.6, 0, M.tyre, { seg: 14, to: g }); if (rnd() < 0.6) cyl(1.25, 0.9, sx + 0.55, y + 1.5, 0.1, M.tyre, { seg: 14, to: g }); sx += 3; continue; }
        if (k === 1) { box(1.1, 1.7, 1.6, sx, y + 0.98, 0, rnd() < 0.5 ? M.red : M.green, { to: g }); box(0.3, 0.3, 0.3, sx - 0.2, y + 1.95, 0.4, M.black, { to: g }); sx += 1.6; continue; }   // a jerry can
        if (k === 2) { cyl(0.55, 1.3, sx, y + 0.78, 0.2, [M.steel, M.yellow, M.blue][Math.floor(rnd() * 3)], { seg: 10, to: g }); sx += 1.4; continue; }   // a tin
        if (k === 3) { box(w, 0.7, 1.7, sx + w / 2 - 0.5, y + 0.5, 0, M.blue, { to: g }); box(w * 0.5, 0.2, 0.3, sx + w / 2 - 0.5, y + 0.95, 0, M.black, { to: g }); sx += w + 0.5; continue; }   // a tool case
        const h = 0.9 + rnd() * 1.3; box(w, h, 1.6 + rnd() * 0.5, sx + w / 2 - 0.5, y + 0.13 + h / 2, 0, rnd() < 0.5 ? X.card : X.card2, { to: g, ry: (rnd() - 0.5) * 0.2 }); sx += w + 0.4;   // a box
      }
    }
    return g;
  };
  // a lamp on a flex, the light under it and its pool on the floor
  const pendant = (x, y, z) => {
    box(0.1, R.h - y - 1, 0.1, x, (R.h + y + 1) / 2, z, M.black);
    cyl(1.7, 1, x, y + 0.5, z, M.green, { r2: 0.35, seg: 14 }); cyl(0.55, 0.3, x, y + 0.1, z, X.bulb, { seg: 10, receive: false });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 6.5, y, 20, 1, true), glowMat(canvasTex(8, 64, (g) => { const l = g.createLinearGradient(0, 0, 0, 64); l.addColorStop(0, 'rgba(255,255,255,1)'); l.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = l; g.fillRect(0, 0, 8, 64); }), 0xffdfa0, 0.07));
    cone.position.set(x, y / 2, z); cone.material.side = THREE.DoubleSide; cone.renderOrder = 4; cone.userData.live = true; root.add(cone);
    wash(17, 17, x, 0.05, z, 0xffd9a0, 0.3, { floor: true });
  };
  // a fan in the wall with the daylight behind it; the blades turn
  const fans = [];
  const fan = (x, y) => {
    box(6.4, 6.4, 0.5, x, y, wz, M.dark); cyl(2.7, 0.3, x, y, wz + 0.2, X.sky, { rx: Math.PI / 2, seg: 20, receive: false });
    const g = group(x, y, wz + 0.42, 0, true);
    for (let i = 0; i < 4; i++) { const b = box(2.5, 1, 0.08, 0, 0, 0, M.black, { to: g, receive: false }); b.geometry = b.geometry.clone().translate(0.56, 0, 0); b.rotation.z = i * Math.PI / 2; }
    cyl(0.5, 0.3, 0, 0, 0, M.steel, { rx: Math.PI / 2, seg: 8, to: g, receive: false });
    for (const dy of [-1.6, 0, 1.6]) box(5.6, 0.1, 0.1, x, y + dy, wz + 0.62, M.steel, { receive: false });
    box(0.1, 5.6, 0.1, x, y, wz + 0.62, M.steel, { receive: false });
    fans.push(g);
  };
  // a traffic cone
  const cone = (x, z) => { box(1.5, 0.15, 1.5, x, 0.08, z, X.orange); cyl(0.6, 2, x, 1.1, z, X.orange, { r2: 0.14, seg: 10, cast: true }); cyl(0.42, 0.4, x, 1.3, z, X.cream, { r2: 0.33, seg: 10 }); };

  // -- left of the door: the welding bay ---
  pegboard(-30, 8, 13, 6);
  const badWash = strip(-30, 11.8, 11, X.tubeBad);
  // a tool trolley with the radio on it, and tins on the floor by the wall
  box(4.4, 3.2, 2.4, -32.5, 2.2, -14.6, M.red, C); for (let i = 0; i < 3; i++) box(4, 0.12, 0.1, -32.5, 1.3 + i * 0.9, -13.36, M.steel);
  for (const sx of [-1.7, 1.7]) cyl(0.4, 0.3, -32.5 + sx, 0.4, -14.6, M.tyre, { rx: Math.PI / 2, seg: 8 });
  box(2, 1.5, 1.1, -33, 4.55, -14.7, M.black, C); box(0.7, 0.7, 0.1, -33.4, 4.6, -14.12, M.steel); box(0.5, 0.2, 0.1, -32.4, 4.9, -14.12, X.amber, { receive: false }); box(0.08, 2.2, 0.08, -32.2, 6.3, -14.9, M.steel, { rz: -0.2 });
  cyl(0.45, 1, -31.2, 4.3, -14.4, M.yellow, { seg: 10, cast: true }); cyl(0.7, 1.4, -36.6, 0.7, -28, M.green, { seg: 10 }); cyl(0.7, 1.4, -34.8, 0.7, -28.3, M.steel, { seg: 10 });
  // the two-post lift (garageroom.js parks a car on it, nose out into the room: parkOnLift), and a work lamp on a stand
  {
    const g = group(LIFT.x, 0, LIFT.z + 1.5, 0), t = { to: g };   // (the posts stand forward of the car's middle, clear of the welder)
    for (const sx of [-1, 1]) {
      box(1.5, 15.5, 1.5, sx * 6.3, 7.75, 0, M.yellow, { ...t, cast: true }); box(2.6, 0.3, 2.6, sx * 6.3, 0.15, 0, M.dark, t);
      box(1.9, 1.5, 1.9, sx * 6.3, LIFT.y + 0.3, 0, X.iron, t);
      for (const sz of [-1, 1]) { box(0.7, 0.5, 5.4, sx * 4.6, LIFT.y + 0.45, sz * 2.5, X.iron, { ...t, ry: sx * sz * 0.55, cast: true }); cyl(0.6, 0.35, sx * 3.2, LIFT.y + 0.85, sz * 4.7, M.black, { seg: 8, ...t }); }
    }
    box(14.1, 0.9, 1.3, 0, 15.6, 0, M.yellow, t);
  }
  {
    const g = group(-33.5, 0, -10.5, 2.3);
    for (let i = 0; i < 3; i++) { const a = i * 2.094; box(0.16, 2.6, 0.16, Math.sin(a) * 0.9, 1.15, Math.cos(a) * 0.9, M.black, { to: g, rx: Math.cos(a) * 0.75, rz: -Math.sin(a) * 0.75 }); }
    box(0.18, 3.4, 0.18, 0, 3.8, 0, M.steel, { to: g }); box(2.4, 1.5, 0.6, 0, 5.9, 0, M.yellow, { to: g, cast: true, rx: -0.5 }); box(2, 1.1, 0.1, 0, 6.06, -0.3, X.bulb, { to: g, rx: -0.5, receive: false });
  }
  // the welding set: the box of tricks on a trolley, the gas bottles chained to the wall
  box(3.2, 2.6, 2.4, -18.4, 2.1, -21.2, M.blue, C); box(3.3, 0.3, 2.5, -18.4, 0.7, -21.2, M.dark); box(2.2, 1, 0.1, -18.4, 2.4, -19.95, M.black); box(0.3, 0.3, 0.12, -17.7, 3.1, -19.92, X.amber, { receive: false });
  for (const dx of [-1.2, 1.2]) cyl(0.5, 0.4, -18.4 + dx, 0.5, -21.2, M.tyre, { rx: Math.PI / 2, seg: 10 });
  cyl(0.75, 5.6, -18.2, 2.8, -28.5, X.gasG, { seg: 12, cast: true }); cyl(0.3, 0.7, -18.2, 5.9, -28.5, M.steel, { seg: 8 });
  cyl(0.75, 5.6, -19.9, 2.8, -28.6, X.gasR, { seg: 12, cast: true }); cyl(0.3, 0.7, -19.9, 5.9, -28.6, M.steel, { seg: 8 });
  box(3.8, 0.2, 0.2, -19, 4.2, -27.75, M.steel);
  // signs: the tally board over the bench, and the warning by the welder
  const tally = canvasTex(512, 200, (g, w, h) => {
    g.fillStyle = '#e9e6da'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f7a47'; g.fillRect(0, 0, w, 58);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 34px system-ui, sans-serif'; g.fillText('SAFETY FIRST', w / 2, 31);
    g.fillStyle = '#20242a'; g.font = '800 30px system-ui, sans-serif'; g.textAlign = 'left'; g.fillText('DAYS WITHOUT', 26, 104); g.fillText('A WRECK', 26, 146);
    g.fillStyle = '#fff'; g.fillRect(330, 76, 150, 104); g.strokeStyle = '#20242a'; g.lineWidth = 5; g.strokeRect(330, 76, 150, 104);
    g.fillStyle = '#c0281c'; g.font = 'italic 900 96px "Trebuchet MS", system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('0', 405, 132);
  });
  const plane = (w, h, x, y, z, mat, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.userData.live = true; root.add(m); return m; };
  plane(9.2, 3.6, -33.6, 19.8, wz + 0.06, new THREE.MeshStandardMaterial({ map: tally, roughness: 0.7 }));
  const warn = canvasTex(128, 128, (g) => {
    g.fillStyle = '#e8b02a'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#1d1e21'; g.lineWidth = 8; g.strokeRect(6, 6, 116, 116);
    g.fillStyle = '#1d1e21'; g.beginPath(); g.moveTo(64, 18); g.lineTo(108, 92); g.lineTo(20, 92); g.closePath(); g.fill();
    g.fillStyle = '#e8b02a'; g.fillRect(60, 44, 8, 26); g.fillRect(60, 76, 8, 8);
    g.fillStyle = '#1d1e21'; g.font = '900 17px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('SPARKS', 64, 114);
  });
  plane(2.6, 2.6, -17.6, 9.6, wz + 0.06, new THREE.MeshStandardMaterial({ map: warn, roughness: 0.7 }));
  fan(-21.5, 18.6);

  // -- right of the door: the fitter's bench ---
  bench(23.3, -27.6, 13); pegboard(24.6, 8, 9, 6); strip(23.8, 11.8, 10, X.tube);
  vice(19.6, -27.2); box(0.5, 1.5, 0.5, 19.8, 5.2, -27.2, M.steel, C);   // (the part in the vice)
  box(2.2, 0.9, 1.4, 26.4, 4.25, -27.9, M.blue, C); cyl(0.45, 1, 28.4, 4.3, -27.5, M.red, { seg: 10 }); box(1.6, 0.5, 1.2, 23.4, 4.05, -28, X.iron);
  // the air compressor: a red tank on its side with the motor on top (the motor shakes)
  cyl(1.4, 5.4, 34.5, 2, -20.5, M.red, { rx: Math.PI / 2, seg: 14, cast: true }); box(0.4, 0.8, 3.6, 33.6, 0.4, -20.5, M.dark); box(0.4, 0.8, 3.6, 35.4, 0.4, -20.5, M.dark);
  const motor = group(34.5, 3.4, -20.5, 0, true);
  box(1.8, 1.4, 2.2, 0, 0.7, -0.8, X.iron, { to: motor, cast: true }); cyl(0.8, 0.5, 0.6, 0.9, 1.4, M.black, { rz: Math.PI / 2, seg: 12, to: motor }); box(1.2, 1, 1, 0, 0.5, 1.4, M.steel, { to: motor });
  // tyres against the wall, a trolley jack, cones by the lane
  for (let i = 0; i < 3; i++) cyl(2.1, 1.3, 37.6, 2.1, -15 + i * 1.7, M.tyre, { rz: Math.PI / 2 - 0.25, seg: 16, cast: true });
  box(1.6, 0.7, 4.4, 28.5, 0.5, -19, M.red, C); box(0.24, 0.24, 4, 28.5, 1.7, -16.4, M.steel, { rx: -0.55 }); cyl(0.6, 0.3, 28.5, 1, -20.6, M.steel, { seg: 10 });
  cone(-17, -13.5); cone(-13.6, -27.6); cone(13.6, -27.6);
  // the clock (the hands are set in step)
  const clockFace = canvasTex(128, 128, (g) => {
    g.fillStyle = '#20242a'; g.beginPath(); g.arc(64, 64, 63, 0, 7); g.fill(); g.fillStyle = '#efeadb'; g.beginPath(); g.arc(64, 64, 55, 0, 7); g.fill();
    g.fillStyle = '#20242a'; for (let i = 0; i < 12; i++) { g.save(); g.translate(64, 64); g.rotate(i * Math.PI / 6); g.fillRect(-2, -52, 4, i % 3 ? 7 : 13); g.restore(); }
  });
  const clockAt = { x: 13.6, y: 20.3 };
  const cf = plane(3.6, 3.6, clockAt.x, clockAt.y, wz + 0.07, new THREE.MeshBasicMaterial({ map: clockFace, transparent: true }));
  cf.renderOrder = 2;
  const hand = (len, w) => { const g = group(clockAt.x, clockAt.y, wz + 0.1, 0, true); const b = box(w, len, 0.04, 0, len / 2 - 0.15, 0, M.black, { to: g, receive: false }); b.renderOrder = 3; return g; };
  const hourHand = hand(0.95, 0.2), minHand = hand(1.45, 0.14);
  // the lit sign: it buzzes
  const neonTex = canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = '#0d0f13'; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.font = 'italic 900 78px "Trebuchet MS", system-ui, sans-serif'; g.shadowColor = '#ff3d8a'; g.shadowBlur = 22; g.strokeStyle = '#ff5c9d'; g.lineWidth = 5; g.strokeText('OPEN LATE', w / 2, 62);
    g.font = '800 30px system-ui, sans-serif'; g.shadowColor = '#34d6ff'; g.shadowBlur = 14; g.fillStyle = '#7fe6ff'; g.fillText('TYRES · WELDING · BIG GUNS', w / 2, 128);
  });
  const neon = plane(10.5, 3.3, 27.5, 14.6, wz + 0.08, new THREE.MeshBasicMaterial({ map: neonTex, toneMapped: false }));
  box(11, 3.8, 0.2, 27.5, 14.6, wz - 0.05, M.black);
  const neonWash = wash(20, 10, 27.5, 14.4, wz + 0.12, 0xff5c9d, 0.16);
  fan(21.5, 18.6); pendant(22, 11.5, -23.5);

  // -- over the door: the range sign and its two beacons ---
  const rangeTex = canvasTex(512, 96, (g, w, h) => {
    g.fillStyle = '#17110c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffb33a'; g.lineWidth = 5; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#ffb33a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'italic 900 54px "Trebuchet MS", system-ui, sans-serif'; g.fillText('TEST RANGE', w / 2, 50);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const x = w / 2 + s * (196 + i * 18); g.beginPath(); g.moveTo(x - 7, 28); g.lineTo(x + 7, 28); g.lineTo(x, 68); g.closePath(); g.fill(); }
  });
  plane(15, 2.8, 0, 20.4, wz + 0.08, new THREE.MeshBasicMaterial({ map: rangeTex, toneMapped: false })); box(15.6, 3.3, 0.2, 0, 20.4, wz - 0.05, M.black);
  const beacons = [-9.6, 9.6].map((x) => {
    cyl(0.6, 0.4, x, 19.3, wz + 0.7, M.dark, { seg: 10 }); box(0.3, 0.3, 0.8, x, 19.2, wz + 0.3, M.dark);
    const mat = basic(0xffa21a, 2.4), dome = cyl(0.5, 0.9, x, 19.95, wz + 0.7, mat, { r2: 0.38, seg: 10, receive: false }); dome.userData.live = true;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: blob, color: 0xff9a1a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    sp.position.set(x, 19.95, wz + 0.9); sp.scale.set(6, 6, 1); sp.userData.live = true; root.add(sp);
    return { mat, sp };
  });

  // -- along the side walls: racking ---
  rack(-hw + 2, -15, 16, Math.PI / 2); rack(hw - 2, -21.5, 12, -Math.PI / 2);

  // -- the floor: oil, scuffs and tyre marks (one see-through sheet over it) ---
  {
    const t = canvasTex(1024, 1024, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const stain = (x, y, r, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(18,16,14,${a})`); gr.addColorStop(0.6, `rgba(18,16,14,${a * 0.55})`); gr.addColorStop(1, 'rgba(18,16,14,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rnd() * 0.4), rnd() * 3, 0, 7); g.fill(); };
      for (let i = 0; i < 40; i++) stain(rnd() * w, rnd() * h, 6 + rnd() * 20, 0.08 + rnd() * 0.16);
      for (const [x, y] of [[170, 870], [215, 835], [820, 880], [850, 905], [240, 660]]) { stain(x, y, 30, 0.34); stain(x + 14, y - 8, 14, 0.45); }   // (under the benches and the hoist)
      g.strokeStyle = 'rgba(20,18,16,0.2)'; g.lineWidth = 9; g.lineCap = 'round';
      for (const dx of [-26, 26]) { g.beginPath(); g.moveTo(512 + dx, 1010); g.bezierCurveTo(512 + dx, 800, 500 + dx, 640, 512 + dx, 560); g.stroke(); }   // (the way in from the yard)
      g.lineWidth = 7; g.strokeStyle = 'rgba(20,18,16,0.16)';
      for (let i = 0; i < 5; i++) { const x = 120 + rnd() * 780, y = 120 + rnd() * 420; g.beginPath(); g.arc(x, y, 60 + rnd() * 90, rnd() * 6, rnd() * 6 + 1.2); g.stroke(); }
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(R.w - 1, R.front + R.back - 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI; m.position.set(0, 0.006, (R.back - R.front) / 2); m.renderOrder = 1; m.userData.live = true; root.add(m);
  }

  // ---- the things that move ----------------------------------------------------------------------------------------
  // the chain hoist: a runway beam under the trusses, and an engine on the hook, swinging a little
  box(0.7, 0.9, 24, 17.6, 20.6, -17, M.yellow); for (const z of [-27, -17, -7]) box(0.3, 1.6, 0.3, 17.6, 21.6, z, M.steel);
  const hoist = group(17.6, 20.1, -12.5, 0, true);
  box(1.4, 0.9, 1.8, 0, -0.2, 0, M.dark, { to: hoist }); box(0.14, 7.2, 0.14, 0, -4.2, 0, M.steel, { to: hoist }); box(0.5, 0.6, 0.5, 0, -7.9, 0, M.yellow, { to: hoist });
  {
    const e = new THREE.Group(); e.position.set(0, -10.2, 0); e.rotation.y = 0.5; hoist.add(e);
    const b = (w, h, d, x, y, z, m, o = {}) => box(w, h, d, x, y, z, m, { to: e, cast: !mobile, ...o });
    b(0.1, 1.6, 0.1, -0.8, 1.6, -1.2, M.steel, { rz: -0.45 }); b(0.1, 1.6, 0.1, 0.8, 1.6, 1.2, M.steel, { rz: 0.45 });   // (the slings)
    b(2.4, 2.2, 4, 0, 0, 0, X.iron); b(1.5, 0.9, 3.8, -1.25, 1.1, 0, X.orange, { rz: 0.6 }); b(1.5, 0.9, 3.8, 1.25, 1.1, 0, X.orange, { rz: -0.6 });
    b(1.4, 0.7, 2.6, 0, 1.7, 0, M.steel); b(1, 0.6, 1.2, 0, 2.3, 0.2, X.chrome); b(2.8, 1.6, 0.8, 0, -0.3, -2.3, M.steel); b(2, 0.5, 3, 0, -1.3, 0, M.dark);
    cyl(0.8, 0.3, 0, -0.3, 2.2, M.black, { rx: Math.PI / 2, seg: 10, to: e }); cyl(0.5, 0.3, 0.9, 0.9, 2.2, M.black, { rx: Math.PI / 2, seg: 10, to: e });
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) b(0.9, 0.3, 0.3, s * 1.75, 0.2, -1.4 + i * 0.95, X.chrome, { rz: s * 0.5, cast: false });
  }

  // a figure in overalls, made of blocks: feet at the group's origin, facing its +z. The top half leans from the hips,
  // and the arms swing from the shoulders.
  const person = (x, y, z, ry, suit, o = {}) => {
    const g = group(x, y, z, ry, true), c = { to: g, cast: !mobile };
    for (const s of [-0.6, 0.6]) { box(0.95, 0.5, 1.5, s, 0.25, 0.2, X.boot, c); box(0.9, 3, 0.95, s, 2, 0, suit, c); }
    const top = new THREE.Group(); top.position.set(0, 3.4, 0); g.add(top);
    const t = { to: top, cast: !mobile };
    box(2.3, 2.7, 1.2, 0, 1.35, 0, suit, t); box(2.34, 0.35, 1.24, 0, 1.9, 0, X.hiVis, t);
    const head = new THREE.Group(); head.position.set(0, 2.75, 0); top.add(head);
    box(1.15, 1.2, 1.15, 0, 0.65, 0, X.skin, { to: head, cast: !mobile });
    const arm = (s) => {
      const a = new THREE.Group(); a.position.set(s * 1.5, 2.45, 0); top.add(a);
      box(0.7, 2.2, 0.7, 0, -1, 0, suit, { to: a, cast: !mobile }); box(0.8, 0.6, 0.8, 0, -2.3, 0, X.glove, { to: a });
      return a;
    };
    return { g, top, head, armL: arm(1), armR: arm(-1), ...o };
  };

  // the welder, up on a tower beside the car on the lift, at work on its flank: mask down while the arc is lit. (Up
  // there he and his sparks show over the top of the car on the turntable, on a phone as well.)
  const DECK = 5.2, ARC = new THREE.Vector3(LIFT.x + 4.45, DECK + 4.75, LIFT.z - 8);   // (far enough back to show past the lift's post)
  {
    const x = ARC.x + 3.6, z = ARC.z + 1.9, w = 3.8, d = 5.6;
    box(w, 0.3, d, x, DECK - 0.15, z, M.wood, C); box(w + 0.3, 0.35, d + 0.3, x, DECK - 0.45, z, M.steel);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { box(0.3, DECK + 3.6, 0.3, x + sx * (w / 2), (DECK + 3.6) / 2 + 0.4, z + sz * (d / 2), M.yellow, C); cyl(0.4, 0.3, x + sx * (w / 2), 0.4, z + sz * (d / 2), M.tyre, { rx: Math.PI / 2, seg: 8 }); }
    for (const y of [1.6, DECK + 2, DECK + 3.8]) { box(0.2, 0.2, d, x + w / 2, y, z, M.yellow); box(w, 0.2, 0.2, x, y, z - d / 2, M.yellow); if (y < DECK) box(w, 0.2, 0.2, x, y, z + d / 2, M.yellow); }
    box(0.16, 0.16, 6.6, x + w / 2, 3.2, z, M.steel, { rx: 0.62 }); box(0.16, 0.16, 6.6, x + w / 2, 3.2, z, M.steel, { rx: -0.62 });   // (cross braces)
    for (let i = 0; i < 4; i++) box(1.6, 0.16, 0.16, x + 0.4, 0.9 + i * 1.15, z + d / 2 + 0.05, M.steel);   // (the rungs up the end)
  }
  const welder = person(ARC.x + 4, DECK, ARC.z + 1.5, -Math.PI / 2, X.suitA);
  const mask = new THREE.Group(); mask.position.set(0, 0.95, 0.5); welder.head.add(mask);
  box(1.4, 1.6, 0.3, 0, -0.45, 0.2, M.black, { to: mask }); box(1.42, 0.5, 0.9, 0, 0.3, -0.25, M.black, { to: mask }); const visor = box(0.95, 0.34, 0.06, 0, -0.3, 0.37, X.visor, { to: mask, receive: false });
  box(0.3, 0.9, 0.3, 0, -2.9, 0, M.steel, { to: welder.armR });   // (the torch)
  const arcCore = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), basic(0xcfe4ff, 6)); arcCore.position.copy(ARC); arcCore.userData.live = true; root.add(arcCore);
  const arcGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: blobTex('rgba(255,255,255,1)', 'rgba(150,200,255,0.45)'), color: 0xbfdcff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  arcGlow.position.copy(ARC); arcGlow.userData.live = true; root.add(arcGlow);
  const arcWall = wash(30, 22, ARC.x, 9, wz + 0.55, 0x9ec8ff, 0), arcFloor = wash(26, 22, ARC.x, 0.07, ARC.z + 1, 0x9ec8ff, 0, { floor: true });
  // the smoke off the weld: a few soft puffs going up
  const smokeTex = blobTex('rgba(255,255,255,0.9)', 'rgba(255,255,255,0.3)');
  const smoke = Array.from({ length: mobile ? 3 : 6 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x9aa3ad, transparent: true, opacity: 0, depthWrite: false }));
    s.userData.live = true; s.renderOrder = 5; root.add(s);
    return { s, t: 1, off: i / 6 };
  });

  // the fitter, at the vice with a grinder: the sparks go off to the side, towards the door
  const GRIND = new THREE.Vector3(19.7, 5.75, -27);
  const fitter = person(22.5, 0, -24.9, -2.25, X.suitB);
  box(1.3, 0.5, 1.3, 0, 1.45, 0, M.yellow, { to: fitter.head, cast: !mobile }); box(1.3, 0.14, 0.5, 0, 1.25, 0.85, M.yellow, { to: fitter.head });   // (a hard hat)
  box(1.05, 0.3, 0.1, 0, 0.75, 0.6, X.visor, { to: fitter.head });   // (goggles)
  const grinder = new THREE.Group(); grinder.position.set(-0.75, -2.6, 0.2); fitter.armR.add(grinder);
  box(0.5, 1.7, 0.5, 0, -0.3, 0, X.gasG, { to: grinder }); cyl(0.75, 0.1, 0, -1.2, 0.1, M.steel, { rx: Math.PI / 2, seg: 12, to: grinder });
  const grindGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: blob, color: 0xffb04a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  grindGlow.position.copy(GRIND); grindGlow.scale.set(3.4, 3.4, 1); grindGlow.userData.live = true; root.add(grindGlow);
  const grindWall = wash(15, 10, GRIND.x - 1, 5.5, wz + 0.55, 0xffa040, 0);

  const sparks = makeSparks(root, mobile ? 70 : 150);
  const weld = { on: false, t: 0.6, lean: 0, f: 0, acc: 0 }, grind = { on: false, t: 2.2, lean: 0.35, f: 0, acc: 0 };
  const RATE = mobile ? 0.5 : 1;
  let time = 0, tubeT = 3, tubeBurst = 0, neonT = 5, neonBurst = 0, clockT = 0;
  const ease = (a, b, k) => a + (b - a) * k;

  function step(dt) {
    dt = Math.min(dt, 0.1); time += dt;
    const k = 1 - Math.exp(-dt * 6);

    // -- the welder: a run of weld, then mask up for a look at it ---
    if ((weld.t -= dt) <= 0) { weld.on = !weld.on; weld.t = weld.on ? 2.4 + Math.random() * 3 : 1.4 + Math.random() * 1.8; }
    // the arc sputters: mostly full, now and then it drops for a frame or two
    weld.f = weld.on ? (Math.random() < 0.12 ? 0.25 : 0.65 + Math.random() * 0.35) : Math.max(0, weld.f - dt * 9);
    weld.lean = ease(weld.lean, weld.on ? 0.15 : 0, k);
    welder.top.rotation.x = weld.lean + (weld.on ? Math.sin(time * 9) * 0.006 : 0);
    welder.armR.rotation.x = ease(welder.armR.rotation.x, (weld.on ? -1.22 : -0.55) - weld.lean, k); welder.armL.rotation.x = ease(welder.armL.rotation.x, weld.on ? -0.9 : -0.1, k * 0.6);
    welder.head.rotation.x = ease(welder.head.rotation.x, weld.on ? 0.2 : -0.08, k); welder.head.rotation.y = ease(welder.head.rotation.y, weld.on ? 0 : 0.7, k * 0.5);
    mask.rotation.x = ease(mask.rotation.x, weld.on ? 0 : -1.25, Math.min(1, k * 2.5));
    const f = weld.f;
    arcCore.visible = arcGlow.visible = f > 0.02;
    arcGlow.scale.setScalar(2.5 + f * 4.5); arcGlow.material.opacity = Math.min(1, f * 1.2);
    arcWall.material.opacity = f * 0.34; arcFloor.material.opacity = f * 0.3;
    visor.material.color.setRGB(0.07 + f * 0.9, 0.1 + f * 1.3, 0.14 + f * 2);
    if (weld.on) {
      weld.acc += dt * 46 * RATE * (0.4 + Math.random() * 1.2);
      while (weld.acc >= 1) {
        weld.acc -= 1;
        const a = Math.random() * 6.283, s = 2.5 + Math.random() * 8.5, up = 0.25 + Math.random() * 0.75;
        sparks.emit(ARC.x + 0.1, ARC.y, ARC.z, Math.abs(Math.cos(a)) * s * 0.75, s * (up - 0.45), Math.sin(a) * s * 0.8 + 1.5, 0.45 + Math.random() * 0.9, 6, 5, 3.4);
      }
    }
    for (const p of smoke) {
      p.t += dt * 0.34;
      if (p.t >= 1) { if (!weld.on) { p.s.material.opacity = 0; continue; } p.t = p.off * 0.2; p.x = ARC.x + (Math.random() - 0.5) * 0.5; p.z = ARC.z + (Math.random() - 0.5) * 0.5; p.d = Math.random() * 6; }
      const t = p.t; p.s.position.set(p.x + 0.4 + Math.sin(p.d + t * 4) * 0.6 * t, ARC.y + 0.4 + t * 8, p.z + t * 1.5); p.s.scale.setScalar(1.2 + t * 4.2); p.s.material.opacity = 0.22 * Math.sin(Math.min(1, t) * Math.PI);
    }

    // -- the fitter: bursts on the grinder ---
    if ((grind.t -= dt) <= 0) { grind.on = !grind.on; grind.t = grind.on ? 1.3 + Math.random() * 2.4 : 1.2 + Math.random() * 2.6; }
    grind.f = ease(grind.f, grind.on ? 1 : 0, 1 - Math.exp(-dt * 12));
    fitter.top.rotation.x = ease(fitter.top.rotation.x, grind.on ? 0.42 : 0.2, k);
    const shake = grind.on ? Math.sin(time * 61) * 0.02 : 0;
    fitter.armR.rotation.x = ease(fitter.armR.rotation.x, grind.on ? -1.2 : -0.85, k) + shake; fitter.armL.rotation.x = fitter.armR.rotation.x - 0.1; fitter.armL.rotation.z = -0.5; fitter.armR.rotation.z = 0.25;
    fitter.head.rotation.x = ease(fitter.head.rotation.x, grind.on ? 0.3 : 0, k);
    grindGlow.material.opacity = grind.f * (0.6 + Math.random() * 0.4); grindWall.material.opacity = grind.f * (0.16 + Math.random() * 0.08);
    if (grind.on) {
      grind.acc += dt * 80 * RATE;
      while (grind.acc >= 1) {
        grind.acc -= 1;
        const s = 13 + Math.random() * 12;
        sparks.emit(GRIND.x, GRIND.y, GRIND.z, -s * (0.85 + Math.random() * 0.2), s * (0.05 + Math.random() * 0.32), s * (0.1 + (Math.random() - 0.5) * 0.42) + 2, 0.3 + Math.random() * 0.5, 6, 3.6, 1.2);
      }
    }
    sparks.step(dt);

    // -- the rest of the shop ---
    hoist.rotation.z = Math.sin(time * 0.9) * 0.035; hoist.rotation.x = Math.sin(time * 1.31 + 1) * 0.022; hoist.children[hoist.children.length - 1].rotation.y = 0.5 + Math.sin(time * 0.23) * 0.5;
    fans[0].rotation.z -= dt * 5.2; fans[1].rotation.z -= dt * 3.4;
    motor.position.y = 3.4 + Math.sin(time * 47) * 0.03; motor.position.x = 34.5 + Math.sin(time * 39) * 0.02;
    beacons.forEach((b, i) => { const p = Math.max(0, Math.sin(time * 3.2 + i * Math.PI)) ** 3; b.mat.color.setRGB(0.5 + p * 4, 0.3 + p * 2.2, 0.05 + p * 0.3); b.sp.material.opacity = 0.08 + p * 0.8; b.sp.scale.setScalar(4 + p * 5); });
    // the strip light with the bad starter: fine for a while, then a stutter
    if ((tubeT -= dt) <= 0) { tubeBurst = 0.35 + Math.random() * 0.5; tubeT = 3.5 + Math.random() * 7; }
    let tube = 1; if (tubeBurst > 0) { tubeBurst -= dt; tube = Math.random() < 0.5 ? 0.15 : 1; }
    X.tubeBad.color.setRGB(1.38 * tube, 1.44 * tube, 1.5 * tube); badWash.material.opacity = 0.3 * tube;
    if ((neonT -= dt) <= 0) { neonBurst = 0.2 + Math.random() * 0.3; neonT = 6 + Math.random() * 9; }
    let nk = 0.96 + Math.sin(time * 23) * 0.04; if (neonBurst > 0) { neonBurst -= dt; nk = Math.random() < 0.5 ? 0.3 : 1; }
    neon.material.color.setScalar(1.7 * nk); neonWash.material.opacity = 0.16 * nk;
    if ((clockT -= dt) <= 0) { clockT = 5; const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60; minHand.rotation.z = -m / 60 * Math.PI * 2; hourHand.rotation.z = -((d.getHours() % 12) + m / 60) / 12 * Math.PI * 2; }
  }
  step(0.016);
  return { step };
}
