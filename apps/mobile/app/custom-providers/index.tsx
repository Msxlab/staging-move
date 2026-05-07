import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Building2, ChevronRight, Plus, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

interface CustomProvider {
  id: string;
  name: string;
  category: string;
  providerType?: string | null;
  city?: string | null;
  state?: string | null;
  trustStatus?: string | null;
  manualTrackingOnly?: boolean;
  availabilityCaveat?: string;
}

export default function CustomProvidersScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useTranslation();
  const [providers, setProviders] = useState<CustomProvider[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadProviders = useCallback(async (nextSearch = search) => {
    const params: Record<string, string> = {};
    if (nextSearch.trim()) params.search = nextSearch.trim();
    const res = await api.get<{ providers?: CustomProvider[] }>("/api/custom-providers", params);
    if (res.error) {
      setError(res.error);
      setProviders([]);
    } else {
      setError("");
      setProviders(res.data?.providers || []);
    }
  }, [search]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadProviders("");
      setLoading(false);
    })();
  }, [loadProviders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProviders();
    setRefreshing(false);
  }, [loadProviders]);

  const handleSearch = async (value: string) => {
    setSearch(value);
    await loadProviders(value);
  };

  if (loading) return <LoadingScreen />;

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
        <Text style={styles.title}>{t("customProviders.title")}</Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/services/new", params: { mode: "manual" } })}
          style={styles.addBtn}
          accessibilityRole="button"
          accessibilityLabel={t("customProviders.addA11y")}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <View style={styles.notice}>
          <Badge label={t("customProviders.userAddedBadge")} variant="info" />
          <Text style={styles.noticeText}>
            {t("customProviders.noticeText")}
          </Text>
        </View>

        <View style={styles.searchBox}>
          <Search size={16} color={theme.colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={handleSearch}
            placeholder={t("customProviders.searchPlaceholder")}
            placeholderTextColor={theme.colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>

        {error ? (
          <ErrorState message={error} onRetry={() => loadProviders()} />
        ) : providers.length === 0 ? (
          <EmptyState
            icon={<Building2 size={32} color={theme.colors.primary} />}
            title={t("customProviders.emptyTitle")}
            description={t("customProviders.emptyDescription")}
            actionLabel={t("customProviders.addLocalProvider")}
            onAction={() => router.push({ pathname: "/services/new", params: { mode: "manual" } })}
          />
        ) : (
          <View style={styles.list}>
            {providers.map((provider) => (
              <TouchableOpacity
                key={provider.id}
                style={styles.card}
                onPress={() => router.push({ pathname: "/custom-providers/[id]", params: { id: provider.id } })}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t("providers.openProviderA11y", { provider: provider.name })}
              >
                <View style={styles.cardIcon}>
                  <Building2 size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{provider.name}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {t(`categories.${provider.category}`, { defaultValue: provider.category.replace(/_/g, " ") })}
                    {provider.city || provider.state ? ` - ${[provider.city, provider.state].filter(Boolean).join(", ")}` : ""}
                  </Text>
                  <Text style={styles.cardCaveat} numberOfLines={2}>
                    {provider.availabilityCaveat || t("customProviders.defaultCaveat")}
                  </Text>
                </View>
                <ChevronRight size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
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
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  notice: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  noticeText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: 15, paddingVertical: 12 },
  list: { gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    padding: 14,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  cardMeta: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  cardCaveat: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 6, lineHeight: 17 },
});
