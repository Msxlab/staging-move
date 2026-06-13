const CACHE_PREFIX = "locateflow-admin-";
const STATIC_CACHE = `${CACHE_PREFIX}static-v1`;

const STATIC_ASSETS = [
  "/manifest.json",
  "/favicon.svg",
  "/logo.svg",
  "/logo-mark.svg",
  "/og-image.svg",
  "/icon-192.png",
  "/icon-512.png",
];

function isStaticAdminAsset(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/_next/static/")) return true;
  return STATIC_ASSETS.includes(url.pathname);
}

function clearLocateFlowAdminCaches() {
  return caches.keys().then((keys) =>
    Promise.all(
      keys
        .filter((key) => key.indexOf(CACHE_PREFIX) === 0)
        .map((key) => caches.delete(key))
    )
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.indexOf(CACHE_PREFIX) === 0 && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") return;
  if (url.pathname.startsWith("/api/")) return;
  if (!isStaticAdminAsset(url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "LOGOUT_CLEAR_CACHES") {
    event.waitUntil(clearLocateFlowAdminCaches());
  }
});
