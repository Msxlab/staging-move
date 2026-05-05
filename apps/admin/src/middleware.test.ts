import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildCspHeader, isPublicStaticPath } from "./middleware";

const ORIGINAL_R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

function directive(csp: string, name: string): string {
  return csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
}

function sources(cspDirective: string): string[] {
  return cspDirective.split(/\s+/).slice(1);
}

describe("admin middleware CSP", () => {
  afterEach(() => {
    process.env.R2_PUBLIC_BASE_URL = ORIGINAL_R2_PUBLIC_BASE_URL;
  });

  it("allows the production R2 logo asset host without broad image wildcards", () => {
    delete process.env.R2_PUBLIC_BASE_URL;

    const imgSrc = directive(buildCspHeader("test-nonce", false), "img-src");
    const imgSources = sources(imgSrc);

    expect(imgSrc).toBe("img-src 'self' data: blob: https://assets.locateflow.com");
    expect(imgSources).not.toContain("https:");
    expect(imgSources).not.toContain("*");
  });

  it("also allows the configured R2 public base URL origin", () => {
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com/provider-logo";

    const imgSrc = directive(buildCspHeader("test-nonce", false), "img-src");

    expect(imgSrc).toContain("https://assets.locateflow.com");
    expect(imgSrc).toContain("https://cdn.example.com");
    expect(imgSrc).not.toContain("/provider-logo");
  });

  it("marks admin responses and metadata as noindex", () => {
    const middlewareSource = readFileSync(join(process.cwd(), "src", "middleware.ts"), "utf8");
    const layoutSource = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
    const robotsSource = readFileSync(join(process.cwd(), "src", "app", "robots.ts"), "utf8");

    expect(middlewareSource).toContain('response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")');
    expect(layoutSource).toContain("robots:");
    expect(layoutSource).toContain("index: false");
    expect(robotsSource).toContain('disallow: "/"');
  });
});

describe("admin service worker", () => {
  it("serves the service worker path without requiring an admin session", () => {
    expect(isPublicStaticPath("/sw.js")).toBe(true);
    expect(isPublicStaticPath("/robots.txt")).toBe(true);
    expect(isPublicStaticPath("/login")).toBe(false);
    expect(isPublicStaticPath("/api/providers")).toBe(false);
  });

  it("retires stale workers and never intercepts external R2 assets", () => {
    const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
    const fetchHandler = sw.slice(sw.indexOf('self.addEventListener("fetch"'));

    expect(sw).toContain("self.skipWaiting()");
    expect(sw).toContain("self.clients");
    expect(sw).toContain(".claim()");
    expect(sw).toContain("self.registration.unregister()");
    expect(fetchHandler).toContain("if (url.origin !== self.location.origin) return;");
    expect(fetchHandler).not.toContain("respondWith");
    expect(sw).not.toContain("assets.locateflow.com");
  });
});
