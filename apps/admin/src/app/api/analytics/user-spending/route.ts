import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Aggregates Service.monthlyCost across users into:
 *   - per-(state, category) cells
 *   - per-state totals
 *   - per-category totals
 *   - grand total
 *
 * Privacy floor: cells with fewer than `MIN_USERS_PER_CELL` distinct users
 * are dropped. Without that, a state × category with one user would expose
 * that user's exact monthly cost. The threshold is configurable; 5 is a
 * common minimum-cell-size for k-anonymity in product analytics.
 */
const MIN_USERS_PER_CELL = 5;

interface CellRow {
  state: string;
  category: string;
  totalSpend: number;
  userCount: number;
  serviceCount: number;
}

interface CategoryRow {
  category: string;
  totalSpend: number;
  userCount: number;
}

interface StateRow {
  state: string;
  totalSpend: number;
  userCount: number;
}

export async function GET() {
  try {
    await requirePermission("analytics", "canRead", { minimumRole: "VIEWER" });

    const services = await prisma.service.findMany({
      where: {
        monthlyCost: { not: null, gt: 0 },
        user: { deletedAt: null },
        address: { deletedAt: null },
      },
      select: {
        userId: true,
        monthlyCost: true,
        category: true,
        address: { select: { state: true } },
      },
    });

    const cells = new Map<string, { totalSpend: number; users: Set<string>; services: number }>();
    const stateAgg = new Map<string, { totalSpend: number; users: Set<string> }>();
    const categoryAgg = new Map<string, { totalSpend: number; users: Set<string> }>();
    const allUsers = new Set<string>();
    let grandTotal = 0;

    for (const svc of services) {
      const cost = svc.monthlyCost ?? 0;
      const state = svc.address?.state || "??";
      const category = svc.category || "UNKNOWN";
      const cellKey = `${state}|${category}`;

      const cell = cells.get(cellKey) ?? { totalSpend: 0, users: new Set(), services: 0 };
      cell.totalSpend += cost;
      cell.users.add(svc.userId);
      cell.services += 1;
      cells.set(cellKey, cell);

      const stateBucket = stateAgg.get(state) ?? { totalSpend: 0, users: new Set() };
      stateBucket.totalSpend += cost;
      stateBucket.users.add(svc.userId);
      stateAgg.set(state, stateBucket);

      const categoryBucket = categoryAgg.get(category) ?? { totalSpend: 0, users: new Set() };
      categoryBucket.totalSpend += cost;
      categoryBucket.users.add(svc.userId);
      categoryAgg.set(category, categoryBucket);

      allUsers.add(svc.userId);
      grandTotal += cost;
    }

    const byStateCategory: CellRow[] = Array.from(cells.entries())
      .map(([key, value]) => {
        const [state, category] = key.split("|");
        return {
          state,
          category,
          totalSpend: round2(value.totalSpend),
          userCount: value.users.size,
          serviceCount: value.services,
        };
      })
      .filter((row) => row.userCount >= MIN_USERS_PER_CELL)
      .sort((a, b) => b.totalSpend - a.totalSpend);

    const byState: StateRow[] = Array.from(stateAgg.entries())
      .map(([state, value]) => ({
        state,
        totalSpend: round2(value.totalSpend),
        userCount: value.users.size,
      }))
      .filter((row) => row.userCount >= MIN_USERS_PER_CELL)
      .sort((a, b) => b.totalSpend - a.totalSpend);

    const byCategory: CategoryRow[] = Array.from(categoryAgg.entries())
      .map(([category, value]) => ({
        category,
        totalSpend: round2(value.totalSpend),
        userCount: value.users.size,
      }))
      .filter((row) => row.userCount >= MIN_USERS_PER_CELL)
      .sort((a, b) => b.totalSpend - a.totalSpend);

    return NextResponse.json({
      byStateCategory,
      byState,
      byCategory,
      total: {
        totalSpend: round2(grandTotal),
        userCount: allUsers.size,
        serviceCount: services.length,
      },
      privacyFloor: MIN_USERS_PER_CELL,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[ADMIN] user-spending aggregate failed:", error);
    return NextResponse.json(
      { error: "Failed to compute user spending" },
      { status: 500 },
    );
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
