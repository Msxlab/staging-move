"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatCurrency } from "@/lib/utils";

const CATEGORY_PREFIX_TO_KEY: Record<string, string> = {
  GOVERNMENT: "GOVERNMENT", UTILITY: "UTILITY", FINANCIAL: "FINANCIAL",
  HOUSING: "HOUSING", HEALTHCARE: "HEALTHCARE", TRANSPORTATION: "TRANSPORTATION",
  KIDS: "KIDS", FITNESS: "FITNESS", SHOPPING: "SHOPPING", OTHER: "OTHER",
};

const categoryColors: Record<string, string> = {
  FINANCIAL: "bg-tone-emerald-fg",
  UTILITY: "bg-tone-honey-fg",
  GOVERNMENT: "bg-destructive",
  HOUSING: "bg-tone-sky-bg",
  HEALTHCARE: "bg-destructive",
  TRANSPORTATION: "bg-tone-sky-fg",
  KIDS: "bg-tone-foil-fg",
  FITNESS: "bg-tone-orange-fg",
  SHOPPING: "bg-destructive",
  OTHER: "bg-tone-slate-fg",
};

interface CategoryItem {
  key: string;
  amount: number;
  color: string;
}

export function BudgetWidget() {
  const td = useTranslations("dashboard");
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/budget").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
    ])
      .then(([budgetData, servicesData]) => {
        const budgets = budgetData.budgets || [];
        const services = servicesData.services || [];

        // Sum from services as monthly cost breakdown
        const catMap: Record<string, number> = {};
        let total = 0;
        services.forEach((s: any) => {
          const cost = s.monthlyCost || 0;
          total += cost;
          const catPrefix = (s.category || "OTHER").split("_")[0];
          const catKey = CATEGORY_PREFIX_TO_KEY[catPrefix] || "OTHER";
          catMap[catKey] = (catMap[catKey] || 0) + cost;
        });

        // If budgets exist, prefer budget totals
        if (budgets.length > 0) {
          const budgetTotal = budgets.reduce((sum: number, b: any) => sum + (b.actualExpenses || 0), 0);
          if (budgetTotal > 0) total = budgetTotal;
        }

        setTotalExpenses(total);
        setCategories(
          Object.entries(catMap)
            .sort((a, b) => b[1] - a[1])
            .map(([key, amount]) => ({
              key,
              amount,
              color: categoryColors[key] || "bg-tone-slate-fg",
            }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maxAmount = categories.length > 0 ? Math.max(...categories.map((c) => c.amount)) : 1;

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-foreground">{td("budget_monthlyTitle")}</h3>
        <span className="text-xl font-bold text-foreground">
          {formatCurrency(totalExpenses)}
        </span>
      </div>
      <div className="px-5 pb-5 space-y-3">
        {loading ? (
          <p className="text-sm text-foreground/40 text-center py-4">{td("budget_loading")}</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-foreground/40 text-center py-4">{td("budget_noData")}</p>
        ) : (
          categories.map((category) => (
            <div key={category.key} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{td(`categoryLabel_${category.key}` as any)}</span>
                <span className="font-medium text-foreground/80">
                  {formatCurrency(category.amount)}
                </span>
              </div>
              <div className="h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${category.color} transition-all`}
                  style={{
                    width: `${(category.amount / maxAmount) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
