import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class WorkspaceContextError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    isWorkspaceModelEnabled: vi.fn(),
    requireWorkspaceContext: vi.fn(),
    findFirst: vi.fn(),
    WorkspaceContextError,
  };
});

vi.mock("@/lib/workspace-context", () => ({
  isWorkspaceModelEnabled: mocks.isWorkspaceModelEnabled,
  requireWorkspaceContext: mocks.requireWorkspaceContext,
  WorkspaceContextError: mocks.WorkspaceContextError,
}));

vi.mock("@/lib/db", () => ({
  prisma: { workspaceMember: { findFirst: (...a: unknown[]) => mocks.findFirst(...a) } },
}));

import { ApiGateError } from "@/lib/api-gates";
import { legacyDataScope, resolveWorkspaceDataScope } from "./workspace-data-scope";

const req = new Request("https://x.test/api/addresses");

describe("resolveWorkspaceDataScope — safe to enable WORKSPACE_MODEL_ENABLED", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns legacy (self) scope when workspace mode is OFF", async () => {
    mocks.isWorkspaceModelEnabled.mockResolvedValue(false);
    expect(await resolveWorkspaceDataScope(req, "u1")).toEqual(legacyDataScope("u1"));
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.requireWorkspaceContext).not.toHaveBeenCalled();
  });

  it("REGRESSION: falls back to legacy scope (no 403) when mode is ON but the user has NO membership", async () => {
    // Existing users created before workspace mode have no WorkspaceMember row.
    // Flipping the flag on must NOT 403 them out of their OWN data.
    mocks.isWorkspaceModelEnabled.mockResolvedValue(true);
    mocks.findFirst.mockResolvedValue(null);
    expect(await resolveWorkspaceDataScope(req, "u1")).toEqual(legacyDataScope("u1"));
    expect(mocks.requireWorkspaceContext).not.toHaveBeenCalled();
  });

  it("resolves the full workspace context when the user HAS a membership", async () => {
    mocks.isWorkspaceModelEnabled.mockResolvedValue(true);
    mocks.findFirst.mockResolvedValue({ id: "m1" });
    mocks.requireWorkspaceContext.mockResolvedValue({
      userId: "u1",
      ownerUserId: "owner1",
      workspaceId: "w1",
      memberRole: "OWNER",
      memberStatus: "ACTIVE",
    });
    const scope = await resolveWorkspaceDataScope(req, "u1");
    expect(scope.workspaceMode).toBe(true);
    expect(scope.workspaceId).toBe("w1");
    expect(scope.ownerUserId).toBe("owner1");
  });

  it("still FORBIDs a member whose workspace context genuinely fails (cross-workspace)", async () => {
    mocks.isWorkspaceModelEnabled.mockResolvedValue(true);
    mocks.findFirst.mockResolvedValue({ id: "m1" }); // has a membership row
    mocks.requireWorkspaceContext.mockRejectedValue(
      new mocks.WorkspaceContextError(403, "NO_WORKSPACE_ACCESS", "denied"),
    );
    await expect(resolveWorkspaceDataScope(req, "u1")).rejects.toBeInstanceOf(ApiGateError);
  });
});
