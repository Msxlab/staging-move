/**
 * /blog/atom.xml - Atom 1.0 feed.
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

  const updated = items[0]?.publishedAt ?? new Date().toISOString();
  const entries = items
    .map((p) => {
      const url = blogPostUrl(SITE_URL, p.slug, p.locale);
      return `  <entry>
    <title>${escapeXml(p.title)}</title>
    <link href="${escapeXml(url)}" />
    <id>${escapeXml(url)}</id>
    <updated>${new Date(p.publishedAt).toISOString()}</updated>
    <summary>${escapeXml(p.excerpt)}</summary>
  </entry>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Move Blog</title>
  <link href="${SITE_URL}/blog" />
  <link href="${SITE_URL}/blog/atom.xml" rel="self" />
  <id>${SITE_URL}/blog</id>
  <updated>${new Date(updated).toISOString()}</updated>
${entries}
</feed>`;

  return new NextResponse(xml, {
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
