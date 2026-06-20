import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/shared-encryption";
import { sendLoggedEmail } from "@/lib/email-service";
import { accruePartnerLeadCharge } from "@/lib/leads/billing";

/**
 * Lead delivery worker (R3d). Drains QUEUED LeadDispatch rows and emails each
 * matched partner the lead. Mirrors the ConnectorDispatch outbox contract:
 *  - retryable failures keep status QUEUED with a backoff `nextRetryAt`;
 *  - terminal failures (no contact / max attempts) move to FAILED;
 *  - delivery is idempotent — the dispatch idempotencyKey is the email dedupeKey,
 *    so a double-run (overlapping cron ticks) never double-sends.
 * Each row is processed independently; one failure never aborts the batch.
 */

const MAX_ATTEMPTS = 5;
// Backoff per prior-attempt count (minutes): 5m, 15m, 1h, 4h, then capped.
const BACKOFF_MINUTES = [5, 15, 60, 240];

interface LeadContact {
  contactName?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
}

function parsePayload(encrypted: string): LeadContact {
  try {
    return JSON.parse(decrypt(encrypted)) as LeadContact;
  } catch {
    return {};
  }
}

function backoffMs(priorAttempts: number): number {
  const idx = Math.min(priorAttempts, BACKOFF_MINUTES.length - 1);
  return BACKOFF_MINUTES[idx] * 60_000;
}

function esc(value: string | null | undefined): string {
  return (value || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
}

function leadEmailHtml(
  lead: {
    fromZip: string | null;
    toZip: string | null;
    fromState: string | null;
    toState: string | null;
    moveDate: Date | null;
    homeSize: string | null;
  },
  contact: LeadContact,
): string {
  const route = [
    lead.fromZip || lead.fromState,
    lead.toZip || lead.toState,
  ]
    .filter(Boolean)
    .join(" → ");
  const moveDate = lead.moveDate ? lead.moveDate.toISOString().slice(0, 10) : "Not specified";
  const rows: Array<[string, string]> = [
    ["Route", esc(route) || "Not specified"],
    ["Move date", esc(moveDate)],
    ["Home size", esc(lead.homeSize) || "Not specified"],
    ["Name", esc(contact.contactName) || "—"],
    ["Email", esc(contact.contactEmail) || "—"],
    ["Phone", esc(contact.contactPhone) || "—"],
  ];
  if (contact.notes) rows.push(["Notes", esc(contact.notes)]);
  return [
    "<h2>New moving lead from LocateFlow</h2>",
    "<p>A mover requested quotes for the move below. Reach out directly.</p>",
    "<table cellpadding='6' style='border-collapse:collapse'>",
    ...rows.map(([k, v]) => `<tr><td style='font-weight:600'>${k}</td><td>${v}</td></tr>`),
    "</table>",
    "<p style='font-size:12px;color:#666'>You receive these because you are a registered LocateFlow moving partner.</p>",
  ].join("");
}

export interface DrainResult {
  processed: number;
  sent: number;
  failed: number;
  retried: number;
}

export async function drainLeadDispatches(opts: { now?: Date; batchSize?: number } = {}): Promise<DrainResult> {
  const now = opts.now ?? new Date();
  const batchSize = Math.min(Math.max(opts.batchSize ?? 25, 1), 100);

  const due = await prisma.leadDispatch.findMany({
    where: {
      status: "QUEUED",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    include: {
      lead: {
        select: {
          category: true,
          fromZip: true,
          toZip: true,
          fromState: true,
          toState: true,
          moveDate: true,
          homeSize: true,
          payloadEncrypted: true,
        },
      },
    },
  });

  let sent = 0;
  let failed = 0;
  let retried = 0;

  for (const d of due) {
    try {
      // Resolve the recipient email by partner kind: a mover application or a
      // generic Partner (R4). Both expose contactEmail.
      const contactEmail =
        d.partnerKind === "partner"
          ? (await prisma.partner.findUnique({ where: { id: d.partnerId }, select: { contactEmail: true } }))?.contactEmail
          : (await prisma.moverApplication.findUnique({ where: { id: d.partnerId }, select: { contactEmail: true } }))?.contactEmail;
      const to = contactEmail?.trim();
      if (!to) {
        // No deliverable contact — terminal, don't retry forever.
        await prisma.leadDispatch.update({
          where: { id: d.id },
          data: { status: "FAILED", lastErrorCode: "NO_CONTACT", attemptCount: { increment: 1 } },
        });
        failed++;
        continue;
      }

      const contact = parsePayload(d.lead.payloadEncrypted);
      const result = await sendLoggedEmail({
        to,
        subject: "New moving lead from LocateFlow",
        html: leadEmailHtml(d.lead, contact),
        dedupeKey: d.idempotencyKey,
        metadata: { kind: "lead_dispatch", leadId: d.leadId },
      });

      if (result.success || result.skipped) {
        await prisma.leadDispatch.update({
          where: { id: d.id },
          data: { status: "SENT", sentAt: now, attemptCount: { increment: 1 } },
        });
        // R5: accrue a CPL charge for a delivered generic-Partner lead. Fail-safe
        // (no rate → no charge; never blocks delivery). Movers aren't billed here.
        if (d.partnerKind === "partner") {
          await accruePartnerLeadCharge({
            leadDispatchId: d.id,
            partnerId: d.partnerId,
            category: d.lead.category,
            now,
          }).catch(() => {});
        }
        sent++;
      } else {
        throw new Error("send_failed");
      }
    } catch {
      const nextAttempt = d.attemptCount + 1;
      if (nextAttempt >= MAX_ATTEMPTS) {
        await prisma.leadDispatch
          .update({ where: { id: d.id }, data: { status: "FAILED", lastErrorCode: "SEND_FAILED", attemptCount: nextAttempt } })
          .catch(() => {});
        failed++;
      } else {
        await prisma.leadDispatch
          .update({
            where: { id: d.id },
            data: {
              attemptCount: nextAttempt,
              nextRetryAt: new Date(now.getTime() + backoffMs(d.attemptCount)),
              lastErrorCode: "SEND_FAILED",
            },
          })
          .catch(() => {});
        retried++;
      }
    }
  }

  return { processed: due.length, sent, failed, retried };
}
