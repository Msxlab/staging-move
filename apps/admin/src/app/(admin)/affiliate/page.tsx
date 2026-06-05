import Link from "next/link";
import { requirePagePermission } from "@/lib/page-guard";
import { prisma } from "@/lib/db";

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

  const [offers, totalClicks, clicks30d, countsAll, counts30d, recentClicks] = await Promise.all([
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

  const stats = [
    { label: "Active offers", value: offers.length },
    { label: "Clicks (all time)", value: totalClicks },
    { label: "Clicks (30 days)", value: clicks30d },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Revenue</p>
        <h1 className="text-2xl font-semibold text-foreground">Affiliate</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Outbound affiliate performance. Configure an offer on each provider&rsquo;s edit page (Affiliate section).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

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
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Network</th>
                  <th className="py-2 pr-4 text-right">Clicks (30d)</th>
                  <th className="py-2 pr-4 text-right">Clicks (all)</th>
                  <th className="py-2 pr-4">Manage</th>
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
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Network</th>
                  <th className="py-2 pr-4">Date</th>
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
    </div>
  );
}
