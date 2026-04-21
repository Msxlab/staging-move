import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Check, Languages } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { LOCALES, changeLocale, type Locale } from "@/i18n/config";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

/**
 * Mobile language selector. Used inside the More / Settings screen.
 *
 * Clicking a language:
 *   1. Persists the choice to AsyncStorage via `changeLocale`.
 *   2. Calls `i18n.changeLanguage` so every screen using
 *      `useTranslation()` re-renders with new strings.
 *   3. For logged-in users, syncs the preference to the server via
 *      `/api/user/locale` so the choice follows the user across
 *      devices (the web app reads `User.preferredLocale` on next
 *      login and seeds its cookie from it).
 */

const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const currentLocale = (i18n.language as Locale) || "en";
  const token = useAuthStore((s) => s.token);

  async function handleChange(next: Locale) {
    if (next === currentLocale) return;
    await changeLocale(next);
    if (token) {
      // Best-effort sync; failures are non-blocking — the local pref
      // is already persisted to AsyncStorage.
      void api
        .post("/api/user/locale", { locale: next })
        .catch(() => null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Languages size={18} color={theme.colors.textSecondary} />
        <Text style={styles.title}>Language / Idioma</Text>
      </View>
      {LOCALES.map((loc) => {
        const active = loc === currentLocale;
        return (
          <TouchableOpacity
            key={loc}
            onPress={() => handleChange(loc)}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={LOCALE_NAMES[loc]}
            style={[styles.row, active && styles.rowActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {LOCALE_NAMES[loc]}
            </Text>
            {active && <Check size={18} color={theme.colors.primary} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  rowActive: {
    backgroundColor: theme.colors.primaryFaded,
  },
  label: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "500",
  },
  labelActive: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
});
