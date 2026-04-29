import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  transaction: vi.fn(),
  campaignFindUnique: vi.fn(),
  campaignFindMany: vi.fn(),
  campaignUpdate: vi.fn(),
  auditCreate: vi.fn(),
  validateStripeCampaignPrice: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    acquisitionCampaign: {
      findUnique: mocks.campaignFindUnique,
      findMany: mocks.campaignFindMany,
      update: mocks.campaignUpdate,
    },
    adminAuditLog: {
      create: mocks.auditCreate,
    },
  },
}));

vi.mock("@/lib/stripe-campaign-validation", () => ({
  validateStripeCampaignPrice: mocks.validateStripeCampaignPrice,
}));

import { PATCH } from "./route";

function request(body: unknown) {
  return new Request("https://admin.locateflow.com/api/acquisition-campaigns/camp_1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function params(id = "camp_1") {
  return { params: Promise.resolve({ id }) };
}

describe("admin acquisition campaigns update route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.campaignFindUnique.mockResolvedValue({
      id: "camp_1",
      name: "Draft Trial",
      code: "DRAFT90",
      status: "DRAFT",
      accessType: "FREE_TRIAL",
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
      trialDays: 90,
      stripePriceId: "price_annual",
      displayPriceLabel: "$79/year",
      requiresPaymentMethod: true,
      autoRenew: true,
      startsAt: null,
      endsAt: null,
    });
    mocks.validateStripeCampaignPrice.mockResolvedValue({
      ok: true,
      displayPriceLabel: "$79/year",
      canonicalDisplayPriceLabel: "$79/year",
    });
    mocks.campaignFindMany.mockResolvedValue([]);
    mocks.campaignUpdate.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback) =>
      callback({
        acquisitionCampaign: {
          findMany: mocks.campaignFindMany,
          update: mocks.campaignUpdate,
        },
        adminAuditLog: { create: mocks.auditCreate },
      }),
    );
  });

  it("activating an overlapping matching campaign returns 409", async () => {
    mocks.campaignFindMany.mockResolvedValueOnce([{ id: "camp_existing", startsAt: null, endsAt: null }]);

    const response = await PATCH(request({ status: "ACTIVE" }), params());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: "ACTIVE_CAMPAIGN_CONFLICT" });
    expect(mocks.campaignUpdate).not.toHaveBeenCalled();
  });

  it("activates a campaign when no overlapping active campaign exists", async () => {
    const response = await PATCH(request({ status: "ACTIVE" }), params());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.campaignUpdate).toHaveBeenCalledWith({
      where: { id: "camp_1" },
      data: expect.objectContaining({ status: "ACTIVE", displayPriceLabel: "$79/year" }),
    });
    expect(body.priceValidation).toMatchObject({ ok: true });
  });

  it("updates a campaign into a paid monthly offer", async () => {
    mocks.validateStripeCampaignPrice.mockResolvedValueOnce({
      ok: true,
      displayPriceLabel: "$9/month",
      canonicalDisplayPriceLabel: "$9/month",
      price: { interval: "month" },
    });

    const response = await PATCH(request({
      accessType: "PAID",
      billingInterval: "MONTH",
      stripePriceId: "price_monthly",
      displayPriceLabel: "",
      publicHeadline: "Subscribe monthly",
    }), params());

    expect(response.status).toBe(200);
    expect(mocks.campaignFindMany).not.toHaveBeenCalled();
    expect(mocks.campaignUpdate).toHaveBeenCalledWith({
      where: { id: "camp_1" },
      data: expect.objectContaining({
        accessType: "PAID",
        billingInterval: "MONTH",
        requiresPaymentMethod: true,
        autoRenew: true,
        stripePriceId: "price_monthly",
        displayPriceLabel: "$9/month",
      }),
    });
  });

  it("blocks ACTIVE updates when Stripe price validation fails", async () => {
    mocks.validateStripeCampaignPrice.mockResolvedValueOnce({
      ok: false,
      code: "PRICE_VALIDATION_FAILED",
      error: "Stripe price is inactive.",
    });

    const response = await PATCH(request({ status: "ACTIVE" }), params());
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({
      code: "PRICE_VALIDATION_FAILED",
      priceValidation: { ok: false, error: "Stripe price is inactive." },
    });
    expect(mocks.campaignUpdate).not.toHaveBeenCalled();
  });

  it("allows copy-only edits on an already ACTIVE campaign without revalidating Stripe price", async () => {
    mocks.campaignFindUnique.mockResolvedValueOnce({
      id: "camp_1",
      name: "Individual Annual",
      code: "INDIVIDUAL90",
      status: "ACTIVE",
      accessType: "FREE_TRIAL",
      plan: "INDIVIDUAL",
      billingInterval: "YEAR",
      trialDays: 90,
      stripePriceId: "price_annual",
      displayPriceLabel: "$79/year",
      requiresPaymentMethod: true,
      autoRenew: true,
      startsAt: null,
      endsAt: null,
    });
    mocks.validateStripeCampaignPrice.mockResolvedValueOnce({
      ok: false,
      code: "PRICE_VALIDATION_FAILED",
      error: "Stripe price could not be validated.",
    });

    const response = await PATCH(request({
      publicHeadline: "Start with 3 months free",
      publicSubheadline: "Fresh public copy.",
      checkoutDisclosureCopy: "Updated checkout disclosure.",
    }), params());

    expect(response.status).toBe(200);
    expect(mocks.validateStripeCampaignPrice).not.toHaveBeenCalled();
    expect(mocks.campaignUpdate).toHaveBeenCalledWith({
      where: { id: "camp_1" },
      data: expect.objectContaining({
        publicHeadline: "Start with 3 months free",
        publicSubheadline: "Fresh public copy.",
        checkoutDisclosureCopy: "Updated checkout disclosure.",
      }),
    });
  });
});
