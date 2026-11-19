// A stand-in for three.js in the meshing worker's bundle (build.py): the worker meshes into plain arrays and never makes a
// geometry or a material, and it takes the material colours from the page (world.js storeLoad), so nothing here does
// anything. It keeps about 220 KB of three.js out of the worker.
class Nothing { setHex() { return this; } }
export const Color = Nothing, BufferAttribute = Nothing, BufferGeometry = Nothing, Sphere = Nothing, Vector3 = Nothing, MeshDepthMaterial = Nothing, MeshLambertMaterial = Nothing;
export const SRGBColorSpace = 'srgb', RGBADepthPacking = 3201;
