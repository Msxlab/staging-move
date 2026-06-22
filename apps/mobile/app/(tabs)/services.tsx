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
import { useFocusEffect } from "@react-navigation/native";
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
  Sparkles,
  Search,
  Home,
  Building2,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme, fonts, categoryColors } from "@/lib/theme";
import { SectionHeader, MoveProgressBar } from "@/components/move";
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
import { peekOfflineCache, readOfflineCache, writeOfflineCache, asArray } from "@/lib/offline-cache";
import { SkeletonCard, SkeletonBlock } from "@/components/ui/Skeleton";
import { ListEntrance } from "@/components/ui/ListEntrance";
import { PressableScale } from "@/components/ui/PressableScale";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ServiceLogoMark } from "@/components/services/ServiceLogoMark";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useAuthStore } from "@/lib/auth-store";
import { isHighestConsumerPlan, serviceLimitForPlan } from "@/lib/plan-comparison";
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

// Categorical palette shared via `@/lib/theme` (`categoryColors`) — a single
// source for the same hue map the list, detail and edit screens all use.
const serviceCategoryValues = new Set<string>(SERVICE_CATEGORIES.map((c) => c.value));

function getServiceCategoryGroup(category: string): string {
  if (!category) return "OTHER";
  if (serviceCategoryValues.has(category)) return category;
  return category.split("_")[0] || "OTHER";
}

function getServiceCategoryColor(category: string): string {
  return categoryColors[getServiceCategoryGroup(category)] || categoryColors[category] || categoryColors.OTHER;
}

function getServiceCategoryLabel(category: string): string {
  return SERVICE_CATEGORIES.find((c) => c.value === category)?.label || getMergedDisplayCategoryLabel(category) || getCategoryLabel(category);
}

function getServiceCategoryIcon(category: string): string {
  return getMergedDisplayCategoryIcon(category) || getCategoryIcon(category) || getCategoryIcon(getServiceCategoryGroup(category)) || "";
}

type RecommendationProviderPayload = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  matchReasons?: string[] | null;
  explanation?: { reason?: string | null; profileMatch?: string | null } | null;
};

type RecommendationGuideLane = {
  key: string;
  title: string;
  description?: string | null;
  providers?: RecommendationProviderPayload[] | null;
};

type RecommendationGuide = {
  summary?: string | null;
  lanes?: RecommendationGuideLane[] | null;
  profileSignals?: string[] | null;
};

export default function ServicesScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ addressId?: string | string[] }>();
  const planTier = useAuthStore((s) => s.planTier);
  const requestedAddressId = Array.isArray(params.addressId) ? params.addressId[0] : params.addressId;
  const initialServicesCache = useMemo(() => peekOfflineCache(SERVICES_CACHE, readServicesCache), []);
  const initialCachedAddresses = initialServicesCache?.data.addresses as any[] | undefined;
  const initialSelectedAddressId = useMemo(() => {
    if (!initialCachedAddresses || initialCachedAddresses.length === 0) return undefined;
    const requested = requestedAddressId && initialCachedAddresses.find((a: any) => a.id === requestedAddressId);
    const primary = initialCachedAddresses.find((a: any) => a.isPrimary);
    return requested?.id || primary?.id || initialCachedAddresses[0]?.id;
  }, [initialCachedAddresses, requestedAddressId]);
  const [services, setServices] = useState<any[]>(() => (initialServicesCache?.data.services as any[] | undefined) ?? []);
  const [totalServiceCount, setTotalServiceCount] = useState(0);
  const [addresses, setAddresses] = useState<any[]>(() => initialCachedAddresses ?? []);
  const [loading, setLoading] = useState(() => !initialServicesCache);
  const [refreshing, setRefreshing] = useState(false);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null | undefined>(() => initialSelectedAddressId);
  const [addressFilterInitialized, setAddressFilterInitialized] = useState(() => Boolean(initialServicesCache));
  const [checklist, setChecklist] = useState<RelocationChecklist | null>(null);
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [costValue, setCostValue] = useState("");
  const [savingCost, setSavingCost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendationGuide, setRecommendationGuide] = useState<RecommendationGuide | null>(null);
  const [missingCritical, setMissingCritical] = useState<string[]>([]);
  // Offline fallback: true when the live fetch failed but we still have data on
  // screen (from cache or a prior load). Mirrors the dashboard's offline chip.
  const [offline, setOffline] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(() => initialServicesCache?.updatedAt ?? null);
  const hasDataRef = useRef(Boolean(initialServicesCache));
  const loadedOnceRef = useRef(Boolean(initialServicesCache));
  const fetchServicesRef = useRef<() => Promise<boolean>>(async () => false);

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
    const [servicesRes, addressesRes, allServicesRes, recommendationsRes] = await Promise.all([
      api.get<any>("/api/services", { ...(selectedAddressId ? { addressId: selectedAddressId } : {}), limit: "200" }),
      api.get<any>("/api/addresses", { limit: "200" }),
      selectedAddressId ? api.get<any>("/api/services", { limit: "200" }) : Promise.resolve(null),
      api
        .get<any>("/api/providers/recommendations", {
          ...(selectedAddressId ? { addressId: selectedAddressId } : {}),
        })
        .catch((err) => ({ error: err instanceof Error ? err.message : "Could not load provider gaps." })),
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
    const accountServices = selectedAddressId
      ? allServicesRes?.data?.services || svcs
      : svcs;
    setServices(svcs);
    setTotalServiceCount(accountServices.length);
    setAddresses(nextAddresses);
    if (recommendationsRes && !recommendationsRes.error && "data" in recommendationsRes) {
      setRecommendationGuide(recommendationsRes.data?.recommendationGuide || null);
      const missing = recommendationsRes.data?.stats?.missingCritical;
      setMissingCritical(Array.isArray(missing) ? missing.filter(Boolean) : []);
    } else {
      setRecommendationGuide(null);
      setMissingCritical([]);
    }
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
    if (!hasDataRef.current) setLoading(true);
    try {
      await fetchServices();
    } finally {
      loadedOnceRef.current = true;
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
  useEffect(() => {
    fetchServicesRef.current = fetchServices;
  }, [fetchServices]);

  useFocusEffect(
    useCallback(() => {
      if (!loadedOnceRef.current) return undefined;
      void fetchServicesRef.current();
      return undefined;
    }, []),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t("services.title")}</Text>
            <Text style={styles.subtitle}>{t("common.loading")}</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.addButton}>
              <Plus size={16} color={theme.colors.primary} />
            </View>
            <View style={styles.searchButton}>
              <Search size={16} color={theme.colors.dim} />
            </View>
          </View>
        </View>
        <View style={styles.healthGrid}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.healthTile}>
              <SkeletonBlock width="50%" height={22} />
              <View style={{ marginTop: 6 }}>
                <SkeletonBlock width="70%" height={9} />
              </View>
            </View>
          ))}
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
  const serviceLimit = serviceLimitForPlan(planTier);
  const serviceLimitReached = planTier != null && totalServiceCount >= serviceLimit;
  const serviceAtTopTierLimit = serviceLimitReached && isHighestConsumerPlan(planTier);
  const serviceLimitBody = () =>
    serviceAtTopTierLimit
      ? t("services.safetyLimitWithCount", {
          current: totalServiceCount,
          limit: serviceLimit,
          defaultValue: `You've reached the safety limit of ${serviceLimit} services for this account. Archive old services or contact support if you need more.`,
        })
      : t("services.limitReachedWithCount", {
          current: totalServiceCount,
          limit: serviceLimit,
          defaultValue: `Your current access includes ${serviceLimit} services. Review access or contact support if this looks wrong.`,
        });
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
  const healthAttentionIds = new Set<string>(attentionItems.map((service) => service.id));
  for (const service of services) {
    if (service.isActive === false) continue;
    if (!service.monthlyCost || service.monthlyCost <= 0) healthAttentionIds.add(service.id);
  }
  const healthAttentionCount = healthAttentionIds.size;
  const missingCriticalCategories = Array.from(new Set(missingCritical.filter(Boolean)));
  const missingCategoryKeys = new Set(missingCriticalCategories.map((category) => getMergedDisplayCategoryKey(category)));
  const providerGapItems = (recommendationGuide?.lanes || [])
    .filter((lane) => lane.key === "setup_first" || lane.key === "best_matches")
    .flatMap((lane) => lane.providers || [])
    .filter((provider, index, providers) => {
      if (!provider?.id || !provider.category) return false;
      if (!missingCategoryKeys.has(getMergedDisplayCategoryKey(provider.category))) return false;
      return providers.findIndex((item) => item.id === provider.id) === index;
    })
    .slice(0, 3);
  const providerGapCount = missingCriticalCategories.length;
  const serviceHealthIssueCount = healthAttentionCount + providerGapCount;
  const serviceHealthBase = activeServiceCount + providerGapCount;
  const serviceHealthPct = serviceHealthBase > 0
    ? Math.max(0, Math.round(((activeServiceCount - healthAttentionCount) / serviceHealthBase) * 100))
    : services.length > 0
      ? 100
      : 0;
  const serviceHealthTone = serviceHealthIssueCount > 0
    ? theme.colors.amber
    : theme.colors.emerald;
  const providerGapLabels = missingCriticalCategories
    .slice(0, 4)
    .map((category) => serviceCategoryLabel(category));
  const firstProviderGapCategory = providerGapItems[0]?.category || missingCriticalCategories[0];

  const openProviderGap = (provider?: RecommendationProviderPayload) => {
    const params: Record<string, string> = { guide: "services_health" };
    if (selectedAddressId) params.addressId = selectedAddressId;
    if (provider?.id) params.providerId = provider.id;
    if (provider?.category || firstProviderGapCategory) params.category = provider?.category || firstProviderGapCategory;
    if (!provider?.id && providerGapItems.length > 0) {
      params.providerIds = providerGapItems.map((item) => item.id).join(",");
    }
    router.push({ pathname: "/services/new", params } as any);
  };

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

  // ── Category sections — group the (filtered) list by display category so
  // the list reads as the design's category-sectioned ledger. Sort sections
  // by label; preserve original ordering inside each section.
  const groupedCategories = (() => {
    const map = new Map<string, any[]>();
    for (const service of filtered) {
      const key = getMergedDisplayCategoryKey(service.category);
      const bucket = map.get(key);
      if (bucket) bucket.push(service);
      else map.set(key, [service]);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({ key, items }))
      .sort((a, b) => serviceCategoryLabel(a.key).localeCompare(serviceCategoryLabel(b.key)));
  })();

  // Transfer-progress (old → new) — the active-move checklist progress, the
  // app's real "getting set up at the new place" signal.
  const transferPct = checklist ? Math.max(0, Math.min(100, checklist.progressPercent)) : null;

  // Header subtitle — address scope + count/total summary line.
  const headerSubtitle = `${selectedAddress ? `${selectedAddress.nickname || selectedAddress.city} · ` : ""}${t("services.summaryLine", { count: filtered.length, total: formatNumber(totalMonthly, i18n.language) })}`;

  const onAddService = () => {
    if (serviceLimitReached) {
      Alert.alert(
        t("services.limitReachedTitle", { defaultValue: "Service limit reached" }),
        serviceLimitBody(),
        serviceAtTopTierLimit
          ? [{ text: t("common.ok", { defaultValue: "OK" }) }]
          : [
              { text: t("common.cancel", { defaultValue: "Cancel" }), style: "cancel" },
              { text: t("subscription.upgrade", { defaultValue: "Review access" }), onPress: () => router.push("/settings/subscription") },
            ],
      );
      return;
    }
    router.push(selectedAddressId ? { pathname: "/services/new", params: { addressId: selectedAddressId } } : "/services/new");
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
      {/* Header — serif title + add / search actions */}
      <View style={[styles.header, styles.inScrollHeader]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>{t("services.title")}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{headerSubtitle}</Text>
        </View>
        <View style={styles.headerActions}>
          <PressableScale
            style={[styles.addButton, addresses.length === 0 && { opacity: 0.5 }]}
            onPress={onAddService}
            disabled={addresses.length === 0}
            accessibilityLabel={t("services.newTitle")}
          >
            <Plus size={16} color={theme.colors.primary} />
          </PressableScale>
          <PressableScale
            style={[styles.searchButton, services.length === 0 && { opacity: 0.5 }]}
            onPress={() => setFilterCat(null)}
            disabled={services.length === 0}
            accessibilityLabel={t("common.all")}
          >
            <Search size={16} color={theme.colors.dim} />
          </PressableScale>
        </View>
      </View>

      {/* Three health stat tiles — active · priced · needs attention */}
      {services.length > 0 && (
        <View style={styles.healthGrid}>
          <View style={styles.healthTile}>
            <View style={[styles.healthBar, { backgroundColor: theme.colors.green }]} />
            <Text style={[styles.healthValue, { color: theme.colors.green }]}>{activeServiceCount}</Text>
            <Text style={styles.healthLabel}>{t("services.statusActive")}</Text>
          </View>
          <View style={styles.healthTile}>
            <View style={[styles.healthBar, { backgroundColor: theme.colors.primary }]} />
            <Text style={[styles.healthValue, { color: theme.colors.primary }]}>{pricedServiceCount}</Text>
            <Text style={styles.healthLabel}>{t("services.priced", { defaultValue: "Priced" })}</Text>
          </View>
          <View style={styles.healthTile}>
            <View style={[styles.healthBar, { backgroundColor: serviceHealthTone.text }]} />
            <Text style={[styles.healthValue, { color: serviceHealthTone.text }]}>{serviceHealthIssueCount}</Text>
            <Text style={styles.healthLabel}>{t("services.needsAttention")}</Text>
          </View>
        </View>
      )}

      {/* Transfer progress (old → new) — active-move setup completion */}
      {transferPct != null && (
        <View style={styles.transferCard}>
          <View style={styles.transferRow}>
            <Home size={18} color={theme.colors.green} />
            <MoveProgressBar value={transferPct / 100} height={6} style={{ flex: 1 }} />
            <Building2 size={18} color={theme.colors.primary} />
          </View>
          <View style={styles.transferMeta}>
            <Text style={styles.transferText} numberOfLines={1}>
              {(() => {
                const phase = RELOCATION_PHASES.find((p) => p.phase === checklist?.currentPhase);
                return phase?.label || t("moving.checklist");
              })()}
            </Text>
            <Text style={styles.transferPct}>{transferPct}%</Text>
          </View>
        </View>
      )}

      {/* Monthly cost (old → new) — recurring spend after move */}
      {services.length > 0 && (
        <View style={styles.costCard}>
          <View style={styles.costRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.costKicker}>{t("services.monthlyServices").toUpperCase()}</Text>
              <View style={styles.costFigures}>
                <Text style={styles.costNew} numberOfLines={1}>{formatCurrency(heroMonthly, i18n.language)}</Text>
                <Text style={styles.costNewSuffix}>{t("services.heroMonthlySuffix", { count: activeServiceCount })}</Text>
              </View>
            </View>
            <View style={styles.costBadge}>
              <Text style={styles.costBadgeText}>{t("services.trackedCount", { count: services.length })}</Text>
            </View>
          </View>
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
          <Text style={styles.costHint}>
            {uncostedCount > 0 ? t("services.missingCostHint", { count: uncostedCount }) : t("services.summaryHint")}
          </Text>
        </View>
      )}

      {(addresses.length > 0 || categories.length > 1) && (
        <View style={styles.filterPanel}>
          {addresses.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              bounces={false}
              decelerationRate="fast"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={styles.addressRow}
              contentContainerStyle={[styles.addressContent, styles.inScrollChipContent]}
            >
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              bounces={false}
              decelerationRate="fast"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={styles.filterRow}
              contentContainerStyle={[styles.filterContent, styles.inScrollChipContent]}
            >
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
        </View>
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
                {serviceHealthIssueCount > 0 ? (
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
                  {providerGapCount > 0
                    ? t("services.healthProviderGaps", {
                        count: providerGapCount,
                        categories: providerGapLabels.join(", "),
                        defaultValue: `Missing essentials: ${providerGapLabels.join(", ")}`,
                      })
                    : attentionItems.length > 0
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
                <Text style={styles.systemStatValue}>{serviceHealthIssueCount}</Text>
                <Text style={styles.systemStatLabel}>
                  {t("services.needsAttention")}
                </Text>
              </View>
            </View>
          </View>
        )}

        {!(error && services.length === 0) && providerGapCount > 0 && (
          <View style={styles.gapPanel}>
            <View style={styles.gapHead}>
              <View style={styles.gapGlyph}>
                <Sparkles size={17} color={theme.colors.amber.text} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.gapTitle}>
                  {t("services.providerGapsTitle", { defaultValue: "Missing essentials" })}
                </Text>
                <Text style={styles.gapBody} numberOfLines={2}>
                  {recommendationGuide?.summary ||
                    t("services.providerGapsBody", {
                      defaultValue: "Your address still needs a few critical providers before the setup feels complete.",
                    })}
                </Text>
              </View>
              <View style={styles.gapCountPill}>
                <Text style={styles.gapCountText}>{providerGapCount}</Text>
              </View>
            </View>

            <View style={styles.gapChips}>
              {providerGapLabels.map((label) => (
                <View key={label} style={styles.gapChip}>
                  <Text style={styles.gapChipText} numberOfLines={1}>{label}</Text>
                </View>
              ))}
            </View>

            {providerGapItems.length > 0 ? (
              <View style={styles.gapRows}>
                {providerGapItems.map((provider) => {
                  const color = getServiceCategoryColor(provider.category);
                  const reason = provider.explanation?.reason || provider.explanation?.profileMatch || provider.matchReasons?.[0] || serviceCategoryLabel(provider.category);
                  return (
                    <PressableScale
                      key={provider.id}
                      style={styles.gapRow}
                      onPress={() => openProviderGap(provider)}
                      accessibilityLabel={`${provider.name} ${serviceCategoryLabel(provider.category)}`}
                    >
                      <View style={[styles.gapRowIcon, { backgroundColor: color + "1F", borderColor: color + "55" }]}>
                        <CategoryIcon emoji={getServiceCategoryIcon(provider.category)} size={15} color={color} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.gapRowTitle} numberOfLines={1}>{provider.name}</Text>
                        <Text style={styles.gapRowSub} numberOfLines={1}>{reason}</Text>
                      </View>
                      <ArrowRight size={14} color={theme.colors.textMuted} />
                    </PressableScale>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.gapFallbackText}>
                {t("services.providerGapsFallback", {
                  defaultValue: "Open recommendations to add the right provider for these categories.",
                })}
              </Text>
            )}

            <PressableScale style={styles.gapCta} onPress={() => openProviderGap()}>
              <Text style={styles.gapCtaText}>
                {providerGapItems.length > 1
                  ? t("services.providerGapsCtaBundle", { defaultValue: "Add recommended picks" })
                  : t("services.providerGapsCta", { defaultValue: "Fix setup gaps" })}
              </Text>
              <ArrowRight size={15} color={theme.colors.amber.text} />
            </PressableScale>
          </View>
        )}

        {/* Phase-Aware Checklist Widget */}
        {checklist && (() => {
          const phase = RELOCATION_PHASES.find((p) => p.phase === checklist.currentPhase);
          const currentItems = checklist.phases.find((p) => p.phase === checklist.currentPhase);
          const pending = currentItems?.items.filter((i) => !i.isCompleted).slice(0, 3) || [];
          return (
            <View style={{ marginBottom: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.accentBorder, backgroundColor: theme.colors.accentSoft, padding: 14 }}>
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
                  <Text style={{ fontSize: 13, fontWeight: "600", color: theme.colors.onAccent }}>{t("services.addNext")}</Text>
                  <ArrowRight size={14} color={theme.colors.onAccent} />
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        {/* This week · act now — services with an imminent/overdue renewal */}
        {attentionItems.length > 0 && (
          <View style={styles.attnList}>
            <SectionHeader
              label={`⚠  ${t("services.actNow", { defaultValue: "This week · act now" })}`}
              style={styles.attnHeader}
            />
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
                  <View style={styles.attnAccent} />
                  <View style={styles.attnIcon}>
                    <AlertTriangle size={15} color={theme.colors.error} />
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
            {groupedCategories.map((group, groupIndex) => {
              const groupColor = getServiceCategoryColor(group.key);
              return (
                <View key={group.key} style={styles.catSection}>
                  <View style={styles.catHead}>
                    <CategoryIcon emoji={getServiceCategoryIcon(group.key)} size={15} color={groupColor} />
                    <Text style={styles.catName} numberOfLines={1}>{serviceCategoryLabel(group.key)}</Text>
                    <Text style={styles.catCount}>{t("services.trackedCount", { count: group.items.length })}</Text>
                  </View>
                  <View style={styles.catRows}>
                    {group.items.map((service: any, index: number) => {
                      const accent = getServiceCategoryColor(service.category);
                      return (
                      <ListEntrance key={service.id} index={groupIndex * 4 + index}>
                      <Card variant="default" onPress={() => editingCost !== service.id && router.push({ pathname: "/services/[id]", params: { id: service.id } })}>
                        <View style={[styles.rowAccent, { backgroundColor: accent }]} />
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
                              <View style={styles.addCostPill}>
                                <DollarSign size={10} color={theme.colors.amberSolid} />
                                <Text style={styles.addCostText}>{t("services.addCost")}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>

                        {/* Inline cost editor */}
                        {editingCost === service.id && (
                          <View style={styles.costEditor}>
                            <DollarSign size={14} color={theme.colors.textMuted} />
                            <TextInput
                              style={styles.costInput}
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
                              style={styles.costSave}
                              accessibilityRole="button"
                              accessibilityLabel={t("services.saveCost", { defaultValue: "Save monthly cost" })}
                            >
                              <Check size={14} color={theme.colors.onAccent} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => { setEditingCost(null); setCostValue(""); }}
                              style={styles.costCancel}
                              accessibilityRole="button"
                              accessibilityLabel={t("services.cancelCost", { defaultValue: "Cancel cost editing" })}
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
                </View>
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
  // ── Header (serif title + add / search) ──
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  inScrollHeader: { paddingHorizontal: 0 },
  title: { fontSize: 26, fontFamily: fonts.serifBold, color: theme.colors.text, lineHeight: 30 },
  subtitle: { fontSize: 11, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 3 },
  headerActions: { flexDirection: "row", gap: 8 },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  searchButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Three health stat tiles ──
  healthGrid: { flexDirection: "row", gap: 10, marginBottom: 12 },
  healthTile: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  healthBar: { position: "absolute", top: 0, left: 0, right: 0, height: 2, opacity: 0.5 },
  healthValue: { fontSize: 22, fontFamily: fonts.monoMedium, lineHeight: 24 },
  healthLabel: { fontSize: 10, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 5, textAlign: "center" },
  // ── Transfer progress (old → new) ──
  transferCard: {
    marginBottom: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  transferRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  transferMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  transferText: { flex: 1, fontSize: 10.5, fontFamily: fonts.sans, color: theme.colors.dim },
  transferPct: { fontSize: 11, fontFamily: fonts.monoMedium, color: theme.colors.primary },
  // ── Monthly cost (old → new) ──
  costCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  costRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  costKicker: { fontSize: 9, fontFamily: fonts.sansBold, letterSpacing: 1.4, textTransform: "uppercase", color: theme.colors.faint },
  costFigures: { flexDirection: "row", alignItems: "baseline", gap: 7, marginTop: 5 },
  costNew: { fontSize: 20, fontFamily: fonts.monoMedium, color: theme.colors.text },
  costNewSuffix: { fontSize: 11, fontFamily: fonts.sans, color: theme.colors.faint },
  costBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  costBadgeText: { fontSize: 9.5, fontFamily: fonts.sansBold, color: theme.colors.primary },
  costHint: { fontSize: 10, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 8, lineHeight: 15 },
  heroBar: { flexDirection: "row", gap: 3, height: 8, marginTop: 14, marginBottom: 12 },
  heroBarSeg: { borderRadius: 4 },
  heroChips: { flexDirection: "row", gap: 8 },
  heroChipWrap: { flex: 1 },
  heroChip: { alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 13, borderWidth: 1 },
  heroChipSwatch: { width: 18, height: 18, borderRadius: 6 },
  heroChipName: { fontSize: 8, fontFamily: fonts.sansBold, letterSpacing: 0.8, color: theme.colors.dim },
  heroChipValue: { fontSize: 14, fontFamily: fonts.monoMedium, color: theme.colors.text },
  // ── Operational health panel (restyled — surface card) ──
  systemPanel: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  systemTitle: { fontSize: 14, fontFamily: fonts.sansBold, color: theme.colors.text },
  systemMeta: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 2, lineHeight: 17 },
  systemScore: { fontSize: 22, fontFamily: fonts.monoMedium },
  systemMeter: {
    height: 6,
    marginTop: 13,
    borderRadius: 999,
    backgroundColor: theme.colors.track,
    overflow: "hidden",
  },
  systemMeterFill: { height: "100%", borderRadius: 999 },
  systemGrid: { flexDirection: "row", gap: 8, marginTop: 12 },
  systemStat: {
    flex: 1,
    minHeight: 58,
    padding: 10,
    borderRadius: 13,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  systemStatValue: { fontSize: 18, fontFamily: fonts.monoMedium, color: theme.colors.text },
  systemStatLabel: { fontSize: 10, fontFamily: fonts.sansBold, color: theme.colors.faint, marginTop: 3 },
  gapPanel: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberLine,
    gap: 12,
  },
  gapHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  gapGlyph: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.amber.bg,
    borderWidth: 1,
    borderColor: theme.colors.amber.border,
  },
  gapTitle: { fontSize: 14, fontFamily: fonts.sansBold, color: theme.colors.text },
  gapBody: { marginTop: 2, fontSize: 12, fontFamily: fonts.sans, lineHeight: 17, color: theme.colors.dim },
  gapCountPill: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 9,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.amber.border,
  },
  gapCountText: { fontSize: 13, fontFamily: fonts.monoMedium, color: theme.colors.amber.text },
  gapChips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  gapChip: {
    maxWidth: "48%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  gapChipText: { fontSize: 11, fontFamily: fonts.sansSemibold, color: theme.colors.dim },
  gapRows: { gap: 8 },
  gapRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  gapRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  gapRowTitle: { fontSize: 13, fontFamily: fonts.sansBold, color: theme.colors.text },
  gapRowSub: { marginTop: 1, fontSize: 11, fontFamily: fonts.sans, color: theme.colors.faint },
  gapFallbackText: { fontSize: 12, fontFamily: fonts.sans, lineHeight: 17, color: theme.colors.dim },
  gapCta: {
    minHeight: 42,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: theme.colors.amber.bg,
    borderWidth: 1,
    borderColor: theme.colors.amber.border,
  },
  gapCtaText: { fontSize: 13, fontFamily: fonts.sansBold, color: theme.colors.amber.text },
  // ── This week · act now ──
  attnList: { gap: 9, marginBottom: 16 },
  attnHeader: { marginBottom: 2, paddingHorizontal: 2 },
  attnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    paddingLeft: 14,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.redLine,
  },
  attnAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: theme.colors.red },
  attnIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.redSoft,
  },
  attnTitle: { fontSize: 12, fontFamily: fonts.sansSemibold, color: theme.colors.text },
  attnSub: { fontSize: 10.5, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 1 },
  attnGo: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.red + "4D",
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
  statusPillText: { fontSize: 8, fontFamily: fonts.sansBold, letterSpacing: 1 },
  // ── Location / category toggle ──
  filterPanel: {
    marginBottom: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  addressRow: { marginHorizontal: 0, marginBottom: 4 },
  addressContent: { paddingHorizontal: 8, paddingVertical: 3, gap: 8, alignItems: "center" },
  inScrollChipContent: { paddingHorizontal: 8 },
  addressChip: {
    minWidth: 74,
    maxWidth: 180,
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  addressChipActive: { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accentBorder },
  addressChipText: { fontSize: 12, fontFamily: fonts.sansBold, color: theme.colors.dim, textAlign: "center" },
  addressChipTextActive: { color: theme.colors.primary },
  filterRow: { marginHorizontal: 0 },
  filterContent: { paddingHorizontal: 8, paddingVertical: 3, gap: 8, alignItems: "center" },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 38,
    minWidth: 68,
    maxWidth: 176,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accentBorder },
  filterText: { flexShrink: 1, fontSize: 12, fontFamily: fonts.sansBold, color: theme.colors.dim },
  filterTextActive: { color: theme.colors.primary },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 140, paddingTop: 8 },
  list: { gap: 4 },
  // ── Category sections ──
  catSection: { marginBottom: 16 },
  catHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 11, paddingHorizontal: 2 },
  catName: { fontSize: 13, fontFamily: fonts.sansSemibold, color: theme.colors.text },
  catCount: { fontSize: 11, fontFamily: fonts.sans, color: theme.colors.faint },
  catRows: { gap: 9 },
  // ── Service row ──
  rowAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 },
  serviceTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  serviceName: { fontSize: 13, fontFamily: fonts.sansBold, color: theme.colors.text },
  serviceCategory: { fontSize: 11, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 2 },
  cost: { fontSize: 15, fontFamily: fonts.monoMedium, color: theme.colors.green },
  costPer: { fontSize: 10, fontFamily: fonts.sans, color: theme.colors.faint },
  addCostPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: theme.colors.amberSoft,
    borderWidth: 1,
    borderColor: theme.colors.amberLine,
  },
  addCostText: { fontSize: 10, fontFamily: fonts.sansSemibold, color: theme.colors.amberSolid },
  costEditor: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  costInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.sans,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  costSave: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  costCancel: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  serviceDetails: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "48%" },
  detailText: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, flexShrink: 1 },
  serviceFooter: { flexDirection: "row", gap: 6, marginTop: 10 },
});
