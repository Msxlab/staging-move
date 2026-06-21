import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { generateAddressReportPdf } from "@/lib/pdf/address-report";
import { generateFullAccountPdf } from "@/lib/pdf/full-account";
import { generateTaxReportPdf } from "@/lib/pdf/tax-report";
import { buildTaxReportData } from "@/lib/tax-report-data";
import { planFeatures } from "@locateflow/shared";
import type { PdfAccountSnapshot, PdfAddress } from "@/lib/pdf/types";
import { enforceRateLimitPolicy } from "@/lib/rate-limit-policy";
import { emitSecurityEvent } from "@/lib/security-events";
import { verifyUserStepUp } from "@/lib/user-step-up";
import { getRequestEntitlement } from "@/lib/request-entitlements";
import { contentDispositionAttachment } from "@/lib/http-download";

/**
 * GET /api/export/pdf?type=address&addressId=xxx
 * GET /api/export/pdf?type=full
 *
 * Returns a server-rendered PDF of the requested data. The previous
 * implementation built HTML in the browser and called `window.print()`,
 * which depends on pop-up permission, leaks the document into the user's
 * print cache, and renders inconsistently across browsers. Generating
 * server-side with pdfkit removes all of that.
 *
 * The route is intentionally rate-limited and gated by session auth so
 * a leaked share link can't be used to enumerate other users' data.
 *
 * Localization note: v1 emits English-only PDFs. The generators take
 * domain data and rely on hard-coded English labels; future i18n work
 * should pass a locale + a `getTranslations`-resolved label bundle in
 * instead of widening the data shape.
 */

// pdfkit ships its own font files and uses Node `fs` to read them, so we
// must run on the Node.js runtime (not edge).
export const runtime = "nodejs";

export async function GET() {
  return noStoreJson(
    {
      error: "PDF export requires POST with step-up verification.",
      code: "STEP_UP_REQUIRED",
    },
    403,
    { Allow: "POST" },
  );
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();
    const meta = extractRequestMeta(request);
    const body: any = await request.json().catch(() => ({}));
    const type = typeof body?.type === "string" ? body.type : "address";

    emitSecurityEvent({
      type: "EXPORT_ATTEMPT",
      severity: "info",
      group: "export_pdf",
      context: { userId, type, format: "pdf", outcome: "started" },
    });

    const rl = await enforceRateLimitPolicy(request, "export_pdf", {
      userId,
      routeId: "export_pdf",
    });
    if (!rl.success) {
      emitSecurityEvent({
        type: "EXPORT_ATTEMPT",
        severity: "warn",
        group: "export_pdf",
        retryAfterSeconds: rl.retryAfterSeconds,
        context: { userId, type, format: "pdf", outcome: "rate_limited" },
      });
      await createAuditLog({
        userId,
        action: "EXPORT_LIMIT",
        entityType: "User",
        entityId: userId,
        changes: { status: "rate_limited", type, format: "pdf", retryAfterSeconds: rl.retryAfterSeconds },
        ...meta,
      });
      return noStoreJson(
        {
          code: rl.policy.userFacingErrorCode,
          error: "Too many PDF exports. Please wait and try again.",
          routeGroup: rl.policy.group,
          retryAfterSeconds: rl.retryAfterSeconds,
        },
        429,
        { "Retry-After": String(rl.retryAfterSeconds) },
      );
    }

    const stepUp = await verifyUserStepUp({
      userId,
      confirmPassword: typeof body?.confirmPassword === "string" ? body.confirmPassword : null,
      mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : null,
      backupCode: typeof body?.backupCode === "string" ? body.backupCode : null,
    });
    if (!stepUp.ok) {
      emitSecurityEvent({
        type: "EXPORT_ATTEMPT",
        severity: "warn",
        group: "export_pdf",
        context: { userId, type, format: "pdf", outcome: "failed_step_up", code: stepUp.code },
      });
      await createAuditLog({
        userId,
        action: "EXPORT_BLOCK",
        entityType: "User",
        entityId: userId,
        changes: { status: "failed_step_up", type, format: "pdf", code: stepUp.code },
        ...meta,
      });
      return noStoreJson(
        { error: stepUp.message, code: stepUp.code },
        stepUp.code === "STEP_UP_REQUIRED" ? 403 : 401,
      );
    }

    if (type === "address") {
      const addressId = typeof body?.addressId === "string" ? body.addressId : "";
      if (!addressId) {
        return noStoreJson({ error: "addressId is required for type=address" }, 400);
      }
      const buffer = await buildAddressPdf(userId, addressId);
      if (!buffer) {
        return noStoreJson({ error: "Address not found" }, 404);
      }
      await auditSuccessfulPdfExport({ userId, type, meta, stepUpMethod: stepUp.method, entityId: addressId });
      return pdfResponse(buffer, `locateflow-address-report.pdf`);
    }

    if (type === "full") {
      const buffer = await buildFullAccountPdf(userId);
      await auditSuccessfulPdfExport({ userId, type, meta, stepUpMethod: stepUp.method, entityId: userId });
      return pdfResponse(buffer, `locateflow-account-snapshot.pdf`);
    }

    if (type === "tax") {
      // Pro-gated, like the CSV/JSON tax export. Inactive/expired Pro resolves
      // to FREE_TRIAL here, so this also blocks lapsed Pro.
      const { plan: userPlan } = await getRequestEntitlement(request, userId);
      if (!planFeatures(userPlan.plan).advancedExport) {
        await createAuditLog({
          userId,
          action: "EXPORT_BLOCK",
          entityType: "User",
          entityId: userId,
          changes: { status: "upgrade_required", type, format: "pdf", code: "UPGRADE_REQUIRED" },
          ...meta,
        });
        return noStoreJson(
          { error: "Tax & property export is a Pro feature. Upgrade to Pro to export tax and property reports.", code: "UPGRADE_REQUIRED" },
          403,
        );
      }
      const buffer = await buildTaxPdf(userId);
      await auditSuccessfulPdfExport({ userId, type, meta, stepUpMethod: stepUp.method, entityId: userId });
      return pdfResponse(buffer, `locateflow-tax-property-report.pdf`);
    }

    return noStoreJson({ error: "Unsupported export type. Use 'address', 'full', or 'tax'." }, 400);
  } catch (error) {
    const gateResponse = apiGateErrorResponse(error);
    if (gateResponse) return gateResponse;
    console.error("[EXPORT/PDF] Failed:", error);
    return noStoreJson({ error: "Failed to generate PDF" }, 500);
  }
}

function noStoreJson(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      ...headers,
    },
  });
}

async function auditSuccessfulPdfExport(input: {
  userId: string;
  type: string;
  meta: ReturnType<typeof extractRequestMeta>;
  stepUpMethod: string;
  entityId: string;
}) {
  emitSecurityEvent({
    type: "EXPORT_ATTEMPT",
    severity: "info",
    group: "export_pdf",
    context: {
      userId: input.userId,
      type: input.type,
      format: "pdf",
      outcome: "success",
      stepUpMethod: input.stepUpMethod,
    },
  });
  await createAuditLog({
    userId: input.userId,
    action: "EXPORT_PDF",
    entityType: "User",
    entityId: input.entityId,
    changes: {
      status: "success",
      type: input.type,
      format: "pdf",
      stepUpMethod: input.stepUpMethod,
    },
    ...input.meta,
  });
}

function pdfResponse(buffer: Buffer, filename: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDispositionAttachment(filename, "locateflow-export.pdf"),
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}

async function buildAddressPdf(
  userId: string,
  addressId: string,
): Promise<Buffer | null> {
  const [address, user] = await Promise.all([
    prisma.address.findFirst({
      where: { id: addressId, userId, deletedAt: null },
      include: {
        services: {
          where: { deletedAt: null, isActive: true },
          select: {
            id: true,
            providerName: true,
            category: true,
            monthlyCost: true,
            billingDay: true,
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    }),
  ]);
  if (!address) return null;

  const userName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
  const pdfAddress: PdfAddress = {
    id: address.id,
    type: address.type,
    nickname: address.nickname,
    street: address.street,
    city: address.city,
    state: address.state,
    zip: address.zip,
    isPrimary: address.isPrimary,
    ownership: address.ownership,
    startDate: address.startDate,
    services: address.services.map((s) => ({
      id: s.id,
      providerName: s.providerName,
      category: s.category,
      monthlyCost: Number(s.monthlyCost) || 0,
      billingDay: s.billingDay,
    })),
  };
  return generateAddressReportPdf(pdfAddress, userName);
}

async function buildTaxPdf(userId: string): Promise<Buffer> {
  const [data, user] = await Promise.all([
    buildTaxReportData(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
  ]);
  const userName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
  return generateTaxReportPdf(data, userName);
}

async function buildFullAccountPdf(userId: string): Promise<Buffer> {
  const [user, subscription, addresses, movingPlans, taskCounts] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          preferredLocale: true,
          createdAt: true,
        },
      }),
      prisma.subscription.findUnique({
        where: { userId },
        select: { plan: true, status: true, currentPeriodEndsAt: true },
      }),
      prisma.address.findMany({
        where: { userId, deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        include: {
          services: {
            where: { deletedAt: null, isActive: true },
            select: {
              id: true,
              providerName: true,
              category: true,
              monthlyCost: true,
              billingDay: true,
            },
          },
        },
      }),
      prisma.movingPlan.findMany({
        where: { userId },
        orderBy: { moveDate: "desc" },
        select: {
          moveDate: true,
          status: true,
          fromAddress: { select: { city: true, state: true } },
          toAddress: { select: { city: true, state: true } },
        },
      }),
      prisma.moveTask.groupBy({
        by: ["status"],
        where: { userId, deletedAt: null },
        _count: { _all: true },
      }),
    ]);

  // Move task counts come back as `[ { status, _count: { _all } } ]`.
  // Normalize into the trio the PDF cares about: open / completed /
  // dismissed. Anything else (e.g. archived) collapses into "open" so
  // the totals stay meaningful.
  let open = 0;
  let completed = 0;
  let dismissed = 0;
  for (const row of taskCounts) {
    const n = row._count._all;
    const status = row.status?.toUpperCase?.() ?? "";
    if (status === "COMPLETED") completed += n;
    else if (status === "DISMISSED") dismissed += n;
    else open += n;
  }

  const snapshot: PdfAccountSnapshot = {
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      preferredLocale: user.preferredLocale,
      createdAt: user.createdAt,
    },
    subscription: subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEndsAt: subscription.currentPeriodEndsAt,
        }
      : null,
    addresses: addresses.map((a) => ({
      id: a.id,
      type: a.type,
      nickname: a.nickname,
      street: a.street,
      city: a.city,
      state: a.state,
      zip: a.zip,
      isPrimary: a.isPrimary,
      ownership: a.ownership,
      startDate: a.startDate,
      services: a.services.map((s) => ({
        id: s.id,
        providerName: s.providerName,
        category: s.category,
        monthlyCost: Number(s.monthlyCost) || 0,
        billingDay: s.billingDay,
      })),
    })),
    movingPlans: movingPlans.map((p) => ({
      moveDate: p.moveDate,
      status: p.status,
      fromCity: p.fromAddress?.city ?? null,
      fromState: p.fromAddress?.state ?? null,
      toCity: p.toAddress?.city ?? null,
      toState: p.toAddress?.state ?? null,
    })),
    taskSummary: { open, completed, dismissed },
  };

  return generateFullAccountPdf(snapshot);
}
