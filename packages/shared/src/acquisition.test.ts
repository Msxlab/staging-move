import { describe, expect, it } from "vitest";
import {
  buildCampaignSnapshot,
  buildCheckoutDisclosureText,
  buildTrialConsentLabel,
  deriveUserSubscriptionState,
  getDefaultIndividualAnnualTrialCampaign,
  getMinimalNotificationSchedule,
  isCampaignRedeemable,
} from "./acquisition";

describe("acquisition campaign helpers", () => {
  const now = new Date("2026-04-28T12:00:00.000Z");

  it("creates a calm Individual Annual checkout disclosure with amount and first charge date", () => {
    const campaign = getDefaultIndividualAnnualTrialCampaign();
    const copy = buildCheckoutDisclosureText({ campaign, now });

    expect(copy).toContain("Today: $0.");
    expect(copy).toContain("Trial: 14 days.");
    expect(copy).toContain("Your annual plan starts on 2026-05-12.");
    expect(copy).toContain("First charge: $24/year on 2026-05-12.");
    expect(copy).toContain("You can cancel before 2026-05-12 in Settings.");
    expect(copy.toLowerCase()).not.toContain("refund");
  });

  it("creates paid monthly checkout disclosure without trial language", () => {
    const campaign = {
      ...getDefaultIndividualAnnualTrialCampaign(),
      accessType: "PAID",
      billingInterval: "MONTH",
      trialDays: null,
      displayPriceLabel: "$4.99/month",
      requiresPaymentMethod: true,
    };
    const copy = buildCheckoutDisclosureText({ campaign, now });

    expect(isCampaignRedeemable(campaign, now)).toEqual({ redeemable: true });
    expect(copy).toContain("Today: $4.99/month.");
    expect(copy).toContain("Your Individual subscription starts on 2026-04-28.");
    expect(copy).toContain("Renews monthly.");
    expect(copy).not.toContain("Trial:");
  });

  it("keeps consent explicit and unambiguous without marketing alarm copy", () => {
    expect(buildTrialConsentLabel("2026-07-27T12:00:00.000Z")).toBe(
      "I understand my Individual Annual trial starts today and will continue as an annual subscription after the trial unless I cancel before 2026-07-27.",
    );
  });

  it("rejects paused, ended, and non-Individual campaigns", () => {
    expect(isCampaignRedeemable({ ...getDefaultIndividualAnnualTrialCampaign(), status: "PAUSED" }, now)).toMatchObject({
      redeemable: false,
    });
    expect(isCampaignRedeemable({ ...getDefaultIndividualAnnualTrialCampaign(), endsAt: "2026-04-28T11:00:00.000Z" }, now)).toMatchObject({
      redeemable: false,
    });
    expect(isCampaignRedeemable({ ...getDefaultIndividualAnnualTrialCampaign(), plan: "FAMILY" }, now)).toMatchObject({
      redeemable: false,
    });
  });

  it("saves a redemption snapshot that is independent from future campaign edits", () => {
    const campaign = getDefaultIndividualAnnualTrialCampaign({
      id: "camp_1",
      name: "Spring Individual",
      code: "SPRING90",
      stripePriceId: "price_annual",
      displayPriceLabel: "$24/year",
    });
    const snapshot = buildCampaignSnapshot({
      campaign,
      now,
      consentAcceptedAt: now,
      checkoutDisclosureTextHash: "hash_1",
    });

    campaign.name = "Edited later";
    campaign.displayPriceLabel = "$49.99/year";

    expect(snapshot).toMatchObject({
      campaignId: "camp_1",
      campaignCode: "SPRING90",
      campaignName: "Spring Individual",
      accessType: "FREE_TRIAL",
      plan: "INDIVIDUAL",
      interval: "YEAR",
      trialDaysAtSignup: 14,
      stripePriceIdAtSignup: "price_annual",
      displayPriceAtSignup: "$24/year",
      autoRenewAtSignup: true,
      checkoutDisclosureTextHash: "hash_1",
    });
    expect(snapshot.trialEndsAt).toBe("2026-05-12T12:00:00.000Z");
    expect(snapshot.firstChargeAt).toBe("2026-05-12T12:00:00.000Z");
  });

  it("saves paid monthly snapshots with monthly interval and immediate first charge", () => {
    const campaign = {
      ...getDefaultIndividualAnnualTrialCampaign({
        id: "camp_monthly",
        name: "Monthly Individual",
        code: "MONTHLY",
        stripePriceId: "price_monthly",
        displayPriceLabel: "$4.99/month",
      }),
      accessType: "PAID",
      billingInterval: "MONTH",
      trialDays: null,
      requiresPaymentMethod: true,
    };

    const snapshot = buildCampaignSnapshot({
      campaign,
      now,
      consentAcceptedAt: now,
      checkoutDisclosureTextHash: "hash_monthly",
    });

    expect(snapshot).toMatchObject({
      campaignId: "camp_monthly",
      campaignCode: "MONTHLY",
      accessType: "PAID",
      plan: "INDIVIDUAL",
      interval: "MONTH",
      trialDaysAtSignup: null,
      stripePriceIdAtSignup: "price_monthly",
      displayPriceAtSignup: "$4.99/month",
      firstChargeAmount: "$4.99/month",
      checkoutDisclosureTextHash: "hash_monthly",
    });
    expect(snapshot.trialStartsAt).toBeNull();
    expect(snapshot.trialEndsAt).toBeNull();
    expect(snapshot.firstChargeAt).toBe("2026-04-28T12:00:00.000Z");
  });

  it("distinguishes Free Access, trial, canceled trial, and paid renewal states", () => {
    expect(deriveUserSubscriptionState({
      accessType: "FREE_ACCESS",
      status: "ACTIVE",
      freeAccessEndsAt: "2026-05-28T12:00:00.000Z",
    }, now)).toBe("FREE_ACCESS");

    expect(deriveUserSubscriptionState({
      accessType: "FREE_ACCESS",
      status: "ACTIVE",
      freeAccessEndsAt: "2026-04-01T12:00:00.000Z",
    }, now)).toBe("FREE_ACCESS_EXPIRED");

    expect(deriveUserSubscriptionState({
      accessType: "FREE_TRIAL",
      status: "TRIALING",
      trialEndsAt: "2026-07-27T12:00:00.000Z",
    }, now)).toBe("TRIALING");

    expect(deriveUserSubscriptionState({
      accessType: "FREE_TRIAL",
      status: "TRIALING",
      cancelAtPeriodEnd: true,
      trialEndsAt: "2026-07-27T12:00:00.000Z",
    }, now)).toBe("TRIAL_CANCELED");

    expect(deriveUserSubscriptionState({
      status: "ACTIVE",
      cancelAtPeriodEnd: true,
      currentPeriodEndsAt: "2027-04-28T12:00:00.000Z",
    }, now)).toBe("CANCEL_AT_PERIOD_END");
  });

  it("treats Stripe-confirmed trialing/active as primary even if accessType still says Free Access", () => {
    // Webhook can flip status before accessType lands in the same write.
    // The settings page must not show Free Access while Stripe says trialing.
    expect(deriveUserSubscriptionState({
      accessType: "FREE_ACCESS",
      status: "TRIALING",
      trialEndsAt: "2026-07-27T12:00:00.000Z",
    }, now)).toBe("TRIALING");

    expect(deriveUserSubscriptionState({
      accessType: "FREE_ACCESS",
      status: "TRIAL_CANCELED",
      trialEndsAt: "2026-07-27T12:00:00.000Z",
    }, now)).toBe("TRIAL_CANCELED");

    expect(deriveUserSubscriptionState({
      accessType: "FREE_ACCESS",
      status: "CANCEL_AT_PERIOD_END",
      currentPeriodEndsAt: "2027-04-28T12:00:00.000Z",
    }, now)).toBe("CANCEL_AT_PERIOD_END");
  });

  it("returns PENDING_CHECKOUT while Stripe webhook is still in flight", () => {
    expect(deriveUserSubscriptionState({
      status: "PENDING_CHECKOUT",
    }, now)).toBe("PENDING_CHECKOUT");
  });

  it("prefers PENDING_CHECKOUT over lingering accessType=FREE_ACCESS", () => {
    // Free Access users carry accessType=FREE_ACCESS even after they kick
    // off the annual trial. Without this ordering the settings page would
    // still show "Free Access" and re-render the trial CTA on top of the
    // "Activating?" banner during the brief window before Stripe confirms.
    expect(deriveUserSubscriptionState({
      accessType: "FREE_ACCESS",
      status: "PENDING_CHECKOUT",
      freeAccessEndsAt: "2026-05-28T12:00:00.000Z",
    }, now)).toBe("PENDING_CHECKOUT");
  });

  it("keeps explicit store grace periods distinct from past-due states", () => {
    expect(deriveUserSubscriptionState({
      status: "GRACE_PERIOD",
      accessType: "PAID",
      gracePeriodEndsAt: "2026-05-01T12:00:00.000Z",
    }, now)).toBe("GRACE_PERIOD");

    expect(deriveUserSubscriptionState({
      status: "GRACE_PERIOD",
      accessType: "PAID",
      gracePeriodEndsAt: "2026-04-01T12:00:00.000Z",
    }, now)).toBe("PAST_DUE");
  });

  it("uses the minimal notification schedule and avoids refund-heavy reminders", () => {
    const freeTrial = getMinimalNotificationSchedule("FREE_TRIAL");
    const freeAccess = getMinimalNotificationSchedule("FREE_ACCESS");
    const paidAnnual = getMinimalNotificationSchedule("PAID_ANNUAL");

    const freeTrialDays = freeTrial.map((entry): number | null => entry.daysBefore);
    expect(freeTrialDays).toEqual([null, 7, 1, null, null]);
    expect(freeAccess.map((entry) => entry.daysBefore)).toEqual([null, 7, 0]);
    expect(paidAnnual.map((entry) => entry.daysBefore)).toEqual([30, null, null]);
    expect([...freeTrial, ...freeAccess, ...paidAnnual].every((entry) => !entry.mentionsRefund)).toBe(true);
    expect(freeTrialDays.some((daysBefore) => daysBefore === 21 || daysBefore === 3)).toBe(false);
  });
});
