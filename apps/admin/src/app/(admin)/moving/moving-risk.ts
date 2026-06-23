/**
 * Read-only per-move risk derivation for the admin moving list.
 *
 * This MIRRORS the server-side at-risk board logic in
 * `apps/admin/src/app/api/moving/at-risk/route.ts`. It is intentionally a
 * faithful re-implementation of the same signals so the "Risk" column on the
 * main moving list bands moves the same way the dedicated At-Risk board does —
 * no new score is invented here.
 *
 * It is computed entirely from data the existing `/api/moving` endpoint already
 * returns for each plan (move date, status, the move-task slice with
 * status/dueDate, and the per-address service counts). Nothing is fetched or
 * written; this is pure presentation-layer derivation.
 *
 * Caveat vs. the server board: the list endpoint returns at most a slice of
 * move tasks per plan (`take: 8`) plus a true `_count.moveTasks`. Open/overdue
 * counts are therefore derived from the available slice and can undercount on
 * plans with many tasks. This only ever softens a row's banding, never inflates
 * it, which is safe for an additive read-only signal. The authoritative board
 * at `/moving/at-risk` remains the source of truth.
 */

// Keep these in lockstep with the at-risk route.
const TERMINAL_TASK_STATUSES = ["COMPLETED", "DISMISSED"];
// A move is "soon" when it falls within this many days from now.
const SOON_WINDOW_DAYS = 14;
// Upcoming-checklist signal looks a little further out than the soon window.
const UPCOMING_WINDOW_DAYS = 30;
// Below this completion ratio a soon move counts as "low completeness".
const LOW_COMPLETENESS_RATIO = 0.5;

export type RiskCode =
  | "OVERDUE_TASKS"
  | "INCOMPLETE_CHECKLIST"
  | "NO_SERVICES_TRACKED"
  | "SOON_LOW_COMPLETENESS";

/** Tri-state banding shown in the Risk column. */
export type RiskLevel = "high" | "elevated" | "none";

export interface RiskReason {
  code: RiskCode;
  severity: "high" | "medium";
}

export interface MoveRisk {
  /** Overall banding: "high" (any high reason), "elevated" (any medium reason), or "none". */
  level: RiskLevel;
  reasons: RiskReason[];
}

/**
 * Minimal shape this helper needs — a structural subset of the `Plan` the
 * moving list already holds. Canceled/completed plans are not "at risk".
 */
export interface RiskInputPlan {
  status: string;
  moveDate: string | Date;
  moveTasks?: Array<{ status: string; dueDate: string | null }>;
  fromAddress?: { _count?: { services?: number } | null } | null;
  toAddress?: { _count?: { services?: number } | null } | null;
}

const RISK_TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELED", "CANCELLED"]);

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

const EMPTY_RISK: MoveRisk = { level: "none", reasons: [] };

/**
 * Derive the risk banding + reasons for a single plan, mirroring the at-risk
 * board. `now` is injectable for deterministic testing.
 */
export function deriveMoveRisk(plan: RiskInputPlan, now: Date = new Date()): MoveRisk {
  const status = String(plan.status || "").toUpperCase();
  if (RISK_TERMINAL_STATUSES.has(status)) return EMPTY_RISK;

  const today = startOfDay(now);
  const moveDate = new Date(plan.moveDate);
  // The board only considers moves whose date hasn't passed yet.
  if (startOfDay(moveDate) < today) return EMPTY_RISK;

  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + UPCOMING_WINDOW_DAYS);

  const tasks = plan.moveTasks || [];
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const openTasks = tasks.filter((t) => !TERMINAL_TASK_STATUSES.includes(t.status));
  const overdueTasks = openTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now);
  const actionable = completedTasks + openTasks.length;
  const completionRatio = actionable > 0 ? completedTasks / actionable : 0;

  const originServices = plan.fromAddress?._count?.services ?? 0;
  const destinationServices = plan.toAddress?._count?.services ?? 0;
  const totalServices = originServices + destinationServices;

  const daysUntilMove = daysBetween(today, startOfDay(moveDate));
  const isSoon = daysUntilMove <= SOON_WINDOW_DAYS;
  const isUpcoming = moveDate <= horizon;

  const reasons: RiskReason[] = [];

  if (overdueTasks.length > 0) {
    reasons.push({ code: "OVERDUE_TASKS", severity: "high" });
  }
  if (totalServices === 0) {
    reasons.push({ code: "NO_SERVICES_TRACKED", severity: "medium" });
  }
  if (isUpcoming && openTasks.length > 0) {
    reasons.push({
      code: "INCOMPLETE_CHECKLIST",
      severity: daysUntilMove <= SOON_WINDOW_DAYS ? "high" : "medium",
    });
  }
  if (isSoon && completionRatio < LOW_COMPLETENESS_RATIO) {
    reasons.push({ code: "SOON_LOW_COMPLETENESS", severity: "high" });
  }

  if (reasons.length === 0) return EMPTY_RISK;

  const level: RiskLevel = reasons.some((r) => r.severity === "high") ? "high" : "elevated";
  return { level, reasons };
}

/** Display label for a banding level (column cell + ministat). */
export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  high: "High",
  elevated: "Elevated",
  none: "Low",
};

/**
 * Tone-token classes for the Risk cell, reusing the existing design tokens
 * already used across the moving pages (rose = high, honey = elevated,
 * slate/muted = low).
 */
export const RISK_LEVEL_CLASS: Record<RiskLevel, string> = {
  high: "bg-tone-rose-bg text-tone-rose-fg border-tone-rose-br",
  elevated: "bg-tone-honey-bg text-tone-honey-fg border-tone-honey-br",
  none: "bg-tone-slate-bg text-muted-foreground border-tone-slate-br",
};
