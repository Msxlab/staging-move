/** Mirrors apps/web/src/i18n/config.ts — admin ships the same locale
 * set. Kept in sync manually; if we ever extract a shared i18n preset
 * it should live in `packages/shared`. */

export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

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

export function resolveLocale(
  cookieValue: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  return matchLocale(acceptLanguage);
}

export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
