import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePasswordConfirm: vi.fn(),
  transaction: vi.fn(),
  campaignFindUnique: vi.fn(),
  campaignFindMany: vi.fn(),
  campaignUpdate: vi.fn(),
  campaignCreate: vi.fn(),
  campaignDelete: vi.fn(),
  redemptionFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  validateStripeCampaignPrice: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
  requirePasswordConfirm: mocks.requirePasswordConfirm,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    acquisitionCampaign: {
      findUnique: mocks.campaignFindUnique,
      findMany: mocks.campaignFindMany,
      update: mocks.campaignUpdate,
      create: mocks.campaignCreate,
      delete: mocks.campaignDelete,
    },
    acquisitionRedemption: {
      findFirst: mocks.redemptionFindFirst,
    },
    adminAuditLog: {
      create: mocks.auditCreate,
    },
  },
}));

vi.mock("@/lib/stripe-campaign-validation", () => ({
  validateStripeCampaignPrice: mocks.validateStripeCampaignPrice,
}));

import { DELETE, PATCH, POST } from "./route";

function request(body: unknown, method = "PATCH") {
  return new Request("https://admin.locateflow.com/api/acquisition-campaigns/camp_1", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

function bodylessRequest(method: string) {
  return new Request("https://admin.locateflow.com/api/acquisition-campaigns/camp_1", {
    method,
  }) as any;
}

function params(id = "camp_1") {
  return { params: Promise.resolve({ id }) };
}

describe("admin acquisition campaigns update route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    // F1 step-up: PATCH/POST/DELETE now clear requirePasswordConfirm before
    // mutating. Default to confirmed so these assertions exercise the
    // post-step-up logic (conflict/price/update paths).
    mocks.requirePasswordConfirm.mockResolvedValue({ confirmed: true });
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

  it("does not revalidate Stripe for unchanged price fields in a full edit payload", async () => {
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
    const response = await PATCH(request({
      name: "Individual Annual",
      code: "INDIVIDUAL90",
      accessType: "FREE_TRIAL",
      billingInterval: "YEAR",
      trialDays: 90,
      stripePriceId: " price_annual ",
      displayPriceLabel: "$79/year",
      publicHeadline: "Start with 3 months free",
      publicSubheadline: "Updated public copy.",
      checkoutDisclosureCopy: "Updated checkout disclosure.",
    }), params());

    expect(response.status).toBe(200);
    expect(mocks.validateStripeCampaignPrice).not.toHaveBeenCalled();
    expect(mocks.campaignUpdate).toHaveBeenCalledWith({
      where: { id: "camp_1" },
      data: expect.objectContaining({
        stripePriceId: "price_annual",
        displayPriceLabel: "$79/year",
        publicSubheadline: "Updated public copy.",
      }),
    });
  });

  it("still revalidates Stripe when an ACTIVE campaign price label changes", async () => {
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
      error: "Stripe price is $79/year but displayed label is $80/year.",
    });

    const response = await PATCH(request({
      accessType: "FREE_TRIAL",
      billingInterval: "YEAR",
      trialDays: 90,
      stripePriceId: "price_annual",
      displayPriceLabel: "$80/year",
    }), params());
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({
      code: "PRICE_VALIDATION_FAILED",
      error: "Stripe price is $79/year but displayed label is $80/year.",
    });
    expect(mocks.validateStripeCampaignPrice).toHaveBeenCalled();
    expect(mocks.campaignUpdate).not.toHaveBeenCalled();
  });

  it("rejects update without step-up confirmation (403, nothing read or written)", async () => {
    mocks.requirePasswordConfirm.mockResolvedValueOnce({
      confirmed: false,
      error: "Password confirmation required for this operation.",
      requiresMfa: true,
    });

    const response = await PATCH(request({ status: "ACTIVE" }), params());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      error: "Password confirmation required for this operation.",
      requiresPassword: true,
      requiresMfa: true,
    });
    // Step-up failure must short-circuit before the campaign is even read,
    // before Stripe validation, and before any write or audit row.
    expect(mocks.campaignFindUnique).not.toHaveBeenCalled();
    expect(mocks.validateStripeCampaignPrice).not.toHaveBeenCalled();
    expect(mocks.campaignUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("forwards body step-up credentials with requireMfa and keeps them out of update columns", async () => {
    const response = await PATCH(
      request({ status: "ACTIVE", confirmPassword: "correct horse battery staple", mfaCode: "654321" }),
      params(),
    );

    expect(response.status).toBe(200);
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      "correct horse battery staple",
      expect.objectContaining({
        operation: "acquisition_campaign_update",
        requireMfa: true,
        mfaCode: "654321",
      }),
    );
    // Credentials ride in the same JSON body as the edit payload — they
    // must never be persisted as campaign data.
    expect(mocks.campaignUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          confirmPassword: expect.anything(),
        }),
      }),
    );
  });

  it("rejects duplicate without step-up confirmation (403, no clone created)", async () => {
    mocks.requirePasswordConfirm.mockResolvedValueOnce({
      confirmed: false,
      error: "Password confirmation required for this operation.",
      requiresMfa: true,
    });

    const response = await POST(request({ action: "duplicate" }, "POST"), params());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      error: "Password confirmation required for this operation.",
      requiresPassword: true,
      requiresMfa: true,
    });
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      undefined,
      expect.objectContaining({ operation: "acquisition_campaign_duplicate", requireMfa: true }),
    );
    expect(mocks.campaignFindUnique).not.toHaveBeenCalled();
    expect(mocks.campaignCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rejects delete without step-up — a body-less DELETE fails closed with 403", async () => {
    mocks.requirePasswordConfirm.mockResolvedValueOnce({
      confirmed: false,
      error: "Password confirmation required for this operation.",
      requiresMfa: true,
    });

    const response = await DELETE(bodylessRequest("DELETE"), params());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      error: "Password confirmation required for this operation.",
      requiresPassword: true,
      requiresMfa: true,
    });
    // No body means no password — the route must treat that as an
    // unconfirmed step-up, not a crash or a silent delete.
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      undefined,
      expect.objectContaining({ operation: "acquisition_campaign_delete", requireMfa: true }),
    );
    expect(mocks.campaignFindUnique).not.toHaveBeenCalled();
    expect(mocks.campaignDelete).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("deletes a redemption-free campaign once step-up is confirmed", async () => {
    mocks.campaignFindUnique.mockResolvedValueOnce({
      id: "camp_1",
      code: "DRAFT90",
      status: "DRAFT",
      redemptionCount: 0,
    });
    mocks.redemptionFindFirst.mockResolvedValueOnce(null);
    mocks.campaignDelete.mockResolvedValueOnce({ id: "camp_1" });

    const response = await DELETE(
      request({ confirmPassword: "correct horse battery staple", mfaCode: "654321" }, "DELETE"),
      params(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true });
    expect(mocks.requirePasswordConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ adminId: "admin_1" }),
      "correct horse battery staple",
      expect.objectContaining({
        operation: "acquisition_campaign_delete",
        requireMfa: true,
        mfaCode: "654321",
      }),
    );
    expect(mocks.campaignDelete).toHaveBeenCalledWith({ where: { id: "camp_1" } });
  });
});
