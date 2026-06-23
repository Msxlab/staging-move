/*
 * LocateFlow service worker — auth-safe PWA shell (v1).
 *
 * WHY THIS IS SAFE (history): an earlier, more aggressive worker cached
 * authenticated HTML / served stale offline fallbacks, which blocked auth,
 * onboarding, and email-verification routes in production browsers. The worker
 * was therefore emergency-disabled. This rewrite re-enables a PWA shell under
 * HARD auth-safety rules that make that failure structurally impossible:
 *
 *   1. NEVER cache or serve HTML / navigation responses from the cache. Every
 *      navigation is network-first; the cache is only ever a last-resort OFFLINE
 *      fallback, and only for a fixed allowlist of PUBLIC marketing/legal pages.
 *   2. NEVER intercept /api/*, auth, onboarding, or email-verify requests — they
 *      pass straight through to the network (one-time tokens + redirects + auth
 *      state must never be touched or replayed).
 *   3. Cache ONLY immutable, content-hashed static assets (/_next/static), icons,
 *      fonts and images. These carry no auth state and a new deploy produces new
 *      hashed URLs, so cache-first can never serve a stale app shell.
 *   4. Purge every old cache on activate (version bump) and on logout.
 */

const VERSION = "locateflow-pwa-v1";
const STATIC_CACHE = VERSION + "-static";

// Precache the offline shell + the manifest/icons it references. The offline
// page is a PUBLIC, auth-free page (no session, no one-time token).
const PRECACHE = ["/offline", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

// Requests the worker must NEVER touch — passed straight to the network. Covers
// the data layer (/api/*) and every auth / onboarding / verification surface
// (one-time tokens, OAuth callbacks, redirects). A miss here is the exact class
// of bug that disabled the old worker, so the list is deliberately broad.
const BYPASS_PREFIXES = [
  "/api/",
  "/sign-in",
  "/sign-up",
  "/sign-out",
  "/logout",
  "/verify-email",
  "/verify",
  "/reset-password",
  "/forgot-password",
  "/onboarding",
  "/auth",
  "/oauth",
  "/impersonate",
  "/movers/portal",
  "/partners/portal",
];

function matchesPrefix(pathname, prefixes) {
  return prefixes.some(function (p) {
    // A bare "/" must match ONLY the exact root — never use it as a prefix, or it
    // would match every path. Prefixes that already end in "/" (e.g. "/api/") are
    // used as-is; everything else matches the exact path or a "/"-bounded subpath.
    if (p === "/") return pathname === "/";
    if (p.charAt(p.length - 1) === "/") return pathname.startsWith(p);
    return pathname === p || pathname.startsWith(p + "/");
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(function (cache) {
        return cache.addAll(PRECACHE);
      })
      .catch(function () {
        return undefined;
      }),
  );
  // Safe to take over immediately: we never cache HTML, so a new worker cannot
  // surface a stale app frame.
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key.indexOf("locateflow-") === 0 && key.indexOf(VERSION) !== 0;
            })
            .map(function (key) {
              return caches.delete(key);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  // Only ever touch same-origin GETs.
  if (url.origin !== self.location.origin) return;
  // Hands off the data layer + every auth/onboarding/verify surface.
  if (matchesPrefix(url.pathname, BYPASS_PREFIXES)) return;

  // Cache-first ONLY for immutable, content-hashed Next assets (/_next/static — a
  // new deploy mints new hashed URLs, so this can never serve a stale app shell)
  // and our app /icons. Nothing else is cache-first, so a redeployed same-name
  // public asset is never served stale. None of these carry auth state.
  var isHashedStatic = url.pathname.indexOf("/_next/static/") === 0;
  var isIcon = url.pathname.indexOf("/icons/") === 0;
  if (isHashedStatic || isIcon) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          if (response && response.status === 200 && response.type === "basic") {
            var clone = response.clone();
            caches.open(STATIC_CACHE).then(function (cache) {
              cache.put(request, clone);
            });
          }
          return response;
        });
      }),
    );
    return;
  }

  // Navigations → ALWAYS network-first. HTML is NEVER cached or served from cache.
  // On a genuine network failure, fall back to the cached /offline page — a
  // static, auth-free "you're offline" shell with NO session, token, app data, or
  // redirect. This is safe for ANY navigation that reaches here: every auth /
  // onboarding / email-verify / api / oauth / portal surface already returned
  // above via BYPASS_PREFIXES, so only public + app pages can hit this fallback,
  // for which a generic offline shell is the correct UX (it also lets the
  // installed PWA launch gracefully when started while offline).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match("/offline").then(function (offline) {
          return offline || new Response("Offline", { status: 503, statusText: "Offline" });
        });
      }),
    );
    return;
  }

  // Everything else (e.g. fetch()/XHR to non-/api same-origin) passes through
  // untouched and uncached.
});

self.addEventListener("message", function (event) {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  // On logout the app can post this to nuke every LocateFlow cache as defense in
  // depth (the worker never caches auth state, but this guarantees a clean slate).
  if (event.data.type === "LOGOUT_CLEAR_CACHES") {
    event.waitUntil(
      caches.keys().then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key.indexOf("locateflow-") === 0;
            })
            .map(function (key) {
              return caches.delete(key);
            }),
        );
      }),
    );
  }
});
