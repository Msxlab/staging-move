import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  validateStripeCampaignPrice: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/lib/stripe-campaign-validation", () => ({
  validateStripeCampaignPrice: mocks.validateStripeCampaignPrice,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("https://admin.locateflow.com/api/acquisition-campaigns/validate-price", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("validate-price route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
  });

  it("returns canonical label when Stripe price matches", async () => {
    mocks.validateStripeCampaignPrice.mockResolvedValueOnce({
      ok: true,
      canonicalDisplayPriceLabel: "$79/year",
      displayPriceLabel: "$79/year",
      price: { interval: "year", currency: "usd", unitAmount: 7900, active: true },
    });

    const response = await POST(request({
      accessType: "FREE_TRIAL",
      stripePriceId: "price_annual",
      displayPriceLabel: "$79/year",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.priceValidation.ok).toBe(true);
    expect(body.priceValidation.canonicalDisplayPriceLabel).toBe("$79/year");
  });

  it("returns warning (not 422) on mismatch — uses DRAFT semantics", async () => {
    mocks.validateStripeCampaignPrice.mockResolvedValueOnce({
      ok: true,
      warning: "Stripe price is $79/year but displayed label is $80/year.",
    });

    const response = await POST(request({
      accessType: "FREE_TRIAL",
      stripePriceId: "price_annual",
      displayPriceLabel: "$80/year",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.priceValidation.warning).toContain("$79/year");
    expect(mocks.validateStripeCampaignPrice).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DRAFT" }),
    );
  });

  it("rejects unauthenticated requests", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("UNAUTHORIZED"));

    const response = await POST(request({ accessType: "FREE_TRIAL" }));
    expect(response.status).toBe(401);
  });

  it("forwards monthly billing interval", async () => {
    mocks.validateStripeCampaignPrice.mockResolvedValueOnce({
      ok: true,
      canonicalDisplayPriceLabel: "$9/month",
      price: { interval: "month", currency: "usd", unitAmount: 900, active: true },
    });

    await POST(request({
      accessType: "PAID",
      billingInterval: "MONTH",
      stripePriceId: "price_monthly",
      displayPriceLabel: "",
    }));

    expect(mocks.validateStripeCampaignPrice).toHaveBeenCalledWith(
      expect.objectContaining({
        accessType: "PAID",
        billingInterval: "MONTH",
        requiresPaymentMethod: true,
      }),
    );
  });
});
