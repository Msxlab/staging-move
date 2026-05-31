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
import { syncMoveTasksForPlans } from "@/lib/move-task-sync";
import { DELETE, PATCH } from "./route";

const mockRequireAppMutationUser = requireAppMutationUser as unknown as Mock;
const mockCreateAuditLog = createAuditLog as unknown as Mock;
const mockSyncMoveTasksForPlans = syncMoveTasksForPlans as unknown as Mock;
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

describe("moving plan PATCH lifecycle sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAppMutationUser.mockResolvedValue("user-1");
    mockPlan.findUnique.mockResolvedValue({
      id: "plan-1",
      userId: "user-1",
      deletedAt: null,
      status: "PLANNING",
    });
    mockMoveTask.updateMany.mockResolvedValue({ count: 3 });
    mockSyncMoveTasksForPlans.mockResolvedValue({ attemptedPlans: 1 });
  });

  function patchRequest(body: unknown) {
    return new Request("http://localhost/api/moving/plan-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("retires the plan's suggested tasks on cancel instead of regenerating them", async () => {
    mockPlan.update.mockResolvedValue({ id: "plan-1", userId: "user-1", status: "CANCELED" });

    const response = await PATCH(patchRequest({ status: "CANCELED" }) as any, idParams() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    // Canceled plan's CLASSIFIER tasks are soft-deleted so they leave the feed.
    expect(mockMoveTask.updateMany).toHaveBeenCalledWith({
      where: { movingPlanId: "plan-1", userId: "user-1", source: "CLASSIFIER", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    // The bug being guarded against: cancel must NOT re-run generation.
    expect(mockSyncMoveTasksForPlans).not.toHaveBeenCalled();
    expect(body.moveTaskSync).toEqual({ retiredSuggestedTasks: 3 });
  });

  it("does not spawn fresh suggestions when a plan is completed", async () => {
    mockPlan.findUnique.mockResolvedValue({
      id: "plan-1",
      userId: "user-1",
      deletedAt: null,
      status: "IN_PROGRESS",
    });
    mockPlan.update.mockResolvedValue({ id: "plan-1", userId: "user-1", status: "COMPLETED" });

    const response = await PATCH(patchRequest({ status: "COMPLETED" }) as any, idParams() as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSyncMoveTasksForPlans).not.toHaveBeenCalled();
    expect(mockMoveTask.updateMany).not.toHaveBeenCalled();
    expect(body.moveTaskSync).toEqual({ skipped: "plan_completed" });
  });

  it("still re-syncs suggested tasks for a non-terminal edit (e.g. moveDate)", async () => {
    mockPlan.update.mockResolvedValue({ id: "plan-1", userId: "user-1", status: "PLANNING" });

    const response = await PATCH(
      patchRequest({ moveDate: "2026-09-01T00:00:00.000Z" }) as any,
      idParams() as any,
    );

    expect(response.status).toBe(200);
    expect(mockSyncMoveTasksForPlans).toHaveBeenCalledWith("user-1", ["plan-1"]);
    expect(mockMoveTask.updateMany).not.toHaveBeenCalled();
  });
});
