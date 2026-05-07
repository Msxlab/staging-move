"use client";

import { useCountUp } from "./use-count-up";

/** Small circular percentage indicator (0–100). Animates the arc in. */
export function Ring({ pct }: { pct: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const v = useCountUp(pct, 1100);
  return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="var(--au-rule-2)"
        strokeWidth="3"
      />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="var(--au-cool)"
        strokeWidth="3"
        strokeDasharray={`${((c * v) / 100).toFixed(1)} ${c.toFixed(1)}`}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
      />
      <text
        x="18"
        y="20"
        textAnchor="middle"
        style={{
          font: "500 9px/1 var(--font-mono, ui-monospace, monospace)",
          fill: "var(--au-ink-2)",
          letterSpacing: "0.04em",
        }}
      >
        {Math.round(v)}%
      </text>
    </svg>
  );
}
