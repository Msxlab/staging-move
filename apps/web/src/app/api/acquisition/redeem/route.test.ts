import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  rateLimit: vi.fn(),
  findAcquisitionCampaign: vi.fn(),
  assertCampaignAvailable: vi.fn(),
  buildSignupSnapshot: vi.fn(),
  campaignToSnapshotText: vi.fn(),
  getRequestHashSnapshot: vi.fn(),
  redemptionFindFirst: vi.fn(),
  transaction: vi.fn(),
  subscriptionUpsert: vi.fn(),
  redemptionCreate: vi.fn(),
  campaignUpdate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireDbUserId: mocks.requireDbUserId }));
vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "acquisition-redeem-key"),
  rateLimit: mocks.rateLimit,
}));
vi.mock("@/lib/acquisition-campaigns", () => ({
  findAcquisitionCampaign: mocks.findAcquisitionCampaign,
  assertCampaignAvailable: mocks.assertCampaignAvailable,
  buildSignupSnapshot: mocks.buildSignupSnapshot,
  campaignToSnapshotText: mocks.campaignToSnapshotText,
  getRequestHashSnapshot: mocks.getRequestHashSnapshot,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    acquisitionRedemption: { findFirst: (...args: unknown[]) => mocks.redemptionFindFirst(...args) },
    $transaction: (...args: unknown[]) => mocks.transaction(...args),
  },
}));

import { POST } from "./route";

function redeemRequest(code = "FREE30") {
  return new NextRequest("https://locateflow.com/api/acquisition/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
}

describe("Free Access redemption route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDbUserId.mockResolvedValue("user_1");
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.findAcquisitionCampaign.mockResolvedValue({
      id: "camp_free",
      name: "Free Access",
      code: "FREE30",
      status: "ACTIVE",
      accessType: "FREE_ACCESS",
      plan: "INDIVIDUAL",
      freeAccessDays: 30,
      newUsersOnly: true,
    });
    mocks.redemptionFindFirst.mockResolvedValue(null);
    mocks.buildSignupSnapshot.mockReturnValue({ campaignCode: "FREE30", accessType: "FREE_ACCESS" });
    mocks.campaignToSnapshotText.mockReturnValue("{\"campaignCode\":\"FREE30\"}");
    mocks.getRequestHashSnapshot.mockReturnValue({ consentIpHash: "ip_hash", consentUserAgentHash: "ua_hash" });
    mocks.subscriptionUpsert.mockResolvedValue({
      id: "sub_1",
      freeAccessEndsAt: new Date("2026-05-28T00:00:00.000Z"),
    });
    mocks.redemptionCreate.mockResolvedValue({ id: "redemption_1" });
    mocks.campaignUpdate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback: any) =>
      callback({
        subscription: { upsert: mocks.subscriptionUpsert },
        acquisitionRedemption: { create: mocks.redemptionCreate },
        acquisitionCampaign: { update: mocks.campaignUpdate },
      }),
    );
  });

  it("grants cardless Free Access without Stripe or auto-renewal", async () => {
    const response = await POST(redeemRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ accessType: "FREE_ACCESS", redemptionId: "redemption_1" });
    expect(mocks.subscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        update: expect.objectContaining({
          accessType: "FREE_ACCESS",
          status: "ACTIVE",
          provider: "ADMIN",
          autoRenew: false,
          cancelAtPeriodEnd: false,
          firstChargeAt: null,
          firstChargeAmount: null,
        }),
      }),
    );
  });

  it("does not redeem paused or ended campaigns", async () => {
    mocks.assertCampaignAvailable.mockImplementationOnce(() => {
      throw new Error("Campaign is not active.");
    });

    const response = await POST(redeemRequest());

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
