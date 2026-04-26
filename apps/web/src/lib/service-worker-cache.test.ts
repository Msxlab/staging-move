import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("web service worker cache policy", () => {
  it("does not cache HTML pages or authenticated app navigations", () => {
    const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

    expect(sw).toContain('const CACHE_NAME = "locateflow-v5"');
    expect(sw).toContain('const STATIC_CACHE = "locateflow-static-v5"');
    expect(sw).toContain('url.pathname.startsWith("/api/")');
    expect(sw).toContain('url.pathname.startsWith("/_next/")');
    expect(sw).toContain("AUTHENTICATED_NAV_PREFIXES");
    expect(sw).toContain("AUTH_NAV_PREFIXES");
    expect(sw).toContain('"/sign-in"');
    expect(sw).toContain('"/sign-up"');
    expect(sw).toContain('"/verify-email"');
    expect(sw).toContain("SAFE_OFFLINE_NAV_PATHS");
    expect(sw).toContain("!isSafeOfflineNavigation(url.pathname)");
    expect(sw).toContain("LOGOUT_CLEAR_CACHES");
    expect(sw).toContain('k.indexOf("locateflow-") === 0 && k !== STATIC_CACHE');
    expect(sw).toContain('key.indexOf("locateflow-") === 0');
    expect(sw).not.toContain("DYNAMIC_CACHE");
    expect(sw.slice(sw.indexOf("// Safe public pages:"))).not.toContain("cache.put");
  });

  it("keeps auth and protected routes network-only instead of offline fallback", () => {
    const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

    expect(sw).toContain("pathMatchesPrefix(url.pathname, AUTHENTICATED_NAV_PREFIXES)");
    expect(sw).toContain("pathMatchesPrefix(url.pathname, AUTH_NAV_PREFIXES)");
    expect(sw).toContain("event.respondWith(fetch(request));");
    expect(sw).not.toContain('"/sign-in",\n  "/offline"');
  });

  it("logout client cleanup unregisters service workers after clearing caches", () => {
    const hook = readFileSync(join(process.cwd(), "src", "hooks", "use-current-user.ts"), "utf8");

    expect(hook).toContain('key.startsWith("locateflow-")');
    expect(hook).toContain('postMessage({ type: "LOGOUT_CLEAR_CACHES" })');
    expect(hook).toContain("getRegistrations");
    expect(hook).toContain("registration.unregister()");
  });
});
