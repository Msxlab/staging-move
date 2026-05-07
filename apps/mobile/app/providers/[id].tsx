import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Globe,
  Phone,
  MapPin,
  Tag,
  TrendingUp,
  Plus,
  Users,
  AlertTriangle,
  Info,
  Clock,
} from "lucide-react-native";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { getCategoryIcon, getCategoryLabel } from "@/lib/recommendation-engine";
import {
  getLocalizedCategoryLabel,
  getLocalizedCoverageLabel,
  getLocalizedCoverageMessage,
  getLocalizedProviderDescription,
} from "@/lib/provider-localization";
import { ProviderCard, type ProviderCardData } from "@/components/provider/ProviderCard";
import { getProviderTrustSummary } from "@locateflow/shared";

type Provider = ProviderCardData & {
  website?: string | null;
  phone?: string | null;
  subCategory?: string | null;
  popularityScore?: number | null;
};

type DetailResponse = {
  provider: Provider;
  alternatives?: Provider[];
};

type AddressOption = {
  id: string;
  state: string;
  zip: string;
  isPrimary: boolean;
};

type RecMeta = {
  meta?: {
    state?: string | null;
    currentPhase?: string | null;
    moveDate?: string | null;
    stateRule?: { daysToUpdate?: number; source?: string } | null;
  };
  clusters?: Array<{
    tier: string;
    providers: Array<{ id: string; category: string }>;
  }>;
};

const CRITICAL_GOVERNMENT = new Set([
  "GOVERNMENT_DMV",
  "GOVERNMENT_VOTER",
  "GOVERNMENT_TAX",
  "GOVERNMENT_ID",
  "GOVERNMENT_IMMIGRATION",
]);

export default function ProviderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const { t, i18n } = useTranslation();
  const providerId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [provider, setProvider] = useState<Provider | null>(null);
  const [alternatives, setAlternatives] = useState<Provider[]>([]);
  const [recMeta, setRecMeta] = useState<RecMeta | null>(null);
  const [primaryAddress, setPrimaryAddress] = useState<AddressOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tier = useMemo<string | null>(() => {
    if (!provider || !recMeta?.clusters) return null;
    for (const c of recMeta.clusters) {
      if (c.providers.some((p) => p.id === provider.id)) return c.tier;
    }
    return null;
  }, [provider, recMeta]);

  const loadAll = useCallback(async () => {
    if (!providerId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const addrRes = await api.get<{ addresses: AddressOption[] }>("/api/addresses");
    if (addrRes.error) {
      setError(addrRes.error);
      setLoading(false);
      return;
    }
    const addrs = addrRes.data?.addresses || [];
    const primary = addrs.find((a) => a.isPrimary) || addrs[0] || null;
    setPrimaryAddress(primary);

    const detailParams: Record<string, string> = {};
    if (primary?.state) detailParams.state = primary.state;

    const [detailRes, recRes] = await Promise.all([
      api.get<DetailResponse>(`/api/providers/${providerId}`, detailParams),
      primary?.id
        ? api.get<RecMeta>("/api/providers/recommendations", { addressId: primary.id })
        : Promise.resolve({ data: null } as { data: RecMeta | null }),
    ]);
    if (detailRes.error) {
      setError(detailRes.error);
      setProvider(null);
      setAlternatives([]);
      setRecMeta(null);
      setLoading(false);
      return;
    }

    setProvider(detailRes.data?.provider || null);
    setAlternatives(detailRes.data?.alternatives || []);
    setRecMeta(recRes.data || null);
    setError(null);
    setLoading(false);
  }, [providerId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleOpenLink = async (url?: string | null) => {
    if (!url) return;
    const safeUrl = url.startsWith("http") ? url : `https://${url}`;
    const canOpen = await Linking.canOpenURL(safeUrl);
    if (!canOpen) {
      Alert.alert(t("settings.subscription_unavailable"), t("providers.linkUnavailable"));
      return;
    }
    await Linking.openURL(safeUrl);
  };

  const handleCall = async (phone?: string | null) => {
    if (!phone) return;
    const telUrl = `tel:${phone}`;
    const canOpen = await Linking.canOpenURL(telUrl);
    if (!canOpen) {
      Alert.alert(t("settings.subscription_unavailable"), t("providers.phoneUnavailable"));
      return;
    }
    await Linking.openURL(telUrl);
  };

  const goAddService = useCallback(() => {
    if (!provider) return;
    router.push(
      `/services/new?providerId=${encodeURIComponent(provider.id)}&category=${encodeURIComponent(
        provider.category
      )}` as any
    );
  }, [provider, router]);

  if (loading) return <LoadingScreen />;

  if (!provider) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
          >
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("services.providerName")}</Text>
          <View style={{ width: 44 }} />
        </View>
        <ErrorState
          title={error ? t("providers.providerUnavailable") : t("providers.providerNotFound")}
          message={error || t("providers.providerRemoved")}
          onRetry={loadAll}
        />
      </SafeAreaView>
    );
  }

  const hasLogo = Boolean(provider.logoUrl && String(provider.logoUrl).trim());
  const trust = provider.trust || getProviderTrustSummary(provider);
  const categoryLabel = getLocalizedCategoryLabel(t, provider.category, getCategoryLabel(provider.category));
  const providerDescription = getLocalizedProviderDescription(t, i18n.language, provider);
  const coverageLabel = getLocalizedCoverageLabel(t, i18n.language, trust.coverageConfidence);
  const coverageMessage = getLocalizedCoverageMessage(t, i18n.language, trust.coverageConfidence);
  const daysUntilMove = daysUntil(recMeta?.meta?.moveDate);
  const stateRuleDays = recMeta?.meta?.stateRule?.daysToUpdate;
  const showStateRule =
    CRITICAL_GOVERNMENT.has(provider.category) && typeof stateRuleDays === "number";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("services.providerName")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {tier === "CRITICAL" && daysUntilMove !== null && daysUntilMove <= 30 ? (
          <View style={styles.criticalBanner} accessibilityRole="alert">
            <AlertTriangle size={18} color={theme.colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.criticalTitle}>{t("providers.handleBeforeMove")}</Text>
              <Text style={styles.criticalText}>
                {daysUntilMove <= 0
                  ? t("providers.moveDatePassed")
                  : t("providers.daysUntilMove", { count: daysUntilMove })}
              </Text>
            </View>
          </View>
        ) : null}

        <Card variant="glow">
          <View style={styles.topRow}>
            {hasLogo ? (
              <Image
                source={{ uri: provider.logoUrl as string }}
                style={styles.logo}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.logoFallback}>
                <CategoryIcon emoji={getCategoryIcon(provider.category)} size={26} color={theme.colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.providerName} numberOfLines={2}>
                {provider.name}
              </Text>
              <Text style={styles.providerCategory}>
                {categoryLabel}
              </Text>
            </View>
          </View>

          {providerDescription ? (
            <Text style={styles.providerDescription}>{providerDescription}</Text>
          ) : null}

          <View style={styles.badgesRow}>
            <UiBadge label={t("providers.listedProvider")} variant="warning" />
            <UiBadge label={coverageLabel} variant="info" />
            {tier === "CRITICAL" ? <UiBadge label={t("providers.critical")} variant="error" /> : null}
            {tier === "IMPORTANT" ? <UiBadge label={t("providers.important")} variant="warning" /> : null}
          </View>

          <View style={styles.truthBox}>
            <AlertTriangle size={16} color={theme.colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.truthTitle}>{t("providers.unverifiedDirectoryData")}</Text>
              <Text style={styles.truthText}>
                {coverageMessage} {t("providers.confirmOfficial")}
              </Text>
              <Text style={styles.truthText}>
                {t("providers.manualServiceRecord")}
              </Text>
            </View>
          </View>

          <Button
            title={t("providers.trackManually")}
            onPress={goAddService}
            variant="gradient"
            size="lg"
            fullWidth
            icon={<Plus size={18} color="#fff" />}
            style={{ marginTop: 18 }}
            accessibilityHint={t("providers.trackManuallyHint")}
          />
        </Card>

        {provider.userCount && provider.userCount > 0 ? (
          <Card variant="bordered" style={{ marginTop: 14 }}>
            <View style={styles.usersRow}>
              <Users size={18} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.usersTitle}>
                  {t("providers.communitySignal", {
                    count: formatCount(provider.userCount),
                    state: primaryAddress?.state ? t("providers.communityState", { state: primaryAddress.state }) : "",
                  })}
                </Text>
                <Text style={styles.usersText}>
                  {t("providers.communitySignalHint")}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {showStateRule ? (
          <Card variant="bordered" style={{ marginTop: 14 }}>
            <View style={styles.usersRow}>
              <Clock size={18} color={theme.colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.usersTitle}>
                  {t("providers.stateRule", {
                    state: primaryAddress?.state ?? t("providers.yourState"),
                    days: stateRuleDays,
                  })}
                </Text>
                <Text style={styles.usersText}>
                  {recMeta?.meta?.stateRule?.source
                    ? t("providers.source", { source: recMeta.meta.stateRule.source })
                    : t("providers.stateRuleFallback")}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        <Card variant="default" style={{ marginTop: 14 }}>
          <View style={styles.detailRow}>
            <MapPin size={16} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t("providers.coverage")}</Text>
              <Text style={styles.detailValue}>
                {provider.scope === "FEDERAL"
                  ? t("providers.nationalListing")
                  : provider.states && provider.states.length > 0
                  ? provider.states.join(", ")
                  : t("providers.notSpecified")}
              </Text>
              <Text style={styles.detailHint}>{coverageLabel}</Text>
            </View>
          </View>

          {provider.tags && provider.tags.length > 0 ? (
            <View style={styles.detailRow}>
              <Tag size={16} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>{t("providers.tags")}</Text>
                <Text style={styles.detailValue}>{provider.tags.join(", ")}</Text>
              </View>
            </View>
          ) : null}

          {typeof provider.popularityScore === "number" && provider.popularityScore > 0 ? (
            <View style={styles.detailRow}>
              <TrendingUp size={16} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>{t("providers.popularity")}</Text>
                <Text style={styles.detailValue}>{provider.popularityScore}</Text>
              </View>
            </View>
          ) : null}
        </Card>

        {provider.website ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleOpenLink(provider.website)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t("providers.openWebsiteA11y", { provider: provider.name })}
          >
            <Globe size={16} color={theme.colors.primary} />
            <Text style={styles.actionText}>{t("providers.openWebsite")}</Text>
          </TouchableOpacity>
        ) : null}

        {provider.phone ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleCall(provider.phone)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t("providers.callProviderA11y", { provider: provider.name })}
          >
            <Phone size={16} color={theme.colors.primary} />
            <Text style={styles.actionText}>{t("providers.callProvider")}</Text>
          </TouchableOpacity>
        ) : null}

        {alternatives.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t("providers.alternativesIn", { category: categoryLabel })}
              </Text>
              <Info size={14} color={theme.colors.textTertiary} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.altScroll}
              snapToInterval={232}
              snapToAlignment="start"
              decelerationRate="fast"
            >
              {alternatives.map((alt) => (
                <ProviderCard
                  key={alt.id}
                  provider={alt}
                  variant="compact"
                  onPress={() => router.replace({ pathname: "/providers/[id]", params: { id: alt.id } })}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function daysUntil(dateIso?: string | null): number | null {
  if (!dateIso) return null;
  const t = Date.parse(dateIso);
  if (Number.isNaN(t)) return null;
  const diff = t - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  criticalBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.errorFaded,
    borderWidth: 1,
    borderColor: "rgba(240, 140, 142, 0.30)",
    marginBottom: 14,
  },
  criticalTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.rose.text },
  criticalText: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, lineHeight: 18 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 56, height: 56, borderRadius: 14, backgroundColor: theme.colors.surface },
  logoFallback: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: "rgba(127, 182, 232,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  providerName: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
  providerCategory: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },
  providerDescription: { fontSize: 14, color: theme.colors.textTertiary, marginTop: 14, lineHeight: 20 },
  badgesRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 16 },
  truthBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.warningFaded,
    borderWidth: 1,
    borderColor: "rgba(242,196,108,0.25)",
  },
  truthTitle: { fontSize: 13, fontWeight: "700", color: theme.colors.text },
  truthText: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 3, lineHeight: 17 },
  usersRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  usersTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  usersText: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 3, lineHeight: 17 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12 },
  detailLabel: { fontSize: 12, color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  detailValue: { fontSize: 14, color: theme.colors.text, marginTop: 2, lineHeight: 20 },
  detailHint: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 3, lineHeight: 17 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 15,
    marginTop: 14,
  },
  actionText: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  altScroll: { gap: 12, paddingVertical: 4 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.text },
  emptyText: { fontSize: 14, color: theme.colors.textTertiary, textAlign: "center", marginTop: 8, lineHeight: 20 },
});
