"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";

const categoryColors: Record<string, string> = {
  Financial: "bg-emerald-500",
  Utility: "bg-amber-500",
  Government: "bg-red-500",
  Housing: "bg-sky-500",
  Healthcare: "bg-rose-500",
  Transportation: "bg-blue-500",
  Kids: "bg-purple-500",
  Fitness: "bg-orange-500",
  Shopping: "bg-pink-500",
  Other: "bg-gray-500",
};

interface CategoryItem {
  name: string;
  amount: number;
  color: string;
}

export function BudgetWidget() {
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
          const catLabel = catPrefix.charAt(0) + catPrefix.slice(1).toLowerCase();
          catMap[catLabel] = (catMap[catLabel] || 0) + cost;
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
            .map(([name, amount]) => ({
              name,
              amount,
              color: categoryColors[name] || "bg-gray-500",
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
        <h3 className="text-sm font-semibold text-white">Monthly Budget</h3>
        <span className="text-xl font-bold text-white">
          {formatCurrency(totalExpenses)}
        </span>
      </div>
      <div className="px-5 pb-5 space-y-3">
        {loading ? (
          <p className="text-sm text-white/30 text-center py-4">Loading...</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-white/30 text-center py-4">No expense data</p>
        ) : (
          categories.map((category) => (
            <div key={category.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">{category.name}</span>
                <span className="font-medium text-white/80">
                  {formatCurrency(category.amount)}
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
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
