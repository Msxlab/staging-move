"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

type BriefingDeeplink =
  | { type: "category"; category: string }
  | { type: "services" }
  | { type: "state-rules" }
  | { type: "plan" };

interface BriefingAction {
  title: string;
  why: string;
  deeplink: BriefingDeeplink;
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

function parseBriefing(raw: string): ParsedBriefing {
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
            (a: unknown): a is BriefingAction =>
              !!a &&
              typeof (a as BriefingAction).title === "string" &&
              typeof (a as BriefingAction).why === "string" &&
              isDeeplink((a as BriefingAction).deeplink),
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

export function MoveBriefingCard() {
  const [data, setData] = useState<{ briefing: string; aiGenerated: boolean } | null>(null);
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
        const json = await res.json();
        if (cancelled || !json?.configured || typeof json?.briefing !== "string") return;
        setData({ briefing: json.briefing, aiGenerated: !!json.aiGenerated });
      } catch {
        // nice-to-have — degrade silently to no card
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seenStage]);

  const parsed = useMemo(() => (data ? parseBriefing(data.briefing) : null), [data]);

  if (seenStage === undefined || dismissed || !parsed) return null;
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
    <div className="rounded-2xl border border-tone-orange-br bg-gradient-to-br from-primary0/5 to-accent0/5 p-5">
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
              href={deeplinkHref(action.deeplink)}
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
