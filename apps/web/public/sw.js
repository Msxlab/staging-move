const CACHE_NAME = "locateflow-v5";
const STATIC_CACHE = "locateflow-static-v5";

const STATIC_ASSETS = [
  "/manifest.json",
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

const AUTHENTICATED_NAV_PREFIXES = [
  "/dashboard",
  "/addresses",
  "/services",
  "/moving",
  "/budget",
  "/documents",
  "/community",
  "/providers",
  "/notifications",
  "/support",
  "/settings",
  "/onboarding",
];

const AUTH_NAV_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/verify-email",
];

const SAFE_OFFLINE_NAV_PATHS = [
  "/",
  "/help",
  "/privacy",
  "/terms",
  "/disclaimer",
  "/cookie-policy",
  "/contact",
  "/pricing",
  "/how-it-works",
  "/faq",
  "/security",
  "/refund",
  "/dpa",
  "/acceptable-use",
  "/ccpa-privacy-notice",
];

function pathMatchesPrefix(pathname, prefixes) {
  return prefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isSafeOfflineNavigation(pathname) {
  return SAFE_OFFLINE_NAV_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

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
          .filter((k) => k.indexOf("locateflow-") === 0 && k !== STATIC_CACHE)
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

  if (
    request.mode === "navigate" &&
    (pathMatchesPrefix(url.pathname, AUTHENTICATED_NAV_PREFIXES) ||
      pathMatchesPrefix(url.pathname, AUTH_NAV_PREFIXES))
  ) {
    event.respondWith(fetch(request));
    return;
  }

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

  if (request.mode === "navigate" && !isSafeOfflineNavigation(url.pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  // Safe public pages: network-first with offline fallback. Do not cache HTML:
  // marketing pages can vary by auth state, and app pages must never survive logout.
  event.respondWith(
    fetch(request)
      .then((response) => response)
      .catch(async () => {
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
  if (event.data && event.data.type === "LOGOUT_CLEAR_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.indexOf("locateflow-") === 0)
            .map((key) => caches.delete(key))
        )
      )
    );
  }
});
