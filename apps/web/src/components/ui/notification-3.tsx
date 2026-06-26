"use client";

import React, { useMemo, useState } from "react";
import {
  Bell,
  BellOff,
  CalendarClock,
  CheckCircle2,
  MessageSquareReply,
  RefreshCw,
  UserPlus,
  Check,
  X,
} from "lucide-react";

/* ---------------------------------------------------------------------------
 * Notification3 — LocateFlow reminders & notifications panel.
 *
 * Re-themed off the watermelon "notification-3" registry card (which shipped a
 * Merged / Deploy / Review GitHub-style feed with hardcoded emerald / sky /
 * violet accents and dark:#hex overrides). Every accent, surface, tab and
 * action now resolves through our sapphire CSS-var theme (bg-card / bg-muted /
 * border-border / text-primary / text-success). ZERO gold/amber, no dark:#hex.
 *
 * Repurposed content + logic: the activity feed becomes the LocateFlow
 * reminders centre — "Reminder due", "Provider replied", "Renewal in 3 days",
 * "Family member joined" — with All / New / Tasks / Digest tabs, inline
 * accept / decline actions on actionable items, and the "All caught up"
 * empty state.
 * ------------------------------------------------------------------------- */

type NotifKind = "reminder" | "reply" | "renewal" | "family";
type TabKey = "all" | "new" | "tasks" | "digest";

interface NotifItem {
  id: string;
  kind: NotifKind;
  title: string;
  detail: string;
  time: string;
  unread: boolean;
  /** Actionable items render inline accept / decline buttons. */
  actionable?: boolean;
}

const DEFAULT_ITEMS: NotifItem[] = [
  {
    id: "n1",
    kind: "reminder",
    title: "Reminder due: Transfer council tax",
    detail: "Notify your current council before the move date on Jul 2.",
    time: "Due today",
    unread: true,
    actionable: true,
  },
  {
    id: "n2",
    kind: "reply",
    title: "Provider replied — BrightFiber Broadband",
    detail: "Installation slot offered for Jul 5, 9am–12pm. Confirm to book.",
    time: "12m ago",
    unread: true,
    actionable: true,
  },
  {
    id: "n3",
    kind: "renewal",
    title: "Renewal in 3 days — Home contents insurance",
    detail: "AcornCover renews at £18.40/mo. Review before it auto-charges.",
    time: "2h ago",
    unread: true,
  },
  {
    id: "n4",
    kind: "family",
    title: "Family member joined — Priya",
    detail: "Priya accepted your invite and can now see the move dossier.",
    time: "Yesterday",
    unread: false,
  },
  {
    id: "n5",
    kind: "renewal",
    title: "Subscription imported — Netflix",
    detail: "Found on your March statement and added to recurring costs.",
    time: "2 days ago",
    unread: false,
  },
];

const KIND_META: Record<
  NotifKind,
  { icon: React.ReactNode; tint: string }
> = {
  reminder: {
    icon: <CalendarClock className="h-4 w-4" />,
    tint: "bg-primary/10 text-primary",
  },
  reply: {
    icon: <MessageSquareReply className="h-4 w-4" />,
    tint: "bg-primary/10 text-primary",
  },
  renewal: {
    icon: <RefreshCw className="h-4 w-4" />,
    tint: "bg-muted text-muted-foreground",
  },
  family: {
    icon: <UserPlus className="h-4 w-4" />,
    tint: "bg-success/15 text-success",
  },
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "tasks", label: "Tasks" },
  { key: "digest", label: "Digest" },
];

interface Notification3Props {
  items?: NotifItem[];
}

export const Notification3: React.FC<Notification3Props> = ({
  items = DEFAULT_ITEMS,
}) => {
  const [tab, setTab] = useState<TabKey>("all");
  const [list, setList] = useState<NotifItem[]>(items);

  const unreadCount = useMemo(
    () => list.filter((i) => i.unread).length,
    [list],
  );

  const visible = useMemo(() => {
    switch (tab) {
      case "new":
        return list.filter((i) => i.unread);
      case "tasks":
        return list.filter((i) => i.actionable);
      case "digest":
        return list.filter((i) => i.kind === "renewal");
      default:
        return list;
    }
  }, [list, tab]);

  const markAllRead = () =>
    setList((prev) => prev.map((i) => ({ ...i, unread: false })));

  const resolve = (id: string) =>
    setList((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, unread: false, actionable: false } : i,
      ),
    );

  const dismiss = (id: string) =>
    setList((prev) => prev.filter((i) => i.id !== id));

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card font-sans shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bell className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "No unread items"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="rounded-full px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
        >
          Mark all read
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border px-2 py-2">
        {TABS.map((t) => {
          const active = tab === t.key;
          const count =
            t.key === "new"
              ? unreadCount
              : t.key === "tasks"
                ? list.filter((i) => i.actionable).length
                : 0;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span
                  className={`rounded-full px-1.5 text-[10px] font-semibold ${
                    active
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {visible.length > 0 ? (
        <ul className="divide-y divide-border">
          {visible.map((item) => {
            const meta = KIND_META[item.kind];
            return (
              <li
                key={item.id}
                className={`flex gap-3 px-4 py-3 transition-colors hover:bg-muted/40 ${
                  item.unread ? "bg-primary/5" : ""
                }`}
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tint}`}
                >
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    {item.unread && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground/80">{item.time}</span>
                    {item.actionable && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => resolve(item.id)}
                          className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          <Check className="h-3 w-3" />
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => dismiss(item.id)}
                          className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        /* All caught up empty state */
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
            {tab === "new" ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <BellOff className="h-6 w-6" />
            )}
          </span>
          <p className="text-sm font-medium text-foreground">All caught up</p>
          <p className="mt-1 max-w-[14rem] text-xs text-muted-foreground">
            {tab === "tasks"
              ? "No reminders need your action right now."
              : tab === "digest"
                ? "No renewals or imports to review."
                : "You have no new notifications. We'll let you know when something needs you."}
          </p>
        </div>
      )}
    </div>
  );
};

export default Notification3;
