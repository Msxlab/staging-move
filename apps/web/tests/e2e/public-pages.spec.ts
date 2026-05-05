import { test, expect } from "@playwright/test";

test.describe("public pages load", () => {
  test("home page renders", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveTitle(/LocateFlow/);
  });

  test("home page sign-in link routes to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^sign in$/i }).first()).toHaveAttribute("href", "/sign-in");
  });

  test("sign-in page shows email + password fields", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("sign-up page shows form", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("pricing page renders", async ({ page }) => {
    const response = await page.goto("/pricing");
    expect(response?.ok()).toBeTruthy();
  });

  test("unauthenticated /dashboard redirects to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/(sign-in|login)/);
  });
});

test.describe("SEO surface", () => {
  test("robots.txt is served", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body).toMatch(/User-agent/);
    expect(body).toMatch(/Sitemap:/);
  });

  test("sitemap.xml is served", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body).toMatch(/<urlset/);
  });

  test("FAQ raw HTML emits one valid FAQPage and one BreadcrumbList JSON-LD script", async ({ request }) => {
    const res = await request.get("/faq", {
      headers: { accept: "text/html" },
    });
    expect(res.ok()).toBeTruthy();
    const html = await res.text();
    const scriptTags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(
      (match) => ({ attrs: match[1], body: match[2] }),
    );
    const jsonLdScripts = scriptTags.filter((script) =>
      /type=["']application\/ld\+json["']/i.test(script.attrs),
    );
    const schemas = jsonLdScripts.map((script) => ({
      id: script.attrs.match(/id=["']([^"']+)["']/i)?.[1],
      data: JSON.parse(script.body) as Record<string, unknown>,
    }));
    const byType = (type: string) => schemas.filter((schema) => schema.data["@type"] === type);

    expect(byType("Organization")).toHaveLength(1);
    expect(byType("WebSite")).toHaveLength(1);
    expect(byType("FAQPage")).toHaveLength(1);
    expect(byType("BreadcrumbList")).toHaveLength(1);
    expect(schemas.filter((schema) => schema.id === "ld-faq")).toHaveLength(1);
    expect(schemas.filter((schema) => schema.id === "ld-faq-breadcrumb")).toHaveLength(1);

    const [faq] = byType("FAQPage");
    const mainEntity = faq.data.mainEntity as Array<Record<string, unknown>>;
    expect(Array.isArray(mainEntity)).toBe(true);
    expect(mainEntity.length).toBeGreaterThan(0);
    for (const item of mainEntity) {
      expect(item["@type"]).toBe("Question");
      expect(typeof item.name).toBe("string");
      expect(item.name).not.toBe("");
      const acceptedAnswer = item.acceptedAnswer as Record<string, unknown>;
      expect(acceptedAnswer["@type"]).toBe("Answer");
      expect(typeof acceptedAnswer.text).toBe("string");
      expect(acceptedAnswer.text).not.toBe("");
    }

    expect(
      scriptTags.filter((script) => /self\.__next_f\.push/.test(script.body) && /FAQPage/.test(script.body)),
    ).toHaveLength(0);
  });
});
