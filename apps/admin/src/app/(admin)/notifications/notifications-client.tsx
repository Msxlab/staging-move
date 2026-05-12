"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  Plus,
  Radio,
  Search,
  Send,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmModal } from "@/components/password-confirm-modal";

interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  channel: string;
  read: boolean;
  sent: boolean;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

interface QueueItem {
  id: string;
  title: string;
  type: string;
  channel: string;
  broadcast: boolean;
  sendAt: string;
  createdAt: string;
}

interface Stats {
  total: number;
  unread: number;
  sent: number;
  queued: number;
}

interface UserSearchResult {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface StepUpRequest {
  title: string;
  description: string;
  confirmLabel: string;
  run: (confirmPassword: string) => Promise<boolean>;
}

const TYPES = [
  "SYSTEM",
  "ANNOUNCEMENT",
  "MAINTENANCE",
  "BILLING",
  "SUPPORT",
  "MARKETING",
  "PROMO",
];

const CHANNELS = ["IN_APP", "EMAIL", "PUSH"];
const OPT_OUT_TYPES = new Set(["MARKETING", "PROMO"]);

const EMPTY_STATS: Stats = {
  total: 0,
  unread: 0,
  sent: 0,
  queued: 0,
};

function getRecipientLabel(user: UserSearchResult | null) {
  if (!user) return "";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name ? `${name} (${user.email})` : user.email;
}

export default function NotificationsClient() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientResults, setRecipientResults] = useState<UserSearchResult[]>(
    [],
  );
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [selectedRecipient, setSelectedRecipient] =
    useState<UserSearchResult | null>(null);
  const [stepUp, setStepUp] = useState<StepUpRequest | null>(null);
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const [stepUpError, setStepUpError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    body: "",
    type: "SYSTEM",
    channel: "IN_APP",
    href: "",
    broadcast: true,
    userId: "",
  });

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterChannel) params.set("channel", filterChannel);
    fetch(`/api/notifications?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        setNotifications(data.notifications || []);
        setQueue(data.queue || []);
        setStats(data.stats || EMPTY_STATS);
      })
      .catch(() => toast.error("Failed to load notifications"))
      .finally(() => setLoading(false));
  }, [filterChannel, filterType]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (form.broadcast) {
      setRecipientResults([]);
      setRecipientLoading(false);
      return;
    }

    const query = recipientSearch.trim();
    if (query.length < 2) {
      setRecipientResults([]);
      setRecipientLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setRecipientLoading(true);
      try {
        const response = await fetch(
          `/api/users?search=${encodeURIComponent(query)}&perPage=8`,
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Failed to search users");
        }
        if (!cancelled) {
          setRecipientResults(data.users || []);
        }
      } catch (error: any) {
        if (!cancelled) {
          setRecipientResults([]);
          toast.error(error?.message || "Failed to search users");
        }
      } finally {
        if (!cancelled) {
          setRecipientLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [form.broadcast, recipientSearch]);

  function resetForm() {
    setShowForm(false);
    setSelectedRecipient(null);
    setRecipientSearch("");
    setRecipientResults([]);
    setForm({
      title: "",
      body: "",
      type: "SYSTEM",
      channel: "IN_APP",
      href: "",
      broadcast: true,
      userId: "",
    });
  }

  function requestStepUp(request: StepUpRequest) {
    setStepUp(request);
    setStepUpError(null);
  }

  async function confirmStepUp(confirmPassword: string) {
    if (!stepUp) return;
    setStepUpBusy(true);
    setStepUpError(null);
    try {
      const ok = await stepUp.run(confirmPassword);
      if (ok) setStepUp(null);
    } finally {
      setStepUpBusy(false);
    }
  }

  function closeStepUp() {
    if (stepUpBusy) return;
    setStepUp(null);
    setStepUpError(null);
  }

  async function sendPayload(payload: typeof form & { confirmPassword?: string }): Promise<boolean> {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data.error || "Failed to send notification";
      if (data.requiresPassword || response.status === 401 || response.status === 403) {
        setStepUpError(message);
      }
      toast.error(message);
      return false;
    }

    const channelExtra =
      payload.channel === "EMAIL"
        ? ` · email delivered ${data.emailDelivered ?? 0}, skipped ${data.emailSkipped ?? 0}`
        : payload.channel === "PUSH"
          ? ` · push delivered ${data.pushDelivered ?? 0}, skipped ${data.pushSkipped ?? 0}`
          : "";

    toast.success(
      payload.broadcast
        ? `Broadcast sent to ${data.count} users${channelExtra}`
        : `Notification sent${channelExtra}`,
    );
    resetForm();
    load();
    return true;
  }

  async function send() {
    if (!form.title || !form.body) {
      toast.error("Title and body required");
      return;
    }
    if (!form.broadcast && !form.userId) {
      toast.error("Select a user before sending a direct notification");
      return;
    }

    const payload = { ...form };
    if (payload.broadcast) {
      requestStepUp({
        title: "Confirm broadcast",
        description: "Enter your admin password before broadcasting this notification.",
        confirmLabel: "Send broadcast",
        run: (confirmPassword) => sendPayload({ ...payload, confirmPassword }),
      });
      return;
    }

    await sendPayload(payload);
  }

  function selectRecipient(user: UserSearchResult) {
    setSelectedRecipient(user);
    setRecipientSearch(getRecipientLabel(user));
    setRecipientResults([]);
    setForm((current) => ({
      ...current,
      broadcast: false,
      userId: user.id,
    }));
  }

  const statCards = [
    {
      label: "Total Sent",
      value: stats.total,
      icon: Bell,
      color: "text-tone-sky-fg",
      bg: "bg-tone-sky-bg",
    },
    {
      label: "Unread",
      value: stats.unread,
      icon: Eye,
      color: "text-tone-honey-fg",
      bg: "bg-tone-honey-bg",
    },
    {
      label: "Delivered",
      value: stats.sent,
      icon: CheckCircle2,
      color: "text-tone-sage-fg",
      bg: "bg-tone-sage-bg",
    },
    {
      label: "Queue Records",
      value: stats.queued,
      icon: Clock,
      color: "text-tone-foil-fg",
      bg: "bg-tone-foil-bg",
    },
  ];

  return (
    <div className="space-y-6">
      <PasswordConfirmModal
        open={Boolean(stepUp)}
        title={stepUp?.title || "Confirm action"}
        description={stepUp?.description || "Enter your admin password to continue."}
        confirmLabel={stepUp?.confirmLabel || "Confirm"}
        busy={stepUpBusy}
        error={stepUpError}
        onClose={closeStepUp}
        onConfirm={confirmStepUp}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
          <p className="mt-1 text-muted-foreground">
            Send broadcasts, target individual users, and inspect delivery
            records.
          </p>
        </div>
        <button
          onClick={() => setShowForm((current) => !current)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Send Notification
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {card.value.toLocaleString()}
                </p>
              </div>
              <div className={`rounded-lg p-2.5 ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-tone-honey-fg" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">
              Delivery is synchronous and unscheduled.
            </p>
            <p className="text-muted-foreground">
              Every send writes the in-app feed row immediately. EMAIL also
              fans out via Resend; PUSH also fans out via Expo (requires
              NOTIFICATION_PUSH_ENABLED=true). MARKETING and PROMO respect
              per-user opt-out. Audiences over 100k must use a worker job.
            </p>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Send Notification
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Title
              </label>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder="Notification title"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Type
              </label>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Body
              </label>
              <textarea
                value={form.body}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    body: event.target.value,
                  }))
                }
                rows={4}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder="Notification message"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Channel
              </label>
              <select
                value={form.channel}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    channel: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                {form.channel === "IN_APP"
                  ? "Writes a row to each user's in-app feed."
                  : form.channel === "EMAIL"
                    ? "Mirrors to the in-app feed and emails each user."
                    : "Mirrors to the in-app feed and pushes to all registered devices."}
                {OPT_OUT_TYPES.has(form.type)
                  ? " MARKETING/PROMO respects per-user opt-out."
                  : ""}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Link (optional)
              </label>
              <input
                value={form.href}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    href: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder="/dashboard"
              />
            </div>
            <div className="col-span-2 flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  checked={form.broadcast}
                  onChange={() => {
                    setSelectedRecipient(null);
                    setRecipientSearch("");
                    setRecipientResults([]);
                    setForm((current) => ({
                      ...current,
                      broadcast: true,
                      userId: "",
                    }));
                  }}
                  className="accent-primary"
                />
                <Radio className="h-4 w-4" /> Broadcast to all users
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  checked={!form.broadcast}
                  onChange={() =>
                    setForm((current) => ({ ...current, broadcast: false }))
                  }
                  className="accent-primary"
                />
                <Users className="h-4 w-4" /> Specific user
              </label>
            </div>

            {!form.broadcast && (
              <div className="col-span-2 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">
                    Search user
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={recipientSearch}
                      onChange={(event) => {
                        setSelectedRecipient(null);
                        setForm((current) => ({
                          ...current,
                          userId: "",
                          broadcast: false,
                        }));
                        setRecipientSearch(event.target.value);
                      }}
                      className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-sm text-foreground"
                      placeholder="Search by name or email"
                    />
                  </div>
                </div>

                {selectedRecipient && (
                  <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <UserRound className="h-4 w-4 text-primary" />
                      <span>{getRecipientLabel(selectedRecipient)}</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedRecipient(null);
                        setRecipientSearch("");
                        setForm((current) => ({
                          ...current,
                          userId: "",
                          broadcast: false,
                        }));
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-accent"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {recipientLoading ? (
                  <div className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
                    Searching users...
                  </div>
                ) : recipientResults.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-border bg-background">
                    {recipientResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => selectRecipient(user)}
                        className="flex w-full items-center justify-between border-b border-border px-3 py-3 text-left last:border-b-0 hover:bg-accent/40"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {[user.firstName, user.lastName]
                              .filter(Boolean)
                              .join(" ") || user.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {user.id.slice(0, 8)}...
                        </span>
                      </button>
                    ))}
                  </div>
                ) : recipientSearch.trim().length >= 2 ? (
                  <div className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
                    No matching users found.
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Search by name or email instead of pasting raw user IDs.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={send}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Send className="h-4 w-4" /> Send
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <select
          value={filterType}
          onChange={(event) => setFilterType(event.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="">All Types</option>
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select
          value={filterChannel}
          onChange={(event) => setFilterChannel(event.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="">All Channels</option>
          {CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Delivery Queue
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Read-only visibility into queued records until a delivery worker is
              enabled.
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {queue.length} visible
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            No queued records currently visible.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Send At</th>
                  <th className="px-4 py-3 font-medium">Queued</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border last:border-b-0 hover:bg-accent/20"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.type}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {item.broadcast ? "Broadcast" : "Direct"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {item.channel}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(item.sendAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Channel</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Loading...
                </td>
              </tr>
            ) : notifications.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No notifications
                </td>
              </tr>
            ) : (
              notifications.map((notification) => (
                <tr
                  key={notification.id}
                  className="border-b border-border hover:bg-accent/30"
                >
                  <td className="px-4 py-3 text-foreground">
                    {notification.user?.email || notification.userId}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">
                      {notification.title}
                    </div>
                    <div className="max-w-xs truncate text-xs text-muted-foreground">
                      {notification.body}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {notification.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {notification.channel}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        notification.read
                          ? "bg-tone-sage-bg text-tone-sage-fg"
                          : "bg-tone-honey-bg text-tone-honey-fg"
                      }`}
                    >
                      {notification.read ? "Read" : "Unread"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
