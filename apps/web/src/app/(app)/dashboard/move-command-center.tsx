"use client";

/**
 * MOVE COMMAND CENTER — the dashboard's top-pinned engagement hero (web).
 *
 * Three states, picked in order:
 *   1. ACTIVE MOVE  → countdown + readiness ring + single next-critical CTA.
 *   2. NO PLAN      → a WARM "start your move" hero (replaces the old cold
 *                     0/0/$0 empty grid) instead of an empty dashboard.
 * Readiness blends two signals already on the dashboard:
 *   - checklist %-done (generateChecklist), and
 *   - providers set up vs. needed (missingCritical / completed-critical).
 * The single Next Critical Action is surfaced as one clear CTA that deep-links
 * to the provider task.
 *
 * MILESTONE: when readiness hits 100% (or the move date passes) we fire a
 * subtle, one-shot confetti burst. It is reduce-motion-safe (the burst is gated
 * behind prefers-reduced-motion and a `motion-reduce:hidden` class), only ever
 * runs once per mount via a ref latch, and needs no cleanup (CSS-driven, the
 * nodes are removed when the burst flag flips back off after the animation).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  PartyPopper,
  Rocket,
  Sparkles,
  Truck,
  PackageCheck,
} from "lucide-react";
import {
  getMoveCountdown,
  formatDateOnlyUtc,
  type RelocationChecklist,
} from "@locateflow/shared";

export interface CommandCenterAction {
  id: string;
  name: string;
  category: string;
  reason?: string;
  deadline?: string;
}

export interface MoveCommandCenterProps {
  activePlan: { id: string; fromCity: string; toCity: string; moveDate: string } | null;
  checklist: RelocationChecklist | null;
  /** Single top next-critical action (providers the user hasn't set up). */
  topAction: CommandCenterAction | null;
  /** Categories of CRITICAL providers still missing (from missingCritical). */
  missingCriticalCount: number;
  /** CRITICAL provider categories already completed. */
  completedCriticalCount: number;
  /** User's resolved timezone signals for a tz-correct countdown. */
  timezone?: string | null;
  state?: string | null;
  /**
   * COLD-START momentum floor (parity with mobile). True when the user has
   * genuinely completed the first real setup steps — origin AND destination are
   * set. It is the ONLY thing that lifts the ring off a hard 0% before any
   * task/provider progress; we credit only setup the user actually did (never a
   * fabricated completion). Defaults false → ring behaves exactly as before.
   */
  hasOriginDestination?: boolean;
  /** Localised copy. Keyed access keeps this component i18n-agnostic. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

// Cold-start momentum floor (%). Mirrors mobile: an active plan WITH origin +
// destination set is real, user-completed setup, so the ring starts here instead
// of a demotivating 0%. Floor only — any genuine higher progress always wins.
const COLD_START_FLOOR = 6;

/**
 * Readiness % = the mean of two normalised signals when both exist:
 *   - checklist progress (completed / total), and
 *   - critical providers set up (completed / (completed + missing)).
 * Falls back to whichever single signal is available; 0 when neither is. When
 * `hasOriginDestination` is true the result is floored at COLD_START_FLOOR — a
 * low, honest non-zero that reflects real setup the user did.
 */
function computeReadiness(
  checklist: RelocationChecklist | null,
  completedCritical: number,
  missingCritical: number,
  hasOriginDestination = false,
): number {
  const signals: number[] = [];
  if (checklist && checklist.totalItems > 0) {
    signals.push(checklist.completedItems / checklist.totalItems);
  }
  const criticalTotal = completedCritical + missingCritical;
  if (criticalTotal > 0) {
    signals.push(completedCritical / criticalTotal);
  }
  const computed =
    signals.length === 0
      ? 0
      : Math.round((signals.reduce((a, b) => a + b, 0) / signals.length) * 100);
  const floored = hasOriginDestination ? Math.max(computed, COLD_START_FLOOR) : computed;
  return Math.max(0, Math.min(100, floored));
}

/** SVG readiness ring. Pure presentation; size + stroke are fixed. */
function ReadinessRing({ percent, label }: { percent: number; label: string }) {
  const size = 92;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-foreground/10"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-tone-orange-fg transition-all duration-700 ease-out"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-foreground leading-none">{percent}%</span>
      </div>
    </div>
  );
}

/** A tiny, reduce-motion-safe confetti burst. CSS-animated; no JS loop. */
function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: `${(i / 14) * 100 + (i % 3) * 4}%`,
        delay: `${(i % 5) * 90}ms`,
        color: ["#7FB6E8", "#B49BFF", "#87DDC0", "#F2C46C"][i % 4],
      })),
    [],
  );
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
      aria-hidden="true"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 h-2 w-1.5 rounded-[1px]"
          style={{
            left: p.left,
            backgroundColor: p.color,
            animation: `confetti-fall 1400ms ${p.delay} ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

export function MoveCommandCenter({
  activePlan,
  checklist,
  topAction,
  missingCriticalCount,
  completedCriticalCount,
  timezone,
  state,
  hasOriginDestination,
  t,
}: MoveCommandCenterProps) {
  // ── NO-PLAN: warm "start your move" hero ──────────────────────────────────
  if (!activePlan) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-tone-orange-br bg-gradient-to-br from-primary0/10 via-foreground/[0.03] to-accent0/10 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="h-14 w-14 shrink-0 rounded-2xl bg-tone-orange-bg border border-tone-orange-br flex items-center justify-center">
            <Rocket className="h-7 w-7 text-tone-orange-fg" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-tone-orange-fg">
              {t("commandCenter_eyebrow")}
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
              {t("commandCenter_noPlanTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              {t("commandCenter_noPlanBody")}
            </p>
          </div>
          <Link href="/moving/new" className="shrink-0">
            <button className="flex items-center gap-2 px-5 py-3 rounded-xl bg-tone-orange-fg text-white text-sm font-semibold hover:opacity-90 transition whitespace-nowrap">
              <Truck className="h-4 w-4" /> {t("commandCenter_noPlanCta")}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // ── ACTIVE MOVE: countdown + readiness + next action ──────────────────────
  const countdown = getMoveCountdown(activePlan.moveDate, { timezone, state });
  const readiness = computeReadiness(
    checklist,
    completedCriticalCount,
    missingCriticalCount,
    hasOriginDestination,
  );
  const moveDateLabel = formatDateOnlyUtc(activePlan.moveDate);

  // Milestone latch: fire the one-shot burst when fully ready OR the move day
  // has arrived/passed — but only once per mount, and never re-trigger.
  const milestoneReached = readiness >= 100 || countdown.phase !== "upcoming";
  const [burst, setBurst] = useState(false);
  const firedRef = useRef(false);
  useEffect(() => {
    if (milestoneReached && !firedRef.current) {
      firedRef.current = true;
      setBurst(true);
      const id = window.setTimeout(() => setBurst(false), 1800);
      return () => window.clearTimeout(id);
    }
  }, [milestoneReached]);

  const countdownLine = (() => {
    if (countdown.phase === "today") return t("commandCenter_movingDay");
    if (countdown.phase === "past") return t("commandCenter_daysAgo", { count: countdown.absDays });
    if (countdown.absDays === 1) return t("commandCenter_oneDay");
    return t("commandCenter_daysToGo", { count: countdown.absDays });
  })();

  const isCelebration = countdown.phase === "today" || readiness >= 100;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-tone-orange-br bg-gradient-to-br from-primary0/10 via-foreground/[0.03] to-accent0/8 p-6 sm:p-7">
      {burst && <ConfettiBurst />}
      <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
        {/* Countdown block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-tone-orange-fg">
            {isCelebration ? (
              <PartyPopper className="h-4 w-4" />
            ) : (
              <CalendarClock className="h-4 w-4" />
            )}
            <p className="text-[11px] font-semibold uppercase tracking-wider">
              {t("commandCenter_eyebrow")}
            </p>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mt-2 leading-tight">
            {countdownLine}
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            {activePlan.fromCity} → {activePlan.toCity}
            {moveDateLabel ? ` · ${moveDateLabel}` : ""}
          </p>

          {/* Single Next Critical Action CTA */}
          {topAction ? (
            <Link
              href={`/providers/${topAction.id}`}
              className="mt-4 inline-flex items-center gap-3 max-w-full rounded-2xl border border-border bg-foreground/[0.04] hover:bg-foreground/[0.07] transition group px-4 py-3"
            >
              <div className="h-9 w-9 rounded-lg bg-tone-orange-bg border border-tone-orange-br flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-tone-orange-fg" />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-tone-orange-fg">
                  {t("commandCenter_nextAction")}
                </p>
                <p className="text-sm font-semibold text-foreground truncate">{topAction.name}</p>
                {(topAction.reason || topAction.deadline) && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {topAction.deadline ? `${topAction.deadline} · ` : ""}
                    {topAction.reason || (topAction.category || "").replace(/_/g, " ")}
                  </p>
                )}
              </div>
              <ArrowRight className="h-4 w-4 text-foreground/40 group-hover:text-tone-orange-fg transition shrink-0 ml-auto" />
            </Link>
          ) : readiness >= 100 ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-tone-emerald-br bg-tone-emerald-bg px-4 py-3">
              <PackageCheck className="h-4 w-4 text-tone-emerald-fg" />
              <p className="text-sm font-semibold text-tone-emerald-fg">
                {t("commandCenter_allSet")}
              </p>
            </div>
          ) : (
            <Link
              href={`/moving/plan/${activePlan.id}`}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-border bg-foreground/[0.04] hover:bg-foreground/[0.07] transition px-4 py-3"
            >
              <p className="text-sm font-semibold text-foreground">
                {t("commandCenter_viewPlan")}
              </p>
              <ArrowRight className="h-4 w-4 text-foreground/40" />
            </Link>
          )}
        </div>

        {/* Readiness ring */}
        <div className="flex items-center gap-4 lg:flex-col lg:items-center shrink-0">
          <ReadinessRing percent={readiness} label={t("commandCenter_readinessLabel", { percent: readiness })} />
          <div className="lg:text-center">
            <p className="text-sm font-semibold text-foreground">{t("commandCenter_readiness")}</p>
            <p className="text-xs text-muted-foreground">
              {checklist
                ? t("commandCenter_readinessDetail", {
                    done: checklist.completedItems,
                    total: checklist.totalItems,
                  })
                : missingCriticalCount > 0
                  ? t("commandCenter_readinessProviders", { count: missingCriticalCount })
                  : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
