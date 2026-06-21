import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserSession: vi.fn(),
  workspaceMemberFindFirst: vi.fn(),
  workspaceFindUnique: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
}));

vi.mock("@/lib/user-auth", () => ({
  getUserSession: mocks.getUserSession,
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: mocks.getRuntimeConfigValue,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    workspaceMember: {
      findFirst: (...args: unknown[]) => mocks.workspaceMemberFindFirst(...args),
    },
    workspace: {
      findUnique: (...args: unknown[]) => mocks.workspaceFindUnique(...args),
    },
    subscription: {
      findUnique: (...args: unknown[]) => mocks.subscriptionFindUnique(...args),
    },
  },
}));

import { requireWorkspaceContext } from "./workspace-context";

function request(headers: Record<string, string> = {}) {
  return new Request("https://locateflow.com/api/services", { headers });
}

describe("requireWorkspaceContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserSession.mockResolvedValue({ userId: "user_1" });
    mocks.getRuntimeConfigValue.mockResolvedValue("true");
    mocks.subscriptionFindUnique.mockResolvedValue(null);
  });

  it("rejects a stale mobile workspace header instead of falling back silently", async () => {
    mocks.workspaceMemberFindFirst.mockResolvedValueOnce(null);

    await expect(requireWorkspaceContext(request({ "x-workspace-id": "ws_removed" }))).rejects.toMatchObject({
      status: 409,
      code: "STALE_WORKSPACE_SELECTION",
    });

    expect(mocks.workspaceMemberFindFirst).toHaveBeenCalledTimes(1);
    expect(mocks.workspaceMemberFindFirst).toHaveBeenCalledWith({
      where: { workspaceId: "ws_removed", userId: "user_1" },
    });
    expect(mocks.workspaceFindUnique).not.toHaveBeenCalled();
  });

  it("keeps the web cookie self-heal fallback for stale browser selections", async () => {
    mocks.workspaceMemberFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        workspaceId: "ws_oldest",
        role: "OWNER",
        status: "ACTIVE",
      });
    mocks.workspaceFindUnique.mockResolvedValue({
      id: "ws_oldest",
      ownerUserId: "user_1",
      name: "Default workspace",
    });

    await expect(
      requireWorkspaceContext(request({ cookie: "lf_workspace_id=ws_removed" })),
    ).resolves.toMatchObject({
      workspaceId: "ws_oldest",
      staleWorkspaceCookie: true,
    });

    expect(mocks.workspaceMemberFindFirst).toHaveBeenNthCalledWith(2, {
      where: { userId: "user_1" },
      orderBy: { joinedAt: "asc" },
    });
  });
});
