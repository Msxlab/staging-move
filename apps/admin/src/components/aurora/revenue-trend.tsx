"use client";

import { useId, useMemo, useRef, useState } from "react";

export interface TrendPoint {
  /** UTC day key, e.g. "2026-06-09". */
  date: string;
  /** Dollar value at the end of that day (estimated MRR). */
  value: number;
}

export type RangeKey = "7d" | "30d" | "qtr";

export const RANGES: ReadonlyArray<{ key: RangeKey; label: string }> = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "qtr", label: "QTR" },
];

/** Header captions per range — shared with the tabbed overview card. */
export const RANGE_CAPTIONS: Record<RangeKey, string> = {
  "7d": "Estimated MRR · daily · last 7 days",
  "30d": "Estimated MRR · daily · last 30 days",
  qtr: "Estimated MRR · weekly · last quarter",
};

/* Chart geometry — mirrors the corporate design handoff (admin-pro). The
 * viewBox is fixed; width stretches via preserveAspectRatio="none" while
 * the rendered height stays at H so hover-dot y-coordinates map 1:1. */
const W = 660;
const H = 220;
const MAX_AXIS_LABELS = 8;

function fmtUsd(v: number): string {
  return "$" + Math.round(v).toLocaleString("en-US");
}

function shortDate(key: string): string {
  return new Date(key + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function weekday(key: string): string {
  return new Date(key + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

/**
 * Revenue trend card — hand-rolled SVG line/area chart with the corporate
 * crosshair-hover interaction (vertical rule + point dot + flipping tooltip)
 * and a 7D/30D/QTR segmented range control.
 *
 * Receives the full daily series from the server component and slices
 * client-side, so switching ranges never refetches. The single `points`
 * prop keeps the client bundle and the RSC payload small.
 */
export function RevenueTrendCard({ points }: { points: TrendPoint[] }) {
  const [range, setRange] = useState<RangeKey>("30d");

  return (
    <section className="admin-panel">
      <header className="admin-panel-head">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            Revenue trend
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {RANGE_CAPTIONS[range]}
          </p>
        </div>
        <div className="shrink-0">
          <div className="au-seg" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={range === r.key ? "on" : ""}
                aria-pressed={range === r.key}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <RevenueTrendBody points={points} range={range} />
    </section>
  );
}

/**
 * Chart body only (range slicing + crosshair hover + SVG) — used by both
 * the standalone card above and the tabbed overview card, which renders
 * its own header and owns the range state.
 */
export function RevenueTrendBody({
  points,
  range,
}: {
  points: TrendPoint[];
  range: RangeKey;
}) {
  const [idx, setIdx] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gradientId = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const view = useMemo(() => {
    if (range === "7d") {
      const pts = points.slice(-7);
      return { pts, labels: pts.map((p) => weekday(p.date)) };
    }
    if (range === "30d") {
      const pts = points.slice(-30);
      return { pts, labels: pts.map((p) => shortDate(p.date)) };
    }
    // QTR — weekly buckets sampled from the daily series, anchored on the
    // most recent day so the right edge is always "now".
    const daily = points.slice(-90);
    const pts: TrendPoint[] = [];
    for (let i = daily.length - 1; i >= 0; i -= 7) pts.unshift(daily[i]);
    return { pts, labels: pts.map((p) => shortDate(p.date)) };
  }, [points, range]);

  const n = view.pts.length;
  const values = view.pts.map((p) => p.value);
  const max = Math.max(...values, 0) * 1.12 || 1;
  const px = (i: number) => 4 + (n > 1 ? (i / (n - 1)) * (W - 8) : 0);
  const py = (v: number) => H - 14 - (v / max) * (H - 26);

  const line = values
    .map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(v).toFixed(1)}`)
    .join(" ");

  // Sparse x-axis: a handful of evenly sampled labels — exact dates live in
  // the hover tooltip, the axis is orientation only.
  const axisLabels = useMemo(() => {
    if (view.labels.length <= MAX_AXIS_LABELS) return view.labels;
    const count = MAX_AXIS_LABELS;
    return Array.from({ length: count }, (_, i) =>
      view.labels[Math.round((i / (count - 1)) * (view.labels.length - 1))],
    );
  }, [view.labels]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el || n < 2) return;
    const rect = el.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (n - 1));
    setIdx(Math.max(0, Math.min(n - 1, i)));
  };

  // Bounds-guard: the parent owns the range, so a 30d→7d switch can leave a
  // stale hover index pointing past the shorter series until the next move.
  const safeIdx = idx != null && idx < n ? idx : null;
  const leftPct = safeIdx == null || n < 2 ? 0 : (safeIdx / (n - 1)) * 100;
  const hovered = safeIdx == null ? null : view.pts[safeIdx];

  return (
    <div className="px-6 pb-5 pt-4">
      {n < 2 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Not enough history yet — the trend fills in as subscriptions come
          and go.
        </p>
      ) : (
        <>
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
              aria-label="Estimated monthly recurring revenue over time"
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
                <linearGradient
                  id={gradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--au-accent)"
                    stopOpacity="0.20"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--au-accent)"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              <path
                d={`${line} L${px(n - 1).toFixed(1)} ${H} L${px(0).toFixed(1)} ${H} Z`}
                fill={`url(#${gradientId})`}
              />
              <path
                d={line}
                fill="none"
                stroke="var(--au-accent)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {hovered != null && (
              <>
                <div
                  className="au-chart-cross"
                  style={{ left: `${leftPct}%` }}
                />
                <span
                  className="au-chart-pt"
                  style={{
                    left: `${leftPct}%`,
                    top: `${py(hovered.value)}px`,
                  }}
                />
                <div
                  className={"au-tip" + (leftPct > 60 ? " flip" : "")}
                  style={{ left: `${leftPct}%` }}
                >
                  <div className="lb">
                    {weekday(hovered.date)} · {shortDate(hovered.date)}
                  </div>
                  <div className="vl">
                    <i />
                    MRR
                    <b className="au-num">{fmtUsd(hovered.value)}</b>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="au-xaxis" aria-hidden>
            {axisLabels.map((label, i) => (
              <span key={`${label}-${i}`}>{label}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
