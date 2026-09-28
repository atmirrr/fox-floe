import * as THREE from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import * as SkeletonUtils from './vendor/utils/SkeletonUtils.js';
import { bendU, rimU, bendMaterial, inkify, inkMaterial } from './src/bend.js';
import { samplePalette, pal } from './src/palette.js';
import { createSky, createRanges } from './src/sky.js';
import { createWaterSim, createDepthPrepass, createWater, WATERLINE_LAYER } from './src/water.js';
import { createTerrain, bakeTemplate } from './src/terrain.js';
import { createPost } from './src/post.js';
import { audioInit, play, snd, setMuted, isMuted, setRapidsLevel, setDrive, sfxCount, meter, audioState } from './src/audio.js';
import { createUI } from './src/ui.js';

// ---------------------------------------------------------------- constants
const CLAMP_X = 5.6;             // how far the boat may steer
const BANK_X = 8.0;              // cliff module offset
const MODULE_LEN = 20;
const MODULES_PER_SIDE = 10;
const SPAWN_Z = -145;            // where rows appear
const DESPAWN_Z = 16;
const V0 = 8, VMAX = 21, VRAMP = 0.14;
const DAY_LEN = 1000;            // meters per river day
const DEMO_V = 8.5;

// ---------------------------------------------------------------- quality
const coarse = matchMedia('(pointer: coarse)').matches;
const Q = {
  dpr: Math.min(devicePixelRatio, 2),
  // multisampling is paid per device pixel: on dense screens two samples hide the steps just as well
  samples: coarse || Math.min(devicePixelRatio, 2) >= 1.5 ? 2 : 4,
  sim: coarse ? [128, 512] : [160, 640],
  // the waterline foam reads this pass: full size on standard-density screens, or its edge steps
  depthScale: Math.min(devicePixelRatio, 2) < 1.5 ? 1 : 0.5,
};

// ---------------------------------------------------------------- renderer
const ui = createUI();
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.dpr);
renderer.toneMapping = THREE.NoToneMapping;
ui.screen.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe6e7);
scene.fog = new THREE.Fog(0xcfe6e7, 55, 165);
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 1000);
const TMPV = new THREE.Vector3();

// lights
const hemi = new THREE.HemisphereLight(0xffffff, 0xa3d6d6, 1.05);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff5e2, 1.75);
key.position.set(4, 11, 8); scene.add(key);
const rim = new THREE.DirectionalLight(0xfff0d0, 0.8);
rim.position.set(0, 8, -12); scene.add(rim);

// sky, far ranges, water
const sky = createSky();
scene.add(sky.mesh);
const ranges = createRanges();
scene.add(ranges.group);
const sim = createWaterSim(renderer, { res: Q.sim });
const depthPre = createDepthPrepass(renderer, Q.depthScale);
const water = createWater({ sim, depth: depthPre });
scene.add(water.mesh);
const WU = water.uniforms;
const post = createPost(renderer, scene, camera, { samples: Q.samples, bloom: true });

// weather: soft sprite texture, snow points, rapids mist
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
const SNOW_N = 320;
const snowGeo = new THREE.BufferGeometry();
const snowArr = new Float32Array(SNOW_N * 3);
const snowSpd = [];
for (let i = 0; i < SNOW_N; i++) {
  snowArr[i * 3] = (Math.random() * 2 - 1) * 14;
  snowArr[i * 3 + 1] = Math.random() * 11;
  snowArr[i * 3 + 2] = -80 + Math.random() * 94;
  snowSpd.push(0.8 + Math.random() * 0.9);
}
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowArr, 3));
const snowMat = bendMaterial(new THREE.PointsMaterial({ size: 0.17, map: softTex, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff }));
const snow = new THREE.Points(snowGeo, snowMat);
snow.frustumCulled = false;
scene.add(snow);
let snowN = 0, snowT = 0;
const mistPlanes = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(34, 3.2),
    bendMaterial(new THREE.MeshBasicMaterial({ map: softTex, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff })));
  m.position.set((i - 1) * 7, 0.9, -25 - i * 28);
  m.frustumCulled = false;
  scene.add(m); mistPlanes.push(m);
}

// ---------------------------------------------------------------- load assets
const TEMPLATE_NAMES = ['Player','Penguin','Fish','Lily','FloeA','FloeB','FloeC','Berg','Tree','TreeB','Tent','Campfire','CliffA','CliffB','SplashA','SplashB','SplashC','SplashD','Droplet','SprayFan','GoldFish','Thermos','Ramp'];
const WATERLINE = new Set(['Player', 'Penguin', 'FloeA', 'FloeB', 'FloeC', 'Berg', 'CliffA', 'CliffB', 'Lily', 'Ramp', 'Thermos', 'GoldFish']);
const SKINNED = new Set(['Player', 'Penguin']);
const templates = {};
let animClips = [];
let player = null, oar = null;
let playerMixer = null, spineB = null, earLB = null, earRB = null;
let orbitCam = null, orbitMixer = null;
let terrain = null;
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
  act.timeScale = opts.ts ?? 1;
  if (o.userData.act && o.userData.act !== act) o.userData.act.crossFadeTo(act, opts.fade ?? 0.15, false);
  act.play();
  o.userData.act = act;
}

new GLTFLoader().load('./assets.glb', (gltf) => {
  gltf.scene.updateMatrixWorld(true);
  animClips = gltf.animations || [];
  for (const n of TEMPLATE_NAMES) {
    const o = gltf.scene.getObjectByName(n);
    o.position.set(0, 0, 0);
    o.rotation.set(0, 0, 0);
    inkify(o);
    o.traverse((c) => {
      c.frustumCulled = false;
      if (WATERLINE.has(n) && c.isMesh) c.layers.enable(WATERLINE_LAYER);
    });
    templates[n] = o;
  }
  // fish are the pickups: pale silver with a faint glow so they read against the teal river
  templates.Fish.traverse((c) => { if (c.isMesh) { c.material.color.set(0xd8eff6); c.material.emissive.set(0x1d4450); } });
  // spray is water, not ice: flat, pale and a little see-through, so a splash never reads as a floe
  const sprayMat = bendMaterial(new THREE.MeshBasicMaterial({ color: 0xe9f8fc, transparent: true, opacity: 0.82, depthWrite: false }), { rim: false });
  for (const n of ['SplashA', 'SplashB', 'SplashC', 'SplashD', 'Droplet']) templates[n].traverse((c) => { if (c.isMesh) c.material = sprayMat; });
  // penguins: a deep navy coat instead of near-black, so the bird still reads as a bird in the haze
  templates.Penguin.traverse((c) => { if (c.isMesh && c.material.color.getHSL({}).l < 0.15) c.material.color.set(PENG_COAT); });
  // one draw call per object: the static props lose their per-material pieces, and the penguins that
  // only ever stand on the banks lose their skeleton (no bone upload every frame)
  for (const n of ['FloeA', 'FloeB', 'FloeC', 'Berg', 'Lily']) templates[n] = mergedTemplate(n, bakeTemplate(templates[n]), WATERLINE.has(n));
  templates.PenguinStill = mergedTemplate('Penguin', bakePosed(templates.Penguin), false);
  orbitCam = gltf.scene.getObjectByName('TitleCam');
  if (orbitCam && getClip('TitleCamMove')) {
    scene.add(orbitCam);
    orbitMixer = new THREE.AnimationMixer(orbitCam);
    orbitMixer.clipAction(getClip('TitleCamMove')).play();
  }
  buildWorld();
  ui.ready(() => enterTitle());
}, undefined, (e) => ui.fail('could not load assets.glb (' + e.message + ')'));

// a single vertex-colored mesh in the shared ink material, wrapped in a root like the original template
let mergedMat = null;
function mergedTemplate(name, baked, waterline) {
  if (!mergedMat) mergedMat = inkMaterial({ name: 'merged', color: new THREE.Color(1, 1, 1), vertexColors: true, transparent: false, opacity: 1, side: THREE.FrontSide });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(baked.pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(baked.nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(baked.col, 3));
  const mesh = new THREE.Mesh(geo, mergedMat);
  mesh.frustumCulled = false;
  if (waterline) mesh.layers.enable(WATERLINE_LAYER);
  const root = new THREE.Object3D();
  root.name = name;
  root.add(mesh);
  return root;
}
// a skinned template frozen in its rest pose, as flat-shaded triangles with baked colors
function bakePosed(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const pos = [], col = [], v = new THREE.Vector3(), m = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const geo = o.geometry, P = geo.attributes.position, VC = geo.attributes.color;
    const base = (Array.isArray(o.material) ? o.material[0] : o.material).color;
    // pose every original vertex first (the skin weights follow the original vertex order),
    // then lay the triangles out through the index
    const sp = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      if (o.isSkinnedMesh) o.applyBoneTransform(i, v);
      v.applyMatrix4(m);
      sp[i * 3] = v.x; sp[i * 3 + 1] = v.y; sp[i * 3 + 2] = v.z;
    }
    const idx = geo.index ? geo.index.array : null;
    const n = idx ? idx.length : P.count;
    for (let t = 0; t < n; t++) {
      const i = idx ? idx[t] : t;
      pos.push(sp[i * 3], sp[i * 3 + 1], sp[i * 3 + 2]);
      col.push(base.r * (VC ? VC.getX(i) : 1), base.g * (VC ? VC.getY(i) : 1), base.b * (VC ? VC.getZ(i) : 1));
    }
  });
  const nor = new Float32Array(pos.length);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.length; i += 9) {
    a.fromArray(pos, i); b.fromArray(pos, i + 3); c.fromArray(pos, i + 6);
    b.sub(a); c.sub(a); b.cross(c).normalize();
    for (let k = 0; k < 3; k++) { nor[i + k * 3] = b.x; nor[i + k * 3 + 1] = b.y; nor[i + k * 3 + 2] = b.z; }
  }
  return { pos: new Float32Array(pos), nor, col: new Float32Array(col), count: pos.length / 3 };
}

// ---------------------------------------------------------------- pools
const pools = new Map();
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
function releasePenguin(o) {
  if (o.parent && o.parent !== scene) o.parent.remove(o);
  if (o.parent !== scene) scene.add(o);
  o.rotation.set(0, 0, 0);
  o.scale.setScalar(1);
  o.position.set(0, 0, 0);
  if (o.userData.mixer) { o.userData.mixer.stopAllAction(); o.userData.act = null; }
  o.userData.jumper = null;
  release('Penguin', o);
}

// ---------------------------------------------------------------- world
const banks = [];      // {g, deco:[{o,kind}], side}
const flames = [];     // {m, ph}
const obstacles = [];  // {name,o,r,spin,rider,jumpT,md,nm}
const jumpers = [];    // penguins mid-ambush
const pickups = [];    // fish {o,t,phase,amp,freq,swim,baseX,lx,lz}
const decos = [];      // {name,o}
const splashes = [];   // 3D crown splashes {o,name,t,dur,s0}
const droplets = [];   // airborne drops {o,vx,vy,vz,spin,t}
let sprayL = null, sprayR = null;
const powerups = [];   // {o,kind,t}
let shieldOn = false, magnetT = 0, invulnT = 0, shieldMesh = null;
let airborne = false, airY = 0, airVy = 0;
let lantern = null, lanternMesh = null;

function buildWorld() {
  // player (skinned: fox, scarf and oar are driven by Blender clips)
  player = cloneTpl('Player');
  oar = player.getObjectByName('OarMesh');
  spineB = player.getObjectByName('b_spine');
  earLB = player.getObjectByName('b_ear_l');
  earRB = player.getObjectByName('b_ear_r');
  scene.add(player);
  playerMixer = new THREE.AnimationMixer(player);
  if (getClip('FoxRow')) playerMixer.clipAction(getClip('FoxRow')).play();
  if (getClip('ScarfWave')) playerMixer.clipAction(getClip('ScarfWave')).play();

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
    bendMaterial(new THREE.MeshBasicMaterial({ color: 0xffc978 })));
  lanternMesh.position.copy(lantern.position);
  lanternMesh.visible = false;
  player.add(lantern, lanternMesh);

  // shield bubble: a flat ink ring and a faint shell
  shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 12),
    bendMaterial(new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.18, depthWrite: false })));
  shieldMesh.position.set(0, 0.65, -0.1);
  shieldMesh.visible = false;
  player.add(shieldMesh);

  // banks: each module's cliff, trees and tent are baked into one vertex-colored mesh, one draw
  // call instead of a dozen (the banks were most of the frame's draw calls); the campfire (its flame
  // flickers) and the penguins (they move) stay separate objects
  BANK_BAKE.CliffA = bakeTemplate(templates.CliffA); BANK_BAKE.CliffB = bakeTemplate(templates.CliffB);
  BANK_BAKE.Tree = bakeTemplate(templates.Tree); BANK_BAKE.TreeB = bakeTemplate(templates.TreeB);
  BANK_BAKE.Tent = bakeTemplate(templates.Tent);
  const bankMat = inkMaterial({ name: 'bank', color: new THREE.Color(1, 1, 1), vertexColors: true, transparent: false, opacity: 1, side: THREE.FrontSide });
  const cap = Math.max(BANK_BAKE.CliffA.count, BANK_BAKE.CliffB.count) + 3 * Math.max(BANK_BAKE.Tree.count, BANK_BAKE.TreeB.count) + BANK_BAKE.Tent.count;
  for (let side of [-1, 1]) {
    for (let i = 0; i < MODULES_PER_SIDE; i++) {
      const g = new THREE.Group();
      const geo = new THREE.BufferGeometry();
      for (const a of ['position', 'normal', 'color']) geo.setAttribute(a, new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
      const mesh = new THREE.Mesh(geo, bankMat);
      mesh.frustumCulled = false;
      mesh.layers.enable(WATERLINE_LAYER);    // the cliff foot meets the water
      g.add(mesh);
      const deco = [];
      const addDeco = (name, kind) => {
        const o = cloneTpl(name);
        g.add(o); deco.push({ o, kind });
        if (name === 'Campfire') {
          const fl = o.getObjectByName('FlameMesh') || o.children.find((c) => c.name.includes('Flame'));
          if (fl) flames.push({ m: fl, ph: Math.random() * 9 });
        }
        return o;
      };
      addDeco('Campfire', 'fire');
      addDeco('PenguinStill', 'peng'); addDeco('PenguinStill', 'peng');
      const statics = ['Tree', 'Tree', 'TreeB', 'Tent'].map((name) => ({ name, x: 0, y: 1.24, z: 0, s: 1, rot: 0, visible: false }));
      g.position.set(side * BANK_X, 0, 24 - i * MODULE_LEN);
      g.scale.x = side;
      scene.add(g);
      const b = { g, deco, side, mesh, statics, cliff: Math.random() < 0.5 ? 'CliffA' : 'CliffB' };
      shuffleModule(b);
      banks.push(b);
    }
  }

  terrain = createTerrain(templates, scene);
  for (const L of [player]) L.traverse((c) => { c.frustumCulled = false; });
}

const BANK_BAKE = {};
const bankQueue = [];
// write one bank module's cliff and its visible trees / tent into the module's single mesh
function bakeBank(b) {
  const geo = b.mesh.geometry;
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, C = geo.attributes.color.array;
  let w = 0;
  const put = (tpl, tx, ty, tz, s, rot) => {
    const cs = Math.cos(rot), sn = Math.sin(rot);
    for (let i = 0; i < tpl.count; i++, w++) {
      const x = tpl.pos[i * 3] * s, y = tpl.pos[i * 3 + 1] * s, z = tpl.pos[i * 3 + 2] * s;
      P[w * 3] = tx + x * cs + z * sn; P[w * 3 + 1] = ty + y; P[w * 3 + 2] = tz - x * sn + z * cs;
      const nx = tpl.nor[i * 3], ny = tpl.nor[i * 3 + 1], nz = tpl.nor[i * 3 + 2];
      N[w * 3] = nx * cs + nz * sn; N[w * 3 + 1] = ny; N[w * 3 + 2] = -nx * sn + nz * cs;
      C[w * 3] = tpl.col[i * 3]; C[w * 3 + 1] = tpl.col[i * 3 + 1]; C[w * 3 + 2] = tpl.col[i * 3 + 2];
    }
  };
  put(BANK_BAKE[b.cliff], 0, 0, 0, 1, 0);
  for (const d of b.statics) if (d.visible) put(BANK_BAKE[d.name], d.x, d.y, d.z, d.s, d.rot);
  geo.setDrawRange(0, w);
  for (const a of ['position', 'normal', 'color']) geo.attributes[a].needsUpdate = true;
}

function shuffleModule(b) {
  for (const d of b.statics) {
    d.x = 0.9 + Math.random() * 1.9; d.z = (Math.random() * 2 - 1) * 8.6;
    d.rot = Math.random() * Math.PI * 2; d.s = 0.8 + Math.random() * 0.45;
    d.visible = d.name === 'Tent' ? Math.random() < 0.16 : Math.random() < 0.85;
  }
  bakeBank(b);
  for (const { o, kind } of b.deco) {
    o.position.set(0.9 + Math.random() * 1.9, 1.24, (Math.random() * 2 - 1) * 8.6);
    o.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.8 + Math.random() * 0.45;
    o.scale.setScalar(kind === 'peng' ? PENG_S * 0.95 : s);
    if (kind === 'peng') { o.rotation.order = 'YXZ'; o.userData.bp = { t: Math.random() * 4, tgt: o.rotation.y, yaw: o.rotation.y, hop: 0, y0: o.position.y }; }
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

const SECTION_CALL = { rapids: 'rapids', narrows: 'narrows' };
function rollSection() {
  secEnd = dist + 160 + Math.random() * 120;
  const r = Math.random();
  curT = 0; narT = 0; rapT = 0;
  // no side currents: a sideways push the player did not ask for read as the boat steering itself
  let kind = 'calm';
  if (r < 0.40) { /* calm */ }
  else if (r < 0.72) { narT = 1.1 + Math.random() * 1.0; kind = 'narrows'; }
  else { rapT = 1; kind = 'rapids'; vib(30); }
  section = kind;
  if (state === 'play' && SECTION_CALL[kind]) { ui.call(SECTION_CALL[kind]); snd.call(); }
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
      seatRider(rider, name, s);
      o.add(rider);
      pengAction(rider, 'PengIdle', { fade: 0, ts: 0.85 + Math.random() * 0.3 });
    }
    obstacles.push({ name, o, r: FLOE_R[name] * s * 0.92, spin: (Math.random() - 0.5) * 0.25, rider, jumpT: false, md: 9, nm: false });
  }
}

// ---------------------------------------------------------------- penguins
// Riders stand on floes and keep an eye on the boat. When it comes near, one turns, crouches,
// hops into the river just ahead of it and porpoises across its lane, then dives away.
// Physics runs on the body's center; the model's origin is its feet, so placePeng converts.
const PENG_S = 1.3;           // world scale: 0.78 m tall, most of the fox's height
const PENG_R = 0.42;          // collision radius
const PENG_G = 14;            // a touch stronger than real gravity: snappy cartoon hops
const PENG_H = 0.35 * PENG_S; // feet to center of mass
const PENG_COAT = 0x243247;
const PENG_SWIM = 3.6;                    // m/s across the current while porpoising
const PENG_UNDER = 0.24;                  // glide under the surface after splashdown
const PENG_HOP = 4.4;                     // porpoise leap launch speed (apex ~0.7 m)
const PENG_LEAP = 2 * PENG_HOP / PENG_G;  // time in the air per porpoise leap
// splashdown to the moment the first leap crosses the boat's line, late in its arc,
// so the leap is in the air a good third of a second before it can reach the bow
const PENG_LEAD = PENG_UNDER + 0.7 * PENG_LEAP;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth01 = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

function seatRider(rider, name, s) {
  let x, y = 0.12, z;
  const a = Math.random() * Math.PI * 2;
  if (name === 'FloeC') {
    // FloeC carries an ice block: stand on top of it as a lookout, or on the flat side clear of it
    if (Math.random() < 0.55) { x = 0.37; y = 0.53; z = 0.3; }
    else { x = -0.55 + Math.cos(a) * 0.3; z = -0.6 + Math.sin(a) * 0.3; }
  } else {
    const R = name === 'FloeB' ? 0.18 : 0.38;
    x = Math.cos(a) * R; z = Math.sin(a) * R;
  }
  rider.position.set(x, y, z);
  rider.rotation.set(0, 0, 0);
  rider.rotation.order = 'YXZ';
  rider.scale.setScalar(PENG_S / s);
  // mostly facing the boat, so the white front reads from the river
  const yaw = Math.PI + (Math.random() - 0.5) * 1.6;
  rider.userData.ride = { yaw, tgt: yaw, t: 0.5 + Math.random() * 2.5, hop: 0, y0: y };
}

// idle on the floe: looks around with a two-step shuffle, counter-rotating the floe's spin
function rideUpdate(ob, dt) {
  const r = ob.rider, u = r.userData.ride, s = ob.o.scale.x;
  if (r.userData.mixer) r.userData.mixer.update(dt);
  u.t -= dt;
  if (u.t <= 0) { u.t = 1.8 + Math.random() * 2.6; u.tgt = Math.PI + (Math.random() - 0.5) * 2.4; u.hop = 0.5; }
  u.yaw += wrapA(u.tgt - u.yaw) * Math.min(1, dt * 4);
  u.hop = Math.max(0, u.hop - dt);
  const w = u.hop > 0 ? Math.sin((0.5 - u.hop) / 0.5 * Math.PI * 2) : 0;
  r.rotation.set(0, u.yaw - ob.o.rotation.y, w * 0.14);
  r.position.y = u.y0 + Math.abs(w) * 0.05 / s;
}

// penguins on the cliff tops: now and then a shuffling turn to look somewhere else
function bankPeng(o, dt) {
  const u = o.userData.bp;
  u.t -= dt;
  if (u.t <= 0) { u.t = 2 + Math.random() * 4; u.tgt = u.yaw + (Math.random() - 0.5) * 2.6; u.hop = 0.5; }
  u.yaw += wrapA(u.tgt - u.yaw) * Math.min(1, dt * 4);
  u.hop = Math.max(0, u.hop - dt);
  const w = u.hop > 0 ? Math.sin((0.5 - u.hop) / 0.5 * Math.PI * 2) : 0;
  o.rotation.set(0, u.yaw, w * 0.14);
  o.position.y = u.y0 + Math.abs(w) * 0.06;
}

// the body axis follows the velocity through the water (head first, belly down)
function orientPeng(o, vx, vy, vz, dt, rate) {
  const vh = Math.hypot(vx, vz);
  const k = Math.min(1, dt * rate);
  if (vh > 0.3) o.rotation.y += wrapA(Math.atan2(-vx, -vz) - o.rotation.y) * k;
  o.rotation.x += (Math.atan2(vy, Math.max(vh, 1e-3)) - Math.PI / 2 - o.rotation.x) * k;
  o.rotation.z *= 1 - k;
}
// feet position from the center of mass and the current orientation (Euler YXZ)
function placePeng(j) {
  const o = j.o, sx = Math.sin(o.rotation.x), cx = Math.cos(o.rotation.x);
  o.position.set(j.cx - PENG_H * sx * Math.sin(o.rotation.y), j.cy - PENG_H * cx, j.cz - PENG_H * sx * Math.cos(o.rotation.y));
}
// a small entry or exit splash for porpoising: ripple ring, a fleck of foam, a few drops
function plip(x, z, p) {
  sim.dot(x, z, 0.24, 0.45 * p, 0.16 * p);
  for (let i = 0; i < 3; i++) {
    if (droplets.length > 70) break;
    const d = grab('Droplet');
    const a = Math.random() * Math.PI * 2, rv = 0.5 + Math.random() * 0.8;
    d.position.set(x, 0.05, z);
    d.rotation.set(0, 0, 0);
    d.scale.setScalar(0.5 + Math.random() * 0.4);
    droplets.push({ o: d, vx: Math.cos(a) * rv, vz: Math.sin(a) * rv, vy: 1.6 + Math.random() * 1.6, spin: (Math.random() - 0.5) * 12, t: 0 });
  }
}

function launchPeng(j, bx) {
  const o = j.o;
  o.getWorldPosition(TMPV);
  const yaw = o.userData.ride.yaw;
  j.ob.o.remove(o); j.ob.rider = null; scene.add(o);
  o.rotation.set(0, yaw, 0);
  o.scale.setScalar(PENG_S);
  j.cx = TMPV.x; j.cy = TMPV.y + PENG_H; j.cz = TMPV.z;
  // splash down on its own side of the boat's line, timed so the first porpoise leap
  // crosses that line right at the bow: steer and it misses, hold course and it hits
  const side = Math.sign(TMPV.x - bx) || (Math.random() < 0.5 ? -1 : 1);
  j.dir = -side;
  const tx = Math.max(-CLAMP_X - 0.8, Math.min(CLAMP_X + 0.8, bx + side * PENG_SWIM * PENG_LEAD));
  const tz = -(speed + 0.5) * PENG_LEAD - 0.9;   // the bow
  const vy0 = Math.sqrt(2 * PENG_G * 1.35);          // apex ~1.35 m above the floe
  const T = (vy0 + Math.sqrt(vy0 * vy0 + 2 * PENG_G * Math.max(0, j.cy - 0.1))) / PENG_G;
  j.vx = (tx - j.cx) / T; j.vy = vy0;
  j.vz = Math.max(-1.5, Math.min(3, (tz - j.cz) / T - speed));   // relative to the water
  j.phase = 'leap'; j.t = 0;
  placePeng(j);
  snd.boing();
  pengAction(o, 'PengFly', { fade: 0.08, ts: 1.15 });
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
      freq: freq * (0.9 + Math.random() * 0.2), swim: swim * (0.85 + Math.random() * 0.3), baseX, lx: baseX, lz: atZ - i * 1.9 });
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

// ---------------------------------------------------------------- state
let state = 'loading';
let speed = 4, dist = 0, fishCount = 0, vx = 0, boost = 0, lunge = 0;
let best = +(localStorage.getItem('foxfloe_best') || 0);
let lifeM = +(localStorage.getItem('foxfloe_life_m') || 0);
let lifeFish = +(localStorage.getItem('foxfloe_life_fish') || 0);
let crashT = 0, shake = 0, rowPhase = 0, elapsed = 0, animT = 0;
// river sections
let secEnd = 200, curT = 0, narT = 0, rapT = 0, curN = 0, narN = 0, rapN = 0, rapFoamAcc = 0, section = 'calm';
// the river clock: the day advances with every meter, and keeps turning on the title
let dayM = 0;
// score juice
let bonus = 0, chain = 0, chainT = 0, mult = 1, nearMisses = 0;
let passedBest = false, lastMilestone = 0;
const vib = (p) => { try { if (navigator.vibrate && state === 'play' && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate(p); } catch (e) {} };
// micro-life
let earFlickT = 0, boatLean = 0, boatLeanV = 0;
// water flow accumulators
let flowZ = 0, driftX = 0, cloudDrift = 0;

function setState(s) {
  state = s;
  ui.setState(s);
}

function clearRiver() {
  for (const j of jumpers) if (j.phase !== 'alert') releasePenguin(j.o);
  jumpers.length = 0;
  for (const s of splashes) release(s.name, s.o);
  for (const d of droplets) release('Droplet', d.o);
  splashes.length = droplets.length = 0;
  for (const ob of obstacles) { if (ob.rider) releasePenguin(ob.rider); release(ob.name, ob.o); }
  for (const p of pickups) release('Fish', p.o);
  for (const d of decos) release(d.name, d.o);
  obstacles.length = pickups.length = decos.length = 0;
  for (const u of powerups) release(u.kind, u.o);
  powerups.length = 0;
}

function resetRun() {
  clearRiver();
  player.position.set(0, 0, 0);
  player.rotation.set(0, 0, 0);
  resetStats();
  secEnd = 200; curT = narT = rapT = 0; curN = narN = rapN = 0; section = 'calm';
  snowT = 0; earFlickT = 0; boatLean = 0; boatLeanV = 0;
  sim.clear();
  // pre-populate the river: fish school close ahead, then a full field of rows,
  // so the run starts busy instead of 15 empty seconds
  spawnFishArc(-20);
  spawnLily(-30);
  spawnFishArc(-40);
  for (let z = -58; z > SPAWN_Z + 4; z -= 10 + Math.random() * 5) spawnRow(z);
}
function resetStats() {
  speed = V0; dist = 0; fishCount = 0; vx = 0; aimOn = false; boost = 0; lunge = 0; drive = 0; surge = 0; spawnAcc = 0; difficulty = 0; elapsed = 0; gapX = 0;
  bonus = 0; chain = 0; chainT = 0; mult = 1; nearMisses = 0;
  shieldOn = false; magnetT = 0; invulnT = 0; airborne = false; airY = 0; airVy = 0;
  if (shieldMesh) shieldMesh.visible = false;
  passedBest = best <= 0; lastMilestone = 0;
}

// attract mode: the river runs with the fox steering itself
function enterTitle() {
  resetRun();
  dayM = 0;
  speed = DEMO_V;
  ui.title({ best, lifeM: Math.floor(lifeM), lifeFish });
  setState('title');
}

function start() {
  audioInit();
  const fromDemo = state === 'title';
  if (fromDemo) {
    // the demo hands over the oar: keep the river, reset the run, a beat of grace
    resetStats();
    secEnd = dist + 200;
    invulnT = 1.1;
  } else {
    resetRun();
  }
  dayM = 0;
  setState('play');
  doBoost(true);
  if (!localStorage.getItem('foxfloe_seen')) {
    localStorage.setItem('foxfloe_seen', '1');
    ui.coach();
  }
}

function totalScore() { return Math.floor(dist) + bonus; }

let demoSmashes = 0;
function smash(i) {
  const ob = obstacles[i];
  if (state === 'title') demoSmashes++;
  shieldOn = false; invulnT = 0.9;
  shieldMesh.visible = false;
  splash3D(ob.o.position.x, ob.o.position.z, 1.8);
  if (ob.rider) releasePenguin(ob.rider);
  release(ob.name, ob.o);
  obstacles.splice(i, 1);
  play('crunch', 0.55, 1.3); play('splashMid', 0.6, 0.95, 0.03);
  if (state === 'play') ui.pop('smash', true);
  vib(40);
  shake = Math.max(shake, 0.22);
}

// a power stroke: a tap or key press (kind unset), or the quiet demo / start stroke (kind true)
function doBoost(kind) {
  boost = Math.min(boost + 6, 12);
  lunge = 1;
  rowPhase = Math.ceil(rowPhase / Math.PI) * Math.PI + 0.2;  // snap into a fresh power stroke
  const bx = player.position.x;
  sim.stamp(bx - 0.5, 1.0, bx + 0.5, 2.2, 0.55, 1, 0.25);
  sim.dot(bx - 0.45, -0.9, 0.3, 0.9, -0.1);
  sim.dot(bx + 0.45, -0.9, 0.3, 0.9, -0.1);
  splash3D(bx, player.position.z + 1.2, 0.9);
  if (!kind) snd.boost(); else play('splashMid', 0.4, 1.05);
  vib(15);
}
// holding Space (or Up) is one sustained effort, not a string of taps: the drive eases in,
// holds and eases out, and speed, camera, spray, rowing tempo and the rush of sound follow it
const DRIVE_V = 7;       // m/s at full drive
let drive = 0, surge = 0; // surge = the burst from taps plus the drive, capped like a tap stack
function crash() {
  if (state !== 'play') return;
  snd.crash();
  vib([90, 40, 70]);
  shake = 0.55; crashT = 0;
  hitStop = 0.14;
  setState('crashing');
  splash3D(player.position.x, 0.4, 2.0);
  sim.dot(player.position.x, 0.2, 1.4, 1, 0.8);
  const sc = totalScore();
  const isBest = sc > best;
  if (isBest) { best = sc; localStorage.setItem('foxfloe_best', best); }
  lifeM += dist; lifeFish += fishCount;
  localStorage.setItem('foxfloe_life_m', Math.floor(lifeM));
  localStorage.setItem('foxfloe_life_fish', lifeFish);
  setTimeout(() => {
    ui.results({ score: sc, dist: Math.floor(dist), fish: fishCount, near: nearMisses, best, isBest });
    setState('over');
  }, 1000);
}

function togglePause() {
  if (state === 'play') setState('paused');
  else if (state === 'paused') { setState('play'); clock.getDelta(); }
}
function toggleSound() {
  setMuted(!isMuted());
  ui.setMuted(isMuted());
}
ui.bind({
  row: () => { audioInit(); if (state === 'title' || state === 'over') start(); else if (state === 'play') doBoost(); else if (state === 'paused') togglePause(); },
  pause: togglePause,
  sound: () => { audioInit(); toggleSound(); },
  restart: () => { if (state === 'paused' || state === 'play' || state === 'over') { setState('crashing'); start(); } },
  steer: (dir, on) => { padSteer = on ? dir : (padSteer === dir ? 0 : padSteer); },
});
ui.setMuted(isMuted());

// ---------------------------------------------------------------- input
const keys = {};
let padSteer = 0;
addEventListener('keydown', (e) => {
  // a focused button owns Space / Enter
  if ((e.code === 'Space' || e.code === 'Enter') && document.activeElement && document.activeElement.tagName === 'BUTTON') return;
  // ⌘ / Ctrl chords belong to the browser; on macOS a key released while ⌘ is down never reports
  // its keyup, so it must never count as held
  if (e.metaKey || e.ctrlKey) return;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'Enter') {
    if (state === 'title' || state === 'over') start();
    else if (state === 'play' && e.code !== 'Enter') doBoost();
    else if (state === 'paused') togglePause();
  }
  if (e.code === 'KeyR' && (state === 'over' || state === 'play' || state === 'paused')) { setState('crashing'); start(); }
  if (e.code === 'KeyM') { audioInit(); toggleSound(); }
  if (e.code === 'KeyP' && (state === 'play' || state === 'paused')) togglePause();
  if (e.code === 'Escape' && state === 'play') togglePause();
});
const releaseAll = () => { for (const k in keys) keys[k] = false; pointerOn = false; };
addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.key === 'Meta' || e.key === 'Control') releaseAll();
});
// anything released while the window was away would otherwise stay held
addEventListener('blur', releaseAll);

let pointerOn = false, pointerX = 0, pDownT = 0, pDownX = 0, pWasPlay = false, pointerId = -1, pointerDrag = false;
// a drag steers from wherever the finger lands, not from the middle of the screen: that point is
// zero, and the boat moves as far as the finger has moved from it. aimX is where the drag has put
// the boat; it outlives the finger so a quick swipe still lands, and a new drag carries on from it
const DRAG_GAIN = 0.035;   // meters of river per CSS pixel: about 320 px of drag crosses the whole river
let aimX = 0, aimFromX = 0, aimOn = false;
const screenEl = ui.screen;
screenEl.addEventListener('pointerdown', (e) => {
  if (pointerOn && e.pointerId !== pointerId) return;          // one steering finger at a time
  pointerOn = true; pointerId = e.pointerId; pointerX = e.clientX; pointerDrag = false;
  pDownT = performance.now(); pDownX = e.clientX; pWasPlay = state === 'play';
  aimFromX = e.clientX;
  // keep the release even if it happens outside the window
  try { screenEl.setPointerCapture(e.pointerId); } catch (err) {}
  if (state === 'title' || state === 'over') start();
});
addEventListener('pointermove', (e) => {
  if (!pointerOn || e.pointerId !== pointerId) return;
  // a mouse whose buttons are all up was released somewhere we never heard about
  if (e.pointerType === 'mouse' && e.buttons === 0) { pointerOn = false; return; }
  pointerX = e.clientX;
  if (Math.abs(e.clientX - pDownX) >= 14) pointerDrag = true;
});
addEventListener('pointerup', (e) => {
  if (!pointerOn || e.pointerId !== pointerId) return;
  pointerOn = false;
  // a quick tap (not a steering drag) is a paddle stroke
  if (pWasPlay && state === 'play' && performance.now() - pDownT < 220 && Math.abs(e.clientX - pDownX) < 14) doBoost();
});
addEventListener('pointercancel', (e) => { if (e.pointerId === pointerId) pointerOn = false; });
screenEl.addEventListener('lostpointercapture', (e) => { if (e.pointerId === pointerId) pointerOn = false; });
// steering follows a drag, or a finger held down past a tap (small nudges); a tap alone only rows
const pointerSteers = () => pointerOn && (pointerDrag || performance.now() - pDownT > 220);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { releaseAll(); if (state === 'play') setState('paused'); }
});

// ---------------------------------------------------------------- fx helpers
function splash3D(x, z, power = 1) {
  const name = power > 1.4 ? (Math.random() < 0.5 ? 'SplashA' : 'SplashC')
                           : (Math.random() < 0.5 ? 'SplashB' : 'SplashD');
  const o = grab(name);
  o.position.set(x, 0, z);
  o.rotation.y = Math.random() * Math.PI * 2;
  const s0 = 0.6 * power * (0.9 + Math.random() * 0.25);
  o.scale.set(s0 * 0.5, s0 * 0.25, s0 * 0.5);
  splashes.push({ o, name, t: 0, dur: 0.45 + power * 0.1, s0 });
  // a small fleck of foam and a strong ripple ring: the ring says splash, not ice
  sim.dot(x, z, 0.22 + power * 0.18, 0.62, 0.4 * power);
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

// wake emitters: last stamped point, advected with the world each frame
const emit = { l: { x: -0.3, z: 0.95 }, r: { x: 0.3, z: 0.95 }, bow: { x: 0, z: -0.9 } };
function trail(e, x, z, dz, r, foam, rip) {
  e.z += dz;
  sim.stamp(e.x, e.z, x, z, r, foam, rip, 0);
  e.x = x; e.z = z;
}

// autopilot for the attract demo: scores lanes ahead, prefers fish, avoids ice
function demoTarget(CLX) {
  let bestX = player.position.x, bestS = -1e9;
  for (let k = 0; k <= 16; k++) {
    const x = -CLX + (2 * CLX * k) / 16;
    let s = -Math.abs(x - player.position.x) * 0.35 - Math.abs(x) * 0.12;
    for (const ob of obstacles) {
      const oz = ob.o.position.z;
      if (oz > 2.5 || oz < -30) continue;
      const clear = Math.abs(ob.o.position.x - x) - ob.r - 0.75;
      if (clear < 0.6) s -= (0.6 - clear) * 40 * (1 + (oz + 30) / 30);
    }
    for (const j of jumpers) {
      if (j.phase === 'alert') continue;
      const oz = j.cz;
      if (oz > 2 || oz < -20) continue;
      const px = j.cx + j.vx * Math.max(0, -oz) / Math.max(4, speed);
      if (Math.abs(px - x) < 1.6 || Math.abs(j.cx - x) < 1.4) s -= 25;
    }
    for (const p of pickups) {
      const oz = p.o.position.z;
      if (oz > 0 || oz < -24) continue;
      if (Math.abs(p.o.position.x - x) < 0.8) s += 5 * (1 + oz / 24);
    }
    if (s > bestS) { bestS = s; bestX = x; }
  }
  return bestX;
}

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();
let hitStop = 0;
let lastW = 0, lastH = 0, sizeDirty = true;
// the canvas size is read only after something may have changed it: reading layout every frame
// forced the browser to lay the page out again each time the HUD text changed
function resize() {
  if (!sizeDirty) return;
  sizeDirty = false;
  const w = screenEl.clientWidth, h = screenEl.clientHeight;
  if (w === lastW && h === lastH) return;
  lastW = w; lastH = h;
  renderer.setSize(w, h);
  post.setSize(w, h);
  const db = renderer.getDrawingBufferSize(new THREE.Vector2());
  depthPre.setSize(db.x, db.y);
  WU.uRes.value.copy(db);
  post.final.uniforms.uRes.value.copy(db);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
const markResize = () => { sizeDirty = true; };
ui.onLayout(markResize);
addEventListener('resize', markResize);
if (window.ResizeObserver) new ResizeObserver(markResize).observe(screenEl);

// adaptive resolution: a notch down while frames miss 50 fps, and a careful notch back up after a
// few seconds at full rate (a step up that turns out too slow is undone and not retried for a while)
let perfT = 0, perfN = 0, perfGood = 0, perfUpBlock = 0;
const PR_MAX = Q.dpr, PR_MIN = Math.min(1, Q.dpr);
function watchPerf(raw) {
  if (state !== 'play' && state !== 'title') { perfT = perfN = 0; return; }
  perfT += raw; perfN++;
  perfUpBlock = Math.max(0, perfUpBlock - raw);
  if (perfT < 2) return;
  const avg = perfT / perfN;
  perfT = perfN = 0;
  const pr = renderer.getPixelRatio();
  let next = pr;
  if (avg > 1 / 50 && pr > PR_MIN) { next = Math.max(PR_MIN, pr - 0.25); perfGood = 0; perfUpBlock = 20; }
  else if (avg < 1 / 57 && pr < PR_MAX && perfUpBlock <= 0) { if (++perfGood >= 3) { next = Math.min(PR_MAX, pr + 0.25); perfGood = 0; } }
  else perfGood = 0;
  if (next !== pr) {
    renderer.setPixelRatio(next);
    post.composer.setPixelRatio(next);
    lastW = lastH = 0; sizeDirty = true;
  }
}

let frozen = false;   // debug: hold the simulation so frame-stepped captures stay exact
function tick() {
  requestAnimationFrame(tick);
  const raw = clock.getDelta();
  if (frozen) return;
  watchPerf(raw);
  update(Math.min(raw, 0.05));
}

function update(dt) {
  resize();
  if (!player || state === 'loading') { draw(); return; }
  // paused: the world holds still; the camera keeps easing so a resize still frames the boat
  if (state === 'paused') { setDrive(0); updateCamera(dt); draw(); return; }
  if (hitStop > 0) { hitStop -= dt; dt *= 0.08; }

  const playing = state === 'play';
  const demo = state === 'title';
  const drifting = state === 'over';
  const pull = playing && (keys.Space || keys.ArrowUp) ? 1 : 0;
  drive += (pull - drive) * Math.min(1, dt * (pull ? 3.2 : 2.4));
  if (drive < 0.002) drive = 0;
  surge = Math.min(12, boost + drive * DRIVE_V);
  setDrive(drive);
  if (playing) {
    elapsed += dt;
    difficulty = Math.min(1, elapsed / 95);
    speed = Math.min(VMAX, V0 + elapsed * VRAMP) + surge + rapN * 3.4;
    if (dist > secEnd) rollSection();
    magnetT = Math.max(0, magnetT - dt);
    chainT -= dt;
    if (chainT <= 0 && chain > 0) { chain = 0; mult = 1; }
  } else if (demo) {
    speed += (DEMO_V + boost + rapN * 2 - speed) * Math.min(1, dt * 2);
    if (dist > secEnd) rollSection();
  } else if (drifting) {
    speed += (2.2 - speed) * Math.min(1, dt * 1.5);
  }
  boost = boost > 0.05 ? boost * Math.exp(-1.7 * dt) : 0;
  lunge = Math.max(0, lunge - dt * 2.0);
  invulnT = Math.max(0, invulnT - dt);
  curN += (curT - curN) * Math.min(1, dt * 0.35);
  narN += (narT - narN) * Math.min(1, dt * 0.35);
  rapN += (rapT - rapN) * Math.min(1, dt * 0.5);
  const rowRate = drifting ? 3.6 : 5.2 + speed * 0.12 + drive * 2.4;
  if (playerMixer && state !== 'crashing') playerMixer.update(dt * rowRate / (2 * Math.PI));

  // ---- steering
  const CLX = CLAMP_X - narN;
  if (playing || demo) {
    let target = 0;
    if (playing) {
      if (keys.KeyA || keys.ArrowLeft || padSteer < 0) target -= 7.2;
      if (keys.KeyD || keys.ArrowRight || padSteer > 0) target += 7.2;
      if (target) {
        // the keys take over; a drag after them starts from wherever the boat is then
        aimOn = false; aimFromX = pointerX;
      } else {
        if (pointerSteers()) {
          if (!aimOn) { aimX = player.position.x; aimOn = true; }
          aimX += (pointerX - aimFromX) * DRAG_GAIN;
          aimFromX = pointerX;
        }
        if (aimOn) {
          // clamped every frame, so a drag pushed past a bank answers the moment it turns back
          aimX = Math.max(-CLX, Math.min(CLX, aimX));
          target = Math.max(-7.2, Math.min(7.2, (aimX - player.position.x) * 5));
          if (!pointerOn && Math.abs(aimX - player.position.x) < 0.03 && Math.abs(vx) < 0.3) aimOn = false;
        }
      }
    } else {
      const tx = demoTarget(CLX);
      target = Math.max(-6, Math.min(6, (tx - player.position.x) * 3.2));
      if (Math.random() < dt * 0.5) doBoost(true);
    }
    vx += (target - vx) * Math.min(1, dt * (airborne ? 4 : 7));
    player.position.x = Math.max(-CLX, Math.min(CLX, player.position.x + (vx + curN) * dt));
    if (Math.abs(player.position.x) >= CLX) vx *= 0.4;
  } else if (drifting) {
    vx *= 0.95;
  }

  // ---- ramp air
  if (airborne) {
    airVy -= 10.5 * dt;
    airY += airVy * dt;
    if (airY <= 0) {
      airY = 0; airborne = false;
      splash3D(player.position.x, 0.8, 1.5);
      play('splashBig', 0.7, 1);
      vib(20);
      shake = Math.max(shake, 0.18);
    }
  }

  // ---- rowing animation
  if (state !== 'crashing') {
    rowPhase += dt * rowRate;
    const s = Math.sin(rowPhase);
    boatLeanV += ((-vx * 0.034) - boatLean) * dt * 26 - boatLeanV * dt * 7;
    boatLean = Math.max(-0.3, Math.min(0.3, boatLean + boatLeanV * dt));
    player.rotation.z = boatLean + s * 0.035;
    player.rotation.y = -vx * 0.03 - curN * 0.05;
    player.rotation.x = Math.sin(rowPhase * 0.5) * 0.012 - lunge * 0.15 - drive * 0.045
      - (airborne ? Math.max(-0.4, Math.min(0.5, airVy * 0.07)) : 0);
    player.position.y = Math.sin(rowPhase * 2) * 0.022 + lunge * 0.04 + airY
      + (airborne ? 0 : waveY(player.position.x, 0) * 0.7);
    const flick = earFlickT > 0 ? Math.sin((0.7 - earFlickT) * 28) * 0.35 * earFlickT : 0;
    earFlickT = Math.max(0, earFlickT - dt);
    if (spineB) spineB.rotation.x -= lunge * 0.45 + drive * 0.12;
    if (earLB && flick) { earLB.rotation.z += flick; earRB.rotation.z -= flick; }
    if ((playing || demo) && Math.sin(rowPhase - 0.4) < 0 && Math.sin(rowPhase - 0.4 + dt * 6) >= 0) {
      if (playing) snd.row(drive);
      oar.updateWorldMatrix(true, false);
      TMPV.set(0, 0, -0.8).applyMatrix4(oar.matrixWorld);
      sim.dot(TMPV.x, TMPV.z + 0.2, 0.28 + drive * 0.1, 0.75, 0.22 + drive * 0.2);
      // a hard pull leaves rings with every stroke: one from the blade, one pushed out from the stern
      if (drive > 0.2) sim.stamp(player.position.x - 0.35, 1.2, player.position.x + 0.35, 1.6, 0.5, 0.3, 0.3 * drive);
      const nd = speed > 4 ? 1 + Math.round(drive * 2) : 0;
      for (let k = 0; k < nd && droplets.length < 66; k++) {
        const d = grab('Droplet');
        d.position.copy(TMPV);
        d.rotation.set(0, 0, 0);
        d.scale.setScalar(0.5 + Math.random() * 0.3);
        droplets.push({ o: d, vx: (Math.random() - 0.5) * 0.8, vz: 0.6 + Math.random() * 0.8 + drive * 0.6,
          vy: 0.8 + Math.random() + drive * 0.5, spin: (Math.random() - 0.5) * 10, t: 0 });
      }
    }
  } else {
    crashT += dt;
    speed = Math.max(0, speed - dt * 26);
    player.rotation.z += dt * 7 * (1 - Math.min(1, crashT));
    player.rotation.x = Math.min(0.5, player.rotation.x + dt * 1.2);
    player.position.y = Math.max(-0.25, player.position.y - dt * 0.3);
  }

  const dz = speed * dt;
  const bx = player.position.x;

  // ---- wake: continuous foam trails from the hull, ripples from the bow, the boat's shadow
  if (state !== 'crashing' && !airborne) {
    const fo = Math.min(1, 0.55 + speed * 0.04);
    const wr = 0.2 + drive * 0.05;
    trail(emit.l, bx - 0.36 + boatLean * 0.3, 0.95, dz, wr, fo, 0.006);
    trail(emit.r, bx + 0.36 + boatLean * 0.3, 0.95, dz, wr, fo, 0.006);
    trail(emit.bow, bx, -0.95, dz, 0.16, 0.45, -0.018);
  } else {
    emit.l.x = bx - 0.36; emit.r.x = bx + 0.36; emit.bow.x = bx;
    emit.l.z = emit.r.z = 0.95; emit.bow.z = -0.95;
  }
  sim.stamp(bx - 0.22, -0.95, bx - 0.22, 0.85, 0.5 + airY * 0.08, 0, 0, Math.max(0.15, 0.8 - airY * 0.25));

  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i]; s.t += dt;
    const k = s.t / s.dur;
    s.o.position.z += dz;
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
    d.o.position.z += d.vz * dt + dz;
    d.o.rotation.x += d.spin * dt;
    if (d.o.position.y <= 0 || d.t > 1.6) {
      if (Math.random() < 0.35) sim.dot(d.o.position.x, d.o.position.z, 0.14, 0.4, 0.09);
      release('Droplet', d.o); droplets.splice(i, 1);
    }
  }
  if (sprayL) {
    const base = airborne || state === 'crashing' ? 0 : Math.max(0, (speed - 5) / 14);
    const flut = 1 + Math.sin(rowPhase * 3.1) * 0.07;
    const fR = Math.min(1.6, base * (1 + Math.max(0, -vx) * 0.05) * (1 + lunge * 0.9 + drive * 0.35) * flut);
    const fL = Math.min(1.6, base * (1 + Math.max(0, vx) * 0.05) * (1 + lunge * 0.9 + drive * 0.35) * (2 - flut));
    sprayR.visible = fR > 0.06; sprayL.visible = fL > 0.06;
    sprayR.scale.set(1.15 * fR, fR, 1.25 * fR);
    sprayL.scale.set(-1.15 * fL, fL, 1.25 * fL);
  }
  if (shieldMesh && shieldMesh.visible) {
    shieldMesh.material.opacity = 0.16 + Math.sin(animT * 6) * 0.05;
    shieldMesh.scale.setScalar(1 + Math.sin(animT * 4) * 0.03);
  }

  // ---- world conveyor
  if (playing || demo) {
    dist += dz;
    dayM += dz;
    spawnAcc += dz;
    const interval = 9.2 - difficulty * 3.4;
    if (spawnAcc >= interval) { spawnAcc = 0; spawnRow(); }
  } else {
    dayM += dz * 0.3;
  }
  flowZ += dz;
  driftX += curN * dt;

  for (const b of banks) {
    b.g.position.z += dz;
    b.g.position.x = b.side * (BANK_X - narN * 0.9);
    if (b.g.position.z > 34) { b.g.position.z -= MODULES_PER_SIDE * MODULE_LEN; if (!bankQueue.includes(b)) bankQueue.push(b); }
    if (b.g.position.z > -70) for (const d of b.deco) if (d.kind === 'peng' && d.o.visible) bankPeng(d.o, dt);
  }
  // recycled modules land far out in the haze: re-dress one per frame, never both sides at once
  if (bankQueue.length) shuffleModule(bankQueue.shift());
  terrain.update(dz, narN);
  for (let i = powerups.length - 1; i >= 0; i--) {
    const u = powerups[i]; u.t += dt;
    u.o.position.z += dz;
    if (u.kind !== 'Ramp') {
      u.o.position.y = 0.05 + Math.sin(u.t * 3) * 0.06 + waveY(u.o.position.x, u.o.position.z) * 0.8;
      u.o.rotation.y += dt * 1.7;
      if (Math.random() < dt * 0.8) sim.dot(u.o.position.x, u.o.position.z, 0.2, 0.3, 0.12);
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
    if (ob.rider && !ob.jumpT) rideUpdate(ob, dt);
    if (ob.o.position.z > DESPAWN_Z) {
      if (ob.rider) releasePenguin(ob.rider);
      release(ob.name, ob.o); obstacles.splice(i, 1);
    }
  }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.t += dt;
    if (magnetT > 0) {
      const ddx = p.o.position.x - bx, ddz = p.o.position.z;
      if (ddx * ddx + ddz * ddz < 190) {
        p.baseX += (bx - p.baseX) * Math.min(1, dt * 5);
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
    // a thin wake behind each fish
    p.lz += dz;
    if (p.o.position.z > -45) sim.stamp(p.lx, p.lz, p.o.position.x, p.o.position.z, 0.1, 0.75, 0.012);
    p.lx = p.o.position.x; p.lz = p.o.position.z;
    if (p.o.position.z > DESPAWN_Z) { release('Fish', p.o); pickups.splice(i, 1); }
  }
  for (let i = decos.length - 1; i >= 0; i--) {
    const d = decos[i];
    d.o.position.z += dz;
    d.o.position.y = waveY(d.o.position.x, d.o.position.z) * 0.9;
    if (d.o.position.z > DESPAWN_Z) { release(d.name, d.o); decos.splice(i, 1); }
  }
  // ---- penguin ambushes: turn and crouch on the floe, hop in ahead of the boat, porpoise across its lane
  if (playing || demo) {
    // alert (0.6 s) + a ~0.95 s hop + the lead to the first leap: start when the floe is that far out
    const trigZ = -(speed + 0.5) * PENG_LEAD - 0.9 - (speed + 0.8) * 0.95 - 0.6 * speed;
    for (const ob of obstacles) {
      if (!ob.rider || ob.jumpT) continue;
      const oz = ob.o.position.z;
      if (oz > trigZ && oz < trigZ + 8 && Math.abs(ob.o.position.x - bx) < 6) {
        ob.jumpT = true;
        const j = { o: ob.rider, ob, phase: 'alert', t: 0, vx: 0, vy: 0, vz: 0, dir: 1, cx: 0, cy: 0, cz: 0,
          under: false, subT: 0, leaps: 0, maxLeaps: Math.random() < 0.6 ? 3 : 2, lx: 0, lz: 0, crouched: false };
        ob.rider.userData.jumper = j;
        jumpers.push(j);
        if (playing) { snd.wekWek(); vib(30); }
        earFlickT = 0.7;
      }
    }
  }
  for (let i = jumpers.length - 1; i >= 0; i--) {
    const j = jumpers[i], o = j.o;
    j.t += dt;
    if (j.phase === 'alert') {
      if (j.ob.rider !== o || o.userData.jumper !== j) { jumpers.splice(i, 1); continue; }   // its floe was smashed or drifted off
      if (o.userData.mixer) o.userData.mixer.update(dt);
      // the tell: turn to face the boat's line, then a crouch that loads the hop
      const u = o.userData.ride, s = j.ob.o.scale.x;
      o.getWorldPosition(TMPV);
      u.yaw += wrapA(Math.atan2(-(bx - TMPV.x), -2.5) - u.yaw) * Math.min(1, dt * 10);
      o.rotation.set(0, u.yaw - j.ob.o.rotation.y, 0);
      o.position.y = u.y0;
      if (j.t > 0.2 && !j.crouched) { j.crouched = true; pengAction(o, 'PengCrouch', { once: true, fade: 0.1 }); }
      const k = smooth01((j.t - 0.25) / 0.35);
      o.scale.set((1 + 0.1 * k) * PENG_S / s, (1 - 0.22 * k) * PENG_S / s, (1 + 0.1 * k) * PENG_S / s);
      if (j.t >= 0.6) launchPeng(j, bx);
      continue;
    }
    if (o.userData.mixer) o.userData.mixer.update(dt);
    j.cx += j.vx * dt;
    j.cz += j.vz * dt + dz;
    if (j.phase === 'leap') {
      j.vy -= PENG_G * dt;
      j.cy += j.vy * dt;
      orientPeng(o, j.vx, j.vy, j.vz, dt, 9);
      const st = Math.max(0, 1 - j.t / 0.3);                    // takeoff stretch, relaxed by the apex
      o.scale.set(PENG_S * (1 - 0.09 * st), PENG_S * (1 + 0.18 * st), PENG_S * (1 - 0.09 * st));
      // its shadow sharpens on the water where it will land
      const hgt = Math.max(0, j.cy);
      sim.dot(j.cx, j.cz, 0.32 + hgt * 0.06, 0, 0, Math.max(0.2, 0.9 - hgt * 0.2));
      if (j.cy <= 0.1 && j.vy < 0) {
        // headfirst entry, then on under the surface
        splash3D(j.cx, j.cz, 0.95);
        snd.pengLand();
        j.phase = 'swim'; j.t = 0; j.under = true; j.subT = PENG_UNDER;
        j.vx = j.dir * PENG_SWIM; j.vz = 0.5; j.vy = 0;
        j.lx = j.cx; j.lz = j.cz;
        o.scale.setScalar(PENG_S);
        pengAction(o, 'PengFly', { fade: 0.2, ts: 1.7 });
      }
    } else if (j.phase === 'swim') {
      j.lz += dz;
      if (j.under) {
        j.subT -= dt;
        j.cy += (-0.3 - j.cy) * Math.min(1, dt * 12);
        orientPeng(o, j.vx, 0, j.vz, dt, 12);
        sim.stamp(j.lx, j.lz, j.cx, j.cz, 0.16, 0.3, -0.01);     // the V of a swimmer just under the surface
        if (j.subT <= 0) {
          const across = (j.cx - bx) * j.dir;                     // > 0 once past the boat's line
          if (j.leaps >= j.maxLeaps || across > 2.6 || Math.abs(j.cx) > CLAMP_X + 0.4) { j.phase = 'gone'; j.t = 0; }
          else { j.under = false; j.cy = -0.05; j.vy = PENG_HOP; j.leaps++; plip(j.cx, j.cz, 0.7); }
        }
      } else {
        j.vy -= PENG_G * dt;
        j.cy += j.vy * dt;
        orientPeng(o, j.vx, j.vy, j.vz, dt, 14);
        if (j.cy <= -0.05 && j.vy < 0) {
          j.under = true; j.subT = 0.14 + Math.random() * 0.1;
          plip(j.cx, j.cz, 1);
          play('plop', 0.3, 1.1 + Math.random() * 0.2);
        }
      }
      j.lx = j.cx; j.lz = j.cz;
    } else {
      // gone: one last dive, out of sight
      j.cy -= 3.2 * dt;
      orientPeng(o, j.vx, -3.2, j.vz, dt, 10);
      if (j.cy < -1.4) { releasePenguin(o); jumpers.splice(i, 1); continue; }
    }
    placePeng(j);
    if (j.cz > DESPAWN_Z) { releasePenguin(o); jumpers.splice(i, 1); }
  }

  setRapidsLevel(rapN);
  // rapids chop: short bursts of spray off the standing waves (the whitewater itself is drawn by the water)
  if (rapN > 0.3 && (playing || demo)) {
    rapFoamAcc += dt * 6 * rapN;
    while (rapFoamAcc > 1) {
      rapFoamAcc -= 1;
      plip((Math.random() * 2 - 1) * (CLAMP_X - narN + 0.6), -8 - Math.random() * 40, 0.8);
    }
  }

  // ---- visual life: weather
  snowN += (snowT - snowN) * Math.min(1, dt * 0.4);
  snowMat.opacity = 0.85 * snowN;
  if (snowN > 0.02) {
    const pa = snowGeo.attributes.position;
    for (let k = 0; k < SNOW_N; k++) {
      let x = pa.getX(k), y = pa.getY(k), z = pa.getZ(k);
      y -= snowSpd[k] * dt;
      x += Math.sin(animT * 1.3 + k) * 0.3 * dt;
      z += dz * 0.35;
      if (y < 0) { y = 10 + Math.random(); x = (Math.random() * 2 - 1) * 14; }
      if (z > 14) z = -80;
      pa.setXYZ(k, x, y, z);
    }
    pa.needsUpdate = true;
  }
  for (let k = 0; k < mistPlanes.length; k++) {
    const m = mistPlanes[k];
    m.material.opacity = rapN * 0.12 + pal.duskF * 0.05;
    if (m.material.opacity > 0.005) {
      m.position.z += dz * 0.45;
      if (m.position.z > 16) m.position.z -= 100;
    }
  }
  for (const f of flames) {
    const k = 1 + Math.sin(animT * 13 + f.ph) * 0.22;
    f.m.scale.set(1 + Math.sin(animT * 9 + f.ph) * 0.1, k, 1);
  }

  // ---- collisions (boat approximated as a segment on z)
  if (playing || demo) {
    if (!airborne && invulnT <= 0) {
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const ob = obstacles[i];
        const oz = ob.o.position.z, ox = ob.o.position.x;
        if (oz < -4 || oz > 4) {
          if (oz > 4 && !ob.nm) {
            ob.nm = true;
            if (playing && ob.md < 0.55) { bonus += 8; nearMisses++; ui.pop('close  +8'); vib(10); }
          }
          continue;
        }
        const cz = Math.max(-0.9, Math.min(0.8, oz));
        const dx2 = (ox - bx) ** 2 + (oz - cz) ** 2;
        const rr = ob.r + 0.52;
        const clear = Math.sqrt(dx2) - rr;
        if (clear < ob.md) ob.md = clear;
        if (dx2 < rr * rr) { if (shieldOn || demo) smash(i); else crash(); break; }
      }
      for (let i = jumpers.length - 1; i >= 0; i--) {
        const j = jumpers[i];
        const exposed = (j.phase === 'leap' && j.cy < 1.0) || (j.phase === 'swim' && !j.under);
        if (!exposed) continue;
        const oz = j.cz, ox = j.cx;
        if (oz < -3 || oz > 3) continue;
        const cz = Math.max(-0.9, Math.min(0.8, oz));
        const rr = PENG_R + 0.52;
        if ((ox - bx) ** 2 + (oz - cz) ** 2 < rr * rr) {
          if (shieldOn || demo) {
            shieldOn = false; invulnT = 0.9; shieldMesh.visible = false;
            splash3D(ox, oz, 1.4);
            releasePenguin(j.o); jumpers.splice(i, 1);
            play('crunch', 0.5, 1.35); if (playing) ui.pop('bonk', true); vib(40);
          } else crash();
          break;
        }
      }
    } else if (invulnT > 0 && playing) {
      // grace after the handover: ice in the way breaks instead of ending the run
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const ob = obstacles[i], oz = ob.o.position.z;
        if (oz < -2 || oz > 2) continue;
        const rr = ob.r + 0.52;
        if ((ob.o.position.x - bx) ** 2 + (oz - Math.max(-0.9, Math.min(0.8, oz))) ** 2 < rr * rr) { const sh = shieldOn; smash(i); shieldOn = sh; shieldMesh.visible = sh; }
      }
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      const oz = p.o.position.z, ox = p.o.position.x;
      if (oz < -3 || oz > 3) continue;
      const cz = Math.max(-1.0, Math.min(0.9, oz));
      if (airY < 0.5 && (ox - bx) ** 2 + (oz - cz) ** 2 < 1.1) {
        if (playing) {
          fishCount++;
          chain++; chainT = 2.4;
          mult = Math.min(5, 1 + Math.floor(chain / 3));
          const pts = 25 * mult;
          bonus += pts;
          ui.fish(pts, mult);
          snd.ding(mult);
          vib(12);
        }
        splash3D(ox, oz, 0.75);
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
          if (playing) ui.pop('air', true);
          vib(15);
        }
        continue;
      }
      const cz = Math.max(-1.0, Math.min(0.9, oz));
      if ((ox - bx) ** 2 + (oz - cz) ** 2 < 1.1) {
        if (playing) {
          if (u.kind === 'Thermos') { shieldOn = true; shieldMesh.visible = true; ui.pop('shield'); }
          else { magnetT = 8; ui.pop('fish magnet'); }
          snd.powerup();
          vib(25);
        }
        release(u.kind, u.o);
        powerups.splice(i, 1);
      }
    }
    if (playing) {
      if (!passedBest && totalScore() > best) { passedBest = true; ui.call('new best'); ui.announce('new best'); snd.best(); vib([20, 30, 20]); }
      const ms = Math.floor(dist / 250);
      if (ms > lastMilestone) { lastMilestone = ms; ui.call((ms * 250).toLocaleString('en-US') + ' m'); snd.milestone(); }
    }
  }

  // ---- time of day, sky, water, lights
  animT += dt;
  samplePalette(dayM / DAY_LEN);
  applyPalette(dt);

  // ---- camera
  updateCamera(dt);

  // ---- water uniforms + simulation step
  WU.uTime.value = animT;
  WU.uFlow.value = flowZ;
  WU.uDrift.value = driftX;
  WU.uSlant.value = curN / Math.max(4, speed);
  WU.uBankX.value = BANK_X - 0.5 - narN * 0.9;
  WU.uRapids.value = rapN;
  WU.uBoat.value.set(bx, 0, pal.night > 0.5 ? (pal.night - 0.5) * 2 : 0, 0);
  sim.step(dt, dz, curN * dt);
  WU.uSim.value = sim.texture;

  // ---- HUD
  if (playing || state === 'crashing') {
    ui.hud({ score: totalScore(), dist: Math.floor(dist), fish: fishCount, mult, chain: chain > 0 ? Math.max(0, chainT / 2.4) : 0,
      shield: shieldOn, magnet: magnetT / 8 });
  }
  // words that belong to the boat float from just above it
  TMPV.set(player.position.x, player.position.y + 1.5, player.position.z).project(camera);
  ui.anchor((TMPV.x * 0.5 + 0.5) * lastW, (-TMPV.y * 0.5 + 0.5) * lastH);
  ui.tone(0.2126 * pal.mid.r + 0.7152 * pal.mid.g + 0.0722 * pal.mid.b);

  draw();
}

function waveY(x, z) { return Math.sin(x * 0.45 + animT * 0.9) * 0.05 + Math.sin(z * 0.30 - animT * 1.15) * 0.06; }

function applyPalette(dt) {
  scene.fog.color.copy(pal.fog);
  scene.background.copy(pal.hor);
  hemi.color.copy(pal.hemiS); hemi.groundColor.copy(pal.hemiG); hemi.intensity = pal.hi;
  key.color.copy(pal.key); key.intensity = pal.ki;
  rim.color.copy(pal.rim); rim.intensity = pal.ri;
  rim.position.set(Math.sin(pal.sunAz) * 12, 6 + Math.max(0, pal.sunEl) * 20, -12);
  rimU.value.set(pal.rim.r, pal.rim.g, pal.rim.b, pal.rimA);
  const night = pal.night;
  if (lantern) {
    lantern.intensity = Math.max(0, night - 0.4) * 1.7 * (2.0 + Math.sin(animT * 11) * 0.3 + Math.sin(animT * 23) * 0.15);
    lanternMesh.visible = night > 0.45;
  }
  cloudDrift += dt * 0.004;
  sky.update(camera, pal, animT, cloudDrift);
  ranges.update(camera, pal, bendU.value.x);
  WU.uDeep.value.copy(pal.deep); WU.uShal.value.copy(pal.shal); WU.uRefl.value.copy(pal.refl);
  WU.uInk.value.copy(pal.ink); WU.uFogC.value.copy(pal.fog); WU.uSunC.value.copy(pal.sun);
  WU.uFogR.value.set(scene.fog.near, scene.fog.far);
  WU.uSunDir.value.copy(sky.uniforms.uSunVis.value > 0.1 ? sky.uniforms.uSunDir.value : sky.uniforms.uMoonDir.value);
  WU.uNight.value = night;
  WU.uAurora.value = pal.aurora;
  const F = post.final.uniforms;
  F.uNight.value = night;
  F.uTime.value = animT;
  F.uSpeed.value = Math.min(1, surge / 10) * (state === 'play' ? 1 : 0);
  F.uSplit.value = state === 'crashing' ? Math.max(0, 1 - crashT * 2) : 0;
  if (post.bloom) post.bloom.strength = 0.1 + night * 0.35 + pal.duskF * 0.12;
  // the winding river: a slow swing, leaning into side currents
  const swing = Math.sin(flowZ * 0.0045) * 0.0011 + Math.sin(flowZ * 0.0017 + 1.3) * 0.0007;
  bendU.value.x += ((swing - curN * 0.00035) - bendU.value.x) * Math.min(1, dt * 0.8);
}

// ---------------------------------------------------------------- camera
const camPos = new THREE.Vector3(0, 4.3, 14.5), camLook = new THREE.Vector3(0, 1, -20);
// reduced motion keeps the camera steady: no shake, no rapids jitter
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionScale = reduceMotion.matches ? 0 : 1;
reduceMotion.addEventListener?.('change', (e) => { motionScale = e.matches ? 0 : 1; });
const tgtPos = new THREE.Vector3(), tgtLook = new THREE.Vector3();
let camRoll = 0;
function updateCamera(dt) {
  shake = Math.max(0, shake - dt);
  const jolt = state === 'paused' ? 0 : motionScale;
  const sx = ((shake > 0 ? (Math.random() - 0.5) * shake * 0.9 : 0) + (Math.random() - 0.5) * 0.07 * rapN) * jolt;
  const sy = ((shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0) + (Math.random() - 0.5) * 0.04 * rapN) * jolt;
  const bx = player.position.x;
  const portrait = camera.aspect < 0.8;
  let rate = 10;
  if (state === 'over' || (state === 'crashing' && crashT > 0.5)) {
    // the Blender orbit, centered on the crash
    if (orbitMixer) orbitMixer.update(dt * 0.6);
    tgtPos.copy(orbitCam ? orbitCam.position : TMPV.set(3, 2.6, 6)).add(TMPV.set(bx, 0.4, 0));
    tgtLook.set(bx, 0.55, 0);
    rate = 2.2;
  } else if (state === 'title') {
    // attract mode: low across the water, the fox small against the valley
    tgtPos.set(bx * 0.3, 4.3, 14.5);
    tgtLook.set(bx * 0.4, portrait ? 2.9 : 0.9, -20);
    rate = 2.5;
  } else {
    tgtPos.set(bx * 0.5, 7.0, 9.5);
    tgtLook.set(bx * 0.72 + curN * 0.45, 0.4, -7);
    rate = state === 'play' ? 14 : 4;
  }
  const k = 1 - Math.exp(-dt * rate);
  camPos.lerp(tgtPos, k); camLook.lerp(tgtLook, k);
  camera.position.copy(camPos); camera.position.x += sx; camera.position.y += sy;
  camRoll += ((state === 'play' ? -vx * 0.006 : 0) - camRoll) * Math.min(1, dt * 5);
  camera.up.set(Math.sin(camRoll), Math.cos(camRoll), 0);
  camera.lookAt(camLook);
  const bf = (portrait ? 66 : 55) + surge * 0.55 + rapN * 2;
  if (Math.abs(camera.fov - bf) > 0.05) { camera.fov = bf; camera.updateProjectionMatrix(); }
  bendU.value.w = camera.position.z;
  sky.mesh.position.copy(camera.position);
}

// ---------------------------------------------------------------- render
function draw() {
  depthPre.render(scene, camera);
  post.render();
}
tick();

// debug handle
window.__ff = {
  get state() { return state; },
  get score() { return totalScore(); },
  get dist() { return dist; },
  get fish() { return fishCount; },
  get counts() { return { obstacles: obstacles.length, pickups: pickups.length, jumpers: jumpers.length, fx: splashes.length + droplets.length, speed: +speed.toFixed(1), sfx: sfxCount(), pools: [...pools.entries()].map(([k, v]) => k + ':' + v.length).join(' ') }; },
  boost: () => doBoost(),
  templates: TEMPLATE_NAMES,
  clips: () => animClips.map((c) => c.name),
  start, forceCrash: () => crash(),
  step: (dt = 1 / 60) => update(dt),
  freeze: (on = true) => { frozen = on; },
  meter,
  // debug: the render pieces, for switching parts off while profiling
  dbg: { post, depthPre, water, sky, ranges, banks, snd, setDrive, audioState, get terrain() { return terrain; } },
  // debug: render the frozen world from any viewpoint
  look: (pos, at) => { camera.position.set(...pos); camera.up.set(0, 1, 0); camera.lookAt(...at); bendU.value.w = camera.position.z; sky.mesh.position.copy(camera.position); draw(); },
  renderer, scene, camera, ui,
  get demoSmashes() { return demoSmashes; },
  cheat: {
    dist: (m) => { dist = m; dayM = m; },
    day: (p) => { dayM = p * DAY_LEN; },
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
    // a floe with a penguin at (x, z), for inspecting the ambush
    peng: (x = 1.5, z = -34, name = 'FloeA') => {
      const o = grab(name);
      o.scale.setScalar(1.1); o.rotation.y = 0.4; o.position.set(x, 0, z);
      const rider = grab('Penguin');
      seatRider(rider, name, 1.1);
      o.add(rider);
      pengAction(rider, 'PengIdle', { fade: 0 });
      obstacles.push({ name, o, r: FLOE_R[name] * 1.1 * 0.92, spin: 0, rider, jumpT: false, md: 9, nm: false });
    },
    clearAhead: () => { for (const ob of obstacles) { if (ob.rider) releasePenguin(ob.rider); release(ob.name, ob.o); } obstacles.length = 0; },
    get env() { return { nightF: +pal.night.toFixed(2), curN: +curN.toFixed(2), narN: +narN.toFixed(2), rapN: +rapN.toFixed(2), bonus, mult, nearMisses, shieldOn, magnetT: +magnetT.toFixed(1), airborne, dayM: Math.floor(dayM) }; },
  },
};

// installable + offline when served from a real host (never during local dev)
if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
