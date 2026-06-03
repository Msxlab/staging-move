import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  rateLimit: vi.fn(),
  captureException: vi.fn(),
  refreshGoogleSubscriptionFor: vi.fn(),
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
  applyIapStateToUser: vi.fn(),
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

    expect(response.status).toBe(503);
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

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "IAP_NOT_CONFIGURED" });
    expect(JSON.stringify(body)).not.toContain("do-not-leak");
    expect(mocks.captureException).not.toHaveBeenCalled();
  });
});
