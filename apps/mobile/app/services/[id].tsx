import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Zap,
  Globe,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Calendar,
  Trash2,
  FileText,
  Edit,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError, hapticWarning } from "@/lib/haptics";

export default function ServiceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    const res = await api.get<any>(`/api/services/${id}`);
    if (res.error) {
      setError(res.error);
      return false;
    }
    if (res.data) {
      setService(res.data.service || res.data);
      setError(null);
    }
    return true;
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetch_();
    } finally {
      setLoading(false);
    }
  }, [fetch_]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch_();
    } finally {
      setRefreshing(false);
    }
  }, [fetch_]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = () => {
    hapticWarning();
    Alert.alert(t("services.deleteTitle"), t("services.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          const res = await api.delete(`/api/services/${id}`);
          if (!res.error) {
            hapticSuccess();
            router.back();
          } else {
            hapticError();
            Alert.alert(t("tickets.errorTitle"), res.error);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;
  if (!service) {
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
          title={error ? t("services.unavailable") : t("services.notFound")}
          message={error || t("services.removed")}
          onRetry={load}
        />
      </SafeAreaView>
    );
  }

  const infoRows = [
    service.address && {
      icon: MapPin,
      label: t("addresses.title"),
      value: service.address.nickname || `${service.address.city}, ${service.address.state}`,
    },
    service.monthlyCost > 0 && {
      icon: DollarSign,
      label: t("services.monthlyCost"),
      value: `$${service.monthlyCost.toLocaleString()}`,
      color: theme.colors.emerald.text,
    },
    service.billingCycle && {
      icon: Calendar,
      label: t("services.billingCycle"),
      value: t(`billingCycles.${service.billingCycle}`, { defaultValue: service.billingCycle.replace("_", " ") }),
    },
    service.phone && {
      icon: Phone,
      label: t("common.phone"),
      value: service.phone,
      onPress: () => Linking.openURL(`tel:${service.phone}`),
    },
    service.website && {
      icon: Globe,
      label: t("common.website"),
      value: service.website.replace(/^https?:\/\//, ""),
      onPress: () => Linking.openURL(service.website),
    },
    service.email && {
      icon: Mail,
      label: t("common.email"),
      value: service.email,
      onPress: () => Linking.openURL(`mailto:${service.email}`),
    },
    service.accountNumber && {
      icon: FileText,
      label: t("services.accountNumberShort"),
      value: service.accountNumber,
    },
  ].filter(Boolean) as any[];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {service.providerName}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Hero Card */}
        <Card variant="glow">
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Zap size={24} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{service.providerName}</Text>
              <Text style={styles.heroCat}>{t(`categories.${service.category}`, { defaultValue: service.category })}</Text>
            </View>
          </View>
          <View style={styles.heroBadges}>
            <UiBadge
              label={service.isActive ? t("services.statusActive") : t("services.statusInactive")}
              variant={service.isActive ? "success" : "neutral"}
            />
            {service.billingCycle && (
              <UiBadge label={t(`billingCycles.${service.billingCycle}`, { defaultValue: service.billingCycle.replace("_", " ") })} variant="info" />
            )}
          </View>
        </Card>

        {/* Info Rows */}
        <Card variant="default" style={{ marginTop: 16 }}>
          {infoRows.map((row, i) => {
            const Icon = row.icon;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.infoRow, i < infoRows.length - 1 && styles.infoRowBorder]}
                onPress={row.onPress}
                disabled={!row.onPress}
                activeOpacity={row.onPress ? 0.6 : 1}
              >
                <View style={styles.infoIcon}>
                  <Icon size={16} color={theme.colors.textSecondary} />
                </View>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text
                  style={[styles.infoValue, row.color && { color: row.color }, row.onPress && { color: theme.colors.primary }]}
                  numberOfLines={1}
                >
                  {row.value}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Card>

        {/* Notes */}
        {service.notes ? (
          <>
            <Text style={styles.sectionTitle}>{t("services.notes")}</Text>
            <Card variant="default">
              <Text style={styles.notes}>{service.notes}</Text>
            </Card>
          </>
        ) : null}

        {/* Actions */}
        <TouchableOpacity style={styles.editBtn} onPress={() => router.push({ pathname: "/services/[id]/edit", params: { id: String(id) } })}>
          <Edit size={16} color={theme.colors.primary} />
          <Text style={styles.editText}>{t("services.editTitle")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Trash2 size={16} color={theme.colors.error} />
          <Text style={styles.deleteText}>{t("services.deleteService")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: theme.colors.primaryFaded, alignItems: "center", justifyContent: "center",
  },
  heroName: { fontSize: 20, fontWeight: "800", color: theme.colors.text },
  heroCat: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 2 },
  heroBadges: { flexDirection: "row", gap: 6, marginTop: 14 },
  infoRow: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 4,
  },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  infoIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center",
  },
  infoLabel: { fontSize: 13, color: theme.colors.textTertiary, width: 80 },
  infoValue: { flex: 1, fontSize: 14, fontWeight: "600", color: theme.colors.text, textAlign: "right" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text, marginTop: 24, marginBottom: 10 },
  notes: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  editBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 24, paddingVertical: 14, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primaryFaded, borderWidth: 1, borderColor: "rgba(127, 182, 232,0.2)",
  },
  editText: { fontSize: 14, fontWeight: "600", color: theme.colors.primary },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 12, paddingVertical: 14, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: "rgba(240, 140, 142, 0.20)",
  },
  deleteText: { fontSize: 14, fontWeight: "600", color: theme.colors.error },
});
