/* Move PWA service worker — offline-first cache */
const CACHE = 'move-pwa-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request).then((res) => {
        try { cache.put(e.request, res.clone()); } catch (err) {}
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
