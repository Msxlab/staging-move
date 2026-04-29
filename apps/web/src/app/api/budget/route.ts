import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { ApiGateError, apiGateErrorResponse, requireAppMutationUser } from "@/lib/api-gates";
import { budgetSchema } from "@/lib/validators";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { calculateBudgetPlan } from "@/lib/budget-planning";

function monthDateFromInput(month: string): Date {
  const parsed = new Date(month);
  if (!Number.isFinite(parsed.getTime())) return new Date();
  return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1);
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
    const addressId = searchParams.get("addressId");
    const month = searchParams.get("month");

    const where: any = { userId, deletedAt: null };
    if (addressId) where.addressId = addressId;
    if (month) where.month = new Date(month);

    const budgets = await prisma.budget.findMany({
      where,
      orderBy: { month: "desc" },
    });

    const summaryMonth = month ? monthDateFromInput(month) : new Date();
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
    const serviceBudget = calculateBudgetPlan(services, { month: summaryMonth, addressId });
    const monthlyBudgetLimit = budgets[0]?.plannedExpenses || 0;

    return NextResponse.json({
      budgets,
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
    const addressId = validated.addressId || null;

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

    const existingBudget = await prisma.budget.findFirst({
      where: {
        userId,
        addressId,
        month: budgetMonth,
      },
    });

    const budgetData = {
      addressId,
      month: budgetMonth,
      year: validated.year,
      plannedIncome: validated.plannedIncome ?? null,
      actualIncome: validated.actualIncome ?? null,
      plannedExpenses: validated.plannedExpenses ?? null,
      actualExpenses: projectedExpenses,
      categoryBreakdown: categoryBreakdown ?? null,
      notes: validated.notes ?? null,
    };

    const budget = existingBudget
      ? await prisma.budget.update({
        where: { id: existingBudget.id },
        data: budgetData,
      })
      : await prisma.budget.create({
        data: {
          userId,
          ...budgetData,
        },
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
