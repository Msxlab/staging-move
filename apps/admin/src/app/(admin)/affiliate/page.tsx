import Link from "next/link";
import { requirePagePermission } from "@/lib/page-guard";
import { prisma } from "@/lib/db";
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Revenue</p>
          <h1 className="text-2xl font-semibold text-foreground">Affiliate</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Outbound affiliate performance. Configure an offer on each provider&rsquo;s edit page (Affiliate section).
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/affiliate/export?type=clicks"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Export clicks
          </a>
          <a
            href="/api/affiliate/export?type=conversions"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Export conversions
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {revenueStats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Conversion reconciliation — advance commissions PENDING → APPROVED →
          PAID (or REJECTED) as each network settles. Mutations are step-up
          (password + MFA) gated and audited. */}
      <AffiliateConversionsClient />

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-semibold text-foreground">Active offers ({offersWithCounts.length})</h2>
        {offersWithCounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active affiliate offers yet. Open a provider, scroll to the Affiliate section, add an https link and mark it active.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-4">Provider</th>
                  <th scope="col" className="py-2 pr-4">Category</th>
                  <th scope="col" className="py-2 pr-4">Network</th>
                  <th scope="col" className="py-2 pr-4 text-right">Clicks (30d)</th>
                  <th scope="col" className="py-2 pr-4 text-right">Clicks (all)</th>
                  <th scope="col" className="py-2 pr-4">Manage</th>
                </tr>
              </thead>
              <tbody>
                {offersWithCounts.map((o) => (
                  <tr key={o.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {o.affiliateUrl ? (
                        <a href={o.affiliateUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {o.name}
                        </a>
                      ) : (
                        o.name
                      )}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{o.category}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{o.affiliateNetwork || "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-foreground">{o.recentClicks.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-foreground">{o.totalClicks.toLocaleString()}</td>
                    <td className="py-2 pr-4">
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

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-semibold text-foreground">Recent clicks</h2>
        {recentClicks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clicks recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-4">Provider</th>
                  <th scope="col" className="py-2 pr-4">Source</th>
                  <th scope="col" className="py-2 pr-4">Network</th>
                  <th scope="col" className="py-2 pr-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentClicks.map((c) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium text-foreground">{c.provider?.name ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{c.source}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{c.network || "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground tabular-nums">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-semibold text-foreground">Recent conversions</h2>
        {recentConversions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No conversions yet. Conversions arrive via the per-network postback endpoint
            (<code className="text-xs">/api/affiliate/postback/&lt;network&gt;</code>).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-4">Provider</th>
                  <th scope="col" className="py-2 pr-4">Network</th>
                  <th scope="col" className="py-2 pr-4">Status</th>
                  <th scope="col" className="py-2 pr-4 text-right">Amount</th>
                  <th scope="col" className="py-2 pr-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentConversions.map((c) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium text-foreground">{c.provider?.name ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{c.network}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{c.status}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-foreground">
                      {c.currency} {(c.amountCents / 100).toFixed(2)}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground tabular-nums">{formatDate(c.occurredAt ?? c.createdAt)}</td>
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
