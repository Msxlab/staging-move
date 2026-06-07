import { ArrowLeft, BarChart3, Calendar, DollarSign, Target, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { calculateBudgetPlan, parseBudgetCategoryLimits } from "@/lib/budget-planning";
import { activeTrackedServiceWhere } from "@/lib/service-active";
import { formatCurrency } from "@/lib/utils";

function monthKeyFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function BudgetMonthPage({ params }: { params: Promise<{ month: string }> }) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return notFound();
  }

  const { month } = await params;
  const start = new Date(`${month}-01`);
  if (!Number.isFinite(start.getTime())) return notFound();
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const budget = await prisma.budget.findFirst({
    where: { userId, month: { gte: start, lt: end } },
    include: { address: { select: { nickname: true, city: true, state: true } } },
  });

  if (!budget) return notFound();

  const services = await prisma.service.findMany({
    // Match the active-tracked filter every other budget surface uses so this
    // drill-in snapshot can't include canceled / migrated services (which would
    // overstate the projected total vs. the budget list + summary endpoints).
    where: activeTrackedServiceWhere(
      userId,
      budget.addressId ? { addressId: budget.addressId } : {},
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
    },
  });

  const summary = calculateBudgetPlan(services, { month: start, addressId: budget.addressId });
  const budgetLimit = budget.plannedExpenses || 0;
  const delta = budgetLimit > 0 ? budgetLimit - summary.projectedThisMonth : null;
  const categoryLimits = parseBudgetCategoryLimits(budget.categoryBreakdown);
  const monthName = start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const scope = budget.address ? budget.address.nickname || `${budget.address.city}, ${budget.address.state}` : "All addresses";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/budget">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{monthName}</h1>
            <p className="text-sm text-muted-foreground">{scope}</p>
          </div>
        </div>
        {delta !== null && (
          <Badge variant={delta < 0 ? "destructive" : "success"}>
            {delta < 0 ? "Over Budget" : "Under Budget"}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4 text-tone-orange-fg" /> Monthly Committed
            </div>
            <p className="text-2xl font-bold">{formatCurrency(summary.monthlyCommitted)}</p>
            <p className="text-xs text-muted-foreground">{summary.costedRecurringServices.length} recurring services</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Target className="h-4 w-4 text-tone-cyan-fg" /> Budget Limit
            </div>
            <p className="text-2xl font-bold">{budgetLimit > 0 ? formatCurrency(budgetLimit) : "Not set"}</p>
            <p className="text-xs text-muted-foreground">Monthly planning limit</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="h-4 w-4 text-tone-emerald-fg" /> Projected This Month
            </div>
            <p className="text-2xl font-bold">{formatCurrency(summary.projectedThisMonth)}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(summary.oneTimeThisMonth)} one-time</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <WalletCards className="h-4 w-4 text-tone-honey-fg" /> Over / Under
            </div>
            <p className={`text-2xl font-bold ${delta !== null && delta < 0 ? "text-destructive" : "text-success"}`}>
              {delta === null ? "Not set" : formatCurrency(Math.abs(delta))}
            </p>
            <p className="text-xs text-muted-foreground">{delta !== null && delta < 0 ? "Over budget" : "Under budget"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Spending by Category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary.byBudgetCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No service cost data for this budget scope.</p>
          ) : (
            summary.byBudgetCategory.map((row) => {
              const limit = categoryLimits[row.category] || 0;
              const pct = summary.projectedThisMonth > 0 ? (row.amount / summary.projectedThisMonth) * 100 : 0;
              return (
                <div key={row.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{row.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                      <span className="text-sm font-medium w-28 text-right">
                        {formatCurrency(row.amount)}
                        {limit > 0 ? ` / ${formatCurrency(limit)}` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {budget.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
            <p className="text-sm text-foreground">{budget.notes}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">Budget month: {monthKeyFromDate(start)}</p>
    </div>
  );
}
