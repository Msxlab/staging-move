import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { budgetSchema } from "@/lib/validators";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

// GET /api/budget
export async function GET(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const { searchParams } = new URL(request.url);
    const addressId = searchParams.get("addressId");
    const month = searchParams.get("month");

    const where: any = { userId };
    if (addressId) where.addressId = addressId;
    if (month) where.month = new Date(month);

    const budgets = await prisma.budget.findMany({
      where,
      orderBy: { month: "desc" },
    });

    const totalExpenses = budgets.reduce((sum: number, b: any) => sum + (b.actualExpenses || 0), 0);
    const totalIncome = budgets.reduce((sum: number, b: any) => sum + (b.actualIncome || 0), 0);

    return NextResponse.json({
      budgets,
      summary: {
        totalIncome,
        totalExpenses,
        savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch budgets:", error);
    return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 });
  }
}

// POST /api/budget
export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    // Rate limit: 20 writes per minute
    const rlKey = getRateLimitKey(request, "budget:create");
    const rl = await rateLimit(rlKey, { limit: 20, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const body = await request.json();
    const validated = budgetSchema.parse(body);

    if (validated.addressId) {
      const address = await prisma.address.findUnique({ where: { id: validated.addressId } });
      if (!address) {
        return NextResponse.json({ error: "Address not found" }, { status: 404 });
      }
      if (address.userId !== userId) {
        return NextResponse.json({ error: "No permission to manage budget for this address" }, { status: 403 });
      }
    }

    const budget = await prisma.budget.create({
      data: {
        userId,
        addressId: validated.addressId,
        month: new Date(validated.month),
        year: validated.year,
        plannedIncome: validated.plannedIncome,
        actualIncome: validated.actualIncome,
        plannedExpenses: validated.plannedExpenses,
        actualExpenses: validated.actualExpenses,
        categoryBreakdown: body.categoryBreakdown,
        notes: validated.notes,
      },
    });

    return NextResponse.json({ budget }, { status: 201 });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Failed to create budget:", error);
    return NextResponse.json({ error: "Failed to create budget" }, { status: 500 });
  }
}
