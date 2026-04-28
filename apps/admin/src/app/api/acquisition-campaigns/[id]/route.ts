import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import {
  INDIVIDUAL_ANNUAL_PRICE_LABEL,
  INDIVIDUAL_ANNUAL_TRIAL_DAYS,
} from "@/lib/shared-billing";

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
    data.accessType = body.accessType === "FREE_ACCESS" ? "FREE_ACCESS" : "FREE_TRIAL";
    data.billingInterval = data.accessType === "FREE_TRIAL" ? "YEAR" : null;
    data.requiresPaymentMethod = data.accessType === "FREE_TRIAL";
    data.autoRenew = data.accessType === "FREE_TRIAL";
  }
  if (body.trialDays !== undefined) data.trialDays = body.trialDays ? Number(body.trialDays) : null;
  if (body.freeAccessDays !== undefined) data.freeAccessDays = body.freeAccessDays ? Number(body.freeAccessDays) : null;
  if (body.stripePriceId !== undefined) data.stripePriceId = body.stripePriceId || null;
  if (body.displayPriceLabel !== undefined) data.displayPriceLabel = body.displayPriceLabel || INDIVIDUAL_ANNUAL_PRICE_LABEL;
  if (body.newUsersOnly !== undefined) data.newUsersOnly = Boolean(body.newUsersOnly);
  if (body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (body.maxRedemptions !== undefined) data.maxRedemptions = body.maxRedemptions ? Number(body.maxRedemptions) : null;
  return data;
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
    const campaign = await (prisma as any).acquisitionCampaign.update({ where: { id }, data });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "UPDATE",
        entityType: "AcquisitionCampaign",
        entityId: id,
        changes: JSON.stringify(data),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });
    return NextResponse.json({ campaign });
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
