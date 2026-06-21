import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    workspaceMember: { findFirst: vi.fn(), count: vi.fn() },
    workspace: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/user-auth", () => ({ getUserSession: vi.fn() }));
vi.mock("@/lib/workspace-routes", () => ({ workspaceFeatureGate: vi.fn(), planLabelForOwner: vi.fn() }));

import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate, planLabelForOwner } from "@/lib/workspace-routes";
import { GET, PATCH } from "./route";

const memberMock = prisma.workspaceMember.findFirst as unknown as Mock;
const countMock = prisma.workspaceMember.count as unknown as Mock;
const wsFindMock = prisma.workspace.findFirst as unknown as Mock;
const wsUpdateMock = prisma.workspace.updateMany as unknown as Mock;
const sessionMock = getUserSession as unknown as Mock;
const gateMock = workspaceFeatureGate as unknown as Mock;
const planLabelMock = planLabelForOwner as unknown as Mock;

const CALLER = "u-caller";
const params = { params: Promise.resolve({ id: "ws-1" }) };

function patchReq(body: unknown) {
  return new Request("http://localhost/api/workspaces/ws-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("PATCH /api/workspaces/[id] — rename household", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gateMock.mockResolvedValue(null);
    sessionMock.mockResolvedValue({ userId: CALLER });
    wsUpdateMock.mockResolvedValue({ count: 1 });
  });

  it("404s when the workspace feature is off (gate short-circuits)", async () => {
    gateMock.mockResolvedValue(new Response(JSON.stringify({ error: "Not found" }), { status: 404 }));
    const res = await PATCH(patchReq({ name: "Home" }), params);
    expect(res.status).toBe(404);
    expect(memberMock).not.toHaveBeenCalled();
  });

  it("401s without a session", async () => {
    sessionMock.mockResolvedValue(null);
    const res = await PATCH(patchReq({ name: "Home" }), params);
    expect(res.status).toBe(401);
  });

  it("404s when the caller is not a member", async () => {
    memberMock.mockResolvedValue(null);
    const res = await PATCH(patchReq({ name: "Home" }), params);
    expect(res.status).toBe(404);
  });

  it("403s when the caller is an ADMIN (rename is owner-only)", async () => {
    memberMock.mockResolvedValue({ id: "m", userId: CALLER, role: "ADMIN", status: "ACTIVE" });
    const res = await PATCH(patchReq({ name: "Home" }), params);
    expect(res.status).toBe(403);
    expect(wsUpdateMock).not.toHaveBeenCalled();
  });

  it("403s when an OWNER is read-only (OVERFLOW/SUSPENDED)", async () => {
    memberMock.mockResolvedValue({ id: "m", userId: CALLER, role: "OWNER", status: "OVERFLOW" });
    const res = await PATCH(patchReq({ name: "Home" }), params);
    expect(res.status).toBe(403);
  });

  it("422s on an empty name", async () => {
    memberMock.mockResolvedValue({ id: "m", userId: CALLER, role: "OWNER", status: "ACTIVE" });
    const res = await PATCH(patchReq({ name: "   " }), params);
    expect(res.status).toBe(422);
    expect(wsUpdateMock).not.toHaveBeenCalled();
  });

  it("422s on a name longer than 60 characters", async () => {
    memberMock.mockResolvedValue({ id: "m", userId: CALLER, role: "OWNER", status: "ACTIVE" });
    const res = await PATCH(patchReq({ name: "x".repeat(61) }), params);
    expect(res.status).toBe(422);
  });

  it("lets the OWNER rename, trimming whitespace", async () => {
    memberMock.mockResolvedValue({ id: "m", userId: CALLER, role: "OWNER", status: "ACTIVE" });
    const res = await PATCH(patchReq({ name: "  The Smiths  " }), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("The Smiths");
    expect(memberMock).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", userId: CALLER, workspace: { deletedAt: null } },
    });
    expect(wsUpdateMock).toHaveBeenCalledWith({
      where: { id: "ws-1", deletedAt: null },
      data: { name: "The Smiths" },
    });
  });

  it("404s instead of renaming a soft-deleted workspace", async () => {
    memberMock.mockResolvedValue({ id: "m", userId: CALLER, role: "OWNER", status: "ACTIVE" });
    wsUpdateMock.mockResolvedValueOnce({ count: 0 });

    const res = await PATCH(patchReq({ name: "Archived" }), params);

    expect(res.status).toBe(404);
    expect(wsUpdateMock).toHaveBeenCalledWith({
      where: { id: "ws-1", deletedAt: null },
      data: { name: "Archived" },
    });
  });
});

describe("GET /api/workspaces/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gateMock.mockResolvedValue(null);
    sessionMock.mockResolvedValue({ userId: CALLER });
    planLabelMock.mockResolvedValue("Family");
  });

  it("401s without a session", async () => {
    sessionMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/workspaces/ws-1") as any, params);
    expect(res.status).toBe(401);
  });

  it("returns workspace detail for a member", async () => {
    memberMock.mockResolvedValue({ id: "m", userId: CALLER, role: "OWNER", status: "ACTIVE" });
    wsFindMock.mockResolvedValue({ id: "ws-1", name: "Home", ownerUserId: CALLER, createdAt: new Date(0) });
    countMock.mockResolvedValue(3);
    const res = await GET(new Request("http://localhost/api/workspaces/ws-1") as any, params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: "ws-1", name: "Home", role: "OWNER", memberCount: 3, planLabel: "Family" });
    expect(memberMock).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", userId: CALLER, workspace: { deletedAt: null } },
    });
    expect(wsFindMock).toHaveBeenCalledWith({ where: { id: "ws-1", deletedAt: null } });
  });

  it("404s when the membership row remains but the workspace is soft-deleted", async () => {
    memberMock.mockResolvedValue({ id: "m", userId: CALLER, role: "OWNER", status: "ACTIVE" });
    wsFindMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/workspaces/ws-1") as any, params);

    expect(res.status).toBe(404);
    expect(countMock).not.toHaveBeenCalled();
  });
});
