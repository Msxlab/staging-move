import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, requirePasswordConfirm } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";

/**
 * PATCH /api/partners/:id — record a verification decision (APPROVED | REJECTED |
 * NEEDS_INFO) on a generic Partner. An approval makes the partner a live lead
 * recipient, so it mutates public-facing state → ADMIN + password/MFA step-up + an
 * audit row (mirrors the mover-application decision). Every decision emails the
 * applicant (best-effort; the decision is the source of truth). Unlike movers,
 * there is no FMCSA/MovingCompany upsert — status is the listing switch.
 */
const DECISIONS = ["APPROVED", "REJECTED", "NEEDS_INFO"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("providers", "canUpdate", { minimumRole: "ADMIN" });
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const requestMeta = getAuditRequestMeta(request);

    const decision = String(body?.decision ?? "");
    if (!(DECISIONS as readonly string[]).includes(decision)) {
      return NextResponse.json({ error: "Decision must be APPROVED, REJECTED, or NEEDS_INFO." }, { status: 400 });
    }
    const decisionMessage =
      typeof body?.decisionMessage === "string" ? body.decisionMessage.trim().slice(0, 4000) : null;
    const reviewNotes = typeof body?.reviewNotes === "string" ? body.reviewNotes.trim().slice(0, 4000) : null;
    if ((decision === "REJECTED" || decision === "NEEDS_INFO") && !decisionMessage) {
      return NextResponse.json({ error: "Add a message for the applicant explaining the decision." }, { status: 400 });
    }

    const confirm = await requirePasswordConfirm(
      session,
      typeof body?.confirmPassword === "string" ? body.confirmPassword : undefined,
      {
        operation: "partner_application_decision",
        requireMfa: true,
        mfaCode: typeof body?.mfaCode === "string" ? body.mfaCode : undefined,
        backupCode: typeof body?.backupCode === "string" ? body.backupCode : undefined,
        ipAddress: requestMeta.ipAddress,
        userAgent: requestMeta.userAgent,
      },
    );
    if (!confirm.confirmed) {
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
        { status: 403 },
      );
    }

    const partner = await prisma.partner.findUnique({ where: { id } });
    if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

    const updated = await prisma.partner.update({
      where: { id },
      data: {
        status: decision,
        decisionMessage,
        reviewNotes: reviewNotes ?? partner.reviewNotes,
        reviewedByAdminId: session.adminId,
        reviewedAt: new Date(),
      },
      select: { id: true, status: true, companyName: true, contactEmail: true },
    });

    await writeAdminAudit(session, {
      action: "PARTNER_APPLICATION_DECISION",
      entityType: "Partner",
      entityId: id,
      before: { status: partner.status },
      after: { status: updated.status },
      metadata: { operation: "partner_application_decision", decision, category: partner.category },
      request: requestMeta,
    });

    void emailApplicant(updated.contactEmail, {
      decision,
      companyName: updated.companyName,
      decisionMessage,
    }).catch(() => {});

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to decide partner application:", error);
    return NextResponse.json({ error: "Failed to record the decision" }, { status: 500 });
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function emailApplicant(
  to: string,
  input: { decision: string; companyName: string; decisionMessage: string | null },
): Promise<void> {
  const company = escapeHtml(input.companyName);
  let subject: string;
  let intro: string;
  if (input.decision === "APPROVED") {
    subject = "Your LocateFlow partner listing is approved";
    intro = `Good news — ${company} is verified and will now receive matching customer leads.`;
  } else if (input.decision === "NEEDS_INFO") {
    subject = "We need a bit more information about your LocateFlow application";
    intro = `Thanks for applying to list ${company}. Before we can verify your listing, we need some more information:`;
  } else {
    subject = "Update on your LocateFlow partner application";
    intro = `Thank you for your interest in ${company} on LocateFlow. After review, we're unable to approve this application at this time.`;
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
  const text = `${subject}\n\n${intro}${input.decisionMessage ? `\n\n${input.decisionMessage}` : ""}`;
  await sendEmail({ to, subject, html, text });
}
