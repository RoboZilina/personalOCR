const CACHE_NAME = 'personalocr-cloudflare-gold-v3.1';

const ASSETS = [
  '/',
  '/app.js',
  '/icon-192.png',
  '/icon-512.png',
  '/index.html',
  '/js/manga/manga_engine.js',
  '/js/onnx/onnx_support.js',
  '/js/onnx/ort-wasm-simd-threaded.jsep.mjs',
  '/js/onnx/ort-wasm-simd-threaded.jsep.wasm',
  '/js/onnx/ort-wasm-simd-threaded.wasm',
  '/js/onnx/ort-wasm-simd.wasm',
  '/js/onnx/ort-wasm-threaded.wasm',
  '/js/onnx/ort-wasm.wasm',
  '/js/onnx/ort.min.js',
  '/js/paddle/paddle_core.js',
  '/js/paddle/paddle_engine.js',
  '/js/tesseract/tesseract_engine.js',
  '/manifest.json',
  '/models/manga/config.json',
  '/models/manga/manifest.json',
  '/models/manga/preprocessor_config.json',
  '/models/manga/vocab.json',
  '/models/paddle/japan_dict.txt',
  '/models/paddle/manifest.json',
  '/settings.js',
  '/styles.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const path = url.pathname;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request);
      });
    })
  );
});
