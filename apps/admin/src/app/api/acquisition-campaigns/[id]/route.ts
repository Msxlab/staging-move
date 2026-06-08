import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import {
  INDIVIDUAL_ANNUAL_TRIAL_DAYS,
} from "@/lib/shared-billing";
import { validateStripeCampaignPrice } from "@/lib/stripe-campaign-validation";
import { canSeeRawBillingIds, maskEmail } from "@/lib/privacy";

/**
 * Step-up credential fields are carried in the same JSON body as the
 * campaign payload. Pull them out here so `mutableCampaignData` never
 * sees them as campaign columns and `requirePasswordConfirm` gets what
 * it expects.
 */
function extractStepUp(body: any) {
  return {
    confirmPassword: typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined,
    mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : undefined,
    backupCode: typeof body?.backupCode === "string" ? body.backupCode : undefined,
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
  if (body.stripePriceId !== undefined) {
    data.stripePriceId =
      typeof body.stripePriceId === "string" && body.stripePriceId.trim()
        ? body.stripePriceId.trim()
        : null;
  }
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

function normalizePriceRelevantValue(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return value;
}

function priceRelevantValueChanged(existing: any, data: any, key: string) {
  if (data[key] === undefined) return false;
  return normalizePriceRelevantValue(existing[key]) !== normalizePriceRelevantValue(data[key]);
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
    if (priceRelevantValueChanged(existing, data, key)) return true;
  }
  return false;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("acquisition_campaigns", "canRead", { minimumRole: "VIEWER" });
    const showRawEmails = canSeeRawBillingIds(session.role);
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
    // Redemption rows carry end-user PII (email). Mask it for non-ADMIN
    // readers (VIEWER/MODERATOR), matching every other admin surface.
    const safeCampaign = showRawEmails
      ? campaign
      : {
          ...campaign,
          redemptions: Array.isArray(campaign.redemptions)
            ? campaign.redemptions.map((redemption: any) =>
                redemption?.user
                  ? { ...redemption, user: { ...redemption.user, email: maskEmail(redemption.user.email) } }
                  : redemption,
              )
            : campaign.redemptions,
        };
    return NextResponse.json({ campaign: safeCampaign });
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
    const session = await requirePermission("acquisition_campaigns", "canUpdate", { minimumRole: "ADMIN" });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const requestMeta = getAuditRequestMeta(request);

    // Edits + status changes (activate / pause / end) rewrite the live
    // campaign — including the bound Stripe price and the public pricing
    // copy. Gate behind admin password + MFA step-up before any mutation.
    const { confirmPassword, mfaCode, backupCode } = extractStepUp(body);
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "acquisition_campaign_update",
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

    const data = mutableCampaignData(body);
    const existing = await (prisma as any).acquisitionCampaign.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    const merged = { ...existing, ...data };

    // POST guards numeric fields with Number.isFinite, but PATCH previously
    // wrote them straight through: an edit carrying trialDays:"abc" /
    // freeAccessDays:"abc" / maxRedemptions:"abc" became Number("abc") = NaN
    // and was persisted to an Int? column (and a NaN cap would make the
    // campaign permanently un-redeemable). Validate the *merged* shape so a
    // partial edit is checked against the resulting record, not just the diff.
    if (data.trialDays !== undefined && merged.accessType === "FREE_TRIAL" &&
        (!Number.isFinite(merged.trialDays) || merged.trialDays < 1)) {
      return NextResponse.json({ error: "Trial days must be a number of at least 1." }, { status: 400 });
    }
    if (data.freeAccessDays !== undefined && merged.accessType === "FREE_ACCESS" &&
        (!Number.isFinite(merged.freeAccessDays) || merged.freeAccessDays < 1)) {
      return NextResponse.json({ error: "Free Access days must be a number of at least 1." }, { status: 400 });
    }
    if (data.maxRedemptions !== undefined && merged.maxRedemptions !== null &&
        (!Number.isFinite(merged.maxRedemptions) || merged.maxRedemptions < 1)) {
      return NextResponse.json(
        { error: "Max redemptions must be a positive whole number, or left blank for unlimited." },
        { status: 400 },
      );
    }
    // Changing accessType to PAID must land on a valid billing interval —
    // mirror the POST guard so a malformed interval can't reach the DB/Stripe.
    if (data.accessType === "PAID" && merged.billingInterval !== "MONTH" && merged.billingInterval !== "YEAR") {
      return NextResponse.json({ error: "Paid campaigns must use monthly or annual billing." }, { status: 400 });
    }

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
      return { campaign };
    });
    if (result.conflict) {
      return NextResponse.json(ACTIVE_CAMPAIGN_CONFLICT_RESPONSE, { status: 409 });
    }
    await writeAdminAudit(session, {
      action: "ACQUISITION_CAMPAIGN_UPDATE",
      entityType: "AcquisitionCampaign",
      entityId: id,
      before: { status: existing.status, code: existing.code, stripePriceId: existing.stripePriceId },
      after: { status: result.campaign.status, code: result.campaign.code, stripePriceId: result.campaign.stripePriceId },
      metadata: { operation: "acquisition_campaign_update", changedFields: Object.keys(data) },
      request: requestMeta,
    });
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
    const session = await requirePermission("acquisition_campaigns", "canCreate", { minimumRole: "ADMIN" });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.action !== "duplicate") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }
    const requestMeta = getAuditRequestMeta(request);

    // Duplicating clones the bound Stripe price ID and pricing copy into a
    // new draft campaign — same blast radius as a create, so gate it behind
    // admin password + MFA step-up.
    const { confirmPassword, mfaCode, backupCode } = extractStepUp(body);
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "acquisition_campaign_duplicate",
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
    await writeAdminAudit(session, {
      action: "ACQUISITION_CAMPAIGN_DUPLICATE",
      entityType: "AcquisitionCampaign",
      entityId: duplicate.id,
      after: { code, status: duplicate.status },
      metadata: { operation: "acquisition_campaign_duplicate", duplicatedFrom: id },
      request: requestMeta,
    });
    return NextResponse.json({ campaign: duplicate }, { status: 201 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error?.code === "P2002") return NextResponse.json({ error: "Campaign code already exists." }, { status: 409 });
    return NextResponse.json({ error: "Failed to duplicate campaign" }, { status: 500 });
  }
}

// Hard delete — refuses if any redemption row exists, since those carry
// legal proof of consent that survives the campaign row. End the
// campaign instead. Drafts and stale unused copies clean up freely.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("acquisition_campaigns", "canDelete", { minimumRole: "ADMIN" });
    const { id } = await params;
    const requestMeta = getAuditRequestMeta(request);

    // Deleting a campaign is destructive (and unbinds a live Stripe price
    // for non-redeemed drafts) — gate behind admin password + MFA step-up.
    // The body is optional: a no-body request fails closed with a 403 that
    // tells the client to collect the password + MFA code.
    const body = await request.json().catch(() => ({}));
    const { confirmPassword, mfaCode, backupCode } = extractStepUp(body);
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "acquisition_campaign_delete",
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

    const existing = await (prisma as any).acquisitionCampaign.findUnique({
      where: { id },
      select: { id: true, code: true, status: true, redemptionCount: true },
    });
    if (!existing) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    if (existing.redemptionCount > 0) {
      return NextResponse.json(
        {
          code: "CAMPAIGN_HAS_REDEMPTIONS",
          error: "Cannot delete a campaign with redemptions. End it instead.",
        },
        { status: 409 },
      );
    }
    // Belt-and-braces: also check the redemption table directly in case
    // the denormalized counter ever drifts from the row count.
    const redemptionRow = await (prisma as any).acquisitionRedemption.findFirst({
      where: { campaignId: id },
      select: { id: true },
    });
    if (redemptionRow) {
      return NextResponse.json(
        {
          code: "CAMPAIGN_HAS_REDEMPTIONS",
          error: "Cannot delete a campaign with redemptions. End it instead.",
        },
        { status: 409 },
      );
    }

    await (prisma as any).acquisitionCampaign.delete({ where: { id } });
    await writeAdminAudit(session, {
      action: "ACQUISITION_CAMPAIGN_DELETE",
      entityType: "AcquisitionCampaign",
      entityId: id,
      before: { code: existing.code, status: existing.status },
      metadata: { operation: "acquisition_campaign_delete" },
      request: requestMeta,
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error?.code === "P2025") return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    if (error?.code === "P2003") {
      return NextResponse.json(
        {
          code: "CAMPAIGN_HAS_REDEMPTIONS",
          error: "Cannot delete a campaign that is referenced elsewhere. End it instead.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
