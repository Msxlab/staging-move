import { afterEach, describe, expect, it, vi } from "vitest";

function productionEnv() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://locateflow.com");
  vi.stubEnv("SITE_URL", "https://locateflow.com");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://locateflow.com");
}

function mockRequestHost(host: string) {
  vi.doMock("next/headers", () => ({
    headers: vi.fn(async () => new Headers({ host })),
  }));
}

function mockBlogPosts(posts: unknown[] = []) {
  vi.doMock("@/lib/db", () => ({
    prisma: {
      blogPost: {
        findMany: vi.fn(async () => posts),
      },
    },
  }));
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.doUnmock("next/headers");
  vi.doUnmock("@/lib/db");
});

describe("production SEO launch surfaces", () => {
  it("allows public production crawling while blocking private routes and training crawlers", async () => {
    productionEnv();
    mockRequestHost("locateflow.com");
    const { default: robots } = await import("./robots");

    const result = await robots();
    const serialized = JSON.stringify(result);

    expect(serialized).toContain('"userAgent":"*"');
    expect(serialized).toContain('"allow":"/"');
    expect(serialized).toContain('"OAI-SearchBot"');
    expect(serialized).toContain('"ChatGPT-User"');
    expect(serialized).toContain('"PerplexityBot"');
    expect(serialized).toContain('"ClaudeBot"');
    expect(serialized).toContain('"GPTBot"');
    expect(serialized).toContain('"Google-Extended"');
    expect(serialized).toContain('"/api/"');
    expect(serialized).toContain('"/dashboard"');
    expect(result).toMatchObject({
      sitemap: "https://locateflow.com/sitemap.xml",
      host: "https://locateflow.com",
    });
  });

  it("disallows all crawlers on staging-like hosts", async () => {
    productionEnv();
    mockRequestHost("locateflow-staging-owew7.ondigitalocean.app");
    const { default: robots } = await import("./robots");

    await expect(robots()).resolves.toEqual({
      rules: [{ userAgent: "*", disallow: "/" }],
    });
  });

  it("generates a non-empty production sitemap with only canonical public URLs", async () => {
    productionEnv();
    mockBlogPosts([]);
    const { default: sitemap } = await import("./sitemap");

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://locateflow.com");
    expect(urls).toContain("https://locateflow.com/pricing");
    expect(urls).toContain("https://locateflow.com/about");
    expect(urls).toContain("https://locateflow.com/provider-coverage");
    expect(urls).toContain("https://locateflow.com/data-deletion");
    expect(urls).toContain("https://locateflow.com/privacy");
    expect(urls).not.toContain("https://locateflow.com/api/health");
    expect(urls).not.toContain("https://locateflow.com/dashboard");
    expect(urls).not.toContain("https://admin.locateflow.com");
  });

  it("serves a useful production llms.txt rather than the noindex placeholder", async () => {
    productionEnv();
    mockRequestHost("locateflow.com");
    mockBlogPosts([]);
    const { GET } = await import("./llms.txt/route");

    const response = await GET();
    const text = await response.text();

    expect(text).toContain("# LocateFlow");
    expect(text).toContain("LocateFlow is a web app");
    expect(text).toContain("$39.99/year");
    expect(text).toContain("90-day free trial");
    expect(text).toContain("https://locateflow.com/about");
    expect(text).toContain("https://locateflow.com/pricing");
    expect(text).toContain("https://locateflow.com/provider-coverage");
    expect(text).toContain("https://locateflow.com/data-deletion");
    expect(text).not.toContain("# Not indexed");
    expect(text).not.toContain("/dashboard");
    expect(text).not.toContain("/api/");
  });
});
