import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import {
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

function mutableCampaignData(body: any) {
  const data: any = {};
  for (const key of [
    "name",
    "status",
    "internalNotes",
    "publicHeadline",
    "publicSubheadline",
    "checkoutDisclosureCopy",
  ]) {
    if (body[key] !== undefined) data[key] = body[key] || null;
  }
  if (body.code !== undefined) data.code = normalizeCode(body.code);
  if (body.accessType !== undefined) {
    data.accessType = body.accessType === "FREE_ACCESS"
      ? "FREE_ACCESS"
      : body.accessType === "PAID"
        ? "PAID"
        : "FREE_TRIAL";
    data.billingInterval = data.accessType === "FREE_TRIAL"
      ? "YEAR"
      : data.accessType === "PAID"
        ? (body.billingInterval === "YEAR" ? "YEAR" : "MONTH")
        : null;
    data.requiresPaymentMethod = data.accessType === "FREE_TRIAL" || data.accessType === "PAID";
    data.autoRenew = data.requiresPaymentMethod;
    if (!data.requiresPaymentMethod) data.stripePriceId = null;
  }
  if (body.billingInterval !== undefined && data.accessType === undefined) {
    data.billingInterval = body.billingInterval === "YEAR" ? "YEAR" : body.billingInterval === "MONTH" ? "MONTH" : null;
  }
  if (body.trialDays !== undefined) data.trialDays = body.trialDays ? Number(body.trialDays) : null;
  if (body.freeAccessDays !== undefined) data.freeAccessDays = body.freeAccessDays ? Number(body.freeAccessDays) : null;
  if (body.stripePriceId !== undefined) data.stripePriceId = body.stripePriceId || null;
  if (body.displayPriceLabel !== undefined) {
    data.displayPriceLabel =
      typeof body.displayPriceLabel === "string" && body.displayPriceLabel.trim()
        ? body.displayPriceLabel.trim()
        : null;
  }
  if (body.newUsersOnly !== undefined) data.newUsersOnly = Boolean(body.newUsersOnly);
  if (body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (body.maxRedemptions !== undefined) data.maxRedemptions = body.maxRedemptions ? Number(body.maxRedemptions) : null;
  return data;
}

function windowsOverlap(aStart?: Date | string | null, aEnd?: Date | string | null, bStart?: Date | string | null, bEnd?: Date | string | null) {
  const aStartMs = aStart ? new Date(aStart).getTime() : Number.NEGATIVE_INFINITY;
  const aEndMs = aEnd ? new Date(aEnd).getTime() : Number.POSITIVE_INFINITY;
  const bStartMs = bStart ? new Date(bStart).getTime() : Number.NEGATIVE_INFINITY;
  const bEndMs = bEnd ? new Date(bEnd).getTime() : Number.POSITIVE_INFINITY;
  return aStartMs <= bEndMs && bStartMs <= aEndMs;
}

async function findActiveCampaignConflict(client: any, candidate: any, excludeId: string) {
  if (candidate.status !== "ACTIVE") return null;
  const campaigns = await client.acquisitionCampaign.findMany({
    where: {
      status: "ACTIVE",
      plan: candidate.plan,
      accessType: candidate.accessType,
      billingInterval: candidate.billingInterval ?? null,
      id: { not: excludeId },
    },
    select: { id: true, startsAt: true, endsAt: true },
  });
  return campaigns.find((campaign: any) =>
    windowsOverlap(candidate.startsAt, candidate.endsAt, campaign.startsAt, campaign.endsAt),
  ) || null;
}

function requiresStripePriceValidation(existing: any, data: any) {
  if (data.status === "ACTIVE" && existing.status !== "ACTIVE") return true;
  for (const key of [
    "accessType",
    "billingInterval",
    "trialDays",
    "stripePriceId",
    "displayPriceLabel",
  ]) {
    if (data[key] !== undefined) return true;
  }
  return false;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission("subscriptions", "canRead", { minimumRole: "VIEWER" });
    const { id } = await params;
    const campaign = await (prisma as any).acquisitionCampaign.findUnique({
      where: { id },
      include: {
        redemptions: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
            subscription: { select: { id: true, status: true, trialEndsAt: true, freeAccessEndsAt: true } },
          },
        },
      },
    });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    return NextResponse.json({ campaign });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("subscriptions", "canUpdate", { minimumRole: "ADMIN" });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data = mutableCampaignData(body);
    const existing = await (prisma as any).acquisitionCampaign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    const merged = { ...existing, ...data };
    let priceValidation = null;
    if (requiresStripePriceValidation(existing, data)) {
      priceValidation = await validateStripeCampaignPrice(merged);
      if (!priceValidation.ok) {
        return NextResponse.json(
          { code: priceValidation.code, error: priceValidation.error, priceValidation },
          { status: 422 },
        );
      }
      if (priceValidation.displayPriceLabel !== undefined) {
        data.displayPriceLabel = priceValidation.displayPriceLabel;
        merged.displayPriceLabel = priceValidation.displayPriceLabel;
      }
    }

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const conflict = await findActiveCampaignConflict(tx, merged, id);
      if (conflict) return { conflict };
      const campaign = await tx.acquisitionCampaign.update({ where: { id }, data });
      await tx.adminAuditLog.create({
        data: {
          adminUserId: session.adminId,
          action: "UPDATE",
          entityType: "AcquisitionCampaign",
          entityId: id,
          changes: JSON.stringify(data),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        },
      });
      return { campaign };
    });
    if (result.conflict) {
      return NextResponse.json(ACTIVE_CAMPAIGN_CONFLICT_RESPONSE, { status: 409 });
    }
    return NextResponse.json({ campaign: result.campaign, priceValidation });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error?.code === "P2025") return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (error?.code === "P2002") return NextResponse.json({ error: "Campaign code already exists." }, { status: 409 });
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("subscriptions", "canCreate", { minimumRole: "ADMIN" });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.action !== "duplicate") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }
    const source = await (prisma as any).acquisitionCampaign.findUnique({ where: { id } });
    if (!source) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    const code = normalizeCode(body.code || `${source.code}_COPY`);
    const duplicate = await (prisma as any).acquisitionCampaign.create({
      data: {
        name: body.name || `${source.name} Copy`,
        code,
        status: "DRAFT",
        accessType: source.accessType,
        plan: "INDIVIDUAL",
        billingInterval: source.billingInterval,
        trialDays: source.trialDays || INDIVIDUAL_ANNUAL_TRIAL_DAYS,
        freeAccessDays: source.freeAccessDays,
        stripePriceId: source.stripePriceId,
        displayPriceLabel: source.displayPriceLabel,
        requiresPaymentMethod: source.requiresPaymentMethod,
        autoRenew: source.autoRenew,
        newUsersOnly: source.newUsersOnly,
        startsAt: source.startsAt,
        endsAt: source.endsAt,
        maxRedemptions: source.maxRedemptions,
        internalNotes: source.internalNotes,
        publicHeadline: source.publicHeadline,
        publicSubheadline: source.publicSubheadline,
        checkoutDisclosureCopy: source.checkoutDisclosureCopy,
        createdByAdminId: session.adminId,
      },
    });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "CREATE",
        entityType: "AcquisitionCampaign",
        entityId: duplicate.id,
        changes: JSON.stringify({ duplicatedFrom: id, code }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });
    return NextResponse.json({ campaign: duplicate }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error?.code === "P2002") return NextResponse.json({ error: "Campaign code already exists." }, { status: 409 });
    return NextResponse.json({ error: "Failed to duplicate campaign" }, { status: 500 });
  }
}
