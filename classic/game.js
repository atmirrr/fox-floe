import * as THREE from 'three';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { ShaderPass } from '../vendor/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';
import * as SkeletonUtils from '../vendor/utils/SkeletonUtils.js';
import { Water } from '../vendor/objects/Water.js';

// ---------------------------------------------------------------- constants
const RIVER_HALF = 6.8;          // water half width
const CLAMP_X = 5.6;             // how far the boat may steer
const BANK_X = 8.0;              // cliff module offset
const MODULE_LEN = 20;
const MODULES_PER_SIDE = 8;
const SPAWN_Z = -145;            // where rows appear
const DESPAWN_Z = 16;
const V0 = 8, VMAX = 21, VRAMP = 0.14;

const COL = {
  water: 0x46c8d2,
  fog:   0xb9e2d8,
  sunCore: 0xf7ecc6,
  sunHalo: 0xf3e6ba,
  white: 0xffffff,
};

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COL.fog);
scene.fog = new THREE.Fog(COL.fog, 28, 104);

const TMPV = new THREE.Vector3();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);

// post chain: soft bloom + day/night grade + vignette
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uNight: { value: 0 }, uVig: { value: 0.30 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uNight;
    uniform float uVig;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      col = mix(col * vec3(1.030, 1.000, 0.965) + vec3(0.010, 0.004, -0.004), col, uNight);
      col = mix(col, col * vec3(0.955, 1.005, 1.080) + vec3(0.000, 0.004, 0.014), uNight * 0.9);
      float d = distance(vUv, vec2(0.5));
      col *= 1.0 - smoothstep(0.44, 0.88, d) * uVig;
      gl_FragColor = vec4(col, c.a);
    }`,
};
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 0.55, 0.9);
composer.addPass(bloom);
const gradePass = new ShaderPass(GradeShader);
composer.addPass(gradePass);
composer.addPass(new OutputPass());
function draw() { composer.render(); }

function setCam() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.8 ? 66 : 55;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', setCam); setCam();

// lights
const hemi = new THREE.HemisphereLight(0xfff3dd, 0xa8dcd4, 1.05);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff0d2, 1.75);
key.position.set(4, 11, 8); scene.add(key);
const rim = new THREE.DirectionalLight(0xffe8b8, 0.9);
rim.position.set(0, 8, -12); scene.add(rim);

// water: three.js ocean shader with real planar reflections and animated normal-map waves
const waterNormals = new THREE.TextureLoader().load('../textures/waternormals.jpg', (t) => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
});
const water = new Water(new THREE.PlaneGeometry(90, 340), {
  textureWidth: 512,
  textureHeight: 512,
  waterNormals,
  sunDirection: new THREE.Vector3(4, 11, 8).normalize(),
  sunColor: 0xfff0d2,
  waterColor: COL.water,
  distortionScale: 1.8,
  fog: true,
  alpha: 1.0,
});
water.rotation.x = -Math.PI / 2;
water.position.set(0, -0.03, -120);
water.material.uniforms.size.value = 4.0;
scene.add(water);
const waveY = (x, z) => Math.sin(x * 0.45 + animT * 0.9) * 0.05 + Math.sin(z * 0.30 - animT * 1.15) * 0.06;

// weather rigs: soft sprite texture, snow points, mist planes, dusk god rays
function makeSoftTex(size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
const softTex = makeSoftTex();
const SNOW_N = 260;
const snowGeo = new THREE.BufferGeometry();
const snowArr = new Float32Array(SNOW_N * 3);
const snowSpd = [];
for (let i = 0; i < SNOW_N; i++) {
  snowArr[i * 3] = (Math.random() * 2 - 1) * 13;
  snowArr[i * 3 + 1] = Math.random() * 11;
  snowArr[i * 3 + 2] = -70 + Math.random() * 84;
  snowSpd.push(0.8 + Math.random() * 0.9);
}
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowArr, 3));
const snowMat = new THREE.PointsMaterial({ size: 0.16, map: softTex, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff });
const snow = new THREE.Points(snowGeo, snowMat);
snow.frustumCulled = false;
scene.add(snow);
let snowN = 0, snowT = 0;
const mistPlanes = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(34, 3.2),
    new THREE.MeshBasicMaterial({ map: softTex, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff }));
  m.position.set((i - 1) * 7, 0.9, -25 - i * 28);
  scene.add(m); mistPlanes.push(m);
}
const rays = new THREE.Group();
for (let i = 0; i < 3; i++) {
  const r = new THREE.Mesh(new THREE.PlaneGeometry(6 + i * 3, 70),
    new THREE.MeshBasicMaterial({ map: softTex, color: 0xffe9b8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  r.position.set((i - 1) * 10, -26, 0);
  r.rotation.z = (i - 1) * 0.17 + 0.05;
  rays.add(r);
}
rays.position.set(0, 12, -160);
scene.add(rays);

// sun ahead
const sunGroup = new THREE.Group();
const sunHalo = new THREE.Mesh(new THREE.CircleGeometry(30, 32),
  new THREE.MeshBasicMaterial({ color: COL.sunHalo, transparent: true, opacity: 0.35, fog: false, depthWrite: false }));
const sunCore = new THREE.Mesh(new THREE.CircleGeometry(21, 32),
  new THREE.MeshBasicMaterial({ color: COL.sunCore, fog: false, depthWrite: false }));
sunCore.position.z = 0.5;
sunGroup.add(sunHalo, sunCore);
sunGroup.position.set(0, 17, -180);
scene.add(sunGroup);

// current streaks on the water
const streaks = [];
const streakMat = new THREE.MeshBasicMaterial({ color: COL.white, transparent: true, opacity: 0.11, depthWrite: false });
{
  const smat = streakMat;
  for (let i = 0; i < 34; i++) {
    const len = 3 + Math.random() * 4.5;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, len).rotateX(-Math.PI / 2), smat);
    m.position.set((Math.random() * 2 - 1) * 6.4, 0.012, -Math.random() * 150 + 8);
    scene.add(m); streaks.push(m);
  }
}

// ---------------------------------------------------------------- day cycle + aurora
const DAY_LEN = 1000; // meters per full day
const CYC = [
  { p: 0.00, fog: 0xb9e2d8, water: 0x46c8d2, keyc: 0xfff0d2, sunc: 0xf7ecc6, haloc: 0xf3e6ba, sky: 0xfff3dd, gnd: 0xa8dcd4, hi: 1.05, ki: 1.75, ri: 0.9, night: 0 },
  { p: 0.40, fog: 0xb9e2d8, water: 0x46c8d2, keyc: 0xfff0d2, sunc: 0xf7ecc6, haloc: 0xf3e6ba, sky: 0xfff3dd, gnd: 0xa8dcd4, hi: 1.05, ki: 1.75, ri: 0.9, night: 0 },
  { p: 0.52, fog: 0xe6bfae, water: 0x3ba4bd, keyc: 0xffbe8e, sunc: 0xffcf9a, haloc: 0xf7a97c, sky: 0xffd9c0, gnd: 0x7fa8bd, hi: 0.95, ki: 1.50, ri: 1.1, night: 0 },
  { p: 0.62, fog: 0x233a58, water: 0x174c66, keyc: 0xa9c6f2, sunc: 0xdcecff, haloc: 0x8fb0d8, sky: 0x6f92c2, gnd: 0x1d4a63, hi: 0.60, ki: 0.70, ri: 0.5, night: 1 },
  { p: 0.85, fog: 0x233a58, water: 0x174c66, keyc: 0xa9c6f2, sunc: 0xdcecff, haloc: 0x8fb0d8, sky: 0x6f92c2, gnd: 0x1d4a63, hi: 0.60, ki: 0.70, ri: 0.5, night: 1 },
  { p: 0.94, fog: 0xe6bfae, water: 0x3ba4bd, keyc: 0xffbe8e, sunc: 0xffcf9a, haloc: 0xf7a97c, sky: 0xffd9c0, gnd: 0x7fa8bd, hi: 0.95, ki: 1.50, ri: 1.1, night: 0 },
  { p: 1.001, fog: 0xb9e2d8, water: 0x46c8d2, keyc: 0xfff0d2, sunc: 0xf7ecc6, haloc: 0xf3e6ba, sky: 0xfff3dd, gnd: 0xa8dcd4, hi: 1.05, ki: 1.75, ri: 0.9, night: 0 },
];
let nightF = 0, duskF = 0, mistF = 0;
const aurora = new THREE.Group();
const aur1 = new THREE.Mesh(new THREE.PlaneGeometry(150, 7, 48, 1),
  new THREE.MeshBasicMaterial({ color: 0x7df2be, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
const aur2 = new THREE.Mesh(new THREE.PlaneGeometry(175, 5, 1, 1),
  new THREE.MeshBasicMaterial({ color: 0x8f7ff2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
aur1.position.set(0, 20, 0); aur1.rotation.z = 0.05;
aur2.position.set(10, 25, -8); aur2.rotation.z = -0.05;
aurora.add(aur1, aur2);
aurora.position.set(0, 0, -125);
scene.add(aurora);
const aurBaseY = [];
{
  const pos = aur1.geometry.attributes.position;
  for (let k = 0; k < pos.count; k++) aurBaseY.push(pos.getY(k));
}
let lantern = null, lanternMesh = null;
const _ca = new THREE.Color(), _cb = new THREE.Color();
function lerpHex(a, b, t, target) { _ca.set(a); _cb.set(b); target.copy(_ca.lerp(_cb, t)); }
function updateDayCycle(tSec) {
  const p = (dist % DAY_LEN) / DAY_LEN;
  let i = 0;
  while (i < CYC.length - 2 && CYC[i + 1].p <= p) i++;
  const A = CYC[i], B = CYC[i + 1];
  const t = Math.min(1, Math.max(0, (p - A.p) / (B.p - A.p)));
  lerpHex(A.fog, B.fog, t, scene.fog.color); scene.background.copy(scene.fog.color);
  lerpHex(A.water, B.water, t, water.material.uniforms.waterColor.value);
  lerpHex(A.keyc, B.keyc, t, key.color);
  lerpHex(A.sunc, B.sunc, t, sunCore.material.color);
  lerpHex(A.haloc, B.haloc, t, sunHalo.material.color);
  lerpHex(A.sky, B.sky, t, hemi.color);
  lerpHex(A.gnd, B.gnd, t, hemi.groundColor);
  hemi.intensity = A.hi + (B.hi - A.hi) * t;
  key.intensity = A.ki + (B.ki - A.ki) * t;
  rim.intensity = A.ri + (B.ri - A.ri) * t;
  nightF = A.night + (B.night - A.night) * t;
  sunGroup.scale.setScalar(1 - nightF * 0.42);
  sunHalo.material.opacity = 0.35 * (1 - nightF * 0.5);
  aurora.position.x = camera.position.x * 0.9;
  aur1.material.opacity = nightF * (0.38 + 0.12 * Math.sin(tSec * 0.9));
  aur2.material.opacity = nightF * 0.22;
  if (nightF > 0.02) {
    const pos = aur1.geometry.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k);
      const top = aurBaseY[k] > 0;
      const w1 = Math.sin(x * 0.09 + tSec * 0.8);
      const w2 = Math.sin(x * 0.13 - tSec * 0.55);
      pos.setY(k, aurBaseY[k] + w1 * 1.1 + (top ? 0 : w2 * 2.6 - 1.2));
      pos.setZ(k, Math.sin(x * 0.05 - tSec * 0.5) * 3.5);
    }
    pos.needsUpdate = true;
  }
  if (lantern) {
    lantern.intensity = nightF * (2.0 + Math.sin(tSec * 11) * 0.3 + Math.sin(tSec * 23) * 0.15);
    lanternMesh.visible = nightF > 0.05;
  }
  water.material.uniforms.sunColor.value.copy(key.color);
  const dg = (c, w) => Math.exp(-((p - c) * (p - c)) / (2 * w * w));
  duskF = dg(0.52, 0.035) + dg(0.94, 0.035);
  mistF = dg(0.97, 0.04) + dg(0.05, 0.05) * 0.5;
}

// ---------------------------------------------------------------- audio
// Recorded CC0 sounds (OpenGameArt, see sfx/CREDITS.md), synth only as fallback.
let ac = null, master = null, muted = false, noiseBuf = null, waterLoopOn = false;
const SFX_FILES = {
  row1: '../sfx/row1.wav', row2: '../sfx/row2.wav', row3: '../sfx/row3.wav',
  whoosh1: '../sfx/whoosh1.wav', whoosh2: '../sfx/whoosh2.wav',
  splashMid: '../sfx/splash_mid.wav', splashBig: '../sfx/splash_big.wav', splashCrash: '../sfx/splash_crash.wav',
  crunch: '../sfx/crunch.wav', plop: '../sfx/plop.wav', bubble: '../sfx/bubble.wav',
  boing: '../sfx/boing.wav', waterloop: '../sfx/waterloop.wav',
};
const sfxData = {}, sfxBuf = {};
for (const [k, url] of Object.entries(SFX_FILES)) {
  fetch(url).then(r => r.arrayBuffer()).then(b => { sfxData[k] = b; if (ac) decodeSfx(k); }).catch(() => {});
}
function decodeSfx(k) {
  if (!ac || sfxBuf[k] || !sfxData[k]) return;
  ac.decodeAudioData(sfxData[k].slice(0), (b) => {
    sfxBuf[k] = b;
    if (k === 'waterloop') startWaterLoop();
  }, () => {});
}
let waterGain = null;
function startWaterLoop() {
  if (waterLoopOn || !ac || !sfxBuf.waterloop) return;
  waterLoopOn = true;
  const s = ac.createBufferSource(); s.buffer = sfxBuf.waterloop; s.loop = true;
  const g = ac.createGain(); g.gain.value = 0.05;
  s.connect(g); g.connect(master); s.start();
  waterGain = g;
}
function audioInit() {
  if (ac) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  const wind = ac.createBufferSource(); wind.buffer = buf; wind.loop = true;
  const lf = ac.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 380;
  const wg = ac.createGain(); wg.gain.value = 0.028;
  wind.connect(lf); lf.connect(wg); wg.connect(master); wind.start();
  for (const k of Object.keys(SFX_FILES)) decodeSfx(k);
}
function play(k, vol = 1, rate = 1, delay = 0) {
  if (!ac || muted || !sfxBuf[k]) return false;
  const s = ac.createBufferSource(); s.buffer = sfxBuf[k]; s.playbackRate.value = rate;
  const g = ac.createGain(); g.gain.value = vol;
  s.connect(g); g.connect(master);
  s.start(ac.currentTime + delay);
  return true;
}
function blip(freq, delay, dur, type, vol) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noiseHit(dur, freq, vol, delay = 0) {
  if (!ac || muted || !noiseBuf) return;
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
}
const sndRow = () => { play(['row1', 'row2', 'row3'][(Math.random() * 3) | 0], 0.17, 0.92 + Math.random() * 0.18) || noiseHit(0.13, 900, 0.04); };
const sndBoost = () => {
  const ok = play(Math.random() < 0.5 ? 'whoosh1' : 'whoosh2', 0.65, 0.8 + Math.random() * 0.15);
  play('splashMid', 0.5, 1.05, 0.04);
  if (!ok) { noiseHit(0.2, 1500, 0.12); blip(180, 0, 0.22, 'sine', 0.35); }
};
const sndDing = () => {
  if (play('plop', 0.8, 1 + Math.random() * 0.15)) play('bubble', 0.45, 1.3, 0.05);
  else { blip(660, 0, 0.1, 'sine', 0.5); blip(990, 0.07, 0.14, 'sine', 0.4); }
};
const sndCrash = () => {
  if (play('crunch', 0.95, 0.95)) play('splashCrash', 0.85, 1, 0.03);
  else { noiseHit(0.5, 500, 0.8); blip(90, 0, 0.35, 'sine', 0.6); }
};
const sndPengLand = () => { play('splashBig', 0.55, 0.95 + Math.random() * 0.15) || noiseHit(0.28, 1200, 0.18); };
const sndBoing = () => { play('boing', 0.22, 1.25); };
function sndWekWek() {
  if (!ac || muted) return;
  for (let n = 0; n < 2; n++) {
    const t = ac.currentTime + n * 0.12;
    const o = ac.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(1350 - n * 150, t);
    o.frequency.exponentialRampToValueAtTime(820, t + 0.07);
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 2.5;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.15, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(f); f.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.12);
  }
}

// ---------------------------------------------------------------- load assets
const TEMPLATE_NAMES = ['Player','Penguin','Fish','Lily','FloeA','FloeB','FloeC','Berg','Tree','TreeB','Tent','Campfire','CliffA','CliffB','SplashA','SplashB','SplashC','SplashD','Droplet','SprayFan','FoamBlob','GoldFish','Thermos','Ramp'];
const SKINNED = new Set(['Player', 'Penguin']);
const templates = {};
let animClips = [];
let player = null, oar = null, fox = null;
let playerMixer = null, spineB = null, earLB = null, earRB = null;
let titleCamObj = null, titleMixer = null, titleBlend = 0;
function cloneTpl(name) {
  return SKINNED.has(name) ? SkeletonUtils.clone(templates[name]) : templates[name].clone(true);
}
function getClip(name) { return animClips.find((c) => c.name === name); }
function pengAction(o, name, opts = {}) {
  const clip = getClip(name);
  if (!clip) return;
  const mixer = o.userData.mixer || (o.userData.mixer = new THREE.AnimationMixer(o));
  const act = mixer.clipAction(clip);
  if (opts.once) { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; }
  else act.setLoop(THREE.LoopRepeat, Infinity);
  act.reset();
  if (o.userData.act && o.userData.act !== act) o.userData.act.crossFadeTo(act, opts.fade ?? 0.15, false);
  act.play();
  o.userData.act = act;
}

const msg = document.getElementById('msg');
new GLTFLoader().load('../assets.glb', (gltf) => {
  gltf.scene.updateMatrixWorld(true);
  animClips = gltf.animations || [];
  for (const n of TEMPLATE_NAMES) {
    const o = gltf.scene.getObjectByName(n);
    o.position.set(0, 0, 0);
    o.rotation.set(0, 0, 0);
    templates[n] = o;
  }
  titleCamObj = gltf.scene.getObjectByName('TitleCam');
  if (titleCamObj && getClip('TitleCamMove')) {
    scene.add(titleCamObj);
    titleMixer = new THREE.AnimationMixer(titleCamObj);
    titleMixer.clipAction(getClip('TitleCamMove')).play();
  }
  buildWorld();
  msg.style.display = 'none';
  setState('title');
}, undefined, (e) => { msg.textContent = 'could not load assets.glb (' + e.message + ')'; });

// ---------------------------------------------------------------- pools
const pools = new Map();
function releasePenguin(o) {
  if (o.parent && o.parent !== scene) o.parent.remove(o);
  if (o.parent !== scene) scene.add(o);
  o.rotation.set(0, 0, 0);
  o.scale.setScalar(1);
  o.position.set(0, 0, 0);
  if (o.userData.mixer) { o.userData.mixer.stopAllAction(); o.userData.act = null; }
  release('Penguin', o);
}

function grab(name) {
  const pool = pools.get(name) || [];
  pools.set(name, pool);
  let o = pool.pop();
  if (!o) { o = cloneTpl(name); scene.add(o); }
  o.visible = true;
  return o;
}
function release(name, o) {
  o.visible = false;
  pools.get(name).push(o);
}

// ---------------------------------------------------------------- world
const banks = [];      // {g, cliff, deco:[{o,kind}]}
const flames = [];     // {m, ph}
const obstacles = [];  // {name,o,r,spin,rider,jumpT}
const jumpers = [];    // penguins mid-ambush {o,ob,phase,t,vx,vy,vz}
const pickups = [];    // {o,phase}
const decos = [];      // {name,o}
const rings = [];      // splash rings
const wakes = [];      // {o,t}
let wakePool = [];
const splashes = [];   // 3D crown splashes {o,name,t,dur,s0}
const droplets = [];   // airborne drops {o,vx,vy,vz,spin,t}
const foams = [];      // stern churn blobs {o,vx,vy,vz,t,life,shr}
let sprayL = null, sprayR = null;
const powerups = [];   // {o,kind,t}
let shieldOn = false, magnetT = 0, invulnT = 0, shieldMesh = null;
let airborne = false, airY = 0, airVy = 0;

function buildWorld() {
  // player (skinned: fox, scarf and oar are driven by Blender clips)
  player = cloneTpl('Player');
  fox = player.getObjectByName('FoxMesh');
  oar = player.getObjectByName('OarMesh');
  spineB = player.getObjectByName('b_spine');
  earLB = player.getObjectByName('b_ear_l');
  earRB = player.getObjectByName('b_ear_r');
  scene.add(player);
  playerMixer = new THREE.AnimationMixer(player);
  if (getClip('FoxRow')) playerMixer.clipAction(getClip('FoxRow')).play();
  if (getClip('ScarfWave')) playerMixer.clipAction(getClip('ScarfWave')).play();

  // trailing wake lines attached to the boat, like the reference art
  const wmat = new THREE.MeshBasicMaterial({ color: COL.white, transparent: true, opacity: 0.28, depthWrite: false });
  for (const [x, z, len, op] of [[-0.28, 2.8, 3.6, .3], [0.28, 2.8, 3.6, .3], [-0.55, 2.4, 2.6, .2], [0.55, 2.4, 2.6, .2]]) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.07, len).rotateX(-Math.PI / 2), wmat.clone());
    t.material.opacity = op;
    t.position.set(x, 0.015, z);
    player.add(t);
  }

  // bow spray sheets, scaled live by speed / steering / boost
  sprayR = templates.SprayFan.clone(true);
  sprayL = templates.SprayFan.clone(true);
  sprayR.position.set(0.28, 0.0, -0.80);
  sprayL.position.set(-0.28, 0.0, -0.80);
  sprayR.rotation.z = -0.38;
  sprayL.rotation.z = 0.38;
  sprayR.visible = sprayL.visible = false;
  player.add(sprayR, sprayL);

  // lantern for night stretches
  lantern = new THREE.PointLight(0xffb060, 0, 10, 2);
  lantern.position.set(0.32, 1.1, 0.55);
  lanternMesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffc978 }));
  lanternMesh.position.copy(lantern.position);
  lanternMesh.visible = false;
  player.add(lantern, lanternMesh);

  // shield bubble
  shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.2, depthWrite: false }));
  shieldMesh.position.set(0, 0.65, -0.1);
  shieldMesh.visible = false;
  player.add(shieldMesh);

  // scarf is now part of the Player GLB, skinned and driven by the ScarfWave clip

  // wake splash pool
  for (let i = 0; i < 50; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.0).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: COL.white, transparent: true, opacity: 0, depthWrite: false }));
    w.visible = false; scene.add(w); wakePool.push(w);
  }

  // banks
  for (let side of [-1, 1]) {
    for (let i = 0; i < MODULES_PER_SIDE; i++) {
      const g = new THREE.Group();
      const cliff = templates[Math.random() < 0.5 ? 'CliffA' : 'CliffB'].clone(true);
      g.add(cliff);
      const deco = [];
      const addDeco = (name, kind) => {
        const o = cloneTpl(name);
        g.add(o); deco.push({ o, kind });
        if (name === 'Campfire') {
          const fl = o.getObjectByName('FlameMesh') || o.children.find(c => c.name.includes('Flame'));
          if (fl) flames.push({ m: fl, ph: Math.random() * 9 });
        }
        return o;
      };
      addDeco('Tree', 'tree'); addDeco('Tree', 'tree'); addDeco('TreeB', 'tree');
      addDeco('Tent', 'tent'); addDeco('Campfire', 'fire');
      addDeco('Penguin', 'peng'); addDeco('Penguin', 'peng');
      g.position.set(side * BANK_X, 0, 24 - i * MODULE_LEN);
      g.scale.x = side;
      scene.add(g);
      const b = { g, deco, side };
      shuffleModule(b);
      banks.push(b);
    }
  }
}

function shuffleModule(b) {
  for (const { o, kind } of b.deco) {
    o.position.set(0.9 + Math.random() * 1.9, 1.24, (Math.random() * 2 - 1) * 8.6);
    o.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.8 + Math.random() * 0.45;
    o.scale.setScalar(kind === 'peng' ? 0.9 : s);
    o.visible = kind === 'tree' ? Math.random() < 0.85
              : kind === 'tent' ? Math.random() < 0.16
              : kind === 'fire' ? Math.random() < 0.20
              : Math.random() < 0.35;
  }
}

// ---------------------------------------------------------------- spawning
let gapX = 0, spawnAcc = 0, difficulty = 0;

function riverX(avoidGap) {
  for (let i = 0; i < 9; i++) {
    const x = (Math.random() * 2 - 1) * (CLAMP_X - narN);
    if (!avoidGap || Math.abs(x - gapX) > 2.5) return x;
  }
  return gapX + (gapX > 0 ? -3.4 : 3.4);
}

function rollSection() {
  secEnd = dist + 160 + Math.random() * 120;
  const r = Math.random();
  curT = 0; narT = 0; rapT = 0;
  if (r < 0.30) { /* calm */ }
  else if (r < 0.55) curT = (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 1.1 + difficulty * 0.8);
  else if (r < 0.78) narT = 1.1 + Math.random() * 1.0;
  else { rapT = 1; toast('RAPIDS!'); vib(30); }
  snowT = Math.random() < 0.35 ? 0.5 + Math.random() * 0.5 : 0;
}

function spawnPowerup(atZ) {
  const r = Math.random();
  const kind = r < 0.40 ? 'Thermos' : (r < 0.72 ? 'GoldFish' : 'Ramp');
  const o = grab(kind);
  o.position.set((Math.random() * 2 - 1) * (CLAMP_X - narN - 0.6), 0, atZ);
  o.rotation.set(0, kind === 'Ramp' ? 0 : Math.random() * Math.PI * 2, 0);
  powerups.push({ o, kind, t: Math.random() * 9 });
}

const FLOE_R = { FloeA: 1.0, FloeB: 0.72, FloeC: 1.5 };

function spawnRow(atZ = SPAWN_Z) {
  const gLim = 4.6 - narN;
  gapX = Math.max(-gLim, Math.min(gLim, gapX + (Math.random() * 2 - 1) * 2.4));
  if (dist > 60 && Math.random() < 0.06) spawnPowerup(atZ - 3);
  const roll = Math.random();
  if (roll < 0.13 + difficulty * 0.07) spawnBerg(atZ);
  else if (roll < 0.70) spawnFloes(atZ);
  else spawnFishArc(atZ);
  if (Math.random() < 0.30) spawnLily(atZ);
}

function spawnFloes(atZ = SPAWN_Z) {
  let n = 1;
  if (Math.random() < 0.45 + difficulty * 0.3) n++;
  if (Math.random() < difficulty * 0.4) n++;
  for (let i = 0; i < n; i++) {
    const name = Math.random() < 0.45 ? 'FloeA' : (Math.random() < 0.55 ? 'FloeB' : 'FloeC');
    const o = grab(name);
    const s = 0.8 + Math.random() * 0.7;
    o.scale.setScalar(s);
    o.rotation.y = Math.random() * Math.PI * 2;
    o.position.set(riverX(true), 0, atZ - Math.random() * 6);
    let rider = null;
    if (Math.random() < 0.30) {
      rider = grab('Penguin');
      rider.scale.setScalar(0.95 / s);
      rider.position.set(0.15, 0.13, 0.1);
      rider.rotation.y = Math.random() * Math.PI * 2;
      o.add(rider);
      pengAction(rider, 'PengIdle', { fade: 0 });
    }
    obstacles.push({ name, o, r: FLOE_R[name] * s * 0.92, spin: (Math.random() - 0.5) * 0.25, rider, jumpT: false, md: 9, nm: false });
  }
}

function spawnBerg(atZ = SPAWN_Z) {
  const o = grab('Berg');
  const s = 0.75 + Math.random() * 0.6;
  o.scale.setScalar(s);
  o.rotation.y = Math.random() * Math.PI * 2;
  o.position.set(riverX(true), 0, atZ - Math.random() * 4);
  obstacles.push({ name: 'Berg', o, r: 1.65 * s, spin: 0, rider: null, jumpT: false, md: 9, nm: false });
}

function spawnFishArc(atZ = SPAWN_Z) {
  const n = 3 + Math.floor(Math.random() * 3);
  const bx = Math.max(-4.4, Math.min(4.4, gapX + (Math.random() * 2 - 1) * 1.5));
  // shared school movement, individual jitter; phase lag makes them snake after a leader
  const amp = 0.5 + Math.random() * 0.9;
  const freq = 0.9 + Math.random() * 0.8;
  const ph = Math.random() * 9;
  const swim = 0.7 + Math.random() * 0.9;
  for (let i = 0; i < n; i++) {
    const o = grab('Fish');
    const a = amp * (0.85 + Math.random() * 0.3);
    const baseX = Math.max(-(5.4 - a), Math.min(5.4 - a, bx + (Math.random() - 0.5) * 0.8));
    o.position.set(baseX, -0.05, atZ - i * 1.9);
    o.rotation.set(0, 0, 0);
    o.scale.setScalar(1.15);
    pickups.push({ o, t: Math.random() * 2, phase: ph + i * 0.55, amp: a,
      freq: freq * (0.9 + Math.random() * 0.2), swim: swim * (0.85 + Math.random() * 0.3), baseX });
  }
}

function spawnLily(atZ = SPAWN_Z) {
  const o = grab('Lily');
  const side = Math.random() < 0.5 ? -1 : 1;
  o.position.set(side * (5.0 - narN + Math.random() * 1.2), 0, atZ - Math.random() * 10);
  o.rotation.y = Math.random() * Math.PI * 2;
  o.scale.setScalar(0.8 + Math.random() * 0.8);
  decos.push({ name: 'Lily', o });
}

// ---------------------------------------------------------------- state + hud
const hud = document.getElementById('hud');
const elDist = document.getElementById('dist');
const elFish = document.getElementById('fishc');
const elBest = document.getElementById('best');
const panels = { title: document.getElementById('title'), over: document.getElementById('over') };
const elPower = document.getElementById('power');
const toastEl = document.getElementById('toast');
const popsEl = document.getElementById('pops');
function toast(msg, secs = 2.0) { toastEl.textContent = msg; toastEl.classList.add('on'); toastT = secs; }
function popupAt(x, z, text, color) {
  if (popsEl.childElementCount > 6) popsEl.firstChild.remove();
  TMPV.set(x, 0.6, z).project(camera);
  const d = document.createElement('div');
  d.className = 'pop';
  d.textContent = text;
  if (color) d.style.color = color;
  d.style.left = ((TMPV.x * 0.5 + 0.5) * 100) + '%';
  d.style.top = ((-TMPV.y * 0.5 + 0.5) * 100) + '%';
  popsEl.appendChild(d);
  setTimeout(() => d.remove(), 950);
}

let state = 'loading';
let speed = 4, dist = 0, fishCount = 0, vx = 0, boost = 0, lunge = 0;
let best = +(localStorage.getItem('foxfloe_best') || 0);
let crashT = 0, shake = 0, rowPhase = 0, lastStroke = 0, wakeAcc = 0, elapsed = 0, animT = 0;
// river sections
let secEnd = 200, curT = 0, narT = 0, rapT = 0, curN = 0, narN = 0, rapN = 0, toastT = 0, rapFoamAcc = 0;
// score juice
let bonus = 0, chain = 0, chainT = 0, mult = 1, nearMisses = 0, lastPower = '';
const vib = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };
// micro-life
let earFlickT = 0, boatLean = 0, boatLeanV = 0;
elBest.textContent = 'BEST ' + best;

function setState(s) {
  state = s;
  panels.title.classList.toggle('hidden', s !== 'title');
  panels.over.classList.toggle('hidden', s !== 'over');
  hud.classList.toggle('on', s === 'play' || s === 'paused');
  if (s === 'paused') { toastEl.textContent = 'PAUSED'; toastEl.classList.add('on'); }
  else if (toastT <= 0) toastEl.classList.remove('on');
}

function resetRun() {
  for (const j of jumpers) if (j.phase !== 'windup') releasePenguin(j.o);
  jumpers.length = 0;
  for (const s of splashes) release(s.name, s.o);
  for (const d of droplets) release('Droplet', d.o);
  for (const f of foams) release('FoamBlob', f.o);
  splashes.length = droplets.length = foams.length = 0;
  for (const ob of obstacles) { if (ob.rider) releasePenguin(ob.rider); release(ob.name, ob.o); }
  for (const p of pickups) release('Fish', p.o);
  for (const d of decos) release(d.name, d.o);
  obstacles.length = pickups.length = decos.length = 0;
  player.position.set(0, 0, 0);
  player.rotation.set(0, 0, 0);
  for (const u of powerups) release(u.kind, u.o);
  powerups.length = 0;
  speed = V0; dist = 0; fishCount = 0; vx = 0; boost = 0; lunge = 0; spawnAcc = 0; difficulty = 0; elapsed = 0; gapX = 0;
  bonus = 0; chain = 0; chainT = 0; mult = 1; nearMisses = 0;
  shieldOn = false; magnetT = 0; invulnT = 0; airborne = false; airY = 0; airVy = 0;
  if (shieldMesh) shieldMesh.visible = false;
  lastPower = ''; elPower.textContent = ''; elPower.classList.remove('on');
  secEnd = 200; curT = narT = rapT = 0; curN = narN = rapN = 0;
  snowT = 0; earFlickT = 0; boatLean = 0; boatLeanV = 0;
  toastT = 0; toastEl.classList.remove('on');
  elFish.innerHTML = '&#128031; 0';
  elDist.innerHTML = '0<small> m</small>';
  // pre-populate the river: fish school close ahead, then a full field of rows,
  // so the run starts busy instead of 15 empty seconds
  spawnFishArc(-20);
  spawnLily(-30);
  spawnFishArc(-40);
  for (let z = -58; z > SPAWN_Z + 4; z -= 10 + Math.random() * 5) spawnRow(z);
}

function start() {
  audioInit();
  if (ac && ac.state === 'suspended') ac.resume();
  resetRun();
  setState('play');
  if (!localStorage.getItem('foxfloe_seen')) {
    localStorage.setItem('foxfloe_seen', '1');
    const c = document.getElementById('coach');
    c.classList.add('on');
    setTimeout(() => c.classList.remove('on'), 6000);
  }
}

function totalScore() { return Math.floor(dist) + bonus; }

function smash(i) {
  const ob = obstacles[i];
  shieldOn = false; invulnT = 0.9;
  shieldMesh.visible = false;
  splash3D(ob.o.position.x, ob.o.position.z, 1.8);
  spawnRing(ob.o.position.x, ob.o.position.z, 0.7, 5);
  if (ob.rider) releasePenguin(ob.rider);
  release(ob.name, ob.o);
  obstacles.splice(i, 1);
  play('crunch', 0.55, 1.3); play('splashMid', 0.6, 0.95, 0.03);
  popupAt(player.position.x, -1, 'SMASH!', '#ffd27d');
  vib(40);
  shake = Math.max(shake, 0.22);
}

function doBoost() {
  boost = Math.min(boost + 6, 12);
  lunge = 1;
  rowPhase = Math.ceil(rowPhase / Math.PI) * Math.PI + 0.2;  // snap into a fresh power stroke
  for (let i = 0; i < 8; i++) {
    spawnWake(player.position.x + (Math.random() - 0.5) * 1.1, player.position.z + 0.7 + Math.random() * 1.0, 1.2);
  }
  spawnWake(player.position.x - 0.45, player.position.z - 0.9, 0.8);
  spawnWake(player.position.x + 0.45, player.position.z - 0.9, 0.8);
  splash3D(player.position.x, player.position.z + 1.2, 0.9);
  sndBoost();
  vib(15);
}

function crash() {
  if (state !== 'play') return;
  sndCrash();
  vib([90, 40, 70]);
  shake = 0.55; crashT = 0;
  setState('crashing');
  // splash burst
  splash3D(player.position.x, 0.4, 2.0);
  for (let i = 0; i < 12; i++) spawnWake(player.position.x + (Math.random() - 0.5) * 1.4, 1 + (Math.random() - 0.5) * 1.6, 1.6);
  const sc = totalScore();
  const isBest = sc > best;
  if (isBest) { best = sc; localStorage.setItem('foxfloe_best', best); }
  setTimeout(() => {
    document.getElementById('fscore').textContent = sc;
    document.getElementById('fdetail').innerHTML = Math.floor(dist) + ' m &bull; ' + fishCount + ' fish &bull; ' + nearMisses + ' close calls';
    document.getElementById('fbest').textContent = 'best ' + best;
    document.getElementById('newbest').style.display = isBest ? 'block' : 'none';
    elBest.textContent = 'BEST ' + best;
    setState('over');
  }, 900);
}

// ---------------------------------------------------------------- input
const keys = {};
addEventListener('keydown', (e) => {
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'Enter') {
    if (state === 'title' || state === 'over') start();
    else if (state === 'play' && e.code !== 'Enter') doBoost();
  }
  if (e.code === 'KeyR' && (state === 'over' || state === 'play')) start();
  if (e.code === 'KeyM') { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; }
  if (e.code === 'KeyP' && (state === 'play' || state === 'paused')) setState(state === 'play' ? 'paused' : 'play');
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

let pointerOn = false, pointerX = 0, pDownT = 0, pDownX = 0, pWasPlay = false;
addEventListener('pointerdown', (e) => {
  pointerOn = true; pointerX = e.clientX;
  pDownT = performance.now(); pDownX = e.clientX; pWasPlay = state === 'play';
  if (state === 'title' || state === 'over') start();
});
addEventListener('pointermove', (e) => { if (pointerOn) pointerX = e.clientX; });
addEventListener('pointerup', (e) => {
  pointerOn = false;
  // a quick tap (not a steering drag) is a paddle boost
  if (pWasPlay && state === 'play' && performance.now() - pDownT < 220 && Math.abs(e.clientX - pDownX) < 14) doBoost();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'play') setState('paused');
});

// ---------------------------------------------------------------- fx helpers
function spawnWake(x, z, boost = 1) {
  const w = wakePool.pop();
  if (!w) return;
  w.visible = true;
  w.position.set(x, 0.02 + Math.random() * 0.01, z);
  w.rotation.z = Math.random() * Math.PI;
  w.scale.setScalar(0.7 * boost);
  w.material.opacity = 0.5;
  wakes.push({ o: w, t: 0 });
}
function splash3D(x, z, power = 1) {
  const name = power > 1.4 ? (Math.random() < 0.5 ? 'SplashA' : 'SplashC')
                           : (Math.random() < 0.5 ? 'SplashB' : 'SplashD');
  const o = grab(name);
  o.position.set(x, 0, z);
  o.rotation.y = Math.random() * Math.PI * 2;
  const s0 = 0.6 * power * (0.9 + Math.random() * 0.25);
  o.scale.set(s0 * 0.5, s0 * 0.25, s0 * 0.5);
  splashes.push({ o, name, t: 0, dur: 0.45 + power * 0.1, s0 });
  const nd = Math.min(14, Math.round(3 + power * 4));
  for (let i = 0; i < nd; i++) {
    if (droplets.length > 70) break;
    const d = grab('Droplet');
    const a = Math.random() * Math.PI * 2;
    const rv = (0.7 + Math.random() * 1.5) * power;
    d.position.set(x, 0.06, z);
    d.rotation.set(0, 0, 0);
    d.scale.setScalar(0.7 + Math.random() * 0.9);
    droplets.push({ o: d, vx: Math.cos(a) * rv, vz: Math.sin(a) * rv,
      vy: (2.4 + Math.random() * 2.4) * Math.sqrt(power),
      spin: (Math.random() - 0.5) * 14, t: 0 });
  }
}
function spawnFoam(x, z, out, life = 0.7) {
  if (foams.length > 48) return;
  const o = grab('FoamBlob');
  o.position.set(x, 0.02, z);
  o.rotation.y = Math.random() * Math.PI * 2;
  o.scale.setScalar(0.8 + Math.random() * 0.7);
  foams.push({ o, vx: out * (0.4 + Math.random() * 0.8), vy: 0.6 + Math.random() * 1.2, vz: 0.4 + Math.random() * 0.8, t: 0, life, shr: 0.9 / life });
}
function spawnRing(x, z, op = 0.8, grow = 5) {
  const r = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 22).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: COL.white, transparent: true, opacity: op, depthWrite: false }));
  r.position.set(x, 0.03, z);
  scene.add(r); rings.push({ o: r, t: 0, op, grow });
}

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  update(Math.min(clock.getDelta(), 0.05));
}
function update(dt) {
  if (!player) { draw(); return; }
  if (state === 'paused' || state === 'loading') { draw(); return; }

  const playing = state === 'play';
  const drifting = state === 'title' || state === 'over';
  if (playing) {
    elapsed += dt;
    difficulty = Math.min(1, elapsed / 95);
    speed = Math.min(VMAX, V0 + elapsed * VRAMP) + boost + rapN * 3.4;
    boost = boost > 0.05 ? boost * Math.exp(-1.7 * dt) : 0;
    lunge = Math.max(0, lunge - dt * 2.0);
    if (dist > secEnd) rollSection();
    magnetT = Math.max(0, magnetT - dt);
    invulnT = Math.max(0, invulnT - dt);
    chainT -= dt;
    if (chainT <= 0 && chain > 0) { chain = 0; mult = 1; elFish.innerHTML = '&#128031; ' + fishCount; }
    let ps = '';
    if (shieldOn) ps += '\u{1F6E1}\u{FE0F} ';
    if (magnetT > 0) ps += '\u{1F9F2} ' + Math.ceil(magnetT);
    if (ps !== lastPower) {
      lastPower = ps;
      elPower.textContent = ps;
      elPower.classList.toggle('on', !!ps);
    }
  } else if (drifting) {
    speed = 3.2;
  }
  curN += (curT - curN) * Math.min(1, dt * 0.35);
  narN += (narT - narN) * Math.min(1, dt * 0.35);
  rapN += (rapT - rapN) * Math.min(1, dt * 0.5);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0 && state !== 'paused') toastEl.classList.remove('on'); }
  if (playerMixer && state !== 'crashing') {
    playerMixer.update(dt * ((drifting ? 3.6 : 5.2 + speed * 0.12) / (2 * Math.PI)));
  }

  // ---- steering
  const CLX = CLAMP_X - narN;
  if (playing) {
    let target = 0;
    if (keys.KeyA || keys.ArrowLeft) target -= 7.2;
    if (keys.KeyD || keys.ArrowRight) target += 7.2;
    if (!target && pointerOn) {
      const tx = ((pointerX / innerWidth) - 0.5) * 2 * CLX;
      target = Math.max(-7.2, Math.min(7.2, (tx - player.position.x) * 5));
    }
    vx += (target - vx) * Math.min(1, dt * (airborne ? 4 : 7));
    player.position.x = Math.max(-CLX, Math.min(CLX, player.position.x + (vx + curN) * dt));
    if (Math.abs(player.position.x) >= CLX) vx *= 0.4;
  } else if (drifting) {
    vx *= 0.95;
    player.position.x *= 0.995;
  }

  // ---- ramp air
  if (airborne) {
    airVy -= 10.5 * dt;
    airY += airVy * dt;
    if (airY <= 0) {
      airY = 0; airborne = false;
      splash3D(player.position.x, 0.8, 1.5);
      spawnRing(player.position.x, 0.8, 0.7, 4);
      play('splashBig', 0.7, 1);
      vib(20);
      shake = Math.max(shake, 0.18);
    }
  }

  // ---- rowing animation
  if (state !== 'crashing') {
    rowPhase += dt * (drifting ? 3.6 : 5.2 + speed * 0.12);
    const s = Math.sin(rowPhase);
    boatLeanV += ((-vx * 0.034) - boatLean) * dt * 26 - boatLeanV * dt * 7;
    boatLean = Math.max(-0.3, Math.min(0.3, boatLean + boatLeanV * dt));
    player.rotation.z = boatLean + s * 0.035;
    player.rotation.y = -vx * 0.03 - curN * 0.05;
    player.rotation.x = Math.sin(rowPhase * 0.5) * 0.012 - lunge * 0.15
      - (airborne ? Math.max(-0.4, Math.min(0.5, airVy * 0.07)) : 0);
    player.position.y = Math.sin(rowPhase * 2) * 0.022 + lunge * 0.04 + airY
      + (airborne ? 0 : waveY(player.position.x, 0) * 0.7);
    const flick = earFlickT > 0 ? Math.sin((0.7 - earFlickT) * 28) * 0.35 * earFlickT : 0;
    earFlickT = Math.max(0, earFlickT - dt);
    if (spineB) spineB.rotation.x -= lunge * 0.45;
    if (earLB && flick) { earLB.rotation.z += flick; earRB.rotation.z -= flick; }
    if (playing && Math.sin(rowPhase - 0.4) < 0 && Math.sin(rowPhase - 0.4 + dt * 6) >= 0) {
      sndRow();
      if (speed > 4 && droplets.length < 66) {
        oar.updateWorldMatrix(true, false);
        TMPV.set(0, 0, -0.8).applyMatrix4(oar.matrixWorld);
        const d = grab('Droplet');
        d.position.copy(TMPV);
        d.rotation.set(0, 0, 0);
        d.scale.setScalar(0.5 + Math.random() * 0.3);
        droplets.push({ o: d, vx: (Math.random() - 0.5) * 0.8, vz: 0.6 + Math.random() * 0.8,
          vy: 0.8 + Math.random(), spin: (Math.random() - 0.5) * 10, t: 0 });
      }
    }
  } else {
    crashT += dt;
    speed = Math.max(0, speed - dt * 26);
    player.rotation.z += dt * 7 * (1 - Math.min(1, crashT));
    player.rotation.x = Math.min(0.5, player.rotation.x + dt * 1.2);
    player.position.y = Math.max(-0.25, player.position.y - dt * 0.3);
  }

  // ---- wake spray
  if (speed > 3 && state !== 'crashing' && !airborne) {
    wakeAcc += dt;
    if (wakeAcc > 0.5 / Math.max(6, speed)) {
      wakeAcc = 0;
      const side = Math.random() < 0.5 ? -1 : 1;
      spawnWake(player.position.x + side * 0.3, player.position.z + 1.1);
      if (Math.random() < 0.5) spawnFoam(player.position.x + side * 0.25, player.position.z + 1.15, side);
    }
  }
  for (let i = wakes.length - 1; i >= 0; i--) {
    const w = wakes[i]; w.t += dt;
    w.o.position.z += speed * 0.9 * dt;
    w.o.scale.setScalar(w.o.scale.x + dt * 2.2);
    w.o.material.opacity = Math.max(0, 0.5 * (1 - w.t / 0.85));
    if (w.t > 0.85) { w.o.visible = false; wakePool.push(w.o); wakes.splice(i, 1); }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.t += dt;
    r.o.position.z += speed * dt;
    r.o.scale.setScalar(1 + r.t * r.grow);
    r.o.material.opacity = r.op * (1 - r.t / 0.5);
    if (r.t > 0.5) { scene.remove(r.o); r.o.geometry.dispose(); r.o.material.dispose(); rings.splice(i, 1); }
  }
  const dzFx = speed * dt;
  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i]; s.t += dt;
    const k = s.t / s.dur;
    s.o.position.z += dzFx;
    const rad = s.s0 * (0.55 + k * 1.05);
    const up = s.s0 * Math.max(0.03, Math.sin(Math.min(1, k * 1.1) * Math.PI)) * 1.15;
    s.o.scale.set(rad, up, rad);
    if (k >= 1) { release(s.name, s.o); splashes.splice(i, 1); }
  }
  for (let i = droplets.length - 1; i >= 0; i--) {
    const d = droplets[i]; d.t += dt;
    d.vy -= 11 * dt;
    d.o.position.x += d.vx * dt;
    d.o.position.y += d.vy * dt;
    d.o.position.z += d.vz * dt + dzFx;
    d.o.rotation.x += d.spin * dt;
    if (d.o.position.y <= 0 || d.t > 1.6) {
      if (Math.random() < 0.3) spawnRing(d.o.position.x, d.o.position.z, 0.22, 2.2);
      release('Droplet', d.o); droplets.splice(i, 1);
    }
  }
  for (let i = foams.length - 1; i >= 0; i--) {
    const f = foams[i]; f.t += dt;
    f.vy -= 7 * dt;
    f.o.position.x += f.vx * dt;
    f.o.position.y = Math.max(0.02, f.o.position.y + f.vy * dt);
    f.o.position.z += f.vz * dt + dzFx;
    f.o.scale.setScalar(Math.max(0.05, f.o.scale.x * (1 - dt * f.shr)));
    if (f.t > f.life) { release('FoamBlob', f.o); foams.splice(i, 1); }
  }
  if (sprayL) {
    const base = airborne ? 0 : Math.max(0, (speed - 5) / 14);
    const flut = 1 + Math.sin(rowPhase * 3.1) * 0.07;
    let fR = Math.min(1.6, base * (1 + Math.max(0, -vx) * 0.05) * (1 + lunge * 0.9) * flut);
    let fL = Math.min(1.6, base * (1 + Math.max(0, vx) * 0.05) * (1 + lunge * 0.9) * (2 - flut));
    sprayR.visible = fR > 0.06; sprayL.visible = fL > 0.06;
    sprayR.scale.set(1.15 * fR, fR, 1.25 * fR);
    sprayL.scale.set(-1.15 * fL, fL, 1.25 * fL);
  }
  if (shieldMesh && shieldMesh.visible) {
    shieldMesh.material.opacity = 0.16 + Math.sin(animT * 6) * 0.05;
    shieldMesh.scale.setScalar(1 + Math.sin(animT * 4) * 0.03);
  }

  // ---- world conveyor
  const dz = speed * dt;
  if (playing) {
    dist += dz;
    spawnAcc += dz;
    const interval = 9.2 - difficulty * 3.4;
    if (spawnAcc >= interval) { spawnAcc = 0; spawnRow(); }
    elDist.innerHTML = Math.floor(dist) + '<small> m</small>';
  }

  for (const b of banks) {
    b.g.position.z += dz;
    b.g.position.x = b.side * (BANK_X - narN * 0.9);
    if (b.g.position.z > 34) { b.g.position.z -= MODULES_PER_SIDE * MODULE_LEN; shuffleModule(b); }
  }
  for (let i = powerups.length - 1; i >= 0; i--) {
    const u = powerups[i]; u.t += dt;
    u.o.position.z += dz;
    if (u.kind !== 'Ramp') {
      u.o.position.y = 0.05 + Math.sin(u.t * 3) * 0.06 + waveY(u.o.position.x, u.o.position.z) * 0.8;
      u.o.rotation.y += dt * 1.7;
    } else {
      u.o.position.y = Math.sin(u.t * 2.2) * 0.015 + waveY(u.o.position.x, u.o.position.z) * 0.6;
    }
    if (u.o.position.z > DESPAWN_Z) { release(u.kind, u.o); powerups.splice(i, 1); }
  }
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const ob = obstacles[i];
    ob.o.position.z += dz;
    ob.o.rotation.y += ob.spin * dt;
    ob.o.position.y = waveY(ob.o.position.x, ob.o.position.z) * (ob.name === 'Berg' ? 0.3 : 0.85);
    if (ob.rider && !ob.jumpT && ob.rider.userData.mixer) ob.rider.userData.mixer.update(dt);
    if (ob.o.position.z > DESPAWN_Z) {
      if (ob.rider) { ob.o.remove(ob.rider); scene.add(ob.rider); release('Penguin', ob.rider); }
      release(ob.name, ob.o); obstacles.splice(i, 1);
    }
  }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.t += dt;
    if (magnetT > 0) {
      const ddx = p.o.position.x - player.position.x, ddz = p.o.position.z;
      if (ddx * ddx + ddz * ddz < 190) {
        p.baseX += (player.position.x - p.baseX) * Math.min(1, dt * 5);
        p.o.position.z += dt * 9;
      }
    }
    const sway = Math.sin(p.t * p.freq + p.phase);
    const swayV = Math.cos(p.t * p.freq + p.phase) * p.freq * p.amp;
    p.o.position.z += dz - p.swim * dt;                 // holds against the current
    p.o.position.x = p.baseX + sway * p.amp;            // weaving path
    p.o.position.y = -0.05 + Math.sin(p.t * 4.2 + p.phase * 2) * 0.045 + waveY(p.o.position.x, p.o.position.z) * 0.5;
    p.o.rotation.y = Math.atan2(-swayV, p.swim)         // nose follows swim direction
                   + Math.sin(p.t * 9 + p.phase) * 0.22;  // tail-wag shimmy
    p.o.rotation.z = Math.max(-0.5, Math.min(0.5, -swayV * 0.35))
                   + Math.sin(p.t * 7.3 + p.phase) * 0.08; // lean into turns
    p.o.rotation.x = Math.sin(p.t * 5.1 + p.phase) * 0.06;
    if (Math.random() < dt * 0.12) spawnRing(p.o.position.x, p.o.position.z, 0.28, 2.6);
    if (p.o.position.z > DESPAWN_Z) { release('Fish', p.o); pickups.splice(i, 1); }
  }
  for (let i = decos.length - 1; i >= 0; i--) {
    const d = decos[i];
    d.o.position.z += dz;
    d.o.position.y = waveY(d.o.position.x, d.o.position.z) * 0.9;
    if (d.o.position.z > DESPAWN_Z) { release(d.name, d.o); decos.splice(i, 1); }
  }
  // ---- penguin ambushes: windup on the floe, leap, splash, belly-slide
  if (playing) {
    for (const ob of obstacles) {
      if (!ob.rider || ob.jumpT) continue;
      const oz = ob.o.position.z;
      if (oz > -26 && oz < -15 && Math.abs(ob.o.position.x - player.position.x) < 5.5) {
        ob.jumpT = true;
        jumpers.push({ o: ob.rider, ob, phase: 'windup', t: 0, vx: 0, vy: 0, vz: 0, g: 10,
          sy: ob.rider.scale.y, sx: ob.rider.scale.x, ph: Math.random() * 9, yaw: 0, sq: 0, dip: 0, wk: 0 });
        pengAction(ob.rider, 'PengCrouch', { once: true, fade: 0.12 });
        sndWekWek();
        vib(30);
        earFlickT = 0.7;
      }
    }
  }
  for (let i = jumpers.length - 1; i >= 0; i--) {
    const j = jumpers[i], o = j.o;
    j.t += dt;
    if (o.userData.mixer) o.userData.mixer.update(dt);
    if (j.phase === 'windup') {
      o.getWorldPosition(TMPV);
      o.rotation.y = Math.atan2(-(player.position.x - TMPV.x), TMPV.z) - j.ob.o.rotation.y;
      if (j.t >= 0.5) {
        o.getWorldPosition(TMPV);
        j.ob.o.remove(o); j.ob.rider = null; scene.add(o);
        o.position.copy(TMPV);
        o.scale.setScalar(0.95);
        const T = 0.85;
        j.vx = (player.position.x + (Math.random() - 0.5) * 0.8 - TMPV.x) / T;
        j.vz = (0.3 - TMPV.z) / T - speed;
        j.vy = 0.5 * j.g * T;
        j.phase = 'air'; j.t = 0;
        sndBoing();
        pengAction(o, 'PengFly', { fade: 0.1 });
      }
    } else if (j.phase === 'air') {
      j.vy -= j.g * dt;
      o.position.x += j.vx * dt;
      o.position.y += j.vy * dt;
      o.position.z += j.vz * dt + dz;
      const pitch = Math.atan2(j.vy, Math.hypot(j.vx, j.vz));
      o.rotation.x = pitch * 0.9 - 0.4;                               // body follows the arc, belly leading
      o.rotation.y = Math.atan2(-j.vx, -j.vz);
      o.rotation.z = Math.sin(j.t * 9 + j.ph) * 0.08;
      if (o.position.y <= 0.02) {
        o.position.y = 0.02; j.phase = 'slide'; j.t = 0; j.sq = 1;
        j.yaw = Math.atan2(-j.vx, -j.vz);
        splash3D(o.position.x, o.position.z, 1.15);
        spawnRing(o.position.x, o.position.z, 0.6, 4);
        for (let k = 0; k < 4; k++) spawnWake(o.position.x + (Math.random() - 0.5) * 0.7, o.position.z + (Math.random() - 0.5) * 0.7, 0.9);
        sndPengLand();
        pengAction(o, 'PengIdle', { fade: 0.3 });
      }
    } else if (j.phase === 'slide') {
      j.vx *= Math.max(0, 1 - 2.5 * dt);
      j.vz *= Math.max(0, 1 - 2.0 * dt);
      o.position.x += j.vx * dt;
      o.position.z += j.vz * dt + dz;
      j.sq = Math.max(0, j.sq - dt * 6);                              // splashdown squash eases out
      o.scale.set(0.95 * (1 + 0.18 * j.sq), 0.95 * (1 - 0.3 * j.sq), 0.95 * (1 + 0.18 * j.sq));
      o.rotation.x += (-1.5 - o.rotation.x) * Math.min(1, dt * 10);   // settles belly-flat
      o.rotation.y = j.yaw + Math.sin(j.t * 8 + j.ph) * 0.07;
      o.rotation.z = Math.sin(j.t * 6 + j.ph) * 0.06;
      j.wk += dt;
      if (j.wk > 0.07 && Math.abs(j.vx) + Math.abs(j.vz) > 1.5) { j.wk = 0; spawnWake(o.position.x, o.position.z + 0.3, 0.55); }
      if (j.t > 1.35) { j.phase = 'dive'; j.t = 0; }
    } else {
      const k = Math.min(1, j.t / 0.55);                              // headfirst dive out
      o.rotation.x = -1.5 - k * 1.0;
      o.position.x += -Math.sin(j.yaw) * dt * 1.6;
      o.position.z += -Math.cos(j.yaw) * dt * 1.6 + dz;
      o.position.y = 0.02 + 0.3 * Math.sin(k * Math.PI) - 1.35 * k * k;
      if (k >= 0.55 && !j.dip) { j.dip = 1; splash3D(o.position.x, o.position.z, 0.6); spawnRing(o.position.x, o.position.z, 0.45, 3); play('plop', 0.4, 0.8); }
      if (k >= 1) { releasePenguin(o); jumpers.splice(i, 1); continue; }
    }
    if (j.phase !== 'windup' && o.position.z > DESPAWN_Z) { releasePenguin(o); jumpers.splice(i, 1); }
  }

  for (const st of streaks) {
    st.position.z += dz * (0.35 + rapN * 0.55);
    if (st.position.z > 14) { st.position.z = -140 + Math.random() * 10; st.position.x = (Math.random() * 2 - 1) * 6.4; }
  }
  streakMat.opacity = 0.11 + rapN * 0.10;
  if (waterGain) waterGain.gain.value = 0.05 + rapN * 0.06;
  if (rapN > 0.3 && playing) {
    rapFoamAcc += dt * 7 * rapN;
    while (rapFoamAcc > 1) {
      rapFoamAcc -= 1;
      spawnFoam((Math.random() * 2 - 1) * (CLAMP_X - narN + 0.6), -15 - Math.random() * 75,
        Math.random() < 0.5 ? -0.4 : 0.4, 1.6 + Math.random());
    }
  }

  // ---- visual life: water clock, weather, scarf
  water.material.uniforms.time.value = animT * 0.6;
  snowN += (snowT - snowN) * Math.min(1, dt * 0.4);
  snowMat.opacity = 0.8 * snowN;
  if (snowN > 0.02) {
    const pa = snowGeo.attributes.position;
    for (let k = 0; k < SNOW_N; k++) {
      let x = pa.getX(k), y = pa.getY(k), z = pa.getZ(k);
      y -= snowSpd[k] * dt;
      x += Math.sin(animT * 1.3 + k) * 0.3 * dt;
      z += dz * 0.35;
      if (y < 0) { y = 10 + Math.random(); x = (Math.random() * 2 - 1) * 13; }
      if (z > 14) z = -70;
      pa.setXYZ(k, x, y, z);
    }
    pa.needsUpdate = true;
  }
  for (let k = 0; k < mistPlanes.length; k++) {
    const m = mistPlanes[k];
    m.material.opacity = rapN * 0.12 + mistF * 0.10;
    if (m.material.opacity > 0.005) {
      m.position.z += dz * 0.45;
      if (m.position.z > 16) m.position.z -= 100;
    }
  }
  rays.position.x = sunGroup.position.x * 0.9;
  for (let k = 0; k < rays.children.length; k++) {
    rays.children[k].material.opacity = duskF * (0.06 + 0.02 * Math.sin(animT * 1.3 + k * 2));
  }
  bloom.strength = 0.15 + nightF * 0.5;
  gradePass.uniforms.uNight.value = nightF;
  for (const f of flames) {
    const k = 1 + Math.sin(elapsed * 13 + f.ph) * 0.22;
    f.m.scale.set(1 + Math.sin(elapsed * 9 + f.ph) * 0.1, k, 1);
  }

  // ---- collisions (boat approximated as a segment on z)
  if (playing) {
    const bx = player.position.x;
    if (!airborne && invulnT <= 0) {
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const ob = obstacles[i];
        const oz = ob.o.position.z, ox = ob.o.position.x;
        if (oz < -4 || oz > 4) {
          if (oz > 4 && !ob.nm) {
            ob.nm = true;
            if (ob.md < 0.55) { bonus += 8; nearMisses++; popupAt(ox, 2.5, '+8 close!', '#ffe9b0'); vib(10); }
          }
          continue;
        }
        const cz = Math.max(-0.9, Math.min(0.8, oz));
        const dx2 = (ox - bx) ** 2 + (oz - cz) ** 2;
        const rr = ob.r + 0.52;
        const clear = Math.sqrt(dx2) - rr;
        if (clear < ob.md) ob.md = clear;
        if (dx2 < rr * rr) { if (shieldOn) smash(i); else crash(); break; }
      }
      for (let i = jumpers.length - 1; i >= 0; i--) {
        const j = jumpers[i];
        if (j.phase !== 'slide' && !(j.phase === 'air' && j.o.position.y < 0.8)) continue;
        const oz = j.o.position.z, ox = j.o.position.x;
        if (oz < -3 || oz > 3) continue;
        const cz = Math.max(-0.9, Math.min(0.8, oz));
        const rr = 0.45 + 0.52;
        if ((ox - bx) ** 2 + (oz - cz) ** 2 < rr * rr) {
          if (shieldOn) {
            shieldOn = false; invulnT = 0.9; shieldMesh.visible = false;
            splash3D(ox, oz, 1.4);
            releasePenguin(j.o); jumpers.splice(i, 1);
            play('crunch', 0.5, 1.35); popupAt(bx, -1, 'BONK!', '#ffd27d'); vib(40);
          } else crash();
          break;
        }
      }
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      const oz = p.o.position.z, ox = p.o.position.x;
      if (oz < -3 || oz > 3) continue;
      const cz = Math.max(-1.0, Math.min(0.9, oz));
      if (airY < 0.5 && (ox - bx) ** 2 + (oz - cz) ** 2 < 1.1) {
        fishCount++;
        chain++; chainT = 2.4;
        mult = Math.min(5, 1 + Math.floor(chain / 3));
        const pts = 25 * mult;
        bonus += pts;
        elFish.innerHTML = '&#128031; ' + fishCount + (mult > 1 ? ' &times;' + mult : '');
        popupAt(ox, oz, '+' + pts + (mult > 1 ? ' ×' + mult : ''));
        sndDing();
        vib(12);
        splash3D(ox, oz, 0.75);
        spawnRing(ox, oz);
        release('Fish', p.o);
        pickups.splice(i, 1);
      }
    }
    for (let i = powerups.length - 1; i >= 0; i--) {
      const u = powerups[i];
      const oz = u.o.position.z, ox = u.o.position.x;
      if (oz < -2.5 || oz > 2.5) continue;
      if (u.kind === 'Ramp') {
        if (!airborne && Math.abs(ox - bx) < 0.95 && oz > -1.3 && oz < 0.7) {
          airborne = true; airVy = 5.4;
          play(Math.random() < 0.5 ? 'whoosh1' : 'whoosh2', 0.7, 0.7);
          splash3D(bx, 1.0, 0.8);
          popupAt(bx, -1, 'AIR!', '#bfe8ff');
          vib(15);
        }
        continue;
      }
      const cz = Math.max(-1.0, Math.min(0.9, oz));
      if ((ox - bx) ** 2 + (oz - cz) ** 2 < 1.1) {
        if (u.kind === 'Thermos') { shieldOn = true; shieldMesh.visible = true; popupAt(ox, oz, 'SHIELD!', '#ffd27d'); }
        else { magnetT = 8; popupAt(ox, oz, 'FISH MAGNET!', '#ffd27d'); }
        play('bubble', 0.7, 0.85);
        blip(880, 0, 0.12, 'sine', 0.25); blip(1320, 0.09, 0.16, 'sine', 0.22);
        vib(25);
        release(u.kind, u.o);
        powerups.splice(i, 1);
      }
    }
  }

  // ---- camera + sun + daylight
  animT += dt;
  updateDayCycle(animT);
  shake = Math.max(0, shake - dt);
  const sx = (shake > 0 ? (Math.random() - 0.5) * shake * 0.9 : 0) + (Math.random() - 0.5) * 0.07 * rapN;
  const sy = (shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0) + (Math.random() - 0.5) * 0.04 * rapN;
  const bx = player.position.x;
  const bf = (camera.aspect < 0.8 ? 66 : 55) + boost * 0.55 + rapN * 2;
  if (Math.abs(camera.fov - bf) > 0.05) { camera.fov = bf; camera.updateProjectionMatrix(); }
  if (state === 'title' && titleMixer) { titleMixer.update(dt); titleBlend = Math.min(1, titleBlend + dt * 1.2); }
  else titleBlend = Math.max(0, titleBlend - dt * 1.6);
  camera.position.set(bx * 0.5 + sx, 7.0 + sy, 9.5);
  if (titleBlend > 0 && titleCamObj) camera.position.lerp(titleCamObj.position, titleBlend);
  camera.lookAt((bx * 0.72 + curN * 0.45) * (1 - titleBlend), 0.4 + 0.4 * titleBlend, -7 * (1 - titleBlend));
  sunGroup.position.x = bx * 0.8;

  draw();
}
tick();

// debug handle
window.__ff = {
  get state() { return state; },
  get score() { return totalScore(); },
  get dist() { return dist; },
  get fish() { return fishCount; },
  get counts() { return { obstacles: obstacles.length, pickups: pickups.length, jumpers: jumpers.length, fx: splashes.length + droplets.length + foams.length, speed: +speed.toFixed(1), sfx: Object.keys(sfxBuf).length, pools: [...pools.entries()].map(([k, v]) => k + ':' + v.length).join(' ') }; },
  boost: () => doBoost(),
  templates: TEMPLATE_NAMES,
  clips: () => animClips.map((c) => c.name),
  start, forceCrash: () => crash(),
  step: (dt = 1 / 60) => update(dt),
  cheat: {
    dist: (m) => { dist = m; },
    section: (k) => {
      curT = 0; narT = 0; rapT = 0;
      if (k === 'rapids') rapT = 1;
      if (k === 'narrow') narT = 1.8;
      if (k === 'left') curT = -2.4;
      if (k === 'right') curT = 2.4;
      if (k === 'snow') snowT = 1;
      secEnd = dist + 400;
    },
    give: (kind) => {
      if (kind === 'shield') { shieldOn = true; shieldMesh.visible = true; }
      else if (kind === 'magnet') magnetT = 8;
      else if (kind === 'air') { airborne = true; airVy = 5.4; }
      else spawnPowerup(-24);
    },
    get env() { return { nightF: +nightF.toFixed(2), curN: +curN.toFixed(2), narN: +narN.toFixed(2), rapN: +rapN.toFixed(2), bonus, mult, nearMisses, shieldOn, magnetT: +magnetT.toFixed(1), airborne }; },
  },
};

// on-screen buttons
const btnP = document.getElementById('btnP'), btnM = document.getElementById('btnM');
for (const b of [btnP, btnM]) {
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('pointerup', (e) => e.stopPropagation());
}
btnP.addEventListener('click', (e) => {
  e.stopPropagation();
  if (state === 'play') setState('paused');
  else if (state === 'paused') setState('play');
});
btnM.addEventListener('click', (e) => {
  e.stopPropagation();
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  btnM.innerHTML = muted ? '&#128263;' : '&#128266;';
});

// installable + offline when served from a real host (never during local dev)
// classic copy: no service worker
