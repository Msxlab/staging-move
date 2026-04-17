const CACHE_NAME = "locateflow-v2";
const STATIC_CACHE = "locateflow-static-v2";
const DYNAMIC_CACHE = "locateflow-dynamic-v2";

const STATIC_ASSETS = [
  "/manifest.json",
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const CACHED_PAGES = [
  "/dashboard",
  "/addresses",
  "/services",
  "/moving",
  "/budget",
  "/documents",
  "/community",
  "/settings",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/")) return;

  // Static assets: cache-first
  if (STATIC_ASSETS.some((a) => url.pathname === a) || url.pathname.match(/\.(png|jpg|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Pages: network-first with offline fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Return offline page for navigation requests
        if (request.mode === "navigate") {
          const offlinePage = await caches.match("/offline");
          if (offlinePage) return offlinePage;
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      })
  );
});

// Background sync for failed API requests
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
