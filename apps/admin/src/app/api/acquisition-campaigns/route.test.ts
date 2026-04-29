import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  transaction: vi.fn(),
  campaignFindMany: vi.fn(),
  campaignCreate: vi.fn(),
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
      findMany: mocks.campaignFindMany,
      create: mocks.campaignCreate,
    },
    adminAuditLog: {
      create: mocks.auditCreate,
    },
  },
}));

vi.mock("@/lib/stripe-campaign-validation", () => ({
  validateStripeCampaignPrice: mocks.validateStripeCampaignPrice,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("https://admin.locateflow.com/api/acquisition-campaigns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("admin acquisition campaigns create route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1" });
    mocks.validateStripeCampaignPrice.mockResolvedValue({
      ok: true,
      displayPriceLabel: "$79/year",
      canonicalDisplayPriceLabel: "$79/year",
    });
    mocks.campaignFindMany.mockResolvedValue([]);
    mocks.campaignCreate.mockImplementation(async ({ data }) => ({ id: "camp_new", ...data }));
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation((callback) =>
      callback({
        acquisitionCampaign: {
          findMany: mocks.campaignFindMany,
          create: mocks.campaignCreate,
        },
        adminAuditLog: { create: mocks.auditCreate },
      }),
    );
  });

  it("creating a second overlapping ACTIVE matching campaign returns 409", async () => {
    mocks.campaignFindMany.mockResolvedValueOnce([{ id: "camp_existing", startsAt: null, endsAt: null }]);

    const response = await POST(request({
      name: "Spring Trial",
      code: "SPRING90",
      status: "ACTIVE",
      accessType: "FREE_TRIAL",
      trialDays: 90,
      stripePriceId: "price_annual",
      displayPriceLabel: "$79/year",
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: "ACTIVE_CAMPAIGN_CONFLICT" });
    expect(mocks.campaignCreate).not.toHaveBeenCalled();
  });

  it("draft, paused, and ended campaigns can coexist with an active campaign", async () => {
    for (const status of ["DRAFT", "PAUSED", "ENDED"]) {
      const response = await POST(request({
        name: `${status} Trial`,
        code: `${status}90`,
        status,
        accessType: "FREE_TRIAL",
        trialDays: 90,
        stripePriceId: "price_annual",
        displayPriceLabel: "$79/year",
      }));

      expect(response.status).toBe(201);
    }
    expect(mocks.campaignCreate).toHaveBeenCalledTimes(3);
  });

  it("auto-fills displayPriceLabel from Stripe validation when blank", async () => {
    const response = await POST(request({
      name: "Spring Trial",
      code: "SPRING90",
      status: "DRAFT",
      accessType: "FREE_TRIAL",
      trialDays: 90,
      stripePriceId: "price_annual",
      displayPriceLabel: "",
    }));

    expect(response.status).toBe(201);
    expect(mocks.campaignCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ displayPriceLabel: "$79/year" }),
      }),
    );
  });

  it("saves draft Stripe price mismatch with a warning", async () => {
    mocks.validateStripeCampaignPrice.mockResolvedValueOnce({
      ok: true,
      warning: "Stripe price is $99/year but displayed label is $79/year.",
      displayPriceLabel: "$79/year",
    });

    const response = await POST(request({
      name: "Draft Trial",
      code: "DRAFT90",
      status: "DRAFT",
      accessType: "FREE_TRIAL",
      trialDays: 90,
      stripePriceId: "price_annual",
      displayPriceLabel: "$79/year",
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.priceValidation.warning).toContain("Stripe price is $99/year");
  });

  it("blocks active Stripe price mismatch with 422", async () => {
    mocks.validateStripeCampaignPrice.mockResolvedValueOnce({
      ok: false,
      code: "PRICE_VALIDATION_FAILED",
      error: "Stripe price is $99/year but displayed label is $79/year.",
    });

    const response = await POST(request({
      name: "Active Trial",
      code: "ACTIVE90",
      status: "ACTIVE",
      accessType: "FREE_TRIAL",
      trialDays: 90,
      stripePriceId: "price_annual",
      displayPriceLabel: "$79/year",
    }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({ code: "PRICE_VALIDATION_FAILED" });
    expect(mocks.campaignCreate).not.toHaveBeenCalled();
  });
});
