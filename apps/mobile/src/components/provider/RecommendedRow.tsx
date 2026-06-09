import React, { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Sparkles, AlertTriangle, Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { ProviderCard, type ProviderCardData } from "./ProviderCard";
import { ProviderReason } from "./ProviderReason";

export type RecommendedRowItem = ProviderCardData & {
  tier?: "CRITICAL" | "IMPORTANT" | "RECOMMENDED" | "OPTIONAL" | string;
  /**
   * Engine-computed recommendation signals (from the scored recommendation
   * payload). Surfaced verbatim by <ProviderReason/> so each card explains WHY
   * it's recommended — the "directory → guide" flip. Optional because plain
   * catalog rows never carry them, and ProviderReason renders nothing then.
   */
  matchReasons?: string[] | null;
  explanation?: { reason?: string | null; profileMatch?: string | null } | null;
};

interface RecommendedRowProps {
  title?: string;
  description?: string;
  providers: RecommendedRowItem[];
  onPressProvider: (id: string) => void;
  emptyText?: string;
}

/**
 * Renders a horizontally-scrolling row of recommended providers.
 * Each card shows a tier badge (CRITICAL/IMPORTANT) in the top-right.
 */
export function RecommendedRow({
  title,
  description,
  providers,
  onPressProvider,
  emptyText,
}: RecommendedRowProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const resolvedTitle = title ?? t("providers.recommendedForYou");
  if (providers.length === 0 && !emptyText) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Sparkles size={16} color={theme.colors.primary} />
          <Text style={styles.title}>{resolvedTitle}</Text>
        </View>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>

      {providers.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          decelerationRate="fast"
          snapToInterval={232}
          snapToAlignment="start"
        >
          {providers.map((p) => {
            const badge = tierBadge(p.tier, t);
            return (
              <View key={p.id} style={styles.cardColumn}>
                <ProviderCard
                  provider={p}
                  variant="compact"
                  onPress={() => onPressProvider(p.id)}
                  badge={badge}
                />
                {/* Engine-computed "why" — renders nothing when the provider
                    carries no real match signal, so it never invents a reason. */}
                <ProviderReason provider={p} variant="chip" />
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function tierBadge(tier: string | undefined, t: (key: string) => string):
  | { label: string; variant: "primary" | "error" | "warning" | "info" | "success" | "neutral" }
  | undefined {
  if (!tier) return undefined;
  if (tier === "CRITICAL") return { label: t("providers.critical"), variant: "error" };
  if (tier === "IMPORTANT") return { label: t("providers.important"), variant: "warning" };
  if (tier === "RECOMMENDED") return { label: t("providers.recommended"), variant: "info" };
  return undefined;
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  description: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginTop: 3,
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 12,
    alignItems: "flex-start",
  },
  cardColumn: {
    // Matches the compact ProviderCard fixed width so the reason chip below it
    // wraps to the same column instead of stretching the horizontal scroll.
    width: 220,
  },
  emptyWrap: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.textTertiary,
  },
});

// Unused but kept for potential future tier detail icons
void AlertTriangle;
void Clock;
