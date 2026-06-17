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
    await expect(page.locator("input#password")).toBeVisible();
  });

  test("sign-up page shows form", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
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
    expect(body).toMatch(/User-agent/i);
    expect(body).toMatch(/(Sitemap:|Disallow:\s*\/)/i);
  });

  test("sitemap.xml is served", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body).toMatch(/<urlset/);
  });

  test("FAQ page emits one valid FAQPage and one BreadcrumbList JSON-LD script", async ({ page }) => {
    const response = await page.goto("/faq");
    expect(response?.ok()).toBeTruthy();
    const schemas = await page.locator('script[type="application/ld+json"]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: node.getAttribute("id") ?? undefined,
        data: JSON.parse(node.textContent || "{}") as Record<string, unknown>,
      })),
    );
    const byType = (type: string) => schemas.filter((schema) => schema.data["@type"] === type);

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
    const html = await page.content();
    expect(html).not.toMatch(/self\.__next_f\.push[\s\S]*FAQPage/);
  });
});
