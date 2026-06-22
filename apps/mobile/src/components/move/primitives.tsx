import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme, fonts } from "@/lib/theme";

// ──────────────────────────────────────────────────────────────────────
// Source-theme primitives - the shared building blocks every reskinned
// screen composes. Faithful to Move.dc.html: navy surfaces, hairline
// borders, the Sapphire-accent hero gradient, uppercase section labels,
// accent-gradient progress bars and tonal status pills. All read the
// active theme, so they flip light/dark with the user's preference.
// ──────────────────────────────────────────────────────────────────────

/** Uppercase section label with an optional trailing action ("All →"). */
export function SectionHeader({
  label,
  actionLabel,
  onAction,
  style,
}: {
  label: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.sectionRow, style]}>
      <Text
        style={{
          color: colors.faint,
          fontSize: 10,
          fontFamily: fonts.sansBold,
          letterSpacing: 1.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      {actionLabel ? (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} disabled={!onAction}>
          <Text style={{ color: colors.primary, fontSize: 11, fontFamily: fonts.sansSemibold }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Standard surface card (navy/white) with a hairline border. */
export function MoveCard({
  children,
  onPress,
  style,
  padding = 16,
  radius = 20,
  accent = false,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  radius?: number;
  /** Use the Sapphire-accent hairline instead of the neutral border. */
  accent?: boolean;
}) {
  const { colors } = useAppTheme();
  const body = (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: accent ? colors.accentBorder : colors.border,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {body}
      </TouchableOpacity>
    );
  }
  return body;
}

/**
 * Hero card — the gradient "premium" surface used for the countdown, AI
 * briefing, route and subscription cards. Sapphire-accent hairline + a soft
 * accent glow bleeding from the top-right corner.
 */
export function HeroCard({
  children,
  style,
  radius = 24,
  padding = 18,
  glow = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  padding?: number;
  glow?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        { borderRadius: radius, borderWidth: 1, borderColor: colors.accentBorder, overflow: "hidden" },
        style,
      ]}
    >
      <LinearGradient
        colors={colors.heroGrad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {glow ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -55,
            right: -45,
            width: 190,
            height: 190,
            borderRadius: 95,
            backgroundColor: colors.primary,
            opacity: 0.13,
          }}
        />
      ) : null}
      <View style={{ padding }}>{children}</View>
    </View>
  );
}

/** Accent-gradient progress bar over a neutral track. `value` is 0–1. */
export function MoveProgressBar({
  value,
  height = 5,
  style,
}: {
  value: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={[{ height, borderRadius: 99, backgroundColor: colors.track, overflow: "hidden" }, style]}>
      <LinearGradient
        colors={colors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: "100%", width: `${pct * 100}%`, borderRadius: 99 }}
      />
    </View>
  );
}

export type PillTone = "accent" | "success" | "warning" | "error" | "info" | "muted";

/** Small tonal status/tag chip. */
export function Pill({
  label,
  tone = "accent",
  style,
  textStyle,
}: {
  label: string;
  tone?: PillTone;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const { colors } = useAppTheme();
  const map: Record<PillTone, { fg: string; bg: string }> = {
    accent: { fg: colors.primary, bg: colors.accentSoft },
    success: { fg: colors.success, bg: colors.successFaded },
    warning: { fg: colors.warning, bg: colors.warningFaded },
    error: { fg: colors.error, bg: colors.errorFaded },
    info: { fg: colors.info, bg: colors.infoFaded },
    muted: { fg: colors.dim, bg: colors.track },
  };
  const c = map[tone];
  return (
    <View
      style={[
        { backgroundColor: c.bg, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8, alignSelf: "flex-start" },
        style,
      ]}
    >
      <Text style={[{ color: c.fg, fontSize: 9.5, fontFamily: fonts.sansBold }, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
