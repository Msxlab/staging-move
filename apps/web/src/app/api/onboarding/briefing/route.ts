import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { resolveWorkspaceDataScope, scopedRecordWhere } from "@/lib/workspace-data-scope";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";
import { getUserPlan } from "@/lib/plan-limits";
import { CANCELED_MOVING_PLAN_STATUSES, planFeatures } from "@locateflow/shared";
import { getMergedDisplayCategoryLabel } from "@/lib/recommendation-engine";
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
 * Universal "essential setup" categories used to derive a coarse
 * missing-critical count for the rule-based fallback briefing. This is a small,
 * self-contained list (NOT sourced from the recommendation engine internals, so
 * the engine stays untouched). Housing-tenure-specific insurance is resolved at
 * request time. These are catalog categories, never PII.
 */
const ESSENTIAL_CATEGORIES_BASE = [
  "GOVERNMENT_POSTAL", // change of address
  "UTILITY_ELECTRIC",
  "UTILITY_INTERNET",
  "FINANCIAL_BANK",
] as const;

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
  /** AI generation attempts consumed for this user today (UTC). */
  generationCount: number;
  cachedAt: number;
}
const briefingCache = new Map<string, CachedBriefing>();
/** Hard per-user cap on Anthropic API attempts per UTC day. */
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
  const [apiKeyValue, userPlan] = await Promise.all([
    getRuntimeConfigValue("ANTHROPIC_API_KEY").catch(() => null),
    getUserPlan(userId),
  ]);
  const apiKey = apiKeyValue?.trim() || null;

  // Not configured → tell the UI to hide the AI section. We do NOT 500; the
  // briefing is a nice-to-have layered on top of the deterministic dashboard.
  // Checked BEFORE the plan gate so a keyless deployment never dangles an
  // upgrade CTA for a feature nobody on it can have.
  if (!apiKey) {
    return NextResponse.json({ configured: false });
  }

  // Paid-plan gate (owner decision): the AI briefing is INDIVIDUAL and up.
  // FREE/FREE_TRIAL get a value-first upgrade teaser instead. HTTP 200 — never
  // 403 — so old clients (which require a string `briefing`) fail soft to the
  // deterministic dashboard instead of erroring.
  if (!planFeatures(userPlan.plan).aiBriefing) {
    return NextResponse.json({
      configured: true,
      entitled: false,
      upgradeRequired: "AI_BRIEFING_UPGRADE_REQUIRED",
    });
  }

  // ── Gather coarse, non-PII signals from the user's own data ──
  const scope = await resolveWorkspaceDataScope(request, userId);

  const [user, activePlan, activeServices] = await Promise.all([
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
  ]);

  // Primary address (for coarse state + housing tenure). Best-effort.
  const primaryAddress = await prisma.address
    .findFirst({
      where: scopedRecordWhere(scope, { deletedAt: null }, { childSelfOnly: true }),
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: { state: true, ownership: true },
    })
    .catch(() => null);

  // Derive missing-critical labels (coarse catalog labels — never PII).
  const ownedCategories = new Set(
    activeServices.map((s) => (s.category || "").toUpperCase()),
  );
  const housing = (primaryAddress?.ownership || "").toUpperCase();
  const essentials = [...ESSENTIAL_CATEGORIES_BASE] as string[];
  // Tenure-appropriate insurance is an essential when we know the tenure.
  if (housing === "OWNER") essentials.push("FINANCIAL_INSURANCE_HOME");
  else if (housing === "RENTER") essentials.push("FINANCIAL_INSURANCE_RENTERS");

  // { category, label } pairs for still-pending essentials, de-duped by the
  // merged display label (so two raw categories that render to the same label
  // don't double up). The category KEY rides along so each generated action can
  // carry a `{type:'category'}` deep-link. Catalog enum values — never PII.
  const seenLabels = new Set<string>();
  const missingCritical: Array<{ category: string; label: string }> = [];
  for (const cat of essentials) {
    if (ownedCategories.has(cat)) continue;
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

  const fingerprint = signalFingerprint(signals);

  // ── Per-user, per-UTC-day cache + daily cap ─────────────────
  const cacheKey = `${userId}:${scope.workspaceId ?? "self"}:${utcDayKey()}`;
  const cached = briefingCacheGet(cacheKey);

  // Same-day repeat with unchanged inputs → cached briefing, no API call.
  if (cached && cached.fingerprint === fingerprint) {
    return cachedResponse(cached);
  }

  // Inputs changed but today's AI budget is spent → keep serving today's last
  // briefing rather than burning another generation. Never an error; the next
  // UTC day (new cache key) restores the budget.
  if (cached && cached.generationCount >= DAILY_AI_GENERATION_CAP) {
    return cachedResponse(cached);
  }

  // Structured, deep-linked actions (each with a machine-readable `target`) are
  // deterministic and honest — derived server-side from the same signals that
  // built the prompt, never from LLM output, regardless of which path wrote the
  // prose summary.
  const actions = buildBriefingActions(signals);

  // ── Try the LLM for the situation SUMMARY; degrade to the rule-based summary ──
  // One attempt = one unit of today's budget, success or not — that is the
  // hammering guard. generateLlmBriefing never throws; null means "fall back".
  const generationCount = (cached?.generationCount ?? 0) + 1;
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
    generationCount,
    cachedAt: Date.now(),
  });

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
