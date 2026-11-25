// Dragon wings: one set of motions for every monster that has them (Emberwing here, Fathom in rivals/src/brine.js).
// A wing is an arm hinged at the shoulder blade (`wingL`, `wingR`) and a part for each finger hinged at the wrist
// (`wing1L`, `wing2L`, ...; kaiju/src/model.js wingParts). On the ground the wings are half folded against the back: the
// arm swept back and the fingers closed like a fan. They snap open and beat in a jump and a pounce, stand open for a roar
// and a special, brake a skid, and fold again on landing. Which, when, is keyed to the clip's name (MOVES); a clip this
// table does not know keeps them folded. On top of that they still trail the chest on springs (kaiju/src/anim.js wingSway).
// A monster's own dials (wingRig's second argument) scale the shared motion; they do not replace it:
//   fold   how tightly they fold on the ground (1 as designed; less leaves them more open)
//   flap   how big the beats are
//   sway   how much they trail the body's movement
//   as     { 'its clip': 'the shared move to use' } for clips with names of its own
// (Scythe's insect wings are another thing altogether: rivals/src/bipedclips.js `insect`.)
import * as THREE from 'three';

const S = Math.sin, PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function key(t, ks) { // smooth curve through [time, value] pairs
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) if (t <= ks[i][0]) { const u = (t - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0]); return ks[i - 1][1] + (ks[i][1] - ks[i - 1][1]) * u * u * (3 - 2 * u); }
  return ks[ks.length - 1][1];
}

// The shared shape of the motion. FOLD: the turn of the left arm at the shoulder from spread (as modelled) to folded,
// [pitch, sweep back, lift] (YXZ, as every bone here). FAN: how far each finger closes toward the last, as a share of the
// angle between them. BEAT: the swing of a full beat up or down, and how far the tips trail it.
export const WINGS = { fold: [-0.5, 0.8, 0.1], fan: 0.62, last: 0.6, pleat: 0.05, beat: 0.34, down: 0.95, fwd: 0.22, trail: 0.3, lag: 0.07, shrug: 0.25 };

// What the wings do in each move: (t, clip) => [open, beat, tremble]. `open` 0 folded to 1 spread; `beat` 1 raised to
// -1 swept down; `tremble` a fast shiver (a roar, a held breath).
const hold = (a, b, c, d) => (t) => key(t, [[a, 0], [b, 1], [c, 1], [d, 0]]);
export const MOVES = {
  // standing: they breathe, and now and then he half opens them, shakes them out and settles them again
  Idle: (t) => { const r = key(t, [[3.5, 0], [3.95, 1], [4.5, 0.75], [5.3, 0]]); return [0.03 + 0.03 * S(TAU * t / 6) + 0.34 * r, 0.12 * S(TAU * t / 3) * (1 - r) + r * (0.25 + 0.3 * S(21 * (t - 3.5)) * key(t, [[3.8, 0], [4.0, 1], [4.7, 0]])), 0]; },
  Run: (t, c) => [0.05 + 0.04 * S(2 * TAU * t / c.dur), 0.1 * S(2 * TAU * t / c.dur + 0.9), 0],
  Bite: (t) => [0.14 * key(t, [[0.2, 0], [0.45, 1], [0.7, 0.3], [1.0, 0]]), 0.2 * key(t, [[0.2, 0], [0.4, 1], [0.55, -0.6], [0.9, 0]]), 0],
  'Claw Swipe': (t) => [0.16 * key(t, [[0.05, 0], [0.3, 1], [0.6, 0.5], [0.95, 0]]), 0.25 * key(t, [[0.05, 0], [0.28, 1], [0.5, -0.8], [0.9, 0]]), 0],
  'Tail Swipe': (t) => [0.4 * key(t, [[0.15, 0], [0.55, 1], [1.1, 0.8], [1.6, 0]]), 0.3 * key(t, [[0.15, 0], [0.5, 1], [1.0, 0.2], [1.5, 0]]), 0],
  Hit: (t) => [0.5 * key(t, [[0, 0], [0.12, 1], [0.4, 0.4], [0.75, 0]]), 0.5 * key(t, [[0, 0], [0.1, 1], [0.3, -0.5], [0.7, 0]]), 0],
  // the roar: they tighten as he draws breath, then stand open and high, shivering, for as long as it lasts
  Roar: (t) => { const h = hold(0.5, 0.9, 2.3, 2.9)(t); return [-0.08 * key(t, [[0, 0], [0.4, 1], [0.6, 0]]) + h, 0.55 * h + 0.25 * key(t, [[0.75, 0], [0.9, 1], [1.2, 0]]), key(t, [[0.8, 0], [1, 1], [2.2, 1], [2.5, 0]])]; },
  // a jump: they cock as he crouches, drive down as he leaves the ground, beat once more in the air, and catch the landing
  Jump: (t) => [key(t, [[0.1, 0], [0.3, 0.3], [0.42, 1], [1.0, 1], [1.14, 0.7], [1.4, 0]]), key(t, [[0.1, 0], [0.38, 1], [0.52, -1], [0.7, 0.75], [0.84, -0.8], [0.98, 0], [1.1, 0.55], [1.4, 0]]), 0],
  // time in the air (the game's own clip for a plain jump or a fall: a slow beat, over and over)
  Air: (t) => [1, key(t % 0.62, [[0, 0.85], [0.2, -1], [0.44, 0.5], [0.62, 0.85]]), 0],
  Stomp: (t) => [key(t, [[0.1, 0], [0.5, 0.6], [0.9, 0.85], [1.1, 0.6], [1.6, 0]]), key(t, [[0.3, 0], [0.86, 0.95], [0.99, -0.9], [1.2, 0.15], [1.6, 0]]), 0],
  'Charge Wind': (t) => [key(t, [[0, 0], [0.5, 0.45]]), key(t, [[0, 0], [0.45, 0.8]]), key(t, [[0.2, 0], [0.5, 1]])],
  Charge: (t, c) => [0.42 + 0.04 * S(2 * TAU * t / c.dur), 0.5 + 0.1 * S(2 * TAU * t / c.dur + 0.9), 0.5],
  Skid: (t) => [key(t, [[0, 0.42], [0.14, 1], [0.42, 0.85], [0.7, 0]]), key(t, [[0, 0.5], [0.14, 0.9], [0.4, 0.2], [0.7, 0]]), 0],
  // a breath: they rise and spread through the charge, and stand open, shivering, behind the stream
  'Fire Breath': (t) => { const h = hold(0.2, 0.8, 1.9, 2.25)(t); return [h, 0.6 * h - 0.25 * key(t, [[0.8, 0], [0.95, 1], [1.9, 1], [2.1, 0]]), key(t, [[0.26, 0], [0.84, 1], [1.9, 1], [2.1, 0]])]; },
  // Meteor Pounce: cocked high in the crouch; two beats on the way up, thrown high and wide for the drop; slammed down
  // with the landing, then up as he rears out of it, and folded
  'Pounce Wind': (t) => [key(t, [[0, 0], [0.26, 0.4], [0.55, 0.45]]), key(t, [[0, 0], [0.26, 0.9], [0.55, 1]]), key(t, [[0.2, 0], [0.5, 1]])],
  'Pounce Air': (t) => [key(t, [[0, 0.45], [0.06, 1]]), key(t, [[0, 1], [0.12, -1], [0.3, 0.7], [0.46, -0.8], [0.62, 0.3], [0.82, 1], [1, 1]]), 0],
  'Pounce Land': (t) => [key(t, [[0, 1], [0.3, 0.9], [0.56, 0.8], [0.85, 0.3], [1.05, 0]]), key(t, [[0, 1], [0.08, -1], [0.3, -0.5], [0.56, 0.6], [0.8, 0.2], [1.05, 0]]), 0],
};
MOVES['Claw Swipe L'] = MOVES['Claw Swipe'];

// A wing's joints, worked out from its points (left side; the right is its mirror image), with a monster's dials.
export function wingRig(pts, dials = {}) {
  const { W, F } = pts, n = F.length, v = (p) => new THREE.Vector3(p[0] - W[0], p[1] - W[1], p[2] - W[2]).normalize();
  const dir = F.map(v), N = dir[0].clone().cross(dir[n - 1]).normalize();          // the wing's own plane: the fingers close about N
  const ang = dir.map((d) => d.angleTo(dir[n - 1]));                                // from each finger to the last
  return { n, N, dir, ang, perp: dir.map((d) => N.clone().cross(d).normalize()), fold: dials.fold ?? 1, flap: dials.flap ?? 1, sway: dials.sway ?? 1, as: dials.as || {} };
}
export const wingBones = (rig) => ['L', 'R'].flatMap((s) => ['wing' + s, ...Array.from({ length: rig.n }, (_, i) => 'wing' + (i + 1) + s)]);

// Pose the wings for time t of clip c, straight onto the bones (after the body's own pose). `c` may be just { name, dur }.
const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1), _y = new THREE.Vector3(0, 1, 0);
const side = (bone, q, sd) => { if (sd > 0) bone.quaternion.copy(q); else bone.quaternion.set(q.x, -q.y, -q.z, q.w); };
export function poseWings(bones, rig, c, t) {
  const mv = MOVES[rig.as[c.name] || c.name], at = (t) => (mv ? mv(t, c) : [0, 0, 0]), D = WINGS;
  const [open, beat, trem] = at(t), was = at(c.loop ? ((t - D.lag) % c.dur + c.dur) % c.dur : Math.max(0, t - D.lag))[1];
  const shut = clamp(1 - open, 0, 1.15) * rig.fold, live = D.shrug + (1 - D.shrug) * clamp(open, 0, 1), sh = 0.02 * trem * S(47 * t);
  const b = (beat + sh) * (beat < 0 ? D.down : D.beat) * rig.flap * live;
  // the arm: folded back, then swung up or down about the body's own length, coming a little forward on the way down
  _e.set(D.fold[0] * shut, D.fold[1] * shut, D.fold[2] * shut); _q.setFromEuler(_e);
  _q2.setFromAxisAngle(_z, b).premultiply(_q.clone().setFromAxisAngle(_y, D.fwd * Math.min(0, b))); _q.premultiply(_q2);
  for (const sd of [1, -1]) side(bones['wing' + (sd > 0 ? 'L' : 'R')], _q, sd);
  // the fingers: closed toward the last one as the wing folds, each sheet lying a little behind the one before; and the
  // tips trail a beat (up on the way down, down on the way up)
  const trail = (was - beat) * D.trail * rig.flap * live;
  for (let i = 0; i < rig.n; i++) {
    const close = (D.last + rig.ang[i] * D.fan) * Math.min(shut, 1.15);
    _q.setFromAxisAngle(rig.N, close).multiply(_q2.setFromAxisAngle(rig.perp[i], D.pleat * (rig.n - i) * Math.min(shut, 1) + trail * (1 + 0.25 * (rig.n - 1 - i))));
    for (const sd of [1, -1]) side(bones['wing' + (i + 1) + (sd > 0 ? 'L' : 'R')], _q, sd);
  }
}

// Tracks for the wing bones alone through a move (the game's Air clip: the body is held, the wings beat).
export function wingTracks(bones, rig, c, fps = 30) {
  const names = wingBones(rig), n = Math.round(c.dur * fps), times = [], rot = Object.fromEntries(names.map((b) => [b, []]));
  for (let f = 0; f <= n; f++) {
    times.push(c.dur * f / n); poseWings(bones, rig, c, c.loop && f === n ? 0 : c.dur * f / n);
    for (const b of names) { const q = bones[b].quaternion, a = rot[b], i = a.length - 4, flip = f && a[i] * q.x + a[i + 1] * q.y + a[i + 2] * q.z + a[i + 3] * q.w < 0 ? -1 : 1; a.push(flip * q.x, flip * q.y, flip * q.z, flip * q.w); }
  }
  return names.map((b) => new THREE.QuaternionKeyframeTrack(b + '.quaternion', times, rot[b]));
}
