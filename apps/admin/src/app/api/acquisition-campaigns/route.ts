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

function campaignData(body: any, adminId?: string) {
  const accessType = body.accessType === "FREE_ACCESS" ? "FREE_ACCESS" : "FREE_TRIAL";
  const data: any = {
    name: String(body.name || "").trim(),
    code: normalizeCode(body.code),
    status: body.status || "DRAFT",
    accessType,
    plan: "INDIVIDUAL",
    billingInterval: accessType === "FREE_TRIAL" ? "YEAR" : null,
    trialDays: accessType === "FREE_TRIAL" ? Number(body.trialDays || INDIVIDUAL_ANNUAL_TRIAL_DAYS) : null,
    freeAccessDays: accessType === "FREE_ACCESS" ? Number(body.freeAccessDays || 30) : null,
    stripePriceId: accessType === "FREE_TRIAL" ? (body.stripePriceId || null) : null,
    displayPriceLabel: body.displayPriceLabel || INDIVIDUAL_ANNUAL_PRICE_LABEL,
    requiresPaymentMethod: accessType === "FREE_TRIAL",
    autoRenew: accessType === "FREE_TRIAL",
    newUsersOnly: body.newUsersOnly !== false,
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
    maxRedemptions: body.maxRedemptions ? Number(body.maxRedemptions) : null,
    internalNotes: body.internalNotes || null,
    publicHeadline: String(body.publicHeadline || (accessType === "FREE_TRIAL" ? "Start with 3 months free" : "Free Access")).trim(),
    publicSubheadline: body.publicSubheadline || null,
    checkoutDisclosureCopy: body.checkoutDisclosureCopy || null,
  };
  if (adminId) data.createdByAdminId = adminId;
  return data;
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

    const campaign = await (prisma as any).acquisitionCampaign.create({ data });
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: session.adminId,
        action: "CREATE",
        entityType: "AcquisitionCampaign",
        entityId: campaign.id,
        changes: JSON.stringify({ code: campaign.code, accessType: campaign.accessType }),
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      },
    });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error?.code === "P2002") return NextResponse.json({ error: "Campaign code already exists." }, { status: 409 });
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
