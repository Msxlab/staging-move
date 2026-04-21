export const SITE_NAME = "LocateFlow";
export const SITE_TITLE = "LocateFlow — Track every provider tied to your addresses";
export const SITE_DESCRIPTION =
  "Keep a living list of every utility, bank, insurance, and subscription tied to your homes. Never lose track of who has your address again.";
export const DEFAULT_OG_IMAGE = "/og-image.svg";

export function absoluteUrl(path = "/") {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return new URL(path, base).toString();
}
