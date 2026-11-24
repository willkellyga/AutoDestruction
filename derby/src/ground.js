// The floor every map stands on: one flat plane under the whole map with the map's painted ground on it (maps/*.js
// ground()). A map can ask for more (MAP.groundDetail), all of it in the floor's own shader, so it costs no more draws:
//   - dirt ('dirt', or soft: 'dirt'): a small tile of grain, pebbles and clods made here as the page loads (no image
//     files), laid over the paint twice, at two sizes and turned, so it never repeats in an obvious way, and faded out
//     with distance, where it would only shimmer and show its tiling
//   - hard ground (hard: true): asphalt and concrete get a finer tile of their own, sand and chips of stone with a
//     slight sheen; with deFleck the painted fleck a voxel big (New York's streets have it) is evened out close up
//     where the paint marks it, while anything with real contrast, a line or a kerb, stays as painted
//   - ruts: every wheel presses its track into a texture over the map's dirt (MAP.rutBox), and the floor reads it to
//     darken, dent and wet the ground; the tracks build up over a round and weather away slowly (dirt.js drives them).
//     On hard ground the same texture holds rubber laid by braking and sliding tyres, and mud carried off the dirt
//   - wet (wet: 0..1, the rain): hard ground darker and shining under the lights, the dirt a little darker
// The paint's alpha says what the ground is: 1 dirt (or, on a map without dirt, whatever is painted: grass, water),
// about 0.75 wet mud and puddles (glossy), 0.5 hard ground (0.45 hard ground with the fleck, for deFleck to even out),
// 0.25 water standing on the hard ground. A map without
// groundDetail gets the plain painted floor.
// The floor stays a lit three.js material (Phong, which with no shine is the Lambert it was), so lights, shadows and fog
// all work on it as before; the detail only changes its colour, its normal and its shine.
import * as THREE from 'three';
import { WX, WZ } from '../../src/world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TILE = 24, TILE2 = 61;   // voxels the detail tile covers, close up and again further off
const HTILE = 11, HTILE2 = 37; // and the hard ground's, which is finer
const RUT_DEPTH = 0.35;        // voxels a full rut goes down, for its lighting
const FADE_EVERY = 3;          // seconds between the ruts' weathering (each takes 1/255 off; a light track lasts a minute)

// MAP.groundDetail as one shape: 'dirt' is the arena's (dirt, the hard ground plain, the ruts weathering in a minute)
function detailOf(gd) {
  if (!gd) return null;
  if (gd === 'dirt') return { soft: true, hard: false, deFleck: false, wet: 0, fade: FADE_EVERY };
  return { soft: gd.soft === 'dirt', hard: !!gd.hard, deFleck: !!gd.deFleck, wet: gd.wet || 0, fade: gd.fade || FADE_EVERY };
}

// value noise a whole number of cells across (so it wraps), added into H (times amp) and A (times lit)
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(N, cells, r, H, A, amp, lit) {
  const L = new Float32Array(cells * cells), C = new Float32Array(cells * cells);
  for (let i = 0; i < L.length; i++) { L[i] = r() * 2 - 1; C[i] = r() * 2 - 1; }
  const k = cells / N, X0 = new Int32Array(N), X1 = new Int32Array(N), TX = new Float32Array(N);
  for (let x = 0; x < N; x++) { const fx = x * k, ix = fx | 0; X0[x] = ix % cells; X1[x] = (ix + 1) % cells; TX[x] = smooth(fx - ix); }
  for (let y = 0; y < N; y++) {
    const y0 = X0[y] * cells, y1 = X1[y] * cells, ty = TX[y];
    for (let x = 0; x < N; x++) {
      const x0 = X0[x], x1 = X1[x], tx = TX[x], i = y * N + x;
      const a = L[y0 + x0] + (L[y0 + x1] - L[y0 + x0]) * tx, b = L[y1 + x0] + (L[y1 + x1] - L[y1 + x0]) * tx;
      const c = C[y0 + x0] + (C[y0 + x1] - C[y0 + x0]) * tx, d = C[y1 + x0] + (C[y1 + x1] - C[y1 + x0]) * tx;
      H[i] += (a + (b - a) * ty) * amp; A[i] += (c + (d - c) * ty) * lit;
    }
  }
}
// a height field's slopes (K steepens them) into RG, the shade into B (0.5 as painted), and A as given (0..1)
function pack(N, H, B, A, K) {
  const M = N - 1, out = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const sx = (H[y * N + ((x + 1) & M)] - H[y * N + ((x - 1) & M)]) * 0.5 * K, sz = (H[((y + 1) & M) * N + x] - H[((y - 1) & M) * N + x]) * 0.5 * K;
    out[i * 4] = clamp(128 + sx * 64, 0, 255); out[i * 4 + 1] = clamp(128 + sz * 64, 0, 255);
    out[i * 4 + 2] = clamp((1 + B[i]) * 128, 0, 255); out[i * 4 + 3] = clamp(A[i], 0, 1) * 255;
  }
  return out;
}

// ---- the detail tile -----------------------------------------------------------------------------------------------
// N by N texels (N a power of two), tiling. RG the slope of the ground (x and z, 0.5 flat), B how light it is (0.5 as
// painted), A where there are stones (they read a little greyer than the dirt). Made on the CPU once, as the page loads:
// churned dirt is lumps of every size with cracks between them, grit, and stones pressed into it.
function detailTile(N, seed = 4321) {
  let s = seed; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const M = N - 1, H = new Float32Array(N * N), A = new Float32Array(N * N), S = new Float32Array(N * N);
  const u = N / 512;   // (the sizes and heights below are in a 512 tile's texels)
  // the ground's slow rise and fall: value noise, a whole number of cells across so it wraps
  for (const [cells, amp, lit] of [[4, 2.2, 0.05], [8, 1.3, 0.04], [16, 0.7, 0.03]]) vnoise(N, cells, r, H, A, amp * u, lit);
  // the dirt broken into lumps: cells round scattered points (each a lump, its own height and shade), the cracks between
  // them low and dark; twice, big lumps and small
  const lumps = (cells, amp, lit, edge, dark) => {
    const P = new Float32Array(cells * cells * 2), V = new Float32Array(cells * cells), C = new Float32Array(cells * cells);
    for (let i = 0; i < V.length; i++) { P[i * 2] = r(); P[i * 2 + 1] = r(); V[i] = 0.4 + r() * 0.9; C[i] = r() * 2 - 1; }
    const k = cells / N;
    for (let y = 0; y < N; y++) {
      const fy = y * k, cy = fy | 0;
      for (let x = 0; x < N; x++) {
        const fx = x * k, cx = fx | 0;
        let d1 = 9, d2 = 9, best = 0;
        for (let j = -1; j <= 1; j++) {
          const gy = cy + j, row = (gy < 0 ? gy + cells : gy >= cells ? gy - cells : gy) * cells;
          for (let i = -1; i <= 1; i++) {
            const gx = cx + i, id = row + (gx < 0 ? gx + cells : gx >= cells ? gx - cells : gx);
            const dx = gx + P[id * 2] - fx, dy = gy + P[id * 2 + 1] - fy, d = dx * dx + dy * dy;
            if (d < d1) { d2 = d1; d1 = d; best = id; } else if (d < d2) d2 = d;
          }
        }
        const e = Math.min(1, (Math.sqrt(d2) - Math.sqrt(d1)) / k / edge), lift = e * e * (3 - 2 * e), o = y * N + x;
        H[o] += amp * V[best] * lift; A[o] += lit * C[best] - dark * (1 - lift);
      }
    }
  };
  lumps(14, 3.2 * u, 0.07, 17 * u, 0.05);
  lumps(40, 0.9 * u, 0.05, 6 * u, 0.035);
  // grit: a fleck of height and shade at every texel
  for (let i = 0; i < N * N; i++) { H[i] += (r() - 0.5) * 0.8 * u; A[i] += (r() - 0.5) * 0.1; }
  // stones pressed into it, lighter and greyer than the dirt, flecked, their edges soft where the dirt holds them
  const stone = (cx, cy, rx, ry, ang, h, alb) => {
    const co = Math.cos(ang), si = Math.sin(ang), R = Math.ceil(Math.max(rx, ry) * 1.2), w1 = 2.5 + r() * 3, w2 = r() * 6;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const u = (dx * co + dy * si) / rx, v = (-dx * si + dy * co) / ry, th = Math.atan2(v, u);
      const d2 = (u * u + v * v) * (1 + 0.18 * Math.sin(th * 3 + w2) + 0.1 * Math.sin(th * 5 + w1));   // not quite round
      if (d2 >= 1) continue;
      const i = ((cy + dy) & M) * N + ((cx + dx) & M), q = 1 - d2;
      H[i] += h * q * (2 - q); A[i] = A[i] * 0.3 + (alb + (r() - 0.5) * 0.12) * 0.7; S[i] = Math.max(S[i], Math.min(1, q * 4));
    }
  };
  for (let i = 0; i < 22; i++) { const rr = (4.5 + r() * 4) * u; stone((r() * N) | 0, (r() * N) | 0, rr, rr * (0.55 + r() * 0.4), r() * 3.2, rr * 0.5, 0.15 + r() * 0.18); }
  for (let i = 0; i < 950 * u * u; i++) { const rr = Math.max(0.8, (1.1 + r() * r() * 3.4) * u); stone((r() * N) | 0, (r() * N) | 0, rr, rr * (0.55 + r() * 0.45), r() * 3.2, rr * 0.45, 0.12 + r() * 0.24); }
  return pack(N, H, A, S, 0.42);
}

// ---- the hard ground's tile ------------------------------------------------------------------------------------------
// The same layout (RG slope, B shade, A how pale the stone there is), finer: asphalt and concrete close up are sand in a
// binder that is a little richer or leaner in patches, chips of stone, most of them pale and standing a little proud,
// and pits where a chip has come out. Made once as the page loads, like the dirt's.
function hardTile(N, seed = 2718) {
  let s = seed; const r = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const M = N - 1, H = new Float32Array(N * N), B = new Float32Array(N * N), A = new Float32Array(N * N);
  const u = N / 512;
  for (const [cells, amp, lit] of [[3, 1.4, 0.07], [9, 0.7, 0.05], [27, 0.3, 0.04]]) vnoise(N, cells, r, H, B, amp * u, lit);
  for (let i = 0; i < N * N; i++) { H[i] += (r() - 0.5) * 0.5 * u; B[i] += (r() - 0.5) * 0.16; }
  // a chip: an oval a little out of round (angular, as crushed stone is), its middle highest and palest
  const chip = (cx, cy, rad, h, pale, dark) => {
    const R = Math.ceil(rad + 1), w = r() * 6.3, e = 0.55 + r() * 0.45, co = Math.cos(w), si = Math.sin(w), k3 = 0.3 * r(), ph = r() * 6.3;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const a = (dx * co + dy * si) / rad, b = (-dx * si + dy * co) / (rad * e), d2 = (a * a + b * b) * (1 + k3 * Math.cos(3 * Math.atan2(b, a) + ph));
      if (d2 >= 1) continue;
      const i = ((cy + dy) & M) * N + ((cx + dx) & M), q = 1 - d2;
      H[i] += h * Math.sqrt(q); if (pale) A[i] = Math.max(A[i], pale * Math.min(1, q * 2)); B[i] -= dark * q;
    }
  };
  for (let i = 0; i < 320 * u * u; i++) chip((r() * N) | 0, (r() * N) | 0, (2.6 + r() * 2.4) * u, 1.1 * u, 0.3 + r() * 0.3, 0);
  for (let i = 0; i < 9000 * u * u; i++) { const pale = r() < 0.78; chip((r() * N) | 0, (r() * N) | 0, Math.max(1.1, (0.9 + r() * r() * 2) * u), 0.6 * u, pale ? 0.25 + r() * 0.5 : 0, pale ? 0 : 0.22); }
  for (let i = 0; i < 1100 * u * u; i++) chip((r() * N) | 0, (r() * N) | 0, Math.max(1, (0.7 + r() * 1.2) * u), -0.7 * u, 0, 0.3);
  return pack(N, H, B, A, 0.5);
}

// ---- the floor's shader: the detail, laid into a Phong material ---------------------------------------------------
const PARS = /* glsl */`
uniform sampler2D detailMap;
uniform sampler2D hardMap;
uniform sampler2D rutMap;
uniform vec4 rutBox;      // x0, z0, 1/width, 1/height (voxels)
uniform vec3 rutTexel;    // the ruts' texel (u, v) and how many voxels one is across
uniform vec4 detailK;     // 1/tile, 1/tile2, where the close detail starts and finishes fading (voxels)
uniform vec4 hardK;       // the same for the hard ground's tile
uniform vec4 groundK;     // the mip level that evens out the paint's fleck, and how wet it is
uniform vec3 mudCol;      // mud carried onto the hard ground
varying vec2 vGround;
`;
const AFTER_MAP = /* glsl */`
  float gMask = diffuseColor.a;
  float gDist = length( vViewPosition );
  vec2 gSlope = vec2( 0.0 );
  float gGloss = 0.0;   // the hard ground's shine (wet, worn smooth, rubbered in)
  #ifdef SOFT
    float gDirt = smoothstep( 0.55, 0.7, gMask );                                        // dirt or mud, not deck plate
    float gWet = smoothstep( 0.6, 0.72, gMask ) * ( 1.0 - smoothstep( 0.8, 0.95, gMask ) );   // painted wet: puddles, damp
  #else
    float gDirt = 0.0, gWet = 0.0;
  #endif
  #ifdef HARD
    float gHard = 1.0 - smoothstep( 0.5, 0.6, gMask );
  #endif
  #ifdef RUTS
    vec2 ru = ( vGround - rutBox.xy ) * rutBox.zw;
    float gIn = step( 0.0, ru.x ) * step( 0.0, ru.y ) * step( ru.x, 1.0 ) * step( ru.y, 1.0 );
    vec4 rt = texture2D( rutMap, ru ) * gIn;
  #endif
  #ifdef SOFT
  if ( gDirt > 0.0 ) {
    float k1 = gDirt * ( 1.0 - smoothstep( detailK.z, detailK.w, gDist ) ) * ( 1.0 - gWet * 0.7 );
    float gFlat = 1.0 - gWet * 0.85;   // standing water lies flat over the lumps (bumpy, it glittered like foil)
    vec4 d1 = texture2D( detailMap, vGround * detailK.x );
    float lum = dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, vec3( lum * 1.12 ), d1.a * k1 * 0.55 );   // the stones, greyer than the dirt
    diffuseColor.rgb *= mix( 1.0, d1.b * 2.0, k1 );
    gSlope = ( d1.rg * 2.0 - 1.0 ) * 2.0 * k1 * gFlat;
    #ifdef DETAIL2
      float k2 = gDirt * ( 1.0 - smoothstep( detailK.z * 2.0, detailK.w * 2.2, gDist ) ) * ( 1.0 - gWet * 0.7 );
      vec4 d2 = texture2D( detailMap, mat2( 0.8, 0.6, -0.6, 0.8 ) * vGround * detailK.y + 0.37 );
      diffuseColor.rgb *= mix( 1.0, d2.b * 2.0, k2 * 0.8 );
      gSlope += ( ( d2.rg * 2.0 - 1.0 ) * mat2( 0.8, 0.6, -0.6, 0.8 ) ) * 1.3 * k2 * gFlat;   // (turned back the way the world goes)
    #endif
    #ifdef RUTS
      float deep = smoothstep( 0.0, 0.85, rt.r ) * gDirt;
      gSlope *= 1.0 - deep * 0.75;                                       // packed smooth where the wheels went
      diffuseColor.rgb *= 1.0 - 0.42 * deep + 0.1 * rt.g * gDirt;        // dark wet tracks, the dirt pushed up beside them a little lighter
      diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.92, 0.9, 0.95 ), deep );
      gWet = max( gWet, smoothstep( 0.05, 0.7, rt.b ) * gDirt * 0.7 );
      #ifdef RUT_BUMP
      if ( gIn > 0.0 ) {
        float h0 = rt.g * 0.6 - rt.r;
        vec4 rx = texture2D( rutMap, ru + vec2( rutTexel.x, 0.0 ) ), rz = texture2D( rutMap, ru + vec2( 0.0, rutTexel.y ) );
        float fade = gDirt * ( 1.0 - smoothstep( detailK.w, detailK.w * 2.5, gDist ) );
        gSlope += vec2( rx.g * 0.6 - rx.r - h0, rz.g * 0.6 - rz.r - h0 ) * ( ${RUT_DEPTH.toFixed(2)} / rutTexel.z ) * fade;
      }
      #endif
    #endif
    #ifdef WET
      diffuseColor.rgb *= 1.0 - 0.16 * groundK.y * gDirt;   // the rain darkens it, and it shines a very little
      gGloss = 0.08 * groundK.y * gDirt;
    #endif
  }
  #endif
  #ifdef HARD
  if ( gHard > 0.0 ) {
    float gLum = dot( diffuseColor.rgb, vec3( 0.3, 0.59, 0.11 ) );
    #ifdef DEFLECK
      // The paint's own fleck, a voxel a speck, evened out: where the paint is dark (asphalt) and differs only a little
      // from the paint round about (a blurred look at it), it takes that instead, so the grain below is all that shows.
      // A line, a kerb or an edge differs a lot, and stays.
      vec3 gSoft = textureLod( map, vMapUv, groundK.x ).rgb;
      float sl = dot( gSoft, vec3( 0.3, 0.59, 0.11 ) );
      float even = ( 1.0 - smoothstep( 0.16, 0.3, abs( gLum - sl ) / ( sl + 0.03 ) ) ) * ( 1.0 - smoothstep( 0.1, 0.2, sl ) );
      // (only on hard ground marked flecked, a little under a half: paint without the fleck keeps its own detail)
      even *= gHard * ( 1.0 - smoothstep( 0.465, 0.485, gMask ) ) * ( 1.0 - smoothstep( hardK.w, hardK.w * 1.6, gDist ) );
      diffuseColor.rgb = mix( diffuseColor.rgb, gSoft, even );
      gLum = mix( gLum, sl, even );
    #endif
    float kh = gHard * ( 1.0 - smoothstep( hardK.z, hardK.w, gDist ) );
    vec4 h1 = texture2D( hardMap, vGround * hardK.x );
    float tar = 1.0 - smoothstep( 0.05, 0.22, gLum );   // asphalt, not concrete: the stones show pale in its dark binder
    diffuseColor.rgb *= 1.0 + kh * ( ( h1.b * 2.0 - 1.0 ) * 0.55 + h1.a * mix( -0.1, 0.75, tar ) );
    gSlope += ( h1.rg * 2.0 - 1.0 ) * 0.8 * kh;
    #ifdef DETAIL2
      float k3 = gHard * ( 1.0 - smoothstep( hardK.z * 2.0, hardK.w * 2.2, gDist ) );
      vec4 h2 = texture2D( hardMap, mat2( 0.8, 0.6, -0.6, 0.8 ) * vGround * hardK.y + 0.61 );
      diffuseColor.rgb *= 1.0 + k3 * ( h2.b * 2.0 - 1.0 ) * 0.4;
    #endif
    gGloss = max( gGloss, gHard * 0.1 );   // worn smooth by the traffic: a slight sheen, which a low sun picks out
    #ifdef RUTS
      float rub = min( 1.0, rt.r * 1.6 ) * gHard;   // rubber from braking and sliding tyres
      diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.013, 0.013, 0.015 ), rub * 0.7 );
      gGloss = max( gGloss, rub * 0.3 );
      gSlope *= 1.0 - 0.5 * rub;
      diffuseColor.rgb = mix( diffuseColor.rgb, mudCol, smoothstep( 0.0, 0.45, rt.b ) * gHard * 0.75 );   // mud off the tyres
    #endif
    #ifdef WET
      // the rain on it: darker, and shining under the lights; water standing in the dips (painted, alpha a quarter) lies
      // flat, darker still, and gives back the sky as the puddles in the dirt do
      float gPool = 1.0 - smoothstep( 0.3, 0.42, gMask );
      diffuseColor.rgb *= 1.0 - gHard * ( 0.28 * groundK.y + 0.15 * gPool );
      gGloss = max( gGloss, gHard * groundK.y * 0.65 );
      gSlope *= 1.0 - gPool * 0.9;
      gWet = max( gWet, gPool );
    #endif
  }
  #endif
`;
const NORMAL = /* glsl */`
  normal = normalize( ( viewMatrix * vec4( normalize( vec3( - gSlope.x, 1.0, - gSlope.y ) ), 0.0 ) ).xyz );
`;
const SHINE = /* glsl */`
  material.specularStrength = max( gWet * gWet, gGloss );
  material.specularShininess = mix( 30.0, 120.0, max( gWet, gGloss ) );
`;
// standing water gives back some of the sky, more the flatter it is seen (the fog's colour stands in for the sky's: it
// is the horizon by day, and whatever the night makes it); damp mud only shines
const SHEEN = /* glsl */`
  #ifdef USE_FOG
    float gF = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), 4.0 );
    reflectedLight.indirectSpecular += fogColor * gF * smoothstep( 0.75, 1.0, gWet ) * 0.3;
  #endif
`;

// ---- the ruts' texture: wheel tracks pressed in --------------------------------------------------------------------
// RGBA, cleared to nothing: R how deep, G the dirt pushed up at a track's edges, B how wet; on hard ground R is rubber
// and B mud. Pieces of track are added into it (one draw for all of them, as they come), and every so often (the map's
// fade, FADE_EVERY seconds on dirt) a pass takes a step off everything.
const STAMP_VS = /* glsl */`
attribute vec2 uvk; attribute vec4 kk; uniform vec4 box; varying vec2 vUv; varying vec4 vK;
void main() { vUv = uvk; vK = kk; gl_Position = vec4( ( position.xz - box.xy ) * box.zw * 2.0 - 1.0, 0.0, 1.0 ); }`;
// across a track (u, -1.45..1.45 over the quad): the tyre's groove in the middle, its lugs along it (v, in voxels), the
// berm at each edge. A crater (kk.w 1) is round: a wide bowl, and the dirt thrown out of it heaped in a ring.
const STAMP_FS = /* glsl */`
uniform float tread; varying vec2 vUv; varying vec4 vK;
void main() {
  float groove, berm;
  if ( vK.w > 0.5 ) {
    float a = length( vUv ) / 1.45;
    groove = 1.0 - smoothstep( 0.3, 0.72, a );
    berm = smoothstep( 0.5, 0.72, a ) * ( 1.0 - smoothstep( 0.78, 1.0, a ) );
  } else {
    float a = abs( vUv.x );
    float lugs = mix( 1.0, 0.6 + 0.4 * step( 0.5, fract( vUv.y * 0.62 + a * 0.45 ) ), tread );
    groove = ( 1.0 - smoothstep( 0.5, 1.0, a ) ) * lugs;
    berm = smoothstep( 0.75, 1.05, a ) * ( 1.0 - smoothstep( 1.1, 1.45, a ) );
  }
  gl_FragColor = vec4( groove * vK.x, berm * vK.y, groove * vK.z, 0.0 );
}`;
const MAXQ = 512;   // pieces of track a frame (each is two triangles)

export function makeGround({ scene, renderer, MAP, mobile }) {
  const cv = MAP.ground();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, WX, 0, 0, WX, 0, WZ, 0, 0, WZ]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  // a map with hills, cuts and dips lays its own floor: a grid with its heights, and holes where the road goes under it
  // { position, uv, normal, index }, the picture mapped as the flat floor's is (u = x / WX, v = 1 - z / WZ)
  if (MAP.floorMesh) { const F = MAP.floorMesh(); for (const k of ['position', 'uv', 'normal']) g.setAttribute(k, new THREE.BufferAttribute(F[k], k === 'uv' ? 2 : 3)); g.setIndex(new THREE.BufferAttribute(F.index, 1)); }
  const opt = detailOf(MAP.groundDetail);
  if (!opt) {   // as it always was
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex })); mesh.receiveShadow = true; scene.add(mesh);
    const no = () => 0;
    return { mesh, dirt: false, hard: false, wet: 0, dirtAt: no, hardAt: no, wetAt: no, colourAt: null, quad() {}, crater() {}, setStep() {}, step() {} };
  }
  const soft = opt.soft, hard = opt.hard;

  // what the ground is and what colour, a texel every two voxels, read back once from the paint (for dirt.js: where
  // wheels throw dirt or lay rubber, where they splash, and what colour the dirt is)
  const SW = Math.ceil(WX / 2), SH = Math.ceil(WZ / 2);
  const small = document.createElement('canvas'); small.width = SW; small.height = SH;
  const sg = small.getContext('2d', { willReadFrequently: true }); sg.imageSmoothingQuality = 'high'; sg.drawImage(cv, 0, 0, SW, SH);
  const px = sg.getImageData(0, 0, SW, SH).data; small.width = small.height = 1;
  const lin = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const at = (x, z) => (clamp(Math.floor(z / 2), 0, SH - 1) * SW + clamp(Math.floor(x / 2), 0, SW - 1)) * 4;
  const ss = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
  const dirtAt = soft ? (x, z) => clamp((px[at(x, z) + 3] / 255 - 0.55) / 0.15, 0, 1) : () => 0;
  const hardAt = hard ? (x, z) => clamp((0.6 - px[at(x, z) + 3] / 255) / 0.1, 0, 1) : () => 0;
  // how wet: the dirt's puddles and damp, or water standing on the hard ground (as the shader reads the alpha)
  const wetAt = (x, z) => {
    const a = px[at(x, z) + 3] / 255;
    return Math.max(soft ? ss(0.6, 0.72, a) * (1 - ss(0.8, 0.95, a)) : 0, hard && opt.wet ? clamp((0.42 - a) / 0.12, 0, 1) : 0);
  };
  // The colour of the dirt thrown up: the dirt's own colour round about (the mean of the dirt in each 32 voxels square),
  // only a little lighter or darker as the paint just there is. Read straight off the paint it came out black off an
  // old tyre mark and blue off the edge of a boost plate.
  const CELL = 16, CW = Math.ceil(SW / CELL), CH = Math.ceil(SH / CELL), mean = new Float32Array(CW * CH * 4), all = [0, 0, 0, 0];
  if (soft) for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const i = (y * SW + x) * 4; if (px[i + 3] < 230) continue;   // (dirt only: not the wet, not the hard)
    const o = ((y / CELL | 0) * CW + (x / CELL | 0)) * 4;
    for (let c = 0; c < 3; c++) { mean[o + c] += lin[px[i + c]]; all[c] += lin[px[i + c]]; }
    mean[o + 3]++; all[3]++;
  }
  for (let o = 0; o < mean.length; o += 4) for (let c = 0; c < 3; c++) mean[o + c] = mean[o + 3] > 8 ? mean[o + c] / mean[o + 3] : all[c] / Math.max(1, all[3]);
  const lum = (r, g, b) => r * 0.3 + g * 0.59 + b * 0.11;
  const colourAt = soft ? (x, z, out) => {
    const i = at(x, z), o = (clamp(Math.floor(z / 2 / CELL), 0, CH - 1) * CW + clamp(Math.floor(x / 2 / CELL), 0, CW - 1)) * 4;
    const m = lum(mean[o], mean[o + 1], mean[o + 2]), k = clamp(lum(lin[px[i]], lin[px[i + 1]], lin[px[i + 2]]) / Math.max(1e-4, m), 0.8, 1.2);
    out[0] = mean[o] * k; out[1] = mean[o + 1] * k; out[2] = mean[o + 2] * k; return out;
  } : null;
  // mud carried onto the hard ground: the dirt's colour, wet (with no dirt, a plain brown)
  const mud = all[3] ? [0, 1, 2].map((c) => all[c] / all[3] * 0.6) : [0.06, 0.045, 0.03];

  // the ruts' box (the whole map unless the map says), and the texture over it
  const box = MAP.rutBox || [0, 0, WX, WZ], bw = box[2] - box[0], bh = box[3] - box[1];
  const rutW = (q) => (q <= 2 ? 2048 : q <= 4 ? 1024 : 512);
  let rt = null, rutQ = -1;
  const TN = mobile ? 256 : 512;   // (phones: a quarter of the work as the page loads, on a smaller screen)
  const tile = (data) => {
    const t = new THREE.DataTexture(data, TN, TN, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); t.needsUpdate = true;
    return t;
  };

  const U = {
    detailMap: { value: soft ? tile(detailTile(TN)) : null }, hardMap: { value: hard ? tile(hardTile(TN)) : null }, rutMap: { value: null },
    rutBox: { value: new THREE.Vector4(box[0], box[1], 1 / bw, 1 / bh) }, rutTexel: { value: new THREE.Vector3() },
    detailK: { value: new THREE.Vector4(1 / TILE, 1 / TILE2, 45, 170) }, hardK: { value: new THREE.Vector4(1 / HTILE, 1 / HTILE2, 40, 150) },
    // the fleck is a voxel across: a mip level where a texel is nearly three voxels evens it out
    groundK: { value: new THREE.Vector4(Math.log2(cv.width / WX) + 1.5, opt.wet, 0, 0) },
    mudCol: { value: new THREE.Vector3(...mud) },
  };
  // (water and wet mud reflect about 4% head on, and more the flatter they are seen: Phong's Fresnel does the rest)
  const mat = new THREE.MeshPhongMaterial({ map: tex, specular: new THREE.Color().setRGB(0.04, 0.04, 0.04), shininess: 30 });
  mat.defines = {};
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGround;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = position.xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + PARS)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + AFTER_MAP)
      .replace('#include <normal_fragment_maps>', NORMAL)
      .replace('#include <lights_phong_fragment>', '#include <lights_phong_fragment>\n' + SHINE)
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + SHEEN);
  };
  const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; scene.add(mesh);

  // ---- pressing the ruts in ----
  const pos = new Float32Array(MAXQ * 4 * 3), uvk = new Float32Array(MAXQ * 4 * 2), kk = new Float32Array(MAXQ * 4 * 4);
  const sg2 = new THREE.BufferGeometry();
  sg2.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  sg2.setAttribute('uvk', new THREE.BufferAttribute(uvk, 2).setUsage(THREE.DynamicDrawUsage));
  sg2.setAttribute('kk', new THREE.BufferAttribute(kk, 4).setUsage(THREE.DynamicDrawUsage));
  const idx = new Uint16Array(MAXQ * 6); for (let i = 0; i < MAXQ; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  sg2.setIndex(new THREE.BufferAttribute(idx, 1)); sg2.setDrawRange(0, 0);
  const add = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, depthTest: false, depthWrite: false };
  const stampMat = new THREE.ShaderMaterial({ uniforms: { box: U.rutBox, tread: { value: 1 } }, vertexShader: STAMP_VS, fragmentShader: STAMP_FS, side: THREE.DoubleSide, ...add });   // (either way round: a track's pieces face every way)
  const stamps = new THREE.Mesh(sg2, stampMat); stamps.frustumCulled = false; stamps.renderOrder = 1;
  // the weathering: a whole-texture pass that takes a little off every channel
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const fadeMat = new THREE.ShaderMaterial({
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: 'void main(){ gl_FragColor = vec4(1.0 / 255.0); }',
    blending: THREE.CustomBlending, blendEquation: THREE.ReverseSubtractEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, depthTest: false, depthWrite: false,
  });
  const fader = new THREE.Mesh(tri, fadeMat); fader.frustumCulled = false; fader.renderOrder = 0; fader.visible = false;
  // and a copy pass, for carrying the ruts over into a texture of another size when the quality step changes
  const copyMat = new THREE.ShaderMaterial({ uniforms: { src: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: 'uniform sampler2D src; varying vec2 vUv; void main(){ gl_FragColor = texture2D(src, vUv); }', depthTest: false, depthWrite: false });
  const copier = new THREE.Mesh(tri, copyMat); copier.frustumCulled = false; copier.visible = false;
  const rScene = new THREE.Scene(); rScene.add(fader, copier, stamps);
  const rCam = new THREE.Camera();
  const _cc = new THREE.Color();
  function into(target, clear) {
    const ac = renderer.autoClear, was = renderer.getRenderTarget();
    renderer.autoClear = false; renderer.setRenderTarget(target);
    if (clear) { renderer.getClearColor(_cc); const ca = renderer.getClearAlpha(); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false); renderer.setClearColor(_cc, ca); }
    renderer.render(rScene, rCam);
    renderer.setRenderTarget(was); renderer.autoClear = ac;
  }
  function makeRuts(q) {
    const w = rutW(q); if (rt && rt.width === w) return;
    const h = Math.round(w * bh / bw);
    const next = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, stencilBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const vis = [fader.visible, stamps.visible]; fader.visible = stamps.visible = false;
    if (rt) { copier.visible = true; copyMat.uniforms.src.value = rt.texture; into(next, true); copier.visible = false; rt.dispose(); }
    else into(next, true);
    fader.visible = vis[0]; stamps.visible = vis[1];
    rt = next; U.rutMap.value = rt.texture;
    U.rutTexel.value.set(1 / w, 1 / h, bw / w);
    stampMat.uniforms.tread.value = w >= 2048 ? 1 : 0;   // the lugs need the finest texture to show without crawling
  }

  let n = 0, fadeT = 0;
  function put(o, x, z, u, v, a, b, c, d) { pos[o * 3] = x; pos[o * 3 + 1] = 0; pos[o * 3 + 2] = z; uvk[o * 2] = u; uvk[o * 2 + 1] = v; kk[o * 4] = a; kk[o * 4 + 1] = b; kk[o * 4 + 2] = c; kk[o * 4 + 3] = d; }
  return {
    mesh, dirt: soft, hard, wet: opt.wet, dirtAt, hardAt, wetAt, colourAt,
    // a piece of track: from edge A (its two ends, left and right) to edge B, v0 and v1 how far along the track each is
    // (voxels, for the lugs), with the depth, berm and wetness it adds (on hard ground: rubber, nothing, and mud). The
    // edges already take in the berm (u +-1.45).
    quad(a0x, a0z, a1x, a1z, b0x, b0z, b1x, b1z, v0, v1, d, berm, wet) {
      if (n >= MAXQ) return;
      const o = n++ * 4;
      put(o, a0x, a0z, -1.45, v0, d, berm, wet, 0); put(o + 1, a1x, a1z, 1.45, v0, d, berm, wet, 0);
      put(o + 2, b1x, b1z, 1.45, v1, d, berm, wet, 0); put(o + 3, b0x, b0z, -1.45, v1, d, berm, wet, 0);
    },
    // a round dent (a blast in the dirt): r its radius to the berm's outside
    crater(x, z, r, d) {
      if (n >= MAXQ) return;
      const o = n++ * 4;
      put(o, x - r, z - r, -1.45, -1.45, d, d * 0.8, d * 0.4, 1); put(o + 1, x + r, z - r, 1.45, -1.45, d, d * 0.8, d * 0.4, 1);
      put(o + 2, x + r, z + r, 1.45, 1.45, d, d * 0.8, d * 0.4, 1); put(o + 3, x - r, z + r, -1.45, 1.45, d, d * 0.8, d * 0.4, 1);
    },
    // the quality step: the second layer of detail and the ruts' relief from step 3 up, the paint's fleck evened out
    // from step 4 up, and the ruts' texture's size
    setStep(q) {
      if (q === rutQ) return;
      rutQ = q; makeRuts(q);
      const want = { ...(soft ? { SOFT: '' } : {}), ...(hard ? { HARD: '' } : {}), ...(opt.wet ? { WET: '' } : {}), RUTS: '',
        ...(q <= 3 ? { DETAIL2: '', RUT_BUMP: '' } : {}), ...(opt.deFleck && q <= 4 ? { DEFLECK: '' } : {}) };
      if (Object.keys(want).join() !== Object.keys(mat.defines).join()) { mat.defines = want; mat.needsUpdate = true; }
    },
    // once a frame: the track laid this frame goes into the texture, and now and then the weathering
    step(dt) {
      if (!rt) return;
      fadeT += dt; fader.visible = fadeT >= opt.fade; if (fader.visible) fadeT = 0;
      if (!n && !fader.visible) return;
      sg2.setDrawRange(0, n * 6); stamps.visible = n > 0;
      for (const [at, w] of [[sg2.attributes.position, 3], [sg2.attributes.uvk, 2], [sg2.attributes.kk, 4]]) { at.clearUpdateRanges(); at.addUpdateRange(0, n * 4 * w); at.needsUpdate = true; }
      into(rt, false);
      n = 0;
    },
  };
}
