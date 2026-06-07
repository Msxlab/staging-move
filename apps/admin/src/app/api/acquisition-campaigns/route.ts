import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import {
  INDIVIDUAL_ANNUAL_PRICE_LABEL,
  INDIVIDUAL_ANNUAL_TRIAL_DAYS,
} from "@/lib/shared-billing";
import { validateStripeCampaignPrice } from "@/lib/stripe-campaign-validation";
import { canSeeRawBillingIds, maskEmail } from "@/lib/privacy";

/**
 * Step-up credential fields are carried in the same JSON body as the
 * campaign payload (the client merges them in before submit). Pull them
 * out here so `campaignData` never sees them as campaign columns, and so
 * `requirePasswordConfirm` gets exactly what it expects.
 */
function extractStepUp(body: any) {
  return {
    confirmPassword: typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined,
    mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : undefined,
    backupCode: typeof body?.backupCode === "string" ? body.backupCode : undefined,
  };
}

/**
 * Mask the user/admin email fields carried by a campaign's `redemptions`
 * and `createdByAdmin` relations unless the caller is ADMIN/SUPER_ADMIN.
 * The campaign list/detail are readable by VIEWER (acquisition_campaigns
 * baseline), but a redemption email is end-user PII — every other admin
 * surface masks it for non-privileged roles, so do the same here.
 */
function redactCampaignEmails(campaign: any, showRaw: boolean) {
  if (!campaign || showRaw) return campaign;
  return {
    ...campaign,
    createdByAdmin: campaign.createdByAdmin
      ? { ...campaign.createdByAdmin, email: maskEmail(campaign.createdByAdmin.email) }
      : campaign.createdByAdmin,
    redemptions: Array.isArray(campaign.redemptions)
      ? campaign.redemptions.map((redemption: any) =>
          redemption?.user
            ? { ...redemption, user: { ...redemption.user, email: maskEmail(redemption.user.email) } }
            : redemption,
        )
      : campaign.redemptions,
  };
}

const ACTIVE_CAMPAIGN_CONFLICT_RESPONSE = {
  code: "ACTIVE_CAMPAIGN_CONFLICT",
  error: "Another active matching Individual campaign already exists. Pause or end it before activating this one.",
};

function normalizeCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function campaignData(body: any, adminId?: string) {
  const accessType = body.accessType === "FREE_ACCESS"
    ? "FREE_ACCESS"
    : body.accessType === "PAID"
      ? "PAID"
      : "FREE_TRIAL";
  const paymentRequired = accessType === "FREE_TRIAL" || accessType === "PAID";
  const billingInterval = accessType === "FREE_TRIAL"
    ? "YEAR"
    : accessType === "PAID"
      ? (body.billingInterval === "YEAR" ? "YEAR" : "MONTH")
      : null;
  const displayPriceLabel =
    typeof body.displayPriceLabel === "string" && body.displayPriceLabel.trim()
      ? body.displayPriceLabel.trim()
      : null;
  const data: any = {
    name: String(body.name || "").trim(),
    code: normalizeCode(body.code),
    status: body.status || "DRAFT",
    accessType,
    plan: "INDIVIDUAL",
    billingInterval,
    trialDays: accessType === "FREE_TRIAL" ? Number(body.trialDays || INDIVIDUAL_ANNUAL_TRIAL_DAYS) : null,
    freeAccessDays: accessType === "FREE_ACCESS" ? Number(body.freeAccessDays || 30) : null,
    stripePriceId: paymentRequired ? normalizeOptionalString(body.stripePriceId) : null,
    displayPriceLabel: displayPriceLabel || (paymentRequired ? null : INDIVIDUAL_ANNUAL_PRICE_LABEL),
    requiresPaymentMethod: paymentRequired,
    autoRenew: paymentRequired,
    newUsersOnly: body.newUsersOnly !== false,
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
    maxRedemptions: body.maxRedemptions ? Number(body.maxRedemptions) : null,
    internalNotes: body.internalNotes || null,
    publicHeadline: String(
      body.publicHeadline ||
        (accessType === "FREE_TRIAL"
          ? "Start with 3 months free"
          : accessType === "PAID"
            ? "Subscribe monthly"
            : "Free Access"),
    ).trim(),
    publicSubheadline: body.publicSubheadline || null,
    checkoutDisclosureCopy: body.checkoutDisclosureCopy || null,
  };
  if (adminId) data.createdByAdminId = adminId;
  return data;
}

function windowsOverlap(aStart?: Date | string | null, aEnd?: Date | string | null, bStart?: Date | string | null, bEnd?: Date | string | null) {
  const aStartMs = aStart ? new Date(aStart).getTime() : Number.NEGATIVE_INFINITY;
  const aEndMs = aEnd ? new Date(aEnd).getTime() : Number.POSITIVE_INFINITY;
  const bStartMs = bStart ? new Date(bStart).getTime() : Number.NEGATIVE_INFINITY;
  const bEndMs = bEnd ? new Date(bEnd).getTime() : Number.POSITIVE_INFINITY;
  return aStartMs <= bEndMs && bStartMs <= aEndMs;
}

async function findActiveCampaignConflict(client: any, candidate: any, excludeId?: string) {
  if (candidate.status !== "ACTIVE") return null;
  const campaigns = await client.acquisitionCampaign.findMany({
    where: {
      status: "ACTIVE",
      plan: candidate.plan,
      accessType: candidate.accessType,
      billingInterval: candidate.billingInterval ?? null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, startsAt: true, endsAt: true },
  });
  return campaigns.find((campaign: any) =>
    windowsOverlap(candidate.startsAt, candidate.endsAt, campaign.startsAt, campaign.endsAt),
  ) || null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("acquisition_campaigns", "canRead", { minimumRole: "VIEWER" });
    const showRawEmails = canSeeRawBillingIds(session.role);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const accessType = searchParams.get("accessType");
    const q = (searchParams.get("q") || "").trim();
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(10, Number.parseInt(searchParams.get("pageSize") || "50", 10) || 50),
    );

    const where: Record<string, unknown> = {};
    if (status && ["DRAFT", "ACTIVE", "PAUSED", "ENDED"].includes(status)) {
      where.status = status;
    }
    if (accessType && ["FREE_ACCESS", "FREE_TRIAL", "PAID"].includes(accessType)) {
      where.accessType = accessType;
    }
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { publicHeadline: { contains: q } },
      ];
    }

    const [campaigns, total] = await Promise.all([
      (prisma as any).acquisitionCampaign.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          createdByAdmin: { select: { email: true, firstName: true, lastName: true } },
          redemptions: {
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { user: { select: { id: true, email: true } } },
          },
        },
      }),
      (prisma as any).acquisitionCampaign.count({ where }),
    ]);
    const safeCampaigns = Array.isArray(campaigns)
      ? campaigns.map((campaign: any) => redactCampaignEmails(campaign, showRawEmails))
      : campaigns;
    return NextResponse.json({ campaigns: safeCampaigns, total, page, pageSize });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("acquisition_campaigns", "canCreate", { minimumRole: "ADMIN" });
    const body = await request.json().catch(() => ({}));
    const requestMeta = getAuditRequestMeta(request);

    // Creating a campaign binds a LIVE Stripe price ID and feeds the public
    // pricing surfaces — gate it behind admin password + MFA step-up, the
    // same bar every other billing mutation clears.
    const { confirmPassword, mfaCode, backupCode } = extractStepUp(body);
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "acquisition_campaign_create",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
        { status: 403 },
      );
    }

    const data = campaignData(body, session.adminId);
    if (!data.name || !data.code) {
      return NextResponse.json({ error: "Campaign name and code are required." }, { status: 400 });
    }
    // Number("abc") is NaN, and NaN < 1 is false — so a non-numeric value
    // previously slipped past these guards and was written as NaN to an Int
    // column. Guard on Number.isFinite so a bad value is rejected cleanly.
    if (data.accessType === "FREE_TRIAL" && (!Number.isFinite(data.trialDays) || data.trialDays < 1)) {
      return NextResponse.json({ error: "Trial days must be a number of at least 1." }, { status: 400 });
    }
    if (data.accessType === "FREE_ACCESS" && (!Number.isFinite(data.freeAccessDays) || data.freeAccessDays < 1)) {
      return NextResponse.json({ error: "Free Access days must be a number of at least 1." }, { status: 400 });
    }
    if (data.maxRedemptions !== null && (!Number.isFinite(data.maxRedemptions) || data.maxRedemptions < 1)) {
      return NextResponse.json(
        { error: "Max redemptions must be a positive whole number, or left blank for unlimited." },
        { status: 400 },
      );
    }
    if (data.accessType === "PAID" && data.billingInterval !== "MONTH" && data.billingInterval !== "YEAR") {
      return NextResponse.json({ error: "Paid campaigns must use monthly or annual billing." }, { status: 400 });
    }

    const priceValidation = await validateStripeCampaignPrice(data);
    if (!priceValidation.ok) {
      return NextResponse.json(
        { code: priceValidation.code, error: priceValidation.error, priceValidation },
        { status: 422 },
      );
    }
    if (priceValidation.displayPriceLabel !== undefined) {
      data.displayPriceLabel = priceValidation.displayPriceLabel;
    }

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const conflict = await findActiveCampaignConflict(tx, data);
      if (conflict) return { conflict };
      const campaign = await tx.acquisitionCampaign.create({ data });
      return { campaign };
    });
    if (result.conflict) {
      return NextResponse.json(ACTIVE_CAMPAIGN_CONFLICT_RESPONSE, { status: 409 });
    }
    await writeAdminAudit(session, {
      action: "ACQUISITION_CAMPAIGN_CREATE",
      entityType: "AcquisitionCampaign",
      entityId: result.campaign.id,
      after: { code: result.campaign.code, accessType: result.campaign.accessType, status: result.campaign.status },
      metadata: { operation: "acquisition_campaign_create" },
      request: requestMeta,
    });
    return NextResponse.json({ campaign: result.campaign, priceValidation }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error?.code === "P2002") return NextResponse.json({ error: "Campaign code already exists." }, { status: 409 });
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
