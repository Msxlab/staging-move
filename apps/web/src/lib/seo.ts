export const SITE_NAME = "LocateFlow";
export const SITE_TITLE = "LocateFlow - Track every provider tied to your addresses";
export const SITE_DESCRIPTION =
  "Keep a living list of every utility, bank, insurance, and subscription tied to your homes. Never lose track of who has your address again.";
export const DEFAULT_OG_IMAGE = "/og-image.svg";

const DEFAULT_PUBLIC_SITE_URL = "https://locateflow.app";
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
