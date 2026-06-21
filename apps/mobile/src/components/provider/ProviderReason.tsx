import React, { useMemo } from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { Sparkles } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { getLocalizedProviderReason } from "@/lib/provider-localization";
import { getCategoryLabel } from "@/lib/recommendation-engine";

/**
 * The slice of an engine-scored provider that carries its recommendation
 * explanation. Both fields are produced by the shared recommendation engine
 * (scoreProviders → ScoredProvider.matchReasons / .explanation). When neither
 * is present — e.g. a plain catalog row from /api/providers that was never
 * scored — there is NO engine reason and this component renders nothing. We
 * never fabricate a reason; the bare category label is treated as "no reason".
 */
export type ProviderReasonInput = {
  category?: string | null;
  /** Per-signal reasons the engine matched, e.g. ["You have kids", "Daycare"]. */
  matchReasons?: string[] | null;
  /** The engine's pre-joined explanation, e.g. reason / profileMatch strings. */
  explanation?: {
    reason?: string | null;
    profileMatch?: string | null;
  } | null;
};

/**
 * Returns the engine-computed "why" string for a provider, or `null` when the
 * engine produced no genuine reason. This is the gate that keeps the guide
 * honest: a value is returned ONLY when the engine matched a real signal
 * (a non-empty matchReason or an explanation.reason that isn't merely the
 * category label). The localization helper would otherwise fall back to the
 * category label, which is not a reason — so we strip that case out here.
 */
export function resolveEngineReason(
  t: ReturnType<typeof useTranslation>["t"],
  language: string | undefined,
  provider: ProviderReasonInput,
): string | null {
  const firstMatch = provider.matchReasons?.find((r) => Boolean(r?.trim()))?.trim();
  const explanationReason = provider.explanation?.reason?.trim();
  const profileMatch = provider.explanation?.profileMatch?.trim();
  // The bare category label is the localization helper's last-resort fallback;
  // it is NOT an engine reason, so anything equal to it counts as "no reason".
  const categoryLabel = (provider.category ? getCategoryLabel(provider.category) : "").trim();

  // Prefer the most specific engine output: a profile match ("You have kids"),
  // then a matched signal, then the engine's joined reason. Each must be a real,
  // non-category string to qualify.
  const candidate =
    (profileMatch && profileMatch !== categoryLabel ? profileMatch : "") ||
    (firstMatch && firstMatch !== categoryLabel ? firstMatch : "") ||
    (explanationReason && explanationReason !== categoryLabel ? explanationReason : "");

  if (!candidate) return null;

  // Route through the existing localization helper so Spanish gets its
  // generic-reason copy. We pass the validated candidate as the fallback and a
  // provider whose matchReasons is the candidate, so the helper returns the
  // engine string for English and the localized variant for Spanish.
  const localized = getLocalizedProviderReason(
    t,
    language,
    { category: provider.category, matchReasons: [candidate] },
    candidate,
  );
  return localized?.trim() || candidate;
}

interface ProviderReasonProps {
  provider: ProviderReasonInput;
  /** "chip" is a compact inline pill for cards; "banner" is a fuller detail row. */
  variant?: "chip" | "banner";
  style?: ViewStyle;
}

/**
 * Surfaces the engine-computed recommendation reason ("Recommended because:
 * you have kids → daycare"). Renders nothing when there is no engine reason, so
 * it is always safe to drop into a card or detail screen unconditionally.
 */
export function ProviderReason({ provider, variant = "chip", style }: ProviderReasonProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();

  const reason = resolveEngineReason(t, i18n.language, provider);
  if (!reason) return null;

  const because = t("providers.recommendedBecause", { defaultValue: "Recommended because" });
  const full = `${because}: ${reason}`;

  if (variant === "banner") {
    return (
      <View
        style={[styles.banner, style]}
        accessibilityRole="text"
        accessibilityLabel={full}
      >
        <Sparkles size={15} color={theme.colors.primary} />
        <Text style={styles.bannerText}>
          <Text style={styles.bannerLead}>{because}: </Text>
          {reason}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.chip, style]}
      accessibilityRole="text"
      accessibilityLabel={full}
    >
      <Sparkles size={12} color={theme.colors.primary} />
      <Text style={styles.chipText} numberOfLines={2}>
        {reason}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 5,
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 9,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primaryFaded,
      borderWidth: 1,
      borderColor: "rgba(203, 164, 94,0.25)",
    },
    chipText: {
      flex: 1,
      fontSize: 11.5,
      fontWeight: "600",
      color: theme.colors.primary,
      lineHeight: 15,
    },
    banner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginTop: 14,
      padding: 12,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.primaryFaded,
      borderWidth: 1,
      borderColor: "rgba(203, 164, 94,0.25)",
    },
    bannerText: {
      flex: 1,
      fontSize: 13,
      color: theme.colors.text,
      lineHeight: 18,
    },
    bannerLead: {
      fontWeight: "700",
      color: theme.colors.primary,
    },
  });
