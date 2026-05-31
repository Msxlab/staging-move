import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// NOTE: @locateflow/shared is NOT mocked — the route's authorization uses the
// real can() permission matrix (pure + already unit-tested), so these tests
// exercise the genuine OWNER-only gate.
vi.mock("@/lib/db", () => ({
  prisma: {
    workspaceMember: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    workspace: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/user-auth", () => ({ getUserSession: vi.fn() }));
vi.mock("@/lib/workspace-routes", () => ({ workspaceFeatureGate: vi.fn() }));
vi.mock("@/lib/workspace-ownership", () => ({ transferWorkspaceOwnership: vi.fn() }));
vi.mock("@/lib/in-app-notifications", () => ({ createInAppNotification: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/email-service", () => ({ sendWorkspaceOwnershipEmail: vi.fn(() => Promise.resolve()) }));

import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { transferWorkspaceOwnership } from "@/lib/workspace-ownership";
import { POST } from "./route";

const memberFind = prisma.workspaceMember.findFirst as unknown as Mock;
const userFind = prisma.user.findUnique as unknown as Mock;
const wsFind = prisma.workspace.findUnique as unknown as Mock;
const sessionMock = getUserSession as unknown as Mock;
const gateMock = workspaceFeatureGate as unknown as Mock;
const transferMock = transferWorkspaceOwnership as unknown as Mock;

const CALLER = "owner-1";
const params = { params: Promise.resolve({ id: "ws-1" }) };

function req(body: unknown) {
  return new Request("http://localhost/api/workspaces/ws-1/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  gateMock.mockResolvedValue(null);
  sessionMock.mockResolvedValue({ userId: CALLER });
  memberFind.mockResolvedValue({ id: "m-owner", userId: CALLER, role: "OWNER", status: "ACTIVE" });
  transferMock.mockResolvedValue({ ok: true });
  userFind.mockResolvedValue({ email: "new@example.com", firstName: "New", preferredLocale: "en" });
  wsFind.mockResolvedValue({ name: "Home" });
});

describe("POST /api/workspaces/[id]/transfer", () => {
  it("401s without a session", async () => {
    sessionMock.mockResolvedValue(null);
    const res = await POST(req({ toUserId: "u-2" }), params);
    expect(res.status).toBe(401);
    expect(transferMock).not.toHaveBeenCalled();
  });

  it("404s when the caller is not a member", async () => {
    memberFind.mockResolvedValue(null);
    const res = await POST(req({ toUserId: "u-2" }), params);
    expect(res.status).toBe(404);
  });

  it("403s when the caller is not the OWNER (real can() gate)", async () => {
    memberFind.mockResolvedValue({ id: "m-admin", userId: CALLER, role: "ADMIN", status: "ACTIVE" });
    const res = await POST(req({ toUserId: "u-2" }), params);
    expect(res.status).toBe(403);
    expect(transferMock).not.toHaveBeenCalled();
  });

  it("403s when an OWNER is read-only (OVERFLOW/SUSPENDED status)", async () => {
    memberFind.mockResolvedValue({ id: "m-owner", userId: CALLER, role: "OWNER", status: "OVERFLOW" });
    const res = await POST(req({ toUserId: "u-2" }), params);
    expect(res.status).toBe(403);
  });

  it("422s when toUserId is missing", async () => {
    const res = await POST(req({}), params);
    expect(res.status).toBe(422);
    expect(transferMock).not.toHaveBeenCalled();
  });

  it("409s when the ownership transfer is rejected", async () => {
    transferMock.mockResolvedValue({ ok: false, error: "Choose an active member to receive ownership." });
    const res = await POST(req({ toUserId: "u-2" }), params);
    expect(res.status).toBe(409);
  });

  it("transfers when an active OWNER hands off to a member", async () => {
    const res = await POST(req({ toUserId: "u-2" }), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(transferMock).toHaveBeenCalledWith("ws-1", CALLER, "u-2");
  });

  it("still succeeds (200) if the best-effort notifications throw", async () => {
    userFind.mockRejectedValue(new Error("db blip"));
    const res = await POST(req({ toUserId: "u-2" }), params);
    expect(res.status).toBe(200);
  });
});
