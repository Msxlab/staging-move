"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Calendar,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Building2,
  Eye,
  Zap,
  AlertTriangle,
  ListChecks,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";

interface ServiceRow {
  id: string;
  category: string;
  providerName: string;
  isActive: boolean;
  monthlyCost: number | null;
}

interface AddressBlock {
  id: string;
  nickname: string | null;
  street: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  services: ServiceRow[];
}

interface TaskRow {
  id: string;
  title: string;
  actionType: string;
  status: string;
  source: string;
  confidence: string;
  dueDate: string | null;
  isOverdue: boolean;
  provider: string | null;
}

interface TimelineEvent {
  at: string;
  kind: string;
  label: string;
}

interface PlanDetail {
  id: string;
  status: string;
  moveDate: string;
  isTemporary: boolean;
  estimatedDuration: number | null;
  createdAt: string;
  updatedAt: string;
  isInterstate: boolean;
  user: { id: string; email: string; name: string | null; deleted: boolean };
  workspace: { id: string; name: string } | null;
  fromAddress: AddressBlock | null;
  toAddress: AddressBlock | null;
  progress: {
    totalTasks: number;
    completedTasks: number;
    dismissedTasks: number;
    openTasks: number;
    overdueTasks: number;
    completionPercent: number;
  };
  tasks: TaskRow[];
  timeline: TimelineEvent[];
}

const STATUS_COLORS: Record<string, string> = {
  PLANNING: "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br",
  IN_PROGRESS: "bg-tone-sky-bg text-tone-sky-fg border-tone-sky-br",
  COMPLETED: "bg-tone-sage-bg text-tone-sage-fg border-tone-sage-br",
  CANCELED: "bg-tone-slate-bg text-muted-foreground border-tone-slate-br",
};

const STATUS_ICONS: Record<string, any> = {
  PLANNING: Clock,
  IN_PROGRESS: Truck,
  COMPLETED: CheckCircle2,
  CANCELED: XCircle,
};

const TIMELINE_DOT: Record<string, string> = {
  PLAN_CREATED: "bg-tone-foil-fg",
  TASK_ACCEPTED: "bg-tone-sky-fg",
  TASK_COMPLETED: "bg-tone-sage-fg",
  TASK_DISMISSED: "bg-muted-foreground",
  TASK_REOPENED: "bg-tone-honey-fg",
  MOVE_DATE: "bg-tone-orange-fg",
};

function formatLabel(value: string) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function taskStatusClass(status: string) {
  if (status === "COMPLETED") return "bg-tone-sage-bg text-tone-sage-fg";
  if (status === "DISMISSED") return "bg-muted text-muted-foreground";
  if (status === "ACCEPTED" || status === "IN_PROGRESS") return "bg-tone-sky-bg text-tone-sky-fg";
  if (status === "REOPENED") return "bg-tone-foil-bg text-tone-foil-fg";
  return "bg-tone-honey-bg text-tone-honey-fg";
}

function daysLabel(moveDate: string): { text: string; cls: string } {
  const days = Math.ceil((new Date(moveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days > 7) return { text: `${days} days left`, cls: "text-muted-foreground" };
  if (days > 0) return { text: `${days} days left`, cls: "text-tone-honey-fg" };
  if (days === 0) return { text: "Today!", cls: "text-destructive font-bold" };
  return { text: `${Math.abs(days)}d ago`, cls: "text-muted-foreground" };
}

function AddressCard({ address, label, accent }: { address: AddressBlock | null; label: string; accent: string }) {
  if (!address) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="mt-2 text-sm text-muted-foreground">Address unavailable.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
        <MapPin className={`h-3.5 w-3.5 ${accent}`} /> {label}
      </p>
      {address.nickname ? (
        <p className="text-xs text-muted-foreground">{address.nickname}</p>
      ) : null}
      <p className="text-sm font-medium text-foreground">{address.street}</p>
      {address.street2 ? <p className="text-sm text-foreground">{address.street2}</p> : null}
      <p className="text-sm text-muted-foreground">
        {address.city}, {address.state} {address.zip}
      </p>

      <div className="mt-3 border-t border-border pt-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase text-muted-foreground">
          <Zap className="h-3 w-3" /> Tracked services ({address.services.length})
        </p>
        {address.services.length === 0 ? (
          <p className="text-xs text-muted-foreground">No services tracked at this address.</p>
        ) : (
          <ul className="space-y-1.5">
            {address.services.map((svc) => (
              <li key={svc.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-foreground">
                  <span className="text-muted-foreground">{formatLabel(svc.category)}:</span>{" "}
                  {svc.providerName}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${svc.isActive ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-muted text-muted-foreground"}`}
                >
                  {svc.isActive ? "Active" : "Inactive"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function MovingPlanDetailClient({ id }: { id: string }) {
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/moving/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        toast.error("Failed to load moving plan");
        return;
      }
      const data = await res.json();
      setPlan(data.plan || null);
    } catch {
      toast.error("Failed to load moving plan");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (notFound || !plan) {
    return (
      <div className="space-y-4">
        <Link
          href="/moving"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to moving plans
        </Link>
        <p className="text-sm text-muted-foreground">Moving plan not found.</p>
      </div>
    );
  }

  const StatusIcon = STATUS_ICONS[plan.status] || Clock;
  const days = daysLabel(plan.moveDate);
  const route = `${plan.fromAddress?.city ?? "?"}, ${plan.fromAddress?.state ?? "?"} → ${plan.toAddress?.city ?? "?"}, ${plan.toAddress?.state ?? "?"}`;

  return (
    <div className="space-y-6">
      <Link
        href="/moving"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to moving plans
      </Link>

      <AdminPageHeader
        eyebrow="Moving Plan"
        title={route}
        subtitle={`Owner: ${plan.user.deleted ? "(deleted user)" : plan.user.name || plan.user.email}`}
        actions={
          <span
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${STATUS_COLORS[plan.status] || "bg-muted"}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {formatLabel(plan.status)}
          </span>
        }
      />

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <Calendar className="h-4 w-4" /> Move date
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {new Date(plan.moveDate).toLocaleDateString()}
          </div>
          <p className={`text-xs ${days.cls}`}>{days.text}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <ListChecks className="h-4 w-4" /> Checklist
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {plan.progress.completedTasks} / {plan.progress.completedTasks + plan.progress.openTasks}
          </div>
          <p className="text-xs text-muted-foreground">{plan.progress.completionPercent}% complete</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <Truck className="h-4 w-4" /> Move type
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {plan.isInterstate ? "Interstate" : "Same-state"}
          </div>
          <p className="text-xs text-muted-foreground">
            {plan.isTemporary ? "Temporary" : "Permanent"}
            {plan.estimatedDuration ? ` · ${plan.estimatedDuration}d est.` : ""}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <Clock className="h-4 w-4" /> Created
          </div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {new Date(plan.createdAt).toLocaleDateString()}
          </div>
          <p className="text-xs text-muted-foreground">
            Updated {new Date(plan.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Checklist progress bar */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Checklist progress</h2>
          <span className="text-xs text-muted-foreground">
            {plan.progress.completedTasks} done · {plan.progress.openTasks} open
            {plan.progress.overdueTasks > 0 ? ` · ${plan.progress.overdueTasks} overdue` : ""}
            {plan.progress.dismissedTasks > 0 ? ` · ${plan.progress.dismissedTasks} dismissed` : ""}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-tone-sage-fg transition-all"
            style={{ width: `${plan.progress.completionPercent}%` }}
          />
        </div>
        {plan.progress.overdueTasks > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-tone-honey-br bg-tone-honey-bg px-3 py-2 text-xs text-tone-honey-fg">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {plan.progress.overdueTasks} task{plan.progress.overdueTasks === 1 ? " is" : "s are"} past their due date.
          </div>
        )}
      </div>

      {/* Owner + workspace */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
            <User className="h-3.5 w-3.5" /> Owning user
          </p>
          <p className="text-sm font-medium text-foreground">
            {plan.user.deleted ? "(deleted user)" : plan.user.name || "—"}
          </p>
          {!plan.user.deleted && <p className="text-xs text-muted-foreground">{plan.user.email}</p>}
          <Link
            href={`/users/${plan.user.id}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Eye className="h-3 w-3" /> View user profile
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> Workspace
          </p>
          {plan.workspace ? (
            <>
              <p className="text-sm font-medium text-foreground">{plan.workspace.name}</p>
              <Link
                href={`/workspaces/${plan.workspace.id}`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Eye className="h-3 w-3" /> View workspace
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Solo plan — not in a workspace.</p>
          )}
        </div>
      </div>

      {/* From → To addresses with their services */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          Route &amp; tracked services
        </h2>
        <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <AddressCard address={plan.fromAddress} label="From" accent="text-tone-orange-fg" />
          <div className="hidden items-center justify-center sm:flex">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
          <AddressCard address={plan.toAddress} label="To" accent="text-tone-sage-fg" />
        </div>
      </div>

      {/* Move-task checklist */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListChecks className="h-4 w-4" /> Move tasks ({plan.tasks.length})
        </h2>
        {plan.tasks.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No move tasks"
            description="This plan has no checklist tasks yet."
            compact
            className="rounded-xl border border-border bg-card"
          />
        ) : (
          <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-foreground/[0.03] text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {plan.tasks.map((task) => (
                  <tr key={task.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{task.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatLabel(task.confidence)} confidence · {formatLabel(task.source)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatLabel(task.actionType)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{task.provider || "—"}</td>
                    <td className="px-4 py-3">
                      {task.dueDate ? (
                        <span className={task.isOverdue ? "font-medium text-destructive" : "text-muted-foreground"}>
                          {new Date(task.dueDate).toLocaleDateString()}
                          {task.isOverdue ? " (overdue)" : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${taskStatusClass(task.status)}`}
                      >
                        {formatLabel(task.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Clock className="h-4 w-4" /> Timeline
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <ol className="space-y-3">
            {plan.timeline.map((ev, idx) => (
              <li key={`${ev.kind}-${idx}`} className="flex items-start gap-3">
                <span className="mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  <CircleDot className={`h-3 w-3 ${(TIMELINE_DOT[ev.kind] || "bg-muted-foreground").replace("bg-", "text-")}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{ev.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(ev.at).toLocaleDateString()} · {new Date(ev.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Posture disclaimer — consistent with the list view's legal copy. */}
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-[11px] text-muted-foreground">
          Read-only operator context. LocateFlow does not update provider accounts or execute address
          changes; task completion reflects LocateFlow state only.
        </p>
      </div>
    </div>
  );
}
