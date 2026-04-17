import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Sparkles, AlertTriangle, Clock } from "lucide-react-native";
import { theme } from "@/lib/theme";
import { ProviderCard, type ProviderCardData } from "./ProviderCard";

export type RecommendedRowItem = ProviderCardData & {
  tier?: "CRITICAL" | "IMPORTANT" | "RECOMMENDED" | "OPTIONAL" | string;
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
  title = "Recommended for you",
  description,
  providers,
  onPressProvider,
  emptyText,
}: RecommendedRowProps) {
  if (providers.length === 0 && !emptyText) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Sparkles size={16} color={theme.colors.primary} />
          <Text style={styles.title}>{title}</Text>
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
            const badge = tierBadge(p.tier);
            return (
              <ProviderCard
                key={p.id}
                provider={p}
                variant="compact"
                onPress={() => onPressProvider(p.id)}
                badge={badge}
              />
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function tierBadge(tier: string | undefined):
  | { label: string; variant: "primary" | "error" | "warning" | "info" | "success" | "neutral" }
  | undefined {
  if (!tier) return undefined;
  if (tier === "CRITICAL") return { label: "Critical", variant: "error" };
  if (tier === "IMPORTANT") return { label: "Important", variant: "warning" };
  if (tier === "RECOMMENDED") return { label: "Recommended", variant: "info" };
  return undefined;
}

const styles = StyleSheet.create({
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
