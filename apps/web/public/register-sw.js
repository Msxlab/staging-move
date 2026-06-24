/*
 * Registers the LocateFlow auth-safe service worker (public/sw.js).
 *
 * The worker never caches HTML and never touches /api or auth/onboarding/verify
 * routes (see sw.js), so registering it cannot reintroduce the stale-auth-state
 * problem that previously forced it off. On an update the new worker self-skips
 * waiting; because only immutable hashed assets are cached, it takes over safely
 * without a forced reload.
 */
(function () {
  if (!("serviceWorker" in navigator)) return;

  var host = window.location.hostname;
  var isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  // Service workers require a secure context. Allow localhost for dev.
  if (window.location.protocol !== "https:" && !isLocalhost) return;

  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(function (registration) {
        registration.addEventListener("updatefound", function () {
          var installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", function () {
            // A newer worker finished installing while an old one still controls
            // the page → tell it to activate now. Safe: no HTML is cached.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              installing.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(function () {
        /* registration is best-effort; the app works fine without the worker */
      });
  });
})();
