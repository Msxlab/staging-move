import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { buildUnifiedEntitlementSnapshot } from "@/lib/billing";
import { profileSchema } from "@/lib/validators";
import { LEGAL_CONSENT_EVENT, LEGAL_CONSENT_VERSION, getDefaultLegalConsents, hasRequiredLegalConsents } from "@/lib/legal";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { getOnboardingProgress, ONBOARDING_PROGRESS_EVENTS, summarizeOnboardingEvents } from "@/lib/onboarding-progress";
import { CANCELED_MOVING_PLAN_STATUSES } from "@locateflow/shared";

function parseStoredLegalConsents(metadata: string | null | undefined) {
  if (!metadata) return null;
  try {
    return getDefaultLegalConsents(JSON.parse(metadata));
  } catch {
    return null;
  }
}

// GET /api/profile
export async function GET() {
  try {
    const userId = await requireDbUserId();

    const [user, consentEvents, addressCount, serviceCount, movingPlanCount, onboardingEvents] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true, subscription: true },
      }),
      prisma.userEvent.findMany({
        where: { userId, event: LEGAL_CONSENT_EVENT },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.address.count({ where: { userId, deletedAt: null } }),
      prisma.service.count({ where: { userId, deletedAt: null, isActive: true } }),
      prisma.movingPlan.count({
        where: {
          userId,
          status: { notIn: [...CANCELED_MOVING_PLAN_STATUSES] },
        },
      }),
      prisma.userEvent.findMany({
        where: { userId, event: { in: [...ONBOARDING_PROGRESS_EVENTS] } },
        select: { event: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

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
    const entitlement = buildUnifiedEntitlementSnapshot(user.subscription);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      profile: user.profile,
      subscription: user.subscription,
      entitlement,
      legalConsents,
      onboardingCompleted: onboardingProgress.completed,
      onboardingStep: onboardingProgress.step,
      onboardingStepIndex: onboardingProgress.stepIndex,
    });
  } catch (error) {
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
    console.error("[PROFILE POST] Auth failed:", err?.message);
    return NextResponse.json({ error: `Auth failed: ${err?.message}` }, { status: 401 });
  }

  // Rate limit: 20 writes per minute
  const rlKey = getRateLimitKey(request, "profile:update");
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
    validated = profileSchema.parse(body);
  } catch (err: any) {
    const details = err?.errors || err?.message;
    return NextResponse.json({ error: "Validation failed", details }, { status: 400 });
  }

  const existingConsentEvent = await prisma.userEvent.findFirst({
    where: { userId, event: LEGAL_CONSENT_EVENT },
    orderBy: { createdAt: "desc" },
  });
  const existingLegalConsents = parseStoredLegalConsents(existingConsentEvent?.metadata);
  const incomingLegalConsents = validated.legalConsents
    ? getDefaultLegalConsents({
        ...validated.legalConsents,
        termsVersion: validated.legalConsents.termsVersion || LEGAL_CONSENT_VERSION,
        disclaimerVersion: validated.legalConsents.disclaimerVersion || LEGAL_CONSENT_VERSION,
        acceptedAt: validated.legalConsents.acceptedAt || new Date().toISOString(),
      })
    : null;

  if (!existingLegalConsents && !hasRequiredLegalConsents(incomingLegalConsents)) {
    return NextResponse.json({ error: "You must accept the Terms of Use and Disclaimer before continuing." }, { status: 400 });
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
    return NextResponse.json({ error: `User update failed: ${err?.message}` }, { status: 500 });
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
    };

    const profile = await prisma.profile.upsert({
      where: { userId },
      create: { userId, ...profileData },
      update: profileData,
    });

    if (hasRequiredLegalConsents(incomingLegalConsents)) {
      const shouldRecordConsent = !existingLegalConsents
        || existingLegalConsents.acceptedAt !== incomingLegalConsents.acceptedAt
        || existingLegalConsents.termsVersion !== incomingLegalConsents.termsVersion
        || existingLegalConsents.disclaimerVersion !== incomingLegalConsents.disclaimerVersion;

      if (shouldRecordConsent) {
        await prisma.userEvent.create({
          data: {
            userId,
            event: LEGAL_CONSENT_EVENT,
            page: request.nextUrl.pathname,
            metadata: JSON.stringify(incomingLegalConsents),
          },
        });
      }
    }

    return NextResponse.json({ profile, legalConsents: incomingLegalConsents || existingLegalConsents }, { status: 200 });
  } catch (err: any) {
    console.error("[PROFILE POST] Profile upsert failed:", err?.message);
    return NextResponse.json({ error: `Profile save failed: ${err?.message}` }, { status: 500 });
  }
}
