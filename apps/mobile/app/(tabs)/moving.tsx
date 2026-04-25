import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Truck,
  Plus,
  Calendar,
  ArrowRight,
  MapPin,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { normalizeMovingPlanStatus } from "@locateflow/shared";

const statusVariant: Record<string, "primary" | "success" | "warning" | "error" | "neutral"> = {
  PLANNING: "neutral",
  IN_PROGRESS: "primary",
  COMPLETED: "success",
  CANCELED: "error",
  CANCELLED: "error",
};

export default function MovingScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPlans = useCallback(async () => {
    const res = await api.get<any>("/api/moving");
    if (res.data) setPlans(res.data.plans || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchPlans();
    setLoading(false);
  }, [fetchPlans]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPlans();
    setRefreshing(false);
  }, [fetchPlans]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t("moving.title")}</Text>
          <Text style={styles.subtitle}>{plans.length}</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/moving/new" as any)}
          activeOpacity={0.7}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {plans.length === 0 ? (
          <EmptyState
            icon={<Truck size={32} color={theme.colors.primary} />}
            title={t("moving.checklistEmpty")}
            description={t("moving.subtitle")}
            actionLabel={t("moving.newPlan")}
            onAction={() => router.push("/moving/new" as any)}
          />
        ) : (
          <View style={styles.list}>
            {plans.map((plan: any) => {
              const normalizedStatus = normalizeMovingPlanStatus(plan.status);
              const daysUntil = Math.ceil((new Date(plan.moveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

              return (
                <Card key={plan.id} variant="default" onPress={() => router.push(`/moving/${plan.id}` as any)}>
                  <View style={styles.planTop}>
                    <View style={styles.planIcon}>
                      <Truck size={20} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitle}>
                        {plan.fromAddress?.city || "—"} → {plan.toAddress?.city || "—"}
                      </Text>
                      <View style={styles.planMeta}>
                        <Calendar size={12} color={theme.colors.textMuted} />
                        <Text style={styles.planDate}>
                          {new Date(plan.moveDate).toLocaleDateString(i18n.language || "en", { month: "short", day: "numeric", year: "numeric" })}
                        </Text>
                        {daysUntil > 0 && (
                          <Text style={styles.daysLeft}>{daysUntil}d</Text>
                        )}
                      </View>
                    </View>
                    <UiBadge label={normalizedStatus.replace("_", " ")} variant={statusVariant[normalizedStatus] || "neutral"} />
                  </View>

                  {/* Addresses */}
                  <View style={styles.addressRow}>
                    <View style={styles.addressItem}>
                      <MapPin size={12} color={theme.colors.textMuted} />
                      <Text style={styles.addressText} numberOfLines={1}>
                        {plan.fromAddress?.street || t("moving.fromAddress")}, {plan.fromAddress?.state || ""}
                      </Text>
                    </View>
                    <ArrowRight size={12} color={theme.colors.textMuted} />
                    <View style={styles.addressItem}>
                      <MapPin size={12} color={theme.colors.emerald.text} />
                      <Text style={styles.addressText} numberOfLines={1}>
                        {plan.toAddress?.street || t("moving.toAddress")}, {plan.toAddress?.state || ""}
                      </Text>
                    </View>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 28, fontWeight: "800", color: theme.colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", ...theme.shadow.glow },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  list: { gap: 12 },
  planTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  planIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.colors.primaryFaded, borderWidth: 1, borderColor: "rgba(249,115,22,0.2)", alignItems: "center", justifyContent: "center" },
  planTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  planMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  planDate: { fontSize: 12, color: theme.colors.textTertiary },
  daysLeft: { fontSize: 11, color: theme.colors.amber.text, fontWeight: "600", marginLeft: 6 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  addressItem: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  addressText: { fontSize: 11, color: theme.colors.textTertiary },
});
