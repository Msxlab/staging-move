import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    workspaceMember: { findFirst: vi.fn() },
    workspace: { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/user-auth", () => ({ getUserSession: vi.fn() }));
vi.mock("@/lib/workspace-routes", () => ({ workspaceFeatureGate: vi.fn() }));
vi.mock("@/lib/workspace-step-up", () => ({
  requireWorkspaceStepUp: vi.fn(),
  auditWorkspaceSensitiveAction: vi.fn(() => Promise.resolve()),
}));

import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { auditWorkspaceSensitiveAction, requireWorkspaceStepUp } from "@/lib/workspace-step-up";
import { POST } from "./route";

const memberFind = prisma.workspaceMember.findFirst as unknown as Mock;
const updateMany = prisma.workspace.updateMany as unknown as Mock;
const sessionMock = getUserSession as unknown as Mock;
const gateMock = workspaceFeatureGate as unknown as Mock;
const stepUpMock = requireWorkspaceStepUp as unknown as Mock;
const auditMock = auditWorkspaceSensitiveAction as unknown as Mock;

const CALLER = "owner-1";
const params = { params: Promise.resolve({ id: "ws-1" }) };

function req(body: unknown = {}) {
  return new Request("http://localhost/api/workspaces/ws-1/restore", {
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
  stepUpMock.mockResolvedValue({ ok: true, method: "password" });
  auditMock.mockResolvedValue(undefined);
  updateMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/workspaces/[id]/restore", () => {
  it("requires step-up before restoring", async () => {
    stepUpMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Step-up required" }), { status: 403 }),
    });
    const res = await POST(req(), params);
    expect(res.status).toBe(403);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("restores and audits after valid step-up", async () => {
    const res = await POST(req({ confirmPassword: "pw" }), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "ws-1", restored: true });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "ws-1", deletedAt: { not: null }, deletionGraceUntil: { gt: expect.any(Date) } },
      data: { deletedAt: null, deletionGraceUntil: null },
    }));
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "WORKSPACE_RESTORE",
      stepUpMethod: "password",
    }));
  });
});
