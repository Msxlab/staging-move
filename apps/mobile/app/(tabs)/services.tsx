import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Zap,
  Plus,
  DollarSign,
  Globe,
  Phone,
  AlertTriangle,
  ArrowRight,
  Check,
  X,
  Layers,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import {
  resolveServiceRenewal,
  RENEWAL_SOON_DAYS,
  type ServiceRenewal,
} from "@/lib/service-insights";
import {
  getCategoryIcon,
  getCategoryLabel,
  getMergedDisplayCategoryIcon,
  getMergedDisplayCategoryKey,
  getMergedDisplayCategoryLabel,
} from "@/lib/recommendation-engine";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { OfflineChip } from "@/components/ui/OfflineChip";
import { readOfflineCache, writeOfflineCache, asArray } from "@/lib/offline-cache";
import { SkeletonCard, SkeletonBlock } from "@/components/ui/Skeleton";
import { ListEntrance } from "@/components/ui/ListEntrance";
import { PressableScale } from "@/components/ui/PressableScale";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ServiceLogoMark } from "@/components/services/ServiceLogoMark";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  SERVICE_CATEGORIES,
  generateChecklist,
  RELOCATION_PHASES,
  formatRelativeTime,
  type UserChecklistProfile,
  type RelocationChecklist,
  type ChecklistStateRuleContext,
} from "@locateflow/shared";

/** Offline-cache key for the Services screen's last-known list. */
const SERVICES_CACHE = "services";

/** Sanitize the persisted Services payload back to its two arrays (or null). */
function readServicesCache(raw: unknown): { services: unknown[]; addresses: unknown[] } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const services = asArray(o.services);
  const addresses = asArray(o.addresses);
  return services && addresses ? { services, addresses } : null;
}

const catColors: Record<string, string> = {
  // Aurora-flavored categorical palette — distinct hues, all readable on dark navy.
  GOVERNMENT: "#F08C8E", UTILITY: "#F2C46C", FINANCIAL: "#87DDC0",
  HOUSING: "#7FB6E8", HEALTHCARE: "#F0A0B8", TRANSPORTATION: "#5C9DDC",
  KIDS: "#D99A4E", FITNESS: "#F2C46C", SHOPPING: "#F0A0B8", OTHER: "#6E7C92",
};

const serviceCategoryValues = new Set<string>(SERVICE_CATEGORIES.map((c) => c.value));

function getServiceCategoryGroup(category: string): string {
  if (!category) return "OTHER";
  if (serviceCategoryValues.has(category)) return category;
  return category.split("_")[0] || "OTHER";
}

function getServiceCategoryColor(category: string): string {
  return catColors[getServiceCategoryGroup(category)] || catColors[category] || catColors.OTHER;
}

function getServiceCategoryLabel(category: string): string {
  return SERVICE_CATEGORIES.find((c) => c.value === category)?.label || getMergedDisplayCategoryLabel(category) || getCategoryLabel(category);
}

function getServiceCategoryIcon(category: string): string {
  return getMergedDisplayCategoryIcon(category) || getCategoryIcon(category) || getCategoryIcon(getServiceCategoryGroup(category)) || "";
}

export default function ServicesScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ addressId?: string | string[] }>();
  const [services, setServices] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null | undefined>(undefined);
  const [addressFilterInitialized, setAddressFilterInitialized] = useState(false);
  const [checklist, setChecklist] = useState<RelocationChecklist | null>(null);
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [costValue, setCostValue] = useState("");
  const [savingCost, setSavingCost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Offline fallback: true when the live fetch failed but we still have data on
  // screen (from cache or a prior load). Mirrors the dashboard's offline chip.
  const [offline, setOffline] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);
  const hasDataRef = useRef(false);

  const requestedAddressId = Array.isArray(params.addressId) ? params.addressId[0] : params.addressId;

  // Cold-start hydration: show the last-known list instantly (no skeleton/error
  // wall) on a no-signal launch, then reconcile against the live fetch below.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await readOfflineCache(SERVICES_CACHE, readServicesCache);
      if (cancelled || !cached || hasDataRef.current) return;
      setServices(cached.data.services as any[]);
      setAddresses(cached.data.addresses as any[]);
      setCacheUpdatedAt(cached.updatedAt);
      hasDataRef.current = true;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveCost = async (serviceId: string) => {
    const parsed = parseFloat(costValue);
    if (isNaN(parsed) || parsed < 0) {
      Alert.alert(t("common.retry"), t("validation.invalidNumber"));
      return;
    }
    setSavingCost(true);
    const res = await api.patch<any>(`/api/services/${serviceId}`, { monthlyCost: parsed });
    setSavingCost(false);
    if (res.error) {
      Alert.alert(t("common.retry"), res.error);
    } else {
      setEditingCost(null);
      setCostValue("");
      void fetchServices();
    }
  };

  const serviceCategoryLabel = useCallback(
    (category: string) => t(`categories.${category}`, { defaultValue: getServiceCategoryLabel(category) }),
    [t],
  );

  const serviceBillingCycleLabel = useCallback(
    (cycle: string) => t(`billingCycles.${cycle}`, { defaultValue: cycle.replace("_", " ") }),
    [t],
  );

  const fetchServices = useCallback(async () => {
    const [servicesRes, addressesRes] = await Promise.all([
      api.get<any>("/api/services", { ...(selectedAddressId ? { addressId: selectedAddressId } : {}), limit: "200" }),
      api.get<any>("/api/addresses", { limit: "200" }),
    ]);
    if (servicesRes.error || addressesRes.error) {
      // OFFLINE FALLBACK: if we already have data on screen (cache or prior
      // load), keep it and switch to the quiet offline chip instead of the
      // error wall. Only show the hard error with nothing to fall back to.
      if (hasDataRef.current) {
        setOffline(true);
        setError(null);
      } else {
        setError(servicesRes.error || addressesRes.error || "Could not load services.");
      }
      return false;
    }
    const svcs = servicesRes.data?.services || [];
    const nextAddresses = addressesRes.data?.addresses || [];
    setServices(svcs);
    setAddresses(nextAddresses);
    setError(null);
    // Live data landed → back online; persist the last-known list for next time.
    setOffline(false);
    hasDataRef.current = true;
    const now = new Date();
    setCacheUpdatedAt(now.toISOString());
    void writeOfflineCache(SERVICES_CACHE, { services: svcs, addresses: nextAddresses }, now);

    if (nextAddresses.length === 0) {
      setSelectedAddressId(null);
      setAddressFilterInitialized(true);
    } else if (!addressFilterInitialized) {
      const requested = requestedAddressId && nextAddresses.find((a: any) => a.id === requestedAddressId);
      const primary = nextAddresses.find((a: any) => a.isPrimary);
      setSelectedAddressId(requested?.id || primary?.id || nextAddresses[0].id);
      setAddressFilterInitialized(true);
    } else if (selectedAddressId && !nextAddresses.some((a: any) => a.id === selectedAddressId)) {
      setSelectedAddressId(null);
    }

    // Build checklist if active move exists
    try {
      const [movingRes, profileRes] = await Promise.all([
        api.get<any>("/api/moving"),
        api.get<any>("/api/profile"),
      ]);
      const plans = movingRes.data?.plans || [];
      const activePlan = plans.find((p: any) => p.status === "PLANNING" || p.status === "IN_PROGRESS");
      if (activePlan) {
        const prof = profileRes.data?.profile || profileRes.data || {};
        const cp: UserChecklistProfile = {
          hasChildren: prof.hasChildren ?? false, childrenCount: prof.childrenCount ?? 0,
          hasPets: prof.hasPets ?? false, hasSenior: prof.hasSenior ?? false,
          carCount: prof.carCount ?? 0, hasDisability: prof.hasDisability ?? false,
          needsStorage: prof.needsStorage ?? false, hasMotorcycle: prof.hasMotorcycle ?? false,
          hasBoatRV: prof.hasBoatRV ?? false, isImmigrant: prof.isImmigrant ?? false,
          isBusinessOwner: prof.isBusinessOwner ?? false, moveType: prof.moveType || "PERSONAL",
        };
        const tmpls = new Set<string>(
          (activePlan.tasks || []).filter((t: any) => t.completed && t.templateId).map((t: any) => t.templateId as string)
        );
        const toState = activePlan.toAddress?.state || "";
        let stateRule: ChecklistStateRuleContext | null = null;
        if (toState) {
          try {
            const stateRuleRes = await api.get<any>("/api/state-rules", { state: toState });
            stateRule = stateRuleRes.data?.stateRule || null;
          } catch {
            stateRule = null;
          }
        }
        setChecklist(generateChecklist(cp, new Date(activePlan.moveDate), activePlan.fromAddress?.state || "", toState, tmpls, stateRule));
      } else {
        setChecklist(null);
      }
    } catch { /* non-blocking */ }
    return true;
  }, [addressFilterInitialized, requestedAddressId, selectedAddressId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchServices();
    } finally {
      setLoading(false);
    }
  }, [fetchServices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchServices();
    } finally {
      setRefreshing(false);
    }
  }, [fetchServices]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t("services.title")}</Text>
            <Text style={styles.subtitle}>{t("common.loading")}</Text>
          </View>
          <View style={styles.addButton}>
            <Plus size={20} color="#fff" />
          </View>
        </View>
        <View style={styles.hero}>
          <SkeletonBlock width="45%" height={10} />
          <View style={{ marginTop: 12 }}>
            <SkeletonBlock width="60%" height={28} />
          </View>
          <View style={{ marginTop: 14 }}>
            <SkeletonBlock width="100%" height={9} />
          </View>
        </View>
        <View style={[styles.scrollContent, styles.list]}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} lines={2} showFooter />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  const filtered = filterCat ? services.filter((s) => getMergedDisplayCategoryKey(s.category) === filterCat) : services;
  const totalMonthly = filtered.reduce((sum, s) => sum + (s.monthlyCost || 0), 0);
  const selectedAddress = selectedAddressId ? addresses.find((address) => address.id === selectedAddressId) : null;
  const categories = [...new Set(services.map((s) => getMergedDisplayCategoryKey(s.category)))].sort((a, b) => serviceCategoryLabel(a).localeCompare(serviceCategoryLabel(b)));
  const uncostedCount = filtered.filter((service) => !service.monthlyCost || service.monthlyCost <= 0).length;

  // ── Aurora hero derivations ──
  // Overall (address-scoped) numbers, independent of the category filter, so
  // the hero stays stable while the user pivots the list below it.
  const heroMonthly = services.reduce((sum, s) => sum + (s.monthlyCost || 0), 0);
  const activeServiceCount = services.filter((s) => s.isActive !== false).length;
  const catTotals = categories
    .map((cat) => ({
      cat,
      total: services
        .filter((s) => getMergedDisplayCategoryKey(s.category) === cat)
        .reduce((sum, s) => sum + (s.monthlyCost || 0), 0),
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const heroChips = catTotals.slice(0, 3);

  // "Needs attention" — derived ONLY from existing renewal signals
  // (contractEndDate, or recurring billingDay + billingCycle), the exact
  // derivation the service detail screen already uses. No new data concepts.
  const renewalById = new Map<string, ServiceRenewal>();
  for (const s of services) {
    if (s.isActive === false) continue;
    const r = resolveServiceRenewal(s);
    if (r) renewalById.set(s.id, r);
  }
  const attentionItems = services.filter((s) => {
    const r = renewalById.get(s.id);
    return r != null && r.days <= RENEWAL_SOON_DAYS; // includes overdue (days < 0)
  });
  const missingCostCount = services.filter((service) => !service.monthlyCost || service.monthlyCost <= 0).length;
  const pricedServiceCount = services.length - missingCostCount;
  const serviceHealthPct = activeServiceCount > 0
    ? Math.max(0, Math.round(((activeServiceCount - attentionItems.length) / activeServiceCount) * 100))
    : services.length > 0
      ? 100
      : 0;
  const serviceHealthTone = attentionItems.length > 0
    ? theme.colors.amber
    : missingCostCount > 0
      ? theme.colors.sky
      : theme.colors.emerald;

  // Same headline copy as the detail screen (services/[id].tsx), reusing its keys.
  const renewalHeadline = (renewal: ServiceRenewal) =>
    renewal.days < 0
      ? renewal.source === "contract"
        ? t("services.renewalContractEnded", { defaultValue: "Contract ended" })
        : t("services.renewalPast", { defaultValue: "Was due" })
      : renewal.days === 0
        ? t("services.renewalToday", { defaultValue: "Due today" })
        : renewal.source === "contract"
          ? t("services.renewalContractIn", { count: renewal.days, defaultValue: `Contract ends in ${renewal.days} days` })
          : t("services.renewalIn", { count: renewal.days, defaultValue: `Renews in ${renewal.days} days` });

  // Per-row status pill — existing service status (isActive) sharpened with the
  // existing renewal signal. Labels reuse existing i18n keys only.
  const statusPillFor = (service: any): { label: string; text: string; bg: string; border: string } => {
    if (!service.isActive) {
      return { label: t("services.statusInactive"), text: theme.colors.textTertiary, bg: theme.colors.surface, border: theme.colors.border };
    }
    const renewal = renewalById.get(service.id);
    if (renewal && renewal.days < 0) {
      return { label: t("services.renewalOverdueBadge", { defaultValue: "Overdue" }), text: theme.colors.error, bg: theme.colors.errorFaded, border: theme.colors.error + "47" };
    }
    if (renewal && renewal.days <= RENEWAL_SOON_DAYS) {
      return { label: t("services.renewalSoonBadge", { defaultValue: "Soon" }), text: theme.colors.amber.text, bg: theme.colors.amber.bg, border: theme.colors.amber.border };
    }
    return { label: t("services.statusActive"), text: theme.colors.emerald.text, bg: theme.colors.emerald.bg, border: theme.colors.emerald.border };
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
      <View style={[styles.header, styles.inScrollHeader]}>
        <View>
          <Text style={styles.title}>{t("services.title")}</Text>
          <Text style={styles.subtitle}>
            {selectedAddress ? `${selectedAddress.nickname || selectedAddress.city} · ` : ""}
            {t("services.summaryLine", { count: filtered.length, total: formatNumber(totalMonthly, i18n.language) })}
          </Text>
        </View>
        <PressableScale
          style={[styles.addButton, addresses.length === 0 && { opacity: 0.5 }]}
          onPress={() => router.push(selectedAddressId ? { pathname: "/services/new", params: { addressId: selectedAddressId } } : "/services/new")}
          disabled={addresses.length === 0}
          accessibilityLabel={t("services.newTitle")}
        >
          <Plus size={20} color="#fff" />
        </PressableScale>
      </View>

      {/* Aurora glass hero — monthly overview + category cost distribution */}
      <View style={[styles.hero, styles.inScrollHero]}>
        <View style={styles.heroTop}>
          <Text style={styles.heroKicker}>{t("services.monthlyServices").toUpperCase()}</Text>
          <View style={styles.heroBadge}>
            <Layers size={12} color={theme.colors.accent} />
            <Text style={styles.heroBadgeText}>{t("services.trackedCount", { count: services.length }).toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.heroBig} accessibilityLabel={`${formatCurrency(heroMonthly, i18n.language)} ${t("services.heroMonthlySuffix", { count: activeServiceCount })}`}>
          {formatCurrency(heroMonthly, i18n.language)}
          <Text style={styles.heroBigSuffix}>{t("services.heroMonthlySuffix", { count: activeServiceCount })}</Text>
        </Text>
        {catTotals.length > 0 && (
          <View style={styles.heroBar}>
            {catTotals.map((c) => (
              <View key={c.cat} style={[styles.heroBarSeg, { flex: c.total, backgroundColor: getServiceCategoryColor(c.cat) }]} />
            ))}
          </View>
        )}
        {heroChips.length > 0 && (
          <View style={styles.heroChips}>
            {heroChips.map((c) => {
              const color = getServiceCategoryColor(c.cat);
              const on = filterCat === c.cat;
              return (
                <View key={c.cat} style={styles.heroChipWrap}>
                  <PressableScale
                    style={[styles.heroChip, { backgroundColor: color + "1A", borderColor: color + (on ? "8C" : "42") }]}
                    onPress={() => setFilterCat(on ? null : c.cat)}
                    accessibilityLabel={`${serviceCategoryLabel(c.cat)} · ${formatCurrency(c.total, i18n.language)}`}
                  >
                    <View style={[styles.heroChipSwatch, { backgroundColor: color }]} />
                    <Text style={styles.heroChipName} numberOfLines={1}>{serviceCategoryLabel(c.cat).toUpperCase()}</Text>
                    <Text style={styles.heroChipValue}>{formatCurrency(c.total, i18n.language)}</Text>
                  </PressableScale>
                </View>
              );
            })}
          </View>
        )}
        <Text style={styles.heroHint}>
          {uncostedCount > 0 ? t("services.missingCostHint", { count: uncostedCount }) : t("services.summaryHint")}
        </Text>
      </View>

      {addresses.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.addressRow} contentContainerStyle={[styles.addressContent, styles.inScrollChipContent]}>
          <TouchableOpacity
            style={[styles.addressChip, !selectedAddressId && styles.addressChipActive]}
            onPress={() => setSelectedAddressId(null)}
          >
            <Text style={[styles.addressChipText, !selectedAddressId && styles.addressChipTextActive]}>{t("addresses.all")}</Text>
          </TouchableOpacity>
          {addresses.map((address) => (
            <TouchableOpacity
              key={address.id}
              style={[styles.addressChip, selectedAddressId === address.id && styles.addressChipActive]}
              onPress={() => setSelectedAddressId(address.id)}
            >
              <Text style={[styles.addressChipText, selectedAddressId === address.id && styles.addressChipTextActive]} numberOfLines={1} ellipsizeMode="tail">
                {address.nickname || `${address.city}, ${address.state}`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Category Filter */}
      {categories.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={[styles.filterContent, styles.inScrollChipContent]}>
          <TouchableOpacity
            style={[styles.filterChip, !filterCat && styles.filterChipActive]}
            onPress={() => setFilterCat(null)}
          >
            <Text style={[styles.filterText, !filterCat && styles.filterTextActive]}>{t("common.all")}</Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, filterCat === cat && styles.filterChipActive]}
              onPress={() => setFilterCat(filterCat === cat ? null : cat)}
            >
              <CategoryIcon
                emoji={getServiceCategoryIcon(cat)}
                size={13}
                color={filterCat === cat ? theme.colors.primary : getServiceCategoryColor(cat)}
              />
              <Text style={[styles.filterText, filterCat === cat && styles.filterTextActive]} numberOfLines={1} ellipsizeMode="tail">
                {serviceCategoryLabel(cat)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

        {/* Offline: live fetch failed but we hydrated the last-known list. */}
        {offline && (
          <OfflineChip relativeAge={cacheUpdatedAt ? formatRelativeTime(cacheUpdatedAt, i18n.language) : ""} />
        )}

        {!(error && services.length === 0) && services.length > 0 && (
          <View style={styles.systemPanel}>
            <View style={styles.systemHead}>
              <View
                style={[
                  styles.systemGlyph,
                  { backgroundColor: serviceHealthTone.bg, borderColor: serviceHealthTone.border },
                ]}
              >
                {attentionItems.length > 0 ? (
                  <AlertTriangle size={18} color={serviceHealthTone.text} />
                ) : (
                  <Check size={18} color={serviceHealthTone.text} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.systemTitle}>
                  {t("services.healthTitle", { defaultValue: "Service health" })}
                </Text>
                <Text style={styles.systemMeta} numberOfLines={2}>
                  {attentionItems.length > 0
                    ? t("services.healthAttention", {
                        count: attentionItems.length,
                        defaultValue: `${attentionItems.length} service needs attention`,
                      })
                    : missingCostCount > 0
                      ? t("services.healthCosts", {
                          count: missingCostCount,
                          defaultValue: `${missingCostCount} services are missing monthly costs`,
                        })
                      : t("services.healthGood", { defaultValue: "Everything important is tracked cleanly." })}
                </Text>
              </View>
              <Text style={[styles.systemScore, { color: serviceHealthTone.text }]}>
                {serviceHealthPct}%
              </Text>
            </View>

            <View style={styles.systemMeter}>
              <View
                style={[
                  styles.systemMeterFill,
                  { width: `${serviceHealthPct}%`, backgroundColor: serviceHealthTone.text },
                ]}
              />
            </View>

            <View style={styles.systemGrid}>
              <View style={styles.systemStat}>
                <Text style={styles.systemStatValue}>{activeServiceCount}</Text>
                <Text style={styles.systemStatLabel}>{t("services.statusActive")}</Text>
              </View>
              <View style={styles.systemStat}>
                <Text style={styles.systemStatValue}>{pricedServiceCount}</Text>
                <Text style={styles.systemStatLabel}>
                  {t("services.priced", { defaultValue: "Priced" })}
                </Text>
              </View>
              <View style={styles.systemStat}>
                <Text style={styles.systemStatValue}>{attentionItems.length}</Text>
                <Text style={styles.systemStatLabel}>
                  {t("services.needsAttention")}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Phase-Aware Checklist Widget */}
        {checklist && (() => {
          const phase = RELOCATION_PHASES.find((p) => p.phase === checklist.currentPhase);
          const currentItems = checklist.phases.find((p) => p.phase === checklist.currentPhase);
          const pending = currentItems?.items.filter((i) => !i.isCompleted).slice(0, 3) || [];
          return (
            <View style={{ marginBottom: 16, borderRadius: 16, borderWidth: 1, borderColor: "rgba(127, 182, 232,0.2)", backgroundColor: "rgba(127, 182, 232,0.04)", padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <CategoryIcon emoji={phase?.icon || ""} size={16} color={theme.colors.primary} />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: theme.colors.text }}>
                    {phase?.label || t("moving.checklist")}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: theme.colors.primary }}>
                  {checklist.progressPercent}%
                </Text>
              </View>

              <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.05)", marginBottom: 10, overflow: "hidden" }}>
                <View style={{ height: "100%", borderRadius: 2, backgroundColor: theme.colors.primary, width: `${checklist.progressPercent}%` }} />
              </View>

              {checklist.overdueItems.length > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, padding: 8, borderRadius: 8, backgroundColor: theme.colors.errorFaded }}>
                  <AlertTriangle size={12} color={theme.colors.error} />
                  <Text style={{ fontSize: 11, color: theme.colors.error, flex: 1 }} numberOfLines={1}>
                    {t("moving.overdueSummary", { count: checklist.overdueItems.length, title: checklist.overdueItems[0]?.title })}
                  </Text>
                </View>
              )}

              {pending.map((item) => (
                <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
                  <CategoryIcon emoji={item.icon} size={14} color={theme.colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary }} numberOfLines={1}>{item.title}</Text>
                    {item.stateNote ? (
                      <Text style={{ fontSize: 10, color: theme.colors.info }} numberOfLines={2}>{item.stateNote}</Text>
                    ) : null}
                  </View>
                  {item.estimatedMinutes ? (
                    <Text style={{ fontSize: 10, color: theme.colors.textMuted }}>{t("common.minutesShort", { minutes: item.estimatedMinutes })}</Text>
                  ) : null}
                </View>
              ))}

              {checklist.nextAction && !checklist.nextAction.isCompleted && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, paddingVertical: 10, borderRadius: 10, backgroundColor: theme.colors.primary }}
                  onPress={() => router.push("/services/new")}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>{t("services.addNext")}</Text>
                  <ArrowRight size={14} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        {/* Needs attention — services with an imminent/overdue renewal signal */}
        {attentionItems.length > 0 && (
          <View style={styles.attnList}>
            <View style={styles.secRow}>
              <Text style={styles.secKicker}>{t("services.needsAttention").toUpperCase()}</Text>
              <Text style={styles.secCount}>{attentionItems.length}</Text>
            </View>
            {attentionItems.map((service: any) => {
              const renewal = renewalById.get(service.id);
              if (!renewal) return null;
              const headline = renewalHeadline(renewal);
              return (
                <PressableScale
                  key={service.id}
                  style={styles.attnRow}
                  onPress={() => router.push({ pathname: "/services/[id]", params: { id: service.id } })}
                  accessibilityLabel={`${service.providerName} · ${headline}`}
                >
                  <View style={styles.attnIcon}>
                    <AlertTriangle size={16} color={theme.colors.error} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.attnTitle} numberOfLines={1}>{service.providerName}</Text>
                    <Text style={styles.attnSub} numberOfLines={1}>
                      {headline}
                      {service.address ? ` · ${service.address.nickname || service.address.city}` : ""}
                    </Text>
                  </View>
                  <View style={styles.attnGo}>
                    <ArrowRight size={13} color={theme.colors.error} />
                  </View>
                </PressableScale>
              );
            })}
          </View>
        )}

        {error && services.length > 0 ? (
          <View style={{ marginHorizontal: 16, marginBottom: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.rose.text }}>
            <Text style={{ color: theme.colors.rose.text, fontSize: 12, textAlign: "center" }}>{error}</Text>
          </View>
        ) : null}
        {error && services.length === 0 ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (() => {
          const isFiltered = Boolean(filterCat) || services.length > 0;
          const suggestParams: Record<string, string> = { mode: "manual", suggest: "1" };
          if (filterCat) suggestParams.category = filterCat;
          if (selectedAddressId) suggestParams.addressId = selectedAddressId;
          return (
            <EmptyState
              icon={<Zap size={32} color={theme.colors.primary} />}
              title={filterCat ? t("services.emptyCategory") : t("services.empty")}
              description={
                isFiltered
                  ? t("services.suggestProviderDescription", {
                      defaultValue: "Can't find your provider? Add it manually — our team will review and add it to the system if valid.",
                    })
                  : t("services.emptyDescription")
              }
              actionLabel={
                isFiltered
                  ? t("services.suggestProvider", { defaultValue: "Add manually for review" })
                  : t("services.newTitle")
              }
              onAction={() =>
                router.push(
                  isFiltered
                    ? { pathname: "/services/new", params: suggestParams }
                    : selectedAddressId
                      ? { pathname: "/services/new", params: { addressId: selectedAddressId } }
                      : "/services/new",
                )
              }
              secondaryActionLabel={
                isFiltered ? t("services.newTitle") : undefined
              }
              onSecondaryAction={
                isFiltered
                  ? () =>
                      router.push(
                        selectedAddressId
                          ? { pathname: "/services/new", params: { addressId: selectedAddressId } }
                          : "/services/new",
                      )
                  : undefined
              }
            />
          );
        })() : (
          <View style={styles.list}>
            {filtered.map((service: any, index: number) => {
              return (
              <ListEntrance key={service.id} index={index}>
              <Card variant="default" onPress={() => editingCost !== service.id && router.push({ pathname: "/services/[id]", params: { id: service.id } })}>
                <View style={styles.serviceTop}>
                  <ServiceLogoMark
                    service={service}
                    fallbackIcon={getServiceCategoryIcon(service.category)}
                    backgroundColor={getServiceCategoryColor(service.category) + "30"}
                    borderColor={getServiceCategoryColor(service.category) + "50"}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.serviceName} numberOfLines={1}>{service.providerName}</Text>
                    <Text style={styles.serviceCategory} numberOfLines={1}>
                      {t(`categories.${service.category}`, { defaultValue: getServiceCategoryLabel(service.category) })}
                      {service.address ? ` · ${service.address.nickname || service.address.city}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{ alignItems: "flex-end" }}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      if (editingCost === service.id) {
                        setEditingCost(null);
                      } else {
                        setEditingCost(service.id);
                        setCostValue(service.monthlyCost ? String(service.monthlyCost) : "");
                      }
                    }}
                    activeOpacity={0.6}
                  >
                    {service.monthlyCost > 0 ? (
                      <Text style={styles.cost}>{formatCurrency(service.monthlyCost, i18n.language)}<Text style={styles.costPer}>/mo</Text></Text>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(242, 196, 108,0.1)", borderWidth: 1, borderColor: "rgba(242, 196, 108,0.25)" }}>
                        <DollarSign size={10} color="#F2C46C" />
                        <Text style={{ fontSize: 10, fontWeight: "600", color: "#F2C46C" }}>{t("services.addCost")}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Inline cost editor */}
                {editingCost === service.id && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                    <DollarSign size={14} color={theme.colors.textMuted} />
                    <TextInput
                      style={{ flex: 1, fontSize: 14, color: theme.colors.text, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                      placeholder={t("services.monthlyCost")}
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="decimal-pad"
                      value={costValue}
                      onChangeText={setCostValue}
                      autoFocus
                    />
                    <TouchableOpacity
                      onPress={() => handleSaveCost(service.id)}
                      disabled={savingCost}
                      style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" }}
                    >
                      <Check size={14} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setEditingCost(null); setCostValue(""); }}
                      style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" }}
                    >
                      <X size={14} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.serviceDetails}>
                  {service.website && (
                    <View style={[styles.detailItem, { flexShrink: 1, minWidth: 0 }]}>
                      <Globe size={12} color={theme.colors.textMuted} />
                      <Text style={styles.detailText} numberOfLines={1}>{service.website.replace(/^https?:\/\//, "")}</Text>
                    </View>
                  )}
                  {service.phone && (
                    <View style={[styles.detailItem, { flexShrink: 1, minWidth: 0 }]}>
                      <Phone size={12} color={theme.colors.textMuted} />
                      <Text style={styles.detailText} numberOfLines={1}>{service.phone}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.serviceFooter}>
                  {(() => {
                    const pill = statusPillFor(service);
                    return (
                      <View style={[styles.statusPill, { backgroundColor: pill.bg, borderColor: pill.border }]} accessibilityLabel={pill.label}>
                        <View style={[styles.statusPillDot, { backgroundColor: pill.text }]} />
                        <Text style={[styles.statusPillText, { color: pill.text }]}>{pill.label.toUpperCase()}</Text>
                      </View>
                    );
                  })()}
                  {service.billingCycle && (
                    <UiBadge label={serviceBillingCycleLabel(service.billingCycle)} variant="info" />
                  )}
                </View>
              </Card>
              </ListEntrance>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
  inScrollHeader: { paddingHorizontal: 0 },
  title: { fontSize: 28, fontWeight: "800", color: theme.colors.text, letterSpacing: 0 },
  subtitle: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", ...theme.shadow.glow },
  // ── Aurora glass hero ──
  hero: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: theme.radius["2xl"],
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    ...theme.shadow.glow,
  },
  inScrollHero: { marginHorizontal: 0 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  heroKicker: { fontSize: 10, letterSpacing: 1.4, fontWeight: "700", color: theme.colors.textTertiary },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.warningFaded,
    borderWidth: 1,
    borderColor: theme.colors.amber.border,
  },
  heroBadgeText: { fontSize: 9, letterSpacing: 1, fontWeight: "700", color: theme.colors.accent },
  heroBig: { fontSize: 32, fontWeight: "800", letterSpacing: 0, color: theme.colors.text, fontVariant: ["tabular-nums"] },
  heroBigSuffix: { fontSize: 12, fontWeight: "500", letterSpacing: 0, color: theme.colors.textTertiary },
  heroBar: { flexDirection: "row", gap: 3, height: 9, marginTop: 14, marginBottom: 12 },
  heroBarSeg: { borderRadius: 4 },
  heroChips: { flexDirection: "row", gap: 8 },
  heroChipWrap: { flex: 1 },
  heroChip: { alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 13, borderWidth: 1 },
  heroChipSwatch: { width: 18, height: 18, borderRadius: 6 },
  heroChipName: { fontSize: 8, letterSpacing: 0.8, fontWeight: "700", color: theme.colors.textSecondary },
  heroChipValue: { fontSize: 14, fontWeight: "800", color: theme.colors.text, fontVariant: ["tabular-nums"] },
  heroHint: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 12, lineHeight: 16 },
  // ── Operational health panel ──
  systemPanel: {
    marginBottom: 16,
    padding: 14,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    ...theme.shadow.sm,
  },
  systemHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  systemGlyph: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  systemTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.text },
  systemMeta: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2, lineHeight: 17 },
  systemScore: { fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] },
  systemMeter: {
    height: 6,
    marginTop: 13,
    borderRadius: 999,
    backgroundColor: theme.colors.glass.highlight,
    overflow: "hidden",
  },
  systemMeterFill: { height: "100%", borderRadius: 999 },
  systemGrid: { flexDirection: "row", gap: 8, marginTop: 12 },
  systemStat: {
    flex: 1,
    minHeight: 58,
    padding: 10,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.025)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  systemStatValue: { fontSize: 18, fontWeight: "900", color: theme.colors.text, fontVariant: ["tabular-nums"] },
  systemStatLabel: { fontSize: 10, color: theme.colors.textTertiary, marginTop: 3, fontWeight: "700" },
  // ── Needs attention ──
  secRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 4, paddingHorizontal: 2 },
  secKicker: { fontSize: 10, letterSpacing: 1.4, fontWeight: "700", color: theme.colors.textTertiary },
  secCount: { fontSize: 10, letterSpacing: 1, fontWeight: "700", color: theme.colors.accent },
  attnList: { gap: 8, marginBottom: 16 },
  attnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderRadius: 14,
    backgroundColor: theme.colors.errorFaded,
    borderWidth: 1,
    borderColor: theme.colors.error + "38",
  },
  attnIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.errorFaded,
    borderWidth: 1,
    borderColor: theme.colors.error + "38",
  },
  attnTitle: { fontSize: 13, fontWeight: "600", color: theme.colors.text },
  attnSub: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },
  attnGo: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.error + "4D",
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Status pill (dot + mono uppercase) ──
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillDot: { width: 5, height: 5, borderRadius: 999 },
  statusPillText: { fontSize: 8, letterSpacing: 1, fontWeight: "700" },
  addressRow: { marginHorizontal: 20, marginBottom: 8, overflow: "visible" },
  addressContent: { paddingHorizontal: 0, paddingVertical: 6, gap: 8, alignItems: "center" },
  inScrollChipContent: { paddingHorizontal: 0 },
  addressChip: {
    minWidth: 74,
    maxWidth: 180,
    minHeight: 38,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  addressChipActive: { backgroundColor: theme.colors.card, borderColor: theme.colors.borderFocus },
  addressChipText: { fontSize: 12, fontWeight: "800", color: theme.colors.textSecondary, textAlign: "center" },
  addressChipTextActive: { color: theme.colors.primary },
  filterRow: { marginHorizontal: 20, marginBottom: 12, overflow: "visible" },
  filterContent: { paddingHorizontal: 0, paddingVertical: 6, gap: 8, alignItems: "center" },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 38,
    minWidth: 68,
    maxWidth: 168,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: { backgroundColor: theme.colors.card, borderColor: theme.colors.borderFocus },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterText: { flexShrink: 1, fontSize: 12, color: theme.colors.textSecondary, fontWeight: "800" },
  filterTextActive: { color: theme.colors.primary },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 140, paddingTop: 8 },
  list: { gap: 12 },
  serviceTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  serviceName: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  serviceCategory: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  cost: { fontSize: 16, fontWeight: "800", color: theme.colors.emerald.text },
  costPer: { fontSize: 11, fontWeight: "500", color: theme.colors.textTertiary },
  serviceDetails: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "48%" },
  detailText: { fontSize: 12, color: theme.colors.textTertiary, flexShrink: 1 },
  serviceFooter: { flexDirection: "row", gap: 6, marginTop: 10 },
});
