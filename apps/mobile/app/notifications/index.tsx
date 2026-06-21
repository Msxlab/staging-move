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
  ArrowLeft, ArrowRight, Bell, CheckCheck, Receipt, AlertTriangle, Clock, CheckCircle2,
  Truck, Users, Zap, Crown, type LucideIcon,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ListEntrance } from "@/components/ui/ListEntrance";
import { PressableScale } from "@/components/ui/PressableScale";
import { HeroCard } from "@/components/move";

interface FeedNotification {
  id: string;
  type: string;
  title: string;
  body?: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

type FeedFilter = "all" | "unread" | "reminders";

// Time-bound / reminder-shaped feed types — mirrors REMINDER_FEED_TYPES in
// app/reminders/index.tsx so "Reminders" means the same thing in both inboxes.
const REMINDER_TYPES = new Set([
  "BILL_REMINDER",
  "BILL_OVERDUE",
  "CONTRACT_EXPIRY",
  "TASK_REMINDER",
  "TASK_DUE",
  "MOVE_ALERT",
  "MOVE_REMINDER",
]);

/**
 * Maps a server-issued (web) notification href to a mobile route, or null when
 * this app has no matching screen. Only hrefs the feed actually produces are
 * mapped — rows without a supported destination stay tap-to-mark-read only.
 */
function resolveMobileHref(href?: string): string | null {
  if (!href || !href.startsWith("/")) return null;
  const path = href.split("?")[0].split("#")[0];
  // Web move-plan URL shape → this app's plan screen.
  const plan = path.match(/^\/moving\/plan\/([^/]+)$/);
  if (plan) return `/moving/${plan[1]}`;
  const supported = [
    /^\/services\/[^/]+$/,
    /^\/moving$/,
    /^\/settings\/(subscription|connections|workspace|notifications)$/,
  ];
  return supported.some((re) => re.test(path)) ? path : null;
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
  const [filter, setFilter] = useState<FeedFilter>("all");

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

  const visible = notifications.filter((n) =>
    filter === "all" ? true : filter === "unread" ? !n.read : REMINDER_TYPES.has(n.type),
  );
  const reminderCount = notifications.filter((n) => REMINDER_TYPES.has(n.type)).length;
  const linkedCount = notifications.filter((n) => resolveMobileHref(n.href)).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("notifications.title")}</Text>
        {unreadCount > 0 ? (
          <PressableScale
            onPress={markAllRead}
            style={[styles.markAllPill, markingAll && { opacity: 0.5 }]}
            disabled={markingAll}
            accessibilityRole="button"
            accessibilityLabel={t("notifications.markAllRead")}
          >
            <CheckCheck size={15} color={theme.colors.primary} />
            <Text style={styles.markAllPillText}>{t("notifications.markAllReadShort", { defaultValue: "Mark all" })}</Text>
          </PressableScale>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

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
          <EmptyState
            mascot="kid"
            icon={<Bell size={32} color={theme.colors.primary} />}
            title={t("notifications.emptyTitle")}
            description={t("notifications.emptySubtitle")}
          />
        ) : (
          <>
            {notifications.length > 0 && (
              <HeroCard style={styles.hero} padding={16} radius={20}>
                <View style={styles.heroRow}>
                  <View style={styles.heroIcon}>
                    <Bell size={22} color={unreadCount > 0 ? theme.colors.error : theme.colors.primary} />
                  </View>
                  <View style={styles.heroBody}>
                    <Text style={styles.heroKicker}>
                      {unreadCount > 0
                        ? t("notifications.unread", { count: unreadCount }).toUpperCase()
                        : t("notifications.allClear", { defaultValue: "ALL CLEAR" })}
                    </Text>
                    <Text style={styles.heroTitle}>
                      {unreadCount > 0
                        ? t("notifications.heroTitle")
                        : t("notifications.allClearTitle", { defaultValue: "Inbox is under control" })}
                    </Text>
                    <Text style={styles.heroSub}>
                      {unreadCount > 0
                        ? t("notifications.heroSubtitle")
                        : t("notifications.allClearSubtitle", { defaultValue: "Recent alerts stay here with reminders and deep links when available." })}
                    </Text>
                    <View style={styles.heroStats}>
                      <Text style={styles.heroStat}>{notifications.length} total</Text>
                      <Text style={styles.heroStat}>{reminderCount} reminders</Text>
                      <Text style={styles.heroStat}>{linkedCount} linked</Text>
                    </View>
                  </View>
                </View>
              </HeroCard>
            )}

            <View style={styles.seg}>
              {(["all", "unread", "reminders"] as const).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.segBtn, filter === k && styles.segBtnOn]}
                  onPress={() => setFilter(k)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === k }}
                  accessibilityLabel={t(`notifications.filter_${k}`)}
                >
                  <Text style={[styles.segText, filter === k && styles.segTextOn]}>
                    {t(`notifications.filter_${k}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {visible.length === 0 ? (
              <Text style={styles.filterEmpty}>{t("notifications.filterEmpty")}</Text>
            ) : (
              <View style={styles.list}>
                {visible.map((notif, index) => {
                  const body = notificationBody(notif);
                  const { Icon, tint } = presentationFor(notif.type, theme);
                  const dest = resolveMobileHref(notif.href);
                  return (
                  <ListEntrance key={notif.id} index={index}>
                  <TouchableOpacity
                    style={[styles.notifRow, !notif.read && styles.notifUnread]}
                    onPress={() => !notif.read && markRead(notif.id)}
                    activeOpacity={0.6}
                  >
                    <View
                      style={[
                        styles.notifChip,
                        { backgroundColor: tint + "22" },
                        !notif.read && { ...theme.shadow.glow, shadowColor: tint },
                      ]}
                    >
                      <Icon size={18} color={tint} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.notifTopRow}>
                        <Text style={[styles.notifTitle, notif.read && styles.notifTitleRead]} numberOfLines={1}>
                          {notificationTitle(notif)}
                        </Text>
                        <Text style={styles.notifTime}>
                          {formatRelativeTime(notif.createdAt, t, dateLocale).toUpperCase()}
                        </Text>
                      </View>
                      {body ? <Text style={styles.notifBody} numberOfLines={2}>{body}</Text> : null}
                      {dest ? (
                        <View style={styles.actionRow}>
                          <PressableScale
                            style={styles.actionBtn}
                            onPress={() => {
                              if (!notif.read) markRead(notif.id);
                              router.push(dest as any);
                            }}
                            accessibilityLabel={`${t("notifications.openAction")} — ${notificationTitle(notif)}`}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Text style={styles.actionText}>{t("notifications.openAction")}</Text>
                            <ArrowRight size={13} color={theme.colors.primary} />
                          </PressableScale>
                        </View>
                      ) : null}
                    </View>
                    {!notif.read ? <View style={styles.unreadDot} /> : null}
                  </TouchableOpacity>
                  </ListEntrance>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  // Mark-all-read pill (Move accent pill idiom — icon + uppercase label).
  markAllPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  markAllPillText: { fontSize: 11, letterSpacing: 0.6, fontFamily: fonts.sansBold, color: theme.colors.primary },
  title: { fontSize: 22, fontFamily: fonts.serifBold, color: theme.colors.text, letterSpacing: 0 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  list: { gap: 8 },
  // ── Move hero band — gradient premium surface shown while items exist ──
  hero: { marginBottom: 14 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  heroBody: { flex: 1, minWidth: 0 },
  heroKicker: { fontSize: 10, letterSpacing: 1.2, fontFamily: fonts.sansBold, textTransform: "uppercase", color: theme.colors.primary, marginBottom: 3 },
  heroTitle: { fontSize: 15, fontFamily: fonts.serifBold, color: theme.colors.text },
  heroSub: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 2, lineHeight: 17 },
  heroStats: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  heroStat: {
    overflow: "hidden",
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontFamily: fonts.sansBold,
    color: theme.colors.primary,
  },
  // ── Segmented filter chips (Move surface idiom) ──
  seg: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 13,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 14,
  },
  segBtn: { flex: 1, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  segBtnOn: { backgroundColor: theme.colors.accentSoft, borderWidth: 1, borderColor: theme.colors.accentBorder },
  segText: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.sansBold,
    color: theme.colors.faint,
  },
  segTextOn: { color: theme.colors.primary },
  filterEmpty: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, textAlign: "center", marginTop: 24 },
  notifRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 14 },
  notifUnread: { borderColor: theme.colors.accentBorder, backgroundColor: theme.colors.accentSoft },
  notifChip: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  notifTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0, backgroundColor: theme.colors.primary },
  notifTitle: { flex: 1, fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.text },
  notifTitleRead: { color: theme.colors.dim },
  notifBody: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 2, lineHeight: 17 },
  notifTime: { fontSize: 9, letterSpacing: 0.6, fontFamily: fonts.monoMedium, color: theme.colors.faint, flexShrink: 0, fontVariant: ["tabular-nums"] },
  // ── Inline action CTA — shown only when the href maps to a mobile screen ──
  actionRow: { flexDirection: "row", marginTop: 9 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: 9,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  actionText: { fontSize: 12, fontFamily: fonts.sansSemibold, color: theme.colors.primary },
});
