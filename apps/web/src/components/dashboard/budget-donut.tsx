"use client";

import { useTranslations } from "next-intl";
import { PieChart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

/**
 * BUDGET DONUT — Aurora dashboard widget (Edition VII parity).
 *
 * Multi-segment hand-rolled SVG donut (same technique as the admin charts and
 * the Command Center readiness ring — no chart lib) over the category spend
 * breakdown the dashboard already computes from the loaded services. Center
 * shows the total monthly spend; the legend lists each segment with its
 * amount. Colors mirror the "Expenses by Category" bars widget so the same
 * category always wears the same tone across the board.
 */

// Stroke colors per category — CSS-var mirrors of the categoryColors map used
// by the category-bars widget (tone tokens / semantic vars only).
const DONUT_COLORS: Record<string, string> = {
  GOVERNMENT: "var(--danger)",
  UTILITY: "var(--tone-honey-fg)",
  FINANCIAL: "var(--tone-emerald-fg)",
  HOUSING: "var(--tone-sky-fg)",
  HEALTHCARE: "var(--danger)",
  TRANSPORTATION: "var(--tone-sky-fg)",
  KIDS: "var(--tone-foil-fg)",
  FITNESS: "var(--tone-orange-fg)",
  SHOPPING: "var(--danger)",
  OTHER: "var(--tone-slate-fg)",
};

const MAX_SEGMENTS = 5;

export function BudgetDonut({
  categories,
  total,
  labels,
}: {
  /** [categoryKey, monthlyAmount] pairs, already sorted desc by amount. */
  categories: [string, number][];
  /** Total monthly spend (center figure). */
  total: number;
  /** Localised category labels keyed by category prefix. */
  labels: Record<string, string>;
}) {
  const td = useTranslations("dashboard");

  const positive = categories.filter(([, amount]) => amount > 0);
  if (positive.length === 0 || total <= 0) return null;

  // Top N categories as segments; anything beyond folds into one "rest" slice.
  const top = positive.slice(0, MAX_SEGMENTS);
  const restAmount = positive.slice(MAX_SEGMENTS).reduce((sum, [, a]) => sum + a, 0);
  const segments = [
    ...top.map(([key, amount]) => ({
      key,
      label: labels[key] || key,
      amount,
      color: DONUT_COLORS[key] || "var(--tone-slate-fg)",
    })),
    ...(restAmount > 0
      ? [{ key: "__rest", label: td("donut_rest"), amount: restAmount, color: "var(--tone-slate-fg)" }]
      : []),
  ];
  const sum = segments.reduce((s, seg) => s + seg.amount, 0) || 1;

  // Donut geometry (matches the design prototype's proportions).
  const SIZE = 132;
  const R = 54;
  const STROKE = 13;
  const C = 2 * Math.PI * R;
  const GAP = 3; // px gap between segments (skipped for slivers)
  let offset = 0;

  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <PieChart className="h-4 w-4 text-tone-emerald-fg" />
          <h3 className="text-sm font-semibold text-foreground">{td("widget_budgetDonut")}</h3>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {td("stat_monthly")}
        </span>
      </div>
      <div className="flex items-center gap-5 px-5 pb-5">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} className="-rotate-90" role="img" aria-label={`${td("widget_budgetDonut")}: ${formatCurrency(total)}`}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke="var(--surface-3)"
              strokeWidth={STROKE}
            />
            {segments.map((seg) => {
              const len = (seg.amount / sum) * C;
              const gap = len > GAP * 2 ? GAP : 0;
              const el = (
                <circle
                  key={seg.key}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${len - gap} ${C - len + gap}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-lg font-bold text-foreground leading-none">
              {formatCurrency(total)}
            </span>
            <span className="mt-1 font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
              {td("donut_center")}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {segments.map((seg) => (
            <div key={seg.key} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0 rounded-[2.5px]"
                style={{ background: seg.color }}
              />
              <span className="truncate">{seg.label}</span>
              <span className="ml-auto shrink-0 font-mono font-semibold text-foreground">
                {formatCurrency(seg.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
