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
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";
import {
  legacyDataScope,
  resolveWorkspaceDataScope,
  scopedRecordWhere,
  type WorkspaceDataScope,
} from "@/lib/workspace-data-scope";
import { CANCELED_MOVING_PLAN_STATUSES } from "@locateflow/shared";

// Build a Request carrying the caller's workspace selection (lf_workspace_id
// cookie / X-Workspace-Id header) so resolveWorkspaceDataScope can resolve the
// active workspace when getPostAuthUserState is invoked from a server component
// or route handler that didn't thread its own Request through. Best-effort and
// non-throwing: outside a request scope (or with no cookies) this returns a
// neutral placeholder Request, which resolveWorkspaceDataScope maps to the
// legacy single-user scope — preserving today's behavior. next/headers is
// imported lazily so this module stays usable in plain unit tests that mock the
// data layer and never enter a request scope.
async function buildScopeRequestFromHeaders(): Promise<Request> {
  try {
    const { headers } = await import("next/headers");
    const headerStore = await headers();
    const forwarded = new Headers();
    const cookie = headerStore.get("cookie");
    if (cookie) forwarded.set("cookie", cookie);
    const workspaceId = headerStore.get("x-workspace-id");
    if (workspaceId) forwarded.set("x-workspace-id", workspaceId);
    return new Request("http://locateflow.local", { headers: forwarded });
  } catch {
    return new Request("http://locateflow.local");
  }
}

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

  // OAuth-only accounts (no password) are NOT hard-forced to the password
  // screen. Setting a password is an email-link flow they can opt into from
  // the account security screen; `needsPasswordSetup` only drives an optional
  // in-app prompt. See SCOPE W-01/M-01.

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

  // OAuth-only accounts without a password are allowed through this gate; the
  // setup-password screen is opt-in, not a hard block. See SCOPE W-01/M-01.

  if (userState.onboardingCompleted) {
    return "/dashboard";
  }

  return null;
}

export async function getPostAuthUserState(
  userId: string,
  request?: Request,
): Promise<PostAuthUserState> {
  // Scope the onboarding prerequisite counts the SAME way /api/profile and the
  // /api/onboarding/progress gate do, so a workspace MEMBER's address/service/
  // moving-plan counts include shared-workspace rows. Without this, a member with
  // only shared (not personally-owned) addresses would read addressCount===0 here
  // while /api/profile reads it as >0 — bouncing them back into onboarding even
  // though the wizard considers them done (the redirect-loop this fix prevents).
  //
  // When the workspace model flag is OFF (the common, single-user case),
  // resolveWorkspaceDataScope returns legacyDataScope(userId) and scopedRecordWhere
  // collapses to { userId, ... } — byte-identical to the previous raw-userId
  // queries, so behavior is preserved. A real incoming Request carries the
  // workspace cookie/header; callers without one get a neutral placeholder
  // (mirrors /api/profile), which also resolves to the legacy scope.
  // Fail SAFE to the legacy single-user scope if workspace resolution throws
  // (e.g. a stale workspace header). This gate must never gain a new throw path:
  // a thrown ApiGateError here would escape into the layout's redirect logic and
  // could break the gate or loop. Falling back to legacy scope at worst reverts
  // this member to the prior raw-userId behavior — never worse than today.
  let scope: WorkspaceDataScope;
  try {
    const scopeRequest = request ?? (await buildScopeRequestFromHeaders());
    scope = await resolveWorkspaceDataScope(scopeRequest, userId);
  } catch {
    scope = legacyDataScope(userId);
  }

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
    prisma.address.count({
      where: scopedRecordWhere(scope, { deletedAt: null }, { childSelfOnly: true }),
    }),
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
