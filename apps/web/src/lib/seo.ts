import type { Metadata } from "next";

export const SITE_NAME = "Move";
export const SITE_TITLE = "Move | Moving Checklist, Utility Setup & Provider Tracker";
export const SITE_DESCRIPTION =
  "Plan your move, track every provider tied to your address, organize utilities, subscriptions, documents, reminders, and know what to update before moving day.";
export const DEFAULT_OG_IMAGE = "/opengraph-image";

const DEFAULT_PUBLIC_SITE_URL = "https://locateflow.com";
const DEFAULT_LOCAL_SITE_URL = "http://localhost:3000";
const STAGING_HOST_PATTERN = /(?:staging|preview|ondigitalocean\.app|vercel\.app)/i;
const LOCAL_HOST_PATTERN = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i;
const PRODUCTION_PUBLIC_HOSTS = new Set(["locateflow.com", "www.locateflow.com"]);

export function normalizeSiteUrl(
  value: string | null | undefined,
  fallback = DEFAULT_PUBLIC_SITE_URL,
) {
  const raw = (value || fallback).trim().replace(/\/+$/, "");
  try {
    const url = new URL(raw);
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return fallback.replace(/\/+$/, "");
  }
}

function isProductionLikeEnvironment() {
  const appEnv = (process.env.APP_ENV || "").toLowerCase();
  const vercelEnv = (process.env.VERCEL_ENV || "").toLowerCase();
  return (
    appEnv === "production" ||
    vercelEnv === "production" ||
    process.env.NODE_ENV === "production"
  );
}

export function isUnsafePublicSiteUrl(siteUrl: string) {
  try {
    const url = new URL(siteUrl);
    return (
      url.protocol !== "https:" ||
      LOCAL_HOST_PATTERN.test(url.hostname) ||
      url.hostname.endsWith(".local") ||
      STAGING_HOST_PATTERN.test(url.hostname)
    );
  } catch {
    return true;
  }
}

export function normalizeHost(value: string | null | undefined) {
  const raw = (value || "").split(",")[0]?.trim() || "";
  if (!raw) return "";
  try {
    return new URL(raw).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    const normalized = raw.toLowerCase().replace(/\.$/, "");
    if (normalized.startsWith("[")) {
      const end = normalized.indexOf("]");
      return end > 0 ? normalized.slice(1, end) : normalized;
    }
    return normalized.replace(/:\d+$/, "");
  }
}

export function isProductionPublicHost(host: string | null | undefined) {
  return PRODUCTION_PUBLIC_HOSTS.has(normalizeHost(host));
}

export function isStagingLikeHost(host: string | null | undefined) {
  const normalized = normalizeHost(host);
  return Boolean(normalized) && STAGING_HOST_PATTERN.test(normalized);
}

export function shouldBlockForRequestHosts(hosts: Array<string | null | undefined>) {
  const hasProductionHost = hosts.some(isProductionPublicHost);
  if (hasProductionHost) return false;
  return hosts.some(isStagingLikeHost);
}

export function getCanonicalSiteUrl() {
  const normalized = normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL,
    process.env.NODE_ENV === "production"
      ? DEFAULT_PUBLIC_SITE_URL
      : DEFAULT_LOCAL_SITE_URL,
  );
  if (isProductionLikeEnvironment() && isUnsafePublicSiteUrl(normalized)) {
    return DEFAULT_PUBLIC_SITE_URL;
  }
  return normalized;
}

export const SITE_URL = getCanonicalSiteUrl();

export function isNoIndexEnvironment(siteUrl = SITE_URL) {
  const appEnv = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  const explicitNoIndexEnv =
    appEnv === "staging" ||
    appEnv === "preview" ||
    appEnv === "development" ||
    appEnv === "test";

  if (explicitNoIndexEnv) return true;
  if (isUnsafePublicSiteUrl(siteUrl)) return true;

  // APP_ENV is the deployment's explicit business environment. Treat a
  // production APP_ENV with a safe public canonical as indexable even if a
  // platform accidentally injects a non-production NODE_ENV.
  if (appEnv === "production") return false;

  return process.env.NODE_ENV !== "production" || STAGING_HOST_PATTERN.test(siteUrl);
}

export function getGoogleSiteVerification() {
  return (
    process.env.GOOGLE_SITE_VERIFICATION ||
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
    undefined
  );
}

export function staticLastModified() {
  return new Date(process.env.SITE_LAST_MODIFIED || "2026-05-06T00:00:00.000Z");
}

export function absoluteUrl(path = "/", base = SITE_URL) {
  try {
    return new URL(path).toString();
  } catch {
    return new URL(path, base).toString();
  }
}

export function publicMetadataTitle(title: string) {
  return title === SITE_TITLE || title.includes(SITE_NAME)
    ? title
    : `${title} | ${SITE_NAME}`;
}

export function createPublicPageMetadata(input: {
  title: string;
  description: string;
  path: string;
  imagePath?: string;
  type?: "website" | "article";
}): Metadata {
  const canonicalUrl = absoluteUrl(input.path);
  const imageUrl = absoluteUrl(input.imagePath || DEFAULT_OG_IMAGE);
  const socialTitle = publicMetadataTitle(input.title);

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: input.path,
    },
    openGraph: {
      type: input.type || "website",
      url: canonicalUrl,
      siteName: SITE_NAME,
      title: socialTitle,
      description: input.description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: input.description,
      images: [imageUrl],
    },
  };
}
