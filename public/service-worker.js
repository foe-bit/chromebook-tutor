const CACHE_NAME = 'tutor-v1';
const MODEL_URL = "https://storage.googleapis.com/jmstore/gemma_2b_it_gpu_int4.bin";

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('fetch', (e) => {
  // Caching the 1.3GB model is the most important part
  if (e.request.url === MODEL_URL) {
    e.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(e.request);
      if (cached) return cached;
      const net = await fetch(e.request);
      cache.put(e.request, net.clone());
      return net;
    }));
  } else {
    e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
  }
});