import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    movingPlan: {
      findUnique: vi.fn(),
      update: vi.fn(),
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

vi.mock("@/lib/move-task-sync", () => ({
  syncMoveTasksForPlans: vi.fn(() => Promise.resolve({ attemptedPlans: 0 })),
}));

import { prisma } from "@/lib/db";
import { requireAppMutationUser } from "@/lib/api-gates";
import { createAuditLog } from "@/lib/audit";
import { DELETE } from "./route";

const mockRequireAppMutationUser = requireAppMutationUser as unknown as Mock;
const mockCreateAuditLog = createAuditLog as unknown as Mock;
const mockPlan = (prisma as unknown as {
  movingPlan: { findUnique: Mock; update: Mock };
}).movingPlan;
const mockMoveTask = (prisma as unknown as { moveTask: { updateMany: Mock } }).moveTask;
const mockTransaction = (prisma as unknown as { $transaction: Mock }).$transaction;

function idParams(id = "plan-1") {
  return { params: Promise.resolve({ id }) };
}

describe("moving plan DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAppMutationUser.mockResolvedValue("user-1");
    mockPlan.findUnique.mockResolvedValue({
      id: "plan-1",
      userId: "user-1",
      deletedAt: null,
    });
    // The handler builds the transaction array by calling these first, so give
    // them sentinel return values we can assert were passed to $transaction.
    mockMoveTask.updateMany.mockReturnValue("move-task-soft-delete-op");
    mockPlan.update.mockReturnValue("plan-soft-delete-op");
    mockTransaction.mockResolvedValue([{ count: 4 }, { id: "plan-1" }]);
  });

  it("soft-deletes the plan's move tasks alongside the plan in one transaction", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/moving/plan-1", { method: "DELETE" }) as any,
      idParams() as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });

    expect(mockMoveTask.updateMany).toHaveBeenCalledWith({
      where: { movingPlanId: "plan-1", userId: "user-1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockPlan.update).toHaveBeenCalledWith({
      where: { id: "plan-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockTransaction).toHaveBeenCalledWith([
      "move-task-soft-delete-op",
      "plan-soft-delete-op",
    ]);
  });

  it("records the number of move tasks removed in the audit log", async () => {
    await DELETE(
      new Request("http://localhost/api/moving/plan-1", { method: "DELETE" }) as any,
      idParams() as any,
    );

    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DELETE",
        entityType: "MovingPlan",
        entityId: "plan-1",
        changes: expect.objectContaining({ moveTasksDeleted: 4 }),
      }),
    );
  });

  it("does not touch another user's moving plan", async () => {
    mockPlan.findUnique.mockResolvedValueOnce({
      id: "plan-1",
      userId: "someone-else",
      deletedAt: null,
    });

    const response = await DELETE(
      new Request("http://localhost/api/moving/plan-1", { method: "DELETE" }) as any,
      idParams() as any,
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Moving plan not found");
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockMoveTask.updateMany).not.toHaveBeenCalled();
  });
});
