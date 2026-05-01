/**
 * Blog primitives shared across web, admin, and mobile.
 *
 * Stays dependency-free (no Node, no DOM) so it can be imported from
 * the React Native bundle without a Metro shim. Anything that needs
 * jsdom / sanitize-html / jose lives in `apps/web/src/lib/blog/*`.
 */

// ---------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------
//
// US-only launch: English + Spanish. Adding a third locale here is the
// single switch that opens it across web routes, sitemap, hreflang,
// admin "translate" action, and the mobile blog tab.

export const BLOG_LOCALES = ["en", "es"] as const;
export type BlogLocale = (typeof BLOG_LOCALES)[number];
export const DEFAULT_BLOG_LOCALE: BlogLocale = "en";

export function isBlogLocale(value: unknown): value is BlogLocale {
  return typeof value === "string" && (BLOG_LOCALES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------
// Slug
// ---------------------------------------------------------------------
//
// Defensive slug generator: ASCII-only, lowercase, hyphenated. Used
// when the editor leaves the slug field blank — never trust the
// editor's free-form input as a URL path because of confusables (e.g.
// Cyrillic "а" rendering as Latin "a").
//
// `RESERVED_BLOG_SLUGS` blocks paths that collide with our routes. The
// admin endpoint also rejects any slug that starts with these.

const SLUG_DIACRITIC_MAP: Record<string, string> = {
  á: "a", à: "a", â: "a", ä: "a", ã: "a", å: "a", ā: "a",
  é: "e", è: "e", ê: "e", ë: "e", ē: "e",
  í: "i", ì: "i", î: "i", ï: "i", ī: "i",
  ó: "o", ò: "o", ô: "o", ö: "o", õ: "o", ō: "o",
  ú: "u", ù: "u", û: "u", ü: "u", ū: "u",
  ñ: "n",
  ç: "c",
  ý: "y", ÿ: "y",
};

export const RESERVED_BLOG_SLUGS = new Set([
  "category", "tag", "author", "feed", "feed.xml", "atom.xml",
  "preview", "draft", "new", "edit", "api", "admin", "rss",
  "sitemap", "sitemap.xml", "robots.txt", "llms.txt", "page",
]);

export function slugify(input: string): string {
  if (!input) return "";
  let s = input.toLowerCase();
  s = s
    .split("")
    .map((ch) => SLUG_DIACRITIC_MAP[ch] ?? ch)
    .join("");
  // Replace anything that isn't a-z, 0-9, or hyphen with a space — so
  // word boundaries that used to be underscores, slashes, or punctuation
  // become hyphens (`b_c` → `b-c`), not concatenations (`b_c` → `bc`).
  // Keeps URLs ASCII-only, which also keeps share-link analytics
  // readable in dashboards.
  s = s.replace(/[^a-z0-9-]+/g, " ");
  s = s.replace(/\s+/g, "-");
  s = s.replace(/-+/g, "-");
  s = s.replace(/^-+|-+$/g, "");
  // Hard cap matches the DB column (VarChar 191).
  if (s.length > 180) s = s.slice(0, 180).replace(/-+$/g, "");
  return s;
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_BLOG_SLUGS.has(slug);
}

// ---------------------------------------------------------------------
// Reading time
// ---------------------------------------------------------------------
//
// 200 wpm is the median for adult English readers (Brysbaert 2019);
// Spanish reads ~5% slower so we round to the same number. We round
// up — undershooting "3 min read" feels deceptive when it's actually 4.
const WORDS_PER_MINUTE = 200;

export function calculateReadingMinutes(plainText: string): number {
  if (!plainText) return 1;
  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.ceil(words / WORDS_PER_MINUTE);
  return Math.max(1, minutes);
}

// ---------------------------------------------------------------------
// Bot detection (for BlogView.isBot)
// ---------------------------------------------------------------------
//
// Best-effort UA classification — we don't gate access, just split
// the analytics dashboard so organic vs. AI vs. scraper traffic is
// visible without storing raw user-agents indefinitely. Pattern set
// is conservative; new bots get added as they appear in the logs.

const BOT_UA_PATTERN = new RegExp(
  [
    // Search
    "googlebot", "bingbot", "duckduckbot", "yandexbot", "baiduspider", "applebot",
    // AI training / answer engines
    "gptbot", "chatgpt-user", "oai-searchbot", "claudebot", "claude-web",
    "anthropic-ai", "perplexitybot", "google-extended", "ccbot", "applebot-extended",
    "bytespider", "meta-externalagent", "cohere-ai", "duckassistbot", "youbot",
    // Generic crawler/scraper signals
    "facebookexternalhit", "twitterbot", "linkedinbot", "slackbot",
    "telegrambot", "whatsapp", "discordbot",
    "ahrefsbot", "semrushbot", "mj12bot", "dotbot",
    // Self-id'd bots
    "\\bbot\\b", "crawler", "spider", "scrap", "monitor", "headlesschrome",
  ].join("|"),
  "i",
);

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_UA_PATTERN.test(userAgent);
}

// ---------------------------------------------------------------------
// Excerpt generation
// ---------------------------------------------------------------------
//
// Used when the editor leaves the excerpt blank. Truncates to the
// nearest word boundary under `maxLength` and strips trailing
// punctuation so the OG description doesn't end mid-sentence with a
// dangling comma.
export function generateExcerpt(plainText: string, maxLength = 280): string {
  if (!plainText) return "";
  const cleaned = plainText.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  const cut = cleaned.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = (lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut)
    .replace(/[\s.,;:!?]+$/, "");
  return `${trimmed}…`;
}

// ---------------------------------------------------------------------
// Public-facing post shape (what the API returns to clients).
// Server keeps `contentJson`, `contentText`, view counts, etc. private.
// ---------------------------------------------------------------------

export interface PublicBlogPost {
  slug: string;
  locale: BlogLocale;
  title: string;
  excerpt: string;
  contentHtml: string;
  readingMinutes: number;
  publishedAt: string; // ISO 8601
  updatedAt: string;
  ogImageUrl: string | null;
  ogImageAlt: string | null;
  category: { slug: string; name: string } | null;
  tags: Array<{ slug: string; name: string }>;
  author: {
    id: string;
    name: string;
  };
  seo: {
    title: string;
    description: string;
    canonicalUrl: string | null;
    noIndex: boolean;
  };
}

export interface PublicBlogPostSummary {
  slug: string;
  locale: BlogLocale;
  title: string;
  excerpt: string;
  readingMinutes: number;
  publishedAt: string;
  ogImageUrl: string | null;
  category: { slug: string; name: string } | null;
}
