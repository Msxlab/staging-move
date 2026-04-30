/**
 * GET /api/blog/posts/[slug]
 *
 * Single-post JSON. The mobile app caches the response for offline
 * reading; web consumers (RSS plug-ins, link previews) get the same
 * shape. `contentHtml` is the already-sanitized HTML stored at write
 * time — clients can inject it directly.
 */

export const dynamic = "force-dynamic";
export const revalidate = 600;

import { NextRequest, NextResponse } from "next/server";
import { getPublicPostBySlug } from "@/lib/blog/queries";
import { DEFAULT_BLOG_LOCALE, isBlogLocale } from "@locateflow/shared";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const localeParam = new URL(req.url).searchParams.get("locale");
  const post = await getPublicPostBySlug(
    slug,
    isBlogLocale(localeParam) ? localeParam : DEFAULT_BLOG_LOCALE,
  );
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(post, {
    headers: {
      "cache-control": "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
    },
  });
}
