// Cubes drawn by the three faces that can be seen.
// A cube never shows more than three of its faces at once, yet the pools of loose cubes (debris, ground blocks, flames,
// falling sections of a building) drew all six of every cube: late in a round that is up to 400,000 triangles. Here the
// geometry holds three faces (+x, +y, +z) and the vertex shader turns each one over to the opposite side of its cube when
// that is the side the camera is on. The picture is the same and the triangles are halved.
//
// How a face is turned: a half turn about the next axis round (x about y, y about z, z about x) carries it to the opposite
// side with its winding kept, so it still faces out. Which side: the sign of the face's normal against the direction to
// the camera, taken at the cube's centre, which is exact for a cube (if the camera is on neither side of a pair, neither
// face of the pair can be seen). It holds for instance matrices made of a turn and a scale, which is all the pools use.
//
// Shadows: the shadow pass draws with its own depth material, so each pool mesh gets one with the same patch
// (cubeMesh below). It picks the three faces turned away from the light, which are the ones the pass drew before.
import * as THREE from 'three';

const on = { value: 1 };   // 0: faces stay where the geometry has them (with the full six-face geometry: as it was, for tests)
const SIDE = (s) => `
  mat4 c3m = modelViewMatrix * instanceMatrix;
  vec3 c3v = projectionMatrix[3][3] > 0.5 ? vec3(0.0, 0.0, 1.0) : -c3m[3].xyz;   // towards the camera (a light's is orthographic)
  float c3f = c3on > 0.5 && dot(mat3(c3m) * normal, c3v) * ${s} < 0.0 ? -1.0 : 1.0;
`;
const TURN = `
  if (c3f < 0.0) transformed = 2.0 * normal.zxy * dot(normal.zxy, transformed) - transformed;
`;
const HEAD = `uniform float c3on;
#ifdef USE_COLOR
attribute vec3 c3tint;
#endif
`;

// The material of a pool of cubes, patched to turn the faces. Returns it.
export function cubeMat(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.c3on = on;
    sh.vertexShader = HEAD + sh.vertexShader
      .replace('#include <color_vertex>', SIDE('1.0') + '#include <color_vertex>\n#ifdef USE_COLOR\n  if (c3f < 0.0) vColor.rgb *= c3tint;\n#endif')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  objectNormal *= c3f;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>' + TURN);
  };
  mat.customProgramCacheKey = () => 'cube3';
  mat.shadowSide = THREE.DoubleSide;   // the depth material below chooses the faces itself
  mat.userData.cube3 = true;
  return mat;
}
let depth = null;
const depthMat = () => {
  if (depth) return depth;
  depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (sh) => {
    sh.uniforms.c3on = on;
    sh.vertexShader = 'uniform float c3on;\n' + sh.vertexShader.replace('#include <begin_vertex>', SIDE('-1.0') + '#include <begin_vertex>' + TURN);
  };
  depth.customProgramCacheKey = () => 'cube3d';
  return depth;
};

// A unit cube of three faces. `shade`: six numbers, one per face of a box in three's order (+x -x +y -y +z -z), for
// pools whose cubes are shaded by hand; a turned face takes the shade of the side it lands on.
export function cubeGeo(shade = null) {
  const box = new THREE.BoxGeometry(1, 1, 1), P = box.attributes.position.array, N = box.attributes.normal.array;
  const pos = new Float32Array(36), nor = new Float32Array(36), idx = [];
  for (let f = 0; f < 3; f++) {
    const from = f * 2 * 4;   // the +x, +y, +z faces are the 1st, 3rd and 5th of the box, four corners each
    for (let v = 0; v < 4; v++) for (let d = 0; d < 3; d++) { pos[(f * 4 + v) * 3 + d] = P[(from + v) * 3 + d]; nor[(f * 4 + v) * 3 + d] = N[(from + v) * 3 + d]; }
    for (let e = 0; e < 6; e++) idx.push(box.index.array[f * 2 * 6 + e] - from + f * 4);   // the box's own two triangles for that face
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setIndex(idx);
  if (shade) {
    const c = new Float32Array(36), t = new Float32Array(36), full = new Float32Array(72);
    for (let f = 0; f < 3; f++) for (let v = 0; v < 4; v++) { c.fill(shade[f * 2], (f * 4 + v) * 3, (f * 4 + v) * 3 + 3); t.fill(shade[f * 2 + 1] / shade[f * 2], (f * 4 + v) * 3, (f * 4 + v) * 3 + 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.setAttribute('c3tint', new THREE.BufferAttribute(t, 3));
    for (let i = 0; i < 24; i++) full.fill(shade[i >> 2], i * 3, i * 3 + 3);
    box.setAttribute('color', new THREE.BufferAttribute(full, 3)); box.setAttribute('c3tint', new THREE.BufferAttribute(new Float32Array(72).fill(1), 3));
  }
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5)); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.sqrt(0.75));
  geo.userData.full = box; box.userData.half = geo;
  return geo;
}

// A pool mesh of such cubes (geo from cubeGeo, mat through cubeMat), with the shadow pass's material set.
export function cubeMesh(geo, mat, n) {
  const m = new THREE.InstancedMesh(geo, mat, n); m.customDepthMaterial = depthMat(); return m;
}

// For tests: draw every pool in a scene the old way (all six faces, nothing turned), or the new way again.
export function cube3Set(scene, yes) {
  on.value = yes ? 1 : 0;
  scene.traverse((o) => {
    if (!o.isInstancedMesh || !o.material.userData.cube3) return;
    const g = o.geometry, to = yes ? g.userData.half : g.userData.full; if (to) o.geometry = to;
    o.material.shadowSide = yes ? THREE.DoubleSide : null; o.customDepthMaterial = yes ? depthMat() : undefined;
  });
}
