import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    workspaceMember: { findFirst: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/user-auth", () => ({ getUserSession: vi.fn() }));
vi.mock("@/lib/workspace-routes", () => ({ workspaceFeatureGate: vi.fn() }));

import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { GET, PUT } from "./route";

const memberMock = prisma.workspaceMember.findFirst as unknown as Mock;
const updateMock = prisma.workspaceMember.update as unknown as Mock;
const sessionMock = getUserSession as unknown as Mock;
const gateMock = workspaceFeatureGate as unknown as Mock;

const params = { params: Promise.resolve({ id: "ws-1" }) };

function putReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/workspaces/ws-1/managed-sync", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("/api/workspaces/[id]/managed-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gateMock.mockResolvedValue(null);
    sessionMock.mockResolvedValue({ userId: "u-1" });
  });

  it("GET resolves CHILD default-on when the flag is unset", async () => {
    memberMock.mockResolvedValue({ id: "m1", role: "CHILD", managedSyncEnabled: null });
    const res = await GET(new Request("http://localhost") as any, params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: true, explicit: null });
  });

  it("GET resolves a MEMBER default-off when the flag is unset", async () => {
    memberMock.mockResolvedValue({ id: "m1", role: "MEMBER", managedSyncEnabled: null });
    const res = await GET(new Request("http://localhost") as any, params);
    expect(await res.json()).toEqual({ enabled: false, explicit: null });
  });

  it("GET 404s when the caller is not a member", async () => {
    memberMock.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost") as any, params);
    expect(res.status).toBe(404);
    expect(memberMock).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", userId: "u-1", workspace: { deletedAt: null } },
    });
  });

  it("PUT sets the caller's own consent", async () => {
    memberMock.mockResolvedValue({ id: "m1", role: "MEMBER", managedSyncEnabled: null });
    updateMock.mockResolvedValue({ id: "m1", role: "MEMBER", managedSyncEnabled: true });
    const res = await PUT(putReq({ enabled: true }), params);
    expect(res.status).toBe(200);
    expect(memberMock).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", userId: "u-1", workspace: { deletedAt: null } },
    });
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "m1" }, data: { managedSyncEnabled: true } });
    expect(await res.json()).toEqual({ enabled: true, explicit: true });
  });

  it("PUT blocks members whose workspace access is read-only", async () => {
    memberMock.mockResolvedValue({ id: "m1", role: "MEMBER", status: "OVERFLOW", managedSyncEnabled: null });
    const res = await PUT(putReq({ enabled: true }), params);
    expect(res.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("PUT 422s on a non-boolean enabled", async () => {
    memberMock.mockResolvedValue({ id: "m1", role: "MEMBER", managedSyncEnabled: null });
    const res = await PUT(putReq({ enabled: "yes" }), params);
    expect(res.status).toBe(422);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns the feature gate response when the workspace model is off", async () => {
    gateMock.mockResolvedValue(new Response("", { status: 404 }));
    const res = await GET(new Request("http://localhost") as any, params);
    expect(res.status).toBe(404);
  });
});
