"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  Crown,
  Loader2,
  Receipt,
  Truck,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { notificationPatchRequestInit } from "@/lib/notification-feed-client";

interface FeedNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

type FeedFilter = "all" | "unread" | "reminders" | "workspace";

// Time-bound / reminder-shaped feed types — mirrors REMINDER_TYPES in
// apps/mobile/app/notifications/index.tsx (Aurora P1-C honest mapping) so
// "Reminders" means the same thing in both inboxes.
const REMINDER_TYPES = new Set([
  "BILL_REMINDER",
  "BILL_OVERDUE",
  "CONTRACT_EXPIRY",
  "TASK_REMINDER",
  "TASK_DUE",
  "MOVE_ALERT",
  "MOVE_REMINDER",
]);

const FILTERS: FeedFilter[] = ["all", "unread", "reminders", "workspace"];

function matchesFilter(notif: FeedNotification, filter: FeedFilter): boolean {
  if (filter === "all") return true;
  if (filter === "unread") return !notif.read;
  if (filter === "reminders") return REMINDER_TYPES.has(notif.type);
  return notif.type === "WORKSPACE_MEMBERSHIP";
}

// A friendly icon + tone per notification type so the feed reads like a real
// inbox instead of identical grey dots — mirrors presentationFor() on mobile.
// Honey is reserved for the subscription/premium rows only (Edition VII rule).
function presentationFor(type: string): { Icon: LucideIcon; chip: string; icon: string } {
  switch (type) {
    case "BILL_REMINDER":
      return { Icon: Receipt, chip: "bg-primary/10", icon: "text-primary" };
    case "BILL_OVERDUE":
      return { Icon: AlertTriangle, chip: "bg-destructive/10", icon: "text-destructive" };
    case "CONTRACT_EXPIRY":
      return { Icon: Clock, chip: "bg-tone-amber-bg", icon: "text-tone-amber-fg" };
    case "TASK_REMINDER":
    case "TASK_DUE":
      return { Icon: CheckCircle2, chip: "bg-tone-emerald-bg", icon: "text-tone-emerald-fg" };
    case "MOVE_ALERT":
    case "MOVE_REMINDER":
      return { Icon: Truck, chip: "bg-primary/10", icon: "text-primary" };
    case "WORKSPACE_MEMBERSHIP":
      return { Icon: Users, chip: "bg-tone-sky-bg", icon: "text-tone-sky-fg" };
    case "CONNECTOR_ACTION_NEEDED":
      return { Icon: Zap, chip: "bg-tone-amber-bg", icon: "text-tone-amber-fg" };
    case "SUBSCRIPTION":
    case "ACCOUNT_UPDATED":
      return { Icon: Crown, chip: "bg-tone-honey-bg", icon: "text-tone-honey-fg" };
    default:
      return { Icon: Bell, chip: "bg-foreground/5", icon: "text-muted-foreground" };
  }
}

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const tEmpty = useTranslations("empty");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>("all");

  const fetchFeed = useCallback(async () => {
    const res = await fetch("/api/notifications/feed");
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    }
  }, []);

  useEffect(() => {
    fetchFeed().finally(() => setLoading(false));
  }, [fetchFeed]);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/feed/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Requested-With": "locateflow" },
      body: "{}",
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
    const res = await fetch(`/api/notifications/feed/${id}`, notificationPatchRequestInit()).catch(() => null);
    if (!res?.ok) {
      toast.error("Failed to mark notification as read");
      await fetchFeed();
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/feed?action=read-all", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Requested-With": "locateflow" },
        body: "{}",
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
        toast.success(t("markAllRead"));
      } else {
        toast.error("Failed to mark notifications as read");
        await fetchFeed();
      }
    } catch {
      toast.error("Failed to mark notifications as read");
      await fetchFeed();
    } finally {
      setMarkingAll(false);
    }
  };

  const visible = notifications.filter((n) => matchesFilter(n, filter));

  return (
    <div className="space-y-6 pb-8 max-w-2xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("eyebrow")}</p>
          <h1 className="h2 font-display mt-1 text-foreground">
            {t("headingPrefix")} <em className="text-primary not-italic">{t("headingAccent")}</em>
          </h1>
          <p className="mt-1 text-sm text-foreground/45">{t("pageSub")}</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-xl border border-border text-muted-foreground text-xs hover:text-foreground hover:border-foreground/20 transition"
          >
            {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            {t("markAllRead")}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-foreground/30" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-12 text-center">
          <Bell className="h-10 w-10 text-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{tEmpty("notifications")}</p>
          <p className="text-foreground/30 text-xs mt-1">{tEmpty("notificationsDescription")}</p>
        </div>
      ) : (
        <>
          {/* Aurora hero band — destructive-soft card shown while unread items exist */}
          {unreadCount > 0 && (
            <div className="flex items-center gap-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-5 py-4">
              <span className="min-w-[2.5rem] text-center font-mono text-3xl font-bold tabular-nums text-destructive">
                {unreadCount}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-destructive">
                  {t("unread", { count: unreadCount })}
                </p>
                <p className="font-display text-sm font-semibold text-foreground mt-0.5">{t("heroTitle")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("heroSubtitle")}</p>
              </div>
            </div>
          )}

          {/* Filter chips — All / Unread + the kind groupings the feed actually emits */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("title")}>
            {FILTERS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                aria-pressed={filter === k}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filter === k
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-foreground/5 text-muted-foreground border border-transparent hover:bg-foreground/10"
                }`}
              >
                {t(`filter_${k}`)}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="py-10 text-center text-xs text-foreground/35">{t("filterEmpty")}</p>
          ) : (
            <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] overflow-hidden divide-y divide-foreground/[0.04]">
              {visible.map((notif) => {
                const { Icon, chip, icon } = presentationFor(notif.type);
                const inner = (
                  <div
                    className={`flex items-start gap-3.5 px-5 py-4 hover:bg-foreground/[0.03] transition cursor-pointer ${!notif.read ? "bg-primary/5" : ""}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${chip}`}>
                      <Icon className={`h-4 w-4 ${icon}`} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className={`text-sm font-medium ${notif.read ? "text-muted-foreground" : "text-foreground"}`}>{notif.title}</p>
                        {!notif.read && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" aria-hidden />}
                      </div>
                      {notif.body && <p className="text-xs text-foreground/40 mt-0.5">{notif.body}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-foreground/30">
                          {new Date(notif.createdAt).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}
                          {" · "}
                          {new Date(notif.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {/* Inline action — only when the row already carries a destination */}
                        {notif.href && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            {t("openAction")}
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );

                return notif.href ? (
                  <Link key={notif.id} href={notif.href} onClick={() => !notif.read && markRead(notif.id)}>
                    {inner}
                  </Link>
                ) : (
                  <button key={notif.id} type="button" className="block w-full text-left" onClick={() => !notif.read && markRead(notif.id)}>
                    {inner}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="text-center">
        <Link href="/settings/notifications" className="text-xs text-foreground/35 hover:text-muted-foreground transition">
          {tNav("notificationSettings")} →
        </Link>
      </div>
    </div>
  );
}
