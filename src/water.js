import * as THREE from 'three';
import { BEND_GLSL, bendMaterial, bendU } from './bend.js';

const NOISE = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.07 + 11.3; a *= .5; } return s; }
`;

// ---------------------------------------------------------------- simulation buffer
// One RGBA half-float texture covering the river near the boat, advected with the world:
//   r = foam (persistent, decays)   g = ripple height   b = previous height   a = shadow (this frame)
// Anything can stamp capsules into it: wakes, splashes, oar strokes, penguin slides, shadows.
const MAXS = 48;
const simFrag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D uPrev;
uniform vec2 uTexel, uShift;
uniform vec4 uDomain;
uniform vec4 uA[${MAXS}];
uniform vec4 uB[${MAXS}];
uniform int uN;
uniform float uC2, uDamp, uKeep;
vec4 S(vec2 uv) { return (uv.y < 0.0 || uv.x < 0.0 || uv.x > 1.0) ? vec4(0.0) : texture2D(uPrev, uv); }
void main() {
  vec2 src = vUv - uShift;
  vec4 c = S(src);
  float h = c.g, hp = c.b;
  float lap = S(src + vec2(uTexel.x, 0.)).g + S(src - vec2(uTexel.x, 0.)).g
            + S(src + vec2(0., uTexel.y)).g + S(src - vec2(0., uTexel.y)).g - 4.0 * h;
  float hn = (2.0 * h - hp + uC2 * lap) * uDamp;
  float foam = max(c.r * uKeep - 0.0015, 0.0);
  float sh = 0.0;
  vec2 wp = uDomain.xy + vUv * uDomain.zw;
  for (int i = 0; i < ${MAXS}; i++) {
    if (i >= uN) break;
    vec4 a = uA[i], b = uB[i];
    vec2 pa = wp - a.xy, ba = a.zw - a.xy;
    float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    float d = length(pa - ba * t);
    float k = 1.0 - smoothstep(b.x * 0.3, b.x, d);
    foam = max(foam, b.y * k);
    hn += b.z * k;
    sh = max(sh, b.w * k);
  }
  gl_FragColor = vec4(foam, clamp(hn, -1.5, 1.5), h, sh);
}`;
const quadVert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// the ripple / foam domain runs from 54 m ahead of the boat to 10 m behind it (x from -8 to 8)
export function createWaterSim(renderer, { res = [160, 640], domain = [-8, -54, 16, 64] } = {}) {
  const [W, H] = res;
  const opts = {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false, stencilBuffer: false,
  };
  let read = new THREE.WebGLRenderTarget(W, H, opts);
  let write = new THREE.WebGLRenderTarget(W, H, opts);
  const uA = Array.from({ length: MAXS }, () => new THREE.Vector4());
  const uB = Array.from({ length: MAXS }, () => new THREE.Vector4());
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPrev: { value: null }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) },
      uShift: { value: new THREE.Vector2() }, uDomain: { value: new THREE.Vector4(...domain) },
      uA: { value: uA }, uB: { value: uB }, uN: { value: 0 },
      uC2: { value: 0.3 }, uDamp: { value: 0.985 }, uKeep: { value: 0.97 },
    },
    vertexShader: quadVert, fragmentShader: simFrag, depthTest: false, depthWrite: false,
  });
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  let n = 0;
  const [X0, Z0, LX, LZ] = domain;
  // The wave update is a leapfrog (2h - previous h) that assumes an even clock. Coefficients that
  // jump with each frame's duration pump the finest ripples (x4 every two frames when frames swing
  // between 8 and 33 ms) until they fill the river, which is what uneven frame pacing did in some
  // browsers. So the wave coefficients follow a smoothed frame step; only the scroll is per-frame.
  let fs = 1;

  const sim = {
    domain: new THREE.Vector4(...domain),
    texel: new THREE.Vector2(1 / W, 1 / H),
    get texture() { return read.texture; },
    // capsule stamp from (x0,z0) to (x1,z1), radius r; foam 0..1, ripple impulse, shadow 0..1
    stamp(x0, z0, x1, z1, r, foam = 0, rip = 0, shadow = 0) {
      if (n >= MAXS) return;
      if (Math.max(x0, x1) < X0 - r || Math.min(x0, x1) > X0 + LX + r) return;
      if (Math.max(z0, z1) < Z0 - r || Math.min(z0, z1) > Z0 + LZ + r) return;
      uA[n].set(x0, z0, x1, z1);
      uB[n].set(r, foam, rip, shadow);
      n++;
    },
    dot(x, z, r, foam = 0, rip = 0, shadow = 0) { sim.stamp(x, z, x, z, r, foam, rip, shadow); },
    step(dt, dz, driftX) {
      const f = dt * 60;
      fs += (f - fs) * Math.min(1, dt * 2);   // ~0.5 s time constant
      const u = mat.uniforms;
      u.uShift.value.set(driftX / LX, dz / LZ);
      u.uC2.value = Math.min(0.45, 0.3 * fs * fs);
      u.uDamp.value = Math.pow(0.984, fs);
      u.uKeep.value = Math.pow(0.982, f);     // foam fading has no such trap: keep it exact per frame
      u.uN.value = n;
      u.uPrev.value = read.texture;
      renderer.setRenderTarget(write);
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      const t = read; read = write; write = t;
      n = 0;
    },
    clear() {
      for (const rt of [read, write]) { renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false); }
      renderer.setRenderTarget(null);
      n = 0;
    },
  };
  return sim;
}

// ---------------------------------------------------------------- depth prepass
// Half-res depth of everything that touches the water (layer 1), for shape-true foam lines.
export const WATERLINE_LAYER = 1;
export function createDepthPrepass(renderer, scale = 0.5) {
  const depthTexture = new THREE.DepthTexture(1, 1);
  depthTexture.type = THREE.UnsignedIntType;
  const rt = new THREE.WebGLRenderTarget(1, 1, { depthTexture, depthBuffer: true, stencilBuffer: false });
  const mat = bendMaterial(new THREE.MeshDepthMaterial(), { rim: false });
  mat.colorWrite = false;
  return {
    rt, texture: depthTexture,
    setSize(w, h) { rt.setSize(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))); },
    render(scene, camera) {
      const mask = camera.layers.mask, bg = scene.background, ov = scene.overrideMaterial;
      camera.layers.set(WATERLINE_LAYER);
      scene.background = null;
      scene.overrideMaterial = mat;
      renderer.setRenderTarget(rt);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      camera.layers.mask = mask;
      scene.background = bg;
      scene.overrideMaterial = ov;
    },
  };
}

// ---------------------------------------------------------------- the surface
const waterVert = /* glsl */`
uniform float uTime;
varying vec3 vW;
varying vec3 vB;
varying float vFog;
${BEND_GLSL}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  wp.y += sin(wp.x * 0.45 + uTime * 0.9) * 0.05 + sin(wp.z * 0.30 - uTime * 1.15) * 0.06;
  vW = wp.xyz;
  vB = bendWorld(wp.xyz);
  vec4 mv = viewMatrix * vec4(vB, 1.0);
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const waterFrag = /* glsl */`
precision highp float;
varying vec3 vW;
varying vec3 vB;
varying float vFog;
uniform float uTime, uFlow, uDrift, uSlant, uBankX, uRapids, uNight, uAurora;
uniform vec3 uDeep, uShal, uRefl, uInk, uFoam, uSunC, uFogC, uGlow, uAur;
uniform vec3 uSunDir;
uniform vec2 uFogR;
uniform sampler2D uSim, uDepth;
uniform vec4 uSimD;
uniform vec2 uSimT, uRes, uCam;
uniform vec4 uBoat;   // x, z, lantern glow, unused
${NOISE}
float viewZ(float d) { return (uCam.x * uCam.y) / ((uCam.y - uCam.x) * d - uCam.y); }
// distance to the nearest jittered cell center (in cell units): the bubbles foam dissolves into
float cells(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 r = g + vec2(hash12(i + g), hash12(i + g + 17.3)) - f;
    d = min(d, dot(r, r));
  }
  return sqrt(d);
}
float aa(float x, float edge) { float w = max(fwidth(x), 1e-4); return smoothstep(edge - w, edge + w, x); }
// for values built from fract() cells: the width must come from a continuous coordinate
float aaw(float x, float edge, float w) { w = max(w, 1e-4); return smoothstep(edge - w, edge + w, x); }

void main() {
  vec2 p = vW.xz;
  vec2 fp = vec2(p.x - uDrift, p.y - uFlow);
  // one screen footprint for every hand-antialiased mark; work below is skipped where it cannot show,
  // and the skipped regions only ever end where their result is already zero
  vec2 dfp = fwidth(fp);
  float far = smoothstep(18.0, 70.0, vFog);

  // base inks: deep channel, shallow margins, broad printed patches
  float edge = smoothstep(uBankX - 3.4, uBankX - 0.3, abs(p.x));
  float patchN = fbm(fp * vec2(0.07, 0.03));
  float shade = clamp(edge * 0.9 + (patchN - 0.5) * 0.7, 0.0, 1.0);
  shade = floor(shade * 3.0 + 0.5) / 3.0 * 0.85 + shade * 0.15;
  vec3 col = mix(uDeep, uShal, shade);

  // simulation: ripples, foam, shadows
  vec2 su = (p - uSimD.xy) / uSimD.zw;
  float inside = step(0.0, su.x) * step(su.x, 1.0) * step(0.0, su.y) * step(su.y, 1.0);
  vec4 sim = texture2D(uSim, su) * inside;
  // fade out at both ends of the domain: far ahead into the haze, and behind the boat before the
  // camera, so wakes and ripples dissolve instead of stopping at a straight line
  float fade = smoothstep(0.0, 0.15, su.y) * (1.0 - smoothstep(0.93, 1.0, su.y)) * inside;
  float hx = texture2D(uSim, su + vec2(uSimT.x, 0.)).g - texture2D(uSim, su - vec2(uSimT.x, 0.)).g;
  float hz = texture2D(uSim, su + vec2(0., uSimT.y)).g - texture2D(uSim, su - vec2(0., uSimT.y)).g;
  float swx = 0.0225 * cos(p.x * 0.45 + uTime * 0.9);
  float swz = 0.018 * cos(p.y * 0.30 - uTime * 1.15);
  vec3 N = normalize(vec3(-(hx * 2.2 * fade + swx), 1.0, -(hz * 2.2 * fade + swz)));

  // ripples: faint crest/trough inks plus crisp lines along the steep wavefronts
  float h = sim.g * fade;
  float slope = length(vec2(hx, hz)) * fade;
  col = mix(col, uRefl, aa(h, 0.07) * 0.1);
  col = mix(col, uInk, aa(-h, 0.07) * 0.08);
  col = mix(col, uRefl, aa(slope, 0.05) * 0.6 * (1.0 - far));

  // flow marks: sparse tapered strokes that ride the water, slanted by side currents
  vec2 cs = vec2(2.1, 6.0);
  vec2 q = fp / cs;
  vec2 ci = floor(q), cf = fract(q);
  float r1 = hash12(ci), r2 = hash12(ci + 5.3), r3 = hash12(ci + 9.1);
  float on = step(0.6 - uRapids * 0.45, r1);
  float len = 0.1 + 0.2 * r3 + uRapids * 0.12;
  float ty = (cf.y - 0.5) / len;
  float taper = max(1.0 - ty * ty, 0.0);
  float dx = (cf.x - (0.2 + 0.6 * r2)) * cs.x - (cf.y - 0.5) * cs.y * uSlant + sin(fp.y * 1.4 + r1 * 6.3) * 0.05;
  float wd = (0.03 + uRapids * 0.035) * taper;
  float mark = on * step(abs(ty), 1.0) * (1.0 - aaw(abs(dx), wd, dfp.x * 0.8));
  col = mix(col, uRefl, mark * (0.34 + uRapids * 0.3 + 0.2 * r2) * (1.0 - far));

  // rapids whitewater: long streaks along the flow, drawn with the foam below (only while rapids run)
  float wn = 0.0;
  if (uRapids > 0.001) wn = fbm(fp * vec2(0.55, 0.16) + vec2(0.0, uTime * 0.25));

  // shadows from the boat and airborne penguins
  col *= 1.0 - sim.a * 0.34;

  // sky reflection at grazing angles
  vec3 V = normalize(cameraPosition - vB);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  vec3 refl = mix(uRefl, uAur, uAurora * 0.55 * smoothstep(40.0, 110.0, vFog));
  col = mix(col, refl, clamp(fres * 1.15, 0.0, 0.8));

  // glints on the sun (or moon) path: small printed diamonds that blink in and out
  vec3 R = reflect(-V, N);
  float spc = pow(max(dot(R, uSunDir), 0.0), 160.0);
  float onPath = aa(spc, 0.18);
  if (onPath > 0.0) {
    vec2 gq = fp * vec2(2.6, 1.1);
    vec2 gi = floor(gq), gf = fract(gq) - 0.5;
    float gh = hash12(gi + floor(uTime * 2.5 + hash12(gi + 1.3) * 5.0));
    vec2 go = (vec2(hash12(gi + 3.7), hash12(gi + 9.2)) - 0.5) * 0.6;
    float gd = abs(gf.x - go.x) + abs(gf.y - go.y) * 2.6;
    float glint = step(0.5, gh) * (1.0 - aaw(gd, 0.07 + 0.08 * far, length(dfp * vec2(2.6, 1.1)) * 0.9));
    col = mix(col, uSunC, glint * onPath);
  }

  // lantern: a small warm pool beside the boat and its broken reflection streak
  if (uBoat.z > 0.01) {
    vec2 lp = p - uBoat.xy - vec2(0.35, 0.2);
    float pool = exp(-dot(lp, lp) * 1.1);
    float reach = exp(-lp.x * lp.x * 9.0 - max(lp.y, 0.0) * 0.35) * step(0.0, lp.y);
    float streak = 0.0;
    if (reach > 0.02) streak = reach * aa(fbm(vec2(p.x * 3.0, fp.y * 1.3)), 0.45);
    float g = max(pool * 0.9, streak * 0.8);
    col = mix(col, uGlow, floor(g * 3.0 + 0.3) / 3.0 * 0.5 * uBoat.z);
  }

  // foam: waterline (depth prepass), pulsing outer line, and simulated trails
  float sceneD = -viewZ(texture2D(uDepth, gl_FragCoord.xy / uRes).x);
  float diff = sceneD - vFog;
  float dDiff = fwidth(diff);
  float f1 = 0.0, f2 = 0.0;
  if (diff > -0.25 && diff < 1.2) {          // only where something meets the water
    float wob = fbm(fp * 1.6 + uTime * 0.35);
    f1 = 1.0 - aaw(diff + (wob - 0.5) * 0.22, 0.24, dDiff);
    float pulse = fract(uTime * 0.55 + wob * 0.6);
    f2 = (1.0 - aaw(abs(diff - 0.34 - pulse * 0.5), 0.035, dDiff)) * (1.0 - pulse) * step(0.0, diff);
  }
  // wakes, splashes, strokes and whitewater: fresh foam is dense; as it ages it opens into
  // bubbles and then thin threads, so a patch of foam never reads as a solid floe
  // (the remap keeps a fresh wake solid and lets the faint skirt of a stamp fall away cleanly)
  float simFoam = sim.r * fade, fa = 0.0;
  if (simFoam > 0.003 || uRapids > 0.001) {
    float fn = fbm(fp * 3.2 + vec2(uTime * 0.15, 0.0));
    fa = smoothstep(0.22, 0.85, max(simFoam * (0.75 + 0.5 * fn), smoothstep(0.6, 0.82, wn) * uRapids * 0.8));
  }
  float f3 = 0.0;
  if (fa > 0.01) {
    float F = cells(fp * vec2(5.4, 4.0) + vec2(0.0, uTime * 0.12));
    f3 = aaw(F, (1.0 - fa) * 0.78, length(dfp * vec2(5.4, 4.0)));   // the cell distance changes at most 1:1
    f3 = mix(f3, smoothstep(0.45, 0.55, fa), far);                    // too fine to draw far away
  }
  float fade3 = 1.0 - far * 0.35;
  col = mix(col, uFoam, f3 * 0.86 * fade3);
  col = mix(col, uFoam, max(f1, f2 * 0.75) * fade3);

  col = mix(col, uFogC, smoothstep(uFogR.x, uFogR.y, vFog));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createWater({ sim, depth }) {
  const C = (hex = 0xffffff) => ({ value: new THREE.Color(hex) });
  const uniforms = {
    uTime: { value: 0 }, uFlow: { value: 0 }, uDrift: { value: 0 }, uSlant: { value: 0 },
    uBankX: { value: 7.5 }, uRapids: { value: 0 }, uNight: { value: 0 }, uAurora: { value: 0 },
    uDeep: C(), uShal: C(), uRefl: C(), uInk: C(), uFoam: C(0xfbfeff), uSunC: C(), uFogC: C(),
    uGlow: C(0xffb865), uAur: C(0x5fe0b0),
    uSunDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() },
    uFogR: { value: new THREE.Vector2(40, 150) },
    uSim: { value: null }, uDepth: { value: depth.texture },
    uSimD: { value: sim.domain }, uSimT: { value: sim.texel },
    uRes: { value: new THREE.Vector2(1, 1) }, uCam: { value: new THREE.Vector2(0.5, 1000) },
    uBoat: { value: new THREE.Vector4() },
    // the surface must curve over the horizon with everything else, or the far banks sink under it
    uBend: bendU,
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: waterVert, fragmentShader: waterFrag });
  const geo = new THREE.PlaneGeometry(28, 200, 28, 200).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0, -85);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
