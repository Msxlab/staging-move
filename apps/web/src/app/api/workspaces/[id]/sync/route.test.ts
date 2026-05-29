import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    workspaceMember: { findFirst: vi.fn() },
    workspace: { findUnique: vi.fn() },
    address: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/user-auth", () => ({ getUserSession: vi.fn() }));
vi.mock("@/lib/connector-oauth", () => ({ isApiConnectorsEnabled: vi.fn(), userHasApiConnectorEntitlement: vi.fn() }));
vi.mock("@/lib/workspace-routes", () => ({ workspaceFeatureGate: vi.fn() }));
vi.mock("@/lib/connector-runtime", () => ({ enqueueAddressChange: vi.fn() }));

import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { isApiConnectorsEnabled, userHasApiConnectorEntitlement } from "@/lib/connector-oauth";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import { enqueueAddressChange } from "@/lib/connector-runtime";
import { POST } from "./route";

const memberMock = prisma.workspaceMember.findFirst as unknown as Mock;
const workspaceMock = prisma.workspace.findUnique as unknown as Mock;
const addressMock = prisma.address.findFirst as unknown as Mock;
const sessionMock = getUserSession as unknown as Mock;
const connectorsMock = isApiConnectorsEnabled as unknown as Mock;
const entitlementMock = userHasApiConnectorEntitlement as unknown as Mock;
const gateMock = workspaceFeatureGate as unknown as Mock;
const enqueueMock = enqueueAddressChange as unknown as Mock;

const CALLER = "u-caller";
const TARGET = "u-target";

function call(body: Record<string, unknown>, id = "ws-1") {
  return POST(
    new Request(`http://localhost/api/workspaces/${id}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as any,
    { params: Promise.resolve({ id }) },
  );
}

/** Route resolves the caller's membership by userId; on-behalf also looks up the target. */
function membership(roles: { caller?: any; target?: any }) {
  memberMock.mockImplementation(({ where }: any) => {
    if (where.userId === CALLER) return Promise.resolve(roles.caller ?? null);
    if (where.userId === TARGET) return Promise.resolve(roles.target ?? null);
    return Promise.resolve(null);
  });
}

describe("POST /api/workspaces/[id]/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gateMock.mockResolvedValue(null); // feature on
    sessionMock.mockResolvedValue({ userId: CALLER });
    connectorsMock.mockResolvedValue(true);
    entitlementMock.mockResolvedValue(true);
    workspaceMock.mockResolvedValue({ ownerUserId: "owner-1" });
    addressMock.mockResolvedValue({ id: "a1" });
    enqueueMock.mockResolvedValue({ enqueued: 1 });
  });

  it("returns the feature gate response when the workspace model is off", async () => {
    gateMock.mockResolvedValue(new Response("", { status: 404 }));
    const res = await call({ toAddressId: "a1" });
    expect(res.status).toBe(404);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("503s when connectors are disabled", async () => {
    connectorsMock.mockResolvedValue(false);
    const res = await call({ toAddressId: "a1" });
    expect(res.status).toBe(503);
  });

  it("403s when the workspace plan lacks the connector entitlement", async () => {
    membership({ caller: { role: "MEMBER", status: "ACTIVE" } });
    entitlementMock.mockResolvedValue(false);
    const res = await call({ toAddressId: "a1" });
    expect(res.status).toBe(403);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("404s when the caller is not a member", async () => {
    membership({ caller: null });
    const res = await call({ toAddressId: "a1" });
    expect(res.status).toBe(404);
  });

  it("422s when toAddressId is missing", async () => {
    membership({ caller: { role: "MEMBER", status: "ACTIVE" } });
    const res = await call({});
    expect(res.status).toBe(422);
  });

  it("self: a MEMBER enqueues for themselves", async () => {
    membership({ caller: { role: "MEMBER", status: "ACTIVE" } });
    const res = await call({ toAddressId: "a1" });
    expect(res.status).toBe(200);
    expect(enqueueMock).toHaveBeenCalledWith({ userId: CALLER, toAddressId: "a1", fromAddressId: null });
  });

  it("self: a CHILD cannot initiate a sync", async () => {
    membership({ caller: { role: "CHILD", status: "ACTIVE" } });
    const res = await call({ toAddressId: "a1" });
    expect(res.status).toBe(403);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("self: a SUSPENDED member cannot initiate", async () => {
    membership({ caller: { role: "MEMBER", status: "SUSPENDED" } });
    const res = await call({ toAddressId: "a1" });
    expect(res.status).toBe(403);
  });

  it("on-behalf: a non-manager (MEMBER) is forbidden", async () => {
    membership({ caller: { role: "MEMBER", status: "ACTIVE" }, target: { role: "CHILD", managedSyncEnabled: null } });
    const res = await call({ toAddressId: "a1", onBehalfOfUserId: TARGET });
    expect(res.status).toBe(403);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("on-behalf: a target who hasn't consented is forbidden", async () => {
    membership({ caller: { role: "OWNER", status: "ACTIVE" }, target: { role: "MEMBER", managedSyncEnabled: null } });
    const res = await call({ toAddressId: "a1", onBehalfOfUserId: TARGET });
    expect(res.status).toBe(403);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("on-behalf: a consenting CHILD target enqueues for the target", async () => {
    membership({ caller: { role: "OWNER", status: "ACTIVE" }, target: { role: "CHILD", managedSyncEnabled: null } });
    addressMock.mockImplementation(({ where }: any) =>
      Promise.resolve(where.userId === TARGET ? { id: "a1" } : null),
    );
    const res = await call({ toAddressId: "a1", onBehalfOfUserId: TARGET });
    expect(res.status).toBe(200);
    expect(enqueueMock).toHaveBeenCalledWith({ userId: TARGET, toAddressId: "a1", fromAddressId: null });
  });

  it("on-behalf: an opted-in MEMBER target is allowed", async () => {
    membership({ caller: { role: "ADMIN", status: "ACTIVE" }, target: { role: "MEMBER", managedSyncEnabled: true } });
    const res = await call({ toAddressId: "a1", onBehalfOfUserId: TARGET });
    expect(res.status).toBe(200);
    expect(enqueueMock).toHaveBeenCalledWith({ userId: TARGET, toAddressId: "a1", fromAddressId: null });
  });

  it("on-behalf: a missing target member 404s", async () => {
    membership({ caller: { role: "OWNER", status: "ACTIVE" }, target: null });
    const res = await call({ toAddressId: "a1", onBehalfOfUserId: TARGET });
    expect(res.status).toBe(404);
  });

  it("404s when the destination address does not belong to the subject", async () => {
    membership({ caller: { role: "MEMBER", status: "ACTIVE" } });
    addressMock.mockResolvedValue(null);
    const res = await call({ toAddressId: "a1" });
    expect(res.status).toBe(404);
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});
