const CACHE_PREFIX = "locateflow-admin-";
const STATIC_CACHE = `${CACHE_PREFIX}static-v4`;
const OFFLINE_URL = "/offline.html";

const STATIC_ASSETS = [
  OFFLINE_URL,
  "/manifest.json",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/logo.svg",
  "/logo-mark.svg",
  "/icon-192.png",
  "/icon-512.png",
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isStaticAdminAsset(url) {
  if (!isSameOrigin(url)) return false;
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
  // Precache per-asset so a single missing/404 asset can't abort the whole
  // precache (which would leave the offline fallback uncached).
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.all(
          STATIC_ASSETS.map((asset) =>
            cache.add(asset).catch(() => undefined)
          )
        )
      )
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
  if (!isSameOrigin(url)) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

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
