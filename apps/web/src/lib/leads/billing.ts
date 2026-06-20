import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

/**
 * Partner CPL billing accrual (R5a). When a lead is DELIVERED to a generic
 * Partner, accrue a per-lead charge as a PENDING PartnerLedgerEntry. A monthly
 * rollup (R5c) turns PENDING lines into an invoice.
 *
 * Fail-safe by construction: an unset/zero CPL rate → no charge; any error → no
 * charge (billing must NEVER block or fail lead delivery). Idempotent on
 * leadDispatchId so a re-run never double-bills. v1 bills generic Partners only
 * (movers are a separate FMCSA track).
 */

const CPL_CONFIG_PREFIX = "CPL_CENTS_"; // e.g. CPL_CENTS_CLEANING, CPL_CENTS_JUNK

function periodKey(now: Date): string {
  return now.toISOString().slice(0, 7); // YYYY-MM
}

/** Per-category cost-per-lead in cents (RuntimeConfig). Unset/≤0 → 0 (no charge). */
export async function resolveCplCents(category: string): Promise<number> {
  try {
    const raw = await getRuntimeConfigValue(`${CPL_CONFIG_PREFIX}${category.trim().toUpperCase()}`);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export interface AccrueResult {
  accrued: boolean;
  amountCents: number;
}

export async function accruePartnerLeadCharge(input: {
  leadDispatchId: string;
  partnerId: string;
  category: string;
  now?: Date;
}): Promise<AccrueResult> {
  const now = input.now ?? new Date();
  try {
    const amountCents = await resolveCplCents(input.category);
    if (amountCents <= 0) return { accrued: false, amountCents: 0 };

    // Idempotent: at most one CPL line per delivery (leadDispatchId is @unique).
    const existing = await prisma.partnerLedgerEntry.findUnique({
      where: { leadDispatchId: input.leadDispatchId },
      select: { id: true },
    });
    if (existing) return { accrued: false, amountCents };

    await prisma.partnerLedgerEntry.create({
      data: {
        partnerId: input.partnerId,
        kind: "CPL",
        amountCents,
        leadDispatchId: input.leadDispatchId,
        periodKey: periodKey(now),
        status: "PENDING",
      },
    });
    await prisma.leadDispatch
      .update({ where: { id: input.leadDispatchId }, data: { cplCents: amountCents } })
      .catch(() => {});
    return { accrued: true, amountCents };
  } catch {
    // Unique-violation race or any DB error — never block delivery on billing.
    return { accrued: false, amountCents: 0 };
  }
}
