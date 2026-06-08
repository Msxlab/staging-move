"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Calendar, CheckCircle2, Trash2, MapPin, Clock, Loader2, PlusCircle, BookOpen, ChevronDown, ChevronUp, ListChecks, UserPlus, UserCircle2 } from "lucide-react";
import Link from "next/link";
import { LoadingSpinner } from "@/components/shared/loading-state";
import { toast } from "sonner";
import { normalizeMovingPlanStatus, type MoveTaskLocalEffect } from "@locateflow/shared";

const STATUS_BADGE_CLASSES: Record<string, { cls: string }> = {
  PLANNING: { cls: "bg-foreground/5 text-muted-foreground border-border" },
  IN_PROGRESS: { cls: "bg-tone-cyan-bg text-tone-cyan-fg border-tone-cyan-br" },
  COMPLETED: { cls: "bg-tone-emerald-bg text-tone-emerald-fg border-tone-emerald-br" },
  CANCELED: { cls: "bg-destructive/10 text-destructive border-destructive" },
};

const STATUS_LABEL_KEYS: Record<string, "status_planning" | "status_inProgress" | "status_complete" | "status_canceled"> = {
  PLANNING: "status_planning",
  IN_PROGRESS: "status_inProgress",
  COMPLETED: "status_complete",
  CANCELED: "status_canceled",
  CANCELLED: "status_canceled",
};

// Human-readable label for a task's migration action. Lets the unified
// checklist convey the same Keep / Transfer / Switch / Cancel framing the
// old separate "Service Migration Plan" buckets did, without a second list.
const ACTION_TYPE_LABELS: Record<string, string> = {
  KEEP: "Keep",
  TRANSFER: "Transfer",
  SWITCH: "Switch",
  CANCEL: "Cancel",
  SET_UP_NEW: "Set up new",
  UPDATE_ADDRESS: "Update address",
  FORWARD_MAIL: "Forward mail",
};

// Small circular initials badge for a task assignee.
function AssigneeAvatar({ initials, title }: { initials: string; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tone-cyan-bg text-tone-cyan-fg border border-tone-cyan-br text-[10px] font-semibold"
    >
      {initials}
    </span>
  );
}

function formatActionTypeLabel(actionType?: string | null): string | null {
  if (!actionType) return null;
  return (
    ACTION_TYPE_LABELS[actionType] ||
    actionType
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase())
  );
}

interface PlanDetail {
  id: string;
  moveDate: string;
  status: string;
  fromAddress: { street: string; city: string; state: string; zip: string };
  toAddress: { street: string; city: string; state: string; zip: string };
}

interface MoveTaskItem {
  id: string;
  title: string;
  description?: string | null;
  actionType: string;
  status: string;
  confidence: string;
  dueDate?: string | null;
  reason?: string | null;
  caveats?: string[] | null;
  localEffect?: MoveTaskLocalEffect | null;
  destinationProvider?: { name: string } | null;
  customProvider?: { name: string } | null;
  assignee?: { id: string; name: string | null; initials: string } | null;
}

interface WorkspaceMemberOption {
  userId: string;
  name: string | null;
  initials: string;
}

export default function MovingPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("moving");
  const id = params.id as string;
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [migration, setMigration] = useState<any>(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [stateRules, setStateRules] = useState<any>(null);
  const [stateGuideOpen, setStateGuideOpen] = useState(false);
  const [moveTasks, setMoveTasks] = useState<MoveTaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskBusy, setTaskBusy] = useState<string | null>(null);
  // Task assignment (Family/Pro). Members + flag come from the move-tasks GET;
  // assignment UI only renders when assignmentEnabled (2+ active members).
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberOption[]>([]);
  const [assignmentEnabled, setAssignmentEnabled] = useState(false);
  // Task id whose assign picker is open, and the id mid-assign (for spinner).
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [assignBusy, setAssignBusy] = useState<string | null>(null);

  const fetchMigration = async (planId: string) => {
    setMigrationLoading(true);
    try {
      const r = await fetch(`/api/moving/migration?planId=${planId}`);
      const m = await r.json();
      setMigration(m.analysis || null);
    } catch {} finally {
      setMigrationLoading(false);
    }
  };

  const fetchMoveTasks = async (planId: string) => {
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/move-tasks?movingPlanId=${planId}`);
      const data = await res.json();
      setMoveTasks(data.tasks || []);
      setWorkspaceMembers(Array.isArray(data.workspaceMembers) ? data.workspaceMembers : []);
      setAssignmentEnabled(Boolean(data.assignmentEnabled));
    } catch {
      toast.error("Failed to load move tasks");
    } finally {
      setTasksLoading(false);
    }
  };

  // Assign (or unassign) a task to a workspace member. Pass null to clear.
  // Any active member may assign within their workspace; the API validates the
  // target is an active member before writing.
  const assignMoveTask = async (taskId: string, assignedToUserId: string | null) => {
    setAssignBusy(taskId);
    try {
      const res = await fetch("/api/move-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, assignedToUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign task");
      if (plan) await fetchMoveTasks(plan.id);
      setAssignOpen(null);
    } catch (error: any) {
      toast.error(error?.message || "Failed to assign task");
    } finally {
      setAssignBusy(null);
    }
  };

  const generateMoveTasks = async () => {
    if (!plan) return;
    setTasksLoading(true);
    try {
      const res = await fetch("/api/move-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movingPlanId: plan.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate move tasks");
      setMoveTasks(data.tasks || []);
      toast.success(`Generated ${data.generatedCount || 0} suggested tasks`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate move tasks");
    } finally {
      setTasksLoading(false);
    }
  };

  const updateMoveTask = async (
    taskId: string,
    event: "ACCEPT" | "START" | "COMPLETE" | "DISMISS" | "REOPEN",
  ): Promise<boolean> => {
    setTaskBusy(taskId);
    try {
      const res = await fetch("/api/move-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, event }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update task");
      if (plan) await fetchMoveTasks(plan.id);
      return true;
    } catch (error: any) {
      toast.error(error?.message || "Failed to update task");
      return false;
    } finally {
      setTaskBusy(null);
    }
  };

  // Single-tap "Done": replaces the old `window.confirm` modal. Completing
  // a task is fully reversible via Reopen, so prompting the user every
  // time is friction without a payoff. The undo toast covers the rare
  // mis-tap path with a 5-second window — same pattern Gmail uses for
  // archive.
  const handleCompleteMoveTask = async (taskId: string) => {
    const ok = await updateMoveTask(taskId, "COMPLETE");
    if (!ok) return;
    toast.success("Completed locally in LocateFlow", {
      description: "Provider accounts are not updated automatically.",
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          void updateMoveTask(taskId, "REOPEN");
        },
      },
    });
  };

  const handleDismissMoveTask = async (taskId: string) => {
    const ok = await updateMoveTask(taskId, "DISMISS");
    if (!ok) return;
    toast("Task skipped", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          void updateMoveTask(taskId, "REOPEN");
        },
      },
    });
  };

  const handleReopenMoveTask = async (taskId: string) => {
    const ok = await updateMoveTask(taskId, "REOPEN");
    if (ok) toast.success("Task reopened");
  };

  const formatTaskDueDate = (value?: string | null) => {
    if (!value) return null;
    const dueDate = new Date(value);
    if (Number.isNaN(dueDate.getTime())) return null;
    return dueDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  useEffect(() => {
    fetch(`/api/moving/${id}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => {
        const normalizedPlan = data.plan
          ? { ...data.plan, status: normalizeMovingPlanStatus(data.plan.status) }
          : null;
        setPlan(normalizedPlan);
        if (normalizedPlan && (normalizedPlan.status === "PLANNING" || normalizedPlan.status === "IN_PROGRESS")) {
          void fetchMigration(normalizedPlan.id);
          void fetchMoveTasks(normalizedPlan.id);
        }
        if (normalizedPlan?.toAddress?.state) {
          fetch(`/api/state-rules?state=${encodeURIComponent(normalizedPlan.toAddress.state)}`)
            .then((r) => r.ok ? r.json() : null)
            .then((d) => { if (d?.stateRule) setStateRules(d.stateRule); })
            .catch(() => {});
        }
      })
      .catch(() => router.push("/moving"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/moving/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({}),
    });
    if (res.ok) { toast.success("Plan deleted"); router.push("/moving"); }
    else { toast.error("Failed to delete"); setDeleting(false); }
  };

  const handleStatusChange = async (status: string) => {
    try {
      const res = await fetch(`/api/moving/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) setPlan((prev) => prev ? { ...prev, status } : prev);
    } catch {}
  };

  if (loading || !plan) return <LoadingSpinner />;

  const daysUntilMove = Math.ceil((new Date(plan.moveDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const statusClasses = STATUS_BADGE_CLASSES[plan.status] || STATUS_BADGE_CLASSES.PLANNING;
  const statusLabel = t(STATUS_LABEL_KEYS[plan.status] || "status_planning");
  const isInterstateMove = plan.fromAddress.state !== plan.toAddress.state;
  const moveScopeLabel = isInterstateMove ? t("interstateMove") : t("intrastateMove");
  const focusLabel = isInterstateMove
    ? t("interstateMoveFocus")
    : t("intrastateMoveFocus");
  const migrationSummaryLabel = migration
    ? `${migration.transitionPlans?.length || migration.summary.total} transition items · guidance only`
    : t("migrationGuidanceEmpty");

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/moving">
            <button className="p-2 rounded-xl text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2 flex-wrap">
              {plan.fromAddress.city} <ArrowRight className="h-4 w-4 text-foreground/40" /> {plan.toAddress.city}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {daysUntilMove > 0 ? t("daysUntilMove", { days: daysUntilMove }) : t("moveDatePassed")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] px-2 py-1 rounded-full border font-medium ${statusClasses.cls}`}>
            {statusLabel}
          </span>
          {plan.status === "PLANNING" && (
            <button onClick={() => handleStatusChange("IN_PROGRESS")} className="px-3 py-1.5 rounded-xl bg-tone-cyan-fg text-white text-xs font-medium hover:bg-tone-cyan-fg/80 transition">
              Start Moving
            </button>
          )}
          {plan.status === "IN_PROGRESS" && (
            <button onClick={() => handleStatusChange("COMPLETED")} className="px-3 py-1.5 rounded-xl bg-tone-emerald-fg text-white text-xs font-medium hover:bg-tone-emerald-bg transition">
              Mark Complete
            </button>
          )}
        </div>
      </div>

      {/* Address cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: "From", addr: plan.fromAddress, color: "red" },
          { label: "To", addr: plan.toAddress, color: "emerald" },
        ].map((item) => (
          <div key={item.label} className={`rounded-2xl border border-${item.color}-500/20 bg-${item.color}-500/5 backdrop-blur-xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className={`h-4 w-4 text-${item.color}-400`} />
              <span className={`text-xs font-medium text-${item.color}-400`}>{item.label}</span>
            </div>
            <p className="text-sm font-medium text-foreground">{item.addr.street}</p>
            <p className="text-xs text-muted-foreground">{item.addr.city}, {item.addr.state} {item.addr.zip}</p>
          </div>
        ))}
      </div>

      {/* Move Date */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-4 flex items-center gap-4">
        <Calendar className="h-6 w-6 text-tone-orange-fg shrink-0" />
        <div>
          <p className="text-2xl font-bold text-foreground">{new Date(plan.moveDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
          <p className="text-[11px] text-muted-foreground">Move Date</p>
        </div>
      </div>

      <div className="rounded-2xl border border-tone-emerald-br bg-tone-emerald-bg backdrop-blur-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-tone-emerald-fg" />
              Your move checklist
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Your provider migration steps and new-service to-dos, all in one place.
              Items are tracked locally in LocateFlow — marking one done won't change anything at the provider.
            </p>
          </div>
          <button
            onClick={generateMoveTasks}
            disabled={tasksLoading}
            className="px-3 py-1.5 rounded-xl bg-tone-emerald-fg text-white text-xs font-medium hover:bg-tone-emerald-bg transition disabled:opacity-50"
          >
            {tasksLoading
              ? "Working…"
              : moveTasks.length === 0
                ? "Generate checklist"
                : "Refresh checklist"}
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {moveTasks.length === 0 && !tasksLoading && (
            <div className="rounded-xl border border-border bg-black/10 p-4">
              <p className="text-sm text-muted-foreground">No items yet.</p>
              <p className="text-xs text-foreground/35 mt-1">
                Add a destination address and at least one service, then click "Generate checklist".
              </p>
            </div>
          )}
          {moveTasks.map((task) => {
            const busy = taskBusy === task.id;
            const isDone = task.status === "COMPLETED";
            const isDismissed = task.status === "DISMISSED";
            const statusLabel = isDone ? "Done" : isDismissed ? "Skipped" : "To do";
            const statusCls = isDone
              ? "bg-tone-emerald-bg text-tone-emerald-fg border-tone-emerald-br"
              : isDismissed
                ? "bg-foreground/[0.04] text-foreground/35 border-border"
                : "bg-tone-cyan-bg text-tone-cyan-fg border-tone-cyan-br";
            return (
              <div
                key={task.id}
                className={`rounded-xl border p-4 transition ${
                  isDone || isDismissed
                    ? "border-foreground/[0.06] bg-foreground/[0.02] opacity-70"
                    : "border-border bg-black/10"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusCls}`}>
                        {statusLabel}
                      </span>
                      {formatActionTypeLabel(task.actionType) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-foreground/5 text-muted-foreground font-medium">
                          {formatActionTypeLabel(task.actionType)}
                        </span>
                      )}
                      {task.localEffect?.localOnly && !isDone && !isDismissed && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-tone-honey-br bg-tone-honey-bg text-tone-honey-fg">
                          LocateFlow only
                        </span>
                      )}
                      {/* Assignee avatar — shown only in multi-member workspaces. */}
                      {assignmentEnabled && task.assignee && (
                        <span className="inline-flex items-center gap-1">
                          <AssigneeAvatar
                            initials={task.assignee.initials}
                            title={task.assignee.name || "Assigned"}
                          />
                          <span className="text-[10px] text-muted-foreground">{task.assignee.name || "Assigned"}</span>
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-semibold mt-2 ${isDone ? "text-foreground/80 line-through" : "text-foreground"}`}>
                      {task.title}
                    </p>
                    {task.description && !isDone && !isDismissed && (
                      <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                    )}
                    {formatTaskDueDate(task.dueDate) && !isDone && !isDismissed && (
                      <p className="inline-flex items-center gap-1 text-[11px] text-tone-cyan-fg mt-2">
                        <Clock className="h-3 w-3" />
                        Due {formatTaskDueDate(task.dueDate)}
                      </p>
                    )}
                    {task.destinationProvider?.name && !isDone && !isDismissed && (
                      <p className="text-[11px] text-tone-emerald-fg mt-2">Candidate: {task.destinationProvider.name}</p>
                    )}
                    {task.caveats?.[0] && !isDone && !isDismissed && (
                      <p className="text-[10px] text-foreground/40 mt-2">{task.caveats[0]}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {/* Assign picker — multi-member workspaces only. Any active
                        member may assign within their workspace. */}
                    {assignmentEnabled && (
                      <div className="relative">
                        <button
                          type="button"
                          disabled={assignBusy === task.id}
                          onClick={() => setAssignOpen(assignOpen === task.id ? null : task.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-foreground/5 text-muted-foreground text-[11px] hover:bg-foreground/10 disabled:opacity-50"
                          aria-haspopup="listbox"
                          aria-expanded={assignOpen === task.id}
                        >
                          {assignBusy === task.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : task.assignee ? (
                            <UserCircle2 className="h-3 w-3" />
                          ) : (
                            <UserPlus className="h-3 w-3" />
                          )}
                          {task.assignee ? "Reassign" : "Assign"}
                        </button>
                        {assignOpen === task.id && (
                          <div
                            role="listbox"
                            className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-border bg-background shadow-lg overflow-hidden"
                          >
                            {workspaceMembers.map((m) => {
                              const selected = task.assignee?.id === m.userId;
                              return (
                                <button
                                  key={m.userId}
                                  type="button"
                                  onClick={() => assignMoveTask(task.id, m.userId)}
                                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-foreground/5 ${
                                    selected ? "bg-tone-cyan-bg/40" : ""
                                  }`}
                                >
                                  <AssigneeAvatar initials={m.initials} />
                                  <span className="truncate text-foreground">{m.name || "Member"}</span>
                                  {selected && <CheckCircle2 className="ml-auto h-3 w-3 text-tone-cyan-fg" />}
                                </button>
                              );
                            })}
                            {task.assignee && (
                              <button
                                type="button"
                                onClick={() => assignMoveTask(task.id, null)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-foreground/5 border-t border-border"
                              >
                                Unassign
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {!isDone && !isDismissed && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => handleCompleteMoveTask(task.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-tone-emerald-bg text-tone-emerald-fg text-[11px] font-medium hover:bg-tone-emerald-bg disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          Done
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => handleDismissMoveTask(task.id)}
                          className="px-2 py-1 rounded-lg bg-foreground/5 text-muted-foreground text-[11px] hover:bg-foreground/10 disabled:opacity-50"
                        >
                          Skip
                        </button>
                      </>
                    )}
                    {(isDone || isDismissed) && (
                      <button
                        disabled={busy}
                        onClick={() => handleReopenMoveTask(task.id)}
                        className="px-2 py-1 rounded-lg bg-foreground/5 text-muted-foreground text-[11px] hover:bg-foreground/10 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "Reopen"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {migrationLoading && !migration && moveTasks.length > 0 && (
          <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking for new services you'll need at your destination…
          </p>
        )}

        {/* New services you'll need — the one piece of migration analysis the
            generated tasks don't cover, since tasks come from services you
            already have. Folded into the same checklist card so there's a
            single place to act, instead of a duplicate "Service Migration
            Plan" section. */}
        {migration?.newNeeded?.length > 0 && (
          <div className="mt-5 border-t border-tone-emerald-br/60 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <PlusCircle className="h-3.5 w-3.5 text-tone-orange-fg" />
              <span className="text-[11px] font-medium text-tone-orange-fg uppercase tracking-wider">
                New services you'll need ({migration.newNeeded.length})
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-3 max-w-2xl">
              You don't have these at your origin, but you'll likely need them after the move.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {migration.newNeeded.map((item: any, i: number) => {
                const newHref = `/services/new?category=${encodeURIComponent(item.category)}${item.recommendedProvider ? `&providerId=${item.recommendedProvider.id}` : ""}`;
                return (
                  <div key={`new-${i}`} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-tone-orange-bg border border-tone-orange-br">
                    <span className="text-base">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground/80 truncate">{item.categoryLabel}</p>
                      {item.recommendedProvider && (
                        <p className="text-[10px] text-tone-orange-fg truncate">Rec: {item.recommendedProvider.name}</p>
                      )}
                    </div>
                    <Link href={newHref}>
                      <button className="shrink-0 px-2 py-1 rounded-lg bg-tone-orange-bg text-tone-orange-fg text-[10px] font-medium hover:bg-tone-orange-bg transition">
                        Browse
                      </button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Move Scope Summary */}
      <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl p-5">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-foreground/40 mb-1">Move scope</p>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-foreground">{moveScopeLabel}</h3>
            <span className={`text-[10px] px-2 py-1 rounded-full border font-medium ${isInterstateMove ? "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br" : "bg-tone-emerald-bg text-tone-emerald-fg border-tone-emerald-br"}`}>
              {plan.fromAddress.state} → {plan.toAddress.state}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{focusLabel}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl border border-border bg-foreground/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-wider text-foreground/35 mb-1">Route</p>
            <p className="text-sm font-medium text-foreground">{plan.fromAddress.city}, {plan.fromAddress.state} → {plan.toAddress.city}, {plan.toAddress.state}</p>
            <p className="text-xs text-foreground/35 mt-1">Your guidance uses this route, but provider actions remain manual.</p>
          </div>
          <div className="rounded-xl border border-border bg-foreground/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-wider text-foreground/35 mb-1">Service migration</p>
            <p className="text-sm font-medium text-foreground">{migrationSummaryLabel}</p>
            <p className="text-xs text-foreground/35 mt-1">Tracked as steps in your move checklist above — unverified until confirmed with the provider.</p>
          </div>
          <div className="rounded-xl border border-border bg-foreground/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-wider text-foreground/35 mb-1">Checklist posture</p>
            <p className="text-sm font-medium text-foreground">{isInterstateMove ? "Higher compliance workload" : "Operational move workflow"}</p>
            <p className="text-xs text-foreground/35 mt-1">{isInterstateMove ? "Expect more identity, vehicle, and state transition tasks." : "Expect more transfer, scheduling, and utility coordination tasks."}</p>
          </div>
        </div>
      </div>

      {/* State Guide */}
      {stateRules && (
        <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-foreground/[0.03] transition"
            onClick={() => setStateGuideOpen(!stateGuideOpen)}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-tone-cyan-fg" />
              <span className="text-sm font-semibold text-foreground">State Guide — {plan.toAddress.state}</span>
            </div>
            {stateGuideOpen ? (
              <ChevronUp className="h-4 w-4 text-foreground/40" />
            ) : (
              <ChevronDown className="h-4 w-4 text-foreground/40" />
            )}
          </button>
          {stateGuideOpen && (
            <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
              {stateRules.dmvRules && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">DMV / Vehicle</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{stateRules.dmvRules}</p>
                </div>
              )}
              {stateRules.voterRegistration && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">Voter Registration</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{stateRules.voterRegistration}</p>
                </div>
              )}
              {stateRules.taxInfo && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">State Tax</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{stateRules.taxInfo}</p>
                </div>
              )}
              {stateRules.utilityInfo && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">Utilities</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{stateRules.utilityInfo}</p>
                </div>
              )}
              {stateRules.insuranceRules && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">Insurance</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{stateRules.insuranceRules}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete */}
      <div className="flex justify-end">
        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-foreground/30 hover:text-destructive hover:bg-destructive/10 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />Delete Plan
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground/40">Delete this plan and all data?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded-xl text-xs bg-destructive text-white hover:bg-destructive/80 transition disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </button>
            <button onClick={() => setDeleteConfirm(false)} className="px-3 py-1.5 rounded-xl text-xs text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
