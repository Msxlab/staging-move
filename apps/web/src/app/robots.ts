import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getCanonicalSiteUrl, isNoIndexEnvironment, shouldBlockForRequestHosts } from "@/lib/seo";

export const dynamic = "force-dynamic";

const APP_URL = getCanonicalSiteUrl();

async function requestHosts(): Promise<Array<string | null>> {
  const h = await headers();
  return [
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      null,
    h.get("host")?.split(",")[0]?.trim() ||
      null,
  ];
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const hosts = await requestHosts();
  const shouldBlockIndexing =
    isNoIndexEnvironment(APP_URL) ||
    shouldBlockForRequestHosts(hosts);

  if (shouldBlockIndexing) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  // Authenticated/private surfaces. Listed once and reused across
  // every UA so a new bot we add at the top of the file doesn't have
  // to remember the disallow set separately.
  const PRIVATE_PATHS = [
    "/dashboard",
    "/settings",
    "/settings/",
    // NOTE: do NOT broadly disallow "/moving" — the public /moving/<state> SEO
    // landing pages (51 of them) live there and must stay crawlable. Only the
    // authenticated move dashboard + detail are private; the dashboard at
    // "/moving" is already auth-gated + X-Robots-Tag noindex'd by middleware.
    "/moving/plan", // authenticated move-detail route
    "/services",
    "/services/",
    "/addresses",
    "/addresses/",
    "/budget",
    "/budget/",
    "/providers",
    "/providers/",
    "/support",
    "/support/",
    "/notifications",
    "/notifications/",
    "/onboarding",
    "/onboarding/",
    "/expenses",
    "/expenses/",
    "/api/",
    "/verify-email/",
    "/reset-password/",
    "/blog/preview/", // signed-token preview links — never index
  ];

  // AI search and training crawlers may access public pages. Private app,
  // token, and API routes stay disallowed for every crawler.
  const AI_BOTS_ALLOW = [
    "OAI-SearchBot",
    "ChatGPT-User",
    "GPTBot",
    "PerplexityBot",
    "ClaudeBot",
    "Google-Extended",
    "CCBot",
    "Bytespider",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      ...AI_BOTS_ALLOW.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: `${APP_URL.replace(/\/+$/, "")}/sitemap.xml`,
    host: APP_URL.replace(/\/+$/, ""),
  };
}
