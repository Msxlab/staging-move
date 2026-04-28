import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import {
  buildCampaignSnapshot,
  buildCheckoutDisclosureText,
  getDefaultIndividualAnnualTrialCampaign,
  INDIVIDUAL_ANNUAL_TRIAL_CAMPAIGN_CODE,
  isCampaignRedeemable,
  type AcquisitionCampaignLike,
  type CampaignSnapshot,
} from "@/lib/shared-billing";

export function hashForSnapshot(value: string | null | undefined) {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex");
}

export function getRequestHashSnapshot(request: Request) {
  return {
    consentIpHash: hashForSnapshot(
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
    ),
    consentUserAgentHash: hashForSnapshot(request.headers.get("user-agent")),
  };
}

export function campaignToSnapshotText(snapshot: CampaignSnapshot) {
  return JSON.stringify(snapshot);
}

export function buildCheckoutConsentSnapshot(input: {
  acceptedAt: Date;
  disclosureText: string;
  consentIpHash?: string | null;
  consentUserAgentHash?: string | null;
}) {
  return JSON.stringify({
    consentAcceptedAt: input.acceptedAt.toISOString(),
    consentIpHash: input.consentIpHash || null,
    consentUserAgentHash: input.consentUserAgentHash || null,
    checkoutDisclosureTextHash: hashForSnapshot(input.disclosureText),
  });
}

function normalizeCampaign(record: any): AcquisitionCampaignLike {
  return {
    id: record.id ?? null,
    name: record.name,
    code: record.code,
    status: record.status,
    accessType: record.accessType,
    plan: record.plan,
    billingInterval: record.billingInterval,
    trialDays: record.trialDays,
    freeAccessDays: record.freeAccessDays,
    stripePriceId: record.stripePriceId,
    displayPriceLabel: record.displayPriceLabel,
    requiresPaymentMethod: record.requiresPaymentMethod,
    autoRenew: record.autoRenew,
    newUsersOnly: record.newUsersOnly,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    maxRedemptions: record.maxRedemptions,
    redemptionCount: record.redemptionCount,
    publicHeadline: record.publicHeadline,
    publicSubheadline: record.publicSubheadline,
    checkoutDisclosureCopy: record.checkoutDisclosureCopy,
  };
}

export async function findAcquisitionCampaign(code?: string | null): Promise<AcquisitionCampaignLike | null> {
  const normalizedCode = (code || INDIVIDUAL_ANNUAL_TRIAL_CAMPAIGN_CODE).trim().toUpperCase();
  try {
    const campaign = await (prisma as any).acquisitionCampaign.findUnique({
      where: { code: normalizedCode },
    });
    if (campaign) return normalizeCampaign(campaign);
  } catch {
    // During a rolling deploy the app may start before the additive
    // migration has been applied. Keep the default Individual offer usable;
    // custom admin campaign codes require the migration-backed table.
  }

  if (normalizedCode === INDIVIDUAL_ANNUAL_TRIAL_CAMPAIGN_CODE) {
    return getDefaultIndividualAnnualTrialCampaign();
  }
  return null;
}

export function assertCampaignAvailable(campaign: AcquisitionCampaignLike, now = new Date()) {
  const status = isCampaignRedeemable(campaign, now);
  if (!status.redeemable) {
    throw new Error(status.reason);
  }
}

export function buildSignupSnapshot(input: {
  campaign: AcquisitionCampaignLike;
  now: Date;
  firstChargeAmount?: string | null;
  disclosureText?: string | null;
  consentAcceptedAt?: Date | null;
  consentIpHash?: string | null;
  consentUserAgentHash?: string | null;
}) {
  const disclosureText =
    input.disclosureText ||
    buildCheckoutDisclosureText({
      campaign: input.campaign,
      now: input.now,
      firstChargeAmount: input.firstChargeAmount,
    });
  return buildCampaignSnapshot({
    campaign: input.campaign,
    now: input.now,
    firstChargeAmount: input.firstChargeAmount,
    consentAcceptedAt: input.consentAcceptedAt || null,
    checkoutDisclosureTextHash: hashForSnapshot(disclosureText),
    consentIpHash: input.consentIpHash || null,
    consentUserAgentHash: input.consentUserAgentHash || null,
  });
}
