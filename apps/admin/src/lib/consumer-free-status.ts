import { prisma } from "@/lib/db";
import { CONSUMER_FREE_FLAG } from "@locateflow/shared";

/**
 * Admin-side read of the consumer revenue model + the affiliate revenue line.
 *
 * The consumer app is now FREE — every feature is available to everyone, gated
 * only by fair-use limits, and revenue comes from affiliate / referral
 * commissions (partners pay us when a user chooses a provider through
 * LocateFlow). The switch for that pivot is the `CONSUMER_FREE` DB FeatureFlag
 * (see packages/shared/src/consumer-free.ts). This helper resolves it for the
 * admin chrome so the dashboard can show an honest status indicator without
 * touching the (dormant, kept-for-reversibility) billing infrastructure.
 *
 * Reversible by construction: an explicit disabled flag or opt-out default can
 * restore the legacy subscription narrative without deleting billing code.
 */

export interface ConsumerFreeStatus {
  /** True when the resolved CONSUMER_FREE feature flag is enabled. */
  consumerFreeEnabled: boolean;
  /** Affiliate commission already earned (APPROVED + PAID), in cents. */
  affiliateEarnedCents: number;
  /** Affiliate commission still pending network confirmation, in cents. */
  affiliatePendingCents: number;
}

function parseOptionalBoolean(value: string | undefined): boolean | null {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function consumerFreeEnabledByDefault(): boolean {
  return parseOptionalBoolean(process.env.CONSUMER_FREE_DEFAULT) ?? true;
}

/**
 * One cheap flag lookup + a single grouped sum over AffiliateConversion. The
 * affiliate revenue figures are the PRIMARY revenue story under the free model;
 * legacy MRR/subscription numbers stay available but are framed as dormant.
 */
export async function getConsumerFreeStatus(): Promise<ConsumerFreeStatus> {
  const [flag, conversionSums] = await Promise.all([
    prisma.featureFlag.findUnique({
      where: { name: CONSUMER_FREE_FLAG },
      select: { enabled: true },
    }),
    // APPROVED + PAID = earned; PENDING = not-yet-confirmed. Mirrors the
    // /affiliate page so the dashboard headline number can't drift from it.
    prisma.affiliateConversion.groupBy({
      by: ["status"],
      _sum: { amountCents: true },
    }),
  ]);

  const centsByStatus = new Map(
    conversionSums.map((row) => [row.status, row._sum.amountCents ?? 0]),
  );
  const affiliateEarnedCents =
    (centsByStatus.get("APPROVED") ?? 0) + (centsByStatus.get("PAID") ?? 0);
  const affiliatePendingCents = centsByStatus.get("PENDING") ?? 0;

  return {
    consumerFreeEnabled: flag?.enabled ?? consumerFreeEnabledByDefault(),
    affiliateEarnedCents,
    affiliatePendingCents,
  };
}
