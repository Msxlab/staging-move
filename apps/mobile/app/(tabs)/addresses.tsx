import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MapPin,
  Home,
  Briefcase,
  Palmtree,
  Plus,
  Star,
  Trash2,
  Edit,
  Zap,
  ChevronRight,
  Package,
  Clock,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError, hapticWarning } from "@/lib/haptics";
import type { Address } from "@locateflow/shared";

const typeIcons: Record<string, any> = {
  HOME: Home,
  WORK: Briefcase,
  VACATION: Palmtree,
  STORAGE: Package,
  TEMPORARY: Clock,
};

export default function AddressesScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    const res = await api.get<any>("/api/addresses");
    if (res.error) {
      setError(res.error);
      return false;
    }
    if (res.data) {
      setAddresses(res.data.addresses || []);
      setError(null);
    }
    return true;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchAddresses();
    } finally {
      setLoading(false);
    }
  }, [fetchAddresses]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAddresses();
    } finally {
      setRefreshing(false);
    }
  }, [fetchAddresses]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = useCallback(
    (id: string, nickname: string) => {
      hapticWarning();
      Alert.alert(
        t("addresses.delete"),
        t("addresses.deleteConfirm", { defaultValue: `Delete "${nickname || "this"}"?` }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              const res = await api.delete(`/api/addresses/${id}`);
              if (!res.error) {
                hapticSuccess();
                setAddresses((prev) => prev.filter((a) => a.id !== id));
              } else {
                hapticError();
                Alert.alert(t("common.retry"), res.error);
              }
            },
          },
        ]
      );
    },
    [t]
  );

  if (loading) return <LoadingScreen />;

  const totalMonthly = addresses.reduce(
    (sum, a) =>
      sum +
      (a.services?.reduce((s, sv: any) => s + (sv.monthlyCost || 0), 0) || 0),
    0
  );
  const totalServices = addresses.reduce(
    (sum, a) => sum + (a.services?.length || 0),
    0
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t("addresses.title")}</Text>
          <Text style={styles.subtitle}>
            {addresses.length} · {totalServices} {t("services.title").toLowerCase()} · {
              new Intl.NumberFormat(i18n.language || "en", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(totalMonthly)
            }
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/addresses/new")}
          activeOpacity={0.7}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {error && addresses.length === 0 ? (
          <ErrorState message={error} onRetry={load} />
        ) : addresses.length === 0 ? (
          <EmptyState
            icon={<MapPin size={32} color={theme.colors.primary} />}
            title={t("addresses.empty")}
            description={t("addresses.emptyDescription")}
            actionLabel={t("addresses.newTitle")}
            onAction={() => router.push("/addresses/new")}
          />
        ) : (
          <View style={styles.list}>
            {addresses.map((address) => {
              const TypeIcon = typeIcons[address.type] || MapPin;
              const servicesCount = address.services?.length || 0;
              const monthlyCost =
                address.services?.reduce(
                  (sum: number, s: any) => sum + (s.monthlyCost || 0),
                  0
                ) || 0;

              return (
                <Card
                  key={address.id}
                  variant="default"
                  onPress={() =>
                    router.push({ pathname: "/addresses/[id]", params: { id: address.id } })
                  }
                >
                  {/* Top Row */}
                  <View style={styles.cardTop}>
                    <View style={styles.cardIconRow}>
                      <View style={styles.typeIcon}>
                        <TypeIcon size={20} color={theme.colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                          <Text style={styles.cardTitle} numberOfLines={1}>
                            {address.nickname || t("addresses.title")}
                          </Text>
                          {address.isPrimary && (
                            <Star
                              size={14}
                              color={theme.colors.amber.text}
                              fill={theme.colors.amber.text}
                            />
                          )}
                        </View>
                        <Text style={styles.cardAddress} numberOfLines={1}>
                          {address.street}, {address.city}, {address.state}{" "}
                          {address.zip}
                        </Text>
                      </View>
                    </View>
                    <UiBadge
                      label={
                        address.ownership === "OWNER"
                          ? t("addresses.nickname")
                          : t("addresses.title")
                      }
                      variant={
                        address.ownership === "OWNER" ? "success" : "info"
                      }
                    />
                  </View>

                  {/* Stats */}
                  <View style={styles.cardStats}>
                    <Text style={styles.statText}>
                      <Text style={styles.statBold}>{servicesCount}</Text>{" "}
                      {t("services.title").toLowerCase()}
                    </Text>
                    <Text style={styles.statText}>
                      <Text style={styles.statGreen}>
                        {new Intl.NumberFormat(i18n.language || "en", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(monthlyCost)}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.cardInsights}>
                    <Text style={styles.insightText} numberOfLines={1}>
                      {servicesCount > 0
                        ? `${servicesCount} ${t("services.title").toLowerCase()}`
                        : t("services.empty")}
                    </Text>
                    <TouchableOpacity
                      style={styles.viewServicesBtn}
                      onPress={() => router.push({ pathname: "/(tabs)/services", params: { addressId: address.id } })}
                    >
                      <Text style={styles.viewServicesText}>{t("common.view")}</Text>
                      <ChevronRight size={14} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Actions */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() =>
                        router.push({ pathname: "/addresses/[id]/edit", params: { id: address.id } })
                      }
                    >
                      <Edit size={14} color={theme.colors.textTertiary} />
                      <Text style={styles.actionText}>{t("common.edit")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() =>
                        router.push({ pathname: "/services/new", params: { addressId: address.id } })
                      }
                    >
                      <Zap size={14} color={theme.colors.textTertiary} />
                      <Text style={styles.actionText}>{t("services.newTitle")}</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() =>
                        handleDelete(address.id, address.nickname || "")
                      }
                    >
                      <Trash2 size={14} color={theme.colors.error} />
                    </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.glow,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  list: { gap: 12 },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardIconRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  typeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  cardAddress: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 },
  cardStats: {
    flexDirection: "row",
    gap: 16,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  cardInsights: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  statText: { fontSize: 13, color: theme.colors.textTertiary },
  statBold: { fontWeight: "600", color: theme.colors.textSecondary },
  statGreen: { fontWeight: "700", color: theme.colors.emerald.text },
  insightText: { flex: 1, fontSize: 12, color: theme.colors.textTertiary },
  viewServicesBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewServicesText: { fontSize: 12, fontWeight: "700", color: theme.colors.primary },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionText: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: "500" },
});
