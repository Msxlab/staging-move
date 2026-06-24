import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("web service worker cache policy", () => {
  it("uses the v1 PWA cache name and never caches HTML", () => {
    const sw = read("public/sw.js");

    expect(sw).toContain('const VERSION = "locateflow-pwa-v1"');
    expect(sw).toContain("const STATIC_CACHE = VERSION");
    // The old disabled/dynamic cache shapes are gone.
    expect(sw).not.toContain("DISABLE_SERVICE_WORKER");
    expect(sw).not.toContain("DYNAMIC_CACHE");
    expect(sw).not.toContain("auth-stabilization-disabled");
  });

  it("caches ONLY immutable hashed Next assets and app icons", () => {
    const sw = read("public/sw.js");

    // The only cache-first allowlist: content-hashed Next assets + our app icons.
    expect(sw).toContain('url.pathname.indexOf("/_next/static/") === 0');
    expect(sw).toContain('url.pathname.indexOf("/icons/") === 0');
    // No broad extension-based caching: a redeployed same-name public asset can
    // never be served stale (only hashed /_next/static + versioned /icons).
    expect(sw).not.toContain("png|jpg|jpeg|gif|webp");
    // cache.put is only ever reached on that asset branch — never for HTML.
    expect(sw).toContain("cache.put(request, clone)");

    // Asset caching is gated on a same-origin "basic" 200 response, so opaque /
    // auth-bearing responses are never stored.
    expect(sw).toContain('response.type === "basic"');
  });

  it("never stores or serves cached HTML for navigations", () => {
    const sw = read("public/sw.js");

    const navStart = sw.indexOf('request.mode === "navigate"');
    const navEnd = sw.indexOf('self.addEventListener("message"');
    const navBranch = sw.slice(navStart, navEnd);
    // The navigation branch is network-first; it must not put or match HTML.
    expect(navBranch).not.toContain("cache.put");
    expect(navBranch).not.toContain("caches.match(request)");
    // It may only read the precached public /offline fallback.
    expect(navBranch).toContain('caches.match("/offline")');
  });

  it("precaches the public offline shell and the manifest/icons it needs", () => {
    const sw = read("public/sw.js");

    expect(sw).toContain("PRECACHE");
    expect(sw).toContain('"/offline"');
    expect(sw).toContain('"/manifest.json"');
    expect(sw).toContain('"/icons/icon-192.png"');
    expect(sw).toContain("cache.addAll(PRECACHE)");
  });

  it("purges old LocateFlow caches on activate and on logout", () => {
    const sw = read("public/sw.js");

    expect(sw).toContain("LOGOUT_CLEAR_CACHES");
    expect(sw).toContain('key.indexOf("locateflow-") === 0');
  });

  it("logout client cleanup still clears caches and unregisters workers", () => {
    const hook = read("src/hooks/use-current-user.ts");

    expect(hook).toContain('key.startsWith("locateflow-")');
    expect(hook).toContain('postMessage({ type: "LOGOUT_CLEAR_CACHES" })');
    expect(hook).toContain("getRegistrations");
    expect(hook).toContain("registration.unregister()");
  });

  it("serves service worker files with no-store headers", () => {
    const nextConfig = read("next.config.js");

    expect(nextConfig).toContain('source: "/sw.js"');
    expect(nextConfig).toContain('source: "/register-sw.js"');
    expect(nextConfig).toContain("no-store, no-cache, must-revalidate, proxy-revalidate");
  });
});
