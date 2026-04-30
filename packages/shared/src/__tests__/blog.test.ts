import { describe, expect, it } from "vitest";
import {
  BLOG_LOCALES,
  DEFAULT_BLOG_LOCALE,
  calculateReadingMinutes,
  generateExcerpt,
  isBlogLocale,
  isBotUserAgent,
  isReservedSlug,
  slugify,
} from "../blog";

describe("blog locale", () => {
  it("only ships en + es (US-only launch)", () => {
    expect([...BLOG_LOCALES]).toEqual(["en", "es"]);
    expect(DEFAULT_BLOG_LOCALE).toBe("en");
  });

  it("isBlogLocale rejects unsupported locales", () => {
    expect(isBlogLocale("en")).toBe(true);
    expect(isBlogLocale("es")).toBe(true);
    expect(isBlogLocale("tr")).toBe(false);
    expect(isBlogLocale("fr")).toBe(false);
    expect(isBlogLocale(undefined)).toBe(false);
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips diacritics for ES content", () => {
    expect(slugify("Cómo organizar tu mudanza")).toBe("como-organizar-tu-mudanza");
    expect(slugify("Niño feliz")).toBe("nino-feliz");
  });

  it("collapses repeated separators", () => {
    expect(slugify("a---b__c   d")).toBe("a-b-c-d");
  });

  it("strips emoji and punctuation", () => {
    expect(slugify("10 Tips for Moving! 🏠")).toBe("10-tips-for-moving");
  });

  it("rejects non-Latin script (defense against URL spoofing)", () => {
    // Cyrillic 'а', 'е' that look like Latin 'a', 'e'
    expect(slugify("аеiou")).toBe("iou");
  });

  it("trims trailing hyphens", () => {
    expect(slugify("---hello---")).toBe("hello");
  });

  it("caps length at 180", () => {
    const long = "a".repeat(300);
    expect(slugify(long).length).toBeLessThanOrEqual(180);
  });

  it("returns empty string on empty input", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});

describe("isReservedSlug", () => {
  it("blocks slugs that collide with our routes", () => {
    expect(isReservedSlug("api")).toBe(true);
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("category")).toBe(true);
    expect(isReservedSlug("preview")).toBe(true);
    expect(isReservedSlug("how-i-moved-to-austin")).toBe(false);
  });
});

describe("calculateReadingMinutes", () => {
  it("returns at least 1 for any non-empty content", () => {
    expect(calculateReadingMinutes("hello")).toBe(1);
  });

  it("rounds up so estimates never undershoot", () => {
    // 250 words at 200wpm = 1.25 → 2 min
    const text = Array.from({ length: 250 }, (_, i) => `word${i}`).join(" ");
    expect(calculateReadingMinutes(text)).toBe(2);
  });

  it("handles long-form posts", () => {
    const text = Array.from({ length: 2000 }, (_, i) => `word${i}`).join(" ");
    expect(calculateReadingMinutes(text)).toBe(10);
  });
});

describe("isBotUserAgent", () => {
  it("flags AI training crawlers", () => {
    expect(isBotUserAgent("Mozilla/5.0 (compatible; GPTBot/1.2)")).toBe(true);
    expect(isBotUserAgent("ClaudeBot/1.0")).toBe(true);
    expect(isBotUserAgent("PerplexityBot/1.0 (+https://perplexity.ai/bot)")).toBe(true);
  });

  it("flags search crawlers", () => {
    expect(isBotUserAgent("Googlebot/2.1")).toBe(true);
    expect(isBotUserAgent("bingbot/2.0")).toBe(true);
  });

  it("does not flag normal browsers", () => {
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
      ),
    ).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isBotUserAgent(null)).toBe(false);
    expect(isBotUserAgent(undefined)).toBe(false);
  });
});

describe("generateExcerpt", () => {
  it("returns the input unchanged when short enough", () => {
    expect(generateExcerpt("hello world")).toBe("hello world");
  });

  it("trims at word boundary with ellipsis", () => {
    const text = "lorem ipsum ".repeat(100);
    const out = generateExcerpt(text, 60);
    expect(out.length).toBeLessThanOrEqual(61);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/[\s,;.]…$/);
  });

  it("collapses whitespace", () => {
    expect(generateExcerpt("hello   world\n\nfoo")).toBe("hello world foo");
  });
});
