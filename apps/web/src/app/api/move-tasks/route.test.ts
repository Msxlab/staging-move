import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  getRateLimitKey: vi.fn(() => "move-task-key"),
  rateLimit: vi.fn(),
  canGenerateMoveTasks: vi.fn(),
  resolveWorkspaceDataScope: vi.fn(),
  assertWorkspaceAction: vi.fn(),
  planLimitScopeForDataScope: vi.fn(() => ({})),
  apiGateErrorResponse: vi.fn(() => null),
  syncSuggestedMoveTasks: vi.fn(),
  completeMoveTaskWithLocalEffect: vi.fn(),
  createAuditLog: vi.fn(),
  extractRequestMeta: vi.fn(() => ({ ipAddress: null, userAgent: null })),
  movingPlanFindFirst: vi.fn(),
  moveTaskFindMany: vi.fn(),
  moveTaskFindFirst: vi.fn(),
  moveTaskUpdate: vi.fn(),
  workspaceMemberFindMany: vi.fn(),
  workspaceMemberFindFirst: vi.fn(),
  userEventCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    movingPlan: { findFirst: mocks.movingPlanFindFirst },
    moveTask: {
      findMany: mocks.moveTaskFindMany,
      findFirst: mocks.moveTaskFindFirst,
      update: mocks.moveTaskUpdate,
    },
    workspaceMember: {
      findMany: mocks.workspaceMemberFindMany,
      findFirst: mocks.workspaceMemberFindFirst,
    },
    userEvent: { create: mocks.userEventCreate },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: mocks.requireDbUserId,
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: mocks.createAuditLog,
  extractRequestMeta: mocks.extractRequestMeta,
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: mocks.getRateLimitKey,
  rateLimit: mocks.rateLimit,
}));

vi.mock("@/lib/plan-limits", () => ({
  canGenerateMoveTasks: mocks.canGenerateMoveTasks,
}));

vi.mock("@/lib/move-task-generation", () => ({
  syncSuggestedMoveTasks: mocks.syncSuggestedMoveTasks,
}));

vi.mock("@/lib/move-task-local-effects", () => ({
  completeMoveTaskWithLocalEffect: mocks.completeMoveTaskWithLocalEffect,
}));

vi.mock("@/lib/api-gates", () => ({
  apiGateErrorResponse: mocks.apiGateErrorResponse,
}));

vi.mock("@/lib/workspace-data-scope", () => ({
  resolveWorkspaceDataScope: mocks.resolveWorkspaceDataScope,
  assertWorkspaceAction: mocks.assertWorkspaceAction,
  planLimitScopeForDataScope: mocks.planLimitScopeForDataScope,
}));

import { GET, PATCH, POST } from "./route";

function request(body: unknown) {
  return new Request("https://locateflow.com/api/move-tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function freeEntitlement() {
  return {
    allowed: false,
    code: "MOVING_PLAN_UPGRADE_REQUIRED",
    reason: "Upgrade to Individual to unlock your full move plan.",
    upgradeRequired: true,
  };
}

describe("move task entitlement gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDbUserId.mockResolvedValue("user-1");
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.canGenerateMoveTasks.mockResolvedValue({ allowed: true });
    mocks.resolveWorkspaceDataScope.mockResolvedValue({
      actorUserId: "user-1",
      ownerUserId: "user-1",
      workspaceId: null,
      workspaceMode: false,
      memberRole: null,
      memberStatus: null,
    });
  });

  it("GET includes destinationProvider id/name/affiliateActive (R2 move-task offer data contract)", async () => {
    mocks.moveTaskFindMany.mockResolvedValue([]);
    mocks.workspaceMemberFindMany.mockResolvedValue([]);

    const res = await GET(
      new Request("https://locateflow.com/api/move-tasks?movingPlanId=plan-1") as any,
    );
    expect(res.status).toBe(200);

    const include = mocks.moveTaskFindMany.mock.calls[0][0].include;
    // The offer surface needs id (to attribute the click) + affiliateActive (to
    // decide whether to render) + name (the CTA label).
    expect(include.destinationProvider.select).toMatchObject({
      id: true,
      name: true,
      affiliateActive: true,
    });
  });

  it("blocks free users from generating tracked move tasks", async () => {
    mocks.canGenerateMoveTasks.mockResolvedValueOnce(freeEntitlement());

    const response = await POST(request({ movingPlanId: "plan-1" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ code: "MOVING_PLAN_UPGRADE_REQUIRED", upgradeRequired: true });
    expect(mocks.canGenerateMoveTasks).toHaveBeenCalledWith("user-1", {});
    expect(mocks.movingPlanFindFirst).not.toHaveBeenCalled();
    expect(mocks.syncSuggestedMoveTasks).not.toHaveBeenCalled();
  });

  it("blocks free users from mutating tracked move tasks", async () => {
    mocks.canGenerateMoveTasks.mockResolvedValueOnce(freeEntitlement());

    const response = await PATCH(request({ id: "task-1", event: "COMPLETE" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ code: "MOVING_PLAN_UPGRADE_REQUIRED", upgradeRequired: true });
    expect(mocks.canGenerateMoveTasks).toHaveBeenCalledWith("user-1", {});
    expect(mocks.moveTaskFindFirst).not.toHaveBeenCalled();
    expect(mocks.moveTaskUpdate).not.toHaveBeenCalled();
    expect(mocks.completeMoveTaskWithLocalEffect).not.toHaveBeenCalled();
  });
});
