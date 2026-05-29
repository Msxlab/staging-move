import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { listPublicCategories } from "@/lib/blog/queries";
import { blogCategoryUrl, blogHreflangUrls, blogPostUrl } from "@/lib/blog/urls";
import { SITE_URL, isNoIndexEnvironment, staticLastModified } from "@/lib/seo";

// Generate at request time so the blog query always runs against the live
// DB. Previously this was ISR (`revalidate: 600`), which meant the route
// was prerendered at `next build` — and when the build container could not
// reach the DB the silent catch returned an empty blog list, then ISR
// cached that empty result indefinitely until something forced a
// revalidate. llms.txt and robots.ts already use force-dynamic for the
// same reason; sitemap should match.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isNoIndexEnvironment(SITE_URL)) {
    return [];
  }

  const now = new Date();
  const staticLastmod = staticLastModified();

  // Static marketing/legal pages — order roughly mirrors human nav.
  // Priority is a hint, not a directive; Google ignores absolute
  // values but uses them to compare URLs within the same sitemap.
  const staticRoutes: Array<{
    path: string;
    changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
    priority: number;
  }> = [
    { path: "", changeFrequency: "weekly", priority: 1.0 },
    { path: "/about", changeFrequency: "monthly", priority: 0.7 },
    { path: "/how-it-works", changeFrequency: "monthly", priority: 0.8 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
    { path: "/blog", changeFrequency: "daily", priority: 0.9 },
    { path: "/faq", changeFrequency: "monthly", priority: 0.7 },
    { path: "/help", changeFrequency: "weekly", priority: 0.8 },
    { path: "/provider-coverage", changeFrequency: "monthly", priority: 0.6 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
    { path: "/cookie-policy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/disclaimer", changeFrequency: "yearly", priority: 0.3 },
    { path: "/refund", changeFrequency: "yearly", priority: 0.3 },
    { path: "/billing-policy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/data-deletion", changeFrequency: "yearly", priority: 0.3 },
    { path: "/acceptable-use", changeFrequency: "yearly", priority: 0.3 },
    { path: "/dpa", changeFrequency: "yearly", priority: 0.3 },
    { path: "/security", changeFrequency: "yearly", priority: 0.3 },
    { path: "/ccpa-privacy-notice", changeFrequency: "yearly", priority: 0.3 },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: staticLastmod,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Blog posts — only PUBLISHED, non-noIndex, soft-delete-respecting.
  // We hard-cap at 5,000 here; once we cross that we'll switch to a
  // sitemap index with paged children. (Google's per-file limit is
  // 50k; 5k gives us headroom.)
  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const posts = await prisma.blogPost.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: now },
        deletedAt: null,
        noIndex: false,
      },
      select: { slug: true, updatedAt: true, locale: true },
      orderBy: { publishedAt: "desc" },
      take: 5000,
    });
    const localesBySlug = posts.reduce((map, post) => {
      const locales = map.get(post.slug) || [];
      if (!locales.includes(post.locale)) locales.push(post.locale);
      map.set(post.slug, locales);
      return map;
    }, new Map<string, string[]>());
    blogEntries = posts.map((p) => ({
      url: blogPostUrl(SITE_URL, p.slug, p.locale),
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
      alternates: {
        languages: blogHreflangUrls(SITE_URL, p.slug, localesBySlug.get(p.slug)),
      },
    }));
  } catch (err) {
    // DB unreachable from sitemap context. Log so the failure is visible in
    // platform logs instead of silently shipping an empty blog list.
    console.warn("sitemap_blog_query_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    blogEntries = [];
  }

  // Blog category hubs — one indexable page per category that has at least
  // one published post. Same DB-unreachable safety as the post block.
  let categoryEntries: MetadataRoute.Sitemap = [];
  try {
    const categories = await listPublicCategories();
    categoryEntries = categories.map((c) => ({
      url: blogCategoryUrl(SITE_URL, c.slug),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    }));
  } catch (err) {
    console.warn("sitemap_category_query_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    categoryEntries = [];
  }

  return [...staticEntries, ...blogEntries, ...categoryEntries];
}
