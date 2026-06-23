import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => {
  const prisma: any = {
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
    // Interactive transaction: run the callback with the prisma mock as the tx
    // client so the wrapped cost-log write + service.update mirror hit the
    // mocked delegates. Tests can override to assert rollback.
    $transaction: vi.fn((cb: (tx: any) => unknown) => cb(prisma)),
  };
  return { prisma };
});

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
const transactionMock = (prisma as unknown as { $transaction: Mock }).$transaction;

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
    // Restore the default $transaction implementation wiped by clearAllMocks.
    transactionMock.mockImplementation((cb: (tx: any) => unknown) => cb(prisma));
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

  // 4.5 atomicity: for the CURRENT month the cost-log upsert and the legacy
  // Service.actualMonthlyCost mirror run in one transaction, so a failure on the
  // second write (service.update) rolls back the first (the cost-log upsert).
  it("rolls back the cost-log upsert when the current-month scalar mirror fails", async () => {
    // Viewed month = current month so the mirror service.update is exercised.
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-15T00:00:00.000Z`;

    let logPersisted = false;
    logMock.upsert.mockImplementation(async ({ create, update }: any) => {
      logPersisted = true;
      return { amount: update?.amount ?? create?.amount };
    });
    serviceMock.update.mockImplementation(async () => {
      throw new Error("MIRROR_UPDATE_FAILED");
    });
    // Emulate atomicity: a rejecting callback leaves no durable write.
    transactionMock.mockImplementation(async (cb: (tx: any) => unknown) => {
      try {
        return await cb(prisma);
      } catch (err) {
        logPersisted = false; // rolled back with the failed mirror update
        throw err;
      }
    });

    const response = await POST(
      postRequest({ serviceId: "svc-1", month: currentMonth, amount: 80 }),
    );

    // The route's outer catch maps the transaction failure to a 500.
    expect(response.status).toBe(500);
    // Both writes were attempted inside the transaction, then rolled back
    // together — the per-month log and the scalar mirror cannot diverge.
    expect(logMock.upsert).toHaveBeenCalled();
    expect(serviceMock.update).toHaveBeenCalled();
    expect(logPersisted).toBe(false);
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
