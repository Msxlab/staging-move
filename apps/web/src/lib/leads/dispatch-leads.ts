import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/shared-encryption";
import { sendLoggedEmail } from "@/lib/email-service";
import { accruePartnerLeadCharge } from "@/lib/leads/billing";
import { hasCcpaOptOutForUser } from "@/lib/ccpa";

/**
 * Lead delivery worker (R3d). Drains QUEUED LeadDispatch rows and emails each
 * matched partner the lead. Mirrors the ConnectorDispatch outbox contract:
 *  - each row is atomically CLAIMED (QUEUED→DISPATCHING) so overlapping cron
 *    ticks never process the same row twice; a crashed tick's stranded rows are
 *    requeued by the stale-DISPATCHING sweep at the start of the next run;
 *  - retryable failures return to QUEUED with a backoff `nextRetryAt`;
 *  - terminal failures (de-authorized / no contact / undecryptable / max
 *    attempts) move to FAILED;
 *  - delivery is idempotent — the dispatch idempotencyKey is the email dedupeKey,
 *    so even a double-process never double-sends, and a row is marked SENT ONLY
 *    on a real send success (a kill-switch skip or an orphaned PENDING log
 *    retries instead of being recorded as delivered).
 * Each row is processed independently; one failure never aborts the batch.
 */

const MAX_ATTEMPTS = 5;
// Backoff per prior-attempt count (minutes): 5m, 15m, 1h, 4h, then capped.
const BACKOFF_MINUTES = [5, 15, 60, 240];
// A row claimed (DISPATCHING) but not resolved within this window is assumed to
// belong to a crashed tick and is requeued.
const STALE_DISPATCHING_MS = 15 * 60_000;

interface LeadContact {
  contactName?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
}

/**
 * Decrypt + parse the lead PII. Returns null when the payload cannot be
 * decrypted/parsed (key rotation, corruption) so the worker refuses to email an
 * empty lead or accrue a charge for it (audit P2: decrypt-failure fail-open).
 */
function parsePayload(encrypted: string): LeadContact | null {
  try {
    return JSON.parse(decrypt(encrypted)) as LeadContact;
  } catch {
    return null;
  }
}

function backoffMs(priorAttempts: number): number {
  const idx = Math.min(priorAttempts, BACKOFF_MINUTES.length - 1);
  return BACKOFF_MINUTES[idx] * 60_000;
}

function esc(value: string | null | undefined): string {
  return (value || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
}

/** Human noun for the lead category, used in the partner email copy (audit P2). */
function categoryNoun(category: string | null | undefined): string {
  switch (category) {
    case "moving":
      return "moving";
    case "cleaning":
      return "cleaning";
    case "junk":
      return "junk removal";
    default:
      return "service";
  }
}

function leadEmailSubject(category: string | null | undefined): string {
  return `New ${categoryNoun(category)} lead from LocateFlow`;
}

function leadEmailHtml(
  lead: {
    category: string | null;
    fromZip: string | null;
    toZip: string | null;
    fromState: string | null;
    toState: string | null;
    moveDate: Date | null;
    homeSize: string | null;
  },
  contact: LeadContact,
): string {
  const noun = categoryNoun(lead.category);
  const isMoving = lead.category === "moving";
  const route = [lead.fromZip || lead.fromState, lead.toZip || lead.toState].filter(Boolean).join(" → ");
  const location = [lead.toZip || lead.toState || lead.fromZip || lead.fromState].filter(Boolean).join("");
  const dateLabel = isMoving ? "Move date" : "Preferred date";
  const dateValue = lead.moveDate ? lead.moveDate.toISOString().slice(0, 10) : "Not specified";
  const rows: Array<[string, string]> = isMoving
    ? [
        ["Route", esc(route) || "Not specified"],
        ["Move date", esc(dateValue)],
        ["Home size", esc(lead.homeSize) || "Not specified"],
      ]
    : [
        ["Location", esc(location) || "Not specified"],
        [dateLabel, esc(dateValue)],
      ];
  rows.push(
    ["Name", esc(contact.contactName) || "—"],
    ["Email", esc(contact.contactEmail) || "—"],
    ["Phone", esc(contact.contactPhone) || "—"],
  );
  if (contact.notes) rows.push(["Notes", esc(contact.notes)]);
  return [
    `<h2>New ${noun} lead from LocateFlow</h2>`,
    `<p>A customer requested ${noun} quotes for the details below. Reach out directly.</p>`,
    "<table cellpadding='6' style='border-collapse:collapse'>",
    ...rows.map(([k, v]) => `<tr><td style='font-weight:600'>${k}</td><td>${v}</td></tr>`),
    "</table>",
    "<p style='font-size:12px;color:#666'>You receive these because you are a registered LocateFlow partner.</p>",
  ].join("");
}

export interface DrainResult {
  processed: number;
  sent: number;
  failed: number;
  retried: number;
  /** Leads skipped because the consumer set a CPRA Do-Not-Sell opt-out after capture. */
  suppressed: number;
}

export async function drainLeadDispatches(opts: { now?: Date; batchSize?: number } = {}): Promise<DrainResult> {
  const now = opts.now ?? new Date();
  const batchSize = Math.min(Math.max(opts.batchSize ?? 25, 1), 100);

  // Requeue rows stranded mid-flight by a crashed tick (claimed DISPATCHING but
  // never resolved). Best-effort; a failure here must not block this run.
  await prisma.leadDispatch
    .updateMany({
      where: { status: "DISPATCHING", updatedAt: { lt: new Date(now.getTime() - STALE_DISPATCHING_MS) } },
      data: { status: "QUEUED" },
    })
    .catch(() => {});

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
          userId: true,
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
  let suppressed = 0;

  for (const d of due) {
    // Atomic claim: only the tick that flips QUEUED→DISPATCHING processes the
    // row. Defense-in-depth — double-send is also blocked by the EmailLog dedupe
    // and double-bill by the ledger unique constraint.
    const claim = await prisma.leadDispatch
      .updateMany({ where: { id: d.id, status: "QUEUED" }, data: { status: "DISPATCHING" } })
      .catch(() => ({ count: 0 }));
    if (!claim || claim.count === 0) continue;

    // CPRA/CCPA Do-Not-Sell: a lead is captured with explicit, recorded sharing
    // consent, but the right to opt out is continuing — if the consumer set
    // DO_NOT_SELL after capture, a still-QUEUED lead is a pending future "sale"
    // and must NOT be emailed to a partner (nor billed). Terminal, no retry.
    if (await hasCcpaOptOutForUser(d.lead.userId)) {
      await prisma.leadDispatch
        .update({
          where: { id: d.id },
          data: { status: "FAILED", lastErrorCode: "CCPA_OPT_OUT", attemptCount: { increment: 1 } },
        })
        .catch(() => {});
      suppressed++;
      continue;
    }

    try {
      // Resolve the recipient by partner kind: a mover application or a generic
      // Partner (R4). Both expose contactEmail + status. The dispatch may have sat
      // QUEUED since the lead was created, so RE-CHECK approval at send time: an
      // admin can reject/needs-info a partner in the interim, and we must NOT
      // deliver a consumer's PII (or accrue a CPL) to a de-authorized recipient
      // (audit P1-1). Fail-closed + terminal.
      const recipient =
        d.partnerKind === "partner"
          ? await prisma.partner.findUnique({ where: { id: d.partnerId }, select: { contactEmail: true, status: true } })
          : await prisma.moverApplication.findUnique({ where: { id: d.partnerId }, select: { contactEmail: true, status: true } });
      if (!recipient || recipient.status !== "APPROVED") {
        await prisma.leadDispatch.update({
          where: { id: d.id },
          data: { status: "FAILED", lastErrorCode: "NOT_APPROVED", attemptCount: { increment: 1 } },
        });
        failed++;
        continue;
      }
      const to = recipient.contactEmail?.trim();
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
      if (!contact || (!contact.contactEmail && !contact.contactPhone)) {
        // Undecryptable / contactless lead — terminal. Never email an empty lead
        // or accrue a charge for one (audit P2).
        await prisma.leadDispatch.update({
          where: { id: d.id },
          data: { status: "FAILED", lastErrorCode: "DECRYPT_FAILED", attemptCount: { increment: 1 } },
        });
        failed++;
        continue;
      }

      const result = await sendLoggedEmail({
        to,
        subject: leadEmailSubject(d.lead.category),
        html: leadEmailHtml(d.lead, contact),
        dedupeKey: d.idempotencyKey,
        metadata: { kind: "lead_dispatch", leadId: d.leadId },
      });

      // Mark SENT ONLY on a real send success (a true already-SENT dedupe also
      // returns success=true). A kill-switch skip or an orphaned PENDING log
      // returns success=false → retry rather than record a false delivery
      // (audit P2: PENDING-EmailLog false SENT).
      if (result.success) {
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
        // Return to QUEUED (off DISPATCHING) with a backoff so the next tick retries.
        await prisma.leadDispatch
          .update({
            where: { id: d.id },
            data: {
              status: "QUEUED",
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

  return { processed: due.length, sent, failed, retried, suppressed };
}
