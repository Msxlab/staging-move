import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { checkGlobalBudget } from "@/lib/global-spend-guard";
import { scopedRecordWhere } from "@/lib/workspace-data-scope";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";
import { CANCELED_MOVING_PLAN_STATUSES, planFeatures } from "@locateflow/shared";
import { getRequestEntitlement } from "@/lib/request-entitlements";
import { getMergedDisplayCategoryKey, getMergedDisplayCategoryLabel, getEssentialSetupCategories, type UserProfile } from "@/lib/recommendation-engine";
import { recordIntegrationOutcome } from "@/lib/integration-telemetry";
import {
  buildBriefingSignals,
  buildBriefingActions,
  buildFallbackBriefing,
  encodeBriefingString,
  generateLlmBriefing,
  type BriefingAction,
  type BriefingSignals,
  type DaysToMoveBucket,
  type MoveStage,
} from "@/lib/onboarding-briefing";

export const dynamic = "force-dynamic";

/**
 * Per-user, per-UTC-day in-process LRU cache + HARD daily AI-generation cap.
 *
 * Keyed by `userId(:workspaceId):yyyy-mm-dd` so the budget rolls over at UTC
 * midnight by construction (yesterday's keys are simply never read again).
 * Each entry stores the last served briefing AND how many AI generations the
 * user has consumed today:
 *   - same-day repeat with an unchanged signal fingerprint → serve the cached
 *     briefing, NO new API call, no budget consumed;
 *   - fingerprint changed (move date/address/services materially changed) and
 *     budget remains → regenerate (one API attempt = one unit of budget,
 *     whether or not the model call succeeds — this is what stops hammering);
 *   - past the cap → keep serving the same-day cached briefing (or the
 *     rule-based one). Capping NEVER surfaces as an error to the card.
 */
interface CachedBriefing {
  fingerprint: string;
  briefing: string;
  actions: BriefingAction[];
  moveStage: MoveStage;
  daysToMoveBucket: DaysToMoveBucket;
  source: "ai" | "rule_based";
  cachedAt: number;
}
const briefingCache = new Map<string, CachedBriefing>();
/**
 * Hard per-user cap on Anthropic API attempts per UTC day. Enforced via the
 * shared (Upstash-backed) rate limiter keyed by user + UTC day, NOT an in-process
 * counter — so the 3/day budget is GLOBAL across instances and survives a restart
 * (the cap is the only thing guarding real Anthropic spend). The in-memory cache
 * below still serves same-day unchanged requests and the last briefing for free.
 */
const DAILY_AI_GENERATION_CAP = 3;
/** LRU bound — day-scoped entries, so this is purely a memory guard. */
const BRIEFING_CACHE_MAX_ENTRIES = 2000;

/** UTC day key, e.g. "2026-06-10". The cap and cache roll over with this. */
function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Get + LRU-touch (Map preserves insertion order; re-insert marks recency). */
function briefingCacheGet(key: string): CachedBriefing | undefined {
  const entry = briefingCache.get(key);
  if (!entry) return undefined;
  briefingCache.delete(key);
  briefingCache.set(key, entry);
  return entry;
}

function briefingCacheSet(key: string, entry: CachedBriefing): void {
  briefingCache.delete(key);
  briefingCache.set(key, entry);
  while (briefingCache.size > BRIEFING_CACHE_MAX_ENTRIES) {
    const oldest = briefingCache.keys().next().value;
    if (oldest === undefined) break;
    briefingCache.delete(oldest);
  }
}

/** The cached entry rendered as the standard success payload. */
function cachedResponse(entry: CachedBriefing) {
  // Fire-and-forget telemetry (synchronous in-process buffer — never throws,
  // never adds latency): both same-day cache hits and budget-capped repeats
  // count as 'cached' (no API attempt was spent).
  recordIntegrationOutcome("briefing", "cached");
  return NextResponse.json({
    configured: true,
    source: entry.source,
    aiGenerated: entry.source === "ai",
    briefing: entry.briefing,
    actions: entry.actions,
    moveStage: entry.moveStage,
    daysToMoveBucket: entry.daysToMoveBucket,
    cached: true,
  });
}

function signalFingerprint(signals: BriefingSignals): string {
  return JSON.stringify([
    signals.hasKids,
    signals.hasPets,
    signals.carCount,
    signals.hasSenior,
    signals.isBusiness,
    signals.isMilitary,
    signals.needsStorage,
    signals.housing,
    signals.state,
    signals.moveType,
    signals.moveStage,
    signals.hasMoveDate,
    signals.daysToMoveBucket,
    signals.missingCriticalLabels,
    signals.missingCriticalCategories,
  ]);
}

export async function POST(request: NextRequest) {
  // ── Auth (gated) ────────────────────────────────────────────
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch (err: unknown) {
    const status = (err as Error)?.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json(
      { error: status === 403 ? "Forbidden" : "Unauthorized" },
      { status },
    );
  }

  // ── Rate limit ──────────────────────────────────────────────
  const rl = await rateLimit(getRateLimitKey(request, "onboarding:briefing", { userId }), {
    limit: 10,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  // ── Configuration + entitlement gates ───────────────────────
  // The runtime key decides whether the AI section exists at all on this
  // deployment; the caller's plan decides whether THIS user gets it. Both are
  // resolved up front so a gated request never gathers signals, touches the
  // cache, or consumes daily AI budget.
  const apiKeyValue = await getRuntimeConfigValue("ANTHROPIC_API_KEY").catch(() => null);
  const apiKey = apiKeyValue?.trim() || null;

  // Not configured → tell the UI to hide the AI section. We do NOT 500; the
  // briefing is a nice-to-have layered on top of the deterministic dashboard.
  // Checked BEFORE the plan gate so a keyless deployment never dangles an
  // upgrade CTA for a feature nobody on it can have.
  if (!apiKey) {
    return NextResponse.json({ configured: false });
  }

  const { scope, plan: userPlan } = await getRequestEntitlement(request, userId);

  // Paid-plan gate (owner decision): the AI briefing is Family and Pro.
  // FREE/FREE_TRIAL get a value-first upgrade teaser instead. HTTP 200 — never
  // 403 — so old clients (which require a string `briefing`) fail soft to the
  // deterministic dashboard instead of erroring.
  if (!planFeatures(userPlan.plan).aiBriefing) {
    // Fire-and-forget telemetry (never throws, never adds latency): a gated
    // request consumed no AI budget and gathered no signals.
    recordIntegrationOutcome("briefing", "gated");
    return NextResponse.json({
      configured: true,
      entitled: false,
      upgradeRequired: "AI_BRIEFING_UPGRADE_REQUIRED",
    });
  }

  // ── Gather coarse, non-PII signals from the user's own data ──
  const [user, activePlan, activeServices, savedProviders] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        profile: {
          select: {
            hasChildren: true,
            hasPets: true,
            carCount: true,
            hasSenior: true,
            isBusinessOwner: true,
            isMilitary: true,
            needsStorage: true,
            moveType: true,
          },
        },
      },
    }),
    prisma.movingPlan.findFirst({
      where: scopedRecordWhere(
        scope,
        { deletedAt: null, status: { notIn: [...CANCELED_MOVING_PLAN_STATUSES] } },
        { childSelfOnly: true },
      ),
      orderBy: { updatedAt: "desc" },
      select: {
        status: true,
        moveDate: true,
        toAddress: { select: { state: true } },
      },
    }),
    prisma.service.findMany({
      where: activeTrackedServiceWhereForScope(
        { userId, workspaceId: scope.workspaceId },
        scope.memberRole === "CHILD" ? { userId } : {},
      ),
      select: { category: true },
    }),
    // Saved providers count as "handled" too, so picking a bank (etc.) closes its
    // essential here even if the user bookmarked rather than tracked it.
    prisma.savedProvider.findMany({
      where: { userId },
      select: { provider: { select: { category: true } } },
    }),
  ]);

  // Primary address (for coarse state + housing tenure). Best-effort.
  const primaryAddress = await prisma.address
    .findFirst({
      where: scopedRecordWhere(scope, { deletedAt: null }, { childSelfOnly: true }),
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: { state: true, ownership: true },
    })
    .catch(() => null);

  // Categories the user has already handled — a tracked Service OR a saved
  // provider. Either one CLOSES that essential (so picking a bank drops the
  // financial recommendation). Catalog enum values — never PII.
  const ownedCategories = new Set<string>();
  for (const s of activeServices) ownedCategories.add((s.category || "").toUpperCase());
  for (const sp of savedProviders) {
    const cat = (sp.provider?.category || "").toUpperCase();
    if (cat) ownedCategories.add(cat);
  }
  const housing = (primaryAddress?.ownership || "").toUpperCase();

  // Engine-derived, profile/address-aware essentials — the SAME tier + relevance
  // logic the ranked recommendations use, instead of a hardcoded list. CRITICAL
  // first, then IMPORTANT: the AI card surfaces only what matters; RECOMMENDED +
  // OPTIONAL stay in the normal recommendation lists. Profile-irrelevant
  // categories (auto insurance for a car-less renter, school for a childless
  // mover) are gated out, so the card is address-aware and auto-closes a category
  // the moment the user adds a service/provider for it.
  const engineProfile: UserProfile = {
    hasChildren: Boolean(user?.profile?.hasChildren),
    childrenCount: 0,
    hasPets: Boolean(user?.profile?.hasPets),
    hasSenior: Boolean(user?.profile?.hasSenior),
    carCount: Math.max(0, Math.floor(user?.profile?.carCount ?? 0)),
    hasDisability: false,
    needsStorage: Boolean(user?.profile?.needsStorage),
    hasMotorcycle: false,
    hasBoatRV: false,
    isMilitary: Boolean(user?.profile?.isMilitary),
    isBusinessOwner: Boolean(user?.profile?.isBusinessOwner),
    moveType: user?.profile?.moveType ?? undefined,
    // Address tenure → engine ownership so home- vs renters-insurance gate
    // correctly (a known owner is never told to buy renters insurance).
    ownership:
      housing === "OWNER" || housing === "OWN"
        ? "OWN"
        : housing === "RENTER" || housing === "RENT"
          ? "RENT"
          : undefined,
  };

  const { critical, important } = getEssentialSetupCategories(engineProfile, ownedCategories);

  // { category, label } pairs, de-duped by merged display label, CRITICAL ahead
  // of IMPORTANT. The category KEY rides along so each generated action carries a
  // `{type:'category'}` deep-link. buildBriefingSignals slices to the top 6.
  // A merged display group (e.g. "Financial") counts as handled once the user
  // owns ANY fine-grained key in it — so adding a bank closes the whole "Set up
  // financial" suggestion and the next briefing surfaces the next gap, instead of
  // the same label reappearing because a sibling key (e.g. auto insurance) is
  // still technically pending. (getEssentialSetupCategories only skips the EXACT
  // owned key; this closes the whole display group the user already touched.)
  const ownedMergedKeys = new Set<string>();
  for (const c of ownedCategories) ownedMergedKeys.add(getMergedDisplayCategoryKey(c));

  const seenLabels = new Set<string>();
  const missingCritical: Array<{ category: string; label: string }> = [];
  for (const cat of [...critical, ...important]) {
    if (ownedMergedKeys.has(getMergedDisplayCategoryKey(cat))) continue;
    const label = getMergedDisplayCategoryLabel(cat);
    if (seenLabels.has(label)) continue;
    seenLabels.add(label);
    missingCritical.push({ category: cat, label });
  }

  const signals = buildBriefingSignals({
    profile: user?.profile ?? null,
    primaryAddress: primaryAddress ?? null,
    activePlan: activePlan
      ? {
          status: activePlan.status,
          moveDate: activePlan.moveDate,
          toState: activePlan.toAddress?.state ?? null,
        }
      : null,
    missingCritical,
  });

  // Quiet when nothing essential is pending: the user has handled every relevant
  // CRITICAL + IMPORTANT category. Don't spend an AI generation or a budget unit —
  // return a short, reassuring card (empty actions → the client renders just the
  // line). Owner decision: an empty/short card beats a padded one.
  if (missingCritical.length === 0) {
    recordIntegrationOutcome("briefing", "cached");
    const prose =
      "You've set up the essentials for this move — nice work. Browse the recommendations below whenever you want to add optional extras.";
    return NextResponse.json({
      configured: true,
      source: "rule_based",
      aiGenerated: false,
      allEssentialsHandled: true,
      briefing: encodeBriefingString({
        briefing: prose,
        actions: [],
        moveStage: signals.moveStage,
        daysToMoveBucket: signals.daysToMoveBucket,
      }),
      actions: [],
      moveStage: signals.moveStage,
      daysToMoveBucket: signals.daysToMoveBucket,
      cached: false,
    });
  }

  const fingerprint = signalFingerprint(signals);

  // ── Per-user, per-UTC-day cache + daily cap ─────────────────
  const cacheKey = `${userId}:${scope.workspaceId ?? "self"}:${utcDayKey()}`;
  const cached = briefingCacheGet(cacheKey);

  // Same-day repeat with unchanged inputs → cached briefing, no API call.
  if (cached && cached.fingerprint === fingerprint) {
    return cachedResponse(cached);
  }

  // Inputs changed → this is a generation attempt. Consume one unit of today's
  // GLOBAL budget via the shared limiter (Upstash, with in-memory fallback),
  // keyed by user + UTC day so the 3/day cap holds across instances and restarts.
  // One attempt = one unit, success or not — the hammering guard. Same-day
  // unchanged requests above never reach here, so they cost nothing.
  const genGate = await rateLimit(`briefing-gen:${cacheKey}`, {
    limit: DAILY_AI_GENERATION_CAP,
    windowSeconds: 24 * 60 * 60,
  });
  // App-wide daily AI budget (circuit-breaker): when the global cap is set AND
  // exceeded, degrade everyone to the rule-based briefing — protects spend even
  // when each user's own 3/day budget is fine. No cap configured → no effect.
  const aiBudget = await checkGlobalBudget("ai");
  if (!genGate.success || !aiBudget.allowed) {
    // Budget spent: serve today's last briefing if this instance still has it,
    // otherwise a deterministic rule-based briefing (no AI call, no extra spend).
    // Never an error; the next UTC day restores the budget.
    if (cached) return cachedResponse(cached);
    const cappedActions = buildBriefingActions(signals);
    recordIntegrationOutcome("briefing", "cached");
    return NextResponse.json({
      configured: true,
      source: "rule_based",
      aiGenerated: false,
      briefing: encodeBriefingString({
        briefing: buildFallbackBriefing(signals),
        actions: cappedActions,
        moveStage: signals.moveStage,
        daysToMoveBucket: signals.daysToMoveBucket,
      }),
      actions: cappedActions,
      moveStage: signals.moveStage,
      daysToMoveBucket: signals.daysToMoveBucket,
      cached: true,
    });
  }

  // Structured, deep-linked actions (each with a machine-readable `target`) are
  // deterministic and honest — derived server-side from the same signals that
  // built the prompt, never from LLM output, regardless of which path wrote the
  // prose summary.
  const actions = buildBriefingActions(signals);

  // ── Try the LLM for the situation SUMMARY; degrade to the rule-based summary ──
  // The budget unit was already consumed by the gen gate above (success or not).
  // generateLlmBriefing never throws; null means "fall back".
  const aiSummary = await generateLlmBriefing(apiKey, signals);
  let source: "ai" | "rule_based" = "ai";
  let prose: string;
  if (aiSummary) {
    prose = aiSummary;
  } else {
    // Full rule-based briefing (summary + inline actions) keeps a sensible read
    // even if a non-parsing consumer ignores the structured tail.
    prose = buildFallbackBriefing(signals);
    source = "rule_based";
  }

  // Encode prose + structured tail into the single `briefing` string so the
  // existing { briefing: string } transport carries structure to clients that
  // only forward the text (the mobile card parses the tail; web reads `actions`).
  const briefing = encodeBriefingString({
    briefing: prose,
    actions,
    moveStage: signals.moveStage,
    daysToMoveBucket: signals.daysToMoveBucket,
  });

  briefingCacheSet(cacheKey, {
    fingerprint,
    briefing,
    actions,
    moveStage: signals.moveStage,
    daysToMoveBucket: signals.daysToMoveBucket,
    source,
    cachedAt: Date.now(),
  });

  // Fire-and-forget telemetry (synchronous in-process buffer — never throws,
  // never adds latency): 'generated' = the LLM wrote the summary,
  // 'rule_based' = the deterministic fallback did.
  recordIntegrationOutcome("briefing", source === "ai" ? "generated" : "rule_based");

  return NextResponse.json({
    configured: true,
    source,
    aiGenerated: source === "ai",
    briefing,
    actions,
    moveStage: signals.moveStage,
    daysToMoveBucket: signals.daysToMoveBucket,
    cached: false,
  });
}
