"use client";

import Link from "next/link";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import {
  Check,
  Download,
  Mail,
  Smartphone,
  Users,
  Bell,
  Crown,
  Code2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";

type Target =
  | "MOBILE_IOS"
  | "MOBILE_ANDROID"
  | "MOBILE_ANY"
  | "PLAN_FAMILY"
  | "PLAN_PRO"
  | "API_ACCESS";

interface Signup {
  id: string;
  email: string;
  target: Target;
  source: string | null;
  note: string | null;
  userAgent: string | null;
  locale: string | null;
  userId: string | null;
  notifiedAt: string | null;
  convertedAt: string | null;
  createdAt: string;
}

const TARGET_META: Record<
  Target,
  {
    label: string;
    icon: ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  MOBILE_IOS: { label: "iOS beta", icon: Smartphone, color: "text-tone-sky-fg" },
  MOBILE_ANDROID: {
    label: "Android beta",
    icon: Smartphone,
    color: "text-tone-sage-fg",
  },
  MOBILE_ANY: { label: "Mobile (any)", icon: Smartphone, color: "text-tone-sky-fg" },
  PLAN_FAMILY: { label: "Legacy plan interest", icon: Users, color: "text-destructive" },
  PLAN_PRO: { label: "Legacy plan interest", icon: Crown, color: "text-tone-honey-fg" },
  API_ACCESS: { label: "Legacy integration interest", icon: Code2, color: "text-tone-foil-fg" },
};

const TARGETS: Target[] = [
  "MOBILE_IOS",
  "MOBILE_ANDROID",
  "MOBILE_ANY",
  "PLAN_FAMILY",
  "PLAN_PRO",
  "API_ACCESS",
];

export default function WaitlistPage() {
  const [signups, setSignups] = useState<Signup[]>([]);
  const [stats, setStats] = useState<Record<Target, number>>(
    {} as Record<Target, number>,
  );
  const [summary, setSummary] = useState({
    totalAll: 0,
    pendingCount: 0,
    notifiedCount: 0,
    convertedCount: 0,
  });
  const [sources, setSources] = useState<{ source: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetFilter, setTargetFilter] = useState<Target | "all">("all");
  const [notifiedFilter, setNotifiedFilter] = useState<"all" | "true" | "false">(
    "all",
  );
  const [convertedFilter, setConvertedFilter] = useState<
    "all" | "true" | "false"
  >("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (targetFilter !== "all") params.set("target", targetFilter);
    if (notifiedFilter !== "all") params.set("notified", notifiedFilter);
    if (convertedFilter !== "all") params.set("converted", convertedFilter);
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (search.trim()) params.set("q", search.trim());

    fetch(`/api/waitlist?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setSignups(data.signups || []);
        setStats(data.stats || {});
        setSummary(
          data.summary || {
            totalAll: 0,
            pendingCount: 0,
            notifiedCount: 0,
            convertedCount: 0,
          },
        );
        setSources(data.sources || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetFilter, notifiedFilter, convertedFilter, sourceFilter]);

  async function updateSignup(id: string, payload: { notified?: boolean; converted?: boolean }) {
    const res = await fetch("/api/waitlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    if (!res.ok) {
      toast.error("Failed to update waitlist entry");
      return;
    }
    toast.success("Waitlist entry updated");
    load();
  }

  function openExport() {
    setExportError(null);
    setExportOpen(true);
  }

  async function confirmExport(_password: string, stepUp: StepUpValues) {
    // Server-side export at /api/waitlist/export — handles permission,
    // step-up password confirm, email masking (full email only for
    // SUPER_ADMIN), CSV-injection escaping, audit logging, and the row
    // cap. The previous in-page Blob path serialized raw signup emails
    // with no masking and no audit trail.
    setExportBusy(true);
    setExportError(null);
    try {
      const res = await fetch("/api/waitlist/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stepUp),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setExportError(data?.error || `Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
      setExportOpen(false);
    } catch {
      setExportError("Export failed");
    } finally {
      setExportBusy(false);
    }
  }

  const activeSourceCount = useMemo(
    () => sources.filter((source) => source.count > 0).length,
    [sources],
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Growth"
        title="<em>Waitlist</em>"
        subtitle="Historical mobile and legacy waitlist tracking. These entries do not create launch promises."
        actions={
          <button
            onClick={openExport}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Total signups" value={summary.totalAll} />
        <SummaryCard label="Pending outreach" value={summary.pendingCount} />
        <SummaryCard label="Notified" value={summary.notifiedCount} />
        <SummaryCard label="Converted" value={summary.convertedCount} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {TARGETS.map((target) => {
          const meta = TARGET_META[target];
          const Icon = meta.icon;
          const isActive = targetFilter === target;
          return (
            <button
              key={target}
              onClick={() => setTargetFilter(targetFilter === target ? "all" : target)}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`h-4 w-4 ${meta.color}`} />
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {meta.label}
                </span>
              </div>
              <p className="mt-2 font-display text-3xl font-extrabold leading-none text-foreground">
                {stats[target] ?? 0}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-border bg-card p-4">
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          className="min-w-[220px] flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <select
          value={notifiedFilter}
          onChange={(e) =>
            setNotifiedFilter(e.target.value as "all" | "true" | "false")
          }
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="all">All outreach</option>
          <option value="false">Pending</option>
          <option value="true">Notified</option>
        </select>
        <select
          value={convertedFilter}
          onChange={(e) =>
            setConvertedFilter(e.target.value as "all" | "true" | "false")
          }
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="all">All conversion states</option>
          <option value="false">Not converted</option>
          <option value="true">Converted</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="all">All sources</option>
          {sources.map((source) => (
            <option key={source.source} value={source.source}>
              {source.source} ({source.count})
            </option>
          ))}
        </select>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        {activeSourceCount > 0
          ? `Tracking ${activeSourceCount} active waitlist sources.`
          : "No source segmentation data recorded yet."}
      </div>

      <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading...</div>
        ) : signups.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No signups match these filters yet."
            description="Try adjusting or clearing the filters above."
          />
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Target</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Linked User</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Signed Up</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Notes</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {signups.map((signup) => {
                const meta = TARGET_META[signup.target];
                const Icon = meta.icon;
                return (
                  <tr key={signup.id} className="transition-colors hover:bg-accent/50">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{signup.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                        <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {signup.source || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {signup.userId ? (
                        <Link
                          href={`/users/${signup.userId}`}
                          className="text-primary hover:underline"
                        >
                          View user
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {new Date(signup.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        {signup.notifiedAt ? (
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-tone-sage-bg px-2 py-0.5 text-[11px] font-semibold text-tone-sage-fg">
                            <span className="h-1.5 w-1.5 rounded-full bg-tone-sage-fg" />
                            <Bell className="h-3 w-3" /> Notified
                          </span>
                        ) : (
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-tone-slate-bg px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                            Pending outreach
                          </span>
                        )}
                        {signup.convertedAt ? (
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-tone-sky-bg px-2 py-0.5 text-[11px] font-semibold text-tone-sky-fg">
                            <span className="h-1.5 w-1.5 rounded-full bg-tone-sky-fg" />
                            <Check className="h-3 w-3" /> Converted
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">
                      <div className="truncate">{signup.note || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() =>
                            void updateSignup(signup.id, {
                              notified: !Boolean(signup.notifiedAt),
                            })
                          }
                          className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          {signup.notifiedAt ? "Unmark notified" : "Mark notified"}
                        </button>
                        <button
                          onClick={() =>
                            void updateSignup(signup.id, {
                              converted: !Boolean(signup.convertedAt),
                            })
                          }
                          className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          {signup.convertedAt ? "Unmark converted" : "Mark converted"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <PasswordConfirmModal
        open={exportOpen}
        title="Export waitlist CSV"
        description="The export contains signup PII (emails). Enter your admin password and MFA code to continue. This action is audit-logged."
        confirmLabel="Export"
        busy={exportBusy}
        error={exportError}
        requiresMfa
        onClose={() => {
          if (!exportBusy) {
            setExportOpen(false);
            setExportError(null);
          }
        }}
        onConfirm={confirmExport}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-3xl font-extrabold leading-none text-foreground">{value}</p>
    </div>
  );
}
