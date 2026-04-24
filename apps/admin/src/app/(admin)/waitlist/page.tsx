"use client";

import Link from "next/link";
import { type ComponentType, useEffect, useMemo, useState } from "react";
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
  MOBILE_IOS: { label: "iOS beta", icon: Smartphone, color: "text-blue-500" },
  MOBILE_ANDROID: {
    label: "Android beta",
    icon: Smartphone,
    color: "text-green-500",
  },
  MOBILE_ANY: { label: "Mobile (any)", icon: Smartphone, color: "text-sky-500" },
  PLAN_FAMILY: { label: "Family plan", icon: Users, color: "text-rose-500" },
  PLAN_PRO: { label: "Pro plan", icon: Crown, color: "text-amber-500" },
  API_ACCESS: { label: "API access", icon: Code2, color: "text-purple-500" },
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

  const exportCSV = () => {
    const header = [
      "email",
      "target",
      "source",
      "userId",
      "note",
      "notifiedAt",
      "convertedAt",
      "createdAt",
    ].join(",");
    const rows = signups.map((signup) =>
      [
        signup.email,
        signup.target,
        signup.source || "",
        signup.userId || "",
        (signup.note || "").replace(/"/g, '""'),
        signup.notifiedAt || "",
        signup.convertedAt || "",
        signup.createdAt,
      ]
        .map((value) => `"${value}"`)
        .join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const activeSourceCount = useMemo(
    () => sources.filter((source) => source.count > 0).length,
    [sources],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Waitlist</h1>
          <p className="mt-1 text-muted-foreground">
            Outreach and conversion tracking for upcoming product segments
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

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
          return (
            <button
              key={target}
              onClick={() => setTargetFilter(targetFilter === target ? "all" : target)}
              className={`rounded-xl border p-4 text-left transition ${
                targetFilter === target
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`h-4 w-4 ${meta.color}`} />
                <span className="text-xs text-muted-foreground">{meta.label}</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {stats[target] ?? 0}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-card p-4">
        <input
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={notifiedFilter}
          onChange={(e) =>
            setNotifiedFilter(e.target.value as "all" | "true" | "false")
          }
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
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
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All conversion states</option>
          <option value="false">Not converted</option>
          <option value="true">Converted</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
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
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-accent"
        >
          <RotateCcw className="mr-1 inline h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
        {activeSourceCount > 0
          ? `Tracking ${activeSourceCount} active waitlist sources.`
          : "No source segmentation data recorded yet."}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : signups.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No signups match these filters yet.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Linked User</th>
                <th className="px-4 py-3">Signed Up</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {signups.map((signup) => {
                const meta = TARGET_META[signup.target];
                const Icon = meta.icon;
                return (
                  <tr key={signup.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono text-xs">{signup.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
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
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(signup.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {signup.notifiedAt ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-500">
                            <Bell className="h-3 w-3" /> Notified
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Pending outreach
                          </span>
                        )}
                        {signup.convertedAt ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-500">
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
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent"
                        >
                          {signup.notifiedAt ? "Unmark notified" : "Mark notified"}
                        </button>
                        <button
                          onClick={() =>
                            void updateSignup(signup.id, {
                              converted: !Boolean(signup.convertedAt),
                            })
                          }
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-accent"
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
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
