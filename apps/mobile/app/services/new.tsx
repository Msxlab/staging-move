import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
  Star,
  Sparkles,
  X,
  Plus,
  Home,
  Briefcase,
  Globe,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { api } from "@/lib/api";
import { hapticLight, hapticSuccess, hapticError } from "@/lib/haptics";
import {
  getRecommendedProviders,
  CATEGORY_META,
  getMergedDisplayCategoryIcon,
  getMergedDisplayCategoryLabel,
  getMergedDisplayCategoryOrder,
  groupByMergedDisplayCategory,
} from "@/lib/recommendation-engine";
import type { ScoredProvider } from "@/lib/recommendation-engine";

// Billing cycle option labels are resolved at render time via t() —
// see `billingCycles` below inside the component.
const BILLING_CYCLE_VALUES = ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"] as const;

const MANUAL_CATEGORY_PREFIXES = [
  "GOVERNMENT_",
  "UTILITY_",
  "FINANCIAL_",
  "HOUSING_",
  "HEALTHCARE_",
  "TRANSPORTATION_",
  "KIDS_",
  "FITNESS_",
  "SHOPPING_",
  "GROCERY_",
  "PET_",
  "LEGAL_",
] as const;

const MANUAL_CATEGORIES = Object.entries(CATEGORY_META)
  .filter(([value]) => MANUAL_CATEGORY_PREFIXES.some((prefix) => value.startsWith(prefix)))
  .map(([value, meta]) => ({ value, label: meta.label, icon: meta.icon, order: meta.order }))
  .sort((a, b) => a.order - b.order);

interface AddressOption {
  id: string;
  nickname?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  type: string;
  isPrimary: boolean;
  services?: { id: string }[];
}

export default function NewServiceScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const billingCycles = [
    { value: "MONTHLY", label: t("services.billingCycle_monthly") },
    { value: "QUARTERLY", label: t("services.billingCycle_quarterly") },
    { value: "YEARLY", label: t("services.billingCycle_yearly") },
    { value: "ONE_TIME", label: t("common.yes") },
  ];
  const params = useLocalSearchParams<{
    addressId?: string | string[];
    fromServiceId?: string | string[];
    providerId?: string | string[];
    category?: string | string[];
  }>();

  // Mode: "browse" = provider list, "manual" = manual form
  const [mode, setMode] = useState<"browse" | "manual">("browse");

  // Address state
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [selectedAddress, setSelectedAddress] = useState("");

  // Provider state
  const [allProviders, setAllProviders] = useState<ScoredProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [selectedProviders, setSelectedProviders] = useState<Map<string, ScoredProvider>>(new Map());

  const [saving, setSaving] = useState(false);

  const requestedAddressId = Array.isArray(params.addressId) ? params.addressId[0] : params.addressId;
  const fromServiceId = Array.isArray(params.fromServiceId) ? params.fromServiceId[0] : params.fromServiceId || "";
  const prefillProviderId = Array.isArray(params.providerId) ? params.providerId[0] : params.providerId || "";
  const prefillCategory = Array.isArray(params.category) ? params.category[0] : params.category || "";

  // Manual form state
  const [manualForm, setManualForm] = useState({
    category: prefillCategory || "",
    providerName: "",
    monthlyCost: "",
    phone: "",
    website: "",
    billingCycle: "MONTHLY",
    notes: "",
  });

  // Fetch addresses
  useEffect(() => {
    (async () => {
      const addrRes = await api.get<any>("/api/addresses");
      if (addrRes.data) {
        const addrs = addrRes.data.addresses || [];
        setAddresses(addrs);
        if (addrs.length > 0) {
          const requested = requestedAddressId ? addrs.find((a: AddressOption) => a.id === requestedAddressId) : null;
          const primary = addrs.find((a: AddressOption) => a.isPrimary);
          setSelectedAddress(requested?.id || (primary ? primary.id : addrs[0].id));
        }
      }
    })();
  }, [requestedAddressId]);

  // Fetch providers when address changes
  useEffect(() => {
    const addr = addresses.find((a) => a.id === selectedAddress);
    if (!addr) { setAllProviders([]); return; }
    setLoadingProviders(true);
    (async () => {
      const params: Record<string, string> = {};
      params.addressId = addr.id;
      const res = await api.get<any>("/api/providers/recommendations", params);
      setAllProviders(res.data?.allProviders || []);
      setLoadingProviders(false);
    })();
  }, [selectedAddress, addresses]);

  // Auto-select provider from pre-fill params (migration flow)
  useEffect(() => {
    if (!prefillProviderId || allProviders.length === 0) return;
    const match = allProviders.find((p) => p.id === prefillProviderId);
    if (match && !selectedProviders.has(match.id)) {
      setSelectedProviders((prev) => {
        const next = new Map(prev);
        next.set(match.id, match);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillProviderId, allProviders]);

  const addr = addresses.find((a) => a.id === selectedAddress);

  const recommended = getRecommendedProviders(allProviders, 10);

  const filteredProviders = allProviders.filter((p: ScoredProvider) => {
    if (providerSearch) {
      const q = providerSearch.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q) && !(p.description || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const groupedProviders = groupByMergedDisplayCategory(filteredProviders);
  const sortedCategories = Object.keys(groupedProviders).sort(
    (a, b) => getMergedDisplayCategoryOrder(a) - getMergedDisplayCategoryOrder(b)
  );

  const toggleProvider = useCallback((provider: ScoredProvider) => {
    hapticLight();
    setSelectedProviders((prev) => {
      const next = new Map(prev);
      if (next.has(provider.id)) next.delete(provider.id);
      else next.set(provider.id, provider);
      return next;
    });
  }, []);

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // Save all selected providers as services (batch)
  const handleSaveAll = async () => {
    if (!selectedAddress) { Alert.alert(t("common.retry"), t("validation.required")); return; }
    if (selectedProviders.size === 0) { Alert.alert(t("common.retry"), t("validation.required")); return; }
    setSaving(true);
    let success = 0;
    let failed = 0;
    for (const [, p] of selectedProviders) {
      const payload: any = {
        addressId: selectedAddress,
        providerId: p.id,
        category: p.category || "OTHER",
        providerName: p.name,
        website: p.website || "",
        phone: p.phone || "",
      };
      if (fromServiceId) {
        payload.previousServiceId = fromServiceId;
        payload.migrationAction = "NEW";
      }
      const res = await api.post("/api/services", payload);
      if (res.error) failed++; else success++;
    }
    if (success > 0 && fromServiceId) {
      try {
        await api.patch(`/api/services/${fromServiceId}`, { migrationAction: "SWITCH" });
      } catch {}
    }
    setSaving(false);
    if (success > 0) {
      hapticSuccess();
      Alert.alert(t("common.done"), `${success} ${t("services.title").toLowerCase()}`);
      router.back();
    }
    if (failed > 0) {
      hapticError();
      Alert.alert(t("common.retry"), `${failed} ${t("services.title").toLowerCase()}`);
    }
  };

  // Save manual form
  const handleSaveManual = async () => {
    if (!selectedAddress || !manualForm.category || !manualForm.providerName) {
      Alert.alert(t("common.retry"), t("validation.required"));
      return;
    }
    setSaving(true);
    const providerRes = await api.post<any>("/api/custom-providers", {
      name: manualForm.providerName,
      category: manualForm.category,
      website: manualForm.website,
      phone: manualForm.phone,
      notes: manualForm.notes,
      providerType: "OTHER",
    });
    if (providerRes.error || !providerRes.data?.provider?.id) {
      setSaving(false);
      hapticError();
      Alert.alert(t("common.retry"), providerRes.error || "Failed to add custom provider");
      return;
    }

    const payload: any = {
      addressId: selectedAddress,
      customProviderId: providerRes.data.provider.id,
      category: manualForm.category,
      providerName: manualForm.providerName,
      billingCycle: manualForm.billingCycle,
      isActive: true,
      notes: manualForm.notes || "User-added provider. Manual tracking only.",
    };
    if (manualForm.monthlyCost) payload.monthlyCost = parseFloat(manualForm.monthlyCost) || 0;
    if (manualForm.phone) payload.phone = manualForm.phone;
    if (manualForm.website) payload.website = manualForm.website;
    if (fromServiceId) {
      payload.previousServiceId = fromServiceId;
      payload.migrationAction = "NEW";
    }

    const res = await api.post("/api/services", payload);
    if (!res.error && fromServiceId) {
      try {
        await api.patch(`/api/services/${fromServiceId}`, { migrationAction: "SWITCH" });
      } catch {}
    }
    setSaving(false);
    if (res.error) {
      hapticError();
      Alert.alert(t("common.retry"), res.error);
    } else {
      hapticSuccess();
      router.back();
    }
  };

  const updateManual = (field: string, value: string) =>
    setManualForm((prev) => ({ ...prev, [field]: value }));

  const selectedCount = selectedProviders.size;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
        >
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{mode === "browse" ? "Add Services" : "Manual Add"}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "browse" && styles.modeBtnActive]}
          onPress={() => setMode("browse")}
          accessibilityRole="button"
          accessibilityLabel="Browse providers"
          accessibilityHint="Shows recommended providers and provider categories"
          accessibilityState={{ selected: mode === "browse" }}
        >
          <Search size={14} color={mode === "browse" ? "#fff" : theme.colors.textTertiary} />
          <Text style={[styles.modeBtnText, mode === "browse" && styles.modeBtnTextActive]}>Browse Providers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "manual" && styles.modeBtnActive]}
          onPress={() => setMode("manual")}
          accessibilityRole="button"
          accessibilityLabel="Manual add"
          accessibilityHint="Lets you add a provider manually"
          accessibilityState={{ selected: mode === "manual" }}
        >
          <Plus size={14} color={mode === "manual" ? "#fff" : theme.colors.textTertiary} />
          <Text style={[styles.modeBtnText, mode === "manual" && styles.modeBtnTextActive]}>Manual Add</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, selectedCount > 0 && mode === "browse" && { paddingBottom: 160 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Address Selector (shared) ── */}
        <Text style={styles.sectionLabel}>Select Address</Text>
        {addresses.length === 0 ? (
          <Text style={styles.hint}>No addresses found. Add an address first.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={styles.chipRow}>
              {addresses.map((a) => {
                const isActive = selectedAddress === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.addrChip, isActive && styles.addrChipActive]}
                    onPress={() => setSelectedAddress(a.id)}
                  >
                    {a.isPrimary && <Star size={12} color={isActive ? "#fff" : theme.colors.amber.text} />}
                    <Text style={[styles.addrChipText, isActive && styles.addrChipTextActive]}>
                      {a.nickname || `${a.city}, ${a.state}`}
                    </Text>
                    {isActive && <Check size={14} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* ═══════════════════════ BROWSE MODE ═══════════════════════ */}
        {mode === "browse" && selectedAddress && (
          <View style={{ marginTop: 8 }}>
            {/* State label */}
            <Text style={styles.stateLabel}>
              Showing providers for <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>{addr?.state || "all states"}</Text>
            </Text>

            {/* Selected chips */}
            {selectedCount > 0 && (
              <View style={styles.selectedChipRow}>
                {Array.from(selectedProviders.values()).map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.selectedChip}
                    onPress={() => toggleProvider(p)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${p.name}`}
                    accessibilityHint="Removes this provider from the selected list"
                  >
                    <Text style={styles.selectedChipText}>{p.name}</Text>
                    <X size={12} color="#fff" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Search */}
            <View style={styles.searchBox}>
              <Search size={16} color={theme.colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={t("providers.searchPlaceholder")}
                placeholderTextColor={theme.colors.textMuted}
                value={providerSearch}
                onChangeText={setProviderSearch}
                accessibilityLabel="Search available providers"
                accessibilityHint="Filters providers for the selected address"
              />
              {providerSearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => setProviderSearch("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear provider search"
                  accessibilityHint="Clears the current provider search text"
                >
                  <X size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Recommended Section */}
            {!loadingProviders && !providerSearch && recommended.length > 0 && (
              <View style={styles.recoSection}>
                <View style={styles.recoHeader}>
                  <Sparkles size={16} color={theme.colors.amber.text} />
                  <Text style={styles.recoTitle}>Recommended for You</Text>
                </View>
                <View style={styles.recoGrid}>
                  {recommended.map((provider: ScoredProvider) => {
                    const isSelected = selectedProviders.has(provider.id);
                    return (
                      <TouchableOpacity
                        key={`rec-${provider.id}`}
                        style={[styles.recoCard, isSelected && styles.recoCardActive]}
                        onPress={() => toggleProvider(provider)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${isSelected ? "Selected" : "Select"} provider ${provider.name}`}
                        accessibilityHint={provider.matchReasons?.[0] || getMergedDisplayCategoryLabel(provider.category)}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <View style={styles.recoCardTop}>
                          <View style={[styles.providerAvatar, isSelected && styles.providerAvatarActive]}>
                            <Text style={styles.providerAvatarText}>{provider.name.charAt(0)}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.recoName} numberOfLines={1}>{provider.name}</Text>
                            <Text style={styles.recoReason} numberOfLines={1}>
                              {provider.matchReasons?.[0] || getMergedDisplayCategoryLabel(provider.category)}
                            </Text>
                          </View>
                          {isSelected && <Check size={16} color={theme.colors.primary} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Provider categories accordion */}
            {loadingProviders ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading providers...</Text>
              </View>
            ) : sortedCategories.length === 0 ? (
              <Text style={styles.emptyText}>No providers found.</Text>
            ) : (
              <View style={{ marginTop: 12 }}>
                {sortedCategories.map((cat) => {
                  const items = groupedProviders[cat];
                  const isOpen = expandedCats.has(cat);
                  const selectedInCat = items.filter((p) => selectedProviders.has(p.id)).length;
                  return (
                    <View key={cat} style={styles.catSection}>
                      <TouchableOpacity
                        style={styles.catHeader}
                        onPress={() => toggleCat(cat)}
                        accessibilityRole="button"
                        accessibilityLabel={`${isOpen ? "Collapse" : "Expand"} ${getMergedDisplayCategoryLabel(cat)}`}
                        accessibilityHint={`Shows ${items.length} providers in this category`}
                        accessibilityState={{ expanded: isOpen }}
                      >
                        <Text style={styles.catIcon}>{getMergedDisplayCategoryIcon(cat)}</Text>
                        <Text style={styles.catTitle} numberOfLines={1}>{getMergedDisplayCategoryLabel(cat)}</Text>
                        <Text style={styles.catCount}>{items.length}</Text>
                        {selectedInCat > 0 && (
                          <View style={styles.catBadge}>
                            <Text style={styles.catBadgeText}>{selectedInCat}</Text>
                          </View>
                        )}
                        {isOpen ? <ChevronUp size={16} color={theme.colors.textMuted} /> : <ChevronDown size={16} color={theme.colors.textMuted} />}
                      </TouchableOpacity>
                      {isOpen && items.map((provider) => {
                        const sel = selectedProviders.has(provider.id);
                        return (
                          <TouchableOpacity
                            key={provider.id}
                            style={[styles.providerItem, sel && styles.providerItemActive]}
                            onPress={() => toggleProvider(provider)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={`${sel ? "Selected" : "Select"} provider ${provider.name}`}
                            accessibilityHint={provider.description || getMergedDisplayCategoryLabel(provider.category)}
                            accessibilityState={{ selected: sel }}
                          >
                            <View style={[styles.providerAvatar, sel && styles.providerAvatarActive]}>
                              <Text style={styles.providerAvatarText}>{provider.name.charAt(0)}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.providerName} numberOfLines={1}>{provider.name}</Text>
                              {provider.description ? (
                                <Text style={styles.providerDesc} numberOfLines={1}>{provider.description}</Text>
                              ) : null}
                              <View style={styles.providerMeta}>
                                <View style={[styles.scopeBadge, provider.scope === "FEDERAL" ? styles.scopeFederal : styles.scopeState]}>
                                  <Text style={[styles.scopeText, provider.scope === "FEDERAL" ? styles.scopeFederalText : styles.scopeStateText]}>
                                    {provider.scope === "FEDERAL" ? "Federal" : (provider.states || []).join(", ")}
                                  </Text>
                                </View>
                                {provider.website && (
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                                    <Globe size={10} color={theme.colors.textMuted} />
                                    <Text style={styles.providerWebsite} numberOfLines={1}>
                                      {(provider.website || "").replace(/https?:\/\/(www\.)?/, "").split("/")[0]}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            {sel && <Check size={18} color={theme.colors.primary} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Can't find provider? */}
            {!loadingProviders && (
              <TouchableOpacity style={styles.manualLink} onPress={() => setMode("manual")}>
                <Plus size={14} color={theme.colors.primary} />
                <Text style={styles.manualLinkText}>Can't find your provider? Add manually</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ═══════════════════════ MANUAL MODE ═══════════════════════ */}
        {mode === "manual" && (
          <View style={{ marginTop: 8 }}>
            <View style={styles.manualTrustBox}>
              <Text style={styles.manualTrustTitle}>User-added provider</Text>
              <Text style={styles.manualTrustText}>
                This creates a private provider record for LocateFlow tracking only. It does not update an external account.
              </Text>
            </View>
            <Text style={styles.sectionLabel}>Category *</Text>
            <View style={styles.chipRow}>
              {MANUAL_CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.chip, manualForm.category === c.value && styles.chipActive]}
                  onPress={() => updateManual("category", c.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select category ${c.label}`}
                  accessibilityState={{ selected: manualForm.category === c.value }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <CategoryIcon emoji={c.icon} size={13} color={manualForm.category === c.value ? theme.colors.primary : theme.colors.textTertiary} />
                    <Text style={[styles.chipText, manualForm.category === c.value && styles.chipTextActive]}>
                      {c.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Provider Name *</Text>
            <TextInput
              style={styles.input}
              placeholder={t("services.providerNamePlaceholder")}
              placeholderTextColor={theme.colors.textMuted}
              value={manualForm.providerName}
              onChangeText={(v) => updateManual("providerName", v)}
              accessibilityLabel="Provider name"
              accessibilityHint="Enter the name of the service provider"
            />

            <Text style={styles.label}>Monthly Cost ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={theme.colors.textMuted}
              value={manualForm.monthlyCost}
              onChangeText={(v) => updateManual("monthlyCost", v)}
              keyboardType="decimal-pad"
              accessibilityLabel="Monthly cost"
              accessibilityHint="Enter the monthly cost for this service"
            />

            <Text style={styles.sectionLabel}>Billing Cycle</Text>
            <View style={styles.chipRow}>
              {billingCycles.map((b) => (
                <TouchableOpacity
                  key={b.value}
                  style={[styles.chip, manualForm.billingCycle === b.value && styles.chipActive]}
                  onPress={() => updateManual("billingCycle", b.value)}
                >
                  <Text style={[styles.chipText, manualForm.billingCycle === b.value && styles.chipTextActive]}>
                    {b.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="(555) 123-4567"
              placeholderTextColor={theme.colors.textMuted}
              value={manualForm.phone}
              onChangeText={(v) => updateManual("phone", v)}
              keyboardType="phone-pad"
              accessibilityLabel="Phone number"
              accessibilityHint="Enter the provider phone number"
            />

            <Text style={styles.label}>Website</Text>
            <TextInput
              style={styles.input}
              placeholder="https://example.com"
              placeholderTextColor={theme.colors.textMuted}
              value={manualForm.website}
              onChangeText={(v) => updateManual("website", v)}
              keyboardType="url"
              autoCapitalize="none"
              accessibilityLabel="Website"
              accessibilityHint="Enter the provider website address"
            />

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              placeholder={t("services.notesHint")}
              placeholderTextColor={theme.colors.textMuted}
              value={manualForm.notes}
              onChangeText={(v) => updateManual("notes", v)}
              multiline
              accessibilityLabel="Notes"
              accessibilityHint="Enter any optional notes for this service"
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSaveManual}
              disabled={saving}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Save service"
              accessibilityHint="Creates a manual service entry"
              accessibilityState={{ disabled: saving }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Check size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Service</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.manualLink}
              onPress={() => setMode("browse")}
              accessibilityRole="button"
              accessibilityLabel="Back to provider list"
              accessibilityHint="Returns to the provider browsing mode"
            >
              <Search size={14} color={theme.colors.primary} />
              <Text style={styles.manualLinkText}>Back to provider list</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Floating bottom bar (browse mode, when providers selected) ── */}
      {mode === "browse" && selectedCount > 0 && (
        <View style={styles.floatingBar}>
          <Text style={styles.floatingText}>{selectedCount} provider{selectedCount > 1 ? "s" : ""} selected</Text>
          <TouchableOpacity
            style={[styles.floatingBtn, saving && { opacity: 0.6 }]}
            onPress={handleSaveAll}
            disabled={saving}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Register ${selectedCount} selected provider${selectedCount > 1 ? "s" : ""}`}
            accessibilityHint="Saves the currently selected providers as services"
            accessibilityState={{ disabled: saving }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Check size={16} color="#fff" />
                <Text style={styles.floatingBtnText}>Register {selectedCount > 1 ? "All" : ""}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  modeRow: {
    flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 8,
  },
  modeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  modeBtnActive: {
    backgroundColor: theme.colors.primary, borderColor: theme.colors.primary,
  },
  modeBtnText: { fontSize: 13, fontWeight: "600", color: theme.colors.textTertiary },
  modeBtnTextActive: { color: "#fff" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 13, fontWeight: "600", color: theme.colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16, marginBottom: 10,
  },
  label: {
    fontSize: 14, fontWeight: "500", color: theme.colors.textSecondary, marginTop: 16, marginBottom: 6,
  },
  hint: { fontSize: 13, color: theme.colors.textMuted, fontStyle: "italic" },
  stateLabel: { fontSize: 13, color: theme.colors.textTertiary, marginBottom: 8 },

  // Address chips
  addrChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, marginRight: 8,
  },
  addrChipActive: {
    backgroundColor: theme.colors.primaryFaded, borderColor: "rgba(249,115,22,0.4)",
  },
  addrChipText: { fontSize: 13, fontWeight: "600", color: theme.colors.textTertiary },
  addrChipTextActive: { color: theme.colors.primary },

  // Selected chips
  selectedChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10, padding: 10, borderRadius: 12, backgroundColor: theme.colors.primaryFaded, borderWidth: 1, borderColor: "rgba(249,115,22,0.2)" },
  selectedChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: theme.colors.primary },
  selectedChipText: { fontSize: 12, fontWeight: "600", color: "#fff" },

  // Search
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.text },

  // Recommended
  recoSection: {
    marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.card, padding: 14,
  },
  recoHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  recoTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  recoGrid: { gap: 8 },
  recoCard: {
    flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: "rgba(255,255,255,0.02)",
  },
  recoCardActive: { borderColor: "rgba(249,115,22,0.4)", backgroundColor: theme.colors.primaryFaded },
  recoCardTop: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  recoName: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  recoReason: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 1 },

  // Category accordion
  catSection: { marginBottom: 2, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden" },
  catHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.02)",
  },
  catIcon: { fontSize: 16 },
  catTitle: { flex: 1, fontSize: 14, fontWeight: "600", color: theme.colors.textSecondary },
  catCount: { fontSize: 11, color: theme.colors.textMuted },
  catBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10,
    backgroundColor: theme.colors.primaryFaded, borderWidth: 1, borderColor: "rgba(249,115,22,0.3)",
  },
  catBadgeText: { fontSize: 10, fontWeight: "700", color: theme.colors.primary },

  // Provider item
  providerItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  providerItemActive: { backgroundColor: theme.colors.primaryFaded },
  providerAvatar: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  providerAvatarActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  providerAvatarText: { fontSize: 14, fontWeight: "700", color: theme.colors.textSecondary },
  providerName: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  providerDesc: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  providerMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  scopeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  scopeFederal: { backgroundColor: "rgba(59,130,246,0.15)" },
  scopeState: { backgroundColor: "rgba(16,185,129,0.15)" },
  scopeText: { fontSize: 9, fontWeight: "600" },
  scopeFederalText: { color: "#60a5fa" },
  scopeStateText: { color: "#34d399" },
  providerWebsite: { fontSize: 9, color: theme.colors.textMuted, maxWidth: 100 },

  // Manual link
  manualLink: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginTop: 20, paddingVertical: 12,
  },
  manualLinkText: { fontSize: 14, fontWeight: "500", color: theme.colors.primary },

  // Manual form
  manualTrustBox: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(6,182,212,0.24)",
    backgroundColor: "rgba(6,182,212,0.08)",
    padding: 12,
    marginBottom: 14,
  },
  manualTrustTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.text,
  },
  manualTrustText: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    lineHeight: 18,
    marginTop: 4,
  },
  input: {
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: theme.colors.text,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primaryFaded, borderColor: "rgba(249,115,22,0.4)",
  },
  chipText: { fontSize: 13, fontWeight: "500", color: theme.colors.textTertiary },
  chipTextActive: { color: theme.colors.primary },

  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg,
    paddingVertical: 16, marginTop: 28, ...theme.shadow.glow,
  },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },

  // Floating bar
  floatingBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: "rgba(10,10,26,0.95)", borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  floatingText: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  floatingBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
    backgroundColor: theme.colors.primary, ...theme.shadow.glow,
  },
  floatingBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // Loading / empty
  loadingBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 40 },
  loadingText: { fontSize: 14, color: theme.colors.textMuted },
  emptyText: { textAlign: "center", color: theme.colors.textMuted, fontSize: 14, paddingVertical: 40 },
});
