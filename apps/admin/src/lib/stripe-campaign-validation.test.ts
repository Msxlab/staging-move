import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminRuntimeConfigValue: vi.fn(),
  pricesRetrieve: vi.fn(),
  stripeConstructor: vi.fn(),
}));

vi.mock("@/lib/runtime-config", () => ({
  getAdminRuntimeConfigValue: mocks.getAdminRuntimeConfigValue,
}));

vi.mock("stripe", () => ({
  default: mocks.stripeConstructor,
}));

import { validateStripeCampaignPrice } from "./stripe-campaign-validation";

describe("validateStripeCampaignPrice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_CAMPAIGN_CURRENCY = "usd";
    mocks.getAdminRuntimeConfigValue.mockResolvedValue("sk_test_123");
    mocks.pricesRetrieve.mockResolvedValue({
      active: true,
      currency: "usd",
      unit_amount: 7900,
      recurring: { interval: "year" },
    });
    mocks.stripeConstructor.mockImplementation(function StripeMock() {
      return {
        prices: { retrieve: mocks.pricesRetrieve },
      };
    });
  });

  it("auto-fills a blank display price label from the canonical Stripe price", async () => {
    const result = await validateStripeCampaignPrice({
      accessType: "FREE_TRIAL",
      requiresPaymentMethod: true,
      stripePriceId: "price_annual",
      displayPriceLabel: "",
      billingInterval: "YEAR",
      status: "ACTIVE",
    });

    expect(result.ok).toBe(true);
    expect(result.displayPriceLabel).toBe("$79/year");
    expect(result.canonicalDisplayPriceLabel).toBe("$79/year");
  });

  it("allows equivalent decimal display labels", async () => {
    const result = await validateStripeCampaignPrice({
      accessType: "FREE_TRIAL",
      requiresPaymentMethod: true,
      stripePriceId: "price_annual",
      displayPriceLabel: "$79.00/year",
      billingInterval: "YEAR",
      status: "ACTIVE",
    });

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("allows draft mismatch with a warning", async () => {
    const result = await validateStripeCampaignPrice({
      accessType: "FREE_TRIAL",
      requiresPaymentMethod: true,
      stripePriceId: "price_annual",
      displayPriceLabel: "$99/year",
      billingInterval: "YEAR",
      status: "DRAFT",
    });

    expect(result.ok).toBe(true);
    expect(result.warning).toContain("Stripe price is $79/year");
  });

  it("blocks active mismatch with PRICE_VALIDATION_FAILED", async () => {
    const result = await validateStripeCampaignPrice({
      accessType: "FREE_TRIAL",
      requiresPaymentMethod: true,
      stripePriceId: "price_annual",
      displayPriceLabel: "$99/year",
      billingInterval: "YEAR",
      status: "ACTIVE",
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("PRICE_VALIDATION_FAILED");
  });

  it("skips Stripe validation for no-payment Free Access campaigns", async () => {
    const result = await validateStripeCampaignPrice({
      accessType: "FREE_ACCESS",
      requiresPaymentMethod: false,
      displayPriceLabel: null,
      status: "ACTIVE",
    });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(mocks.stripeConstructor).not.toHaveBeenCalled();
  });

  it("warns on draft Stripe API failures but blocks active writes", async () => {
    mocks.pricesRetrieve.mockRejectedValue(new Error("stripe down"));

    await expect(validateStripeCampaignPrice({
      accessType: "FREE_TRIAL",
      requiresPaymentMethod: true,
      stripePriceId: "price_annual",
      displayPriceLabel: "$79/year",
      billingInterval: "YEAR",
      status: "DRAFT",
    })).resolves.toMatchObject({ ok: true, warning: expect.any(String) });

    await expect(validateStripeCampaignPrice({
      accessType: "FREE_TRIAL",
      requiresPaymentMethod: true,
      stripePriceId: "price_annual",
      displayPriceLabel: "$79/year",
      billingInterval: "YEAR",
      status: "ACTIVE",
    })).resolves.toMatchObject({ ok: false, code: "PRICE_VALIDATION_FAILED" });
  });

  it("blocks active validation when Stripe config is missing", async () => {
    mocks.getAdminRuntimeConfigValue.mockResolvedValue(null);

    const result = await validateStripeCampaignPrice({
      accessType: "FREE_TRIAL",
      requiresPaymentMethod: true,
      stripePriceId: "price_annual",
      displayPriceLabel: "$79/year",
      billingInterval: "YEAR",
      status: "ACTIVE",
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("PRICE_VALIDATION_FAILED");
  });
});
