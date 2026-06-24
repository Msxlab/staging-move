export const dynamic = "force-dynamic";

import { Check } from "lucide-react";
import {
  BILLING_PLAN_DEFINITIONS,
  PAID_BILLING_PLANS,
  isActiveSubscriptionStatus,
  type BillingPlan,
} from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/page-guard";
import { getConsumerFreeStatus } from "@/lib/consumer-free-status";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminPanel } from "@/components/admin-panel";

// Read-only billing reference page: the plan catalog as the product ships
// it, plus live adoption per tier. Gated like /subscriptions — VIEWER-floor
// read on the `subscriptions` resource so support roles can see plan facts
// without any mutation surface (there is none on this page).
export const metadata = {
  title: "Plans — Admin",
  robots: { index: false, follow: false },
};

/** Display order: Free first, then the paid ladder. */
const PLAN_DISPLAY_ORDER: BillingPlan[] = ["FREE_TRIAL", "INDIVIDUAL", "FAMILY", "PRO"];

/**
 * Per-tier presentation facts that are admin-console concerns (accent
 * tone, catalog tag) rather than product copy — everything else on the
 * card renders straight from the shared BILLING_PLAN_DEFINITIONS so a
 * pricing or entitlement change in packages/shared flows through. Tones
 * map to the Move admin semantic tone tokens used across the console.
 */
const PLAN_PRESENTATION: Record<
  BillingPlan,
  { dotClass: string; tagClass: string; tag: string; featured: boolean }
> = {
  FREE_TRIAL: {
    dotClass: "bg-tone-slate-fg",
    tagClass: "bg-tone-slate-bg text-muted-foreground",
    tag: "Free",
    featured: false,
  },
  INDIVIDUAL: {
    dotClass: "bg-tone-sky-fg",
    tagClass: "bg-tone-sky-bg text-tone-sky-fg",
    tag: "Base",
    featured: false,
  },
  FAMILY: {
    dotClass: "bg-primary",
    tagClass: "bg-primary/10 text-primary",
    tag: "Popular",
    featured: true,
  },
  PRO: {
    dotClass: "bg-tone-honey-fg",
    tagClass: "bg-tone-honey-bg text-tone-honey-fg",
    tag: "Premium",
    featured: false,
  },
};

interface TierStats {
  /** Subscriptions in a live state (ACTIVE/TRIALING/FREE_ACCESS/grace...). */
  liveCount: number;
  /** Realized MRR mirrored from the dashboard policy (ACTIVE × monthly price). */
  mrrUsd: number;
}

/**
 * One cheap groupBy over (plan, status); everything else is arithmetic.
 *
 * - liveCount sums the statuses `isActiveSubscriptionStatus` recognizes, so
 *   the Free card counts FREE_ACCESS users that never show up in the paid
 *   ACTIVE/TRIALING numbers.
 * - mrrUsd mirrors the dashboard exactly: ACTIVE rows × monthlyPriceUsd for
 *   paid plans only (yearly subs contribute their amortized monthly price by
 *   the same simplification the dashboard makes), so the bar chart here and
 *   the MRR KPI on /(admin) can never disagree.
 */
async function getTierStats(): Promise<Record<string, TierStats>> {
  const rows = await prisma.subscription.groupBy({
    by: ["plan", "status"],
    _count: { id: true },
  });

  const stats: Record<string, TierStats> = {};
  for (const plan of PLAN_DISPLAY_ORDER) {
    stats[plan] = { liveCount: 0, mrrUsd: 0 };
  }

  for (const row of rows) {
    const entry = stats[row.plan];
    if (!entry) continue; // unknown legacy plan strings contribute nothing
    if (isActiveSubscriptionStatus(row.status)) {
      entry.liveCount += row._count.id;
    }
    if (row.status === "ACTIVE") {
      const def = BILLING_PLAN_DEFINITIONS[row.plan as BillingPlan];
      if (def?.isPaid) {
        entry.mrrUsd += def.monthlyPriceUsd * row._count.id;
      }
    }
  }
  return stats;
}

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);

export default async function PlansPage() {
  await requirePagePermission("subscriptions", "canRead", {
    minimumRole: "VIEWER",
  });

  // Under the consumer-free pivot this paid plan ladder is LEGACY/DORMANT:
  // the consumer app is free (affiliate-funded), so the prices, "Premium"
  // tag and MRR below describe the dormant (kept-for-reversibility) billing
  // catalog rather than the live revenue model. We resolve the CONSUMER_FREE
  // flag and reframe the page accordingly — mirroring /billing and
  // /subscriptions — without removing the data or operator controls. Flag off
  // ⇒ the pre-pivot subscription narrative reads correctly.
  const [{ consumerFreeEnabled }, tierStats] = await Promise.all([
    getConsumerFreeStatus(),
    getTierStats(),
  ]);

  const totalMrr = PAID_BILLING_PLANS.reduce(
    (sum, plan) => sum + (tierStats[plan]?.mrrUsd ?? 0),
    0,
  );
  const maxMrr = Math.max(
    ...PAID_BILLING_PLANS.map((plan) => tierStats[plan]?.mrrUsd ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={consumerFreeEnabled ? "Legacy billing" : "Billing"}
        title="Plans"
        subtitle={
          consumerFreeEnabled
            ? "Legacy plan catalog — dormant under the free model. The consumer app is free for everyone (affiliate-funded); these tiers, prices, and MRR are kept for historical data and reversibility, not the live revenue story."
            : "The live plan catalog — pricing, entitlements, and adoption per tier. Definitions are read from the shared billing source of truth."
        }
      />

      {consumerFreeEnabled && (
        <div className="flex flex-col gap-2 rounded-2xl border border-tone-honey-br bg-tone-honey-bg/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Legacy / dormant.</span> The consumer
            app is free (affiliate-funded). This paid plan ladder &mdash; prices,
            the &ldquo;Premium&rdquo; tier and MRR &mdash; is kept for historical
            data and remains reversible, but is not the live revenue model.
          </p>
          <a
            href="/affiliate"
            className="shrink-0 self-start rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent sm:self-auto"
          >
            View affiliate revenue →
          </a>
        </div>
      )}

      {/* Tier cards — Free / Individual / Family (POPULAR) / Pro */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_DISPLAY_ORDER.map((plan) => {
          const def = BILLING_PLAN_DEFINITIONS[plan];
          const pres = PLAN_PRESENTATION[plan];
          const stats = tierStats[plan];
          return (
            <article
              key={plan}
              className={`flex flex-col rounded-2xl border bg-card p-5 transition-shadow hover:shadow-lg ${
                pres.featured ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2 w-2 rounded-full ${pres.dotClass}`}
                  aria-hidden="true"
                />
                <h2 className="font-display text-base font-bold text-foreground">
                  {def.displayName}
                </h2>
                <span
                  className={`ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.14em] ${
                    consumerFreeEnabled && def.isPaid
                      ? "bg-muted text-muted-foreground"
                      : pres.tagClass
                  }`}
                >
                  {consumerFreeEnabled && def.isPaid ? "Legacy" : pres.tag}
                </span>
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-mono text-2xl font-semibold text-foreground">
                  {def.isPaid ? def.priceLabel : "$0"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {def.isPaid ? def.periodLabel : "forever"}
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {def.yearlyPriceLabel
                  ? `${def.yearlyPriceLabel} billed annually`
                  : "No payment method required"}
              </p>

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {def.shortDescription}
              </p>

              <ul className="mt-4 space-y-2 border-t border-border pt-4">
                {def.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-foreground/85">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex items-baseline justify-between gap-2 border-t border-border pt-4">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                  Live
                </span>
                <span className="text-xs text-muted-foreground">
                  <strong className="font-mono text-sm font-semibold text-foreground">
                    {stats.liveCount.toLocaleString("en-US")}
                  </strong>{" "}
                  {def.isPaid
                    ? `· ${fmtUsd(stats.mrrUsd)} MRR`
                    : "free accounts"}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {/* MRR by plan — flat horizontal bars, same realized-revenue policy as
          the dashboard KPI, so the two surfaces always agree. */}
      <AdminPanel
        title={consumerFreeEnabled ? "MRR by plan (legacy)" : "MRR by plan"}
        caption={
          consumerFreeEnabled
            ? `${fmtUsd(totalMrr)} legacy monthly recurring · dormant under the free model, kept for historical data`
            : `${fmtUsd(totalMrr)} total monthly recurring · active paid subscriptions, yearly amortized`
        }
      >
        <div className="space-y-4">
          {PAID_BILLING_PLANS.map((plan) => {
            const def = BILLING_PLAN_DEFINITIONS[plan];
            const pres = PLAN_PRESENTATION[plan];
            const mrr = tierStats[plan]?.mrrUsd ?? 0;
            const widthPct = maxMrr > 0 ? Math.max((mrr / maxMrr) * 100, mrr > 0 ? 2 : 0) : 0;
            return (
              <div key={plan} className="flex items-center gap-4">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">
                  {def.displayName}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <i
                    className={`block h-full rounded-full ${pres.dotClass}`}
                    style={{ width: `${widthPct}%` }}
                    aria-hidden="true"
                  />
                </div>
                <span className="w-24 shrink-0 text-right font-mono text-xs font-semibold text-foreground">
                  {fmtUsd(mrr)}
                </span>
              </div>
            );
          })}
          {totalMrr === 0 ? (
            <p className="text-xs text-muted-foreground">
              No realized recurring revenue yet — bars fill in as paid subscriptions activate.
            </p>
          ) : null}
        </div>
      </AdminPanel>
    </div>
  );
}
