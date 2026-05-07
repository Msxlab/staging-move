import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Check, Palette, Smartphone, Sun, Moon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  useThemePreference,
  type ThemePreference,
} from "@/lib/theme";

/**
 * Mobile appearance selector. Lives inside the Settings screen.
 *
 * Three options:
 *   - System: follow the OS color scheme (default).
 *   - Light: force the Aurora soft-sky paper palette.
 *   - Dark:  force the Aurora navy palette.
 *
 * The pick is persisted by `ThemeProvider` to AsyncStorage under
 * `locateflow.theme.preference`, applied to every consumer of
 * `useThemePreference` / `useAppTheme`, and survives app restarts.
 *
 * Visual + interaction model intentionally mirror `LanguageSelector`
 * so the Settings screen reads as one coherent surface — the user
 * doesn't need to learn a new control.
 */

interface PreferenceCopy {
  label: string;
  description?: string;
  icon: typeof Palette;
}

export function ThemeSelector() {
  const { t } = useTranslation();
  const { preference, setPreference, theme: activeTheme } = useThemePreference();

  // Translate inside the render so locale switches re-flow the labels
  // without remounting the selector.
  const PREFERENCES: ReadonlyArray<{ key: ThemePreference; copy: PreferenceCopy }> = [
    {
      key: "system",
      copy: {
        label: t("settings.appearance_system", { defaultValue: "System" }),
        description: t("settings.appearance_system_hint", {
          defaultValue: "Follow device setting",
        }),
        icon: Smartphone,
      },
    },
    {
      key: "light",
      copy: {
        label: t("settings.appearance_light", { defaultValue: "Light" }),
        icon: Sun,
      },
    },
    {
      key: "dark",
      copy: {
        label: t("settings.appearance_dark", { defaultValue: "Dark" }),
        icon: Moon,
      },
    },
  ];

  const styles = makeStyles(activeTheme);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Palette size={18} color={activeTheme.colors.textSecondary} />
        <Text style={styles.title}>
          {t("settings.appearance", { defaultValue: "Appearance" })}
        </Text>
      </View>
      {PREFERENCES.map(({ key, copy }) => {
        const active = key === preference;
        const Icon = copy.icon;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => {
              if (key !== preference) void setPreference(key);
            }}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={copy.label}
            accessibilityHint={copy.description}
            style={[styles.row, active && styles.rowActive]}
          >
            <View style={styles.iconBox}>
              <Icon
                size={16}
                color={
                  active
                    ? activeTheme.colors.primary
                    : activeTheme.colors.textSecondary
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, active && styles.labelActive]}>
                {copy.label}
              </Text>
              {copy.description ? (
                <Text style={styles.hint}>{copy.description}</Text>
              ) : null}
            </View>
            {active ? (
              <Check size={18} color={activeTheme.colors.primary} />
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Build StyleSheet against the *resolved* theme so the selector itself
// flips palette as soon as the user picks a new option — without
// waiting for the navigator subtree to remount.
function makeStyles(activeTheme: ReturnType<typeof useThemePreference>["theme"]) {
  return StyleSheet.create({
    container: {
      backgroundColor: activeTheme.colors.card,
      borderRadius: activeTheme.radius.lg,
      padding: activeTheme.spacing.md,
      borderWidth: 1,
      borderColor: activeTheme.colors.border,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: activeTheme.spacing.sm,
      marginBottom: activeTheme.spacing.sm,
    },
    title: {
      color: activeTheme.colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: activeTheme.spacing.md,
      paddingVertical: activeTheme.spacing.md,
      paddingHorizontal: activeTheme.spacing.sm,
      borderRadius: activeTheme.radius.md,
    },
    rowActive: {
      backgroundColor: activeTheme.colors.primaryFaded,
    },
    iconBox: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      color: activeTheme.colors.text,
      fontSize: 15,
      fontWeight: "500",
    },
    labelActive: {
      color: activeTheme.colors.primary,
      fontWeight: "600",
    },
    hint: {
      color: activeTheme.colors.textTertiary,
      fontSize: 12,
      marginTop: 2,
    },
  });
}
