import React, { useMemo } from "react";
import { View, StyleSheet, type ViewStyle, type DimensionValue } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { useAppTheme, type Theme } from "@/lib/theme";

/**
 * Calm, subtle skeleton primitives for loading states. Instead of a centered
 * spinner (the old `<LoadingScreen/>`), screens render their real header plus a
 * few of these placeholder cards — so the layout settles in place and the
 * content "fades in" rather than popping.
 *
 * The shimmer is a single shared opacity loop on the Reanimated UI thread (no
 * setInterval / JS re-render). It honours reduce-motion: when on, the bars sit
 * at a steady mid opacity with no animation, and the loop is cancelled on
 * unmount.
 */

/** A single shimmering bar/box. Width/height/radius are all overridable. */
export function SkeletonBlock({
  width = "100%",
  height = 14,
  radius,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  // 0 → 1 drives opacity 0.5 → 1; reduce-motion pins it mid (~0.7).
  const pulse = useSharedValue(reduceMotion ? 1 : 0);

  React.useEffect(() => {
    if (reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(pulse);
    };
  }, [reduceMotion, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.7 : 0.5 + pulse.value * 0.45,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.borderLight,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/**
 * A placeholder shaped like the app's real content cards: a leading icon disc,
 * a title line + a shorter subtitle line, and an optional footer row. Used to
 * stand in for address / service / moving / dashboard cards while loading.
 */
export function SkeletonCard({
  lines = 2,
  showIcon = true,
  showFooter = false,
  style,
}: {
  lines?: number;
  showIcon?: boolean;
  showFooter?: boolean;
  style?: ViewStyle;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View
      style={[styles.card, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel=""
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.row}>
        {showIcon && <SkeletonBlock width={42} height={42} radius={theme.radius.lg} />}
        <View style={styles.body}>
          <SkeletonBlock width="62%" height={15} />
          {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
            <SkeletonBlock
              key={i}
              width={i === 0 ? "88%" : "70%"}
              height={11}
              style={{ marginTop: 8 }}
            />
          ))}
        </View>
      </View>
      {showFooter && (
        <View style={styles.footer}>
          <SkeletonBlock width={70} height={20} radius={theme.radius.full} />
          <SkeletonBlock width={54} height={20} radius={theme.radius.full} />
        </View>
      )}
    </View>
  );
}

/** Two-up stat-card placeholder grid (dashboard). */
export function SkeletonStatGrid() {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.statGrid}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.statCard}>
          <SkeletonBlock width={20} height={20} radius={theme.radius.sm} />
          <SkeletonBlock width="55%" height={22} style={{ marginTop: 10 }} />
          <SkeletonBlock width="80%" height={11} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: theme.radius.xl,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    body: { flex: 1 },
    footer: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    statCard: {
      width: "47%",
      flexGrow: 1,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      padding: 16,
    },
  });
