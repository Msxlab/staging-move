import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  subscriptionFindMany: vi.fn(),
  subscriptionCount: vi.fn(),
  subscriptionGroupBy: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: (...args: unknown[]) => mocks.requirePermission(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findMany: (...args: unknown[]) => mocks.subscriptionFindMany(...args),
      count: (...args: unknown[]) => mocks.subscriptionCount(...args),
      groupBy: (...args: unknown[]) => mocks.subscriptionGroupBy(...args),
    },
    adminAuditLog: {
      create: (...args: unknown[]) => mocks.auditCreate(...args),
    },
  },
}));

describe("admin subscriptions response privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin-1", email: "admin@example.com", role: "VIEWER" });
    mocks.subscriptionCount.mockResolvedValue(1);
    mocks.subscriptionGroupBy.mockResolvedValue([]);
    mocks.auditCreate.mockResolvedValue({ id: "audit_1" });
  });

  it("redacts soft-deleted user PII in subscription rows", async () => {
    mocks.subscriptionFindMany.mockResolvedValue([
      {
        id: "sub-1",
        userId: "user-deleted",
        plan: "PRO",
        status: "CANCELED",
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        user: {
          id: "user-deleted",
          email: "deleted-sub@example.com",
          firstName: "Deleted",
          lastName: "Subscriber",
          deletedAt: new Date("2026-05-05T00:00:00.000Z"),
        },
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET(new Request("https://admin.locateflow.com/api/subscriptions") as any);
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(serialized).not.toContain("deleted-sub@example.com");
    expect(serialized).not.toContain("Subscriber");
    expect(body.subscriptions[0].user).toEqual({
      id: "user-deleted",
      email: null,
      firstName: null,
      lastName: null,
      deleted: true,
    });
  });

  it("masks active user email and provider identifiers for VIEWER", async () => {
    mocks.subscriptionFindMany.mockResolvedValue([
      {
        id: "sub-1",
        userId: "user-1",
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "STRIPE",
        platform: "web",
        billingInterval: "MONTH",
        accessType: "PAID",
        stripeCustomerId: "cus_live_sensitive1234",
        stripeSubscriptionId: "sub_live_sensitive5678",
        stripePriceId: "price_live_sensitive9012",
        stripeCurrentPeriodEnd: null,
        billingProductId: null,
        originalTransactionId: "100000111122223333",
        latestTransactionId: "100000111122224444",
        purchaseToken: "raw-play-token",
        currentPeriodEndsAt: null,
        gracePeriodEndsAt: null,
        lastValidatedAt: null,
        lastSyncedAt: null,
        freeAccessEndsAt: null,
        cancelAtPeriodEnd: false,
        firstChargeAt: null,
        firstChargeAmount: null,
        autoRenew: true,
        campaignId: null,
        campaignCode: null,
        trialEndsAt: null,
        canceledAt: null,
        premiumUntil: null,
        premiumGrantedBy: null,
        premiumGrantedAt: null,
        version: 1,
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        updatedAt: new Date("2026-05-01T00:00:00.000Z"),
        user: {
          id: "user-1",
          email: "active-sub@example.com",
          firstName: "Active",
          lastName: "Subscriber",
          deletedAt: null,
        },
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET(new Request("https://admin.locateflow.com/api/subscriptions") as any);
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.subscriptions[0].user.email).toBe("ac***@example.com");
    expect(body.subscriptions[0].stripeCustomerId).toBe("cus_****1234");
    expect(body.subscriptions[0].stripeSubscriptionId).toBe("sub_****5678");
    expect(body.subscriptions[0].purchaseTokenPresent).toBe(true);
    expect(serialized).not.toContain("active-sub@example.com");
    expect(serialized).not.toContain("cus_live_sensitive1234");
    expect(serialized).not.toContain("sub_live_sensitive5678");
    expect(serialized).not.toContain("raw-play-token");
    expect(serialized).not.toContain("purchaseTokenHash");
  });

  it("returns raw operational IDs to ADMIN but never returns purchaseToken", async () => {
    mocks.requirePermission.mockResolvedValue({ adminId: "admin-1", email: "admin@example.com", role: "ADMIN" });
    mocks.subscriptionFindMany.mockResolvedValue([
      {
        id: "sub-1",
        userId: "user-1",
        plan: "INDIVIDUAL",
        status: "ACTIVE",
        provider: "STRIPE",
        platform: "web",
        billingInterval: "MONTH",
        accessType: "PAID",
        stripeCustomerId: "cus_live_sensitive1234",
        stripeSubscriptionId: "sub_live_sensitive5678",
        stripePriceId: null,
        stripeCurrentPeriodEnd: null,
        billingProductId: null,
        originalTransactionId: null,
        latestTransactionId: null,
        purchaseToken: "raw-play-token",
        currentPeriodEndsAt: null,
        gracePeriodEndsAt: null,
        lastValidatedAt: null,
        lastSyncedAt: null,
        freeAccessEndsAt: null,
        cancelAtPeriodEnd: false,
        firstChargeAt: null,
        firstChargeAmount: null,
        autoRenew: true,
        campaignId: null,
        campaignCode: null,
        trialEndsAt: null,
        canceledAt: null,
        premiumUntil: null,
        premiumGrantedBy: null,
        premiumGrantedAt: null,
        version: 1,
        createdAt: new Date("2026-05-01T00:00:00.000Z"),
        updatedAt: new Date("2026-05-01T00:00:00.000Z"),
        user: {
          id: "user-1",
          email: "active-sub@example.com",
          firstName: "Active",
          lastName: "Subscriber",
          deletedAt: null,
        },
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET(new Request("https://admin.locateflow.com/api/subscriptions") as any);
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.subscriptions[0].user.email).toBe("active-sub@example.com");
    expect(body.subscriptions[0].stripeCustomerId).toBe("cus_live_sensitive1234");
    expect(body.subscriptions[0].stripeSubscriptionId).toBe("sub_live_sensitive5678");
    expect(body.subscriptions[0]).not.toHaveProperty("purchaseToken");
    expect(serialized).not.toContain("raw-play-token");
  });

  it("audits subscription list reads without raw search text", async () => {
    mocks.subscriptionFindMany.mockResolvedValue([]);
    mocks.subscriptionCount.mockResolvedValue(0);

    const { GET } = await import("./route");
    const response = await GET(new Request("https://admin.locateflow.com/api/subscriptions?search=person@example.com") as any);
    const serializedAudit = JSON.stringify(mocks.auditCreate.mock.calls);

    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "SUBSCRIPTIONS_LIST_VIEWED", entityType: "Subscription" }),
    });
    expect(serializedAudit).not.toContain("person@example.com");
    expect(serializedAudit).toContain("searchPresent");
  });
});
