import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    budget: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "budget-rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { POST } from "./route";

const requireDbUserIdMock = requireDbUserId as unknown as Mock;
const budgetMock = prisma.budget as unknown as {
  findFirst: Mock;
  create: Mock;
  update: Mock;
};
const serviceMock = prisma.service as unknown as { findMany: Mock };

describe("budget route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireDbUserIdMock.mockResolvedValue("user-1");
    budgetMock.findFirst.mockResolvedValue(null);
    budgetMock.create.mockImplementation(({ data }) => Promise.resolve({ id: "budget-1", ...data }));
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
    expect(budgetMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plannedExpenses: 300,
          actualExpenses: 250,
          categoryBreakdown: JSON.stringify({ Utilities: 150 }),
        }),
      }),
    );
  });
});
