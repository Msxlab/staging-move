"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Database,
  Cloud,
  Shield,
  Mail,
  Bell,
  Server,
  Activity,
  RefreshCw,
  Users,
  BarChart3,
  Clock,
  HardDrive,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";

const STATUS_CONFIG = {
  healthy: {
    icon: CheckCircle2,
    color: "text-tone-sage-fg",
    bg: "bg-tone-sage-bg",
    label: "Healthy",
  },
  degraded: {
    icon: AlertTriangle,
    color: "text-tone-honey-fg",
    bg: "bg-tone-honey-bg",
    label: "Degraded",
  },
  down: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    label: "Down",
  },
  unknown: {
    icon: HelpCircle,
    color: "text-muted-foreground",
    bg: "bg-tone-slate-fg/10",
    label: "Unknown",
  },
};

const SERVICE_ICONS: Record<string, any> = {
  Database: Database,
  "Redis (Upstash)": Cloud,
  "Clerk Auth": Shield,
  "Email (Resend)": Mail,
  "Backup Storage (S3-Compatible)": HardDrive,
  "Error Tracking (Sentry)": AlertTriangle,
  "Slack Alerts": Bell,
};

export default function HealthPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/health");
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Failed to load health data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function refresh() {
    setRefreshing(true);
    load();
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  if (!data)
    return (
      <div className="py-12 text-center text-muted-foreground">
        Failed to load
      </div>
    );

  const overallCfg =
    STATUS_CONFIG[data.overall as keyof typeof STATUS_CONFIG] ||
    STATUS_CONFIG.unknown;
  const OverallIcon = overallCfg.icon;

  return (
    <div className="space-y-6 max-w-4xl">
      <AdminPageHeader
        eyebrow="System"
        title="System <em>Health</em>"
        subtitle="Service connectivity, system metrics, and infrastructure status"
        actions={
          <>
            <Link
              href="/settings"
              aria-label="Back to settings"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />{" "}
              Refresh
            </button>
          </>
        }
      />

      {/* Overall Status */}
      <div
        className={`rounded-xl border p-6 ${data.overall === "healthy" ? "border-tone-sage-br bg-tone-sage-bg" : data.overall === "down" ? "border-destructive/30 bg-destructive/5" : "border-tone-honey-br bg-tone-honey-bg"}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2.5 ${overallCfg.bg}`}>
              <OverallIcon className={`h-6 w-6 ${overallCfg.color}`} />
            </div>
            <div>
              <p className="font-semibold text-foreground text-lg">
                System Status: {overallCfg.label}
              </p>
              <p className="text-sm text-muted-foreground">
                {data.checks?.filter((c: any) => c.status === "healthy").length}
                /{data.checks?.length} services healthy
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>
              Environment:{" "}
              <span className="font-medium text-foreground">
                {data.environment}
              </span>
            </p>
            <p>
              Version:{" "}
              <span className="font-medium text-foreground">
                {data.version}
              </span>
            </p>
            <p>Checked: {new Date(data.timestamp).toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Service Checks */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Server className="h-5 w-5" /> Service Health
        </h2>
        <div className="grid gap-3">
          {(data.checks || []).map((check: any) => {
            const cfg =
              STATUS_CONFIG[check.status as keyof typeof STATUS_CONFIG] ||
              STATUS_CONFIG.unknown;
            const StatusIcon = cfg.icon;
            const ServiceIcon = SERVICE_ICONS[check.name] || Server;
            return (
              <div
                key={check.name}
                className="flex items-center justify-between rounded-lg bg-muted/30 p-4"
              >
                <div className="flex items-center gap-3">
                  <ServiceIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {check.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {check.details || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {check.latencyMs !== undefined && (
                    <span className="text-xs font-mono text-muted-foreground">
                      {check.latencyMs}ms
                    </span>
                  )}
                  <div
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.color}`}
                  >
                    <StatusIcon className="h-3.5 w-3.5" /> {cfg.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* System Metrics */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" /> System Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            {
              label: "Total Users",
              value: data.metrics?.totalUsers?.toLocaleString() || "0",
              icon: Users,
            },
            {
              label: "User Sessions",
              value: data.metrics?.totalSessions?.toLocaleString() || "0",
              icon: Activity,
            },
            {
              label: "User Events",
              value: data.metrics?.totalEvents?.toLocaleString() || "0",
              icon: BarChart3,
            },
            {
              label: "Admin Audit Logs",
              value: data.metrics?.totalAdminLogs?.toLocaleString() || "0",
              icon: Shield,
            },
            {
              label: "Backups",
              value: data.metrics?.totalBackups?.toLocaleString() || "0",
              icon: HardDrive,
            },
            {
              label: "Active Admin Sessions",
              value: data.metrics?.activeAdminSessions?.toLocaleString() || "0",
              icon: Server,
            },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[10px] font-medium uppercase text-muted-foreground">
                  {m.label}
                </p>
              </div>
              <p className="text-xl font-bold text-foreground">{m.value}</p>
            </div>
          ))}
        </div>

        {data.metrics?.lastBackup && (
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Last backup:
              </span>
              <span className="text-sm font-medium text-foreground">
                {new Date(data.metrics.lastBackup.createdAt).toLocaleString()}
              </span>
              {data.metrics.lastBackup.type && (
                <span className="text-xs text-muted-foreground">
                  ({data.metrics.lastBackup.type})
                </span>
              )}
              {data.metrics.lastBackup.fileSize && (
                <span className="text-xs text-muted-foreground">
                  {(data.metrics.lastBackup.fileSize / 1024).toFixed(1)} KB
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
