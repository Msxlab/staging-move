"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Loader2, CheckCheck } from "lucide-react";
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

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const tEmpty = useTranslations("empty");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

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

  return (
    <div className="space-y-6 pb-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">{unreadCount}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border text-muted-foreground text-xs hover:text-foreground hover:border-foreground/20 transition"
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
        <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] overflow-hidden divide-y divide-foreground/[0.04]">
          {notifications.map((notif) => {
            const inner = (
              <div
                className={`flex items-start gap-4 px-5 py-4 hover:bg-foreground/[0.03] transition cursor-pointer ${!notif.read ? "bg-tone-orange-fg/[0.03]" : ""}`}
              >
                <div className={`h-2 w-2 rounded-full mt-2 shrink-0 ${notif.read ? "bg-transparent" : "bg-tone-orange-fg"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${notif.read ? "text-muted-foreground" : "text-foreground"}`}>{notif.title}</p>
                  {notif.body && <p className="text-xs text-foreground/40 mt-0.5">{notif.body}</p>}
                  <p className="text-[10px] text-foreground/30 mt-1.5">
                    {new Date(notif.createdAt).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}
                    {" Â· "}
                    {new Date(notif.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                  </p>
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

      <div className="text-center">
        <Link href="/settings/notifications" className="text-xs text-foreground/35 hover:text-muted-foreground transition">
          {tNav("notificationSettings")} â†’
        </Link>
      </div>
    </div>
  );
}
