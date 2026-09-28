import * as THREE from 'three';

// World bend: the river swings left/right and drops over the horizon. It is applied in
// world space relative to the camera's z, so the color pass and the depth prepass bend
// identically. Gameplay coordinates stay straight; near the boat the bend is zero.
export const bendU = { value: new THREE.Vector4(0, 0.00045, 13, 9.5) }; // side k, drop k, start, origin z
export const rimU = { value: new THREE.Vector4(1, 1, 1, 0.3) };           // rgb, strength

export const BEND_GLSL = /* glsl */`
uniform vec4 uBend;
vec3 bendWorld(vec3 p) {
  float d = max(0.0, uBend.w - p.z - uBend.z);
  p.x += uBend.x * d * d;
  p.y -= uBend.y * d * d;
  return p;
}`;

const PROJECT = /* glsl */`
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelMatrix * mvPosition;
mvPosition.xyz = bendWorld( mvPosition.xyz );
mvPosition = viewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`;

export function bendMaterial(m, { rim = true } = {}) {
  if (m.userData.bent) return m;
  m.userData.bent = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBend = bendU;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + BEND_GLSL)
      .replace('#include <project_vertex>', PROJECT);
    if (rim && sh.fragmentShader.includes('#include <emissivemap_fragment>')) {
      sh.uniforms.uRim = rimU;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec4 uRim;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { float rf = 1.0 - clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
    totalEmissiveRadiance += uRim.rgb * ( rf * rf * rf * uRim.a ); }`);
    }
  };
  m.customProgramCacheKey = () => 'bend' + (rim ? 'r' : '');
  return m;
}

// Printed-backdrop look: glTF standard materials become 3-step toon inks that keep the
// baked AO vertex colors, then get the bend + rim patch.
let rampTex = null;
function ramp() {
  if (rampTex) return rampTex;
  const d = new Uint8Array([96, 178, 255]);
  rampTex = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
  rampTex.minFilter = rampTex.magFilter = THREE.NearestFilter;
  rampTex.generateMipmaps = false;
  rampTex.needsUpdate = true;
  return rampTex;
}
const toonCache = new Map();
export function inkMaterial(src) {
  if (toonCache.has(src)) return toonCache.get(src);
  const m = new THREE.MeshToonMaterial({
    name: src.name,
    color: src.color.clone(),
    vertexColors: src.vertexColors,
    gradientMap: ramp(),
    transparent: src.transparent,
    opacity: src.opacity,
    side: src.side,
  });
  bendMaterial(m);
  toonCache.set(src, m);
  return m;
}

// convert every mesh under a template root (materials shared between clones)
export function inkify(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(inkMaterial) : inkMaterial(o.material);
  });
}
