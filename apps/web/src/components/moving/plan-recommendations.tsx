"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";

/**
 * "Set up now for your move" — surfaces the top critical/important personalized
 * provider recommendations on the moving-plan page, at the moment of intent
 * (while the user works their plan) instead of only on the dashboard/directory.
 * Reuses the existing /api/providers/recommendations endpoint, which already
 * factors in the active plan's move date + phase + proximity. Renders nothing
 * when there are no recommendations (or recs aren't available).
 */

interface RecProvider {
  id: string;
  name: string;
  category: string;
  urgencyTier?: string;
  explanation?: { reason?: string | null } | null;
}
interface RecCluster {
  tier: string;
  providers: RecProvider[];
}

export function MovingPlanRecommendations() {
  const [providers, setProviders] = useState<RecProvider[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/providers/recommendations")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.clusters) return;
        const clusters = data.clusters as RecCluster[];
        const critical = clusters.find((c) => c.tier === "CRITICAL")?.providers || [];
        const important = clusters.find((c) => c.tier === "IMPORTANT")?.providers || [];
        setProviders([...critical.slice(0, 3), ...important.slice(0, 3)].slice(0, 4));
      })
      .catch(() => {
        // bonus panel — degrade silently to nothing
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!providers || providers.length === 0) return null;

  return (
    <div className="rounded-2xl border border-tone-orange-br bg-gradient-to-br from-primary/5 to-transparent p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-tone-orange-fg" />
        <h2 className="text-sm font-semibold text-foreground">Set up now for your move</h2>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {providers.map((p) => (
          <Link
            key={p.id}
            href={`/providers/${p.id}`}
            className="group flex items-center gap-3 rounded-xl border border-border bg-foreground/[0.02] p-3 transition hover:bg-foreground/[0.05]"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{p.name}</span>
              {p.explanation?.reason && (
                <span className="block truncate text-xs text-muted-foreground">{p.explanation.reason}</span>
              )}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-tone-orange-fg" />
          </Link>
        ))}
      </div>
    </div>
  );
}
