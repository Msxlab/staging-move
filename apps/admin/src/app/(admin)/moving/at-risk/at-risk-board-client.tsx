"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  AlertTriangle,
  Clock,
  ListChecks,
  Zap,
  CalendarClock,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";

type RiskCode =
  | "OVERDUE_TASKS"
  | "INCOMPLETE_CHECKLIST"
  | "NO_SERVICES_TRACKED"
  | "SOON_LOW_COMPLETENESS";

interface RiskReason {
  code: RiskCode;
  label: string;
  severity: "high" | "medium";
}

interface AtRiskRow {
  id: string;
  status: string;
  moveDate: string;
  daysUntilMove: number;
  isTemporary: boolean;
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
  workspace: { id: string; name: string } | null;
  fromCity: string | null;
  fromState: string | null;
  toCity: string | null;
  toState: string | null;
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  overdueTasks: number;
  originServices: number;
  destinationServices: number;
  completionPercent: number;
  severity: "high" | "medium";
  reasons: RiskReason[];
}

interface Summary {
  total: number;
  high: number;
  overdueTasks: number;
  incompleteChecklist: number;
  noServices: number;
  soonLowCompleteness: number;
}

const EMPTY_SUMMARY: Summary = {
  total: 0,
  high: 0,
  overdueTasks: 0,
  incompleteChecklist: 0,
  noServices: 0,
  soonLowCompleteness: 0,
};

const RISK_META: Record<RiskCode, { label: string; icon: any; chip: string }> = {
  OVERDUE_TASKS: {
    label: "Overdue tasks",
    icon: AlertTriangle,
    chip: "bg-tone-rose-bg text-tone-rose-fg border-tone-rose-br",
  },
  INCOMPLETE_CHECKLIST: {
    label: "Incomplete checklist",
    icon: ListChecks,
    chip: "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br",
  },
  NO_SERVICES_TRACKED: {
    label: "No services tracked",
    icon: Zap,
    chip: "bg-tone-slate-bg text-tone-slate-fg border-tone-slate-br",
  },
  SOON_LOW_COMPLETENESS: {
    label: "Soon · low completeness",
    icon: CalendarClock,
    chip: "bg-tone-sky-bg text-tone-sky-fg border-tone-sky-br",
  },
};

const REASON_CHIP: Record<"high" | "medium", string> = {
  high: "border-tone-rose-br bg-tone-rose-bg text-tone-rose-fg",
  medium: "border-tone-honey-br bg-tone-honey-bg text-tone-honey-fg",
};

function fullName(u: AtRiskRow["user"]): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export default function AtRiskBoardClient() {
  const [rows, setRows] = useState<AtRiskRow[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<RiskCode | "">("");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (riskFilter) params.set("risk", riskFilter);
      const res = await fetch(`/api/moving/at-risk?${params}`);
      if (!res.ok) {
        toast.error("Failed to load at-risk moves");
        return;
      }
      const data = await res.json();
      setRows(data.rows || []);
      setSummary(data.summary || EMPTY_SUMMARY);
    } catch {
      toast.error("Failed to load at-risk moves");
    } finally {
      setLoading(false);
    }
  }, [riskFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filterCards: Array<{ code: RiskCode | ""; label: string; value: number; icon: any; color: string; bg: string }> = [
    { code: "", label: "At risk", value: summary.total, icon: ShieldAlert, color: "text-foreground", bg: "bg-card" },
    { code: "OVERDUE_TASKS", label: "Overdue tasks", value: summary.overdueTasks, icon: AlertTriangle, color: "text-tone-rose-fg", bg: "bg-tone-rose-bg" },
    { code: "INCOMPLETE_CHECKLIST", label: "Incomplete checklist", value: summary.incompleteChecklist, icon: ListChecks, color: "text-tone-honey-fg", bg: "bg-tone-honey-bg" },
    { code: "NO_SERVICES_TRACKED", label: "No services", value: summary.noServices, icon: Zap, color: "text-tone-slate-fg", bg: "bg-tone-slate-bg" },
    { code: "SOON_LOW_COMPLETENESS", label: "Soon · low %", value: summary.soonLowCompleteness, icon: CalendarClock, color: "text-tone-sky-fg", bg: "bg-tone-sky-bg" },
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/moving"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to moving plans
      </Link>

      <AdminPageHeader
        eyebrow="Operations"
        title="<em>At-Risk</em> Moves"
        subtitle="Upcoming relocations that need operator attention before the move date"
      />

      {/* Risk summary / filter cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {filterCards.map((card) => {
          const active = riskFilter === card.code;
          return (
            <button
              key={card.label}
              onClick={() => setRiskFilter(card.code)}
              className={`rounded-2xl border ${card.bg} p-4 text-left transition-shadow hover:shadow-md ${active ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{card.label}</p>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <p className={`mt-1.5 font-display text-3xl font-extrabold leading-none ${card.color}`}>{card.value}</p>
            </button>
          );
        })}
      </div>

      {riskFilter && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Filtered by</span>
          <button
            onClick={() => setRiskFilter("")}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
          >
            {RISK_META[riskFilter].label} <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading at-risk moves…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No at-risk moves"
          description={
            riskFilter
              ? "No upcoming moves match this risk signal right now."
              : "Every upcoming move looks on track. Nothing needs attention."
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const checklistTotal = row.completedTasks + row.openTasks;
            return (
              <Link
                key={row.id}
                href={`/moving/${row.id}`}
                className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-accent/30"
              >
                <div className="flex flex-wrap items-start gap-4">
                  {/* Severity rail */}
                  <span
                    className={`mt-1 h-10 w-1 shrink-0 rounded-full ${row.severity === "high" ? "bg-tone-rose-fg" : "bg-tone-honey-fg"}`}
                    aria-hidden="true"
                  />

                  {/* Route + owner */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-tone-orange-fg" />
                      <span className="truncate text-sm font-medium text-foreground">
                        {row.fromCity}, {row.fromState}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <MapPin className="h-4 w-4 shrink-0 text-tone-sage-fg" />
                      <span className="truncate text-sm font-medium text-foreground">
                        {row.toCity}, {row.toState}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="truncate">{fullName(row.user)}</span>
                      {row.workspace ? (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {row.workspace.name}
                        </span>
                      ) : null}
                    </div>

                    {/* Risk reason chips */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.reasons.map((reason) => {
                        const meta = RISK_META[reason.code];
                        const Icon = meta.icon;
                        return (
                          <span
                            key={reason.code}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${REASON_CHIP[reason.severity]}`}
                            title={meta.label}
                          >
                            <Icon className="h-3 w-3" /> {reason.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Checklist progress */}
                  <div className="w-32 shrink-0">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="uppercase tracking-[0.06em]">Checklist</span>
                      <span className="font-mono font-semibold text-foreground">{row.completionPercent}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-tone-sage-fg"
                        style={{ width: `${row.completionPercent}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      <span className="font-mono">{row.completedTasks}/{checklistTotal}</span> done
                      {row.overdueTasks > 0 ? <> · <span className="font-mono">{row.overdueTasks}</span> overdue</> : ""}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="w-24 shrink-0 text-right">
                    <p className="flex items-center justify-end gap-1 text-sm font-medium text-foreground">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono">{new Date(row.moveDate).toLocaleDateString()}</span>
                    </p>
                    <p
                      className={`text-[11px] ${row.daysUntilMove <= 0 ? "font-bold text-destructive" : row.daysUntilMove <= 7 ? "text-tone-honey-fg" : "text-muted-foreground"}`}
                    >
                      {row.daysUntilMove <= 0 ? "Today!" : <><span className="font-mono">{row.daysUntilMove}</span> days left</>}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-muted/20 p-4">
        <p className="text-[11px] text-muted-foreground">
          Read-only risk board. Signals are derived from move dates, checklist task status and tracked
          services — no records are modified. Move does not update provider accounts.
        </p>
      </div>
    </div>
  );
}
