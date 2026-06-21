import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, BarChart3, MousePointerClick, Megaphone, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { getMoverPortalSession } from "@/lib/mover-portal-auth";

export const metadata: Metadata = {
  title: "Your listing · Mover portal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MoverPortalDashboard() {
  const session = await getMoverPortalSession();
  if (!session) redirect("/movers/portal");

  const [company, placements, sponsoredEnabledRaw] = await Promise.all([
    prisma.movingCompany.findUnique({
      where: { id: session.movingCompanyId },
      select: { id: true, legalName: true, dbaName: true, state: true, hhgAuthorization: true, safetyRating: true, active: true },
    }),
    prisma.sponsoredPlacement.findMany({
      where: { kind: "mover", targetId: session.movingCompanyId },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, stateScope: true, startsAt: true, endsAt: true, active: true, impressions: true, clicks: true },
    }),
    getRuntimeConfigValue("SPONSORED_ENABLED").catch(() => null),
  ]);

  if (!company) redirect("/movers/portal");

  const sponsoredEnabled = sponsoredEnabledRaw?.trim().toLowerCase() === "true";
  const now = Date.now();
  const totalImpressions = placements.reduce((s, p) => s + p.impressions, 0);
  const totalClicks = placements.reduce((s, p) => s + p.clicks, 0);
  const activePlacement = placements.find(
    (p) => p.active && p.startsAt.getTime() <= now && p.endsAt.getTime() >= now,
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Mover portal</p>
          <h1 className="h1 mt-1 text-3xl text-foreground">{company.legalName}</h1>
          {company.dbaName && <p className="text-sm text-muted-foreground">DBA: {company.dbaName}</p>}
        </div>
        <form action="/api/movers/portal/logout" method="post">
          <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </form>
      </div>

      {/* Listing status */}
      <section className="mb-6 rounded-2xl border border-border bg-foreground/5 p-5">
        <h2 className="h2 text-lg text-foreground">Your listing</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium ${company.active ? "border-tone-sage-br bg-tone-sage-bg text-tone-sage-fg" : "border-border text-muted-foreground"}`}>
            <CheckCircle2 className="h-3.5 w-3.5" /> {company.active ? "Listed & verified" : "Inactive"}
          </span>
          <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">State: {company.state}</span>
          {company.hhgAuthorization && <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">HHG authorized</span>}
          {company.safetyRating && <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">FMCSA: {company.safetyRating}</span>}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Your listing appears in the Move licensed-movers directory for people moving in your service area.
          Listing details come from the FMCSA register — to correct them, contact support.
        </p>
      </section>

      {/* Stats */}
      <section className="mb-6 grid grid-cols-2 gap-4">
        <Stat icon={<BarChart3 className="h-4 w-4" />} label="Sponsored impressions" value={totalImpressions} />
        <Stat icon={<MousePointerClick className="h-4 w-4" />} label="Sponsored clicks" value={totalClicks} />
      </section>

      {/* Sponsored placement */}
      <section className="rounded-2xl border border-border bg-foreground/5 p-5">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-tone-orange-fg" />
          <h2 className="h2 text-lg text-foreground">Sponsored placement</h2>
        </div>
        {activePlacement ? (
          <div className="mt-3 rounded-xl border border-tone-orange-br bg-tone-orange-bg/40 p-4">
            <p className="text-sm font-semibold text-foreground">
              Active{activePlacement.stateScope ? ` in ${activePlacement.stateScope}` : " nationally"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Runs {activePlacement.startsAt.toISOString().slice(0, 10)} → {activePlacement.endsAt.toISOString().slice(0, 10)} ·{" "}
              {activePlacement.impressions} impressions · {activePlacement.clicks} clicks
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            You don&apos;t have an active sponsored placement. A sponsored slot puts your company above the organic
            list in your service area, clearly labeled &quot;Sponsored.&quot;
          </p>
        )}
        {sponsoredEnabled ? (
          <Link
            href="/movers/portal/placements"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-tone-orange-fg px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <Megaphone className="h-4 w-4" /> {activePlacement ? "Request another placement" : "Request a sponsored placement"}
          </Link>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">Sponsored placements aren&apos;t open yet — check back soon.</p>
        )}
      </section>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-foreground/5 p-5">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
      <p className="mt-2 text-3xl font-bold text-foreground tabular-nums">{value.toLocaleString("en-US")}</p>
    </div>
  );
}
