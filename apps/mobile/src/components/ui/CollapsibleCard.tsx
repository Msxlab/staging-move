import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useAppTheme, type Theme } from "@/lib/theme";

interface CollapsibleCardProps {
  /** Section heading shown in the always-visible header row. */
  title: string;
  /** Optional leading icon (e.g. a lucide icon element). */
  icon?: React.ReactNode;
  /** Whether the body starts expanded. Defaults to collapsed. */
  defaultOpen?: boolean;
  /** Optional trailing element in the header (badge, count, etc.). */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared collapsible section card — reuses the same chevron-toggle pattern as
 * the existing State Guide on moving/[id]. Tames the "wall of cards" by letting
 * heavy secondary sections default-collapse while the primary one stays open.
 *
 * Intentionally no layout animation: RN's LayoutAnimation is fiddly cross-
 * platform and a plain show/hide reads as instant + is reduce-motion-safe by
 * construction (no motion at all). OTA-safe: pure JS + react-native-svg icons.
 */
export function CollapsibleCard({
  title,
  icon,
  defaultOpen = false,
  headerRight,
  children,
}: CollapsibleCardProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.7}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
      >
        <View style={styles.headerLeft}>
          {icon ? <View style={styles.headerIcon}>{icon}</View> : null}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {headerRight}
          {open ? (
            <ChevronUp size={18} color={theme.colors.textMuted} />
          ) : (
            <ChevronDown size={18} color={theme.colors.textMuted} />
          )}
        </View>
      </TouchableOpacity>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      marginTop: 12,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
    headerIcon: { alignItems: "center", justifyContent: "center" },
    title: { fontSize: 15, fontWeight: "700", color: theme.colors.text, flexShrink: 1 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    body: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 2,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
  });
