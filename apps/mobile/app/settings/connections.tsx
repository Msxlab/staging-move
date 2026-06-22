import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Link2, ExternalLink, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api, APP_WEB_URL } from "@/lib/api";
import { openWebUrl } from "@/lib/in-app-browser";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { HeroCard, MoveCard, SectionHeader, Pill } from "@/components/move";

interface Consent {
  id: string;
  connectorKey: string;
  status: string;
  scopes: string[];
}

interface CatalogEntry {
  connectorKey: string;
  displayName: string;
  mode: "API_SYNC" | "GUIDED_UPDATE" | "COMING_SOON";
  guidedAction: { key: string; label: string; url: string; helperText?: string } | null;
}

export default function ConnectionsScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useTranslation();
  const [pageLoading, setPageLoading] = useState(true);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [apiSync, setApiSync] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Manually push the current (primary) address to every connected partner.
  // The server defaults to the primary address and returns { created } (the
  // number of dispatches queued); 400/403/503 carry a clear reason.
  const syncNow = async () => {
    setSyncing(true);
    const res = await api.post<any>("/api/connector-dispatch", {});
    setSyncing(false);
    if (res.error) {
      hapticError();
      Alert.alert(t("connections.syncNow", { defaultValue: "Sync now" }), res.error);
      return;
    }
    hapticSuccess();
    const created = res.data?.created ?? 0;
    Alert.alert(
      t("connections.syncNow", { defaultValue: "Sync now" }),
      created > 0
        ? t("connections.syncQueued", { count: created, defaultValue: "Queued {{count}} address update(s)." })
        : t("connections.syncNoneQueued", { defaultValue: "Everything is already up to date." }),
    );
  };

  const load = useCallback(async () => {
    // The honest catalog: each partner's DERIVED mode (API_SYNC / GUIDED_UPDATE /
    // COMING_SOON) + whether THIS user is entitled to API sync. Replaces the
    // hardcoded USPS row that offered "Connect" to everyone and 403'd non-Pro.
    const [consentRes, catRes] = await Promise.all([
      api.get<{ consents: Consent[] }>("/api/partner-consents"),
      api.get<{ connectors: CatalogEntry[]; entitlement: { apiSync: boolean } }>("/api/connectors/catalog"),
    ]);
    if (consentRes.data?.consents) setConsents(consentRes.data.consents);
    if (catRes.data?.connectors) setCatalog(catRes.data.connectors);
    setApiSync(catRes.data?.entitlement?.apiSync === true);
    setPageLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grantedByKey = useMemo(() => {
    const map = new Map<string, Consent>();
    for (const c of consents) {
      if (c.status === "GRANTED") map.set(c.connectorKey, c);
    }
    return map;
  }, [consents]);

  const connect = async (connectorKey: string) => {
    // Opens our server-side OAuth initiate in an in-app browser that shares the
    // signed-in session. The token is exchanged + stored server-side; the
    // device never sees it. Inert (503) until partner credentials are set.
    setBusyKey(connectorKey);
    await openWebUrl(`${APP_WEB_URL}/api/partner-consents/oauth/initiate?connector=${encodeURIComponent(connectorKey)}`);
    setBusyKey(null);
    // Refresh after the user returns from the browser.
    void load();
  };

  const revoke = (consent: Consent) => {
    Alert.alert(
      t("connections.revokeTitle", "Disconnect?"),
      t("connections.revokeBody", "LocateFlow will stop syncing addresses to this partner."),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("connections.revoke", "Disconnect"),
          style: "destructive",
          onPress: async () => {
            setBusyKey(consent.connectorKey);
            const res = await api.delete<{ revoked: boolean }>(`/api/partner-consents/${consent.id}`);
            setBusyKey(null);
            if (res.error) {
              hapticError();
              Alert.alert(t("common.retry", "Try again"), res.error);
              return;
            }
            hapticSuccess();
            void load();
          },
        },
      ],
    );
  };

  if (pageLoading) return <LoadingScreen />;

  const connectable = catalog.filter((c) => !grantedByKey.has(c.connectorKey));
  const connectedCount = consents.filter((consent) => consent.status === "GRANTED").length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("connections.title", "Connections")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <HeroCard style={styles.hero} padding={16} radius={theme.radius.xl}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Link2 size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>{t("connections.kicker", { defaultValue: "PARTNER SYNC" })}</Text>
              <Text style={styles.heroTitle}>{t("connections.title", "Connections")}</Text>
              <Text style={styles.heroSub}>
                {t(
                  "connections.intro",
                  "Connect a partner once and LocateFlow can keep your address up to date there when you move.",
                )}
              </Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{connectedCount}</Text>
              <Text style={styles.heroStatLabel}>{t("connections.stat_connected", { defaultValue: "connected" })}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{connectable.length}</Text>
              <Text style={styles.heroStatLabel}>{t("connections.stat_available", { defaultValue: "available" })}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>
                {apiSync
                  ? t("connections.stat_on", { defaultValue: "On" })
                  : t("connections.stat_review", { defaultValue: "Review" })}
              </Text>
              <Text style={styles.heroStatLabel}>{t("connections.stat_autoSync", { defaultValue: "auto sync" })}</Text>
            </View>
          </View>
        </HeroCard>

        {consents.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <SectionHeader label={t("connections.connected", "Connected")} style={styles.sectionHeader} />
              <TouchableOpacity onPress={syncNow} disabled={syncing} style={styles.syncBtn} activeOpacity={0.85}>
                {syncing ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Text style={styles.syncBtnText}>{t("connections.syncNow", { defaultValue: "Sync now" })}</Text>
                )}
              </TouchableOpacity>
            </View>
            <MoveCard padding={0} radius={theme.radius.xl}>
              {consents.map((c, i) => (
                <View key={c.id} style={[styles.row, i < consents.length - 1 && styles.rowBorder]}>
                  <View style={styles.rowIcon}>
                    <Link2 size={18} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowLabel}>{(c.connectorKey || "").toUpperCase()}</Text>
                    <Text style={styles.rowDesc}>{statusLabel(c.status, t)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => revoke(c)}
                    disabled={busyKey === c.connectorKey}
                    style={styles.iconBtn}
                  >
                    {busyKey === c.connectorKey ? (
                      <ActivityIndicator size="small" color={theme.colors.faint} />
                    ) : (
                      <Trash2 size={18} color={theme.colors.error} />
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </MoveCard>
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader label={t("connections.available", "Available")} style={styles.sectionHeader} />
          {connectable.length === 0 ? (
            <Text style={styles.empty}>{t("connections.allConnected", "All available partners are connected.")}</Text>
          ) : (
            <MoveCard padding={0} radius={theme.radius.xl}>
              {connectable.map((c, i) => {
                // Only an API_SYNC partner the user is entitled to gets a live
                // OAuth "Connect". API_SYNC without entitlement -> upsell; a
                // GUIDED_UPDATE partner -> a how-to link; COMING_SOON -> disabled.
                const canConnect = c.mode === "API_SYNC" && apiSync;
                const modeLabel =
                  c.mode === "API_SYNC"
                    ? canConnect
                      ? t("connections.mode_apiSync", { defaultValue: "Automatic sync" })
                      : t("connections.mode_proRequired", { defaultValue: "Automatic sync - Pro" })
                    : c.mode === "COMING_SOON"
                      ? t("connections.mode_comingSoon", { defaultValue: "Coming soon" })
                      : t("connections.mode_guided", { defaultValue: "Guided update" });
                return (
                <View key={c.connectorKey} style={[styles.row, i < connectable.length - 1 && styles.rowBorder]}>
                  <View style={styles.rowIconMuted}>
                    <Link2 size={18} color={theme.colors.faint} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowLabel}>{c.displayName}</Text>
                    <Text style={styles.rowDesc}>{modeLabel}</Text>
                  </View>
                  {canConnect ? (
                  <TouchableOpacity
                    onPress={() => connect(c.connectorKey)}
                    disabled={busyKey === c.connectorKey}
                    style={styles.connectBtn}
                    activeOpacity={0.85}
                  >
                    {busyKey === c.connectorKey ? (
                      <ActivityIndicator size="small" color={theme.colors.onAccent} />
                    ) : (
                      <LinearGradient
                        colors={theme.colors.gradient.primary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.connectBtnGrad}
                      >
                        <ExternalLink size={14} color={theme.colors.onAccent} />
                        <Text style={styles.connectBtnText}>{t("connections.connect", "Connect")}</Text>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                  ) : c.mode === "API_SYNC" ? (
                    <TouchableOpacity onPress={() => router.push("/settings/subscription")} style={styles.ghostBtn} activeOpacity={0.85}>
                      <Text style={styles.ghostBtnText}>{t("connections.reviewAccess", { defaultValue: "Review access" })}</Text>
                    </TouchableOpacity>
                  ) : c.mode === "GUIDED_UPDATE" && c.guidedAction?.url ? (
                    <TouchableOpacity onPress={() => openWebUrl(c.guidedAction!.url)} style={styles.ghostBtn} activeOpacity={0.85}>
                      <ExternalLink size={14} color={theme.colors.primary} />
                      <Text style={styles.ghostBtnText}>{t("connections.howTo", { defaultValue: "How to" })}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Pill
                      tone="muted"
                      label={
                        c.mode === "COMING_SOON"
                          ? t("connections.soon", { defaultValue: "Soon" })
                          : t("connections.guided", { defaultValue: "Guide" })
                      }
                    />
                  )}
                </View>
                );
              })}
            </MoveCard>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function statusLabel(status: string, t: (k: string, d: string) => string): string {
  switch (status) {
    case "GRANTED":
      return t("connections.status_connected", "Connected");
    case "EXPIRED":
      return t("connections.status_expired", "Expired - reconnect");
    case "REVOKED":
      return t("connections.status_revoked", "Disconnected");
    default:
      return status;
  }
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingVertical: 12,
    },
    backBtn: {
      width: 44, height: 44, borderRadius: 14,
      backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
      alignItems: "center", justifyContent: "center",
    },
    title: { fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    hero: {
      marginBottom: 2,
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
    heroKicker: { fontSize: 10, fontFamily: fonts.sansBold, letterSpacing: 1.4, textTransform: "uppercase", color: theme.colors.primary },
    heroTitle: { fontSize: 22, fontFamily: fonts.serifBold, color: theme.colors.text, marginTop: 3 },
    heroSub: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 3, lineHeight: 17 },
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
    heroStatValue: { fontSize: 13, fontFamily: fonts.sansBold, color: theme.colors.text },
    heroStatLabel: {
      fontSize: 9,
      fontFamily: fonts.sansBold,
      letterSpacing: 0.6,
      color: theme.colors.faint,
      textTransform: "uppercase",
      marginTop: 3,
    },
    section: { marginTop: 20 },
    sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sectionHeader: { flex: 1, marginBottom: 10, marginLeft: 2 },
    empty: { fontSize: 13, fontFamily: fonts.sans, color: theme.colors.dim, marginLeft: 2 },
    row: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 14, paddingHorizontal: 16,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    rowIcon: {
      width: 36, height: 36, borderRadius: 12,
      backgroundColor: theme.colors.accentSoft, borderWidth: 1, borderColor: theme.colors.accentBorder,
      alignItems: "center", justifyContent: "center",
    },
    rowIconMuted: {
      width: 36, height: 36, borderRadius: 12,
      backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border,
      alignItems: "center", justifyContent: "center",
    },
    rowLabel: { fontSize: 15, fontFamily: fonts.sansSemibold, color: theme.colors.text },
    rowDesc: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 2 },
    iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    connectBtn: {
      borderRadius: 14,
      overflow: "hidden",
    },
    connectBtnGrad: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingVertical: 8, paddingHorizontal: 14,
    },
    connectBtnText: { fontSize: 13, fontFamily: fonts.sansBold, color: theme.colors.onAccent },
    ghostBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: theme.colors.accentSoft, borderWidth: 1, borderColor: theme.colors.accentBorder,
      borderRadius: 14, paddingVertical: 8, paddingHorizontal: 14,
    },
    ghostBtnText: { fontSize: 13, fontFamily: fonts.sansBold, color: theme.colors.primary },
    syncBtn: {
      backgroundColor: theme.colors.accentSoft, borderWidth: 1, borderColor: theme.colors.accentBorder,
      borderRadius: 12, paddingVertical: 7, paddingHorizontal: 13,
      marginBottom: 10,
      alignItems: "center", justifyContent: "center",
    },
    syncBtnText: { fontSize: 12, fontFamily: fonts.sansBold, color: theme.colors.primary },
  });
