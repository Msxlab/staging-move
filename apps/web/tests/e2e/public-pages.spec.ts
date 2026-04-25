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
});
