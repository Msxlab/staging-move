import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import {
  buildCampaignSnapshot,
  buildCheckoutDisclosureText,
  getDefaultIndividualAnnualTrialCampaign,
  INDIVIDUAL_ANNUAL_PRICE_LABEL,
  INDIVIDUAL_ANNUAL_TRIAL_DAYS,
  INDIVIDUAL_ANNUAL_TRIAL_CAMPAIGN_CODE,
  isCampaignRedeemable,
  type AcquisitionCampaignLike,
  type CampaignSnapshot,
} from "@/lib/shared-billing";

export interface PublicCampaignViewModel {
  campaignCode: string;
  publicHeadline: string;
  publicSubheadline: string | null;
  checkoutDisclosureCopy: string | null;
  displayPriceLabel: string;
  trialDays: number;
  billingInterval: string | null;
  ctaText: string;
  priceCopy: string;
  trialLabel: string | null;
}

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

function isActivePublicIndividualAnnualTrialCampaign(
  campaign: AcquisitionCampaignLike,
  now: Date,
) {
  const startsAt = campaign.startsAt ? new Date(campaign.startsAt) : null;
  const endsAt = campaign.endsAt ? new Date(campaign.endsAt) : null;
  return (
    campaign.status === "ACTIVE" &&
    campaign.plan === "INDIVIDUAL" &&
    campaign.accessType === "FREE_TRIAL" &&
    campaign.billingInterval === "YEAR" &&
    (!startsAt || startsAt <= now) &&
    (!endsAt || endsAt >= now)
  );
}

export async function findAcquisitionCampaign(
  code?: string | null,
  options: { allowDefaultFallback?: boolean } = {},
): Promise<AcquisitionCampaignLike | null> {
  const normalizedCode = (code || INDIVIDUAL_ANNUAL_TRIAL_CAMPAIGN_CODE).trim().toUpperCase();
  const allowDefaultFallback = options.allowDefaultFallback !== false;
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

  if (allowDefaultFallback && normalizedCode === INDIVIDUAL_ANNUAL_TRIAL_CAMPAIGN_CODE) {
    return getDefaultIndividualAnnualTrialCampaign();
  }
  return null;
}

export async function findActivePublicIndividualAnnualTrialCampaign(
  now = new Date(),
): Promise<AcquisitionCampaignLike | null> {
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
    return null;
  }
  try {
    const campaigns = await (prisma as any).acquisitionCampaign.findMany({
      where: {
        status: "ACTIVE",
        plan: "INDIVIDUAL",
        accessType: "FREE_TRIAL",
        billingInterval: "YEAR",
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 2,
    });
    const activeCampaigns = (campaigns || [])
      .map(normalizeCampaign)
      .filter((campaign: AcquisitionCampaignLike) =>
        isActivePublicIndividualAnnualTrialCampaign(campaign, now),
      );
    if (!activeCampaigns.length) return null;
    if (activeCampaigns.length > 1) {
      console.warn("[acquisition-campaigns] Multiple active public Individual Annual trial campaigns matched; using most recently updated.");
    }
    return activeCampaigns[0];
  } catch {
    return null;
  }
}

export function getTrialLabel(days: number | null | undefined) {
  const normalizedDays = Number(days || 0);
  if (normalizedDays <= 0) return null;
  if (normalizedDays === 90) return "3 months";
  if (normalizedDays % 30 === 0) {
    const months = normalizedDays / 30;
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  return `${normalizedDays} day${normalizedDays === 1 ? "" : "s"}`;
}

export function toPublicCampaignViewModel(
  campaign: AcquisitionCampaignLike | null | undefined,
): PublicCampaignViewModel | null {
  if (!campaign) return null;
  const trialDays = Number(campaign.trialDays ?? INDIVIDUAL_ANNUAL_TRIAL_DAYS);
  const displayPriceLabel = campaign.displayPriceLabel || INDIVIDUAL_ANNUAL_PRICE_LABEL;
  const trialLabel = getTrialLabel(trialDays);
  return {
    campaignCode: campaign.code,
    publicHeadline: campaign.publicHeadline || (trialLabel ? `Start with ${trialLabel} free` : "Individual Annual"),
    publicSubheadline: campaign.publicSubheadline || null,
    checkoutDisclosureCopy: campaign.checkoutDisclosureCopy || null,
    displayPriceLabel,
    trialDays,
    billingInterval: campaign.billingInterval || null,
    ctaText: trialLabel ? `Start ${trialLabel} free` : "Continue with annual",
    priceCopy: trialLabel ? `${displayPriceLabel} after trial` : displayPriceLabel,
    trialLabel,
  };
}

export async function getPublicCampaignViewModel(
  now = new Date(),
): Promise<PublicCampaignViewModel | null> {
  return toPublicCampaignViewModel(await findActivePublicIndividualAnnualTrialCampaign(now));
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
