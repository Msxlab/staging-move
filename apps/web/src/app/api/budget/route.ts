import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { ApiGateError, apiGateErrorResponse, requireAppMutationUser } from "@/lib/api-gates";
import { budgetSchema } from "@/lib/validators";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { calculateBudgetPlan } from "@/lib/budget-planning";

const GLOBAL_BUDGET_SCOPE_KEY = "__global__";

function monthDateFromInput(month: string): Date | null {
  const parsed = new Date(month);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
}

function currentUtcMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function budgetScopeKey(addressId: string | null | undefined): string {
  return addressId || GLOBAL_BUDGET_SCOPE_KEY;
}

async function calculateProjectedExpenses(userId: string, month: Date, addressId?: string | null): Promise<number> {
  const services = await prisma.service.findMany({
    where: {
      userId,
      deletedAt: null,
      isActive: true,
      ...(addressId ? { addressId } : {}),
    },
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
    },
  });

  return calculateBudgetPlan(services, { month, addressId }).projectedThisMonth;
}

// GET /api/budget
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const addressId = searchParams.get("addressId");
    const month = searchParams.get("month");

    const where: any = { userId, deletedAt: null };
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
    const services = await prisma.service.findMany({
      where: {
        userId,
        deletedAt: null,
        isActive: true,
        ...(summaryAddressId ? { addressId: summaryAddressId } : {}),
      },
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
      },
    });
    const serviceBudget = calculateBudgetPlan(services, { month: summaryMonth, addressId: summaryAddressId });
    const monthlyBudgetLimit = budgets[0]?.plannedExpenses || 0;

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
    const userId = await requireAppMutationUser({
      requireActiveSubscription: true,
      subscriptionMessage: "An active subscription is required to manage budgets.",
    });

    // Rate limit: 20 writes per minute
    const rlKey = getRateLimitKey(request, "budget:create");
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
    const scopeKey = budgetScopeKey(addressId);

    if (addressId) {
      const address = await prisma.address.findUnique({ where: { id: addressId } });
      if (!address) {
        return NextResponse.json({ error: "Address not found" }, { status: 404 });
      }
      if (address.userId !== userId) {
        throw new ApiGateError("FORBIDDEN", "No permission to manage budget for this address");
      }
    }

    const categoryBreakdown =
      typeof validated.categoryBreakdown === "string"
        ? validated.categoryBreakdown
        : validated.categoryBreakdown
          ? JSON.stringify(validated.categoryBreakdown)
          : undefined;
    const projectedExpenses = validated.actualExpenses ?? (await calculateProjectedExpenses(userId, budgetMonth, addressId));

    const budgetData = {
      addressId,
      scopeKey,
      month: budgetMonth,
      year: validated.year,
      plannedIncome: validated.plannedIncome ?? null,
      actualIncome: validated.actualIncome ?? null,
      plannedExpenses: validated.plannedExpenses ?? null,
      actualExpenses: projectedExpenses,
      categoryBreakdown: categoryBreakdown ?? null,
      notes: validated.notes ?? null,
      deletedAt: null,
    };

    const budget = await (prisma.budget as any).upsert({
      where: {
        userId_scopeKey_month: {
          userId,
          scopeKey,
          month: budgetMonth,
        },
      },
      update: budgetData,
      create: {
        userId,
        ...budgetData,
      },
    }).catch(async (error: any) => {
      if (error?.code !== "P2025") throw error;
      return prisma.budget.create({
        data: {
          userId,
          ...budgetData,
        },
      });
    });

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
