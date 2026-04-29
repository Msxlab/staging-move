import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import {
  INDIVIDUAL_ANNUAL_PRICE_LABEL,
  INDIVIDUAL_ANNUAL_TRIAL_DAYS,
} from "@/lib/shared-billing";
import { validateStripeCampaignPrice } from "@/lib/stripe-campaign-validation";

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
    stripePriceId: paymentRequired ? (body.stripePriceId || null) : null,
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

export async function GET() {
  try {
    await requirePermission("subscriptions", "canRead", { minimumRole: "VIEWER" });
    const campaigns = await (prisma as any).acquisitionCampaign.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: {
        createdByAdmin: { select: { email: true, firstName: true, lastName: true } },
        redemptions: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { user: { select: { id: true, email: true } } },
        },
      },
    });
    return NextResponse.json({ campaigns });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("subscriptions", "canCreate", { minimumRole: "ADMIN" });
    const body = await request.json().catch(() => ({}));
    const data = campaignData(body, session.adminId);
    if (!data.name || !data.code) {
      return NextResponse.json({ error: "Campaign name and code are required." }, { status: 400 });
    }
    if (data.accessType === "FREE_TRIAL" && data.trialDays < 1) {
      return NextResponse.json({ error: "Trial days must be at least 1." }, { status: 400 });
    }
    if (data.accessType === "FREE_ACCESS" && data.freeAccessDays < 1) {
      return NextResponse.json({ error: "Free Access days must be at least 1." }, { status: 400 });
    }
    if (data.accessType === "PAID" && data.billingInterval !== "MONTH" && data.billingInterval !== "YEAR") {
      return NextResponse.json({ error: "Paid campaigns must use monthly or annual billing." }, { status: 400 });
    }

    const priceValidation = await validateStripeCampaignPrice(data);
    if (!priceValidation.ok) {
      return NextResponse.json(
        { code: priceValidation.code, error: priceValidation.error },
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
      await tx.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "CREATE",
          entityType: "AcquisitionCampaign",
          entityId: campaign.id,
          changes: JSON.stringify({ code: campaign.code, accessType: campaign.accessType }),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        },
      });
      return { campaign };
    });
    if (result.conflict) {
      return NextResponse.json(ACTIVE_CAMPAIGN_CONFLICT_RESPONSE, { status: 409 });
    }
    return NextResponse.json({ campaign: result.campaign, priceValidation }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error?.code === "P2002") return NextResponse.json({ error: "Campaign code already exists." }, { status: 409 });
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
