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
  /** Coarse count of still-missing critical setup categories (not their identity). */
  missingCriticalCount: number;
  /** Human-readable critical category labels still pending (catalog labels, not PII). */
  missingCriticalLabels: string[];
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
 * Builds the coarse, non-PII signal set. This is the ONLY data that may be
 * forwarded to the LLM. By construction it contains no name, address, email,
 * ZIP, phone, or account identifier.
 */
export function buildBriefingSignals(input: {
  profile: ProfileLike | null;
  primaryAddress: PrimaryAddressLike | null;
  activePlan: MovePlanLike | null;
  missingCriticalLabels: string[];
}): BriefingSignals {
  const { profile, primaryAddress, activePlan, missingCriticalLabels } = input;
  const planState = coarseState(activePlan?.toState);
  const homeState = coarseState(primaryAddress?.state);

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
    missingCriticalCount: missingCriticalLabels.length,
    missingCriticalLabels: missingCriticalLabels.slice(0, 6),
  };
}

// ── LLM prompt + guardrails ───────────────────────────────────

const MOVE_STAGE_LABEL: Record<MoveStage, string> = {
  no_move: "not actively moving yet (just getting set up)",
  planning: "planning an upcoming move",
  in_progress: "in the middle of their move",
  recently_completed: "just completed their move",
};

export const BRIEFING_SYSTEM_PROMPT = [
  "You write a short, warm, plain-English 'move briefing' for a US-based user of a relocation-organizer app.",
  "Audience: everyday US movers. Tone: calm, encouraging, concrete. Reading level: 8th grade.",
  "",
  "HARD RULES — follow all of them:",
  "- US-only context. Do not reference other countries' rules or providers.",
  "- Be honest. Never invent specific company names, prices, dates, deadlines, discounts, or statistics.",
  "- Do NOT name specific providers, brands, carriers, or retailers. Speak in categories (e.g. 'your internet provider', 'the DMV', 'your utilities').",
  "- Do NOT give legal, tax, immigration, or financial advice. If something sounds legal/financial, say to 'check your state's official site' rather than advising.",
  "- Only reference the user's actual move stage and the signals provided. Do not assume facts you were not given.",
  "- No PII is provided to you and you must not ask for or fabricate any.",
  "- Output plain text only: a 2-3 sentence situation summary, then exactly 3 numbered actions, each with a one-line WHY. No markdown headers, no preamble, no sign-off.",
].join("\n");

/**
 * Builds the user-turn prompt from coarse signals only. Returns a compact,
 * human-readable signal digest — never raw PII.
 */
export function buildLlmPrompt(signals: BriefingSignals): string {
  const lines: string[] = [];
  lines.push(`Move stage: ${MOVE_STAGE_LABEL[signals.moveStage]}.`);
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
    "Write the move briefing now: a 2-3 sentence summary of their situation, then exactly 3 numbered next actions, each with a short WHY.",
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
 * Calls the Anthropic Messages API and returns the briefing text, or null on
 * any failure (timeout, non-2xx, unexpected shape). The caller treats null as
 * "fall back to the rule-based briefing" — this function never throws.
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

// ── Deterministic rule-based fallback ─────────────────────────

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
 * A deterministic, honest briefing assembled purely from the user's own
 * signals + pending checklist. No network, no LLM — this is what the UI shows
 * when ANTHROPIC_API_KEY is unset or the API fails. It must read sensibly on
 * its own (it is also a regression baseline for the LLM output).
 */
export function buildFallbackBriefing(signals: BriefingSignals): string {
  const summaryBits: string[] = [stageSummary(signals)];
  if (signals.state) summaryBits.push(`in ${signals.state}`);
  let summary = summaryBits.join(" ") + ".";

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

  // Build up to 3 concrete actions from the pending critical categories first,
  // then fall back to sensible, honest defaults — never fabricated specifics.
  const actions: Array<{ title: string; why: string }> = [];

  for (const label of signals.missingCriticalLabels) {
    if (actions.length >= 3) break;
    actions.push({
      title: `Set up ${label.toLowerCase()}`,
      why: "It's one of the essentials most people need in place around a move.",
    });
  }

  if (actions.length < 3 && signals.carCount > 0 && signals.state) {
    actions.push({
      title: `Plan your vehicle registration in ${signals.state}`,
      why: "Most states give you a limited window to register after you move — check your state's DMV site for the exact rules.",
    });
  }
  if (actions.length < 3 && signals.housing === "rent") {
    actions.push({
      title: "Confirm move-in and move-out dates with your landlords",
      why: "Locking the dates early keeps your utilities, deposit, and overlap from becoming a scramble.",
    });
  }
  if (actions.length < 3 && (signals.hasPets || signals.hasKids)) {
    actions.push({
      title: signals.hasKids
        ? "Sort out school records and any new enrollment"
        : "Update your pet's records and find a local vet",
      why: "These take time to transfer, so starting now avoids a last-minute gap.",
    });
  }
  // Honest defaults to always reach 3 actions.
  const defaults: Array<{ title: string; why: string }> = [
    {
      title: "List the services tied to your address",
      why: "Internet, utilities, insurance, and subscriptions are easy to forget until something lapses.",
    },
    {
      title: "Set a simple change-of-address checklist",
      why: "Updating your address in one pass prevents missed mail and billing surprises.",
    },
    {
      title: "Pick your target move date and work backward",
      why: "A date anchors everything else — bookings, notices, and transfers all key off it.",
    },
  ];
  for (const d of defaults) {
    if (actions.length >= 3) break;
    if (!actions.some((a) => a.title === d.title)) actions.push(d);
  }

  const body = actions
    .slice(0, 3)
    .map((a, i) => `${i + 1}. ${a.title} — ${a.why}`)
    .join("\n");

  return `${summary}\n\n${body}`;
}
