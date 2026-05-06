"use client";

import { useCallback, useEffect, useRef, useState, type ElementType } from "react";
import { Bell, Receipt, Clock, CheckCircle2, AlertTriangle, Calendar, Info, Megaphone } from "lucide-react";
import Link from "next/link";
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
    return { icon: Receipt, iconColor: "text-amber-400", bg: "bg-amber-500/10" };
  }
  if (key.includes("CONTRACT") || key.includes("CLOCK")) {
    return { icon: Clock, iconColor: "text-amber-400", bg: "bg-amber-500/10" };
  }
  if (key.includes("MOVE") || key.includes("CALENDAR")) {
    return { icon: Calendar, iconColor: "text-cyan-400", bg: "bg-cyan-500/10" };
  }
  if (key.includes("MARKETING")) {
    return { icon: Megaphone, iconColor: "text-rose-400", bg: "bg-rose-500/10" };
  }
  if (key.includes("FAILED") || key.includes("OVERDUE") || key.includes("ALERT")) {
    return { icon: AlertTriangle, iconColor: "text-red-400", bg: "bg-red-500/10" };
  }
  if (key.includes("SYSTEM") || key.includes("INFO")) {
    return { icon: Info, iconColor: "text-blue-400", bg: "bg-blue-500/10" };
  }
  return { icon: Bell, iconColor: "text-muted-foreground", bg: "bg-foreground/5" };
}

function formatNotificationTime(createdAt: string) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "";

  const diffMs = Date.now() - created.getTime();
  if (diffMs < 60_000) return "Now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return created.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/feed?limit=10", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load notifications");
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
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
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-orange-500 text-[9px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] rounded-2xl border border-border backdrop-blur-xl shadow-2xl z-50 overflow-hidden flex flex-col" style={{ background: "color-mix(in srgb, var(--surface-secondary) 95%, transparent)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={() => void markAllRead()} className="text-[10px] text-foreground/40 hover:text-foreground transition">
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <p className="text-sm text-foreground/40 text-center py-8">Loading...</p>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-8 w-8 text-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-foreground/40">All caught up!</p>
                <p className="text-[10px] text-foreground/25">No notifications right now</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const presentation = notificationPresentation(notif);
                const Icon = presentation.icon;
                const inner = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-foreground/[0.03] transition cursor-pointer border-b border-foreground/[0.03] ${!notif.read ? "bg-orange-500/[0.03]" : ""}`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${presentation.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${presentation.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-medium truncate ${notif.read ? "text-muted-foreground" : "text-foreground"}`}>{notif.title}</p>
                        {!notif.read && <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />}
                      </div>
                      {notif.body && <p className="text-[10px] text-foreground/40 mt-0.5 line-clamp-2">{notif.body}</p>}
                    </div>
                    <span className="text-[10px] text-foreground/30 shrink-0">{formatNotificationTime(notif.createdAt)}</span>
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
            <Link href="/notifications" onClick={() => setOpen(false)}>
              <button className="text-[11px] text-muted-foreground hover:text-foreground transition">
                View all
              </button>
            </Link>
            <Link href="/settings/notifications" onClick={() => setOpen(false)}>
              <button className="text-[11px] text-foreground/40 hover:text-foreground transition">
                Settings
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
