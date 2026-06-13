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
  ArrowLeft,
  Bell,
  CalendarClock,
  ChevronRight,
  RefreshCw,
  Receipt,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Truck,
  type LucideIcon,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import {
  buildUpcomingFeed,
  daysUntil,
  type ServiceLike,
  type UpcomingItem,
} from "@/lib/service-insights";

/**
 * Reminders Center — one "what's coming up" list aggregating:
 *   - upcoming service renewals / next-bill dates (derived client-side from
 *     each service's contractEndDate or billingDay+cycle — no schema change), and
 *   - the user's notification feed reminders (BILL_REMINDER, CONTRACT_EXPIRY,
 *     TASK_DUE/REMINDER, MOVE_REMINDER, …), which are the existing reminders.
 *
 * Everything is merged into a single date-sorted timeline. Calm + on-brand:
 * skeleton on load, a raccoon EmptyState when nothing's coming up, soon-due
 * items highlighted. The list GET doesn't include per-service Reminder rows in
 * bulk, so standalone reminders come via the notifications feed (which the cron
 * already materializes from those Reminder/Notification rows).
 */

interface FeedNotification {
  id: string;
  type: string;
  title: string;
  body?: string;
  href?: string;
  read: boolean;
  createdAt: string;
  sendAt?: string;
}

/** A unified row the screen renders — either a derived renewal or a feed item. */
interface TimelineRow {
  key: string;
  kind: "renewal" | "notification";
  title: string;
  subtitle?: string;
  date: Date;
  days: number; // whole days until date (negative = overdue)
  Icon: LucideIcon;
  tint: string;
  source?: UpcomingItem["source"];
  serviceId?: string;
  notificationHref?: string;
}

// Notification-feed types that represent something time-bound / actionable. The
// feed is also a generic inbox, so we keep only reminder-shaped entries here.
const REMINDER_FEED_TYPES = new Set([
  "BILL_REMINDER",
  "BILL_OVERDUE",
  "CONTRACT_EXPIRY",
  "TASK_REMINDER",
  "TASK_DUE",
  "MOVE_ALERT",
  "MOVE_REMINDER",
]);

function feedPresentation(type: string, theme: Theme): { Icon: LucideIcon; tint: string } {
  switch (type) {
    case "BILL_REMINDER": return { Icon: Receipt, tint: theme.colors.primary };
    case "BILL_OVERDUE": return { Icon: AlertTriangle, tint: theme.colors.error };
    case "CONTRACT_EXPIRY": return { Icon: Clock, tint: theme.colors.amber.text };
    case "TASK_REMINDER":
    case "TASK_DUE": return { Icon: CheckCircle2, tint: theme.colors.emerald.text };
    case "MOVE_ALERT":
    case "MOVE_REMINDER": return { Icon: Truck, tint: theme.colors.primary };
    default: return { Icon: Bell, tint: theme.colors.textTertiary };
  }
}

export default function RemindersScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const [services, setServices] = useState<ServiceLike[]>([]);
  const [feed, setFeed] = useState<FeedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [svcRes, feedRes] = await Promise.all([
      api.get<any>("/api/services", { limit: "200" }),
      // Notification feed carries the materialized reminder rows. Best-effort:
      // an error here still lets renewals render.
      api.get<any>("/api/notifications/feed", { limit: "50" }),
    ]);
    if (svcRes.error && feedRes.error) {
      setError(svcRes.error || feedRes.error || "Could not load reminders.");
      return false;
    }
    setServices(svcRes.data?.services || []);
    setFeed(feedRes.data?.notifications || []);
    setError(null);
    return true;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchAll();
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  useEffect(() => { load(); }, [load]);

  const dateLocale = (i18n.language || "en").toLowerCase().startsWith("es") ? "es-ES" : "en-US";

  // Merge derived renewals + reminder-shaped feed entries into one date-sorted
  // timeline. Recomputed only when inputs change.
  const rows = useMemo<TimelineRow[]>(() => {
    const now = new Date();

    // 1) Service renewals (reminders[] aren't included in the list GET, so we
    // pass [] for reminders here and pull standalone reminders from the feed).
    const renewalRows: TimelineRow[] = buildUpcomingFeed(services, [], now, 60)
      .filter((u) => u.kind === "renewal")
      .map((u) => {
        const overdue = u.days < 0;
        const soon = u.days >= 0 && u.days <= 7;
        const tint = overdue ? theme.colors.error : soon ? theme.colors.amber.text : theme.colors.primary;
        return {
          key: u.key,
          kind: "renewal" as const,
          title: u.title,
          subtitle: u.subtitle,
          date: u.date,
          days: u.days,
          Icon: u.source === "contract" ? CalendarClock : RefreshCw,
          tint,
          source: u.source,
          serviceId: u.serviceId,
        };
      });

    // 2) Reminder-shaped notification-feed entries. Use sendAt when present
    // (the scheduled time), else createdAt; drop anything far in the past.
    const feedRows: TimelineRow[] = feed
      .filter((n) => REMINDER_FEED_TYPES.has(n.type))
      .map((n) => {
        const d = new Date(n.sendAt || n.createdAt);
        return { n, d };
      })
      .filter(({ d }) => !Number.isNaN(d.getTime()) && daysUntil(d, now) >= -3)
      .map(({ n, d }) => {
        const { Icon, tint } = feedPresentation(n.type, theme);
        return {
          key: `feed-${n.id}`,
          kind: "notification" as const,
          title: n.title,
          subtitle: n.body,
          date: d,
          days: daysUntil(d, now),
          Icon,
          tint,
          notificationHref: n.href,
        };
      });

    return [...renewalRows, ...feedRows].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [services, feed, theme]);

  const relativeLabel = (days: number, date: Date): string => {
    if (days < 0) return t("reminders.overdue", { defaultValue: "Overdue" });
    if (days === 0) return t("reminders.today", { defaultValue: "Today" });
    if (days === 1) return t("reminders.tomorrow", { defaultValue: "Tomorrow" });
    if (days <= 14) return t("reminders.inDays", { count: days, defaultValue: `in ${days} days` });
    return date.toLocaleDateString(dateLocale, { month: "short", day: "numeric" });
  };

  const handleRowPress = (row: TimelineRow) => {
    if (row.serviceId) {
      router.push({ pathname: "/services/[id]", params: { id: row.serviceId } });
    } else if (row.notificationHref) {
      router.push(row.notificationHref as any);
    } else {
      router.push("/notifications");
    }
  };

  const overdueCount = rows.filter((row) => row.days < 0).length;
  const soonCount = rows.filter((row) => row.days >= 0 && row.days <= 7).length;
  const renewalCount = rows.filter((row) => row.kind === "renewal").length;
  const reminderCount = rows.length - renewalCount;
  const nextRow = rows[0] || null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t("common.back")}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("reminders.title", { defaultValue: "Reminders" })}</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.scrollContent}>
          <View style={styles.list}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonCard key={i} lines={2} />
            ))}
          </View>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        >
          {rows.length > 0 ? (
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <CalendarClock size={22} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.heroKicker}>{t("reminders.heroKicker", { defaultValue: "REMINDER COMMAND" })}</Text>
                <Text style={styles.heroTitle}>
                  {nextRow
                    ? t("reminders.heroTitleNext", {
                        defaultValue: "Next: {{title}}",
                        title: nextRow.title,
                      })
                    : t("reminders.heroTitle", { defaultValue: "Your upcoming timeline" })}
                </Text>
                <Text style={styles.heroSub} numberOfLines={2}>
                  {nextRow
                    ? `${relativeLabel(nextRow.days, nextRow.date)} - ${nextRow.date.toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}`
                    : t("reminders.heroDescription", { defaultValue: "Renewals and reminders stay grouped by urgency." })}
                </Text>
              </View>
            </View>
          ) : null}

          {error && rows.length === 0 ? (
            <ErrorState message={error} onRetry={load} />
          ) : rows.length === 0 ? (
            <EmptyState
              mascot="mom"
              icon={<Bell size={32} color={theme.colors.primary} />}
              title={t("reminders.emptyTitle", { defaultValue: "Nothing coming up" })}
              description={t("reminders.emptyDescription", {
                defaultValue: "Renewals and reminders for your services will show up here so nothing slips by.",
              })}
              actionLabel={t("services.title", { defaultValue: "Services" })}
              onAction={() => router.push("/(tabs)/services")}
            />
          ) : (
            <>
              <View style={styles.statGrid}>
                {[
                  { label: t("reminders.overdue", { defaultValue: "Overdue" }), value: overdueCount, tone: theme.colors.error, Icon: AlertTriangle },
                  { label: t("reminders.soon", { defaultValue: "Soon" }), value: soonCount, tone: theme.colors.amber.text, Icon: Clock },
                  { label: t("reminders.renewalLabel", { defaultValue: "Renewal" }), value: renewalCount, tone: theme.colors.primary, Icon: RefreshCw },
                  { label: t("reminders.reminderLabel", { defaultValue: "Reminder" }), value: reminderCount, tone: theme.colors.emerald.text, Icon: Bell },
                ].map(({ label, value, tone, Icon }) => (
                  <View key={label} style={styles.statChip}>
                    <Icon size={13} color={tone} />
                    <Text style={styles.statValue}>{value}</Text>
                    <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.intro}>
                {t("reminders.intro", { count: rows.length, defaultValue: `${rows.length} coming up` })}
              </Text>
              <View style={styles.list}>
                {rows.map((row) => {
                  const Icon = row.Icon;
                  const urgent = row.days <= 7;
                  return (
                    <TouchableOpacity
                      key={row.key}
                      style={[styles.row, urgent && { borderColor: row.tint + "44" }]}
                      onPress={() => handleRowPress(row)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.rowIcon, { backgroundColor: row.tint + "22" }]}>
                        <Icon size={18} color={row.tint} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.rowTop}>
                          <Text style={styles.rowTitle} numberOfLines={1}>{row.title}</Text>
                          <Text style={[styles.rowWhen, { color: row.tint }]}>{relativeLabel(row.days, row.date)}</Text>
                        </View>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {row.kind === "renewal"
                            ? (row.source === "contract"
                                ? t("reminders.contractLabel", { defaultValue: "Contract" })
                                : t("reminders.renewalLabel", { defaultValue: "Renewal" }))
                            : t("reminders.reminderLabel", { defaultValue: "Reminder" })}
                          {row.subtitle ? ` · ${row.subtitle}` : ""}
                          {` · ${row.date.toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}`}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: theme.radius["2xl"],
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.border,
    marginBottom: 12,
    ...theme.shadow.glow,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.primary + "30",
  },
  heroKicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: theme.colors.textTertiary },
  heroTitle: { marginTop: 3, fontSize: 18, fontWeight: "800", color: theme.colors.text },
  heroSub: { marginTop: 4, fontSize: 12, color: theme.colors.textTertiary, lineHeight: 17 },
  statGrid: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statChip: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 2,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  statValue: { fontSize: 13, fontWeight: "800", color: theme.colors.text, fontVariant: ["tabular-nums"] },
  statLabel: { maxWidth: "100%", fontSize: 9.5, color: theme.colors.textTertiary },
  intro: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 12, marginLeft: 4 },
  list: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: theme.colors.text },
  rowWhen: { fontSize: 12, fontWeight: "700", flexShrink: 0 },
  rowSub: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
});
