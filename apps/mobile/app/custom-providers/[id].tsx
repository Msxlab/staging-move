import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Edit,
  Globe,
  Mail,
  MapPin,
  Phone,
  Trash2,
} from "lucide-react-native";
import { api } from "@/lib/api";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { HeroCard, MoveCard, SectionHeader, Pill } from "@/components/move";
import { hapticError, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { getCategoryIcon } from "@/lib/recommendation-engine";
import { asObject } from "@/lib/offline-cache";
import { detailCacheKey, useDetailOfflineCache } from "@/lib/use-detail-offline-cache";

interface CustomProvider {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  notes?: string | null;
  providerType?: string | null;
  adminReviewStatus?: string | null;
  availabilityCaveat?: string;
  services?: Array<{ id: string; providerName: string; category: string; isActive: boolean }>;
}

function readCustomProviderDetailCache(raw: unknown): CustomProvider | null {
  return asObject(raw) as CustomProvider | null;
}

export default function CustomProviderDetailScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const {
    data: provider,
    setCachedData: setProvider,
    loading,
    setLoading,
    startForegroundLoad,
  } = useDetailOfflineCache<CustomProvider>(
    detailCacheKey("custom-provider", id),
    readCustomProviderDetailCache,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProvider = useCallback(async () => {
    const res = await api.get<{ provider?: CustomProvider }>(`/api/custom-providers/${id}`);
    if (res.error) {
      setError(res.error);
      return false;
    }
    if (res.data?.provider) {
      setProvider(res.data.provider);
      setError(null);
    }
    return true;
  }, [id]);

  useEffect(() => {
    (async () => {
      startForegroundLoad();
      await loadProvider();
      setLoading(false);
    })();
  }, [loadProvider, setLoading, startForegroundLoad]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProvider();
    setRefreshing(false);
  }, [loadProvider]);

  const deleteProvider = () => {
    if (!provider) return;
    hapticWarning();
    Alert.alert(
      t("customProviders.deleteTitle"),
      t("customProviders.deleteDescription"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            const res = await api.delete(`/api/custom-providers/${provider.id}`);
            if (res.error) {
              hapticError();
              Alert.alert(t("common.retry"), res.error);
              return;
            }
            hapticSuccess();
            router.back();
          },
        },
      ],
    );
  };

  if (loading) return <LoadingScreen />;

  if (!provider) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("common.notFound")}</Text>
          <View style={{ width: 44 }} />
        </View>
        <ErrorState
          title={error ? t("customProviders.unavailable") : t("customProviders.notFound")}
          message={error || t("customProviders.removedHint")}
          onRetry={loadProvider}
        />
      </SafeAreaView>
    );
  }

  const address = [provider.addressLine1, provider.addressLine2, provider.city, provider.state, provider.zipCode]
    .filter(Boolean)
    .join(", ");

  const rows = [
    provider.phone && { icon: Phone, label: t("common.phone"), value: provider.phone, onPress: () => Linking.openURL(`tel:${provider.phone}`) },
    provider.website && { icon: Globe, label: t("common.website"), value: provider.website.replace(/^https?:\/\//, ""), onPress: () => Linking.openURL(provider.website!) },
    provider.email && { icon: Mail, label: t("common.email"), value: provider.email, onPress: () => Linking.openURL(`mailto:${provider.email}`) },
    address && { icon: MapPin, label: t("addresses.title"), value: address },
  ].filter(Boolean) as Array<{ icon: any; label: string; value: string; onPress?: () => void }>;
  const categoryLabel = t(`categories.${provider.category}`, { defaultValue: provider.category.replace(/_/g, " ") });
  const reviewStatus = provider.adminReviewStatus || "PRIVATE";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{t("customProviders.singularTitle")}</Text>
        <TouchableOpacity onPress={() => router.push({ pathname: "/custom-providers/[id]/edit", params: { id: provider.id } })} style={styles.iconBtn}>
          <Edit size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <HeroCard style={styles.hero} padding={16} radius={theme.radius.xl}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <CategoryIcon emoji={getCategoryIcon(provider.category)} size={22} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroKicker}>{t("customProviders.singularTitle")}</Text>
              <Text style={styles.heroName} numberOfLines={2}>{provider.name}</Text>
              <Text style={styles.heroMeta} numberOfLines={1}>{categoryLabel}</Text>
            </View>
          </View>
          <View style={styles.badgeRow}>
            <Pill label={t("customProviders.userAddedBadge")} tone="info" />
            <Pill label={t("providers.manualTrackingOnly")} tone="warning" />
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{rows.length}</Text>
              <Text style={styles.heroStatLabel}>{t("common.contact")}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{provider.services?.length || 0}</Text>
              <Text style={styles.heroStatLabel}>{t("customProviders.linkedServices")}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue} numberOfLines={1}>{reviewStatus.replace(/_/g, " ")}</Text>
              <Text style={styles.heroStatLabel}>{t("common.status", { defaultValue: "Status" })}</Text>
            </View>
          </View>
          <Text style={styles.caveat}>
            {provider.availabilityCaveat || t("customProviders.privateRecordHint")}
          </Text>
        </HeroCard>

        {provider.description ? (
          <>
            <SectionHeader label={t("common.description")} style={styles.sectionHeader} />
            <MoveCard padding={14} radius={theme.radius.xl}><Text style={styles.bodyText}>{provider.description}</Text></MoveCard>
          </>
        ) : null}

        {rows.length > 0 ? (
          <>
            <SectionHeader label={t("common.contact")} style={styles.sectionHeader} />
            <MoveCard padding={14} radius={theme.radius.xl}>
              {rows.map((row, index) => {
                const Icon = row.icon;
                return (
                  <TouchableOpacity
                    key={row.label}
                    style={[styles.infoRow, index < rows.length - 1 && styles.infoRowBorder]}
                    onPress={row.onPress}
                    disabled={!row.onPress}
                    activeOpacity={row.onPress ? 0.6 : 1}
                  >
                    <View style={styles.infoIcon}><Icon size={16} color={theme.colors.dim} /></View>
                    <Text style={styles.infoLabel}>{row.label}</Text>
                    <Text style={[styles.infoValue, row.onPress && { color: theme.colors.primary }]} numberOfLines={1}>{row.value}</Text>
                  </TouchableOpacity>
                );
              })}
            </MoveCard>
          </>
        ) : null}

        {provider.notes ? (
          <>
            <SectionHeader label={t("services.notes")} style={styles.sectionHeader} />
            <MoveCard padding={14} radius={theme.radius.xl}><Text style={styles.bodyText}>{provider.notes}</Text></MoveCard>
          </>
        ) : null}

        {provider.services?.length ? (
          <>
            <SectionHeader label={t("customProviders.linkedServices")} style={styles.sectionHeader} />
            <MoveCard padding={14} radius={theme.radius.xl}>
              {provider.services.map((service, index) => (
                <TouchableOpacity
                  key={service.id}
                  style={[styles.serviceRow, index < provider.services!.length - 1 && styles.infoRowBorder]}
                  onPress={() => router.push({ pathname: "/services/[id]", params: { id: service.id } })}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.serviceName} numberOfLines={1}>{service.providerName}</Text>
                    <Text style={styles.serviceMeta} numberOfLines={1}>{t(`categories.${service.category}`, { defaultValue: service.category.replace(/_/g, " ") })}</Text>
                  </View>
                  <Pill label={service.isActive ? t("services.statusActive") : t("services.statusInactive")} tone={service.isActive ? "success" : "muted"} />
                </TouchableOpacity>
              ))}
            </MoveCard>
          </>
        ) : null}

        <TouchableOpacity style={styles.editBtn} onPress={() => router.push({ pathname: "/custom-providers/[id]/edit", params: { id: provider.id } })} activeOpacity={0.85}>
          <Edit size={16} color={theme.colors.primary} />
          <Text style={styles.editText}>{t("customProviders.edit")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={deleteProvider} activeOpacity={0.85}>
          <Trash2 size={16} color={theme.colors.error} />
          <Text style={styles.deleteText}>{t("customProviders.delete")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.accentSoft, borderWidth: 1, borderColor: theme.colors.accentBorder, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text, flex: 1, textAlign: "center" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  hero: {
    marginBottom: 4,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: theme.colors.accentSoft, borderWidth: 1, borderColor: theme.colors.accentBorder, alignItems: "center", justifyContent: "center" },
  heroKicker: { fontSize: 10, fontFamily: fonts.sansBold, letterSpacing: 1.4, textTransform: "uppercase", color: theme.colors.primary },
  heroName: { fontSize: 21, fontFamily: fonts.serifBold, color: theme.colors.text, marginTop: 3 },
  heroMeta: { fontSize: 13, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 2 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  heroStats: { flexDirection: "row", gap: 8, marginTop: 14 },
  heroStat: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    padding: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
  },
  heroStatValue: { fontSize: 13, fontFamily: fonts.sansBold, color: theme.colors.text },
  heroStatLabel: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    letterSpacing: 0.6,
    color: theme.colors.faint,
    textTransform: "uppercase",
    marginTop: 3,
  },
  caveat: { color: theme.colors.dim, fontSize: 13, fontFamily: fonts.sans, lineHeight: 20, marginTop: 12 },
  sectionHeader: { marginTop: 22, marginBottom: 10, marginLeft: 2 },
  bodyText: { color: theme.colors.dim, fontSize: 14, fontFamily: fonts.sans, lineHeight: 20 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 4 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  infoIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.colors.accentSoft, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 13, fontFamily: fonts.sans, color: theme.colors.faint, width: 72 },
  infoValue: { flex: 1, fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.text, textAlign: "right" },
  serviceRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  serviceName: { color: theme.colors.text, fontSize: 14, fontFamily: fonts.sansBold },
  serviceMeta: { color: theme.colors.faint, fontSize: 12, fontFamily: fonts.sans, marginTop: 2 },
  editBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24, paddingVertical: 14, borderRadius: theme.radius.lg, backgroundColor: theme.colors.accentSoft, borderWidth: 1, borderColor: theme.colors.accentBorder },
  editText: { fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.primary },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, paddingVertical: 14, borderRadius: theme.radius.lg, backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: theme.colors.error + "33" },
  deleteText: { fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.error },
});
