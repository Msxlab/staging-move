import React, { useMemo } from "react";
import { View, Text, Image, StyleSheet, type ViewStyle } from "react-native";
import { ChevronRight, MapPin, Users } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { getCategoryIcon, getCategoryLabel } from "@/lib/recommendation-engine";
import {
  getLocalizedCoverageLabel,
  getLocalizedCoverageMessage,
  getLocalizedProviderDescription,
} from "@/lib/provider-localization";
import {
  getProviderTrustSummary,
  type ProviderCoverageConfidence,
  type ProviderTrustSummary,
} from "@locateflow/shared";

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
  userCount?: number | null;
  popularityScore?: number | null;
  coverageModel?: "state" | "zip_prefix" | "polygon" | "live_address" | string | null;
  coverageMatchLevel?: "exact" | "prefix" | "polygon" | "state" | "live_address" | string | null;
  coverageNote?: string | null;
  coverageSourceUrl?: string | null;
  requiresAddressCheck?: boolean | null;
  requiresPolygonCheck?: boolean | null;
  coverageConfidence?: ProviderCoverageConfidence;
  trust?: ProviderTrustSummary;
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
  // theme: hook-injected styles
  const theme = useAppTheme();
  const compactStyles = useMemo(() => makeCompactStyles(theme), [theme]);
  const fullStyles = useMemo(() => makeFullStyles(theme), [theme]);
  const { t, i18n } = useTranslation();
  const iconEmoji = getCategoryIcon(provider.category);
  const hasLogo = Boolean(provider.logoUrl && String(provider.logoUrl).trim());
  const trust = provider.trust || getProviderTrustSummary(provider);
  const categoryLabel = t(`categories.${provider.category}`, { defaultValue: getCategoryLabel(provider.category) });
  const description = getLocalizedProviderDescription(t, i18n.language, provider);
  const coverageLabel = getLocalizedCoverageLabel(t, i18n.language, trust.coverageConfidence);
  const coverageMessage = getLocalizedCoverageMessage(t, i18n.language, trust.coverageConfidence);

  if (variant === "compact") {
    return (
      <Card
        variant="default"
        onPress={onPress}
        style={StyleSheet.flatten([compactStyles.card, style])}
        accessibilityRole="button"
        accessibilityLabel={t("providers.openProviderA11y", { provider: provider.name })}
        accessibilityHint={description || categoryLabel}
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
            {categoryLabel}
          </Text>
        ) : null}

        <View style={compactStyles.metaRow}>
          <View style={compactStyles.scopePill}>
            <MapPin size={10} color={theme.colors.textTertiary} />
            <Text style={compactStyles.scopeText} numberOfLines={1}>
              {coverageLabel}
            </Text>
          </View>
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
      accessibilityLabel={t("providers.openProviderA11y", { provider: provider.name })}
      accessibilityHint={description || categoryLabel}
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
              {categoryLabel}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={16} color={theme.colors.textMuted} />
      </View>

      {description ? (
        <Text style={fullStyles.description} numberOfLines={2}>
          {description}
        </Text>
      ) : null}

      <View style={fullStyles.metaRow}>
        <UiBadge label={t("providers.listedProvider")} variant="warning" />
        <UiBadge label={coverageLabel} variant="info" />
        {badge ? <UiBadge label={badge.label} variant={badge.variant ?? "primary"} /> : null}
        {provider.userCount && provider.userCount > 0 ? (
          <View style={fullStyles.users}>
            <Users size={11} color={theme.colors.textTertiary} />
            <Text style={fullStyles.usersText}>{t("providers.usingCount", { count: formatUsers(provider.userCount) })}</Text>
          </View>
        ) : null}
      </View>

      <Text style={fullStyles.caveat} numberOfLines={3}>
        {coverageMessage} {t("providers.manualTrackingCaveat")}
      </Text>

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

const makeCompactStyles = (theme: Theme) => StyleSheet.create({
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
    borderColor: "rgba(127, 182, 232,0.2)",
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

const makeFullStyles = (theme: Theme) => StyleSheet.create({
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
    borderColor: "rgba(127, 182, 232,0.2)",
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
  caveat: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    marginTop: 8,
    lineHeight: 16,
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
