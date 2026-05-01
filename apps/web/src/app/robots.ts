import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getCanonicalSiteUrl, isNoIndexEnvironment } from "@/lib/seo";

export const dynamic = "force-dynamic";

const APP_URL = getCanonicalSiteUrl();

function hostLooksLikeStaging(host: string | null): boolean {
  if (!host) return false;
  const normalized = host.toLowerCase();
  return (
    normalized.includes("staging") ||
    normalized.endsWith(".ondigitalocean.app") ||
    normalized.endsWith(".vercel.app")
  );
}

async function requestHost(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    h.get("host")?.split(",")[0]?.trim() ||
    null
  );
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = await requestHost();
  const shouldBlockIndexing =
    isNoIndexEnvironment(APP_URL) ||
    hostLooksLikeStaging(host);

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
    "/settings/",
    "/moving",
    "/moving/",
    "/services",
    "/services/",
    "/addresses",
    "/addresses/",
    "/budget",
    "/budget/",
    "/providers",
    "/providers/",
    "/help",
    "/help/",
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

  // Search/retrieval crawlers may access public pages so answer engines can
  // cite canonical URLs. Broad training crawlers are opted out by default.
  const AI_SEARCH_BOTS_ALLOW = [
    "OAI-SearchBot",
    "ChatGPT-User",
    "PerplexityBot",
    "ClaudeBot",
  ];
  const AI_TRAINING_BOTS_DISALLOW = [
    "GPTBot",
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
      ...AI_SEARCH_BOTS_ALLOW.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
      ...AI_TRAINING_BOTS_DISALLOW.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
    ],
    sitemap: `${APP_URL.replace(/\/+$/, "")}/sitemap.xml`,
    host: APP_URL.replace(/\/+$/, ""),
  };
}
