"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Bell, Loader2, Receipt, Calendar, Mail, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useLocale } from "next-intl";
import { WEB_NOTIFICATION_PREFERENCE_DEFINITIONS } from "@/lib/notification-preferences";

interface NotifGroup {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  items: { key: string; label: string; description: string }[];
}

const NOTIFICATION_COPY = {
  en: {
    back: "Back",
    title: "Notifications",
    enabled: (enabled: number, total: number) => `${enabled} of ${total} notifications enabled`,
    emailDelivery: "Email Delivery",
    weeklyDigestDay: "Weekly Digest Day",
    reminderLeadTime: "Bill Reminder Lead Time",
    before: (days: string) => `${days} day${days === "1" ? "" : "s"} before`,
    enableEmail: "Enable Email Notifications",
    enableEmailDescription: "Send enabled notifications via email",
    email: "Email",
    push: "Push",
    pushToggle: (label: string) => `Push notifications for ${label}`,
    saving: "Saving...",
    save: "Save Preferences",
    saved: "Notification preferences saved!",
    failed: "Failed to save preferences",
    groups: [
      {
        title: "Billing & Payments",
        icon: Receipt,
        iconColor: "text-tone-honey-fg",
        items: [
          { key: "billReminder", label: "Bill Due Reminders", description: "Get notified 3 days before a bill is due" },
          { key: "billOverdue", label: "Overdue Alerts", description: "Alert when a bill passes its due date" },
          { key: "contractExpiring", label: "Contract Expiring", description: "Alert when a service contract is ending soon" },
        ],
      },
      {
        title: "Moving & Tasks",
        icon: Calendar,
        iconColor: "text-tone-cyan-fg",
        items: [
          { key: "taskReminder", label: "Task Reminders", description: "Reminders for upcoming moving tasks" },
          { key: "moveUpdate", label: "Moving Plan Updates", description: "Updates on your active moving plan progress" },
        ],
      },
      {
        title: "Reports & Summary",
        icon: Mail,
        iconColor: "text-destructive",
        items: [
          { key: "weeklySummary", label: "Weekly Summary", description: "Weekly digest of activity and upcoming items" },
          { key: "monthlyReport", label: "Monthly Report", description: "Monthly expense summary and trends" },
        ],
      },
      {
        title: "Workspace & Connections",
        icon: Users,
        iconColor: "text-tone-sky-fg",
        items: [
          { key: "connectorActionNeeded", label: "Connection action needed", description: "When a connected service needs you to reconnect or finish a sync" },
          { key: "workspaceMembership", label: "Workspace updates", description: "When you're invited, your role changes, or you're added to or removed from a shared workspace" },
        ],
      },
      {
        title: "Helpful Nudges",
        icon: Sparkles,
        iconColor: "text-tone-orange-fg",
        items: [
          { key: "lifecycleNudge", label: "Setup & move reminders", description: "Occasional nudges to finish setting up your move, or a heads-up when your move is coming up and tasks are still open" },
        ],
      },
    ],
  },
  es: {
    back: "Volver",
    title: "Notificaciones",
    enabled: (enabled: number, total: number) => `${enabled} de ${total} notificaciones activadas`,
    emailDelivery: "Entrega por email",
    weeklyDigestDay: "Dia del resumen semanal",
    reminderLeadTime: "Anticipacion de recordatorio",
    before: (days: string) => `${days} dia${days === "1" ? "" : "s"} antes`,
    enableEmail: "Activar notificaciones por email",
    enableEmailDescription: "Enviar por email las notificaciones activadas",
    email: "Email",
    push: "Push",
    pushToggle: (label: string) => `Notificaciones push para ${label}`,
    saving: "Guardando...",
    save: "Guardar preferencias",
    saved: "Preferencias de notificacion guardadas",
    failed: "No se pudieron guardar las preferencias",
    groups: [
      {
        title: "Facturacion y pagos",
        icon: Receipt,
        iconColor: "text-tone-honey-fg",
        items: [
          { key: "billReminder", label: "Recordatorios de factura", description: "Aviso 3 dias antes de que venza una factura" },
          { key: "billOverdue", label: "Alertas vencidas", description: "Aviso cuando una factura pasa su fecha limite" },
          { key: "contractExpiring", label: "Contrato por vencer", description: "Aviso cuando un contrato de servicio esta por terminar" },
        ],
      },
      {
        title: "Mudanza y tareas",
        icon: Calendar,
        iconColor: "text-tone-cyan-fg",
        items: [
          { key: "taskReminder", label: "Recordatorios de tareas", description: "Recordatorios para tareas proximas de mudanza" },
          { key: "moveUpdate", label: "Actualizaciones de mudanza", description: "Progreso de tu plan de mudanza activo" },
        ],
      },
      {
        title: "Informes y resumen",
        icon: Mail,
        iconColor: "text-destructive",
        items: [
          { key: "weeklySummary", label: "Resumen semanal", description: "Resumen semanal de actividad y pendientes" },
          { key: "monthlyReport", label: "Informe mensual", description: "Resumen mensual de gastos y tendencias" },
        ],
      },
      {
        title: "Workspace y conexiones",
        icon: Users,
        iconColor: "text-tone-sky-fg",
        items: [
          { key: "connectorActionNeeded", label: "Conexion requiere accion", description: "Cuando un servicio conectado necesita reconexion o completar una sincronizacion" },
          { key: "workspaceMembership", label: "Actualizaciones de workspace", description: "Cuando te invitan, cambia tu rol o te agregan/quitan de un workspace compartido" },
        ],
      },
      {
        title: "Sugerencias utiles",
        icon: Sparkles,
        iconColor: "text-tone-orange-fg",
        items: [
          { key: "lifecycleNudge", label: "Recordatorios de setup y mudanza", description: "Avisos ocasionales para terminar tu setup o revisar tareas abiertas antes de mudarte" },
        ],
      },
    ],
  },
} as const;

function copyForLocale(locale: string) {
  return locale.toLowerCase().startsWith("es") ? NOTIFICATION_COPY.es : NOTIFICATION_COPY.en;
}

// Body key for a per-type web PUSH toggle: the email key with a "push" prefix
// and capitalized first char (e.g. billReminder -> pushBillReminder). Mirrors
// WEB_PUSH_PREFERENCE_DEFINITIONS in app/api/notifications/route.ts so the GET
// `push` map and POST keys line up exactly.
function pushKeyFor(key: string) {
  return `push${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

const allKeys = NOTIFICATION_COPY.en.groups.flatMap((g) => g.items.map((i) => i.key));
const DEFAULT_SETTINGS = Object.fromEntries(
  WEB_NOTIFICATION_PREFERENCE_DEFINITIONS.map((definition) => [definition.key, definition.defaultEnabled])
) as Record<string, boolean>;
// Push channel is default-on until an explicit opt-out is stored (see
// isPushTypeEnabled), so seed every per-type push toggle to true before GET
// resolves.
const DEFAULT_PUSH = Object.fromEntries(
  WEB_NOTIFICATION_PREFERENCE_DEFINITIONS.map((definition) => [pushKeyFor(definition.key), true])
) as Record<string, boolean>;

export default function NotificationsPage() {
  const locale = useLocale();
  const copy = copyForLocale(locale);
  const [settings, setSettings] = useState<Record<string, boolean>>(
    DEFAULT_SETTINGS
  );
  const [push, setPush] = useState<Record<string, boolean>>(DEFAULT_PUSH);
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
        if (data.push) setPush((prev) => ({ ...prev, ...data.push }));
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
  const togglePush = (key: string) => {
    const pushKey = pushKeyFor(key);
    setPush((prev) => ({ ...prev, [pushKey]: !prev[pushKey] }));
  };

  const enabledCount = Object.values(settings).filter(Boolean).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          ...push,
          digestDay,
          reminderDays,
          emailEnabled,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(copy.saved);
    } catch {
      toast.error(copy.failed);
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Link
          href="/settings"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition"
        >
          <ArrowLeft className="h-4 w-4" />{copy.back}
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.enabled(enabledCount, allKeys.length)}</p>
        </div>
      </div>

      {copy.groups.map((group) => {
        const Icon = group.icon;
        return (
          <div key={group.title} className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${group.iconColor}`} />
                <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-wide text-foreground/40">
                <span className="w-11 text-center">{copy.email}</span>
                <span className="w-11 text-center">{copy.push}</span>
              </div>
            </div>
            <div className="px-5 pb-4 space-y-0.5">
              {group.items.map((item) => {
                const pushKey = pushKeyFor(item.key);
                return (
                  <div key={item.key} className="flex items-center justify-between gap-3 py-3 border-b border-foreground/[0.03] last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground/80">{item.label}</p>
                      <p className="text-[11px] text-foreground/40">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={settings[item.key]}
                        aria-label={item.label}
                        onClick={() => toggle(item.key)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                          settings[item.key] ? "bg-tone-orange-fg" : "bg-foreground/10"
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                          settings[item.key] ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </button>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={push[pushKey]}
                        aria-label={copy.pushToggle(item.label)}
                        onClick={() => togglePush(item.key)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                          push[pushKey] ? "bg-tone-orange-fg" : "bg-foreground/10"
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                          push[pushKey] ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Email Delivery Settings */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Mail className="h-4 w-4 text-tone-orange-fg" />
          <h3 className="text-sm font-semibold text-foreground">{copy.emailDelivery}</h3>
        </div>
        <div className="px-5 pb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{copy.weeklyDigestDay}</label>
              <select
                className="w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                value={digestDay}
                onChange={(e) => setDigestDay(e.target.value)}
              >
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{copy.reminderLeadTime}</label>
              <select
                className="w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
              >
                {["1", "3", "5", "7"].map((days) => (
                  <option key={days} value={days}>{copy.before(days)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-foreground/[0.03]">
            <div>
              <p className="text-sm font-medium text-foreground/80">{copy.enableEmail}</p>
              <p className="text-[11px] text-foreground/40">{copy.enableEmailDescription}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={emailEnabled}
              aria-label={copy.enableEmail}
              onClick={() => setEmailEnabled(!emailEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                emailEnabled ? "bg-tone-orange-fg" : "bg-foreground/10"
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
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" />{copy.saving}</> : copy.save}
        </button>
      </div>
    </div>
  );
}
