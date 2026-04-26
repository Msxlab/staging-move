import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canGenerateMoveTasks: vi.fn(),
  movingPlanFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    movingPlan: { findUnique: mocks.movingPlanFindUnique },
    service: { findMany: vi.fn() },
    serviceProvider: { findMany: vi.fn() },
    moveTask: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/plan-limits", () => ({
  canGenerateMoveTasks: mocks.canGenerateMoveTasks,
}));

vi.mock("@/lib/provider-matching", () => ({
  getProviderCoverageConfidenceFromDb: vi.fn(() => "STATE"),
  resolveEffectiveState: vi.fn((state: string) => state),
}));

vi.mock("@locateflow/db", () => ({
  getProviderCoverageMetadata: vi.fn(() => null),
}));

vi.mock("@locateflow/shared", async () => {
  const actual = await vi.importActual<any>("@locateflow/shared");
  return {
    ...actual,
    classifyMoveServiceTransition: vi.fn(),
    safeJsonArray: vi.fn(() => []),
  };
});

import { syncSuggestedMoveTasks } from "./move-task-generation";

describe("syncSuggestedMoveTasks entitlement guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails before reading plan data when move-task generation is not entitled", async () => {
    mocks.canGenerateMoveTasks.mockResolvedValue({
      allowed: false,
      reason: "Subscription required",
      upgradeRequired: true,
    });

    await expect(syncSuggestedMoveTasks("user_1", "move_1")).rejects.toThrow(
      "MOVE_TASK_GENERATION_NOT_ENTITLED",
    );
    expect(mocks.movingPlanFindUnique).not.toHaveBeenCalled();
  });
});
