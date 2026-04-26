import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("web service worker cache policy", () => {
  it("does not cache HTML pages or authenticated app navigations", () => {
    const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

    expect(sw).toContain('url.pathname.startsWith("/api/")');
    expect(sw).toContain('url.pathname.startsWith("/_next/")');
    expect(sw).toContain("AUTHENTICATED_NAV_PREFIXES");
    expect(sw).toContain("LOGOUT_CLEAR_CACHES");
    expect(sw).not.toContain("DYNAMIC_CACHE");
    expect(sw.slice(sw.indexOf("// Pages:"))).not.toContain("cache.put");
  });
});
