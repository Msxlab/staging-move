import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { requireDbUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockSubscription = prisma.subscription as unknown as {
  findUnique: Mock;
  update: Mock;
};

function cancelRequest() {
  return new NextRequest("https://locateflow.com/api/stripe/checkout/cancel");
}

describe("Stripe checkout cancel route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user_1");
    mockSubscription.update.mockResolvedValue({});
  });

  it("restores pending Free Access checkout back to active Free Access", async () => {
    mockSubscription.findUnique.mockResolvedValue({
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
    expect(response.headers.get("location")).toBe("https://locateflow.com/settings/subscription?canceled=true");
  });

  it("does not reset rows that already have a Stripe subscription id", async () => {
    mockSubscription.findUnique.mockResolvedValue({
      status: "PENDING_CHECKOUT",
      accessType: "FREE_TRIAL",
      freeAccessEndsAt: null,
      stripeSubscriptionId: "sub_live_123",
    });

    const response = await GET(cancelRequest());

    expect(mockSubscription.update).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://locateflow.com/settings/subscription?canceled=true");
  });
});
