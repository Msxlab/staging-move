import React from "react";
import { View, Text, Image, StyleSheet, type ViewStyle } from "react-native";
import { Star, ChevronRight, MapPin, Users } from "lucide-react-native";
import { theme } from "@/lib/theme";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { getCategoryIcon, getCategoryLabel } from "@/lib/recommendation-engine";

export type ProviderCardData = {
  id: string;
  name: string;
  slug?: string;
  category: string;
  subCategory?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  scope?: "FEDERAL" | "STATE" | string | null;
  states?: string[] | null;
  tags?: string[] | null;
  avgRating?: number | null;
  reviewCount?: number | null;
  userCount?: number | null;
  popularityScore?: number | null;
};

interface ProviderCardProps {
  provider: ProviderCardData;
  variant?: "full" | "compact";
  onPress?: () => void;
  showCategory?: boolean;
  style?: ViewStyle;
  badge?: { label: string; variant?: "primary" | "success" | "warning" | "error" | "info" | "neutral" };
}

/**
 * Displays a provider entry in either a full list row (`variant="full"`)
 * or a compact horizontal-scroll tile (`variant="compact"`).
 * Falls back to `CategoryIcon` when `logoUrl` is missing.
 */
export function ProviderCard({
  provider,
  variant = "full",
  onPress,
  showCategory = true,
  style,
  badge,
}: ProviderCardProps) {
  const scopeLabel =
    provider.scope === "FEDERAL"
      ? "Nationwide"
      : provider.states && provider.states.length > 0
      ? provider.states.slice(0, 2).join(", ") + (provider.states.length > 2 ? ` +${provider.states.length - 2}` : "")
      : "—";

  const iconEmoji = getCategoryIcon(provider.category);
  const hasLogo = Boolean(provider.logoUrl && String(provider.logoUrl).trim());

  if (variant === "compact") {
    return (
      <Card
        variant="default"
        onPress={onPress}
        style={StyleSheet.flatten([compactStyles.card, style])}
        accessibilityRole="button"
        accessibilityLabel={`Open provider ${provider.name}`}
        accessibilityHint={provider.description || getCategoryLabel(provider.category)}
      >
        <View style={compactStyles.row}>
          {hasLogo ? (
            <Image source={{ uri: provider.logoUrl as string }} style={compactStyles.logo} resizeMode="contain" />
          ) : (
            <View style={compactStyles.iconWrap}>
              <CategoryIcon emoji={iconEmoji} size={18} color={theme.colors.primary} />
            </View>
          )}
          {badge ? <UiBadge label={badge.label} variant={badge.variant ?? "primary"} /> : null}
        </View>

        <Text style={compactStyles.name} numberOfLines={1}>
          {provider.name}
        </Text>
        {showCategory ? (
          <Text style={compactStyles.category} numberOfLines={1}>
            {getCategoryLabel(provider.category)}
          </Text>
        ) : null}

        <View style={compactStyles.metaRow}>
          {provider.avgRating && provider.avgRating > 0 ? (
            <View style={compactStyles.rating}>
              <Star size={11} color={theme.colors.amber.text} fill={theme.colors.amber.text} />
              <Text style={compactStyles.ratingText}>{provider.avgRating.toFixed(1)}</Text>
            </View>
          ) : (
            <View style={compactStyles.scopePill}>
              <MapPin size={10} color={theme.colors.textTertiary} />
              <Text style={compactStyles.scopeText} numberOfLines={1}>
                {scopeLabel}
              </Text>
            </View>
          )}
          {provider.userCount && provider.userCount > 0 ? (
            <View style={compactStyles.users}>
              <Users size={10} color={theme.colors.textTertiary} />
              <Text style={compactStyles.usersText}>{formatUsers(provider.userCount)}</Text>
            </View>
          ) : null}
        </View>
      </Card>
    );
  }

  return (
    <Card
      variant="default"
      onPress={onPress}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={`Open provider ${provider.name}`}
      accessibilityHint={provider.description || getCategoryLabel(provider.category)}
    >
      <View style={fullStyles.top}>
        {hasLogo ? (
          <Image source={{ uri: provider.logoUrl as string }} style={fullStyles.logo} resizeMode="contain" />
        ) : (
          <View style={fullStyles.iconWrap}>
            <CategoryIcon emoji={iconEmoji} size={20} color={theme.colors.primary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={fullStyles.name} numberOfLines={1}>
            {provider.name}
          </Text>
          {showCategory ? (
            <Text style={fullStyles.category} numberOfLines={1}>
              {getCategoryLabel(provider.category)}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={16} color={theme.colors.textMuted} />
      </View>

      {provider.description ? (
        <Text style={fullStyles.description} numberOfLines={2}>
          {provider.description}
        </Text>
      ) : null}

      <View style={fullStyles.metaRow}>
        {provider.avgRating && provider.avgRating > 0 ? (
          <View style={fullStyles.rating}>
            <Star size={12} color={theme.colors.amber.text} fill={theme.colors.amber.text} />
            <Text style={fullStyles.ratingText}>{provider.avgRating.toFixed(1)}</Text>
            {provider.reviewCount ? (
              <Text style={fullStyles.reviewCount}>({provider.reviewCount})</Text>
            ) : null}
          </View>
        ) : null}
        <UiBadge label={scopeLabel} variant="info" />
        {badge ? <UiBadge label={badge.label} variant={badge.variant ?? "primary"} /> : null}
        {provider.userCount && provider.userCount > 0 ? (
          <View style={fullStyles.users}>
            <Users size={11} color={theme.colors.textTertiary} />
            <Text style={fullStyles.usersText}>{formatUsers(provider.userCount)} using</Text>
          </View>
        ) : null}
      </View>

      {provider.tags && provider.tags.length > 0 ? (
        <View style={fullStyles.tagsRow}>
          {provider.tags.slice(0, 3).map((tag) => (
            <View key={tag} style={fullStyles.tag}>
              <Text style={fullStyles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function formatUsers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const compactStyles = StyleSheet.create({
  card: {
    width: 220,
    padding: theme.spacing.md,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
  },
  category: {
    fontSize: 11,
    color: theme.colors.textTertiary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.amber.text,
  },
  scopePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    maxWidth: 120,
  },
  scopeText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
  },
  users: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  usersText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
  },
});

const fullStyles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  category: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  description: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    marginTop: 10,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexWrap: "wrap",
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.amber.text,
  },
  reviewCount: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  users: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  usersText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
  },
  tagsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  tagText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
  },
});
