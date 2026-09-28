import * as THREE from 'three';

// Time of day on the river clock: p in [0,1) maps to 6:00 AM + p * 24 h (1000 m = one day).
// Each key is a printed backdrop: sky inks, water inks, light, and the night switches.
const K = (p, o) => ({ p, ...o });
const KEYS = [
  K(0.000, { top: 0x5a93cf, mid: 0xa7cbe0, hor: 0xf4cfae, fog: 0xe6d0bb, sun: 0xfff0c8, halo: 0xffcc8f,
    deep: 0x238fab, shal: 0x55c3c1, refl: 0xc9e0de, ink: 0x176f84,
    mFar: 0x94aec4, mNear: 0x7291ad, snow: 0xf4f1ee, cLit: 0xfff1de, cShade: 0xd3b4bd,
    hemiS: 0xfff0dc, hemiG: 0x9cc8cf, hi: 1.0, key: 0xffe4bc, ki: 1.55, rim: 0xffd9a8, ri: 0.9, rimA: 0.32,
    sunEl: 0.10, sunAz: -0.30, stars: 0, aurora: 0, night: 0 }),
  K(0.110, { top: 0x2f8cd2, mid: 0x7fbde3, hor: 0xd0eaee, fog: 0xc8e2e4, sun: 0xfffbea, halo: 0xfff0c2,
    deep: 0x178eab, shal: 0x48cbc8, refl: 0xb9e3e9, ink: 0x117186,
    mFar: 0x9dbbd0, mNear: 0x6f96b2, snow: 0xf8fbfc, cLit: 0xffffff, cShade: 0xbfd5e5,
    hemiS: 0xffffff, hemiG: 0xa3d6d6, hi: 1.05, key: 0xfff5e2, ki: 1.75, rim: 0xfff0d0, ri: 0.8, rimA: 0.22,
    sunEl: 0.30, sunAz: -0.12, stars: 0, aurora: 0, night: 0 }),
  K(0.300, { top: 0x2a88cf, mid: 0x7abbe2, hor: 0xcbe7ec, fog: 0xc4e0e3, sun: 0xfffbea, halo: 0xfff0c2,
    deep: 0x158ca9, shal: 0x46c9c5, refl: 0xb4e1e8, ink: 0x106f84,
    mFar: 0x9ab9cf, mNear: 0x6c93b0, snow: 0xf8fbfc, cLit: 0xffffff, cShade: 0xbcd3e4,
    hemiS: 0xffffff, hemiG: 0xa3d6d6, hi: 1.05, key: 0xfff5e2, ki: 1.75, rim: 0xfff0d0, ri: 0.8, rimA: 0.22,
    sunEl: 0.34, sunAz: 0.06, stars: 0, aurora: 0, night: 0 }),
  K(0.420, { top: 0x5a8cc6, mid: 0xe2b88e, hor: 0xffcf8c, fog: 0xf1cf9f, sun: 0xffd67c, halo: 0xffb65c,
    deep: 0x207d98, shal: 0x4bb7b4, refl: 0xf0cb92, ink: 0x145e6e,
    mFar: 0xc6a894, mNear: 0x978c9c, snow: 0xffe9cc, cLit: 0xffe2b2, cShade: 0xc79aa2,
    hemiS: 0xffe2b0, hemiG: 0x7fb1b8, hi: 0.95, key: 0xffc47c, ki: 1.7, rim: 0xffb35a, ri: 1.2, rimA: 0.5,
    sunEl: 0.15, sunAz: 0.20, stars: 0, aurora: 0, night: 0 }),
  K(0.500, { top: 0x394d8c, mid: 0xd47a7c, hor: 0xff9c5e, fog: 0xe39c82, sun: 0xff7c40, halo: 0xff9e6c,
    deep: 0x1d5d83, shal: 0x3a8ea3, refl: 0xf09a7c, ink: 0x123d58,
    mFar: 0x98738f, mNear: 0x6a5f86, snow: 0xffcfba, cLit: 0xffb28c, cShade: 0x875f86,
    hemiS: 0xffc4a2, hemiG: 0x5f7f9f, hi: 0.85, key: 0xffa072, ki: 1.35, rim: 0xff8c52, ri: 1.3, rimA: 0.55,
    sunEl: 0.012, sunAz: 0.26, stars: 0.05, aurora: 0, night: 0.1 }),
  K(0.560, { top: 0x1c2a5a, mid: 0x5a4e88, hor: 0xb57a98, fog: 0x6e5f86, sun: 0xff8a6e, halo: 0xff8a70,
    deep: 0x163c62, shal: 0x2a6587, refl: 0x8a6f9a, ink: 0x0d2944,
    mFar: 0x4e4e79, mNear: 0x3a3e65, snow: 0xbab4d6, cLit: 0x8a7aa6, cShade: 0x3f3d66,
    hemiS: 0x9a9ad0, hemiG: 0x2f4a6a, hi: 0.72, key: 0xb9b2f2, ki: 0.95, rim: 0xc08ad0, ri: 0.8, rimA: 0.45,
    sunEl: -0.09, sunAz: 0.30, stars: 0.45, aurora: 0.25, night: 0.65 }),
  K(0.625, { top: 0x06112a, mid: 0x0e2346, hor: 0x1e3e62, fog: 0x1a3452, sun: 0xeaf4ff, halo: 0x7fa6d8,
    deep: 0x0a2943, shal: 0x154c65, refl: 0x244f6d, ink: 0x05182a,
    mFar: 0x1f3553, mNear: 0x162944, snow: 0x7f9fc6, cLit: 0x2c4466, cShade: 0x122036,
    hemiS: 0x6f92c2, hemiG: 0x16364f, hi: 0.62, key: 0xa9c6f2, ki: 0.75, rim: 0x7fd8ff, ri: 0.5, rimA: 0.42,
    sunEl: 0.27, sunAz: -0.22, stars: 1, aurora: 1, night: 1 }),
  K(0.880, { top: 0x06112a, mid: 0x0e2346, hor: 0x1e3e62, fog: 0x1a3452, sun: 0xeaf4ff, halo: 0x7fa6d8,
    deep: 0x0a2943, shal: 0x154c65, refl: 0x244f6d, ink: 0x05182a,
    mFar: 0x1f3553, mNear: 0x162944, snow: 0x7f9fc6, cLit: 0x2c4466, cShade: 0x122036,
    hemiS: 0x6f92c2, hemiG: 0x16364f, hi: 0.62, key: 0xa9c6f2, ki: 0.75, rim: 0x7fd8ff, ri: 0.5, rimA: 0.42,
    sunEl: 0.30, sunAz: 0.16, stars: 1, aurora: 0.85, night: 1 }),
  K(0.950, { top: 0x2b3e77, mid: 0x8e7eb2, hor: 0xf2b4b8, fog: 0xb9a0b8, sun: 0xffc0a8, halo: 0xffc0a8,
    deep: 0x235a84, shal: 0x3e8ead, refl: 0xd6a8c0, ink: 0x16395b,
    mFar: 0x8f86ad, mNear: 0x6b6a96, snow: 0xf0d8e6, cLit: 0xf7c2cf, cShade: 0x7f6f9f,
    hemiS: 0xf0c8e0, hemiG: 0x4f6f96, hi: 0.8, key: 0xffcad8, ki: 1.1, rim: 0xffb0c0, ri: 0.9, rimA: 0.4,
    sunEl: -0.05, sunAz: -0.34, stars: 0.3, aurora: 0.12, night: 0.35 }),
];
KEYS.push({ ...KEYS[0], p: 1.0001 });

const NUM_KEYS = ['hi', 'ki', 'ri', 'rimA', 'sunEl', 'sunAz', 'stars', 'aurora', 'night'];
const COLOR_KEYS = Object.keys(KEYS[0]).filter((k) => k !== 'p' && !NUM_KEYS.includes(k));

// live palette: colors are THREE.Color (linear), scalars are numbers
export const pal = {};
for (const k of COLOR_KEYS) pal[k] = new THREE.Color();
for (const k of NUM_KEYS) pal[k] = 0;
pal.p = 0;
pal.duskF = 0;

const _a = new THREE.Color(), _b = new THREE.Color();
export function samplePalette(p) {
  p = ((p % 1) + 1) % 1;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].p <= p) i++;
  const A = KEYS[i], B = KEYS[i + 1];
  let t = Math.min(1, Math.max(0, (p - A.p) / (B.p - A.p)));
  t = t * t * (3 - 2 * t);
  for (const k of COLOR_KEYS) { _a.set(A[k]); _b.set(B[k]); pal[k].copy(_a).lerp(_b, t); }
  for (const k of NUM_KEYS) pal[k] = A[k] + (B[k] - A[k]) * t;
  pal.p = p;
  const g = (c, w) => Math.exp(-((p - c) * (p - c)) / (2 * w * w));
  pal.duskF = g(0.5, 0.04) + g(0.95, 0.03) * 0.6;
  return pal;
}

// river clock: minutes since midnight for a day fraction
export function clockOf(p) {
  const mins = Math.floor(((((p % 1) + 1) % 1) * 1440 + 360) % 1440);
  return { h: Math.floor(mins / 60), m: mins % 60 };
}
