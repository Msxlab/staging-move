import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { SITE_URL, isNoIndexEnvironment, shouldBlockForRequestHosts } from "@/lib/seo";
import { buildLlmsTxt, listLlmsBlogPosts } from "@/lib/public-ai-discovery";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { CONSUMER_FREE_FLAG } from "@locateflow/shared";

/**
 * `/llms.txt` - emerging-standard discovery file for AI crawlers.
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
const BLOCK_INDEXING = isNoIndexEnvironment(APP_URL);

async function requestHostShouldBlockIndexing() {
  const h = await headers();
  const forwardedHost =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    null;
  const host =
    h.get("host")?.split(",")[0]?.trim() ||
    null;
  return shouldBlockForRequestHosts([forwardedHost, host]);
}

export async function GET() {
  if (BLOCK_INDEXING || (await requestHostShouldBlockIndexing())) {
    // Staging/preview: emit a deliberately empty file so accidental
    // crawls of these hosts don't pull synthetic content into model
    // training datasets.
    return new NextResponse("# Not indexed\n", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const [posts, consumerFree] = await Promise.all([
    listLlmsBlogPosts(),
    isFeatureEnabled(CONSUMER_FREE_FLAG),
  ]);
  const body = buildLlmsTxt({ appUrl: APP_URL, posts, consumerFree });

  return new NextResponse(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
