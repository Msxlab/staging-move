import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    budget: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    address: {
      findUnique: vi.fn(),
    },
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

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "budget-rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

import { prisma } from "@/lib/db";
import { requireAppMutationUser } from "@/lib/api-gates";
import { GET, POST } from "./route";

const requireAppMutationUserMock = requireAppMutationUser as unknown as Mock;
const budgetMock = prisma.budget as unknown as {
  findMany: Mock;
  findFirst: Mock;
  create: Mock;
  update: Mock;
  upsert: Mock;
};
const serviceMock = prisma.service as unknown as { findMany: Mock };

describe("budget route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAppMutationUserMock.mockResolvedValue("user-1");
    budgetMock.findFirst.mockResolvedValue(null);
    budgetMock.create.mockImplementation(({ data }) => Promise.resolve({ id: "budget-1", ...data }));
    budgetMock.findMany.mockResolvedValue([]);
    budgetMock.upsert.mockImplementation(({ create, update }) => Promise.resolve({ id: "budget-1", ...create, ...update }));
    serviceMock.findMany.mockResolvedValue([
      {
        id: "monthly",
        providerName: "Electric Co",
        category: "UTILITY_ELECTRIC",
        addressId: "addr-1",
        monthlyCost: 100,
        billingCycle: "MONTHLY",
        isActive: true,
        createdAt: new Date("2026-04-02T00:00:00.000Z"),
      },
      {
        id: "yearly",
        providerName: "Insurance Co",
        category: "FINANCIAL_INSURANCE_RENTERS",
        addressId: "addr-1",
        monthlyCost: 1200,
        billingCycle: "YEARLY",
        isActive: true,
        createdAt: new Date("2026-04-02T00:00:00.000Z"),
      },
      {
        id: "one-time",
        providerName: "Mover",
        category: "HOUSING_MOVING",
        addressId: "addr-1",
        monthlyCost: 50,
        billingCycle: "ONE_TIME",
        isActive: true,
        createdAt: new Date("2026-04-03T00:00:00.000Z"),
      },
    ]);
  });

  it("calculates projected actual expenses from service costs when saving budget limits", async () => {
    const response = await POST(
      new Request("http://localhost/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: "2026-04-01",
          year: 2026,
          plannedExpenses: 300,
          categoryBreakdown: { Utilities: 150 },
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.budget.actualExpenses).toBe(250);
    expect(budgetMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_scopeKey_month: {
            userId: "user-1",
            scopeKey: "__global__",
            month: new Date("2026-04-01T00:00:00.000Z"),
          },
        },
        create: expect.objectContaining({
          plannedExpenses: 300,
          actualExpenses: 250,
          categoryBreakdown: JSON.stringify({ Utilities: 150 }),
          scopeKey: "__global__",
        }),
      }),
    );
  });

  it.each([
    ["UNAUTHORIZED", 401],
    ["EMAIL_VERIFICATION_REQUIRED", 403],
    ["LEGAL_ACCEPTANCE_REQUIRED", 403],
    ["SUBSCRIPTION_REQUIRED", 403],
  ])("returns a structured %s gate response", async (code, status) => {
    requireAppMutationUserMock.mockRejectedValueOnce(new Error(code));

    const response = await POST(
      new Request("http://localhost/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: "2026-04-01",
          year: 2026,
          plannedExpenses: 300,
        }),
      }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(body.code).toBe(code);
    expect(budgetMock.upsert).not.toHaveBeenCalled();
  });

  it("normalizes different timestamps in the same UTC month to one budget scope", async () => {
    const response = await POST(
      new Request("http://localhost/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: "2026-04-20T23:59:59.000Z",
          year: 2026,
          plannedExpenses: 300,
        }),
      }) as any,
    );

    expect(response.status).toBe(201);
    expect(budgetMock.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_scopeKey_month: {
          userId: "user-1",
          scopeKey: "__global__",
          month: new Date("2026-04-01T00:00:00.000Z"),
        },
      },
    }));
  });

  it("uses address-specific scope keys separately from global budgets", async () => {
    (prisma.address.findUnique as Mock).mockResolvedValue({ id: "addr-1", userId: "user-1" });

    const response = await POST(
      new Request("http://localhost/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: "addr-1",
          month: "2026-04-01",
          year: 2026,
          plannedExpenses: 300,
        }),
      }) as any,
    );

    expect(response.status).toBe(201);
    expect(budgetMock.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_scopeKey_month: {
          userId: "user-1",
          scopeKey: "addr-1",
          month: new Date("2026-04-01T00:00:00.000Z"),
        },
      },
    }));
  });

  it("rejects invalid GET month filters instead of querying a mismatched date", async () => {
    const { requireDbUserId } = await import("@/lib/auth");
    (requireDbUserId as unknown as Mock).mockResolvedValue("user-1");

    const response = await GET(new Request("http://localhost/api/budget?month=not-a-month") as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid month");
    expect(budgetMock.findMany).not.toHaveBeenCalled();
  });
});
