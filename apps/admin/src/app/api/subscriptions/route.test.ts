import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  subscriptionFindMany: vi.fn(),
  subscriptionCount: vi.fn(),
  subscriptionGroupBy: vi.fn(),
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
  },
}));

describe("admin subscriptions response privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin-1" });
    mocks.subscriptionCount.mockResolvedValue(1);
    mocks.subscriptionGroupBy.mockResolvedValue([]);
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
});
