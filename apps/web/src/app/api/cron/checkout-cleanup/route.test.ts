import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  guardCronRequest: vi.fn(),
  subscriptionFindMany: vi.fn(),
  subscriptionUpdate: vi.fn(),
  redemptionUpdateMany: vi.fn(),
  transaction: vi.fn((mutations: Promise<unknown>[]) => Promise.all(mutations)),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/cron-guard", () => ({
  guardCronRequest: (...args: unknown[]) => mocks.guardCronRequest(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => (mocks.transaction as any)(...args),
    subscription: {
      findMany: (...args: unknown[]) => mocks.subscriptionFindMany(...args),
      update: (...args: unknown[]) => mocks.subscriptionUpdate(...args),
    },
    acquisitionRedemption: {
      updateMany: (...args: unknown[]) => mocks.redemptionUpdateMany(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: (...args: unknown[]) => mocks.loggerInfo(...args),
    error: (...args: unknown[]) => mocks.loggerError(...args),
  },
}));

import { GET, POST } from "./route";

function cronRequest(method: "GET" | "POST" = "POST") {
  return new NextRequest("https://app.locateflow.com/api/cron/checkout-cleanup", {
    method,
    headers: { authorization: "Bearer cron-secret" },
  });
}

describe("checkout cleanup cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guardCronRequest.mockResolvedValue({ ok: true });
    mocks.subscriptionFindMany.mockResolvedValue([]);
    mocks.subscriptionUpdate.mockResolvedValue({});
    mocks.redemptionUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("rejects requests that fail the route-level cron guard", async () => {
    mocks.guardCronRequest.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(cronRequest());

    expect(response.status).toBe(401);
    expect(mocks.subscriptionFindMany).not.toHaveBeenCalled();
  });

  it("restores stale pending checkout rows and expires pending redemptions", async () => {
    mocks.subscriptionFindMany.mockResolvedValue([
      {
        id: "subscription-1",
        userId: "user-1",
        accessType: "FREE_TRIAL",
        freeAccessEndsAt: null,
      },
    ]);

    const response = await POST(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      scanned: 1,
      restoredCanceled: 1,
      expiredRedemptions: 1,
      errors: 0,
    });
    expect(mocks.subscriptionUpdate).toHaveBeenCalledWith({
      where: { id: "subscription-1" },
      data: expect.objectContaining({
        status: "CANCELED",
        autoRenew: false,
        cancelAtPeriodEnd: false,
      }),
    });
    expect(mocks.redemptionUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        subscriptionId: "subscription-1",
        status: "PENDING_CHECKOUT",
      },
      data: { status: "EXPIRED" },
    });
  });

  it("allows Vercel GET cron requests to use the same guarded implementation", async () => {
    const response = await GET(cronRequest("GET"));

    expect(response.status).toBe(200);
    expect(mocks.guardCronRequest).toHaveBeenCalledWith(expect.any(NextRequest), "checkout-cleanup");
  });
});
