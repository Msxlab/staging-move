import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    userCustomProvider: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    service: {
      updateMany: vi.fn(),
    },
    moveTask: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

// Partial mock: keep the real apiGateErrorResponse and only stub the gate that
// the DELETE handler awaits.
vi.mock("@/lib/api-gates", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-gates")>("@/lib/api-gates");
  return {
    ...actual,
    requireAppMutationUser: vi.fn(),
  };
});

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
  extractRequestMeta: vi.fn(() => ({})),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "cp-rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

import { prisma } from "@/lib/db";
import { requireAppMutationUser } from "@/lib/api-gates";
import { createAuditLog } from "@/lib/audit";
import { DELETE } from "./route";

const mockRequireAppMutationUser = requireAppMutationUser as unknown as Mock;
const mockCreateAuditLog = createAuditLog as unknown as Mock;
const mockProvider = (prisma as unknown as {
  userCustomProvider: { findFirst: Mock; update: Mock };
}).userCustomProvider;
const mockService = (prisma as unknown as { service: { updateMany: Mock } }).service;
const mockMoveTask = (prisma as unknown as { moveTask: { updateMany: Mock } }).moveTask;
const mockTransaction = (prisma as unknown as { $transaction: Mock }).$transaction;

function idParams(id = "cp-1") {
  return { params: Promise.resolve({ id }) };
}

describe("custom provider detail DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAppMutationUser.mockResolvedValue("user-1");
    mockProvider.findFirst.mockResolvedValue({
      id: "cp-1",
      userId: "user-1",
      deletedAt: null,
      name: "Joe's Plumbing",
      category: "HOME_SERVICES",
    });
    // The handler builds the transaction array by *calling* these first, so give
    // them sentinel return values we can assert were passed to $transaction.
    mockService.updateMany.mockReturnValue("service-detach-op");
    mockMoveTask.updateMany.mockReturnValue("move-task-detach-op");
    mockProvider.update.mockReturnValue("provider-soft-delete-op");
    mockTransaction.mockResolvedValue([{ count: 3 }, { count: 1 }, { id: "cp-1" }]);
  });

  it("detaches the user's services and move tasks before soft-deleting, in one transaction", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/custom-providers/cp-1", { method: "DELETE" }) as any,
      idParams() as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });

    // References are nulled, not the rows deleted — services keep their data.
    expect(mockService.updateMany).toHaveBeenCalledWith({
      where: { customProviderId: "cp-1", userId: "user-1", deletedAt: null },
      data: { customProviderId: null },
    });
    expect(mockMoveTask.updateMany).toHaveBeenCalledWith({
      where: { customProviderId: "cp-1", userId: "user-1", deletedAt: null },
      data: { customProviderId: null },
    });
    expect(mockProvider.update).toHaveBeenCalledWith({
      where: { id: "cp-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockTransaction).toHaveBeenCalledWith([
      "service-detach-op",
      "move-task-detach-op",
      "provider-soft-delete-op",
    ]);
  });

  it("records the detached counts in the audit log", async () => {
    await DELETE(
      new Request("http://localhost/api/custom-providers/cp-1", { method: "DELETE" }) as any,
      idParams() as any,
    );

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DELETE",
        entityType: "UserCustomProvider",
        entityId: "cp-1",
        changes: expect.objectContaining({ servicesDetached: 3, moveTasksDetached: 1 }),
      }),
    );
  });

  it("does not touch another user's custom provider", async () => {
    mockProvider.findFirst.mockResolvedValueOnce(null);

    const response = await DELETE(
      new Request("http://localhost/api/custom-providers/cp-1", { method: "DELETE" }) as any,
      idParams() as any,
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Custom provider not found");
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockService.updateMany).not.toHaveBeenCalled();
    expect(mockMoveTask.updateMany).not.toHaveBeenCalled();
  });
});
