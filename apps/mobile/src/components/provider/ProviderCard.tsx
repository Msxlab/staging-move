import React, { useMemo } from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { ChevronRight, MapPin, Users, Check, Wifi } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { getCategoryIcon, getCategoryLabel } from "@/lib/recommendation-engine";
import { confidenceTone, toneBadgeVariant } from "@/lib/semantic-status";
import { ServiceLogoMark } from "@/components/services/ServiceLogoMark";
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
  website?: string | null;
  affiliateActive?: boolean;
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
  internetServiceability?: {
    source?: string | null;
    providerId?: string | null;
    maxDownloadMbps?: number | null;
    maxUploadMbps?: number | null;
    technologyCodes?: number[] | null;
    technology?: "fiber" | "cable" | "copper_dsl" | "fixed_wireless" | "satellite" | "mixed" | "unknown" | string | null;
    qualityBand?: "excellent" | "strong" | "standard" | "limited" | "unknown" | string | null;
  } | null;
};

interface ProviderCardProps {
  provider: ProviderCardData;
  variant?: "full" | "compact";
  onPress?: () => void;
  onLongPress?: () => void;
  /** When true, the card shows it is selected for side-by-side comparison. */
  selectedForCompare?: boolean;
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
  onLongPress,
  selectedForCompare = false,
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
  // Render via the shared ServiceLogoMark so this card uses the SAME tested
  // fallback chain (renderable-URL filter + onError advance + category icon
  // fallback + a11y label) as the services screen — never a blank box.
  const logoService = {
    provider: { name: provider.name, logoUrl: provider.logoUrl, website: provider.website },
    website: provider.website,
  };
  const trust = provider.trust || getProviderTrustSummary(provider);
  const categoryLabel = t(`categories.${provider.category}`, { defaultValue: getCategoryLabel(provider.category) });
  const description = getLocalizedProviderDescription(t, i18n.language, provider);
  const coverageLabel = getLocalizedCoverageLabel(t, i18n.language, trust.coverageConfidence);
  const coverageMessage = getLocalizedCoverageMessage(t, i18n.language, trust.coverageConfidence);
  const internetSignal = provider.internetServiceability
    ? formatInternetSignal(provider.internetServiceability)
    : null;

  const selectedRing: ViewStyle = selectedForCompare
    ? { borderColor: theme.colors.primary, borderWidth: 1.5 }
    : {};

  if (variant === "compact") {
    return (
      <Card
        variant="default"
        onPress={onPress}
        onLongPress={onLongPress}
        style={StyleSheet.flatten([compactStyles.card, selectedRing, style])}
        accessibilityRole="button"
        accessibilityLabel={t("providers.openProviderA11y", { provider: provider.name })}
        accessibilityHint={description || categoryLabel}
        accessibilityState={{ selected: selectedForCompare }}
      >
        <View style={compactStyles.row}>
          <ServiceLogoMark
            service={logoService}
            fallbackIcon={iconEmoji}
            size={36}
            logoSize={30}
            borderRadius={10}
            backgroundColor={theme.colors.primaryFaded}
            borderColor="rgba(127, 182, 232,0.2)"
            fallbackFontSize={16}
          />
          {selectedForCompare ? (
            <View style={compactStyles.compareDot}>
              <Check size={12} color="#fff" />
            </View>
          ) : badge ? (
            <UiBadge label={badge.label} variant={badge.variant ?? "primary"} />
          ) : null}
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
        {internetSignal ? (
          <View style={compactStyles.internetPill}>
            <Wifi size={10} color={theme.colors.primary} />
            <Text style={compactStyles.internetText} numberOfLines={1}>
              {internetSignal.compact}
            </Text>
          </View>
        ) : null}
      </Card>
    );
  }

  return (
    <Card
      variant="default"
      onPress={onPress}
      onLongPress={onLongPress}
      style={StyleSheet.flatten([selectedRing, style])}
      accessibilityRole="button"
      accessibilityLabel={t("providers.openProviderA11y", { provider: provider.name })}
      accessibilityHint={description || categoryLabel}
      accessibilityState={{ selected: selectedForCompare }}
    >
      <View style={fullStyles.top}>
        <ServiceLogoMark
          service={logoService}
          fallbackIcon={iconEmoji}
          size={40}
          logoSize={32}
          borderRadius={12}
          backgroundColor={theme.colors.primaryFaded}
          borderColor="rgba(127, 182, 232,0.2)"
          fallbackFontSize={18}
        />
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
        <UiBadge label={coverageLabel} variant={toneBadgeVariant(confidenceTone(trust.coverageConfidence?.confidence))} />
        {internetSignal ? (
          <UiBadge label={internetSignal.full} variant={internetSignal.variant} />
        ) : null}
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

function formatInternetSignal(serviceability: NonNullable<ProviderCardData["internetServiceability"]>): {
  compact: string;
  full: string;
  variant: "success" | "warning" | "info" | "neutral";
} | null {
  const quality = serviceability.qualityBand || "unknown";
  const technology = serviceability.technology || "unknown";
  const download = typeof serviceability.maxDownloadMbps === "number" && Number.isFinite(serviceability.maxDownloadMbps)
    ? serviceability.maxDownloadMbps
    : null;
  const technologyLabel = technology === "copper_dsl"
    ? "DSL"
    : technology === "fixed_wireless"
      ? "Fixed wireless"
      : technology === "unknown"
        ? "Internet"
        : String(technology).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const speedLabel = download && download > 0 ? `${Math.round(download)} Mbps` : null;
  if (quality === "unknown" && !speedLabel && technology === "unknown") return null;
  const qualityLabel = quality === "excellent"
    ? "Excellent"
    : quality === "strong"
      ? "Strong"
      : quality === "standard"
        ? "Standard"
        : quality === "limited"
          ? "Limited"
          : "FCC";
  const variant = quality === "excellent" || quality === "strong"
    ? "success"
    : quality === "limited"
      ? "warning"
      : quality === "standard"
        ? "info"
        : "neutral";
  return {
    compact: [technologyLabel, speedLabel].filter(Boolean).join(" · "),
    full: [technologyLabel, speedLabel, qualityLabel].filter(Boolean).join(" · "),
    variant,
  };
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
  internetPill: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
  },
  internetText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  compareDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
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
