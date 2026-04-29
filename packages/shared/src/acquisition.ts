export const INDIVIDUAL_ANNUAL_TRIAL_DAYS = 90;
export const INDIVIDUAL_ANNUAL_PRICE_LABEL = "$79/year";
export const INDIVIDUAL_ANNUAL_TRIAL_CAMPAIGN_CODE = "INDIVIDUAL90";
export const SUBSCRIPTION_POLICY_VERSION = "2026-04";
export const REFUND_POLICY_VERSION = "2026-04";
export const TERMS_VERSION = "2026-04";

export const ACQUISITION_CAMPAIGN_STATUS_VALUES = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "ENDED",
] as const;
export type AcquisitionCampaignStatus = (typeof ACQUISITION_CAMPAIGN_STATUS_VALUES)[number];

export const ACQUISITION_ACCESS_TYPE_VALUES = [
  "FREE_ACCESS",
  "FREE_TRIAL",
] as const;
export type AcquisitionAccessType = (typeof ACQUISITION_ACCESS_TYPE_VALUES)[number];

export const USER_SUBSCRIPTION_STATE_VALUES = [
  "FREE_ACCESS",
  "FREE_ACCESS_EXPIRED",
  "TRIALING",
  "TRIAL_CANCELED",
  "ACTIVE",
  "CANCEL_AT_PERIOD_END",
  "CANCELED",
  "PAST_DUE",
  "GRACE_PERIOD",
  "PENDING_CHECKOUT",
  "REFUNDED",
  "UNKNOWN",
] as const;
export type UserSubscriptionState = (typeof USER_SUBSCRIPTION_STATE_VALUES)[number];

export interface AcquisitionCampaignLike {
  id?: string | null;
  name: string;
  code: string;
  status: AcquisitionCampaignStatus | string;
  accessType: AcquisitionAccessType | string;
  plan: string;
  billingInterval?: "YEAR" | string | null;
  trialDays?: number | null;
  freeAccessDays?: number | null;
  stripePriceId?: string | null;
  displayPriceLabel?: string | null;
  requiresPaymentMethod?: boolean | null;
  autoRenew?: boolean | null;
  newUsersOnly?: boolean | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  maxRedemptions?: number | null;
  redemptionCount?: number | null;
  publicHeadline?: string | null;
  publicSubheadline?: string | null;
  checkoutDisclosureCopy?: string | null;
}

export interface SubscriptionAccessLike {
  status?: string | null;
  accessType?: string | null;
  provider?: string | null;
  trialEndsAt?: Date | string | null;
  freeAccessEndsAt?: Date | string | null;
  currentPeriodEndsAt?: Date | string | null;
  stripeCurrentPeriodEnd?: Date | string | null;
  premiumUntil?: Date | string | null;
  gracePeriodEndsAt?: Date | string | null;
  cancelAtPeriodEnd?: boolean | null;
  canceledAt?: Date | string | null;
}

export interface CampaignSnapshot {
  campaignId: string | null;
  campaignCode: string;
  campaignName: string;
  accessType: AcquisitionAccessType;
  plan: "INDIVIDUAL";
  interval: "YEAR" | null;
  trialDaysAtSignup: number | null;
  freeAccessDaysAtSignup: number | null;
  stripePriceIdAtSignup: string | null;
  displayPriceAtSignup: string | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  firstChargeAt: string | null;
  firstChargeAmount: string | null;
  autoRenewAtSignup: boolean;
  consentAcceptedAt: string | null;
  consentIpHash?: string | null;
  consentUserAgentHash?: string | null;
  termsVersion: string;
  subscriptionPolicyVersion: string;
  refundPolicyVersion: string;
  checkoutDisclosureTextHash: string | null;
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function formatIsoDateOnly(value: Date | string | null | undefined): string {
  const date = asDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function getDefaultIndividualAnnualTrialCampaign(
  overrides: Partial<AcquisitionCampaignLike> = {},
): AcquisitionCampaignLike {
  return {
    id: null,
    name: "Individual Annual - 3 months free",
    code: INDIVIDUAL_ANNUAL_TRIAL_CAMPAIGN_CODE,
    status: "ACTIVE",
    accessType: "FREE_TRIAL",
    plan: "INDIVIDUAL",
    billingInterval: "YEAR",
    trialDays: INDIVIDUAL_ANNUAL_TRIAL_DAYS,
    freeAccessDays: null,
    stripePriceId: null,
    displayPriceLabel: INDIVIDUAL_ANNUAL_PRICE_LABEL,
    requiresPaymentMethod: true,
    autoRenew: true,
    newUsersOnly: true,
    startsAt: null,
    endsAt: null,
    maxRedemptions: null,
    redemptionCount: 0,
    publicHeadline: "Start with 3 months free",
    publicSubheadline: "Individual Annual starts after your trial.",
    checkoutDisclosureCopy:
      "Today: $0. Trial: 3 months. Your annual plan starts after the trial. You can cancel before then in Settings.",
    ...overrides,
  };
}

export function isCampaignRedeemable(
  campaign: AcquisitionCampaignLike,
  now: Date = new Date(),
): { redeemable: true } | { redeemable: false; reason: string } {
  if (campaign.status !== "ACTIVE") {
    return { redeemable: false, reason: "Campaign is not active." };
  }
  const startsAt = asDate(campaign.startsAt);
  const endsAt = asDate(campaign.endsAt);
  if (startsAt && startsAt > now) {
    return { redeemable: false, reason: "Campaign has not started yet." };
  }
  if (endsAt && endsAt <= now) {
    return { redeemable: false, reason: "Campaign has ended." };
  }
  if (
    typeof campaign.maxRedemptions === "number" &&
    typeof campaign.redemptionCount === "number" &&
    campaign.redemptionCount >= campaign.maxRedemptions
  ) {
    return { redeemable: false, reason: "Campaign redemption limit reached." };
  }
  if (campaign.plan !== "INDIVIDUAL") {
    return { redeemable: false, reason: "Only Individual campaigns are available." };
  }
  if (campaign.accessType === "FREE_TRIAL" && campaign.billingInterval !== "YEAR") {
    return { redeemable: false, reason: "Individual trial campaigns must use annual billing." };
  }
  return { redeemable: true };
}

export function buildCheckoutDisclosureText(input: {
  campaign?: AcquisitionCampaignLike | null;
  now?: Date;
  firstChargeAt?: Date | string | null;
  firstChargeAmount?: string | null;
}): string {
  const now = input.now || new Date();
  const campaign = input.campaign || getDefaultIndividualAnnualTrialCampaign();
  const trialDays = campaign.trialDays || INDIVIDUAL_ANNUAL_TRIAL_DAYS;
  const firstChargeAt = asDate(input.firstChargeAt) || addDays(now, trialDays);
  const amount = input.firstChargeAmount || campaign.displayPriceLabel || INDIVIDUAL_ANNUAL_PRICE_LABEL;
  return [
    "Today: $0.",
    `Trial: ${trialDays >= 89 && trialDays <= 92 ? "3 months" : `${trialDays} days`}.`,
    `Your annual plan starts on ${formatIsoDateOnly(firstChargeAt)}.`,
    `First charge: ${amount} on ${formatIsoDateOnly(firstChargeAt)}.`,
    "Renews yearly.",
    `You can cancel before ${formatIsoDateOnly(firstChargeAt)} in Settings.`,
  ].join(" ");
}

export function buildTrialConsentLabel(firstChargeAt: Date | string | null | undefined): string {
  const date = formatIsoDateOnly(firstChargeAt);
  return `I understand my Individual Annual trial starts today and will continue as an annual subscription after the trial unless I cancel before ${date}.`;
}

export function buildCampaignSnapshot(input: {
  campaign: AcquisitionCampaignLike;
  now?: Date;
  firstChargeAt?: Date | string | null;
  firstChargeAmount?: string | null;
  consentAcceptedAt?: Date | string | null;
  checkoutDisclosureTextHash?: string | null;
  consentIpHash?: string | null;
  consentUserAgentHash?: string | null;
}): CampaignSnapshot {
  const now = input.now || new Date();
  const campaign = input.campaign;
  const accessType = campaign.accessType === "FREE_ACCESS" ? "FREE_ACCESS" : "FREE_TRIAL";
  const trialDays = accessType === "FREE_TRIAL" ? campaign.trialDays || INDIVIDUAL_ANNUAL_TRIAL_DAYS : null;
  const freeAccessDays = accessType === "FREE_ACCESS" ? campaign.freeAccessDays || null : null;
  const trialEndsAt = trialDays ? addDays(now, trialDays) : null;
  const freeAccessEndsAt = freeAccessDays ? addDays(now, freeAccessDays) : null;
  const firstChargeAt = accessType === "FREE_TRIAL"
    ? asDate(input.firstChargeAt) || trialEndsAt
    : null;

  return {
    campaignId: campaign.id || null,
    campaignCode: campaign.code,
    campaignName: campaign.name,
    accessType,
    plan: "INDIVIDUAL",
    interval: accessType === "FREE_TRIAL" ? "YEAR" : null,
    trialDaysAtSignup: trialDays,
    freeAccessDaysAtSignup: freeAccessDays,
    stripePriceIdAtSignup: campaign.stripePriceId || null,
    displayPriceAtSignup: campaign.displayPriceLabel || null,
    trialStartsAt: accessType === "FREE_TRIAL" ? now.toISOString() : null,
    trialEndsAt: trialEndsAt?.toISOString() || null,
    firstChargeAt: firstChargeAt?.toISOString() || null,
    firstChargeAmount: input.firstChargeAmount || campaign.displayPriceLabel || null,
    autoRenewAtSignup: accessType === "FREE_TRIAL" ? Boolean(campaign.autoRenew) : false,
    consentAcceptedAt: asDate(input.consentAcceptedAt)?.toISOString() || null,
    consentIpHash: input.consentIpHash || null,
    consentUserAgentHash: input.consentUserAgentHash || null,
    termsVersion: TERMS_VERSION,
    subscriptionPolicyVersion: SUBSCRIPTION_POLICY_VERSION,
    refundPolicyVersion: REFUND_POLICY_VERSION,
    checkoutDisclosureTextHash: input.checkoutDisclosureTextHash || null,
  };
}

export function deriveUserSubscriptionState(
  subscription: SubscriptionAccessLike | null | undefined,
  now: Date = new Date(),
): UserSubscriptionState {
  if (!subscription) return "UNKNOWN";

  const status = subscription.status || "UNKNOWN";
  const trialEndsAt = asDate(subscription.trialEndsAt);
  const freeAccessEndsAt = asDate(subscription.freeAccessEndsAt);
  const gracePeriodEndsAt = asDate(subscription.gracePeriodEndsAt);
  const periodEnd = asDate(subscription.currentPeriodEndsAt)
    || asDate(subscription.stripeCurrentPeriodEnd)
    || asDate(subscription.premiumUntil);

  if (status === "REFUNDED") return "REFUNDED";

  // Stripe-side states take priority over lingering accessType=FREE_ACCESS.
  // A user can begin as Free Access and then start a paid annual trial; the
  // webhook will set status=TRIALING but accessType may not flip in the same
  // tick. Showing "Free Access" in that window misled trialing users into
  // seeing the trial CTA again, so check status first.
  if (status === "TRIAL_CANCELED") return "TRIAL_CANCELED";
  if (status === "TRIALING") {
    if (subscription.cancelAtPeriodEnd) return "TRIAL_CANCELED";
    return trialEndsAt && trialEndsAt > now ? "TRIALING" : "CANCELED";
  }
  if (status === "CANCEL_AT_PERIOD_END") return "CANCEL_AT_PERIOD_END";
  if (status === "ACTIVE" && subscription.accessType !== "FREE_ACCESS") {
    if (subscription.cancelAtPeriodEnd) return "CANCEL_AT_PERIOD_END";
    return periodEnd && periodEnd <= now && subscription.canceledAt ? "CANCELED" : "ACTIVE";
  }

  if (subscription.accessType === "FREE_ACCESS") {
    return freeAccessEndsAt && freeAccessEndsAt > now ? "FREE_ACCESS" : "FREE_ACCESS_EXPIRED";
  }
  if (status === "PAST_DUE") {
    return gracePeriodEndsAt && gracePeriodEndsAt > now ? "GRACE_PERIOD" : "PAST_DUE";
  }
  if (status === "ACTIVE") {
    if (subscription.cancelAtPeriodEnd) return "CANCEL_AT_PERIOD_END";
    return periodEnd && periodEnd <= now && subscription.canceledAt ? "CANCELED" : "ACTIVE";
  }
  // Stripe Checkout shell exists but the webhook hasn't confirmed yet — show
  // a calm "activating" state instead of UNKNOWN so the user is not greeted
  // by an error-shaped tile while their trial is being provisioned.
  if (status === "PENDING_CHECKOUT" || status === "PENDING_VALIDATION") return "PENDING_CHECKOUT";
  if (status === "CANCELED" || status === "EXPIRED" || status === "UNPAID") return "CANCELED";
  return "UNKNOWN";
}

export function getMinimalNotificationSchedule(accessType: AcquisitionAccessType | "PAID_ANNUAL") {
  if (accessType === "FREE_ACCESS") {
    return [
      { key: "free_access_started", daysBefore: null, includesPrice: false, mentionsRefund: false },
      { key: "free_access_ends_soon", daysBefore: 7, includesPrice: false, mentionsRefund: false },
      { key: "free_access_expired_in_app", daysBefore: 0, includesPrice: false, mentionsRefund: false },
    ] as const;
  }
  if (accessType === "FREE_TRIAL") {
    return [
      { key: "trial_started", daysBefore: null, includesPrice: true, mentionsRefund: false },
      { key: "trial_converts_soon", daysBefore: 7, includesPrice: true, mentionsRefund: false },
      { key: "trial_converts_tomorrow", daysBefore: 1, includesPrice: true, mentionsRefund: false },
      { key: "receipt_after_charge", daysBefore: null, includesPrice: true, mentionsRefund: false },
      { key: "payment_failed", daysBefore: null, includesPrice: false, mentionsRefund: false },
    ] as const;
  }
  return [
    { key: "annual_renewal_soon", daysBefore: 30, includesPrice: true, mentionsRefund: false },
    { key: "receipt_after_renewal", daysBefore: null, includesPrice: true, mentionsRefund: false },
    { key: "payment_failed", daysBefore: null, includesPrice: false, mentionsRefund: false },
  ] as const;
}
