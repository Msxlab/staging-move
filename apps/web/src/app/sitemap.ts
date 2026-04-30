import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { blogHreflangUrls, blogPostUrl } from "@/lib/blog/urls";

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://locateflow.app").replace(/\/+$/, "");

export const revalidate = 600; // 10 min — publish webhook also forces revalidate

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Static marketing/legal pages — order roughly mirrors human nav.
  // Priority is a hint, not a directive; Google ignores absolute
  // values but uses them to compare URLs within the same sitemap.
  const staticRoutes: Array<{
    path: string;
    changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
    priority: number;
  }> = [
    { path: "", changeFrequency: "weekly", priority: 1.0 },
    { path: "/how-it-works", changeFrequency: "monthly", priority: 0.8 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
    { path: "/blog", changeFrequency: "daily", priority: 0.9 },
    { path: "/faq", changeFrequency: "monthly", priority: 0.7 },
    { path: "/sign-in", changeFrequency: "monthly", priority: 0.6 },
    { path: "/sign-up", changeFrequency: "monthly", priority: 0.7 },
    { path: "/forgot-password", changeFrequency: "yearly", priority: 0.3 },
    { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
    { path: "/cookie-policy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/disclaimer", changeFrequency: "yearly", priority: 0.3 },
    { path: "/refund", changeFrequency: "yearly", priority: 0.3 },
    { path: "/acceptable-use", changeFrequency: "yearly", priority: 0.3 },
    { path: "/dpa", changeFrequency: "yearly", priority: 0.3 },
    { path: "/security", changeFrequency: "yearly", priority: 0.3 },
    { path: "/ccpa-privacy-notice", changeFrequency: "yearly", priority: 0.3 },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
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
    blogEntries = posts.map((p) => ({
      url: blogPostUrl(SITE_URL, p.slug, p.locale),
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
      alternates: {
        languages: blogHreflangUrls(SITE_URL, p.slug),
      },
    }));
  } catch {
    // DB unavailable at build time (e.g. CI without mysql). Fall back
    // to static entries; the next ISR refresh will pick up posts.
    blogEntries = [];
  }

  return [...staticEntries, ...blogEntries];
}
