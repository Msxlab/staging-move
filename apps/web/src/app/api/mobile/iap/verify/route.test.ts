import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  rateLimit: vi.fn(),
  captureException: vi.fn(),
  refreshGoogleSubscriptionFor: vi.fn(),
  applyIapStateToUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: mocks.requireDbUserId,
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "iap-verify:ip"),
  rateLimit: mocks.rateLimit,
}));

vi.mock("@/lib/sentry", () => ({
  captureException: mocks.captureException,
}));

vi.mock("@/lib/iap-common", () => ({
  applyIapStateToUser: mocks.applyIapStateToUser,
  normalizeAppleTransactionPayload: vi.fn(),
  refreshAppleSubscriptionFor: vi.fn(),
  refreshGoogleSubscriptionFor: mocks.refreshGoogleSubscriptionFor,
}));

vi.mock("@/lib/iap-apple", () => ({
  verifyAppleJws: vi.fn(),
}));

vi.mock("@/lib/billing", () => ({
  buildUnifiedEntitlementSnapshot: vi.fn(),
}));

import { POST } from "./route";

function verifyRequest(body: unknown) {
  return new NextRequest("https://locateflow.com/api/mobile/iap/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("mobile IAP verify route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDbUserId.mockResolvedValue("user_1");
    mocks.rateLimit.mockResolvedValue({ success: true, resetAt: Date.now() + 60_000 });
  });

  it("fails closed with a static provider error for Google Publisher API failures", async () => {
    (mocks.refreshGoogleSubscriptionFor as Mock).mockRejectedValue(
      new Error("GOOGLE_API_403:permission denied for secret-token-value"),
    );

    const response = await POST(verifyRequest({
      platform: "android",
      purchaseToken: "fake_google_play_purchase_token_12345",
      productId: "locateflow.pro.yearly",
    }));
    const body = await response.json();

    expect(response.status).toBe(424);
    expect(body).toEqual({ error: "IAP_PROVIDER_UNAVAILABLE" });
    expect(JSON.stringify(body)).not.toContain("secret-token-value");
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it("fails closed with a static configuration error for Google OAuth failures", async () => {
    (mocks.refreshGoogleSubscriptionFor as Mock).mockRejectedValue(
      new Error("GOOGLE_OAUTH_400:client_secret=do-not-leak"),
    );

    const response = await POST(verifyRequest({
      platform: "android",
      purchaseToken: "fake_google_play_purchase_token_67890",
      productId: "locateflow.pro.yearly",
    }));
    const body = await response.json();

    expect(response.status).toBe(424);
    expect(body).toEqual({ error: "IAP_NOT_CONFIGURED" });
    expect(JSON.stringify(body)).not.toContain("do-not-leak");
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it("returns TEST_PURCHASE_NOT_ALLOWED (400) for an Apple sandbox purchase in production (finding 2)", async () => {
    (mocks.refreshGoogleSubscriptionFor as Mock).mockResolvedValue({
      provider: "PLAY_STORE",
      status: "ACTIVE",
      productId: "locateflow.pro.yearly",
    });
    (mocks.applyIapStateToUser as Mock).mockRejectedValue(
      new Error("APPLE_SANDBOX_PURCHASE_IN_PRODUCTION"),
    );

    const response = await POST(verifyRequest({
      platform: "android",
      purchaseToken: "fake_google_play_purchase_token_99999",
      productId: "locateflow.pro.yearly",
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "TEST_PURCHASE_NOT_ALLOWED" });
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it("uses the if-redis-configured fail mode so a Redis outage can't block activation (finding 5)", async () => {
    (mocks.refreshGoogleSubscriptionFor as Mock).mockResolvedValue({
      provider: "PLAY_STORE",
      status: "ACTIVE",
      productId: "locateflow.pro.yearly",
    });
    (mocks.applyIapStateToUser as Mock).mockResolvedValue({
      plan: "PRO",
      status: "ACTIVE",
      provider: "PLAY_STORE",
      platform: "android",
      currentPeriodEndsAt: null,
      gracePeriodEndsAt: null,
    });

    await POST(verifyRequest({
      platform: "android",
      purchaseToken: "fake_google_play_purchase_token_11111",
      productId: "locateflow.pro.yearly",
    }));

    // Both limiters must use the conditional mode, not strict fail-closed, so a
    // missing Redis falls back to in-memory instead of 429ing a paid activation.
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ failClosed: "if-redis-configured" }),
    );
    for (const call of (mocks.rateLimit as Mock).mock.calls) {
      expect(call[1]).toMatchObject({ failClosed: "if-redis-configured" });
    }
  });
});
