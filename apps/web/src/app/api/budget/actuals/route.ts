import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { ApiGateError, apiGateErrorResponse, requireAppMutationUser } from "@/lib/api-gates";
import { getPlanForLimitScope } from "@/lib/plan-limits";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";
import { refreshBudgetSnapshotsForServiceMonth } from "@/lib/budget-actuals-snapshot";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";
import {
  assertScopedRecordAction,
  assertWorkspaceAction,
  planLimitScopeForDataScope,
  resolveWorkspaceDataScope,
} from "@/lib/workspace-data-scope";

// Per-MONTH actuals read/write path. The budget month-stepper logs and reads the
// REAL ServiceCostLog row for the VIEWED month — not the single overwriting
// Service.actualMonthlyCost scalar — so stepping to a past month shows that
// month's actual instead of the current number.

function monthStartUtc(month: string): Date | null {
  const parsed = new Date(month);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
}

function currentMonthStartUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

const logActualSchema = z.object({
  serviceId: z.string().min(1).max(30),
  // First-of-month is derived server-side; any timestamp in the month is fine.
  month: z.string().min(1),
  // null clears the actual for that month (back to estimate-only).
  amount: z.number().min(0).nullable(),
});

// GET /api/budget/actuals?month=YYYY-MM-01&addressId=...
// Returns the active, costed services in scope WITH the logged actual for the
// viewed month (null when unlogged). The budget UI uses this so each month shows
// its own real actuals.
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const scope = await resolveWorkspaceDataScope(request, userId);
    assertWorkspaceAction(scope, "budget.view", { resourceUserId: userId });

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    const addressId = searchParams.get("addressId");
    const month = monthParam ? monthStartUtc(monthParam) : currentMonthStartUtc();
    if (!month) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }

    const services = await prisma.service.findMany({
      where: activeTrackedServiceWhereForScope(
        { userId, workspaceId: scope.workspaceId },
        addressId ? { addressId } : {},
      ),
      select: {
        id: true,
        providerName: true,
        category: true,
        addressId: true,
        monthlyCost: true,
        billingCycle: true,
        isActive: true,
        activatedAt: true,
        createdAt: true,
        costLogs: {
          where: { month },
          select: { amount: true },
        },
      },
    });

    return NextResponse.json({
      month: month.toISOString(),
      services: services.map((service: any) => ({
        id: service.id,
        providerName: service.providerName,
        category: service.category,
        addressId: service.addressId,
        monthlyCost: service.monthlyCost,
        billingCycle: service.billingCycle,
        isActive: service.isActive,
        activatedAt: service.activatedAt,
        createdAt: service.createdAt,
        // The actual logged for THIS month (null = estimate only this month).
        loggedActual: service.costLogs[0] ? Number(service.costLogs[0].amount) : null,
      })),
    });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to fetch budget actuals:", error);
    return NextResponse.json({ error: "Failed to fetch budget actuals" }, { status: 500 });
  }
}

// POST /api/budget/actuals — upsert (or clear) the logged actual for a single
// service in the viewed month. IDOR-safe: the service must belong to the caller's
// scope. Logging actuals is a budget-manage action and requires premium (parity
// with POST /api/budget).
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAppMutationUser();
    const scope = await resolveWorkspaceDataScope(request, userId);
    assertWorkspaceAction(scope, "budget.manage", { resourceUserId: userId });
    const planScope = planLimitScopeForDataScope(scope);
    const plan = await getPlanForLimitScope(userId, planScope);
    if (!plan.isActive || !plan.hasPremium) {
      throw new ApiGateError("SUBSCRIPTION_REQUIRED", "A paid subscription is required to manage budgets.", {
        upgradeRequired: true,
      });
    }

    const rlKey = getRateLimitKey(request, "budget:actual", { userId });
    const rl = await rateLimit(rlKey, { limit: 60, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const body = await request.json();
    const { serviceId, month: monthInput, amount } = logActualSchema.parse(body);
    const month = monthStartUtc(monthInput);
    if (!month) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }

    // IDOR guard: the service must exist, not be deleted, and belong to the
    // caller's scope (own record, or the shared workspace). Reuses the same
    // record-scoping check the service edit endpoint uses.
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, userId: true, workspaceId: true, addressId: true, deletedAt: true },
    });
    if (!service || service.deletedAt) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }
    assertScopedRecordAction(service, scope, "service.edit", {
      notFoundMessage: "Service not found",
      forbiddenMessage: "No permission to log actuals for this service",
    });

    const isCurrentMonth = month.getTime() === currentMonthStartUtc().getTime();

    // 4.5: the cost-log write and the legacy current-month scalar mirror are
    // wrapped in one interactive transaction so the per-month log row and
    // Service.actualMonthlyCost can never diverge if the second write fails.
    let loggedActual: number | null;
    if (amount === null) {
      // Clear the actual for this month → estimate-only again.
      await prisma.$transaction(async (tx) => {
        await tx.serviceCostLog.deleteMany({ where: { serviceId, month } });
        // Keep the legacy scalar mirror in sync only for the current month.
        if (isCurrentMonth) {
          await tx.service.update({ where: { id: serviceId }, data: { actualMonthlyCost: null } });
        }
      });
      loggedActual = null;
    } else {
      const log = await prisma.$transaction(async (tx) => {
        const upserted = await tx.serviceCostLog.upsert({
          where: { serviceId_month: { serviceId, month } },
          update: { amount },
          create: { serviceId, month, amount },
        });
        // Mirror into the legacy single scalar ONLY when logging the current
        // month, so existing readers of Service.actualMonthlyCost stay
        // consistent without letting a past-month edit overwrite the "current"
        // number.
        if (isCurrentMonth) {
          await tx.service.update({ where: { id: serviceId }, data: { actualMonthlyCost: amount } });
        }
        return upserted;
      });
      loggedActual = Number(log.amount);
    }

    // Keep any EXISTING Budget snapshot for this month+scope truthful so Budget
    // History reflects the new actual without the user re-saving the budget.
    await refreshBudgetSnapshotsForServiceMonth({
      userId,
      workspaceId: scope.workspaceId,
      serviceAddressId: service.addressId ?? null,
      month,
    });

    // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
    await auditImpersonatedMutation(request, { action: "UPDATE", entityType: "ServiceCostLog", entityId: serviceId, route: "/api/budget/actuals" });

    return NextResponse.json({ ok: true, serviceId, month: month.toISOString(), loggedActual });
  } catch (error: any) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to log budget actual:", error);
    return NextResponse.json({ error: "Failed to log budget actual" }, { status: 500 });
  }
}
