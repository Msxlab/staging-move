import type { Metadata } from "next";

export const SITE_NAME = "LocateFlow";
export const SITE_TITLE = "LocateFlow - Track every provider tied to your addresses";
export const SITE_DESCRIPTION =
  "Keep a living list of every utility, bank, insurance, and subscription tied to your homes. Never lose track of who has your address again.";
export const DEFAULT_OG_IMAGE = "/opengraph-image";

const DEFAULT_PUBLIC_SITE_URL = "https://locateflow.com";
const DEFAULT_LOCAL_SITE_URL = "http://localhost:3000";
const STAGING_HOST_PATTERN = /(?:staging|preview|ondigitalocean\.app|vercel\.app)/i;
const LOCAL_HOST_PATTERN = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i;

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
  return (
    appEnv === "staging" ||
    appEnv === "preview" ||
    appEnv === "development" ||
    appEnv === "test" ||
    process.env.NODE_ENV !== "production" ||
    STAGING_HOST_PATTERN.test(siteUrl) ||
    isUnsafePublicSiteUrl(siteUrl)
  );
}

export function getGoogleSiteVerification() {
  return (
    process.env.GOOGLE_SITE_VERIFICATION ||
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
    undefined
  );
}

export function staticLastModified() {
  return new Date(process.env.SITE_LAST_MODIFIED || "2026-05-01T00:00:00.000Z");
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
