import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { normalizeMovingPlanStatus } from "@locateflow/shared";

export const dynamic = "force-dynamic";

/**
 * Read-only admin detail for a single moving plan.
 *
 * Returns everything the detail page renders: from/to addresses, move date,
 * status, the full move-task checklist (with progress), tracked services on
 * both addresses, the owning user + workspace, and a derived timeline of the
 * plan's lifecycle events. This endpoint never mutates anything.
 *
 * Gated by moving_plans:canRead (VIEWER floor), same as the list endpoint.
 */

const TERMINAL_TASK_STATUSES = ["COMPLETED", "DISMISSED"];

function fullName(u: { firstName: string | null; lastName: string | null } | null | undefined): string | null {
  if (!u) return null;
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("moving_plans", "canRead", { minimumRole: "VIEWER" });
    const { id } = await params;

    const plan = await prisma.movingPlan.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, deletedAt: true } },
        workspace: { select: { id: true, name: true } },
        fromAddress: {
          include: {
            services: {
              where: { deletedAt: null },
              select: {
                id: true,
                category: true,
                providerName: true,
                isActive: true,
                monthlyCost: true,
              },
              orderBy: [{ isActive: "desc" }, { category: "asc" }],
            },
          },
        },
        toAddress: {
          include: {
            services: {
              where: { deletedAt: null },
              select: {
                id: true,
                category: true,
                providerName: true,
                isActive: true,
                monthlyCost: true,
              },
              orderBy: [{ isActive: "desc" }, { category: "asc" }],
            },
          },
        },
        moveTasks: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            actionType: true,
            status: true,
            source: true,
            confidence: true,
            dueDate: true,
            acceptedAt: true,
            completedAt: true,
            dismissedAt: true,
            reopenedAt: true,
            createdAt: true,
            updatedAt: true,
            provider: { select: { id: true, name: true, scope: true } },
            customProvider: { select: { id: true, name: true, providerType: true } },
            destinationProvider: { select: { id: true, name: true, scope: true } },
          },
          orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!plan || plan.deletedAt) {
      return NextResponse.json({ error: "Moving plan not found" }, { status: 404 });
    }

    const status = normalizeMovingPlanStatus(plan.status);
    const tasks = plan.moveTasks || [];
    const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
    const dismissedTasks = tasks.filter((t) => t.status === "DISMISSED").length;
    const openTasks = tasks.filter((t) => !TERMINAL_TASK_STATUSES.includes(t.status)).length;
    const now = new Date();
    const overdueTasks = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && !TERMINAL_TASK_STATUSES.includes(t.status),
    ).length;
    const actionable = completedTasks + openTasks;
    const completionPercent = actionable > 0 ? Math.round((completedTasks / actionable) * 100) : 0;

    const fromServices = plan.fromAddress?.services ?? [];
    const toServices = plan.toAddress?.services ?? [];

    // Derived lifecycle timeline. We assemble it from the dated fields on the
    // plan and its tasks so the page can render a single chronological view
    // without storing a separate event log.
    type TimelineEvent = { at: string; kind: string; label: string };
    const timeline: TimelineEvent[] = [];
    timeline.push({ at: plan.createdAt.toISOString(), kind: "PLAN_CREATED", label: "Plan created" });
    for (const t of tasks) {
      if (t.acceptedAt) timeline.push({ at: t.acceptedAt.toISOString(), kind: "TASK_ACCEPTED", label: `Task accepted: ${t.title}` });
      if (t.completedAt) timeline.push({ at: t.completedAt.toISOString(), kind: "TASK_COMPLETED", label: `Task completed: ${t.title}` });
      if (t.dismissedAt) timeline.push({ at: t.dismissedAt.toISOString(), kind: "TASK_DISMISSED", label: `Task dismissed: ${t.title}` });
      if (t.reopenedAt) timeline.push({ at: t.reopenedAt.toISOString(), kind: "TASK_REOPENED", label: `Task reopened: ${t.title}` });
    }
    timeline.push({ at: plan.moveDate.toISOString(), kind: "MOVE_DATE", label: "Scheduled move date" });
    timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return NextResponse.json(
      {
        plan: {
          id: plan.id,
          status,
          moveDate: plan.moveDate,
          isTemporary: plan.isTemporary,
          estimatedDuration: plan.estimatedDuration,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
          isInterstate: plan.fromAddress?.state !== plan.toAddress?.state,
          user: {
            id: plan.user.id,
            email: plan.user.email,
            name: fullName(plan.user),
            deleted: Boolean(plan.user.deletedAt),
          },
          workspace: plan.workspace ? { id: plan.workspace.id, name: plan.workspace.name } : null,
          fromAddress: plan.fromAddress
            ? {
                id: plan.fromAddress.id,
                nickname: plan.fromAddress.nickname,
                street: plan.fromAddress.street,
                street2: plan.fromAddress.street2,
                city: plan.fromAddress.city,
                state: plan.fromAddress.state,
                zip: plan.fromAddress.zip,
                services: fromServices,
              }
            : null,
          toAddress: plan.toAddress
            ? {
                id: plan.toAddress.id,
                nickname: plan.toAddress.nickname,
                street: plan.toAddress.street,
                street2: plan.toAddress.street2,
                city: plan.toAddress.city,
                state: plan.toAddress.state,
                zip: plan.toAddress.zip,
                services: toServices,
              }
            : null,
          progress: {
            totalTasks: tasks.length,
            completedTasks,
            dismissedTasks,
            openTasks,
            overdueTasks,
            completionPercent,
          },
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            actionType: t.actionType,
            status: t.status,
            source: t.source,
            confidence: t.confidence,
            dueDate: t.dueDate,
            isOverdue: Boolean(t.dueDate && new Date(t.dueDate) < now && !TERMINAL_TASK_STATUSES.includes(t.status)),
            provider:
              t.provider?.name || t.customProvider?.name || t.destinationProvider?.name || null,
          })),
          timeline,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to fetch moving plan detail:", error);
    return NextResponse.json({ error: "Failed to fetch moving plan detail" }, { status: 500 });
  }
}
