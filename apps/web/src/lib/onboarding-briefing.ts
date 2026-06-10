/**
 * AI onboarding briefing — coarse, NON-PII signal extraction, a tight LLM
 * prompt + guardrails, and a deterministic rule-based fallback.
 *
 * Privacy contract (enforced by `buildBriefingSignals` + `buildLlmPrompt`):
 *   - We NEVER send raw PII to the LLM. No name, no exact address, no email,
 *     no account numbers, no ZIP, no street. Only coarse booleans/counts and a
 *     2-letter US state code + a move stage label leave this process.
 *   - The LLM output is display-only. It is never persisted as authoritative
 *     data and never drives any downstream decision — it is a friendly summary.
 *
 * Gating / graceful degradation lives in the route: if ANTHROPIC_API_KEY is
 * unset, or the API errors/times out, the route returns the rule-based
 * `buildFallbackBriefing` (or `{ configured: false }` so the UI hides the AI
 * section). This module only owns: signals -> prompt, the fetch call, and the
 * fallback text.
 */

// ── Coarse, non-PII signal set ────────────────────────────────

export type MoveStage =
  | "no_move"
  | "planning"
  | "in_progress"
  | "recently_completed";

/**
 * COARSE days-to-move bucket. We never send the exact move date to the LLM — only
 * one of these honest, fuzzy buckets. `unknown` = no dated plan on file. This lets
 * the briefing acknowledge timing ("in the next few weeks") without inventing a
 * specific date or a legal deadline.
 */
export type DaysToMoveBucket =
  | "unknown"
  | "past"
  | "this_week"
  | "two_weeks"
  | "this_month"
  | "one_to_three_months"
  | "three_plus_months";

/**
 * A typed deep-link the client maps to a real in-app destination. Display-only:
 * the server never navigates — it just labels where the action should go.
 *   - category:    set up a still-pending essential (carries the catalog category key)
 *   - services:    the user's tracked-services list
 *   - state-rules: the move plan's state-specific guidance (DMV, voter, tax, ...)
 *   - plan:        the move plan (create or open)
 */
export type BriefingDeeplink =
  | { type: "category"; category: string }
  | { type: "services" }
  | { type: "state-rules" }
  | { type: "plan" };

/** Which state-rule section a `state_rule` target points at (mirrors the
 * /api/state-rules columns: dmvRules / voterRegistration / taxInfo). */
export type StateRuleKind = "dmv" | "voter" | "tax";

/**
 * Machine-readable CTA target, richer than the legacy `deeplink`. Clients use it
 * to land users somewhere specific (e.g. the RECOMMENDED providers for a category,
 * or a particular state-rule section) instead of a generic screen.
 *
 * IMPORTANT: targets are derived SERVER-SIDE from the same coarse signals that
 * built the LLM prompt — the LLM never emits these enums and is never trusted to.
 *   - category:   open recommended providers for this catalog category
 *                 (e.g. "UTILITY_INTERNET"); manual add is the fallback path.
 *   - state_rule: open the state-specific rule section for `state` (`ruleKind`
 *                 says which section: dmv | voter | tax).
 *   - plan:       open (or create) the move plan.
 *   - services:   open the user's tracked-services list.
 */
export type BriefingActionTarget =
  | { kind: "category"; category: string }
  | { kind: "state_rule"; state: string; ruleKind: StateRuleKind }
  | { kind: "plan" }
  | { kind: "services" };

/**
 * A single structured, tappable next action. `title`/`why` are display strings.
 * `deeplink` is the legacy typed link (kept for backwards compatibility — old
 * clients that only read `title`/`deeplink` keep working); `target` is the
 * richer, machine-readable destination new clients should prefer.
 */
export interface BriefingAction {
  title: string;
  why: string;
  deeplink: BriefingDeeplink;
  target: BriefingActionTarget;
}

export interface BriefingSignals {
  hasKids: boolean;
  hasPets: boolean;
  carCount: number;
  hasSenior: boolean;
  isBusiness: boolean;
  isMilitary: boolean;
  needsStorage: boolean;
  /** "own" | "rent" | "other" — coarse housing tenure, never the address. */
  housing: "own" | "rent" | "other";
  /** 2-letter US state of the move destination (or current home). May be null. */
  state: string | null;
  /** PERSONAL | BUSINESS | VACATION | MILITARY — coarse move category. */
  moveType: string;
  moveStage: MoveStage;
  /**
   * True when the active plan carries a real move date. Drives the fallback so it
   * never contradicts a known date (e.g. it won't say "pick a move date").
   */
  hasMoveDate: boolean;
  /** COARSE timing bucket derived from the move date — never the exact date. */
  daysToMoveBucket: DaysToMoveBucket;
  /** Coarse count of still-missing critical setup categories (not their identity). */
  missingCriticalCount: number;
  /** Human-readable critical category labels still pending (catalog labels, not PII). */
  missingCriticalLabels: string[];
  /**
   * Catalog category KEYS for the still-pending essentials, index-aligned with
   * `missingCriticalLabels`. Catalog enum values (e.g. "UTILITY_INTERNET") — never
   * PII. Used to attach a `{type:'category'}` deep-link to each generated action.
   */
  missingCriticalCategories: string[];
}

export interface ProfileLike {
  hasChildren?: boolean | null;
  hasPets?: boolean | null;
  carCount?: number | null;
  hasSenior?: boolean | null;
  isBusinessOwner?: boolean | null;
  isMilitary?: boolean | null;
  needsStorage?: boolean | null;
  moveType?: string | null;
}

export interface PrimaryAddressLike {
  state?: string | null;
  ownership?: string | null;
}

export interface MovePlanLike {
  status?: string | null;
  moveDate?: Date | string | null;
  toState?: string | null;
}

const US_STATE = /^[A-Z]{2}$/;

function coarseHousing(ownership?: string | null): "own" | "rent" | "other" {
  const o = (ownership || "").toUpperCase();
  if (o === "OWNER") return "own";
  if (o === "RENTER") return "rent";
  return "other";
}

function coarseState(value?: string | null): string | null {
  const s = (value || "").trim().toUpperCase();
  return US_STATE.test(s) ? s : null;
}

function resolveMoveStage(plan: MovePlanLike | null): MoveStage {
  if (!plan) return "no_move";
  const status = (plan.status || "").toUpperCase();
  if (status === "IN_PROGRESS") return "in_progress";
  if (status === "COMPLETED") return "recently_completed";
  return "planning";
}

/**
 * Derives the COARSE timing bucket from a move date. We deliberately collapse the
 * exact date into a fuzzy band so the LLM can speak to timing honestly without
 * ever receiving (or echoing) the precise date. Returns "unknown" when no date.
 */
function resolveDaysToMoveBucket(
  moveDate?: Date | string | null,
  now: Date = new Date(),
): DaysToMoveBucket {
  if (!moveDate) return "unknown";
  const ts = moveDate instanceof Date ? moveDate.getTime() : Date.parse(String(moveDate));
  if (!Number.isFinite(ts)) return "unknown";
  const days = Math.floor((ts - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "past";
  if (days <= 7) return "this_week";
  if (days <= 14) return "two_weeks";
  if (days <= 30) return "this_month";
  if (days <= 90) return "one_to_three_months";
  return "three_plus_months";
}

/**
 * Builds the coarse, non-PII signal set. This is the ONLY data that may be
 * forwarded to the LLM. By construction it contains no name, address, email,
 * ZIP, phone, or account identifier.
 */
export function buildBriefingSignals(input: {
  profile: ProfileLike | null;
  primaryAddress: PrimaryAddressLike | null;
  activePlan: MovePlanLike | null;
  /** Still-pending essentials as { category, label } pairs (catalog values, not PII). */
  missingCritical: Array<{ category: string; label: string }>;
}): BriefingSignals {
  const { profile, primaryAddress, activePlan, missingCritical } = input;
  const planState = coarseState(activePlan?.toState);
  const homeState = coarseState(primaryAddress?.state);
  const pending = missingCritical.slice(0, 6);

  return {
    hasKids: Boolean(profile?.hasChildren),
    hasPets: Boolean(profile?.hasPets),
    carCount: Math.max(0, Math.min(20, Math.floor(profile?.carCount ?? 0))),
    hasSenior: Boolean(profile?.hasSenior),
    isBusiness:
      Boolean(profile?.isBusinessOwner) ||
      (profile?.moveType || "").toUpperCase() === "BUSINESS",
    isMilitary:
      Boolean(profile?.isMilitary) ||
      (profile?.moveType || "").toUpperCase() === "MILITARY",
    needsStorage: Boolean(profile?.needsStorage),
    housing: coarseHousing(primaryAddress?.ownership),
    state: planState || homeState,
    moveType: (profile?.moveType || "PERSONAL").toUpperCase(),
    moveStage: resolveMoveStage(activePlan),
    hasMoveDate: Boolean(activePlan?.moveDate),
    daysToMoveBucket: resolveDaysToMoveBucket(activePlan?.moveDate ?? null),
    missingCriticalCount: pending.length,
    missingCriticalLabels: pending.map((p) => p.label),
    missingCriticalCategories: pending.map((p) => p.category),
  };
}

// ── LLM prompt + guardrails ───────────────────────────────────

const MOVE_STAGE_LABEL: Record<MoveStage, string> = {
  no_move: "not actively moving yet (just getting set up)",
  planning: "planning an upcoming move",
  in_progress: "in the middle of their move",
  recently_completed: "just completed their move",
};

/**
 * COARSE, human-readable timing phrase for each bucket. These are intentionally
 * fuzzy ("in the next couple of weeks"), never a specific date or deadline. The
 * LLM may echo this phrasing but is forbidden from inventing a precise date.
 */
const DAYS_TO_MOVE_PHRASE: Record<DaysToMoveBucket, string | null> = {
  unknown: null,
  past: "the move date has just passed",
  this_week: "moving within about a week",
  two_weeks: "moving in the next couple of weeks",
  this_month: "moving within about a month",
  one_to_three_months: "moving in the next one to three months",
  three_plus_months: "moving more than three months out",
};

export const BRIEFING_SYSTEM_PROMPT = [
  "You write a short, warm, plain-English 'move briefing' for a US-based user of a relocation-organizer app.",
  "Audience: everyday US movers. Tone: calm, encouraging, concrete. Reading level: 8th grade.",
  "",
  "HARD RULES — follow all of them:",
  "- US-only context. Do not reference other countries' rules or providers.",
  "- Be honest. Never invent specific company names, prices, discounts, or statistics.",
  "- TIMING: You MAY reflect the coarse timing phrase you are given (e.g. 'in the next couple of weeks') to make the briefing feel current. But NEVER state a specific calendar date, and NEVER invent a legal/registration deadline (e.g. 'you have 30 days to register your car'). For anything time-bound by law, say to 'check your state's official site for the exact window.'",
  "- Do NOT name specific providers, brands, carriers, or retailers. Speak in categories (e.g. 'your internet provider', 'the DMV', 'your utilities').",
  "- Do NOT give legal, tax, immigration, or financial advice. If something sounds legal/financial, say to 'check your state's official site' rather than advising.",
  "- Only reference the user's actual move stage and the signals provided. Do not assume facts you were not given.",
  "- No PII is provided to you and you must not ask for or fabricate any.",
  "- Output ONLY a 2-3 sentence, plain-text situation summary written directly to the user ('you'). The app renders the tappable next-actions itself, so do NOT add a numbered list, bullets, headers, preamble, or sign-off — just the summary sentences.",
].join("\n");

/**
 * Builds the user-turn prompt from coarse signals only. Returns a compact,
 * human-readable signal digest — never raw PII.
 */
export function buildLlmPrompt(signals: BriefingSignals): string {
  const lines: string[] = [];
  lines.push(`Move stage: ${MOVE_STAGE_LABEL[signals.moveStage]}.`);
  const timingPhrase = DAYS_TO_MOVE_PHRASE[signals.daysToMoveBucket];
  if (timingPhrase) {
    lines.push(`Timing (coarse, no exact date): ${timingPhrase}.`);
  }
  lines.push(
    `Move category: ${signals.moveType.toLowerCase()}${
      signals.isBusiness ? " (business)" : ""
    }${signals.isMilitary ? " (military)" : ""}.`,
  );
  if (signals.state) lines.push(`US state: ${signals.state}.`);
  lines.push(`Housing: ${signals.housing === "own" ? "owns home" : signals.housing === "rent" ? "rents" : "unspecified"}.`);
  lines.push(`Household: ${signals.hasKids ? "has kids" : "no kids"}, ${signals.hasPets ? "has pets" : "no pets"}${signals.hasSenior ? ", includes a senior" : ""}.`);
  lines.push(`Vehicles to register/transfer: ${signals.carCount}.`);
  if (signals.needsStorage) lines.push("Needs storage.");
  if (signals.missingCriticalLabels.length > 0) {
    lines.push(
      `Still-pending essential setup categories: ${signals.missingCriticalLabels.join(", ")}.`,
    );
  } else {
    lines.push("Essential setup categories: none pending (good shape).");
  }
  lines.push("");
  lines.push(
    "Write ONLY the 2-3 sentence situation summary now (no action list — the app shows the actions). Speak directly to the user as 'you'.",
  );
  return lines.join("\n");
}

// ── Anthropic Messages API call (raw fetch, no SDK dep) ────────

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-haiku-4-5";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_TOKENS = 600;

/**
 * Calls the Anthropic Messages API and returns the AI-written situation SUMMARY
 * (prose only — the structured, tappable actions are assembled separately by
 * `buildBriefingActions`), or null on any failure (timeout, non-2xx, unexpected
 * shape). The caller treats null as "fall back to the rule-based briefing" — this
 * function never throws.
 */
export async function generateLlmBriefing(
  apiKey: string,
  signals: BriefingSignals,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<string | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        system: BRIEFING_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildLlmPrompt(signals) }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = (await response.json().catch(() => null)) as
      | { content?: Array<{ type?: string; text?: string }> }
      | null;
    if (!data || !Array.isArray(data.content)) return null;

    const text = data.content
      .filter((block) => block?.type === "text" && typeof block.text === "string")
      .map((block) => block.text as string)
      .join("\n")
      .trim();

    return text.length > 0 ? text : null;
  } catch {
    // Timeout, abort, network error, or malformed JSON — degrade gracefully.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Structured, deep-linked actions (shared by AI + fallback) ──

function stageSummary(signals: BriefingSignals): string {
  switch (signals.moveStage) {
    case "in_progress":
      return "You're in the middle of your move";
    case "recently_completed":
      return "You've just wrapped up your move";
    case "planning":
      return "You're planning your move";
    default:
      return "You're getting your home set up";
  }
}

/**
 * Builds up to 3 honest, deep-linked next actions purely from the user's own
 * signals + pending checklist. Each action carries a typed `deeplink` (legacy)
 * AND a richer `target` the client maps to a real destination. This is the
 * single source of structured actions for BOTH paths: the AI path returns these
 * alongside its prose, and the rule-based fallback renders them inline. The LLM
 * never produces (and is never trusted to produce) the target enums — they are
 * derived here from the same signals that built the prompt. Never fabricates
 * specifics.
 */
export function buildBriefingActions(signals: BriefingSignals): BriefingAction[] {
  const actions: BriefingAction[] = [];

  // 1) Still-pending essentials → set-up-this-category deep-links (most actionable).
  //    The `category` target lands the user on RECOMMENDED providers for that
  //    category (manual add stays available as the fallback path).
  for (let i = 0; i < signals.missingCriticalLabels.length; i++) {
    if (actions.length >= 3) break;
    const label = signals.missingCriticalLabels[i];
    const category = signals.missingCriticalCategories[i];
    actions.push({
      title: `Set up ${label.toLowerCase()}`,
      why: "It's one of the essentials most people need in place around a move.",
      deeplink: category ? { type: "category", category } : { type: "services" },
      target: category ? { kind: "category", category } : { kind: "services" },
    });
  }

  // 2) Vehicles + a known state → state-specific guidance (DMV rules live there).
  if (actions.length < 3 && signals.carCount > 0 && signals.state) {
    actions.push({
      title: `Check vehicle registration rules for ${signals.state}`,
      why: "States set their own window to register after a move — your state's official guide has the exact rules.",
      deeplink: { type: "state-rules" },
      target: { kind: "state_rule", state: signals.state, ruleKind: "dmv" },
    });
  }
  // 3) Renters → lock move dates with the plan.
  if (actions.length < 3 && signals.housing === "rent") {
    actions.push({
      title: "Confirm move-in and move-out dates with your landlords",
      why: "Locking the dates early keeps your utilities, deposit, and overlap from becoming a scramble.",
      deeplink: { type: "plan" },
      target: { kind: "plan" },
    });
  }
  // 4) Kids/pets → records transfer (these belong in your tracked services).
  if (actions.length < 3 && (signals.hasPets || signals.hasKids)) {
    actions.push({
      title: signals.hasKids
        ? "Sort out school records and any new enrollment"
        : "Update your pet's records and find a local vet",
      why: "These take time to transfer, so starting now avoids a last-minute gap.",
      deeplink: { type: "services" },
      target: { kind: "services" },
    });
  }

  // Honest defaults to always reach 3 actions. The "pick a move date" default is
  // SUPPRESSED when a dated plan already exists, so we never contradict the user's
  // own signals.
  const defaults: BriefingAction[] = [
    {
      title: "List the services tied to your address",
      why: "Internet, utilities, insurance, and subscriptions are easy to forget until something lapses.",
      deeplink: { type: "services" },
      target: { kind: "services" },
    },
    {
      title: "Set a simple change-of-address checklist",
      why: "Updating your address in one pass prevents missed mail and billing surprises.",
      deeplink: { type: "services" },
      target: { kind: "services" },
    },
    ...(signals.hasMoveDate
      ? [
          {
            title: "Work backward from your move date",
            why: "Your date anchors everything else — bookings, notices, and transfers all key off it.",
            deeplink: { type: "plan" } as BriefingDeeplink,
            target: { kind: "plan" } as BriefingActionTarget,
          },
        ]
      : [
          {
            title: "Pick your target move date and work backward",
            why: "A date anchors everything else — bookings, notices, and transfers all key off it.",
            deeplink: { type: "plan" } as BriefingDeeplink,
            target: { kind: "plan" } as BriefingActionTarget,
          },
        ]),
  ];
  for (const d of defaults) {
    if (actions.length >= 3) break;
    if (!actions.some((a) => a.title === d.title)) actions.push(d);
  }

  return actions.slice(0, 3);
}

/**
 * The honest, deterministic situation summary (prose, 2-3 sentences). Shared by
 * the rule-based fallback. Reflects the coarse timing bucket but never a date.
 */
export function buildFallbackSummary(signals: BriefingSignals): string {
  const summaryBits: string[] = [stageSummary(signals)];
  if (signals.state) summaryBits.push(`in ${signals.state}`);
  let summary = summaryBits.join(" ") + ".";

  // Coarse timing — only when we actually have a dated plan (never invented).
  const timingPhrase = DAYS_TO_MOVE_PHRASE[signals.daysToMoveBucket];
  if (signals.hasMoveDate && timingPhrase && signals.daysToMoveBucket !== "past") {
    summary += ` You're ${timingPhrase}, so a little lead time helps.`;
  }

  const context: string[] = [];
  if (signals.hasKids) context.push("kids");
  if (signals.hasPets) context.push("pets");
  if (signals.carCount > 0) {
    context.push(signals.carCount === 1 ? "a vehicle" : `${signals.carCount} vehicles`);
  }
  if (signals.hasSenior) context.push("a senior in the household");
  if (context.length > 0) {
    summary += ` With ${context.join(", ")} to think about, a little structure goes a long way.`;
  } else {
    summary += " Keeping everything in one place makes the next steps easier.";
  }
  return summary;
}

/**
 * A deterministic, honest briefing assembled purely from the user's own
 * signals + pending checklist. No network, no LLM — this is what the UI shows
 * when ANTHROPIC_API_KEY is unset or the API fails. It must read sensibly on
 * its own (it is also a regression baseline for the LLM output).
 */
export function buildFallbackBriefing(signals: BriefingSignals): string {
  const summary = buildFallbackSummary(signals);
  const body = buildBriefingActions(signals)
    .map((a, i) => `${i + 1}. ${a.title} — ${a.why}`)
    .join("\n");
  return `${summary}\n\n${body}`;
}

// ── Structured payload + client-readable serialization ─────────

export interface BriefingPayload {
  /** Prose for display (AI prose, or the rule-based prose). */
  briefing: string;
  /** Structured, deep-linked actions (always present, always honest). */
  actions: BriefingAction[];
  moveStage: MoveStage;
  daysToMoveBucket: DaysToMoveBucket;
}

/**
 * Sentinel that separates the human-readable prose from a machine-readable JSON
 * tail appended to the `briefing` string. The client splits on this, renders the
 * prose, parses the tail for structured actions + stage, and never shows the tail.
 * This keeps the existing { briefing: string } transport (and its consumers /
 * cache fingerprint) unchanged while carrying structure end-to-end.
 */
export const BRIEFING_META_SENTINEL = "<<<LF_BRIEFING_META>>>";

/**
 * Encodes a payload into the single `briefing` string: prose, then the sentinel,
 * then compact JSON of { actions, moveStage, daysToMoveBucket }. The prose remains
 * the leading, fully-readable content for any consumer that ignores the tail.
 */
export function encodeBriefingString(payload: BriefingPayload): string {
  const meta = JSON.stringify({
    actions: payload.actions,
    moveStage: payload.moveStage,
    daysToMoveBucket: payload.daysToMoveBucket,
  });
  return `${payload.briefing}\n${BRIEFING_META_SENTINEL}\n${meta}`;
}
