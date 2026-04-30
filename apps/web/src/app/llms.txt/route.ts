import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { blogPostUrl } from "@/lib/blog/urls";

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
export const dynamic = "force-static";
export const revalidate = 3600;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://locateflow.app").replace(/\/+$/, "");
const APP_ENV = (process.env.APP_ENV || "").toLowerCase();
const BLOCK_INDEXING =
  APP_ENV === "staging" ||
  APP_ENV === "preview" ||
  /(?:staging|preview|ondigitalocean\.app|vercel\.app)/i.test(APP_URL);

const STATIC_DOCS = [
  { title: "How LocateFlow works", path: "/how-it-works", note: "Product overview." },
  { title: "Pricing", path: "/pricing", note: "Plans, free trial, refunds." },
  { title: "FAQ", path: "/faq", note: "Common questions about the service." },
  { title: "Security", path: "/security", note: "Data handling, encryption, MFA." },
  { title: "Privacy policy", path: "/privacy", note: "What we collect and why." },
  { title: "Terms of service", path: "/terms", note: "Legal terms." },
  { title: "Contact", path: "/contact", note: "Reach the team." },
];

export async function GET() {
  if (BLOCK_INDEXING) {
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
  lines.push(
    "> Track every utility, bank, insurance, and subscription tied to each of your homes — one dashboard, smart reminders, a one-click moving checklist when you relocate.",
  );
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
  lines.push(`- JSON API: ${APP_URL}/api/blog/posts`);
  lines.push("");

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
