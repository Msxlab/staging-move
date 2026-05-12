import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  subscriptionFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findMany: (...args: unknown[]) => mocks.subscriptionFindMany(...args),
    },
  },
}));

vi.mock("@/lib/shared-billing", () => ({
  BILLING_PLAN_DEFINITIONS: {
    PRO: { monthlyPriceUsd: 10, yearlyPriceUsd: 100 },
  },
}));

function subscription(overrides: Record<string, unknown>) {
  return {
    id: "sub-active",
    userId: "user-active",
    plan: "PRO",
    status: "ACTIVE",
    provider: "STRIPE",
    platform: "web",
    billingInterval: "MONTH",
    accessType: "PAID",
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    canceledAt: null,
    trialEndsAt: null,
    lastValidatedAt: new Date("2026-05-10T00:00:00.000Z"),
    lastSyncedAt: new Date("2026-05-10T00:00:00.000Z"),
    latestTransactionId: null,
    originalTransactionId: null,
    purchaseToken: null,
    user: {
      id: "user-active",
      email: "active@example.com",
      firstName: "Active",
      lastName: "User",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      deletedAt: null,
    },
    ...overrides,
  };
}

describe("admin billing response privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T12:00:00.000Z"));
    mocks.requirePermission.mockResolvedValue({ adminId: "admin-1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("redacts soft-deleted user PII while retaining billing history", async () => {
    const deletedUser = {
      id: "user-deleted",
      email: "deleted-user@example.com",
      firstName: "Deleted",
      lastName: "Person",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: new Date("2026-05-02T00:00:00.000Z"),
    };
    mocks.subscriptionFindMany.mockResolvedValue([
      subscription({}),
      subscription({
        id: "sub-deleted-trial",
        userId: "user-deleted",
        status: "TRIALING",
        provider: "APP_STORE",
        platform: "ios",
        trialEndsAt: new Date("2026-05-13T00:00:00.000Z"),
        lastValidatedAt: null,
        latestTransactionId: null,
        originalTransactionId: null,
        user: deletedUser,
      }),
      subscription({
        id: "sub-deleted-canceled",
        userId: "user-deleted",
        status: "CANCELED",
        provider: "STRIPE",
        canceledAt: new Date("2026-05-10T00:00:00.000Z"),
        user: deletedUser,
      }),
    ]);

    const { GET } = await import("./route");
    const response = await GET(new Request("https://admin.locateflow.com/api/billing") as any);
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.totalSubscriptions).toBe(3);
    expect(serialized).not.toContain("deleted-user@example.com");
    expect(serialized).not.toContain("Deleted");
    expect(serialized).not.toContain("Person");
    expect(body.trialExpiring[0].user).toMatchObject({
      id: "user-deleted",
      email: null,
      firstName: null,
      lastName: null,
      deleted: true,
    });
    expect(body.recentCancellations[0].user.email).toBeNull();
    expect(body.staleMobileSubscriptions[0].user.email).toBeNull();
  });
});
