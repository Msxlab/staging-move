import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, MapPin, Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";

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

/** Status hues from the active theme so light/dark palettes stay consistent. */
function statusColor(status: string, colors: Theme["colors"], fallback: string): string {
  if (status === "CONFIRMED") return colors.success;
  if (status === "NEEDS_USER" || status === "FAILED") return colors.error;
  return fallback;
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
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <MapPin size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>ADDRESS SYNC</Text>
              <Text style={styles.heroTitle}>{t("addressChanges.title", "Address changes")}</Text>
              <Text style={styles.heroSub}>
                {t("addressChanges.subtitle", "Where each address change was sent, and whether the provider confirmed it.")}
              </Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{changes.length}</Text>
              <Text style={styles.heroStatLabel}>changes</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{totalDispatches}</Text>
              <Text style={styles.heroStatLabel}>dispatches</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{confirmedChanges}</Text>
              <Text style={styles.heroStatLabel}>confirmed</Text>
            </View>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.text} style={{ marginTop: 32 }} />
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
            <MapPin size={28} color={theme.colors.textMuted} />
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
            <View key={c.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Clock size={14} color={theme.colors.textMuted} />
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
                    <Text style={[styles.status, { color: statusColor(d.status, theme.colors, theme.colors.textSecondary) }]}>
                      {STATUS_LABEL[d.status] ?? d.status}
                    </Text>
                  </View>
                ))
              )}
            </View>
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
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    hero: {
      borderRadius: 24,
      padding: 16,
      marginBottom: 16,
      backgroundColor: theme.colors.glass.bg,
      borderWidth: 1,
      borderColor: theme.colors.glass.highlight,
      ...theme.shadow.sm,
    },
    heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    heroIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: theme.colors.primaryFaded,
      borderWidth: 1,
      borderColor: theme.colors.primary + "33",
      alignItems: "center",
      justifyContent: "center",
    },
    heroCopy: { flex: 1, minWidth: 0 },
    heroKicker: { fontSize: 10, fontWeight: "800", letterSpacing: 0, textTransform: "uppercase", color: theme.colors.accent },
    heroTitle: { fontSize: 22, fontWeight: "800", color: theme.colors.text, marginTop: 3, letterSpacing: 0 },
    heroSub: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 3, lineHeight: 17 },
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
    empty: { alignItems: "center", marginTop: 48, gap: 8 },
    emptyTitle: { fontSize: 15, fontWeight: "600", color: theme.colors.text, marginTop: 8 },
    emptyBody: { fontSize: 12, color: theme.colors.textMuted, textAlign: "center", maxWidth: 280 },
    card: {
      backgroundColor: theme.colors.glass.bg,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.glass.highlight,
      padding: 16,
      marginBottom: 12,
      ...theme.shadow.sm,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    cardDate: { fontSize: 12, color: theme.colors.textMuted },
    cardCount: { fontSize: 12, color: theme.colors.textMuted, marginLeft: "auto" },
    noProviders: { fontSize: 12, color: theme.colors.textMuted, marginTop: 10 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 10,
    },
    connector: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
    status: { fontSize: 13, fontWeight: "500" },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    retryText: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  });
