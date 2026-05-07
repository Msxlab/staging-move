"use client";

import { useMemo } from "react";

interface SparklineProps {
  values: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}

/** Tiny path-drawn sparkline that animates in via the .au-sparkpath rule. */
export function Sparkline({
  values,
  color = "var(--au-cool)",
  height = 36,
  fill = true,
}: SparklineProps) {
  const w = 120;
  const h = height;
  const padY = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const xAt = (i: number) => (i / (values.length - 1)) * w;
  const yAt = (v: number) => padY + (h - 2 * padY) * (1 - (v - min) / span);
  const d = values
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`,
    )
    .join(" ");
  const fillD = fill ? `${d} L${w} ${h} L0 ${h} Z` : null;
  const id = useMemo(
    () => "spk-" + Math.random().toString(36).slice(2, 8),
    [],
  );

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.40" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillD ?? undefined} fill={`url(#${id})`} />
        </>
      )}
      <path
        className="au-sparkpath"
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
    </svg>
  );
}
