# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-pages.spec.ts >> SEO surface >> robots.txt is served
- Location: tests\e2e\public-pages.spec.ts:39:7

# Error details

```
Error: expect(received).toMatch(expected)

Expected pattern: /User-agent/
Received string:  "User-Agent: *
Disallow: /·
"
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("public pages load", () => {
  4  |   test("home page renders", async ({ page }) => {
  5  |     const response = await page.goto("/");
  6  |     expect(response?.ok()).toBeTruthy();
  7  |     await expect(page).toHaveTitle(/LocateFlow/);
  8  |   });
  9  | 
  10 |   test("home page sign-in link routes to sign-in", async ({ page }) => {
  11 |     await page.goto("/");
  12 |     await expect(page.getByRole("link", { name: /^sign in$/i }).first()).toHaveAttribute("href", "/sign-in");
  13 |   });
  14 | 
  15 |   test("sign-in page shows email + password fields", async ({ page }) => {
  16 |     await page.goto("/sign-in");
  17 |     await expect(page.getByLabel(/email/i)).toBeVisible();
  18 |     await expect(page.getByLabel(/password/i)).toBeVisible();
  19 |   });
  20 | 
  21 |   test("sign-up page shows form", async ({ page }) => {
  22 |     await page.goto("/sign-up");
  23 |     await expect(page.getByLabel(/email/i)).toBeVisible();
  24 |     await expect(page.getByLabel(/password/i)).toBeVisible();
  25 |   });
  26 | 
  27 |   test("pricing page renders", async ({ page }) => {
  28 |     const response = await page.goto("/pricing");
  29 |     expect(response?.ok()).toBeTruthy();
  30 |   });
  31 | 
  32 |   test("unauthenticated /dashboard redirects to sign-in", async ({ page }) => {
  33 |     await page.goto("/dashboard");
  34 |     await expect(page).toHaveURL(/\/(sign-in|login)/);
  35 |   });
  36 | });
  37 | 
  38 | test.describe("SEO surface", () => {
  39 |   test("robots.txt is served", async ({ request }) => {
  40 |     const res = await request.get("/robots.txt");
  41 |     expect(res.ok()).toBeTruthy();
  42 |     const body = await res.text();
> 43 |     expect(body).toMatch(/User-agent/);
     |                  ^ Error: expect(received).toMatch(expected)
  44 |     expect(body).toMatch(/Sitemap:/);
  45 |   });
  46 | 
  47 |   test("sitemap.xml is served", async ({ request }) => {
  48 |     const res = await request.get("/sitemap.xml");
  49 |     expect(res.ok()).toBeTruthy();
  50 |     const body = await res.text();
  51 |     expect(body).toMatch(/<urlset/);
  52 |   });
  53 | 
  54 |   test("FAQ raw HTML emits one valid FAQPage and one BreadcrumbList JSON-LD script", async ({ request }) => {
  55 |     const res = await request.get("/faq", {
  56 |       headers: { accept: "text/html" },
  57 |     });
  58 |     expect(res.ok()).toBeTruthy();
  59 |     const html = await res.text();
  60 |     const scriptTags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(
  61 |       (match) => ({ attrs: match[1], body: match[2] }),
  62 |     );
  63 |     const jsonLdScripts = scriptTags.filter((script) =>
  64 |       /type=["']application\/ld\+json["']/i.test(script.attrs),
  65 |     );
  66 |     const schemas = jsonLdScripts.map((script) => ({
  67 |       id: script.attrs.match(/id=["']([^"']+)["']/i)?.[1],
  68 |       data: JSON.parse(script.body) as Record<string, unknown>,
  69 |     }));
  70 |     const byType = (type: string) => schemas.filter((schema) => schema.data["@type"] === type);
  71 | 
  72 |     expect(byType("Organization")).toHaveLength(1);
  73 |     expect(byType("WebSite")).toHaveLength(1);
  74 |     expect(byType("FAQPage")).toHaveLength(1);
  75 |     expect(byType("BreadcrumbList")).toHaveLength(1);
  76 |     expect(schemas.filter((schema) => schema.id === "ld-faq")).toHaveLength(1);
  77 |     expect(schemas.filter((schema) => schema.id === "ld-faq-breadcrumb")).toHaveLength(1);
  78 | 
  79 |     const [faq] = byType("FAQPage");
  80 |     const mainEntity = faq.data.mainEntity as Array<Record<string, unknown>>;
  81 |     expect(Array.isArray(mainEntity)).toBe(true);
  82 |     expect(mainEntity.length).toBeGreaterThan(0);
  83 |     for (const item of mainEntity) {
  84 |       expect(item["@type"]).toBe("Question");
  85 |       expect(typeof item.name).toBe("string");
  86 |       expect(item.name).not.toBe("");
  87 |       const acceptedAnswer = item.acceptedAnswer as Record<string, unknown>;
  88 |       expect(acceptedAnswer["@type"]).toBe("Answer");
  89 |       expect(typeof acceptedAnswer.text).toBe("string");
  90 |       expect(acceptedAnswer.text).not.toBe("");
  91 |     }
  92 | 
  93 |     expect(
  94 |       scriptTags.filter((script) => /self\.__next_f\.push/.test(script.body) && /FAQPage/.test(script.body)),
  95 |     ).toHaveLength(0);
  96 |   });
  97 | });
  98 | 
```