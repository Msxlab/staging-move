import { describe, expect, it } from "vitest";
import {
  getStripeSubscriptionCurrentPeriodEndDate,
  getStripeSubscriptionCurrentPeriodEndUnix,
  getStripeSubscriptionCurrentPeriodStartUnix,
} from "./stripe-subscription-period";

describe("stripe subscription period helpers", () => {
  it("prefers root subscription period fields when Stripe includes them", () => {
    const subscription = {
      current_period_start: 1_780_000_000,
      current_period_end: 1_800_000_000,
      items: {
        data: [
          {
            current_period_start: 1_700_000_000,
            current_period_end: 1_710_000_000,
          },
        ],
      },
    };

    expect(getStripeSubscriptionCurrentPeriodStartUnix(subscription)).toBe(1_780_000_000);
    expect(getStripeSubscriptionCurrentPeriodEndUnix(subscription)).toBe(1_800_000_000);
    expect(getStripeSubscriptionCurrentPeriodEndDate(subscription)?.toISOString()).toBe(
      "2027-01-15T08:00:00.000Z",
    );
  });

  it("falls back to the first subscription item period fields", () => {
    const subscription = {
      current_period_start: null,
      current_period_end: null,
      items: {
        data: [
          {
            current_period_start: 1_780_000_000,
            current_period_end: 1_800_000_000,
          },
        ],
      },
    };

    expect(getStripeSubscriptionCurrentPeriodStartUnix(subscription)).toBe(1_780_000_000);
    expect(getStripeSubscriptionCurrentPeriodEndUnix(subscription)).toBe(1_800_000_000);
    expect(getStripeSubscriptionCurrentPeriodEndDate(subscription)?.toISOString()).toBe(
      "2027-01-15T08:00:00.000Z",
    );
  });

  it("returns null when no finite period field is present", () => {
    expect(getStripeSubscriptionCurrentPeriodStartUnix({ items: { data: [{}] } })).toBeNull();
    expect(getStripeSubscriptionCurrentPeriodEndUnix({ items: { data: [{}] } })).toBeNull();
    expect(getStripeSubscriptionCurrentPeriodEndDate({ items: { data: [{}] } })).toBeNull();
  });
});
