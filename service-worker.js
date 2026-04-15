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

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        // Fetch from network if not in cache
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // If the request fails or is opaque, just return it
          if (!networkResponse || networkResponse.status === 0) {
            return networkResponse;
          }

          // Hybrid Header Injection (Universal Isolation)
          // We must clone the response to modify headers
          const newHeaders = new Headers(networkResponse.headers);
          newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
          newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
          newHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');

          const isolatedResponse = new Response(networkResponse.body, {
            status: networkResponse.status,
            statusText: networkResponse.statusText,
            headers: newHeaders,
          });

          // Cache the isolated response for future use
          if (networkResponse.ok) {
            cache.put(event.request, isolatedResponse.clone());
          }

          return isolatedResponse;
        }).catch(() => {
          // Fallback if network fails and not in cache
          return null;
        });

        // Return cached response if available, but wrap it to ensure headers are present
        if (cachedResponse) {
          const newHeaders = new Headers(cachedResponse.headers);
          if (!newHeaders.has('Cross-Origin-Embedder-Policy')) {
            newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
            newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers: newHeaders,
            });
          }
          return cachedResponse;
        }

        return fetchPromise;
      });
    })
  );
});
