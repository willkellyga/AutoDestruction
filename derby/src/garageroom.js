// The garage itself: a workshop of our own, out past the edge of the map, where the car stands on a turntable while it is
// built. Through the big door at the back is the yard: a walled lot where the guns are tried on a target car and a
// build is taken for a test drive. None of it is part of the voxel world (nothing here can be knocked down, and the
// map's own buildings are far away), so trying things out never touches the round.
//
// The workshop's middle is at O. The turntable is there; the door is in the wall on the -z side, and the yard runs on
// from it to -z. Everything is plain three.js boxes and cylinders, built once and shown only while the garage is open.
import * as THREE from 'three';

// where the workshop stands, relative to the map (it is behind the map's z = 0 edge, facing away from it)
export const ROOM = { w: 80, back: 34, front: 30, h: 24, door: 30, doorH: 15 };
export const YARD = { w: 200, d: 210 };

function stripes(a, b, n = 8, w = 128, h = 16) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b;
  const s = w / n;
  for (let i = -1; i < n + 1; i++) { g.beginPath(); g.moveTo(i * s, h); g.lineTo(i * s + s / 2, h); g.lineTo(i * s + s, 0); g.lineTo(i * s + s / 2, 0); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function sign(lines, w = 512, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = '#120d0a'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ffb33a'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ffb33a'; g.font = `italic 900 ${Math.round(h * 0.42)}px "Trebuchet MS", system-ui, sans-serif`;
  g.fillText(lines[0], w / 2, h * (lines[1] ? 0.4 : 0.5));
  if (lines[1]) { g.fillStyle = '#ffe2b0'; g.font = `700 ${Math.round(h * 0.17)}px system-ui, sans-serif`; g.fillText(lines[1], w / 2, h * 0.76); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function makeGarageRoom({ scene, WX, mobile }) {
  const O = { x: WX / 2, z: -420 };
  const root = new THREE.Group(); root.name = 'garage-room'; root.visible = false;
  root.position.set(O.x, 0, O.z); root.matrixAutoUpdate = true;
  scene.add(root);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, ...o });
  const M = {
    floor: std(0x77736b, { roughness: 0.7, metalness: 0.08 }), wall: std(0x52606e), rib: std(0x43505c), dark: std(0x232529), steel: std(0x8a9098, { metalness: 0.5, roughness: 0.45 }),
    yellow: std(0xe8b02a), red: std(0xb8352a), black: std(0x1d1e21), tyre: std(0x1e1f22, { roughness: 0.95 }), wood: std(0x8a5f3a), board: std(0xa88758), pegs: std(0x7d6a52),
    lot: std(0x3c3e43, { roughness: 1 }), conc: std(0x9a958a), rust: std(0x7a4a2e), blue: std(0x2f62a8), green: std(0x3d7d55),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff1d0, toneMapped: false }), lampW: new THREE.MeshBasicMaterial({ color: 0xffe0a8 }),
    paint: new THREE.MeshBasicMaterial({ color: 0xd9a52a }), white: new THREE.MeshBasicMaterial({ color: 0xc9c9c2 }),
  };
  const boxG = new THREE.BoxGeometry(1, 1, 1);
  const box = (w, h, d, x, y, z, mat, o = {}) => {
    const m = new THREE.Mesh(boxG, mat); m.scale.set(w, h, d); m.position.set(x, y, z);
    if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; if (o.rx) m.rotation.x = o.rx;
    m.castShadow = !!o.cast; m.receiveShadow = o.receive !== false;
    (o.to || root).add(m); return m;
  };
  const cyl = (r, h, x, y, z, mat, o = {}) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r2 ?? r, r, h, o.seg || 24), mat); m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz;
    m.castShadow = !!o.cast; m.receiveShadow = o.receive !== false; (o.to || root).add(m); return m;
  };
  const R = ROOM, hw = R.w / 2;

  // ---- the workshop -------------------------------------------------------------------------------------------------
  // floor, with a painted bay round the turntable and a lane out to the door
  box(R.w, 0.2, R.front + R.back, 0, -0.1, (R.back - R.front) / 2, M.floor);
  const line = (w, d, x, z, mat = M.paint) => box(w, 0.02, d, x, 0.01, z, mat, { receive: false });
  line(0.5, 26, -12.5, -13); line(0.5, 26, 12.5, -13);
  for (let i = 0; i < 5; i++) line(4, 0.6, 0, -16 - i * 3.2, M.white);
  // the turntable: a steel disc in a ring of warning stripes (it turns with the car: main.js sets lift.rotation.y)
  {
    // a ring of yellow and black wedges round it, painted on the floor
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    const n = 36;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? '#1d1e21' : '#e8b02a'; g.beginPath();
      g.arc(256, 256, 254, i / n * Math.PI * 2, (i + 1) / n * Math.PI * 2); g.arc(256, 256, 222, (i + 1) / n * Math.PI * 2, i / n * Math.PI * 2, true); g.closePath(); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(23, 23), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.015; ring.receiveShadow = true; root.add(ring);
  }
  const lift = new THREE.Group(); lift.position.set(0, 0.07, 0); root.add(lift);
  cyl(10, 0.14, 0, 0, 0, std(0x7b8088, { metalness: 0.55, roughness: 0.4 }), { seg: 48, to: lift });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; box(19, 0.03, 0.3, 0, 0.08, 0, M.dark, { ry: a, to: lift }); }
  box(1.2, 0.03, 1.2, 0, 0.09, 8.6, M.yellow, { to: lift });   // a mark at the nose, so the turn shows
  // walls: corrugated sheet on a dark plinth, ribs every few metres
  const wall = (len, x, z, ry, skip) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    const parts = skip ? [[-len / 2, -skip / 2], [skip / 2, len / 2]] : [[-len / 2, len / 2]];
    for (const [a, b] of parts) {
      box(b - a, 2.4, 0.8, (a + b) / 2, 1.2, 0, M.dark, { to: g });
      const band = new THREE.MeshStandardMaterial({ map: stripes('#e8b02a', '#1d1e21', 8, 128, 16), roughness: 0.8 }); band.map.repeat.set((b - a) / 8, 1);
      box(b - a, 0.7, 0.85, (a + b) / 2, 2.75, 0, band, { to: g });
      box(b - a, R.h - 2.4, 0.5, (a + b) / 2, 2.4 + (R.h - 2.4) / 2, 0, M.wall, { to: g });
      for (let s = a + 1; s < b; s += 2.2) box(0.7, R.h - 2.4, 0.35, s, 2.4 + (R.h - 2.4) / 2, -0.35, M.rib, { to: g });
    }
    if (skip) {
      box(skip, R.h - R.doorH, 0.5, 0, R.doorH + (R.h - R.doorH) / 2, 0, M.wall, { to: g });
      // the roll-up door, rolled up under the lintel, and its frame in warning stripes
      cyl(1.5, skip + 1, 0, R.doorH + 1.2, 1.2, M.steel, { rz: Math.PI / 2, to: g, seg: 14 });
      const fr = new THREE.MeshStandardMaterial({ map: stripes('#e8b02a', '#1d1e21', 10, 256, 16), roughness: 0.8 }); fr.map.repeat.set(1, 1);
      const post = (x) => { const m = box(1.2, R.doorH, 1.2, x, R.doorH / 2, 0.2, fr, { to: g }); return m; };
      post(-skip / 2 - 0.4); post(skip / 2 + 0.4);
      box(skip + 2, 1, 1.2, 0, R.doorH + 0.1, 0.2, fr, { to: g });
    }
    return g;
  };
  wall(R.w, 0, R.back, Math.PI);                          // behind the camera
  wall(R.w, 0, -R.front, 0, R.door);                      // the door wall
  wall(R.front + R.back, hw, (R.back - R.front) / 2, -Math.PI / 2);
  wall(R.front + R.back, -hw, (R.back - R.front) / 2, Math.PI / 2);
  // roof and trusses
  box(R.w, 0.6, R.front + R.back, 0, R.h + 0.3, (R.back - R.front) / 2, M.dark);
  for (let z = -R.front + 4; z < R.back; z += 9) {
    box(R.w, 0.8, 0.6, 0, R.h - 1.6, z, M.steel);
    for (let x = -hw + 4; x < hw; x += 8) box(0.4, 3.2, 0.4, x, R.h - 1.6, z, M.steel, { rz: (x / 8) % 2 ? 0.7 : -0.7 });
  }
  // the work lights over the turntable, hung on chains (they glow: the bloom picks them up)
  for (const [x, z] of [[-7, -4], [7, -4], [-7, 6], [7, 6]]) {
    box(1.4, 0.5, 7, x, 17, z, M.dark); box(1, 0.12, 6.4, x, 16.7, z, M.lamp);
    box(0.08, R.h - 17.5, 0.08, x, (R.h + 17.5) / 2, z - 3, M.black); box(0.08, R.h - 17.5, 0.08, x, (R.h + 17.5) / 2, z + 3, M.black);
  }
  // the sign on the left wall
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(22, 5.5), new THREE.MeshBasicMaterial({ map: sign(['AUTO DESTRUCTION', 'PARTS · REPAIRS · WEAPONS']), toneMapped: false }));
  sg.position.set(-hw + 0.7, 15, 4); sg.rotation.y = Math.PI / 2; root.add(sg);
  // tool wall: a pegboard with spanners and hammers on it, a workbench under it, on the right wall
  {
    const g = new THREE.Group(); g.position.set(hw - 0.8, 0, 8); g.rotation.y = -Math.PI / 2; root.add(g);
    box(20, 7, 0.2, 0, 8.5, 0, M.pegs, { to: g });
    for (let i = 0; i < 9; i++) {
      const x = -8.5 + i * 2.1, l = 2.2 + (i % 3) * 0.6;
      box(0.3, l, 0.15, x, 9.8 - l / 2, -0.2, M.steel, { to: g });
      if (i % 3 === 0) box(1, 0.5, 0.25, x, 9.8 - l, -0.2, M.red, { to: g });
      else box(0.8, 0.4, 0.2, x, 9.8, -0.2, M.steel, { to: g });
    }
    box(22, 0.6, 3.4, 0, 3.6, -1.6, M.wood, { to: g });
    box(0.6, 3.4, 3, -10.5, 1.7, -1.6, M.dark, { to: g }); box(0.6, 3.4, 3, 10.5, 1.7, -1.6, M.dark, { to: g });
    box(3, 1.6, 1.8, -6, 4.7, -1.6, M.red, { to: g }); box(2.2, 1, 1.4, 4, 4.4, -1.8, M.blue, { to: g });
    // a red tool chest at the end of the bench
    box(5, 6, 3.4, 13.5, 3, -1.8, M.red, { to: g, cast: false });
    for (let i = 0; i < 5; i++) box(4.6, 0.12, 0.1, 13.5, 1.2 + i * 1.05, -3.55, M.steel, { to: g });
  }
  // tyre stacks and oil drums in the corners
  const tyreStack = (x, z, n, to = root) => { for (let i = 0; i < n; i++) cyl(2.1, 1.3, x + (i % 2) * 0.2, 0.65 + i * 1.3, z, M.tyre, { r2: 2.1, seg: 18, to }); };
  tyreStack(-hw + 4, R.back - 4, 5); tyreStack(-hw + 8.6, R.back - 4.5, 3); tyreStack(hw - 4, -R.front + 4, 4);
  for (const [x, z, m] of [[-hw + 3.5, -R.front + 3.5, M.blue], [-hw + 7, -R.front + 3.2, M.red], [-hw + 3.6, -R.front + 7, M.green]]) cyl(1.5, 4, x, 2, z, m, { seg: 16 });
  // a two-post lift at the back, for show
  for (const x of [-16, 16]) { box(1.4, 15, 1.4, x, 7.5, R.back - 8, M.yellow); box(5, 0.6, 1, x - Math.sign(x) * 2.6, 4, R.back - 8, M.yellow); }
  box(33.4, 1, 1.6, 0, 15.2, R.back - 8, M.yellow);
  // the scrap pile in the back corner: it grows with the scrap you have (setScrap)
  const pile = new THREE.Group(); pile.position.set(hw - 10, 0, R.back - 9); root.add(pile);
  const pileMats = [M.rust, M.steel, M.dark, M.rib, M.rust];
  const pieces = [];
  {
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 7, h = Math.max(0.3, 5.5 * (1 - r / 7.5) * (0.6 + rnd() * 0.5));
      const m = box(0.8 + rnd() * 2.2, 0.4 + rnd() * 1.2, 0.8 + rnd() * 2.2, Math.cos(a) * r, h * (i / 70), Math.sin(a) * r, pileMats[i % 5], { to: pile, ry: rnd() * 3, rz: (rnd() - 0.5) * 0.8, rx: (rnd() - 0.5) * 0.8 });
      pieces.push(m);
    }
  }
  function setScrap(n) {
    const k = Math.max(0.15, Math.min(1, n / 3000));
    pieces.forEach((m, i) => { m.visible = i / pieces.length < k; });
  }

  // ---- the yard: a walled lot past the door -------------------------------------------------------------------------
  const Y = YARD, yz0 = -R.front, yz1 = -R.front - Y.d;   // (in the room's own space: z from the door wall out)
  box(Y.w + 40, 0.2, Y.d + 30, 0, -0.12, (yz0 + yz1) / 2 - 8, M.lot);
  // painted circles and lines to drive round
  for (const [x, z, r] of [[-45, -110, 18], [45, -150, 22]]) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.6, r, 64), M.white); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.01, z); root.add(m);
  }
  for (let z = yz0 - 12; z > yz1 + 10; z -= 12) line(0.6, 6, 0, z, M.paint);
  // jersey barriers round the edge, in red and white
  const barrier = (len, x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    for (let s = -len / 2; s < len / 2 - 0.1; s += 6) {
      const m = ((s + len / 2) / 6) % 2 < 1 ? M.red : M.white;
      box(5.8, 3.2, 2, s + 3, 1.6, 0, m === M.white ? M.conc : M.red, { to: g });
      box(5.8, 0.8, 3, s + 3, 0.4, 0, M.conc, { to: g });
    }
  };
  const bx = Y.w / 2 + 3, bz0 = yz0 - 1, bz1 = yz1 - 3;
  barrier(Y.d + 6, bx, (bz0 + bz1) / 2, Math.PI / 2); barrier(Y.d + 6, -bx, (bz0 + bz1) / 2, Math.PI / 2);
  barrier(Y.w + 8, 0, bz1, 0);
  // a row across the yard between the range and the test-drive lot (a gap at each end to see through)
  barrier(Y.w - 30, 0, -R.front - 44, 0);
  // the yard's front: the workshop's outside wall either side of it
  box(Y.w / 2 - hw + 3, 10, 1, (hw + bx) / 2, 5, -R.front - 0.4, M.wall); box(Y.w / 2 - hw + 3, 10, 1, -(hw + bx) / 2, 5, -R.front - 0.4, M.wall);
  // floodlights at the corners
  for (const [x, z] of [[bx + 5, bz1 - 3], [-bx - 5, bz1 - 3], [bx + 5, -R.front - 70], [-bx - 5, -R.front - 70]]) {
    box(1, 26, 1, x, 13, z, M.steel); box(6, 2.4, 1.4, x, 26, z, M.dark);
    for (const dx of [-1.6, 0, 1.6]) box(1.2, 1.4, 0.2, x + dx, 26, z + 0.75 * Math.sign(-z - 100), M.lamp);
  }
  tyreStack(bx - 6, bz1 + 6, 4); tyreStack(-bx + 6, bz1 + 6, 4); tyreStack(-bx + 6, bz0 - 8, 3);

  // ---- where things go (world space) --------------------------------------------------------------------------------
  const W = (x, z) => ({ x: O.x + x, z: O.z + z });
  return {
    root, lift, O, setScrap,
    spot: W(0, 0),                         // the turntable
    target: { ...W(0, -38), yaw: Math.PI / 2 },   // the firing range's target car, broadside on, through the door
    start: { ...W(0, -R.front - 75), yaw: Math.PI },   // where a test drive starts: out in the lot, heading away from the door
    dummies: [{ ...W(-45, -120), yaw: 0.4 }, { ...W(45, -150), yaw: -1.2 }, { ...W(-5, -205), yaw: Math.PI / 2 }],
    // where a car can go in the yard (its middle): the barriers less a little, and not back in through the door
    bounds: { x0: O.x - Y.w / 2 + 2, x1: O.x + Y.w / 2 - 2, z0: O.z + yz1 + 2, z1: O.z - R.front - 49 },
    show(on) { root.visible = on; },
  };
}
