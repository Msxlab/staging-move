import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { MOVER_DECISION_STATUSES, moverServiceLabels, type MoverDecisionStatus } from "@locateflow/shared";

/**
 * GET  /api/movers/applications/:id — full application + same-origin document
 *      download links for the reviewer.
 * PATCH /api/movers/applications/:id — record a decision (APPROVED | REJECTED |
 *      NEEDS_INFO). Mutates public-facing state (an approval lists the mover) →
 *      ADMIN + password/MFA step-up + an audit row, mirroring the sponsored
 *      surface. APPROVED upserts a MovingCompany (the existing FMCSA catalog)
 *      keyed by usdotNumber and links it; every decision emails the applicant
 *      (best-effort). The decision is the source of truth — a failed email never
 *      rolls it back.
 */

function extractStepUp(body: any) {
  return {
    confirmPassword: typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined,
    mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : undefined,
    backupCode: typeof body?.backupCode === "string" ? body.backupCode : undefined,
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("providers", "canRead", { minimumRole: "VIEWER" });
    const { id } = await params;

    const application = await prisma.moverApplication.findUnique({
      where: { id },
      include: { documents: { orderBy: { createdAt: "asc" } } },
    });
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    const documents = application.documents.map((doc) => ({
      id: doc.id,
      kind: doc.kind,
      fileName: doc.fileName,
      contentType: doc.contentType,
      sizeBytes: doc.sizeBytes,
      createdAt: doc.createdAt,
      downloadUrl: `/api/movers/applications/${encodeURIComponent(id)}/documents/${encodeURIComponent(doc.id)}/download`,
    }));

    return NextResponse.json({ application: { ...application, documents } });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to fetch mover application:", error);
    return NextResponse.json({ error: "Failed to fetch mover application" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("providers", "canUpdate", { minimumRole: "ADMIN" });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const requestMeta = getAuditRequestMeta(request);

    const decision = String(body?.decision ?? "");
    if (!(MOVER_DECISION_STATUSES as readonly string[]).includes(decision)) {
      return NextResponse.json(
        { error: "Decision must be APPROVED, REJECTED, or NEEDS_INFO." },
        { status: 400 },
      );
    }
    const decisionMessage =
      typeof body?.decisionMessage === "string" ? body.decisionMessage.trim().slice(0, 4000) : null;
    const reviewNotes = typeof body?.reviewNotes === "string" ? body.reviewNotes.trim().slice(0, 4000) : null;
    // Lead-program enrollment (audit P2): an explicit, separate consent from the
    // accuracy attestation. Optional — omitted leaves the current value unchanged.
    // Only opted-in movers receive consumer lead PII (matchMoversForLead ANDs it).
    const leadsOptIn = typeof body?.leadsOptIn === "boolean" ? body.leadsOptIn : undefined;

    // A rejection / needs-info without a message leaves the applicant guessing.
    if ((decision === "REJECTED" || decision === "NEEDS_INFO") && !decisionMessage) {
      return NextResponse.json(
        { error: "Add a message for the applicant explaining the decision." },
        { status: 400 },
      );
    }

    // Step-up: an approval lists a real mover in a public directory.
    const { confirmPassword, mfaCode, backupCode } = extractStepUp(body);
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "mover_application_decision",
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

    const application = await prisma.moverApplication.findUnique({ where: { id } });
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    // ── APPROVED: upsert the MovingCompany (FMCSA catalog) by USDOT + link it ──
    let linkedMovingCompanyId: string | null = application.linkedMovingCompanyId;
    if (decision === "APPROVED") {
      // MovingCompany.state is the carrier's home state; the applicant's first
      // declared service state is the best proxy we have at approval time.
      const stateCode = (application.serviceStates.split(",")[0]?.trim().toUpperCase() || "US").slice(0, 2);
      const existing = await prisma.movingCompany.findUnique({
        where: { usdotNumber: application.usdotNumber },
        select: { id: true },
      });
      if (existing) {
        await prisma.movingCompany.update({
          where: { id: existing.id },
          data: {
            active: true,
            // Refresh names/HHG from the application's verified snapshot.
            legalName: application.companyLegalName,
            dbaName: application.dbaName,
            ...(application.fmcsaHhgAuthorized !== null ? { hhgAuthorization: application.fmcsaHhgAuthorized } : {}),
            ...(application.fmcsaSafetyRating ? { safetyRating: application.fmcsaSafetyRating } : {}),
          },
        });
        linkedMovingCompanyId = existing.id;
      } else {
        const created = await prisma.movingCompany.create({
          data: {
            usdotNumber: application.usdotNumber,
            legalName: application.companyLegalName,
            dbaName: application.dbaName,
            state: stateCode,
            phone: application.contactPhone,
            hhgAuthorization: application.fmcsaHhgAuthorized ?? false,
            fleetSize: application.fleetSize,
            safetyRating: application.fmcsaSafetyRating,
            dataAsOf: new Date(),
            active: true,
          },
          select: { id: true },
        });
        linkedMovingCompanyId = created.id;
      }
    }

    const updated = await prisma.moverApplication.update({
      where: { id },
      data: {
        status: decision,
        decisionMessage,
        reviewNotes: reviewNotes ?? application.reviewNotes,
        reviewedByAdminId: session.adminId,
        reviewedAt: new Date(),
        linkedMovingCompanyId,
        ...(leadsOptIn !== undefined ? { leadsOptIn } : {}),
      },
      select: { id: true, status: true, companyLegalName: true, contactEmail: true, usdotNumber: true, services: true },
    });

    await writeAdminAudit(session, {
      action: "MOVER_APPLICATION_DECISION",
      entityType: "MoverApplication",
      entityId: id,
      before: { status: application.status },
      after: { status: updated.status, linkedMovingCompanyId },
      metadata: { operation: "mover_application_decision", decision },
      request: requestMeta,
    });

    // Best-effort applicant email — never rolls back the decision.
    void emailApplicant(updated.contactEmail, {
      decision: decision as MoverDecisionStatus,
      companyLegalName: updated.companyLegalName,
      decisionMessage,
    }).catch(() => {});

    return NextResponse.json({ ok: true, status: updated.status, linkedMovingCompanyId });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to decide mover application:", error);
    return NextResponse.json({ error: "Failed to record the decision" }, { status: 500 });
  }
}

async function emailApplicant(
  to: string,
  input: { decision: MoverDecisionStatus; companyLegalName: string; decisionMessage: string | null },
): Promise<void> {
  const company = escapeHtml(input.companyLegalName);
  let subject: string;
  let intro: string;
  if (input.decision === "APPROVED") {
    subject = "Your LocateFlow mover listing is approved";
    intro = `Good news — ${company} has been verified and is now listed in the LocateFlow licensed-movers directory.`;
  } else if (input.decision === "NEEDS_INFO") {
    subject = "We need a bit more information about your LocateFlow application";
    intro = `Thanks for applying to list ${company}. Before we can verify your listing, we need some more information:`;
  } else {
    subject = "Update on your LocateFlow mover application";
    intro = `Thank you for your interest in listing ${company} on LocateFlow. After review, we're unable to approve this application at this time.`;
  }
  const messageHtml = input.decisionMessage
    ? `<p style="margin:16px 0;padding:12px 14px;background:#f5f5f5;border-radius:8px">${escapeHtml(input.decisionMessage)}</p>`
    : "";
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1a1a1a;line-height:1.5">
    <h2 style="font-size:18px">${escapeHtml(subject)}</h2>
    <p>${intro}</p>
    ${messageHtml}
    <p style="color:#666;font-size:12px;margin-top:24px">LocateFlow — moving made manageable.</p>
  </div>`;
  const text = `${subject}\n\n${input.decision === "APPROVED" ? `${input.companyLegalName} has been verified and listed.` : intro.replace(/<[^>]+>/g, "")}${input.decisionMessage ? `\n\n${input.decisionMessage}` : ""}`;
  await sendEmail({ to, subject, html, text });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
