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
    expect(copy).toContain("Trial: 3 months.");
    expect(copy).toContain("Your annual plan starts on 2026-07-27.");
    expect(copy).toContain("First charge: $79/year on 2026-07-27.");
    expect(copy).toContain("You can cancel before 2026-07-27 in Settings.");
    expect(copy.toLowerCase()).not.toContain("refund");
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
      displayPriceLabel: "$79/year",
    });
    const snapshot = buildCampaignSnapshot({
      campaign,
      now,
      consentAcceptedAt: now,
      checkoutDisclosureTextHash: "hash_1",
    });

    campaign.name = "Edited later";
    campaign.displayPriceLabel = "$99/year";

    expect(snapshot).toMatchObject({
      campaignId: "camp_1",
      campaignCode: "SPRING90",
      campaignName: "Spring Individual",
      accessType: "FREE_TRIAL",
      plan: "INDIVIDUAL",
      interval: "YEAR",
      trialDaysAtSignup: 90,
      stripePriceIdAtSignup: "price_annual",
      displayPriceAtSignup: "$79/year",
      autoRenewAtSignup: true,
      checkoutDisclosureTextHash: "hash_1",
    });
    expect(snapshot.trialEndsAt).toBe("2026-07-27T12:00:00.000Z");
    expect(snapshot.firstChargeAt).toBe("2026-07-27T12:00:00.000Z");
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

  it("uses the minimal notification schedule and avoids refund-heavy reminders", () => {
    const freeTrial = getMinimalNotificationSchedule("FREE_TRIAL");
    const freeAccess = getMinimalNotificationSchedule("FREE_ACCESS");
    const paidAnnual = getMinimalNotificationSchedule("PAID_ANNUAL");

    expect(freeTrial.map((entry) => entry.daysBefore)).toEqual([null, 7, 1, null, null]);
    expect(freeAccess.map((entry) => entry.daysBefore)).toEqual([null, 7, 0]);
    expect(paidAnnual.map((entry) => entry.daysBefore)).toEqual([30, null, null]);
    expect([...freeTrial, ...freeAccess, ...paidAnnual].every((entry) => !entry.mentionsRefund)).toBe(true);
    expect(freeTrial.some((entry) => entry.daysBefore === 21 || entry.daysBefore === 3)).toBe(false);
  });
});
