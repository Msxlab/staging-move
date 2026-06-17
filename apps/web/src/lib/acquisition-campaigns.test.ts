import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    acquisitionCampaign: {
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
    },
  },
}));

import {
  findActivePublicIndividualAnnualTrialCampaign,
  findActivePublicIndividualMonthlyPaidOffer,
  findAcquisitionCampaign,
  getPublicCampaignViewModel,
  getPublicSubscriptionOffersViewModel,
  toPublicCampaignViewModel,
} from "./acquisition-campaigns";

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "camp_1",
    name: "Spring Individual",
    code: "SPRING90",
    status: "ACTIVE",
    accessType: "FREE_TRIAL",
    plan: "INDIVIDUAL",
    billingInterval: "YEAR",
    trialDays: 90,
    freeAccessDays: null,
    stripePriceId: "price_secret",
    displayPriceLabel: "$24/year",
    requiresPaymentMethod: true,
    autoRenew: true,
    newUsersOnly: true,
    startsAt: null,
    endsAt: null,
    maxRedemptions: 100,
    redemptionCount: 5,
    internalNotes: "admin only",
    publicHeadline: "Start with 90 days free",
    publicSubheadline: "Individual Annual starts after your trial.",
    checkoutDisclosureCopy: "Today: $0.",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("acquisition campaign DB helpers", () => {
  const now = new Date("2026-04-29T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the active public Individual Annual trial campaign", async () => {
    mocks.findMany.mockResolvedValue([campaign()]);

    const result = await findActivePublicIndividualAnnualTrialCampaign(now);

    expect(result).toMatchObject({
      code: "SPRING90",
      status: "ACTIVE",
      plan: "INDIVIDUAL",
      accessType: "FREE_TRIAL",
      billingInterval: "YEAR",
    });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACTIVE",
          plan: "INDIVIDUAL",
          accessType: "FREE_TRIAL",
          billingInterval: "YEAR",
        }),
      }),
    );
  });

  it("returns the active public Individual Monthly paid offer", async () => {
    mocks.findMany.mockResolvedValue([
      campaign({
        id: "monthly",
        code: "MONTHLY",
        accessType: "PAID",
        billingInterval: "MONTH",
        trialDays: null,
        displayPriceLabel: "$4.99/month",
        publicHeadline: "Subscribe monthly",
      }),
    ]);

    const result = await findActivePublicIndividualMonthlyPaidOffer(now);

    expect(result).toMatchObject({
      code: "MONTHLY",
      accessType: "PAID",
      billingInterval: "MONTH",
    });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accessType: "PAID",
          billingInterval: "MONTH",
        }),
      }),
    );
  });

  it("ignores paused, future, expired, and wrong-interval campaigns", async () => {
    mocks.findMany.mockResolvedValue([
      campaign({ id: "paused", status: "PAUSED" }),
      campaign({ id: "future", startsAt: new Date("2026-05-01T00:00:00.000Z") }),
      campaign({ id: "expired", endsAt: new Date("2026-04-01T00:00:00.000Z") }),
      campaign({ id: "monthly", billingInterval: "MONTH" }),
    ]);

    await expect(findActivePublicIndividualAnnualTrialCampaign(now)).resolves.toBeNull();
  });

  it("returns null when no active campaign exists", async () => {
    mocks.findMany.mockResolvedValue([]);

    await expect(findActivePublicIndividualAnnualTrialCampaign(now)).resolves.toBeNull();
  });

  it("uses a deterministic most-recent fallback if old data has multiple active campaigns", async () => {
    mocks.findMany.mockResolvedValue([
      campaign({ id: "newer", code: "NEW90", updatedAt: new Date("2026-04-02T00:00:00.000Z") }),
      campaign({ id: "older", code: "OLD90", updatedAt: new Date("2026-04-01T00:00:00.000Z") }),
    ]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await findActivePublicIndividualAnnualTrialCampaign(now);

    expect(result?.code).toBe("NEW90");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("does not fall back to the hardcoded default when explicit lookup disables fallback", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(
      findAcquisitionCampaign("INDIVIDUAL90", { allowDefaultFallback: false }),
    ).resolves.toBeNull();
  });

  it("maps the active campaign into a safe public view model", async () => {
    mocks.findMany.mockResolvedValue([campaign()]);

    const viewModel = await getPublicCampaignViewModel(now);

    expect(viewModel).toMatchObject({
      campaignCode: "SPRING90",
      publicHeadline: "Start with 90 days free",
      publicSubheadline: "Individual Annual starts after your trial.",
      checkoutDisclosureCopy: "Today: $0.",
      displayPriceLabel: "$24/year",
      trialDays: 90,
      billingInterval: "YEAR",
      ctaText: "Start 3 months free",
      priceCopy: "$24/year after trial",
    });
    expect(JSON.stringify(viewModel)).not.toContain("price_secret");
    expect(JSON.stringify(viewModel)).not.toContain("admin only");
    expect(JSON.stringify(viewModel)).not.toContain("maxRedemptions");
  });

  it("normalizes stale default annual campaign pricing before public rendering", () => {
    const viewModel = toPublicCampaignViewModel(campaign({
      code: "INDIVIDUAL90",
      displayPriceLabel: "$79/year",
    }) as any);

    expect(viewModel).toMatchObject({
      campaignCode: "INDIVIDUAL90",
      displayPriceLabel: "$24/year",
      priceCopy: "$24/year after trial",
    });
    expect(JSON.stringify(viewModel)).not.toContain("$79/year");
  });

  it("returns annual trial and monthly paid offers together", async () => {
    mocks.findMany
      .mockResolvedValueOnce([campaign()])
      .mockResolvedValueOnce([
        campaign({
          id: "monthly",
          code: "MONTHLY",
          accessType: "PAID",
          billingInterval: "MONTH",
          trialDays: null,
          displayPriceLabel: "$4.99/month",
          publicHeadline: "Subscribe monthly",
          publicSubheadline: "Simple monthly billing.",
        }),
      ]);

    const offers = await getPublicSubscriptionOffersViewModel(now);

    expect(offers.annualTrial).toMatchObject({ campaignCode: "SPRING90" });
    expect(offers.monthlyPaid).toMatchObject({
      campaignCode: "MONTHLY",
      accessType: "PAID",
      billingInterval: "MONTH",
      displayPriceLabel: "$4.99/month",
      trialDays: null,
      ctaText: "Subscribe monthly",
      priceCopy: "$4.99/month",
    });
  });

  it("hides free-trial-specific text for zero-day campaigns", () => {
    const viewModel = toPublicCampaignViewModel(campaign({
      trialDays: 0,
      publicHeadline: "Individual Annual",
    }) as any);

    expect(viewModel?.trialLabel).toBeNull();
    expect(viewModel?.ctaText).toBe("Continue with annual");
    expect(viewModel?.priceCopy).toBe("$24/year");
  });
});
