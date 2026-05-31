import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@locateflow/shared", () => ({
  getEffectiveEntitlement: vi.fn(() => ({ effectivePlan: "FAMILY" })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    workspaceInvitation: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    workspace: { findUnique: vi.fn() },
    subscription: { findUnique: vi.fn() },
    workspaceMember: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/user-auth", () => ({ getUserSession: vi.fn() }));
vi.mock("@/lib/workspace-routes", () => ({ workspaceFeatureGate: vi.fn() }));
vi.mock("@/lib/workspace-invitations", () => ({
  hashInvitationToken: vi.fn(() => "hashed-token"),
  seatLimitForPlan: vi.fn(() => 6),
}));
vi.mock("@/lib/in-app-notifications", () => ({ createInAppNotification: vi.fn(() => Promise.resolve()) }));

import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { POST } from "./route";

const invFind = prisma.workspaceInvitation.findUnique as unknown as Mock;
const invUpdate = prisma.workspaceInvitation.update as unknown as Mock;
const userFind = prisma.user.findUnique as unknown as Mock;
const wsFind = prisma.workspace.findUnique as unknown as Mock;
const subFind = prisma.subscription.findUnique as unknown as Mock;
const memberFind = prisma.workspaceMember.findFirst as unknown as Mock;
const memberCount = prisma.workspaceMember.count as unknown as Mock;
const memberCreate = prisma.workspaceMember.create as unknown as Mock;
const txMock = prisma.$transaction as unknown as Mock;
const sessionMock = getUserSession as unknown as Mock;
const gateMock = workspaceFeatureGate as unknown as Mock;

const params = { params: Promise.resolve({ token: "tok-123" }) };
const req = {} as any;

const FUTURE = new Date("2999-01-01");
const PAST = new Date("2000-01-01");

function pendingInvite(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    status: "PENDING",
    expiresAt: FUTURE,
    invitedEmail: "invitee@example.com",
    workspaceId: "ws-1",
    role: "MEMBER",
    invitedByUserId: "owner-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  gateMock.mockResolvedValue(null);
  sessionMock.mockResolvedValue({ userId: "u-1" });
  invFind.mockResolvedValue(pendingInvite());
  userFind.mockResolvedValue({ email: "invitee@example.com" });
  wsFind.mockResolvedValue({ id: "ws-1", ownerUserId: "owner-1", name: "Home" });
  subFind.mockResolvedValue({});
  memberFind.mockResolvedValue(null);
  memberCount.mockResolvedValue(1);
  memberCreate.mockResolvedValue({});
  invUpdate.mockResolvedValue({});
  // Run the transaction callback against the mocked prisma as the tx client.
  txMock.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
});

describe("POST /api/invitations/[token]/accept", () => {
  it("401s without a session", async () => {
    sessionMock.mockResolvedValue(null);
    const res = await POST(req, params);
    expect(res.status).toBe(401);
  });

  it("410s when the invitation is missing or not PENDING", async () => {
    invFind.mockResolvedValue(pendingInvite({ status: "REVOKED" }));
    const res = await POST(req, params);
    expect(res.status).toBe(410);
    expect(memberCreate).not.toHaveBeenCalled();
  });

  it("410s when the invitation has expired", async () => {
    invFind.mockResolvedValue(pendingInvite({ expiresAt: PAST }));
    const res = await POST(req, params);
    expect(res.status).toBe(410);
  });

  it("403s when the session email doesn't match the invited email", async () => {
    userFind.mockResolvedValue({ email: "someone-else@example.com" });
    const res = await POST(req, params);
    expect(res.status).toBe(403);
    expect(memberCreate).not.toHaveBeenCalled();
  });

  it("matches the invited email case-insensitively", async () => {
    userFind.mockResolvedValue({ email: "INVITEE@example.com" });
    const res = await POST(req, params);
    expect(res.status).toBe(200);
  });

  it("404s when the workspace no longer exists", async () => {
    wsFind.mockResolvedValueOnce(null); // seat-check lookup
    const res = await POST(req, params);
    expect(res.status).toBe(404);
  });

  it("409s when the workspace is at its seat limit", async () => {
    memberCount.mockResolvedValue(6); // == seatLimitForPlan mock (6)
    const res = await POST(req, params);
    expect(res.status).toBe(409);
    expect(memberCreate).not.toHaveBeenCalled();
  });

  it("joins the workspace and marks the invite accepted on the happy path", async () => {
    const res = await POST(req, params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ workspaceId: "ws-1", role: "MEMBER" });
    expect(memberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workspaceId: "ws-1", userId: "u-1", role: "MEMBER", status: "ACTIVE", invitationId: "inv-1" }),
      }),
    );
    expect(invUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inv-1" }, data: expect.objectContaining({ status: "ACCEPTED", acceptedByUserId: "u-1" }) }),
    );
  });

  it("is idempotent when the user is already a member (no duplicate member row)", async () => {
    memberFind.mockResolvedValue({ id: "m-existing", userId: "u-1" });
    const res = await POST(req, params);
    expect(res.status).toBe(200);
    expect(memberCreate).not.toHaveBeenCalled();
    expect(invUpdate).toHaveBeenCalled(); // still marks the invite accepted
  });
});
