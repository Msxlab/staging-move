import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    workspaceMember: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue({ id: "u-target", email: "target@example.com", name: "Target" }) },
    workspace: { findUnique: vi.fn().mockResolvedValue({ name: "Test Workspace" }) },
    auditLog: { create: vi.fn() },
    notification: { create: vi.fn() },
  },
}));
vi.mock("@/lib/user-auth", () => ({ getUserSession: vi.fn() }));
vi.mock("@/lib/workspace-routes", () => ({
  workspaceFeatureGate: vi.fn(),
  maskEmail: vi.fn((email: string) => email),
}));
vi.mock("@/lib/workspace-step-up", () => ({
  requireWorkspaceStepUp: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { requireWorkspaceStepUp } from "@/lib/workspace-step-up";
import { PATCH, DELETE } from "./route";

const memberMock = prisma.workspaceMember.findFirst as unknown as Mock;
const updateMock = prisma.workspaceMember.update as unknown as Mock;
const deleteMock = prisma.workspaceMember.delete as unknown as Mock;
const sessionMock = getUserSession as unknown as Mock;
const gateMock = workspaceFeatureGate as unknown as Mock;
const stepUpMock = requireWorkspaceStepUp as unknown as Mock;

const CALLER = "u-caller";
const params = { params: Promise.resolve({ id: "ws-1", memberId: "m-target" }) };

/** resolvePair looks up the caller by userId and the target by id. */
function pair(caller: any, target: any) {
  memberMock.mockImplementation(({ where }: any) => {
    if (where.userId) return Promise.resolve(caller);
    if (where.id) return Promise.resolve(target);
    return Promise.resolve(null);
  });
}

function patchReq(role: string, extra: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/workspaces/ws-1/members/m-target", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, ...extra }),
  }) as any;
}
function deleteReq() {
  return new Request("http://localhost/api/workspaces/ws-1/members/m-target", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  }) as any;
}

describe("PATCH /api/workspaces/[id]/members/[memberId] — role change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gateMock.mockResolvedValue(null);
    sessionMock.mockResolvedValue({ userId: CALLER });
    updateMock.mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, role: data.role }));
    // Default: step-up passes. Individual tests override to simulate a missing/failed re-auth.
    stepUpMock.mockResolvedValue({ ok: true, method: "password" });
  });

  it("401s without a session", async () => {
    sessionMock.mockResolvedValue(null);
    const res = await PATCH(patchReq("MEMBER"), params);
    expect(res.status).toBe(401);
  });

  it("409s when changing your own role", async () => {
    pair({ id: "m-caller", userId: CALLER, role: "OWNER" }, { id: "m-target", userId: CALLER, role: "OWNER" });
    const res = await PATCH(patchReq("MEMBER"), params);
    expect(res.status).toBe(409);
  });

  it("422s on an invalid role", async () => {
    pair({ id: "m-caller", userId: CALLER, role: "OWNER" }, { id: "m-target", userId: "u-t", role: "MEMBER" });
    const res = await PATCH(patchReq("SUPERUSER"), params);
    expect(res.status).toBe(422);
  });

  it("403s when an ADMIN tries to grant ADMIN (owner-only)", async () => {
    pair({ id: "m-caller", userId: CALLER, role: "ADMIN" }, { id: "m-target", userId: "u-t", role: "MEMBER" });
    const res = await PATCH(patchReq("ADMIN"), params);
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("403s when an ADMIN tries to change another ADMIN", async () => {
    pair({ id: "m-caller", userId: CALLER, role: "ADMIN" }, { id: "m-target", userId: "u-t", role: "ADMIN" });
    const res = await PATCH(patchReq("MEMBER"), params);
    expect(res.status).toBe(403);
  });

  it("403s when promoting to ADMIN without step-up re-auth", async () => {
    pair({ id: "m-caller", userId: CALLER, role: "OWNER" }, { id: "m-target", userId: "u-t", role: "MEMBER" });
    stepUpMock.mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: "Re-auth required", code: "STEP_UP_REQUIRED", requiresStepUp: true },
        { status: 403 },
      ),
    });
    const res = await PATCH(patchReq("ADMIN"), params);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.requiresStepUp).toBe(true);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("lets the OWNER promote a MEMBER to ADMIN with valid step-up", async () => {
    pair({ id: "m-caller", userId: CALLER, role: "OWNER" }, { id: "m-target", userId: "u-t", role: "MEMBER" });
    const res = await PATCH(patchReq("ADMIN", { confirmPassword: "pw" }), params);
    expect(res.status).toBe(200);
    expect(stepUpMock).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "workspace_promote_admin", userId: CALLER, workspaceId: "ws-1" }),
    );
    expect(memberMock).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", userId: CALLER, workspace: { deletedAt: null } },
    });
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "m-target" }, data: { role: "ADMIN" } });
  });

  it("does not require step-up for a non-ADMIN role change", async () => {
    pair({ id: "m-caller", userId: CALLER, role: "ADMIN" }, { id: "m-target", userId: "u-t", role: "MEMBER" });
    const res = await PATCH(patchReq("CHILD"), params);
    expect(res.status).toBe(200);
    expect(stepUpMock).not.toHaveBeenCalled();
  });

  it("lets an ADMIN change a MEMBER to CHILD", async () => {
    pair({ id: "m-caller", userId: CALLER, role: "ADMIN" }, { id: "m-target", userId: "u-t", role: "MEMBER" });
    const res = await PATCH(patchReq("CHILD"), params);
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/workspaces/[id]/members/[memberId] — remove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gateMock.mockResolvedValue(null);
    sessionMock.mockResolvedValue({ userId: CALLER });
    deleteMock.mockResolvedValue({ id: "m-target" });
  });

  it("409s when removing yourself (use leave instead)", async () => {
    pair({ id: "m-caller", userId: CALLER, role: "OWNER" }, { id: "m-target", userId: CALLER, role: "OWNER" });
    const res = await DELETE(deleteReq(), params);
    expect(res.status).toBe(409);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("403s when an ADMIN tries to remove the OWNER", async () => {
    pair({ id: "m-caller", userId: CALLER, role: "ADMIN" }, { id: "m-target", userId: "u-t", role: "OWNER" });
    const res = await DELETE(deleteReq(), params);
    expect(res.status).toBe(403);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("403s when a plain MEMBER tries to remove anyone", async () => {
    pair({ id: "m-caller", userId: CALLER, role: "MEMBER" }, { id: "m-target", userId: "u-t", role: "CHILD" });
    const res = await DELETE(deleteReq(), params);
    expect(res.status).toBe(403);
  });

  it("lets the OWNER remove an ADMIN", async () => {
    pair({ id: "m-caller", userId: CALLER, role: "OWNER" }, { id: "m-target", userId: "u-t", role: "ADMIN" });
    const res = await DELETE(deleteReq(), params);
    expect(res.status).toBe(200);
    expect(memberMock).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", userId: CALLER, workspace: { deletedAt: null } },
    });
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "m-target" } });
  });
});
