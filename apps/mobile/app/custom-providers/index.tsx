import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
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
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { HeroCard, MoveCard, SectionHeader, Pill } from "@/components/move";
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

  // Stable (no `search` dep) so the mount effect runs ONCE — previously it
  // re-fired on every keystroke and raced handleSearch, momentarily blanking
  // the list with an unfiltered reload.
  const loadProviders = useCallback(async (nextSearch: string = "") => {
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
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadProviders("");
      setLoading(false);
    })();
  }, [loadProviders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProviders(search);
    setRefreshing(false);
  }, [loadProviders, search]);

  // Debounce search so we issue one request ~300ms after the last keystroke
  // instead of one per character.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { void loadProviders(value); }, 300);
  };

  // Cancel a pending debounced search on unmount so the timer doesn't fire a
  // state update on an unmounted component (mirrors providers/index.tsx).
  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  if (loading) return <LoadingScreen />;

  const localCount = providers.filter((provider) => provider.city || provider.state).length;
  const manualCount = providers.filter((provider) => provider.manualTrackingOnly).length;

  const goAdd = () => router.push({ pathname: "/services/new", params: { mode: "manual" } });

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
          onPress={goAdd}
          style={styles.addBtn}
          accessibilityRole="button"
          accessibilityLabel={t("customProviders.addA11y")}
        >
          <Plus size={20} color={theme.colors.onAccent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <HeroCard style={styles.hero} padding={18}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Building2 size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>{t("customProviders.userAddedBadge")}</Text>
              <Text style={styles.heroTitle}>{t("customProviders.title")}</Text>
              <Text style={styles.heroSub} numberOfLines={2}>
                {t("customProviders.noticeText")}
              </Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{providers.length}</Text>
              <Text style={styles.heroStatLabel}>{t("customProviders.statSaved", { defaultValue: "saved" })}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{localCount}</Text>
              <Text style={styles.heroStatLabel}>{t("customProviders.statLocal", { defaultValue: "local" })}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{manualCount}</Text>
              <Text style={styles.heroStatLabel}>{t("customProviders.statManual", { defaultValue: "manual" })}</Text>
            </View>
          </View>
        </HeroCard>

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
            onAction={goAdd}
          />
        ) : (
          <>
            <SectionHeader label={t("customProviders.title")} style={styles.sectionHeader} />
            <View style={styles.list}>
              {providers.map((provider) => (
                <MoveCard
                  key={provider.id}
                  onPress={() => router.push({ pathname: "/custom-providers/[id]", params: { id: provider.id } })}
                  padding={14}
                  radius={16}
                  style={styles.card}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.cardIcon}>
                      <Building2 size={18} color={theme.colors.primary} />
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{provider.name}</Text>
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {t(`categories.${provider.category}`, { defaultValue: provider.category.replace(/_/g, " ") })}
                        {provider.city || provider.state ? ` · ${[provider.city, provider.state].filter(Boolean).join(", ")}` : ""}
                      </Text>
                      <Text style={styles.cardCaveat} numberOfLines={2}>
                        {provider.availabilityCaveat || t("customProviders.defaultCaveat")}
                      </Text>
                    </View>
                    <View style={styles.cardEnd}>
                      <Pill
                        label={t("customProviders.trackedPill", { defaultValue: "Tracked" })}
                        tone={provider.manualTrackingOnly ? "warning" : "success"}
                      />
                      <ChevronRight size={18} color={theme.colors.textMuted} />
                    </View>
                  </View>
                </MoveCard>
              ))}
            </View>

            <TouchableOpacity
              onPress={goAdd}
              style={styles.addProvider}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t("customProviders.addA11y")}
            >
              <Plus size={16} color={theme.colors.primary} />
              <Text style={styles.addProviderText}>{t("customProviders.addLocalProvider")}</Text>
            </TouchableOpacity>
          </>
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
  title: { fontSize: 20, fontFamily: fonts.serif, color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  hero: {
    marginBottom: 14,
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
    borderColor: theme.colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroKicker: {
    fontSize: 10,
    fontFamily: fonts.sansBold,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: theme.colors.primary,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: fonts.serifBold,
    color: theme.colors.text,
    marginTop: 3,
  },
  heroSub: {
    fontSize: 12,
    fontFamily: fonts.sans,
    color: theme.colors.dim,
    marginTop: 3,
    lineHeight: 17,
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
    fontSize: 16,
    fontFamily: fonts.serifBold,
    color: theme.colors.text,
  },
  heroStatLabel: {
    fontSize: 8,
    fontFamily: fonts.sansBold,
    letterSpacing: 0.8,
    color: theme.colors.faint,
    textTransform: "uppercase",
    marginTop: 3,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.highlight,
    borderRadius: theme.radius.xl,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  searchInput: { flex: 1, color: theme.colors.text, fontSize: 15, fontFamily: fonts.sans, paddingVertical: 12 },
  sectionHeader: { marginBottom: 10 },
  list: { gap: 10 },
  card: {},
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardEnd: { alignItems: "flex-end", gap: 6 },
  cardTitle: { fontSize: 15, fontFamily: fonts.sansBold, color: theme.colors.text },
  cardMeta: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 2 },
  cardCaveat: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.textSecondary, marginTop: 6, lineHeight: 17 },
  addProvider: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.accentBorder,
    backgroundColor: theme.colors.accentSoft,
  },
  addProviderText: { fontSize: 13.5, fontFamily: fonts.sansSemibold, color: theme.colors.primary },
});
