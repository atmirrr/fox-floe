import * as THREE from 'three';

// Printed-backdrop sky: posterized gradient bands, a crisp sun with halo rings, a crescent
// moon, stars, aurora curtains and flat two-tone clouds. Rendered as a camera-centered dome
// pinned to the far plane, so it never occludes and never clips.
const NOISE = /* glsl */`
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
float poster(float t, float n){ float x = t * n; float w = max(fwidth(x), 1e-4); return (floor(x) + smoothstep(.5 - w, .5 + w, fract(x))) / n; }
`;

const skyVert = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
  gl_Position.z = p.w * 0.99999;
}`;

const skyFrag = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform vec3 uTop, uMid, uHor, uSun, uHalo, uCLit, uCShade, uAur1, uAur2;
uniform vec3 uSunDir, uMoonDir;
uniform float uSunVis, uMoonVis, uStars, uAurora, uTime, uCloud, uBands, uDusk;
${NOISE}
float disc(vec3 d, vec3 c, float cr){ float x = dot(d, c); float w = max(fwidth(x), 1e-6) * 1.2; return smoothstep(cr - w, cr + w, x); }
void main() {
  vec3 d = normalize(vDir);
  float e = d.y;
  float az = atan(d.x, -d.z);

  // banded gradient: horizon -> mid -> top
  float t = pow(clamp(e / 0.62, 0.0, 1.0), 0.62);
  float tq = uBands > 0.5 ? poster(t, uBands) : t;
  vec3 col = tq < 0.5 ? mix(uHor, uMid, tq * 2.0) : mix(uMid, uTop, tq * 2.0 - 1.0);

  // a soft warm glow toward the sun (the printed rings stay close to the disc)
  float sd = max(dot(d, uSunDir), 0.0);
  col = mix(col, uHalo, pow(sd, 6.0) * 0.5 * uSunVis * smoothstep(-0.05, 0.25, 0.55 - e));

  // stars (cells in azimuth / elevation); AA width comes from the continuous coordinate
  if (uStars > 0.01 && e > 0.0) {
    vec2 sp = vec2(az * 80.0, e * 80.0);
    vec2 ci = floor(sp), cf = fract(sp);
    float h = hash12(ci);
    if (h > 0.83) {
      vec2 o = vec2(hash12(ci + 3.1), hash12(ci + 7.7)) * 0.6 + 0.2;
      float r = length(cf - o);
      float size = 0.07 + 0.13 * hash12(ci + 11.3);
      float tw = 0.6 + 0.4 * sin(uTime * (1.2 + h * 5.0) + h * 90.0);
      float w = length(fwidth(sp)) * 0.6;
      col = mix(col, vec3(1.0, 0.98, 0.92), (1.0 - smoothstep(size - w, size + w, r)) * tw * uStars * smoothstep(0.03, 0.2, e));
    }
  }

  // aurora curtains, flat-ink steps: a wavy hem, uneven heights, irregular rays
  if (uAurora > 0.01 && e > 0.0) {
    float n = fbm(vec2(az * 1.3 + uTime * 0.015, uTime * 0.03));
    float base = 0.1 + 0.05 * sin(az * 1.7 + n * 5.0 + uTime * 0.05);
    float top = base + 0.1 + 0.2 * vnoise(vec2(az * 5.0 + uTime * 0.04, 3.1));
    float band = smoothstep(base - 0.003, base + 0.004, e) * (1.0 - smoothstep(base + 0.01, top, e));
    float rays = vnoise(vec2(az * 48.0 + n * 9.0, uTime * 0.22)) * 0.7 + vnoise(vec2(az * 131.0, uTime * 0.45)) * 0.3;
    float a = poster(clamp(band * (0.3 + 0.95 * rays), 0.0, 1.0), 3.0);
    col = mix(col, mix(uAur1, uAur2, smoothstep(base, top, e)), a * 0.62 * uAurora);
  }

  // sun: crisp disc with two halo rings
  if (uSunVis > 0.01) {
    float g = poster(pow(sd, 90.0), 3.0);
    col = mix(col, uHalo, g * 0.45 * uSunVis);
    col = mix(col, mix(uHalo, uSun, 0.6), disc(d, uSunDir, 0.9935) * 0.55 * uSunVis);
    col = mix(col, uSun, disc(d, uSunDir, 0.99655) * uSunVis);
  }
  // moon: crescent with a soft ring
  if (uMoonVis > 0.01) {
    float md = max(dot(d, uMoonDir), 0.0);
    col = mix(col, uHalo, poster(pow(md, 180.0), 3.0) * 0.35 * uMoonVis);
    vec3 off = normalize(uMoonDir + vec3(0.018, 0.011, 0.0));
    float m = disc(d, uMoonDir, 0.99875) * (1.0 - disc(d, off, 0.99885));
    col = mix(col, uSun, m * uMoonVis);
  }

  // flat clouds with a shaded underside
  if (e > -0.03 && e < 0.42) {
    vec2 cp = vec2(az * 1.7 + uCloud, e * 9.0);
    float dens = vnoise(cp) * 0.62 + vnoise(cp * 2.1 + 4.0) * 0.26 + vnoise(cp * 4.3 + 9.0) * 0.06 - 0.57 - e * 0.5;
    float fw = max(fwidth(dens), 1e-4) * 1.2;
    float cl = smoothstep(-fw, fw, dens);
    if (cl > 0.0) {                          // the shaded underside only where there is cloud
      vec2 cq = cp - vec2(0.0, 0.5);
      float up = vnoise(cq) * 0.62 + vnoise(cq * 2.1 + 4.0) * 0.26 + vnoise(cq * 4.3 + 9.0) * 0.06 - 0.57 - (e - 0.055) * 0.5;
      float lit = smoothstep(-fw, fw, up);
      col = mix(col, mix(uCShade, uCLit, lit), cl);
    }
  }

  // below the horizon: haze that meets the fog
  col = mix(col, uHor, smoothstep(0.005, -0.03, e));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky() {
  const C = () => ({ value: new THREE.Color() });
  const uniforms = {
    uTop: C(), uMid: C(), uHor: C(), uSun: C(), uHalo: C(), uCLit: C(), uCShade: C(),
    uAur1: { value: new THREE.Color(0x6ff2b8) }, uAur2: { value: new THREE.Color(0x9a7cf0) },
    uSunDir: { value: new THREE.Vector3(0, 0.2, -1).normalize() },
    uMoonDir: { value: new THREE.Vector3(-0.2, 0.3, -1).normalize() },
    uSunVis: { value: 1 }, uMoonVis: { value: 0 }, uStars: { value: 0 }, uAurora: { value: 0 },
    uTime: { value: 0 }, uCloud: { value: 0 }, uBands: { value: 9 }, uDusk: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: skyVert, fragmentShader: skyFrag,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 64, 32), mat);
  mesh.renderOrder = -100;
  mesh.frustumCulled = false;

  const dir = (el, az, out) => out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  return {
    mesh, uniforms,
    update(cam, pal, t, drift) {
      mesh.position.copy(cam.position);
      const u = uniforms;
      u.uTop.value.copy(pal.top); u.uMid.value.copy(pal.mid); u.uHor.value.copy(pal.hor);
      u.uSun.value.copy(pal.sun); u.uHalo.value.copy(pal.halo);
      u.uCLit.value.copy(pal.cLit); u.uCShade.value.copy(pal.cShade);
      const night = pal.night;
      // sun above ~-0.06 elevation; the moon takes over at night
      u.uSunVis.value = night > 0.8 ? 0 : Math.min(1, Math.max(0, (pal.sunEl + 0.09) / 0.06)) * (1 - Math.max(0, night - 0.5) * 2);
      u.uMoonVis.value = Math.max(0, (night - 0.55) / 0.45);
      dir(Math.max(pal.sunEl, -0.2), pal.sunAz, u.uSunDir.value);
      // the moon keeps its own bearing, right of the river, clear of the title column in portrait
      dir(Math.max(0.2, pal.sunEl), 0.21 + pal.sunAz * 0.08, u.uMoonDir.value);
      u.uStars.value = pal.stars;
      u.uAurora.value = pal.aurora;
      u.uTime.value = t;
      u.uCloud.value = drift;
      u.uDusk.value = pal.duskF;
    },
  };
}

// ---------------------------------------------------------------- far ranges
const rangeVert = /* glsl */`
varying vec3 vPos;
varying float vH;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  vH = position.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const rangeFrag = /* glsl */`
precision highp float;
varying vec3 vPos;
varying float vH;
uniform vec3 uCol, uSnow, uHaze, uLight;
uniform float uHaze0, uSnowLine, uPeak;
${NOISE}
void main() {
  vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
  float l = dot(n, uLight);
  float ink = l > 0.25 ? 1.0 : (l > -0.15 ? 0.84 : 0.7);
  float jag = (vnoise(vec2(vPos.x * 0.11, 0.0)) - 0.5) * uPeak * 0.18;
  float snow = step(uSnowLine + jag, vH);
  vec3 c = mix(uCol, uSnow, snow) * ink;
  float haze = uHaze0 + (1.0 - uHaze0) * (1.0 - smoothstep(-uPeak * 0.25, uPeak * 0.45, vH));
  gl_FragColor = vec4(mix(c, uHaze, clamp(haze, 0.0, 1.0)), 1.0);
}`;

function ridgeGeometry(seed, width, peak, cols) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const hs = [];
  // a few broad masses plus sharper ridge teeth
  const ph = [rnd() * 9, rnd() * 9, rnd() * 9];
  for (let i = 0; i <= cols; i++) {
    const x = i / cols;
    let h = 0.45 + 0.3 * Math.sin(x * 7.1 + ph[0]) + 0.2 * Math.sin(x * 17.3 + ph[1]) + 0.12 * Math.sin(x * 41 + ph[2]);
    h += (rnd() - 0.5) * 0.28;
    hs.push(Math.max(0.12, h) * peak);
  }
  const rows = [0, 0.42, 0.74, 1];
  const pos = [];
  const P = (i, r) => {
    const x = (i / cols - 0.5) * width;
    const y = -peak * 0.5 + (hs[i] + peak * 0.5) * rows[r];
    const z = -rows[r] * peak * 0.35 + (r > 0 && r < 3 ? (Math.sin(i * 12.9898 + r * 78.233) * 0.5) * peak * 0.18 : 0);
    return [x + (r > 0 && r < 3 ? Math.sin(i * 3.7 + r) * width / cols * 0.3 : 0), y, z];
  };
  for (let i = 0; i < cols; i++) {
    for (let r = 0; r < rows.length - 1; r++) {
      const a = P(i, r), b = P(i + 1, r), c = P(i, r + 1), d = P(i + 1, r + 1);
      pos.push(...a, ...b, ...c, ...c, ...b, ...d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

export function createRanges() {
  const group = new THREE.Group();
  const layers = [];
  const specs = [
    { D: 330, peak: 105, width: 1500, cols: 70, haze: 0.5, seed: 11 },
    { D: 250, peak: 72, width: 1200, cols: 64, haze: 0.3, seed: 23 },
    { D: 190, peak: 44, width: 960, cols: 60, haze: 0.12, seed: 37 },
  ];
  for (const sp of specs) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: rangeVert, fragmentShader: rangeFrag, fog: false,
      uniforms: {
        uCol: { value: new THREE.Color() }, uSnow: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() },
        uLight: { value: new THREE.Vector3(-0.55, 0.55, 0.62).normalize() },
        uHaze0: { value: sp.haze }, uSnowLine: { value: sp.peak * 0.42 }, uPeak: { value: sp.peak },
      },
    });
    const mesh = new THREE.Mesh(ridgeGeometry(sp.seed, sp.width, sp.peak, sp.cols), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -90;
    group.add(mesh);
    layers.push({ mesh, mat, ...sp });
  }
  const _c = new THREE.Color();
  return {
    group,
    update(cam, pal, bendSide) {
      for (const L of layers) {
        const u = L.mat.uniforms;
        const f = (L.D - 190) / 140;          // 0 near .. 1 far
        u.uCol.value.copy(pal.mNear).lerp(pal.mFar, f);
        u.uSnow.value.copy(pal.snow).lerp(_c.copy(pal.hor), f * 0.35);
        u.uHaze.value.copy(pal.fog).lerp(pal.hor, 0.5);
        // ranges ride with the camera, slide a little with the river's bend
        const reach = Math.min(L.D, 150);
        L.mesh.position.set(cam.position.x * (0.35 + f * 0.4) + bendSide * reach * reach * 0.8, -5, cam.position.z - L.D);
      }
    },
  };
}
