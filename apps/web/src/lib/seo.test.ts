import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("SEO helpers", () => {
  it("prefers NEXT_PUBLIC_SITE_URL for canonical URLs", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.example.com/");
    vi.stubEnv("SITE_URL", "https://fallback.example.com");
    const seo = await import("./seo");

    expect(seo.getCanonicalSiteUrl()).toBe("https://www.example.com");
  });

  it("detects staging-like canonical hosts as noindex environments", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "production");
    const seo = await import("./seo");

    expect(seo.isNoIndexEnvironment("https://preview-locateflow.vercel.app")).toBe(true);
    expect(seo.isNoIndexEnvironment("https://locateflow.com")).toBe(false);
  });

  it("treats local development hosts as noindex", async () => {
    vi.resetModules();
    const seo = await import("./seo");

    expect(seo.isNoIndexEnvironment("http://localhost:3000")).toBe(true);
  });

  it("falls back to the public origin when production canonical env is unsafe", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const seo = await import("./seo");

    expect(seo.getCanonicalSiteUrl()).toBe("https://locateflow.com");
  });

  it("builds absolute URLs without leaking query strings from the base", async () => {
    vi.resetModules();
    const seo = await import("./seo");

    expect(seo.absoluteUrl("/pricing", "https://locateflow.com?utm=bad")).toBe(
      "https://locateflow.com/pricing",
    );
  });
});
