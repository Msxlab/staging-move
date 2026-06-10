import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const mocks = vi.hoisted(() => ({
  can: vi.fn(() => true),
  getEffectiveEntitlement: vi.fn(() => ({ effectivePlan: "FAMILY" })),
  workspaceFeatureGate: vi.fn(),
  getUserSession: vi.fn(),
  rateLimit: vi.fn(),
  workspaceMemberFindFirst: vi.fn(),
  workspaceMemberCount: vi.fn(),
  workspaceInvitationFindMany: vi.fn(),
  workspaceInvitationFindFirst: vi.fn(),
  workspaceInvitationCount: vi.fn(),
  workspaceInvitationCreate: vi.fn(),
  workspaceFindUnique: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  transaction: vi.fn(),
  sendWorkspaceInvitationEmail: vi.fn(),
}));

vi.mock("@locateflow/shared", () => ({
  can: (...args: unknown[]) => (mocks.can as Mock)(...args),
  getEffectiveEntitlement: (...args: unknown[]) => (mocks.getEffectiveEntitlement as Mock)(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    workspaceMember: {
      findFirst: (...args: unknown[]) => mocks.workspaceMemberFindFirst(...args),
      count: (...args: unknown[]) => mocks.workspaceMemberCount(...args),
    },
    workspaceInvitation: {
      findMany: (...args: unknown[]) => mocks.workspaceInvitationFindMany(...args),
      findFirst: (...args: unknown[]) => mocks.workspaceInvitationFindFirst(...args),
      count: (...args: unknown[]) => mocks.workspaceInvitationCount(...args),
      create: (...args: unknown[]) => mocks.workspaceInvitationCreate(...args),
    },
    workspace: { findUnique: (...args: unknown[]) => mocks.workspaceFindUnique(...args) },
    subscription: { findUnique: (...args: unknown[]) => mocks.subscriptionFindUnique(...args) },
    user: { findUnique: (...args: unknown[]) => mocks.userFindUnique(...args) },
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
  },
}));

vi.mock("@/lib/user-auth", () => ({ getUserSession: (...args: unknown[]) => mocks.getUserSession(...args) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...args: unknown[]) => mocks.rateLimit(...args) }));
vi.mock("@/lib/workspace-routes", () => ({ workspaceFeatureGate: (...args: unknown[]) => mocks.workspaceFeatureGate(...args) }));
vi.mock("@/lib/workspace-invitations", () => ({
  generateInvitationToken: vi.fn(() => ({ token: "wsi_plain", tokenHash: "hash", tokenLast4: "lain" })),
  invitationExpiry: vi.fn(() => new Date("2999-01-01T00:00:00.000Z")),
  seatLimitForPlan: vi.fn(() => 6),
}));
vi.mock("@/lib/email-service", () => ({
  sendWorkspaceInvitationEmail: (...args: unknown[]) => mocks.sendWorkspaceInvitationEmail(...args),
}));

import { POST } from "./route";

const txOptions = () => (mocks.transaction as Mock).mock.calls.at(-1)?.[1];

function req(body: Record<string, unknown>) {
  return new Request("https://locateflow.com/api/workspaces/ws-1/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

const params = { params: Promise.resolve({ id: "ws-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.workspaceFeatureGate.mockResolvedValue(null);
  mocks.getUserSession.mockResolvedValue({ userId: "owner-1" });
  mocks.rateLimit.mockResolvedValue({ success: true });
  mocks.workspaceMemberFindFirst.mockImplementation(({ where }: any) => {
    if (where.userId === "owner-1") return Promise.resolve({ id: "caller", role: "OWNER", status: "ACTIVE" });
    return Promise.resolve(null);
  });
  mocks.workspaceFindUnique.mockResolvedValue({ ownerUserId: "owner-1", name: "Family Home" });
  mocks.subscriptionFindUnique.mockResolvedValue({ plan: "FAMILY", status: "ACTIVE" });
  mocks.userFindUnique.mockImplementation(({ where }: any) => {
    if (where.email) return Promise.resolve({ id: "invitee-1", preferredLocale: "en" });
    return Promise.resolve({ firstName: "Owner", lastName: "One", preferredLocale: "en" });
  });
  mocks.workspaceInvitationFindFirst.mockResolvedValue(null);
  mocks.workspaceMemberCount.mockResolvedValue(2);
  mocks.workspaceInvitationCount.mockResolvedValue(1);
  mocks.workspaceInvitationCreate.mockResolvedValue({
    id: "inv-1",
    invitedEmail: "invitee@example.com",
    role: "MEMBER",
    expiresAt: new Date("2999-01-01T00:00:00.000Z"),
    tokenLast4: "lain",
  });
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    workspaceMember: {
      findFirst: (...args: unknown[]) => mocks.workspaceMemberFindFirst(...args),
      count: (...args: unknown[]) => mocks.workspaceMemberCount(...args),
    },
    workspaceInvitation: {
      findFirst: (...args: unknown[]) => mocks.workspaceInvitationFindFirst(...args),
      count: (...args: unknown[]) => mocks.workspaceInvitationCount(...args),
      create: (...args: unknown[]) => mocks.workspaceInvitationCreate(...args),
    },
    user: { findUnique: (...args: unknown[]) => mocks.userFindUnique(...args) },
  }));
  mocks.sendWorkspaceInvitationEmail.mockResolvedValue(true);
});

describe("POST /api/workspaces/[id]/invitations", () => {
  it("creates the invite inside a Serializable transaction after counting members and pending invites", async () => {
    const res = await POST(req({ email: "Invitee@Example.com", role: "MEMBER" }), params);

    expect(res.status).toBe(200);
    expect(txOptions()).toMatchObject({ isolationLevel: "Serializable" });
    expect(mocks.workspaceMemberCount).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", status: { not: "SUSPENDED" } },
    });
    expect(mocks.workspaceInvitationCount).toHaveBeenCalledWith({
      // expiry-aware seat counting: lapsed invites don't hold a seat
      where: { workspaceId: "ws-1", status: "PENDING", expiresAt: { gte: expect.any(Date) } },
    });
    expect(mocks.workspaceInvitationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ invitedEmail: "invitee@example.com", status: "PENDING" }),
    }));
  });

  it("does not create a pending invite when the transaction sees no free seats", async () => {
    mocks.workspaceMemberCount.mockResolvedValue(5);
    mocks.workspaceInvitationCount.mockResolvedValue(1);

    const res = await POST(req({ email: "invitee@example.com", role: "MEMBER" }), params);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Workspace is at its seat limit." });
    expect(mocks.workspaceInvitationCreate).not.toHaveBeenCalled();
  });

  it("returns a clean retry response for Serializable write conflicts", async () => {
    mocks.transaction.mockRejectedValue(Object.assign(new Error("write conflict"), { code: "P2034" }));

    const res = await POST(req({ email: "invitee@example.com", role: "MEMBER" }), params);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Please try again." });
  });
});
