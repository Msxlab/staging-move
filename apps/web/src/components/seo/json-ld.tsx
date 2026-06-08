/**
 * JSON-LD primitives.
 *
 * Every page that wants structured data renders one of these
 * components. They share a single `<JsonLd>` base that handles the
 * one detail you cannot get wrong: escaping `</` so an attacker who
 * smuggles raw HTML into a string field cannot break out of the
 * `<script>` tag and inject a real `<script>` after it.
 *
 * Reference: Google's structured-data guidelines + OWASP XSS
 * Prevention Cheat Sheet "RULE #3.1 - JavaScript escapes".
 */
import type { ReactElement } from "react";
import { headers } from "next/headers";

interface JsonLdProps {
  data: Record<string, unknown>;
  /** Optional id so a page can render multiple ld+json blocks safely. */
  id?: string;
}

// U+2028 / U+2029 are valid in JSON strings but legacy JS parsers
// treated them as line terminators. Modern JSON.parse handles them,
// but we still escape so the rendered ld+json round-trips through any
// embedded script context. Built via fromCharCode to keep the source
// file ASCII-only (the literals here used to choke the TS parser).
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

/**
 * Strict JSON serializer for ld+json. We sanitize:
 *   - `</` so the closing-script-tag breakout is impossible
 *   - U+2028 / U+2029 (legacy JS line terminators)
 */
function safeStringify(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .split(LS)
    .join("\\u2028")
    .split(PS)
    .join("\\u2029");
}

export async function JsonLd({ data, id }: JsonLdProps): Promise<ReactElement> {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <script
      type="application/ld+json"
      id={id}
      nonce={nonce}
      suppressHydrationWarning
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: safeStringify(data) }}
    />
  );
}

// ---------------------------------------------------------------------
// Schema builders
// ---------------------------------------------------------------------

interface SiteContext {
  siteUrl: string;
  siteName: string;
  logoUrl: string;
}

export function organizationSchema(ctx: SiteContext) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${ctx.siteUrl}#organization`,
    name: ctx.siteName,
    url: ctx.siteUrl,
    logo: {
      "@type": "ImageObject",
      url: ctx.logoUrl,
    },
    // OWNER ACTION: `sameAs` is intentionally left empty. It must list the
    // brand's REAL, official profile URLs (e.g. the company's own LinkedIn,
    // X/Twitter, Facebook, Instagram, YouTube, GitHub pages) so crawlers can
    // reconcile the entity. Do NOT invent or guess these — none exist in the
    // codebase/config today, so an empty array is the honest value. Fill it in
    // once the owner confirms the actual handles.
    sameAs: [],
  };
}

export function webSiteSchema(ctx: SiteContext) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${ctx.siteUrl}#website`,
    url: ctx.siteUrl,
    name: ctx.siteName,
    // English (US) only. The marketing surface is served from a single set of
    // URLs whose `<html lang>` is en for crawlers; there are NO distinct
    // `/es/` alternate URLs, so claiming site-wide `es-US` here advertised
    // Spanish pages that don't exist. The blog still emits a per-post `es-US`
    // hreflang *conditionally* (only when a real Spanish post exists at
    // `?locale=es`) via `blogHreflangUrls`, which is the honest, URL-backed
    // place for that claim.
    inLanguage: "en-US",
    publisher: { "@id": `${ctx.siteUrl}#organization` },
  };
}

export function webPageSchema(
  ctx: SiteContext,
  input: { url: string; name: string; description: string; inLanguage?: string },
) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${input.url}#webpage`,
    url: input.url,
    name: input.name,
    description: input.description,
    inLanguage: input.inLanguage || "en-US",
    isPartOf: { "@id": `${ctx.siteUrl}#website` },
    publisher: { "@id": `${ctx.siteUrl}#organization` },
  };
}

export function softwareApplicationSchema(
  ctx: SiteContext,
  opts: { description: string; priceCurrency?: string; price?: string },
) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: ctx.siteName,
    url: ctx.siteUrl,
    operatingSystem: "Web, iOS, Android",
    applicationCategory: "ProductivityApplication",
    description: opts.description,
    publisher: { "@id": `${ctx.siteUrl}#organization` },
  };

  if (opts.price !== undefined) {
    schema.offers = {
      "@type": "Offer",
      price: opts.price,
      priceCurrency: opts.priceCurrency ?? "USD",
    };
  }

  return schema;
}

export function collectionPageSchema(
  ctx: SiteContext,
  input: { url: string; name: string; description: string; inLanguage?: string },
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${input.url}#collectionpage`,
    url: input.url,
    name: input.name,
    description: input.description,
    inLanguage: input.inLanguage || "en-US",
    isPartOf: { "@id": `${ctx.siteUrl}#website` },
    publisher: { "@id": `${ctx.siteUrl}#organization` },
  };
}

export interface ArticleSchemaInput {
  url: string;
  headline: string;
  description: string;
  image: string | null;
  datePublished: string;
  dateModified: string;
  authorName: string;
  authorUrl?: string;
  inLanguage: "en-US" | "es-US";
  wordCount?: number;
  keywords?: string[];
  articleSection?: string;
}

export function articleSchema(ctx: SiteContext, input: ArticleSchemaInput) {
  const keywords = input.keywords?.filter(Boolean) ?? [];
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
    headline: input.headline,
    description: input.description,
    image: input.image ? [input.image] : undefined,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    inLanguage: input.inLanguage,
    wordCount: input.wordCount,
    keywords: keywords.length > 0 ? keywords : undefined,
    articleSection: input.articleSection,
    author: {
      "@type": "Person",
      name: input.authorName,
      url: input.authorUrl,
    },
    publisher: {
      "@type": "Organization",
      name: ctx.siteName,
      logo: { "@type": "ImageObject", url: ctx.logoUrl },
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface FAQItem {
  question: string;
  answer: string;
}

export function faqPageSchema(items: FAQItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
  };
}

export interface HowToStep {
  /** Short imperative step name (the visible heading on the page). */
  name: string;
  /** The step's body copy, verbatim from the page. */
  text: string;
  /** Optional deep link to the step's anchor / section URL. */
  url?: string;
}

export interface HowToSchemaInput {
  name: string;
  description: string;
  steps: HowToStep[];
  inLanguage?: string;
}

/**
 * HowTo structured data for genuinely procedural pages.
 *
 * Every `step` MUST mirror a step that is actually rendered on the page —
 * Google requires the structured data to match visible content, and we never
 * want the rich result to describe a procedure the reader can't see. Empty /
 * whitespace-only steps are dropped so a partially-populated list can't emit a
 * malformed `HowToStep`.
 */
export function howToSchema(input: HowToSchemaInput) {
  const steps = input.steps
    .filter((s) => s.name.trim() && s.text.trim())
    .map((s, i) => {
      const step: Record<string, unknown> = {
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: s.text,
      };
      if (s.url) step.url = s.url;
      return step;
    });

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    inLanguage: input.inLanguage || "en-US",
    step: steps,
  };
}
