import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserSession: vi.fn(),
  workspaceFeatureGate: vi.fn(),
  workspaceMemberFindMany: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  workspaceMemberCount: vi.fn(),
  addressCount: vi.fn(),
  serviceCount: vi.fn(),
  movingPlanCount: vi.fn(),
  budgetCount: vi.fn(),
}));

vi.mock("@/lib/user-auth", () => ({
  getUserSession: (...args: unknown[]) => mocks.getUserSession(...args),
}));

vi.mock("@/lib/workspace-routes", () => ({
  workspaceFeatureGate: (...args: unknown[]) => mocks.workspaceFeatureGate(...args),
  planSummaryForOwner: vi.fn(async () => ({ planLabel: "Family", seatLimit: 4 })),
  workspacePlanLabel: vi.fn(() => "Household"),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    workspaceMember: {
      findMany: (...args: unknown[]) => mocks.workspaceMemberFindMany(...args),
      count: (...args: unknown[]) => mocks.workspaceMemberCount(...args),
    },
    subscription: {
      findUnique: (...args: unknown[]) => mocks.subscriptionFindUnique(...args),
    },
    address: { count: (...args: unknown[]) => mocks.addressCount(...args) },
    service: { count: (...args: unknown[]) => mocks.serviceCount(...args) },
    movingPlan: { count: (...args: unknown[]) => mocks.movingPlanCount(...args) },
    budget: { count: (...args: unknown[]) => mocks.budgetCount(...args) },
  },
}));

import { GET } from "./route";

describe("GET /api/workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspaceFeatureGate.mockResolvedValue(null);
    mocks.getUserSession.mockResolvedValue({ userId: "user_1" });
    mocks.workspaceMemberFindMany.mockResolvedValue([]);
  });

  it("returns an empty list when the workspace feature is disabled", async () => {
    mocks.workspaceFeatureGate.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Not found", code: "WORKSPACE_DISABLED" }), { status: 404 }),
    );

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ workspaces: [], workspaceModelEnabled: false });
    expect(mocks.getUserSession).not.toHaveBeenCalled();
    expect(mocks.workspaceMemberFindMany).not.toHaveBeenCalled();
  });

  it("requires a session when the workspace feature is enabled", async () => {
    mocks.getUserSession.mockResolvedValueOnce(null);

    const res = await GET();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns the caller workspaces", async () => {
    mocks.workspaceMemberFindMany.mockResolvedValueOnce([
      {
        role: "OWNER",
        status: "ACTIVE",
        workspace: {
          id: "ws_1",
          name: "Smith Household",
          ownerUserId: "user_1",
          deletedAt: null,
        },
      },
    ]);
    mocks.workspaceMemberCount.mockResolvedValueOnce(2);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.workspaces).toEqual([
      expect.objectContaining({
        id: "ws_1",
        name: "Smith Household",
        role: "OWNER",
        status: "ACTIVE",
        memberCount: 2,
      }),
    ]);
  });
});
