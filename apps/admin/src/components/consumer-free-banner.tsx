import Link from "next/link";
import { Gift, Link2 } from "lucide-react";

interface ConsumerFreeBannerProps {
  /** Whether the CONSUMER_FREE FeatureFlag is currently enabled. */
  enabled: boolean;
  /** Earned affiliate commission (APPROVED + PAID) in cents. */
  affiliateEarnedCents: number;
  /** Pending affiliate commission in cents. */
  affiliatePendingCents: number;
}

const fmtUsd = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Revenue-model status indicator for the admin dashboard.
 *
 * Reflects the owner decision (2026-06): the consumer app is FREE for everyone,
 * funded by affiliate / referral commissions. When CONSUMER_FREE is on, this
 * banner makes the PRIMARY revenue story — affiliate commission earned — the
 * headline, and signals that the subscription/MRR figures elsewhere on the
 * dashboard are LEGACY/DORMANT (kept for historical data; billing infra stays
 * dormant + reversible). When the flag is off, it falls back to a neutral note
 * so the page reads correctly in the pre-pivot (subscription) world.
 *
 * Server-rendered, client-free.
 */
export function ConsumerFreeBanner({
  enabled,
  affiliateEarnedCents,
  affiliatePendingCents,
}: ConsumerFreeBannerProps) {
  return (
    <section
      className={`rounded-2xl border p-5 ${
        enabled
          ? "border-tone-sage-br bg-tone-sage-bg/40"
          : "border-border bg-card"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              enabled ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-muted text-muted-foreground"
            }`}
          >
            <Gift className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-bold text-foreground">
                Consumer model: {enabled ? "Free" : "Subscription (legacy)"}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  enabled
                    ? "border-tone-sage-br bg-tone-sage-bg text-tone-sage-fg"
                    : "border-border bg-muted text-muted-foreground"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    enabled ? "bg-tone-sage-fg" : "bg-muted-foreground"
                  }`}
                />
                CONSUMER_FREE {enabled ? "on" : "off"}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              {enabled
                ? "Every feature is free for everyone, gated only by fair-use limits. Revenue comes from affiliate & referral commissions — partners pay us when a user chooses a provider through LocateFlow, at no cost to the user. Subscription / MRR figures below are legacy and dormant."
                : "The consumer-free pivot is currently off, so subscription / MRR figures below reflect the live revenue model. Affiliate commissions are tracked in parallel."}
            </p>
          </div>
        </div>

        {/* Primary revenue line under the free model: affiliate commission. */}
        <div className="flex shrink-0 items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
              Affiliate earned
            </p>
            <p className="font-display text-2xl font-extrabold leading-none text-foreground au-num">
              {fmtUsd(affiliateEarnedCents)}
            </p>
            {affiliatePendingCents > 0 && (
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {fmtUsd(affiliatePendingCents)} pending
              </p>
            )}
          </div>
          <Link
            href="/affiliate"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Link2 className="h-3.5 w-3.5" />
            Affiliate revenue
          </Link>
        </div>
      </div>
    </section>
  );
}
