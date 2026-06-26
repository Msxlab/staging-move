"use client";

import { useEffect, useState } from "react";

/* Generic categorical donut — the premium sibling of PlanDonut for arbitrary
 * labelled segments (platform / plan mix / device breakdowns, etc.). Same
 * aurora treatment: chunky r=52/stroke=14 geometry, 3px segment gaps, a
 * once-on-mount draw-in via the `.au-donut-seg` CSS transition (disabled under
 * prefers-reduced-motion in aurora.css), a center total, and an accessible
 * role="img" label. Colors resolve from aurora CSS vars so theme switching
 * (slate light / aurora dark) repaints automatically — no hardcoded brand
 * color. */

const PALETTE = [
  "var(--au-cool)",
  "var(--au-mint)",
  "var(--au-amber)",
  "var(--au-coral)",
  "var(--au-violet)",
  "var(--au-cool-2)",
  "var(--au-rose)",
  "var(--au-ink-3)",
];

const R = 52;
const S = 14;
const C = 2 * Math.PI * R;
const GAP = 3;

export function AuroraDonut({
  data,
  colorMap,
  centerLabel,
}: {
  /** [label, value] pairs. */
  data: [string, number][];
  /** Optional per-label color override (else the categorical palette). */
  colorMap?: Record<string, string>;
  /** Optional caption under the center total. */
  centerLabel?: string;
}) {
  // Start collapsed, flip to the real arcs on mount so the CSS transition
  // animates the draw-in exactly once.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const total = data.reduce((n, [, v]) => n + v, 0);
  if (total <= 0)
    return <p className="py-8 text-center text-sm text-muted-foreground">No data</p>;

  let acc = 0;
  const segments = data
    .filter(([, v]) => v > 0)
    .map(([label, value], i) => {
      const len = (value / total) * C;
      const offset = acc;
      acc += len;
      return {
        label,
        value,
        len,
        offset,
        pct: (value / total) * 100,
        color: colorMap?.[label] || PALETTE[i % PALETTE.length],
      };
    });

  return (
    <div className="flex items-center gap-6">
      <div
        className="relative h-[124px] w-[124px] shrink-0"
        role="img"
        aria-label={`${centerLabel ? `${centerLabel}: ` : ""}${segments
          .map((seg) => `${seg.label} ${seg.value}`)
          .join(", ")} (${total} total)`}
      >
        <svg width="124" height="124" viewBox="0 0 124 124" aria-hidden>
          <circle
            cx="62"
            cy="62"
            r={R}
            fill="none"
            stroke="var(--au-track)"
            strokeWidth={S}
          />
          {segments.map((seg, i) => (
            <circle
              key={seg.label}
              className="au-donut-seg"
              cx="62"
              cy="62"
              r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={S}
              strokeDasharray={
                drawn
                  ? `${Math.max(0, seg.len - GAP)} ${C - seg.len + GAP}`
                  : `0 ${C}`
              }
              strokeDashoffset={-seg.offset}
              transform="rotate(-90 62 62)"
              style={{ transitionDelay: `${i * 120}ms` }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="au-num text-lg font-semibold leading-tight text-foreground">
            {total.toLocaleString()}
          </span>
          {centerLabel && (
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              {centerLabel}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="flex-1 text-foreground">{seg.label}</span>
            <span className="font-mono text-muted-foreground">
              {seg.value} ({Math.round(seg.pct)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
