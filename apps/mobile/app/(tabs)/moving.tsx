import React, { useEffect, useState, useCallback, useMemo } from "react";
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
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ListEntrance } from "@/components/ui/ListEntrance";
import { PressableScale } from "@/components/ui/PressableScale";
import { normalizeMovingPlanStatus } from "@locateflow/shared";

const statusVariant: Record<string, "primary" | "success" | "warning" | "error" | "neutral"> = {
  PLANNING: "neutral",
  IN_PROGRESS: "primary",
  COMPLETED: "success",
  CANCELED: "error",
  CANCELLED: "error",
};

export default function MovingScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    const res = await api.get<any>("/api/moving");
    if (res.error) {
      setError(res.error);
      return false;
    }
    if (res.data) {
      setPlans(res.data.plans || []);
      setError(null);
    }
    return true;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchPlans();
    } finally {
      setLoading(false);
    }
  }, [fetchPlans]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchPlans();
    } finally {
      setRefreshing(false);
    }
  }, [fetchPlans]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t("moving.title")}</Text>
            <Text style={styles.subtitle}>{t("common.loading")}</Text>
          </View>
          <View style={styles.addButton}>
            <Plus size={20} color="#fff" />
          </View>
        </View>
        <View style={[styles.scrollContent, styles.list]}>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t("moving.title")}</Text>
          <Text style={styles.subtitle}>{plans.length}</Text>
        </View>
        <PressableScale
          style={styles.addButton}
          onPress={() => router.push("/moving/new")}
          accessibilityLabel={t("moving.newPlan")}
        >
          <Plus size={20} color="#fff" />
        </PressableScale>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {error && plans.length > 0 ? (
          <View style={{ marginHorizontal: 16, marginBottom: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.rose.text }}>
            <Text style={{ color: theme.colors.rose.text, fontSize: 12, textAlign: "center" }}>{error}</Text>
          </View>
        ) : null}
        {error && plans.length === 0 ? (
          <ErrorState message={error} onRetry={load} />
        ) : plans.length === 0 ? (
          <EmptyState
            mascot="kid"
            icon={<Truck size={32} color={theme.colors.primary} />}
            title={t("moving.checklistEmpty")}
            description={t("moving.subtitle")}
            actionLabel={t("moving.newPlan")}
            onAction={() => router.push("/moving/new")}
          />
        ) : (
          <View style={styles.list}>
            {plans.map((plan: any, index: number) => {
              const normalizedStatus = normalizeMovingPlanStatus(plan.status);
              const daysUntil = Math.ceil((new Date(plan.moveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

              return (
                <ListEntrance key={plan.id} index={index}>
                <Card variant="default" onPress={() => router.push({ pathname: "/moving/[id]", params: { id: plan.id } })}>
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
                </ListEntrance>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 28, fontWeight: "800", color: theme.colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", ...theme.shadow.glow },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  list: { gap: 12 },
  planTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  planIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.colors.primaryFaded, borderWidth: 1, borderColor: "rgba(127, 182, 232,0.2)", alignItems: "center", justifyContent: "center" },
  planTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  planMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  planDate: { fontSize: 12, color: theme.colors.textTertiary },
  daysLeft: { fontSize: 11, color: theme.colors.amber.text, fontWeight: "600", marginLeft: 6 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  addressItem: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  addressText: { fontSize: 11, color: theme.colors.textTertiary },
});
