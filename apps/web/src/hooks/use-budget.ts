import { useState, useEffect, useCallback } from "react";

interface Budget {
  id: string;
  month: string;
  year: number;
  plannedIncome?: number;
  actualIncome?: number;
  plannedExpenses?: number;
  actualExpenses: number;
  categoryBreakdown?: Record<string, number>;
}

interface BudgetSummary {
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
}

export function useBudget(filters?: { addressId?: string; month?: string }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<BudgetSummary>({ totalIncome: 0, totalExpenses: 0, savingsRate: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBudgets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters?.addressId) params.set("addressId", filters.addressId);
      if (filters?.month) params.set("month", filters.month);
      const res = await fetch(`/api/budget?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setBudgets(data.budgets);
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters?.addressId, filters?.month]);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  return { budgets, summary, loading, error, refetch: fetchBudgets };
}
