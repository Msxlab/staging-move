/**
 * /blog/feed.xml — RSS 2.0
 *
 * Standard RSS for feed readers. We do NOT include the full HTML
 * body (some readers misrender our typography); just title +
 * excerpt + link, plus dc:creator and pubDate. Atom is at
 * /blog/atom.xml if a reader prefers that format.
 */

export const dynamic = "force-dynamic";
export const revalidate = 600;

import { NextResponse } from "next/server";
import { listPublicPosts } from "@/lib/blog/queries";
import { blogPostUrl } from "@/lib/blog/urls";
import { SITE_URL } from "@/lib/seo";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const { items } = await listPublicPosts({ pageSize: 30 }).catch(() => ({
    items: [],
  }));

  const itemsXml = items
    .map((p) => {
      const url = blogPostUrl(SITE_URL, p.slug, p.locale);
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(p.excerpt)}</description>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
      ${p.category ? `<category>${escapeXml(p.category.name)}</category>` : ""}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>LocateFlow Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Stories, guides, and product updates from the LocateFlow team.</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}/blog/feed.xml" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
