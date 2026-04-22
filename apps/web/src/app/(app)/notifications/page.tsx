"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Loader2, CheckCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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
    await fetch(`/api/notifications/feed/${id}`, { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/feed?action=read-all", { method: "PATCH" });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
        toast.success("All notifications marked as read.");
      }
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="space-y-6 pb-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-white/40 mt-1">{unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 text-white/40 text-xs hover:text-white hover:border-white/20 transition"
          >
            {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/20" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <Bell className="h-10 w-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No notifications yet</p>
          <p className="text-white/20 text-xs mt-1">You'll see important updates here</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.04]">
          {notifications.map((notif) => {
            const inner = (
              <div
                className={`flex items-start gap-4 px-5 py-4 hover:bg-white/[0.03] transition cursor-pointer ${!notif.read ? "bg-orange-500/[0.03]" : ""}`}
                onClick={() => !notif.read && markRead(notif.id)}
              >
                <div className={`h-2 w-2 rounded-full mt-2 shrink-0 ${notif.read ? "bg-transparent" : "bg-orange-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${notif.read ? "text-white/50" : "text-white"}`}>{notif.title}</p>
                  {notif.body && <p className="text-xs text-white/30 mt-0.5">{notif.body}</p>}
                  <p className="text-[10px] text-white/20 mt-1.5">
                    {new Date(notif.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {" · "}
                    {new Date(notif.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );

            return notif.href ? (
              <Link key={notif.id} href={notif.href} onClick={() => !notif.read && markRead(notif.id)}>
                {inner}
              </Link>
            ) : (
              <div key={notif.id}>{inner}</div>
            );
          })}
        </div>
      )}

      <div className="text-center">
        <Link href="/settings/notifications" className="text-xs text-white/25 hover:text-white/50 transition">
          Manage notification preferences →
        </Link>
      </div>
    </div>
  );
}
