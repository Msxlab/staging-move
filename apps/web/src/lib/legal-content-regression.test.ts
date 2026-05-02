import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function readRepo(relativePath: string) {
  return readFileSync(path.join(process.cwd(), "../..", relativePath), "utf8");
}

describe("public legal and policy content", () => {
  it("footer exposes the required public legal routes", () => {
    const footer = read("src/components/marketing/marketing-footer.tsx");

    [
      "/privacy",
      "/terms",
      "/cookie-policy",
      "/disclaimer",
      "/billing-policy",
      "/refund",
      "/acceptable-use",
      "/dpa",
      "/security",
      "/ccpa-privacy-notice",
      "/contact",
      "/faq",
      "/blog",
      "/blog/feed.xml",
      "/pricing",
    ].forEach((href) => {
      expect(footer).toContain(`href="${href}"`);
    });
  });

  it("billing policy and refund policy are distinct canonical pages", () => {
    const billing = read("src/app/billing-policy/page.tsx");
    const refund = read("src/app/refund/page.tsx");

    expect(billing).toContain('title: "Billing Policy"');
    expect(billing).toContain('canonical: "/billing-policy"');
    expect(billing).toContain("Auto-renewal and cancellation");
    expect(refund).toContain('title: "Refund Policy"');
    expect(refund).toContain('canonical: "/refund"');
    expect(refund).toContain("Refunds are not guaranteed");
    expect(billing).not.toContain("export { metadata, default }");
  });

  it("contact page has public support, privacy, billing, legal, security, and DPA channels", () => {
    const contact = read("src/app/contact/page.tsx");

    [
      "General support",
      "Billing support",
      "Privacy requests",
      "Legal notices",
      "Security disclosure",
      "DPA and subprocessors",
      "Do not send passwords",
      "Mailing address",
    ].forEach((text) => expect(contact).toContain(text));
  });

  it("policy pages show a shared last-updated date", () => {
    [
      "src/app/privacy/page.tsx",
      "src/app/terms/page.tsx",
      "src/app/cookie-policy/page.tsx",
      "src/app/ccpa-privacy-notice/page.tsx",
      "src/app/acceptable-use/page.tsx",
      "src/app/dpa/page.tsx",
      "src/app/disclaimer/page.tsx",
      "src/app/refund/page.tsx",
      "src/app/billing-policy/page.tsx",
      "src/app/security/page.tsx",
      "src/app/faq/page.tsx",
    ].forEach((file) => {
      expect(read(file)).toContain("policyLastUpdatedLabel");
    });
  });

  it("public marketing and FAQ copy does not reintroduce stale trial, refund, or compliance promises", () => {
    const sources = [
      read("src/i18n/messages/en.json"),
      read("src/i18n/messages/es.json"),
      read("src/app/page.tsx"),
      read("src/app/pricing/page.tsx"),
      read("src/app/faq/page.tsx"),
      read("src/app/how-it-works/page.tsx"),
      read("src/app/blog/page.tsx"),
      read("src/app/blog/[slug]/page.tsx"),
    ].join("\n");

    [
      "No credit card required",
      "no credit card required",
      "Start 14-day free trial",
      "14 days free",
      "30-day refund",
      "full refund within the first 30 days",
      "GDPR / CCPA compliant",
      "GDPR and CCPA compliant",
      "complete deletion",
      "deleted immediately",
      "periodically exercised",
      "Secrets never land",
    ].forEach((phrase) => {
      expect(sources).not.toContain(phrase);
    });
  });

  it("help content and API filters block stale legal/security claims", () => {
    const seed = readRepo("packages/db/prisma/seed-data/help-center.ts");
    const fallback = read("src/lib/help-fallback.ts");
    const api = read("src/app/api/help/route.ts");

    expect(seed).not.toContain("Regular security audits");
    expect(seed).not.toContain("All personal data is deleted immediately");
    expect(seed).not.toContain("comply with applicable privacy laws");
    expect(fallback).toContain("Some backups, billing records, audit logs");
    expect(api).toContain("regular security audits");
    expect(api).toContain("all personal data is deleted immediately");
  });

  it("sitemap keeps help private and includes billing/refund policy routes", () => {
    const sitemap = read("src/app/sitemap.ts");
    const robots = read("src/app/robots.ts");
    const middleware = read("src/middleware.ts");

    expect(sitemap).toContain('path: "/billing-policy"');
    expect(sitemap).toContain('path: "/refund"');
    expect(sitemap).not.toContain('path: "/help"');
    expect(robots).toContain('"/help"');
    expect(middleware).toContain('pathname.startsWith("/help")');
  });

  it("analytics does not send raw search query metadata", () => {
    const webAnalytics = read("src/lib/analytics.ts");
    const mobileAnalytics = readRepo("apps/mobile/src/lib/analytics.ts");
    const trackingRoute = read("src/app/api/tracking/event/route.ts");

    expect(webAnalytics).toContain("{ query_length: query.length }");
    expect(mobileAnalytics).toContain("{ query_length: query.length }");
    expect(mobileAnalytics).not.toContain("{ query }");
    expect(trackingRoute).toContain("sanitizeMetadata");
    expect(trackingRoute).toContain("SAFE_AGGREGATE_KEYS");
  });
});
