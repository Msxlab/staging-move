"use client";

import { useEffect, useState } from "react";

export interface PlanDonutSegment {
  /** Plan tier id — drives the segment color. */
  tier: "INDIVIDUAL" | "FAMILY" | "PRO";
  label: string;
  count: number;
}

/* Tier ramp — Individual cool, Family mint, Pro Sapphire (no purple). The
 * vars re-resolve per theme (slate light / aurora dark) automatically. */
const TIER_COLOR: Record<PlanDonutSegment["tier"], string> = {
  INDIVIDUAL: "var(--au-cool)",
  FAMILY: "var(--au-family)",
  PRO: "var(--au-violet)",
};

/* Geometry mirrors the design handoff donut (admin.jsx): r=52, stroke=14,
 * 3px gaps between segments, rotated so 12 o'clock is the start. */
const R = 52;
const S = 14;
const C = 2 * Math.PI * R;
const GAP = 3;

/**
 * Plan distribution donut — strokeDasharray segments per paying tier with
 * the total active count in the center. Segments draw in once on mount via
 * a CSS dasharray transition (`.au-donut-seg`); prefers-reduced-motion
 * renders the final state immediately (transition disabled in aurora.css).
 */
export function PlanDonut({
  segments,
  total,
}: {
  segments: PlanDonutSegment[];
  total: number;
}) {
  // Start collapsed, flip to the real arcs on mount so the CSS transition
  // animates the draw-in exactly once.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const sum = segments.reduce((n, seg) => n + seg.count, 0);
  if (sum <= 0) return null;

  let acc = 0;
  const arcs = segments
    .filter((seg) => seg.count > 0)
    .map((seg) => {
      const len = (seg.count / sum) * C;
      const offset = acc;
      acc += len;
      return { ...seg, len, offset };
    });

  return (
    <div
      className="relative h-[124px] w-[124px] shrink-0"
      role="img"
      aria-label={`Plan distribution: ${segments
        .map((seg) => `${seg.label} ${seg.count}`)
        .join(", ")} of ${total} paying users`}
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
        {arcs.map((arc, i) => (
          <circle
            key={arc.tier}
            className="au-donut-seg"
            cx="62"
            cy="62"
            r={R}
            fill="none"
            stroke={TIER_COLOR[arc.tier]}
            strokeWidth={S}
            strokeDasharray={
              drawn
                ? `${Math.max(0, arc.len - GAP)} ${C - arc.len + GAP}`
                : `0 ${C}`
            }
            strokeDashoffset={-arc.offset}
            transform="rotate(-90 62 62)"
            style={{ transitionDelay: `${i * 120}ms` }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold leading-tight text-foreground au-num">
          {total.toLocaleString()}
        </span>
        <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          paying
        </span>
      </div>
    </div>
  );
}
