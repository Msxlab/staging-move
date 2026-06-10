"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { monthlyAmountForCycle } from "@/lib/budget-planning";

/**
 * MONTHLY SPARK — Aurora dashboard widget (Edition VII parity).
 *
 * Small hand-rolled SVG area sparkline of monthly spend. The dashboard's API
 * payload carries no historical spend time series, so the series is DERIVED
 * from data already loaded: for each of the last 6 months we sum the
 * monthly-equivalent cost of every service that existed by the end of that
 * month (via its createdAt). That makes this an honest "tracked monthly
 * spend" growth curve — it reflects when services were added to LocateFlow,
 * not retroactive billing history. No extra API calls.
 */

interface SparkService {
  monthlyCost?: number;
  billingCycle?: string | null;
  createdAt?: string;
}

const MONTHS = 6;

export function MonthlySpark({ services }: { services: SparkService[] }) {
  const td = useTranslations("dashboard");
  const locale = useLocale();
  // useId can emit characters (e.g. ":") that are unsafe inside url(#…) SVG
  // paint references — strip to a DOM-id-safe slug (uniqueness is preserved).
  const gradientId = `spark-grad-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  if (services.length === 0) return null;

  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short" });
  const now = new Date();
  const points: { label: string; value: number }[] = [];
  for (let i = MONTHS - 1; i >= 0; i--) {
    // End of the month `i` months ago (local time is fine for a trend view).
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const value = services.reduce((sum, s) => {
      const created = s.createdAt ? new Date(s.createdAt) : null;
      // Services without a createdAt count from the start of the window.
      if (created && !Number.isNaN(created.getTime()) && created.getTime() > end.getTime()) {
        return sum;
      }
      return sum + monthlyAmountForCycle(s.monthlyCost || 0, s.billingCycle);
    }, 0);
    points.push({ label: monthFmt.format(end), value });
  }

  const current = points[points.length - 1].value;
  if (current <= 0) return null;

  // Geometry — viewBox units; the SVG scales to the card width.
  const W = 280;
  const H = 84;
  const PAD = 8;
  const max = Math.max(...points.map((p) => p.value), 1);
  const xy = points.map((p, i) => [
    PAD + (i * (W - 2 * PAD)) / (points.length - 1),
    H - PAD - (p.value / max) * (H - 2 * PAD),
  ]);
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)} ${H} L${xy[0][0].toFixed(1)} ${H} Z`;
  const [lastX, lastY] = xy[xy.length - 1];

  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-1">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-tone-rose-fg" />
          <h3 className="text-sm font-semibold text-foreground">{td("widget_monthlySpark")}</h3>
        </div>
        <span className="font-mono text-xs font-semibold text-foreground">
          {formatCurrency(current)}
        </span>
      </div>
      <p className="px-5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
        {td("spark_sub")}
      </p>
      <div className="px-4 pb-4 pt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`${td("widget_monthlySpark")}: ${formatCurrency(current)}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--rose)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--rose)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={line}
            fill="none"
            stroke="var(--rose)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={lastX} cy={lastY} r={3} fill="var(--rose)" />
        </svg>
        <div className="mt-1 flex justify-between px-1">
          {points.map((p, i) => (
            <span
              key={`${p.label}-${i}`}
              className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground"
            >
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
