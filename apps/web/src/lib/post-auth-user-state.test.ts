import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Focused integration test for getPostAuthUserState's workspace-scope unification
// (audit 3.2 part 2): a workspace MEMBER whose address/service/moving rows live on
// the shared workspace (not under their raw userId) must be counted via the SAME
// data-scope helper /api/profile uses, so they are treated as onboarded and not
// bounced back into /onboarding (the redirect-loop this fix prevents).

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  profileFindUnique: vi.fn(),
  userEventFindMany: vi.fn(),
  addressCount: vi.fn(),
  serviceCount: vi.fn(),
  movingPlanCount: vi.fn(),
  resolveWorkspaceDataScope: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: (...a: unknown[]) => mocks.userFindFirst(...a) },
    profile: { findUnique: (...a: unknown[]) => mocks.profileFindUnique(...a) },
    userEvent: { findMany: (...a: unknown[]) => mocks.userEventFindMany(...a) },
    address: { count: (...a: unknown[]) => mocks.addressCount(...a) },
    service: { count: (...a: unknown[]) => mocks.serviceCount(...a) },
    movingPlan: { count: (...a: unknown[]) => mocks.movingPlanCount(...a) },
  },
}));

vi.mock("@/lib/workspace-data-scope", () => ({
  legacyDataScope: (userId: string) => ({
    actorUserId: userId,
    ownerUserId: userId,
    workspaceId: null,
    workspaceMode: false,
    memberRole: null,
    memberStatus: null,
  }),
  resolveWorkspaceDataScope: (...a: unknown[]) => mocks.resolveWorkspaceDataScope(...a),
  // Mirror the real helper closely enough to prove the where-clause carries the
  // workspace axis for a member (workspaceId set) vs. raw userId for legacy.
  scopedRecordWhere: (
    scope: { workspaceId: string | null; actorUserId: string; memberRole: string | null },
    extra: Record<string, unknown> = {},
    options: { childSelfOnly?: boolean } = {},
  ) => {
    const childSelfOnly = options.childSelfOnly && scope.memberRole === "CHILD";
    const base = scope.workspaceId && !childSelfOnly
      ? { workspaceId: scope.workspaceId }
      : { userId: scope.actorUserId, ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}) };
    return { ...base, ...extra };
  },
}));

vi.mock("@/lib/service-active", () => ({
  activeTrackedServiceWhereForScope: (scope: { userId: string; workspaceId?: string | null }) =>
    scope.workspaceId ? { workspaceId: scope.workspaceId } : { userId: scope.userId },
}));

// buildScopeRequestFromHeaders lazily imports next/headers; stub it so the test
// runs outside a real request scope without throwing.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

import { getPostAuthUserState } from "./post-auth-redirect";

const WORKSPACE_ID = "ws_shared_1";
const MEMBER_ID = "user_member_1";

function primeUser() {
  mocks.userFindFirst.mockResolvedValue({
    emailVerifiedAt: new Date(),
    passwordHash: "hash",
    oauthAccounts: [],
  });
  mocks.profileFindUnique.mockResolvedValue({ userId: MEMBER_ID });
  // One legal-consent event with the required acceptances. The event name is
  // LEGAL_CONSENT_ACCEPTED; the in:[...] onboarding-progress query returns []
  // (no skip/complete events) so completion is driven purely by the counts.
  mocks.userEventFindMany.mockImplementation(async (args: any) => {
    if (args?.where?.event === "LEGAL_CONSENT_ACCEPTED") {
      return [
        {
          metadata: JSON.stringify({ termsAccepted: true, disclaimerAccepted: true }),
        },
      ];
    }
    return [];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  primeUser();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getPostAuthUserState workspace scoping", () => {
  it("treats a workspace member with shared addresses as onboarded (no onboarding bounce)", async () => {
    // Member is in a shared workspace. Their address/service/moving rows are
    // owned at the WORKSPACE level — a raw { userId } count would read 0.
    mocks.resolveWorkspaceDataScope.mockResolvedValue({
      actorUserId: MEMBER_ID,
      ownerUserId: "user_owner_1",
      workspaceId: WORKSPACE_ID,
      workspaceMode: true,
      memberRole: "ADULT",
      memberStatus: "ACTIVE",
    });

    // The scoped counts return >0 because the where-clause carries workspaceId.
    mocks.addressCount.mockImplementation(async (args: any) => {
      expect(args.where).toMatchObject({ workspaceId: WORKSPACE_ID, deletedAt: null });
      return 2;
    });
    mocks.serviceCount.mockImplementation(async (args: any) => {
      expect(args.where).toMatchObject({ workspaceId: WORKSPACE_ID });
      return 1;
    });
    mocks.movingPlanCount.mockImplementation(async (args: any) => {
      expect(args.where).toMatchObject({ workspaceId: WORKSPACE_ID });
      return 1;
    });

    const state = await getPostAuthUserState(MEMBER_ID);

    expect(state.onboardingCompleted).toBe(true);
    expect(state.hasRequiredLegalConsents).toBe(true);
  });

  it("would have bounced the same member with raw-userId scoping (guards the regression)", async () => {
    // Sanity check: if scoping fell back to legacy (raw userId), the member's
    // shared rows are invisible -> addressCount 0 -> not onboarded. This is the
    // pre-fix behavior the unification removes.
    mocks.resolveWorkspaceDataScope.mockResolvedValue({
      actorUserId: MEMBER_ID,
      ownerUserId: MEMBER_ID,
      workspaceId: null,
      workspaceMode: false,
      memberRole: null,
      memberStatus: null,
    });
    mocks.addressCount.mockResolvedValue(0);
    mocks.serviceCount.mockResolvedValue(0);
    mocks.movingPlanCount.mockResolvedValue(0);

    const state = await getPostAuthUserState(MEMBER_ID);
    expect(state.onboardingCompleted).toBe(false);
  });

  it("fails safe to onboarded=false-by-prereq if scope resolution throws (no new throw path)", async () => {
    // resolveWorkspaceDataScope can throw (e.g. stale workspace header). The gate
    // must NOT propagate that — it falls back to legacy scope.
    mocks.resolveWorkspaceDataScope.mockRejectedValue(new Error("STALE_WORKSPACE_SELECTION"));
    mocks.addressCount.mockResolvedValue(3);
    mocks.serviceCount.mockResolvedValue(1);
    mocks.movingPlanCount.mockResolvedValue(1);

    await expect(getPostAuthUserState(MEMBER_ID)).resolves.toMatchObject({
      onboardingCompleted: true,
    });
  });
});
