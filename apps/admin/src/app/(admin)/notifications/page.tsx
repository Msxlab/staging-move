"use client";

import { useState, useEffect } from "react";
import { Bell, Send, Users, Radio, Filter, Plus, Eye, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

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
  user?: { id: string; email: string; firstName: string | null; lastName: string | null };
}

interface Stats { total: number; unread: number; sent: number; queued: number }

const TYPES = ["SYSTEM", "BILL_REMINDER", "MOVE_REMINDER", "REVIEW_STATUS", "MARKETING", "TASK_DUE", "CONTRACT_EXPIRY"];
const CHANNELS = ["IN_APP", "EMAIL", "PUSH"];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, unread: 0, sent: 0, queued: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterChannel, setFilterChannel] = useState("");

  const [form, setForm] = useState({ title: "", body: "", type: "SYSTEM", channel: "IN_APP", href: "", broadcast: true, userId: "" });

  const load = () => {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterChannel) params.set("channel", filterChannel);
    fetch(`/api/notifications?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setNotifications(data.notifications || []);
        setStats(data.stats || { total: 0, unread: 0, sent: 0, queued: 0 });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterType, filterChannel]);

  const send = async () => {
    if (!form.title || !form.body) { toast.error("Title and body required"); return; }
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = await res.json();
      toast.success(form.broadcast ? `Broadcast sent to ${data.count} users` : "Notification sent");
      setShowForm(false);
      setForm({ title: "", body: "", type: "SYSTEM", channel: "IN_APP", href: "", broadcast: true, userId: "" });
      load();
    } else {
      toast.error("Failed to send");
    }
  };

  const statCards = [
    { label: "Total Sent", value: stats.total, icon: Bell, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Unread", value: stats.unread, icon: Eye, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { label: "Delivered", value: stats.sent, icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Queued", value: stats.queued, icon: Clock, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
          <p className="mt-1 text-muted-foreground">Manage and broadcast notifications</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Send Notification
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{c.value.toLocaleString()}</p>
              </div>
              <div className={`rounded-lg p-2.5 ${c.bg}`}><c.icon className={`h-5 w-5 ${c.color}`} /></div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Send Notification</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Notification title" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-1">Body</label>
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Notification message..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Channel</label>
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Link (optional)</label>
              <input value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="/dashboard" />
            </div>
            <div className="col-span-2 flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="radio" checked={form.broadcast} onChange={() => setForm({ ...form, broadcast: true, userId: "" })} className="accent-primary" />
                <Radio className="h-4 w-4" /> Broadcast to all users
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="radio" checked={!form.broadcast} onChange={() => setForm({ ...form, broadcast: false })} className="accent-primary" />
                <Users className="h-4 w-4" /> Specific user
              </label>
              {!form.broadcast && (
                <input value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="ml-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="User ID" />
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={send} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Send className="h-4 w-4" /> Send
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
          <option value="">All Types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
          <option value="">All Channels</option>
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
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
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : notifications.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No notifications</td></tr>
            ) : notifications.map((n) => (
              <tr key={n.id} className="border-b border-border hover:bg-accent/30">
                <td className="px-4 py-3 text-foreground">{n.user?.email || n.userId}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{n.title}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-xs">{n.body}</div>
                </td>
                <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{n.type}</span></td>
                <td className="px-4 py-3 text-muted-foreground">{n.channel}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${n.read ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}`}>
                    {n.read ? "Read" : "Unread"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(n.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
