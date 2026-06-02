import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn((mutations: Promise<unknown>[]) => Promise.all(mutations)),
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    acquisitionRedemption: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: vi.fn(),
}));

import { requireDbUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { GET, POST } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockGetRuntimeConfigValue = getRuntimeConfigValue as unknown as Mock;
const mockSubscription = prisma.subscription as unknown as {
  findUnique: Mock;
  update: Mock;
};
const mockAcquisitionRedemption = (prisma as any).acquisitionRedemption as { updateMany: Mock };

function cancelRequest() {
  return new NextRequest("https://locateflow.com/api/stripe/checkout/cancel");
}

describe("Stripe checkout cancel route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user_1");
    mockGetRuntimeConfigValue.mockResolvedValue("https://locateflow.com");
    mockSubscription.update.mockResolvedValue({});
    mockAcquisitionRedemption.updateMany.mockResolvedValue({ count: 1 });
  });

  it("restores pending Free Access checkout back to active Free Access", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      id: "sub_row_1",
      status: "PENDING_CHECKOUT",
      accessType: "FREE_ACCESS",
      freeAccessEndsAt: new Date(Date.now() + 7 * 86_400_000),
      stripeSubscriptionId: null,
    });

    const response = await GET(cancelRequest());

    expect(mockSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        data: expect.objectContaining({
          status: "ACTIVE",
          autoRenew: false,
          cancelAtPeriodEnd: false,
        }),
      }),
    );
    expect(mockAcquisitionRedemption.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        subscriptionId: "sub_row_1",
        status: "PENDING_CHECKOUT",
      },
      data: { status: "CANCELED" },
    });
    expect(response.headers.get("location")).toBe("https://locateflow.com/settings/subscription?canceled=true");
  });

  it("does not reset rows that already have a Stripe subscription id", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      id: "sub_row_1",
      status: "PENDING_CHECKOUT",
      accessType: "FREE_TRIAL",
      freeAccessEndsAt: null,
      stripeSubscriptionId: "sub_live_123",
    });

    const response = await GET(cancelRequest());

    expect(mockSubscription.update).not.toHaveBeenCalled();
    expect(mockAcquisitionRedemption.updateMany).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://locateflow.com/settings/subscription?canceled=true");
  });

  it("redirects to the configured public app URL instead of an internal platform host", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      id: "sub_row_1",
      status: "PENDING_CHECKOUT",
      accessType: "FREE_ACCESS",
      freeAccessEndsAt: new Date(Date.now() + 7 * 86_400_000),
      stripeSubscriptionId: null,
    });

    const response = await GET(
      new NextRequest("https://0.0.0.0:8080/api/stripe/checkout/cancel"),
    );

    expect(response.headers.get("location")).toBe("https://locateflow.com/settings/subscription?canceled=true");
  });

  it("POST resets stuck PENDING_CHECKOUT and reports reset=true", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      id: "sub_row_1",
      status: "PENDING_CHECKOUT",
      accessType: "FREE_TRIAL",
      freeAccessEndsAt: null,
      stripeSubscriptionId: null,
    });

    const response = await POST();
    const body = await response.json();

    expect(mockSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        data: expect.objectContaining({ status: "CANCELED" }),
      }),
    );
    expect(body).toEqual({ reset: true });
  });

  it("POST reports reset=false when there is nothing to reset", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      id: "sub_row_1",
      status: "ACTIVE",
      accessType: "PAID",
      freeAccessEndsAt: null,
      stripeSubscriptionId: "sub_live_123",
    });

    const response = await POST();
    const body = await response.json();

    expect(mockSubscription.update).not.toHaveBeenCalled();
    expect(body).toEqual({ reset: false });
  });
});
