/**
 * Pure helpers for MoveBriefingCard — deliberately free of React Native /
 * Expo imports so the briefing parsing and the target→route mapping stay
 * unit-testable under vitest's node environment. The card itself remains
 * fully self-contained: it parses its own structured actions out of the
 * single `briefing` string the server returns.
 *
 * Transport: `<prose>\n<<<LF_BRIEFING_META>>>\n<json>`. The JSON tail carries
 * `{ actions, moveStage, planId? }` where each action names a real in-app
 * destination. Two generations of the action contract are accepted:
 *   - current: `{ kind: "category" | "state_rule" | "plan" | "services",
 *                category?, state?, ruleKind? }` — either nested under a
 *     `target` field or flattened onto the action object itself.
 *   - legacy:  `{ deeplink: { type: "category" | "services" | "state-rules"
 *                | "plan", category? } }` (pre-contract cached briefings).
 * Anything unrecognizable is dropped action-by-action — the prose always
 * renders, so the card never blanks out on a contract drift.
 */

export const BRIEFING_META_SENTINEL = "<<<LF_BRIEFING_META>>>";

export type MoveStage = "no_move" | "planning" | "in_progress" | "recently_completed";

/** Normalized, client-side action target (the union the router mapping consumes). */
export type BriefingActionTarget =
  | { kind: "category"; category: string }
  | { kind: "state_rule"; state?: string; ruleKind?: string }
  | { kind: "plan" }
  | { kind: "services" };

export interface ParsedBriefingAction {
  title: string;
  why: string;
  target: BriefingActionTarget;
}

export interface ParsedBriefing {
  /** Human-readable prose lines (sentinel + JSON tail + numbered lines stripped). */
  proseLines: string[];
  actions: ParsedBriefingAction[];
  moveStage: MoveStage | null;
  /** Active move-plan id when the meta tail carries one (newer servers). */
  planId: string | null;
}

/**
 * Normalizes ONE candidate object into a target. Accepts both the `kind`
 * (current) and `type` (legacy deeplink) discriminators, plus the
 * "state-rules" / "state_rules" / "state_rule" spelling variants.
 */
function normalizeTargetCandidate(value: unknown): BriefingActionTarget | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const rawKind = record.kind ?? record.type;
  if (typeof rawKind !== "string") return null;
  const kind = rawKind.replace(/-/g, "_");
  if (kind === "category") {
    return typeof record.category === "string" && record.category.length > 0
      ? { kind: "category", category: record.category }
      : null;
  }
  if (kind === "state_rule" || kind === "state_rules") {
    return {
      kind: "state_rule",
      ...(typeof record.state === "string" && record.state ? { state: record.state } : {}),
      ...(typeof record.ruleKind === "string" && record.ruleKind
        ? { ruleKind: record.ruleKind }
        : {}),
    };
  }
  if (kind === "plan") return { kind: "plan" };
  if (kind === "services") return { kind: "services" };
  return null;
}

/**
 * Extracts the navigation target from a raw briefing action, trying the
 * nested `target` field first, then contract fields flattened onto the action,
 * then the legacy `deeplink` shape. Returns null when nothing is recognizable
 * (the action is then dropped — defensive, matches the pre-contract behavior).
 */
export function normalizeBriefingTarget(action: unknown): BriefingActionTarget | null {
  if (!action || typeof action !== "object") return null;
  const record = action as Record<string, unknown>;
  return (
    normalizeTargetCandidate(record.target) ??
    normalizeTargetCandidate(record) ??
    normalizeTargetCandidate(record.deeplink)
  );
}

/**
 * Splits the briefing string into prose lines + structured meta. Defensive at
 * every step: missing sentinel → prose only; malformed JSON tail → prose only;
 * invalid actions are dropped individually. Numbered "1. …" lines are filtered
 * from the prose (the rule-based fallback embeds its action list there — those
 * same actions render as tappable rows instead).
 */
export function parseBriefing(raw: string): ParsedBriefing {
  const idx = raw.indexOf(BRIEFING_META_SENTINEL);
  const prose = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const proseLines = prose
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^\d+\.\s/.test(l));

  const actions: ParsedBriefingAction[] = [];
  let moveStage: MoveStage | null = null;
  let planId: string | null = null;
  if (idx >= 0) {
    try {
      const meta = JSON.parse(raw.slice(idx + BRIEFING_META_SENTINEL.length).trim()) as {
        actions?: unknown;
        moveStage?: unknown;
        planId?: unknown;
      };
      if (meta && Array.isArray(meta.actions)) {
        for (const candidate of meta.actions) {
          if (actions.length >= 3) break;
          if (!candidate || typeof candidate !== "object") continue;
          const { title, why } = candidate as { title?: unknown; why?: unknown };
          if (typeof title !== "string" || typeof why !== "string") continue;
          const target = normalizeBriefingTarget(candidate);
          if (!target) continue;
          actions.push({ title, why, target });
        }
      }
      const stage = meta?.moveStage;
      if (
        stage === "no_move" ||
        stage === "planning" ||
        stage === "in_progress" ||
        stage === "recently_completed"
      ) {
        moveStage = stage;
      }
      if (typeof meta?.planId === "string" && meta.planId.length > 0) {
        planId = meta.planId;
      }
    } catch {
      // Malformed tail → just render the prose with no actions.
    }
  }
  return { proseLines, actions, moveStage, planId };
}

/** A concrete expo-router destination the card can push. */
export type BriefingRoute =
  | { pathname: "/services/new"; params: { category: string } }
  | { pathname: "/moving/[id]"; params: { id: string } }
  | { pathname: "/(tabs)/services" }
  | { pathname: "/(tabs)/moving" };

/**
 * Maps a normalized action target to a real screen:
 *   - category    → the add-services screen in BROWSE mode with the category in
 *                   focus, so the user first sees the RECOMMENDED providers of
 *                   that category for their address (manual add stays available
 *                   inside that screen as the fallback, never the landing).
 *   - state_rule  → the active plan's DETAIL screen (it renders the state-rules
 *                   guidance + the rule-derived task timeline), falling back to
 *                   the Move tab only when no active plan is resolvable.
 *   - plan        → plan detail, same fallback.
 *   - services    → the tracked-services tab (unchanged).
 */
export function resolveBriefingActionRoute(
  target: BriefingActionTarget,
  activePlanId: string | null,
): BriefingRoute {
  switch (target.kind) {
    case "category":
      return { pathname: "/services/new", params: { category: target.category } };
    case "state_rule":
    case "plan":
      return activePlanId
        ? { pathname: "/moving/[id]", params: { id: activePlanId } }
        : { pathname: "/(tabs)/moving" };
    case "services":
      return { pathname: "/(tabs)/services" };
  }
}

/**
 * Picks the user's active move plan from a `/api/moving` plan list: an
 * IN_PROGRESS plan wins over a PLANNING one; completed/canceled plans never
 * match. Tolerates arbitrary junk (non-arrays, malformed entries) and returns
 * null so callers can fall back to the Move tab.
 */
export function pickActivePlanId(plans: unknown): string | null {
  if (!Array.isArray(plans)) return null;
  let inProgress: string | null = null;
  let planning: string | null = null;
  for (const plan of plans) {
    if (!plan || typeof plan !== "object") continue;
    const { id, status } = plan as { id?: unknown; status?: unknown };
    if (typeof id !== "string" || id.length === 0 || typeof status !== "string") continue;
    const normalized = status.toUpperCase();
    if (normalized === "IN_PROGRESS" && inProgress === null) inProgress = id;
    else if (normalized === "PLANNING" && planning === null) planning = id;
  }
  return inProgress ?? planning;
}
