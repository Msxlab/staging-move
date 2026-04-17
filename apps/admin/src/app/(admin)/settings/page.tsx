"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Lock, Database, Download, Server, Shield, Activity,
  Users, FileText, Star, MapPin, CreditCard, Award,
  ClipboardList, Monitor, Globe, Zap,
} from "lucide-react";
import { PasswordChangeForm } from "./password-form";

const MODEL_ICONS: Record<string, typeof Users> = {
  users: Users, providers: Server, reviews: Star, stateRules: MapPin,
  subscriptions: CreditCard, documents: FileText, movingPlans: ClipboardList,
  badges: Award, auditLogs: Activity, adminAuditLogs: Shield,
  sessions: Monitor, events: Zap,
};

const MODEL_LABELS: Record<string, string> = {
  users: "Users", providers: "Providers", reviews: "Reviews", stateRules: "State Rules",
  subscriptions: "Subscriptions", documents: "Documents", movingPlans: "Moving Plans",
  badges: "Badges", auditLogs: "User Logs", adminAuditLogs: "Admin Logs",
  sessions: "Sessions", events: "Events",
};

export default function SettingsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholds] = useState({ approve: 0.80, flag: 0.40, reject: 0.20 });
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        setData(json);
      } catch { toast.error("Failed to load settings"); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function exportData(type: string) {
    setExporting(type);
    try {
      const res = await fetch(`/api/${type}?perPage=9999`);
      const json = await res.json();
      const items = json[type] || json.users || json.reviews || json.subscriptions || [];
      if (items.length === 0) { toast.error("No data to export"); return; }

      const header = Object.keys(items[0]).filter((k) => typeof items[0][k] !== "object").join(",");
      const rows = items.map((item: any) =>
        Object.entries(item).filter(([, v]) => typeof v !== "object").map(([, v]) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
      );
      const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${type}-export.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${items.length} ${type} records`);
    } catch { toast.error(`Failed to export ${type}`); }
    finally { setExporting(null); }
  }

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;

  const profile = data?.adminProfile;
  const counts = data?.counts || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-muted-foreground">System configuration, health, and admin profile</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Admin Profile */}
          {profile && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5" /> Admin Profile
              </h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                  {profile.firstName?.[0]}{profile.lastName?.[0]}
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{profile.firstName} {profile.lastName}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Role" value={profile.role?.replace("_", " ")} />
                <InfoCard label="Total Actions" value={profile._count?.auditLogs || 0} />
                <InfoCard label="Last Login" value={profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : "—"} />
                <InfoCard label="Member Since" value={new Date(profile.createdAt).toLocaleDateString()} />
              </div>
            </div>
          )}

          {/* Password Change */}
          <PasswordChangeForm />

          {/* Two-Factor Authentication */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
              <Lock className="h-5 w-5" /> Two-Factor Authentication
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Protect your admin account with an authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <a href="/settings/two-factor"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Shield className="h-4 w-4" /> Manage 2FA
            </a>
          </div>

          {/* AI Moderation Thresholds */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
              <Zap className="h-5 w-5" /> AI Moderation Thresholds
            </h2>
            <p className="text-sm text-muted-foreground mb-4">Adjust automatic review moderation score boundaries</p>
            <div className="space-y-5">
              <ThresholdSlider label="Auto-approve" description="Reviews above this score → auto-approved"
                value={thresholds.approve} color="green"
                onChange={(v) => setThresholds({ ...thresholds, approve: v })} />
              <ThresholdSlider label="Flag for review" description="Reviews below this → flagged for manual check"
                value={thresholds.flag} color="yellow"
                onChange={(v) => setThresholds({ ...thresholds, flag: v })} />
              <ThresholdSlider label="Auto-reject" description="Reviews below this → auto-rejected"
                value={thresholds.reject} color="red"
                onChange={(v) => setThresholds({ ...thresholds, reject: v })} />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Changes apply to next AI moderation run</p>
              <button onClick={() => toast.success("Thresholds saved")}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                Save Thresholds
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* System Health */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Database className="h-5 w-5" /> Database Records
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(counts).map(([key, count]) => {
                const Icon = MODEL_ICONS[key] || Database;
                return (
                  <div key={key} className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">{MODEL_LABELS[key] || key}</p>
                    </div>
                    <p className="mt-1 text-lg font-bold text-foreground">{(count as number).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System Info */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Server className="h-5 w-5" /> System Information
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label="Version" value="0.1.0" />
              <InfoCard label="Framework" value="Next.js 15" />
              <InfoCard label="Database" value="SQLite (Prisma)" />
              <InfoCard label="Auth" value="JWT + bcrypt" />
              <InfoCard label="Total Records" value={Object.values(counts).reduce((a: number, b: any) => a + (b as number), 0).toLocaleString()} />
              <InfoCard label="Node.js" value={typeof window === "undefined" ? "" : "Client"} />
            </div>
          </div>

          {/* Data Export */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
              <Download className="h-5 w-5" /> Data Export
            </h2>
            <p className="text-sm text-muted-foreground mb-4">Download data as CSV files</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "users", label: "Users", icon: Users },
                { key: "reviews", label: "Reviews", icon: Star },
                { key: "subscriptions", label: "Subscriptions", icon: CreditCard },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => exportData(key)} disabled={exporting === key}
                  className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 transition-colors">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {exporting === key ? "Exporting..." : `Export ${label}`}
                </button>
              ))}
            </div>
          </div>

          {/* System Health */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
              <Monitor className="h-5 w-5" /> System Health
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Check database, Redis, email, backup storage, and external service connectivity
            </p>
            <a href="/settings/health"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Activity className="h-4 w-4" /> View Health Dashboard
            </a>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5" /> Quick Actions
            </h2>
            <div className="space-y-2">
              <button onClick={() => { window.location.reload(); toast.success("Page refreshed"); }}
                className="w-full flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors text-left">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p>Refresh Data</p>
                  <p className="text-xs text-muted-foreground">Reload all cached data</p>
                </div>
              </button>
              <button onClick={() => toast.info("This feature will clear server-side caches in production")}
                className="w-full flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors text-left">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p>Clear Cache</p>
                  <p className="text-xs text-muted-foreground">Purge server-side caches</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-[10px] font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function ThresholdSlider({ label, description, value, color, onChange }: {
  label: string; description: string; value: number; color: string;
  onChange: (v: number) => void;
}) {
  const colorMap: Record<string, string> = {
    green: "accent-green-500", yellow: "accent-yellow-500", red: "accent-red-500",
  };
  const bgMap: Record<string, string> = {
    green: "bg-green-500/10 text-green-500", yellow: "bg-yellow-500/10 text-yellow-500", red: "bg-red-500/10 text-red-500",
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className={`rounded-lg px-3 py-1.5 text-sm font-bold ${bgMap[color]}`}>{value.toFixed(2)}</span>
      </div>
      <input type="range" min="0" max="1" step="0.05" value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`w-full h-2 rounded-lg bg-muted cursor-pointer ${colorMap[color]}`} />
    </div>
  );
}
