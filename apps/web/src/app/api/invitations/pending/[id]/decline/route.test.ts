import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireVerifiedUser: vi.fn(),
  userFindUnique: vi.fn(),
  invitationFindUnique: vi.fn(),
  invitationUpdate: vi.fn(),
  workspaceFeatureGate: vi.fn(),
  writeWorkspaceAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireVerifiedUser: (...args: unknown[]) => mocks.requireVerifiedUser(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mocks.userFindUnique(...args) },
    workspaceInvitation: {
      findUnique: (...args: unknown[]) => mocks.invitationFindUnique(...args),
      update: (...args: unknown[]) => mocks.invitationUpdate(...args),
    },
  },
}));

vi.mock("@/lib/workspace-routes", () => ({
  workspaceFeatureGate: (...args: unknown[]) => mocks.workspaceFeatureGate(...args),
}));

vi.mock("@/lib/workspace-audit", () => ({
  WORKSPACE_AUDIT_ACTIONS: { INVITATION_REVOKED: "WS_INV_REVOKED" },
  maskTargetEmail: vi.fn((email: string) => email),
  writeWorkspaceAudit: (...args: unknown[]) => mocks.writeWorkspaceAudit(...args),
}));

import { POST } from "./route";

const params = { params: Promise.resolve({ id: "inv_1" }) };
const request = new NextRequest("https://locateflow.com/api/invitations/pending/inv_1/decline", { method: "POST" });

describe("POST /api/invitations/pending/[id]/decline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspaceFeatureGate.mockResolvedValue(null);
    mocks.requireVerifiedUser.mockResolvedValue("user_1");
    mocks.userFindUnique.mockResolvedValue({ email: "invitee@example.com" });
    mocks.invitationFindUnique.mockResolvedValue({
      id: "inv_1",
      invitedEmail: "invitee@example.com",
      status: "PENDING",
      workspaceId: "ws_1",
      role: "MEMBER",
    });
    mocks.invitationUpdate.mockResolvedValue({});
    mocks.writeWorkspaceAudit.mockResolvedValue(undefined);
  });

  it("requires a verified email before declining by id without the raw token", async () => {
    mocks.requireVerifiedUser.mockRejectedValueOnce(new Error("EMAIL_VERIFICATION_REQUIRED"));

    const res = await POST(request, params);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ code: "EMAIL_VERIFICATION_REQUIRED" });
    expect(mocks.invitationUpdate).not.toHaveBeenCalled();
  });

  it("revokes a pending invite for the verified caller email", async () => {
    const res = await POST(request, params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mocks.invitationUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "inv_1" },
      data: expect.objectContaining({ status: "REVOKED", revokedByUserId: "user_1" }),
    }));
  });
});
