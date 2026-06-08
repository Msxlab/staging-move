import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { ArrowRight, Check, CalendarClock, RotateCcw } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useAppTheme, type Theme } from "@/lib/theme";
import { hapticSuccess, hapticError, hapticLight } from "@/lib/haptics";
import { ListEntrance } from "@/components/ui/ListEntrance";
import { PressableScale } from "@/components/ui/PressableScale";
import { Avatar } from "@/components/ui/Avatar";

/**
 * UP NEXT — the dashboard's one-tap task-clearing strip.
 *
 * Goal: cut the "complete a task" loop from ~4 taps (open plan → scroll →
 * Complete → confirm dialog) to 1 tap (the inline checkbox here). It shows the
 * 2-3 nearest-due OPEN move-tasks for the active plan and completes them inline
 * via the SAME lifecycle event the plan-detail screen uses:
 *   PATCH /api/move-tasks { id, event: "COMPLETE" }
 *
 * Behavior:
 *   - OPEN = status SUGGESTED | ACCEPTED | IN_PROGRESS (not COMPLETED/DISMISSED).
 *   - Sorted by dueDate ascending (no-due-date sinks to the bottom), capped at 3.
 *   - Completing is OPTIMISTIC + NON-BLOCKING: the row is removed immediately,
 *     success haptic fires, and the parent's onCompleted() best-effort refreshes
 *     the dashboard so the readiness ring bumps. On API error we REVERT (re-add
 *     the row), fire an error haptic, and surface a quiet inline message.
 *   - UNDO: after a successful completion a transient "Completed — Undo" bar
 *     appears for ~5s. Tapping Undo PATCHes the SAME task with event:"REOPEN"
 *     (no new endpoint), re-inserts the row in its sorted position, and re-syncs
 *     readiness via onCompleted() so the ring falls back. The window auto-clears.
 *   - Self-hides when there is no active plan or no open tasks (renders null), so
 *     it never adds an empty card to the dashboard.
 *
 * Honesty note: completion is LOCAL ONLY — it updates LocateFlow records, never
 * external provider accounts. We don't show the full local-only modal here (the
 * plan screen does); the strip is the fast path for users who already know what
 * "complete" means. The plan screen keeps the explanatory confirm.
 */

interface MoveTaskLite {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
  // Assignee (Family/Pro), display-only here. Null = unassigned. UpNext NEVER
  // edits assignment — it just shows whose task it is via an initials avatar.
  assignee?: { id: string; name: string | null; initials: string } | null;
}

// REOPENED is an OPEN state too: undoing a completion via PATCH REOPEN lands the
// task in REOPENED, so it must survive a subsequent refetch's status filter.
const OPEN_STATUSES = new Set(["SUGGESTED", "ACCEPTED", "IN_PROGRESS", "REOPENED"]);
const MAX_VISIBLE = 3;
// How long the "Completed — Undo" affordance stays before it auto-dismisses.
const UNDO_WINDOW_MS = 5000;

function sortByDue(a: MoveTaskLite, b: MoveTaskLite): number {
  const at = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const bt = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
  if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
  if (Number.isNaN(at)) return 1;
  if (Number.isNaN(bt)) return -1;
  if (at !== bt) return at - bt;
  // Stable tiebreaker so the comparator is transitive on equal due dates.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function UpNext({
  planId,
  locale,
  onViewAll,
  onCompleted,
}: {
  /** Active moving plan id; the strip hides when null/undefined. */
  planId: string | null | undefined;
  /** Date-format locale (e.g. "en-US" / "es-ES"). */
  locale: string;
  /** Navigate into the plan ("View all"). */
  onViewAll: () => void;
  /**
   * Fired after a successful inline completion so the dashboard can refresh
   * (readiness ring / checklist %). Best-effort — awaited but failures here
   * never revert the optimistic removal.
   */
  onCompleted?: () => void | Promise<void>;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();

  const [tasks, setTasks] = useState<MoveTaskLite[] | null>(null);
  // id currently being completed → disables its row + shows a spinner.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  // The most-recently-completed task, held for the ~5s Undo window. Null hides
  // the undo bar. We keep the full task object so REOPEN can re-insert it in its
  // original sorted position without a refetch.
  const [undoTask, setUndoTask] = useState<MoveTaskLite | null>(null);
  // True while the REOPEN PATCH is in flight (disables the Undo button).
  const [undoing, setUndoing] = useState(false);
  // Auto-dismiss timer for the undo window; cleared on undo, re-complete, unmount.
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  // Clean up the pending timer on unmount.
  useEffect(() => () => clearUndoTimer(), [clearUndoTimer]);

  const fetchOpen = useCallback(async () => {
    if (!planId) {
      setTasks(null);
      return;
    }
    const res = await api.get<any>("/api/move-tasks", { movingPlanId: planId });
    if (res.error || !res.data?.tasks) {
      // Non-blocking: leave the strip hidden on error rather than showing a
      // broken card. The dashboard's own error path already surfaces failures.
      setTasks([]);
      return;
    }
    const open: MoveTaskLite[] = (res.data.tasks as any[])
      .filter((tk) => OPEN_STATUSES.has(tk.status))
      .map((tk) => ({
        id: tk.id,
        title: tk.title,
        status: tk.status,
        dueDate: tk.dueDate ?? null,
        assignee: tk.assignee ?? null,
      }));
    open.sort(sortByDue);
    setTasks(open);
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
      setErrorId(null);
      // Optimistic removal: drop the row immediately so the tap feels instant.
      const prev = tasks ?? [];
      setTasks(prev.filter((tk) => tk.id !== task.id));
      // SAME complete event the plan-detail screen fires.
      const res = await api.patch<any>("/api/move-tasks", { id: task.id, event: "COMPLETE" });
      if (res.error) {
        // Revert: re-insert the row in its original sorted position.
        hapticError();
        setErrorId(task.id);
        reinsertSorted(task);
        setBusyId(null);
        return;
      }
      hapticSuccess();
      setBusyId(null);
      // Open the transient Undo window for this task. A new completion replaces
      // any prior undo target (only the latest is undoable) and resets the timer.
      clearUndoTimer();
      setUndoTask(task);
      undoTimerRef.current = setTimeout(() => {
        setUndoTask(null);
        undoTimerRef.current = null;
      }, UNDO_WINDOW_MS);
      // Best-effort dashboard refresh so the readiness ring bumps. Failures
      // here never undo the completion.
      try {
        await onCompleted?.();
      } catch {
        /* non-blocking */
      }
    },
    [busyId, tasks, onCompleted, reinsertSorted, clearUndoTimer],
  );

  const handleUndo = useCallback(async () => {
    const task = undoTask;
    if (!task || undoing) return;
    setUndoing(true);
    clearUndoTimer();
    // REOPEN the just-completed task via the SAME endpoint (no new route). On
    // success the task returns to an OPEN state, so we re-insert it and re-sync
    // readiness so the ring falls back.
    const res = await api.patch<any>("/api/move-tasks", { id: task.id, event: "REOPEN" });
    if (res.error) {
      // Couldn't undo: keep the completion (the task stays done) and drop the
      // bar. The error haptic signals the failure; there is no row to attach an
      // inline message to since the task was already removed on completion.
      hapticError();
      setUndoing(false);
      setUndoTask(null);
      return;
    }
    hapticLight();
    // Re-insert in its original sorted slot (status now REOPENED, still OPEN).
    reinsertSorted({ ...task, status: "REOPENED" });
    setUndoTask(null);
    setUndoing(false);
    try {
      await onCompleted?.();
    } catch {
      /* non-blocking */
    }
  }, [undoTask, undoing, clearUndoTimer, reinsertSorted, onCompleted]);

  // Hide entirely: no plan, or still loading. When there are no open tasks we
  // still render IF an undo bar is pending (so the user can reopen the task they
  // just cleared) — otherwise hide.
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
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <CalendarClock size={15} color={theme.colors.primary} />
          <Text style={styles.headerTitle}>{t("dashboard.upNext_title")}</Text>
        </View>
        <TouchableOpacity
          onPress={onViewAll}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t("dashboard.upNext_viewAll")}
          style={styles.viewAll}
        >
          <Text style={styles.viewAllText}>{t("dashboard.upNext_viewAll")}</Text>
          <ArrowRight size={13} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {visible.map((task, index) => {
        const due = formatDue(task.dueDate);
        const busy = busyId === task.id;
        const failed = errorId === task.id;
        return (
          <ListEntrance key={task.id} index={index}>
            <View style={[styles.row, index > 0 && styles.rowDivider]}>
              <PressableScale
                onPress={() => handleComplete(task)}
                disabled={busy}
                min={0.88}
                style={styles.checkbox}
                accessibilityRole="checkbox"
                accessibilityLabel={t("dashboard.upNext_completeLabel", { title: task.title })}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Check size={16} color={theme.colors.primary} />
                )}
              </PressableScale>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  {task.title}
                </Text>
                {failed ? (
                  <Text style={styles.errorText} numberOfLines={1}>
                    {t("dashboard.upNext_completeFailed")}
                  </Text>
                ) : (
                  <View style={styles.dueChip}>
                    <Text style={styles.dueText}>
                      {due ? t("dashboard.upNext_due", { date: due }) : t("dashboard.upNext_noDate")}
                    </Text>
                  </View>
                )}
              </View>
              {/* Assignee avatar — display only, no picker here. */}
              {task.assignee ? (
                <Avatar
                  initials={task.assignee.initials}
                  size={26}
                  style={styles.assigneeAvatar}
                />
              ) : null}
            </View>
          </ListEntrance>
        );
      })}

      {/* Transient "Completed — Undo" affordance. Shown for ~5s after a
          completion; tapping Undo REOPENs the task and re-syncs readiness. */}
      {undoTask ? (
        <View
          style={[styles.undoBar, visible.length > 0 && styles.undoBarSpaced]}
          accessibilityRole="summary"
        >
          <Check size={15} color={theme.colors.success} />
          <Text style={styles.undoText} numberOfLines={1}>
            {t("dashboard.upNext_completed", { title: undoTask.title })}
          </Text>
          <TouchableOpacity
            onPress={handleUndo}
            disabled={undoing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t("dashboard.upNext_undo")}
            style={styles.undoBtn}
          >
            {undoing ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <>
                <RotateCcw size={13} color={theme.colors.primary} />
                <Text style={styles.undoBtnText}>{t("dashboard.upNext_undo")}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      marginBottom: 16,
      padding: 16,
      borderRadius: 20,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      ...t.shadow.sm,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    headerTitle: {
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: t.colors.primary,
    },
    viewAll: { flexDirection: "row", alignItems: "center", gap: 3 },
    viewAllText: { fontSize: 12, fontWeight: "700", color: t.colors.primary },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: t.colors.border },
    checkbox: {
      width: 30,
      height: 30,
      borderRadius: 9,
      backgroundColor: t.colors.primaryFaded,
      borderWidth: 1,
      borderColor: `${t.colors.primary}55`,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 14, fontWeight: "600", color: t.colors.text },
    assigneeAvatar: { marginLeft: 8 },
    dueChip: { marginTop: 4, alignSelf: "flex-start" },
    dueText: { fontSize: 11, color: t.colors.textTertiary, fontWeight: "600" },
    errorText: { fontSize: 11, color: t.colors.error, fontWeight: "600", marginTop: 4 },
    undoBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: t.colors.successFaded,
      borderWidth: 1,
      borderColor: `${t.colors.success}3D`,
    },
    undoBarSpaced: { marginTop: 10 },
    undoText: { flex: 1, fontSize: 12.5, fontWeight: "600", color: t.colors.text },
    undoBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
    undoBtnText: { fontSize: 12.5, fontWeight: "700", color: t.colors.primary },
  });
