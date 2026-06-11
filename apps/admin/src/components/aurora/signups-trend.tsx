"use client";

import { useId, useRef, useState } from "react";

/** One ISO week (Monday-start, UTC) of signup counts split by plan tier. */
export interface SignupWeekPoint {
  /** UTC day key of the ISO week's Monday, e.g. "2026-06-08". */
  weekStart: string;
  individual: number;
  family: number;
  pro: number;
  /** FREE_TRIAL plus users without a subscription row. */
  free: number;
}

/* Same chart geometry as revenue-trend so the two tabs feel like one card. */
const W = 660;
const H = 220;

/** Series order matches stacking priority in the legend and tooltip. */
const SERIES: ReadonlyArray<{
  key: keyof Omit<SignupWeekPoint, "weekStart">;
  name: string;
  color: string;
}> = [
  { key: "individual", name: "Individual", color: "var(--au-cool)" },
  { key: "family", name: "Family", color: "var(--au-family)" },
  { key: "pro", name: "Pro", color: "var(--au-violet)" },
  { key: "free", name: "Free", color: "var(--au-ink-3)" },
];

function shortDate(key: string): string {
  return new Date(key + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Signups-by-plan body — multi-series SVG area/line chart over the last 8
 * ISO weeks, one line per plan tier (Individual cool, Family mint, Pro
 * honey, Free slate). Same hand-rolled geometry and crosshair-hover
 * interaction as revenue-trend; the tooltip lists all four series so a
 * single hover answers "what did that week look like".
 */
export function SignupsTrendBody({ weeks }: { weeks: SignupWeekPoint[] }) {
  const [idx, setIdx] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gradientBase = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const n = weeks.length;
  const allValues = weeks.flatMap((w) =>
    SERIES.map((s) => w[s.key]),
  );
  const max = Math.max(...allValues, 0) * 1.12 || 1;
  const px = (i: number) => 4 + (n > 1 ? (i / (n - 1)) * (W - 8) : 0);
  const py = (v: number) => H - 14 - (v / max) * (H - 26);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el || n < 2) return;
    const rect = el.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (n - 1));
    setIdx(Math.max(0, Math.min(n - 1, i)));
  };

  const leftPct = idx == null || n < 2 ? 0 : (idx / (n - 1)) * 100;
  const hovered = idx == null ? null : weeks[idx];

  if (n < 2) {
    return (
      <div className="px-6 pb-5 pt-4">
        <p className="py-10 text-center text-sm text-muted-foreground">
          Not enough history yet — weekly signups fill in as people join.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 pb-5 pt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-3">
        {SERIES.map((s) => (
          <span
            key={s.key}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.name}
          </span>
        ))}
      </div>

      <div
        ref={wrapRef}
        className="au-chartwrap"
        onMouseMove={onMove}
        onMouseLeave={() => setIdx(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          width="100%"
          height={H}
          style={{ display: "block" }}
          role="img"
          aria-label="New user signups per week split by plan tier"
        >
          {[0.25, 0.5, 0.75, 1].map((g) => (
            <line
              key={g}
              x1="0"
              x2={W}
              y1={py(max * g)}
              y2={py(max * g)}
              stroke="var(--au-rule)"
              strokeWidth="1"
            />
          ))}
          <defs>
            {SERIES.map((s) => (
              <linearGradient
                key={s.key}
                id={`${gradientBase}-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {SERIES.map((s) => {
            const line = weeks
              .map(
                (w, i) =>
                  `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(w[s.key]).toFixed(1)}`,
              )
              .join(" ");
            return (
              <g key={s.key}>
                <path
                  d={`${line} L${px(n - 1).toFixed(1)} ${H} L${px(0).toFixed(1)} ${H} Z`}
                  fill={`url(#${gradientBase}-${s.key})`}
                />
                <path
                  d={line}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
        </svg>

        {hovered != null && (
          <>
            <div className="au-chart-cross" style={{ left: `${leftPct}%` }} />
            {SERIES.map((s) => (
              <span
                key={s.key}
                className="au-chart-pt"
                style={{
                  left: `${leftPct}%`,
                  top: `${py(hovered[s.key])}px`,
                  background: s.color,
                }}
              />
            ))}
            <div
              className={"au-tip" + (leftPct > 60 ? " flip" : "")}
              style={{ left: `${leftPct}%` }}
            >
              <div className="lb">Week of {shortDate(hovered.weekStart)}</div>
              {SERIES.map((s) => (
                <div className="vl" key={s.key}>
                  <i style={{ background: s.color }} />
                  {s.name}
                  <b className="au-num">{hovered[s.key]}</b>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="au-xaxis" aria-hidden>
        {weeks.map((w) => (
          <span key={w.weekStart}>{shortDate(w.weekStart)}</span>
        ))}
      </div>
    </div>
  );
}
