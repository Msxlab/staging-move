import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    address: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/user-auth", () => ({
  getUserSession: vi.fn(),
}));

vi.mock("@/lib/connector-oauth", () => ({
  isApiConnectorsEnabled: vi.fn(),
  userHasApiConnectorEntitlement: vi.fn(),
}));

vi.mock("@/lib/connector-runtime", () => ({
  enqueueAddressChange: vi.fn(),
}));

vi.mock("@/lib/workspace-data-scope", () => ({
  assertWorkspaceAction: vi.fn(),
  resolveWorkspaceDataScope: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { isApiConnectorsEnabled, userHasApiConnectorEntitlement } from "@/lib/connector-oauth";
import { enqueueAddressChange } from "@/lib/connector-runtime";
import { getUserSession } from "@/lib/user-auth";
import { resolveWorkspaceDataScope } from "@/lib/workspace-data-scope";
import { POST } from "./route";

const addressFindMock = prisma.address.findFirst as unknown as Mock;
const enabledMock = isApiConnectorsEnabled as unknown as Mock;
const entitlementMock = userHasApiConnectorEntitlement as unknown as Mock;
const enqueueMock = enqueueAddressChange as unknown as Mock;
const sessionMock = getUserSession as unknown as Mock;
const scopeMock = resolveWorkspaceDataScope as unknown as Mock;

function request(body: unknown = {}) {
  return new NextRequest("https://locateflow.com/api/connector-dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-workspace-id": "ws_1" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMock.mockResolvedValue({ userId: "member_1" });
  scopeMock.mockResolvedValue({
    actorUserId: "member_1",
    ownerUserId: "owner_1",
    workspaceId: "ws_1",
    workspaceMode: true,
    memberRole: "MEMBER",
    memberStatus: "ACTIVE",
  });
  enabledMock.mockResolvedValue(true);
  entitlementMock.mockResolvedValue(true);
  addressFindMock.mockResolvedValue({ id: "addr_1" });
  enqueueMock.mockResolvedValue({ changeRef: "change_1", created: 1 });
});

describe("POST /api/connector-dispatch", () => {
  it("defaults Sync now to the caller's primary address in the selected workspace", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(entitlementMock).toHaveBeenCalledWith("owner_1");
    expect(addressFindMock).toHaveBeenCalledWith({
      where: { userId: "member_1", isPrimary: true, deletedAt: null, workspaceId: "ws_1" },
      select: { id: true },
    });
    expect(enqueueMock).toHaveBeenCalledWith({
      userId: "member_1",
      toAddressId: "addr_1",
      fromAddressId: null,
      workspaceId: "ws_1",
    });
  });

  it("keeps explicit address sync scoped to the selected workspace", async () => {
    await POST(request({ toAddressId: "addr_2", fromAddressId: "addr_old" }));

    expect(addressFindMock).not.toHaveBeenCalled();
    expect(enqueueMock).toHaveBeenCalledWith({
      userId: "member_1",
      toAddressId: "addr_2",
      fromAddressId: "addr_old",
      workspaceId: "ws_1",
    });
  });
});
