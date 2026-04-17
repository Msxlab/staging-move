"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Receipt, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface Notification {
  id: string;
  type: "bill" | "system";
  title: string;
  description: string;
  href?: string;
  time: string;
  read: boolean;
  icon: React.ElementType;
  color: string;
}

function getDaysUntilBill(billingDay: number): number {
  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  if (billingDay >= currentDay) return billingDay - currentDay;
  return daysInMonth - currentDay + billingDay;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .catch(() => ({ services: [] }))
      .then((svcData) => {
      const notifs: Notification[] = [];
      const now = new Date();

      // Bill reminders
      const services = svcData.services || [];
      services.forEach((s: any) => {
        if (!s.billingDay || !s.monthlyCost) return;
        const days = getDaysUntilBill(s.billingDay);
        if (days <= 3) {
          notifs.push({
            id: `bill-${s.id}`,
            type: "bill",
            title: days === 0 ? `${s.providerName} bill due today` : `${s.providerName} bill in ${days} day${days !== 1 ? "s" : ""}`,
            description: `${formatCurrency(s.monthlyCost)} due on day ${s.billingDay}`,
            href: `/services/${s.id}`,
            time: days === 0 ? "Today" : `${days}d`,
            read: false,
            icon: days === 0 ? AlertTriangle : Receipt,
            color: days === 0 ? "text-red-400" : "text-amber-400",
          });
        }
      });

      // Contract expiring
      services.forEach((s: any) => {
        if (!s.contractEndDate) return;
        const endDate = new Date(s.contractEndDate);
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0 && daysLeft <= 30) {
          notifs.push({
            id: `contract-${s.id}`,
            type: "system",
            title: `${s.providerName} contract expiring`,
            description: `Ends in ${daysLeft} days (${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`,
            href: `/services/${s.id}`,
            time: `${daysLeft}d`,
            read: false,
            icon: Clock,
            color: "text-amber-400",
          });
        }
      });

      setNotifications(notifs);
    }).finally(() => setLoading(false));
  }, []);

  const markRead = (id: string) => setReadIds((prev) => new Set(prev).add(id));
  const markAllRead = () => setReadIds(new Set(notifications.map((n) => n.id)));

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative p-2 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/5 transition"
        onClick={() => setOpen(!open)}
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
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl z-50 overflow-hidden flex flex-col" style={{ background: "color-mix(in srgb, var(--surface-secondary) 95%, transparent)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-white/30 hover:text-white transition">
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <p className="text-sm text-white/30 text-center py-8">Loading...</p>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-8 w-8 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/30">All caught up!</p>
                <p className="text-[10px] text-white/15">No notifications right now</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const Icon = notif.icon;
                const isRead = readIds.has(notif.id);
                const inner = (
                  <div
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition cursor-pointer border-b border-white/[0.03] ${!isRead ? "bg-orange-500/[0.03]" : ""}`}
                    onClick={() => markRead(notif.id)}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                      notif.type === "bill" ? "bg-amber-500/10" : "bg-white/5"
                    }`}>
                      <Icon className={`h-3.5 w-3.5 ${notif.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-medium truncate ${isRead ? "text-white/50" : "text-white"}`}>{notif.title}</p>
                        {!isRead && <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />}
                      </div>
                      <p className="text-[10px] text-white/30 mt-0.5">{notif.description}</p>
                    </div>
                    <span className="text-[10px] text-white/20 shrink-0">{notif.time}</span>
                  </div>
                );

                return notif.href ? (
                  <Link key={notif.id} href={notif.href} onClick={() => { markRead(notif.id); setOpen(false); }}>
                    {inner}
                  </Link>
                ) : (
                  <div key={notif.id}>{inner}</div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 px-4 py-2.5">
            <Link href="/settings/notifications" onClick={() => setOpen(false)}>
              <button className="w-full text-center text-[11px] text-white/30 hover:text-white transition">
                Notification Settings
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
