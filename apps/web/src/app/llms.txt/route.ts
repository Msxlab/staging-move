import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { blogPostUrl } from "@/lib/blog/urls";
import { SITE_URL, isNoIndexEnvironment } from "@/lib/seo";

/**
 * `/llms.txt` — emerging-standard discovery file for AI crawlers.
 *
 * The convention (https://llmstxt.org) gives answer-engines a curated,
 * machine-friendly map of the site so they don't have to spider every
 * route. We emit:
 *   - top-level marketing/info pages (what the product is)
 *   - the most recent N PUBLISHED blog posts (what's fresh)
 * with stable, minimal markdown so the file diffs cleanly when posts
 * publish.
 *
 * Cached at the edge for an hour because it's a low-velocity surface;
 * the publish webhook calls `revalidatePath('/llms.txt')` on demand
 * when an editor publishes so freshness never lags more than seconds.
 */
export const dynamic = "force-dynamic";
export const revalidate = 3600;

const APP_URL = SITE_URL;
const STAGING_HOST_PATTERN = /(?:staging|preview|ondigitalocean\.app|vercel\.app)/i;
const BLOCK_INDEXING = isNoIndexEnvironment(APP_URL);

async function requestHostLooksStaging() {
  const h = await headers();
  const host =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    h.get("host")?.split(",")[0]?.trim() ||
    "";
  return STAGING_HOST_PATTERN.test(host);
}

const STATIC_DOCS = [
  { title: "About LocateFlow", path: "/about", note: "Plain-language product and entity definition." },
  { title: "How LocateFlow works", path: "/how-it-works", note: "Product overview." },
  { title: "Pricing", path: "/pricing", note: "Plans, free trial, refunds." },
  { title: "Provider coverage", path: "/provider-coverage", note: "Provider availability and verification limits." },
  { title: "FAQ", path: "/faq", note: "Common questions about the service." },
  { title: "Security", path: "/security", note: "Data handling, encryption, MFA." },
  { title: "Privacy policy", path: "/privacy", note: "What we collect and why." },
  { title: "Data export and deletion", path: "/data-deletion", note: "Export, deletion, and retention limits." },
  { title: "Terms of service", path: "/terms", note: "Legal terms." },
  { title: "Billing policy", path: "/billing-policy", note: "Subscription, cancellation, and refund terms." },
  { title: "Contact", path: "/contact", note: "Reach the team." },
];

export async function GET() {
  if (BLOCK_INDEXING || (await requestHostLooksStaging())) {
    // Staging/preview: emit a deliberately empty file so accidental
    // crawls of these hosts don't pull synthetic content into model
    // training datasets.
    return new NextResponse("# Not indexed\n", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  let posts: Array<{
    slug: string;
    locale: string;
    title: string;
    excerpt: string | null;
    publishedAt: Date | null;
  }> = [];
  try {
    posts = await prisma.blogPost.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: new Date() },
        deletedAt: null,
        noIndex: false,
      },
      select: {
        slug: true,
        locale: true,
        title: true,
        excerpt: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });
  } catch {
    posts = [];
  }

  const lines: string[] = [];
  lines.push("# LocateFlow");
  lines.push("");
  lines.push("Last updated: 2026-05-01");
  lines.push("");
  lines.push(
    "> LocateFlow is a web app for organizing address-tied services, renewal reminders, moving tasks, household documents, and exportable relocation records.",
  );
  lines.push("");
  lines.push("Pricing summary: public pricing may include an Individual Monthly option at $3.99/month and an Individual Annual option at $39.99/year. Annual promotional checkout can include a 90-day free trial when the active campaign is configured, and checkout controls the final trial, payment-method, renewal, and cancellation disclosure.");
  lines.push("");
  lines.push("Public crawl policy: search and answer-engine retrieval crawlers may read the public pages listed here. Authenticated app routes, admin routes, token routes, and private APIs are intentionally excluded.");
  lines.push("");
  lines.push("## Docs");
  for (const doc of STATIC_DOCS) {
    lines.push(`- [${doc.title}](${APP_URL}${doc.path}): ${doc.note}`);
  }
  lines.push("");
  lines.push("## Blog");
  if (posts.length === 0) {
    lines.push("(No posts yet.)");
  } else {
    for (const post of posts) {
      const url = blogPostUrl(APP_URL, post.slug, post.locale);
      const excerpt = (post.excerpt || "").replace(/\s+/g, " ").trim().slice(0, 200);
      lines.push(`- [${post.title}](${url}): ${excerpt}`);
    }
  }
  lines.push("");
  lines.push("## Feeds");
  lines.push(`- Sitemap: ${APP_URL}/sitemap.xml`);
  lines.push(`- RSS: ${APP_URL}/blog/feed.xml`);
  lines.push(`- Atom: ${APP_URL}/blog/atom.xml`);
  lines.push("");

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
