import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, resolveLocale } from "./config";

/**
 * Per-request next-intl configuration.
 *
 * We use COOKIE-BASED locale selection, not path-based
 * (`/en/...` vs `/es/...`). URL cleanliness wins for our audience;
 * SEO discoverability is handled via `<link rel="alternate" hreflang>`
 * tags on marketing pages. The locale resolves from:
 *
 *   1. `NEXT_LOCALE` cookie (explicit user choice, persisted 1 year)
 *   2. `Accept-Language` request header (first-visit auto-detect)
 *   3. `defaultLocale` ("en")
 *
 * Logged-in users' choice is mirrored to `User.preferredLocale` via
 * the `/api/user/locale` endpoint so the preference follows them
 * across devices; the same endpoint refreshes the cookie so the two
 * sources never drift.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerList = await headers();

  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;
  const acceptLanguage = headerList.get("accept-language");
  const locale = resolveLocale(cookieValue, acceptLanguage);

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    // Empty-bucket translations (common formatting shortcuts that
    // components can reach via `useFormatter()` instead of creating
    // their own Intl instances).
    now: new Date(),
    timeZone: "UTC",
  };
});
