import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getMoverPortalSession } from "@/lib/mover-portal-auth";
import { MoverPlacementRequest } from "@/components/movers/mover-placement-request";

export const metadata: Metadata = {
  title: "Request a placement · Mover portal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MoverPlacementsPage() {
  const session = await getMoverPortalSession();
  if (!session) redirect("/movers/portal");

  const company = await prisma.movingCompany.findUnique({
    where: { id: session.movingCompanyId },
    select: { state: true, active: true, hhgAuthorization: true },
  });
  if (!company) redirect("/movers/portal");

  // Eligibility mirrors the sponsored gate — only an active, HHG-authorized
  // mover can advertise.
  const eligible = company.active && company.hhgAuthorization;

  return (
    <main className="mx-auto w-full max-w-md px-5 py-12">
      <Link href="/movers/portal/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <h1 className="h1 text-3xl text-foreground">Request a sponsored placement</h1>
      <p className="mt-2 mb-6 text-sm leading-6 text-muted-foreground">
        A sponsored placement puts your company above the organic movers list in a state you serve, clearly labeled
        &quot;Sponsored.&quot; Tell us where and for how long, and we&apos;ll follow up with availability + pricing.
      </p>
      {eligible ? (
        <MoverPlacementRequest defaultState={company.state} />
      ) : (
        <div className="rounded-2xl border border-border bg-foreground/5 p-6 text-sm text-muted-foreground">
          Sponsored placements are available to active, household-goods-authorized movers. Your listing isn&apos;t
          currently eligible — contact support if you think this is an error.
        </div>
      )}
    </main>
  );
}
