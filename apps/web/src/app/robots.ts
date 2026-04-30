import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://locateflow.app";
const APP_ENV = (process.env.APP_ENV || "").toLowerCase();

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
    APP_ENV === "staging" ||
    APP_ENV === "preview" ||
    /(?:staging|preview|ondigitalocean\.app|vercel\.app)/i.test(APP_URL) ||
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
    "/api/",
    "/verify-email/",
    "/reset-password/",
    "/blog/preview/", // signed-token preview links — never index
  ];

  // Explicit Allow for known AI crawlers gives us two things:
  //   1. A clear signal that this content is opt-in for AI training
  //      and answer-engine retrieval (so cited responses can link
  //      back to the canonical post).
  //   2. A single place to flip the policy per-bot if the analytics
  //      dashboard later shows a bot abusing rate limits.
  // Bytespider (TikTok) defaults to Disallow because the value-back
  // is unclear and it's been flagged for aggressive scraping; flip
  // to Allow if needed.
  const AI_BOTS_ALLOW = [
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    "PerplexityBot",
    "Google-Extended",
    "CCBot",
    "Applebot-Extended",
    "meta-externalagent",
    "cohere-ai",
    "DuckAssistBot",
    "YouBot",
  ];
  const AI_BOTS_DISALLOW = ["Bytespider"];

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
      ...AI_BOTS_DISALLOW.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
    ],
    sitemap: `${APP_URL.replace(/\/+$/, "")}/sitemap.xml`,
    host: APP_URL.replace(/\/+$/, ""),
  };
}
