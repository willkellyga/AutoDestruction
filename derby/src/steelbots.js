// The steelworks' giant robots (maps/steel.js): Monster Mayhem's robot (rivals/src/marshal.js: Steeljaw and his skins),
// built as that game builds him, then posed once and baked. He is made of rigid parts hung on bones, so a pose is a few
// bones turned; the parts are then merged into a handful of meshes, one for everything that stays still and one for
// each limb that moves (`cuts`), so a robot standing at its work costs two or three draws, not forty.
//   makeBot({ skin, stage, pose, cuts, drop })
//     skin   'mecha' (Steeljaw), 'builder' (Jackhammer), 'toy' (Sprocket), 'astro', undefined (the army's Marshal)
//     stage  undefined (full grown), 'teen', 'baby' (the test rig)
//     pose   { bone: [rx, ry, rz] } turned from rest, in radians
//     cuts   bones whose parts (and those of the bones below them) become meshes of their own, hung on a group at the
//            bone's place, to be turned as the robot works: { name: group } comes back in `limbs`
//     drop   bones whose parts are left out (an arm not yet fitted)
//     scale  how big (1: some 70 voxels tall)
//     ownGlow  his lamps and eyes get a material of their own (`litMat` comes back), so they can be dimmed and lit
//   Returns { root, limbs, places, tris }: root faces +z; places are where each bone is, scaled, from his feet.
import * as THREE from 'three';
import { buildMarshal } from '../../rivals/src/marshal.js';

let paint = null, glow = null;
const paintMat = () => paint || (paint = new THREE.MeshLambertMaterial({ vertexColors: true }));
const glowMat = () => glow || (glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));

// many parts as one geometry, each moved by its own matrix; k scales the colours (the lit parts glow past white)
function merge(parts, k = 1) {
  let nv = 0, ni = 0;
  for (const [g] of parts) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), I = new Uint32Array(ni);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  let vo = 0, io = 0;
  for (const [g, m] of parts) {
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
    nm.getNormalMatrix(m);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); P[(vo + i) * 3] = v.x; P[(vo + i) * 3 + 1] = v.y; P[(vo + i) * 3 + 2] = v.z;
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); N[(vo + i) * 3] = v.x; N[(vo + i) * 3 + 1] = v.y; N[(vo + i) * 3 + 2] = v.z;
      C[(vo + i) * 3] = c.getX(i) * k; C[(vo + i) * 3 + 1] = c.getY(i) * k; C[(vo + i) * 3 + 2] = c.getZ(i) * k;
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) I[io + i] = g.index.getX(i) + vo; else for (let i = 0; i < p.count; i++) I[io + i] = vo + i;
    vo += p.count; io += g.index ? g.index.count : p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.setIndex(new THREE.BufferAttribute(I, 1));
  return out;
}

export function makeBot({ skin, stage, pose = {}, cuts = [], drop = [], eyes = 2.2, scale = 1, ownGlow = false } = {}) {
  const litMat = ownGlow ? new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }) : glowMat();   // (his own: its colour dims and lights all his lamps)
  const cr = buildMarshal(stage, skin), B = cr.bones;
  for (const [name, [rx, ry, rz]] of Object.entries(pose)) { const b = B[name]; if (!b) continue; b.rotation.x += rx; b.rotation.y += ry; b.rotation.z += rz; }
  cr.root.position.set(0, 0, 0); cr.root.rotation.set(0, 0, 0); cr.root.scale.setScalar(1);
  cr.root.updateMatrixWorld(true);
  // which mesh each part goes to: the nearest bone above it that is a cut, or the body
  const under = (o) => { for (let p = o; p; p = p.parent) { if (drop.includes(p.name)) return null; if (cuts.includes(p.name)) return p.name; } return ''; };
  const sets = new Map(), inv = new THREE.Matrix4();
  cr.root.traverse((o) => {
    if (!o.isMesh || /^mis\d/.test(o.parent.name)) return;   // (his missiles lie under the floor until he fires them: left out)
    const key = under(o); if (key === null) return;
    const lit = o.material === cr.glowMat || /_glow$/.test(o.name);
    const m = new THREE.Matrix4().copy(o.matrixWorld);
    if (key) m.premultiply(inv.copy(B[key].matrixWorld).invert());
    const id = key + (lit ? '|lit' : '');
    if (!sets.has(id)) sets.set(id, []);
    sets.get(id).push([o.geometry, m]);
  });
  const root = new THREE.Group(), limbs = {};
  // (a cut's group sits where its bone is, under the group of the cut above it, or the root)
  const groupOf = (key) => {
    if (!key) return root;
    if (limbs[key]) return limbs[key];
    const b = B[key], g = new THREE.Group(); g.name = key;
    let up = ''; for (let p = b.parent; p; p = p.parent) if (cuts.includes(p.name)) { up = p.name; break; }
    const parent = groupOf(up);
    const m = new THREE.Matrix4().copy(b.matrixWorld); if (up) m.premultiply(inv.copy(B[up].matrixWorld).invert());
    m.decompose(g.position, g.quaternion, g.scale); parent.add(g); limbs[key] = g;
    return g;
  };
  for (const key of cuts) groupOf(key);
  let tris = 0;
  for (const [id, parts] of sets) {
    const [key, lit] = id.split('|');
    const geo = merge(parts, lit ? eyes : 1), mesh = new THREE.Mesh(geo, lit ? litMat : paintMat());
    mesh.castShadow = false; mesh.receiveShadow = false; tris += geo.index.count / 3;
    groupOf(key).add(mesh);
  }
  for (const p of cr.parts || []) if (p.geometry) p.geometry.dispose();
  const _v = new THREE.Vector3();
  // where a bone was, in the robot's own space, once posed (to hang tools and scaffolds on)
  const at = (name) => { const b = B[name]; return b ? _v.setFromMatrixPosition(b.matrixWorld).toArray() : [0, 0, 0]; };
  const places = {}; for (const name of Object.keys(B)) places[name] = at(name).map((v) => v * scale);   // (as he stands, scaled)
  root.scale.setScalar(scale);
  return { root, limbs, places, tris, litMat };
}
