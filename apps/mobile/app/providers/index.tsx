import React, { useEffect, useMemo, useState, useCallback } from "react";
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
import { Search, ArrowLeft, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ProviderCard, type ProviderCardData } from "@/components/provider/ProviderCard";
import { CategoryChipRow, type CategoryChip } from "@/components/provider/CategoryChipRow";
import { RecommendedRow, type RecommendedRowItem } from "@/components/provider/RecommendedRow";
import { getCategoryLabel, getCategoryOrder } from "@/lib/recommendation-engine";

const PAGE_SIZE = 20;

type Provider = ProviderCardData & {
  isActive?: boolean;
};

type AddressOption = {
  id: string;
  state: string;
  zip: string;
  isPrimary: boolean;
};

type RecommendationsResponse = {
  clusters: Array<{
    tier: "CRITICAL" | "IMPORTANT" | "RECOMMENDED" | "OPTIONAL";
    providers: Array<Provider & { tier?: string }>;
  }>;
  meta: { state?: string | null; currentPhase?: string };
};

export default function ProvidersScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [recommended, setRecommended] = useState<RecommendedRowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [primaryAddress, setPrimaryAddress] = useState<AddressOption | null>(null);
  const [addressLoaded, setAddressLoaded] = useState(false);

  // Load primary address once
  useEffect(() => {
    (async () => {
      const res = await api.get<{ addresses: AddressOption[] }>("/api/addresses");
      const addrs = res.data?.addresses || [];
      const primary = addrs.find((a) => a.isPrimary) || addrs[0] || null;
      setPrimaryAddress(primary);
      setAddressLoaded(true);
    })();
  }, []);

  const fetchProviders = useCallback(async () => {
    const params: Record<string, string> = {};
    if (search) params.q = search;
    if (primaryAddress?.state) params.state = primaryAddress.state;
    if (primaryAddress?.zip) params.zip = primaryAddress.zip;
    const res = await api.get<{ providers: Provider[] }>("/api/providers", params);
    setProviders(res.data?.providers || []);
    setPage(1);
  }, [search, primaryAddress]);

  const fetchRecommendations = useCallback(async () => {
    if (!primaryAddress?.id) return;
    const res = await api.get<RecommendationsResponse>("/api/providers/recommendations", {
      addressId: primaryAddress.id,
    });
    const clusters = res.data?.clusters || [];
    const urgent = clusters
      .filter((c) => c.tier === "CRITICAL" || c.tier === "IMPORTANT")
      .flatMap((c) => c.providers.map((p) => ({ ...p, tier: c.tier })));
    // Dedupe by id, keep first (CRITICAL first due to cluster order)
    const seen = new Set<string>();
    const unique: RecommendedRowItem[] = [];
    for (const p of urgent) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      unique.push(p);
    }
    setRecommended(unique.slice(0, 10));
  }, [primaryAddress]);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchProviders(), fetchRecommendations()]);
    setLoading(false);
  }, [fetchProviders, fetchRecommendations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProviders(), fetchRecommendations()]);
    setRefreshing(false);
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
      .map(([value, count]) => ({ value, label: getCategoryLabel(value), count }))
      .sort((a, b) => getCategoryOrder(a.value) - getCategoryOrder(b.value));
  }, [providers]);

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
    // Small timeout to prevent thrashing; in-memory paging is instant.
    setTimeout(() => {
      setPage((p) => p + 1);
      setLoadingMore(false);
    }, 50);
  }, [loadingMore, hasMore]);

  const submitSearch = useCallback(() => setSearch(searchInput.trim()), [searchInput]);
  const clearSearch = useCallback(() => {
    setSearchInput("");
    setSearch("");
  }, []);

  const selectedLabel = selectedCat ? getCategoryLabel(selectedCat) : null;

  const renderHeader = useCallback(() => {
    if (search) return null; // Hide recommendations while searching
    return (
      <View>
        {recommended.length > 0 ? (
          <RecommendedRow
            title="For your move"
            description={
              primaryAddress?.state
                ? `Urgent & important providers for ${primaryAddress.state}`
                : "Urgent & important providers tailored to you"
            }
            providers={recommended}
            onPressProvider={(id) => router.push(`/providers/${id}` as any)}
          />
        ) : null}
      </View>
    );
  }, [recommended, primaryAddress, router, search]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    if (search) {
      return (
        <EmptyState
          icon={<Search size={32} color={theme.colors.primary} />}
          title={t("empty.providers")}
          description={t("empty.providersDescription")}
          actionLabel="Clear search"
          onAction={clearSearch}
        />
      );
    }
    if (selectedCat) {
      return (
        <EmptyState
          icon={<Search size={32} color={theme.colors.primary} />}
          title="Nothing in this category"
          description={
            primaryAddress?.state
              ? `${t("empty.providers")} — ${selectedLabel} / ${primaryAddress.state}`
              : `${t("empty.providers")} — ${selectedLabel}`
          }
          actionLabel="Show all"
          onAction={() => setSelectedCat(null)}
        />
      );
    }
    return (
      <EmptyState
        icon={<Search size={32} color={theme.colors.primary} />}
        title={t("empty.providers")}
        description="Pull to refresh or check your connection."
      />
    );
  }, [loading, search, selectedCat, selectedLabel, primaryAddress, clearSearch]);

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
        <Text style={styles.title}>Providers</Text>
        <View style={{ width: 44 }} />
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
            accessibilityLabel="Search providers"
            accessibilityHint="Filters providers by name, description, or tags"
          />
          {searchInput.length > 0 ? (
            <TouchableOpacity
              onPress={clearSearch}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {!search && categoryChips.length > 0 ? (
        <CategoryChipRow
          categories={categoryChips}
          selected={selectedCat}
          onSelect={setSelectedCat}
        />
      ) : null}

      {loading ? (
        <LoadingScreen />
      ) : (
        <FlatList
          data={paginated}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <ProviderCard
                provider={item}
                variant="full"
                onPress={() => router.push(`/providers/${item.id}` as any)}
              />
            </View>
          )}
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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
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
  searchRow: { paddingHorizontal: 20, marginBottom: 8 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.text },
  scrollContent: { paddingBottom: 32 },
  listItem: { paddingHorizontal: 20, paddingBottom: 12 },
  footer: { paddingVertical: 16, alignItems: "center" },
});
