"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkles, X, ChevronRight } from "lucide-react";

/**
 * Web "move briefing" card — parity with the mobile MoveBriefingCard. Calls the
 * already-built, cached, PII-safe POST /api/onboarding/briefing, renders the
 * plain-English situation summary + the top 3 next actions as deep-linked rows,
 * and recurs once per move stage (dismiss marks the current stage seen).
 *
 * The card is a nice-to-have layered on the deterministic dashboard: it renders
 * nothing when the briefing isn't configured (no ANTHROPIC_API_KEY) or the fetch
 * fails. Self-contained parsing (sentinel + JSON tail) mirrors mobile so it works
 * on a server cache hit too, where `actions` is only present inside `briefing`.
 */

const BRIEFING_META_SENTINEL = "<<<LF_BRIEFING_META>>>";
const SEEN_STAGE_KEY = "locateflow.moveBriefing.seenStage";

export type BriefingDeeplink =
  | { type: "category"; category: string }
  | { type: "services" }
  | { type: "state-rules" }
  | { type: "plan" };

/**
 * Structured action target attached by the briefing API ({ kind, category,
 * state }). Richer than the legacy `deeplink`: `category` actions land on the
 * add-service flow with that category's recommended providers shown first, not
 * the generic all-categories manual-entry screen.
 */
export type BriefingTarget =
  | { kind: "category"; category: string }
  | { kind: "state_rule"; state?: string }
  | { kind: "plan" };

export interface BriefingAction {
  title: string;
  why: string;
  /** New structured target — preferred when present. */
  target?: BriefingTarget;
  /** Legacy typed deep-link — kept so older cached briefings still route. */
  deeplink?: BriefingDeeplink;
}

type MoveStage = "no_move" | "planning" | "in_progress" | "recently_completed";

interface ParsedBriefing {
  proseLines: string[];
  actions: BriefingAction[];
  moveStage: MoveStage | null;
}

function isDeeplink(value: unknown): value is BriefingDeeplink {
  if (!value || typeof value !== "object") return false;
  const t = (value as { type?: unknown }).type;
  if (t === "services" || t === "state-rules" || t === "plan") return true;
  if (t === "category") return typeof (value as { category?: unknown }).category === "string";
  return false;
}

function isTarget(value: unknown): value is BriefingTarget {
  if (!value || typeof value !== "object") return false;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === "plan") return true;
  if (kind === "state_rule") {
    const state = (value as { state?: unknown }).state;
    return state === undefined || typeof state === "string";
  }
  if (kind === "category") {
    const category = (value as { category?: unknown }).category;
    return typeof category === "string" && category.trim().length > 0;
  }
  return false;
}

export function parseBriefing(raw: string): ParsedBriefing {
  const idx = raw.indexOf(BRIEFING_META_SENTINEL);
  const prose = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const proseLines = prose
    .split("\n")
    .map((l) => l.trim())
    // Drop stray numbered-action lines (the rule-based fallback embeds them in
    // its prose; they become tappable rows below).
    .filter((l) => l.length > 0 && !/^\d+\.\s/.test(l));

  let actions: BriefingAction[] = [];
  let moveStage: MoveStage | null = null;
  if (idx >= 0) {
    try {
      const meta = JSON.parse(raw.slice(idx + BRIEFING_META_SENTINEL.length).trim());
      if (Array.isArray(meta?.actions)) {
        actions = meta.actions
          .filter(
            // An action is renderable when it has display strings AND at least
            // one routable destination — the new structured `target` or the
            // legacy `deeplink`. Actions without either are dropped (same as
            // before `target` existed).
            (a: unknown): a is BriefingAction =>
              !!a &&
              typeof (a as BriefingAction).title === "string" &&
              typeof (a as BriefingAction).why === "string" &&
              (isTarget((a as BriefingAction).target) ||
                isDeeplink((a as BriefingAction).deeplink)),
          )
          .slice(0, 3);
      }
      const stage = meta?.moveStage;
      if (stage === "no_move" || stage === "planning" || stage === "in_progress" || stage === "recently_completed") {
        moveStage = stage;
      }
    } catch {
      // Malformed tail → render prose only.
    }
  }
  return { proseLines, actions, moveStage };
}

// ── Fetch-state derivation (exported for tests) ──────────────────────────────

/**
 * What the dashboard should render for a 200 response from
 * POST /api/onboarding/briefing:
 *   - hidden:   not configured (no key) or nothing usable — card disappears.
 *   - teaser:   GATE-API plan gate (entitled:false / upgradeRequired) — the
 *               feature exists but the user's FREE/FREE_TRIAL plan doesn't
 *               include it; render the value-first upgrade teaser.
 *   - briefing: entitled payload with the briefing text (today's behavior;
 *               older payloads without an `entitled` field keep working).
 */
export type BriefingFetchState =
  | { kind: "hidden" }
  | { kind: "teaser" }
  | { kind: "briefing"; briefing: string; aiGenerated: boolean };

export function deriveBriefingState(json: unknown): BriefingFetchState {
  if (!json || typeof json !== "object") return { kind: "hidden" };
  const j = json as {
    configured?: unknown;
    entitled?: unknown;
    upgradeRequired?: unknown;
    briefing?: unknown;
    aiGenerated?: unknown;
  };
  // configured:false (key absent) hides everything — never tease a feature the
  // deployment can't serve once the user upgrades.
  if (j.configured !== true) return { kind: "hidden" };
  if (j.entitled === false || j.upgradeRequired === true) return { kind: "teaser" };
  if (typeof j.briefing !== "string") return { kind: "hidden" };
  return { kind: "briefing", briefing: j.briefing, aiGenerated: j.aiGenerated === true };
}

function deeplinkHref(d: BriefingDeeplink): string {
  switch (d.type) {
    case "category":
      return `/services/new?category=${encodeURIComponent(d.category)}`;
    case "services":
      return "/services";
    case "state-rules":
    case "plan":
      // The plan list surfaces state rules + move date; neutral target since the
      // active plan id isn't available to this card.
      return "/moving";
  }
}

/**
 * Maps a briefing action to its in-app destination. Prefers the structured
 * `target` from the API:
 *   - category:   the add-service flow with that category preselected — the
 *                 page shows the category's recommended providers first and
 *                 keeps manual add as the fallback path.
 *   - state_rule: the move plan area, where the per-state guide (DMV, voter,
 *                 tax rules) lives on the plan detail page. No per-rule anchor
 *                 exists on web and the card has no plan id, so this lands on
 *                 the plan page.
 *   - plan:       the move plan page.
 * Actions without a valid target keep today's legacy `deeplink` behavior.
 */
export function actionHref(action: BriefingAction): string {
  if (isTarget(action.target)) {
    switch (action.target.kind) {
      case "category":
        return `/services/new?category=${encodeURIComponent(action.target.category)}`;
      case "state_rule":
      case "plan":
        return "/moving";
    }
  }
  if (isDeeplink(action.deeplink)) return deeplinkHref(action.deeplink);
  // Unreachable for parsed actions (the filter requires target or deeplink);
  // safe neutral fallback for any direct caller.
  return "/services";
}

/**
 * Value-first upgrade teaser for FREE/FREE_TRIAL (GATE-API entitled:false).
 * Keeps the briefing card chrome (sparkle badge, title, dismiss), pitches the
 * feature honestly in two lines, previews the prose as a pure-CSS blurred
 * skeleton strip (no fake text — nothing readable), and CTAs to /pricing.
 * Visual language mirrors the existing MOVING_PLAN upgrade teaser
 * (move-command-center free hero).
 */
export function MoveBriefingTeaser({ onDismiss }: { onDismiss?: () => void }) {
  const td = useTranslations("dashboard");
  return (
    <div className="rounded-2xl border border-tone-orange-br bg-gradient-to-br from-primary/5 to-transparent p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-tone-orange-bg border border-tone-orange-br flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-tone-orange-fg" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{td("briefing_teaser_title")}</p>
          <p className="text-[13.5px] leading-5 text-muted-foreground mt-1">{td("briefing_teaser_pitch1")}</p>
          <p className="text-[13.5px] leading-5 text-muted-foreground">{td("briefing_teaser_pitch2")}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={td("briefing_teaser_dismiss")}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Blurred prose preview — pure CSS bars, intentionally NO text content
          so nothing fake is readable (or exposed to screen readers). */}
      <div className="mt-3 space-y-1.5 blur-[2px] opacity-70 select-none" aria-hidden="true">
        <div className="h-3 w-full rounded bg-foreground/10" />
        <div className="h-3 w-11/12 rounded bg-foreground/10" />
        <div className="h-3 w-3/4 rounded bg-foreground/10" />
      </div>

      <div className="mt-4">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-tone-orange-fg text-white text-sm font-semibold hover:opacity-90 transition whitespace-nowrap"
        >
          <Sparkles className="h-4 w-4" /> {td("briefing_teaser_cta")}
        </Link>
      </div>
    </div>
  );
}

export function MoveBriefingCard() {
  const [state, setState] = useState<BriefingFetchState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // null while reading localStorage (avoid a flash before we know the seen state).
  const [seenStage, setSeenStage] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    try {
      setSeenStage(localStorage.getItem(SEEN_STAGE_KEY));
    } catch {
      setSeenStage(null);
    }
  }, []);

  useEffect(() => {
    if (seenStage === undefined) return; // wait for localStorage hydration
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/briefing", { method: "POST" });
        if (!res.ok) return;
        const next = deriveBriefingState(await res.json());
        if (cancelled || next.kind === "hidden") return;
        setState(next);
      } catch {
        // nice-to-have — degrade silently to no card
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seenStage]);

  const data = state?.kind === "briefing" ? state : null;
  const parsed = useMemo(() => (data ? parseBriefing(data.briefing) : null), [data]);

  if (seenStage === undefined || dismissed || !state) return null;

  // Plan-gated → value-first teaser (session-dismissable; no stage to persist).
  if (state.kind === "teaser") {
    return <MoveBriefingTeaser onDismiss={() => setDismissed(true)} />;
  }

  if (!parsed) return null;
  // Re-show once per stage: hide if the user already dismissed this exact stage.
  if (parsed.moveStage && seenStage === parsed.moveStage) return null;
  if (parsed.proseLines.length === 0 && parsed.actions.length === 0) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (parsed.moveStage) {
      try {
        localStorage.setItem(SEEN_STAGE_KEY, parsed.moveStage);
      } catch {
        // ignore storage failures
      }
    }
  };

  return (
    <div className="rounded-2xl border border-tone-orange-br bg-gradient-to-br from-primary/5 to-transparent p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-tone-orange-bg border border-tone-orange-br flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-tone-orange-fg" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Your move briefing</p>
          {data?.aiGenerated && (
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground mt-0.5">AI-generated</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss briefing"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {parsed.proseLines.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {parsed.proseLines.map((line, i) => (
            <p key={i} className="text-[13.5px] leading-5 text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      )}

      {parsed.actions.length > 0 && (
        <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-foreground/[0.02]">
          {parsed.actions.map((action, i) => (
            <Link
              key={i}
              href={actionHref(action)}
              className="flex items-center gap-3 p-3 hover:bg-foreground/[0.05] transition group"
            >
              <span className="h-7 w-7 rounded-lg bg-tone-orange-bg border border-tone-orange-br flex items-center justify-center text-xs font-bold text-tone-orange-fg shrink-0">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-foreground truncate">{action.title}</span>
                <span className="block text-xs text-muted-foreground truncate">{action.why}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-tone-orange-fg transition shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
