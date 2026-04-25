import { describe, expect, it } from "vitest";
import { FALLBACK_FAQS, FALLBACK_HELP_ARTICLES } from "./help-fallback";

describe("help fallback content", () => {
  it("provides customer-visible articles and FAQs when the DB is empty", () => {
    expect(FALLBACK_HELP_ARTICLES.length).toBeGreaterThanOrEqual(8);
    expect(FALLBACK_FAQS.length).toBeGreaterThanOrEqual(5);
  });

  it("keeps provider claims scoped to unverified directory guidance", () => {
    const text = JSON.stringify({ articles: FALLBACK_HELP_ARTICLES, faqs: FALLBACK_FAQS }).toLowerCase();
    expect(text).toContain("unverified");
    expect(text).not.toContain("official provider");
    expect(text).not.toContain("verified provider");
  });

  it("does not mention deferred product scopes", () => {
    const text = JSON.stringify({ articles: FALLBACK_HELP_ARTICLES, faqs: FALLBACK_FAQS }).toLowerCase();
    expect(text).not.toContain("family sharing");
    expect(text).not.toContain("pro plan");
    expect(text).not.toContain("partner api");
  });
});
