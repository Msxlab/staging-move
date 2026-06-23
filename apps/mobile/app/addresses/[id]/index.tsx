import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Edit, Trash2, Plus, AlertTriangle, ChevronRight, Truck, MapPin } from "lucide-react-native";
import { monthlyAmountForCycle } from "@locateflow/shared";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListEntrance } from "@/components/ui/ListEntrance";
import { HeroCard, MoveCard, SectionHeader, Pill } from "@/components/move";
import { hapticSuccess, hapticError, hapticWarning } from "@/lib/haptics";
import { asObject } from "@/lib/offline-cache";
import { detailCacheKey, useDetailOfflineCache } from "@/lib/use-detail-offline-cache";
import {
  getCategoryIcon,
  getCategoryLabel,
  getMergedDisplayCategoryIcon,
  getMergedDisplayCategoryLabel,
} from "@/lib/recommendation-engine";

function getServiceFallbackIcon(category: string): string {
  return getMergedDisplayCategoryIcon(category) || getCategoryIcon(category) || "•";
}

function getServiceCategoryLabel(category: string): string {
  return getMergedDisplayCategoryLabel(category) || getCategoryLabel(category) || category.replace(/_/g, " ");
}

function readAddressDetailCache(raw: unknown): any | null {
  return asObject(raw) as any | null;
}

export default function AddressDetailScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const {
    data: address,
    setCachedData: setAddress,
    loading,
    setLoading,
    startForegroundLoad,
  } = useDetailOfflineCache<any>(detailCacheKey("address", id), readAddressDetailCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    const res = await api.get<any>(`/api/addresses/${id}`);
    // Distinguish a real "not found" from a transient network/500 — the latter
    // must offer retry, not a permanent dead-end.
    if (res.error) { setError(res.error); return; }
    setError(null);
    if (res.data) setAddress(res.data.address || res.data);
  }, [id]);

  const load = useCallback(async () => {
    startForegroundLoad();
    await fetch_();
    setLoading(false);
  }, [fetch_, setLoading, startForegroundLoad]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetch_();
    setRefreshing(false);
  }, [fetch_]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = () => {
    hapticWarning();
    Alert.alert(t("addresses.delete"), t("addresses.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          const res = await api.delete(`/api/addresses/${id}`);
          if (!res.error) {
            hapticSuccess();
            router.back();
          } else {
            hapticError();
            Alert.alert(t("common.retry"), t("addresses.deleteFailed"));
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;
  if (!address) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{error ? t("common.error", { defaultValue: "Error" }) : t("common.notFound")}</Text>
          <View style={{ width: 44 }} />
        </View>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: theme.colors.faint, fontFamily: fonts.sans }}>{t("addresses.notFound")}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const services = address.services || [];
  // True monthly total — normalizes per-cycle costs (matches the budget engine).
  const perMo = services.reduce(
    (sum: number, s: any) => sum + monthlyAmountForCycle(s.monthlyCost || 0, s.billingCycle),
    0,
  );
  const fmtUsd = (n: number) =>
    new Intl.NumberFormat(i18n.language || "en", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  // Status chip (recreates the design's .ad-st).
  const isVacation = address.type === "VACATION";
  const isPast = !!address.endDate && new Date(address.endDate).getTime() < Date.now();
  const statusLabel = isVacation
    ? t("addresses.statusSeasonal")
    : isPast
      ? t("addresses.statusPast")
      : t("addresses.statusActive");
  const tone = isVacation ? theme.colors.sky : isPast ? theme.colors.amber : theme.colors.emerald;

  // "Needs attention" = services renewing within 14 days (real contractEndDate).
  const renewSoon = (s: any): number | null => {
    if (!s.contractEndDate) return null;
    const days = Math.ceil((new Date(s.contractEndDate).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 14 ? days : null;
  };
  const attentionItems = services
    .map((s: any) => ({ s, days: renewSoon(s) }))
    .filter((x: any) => x.days !== null);

  // Group services into the "Everything tied here" category menu.
  const catMap = new Map<string, { key: string; label: string; icon: string; count: number; attention: number }>();
  for (const s of services) {
    const label = getServiceCategoryLabel(s.category);
    const entry = catMap.get(label) || { key: label, label, icon: getServiceFallbackIcon(s.category), count: 0, attention: 0 };
    entry.count += 1;
    if (renewSoon(s) !== null) entry.attention += 1;
    catMap.set(label, entry);
  }
  const categories = Array.from(catMap.values()).sort((a, b) => b.count - a.count);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("addresses.title")}
        >
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {address.nickname || t("addresses.title")}
        </Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/addresses/[id]/edit", params: { id: String(id) } })}
          style={styles.editBtn}
        >
          <Edit size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Hero — address identity + tonal status + map mark */}
        <HeroCard style={styles.hero} radius={theme.radius.xl} padding={18}>
          <View style={styles.heroRow}>
            <View style={styles.heroPin}>
              <MapPin size={20} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.heroTitleRow}>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {address.nickname || (address.isPrimary ? "Current home" : address.street)}
                </Text>
                <View style={[styles.statusChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                  <Text style={[styles.statusChipText, { color: tone.text }]}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={styles.heroAddr} numberOfLines={2}>
                {address.street}, {address.city}, {address.state} {address.zip}
              </Text>
            </View>
          </View>

          {/* Summary 3-stat */}
          <View style={styles.summary}>
            <View style={styles.sumBox}>
              <Text style={styles.sumV}>{services.length}</Text>
              <Text style={styles.sumK}>accounts</Text>
            </View>
            <View style={styles.sumDivider} />
            <View style={styles.sumBox}>
              <Text style={[styles.sumV, attentionItems.length > 0 && { color: theme.colors.error }]}>{attentionItems.length}</Text>
              <Text style={styles.sumK}>attention</Text>
            </View>
            <View style={styles.sumDivider} />
            <View style={styles.sumBox}>
              <Text style={styles.sumV}>{fmtUsd(perMo)}</Text>
              <Text style={styles.sumK}>per mo</Text>
            </View>
          </View>
        </HeroCard>

        {/* Needs attention */}
        {attentionItems.length > 0 && (
          <>
            <SectionHeader label={t("addresses.needsAttention")} style={styles.section} />
            {attentionItems.map(({ s, days }: any) => (
              <TouchableOpacity
                key={s.id}
                style={styles.att}
                onPress={() => router.push({ pathname: "/services/[id]", params: { id: s.id } })}
              >
                <View style={styles.attIcon}>
                  <AlertTriangle size={15} color={theme.colors.error} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.attT} numberOfLines={1}>
                    {(s.providerName || s.provider?.name || "Service")} renews in {days} day{days === 1 ? "" : "s"}
                  </Text>
                  <Text style={styles.attS} numberOfLines={1}>Confirm the billing address before it auto-renews</Text>
                </View>
                <ChevronRight size={15} color={theme.colors.error} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Everything tied here — category menu */}
        <SectionHeader label="Everything tied here" style={styles.section} />
        {categories.length === 0 ? (
          <MoveCard padding={18} radius={theme.radius.xl}>
            <Text style={styles.emptyText}>
              {t("services.emptyForAddress")}
            </Text>
          </MoveCard>
        ) : (
          <View style={styles.catGrid}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={styles.cat}
                onPress={() => router.push({ pathname: "/(tabs)/services", params: { addressId: String(id) } })}
              >
                <View style={styles.catIconWrap}>
                  <CategoryIcon emoji={c.icon} size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.catT} numberOfLines={1}>{c.label}</Text>
                  <Text style={styles.catC}>{c.count} {c.count === 1 ? "account" : "accounts"}</Text>
                </View>
                {c.attention > 0 && (
                  <View style={styles.catBadge}>
                    <Text style={styles.catBadgeText}>{c.attention}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.ctaGhost}
            onPress={() => router.push({ pathname: "/moving/new", params: { fromAddressId: String(id) } })}
          >
            <Truck size={15} color={theme.colors.dim} />
            <Text style={[styles.ctaText, { color: theme.colors.dim }]}>{t("addresses.moveOut")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctaPrimary}
            onPress={() => router.push({ pathname: "/services/new", params: { addressId: String(id) } })}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={theme.colors.gradient.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              <Plus size={15} color={theme.colors.onAccent} />
              <Text style={[styles.ctaText, { color: theme.colors.onAccent }]}>{t("services.newTitle")}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Delete */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel={t("addresses.delete")}
          accessibilityHint={t("addresses.deleteHint")}
        >
          <Trash2 size={16} color={theme.colors.error} />
          <Text style={styles.deleteText}>{t("addresses.delete")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  editBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: theme.colors.accentSoft, borderWidth: 1, borderColor: theme.colors.accentBorder,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text, flex: 1, textAlign: "center" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  // ── Move-reskinned address detail ──
  hero: { marginTop: 8, marginBottom: 4 },
  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: 13 },
  heroPin: {
    width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: theme.colors.accentSoft, borderWidth: 1, borderColor: theme.colors.accentBorder,
  },
  heroTitleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  heroTitle: { flexShrink: 1, fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  statusChipText: { fontSize: 8, letterSpacing: 0.8, textTransform: "uppercase", fontFamily: fonts.sansBold },
  heroAddr: { fontSize: 13, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 4, lineHeight: 18 },
  summary: {
    flexDirection: "row", alignItems: "center", marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  sumBox: { flex: 1, alignItems: "center" },
  sumDivider: { width: 1, height: 26, backgroundColor: theme.colors.border },
  sumV: { fontSize: 18, fontFamily: fonts.sansBold, color: theme.colors.text },
  sumK: { fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase", fontFamily: fonts.sansBold, color: theme.colors.faint, marginTop: 4 },
  section: { marginTop: 22, marginBottom: 10, marginLeft: 2 },
  emptyText: { color: theme.colors.faint, fontFamily: fonts.sans, textAlign: "center", paddingVertical: 18 },
  att: {
    flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderRadius: 16, marginBottom: 8,
    backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: theme.colors.errorFaded,
  },
  attIcon: {
    width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: theme.colors.errorFaded,
  },
  attT: { fontSize: 13, fontFamily: fonts.sansSemibold, color: theme.colors.text },
  attS: { fontSize: 11, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 1 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  cat: {
    width: "48%", flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderRadius: 16,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
  },
  catIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  catT: { fontSize: 12.5, fontFamily: fonts.sansSemibold, color: theme.colors.text },
  catC: { fontSize: 10, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 1 },
  catBadge: {
    minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 999,
    backgroundColor: theme.colors.error, alignItems: "center", justifyContent: "center",
  },
  catBadgeText: { fontSize: 9, fontFamily: fonts.sansBold, color: theme.colors.onAccent },
  actions: { flexDirection: "row", gap: 9, marginTop: 20 },
  ctaGhost: {
    flex: 1, height: 48, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
  },
  ctaPrimary: { flex: 1, height: 48, borderRadius: 14, overflow: "hidden" },
  ctaGrad: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  ctaText: { fontSize: 14, fontFamily: fonts.sansBold },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 32, paddingVertical: 14, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: theme.colors.errorFaded,
  },
  deleteText: { fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.error },
});
