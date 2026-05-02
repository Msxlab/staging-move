import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Image,
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
  MapPin,
  Wallet,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
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
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import {
  SERVICE_CATEGORIES,
  generateChecklist,
  RELOCATION_PHASES,
  type UserChecklistProfile,
  type RelocationChecklist,
  type ChecklistStateRuleContext,
} from "@locateflow/shared";

const catColors: Record<string, string> = {
  GOVERNMENT: "#C85A3E", UTILITY: "#f59e0b", FINANCIAL: "#10b981",
  HOUSING: "#0ea5e9", HEALTHCARE: "#f43f5e", TRANSPORTATION: "#3b82f6",
  // FITNESS used to be `#f97316` (legacy orange) which after the Edition VI
  // palette flip would collide with primary rose — re-tint to honey so the
  // FITNESS chip stays visually distinct from primary CTAs.
  KIDS: "#a855f7", FITNESS: "#E3B04B", SHOPPING: "#ec4899", OTHER: "#6b7280",
};

const serviceCategoryValues = new Set<string>(SERVICE_CATEGORIES.map((c) => c.value));
const serviceCategoryIcons: Record<string, string> = {
  GOVERNMENT: "🏛️",
  UTILITY: "⚡",
  FINANCIAL: "💳",
  HOUSING: "🏠",
  HEALTHCARE: "🏥",
  TRANSPORTATION: "🚗",
  KIDS: "👶",
  FITNESS: "💪",
  SHOPPING: "🛒",
  OTHER: "📋",
};

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
  return serviceCategoryIcons[category] || getMergedDisplayCategoryIcon(category) || getCategoryIcon(category);
}

export default function ServicesScreen() {
  const { t } = useTranslation();
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
  const [failedLogoUrls, setFailedLogoUrls] = useState<Record<string, boolean>>({});

  const requestedAddressId = Array.isArray(params.addressId) ? params.addressId[0] : params.addressId;

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
      api.get<any>("/api/services", selectedAddressId ? { addressId: selectedAddressId } : undefined),
      api.get<any>("/api/addresses"),
    ]);
    if (servicesRes.error || addressesRes.error) {
      setError(servicesRes.error || addressesRes.error || "Could not load services.");
      return false;
    }
    const svcs = servicesRes.data?.services || [];
    const nextAddresses = addressesRes.data?.addresses || [];
    setServices(svcs);
    setAddresses(nextAddresses);
    setError(null);

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
        const cats = new Set<string>(svcs.map((s: any) => s.category as string));
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
        setChecklist(generateChecklist(cp, new Date(activePlan.moveDate), activePlan.fromAddress?.state || "", toState, cats, tmpls, stateRule));
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

  if (loading) return <LoadingScreen />;

  const filtered = filterCat ? services.filter((s) => getMergedDisplayCategoryKey(s.category) === filterCat) : services;
  const totalMonthly = filtered.reduce((sum, s) => sum + (s.monthlyCost || 0), 0);
  const selectedAddress = selectedAddressId ? addresses.find((address) => address.id === selectedAddressId) : null;
  const categories = [...new Set(services.map((s) => getMergedDisplayCategoryKey(s.category)))].sort((a, b) => serviceCategoryLabel(a).localeCompare(serviceCategoryLabel(b)));
  const uncostedCount = filtered.filter((service) => !service.monthlyCost || service.monthlyCost <= 0).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t("services.title")}</Text>
          <Text style={styles.subtitle}>
            {selectedAddress ? `${selectedAddress.nickname || selectedAddress.city} · ` : ""}
            {t("services.summaryLine", { count: filtered.length, total: totalMonthly.toLocaleString() })}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, addresses.length === 0 && { opacity: 0.5 }]}
          onPress={() => router.push(selectedAddressId ? { pathname: "/services/new", params: { addressId: selectedAddressId } } : "/services/new")}
          disabled={addresses.length === 0}
          activeOpacity={0.7}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <MapPin size={15} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>{t("services.viewingAddress")}</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {selectedAddress ? (selectedAddress.nickname || `${selectedAddress.city}, ${selectedAddress.state}`) : t("common.all")}
              </Text>
            </View>
          </View>
          <View style={styles.summaryItem}>
            <Wallet size={15} color={theme.colors.emerald.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>{t("services.budgetTracked")}</Text>
              <Text style={styles.summaryValue}>{t("services.monthlyAmount", { amount: totalMonthly.toLocaleString() })}</Text>
            </View>
          </View>
        </View>
        {uncostedCount > 0 ? (
          <Text style={styles.summaryHint}>
            {t("services.missingCostHint", { count: uncostedCount })}
          </Text>
        ) : (
          <Text style={styles.summaryHint}>
            {t("services.summaryHint")}
          </Text>
        )}
      </View>

      {addresses.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.addressRow} contentContainerStyle={styles.addressContent}>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
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
              <View style={[styles.filterDot, { backgroundColor: getServiceCategoryColor(cat) }]} />
              <Text style={[styles.filterText, filterCat === cat && styles.filterTextActive]} numberOfLines={1} ellipsizeMode="tail">
                {getServiceCategoryIcon(cat)} {serviceCategoryLabel(cat)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Phase-Aware Checklist Widget */}
        {checklist && (() => {
          const phase = RELOCATION_PHASES.find((p) => p.phase === checklist.currentPhase);
          const currentItems = checklist.phases.find((p) => p.phase === checklist.currentPhase);
          const pending = currentItems?.items.filter((i) => !i.isCompleted).slice(0, 3) || [];
          return (
            <View style={{ marginBottom: 16, borderRadius: 16, borderWidth: 1, borderColor: "rgba(212, 132, 106,0.2)", backgroundColor: "rgba(212, 132, 106,0.04)", padding: 14 }}>
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, padding: 8, borderRadius: 8, backgroundColor: "rgba(239,68,68,0.08)" }}>
                  <AlertTriangle size={12} color="#C85A3E" />
                  <Text style={{ fontSize: 11, color: "#E08A6E", flex: 1 }} numberOfLines={1}>
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
                      <Text style={{ fontSize: 10, color: "#E5C9A8" }} numberOfLines={2}>{item.stateNote}</Text>
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

        {error && services.length === 0 ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Zap size={32} color={theme.colors.primary} />}
            title={filterCat ? t("services.emptyCategory") : t("services.empty")}
            description={t("services.emptyDescription")}
            actionLabel={t("services.newTitle")}
            onAction={() => router.push("/services/new")}
          />
        ) : (
          <View style={styles.list}>
            {filtered.map((service: any) => {
              const logoUrl = service.provider?.logoUrl || service.providerLogoUrl || service.logoUrl || null;
              const showLogo = Boolean(logoUrl && !failedLogoUrls[logoUrl]);
              return (
              <Card key={service.id} variant="default" onPress={() => editingCost !== service.id && router.push({ pathname: "/services/[id]", params: { id: service.id } })}>
                <View style={styles.serviceTop}>
                  <View style={[styles.catDot, { backgroundColor: getServiceCategoryColor(service.category) + "30", borderColor: getServiceCategoryColor(service.category) + "50" }]}>
                    {showLogo ? (
                      <Image
                        source={{ uri: logoUrl }}
                        style={styles.serviceLogo}
                        resizeMode="contain"
                        accessibilityLabel={t("services.providerLogoA11y", { provider: service.provider?.name || service.providerName })}
                        onError={() => setFailedLogoUrls((prev) => ({ ...prev, [logoUrl]: true }))}
                      />
                    ) : (
                      <Text style={styles.catIcon}>{getServiceCategoryIcon(service.category)}</Text>
                    )}
                  </View>
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
                      <Text style={styles.cost}>${service.monthlyCost.toLocaleString()}<Text style={styles.costPer}>/mo</Text></Text>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(245,158,11,0.1)", borderWidth: 1, borderColor: "rgba(245,158,11,0.25)" }}>
                        <DollarSign size={10} color="#E5C9A8" />
                        <Text style={{ fontSize: 10, fontWeight: "600", color: "#E5C9A8" }}>{t("services.addCost")}</Text>
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
                  <UiBadge label={service.isActive ? t("services.statusActive") : t("services.statusInactive")} variant={service.isActive ? "success" : "neutral"} />
                  {service.billingCycle && (
                    <UiBadge label={serviceBillingCycleLabel(service.billingCycle)} variant="info" />
                  )}
                </View>
              </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 28, fontWeight: "800", color: theme.colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", ...theme.shadow.glow },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryRow: { flexDirection: "row", gap: 10 },
  summaryItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
  },
  summaryLabel: { fontSize: 11, color: theme.colors.textMuted, marginBottom: 2 },
  summaryValue: { fontSize: 13, fontWeight: "700", color: theme.colors.text },
  summaryHint: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 12, lineHeight: 18 },
  addressRow: { marginBottom: 10 },
  addressContent: { paddingHorizontal: 20, paddingVertical: 2, gap: 8, alignItems: "center" },
  addressChip: {
    minWidth: 92,
    maxWidth: 180,
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  addressChipActive: { backgroundColor: theme.colors.primaryFaded, borderColor: "rgba(212, 132, 106,0.32)" },
  addressChipText: { fontSize: 13, fontWeight: "700", color: theme.colors.textSecondary, textAlign: "center" },
  addressChipTextActive: { color: theme.colors.orange.text },
  filterRow: { marginBottom: 10 },
  filterContent: { paddingHorizontal: 20, paddingVertical: 2, gap: 8, alignItems: "center" },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 38,
    minWidth: 74,
    maxWidth: 168,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: { backgroundColor: theme.colors.primaryFaded, borderColor: "rgba(212, 132, 106,0.3)" },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterText: { flexShrink: 1, fontSize: 13, color: theme.colors.textSecondary, fontWeight: "700" },
  filterTextActive: { color: theme.colors.orange.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 140, paddingTop: 8 },
  list: { gap: 12 },
  serviceTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  catDot: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  serviceLogo: { width: 32, height: 32, borderRadius: 8 },
  catIcon: { fontSize: 16 },
  serviceName: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  serviceCategory: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  cost: { fontSize: 16, fontWeight: "800", color: theme.colors.emerald.text },
  costPer: { fontSize: 11, fontWeight: "500", color: theme.colors.textTertiary },
  serviceDetails: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "48%" },
  detailText: { fontSize: 12, color: theme.colors.textTertiary, flexShrink: 1 },
  serviceFooter: { flexDirection: "row", gap: 6, marginTop: 10 },
});
