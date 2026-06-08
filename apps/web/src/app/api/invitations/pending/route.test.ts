import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const mocks = vi.hoisted(() => ({
  requireVerifiedUser: vi.fn(),
  userFindUnique: vi.fn(),
  userFindMany: vi.fn(),
  invitationFindMany: vi.fn(),
  workspaceFeatureGate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireVerifiedUser: (...args: unknown[]) => mocks.requireVerifiedUser(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mocks.userFindUnique(...args),
      findMany: (...args: unknown[]) => mocks.userFindMany(...args),
    },
    workspaceInvitation: {
      findMany: (...args: unknown[]) => mocks.invitationFindMany(...args),
    },
  },
}));

vi.mock("@/lib/workspace-routes", () => ({
  workspaceFeatureGate: (...args: unknown[]) => mocks.workspaceFeatureGate(...args),
}));

import { GET } from "./route";

describe("GET /api/invitations/pending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workspaceFeatureGate.mockResolvedValue(null);
    mocks.requireVerifiedUser.mockResolvedValue("user_1");
    mocks.userFindUnique.mockResolvedValue({ email: "Invitee@Example.com" });
    mocks.userFindMany.mockResolvedValue([{ id: "owner_1", firstName: "Owner", lastName: "One" }]);
    mocks.invitationFindMany.mockResolvedValue([
      {
        id: "inv_1",
        role: "MEMBER",
        expiresAt: new Date("2999-01-01T00:00:00.000Z"),
        workspace: { name: "Home" },
        invitedByUserId: "owner_1",
      },
    ]);
  });

  it("requires a verified email before listing tokenless pending invites", async () => {
    mocks.requireVerifiedUser.mockRejectedValueOnce(new Error("EMAIL_VERIFICATION_REQUIRED"));

    const res = await GET();

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ code: "EMAIL_VERIFICATION_REQUIRED" });
    expect(mocks.invitationFindMany).not.toHaveBeenCalled();
  });

  it("lists only invites for the verified caller email", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.invitationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ invitedEmail: "invitee@example.com", status: "PENDING" }),
    }));
    expect(body).toEqual([
      expect.objectContaining({ id: "inv_1", workspaceName: "Home", inviterName: "Owner One" }),
    ]);
  });
});
