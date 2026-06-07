import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import {
  CANCELED_MOVING_PLAN_STATUSES,
  isCanceledMovingPlanStatus,
  normalizeMovingPlanStatus,
} from "@locateflow/shared";

export const dynamic = "force-dynamic";

/**
 * Read-only "at-risk" board for moving plans.
 *
 * Surfaces relocations that need operator attention before the move date.
 * Pure analytics over existing records — this endpoint never mutates a plan,
 * task, service or address. Every signal is derived; nothing is written back.
 *
 * Risk signals (a plan can carry several):
 *   - OVERDUE_TASKS         — at least one open move task whose dueDate has passed.
 *   - INCOMPLETE_CHECKLIST  — an upcoming, non-completed plan with open move tasks.
 *   - NO_SERVICES_TRACKED   — an active plan with zero services on either address.
 *   - SOON_LOW_COMPLETENESS — move within SOON_WINDOW_DAYS with a low task
 *                             completion ratio (or no tasks at all).
 *
 * Canceled and completed plans are excluded — they cannot be "at risk".
 */

// "Open" = needs work. COMPLETED/DISMISSED are terminal for risk purposes.
const OPEN_TASK_STATUSES = ["SUGGESTED", "ACCEPTED", "IN_PROGRESS", "REOPENED"] as const;
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

interface RiskReason {
  code: RiskCode;
  /** Human-readable, operator-facing explanation for this row. */
  label: string;
  severity: "high" | "medium";
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("moving_plans", "canRead", { minimumRole: "VIEWER" });

    const { searchParams } = new URL(request.url);
    const riskFilter = (searchParams.get("risk") || "").toUpperCase();
    const windowParam = Number.parseInt(searchParams.get("windowDays") || "", 10);
    const soonWindow = Number.isFinite(windowParam) && windowParam > 0 ? windowParam : SOON_WINDOW_DAYS;

    const now = new Date();
    const today = startOfDay(now);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + UPCOMING_WINDOW_DAYS);

    // Candidate set: non-canceled, non-completed plans whose move date hasn't
    // passed yet (overdue tasks on a future move are exactly what we want to
    // catch). We pull a generous window and compute signals in memory — the
    // board is operator-facing and bounded by `take`.
    const plans = await prisma.movingPlan.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["COMPLETED", ...CANCELED_MOVING_PLAN_STATUSES] },
        moveDate: { gte: today },
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        workspace: { select: { id: true, name: true } },
        fromAddress: {
          select: {
            city: true,
            state: true,
            _count: { select: { services: { where: { deletedAt: null } } } },
          },
        },
        toAddress: {
          select: {
            city: true,
            state: true,
            _count: { select: { services: { where: { deletedAt: null } } } },
          },
        },
        moveTasks: {
          where: { deletedAt: null },
          select: { id: true, status: true, dueDate: true },
        },
      },
      orderBy: { moveDate: "asc" },
      take: 300,
    });

    const rows = plans
      .map((plan) => {
        const status = normalizeMovingPlanStatus(plan.status);
        if (isCanceledMovingPlanStatus(status) || status === "COMPLETED") return null;

        const tasks = plan.moveTasks || [];
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
        const openTasks = tasks.filter(
          (t) => !TERMINAL_TASK_STATUSES.includes(t.status),
        );
        const overdueTasks = openTasks.filter(
          (t) => t.dueDate && new Date(t.dueDate) < now,
        );
        // Completion ratio ignores dismissed tasks (they're intentionally
        // out of scope) — ratio of completed over the actionable set.
        const actionable = completedTasks + openTasks.length;
        const completionRatio = actionable > 0 ? completedTasks / actionable : 0;

        const originServices = plan.fromAddress?._count?.services ?? 0;
        const destinationServices = plan.toAddress?._count?.services ?? 0;
        const totalServices = originServices + destinationServices;

        const daysUntilMove = daysBetween(today, startOfDay(new Date(plan.moveDate)));
        const isSoon = daysUntilMove <= soonWindow;
        const isUpcoming = new Date(plan.moveDate) <= horizon;

        const reasons: RiskReason[] = [];

        if (overdueTasks.length > 0) {
          reasons.push({
            code: "OVERDUE_TASKS",
            severity: "high",
            label: `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"} past due date`,
          });
        }

        if (totalServices === 0) {
          reasons.push({
            code: "NO_SERVICES_TRACKED",
            severity: "medium",
            label: "No services tracked on either address",
          });
        }

        if (isUpcoming && openTasks.length > 0) {
          reasons.push({
            code: "INCOMPLETE_CHECKLIST",
            severity: daysUntilMove <= soonWindow ? "high" : "medium",
            label: `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"} on an upcoming move`,
          });
        }

        if (isSoon && completionRatio < LOW_COMPLETENESS_RATIO) {
          reasons.push({
            code: "SOON_LOW_COMPLETENESS",
            severity: "high",
            label:
              totalTasks === 0
                ? `Move in ${Math.max(daysUntilMove, 0)}d with no checklist started`
                : `Move in ${Math.max(daysUntilMove, 0)}d, only ${Math.round(completionRatio * 100)}% of tasks done`,
          });
        }

        if (reasons.length === 0) return null;

        if (riskFilter && !reasons.some((r) => r.code === riskFilter)) return null;

        const highestSeverity = reasons.some((r) => r.severity === "high") ? "high" : "medium";

        return {
          id: plan.id,
          status,
          moveDate: plan.moveDate,
          daysUntilMove,
          isTemporary: plan.isTemporary,
          user: {
            id: plan.user.id,
            email: plan.user.email,
            firstName: plan.user.firstName,
            lastName: plan.user.lastName,
          },
          workspace: plan.workspace ? { id: plan.workspace.id, name: plan.workspace.name } : null,
          fromCity: plan.fromAddress?.city ?? null,
          fromState: plan.fromAddress?.state ?? null,
          toCity: plan.toAddress?.city ?? null,
          toState: plan.toAddress?.state ?? null,
          totalTasks,
          completedTasks,
          openTasks: openTasks.length,
          overdueTasks: overdueTasks.length,
          originServices,
          destinationServices,
          completionPercent: Math.round(completionRatio * 100),
          severity: highestSeverity,
          reasons,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    // Sort: highest severity first, then soonest move, then most overdue.
    rows.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
      if (a.daysUntilMove !== b.daysUntilMove) return a.daysUntilMove - b.daysUntilMove;
      return b.overdueTasks - a.overdueTasks;
    });

    const summary = {
      total: rows.length,
      high: rows.filter((r) => r.severity === "high").length,
      overdueTasks: rows.filter((r) => r.reasons.some((x) => x.code === "OVERDUE_TASKS")).length,
      incompleteChecklist: rows.filter((r) =>
        r.reasons.some((x) => x.code === "INCOMPLETE_CHECKLIST"),
      ).length,
      noServices: rows.filter((r) => r.reasons.some((x) => x.code === "NO_SERVICES_TRACKED")).length,
      soonLowCompleteness: rows.filter((r) =>
        r.reasons.some((x) => x.code === "SOON_LOW_COMPLETENESS"),
      ).length,
    };

    return NextResponse.json(
      { rows, summary, soonWindowDays: soonWindow },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to compute at-risk moving plans:", error);
    return NextResponse.json({ error: "Failed to compute at-risk moving plans" }, { status: 500 });
  }
}
