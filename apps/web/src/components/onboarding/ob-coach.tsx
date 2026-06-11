"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

/**
 * Onboarding AI coach — bundle-3 chat4 owner decision (2).
 *
 * Every onboarding step carries a short, HONEST explainer of why accurate
 * data on that step improves the AI suggestions ("accurate data → accurate
 * recommendations"). Open by default on a first onboarding; the × collapses
 * it to a small "!" badge that reopens it. The collapsed preference persists
 * per browser profile in localStorage (mobile mirrors this with
 * AsyncStorage), so a returning user keeps their choice across steps and
 * visits.
 *
 * The copy itself stays in the i18n catalog (en/es parity) — this module
 * only exports the step→key map so the page and the parity test share one
 * source of truth.
 */

export const COACH_COLLAPSED_STORAGE_KEY = "locateflow.onboarding.coachCollapsed";

/** Step → onboarding-namespace message key. Single source for page + tests. */
export const COACH_STEP_COPY_KEYS = {
  profile: "coach_profile",
  address: "coach_address",
  providers: "coach_providers",
  moving: "coach_moving",
} as const;
export type CoachStep = keyof typeof COACH_STEP_COPY_KEYS;

/** Minimal storage surface so the pure helpers are testable without a DOM. */
export type CoachStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function defaultStorage(): CoachStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Privacy mode / blocked storage — coach simply stays open by default.
    return null;
  }
}

/** True when the user previously dismissed the coach. Defaults to open. */
export function readCoachCollapsed(
  storage: CoachStorage | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(COACH_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeCoachCollapsed(
  collapsed: boolean,
  storage: CoachStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(COACH_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Best-effort persistence only — never block onboarding on storage.
  }
}

/**
 * Collapse state hook. SSR/first paint renders OPEN (the first-run default);
 * the stored preference is applied after mount so hydration never mismatches.
 */
export function useCoachCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(readCoachCollapsed());
  }, []);
  const dismiss = useCallback(() => {
    setCollapsed(true);
    writeCoachCollapsed(true);
  }, []);
  const reopen = useCallback(() => {
    setCollapsed(false);
    writeCoachCollapsed(false);
  }, []);
  return { collapsed, dismiss, reopen };
}

export interface ObCoachProps {
  /** Mono eyebrow, e.g. "Why this matters". */
  eyebrow: string;
  /** The step-specific honest explainer line. */
  text: string;
  collapsed: boolean;
  onDismiss: () => void;
  onReopen: () => void;
  /** Accessible label for the × dismiss control. */
  dismissLabel: string;
  /** Visible label on the collapsed "!" badge. */
  reopenLabel: string;
  className?: string;
}

export function ObCoach({
  eyebrow,
  text,
  collapsed,
  onDismiss,
  onReopen,
  dismissLabel,
  reopenLabel,
  className = "",
}: ObCoachProps) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onReopen}
        className={`ob-coach-mini inline-flex items-center gap-2 self-start rounded-full border border-primary/25 bg-primary/10 py-1.5 pl-1.5 pr-3 text-xs font-semibold text-muted-foreground transition hover:border-primary/60 hover:text-foreground ${className}`}
      >
        <span
          aria-hidden="true"
          className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground"
        >
          !
        </span>
        {reopenLabel}
      </button>
    );
  }

  return (
    <div
      role="note"
      className={`ob-coach relative flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/10 p-3.5 pr-10 ${className}`}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissLabel}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"
      >
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
          {eyebrow}
        </p>
        <p className="ob-coach-line mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          {text}
        </p>
      </div>
    </div>
  );
}
