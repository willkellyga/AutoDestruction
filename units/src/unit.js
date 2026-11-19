// A unit: voxel parts on a small bone tree, pose-function clips with cross-fades, and damage.
// A definition (see soldier.js) gives: kind, h (cube size in town voxels), parts, clips, dieAt.
import * as THREE from 'three';
import { VoxPart } from './voxpart.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const CH = 7; // per bone: rotation x, y, z, offset x, y, z, scale
const blank = () => [0, 0, 0, 0, 0, 0, 1];

export class Unit {
  constructor(def, mats, opts = {}) {
    this.def = def; this.kind = def.kind; this.opts = opts; this.mats = mats;
    this.root = new THREE.Group(); this.root.name = def.kind;
    this.bones = {}; this.rest = {}; this.parts = []; this.order = [];
    for (const p of def.parts(opts)) {
      const b = new THREE.Group(); b.name = p.name; b.rotation.order = 'YXZ';
      const rot = p.rest || [0, 0, 0]; this.rest[p.name] = { pos: p.pivot.map((v) => v * def.h), rot };
      (p.parent ? this.bones[p.parent] : this.root).add(b); this.bones[p.name] = b; this.order.push(p.name);
      if (p.box) {
        const vp = new VoxPart(p.box, def.h, (opts.seed || 0) * 31 + this.parts.length); p.paint(vp, opts); if (def.inner) vp.inside(def.inner); vp.build(mats, b);
        vp.bone = b; vp.name = p.name; for (const m of vp.meshes) if (m) m.userData.unit = this; this.parts.push(vp);
      }
    }
    this.voxels0 = this.voxels; this.dead = false; this.gone = false; this.deadT = 0;
    this.cur = blankPose(this.order); this.from = blankPose(this.order); this.blend = 1; this.blendDur = 0.2;
    this.clip = null; this.t = 0; this.phase = opts.phase ?? ((opts.seed || 0) * 2.399) % 6.283; this.state = {}; // state: free slots a clip can read (aim, speed, ...)
    this.play(def.start || Object.keys(def.clips)[0], 0); this.update(0);
  }
  get voxels() { let n = 0; for (const p of this.parts) n += p.count; return n; }
  get tris() { let n = 0; for (const p of this.parts) n += p.tris; return n; }

  play(name, fade = 0.2) {
    const c = this.def.clips[name]; if (!c || (this.clip === c && c.loop)) return;
    for (const b of this.order) this.from[b] = this.cur[b].slice();
    this.clip = c; this.clipName = name; this.t = 0; this.blend = fade > 0 ? 0 : 1; this.blendDur = fade;
  }
  update(dt) {
    if (this.gone) return;
    const c = this.clip; this.t += dt; if (this.dead) this.deadT += dt;
    const t = c.loop ? this.t : Math.min(this.t, c.dur), pose = c.pose(t, this) || {};
    this.blend = Math.min(1, this.blend + (this.blendDur > 0 ? dt / this.blendDur : 1));
    const w = this.blend * this.blend * (3 - 2 * this.blend);
    for (const name of this.order) {
      const p = pose[name] || ZERO, f = this.from[name], o = this.cur[name], r = this.rest[name], b = this.bones[name];
      for (let i = 0; i < CH; i++) { const target = p[i] === undefined ? (i === 6 ? 1 : 0) : p[i]; o[i] = f[i] + (target - f[i]) * w; }
      b.rotation.set(r.rot[0] + o[0], r.rot[1] + o[1], r.rot[2] + o[2]); b.position.set(r.pos[0] + o[3], r.pos[1] + o[4], r.pos[2] + o[5]); b.scale.setScalar(Math.max(o[6], 0.0001));
    }
    for (const p of this.parts) if (p.dirty || p.more) { p.build(this.mats, p.bone); p.dirty = false; }   // `more`: a big part's rebuild is spread over frames (voxpart.js buildSlabs)
  }
  get finished() { return !this.clip.loop && this.t >= this.clip.dur; }

  // A hit at a world point. `debris(x, y, z, vx, vy, vz, colour, size)` receives the cubes knocked off.
  // Returns the number of cubes removed. The unit dies once it has lost more than def.dieAt of its cubes.
  hit(point, r, debris, push = 10) {
    if (this.gone) return 0;
    this.root.updateWorldMatrix(true, true);
    let n = 0; const out = [];
    for (const p of this.parts) {
      out.length = 0; _v.copy(point); p.bone.worldToLocal(_v);
      const k = p.carve(_v.x, _v.y, _v.z, r, out); n += k;
      for (const [x, y, z, c] of out) {
        _w.set(x, y, z); p.bone.localToWorld(_w);
        const dx = _w.x - point.x, dy = _w.y - point.y, dz = _w.z - point.z, d = Math.hypot(dx, dy, dz) + 0.01, s = push * (0.5 + Math.random());
        debris(_w.x, _w.y, _w.z, dx / d * s, dy / d * s + 4 + Math.random() * 6, dz / d * s, c, this.def.h);
      }
    }
    if (n && !this.dead && this.voxels < this.voxels0 * (1 - this.def.dieAt)) this.kill(point, r, debris);
    return n;
  }
  kill(point, r, debris) {
    if (this.dead) return; this.dead = true; this.deadT = 0;
    if (this.def.onKill) this.def.onKill(this, point, r, debris);
  }
  // Turn into a scorched wreck: a share of the cubes fly off, the rest stay as a burnt shell that can still be hit.
  wreck(debris, frac = 0.3, push = 20) {
    this.root.updateWorldMatrix(true, true);
    const out = [], c0 = this.root.getWorldPosition(new THREE.Vector3());
    for (const p of this.parts) {
      out.length = 0; p.wreck(frac, out);
      for (const [x, y, z, c] of out) {
        _w.set(x, y, z); p.bone.localToWorld(_w);
        const dx = _w.x - c0.x, dz = _w.z - c0.z, d = Math.hypot(dx, dz) + 0.01, s = push * (0.3 + Math.random());
        debris(_w.x, _w.y, _w.z, dx / d * s, 8 + Math.random() * 22, dz / d * s, c, this.def.h);
      }
    }
  }
  // Fly apart into loose cubes and vanish.
  burst(debris, point = null, push = 14, keep = 1) {
    if (this.gone) return;
    this.root.updateWorldMatrix(true, true);
    const out = [], c0 = point || this.root.getWorldPosition(new THREE.Vector3());
    for (const p of this.parts) {
      out.length = 0; p.all(out, keep);
      for (const [x, y, z, c] of out) {
        _w.set(x, y, z); p.bone.localToWorld(_w);
        const dx = _w.x - c0.x, dy = _w.y - c0.y, dz = _w.z - c0.z, d = Math.hypot(dx, dy, dz) + 0.01, s = push * (0.4 + Math.random());
        debris(_w.x, _w.y, _w.z, dx / d * s, Math.abs(dy) / d * s + 5 + Math.random() * 8, dz / d * s, c, this.def.h);
      }
    }
    this.gone = true; this.root.visible = false;
  }
  dispose() { for (const p of this.parts) for (const m of p.meshes) if (m) m.geometry.dispose(); this.root.removeFromParent(); }
}
const ZERO = [0, 0, 0, 0, 0, 0, 1];
function blankPose(order) { const o = {}; for (const n of order) o[n] = blank(); return o; }
