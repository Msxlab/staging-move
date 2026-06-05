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

/** Hardcoded status hues so this never depends on optional theme color keys. */
function statusColor(status: string, fallback: string): string {
  if (status === "CONFIRMED") return "#16a34a";
  if (status === "NEEDS_USER" || status === "FAILED") return "#dc2626";
  return fallback;
}

export default function AddressChangesScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState<Change[]>([]);

  const load = useCallback(async () => {
    const res = await api.get<{ changes: Change[] }>("/api/connectors/changes");
    if (res.data?.changes) setChanges(res.data.changes);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
        <Text style={styles.subtitle}>
          {t("addressChanges.subtitle", "Where each address change was sent, and whether the provider confirmed it.")}
        </Text>

        {loading ? (
          <ActivityIndicator color={theme.colors.text} style={{ marginTop: 32 }} />
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
                    <Text style={styles.connector}>{d.connectorKey.toUpperCase()}</Text>
                    <Text style={[styles.status, { color: statusColor(d.status, theme.colors.textSecondary) }]}>
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
    subtitle: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 16 },
    empty: { alignItems: "center", marginTop: 48, gap: 8 },
    emptyTitle: { fontSize: 15, fontWeight: "600", color: theme.colors.text, marginTop: 8 },
    emptyBody: { fontSize: 12, color: theme.colors.textMuted, textAlign: "center", maxWidth: 280 },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      marginBottom: 12,
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
  });
