import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import {
  buildUnifiedEntitlementSnapshot,
  findSubscriptionForEntitlement,
} from "@/lib/billing";
import { profileSchema } from "@/lib/validators";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { CONSUMER_FREE_FLAG } from "@locateflow/shared";
import { LEGAL_CONSENT_EVENT, getDefaultLegalConsents, hasRequiredLegalConsents } from "@/lib/legal";
import { normalizeAcceptedLegalConsents, recordLegalAcceptance } from "@/lib/legal-acceptance";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { getOnboardingProgress, ONBOARDING_PROGRESS_EVENTS, summarizeOnboardingEvents } from "@/lib/onboarding-progress";
import { CANCELED_MOVING_PLAN_STATUSES } from "@locateflow/shared";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";
import { resolveWorkspaceDataScope, scopedRecordWhere } from "@/lib/workspace-data-scope";

function parseStoredLegalConsents(metadata: string | null | undefined) {
  if (!metadata) return null;
  try {
    return getDefaultLegalConsents(JSON.parse(metadata));
  } catch {
    return null;
  }
}

function sanitizeSubscriptionForClient<T extends Record<string, unknown> | null>(subscription: T): T {
  if (!subscription) return subscription;
  const safe = { ...subscription };
  delete safe.purchaseToken;
  delete safe.purchaseTokenHash;
  return safe as T;
}

async function hasCurrentDataConsent(userId: string, category: string): Promise<boolean> {
  const consent = await prisma.dataConsent.findFirst({
    where: { userId, category },
    orderBy: { createdAt: "desc" },
    select: { granted: true },
  });
  return consent?.granted === true;
}

// GET /api/profile
export async function GET(request?: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const scopeRequest = request ?? new Request("http://locateflow.local");
    const scope = await resolveWorkspaceDataScope(scopeRequest, userId);

    const [
      user,
      subscription,
      consentEvents,
      addressCount,
      serviceCount,
      movingPlanCount,
      onboardingEvents,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      }),
      findSubscriptionForEntitlement(userId),
      prisma.userEvent.findMany({
        where: { userId, event: LEGAL_CONSENT_EVENT },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.address.count({ where: scopedRecordWhere(scope, { deletedAt: null }, { childSelfOnly: true }) }),
      prisma.service.count({
        where: activeTrackedServiceWhereForScope(
          { userId, workspaceId: scope.workspaceId },
          scope.memberRole === "CHILD" ? { userId } : {},
        ),
      }),
      prisma.movingPlan.count({
        where: scopedRecordWhere(
          scope,
          { deletedAt: null, status: { notIn: [...CANCELED_MOVING_PLAN_STATUSES] } },
          { childSelfOnly: true },
        ),
      }),
      prisma.userEvent.findMany({
        where: { userId, event: { in: [...ONBOARDING_PROGRESS_EVENTS] } },
        select: { event: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const entitlementSubscription =
      scope.workspaceId && scope.ownerUserId !== userId
        ? await findSubscriptionForEntitlement(scope.ownerUserId)
        : subscription;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const legalConsents = consentEvents
      .map((event) => parseStoredLegalConsents(event.metadata))
      .find((consents) => hasRequiredLegalConsents(consents))
      || parseStoredLegalConsents(consentEvents[0]?.metadata);
    const hasLegal = consentEvents.some((event) =>
      hasRequiredLegalConsents(parseStoredLegalConsents(event.metadata)),
    );
    const onboardingProgress = getOnboardingProgress({
      hasProfile: Boolean(user.profile),
      hasRequiredLegalConsents: hasLegal,
      addressCount,
      serviceCount,
      movingPlanCount,
      ...summarizeOnboardingEvents(onboardingEvents),
    });
    // CONSUMER_FREE: under the free-for-all pivot, the snapshot that the web
    // client AND mobile read (planTier / isPremium) resolves a pure free / no-row
    // consumer to active PRO. H3-safe — real or lapsed stripe/store/admin rows
    // pass through unchanged. Flag off (default) → no change.
    const consumerFree = await isFeatureEnabled(CONSUMER_FREE_FLAG);
    const entitlement = buildUnifiedEntitlementSnapshot(entitlementSubscription, {
      consumerFree,
    });
    const safeSubscription = sanitizeSubscriptionForClient(subscription);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      profile: user.profile,
      subscription: safeSubscription,
      entitlement,
      workspaceEntitlement: scope.workspaceId
        ? { workspaceId: scope.workspaceId, inherited: scope.ownerUserId !== userId }
        : null,
      legalConsents,
      onboardingCompleted: onboardingProgress.completed,
      onboardingStep: onboardingProgress.step,
      onboardingStepIndex: onboardingProgress.stepIndex,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("Failed to fetch profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

// POST /api/profile – create or update profile + user name
export async function POST(request: NextRequest) {
  // Step 1: Auth
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch (err: any) {
    const status = err?.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Unauthorized" }, { status });
  }

  // Rate limit: 20 writes per minute
  const rlKey = getRateLimitKey(request, "profile:update", { userId });
  const rl = await rateLimit(rlKey, { limit: 20, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  // Step 2: Parse body
  let body: any;
  try {
    body = await request.json();
  } catch (err: any) {
    return NextResponse.json({ error: `Invalid JSON body: ${err?.message}` }, { status: 400 });
  }

  // Step 3: Validate
  let validated: any;
  try {
    const { legalConsents: _legalConsents, ...profileBody } = body || {};
    validated = profileSchema.parse(profileBody);
  } catch (err: any) {
    const details = err?.errors || err?.message;
    return NextResponse.json({ error: "Validation failed", details }, { status: 400 });
  }

  const existingConsentEvent = await prisma.userEvent.findFirst({
    where: { userId, event: LEGAL_CONSENT_EVENT },
    orderBy: { createdAt: "desc" },
  });
  let existingLegalConsents = parseStoredLegalConsents(existingConsentEvent?.metadata);

  if (!hasRequiredLegalConsents(existingLegalConsents)) {
    const acceptedLegalConsents = normalizeAcceptedLegalConsents(body?.legalConsents);
    if (acceptedLegalConsents) {
      await recordLegalAcceptance({
        userId,
        request,
        page: "/onboarding",
        source: "profile_fallback",
        consents: acceptedLegalConsents,
      });
      existingLegalConsents = acceptedLegalConsents;
    } else {
      return NextResponse.json(
        { error: "You must accept the Terms of Use and Disclaimer before continuing.", code: "LEGAL_ACCEPTANCE_REQUIRED" },
        { status: 400 },
      );
    }
  }

  const storesSensitiveProfileData =
    validated.hasDisability === true ||
    validated.isImmigrant === true ||
    validated.isMilitary === true ||
    Boolean(validated.immigrationStatus);
  if (storesSensitiveProfileData && !(await hasCurrentDataConsent(userId, "SENSITIVE"))) {
    return NextResponse.json(
      {
        error: "Sensitive profile consent is required before saving disability or immigration information.",
        code: "SENSITIVE_CONSENT_REQUIRED",
      },
      { status: 400 },
    );
  }

  // Step 4: Update user name
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: validated.firstName,
        lastName: validated.lastName,
      },
    });
  } catch (err: any) {
    console.error("[PROFILE POST] User update failed:", err?.message);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  // Step 5: Upsert profile
  try {
    const profileData = {
      ageRange: validated.ageRange || null,
      familyStatus: validated.familyStatus,
      hasChildren: validated.hasChildren,
      childrenCount: validated.childrenCount,
      hasPets: validated.hasPets,
      petTypes: JSON.stringify(validated.petTypes),
      carCount: validated.carCount,
      hasMotorcycle: validated.hasMotorcycle,
      hasBoatRV: validated.hasBoatRV,
      needsStorage: validated.needsStorage,
      hasSenior: validated.hasSenior,
      hasDisability: validated.hasDisability,
      isMilitary: validated.isMilitary,
      moveType: validated.moveType || "PERSONAL",
      isBusinessOwner: validated.moveType === "BUSINESS" ? validated.isBusinessOwner : false,
      isImmigrant: validated.isImmigrant,
      immigrationStatus: validated.immigrationStatus || null,
    };

    const profile = await prisma.profile.upsert({
      where: { userId },
      create: { userId, ...profileData },
      update: profileData,
    });

    return NextResponse.json({ profile, legalConsents: existingLegalConsents }, { status: 200 });
  } catch (err: any) {
    console.error("[PROFILE POST] Profile upsert failed:", err?.message);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
