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
import { useTranslation } from "react-i18next";
import { ArrowLeft, Edit, Trash2, Plus, AlertTriangle, ChevronRight, Truck } from "lucide-react-native";
import { monthlyAmountForCycle } from "@locateflow/shared";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListEntrance } from "@/components/ui/ListEntrance";
import { hapticSuccess, hapticError, hapticWarning } from "@/lib/haptics";
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

export default function AddressDetailScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const [address, setAddress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    await fetch_();
    setLoading(false);
  }, [fetch_]);

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
            <Text style={{ color: theme.colors.textTertiary }}>{t("addresses.notFound")}</Text>
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
  const statusLabel = isVacation ? "Seasonal" : isPast ? "Past" : "Active";
  const tone = isVacation ? theme.colors.rose : isPast ? theme.colors.amber : theme.colors.emerald;

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
          style={styles.backBtn}
        >
          <Edit size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Stylized map banner (recreates the design's .ad-dbanner) */}
        <View style={styles.banner}>
          {[0.34, 0.64].map((p) => (
            <View key={`h${p}`} style={{ position: "absolute", left: 0, right: 0, top: `${p * 100}%`, height: 1, backgroundColor: "rgba(236,241,248,0.05)" }} />
          ))}
          {[0.4, 0.72].map((p) => (
            <View key={`v${p}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${p * 100}%`, width: 1, backgroundColor: "rgba(236,241,248,0.05)" }} />
          ))}
          <View style={{ position: "absolute", left: "-5%", right: "-5%", top: "52%", height: 3, backgroundColor: "rgba(236,241,248,0.08)", transform: [{ rotate: "-7deg" }] }} />
          <View style={[styles.bannerPin, { borderColor: tone.text, backgroundColor: tone.text + "33" }]} />
          <View style={styles.bannerFade} />
        </View>

        {/* Header */}
        <View style={styles.dhd}>
          <View style={styles.dhdRow}>
            <Text style={styles.dhdTitle} numberOfLines={1}>
              {address.nickname || (address.isPrimary ? "Current home" : address.street)}
            </Text>
            <View style={[styles.chip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
              <Text style={[styles.chipText, { color: tone.text }]}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={styles.dhdAddr}>
            {address.street}, {address.city}, {address.state} {address.zip}
          </Text>
        </View>

        {/* Summary 3-stat */}
        <View style={styles.summary}>
          <View style={styles.sumBox}>
            <Text style={styles.sumV}>{services.length}</Text>
            <Text style={styles.sumK}>accounts</Text>
          </View>
          <View style={styles.sumBox}>
            <Text style={[styles.sumV, attentionItems.length > 0 && { color: theme.colors.error }]}>{attentionItems.length}</Text>
            <Text style={styles.sumK}>attention</Text>
          </View>
          <View style={styles.sumBox}>
            <Text style={styles.sumV}>{fmtUsd(perMo)}</Text>
            <Text style={styles.sumK}>per mo</Text>
          </View>
        </View>

        {/* Needs attention */}
        {attentionItems.length > 0 && (
          <>
            <Text style={styles.lbl}>Needs attention</Text>
            {attentionItems.map(({ s, days }: any) => (
              <TouchableOpacity
                key={s.id}
                style={styles.att}
                onPress={() => router.push({ pathname: "/services/[id]", params: { id: s.id } })}
              >
                <AlertTriangle size={16} color={theme.colors.error} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.attT} numberOfLines={1}>
                    {(s.providerName || s.provider?.name || "Service")} renews in {days} day{days === 1 ? "" : "s"}
                  </Text>
                  <Text style={styles.attS} numberOfLines={1}>Confirm the billing address before it auto-renews</Text>
                </View>
                <ChevronRight size={14} color={theme.colors.error} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Everything tied here — category menu */}
        <Text style={styles.lbl}>Everything tied here</Text>
        {categories.length === 0 ? (
          <Card variant="default">
            <Text style={{ color: theme.colors.textTertiary, textAlign: "center", paddingVertical: 18 }}>
              {t("services.emptyForAddress")}
            </Text>
          </Card>
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
            style={[styles.cta, styles.ctaGhost]}
            onPress={() => router.push({ pathname: "/moving/new", params: { fromAddressId: String(id) } })}
          >
            <Truck size={15} color={theme.colors.textSecondary} />
            <Text style={[styles.ctaText, { color: theme.colors.textSecondary }]}>{t("addresses.moveOut")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cta, styles.ctaPrimary]}
            onPress={() => router.push({ pathname: "/services/new", params: { addressId: String(id) } })}
          >
            <Plus size={15} color="#fff" />
            <Text style={[styles.ctaText, { color: "#fff" }]}>{t("services.newTitle")}</Text>
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
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text, flex: 1, textAlign: "center" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  // ── Category-menu detail (Aurora design recreation) ──
  banner: {
    height: 130, borderRadius: 18, overflow: "hidden", marginTop: 8, marginBottom: 14,
    backgroundColor: "#0B121E", borderWidth: 1, borderColor: theme.colors.border, position: "relative",
  },
  bannerPin: {
    position: "absolute", left: 42, top: 42, width: 22, height: 22, borderWidth: 2,
    borderTopLeftRadius: 11, borderTopRightRadius: 11, borderBottomRightRadius: 11, borderBottomLeftRadius: 3,
    transform: [{ rotate: "-45deg" }],
  },
  bannerFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 36 },
  dhd: { paddingHorizontal: 2 },
  dhdRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  dhdTitle: { flexShrink: 1, fontSize: 22, fontWeight: "800", color: theme.colors.text, letterSpacing: 0 },
  chip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 8, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: "800" },
  dhdAddr: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 },
  summary: { flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 4 },
  sumBox: {
    flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  sumV: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  sumK: { fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase", color: theme.colors.textTertiary, marginTop: 3 },
  lbl: {
    fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "700",
    color: theme.colors.textTertiary, marginTop: 18, marginBottom: 9, marginLeft: 2,
  },
  att: {
    flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderRadius: 14, marginBottom: 8,
    backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: "rgba(240,140,142,0.22)",
  },
  attT: { fontSize: 13, fontWeight: "600", color: theme.colors.text },
  attS: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  cat: {
    width: "48%", flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderRadius: 14,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  catIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
  },
  catT: { fontSize: 12.5, fontWeight: "600", color: theme.colors.text },
  catC: { fontSize: 10, color: theme.colors.textTertiary, marginTop: 1 },
  catBadge: {
    minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 999,
    backgroundColor: theme.colors.error, alignItems: "center", justifyContent: "center",
  },
  catBadgeText: { fontSize: 9, fontWeight: "800", color: "#2a0809" },
  actions: { flexDirection: "row", gap: 9, marginTop: 18 },
  cta: { flex: 1, height: 46, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  ctaGhost: { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  ctaPrimary: { backgroundColor: theme.colors.primary },
  ctaText: { fontSize: 14, fontWeight: "700" },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 32, paddingVertical: 14, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: "rgba(240, 140, 142, 0.20)",
  },
  deleteText: { fontSize: 14, fontWeight: "600", color: theme.colors.error },
});
