import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublicSubscriptionOffersViewModel: vi.fn(),
}));

vi.mock("@/lib/acquisition-campaigns", () => ({
  getPublicSubscriptionOffersViewModel: mocks.getPublicSubscriptionOffersViewModel,
}));

import { GET } from "./route";

describe("public trial campaign endpoint", () => {
  it("returns the synced annual campaign label used by web and mobile paywalls", async () => {
    mocks.getPublicSubscriptionOffersViewModel.mockResolvedValue({
      annualTrial: {
        campaignCode: "INDIVIDUAL90",
        displayPriceLabel: "$39.99/year",
        checkoutDisclosureCopy:
          "Annual plan includes a 90-day free trial, then renews at $39.99/year unless canceled.",
      },
      monthlyPaid: {
        campaignCode: "INDIVIDUALMONTHLY",
        displayPriceLabel: "$3.99/month",
      },
    });

    const response = await GET();
    const body = await response.json();

    expect(body.campaign).toMatchObject({
      campaignCode: "INDIVIDUAL90",
      displayPriceLabel: "$39.99/year",
    });
    expect(body.offers.monthlyPaid).toMatchObject({
      displayPriceLabel: "$3.99/month",
    });
    expect(JSON.stringify(body)).not.toContain("$79/year");
  });
});
