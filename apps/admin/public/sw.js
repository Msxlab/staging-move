const CACHE_PREFIX = "locateflow-";

self.addEventListener("install", () => {
  self.skipWaiting();
});

function clearLocateFlowCaches() {
  return caches.keys().then((keys) =>
    Promise.all(
      keys
        .filter((key) => key.indexOf(CACHE_PREFIX) === 0)
        .map((key) => caches.delete(key))
    )
  );
}

function retireWorker() {
  return clearLocateFlowCaches()
    .then(() => self.registration.unregister())
    .catch(() => undefined);
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.clients
      .claim()
      .catch(() => undefined)
      .then(() => retireWorker())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // External logo/CDN requests must stay on the browser's normal network path.
  // A rejected service-worker fetch promise here causes NS_ERROR_INTERCEPTION_FAILED.
  if (url.origin !== self.location.origin) return;

  // This worker exists only to replace and retire stale admin service workers
  // that cached too broadly. Leave every request on the native browser path.
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "LOGOUT_CLEAR_CACHES") {
    event.waitUntil(clearLocateFlowCaches());
  }
});
