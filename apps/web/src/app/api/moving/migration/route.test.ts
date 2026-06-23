import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    movingPlan: { findFirst: vi.fn() },
    service: { findMany: vi.fn() },
    serviceProvider: { findMany: vi.fn() },
    profile: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

// Mock ONLY the scope resolver so the real scopedRecordWhere /
// assertScopedRecordAction logic still runs against the returned scope. This
// pins the intended where-clause + ownership behavior rather than the mock's.
// vi.hoisted lets the mock fn exist before the hoisted vi.mock factory runs.
const { resolveWorkspaceDataScopeMock } = vi.hoisted(() => ({
  resolveWorkspaceDataScopeMock: vi.fn(),
}));
vi.mock("@/lib/workspace-data-scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/workspace-data-scope")>(
    "@/lib/workspace-data-scope",
  );
  return {
    ...actual,
    resolveWorkspaceDataScope: resolveWorkspaceDataScopeMock,
  };
});

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "moving-migration-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/plan-limits", () => ({
  canGenerateMoveTasks: vi.fn(),
}));

vi.mock("@/lib/provider-serviceability", () => ({
  enrichProviderServiceability: vi.fn(async () => ({
    fcc: { status: "skipped", confirmedCount: 0, blockGeoid: null },
    electric: { status: "skipped", confirmedCount: 0, utilityCount: 0 },
  })),
  applyProviderServiceabilityConfidence: vi.fn((provider, confidence) =>
    provider.fccServiceable || provider.utilityServiceable ? "AVAILABLE_AT_ADDRESS" : confidence,
  ),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { canGenerateMoveTasks } from "@/lib/plan-limits";
import {
  applyProviderServiceabilityConfidence,
  enrichProviderServiceability,
} from "@/lib/provider-serviceability";
import { GET } from "./route";

const requireDbUserIdMock = requireDbUserId as unknown as Mock;
const rateLimitMock = rateLimit as unknown as Mock;
const canGenerateMoveTasksMock = canGenerateMoveTasks as unknown as Mock;
const movingPlanMock = prisma.movingPlan as unknown as { findFirst: Mock };
const serviceMock = prisma.service as unknown as { findMany: Mock };
const serviceProviderMock = prisma.serviceProvider as unknown as { findMany: Mock };
const profileMock = prisma.profile as unknown as { findUnique: Mock };
const enrichProviderServiceabilityMock = enrichProviderServiceability as unknown as Mock;
const applyProviderServiceabilityConfidenceMock = applyProviderServiceabilityConfidence as unknown as Mock;

function request() {
  return new NextRequest("https://locateflow.com/api/moving/migration?planId=plan-1");
}

function legacyScope(userId: string) {
  return {
    actorUserId: userId,
    ownerUserId: userId,
    workspaceId: null,
    workspaceMode: false,
    memberRole: null,
    memberStatus: null,
  };
}

// A workspace member (not the owner) viewing the shared plan. memberRole VIEW_ONLY
// is enough for the "address.view" action used by the migration route.
function memberScope(actorUserId: string, ownerUserId: string, workspaceId: string) {
  return {
    actorUserId,
    ownerUserId,
    workspaceId,
    workspaceMode: true,
    memberRole: "VIEW_ONLY" as const,
    memberStatus: "ACTIVE" as const,
  };
}

describe("moving migration auth handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireDbUserIdMock.mockResolvedValue("user-1");
    // Default to the single-user (no-workspace) scope so existing assertions
    // keep observing the legacy { userId } where-clause.
    resolveWorkspaceDataScopeMock.mockImplementation((_request: unknown, userId: string) =>
      Promise.resolve(legacyScope(userId)),
    );
    canGenerateMoveTasksMock.mockResolvedValue({ allowed: true });
    movingPlanMock.findFirst.mockResolvedValue(null);
    serviceMock.findMany.mockResolvedValue([]);
    serviceProviderMock.findMany.mockResolvedValue([]);
    profileMock.findUnique.mockResolvedValue(null);
    enrichProviderServiceabilityMock.mockImplementation(async (providers: any[]) => {
      for (const provider of providers) {
        if (provider.id === "dest-xfinity") provider.fccServiceable = true;
      }
      return {
        fcc: { status: "ok", confirmedCount: 1, blockGeoid: "484530011001" },
        electric: { status: "skipped", confirmedCount: 0, utilityCount: 0 },
      };
    });
    applyProviderServiceabilityConfidenceMock.mockImplementation((provider, confidence) =>
      provider.fccServiceable || provider.utilityServiceable ? "AVAILABLE_AT_ADDRESS" : confidence,
    );
  });

  it("returns the auth gate response before migration analysis work when unauthenticated", async () => {
    requireDbUserIdMock.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(rateLimitMock).not.toHaveBeenCalled();
    expect(movingPlanMock.findFirst).not.toHaveBeenCalled();
  });

  it("blocks free users before provider migration analysis work", async () => {
    canGenerateMoveTasksMock.mockResolvedValueOnce({
      allowed: false,
      code: "MOVING_PLAN_UPGRADE_REQUIRED",
      reason: "Upgrade to create a full moving plan.",
      upgradeRequired: true,
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      code: "MOVING_PLAN_UPGRADE_REQUIRED",
      upgradeRequired: true,
    });
    expect(canGenerateMoveTasksMock).toHaveBeenCalledWith("user-1");
    expect(movingPlanMock.findFirst).not.toHaveBeenCalled();
    expect(serviceMock.findMany).not.toHaveBeenCalled();
    expect(serviceProviderMock.findMany).not.toHaveBeenCalled();
  });

  it("uses address-level serviceability when ranking migration provider candidates", async () => {
    movingPlanMock.findFirst.mockResolvedValue({
      id: "plan-1",
      userId: "user-1",
      deletedAt: null,
      fromAddressId: "from-1",
      toAddressId: "to-1",
      fromAddress: { state: "NJ", zip: "07030" },
      toAddress: {
        state: "TX",
        zip: "78701",
        latitude: 30.2672,
        longitude: -97.7431,
      },
    });
    serviceMock.findMany.mockResolvedValue([
      {
        id: "service-1",
        category: "UTILITY_INTERNET",
        providerName: "Old Internet",
        providerId: null,
        isActive: true,
        monthlyCost: null,
        migrationAction: null,
        provider: null,
      },
    ]);
    serviceProviderMock.findMany.mockResolvedValue([
      {
        id: "dest-xfinity",
        name: "Xfinity",
        slug: "xfinity",
        category: "UTILITY_INTERNET",
        scope: "FEDERAL",
        states: [],
        zipCodes: [],
        coverageModel: "live_address",
        coverages: [],
        popularityScore: 10,
      },
    ]);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(enrichProviderServiceabilityMock).toHaveBeenCalledWith(
      expect.any(Array),
      { latitude: 30.2672, longitude: -97.7431 },
    );
    expect(applyProviderServiceabilityConfidenceMock).toHaveBeenCalled();
    expect(body.transitionPlans[0].destinationProviderCandidates[0]).toMatchObject({
      id: "dest-xfinity",
      name: "Xfinity",
      coverageConfidence: "AVAILABLE_AT_ADDRESS",
    });
  });

  it("lets a workspace member access a shared plan and scopes queries by workspace, not the actor", async () => {
    // Actor is a VIEW_ONLY member; the shared plan is owned by user-1 but
    // belongs to workspace ws-1. Pre-fix this 404'd because the route scoped by
    // the raw actor userId (member-2 !== plan.userId).
    resolveWorkspaceDataScopeMock.mockResolvedValue(memberScope("member-2", "user-1", "ws-1"));
    movingPlanMock.findFirst.mockResolvedValue({
      id: "plan-1",
      userId: "user-1",
      workspaceId: "ws-1",
      deletedAt: null,
      fromAddressId: "from-1",
      toAddressId: "to-1",
      fromAddress: { state: "NJ", zip: "07030" },
      toAddress: { state: "TX", zip: "78701", latitude: 30.2672, longitude: -97.7431 },
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    // Plan lookup is scoped to the resolved workspace, never the actor userId.
    const planWhere = movingPlanMock.findFirst.mock.calls[0][0].where;
    expect(planWhere).toMatchObject({ workspaceId: "ws-1", id: "plan-1", deletedAt: null });
    expect(planWhere).not.toHaveProperty("userId");
    // The shared services query is scoped the same way.
    const serviceWhere = serviceMock.findMany.mock.calls[0][0].where;
    expect(serviceWhere).toMatchObject({ workspaceId: "ws-1", addressId: "from-1" });
    expect(serviceWhere).not.toHaveProperty("userId");
  });

  it("404s when a soft-deleted plan is excluded by the deletedAt scope", async () => {
    // The scoped where-clause filters deletedAt: null, so a soft-deleted shared
    // plan never resolves and the member sees a 404 (no resurfacing).
    resolveWorkspaceDataScopeMock.mockResolvedValue(memberScope("member-2", "user-1", "ws-1"));
    movingPlanMock.findFirst.mockResolvedValue(null);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Moving plan not found");
    expect(movingPlanMock.findFirst.mock.calls[0][0].where).toMatchObject({ deletedAt: null });
    // No service work happens for an unresolved plan.
    expect(serviceMock.findMany).not.toHaveBeenCalled();
  });

  it("preserves single-user scoping: plan + service queries key on the actor userId", async () => {
    // Legacy (no-workspace) scope is the default; assert the where-clauses still
    // collapse to { userId } exactly as before the workspace migration.
    movingPlanMock.findFirst.mockResolvedValue({
      id: "plan-1",
      userId: "user-1",
      workspaceId: null,
      deletedAt: null,
      fromAddressId: "from-1",
      toAddressId: "to-1",
      fromAddress: { state: "NJ", zip: "07030" },
      toAddress: { state: "TX", zip: "78701", latitude: 30.2672, longitude: -97.7431 },
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    const planWhere = movingPlanMock.findFirst.mock.calls[0][0].where;
    expect(planWhere).toMatchObject({ userId: "user-1", id: "plan-1", deletedAt: null });
    expect(planWhere).not.toHaveProperty("workspaceId");
    const serviceWhere = serviceMock.findMany.mock.calls[0][0].where;
    expect(serviceWhere).toMatchObject({ userId: "user-1", addressId: "from-1", isActive: true });
    expect(serviceWhere).not.toHaveProperty("workspaceId");
  });
});
