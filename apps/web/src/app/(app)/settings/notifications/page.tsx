"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Bell, Loader2, Receipt, Calendar, Mail } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { WEB_NOTIFICATION_PREFERENCE_DEFINITIONS } from "@/lib/notification-preferences";

interface NotifGroup {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  items: { key: string; label: string; description: string }[];
}

const notifGroups: NotifGroup[] = [
  {
    title: "Billing & Payments",
    icon: Receipt,
    iconColor: "text-amber-400",
    items: [
      { key: "billReminder", label: "Bill Due Reminders", description: "Get notified 3 days before a bill is due" },
      { key: "billOverdue", label: "Overdue Alerts", description: "Alert when a bill passes its due date" },
      { key: "contractExpiring", label: "Contract Expiring", description: "Alert when a service contract is ending soon" },
    ],
  },
  {
    title: "Moving & Tasks",
    icon: Calendar,
    iconColor: "text-cyan-400",
    items: [
      { key: "taskReminder", label: "Task Reminders", description: "Reminders for upcoming moving tasks" },
      { key: "moveUpdate", label: "Moving Plan Updates", description: "Updates on your active moving plan progress" },
    ],
  },
  {
    title: "Reports & Summary",
    icon: Mail,
    iconColor: "text-rose-400",
    items: [
      { key: "weeklySummary", label: "Weekly Summary", description: "Weekly digest of activity and upcoming items" },
      { key: "monthlyReport", label: "Monthly Report", description: "Monthly expense summary and trends" },
    ],
  },
];

const allKeys = notifGroups.flatMap((g) => g.items.map((i) => i.key));
const DEFAULT_SETTINGS = Object.fromEntries(
  WEB_NOTIFICATION_PREFERENCE_DEFINITIONS.map((definition) => [definition.key, definition.defaultEnabled])
) as Record<string, boolean>;

export default function NotificationsPage() {
  const [settings, setSettings] = useState<Record<string, boolean>>(
    DEFAULT_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [digestDay, setDigestDay] = useState("Monday");
  const [reminderDays, setReminderDays] = useState("3");
  const [emailEnabled, setEmailEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (data.prefs) setSettings((prev) => ({ ...prev, ...data.prefs }));
        if (data.config) {
          if (typeof data.config.emailEnabled === "boolean") setEmailEnabled(data.config.emailEnabled);
          if (typeof data.config.digestDay === "string") setDigestDay(data.config.digestDay);
          if (typeof data.config.reminderDays === "string") setReminderDays(data.config.reminderDays);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key: string) => setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const enabledCount = Object.values(settings).filter(Boolean).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          digestDay,
          reminderDays,
          emailEnabled,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Notification preferences saved!");
    } catch {
      toast.error("Failed to save preferences");
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">{enabledCount} of {allKeys.length} notifications enabled</p>
        </div>
      </div>

      {notifGroups.map((group) => {
        const Icon = group.icon;
        return (
          <div key={group.title} className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 pt-5 pb-3">
              <Icon className={`h-4 w-4 ${group.iconColor}`} />
              <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
            </div>
            <div className="px-5 pb-4 space-y-0.5">
              {group.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between py-3 border-b border-foreground/[0.03] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground/80">{item.label}</p>
                    <p className="text-[11px] text-foreground/40">{item.description}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings[item.key]}
                    aria-label={item.label}
                    onClick={() => toggle(item.key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                      settings[item.key] ? "bg-orange-500" : "bg-foreground/10"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                      settings[item.key] ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Email Delivery Settings */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Mail className="h-4 w-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-foreground">Email Delivery</h3>
        </div>
        <div className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Weekly Digest Day</label>
              <select
                className="w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition"
                value={digestDay}
                onChange={(e) => setDigestDay(e.target.value)}
              >
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Bill Reminder Lead Time</label>
              <select
                className="w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition"
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
              >
                <option value="1">1 day before</option>
                <option value="3">3 days before</option>
                <option value="5">5 days before</option>
                <option value="7">7 days before</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-foreground/[0.03]">
            <div>
              <p className="text-sm font-medium text-foreground/80">Enable Email Notifications</p>
              <p className="text-[11px] text-foreground/40">Send enabled notifications via email</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={emailEnabled}
              aria-label="Enable email notifications"
              onClick={() => setEmailEnabled(!emailEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                emailEnabled ? "bg-orange-500" : "bg-foreground/10"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                emailEnabled ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}
