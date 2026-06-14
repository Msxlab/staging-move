import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, ArrowLeft, X, AlertTriangle, Scale, MapPin, Sparkles, PlusCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { useCompareStore, MAX_COMPARE } from "@/lib/compare-store";
import { hapticLight, hapticWarning } from "@/lib/haptics";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ProviderCard, type ProviderCardData } from "@/components/provider/ProviderCard";
import { ListEntrance } from "@/components/ui/ListEntrance";
import { CategoryChipRow, type CategoryChip } from "@/components/provider/CategoryChipRow";
import { RecommendedRow, type RecommendedRowItem } from "@/components/provider/RecommendedRow";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { PressableScale } from "@/components/ui/PressableScale";
import { StateRulesCard } from "@/components/provider/StateRulesCard";
import { getCategoryIcon, getCategoryLabel, getCategoryOrder } from "@/lib/recommendation-engine";

const PAGE_SIZE = 20;

type Provider = ProviderCardData & {
  isActive?: boolean;
};

type AddressOption = {
  id: string;
  state: string;
  zip: string;
  isPrimary: boolean;
  nickname?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type ScoredProviderPayload = Provider & {
  tier?: string;
  // Engine-computed recommendation signals; carried through to the reason chip.
  matchReasons?: string[] | null;
  explanation?: { reason?: string | null; profileMatch?: string | null } | null;
};

type RecommendationGuideAction = {
  kind: "add_provider" | "verify_address" | "review_state_rules" | "finish_saved" | string;
  label: string;
  reason?: string | null;
  category?: string | null;
  providerId?: string | null;
};

type RecommendationGuideLane = {
  key: string;
  title: string;
  description?: string | null;
  providers: ScoredProviderPayload[];
  action?: RecommendationGuideAction | null;
};

type RecommendationGuideSetupCategory = {
  category: string;
  label: string;
  reason: string;
  urgency?: string | null;
  providerId?: string | null;
  providerName?: string | null;
};

type RecommendationGuideSetupSection = {
  key: string;
  title: string;
  description?: string | null;
  categories?: RecommendationGuideSetupCategory[] | null;
  providerCount?: number | null;
  action?: RecommendationGuideAction | null;
};

type RecommendationGuide = {
  summary?: string | null;
  profileSignals?: string[] | null;
  nextActions?: RecommendationGuideAction[] | null;
  lanes?: RecommendationGuideLane[] | null;
  setupPlan?: {
    sections?: RecommendationGuideSetupSection[] | null;
    primaryNextCategory?: string | null;
    primaryNextLabel?: string | null;
    totalOpenCategories?: number | null;
  } | null;
  dataCoverage?: {
    availableAtAddress?: number;
    exactZip?: number;
    zipPrefix?: number;
    addressCheckRequired?: number;
  } | null;
};

type RecommendationsResponse = {
  clusters: Array<{
    tier: "CRITICAL" | "IMPORTANT" | "RECOMMENDED" | "OPTIONAL";
    providers: ScoredProviderPayload[];
  }>;
  stats?: { missingCritical?: string[] };
  recommendationGuide?: RecommendationGuide;
  meta: { state?: string | null; currentPhase?: string };
};

export default function ProvidersScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useTranslation();
  const compareEntries = useCompareStore((s) => s.entries);
  const toggleCompare = useCompareStore((s) => s.toggle);
  const clearCompare = useCompareStore((s) => s.clear);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [recommended, setRecommended] = useState<RecommendedRowItem[]>([]);
  const [recommendationGuide, setRecommendationGuide] = useState<RecommendationGuide | null>(null);
  // Essential CRITICAL categories the engine flagged with NO matching provider /
  // service for this address (stats.missingCritical). Surfaced as tappable "still
  // needed" gap chips — the same nudge onboarding shows, now where users shop.
  const [missingCritical, setMissingCritical] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [primaryAddress, setPrimaryAddress] = useState<AddressOption | null>(null);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [addressLoaded, setAddressLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pageTimerRef.current) clearTimeout(pageTimerRef.current);
    };
  }, []);

  // Load primary address once
  useEffect(() => {
    (async () => {
      const res = await api.get<{ addresses: AddressOption[] }>("/api/addresses");
      if (res.error) {
        setError(res.error);
        setAddressLoaded(true);
        return;
      }
      const addrs = res.data?.addresses || [];
      const primary = addrs.find((a) => a.isPrimary) || addrs[0] || null;
      setAddresses(addrs);
      setPrimaryAddress(primary);
      setAddressLoaded(true);
    })();
  }, []);

  const fetchProviders = useCallback(async () => {
    const params: Record<string, string> = {};
    if (search) params.q = search;
    if (primaryAddress?.state) params.state = primaryAddress.state;
    if (primaryAddress?.zip) params.zip = primaryAddress.zip;
    // Destination coordinates unlock the server's coverage-match + distance
    // ranking ("providers near your new place") over the whole catalog —
    // web parity with providers-client.tsx. Only sent when present.
    if (typeof primaryAddress?.latitude === "number" && Number.isFinite(primaryAddress.latitude)) {
      params.lat = String(primaryAddress.latitude);
    }
    if (typeof primaryAddress?.longitude === "number" && Number.isFinite(primaryAddress.longitude)) {
      params.lng = String(primaryAddress.longitude);
    }
    const res = await api.get<{ providers: Provider[] }>("/api/providers", params);
    if (res.error) {
      setError(res.error);
      return false;
    }
    setProviders(res.data?.providers || []);
    setError(null);
    setPage(1);
    return true;
  }, [search, primaryAddress]);

  const fetchRecommendations = useCallback(async () => {
    if (!primaryAddress?.id) return;
    const res = await api.get<RecommendationsResponse>("/api/providers/recommendations", {
      addressId: primaryAddress.id,
    });
    if (res.error) {
      setRecommended([]);
      setMissingCritical([]);
      setRecommendationGuide(null);
      return false;
    }
    const guide = res.data?.recommendationGuide || null;
    setRecommendationGuide(guide);
    const clusters = res.data?.clusters || [];
    const guided = (guide?.lanes || [])
      .flatMap((lane) => lane.providers || [])
      .map((p) => ({
        ...p,
        matchReasons: p.matchReasons,
        explanation: p.explanation,
      }));
    const urgent = guided.length > 0
      ? guided
      : clusters
          .filter((c) => c.tier === "CRITICAL" || c.tier === "IMPORTANT")
          // Carry the engine's matchReasons + explanation through so each card can
          // surface WHY it's recommended (the "directory → guide" flip).
          .flatMap((c) =>
            c.providers.map((p) => ({
              ...p,
              tier: c.tier,
              matchReasons: p.matchReasons,
              explanation: p.explanation,
            })),
          );
    // Dedupe by id, keep first (CRITICAL first due to cluster order)
    const seen = new Set<string>();
    const unique: RecommendedRowItem[] = [];
    for (const p of urgent) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      unique.push(p);
    }
    setRecommended(unique.slice(0, 10));
    const missing = res.data?.stats?.missingCritical;
    setMissingCritical(Array.isArray(missing) ? missing : []);
    return true;
  }, [primaryAddress]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchProviders(), fetchRecommendations()]);
    } finally {
      setLoading(false);
    }
  }, [fetchProviders, fetchRecommendations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchProviders(), fetchRecommendations()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchProviders, fetchRecommendations]);

  // Re-fetch on address load + search change
  useEffect(() => {
    if (addressLoaded) load();
  }, [addressLoaded, load]);

  // Category chips built from loaded providers, sorted by CATEGORY_META.order
  const categoryChips = useMemo<CategoryChip[]>(() => {
    const counts = new Map<string, number>();
    for (const p of providers) counts.set(p.category, (counts.get(p.category) || 0) + 1);
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, label: t(`categories.${value}`, { defaultValue: getCategoryLabel(value) }), count }))
      .sort((a, b) => getCategoryOrder(a.value) - getCategoryOrder(b.value));
  }, [providers, t]);

  // "Still needed" gap chips — the engine-flagged missing CRITICAL categories,
  // de-duplicated by readable label and sorted into CATEGORY_META order so they
  // read like the onboarding nudge. Each chip pre-selects that category's filter
  // so the user can shop for the essential they're missing. The currently
  // selected category is dropped (no point nudging toward the active filter).
  const gapChips = useMemo<CategoryChip[]>(() => {
    const seen = new Set<string>();
    const chips: CategoryChip[] = [];
    for (const category of missingCritical) {
      if (!category || category === selectedCat) continue;
      const label = t(`categories.${category}`, { defaultValue: getCategoryLabel(category) });
      if (seen.has(label)) continue;
      seen.add(label);
      chips.push({ value: category, label });
    }
    return chips.sort((a, b) => getCategoryOrder(a.value) - getCategoryOrder(b.value));
  }, [missingCritical, selectedCat, t]);

  const guideLanes = useMemo(() => {
    return (recommendationGuide?.lanes || [])
      .filter((lane) => Array.isArray(lane.providers) && lane.providers.length > 0)
      .slice(0, 3);
  }, [recommendationGuide]);

  const selectGap = useCallback(
    (category: string) => {
      hapticLight();
      setSelectedCat(category);
    },
    [],
  );

  // Filter by category + paginate
  const filtered = useMemo(() => {
    if (!selectedCat) return providers;
    return providers.filter((p) => p.category === selectedCat);
  }, [providers, selectedCat]);

  const paginated = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
  const hasMore = paginated.length < filtered.length;

  const onEndReached = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    // Small timeout to prevent thrashing; in-memory paging is instant. We
    // track the handle so unmount cancels it — otherwise React fires a
    // "state update on unmounted component" warning if the user backs out
    // mid-scroll.
    if (pageTimerRef.current) clearTimeout(pageTimerRef.current);
    pageTimerRef.current = setTimeout(() => {
      pageTimerRef.current = null;
      setPage((p) => p + 1);
      setLoadingMore(false);
    }, 50);
  }, [loadingMore, hasMore]);

  const submitSearch = useCallback(() => setSearch(searchInput.trim()), [searchInput]);
  const clearSearch = useCallback(() => {
    setSearchInput("");
    setSearch("");
  }, []);

  const compareIds = useMemo(() => new Set(compareEntries.map((e) => e.id)), [compareEntries]);

  const onToggleCompare = useCallback(
    (provider: Provider) => {
      const wasSelected = compareIds.has(provider.id);
      const added = toggleCompare(provider);
      // toggle returns false both when removing AND when the set is full and
      // the add was rejected. Distinguish: a rejected add means it wasn't
      // selected before and still isn't.
      if (!added && !wasSelected) {
        hapticWarning();
      } else {
        hapticLight();
      }
    },
    [compareIds, toggleCompare],
  );

  const openCompare = useCallback(() => {
    router.push("/providers/compare" as any);
  }, [router]);

  const openGuideAction = useCallback(
    (action: RecommendationGuideAction) => {
      hapticLight();
      if (action.kind === "review_state_rules") {
        setSelectedCat("GOVERNMENT_DMV");
        return;
      }
      if (action.category || action.providerId) {
        const params: Record<string, string> = {};
        if (primaryAddress?.id) params.addressId = primaryAddress.id;
        if (action.category) params.category = action.category;
        if (action.providerId) params.providerId = action.providerId;
        router.push({ pathname: "/services/new", params } as any);
        return;
      }
      if (action.providerId) {
        router.push({ pathname: "/providers/[id]", params: { id: action.providerId } } as any);
      }
    },
    [primaryAddress?.id, router],
  );

  const openGuideLane = useCallback(
    (lane: RecommendationGuideLane) => {
      const ids = (lane.providers || [])
        .map((provider) => provider.id)
        .filter(Boolean)
        .slice(0, 4);
      if (ids.length === 0) return;
      hapticLight();
      const params: Record<string, string> = {
        providerIds: ids.join(","),
        guide: lane.key,
      };
      if (primaryAddress?.id) params.addressId = primaryAddress.id;
      if (lane.providers[0]?.category) params.category = lane.providers[0].category;
      router.push({ pathname: "/services/new", params } as any);
    },
    [primaryAddress?.id, router],
  );

  const selectedLabel = selectedCat ? t(`categories.${selectedCat}`, { defaultValue: getCategoryLabel(selectedCat) }) : null;
  const commandAddressLabel =
    primaryAddress?.nickname ||
    [primaryAddress?.city, primaryAddress?.state].filter(Boolean).join(", ") ||
    t("addresses.title");

  const renderHeader = useCallback(() => {
    return (
      <View>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            accessibilityHint={t("common.backHint")}
          >
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("providers.title")}</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.commandHero}>
          <View style={styles.commandTop}>
            <View style={styles.commandIcon}>
              <Search size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.commandCopy}>
              <Text style={styles.commandKicker}>PROVIDER COMMAND</Text>
              <Text style={styles.commandTitle}>{t("providers.title")}</Text>
              <View style={styles.commandLocation}>
                <MapPin size={12} color={theme.colors.textTertiary} />
                <Text style={styles.commandSub} numberOfLines={1}>
                  {commandAddressLabel}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.commandStats}>
            <View style={styles.commandStat}>
              <Text style={styles.commandStatValue}>{providers.length}</Text>
              <Text style={styles.commandStatLabel}>catalog</Text>
            </View>
            <View style={styles.commandStat}>
              <Text style={styles.commandStatValue}>{recommended.length}</Text>
              <Text style={styles.commandStatLabel}>matched</Text>
            </View>
            <View style={styles.commandStat}>
              <Text style={[styles.commandStatValue, missingCritical.length > 0 && styles.commandStatWarn]}>
                {missingCritical.length}
              </Text>
              <Text style={styles.commandStatLabel}>gaps</Text>
            </View>
            <View style={styles.commandStat}>
              <Text style={styles.commandStatValue}>{compareEntries.length}/{MAX_COMPARE}</Text>
              <Text style={styles.commandStatLabel}>compare</Text>
            </View>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={16} color={theme.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={t("providers.searchPlaceholder")}
              placeholderTextColor={theme.colors.textMuted}
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={submitSearch}
              returnKeyType="search"
              accessibilityLabel={t("providers.searchA11y")}
              accessibilityHint={t("providers.searchHint")}
            />
            {searchInput.length > 0 ? (
              <TouchableOpacity
                onPress={clearSearch}
                accessibilityRole="button"
                accessibilityLabel={t("common.clearSearch")}
              >
                <X size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.truthBanner}>
          <AlertTriangle size={15} color={theme.colors.warning} />
          <Text style={styles.truthText}>
            {t("providers.truthBanner")}
          </Text>
        </View>

        {!search && recommendationGuide ? (
          <View style={styles.smartGuide}>
            <View style={styles.smartTitleRow}>
              <Sparkles size={15} color={theme.colors.primary} />
              <Text style={styles.smartTitle}>
                {t("providers.smartGuideTitle", { defaultValue: "Smart setup plan" })}
              </Text>
            </View>
            {recommendationGuide.summary ? (
              <Text style={styles.smartSummary}>{recommendationGuide.summary}</Text>
            ) : null}
            {Array.isArray(recommendationGuide.profileSignals) && recommendationGuide.profileSignals.length > 0 ? (
              <View style={styles.signalWrap}>
                {recommendationGuide.profileSignals.slice(0, 4).map((signal) => (
                  <View key={signal} style={styles.signalChip}>
                    <Text style={styles.signalText} numberOfLines={1}>
                      {signal}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {Array.isArray(recommendationGuide.setupPlan?.sections) && recommendationGuide.setupPlan.sections.length > 0 ? (
              <View style={styles.setupPlanWrap}>
                {recommendationGuide.setupPlan.sections.slice(0, 3).map((section) => {
                  const categories = (section.categories || []).slice(0, 3);
                  if (categories.length === 0) return null;
                  return (
                    <View key={section.key} style={styles.setupSection}>
                      <View style={styles.setupSectionHead}>
                        <Text style={styles.setupSectionTitle} numberOfLines={1}>
                          {section.title}
                        </Text>
                        {typeof section.providerCount === "number" ? (
                          <Text style={styles.setupSectionMeta}>
                            {section.providerCount}
                          </Text>
                        ) : null}
                      </View>
                      {section.description ? (
                        <Text style={styles.setupSectionDesc} numberOfLines={2}>
                          {section.description}
                        </Text>
                      ) : null}
                      <View style={styles.setupCategoryWrap}>
                        {categories.map((item) => (
                          <PressableScale
                            key={`${section.key}-${item.category}`}
                            onPress={() => item.category && selectGap(item.category)}
                            style={styles.setupCategoryChip}
                            accessibilityRole="button"
                            accessibilityLabel={item.label}
                            accessibilityHint={item.reason}
                          >
                            <CategoryIcon emoji={getCategoryIcon(item.category)} size={12} color={theme.colors.primary} />
                            <Text style={styles.setupCategoryText} numberOfLines={1}>
                              {item.label}
                            </Text>
                          </PressableScale>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {Array.isArray(recommendationGuide.nextActions) && recommendationGuide.nextActions.length > 0 ? (
              <View style={styles.actionWrap}>
                {recommendationGuide.nextActions.slice(0, 3).map((action) => (
                  <PressableScale
                    key={`${action.kind}-${action.category || ""}-${action.providerId || ""}-${action.label}`}
                    onPress={() => openGuideAction(action)}
                    style={styles.actionChip}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    accessibilityHint={action.reason || undefined}
                  >
                    <PlusCircle size={13} color={theme.colors.primary} />
                    <Text style={styles.actionText} numberOfLines={1}>
                      {action.label}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {!search && categoryChips.length > 0 ? (
          <View style={styles.categoryRowWrap}>
            <CategoryChipRow
              categories={categoryChips}
              selected={selectedCat}
              onSelect={setSelectedCat}
            />
          </View>
        ) : null}

        {/* Location picker — browse providers for any of the user's addresses,
            not just the primary one (web parity). */}
        {addresses.length > 1 ? (
          <View style={styles.addressSwitchWrap}>
            {addresses.map((a) => {
              const active = a.id === primaryAddress?.id;
              const label = a.nickname || a.city || a.state || t("addresses.title");
              return (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => setPrimaryAddress(a)}
                  accessibilityRole="button"
                  style={[styles.addressSwitchChip, active && styles.addressSwitchChipActive]}
                >
                  <Text style={[styles.addressSwitchText, active && styles.addressSwitchTextActive]} numberOfLines={1}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        {/* "YOUR STATE" guide — first-class surface for the statewide rules a
            mover must handle (DMV, voter registration, taxes), keyed on the
            user's primary-address state. Self-fetches /api/state-rules and
            renders nothing if there's no state or no rule. The SAME component
            renders inside moving/[id], so both stay in sync. Hidden while
            searching, like the other contextual header sections. */}
        {!search && primaryAddress?.state ? (
          <View style={styles.stateGuideWrap}>
            <StateRulesCard state={primaryAddress.state} />
          </View>
        ) : null}
        {/* "Still needed" gap chips — engine-flagged essentials the user has no
            provider for. Tapping a chip pre-selects that category's filter so
            they can shop for it. Hidden while searching and once nothing is
            missing. Mirrors the onboarding missingCritical nudge. */}
        {!search && gapChips.length > 0 ? (
          <View style={styles.gapWrap}>
            <View style={styles.gapHeader}>
              <AlertTriangle size={14} color={theme.colors.warning} />
              <Text style={styles.gapTitle}>{t("providers.stillNeeded")}</Text>
            </View>
            <Text style={styles.gapHint}>{t("providers.stillNeededHint")}</Text>
            <View style={styles.gapChips}>
              {gapChips.map((c) => (
                <PressableScale
                  key={c.value}
                  onPress={() => selectGap(c.value)}
                  style={styles.gapChip}
                  accessibilityRole="button"
                  accessibilityLabel={t("providers.stillNeededChipA11y", { category: c.label })}
                >
                  <CategoryIcon emoji={getCategoryIcon(c.value)} size={13} color={theme.colors.warning} />
                  <Text style={styles.gapChipText} numberOfLines={1}>
                    {c.label}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </View>
        ) : null}

        {!search && guideLanes.length > 0
          ? guideLanes.map((lane) => (
              <React.Fragment key={lane.key}>
                <RecommendedRow
                  title={lane.title}
                  description={lane.description || undefined}
                  providers={lane.providers}
                  onPressProvider={(id) => router.push({ pathname: "/providers/[id]", params: { id } })}
                />
                {lane.key === "setup_first" || lane.key === "best_matches" ? (
                  <View style={styles.laneActionWrap}>
                    <PressableScale
                      onPress={() => openGuideLane(lane)}
                      style={styles.laneActionButton}
                      accessibilityRole="button"
                      accessibilityLabel={t("providers.addLaneA11y", {
                        count: Math.min((lane.providers || []).length, 4),
                        defaultValue: `Add ${Math.min((lane.providers || []).length, 4)} recommended providers`,
                      })}
                    >
                      <PlusCircle size={14} color={theme.colors.primary} />
                      <Text style={styles.laneActionText} numberOfLines={1}>
                        {t("providers.addLane", {
                          count: Math.min((lane.providers || []).length, 4),
                          defaultValue: "Add these picks",
                        })}
                      </Text>
                    </PressableScale>
                  </View>
                ) : null}
              </React.Fragment>
            ))
          : !search && recommended.length > 0 ? (
              <RecommendedRow
                title={t("providers.forYourMove")}
                description={
                  primaryAddress?.state
                    ? t("providers.recommendedForState", { state: primaryAddress.state })
                    : t("providers.recommendedTailored")
                }
                providers={recommended}
                onPressProvider={(id) => router.push({ pathname: "/providers/[id]", params: { id } })}
              />
            ) : null}

        {/* Directory section kicker — separates the recommended rail from the
            full browse list (Aurora section idiom). */}
        {filtered.length > 0 ? (
          <View style={styles.secRow}>
            <Text style={styles.secKicker}>
              {(search
                ? t("providers.resultsKicker", { defaultValue: "Results" })
                : selectedCat && selectedLabel
                  ? selectedLabel
                  : t("providers.directoryKicker", { defaultValue: "All providers" })
              ).toUpperCase()}
            </Text>
            <Text style={styles.secCount}>{filtered.length}</Text>
          </View>
        ) : null}
      </View>
    );
  }, [
    recommended,
    primaryAddress,
    addresses,
    router,
    search,
    t,
    theme,
    gapChips,
    selectGap,
    styles,
    filtered.length,
    selectedCat,
    selectedLabel,
    commandAddressLabel,
    providers.length,
    missingCritical.length,
    compareEntries.length,
    searchInput,
    submitSearch,
    clearSearch,
    categoryChips,
    recommendationGuide,
    guideLanes,
    openGuideAction,
    openGuideLane,
  ]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    if (error) {
      return <ErrorState message={error} onRetry={load} />;
    }
    if (search) {
      return (
        <EmptyState
          icon={<Search size={32} color={theme.colors.primary} />}
          title={t("empty.providers")}
          description={t("empty.providersDescription")}
          actionLabel={t("common.clearSearch")}
          onAction={clearSearch}
        />
      );
    }
    if (selectedCat) {
      return (
        <EmptyState
          icon={<Search size={32} color={theme.colors.primary} />}
          title={t("providers.emptyCategory")}
          description={
            primaryAddress?.state
              ? `${t("empty.providers")} — ${selectedLabel} / ${primaryAddress.state}`
              : `${t("empty.providers")} — ${selectedLabel}`
          }
          actionLabel={t("common.showAll")}
          onAction={() => setSelectedCat(null)}
        />
      );
    }
    return (
      <EmptyState
        icon={<Search size={32} color={theme.colors.primary} />}
        title={t("empty.providers")}
        description={t("empty.providersConnection")}
      />
    );
  }, [loading, error, load, search, selectedCat, selectedLabel, primaryAddress, clearSearch]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={loading ? [] : paginated}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={loading ? <LoadingScreen /> : renderEmpty}
        renderItem={({ item, index }) => {
          const card = (
            <ProviderCard
              provider={item}
              variant="full"
              selectedForCompare={compareIds.has(item.id)}
              onPress={() => router.push({ pathname: "/providers/[id]", params: { id: item.id } })}
              onLongPress={() => onToggleCompare(item)}
            />
          );
          // Only cascade the first screenful. Beyond that, FlatList virtualizes
          // rows in/out as you scroll — replaying the entrance on every
          // scroll-mount would read as busy, so later rows render plainly.
          if (index >= PAGE_SIZE) {
            return <View style={styles.listItem}>{card}</View>;
          }
          return (
            <ListEntrance index={index} style={styles.listItem}>
              {card}
            </ListEntrance>
          );
        }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        contentContainerStyle={[styles.scrollContent, compareEntries.length > 0 ? styles.scrollContentWithTray : null]}
        showsVerticalScrollIndicator={false}
      />

      {compareEntries.length > 0 ? (
        <View style={styles.compareTray}>
          <View style={{ flex: 1 }}>
            <Text style={styles.compareTrayTitle}>
              {t("providers.compareCount", {
                count: compareEntries.length,
                max: MAX_COMPARE,
                defaultValue: "Compare ({{count}}/{{max}})",
              })}
            </Text>
            <Text style={styles.compareTrayHint} numberOfLines={1}>
              {compareEntries.map((e) => e.name).join(" · ")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={clearCompare}
            style={styles.compareClearBtn}
            accessibilityRole="button"
            accessibilityLabel={t("providers.compareClear", { defaultValue: "Clear comparison" })}
          >
            <X size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={openCompare}
            disabled={compareEntries.length < 2}
            style={[styles.compareGoBtn, compareEntries.length < 2 ? styles.compareGoBtnDisabled : null]}
            accessibilityRole="button"
            accessibilityLabel={t("providers.compareOpen", { defaultValue: "Open side-by-side comparison" })}
          >
            <Scale size={15} color="#fff" />
            <Text style={styles.compareGoText}>
              {compareEntries.length < 2
                ? t("providers.comparePickMore", { defaultValue: "Pick 2+" })
                : t("providers.compareGo", { defaultValue: "Compare" })}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
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
  commandHero: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 24,
    padding: 16,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.highlight,
  },
  commandTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  commandIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.primary + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  commandCopy: { flex: 1, minWidth: 0 },
  commandKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: theme.colors.accent,
  },
  commandTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: 3,
    letterSpacing: 0,
  },
  commandLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  commandSub: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textTertiary,
  },
  commandStats: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  commandStat: {
    flex: 1,
    minHeight: 56,
    borderRadius: 15,
    padding: 9,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
  },
  commandStatValue: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.text,
  },
  commandStatWarn: {
    color: theme.colors.warning,
  },
  commandStatLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: theme.colors.textTertiary,
    textTransform: "uppercase",
    marginTop: 3,
  },
  searchRow: { paddingHorizontal: 20, marginBottom: 8 },
  // Aurora glass chrome — matches the Edition VII hero panes.
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.glass.bg,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.glass.highlight,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.text },
  // Directory section kicker (Aurora section idiom).
  secRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 10,
  },
  secKicker: { fontSize: 10, letterSpacing: 1.4, fontWeight: "700", color: theme.colors.textTertiary },
  secCount: { fontSize: 10, letterSpacing: 1, fontWeight: "700", color: theme.colors.accent, fontVariant: ["tabular-nums"] },
  truthBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.warningFaded,
    borderWidth: 1,
    borderColor: theme.colors.amber.border,
  },
  truthText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },
  smartGuide: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  smartTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  smartTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.text,
  },
  smartSummary: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginTop: 7,
  },
  signalWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 10,
  },
  signalChip: {
    maxWidth: 150,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  signalText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textSecondary,
  },
  setupPlanWrap: {
    gap: 8,
    marginTop: 12,
  },
  setupSection: {
    padding: 10,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  setupSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  setupSectionTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.text,
  },
  setupSectionMeta: {
    minWidth: 22,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "800",
    color: theme.colors.primary,
    fontVariant: ["tabular-nums"],
  },
  setupSectionDesc: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textTertiary,
  },
  setupCategoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 9,
  },
  setupCategoryChip: {
    maxWidth: 180,
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
  },
  setupCategoryText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  actionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 220,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  laneActionWrap: {
    paddingHorizontal: 20,
    marginTop: -8,
    marginBottom: 14,
  },
  laneActionButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.borderFocus,
  },
  laneActionText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  categoryRowWrap: {
    marginHorizontal: 0,
    marginBottom: 12,
    overflow: "visible",
  },
  addressSwitchWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  addressSwitchChip: {
    maxWidth: 170,
    minHeight: 34,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  addressSwitchChipActive: {
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.primaryFaded,
  },
  addressSwitchText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.textSecondary,
  },
  addressSwitchTextActive: {
    color: theme.colors.primary,
  },
  stateGuideWrap: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  gapWrap: {
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  gapHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gapTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },
  gapHint: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginTop: 3,
  },
  gapChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  gapChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.warningFaded,
    borderWidth: 1,
    borderColor: theme.colors.amber.border,
  },
  gapChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text,
    maxWidth: 160,
  },
  scrollContent: { paddingBottom: 32 },
  scrollContentWithTray: { paddingBottom: 104 },
  listItem: { paddingHorizontal: 20, paddingBottom: 12 },
  footer: { paddingVertical: 16, alignItems: "center" },
  compareTray: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  compareTrayTitle: { fontSize: 13, fontWeight: "700", color: theme.colors.text },
  compareTrayHint: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 },
  compareClearBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  compareGoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
  },
  compareGoBtnDisabled: { opacity: 0.5 },
  compareGoText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
