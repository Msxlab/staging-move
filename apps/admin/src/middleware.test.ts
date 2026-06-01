import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildCspHeader, isPublicPath, isPublicStaticPath, isRscRequest } from "./middleware";

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

  it("keeps route chunks loadable under production CSP", () => {
    const scriptSrc = directive(buildCspHeader("test-nonce", false), "script-src");
    const scriptSources = sources(scriptSrc);

    expect(scriptSources).toContain("'self'");
    expect(scriptSources).toContain("'nonce-test-nonce'");
    expect(scriptSources).not.toContain("'strict-dynamic'");
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

describe("admin middleware RSC navigation", () => {
  it("detects App Router flight requests so middleware does not override router headers", () => {
    const rscByHeader = {
      headers: new Headers({ rsc: "1", "next-router-state-tree": "[tree]" }),
      nextUrl: new URL("https://admin.example.com/users/1"),
      url: "https://admin.example.com/users/1",
    };
    const rscBySearchParam = {
      headers: new Headers({ accept: "*/*" }),
      nextUrl: new URL("https://admin.example.com/users/1?_rsc=abc123"),
      url: "https://admin.example.com/users/1?_rsc=abc123",
    };
    const htmlRequest = {
      headers: new Headers({ accept: "text/html" }),
      nextUrl: new URL("https://admin.example.com/users/1"),
      url: "https://admin.example.com/users/1",
    };

    expect(isRscRequest(rscByHeader)).toBe(true);
    expect(isRscRequest(rscBySearchParam)).toBe(true);
    expect(isRscRequest(htmlRequest)).toBe(false);
  });

  it("keeps the raw _rsc URL visible to middleware/proxy", () => {
    const nextConfig = readFileSync(join(process.cwd(), "next.config.js"), "utf8");

    expect(nextConfig).toContain("skipProxyUrlNormalize: true");
  });
});

describe("admin service worker", () => {
  it("serves the service worker path without requiring an admin session", () => {
    expect(isPublicStaticPath("/sw.js")).toBe(true);
    expect(isPublicStaticPath("/register-sw.js")).toBe(true);
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

  it("unregisters stale service workers from the admin shell", () => {
    const register = readFileSync(join(process.cwd(), "public", "register-sw.js"), "utf8");
    const layout = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
    const nextConfig = readFileSync(join(process.cwd(), "next.config.js"), "utf8");

    expect(register).toContain("navigator.serviceWorker.getRegistrations()");
    expect(register).toContain("registration.unregister()");
    expect(register).toContain('key.indexOf("locateflow-") === 0');
    expect(register).not.toContain("navigator.serviceWorker.register");
    expect(layout).toContain('<script src="/register-sw.js" defer nonce={nonce} suppressHydrationWarning />');
    expect(nextConfig).toContain('source: "/register-sw.js"');
    expect(nextConfig).toContain("no-store, no-cache, must-revalidate, proxy-revalidate");
  });
});

describe("admin navigation fallback", () => {
  it("forces same-origin admin links onto browser navigations", () => {
    const fallback = readFileSync(join(process.cwd(), "src", "components", "admin-navigation-fallback.tsx"), "utf8");
    const layout = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");

    expect(fallback).toContain('target !== "_self"');
    expect(fallback).toContain("url.origin !== window.location.origin");
    expect(fallback).toContain("window.location.assign(url.href)");
    expect(layout).toContain("<AdminNavigationFallback />");
  });

  it("does not leave admin code on App Router programmatic navigation", () => {
    const sourceFiles = [
      join(process.cwd(), "src", "app", "login", "page.tsx"),
      join(process.cwd(), "src", "components", "blog", "post-editor-shell.tsx"),
      join(process.cwd(), "src", "app", "(admin)", "users", "[id]", "user-detail-client.tsx"),
      join(process.cwd(), "src", "app", "(admin)", "providers", "new", "page.tsx"),
      join(process.cwd(), "src", "app", "(admin)", "providers", "[id]", "edit", "page.tsx"),
    ];

    for (const file of sourceFiles) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("router.push(");
      expect(source).not.toContain("router.replace(");
      expect(source).not.toContain("router.back(");
      expect(source).not.toContain("router.refresh(");
    }
  });
});

describe("admin middleware public auth paths", () => {
  it("does not treat login-prefixed protected API routes as public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/api/auth/login-history")).toBe(false);
    expect(isPublicPath("/api/auth/login/extra")).toBe(false);
  });
});
