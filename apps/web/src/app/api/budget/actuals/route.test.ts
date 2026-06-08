import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    service: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    serviceCostLog: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    budget: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/api-gates", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-gates")>("@/lib/api-gates");
  return { ...actual, requireAppMutationUser: vi.fn() };
});

vi.mock("@/lib/plan-limits", () => ({
  getPlanForLimitScope: vi.fn(() => Promise.resolve({ isActive: true, hasPremium: true })),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "actual-rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

import { prisma } from "@/lib/db";
import { requireAppMutationUser } from "@/lib/api-gates";
import { GET, POST } from "./route";

const requireAppMutationUserMock = requireAppMutationUser as unknown as Mock;
const serviceMock = prisma.service as unknown as {
  findUnique: Mock;
  findMany: Mock;
  update: Mock;
};
const logMock = prisma.serviceCostLog as unknown as { upsert: Mock; deleteMany: Mock };
const budgetMock = prisma.budget as unknown as { findFirst: Mock; update: Mock };

function postRequest(body: unknown) {
  return new Request("http://localhost/api/budget/actuals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("budget actuals route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAppMutationUserMock.mockResolvedValue("user-1");
    serviceMock.findUnique.mockResolvedValue({
      id: "svc-1",
      userId: "user-1",
      workspaceId: null,
      addressId: "addr-1",
      deletedAt: null,
    });
    serviceMock.findMany.mockResolvedValue([]);
    serviceMock.update.mockResolvedValue({});
    logMock.upsert.mockImplementation(({ create, update }) =>
      Promise.resolve({ amount: (update?.amount ?? create?.amount) }),
    );
    logMock.deleteMany.mockResolvedValue({ count: 1 });
    budgetMock.findFirst.mockResolvedValue(null);
  });

  it("upserts the cost log for the VIEWED month (normalized to month-start UTC)", async () => {
    const response = await POST(
      postRequest({ serviceId: "svc-1", month: "2026-03-20T12:00:00.000Z", amount: 80 }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.loggedActual).toBe(80);
    expect(logMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          serviceId_month: { serviceId: "svc-1", month: new Date("2026-03-01T00:00:00.000Z") },
        },
        create: { serviceId: "svc-1", month: new Date("2026-03-01T00:00:00.000Z"), amount: 80 },
        update: { amount: 80 },
      }),
    );
    // A PAST month must NOT overwrite the legacy current-month scalar.
    expect(serviceMock.update).not.toHaveBeenCalled();
  });

  it("clears the cost log for the month when amount is null", async () => {
    const response = await POST(
      postRequest({ serviceId: "svc-1", month: "2026-03-01", amount: null }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.loggedActual).toBeNull();
    expect(logMock.deleteMany).toHaveBeenCalledWith({
      where: { serviceId: "svc-1", month: new Date("2026-03-01T00:00:00.000Z") },
    });
    expect(logMock.upsert).not.toHaveBeenCalled();
  });

  it("is IDOR-safe: a service owned by another user is 404 and never written", async () => {
    serviceMock.findUnique.mockResolvedValue({
      id: "svc-1",
      userId: "someone-else",
      workspaceId: null,
      addressId: "addr-9",
      deletedAt: null,
    });

    const response = await POST(
      postRequest({ serviceId: "svc-1", month: "2026-03-01", amount: 50 }),
    );

    // Non-workspace scope returns the NOT_FOUND gate for a foreign record.
    expect(response.status).toBe(404);
    expect(logMock.upsert).not.toHaveBeenCalled();
    expect(logMock.deleteMany).not.toHaveBeenCalled();
  });

  it("404s a missing/deleted service", async () => {
    serviceMock.findUnique.mockResolvedValue(null);
    const response = await POST(postRequest({ serviceId: "gone", month: "2026-03-01", amount: 10 }));
    expect(response.status).toBe(404);
    expect(logMock.upsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid month", async () => {
    const response = await POST(
      postRequest({ serviceId: "svc-1", month: "not-a-month", amount: 10 }),
    );
    expect(response.status).toBe(400);
    expect(logMock.upsert).not.toHaveBeenCalled();
  });

  it("GET returns each service's logged actual for the viewed month", async () => {
    const { requireDbUserId } = await import("@/lib/auth");
    (requireDbUserId as unknown as Mock).mockResolvedValue("user-1");
    serviceMock.findMany.mockResolvedValue([
      {
        id: "svc-1",
        providerName: "Electric Co",
        category: "UTILITY_ELECTRIC",
        addressId: "addr-1",
        monthlyCost: 100,
        billingCycle: "MONTHLY",
        isActive: true,
        activatedAt: null,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        costLogs: [{ amount: 80 }],
      },
      {
        id: "svc-2",
        providerName: "Internet Co",
        category: "UTILITY_INTERNET",
        addressId: "addr-1",
        monthlyCost: 60,
        billingCycle: "MONTHLY",
        isActive: true,
        activatedAt: null,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        costLogs: [],
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/budget/actuals?month=2026-03-01") as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.services).toHaveLength(2);
    expect(body.services[0].loggedActual).toBe(80);
    expect(body.services[1].loggedActual).toBeNull();
  });
});
