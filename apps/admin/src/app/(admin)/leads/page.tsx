import { requirePagePermission } from "@/lib/page-guard";
import { prisma } from "@/lib/db";

// Read-only lead-gen queue (R3e). Shows captured moving leads + their per-partner
// dispatch status for monitoring. PII (name/contact/notes) lives only in the
// encrypted lead payload and is NEVER decrypted here — admins see coarse routing
// + delivery status, not the consumer's contact details.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leads — Admin",
  robots: { index: false, follow: false },
};

function fmtDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "—";
}

export default async function LeadsPage() {
  await requirePagePermission("providers", "canRead", { minimumRole: "VIEWER" });

  const [leads, totalLeads, leadStatusCounts, dispatchStatusCounts] = await Promise.all([
    prisma.lead.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        category: true,
        status: true,
        fromZip: true,
        toZip: true,
        fromState: true,
        toState: true,
        moveDate: true,
        homeSize: true,
        matchedCount: true,
        createdAt: true,
        dispatches: { select: { status: true } },
      },
    }),
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.leadDispatch.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const dispatchByStatus = new Map(dispatchStatusCounts.map((r) => [r.status, r._count._all]));
  const matchedLeads = leadStatusCounts.find((r) => r.status === "MATCHED")?._count._all ?? 0;

  const stats = [
    { label: "Total leads", value: totalLeads.toLocaleString() },
    { label: "Matched", value: matchedLeads.toLocaleString() },
    { label: "Dispatches sent", value: (dispatchByStatus.get("SENT") ?? 0).toLocaleString() },
    { label: "Queued", value: (dispatchByStatus.get("QUEUED") ?? 0).toLocaleString() },
    { label: "Failed", value: (dispatchByStatus.get("FAILED") ?? 0).toLocaleString() },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Revenue</p>
        <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Captured moving-quote requests and their delivery to matched partners. Contact details are
          encrypted and not shown here — this view is for delivery monitoring only.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-semibold text-foreground">Recent leads ({leads.length})</h2>
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No leads captured yet. They arrive when a user submits the moving-quote form
            (behind the <code className="text-xs">offers_moving_quotes_v1</code> flag).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-4">Route</th>
                  <th scope="col" className="py-2 pr-4">Move date</th>
                  <th scope="col" className="py-2 pr-4">Home</th>
                  <th scope="col" className="py-2 pr-4">Status</th>
                  <th scope="col" className="py-2 pr-4 text-right">Delivered</th>
                  <th scope="col" className="py-2 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const route =
                    [lead.fromZip || lead.fromState, lead.toZip || lead.toState]
                      .filter(Boolean)
                      .join(" → ") || "—";
                  const sent = lead.dispatches.filter((d) => d.status === "SENT").length;
                  return (
                    <tr key={lead.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium text-foreground">{route}</td>
                      <td className="py-2 pr-4 text-muted-foreground tabular-nums">{fmtDate(lead.moveDate)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{lead.homeSize || "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{lead.status}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-foreground">
                        {sent}/{lead.dispatches.length}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground tabular-nums">{fmtDate(lead.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
