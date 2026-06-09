import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { CloudOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";

/**
 * OFFLINE CHIP — a quiet "Offline · last updated {when}" pill shown above the
 * dashboard when the live fetch failed (no signal mid-move) but we successfully
 * hydrated from the last-known offline snapshot. It replaces the hard error wall
 * so the user still sees their move info, with an honest staleness marker.
 *
 * Styling mirrors the existing Badge/chip tokens (warning tone, full-radius pill,
 * faded bg + tone border) so it reads as part of the same design system. Purely
 * presentational + static — reduce-motion-safe by construction (no animation).
 */
export function OfflineChip({ relativeAge }: { relativeAge: string }) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();

  // "Offline · updated 5 minutes ago" when we have a relative age; otherwise a
  // generic "Offline · showing last saved info" so the chip is never half-formed.
  const label = relativeAge
    ? t("dashboard.offlineUpdated", { age: relativeAge })
    : t("dashboard.offlineGeneric");

  return (
    <View
      style={styles.chip}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <CloudOff size={13} color={theme.colors.amber.text} />
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: t.radius.full,
      borderWidth: 1,
      backgroundColor: t.colors.warningFaded,
      borderColor: t.colors.amber.border,
      marginBottom: 16,
    },
    text: {
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.2,
      color: t.colors.amber.text,
    },
  });
