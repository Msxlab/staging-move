import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  MapPin,
  Home,
  Briefcase,
  Palmtree,
  Package,
  Clock,
  Edit,
  Trash2,
  Star,
  Zap,
  Plus,
} from "lucide-react-native";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError, hapticWarning } from "@/lib/haptics";

const typeIcons: Record<string, any> = {
  HOME: Home, WORK: Briefcase, VACATION: Palmtree, STORAGE: Package, TEMPORARY: Clock,
};

export default function AddressDetailScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [address, setAddress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch_ = useCallback(async () => {
    const res = await api.get<any>(`/api/addresses/${id}`);
    if (res.data) setAddress(res.data.address || res.data);
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    await fetch_();
    setLoading(false);
  }, [fetch_]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetch_();
    setRefreshing(false);
  }, [fetch_]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = () => {
    hapticWarning();
    Alert.alert(t("addresses.delete"), t("addresses.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          const res = await api.delete(`/api/addresses/${id}`);
          if (!res.error) {
            hapticSuccess();
            router.back();
          } else {
            hapticError();
            Alert.alert(t("common.retry"), t("addresses.deleteFailed"));
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;
  if (!address) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("common.notFound")}</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: theme.colors.textTertiary }}>{t("addresses.notFound")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const TypeIcon = typeIcons[address.type] || MapPin;
  const services = address.services || [];
  const totalMonthlyCost = services.reduce((sum: number, s: any) => sum + (s.monthlyCost || 0), 0);
  const addressTypeLabel =
    {
      HOME: t("addresses.type_primary"),
      WORK: t("addresses.type_secondary"),
      VACATION: t("addresses.type_vacation"),
      TEMPORARY: t("addresses.type_temporary"),
      STORAGE: t("addresses.type_storage"),
      OTHER: t("addresses.type_other"),
    }[String(address.type || "OTHER")] || address.type;
  const ownershipLabel =
    {
      OWNER: t("addresses.ownership_owner"),
      RENTER: t("addresses.ownership_renter"),
      FAMILY: t("addresses.ownership_family"),
      OTHER: t("addresses.type_other"),
    }[String(address.ownership || "OTHER")] || address.ownership;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {address.nickname || t("addresses.title")}
        </Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/addresses/[id]/edit", params: { id: String(id) } })}
          style={styles.backBtn}
        >
          <Edit size={18} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Address Info Card */}
        <Card variant="default">
          <View style={styles.infoRow}>
            <View style={styles.typeIcon}>
              <TypeIcon size={22} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addressStreet}>{address.street}</Text>
              {address.street2 ? <Text style={styles.addressSub}>{address.street2}</Text> : null}
              <Text style={styles.addressSub}>
                {address.city}, {address.state} {address.zip}
              </Text>
            </View>
          </View>
          <View style={styles.badges}>
            <UiBadge label={addressTypeLabel} variant="info" />
            <UiBadge
              label={ownershipLabel}
              variant={address.ownership === "OWNER" ? "success" : "neutral"}
            />
            {address.isPrimary && <UiBadge label={t("addresses.primary")} variant="warning" />}
          </View>
        </Card>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{services.length}</Text>
            <Text style={styles.statLabel}>{t("services.title")}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: theme.colors.emerald.text }]}>
              ${totalMonthlyCost.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>{t("services.billingCycle_monthly")}</Text>
          </View>
        </View>

        <Card variant="default" style={{ marginTop: 14 }}>
          <Text style={styles.budgetLabel}>{t("budget.monthlySnapshot")}</Text>
          <Text style={styles.budgetValue}>${totalMonthlyCost.toLocaleString()}/mo</Text>
          <Text style={styles.budgetHint}>
            {t("budget.monthlySnapshotHint")}
          </Text>
        </Card>

        {/* Services List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("services.title")}</Text>
          <TouchableOpacity
            style={styles.addSmall}
            onPress={() => router.push({ pathname: "/services/new", params: { addressId: String(id) } })}
          >
            <Plus size={16} color={theme.colors.primary} />
            <Text style={styles.addSmallText}>{t("common.add")}</Text>
          </TouchableOpacity>
        </View>

        {services.length === 0 ? (
          <Card variant="default">
            <Text style={{ color: theme.colors.textTertiary, textAlign: "center", paddingVertical: 20 }}>
              {t("services.emptyForAddress")}
            </Text>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {services.map((s: any) => (
              <Card
                key={s.id}
                variant="default"
                onPress={() => router.push({ pathname: "/services/[id]", params: { id: s.id } })}
              >
                <View style={styles.serviceRow}>
                  <Zap size={16} color={theme.colors.cyan.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName}>{s.providerName || s.provider?.name || t("services.newTitle")}</Text>
                    <Text style={styles.serviceCat}>{s.category}</Text>
                  </View>
                  {s.monthlyCost > 0 && (
                    <Text style={styles.serviceCost}>${s.monthlyCost}/mo</Text>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Delete */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel={t("addresses.delete")}
          accessibilityHint={t("addresses.deleteHint")}
        >
          <Trash2 size={16} color={theme.colors.error} />
          <Text style={styles.deleteText}>{t("addresses.delete")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
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
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text, flex: 1, textAlign: "center" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  typeIcon: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: theme.colors.primaryFaded, alignItems: "center", justifyContent: "center",
  },
  addressStreet: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
  addressSub: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 },
  badges: { flexDirection: "row", gap: 6, marginTop: 14 },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  statBox: {
    flex: 1, alignItems: "center", paddingVertical: 16,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.xl,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
  statLabel: { fontSize: 11, color: theme.colors.textTertiary, marginTop: 4 },
  budgetLabel: { fontSize: 12, fontWeight: "600", color: theme.colors.textSecondary },
  budgetValue: { fontSize: 26, fontWeight: "800", color: theme.colors.emerald.text, marginTop: 6 },
  budgetHint: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 8, lineHeight: 18 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 24, marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.text },
  addSmall: { flexDirection: "row", alignItems: "center", gap: 4 },
  addSmallText: { fontSize: 13, fontWeight: "600", color: theme.colors.primary },
  serviceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  serviceName: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  serviceCat: { fontSize: 11, color: theme.colors.textTertiary },
  serviceCost: { fontSize: 14, fontWeight: "700", color: theme.colors.emerald.text },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 32, paddingVertical: 14, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: "rgba(240, 140, 142, 0.20)",
  },
  deleteText: { fontSize: 14, fontWeight: "600", color: theme.colors.error },
});
