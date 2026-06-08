import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireVerifiedUser: vi.fn(),
  userFindUnique: vi.fn(),
  invitationFindUnique: vi.fn(),
  workspaceFeatureGate: vi.fn(),
  acceptWorkspaceInvitation: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireVerifiedUser: (...args: unknown[]) => mocks.requireVerifiedUser(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mocks.userFindUnique(...args) },
    workspaceInvitation: { findUnique: (...args: unknown[]) => mocks.invitationFindUnique(...args) },
  },
}));

vi.mock("@/lib/workspace-routes", () => ({
  workspaceFeatureGate: (...args: unknown[]) => mocks.workspaceFeatureGate(...args),
}));

vi.mock("@/lib/workspace-invite-accept", () => ({
  AcceptInviteError: class AcceptInviteError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  acceptWorkspaceInvitation: (...args: unknown[]) => mocks.acceptWorkspaceInvitation(...args),
}));

import { POST } from "./route";

const params = { params: Promise.resolve({ id: "inv_1" }) };
const request = new NextRequest("https://locateflow.com/api/invitations/pending/inv_1/accept", { method: "POST" });

describe("POST /api/invitations/pending/[id]/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspaceFeatureGate.mockResolvedValue(null);
    mocks.requireVerifiedUser.mockResolvedValue("user_1");
    mocks.userFindUnique.mockResolvedValue({ email: "invitee@example.com" });
    mocks.invitationFindUnique.mockResolvedValue({
      id: "inv_1",
      invitedEmail: "invitee@example.com",
      status: "PENDING",
      expiresAt: new Date("2999-01-01T00:00:00.000Z"),
      workspaceId: "ws_1",
      role: "MEMBER",
    });
    mocks.acceptWorkspaceInvitation.mockResolvedValue({ workspaceId: "ws_1", role: "MEMBER" });
  });

  it("requires a verified email before accepting by id without the raw token", async () => {
    mocks.requireVerifiedUser.mockRejectedValueOnce(new Error("EMAIL_VERIFICATION_REQUIRED"));

    const res = await POST(request, params);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ code: "EMAIL_VERIFICATION_REQUIRED" });
    expect(mocks.acceptWorkspaceInvitation).not.toHaveBeenCalled();
  });

  it("accepts a pending invite for the verified caller email", async () => {
    const res = await POST(request, params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ workspaceId: "ws_1", role: "MEMBER" });
    expect(mocks.acceptWorkspaceInvitation).toHaveBeenCalledWith(expect.objectContaining({ userId: "user_1" }));
  });
});
