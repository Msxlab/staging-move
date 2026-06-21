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
import { useAppTheme, type Theme } from "@/lib/theme";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
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
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <CategoryIcon emoji={getCategoryIcon(provider.category)} size={22} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroKicker}>LOCAL PROVIDER</Text>
              <Text style={styles.heroName}>{provider.name}</Text>
              <Text style={styles.heroMeta}>{categoryLabel}</Text>
            </View>
          </View>
          <View style={styles.badgeRow}>
            <Badge label={t("customProviders.userAddedBadge")} variant="info" />
            <Badge label={t("providers.manualTrackingOnly")} variant="warning" />
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{rows.length}</Text>
              <Text style={styles.heroStatLabel}>contacts</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{provider.services?.length || 0}</Text>
              <Text style={styles.heroStatLabel}>linked</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue} numberOfLines={1}>{reviewStatus.replace(/_/g, " ")}</Text>
              <Text style={styles.heroStatLabel}>status</Text>
            </View>
          </View>
          <Text style={styles.caveat}>
            {provider.availabilityCaveat || t("customProviders.privateRecordHint")}
          </Text>
        </View>

        {provider.description ? (
          <>
            <Text style={styles.sectionTitle}>{t("common.description")}</Text>
            <Card variant="default"><Text style={styles.bodyText}>{provider.description}</Text></Card>
          </>
        ) : null}

        {rows.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>{t("common.contact")}</Text>
            <Card variant="default">
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
                    <View style={styles.infoIcon}><Icon size={16} color={theme.colors.textSecondary} /></View>
                    <Text style={styles.infoLabel}>{row.label}</Text>
                    <Text style={[styles.infoValue, row.onPress && { color: theme.colors.primary }]} numberOfLines={1}>{row.value}</Text>
                  </TouchableOpacity>
                );
              })}
            </Card>
          </>
        ) : null}

        {provider.notes ? (
          <>
            <Text style={styles.sectionTitle}>{t("services.notes")}</Text>
            <Card variant="default"><Text style={styles.bodyText}>{provider.notes}</Text></Card>
          </>
        ) : null}

        {provider.services?.length ? (
          <>
            <Text style={styles.sectionTitle}>{t("customProviders.linkedServices")}</Text>
            <Card variant="default">
              {provider.services.map((service, index) => (
                <TouchableOpacity
                  key={service.id}
                  style={[styles.serviceRow, index < provider.services!.length - 1 && styles.infoRowBorder]}
                  onPress={() => router.push({ pathname: "/services/[id]", params: { id: service.id } })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName}>{service.providerName}</Text>
                    <Text style={styles.serviceMeta}>{t(`categories.${service.category}`, { defaultValue: service.category.replace(/_/g, " ") })}</Text>
                  </View>
                  <Badge label={service.isActive ? t("services.statusActive") : t("services.statusInactive")} variant={service.isActive ? "success" : "neutral"} />
                </TouchableOpacity>
              ))}
            </Card>
          </>
        ) : null}

        <TouchableOpacity style={styles.editBtn} onPress={() => router.push({ pathname: "/custom-providers/[id]/edit", params: { id: provider.id } })}>
          <Edit size={16} color={theme.colors.primary} />
          <Text style={styles.editText}>{t("customProviders.edit")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={deleteProvider}>
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
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text, flex: 1, textAlign: "center" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { color: theme.colors.textTertiary },
  hero: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.highlight,
    ...theme.shadow.sm,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: theme.colors.primaryFaded, borderWidth: 1, borderColor: theme.colors.primary + "33", alignItems: "center", justifyContent: "center" },
  heroKicker: { fontSize: 10, fontWeight: "800", letterSpacing: 0, textTransform: "uppercase", color: theme.colors.accent },
  heroName: { fontSize: 21, fontWeight: "800", color: theme.colors.text, marginTop: 3, letterSpacing: 0 },
  heroMeta: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 },
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
  heroStatValue: { fontSize: 13, fontWeight: "800", color: theme.colors.text },
  heroStatLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0,
    color: theme.colors.textTertiary,
    textTransform: "uppercase",
    marginTop: 3,
  },
  caveat: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text, marginTop: 24, marginBottom: 10 },
  bodyText: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 4 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  infoIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 13, color: theme.colors.textTertiary, width: 72 },
  infoValue: { flex: 1, fontSize: 14, fontWeight: "600", color: theme.colors.text, textAlign: "right" },
  serviceRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  serviceName: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  serviceMeta: { color: theme.colors.textTertiary, fontSize: 12, marginTop: 2 },
  editBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24, paddingVertical: 14, borderRadius: theme.radius.lg, backgroundColor: theme.colors.primaryFaded, borderWidth: 1, borderColor: theme.colors.orange.border },
  editText: { fontSize: 14, fontWeight: "600", color: theme.colors.primary },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, paddingVertical: 14, borderRadius: theme.radius.lg, backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: theme.colors.error + "33" },
  deleteText: { fontSize: 14, fontWeight: "600", color: theme.colors.error },
});
