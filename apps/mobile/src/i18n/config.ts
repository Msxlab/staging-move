import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./messages/en.json";
import es from "./messages/es.json";

/**
 * Mobile i18n setup.
 *
 * Locale priority: stored preference (AsyncStorage) → device locale
 * (expo-localization) → default "en". The preference is persisted on
 * device so the next launch skips detection and respects the user's
 * explicit choice. Logged-in users also sync their preference through
 * `/api/user/locale` so it follows them between devices — the
 * LanguageSelector component handles that round trip.
 */

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const STORAGE_KEY = "locateflow.locale";

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

function detectDeviceLocale(): Locale {
  try {
    const locales = getLocales?.() ?? [];
    for (const loc of locales) {
      const primary = (loc?.languageCode ?? "").toLowerCase();
      if (isSupportedLocale(primary)) return primary;
    }
  } catch {
    /* expo-localization unavailable — fall through */
  }
  return DEFAULT_LOCALE;
}

export async function resolveInitialLocale(): Promise<Locale> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (isSupportedLocale(stored)) return stored;
  } catch {
    /* storage failure — fall through */
  }
  return detectDeviceLocale();
}

export async function persistLocale(locale: Locale): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* non-blocking — session continues in memory */
  }
}

export async function initI18n(): Promise<void> {
  const initialLocale = await resolveInitialLocale();
  await i18n.use(initReactI18next).init({
    compatibilityJSON: "v4",
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export async function changeLocale(locale: Locale): Promise<void> {
  await persistLocale(locale);
  await i18n.changeLanguage(locale);
}

export { i18n };
export default i18n;
