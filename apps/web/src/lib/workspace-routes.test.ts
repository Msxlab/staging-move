import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  subscriptionFindUnique: vi.fn(),
  isWorkspaceModelEnabled: vi.fn(),
  resolveConsumerEntitlement: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findUnique: (...args: unknown[]) => mocks.subscriptionFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/workspace-context", () => ({
  isWorkspaceModelEnabled: (...args: unknown[]) => mocks.isWorkspaceModelEnabled(...args),
}));

vi.mock("@/lib/consumer-entitlement", () => ({
  resolveConsumerEntitlement: (...args: unknown[]) => mocks.resolveConsumerEntitlement(...args),
}));

import { planLabelForOwner, planSummaryForOwner, workspaceFeatureGate } from "./workspace-routes";

describe("workspace consumer entitlement summaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscriptionFindUnique.mockResolvedValue(null);
    mocks.resolveConsumerEntitlement.mockResolvedValue({
      entitlement: { effectivePlan: "PRO" },
      consumerFreeApplied: true,
    });
  });

  it("uses the consumer-resolved plan for owner labels and seat limits", async () => {
    await expect(planLabelForOwner("owner_1")).resolves.toBe("Workspace");
    await expect(planSummaryForOwner("owner_1")).resolves.toEqual({
      planLabel: "Workspace",
      seatLimit: 10,
    });
    expect(mocks.resolveConsumerEntitlement).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the workspace model is disabled", async () => {
    mocks.isWorkspaceModelEnabled.mockResolvedValue(false);

    const response = await workspaceFeatureGate();
    await expect(response?.json()).resolves.toMatchObject({ code: "WORKSPACE_DISABLED" });
    expect(response?.status).toBe(404);
  });
});
