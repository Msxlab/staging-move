import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ChevronRight,
  Search as SearchIcon,
  X,
  Zap,
  MapPin,
  Truck,
  DollarSign,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ListEntrance } from "@/components/ui/ListEntrance";
import { hapticLight } from "@/lib/haptics";

// A single searchable, deep-linkable result. `haystack` is the lowercased text
// we match the query against; `route` is where tapping the row navigates.
interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  haystack: string;
  route: Href;
}

type SearchSection = {
  key: string;
  title: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  data: SearchResult[];
};

function norm(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function buildAddressSubtitle(address: any): string {
  return [address?.street, address?.city, address?.state, address?.zip]
    .filter(Boolean)
    .join(", ");
}

function monthLabelFromValue(value: string | undefined, locale: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleDateString(locale || "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function SearchScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const locale = i18n.language || "en";
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);

  // Pull the same lists the rest of the app already loads — no new endpoint.
  // Each call is independent and tolerant of a single failure so a partial
  // outage still searches whatever did load.
  const load = useCallback(async () => {
    setLoading(true);
    const [svcRes, addrRes, movingRes, budgetRes] = await Promise.all([
      api.get<any>("/api/services", { limit: "200" }),
      api.get<any>("/api/addresses", { limit: "200" }),
      api.get<any>("/api/moving"),
      api.get<any>("/api/budget"),
    ]);
    setServices(svcRes.data?.services || svcRes.data || []);
    setAddresses(addrRes.data?.addresses || addrRes.data || []);
    setPlans(movingRes.data?.plans || movingRes.data || []);
    setBudgets(budgetRes.data?.budgets || budgetRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Focus the field on mount so the keyboard is ready immediately.
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, []);

  // ── Build the per-domain result lists once, then filter client-side. ──
  const serviceResults = useMemo<SearchResult[]>(
    () =>
      services.map((service) => {
        const addressLabel =
          service.address?.nickname || service.address?.city || "";
        return {
          id: service.id,
          title: service.providerName || t("services.title"),
          subtitle: [service.category, addressLabel].filter(Boolean).join(" · "),
          haystack: [
            service.providerName,
            service.category,
            service.website,
            service.phone,
            addressLabel,
          ]
            .map(norm)
            .join(" "),
          route: { pathname: "/services/[id]", params: { id: service.id } },
        };
      }),
    [services, t],
  );

  const addressResults = useMemo<SearchResult[]>(
    () =>
      addresses.map((address) => ({
        id: address.id,
        title: address.nickname || buildAddressSubtitle(address) || t("addresses.title"),
        subtitle: buildAddressSubtitle(address),
        haystack: [
          address.nickname,
          address.street,
          address.city,
          address.state,
          address.zip,
        ]
          .map(norm)
          .join(" "),
        route: { pathname: "/addresses/[id]", params: { id: address.id } },
      })),
    [addresses, t],
  );

  const planResults = useMemo<SearchResult[]>(
    () =>
      plans.map((plan) => {
        const from = plan.fromAddress?.city || "";
        const to = plan.toAddress?.city || "";
        return {
          id: plan.id,
          title: `${from || "—"} → ${to || "—"}`,
          subtitle: [
            plan.fromAddress?.state,
            plan.toAddress?.state,
            plan.status,
          ]
            .filter(Boolean)
            .join(" · "),
          haystack: [
            from,
            to,
            plan.fromAddress?.state,
            plan.toAddress?.state,
            plan.fromAddress?.street,
            plan.toAddress?.street,
            plan.status,
          ]
            .map(norm)
            .join(" "),
          route: { pathname: "/moving/[id]", params: { id: plan.id } },
        };
      }),
    [plans],
  );

  const budgetResults = useMemo<SearchResult[]>(
    () =>
      budgets.map((budget) => {
        const monthLabel = monthLabelFromValue(budget.month, locale);
        const addressLabel = (() => {
          if (!budget.addressId) return "";
          const match = addresses.find((a) => a.id === budget.addressId);
          if (!match) return "";
          return match.nickname || [match.city, match.state].filter(Boolean).join(", ");
        })();
        return {
          id: budget.id,
          title: monthLabel || t("budget.title"),
          subtitle: [addressLabel, budget.notes].filter(Boolean).join(" · "),
          haystack: [monthLabel, addressLabel, budget.notes, budget.month]
            .map(norm)
            .join(" "),
          // Budgets have no per-row detail screen; the budget hub is the
          // natural destination.
          route: "/budget",
        };
      }),
    [budgets, addresses, locale, t],
  );

  const sections = useMemo<SearchSection[]>(() => {
    const q = query.trim().toLowerCase();
    const filter = (rows: SearchResult[]) =>
      q.length === 0 ? [] : rows.filter((row) => row.haystack.includes(q));
    const all: SearchSection[] = [
      { key: "services", title: t("search.sectionServices"), icon: Zap, data: filter(serviceResults) },
      { key: "addresses", title: t("search.sectionAddresses"), icon: MapPin, data: filter(addressResults) },
      { key: "plans", title: t("search.sectionPlans"), icon: Truck, data: filter(planResults) },
      { key: "budgets", title: t("search.sectionBudgets"), icon: DollarSign, data: filter(budgetResults) },
    ];
    return all.filter((section) => section.data.length > 0);
  }, [query, serviceResults, addressResults, planResults, budgetResults, t]);

  const totalResults = useMemo(
    () => sections.reduce((sum, section) => sum + section.data.length, 0),
    [sections],
  );

  const onPressResult = useCallback(
    (result: SearchResult) => {
      hapticLight();
      router.push(result.route);
    },
    [router],
  );

  const trimmed = query.trim();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
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
        <Text style={styles.title}>{t("search.title")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <SearchIcon size={22} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.heroKicker}>{t("search.heroKicker", { defaultValue: "SEARCH COMMAND" })}</Text>
          <Text style={styles.heroTitle}>{t("search.heroTitle", { defaultValue: "Find anything in your move" })}</Text>
          <Text style={styles.heroSub} numberOfLines={2}>
            {t("search.heroDescription", {
              defaultValue: "Search services, addresses, moving plans, and budget records from one focused surface.",
            })}
          </Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <SearchIcon size={16} color={theme.colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder={t("search.placeholder")}
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={t("search.a11y")}
            accessibilityHint={t("search.hint")}
          />
          {query.length > 0 ? (
            <TouchableOpacity
              onPress={() => setQuery("")}
              accessibilityRole="button"
              accessibilityLabel={t("common.clearSearch")}
            >
              <X size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.domainGrid}>
          {[
            { label: t("search.sectionServices"), value: services.length, Icon: Zap, tone: theme.colors.primary },
            { label: t("search.sectionAddresses"), value: addresses.length, Icon: MapPin, tone: theme.colors.emerald.text },
            { label: t("search.sectionPlans"), value: plans.length, Icon: Truck, tone: theme.colors.amber.text },
            { label: t("search.sectionBudgets"), value: budgets.length, Icon: DollarSign, tone: theme.colors.sky.text },
          ].map(({ label, value, Icon, tone }) => (
            <View key={label} style={styles.domainChip}>
              <Icon size={13} color={tone} />
              <Text style={styles.domainValue}>{value}</Text>
              <Text style={styles.domainLabel} numberOfLines={1}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {loading ? (
        <LoadingScreen />
      ) : trimmed.length === 0 ? (
        <EmptyState
          icon={<SearchIcon size={32} color={theme.colors.primary} />}
          title={t("search.prompt")}
          description={t("search.promptDescription")}
        />
      ) : totalResults === 0 ? (
        <EmptyState
          icon={<SearchIcon size={32} color={theme.colors.primary} />}
          title={t("search.empty")}
          description={t("search.emptyDescription", { query: trimmed })}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {t("search.resultCount", { count: totalResults })}
            </Text>
          }
          renderSectionHeader={({ section }) => {
            const Icon = (section as SearchSection).icon;
            return (
              <View style={styles.sectionHeader}>
                <Icon size={14} color={theme.colors.textTertiary} />
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
            );
          }}
          renderItem={({ item, index, section }) => {
            const SectionIcon = (section as SearchSection).icon;
            return (
              <ListEntrance index={index}>
                <TouchableOpacity
                  style={styles.resultRow}
                  activeOpacity={0.7}
                  onPress={() => onPressResult(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                >
                  <View style={styles.resultIcon}>
                    <SectionIcon size={16} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <Text style={styles.resultSubtitle} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <ChevronRight size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </ListEntrance>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
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
    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginHorizontal: 20,
      marginBottom: 12,
      padding: 16,
      borderRadius: theme.radius["2xl"],
      backgroundColor: theme.colors.glass.bg,
      borderWidth: 1,
      borderColor: theme.colors.glass.border,
      ...theme.shadow.glow,
    },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primaryFaded,
      borderWidth: 1,
      borderColor: theme.colors.primary + "30",
    },
    heroKicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: theme.colors.textTertiary },
    heroTitle: { marginTop: 3, fontSize: 18, fontWeight: "800", color: theme.colors.text },
    heroSub: { marginTop: 4, fontSize: 12, lineHeight: 17, color: theme.colors.textTertiary },
    searchRow: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    searchInput: { flex: 1, fontSize: 15, color: theme.colors.text, padding: 0 },
    domainGrid: { flexDirection: "row", gap: 8 },
    domainChip: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 2,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    domainValue: { fontSize: 13, fontWeight: "800", color: theme.colors.text, fontVariant: ["tabular-nums"] },
    domainLabel: { maxWidth: "100%", fontSize: 9.5, color: theme.colors.textTertiary },
    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    resultCount: {
      fontSize: 12,
      color: theme.colors.textTertiary,
      marginBottom: 12,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 16,
      marginBottom: 8,
      marginLeft: 2,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 8,
    },
    resultIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primaryFaded,
      borderWidth: 1,
      borderColor: theme.colors.primary + "28",
    },
    resultTitle: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
    resultSubtitle: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  });
