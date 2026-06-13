import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  X,
  Scale,
  AlertTriangle,
  Check,
  Minus,
  Flag,
  MapPin,
  Users,
  Trophy,
} from "lucide-react-native";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { EmptyState } from "@/components/ui/EmptyState";
import { ServiceLogoMark } from "@/components/services/ServiceLogoMark";
import { getCategoryIcon, getCategoryLabel } from "@/lib/recommendation-engine";
import {
  getLocalizedCategoryLabel,
  getLocalizedCoverageLabel,
} from "@/lib/provider-localization";
import { useCompareStore } from "@/lib/compare-store";
import type { ProviderCoverageConfidence } from "@locateflow/shared";

type CompareProvider = {
  id: string;
  name: string;
  slug: string;
  category: string;
  subCategory: string | null;
  description: string | null;
  website: string | null;
  websiteHost: string | null;
  phone: string | null;
  logoUrl: string | null;
  scope: string;
  states: string[];
  tags: string[];
  popularityScore: number;
  popularityRank: number | null;
  userCount: number;
  affiliateActive: boolean;
  hasWebsite: boolean;
  hasPhone: boolean;
  coverageModel: string;
  coverageMatchLevel: string;
  coverageConfidence: ProviderCoverageConfidence;
};

type CompareResponse = {
  mode: "compare";
  providers: CompareProvider[];
  comparedCount: number;
  sameCategory: boolean;
  address: { id: string; state: string; zip: string; city: string; nickname: string | null } | null;
};

type AddressOption = { id: string; state: string; zip: string; isPrimary: boolean };

const COL_WIDTH = 168;

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function ProviderCompareScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const entries = useCompareStore((s) => s.entries);
  const removeFromCompare = useCompareStore((s) => s.remove);

  // Snapshot the ids ONCE on mount so removing the last-but-one provider mid-view
  // doesn't refetch/blank the screen — we filter the rendered set locally instead.
  const initialIds = useMemo(() => entries.map((e) => e.id), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (initialIds.length < 2) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const addrRes = await api.get<{ addresses: AddressOption[] }>("/api/addresses");
    const addrs = addrRes.data?.addresses || [];
    const primary = addrs.find((a) => a.isPrimary) || addrs[0] || null;

    const params: Record<string, string> = { ids: initialIds.join(",") };
    if (primary?.id) params.addressId = primary.id;

    const res = await api.get<CompareResponse>("/api/providers/compare", params);
    if (res.error) {
      setError(res.error);
      setData(null);
    } else {
      setData(res.data || null);
    }
    setLoading(false);
  }, [initialIds]);

  useEffect(() => {
    load();
  }, [load]);

  // Render only providers still selected in the tray (so an in-view remove
  // updates the columns without a network round-trip).
  const visibleProviders = useMemo(() => {
    if (!data) return [];
    const stillSelected = new Set(entries.map((e) => e.id));
    return data.providers.filter((p) => stillSelected.has(p.id));
  }, [data, entries]);

  const addressLabel = useMemo(() => {
    if (!data?.address) return null;
    const a = data.address;
    return a.nickname || [a.city, a.state].filter(Boolean).join(", ") || a.state;
  }, [data]);

  const bestUserCount = useMemo(
    () => Math.max(0, ...visibleProviders.map((p) => p.userCount)),
    [visibleProviders],
  );

  const header = (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <ArrowLeft size={22} color={theme.colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>{t("providers.compareTitle", { defaultValue: "Compare" })}</Text>
      <View style={{ width: 44 }} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {header}
        <LoadingScreen />
      </SafeAreaView>
    );
  }

  if (initialIds.length < 2) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {header}
        <EmptyState
          icon={<AlertTriangle size={32} color={theme.colors.warning} />}
          title={t("providers.comparePickTitle", { defaultValue: "Pick providers to compare" })}
          description={t("providers.comparePickDescription", {
            defaultValue: "Long-press at least two providers in the list to compare them side by side.",
          })}
          actionLabel={t("common.back")}
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (error || visibleProviders.length < 2) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {header}
        <ErrorState
          message={error || t("providers.compareUnavailable", { defaultValue: "Couldn't load the comparison." })}
          onRetry={load}
        />
      </SafeAreaView>
    );
  }

  // Rows are defined declaratively so each renders aligned across all columns.
  const renderRow = (label: string, render: (p: CompareProvider) => React.ReactNode) => (
    <View style={styles.row} key={label}>
      <View style={styles.rowLabelCell}>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      {visibleProviders.map((p) => (
        <View style={styles.cell} key={p.id}>
          {render(p)}
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {header}

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Scale size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>COMPARE COMMAND</Text>
            <Text style={styles.heroTitle}>
              {visibleProviders.length} {t("providers.title").toLowerCase()}
            </Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              {addressLabel
                ? t("providers.compareAtAddress", {
                    address: addressLabel,
                    defaultValue: "Coverage shown for {{address}}",
                  })
                : t("providers.compareNoAddress", { defaultValue: "Add a primary address for coverage at your address." })}
            </Text>
          </View>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{data?.sameCategory ? "Same" : "Mixed"}</Text>
            <Text style={styles.heroStatLabel}>category</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{formatCount(bestUserCount)}</Text>
            <Text style={styles.heroStatLabel}>top users</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{visibleProviders.length}</Text>
            <Text style={styles.heroStatLabel}>columns</Text>
          </View>
        </View>
      </View>

      <View style={styles.truthBanner}>
        <AlertTriangle size={15} color={theme.colors.warning} />
        <Text style={styles.truthText}>
          {t("providers.compareTruth", {
            defaultValue:
              "Compared on real catalog data only — coverage confidence, relative popularity, category, and tags. No ratings or prices. Confirm with each provider.",
          })}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Provider header columns */}
            <View style={styles.row}>
              <View style={styles.rowLabelCell} />
              {visibleProviders.map((p) => (
                <View style={styles.headerCell} key={p.id}>
                  <View style={styles.logoWrap}>
                    <ServiceLogoMark
                      service={{
                        provider: { name: p.name, logoUrl: p.logoUrl, website: p.website },
                        website: p.website,
                      }}
                      fallbackIcon={getCategoryIcon(p.category)}
                      size={44}
                      logoSize={36}
                      borderRadius={12}
                      backgroundColor={theme.colors.primaryFaded}
                      borderColor={theme.colors.rose.border}
                      fallbackFontSize={20}
                    />
                    <TouchableOpacity
                      onPress={() => removeFromCompare(p.id)}
                      style={styles.removeBtn}
                      accessibilityRole="button"
                      accessibilityLabel={t("providers.compareRemove", {
                        provider: p.name,
                        defaultValue: `Remove ${p.name}`,
                      })}
                    >
                      <X size={12} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.headerName} numberOfLines={2}>
                    {p.name}
                  </Text>
                </View>
              ))}
            </View>

            {renderRow(
              t("providers.coverage", { defaultValue: "Coverage" }),
              (p) => (
                <>
                  <UiBadge
                    label={getLocalizedCoverageLabel(t, i18n.language, p.coverageConfidence) || p.coverageConfidence.label}
                    variant="info"
                  />
                  <Text style={styles.cellSub} numberOfLines={4}>
                    {p.coverageConfidence.message}
                  </Text>
                </>
              ),
            )}

            {renderRow(
              t("providers.comparePopularity", { defaultValue: "Popularity" }),
              (p) =>
                p.popularityRank ? (
                  <View style={styles.inlineRow}>
                    {p.popularityRank === 1 ? <Trophy size={13} color={theme.colors.warning} /> : null}
                    <Text style={styles.cellValue}>#{p.popularityRank}</Text>
                  </View>
                ) : (
                  <Text style={styles.cellMuted}>—</Text>
                ),
            )}

            {renderRow(
              t("providers.coverage", { defaultValue: "Scope" }),
              (p) => (
                <View style={styles.inlineRow}>
                  {p.scope === "FEDERAL" ? (
                    <>
                      <Flag size={12} color={theme.colors.textSecondary} />
                      <Text style={styles.cellValue}>{t("providers.nationalListing")}</Text>
                    </>
                  ) : (
                    <>
                      <MapPin size={12} color={theme.colors.textSecondary} />
                      <Text style={styles.cellValue} numberOfLines={2}>
                        {p.states.length > 0 ? p.states.slice(0, 4).join(", ") : t("providers.notSpecified")}
                      </Text>
                    </>
                  )}
                </View>
              ),
            )}

            {renderRow(
              t("providers.category", { defaultValue: "Category" }),
              (p) => (
                <Text style={styles.cellValue} numberOfLines={2}>
                  {getLocalizedCategoryLabel(t, p.category, getCategoryLabel(p.category))}
                </Text>
              ),
            )}

            {renderRow(
              t("providers.compareUsers", { defaultValue: "Community users" }),
              (p) =>
                p.userCount > 0 ? (
                  <View style={styles.inlineRow}>
                    <Users size={12} color={theme.colors.textSecondary} />
                    <Text style={[styles.cellValue, p.userCount === bestUserCount ? styles.cellValueStrong : null]}>
                      {formatCount(p.userCount)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.cellMuted}>—</Text>
                ),
            )}

            {renderRow(
              t("providers.compareOfficialLink", { defaultValue: "Official link" }),
              (p) => <YesNo value={p.affiliateActive} theme={theme} />,
            )}

            {renderRow(
              t("providers.compareWebsite", { defaultValue: "Website" }),
              (p) =>
                p.websiteHost ? (
                  <Text style={styles.cellValue} numberOfLines={1}>
                    {p.websiteHost}
                  </Text>
                ) : (
                  <Text style={styles.cellMuted}>—</Text>
                ),
            )}

            {renderRow(
              t("providers.tags", { defaultValue: "Tags" }),
              (p) =>
                p.tags.length > 0 ? (
                  <View style={styles.tagsWrap}>
                    {p.tags.slice(0, 5).map((tag) => (
                      <View style={styles.tag} key={tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.cellMuted}>—</Text>
                ),
            )}

            {/* Action row */}
            <View style={styles.row}>
              <View style={styles.rowLabelCell} />
              {visibleProviders.map((p) => (
                <View style={styles.cell} key={p.id}>
                  <TouchableOpacity
                    style={styles.trackBtn}
                    onPress={() =>
                      router.push(
                        `/services/new?providerId=${encodeURIComponent(p.id)}&category=${encodeURIComponent(
                          p.category,
                        )}` as any,
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t("providers.trackManually")}
                  >
                    <Text style={styles.trackBtnText}>{t("providers.compareTrack", { defaultValue: "Track this" })}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <Card variant="bordered" style={{ marginTop: 16 }}>
          <Text style={styles.footerNote}>
            {t("providers.manualServiceRecord")}
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function YesNo({ value, theme }: { value: boolean; theme: Theme }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {value ? <Check size={14} color={theme.colors.success} /> : <Minus size={14} color={theme.colors.textMuted} />}
      <Text style={{ fontSize: 12, color: value ? theme.colors.text : theme.colors.textMuted }}>
        {value ? "Yes" : "No"}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
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
    hero: {
      marginHorizontal: 20,
      marginBottom: 12,
      borderRadius: 24,
      padding: 16,
      backgroundColor: theme.colors.glass.bg,
      borderWidth: 1,
      borderColor: theme.colors.glass.highlight,
      ...theme.shadow.sm,
    },
    heroTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    heroIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: theme.colors.primaryFaded,
      borderWidth: 1,
      borderColor: theme.colors.primary + "33",
      alignItems: "center",
      justifyContent: "center",
    },
    heroCopy: { flex: 1, minWidth: 0 },
    heroKicker: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.3,
      textTransform: "uppercase",
      color: theme.colors.accent,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.colors.text,
      marginTop: 3,
      letterSpacing: 0,
    },
    heroSub: {
      fontSize: 12,
      color: theme.colors.textTertiary,
      marginTop: 3,
    },
    heroStats: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
    },
    heroStat: {
      flex: 1,
      minHeight: 56,
      borderRadius: 15,
      padding: 9,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: "center",
    },
    heroStatValue: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.colors.text,
    },
    heroStatLabel: {
      fontSize: 8,
      fontWeight: "800",
      letterSpacing: 0.8,
      color: theme.colors.textTertiary,
      textTransform: "uppercase",
      marginTop: 3,
    },
    addressNote: { fontSize: 12, color: theme.colors.textTertiary, paddingHorizontal: 20, marginBottom: 8 },
    truthBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginHorizontal: 20,
      marginBottom: 12,
      padding: 12,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.warningFaded,
      borderWidth: 1,
      borderColor: theme.colors.amber.border,
    },
    truthText: { flex: 1, fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    row: { flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    rowLabelCell: { width: 96, paddingVertical: 12, paddingRight: 8, justifyContent: "center" },
    rowLabel: { fontSize: 11, color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.3 },
    headerCell: { width: COL_WIDTH, alignItems: "center", paddingVertical: 12, paddingHorizontal: 6, gap: 8 },
    cell: { width: COL_WIDTH, paddingVertical: 12, paddingHorizontal: 8, gap: 4, justifyContent: "flex-start" },
    logoWrap: { position: "relative" },
    removeBtn: {
      position: "absolute",
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    headerName: { fontSize: 13, fontWeight: "700", color: theme.colors.text, textAlign: "center" },
    cellValue: { fontSize: 13, color: theme.colors.text, lineHeight: 18 },
    cellValueStrong: { fontWeight: "700" },
    cellSub: { fontSize: 11, color: theme.colors.textTertiary, lineHeight: 15, marginTop: 4 },
    cellMuted: { fontSize: 13, color: theme.colors.textMuted },
    inlineRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: theme.colors.surface },
    tagText: { fontSize: 10, color: theme.colors.textTertiary },
    trackBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 10,
      alignItems: "center",
    },
    trackBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
    footerNote: { fontSize: 12, color: theme.colors.textTertiary, lineHeight: 17 },
  });
