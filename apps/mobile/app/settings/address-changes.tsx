import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, MapPin, Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { HeroCard, MoveCard, Pill, type PillTone } from "@/components/move";

interface Dispatch {
  connectorKey: string;
  status: string;
  confirmedAt: string | null;
  lastErrorCode: string | null;
}

interface Change {
  id: string;
  fromAddressId: string | null;
  toAddressId: string;
  status: string;
  dispatchCount: number;
  createdAt: string;
  dispatches: Dispatch[];
}

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmed",
  SUBMITTED: "Submitted",
  QUEUED: "Queued",
  DISPATCHING: "Sending",
  NEEDS_USER: "Action needed",
  FAILED: "Failed",
};

/** Map dispatch status to a tonal Pill so light/dark palettes stay consistent. */
function statusTone(status: string): PillTone {
  if (status === "CONFIRMED") return "success";
  if (status === "NEEDS_USER" || status === "FAILED") return "error";
  return "info";
}

export default function AddressChangesScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [changes, setChanges] = useState<Change[]>([]);

  const load = useCallback(async () => {
    setError(false);
    const res = await api.get<{ changes: Change[] }>("/api/connectors/changes");
    if (res.error || !res.data) setError(true);
    else setChanges(res.data.changes ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  const totalDispatches = changes.reduce((sum, change) => sum + change.dispatchCount, 0);
  const confirmedChanges = changes.filter((change) => change.status === "CONFIRMED").length;

  const heroStats = [
    { label: t("addressChanges.statChanges", { defaultValue: "changes" }), value: String(changes.length) },
    { label: t("addressChanges.statDispatches", { defaultValue: "dispatches" }), value: String(totalDispatches) },
    { label: t("addressChanges.statConfirmed", { defaultValue: "confirmed" }), value: String(confirmedChanges) },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("addressChanges.title", "Address changes")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <HeroCard style={styles.hero} padding={16} radius={theme.radius.xl}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <MapPin size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>{t("addressChanges.kicker", { defaultValue: "ADDRESS SYNC" })}</Text>
              <Text style={styles.heroTitle}>{t("addressChanges.title", "Address changes")}</Text>
              <Text style={styles.heroSub}>
                {t("addressChanges.subtitle", "Where each address change was sent, and whether the provider confirmed it.")}
              </Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            {heroStats.map((stat) => (
              <View key={stat.label} style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{stat.value}</Text>
                <Text style={styles.heroStatLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </HeroCard>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t("addressChanges.error", "Couldn't load your address changes.")}</Text>
            <TouchableOpacity
              onPress={() => {
                setLoading(true);
                void load();
              }}
              style={styles.retryBtn}
            >
              <Text style={styles.retryText}>{t("common.retry", "Retry")}</Text>
            </TouchableOpacity>
          </View>
        ) : changes.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MapPin size={26} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t("addressChanges.emptyTitle", "No address changes yet")}</Text>
            <Text style={styles.emptyBody}>
              {t(
                "addressChanges.emptyBody",
                "When you change your address and have connected providers, each update appears here.",
              )}
            </Text>
          </View>
        ) : (
          changes.map((c) => (
            <MoveCard key={c.id} style={styles.card} padding={16} radius={theme.radius.xl}>
              <View style={styles.cardHeader}>
                <Clock size={14} color={theme.colors.faint} />
                <Text style={styles.cardDate}>{new Date(c.createdAt).toLocaleDateString()}</Text>
                <Text style={styles.cardCount}>
                  {c.dispatchCount} {c.dispatchCount === 1 ? "provider" : "providers"}
                </Text>
              </View>
              {c.dispatches.length === 0 ? (
                <Text style={styles.noProviders}>
                  {t("addressChanges.noProviders", "No connected providers for this change.")}
                </Text>
              ) : (
                c.dispatches.map((d, i) => (
                  <View key={`${d.connectorKey}-${i}`} style={styles.row}>
                    <Text style={styles.connector}>{(d.connectorKey || "").toUpperCase()}</Text>
                    <Pill label={STATUS_LABEL[d.status] ?? d.status} tone={statusTone(d.status)} />
                  </View>
                ))
              )}
            </MoveCard>
          ))
        )}
      </ScrollView>
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
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    hero: {
      marginBottom: 16,
    },
    heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    heroIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: theme.colors.accentSoft,
      borderWidth: 1,
      borderColor: theme.colors.accentBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    heroCopy: { flex: 1, minWidth: 0 },
    heroKicker: {
      fontSize: 10,
      fontFamily: fonts.sansBold,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: theme.colors.primary,
    },
    heroTitle: { fontSize: 22, fontFamily: fonts.serifBold, color: theme.colors.text, marginTop: 3 },
    heroSub: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 4, lineHeight: 17 },
    heroStats: { flexDirection: "row", gap: 8, marginTop: 14 },
    heroStat: {
      flex: 1,
      minHeight: 58,
      borderRadius: 14,
      padding: 10,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: "center",
    },
    heroStatValue: { fontSize: 16, fontFamily: fonts.sansBold, color: theme.colors.text },
    heroStatLabel: {
      fontSize: 9,
      fontFamily: fonts.sansBold,
      letterSpacing: 0.6,
      color: theme.colors.faint,
      textTransform: "uppercase",
      marginTop: 3,
    },
    empty: { alignItems: "center", marginTop: 48, gap: 8 },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: theme.colors.accentSoft,
      borderWidth: 1,
      borderColor: theme.colors.accentBorder,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 15, fontFamily: fonts.sansSemibold, color: theme.colors.text, marginTop: 8 },
    emptyBody: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, textAlign: "center", maxWidth: 280, lineHeight: 18 },
    card: {
      marginBottom: 12,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    cardDate: { fontSize: 12, fontFamily: fonts.sansMedium, color: theme.colors.dim },
    cardCount: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, marginLeft: "auto" },
    noProviders: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 10 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 10,
    },
    connector: { fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.text },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    retryText: { fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.text },
  });
