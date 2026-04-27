(function () {
  if (!("serviceWorker" in navigator)) return;

  function clearLocateFlowCaches() {
    if (!("caches" in window)) return Promise.resolve();
    return caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key.indexOf("locateflow-") === 0;
          })
          .map(function (key) {
            return caches.delete(key);
          }),
      );
    });
  }

  function unregisterServiceWorkers() {
    return navigator.serviceWorker
      .getRegistrations()
      .then(function (registrations) {
        return Promise.all(
          registrations.map(function (registration) {
            return registration.unregister();
          }),
        );
      })
      .then(clearLocateFlowCaches)
      .catch(function () {});
  }

  window.addEventListener("load", function () {
    // Hotfix: stale authenticated HTML/offline fallbacks have blocked auth,
    // onboarding, and email-verification routes in production browsers.
    // Keep service workers disabled until the app has a deliberately safe
    // offline shell for authenticated pages.
    unregisterServiceWorkers();
  });
})();
