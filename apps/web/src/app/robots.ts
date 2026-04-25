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

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
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
        ],
      },
    ],
    sitemap: `${APP_URL.replace(/\/+$/, "")}/sitemap.xml`,
  };
}
