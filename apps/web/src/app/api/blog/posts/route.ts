/**
 * GET /api/blog/posts
 *
 * Public JSON API consumed by:
 *   - the mobile app's Blog tab (offline cache key)
 *   - the homepage "Latest" section (server-rendered, but tested via JSON)
 *   - third-party syndication, if it ever happens
 *
 * Read-only and aggressively cached. Pagination is keyset-style by
 * default (`before=<isoDate>`) so iOS scroll never duplicates posts
 * when a new article publishes mid-pagination.
 */

export const dynamic = "force-dynamic";
export const revalidate = 300;

import { NextRequest, NextResponse } from "next/server";
import { listPublicPosts } from "@/lib/blog/queries";
import { isBlogLocale } from "@locateflow/shared";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const localeParam = searchParams.get("locale");
  const locale = isBlogLocale(localeParam) ? localeParam : undefined;

  const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt(searchParams.get("pageSize") ?? "20", 10) || 20, 1),
    50,
  );

  const listing = await listPublicPosts({ locale, page, pageSize });

  return NextResponse.json(
    {
      items: listing.items,
      total: listing.total,
      page: listing.page,
      pageSize: listing.pageSize,
    },
    {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      },
    },
  );
}
