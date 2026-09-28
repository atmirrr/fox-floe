const CACHE = 'foxfloe-v19';
const ASSETS = [
  './', './index.html', './style.css', './game.js', './assets.glb', './manifest.json',
  './icon-192.png', './icon-512.png',
  './src/audio.js', './src/bend.js', './src/icons.js', './src/palette.js', './src/post.js', './src/print.js',
  './src/sky.js', './src/terrain.js', './src/ui.js', './src/water.js',
  './vendor/three.module.js', './vendor/loaders/GLTFLoader.js', './vendor/utils/BufferGeometryUtils.js',
  './vendor/utils/SkeletonUtils.js',
  './vendor/postprocessing/Pass.js', './vendor/postprocessing/MaskPass.js',
  './vendor/postprocessing/ShaderPass.js', './vendor/postprocessing/RenderPass.js',
  './vendor/postprocessing/EffectComposer.js', './vendor/postprocessing/UnrealBloomPass.js',
  './vendor/shaders/CopyShader.js', './vendor/shaders/LuminosityHighPassShader.js',
  './sfx/row1.wav', './sfx/row2.wav', './sfx/row3.wav',
  './sfx/whoosh1.wav', './sfx/whoosh2.wav',
  './sfx/splash_mid.wav', './sfx/splash_big.wav', './sfx/splash_crash.wav',
  './sfx/crunch.wav', './sfx/plop.wav', './sfx/bubble.wav',
  './sfx/boing.wav', './sfx/waterloop.wav',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }))
  );
});
