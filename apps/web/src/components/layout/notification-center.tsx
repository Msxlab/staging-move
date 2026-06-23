"use client";

import { useCallback, useEffect, useRef, useState, type ElementType } from "react";
import { Bell, Receipt, Clock, CheckCircle2, AlertTriangle, Calendar, Info, Megaphone, Users, Plug, RotateCw } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { notificationPatchRequestInit } from "@/lib/notification-feed-client";

interface FeedNotification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  icon?: string | null;
  read: boolean;
  createdAt: string;
}

function notificationPresentation(notification: FeedNotification): {
  icon: ElementType;
  iconColor: string;
  bg: string;
} {
  const key = (notification.icon || notification.type || "").toUpperCase();
  if (key.includes("BILL") || key.includes("RECEIPT")) {
    return { icon: Receipt, iconColor: "text-tone-honey-fg", bg: "bg-tone-honey-bg" };
  }
  if (key.includes("CONTRACT") || key.includes("CLOCK")) {
    return { icon: Clock, iconColor: "text-tone-honey-fg", bg: "bg-tone-honey-bg" };
  }
  if (key.includes("MOVE") || key.includes("CALENDAR")) {
    return { icon: Calendar, iconColor: "text-tone-cyan-fg", bg: "bg-tone-cyan-bg" };
  }
  if (key.includes("MARKETING")) {
    return { icon: Megaphone, iconColor: "text-destructive", bg: "bg-destructive/10" };
  }
  if (key.includes("FAILED") || key.includes("OVERDUE") || key.includes("ALERT")) {
    return { icon: AlertTriangle, iconColor: "text-destructive", bg: "bg-destructive/10" };
  }
  if (key.includes("SYSTEM") || key.includes("INFO")) {
    return { icon: Info, iconColor: "text-tone-sky-fg", bg: "bg-tone-sky-bg" };
  }
  if (key.includes("CONNECTOR")) {
    return { icon: Plug, iconColor: "text-tone-honey-fg", bg: "bg-tone-honey-bg" };
  }
  if (key.includes("WORKSPACE") || key.includes("MEMBER")) {
    return { icon: Users, iconColor: "text-tone-sky-fg", bg: "bg-tone-sky-bg" };
  }
  return { icon: Bell, iconColor: "text-muted-foreground", bg: "bg-foreground/5" };
}

function formatNotificationTime(
  createdAt: string,
  locale: string,
  t: (key: "now" | "minuteShort" | "hourShort" | "dayShort", values?: { count: number }) => string,
) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "";

  const diffMs = Date.now() - created.getTime();
  if (diffMs < 60_000) return t("now");

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return t("minuteShort", { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hourShort", { count: hours });

  const days = Math.floor(hours / 24);
  if (days < 7) return t("dayShort", { count: days });

  return created.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function NotificationCenter() {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // Distinguishes a real fetch failure from a genuinely-empty feed: previously
  // any error reset to [] and showed the "all caught up" empty state, hiding
  // failures from the user (audit notifications-push-05). On error we keep the
  // existing notifications (no destructive reset) and surface a retry block.
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/feed?limit=10", { cache: "no-store" });
      if (!response.ok) throw new Error("NOTIFICATION_FEED_FAILED");
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setError(false);
    } catch {
      // Do not wipe any already-loaded notifications; just flag the failure so
      // the UI can show an error + retry instead of a false "all caught up".
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      if (next) {
        setLoading(true);
        void fetchFeed();
      }
      return next;
    });
  };

  const markRead = async (notification: FeedNotification) => {
    if (notification.read) return;
    setNotifications((current) => current.map((item) => (
      item.id === notification.id ? { ...item, read: true } : item
    )));
    setUnreadCount((current) => Math.max(0, current - 1));
    // The CSRF middleware rejects mutations without a JSON content-type
    // (returns 403 INVALID_CONTENT_TYPE), so even an empty-body PATCH must
    // declare it. Body is `{}` to match the declared type.
    await fetch(`/api/notifications/feed/${notification.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Requested-With": "locateflow" },
      body: "{}",
    }).catch(() => {});
  };

  const markAllRead = async () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/feed?action=read-all", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Requested-With": "locateflow" },
      body: "{}",
    }).catch(() => {});
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground/80 hover:bg-foreground/5 transition"
        onClick={toggleOpen}
        aria-label={t("title")}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-tone-orange-fg text-[9px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] rounded-2xl border border-border backdrop-blur-xl shadow-2xl z-50 overflow-hidden flex flex-col" style={{ background: "color-mix(in srgb, var(--surface-secondary) 95%, transparent)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-tone-orange-bg text-tone-orange-fg text-[10px] font-medium">
                  {t("newCount", { count: unreadCount })}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={() => void markAllRead()} className="text-[10px] text-foreground/40 hover:text-foreground transition">
                {t("markAllReadShort")}
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {/* A refresh failed but we still have a previously-loaded list:
                show a thin inline banner + retry so the failure isn't silent,
                while keeping the stale-but-useful list visible below. */}
            {error && !loading && notifications.length > 0 && (
              <div className="flex items-center justify-between gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20">
                <span className="flex items-center gap-1.5 text-[10px] text-destructive">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {tErrors("serverError")}
                </span>
                <button
                  type="button"
                  onClick={() => { setLoading(true); void fetchFeed(); }}
                  className="inline-flex items-center gap-1 text-[10px] text-destructive hover:underline shrink-0"
                >
                  <RotateCw className="h-2.5 w-2.5" />
                  {tErrors("tryAgain")}
                </button>
              </div>
            )}
            {loading ? (
              <p className="text-sm text-foreground/40 text-center py-8">{t("loading")}</p>
            ) : error && notifications.length === 0 ? (
              <div className="text-center py-8 px-4">
                <AlertTriangle className="h-8 w-8 text-destructive/70 mx-auto mb-2" />
                <p className="text-xs text-foreground/60">{tErrors("serverError")}</p>
                <p className="text-[10px] text-foreground/40 mt-0.5">{tErrors("unexpectedShort")}</p>
                <button
                  type="button"
                  onClick={() => { setLoading(true); void fetchFeed(); }}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[11px] text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition"
                >
                  <RotateCw className="h-3 w-3" />
                  {tErrors("tryAgain")}
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-8 w-8 text-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-foreground/40">{t("allCaughtUp")}</p>
                <p className="text-[10px] text-foreground/25">{t("emptyNow")}</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const presentation = notificationPresentation(notif);
                const Icon = presentation.icon;
                const inner = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-foreground/[0.03] transition cursor-pointer border-b border-foreground/[0.03] ${!notif.read ? "bg-tone-orange-fg/[0.03]" : ""}`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${presentation.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${presentation.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-medium truncate ${notif.read ? "text-muted-foreground" : "text-foreground"}`}>{notif.title}</p>
                        {!notif.read && <span className="h-1.5 w-1.5 rounded-full bg-tone-orange-fg shrink-0" />}
                      </div>
                      {notif.body && <p className="text-[10px] text-foreground/40 mt-0.5 line-clamp-2">{notif.body}</p>}
                    </div>
                    <span className="text-[10px] text-foreground/30 shrink-0">{formatNotificationTime(notif.createdAt, locale, t)}</span>
                  </div>
                );

                return notif.href ? (
                  <Link key={notif.id} href={notif.href} onClick={() => { void markRead(notif); setOpen(false); }}>
                    {inner}
                  </Link>
                ) : (
                  <button key={notif.id} type="button" className="block w-full text-left" onClick={() => void markRead(notif)}>
                    {inner}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5 flex items-center justify-between gap-2">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition"
            >
              {t("viewAll")}
            </Link>
            <Link
              href="/settings/notifications"
              onClick={() => setOpen(false)}
              className="text-[11px] text-foreground/40 hover:text-foreground transition"
            >
              {tCommon("settings")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
