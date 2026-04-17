import { ArrowLeft, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

const mockBudget = {
  month: "2026-02",
  year: 2026,
  plannedIncome: 6500,
  actualIncome: 6500,
  plannedExpenses: 4200,
  actualExpenses: 4350,
  categoryBreakdown: {
    "Rent/Mortgage": 1500,
    "Utilities": 310,
    "Insurance": 420,
    "Groceries": 650,
    "Transportation": 280,
    "Healthcare": 150,
    "Subscriptions": 85,
    "Entertainment": 200,
    "Dining Out": 320,
    "Shopping": 180,
    "Savings": 255,
  },
};

export default function BudgetMonthPage() {
  const budget = mockBudget;
  const monthName = new Date(budget.month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const overBudget = budget.actualExpenses > (budget.plannedExpenses || 0);
  const savings = budget.actualIncome! - budget.actualExpenses;
  const savingsRate = budget.actualIncome ? ((savings / budget.actualIncome) * 100).toFixed(1) : "0";
  const sortedCategories = Object.entries(budget.categoryBreakdown).sort(([, a], [, b]) => b - a);

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
            <p className="text-2xl font-bold">{formatCurrency(budget.actualIncome!)}</p>
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
            <p className="text-2xl font-bold">{formatCurrency(budget.actualExpenses)}</p>
            {budget.plannedExpenses && (
              <p className={`text-xs ${overBudget ? "text-destructive" : "text-muted-foreground"}`}>
                Planned: {formatCurrency(budget.plannedExpenses)} ({overBudget ? "+" : ""}{formatCurrency(budget.actualExpenses - budget.plannedExpenses)})
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Spending by Category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedCategories.map(([category, amount], i) => {
            const pct = budget.actualExpenses > 0 ? (amount / budget.actualExpenses) * 100 : 0;
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
            <span>{formatCurrency(budget.actualExpenses)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
