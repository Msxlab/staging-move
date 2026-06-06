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
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft, Bell, CheckCheck, Receipt, AlertTriangle, Clock, CheckCircle2,
  Truck, Users, Zap, Crown, type LucideIcon,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

interface FeedNotification {
  id: string;
  type: string;
  title: string;
  body?: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

// A friendly icon + tint per notification type so the feed reads like a real
// inbox instead of identical grey dots.
function presentationFor(type: string, theme: Theme): { Icon: LucideIcon; tint: string } {
  switch (type) {
    case "BILL_REMINDER": return { Icon: Receipt, tint: theme.colors.primary };
    case "BILL_OVERDUE": return { Icon: AlertTriangle, tint: theme.colors.error };
    case "CONTRACT_EXPIRY": return { Icon: Clock, tint: theme.colors.amber.text };
    case "TASK_REMINDER":
    case "TASK_DUE": return { Icon: CheckCircle2, tint: theme.colors.emerald.text };
    case "MOVE_ALERT":
    case "MOVE_REMINDER": return { Icon: Truck, tint: theme.colors.primary };
    case "WORKSPACE_MEMBERSHIP": return { Icon: Users, tint: theme.colors.primary };
    case "CONNECTOR_ACTION_NEEDED": return { Icon: Zap, tint: theme.colors.amber.text };
    case "SUBSCRIPTION":
    case "ACCOUNT_UPDATED": return { Icon: Crown, tint: theme.colors.amber.text };
    default: return { Icon: Bell, tint: theme.colors.textTertiary };
  }
}

function formatRelativeTime(iso: string, t: (k: string, o?: any) => string, dateLocale: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return t("notifications.now", { defaultValue: "now" });
  if (min < 60) return t("notifications.minuteShort", { count: min, defaultValue: "{{count}}m" });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("notifications.hourShort", { count: hr, defaultValue: "{{count}}h" });
  const day = Math.floor(hr / 24);
  if (day < 7) return t("notifications.dayShort", { count: day, defaultValue: "{{count}}d" });
  return new Date(iso).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" });
}

export default function NotificationsScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    const res = await api.get<any>("/api/notifications/feed");
    if (res.error) {
      setError(res.error);
      return false;
    }
    if (res.data) {
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
      setError(null);
    }
    return true;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchFeed();
    } finally {
      setLoading(false);
    }
  }, [fetchFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchFeed();
    } finally {
      setRefreshing(false);
    }
  }, [fetchFeed]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    const res = await api.patch(`/api/notifications/feed/${id}`, {});
    if (res.error) {
      Alert.alert(t("notifications.title"), res.error);
      return;
    }
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    const res = await api.patch("/api/notifications/feed?action=read-all", {});
    setMarkingAll(false);
    if (res.error) {
      Alert.alert(t("notifications.title"), res.error);
      return;
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  if (loading) return <LoadingScreen />;

  const isSpanish = (i18n.language || "").toLowerCase().startsWith("es");
  const dateLocale = isSpanish ? "es-ES" : "en-US";
  const notificationTitle = (notif: FeedNotification) => {
    if (!isSpanish) return notif.title;
    return t(`notifications.feed_${notif.type || "GENERIC"}_title`, {
      defaultValue: t("notifications.feed_GENERIC_title"),
    });
  };
  const notificationBody = (notif: FeedNotification) => {
    if (!isSpanish) return notif.body;
    return t(`notifications.feed_${notif.type || "GENERIC"}_body`, {
      defaultValue: t("notifications.feed_GENERIC_body"),
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("notifications.title")}</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={markAllRead}
            style={styles.markAllBtn}
            disabled={markingAll}
            accessibilityRole="button"
            accessibilityLabel={t("notifications.markAllRead")}
          >
            <CheckCheck size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {unreadCount > 0 && (
        <Text style={styles.unreadLabel}>{t("notifications.unread", { count: unreadCount })}</Text>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {error && notifications.length > 0 ? (
          <View style={{ marginHorizontal: 16, marginBottom: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.rose.text }}>
            <Text style={{ color: theme.colors.rose.text, fontSize: 12, textAlign: "center" }}>{error}</Text>
          </View>
        ) : null}
        {error && notifications.length === 0 ? (
          <ErrorState message={error} onRetry={load} />
        ) : notifications.length === 0 ? (
          <Card variant="default" style={{ alignItems: "center", paddingVertical: 40 }}>
            <Bell size={32} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>{t("notifications.emptyTitle")}</Text>
            <Text style={styles.emptySubtitle}>{t("notifications.emptySubtitle")}</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {notifications.map((notif) => {
              const body = notificationBody(notif);
              const { Icon, tint } = presentationFor(notif.type, theme);
              return (
              <TouchableOpacity
                key={notif.id}
                style={[styles.notifRow, !notif.read && styles.notifUnread]}
                onPress={() => !notif.read && markRead(notif.id)}
                activeOpacity={0.6}
              >
                <View style={[styles.notifChip, { backgroundColor: tint + "22" }]}>
                  <Icon size={18} color={tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.notifTopRow}>
                    <Text style={[styles.notifTitle, notif.read && styles.notifTitleRead]} numberOfLines={1}>
                      {notificationTitle(notif)}
                    </Text>
                    <Text style={styles.notifTime}>{formatRelativeTime(notif.createdAt, t, dateLocale)}</Text>
                  </View>
                  {body ? <Text style={styles.notifBody} numberOfLines={2}>{body}</Text> : null}
                </View>
                {!notif.read ? <View style={styles.unreadDot} /> : null}
              </TouchableOpacity>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  markAllBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primaryFaded, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  unreadLabel: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 20, marginBottom: 8 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  list: { gap: 8 },
  notifRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 14 },
  notifUnread: { borderColor: `${theme.colors.primary}30`, backgroundColor: `${theme.colors.primary}08` },
  notifChip: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  notifTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0, backgroundColor: theme.colors.primary },
  notifTitle: { flex: 1, fontSize: 14, fontWeight: "600", color: theme.colors.text },
  notifTitleRead: { color: theme.colors.textMuted },
  notifBody: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2, lineHeight: 17 },
  notifTime: { fontSize: 11, color: theme.colors.textMuted, flexShrink: 0 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 4 },
});
