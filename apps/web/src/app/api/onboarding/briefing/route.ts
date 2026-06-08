import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { resolveWorkspaceDataScope, scopedRecordWhere } from "@/lib/workspace-data-scope";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";
import { CANCELED_MOVING_PLAN_STATUSES } from "@locateflow/shared";
import { getMergedDisplayCategoryLabel } from "@/lib/recommendation-engine";
import {
  buildBriefingSignals,
  buildFallbackBriefing,
  generateLlmBriefing,
  type BriefingSignals,
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
 * Per-user in-memory cache. The briefing is derived from stable onboarding
 * signals, so it is safe to cache for the session lifetime of the process and
 * return the cached value on repeat calls. Keyed by userId + a coarse signal
 * fingerprint so it self-invalidates if the user's signals materially change.
 */
interface CachedBriefing {
  fingerprint: string;
  briefing: string;
  source: "ai" | "rule_based";
  cachedAt: number;
}
const briefingCache = new Map<string, CachedBriefing>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — briefing is stable

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
    signals.missingCriticalLabels,
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

  const missingCriticalLabels = essentials
    .filter((cat) => !ownedCategories.has(cat))
    .map((cat) => getMergedDisplayCategoryLabel(cat))
    .filter((label, i, arr) => arr.indexOf(label) === i); // de-dupe merged labels

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
    missingCriticalLabels,
  });

  const fingerprint = signalFingerprint(signals);

  // ── Per-user cache (briefing is stable) ─────────────────────
  const cacheKey = scope.workspaceId ? `${userId}:${scope.workspaceId}` : userId;
  const cached = briefingCache.get(cacheKey);
  if (
    cached &&
    cached.fingerprint === fingerprint &&
    Date.now() - cached.cachedAt < CACHE_TTL_MS
  ) {
    return NextResponse.json({
      configured: true,
      source: cached.source,
      aiGenerated: cached.source === "ai",
      briefing: cached.briefing,
      cached: true,
    });
  }

  // ── Gate on ANTHROPIC_API_KEY ───────────────────────────────
  const apiKey = (await getRuntimeConfigValue("ANTHROPIC_API_KEY").catch(() => null))?.trim() || null;

  // Not configured → tell the UI to hide the AI section. We do NOT 500; the
  // briefing is a nice-to-have layered on top of the deterministic dashboard.
  if (!apiKey) {
    return NextResponse.json({ configured: false });
  }

  // ── Try the LLM; degrade to the rule-based fallback on any failure ──
  let briefing = await generateLlmBriefing(apiKey, signals);
  let source: "ai" | "rule_based" = "ai";
  if (!briefing) {
    briefing = buildFallbackBriefing(signals);
    source = "rule_based";
  }

  briefingCache.set(cacheKey, {
    fingerprint,
    briefing,
    source,
    cachedAt: Date.now(),
  });

  return NextResponse.json({
    configured: true,
    source,
    aiGenerated: source === "ai",
    briefing,
    cached: false,
  });
}
