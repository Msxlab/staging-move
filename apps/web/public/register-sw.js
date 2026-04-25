(function () {
  if (!("serviceWorker" in navigator)) return;

  function isStagingLikeHost(hostname) {
    var host = (hostname || "").toLowerCase();
    return (
      host.indexOf("staging") !== -1 ||
      host.endsWith(".ondigitalocean.app") ||
      host.endsWith(".vercel.app") ||
      host === "localhost" ||
      host === "127.0.0.1"
    );
  }

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
    if (isStagingLikeHost(window.location.hostname)) {
      unregisterServiceWorkers();
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
})();
