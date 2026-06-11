"use client";

import { useState } from "react";
import {
  RANGES,
  RANGE_CAPTIONS,
  RevenueTrendBody,
  type RangeKey,
  type TrendPoint,
} from "./revenue-trend";
import { SignupsTrendBody, type SignupWeekPoint } from "./signups-trend";

type TabKey = "revenue" | "signups";

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: "revenue", label: "Revenue" },
  { key: "signups", label: "Signups" },
];

/**
 * Two-tab flagship chart card for the dashboard: "Revenue" hosts the
 * existing estimated-MRR trend (unchanged data + range control), "Signups"
 * hosts the new signups-by-plan weekly chart. Both series ship once from
 * the server page; switching tabs or ranges never refetches.
 */
export function OverviewTrendsCard({
  revenue,
  signups,
}: {
  revenue: TrendPoint[];
  signups: SignupWeekPoint[];
}) {
  const [tab, setTab] = useState<TabKey>("revenue");
  const [range, setRange] = useState<RangeKey>("30d");

  return (
    <section className="admin-panel">
      <header className="admin-panel-head">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            {tab === "revenue" ? "Revenue trend" : "Signups by plan"}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {tab === "revenue"
              ? RANGE_CAPTIONS[range]
              : "New users · weekly · last 8 weeks"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {tab === "revenue" && (
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
          )}
          <div className="au-seg" role="group" aria-label="Chart">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={tab === t.key ? "on" : ""}
                aria-pressed={tab === t.key}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      {tab === "revenue" ? (
        <RevenueTrendBody points={revenue} range={range} />
      ) : (
        <SignupsTrendBody weeks={signups} />
      )}
    </section>
  );
}
