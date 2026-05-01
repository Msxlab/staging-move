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
 * Prevention Cheat Sheet "RULE #3.1 — JavaScript escapes".
 */
import type { ReactElement } from "react";

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

export function JsonLd({ data, id }: JsonLdProps): ReactElement {
  return (
    <script
      type="application/ld+json"
      id={id}
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
    inLanguage: ["en-US", "es-US"],
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
}

export function articleSchema(ctx: SiteContext, input: ArticleSchemaInput) {
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
