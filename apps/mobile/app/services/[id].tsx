import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  ChevronRight,
  Globe,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Calendar,
  CalendarClock,
  RefreshCw,
  Trash2,
  FileText,
  Edit,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { PressableScale } from "@/components/ui/PressableScale";
import { ServiceLogoMark } from "@/components/services/ServiceLogoMark";
import { hapticSuccess, hapticError, hapticWarning } from "@/lib/haptics";
import { formatCurrency } from "@/lib/format";
import {
  getCategoryIcon,
  getCategoryLabel,
  getMergedDisplayCategoryIcon,
  getMergedDisplayCategoryLabel,
} from "@/lib/recommendation-engine";
import { resolveServiceRenewal, RENEWAL_SOON_DAYS } from "@/lib/service-insights";

function getServiceCategoryLabel(category: string): string {
  return getMergedDisplayCategoryLabel(category) || getCategoryLabel(category) || category.replace(/_/g, " ");
}

// Aurora categorical palette — the same hue map the Services tab hero uses, so
// a category reads as the same color on the list and on its detail screen.
const catColors: Record<string, string> = {
  GOVERNMENT: "#F08C8E", UTILITY: "#F2C46C", FINANCIAL: "#87DDC0",
  HOUSING: "#7FB6E8", HEALTHCARE: "#F0A0B8", TRANSPORTATION: "#5C9DDC",
  KIDS: "#D99A4E", FITNESS: "#F2C46C", SHOPPING: "#F0A0B8", OTHER: "#6E7C92",
};

function getServiceCategoryColor(category: string): string {
  if (!category) return catColors.OTHER;
  return catColors[category] || catColors[category.split("_")[0] || "OTHER"] || catColors.OTHER;
}

function getServiceFallbackIcon(category: string): string {
  return getMergedDisplayCategoryIcon(category) || getCategoryIcon(category) || "⚡";
}

export default function ServiceDetailScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
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
      value: formatCurrency(service.monthlyCost, i18n.language),
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

  // Renewal tracking, derived from existing fields (contractEndDate, or the
  // recurring billingDay + billingCycle). No schema change — see service-insights.
  const renewal = resolveServiceRenewal(service);
  const renewalSoon = renewal != null && renewal.days >= 0 && renewal.days <= RENEWAL_SOON_DAYS;
  const renewalOverdue = renewal != null && renewal.days < 0;
  const renewalDateStr = renewal
    ? renewal.date.toLocaleDateString(i18n.language || "en", { month: "short", day: "numeric", year: "numeric" })
    : "";
  // Headline copy depends on where the date came from + how close it is.
  const renewalHeadline = renewal
    ? renewalOverdue
      ? renewal.source === "contract"
        ? t("services.renewalContractEnded", { defaultValue: "Contract ended" })
        : t("services.renewalPast", { defaultValue: "Was due" })
      : renewal.days === 0
        ? t("services.renewalToday", { defaultValue: "Due today" })
        : renewal.source === "contract"
          ? t("services.renewalContractIn", { count: renewal.days, defaultValue: `Contract ends in ${renewal.days} days` })
          : t("services.renewalIn", { count: renewal.days, defaultValue: `Renews in ${renewal.days} days` })
    : "";
  const renewalTone = renewalOverdue
    ? theme.colors.error
    : renewalSoon
      ? theme.colors.amber.text
      : theme.colors.primary;

  // Honest, action-oriented nudge — only inside the soon/overdue window, and
  // only from signals we actually have (contract vs billing, auto-renewal). We
  // never claim to know a card is bad; we tell you what to confirm.
  const renewalGuidance =
    renewal && (renewalSoon || renewalOverdue)
      ? renewalOverdue
        ? renewal.source === "contract"
          ? t("services.guidanceContractEnded", { defaultValue: "Confirm whether it renewed or lapsed — and update the address if you've moved." })
          : t("services.guidanceOverdue", { defaultValue: "Check that the last payment went through — and update the address if you've moved." })
        : renewal.source === "contract"
          ? t("services.guidanceContractSoon", { defaultValue: "Decide whether to renew or cancel before the contract ends." })
          : service.autoRenewal
            ? t("services.guidanceAutoSoon", { defaultValue: "It renews automatically — confirm the card and billing address are current." })
            : t("services.guidanceBillingSoon", { defaultValue: "Confirm the billing details before it renews." })
      : "";

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
        {/* ── Aurora glass hero — category glyph + provider identity + ministats ── */}
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <ServiceLogoMark
              service={service}
              fallbackIcon={getServiceFallbackIcon(service.category)}
              size={56}
              logoSize={40}
              borderRadius={18}
              fallbackFontSize={24}
              backgroundColor={getServiceCategoryColor(service.category) + "30"}
              borderColor={getServiceCategoryColor(service.category) + "50"}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroName} numberOfLines={2}>{service.providerName}</Text>
              <View style={styles.heroCatRow}>
                <View style={[styles.heroCatDot, { backgroundColor: getServiceCategoryColor(service.category) }]} />
                <Text style={styles.heroCat} numberOfLines={1}>
                  {t(`categories.${service.category}`, { defaultValue: getServiceCategoryLabel(service.category) })}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.heroBadges}>
            <UiBadge
              label={service.isActive ? t("services.statusActive") : t("services.statusInactive")}
              variant={service.isActive ? "success" : "neutral"}
              dot
              mono
            />
            {service.billingCycle && (
              <UiBadge label={t(`billingCycles.${service.billingCycle}`, { defaultValue: service.billingCycle.replace("_", " ") })} variant="info" mono />
            )}
          </View>
          {/* Ministats — cost / renewal / address, derived from existing fields only */}
          <View style={styles.miniStats}>
            <View style={styles.miniStat}>
              <Text style={[styles.miniStatValue, service.monthlyCost > 0 && { color: theme.colors.emerald.text }]} numberOfLines={1}>
                {service.monthlyCost > 0 ? formatCurrency(service.monthlyCost, i18n.language) : "—"}
              </Text>
              <Text style={styles.miniStatLabel}>{t("services.detailStatMonthly", { defaultValue: "Per month" }).toUpperCase()}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={[styles.miniStatValue, renewal != null && { color: renewalTone }]} numberOfLines={1}>
                {renewal == null
                  ? "—"
                  : renewal.days < 0
                    ? t("services.renewalOverdueBadge", { defaultValue: "Overdue" })
                    : renewal.days === 0
                      ? t("services.renewalToday", { defaultValue: "Due today" })
                      : t("services.renewalDaysShort", { count: renewal.days, defaultValue: `${renewal.days}d` })}
              </Text>
              <Text style={styles.miniStatLabel}>{t("services.detailStatRenewal", { defaultValue: "Renewal" }).toUpperCase()}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue} numberOfLines={1}>
                {service.address ? service.address.nickname || service.address.city : "—"}
              </Text>
              <Text style={styles.miniStatLabel}>{t("services.detailStatAddress", { defaultValue: "Address" }).toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Renewal tracking — derived from contractEndDate or billingDay/cycle.
            Only renders when the service carries a date signal. */}
        {renewal && (
          <View
            style={[
              styles.renewalCard,
              { borderColor: renewalTone + "55", backgroundColor: renewalTone + "12" },
            ]}
          >
            <View style={[styles.renewalIcon, { backgroundColor: renewalTone + "22" }]}>
              {renewal.source === "contract" ? (
                <CalendarClock size={18} color={renewalTone} />
              ) : (
                <RefreshCw size={18} color={renewalTone} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.renewalHeadline, { color: renewalTone }]}>{renewalHeadline}</Text>
              <Text style={styles.renewalDate}>
                {renewal.source === "contract"
                  ? t("services.renewalOnContract", { date: renewalDateStr, defaultValue: `Contract date · ${renewalDateStr}` })
                  : t("services.renewalOnBilling", { date: renewalDateStr, defaultValue: `Next bill · ${renewalDateStr}` })}
                {service.autoRenewal ? ` · ${t("services.autoRenews", { defaultValue: "auto-renews" })}` : ""}
              </Text>
              {renewalGuidance ? (
                <Text style={styles.renewalGuidance} numberOfLines={2}>{renewalGuidance}</Text>
              ) : null}
            </View>
            {(renewalSoon || renewalOverdue) && (
              <UiBadge
                label={
                  renewalOverdue
                    ? t("services.renewalOverdueBadge", { defaultValue: "Overdue" })
                    : t("services.renewalSoonBadge", { defaultValue: "Soon" })
                }
                variant={renewalOverdue ? "error" : "warning"}
              />
            )}
          </View>
        )}

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

        {/* Actions — Aurora list-rows */}
        <Text style={styles.sectionKicker}>{t("services.actionsKicker", { defaultValue: "Manage" }).toUpperCase()}</Text>
        <PressableScale
          style={styles.actionRow}
          onPress={() => router.push({ pathname: "/services/[id]/edit", params: { id: String(id) } })}
          accessibilityRole="button"
          accessibilityLabel={t("services.editTitle")}
        >
          <View style={[styles.actionIcon, { backgroundColor: theme.colors.primaryFaded }]}>
            <Edit size={16} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.actionTitle}>{t("services.editTitle")}</Text>
            <Text style={styles.actionDesc} numberOfLines={1}>
              {t("services.editRowDesc", { defaultValue: "Update cost, billing, and contact details." })}
            </Text>
          </View>
          <ChevronRight size={16} color={theme.colors.textTertiary} />
        </PressableScale>

        {/* Danger zone */}
        <Text style={[styles.sectionKicker, { color: theme.colors.error }]}>
          {t("services.dangerZone", { defaultValue: "Danger zone" }).toUpperCase()}
        </Text>
        <PressableScale
          style={[styles.actionRow, styles.dangerRow]}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel={t("services.deleteService")}
        >
          <View style={[styles.actionIcon, { backgroundColor: theme.colors.errorFaded }]}>
            <Trash2 size={16} color={theme.colors.error} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.actionTitle, { color: theme.colors.error }]}>{t("services.deleteService")}</Text>
            <Text style={styles.actionDesc} numberOfLines={2}>
              {t("services.dangerZoneHint", { defaultValue: "Removes this service from your tracking. This cannot be undone." })}
            </Text>
          </View>
          <ChevronRight size={16} color={theme.colors.error + "99"} />
        </PressableScale>
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
  // ── Aurora glass hero ──
  hero: {
    padding: 16,
    borderRadius: theme.radius["2xl"],
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    ...theme.shadow.glow,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroName: { fontSize: 20, fontWeight: "800", color: theme.colors.text, letterSpacing: -0.4 },
  heroCatRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  heroCatDot: { width: 7, height: 7, borderRadius: 4 },
  heroCat: { flexShrink: 1, fontSize: 13, color: theme.colors.textTertiary },
  heroBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  // Ministat chips — cost / renewal / address
  miniStats: { flexDirection: "row", gap: 8, marginTop: 14 },
  miniStat: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 13,
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  miniStatValue: { fontSize: 14, fontWeight: "800", color: theme.colors.text, fontVariant: ["tabular-nums"] },
  miniStatLabel: { fontSize: 8, letterSpacing: 0.8, fontWeight: "700", color: theme.colors.textTertiary, marginTop: 3 },
  renewalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
  },
  renewalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  renewalHeadline: { fontSize: 15, fontWeight: "700" },
  renewalDate: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  renewalGuidance: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 5, lineHeight: 16 },
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
  // ── Aurora action list-rows + danger zone ──
  sectionKicker: {
    fontSize: 10, letterSpacing: 1.4, fontWeight: "700", color: theme.colors.textTertiary,
    marginTop: 24, marginBottom: 9, marginLeft: 2,
  },
  actionRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  dangerRow: {
    backgroundColor: theme.colors.errorFaded,
    borderColor: theme.colors.error + "38",
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  actionTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  actionDesc: { fontSize: 11.5, color: theme.colors.textTertiary, marginTop: 2, lineHeight: 16 },
});
