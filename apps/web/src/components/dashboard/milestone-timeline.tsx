"use client";

import { useLocale, useTranslations } from "next-intl";
import { Flag } from "lucide-react";
import { RELOCATION_PHASES, type RelocationChecklist } from "@/lib/shared-relocation";

/**
 * MILESTONE TIMELINE — Aurora dashboard widget (Edition VII parity).
 *
 * Horizontal milestone strip (the design system's .cw-tl look): one node per
 * relocation phase from the checklist the dashboard already generates —
 * done (sage, filled) / now (plan accent, filled) / future (hollow) — with a
 * connecting rail, a mono date derived from the move date + the phase's
 * canonical day offset, and the phase's task completion count. Pure
 * presentation over existing data; no fetching.
 */

type NodeStatus = "done" | "now" | "future";

export function MilestoneTimeline({ checklist }: { checklist: RelocationChecklist }) {
  const td = useTranslations("dashboard");
  const locale = useLocale();

  const moveDate = new Date(checklist.moveDate);
  const hasValidDate = !Number.isNaN(moveDate.getTime());
  const dateFmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });

  // Only phases that actually carry checklist items for THIS move profile —
  // the design's 5-node strip; the canonical phase list has 6, but profiles
  // typically populate 5-6 of them.
  const nodes = checklist.phases
    .filter((p) => p.totalCount > 0)
    .map((p) => {
      const status: NodeStatus = p.isActive
        ? "now"
        : p.phase < checklist.currentPhase || (p.totalCount > 0 && p.completedCount === p.totalCount)
          ? "done"
          : "future";
      const offset = RELOCATION_PHASES.find((ph) => ph.phase === p.phase)?.daysOffset ?? 0;
      const date = hasValidDate
        ? new Date(moveDate.getFullYear(), moveDate.getMonth(), moveDate.getDate() + offset)
        : null;
      return { ...p, status, dateLabel: date ? dateFmt.format(date) : "" };
    });

  if (nodes.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-xl overflow-hidden">
      <div className="flex items-baseline justify-between px-5 pt-5">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-tone-sage-fg" />
          <h3 className="text-sm font-semibold text-foreground">{td("widget_milestones")}</h3>
        </div>
        {hasValidDate && (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {td("milestones_moveDay", { date: dateFmt.format(moveDate) })}
          </span>
        )}
      </div>
      <div className="flex overflow-x-auto px-4 pb-5 pt-4">
        {nodes.map((node, i) => (
          <div key={node.phase} className="relative min-w-[88px] flex-1 pt-4">
            {/* connecting rail segment */}
            <span
              className={`absolute top-[5px] h-0.5 ${i === 0 ? "left-1/2" : "left-0"} ${
                i === nodes.length - 1 ? "right-1/2" : "right-0"
              } ${node.status === "done" ? "bg-tone-sage-fg" : "bg-foreground/10"}`}
              aria-hidden="true"
            />
            {/* node */}
            <span
              className={`absolute left-1/2 top-0 z-[1] h-3 w-3 -translate-x-1/2 rounded-full border-2 ${
                node.status === "done"
                  ? "border-tone-sage-fg bg-tone-sage-fg"
                  : node.status === "now"
                    ? "border-primary bg-primary"
                    : "border-foreground/30 bg-card"
              }`}
              aria-hidden="true"
            />
            <div className="mt-2 px-1.5 text-center">
              <p
                className={`font-mono text-[9px] uppercase tracking-[0.12em] ${
                  node.status === "done" ? "text-tone-sage-fg" : "text-muted-foreground"
                }`}
              >
                {node.dateLabel}
              </p>
              <p
                className={`mt-1 text-xs font-semibold leading-tight ${
                  node.status === "now" ? "text-primary" : "text-foreground"
                }`}
              >
                {node.shortLabel}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {td("milestones_tasks", { done: node.completedCount, total: node.totalCount })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
