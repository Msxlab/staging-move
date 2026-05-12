(function () {
  if (!("serviceWorker" in navigator)) return;

  function unregisterServiceWorkers() {
    return Promise.all([
      navigator.serviceWorker.getRegistrations(),
      "caches" in window ? caches.keys() : Promise.resolve([]),
    ])
      .then(function (results) {
        var registrations = results[0];
        var cacheKeys = results[1].filter(function (key) {
          return key.indexOf("locateflow-") === 0;
        });

        if (registrations.length === 0 && cacheKeys.length === 0) return undefined;

        return Promise.all(
          registrations.map(function (registration) {
            return registration.unregister();
          }),
        ).then(function () {
          if (!("caches" in window)) return undefined;
          return Promise.all(
            cacheKeys.map(function (key) {
              return caches.delete(key);
            }),
          );
        });
      })
      .catch(function () {});
  }

  window.addEventListener("load", function () {
    unregisterServiceWorkers();
  });
})();
