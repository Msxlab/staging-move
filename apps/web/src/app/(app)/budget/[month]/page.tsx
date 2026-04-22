import { ArrowLeft, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";

export default async function BudgetMonthPage({ params }: { params: Promise<{ month: string }> }) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return notFound();
  }

  const { month } = await params;
  const start = new Date(month + "-01");
  if (isNaN(start.getTime())) return notFound();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const budget = await prisma.budget.findFirst({
    where: { userId, month: { gte: start, lt: end } },
  });

  if (!budget) return notFound();

  const monthName = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const overBudget = (budget.actualExpenses || 0) > (budget.plannedExpenses || 0);
  const savings = (budget.actualIncome || 0) - (budget.actualExpenses || 0);
  const savingsRate = budget.actualIncome ? ((savings / budget.actualIncome) * 100).toFixed(1) : "0";

  let categoryBreakdown: Record<string, number> = {};
  if (budget.categoryBreakdown) {
    try {
      const raw = typeof budget.categoryBreakdown === "string"
        ? JSON.parse(budget.categoryBreakdown)
        : budget.categoryBreakdown;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        categoryBreakdown = raw as Record<string, number>;
      }
    } catch {}
  }

  const sortedCategories = Object.entries(categoryBreakdown).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/budget">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          </Link>
          <h1 className="text-2xl font-bold">{monthName}</h1>
        </div>
        <Badge variant={overBudget ? "destructive" : "success"}>
          {overBudget ? "Over Budget" : "On Track"}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-success" /> Income
            </div>
            <p className="text-2xl font-bold">{formatCurrency(budget.actualIncome || 0)}</p>
            {budget.plannedIncome && (
              <p className="text-xs text-muted-foreground">Planned: {formatCurrency(budget.plannedIncome)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4 text-destructive" /> Expenses
            </div>
            <p className="text-2xl font-bold">{formatCurrency(budget.actualExpenses || 0)}</p>
            {budget.plannedExpenses && (
              <p className={`text-xs ${overBudget ? "text-destructive" : "text-muted-foreground"}`}>
                Planned: {formatCurrency(budget.plannedExpenses)} ({overBudget ? "+" : ""}{formatCurrency((budget.actualExpenses || 0) - budget.plannedExpenses)})
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4 text-primary" /> Savings
            </div>
            <p className={`text-2xl font-bold ${savings >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(savings)}
            </p>
            <p className="text-xs text-muted-foreground">Savings rate: {savingsRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {sortedCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedCategories.map(([category, amount], i) => {
              const pct = (budget.actualExpenses || 0) > 0 ? (amount / (budget.actualExpenses || 1)) * 100 : 0;
              return (
                <div key={category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                      <span className="text-sm font-medium w-20 text-right">{formatCurrency(amount)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  {i < sortedCategories.length - 1 && <div className="mt-3" />}
                </div>
              );
            })}
            <Separator className="my-2" />
            <div className="flex items-center justify-between font-bold">
              <span>Total</span>
              <span>{formatCurrency(budget.actualExpenses || 0)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {budget.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</p>
            <p className="text-sm text-foreground">{budget.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
