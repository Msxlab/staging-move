import { describe, expect, it } from "vitest";
import {
  activeSubscriberMutationGuidance,
  getCampaignSyncTarget,
} from "../../../../scripts/lib/acquisition-campaign-sync";

describe("acquisition campaign billing sync helpers", () => {
  it("updates the active annual campaign offer from $79/year to $39.99/year", () => {
    expect(getCampaignSyncTarget("INDIVIDUAL90", {
      STRIPE_PRICE_INDIVIDUAL_YEARLY: "price_yearly_new",
    })).toEqual({
      code: "INDIVIDUAL90",
      displayPriceLabel: "$39.99/year",
      stripePriceId: "price_yearly_new",
      checkoutDisclosureCopy:
        "Annual plan includes a 90-day free trial, then renews at $39.99/year unless canceled.",
    });
  });

  it("updates the active monthly campaign offer to $3.99/month", () => {
    expect(getCampaignSyncTarget("INDIVIDUALMONTHLY", {
      STRIPE_PRICE_INDIVIDUAL_MONTHLY: "price_monthly_new",
    })).toMatchObject({
      code: "INDIVIDUALMONTHLY",
      displayPriceLabel: "$3.99/month",
      stripePriceId: "price_monthly_new",
      checkoutDisclosureCopy: "Monthly plan renews at $3.99/month unless canceled.",
    });
  });

  it("explains when cloning is safer than mutating an active campaign", () => {
    expect(activeSubscriberMutationGuidance(2)).toContain("Clone a new campaign");
  });
});
