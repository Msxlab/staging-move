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

function mockRequestHosts(headers: Record<string, string>) {
  vi.doMock("next/headers", () => ({
    headers: vi.fn(async () => new Headers(headers)),
  }));
}

function mockBlogPosts(posts: unknown[] = []) {
  const findMany = vi.fn(async () => posts);
  vi.doMock("@/lib/db", () => ({
    prisma: {
      blogPost: {
        findMany,
      },
    },
  }));
  return { findMany };
}

function mockBlogPostsThrowing(error: Error) {
  const findMany = vi.fn(async () => {
    throw error;
  });
  vi.doMock("@/lib/db", () => ({
    prisma: {
      blogPost: {
        findMany,
      },
    },
  }));
  return { findMany };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.doUnmock("next/headers");
  vi.doUnmock("@/lib/db");
});

describe("production SEO launch surfaces", () => {
  it("allows public production crawling for search and AI bots while blocking private routes", async () => {
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
    expect(serialized).not.toContain('"disallow":"/"');
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

  it("allows production crawlers when a production forwarded host reaches a staging-named origin", async () => {
    productionEnv();
    mockRequestHosts({
      "x-forwarded-host": "locateflow.com",
      host: "locateflow-staging-owew7.ondigitalocean.app",
    });
    const { default: robots } = await import("./robots");

    const result = await robots();
    const serialized = JSON.stringify(result);

    expect(serialized).toContain('"allow":"/"');
    expect(serialized).not.toBe(JSON.stringify({ rules: [{ userAgent: "*", disallow: "/" }] }));
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
    expect(urls).toContain("https://locateflow.com/help");
    expect(urls).toContain("https://locateflow.com/provider-coverage");
    expect(urls).toContain("https://locateflow.com/data-deletion");
    expect(urls).toContain("https://locateflow.com/privacy");
    expect(urls).not.toContain("https://locateflow.com/api/health");
    expect(urls).not.toContain("https://locateflow.com/dashboard");
    expect(urls).not.toContain("https://admin.locateflow.com");
  });

  it("lists all 51 per-state moving guides in the sitemap", async () => {
    productionEnv();
    mockBlogPosts([]);
    const { default: sitemap } = await import("./sitemap");
    const { STATE_SLUGS } = await import("@/lib/states/data");

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(STATE_SLUGS).toHaveLength(51);
    for (const slug of STATE_SLUGS) {
      expect(urls).toContain(`https://locateflow.com/moving/${slug}`);
    }
    // Spot-check a couple of canonical state slugs.
    expect(urls).toContain("https://locateflow.com/moving/california");
    expect(urls).toContain("https://locateflow.com/moving/district-of-columbia");
  });

  it("includes published, non-noIndex blog posts with lastmod from updatedAt", async () => {
    productionEnv();
    const updatedAt = new Date("2026-04-15T10:30:00.000Z");
    mockBlogPosts([
      { slug: "weekend-address-update", updatedAt, locale: "en" },
      { slug: "weekend-address-update", updatedAt, locale: "es" },
      { slug: "winter-move-savings", updatedAt: new Date("2026-03-01T00:00:00.000Z"), locale: "en" },
    ]);
    const { default: sitemap } = await import("./sitemap");

    const entries = await sitemap();
    const byUrl = new Map(entries.map((entry) => [entry.url, entry]));

    expect(byUrl.has("https://locateflow.com/blog/weekend-address-update")).toBe(true);
    expect(byUrl.has("https://locateflow.com/blog/weekend-address-update?locale=es")).toBe(true);
    expect(byUrl.has("https://locateflow.com/blog/winter-move-savings")).toBe(true);

    const enEntry = byUrl.get("https://locateflow.com/blog/weekend-address-update");
    expect(enEntry?.lastModified).toEqual(updatedAt);
    expect(enEntry?.changeFrequency).toBe("weekly");

    const languages = (enEntry?.alternates?.languages ?? {}) as Record<string, string>;
    expect(languages["en-US"]).toBe("https://locateflow.com/blog/weekend-address-update");
    expect(languages["es-US"]).toBe("https://locateflow.com/blog/weekend-address-update?locale=es");
  });

  it("queries the DB with filters that exclude drafts, scheduled, deleted, future-dated, and noIndex posts", async () => {
    productionEnv();
    const { findMany } = mockBlogPosts([]);
    const { default: sitemap } = await import("./sitemap");

    await sitemap();

    expect(findMany).toHaveBeenCalledTimes(1);
    const calls = findMany.mock.calls as unknown as Array<
      [
        {
          where: Record<string, unknown>;
          take: number;
          orderBy: unknown;
        },
      ]
    >;
    const args = calls[0][0];
    expect(args.where.status).toBe("PUBLISHED");
    expect(args.where.deletedAt).toBeNull();
    expect(args.where.noIndex).toBe(false);

    const publishedAt = args.where.publishedAt as { lte: Date };
    expect(publishedAt.lte).toBeInstanceOf(Date);
    expect(publishedAt.lte.getTime()).toBeLessThanOrEqual(Date.now() + 1000);

    expect(args.take).toBeLessThanOrEqual(50000);
    expect(args.orderBy).toEqual({ publishedAt: "desc" });
  });

  it("never lists /blog/preview/* paths in the sitemap", async () => {
    productionEnv();
    mockBlogPosts([
      { slug: "real-post", updatedAt: new Date("2026-04-15T10:30:00.000Z"), locale: "en" },
    ]);
    const { default: sitemap } = await import("./sitemap");

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.every((url) => !url.includes("/blog/preview"))).toBe(true);
  });

  it("returns empty sitemap on staging-like canonical environment so QA hosts cannot leak", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://locateflow-staging-xyz.ondigitalocean.app");
    vi.stubEnv("SITE_URL", "https://locateflow-staging-xyz.ondigitalocean.app");
    mockBlogPosts([
      { slug: "should-not-appear", updatedAt: new Date(), locale: "en" },
    ]);
    const { default: sitemap } = await import("./sitemap");

    await expect(sitemap()).resolves.toEqual([]);
  });

  it("falls back to static entries and logs when the DB query fails", async () => {
    productionEnv();
    mockBlogPostsThrowing(new Error("ECONNREFUSED"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { default: sitemap } = await import("./sitemap");

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://locateflow.com");
    expect(urls).toContain("https://locateflow.com/pricing");
    expect(urls.some((url) => url.startsWith("https://locateflow.com/blog/"))).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      "sitemap_blog_query_failed",
      expect.objectContaining({ error: "ECONNREFUSED" }),
    );

    warn.mockRestore();
  });

  it("serves a useful production llms.txt rather than the noindex placeholder", async () => {
    productionEnv();
    mockRequestHost("locateflow.com");
    mockBlogPosts([]);
    const { GET } = await import("./llms.txt/route");

    const response = await GET();
    const text = await response.text();

    expect(text).toContain("# Move");
    expect(text).toContain("Move is a web and mobile app");
    expect(text).toContain("Full LLM summary: https://locateflow.com/llms-full.txt");
    expect(text).toContain("Provider coverage note:");
    expect(text).toContain("https://locateflow.com/about");
    expect(text).toContain("https://locateflow.com/pricing");
    expect(text).toContain("https://locateflow.com/help");
    expect(text).toContain("https://locateflow.com/provider-coverage");
    expect(text).toContain("https://locateflow.com/data-deletion");
    expect(text).not.toContain("# Not indexed");
    expect(text).not.toContain("/dashboard");
    expect(text).not.toContain("/api/");
  });

  it("serves a safe production llms-full.txt with public-only canonical surfaces", async () => {
    productionEnv();
    mockRequestHost("locateflow.com");
    mockBlogPosts([]);
    const { GET } = await import("./llms-full.txt/route");

    const response = await GET();
    const text = await response.text();

    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(text).toContain("# Move");
    expect(text).toContain("Canonical site: https://locateflow.com");
    expect(text).toContain("Provider suggestions are confidence guidance, not guarantees.");
    expect(text).toContain("https://locateflow.com/provider-coverage");
    expect(text).toContain("https://locateflow.com/blog/feed.xml");
    expect(text).not.toContain("# Not indexed");
    expect(text).not.toContain("https://www.locateflow.com");
    expect(text).not.toContain("https://admin.locateflow.com");
    expect(text).not.toContain("/dashboard");
    expect(text).not.toContain("/api/");
    expect(text).not.toContain("ondigitalocean.app/");
  });

  it("returns the noindex placeholder for llms-full.txt on staging-like hosts", async () => {
    productionEnv();
    mockRequestHost("locateflow-staging-owew7.ondigitalocean.app");
    mockBlogPosts([]);
    const { GET } = await import("./llms-full.txt/route");

    const response = await GET();

    await expect(response.text()).resolves.toBe("# Not indexed\n");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
