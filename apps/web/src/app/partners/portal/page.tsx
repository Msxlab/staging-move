import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getPartnerPortalSession } from "@/lib/partner-portal-auth";
import { PartnerPortalRequestForm } from "@/components/partners/partner-portal-request-form";

export const metadata: Metadata = {
  title: "Partner portal · Move",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "—";
}

export default async function PartnerPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getPartnerPortalSession();
  const { error } = await searchParams;

  // Signed out → magic-link request form.
  if (!session) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-12 sm:py-16">
        <h1 className="mb-2 text-2xl font-bold text-foreground">Partner portal</h1>
        {error === "invalid" ? (
          <p className="mb-3 text-sm text-tone-rose-fg">That sign-in link is invalid or expired. Request a new one.</p>
        ) : null}
        <PartnerPortalRequestForm />
      </main>
    );
  }

  const [partner, dispatches] = await Promise.all([
    prisma.partner.findUnique({
      where: { id: session.partnerId },
      select: { companyName: true, category: true, serviceStates: true, leadsOptIn: true },
    }),
    prisma.leadDispatch.findMany({
      where: { partnerKind: "partner", partnerId: session.partnerId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        createdAt: true,
        sentAt: true,
        lead: {
          select: { category: true, fromZip: true, toZip: true, fromState: true, toState: true, moveDate: true },
        },
      },
    }),
  ]);

  const sent = dispatches.filter((d) => d.status === "SENT").length;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Partner portal</p>
          <h1 className="text-2xl font-bold text-foreground">{partner?.companyName ?? "Your business"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {partner?.category ?? ""} · {partner?.serviceStates || "Nationwide"}
          </p>
        </div>
        <form action="/api/partners/portal/logout" method="post">
          <button className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Leads received</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{dispatches.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Delivered</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{sent}</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">Lead delivery</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {partner?.leadsOptIn
                ? "On — we email you matching customer leads in your service area."
                : "Off — you are not currently receiving leads."}
            </p>
          </div>
          <form action="/api/partners/portal/leads-optin" method="post">
            <input type="hidden" name="optIn" value={partner?.leadsOptIn ? "false" : "true"} />
            <button
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              type="submit"
            >
              {partner?.leadsOptIn ? "Turn off lead delivery" : "Turn on lead delivery"}
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 font-semibold text-foreground">Recent leads</h2>
        {dispatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No leads yet. When a customer in your area requests {partner?.category ?? "your"} service, it appears here and
            we email you the details.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Area</th>
                  <th className="py-2 pr-4">Job date</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Received</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map((d) => {
                  const area = d.lead.toZip || d.lead.toState || d.lead.fromState || "—";
                  return (
                    <tr key={d.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium text-foreground">{area}</td>
                      <td className="py-2 pr-4 text-muted-foreground tabular-nums">{fmtDate(d.lead.moveDate)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{d.status}</td>
                      <td className="py-2 pr-4 text-muted-foreground tabular-nums">{fmtDate(d.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Customer contact details are sent to your email when each lead arrives.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
