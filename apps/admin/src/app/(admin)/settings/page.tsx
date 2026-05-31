"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  ArrowRight,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  HardDrive,
  Lock,
  Mail,
  MapPin,
  Server,
  Shield,
  Smartphone,
  Users,
} from "lucide-react";
import { PasswordChangeForm } from "./password-form";
import { InfoHint } from "@/components/info-hint";
import { AdminPageHeader } from "@/components/admin-page-header";

const MODEL_ICONS: Record<string, typeof Users> = {
  users: Users,
  providers: Server,
  customProviders: Server,
  moveTasks: Activity,
  stateRules: MapPin,
  subscriptions: CreditCard,
  movingPlans: Smartphone,
  auditLogs: Activity,
  adminAuditLogs: Shield,
  sessions: Server,
  events: Activity,
};

const MODEL_LABELS: Record<string, string> = {
  users: "Users",
  providers: "Providers",
  customProviders: "Custom Providers",
  moveTasks: "Move Tasks",
  stateRules: "State Rules",
  subscriptions: "Subscriptions",
  movingPlans: "Moving Plans",
  auditLogs: "User Logs",
  adminAuditLogs: "Admin Logs",
  sessions: "Sessions",
  events: "Events",
};

const INTEGRATION_ICONS: Record<string, typeof Shield> = {
  google_oauth: Shield,
  apple_oauth: Shield,
  stripe: CreditCard,
  resend: Mail,
  google_maps: MapPin,
  mobile_app_store: Smartphone,
  mobile_play: Smartphone,
  backup_storage: HardDrive,
  redis: Activity,
};

type SettingsResponse = {
  counts: Record<string, number>;
  adminProfile: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    lastLoginAt: string | null;
    createdAt: string;
    _count?: { auditLogs?: number };
  } | null;
  recentErrors: {
    action: string;
    entityType: string;
    createdAt: string;
  }[];
  runtimeSummary: {
    managedKeys: number;
    configured: number;
    dbOverrides: number;
    missingRequired: number;
    missingRequiredKeys: string[];
  };
  integrations: {
    id: string;
    label: string;
    configured: boolean;
    missingKeys: string[];
  }[];
  currentProductReadiness: {
    id: string;
    label: string;
    status: "enabled" | "not_proven" | string;
    detail: string;
  }[];
  systemInfo: {
    version: string;
    framework: string;
    database: string;
    auth: string;
    node: string;
    environment: string;
  };
};

export default function SettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error || "Failed to load settings");
          return;
        }
        setData(json);
      } catch {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function exportData(type: string) {
    const endpointMap: Record<string, string> = {
      users: "/api/users?perPage=9999",
      providers: "/api/providers?perPage=9999",
      subscriptions: "/api/subscriptions?perPage=9999",
      waitlist: "/api/waitlist",
    };
    const responseKeyMap: Record<string, string> = {
      users: "users",
      providers: "providers",
      subscriptions: "subscriptions",
      waitlist: "signups",
    };

    setExporting(type);
    try {
      const res = await fetch(endpointMap[type]);
      const json = await res.json();
      const items = json[responseKeyMap[type]] || [];
      if (!Array.isArray(items) || items.length === 0) {
        toast.error("No data to export");
        return;
      }

      const header = Object.keys(items[0])
        .filter((key) => typeof items[0][key] !== "object")
        .join(",");
      const rows = items.map((item: any) =>
        Object.entries(item)
          .filter(([, value]) => typeof value !== "object")
          .map(([, value]) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
      const blob = new Blob([header + "\n" + rows.join("\n")], {
        type: "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${type}-export.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${items.length} ${type} records`);
    } catch {
      toast.error(`Failed to export ${type}`);
    } finally {
      setExporting(null);
    }
  }

  const profile = data?.adminProfile;
  const counts = data?.counts || {};

  const recordTotal = useMemo(
    () =>
      Object.values(counts).reduce(
        (sum, value) => sum + (typeof value === "number" ? value : 0),
        0,
      ),
    [counts],
  );

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  }

  if (!data) {
    return <div className="py-12 text-center text-muted-foreground">Failed to load settings</div>;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="System"
        title="<em>Settings</em>"
        subtitle="Runtime readiness, admin account controls, exports, and operational links"
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          {profile && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                <Shield className="h-5 w-5" /> Admin Profile
              </h2>
              <div className="mb-4 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                  {profile.firstName?.[0]}
                  {profile.lastName?.[0]}
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {profile.firstName} {profile.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Role" value={profile.role?.replace("_", " ")} />
                <InfoCard
                  label="Total Actions"
                  value={profile._count?.auditLogs || 0}
                />
                <InfoCard
                  label="Last Login"
                  value={
                    profile.lastLoginAt
                      ? new Date(profile.lastLoginAt).toLocaleString()
                      : "—"
                  }
                />
                <InfoCard
                  label="Member Since"
                  value={new Date(profile.createdAt).toLocaleDateString()}
                />
              </div>
            </div>
          )}

          <PasswordChangeForm />

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Lock className="h-5 w-5" /> Two-Factor Authentication
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Protect your admin account with a TOTP authenticator and backup codes.
            </p>
            <Link
              href="/settings/two-factor"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Shield className="h-4 w-4" /> Manage 2FA
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Activity className="h-5 w-5" /> Runtime Readiness
                </h2>
                <p className="text-sm text-muted-foreground">
                  This view reflects the real managed runtime-config catalog and deployment inputs.
                </p>
              </div>
              <Link
                href="/runtime-config"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Open Runtime Config <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <InfoCard
                label="Managed Keys"
                value={data.runtimeSummary.managedKeys}
                hint="Total config keys the app knows how to read (secrets, URLs, toggles), whether or not a value is set yet."
              />
              <InfoCard
                label="Configured"
                value={data.runtimeSummary.configured}
                hint="Managed keys that currently have a value, from either an environment variable or a database override."
              />
              <InfoCard
                label="DB Overrides"
                value={data.runtimeSummary.dbOverrides}
                hint="Keys whose value is set in the database and takes precedence over the deployment's environment variable."
              />
              <InfoCard
                label="Missing Required"
                value={data.runtimeSummary.missingRequired}
                hint="Required keys with no value anywhere. The related feature stays off until these are filled in."
              />
            </div>
            {data.runtimeSummary.missingRequiredKeys.length > 0 && (
              <div className="mt-4 rounded-lg border border-tone-honey-br bg-tone-honey-bg p-4">
                <p className="text-sm font-medium text-foreground">
                  Required runtime keys still missing
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.runtimeSummary.missingRequiredKeys.join(", ")}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Shield className="h-5 w-5" /> Current Product Readiness
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              These modes describe current behavior. They do not enable provider connectors, account linking, or automatic address-change execution.
            </p>
            <div className="space-y-3">
              {data.currentProductReadiness.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
                      item.status === "enabled"
                        ? "bg-tone-sage-bg text-tone-sage-fg"
                        : "bg-tone-honey-bg text-tone-honey-fg"
                    }`}>
                      {item.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Database className="h-5 w-5" /> Database Records
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(counts).map(([key, count]) => {
                const Icon = MODEL_ICONS[key] || Database;
                return (
                  <div key={key} className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] font-medium uppercase text-muted-foreground">
                        {MODEL_LABELS[key] || key}
                      </p>
                    </div>
                    <p className="mt-1 text-lg font-bold text-foreground">
                      {count.toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
              Total indexed records:{" "}
              <span className="font-medium text-foreground">
                {recordTotal.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Server className="h-5 w-5" /> System Information
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label="Version" value={data.systemInfo.version} />
              <InfoCard label="Framework" value={data.systemInfo.framework} />
              <InfoCard label="Database" value={data.systemInfo.database} />
              <InfoCard label="Auth" value={data.systemInfo.auth} />
              <InfoCard label="Node.js" value={data.systemInfo.node} />
              <InfoCard
                label="Environment"
                value={data.systemInfo.environment}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Shield className="h-5 w-5" /> Integration Readiness
                </h2>
                <p className="text-sm text-muted-foreground">
                  Provider availability across OAuth, billing, mobile verification, alerts, and backups.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {data.integrations.map((integration) => {
                const Icon = INTEGRATION_ICONS[integration.id] || Shield;
                return (
                  <div
                    key={integration.id}
                    className="rounded-lg border border-border bg-muted/30 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-background p-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {integration.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {integration.configured
                              ? "Configured and ready"
                              : `Missing ${integration.missingKeys.length} required setting${integration.missingKeys.length === 1 ? "" : "s"}`}
                          </p>
                          {!integration.configured &&
                            integration.missingKeys.length > 0 && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {integration.missingKeys.join(", ")}
                              </p>
                            )}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                          integration.configured
                            ? "bg-tone-sage-bg text-tone-sage-fg"
                            : "bg-tone-honey-bg text-tone-honey-fg"
                        }`}
                      >
                        {integration.configured ? "Ready" : "Needs config"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Download className="h-5 w-5" /> Data Export
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Export currently supported admin datasets as CSV.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "users", label: "Users", icon: Users },
                { key: "providers", label: "Providers", icon: Server },
                { key: "subscriptions", label: "Subscriptions", icon: CreditCard },
                { key: "waitlist", label: "Waitlist", icon: Mail },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => void exportData(key)}
                  disabled={exporting === key}
                  className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {exporting === key ? "Exporting..." : `Export ${label}`}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Activity className="h-5 w-5" /> Operational Links
            </h2>
            <div className="space-y-2">
              {[
                {
                  href: "/settings/health",
                  label: "Health Dashboard",
                  description: "Connectivity, service checks, and system metrics",
                },
                {
                  href: "/runtime-config",
                  label: "Runtime Config",
                  description: "Manage secret-backed provider and infrastructure values",
                },
                {
                  href: "/feature-flags",
                  label: "Feature Flags",
                  description: "Review rollout toggles and staged releases",
                },
                {
                  href: "/security/dashboard",
                  label: "Security Dashboard",
                  description: "Review admin sessions, login history, and alerts",
                },
                {
                  href: "/backups",
                  label: "Backups",
                  description: "Inspect backup runs, verification, and import controls",
                },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left hover:bg-accent"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{link.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {link.description}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>

          {data.recentErrors.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
                <Activity className="h-5 w-5" /> Recent Admin Errors
              </h2>
              <div className="space-y-2">
                {data.recentErrors.map((entry, index) => (
                  <div
                    key={`${entry.action}-${entry.createdAt}-${index}`}
                    className="rounded-lg bg-muted/40 p-3"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {entry.action}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.entityType} · {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase text-muted-foreground">
        {label}
        {hint ? <InfoHint text={hint} label={label} /> : null}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
