import { prisma } from "@/lib/db";
import {
  LEGAL_CONSENT_EVENT,
  getDefaultLegalConsents,
  hasRequiredLegalConsents,
} from "@/lib/legal";
import { normalizeAppRedirectPath } from "@/lib/safe-redirect";
import {
  buildEmailVerificationGateRedirect,
  needsEmailVerificationGate,
} from "@/lib/email-verification-gate";
import {
  getOnboardingProgress,
  ONBOARDING_PROGRESS_EVENTS,
  summarizeOnboardingEvents,
} from "@/lib/onboarding-progress";
import { CANCELED_MOVING_PLAN_STATUSES } from "@locateflow/shared";

export interface PostAuthUserState {
  needsEmailVerification: boolean;
  needsPasswordSetup: boolean;
  hasRequiredLegalConsents: boolean;
  onboardingCompleted: boolean;
}

function parseStoredLegalConsents(metadata: string | null | undefined) {
  if (!metadata) return null;
  try {
    return getDefaultLegalConsents(JSON.parse(metadata));
  } catch {
    return null;
  }
}

export function resolvePostAuthRedirect(
  userState: PostAuthUserState,
  requestedRedirect?: string | null,
): string {
  const safeRedirect = normalizeAppRedirectPath(requestedRedirect, "/dashboard");

  if (userState.needsEmailVerification) {
    return buildEmailVerificationGateRedirect(safeRedirect);
  }

  if (userState.needsPasswordSetup) {
    const afterPasswordSetup = resolvePostAuthRedirect(
      { ...userState, needsPasswordSetup: false },
      requestedRedirect,
    );
    return `/account/setup-password?redirect=${encodeURIComponent(afterPasswordSetup)}`;
  }

  if (!userState.hasRequiredLegalConsents) {
    return "/onboarding?step=legal";
  }

  if (!userState.onboardingCompleted) {
    return "/onboarding";
  }

  if (safeRedirect === "/onboarding" || safeRedirect.startsWith("/onboarding?")) {
    return "/dashboard";
  }

  return safeRedirect;
}

export function resolveOnboardingGateRedirect(
  userState: PostAuthUserState,
  requestedRedirect = "/onboarding",
): string | null {
  const safeRedirect = normalizeAppRedirectPath(requestedRedirect, "/onboarding");

  if (userState.needsEmailVerification) {
    return buildEmailVerificationGateRedirect(safeRedirect);
  }

  if (userState.needsPasswordSetup) {
    return `/account/setup-password?redirect=${encodeURIComponent(safeRedirect)}`;
  }

  if (userState.onboardingCompleted) {
    return "/dashboard";
  }

  return null;
}

export async function getPostAuthUserState(userId: string): Promise<PostAuthUserState> {
  const [
    user,
    profile,
    consentEvents,
    addressCount,
    serviceCount,
    movingPlanCount,
    onboardingEvents,
  ] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        emailVerifiedAt: true,
        passwordHash: true,
        oauthAccounts: { select: { id: true }, take: 1 },
      },
    }),
    prisma.profile.findUnique({ where: { userId } }),
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
    throw new Error("AUTH_STATE_USER_UNAVAILABLE");
  }

  const hasRequiredLegalConsentsValue = consentEvents.some((event) =>
    hasRequiredLegalConsents(parseStoredLegalConsents(event.metadata)),
  );
  const onboardingProgress = getOnboardingProgress({
    hasProfile: Boolean(profile),
    hasRequiredLegalConsents: hasRequiredLegalConsentsValue,
    addressCount,
    serviceCount,
    movingPlanCount,
    ...summarizeOnboardingEvents(onboardingEvents),
  });

  return {
    needsEmailVerification: needsEmailVerificationGate(user),
    needsPasswordSetup: Boolean(user.oauthAccounts.length > 0 && !user.passwordHash),
    hasRequiredLegalConsents: hasRequiredLegalConsentsValue,
    onboardingCompleted: onboardingProgress.completed,
  };
}
