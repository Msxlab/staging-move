"use client";

/**
 * UP NEXT (web) — the dashboard's one-tap task-clearing strip, ported from the
 * mobile UpNext for parity. It sits beside the Move Command Center and shows the
 * 2-3 nearest-due OPEN move-tasks for the active plan, each with an inline
 * checkbox that completes via the SAME lifecycle event the plan screen uses:
 *   PATCH /api/move-tasks { id, event: "COMPLETE" }
 *
 * Behaviour (mirrors mobile):
 *   - OPEN = SUGGESTED | ACCEPTED | IN_PROGRESS | REOPENED (REOPENED is what an
 *     undone task becomes, so it must survive a refetch's status filter).
 *   - Sorted by dueDate ascending (no-due-date sinks to the bottom), capped at 3.
 *   - Completing is OPTIMISTIC: the row is removed immediately, then onCompleted()
 *     re-fetches the dashboard so the readiness ring bumps. On API error we REVERT.
 *   - UNDO: after a successful completion a transient "Completed — Undo" bar shows
 *     for ~5s. Undo PATCHes the SAME task with event:"REOPEN" (no new endpoint),
 *     re-inserts the row, and re-syncs readiness. The window auto-clears.
 *   - Self-hides when there is no active plan or no open tasks (and no pending
 *     undo), so it never adds an empty card to the dashboard.
 *
 * Honesty note: completion is LOCAL ONLY — it updates LocateFlow records, never
 * external provider accounts. This strip is the fast path for users who already
 * know what "complete" means; the plan screen keeps the explanatory confirm.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CalendarClock, RotateCcw, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface MoveTaskLite {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
}

const OPEN_STATUSES = new Set(["SUGGESTED", "ACCEPTED", "IN_PROGRESS", "REOPENED"]);
const MAX_VISIBLE = 3;
const UNDO_WINDOW_MS = 5000;

function sortByDue(a: MoveTaskLite, b: MoveTaskLite): number {
  const at = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const bt = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const aSafe = Number.isNaN(at) ? Number.POSITIVE_INFINITY : at;
  const bSafe = Number.isNaN(bt) ? Number.POSITIVE_INFINITY : bt;
  if (aSafe !== bSafe) return aSafe - bSafe;
  // Stable tiebreaker so the comparator is transitive on equal due dates.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function UpNext({
  planId,
  locale,
  onCompleted,
  t,
}: {
  /** Active moving plan id; the strip hides when null/undefined. */
  planId: string | null | undefined;
  /** Date-format locale (e.g. "en-US"). */
  locale: string;
  /**
   * Fired after a successful inline completion/undo so the dashboard can
   * re-fetch (readiness ring / checklist %). Best-effort — failures here never
   * revert the optimistic change.
   */
  onCompleted?: () => void | Promise<void>;
  /** Localised copy. Keyed access keeps this component i18n-agnostic. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [tasks, setTasks] = useState<MoveTaskLite[] | null>(null);
  // id currently being completed → disables its row + shows a spinner.
  const [busyId, setBusyId] = useState<string | null>(null);
  // The most-recently-completed task, held for the ~5s Undo window.
  const [undoTask, setUndoTask] = useState<MoveTaskLite | null>(null);
  const [undoing, setUndoing] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearUndoTimer(), [clearUndoTimer]);

  const fetchOpen = useCallback(async () => {
    if (!planId) {
      setTasks(null);
      return;
    }
    try {
      const res = await fetch(`/api/move-tasks?movingPlanId=${encodeURIComponent(planId)}`);
      if (!res.ok) {
        setTasks([]);
        return;
      }
      const data = await res.json();
      const open: MoveTaskLite[] = (data?.tasks ?? [])
        .filter((tk: any) => OPEN_STATUSES.has(tk.status))
        .map((tk: any) => ({
          id: tk.id,
          title: tk.title,
          status: tk.status,
          dueDate: tk.dueDate ?? null,
        }));
      open.sort(sortByDue);
      setTasks(open);
    } catch {
      // Non-blocking: leave the strip hidden on error rather than a broken card.
      setTasks([]);
    }
  }, [planId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!planId) {
        if (!cancelled) setTasks(null);
        return;
      }
      // Reset to loading on plan change so a stale list never flashes.
      if (!cancelled) setTasks(null);
      await fetchOpen();
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, fetchOpen]);

  // Re-insert a task into the list in its sorted position (idempotent on id).
  const reinsertSorted = useCallback((task: MoveTaskLite) => {
    setTasks((curr) => {
      const base = curr ?? [];
      if (base.some((tk) => tk.id === task.id)) return base;
      const next = [...base, task];
      next.sort(sortByDue);
      return next;
    });
  }, []);

  const handleComplete = useCallback(
    async (task: MoveTaskLite) => {
      if (busyId) return;
      setBusyId(task.id);
      // Optimistic removal: drop the row immediately so the click feels instant.
      const prev = tasks ?? [];
      setTasks(prev.filter((tk) => tk.id !== task.id));
      try {
        const res = await fetch("/api/move-tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: task.id, event: "COMPLETE" }),
        });
        if (!res.ok) throw new Error("complete failed");
      } catch {
        // Revert: re-insert the row in its original sorted position.
        reinsertSorted(task);
        setBusyId(null);
        toast.error(t("upNext_completeFailed"));
        return;
      }
      setBusyId(null);
      // Open the transient Undo window (only the latest completion is undoable).
      clearUndoTimer();
      setUndoTask(task);
      undoTimerRef.current = setTimeout(() => {
        setUndoTask(null);
        undoTimerRef.current = null;
      }, UNDO_WINDOW_MS);
      // Best-effort dashboard re-fetch so the readiness ring bumps.
      try {
        await onCompleted?.();
      } catch {
        /* non-blocking */
      }
    },
    [busyId, tasks, onCompleted, reinsertSorted, clearUndoTimer, t],
  );

  const handleUndo = useCallback(async () => {
    const task = undoTask;
    if (!task || undoing) return;
    setUndoing(true);
    clearUndoTimer();
    try {
      const res = await fetch("/api/move-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, event: "REOPEN" }),
      });
      if (!res.ok) throw new Error("reopen failed");
    } catch {
      // Couldn't undo: keep the completion, surface a quiet error, drop the bar.
      setUndoing(false);
      setUndoTask(null);
      toast.error(t("upNext_undoFailed"));
      return;
    }
    // Re-insert in its original sorted slot (status now REOPENED, still OPEN).
    reinsertSorted({ ...task, status: "REOPENED" });
    setUndoTask(null);
    setUndoing(false);
    try {
      await onCompleted?.();
    } catch {
      /* non-blocking */
    }
  }, [undoTask, undoing, clearUndoTimer, reinsertSorted, onCompleted, t]);

  // Hide entirely: no plan, or still loading. With no open tasks we still render
  // IF an undo bar is pending (so the user can reopen what they just cleared).
  if (!planId || tasks === null) return null;
  if (tasks.length === 0 && !undoTask) return null;

  const visible = tasks.slice(0, MAX_VISIBLE);

  const formatDue = (value?: string | null) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
  };

  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-tone-orange-fg" />
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            {t("upNext_title")}
          </h3>
        </div>
        <Link
          href={planId ? `/moving/plan/${planId}` : "/moving"}
          className="flex items-center gap-1 text-[11px] font-semibold text-tone-orange-fg hover:opacity-80 transition"
        >
          {t("upNext_viewAll")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="px-5 pb-4 space-y-1">
        {visible.map((task, index) => {
          const due = formatDue(task.dueDate);
          const busy = busyId === task.id;
          return (
            <div
              key={task.id}
              className={`flex items-center gap-3 py-3 ${index > 0 ? "border-t border-border" : ""}`}
            >
              <button
                onClick={() => handleComplete(task)}
                disabled={busy}
                aria-label={t("upNext_completeLabel", { title: task.title })}
                className="h-7 w-7 shrink-0 rounded-lg bg-tone-orange-bg border border-tone-orange-br flex items-center justify-center hover:bg-tone-orange-fg/20 transition disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 text-tone-orange-fg animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-tone-orange-fg" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {due ? t("upNext_due", { date: due }) : t("upNext_noDate")}
                </p>
              </div>
            </div>
          );
        })}

        {/* Transient "Completed — Undo" affordance. */}
        {undoTask && (
          <div
            className={`flex items-center gap-2 rounded-xl border border-tone-emerald-br bg-tone-emerald-bg px-3 py-2.5 ${
              visible.length > 0 ? "mt-2" : ""
            }`}
          >
            <Check className="h-4 w-4 text-tone-emerald-fg shrink-0" />
            <p className="flex-1 min-w-0 truncate text-xs font-medium text-foreground">
              {t("upNext_completed", { title: undoTask.title })}
            </p>
            <button
              onClick={handleUndo}
              disabled={undoing}
              aria-label={t("upNext_undo")}
              className="flex items-center gap-1 text-xs font-semibold text-tone-orange-fg hover:opacity-80 transition disabled:opacity-60"
            >
              {undoing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              {t("upNext_undo")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
