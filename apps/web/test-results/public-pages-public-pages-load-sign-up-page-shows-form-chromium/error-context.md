# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-pages.spec.ts >> public pages load >> sign-up page shows form
- Location: tests\e2e\public-pages.spec.ts:21:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByLabel(/password/i)
Expected: visible
Error: strict mode violation: getByLabel(/password/i) resolved to 2 elements:
    1) <input value="" required="" id="password" minlength="12" type="password" autocomplete="new-password" placeholder="At least 12 characters" class="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring pr-10"/> aka getByRole('textbox', { name: 'Password' })
    2) <button type="button" aria-pressed="false" aria-label="Show password" class="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40">…</button> aka getByRole('button', { name: 'Show password' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByLabel(/password/i)

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - link "Locateflow" [ref=e6] [cursor=pointer]:
        - /url: /
        - img [ref=e7]
        - generic [ref=e14]: Locateflow
      - generic [ref=e15]:
        - heading "Create your account" [level=1] [ref=e16]
        - paragraph [ref=e17]: Start managing every service tied to your address. Checkout terms shown before purchase
    - generic [ref=e18]:
      - button "Continue with Google" [ref=e19] [cursor=pointer]:
        - img [ref=e20]
        - generic [ref=e25]: Continue with Google
      - button "Continue with Apple" [ref=e26] [cursor=pointer]:
        - img [ref=e27]
        - generic [ref=e29]: Continue with Apple
      - generic [ref=e32]: with
    - generic [ref=e34]:
      - generic [ref=e35]:
        - generic [ref=e36]:
          - generic [ref=e37]: First name
          - textbox "First name" [ref=e38]
        - generic [ref=e39]:
          - generic [ref=e40]: Last name
          - textbox "Last name" [ref=e41]
      - generic [ref=e42]:
        - generic [ref=e43]: Email
        - textbox "Email" [ref=e44]
      - generic [ref=e45]:
        - generic [ref=e46]: Password
        - generic [ref=e47]:
          - textbox "Password" [ref=e48]:
            - /placeholder: At least 12 characters
          - button "Show password" [ref=e49] [cursor=pointer]:
            - img [ref=e50]
        - paragraph [ref=e53]: Pick a password with at least 12 characters, one uppercase, one lowercase, one digit, and one special character.
      - paragraph [ref=e54]: You will review and accept LocateFlow Terms and Legal Disclaimer before using the app.
      - button "Create Account" [ref=e55] [cursor=pointer]
    - paragraph [ref=e56]:
      - text: Already have an account?
      - link "Sign In" [ref=e57] [cursor=pointer]:
        - /url: /sign-in
    - generic [ref=e58]:
      - link "Terms" [ref=e59] [cursor=pointer]:
        - /url: /terms
      - link "Privacy" [ref=e60] [cursor=pointer]:
        - /url: /privacy
      - link "Disclaimer" [ref=e61] [cursor=pointer]:
        - /url: /disclaimer
      - link "Contact" [ref=e62] [cursor=pointer]:
        - /url: /contact
  - region "Notifications alt+T"
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
> 24 |     await expect(page.getByLabel(/password/i)).toBeVisible();
     |                                                ^ Error: expect(locator).toBeVisible() failed
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
  43 |     expect(body).toMatch(/User-agent/);
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