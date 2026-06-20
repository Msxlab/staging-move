import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { SITE_URL, isNoIndexEnvironment, shouldBlockForRequestHosts } from "@/lib/seo";
import { buildLlmsFullTxt } from "@/lib/public-ai-discovery";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { CONSUMER_FREE_FLAG } from "@locateflow/shared";

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
    return new NextResponse("# Not indexed\n", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const consumerFree = await isFeatureEnabled(CONSUMER_FREE_FLAG);
  return new NextResponse(buildLlmsFullTxt({ appUrl: APP_URL, consumerFree }), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

