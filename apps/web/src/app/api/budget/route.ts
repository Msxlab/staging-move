import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { ApiGateError, apiGateErrorResponse, requireAppMutationUser } from "@/lib/api-gates";
import { getPlanForLimitScope } from "@/lib/plan-limits";
import { budgetSchema } from "@/lib/validators";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import {
  calculateBudgetActuals,
  calculateBudgetPlan,
} from "@/lib/budget-planning";
import {
  budgetScopeKey,
  budgetServiceSelectForMonth,
  resolveBudgetActualsForMonth,
  toBudgetServiceInput,
} from "@/lib/budget-actuals-snapshot";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";
import {
  assertWorkspaceAction,
  planLimitScopeForDataScope,
  resolveWorkspaceDataScope,
} from "@/lib/workspace-data-scope";

function monthDateFromInput(month: string): Date | null {
  const parsed = new Date(month);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
}

function currentUtcMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// GET /api/budget
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const scope = await resolveWorkspaceDataScope(request, userId);
    assertWorkspaceAction(scope, "budget.view", { resourceUserId: userId });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const addressId = searchParams.get("addressId");
    const month = searchParams.get("month");

    // Workspace members keep their own legacy budgets (created before the
    // workspace, workspaceId=null) visible alongside the shared workspace budget.
    // invite-accept intentionally does NOT stamp budgets into the workspace, so a
    // strict workspaceId filter would hide a member's existing budgets entirely.
    const where: any = scope.workspaceId
      ? { OR: [{ workspaceId: scope.workspaceId }, { userId, workspaceId: null }], deletedAt: null }
      : { userId, deletedAt: null };
    if (id) where.id = id;
    if (addressId) where.addressId = addressId;
    if (month) {
      const budgetMonth = monthDateFromInput(month);
      if (!budgetMonth) {
        return NextResponse.json({ error: "Invalid month" }, { status: 400 });
      }
      where.month = budgetMonth;
    }

    const budgets = await prisma.budget.findMany({
      where,
      orderBy: { month: "desc" },
    });

    const selectedBudget = id ? budgets[0] : null;
    const summaryMonth = month
      ? monthDateFromInput(month)!
      : (selectedBudget?.month || currentUtcMonth());
    const summaryAddressId = addressId || selectedBudget?.addressId || null;
    const serviceRows = await prisma.service.findMany({
      where: activeTrackedServiceWhereForScope(
        { userId, workspaceId: scope.workspaceId },
        summaryAddressId ? { addressId: summaryAddressId } : {},
      ),
      // Pull each service's cost log for the SUMMARY month so actuals reflect the
      // viewed month (not the single legacy scalar) — the month-stepper is real.
      select: budgetServiceSelectForMonth(summaryMonth),
    });
    const services = serviceRows.map(toBudgetServiceInput);
    const serviceBudget = calculateBudgetPlan(services, { month: summaryMonth, addressId: summaryAddressId });
    const actuals = calculateBudgetActuals(services, { month: summaryMonth, addressId: summaryAddressId });
    // Match the limit to the same scope+month the projection is computed for.
    // budgets[0] is merely the most-recently-saved row, which can belong to a
    // different month/scope than the summary when no month filter is supplied.
    const summaryScopeKey = budgetScopeKey(summaryAddressId, scope.workspaceId);
    const summaryBudget = budgets.find(
      (b: any) =>
        b.scopeKey === summaryScopeKey && new Date(b.month).getTime() === summaryMonth.getTime(),
    );
    const monthlyBudgetLimit = (summaryBudget ?? budgets[0])?.plannedExpenses || 0;

    return NextResponse.json({
      budgets,
      budget: selectedBudget,
      summary: {
        monthlyCommitted: serviceBudget.monthlyCommitted,
        monthlyBudgetLimit,
        projectedThisMonth: serviceBudget.projectedThisMonth,
        overUnderBudget: monthlyBudgetLimit > 0 ? monthlyBudgetLimit - serviceBudget.projectedThisMonth : null,
        oneTimeThisMonth: serviceBudget.oneTimeThisMonth,
        missingCostCount: serviceBudget.missingCostServices.length,
        // Money layer: estimate-vs-actual reconciliation for the same scope+month.
        actualThisMonth: actuals.actualThisMonth,
        projectedForLoggedServices: actuals.projectedForLoggedServices,
        monthlySavings: actuals.monthlySavings,
        annualSavings: actuals.annualSavings,
        savingsRate: actuals.savingsRate,
        loggedServiceCount: actuals.loggedServiceCount,
        pendingServiceCount: actuals.pendingServiceCount,
        variance: actuals.perCategory,
      },
    });
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to fetch budgets:", error);
    return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 });
  }
}

// POST /api/budget
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAppMutationUser();
    const scope = await resolveWorkspaceDataScope(request, userId);
    // Writing the shared budget requires the manage permission — a VIEW_ONLY
    // member can read (budget.view) but must not overwrite the household budget.
    assertWorkspaceAction(scope, "budget.manage", { resourceUserId: userId });
    const planScope = planLimitScopeForDataScope(scope);
    const plan = await getPlanForLimitScope(userId, planScope);
    if (!plan.isActive || !plan.hasPremium) {
      throw new ApiGateError("SUBSCRIPTION_REQUIRED", "A paid subscription is required to manage budgets.", {
        upgradeRequired: true,
      });
    }

    // Rate limit: 20 writes per minute
    const rlKey = getRateLimitKey(request, "budget:create", { userId });
    const rl = await rateLimit(rlKey, { limit: 20, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const body = await request.json();
    const validated = budgetSchema.parse(body);
    const budgetMonth = monthDateFromInput(validated.month);
    if (!budgetMonth) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }
    const addressId = validated.addressId || null;
    const scopeKey = budgetScopeKey(addressId, scope.workspaceId);

    if (addressId) {
      const address = await prisma.address.findUnique({ where: { id: addressId } });
      // Treat a soft-deleted address as gone so a budget can't be re-attached
      // to an address the user already removed.
      if (!address || address.deletedAt) {
        return NextResponse.json({ error: "Address not found" }, { status: 404 });
      }
      if (scope.workspaceId ? address.workspaceId !== scope.workspaceId : address.userId !== userId) {
        throw new ApiGateError("FORBIDDEN", "No permission to manage budget for this address");
      }
    }

    const categoryBreakdown =
      typeof validated.categoryBreakdown === "string"
        ? validated.categoryBreakdown
        : validated.categoryBreakdown
          ? JSON.stringify(validated.categoryBreakdown)
          : undefined;
    // Money layer: persist the REAL realized cost + a substantiated savings rate
    // from the per-line actuals — NOT the projection (which used to overwrite
    // actualExpenses and made the figure meaningless). An explicit client-supplied
    // actualExpenses still wins (manual override / tests). savingsRate is only
    // written when there is a logged-actual baseline to substantiate it.
    const { actualExpenses: realActualExpenses, savingsRate: realSavingsRate } =
      await resolveBudgetActualsForMonth(userId, budgetMonth, addressId, scope.workspaceId);
    const actualExpenses = validated.actualExpenses ?? realActualExpenses;
    const budgetOwnerUserId = scope.workspaceId ? scope.ownerUserId : userId;

    const budgetData = {
      addressId,
      ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
      scopeKey,
      month: budgetMonth,
      // Derive the year from the normalized month so the two can't desync; the
      // client-supplied year is otherwise free to disagree with the month.
      year: budgetMonth.getUTCFullYear(),
      plannedIncome: validated.plannedIncome ?? null,
      actualIncome: validated.actualIncome ?? null,
      plannedExpenses: validated.plannedExpenses ?? null,
      actualExpenses,
      savingsRate: realSavingsRate,
      categoryBreakdown: categoryBreakdown ?? null,
      notes: validated.notes ?? null,
      deletedAt: null,
    };

    const budget = await (prisma.budget as any).upsert({
      where: {
        userId_scopeKey_month: {
          userId: budgetOwnerUserId,
          scopeKey,
          month: budgetMonth,
        },
      },
      update: budgetData,
      create: {
        userId: budgetOwnerUserId,
        ...budgetData,
      },
    }).catch(async (error: any) => {
      if (error?.code !== "P2025") throw error;
      return prisma.budget.create({
        data: {
          userId: budgetOwnerUserId,
          ...budgetData,
        },
      });
    });

    // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
    await auditImpersonatedMutation(request, { action: "UPSERT", entityType: "Budget", entityId: budget.id, route: "/api/budget" });

    return NextResponse.json({ budget }, { status: 201 });
  } catch (error: any) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to create budget:", error);
    return NextResponse.json({ error: "Failed to create budget" }, { status: 500 });
  }
}
