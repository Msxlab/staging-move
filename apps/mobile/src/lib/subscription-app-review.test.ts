import { describe, expect, it } from "vitest";
import {
  getAnnualActionLabels,
  shouldEmphasizeAnnualBilledPrice,
} from "./subscription-app-review";

describe("subscription app review helpers", () => {
  it("emphasizes the billed annual price when annual trial/savings copy is shown", () => {
    expect(shouldEmphasizeAnnualBilledPrice({
      showAnnualAction: true,
      yearlyDisplayPrice: "$24/year",
      trialBadge: "First 3 months free",
      savingsText: null,
    })).toBe(true);
  });

  it("does not emphasize annual billing when the annual action is unavailable", () => {
    expect(shouldEmphasizeAnnualBilledPrice({
      showAnnualAction: false,
      yearlyDisplayPrice: "$24/year",
      trialBadge: "First 3 months free",
      savingsText: "Save $7.89/year vs monthly - 16% off",
    })).toBe(false);
  });

  it("keeps the billed amount inside the annual CTA label and trial copy subordinate", () => {
    expect(getAnnualActionLabels({
      yearlyDisplayPrice: "$24/year",
      isSwitching: false,
      trialBadge: "First 3 months free",
      startLabel: "Start annual",
    })).toEqual({
      buttonLabel: "Start annual - $24/year",
      metaText: "First 3 months free",
    });
  });

  it("uses the switch label for annual plan changes", () => {
    expect(getAnnualActionLabels({
      yearlyDisplayPrice: "$24/year",
      isSwitching: true,
      switchLabel: "Switch to annual",
    })).toEqual({
      buttonLabel: "Switch to annual - $24/year",
      metaText: null,
    });
  });
});
