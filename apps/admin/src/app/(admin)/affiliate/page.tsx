import Link from "next/link";
import { requirePagePermission } from "@/lib/page-guard";
import { prisma } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AffiliateConversionsClient } from "./affiliate-conversions-client";

// Affiliate revenue overview (Layer 1). Read-only analytics over AffiliateClick
// + the provider rows that carry an active offer. Offers themselves are managed
// on each provider's edit page, so this view stays focused on performance.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Affiliate — Admin",
  robots: { index: false, follow: false },
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default async function AffiliatePage() {
  await requirePagePermission("providers", "canRead", { minimumRole: "VIEWER" });

  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const [offers, totalClicks, clicks30d, countsAll, counts30d, recentClicks, conversionStats, recentConversions] =
    await Promise.all([
      prisma.serviceProvider.findMany({
        where: { affiliateActive: true, deletedAt: null },
        select: { id: true, name: true, category: true, affiliateNetwork: true, affiliateUrl: true },
        orderBy: { name: "asc" },
      }),
      prisma.affiliateClick.count(),
      prisma.affiliateClick.count({ where: { createdAt: { gte: since } } }),
      prisma.affiliateClick.groupBy({ by: ["providerId"], _count: { _all: true } }),
      prisma.affiliateClick.groupBy({ by: ["providerId"], _count: { _all: true }, where: { createdAt: { gte: since } } }),
      prisma.affiliateClick.findMany({
        take: 25,
        orderBy: { createdAt: "desc" },
        select: { id: true, source: true, network: true, createdAt: true, provider: { select: { name: true } } },
      }),
      prisma.affiliateConversion.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amountCents: true } }),
      prisma.affiliateConversion.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          network: true,
          status: true,
          amountCents: true,
          currency: true,
          occurredAt: true,
          createdAt: true,
          provider: { select: { name: true } },
        },
      }),
    ]);

  const totalByProvider = new Map(countsAll.map((r) => [r.providerId, r._count._all]));
  const recentByProvider = new Map(counts30d.map((r) => [r.providerId, r._count._all]));

  const offersWithCounts = offers
    .map((o) => ({
      ...o,
      totalClicks: totalByProvider.get(o.id) ?? 0,
      recentClicks: recentByProvider.get(o.id) ?? 0,
    }))
    .sort((a, b) => b.totalClicks - a.totalClicks);

  // Revenue: count APPROVED + PAID as earned; PENDING is not-yet-confirmed.
  const totalConversions = conversionStats.reduce((sum, r) => sum + r._count._all, 0);
  const centsByStatus = new Map(conversionStats.map((r) => [r.status, r._sum.amountCents ?? 0]));
  const earnedCents = (centsByStatus.get("APPROVED") ?? 0) + (centsByStatus.get("PAID") ?? 0);
  const pendingCents = centsByStatus.get("PENDING") ?? 0;
  const fmtUsd = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  // EPC = earned revenue per click — the number that justifies a partner.
  const epcCents = totalClicks > 0 ? earnedCents / totalClicks : 0;

  const stats = [
    { label: "Active offers", value: offers.length.toLocaleString() },
    { label: "Clicks (all time)", value: totalClicks.toLocaleString() },
    { label: "Clicks (30 days)", value: clicks30d.toLocaleString() },
  ];

  const revenueStats = [
    { label: "Earned (approved + paid)", value: fmtUsd(earnedCents) },
    { label: "Pending", value: fmtUsd(pendingCents) },
    { label: "Conversion rate", value: `${conversionRate.toFixed(2)}%` },
    { label: "EPC (earned / click)", value: fmtUsd(epcCents) },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <AdminPageHeader
        eyebrow="Revenue"
        title="Affiliate"
        subtitle="Outbound affiliate performance. Configure an offer on each provider’s edit page (Affiliate section)."
        actions={
          <>
            <a
              href="/api/affiliate/export?type=clicks"
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Export clicks
            </a>
            <a
              href="/api/affiliate/export?type=conversions"
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Export conversions
            </a>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{s.label}</p>
            <p className="mt-1.5 font-display text-3xl font-extrabold leading-none text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {revenueStats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{s.label}</p>
            <p className="mt-1.5 font-display text-2xl font-extrabold leading-none text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Conversion reconciliation — advance commissions PENDING → APPROVED →
          PAID (or REJECTED) as each network settles. Mutations are step-up
          (password + MFA) gated and audited. */}
      <AffiliateConversionsClient />

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 font-display text-base font-bold text-foreground">
          Active offers <span className="font-mono text-sm font-medium text-muted-foreground">({offersWithCounts.length})</span>
        </h2>
        {offersWithCounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active affiliate offers yet. Open a provider, scroll to the Affiliate section, add an https link and mark it active.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <th scope="col" className="py-2 pr-4">Provider</th>
                  <th scope="col" className="py-2 pr-4">Category</th>
                  <th scope="col" className="py-2 pr-4">Network</th>
                  <th scope="col" className="py-2 pr-4 text-right">Clicks (30d)</th>
                  <th scope="col" className="py-2 pr-4 text-right">Clicks (all)</th>
                  <th scope="col" className="py-2 pr-4">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {offersWithCounts.map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-accent/30">
                    <td className="py-2.5 pr-4 font-medium text-foreground">
                      {o.affiliateUrl ? (
                        <a href={o.affiliateUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {o.name}
                        </a>
                      ) : (
                        o.name
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{o.category}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{o.affiliateNetwork || "—"}</td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-foreground">{o.recentClicks.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-foreground">{o.totalClicks.toLocaleString()}</td>
                    <td className="py-2.5 pr-4">
                      <Link href={`/providers/${o.id}/edit`} className="text-primary hover:underline">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 font-display text-base font-bold text-foreground">Recent clicks</h2>
        {recentClicks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clicks recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <th scope="col" className="py-2 pr-4">Provider</th>
                  <th scope="col" className="py-2 pr-4">Source</th>
                  <th scope="col" className="py-2 pr-4">Network</th>
                  <th scope="col" className="py-2 pr-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {recentClicks.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-accent/30">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{c.provider?.name ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{c.source}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{c.network || "—"}</td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-muted-foreground">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 font-display text-base font-bold text-foreground">Recent conversions</h2>
        {recentConversions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No conversions yet. Conversions arrive via the per-network postback endpoint
            (<code className="rounded bg-muted px-1 font-mono text-xs">/api/affiliate/postback/&lt;network&gt;</code>).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <th scope="col" className="py-2 pr-4">Provider</th>
                  <th scope="col" className="py-2 pr-4">Network</th>
                  <th scope="col" className="py-2 pr-4">Status</th>
                  <th scope="col" className="py-2 pr-4 text-right">Amount</th>
                  <th scope="col" className="py-2 pr-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {recentConversions.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-accent/30">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{c.provider?.name ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{c.network}</td>
                    <td className="py-2.5 pr-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-foreground">
                      {c.currency} {(c.amountCents / 100).toFixed(2)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-muted-foreground">{formatDate(c.occurredAt ?? c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
