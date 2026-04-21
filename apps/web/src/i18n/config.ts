/**
 * Supported locales across the web app.
 *
 * Design doc: the audit (§2.11 Performans/A11y/i18n) flagged Spanish
 * as a business-critical second locale for the US Hispanic market
 * (~19% of US population). EN + ES is the launch set; adding a third
 * locale means extending this tuple and creating a matching
 * `messages/<locale>.json`. Nothing else in the codebase hardcodes
 * the locale list — everything reads from here.
 */

export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

/** Returns true when `value` is one of the supported locales. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/**
 * Parse an `Accept-Language` header into the best matching supported
 * locale. Falls back to `defaultLocale` when no match. Keeps weighting
 * simple — full q-value parsing is overkill for a two-locale set.
 */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale;
  const candidates = acceptLanguage
    .split(",")
    .map((entry) => entry.split(";")[0].trim().toLowerCase())
    .filter(Boolean);
  for (const candidate of candidates) {
    const primary = candidate.split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return defaultLocale;
}

/**
 * Resolve the effective locale from (cookie, accept-language). The
 * cookie wins because it represents an explicit user choice; the
 * header is a fallback for first-visit detection.
 */
export function resolveLocale(
  cookieValue: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  return matchLocale(acceptLanguage);
}

export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
